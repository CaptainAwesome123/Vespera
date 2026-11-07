// V62: Stadtkarte prüfen ohne 3D-Zeichnen (die Karte ist ein 2D-Canvas, das geht im Software-Renderer schnell).
// Lädt das Spiel, schaltet renderer.render ab, baut das Kartenbild, öffnet die Karte (Übersicht und nah heran),
// fotografiert Karte und Kompassring, setzt einen Wegpunkt und lässt Alexander zu einem Ort fliegen.
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann
//         THREE_DIR=/pfad/zu/three-0.147.0 node tools/karte-test.js http://localhost:8765/ out/karte
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', out = 'out/karte'] = process.argv;
(async () => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.addInitScript(() => { const iv = setInterval(() => { if (window.vespera && window.vespera.renderer) { window.vespera.renderer.render = () => {}; clearInterval(iv); } }, 5); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'verstecke=alle', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 400000, polling: 500 });
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera && window.vespera.karte, null, { timeout: 30000 });
  const res = {};
  res.build = await p.evaluate(() => vespera.karte.build());
  await p.waitForTimeout(1500);
  res.places = await p.evaluate(() => vespera.karte.places().map(q => q.cat + ':' + q.n));
  res.districts = await p.evaluate(() => vespera.karte.KARTE.districts.map(d => d.n));
  res.water = await p.evaluate(() => vespera.karte.KARTE.waterLabels.map(d => d.n));
  await p.screenshot({ path: out + '-ring.png', clip: await p.evaluate(() => { const r = document.getElementById('mapWrap').getBoundingClientRect(); return { x: r.x - 6, y: r.y - 6, width: r.width + 12, height: r.height + 12 }; }) });
  await p.evaluate(() => { vespera.karte.setWp({ x: 300, z: -600, n: 'Test' }); vespera.karte.open(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const K = vespera.karte.KARTE; K.view.k = K.kMin; K.view.cx = K.E.x0 + K.E.L / 2; K.view.cz = K.E.z0 + K.E.L / 2; K.dirty = true; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '-ganz.png' });
  await p.evaluate(() => { const K = vespera.karte.KARTE; K.view.k = 0.55; K.view.cx = 0; K.view.cz = -250; K.dirty = true; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '-stadt.png' });
  await p.evaluate(() => { const K = vespera.karte.KARTE; K.view.k = 2.2; K.view.cx = 40; K.view.cz = 60; K.dirty = true; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '-nah.png' });
  // Ortskarte: Klick auf das Belmont-Symbol
  await p.evaluate(() => { const K = vespera.karte.KARTE; K.view.k = 0.8; K.view.cx = 0; K.view.cz = 0; K.dirty = true; });
  await p.waitForTimeout(500);
  await p.mouse.click(640, 400); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '-ort.png' });
  res.card = await p.evaluate(() => !document.querySelector('#karte .card').hidden && document.querySelector('#karte .card b').textContent);
  // Schnellreise zum Hafen
  res.flyStart = await p.evaluate(() => vespera.karte.flyTo('hafen'));
  const t0 = Date.now();
  await p.waitForFunction(() => !vespera.karte.KARTE.travel, null, { timeout: 90000, polling: 500 }).catch(() => {});
  res.flySec = (Date.now() - t0) / 1000;
  res.after = await p.evaluate(() => ({ p: vespera.player.p.toArray().map(v => Math.round(v * 10) / 10), fly: vespera.player.fly, travel: !!vespera.karte.KARTE.travel }));
  res.logs = logs;
  fs.writeFileSync(out + '.json', JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
