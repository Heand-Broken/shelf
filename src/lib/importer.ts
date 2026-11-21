import { db, normalizeUrl, type Item } from './db';

export interface ImportedLink {
  url: string;
  title: string;
  tags: string[];
  addedAt: number;
}

/**
 * 同时兼容浏览器书签导出（Netscape 格式）与 Pocket 导出的 ril_export.html。
 * 两者都是 <a href> 列表，区别只在时间属性名（add_date / time_added）。
 */
export function parseBookmarkHtml(html: string): ImportedLink[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: ImportedLink[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll('a[href]').forEach((node) => {
    const a = node as HTMLAnchorElement;
    const href = a.getAttribute('href') || '';
    if (!/^https?:\/\//i.test(href)) return;
    const key = normalizeUrl(href);
    if (seen.has(key)) return;
    seen.add(key);

    const tags = (a.getAttribute('tags') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);

    const ts = Number(a.getAttribute('time_added') || a.getAttribute('add_date') || 0);
    out.push({
      url: href,
      title: (a.textContent || '').trim() || href,
      tags,
      addedAt: Number.isFinite(ts) && ts > 0 ? ts * 1000 : Date.now(),
    });
  });

  return out;
}

export async function importLinks(
  links: ImportedLink[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ added: number; skipped: number }> {
  const existing = new Set((await db.items.toArray()).map((i) => i.canonicalUrl));
  const batch: Item[] = [];
  let skipped = 0;

  const now = Date.now();
  for (const link of links) {
    const canonicalUrl = normalizeUrl(link.url);
    if (existing.has(canonicalUrl)) {
      skipped++;
      continue;
    }
    existing.add(canonicalUrl);
    batch.push({
      url: link.url,
      canonicalUrl,
      title: link.title,
      excerpt: '',
      contentHtml: '',
      contentText: '',
      byline: '',
      siteName: (() => {
        try {
          return new URL(link.url).hostname.replace(/^www\./, '');
        } catch {
          return '';
        }
      })(),
      lang: '',
      cover: '',
      tags: link.tags,
      read: 0,
      starred: 0,
      createdAt: link.addedAt || now,
      updatedAt: now,
      readAt: null,
      wordCount: 0,
      summary: null,
      summaryModel: null,
      progress: 0,
    });
  }

  let added = 0;
  for (let i = 0; i < batch.length; i += 300) {
    const slice = batch.slice(i, i + 300);
    await db.items.bulkAdd(slice);
    added += slice.length;
    onProgress?.(added, batch.length);
  }

  return { added, skipped };
}
