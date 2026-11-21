# 拾页 Shelf

本地优先的稍后读与网页剪藏浏览器扩展。保存网页正文、全文搜索、干净阅读、导出 Markdown。
零后端、零账号、零遥测。AI 摘要为可选项，走用户自己填的 API Key。

Manifest V3 · TypeScript · esbuild · 无框架

---

## 商店上架状态

| 商店 | 状态 | 地址 |
| --- | --- | --- |
| Firefox AMO | 审核中 | https://addons.mozilla.org/firefox/addon/shelf-read-later/ |
| Chrome Web Store | 待提交 | — |
| Edge Add-ons | 待提交 | — |
| Opera Add-ons | 待提交 | — |

- 隐私政策：https://heand-broken.github.io/shelf-site/privacy.html
- 落地页：https://heand-broken.github.io/shelf-site/
- Pro 方案页：https://heand-broken.github.io/shelf-site/pro.html

落地页源码在独立仓库 [`shelf-site`](https://github.com/Heand-Broken/shelf-site)（GitHub Pages 托管）。

## 开发

```bash
npm install
npm run icons          # 重新生成图标（可选）
npm run typecheck
npm run build          # Chrome / Edge / Opera 产物 -> dist/
npm run build:firefox  # Firefox 产物 -> dist-firefox/
npm run build:all      # 两个都出
npm run pack           # 生成四个渠道包 -> release/
```

### 本地加载（Chrome 137 之后必须手动）

Chrome 已移除 `--load-extension` 命令行开关，自动化加载不可用，只能手动：

1. 打开 `chrome://extensions`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择本项目的 `dist` 目录
4. 点工具栏图标 → 侧边栏打开 → 在任意网页按 `Alt+S`

`src/manifest.json` 里内嵌了 `key` 字段，用于固定扩展 ID
（`clfaialakehegheenpakapanfgidilpc`）。好处是开发版与打包版共用同一套
`chrome.storage` 与 IndexedDB，换构建不会丢数据。发布到商店后 ID 由商店分配，
若不一致，卸载重装即可，本地数据会随旧 ID 一起清掉。

### UI 预览（不走扩展运行时）

```bash
node -e "…"   # 见 scripts/webshot.mjs 顶部注释里的本地静态服务命令
node scripts/webshot.mjs out.png http://127.0.0.1:8899/preview/index.html "<任意表达式>"
```

`preview/mock-chrome.js` 模拟了 `chrome.storage / runtime / tabs / scripting / permissions`，
可以让真实 bundle 在普通页面里跑通保存、解析、入库、渲染的全流程。
它不模拟扩展生命周期，所以不能替代真机验收。

---

## 结构

```
src/
  manifest.json        扩展清单（含固定 ID 的 key）
  background.ts        service worker：快捷键、右键菜单、唤起侧边栏
  sidepanel.html      侧边栏外壳
  sidepanel.ts        路由、状态、保存流程
  sidepanel.css       全部样式（含四套主题）
  welcome.html        首次安装的引导页
  welcome.ts          引导页文案（中英）与按钮
  app.ts              AppCtx 接口与 State 类型
  lib/
    db.ts             Dexie schema、去重、搜索、统计
    extract.ts        grabPage（注入页面）+ Readability 解析
    sanitize.ts       正文 HTML 白名单过滤
    exporter.ts       Markdown / HTML / 全库导出
    importer.ts       浏览器书签与 Pocket 导出解析
    ads.ts            广告位目录与曝光统计（仅本地）
    ai.ts             用户自填 Key 的摘要请求
    settings.ts       设置读写与变更订阅
    i18n.ts           中英文案表
    dom.ts            转义、时间、防抖等小工具
  views/
    shelf.ts reader.ts settings.ts
```

保存流程：快捷键 / 按钮 → `chrome.scripting.executeScript(grabPage)` 抓页面快照 →
side panel 内用 Readability 解析 → `sanitizeHtml` 过滤 → Dexie 入库（按规范化 URL 去重）。

解析必须发生在有 DOM 的环境里，所以 service worker 只负责唤起侧边栏，
不参与解析。

---

## 广告位的设计与边界

这是产品里唯一有政策风险的部分，改动前先读这一段。

### 现状

`src/lib/ads.ts` 的 `AD_CATALOG` 是配置驱动的，目前只有一条自有推广
（Shelf Pro 占位），`reader-end` 那条 `active: false`，即文末广告位暂时空着。
接第一个赞助商时：改 `active`、填真实 `url`、带 UTM。

V1 **没有**接入任何第三方广告网络，也没有任何请求发往外部服务器。
`trackImpression` / `trackClick` 只写 `chrome.storage.local`，不联网。

### 允许 / 禁止

| 形态 | 判定 |
| --- | --- |
| 侧边栏列表底部、阅读器文末的赞助卡 | 允许（自有界面、明确标注、可关闭） |
| 新标签页、popup、设置页内的赞助位 | 允许 |
| 往用户访问的网页里注入任何东西 | 禁止，最快下架路径 |
| AdSense | 政策明确不允许用于扩展 |
| 后台自动改写链接为 aff link | 2025-06-10 起严禁 |
| 伪装成系统通知的广告 | 禁止 |

### 硬性要求（已实现，不要回退）

1. 每个广告位带 `×`，点击即永久隐藏（`adsDismissed`）；
2. 设置页有总开关 `showAds`，关掉后功能完全不变；
3. 广告永远渲染在扩展自己的界面内，`target="_blank"` + `rel="noopener"`；
4. **空书架不投广告**（`shelf.ts` 里 `items.length ? … : ''`）——新用户前几次打开
   看到的是空状态，此时塞广告只会换来卸载；
5. 商店描述里必须写明「包含赞助内容 / contains sponsored content」。

### 收入预期

展示类广告 eCPM 约 $1–3，侧边栏工具 DAU 天花板低。3000 DAU 大约每月 $200–600。
要上量级得走自售赞助（技术课程、开发者工具，eCPM 可到 $10–20）或付费去广告。
把广告当成基本收入、Pro 当成上限，是这类产品的现实结构。

---

## 分发渠道

打包用 `node scripts/pack.mjs`，一次生成三份，写进 `release/`：

| 渠道 | 费用 | 是否需改代码 | 产物 |
| --- | --- | --- | --- |
| Chrome Web Store | $5 一次性（账号级；2026-08 起新发布者默认 2 个扩展位，可在后台申请提升） | 否 | `*-chrome.zip` |
| Microsoft Edge Add-ons | 免费 | 否 | `*-edge.zip` |
| Opera Add-ons | 免费 | 否 | `*-opera.zip` |
| Firefox AMO | 免费 | 同一份源码，构建期切换，见下 | `*-firefox.zip` |

Edge 与 Opera 都基于 Chromium，侧边栏用的就是同名的 `chrome.sidePanel`、同样的
`side_panel.default_path` 结构（微软官方文档明确写出），所以零改动。
Chrome 那份内嵌 `key` 以固定扩展 ID，Edge/Opera 走自己的签名体系，因此这两份去掉了 `key`。

### Firefox 适配

不开分支：同一份源码，`build.mjs --target=firefox` 用 esbuild 的 `define` 注入
`__FIREFOX__`，差异全部收在 `src/lib/platform.ts` 一个文件里。

| 差异 | 处理 |
| --- | --- |
| 没有 `chrome.sidePanel` | `sidebar_action` + `sidebarAction.open()`，点图标由 `action.onClicked` 接管 |
| background 不支持 ESM | background 单独打成 IIFE；页面仍是 ESM |
| `host_permissions` 默认不授予 | 保存失败时区分「未授权」和「页面不可读」，提示去 about:addons 开权限 |
| 最低版本 | `strict_min_version: 140.0`。`optional_host_permissions` 要 128+，`data_collection_permissions` 要 140+ |
| `chrome://extensions/shortcuts` 不存在 | 引导页在 Firefox 下隐藏该入口 |

构建期会做分支裁剪，实测 Firefox 产物里对 `sidePanel` 的引用为 **0 处**。

**上传前用 Mozilla 官方 linter 预检**（AMO 用的是同一个检查器）：

```bash
npx addons-linter dist-firefox
```

当前结果：**0 errors / 17 warnings**。警告为 16 处 `innerHTML` 赋值（插值均经 `esc()`
或 `sanitizeHtml()`，linter 无法静态验证）和 1 处 Android API 兼容提示（上传时选桌面端即可）。

注意 AMO 对压缩后的代码会要求提供源码。提交时附上 `src/` 与构建说明，或用
`--no-minify` 出未压缩产物。

### 明确不做：用户脚本（Tampermonkey / Greasy Fork）

用户脚本跑在页面上下文，没有 `chrome.sidePanel`，做不出侧边栏、书架和阅读器。
要适配就得把产品改成「页面悬浮球 + 浮层面板」，那是另一个产品，不是一次发布。
且用户脚本的广告变现能力远低于扩展。**这不是渠道，是重写**——已评估，不做。

## 上架材料

### Opera 的三个硬要求

Opera 商店的规矩和 Chrome 不一样，踩中任何一条都会被直接打回：

| 要求 | 处理 |
| --- | --- |
| **不接受压缩过的第一方代码** | 单独出一份未压缩产物：`node build.mjs --out=dist-opera --no-minify`。Opera 包用的是它（106 KB，其余渠道 76 KB） |
| **不选许可证会默认落到 CC BY-NC-ND**，禁止商业使用 | 包内已带 MIT `LICENSE`。靠广告变现的产品必须显式选一个允许商业使用的协议 |
| **截图 612×408，至少两张**，不超过 800×600 | 已生成 `.shots/opera-1.png`、`.shots/opera-2.png`（一张书架、一张阅读器） |

另外 Opera 要求 support page 且必须与扩展相关，否则可能以「内容不相关」为由拒绝。落地页正好满足这一点。

**审核周期**：人工审核，开发者反馈普遍以周计，长的能到几个月。Opera 不要放在你的发布日当天。

### Firefox AMO 提交要点

Firefox 走的不是 Partner Center，是 addons.mozilla.org/developers，提交时有三处和 Edge 不同。

**一、许可证**：选 **MIT**，或选「Custom License」并粘贴仓库里的 `LICENSE`。别留空——AMO 虽不像 Opera 那样默认套用 CC BY-NC-ND，但明示 MIT 对后续谈合作、被人 fork 都有利。

**二、可选权限要单独说明**。AMO 会把 `optional_host_permissions`（三个模型服务商域名）单列一栏让你写理由，这是审核员重点看的地方：

```
Shelf can optionally generate a short summary of a saved article. The feature is off by default and requires the user to supply their own API key. Shelf requests access only to the API host of the provider the user selected, only at the moment the user presses "Summarize", and the key is stored on the user's device. Without a key the extension makes no network request at all.
```

**三、平台只勾 Firefox**。Firefox for Android 不支持 sidebar 扩展，勾上反而会让审核员质疑兼容性。

其余字段（名称、摘要、描述、类别、图标、截图、主页、隐私政策 URL、权限理由）直接沿用上面 Edge 那份即可，措辞通用。

| 字段 | 值 |
| --- | --- |
| 类别 | Productivity |
| 图标 | `dist/icons/icon128.png`（AMO 要求 128×128） |
| 截图 | `.shots/store-1..4.png`，1280×800，正好符合 AMO 规格 |
| 主页 / 支持页 | https://heand-broken.github.io/shelf-site/ |
| 隐私政策 | https://heand-broken.github.io/shelf-site/privacy.html |
| 分发 | Firefox only，不勾 Android |
| 可见性 | 先 Unlisted 自测 |

上传两个文件：安装包 `release/shelf-0.1.0-firefox.zip`，源码 `release/shelf-0.1.0-source.zip`（AMO 对压缩后的代码要求附源码）。

提交通过后可以申请收录进 **Firefox 扩展工场**（extensions.firefox.com），那是编辑精选位，曝光远高于搜索结果。收录申请在 AMO 后台单独提交，值得做。

### Edge 后台字段文案（直接粘贴）

Edge 的表单结构和 Chrome 不完全一样，隐私声明的措辞也不一样，直接照搬 Chrome 的话术有被退回来的风险。以下按 Edge 的要求写好。

**名称**（≤45 字符）

```
Shelf — read later, kept on your device
```

**简短描述**

```
Save any page to a local bookshelf.
```

**详细描述**

```
Shelf saves the page you are reading into a bookshelf inside your browser.

Press Alt+S (or click the toolbar icon) and the article's main text is extracted, de-duplicated and stored locally. Nothing is uploaded, and there is no account to create.

What it does
- One-key capture: Alt+S on any page
- Full-text search that matches sentences in the article body, not just titles
- A reading view with adjustable font size, line height and measure
- Tags, read / unread state, and reading-progress memory
- Export a single article as Markdown, or the whole library as a zip

Privacy
Shelf has no server and no account. Everything you save stays in your browser's local storage on your own device. The optional AI summary is the only feature that sends anything anywhere, and only when you enter your own API key and press Summarize — the text then goes straight to the model provider you chose. If you never set a key, nothing ever leaves your device.

Ads
Shelf shows two sponsored slots inside its own interface: one at the bottom of the shelf, one at the end of an article. Both are labeled SPONSORED, both can be dismissed permanently, and a master switch in settings turns them off entirely. Turning them off changes nothing else.

Free, no account, works offline.
```

**单一用途（Single purpose）**

```
Shelf has a single purpose: saving web pages into a local reading list inside the browser, then reading and exporting them. AI summaries are optional and use the user's own API key.
```

**逐项权限理由**

| 权限 | 填写 |
| --- | --- |
| `storage` / `unlimitedStorage` | Stores the pages you save, their tags, read state and your settings on your own device. |
| `scripting` | Reads the text of the current page once, only when you press the save button or Alt+S. |
| `sidePanel` | All of Shelf's interface lives in the browser side panel. |
| `contextMenus` | Adds a "Save to Shelf" item to the right-click menu. |
| 主机权限（http/https） | Used only to read the text of the page you are actively saving. Shelf never modifies, injects into, or replaces any third-party page. |

**隐私与数据收集声明**

```
Shelf does not transmit any user data to the developer, and the developer has no access to it.

Pages you save are stored locally in your browser. The extension never sends them anywhere.

One optional feature does involve a third party: if you enter your own API key and press "Summarize", the text of the current article is sent directly from your browser to the model provider you selected (OpenAI, DeepSeek or Alibaba Qwen). Your key is stored only on your device. If you do not use this feature, no network request is ever made.

The extension also displays sponsored content inside its own interface. Impression and click counts are stored only on your device and are never linked to you.
```

**其它字段**

| 字段 | 值 |
| --- | --- |
| 类别 | Productivity |
| 语言 | English（中文用户可另加 zh-CN 条目，但商店页需分别提交） |
| 隐私政策 URL | https://heand-broken.github.io/shelf-site/privacy.html |
| 公司网站 | https://heand-broken.github.io/shelf-site/ |
| 可见性 | 先 Unlisted 自测，通过后再切 Public |
| 定价 | Free |

### 商店描述（Chrome 版本）

- Name: `Shelf — read later, kept on your device`
- Summary（≤132 字符）: `Save any page to a bookshelf inside your browser. Search it, read it clean, export to Markdown. No account, no cloud, no tracking.`
- 中文名：`拾页 Shelf — 本地稍后读与网页剪藏`

### 单一用途说明（Single purpose）

> Shelf has one purpose: saving web pages into a local reading list inside the
> browser, and reading or exporting them. Summaries are optional and use the
> user's own API key.

### 权限理由

| 权限 | 理由 |
| --- | --- |
| `host_permissions: http/https` | 仅在你点击保存或按 Alt+S 时读取当前页面正文，不修改页面 |
| `scripting` | 执行上述一次性正文抓取 |
| `sidePanel` | 全部界面都在侧边栏内 |
| `storage` | 保存设置与条目；`unlimitedStorage` 用于存放正文快照 |
| `contextMenus` | 右键「保存到拾页」 |
| `optional_host_permissions` | 仅在用户填写 Key 并首次生成摘要时申请对应模型域名 |

### 隐私政策（可直接发布）

> **拾页 Shelf 隐私政策**
>
> 拾页不运营任何服务器，不收集、不上传、不出售用户数据。
>
> 你保存的网页内容、标签、阅读状态全部存储在本机浏览器的 IndexedDB 中。
> 卸载扩展即删除全部数据，建议定期在设置页导出备份。
>
> 唯一的对外网络请求是「AI 摘要」功能：仅当你自行填写 API Key 并点击生成时，
> 当前条目的正文会发送至你所选的服务商（OpenAI / DeepSeek / 通义千问）。
> 不填写 Key 时，除该功能外一切可用，且不发生任何外部请求。
>
> 广告位仅存在于扩展自身的界面内，不注入、不修改任何第三方网页。
> 广告曝光与点击次数仅记录在本机，用于日后向赞助商提供汇总数据，不包含任何个人标识。
>
> 联系方式：<你的邮箱>

隐私政策必须挂在一个可公开访问的 URL 上，商店后台会实际访问校验。

已发布：https://heand-broken.github.io/shelf-site/

隐私政策页：https://heand-broken.github.io/shelf-site/privacy.html

源文件在 `site/`（中英双语），托管在 GitHub 仓库 `Heand-Broken/shelf-site`，
用 GitHub Pages 发布。改完提交推送即可更新，链接不变。

> 早先用的 `shelf-read-later.app.workbuddy.host/?sharecode=...` 是 WorkBuddy 的
> 托管链接，分享码是硬门禁（去掉参数即 403），不适合作为商店的隐私政策地址。
> 商店要求该 URL 在整个上架期间稳定可访问，因此改用自有托管。

### 需要准备的素材

- 4 张截图：1280×800，已生成在 `.shots/store-1..4.png`
  （书架、阅读器、广告设置、深色主题；由 `node scripts/make-store-shots.mjs` 生成）
- 128×128 图标：`dist/icons/icon128.png`
- 小型宣传图 440×280（可选，尚未制作）

---

## 待办（V1 之后）

- 导入条目按需抓取正文（目前只有 URL 和标题）
- 阅读器内选中文字做高亮与摘录
- 接入首个赞助商后补齐 `reader-end` 位，并在隐私政策里补广告上报说明
- 440×280 小型宣传图
