import { useCallback, useEffect, useState } from 'react';
import { api, UnauthorizedError } from './api';
import { LoginScreen, SetupScreen } from './Auth';
import { AppShell, PageKey } from './components/AppShell';
import { DashboardPage } from './DashboardPage';
import { ItemsPage } from './ItemsPage';
import { ChatPage } from './ChatPage';
import { NotionPage } from './NotionPage';
import { LogsPage } from './LogsPage';
import { SettingsPage } from './SettingsPage';
import { Spinner } from './components/ui';

type Auth = { loading: boolean; initialized: boolean; authenticated: boolean; error: boolean };

export function App() {
  const [auth, setAuth] = useState<Auth>({ loading: true, initialized: false, authenticated: false, error: false });
  const [page, setPage] = useState<PageKey>('dashboard');
  const [reloadSignal, setReloadSignal] = useState(0);
  const [backendUp, setBackendUp] = useState<boolean | null>(null);

  const refreshStatus = useCallback(async () => {
    setAuth((a) => ({ ...a, loading: true, error: false }));
    try {
      const s = await api.authStatus();
      setAuth({ loading: false, initialized: s.initialized, authenticated: s.authenticated, error: false });
    } catch {
      setAuth({ loading: false, initialized: false, authenticated: false, error: true });
    }
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  // Poll backend health for the sidebar status (only when logged in).
  useEffect(() => {
    if (!auth.authenticated) return;
    let alive = true;
    const check = () => api.health().then(() => alive && setBackendUp(true)).catch(() => alive && setBackendUp(false));
    void check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [auth.authenticated]);

  // Any unhandled 401 → back to login.
  useEffect(() => {
    const handler = (ev: PromiseRejectionEvent) => {
      if (ev.reason instanceof UnauthorizedError) setAuth((a) => ({ ...a, authenticated: false }));
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);

  async function logout() {
    try { await api.logout(); } catch { /* ignore */ }
    setAuth((a) => ({ ...a, authenticated: false }));
    setPage('dashboard');
  }

  if (auth.loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spinner /></div>;
  }
  if (auth.error) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
        <div className="card card--pad" style={{ textAlign: 'center', maxWidth: 340 }}>
          <p style={{ marginBottom: 12 }}>서버에 연결하지 못했습니다.</p>
          <button className="btn" onClick={() => void refreshStatus()}>다시 시도</button>
        </div>
      </div>
    );
  }
  if (!auth.initialized) return <SetupScreen onDone={refreshStatus} />;
  if (!auth.authenticated) return <LoginScreen onDone={refreshStatus} />;

  const bump = () => setReloadSignal((n) => n + 1);

  return (
    <AppShell page={page} onNavigate={setPage} onLogout={() => void logout()} backendUp={backendUp}>
      {page === 'dashboard' && <DashboardPage reloadSignal={reloadSignal} onNavigate={setPage} />}
      {page === 'items' && <ItemsPage reloadSignal={reloadSignal} onNavigate={setPage} />}
      {page === 'chat' && <ChatPage onDbMaybeChanged={bump} onNavigate={setPage} />}
      {page === 'notion' && <NotionPage onNavigate={setPage} />}
      {page === 'logs' && <LogsPage />}
      {page === 'settings' && <SettingsPage onLogout={() => void logout()} />}
    </AppShell>
  );
}
