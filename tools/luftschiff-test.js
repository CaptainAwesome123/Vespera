// V58: Prüft Steuer, Kurse und Bordservice der Aurora Imperial ohne Bilder (Luftschiff-Labor, Software-Renderer):
// Platz nehmen und bestellen (Salon, Bar, Speisesalon, Achterdeck), Steward bringt es auf dem Tablett und kehrt zurück,
// selbst steuern (Fahrt, Ruder, Höhe, Mindesthöhe), Kapitän: Kurs Villa, Kurs Belmont, kreuzen, halten.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/luftschiff-test.js http://localhost:8765/ [out/bild]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', shot] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: shot ? 800 : 320, height: shot ? 500 : 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.goto(url + '?lab=luftschiff&t=12.5&view=sofa', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => (window.labFrames || 0) > 1, null, { timeout: 300000, polling: 500 });
  const snap = async name => { if (!shot) return; await p.evaluate(() => { window.labFrames = 0; }); await p.waitForFunction(() => window.labFrames > 1, null, { timeout: 120000, polling: 200 }); await p.screenshot({ path: `${shot}-${name}.png`, timeout: 120000 }); console.log('Bild', name); };
  // Bedienung: Salon-Sofa
  let r = await p.evaluate(async () => {
    const IM = await import('/src/imperial.js'), BS = await import('/src/bordservice.js'), VE = await import('/src/venues.js'), PL = await import('/src/player.js'), HB = await import('/src/harbour.js'), C = await import('/src/core.js');
    const { IMP } = IM, { BS: B } = BS, { player } = PL, out = {};
    window.__m = { IM, BS, VE, PL, HB, C };
    const tick = (s, f) => { for (let k = 0; k < s * 10; k++) { if (f) f(k); HB.pfSave(IMP.pf); IM.updateImperial(0.1, k / 10); HB.pfRead(IMP.pf); HB.carryPlayer(); } };
    window.__tick = tick;
    out.venues = B.venues.map(v => v.name + ':' + v.seats.length); out.stewards = B.ag.length;
    // an Bord im Salon (das Schiff steht in der Luft, nahe der Kamera: nur dann ist das Innere mit den Stewards sichtbar)
    IMP.st = 'hold'; IMP.hp = { x: 0, y: 120, z: 0, ry: 0 }; tick(1);
    player.on = IMP.pf; const W = (lx, ly, lz) => { const pf = IMP.pf, c = Math.cos(pf.ry), s = Math.sin(pf.ry); return [pf.x + lx * c + lz * s, pf.y + ly, pf.z - lx * s + lz * c]; };
    player.p.set(...W(33, IMP.D.fyA, 0)); tick(2);
    out.greet = document.getElementById('say').textContent.slice(0, 60);
    const sal = B.venues.find(v => v.name === 'Großer Salon'), s = sal.seats[1];
    BS.seatWorld(s); VE.sitDown(sal, s); VE.DINE.order = VE.MENU.imperial.items[0];
    let served = -1, carried = false, maxD = 0; tick(40, k => { if (served < 0 && VE.DINE.item) served = k / 10; if (sal.server.carry) carried = true; });
    out.servedSalon = served; out.carried = carried; out.item = !!VE.DINE.item;
    out.itemAtTable = VE.DINE.item ? Math.hypot(VE.DINE.item.position.x - s.tx, VE.DINE.item.position.z - s.tz) < 0.05 : false;
    tick(30); out.stewardHome = Math.hypot(sal.server.lx - sal.server.home[0], sal.server.lz - sal.server.home[1]) < 0.2 && !sal.server.serve;
    // Schiff fliegt weiter, während er sitzt: Platz und Glas fahren mit
    const p0 = [player.p.x, player.p.z]; IMP.st = 'hold'; IMP.hp = { x: 50, y: 120, z: 30, ry: 0.4 }; tick(1);
    out.mws = [Math.hypot(player.p.x - p0[0], player.p.z - p0[1]), Math.hypot(player.p.x - s.x, player.p.z - s.z), VE.DINE.item ? Math.hypot(VE.DINE.item.position.x - s.tx, VE.DINE.item.position.z - s.tz) : -1];
    out.movedWithShip = out.mws[0] > 20 && out.mws[1] < 0.02 && out.mws[2] >= 0 && out.mws[2] < 0.05;
    VE.standUp(); tick(1); out.upOnShip = Math.abs(player.p.y - (IMP.pf.y + IMP.D.fyA)) < 0.3;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.venues.length === 3 && r.stewards === 2, 'Lokale an Bord: ' + r.venues.join(' '));
  ok(r.greet.includes('Steward'), 'Steward begrüßt: ' + r.greet);
  ok(r.servedSalon > 0 && r.servedSalon < 30, 'Salon: Champagner nach ' + r.servedSalon + ' s auf dem Tisch (Tablett getragen: ' + r.carried + ')');
  ok(r.itemAtTable, 'Glas steht am Platz');
  ok(r.stewardHome, 'Steward zurück hinter der Bar');
  ok(r.movedWithShip, 'Platz und Glas fahren mit dem Schiff');
  ok(r.upOnShip, 'Aufstehen landet auf dem Deck');
  if (errs.length) console.log('Fehler:', errs.join('\n'));
  // Bar, Speisesalon, Achterdeck
  r = await p.evaluate(async () => {
    const { IM, BS, VE, PL } = window.__m, { IMP } = IM, { BS: B } = BS, { player } = PL, tick = window.__tick, out = {};
    IMP.st = 'hold'; IMP.hp = { x: 0, y: 120, z: 0, ry: 0 }; tick(1);
    for (const [name, idx, item] of [['Großer Salon', 17, 2], ['Speisesalon', 3, 5], ['Achterdeck', 2, 0]]) {
      const v = B.venues.find(v => v.name === name), s = v.seats[idx];
      BS.seatWorld(s); VE.sitDown(v, s); VE.DINE.order = VE.MENU.imperial.items[item];
      let served = -1; tick(45, k => { if (served < 0 && VE.DINE.item) served = k / 10; });
      out[name] = served; VE.standUp(); tick(25);
      out[name + '-home'] = !v.server.serve && Math.hypot(v.server.lx - v.server.home[0], v.server.lz - v.server.home[1]) < 0.2;
    }
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r['Großer Salon'] > 0, 'Bar: Martini nach ' + r['Großer Salon'] + ' s');
  ok(r['Speisesalon'] > 0, 'Speisesalon: Hummer nach ' + r['Speisesalon'] + ' s');
  ok(r['Achterdeck'] > 0, 'Achterdeck: Champagner nach ' + r['Achterdeck'] + ' s');
  ok(r['Großer Salon-home'] && r['Speisesalon-home'] && r['Achterdeck-home'], 'Stewards wieder auf ihren Posten');
  // Bild: Steward mit Tablett am Sofa
  if (shot) {
    await p.evaluate(async () => {
      const { IM, BS, VE, PL } = window.__m, { IMP } = IM, { BS: B } = BS, tick = window.__tick;
      IMP.st = 'hold'; IMP.hp = { x: 0, y: 120, z: 0, ry: 0 }; tick(1);
      const sal = B.venues.find(v => v.name === 'Großer Salon'), s = sal.seats[1];
      BS.seatWorld(s); VE.sitDown(sal, s); VE.DINE.order = VE.MENU.imperial.items[0];
      tick(1); for (let k = 0; k < 400 && sal.server.serve && sal.server.serve.ph !== 'offer'; k++) tick(0.1);
      tick(0.6); window.labView('sofa'); PL.player.p.set(s.x, s.y + 0.75 - 1.7, s.z);
    });
    await snap('steward-sofa');
    await p.evaluate(async () => { const { VE, PL } = window.__m, tick = window.__tick; tick(6); window.labView('sofa'); });
    await snap('steward-serviert');
    await p.evaluate(async () => { const { VE, IM, BS } = window.__m, tick = window.__tick; VE.standUp(); tick(30);
      const din = BS.BS.venues.find(v => v.name === 'Speisesalon'), s = din.seats[6]; BS.seatWorld(s); VE.sitDown(din, s); VE.DINE.order = VE.MENU.imperial.items[5]; tick(1); for (let k = 0; k < 400 && din.server.serve && din.server.serve.ph !== 'offer'; k++) tick(0.1); tick(0.5); window.labView('tafel'); });
    await snap('steward-tafel');
    await p.evaluate(async () => { const { VE, IM, BS } = window.__m, tick = window.__tick; VE.standUp(); tick(30);
      const aft = BS.BS.venues.find(v => v.name === 'Achterdeck'), s = aft.seats[1]; BS.seatWorld(s); VE.sitDown(aft, s); VE.DINE.order = VE.MENU.imperial.items[0]; tick(1); for (let k = 0; k < 500 && aft.server.serve && aft.server.serve.ph !== 'offer'; k++) tick(0.1); tick(0.5); window.labView('bistro'); });
    await snap('steward-achterdeck');
    await p.evaluate(async () => { const { VE } = window.__m, tick = window.__tick; VE.standUp(); tick(30); window.labView('steuer'); });
    await snap('steuer');
  }
  // Steuer
  r = await p.evaluate(async () => {
    const { IM, PL, HB } = window.__m, { IMP, HELM } = IM, { player, keys } = PL, out = {};
    const run = (s, f) => { for (let k = 0; k < s * 10; k++) { if (f) f(k); HB.pfSave(IMP.pf); IM.impHelmInput(0.1); HB.pfRead(IMP.pf); HB.carryPlayer(); } };
    IMP.st = 'hold'; IMP.hp = { x: 0, y: 200, z: 0, ry: 0.3 }; window.__tick(1);
    player.on = IMP.pf; player.p.set(IMP.pf.x, IMP.pf.y + IMP.D.fyB, IMP.pf.z); player.fly = false;
    IM.impTakeHelm(); out.st = IMP.st;
    const g = IMP.g, x0 = g.position.x, z0 = g.position.z, ry0 = g.rotation.y;
    keys.KeyW = true; run(20); keys.KeyW = false;
    const dx = g.position.x - x0, dz = g.position.z - z0, d = Math.hypot(dx, dz);
    out.moved = Math.round(d); out.alongHeading = (dx * Math.cos(ry0) - dz * Math.sin(ry0)) / (d || 1); out.v = Math.round(HELM.v * 36) / 10;
    out.playerAtHelm = Math.hypot(player.p.x - (IMP.pf.x + (IMP.D.XF - 3.2) * Math.cos(IMP.pf.ry)), player.p.z - (IMP.pf.z - (IMP.D.XF - 3.2) * Math.sin(IMP.pf.ry))) < 0.05;
    keys.KeyA = true; run(10); keys.KeyA = false; out.turned = g.rotation.y - ry0;
    keys.KeyD = true; run(20); keys.KeyD = false; out.turnedBack = g.rotation.y - ry0;
    const y0 = g.position.y; keys.Space = true; run(8); keys.Space = false; out.climb = Math.round(g.position.y - y0);
    keys.KeyC = true; run(40); keys.KeyC = false; out.sinkTo = Math.round(g.position.y); out.need = Math.round(IM.impNeed(g.position.x, g.position.z, g.rotation.y));
    out.hud = document.getElementById('helm').textContent.slice(0, 80);
    keys.KeyS = true; run(10); keys.KeyS = false; out.vBack = Math.round(HELM.v * 10) / 10;
    IM.impLeaveHelm('hold'); out.after = IMP.st; out.hudHidden = document.getElementById('helm').hidden;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.st === 'helm' && r.after === 'hold' && r.hudHidden, 'Steuer übernehmen und abgeben');
  ok(r.moved > 150 && r.alongHeading > 0.98, 'Volle Fahrt voraus: ' + r.moved + ' m in Kursrichtung, ' + r.v + ' km/h');
  ok(r.playerAtHelm, 'Alexander steht am Steuer');
  ok(r.turned > 0.1 && r.turnedBack < -0.05, 'Ruder links/rechts dreht das Schiff: ' + r.turned.toFixed(2) + ' / ' + r.turnedBack.toFixed(2));
  ok(r.climb > 15, 'Leertaste steigt: ' + r.climb + ' m');
  ok(r.sinkTo >= r.need - 2, 'C sinkt nicht unter die Mindesthöhe: ' + r.sinkTo + ' m (Bedarf ' + r.need + ')');
  ok(r.hud.includes('Fahrt'), 'Anzeige: ' + r.hud);
  ok(r.vBack < 0, 'Rückwärts: ' + r.vBack + ' m/s');
  // Kapitän: Villa, Belmont, kreuzen, halten
  r = await p.evaluate(async () => {
    const { IM, HB } = window.__m, { IMP } = IM, tick = window.__tick, out = {};
    const VILLA = HB.VILLA, m = VILLA.imast; out.mast = m ? [Math.round(m.x), Math.round(m.y), Math.round(m.z), Math.round(m.y - m.base)] : null; out.post = VILLA.ipost ? [Math.round(VILLA.ipost.x), Math.round(VILLA.ipost.y), Math.round(VILLA.ipost.z)] : null;
    const nose = () => { const g = IMP.g; return [g.position.x + Math.cos(g.rotation.y) * IMP.L / 2, g.position.y, g.position.z - Math.sin(g.rotation.y) * IMP.L / 2]; };
    // Reserve zur Mindesthöhe nur unterwegs (15..85 % der Zeit): an den Masten liegt das Schiff absichtlich tiefer als die Höhenkarte verlangt
    const go = (to, max) => { IM.impBlend(to); const D = IMP.b.D; let s = 0, minClear = 1e9, maxSlope = 0, py = IMP.g.position.y, px = IMP.g.position.x, pz = IMP.g.position.z; const yHist = []; for (; IMP.st === 'blend' && s < max; s += 0.1) { tick(0.1); const g = IMP.g; if (s > D * 0.15 && s < D * 0.85 && Math.hypot(g.position.x, g.position.z) > 200) minClear = Math.min(minClear, g.position.y - IM.impNeed(g.position.x, g.position.z, g.rotation.y)); const dh = Math.hypot(g.position.x - px, g.position.z - pz); if (dh > 0.5) maxSlope = Math.max(maxSlope, Math.abs(g.position.y - py) / dh); px = g.position.x; py = g.position.y; pz = g.position.z; if (Math.round(s * 10) % 100 === 0) yHist.push(Math.round(g.position.y)); } return { st: IMP.st, D: Math.round(D), s: Math.round(s), minClear: Math.round(minClear), maxSlope: Math.round(maxSlope * 100) / 100, yHist }; };
    IMP.st = 'hold'; IMP.hp = { x: 300, y: 330, z: 400, ry: 0.3 }; tick(1);
    out.villa = go('moorV', 400); { const n = nose(); out.villaNose = Math.round(Math.hypot(n[0] - m.x, n[2] - m.z)); out.villaY = Math.round(IMP.g.position.y - m.y); }
    out.belmont = go('moor', 400); { const n = nose(); out.belNose = Math.round(Math.hypot(n[0], n[2])); out.belY = Math.round(IMP.g.position.y); }
    out.cruise = go('cruise', 400); out.cruiseSt = IMP.st; tick(5); out.cruising = IMP.st === 'cruise' && IMP.s > 0;
    IM.impBlend('hold'); out.hold = IMP.st; tick(2); out.holdStill = Math.hypot(IMP.g.position.x - IMP.hp.x, IMP.g.position.z - IMP.hp.z) < 0.01;
    out.villa2 = go('moorV', 400);
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.mast && r.mast[3] > 25 && r.mast[3] < 80, 'Ankermast der Villa: ' + JSON.stringify(r.mast) + ' Rufsäule ' + JSON.stringify(r.post));
  ok(r.villa.st === 'moorV' && r.villaNose < 4 && Math.abs(r.villaY + 2) < 1, 'Kurs Villa: festgemacht nach ' + r.villa.s + ' s, Bug ' + r.villaNose + ' m vom Mast, Höhe ' + r.villaY);
  ok(r.villa.minClear > -1 && r.villa.maxSlope < 0.45, 'Anflug Villa über Türmen und Gelände (Reserve ' + r.villa.minClear + ' m, steilster Winkel ' + r.villa.maxSlope + ')');
  ok(r.belmont.st === 'moor' && r.belNose < 4, 'Kurs Belmont von der Villa: festgemacht nach ' + r.belmont.s + ' s, Bug ' + r.belNose + ' m vom Mast');
  ok(r.cruise.st === 'cruise' && r.cruising, 'Kreuzen vom Belmont: eingefädelt nach ' + r.cruise.s + ' s (Reserve ' + r.cruise.minClear + ' m)');
  ok(r.hold === 'hold' && r.holdStill, 'Position halten');
  ok(r.villa2.st === 'moorV' && r.villa2.minClear > -1 && r.villa2.maxSlope < 0.45, 'Von der Schleife zur Villa: ' + r.villa2.s + ' s, Reserve ' + r.villa2.minClear + ' m, Winkel ' + r.villa2.maxSlope + ', Höhen ' + r.villa2.yHist.join(' '));
  ok(r.cruise.minClear > -1 && r.belmont.maxSlope < 0.5 && r.cruise.maxSlope < 0.5, 'Belmont-Anflug und Ablegen: Reserve ' + r.cruise.minClear + ' m, Winkel ' + r.belmont.maxSlope + ' / ' + r.cruise.maxSlope);
  if (errs.length) console.log('Fehler:', errs.join('\n'));
  ok(!errs.length, 'keine JS-Fehler');
  await b.close();
  console.log(fails ? fails + ' Fehler' : 'alles in Ordnung');
  process.exit(fails ? 1 : 0);
})();
