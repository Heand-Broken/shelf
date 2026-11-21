import type { AppCtx } from '../app';
import { db } from '../lib/db';
import { esc, hostOf, qs, timeAgo } from '../lib/dom';
import { sanitizeHtml } from '../lib/sanitize';
import { readingMinutes } from '../lib/extract';
import { itemToMarkdown, itemToHtmlDocument, download, slugify } from '../lib/exporter';
import { pickAd, dismissAd, trackImpression, trackClick } from '../lib/ads';
import { AiError, summarize } from '../lib/ai';

const ICONS = {
  star: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6 4.16 13.6 4.9 9.3 1.8 6.3l4.3-.6z"/></svg>',
  starOn: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .74 4.3L8 11.6 4.16 13.6 4.9 9.3 1.8 6.3l4.3-.6z"/></svg>',
  ai: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4.2 4.2l2 2M9.8 9.8l2 2M11.8 4.2l-2 2M6.2 9.8l-2 2"/></svg>',
  download: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2v8M5 7.5L8 11l3-3.5M2.5 13.5h11"/></svg>',
  trash: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.2h6.6L12 4"/></svg>',
  back: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3L5 8l5 5"/></svg>',
};

export async function mountReader(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const { t, lang } = ctx;

  if (!ctx.state.currentId) {
    root.innerHTML = `<div class="empty"><p class="empty-title">${esc(t('empty.reader'))}</p></div>`;
    return;
  }

  const item = await db.items.get(ctx.state.currentId);
  if (!item) {
    root.innerHTML = `<div class="empty"><p class="empty-title">${esc(t('empty.reader'))}</p></div>`;
    return;
  }

  const hasBody = Boolean(item.contentHtml || item.contentText);
  const bodyHtml = hasBody
    ? sanitizeHtml(item.contentHtml || `<p>${esc(item.contentText)}</p>`, item.url)
    : '';

  root.innerHTML = `<div class="reader">
    <div class="reader-head">
      <button class="btn btn-icon" data-act="back" title="${esc(t('action.back'))}" type="button">${ICONS.back}</button>
      <button class="btn btn-sm" data-act="toggle-read" type="button">${esc(item.read ? t('action.markUnread') : t('action.markRead'))}</button>
      <button class="btn btn-icon" data-act="star" title="${esc(t('action.star'))}" type="button">${item.starred ? ICONS.starOn : ICONS.star}</button>
      <span class="spacer"></span>
      <button class="btn btn-icon" data-act="summary" title="${esc(t('action.summarize'))}" type="button">${ICONS.ai}</button>
      <button class="btn btn-icon" data-act="export" title="${esc(t('action.export'))}" type="button">${ICONS.download}</button>
      <button class="btn btn-icon btn-danger" data-act="delete" title="${esc(t('action.delete'))}" type="button">${ICONS.trash}</button>
    </div>
    <h1 class="reader-title">${esc(item.title)}</h1>
    <div class="reader-meta">
      <span>${esc(hostOf(item.url))}</span>
      ${item.byline ? `<span>·</span><span>${esc(item.byline)}</span>` : ''}
      <span>·</span><span>${esc(timeAgo(item.createdAt, lang))}</span>
      ${item.wordCount ? `<span>·</span><span>${readingMinutes(item)} ${esc(t('meta.minutes'))}</span>` : ''}
      ${item.tags.length ? `<span>·</span><span>${esc(item.tags.join(' / '))}</span>` : ''}
    </div>
    <div id="summary-slot">${
      item.summary
        ? `<div class="summary-box"><span class="summary-label">AI Summary</span>${esc(item.summary)}</div>`
        : ''
    }</div>
    <div class="reader-body${ctx.settings.fontFamily === 'sans' ? ' is-sans' : ''}" id="reader-body">${
      hasBody ? bodyHtml : `<p class="setting-hint">${esc(t('meta.uncaptured'))}</p>`
    }</div>
    <div style="padding:0 12px 30px;"><button class="btn" data-act="open" type="button">${esc(t('action.openOriginal'))} ↗</button></div>
    <div id="ad-slot"></div>
  </div>`;

  const adSlot = qs('#ad-slot', root);
  const ad = await pickAd('reader-end', ctx.settings.showAds);
  if (ad) {
    void trackImpression(ad.id);
    adSlot.innerHTML = `<div class="ad-card" data-ad="${esc(ad.id)}">
      <span class="ad-label">Sponsored · ${esc(ad.sponsor)}</span>
      <button class="ad-close" data-ad-dismiss="${esc(ad.id)}" aria-label="dismiss" type="button">×</button>
      <div class="ad-title">${esc(ctx.t(ad.titleKey))}</div>
      <div class="ad-body">${esc(ctx.t(ad.bodyKey))}</div>
      <a class="ad-cta" href="${esc(ad.url)}" target="_blank" rel="noopener noreferrer" data-ad-click="${esc(ad.id)}">${esc(ctx.t(ad.ctaKey))} ↗</a>
    </div>`;

    adSlot.querySelector<HTMLButtonElement>('[data-ad-dismiss]')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      await dismissAd(ad.id);
      adSlot.innerHTML = '';
    });
    adSlot.querySelector<HTMLAnchorElement>('[data-ad-click]')?.addEventListener('click', () => {
      void trackClick(ad.id);
    });
  }

  const bodyEl = qs('#reader-body', root);
  bodyEl.classList.toggle('is-sans', ctx.settings.fontFamily === 'sans');

  // 阅读进度：回到上次读到的地方。图片加载会改变高度，所以延迟一次再校准。
  const savedProgress = item.progress ?? 0;
  if (savedProgress > 0.02) {
    const restore = () => {
      const max = root.scrollHeight - root.clientHeight;
      if (max > 0) root.scrollTop = Math.min(max, savedProgress * max);
    };
    requestAnimationFrame(() => window.setTimeout(restore, 200));
  }

  let progressTimer: number | undefined;
  root.addEventListener(
    'scroll',
    () => {
      if (progressTimer) window.clearTimeout(progressTimer);
      progressTimer = window.setTimeout(() => {
        const max = root.scrollHeight - root.clientHeight;
        if (max <= 0 || !item.id) return;
        const p = Math.min(1, Math.max(0, root.scrollTop / max));
        if (Math.abs(p - (item.progress ?? 0)) < 0.01) return;
        item.progress = p;
        void db.items.update(item.id, { progress: p });
      }, 700);
    },
    { passive: true },
  );

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'back') {
      await ctx.navigate('shelf');
      return;
    }

    if (act === 'open') {
      await chrome.tabs.create({ url: item.url });
      return;
    }

    if (act === 'toggle-read') {
      item.read = item.read ? 0 : 1;
      item.readAt = item.read ? Date.now() : null;
      item.updatedAt = Date.now();
      await db.items.put(item);
      btn.textContent = item.read ? t('action.markUnread') : t('action.markRead');
      ctx.toast(item.read ? t('action.markRead') : t('action.markUnread'));
      return;
    }

    if (act === 'star') {
      item.starred = item.starred ? 0 : 1;
      item.updatedAt = Date.now();
      await db.items.put(item);
      btn.innerHTML = item.starred ? ICONS.starOn : ICONS.star;
      return;
    }

    if (act === 'export') {
      const target = ev.altKey ? 'html' : 'md';
      if (target === 'html') {
        download(`${slugify(item.title)}.html`, itemToHtmlDocument(item), 'text/html;charset=utf-8');
      } else {
        download(`${slugify(item.title)}.md`, itemToMarkdown(item), 'text/markdown;charset=utf-8');
      }
      ctx.toast(t('toast.exported'));
      return;
    }

    if (act === 'delete') {
      const ok = window.confirm(lang === 'zh' ? '删除这一条？无法撤销。' : 'Delete this entry? This cannot be undone.');
      if (!ok) return;
      await db.items.delete(item.id as number);
      ctx.toast(t('toast.deleted'));
      ctx.state.currentId = null;
      await ctx.navigate('shelf');
      return;
    }

    if (act === 'summary') {
      const cfg = ctx.settings.ai;
      if (!cfg.apiKey) {
        ctx.toast(lang === 'zh' ? '先去设置里填 API Key' : 'Add an API key in settings first');
        await ctx.navigate('settings');
        return;
      }
      btn.disabled = true;
      const original = btn.innerHTML;
      btn.textContent = '…';
      try {
        const text = await summarize(item, cfg, lang);
        item.summary = text;
        item.summaryModel = cfg.model;
        item.updatedAt = Date.now();
        await db.items.put(item);
        qs('#summary-slot', root).innerHTML = `<div class="summary-box"><span class="summary-label">AI Summary</span>${esc(text)}</div>`;
      } catch (err) {
        const msg = err instanceof AiError ? err.message : String(err);
        ctx.toast(msg);
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  });
}
