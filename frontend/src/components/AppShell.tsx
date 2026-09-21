import { ReactNode, useEffect, useState } from 'react';
import { StatusIndicator } from './ui';
import { useTheme } from '../hooks/useTheme';

export type PageKey = 'dashboard' | 'items' | 'chat' | 'documents' | 'notion' | 'logs' | 'settings';

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '◫' },
  { key: 'items', label: 'Items', icon: '☰' },
  { key: 'chat', label: 'AI Chat', icon: '✦' },
  { key: 'documents', label: '수업자료', icon: '📚' },
  { key: 'notion', label: 'Notion', icon: '❖' },
  { key: 'logs', label: 'Logs', icon: '≡' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

export function AppShell({
  page, onNavigate, onLogout, backendUp, children,
}: {
  page: PageKey;
  onNavigate: (p: PageKey) => void;
  onLogout: () => void;
  backendUp: boolean | null;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, cycle } = useTheme();
  const activeLabel = NAV.find((n) => n.key === page)?.label ?? '';

  // Close the mobile drawer whenever the page changes.
  useEffect(() => { setMobileOpen(false); }, [page]);

  const themeIcon = theme === 'dark' ? '🌙' : theme === 'light' ? '☀️' : '🌓';
  const themeLabel = theme === 'system' ? '시스템 테마' : theme === 'light' ? '라이트' : '다크';

  const nav = (
    <>
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark" aria-hidden>K</span>
        KIRO-MCP
      </div>
      <nav className="sidebar__nav" aria-label="주 메뉴">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={`navitem${page === n.key ? ' navitem--active' : ''}`}
            aria-current={page === n.key ? 'page' : undefined}
            onClick={() => onNavigate(n.key)}
          >
            <span className="navitem__icon" aria-hidden>{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
      <div className="sidebar__spacer" />
      <div className="sidebar__footer">
        <div className="sidebar__foot-row">
          <StatusIndicator state={backendUp === null ? 'off' : backendUp ? 'on' : 'warn'}
            label={backendUp === null ? '상태 확인 중' : backendUp ? '서버 연결됨' : '서버 오류'} />
        </div>
        <div className="sidebar__foot-row">
          <span className="sidebar__user">👤 owner</span>
          <button className="btn btn--ghost btn--sm" onClick={cycle} aria-label={`테마 전환 (현재 ${themeLabel})`} title={themeLabel}>
            {themeIcon}
          </button>
        </div>
        <div className="sidebar__foot-row">
          <button className="navitem" onClick={onLogout} style={{ padding: '8px 0' }}>
            <span className="navitem__icon" aria-hidden>⎋</span> 로그아웃
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="shell">
      {/* Desktop sidebar / Mobile drawer */}
      <aside className={`sidebar${mobileOpen ? ' sidebar--open' : ''}`}>{nav}</aside>
      {mobileOpen && <div className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-hidden />}

      <div className="main">
        <div className="topbar">
          <button className="btn btn--ghost btn--icon" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기">☰</button>
          <span className="topbar__title">{activeLabel}</span>
        </div>
        <main className="main__content" id="main">{children}</main>
      </div>
    </div>
  );
}
