// V111: Prüft Gruppen und Beziehungen ohne Bilder (Bild angehalten): Paare, Freunde, Familien gebildet, gleicher Schritt,
// Aufholen, Gespräch unterwegs (Sprechblase), gemeinsam stehen bleiben, Kind fragt nach Alexander, zusammen in den Laden, Sturz.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/gruppen-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Gruppe:|Ragdoll:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.gruppen && window.vespera.gruppen.GR.built, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.gruppen, { GR } = X, RD = await import('/src/ragdoll.js');
    const out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    pl.fly = false;
    out.n = { ...GR.n }; out.groups = GR.groups.length;
    out.formed = GR.groups.filter(G => G.m.every(pd => { let d = Math.abs(pd.t - G.L.t); d = Math.min(d, G.L.lp.total - d); return d < 1.5 && pd.grp === G; })).length / GR.groups.length; out.lat = GR.groups.every(G => new Set(G.m.map(pd => pd.lat)).size === G.m.length);
    out.shared = GR.groups.filter(G => G.m.some(pd => pd.memAtt) && G.m.every(pd => pd.memAtt === G.m[0].memAtt)).length;
    out.withAtt = GR.groups.filter(G => G.m.some(pd => pd.memAtt)).length;
    const pos = pd => pd.a.m.elements, gap = G => Math.max(...G.m.map(pd => Math.hypot(pos(pd)[12] - pos(G.L)[12], pos(pd)[14] - pos(G.L)[14])));
    const goNear = async (G, d = 12) => { const e = pos(G.L); pl.p.set(e[12] + d, 0.3, e[14] + 2); await wait(2200); };
    const findG = type => GR.groups.filter(G => G.type === type && G.m.every(pd => pd.st === 0 && !pd.aw && pd.a.on !== false) && pos(G.L)[13] < 2)[Math.floor(Math.random() * 5)];
    // 1 · gleicher Schritt in der Nähe
    const P = findG('paar'); await goNear(P);
    out.gapP = +gap(P).toFixed(2);
    // 2 · Aufholen: der Zweite bleibt 4 m zurück
    await goNear(P, 26); const F = P.m[1]; out.Faw = !!F.aw; F.t = (P.L.t - Math.sign(P.L.v) * 4 + P.L.lp.total) % P.L.lp.total; const c0 = GR.n.catchup;
    for (let i = 0; i < 40 && Math.abs(F.t - P.L.t) > 0.01; i++) await wait(500);
    out.caught = Math.abs(F.t - P.L.t) < 0.01 && F.v === P.L.v; out.catchN = GR.n.catchup - c0;
    // 3 · Gespräch unterwegs
    await goNear(P, 12); P.talkT = 0; P.alexT = 999;
    for (let i = 0; i < 10 && !GR.talks.some(K => K.G === P); i++) await wait(300);
    const K = GR.talks.find(K => K.G === P); out.talk = K && K.txt; out.bub = document.querySelectorAll('.grBub').length;
    for (let i = 0; i < 60 && GR.talks.includes(K); i++) await wait(500);
    out.talkEnd = !GR.talks.includes(K);
    // 4 · zusammen stehen bleiben
    const Fr = findG('freunde') || P; await goNear(Fr, 12); Fr.stopT = 0; Fr.talkT = 999; Fr.alexT = 999;
    for (let i = 0; i < 10 && !Fr.m.every(pd => pd.aw && pd.aw.fn); i++) await wait(300);
    out.stop = Fr.m.every(pd => pd.aw && pd.aw.fn); out.stopTalk = GR.talks.some(K => K.G === Fr);
    for (let i = 0; i < 60 && Fr.m.some(pd => pd.aw && pd.aw.fn); i++) await wait(500);
    out.stopEnd = Fr.m.every(pd => !(pd.aw && pd.aw.fn) && Math.abs(pd.t - Fr.L.t) < 1); out.stopSt = Fr.m.map(pd => pd.st + ':' + (pd.t - Fr.L.t).toFixed(2) + ':' + !!pd.aw).join(' ');
    // 5 · Familie: das Kind fragt nach Alexander
    const Fa = findG('familie'); out.fam = !!Fa;
    if (Fa) {
      const k0 = GR.n.kid; await goNear(Fa, 4); Fa.alexT = 0; const kid = Fa.m.find(pd => (pd.kind || pd.a.kind) === 'kid');
      for (let i = 0; i < 10 && GR.n.kid === k0; i++) { const e = pos(Fa.L); pl.p.set(e[12] + 3, 0.3, e[14] + 1); await wait(300); }
      const KK = GR.talks.find(K => K.G === Fa); out.kid = GR.n.kid - k0; out.kidLine = KK && KK.lines.map(l => (l.spk === kid ? 'Kind: ' : 'Eltern: ') + l.txt);
    }
    // 6 · zusammen in den Laden
    const D = GR.groups.find(G => G.m.every(pd => pd.st === 0 && !pd.aw) && G.L.lp.doors && G.L.lp.doors.length && pos(G.L)[13] < 2);
    out.door = !!D;
    if (D) {
      await goNear(D, 15); const g = D.L.lp.doors[0]; D.L.st = 1; D.L.k = 0; D.L.go = g; D.L.t = g.t;
      for (let i = 0; i < 10 && !D.m.every(pd => pd.st >= 1); i++) await wait(300);
      out.doorAll = D.m.every(pd => pd.st >= 1 && pd.go === g);
      for (let i = 0; i < 30 && !D.m.every(pd => pd.st === 2); i++) await wait(300);
      out.inside = D.m.every(pd => pd.st === 2);
      D.L.wait = 0.5; for (let i = 0; i < 40 && !D.m.every(pd => pd.st === 0); i++) await wait(500);
      out.outAll = D.m.every(pd => pd.st === 0);
    }
    // 7 · Sturz: der andere ruft und eilt herbei
    const S = findG('paar'); await goNear(S, 8); const r0 = GR.n.ruf;
    RD.knockDown(S.m[0], 3, 0, pl.p.x, pl.p.z); await wait(300);
    out.ruf = GR.n.ruf - r0; out.rush = !!(S.m[1].aw && S.m[1].aw.fn); out.rufLine = (GR.talks.find(K => K.G === S) || {}).txt;
    // Kosten: eine Prüfung aller Gruppen
    const t0 = performance.now(); for (let i = 0; i < 100; i++) X.tick(0); out.ms = (performance.now() - t0) / 100;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.n.paar > 50 && r.n.freunde > 30 && r.n.familie > 10, 'Gruppen gebildet: ' + JSON.stringify(r.n));
  ok(r.formed > 0.9 && r.lat, 'gleicher Weg, gleicher Schritt, nebeneinander (' + (r.formed * 100).toFixed(0) + ' %)');
  ok(r.withAtt === 0 || r.shared >= r.withAtt * 0.5, 'gemeinsame Meinung über Alexander (' + r.shared + ' von ' + r.withAtt + ')');
  ok(r.gapP < 1.5, 'Paar geht nebeneinander (Abstand ' + r.gapP + ' m)');
  ok(r.caught && r.catchN >= 1, 'wer zurückbleibt, holt auf');
  ok(r.talk && r.bub >= 1 && r.talkEnd, 'Gespräch unterwegs: ' + r.talk);
  ok(r.stop && r.stopEnd, 'bleiben zusammen stehen und gehen gemeinsam weiter' + (r.stopTalk ? ' (mit Gespräch)' : ''));
  ok(r.fam && r.kid >= 1 && r.kidLine && r.kidLine.length >= 2, 'Kind fragt nach Alexander: ' + JSON.stringify(r.kidLine));
  ok(r.door && r.doorAll && r.inside && r.outAll, 'gehen zusammen in den Laden und kommen zusammen heraus');
  ok(r.ruf >= 1 && r.rush, 'Sturz: der andere ruft und eilt herbei: ' + r.rufLine);
  ok(r.ms < 2, 'Prüfung aller Gruppen ' + r.ms.toFixed(3) + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'ALLES OK');
  process.exit(fails ? 1 : 0);
})();
