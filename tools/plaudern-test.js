// V113: Prüft mehr Gespräche und mehr Verhalten ohne Bilder (Bild angehalten): mehr Vorlagen, Themen aus der Lage (Erlebtes,
// Unfall, Alexander gesehen), Gespräche im Belmont und in der Kneipe, neue Fragen an Bürger, Hinterhergehen, Besorgungen.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/plaudern-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Gespräch:|Plaudern:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.plaudern && window.vespera.plaudern.PL.ready && window.vespera.gruppen && window.vespera.gruppen.GR.built, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.plaudern, { PL } = X, SP = await import('/src/serpentine.js'), GSM = await import('/src/gespraeche.js'), UHM = await import('/src/unterhaltung.js'), RD = await import('/src/ragdoll.js'), V = await import('/src/venues.js'), IN = await import('/src/input.js'), K = await import('/src/kontor.js'), STRM = await import('/src/strasse.js');
    const out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    pl.fly = false;
    out.added = PL.added; out.alexBew = GSM.ALEX.bew.length; out.opts = UHM.OPTS.map(o => o.id); out.max = UHM.UH.max;
    // Themen aus der Lage
    const W = SP.peds.filter(q => q.a && q.st === 0 && q.a.on !== false && q.lp && q.a.m.elements[13] < 2);
    const m = [W[0], W[1]], e = m[0].a.m.elements; pl.p.set(e[12] + 40, 0.3, e[14] + 40); await wait(600);
    m[0].mem = { p: { k: 'gabe', d: K.KT.s.day, ts: Date.now() } };
    window.vespera.ereignisse.event('crash', e[12] + 5, 0.2, e[14], 1, true);
    PL.seen.unshift({ x: e[12] + 3, z: e[14] + 3, t: PL.clock - 20 });
    const got = []; X.streetExtra((w, id, lines) => got.push(id + ' ' + lines[0]), m, 'b', 'skep');
    out.ctx = got;
    const G = window.vespera.gruppen.GR.groups.find(G => G.type === 'paar'); G.m[0].mem = { p: { k: 'abgewiesen', d: K.KT.s.day, ts: Date.now() } };
    out.gctx = X.groupCtx(G);
    // Belmont: Gäste reden in Sprechblasen
    pl.p.set(0, 0.26, -18); for (let i = 0; i < 30 && !PL.talks.some(T => T.kind === 'inside'); i++) await wait(500);
    const Ti = PL.talks.find(T => T.kind === 'inside'); out.inside = Ti && Ti.txt; out.plBub = document.querySelectorAll('.plBub').length;
    // Brass Lantern
    const B = V.VENUES.find(v => v.kind === 'bar'); out.bar = !!B;
    if (B) { pl.p.set((B.x0 + B.x1) / 2, 0.3, (B.z0 + B.z1) / 2); for (let i = 0; i < 30 && !PL.talks.some(T => T.kind === 'venue'); i++) await wait(500); const Tv = PL.talks.find(T => T.kind === 'venue'); out.venue = Tv && Tv.txt; }
    // neue Fragen an einen Bürger
    const c = RD.citizens.filter(c => !c.nf && !c.use && c.ped.a && c.ped.a.on).sort((a, b) => a.ped.a.m.elements[13] - b.ped.a.m.elements[13])[0];
    const ce = c.ped.a.m.elements; pl.p.set(ce[12] + 1.5, 0.3, ce[14] + 0.8); await wait(1500);
    const ce2 = c.ped.a.m.elements; pl.p.set(ce2[12] + 1.5, 0.3, ce2[14] + 0.8);
    RD.citizenSay(c); for (let i = 0; i < 10 && !V.DINE.menuOpen; i++) await wait(300);
    const card = [...document.querySelectorAll('#menuCard .items button')].map(b => b.textContent.slice(1));
    out.card = card;
    const ai = card.findIndex(t => /Arbeit im/.test(t)); if (ai >= 0) { V.placeOrder(ai); IN.resume(); await wait(200); out.arbeit = document.getElementById('say').textContent.slice(0, 140); }
    for (let i = 0; i < 12 && !V.DINE.menuOpen; i++) { const q = c.ped.a.m.elements; pl.p.set(q[12] + 1.5, 0.3, q[14] + 0.8); await wait(500); }
    const card2 = [...document.querySelectorAll('#menuCard .items button')].map(b => b.textContent.slice(1));
    const si = card2.findIndex(t => /bedrückt/.test(t)); if (si >= 0) { V.placeOrder(si); IN.resume(); await wait(200); out.sorgen = document.getElementById('say').textContent.slice(0, 140); }
    for (let i = 0; i < 12 && !V.DINE.menuOpen; i++) { const q = c.ped.a.m.elements; pl.p.set(q[12] + 1.5, 0.3, q[14] + 0.8); await wait(500); }
    const card3 = [...document.querySelectorAll('#menuCard .items button')].map(b => b.textContent.slice(1));
    const ei = card3.findIndex(t => /erlebt/.test(t)); if (ei >= 0) { V.placeOrder(ei); IN.resume(); await wait(200); out.erlebt = document.getElementById('say').textContent.slice(0, 140); }
    out.fourth = card3.length > 0;
    if (V.DINE.menuOpen) { V.closeMenu(); IN.resume(); }
    UHM.UH.cur && window.vespera.unterhaltung.close();
    out.state = [IN.playing, IN.paused, V.DINE.menuOpen, !!UHM.UH.cur, PL.clock.toFixed(1)].join(' '); await wait(1000); out.state += ' ' + PL.clock.toFixed(1) + ' ' + IN.paused;
    // Hinterhergehen: fünf Sekunden direkt neben einem Gehenden
    const f = SP.peds.find(q => q.a && q.a.on && q.st === 0 && !q.grp && !q.cit && q.a.m.elements[13] < 2 && Math.abs(q.v) > 0.8);
    const f0 = PL.n.follow; f.metT = 1e9; if (f.aw) window.vespera.ereignisse && 0;
    for (let i = 0; i < 40 && PL.n.follow === f0; i++) { const q = f.a.m.elements; if (f.st !== 0 || f.aw) break; pl.p.set(q[12] - Math.sin(Math.atan2(q[8], q[10])) * 1.6, 0.3, q[14] - Math.cos(Math.atan2(q[8], q[10])) * 1.6); await wait(250); }
    out.follow = PL.n.follow - f0; out.folSay = document.getElementById('say').textContent.slice(0, 100);
    // Besorgungen: am Stand kaufen
    const cnt = sp => SP.peds.filter(q => q.a && q.st === 0 && (q.a.m.elements[12] - sp.x) ** 2 + (q.a.m.elements[14] - sp.z) ** 2 < 22 * 22).length; const st = STRM.STR.vend.slice().sort((a, b) => cnt(b) - cnt(a))[0]; out.vend = STRM.STR.vend.length;
    pl.p.set(st.x + 12, 0.3, st.z + 10); await wait(1500);
    const k0 = PL.n.kauf + PL.n.zeitung;
    for (let i = 0; i < 40 && PL.n.kauf + PL.n.zeitung === k0; i++) { PL.errT = 0; for (const q of SP.peds) q.erT = 0; await wait(500); }
    out.errand = PL.n.kauf + PL.n.zeitung - k0; out.busyE = SP.peds.filter(q => q.aw && q.aw.fn === X.errandStep).length; for (let i = 0; i < 60 && !PL.talks.some(T => T.kind === 'errand'); i++) await wait(500); out.errTalk = (PL.talks.find(T => T.kind === 'errand') || {}).txt;
    // Kosten
    const t0 = performance.now(); for (let i = 0; i < 50; i++) { X.followTick(0.5); X.errandTick(); } out.ms = (performance.now() - t0) / 50;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.added >= 50 && r.alexBew >= 6, 'mehr Gespräche: ' + r.added + ' neue Vorlagen');
  ok(['arbeit', 'sorgen', 'erlebt'].every(k => r.opts.includes(k)) && r.max === 4, 'neue Fragen: ' + r.opts.join(','));
  ok(r.ctx.some(s => s.startsWith('pe:')) && r.ctx.some(s => s.startsWith('ev:')) && r.ctx.some(s => s.startsWith('se:')), 'Themen aus der Lage: ' + r.ctx.join(' | '));
  ok(r.gctx && r.gctx.length >= 2, 'Paar redet über Erlebtes: ' + JSON.stringify(r.gctx));
  ok(r.inside && r.plBub >= 1, 'Gäste im Belmont reden: ' + r.inside);
  ok(!r.bar || r.venue, 'Gäste in der Brass Lantern reden: ' + r.venue);
  ok(r.arbeit && r.arbeit.length > 20 && !/\{/.test(r.arbeit), 'Antwort zur Arbeit: ' + r.arbeit);
  ok(r.sorgen && r.sorgen.length > 15, 'Antwort zu Sorgen: ' + r.sorgen);
  ok(r.erlebt && r.erlebt.length > 15 && !/\{/.test(r.erlebt), 'Antwort zum Erlebten (vierte Frage): ' + r.erlebt);
  ok(r.follow >= 1, 'merkt, dass Alexander folgt: ' + r.folSay);
  ok(r.errand >= 1 && r.errTalk, 'Besorgung: ' + r.errTalk);
  ok(r.ms < 3, 'Prüfung ' + r.ms.toFixed(3) + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
