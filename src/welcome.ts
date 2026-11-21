import { getSettings } from './lib/settings';
import { detectLang } from './lib/i18n';
import { IS_FIREFOX } from './lib/platform';

const COPY = {
  zh: {
    brand: '拾页 Shelf',
    title: '拾页已就绪',
    lead: '三个动作，然后就不必再想起它。',
    steps: [
      {
        n: '01',
        t: '在任意网页按 Alt+S',
        d: '正文会被提取出来，存进侧边栏的书架。点工具栏图标效果一样。',
      },
      {
        n: '02',
        t: '在侧边栏里读',
        d: '全文搜索、标签、已读筛选。字号、行距、主题在设置里调，会记住上次读到的位置。',
      },
      {
        n: '03',
        t: '随时带走',
        d: '单篇导出 Markdown，或者整库打成 zip。数据只在这台机器上，卸载前记得导出。',
      },
    ],
    privacyH: '关于隐私',
    privacyB:
      '拾页没有服务器，不建账号，不统计你的阅读行为。除了你自己填了 Key 之后主动点的那次 AI 摘要，它不会向任何地方发送内容。',
    adsH: '关于广告',
    adsB:
      '书架底部和文章末尾各有一个赞助位，都标着 SPONSORED，点 × 可以永久关掉；设置页还有总开关。关掉之后，功能完全不变。',
    done: '开始使用',
    shortcuts: '修改快捷键',
  },
  en: {
    brand: 'Shelf',
    title: 'Shelf is ready',
    lead: 'Three moves, and you can forget it exists.',
    steps: [
      {
        n: '01',
        t: 'Press Alt+S on any page',
        d: 'The article is extracted and filed into the side panel shelf. The toolbar icon does the same thing.',
      },
      {
        n: '02',
        t: 'Read it in the side panel',
        d: 'Full-text search, tags, unread filter. Type size, leading and theme live in settings. It remembers where you stopped.',
      },
      {
        n: '03',
        t: 'Take it with you',
        d: 'Export one article as Markdown, or the whole library as a zip. Your data stays on this machine — export before uninstalling.',
      },
    ],
    privacyH: 'Privacy',
    privacyB:
      'Shelf has no server, no accounts, and does not track what you read. The only outbound request is the summary you trigger yourself after entering your own API key.',
    adsH: 'About ads',
    adsB:
      'There is one sponsored slot at the bottom of the shelf and one at the end of an article. Both are labeled SPONSORED, both can be dismissed forever with ×, and settings has a master switch. Turning them off changes nothing else.',
    done: 'Start using it',
    shortcuts: 'Change shortcut',
  },
} as const;

async function boot() {
  const settings = await getSettings();
  const lang = detectLang(settings.locale);
  const c = COPY[lang];

  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = c.brand;

  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  set('brand', c.brand);
  set('title', c.title);
  set('lead', c.lead);
  set('privacy-h', c.privacyH);
  set('privacy-b', c.privacyB);
  set('ads-h', c.adsH);
  set('ads-b', c.adsB);

  const steps = document.getElementById('steps');
  if (steps) {
    steps.innerHTML = c.steps
      .map(
        (s) => `<div class="w-step">
          <div class="w-step-n">${s.n}</div>
          <p class="w-step-t">${s.t}</p>
          <p class="w-step-d">${s.d}</p>
        </div>`,
      )
      .join('');
  }

  const done = document.getElementById('done');
  if (done) {
    done.textContent = c.done;
    done.addEventListener('click', async () => {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) await chrome.tabs.remove(tab.id);
      else window.close();
    });
  }

  const shortcuts = document.getElementById('shortcuts');
  if (shortcuts) {
    // chrome://extensions/shortcuts 在 Firefox 不存在，而 about:addons 又不允许
    // 扩展直接打开，所以这条入口只在 Chrome 系显示。
    if (IS_FIREFOX) {
      shortcuts.style.display = 'none';
    } else {
      shortcuts.textContent = c.shortcuts;
      shortcuts.addEventListener('click', () => {
        void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      });
    }
  }
}

void boot();
