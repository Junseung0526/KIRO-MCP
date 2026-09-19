import { useCallback, useEffect, useState } from 'react';
import { api, LogEntry } from './api';
import { styles } from './styles';

const levelColor: Record<string, string> = { info: '#2563eb', warn: '#d97706', error: '#dc2626' };

// Logs page shows recent application logs (secrets already scrubbed server-side).
export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLogs(await api.logs(150)); }
    catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div>
      <h1 style={styles.h1}>Logs</h1>
      <p style={styles.sub}>최근 애플리케이션 로그입니다 (비밀정보는 기록되지 않습니다).</p>
      <button style={{ ...styles.btnGhost, marginBottom: 12 }} onClick={() => void load()}>새로고침</button>

      {loading ? <div style={styles.muted}>불러오는 중…</div>
        : error ? <div style={styles.error}>오류: {error}</div>
        : logs.length === 0 ? <div style={styles.empty}>로그가 없습니다.</div>
        : (
          <div style={{ ...styles.card, padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>시간</th>
                  <th style={{ padding: '8px 10px' }}>레벨</th>
                  <th style={{ padding: '8px 10px' }}>이벤트</th>
                  <th style={{ padding: '8px 10px' }}>메시지</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', color: '#6b7280' }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '7px 10px', color: levelColor[l.level] ?? '#374151', fontWeight: 600 }}>{l.level}</td>
                    <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>{l.event}</td>
                    <td style={{ padding: '7px 10px', color: '#374151' }}>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
