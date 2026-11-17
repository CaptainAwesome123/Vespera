// V108: Prüft die Gespräche mit Alexander ohne Bilder (Bild angehalten): Karte mit Stimmung, Antworten über mehrere Runden,
// Geschenk (Kontor, Gedächtnis), Stimmungswechsel über die Beziehung, Speichern, Schließen mit Esc und beim Weggehen.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/unterhaltung-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Gespräch:|Kontor:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.unterhaltung && window.vespera.unterhaltung.UH.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.unterhaltung, RD = await import('/src/ragdoll.js'), K = await import('/src/kontor.js'), V = await import('/src/venues.js'), IN = await import('/src/input.js'), GD = window.vespera.gedaechtnis;
    const { UH } = X, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    const pickN = async i => { V.placeOrder(i); IN.resume(); };
    const card = () => { const el = document.getElementById('menuCard'); return { open: V.DINE.menuOpen, h: el.querySelector('h3') && el.querySelector('h3').textContent, n: el.querySelectorAll('.items button').length, opts: [...el.querySelectorAll('.items button')].map(b => b.textContent.slice(1)) }; };
    // Vorlagen: jede Stimmung hat Antworten, Platzhalter lösbar
    const atts = ['bew', 'resp', 'neid', 'skep', 'furcht', 'hass', 'dienst'], miss = [];
    for (const [n, T] of Object.entries({ BEFINDEN: X.BEFINDEN, MEINUNG: X.MEINUNG, HERAB: X.HERAB, ABSCHIED: X.ABSCHIED })) for (const a of atts) if (!T[a] || !T[a].length) miss.push(n + '.' + a);
    out.miss = miss;
    // ein Bewohner in der Nähe
    const c0 = RD.citizens.find(c => !c.nf && c.at && c.at.work);
    pl.fly = false; pl.p.set(c0.at.work.x + 1.5, 0.3, c0.at.work.z + 1.5); await wait(3000);
    const near = () => RD.citizens.filter(c => !c.nf && !c.use && c.ped.a && c.ped.a.on).sort((a, b) => { const e = a.ped.a.m.elements, f = b.ped.a.m.elements; return Math.hypot(e[12] - pl.p.x, e[14] - pl.p.z) - Math.hypot(f[12] - pl.p.x, f[14] - pl.p.z); })[0];
    const c = near(); out.cit = !!c;
    const goTo = () => { const e = c.ped.a.m.elements; pl.p.set(e[12] + 1.6, 0.3, e[14] + 0.8); };
    goTo();
    RD.citizenSay(c);
    out.first = document.getElementById('say').textContent.slice(0, 80);
    await wait(1200);
    out.c1 = card(); out.held = !!(c.ped.aw && c.ped.aw.dur > 100);
    // Runde 1: Befinden
    await pickN(0); await wait(200); out.ans1 = document.getElementById('say').textContent.slice(0, 120);
    for (let i = 0; i < 12 && !V.DINE.menuOpen; i++) { goTo(); await wait(500); }
    out.c2 = card();
    // Runde 2: Geschenk
    const cash0 = K.KT.s.cash, r0 = (c.ped.mem && c.ped.mem.r) || 0;
    const gi = out.c2.opts.findIndex(o => /20 Lumen/.test(o)); await pickN(gi); await wait(200);
    out.gabe = { cash: cash0 - K.KT.s.cash, dr: c.ped.mem.r - r0, mem: c.ped.mem.p && c.ped.mem.p.k, say: document.getElementById('say').textContent.slice(0, 100) };
    for (let i = 0; i < 12 && !V.DINE.menuOpen; i++) { goTo(); await wait(500); }
    out.c3 = card();
    const ai = out.c3.opts.findIndex(o => /Wiedersehen/.test(o)); await pickN(ai); await wait(300);
    out.closed = !UH.cur && !V.DINE.menuOpen; out.released = !c.ped.aw || c.ped.aw.dur < 100;
    // Stimmungswechsel über die Beziehung
    c.ped.memAtt = 'neid'; c.ped.mem.r = 20; const up = X.shift(c, 9);
    c.ped.memAtt = 'bew'; c.ped.mem.r = -20; const down = X.shift(c, -12);
    out.shift = { up, down, title: X.title(c) };
    // Speichern mit Beziehung
    GD.save(); const sv = JSON.parse(localStorage.getItem('vespera.gedaechtnis')); const i = RD.citizens.indexOf(c);
    out.saved = sv.c[i] && sv.c[i].r;
    // Esc: Karte schließen beendet das Gespräch
    await wait(2500); goTo(); RD.citizenSay(c); await wait(1200);
    out.reopen = V.DINE.menuOpen; V.closeMenu(); IN.resume(); await wait(1600);
    out.escClosed = !UH.cur;
    // weggehen
    goTo(); RD.citizenSay(c); await wait(300); pl.p.x += 30; await wait(1600);
    out.awayClosed = !UH.cur; if (V.DINE.menuOpen) { V.closeMenu(); IN.resume(); }
    // Stadtgespräch-Antwort und Meinung je Stimmung
    out.ger = X.gerueht('skep'); out.ger2 = X.gerueht('bew');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(!r.miss.length, 'jede Stimmung hat Antworten ' + r.miss.join(','));
  ok(r.cit && r.c1.open && /Stimmung: /.test(r.c1.h) && r.c1.n === 6, 'Karte: ' + r.c1.h + ' · ' + r.c1.n + ' Antworten');
  ok(r.held, 'Person bleibt stehen');
  ok(r.ans1.length > 20 && !/\{/.test(r.ans1), 'Antwort: ' + r.ans1);
  ok(r.c2.open && r.c2.n === 5, 'zweite Runde ohne die schon gestellte Frage (' + r.c2.n + ')');
  ok(r.gabe.cash === 20 && r.gabe.dr > 0 && r.gabe.mem === 'gabe', 'Geschenk: 20 Lm, Beziehung +' + r.gabe.dr + ', gemerkt · ' + r.gabe.say);
  ok(r.closed && r.released, 'Verabschieden schließt und gibt die Person frei');
  ok(r.shift.up === 'resp' && r.shift.down === 'neid', 'Stimmung kippt: neidisch → ' + r.shift.up + ', bewundernd → ' + r.shift.down + ' · ' + r.shift.title);
  ok(typeof r.saved === 'number', 'Beziehung gespeichert: ' + r.saved);
  ok(r.reopen && r.escClosed, 'Esc beendet das Gespräch');
  ok(r.awayClosed, 'Weggehen beendet das Gespräch');
  ok(r.ger && r.ger2, 'Stadtgespräch: ' + r.ger + ' | ' + r.ger2);
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
