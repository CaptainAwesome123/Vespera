// V38: Klangprobe im Headless-Chromium: betritt die Stadt, springt an Orte und liest das Mischpult aus
// (Ort, Boden, Lautstärken der Schichten), löst Schritte, Landung, Flug und Telekinese aus und meldet Fehler.
// Aufruf: python3 -m http.server 8765 &  THREE_DIR=/pfad/zu/three-0.147.0 node tools/sound-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const url = process.argv[2] || 'http://localhost:8765/';
const PLACES = [
  ['platz', [0, 0.26, 120]], ['ladenstrasse', [-330, 0.26, -380]], ['hafen', [60, 0.26, 520]], ['arbeiter', [-760, 0.26, -300]],
  ['lobby', [30, 0.26, 20]], ['ballsaal', [2, 0.26, -30]], ['penthouse', [0, 250, 10]], ['terrasse', [0, 250, 28]], ['villa', null], ['luftschiff', 'imp'], ['regen', 'rain'],
];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 600)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 300000, polling: 500 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  // Bilder nicht zeichnen (der Software-Renderer stürzt im Spiel gern ab); die Spiellogik und der Klang laufen weiter
  await p.evaluate(async () => { vespera.renderer.render = () => {}; const M = await import('./src/music.js'); setInterval(() => { window.__jazz = M.audio; }, 500); document.getElementById('enter').click(); });
  await p.waitForTimeout(4000);
  const read = () => p.evaluate(() => {
    const S = vespera.sound;
    if (!S.an) { S.an = S.ctx.createAnalyser(); S.an.fftSize = 8192; S.master.connect(S.an); }
    const buf = new Float32Array(S.an.fftSize); S.an.getFloatTimeDomainData(buf); let pk = 0, ss = 0; for (const v of buf) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
    const db = v => Math.round(20 * Math.log10(v + 1e-6));
    const g = n => +(S.L[n] ? S.L[n].gain.value : -1).toFixed(3);
    return { rmsDb: db(Math.sqrt(ss / buf.length)), peakDb: db(pk), ctx: S.ctx && S.ctx.state, sprite: !!S.sprite, jazz: window.__jazz ? +window.__jazz.jazz.gain.value.toFixed(3) : null, zone: S.zone, surf: S.surf, master: +S.master.gain.value.toFixed(2), outCut: Math.round(S.bus.outF.frequency.value),
      city: g('city'), car: g('car'), tram: g('tram'), voices: g('voices'), water: g('water'), rain: g('rain'), whistle: g('whistle'), ship: g('ship'), fly: g('fly'), tk: g('tk'),
      salon: +S.salon.g.gain.value.toFixed(3) };
  });
  console.log('start', JSON.stringify(await read()));
  for (const [name, pos] of PLACES) {
    await p.evaluate(async ([pos]) => {
      const V = vespera, P = V.player; P.fly = false; P.v.set(0, 0, 0); P.on = null;
      if (pos === 'rain') { const A = await import('./src/atmosphere.js'); A.ATMO.w = A.WEATHERS[4]; A.ATMO.pinned = true; P.p.set(-330, 0.26, -380); return; }
      if (pos === 'imp') { const { IMP, impBoard } = await import('./src/imperial.js'); impBoard(7, IMP.D.fyB, -4.6, Math.PI, 'Test'); return; }
      if (pos) P.p.set(...pos);
      else { const { VILLA } = await import('./src/harbour.js'), { VR } = await import('./src/villa.js'); P.p.set(VILLA.x - 10 * VR.sn, VR.by + 0.4, VILLA.z - 10 * VR.cs); }
    }, [pos]);
    await p.waitForTimeout(3500);
    console.log(name.padEnd(13), JSON.stringify(await read()));
  }
  // Schritte, Landung, Flug, Telekinese
  console.log('aktionen', await p.evaluate(async () => {
    const V = vespera, P = V.powers, S = V.sound, wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    V.player.p.set(-5, 0.26, 121); V.player.yaw = 0; V.player.pitch = -0.34; await wait(1000);
    out.grab = P.tkGrab(); await wait(800); out.tkGain = +S.L.tk.gain.value.toFixed(3); P.tkRelease(true); await wait(1200); out.tkAfter = +S.L.tk.gain.value.toFixed(3);
    P.startFlight(); V.player.v.set(0, 0, -100); await wait(1200); out.flyGain = +S.L.fly.gain.value.toFixed(3);
    V.player.p.set(0, 40, 118); V.player.v.set(0, -40, 0); P.stopFlight(); await wait(1500); out.landed = V.player.onGround;
    // jedes Ereignis einmal direkt auslösen (Fehler würden hier auffallen)
    const A = await import('./src/audio.js');
    for (const k of ['grab', 'throw', 'drop']) A.tkSound(k);
    A.heroBoom(1); A.takeoffSound(true); A.klaxon(1); A.tramBell(1);
    for (const sf of ['marble', 'stone', 'snowstone', 'snow', 'wood', 'carpet']) { S.surf = sf; A.footstep(true); }
    out.events = 'ok';
    return JSON.stringify(out);
  }));
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close();
})();
