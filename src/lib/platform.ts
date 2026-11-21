declare const __FIREFOX__: boolean;

/** 构建期注入。Chrome 与 Firefox 共用同一份源码，差异集中在这个文件。 */
export const IS_FIREFOX = typeof __FIREFOX__ !== 'undefined' && __FIREFOX__ === true;

type SidebarApi = {
  open?: () => Promise<void>;
  close?: () => Promise<void>;
  setPanel?: (details: { panel: string }) => Promise<void>;
};

function sidebarApi(): SidebarApi | null {
  const g = globalThis as unknown as { browser?: { sidebarAction?: SidebarApi } };
  return g.browser?.sidebarAction ?? null;
}

/** Chrome：点工具栏图标直接开侧边栏。Firefox 没有这个开关，改由 action.onClicked 接管。 */
export async function initSidebarBehavior(): Promise<void> {
  if (IS_FIREFOX) return;
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    /* 旧版本不支持时忽略 */
  }
}

export async function openSidebar(tabId?: number): Promise<void> {
  if (!IS_FIREFOX) {
    try {
      if (tabId) await chrome.sidePanel.open({ tabId });
      else await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      return;
    } catch {
      /* 非用户手势会被拒绝，交给下面的兜底 */
    }
  }
  const sb = sidebarApi();
  if (sb?.open) {
    try {
      await sb.open();
    } catch (err) {
      console.warn('[shelf] sidebar open failed', err);
    }
  }
}

/**
 * Firefox 里没有 setPanelBehavior，点图标必须显式监听起来。
 * 必须在 background 顶层注册，event page 被唤醒时才会重新挂上。
 */
export function registerSidebarFallback(): void {
  if (!IS_FIREFOX) return;
  try {
    chrome.action.onClicked.addListener(() => {
      void openSidebar();
    });
  } catch (err) {
    console.warn('[shelf] action.onClicked unavailable', err);
  }
}

/**
 * Firefox MV3 的 host_permissions 默认不生效，需要用户在 about:addons 里授权。
 * 抓正文失败时用它区分“扩展坏了”和“还没授权”。
 */
export async function hasHostAccess(): Promise<boolean> {
  if (!IS_FIREFOX) return true;
  try {
    return await chrome.permissions.contains({ origins: ['http://*/*', 'https://*/*'] });
  } catch {
    return false;
  }
}
