import { useEffect, useState } from 'react';
import { api, Statistics } from './api';
import { styles } from './styles';

// Dashboard uses the real /api/items/statistics endpoint. No hardcoded numbers.
export function DashboardPage({ reloadSignal }: { reloadSignal?: number }) {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.statistics()
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [reloadSignal]);

  return (
    <div>
      <h1 style={styles.h1}>Dashboard</h1>
      <p style={styles.sub}>실제 데이터베이스 통계입니다.</p>

      {loading ? (
        <div style={styles.muted}>불러오는 중…</div>
      ) : error ? (
        <div style={styles.error}>오류: {error}</div>
      ) : stats ? (
        <>
          <div style={styles.statGrid}>
            <Stat label="전체 아이템" value={stats.totalItems} />
            <Stat label="설명 있음" value={stats.itemsWithDescription} />
            <Stat label="설명 없음" value={stats.itemsWithoutDescription} />
            <Stat label="최근 아이템" value={stats.latestItem ? `#${stats.latestItem.id}` : '—'} />
          </div>
          <div style={styles.card}>
            <strong>가장 최근 아이템</strong>
            {stats.latestItem ? (
              <div style={{ marginTop: 8 }}>
                <div>#{stats.latestItem.id} {stats.latestItem.name}</div>
                <div style={{ color: '#6b7280', fontSize: 14 }}>{stats.latestItem.description ?? '설명 없음'}</div>
                <div style={styles.muted}>생성: {new Date(stats.latestItem.createdAt).toLocaleString()}</div>
              </div>
            ) : (
              <div style={{ marginTop: 8, ...styles.muted }}>아이템이 없습니다.</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.statBox}>
      <div style={styles.statValue}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}
