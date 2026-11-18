// V110: Prüft die Reaktion auf Ereignisse ohne Bilder (Bild angehalten): Gaffer bei Unfall und Sturz, die Streife kommt und
// schickt die Gaffer weiter, Kundgebung (Welle durch die Menge, Passanten am Rand, Streit), Gala-Applaus als Welle.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/ereignisse-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Ereignis:|Unfall:|Ragdoll:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.evaluate(() => { try { localStorage.removeItem('vespera.kontor'); localStorage.removeItem('vespera.ruf'); localStorage.removeItem('vespera.gedaechtnis'); } catch (e) {} });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.ereignisse && window.vespera.ereignisse.EV.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.ereignisse, { EV } = X, SP = await import('/src/serpentine.js'), RD = await import('/src/ragdoll.js'), D = await import('/src/driving.js'), ST = await import('/src/strasse.js'), GA = await import('/src/gala.js');
    const out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    pl.fly = false;
    const say = document.getElementById('say'), seen = []; let last = '';
    setInterval(() => { const t = say && say.textContent; if (t && t !== last) { last = t; seen.push(t.slice(0, 110)); } }, 100);
    // eine Streife suchen und Alexander in ihre Nähe stellen
    const cop = SP.peds.find(q => q.patrol && q.a && q.a.on && q.st === 0 && q.a.m.elements[13] < 2);
    out.cop = !!cop;
    let e = cop.a.m.elements; pl.p.set(e[12] + 8, 0.3, e[14] + 8); await wait(2500);
    e = cop.a.m.elements;
    // 1 · Unfall: Wagen kracht (driving.js crashDamage), schwer, Alexander daneben
    const B = { x: e[12] + 6, z: e[14] + 4, y: 0.2, h: 0, hl: 2.2, hw: 0.9, m: 1200, I: 2000, w: 0, vx: 0, vz: 0, dmg: [0, 0, 0, 0], player: true };
    const ev0 = EV.n.ev;
    D.crashDamage(B, B.x + 2, B.z, 1200 * 6.5, 2);
    out.ev = EV.n.ev - ev0;
    const E = EV.list[EV.list.length - 1]; out.E = E && { kind: E.kind, sev: E.sev, byHim: E.byHim };
    for (let i = 0; i < 20 && E.gaff.length < 2; i++) await wait(500);
    out.gaff = E.gaff.length;
    for (let i = 0; i < 30 && !E.gaff.some(q => q.aw && q.aw.ph === 1); i++) await wait(500);
    out.gaffStand = E.gaff.filter(q => q.aw && q.aw.ph === 1).length;
    // 2 · die Streife kommt, schickt die Gaffer weiter, schreibt auf
    for (let i = 0; i < 20 && !EV.cops.length; i++) await wait(500);
    out.cops = EV.cops.length; out.copIsPatrol = EV.cops.every(q => q.patrol);
    for (let i = 0; i < 60 && !E.cop; i++) await wait(500);
    out.copArrived = E.cop;
    for (let i = 0; i < 40 && E.gaff.some(q => q.aw && q.aw.ev === E && q.aw.ph < 2); i++) await wait(500);
    out.gaffGone = E.gaff.every(q => !(q.aw && q.aw.ev === E && q.aw.ph < 2));
    for (let i = 0; i < 60 && !E.gone; i++) await wait(500);
    out.done = E.gone;
    for (let i = 0; i < 60 && EV.cops.some(q => q.aw && q.aw.fn); i++) await wait(500);
    out.copsHome = EV.cops.every(q => !(q.aw && q.aw.fn));
    out.lines = seen.slice();
    // 3 · Sturz eines Passanten (ragdoll.js) wird zum Ereignis
    const vic = SP.peds.filter(q => q.a && q.a.on && !q.aw && !q.rag && q.st === 0 && !q.patrol && q.a.m.elements[13] < 2).sort((a, b) => { const f = a.a.m.elements, g = b.a.m.elements; return Math.hypot(f[12] - pl.p.x, f[14] - pl.p.z) - Math.hypot(g[12] - pl.p.x, g[14] - pl.p.z); })[0];
    const ev1 = EV.n.ev; RD.knockDown(vic, 3, 0, pl.p.x, pl.p.z); out.sturz = EV.n.ev - ev1;
    const E2 = EV.list[EV.list.length - 1]; for (let i = 0; i < 12 && E2.gaff.length < 1; i++) await wait(500); out.sturzGaff = E2.gaff.length;
    // 4 · Kundgebung: große Kundgebung, Welle vom Redner aus
    window.vespera.strasse.level(2); const R = ST.STR.rally; out.rally = !!R;
    pl.p.set(R.cx + 16, 0.3, R.cz + 6);
    for (let i = 0; i < 30 && ST.STR.level < 2; i++) await wait(500);
    await wait(2000); out.level = ST.STR.level; R.speechT = 1e9;
    out.rpeds = R.peds.length; const crowd = R.peds.filter(q => q.a && q.a.on && q.life && q !== R.speaker && q.kind !== 'police' && !q.life.sign);
    for (const q of crowd) q.a.gait[1] = 1.3;
    for (const q of crowd) X.rallyLater(q, 3.7, Math.hypot(q.life.x - R.x, q.life.z - R.z) / 7);
    const cnt = () => crowd.filter(q => q.a.gait[1] === 3.7).length;
    await wait(150); out.wave0 = cnt(); await wait(4500); out.wave1 = cnt(); out.crowd = crowd.length;
    // Passanten am Rand, je nach Haltung, dann ein Streit
    let k = 0; for (const q of SP.peds) if (q.a && (q.st === 0 || q.st === 4) && !q.demo) { const f = q.a.m.elements; if ((f[12] - R.cx) ** 2 + (f[14] - R.cz) ** 2 < 32 * 32) { q.memAtt = k++ % 2 ? 'hass' : 'bew'; q.dmT = 0; } }
    out.nearRally = k;
    for (let i = 0; i < 30 && EV.n.demo < 3; i++) { EV.demoT = 0; X.demoTick(1); await wait(400); }
    out.demo = EV.n.demo;
    for (let i = 0; i < 30 && !EV.n.streit; i++) { EV.streitT = 0; EV.demoT = 0; X.demoTick(1); await wait(500); }
    out.streit = EV.n.streit; out.watch = EV.watch.length;
    window.vespera.strasse.level(null);
    // 5 · Gala: Applaus als Welle
    const G = GA.GALA; out.guests = G.guests.length;
    if (G.guests.length) {
      pl.p.set(0, 0.26, -16);
      for (const g of G.guests) { g.a.gait[1] = g.act; }
      const clap = () => G.guests.filter(g => g.a.gait[1] > 9 && g.a.gait[1] < 10).length;
      X.galaWave('clap'); await wait(120); out.g0 = clap(); await wait(5000); out.g1 = clap(); out.sour = G.guests.filter(g => g.sour).length;
    }
    // Kosten: Kundgebungsprüfung
    window.vespera.strasse.level(2); await wait(1500); const t0 = performance.now(); for (let i = 0; i < 100; i++) { EV.demoT = 0; X.demoTick(1); } out.ms = (performance.now() - t0) / 100; window.vespera.strasse.level(null);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.cop, 'Streife gefunden');
  ok(r.ev === 1 && r.E && r.E.kind === 'crash' && r.E.sev >= 2 && r.E.byHim, 'Unfall wird zum Ereignis: ' + JSON.stringify(r.E));
  ok(r.gaff >= 2 && r.gaffStand >= 1, 'Gaffer kommen und stehen im Ring (' + r.gaff + ')');
  ok(r.cops >= 1 && r.copIsPatrol && r.copArrived, 'Streife kommt (' + r.cops + ')');
  ok(r.gaffGone, 'Polizei schickt die Gaffer weiter');
  ok(r.done && r.copsHome, 'Polizei schreibt auf und geht wieder');
  ok(r.lines.some(l => /Weitergehen|Platz machen|Zurücktreten/.test(l)), 'Polizist ruft die Leute weiter');
  ok(r.lines.some(l => /Herr Alexander/.test(l) && /Polizist/.test(l)), 'Polizist spricht Alexander an');
  ok(r.sturz === 1 && r.sturzGaff >= 1, 'Sturz zieht Gaffer an (' + r.sturzGaff + ')');
  ok(r.rally && r.crowd >= 5 && r.wave0 < r.crowd * 0.3 && r.wave1 > r.crowd * 0.9, 'Sprechchor als Welle: ' + r.wave0 + ' → ' + r.wave1 + ' von ' + r.crowd);
  ok(r.demo >= 1, 'Passanten bleiben am Rand der Kundgebung stehen (' + r.demo + ', ' + r.nearRally + ' in der Nähe)');
  ok(r.streit >= 1, 'Streit zwischen Befürworter und Gegner');
  ok(!r.guests || (r.g0 < r.guests * 0.3 && r.g1 > r.guests * 0.6 && r.sour > 0 && r.g1 < r.guests), 'Gala-Applaus als Welle: ' + r.g0 + ' → ' + r.g1 + ' von ' + r.guests + ', ' + r.sour + ' tuscheln');
  ok(r.ms < 1, 'Kundgebungsprüfung ' + r.ms.toFixed(3) + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
