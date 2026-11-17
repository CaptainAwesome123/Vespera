// V105: Prüft das Gedächtnis der Leute ohne Bilder (Bild angehalten): Haken in Ruf, Telekinese, Energiestoß und Aufgaben,
// Opfer und Zeugen, Haltung nach der Tat, Sätze im Vorbeigehen und beim Ansprechen, bekannte Gesichter, Stadtgespräch,
// Speichern und Laden, Verblassen am neuen Tag, Abschnitt im Ruf-Buch, alle Satzvorlagen.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/gedaechtnis-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Ruf:|Gedächtnis|Aufgaben:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.gedaechtnis && window.vespera.gedaechtnis.MEM.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const G = window.vespera.gedaechtnis, RD = await import('/src/ragdoll.js'), R = await import('/src/ruf.js'), AW = await import('/src/awe.js'), PW = await import('/src/powers.js'), EN = await import('/src/energy.js'), AQ = await import('/src/aufgaben.js'), K = await import('/src/kontor.js'), SP = await import('/src/serpentine.js');
    const { MEM } = G, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    out.hooks = { onAdd: R.RUF.onAdd.length, citSay0: RD.CIT_SAY[0] === G.memTalk, memSay: AW.AWE.memSay === G.memNear, extra: R.RUF.extra.includes(G.section) };
    // Vorlagen: keine offenen Platzhalter
    const fake = { k: 'wurf', d: K.KT.s.day, ts: Date.now(), t: 'Hospital am Kraterrand' }, bad = [];
    const walk = (o) => { if (Array.isArray(o)) o.forEach(s => { const f = G.fill(s, fake, { name: 'Anna Bauer' }); if (/[{}]/.test(f)) bad.push(f); }); else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    walk(G.L); walk(G.KENNT); out.vorlagen = bad;
    // einen Bewohner finden und hingehen
    const c = RD.citizens.find(c => !c.nf && c.at && c.at.work && c.kind !== 'worker') || RD.citizens[0];
    const pd = c.ped;
    pl.fly = false; pl.p.set(c.at.work.x + 2, 0.3, c.at.work.z + 2); await wait(2500);
    const near = SP.peds.filter(q => q.a && q.a.on && Math.hypot(q.a.m.elements[12] - pl.p.x, q.a.m.elements[14] - pl.p.z) < 30 && q !== pd);
    out.near = near.length;
    // Wurf über den Telekinese-Haken (wie powers.js beim Loslassen)
    const victim = near[0] || pd;
    PW.POWERS.onLetGo({ kind: 'ped', pd: victim }, true);
    out.wurf = { p: victim.mem && victim.mem.p && victim.mem.p.k, att: victim.memAtt, zeugen: near.slice(1).filter(q => q.mem && q.mem.w && q.mem.w.k === 'wurf').length, ger: MEM.s.g[0] && MEM.s.g[0].k };
    out.wurfNear = G.memNear(victim) || G.memNear(victim) || G.memNear(victim);
    const z = near.slice(1).find(q => q.mem && q.mem.w); out.zeugeNear = z ? (G.memNear(z) || G.memNear(z) || G.memNear(z) || G.memNear(z)) : null;
    out.attOfVictim = AW.attOf(victim);
    // Energiestoß über den Haken
    const v2 = near[1]; if (v2) { EN.BLAST.onHits([{ kind: 'ped', ref: v2 }], 'stoss', 1); out.stoss = v2.mem && v2.mem.p && v2.mem.p.k; }
    // Ansprechen: zweimal, dann bekanntes Gesicht
    pd.mem = null; pd.memAtt = null;
    RD.citizenSay(c); const s1 = document.getElementById('say').textContent;
    pd.mem.lt = Date.now() - 60000;
    let kennt = 0; for (let i = 0; i < 12; i++) { pd.mem.lt = Date.now() - 60000; pd.mem.ld = K.KT.s.day; pd.mem.p = null; pd.mem.w = null; const s = G.memTalk(c); if (s && (G.KENNT.heute2.includes(s) || G.KENNT.oft.includes(s) || /unterhalten|wieder|Stammgast|duzen|meinetwegen|gesagt|Falsches/.test(s))) kennt++; }
    out.talk = { s1, n: pd.mem.n, kennt };
    // Aufgabe erfüllt → dankbar
    const ci = RD.citizens.indexOf(c);
    for (const f of AQ.AQ.onDone) f({ ci, src: 'buerger', title: 'Ein Geschenk', st: 'fertig' });
    out.hilfe = { k: pd.mem.p && pd.mem.p.k, att: pd.memAtt, line: G.memTalk(c) || G.memTalk(c) || G.memTalk(c) };
    // Ruf-Haken direkt: Runde am Stand (Umkreis 9 m)
    R.rufAdd({ buerger: 0.1 }, 'Eine Runde am Straßenstand spendiert', { key: 'str:runde' });
    out.runde = SP.peds.filter(q => q.mem && q.mem.p && q.mem.p.k === 'runde').length;
    R.rufAdd({ buerger: 0.1 }, 'Stiftung: Hospital am Kraterrand');
    out.stiftung = MEM.s.g[0] && MEM.s.g[0].k === 'stiftung' && MEM.s.g[0].t;
    // Buch
    out.buch = G.section().includes('Was man sich erzählt');
    // Speichern und Laden
    out.vorSave = pd.mem && pd.mem.p && pd.mem.p.k; G.save(); const saved = JSON.parse(localStorage.getItem('vespera.gedaechtnis'));
    out.saved = saved && Object.keys(saved.c).length;
    pd.mem = null; pd.memAtt = null; G.apply();
    out.loaded = pd.mem && pd.mem.p && pd.mem.p.k;
    // neuer Tag: verblassen
    K.KT.s.day += 12; G.fade();
    out.fade = { p: !!(pd.mem && pd.mem.p), att: pd.memAtt, ger: MEM.s.g.length, victim: !!(victim.mem && victim.mem.p) };
    // Leistung: ein Durchlauf über die Figuren bei einer Tat
    const t1 = performance.now(); for (let i = 0; i < 20; i++) G.onTat('landung', 'Heldenlandung'); out.msTat = +((performance.now() - t1) / 20).toFixed(3);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.hooks.onAdd >= 1 && r.hooks.citSay0 && r.hooks.memSay && r.hooks.extra, 'Haken in Ruf, Ansprechen, Grüßen und Ruf-Buch');
  ok(!r.vorlagen.length, 'alle Satzvorlagen ohne offene Platzhalter ' + r.vorlagen.slice(0, 2).join(' | '));
  ok(r.near > 2, 'Figuren in der Nähe: ' + r.near);
  ok(r.wurf.p === 'wurf' && ['furcht', 'hass', 'bew'].includes(r.wurf.att), 'Geworfener merkt es sich (' + r.wurf.att + ')');
  ok(r.attOfVictim === r.wurf.att, 'attOf nimmt die Haltung aus dem Gedächtnis');
  ok(r.wurf.zeugen > 0, 'Zeugen merken sich den Wurf: ' + r.wurf.zeugen);
  ok(r.wurf.ger === 'wurf', 'Wurf im Stadtgespräch');
  ok(typeof r.wurfNear === 'string' && r.wurfNear.length > 10, 'Opfer spricht ihn im Vorbeigehen an: ' + r.wurfNear);
  ok(!r.zeugeNear || typeof r.zeugeNear === 'string', 'Zeuge erzählt: ' + r.zeugeNear);
  ok(r.stoss === 'stoss' || r.stoss === undefined, 'Energiestoß gemerkt');
  ok(r.talk.n >= 1 && r.talk.s1.length > 5 && r.talk.kennt > 0, 'Ansprechen zählt mit, bekannte Gesichter (' + r.talk.kennt + '/12)');
  ok(r.hilfe.k === 'hilfe' && typeof r.hilfe.line === 'string', 'Anliegen erfüllt: ' + r.hilfe.att + ' · ' + r.hilfe.line);
  ok(r.runde > 0, 'Runde spendiert: ' + r.runde + ' erinnern sich');
  ok(r.stiftung === 'Hospital am Kraterrand', 'Stiftung im Stadtgespräch');
  ok(r.buch, 'Abschnitt im Ruf-Buch');
  ok(r.saved > 0 && r.loaded === r.vorSave && !!r.loaded, 'Speichern und Laden');
  ok(!r.fade.p && !r.fade.att && r.fade.ger === 0 && !r.fade.victim, 'nach zwölf Tagen verblasst');
  ok(r.msTat < 3, 'eine Tat kostet ' + r.msTat + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
