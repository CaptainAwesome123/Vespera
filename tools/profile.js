// V29: CPU-Profil der Spiel-Logik ohne Zeichnen (der Software-Renderer im Headless-Chromium bräuchte Minuten je Bild).
// Misst: Ladezeit und die teuersten Funktionen beim Aufbau, dann je Aussichtspunkt die JS-Zeit je Bild (Selbstzeit je Funktion),
// die Zahl der Objekte im Blickfeld (grobe Draw Calls) mit Dreiecken, Szenenobjekte und JS-Speicher.
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann
//         THREE_DIR=/pfad/zu/three-0.147.0 [SPOTS=menue,belmont] node tools/profile.js http://localhost:8765/ out/prof.json [mobile]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url, out, mobile] = process.argv;
const SPOTS = (process.env.SPOTS || 'menue,belmont,laden,hafen,villa,flug').split(',');
const P = { belmont: [[0, 0.26, 120], 0, 0.22], laden: [[-330, 0.26, -380], 1.2, 0.05], hafen: [[60, 0.26, 520], 0.12, 0.3], flug: [[-400, 220, 600], 0.6, -0.35, true], villa: [null, 0, 0] , menue: null};
function agg(profile, div = 1) {
  const self = new Map(); const dts = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const cnt = new Map(); for (let i = 0; i < profile.samples.length; i++) cnt.set(profile.samples[i], (cnt.get(profile.samples[i]) || 0) + (dts[i] || 0));
  let tot = 0, idle = 0;
  for (const [id, us] of cnt) { const cf = byId.get(id).callFrame; const k = (cf.functionName || '(anon)') + ' ' + cf.url.replace(/.*\//, '') + ':' + (cf.lineNumber + 1); if (cf.functionName === '(idle)' || cf.functionName === '(program)' || cf.functionName === '(garbage collector)' && false) { idle += us; continue; } tot += us; self.set(k, (self.get(k) || 0) + us); }
  return { tot: tot / 1000 / div, idle: idle / 1000 / div, top: [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, us]) => [k, us / 1000 / div]) };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-precise-memory-info'] });
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true } : { viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage();
  const logs = []; p.on('pageerror', e => logs.push('PAGEERROR ' + e.message + (e.stack||'').slice(0,400))); p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => { const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]); fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort(); });
  await p.addInitScript(() => { const iv = setInterval(() => { if (window.vespera && window.vespera.renderer) { window.vespera.renderer.render = () => {}; clearInterval(iv); } }, 5); });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  await cdp.send('Profiler.start');
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit' });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 300000, polling: 500 });
  const ready = Date.now() - t0; console.log('bereit', ready);
  const res = { ready, spots: {}, logs };
  { const { profile } = await cdp.send('Profiler.stop'); const L = agg(profile); res.load = L; console.log('LADEN JS ms', L.tot.toFixed(0), 'idle/program', L.idle.toFixed(0)); L.top.slice(0, 30).forEach(t => console.log('   ', t[1].toFixed(0), t[0])); }
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  // Rendern abschalten
  await p.evaluate(async () => { const B = await import('/src/bloom.js'); window.__B = B; B.composer.render = () => {}; vespera.renderer.render = () => {}; });
  for (const s of SPOTS) {
    await p.evaluate(async ([s, P]) => {
      const V = vespera; let q = P; if (s === 'menue') return;
      if (!document.getElementById('overlay').hidden) document.getElementById('enter').click();
      if (s === 'villa') { const H = await import('/src/harbour.js'); q = [[H.VILLA.x, H.VILLA.y + 0.3, H.VILLA.z], 0, 0]; }
      V.player.p.set(...q[0]); V.player.v && V.player.v.set(0,0,0); V.player.yaw = q[1]; V.player.pitch = q[2]; V.player.fly = !!q[3];
    }, [s, P[s]]);
    await p.waitForTimeout(4000);   // Chunks bauen
    const f0 = await p.evaluate(() => { window.__fc = 0; (function c(){ window.__fc++; requestAnimationFrame(c); })(); return 0; });
    await cdp.send('Profiler.start'); const w0 = Date.now();
    await p.waitForTimeout(6000);
    const { profile } = await cdp.send('Profiler.stop'); const wall = Date.now() - w0;
    const frames = await p.evaluate(() => window.__fc);
    const self = new Map(); const dts = profile.timeDeltas; const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const cnt = new Map(); for (let i = 0; i < profile.samples.length; i++) cnt.set(profile.samples[i], (cnt.get(profile.samples[i]) || 0) + (dts[i] || 0));
    let tot = 0, idle = 0;
    for (const [id, us] of cnt) { const n = byId.get(id), cf = n.callFrame; const k = (cf.functionName || '(anon)') + ' ' + cf.url.replace(/.*\//, '') + ':' + (cf.lineNumber + 1); if (cf.functionName === '(idle)' || cf.functionName === '(program)') { idle += us; continue; } tot += us; self.set(k, (self.get(k) || 0) + us); }
    const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 35).map(([k, us]) => [k, +(us / 1000 / frames).toFixed(3)]);
    const calls = await p.evaluate(async () => {
      const T = await import('three'); const cam = vespera.camera; cam.updateMatrixWorld(); const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const by = {}; let n = 0, tris = 0;
      const tag = o => { let q = o, path = []; while (q && q !== vespera.scene) { if (q.userData && q.userData.chunk) return 'chunk:' + q.userData.chunk.layer; if (q.name) path.push(q.name); q = q.parent; } return (o.name || path[0] || '') + '|' + (o.isInstancedMesh ? 'IM' : o.type) + '|' + (o.material && (o.material.name || o.material.type)); };
      (function walk(o) { if (!o.visible) return; if ((o.isMesh || o.isPoints || o.isLine || o.isSprite) && (o.isInstancedMesh ? o.count > 0 : true) && (!o.frustumCulled || fr.intersectsObject(o))) { const k = tag(o); const g = o.geometry, tc = g ? ((g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3) * (o.isInstancedMesh ? o.count : g.isInstancedBufferGeometry ? (g.instanceCount === Infinity ? 1 : g.instanceCount) : 1) : 0; const b = by[k] || (by[k] = [0, 0]); b[0] += (Array.isArray(o.material) ? o.material.length : 1); b[1] += tc; n++; tris += tc; } for (const c of o.children) walk(c); })(vespera.scene);
      return { n, tris: Math.round(tris), top: Object.entries(by).sort((a, b) => b[1][0] - a[1][0]).slice(0, 25).map(([k, v]) => [k, v[0], Math.round(v[1] / 1000) + 'k']), topTris: Object.entries(by).sort((a, b) => b[1][1] - a[1][1]).slice(0, 15).map(([k, v]) => [k, v[0], Math.round(v[1] / 1000) + 'k']) };
    });
    console.log('  Draw-Objekte im Bild:', calls.n, 'Dreiecke', calls.tris); calls.top.forEach(t => console.log('     ', t[1], t[2], t[0])); console.log('  nach Dreiecken:'); calls.topTris.forEach(t => console.log('     ', t[1], t[2], t[0]));
    const mem = await p.evaluate(() => { let o = 0, au = 0; vespera.scene.traverse(x => { o++; if (x.matrixAutoUpdate) au++; }); return { objs: o, autoUpd: au, heap: Math.round(performance.memory.usedJSHeapSize / 1048576) }; });
    res.spots[s] = { frames, wall, msPerFrameJS: +(tot / 1000 / frames).toFixed(2), ...mem, calls, top };
    console.log(s, frames, 'frames', (tot / 1000 / frames).toFixed(2), 'ms JS/Bild', JSON.stringify(mem)); top.slice(0, 20).forEach(t => console.log('   ', t[1].toFixed(3), t[0]));
  }
  console.log(logs.join('\n'));
  fs.writeFileSync(out, JSON.stringify(res, null, 1)); await b.close();
})();
