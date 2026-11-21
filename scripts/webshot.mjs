import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ROOT = 'F:\\2026-11-21-23-22-19';
const PORT = 9338;

const outPath = process.argv[2];
const pageUrl = process.argv[3];
const expr = process.argv[4] || '';
const fresh = process.argv.includes('--fresh');
const profile = ROOT + '\\.shots\\profile-web';
const height = Number(process.argv.find((a) => a.startsWith('--h='))?.slice(4) || 900);
const width = Number(process.argv.find((a) => a.startsWith('--w='))?.slice(4) || 420);

if (!outPath || !pageUrl) {
  console.error('usage: node webshot.mjs <out.png> <url> [expr] [--fresh] [--h=900]');
  process.exit(1);
}
if (fresh) rmSync(profile, { recursive: true, force: true });
mkdirSync(ROOT + '\\.shots', { recursive: true });

const child = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function waitHttp(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error('CDP not ready');
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    const events = [];
    let seq = 0;
    ws.onopen = () =>
      resolve({
        events,
        send(method, params = {}) {
          const id = ++seq;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
      });
    ws.onerror = () => reject(new Error('ws error'));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        events.push('EXCEPTION: ' + (msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'unknown'));
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        events.push('CONSOLE: ' + (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) p.rej(new Error(JSON.stringify(msg.error)));
        else p.res(msg.result);
      }
    };
  });
}

const version = await waitHttp(`http://127.0.0.1:${PORT}/json/version`);
const t = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
).json();
const page = await connect(t.webSocketDebuggerUrl);
await page.send('Page.enable');
await page.send('Runtime.enable');

const injectPath = process.argv.find((a) => a.startsWith('--inject='))?.slice(9);
if (injectPath) {
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: readFileSync(injectPath, 'utf8'),
  });
}

await page.send('Page.navigate', { url: pageUrl });
await sleep(1900);

let report = null;
if (expr) {
  const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  report = r.result?.value ?? r.exceptionDetails ?? null;
}

await sleep(400);
const shot = await page.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
try {
  const browser = await connect(version.webSocketDebuggerUrl);
  await browser.send('Browser.close');
  await sleep(500);
} catch {
  /* ignore */
}
child.kill();
console.log(JSON.stringify({ outPath, report, events: page.events.slice(0, 10) }, null, 2));
