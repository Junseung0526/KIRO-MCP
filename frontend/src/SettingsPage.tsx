import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { Button, Card, Field, Input, PageHeader, Skeleton, StatusIndicator } from './components/ui';
import { useToast } from './components/Toast';

export function SettingsPage({ onLogout }: { onLogout: () => void }) {
  return (
    <>
      <PageHeader title="Settings" subtitle="계정 · 연동 · 시스템 상태" />
      <div className="stack" style={{ gap: 'var(--sp-4)' }}>
        <AccountSection onLogout={onLogout} />
        <NotionSection />
        <SystemSection />
      </div>
    </>
  );
}

function SectionCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="section-title" style={{ marginBottom: desc ? 4 : 'var(--sp-3)' }}>{title}</div>
      {desc && <p className="muted" style={{ fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>{desc}</p>}
      {children}
    </Card>
  );
}

function AccountSection({ onLogout }: { onLogout: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error('새 비밀번호는 8자 이상이어야 합니다.');
    if (next !== confirm) return toast.error('새 비밀번호가 일치하지 않습니다.');
    setSaving(true);
    try {
      await api.changePassword(current, next);
      toast.success('비밀번호가 변경되었습니다.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch { toast.error('현재 비밀번호를 확인해주세요.'); }
    finally { setSaving(false); }
  }

  return (
    <SectionCard title="Account" desc="로그인 계정 및 비밀번호를 관리합니다.">
      <form onSubmit={submit} style={{ maxWidth: 420 }}>
        <Field label="현재 비밀번호"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="새 비밀번호 (8자 이상)"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
        <Field label="새 비밀번호 확인"><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
        <div className="row between">
          <Button variant="ghost" type="button" onClick={onLogout}>로그아웃</Button>
          <Button variant="primary" type="submit" loading={saving}>비밀번호 변경</Button>
        </div>
      </form>
    </SectionCard>
  );
}

function NotionSection() {
  const toast = useToast();
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; databaseId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setStatus(await api.notionStatus()); } catch { setStatus(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  async function onTest() {
    setBusy(true);
    try { const r = await api.notionTest(token, databaseId); toast.success(r.message); }
    catch (e) { toast.error(e instanceof Error ? e.message : '연결 테스트 실패'); }
    finally { setBusy(false); }
  }
  async function onSave(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api.notionSave(token, databaseId); toast.success('Notion 연결에 성공했습니다.'); setToken(''); setDatabaseId(''); await refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : '저장 실패'); }
    finally { setBusy(false); }
  }
  async function onDisconnect() {
    if (!window.confirm('Notion 연결을 해제할까요? 저장된 자격 증명이 삭제됩니다.')) return;
    setBusy(true);
    try { await api.notionDisconnect(); toast.info('Notion 연결이 해제되었습니다.'); await refresh(); }
    catch { toast.error('해제에 실패했습니다.'); }
    finally { setBusy(false); }
  }

  return (
    <SectionCard title="Notion" desc="Integration Token은 서버에 안전하게 암호화되어 저장되며, 다시 표시되지 않습니다.">
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        {loading ? <Skeleton h={18} w={160} /> : (
          <StatusIndicator
            state={status?.connected ? 'on' : status?.configured ? 'warn' : 'off'}
            label={status?.connected ? 'Connected' : status?.configured ? '설정됨 (연결 확인 필요)' : 'Not configured'} />
        )}
      </div>

      {status?.configured ? (
        <div className="stack" style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 'var(--fs-sm)' }}>Database: <code>{status.databaseId}</code></div>
          <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Integration Token: secret_•••••••••••••• (저장됨)</div>
          <div className="row">
            <Button onClick={() => void refresh()} loading={busy}>연결 테스트</Button>
            <Button variant="danger" onClick={() => void onDisconnect()} disabled={busy}>연결 해제</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSave} style={{ maxWidth: 420 }}>
          <Field label="Integration Token" hint="notion.so/my-integrations 에서 발급">
            <Input type="password" value={token} placeholder="secret_..." onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Database ID">
            <Input value={databaseId} placeholder="32자리 Database ID" onChange={(e) => setDatabaseId(e.target.value)} autoComplete="off" />
          </Field>
          <div className="row">
            <Button type="button" onClick={() => void onTest()} loading={busy} disabled={!token || !databaseId}>연결 테스트</Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!token || !databaseId}>저장</Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

function SystemSection() {
  const [health, setHealth] = useState<{ status: string; database: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(false);
    try { setHealth(await api.health()); } catch { setErr(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const backendOk = !err && !!health;
  const dbOk = health?.database === 'up';

  return (
    <SectionCard title="System" desc="서비스 구성 요소의 현재 상태입니다.">
      {loading ? <Skeleton h={18} w={200} /> : (
        <div className="stack">
          <StatusIndicator state={backendOk ? 'on' : 'warn'} label={`Backend · ${backendOk ? 'Healthy' : 'Unreachable'}`} />
          <StatusIndicator state={dbOk ? 'on' : 'warn'} label={`Database · ${dbOk ? 'Up' : 'Down'}`} />
          <StatusIndicator state="on" label="MCP · 12 tools (7 items + 5 notion)" />
          <div><Button size="sm" variant="ghost" onClick={() => void load()}>새로고침</Button></div>
        </div>
      )}
    </SectionCard>
  );
}
