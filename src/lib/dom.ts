export function esc(input: unknown): string {
  return String(input ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function timeAgo(ts: number, lang: 'zh' | 'en'): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (min < 60) return lang === 'zh' ? `${min} 分钟前` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return lang === 'zh' ? `${hr} 小时前` : `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return lang === 'zh' ? `${day} 天前` : `${day}d ago`;
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function qs<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
}

export function qsa<T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(sel));
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 220) {
  let timer: number | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

export function highlight(text: string, query: string): string {
  const q = query.trim();
  if (!q) return esc(text);
  const safe = esc(text);
  const tokens = q.split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!tokens.length) return safe;
  const re = new RegExp(`(${tokens.join('|')})`, 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}
