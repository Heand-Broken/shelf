import type { AppCtx } from '../app';
import { db } from '../lib/db';
import { esc, qs } from '../lib/dom';
import { AI_ENDPOINTS, type AiProvider, type ThemeMode } from '../lib/settings';
import { ensureAiPermission } from '../lib/ai';
import { libraryToMarkdown, libraryToZip, download } from '../lib/exporter';
import { parseBookmarkHtml, importLinks } from '../lib/importer';
import { stats } from '../lib/db';

function opt(value: string, label: string, current: string): string {
  return `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;
}

export async function mountSettings(root: HTMLElement, ctx: AppCtx): Promise<void> {
  const { t, lang, settings } = ctx;
  const s = await stats();
  const ai = settings.ai;
  const ep = AI_ENDPOINTS[ai.provider];

  root.innerHTML = `<div class="settings">

    <section class="setting-section">
      <h3 class="setting-heading">${esc(t('settings.appearance'))}</h3>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.theme'))}</span>
        <select class="select" data-set="theme">
          ${opt('auto', t('settings.theme.auto'), settings.theme)}
          ${opt('light', t('settings.theme.light'), settings.theme)}
          ${opt('sepia', t('settings.theme.sepia'), settings.theme)}
          ${opt('dark', t('settings.theme.dark'), settings.theme)}
        </select>
      </div>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.fontSize'))}</span>
        <div style="display:flex;align-items:center;gap:7px;">
          <input class="range" type="range" min="13" max="22" step="1" value="${settings.fontSize}" data-set="fontSize" />
          <span class="setting-value" id="fs-val">${settings.fontSize}px</span>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.lineHeight'))}</span>
        <div style="display:flex;align-items:center;gap:7px;">
          <input class="range" type="range" min="1.4" max="2.1" step="0.05" value="${settings.lineHeight}" data-set="lineHeight" />
          <span class="setting-value" id="lh-val">${settings.lineHeight.toFixed(2)}</span>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.fontFamily'))}</span>
        <select class="select" data-set="fontFamily">
          ${opt('serif', t('settings.fontFamily.serif'), settings.fontFamily)}
          ${opt('sans', t('settings.fontFamily.sans'), settings.fontFamily)}
        </select>
      </div>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.language'))}</span>
        <select class="select" data-set="locale">
          ${opt('auto', lang === 'zh' ? '跟随浏览器' : 'Browser default', settings.locale)}
          ${opt('zh', '中文', settings.locale)}
          ${opt('en', 'English', settings.locale)}
        </select>
      </div>
    </section>

    <section class="setting-section">
      <h3 class="setting-heading">${esc(t('settings.ads'))}</h3>
      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.ads.show'))}</span>
        <label class="switch"><input type="checkbox" data-set="showAds" ${settings.showAds ? 'checked' : ''}/><span></span></label>
      </div>
      <p class="setting-hint">${esc(t('settings.ads.hint'))}</p>
      <div style="border:0.5px solid var(--line-strong);border-radius:var(--radius);padding:9px 11px;margin-bottom:12px;">
        <div style="font-size:12px;font-weight:500;">${esc(t('settings.ads.pro'))}</div>
        <div class="setting-hint" style="margin:3px 0 0;">${esc(t('settings.ads.proHint'))}</div>
      </div>
    </section>

    <section class="setting-section">
      <h3 class="setting-heading">${esc(t('settings.ai'))}</h3>
      <p class="setting-hint" style="margin-top:0;">${esc(t('settings.ai.hint'))}</p>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.ai.provider'))}</span>
        <select class="select" data-set="aiProvider">
          ${(Object.keys(AI_ENDPOINTS) as AiProvider[])
            .map((k) => opt(k, AI_ENDPOINTS[k].label, ai.provider))
            .join('')}
        </select>
      </div>

      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.ai.model'))}</span>
        <select class="select" data-set="aiModel">
          ${ep.models.map((m) => opt(m, m, ai.model)).join('')}
        </select>
      </div>

      <div class="setting-row" style="display:block;">
        <div class="setting-label" style="margin-bottom:4px;">${esc(t('settings.ai.key'))}</div>
        <div class="key-row">
          <input class="input" type="password" id="ai-key" placeholder="${esc(t('settings.ai.keyPlaceholder'))}" value="${esc(ai.apiKey)}" autocomplete="off" spellcheck="false" />
          <button class="btn" data-act="save-key" type="button">${esc(t('action.saveKey'))}</button>
        </div>
        <p class="setting-hint">${esc(t('settings.ai.privacy'))}</p>
      </div>
    </section>

    <section class="setting-section">
      <h3 class="setting-heading">${esc(t('settings.data'))}</h3>
      <div class="setting-row">
        <span class="setting-label">${esc(t('settings.stats'))}</span>
        <span class="setting-value">${s.total} / ${s.unread} / ${s.starred}</span>
      </div>
      <div class="setting-actions">
        <button class="btn" data-act="export-zip" type="button">${esc(t('settings.data.exportZip'))}</button>
        <button class="btn" data-act="export-md" type="button">${esc(t('settings.data.exportAll'))}</button>
        <button class="btn" data-act="export-json" type="button">${esc(t('settings.data.exportJson'))}</button>
        <button class="btn" data-act="import" type="button">${esc(t('settings.data.import'))}</button>
      </div>
      <p class="setting-hint">${esc(t('settings.data.hint'))}</p>
      <input type="file" id="import-file" accept=".html,.htm,text/html" style="display:none" />
    </section>

    <section class="setting-section">
      <h3 class="setting-heading">${esc(t('settings.about'))}</h3>
      <p class="setting-hint" style="margin-top:0;">${esc(t('settings.about.body'))}</p>
      <p class="setting-hint" style="opacity:.7;">Shelf 0.1.0 · MV3</p>
    </section>
  </div>`;

  const fsVal = qs('#fs-val', root);
  const lhVal = qs('#lh-val', root);

  root.addEventListener('change', async (ev) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement;
    const key = el.dataset.set;
    if (!key) return;

    if (key === 'theme') {
      await ctx.updateSettings({ theme: el.value as ThemeMode });
      return;
    }
    if (key === 'fontSize') {
      const v = Number(el.value);
      fsVal.textContent = `${v}px`;
      await ctx.updateSettings({ fontSize: v });
      return;
    }
    if (key === 'lineHeight') {
      const v = Number(el.value);
      lhVal.textContent = v.toFixed(2);
      await ctx.updateSettings({ lineHeight: v });
      return;
    }
    if (key === 'fontFamily') {
      await ctx.updateSettings({ fontFamily: el.value as 'serif' | 'sans' });
      return;
    }
    if (key === 'locale') {
      await ctx.updateSettings({ locale: el.value as 'auto' | 'zh' | 'en' });
      window.location.reload();
      return;
    }
    if (key === 'showAds') {
      await ctx.updateSettings({ showAds: (el as HTMLInputElement).checked });
      return;
    }
    if (key === 'aiProvider') {
      const provider = el.value as AiProvider;
      await ctx.updateSettings({
        ai: { provider, apiKey: '', model: AI_ENDPOINTS[provider].models[0] },
      });
      ctx.toast(lang === 'zh' ? '换服务商了，Key 需要重填' : 'Provider changed — re-enter the key');
      await ctx.navigate('settings');
      return;
    }
    if (key === 'aiModel') {
      await ctx.updateSettings({ ai: { ...ai, model: el.value } });
      return;
    }
  });

  root.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el.dataset.set === 'fontSize') fsVal.textContent = `${el.value}px`;
    if (el.dataset.set === 'lineHeight') lhVal.textContent = Number(el.value).toFixed(2);
  });

  root.addEventListener('click', async (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'save-key') {
      const input = qs<HTMLInputElement>('#ai-key', root);
      const key = input.value.trim();
      if (!key) return;
      const cfg = { ...ctx.settings.ai, apiKey: key };
      const granted = await ensureAiPermission(cfg);
      if (!granted) {
        ctx.toast(t('toast.permDenied'));
        return;
      }
      await ctx.updateSettings({ ai: cfg });
      ctx.toast(t('toast.keySaved'));
      return;
    }

    if (act === 'export-zip') {
      const items = await db.items.toArray();
      if (!items.length) {
        ctx.toast(lang === 'zh' ? '书架是空的' : 'Nothing to export yet');
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      download(`shelf-${stamp}.zip`, libraryToZip(items));
      ctx.toast(t('toast.exported'));
      return;
    }

    if (act === 'export-md') {
      const items = await db.items.toArray();
      const stamp = new Date().toISOString().slice(0, 10);
      download(`shelf-${stamp}.md`, libraryToMarkdown(items), 'text/markdown;charset=utf-8');
      ctx.toast(t('toast.exported'));
      return;
    }

    if (act === 'export-json') {
      const items = await db.items.toArray();
      const stamp = new Date().toISOString().slice(0, 10);
      download(`shelf-backup-${stamp}.json`, JSON.stringify({ version: 1, exportedAt: Date.now(), items }, null, 2), 'application/json');
      ctx.toast(t('toast.exported'));
      return;
    }

    if (act === 'import') {
      qs<HTMLInputElement>('#import-file', root).click();
      return;
    }
  });

  const fileInput = qs<HTMLInputElement>('#import-file', root);
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    btnBusy(true);
    try {
      const text = await file.text();
      const links = parseBookmarkHtml(text);
      if (!links.length) {
        ctx.toast(lang === 'zh' ? '没解析到链接' : 'No links found');
        return;
      }
      const res = await importLinks(links);
      ctx.toast(`${t('toast.imported')} +${res.added}${res.skipped ? ` · skip ${res.skipped}` : ''}`);
      await ctx.navigate('shelf');
    } catch (err) {
      ctx.toast(String(err));
    } finally {
      btnBusy(false);
      fileInput.value = '';
    }
  });

  function btnBusy(busy: boolean) {
    const btn = root.querySelector<HTMLButtonElement>('[data-act="import"]');
    if (btn) {
      btn.disabled = busy;
      btn.textContent = busy
        ? lang === 'zh' ? '导入中…' : 'Importing…'
        : t('settings.data.import');
    }
  }
}
