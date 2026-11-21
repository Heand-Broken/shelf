import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = 'F:\\2026-11-21-23-22-19';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = ROOT + '\\shelf\\dist';
const PROFILE = ROOT + '\\.shots\\profile-cdp';
const PORT = 9334;
const EXT_ID = 'clfaialakehegheenpakapanfgidilpc';

const outPath = process.argv[2] || ROOT + '\\.shots\\panel.png';
const pageUrl = process.argv[3] || `chrome-extension://${EXT_ID}/sidepanel.html`;
const evalExpr = process.argv[4] || '';

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(ROOT + '\\.shots', { recursive: true });

const child = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    `--load-extension=${EXT}`,
    `--disable-extensions-except=${EXT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--no-default-browser-check',
    '--window-size=440,920',
    '--window-position=40,40',
    'about:blank',
  ],
  { stdio: 'ignore' },
);
let exited = false;
child.on('exit', () => {
  exited = true;
});

async function waitHttp(url, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error('CDP endpoint not ready: ' + url);
}

function connect(url) {
  return new Promise((resolve, reject) => {
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
        close: () => ws.close(),
      });
    ws.onerror = (e) => reject(new Error('ws error ' + String(e)));
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

const version = await waitHttp(`http://127.0.0.1:${PORT}/json/version`);
const target = await (
  await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(pageUrl)}`, { method: 'PUT' })
).json();

const page = await connect(target.webSocketDebuggerUrl);
await page.send('Page.enable');
await page.send('Runtime.enable');
await sleep(2400);

let report = null;
if (evalExpr) {
  try {
    const r = await page.send('Runtime.evaluate', {
      expression: evalExpr,
      returnByValue: true,
      awaitPromise: true,
    });
    report = r.result?.value ?? r.exceptionDetails ?? r.result;
  } catch (err) {
    report = 'eval failed: ' + String(err);
  }
}

const shot = await page.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));

try {
  const browser = await connect(version.webSocketDebuggerUrl);
  await browser.send('Browser.close');
  await sleep(700);
} catch {
  /* ignore */
}
if (!exited) child.kill();
console.log(JSON.stringify({ outPath, report }, null, 2));
