// V74: Ein- und Aussteigen, Türen und Fahrgefühl prüfen ohne 3D-Zeichnen (renderer.render abgeschaltet, das Spiel läuft sonst ganz).
// Prüft: Alexander geht zum Wagen, die Fahrertür geht auf und wieder zu, er sitzt am Steuer; Fahren mit weichen Pedalen;
// Aussteigen mit Anhalten, Tür auf und zu, er steht neben dem Wagen; Passanten steigen an geparkten Wagen ein und fahren weg
// bzw. parken ein und steigen aus (Türen bewegen sich); alle Shader lassen sich übersetzen; keine Seitenfehler.
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann
//         THREE_DIR=/pfad/zu/three-0.147.0 node tools/einsteigen-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 640, height: 400 } })).newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push('error: ' + m.text().slice(0, 400)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} const iv = setInterval(() => { if (window.vespera && window.vespera.renderer) { window.vespera.renderer.render = () => {}; clearInterval(iv); } }, 5); });
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'shaderlog', { waitUntil: 'commit', timeout: 120000 });   // Shaderfehler melden
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 400000, polling: 500 });
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForTimeout(3000);
  await p.evaluate(async () => {
    const E = await import('/src/eating.js'), M = await import('/src/music.js'), TU = await import('/src/tueren.js');
    window.__e = { D: E.DRIVE, CS: E.CARSCENE, I: M.INTERACT, TU: TU.TUER, start: E.startCarScene };
    window.__use = pre => { const pl = window.vespera.player; const u = M.INTERACT.find(it => { try { return it.test(pl.p) && String(it.label).startsWith(pre); } catch (e) { return false; } }); if (!u) return null; const l = u.label; u.act(); return l; };
    window.__put = (x, y, z) => { const pl = window.vespera.player; pl.p.set(x, y, z); pl.v.set(0, 0, 0); pl.fly = false; pl.on = null; };
    // Aufzeichnung je Bild: größte Türöffnung, Zustände
    window.__rec = { dMax: 0, aMax: 0, states: new Set(), nan: false };
    const tick = () => {
      const D = __e.D, R = __rec; R.dMax = Math.max(R.dMax, D.dR || 0, D.dL || 0);
      for (const c of __e.CS.cars) { R.aMax = Math.max(R.aMax, c.dR || 0, c.dL || 0); const S = c.busy; if (S) for (const r of S.riders) { R.states.add(S.mode + ':' + r.st); if (!Number.isFinite(r.ped.x + r.ped.y + r.ped.z + r.ped.yaw)) R.nan = true; } }
      requestAnimationFrame(tick);
    };
    tick();
  });
  const res = { checks: [] }, ok = (n, c, info) => { res.checks.push((c ? 'OK   ' : 'FEHL ') + n + (info !== undefined ? ' · ' + JSON.stringify(info) : '')); };
  // eigenen (nicht Pierce Arrow) Parker auf dem Belmont-Platz suchen, Alexander 3 m daneben stellen
  const prep = await p.evaluate(() => {
    const V = vespera, pk = V.cars.parked.filter(c => !c.model && !c.hidden && Math.abs(c.m.elements[13] - 0.22) < 0.05).sort((a, b) => (a.x ** 2 + (a.z - 120) ** 2) - (b.x ** 2 + (b.z - 120) ** 2))[0];
    const e = pk.m.elements, h = Math.atan2(e[8], e[0]);
    // auf die Gehwegseite (weg von der Fahrbahn), 2,6 m neben die Wagenmitte
    __put(pk.x - pk.ox * 2.6, 0.25, pk.z - pk.oz * 2.6); window.__pk = pk;
    return { at: [Math.round(pk.x), Math.round(pk.z)], h: +h.toFixed(2), label: __use('Einsteigen') };
  });
  const an = await p.evaluate(() => { const A = __e.D.anim; return A ? { mode: A.mode, ph: A.ph, s: A.s } : null; });
  ok('Einsteigen beginnt mit Ablauf', !!prep.label && an && an.mode === 'in', { ...prep, an });
  await p.waitForFunction(() => !__e.D.anim, null, { timeout: 15000, polling: 100 }).catch(() => {});
  const inn = await p.evaluate(() => { const D = __e.D, B = D.body; return { on: D.on, anim: !!D.anim, dMax: +__rec.dMax.toFixed(2), dNow: [D.dR, D.dL], slot: D.doorSlot, pmVis: !!(vespera.playerModel.mesh && vespera.playerModel.mesh.visible), selfModel: !!D.selfModel, still: +Math.hypot(B.vx, B.vz).toFixed(2) }; });
  ok('am Steuer, Tür war offen und ist zu', inn.on && !inn.anim && inn.dMax > 0.95 && inn.dNow[0] === 0 && inn.dNow[1] === 0 && inn.slot >= 0, inn);
  ok('Alexander sitzt sichtbar am Steuer', inn.pmVis && inn.selfModel, inn);
  // fahren: Gas kommt weich (nach 0,1 s noch nicht voll), dann ein Stück weit
  const drv = await p.evaluate(async () => {
    const D = __e.D, B = D.body, x0 = B.x, z0 = B.z, wait = ms => new Promise(r => setTimeout(r, ms));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); await wait(90); const thr1 = D.inp.up;
    await wait(2500); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); const thr2 = D.thrI;
    return { thr1: +thr1.toFixed(2), moved: +Math.hypot(B.x - x0, B.z - z0).toFixed(1), v: +Math.hypot(B.vx, B.vz).toFixed(1), thr2 };
  });
  ok('Gas weich, Wagen fährt', drv.thr1 > 0 && drv.thr1 < 0.95 && drv.moved > 3, drv);
  // aussteigen während der Fahrt: erst bremsen, dann Tür auf, aussteigen, Tür zu
  const lv = await p.evaluate(() => __use('Aussteigen'));
  const an2 = await p.evaluate(() => { const A = __e.D.anim; return A ? A.mode : null; });
  await p.waitForFunction(() => !__e.D.on, null, { timeout: 20000, polling: 100 }).catch(() => {});
  const out = await p.evaluate(() => { const D = __e.D, B = D.body, pl = vespera.player.p; return { on: D.on, dist: +Math.hypot(pl.x - B.x, pl.z - B.z).toFixed(2), y: +pl.y.toFixed(2), dNow: [D.dR, D.dL], v: +Math.hypot(B.vx, B.vz).toFixed(2) }; });
  ok('Aussteigen mit Anhalten, steht neben dem Wagen, Tür zu', !!lv && (an2 === 'stop' || an2 === 'out') && !out.on && out.dist > 1.2 && out.dist < 2.6 && out.dNow[0] === 0 && out.dNow[1] === 0, { lv, an2, ...out });
  // noch einmal in den eigenen Wagen
  const again = await p.evaluate(() => __use('Einsteigen'));
  await p.waitForFunction(() => !__e.D.anim && __e.D.on, null, { timeout: 15000, polling: 100 }).catch(() => {});
  const ag = await p.evaluate(() => ({ on: __e.D.on, anim: !!__e.D.anim }));
  ok('eigenen Wagen wieder nehmen', !!again && ag.on && !ag.anim, { again, ...ag });
  await p.evaluate(() => vespera.cars.exit());
  // Passanten: Szenen an Parkern in der Nähe
  await p.evaluate(() => { __put(0, 0.25, 120); });
  await p.waitForTimeout(500);
  await p.evaluate(() => { for (let k = 0; k < 4; k++) __e.start(); __e.CS.t = 0.5; });
  await p.waitForTimeout(30000);
  const sc = await p.evaluate(() => ({ states: [...__rec.states], aMax: +__rec.aMax.toFixed(2), nan: __rec.nan, cars: __e.CS.cars.length, busy: __e.CS.cars.filter(c => c.busy).length }));
  const hasIn = sc.states.some(s => s === 'leave:in'), hasOut = sc.states.some(s => s === 'arrive:out');
  ok('Passanten steigen ein und aus, Türen bewegen sich', (hasIn || hasOut) && sc.aMax > 0.9 && !sc.nan, sc);
  // alle Shader übersetzen (auch Karosserie mit Aussparung, Türen, Nummernschilder)
  const comp = await p.evaluate(() => { const V = vespera; try { V.renderer.compile(V.scene, V.camera); return 'ok'; } catch (e) { return String(e); } });
  const shErr = logs.filter(l => /Shader|WebGLProgram|GLSL/i.test(l));
  ok('Shader übersetzt', comp === 'ok' && !shErr.length, { comp, shErr: shErr.slice(0, 2) });
  ok('keine Seitenfehler', !logs.some(l => l.startsWith('PAGEERROR')), logs.filter(l => l.startsWith('PAGEERROR')).slice(0, 3));
  console.log(res.checks.join('\n'));
  if (logs.length) console.log('Meldungen:\n' + logs.slice(0, 12).join('\n'));
  await b.close();
  process.exit(res.checks.some(c => c.startsWith('FEHL')) ? 1 : 0);
})();
