// Minimal, safe Markdown -> HTML renderer (no external library).
// SECURITY: input is escaped FIRST, so no raw HTML/script from the file can
// execute (XSS-safe). Only a small, known subset of markdown is emitted.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Inline: bold, italic, code, links (safe href only).
function inline(s: string): string {
  let out = s;
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links: [text](http/https/mailto only)
  out = out.replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g,
    (_m, text, href) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`);
  return out;
}

export function renderMarkdown(md: string): string {
  const escaped = escapeHtml(md);
  const lines = escaped.split(/\r?\n/);
  const html: string[] = [];
  let inCode = false;
  let inList = false;

  const closeList = () => { if (inList) { html.push('</ul>'); inList = false; } };

  for (const raw of lines) {
    const line = raw;
    if (/^```/.test(line.trim())) {
      if (!inCode) { closeList(); html.push('<pre><code>'); inCode = true; }
      else { html.push('</code></pre>'); inCode = false; }
      continue;
    }
    if (inCode) { html.push(line + '\n'); continue; }

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { closeList(); const lvl = h[1].length; html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }

    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { if (!inList) { html.push('<ul>'); inList = true; } html.push(`<li>${inline(li[1])}</li>`); continue; }

    if (line.trim() === '') { closeList(); html.push(''); continue; }

    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  if (inCode) html.push('</code></pre>');
  closeList();
  return html.join('\n');
}
