// V109: Prüft die klügeren Abläufe ohne Bilder (Bild angehalten): Unterstellen bei Regen, Schaufenster und Läden,
// Warten an der Haltestelle und Einsteigen, Hilfe bei Unfällen (mit scharfem Blick auf Alexander), Kosten je Prüfung.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/ablaeufe-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Ablauf:|Ragdoll:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.ablaeufe && window.vespera.ablaeufe.AB.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.ablaeufe, { AB } = X, SP = await import('/src/serpentine.js'), RD = await import('/src/ragdoll.js'), C = await import('/src/core.js'), BH = await import('/src/bahn-hook.js');
    const out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    pl.fly = false;
    const mine = fn => SP.peds.filter(q => q.aw && q.aw.fn === fn);
    // Regen erzwingen (atmosphere.js schreibt den Wert jedes Bild neu)
    let force = 0, rv = C.U.uRain.value; Object.defineProperty(C.U.uRain, 'value', { get: () => force ? 1 : rv, set: v => { rv = v; }, configurable: true });
    // belebteste Haltestelle in Spielernähe suchen
    let best = null, bn = -1;
    for (const st of BH.BAHN.stations) for (const sd of st.sides) { if (sd.hoch) continue; const cx = sd.x + sd.nx * (sd.lc + 1.55), cz = sd.z + sd.nz * (sd.lc + 1.55); let n = 0; for (const q of SP.peds) if (q.a && q.st === 0 && q.lp) { const e = q.a.m.elements; if ((e[12] - cx) ** 2 + (e[14] - cz) ** 2 < 900) n++; } if (n > bn) { bn = n; best = [cx, cz]; } }
    out.stopPeds = bn; out.stations = BH.BAHN.stations.length;
    pl.p.set(best[0] + 3, 0.3, best[1] + 3); await wait(3000);
    // 1 · Unterstellen
    AB.shopT = AB.stopT = 999; force = 1; out.wet = X.wet();
    for (let i = 0; i < 20 && AB.n.shelter < 3; i++) await wait(500);
    const sh = mine(AB.shelter[0] && AB.shelter[0].aw ? AB.shelter[0].aw.fn : null);
    out.shelter = { n: AB.n.shelter, live: sh.length, sd: sh.filter(q => q.aw.sd).length, door: sh.filter(q => q.aw.door).length };
    for (let i = 0; i < 40 && !sh.some(q => q.aw && q.aw.ph === 1); i++) await wait(500);
    out.shelterStand = sh.filter(q => q.aw && q.aw.ph === 1).length;
    force = 0; for (const q of sh) if (q.aw) q.aw.patience = 0;
    for (let i = 0; i < 60 && sh.some(q => q.aw && q.aw.fn); i++) await wait(500);
    out.shelterBack = sh.filter(q => !(q.aw && q.aw.fn)).length;
    // 2 · Schaufenster und Läden
    let shopFn = null;
    for (let i = 0; i < 24 && AB.n.shop < 2; i++) { AB.shopT = 0; for (const q of SP.peds) q.shT = 0; await wait(500); }
    out.shop = { n: AB.n.shop, live: AB.shop.length };
    if (AB.shop[0]) { shopFn = AB.shop[0].aw && AB.shop[0].aw.fn; for (const q of AB.shop) if (q.aw) { q.aw.enter = true; q.aw.look = 0.5; } }
    for (let i = 0; i < 50 && AB.n.enter < 1; i++) await wait(500);
    out.enter = AB.n.enter; out.hidden = SP.peds.filter(q => q.st === 2 && q.a && !q.a.on).length;
    // 3 · Haltestelle: Warten, dann Bahn simulieren, die an genau dieser Seite hält
    AB.shopT = 999;
    for (let i = 0; i < 24 && AB.n.stop < 1; i++) { AB.stopT = 0; for (const q of SP.peds) q.stT = 0; await wait(500); }
    out.stop = { n: AB.n.stop, live: AB.stop.length };
    const w = AB.stop[0];
    if (w) {
      for (let i = 0; i < 40 && !(w.aw && w.aw.ph === 1); i++) await wait(500);
      out.waiting = !!(w.aw && w.aw.ph === 1);
      // eine haltende Bahn an dieser Seite (ohne echte Bahn: Einsteigen direkt anstoßen)
      if (w.aw) { const sd = w.aw.sd, v = { st: 'halt', pax: 0 }; w.aw.ph = 2; w.aw.v = v; w.aw.bx = sd.x + sd.nx * 1.2; w.aw.bz = sd.z + sd.nz * 1.2;
        for (let i = 0; i < 40 && AB.n.board < 1; i++) await wait(500);
        out.board = { n: AB.n.board, pax: v.pax }; }
    }
    // 4 · Unfall: Passant neben Alexander umgestoßen
    const vic = SP.peds.filter(q => q.a && q.a.on && !q.aw && !q.rag && q.st === 0 && q.a.m.elements[13] < 2).sort((a, b) => { const e = a.a.m.elements, f = b.a.m.elements; return Math.hypot(e[12] - pl.p.x, e[14] - pl.p.z) - Math.hypot(f[12] - pl.p.x, f[14] - pl.p.z); })[0];
    out.vic = !!vic;
    if (vic) {
      const e = vic.a.m.elements; pl.p.set(e[12] + 2, 0.3, e[14] + 1);
      const h0 = AB.n.help; let saw = [];
      const say = document.getElementById('say'), seen = new Set();
      const iv = setInterval(() => { const t = say && say.textContent; if (t && !seen.has(t)) { seen.add(t); saw.push(t.slice(0, 90)); } }, 100);
      out.cand = SP.peds.filter(q => q !== vic && q.a && q.a.on && Math.hypot(q.a.m.elements[12] - e[12], q.a.m.elements[14] - e[14]) < 20).length;
      out.kd = RD.knockDown(vic, 4, 0, pl.p.x, pl.p.z);
      out.help = AB.n.help - h0; out.last = AB.last; out.vpos = [e[12], e[13], e[14]].map(v => +v.toFixed(1));
      const hs = SP.peds.filter(q => q.aw && q.aw.victim === vic);
      for (let i = 0; i < 60 && !hs.some(q => q.aw && q.aw.ph >= 1); i++) await wait(500);
      out.bent = hs.some(q => q.aw && q.aw.ph >= 1);
      for (let i = 0; i < 80 && hs.some(q => q.aw && q.aw.fn); i++) await wait(500);
      clearInterval(iv);
      out.helpDone = hs.every(q => !(q.aw && q.aw.fn)); out.byHim = hs.length ? true : false; out.lines = saw;
    }
    // Kosten: eine Prüfung (alle drei) bei Regen, 200 Mal
    force = 1; const T = f => { const t0 = performance.now(); for (let i = 0; i < 200; i++) { AB.shopT = AB.stopT = 0; f(); } return (performance.now() - t0) / 200; };
    out.msSh = T(() => X.shelterTry()); out.msShop = T(() => X.shopTry(0.5)); out.msStop = T(() => X.stopTry(0.5)); out.ms = out.msSh + out.msShop + out.msStop; force = 0; out.npeds = SP.peds.length;
    out.spots = X.spotsNear(best[0], best[1]).length;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.wet, 'Regen erkannt');
  ok(r.shelter.n >= 1 && r.shelter.sd + r.shelter.door >= 1, 'Leute stellen sich unter: ' + JSON.stringify(r.shelter));
  ok(r.shelterStand >= 1, 'stehen unter dem Dach (' + r.shelterStand + ')');
  ok(r.shelterBack >= 1, 'gehen weiter, wenn es nachlässt (' + r.shelterBack + ')');
  ok(r.shop.n >= 1, 'Schaufenster: ' + r.shop.n);
  ok(r.enter >= 1 && r.hidden >= 1, 'geht in den Laden (' + r.enter + ', ' + r.hidden + ' drinnen)');
  ok(r.stop.n >= 1 && r.waiting, 'wartet an der Haltestelle');
  ok(r.board && r.board.n >= 1 && r.board.pax >= 1, 'steigt ein: ' + JSON.stringify(r.board));
  ok(r.vic && r.help >= 1 && r.bent, 'Helfer kommen und beugen sich zum Gestürzten (' + r.help + ')');
  ok(r.helpDone, 'Helfer gehen danach weiter');
  ok(r.lines && r.lines.some(l => /Geht es|wehgetan|Himmels|Hand/.test(l)), 'Hilfe-Satz');
  ok(r.ms < 2 && r.ms / r.npeds * 1000 < 0.25, 'Prüfung kostet ' + r.ms.toFixed(3) + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
