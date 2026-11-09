// V76: Prüft die Tagesabläufe ohne Bilder (ganze Stadt, Bild angehalten): Schichtarbeiter und ihre Pläne, Wege durchs Werkstor,
// Schichtwechsel, Stadtpuls nach der Uhr, Belegung der Lokale, Streikposten, Gespräche am Werkstor, Anzeige der Uhr.
// Die Zeit läuft im Test schnell vor (updateCitizens und alltagTick in einer Schleife), damit ein Spieltag keine 24 Minuten braucht.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/alltag-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Alltag|Leben:|Bewohner:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.alltag, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const A = await import('/src/alltag.js'), RG = await import('/src/ragdoll.js'), K = await import('/src/kontor.js'), M = await import('/src/music.js'), SP = await import('/src/serpentine.js'), V = await import('/src/venues.js');
    const { AT, SCHICHT } = A, { KT } = K, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    const sim = (sec, step = 0.5) => { for (let t = 0; t < sec; t += step) { RG.updateCitizens(step); A.alltagTick(step); } };
    const SW = AT.res.filter(c => c.res.type === 'schicht'), VI = AT.res.filter(c => c.res.type === 'viertel');
    KT.s.ev = []; KT.s.rep.arbeiter = 55; AT.force = 0; AT.strikeT = 0; await wait(300);
    // Aufbau
    const per = [0, 1, 2].map(s => SW.filter(c => c.res.s === s).length), thw = SW.map(c => c.res.thw).sort((a, b) => a - b);
    out.build = { fac: AT.fac.length, withHomes: AT.fac.filter(F => F.homes.length && F.pubs.length).length, schicht: SW.length, per, viertel: VI.length, lokal: !!AT.lokal, door: !!AT.door && AT.door.geometry.attributes.position.count,
      thwMed: Math.round(thw[thw.length >> 1]), thwMax: Math.round(thw[thw.length - 1]), extra: AT.extra.length, puls: AT.puls.length, inList: AT.res.every(c => RG.citizens.includes(c)), peds: AT.res.every(c => c.ped.a) };
    const cls = {}; for (const pd of AT.puls) cls[pd.puls.k] = (cls[pd.puls.k] || 0) + 1; out.cls = cls;
    out.planOk = SW.every(c => c.plan.length >= 2 && c.plan.every(([m, a]) => m >= 0 && m < 1440 && c.at[a]));
    out.hud = window.vespera.shared.clockText();
    // Stadtpuls: nachts leer, abends voll
    const visible = () => AT.puls.filter(pd => pd.puls.st == null).length;
    A.alltagUhr(3, 30); const night = visible(), nPark = AT.stats.parked; const offOk = AT.puls.filter(pd => pd.puls.st != null).every(pd => pd.st === 6 && !pd.a.on);
    const lantern = V.VENUES.find(v => v.kind === 'bar'), seated = v => v.peds.filter(q => q.seat && !q.g).length;
    const cafe = V.VENUES.find(v => v.cafe), rest = V.VENUES.find(v => v.kind === 'restaurant' && !v.cafe);
    const occNight = [seated(lantern), cafe ? seated(cafe) : -1, rest ? seated(rest) : -1];
    A.alltagUhr(20, 0); await wait(200); const eve = visible(); const occEve = [seated(lantern), cafe ? seated(cafe) : -1, rest ? seated(rest) : -1];
    A.alltagUhr(8, 0); const morn = visible();
    out.puls = { all: AT.puls.length, night, nPark, offOk, eve, morn, occNight, occEve, seats: lantern.seats.length, backOk: AT.puls.filter(pd => pd.puls.st == null).every(pd => pd.st !== 6) };
    // Schichtwechsel um 14 Uhr: Frühschicht drin, Spätschicht kommt, Frühschicht geht
    A.alltagUhr(9, 0); sim(60);
    const at = (s, f) => SW.filter(c => c.res.s === s && f(c)).length;
    const inWork = c => c.place === c.at.work && (c.st === 'in' || c.st === 'task' || (c.st === 'walk' && c.target && (c.target.task || c.target === c.place)) || c.st === 'out' || c.st === 'enter');
    const m10 = { frueh: at(0, inWork), spaet: at(1, inWork) };
    A.alltagUhr(13, 50); sim(1); const walkIn = at(1, c => c.st === 'walk' && c.doing === 'work');
    const one = SW.find(c => c.res.s === 1 && c.st === 'walk' && c.doing === 'work'), F1 = one && AT.fac.find(F => F.i === one.res.fi);
    const viaOk = !!one && one.path.some(q => Math.abs(q[0] - F1.place.via[0][0]) < 0.01 && Math.abs(q[1] - F1.place.via[0][1]) < 0.01) && one.path[one.path.length - 1][0] === F1.place.x;
    sim(10.5);   // bis 14:01
    const sir = AT.stats.last, arrived = at(1, inWork), still = at(0, inWork);
    sim(14);     // bis 14:15
    const leftWalk = at(0, c => c.st === 'walk' && (c.doing === 'bar' || c.doing === 'home')), gone = at(0, c => !inWork(c));
    out.shift = { per, m10, walkIn, viaOk, sir, arrived, still, leftWalk, gone, card: one && RG.citizenDoing(one), job: one && one.job };
    // Werkstor: sprechen im Fenster des Schichtwechsels
    A.alltagUhr(13, 56); sim(1);
    const F0 = AT.fac.find(F => F.homes.length); pl.p.set(F0.street.x + 1, 0.3, F0.street.z - 1); pl.fly = false; await wait(400);
    const find = re => M.INTERACT.find(u => { try { return u.test(pl.p) && re.test(u.label || ''); } catch (e) { return false; } });
    const g = find(/Werkstor/), ar0 = KT.s.rep.arbeiter, cash0 = KT.s.cash;
    if (g) { g.act(); await wait(100); out.gateMenu = document.getElementById('menuCard').textContent.slice(0, 120); V.placeOrder(1); await wait(200); }
    out.gate = { use: !!g, arbeiter: +(KT.s.rep.arbeiter - ar0).toFixed(2), cash: KT.s.cash - cash0, bier: AT.bierT > 0, wave: AT.wave };
    A.alltagUhr(10, 0); sim(1); out.gateOff = !find(/Werkstor/);
    // Streik: Posten beziehen, Transparent, Hof leer, verhandeln
    A.alltagUhr(9, 0); sim(20);
    AT.force = null; AT.calmT = 0; AT.talkT = 0; KT.s.rep.arbeiter = 20; AT.strikeT = 0; sim(90);
    const posts = SW.filter(c => c.picket && c.st === 'task').length, walkers = SW.filter(c => c.picket).length;
    const yard = AT.puls.filter(pd => pd.puls.k === 'werk'), yardOff = yard.filter(pd => pd.puls.st != null).length;
    pl.p.set(F0.street.x + 1, 0.3, F0.street.z - 3); await wait(2600);
    const pm = find(/Streikposten/), postOne = SW.find(c => c.picket && c.st === 'task'), card = postOne && RG.citizenDoing(postOne), struck = AT.struck.size, banner = F0.ban.visible;
    const ar1 = KT.s.rep.arbeiter;
    if (pm) { pm.act(); await wait(100); out.picketMenu = document.getElementById('menuCard').textContent.slice(0, 120); V.placeOrder(0); await wait(200); }
    out.strike = { struck, posts, walkers, yard: yard.length, yardOff, banner, use: !!pm, card, arbeiter: +(KT.s.rep.arbeiter - ar1).toFixed(1), calm: AT.calmT > 0 };
    KT.s.rep.arbeiter = 55; AT.strikeT = 0; sim(120);
    out.after = { struck: AT.struck.size, posts: SW.filter(c => c.picket).length, back: at(0, inWork), slots: AT.fac.reduce((s, F) => s + F.slots.filter(x => x.by).length, 0) };
    // Gespräch
    let lines = 0; for (let k = 0; k < 40; k++) { const s = RG.CIT_SAY[RG.CIT_SAY.length - 1](SW[k % SW.length]); if (s && !/\{/.test(s)) lines++; }
    out.talk = lines;
    // Kneipe: Alexander tritt ein
    A.alltagUhr(20, 0); AT.pubT = 0; window.vespera.shared.sayTimer = 0; pl.p.set(lantern.x, lantern.F + 0.1, lantern.z); await wait(1500);
    out.pub = { said: (document.querySelector('#say') || {}).textContent || '', pubT: AT.pubT > 0, seated: seated(lantern) };
    // Pausenmenü: Stadtuhr vorstellen; Rechenzeit des Takts
    const PMn = await import('/src/pausemenu.js'), row = PMn.TASTEN.gruppen.find(g => g.id === 'stadt').e.find(e => e.id === 'alltagUhr'), wz = PMn.TASTEN.gruppen.find(g => g.id === 'stadt').e.find(e => e.id === 'alltagWechsel');
    const c0 = RG.CLOCK.min; row && row.act(); const c1 = RG.CLOCK.min; wz && wz.act(); const [ni, nd] = A.naechsterWechsel();
    const coming = SW.filter(c => c.res.s === ni && c.st === 'walk' && c.doing === 'work').length;
    out.menu = { hour: Math.round(((c1 - c0 + 1440) % 1440)), state: row && row.an(), nd: Math.round(nd), coming, per: per[ni] };
    const tA = performance.now(); for (let k = 0; k < 600; k++) A.alltagTick(0.016); out.ms = +((performance.now() - tA) / 600).toFixed(3);
    out.end = { parked: AT.stats.parked, clock: Math.round(RG.CLOCK.min) };
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  const B = r.build;
  ok(B.fac >= 10 && B.withHomes >= B.fac - 2, `Fabriken mit Wohnungen und Kneipen: ${B.withHomes} von ${B.fac}`);
  ok(B.schicht >= B.withHomes * 6 && Math.min(...B.per) >= B.withHomes * 2, `Schichtarbeiter: ${B.schicht} (${B.per.join(' / ')})`);
  ok(B.viertel >= 8 && B.lokal, `Bewohner am Kneipenplatz: ${B.viertel}`);
  ok(B.inList && B.peds && r.planOk, 'alle Bewohner haben Figur und gültigen Plan');
  ok(B.thwMax < 300, `Weg zur Arbeit: Mitte ${B.thwMed} min, längster ${B.thwMax} min`);
  ok(B.door > 0 && B.extra > 10, `Hallentüren gebaut, ${B.extra} Raucher vor Kneipen`);
  ok(/Uhr · (Abend|Nacht|Morgen|Vormittag|Mittag|Nachmittag)/.test(r.hud), 'Uhr mit Tagesabschnitt: ' + r.hud);
  const P = r.puls;
  ok(P.all > 2000 && P.night < P.eve * 0.5 && P.offOk && P.backOk, `Stadtpuls: nachts ${P.night}, morgens ${P.morn}, abends ${P.eve} von ${P.all}`);
  ok(P.eve > P.all * 0.93, 'abends ist die Stadt so voll wie bisher');
  ok(P.occNight[0] < 12 && P.occEve[0] >= P.seats * 0.8, `Brass Lantern: nachts ${P.occNight[0]}, abends ${P.occEve[0]} von ${P.seats} Plätzen`);
  ok(P.occNight[1] < P.occEve[1] && P.occNight[2] < P.occEve[2], `Café und Restaurant: nachts ${P.occNight.slice(1)}, abends ${P.occEve.slice(1)}`);
  const S = r.shift;
  ok(S.m10.frueh >= S.per[0] * 0.9 && S.m10.spaet <= 2, `10 Uhr: Frühschicht im Werk (${S.m10.frueh} von ${S.per[0]}), Spätschicht nicht`);
  ok(S.walkIn > S.per[1] * 0.25 && S.viaOk, `13:50 Uhr: ${S.walkIn} der Spätschicht unterwegs, Weg führt durchs Werkstor`);
  ok(S.sir === 1 && S.arrived >= S.per[1] * 0.85, `14 Uhr: Sirene, ${S.arrived} von ${S.per[1]} der Spätschicht im Werk`);
  ok(S.gone >= S.per[0] * 0.75, `14:15 Uhr: Frühschicht hat Feierabend (${S.gone} draußen, ${S.leftWalk} noch unterwegs)`);
  ok(/Spätschicht/.test(S.card || '') && /Spätschicht/.test(S.job || ''), 'Namenskarte: ' + S.job + ' · ' + S.card);
  ok(r.gate.use && r.gate.arbeiter > 0 && r.gate.cash === -400 && r.gate.bier && r.gateOff, `Werkstor: Freibier (Ruf ${r.gate.arbeiter}, ${r.gate.cash} Lumen), außerhalb des Schichtwechsels kein Gespräch`);
  const T = r.strike;
  ok(T.struck === B.fac && T.posts >= S.per[0] * 0.7, `Streik: ${T.struck} Werke, ${T.posts} Posten vor den Toren`);
  ok(T.yardOff >= T.yard * 0.95 && T.yard > 20 && T.banner, `Höfe leer (${T.yardOff} von ${T.yard}), Transparent am Tor`);
  ok(T.use && T.arbeiter > 0 && T.calm && /Streikposten/.test(T.card || ''), `Verhandeln: Ruf ${T.arbeiter}, Karte: ${T.card}`);
  ok(r.after.struck === 0 && r.after.posts === 0 && r.after.slots === 0 && r.after.back >= S.per[0] * 0.8, `nach dem Streik: ${r.after.back} wieder im Werk`);
  ok(r.talk >= 10, `Gespräche über den Tagesablauf: ${r.talk} von 40`);
  ok(r.pub.pubT, 'Brass Lantern reagiert auf Alexander: ' + r.pub.said.slice(0, 80));
  ok(r.menu.hour === 60 && r.menu.nd === 10 && r.menu.coming >= r.menu.per * 0.5, `Pausenmenü: Uhr eine Stunde vor (${r.menu.state}), Sprung vor den Schichtwechsel: ${r.menu.coming} von ${r.menu.per} schon unterwegs`);
  ok(r.ms < 0.6, `Rechenzeit des Takts: ${r.ms} ms je Bild`);
  ok(!errs.length, 'keine Fehler in der Konsole' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await b.close();
  console.log(fails ? `${fails} FEHLER` : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
