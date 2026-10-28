// Headless-Test im Chromium (Playwright): lädt das Spiel, betritt die Stadt, springt zu festen
// Aussichtspunkten und misst je Punkt Draw Calls, Geometrien, Texturen, JS-Speicher und Bildzeit.
// Meldet JS-Fehler und speichert je Punkt ein Bildschirmfoto.
// Aufruf: python3 -m http.server 8765   (im Repo-Ordner, zweites Terminal)
//         THREE_DIR=/pfad/zu/three-0.147.0 [SPOTS=menue,hafen] [SHOTS=1] node tools/test.js http://localhost:8765/ out/desk [mobile]
// THREE_DIR (optional): entpacktes npm-Paket three@0.147.0, dann wird das CDN lokal bedient.
// Ausgabe: out/desk-<punkt>.png und out/desk.json mit den Messwerten.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', out = 'shot', mobile] = process.argv;
const SPOTS = [
  { name: 'menue' },
  { name: 'belmont-platz', p: [0, 0.26, 120], yaw: 0, pitch: 0.22 },
  { name: 'ladenstrasse', p: [-330, 0.26, -380], yaw: 1.2, pitch: 0.05 },
  { name: 'hafen', p: [60, 0.26, 520], yaw: 0.12, pitch: 0.3 },
  { name: 'flug', p: [-400, 220, 600], yaw: 0.6, pitch: -0.35, fly: true },
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-precise-memory-info'] });
  const ctx = await b.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true }
    : { viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  p.on('requestfailed', r => logs.push('REQUEST FAILED: ' + r.url().slice(0, 200)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  p.on('pageerror', () => p.evaluate(() => { const e = document.getElementById('enter'); if (e) e.disabled = false; }).catch(() => {}));   // Fehler beim Aufbau: nicht erst den Zeitablauf abwarten
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  const result = { url, mobile: !!mobile, readyMs: null, spots: {}, logs };
  try { await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 300000, polling: 500 }); result.readyMs = Date.now() - t0; console.log('bereit nach', result.readyMs, 'ms'); }
  catch (e) { console.log('ZEITÜBERSCHREITUNG beim Aufbau'); }
  if (logs.some(l => l.startsWith('PAGEERROR'))) { console.log('FEHLER beim Aufbau:\n' + logs.join('\n')); fs.writeFileSync(out + '.json', JSON.stringify(result, null, 1)); await b.close(); process.exit(1); }
  // Messung: Draw Calls des ganzen Bildes (alle Passes), Grafikobjekte, JS-Heap, Bildzeit über 2 Bilder.
  // Im Software-Renderer (swiftshader) sind Bildzeiten nur als Vergleich zwischen zwei Ständen brauchbar.
  const measure = () => p.evaluate(() => new Promise(res => {
    const V = typeof vespera !== 'undefined' ? vespera : { renderer, scene, camera, player };
    const r = V.renderer; r.info.autoReset = false; let n = 0, t0 = 0, last = 0, best = 1e9, calls = 0, tris = 0;
    (function tick(t) {
      if (n === 0) { r.info.reset(); t0 = t; }
      else { best = Math.min(best, t - last); calls = Math.max(calls, r.info.render.calls); tris = Math.max(tris, r.info.render.triangles); r.info.reset(); }
      last = t;
      if (++n < 3) return requestAnimationFrame(tick);
      r.info.autoReset = true;
      const m = performance.memory; let vis = 0; V.scene.traverse(o => { if (o.visible !== false && (o.isMesh || o.isPoints || o.isLine)) vis++; });
      res({ calls, triangles: tris, geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs.length,
        heapMB: m ? Math.round(m.usedJSHeapSize / 1048576) : null, frameMsAvg: Math.round((t - t0) / (n - 1)), frameMsBest: Math.round(best), sceneObjects: vis,
        chunks: V.chunkStats ? { ...V.chunkStats } : undefined, assets: V.assetStats ? { ...V.assetStats } : undefined, pixelRatio: r.getPixelRatio() });
    })(0);
  }));
  const only = process.env.SPOTS ? process.env.SPOTS.split(',') : null;   // SPOTS=menue,hafen -> nur diese Punkte
  for (const s of SPOTS) {
    if (only && !only.includes(s.name)) continue;
    if (s.p) {
      await p.evaluate(s => {
        const V = typeof vespera !== 'undefined' ? vespera : { player };
        if (document.getElementById('enter') && !document.getElementById('overlay').hidden) document.getElementById('enter').click();
        V.player.p.set(...s.p); V.player.v && V.player.v.set(0, 0, 0); V.player.yaw = s.yaw; V.player.pitch = s.pitch; V.player.fly = !!s.fly;
      }, s);
      await p.waitForTimeout(1500);
    } else await p.waitForTimeout(1000);
    console.log(s.name, 'messen …', Date.now() - t0, 'ms'); const m = await measure();
    result.spots[s.name] = m;
    console.log(s.name.padEnd(14), JSON.stringify(m));
    // Bildschirmfotos im Spiel nur auf Wunsch (SHOTS=1): im Software-Renderer dauern sie Minuten und stürzen gern ab
    if (!s.p || process.env.SHOTS) try { await p.screenshot({ path: `${out}-${s.name}.png`, timeout: 240000 }); } catch (e) { logs.push('SCREENSHOT: ' + e.message.split('\n')[0]); }
  }
  fs.writeFileSync(out + '.json', JSON.stringify(result, null, 1));
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close();
})();
