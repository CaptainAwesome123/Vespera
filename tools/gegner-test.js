// V60: Prüft die Gegner ohne Bilder (ganze Stadt, Bild angehalten, Abläufe von Hand getrieben):
// Überfall (Räuber kommt, bedroht, flieht vor Alexander, wird umgeworfen, Polizei kommt, stellt ihn auf, führt ihn ab),
// Taschendieb (entkommt, wenn Alexander weit weg ist), Bombe (hochgeworfen = entschärft, am Boden = Knall),
// Angriff der Anarchisten (Würfe und Schüsse, alle umgeworfen, Festnahmen), keine NaN, keine Fehler.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/gegner-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });   // ganze Stadt im Software-Renderer stürzt ab
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  const r = await p.evaluate(async () => {
    const G = await import('/src/gegner.js'), RD = await import('/src/ragdoll.js'), PL = await import('/src/player.js'), C = await import('/src/core.js'), PHY = await import('/src/physics.js'), S = await import('/src/serpentine.js');
    const { GEGNER } = G, { player } = PL, out = { log: [] };
    C.renderer.render = () => {};
    const setP = (x, y, z) => { player.p.set(x, y, z); player.v.set(0, 0, 0); player.onGround = true; player.fly = false; C.camera.position.set(x, y + 1.6, z); C.camera.rotation.set(0, 0, 0); C.camera.updateMatrixWorld(); };
    let nan = 0;
    const tick = (s, f) => { for (let k = 0; k < s * 20; k++) { if (f && f(k) === false) return; RD.updatePedestrians(0.05, k * 0.05); try { PHY.updateLoose(0.05); } catch (e) { } for (const pd of GEGNER.list) if (pd.a.on) { const e = pd.a.m.elements; if (!isFinite(e[12] + e[13] + e[14] + e[0])) nan++; } } };
    const role = r => GEGNER.list.filter(pd => pd.gg.role === r);
    out.pool = { raeuber: role('raeuber').length, anarchist: role('anarchist').length, polizei: role('polizei').length };
    out.allOff = GEGNER.list.every(pd => !pd.a.on && pd.gg.s === 'off');
    GEGNER.nextT = 1e9;   // nichts von selbst
    // ---- Überfall auf dem Belmont-Platz ----
    setP(0, 0.26, 120); tick(1);
    out.raub = G.gegnerStart('raub');
    const E = GEGNER.ev, R = E && E.R, v = E && E.v;
    let threat = -1; tick(15, k => { if (E.ph === 'threat') { threat = k / 20; return false; } });
    out.threat = threat; out.victimAct = v && v.a.gait[1]; out.robberAct = R && R.a.gait[1];
    out.robberNearVictim = R ? Math.hypot(R.gg.x - v.x, R.gg.z - v.z).toFixed(2) : -1;
    out.hud = document.getElementById('gegner') ? document.getElementById('gegner').textContent : '';
    // Alexander kommt: der Räuber flieht (und schießt vielleicht)
    setP(R.gg.x + 5, R.gg.y, R.gg.z); tick(1.5);
    out.flee = R.gg.s;
    // umwerfen (wie der Energieschub)
    const hit = G.gegnerTreffer(R.gg.x, R.gg.y, R.gg.z, 3, 0.8);
    tick(0.2); out.hit = hit; out.rag = !!R.rag || R.gg.s === 'down';
    let lay = -1; tick(10, k => { if (R.gg.s === 'down' && R.gg.lie && !R.rag) { lay = k / 20; return false; } });
    out.lay = lay; out.tilt = R.gg.tilt;
    let cops = -1, rise = -1, led = -1, gone = -1;
    tick(60, k => {
      const A = GEGNER.arrests[0];
      if (cops < 0 && A && A.ph === 'cuff') cops = k / 20;
      if (rise < 0 && R.gg.s === 'rise') rise = k / 20;
      if (led < 0 && R.gg.s === 'led') led = k / 20;
      if (R.gg.s === 'off') { gone = k / 20; return false; }
    });
    out.arrest = { cops, rise, led, gone, gefasst: GEGNER.stats.gefasst, copsOff: role('polizei').every(c => c.gg.s === 'off') };
    tick(3); out.raubOver = !GEGNER.ev; out.victimBack = v.st === 0 && !v.ggSave;
    // ---- Taschendieb: Alexander bleibt weg, der Dieb entkommt ----
    setP(-330, 0.26, -380); tick(1);
    out.dieb = G.gegnerStart('dieb');
    let esc = -1; const ent0 = GEGNER.stats.entkommen;
    tick(80, k => { if (k === 60) setP(-330, 0.26, -560); if (GEGNER.stats.entkommen > ent0) { esc = k / 20; return false; } });
    out.diebEsc = esc; tick(4); out.diebOver = !GEGNER.ev; out.roleBack = role('raeuber').length;
    // ---- Bombe: Anarchisten legen sie, Alexander wirft sie hoch ----
    setP(0, 0.26, 120); tick(1);
    let bomb = null;
    for (let i = 0; i < 6 && !GEGNER.ev; i++) { G.gegnerStart('bombe'); if (!GEGNER.ev) setP(-330 + i * 40, 0.26, -380); }
    const EB = GEGNER.ev; out.bombe = !!EB && EB.type === 'bombe'; out.bombeLabel = EB && EB.label;
    tick(40, k => { if (EB.bomb) { bomb = EB.bomb; return false; } });
    out.planted = !!bomb; out.fuse = bomb && Math.round(bomb.t);
    if (bomb) { bomb.B.x.y += 40; bomb.B.v.set(0, 8, 0); bomb.t = 0.5; }
    tick(2); out.bombResult = bomb && bomb.result; out.entschaerft = GEGNER.stats.entschaerft;
    tick(40, () => !!GEGNER.ev); out.bombeOver = !GEGNER.ev;
    // zweite Bombe: explodiert am Boden
    for (const pd of GEGNER.list) if (pd.gg.s !== 'off') { pd.gg.s = 'off'; pd.a.on = false; }
    GEGNER.arrests.length = 0;
    setP(0, 0.26, 120); tick(0.5);
    for (let i = 0; i < 6 && !GEGNER.ev; i++) { G.gegnerStart('bombe'); if (!GEGNER.ev) setP(-330 + i * 40, 0.26, -380); }
    const EB2 = GEGNER.ev; let bomb2 = null; tick(40, () => { if (EB2 && EB2.bomb) { bomb2 = EB2.bomb; return false; } });
    if (bomb2) bomb2.t = 0.3;
    tick(1.5); out.knall = bomb2 && bomb2.result; out.explodiert = GEGNER.stats.explodiert;
    tick(60, () => !!GEGNER.ev);
    for (const pd of GEGNER.list) if (pd.gg.s !== 'off') { pd.gg.s = 'off'; pd.a.on = false; }
    GEGNER.arrests.length = 0; GEGNER.ev = null;
    // ---- Angriff ----
    setP(0, 0.26, 120); tick(1);
    out.angriff = G.gegnerStart('angriff');
    const EA = GEGNER.ev, crew = EA ? EA.crooks : [];
    let thrown = 0; const shots0 = crew.reduce((a, pd) => a + (pd.gg.shots || 0), 0);
    tick(14, () => { thrown = Math.max(thrown, GEGNER.proj.filter(q => q.on).length); });
    out.crew = crew.length; out.fighting = crew.filter(pd => pd.gg.s === 'fight').length; out.thrownMax = thrown; out.projPool = GEGNER.proj.length;
    out.dists = crew.map(pd => Math.hypot(pd.gg.x - player.p.x, pd.gg.z - player.p.z).toFixed(1));
    // Telekinese: einer schwebt (gehalten), losgelassen fällt er und ist besiegt
    const c1 = crew[1]; const S1 = RD.ragLift(c1); tick(0.5); out.held = !!S1 && c1.gg.held && c1.rag && c1.rag.ph === 'tk';
    if (c1.rag) { c1.rag.ph = 'drop'; c1.rag.t = 0; } tick(0.3); out.dropDown = c1.gg.s === 'down';
    // Alexander rennt in einen hinein, die anderen wirft eine Heldenlandung um
    const c0 = crew[0]; player.v.set(6, 0, 0); player.p.set(c0.gg.x - 0.5, c0.gg.y, c0.gg.z); tick(0.1); player.v.set(0, 0, 0);
    out.contact = !!c0.rag || c0.gg.s === 'down';
    let downs = 0; for (const pd of crew) { if (pd.gg.s === 'fight' || pd.gg.s === 'flee') downs += G.gegnerTreffer(pd.gg.x, pd.gg.y, pd.gg.z, 1.5, 0.7); }
    tick(1); out.downs = crew.filter(pd => pd.gg.s === 'down').length;
    tick(240, () => !!(GEGNER.ev || GEGNER.arrests.length || GEGNER.list.some(pd => pd.a.on)));
    out.angriffOver = !GEGNER.ev; out.arrestsLeft = GEGNER.arrests.length; out.stats = { ...GEGNER.stats };
    out.nan = nan; out.ragLive = RD.RAG.live.length;
    out.onAfter = GEGNER.list.filter(pd => pd.a.on).length;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.pool.raeuber >= 2 && r.pool.anarchist >= 3 && r.pool.polizei >= 2 && r.allOff, 'Figuren angelegt und unsichtbar: ' + JSON.stringify(r.pool));
  ok(r.raub && r.threat > 0 && Math.abs(r.victimAct - 8.2) < 0.01 && Math.abs(r.robberAct - 4.3) < 0.01 && +r.robberNearVictim < 1.6, 'Überfall: Räuber kommt (' + r.threat + ' s), bedroht, Opfer Hände hoch');
  ok(/Überfall/.test(r.hud), 'Hinweis oben: ' + r.hud);
  ok(r.flee === 'flee', 'Räuber flieht vor Alexander');
  ok(r.hit === 1 && r.rag && r.lay > 0 && Math.abs(r.tilt + Math.PI / 2) < 0.01, 'umgeworfen, liegt dann auf dem Rücken (' + r.lay + ' s)');
  ok(r.arrest.cops > 0 && r.arrest.rise > 0 && r.arrest.led > 0 && r.arrest.gone > 0 && r.arrest.gefasst === 1 && r.arrest.copsOff, 'Polizei kommt, stellt ihn auf, führt ihn ab: ' + JSON.stringify(r.arrest));
  ok(r.raubOver && r.victimBack, 'Überfall beendet, Opfer geht weiter');
  ok(r.dieb && r.diebEsc > 0 && r.diebOver && r.roleBack === r.pool.raeuber, 'Taschendieb entkommt, wenn Alexander nicht kommt (' + r.diebEsc + ' s)');
  ok(r.bombe && r.planted && r.fuse > 30, 'Anarchisten legen eine Bombe: ' + r.bombeLabel + ', Zündschnur ' + r.fuse + ' s');
  ok(r.bombResult === 'entschaerft' && r.entschaerft === 1, 'hochgeworfene Bombe zerplatzt harmlos');
  ok(r.knall === 'knall' && r.explodiert === 1, 'Bombe am Boden explodiert');
  ok(r.angriff && r.crew >= 3 && r.thrownMax > 0, 'Angriff: ' + r.crew + ' Anarchisten werfen (' + r.thrownMax + ' Würfe in der Luft), Abstände ' + r.dists.join('/'));
  ok(r.held && r.dropDown, 'Telekinese: Anarchist zappelt in der Luft, losgelassen ist er besiegt');
  ok(r.contact, 'Alexander rennt einen um');
  ok(r.downs >= r.crew - 1, 'Treffer werfen alle um (' + r.downs + ')');
  ok(r.angriffOver && r.arrestsLeft === 0 && r.onAfter === 0, 'alles vorbei, alle abgeführt, keine Figur bleibt stehen (' + JSON.stringify(r.stats) + ')');
  ok(r.nan === 0, 'keine NaN-Lagen');
  ok(errs.length === 0, 'keine JS-Fehler' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
