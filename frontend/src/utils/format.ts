export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

// Short icon label per category (icon + text, not color-only).
export function categoryLabel(category: string, ext: string): string {
  switch (category) {
    case 'pdf': return 'PDF';
    case 'image': return 'IMG';
    case 'presentation': return 'PPT';
    case 'spreadsheet': return 'XLS';
    case 'document': return 'DOC';
    case 'text': return ext.toUpperCase();
    default: return ext.toUpperCase();
  }
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString();
}
