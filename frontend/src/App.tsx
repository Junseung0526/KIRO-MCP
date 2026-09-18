import { useEffect, useState, FormEvent } from 'react';
import { listItems, createItem, deleteItem, apiBase, Item } from './api';

export function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setError(null);
    try {
      setItems(await listItems());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createItem(name.trim(), description.trim());
      setName('');
      setDescription('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: number) {
    setError(null);
    try {
      await deleteItem(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>KIRO-MCP Items</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        API: <code>{apiBase}</code>
      </p>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 8 }}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 2, padding: 8 }}
        />
        <button type="submit" disabled={loading} style={{ padding: '8px 16px' }}>
          {loading ? 'Adding…' : 'Add'}
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      <button onClick={() => void refresh()} style={{ marginBottom: 12 }}>
        Refresh
      </button>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>#{item.id} {item.name}</strong>
              {item.description && <div style={{ color: '#555' }}>{item.description}</div>}
            </div>
            <button onClick={() => void onDelete(item.id)} style={{ color: 'crimson' }}>
              Delete
            </button>
          </li>
        ))}
        {items.length === 0 && <li style={{ color: '#999' }}>No items yet.</li>}
      </ul>
    </div>
  );
}
