import { getSettings, patchSettings, type Settings } from './lib/settings';
import { detectLang, translator, type Lang, type T } from './lib/i18n';
import { qs, qsa } from './lib/dom';
import { grabPage, parseSnapshot, type Snapshot } from './lib/extract';
import { saveItem } from './lib/db';
import { IS_FIREFOX, hasHostAccess } from './lib/platform';
import type { AppCtx, State, View } from './app';
import { mountShelf } from './views/shelf';
import { mountReader } from './views/reader';
import { mountSettings } from './views/settings';

let settings: Settings;
let lang: Lang;
let t: T;
let refreshFn: () => Promise<void> = async () => {};
let toastTimer: number | undefined;

const state: State = {
  view: 'shelf',
  query: '',
  filter: 'all',
  tag: null,
  currentId: null,
};

function toast(message: string): void {
  const el = qs('#toast');
  el.textContent = message;
  el.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), 2800);
}

function applyTheme(): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.documentElement.title = t('app.name');
  const root = document.documentElement.style;
  root.setProperty('--read-size', `${settings.fontSize}px`);
  root.setProperty('--read-leading', String(settings.lineHeight));
  root.setProperty('--measure', String(settings.measure));
}

function syncTabs(): void {
  qsa<HTMLButtonElement>('.tab').forEach((el) => {
    const view = el.dataset.view as View;
    el.classList.toggle('is-active', view === state.view);
    el.disabled = view === 'reader' && !state.currentId;
  });
}

async function navigate(view: View): Promise<void> {
  state.view = view;
  await render();
}

async function render(): Promise<void> {
  syncTabs();
  const old = document.getElementById('main');
  if (!old) return;
  // 每次换一个干净的容器，避免 views 挂在同一节点上的监听器累积
  const main = document.createElement('main');
  main.id = 'main';
  main.className = 'main';
  main.setAttribute('role', 'tabpanel');
  old.replaceWith(main);

  refreshFn = async () => {};
  if (state.view === 'shelf') await mountShelf(main, ctx);
  else if (state.view === 'reader') await mountReader(main, ctx);
  else await mountSettings(main, ctx);
  main.scrollTop = 0;
}

async function openItem(id: number): Promise<void> {
  state.currentId = id;
  await navigate('reader');
}

async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settings = await patchSettings(patch);
  lang = detectLang(settings.locale);
  t = translator(lang);
  applyTheme();
  syncChrome();
  if (state.view === 'reader') await render();
}

function syncChrome(): void {
  const brand = document.querySelector('.brand-name');
  if (brand) brand.textContent = t('app.name');
  const saveBtn = document.querySelector('#btn-save');
  if (saveBtn && !saveBtn.hasAttribute('data-busy')) saveBtn.textContent = t('action.save');
  const tabs = qsa<HTMLButtonElement>('.tab');
  const labels: Record<View, string> = {
    shelf: t('nav.shelf'),
    reader: t('nav.reader'),
    settings: t('nav.settings'),
  };
  tabs.forEach((el) => {
    const view = el.dataset.view as View;
    el.textContent = labels[view];
  });
}

async function saveCurrentPage(tabId?: number): Promise<{ ok: boolean; message: string }> {
  const btn = qs<HTMLButtonElement>('#btn-save');
  const prevLabel = btn.textContent || t('action.save');
  btn.disabled = true;
  btn.setAttribute('data-busy', '1');
  btn.textContent = t('action.saving');

  try {
    let targetId = tabId;
    if (!targetId) {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      targetId = tab?.id;
    }
    if (!targetId) throw new Error(t('toast.noTab'));

    const [res] = await chrome.scripting.executeScript({
      target: { tabId: targetId },
      func: grabPage,
    });
    const snap = res?.result as Snapshot | undefined;
    if (!snap || !snap.html) throw new Error(t('toast.noTab'));

    const parsed = parseSnapshot(snap);
    if (!parsed) throw new Error(t('toast.failed'));

    const { created } = await saveItem(parsed);
    toast(created ? t('toast.saved') : t('toast.updated'));
    await refreshFn();
    return { ok: true, message: created ? t('toast.saved') : t('toast.updated') };
  } catch (err) {
    // Firefox 默认不授予 host_permissions，未授权时注入会失败。
    // 这里把它和"页面本身不可读"区分开，否则用户完全不知道要去哪里点。
    if (IS_FIREFOX && !(await hasHostAccess())) {
      const need =
        lang === 'zh'
          ? '还没授权：打开 about:addons → 拾页 → 权限，勾选「访问所有网站」'
          : 'Not authorized yet: about:addons → Shelf → Permissions → allow access to all sites';
      toast(need);
      return { ok: false, message: need };
    }
    const raw = err instanceof Error ? err.message : String(err);
    const friendly = /Cannot access|Cannot access contents|chrome:\/\//i.test(raw) ? t('toast.noTab') : raw;
    toast(`${t('toast.failed')} · ${friendly}`);
    return { ok: false, message: friendly };
  } finally {
    btn.disabled = false;
    btn.removeAttribute('data-busy');
    btn.textContent = prevLabel;
  }
}

const ctx = {
  get lang(): Lang {
    return lang;
  },
  get t(): T {
    return t;
  },
  get settings(): Settings {
    return settings;
  },
  state,
  navigate,
  openItem,
  refresh: async () => refreshFn(),
  setRefresh(fn: () => Promise<void>) {
    refreshFn = fn;
  },
  toast,
  updateSettings,
  saveCurrentPage,
} as unknown as AppCtx;

async function consumePending(): Promise<void> {
  try {
    const pending = (await chrome.runtime.sendMessage({ type: 'get-pending-save' })) as
      | { tabId: number; at: number }
      | null;
    if (!pending?.tabId) return;
    await chrome.runtime.sendMessage({ type: 'clear-pending-save' });
    await saveCurrentPage(pending.tabId);
  } catch {
    /* service worker 未就绪时静默跳过 */
  }
}

async function bootstrap(): Promise<void> {
  settings = await getSettings();
  lang = detectLang(settings.locale);
  t = translator(lang);
  applyTheme();
  syncChrome();

  qsa<HTMLButtonElement>('.tab').forEach((el) => {
    el.addEventListener('click', () => {
      const view = el.dataset.view as View;
      void navigate(view);
    });
  });

  qs('#btn-save').addEventListener('click', () => {
    void saveCurrentPage();
  });

  await render();
  await consumePending();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'pending-save') void consumePending();
});

chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.pendingSave) void consumePending();
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === '/' && state.view === 'shelf') {
    const q = document.querySelector<HTMLInputElement>('#q');
    if (q && document.activeElement !== q) {
      ev.preventDefault();
      q.focus();
    }
  }
  if (ev.key === 'Escape' && state.view !== 'shelf') {
    void navigate('shelf');
  }
});

void bootstrap();
