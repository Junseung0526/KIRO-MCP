import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, Item } from './api';
import { Button, Card, EmptyState, ErrorState, Field, Input, Modal, PageHeader, Skeleton, Textarea } from './components/ui';
import { useToast } from './components/Toast';
import type { PageKey } from './components/AppShell';

type Sort = 'recent' | 'name';
type Modal_ = null | { kind: 'create' } | { kind: 'edit'; item: Item } | { kind: 'confirm'; item: Item };

export function ItemsPage({ reloadSignal, onNavigate }: { reloadSignal?: number; onNavigate: (p: PageKey) => void }) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal_>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  const load = useCallback(async (q: string) => {
    setLoading(true); setError(null);
    try { setItems(q.trim() ? await api.searchItems(q.trim()) : await api.listItems()); }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(query); /* initial + reloadSignal */ // eslint-disable-next-line
  }, [load, reloadSignal]);

  // Debounced search as the user types.
  function onQueryChange(v: string) {
    setQuery(v);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void load(v), 350);
  }

  const sorted = [...items].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : b.id - a.id);

  async function onDelete(item: Item) {
    try {
      await api.deleteItem(item.id);
      toast.success(`"${item.name}" 삭제됨`);
      setModal(null);
      await load(query);
    } catch { toast.error('삭제에 실패했습니다.'); }
  }

  return (
    <>
      <PageHeader title="Items" subtitle="PostgreSQL에 저장된 실제 아이템"
        actions={<Button variant="primary" onClick={() => setModal({ kind: 'create' })}>+ 새 아이템</Button>} />

      <div className="toolbar">
        <div className="grow">
          <Input placeholder="아이템 검색..." value={query} onChange={(e) => onQueryChange(e.target.value)} aria-label="아이템 검색" />
        </div>
        <label className="row" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>정렬</span>
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬 기준">
            <option value="recent">최신순</option>
            <option value="name">이름순</option>
          </select>
        </label>
      </div>

      <Card pad={false}>
        {loading ? (
          <div style={{ padding: 'var(--sp-4)' }} className="stack">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={40} />)}
          </div>
        ) : error ? (
          <ErrorState message="잠시 후 다시 시도해주세요." onRetry={() => void load(query)} />
        ) : sorted.length === 0 ? (
          <EmptyState icon={query ? '🔍' : '📭'}
            title={query ? '검색 결과가 없습니다.' : '아직 아이템이 없습니다.'}
            desc={query ? '다른 검색어로 다시 시도해보세요.' : 'AI에게 요청하거나 직접 만들 수 있어요.'}
            actions={query
              ? <Button onClick={() => onQueryChange('')}>검색 초기화</Button>
              : <>
                  <Button variant="primary" onClick={() => setModal({ kind: 'create' })}>아이템 만들기</Button>
                  <Button onClick={() => onNavigate('chat')}>AI에게 요청하기</Button>
                </>} />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {sorted.map((it) => (
              <li key={it.id} className="listrow">
                <div className="grow">
                  <div className="listrow__title">#{it.id} {it.name}</div>
                  {it.description && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>{it.description}</div>}
                  <div className="listrow__meta">수정 {new Date(it.updatedAt).toLocaleString()}</div>
                </div>
                <div className="listrow__actions">
                  <Button size="sm" onClick={() => setModal({ kind: 'edit', item: it })}>수정</Button>
                  <Button size="sm" variant="danger" onClick={() => setModal({ kind: 'confirm', item: it })}>삭제</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {modal?.kind === 'create' && (
        <ItemForm title="아이템 생성" onClose={() => setModal(null)}
          onSubmit={async (name, desc) => { await api.createItem(name, desc); toast.success('아이템이 추가되었습니다.'); setModal(null); await load(query); }} />
      )}
      {modal?.kind === 'edit' && (
        <ItemForm title={`아이템 #${modal.item.id} 수정`} initialName={modal.item.name} initialDesc={modal.item.description ?? ''}
          onClose={() => setModal(null)}
          onSubmit={async (name, desc) => { await api.updateItem(modal.item.id, { name, description: desc }); toast.success('변경사항을 저장했습니다.'); setModal(null); await load(query); }} />
      )}
      {modal?.kind === 'confirm' && (
        <Modal title="아이템 삭제" onClose={() => setModal(null)}>
          <p style={{ marginBottom: 'var(--sp-5)' }}>정말 <strong>#{modal.item.id} {modal.item.name}</strong> 을(를) 삭제할까요? 되돌릴 수 없습니다.</p>
          <div className="row between">
            <Button variant="ghost" onClick={() => setModal(null)}>취소</Button>
            <Button variant="danger" onClick={() => void onDelete(modal.item)}>삭제</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ItemForm({ title, initialName = '', initialDesc = '', onClose, onSubmit }: {
  title: string; initialName?: string; initialDesc?: string; onClose: () => void;
  onSubmit: (name: string, desc: string | null) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDesc);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr('이름은 필수입니다.');
    setSaving(true); setErr(null);
    try { await onSubmit(name.trim(), desc.trim() || null); }
    catch { setErr('저장에 실패했습니다.'); toast.error('저장에 실패했습니다.'); setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="이름" htmlFor="it-name">
          <Input id="it-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="설명 (선택)" htmlFor="it-desc">
          <Textarea id="it-desc" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        {err && <div className="badge badge--danger" role="alert" style={{ display: 'block', marginBottom: 'var(--sp-3)' }}>{err}</div>}
        <div className="row between">
          <Button variant="ghost" type="button" onClick={onClose}>취소</Button>
          <Button variant="primary" type="submit" loading={saving}>저장</Button>
        </div>
      </form>
    </Modal>
  );
}
