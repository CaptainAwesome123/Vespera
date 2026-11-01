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
  { name: 'dritte', p: [0, 0.26, 120], yaw: 0, pitch: -0.1, key: 'KeyV' },   // V24: Ansicht von hinten mit Spielermodell
  { name: 'tragen', p: [-3.2, 0.26, 118.6], yaw: 0.9, pitch: -0.45, loose: true },   // V26: lose Dinge vor dem Belmont, aufheben und werfen
  { name: 'flug', p: [-400, 220, 600], yaw: 0.6, pitch: -0.35, fly: true },
  { name: 'kraefte', p: [-5, 0.26, 121], yaw: 0, pitch: -0.34, powers: true },   // V33: Telekinese (Koffer heben, schleudern), Flug von hinten, Superlandung
  { name: 'ballsaal', p: [30, 0.26, -12], yaw: 0.6, pitch: 0.05 },                     // V33: Ballsaal mit neuer Ausstattung
  { name: 'auto', p: [0, 0.26, 120], yaw: 0, pitch: 0, car: true },                   // V39: Pierce Arrow nehmen und ein Stück fahren
  { name: 'penthouse', p: [0, 250, 17], yaw: 0, pitch: 0.05 },                       // V33: Alexanders Penthouse-Suite
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
      if (s.key) await p.keyboard.press(s.key);
      await p.waitForTimeout(1500);
      if (s.key) console.log(s.name, await p.evaluate(() => { const V = vespera, pm = V.playerModel; return JSON.stringify({ view: pm.view, modelVisible: !!(pm.mesh && pm.mesh.visible), camBehind: +V.camera.position.distanceTo(V.player.p).toFixed(2) }); }));
    } else await p.waitForTimeout(1000);
    if (s.loose) console.log(s.name, await p.evaluate(async () => {
      const L = vespera.loose, wait = ms => new Promise(r => setTimeout(r, ms)), info = () => L.bodies.map(b => b.name + '@' + b.x.toArray().map(v => v.toFixed(2)).join('/') + (b.awake ? '*' : ''));
      const before = info(), n = L.bodies.length; let held = null, after = null;
      const B = L.bodies.find(b => b.name === 'Hutschachtel') || L.bodies[0];
      if (B) { L.pickUp(B); await wait(1500); held = B.x.toArray().map(v => v.toFixed(2)).join('/'); L.drop(true); await wait(2500); after = info(); }
      return JSON.stringify({ bodies: n, before, held, after, stats: L.stats, mocap: vespera.mocap && vespera.mocap.ready });
    }));
    if (s.car) console.log(s.name, await p.evaluate(async () => {
      const C = vespera.cars, wait = ms => new Promise(r => setTimeout(r, ms)), pp = vespera.player.p;
      const out = { modelReady: C.model.ready, parkedModels: C.parked.filter(c => c.model).length, parkedAll: C.parked.length,
        trafficModels: C.traffic.cars.filter(c => c.model).length, trafficAll: C.traffic.cars.length };
      const c = C.parked.filter(c => c.model && !c.hidden).sort((a, b) => ((a.x - pp.x) ** 2 + (a.z - pp.z) ** 2) - ((b.x - pp.x) ** 2 + (b.z - pp.z) ** 2))[0];
      if (!c) return JSON.stringify(out);
      C.enter(c); await wait(500);
      const D = C.drive, x0 = D.body.x, z0 = D.body.z;
      out.kind = D.model ? 'pierce' : 'eigene'; out.bodyCount = D.mMesh ? D.mMesh.count : null; out.wheelCount = D.mWheels ? D.mWheels.count : null; out.procCount = D.mesh.count;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); await wait(3000); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
      out.moved = +Math.hypot(D.body.x - x0, D.body.z - z0).toFixed(2); out.wheelA = +(D.wheelA || 0).toFixed(2);
      await wait(800);
      return JSON.stringify(out);
    }));
    if (s.powers) console.log(s.name, await p.evaluate(async () => {
      const V = vespera, P = V.powers, L = V.loose, wait = ms => new Promise(r => setTimeout(r, ms)), r2 = v => +v.toFixed(2);
      const out = {};
      out.grab = P.tkGrab(); out.kind = P.tk && P.tk.kind; const B = P.tk && P.tk.B;
      const y0 = B ? (B.x.y ?? B.y) : null; await wait(1500);
      out.lift = B ? r2((B.x.y ?? B.y) - y0) : null;
      P.tkRelease(true); await wait(1500); out.released = !P.tk;
      V.playerModel.view = 'third'; P.startFlight(); V.player.v.set(0, 0, -30); await wait(1200);
      out.fly = V.player.fly; out.tilt = r2(V.playerModel.tilt); out.modelVisible = !!(V.playerModel.mesh && V.playerModel.mesh.visible);
      out.camBehind = r2(V.camera.position.distanceTo(V.player.p));
      V.player.p.set(0, 40, 118); V.player.v.set(0, -40, 0); P.stopFlight(); await wait(1500);
      out.landed = V.player.onGround; out.shake = r2(P.shake); out.flyAfter = V.player.fly;
      out.hero = !!P.hero || out.landed; out.heroW = r2(V.playerModel.heroW || 0);
      // V35: einen Passanten mit Telekinese heben, sanft absetzen
      await wait(1500);
      const pp = V.player.p, pd = P.pedList().filter(q => q.a && q.a.on && !q.rag && !q.sit).map(q => [q, Math.hypot(q.a.m.elements[12] - pp.x, q.a.m.elements[14] - pp.z)]).sort((a, b) => a[1] - b[1])[0];
      if (pd) {
        const e = pd[0].a.m.elements; V.player.p.set(e[12] - 4, e[13], e[14]); V.player.yaw = Math.PI / 2; V.player.pitch = 0.06; await wait(400);
        const e2 = pd[0].a.m.elements, cp = V.camera.position, dx = e2[12] - cp.x, dy = e2[13] + 1 - cp.y, dz = e2[14] - cp.z;
        V.player.yaw = Math.atan2(-dx, -dz); V.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); await wait(400);
        out.pedGrab = P.tkGrab(); out.pedKind = P.tk && P.tk.kind;
        if (P.tk && P.tk.kind === 'ped') { const S = P.tk.S, y0 = S.p[0][1]; V.player.pitch += 0.25; await wait(2000); out.pedLift = r2(S.p[0][1] - y0); P.tkRelease(false); await wait(6000); out.pedPhase = S.busy ? S.ph : 'frei'; }
      }
      V.playerModel.view = 'first';
      return JSON.stringify(out);
    }));
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
