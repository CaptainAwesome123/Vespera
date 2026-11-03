// V61: Prüft Kontor (Wirtschaft, Handel, Börse, Besitz, Stiftungen) und Aufgaben ohne Bilder (ganze Stadt, Bild angehalten):
// Handelsplätze stehen, Kaufen macht knapp und teuer, Verkaufen billig, Tagesabrechnung, Firmen kaufen/ausbauen/Löhne,
// Aktien, Stiftung, Lieferaufgabe (Kohle zum Kneipenplatz), Bürgeranliegen (Geschenk), Kiste zur Villa, Speichern.
// Bildschirmfotos des Kontorbuchs (SHOTS=1) nach out/kontor-<reiter>.png.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/kontor-test.js http://localhost:8765/
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
  await p.evaluate(() => { try { localStorage.removeItem('vespera.kontor'); } catch (e) {} });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera.kontor && window.vespera.kontor.KT.ready, null, { timeout: 60000, polling: 300 });
  const r = await p.evaluate(async () => {
    const K = await import('/src/kontor.js'), A = await import('/src/aufgaben.js'), PL = await import('/src/player.js'), C = await import('/src/core.js'), PHY = await import('/src/physics.js'), RD = await import('/src/ragdoll.js'), M = await import('/src/music.js'), H = await import('/src/harbour.js');
    const { KT } = K, { player } = PL, out = {};
    C.renderer.render = () => {};
    const setP = (x, y, z) => { player.p.set(x, y, z); player.v.set(0, 0, 0); player.onGround = true; player.fly = false; };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    out.biz = Object.keys(K.BIZ).length; out.shopsWrapped = M.INTERACT.filter(u => u.kt).length;
    out.posts = Object.keys(K.POSTS).map(k => [k, !!K.postPos(k)]);
    // Handel: Güterkai
    const kai = K.postPos('kai'); setP(kai.x, kai.y, kai.z); await wait(400);
    out.here = K.ktPostHere(); out.prompt = document.getElementById('prompt').textContent;
    const p0 = K.ktBuyP('kai', 'kaffee'), c0 = KT.s.cash;
    K.ktTrade('kai', 'kaffee', 40);
    out.kaffee = { p0: +p0.toFixed(2), p1: +K.ktBuyP('kai', 'kaffee').toFixed(2), lager: KT.s.lager.kaffee, paid: Math.round(c0 - KT.s.cash) };
    const luftBefore = K.ktSellP('luft', 'kaffee'), c1 = KT.s.cash;
    K.ktTrade('luft', 'kaffee', -40);
    out.sold = { gain: Math.round(KT.s.cash - c1), p0: +luftBefore.toFixed(2), p1: +K.ktSellP('luft', 'kaffee').toFixed(2), lager: KT.s.lager.kaffee || 0 };
    // Tagesabrechnung
    const stockLow = KT.s.mk.kai.kaffee, c2 = KT.s.cash, day = KT.s.day;
    K.ktNewDay();
    out.day = { day: KT.s.day - day, income: Math.round(KT.s.cash - c2), stock: [Math.round(stockLow), Math.round(KT.s.mk.kai.kaffee)] };
    // Besitz
    const shop = Object.keys(K.BIZ).find(id => id.startsWith('laden:'));
    out.buyShop = K.ktBuyBiz(shop) && K.ktOwns(shop); out.up = K.ktUpgrade(shop) && KT.s.own[shop].lvl === 2; K.ktLohn(shop); out.lohn = KT.s.own[shop].lohn;
    out.income = Math.round(K.bizIncome(shop));
    out.fabriken = Object.keys(K.BIZ).filter(id => id.startsWith('fabrik:'));
    // Börse
    const cp = KT.s.cp.radio; K.ktShares('radio', 1000); out.shares = { have: KT.s.shares.radio, up: KT.s.cp.radio > cp }; K.ktShares('radio', -1000); out.shares.after = KT.s.shares.radio || 0;
    // Stiftung
    const arb = KT.s.rep.arbeiter; out.fund = K.ktFund('oefen') && KT.s.rep.arbeiter > arb;
    // Aufgabe: Kohle zum Kneipenplatz
    const q = A.addQuest({ src: 'mayor', title: 'Test Kohle', text: 't', g: { k: 'ware', g: 'kohle', n: 10, to: 'kneipe' }, rw: { rep: { arbeiter: 5 } } }, 'aktiv');
    const dep = K.postPos('depot'); if (dep) { setP(dep.x, dep.y, dep.z); await wait(300); out.depHere = K.ktPostHere(); K.ktTrade('depot', 'kohle', 10); }
    out.kohle = KT.s.lager.kohle;
    const kn = K.postPos('kneipe'); setP(kn.x, kn.y, kn.z); await wait(500);
    out.deliverPrompt = document.getElementById('prompt').textContent;
    const use = M.INTERACT.find(u => u.test(player.p)); if (use) use.act();
    await wait(300); out.kohleDone = q.st;
    // Aufgabe: Geschenk für einen Bürger
    const ci = RD.citizens.findIndex(c => c.ped.a && c.ped.a.on);
    const def = A.citizenQuest(RD.citizens[ci], ci); out.citDef = def && def.g.k;
    const gq = A.addQuest({ src: 'buerger', who: RD.citizens[ci].name + ' · ' + RD.citizens[ci].job, ci, title: 'Test Geschenk', text: 't', g: { k: 'ding', kind: 'blumen', to: 'buerger' }, rw: { rep: { buerger: 4 }, cash: 3 } }, 'aktiv');
    out.giverLabel = RD.citizens[ci].use && RD.citizens[ci].use.label;
    KT.s.items.push({ k: 'blumen', n: 'Strauß weißer Rosen' });
    out.giverLabel2 = RD.citizens[ci].use && RD.citizens[ci].use.label;
    RD.citizens[ci].use.act(); out.giftDone = gq.st;
    // Kiste zur Villa
    const kq = A.addQuest({ src: 'randolf', title: 'Test Kiste', text: 't', g: { k: 'kiste', kind: 'crate', from: 'kai', to: 'villa' }, rw: { rep: { buerger: 2 } } }, 'aktiv');
    setP(kai.x, kai.y, kai.z); await wait(600);
    const B = A.AQ.rt[kq.id]; out.crate = !!B;
    if (B) { const V = A.placeOf('villa'); B.x.set(V.x + 2, V.y + 1, V.z + 2); B.v.set(0, 0, 0); await wait(600); }
    out.crateDone = kq.st;
    // Spur: HUD
    out.hud = document.getElementById('ktHud').textContent.slice(0, 120);
    // Speichern
    K.ktSave(); const sv = JSON.parse(localStorage.getItem('vespera.kontor')); out.saved = Math.round(sv.cash) === Math.round(KT.s.cash) && sv.q && sv.q.list.length > 0;
    out.nan = [KT.s.cash, ...Object.values(KT.s.cp), ...Object.values(KT.s.gp)].some(v => !isFinite(v));
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.biz > 30, 'Firmen zu kaufen: ' + r.biz);
  ok(r.shopsWrapped > 5, 'Ladentheken mit Kauf: ' + r.shopsWrapped);
  ok(r.posts.every(x => x[1]), 'alle Handelsplätze gesetzt');
  ok(r.here === 'kai' && /Handeln/.test(r.prompt), 'am Güterkai: ' + r.prompt);
  ok(r.kaffee.p1 > r.kaffee.p0 && r.kaffee.lager === 40, 'Kaufen macht Kaffee teurer');
  ok(r.sold.gain > 0 && r.sold.p1 < r.sold.p0 && r.sold.lager === 0, 'Verkaufen macht ihn billiger');
  ok(r.day.day === 1 && r.day.income > 0 && r.day.stock[1] > r.day.stock[0], 'Tagesabrechnung und Vorräte füllen sich');
  ok(r.buyShop && r.up && r.lohn === 2 && r.income > 0, 'Laden kaufen, ausbauen, Löhne');
  ok(r.shares.have === 1000 && r.shares.up && r.shares.after === 0, 'Aktien');
  ok(r.fund, 'Stiftung hebt Ansehen');
  ok(r.kohle === 10 && /Liefern/.test(r.deliverPrompt) && r.kohleDone === 'fertig', 'Lieferaufgabe Kohle: ' + r.deliverPrompt);
  ok(/Übergeben/.test(r.giverLabel2 || '') && r.giftDone === 'fertig', 'Geschenk an Bürger');
  ok(r.crate && r.crateDone === 'fertig', 'Kiste zur Villa');
  ok(r.saved && !r.nan, 'gespeichert, keine NaN');
  if (process.env.SHOTS) {
    for (const t of ['uebersicht', 'besitz', 'handel', 'boerse', 'stiftungen', 'aufgaben']) {
      await p.evaluate(async t => { const K = await import('/src/kontor.js'); if (t === 'aufgaben') { const A = await import('/src/aufgaben.js'), RD = await import('/src/ragdoll.js'); const ci = RD.citizens.findIndex(c => c.jk === 'Fabrikarbeiter'); const d = A.citizenQuest(RD.citizens[ci], ci); if (d) A.addQuest(d, 'aktiv'); A.addQuest({ src: 'mayor', title: 'Kohle für das Arbeiterviertel', text: 'Die Kältewelle trifft das Arbeiterviertel hart. Vierzig Sack Kohle am Kneipenplatz würden hundert Familien durch den Monat bringen.', g: { k: 'ware', g: 'kohle', n: 40, to: 'kneipe' }, rw: { rep: { arbeiter: 10 }, wohl: 4 } }, 'angebot'); }
      if (t === 'handel') { const PL = await import('/src/player.js'); const q = K.postPos('luft'); PL.player.p.set(q.x, q.y, q.z); } K.ktClose(); K.ktOpen(t); }, t);
      await p.waitForTimeout(400);
      fs.mkdirSync('out', { recursive: true }); await p.screenshot({ path: 'out/kontor-' + t + '.png' });
    }
  }
  ok(!errs.length, 'keine Fehler' + (errs.length ? ':\n' + errs.join('\n') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})();
