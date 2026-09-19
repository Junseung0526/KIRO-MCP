import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { styles } from './styles';

interface Msg { role: 'user' | 'ai'; text: string }

// Chat forwards natural language to the backend, which runs Kiro CLI with the
// locked-down kiro_mcp agent (7 MCP tools). Real tool results are shown.
export function ChatPage({ onDbMaybeChanged }: { onDbMaybeChanged?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.chatStatus().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setSending(true);
    setStatus('전송 중…');
    try {
      // Use SSE streaming so the UI shows live progress during the (multi-second)
      // Kiro run, then appends the real final reply.
      const { promise } = api.chatStream(text, (state) => {
        setStatus(state === 'accepted' ? '요청 수락됨…' : 'Kiro CLI 처리 중…');
      });
      const res = await promise;
      setMessages((m) => [...m, { role: 'ai', text: res.reply || '(빈 응답)' }]);
      onDbMaybeChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패');
    } finally {
      setSending(false);
      setStatus(null);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div>
      <h1 style={styles.h1}>AI Chat</h1>
      <p style={styles.sub}>자연어로 요청하면 Kiro CLI가 허용된 MCP 도구(7개)로 실제 DB 작업을 수행합니다.</p>

      {configured === false && (
        <div style={styles.error}>
          Chat이 설정되지 않았습니다. 호스트의 Kiro 브리지(KIRO_BRIDGE_URL)가 실행 중이어야 합니다.
        </div>
      )}

      <div style={styles.chatWrap}>
        <div ref={logRef} style={styles.chatLog}>
          {messages.length === 0 ? (
            <div style={styles.empty}>
              예: "아이템 목록 보여줘", "Spring 공부 아이템 추가해줘", "공부라는 단어가 들어간 아이템 찾아줘", "현재 통계 알려줘"
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? styles.bubbleUser : styles.bubbleAI}>{m.text}</div>
            ))
          )}
          {sending && <div style={styles.bubbleAI}>{status ?? '처리 중…'} <span style={{ opacity: 0.6 }}>(Kiro CLI)</span></div>}
        </div>
        {error && <div style={{ ...styles.error, margin: 0, borderRadius: 0 }}>오류: {error}</div>}
        <div style={styles.chatInputRow}>
          <textarea
            style={{ ...styles.input, minHeight: 44, resize: 'none' }}
            placeholder="메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || configured === false}
          />
          <button style={styles.btnPrimary} onClick={() => void send()} disabled={sending || configured === false}>
            {sending ? '전송 중…' : '전송'}
          </button>
        </div>
      </div>
    </div>
  );
}
