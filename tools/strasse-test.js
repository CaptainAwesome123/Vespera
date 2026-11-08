// V72: Prüft Straßenhändler, Kundgebung und Demonstrationszug ohne Bilder (ganze Stadt, Bild angehalten): Aufbau, Stufen je Ruf und
// Streik, Sichtbarkeit, Schilder am Zug, Rufe, Kaufen (Kontor, Ruf), Gespräch mit den Streikenden, Zeitung, Karte, Haltung "hass".
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/strasse-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Händler|Kundgebung|Leben:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.evaluate(() => { try { localStorage.removeItem('vespera.kontor'); localStorage.removeItem('vespera.ruf'); } catch (e) {} });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.strasse, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const S = await import('/src/strasse.js'), K = await import('/src/kontor.js'), R = await import('/src/ruf.js'), AW = await import('/src/awe.js'), L = await import('/src/life.js'), M = await import('/src/music.js'), SP = await import('/src/serpentine.js'), V = await import('/src/venues.js');
    const { STR } = S, { KT } = K, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    const types = {}; for (const v of STR.vend) types[v.type] = (types[v.type] || 0) + 1;
    out.vend = { n: STR.vend.length, types, peds: STR.vend.reduce((s, v) => s + v.peds.length, 0), inSpots: STR.vend.every(v => L.LIFE.spots.includes(v)), mesh: !!STR.mesh && STR.mesh.geometry.attributes.position.count };
    out.rally = STR.rally && { peds: STR.rally.peds.length, march: STR.march.peds.length, signs: STR.signs.length, mesh: !!STR.sign, total: Math.round(STR.march.total) };
    // Stufen je Ruf und Streik
    const lvl = async () => { STR.lvlT = 0; await wait(400); return STR.level; };
    KT.s.ev = []; KT.s.rep.arbeiter = 80; const l80 = await lvl(); KT.s.rep.arbeiter = 50; const l50 = await lvl(); KT.s.rep.arbeiter = 20; const l20 = await lvl();
    KT.s.rep.arbeiter = 70; KT.s.ev = [{ i: K.EVENTS.findIndex(e => e.streik), d: 2 }]; const lS = await lvl(); KT.s.ev = [];
    out.levels = { l80, l50, l20, streik: lS };
    // Zum Platz: Figuren sichtbar, Zug läuft, Schilder folgen
    const R0 = STR.rally; KT.s.rep.arbeiter = 20; await lvl();
    pl.p.set(R0.cx - 6, 0.3, R0.cz + 3); pl.fly = false; await wait(1500);
    const vis = R0.peds.filter(pd => pd.a && pd.a.on).length, mv = STR.march.peds.filter(pd => pd.a && pd.a.on).length;
    const t1 = STR.march.t, s0 = STR.signs.find(s => s.pd.life && s.pd.life.moving && !s.banner); const a0 = s0 && STR.sign.geometry.attributes.position.array[s0.o * 3];
    await wait(1200);
    const a1 = s0 && STR.sign.geometry.attributes.position.array[s0.o * 3];
    out.onSquare = { vis, mv, moved: +(STR.march.t - t1).toFixed(2), signMoved: s0 ? Math.abs(a1 - a0) > 0.05 : null, signVis: STR.sign.visible, said: (document.querySelector('#say') || {}).textContent };
    // kleine Stufe: weniger Leute, kein Zug
    KT.s.rep.arbeiter = 50; await lvl(); await wait(300);
    out.small = { vis: R0.peds.filter(pd => pd.a && pd.a.on).length, mv: STR.march.peds.filter(pd => pd.a && pd.a.on).length };
    // Gespräch: Löhne versprechen
    KT.s.rep.arbeiter = 20; await lvl();
    pl.p.set(R0.x - 2.2, 0.3, R0.z); await wait(500);
    const find = re => M.INTERACT.find(u => { try { return u.test(pl.p) && re.test(u.label || ''); } catch (e) { return false; } });
    const use = find(/Streikenden|Redner/);
    const ar0 = KT.s.rep.arbeiter, pend0 = window.vespera.zeitung ? window.vespera.zeitung.Z.pending.length : 0;
    if (use) { use.act(); await wait(100); out.menu = document.getElementById('menuCard').textContent.slice(0, 160); V.placeOrder(0); }
    await wait(300);
    out.promise = { use: !!use, arbeiter: +(KT.s.rep.arbeiter - ar0).toFixed(1), calm: STR.calmT > 0, news: window.vespera.zeitung ? window.vespera.zeitung.Z.pending.length - pend0 : -1 };
    // Polizei räumen
    STR.talkT = 0; const ar1 = KT.s.rep.arbeiter; use && use.act(); await wait(100); V.placeOrder(3); await wait(300); STR.lvlT = 0; await wait(400);
    out.clear = { arbeiter: +(KT.s.rep.arbeiter - ar1).toFixed(1), level: STR.level, cleared: STR.clearT > 0 };
    STR.clearT = 0; STR.calmT = 0;
    // Händler: hingehen, kaufen, Runde, Trinkgeld
    const v = STR.vend.find(v => v.type !== 'schuh' && v.type !== 'zigar') || STR.vend[0];
    pl.p.set(v.x + Math.sin(v.yaw) * 1.6, 0.3, v.z + Math.cos(v.yaw) * 1.6); L.LIFE.sayT = 0; window.vespera.shared.sayTimer = 0; STR.callT = 0; await wait(900);
    out.greet = (document.querySelector('#say') || {}).textContent;
    const vu = find(/Am Stand/);
    const c0 = KT.s.cash; if (vu) { vu.act(); await wait(100); out.vmenu = document.getElementById('menuCard').textContent.slice(0, 160); V.placeOrder(0); }
    await wait(200); const c1 = KT.s.cash; window.vespera.shared.sayTimer = 0; if (vu) { vu.act(); await wait(100); V.placeOrder(2); } await wait(200);
    out.buy = { use: !!vu, label: vu && vu.label, paid: +(c0 - c1).toFixed(2), tip: +(c1 - KT.s.cash).toFixed(2), said: (document.querySelector('#say') || {}).textContent };
    // Haltung "hass" bei schlechtem Ruf
    KT.s.rep.arbeiter = 10; KT.s.rep.buerger = 10; const pa = R.rufAttP('arbeiter'), pb = R.rufAttP('buerger');
    const smp = []; for (let i = 0; i < 300; i++) smp.push(AW.attOf({ a: { kind: 'worker' } }));
    out.hass = { pa: +pa.hass.toFixed(2), pb: +pb.hass.toFixed(2), sum: +Object.values(pa).reduce((a, b) => a + b, 0).toFixed(3), sample: smp.filter(a => a === 'hass').length, lines: AW.SAY_NEAR.hass.length + AW.TALK.hass.length + AW.SAY_POW.hass.length };
    KT.s.rep.arbeiter = 90; out.hassHi = R.rufAttP('arbeiter').hass;
    out.karte = typeof window.vespera.karte === 'object';
    out.peds = SP.peds.length;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.vend.n >= 8 && Object.keys(r.vend.types).length >= 5, `Händler: ${r.vend.n} Stände, ${Object.keys(r.vend.types).length} Arten`);
  ok(r.vend.inSpots && r.vend.mesh > 0, 'Stände frei von Kram, ein Netz');
  ok(r.rally && r.rally.peds >= 12 && r.rally.march >= 8 && r.rally.signs >= 6, 'Kundgebung, Zug und Schilder aufgebaut');
  ok(r.levels.l80 === 0 && r.levels.l50 === 1 && r.levels.l20 === 2 && r.levels.streik === 2, 'Stufen folgen Ruf und Streik: ' + JSON.stringify(r.levels));
  ok(r.onSquare.vis >= 12 && r.onSquare.mv >= 8 && r.onSquare.moved > 0.5 && r.onSquare.signMoved && r.onSquare.signVis, 'Am Platz: alle sichtbar, Zug läuft, Schilder wandern mit');
  ok(r.small.vis > 3 && r.small.vis < r.onSquare.vis && r.small.mv === 0, 'Kleine Kundgebung ohne Zug');
  ok(r.promise.use && r.promise.arbeiter > 3 && r.promise.calm && r.promise.news >= 1, 'Löhne versprochen: Ruf, Ruhe, Zeitung');
  ok(r.clear.arbeiter < -5 && r.clear.level === 0 && r.clear.cleared, 'Räumen: Ruf sinkt, Platz leer');
  ok(r.buy.use && Math.abs(r.buy.paid) > 0 && r.buy.tip === 50, 'Händler: kaufen und Trinkgeld über das Kontor');
  ok(r.hass.pa > 0.15 && r.hass.pb > 0.1 && Math.abs(r.hass.sum - 1) < 0.01 && r.hass.sample > 20 && r.hassHi === 0 && r.hass.lines >= 10, 'Haltung feindselig nur bei schlechtem Ruf');
  ok(!errs.length, 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close();
  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
