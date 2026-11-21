import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosStamp(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** DEFLATE 压缩的 zip。manifest.json 必须在根目录。 */
function buildZip(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  const { time, date } = dosStamp(new Date());
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const payload = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    Buffer.from(nameBytes).copy(local, 30);

    locals.push(local, payload);

    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt32LE(offset, 42);
    Buffer.from(nameBytes).copy(cd, 46);
    centrals.push(cd);

    offset += local.length + payload.length;
  }

  const cdBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, cdBuf, eocd]);
}

async function collect(dir, base = '') {
  const out = [];
  for (const name of await readdir(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    const s = await stat(full);
    if (s.isDirectory()) out.push(...await collect(full, rel));
    else out.push({ rel, full });
  }
  return out;
}

const version = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8')).version;
await mkdir(path.join(root, 'release'), { recursive: true });

async function pack(label, srcDir, transformManifest) {
  const files = await collect(srcDir);
  const entries = [];
  for (const f of files) {
    let data = await readFile(f.full);
    if (f.rel === 'manifest.json' && transformManifest) {
      const m = JSON.parse(data.toString('utf8'));
      transformManifest(m);
      data = Buffer.from(JSON.stringify(m, null, 2), 'utf8');
    }
    entries.push({ name: f.rel, data });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const zip = buildZip(entries);
  const file = path.join(root, 'release', `shelf-${version}-${label}.zip`);
  await writeFile(file, zip);
  console.log(`${label.padEnd(8)} ${(zip.length / 1024).toFixed(0).padStart(4)} KB  ${entries.length} files  ->  ${file}`);
  return file;
}

// Chrome 用内嵌 key 固定扩展 ID；Edge / Opera 用自己的签名，去掉 key 避免歧义
await pack('chrome', dist, null);
await pack('edge', dist, (m) => {
  delete m.key;
});

// Opera：未压缩产物 + 自带 MIT LICENSE（Opera 拒绝压缩代码，且不选许可证
// 会默认落到 CC BY-NC-ND，禁止商业使用）
const operaDist = path.join(root, 'dist-opera');
if (existsSync(operaDist)) {
  await pack('opera', operaDist, (m) => {
    delete m.key;
  });
} else {
  console.log('opera   skipped  (run: node build.mjs --out=dist-opera --no-minify)');
}

// Firefox 用独立产物：sidebar_action、background scripts、无 sidePanel
const worldFirefox = path.join(root, 'dist-firefox');
if (existsSync(worldFirefox)) {
  await pack('firefox', worldFirefox, null);
} else {
  console.log('firefox  skipped  (run: npm run build:firefox)');
}
