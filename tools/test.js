// Rauchtest im Headless-Chromium: lädt das Spiel, wartet bis "Stadt betreten" bereit ist,
// meldet JS-Fehler und speichert ein Bildschirmfoto des Menüs.
// Aufruf: python3 -m http.server 8765   (im Repo-Ordner, zweites Terminal)
//         THREE_DIR=/pfad/zu/three-0.147.0 node tools/test.js http://localhost:8765/ shot.png [mobile]
// THREE_DIR (optional): entpacktes npm-Paket three@0.147.0, dann wird das CDN lokal bedient.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', out = 'shot.png', mobile] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true }
    : { viewport: { width: 960, height: 540 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, ''));
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript' }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  try { await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 300000 }); console.log('bereit nach', Date.now() - t0, 'ms'); }
  catch (e) { console.log('ZEITÜBERSCHREITUNG beim Aufbau'); }
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out, timeout: 240000 });
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close();
})();
