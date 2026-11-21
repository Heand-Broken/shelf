import { initSidebarBehavior, openSidebar, registerSidebarFallback, IS_FIREFOX } from './lib/platform';

const MENU_SAVE_PAGE = 'shelf-save-page';

const PENDING_KEY = 'pendingSave';
const PENDING_TTL = 60_000;

// 必须在顶层注册：Firefox 的 event page 每次唤醒都会重跑这里
registerSidebarFallback();

async function queueSave(tabId: number, source: 'shortcut' | 'menu') {
  await chrome.storage.session.set({ [PENDING_KEY]: { tabId, at: Date.now(), source } });
  await openSidebar(tabId);
  chrome.runtime.sendMessage({ type: 'pending-save' }).catch(() => {
    /* 侧边栏未打开时无接收方，属正常情况 */
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  void initSidebarBehavior();
  registerSidebarFallback();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SAVE_PAGE,
      title: '保存到拾页 Shelf',
      contexts: ['page', 'selection', 'link'],
    });
  });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') }).catch(() => {});
  }
});

chrome.runtime.onStartup?.addListener(() => {
  void initSidebarBehavior();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'save-page') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id) await queueSave(tab.id, 'shortcut');
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_SAVE_PAGE) return;
  const tabId = tab?.id;
  if (tabId) await queueSave(tabId, 'menu');
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'get-pending-save') {
    chrome.storage.session.get(PENDING_KEY).then((got) => {
      const pending = got[PENDING_KEY] as { tabId: number; at: number; source: string } | undefined;
      if (!pending) return sendResponse(null);
      if (Date.now() - pending.at > PENDING_TTL) {
        chrome.storage.session.remove(PENDING_KEY);
        return sendResponse(null);
      }
      sendResponse(pending);
    });
    return true;
  }
  if (msg?.type === 'clear-pending-save') {
    chrome.storage.session.remove(PENDING_KEY).then(() => sendResponse(true));
    return true;
  }
  if (msg?.type === 'capabilities') {
    sendResponse({ firefox: IS_FIREFOX });
    return false;
  }
  return false;
});
