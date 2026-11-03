// V61: Prüft die Gala ohne Bilder (Labor ?lab=gala&norender=1): Figuren, Ablauf Einzug -> Reden -> Rede-Wahl -> Toast ->
// Ehrenwalzer (Randpaare, Extra-Paare) -> Feuerwerk -> Ende, Band schweigt bei den Reden, Funken entstehen und vergehen,
// Applaus beim Betreten, Ereignis 'vespera-gala'. Feuerwerk-Standbild: ?lab=gala&fw=1&t=6 (schnell).
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/gala-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.goto(url + '?lab=gala&norender=1&hold=1&view=ballsaal', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => !!window.galaStart, null, { timeout: 300000, polling: 500 });
  const r = await p.evaluate(async () => {
    const G = window.GALA, B = await import('/src/belmont.js'), A = await import('/src/audio.js'), PL = await import('/src/player.js'), out = {};
    const C = B.interiorCrowd, ev = []; window.addEventListener('vespera-gala', e => ev.push(e.detail.phase));
    out.people = C.list.length; out.guests = G.guests.length; out.extras = G.extras.length; out.extrasHidden = G.extras.every(c => !c.m.on);
    out.dancers0 = B.dancers.length;
    // Applaus beim Betreten
    PL.player.p.set(0, 0.26, 20); window.galaSkip(0.2); PL.player.p.set(0, 0.26, -24); G.t = 500; window.galaSkip(0.2);
    out.enterClap = G.guests.filter(g => g.a.gait[1] > 9 && g.a.gait[1] < 10).length; out.enterSay = G.lastLine;
    window.galaSkip(6);
    out.reset = G.guests.every(g => g.a.gait[1] === g.act);
    // Gala
    window.galaStart(); window.galaSkip(1);
    out.hush = A.SND.galaHush; out.beam = !!(G.beam && G.beam.visible); out.clap1 = G.guests.filter(g => g.a.gait[1] > 9 && g.a.gait[1] < 10).length;
    for (let k = 0; k < 60 && G.dir.z > -40.6; k++) window.galaSkip(1); out.dirWalk = [G.dir.x.toFixed(1), G.dir.y.toFixed(2), G.dir.z.toFixed(1)]; out.singerAside = G.singer.x;
    for (let k = 0; k < 90 && !/Bürgermeister/.test(G.lastLine); k++) window.galaSkip(1); out.line2 = G.lastLine; out.bmAtMic = [G.bm.x.toFixed(1), G.bm.y.toFixed(2), G.bm.z.toFixed(1)];
    // bis zur Rede-Wahl
    for (let k = 0; k < 60 && G.rede == null && G.menuT == null; k++) window.galaSkip(1);
    out.menu = !document.getElementById('menuCard').hidden; out.menuTitle = document.querySelector('#menuCard h3')?.textContent;
    window.galaRede(1); window.galaSkip(3); out.alex = G.lastLine;
    window.galaSkip(30); out.toast = G.lastLine;
    for (let k = 0; k < 40 && !G.solo; k++) window.galaSkip(1);
    out.solo = !!G.solo; out.off = B.dancers.filter(c => c.off).length; out.offAct = B.dancers.find(c => c.off)?.m.gait[1]; out.hush2 = A.SND.galaHush;
    for (let k = 0; k < 40 && G.solo; k++) window.galaSkip(1); (await import('/src/dance.js')).updateInterior(1, true); out.joined = B.dancers.length; out.offAfter = B.dancers.filter(c => c.off).length; out.extrasOn = G.extras.every(c => c.m.on);
    for (let k = 0; k < 60 && !window.FEUERWERK?.on && G.st === 'laeuft'; k++) { window.galaSkip(1); }
    const FW = (await import('/src/gala.js')).FEUERWERK; out.fwOn = FW.on; out.st = G.st;
    window.galaSkip(8); const SP = (await import('/src/gala.js')); out.sparks = SP.FEUERWERK.on;
    window.galaSkip(120); out.fwOff = !FW.on; out.st2 = G.st; out.done = G.done; out.guestsBack = G.guests.every(g => g.a.gait[1] === g.act);
    out.events = ev;
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.extras >= 4 && r.extrasHidden, 'Extra-Paare angelegt und zunächst unsichtbar: ' + r.extras);
  ok(r.guests > 150, 'Gäste im Ballsaal erfasst: ' + r.guests);
  ok(r.enterClap > 100 && /Alexander|Gründer|Herrn/.test(r.enterSay || ''), 'Applaus beim Betreten: ' + r.enterClap + ' · ' + r.enterSay);
  ok(r.reset, 'Gäste kehren danach zu ihrer Handlung zurück');
  ok(r.hush === 1 && r.beam && r.clap1 > 100, 'Einzug: Band schweigt, Scheinwerfer, Applaus ' + r.clap1);
  ok(Math.abs(+r.dirWalk[0]) < 2.5 && +r.dirWalk[1] > 1.4 && +r.dirWalk[2] < -39.5, 'Direktor auf der Bühne am Mikrofon: ' + r.dirWalk + ', Sängerin bei x ' + r.singerAside);
  ok(/Bürgermeister/.test(r.line2) || +r.bmAtMic[2] < -39.5, 'Bürgermeister redet: ' + r.line2 + ' @ ' + r.bmAtMic);
  ok(r.menu && /Rede/.test(r.menuTitle || ''), 'Rede-Wahl als Karte: ' + r.menuTitle);
  ok(/^Alexander: /.test(r.alex || ''), 'Alexander spricht die gewählte Rede: ' + r.alex);
  ok(r.solo && r.off > 10 && r.offAct > 9 && r.offAct < 10 && r.hush2 === 0, 'Ehrenwalzer: ein Paar allein, ' + r.off + ' Paare klatschen am Rand, Band spielt');
  ok(r.offAfter === 0 && r.joined === r.dancers0 + r.extras && r.extrasOn, 'Alle aufs Parkett, Extra-Paare tanzen mit: ' + r.joined);
  ok(r.fwOn, 'Feuerwerk startet');
  ok(r.fwOff && r.st2 === 'aus' && r.done === 1 && r.guestsBack, 'Gala endet, Gäste wieder normal');
  ok(['einzug', 'reden', 'stern', 'rede', 'toast', 'walzer', 'feuerwerk', 'ende'].every(e => r.events.includes(e)), 'Ereignisse für andere Systeme: ' + r.events.join(','));
  // Funken im Feuerwerk-Labor
  await p.goto(url + '?lab=gala&fw=1&t=6', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => (window.labFrames || 0) > 0, null, { timeout: 300000, polling: 500 });
  const f = await p.evaluate(async () => { const S = await import('/src/gala.js'); let n = 0, hi = 0; const sc = (await import('/src/core.js')).scene; sc.traverse(o => { if (o.isPoints && o.geometry.drawRange.count > 0 && o.geometry.attributes.size.array.length > 1000) { hi = o.geometry.drawRange.count; n = o.geometry.attributes.size.array.filter(v => v > 0).length; } }); return { n, hi, on: S.FEUERWERK.on }; });
  ok(f.n > 100 && f.on, 'Feuerwerk-Funken in der Luft: ' + f.n + ' (Bereich ' + f.hi + ')');
  ok(!errs.length, 'keine Fehler' + (errs.length ? ': ' + errs.slice(0, 5).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})();
