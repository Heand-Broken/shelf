import type { AppCtx, View } from '../app';
import { getAllTags, searchItems, stats, db, type Item } from '../lib/db';
import { esc, highlight, qs, debounce, timeAgo } from '../lib/dom';
import { pickAd, dismissAd, trackImpression, trackClick } from '../lib/ads';

function itemRow(it: Item, query: string, lang: 'zh' | 'en'): string {
  const bits: string[] = [];
  if (it.siteName) bits.push(esc(it.siteName));
  bits.push(timeAgo(it.createdAt, lang));

  const tags = (it.tags || [])
    .slice(0, 3)
    .map((tg) => `<span class="item-tag">${esc(tg)}</span>`)
    .join('');

  return `<button class="item${it.read ? ' is-read' : ''}${it.starred ? ' has-star' : ''}" data-id="${it.id}" type="button">
    <div class="item-title">${highlight(it.title, query)}</div>
    <div class="item-meta">${bits.map((b) => b).join('<span class="item-dot">·</span>')}</div>
    ${tags ? `<div class="item-tags">${tags}</div>` : ''}
  </button>`;
}

async function adBlock(ctx: AppCtx): Promise<string> {
  const ad = await pickAd('shelf-footer', ctx.settings.showAds);
  if (!ad) return '';
  void trackImpression(ad.id);
  return `<div class="ad-card" data-ad="${esc(ad.id)}">
    <span class="ad-label">Sponsored · ${esc(ad.sponsor)}</span>
    <button class="ad-close" data-ad-dismiss="${esc(ad.id)}" aria-label="dismiss" type="button">×</button>
    <div class="ad-title">${esc(ctx.t(ad.titleKey))}</div>
    <div class="ad-body">${esc(ctx.t(ad.bodyKey))}</div>
    <a class="ad-cta" href="${esc(ad.url)}" target="_blank" rel="noopener noreferrer" data-ad-click="${esc(ad.id)}">${esc(ctx.t(ad.ctaKey))} ↗</a>
  </div>`;
}

export async function mountShelf(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const { t, lang } = ctx;

  root.innerHTML = `<div class="search-wrap">
      <input id="q" class="search-input" type="search" placeholder="${esc(t('search.placeholder'))}" value="${esc(ctx.state.query)}" />
      <div class="chips" id="chips"></div>
    </div>
    <div class="list" id="list"><div class="skeleton">…</div></div>
    <div id="ad-slot"></div>`;

  const qInput = qs<HTMLInputElement>('#q', root);
  const chips = qs('#chips', root);
  const list = qs('#list', root);
  const adSlot = qs('#ad-slot', root);

  async function renderChips() {
    const s = await stats();
    const tags = await getAllTags();
    const mk = (key: string, label: string, count: number | null, active: boolean) =>
      `<button class="chip${active ? ' is-active' : ''}" data-chip="${esc(key)}" type="button">${esc(label)}${
        count === null ? '' : `<span class="chip-count">${count}</span>`
      }</button>`;

    const parts = [
      mk('all', t('filter.all'), s.total, ctx.state.filter === 'all' && !ctx.state.tag),
      mk('unread', t('filter.unread'), s.unread, ctx.state.filter === 'unread'),
      mk('starred', t('filter.starred'), s.starred, ctx.state.filter === 'starred'),
    ];
    for (const tg of tags.slice(0, 8)) {
      parts.push(mk(`tag:${tg.tag}`, tg.tag, tg.n, ctx.state.tag === tg.tag));
    }
    chips.innerHTML = parts.join('');
  }

  async function renderList() {
    let items = await searchItems(ctx.state.query);
    if (ctx.state.filter === 'unread') items = items.filter((i) => !i.read);
    if (ctx.state.filter === 'starred') items = items.filter((i) => i.starred);
    if (ctx.state.tag) items = items.filter((i) => (i.tags || []).includes(ctx.state.tag as string));

    if (!items.length) {
      const searching = Boolean(ctx.state.query.trim()) || ctx.state.tag || ctx.state.filter !== 'all';
      list.innerHTML = `<div class="empty">
        <p class="empty-title">${esc(searching ? t('empty.search') : t('empty.title'))}</p>
        <p class="empty-body">${esc(searching ? '' : t('empty.body'))}</p>
      </div>`;
    } else {
      list.innerHTML = items.map((it) => itemRow(it, ctx.state.query, lang)).join('');
    }

    // 空书架不投广告：新用户前几次打开看到的都是空状态，此时塞广告换不来收入，只换来卸载
    adSlot.innerHTML = items.length ? await adBlock(ctx) : '';

    const closeBtn = adSlot.querySelector<HTMLButtonElement>('[data-ad-dismiss]');
    closeBtn?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const id = closeBtn.dataset.adDismiss;
      if (id) {
        await dismissAd(id);
        adSlot.innerHTML = '';
        ctx.toast(lang === 'zh' ? '已隐藏该赞助位' : 'Sponsor hidden');
      }
    });

    const clickLink = adSlot.querySelector<HTMLAnchorElement>('[data-ad-click]');
    clickLink?.addEventListener('click', () => {
      const id = clickLink.dataset.adClick;
      if (id) void trackClick(id);
    });
  }

  list.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.item');
    if (!btn?.dataset.id) return;
    await ctx.openItem(Number(btn.dataset.id));
  });

  chips.addEventListener('click', async (ev) => {
    const chip = (ev.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    const key = chip?.dataset.chip;
    if (!key) return;
    if (key.startsWith('tag:')) {
      const tag = key.slice(4);
      ctx.state.tag = ctx.state.tag === tag ? null : tag;
      ctx.state.filter = 'all';
    } else {
      ctx.state.tag = null;
      ctx.state.filter = key as 'all' | 'unread' | 'starred';
    }
    await renderChips();
    await renderList();
  });

  qInput.addEventListener(
    'input',
    debounce(() => {
      ctx.state.query = qInput.value;
      void renderList();
    }),
  );

  ctx.setRefresh(async () => {
    ctx.state.query = qInput.value;
    await renderChips();
    await renderList();
  });

  await renderChips();
  await renderList();

  if (ctx.state.query) qInput.focus();
}

export async function refreshShelfBadge(): Promise<number> {
  return db.items.where('read').equals(0).count();
}

export type { View };
