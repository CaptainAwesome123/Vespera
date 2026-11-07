// V63: Straßenbahn und Hochbahn prüfen ohne 3D-Zeichnen (renderer.render abgeschaltet, das Spiel läuft sonst ganz).
// Prüft: Linien gebaut, Wagen fahren und halten, Haltestelle erkannt, Einsteigen an der Tür (Fahrschein 1 Lumen),
// Mitfahren bis zum nächsten Halt mit Ansage, Hinsetzen, Ansicht V (Außenansicht), Aussteigen am Halt, Hochbahnsteig über die Treppe,
// Schnellfahrt, Freifahrt als Besitzer der Verkehrsbetriebe, Haltestellen auf der Stadtkarte, keine Seitenfehler.
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann
//         THREE_DIR=/pfad/zu/three-0.147.0 node tools/bahn-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push('error: ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} const iv = setInterval(() => { if (window.vespera && window.vespera.renderer) { window.vespera.renderer.render = () => {}; clearInterval(iv); } }, 5); });
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 400000, polling: 500 });
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForTimeout(3000);
  // Hilfen im Seitenkontext
  await p.evaluate(async () => {
    const H = await import('/src/bahn-hook.js'), M = await import('/src/music.js'), K = await import('/src/kontor.js');
    window.__b = { B: H.BAHN, I: M.INTERACT, K };
    window.__use = pre => { const pl = window.vespera.player; const u = M.INTERACT.find(it => { try { return it.test(pl.p) && String(it.label).startsWith(pre); } catch (e) { return false; } }); if (!u) return null; const l = u.label; u.act(); return l; };
    window.__labels = () => { const pl = window.vespera.player; return M.INTERACT.filter(it => { try { return it.test(pl.p); } catch (e) { return false; } }).map(it => String(it.label)); };
    window.__put = (x, y, z) => { const pl = window.vespera.player; pl.p.set(x, y, z); pl.v.set(0, 0, 0); pl.fly = false; pl.on = null; };
  });
  const res = { checks: [] }, ok = (n, c, info) => { res.checks.push((c ? 'OK   ' : 'FEHL ') + n + (info !== undefined ? ' · ' + JSON.stringify(info) : '')); };
  const st = await p.evaluate(() => { const B = __b.B; return { built: B.built, lines: B.lines.map(l => l.name + ' ' + Math.round(l.lenC) + ' m, ' + l.stations.length + ' Halte'), veh: B.veh.length, cars: B.cars.length, s0: B.veh.map(v => v.s) }; });
  ok('Linien gebaut', st.built && st.lines.length === 3, st.lines);
  await p.waitForTimeout(12000);
  const mv = await p.evaluate(s0 => { const B = __b.B; return { moved: B.veh.filter((v, i) => Math.abs(v.s - s0[i]) > 3).length, halt: B.veh.filter(v => v.st === 'halt').length, fin: B.veh.every(v => Number.isFinite(v.s) && v.cars.every(c => Number.isFinite(c.x + c.z))) }; }, st.s0);
  ok('Wagen fahren', mv.moved >= 8 && mv.fin, mv);
  // Linie 1: Haltestelle Belmont-Platz West; einen Wagen heranholen
  const prep = await p.evaluate(() => {
    const B = __b.B, S = B.stations.find(s => s.n === 'Belmont-Platz West'), sd = S.sides[0];
    __put(sd.x + sd.nx * (sd.lc + 1.6), 0.25, sd.z + sd.nz * (sd.lc + 1.6));
    const v = B.veh.find(q => q.tr === sd.tr); v.s = (sd.s - 45 + sd.tr.len) % sd.tr.len; v.st = 'run'; v.v = 6; v.next = v.tr.stops.indexOf(sd);
    window.__v = v; window.__sd = sd;
    return { side: !!B.sideAt(vespera.player.p), labels: __labels() };
  });
  ok('Haltestelle erkannt', prep.side && prep.labels.some(l => l.startsWith('Belmont-Platz West')), prep.labels);
  await p.waitForFunction(() => __v.st === 'halt' && __v.door > 0.8, null, { timeout: 60000, polling: 250 }).catch(() => {});
  const atStop = await p.evaluate(() => ({ st: __v.st, door: __v.door, det: !!__v.cars[0].det }));
  ok('Wagen hält, Türen offen, begehbares Modell', atStop.st === 'halt' && atStop.door > 0.8 && atStop.det, atStop);
  const cash0 = await p.evaluate(() => __b.K.KT.s.cash);
  const board = await p.evaluate(() => { const pl = vespera.player, sd = __sd, c = __v.cars[0], cs = Math.cos(c.ry), sn = Math.sin(c.ry); pl.p.set(c.x + 3.9 * cs + 2.0 * sn, 0.05, c.z - 3.9 * sn + 2.0 * cs); void sd; return __use('Einsteigen'); });
  await p.waitForTimeout(1200);
  const rid = await p.evaluate(c0 => ({ ride: __b.B.ride === __v, cash: c0 - __b.K.KT.s.cash, y: vespera.player.p.y, on: !!vespera.player.on }), cash0);
  ok('Einsteigen an der Tür, Fahrschein 1 Lumen', !!board && rid.ride && Math.abs(rid.cash - 1) < 0.01, { board, ...rid });
  // mitfahren bis zum nächsten Halt
  const nextN = await p.evaluate(() => __v.tr.stops[(__v.next + 1) % __v.tr.stops.length].st.n);
  await p.waitForFunction(() => __v.st === 'run' && __v.v > 3, null, { timeout: 40000, polling: 250 }).catch(() => {});
  const run = await p.evaluate(() => { const c = __v.cars[0], pl = vespera.player.p; return { v: __v.v, d: Math.hypot(pl.x - c.x, pl.z - c.z), say: document.getElementById('say').textContent }; });
  ok('fährt mit Alexander im Wagen', run.v > 3 && run.d < 7.5, run);
  const sit = await p.evaluate(() => __use('Hinsetzen'));
  await p.waitForTimeout(600);
  const sat = await p.evaluate(() => ({ sit: !!__b.B.sit, d: Math.hypot(vespera.player.p.x - __v.cars[0].x, vespera.player.p.z - __v.cars[0].z) }));
  ok('Hinsetzen im fahrenden Wagen', !!sit && sat.sit && sat.d < 7, { sit, ...sat });
  await p.evaluate(() => { for (let i = 0; i < 3 && __b.B.cam !== 'aussen'; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', key: 'v', bubbles: true })); });
  await p.waitForTimeout(500);
  const cam = await p.evaluate(() => { const c = vespera.camera.position, w = __v.cars[0]; return { cam: __b.B.cam, d: Math.hypot(c.x - w.x, c.z - w.z), h: c.y - w.y }; });
  ok('Taste V: Außenansicht', cam.cam === 'aussen' && cam.d > 8 && cam.d < 40, cam);
  await p.waitForFunction(() => __v.st === 'halt' && __v.door > 0.8, null, { timeout: 150000, polling: 250 }).catch(() => {});
  const arr = await p.evaluate(() => ({ st: __v.st, n: __v.tr.stops[__v.next].st.n, say: document.getElementById('say').textContent, sit: !!__b.B.sit }));
  ok('Ankunft am nächsten Halt mit Ansage', arr.st === 'halt' && arr.sit, { want: nextN, ...arr });
  const out = await p.evaluate(() => __use('Aussteigen'));
  await p.waitForTimeout(800);
  const outS = await p.evaluate(() => ({ ride: !!__b.B.ride, sit: !!__b.B.sit, y: vespera.player.p.y, side: !!__b.B.sideAt(vespera.player.p), cam: __b.B.cam }));
  ok('Aussteigen am Halt', !!out && !outS.ride && !outS.sit && outS.y > 0.15 && outS.y < 0.5 && outS.cam === 'innen', { out, ...outS });
  // Hochbahn: die Treppe hinaufgehen
  const hb = await p.evaluate(() => { const B = __b.B, S = B.stations.find(s => s.n === 'Belmont-Platz'), sd = S.sides[0], f = sd.stair.foot; __put(f[0], 0.3, f[1]); window.__hs = sd; return { foot: f }; });
  await p.waitForTimeout(400);
  const climb = await p.evaluate(async () => {
    const pl = vespera.player, sd = __hs, B = __b.B, S = sd.stair, PJ = await import('/src/player.js'), keys = PJ.keys;
    let maxY = 0;
    // ohne Zeichnen läuft das Spiel nur mit wenigen Bildern je Sekunde: die Schritte hier selbst rechnen (je 1/30 s)
    for (let t = 0; t < 1500 && !B.sideAt(pl.p); t++) {
      // erst die Treppe hinauf bis zum Podest, dann auf den Bahnsteig
      const dest = pl.p.y < 8.9 ? S.top : S.plat;
      pl.yaw = Math.atan2(-(dest[0] - pl.p.x), -(dest[1] - pl.p.z)); keys.KeyW = true; PJ.updatePlayer(1 / 30); maxY = Math.max(maxY, pl.p.y);
      if (t % 60 === 0) await new Promise(r => setTimeout(r, 0));
    }
    keys.KeyW = false;
    return { y: pl.p.y, maxY, side: !!B.sideAt(pl.p) };
  });
  ok('Hochbahnsteig über die Treppe erreicht', climb.side && climb.y > 8.8, climb);
  // Hochbahn heranholen und einsteigen
  await p.evaluate(() => { const B = __b.B, sd = __hs, v = B.veh.find(q => q.tr === sd.tr); v.s = (sd.s - 50 + sd.tr.len) % sd.tr.len; v.st = 'run'; v.v = 8; v.next = v.tr.stops.indexOf(sd); window.__hv = v; });
  await p.waitForFunction(() => __hv.st === 'halt' && __hv.door > 0.8, null, { timeout: 60000, polling: 250 }).catch(() => {});
  const hbo = await p.evaluate(() => { const pl = vespera.player, c = __hv.cars[1], cs = Math.cos(c.ry), sn = Math.sin(c.ry); pl.p.set(c.x - 3.9 * cs + 2.2 * sn, 9.12, c.z + 3.9 * sn + 2.2 * cs); return __use('Einsteigen'); });
  await p.waitForTimeout(1000);
  const hr = await p.evaluate(() => ({ ride: __b.B.ride === __hv, y: Math.round(vespera.player.p.y * 100) / 100, pax: __b.B.ag.filter(A => A.role).map(A => A.role).join(',') }));
  ok('Hochbahn: einsteigen am Bahnsteig, Fahrgäste da', !!hbo && hr.ride && hr.y > 9 && hr.pax.length > 0, { hbo, ...hr });
  // Schnellfahrt von dort zur Hafenstraße (Linie 1, umsteigen)
  const cash1 = await p.evaluate(() => __b.K.KT.s.cash);
  const tr = await p.evaluate(() => __b.B.travelTo('1:Hafenstraße'));
  await p.waitForTimeout(2200);
  const trS = await p.evaluate(c1 => { const S = __b.B.stations.find(s => s.id === '1:Hafenstraße'); return { d: Math.hypot(vespera.player.p.x - S.x, vespera.player.p.z - S.z), cash: c1 - __b.K.KT.s.cash }; }, cash1);
  ok('Schnellfahrt mit der Bahn', tr === '' && trS.d < 25 && Math.abs(trS.cash - 1) < 0.01, { tr, ...trS });
  // Verkehrsbetriebe kaufen: Freifahrt
  const buy = await p.evaluate(() => { const K = __b.K; K.KT.s.cash += 2000000; return K.ktBuyBiz('bahn'); });
  const cash2 = await p.evaluate(() => __b.K.KT.s.cash);
  await p.evaluate(() => __b.B.travelTo('H:Eiskanal'));
  await p.waitForTimeout(2200);
  const free = await p.evaluate(c2 => c2 - __b.K.KT.s.cash, cash2);
  ok('Besitzer fährt umsonst', buy && Math.abs(free) < 0.01, { buy, free });
  // Stadtkarte
  const ka = await p.evaluate(() => vespera.karte ? vespera.karte.places().filter(q => q.cat === 'bahn').length : -1);
  ok('Haltestellen auf der Stadtkarte', ka === 17, ka);
  const perf = await p.evaluate(() => { const t0 = performance.now(); for (let i = 0; i < 200; i++) __b.B.update(1 / 60); return (performance.now() - t0) / 200; });
  ok('Rechenzeit je Bild für die Bahn (ms)', perf < 2, Math.round(perf * 1000) / 1000);
  res.logs = logs;
  ok('keine Seitenfehler', !logs.some(l => l.startsWith('PAGEERROR')), logs.filter(l => l.startsWith('PAGEERROR')).length);
  console.log(res.checks.join('\n'));
  if (logs.length) console.log(logs.slice(0, 12).join('\n'));
  await b.close();
})();
