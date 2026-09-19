import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Button, EmptyState, StatusIndicator } from './components/ui';
import { useToast } from './components/Toast';
import type { PageKey } from './components/AppShell';

interface Msg { role: 'user' | 'ai'; text: string }

const QUICK = [
  '아이템 목록 보여줘',
  '현재 통계 알려줘',
  '노션 목록 보여줘',
  '노션에서 할 일 찾아줘',
];

export function ChatPage({ onDbMaybeChanged, onNavigate }: { onDbMaybeChanged?: () => void; onNavigate: (p: PageKey) => void }) {
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => { api.chatStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false)); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, step, sending]);

  // Auto-grow textarea.
  function autoGrow() {
    const ta = taRef.current; if (!ta) return;
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setMessages((m) => [...m, { role: 'user', text: msg }]);
    setInput(''); setSending(true); setStep('요청을 분석하는 중...');
    if (taRef.current) taRef.current.style.height = 'auto';
    try {
      const { promise, cancel } = api.chatStream(msg, (state) => {
        setStep(state === 'accepted' ? '요청을 분석하는 중...' : '작업을 실행하는 중...');
      });
      cancelRef.current = cancel;
      const res = await promise;
      setMessages((m) => [...m, { role: 'ai', text: res.reply || '(응답이 비어 있습니다)' }]);
      onDbMaybeChanged?.();
    } catch (e) {
      const emsg = e instanceof Error ? e.message : '전송 실패';
      toast.error(emsg);
      setMessages((m) => [...m, { role: 'ai', text: `요청을 처리하지 못했습니다. ${emsg}` }]);
    } finally { setSending(false); setStep(null); cancelRef.current = null; }
  }

  function cancel() {
    cancelRef.current?.();
    setSending(false); setStep(null);
    setMessages((m) => [...m, { role: 'ai', text: '요청을 취소했습니다.' }]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  }

  return (
    <>
      <div className="chat">
        <div className="chat__head">
          <div>
            <strong>AI Assistant</strong>
            <div style={{ marginTop: 2 }}>
              <StatusIndicator state={configured === false ? 'off' : configured ? 'on' : 'warn'}
                label={configured === false ? '연결되지 않음' : configured ? 'Connected' : '확인 중'} />
            </div>
          </div>
          {messages.length > 0 && <Button size="sm" variant="ghost" onClick={() => setMessages([])}>대화 지우기</Button>}
        </div>

        <div className="chat__log" ref={logRef}>
          {configured === false && (
            <div className="bubble bubble--ai" role="alert">
              AI Chat이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.
            </div>
          )}
          {messages.length === 0 && configured !== false ? (
            <EmptyState icon="✦" title="무엇을 도와드릴까요?"
              desc="자연어로 요청하면 아이템과 Notion을 관리해드려요."
              actions={<div className="quick">{QUICK.map((q) => (
                <button key={q} className="chip" onClick={() => void send(q)} disabled={sending}>{q}</button>
              ))}</div>} />
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`bubble bubble--${m.role === 'user' ? 'user' : 'ai'}`}>{m.text}</div>
            ))
          )}
          {sending && step && (
            <div className="chat__steps" aria-live="polite">
              <div className="chat__step"><span className="spinner" aria-hidden /> {step}</div>
            </div>
          )}
        </div>

        <div className="chat__input">
          <textarea
            ref={taRef} className="textarea grow" rows={1}
            placeholder="무엇을 할까요? (Enter 전송 · Shift+Enter 줄바꿈)"
            value={input}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={onKeyDown}
            disabled={sending || configured === false}
            aria-label="메시지 입력"
          />
          {sending
            ? <Button variant="ghost" onClick={cancel}>취소</Button>
            : <Button variant="primary" onClick={() => void send()} disabled={!input.trim() || configured === false} aria-label="전송">➤</Button>}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="quick" style={{ marginTop: 'var(--sp-4)' }}>
          <Button size="sm" variant="ghost" onClick={() => onNavigate('items')}>Items 보기</Button>
          <Button size="sm" variant="ghost" onClick={() => onNavigate('notion')}>Notion 보기</Button>
        </div>
      )}
    </>
  );
}
