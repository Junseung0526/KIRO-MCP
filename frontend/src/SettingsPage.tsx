import { FormEvent, useState } from 'react';
import { api } from './api';
import { styles } from './styles';

// Settings: change password (real, server-verified). Extendable later.
export function SettingsPage() {
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
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 style={styles.h1}>Settings</h1>
      <p style={styles.sub}>계정 설정.</p>

      <form style={{ ...styles.card, maxWidth: 420 }} onSubmit={submit}>
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
    </div>
  );
}
