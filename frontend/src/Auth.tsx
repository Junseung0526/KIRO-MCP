import { FormEvent, useState } from 'react';
import { api } from './api';
import { Button, Field, Input } from './components/ui';

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)' }}>
      <div className="card card--pad" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-5)' }}>
          <span className="sidebar__brand-mark" aria-hidden>K</span>
          <strong style={{ fontSize: 'var(--fs-md)' }}>KIRO-MCP</strong>
        </div>
        {children}
      </div>
    </div>
  );
}

// First run: create the initial password.
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
    try { await api.setupPassword(password); onDone(); }
    catch { setError('설정에 실패했습니다. 다시 시도해주세요.'); setLoading(false); }
  }

  return (
    <AuthShell>
      <h1 style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>처음 오셨네요 👋</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-5)' }}>
        서비스를 보호할 비밀번호를 설정해주세요.
      </p>
      <form onSubmit={submit}>
        <Field label="비밀번호 (8자 이상)" htmlFor="pw">
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="new-password" />
        </Field>
        <Field label="비밀번호 확인" htmlFor="pw2">
          <Input id="pw2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && <div className="badge badge--danger" role="alert" style={{ marginBottom: 'var(--sp-3)', display: 'block' }}>{error}</div>}
        <Button variant="primary" block type="submit" loading={loading}>비밀번호 설정하고 시작</Button>
      </form>
    </AuthShell>
  );
}

// Returning user: login.
export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try { await api.login(password); onDone(); }
    catch { setError('비밀번호가 올바르지 않습니다.'); setLoading(false); }
  }

  return (
    <AuthShell>
      <h1 style={{ fontSize: 'var(--fs-lg)', marginBottom: 4 }}>로그인</h1>
      <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-5)' }}>
        비밀번호를 입력해 계속하세요.
      </p>
      <form onSubmit={submit}>
        <Field label="비밀번호" htmlFor="pw">
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </Field>
        {error && <div className="badge badge--danger" role="alert" style={{ marginBottom: 'var(--sp-3)', display: 'block' }}>{error}</div>}
        <Button variant="primary" block type="submit" loading={loading}>로그인</Button>
      </form>
    </AuthShell>
  );
}
