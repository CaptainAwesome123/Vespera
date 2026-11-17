// V107: Prüft die Gespräche untereinander ohne Bilder (Bild angehalten): Vorlagen, Themen je Lage (Streik, Wetter, Kurier,
// Stadtgespräch), eine Runde in der Nähe redet mit Sprechblase und Gesten, Verstummen bei Alexander, Ende in der Ferne, Kosten.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/gespraeche-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error' || /Kontor:/.test(m.text())) errs.push(m.text().slice(0, 300)); });
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
  await p.waitForFunction(() => window.vespera.ruf && window.vespera.ruf.RUF.ready && window.vespera.gespraeche && window.vespera.gespraeche.GS.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const X = window.vespera.gespraeche, SP = await import('/src/serpentine.js'), K = await import('/src/kontor.js'), WL = await import('/src/wetterlage.js'), Z = await import('/src/zeitung.js'), GD = await import('/src/gedaechtnis.js');
    const { GS } = X, out = {}, pl = window.vespera.player, wait = ms => new Promise(r => setTimeout(r, ms));
    // Vorlagen
    const bad = [], all = [];
    const walk = o => { if (Array.isArray(o)) { if (typeof o[0] === 'string' && /^[ABC]: /.test(o[0])) all.push(o); else o.forEach(walk); } else if (o && typeof o === 'object') Object.values(o).forEach(walk); };
    [X.ALEX, X.STREIK, X.ARBEIT, X.WETTER, X.KURIER, X.STADT, X.WITZ].forEach(walk);
    for (const L of all) for (const s of L) if (!/^[ABC]: \S/.test(s) || /\{(?!titel|kurier)\w+\}/.test(s)) bad.push(s);
    for (const k in X.GOSSIP) { const Q = X.GOSSIP[k]; if (Q && Q.some(s => /\{(?!wann|t)\w+\}/.test(s))) bad.push(k); }
    out.vorlagen = { n: all.length, bad };
    // Themen je Lage
    const m = SP.peds.filter(q => q.a).slice(0, 2);
    const ids = () => { const S = new Set(); for (let i = 0; i < 300; i++) { GS.recent = []; const t = X.topics(m, 'a', 'skep'); if (t) S.add(t.id.split(':')[0] + ':' + (t.id.split(':')[1] || '').replace(/\d+$/, '')); } return [...S]; };
    out.basis = ids();
    K.KT.s.ev = [{ i: K.EVENTS.findIndex(e => e.streik), d: 2 }];
    WL.WL.ev = 'nordlicht';
    Z.ZEITUNG.archive.push({ nr: 99, lead: { titel: 'Neuer Turm am Kraterrand' }, items: [] });
    GD.MEM.s.g.unshift({ k: 'wurf', d: K.KT.s.day, ts: Date.now(), n: 1 });
    out.lage = ids();
    const one = id => { for (let i = 0; i < 400; i++) { GS.recent = []; const t = X.topics(m, 'a', 'skep'); if (t.id.startsWith(id)) return t.lines.join(' / '); } return null; };
    out.bsp = { streik: one('sk:'), wetter: one('wl:'), kurier: one('zt:'), gossip: one('gs:') };
    K.KT.s.ev = []; WL.WL.ev = null;
    // eine Runde in der Nähe
    GS.recent = [];
    const c = SP.CHATS.filter(c => !c.share && c.m.length >= 2 && !c.sit).sort((a, b) => Math.hypot(a.x - pl.p.x, a.z - pl.p.z) - Math.hypot(b.x - pl.p.x, b.z - pl.p.z))[0];
    out.chat = !!c;
    pl.fly = false; pl.p.set(c.x + 6, 0.3, c.z + 3); await wait(3000);
    for (const pd of c.m) if (pd.aw && !pd.aw.fn) pd.aw.dur = 0;
    c.gsT = 0;
    for (let i = 0; i < 20 && !GS.on.some(G => G.c === c); i++) await wait(500);
    const G = GS.on.find(G => G.c === c);
    out.started = !!G; out.n = GS.n;
    if (G) {
      const l0 = GS.lines; await wait(1500);
      out.bub = !!document.querySelector('.gsBub') && !!G.txt;
      out.acts = c.m.map(pd => +pd.a.gait[1].toFixed(1));
      out.ct = c.t;
      for (let i = 0; i < 30 && GS.on.includes(G); i++) await wait(500);
      out.lines = GS.lines - l0 + 1; out.total = G.lines.length; out.text = GS.log.slice(0, 4);
    }
    // Verstummen: Gespräch über Alexander erzwingen, dann ganz nah heran
    for (const G2 of GS.on.slice()) { G2.t = 0; G2.lines = []; G2.i = 0; }
    await wait(800); c.gsT = 0; GS.recent = [];
    let G3 = null; for (let k = 0; k < 30 && !G3; k++) { GS.recent = []; G3 = X.start(c, null); if (G3 && !G3.al) { G3.lines = []; await wait(300); G3 = null; c.gsT = 0; } }
    out.alStart = !!G3;
    if (G3) { const e = c.m[0].a.m.elements; pl.p.set(e[12] + 1.5, 0.3, e[14] + 1.2); const h0 = GS.hush; for (let i = 0; i < 12 && GS.hush === h0; i++) await wait(400); out.hush = GS.hush - h0; out.hushText = GS.log[0]; }
    // weit weg: Gespräche enden
    pl.p.set(c.x + 200, 0.3, c.z); await wait(2500);
    out.endFar = GS.on.length === 0 || GS.on.every(G => G.c !== c);
    out.ctAfter = c.t < 50;
    // Kosten
    pl.p.set(c.x + 6, 0.3, c.z + 3); await wait(1500);
    const t1 = performance.now(); for (let i = 0; i < 50; i++) X.scan(); out.msScan = +((performance.now() - t1) / 50).toFixed(3);
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.vorlagen.n > 30 && !r.vorlagen.bad.length, `Vorlagen: ${r.vorlagen.n} Gespräche ${r.vorlagen.bad.slice(0, 2).join(' | ')}`);
  ok(r.basis.some(s => s.startsWith('al:')) && r.basis.some(s => s.startsWith('ar:')) && !r.basis.some(s => s.startsWith('wl:') || s.startsWith('gs:')), 'ohne Wetterlage und Stadtgespräch: ' + r.basis.join(' '));
  ok(['sk:', 'wl:', 'zt:', 'gs:'].every(k => r.lage.some(s => s.startsWith(k))), 'mit Streik, Nordlicht, Kurier und Stadtgespräch: ' + r.lage.join(' '));
  ok(r.bsp.streik && r.bsp.wetter && /Neuer Turm/.test(r.bsp.kurier || '') && /geworfen/.test(r.bsp.gossip || ''), 'Beispiele: ' + JSON.stringify(r.bsp));
  ok(r.chat && r.started, 'Runde in der Nähe beginnt ein Gespräch');
  ok(r.lines >= r.total && r.total >= 2 && r.bub, `Sätze gesprochen: ${r.lines} (${(r.text || []).join(' / ')})`);
  ok(r.ct > 50, 'pedSocial wartet, solange geredet wird');
  ok(r.alStart && r.hush > 0, 'Pst, wenn er zu nah kommt: ' + r.hushText);
  ok(r.endFar && r.ctAfter, 'endet, wenn er weggeht');
  ok(r.msScan < 0.5, 'Suche ' + r.msScan + ' ms');
  ok(!errs.length, 'keine Fehler ' + errs.slice(0, 3).join(' | '));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
