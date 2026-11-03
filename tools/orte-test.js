// V58: Prüft die neuen Orte ohne Bilder (Labor-Szene ?lab=orte, Software-Renderer, Bild angehalten):
// Theater: 320 Sitze, Publikum, sechs Tänzerinnen im Gleichschritt, Ablauf Nummer -> Applaus (im Sitzen) -> Pause -> Nummer,
// Applaus und Begrüßung, wenn Alexander den Saal betritt, Platz nehmen mit Blick zur Bühne, Platzanweiserin bringt die Bestellung
// über Landung, Gang und Reihe (Höhe folgt den Stufen); Bank: Tresor mit Goldbarren; Café: Plätze, Speisekarte.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/orte-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.goto(url + '?lab=orte&t=12.5&still=1', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => (window.labFrames || 0) > 1, null, { timeout: 400000, polling: 500 });
  await p.evaluate(() => { window.vespera?.renderer && (window.vespera.renderer.render = () => {}); });
  const r = await p.evaluate(async () => {
    const O = await import('/src/orte.js'), VE = await import('/src/venues.js'), PL = await import('/src/player.js'), C = await import('/src/core.js'), PHY = await import('/src/physics.js');
    const { ORTE } = O, { player } = PL, T = ORTE.theater, B = ORTE.bank, CF = ORTE.cafe, out = {};
    C.renderer.render = () => {};
    const setP = (x, y, z) => { player.p.set(x, y, z); player.onGround = true; player.fly = false; C.camera.position.set(x, y + 1.6, z); };
    const tick = (s, f) => { for (let k = 0; k < s * 10; k++) { if (f) f(k); VE.updateVenues(0.1); O.updateOrte(0.1); window.labOrte.place(); } };
    out.seats = T.seats.length; out.audience = T.peds.length; out.dancers = T.dancers.length; out.cafeSeats = CF.seats.length; out.cafeMenu = VE.MENU[CF.kind].title;
    out.gold = ORTE.spawns.flatMap(s => s.items).filter(i => i[0] === 'goldbar').length;
    // draußen vor dem Theater: die Nummer läuft
    setP(T.x0 - 8, 0.22, T.z); tick(1);
    out.st0 = ORTE.show.st; out.gaits = T.dancers.map(d => d.a.gait[1]); out.phase = new Set(T.dancers.map(d => d.a.gait[0])).size;
    tick(51); out.st1 = ORTE.show.st; out.clapping = ORTE.show.clapping.length; out.clapAct = ORTE.show.clapping[0].a.gait[1]; out.bow = T.dancers[0].tilt;
    tick(8); out.st2 = ORTE.show.st; out.clapBack = ORTE.show.clapping[0].a.gait[1];
    tick(7); out.st3 = ORTE.show.st; out.gait3 = T.dancers[0].a.gait[1];
    // Alexander betritt den Saal
    setP(T.xT + 1.2, T.LY, T.z); tick(0.5);
    out.greet = ORTE.show.greet > 0; out.greetClap = ORTE.show.clapping.length; out.say = document.getElementById('say') ? document.getElementById('say').textContent : '';
    // Platz nehmen (Reihe 3, freier Platz), bestellen, Platzanweiserin kommt
    const s = T.seats.find(q => !q.taken && q.row === 3);
    setP(s.up[0], s.up[1], s.up[2]); const near = VE.freeSeatNear(player.p); out.nearSeat = !!near;
    VE.sitDown(T, s); out.pitch = player.pitch; out.sitY = player.p.y.toFixed(2);
    VE.DINE.order = VE.MENU.theater.items[0];
    const wt = T.waiters[0]; let served = -1, minY = 99, maxY = -99, badY = 0;
    tick(60, k => { if (served < 0 && VE.DINE.item) served = k / 10; minY = Math.min(minY, wt.y); maxY = Math.max(maxY, wt.y); if (Math.abs(wt.y - (wt.x > T.rx0 - 0.5 ? T.rowY(wt.x) : T.LY)) > 0.01) badY++; });
    out.served = served; out.wtY = [minY.toFixed(2), maxY.toFixed(2)]; out.badY = badY; out.wtAt = [wt.x.toFixed(1), wt.z.toFixed(1)];
    VE.standUp(); out.stood = [player.p.x.toFixed(1), player.p.y.toFixed(2), player.p.z.toFixed(1)];
    // Bank: Tresortür-Durchgang liegt in der Nordwand, Goldbarren-Gruppe im Tresorraum
    out.vaultDoorInWall = Math.abs(B.vault.door.z - B.hz0) < 0.01 && B.vault.door.x > B.vault.x0 && B.vault.door.x < B.vault.x1;
    out.inOrt = [O.inOrt(T.x, T.z, 2), O.inOrt(B.cz + 0, B.cz, 2), O.inOrt((B.x0 + B.x1) / 2, B.cz, 2), O.inOrt(CF.x, CF.z, 1), O.inOrt(0, 0, 2)];
    out.nan = VE.VENUE_PEDS.filter(a => !isFinite(a.x + a.y + a.z + a.yaw)).length;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.seats === 320 && r.audience > 40 && r.dancers === 6, 'Theater: 320 Sitze, ' + r.audience + ' Zuschauer, 6 Tänzerinnen');
  ok(r.gaits.every(g => g === 22) && r.phase === 1, 'Tänzerinnen: Charleston im Gleichschritt');
  ok(r.st0 === 'nummer' && r.st1 === 'applaus' && r.st2 === 'pause' && r.st3 === 'nummer', 'Ablauf: Nummer -> Applaus -> Pause -> Nummer (' + [r.st0, r.st1, r.st2, r.st3].join(',') + ')');
  ok(r.clapping > 20 && r.clapAct === 9.8 && r.bow < -0.3, 'Applaus im Sitzen (9.8) bei ' + r.clapping + ' Zuschauern, Tänzerinnen verbeugen sich');
  ok(r.clapBack !== 9.8 && r.gait3 === 22, 'nach dem Applaus sitzt man wieder ruhig, die nächste Nummer läuft');
  ok(r.greet && r.greetClap > 20 && /Alexander/.test(r.say), 'Alexander betritt den Saal: Applaus und Begrüßung (' + r.say.slice(0, 50) + ')');
  ok(r.nearSeat && r.pitch > -0.1 && +r.sitY > 0.5, 'Platz nehmen mit Blick zur Bühne');
  ok(r.served > 0 && r.served < 50, 'Platzanweiserin bringt den Sekt nach ' + r.served + ' s');
  ok(r.badY === 0 && +r.wtY[1] > +r.wtY[0] + 0.3, 'Platzanweiserin folgt den Stufen (Höhe ' + r.wtY.join('..') + ')');
  ok(+r.stood[1] > 0.5, 'Aufstehen in die Gasse vor der Reihe');
  ok(r.gold >= 12 && r.vaultDoorInWall, 'Bank: Tresortür in der Nordwand, ' + r.gold + ' Goldbarren');
  ok(r.cafeSeats > 40 && r.cafeMenu === 'Café Kranich', 'Café Kranich: ' + r.cafeSeats + ' Plätze, Speisekarte');
  ok(r.inOrt[0] === 'theater' && r.inOrt[2] === 'bank' && r.inOrt[3] === 'cafe' && r.inOrt[4] === null, 'inOrt erkennt Theater, Bank, Café');
  ok(r.nan === 0, 'keine ungültigen Lagen');
  ok(errs.length === 0, 'keine Fehler in der Konsole' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles in Ordnung');
  process.exit(fails ? 1 : 0);
})();
