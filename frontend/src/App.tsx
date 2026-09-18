import { useCallback, useEffect, useState, FormEvent } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api, Item, Statistics } from './api';

type Mode = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; item: Item } | { kind: 'detail'; id: number };

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [stats, setStats] = useState<Statistics | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const [list, statistics] = await Promise.all([
        q && q.trim() ? api.searchItems(q.trim()) : api.listItems(),
        api.statistics(),
      ]);
      setItems(list);
      setStats(statistics);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void load(query);
  }

  async function onDelete(id: number) {
    if (!window.confirm(`Delete item #${id}?`)) return;
    setError(null);
    try {
      await api.deleteItem(id);
      await load(query);
      setMode({ kind: 'list' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={{ margin: 0 }}>KIRO-MCP Items</h1>
        <span style={styles.api}>API: <code>{api.base}</code></span>
      </header>

      {stats && (
        <div style={styles.stats}>
          <Stat label="Total" value={stats.totalItems} />
          <Stat label="With description" value={stats.itemsWithDescription} />
          <Stat label="Without description" value={stats.itemsWithoutDescription} />
          <Stat label="Latest" value={stats.latestItem ? `#${stats.latestItem.id}` : '—'} />
        </div>
      )}

      <div style={styles.toolbar}>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input
            style={styles.input}
            placeholder="Search by name or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button style={styles.btn} type="submit">Search</button>
          {query && (
            <button
              type="button"
              style={styles.btnGhost}
              onClick={() => { setQuery(''); void load(''); }}
            >
              Clear
            </button>
          )}
        </form>
        <button style={styles.btnPrimary} onClick={() => setMode({ kind: 'create' })}>
          + New item
        </button>
      </div>

      {error && <div style={styles.error} role="alert">Error: {error}</div>}

      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={styles.empty}>
          {query ? `No items match "${query}".` : 'No items yet. Create your first item.'}
        </div>
      ) : (
        <ul style={styles.list}>
          {items.map((item) => (
            <li key={item.id} style={styles.card}>
              <div style={{ cursor: 'pointer' }} onClick={() => setMode({ kind: 'detail', id: item.id })}>
                <strong>#{item.id} {item.name}</strong>
                {item.description && <div style={styles.desc}>{item.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={styles.btnGhost} onClick={() => setMode({ kind: 'detail', id: item.id })}>View</button>
                <button style={styles.btnGhost} onClick={() => setMode({ kind: 'edit', item })}>Edit</button>
                <button style={styles.btnDanger} onClick={() => void onDelete(item.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mode.kind === 'create' && (
        <ItemForm
          title="Create item"
          onClose={() => setMode({ kind: 'list' })}
          onSubmit={async (name, description) => {
            await api.createItem(name, description);
            await load(query);
            setMode({ kind: 'list' });
          }}
        />
      )}

      {mode.kind === 'edit' && (
        <ItemForm
          title={`Edit item #${mode.item.id}`}
          initialName={mode.item.name}
          initialDescription={mode.item.description ?? ''}
          onClose={() => setMode({ kind: 'list' })}
          onSubmit={async (name, description) => {
            await api.updateItem(mode.item.id, { name, description });
            await load(query);
            setMode({ kind: 'list' });
          }}
        />
      )}

      {mode.kind === 'detail' && (
        <ItemDetail
          id={mode.id}
          onClose={() => setMode({ kind: 'list' })}
          onEdit={(item) => setMode({ kind: 'edit', item })}
          onDelete={onDelete}
        />
      )}
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

function ItemForm(props: {
  title: string;
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(props.initialName ?? '');
  const [description, setDescription] = useState(props.initialDescription ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit(name.trim(), description.trim() ? description.trim() : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <Modal title={props.title} onClose={props.onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={styles.label}>Name
          <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label style={styles.label}>Description
          <textarea style={{ ...styles.input, minHeight: 80 }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={styles.btnGhost} onClick={props.onClose}>Cancel</button>
          <button type="submit" style={styles.btnPrimary} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ItemDetail(props: {
  id: number;
  onClose: () => void;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => void;
}) {
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getItem(props.id)
      .then((i) => { if (alive) setItem(i); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Failed to load'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [props.id]);

  return (
    <Modal title={`Item #${props.id}`} onClose={props.onClose}>
      {loading ? (
        <div style={styles.muted}>Loading…</div>
      ) : error ? (
        <div style={styles.error}>Error: {error}</div>
      ) : item ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div><strong>Name:</strong> {item.name}</div>
          <div><strong>Description:</strong> {item.description ?? <em style={styles.muted}>none</em>}</div>
          <div style={styles.muted}>Created: {new Date(item.createdAt).toLocaleString()}</div>
          <div style={styles.muted}>Updated: {new Date(item.updatedAt).toLocaleString()}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button style={styles.btnGhost} onClick={() => props.onEdit(item)}>Edit</button>
            <button style={styles.btnDanger} onClick={() => props.onDelete(item.id)}>Delete</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button style={styles.btnGhost} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { maxWidth: 760, margin: '2rem auto', padding: '0 1rem', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' },
  header: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  api: { color: '#888', fontSize: 13 },
  stats: { display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' },
  statBox: { flex: 1, minWidth: 120, border: '1px solid #e5e5e5', borderRadius: 10, padding: '10px 14px', textAlign: 'center' },
  statValue: { fontSize: 22, fontWeight: 700 },
  statLabel: { fontSize: 12, color: '#888' },
  toolbar: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  input: { padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  card: { border: '1px solid #e5e5e5', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  desc: { color: '#666', fontSize: 14, marginTop: 4 },
  muted: { color: '#999' },
  empty: { padding: 32, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 10 },
  error: { background: '#fdecea', color: '#b71c1c', padding: '8px 12px', borderRadius: 8, fontSize: 14 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer' },
  btnGhost: { padding: '6px 12px', borderRadius: 8, border: '1px solid #ddd', background: '#fff', cursor: 'pointer', fontSize: 13 },
  btnDanger: { padding: '6px 12px', borderRadius: 8, border: '1px solid #f0c2c2', background: '#fff', color: '#c62828', cursor: 'pointer', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 460, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
};
