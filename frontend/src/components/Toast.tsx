import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; tone: ToastTone; message: string; sticky?: boolean }

interface ToastApi {
  success: (msg: string) => void;
  error: (msg: string, sticky?: boolean) => void;
  info: (msg: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((tone: ToastTone, message: string, sticky = false) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, tone, message, sticky }]);
    // Errors are sticky by default (user dismisses); others auto-dismiss ~4s.
    if (!sticky) setTimeout(() => remove(id), 4000);
  }, [remove]);

  const api: ToastApi = {
    success: (m) => push('success', m),
    error: (m, sticky = true) => push('error', m, sticky),
    info: (m) => push('info', m),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap" role="region" aria-label="알림">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span className="toast__bar" aria-hidden />
            <div className="toast__body">{t.message}</div>
            <button className="toast__close" onClick={() => remove(t.id)} aria-label="알림 닫기">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
