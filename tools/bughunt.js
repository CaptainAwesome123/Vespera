// V40: Fehlerjagd ohne Zeichnen (Software-Renderer bräuchte Minuten je Bild). Lädt das Spiel, schaltet das Zeichnen ab und
// prüft die Spiellogik an vielen Orten: steht die Figur auf dem Boden (kein Durchfallen, kein Schweben), kommt sie beim Gehen
// voran (keine unsichtbare Wand), tragen Treppen, laufen Ansichtswechsel, Flug, Kräfte, Auto, Fahrstühle und Luftschiff ohne
// Fehler, wächst der JS-Speicher mit der Zeit. Meldet JS-Fehler und NaN-Werte.
// Aufruf: python3 -m http.server 8765 (im Repo-Ordner), dann
//         THREE_DIR=/pfad/zu/three-0.147.0 node tools/bughunt.js http://localhost:8765/ out/bugs.json
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', out = 'out/bugs.json'] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: 640, height: 360 } });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  // Zeichnen abschalten, sobald der Renderer da ist (Logik, Chunks, Physik laufen weiter)
  await p.addInitScript(() => { const iv = setInterval(() => { if (window.vespera && window.vespera.renderer) { window.vespera.renderer.render = () => {}; clearInterval(iv); } }, 5); });
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 300000, polling: 500 });
  const result = await p.evaluate(async () => {
    const V = vespera, wait = ms => new Promise(r => setTimeout(r, ms)), r2 = v => Math.round(v * 100) / 100, out = { spots: [], walks: [], actions: [], heap: {} };
    const [PL, PH, BM, VL, HB, IM, PS] = await Promise.all(['player', 'penthouse', 'belmont', 'villa', 'harbour', 'imperial', 'people-skeleton'].map(m => import(`/src/${m}.js`)));
    document.getElementById('enter').click(); await wait(800);
    const pl = V.player, keys = PL.keys;
    const put = (x, y, z, yaw = 0) => { pl.p.set(x, y, z); pl.v.set(0, 0, 0); pl.yaw = yaw; pl.pitch = 0; pl.fly = false; };
    const bad = v => !Number.isFinite(v);
    const state = () => ({ p: pl.p.toArray().map(r2), ground: pl.onGround, nan: bad(pl.p.x) || bad(pl.p.y) || bad(pl.p.z) || bad(V.camera.position.x) });
    // 1) Stehen: Figur 30 cm über den erwarteten Boden setzen, 2,5 s warten, Höhe vergleichen
    const V0 = HB.VILLA, VR = VL.VR, vl = (lx, lz, ly) => ({ x: V0.x + lx * VR.cs + lz * VR.sn, z: V0.z - lx * VR.sn + lz * VR.cs, y: VR.by + ly });   // villaLocal rückwärts
    const spots = [
      ['platz', 0, 0.26, 120], ['lobby', 44.4, BM.BI.P, 22], ['lobby-mitte', 0, BM.BI.P, 10], ['ballsaal', 30, BM.BI.P, -12], ['ballsaal-mitte', 0, BM.BI.P, -20],
      ['galerie1', 40, BM.BI.G1, 0], ['galerie2', 40, BM.BI.G2, 0],
      ['ph-foyer', 0, PH.PH.F1, -14.4], ['ph-salon', 0, PH.PH.F1, 6], ['ph-kueche', -12, PH.PH.F1, -12], ['ph-bar', 12, PH.PH.F1, -12], ['ph-bad', -11, PH.PH.F2, -10], ['ph-schlaf', 11, PH.PH.F2, -10], ['ph-bibliothek', 0, PH.PH.F2, -12],
      ['terrasse-sued', 0, PH.PH.F1, 30], ['terrasse-ost', 28, PH.PH.F1, 0], ['terrasse-west', -28, PH.PH.F1, 0],
      ['hafen', 60, 0.26, 520], ['laden', -330, 0.26, -380], ['arbeiter', 300, 0.26, -600], ['viadukt', 0, 30, 900],
    ];
    for (const [nm, x, y, z] of spots) { put(x, y + 0.3, z); await wait(2500); out.spots.push({ nm, want: r2(y), ...state() }); }
    // Villa: alle Räume (lokale Mitte)
    if (VR.rooms && VR.rooms.length) for (const r of VR.rooms) {
      const cx = r.x !== undefined ? r.x : (r.x0 + r.x1) / 2, cz = r.z !== undefined ? r.z : (r.z0 + r.z1) / 2, fy = r.y !== undefined ? r.y : (r.fy !== undefined ? r.fy : 0);
      const w = vl(cx, cz, fy); put(w.x, w.y + 0.3, w.z); await wait(2000); out.spots.push({ nm: 'villa:' + (r.name || r.id || r.kind || '?'), want: r2(w.y), ...state(), keys: Object.keys(r).join(',') });
    } else out.villaRooms = VR.rooms ? VR.rooms.length : 'keine';
    // 2) Gehen: 4 s geradeaus, zurückgelegter Weg (unsichtbare Wand = fast 0 m, freier Weg >= 10 m)
    const walk = async (nm, x, y, z, yaw, s = 4000) => { put(x, y + 0.3, z, yaw); await wait(400); const x0 = pl.p.x, z0 = pl.p.z, y0 = pl.p.y; keys.KeyW = true; await wait(s); keys.KeyW = false; out.walks.push({ nm, moved: r2(Math.hypot(pl.p.x - x0, pl.p.z - z0)), dy: r2(pl.p.y - y0), ...state() }); };
    await walk('platz-nord', 0, 0.26, 120, 0); await walk('platz-sued', 0, 0.26, 60, Math.PI);
    await walk('lobby-quer', -30, BM.BI.P, 10, -Math.PI / 2); await walk('ballsaal-quer', -30, BM.BI.P, -20, -Math.PI / 2);
    await walk('ph-salon-quer', -8, PH.PH.F1, 6, -Math.PI / 2); await walk('ph-salon-laengs', 0, PH.PH.F1, -8, 0);
    await walk('terrasse-sued-quer', -12, PH.PH.F1, 30, -Math.PI / 2);
    await walk('hafenkai', 60, 0.26, 520, Math.PI / 2); await walk('ladenstrasse', -330, 0.26, -380, 1.2);
    // Brunnen (V33: Scheibe statt Quadrat als Kollision)
    await walk('brunnen-ecke', -14, 0.26, 86, -Math.PI / 4 + Math.PI);
    // 3) Treppen: Wendeltreppe Penthouse (Mitte 0,-4, r 2,55), große Treppe Ballsaal (Lage aus den Kollisionsquadern geschätzt)
    await walk('ph-wendeltreppe', 2.2, PH.PH.F1, -4 - 1.3, Math.PI, 7000);
    // 4) Aktionen
    const act = async (nm, fn) => { try { const r = await fn(); out.actions.push({ nm, ok: true, r }); } catch (e) { out.actions.push({ nm, ok: false, err: String(e).slice(0, 200) }); } };
    put(0, 0.56, 120, 0); await wait(300);
    await act('ansicht-wechsel', async () => { const PM = V.playerModel; const o = []; for (let i = 0; i < 4; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV' })); await wait(700); o.push(PM.view + ':' + !!(PM.mesh && PM.mesh.visible) + ':' + r2(V.camera.position.distanceTo(pl.p))); } return o; });
    await act('flug', async () => { V.powers.startFlight(); pl.v.set(0, 20, -20); await wait(2000); const a = state(); V.powers.stopFlight(); pl.v.set(0, -30, 0); await wait(3000); return { a, b: state() }; });
    await act('telekinese', async () => { put(-5, 0.56, 121, 0); pl.pitch = -0.34; await wait(500); const g = V.powers.tkGrab(); await wait(1200); const k = V.powers.tk && V.powers.tk.kind; V.powers.tkRelease(true); await wait(1500); return { g, k, s: state() }; });
    await act('auto', async () => { put(0, 0.56, 120, 0); await wait(500); const C = V.cars, c = C.parked.filter(c => !c.hidden).sort((a, b) => ((a.x - pl.p.x) ** 2 + (a.z - pl.p.z) ** 2) - ((b.x - pl.p.x) ** 2 + (b.z - pl.p.z) ** 2))[0]; if (!c) return 'kein Auto'; C.enter(c); await wait(400); keys.KeyW = true; await wait(2500); keys.KeyW = false; const d = C.drive; const mv = r2(Math.hypot(d.body.x - c.x, d.body.z - c.z)); C.exit(); await wait(800); return { moved: mv, after: state() }; });
    await act('fahrstuhl-penthouse', async () => { const { INTERACT } = await import('/src/music.js'); put(45, BM.BI.P + 0.3, 22, 0); await wait(600); const it = INTERACT.find(i => i.test(pl.p)); if (!it) return 'kein Fahrstuhl an 45/22'; it.act(); await wait(4000); const a = state(); const back = INTERACT.find(i => i.test(pl.p)); if (back) { back.act(); await wait(4000); } return { label: it.label, a, back: back && back.label, b: state() }; });
    await act('luftschiff', async () => { const I = IM.IMP; if (!I.pf) return 'kein pf'; const r = IM.impBoard ? IM.impBoard(0, 0.3, 0, 0, 'test') : null; await wait(2500); const a = state(); const inside = IM.inImperial(pl.p); if (IM.impLeave) IM.impLeave([0, 0.56, 120], 0, 'test'); await wait(1500); return { r: typeof r, a, inside, b: state() }; });
    // 5) Speicher: 25 s am Platz mit Blick rundum, Heap nach GC vorher/nachher
    put(0, 0.56, 120, 0); await wait(1000); window.gc && window.gc(); await wait(300); const h0 = performance.memory.usedJSHeapSize;
    for (let i = 0; i < 25; i++) { pl.yaw += 0.25; await wait(1000); }
    window.gc && window.gc(); await wait(300); const h1 = performance.memory.usedJSHeapSize;
    out.heap = { startMB: r2(h0 / 1048576), endMB: r2(h1 / 1048576), geometries: V.renderer.info.memory.geometries, textures: V.renderer.info.memory.textures, programs: V.renderer.info.programs.length, chunks: { ...V.chunkStats } };
    return out;
  });
  result.logs = logs;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  const flag = s => (s.nan ? ' NaN!' : '') + (Math.abs(s.p[1] - s.want) > 0.6 ? ` ABWEICHUNG ${s.p[1]} statt ${s.want}` : '') + (!s.ground ? ' schwebt/fällt' : '');
  for (const s of result.spots) console.log('stehen', s.nm.padEnd(18), s.p.join('/'), flag(s));
  for (const w of result.walks) console.log('gehen ', w.nm.padEnd(18), 'Weg', w.moved, 'm  dy', w.dy, w.moved < 3 ? ' BLOCKIERT?' : '');
  for (const a of result.actions) console.log('aktion', a.nm.padEnd(18), a.ok ? JSON.stringify(a.r).slice(0, 300) : 'FEHLER ' + a.err);
  console.log('heap', JSON.stringify(result.heap));
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close();
})();
