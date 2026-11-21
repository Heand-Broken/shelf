import { Readability } from '@mozilla/readability';
import { countWords, type ItemInput } from './db';

export interface Snapshot {
  html: string;
  url: string;
  title: string;
  canonical: string;
  cover: string;
  lang: string;
  siteName: string;
  excerpt: string;
  byline: string;
}

/**
 * 注意：这个函数会被 chrome.scripting.executeScript 序列化后注入页面执行，
 * 不能引用任何外部变量或 import。
 */
export function grabPage(): Snapshot {
  const doc = document;
  const metaOf = (sel: string): string => {
    const el = doc.querySelector(sel) as HTMLMetaElement | null;
    return el && el.content ? el.content : '';
  };
  const abs = (href: string): string => {
    if (!href) return '';
    try {
      return new URL(href, location.href).toString();
    } catch {
      return '';
    }
  };

  const canonicalEl = doc.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  const title =
    metaOf('meta[property="og:title"]') || doc.title || location.href;
  const canonical = abs((canonicalEl && canonicalEl.href) || location.href);
  const cover = abs(
    metaOf('meta[property="og:image"]') || metaOf('meta[name="twitter:image"]'),
  );
  const siteName =
    metaOf('meta[property="og:site_name"]') || location.hostname.replace(/^www\./, '');
  const excerpt =
    metaOf('meta[name="description"]') || metaOf('meta[property="og:description"]');
  const lang = doc.documentElement.lang || '';
  const byline =
    metaOf('meta[name="author"]') || metaOf('meta[property="article:author"]');

  const clone = doc.documentElement.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      'script,style,noscript,svg,iframe,object,embed,template,link[rel="manifest"],link[rel="preload"]',
    )
    .forEach((n) => n.remove());

  clone.querySelectorAll('img').forEach((node) => {
    const img = node as HTMLImageElement;
    if (img.getAttribute('src')) return;
    const lazy =
      img.getAttribute('data-src') ||
      img.getAttribute('data-original') ||
      img.getAttribute('data-lazy-src') ||
      img.getAttribute('data-actualsrc');
    if (lazy) img.setAttribute('src', lazy);
  });

  const head = clone.querySelector('head');
  if (head) {
    Array.from(head.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();
      if (tag !== 'meta' && tag !== 'title' && tag !== 'base') el.remove();
    });
    const existingBase = head.querySelector('base');
    if (existingBase) existingBase.remove();
    const base = doc.createElement('base');
    base.setAttribute('href', location.href);
    head.prepend(base);
  }

  return {
    html: clone.outerHTML,
    url: location.href,
    title,
    canonical,
    cover,
    siteName,
    excerpt,
    lang,
    byline,
  };
}

const JUNK_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'form',
  'button',
  'video',
  'audio',
  'canvas',
  '.ad',
  '.ads',
  '.advert',
  '.advertisement',
  '[class*="newsletter"]',
  '[class*="subscribe"]',
  '[id*="comment"]',
  '[class*="comment"]',
  '[class*="share"]',
  '[class*="related-posts"]',
];

function cleanup(html: string, baseUrl: string): { html: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base');
  base.href = baseUrl;
  doc.head.prepend(base);

  for (const sel of JUNK_SELECTORS) {
    try {
      doc.querySelectorAll(sel).forEach((n) => n.remove());
    } catch {
      /* 忽略非法选择器 */
    }
  }

  doc.querySelectorAll('img').forEach((node) => {
    const img = node as HTMLImageElement;
    const w = Number(img.getAttribute('width') || 0);
    const h = Number(img.getAttribute('height') || 0);
    if ((w > 0 && w <= 2) || (h > 0 && h <= 2)) img.remove();
  });

  doc.querySelectorAll('a').forEach((a) => {
    try {
      a.setAttribute('href', new URL(a.getAttribute('href') || '', baseUrl).toString());
    } catch {
      a.removeAttribute('href');
    }
  });

  const text = (doc.body?.textContent || '').replace(/[ \t\u00a0]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return { html: doc.body ? doc.body.innerHTML : '', text };
}

export function parseSnapshot(snap: Snapshot): ItemInput | null {
  let article: {
    title?: string | null;
    byline?: string | null;
    content?: string | null;
    textContent?: string | null;
    excerpt?: string | null;
    siteName?: string | null;
    lang?: string | null;
  } | null = null;

  try {
    const doc = new DOMParser().parseFromString(snap.html, 'text/html');
    const base = doc.createElement('base');
    base.href = snap.url;
    if (doc.head) doc.head.prepend(base);

    const reader = new Readability(doc, {
      charThreshold: 120,
      keepClasses: false,
      disableJSONLD: false,
    });
    article = reader.parse();
  } catch (err) {
    console.warn('[shelf] readability failed', err);
  }

  const fallback = cleanup(snap.html, snap.url);

  const contentHtml = (article?.content && article.content.trim()) || fallback.html;
  const contentText = (article?.textContent && article.textContent.trim()) || fallback.text;

  if (!contentText && !snap.title) return null;

  let canonical = snap.canonical || snap.url;
  try {
    if (new URL(canonical).hostname !== new URL(snap.url).hostname) canonical = snap.url;
  } catch {
    canonical = snap.url;
  }

  return {
    url: snap.url,
    canonicalUrl: canonical,
    title: (article?.title || snap.title || snap.url).trim(),
    excerpt: (article?.excerpt || snap.excerpt || '').trim().slice(0, 400),
    contentHtml,
    contentText,
    byline: (article?.byline || snap.byline || '').trim(),
    siteName: (article?.siteName || snap.siteName || '').trim(),
    lang: (article?.lang || snap.lang || '').trim(),
    cover: snap.cover,
    tags: [],
  };
}

export function readingMinutes(item: { contentText: string }): number {
  const words = countWords(item.contentText);
  return Math.max(1, Math.round(words / 350));
}
