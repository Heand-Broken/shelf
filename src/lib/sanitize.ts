const ALLOWED_TAGS = new Set([
  'A', 'P', 'DIV', 'SPAN', 'SECTION', 'ARTICLE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
  'BLOCKQUOTE', 'PRE', 'CODE', 'KBD', 'SAMP',
  'EM', 'STRONG', 'B', 'I', 'U', 'S', 'DEL', 'INS', 'MARK', 'SMALL', 'SUB', 'SUP',
  'BR', 'HR', 'IMG', 'FIGURE', 'FIGCAPTION', 'PICTURE', 'SOURCE',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION', 'COLGROUP', 'COL',
  'TIME', 'ABBR', 'CITE', 'Q',
]);

const ALLOWED_ATTR = new Set([
  'href', 'src', 'srcset', 'alt', 'title', 'width', 'height',
  'colspan', 'rowspan', 'datetime', 'cite', 'dir', 'lang', 'start', 'reversed', 'type',
]);

const UNSAFE_PROTOCOL = /^\s*(javascript|data:text\/html|vbscript):/i;

function resolveUrl(raw: string, base: string): string {
  const value = raw.trim();
  if (!value) return '';
  if (/^data:image\//i.test(value)) return value;
  try {
    const u = new URL(value, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'mailto:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * 正文 HTML 来自第三方页面，不能直接塞进 DOM。
 * 这里做白名单过滤：只保留排版需要的标签，剥掉全部事件属性与脚本协议。
 */
export function sanitizeHtml(dirty: string, baseUrl: string): string {
  if (!dirty) return '';
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${dirty}</body>`, 'text/html');
  const body = doc.body;

  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  const remove: Element[] = [];

  let node = walker.nextNode();
  while (node) {
    const el = node as Element;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      remove.push(el);
      node = walker.nextNode();
      continue;
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTR.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === 'href' || name === 'src') {
        if (UNSAFE_PROTOCOL.test(attr.value)) {
          el.removeAttribute(attr.name);
          continue;
        }
        const resolved = resolveUrl(attr.value, baseUrl);
        if (resolved) el.setAttribute(attr.name, resolved);
        else el.removeAttribute(attr.name);
      }
    }

    if (el.tagName === 'IMG' && !el.getAttribute('src')) {
      const lazy = el.getAttribute('data-src');
      if (lazy) {
        const resolved = resolveUrl(lazy, baseUrl);
        if (resolved) el.setAttribute('src', resolved);
      }
    }

    node = walker.nextNode();
  }

  for (const el of remove) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }

  return body.innerHTML;
}
