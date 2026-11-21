import * as esbuild from 'esbuild';
import { rm, mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetArg = process.argv.find((a) => a.startsWith('--target='))?.slice(9) || 'chrome';
const target = targetArg === 'firefox' ? 'firefox' : 'chrome';
const isFF = target === 'firefox';
// Opera 拒绝压缩过的第一方代码，需要单独出一份未压缩产物
const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice(6);
const minify = !process.argv.includes('--no-minify');
const out = path.join(root, outArg || (isFF ? 'dist-firefox' : 'dist'));
const watch = process.argv.includes('--watch');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const common = {
  bundle: true,
  target: isFF ? ['firefox115'] : ['chrome114'],
  outdir: out,
  logLevel: 'info',
  sourcemap: watch ? 'inline' : false,
  minify,
  legalComments: 'none',
  define: { __FIREFOX__: JSON.stringify(isFF) },
};

// background 用 IIFE：Firefox 的 background scripts 不支持 ESM
await esbuild.build({
  ...common,
  entryPoints: { background: path.join(root, 'src/background.ts') },
  format: 'iife',
});

// 扩展页面维持 ESM
await esbuild.build({
  ...common,
  entryPoints: {
    sidepanel: path.join(root, 'src/sidepanel.ts'),
    welcome: path.join(root, 'src/welcome.ts'),
  },
  format: 'esm',
});

function toFirefoxManifest(base) {
  const m = JSON.parse(JSON.stringify(base));
  delete m.key;
  delete m.minimum_chrome_version;
  delete m.side_panel;
  m.permissions = (m.permissions || []).filter((p) => p !== 'sidePanel');
  m.background = { scripts: ['background.js'] };
  // Firefox 用 sidebar_action，字段与 side_panel 不同，且必须给 default_icon
  m.sidebar_action = {
    default_panel: 'sidepanel.html',
    default_title: m.action?.default_title || 'Shelf',
    default_icon: m.icons,
  };
  // 140 是当前 ESR 线：optional_host_permissions(128+) 与
  // data_collection_permissions(140+) 都能覆盖
  m.browser_specific_settings = {
    gecko: {
      id: 'shelf@localfirst.dev',
      strict_min_version: '140.0',
      // 基础功能不做任何收集；只有用户自己填 Key 并点生成时，
      // 该条正文才会发给其选定的模型服务商，因此归入 optional。
      data_collection_permissions: {
        required: ['none'],
        optional: ['websiteContent'],
      },
    },
  };
  return m;
}

const base = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8'));
await writeFile(
  path.join(out, 'manifest.json'),
  JSON.stringify(isFF ? toFirefoxManifest(base) : base, null, 2) + '\n',
);

await cp(path.join(root, 'src/sidepanel.html'), path.join(out, 'sidepanel.html'));
await cp(path.join(root, 'src/welcome.html'), path.join(out, 'welcome.html'));
await cp(path.join(root, 'src/sidepanel.css'), path.join(out, 'sidepanel.css'));

const licenseSrc = path.join(root, 'LICENSE');
if (existsSync(licenseSrc)) {
  await cp(licenseSrc, path.join(out, 'LICENSE'));
}

const iconsSrc = path.join(root, 'public/icons');
if (existsSync(iconsSrc)) {
  await mkdir(path.join(out, 'icons'), { recursive: true });
  await cp(iconsSrc, path.join(out, 'icons'), { recursive: true });
}

const localesSrc = path.join(root, 'public/_locales');
if (existsSync(localesSrc)) {
  await cp(localesSrc, path.join(out, '_locales'), { recursive: true });
}

await writeFile(
  path.join(out, 'BUILD_INFO.txt'),
  `target ${target}\nbuilt at ${new Date().toISOString()}\nversion ${base.version}\n`,
);

console.log(`build ok -> ${out} (target: ${target})`);
