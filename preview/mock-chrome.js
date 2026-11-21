/* 仅用于本地预览，不进入 dist。模拟 sidepanel 用到的 chrome API。 */
(function () {
  const area = (name) => {
    const store = Object.create(null);
    const listeners = [];
    return {
      listeners,
      api: {
        async get(keys) {
          if (keys == null) return { ...store };
          if (typeof keys === 'string') return { [keys]: store[keys] };
          if (Array.isArray(keys)) {
            const out = {};
            for (const k of keys) out[k] = store[k];
            return out;
          }
          const out = {};
          for (const [k, v] of Object.entries(keys)) out[k] = store[k] ?? v;
          return out;
        },
        async set(obj) {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { oldValue: store[k], newValue: v };
            store[k] = v;
          }
          for (const fn of listeners) fn(changes, name);
        },
        async remove(keys) {
          const list = Array.isArray(keys) ? keys : [keys];
          const changes = {};
          for (const k of list) {
            changes[k] = { oldValue: store[k], newValue: undefined };
            delete store[k];
          }
          for (const fn of listeners) fn(changes, name);
        },
      },
    };
  };

  const local = area('local');
  const session = area('session');

  // 预览默认英文界面：商店素材面向海外，中文截图没有意义
  local.api.set({ settings: { locale: 'en', theme: 'light' } });

  const para = (n) =>
    `这是第 ${n} 段正文，用来验证正文提取链路是否真的跑通。浏览器扩展最容易糊弄自己的地方，就是把“编译通过”当成“功能可用”。` +
    `所以这一段故意写得长一些，让 Readability 的字符阈值能够通过，从而触发真正的正文解析，而不是回退到整页抓取。`;

  const sample = (title, site, byline) => ({
    html: `<html lang="zh"><head><title>${title}</title>
      <meta property="og:site_name" content="${site}">
      <meta name="description" content="这是一段用于预览的摘要文本。">
      <meta name="author" content="${byline}">
      </head><body><nav>导航条应被丢弃</nav>
      <article><h1>${title}</h1>
      <p>${para(1)}</p><p>${para(2)}</p><h2>为什么本地优先</h2>
      <p>${para(3)}</p><blockquote>数据在你手里，才算真的属于你。</blockquote>
      <p>${para(4)}</p></article>
      <footer>页脚应被丢弃</footer></body></html>`,
    url: `https://${site}/posts/local-first`,
    title,
    canonical: `https://${site}/posts/local-first`,
    cover: '',
    lang: 'zh',
    siteName: site,
    excerpt: '这是一段用于预览的摘要文本。',
    byline,
  });

  const SNAPSHOTS = [
    sample('Why your extension got rejected', 'developer.chrome.com', 'Chrome Team'),
    sample('How the reader picks the article', 'readability.dev', 'Mozilla'),
    sample('Full-text search with IndexedDB', 'juejin.cn', 'Community'),
    sample('Manifest V3 migration checklist', 'developer.chrome.com', 'Chrome Team'),
    sample('What happens when a read-later service shuts down', 'sspai.com', 'Editorial'),
    sample('Ten details that make a sidebar feel right', 'uxdesign.cc', 'UX Collective'),
    sample('Local-first reading, revisited', 'web.dev', 'Web.dev'),
    sample('The cost of JavaScript, revisited', 'web.dev', 'Web.dev'),
  ];

  let cursor = 0;

  window.chrome = {
    runtime: {
      id: 'preview-mode',
      lastError: undefined,
      sendMessage: async (msg) => (msg && msg.type === 'get-pending-save' ? null : true),
      onMessage: { addListener() {}, removeListener() {} },
    },
    storage: {
      local: Object.assign(local.api, {
        onChanged: { addListener: (fn) => local.listeners.push(fn), removeListener() {} },
      }),
      session: Object.assign(session.api, {
        onChanged: { addListener: (fn) => session.listeners.push(fn), removeListener() {} },
      }),
      onChanged: { addListener: (fn) => local.listeners.push(fn), removeListener() {} },
    },
    tabs: {
      query: async () => [{ id: 1, url: 'https://example.com', active: true }],
      getCurrent: async () => ({ id: 1 }),
      remove: async () => {},
      create: async () => ({}),
    },
    scripting: {
      executeScript: async () => {
        const result = SNAPSHOTS[cursor % SNAPSHOTS.length];
        cursor += 1;
        return [{ result }];
      },
    },
    permissions: {
      contains: async () => true,
      request: async () => true,
    },
  };
})();
