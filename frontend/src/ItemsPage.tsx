import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, Item } from './api';
import { styles } from './styles';

type Mode =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; item: Item }
  | { kind: 'detail'; id: number };

// `reloadSignal` lets a parent (e.g. Chat) force a refresh after DB changes.
export function ItemsPage({ reloadSignal }: { reloadSignal?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'none' });

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      setItems(q && q.trim() ? await api.searchItems(q.trim()) : await api.listItems());
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(query); /* eslint-disable-next-line */ }, [load, reloadSignal]);

  async function onDelete(id: number) {
    if (!window.confirm(`#${id} 아이템을 삭제할까요?`)) return;
    try {
      await api.deleteItem(id);
      await load(query);
      setMode({ kind: 'none' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제 실패');
    }
  }

  return (
    <div>
      <h1 style={styles.h1}>Items</h1>
      <p style={styles.sub}>PostgreSQL에 저장된 실제 아이템입니다.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <form onSubmit={(e) => { e.preventDefault(); void load(query); }} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input style={styles.input} placeholder="이름/설명으로 검색…" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button style={styles.btn} type="submit">검색</button>
          {query && <button type="button" style={styles.btnGhost} onClick={() => { setQuery(''); void load(''); }}>초기화</button>}
        </form>
        <button style={styles.btnPrimary} onClick={() => setMode({ kind: 'create' })}>+ 새 아이템</button>
      </div>

      {error && <div style={styles.error}>오류: {error}</div>}

      {loading ? (
        <div style={styles.muted}>불러오는 중…</div>
      ) : items.length === 0 ? (
        <div style={styles.empty}>{query ? `"${query}" 검색 결과가 없습니다.` : '아이템이 없습니다. 새로 만들어보세요.'}</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item) => (
            <li key={item.id} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ cursor: 'pointer' }} onClick={() => setMode({ kind: 'detail', id: item.id })}>
                <strong>#{item.id} {item.name}</strong>
                {item.description && <div style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{item.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={styles.btnGhost} onClick={() => setMode({ kind: 'edit', item })}>수정</button>
                <button style={styles.btnDanger} onClick={() => void onDelete(item.id)}>삭제</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mode.kind === 'create' && (
        <ItemForm title="아이템 생성" onClose={() => setMode({ kind: 'none' })}
          onSubmit={async (name, description) => { await api.createItem(name, description); await load(query); setMode({ kind: 'none' }); }} />
      )}
      {mode.kind === 'edit' && (
        <ItemForm title={`아이템 #${mode.item.id} 수정`} initialName={mode.item.name} initialDescription={mode.item.description ?? ''}
          onClose={() => setMode({ kind: 'none' })}
          onSubmit={async (name, description) => { await api.updateItem(mode.item.id, { name, description }); await load(query); setMode({ kind: 'none' }); }} />
      )}
      {mode.kind === 'detail' && (
        <ItemDetail id={mode.id} onClose={() => setMode({ kind: 'none' })}
          onEdit={(item) => setMode({ kind: 'edit', item })} onDelete={onDelete} />
      )}
    </div>
  );
}

function ItemForm(props: {
  title: string; initialName?: string; initialDescription?: string;
  onClose: () => void; onSubmit: (name: string, description: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(props.initialName ?? '');
  const [description, setDescription] = useState(props.initialDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('이름은 필수입니다.');
    setSaving(true); setError(null);
    try {
      await props.onSubmit(name.trim(), description.trim() ? description.trim() : null);
    } catch (err) { setError(err instanceof Error ? err.message : '저장 실패'); setSaving(false); }
  }

  return (
    <Modal title={props.title} onClose={props.onClose}>
      <form onSubmit={submit}>
        <label style={styles.label}>이름<input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label style={styles.label}>설명<textarea style={{ ...styles.input, minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        {error && <div style={styles.error}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={styles.btnGhost} onClick={props.onClose}>취소</button>
          <button type="submit" style={styles.btnPrimary} disabled={saving}>{saving ? '저장 중…' : '저장'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ItemDetail(props: { id: number; onClose: () => void; onEdit: (i: Item) => void; onDelete: (id: number) => void }) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true; setLoading(true);
    api.getItem(props.id)
      .then((i) => alive && setItem(i))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [props.id]);

  return (
    <Modal title={`아이템 #${props.id}`} onClose={props.onClose}>
      {loading ? <div style={styles.muted}>불러오는 중…</div>
        : error ? <div style={styles.error}>{error}</div>
        : item ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong>이름:</strong> {item.name}</div>
            <div><strong>설명:</strong> {item.description ?? <em style={styles.muted}>없음</em>}</div>
            <div style={styles.muted}>생성: {new Date(item.createdAt).toLocaleString()}</div>
            <div style={styles.muted}>수정: {new Date(item.updatedAt).toLocaleString()}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button style={styles.btnGhost} onClick={() => props.onEdit(item)}>수정</button>
              <button style={styles.btnDanger} onClick={() => props.onDelete(item.id)}>삭제</button>
            </div>
          </div>
        ) : null}
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button style={styles.btnGhost} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
