import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = process.cwd();
const outDir = path.resolve(root, '..', '.shots');
const PORT = 9340;

const TYPES = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.png': 'image/png',
  '.json': 'application/json',
};

const server = createServer(async (req, res) => {
  const p = decodeURIComponent((req.url || '/').split('?')[0]);
  try {
    const buf = await readFile(path.join(root, p));
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
await mkdir(outDir, { recursive: true });
await rm(path.join(outDir, 'profile-store'), { recursive: true, force: true }).catch(() => {});

const child = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT + 1}`,
    `--user-data-dir=${path.join(outDir, 'profile-store')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function waitHttp(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r.json();
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

function connect(url) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let seq = 0;
    ws.onopen = () =>
      resolve({
        send(method, params = {}) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
      });
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
        else p.res(msg.result);
      }
    };
  });
}

const version = await waitHttp(`http://127.0.0.1:${PORT + 1}/json/version`);
const target = await (
  await fetch(`http://127.0.0.1:${PORT + 1}/json/new?about:blank`, { method: 'PUT' })
).json();
const page = await connect(target.webSocketDebuggerUrl);
await page.send('Page.enable');
await page.send('Runtime.enable');

const written = [];
for (let scene = 1; scene <= 4; scene++) {
  await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/marketing/index.html?scene=${scene}` });
  await sleep(7600);
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `store-${scene}.png`);
  await writeFile(file, Buffer.from(shot.data, 'base64'));
  written.push(file);
  console.log('scene', scene, '->', file);
}

try {
  const browser = await connect(version.webSocketDebuggerUrl);
  await browser.send('Browser.close');
  await sleep(500);
} catch {
  /* ignore */
}
child.kill();
server.close();
console.log('done:', written.length, 'shots');
