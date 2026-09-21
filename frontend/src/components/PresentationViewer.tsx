import { useEffect, useRef, useState } from 'react';
import { api, DocumentDto } from '../api';
import { Button } from './ui';

// PPTX viewer: renders slides fully client-side via `pptx-preview` (loaded
// dynamically so it never bloats the initial bundle). The server only streams
// the raw file — no server-side conversion, so RAM stays flat.
export function PresentationViewer({ doc, onLastSlide }: { doc: DocumentDto; onLastSlide?: (n: number) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slide, setSlide] = useState(doc.lastViewedPage ?? 1);
  const [total, setTotal] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('loading');
        const [{ init }, buf] = await Promise.all([
          import('pptx-preview'),
          fetch(api.documentFileUrl(doc.id), { credentials: 'include' }).then((r) => {
            if (!r.ok) throw new Error('fetch failed');
            return r.arrayBuffer();
          }),
        ]);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = '';
        const width = Math.min(hostRef.current.clientWidth || 960, 1280);
        const previewer = init(hostRef.current, { width, height: Math.round((width * 9) / 16) });
        await previewer.preview(buf);
        if (cancelled) return;
        // Count rendered slide elements to build our own navigation.
        const slides = hostRef.current.querySelectorAll('.pptx-preview-wrapper, section, .slide');
        setTotal(slides.length || 1);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [doc.id]);

  // Scroll to the current slide element.
  useEffect(() => {
    if (status !== 'ready' || !hostRef.current) return;
    const slides = hostRef.current.querySelectorAll('.pptx-preview-wrapper, section, .slide');
    const el = slides[slide - 1] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onLastSlide?.(slide);
  }, [slide, status, onLastSlide]);

  if (status === 'error') {
    return (
      <div className="state">
        <div className="state__icon">🖼️</div>
        <div className="state__title">이 프레젠테이션을 미리볼 수 없습니다.</div>
        <div className="state__desc">파일이 손상되었거나 지원되지 않는 요소가 포함되어 있을 수 있습니다. 다운로드하여 확인해주세요.</div>
        <div className="state__actions"><a className="btn btn--primary" href={api.documentFileUrl(doc.id, true)}>다운로드</a></div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: 'var(--sp-3)' }}>
      {status === 'loading' && <div className="muted"><span className="spinner" /> 프레젠테이션을 불러오는 중...</div>}
      <div className="pptx-stage" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
        <div ref={hostRef} />
      </div>
      {status === 'ready' && (
        <div className="viewer__foot" style={{ position: 'sticky', bottom: 0 }}>
          <Button size="sm" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} aria-label="축소">−</Button>
          <span className="muted" style={{ minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <Button size="sm" onClick={() => setZoom((z) => Math.min(2.5, z + 0.1))} aria-label="확대">+</Button>
          <Button size="sm" variant="ghost" onClick={() => setSlide((s) => Math.max(1, s - 1))} disabled={slide <= 1}>이전</Button>
          <span className="muted" style={{ minWidth: 70, textAlign: 'center' }}>{slide} / {total}</span>
          <Button size="sm" variant="ghost" onClick={() => setSlide((s) => Math.min(total, s + 1))} disabled={slide >= total}>다음</Button>
        </div>
      )}
    </div>
  );
}
