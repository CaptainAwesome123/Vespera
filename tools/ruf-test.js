// V62: Prüft Ruf und Ansehen ohne Bilder (ganze Stadt, Bild angehalten): Start, Achsen, Ereignisse (Gegner, Kasimir, Gala, Wurf,
// Energiestoß), Abnutzung, Toast, Titel, Haltungen der Leute, neue Sätze, Kontor-Rabatt, Takt der Anarchisten, Post mit Antwort,
// Geschäftstag, Taste Ö, Speichern. SHOTS=1: Bild des Buchs nach out/ruf-buch.png.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/ruf-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready, null, { timeout: 60000, polling: 300 });
  const r = await p.evaluate(async () => {
    const R = await import('/src/ruf.js'), K = await import('/src/kontor.js'), G = await import('/src/gegner.js'), AW = await import('/src/awe.js'), PW = await import('/src/powers.js'), EN = await import('/src/energy.js'), SP = await import('/src/serpentine.js');
    const { RUF } = R, { KT } = K, out = {};
    const wait = ms => new Promise(r => setTimeout(r, ms));
    out.start = { title: R.rufTitle(), ansehen: Math.round(R.rufAnsehen()), elite: KT.s.rep.elite, presse: RUF.s.presse, hud: (document.querySelector('#ktHud .ruf') || {}).textContent, hooks: !!AW.AWE.attHook && !!KT.rufBonus && !!EN.BLAST.onHits && !!PW.POWERS.onLetGo, post: RUF.s.post.length };
    // Gegner-Ereignisse über das Fenster
    const b0 = KT.s.rep.buerger, u0 = RUF.s.unter;
    window.dispatchEvent(new CustomEvent('vespera-gegner', { detail: { was: 'besiegt', role: 'anarchist' } }));
    window.dispatchEvent(new CustomEvent('vespera-gegner', { detail: { was: 'besiegt', role: 'anarchist' } }));
    const l = RUF.s.log[0]; out.besiegt = { up: KT.s.rep.buerger > b0, unter: RUF.s.unter < u0, n: l && l.n, faint: l && l.c.buerger < 1.2 };
    await wait(1600); const T = document.querySelector('#ktHud .rufT'); out.toast = { on: T.classList.contains('on'), text: T.textContent.slice(0, 120) };
    window.dispatchEvent(new CustomEvent('vespera-gegner', { detail: { was: 'boss', role: 'boss', boss: true } }));
    out.boss = { kasimir: !!RUF.s.deeds.kasimir, unter: Math.round(RUF.s.unter), line: AW.SAY_NEAR.bew.some(s => /Kasimir/.test(s)) };
    // Gala
    const e0 = KT.s.rep.elite; window.dispatchEvent(new CustomEvent('vespera-gala', { detail: { phase: 'ende', rede: 1, n: 1 } })); out.gala = KT.s.rep.elite > e0 && RUF.s.deeds.gala === 1;
    // Bürger werfen (Attrappe) und Energiestoß in die Menge
    const f0 = RUF.s.furcht, p0 = RUF.s.presse, w0 = KT.s.rep.arbeiter;
    PW.POWERS.onLetGo({ kind: 'ped', pd: { a: { kind: 'worker' } } }, true);
    out.wurf = { furcht: +(RUF.s.furcht - f0).toFixed(2), presse: +(RUF.s.presse - p0).toFixed(2), arbeiter: +(KT.s.rep.arbeiter - w0).toFixed(2) };
    const f1 = RUF.s.furcht; EN.BLAST.onHits([{ kind: 'ped', ref: { a: { kind: 'suit' } } }, { kind: 'ped', ref: { a: { kind: 'lady' } } }, { kind: 'ped', ref: { gg: {}, a: { kind: 'worker' } } }]); out.stoss = +(RUF.s.furcht - f1).toFixed(2);
    // Haltungen: bei hohem und tiefem Arbeiter-Ruf
    KT.s.rep.arbeiter = 90; const hi = R.rufAttP('arbeiter'); KT.s.rep.arbeiter = 15; const lo = R.rufAttP('arbeiter');
    out.att = { hiResp: +(hi.resp + hi.bew).toFixed(2), loResp: +(lo.resp + lo.bew).toFixed(2), loSkep: +lo.skep.toFixed(2), loHass: +(lo.hass || 0).toFixed(2) };
    const sample = []; for (let i = 0; i < 200; i++) sample.push(AW.attOf({ a: { kind: 'worker' } })); out.attLow = sample.filter(a => a === 'skep' || a === 'furcht' || a === 'hass').length;
    // neue Sätze bei niedrigem Arbeiter-Ruf (nach dem langsamen Schritt)
    RUF.slowT = 0; await wait(500); out.lowLines = AW.SAY_NEAR.skep.some(s => /brodelt/.test(s));
    // Post: Gewerkschaft taucht am neuen Tag auf, Antwort hebt den Ruf
    RUF.s.post = []; RUF.s.cd = {}; K.ktNewDay(); await wait(200);
    const gw = RUF.s.post.find(x => x.k === 'gewerkschaft'); out.postNew = RUF.s.post.map(x => x.k);
    if (gw) { const a0 = KT.s.rep.arbeiter; KT.s.cash = Math.max(KT.s.cash, 100000); window.vespera.ruf.answer(gw.id, 1); out.postAns = { arbeiter: +(KT.s.rep.arbeiter - a0).toFixed(1), gone: !RUF.s.post.includes(gw) }; }
    // Kontor-Rabatt durch Vorrecht
    KT.s.rep.elite = 70; const d0 = K.ktRepDisc('luft'); KT.s.rep.elite = 80; const d1 = K.ktRepDisc('luft');
    out.disc = { d0: +(d0 * 100).toFixed(2), d1: +(d1 * 100).toFixed(2), salon: R.rufHas('salon') };
    // Takt der Anarchisten
    RUF.s.unter = 90; RUF.slowT = 0; await wait(400); const aHi = G.GEGNER.rufAnar; RUF.s.unter = 5; RUF.slowT = 0; await wait(400); out.anar = { hi: +aHi.toFixed(2), lo: +G.GEGNER.rufAnar.toFixed(2) };
    // Titel wechseln
    const t0 = R.rufTitle(); for (const k of ['elite', 'buerger', 'arbeiter']) KT.s.rep[k] = 95; RUF.s.presse = 95; RUF.s.personal = 95; RUF.s.bew = 95; RUF.s.furcht = 10; out.title = [t0, R.rufTitle()];
    // Taste Ö öffnet das Buch
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Semicolon', key: 'ö', bubbles: true }));
    await wait(200); out.open = RUF.open && !document.getElementById('ruf').hidden; out.sections = document.querySelectorAll('#ruf section').length;
    out.panelTitle = document.querySelector('#ruf header h2').textContent;
    // Speichern
    R.rufSave(); const sv = JSON.parse(localStorage.getItem('vespera.ruf') || 'null'); out.saved = !!(sv && sv.v === 1 && sv.deeds.kasimir);
    out.peds = SP.peds.length;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.start.hooks, 'Anschlüsse gesetzt (Haltung, Kontor, Energiestoß, Telekinese)');
  ok(/RUF/.test(r.start.hud || ''), 'Titel im HUD: ' + r.start.hud);
  ok(r.besiegt.up && r.besiegt.unter && r.besiegt.n === 2 && r.besiegt.faint, 'Gegner besiegt: Bürger hoch, Untergrund runter, Abnutzung');
  ok(r.toast.on && /Bürger/.test(r.toast.text), 'Toast: ' + r.toast.text);
  ok(r.boss.kasimir && r.boss.line, 'Kasimir gefasst: Tat gemerkt, neuer Satz');
  ok(r.gala, 'Gala hebt die Gesellschaft');
  ok(r.wurf.furcht > 1 && r.wurf.presse < 0 && r.wurf.arbeiter < 0, 'Bürger geworfen: mehr Furcht, Presse und Gruppe sinken');
  ok(r.stoss > 0.5, 'Energiestoß in die Menge: mehr Furcht');
  ok(r.att.hiResp > r.att.loResp + 0.3 && r.attLow > 120, 'Haltung der Arbeiter folgt dem Ruf');
  ok(r.lowLines, 'Neue Sätze bei schlechtem Ruf unter Arbeitern');
  ok(r.postNew.includes('gewerkschaft') && r.postAns && r.postAns.arbeiter > 2 && r.postAns.gone, 'Post: Bittschrift der Gewerkschaft, Antwort wirkt');
  ok(r.disc.salon && r.disc.d1 > r.disc.d0 + 0.5, 'Vorrecht Ehrengast: mehr Rabatt am Luftschiffhafen');
  ok(r.anar.hi > 1.2 && r.anar.lo < 0.3, 'Anarchisten: Takt folgt dem Untergrund');
  ok(r.title[0] !== r.title[1], 'Titel wechselt: ' + r.title.join(' → '));
  ok(r.open && r.sections >= 5, 'Taste Ö öffnet das Buch');
  ok(r.saved, 'Gespeichert');
  if (process.env.SHOTS) { fs.mkdirSync('out', { recursive: true }); await p.screenshot({ path: 'out/ruf-buch.png' }); }
  const bad = errs.filter(e => !/favicon|ERR_|net::|Failed to load resource/.test(e));
  ok(!bad.length, 'keine Fehler' + (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  await b.close();
  process.exit(fails ? 1 : 0);
})();
