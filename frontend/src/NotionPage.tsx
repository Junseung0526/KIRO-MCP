import { useCallback, useEffect, useRef, useState } from 'react';
import { api, NotionPage as NPage } from './api';
import { Button, Card, EmptyState, ErrorState, Input, PageHeader, Skeleton, StatusIndicator } from './components/ui';
import type { PageKey } from './components/AppShell';

export function NotionPage({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; databaseId?: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [pages, setPages] = useState<NPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounceRef = useRef<number | undefined>(undefined);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try { setStatus(await api.notionStatus()); }
    catch { setStatus(null); }
    finally { setStatusLoading(false); }
  }, []);

  const loadPages = useCallback(async (q: string) => {
    setPagesLoading(true); setError(null);
    try { setPages(q.trim() ? await api.notionSearchPages(q.trim()) : await api.notionListPages()); }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setPagesLoading(false); }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);
  useEffect(() => { if (status?.connected) void loadPages(''); }, [status?.connected, loadPages]);

  function onQueryChange(v: string) {
    setQuery(v);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void loadPages(v), 350);
  }

  // Not configured / not connected → guidance + CTA.
  if (!statusLoading && !status?.connected) {
    return (
      <>
        <PageHeader title="Notion" subtitle="연결된 Notion 데이터베이스를 관리합니다." />
        <Card>
          <EmptyState icon="❖"
            title={status?.configured ? 'Notion 연결을 확인할 수 없습니다.' : 'Notion이 연결되어 있지 않습니다.'}
            desc="Settings에서 Integration Token과 Database ID를 등록하면 여기에서 페이지를 조회할 수 있어요."
            actions={<Button variant="primary" onClick={() => onNavigate('settings')}>Settings에서 연결</Button>} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Notion"
        subtitle="연결된 데이터베이스의 페이지"
        actions={<>
          <Button onClick={() => void loadPages(query)} loading={pagesLoading}>새로고침</Button>
          <Button variant="ghost" onClick={() => onNavigate('settings')}>설정</Button>
        </>} />

      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="row between row--wrap">
          {statusLoading
            ? <Skeleton h={18} w={140} />
            : <StatusIndicator state="on" label={`Connected · DB ${status?.databaseId ?? ''}`} />}
        </div>
      </Card>

      <div className="toolbar">
        <div className="grow">
          <Input placeholder="Notion 페이지 검색 (연결된 DB 내부)..." value={query}
            onChange={(e) => onQueryChange(e.target.value)} aria-label="Notion 검색" />
        </div>
      </div>

      <Card pad={false}>
        {pagesLoading ? (
          <div style={{ padding: 'var(--sp-4)' }} className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={36} />)}</div>
        ) : error ? (
          <ErrorState message="Notion 데이터를 불러오지 못했습니다." onRetry={() => void loadPages(query)} />
        ) : pages.length === 0 ? (
          <EmptyState icon={query ? '🔍' : '📄'}
            title={query ? '검색 결과가 없습니다.' : '페이지가 없습니다.'}
            desc={query ? '다른 검색어로 시도해보세요.' : 'AI Chat에서 "노션에 추가해줘"로 만들 수 있어요.'}
            actions={query
              ? <Button onClick={() => onQueryChange('')}>검색 초기화</Button>
              : <Button variant="primary" onClick={() => onNavigate('chat')}>AI에게 요청</Button>} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {pages.map((p) => (
              <li key={p.id} className="listrow">
                <div className="grow">
                  <div className="listrow__title">{p.title}</div>
                  <div className="listrow__meta">
                    {p.lastEditedTime ? `수정 ${new Date(p.lastEditedTime).toLocaleString()}` : ''}
                  </div>
                </div>
                {p.url && <a className="btn btn--sm btn--ghost" href={p.url} target="_blank" rel="noreferrer">열기 ↗</a>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
