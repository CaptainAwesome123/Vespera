// V61: Prüft Kasimir, die großen Angriffe und die Verstecke ohne Bilder (ganze Stadt, Bild angehalten, Abläufe von Hand getrieben):
// Verstecke gefunden und gebaut, Boden unter der Stadt, Razzia in der Druckerei bis "ausgehoben", Aufstand mit Barrikade
// (Kasimir zäh, Verstärkung, Flucht), Dynamit, Showdown in der Station mit Höllenmaschine, Bombenserie, Bankraub; keine NaN, keine Fehler.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/boss-test.js http://localhost:8765/
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
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { } });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  const r = await p.evaluate(async () => {
    const G = await import('/src/gegner.js'), A = await import('/src/anfuehrer.js'), V = await import('/src/verstecke.js'), RD = await import('/src/ragdoll.js'), PL = await import('/src/player.js'), C = await import('/src/core.js'), PHY = await import('/src/physics.js'), M = await import('/src/music.js'), DR = await import('/src/driving.js');
    const { GEGNER, GEG } = G, { BOSS } = A, { VERST } = V, { player } = PL, out = { log: [] };
    try {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const setP = (x, y, z) => { player.p.set(x, y, z); player.v.set(0, 0, 0); player.onGround = true; player.fly = false; C.camera.position.set(x, y + 1.6, z); C.camera.rotation.set(0, 0, 0); C.camera.updateMatrixWorld(); };
    let nan = 0;
    const tick = (s, f) => { for (let k = 0; k < s * 20; k++) { if (f && f(k) === false) return; C.camera.position.set(player.p.x, player.p.y + 1.6, player.p.z); RD.updatePedestrians(0.05, k * 0.05); try { PHY.updateLoose(0.05); } catch (e) { } for (const pd of GEGNER.list) if (pd.a.on) { const e = pd.a.m.elements; if (!isFinite(e[12] + e[13] + e[14] + e[0])) nan++; } } };
    const clear = () => { for (const pd of GEGNER.list) if (pd.gg.s !== 'off') G.GEG.off(pd); GEGNER.arrests.length = 0; GEGNER.ev = null; };
    const knockAll = list => { for (const pd of list) if (['fight', 'flee', 'script', 'hold'].includes(pd.gg.s)) G.gegnerTreffer(pd.gg.x, pd.gg.y, pd.gg.z, 1.2, 0.7); };
    GEGNER.nextT = 1e9;
    out.pool = { anar: GEGNER.list.filter(pd => pd.gg.role === 'anarchist').length, pol: GEGNER.list.filter(pd => pd.gg.role === 'polizei').length, boss: !!A.bossPd() };
    // ---- Verstecke gefunden ----
    setP(0, 0.26, 120); tick(0.5);
    out.placed = VERST.list.map(H => [H.id, H.ok, H.ok ? [Math.round(H.ex), Math.round(H.ez)] : null]);
    // ---- Boden unter der Stadt ----
    const H = VERST.list[0];
    const gr = DR.groundAt(H.ox, H.oz, H.oy + 1); out.ground = gr && gr.y;
    // ---- Druckerei: E am Einstieg (nicht bekannt), nach zwei gefassten Anarchisten bekannt ----
    out.knownBefore = H.known;
    V.reveal(H, 'Test');
    setP(H.useX, H.ey + 0.05, H.useZ); tick(0.2);
    const down = M.INTERACT.find(it => it.test(player.p) && /hinab/i.test(it.label)); out.downLabel = down && down.label;
    if (down) down.act(); await sleep(700); tick(0.3);
    out.under = player.p.y < -20 && !!V.underAt(player.p);
    out.built = !!H.group && H.group.children.length;
    { const pp = new C.T.Vector3(H.ox + 1, H.oy + 0.4, H.oz + 1); out.collideG = PL.collide(pp, false); }
    const E = GEGNER.ev; out.raid = E && E.label; out.raidCrew = E ? E.crooks.length : 0;
    tick(3.5); out.alarm = E && E.ph;
    out.fight = E ? E.crooks.filter(pd => pd.gg.s === 'fight').length : 0;
    let thrown = 0; tick(6, () => { thrown = Math.max(thrown, GEGNER.proj.filter(q => q.on).length); }); out.raidThrown = thrown;
    out.crewY = E ? E.crooks.map(pd => (pd.gg.y - H.oy).toFixed(2)) : [];
    if (E) knockAll(E.crooks); tick(2);
    out.raidDown = E ? E.crooks.filter(pd => pd.gg.s === 'down').length : 0;
    let clearedT = -1; tick(150, k => { if (H.cleared) { clearedT = k / 20; return false; } });
    out.cleared = clearedT; out.ev0 = !!GEGNER.ev;
    out.copsUnder = GEGNER.list.filter(pd => pd.gg.role === 'polizei').every(c => c.gg.s === 'off');
    // hinauf
    const [lx, lz] = H.def.ladder; setP(H.ox + lx + 0.6, H.oy, H.oz + lz); tick(0.1);
    const up = M.INTERACT.find(it => it.test(player.p) && /hinauf/i.test(it.label)); out.upLabel = up && up.label;
    if (up) up.act(); await sleep(700); out.upY = player.p.y;
    await sleep(7500); tick(0.2);
    out.gewKnown = VERST.list[1].known;
    clear();
    // ---- Aufstand mit Kasimir ----
    let st = false; for (const [x, z] of [[0, 120], [-330, -380], [60, 470], [152, -700], [300, 200]]) { setP(x, 0.26, z); tick(0.3); st = G.gegnerStart('aufstand'); if (st) break; }
    const EA = GEGNER.ev; out.aufstand = st && EA.label; out.props = EA && EA.props.length; out.aCrew = EA && EA.crooks.length;
    const K = A.bossPd(); out.bossOn = K && K.gg.s;
    tick(4); out.bossFight = K.gg.s; out.hpStart = K.gg.hp;
    // Dynamit: Kasimir wirft (Abklingzeit sofort, Alexander 15 m entfernt)
    setP(K.gg.x + 15, K.gg.y, K.gg.z); K.gg.dcd = 0; K.gg.hold = 0;
    let dyn = 0; const boom0 = GEGNER.stats.explodiert; tick(3, () => { dyn = Math.max(dyn, BOSS.dyn.length); });
    out.dynThrown = dyn; tick(4); out.dynLeft = BOSS.dyn.length;
    // vier Treffer: dreimal steht er auf, bei 2 ruft er Verstärkung, bei 1 flieht er
    out.hpBefore = K.gg.hp + ':' + K.gg.s; K.gg.hp = 4;
    const hpSeq = []; let called = 0;
    for (let i = 0; i < 3; i++) {
      for (let w = 0; w < 80 && !['fight', 'flee'].includes(K.gg.s); w++) tick(0.1);
      G.gegnerTreffer(K.gg.x, K.gg.y, K.gg.z, 1.5, 0.8, 1, 0); tick(0.5);
      hpSeq.push(K.gg.hp + ':' + K.gg.s);
      called = Math.max(called, EA.crooks.length);
    }
    for (let w = 0; w < 120 && K.gg.s !== 'flee'; w++) tick(0.1);
    out.hpSeq = hpSeq; out.reinforced = called - out.aCrew; out.flee = K.gg.s;
    // er flieht und entkommt: die Station wird bekannt
    setP(K.gg.x + 400, 0.26, K.gg.z); let gone = -1; tick(90, k => { if (K.gg.s === 'off') { gone = k / 20; return false; } });
    out.escaped = gone; out.evIsA = GEGNER.ev === EA; tick(0.2); out.entk = BOSS.stats.entkommen; await sleep(3000); tick(0.1); out.stationKnown = VERST.list[2].known;
    knockAll(EA.crooks); tick(120, () => !!GEGNER.ev || GEGNER.arrests.length);
    clear();
    // ---- Showdown in der Station ----
    const S = VERST.list[2]; V.reveal(S);
    setP(S.useX, S.ey + 0.05, S.useZ); tick(0.2);
    const d2 = M.INTERACT.find(it => it.test(player.p) && /hinunter|hinab/i.test(it.label)); out.d2 = d2 && d2.label;
    if (d2) d2.act(); await sleep(700); tick(0.3);
    const ES = GEGNER.ev; out.showdown = ES && ES.label; out.bossInHQ = K.gg.s;
    tick(4); out.bossHQfight = K.gg.s;
    for (let i = 0; i < 2; i++) { for (let w = 0; w < 80 && K.gg.s !== 'fight'; w++) tick(0.1); G.gegnerTreffer(K.gg.x, K.gg.y, K.gg.z, 1.5, 0.8, 1, 0); tick(0.5); }
    out.machT = S.mach && S.mach.t;
    // entschärfen
    if (S.mach) setP(S.mach.x + 0.8, S.mach.y, S.mach.z + 0.8); tick(0.1);
    const df = M.INTERACT.find(it => it.test(player.p) && /Zündkabel|entschärfen/.test(it.label)); out.df = df && df.label;
    if (df) df.act(); out.machDone = S.mach && S.mach.done;
    for (let i = 0; i < 2; i++) { for (let w = 0; w < 80 && K.gg.s !== 'fight'; w++) tick(0.1); G.gegnerTreffer(K.gg.x, K.gg.y, K.gg.z, 1.5, 0.8, 1, 0); tick(0.5); }
    out.bossHpEnd = K.gg.hp + ':' + K.gg.s;
    knockAll(ES.crooks); tick(1);
    let sc = -1; tick(200, k => { if (S.cleared) { sc = k / 20; return false; } knockAll(ES.crooks); });
    out.stationCleared = sc; out.bossSt = BOSS.st;
    clear(); setP(0, 0.26, 120); await sleep(600);
    // ---- Bombenserie ----
    let bs = false; for (const [x, z] of [[0, 120], [-330, -380], [300, 200]]) { setP(x, 0.26, z); tick(0.3); bs = G.gegnerStart('bombenserie'); if (bs) break; }
    const EB = GEGNER.ev; out.serie = bs && EB.label; out.bombs = EB && EB.bombs.length;
    tick(1); out.hud = (document.getElementById('gegner') || {}).textContent;
    if (EB) for (const bm of EB.bombs) { bm.B.x.y += 40; bm.B.v.set(0, 8, 0); bm.t = 0.4; }
    tick(3); out.serieRes = EB && EB.bombs.map(bm => bm.result).join(','); tick(30, () => !!GEGNER.ev); out.serieOver = !GEGNER.ev;
    clear();
    // ---- Bankraub ----
    const ORTE = (await import('/src/orte.js')).ORTE; const Bk = ORTE.bank;
    out.bank = !!Bk;
    if (Bk) {
      setP(Bk.x1 + 40, 0.26, Bk.cz); tick(0.3);
      out.bankraub = G.gegnerStart('bankraub');
      const ER = GEGNER.ev; tick(2); out.robbersFlee = ER ? ER.crooks.filter(r => r.gg.s === 'flee').length : 0;
      if (ER) knockAll(ER.crooks); tick(2); out.bags = BOSS.bags.length;
      tick(120, () => !!GEGNER.ev || GEGNER.arrests.length); out.bankOver = !GEGNER.ev; out.robSt = ER && ER.crooks.map(r => r.gg.s + (r.gg.arrest ? '/' + r.gg.arrest.ph : ''));
    }
    out.nan = nan; out.stats = { ...GEGNER.stats }; out.verst = { ...VERST.stats }; out.boss = { ...BOSS.stats };
    out.saved = localStorage.getItem('vespera-verstecke');
    } catch (e) { out.err = e.message + ' ' + (e.stack || '').slice(0, 300); }
    return out;
  });
  console.log(JSON.stringify(r));
  ok(!r.err, 'Ablauf ohne Ausnahme' + (r.err ? ': ' + r.err : ''));
  ok(r.pool.anar >= 6 && r.pool.pol >= 4 && r.pool.boss, 'Figuren: ' + JSON.stringify(r.pool));
  ok(r.placed.every(q => q[1]), 'Einstiege gefunden: ' + JSON.stringify(r.placed));
  ok(Math.abs(r.ground - -24) < 0.01 && Math.abs(r.collideG - -24) < 0.01, 'Boden unter der Stadt (groundAt ' + r.ground + ', Spieler ' + r.collideG + ')');
  ok(!r.knownBefore && /Kellerluke/.test(r.downLabel || ''), 'Einstieg: ' + r.downLabel);
  ok(r.under && r.built > 0, 'hinabgestiegen, Raum gebaut (' + r.built + ' Netze)');
  ok(/Razzia/.test(r.raid || '') && r.raidCrew >= 4 && r.alarm === 'fight' && r.fight >= 3, 'Razzia: ' + r.raid + ', ' + r.raidCrew + ' Anarchisten, ' + r.fight + ' kämpfen');
  ok(r.raidThrown > 0 && r.crewY.every(y => Math.abs(+y) < 0.6), 'unten wird geworfen (' + r.raidThrown + '), alle stehen auf dem Boden ' + r.crewY.join('/'));
  ok(r.raidDown >= r.raidCrew - 1 && r.cleared > 0 && !r.ev0 && r.copsUnder, 'alle umgeworfen, Polizei holt sie über die Leiter, ausgehoben nach ' + r.cleared + ' s');
  ok(/Leiter hinauf/.test(r.upLabel || '') && r.upY > -1, 'Leiter hinauf, wieder oben (' + r.upY + ')');
  ok(r.gewKnown, 'Hinweis in der Druckerei: Kanalgewölbe bekannt');
  ok(!!r.aufstand && r.props >= 8 && r.aCrew >= 4 && r.bossOn === 'script' && r.bossFight === 'fight' && r.hpStart === 4, 'Aufstand: ' + r.aufstand + ', ' + r.props + ' Teile Barrikade, ' + r.aCrew + ' Anarchisten, Kasimir redet und kämpft');
  ok(r.dynThrown > 0 && r.dynLeft === 0, 'Kasimir wirft Dynamit, es explodiert');
  ok(r.hpSeq.join() === '3:down,2:down,1:down' && r.reinforced > 0 && r.flee === 'flee', 'Kasimir steht dreimal auf ' + r.hpSeq.join(' ') + ', ruft ' + r.reinforced + ' Genossen, flieht');
  ok(r.escaped > 0 && r.stationKnown, 'Kasimir entkommt in den Untergrund, Station Nordstern bekannt');
  ok(/Showdown/.test(r.showdown || '') && r.bossInHQ === 'script' && r.bossHQfight === 'fight', 'Showdown in der Station: ' + r.showdown);
  ok(r.machT > 0 && /Zündkabel/.test(r.df || '') && r.machDone === 'entschaerft', 'Höllenmaschine tickt (' + Math.round(r.machT) + ' s), Taste E entschärft');
  ok(r.stationCleared > 0 && r.bossSt === 'gefasst', 'Kasimir gefasst, Station ausgehoben nach ' + r.stationCleared + ' s');
  ok(!!r.serie && r.bombs === 3 && /Bombenserie/.test(r.hud || '') && r.serieRes === 'entschaerft,entschaerft,entschaerft' && r.serieOver, 'Bombenserie: ' + r.serie + ', alle entschärft');
  ok(!r.bank || (r.bankraub && r.robbersFlee >= 2 && r.bags >= 2 && r.bankOver), 'Bankraub: ' + r.robbersFlee + ' fliehen, ' + r.bags + ' Geldsäcke zurück');
  ok(r.nan === 0, 'keine NaN-Lagen');
  ok(errs.length === 0, 'keine JS-Fehler' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
