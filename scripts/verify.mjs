import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = 'F:\\2026-11-21-23-22-19';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXT = ROOT + '\\shelf\\dist';
const PROFILE = ROOT + '\\.shots\\profile-verify';
const PORT = 9336;

const outPath = process.argv[2] || ROOT + '\\.shots\\panel.png';
const evalExpr = process.argv[3] || '';
const testPageUrl = process.argv[4] || '';

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(ROOT + '\\.shots', { recursive: true });

const child = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--enable-unsafe-extension-debugging',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=460,940',
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
  throw new Error('CDP not ready');
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
      });
    ws.onerror = () => reject(new Error('ws error'));
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
const browser = await connect(version.webSocketDebuggerUrl);

let extId = null;
let loadError = null;
try {
  const r = await browser.send('Extensions.loadUnpacked', { path: EXT });
  extId = r.id;
} catch (err) {
  loadError = String(err);
}

if (!extId) {
  console.log(JSON.stringify({ ok: false, loadError }, null, 2));
  try {
    await browser.send('Browser.close');
    await sleep(600);
  } catch {
    /* ignore */
  }
  if (!exited) child.kill();
  process.exit(2);
}

async function openPage(url) {
  const t = await (
    await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  ).json();
  const p = await connect(t.webSocketDebuggerUrl);
  await p.send('Page.enable');
  await p.send('Runtime.enable');
  return { id: t.id, page: p };
}

const panelUrl = `chrome-extension://${extId}/sidepanel.html`;
const panel = await openPage(panelUrl);
await sleep(2000);

let testPage = null;
if (testPageUrl) {
  testPage = await openPage(testPageUrl);
  await sleep(1200);
  await browser.send('Target.activateTarget', { targetId: testPage.id });
  await sleep(600);
}

let report = null;
if (evalExpr) {
  try {
    const r = await panel.page.send('Runtime.evaluate', {
      expression: evalExpr,
      returnByValue: true,
      awaitPromise: true,
    });
    report = r.result?.value ?? r.exceptionDetails ?? r.result;
  } catch (err) {
    report = 'eval failed: ' + String(err);
  }
}

await sleep(500);
const shot = await panel.page.send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPath, Buffer.from(shot.data, 'base64'));

try {
  await browser.send('Browser.close');
  await sleep(600);
} catch {
  /* ignore */
}
if (!exited) child.kill();
console.log(JSON.stringify({ ok: true, extId, outPath, report }, null, 2));
