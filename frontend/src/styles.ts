import type { CSSProperties } from 'react';

export const styles: Record<string, CSSProperties> = {
  // Auth screens
  authWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f5f7', fontFamily: 'system-ui, sans-serif' },
  authCard: { background: '#fff', padding: 32, borderRadius: 14, width: '100%', maxWidth: 380, boxShadow: '0 10px 40px rgba(0,0,0,0.08)' },

  // App shell
  shell: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' },
  sidebar: { width: 220, background: '#111827', color: '#e5e7eb', display: 'flex', flexDirection: 'column', padding: '16px 0' },
  brand: { fontSize: 18, fontWeight: 700, padding: '8px 20px 20px', color: '#fff' },
  navItem: { padding: '10px 20px', cursor: 'pointer', fontSize: 14, borderLeft: '3px solid transparent', color: '#cbd5e1' },
  navItemActive: { padding: '10px 20px', cursor: 'pointer', fontSize: 14, borderLeft: '3px solid #3b82f6', background: '#1f2937', color: '#fff' },
  main: { flex: 1, padding: '24px 32px', background: '#f9fafb', overflow: 'auto' },
  h1: { margin: '0 0 4px', fontSize: 22 },
  sub: { color: '#6b7280', fontSize: 13, marginBottom: 20 },

  // Common
  input: { padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' },
  label: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, color: '#374151', marginBottom: 12 },
  btnPrimary: { padding: '9px 16px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 },
  btnGhost: { padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 },
  btnDanger: { padding: '6px 12px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13 },
  error: { background: '#fdecea', color: '#b71c1c', padding: '9px 12px', borderRadius: 8, fontSize: 14, margin: '8px 0' },
  muted: { color: '#9ca3af' },
  empty: { padding: 32, textAlign: 'center', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: 10, background: '#fff' },
  card: { border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, background: '#fff' },

  // Stat cards
  statGrid: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 },
  statBox: { flex: 1, minWidth: 140, border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', background: '#fff' },
  statValue: { fontSize: 28, fontWeight: 700 },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  // Chat
  chatWrap: { display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' },
  chatLog: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  bubbleUser: { alignSelf: 'flex-end', background: '#2563eb', color: '#fff', padding: '9px 13px', borderRadius: '12px 12px 2px 12px', maxWidth: '75%', whiteSpace: 'pre-wrap', fontSize: 14 },
  bubbleAI: { alignSelf: 'flex-start', background: '#f3f4f6', color: '#111827', padding: '9px 13px', borderRadius: '12px 12px 12px 2px', maxWidth: '80%', whiteSpace: 'pre-wrap', fontSize: 14 },
  chatInputRow: { display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #e5e7eb', background: '#fafafa' },
};
