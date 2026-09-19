import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useEffect, useRef } from 'react';

// ---- Button ----
type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger';
export function Button({
  variant = 'default', size, block, loading, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant; size?: 'sm'; block?: boolean; loading?: boolean;
}) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn--primary',
    variant === 'ghost' && 'btn--ghost',
    variant === 'danger' && 'btn--danger',
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

// ---- Field wrappers ----
export function Field({ label, hint, htmlFor, children }: { label?: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label className="field__label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </div>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="textarea" {...props} />;
}

// ---- Card ----
export function Card({ pad = true, hover, className = '', children, ...rest }: {
  pad?: boolean; hover?: boolean; className?: string; children: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const cls = ['card', pad && 'card--pad', hover && 'card--hover', className].filter(Boolean).join(' ');
  return <div className={cls} {...rest}>{children}</div>;
}

// ---- Badge ----
export function Badge({ tone = 'default', children }: { tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary'; children: ReactNode }) {
  return <span className={`badge${tone !== 'default' ? ` badge--${tone}` : ''}`}>{children}</span>;
}

// ---- Status indicator (dot + text; never color-only) ----
export function StatusIndicator({ state, label }: { state: 'on' | 'warn' | 'off'; label: string }) {
  return (
    <span className={`status status--${state}`} role="status">
      <span className="status__dot" aria-hidden />
      {label}
    </span>
  );
}

// ---- Page header ----
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__row">
        <div>
          <h1 className="page-header__title">{title}</h1>
          {subtitle && <p className="page-header__sub">{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
    </header>
  );
}

// ---- Empty / Error states ----
export function EmptyState({ icon = '✨', title, desc, actions }: { icon?: string; title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="state">
      <div className="state__icon" aria-hidden>{icon}</div>
      <div className="state__title">{title}</div>
      {desc && <div className="state__desc">{desc}</div>}
      {actions && <div className="state__actions">{actions}</div>}
    </div>
  );
}
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="state__icon" aria-hidden>⚠️</div>
      <div className="state__title">데이터를 불러오지 못했습니다.</div>
      {message && <div className="state__desc">{message}</div>}
      {onRetry && <div className="state__actions"><Button onClick={onRetry}>다시 시도</Button></div>}
    </div>
  );
}

// ---- Skeleton ----
export function Skeleton({ h = 16, w = '100%', r, style }: { h?: number; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} aria-hidden />;
}

// ---- Spinner ----
export function Spinner() {
  return <span className="spinner" role="status" aria-label="로딩 중" />;
}

// ---- Modal (focus trap-lite: focus on open, ESC to close, scrim click) ----
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,button,select')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="닫기">✕</button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}
