import TurndownService from 'turndown';
import { readingMinutes } from './extract';
import { makeZip, type ZipEntry } from './zip';
import type { Item } from './db';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '_',
});

turndown.remove(['script', 'style', 'noscript']);

function frontmatter(item: Item): string {
  const lines = [
    '---',
    `title: "${(item.title || '').replace(/"/g, '\\"')}"`,
    `url: ${item.url}`,
    `source: ${item.siteName || ''}`,
    `author: ${item.byline || ''}`,
    `saved: ${new Date(item.createdAt).toISOString()}`,
  ];
  if (item.tags.length) lines.push(`tags: [${item.tags.join(', ')}]`);
  lines.push('---', '');
  return lines.join('\n');
}

export function itemToMarkdown(item: Item, withFrontmatter = true): string {
  const body = turndown.turndown(item.contentHtml || item.contentText || '');
  const head = withFrontmatter ? frontmatter(item) : `# ${item.title}\n\n<${item.url}>\n\n`;
  const summary = item.summary ? `> **摘要**：${item.summary}\n\n` : '';
  return `${head}${summary}${body}\n`.replace(/\n{4,}/g, '\n\n\n');
}

export function itemToHtmlDocument(item: Item): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
  return `<!DOCTYPE html>
<html lang="${esc(item.lang || 'zh')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(item.title)}</title>
<style>
:root { color-scheme: light dark; }
body { max-width: 38rem; margin: 3rem auto; padding: 0 1.25rem; font: 400 17px/1.75 Georgia, "Songti SC", serif; }
h1 { font-size: 1.6rem; line-height: 1.3; margin-bottom: .5rem; }
.meta { color: #777; font-size: .82rem; margin-bottom: 2rem; }
img { max-width: 100%; height: auto; border-radius: 4px; }
blockquote { margin: 1.5rem 0; padding-left: 1rem; border-left: 3px solid #ddd; color: #555; }
pre { background: #f5f5f2; padding: 1rem; overflow-x: auto; border-radius: 6px; }
a { color: #1a5fb4; }
.summary { background: #faf7ef; border: 1px solid #eadfc4; padding: .9rem 1.1rem; border-radius: 8px; margin-bottom: 2rem; font-size: .94rem; }
@media (prefers-color-scheme: dark) {
  body { background: #161615; color: #e8e6e1; }
  a { color: #7aa2f7; }
  pre { background: #232322; }
  blockquote { border-color: #3a3a38; color: #b9b7b1; }
  .summary { background: #26241c; border-color: #3d3728; }
  .meta { color: #9a978f; }
}
</style>
</head>
<body>
<h1>${esc(item.title)}</h1>
<p class="meta">${esc(item.siteName || '')}${item.byline ? ' · ' + esc(item.byline) : ''} · ${readingMinutes(item)} min</p>
${item.summary ? `<div class="summary"><strong>摘要</strong><br>${esc(item.summary)}</div>` : ''}
${item.contentHtml || `<p>${esc(item.contentText)}</p>`}
<hr>
<p class="meta">由拾页 Shelf 保存 · ${esc(item.url)}</p>
</body>
</html>`;
}

export function slugify(title: string, max = 60): string {
  return (
    title
      .replace(/[\\/:*?"<>|]/g, ' ')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'untitled'
  );
}

export function libraryToMarkdown(items: Item[]): string {
  const head = [
    '# 拾页书架导出',
    '',
    `导出时间：${new Date().toISOString()}`,
    `条目数：${items.length}`,
    '',
    '---',
    '',
  ].join('\n');
  const body = items
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((it) => itemToMarkdown(it, false))
    .join('\n\n---\n\n');
  return head + body;
}

function fileNameFor(item: Item): string {
  const base = slugify(item.title, 70) || 'untitled';
  return `${base}-${item.id ?? 0}.md`;
}

/** 每篇一个 .md，外加一份索引。走自写的 STORE 模式 zip，不引第三方库。 */
export function libraryToZip(items: Item[]): Blob {
  const encoder = new TextEncoder();
  const sorted = items.slice().sort((a, b) => b.createdAt - a.createdAt);
  const entries: ZipEntry[] = [];

  const indexLines = [
    '# 拾页书架索引',
    '',
    `导出时间：${new Date().toISOString()}`,
    `条目数：${items.length}`,
    '',
  ];
  for (const it of sorted) {
    indexLines.push(`- ${it.title}`);
    indexLines.push(`  articles/${fileNameFor(it)}`);
    indexLines.push(`  ${it.url}`);
  }
  indexLines.push('');

  entries.push({ name: 'index.md', data: encoder.encode(indexLines.join('\n')) });

  const used = new Set<string>();
  for (const it of sorted) {
    let name = `articles/${fileNameFor(it)}`;
    let n = 2;
    while (used.has(name)) {
      name = `articles/${fileNameFor(it).replace(/\.md$/, '')}-${n}.md`;
      n++;
    }
    used.add(name);
    entries.push({ name, data: encoder.encode(itemToMarkdown(it)) });
  }

  return makeZip(entries);
}

export function download(filename: string, content: string | Blob, mime = 'text/plain;charset=utf-8'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
