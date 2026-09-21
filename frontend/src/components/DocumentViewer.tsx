import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { api, DocumentDto } from '../api';
import { Button } from './ui';
import { renderMarkdown } from '../utils/markdown';

const PresentationViewer = lazy(() =>
  import('./PresentationViewer').then((m) => ({ default: m.PresentationViewer })));

// Common viewer overlay. Picks a sub-viewer by previewType. Records last-viewed
// on open (and last page for PDF/PPTX for "resume reading").
export function DocumentViewer({ doc, onClose }: { doc: DocumentDto; onClose: () => void }) {
  const lastPageRef = useRef<number>(doc.lastViewedPage ?? 1);

  // Record a view when opened; persist last page on close.
  useEffect(() => {
    api.documentRecordView(doc.id, doc.lastViewedPage ?? undefined).catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  function close() {
    // Save resume position (best-effort) then close.
    api.documentRecordView(doc.id, lastPageRef.current).catch(() => {});
    onClose();
  }

  function fullscreen() {
    document.querySelector('.viewer')?.requestFullscreen?.().catch(() => {});
  }

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={doc.originalName}>
      <div className="viewer__bar">
        <Button variant="ghost" size="sm" onClick={close}>← 자료실</Button>
        <span className="viewer__title grow">{doc.originalName}</span>
        <Button variant="ghost" size="sm" onClick={fullscreen} aria-label="전체화면">⛶</Button>
        <a className="btn btn--sm" href={api.documentFileUrl(doc.id, true)}>⬇ 다운로드</a>
        <a className="btn btn--sm btn--ghost" href={api.documentFileUrl(doc.id)} target="_blank" rel="noreferrer">새 창 ↗</a>
      </div>
      <div className="viewer__body">
        {doc.previewType === 'pdf' && <PdfView doc={doc} onPage={(p) => (lastPageRef.current = p)} />}
        {doc.previewType === 'image' && <ImageView doc={doc} />}
        {doc.previewType === 'text' && <TextView doc={doc} mode="text" />}
        {doc.previewType === 'markdown' && <TextView doc={doc} mode="markdown" />}
        {doc.previewType === 'pptx' && (
          <Suspense fallback={<div className="muted"><span className="spinner" /> 뷰어 로딩 중...</div>}>
            <PresentationViewer doc={doc} onLastSlide={(n) => (lastPageRef.current = n)} />
          </Suspense>
        )}
        {doc.previewType === 'unsupported' && <UnsupportedView doc={doc} />}
      </div>
    </div>
  );
}

// PDF: browser-native viewer via iframe. Supports page/zoom/print/etc. natively.
// Resume: open at last page via #page=N.
function PdfView({ doc, onPage }: { doc: DocumentDto; onPage: (p: number) => void }) {
  const startPage = doc.lastViewedPage && doc.lastViewedPage > 1 ? doc.lastViewedPage : undefined;
  const src = api.documentFileUrl(doc.id) + (startPage ? `#page=${startPage}` : '');
  useEffect(() => { if (startPage) onPage(startPage); }, [startPage, onPage]);
  return <iframe className="viewer__pdf" src={src} title={doc.originalName} />;
}

function ImageView({ doc }: { doc: DocumentDto }) {
  const [zoom, setZoom] = useState(1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)', width: '100%' }}>
      <img className="viewer__img" src={api.documentFileUrl(doc.id)} alt={doc.originalName} style={{ transform: `scale(${zoom})` }} />
      <div className="viewer__foot" style={{ position: 'sticky', bottom: 0 }}>
        <Button size="sm" onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))} aria-label="축소">−</Button>
        <span className="muted" style={{ minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
        <Button size="sm" onClick={() => setZoom((z) => Math.min(4, z + 0.2))} aria-label="확대">+</Button>
        <Button size="sm" variant="ghost" onClick={() => setZoom(1)}>원본</Button>
      </div>
    </div>
  );
}

function TextView({ doc, mode }: { doc: DocumentDto; mode: 'text' | 'markdown' }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(api.documentFileUrl(doc.id), { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(); return r.text(); })
      .then((t) => alive && setContent(t.slice(0, 500000)))
      .catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [doc.id]);

  if (error) return <div className="muted">파일을 불러오지 못했습니다.</div>;
  if (content === null) return <div className="muted"><span className="spinner" /> 불러오는 중...</div>;
  if (mode === 'markdown') {
    return <div className="viewer__md" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
  }
  return <div className="viewer__text">{content}</div>;
}

function UnsupportedView({ doc }: { doc: DocumentDto }) {
  return (
    <div className="state">
      <div className="state__icon">📄</div>
      <div className="state__title">이 파일은 웹에서 미리보기를 지원하지 않습니다.</div>
      <div className="state__desc">{doc.ext.toUpperCase()} 파일은 다운로드해서 확인해주세요. 원본은 그대로 보관됩니다.</div>
      <div className="state__actions">
        <a className="btn btn--primary" href={api.documentFileUrl(doc.id, true)}>다운로드</a>
      </div>
    </div>
  );
}
