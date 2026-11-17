// V106: Prüft die Reaktionen auf Alexander ohne Bilder (Bild angehalten): Flucht vor Telekinese (hin und zurück), Schaulustige unter
// dem schwebenden Alexander, Fotograf mit Blitz und Wort für den Kurier, Bittsteller mit Antwort (Kontor, Gedächtnis), Buhrufe und
// Schneeball, Kosten je Prüfung.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/reaktionen-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Ruf:|Kontor:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.reaktionen && window.vespera.reaktionen.RK.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.reaktionen, RD = await import('/src/ragdoll.js'), R = await import('/src/ruf.js'), SP = await import('/src/serpentine.js'), K = await import('/src/kontor.js'), V = await import('/src/venues.js'), M = await import('/src/music.js'), G = await import('/src/gegner.js');
    const { RK } = X, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    G.GEGNER.ev = null;
    out.hooks = { interact: M.INTERACT.slice(0, 2).every(i => i.act === X.photoMenu || i.act === X.bitteMenu) };
    // auf einen belebten Gehweg (Arbeitsort eines Bewohners im Bürgerviertel)
    const c = RD.citizens.find(c => !c.nf && c.at && c.at.work && c.kind !== 'worker');
    pl.fly = false; pl.p.set(c.at.work.x + 1.5, 0.3, c.at.work.z + 1.5); await wait(3000);
    // belebteste Stelle in der Nähe suchen (viele Gehende auf 18 m)
    const busy = async () => {
      const W = SP.peds.filter(q => q.a && q.a.on && q.st === 0 && q.lp && !q.aw && q.a.m.elements[13] < 2);
      let best = null, bn = -1; for (const q of W) { const e = q.a.m.elements; let n = 0; for (const o of W) { const f = o.a.m.elements; if ((f[12] - e[12]) ** 2 + (f[14] - e[14]) ** 2 < 324) n++; } if (n > bn) { bn = n; best = e; } }
      if (best) { pl.p.set(best[12] + 2, 0.3, best[14] + 2); await wait(2500); }
      return bn;
    };
    out.busy = await busy();
    const near = () => SP.peds.filter(q => q.a && q.a.on && !q.aw && Math.hypot(q.a.m.elements[12] - pl.p.x, q.a.m.elements[14] - pl.p.z) < 18);
    out.near = near().length;
    // 1 Flucht: alle ängstlich machen, dann einen Bürger heben (Ruf-Schlüssel 'wurfciv')
    for (const q of near()) q.memAtt = 'furcht';
    const pos0 = new Map(near().map(q => [q, [q.a.m.elements[12], q.a.m.elements[14]]]));
    R.rufAdd({ furcht: 0.1 }, 'Test: geworfen', { key: 'wurfciv' });
    const fleeing = [...pos0.keys()].filter(q => q.aw && q.aw.fn);
    out.flee = { n: RK.n.flee, list: fleeing.length };
    const movedN = () => fleeing.filter(q => { const [x, z] = pos0.get(q), e = q.a.m.elements; return Math.hypot(e[12] - x, e[14] - z) > 2.5; }).length;
    for (let i = 0; i < 20 && !movedN(); i++) await wait(500);
    out.flee.moved = fleeing.filter(q => { const [x, z] = pos0.get(q), e = q.a.m.elements; return Math.hypot(e[12] - x, e[14] - z) > 2.5; }).length;
    out.flee.run = fleeing.filter(q => q.a.gait[2] > 0.7 || q.aw && q.aw.ph >= 1).length;
    for (let i = 0; i < 40 && fleeing.some(q => q.aw && q.aw.fn); i++) await wait(1000);
    out.flee.left = fleeing.filter(q => q.aw).map(q => q.aw.ph + "/" + q.aw.t.toFixed(0) + "/" + Math.hypot(q.aw.cx - q.aw.ox, q.aw.cz - q.aw.oz).toFixed(1) + "/" + !!q.a.on);
    out.flee.back = fleeing.filter(q => !(q.aw && q.aw.fn)).length;
    out.flee.home = out.flee.back;   // wer zurück ist, geht von seinem alten Platz aus weiter (aweEnd)
    for (const q of SP.peds) q.memAtt = null;
    // 2 Schaulustige: tief und langsam schweben
    pl.fly = true; pl.p.y = 12; if (pl.v) pl.v.set(0, 0, 0);
    await wait(11000);
    out.gather = { n: RK.n.gather, standing: RK.gather.filter(q => q.aw && q.aw.ph === 1).length, walking: RK.gather.filter(q => q.aw && q.aw.ph === 0).length };
    pl.p.y = 120; await wait(2500);
    out.gather.leaving = RK.gather.filter(q => !q.aw || q.aw.ph === 2).length;
    pl.fly = false; pl.p.y = 0.3; await wait(14000);
    out.gather.back = RK.gather.filter(q => !q.aw).length + '/' + RK.gather.length;
    // 3 Fotograf
    let news = null; window.addEventListener('vespera-news', e => { if (/Alexander auf der Straße/.test(e.detail.titel)) news = e.detail.titel; });
    RK.photoT = 0; await wait(800);
    out.photo = { started: !!RK.photo };
    for (let i = 0; i < 40 && RK.photo && RK.photo.aw.ph < 1; i++) await wait(500);
    await wait(3000);
    out.photo.flashes = RK.flashes || 0; out.photo.ph = RK.photo && RK.photo.aw && RK.photo.aw.ph;
    const pr0 = R.rufGet('presse');
    out.photo.dbg = RK.photo ? { ph: RK.photo.aw && RK.photo.aw.ph, t: RK.photo.aw && +RK.photo.aw.t.toFixed(1), d: RK.photo.aw && +Math.hypot(RK.photo.aw.cx - pl.p.x, RK.photo.aw.cz - pl.p.z).toFixed(1) } : null;
    X.photoMenu(); out.photo.menu = V.DINE.menuOpen; if (V.DINE.menuOpen) V.placeOrder(1); const IN = await import('/src/input.js'); IN.resume();
    out.photo.presse = +(R.rufGet('presse') - pr0).toFixed(2); out.photo.news = news;
    for (let i = 0; i < 40 && RK.photo; i++) await wait(1000); out.photo.done = !RK.photo;
    // 4 Bittsteller
    out.busy2 = await busy(); out.cand = !!X.candidate(6, 22, null); out.quiet = [window.vespera.player.fly, (await import("/src/input.js")).paused, V.DINE.menuOpen, !!G.GEGNER.ev]; for (const q of SP.peds) if (q.aw && !q.aw.fn) q.aw.dur = 0;
    for (let k = 0; k < 6 && !RK.bitte; k++) { RK.bitteT = 0; await wait(700); }
    out.bitte = { started: !!RK.bitte };
    for (let i = 0; i < 40 && RK.bitte && RK.bitte.aw.ph < 1; i++) await wait(500);
    const bp = RK.bitte; out.bitte.ph = bp && bp.aw && bp.aw.ph; out.bitte.typ = bp && bp.aw && bp.aw.B.id; out.bitte.say = document.getElementById('say').textContent.slice(0, 90);
    const cash0 = K.KT.s.cash; X.bitteMenu(); out.bitte.menu = V.DINE.menuOpen; if (V.DINE.menuOpen) { V.placeOrder(0); (await import('/src/input.js')).resume(); }
    out.bitte.cost = cash0 - K.KT.s.cash; out.bitte.mem = bp && bp.mem && bp.mem.p && bp.mem.p.k;
    // 5 Buhrufe: Arbeiter-Ruf tief, eine Runde in der Nähe feindselig
    K.KT.s.rep.arbeiter = 15;
    const grp = SP.peds.find(q => q.chat && q.chat.m.length >= 2 && q.a && q.a.on && Math.hypot(q.a.m.elements[12] - pl.p.x, q.a.m.elements[14] - pl.p.z) < 60);
    if (grp) { const e = grp.a.m.elements; pl.p.set(e[12] + 5, 0.3, e[14] + 2); grp.chat.rkT = 0; for (const o of grp.chat.m) o.memAtt = 'hass'; await wait(1500); RK.booT = 0; await wait(800); if (!RK.ball && !RK.n.ball) X.throwBall(grp); await wait(2500); }
    let dist = ''; try { dist = (await import('/src/boat.js')).districtAt(pl.p.x, pl.p.z, pl.p.y)[0]; } catch (e) {}
    out.boo = { dist, on: grp && grp.chat.m.map(o => !!(o.a && o.a.on) + ':' + o.memAtt).join(','), d: grp && +Math.hypot(grp.a.m.elements[12] - pl.p.x, grp.a.m.elements[14] - pl.p.z).toFixed(1), y: grp && +grp.a.m.elements[13].toFixed(1), grp: !!grp, n: RK.n.boo, ball: RK.n.ball, toast: document.getElementById('toast').textContent };
    // Kosten der regelmäßigen Prüfungen (ohne Anlass)
    RK.photoT = RK.bitteT = 999; RK.booT = 0;
    const t1 = performance.now(); for (let i = 0; i < 40; i++) { X.gather(0.25); X.photoTry(0.25); X.bitteTry(0.25); X.booTry(0.25); } out.msTick = +((performance.now() - t1) / 40).toFixed(3);
    const t2 = performance.now(); for (let i = 0; i < 10; i++) X.flee('heben'); out.msFlee = +((performance.now() - t2) / 10).toFixed(3);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.hooks.interact, 'E-Aktionen für Fotograf und Bittsteller vorn');
  ok(r.near >= 3, 'Passanten in der Nähe: ' + r.near);
  ok(r.flee.list > 0 && r.flee.moved > 0, `Flucht: ${r.flee.list} laufen los, ${r.flee.moved} schon weg`);
  ok(r.flee.back === r.flee.list, `alle wieder zurück: ${r.flee.back} von ${r.flee.list}`);
  ok(r.gather.n > 0 && r.gather.standing + r.gather.walking > 0, `Schaulustige: ${r.gather.n} (stehen ${r.gather.standing}, kommen ${r.gather.walking})`);
  ok(r.gather.leaving > 0, 'gehen wieder, wenn er wegfliegt: ' + r.gather.leaving + ', zurück ' + r.gather.back);
  ok(r.photo.started && r.photo.flashes > 0, 'Fotograf kommt, Blitze: ' + r.photo.flashes);
  ok(r.photo.menu && r.photo.presse > 0 && r.photo.news, 'Wort für den Kurier: Presse +' + r.photo.presse + ', Meldung: ' + r.photo.news);
  ok(r.photo.done, 'Fotograf geht wieder');
  ok(r.bitte.started && r.bitte.ph === 1 && r.bitte.menu, `Bittsteller (${r.bitte.typ}): ${r.bitte.say}`);
  ok(r.bitte.mem && /hilfe|autogramm|gabe/.test(r.bitte.mem), 'Bittsteller merkt sich die Hilfe (' + r.bitte.mem + ', ' + r.bitte.cost + ' Lm)');
  ok(r.boo.grp && r.boo.n > 0 && r.boo.ball > 0 && /Schneeball/.test(r.boo.toast), 'Buhrufe und Schneeball: ' + r.boo.toast);
  ok(r.msTick < 1.5, 'regelmäßige Prüfung ' + r.msTick + ' ms');
  ok(r.msFlee < 6, 'Flucht-Suche ' + r.msFlee + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
