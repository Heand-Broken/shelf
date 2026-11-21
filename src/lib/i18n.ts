export type Lang = 'zh' | 'en';

const DICT = {
  'app.name': { zh: '拾页', en: 'Shelf' },
  'nav.shelf': { zh: '书架', en: 'Shelf' },
  'nav.reader': { zh: '阅读', en: 'Read' },
  'nav.settings': { zh: '设置', en: 'Settings' },

  'action.save': { zh: '保存这一页', en: 'Save page' },
  'action.saving': { zh: '正在保存…', en: 'Saving…' },
  'action.retry': { zh: '重新抓取', en: 'Re-capture' },
  'action.openOriginal': { zh: '打开原文', en: 'Open original' },
  'action.summarize': { zh: '生成摘要', en: 'Summarize' },
  'action.summarizing': { zh: '生成中…', en: 'Summarizing…' },
  'action.markRead': { zh: '标记已读', en: 'Mark read' },
  'action.markUnread': { zh: '标记未读', en: 'Mark unread' },
  'action.star': { zh: '收藏', en: 'Star' },
  'action.unstar': { zh: '取消收藏', en: 'Unstar' },
  'action.delete': { zh: '删除', en: 'Delete' },
  'action.export': { zh: '导出', en: 'Export' },
  'action.back': { zh: '返回', en: 'Back' },
  'action.import': { zh: '导入书签 / Pocket 导出', en: 'Import bookmarks or Pocket export' },
  'action.chooseFile': { zh: '选择文件', en: 'Choose file' },
  'action.saveKey': { zh: '保存 Key', en: 'Save key' },
  'action.clearKey': { zh: '清除 Key', en: 'Clear key' },

  'search.placeholder': { zh: '搜索标题与正文', en: 'Search titles and text' },
  'filter.all': { zh: '全部', en: 'All' },
  'filter.unread': { zh: '未读', en: 'Unread' },
  'filter.starred': { zh: '收藏', en: 'Starred' },
  'filter.tag': { zh: '标签', en: 'Tags' },

  'empty.title': { zh: '书架还是空的', en: 'Your shelf is empty' },
  'empty.body': {
    zh: '在任意网页按 Alt+S，或者点上面的「保存这一页」。存进来的东西只留在你这台机器上。',
    en: 'Press Alt+S on any page, or hit Save page above. Everything stays on this device.',
  },
  'empty.search': { zh: '没有匹配的条目', en: 'Nothing matches' },
  'empty.reader': { zh: '从书架里挑一条开始读', en: 'Pick something from your shelf' },

  'meta.unread': { zh: '未读', en: 'unread' },
  'meta.total': { zh: '总计', en: 'total' },
  'meta.minutes': { zh: '分钟', en: 'min' },
  'meta.uncaptured': { zh: '仅存了链接，未抓取正文', en: 'Link saved without article text' },

  'toast.saved': { zh: '已存进书架', en: 'Saved to shelf' },
  'toast.updated': { zh: '已更新已有条目', en: 'Updated existing entry' },
  'toast.failed': { zh: '保存失败', en: 'Save failed' },
  'toast.deleted': { zh: '已删除', en: 'Deleted' },
  'toast.exported': { zh: '已开始下载', en: 'Download started' },
  'toast.imported': { zh: '导入完成', en: 'Import finished' },
  'toast.noTab': { zh: '当前标签页不可读取', en: 'This tab cannot be read' },
  'toast.keySaved': { zh: 'Key 已保存在本机', en: 'Key saved locally' },
  'toast.permDenied': { zh: '未授权访问该 API 域名', en: 'Permission for that API domain was denied' },

  'settings.appearance': { zh: '外观', en: 'Appearance' },
  'settings.theme': { zh: '主题', en: 'Theme' },
  'settings.theme.auto': { zh: '跟随系统', en: 'System' },
  'settings.theme.light': { zh: '浅色', en: 'Light' },
  'settings.theme.sepia': { zh: '米黄', en: 'Sepia' },
  'settings.theme.dark': { zh: '深色', en: 'Dark' },
  'settings.fontSize': { zh: '正文字号', en: 'Text size' },
  'settings.lineHeight': { zh: '行距', en: 'Line height' },
  'settings.fontFamily': { zh: '正文字体', en: 'Typeface' },
  'settings.fontFamily.serif': { zh: '衬线', en: 'Serif' },
  'settings.fontFamily.sans': { zh: '无衬线', en: 'Sans' },
  'settings.language': { zh: '界面语言', en: 'Language' },

  'settings.ads': { zh: '广告与赞助', en: 'Ads and sponsorship' },
  'settings.ads.show': { zh: '显示赞助内容', en: 'Show sponsored content' },
  'settings.ads.hint': {
    zh: '关掉之后功能完全不变。赞助位只有两个，都标了 SPONSORED，都可以单独关掉。',
    en: 'Turning this off changes nothing else. There are only two slots, both labeled SPONSORED, both dismissible.',
  },
  'settings.ads.pro': { zh: '升级 Pro · 永久去广告', en: 'Go Pro · remove ads forever' },
  'settings.ads.proHint': { zh: 'V1 占位，暂未开放购买', en: 'Placeholder in V1, not for sale yet' },

  'settings.ai': { zh: 'AI 摘要（自带 Key）', en: 'AI summaries (bring your own key)' },
  'settings.ai.hint': {
    zh: 'Key 只存在这台机器的扩展存储里，只在你点「生成摘要」时发往你选的模型服务商。拾页没有服务器，也不会上报任何内容。',
    en: 'Your key stays in this device’s extension storage and is sent only to the provider you choose, only when you press Summarize. Shelf has no server and never reports content.',
  },
  'settings.ai.provider': { zh: '服务商', en: 'Provider' },
  'settings.ai.model': { zh: '模型', en: 'Model' },
  'settings.ai.key': { zh: 'API Key', en: 'API key' },
  'settings.ai.keyPlaceholder': { zh: 'sk-…', en: 'sk-…' },
  'settings.ai.privacy': {
    zh: '摘要是可选项。不填 Key，除摘要外的所有功能都能用。',
    en: 'Summaries are optional. Without a key, everything except summaries still works.',
  },

  'settings.data': { zh: '数据', en: 'Data' },
  'settings.data.exportAll': { zh: '单文件 Markdown', en: 'One Markdown file' },
  'settings.data.exportZip': { zh: '全库 .zip（每篇一个文件）', en: 'Full library .zip' },
  'settings.data.exportJson': { zh: '导出 JSON 备份', en: 'Export JSON backup' },
  'settings.data.import': { zh: '从文件导入', en: 'Import from file' },
  'settings.data.hint': {
    zh: '所有条目都存在这台机器的浏览器里。卸载扩展会一起删掉，记得定期导出。',
    en: 'Everything lives in this browser on this device. Uninstalling removes it — export regularly.',
  },

  'settings.about': { zh: '关于', en: 'About' },
  'settings.about.body': {
    zh: '拾页不联网、不建账号、不统计使用行为。唯一的例外是你主动开启的 AI 摘要。',
    en: 'Shelf does not phone home, has no accounts, and collects no usage data. The only exception is AI summaries, which you turn on yourself.',
  },
  'settings.stats': { zh: '条目 / 未读 / 收藏', en: 'Saved / unread / starred' },

  'ad.pro.title': { zh: 'Shelf Pro 计划中', en: 'Shelf Pro is planned' },
  'ad.pro.body': {
    zh: '买断制：全文索引、双链笔记导出、本地加密备份。尚未开放购买，先看设计。',
    en: 'One-time purchase: full-text index, export to linked notes, encrypted local backup. Not for sale yet — here is the design.',
  },
  'ad.pro.cta': { zh: '查看方案', en: 'See the plan' },
  'ad.slot.title': { zh: '延伸阅读位招租', en: 'This slot is available' },
  'ad.slot.body': {
    zh: '技术刊物与开发者工具优先，拒绝一切弹窗与追踪脚本。',
    en: 'Technical publications and developer tools only. No pop-ups, no tracking scripts.',
  },
  'ad.slot.cta': { zh: '联系方式', en: 'Get in touch' },
} as const;

export type TKey = keyof typeof DICT;

export function detectLang(pref: 'auto' | 'zh' | 'en'): Lang {
  if (pref === 'zh' || pref === 'en') return pref;
  const nav = (navigator.language || 'en').toLowerCase();
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function translator(lang: Lang) {
  return (key: TKey): string => DICT[key][lang];
}

export type T = ReturnType<typeof translator>;
