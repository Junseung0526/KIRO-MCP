import { useCallback, useEffect, useState } from 'react';
import { api, LogEntry } from './api';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from './components/ui';

type Level = 'all' | 'info' | 'warn' | 'error';
const toneFor = (l: string) => (l === 'error' ? 'danger' : l === 'warn' ? 'warning' : 'primary');

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Level>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLogs(await api.logs(150)); }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.level === filter);

  return (
    <>
      <PageHeader title="Logs" subtitle="애플리케이션 활동 로그 (비밀정보는 기록되지 않습니다)"
        actions={<Button onClick={() => void load()} loading={loading}>새로고침</Button>} />

      <div className="toolbar">
        {(['all', 'info', 'warn', 'error'] as Level[]).map((lv) => (
          <button key={lv} className="chip" onClick={() => setFilter(lv)}
            style={filter === lv ? { borderColor: 'var(--c-primary)', color: 'var(--c-primary)', background: 'var(--c-primary-weak)' } : undefined}
            aria-pressed={filter === lv}>
            {lv === 'all' ? '전체' : lv}
          </button>
        ))}
      </div>

      <Card pad={false}>
        {loading ? (
          <div style={{ padding: 'var(--sp-4)' }} className="stack">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={22} />)}</div>
        ) : error ? (
          <ErrorState message="로그를 불러오지 못했습니다." onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🗒️" title="표시할 로그가 없습니다." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th style={{ width: 170 }}>시간</th><th style={{ width: 80 }}>레벨</th><th>이벤트</th><th>메시지</th></tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td><Badge tone={toneFor(l.level) as 'danger' | 'warning' | 'primary'}>{l.level}</Badge></td>
                    <td><code>{l.event}</code></td>
                    <td>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
