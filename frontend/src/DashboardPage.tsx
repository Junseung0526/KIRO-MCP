import { useCallback, useEffect, useState } from 'react';
import { api, Item, Statistics } from './api';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusIndicator } from './components/ui';
import type { PageKey } from './components/AppShell';

export function DashboardPage({ reloadSignal, onNavigate }: { reloadSignal?: number; onNavigate: (p: PageKey) => void }) {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [recent, setRecent] = useState<Item[]>([]);
  const [notion, setNotion] = useState<{ configured: boolean; connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, items] = await Promise.all([api.statistics(), api.listItems()]);
      setStats(s);
      setRecent(items.slice(0, 5));
      // Notion status is best-effort; don't fail the dashboard if it errors.
      try { setNotion(await api.notionStatus()); } catch { setNotion(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load, reloadSignal]);

  if (error) {
    return (<><PageHeader title="Dashboard" /><Card><ErrorState message="잠시 후 다시 시도해주세요." onRetry={() => void load()} /></Card></>);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="현재 상태를 한눈에 확인하세요."
        actions={<Button variant="primary" onClick={() => onNavigate('chat')}>✦ AI에게 요청</Button>}
      />

      {/* Overview stats */}
      <div className="grid grid--stats" style={{ marginBottom: 'var(--sp-6)' }}>
        {loading || !stats ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="stat"><Skeleton h={30} w={60} /><div style={{ height: 8 }} /><Skeleton h={12} w={80} /></Card>
          ))
        ) : (
          <>
            <StatCard value={stats.totalItems} label="전체 아이템" />
            <StatCard value={stats.itemsWithDescription} label="설명 있음" />
            <StatCard value={stats.itemsWithoutDescription} label="설명 없음" />
            <StatCard value={notion?.connected ? '연결됨' : notion?.configured ? '확인 필요' : '미연결'} label="Notion" />
          </>
        )}
      </div>

      <div className="grid grid--2">
        {/* Recent items */}
        <Card>
          <div className="row between" style={{ marginBottom: 'var(--sp-3)' }}>
            <div className="section-title" style={{ margin: 0 }}>최근 아이템</div>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('items')}>전체 보기</Button>
          </div>
          {loading ? (
            <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={18} />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon="📭" title="아직 아이템이 없습니다."
              desc="첫 아이템을 만들어 시작하세요."
              actions={<>
                <Button variant="primary" onClick={() => onNavigate('items')}>아이템 만들기</Button>
                <Button onClick={() => onNavigate('chat')}>AI에게 요청</Button>
              </>} />
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {recent.map((it) => (
                <li key={it.id} className="listrow" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <div className="grow">
                    <div className="listrow__title">#{it.id} {it.name}</div>
                    <div className="listrow__meta">수정 {new Date(it.updatedAt).toLocaleDateString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Side panel: Notion + Chat shortcut */}
        <div className="stack">
          <Card>
            <div className="section-title">Notion 연결</div>
            {loading ? <Skeleton h={18} w={120} /> : (
              <>
                <StatusIndicator state={notion?.connected ? 'on' : notion?.configured ? 'warn' : 'off'}
                  label={notion?.connected ? 'Connected' : notion?.configured ? '설정됨 (연결 확인 필요)' : 'Not configured'} />
                <div style={{ marginTop: 'var(--sp-3)' }}>
                  <Button size="sm" onClick={() => onNavigate('notion')}>Notion 열기</Button>
                </div>
              </>
            )}
          </Card>
          <Card>
            <div className="section-title">빠른 시작</div>
            <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)' }}>
              자연어로 아이템과 Notion을 관리하세요.
            </p>
            <Button variant="primary" block onClick={() => onNavigate('chat')}>✦ AI Chat 시작</Button>
          </Card>
        </div>
      </div>
    </>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="stat">
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </Card>
  );
}
