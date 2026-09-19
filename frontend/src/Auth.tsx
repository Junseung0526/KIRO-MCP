import { FormEvent, useState } from 'react';
import { api } from './api';
import { styles } from './styles';

// Shown when app is NOT initialized: create the initial password.
export function SetupScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('비밀번호는 8자 이상이어야 합니다.');
    if (password !== confirm) return setError('비밀번호가 일치하지 않습니다.');
    setLoading(true);
    try {
      await api.setupPassword(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 실패');
      setLoading(false);
    }
  }

  return (
    <div style={styles.authWrap}>
      <form style={styles.authCard} onSubmit={submit}>
        <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>KIRO-MCP 초기 설정</h1>
        <p style={styles.sub}>처음 접속입니다. 사용할 비밀번호를 설정하세요.</p>
        <label style={styles.label}>비밀번호 (8자 이상)
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        <label style={styles.label}>비밀번호 확인
          <input style={styles.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        <button style={{ ...styles.btnPrimary, width: '100%', marginTop: 6 }} type="submit" disabled={loading}>
          {loading ? '설정 중…' : '비밀번호 설정하고 시작'}
        </button>
      </form>
    </div>
  );
}

// Shown when app IS initialized but user is not logged in.
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
      setLoading(false);
    }
  }

  return (
    <div style={styles.authWrap}>
      <form style={styles.authCard} onSubmit={submit}>
        <h1 style={{ margin: '0 0 6px', fontSize: 20 }}>KIRO-MCP 로그인</h1>
        <p style={styles.sub}>비밀번호를 입력하세요.</p>
        <label style={styles.label}>비밀번호
          <input style={styles.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && <div style={styles.error}>{error}</div>}
        <button style={{ ...styles.btnPrimary, width: '100%', marginTop: 6 }} type="submit" disabled={loading}>
          {loading ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
