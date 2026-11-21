import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { buildZip } from './lib/zip.mjs';

const root = process.cwd();
const version = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8')).version;

const INCLUDE_DIRS = ['src', 'public', 'scripts', 'preview', 'marketing'];
const INCLUDE_FILES = [
  'package.json',
  'package-lock.json',
  'build.mjs',
  'tsconfig.json',
  'LICENSE',
  'README.md',
];

async function collectDir(dir, base = '') {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const s = await stat(full);
    if (s.isDirectory()) out.push(...(await collectDir(full, rel)));
    else out.push({ rel, full });
  }
  return out;
}

const entries = [];
for (const d of INCLUDE_DIRS) {
  const p = path.join(root, d);
  try {
    for (const f of await collectDir(p)) entries.push({ name: f.rel, data: await readFile(f.full) });
  } catch {
    /* 目录不存在则跳过 */
  }
}
for (const f of INCLUDE_FILES) {
  const p = path.join(root, f);
  try {
    entries.push({ name: f, data: await readFile(p) });
  } catch {
    /* 文件不存在则跳过 */
  }
}

entries.sort((a, b) => a.name.localeCompare(b.name));
const zip = buildZip(entries);
await mkdir(path.join(root, 'release'), { recursive: true });
const out = path.join(root, 'release', `shelf-${version}-source.zip`);
await writeFile(out, zip);
console.log(`source ${(zip.length / 1024).toFixed(0)} KB  ${entries.length} files  ->  ${out}`);
