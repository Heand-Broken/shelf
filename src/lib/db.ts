import Dexie, { type Table } from 'dexie';

export interface Item {
  id?: number;
  url: string;
  canonicalUrl: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  byline: string;
  siteName: string;
  lang: string;
  cover: string;
  tags: string[];
  read: 0 | 1;
  starred: 0 | 1;
  createdAt: number;
  updatedAt: number;
  readAt: number | null;
  wordCount: number;
  summary: string | null;
  summaryModel: string | null;
  progress: number;
}

export interface ItemInput {
  url: string;
  canonicalUrl: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  contentText: string;
  byline: string;
  siteName: string;
  lang: string;
  cover: string;
  tags?: string[];
}

class ShelfDB extends Dexie {
  items!: Table<Item, number>;

  constructor() {
    super('shelf');
    this.version(1).stores({
      items: '++id, &canonicalUrl, createdAt, read, starred, *tags, siteName',
    });
  }
}

export const db = new ShelfDB();

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    const drop = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'ref_src', 'spm', 'from', 'share_token',
    ];
    for (const k of drop) u.searchParams.delete(k);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g) || []).length;
  const latin = (text.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff]/g, ' ').match(/[A-Za-z0-9']+/g) || []).length;
  return cjk + latin;
}

export async function saveItem(input: ItemInput): Promise<{ item: Item; created: boolean }> {
  const now = Date.now();
  const canonicalUrl = normalizeUrl(input.canonicalUrl || input.url);
  const existing = await db.items.where('canonicalUrl').equals(canonicalUrl).first();
  const words = countWords(input.contentText);

  if (existing) {
    const merged: Item = {
      ...existing,
      ...input,
      tags: Array.from(new Set([...(existing.tags || []), ...(input.tags || [])])),
      canonicalUrl,
      updatedAt: now,
      wordCount: words,
    };
    await db.items.put(merged);
    return { item: merged, created: false };
  }

  const item: Item = {
    url: input.url,
    canonicalUrl,
    title: input.title || input.url,
    excerpt: input.excerpt || '',
    contentHtml: input.contentHtml || '',
    contentText: input.contentText || '',
    byline: input.byline || '',
    siteName: input.siteName || '',
    lang: input.lang || '',
    cover: input.cover || '',
    tags: input.tags || [],
    read: 0,
    starred: 0,
    createdAt: now,
    updatedAt: now,
    readAt: null,
    wordCount: words,
    summary: null,
    summaryModel: null,
    progress: 0,
  };
  const id = await db.items.add(item);
  return { item: { ...item, id }, created: true };
}

export interface SearchResult extends Item {
  rank: number;
}

export async function searchItems(query: string, limit = 200): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q) {
    const list = await db.items.orderBy('createdAt').reverse().limit(limit).toArray();
    return list.map((i) => ({ ...i, rank: 0 }));
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const all = await db.items.toArray();
  const scored: SearchResult[] = [];
  for (const it of all) {
    const title = it.title.toLowerCase();
    const text = it.contentText.toLowerCase();
    let rank = 0;
    let hit = 0;
    for (const t of tokens) {
      if (title.includes(t)) {
        rank += 6;
        hit++;
      }
      if (text.includes(t)) {
        rank += 1;
        hit++;
      }
      if ((it.tags || []).some((tag) => tag.toLowerCase().includes(t))) {
        rank += 4;
        hit++;
      }
    }
    if (hit === tokens.length) scored.push({ ...it, rank });
  }
  scored.sort((a, b) => b.rank - a.rank || b.createdAt - a.createdAt);
  return scored.slice(0, limit);
}

export async function getAllTags(): Promise<Array<{ tag: string; n: number }>> {
  const all = await db.items.toArray();
  const map = new Map<string, number>();
  for (const it of all) for (const t of it.tags || []) map.set(t, (map.get(t) || 0) + 1);
  return Array.from(map, ([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n);
}

export async function stats() {
  const total = await db.items.count();
  const unread = await db.items.where('read').equals(0).count();
  const starred = await db.items.where('starred').equals(1).count();
  return { total, unread, starred };
}
