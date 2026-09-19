import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { styles } from './styles';

// Settings: change password + Notion integration. Real, server-verified.
export function SettingsPage() {
  return (
    <div>
      <h1 style={styles.h1}>Settings</h1>
      <p style={styles.sub}>계정 및 연동 설정.</p>
      <NotionSection />
      <div style={{ height: 20 }} />
      <PasswordSection />
    </div>
  );
}

function NotionSection() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; databaseId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatus(await api.notionStatus()); }
    catch (e) { setError(e instanceof Error ? e.message : '상태 조회 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const maskedToken = token ? `secret_${'*'.repeat(Math.max(token.length - 7, 6))}` : '';

  async function onTest() {
    setBusy(true); setMsg(null); setError(null);
    try {
      const r = await api.notionTest(token, databaseId);
      setMsg(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : '연결 테스트 실패');
    } finally { setBusy(false); }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setError(null);
    try {
      await api.notionSave(token, databaseId);
      setMsg('Notion 연동이 저장되었습니다.');
      setToken(''); setDatabaseId('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    } finally { setBusy(false); }
  }

  async function onDisconnect() {
    if (!window.confirm('Notion 연결을 해제할까요? 저장된 자격 증명이 삭제됩니다.')) return;
    setBusy(true); setMsg(null); setError(null);
    try {
      await api.notionDisconnect();
      setMsg('Notion 연결이 해제되었습니다.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '해제 실패');
    } finally { setBusy(false); }
  }

  const connected = status?.connected;
  const configured = status?.configured;

  return (
    <div style={{ ...styles.card, maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <strong>Notion 연동</strong>
        {loading ? (
          <span style={styles.muted}>확인 중…</span>
        ) : connected ? (
          <span style={{ color: '#16a34a' }}>● 연결됨</span>
        ) : configured ? (
          <span style={{ color: '#d97706' }}>● 설정됨(연결 확인 실패)</span>
        ) : (
          <span style={styles.muted}>○ 연결되지 않음</span>
        )}
      </div>

      {configured ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14 }}>Database: <code>{status?.databaseId}</code></div>
          <div style={styles.muted}>Integration Token: secret_**************** (저장됨, 표시 안 함)</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button style={styles.btnGhost} onClick={() => void refresh()} disabled={busy}>연결 테스트</button>
            <button style={styles.btnDanger} onClick={() => void onDisconnect()} disabled={busy}>연결 해제</button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={styles.label}>Integration Token
            <input style={styles.input} type="password" value={token} placeholder="secret_..."
              onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </label>
          {token && <div style={{ ...styles.muted, marginTop: -6, marginBottom: 6, fontSize: 12 }}>{maskedToken}</div>}
          <label style={styles.label}>Database ID
            <input style={styles.input} value={databaseId} placeholder="32자리 Database ID"
              onChange={(e) => setDatabaseId(e.target.value)} autoComplete="off" />
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" style={styles.btn} onClick={() => void onTest()} disabled={busy || !token || !databaseId}>연결 테스트</button>
            <button type="submit" style={styles.btnPrimary} disabled={busy || !token || !databaseId}>저장</button>
          </div>
        </form>
      )}

      {error && <div style={{ ...styles.error, marginTop: 10 }}>{error}</div>}
      {msg && <div style={{ color: '#16a34a', fontSize: 14, marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null); setError(null);
    if (next.length < 8) return setError('새 비밀번호는 8자 이상이어야 합니다.');
    if (next !== confirm) return setError('새 비밀번호가 일치하지 않습니다.');
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setMsg('비밀번호가 변경되었습니다.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '변경 실패');
    } finally { setSaving(false); }
  }

  return (
    <form style={{ ...styles.card, maxWidth: 480 }} onSubmit={submit}>
      <strong>비밀번호 변경</strong>
      <div style={{ marginTop: 12 }}>
        <label style={styles.label}>현재 비밀번호
          <input style={styles.input} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label style={styles.label}>새 비밀번호 (8자 이상)
          <input style={styles.input} type="password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label style={styles.label}>새 비밀번호 확인
          <input style={styles.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        {msg && <div style={{ color: '#16a34a', fontSize: 14, margin: '6px 0' }}>{msg}</div>}
        <button style={styles.btnPrimary} type="submit" disabled={saving}>{saving ? '변경 중…' : '비밀번호 변경'}</button>
      </div>
    </form>
  );
}
