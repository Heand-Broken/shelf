import type { TKey } from './i18n';

export type AdSlotId = 'shelf-footer' | 'reader-end';

export interface AdCreative {
  id: string;
  slot: AdSlotId;
  sponsor: string;
  titleKey: TKey;
  bodyKey: TKey;
  ctaKey: TKey;
  url: string;
  active: boolean;
}

/**
 * 广告目录。V1 只放自有推广，接入外部赞助商时往这里加条目即可，
 * 渲染层不需要改动。字段故意保持最简，便于日后从后端下发 JSON。
 * 文案必须走 i18n key —— 赞助内容会出现在英文界面里，不能硬编码中文。
 */
export const AD_CATALOG: AdCreative[] = [
  {
    id: 'shelf-pro-early',
    slot: 'shelf-footer',
    sponsor: 'Shelf',
    titleKey: 'ad.pro.title',
    bodyKey: 'ad.pro.body',
    ctaKey: 'ad.pro.cta',
    url: 'https://heand-broken.github.io/shelf-site/pro.html',
    active: true,
  },
  {
    id: 'slot-reserved',
    slot: 'reader-end',
    sponsor: 'Shelf',
    titleKey: 'ad.slot.title',
    bodyKey: 'ad.slot.body',
    ctaKey: 'ad.slot.cta',
    url: 'https://example.com/sponsor?utm_source=shelf&utm_medium=reader',
    active: false,
  },
];

const DISMISS_KEY = 'adsDismissed';
const STATS_KEY = 'adsStats';
const SEEN_KEY = 'adsImpressionSeen';

interface AdStats {
  [creativeId: string]: { impressions: number; clicks: number; firstSeen: number; lastSeen: number };
}

async function readDismissed(): Promise<string[]> {
  const got = await chrome.storage.local.get(DISMISS_KEY);
  return (got[DISMISS_KEY] as string[]) || [];
}

export async function dismissAd(creativeId: string): Promise<void> {
  const list = await readDismissed();
  if (!list.includes(creativeId)) {
    list.push(creativeId);
    await chrome.storage.local.set({ [DISMISS_KEY]: list });
  }
}

async function readStats(): Promise<AdStats> {
  const got = await chrome.storage.local.get(STATS_KEY);
  return (got[STATS_KEY] as AdStats) || {};
}

export async function pickAd(slot: AdSlotId, showAds: boolean): Promise<AdCreative | null> {
  if (!showAds) return null;
  const dismissed = await readDismissed();
  const candidate = AD_CATALOG.find(
    (a) => a.slot === slot && a.active && !dismissed.includes(a.id),
  );
  return candidate || null;
}

/**
 * 曝光只记在本地，不上报任何服务器。
 * 同一浏览器会话内同一条创意只计一次，否则切换筛选、来回切视图会把数字刷成假的。
 */
export async function trackImpression(creativeId: string): Promise<void> {
  const gotSeen = await chrome.storage.session.get(SEEN_KEY);
  const seen = (gotSeen[SEEN_KEY] as string[]) || [];
  if (seen.includes(creativeId)) return;
  seen.push(creativeId);
  await chrome.storage.session.set({ [SEEN_KEY]: seen });

  const stats = await readStats();
  const now = Date.now();
  const row = stats[creativeId] || { impressions: 0, clicks: 0, firstSeen: now, lastSeen: now };
  row.impressions += 1;
  row.lastSeen = now;
  stats[creativeId] = row;
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

export async function trackClick(creativeId: string): Promise<void> {
  const stats = await readStats();
  const now = Date.now();
  const row = stats[creativeId] || { impressions: 0, clicks: 0, firstSeen: now, lastSeen: now };
  row.clicks += 1;
  row.lastSeen = now;
  stats[creativeId] = row;
  await chrome.storage.local.set({ [STATS_KEY]: stats });
}

export async function adStats(): Promise<AdStats> {
  return readStats();
}
