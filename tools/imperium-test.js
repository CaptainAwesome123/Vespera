// V76: Prüft Alexanders Imperium (Kontor · Reiter Imperium) ohne Bilder (ganze Stadt, Bild angehalten):
// Rechnung je Sparte (übliche Einstellungen = alter Ertrag), Preise/Arbeitszeit/Löhne, Zufriedenheit, Forderung,
// Streik (Sparte bringt nichts, Bahn steht, Kundgebung), Streikende, Vertragsbruch, Vorlagen, Kredit, Wort halten, Speichern.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/imperium-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /Imperium|Kontor/.test(m.text()))) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.imperium && window.vespera.imperium.IMP.ready, null, { timeout: 60000, polling: 300 });
  const r = await p.evaluate(async () => {
    const K = await import('/src/kontor.js'), I = await import('/src/imperium.js'), C = await import('/src/core.js');
    const { KT } = K, { IMP } = I, out = {}; C.renderer.render = () => {};
    const rnd = Math.random, fix = v => { Math.random = () => v; }, free = () => { Math.random = rnd; };
    const S = () => IMP.s;
    out.wohnbau = K.ktOwns('wohnbau'); out.tab = !!KT.tabs.imperium;
    // übliche Einstellungen: Gewinn = alter Ertrag (Auslastung 1, Moral 1)
    S().sp.hotel.ausl = 1; S().sp.hotel.zuf = 50; S().sp.wohnen.ausl = 1;
    const R0 = I.impSum('hotel'); out.rech = { um: Math.round(R0.um), gew: Math.round(R0.gew), biz: Math.round(K.bizIncome('belmont')), soll: Math.round(42000 * 1.6 * (0.8 + 0.4 * KT.s.wohl / 100) * (KT.s.sec.hotel || 1)) };
    // Preise: exklusiv bringt sofort mehr, dann sinkt die Auslastung
    I.impSet('hotel', 'preis', 2); out.preisHoch = Math.round(I.impSum('hotel').gew);
    I.impSet('hotel', 'preis', 1);
    // Arbeitszeit und Löhne
    I.impSet('hotel', 'zeit', 2); out.zeit12 = Math.round(I.impSum('hotel').gew); I.impSet('hotel', 'zeit', 1);
    I.impSet('hotel', 'lohn', 2); out.lohnGross = [KT.s.own.belmont.lohn, Math.round(I.impSum('hotel').gew)]; I.impSet('hotel', 'lohn', 1);
    // Fabrik und Bahn kaufen
    KT.s.cash = 9e6; const fab = Object.keys(K.BIZ).find(id => id.startsWith('fabrik:') && K.BIZ[id].prod);
    K.ktBuyBiz(fab); K.ktBuyBiz('bahn'); out.fab = fab; out.ind = I.impIds('industrie').length;
    // Zufriedenheit sinkt bei 12 Stunden und knappen Löhnen, Tage vergehen
    I.impSet('industrie', 'zeit', 2); I.impSet('industrie', 'lohn', 0);
    const z0 = S().sp.industrie.zuf; fix(0.99); K.ktNewDay(); K.ktNewDay(); free(); out.zuf = [Math.round(z0), Math.round(S().sp.industrie.zuf)];
    // Forderung, ablehnen, Streik
    S().sp.industrie.zuf = 20; S().ford = null; S().sp.industrie.ruhe = 0;
    out.ford = I.impFordNeu('industrie') && S().ford.k; out.hud1 = document.querySelector('#ktHud .imp').textContent;
    fix(0.01); I.impFordAntwort(2); free();
    out.streik = !!S().sp.industrie.streik; out.streikFn = KT.streikFn(); out.still = KT.stillFn(fab); out.gewStreik = Math.round(K.bizIncome(fab));
    const lager0 = JSON.stringify(KT.s.lager); fix(0.99); K.ktNewDay(); free(); out.keineWare = JSON.stringify(KT.s.lager) === lager0;
    // Buch zeichnen
    K.ktOpen('imperium'); out.html = document.querySelector('#kt main').innerHTML.length; out.warn = !!document.querySelector('#kt .q.warn'); out.sparten = document.querySelectorAll('#kt .sp').length;
    // Streik durch Erfüllen beenden (Klick)
    document.querySelector('#kt [data-id="streik:industrie:erfuellt"]').click();
    out.ende = !S().sp.industrie.streik && S().sp.industrie.zeit === 1 && S().sp.industrie.vertrag > KT.s.day;
    // Vertragsbruch: Schicht wieder verlängern -> sofort Streik
    I.impSet('industrie', 'zeit', 2); out.bruch = !!S().sp.industrie.streik;
    I.impStreikEnde('industrie', 'polizei'); out.polizei = !S().sp.industrie.streik;
    // Bahnerstreik: Wagen stehen
    I.impFordNeu('verkehr', 'lohn'); fix(0.01); I.impFordAntwort(2); free(); out.bahnStill = KT.bahnStill === true;
    I.impStreikEnde('verkehr', 'brecher'); out.brecher = KT.bahnStill === false && !!S().sp.verkehr.streik;
    I.impStreikEnde('verkehr', 'erfuellt'); out.bahnFrei = !S().sp.verkehr.streik;
    // Vorlage
    out.vor = I.impVorNeu('kantine'); K.ktRenderNow(); const c0 = KT.s.cash;
    document.querySelector('#kt [data-id="vor:kantine:0"]').click(); out.vorDone = S().ent.kantine === 0 && Math.round(c0 - KT.s.cash) === 80000;
    // Kredit
    const w0 = K.netWorth(); I.impKredit(100000); out.kredit = S().kredit === 100000 && Math.abs(K.netWorth() - w0) < 1; I.impKredit(-100000); out.tilgt = S().kredit === 0;
    // Wort vom Kneipenplatz
    KT.onVersprechen(); I.impSet('hotel', 'lohn', 2); out.wort = S().wort && S().wort.ok === 1;
    fix(0.99); K.ktNewDay(); K.ktNewDay(); free(); out.wortWeg = S().wort === null;
    // Mieten: Lebenshaltung steigt
    const l0 = I.impLeben(); I.impSet('wohnen', 'preis', 2); out.leben = I.impLeben() > l0;
    // Börse und Übersicht zeichnen
    K.ktOpen('boerse'); out.boerse = /Vespera-Index/.test(document.querySelector('#kt main').innerHTML);
    K.ktOpen('uebersicht'); out.ueb = /Konjunktur/.test(document.querySelector('#kt main').innerHTML); K.ktClose();
    // Speichern, keine NaN
    K.ktSave(); const sv = JSON.parse(localStorage.getItem('vespera.kontor')); out.saved = !!(sv.imp && sv.imp.ent.kantine === 0);
    out.nan = [KT.s.cash, K.netWorth(), S().konj, ...S().idx, ...Object.values(S().sp).flatMap(q => [q.zuf, q.ausl]), ...Object.values(KT.s.cp)].some(v => !isFinite(v));
    K.ktReset(); out.reset = Object.keys(S().ent).length === 0 && K.ktOwns('wohnbau');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.wohnbau && r.tab, 'Wohnungsbau gehört Alexander, Reiter Imperium da');
  ok(Math.abs(r.rech.gew - r.rech.soll) < 5 && r.rech.biz === r.rech.gew && r.rech.um > r.rech.gew * 2, 'übliche Einstellungen ergeben den alten Ertrag: ' + r.rech.gew + ' / ' + r.rech.soll);
  ok(r.preisHoch > r.rech.gew && r.zeit12 > r.rech.gew, 'hohe Preise und lange Schichten bringen zuerst mehr');
  ok(r.lohnGross[0] === 2 && r.lohnGross[1] < r.rech.gew, 'großzügige Löhne kosten Gewinn');
  ok(r.ind === 1, 'Fabrik gekauft: ' + r.fab);
  ok(r.zuf[1] < r.zuf[0], 'Zufriedenheit sinkt bei 12 Stunden und knappem Lohn: ' + r.zuf);
  ok(r.ford === 'zeit' && /Forderung/.test(r.hud1), 'Forderung: ' + r.ford + ' · Anzeige: ' + r.hud1);
  ok(r.streik && r.streikFn && r.still && r.gewStreik < 0 && r.keineWare, 'Streik: Werk steht, kostet Unterhalt, liefert nichts');
  ok(r.html > 3000 && r.warn && r.sparten === 6, 'Buch gezeichnet: ' + r.sparten + ' Sparten');
  ok(r.ende, 'Forderung erfüllen beendet den Streik, Abmachung gilt');
  ok(r.bruch && r.polizei, 'Vertragsbruch löst Streik aus, Polizei bricht ihn');
  ok(r.bahnStill && r.brecher && r.bahnFrei, 'Bahnerstreik hält die Bahn an, Streikbrecher und Erfüllen');
  ok(r.vor && r.vorDone, 'Vorlage entscheiden');
  ok(r.kredit && r.tilgt, 'Kredit leihen und tilgen');
  ok(r.wort && r.wortWeg, 'Wort vom Kneipenplatz wird nachgehalten');
  ok(r.leben && r.boerse && r.ueb, 'Lebenshaltung, Börse und Übersicht');
  ok(r.saved && !r.nan && r.reset, 'gespeichert, keine NaN, Zurücksetzen');
  if (process.env.SHOTS) {
    await p.evaluate(async () => { const K = await import('/src/kontor.js'), I = await import('/src/imperium.js'); K.KT.s.cash = 9e6; K.ktBuyBiz('bahn'); I.impVorNeu('nachtbahn'); I.impFordNeu('hotel', 'lohn'); K.ktOpen('imperium'); document.getElementById('overlay').hidden = true; });
    await p.waitForTimeout(400); fs.mkdirSync('out', { recursive: true }); await p.screenshot({ path: 'out/imperium.png' });
    await p.evaluate(() => { document.querySelector('#kt main').scrollTop = 520; }); await p.screenshot({ path: 'out/imperium-2.png' });
  }
  ok(!errs.length, 'keine Fehler' + (errs.length ? ':\n' + errs.join('\n') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})();
