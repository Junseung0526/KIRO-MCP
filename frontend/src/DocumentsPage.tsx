import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { api, DocumentDto, StorageUsage } from './api';
import { Button, Card, EmptyState, ErrorState, Input, Modal, PageHeader, Skeleton, StatusIndicator } from './components/ui';
import { DocumentViewer } from './components/DocumentViewer';
import { useToast } from './components/Toast';
import { categoryLabel, formatBytes, relativeTime } from './utils/format';

const CATEGORIES = [
  { key: 'all', label: '전체' }, { key: 'pdf', label: 'PDF' }, { key: 'presentation', label: 'PPT' },
  { key: 'document', label: 'DOC' }, { key: 'spreadsheet', label: 'XLS' }, { key: 'image', label: '이미지' },
  { key: 'text', label: '텍스트' },
];
const SORTS = [
  { key: 'recent', label: '최신순' }, { key: 'oldest', label: '오래된순' },
  { key: 'name', label: '이름순' }, { key: 'size', label: '크기순' }, { key: 'viewed', label: '최근 열람순' },
];
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.doc,.docx,.ppt,.pptx,.xls,.xlsx';

interface UploadItem { name: string; pct: number; status: 'uploading' | 'done' | 'error'; error?: string }

export function DocumentsPage() {
  const toast = useToast();
  const [docs, setDocs] = useState<DocumentDto[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('recent');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<DocumentDto | null>(null);
  const [confirmDel, setConfirmDel] = useState<DocumentDto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  const load = useCallback(async (query: string, cat: string, srt: string) => {
    setLoading(true); setError(null);
    try {
      const [d, s] = await Promise.all([api.documents({ q: query, category: cat, sort: srt }), api.documentStorage()]);
      setDocs(d); setStorage(s);
    } catch (e) { setError(e instanceof Error ? e.message : '불러오기 실패'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(q, category, sort); /* eslint-disable-next-line */ }, [category, sort]);

  function onSearch(v: string) {
    setQ(v);
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void load(v, category, sort), 350);
  }

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (storage && storage.usagePercent >= 100) { toast.error('저장공간이 부족해 업로드할 수 없습니다.'); return; }
    for (const file of arr) {
      setUploads((u) => [...u, { name: file.name, pct: 0, status: 'uploading' }]);
      try {
        await api.documentUpload(file, (pct) =>
          setUploads((u) => u.map((it) => (it.name === file.name && it.status === 'uploading' ? { ...it, pct } : it))));
        setUploads((u) => u.map((it) => (it.name === file.name ? { ...it, pct: 100, status: 'done' } : it)));
        toast.success(`"${file.name}" 업로드 완료`);
      } catch (e) {
        setUploads((u) => u.map((it) => (it.name === file.name ? { ...it, status: 'error', error: e instanceof Error ? e.message : '실패' } : it)));
        toast.error(`"${file.name}" 업로드 실패: ${e instanceof Error ? e.message : ''}`);
      }
    }
    await load(q, category, sort);
    // Clear finished rows after a moment.
    setTimeout(() => setUploads((u) => u.filter((it) => it.status === 'uploading')), 2500);
  }

  function onDrop(e: DragEvent) { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files); }
  function onPick(e: ChangeEvent<HTMLInputElement>) { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = ''; }

  async function doDelete(doc: DocumentDto) {
    try { await api.documentDelete(doc.id); toast.success('자료가 삭제되었습니다.'); setConfirmDel(null); await load(q, category, sort); }
    catch { toast.error('삭제에 실패했습니다.'); }
  }

  const pct = storage?.usagePercent ?? 0;
  const storageWarn = pct >= 90 ? 'full' : pct >= 70 ? 'warn' : 'ok';

  return (
    <>
      <PageHeader title="수업자료" subtitle="한 번 올린 자료를 브라우저에서 바로 열어보세요."
        actions={<Button variant="primary" onClick={() => fileRef.current?.click()}>+ 자료 업로드</Button>} />
      <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={onPick} />

      {/* Storage */}
      <Card style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="row between row--wrap" style={{ marginBottom: 'var(--sp-2)' }}>
          <strong style={{ fontSize: 'var(--fs-sm)' }}>Storage</strong>
          {storage && <span className="muted" style={{ fontSize: 'var(--fs-sm)' }}>
            {formatBytes(storage.usedBytes)} / {formatBytes(storage.totalBytes)} · {storage.fileCount}개 파일
          </span>}
        </div>
        <div className="storagebar">
          <div className={`storagebar__fill${storageWarn === 'warn' ? ' storagebar__fill--warn' : storageWarn === 'full' ? ' storagebar__fill--full' : ''}`}
            style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        {storageWarn !== 'ok' && (
          <div style={{ marginTop: 'var(--sp-2)' }}>
            <StatusIndicator state={storageWarn === 'full' ? 'off' : 'warn'}
              label={pct >= 100 ? '저장공간이 부족합니다.' : pct >= 90 ? '저장공간이 거의 가득 찼습니다.' : '저장공간을 확인해주세요.'} />
          </div>
        )}
      </Card>

      {/* Dropzone */}
      <div className={`dropzone${dragOver ? ' dropzone--over' : ''}`} style={{ marginBottom: 'var(--sp-4)' }}
        onClick={() => fileRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)} onDrop={onDrop} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}>
        PDF·PPTX·DOCX·XLSX·이미지·TXT·MD를 여기에 놓거나 클릭해서 업로드
      </div>

      {uploads.length > 0 && (
        <Card style={{ marginBottom: 'var(--sp-4)' }}>
          {uploads.map((u, i) => (
            <div key={i} className="uprow">
              <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
              {u.status === 'uploading' && <><span className="muted">{u.pct}%</span><span className="spinner" /></>}
              {u.status === 'done' && <span style={{ color: 'var(--c-success)' }}>완료</span>}
              {u.status === 'error' && <span style={{ color: 'var(--c-danger)' }}>실패</span>}
            </div>
          ))}
        </Card>
      )}

      {/* Toolbar */}
      <div className="toolbar">
        <div className="grow"><Input placeholder="자료 검색..." value={q} onChange={(e) => onSearch(e.target.value)} aria-label="자료 검색" /></div>
        <select className="input" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="형식 필터">
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="docgrid">{[0, 1, 2, 3].map((i) => <Card key={i}><Skeleton h={40} w={40} r={10} /><div style={{ height: 10 }} /><Skeleton h={14} /></Card>)}</div>
      ) : error ? (
        <Card><ErrorState message="자료를 불러오지 못했습니다." onRetry={() => void load(q, category, sort)} /></Card>
      ) : docs.length === 0 ? (
        <Card>
          <EmptyState icon="📚" title={q || category !== 'all' ? '조건에 맞는 자료가 없습니다.' : '아직 수업자료가 없습니다.'}
            desc="PDF, PPT, 문서 파일을 업로드하면 언제든 이곳에서 바로 볼 수 있습니다."
            actions={<Button variant="primary" onClick={() => fileRef.current?.click()}>자료 업로드</Button>} />
        </Card>
      ) : (
        <div className="docgrid">
          {docs.map((d) => (
            <Card key={d.id} hover className="doccard" onClick={() => setViewing(d)}>
              <div className="doccard__top">
                <span className={`doc-ic doc-ic--${d.category}`} aria-hidden>{categoryLabel(d.category, d.ext)}</span>
                <div className="grow">
                  <div className="doccard__name" title={d.originalName}>{d.originalName}</div>
                </div>
              </div>
              <div className="doccard__meta">{formatBytes(d.sizeBytes)} · {new Date(d.uploadedAt).toLocaleDateString()}</div>
              {d.lastViewedAt && <div className="doccard__meta">최근 열람 {relativeTime(d.lastViewedAt)}</div>}
              <div className="doccard__actions" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" onClick={() => setViewing(d)}>열기</Button>
                <a className="btn btn--sm btn--ghost" href={api.documentFileUrl(d.id, true)}>다운로드</a>
                <Button size="sm" variant="danger" onClick={() => setConfirmDel(d)}>삭제</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {viewing && <DocumentViewer doc={viewing} onClose={() => { setViewing(null); void load(q, category, sort); }} />}

      {confirmDel && (
        <Modal title="자료 삭제" onClose={() => setConfirmDel(null)}>
          <p style={{ marginBottom: 'var(--sp-5)', wordBreak: 'break-all' }}>이 자료를 삭제할까요?<br /><strong>{confirmDel.originalName}</strong></p>
          <div className="row between">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>취소</Button>
            <Button variant="danger" onClick={() => void doDelete(confirmDel)}>삭제</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
