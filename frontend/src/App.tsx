import { useCallback, useEffect, useState } from 'react';
import { api, UnauthorizedError } from './api';
import { styles } from './styles';
import { LoginScreen, SetupScreen } from './Auth';
import { DashboardPage } from './DashboardPage';
import { ItemsPage } from './ItemsPage';
import { ChatPage } from './ChatPage';
import { LogsPage } from './LogsPage';
import { SettingsPage } from './SettingsPage';

type Auth = { loading: boolean; initialized: boolean; authenticated: boolean; error: string | null };
type Page = 'dashboard' | 'items' | 'chat' | 'logs' | 'settings';

const NAV: { key: Page; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'items', label: 'Items' },
  { key: 'chat', label: 'AI Chat' },
  { key: 'logs', label: 'Logs' },
  { key: 'settings', label: 'Settings' },
];

export function App() {
  const [auth, setAuth] = useState<Auth>({ loading: true, initialized: false, authenticated: false, error: null });
  const [page, setPage] = useState<Page>('dashboard');
  // Bumped whenever the DB may have changed (e.g. via Chat) so pages reload.
  const [reloadSignal, setReloadSignal] = useState(0);

  const refreshStatus = useCallback(async () => {
    setAuth((a) => ({ ...a, loading: true, error: null }));
    try {
      const s = await api.authStatus();
      setAuth({ loading: false, initialized: s.initialized, authenticated: s.authenticated, error: null });
    } catch (e) {
      setAuth({ loading: false, initialized: false, authenticated: false, error: e instanceof Error ? e.message : '상태 확인 실패' });
    }
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  async function logout() {
    try { await api.logout(); } catch { /* ignore */ }
    setAuth((a) => ({ ...a, authenticated: false }));
    setPage('dashboard');
  }

  // If any page hits 401, force back to login.
  const handleUnauthorized = useCallback((err: unknown) => {
    if (err instanceof UnauthorizedError) setAuth((a) => ({ ...a, authenticated: false }));
  }, []);
  useEffect(() => {
    const orig = window.onunhandledrejection;
    window.onunhandledrejection = (ev) => { handleUnauthorized(ev.reason); };
    return () => { window.onunhandledrejection = orig; };
  }, [handleUnauthorized]);

  if (auth.loading) {
    return <div style={styles.authWrap}><div style={styles.muted}>불러오는 중…</div></div>;
  }
  if (auth.error) {
    return <div style={styles.authWrap}><div style={styles.authCard}><div style={styles.error}>{auth.error}</div>
      <button style={styles.btn} onClick={() => void refreshStatus()}>다시 시도</button></div></div>;
  }
  if (!auth.initialized) return <SetupScreen onDone={refreshStatus} />;
  if (!auth.authenticated) return <LoginScreen onDone={refreshStatus} />;

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>KIRO-MCP</div>
        {NAV.map((n) => (
          <div key={n.key} style={page === n.key ? styles.navItemActive : styles.navItem} onClick={() => setPage(n.key)}>
            {n.label}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <div style={styles.navItem} onClick={() => void logout()}>Logout</div>
      </aside>
      <main style={styles.main}>
        {page === 'dashboard' && <DashboardPage reloadSignal={reloadSignal} />}
        {page === 'items' && <ItemsPage reloadSignal={reloadSignal} />}
        {page === 'chat' && <ChatPage onDbMaybeChanged={() => setReloadSignal((n) => n + 1)} />}
        {page === 'logs' && <LogsPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}
