// V57: Prüft die Abläufe in Villa und Penthouse ohne Bilder (Labor-Szenen, Software-Renderer):
// Personal läuft und bleibt in seinen Räumen, Randolf begrüßt und folgt auf dem Weg, Bedienung bringt die Bestellung,
// Randolf reicht im Stehen ein Glas, umgeworfene Dinge kommen an ihren Platz zurück, Pausen in der Gesindestube.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/haushalt-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
async function open(b, lab) {
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.goto(url + '?lab=' + lab + '&t=12.5', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => (window.labFrames || 0) > 1, null, { timeout: 300000, polling: 500 });
  // Bild anhalten (Software-Renderer ist langsam); die Abläufe treiben wir selbst
  await p.evaluate(() => { window.vespera?.renderer && (window.vespera.renderer.render = () => {}); });
  return { p, errs };
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  // ---------------- Villa ----------------
  {
    const { p, errs } = await open(b, 'villa');
    const r = await p.evaluate(async () => {
      const H = await import('/src/haushalt.js'), V = await import('/src/villa.js'), PL = await import('/src/player.js'), VE = await import('/src/venues.js'), PHY = await import('/src/physics.js'), HB = await import('/src/harbour.js'), C = await import('/src/core.js');
      const { HS } = H, { VR } = V, { player } = PL, out = {};
      C.renderer.render = () => {};
      const W = (lx, y, lz) => ({ x: HB.VILLA.x + lx * VR.cs + lz * VR.sn, y: VR.by + y, z: HB.VILLA.z - lx * VR.sn + lz * VR.cs });
      const tick = (s, f) => { for (let k = 0; k < s * 10; k++) { if (f) f(k); VR.tick(0.1, 0, null); try { PHY.updateLoose(0.1); } catch (e) { } } };
      const setP = q => { player.p.set(q.x, q.y, q.z); player.onGround = true; player.fly = false; };
      // draußen anfangen, Abläufe laufen lassen
      setP(W(0, 0, -40)); tick(1);
      out.agents = HS.v.length; out.slots = HS.slots.length;
      const pos0 = HS.v.map(a => [a.x, a.z]);
      tick(40);
      out.moved = HS.v.filter((a, i) => Math.hypot(a.x - pos0[i][0], a.z - pos0[i][1]) > 0.5).length;
      out.nan = HS.v.filter(a => !isFinite(a.x + a.y + a.z + a.yaw)).length;
      // jeder bleibt in seinem Raum (Hauskoordinaten)
      out.leftRoom = HS.v.filter(a => a.S && a.room && !a.hidden && !a.td && !a.serve).filter(a => { const l = V.villaLocal(a), q = a.room; return !(l.x > q.x0 - 0.3 && l.x < q.x1 + 0.3 && l.z > q.z0 - 0.3 && l.z < q.z1 + 0.3); }).map(a => a.key);
      // hinein durch die Haustür: Randolf grüßt und folgt
      setP(W(-7.5, 0, -21.5)); tick(0.3); out.greet = !!HS.R.int;
      const route = [[-7.5, -21.5], [-6, -17], [-12, -17], [-16, -17], [-20, -19.5], [-21, -14.5]];
      for (let i = 0; i < route.length - 1; i++) { const [ax, az] = route[i], [bx, bz] = route[i + 1], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.13); for (let k = 1; k <= n; k++) { setP(W(ax + (bx - ax) * k / n, 0, az + (bz - az) * k / n)); tick(0.1); } }
      tick(6);
      out.rState = HS.R.st; out.rDist = Math.hypot(HS.R.x - player.p.x, HS.R.z - player.p.z);
      const rl = V.villaLocal(HS.R); out.rLocal = [rl.x.toFixed(1), rl.z.toFixed(1)];
      // hinsetzen und bestellen (Salon)
      const sal = HS.venues.find(v => v.name === 'Salon'), s = sal.seats[1];
      VE.sitDown(sal, s); VE.DINE.order = VE.MENU.villa.items[0];
      let served = -1; tick(40, k => { if (served < 0 && VE.DINE.item) served = k / 10; });
      out.served = served; out.rAfter = HS.R.st;
      VE.standUp();
      tick(4);
      // Drink im Stehen: Menü bei Randolf, erste Wahl
      setP(W(-21, 0, -14.5)); tick(3);
      VR.talk(); VE.placeOrder(0);
      let held = -1; tick(40, k => { if (held < 0 && PHY.LOOSE.held) held = k / 10; });
      out.drink = held; out.heldName = PHY.LOOSE.held && PHY.LOOSE.held.name;
      if (PHY.LOOSE.held) PHY.drop(false);
      // Aufräumen: Buch im Salon hinlegen, Heimat merken lassen, umwerfen und verschieben
      const B = PHY.spawnProp('book', W(-19, 0, -9).x, VR.by + 0.05, W(-19, 0, -9).z, 0);
      tick(3); out.home = !!(B && B.home);
      if (B) { B.x.x += 2.2; B.x.z += 1.0; B.q.setFromAxisAngle(new C.T.Vector3(1, 0, 0), 1.4); B.awake = false; }
      let back = -1; tick(60, k => { if (back < 0 && B && B.x.distanceTo(B.home.x) < 0.05) back = k / 10; });
      out.tidy = back;
      // Pausen: lange laufen lassen, während Alexander draußen ist
      setP(W(0, 0, -40)); tick(300);
      out.onBreak = HS.v.filter(a => a.onBreak).length; out.slotsOn = HS.slots.filter(s => !s.hidden).length;
      out.nan2 = HS.v.filter(a => !isFinite(a.x + a.y + a.z + a.yaw)).length;
      return out;
    });
    console.log('Villa', JSON.stringify(r));
    ok(r.agents > 25 && r.slots === 8, 'Villa: ' + r.agents + ' Figuren mit Ablauf, 8 Stühle in der Gesindestube');
    ok(r.moved > 8, 'Villa: ' + r.moved + ' Figuren gehen ihre Wege');
    ok(r.nan === 0 && r.nan2 === 0, 'Villa: keine ungültigen Lagen');
    ok(r.leftRoom.length === 0, 'Villa: alle bleiben in ihren Räumen ' + r.leftRoom.join(','));
    ok(r.greet, 'Randolf begrüßt Alexander an der Tür');
    ok(r.rState === 'follow' && r.rDist > 1.5 && r.rDist < 4.5, 'Randolf folgt in gebührendem Abstand: ' + r.rDist.toFixed(2) + ' m (' + r.rLocal + ')');
    ok(r.served > 0, 'Salon: Randolf bringt die Bestellung nach ' + r.served + ' s');
    ok(r.drink > 0, 'Randolf reicht im Stehen ein Glas nach ' + r.drink + ' s (' + r.heldName + ')');
    ok(r.home && r.tidy > 0, 'Umgeworfenes Buch wird aufgeräumt nach ' + r.tidy + ' s');
    ok(r.slotsOn > 2, 'Gesindestube: ' + r.slotsOn + ' am Tisch, ' + r.onBreak + ' in der Pause');
    ok(!errs.length, 'Villa: keine JS-Fehler ' + errs.slice(0, 3).join(' | '));
    await p.context().close();
  }
  // ---------------- Penthouse ----------------
  {
    const { p, errs } = await open(b, 'penthouse');
    const r = await p.evaluate(async () => {
      const H = await import('/src/haushalt.js'), PL = await import('/src/player.js'), VE = await import('/src/venues.js'), PHm = await import('/src/penthouse.js'), C = await import('/src/core.js');
      const { HS } = H, { player } = PL, F1 = PHm.PH.F1, out = {};
      C.renderer.render = () => {};
      const tick = (s, f) => { for (let k = 0; k < s * 10; k++) { if (f) f(k); H.updatePentStaff(0.1); } };
      const setP = (x, z) => { player.p.set(x, F1, z); player.onGround = true; };
      setP(0, -14.4); tick(1); out.agents = HS.p.length;
      tick(30); out.nan = HS.p.filter(a => !isFinite(a.x + a.y + a.z)).length;
      const order = (name, i) => { const V = HS.venues.find(v => v.name === name && v.kind === 'penthouse'), s = V.seats[i]; VE.sitDown(V, s); VE.DINE.order = VE.MENU.penthouse.items[0]; let t = -1; tick(60, k => { if (t < 0 && VE.DINE.item) t = k / 10; }); VE.standUp(); tick(20); return t; };
      out.bar = order('Bar', 2); out.salon = order('Salon', 0); out.salon2 = order('Salon', 4); out.terr = order('Terrasse', 0);
      out.konradHome = Math.hypot(HS.K.x - HS.K.post[0], HS.K.z - HS.K.post[1]);
      out.pianoK = (await import('/src/audio.js')).SND.pianoK;
      return out;
    });
    console.log('Penthouse', JSON.stringify(r));
    ok(r.agents === 6 && r.nan === 0, 'Penthouse: 6 Personen, keine ungültigen Lagen');
    ok(r.bar > 0, 'Bar: der Barkeeper serviert nach ' + r.bar + ' s');
    ok(r.salon > 0 && r.salon2 > 0, 'Salon: Konrad serviert nach ' + r.salon + ' / ' + r.salon2 + ' s');
    ok(r.terr > 0, 'Terrasse: der Kellner serviert nach ' + r.terr + ' s');
    ok(r.konradHome < 0.3, 'Konrad kehrt auf seinen Posten zurück (' + r.konradHome.toFixed(2) + ' m)');
    ok(!errs.length, 'Penthouse: keine JS-Fehler ' + errs.slice(0, 3).join(' | '));
  }
  await b.close();
  console.log(fails ? fails + ' Fehler' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
