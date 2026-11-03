// V59: Prüft Stimmen und neue Reaktionen ohne Bilder (Labor-Szene, Sprachausgabe nachgebildet):
// richtige Stimme je Sprecher (Randolf tief, Dame weiblich, Junge hoch), Aussprache-Text, jede Sprechblase wird gesprochen,
// Randolf-Zitate im Hinweis auch, Stummschalten, belauschte Wechselrede mit zwei Stimmen, Sätze beim Hochheben.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/stimmen-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 320, height: 200 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  // Sprachausgabe nachbilden: drei deutsche Stimmen wie unter Windows, gesprochene Sätze werden mitgeschrieben
  await p.addInitScript(() => {
    const voices = [{ name: 'Microsoft Hedda - German (Germany)', lang: 'de-DE', localService: true }, { name: 'Microsoft Stefan - German (Germany)', lang: 'de-DE', localService: true },
      { name: 'Google Deutsch', lang: 'de-DE', localService: false }, { name: 'Microsoft David - English', lang: 'en-US', localService: true }];
    window.__spoken = [];
    window.SpeechSynthesisUtterance = function (t) { this.text = t; this.pitch = 1; this.rate = 1; this.volume = 1; this.voice = null; };
    const ss = { speaking: false, pending: false, getVoices: () => voices, speak: u => window.__spoken.push({ text: u.text, voice: u.voice && u.voice.name, pitch: u.pitch, rate: u.rate, volume: u.volume }), cancel: () => {}, addEventListener: () => {} };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
  });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.goto(url + '?lab=leben&t=12.5', { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => (window.labFrames || 0) > 1, null, { timeout: 300000, polling: 500 });
  const r = await p.evaluate(async () => {
    const C = await import('/src/core.js'); C.renderer.render = () => {};
    const V = await import('/src/voice.js'), S = await import('/src/stimmen.js'), L = await import('/src/life.js'), SP = await import('/src/serpentine.js');
    const PW = await import('/src/powers.js'), PL = await import('/src/player.js'), LL = await import('/src/lab-leben.js'), A = await import('/src/awe.js');
    const out = {}, sp = window.__spoken, wait = ms => new Promise(r => setTimeout(r, ms));
    V.VOICE.force = true; V.VOICE.on = true;
    out.voices = { all: V.VOICE.all.length, male: V.VOICE.male.map(v => v.name), female: V.VOICE.female.map(v => v.name) };
    const say = (who, s) => { sp.length = 0; V.VOICE.last = ''; V.speak(who, s); return sp[0]; };
    out.randolf = say('Randolf', 'Guten Abend, Sir. Der 1911er … ist kalt.');
    out.dame = say('Eine Dame', 'Herr Alexander!');
    out.anna = say('Anna Weber', 'Guten Abend.');
    out.otto = say('Otto Brandt', 'Guten Abend.');
    out.junge = say('Ein Junge', 'Mama, schau!');
    out.angst = say('Ein Arbeiter', 'V… verzeihen Sie, Herr Alexander.');
    // jede Sprechblase wird gesprochen (auch aus Dateien, die nichts von Stimmen wissen)
    sp.length = 0; V.VOICE.last = ''; C.shared.sayTimer = 0; L.lifeSay('Konrad', 'Sehr wohl, Herr Alexander.', 3); await wait(60);
    out.bubble = sp[0];
    sp.length = 0; V.VOICE.last = ''; C.$('toast').textContent = 'Randolf: „Das Haus ist ruhig heute Abend, Sir.“'; await wait(60);
    out.toast = sp[0];
    sp.length = 0; V.VOICE.last = ''; C.$('toast').textContent = 'Leuchteffekt an'; await wait(60);
    out.toastPlain = sp.length;
    // stumm: O-Taste und Ton aus
    V.toggleVoices(); sp.length = 0; V.VOICE.last = ''; C.shared.sayTimer = 0; L.lifeSay('Konrad', 'Noch etwas, Herr Alexander?', 3); await wait(60);
    out.muted = sp.length; V.toggleVoices();
    // belauschte Wechselrede: Runde aus zwei Figuren der Labor-Menge neben Alexander
    const crowd = LL.LLAB.crowd.list, ag = k => crowd.find(a => a.kind === k);
    const A1 = { a: ag('lady'), fem: true, ph: 0.41 }, B1 = { a: ag('suit'), fem: false, ph: 0.77 };
    for (const a of [A1.a, B1.a]) a.on = true;
    A1.att = 'bew'; B1.att = 'bew';
    const e = A1.a.m.elements; SP.peds.push(A1, B1); SP.CHATS.push({ m: [A1, B1], x: e[12], z: e[14] });
    PL.player.p.set(e[12] + 2, e[13], e[14] + 2); PL.player.fly = false;
    sp.length = 0; V.VOICE.last = ''; C.shared.sayTimer = 0; S.STIMMEN.dlgT = 0; S.STIMMEN.pending = null;
    for (let i = 0; i < 40; i++) { S.stimmenTick(true); C.shared.sayTimer = Math.max(0, C.shared.sayTimer - 0.25); }
    out.dbg = { dlgT: S.STIMMEN.dlgT, t: S.STIMMEN.t, pend: !!S.STIMMEN.pending, say: C.$('say').textContent, on: A1.a.on, el: !!A1.a.m, peds: SP.peds.length, chats: SP.CHATS.length, fly: PL.player.fly };
    out.dialog = sp.map(s => [s.text, s.voice, +s.pitch.toFixed(2)]);
    // hochgehoben: der Gehobene sagt etwas, beim Absetzen und Aufstehen noch einmal
    sp.length = 0; V.VOICE.last = ''; C.shared.sayTimer = 0;
    const W = { a: ag('worker'), fem: false, ph: 0.2, att: 'furcht' }; SP.peds.push(W);
    PW.POWERS.tk = { kind: 'ped', pd: W };
    for (let i = 0; i < 6; i++) { S.stimmenTick(true); C.shared.sayTimer = 0; }
    PW.POWERS.tk = null; W.rag = { ph: 'drop', soft: true }; S.stimmenTick(true); W.rag = null; C.shared.sayTimer = 0;
    for (let i = 0; i < 3; i++) S.stimmenTick(true);
    out.lift = sp.map(s => s.text);
    // Satzlisten gewachsen
    out.counts = { near: Object.values(A.SAY_NEAR).flat().length, talk: Object.values(A.TALK).flat().length, pow: Object.values(A.SAY).flat().length + Object.values(A.SAY_POW).flat().length, head: L.HEAD.length };
    out.err = S.STIMMEN.err || false;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.voices.male.length === 1 && r.voices.female.length === 2 && r.voices.all === 3, 'Stimmen erkannt: nur deutsche, Stefan männlich, Hedda und Google Deutsch weiblich');
  ok(r.randolf && /Stefan/.test(r.randolf.voice) && r.randolf.pitch < 0.85 && r.randolf.rate < 0.95, 'Randolf: Männerstimme, tief und gemessen');
  ok(r.randolf && /Sör/.test(r.randolf.text) && /neunzehnhundertelfer/.test(r.randolf.text) && !/…/.test(r.randolf.text), 'Aussprache: Sir, 1911er und Pausen umgeschrieben (' + (r.randolf && r.randolf.text) + ')');
  ok(r.dame && /Hedda|Google/.test(r.dame.voice), 'Eine Dame: Frauenstimme');
  ok(r.anna && /Hedda|Google/.test(r.anna.voice) && r.otto && /Stefan/.test(r.otto.voice), 'Bürger nach Vorname: Anna weiblich, Otto männlich');
  ok(r.junge && r.junge.pitch > 1.2, 'Ein Junge: hohe Stimme');
  ok(r.angst && r.angst.rate > 1.05, 'Stottern: schneller, ängstlich');
  ok(r.bubble && /Konrad|Sehr wohl/.test(r.bubble.text) && /Stefan/.test(r.bubble.voice), 'Sprechblase wird gesprochen (Konrad)');
  ok(r.toast && /Haus ist ruhig/.test(r.toast.text), 'Randolf-Zitat im Hinweis wird gesprochen');
  ok(r.toastPlain === 0, 'Normale Hinweise werden nicht vorgelesen');
  ok(r.muted === 0, 'O schaltet Stimmen stumm');
  ok(r.dialog.length >= 2 && r.dialog[0][1] !== r.dialog[1][1], 'Wechselrede: zwei Sätze, Dame und Herr mit verschiedenen Stimmen ' + JSON.stringify(r.dialog));
  ok(r.lift.length >= 2, 'Hochgehobener spricht beim Schweben und beim Aufstehen: ' + JSON.stringify(r.lift));
  ok(r.counts.near > 70 && r.counts.talk > 45, 'Mehr Sätze: ' + JSON.stringify(r.counts));
  ok(!r.err, 'keine Fehler im Reaktions-Takt');
  ok(errs.length === 0, 'keine Seitenfehler ' + errs.join(' | '));
  await b.close();
  console.log(fails ? fails + ' Fehler' : 'alles gut');
  process.exit(fails ? 1 : 0);
})();
