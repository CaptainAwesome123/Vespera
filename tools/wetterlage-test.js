// V63: Prüft die Wetterereignisse ohne Bilder (ganze Stadt, Bild angehalten): neue Wetterlagen, Vorhersage, Start jedes Ereignisses,
// Zeitung, Kontor-Preise, Reaktion der Leute und des Verkehrs, Aufgaben mit Ruf, Punschwagen, Schollen, Sternschnuppen, Ende und Rückgabe.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/wetterlage-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Wetterlage/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.wetter && window.vespera.wetter.WL.ready && window.vespera.ruf && window.vespera.ruf.RUF.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const W = await import('/src/wetterlage.js'), A = await import('/src/atmosphere.js'), K = await import('/src/kontor.js'), Z = await import('/src/zeitung.js'), SP = await import('/src/serpentine.js');
    const TR = await import('/src/traffic.js'), PL = await import('/src/player.js'), MU = await import('/src/music.js'), R = await import('/src/ruf.js'), CO = await import('/src/core.js');
    const { WL } = W, { KT } = K, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const pl = PL.player;
    out.weathers = ['eisgang', 'frostnebel', 'meteore'].every(id => A.WEATHERS.some(w => w.id === id && w.w === 0));
    out.menu = true;
    // Vorhersage
    W.wlStart('sturm'); W.wlEnd(false);
    window.vespera.wetter.forecast('meteore'); out.forecast = { warn: WL.warn, ban: (document.getElementById('wlBan') || {}).textContent || '' };
    WL.warnT = 0.05; await wait(400); out.fromForecast = WL.ev === 'meteore'; W.wlEnd(false);
    // Schneesturm am Belmont-Platz
    pl.p.set(0, 0.26, 150); pl.fly = false;
    const z0 = Z.ZEITUNG.pending.length, b0 = KT.s.rep.buerger;
    W.wlStart('sturm', true);
    await wait(3500);
    const kohle = K.EVENTS.findIndex(e => e.t.startsWith('Kältewelle'));
    out.sturm = { w: A.ATMO.w.id, pinned: A.ATMO.pinned, news: Z.ZEITUNG.pending.length > z0, kt: KT.s.ev.some(e => e.i === kohle), mods: WL.mods.size,
      inside: [...WL.mods.values()].filter(m => m.k === 'in').length, hurry: [...WL.mods.values()].filter(m => m.k === 'hurry').length, slow: WL.cars.size, hid: WL.hid.size, boat: CO.shared.wxBoat, chats: WL.chats.size };
    WL.taskT = 0.05; WL.t = Math.max(WL.t, 10); await wait(2500);
    out.tasks = WL.tasks.map(t => t.k); out.carts = WL.carts.length; out.boxes = WL.box.count; out.piles = WL.pile.count; out.marks = document.querySelectorAll('#wlMk .m').length;
    // Aufgaben erledigen (über ihre E-Einträge)
    const r0 = R.rufGet('buerger');
    for (const t of WL.tasks.slice()) if (t.use) t.use.act();
    await wait(300);
    out.done = WL.done; out.ruf = +(R.rufGet('buerger') - r0).toFixed(2); out.interact = MU.INTERACT.filter(u => WL.tasks.some(t => t.use === u)).length;
    const tram = WL.tasks.find(t => t.k === 'bahn'); out.tramGo = tram ? tram.tr.v > 0 : 'keine Bahn';
    if (WL.carts[0]) { const c0 = KT.s.cash; WL.carts[0].use.act(); out.punsch = c0 - KT.s.cash; }
    W.wlEnd(true); await wait(2500);
    out.after = { ev: WL.ev, w: A.ATMO.w.id, pinned: A.ATMO.pinned, mods: WL.mods.size, tasks: WL.tasks.length, cars: WL.cars.size, extra: !!(WL.report && /Sturmnacht|Retter|packt/.test(WL.report.titel)), report: WL.report && WL.report.titel };
    // Nordlichtnacht: Menge auf dem Platz, Beifall beim Überflug
    W.wlStart('nordlicht', true); await wait(4500);
    out.nord = { gather: WL.items.filter(i => i.k === 'gather').length, stand: [...WL.mods.values()].filter(m => m.k === 'stand').length, chats: WL.chats.size };
    const bew0 = R.rufGet('bew'); pl.fly = true; pl.p.set(0, 60, 40); await wait(400); out.nord.cheer = WL.flyCheer; out.nord.bew = +(R.rufGet('bew') - bew0).toFixed(2); pl.fly = false;
    W.wlEnd(true); await wait(1500);
    // Eisgang über dem Hafen
    pl.fly = true; pl.p.set(60, 25, 620);
    W.wlStart('eisgang', true); await wait(5000);
    let n = 0; for (let i = 0; i < WL.fl.ok.length; i++) n += WL.fl.ok[i];
    out.eis = { count: WL.fl.m.count, ok: n };
    WL.taskT = 0.05; WL.t = Math.max(WL.t, 10); await wait(1500);
    const fl = WL.tasks.find(t => t.k === 'scholle'); out.eis.task = !!fl;
    if (fl) { pl.p.set(fl.x, fl.y + 1, fl.z); await wait(400); out.eis.rescued = fl.done; }
    W.wlEnd(true); await wait(500);
    // Meteoritenschauer: Schnuppen, Splitter fällt und wird aufgehoben
    pl.fly = false; pl.p.set(0, 0.26, 150);
    W.wlStart('meteore', true); WL.taskT = 0.05; WL.t = 10; await wait(1200);
    const sp = WL.tasks.find(t => t.k === 'splitter'); out.met = { u: +WL.met.material.uniforms.uMeteor.value.toFixed(2), vis: WL.met.visible, task: !!sp };
    if (sp) { sp.wait = 0; await wait(3500); out.met.landed = sp.landed; if (sp.landed) { sp.use.act(); out.met.done = sp.done; } }
    W.wlEnd(true); await wait(500);
    // Frostnebel startet, Taste N beendet das Ereignis ohne Meldung
    W.wlStart('frostnebel', true); await wait(1200); A.cycleWeather(); await wait(500); out.nKey = WL.ev === null;
    await wait(1500);
    out.final = { mods: WL.mods.size, hid: WL.hid.size, peds: SP.peds.length, open: WL.tasks.length };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.weathers, 'neue Wetterlagen Eisgang, Frostnebel, Meteoritenschauer (nicht im Zufall)');
  ok(r.forecast.warn === 'meteore' && /Vorhersage/.test(r.forecast.ban) && r.fromForecast, 'Vorhersage mit Banner, danach beginnt das Ereignis');
  ok(r.sturm.w === 'sturm' && r.sturm.pinned && r.sturm.news && r.sturm.kt, 'Schneesturm: Wetter, Zeitung, Kohle teurer');
  ok(r.sturm.inside > 20 && r.sturm.hurry > 5, `Schneesturm: Leute gehen hinein (${r.sturm.inside}) und eilen (${r.sturm.hurry})`);
  ok(r.sturm.slow > 50 && r.sturm.boat < 1, `Schneesturm: Wagen langsamer (${r.sturm.slow}, ausgeblendet ${r.sturm.hid}), Boote vorsichtig`);
  ok(r.tasks.filter(k => k === 'leute').length === 2 && r.piles > 0 && r.marks > 0, 'Aufgaben: zwei Gestrandete mit Schneewehen und Rauten (' + r.tasks.join(', ') + ')');
  ok(r.done >= 2 && r.ruf > 1 && r.interact === 0, `Aufgaben erledigt (${r.done}), Ruf bei Bürgern +${r.ruf}`);
  ok(r.tramGo === true || r.tramGo === 'keine Bahn', 'Straßenbahn wieder frei: ' + r.tramGo);
  ok(r.carts > 0 && r.punsch === 40, `Punschwagen (${r.carts}), Runde kostet 40 Lumen`);
  ok(!r.after.ev && r.after.w === 'schnee' && !r.after.pinned && r.after.tasks === 0 && r.after.cars === 0 && r.after.extra, 'Ende: Wetter frei, Schneefall danach, Bericht in der Zeitung');
  ok(r.nord.gather > 5 && (r.nord.stand + r.nord.chats) > 3, `Nordlichtnacht: Menge auf dem Platz (${r.nord.gather}), Leute schauen hinauf`);
  ok(r.nord.cheer && r.nord.bew > 0.5, 'Nordlichtnacht: Beifall und Bewunderung beim Überflug');
  ok(r.eis.ok > 20, `Eisgang: Schollen auf dem Wasser (${r.eis.ok})`);
  ok(r.eis.task && r.eis.rescued, 'Eisgang: Fischer von der Scholle geholt');
  ok(r.met.u > 0 && r.met.vis && r.met.landed && r.met.done, 'Meteoritenschauer: Schnuppen sichtbar, Splitter schlägt ein und wird aufgehoben');
  ok(r.nKey, 'Taste N beendet das Ereignis');
  ok(r.final.open === 0, 'keine offenen Aufgaben nach dem Ende');
  const bad = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource/.test(e));
  ok(!bad.length, 'keine Fehler' + (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
