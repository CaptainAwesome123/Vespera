// V61: Prüft den Vespera-Kurier ohne Spielbild (ganze Stadt, Zeichnen abgeschaltet):
// erste Ausgabe zum Start, Rufe der Zeitungsjungen, Meldung über die Schnittstelle und das Ereignis 'vespera-news',
// Kasten am Rand, Extrablatt nach einem Fall aus gegner.js (Überfall, Festnahme), Taten (Automobil gehoben),
// Zeitung öffnen/blättern/schließen per Taste, keine Fehler. Speichert Bilder der aufgeschlagenen Zeitung.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/zeitung-test.js http://localhost:8765/ [ausgabe-ordner]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', outDir = 'shot'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
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
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForTimeout(800);
  const r = await p.evaluate(async () => {
    const Z = await import('/src/zeitung.js'), L = await import('/src/life.js'), G = await import('/src/gegner.js'), PW = await import('/src/powers.js');
    const out = {};
    out.first = Z.ZEITUNG.archive.length; out.head = L.HEAD.slice(); out.api = !!(window.vespera && window.vespera.zeitung);
    // Schnittstelle: Meldung, Kasten, Ereignis
    Z.zeitungMeldung({ titel: 'Probe: Gala im Belmont angekündigt', text: 'Der Ballsaal wird geschmückt.', rubrik: 'Gesellschaft', prio: 5 });
    window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel: 'Probe: Börse schließt fester', text: 'Die Kurse stiegen.', rubrik: 'Wirtschaft', prio: 4 } }));
    window.dispatchEvent(new CustomEvent('vespera-news-box', { detail: { id: 'boerse', titel: 'Börse', zeilen: [['Vespera-Bank', '412,50'], ['Nordlicht-Werke', '88,20'], ['Kristall-Bahn', '131,00']] } }));
    out.pend = Z.ZEITUNG.pending.length;
    // ein Fall aus gegner.js, nachgestellt: Überfall beginnt, ein Räuber wird gefasst, Fall endet
    G.GEGNER.nextT = 1e9;
    const E = { type: 'raub', label: 'Überfall', crooks: [], where: () => [0, 120] };
    G.GEGNER.ev = E; Z.zeitungTick(0.25);
    G.GEGNER.stats.gefasst++; Z.zeitungTick(0.25);
    G.GEGNER.ev = null; for (let i = 0; i < 20; i++) Z.zeitungTick(0.25);
    out.fall = Z.ZEITUNG.pending.map(i => i.titel + ' [' + i.prio + ']');
    // eine Tat: Automobil mit Telekinese gehoben
    PW.POWERS.tk = { kind: 'car', B: {} }; for (let i = 0; i < 8; i++) Z.zeitungTick(0.25); PW.POWERS.tk = null; Z.zeitungTick(0.25);
    // Gala im Belmont (gala.js): Rede 1, Ende
    for (const phase of ['einzug', 'rede', 'toast', 'ende']) window.dispatchEvent(new CustomEvent('vespera-gala', { detail: { phase, rede: phase === 'einzug' ? -1 : 1, n: 1 } }));
    out.gala = Z.ZEITUNG.pending.filter(i => i.quelle === 'gala').map(i => i.titel + ' [' + i.prio + ']');
    // Extrablatt nach ein paar Sekunden
    for (let i = 0; i < 60; i++) Z.zeitungTick(0.25);
    const ed = Z.ZEITUNG.archive[Z.ZEITUNG.archive.length - 1];
    out.extra = ed.extra; out.lead = ed.lead.titel; out.items = ed.items.map(i => i.titel); out.kaesten = ed.kaesten.map(k => k.titel);
    out.headAfter = L.HEAD.slice(0, 3); out.him = L.HEAD_HIM.slice();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.first >= 1, 'erste Ausgabe zum Start');
  ok(r.api, 'window.vespera.zeitung vorhanden');
  ok(r.pend === 2, 'Meldung über Schnittstelle und Ereignis angekommen');
  ok(r.fall.some(t => /Räuber|Überfall/.test(t)), 'Überfall mit Festnahme wird zur Meldung');
  ok(r.gala.length === 1 && /9/.test(r.gala[0]), 'Gala-Ende wird zur Extrablatt-Meldung');
  ok(r.extra === true, 'Extrablatt gedruckt');
  ok(/Gala|Stern|Belmont/.test(r.lead) && r.items.some(t => /Räuber|Überfall/.test(t)), 'Gala auf der Titelseite (prio 9), Überfall darunter');
  ok(r.items.some(t => /Automobil/.test(t)), 'gehobenes Automobil in der Zeitung');
  ok(r.kaesten.includes('Börse'), 'Kasten am Rand');
  ok(r.headAfter[0].startsWith('Extrablatt'), 'Zeitungsjungen rufen das Extrablatt aus');
  // öffnen, blättern, schließen
  await p.keyboard.press('KeyU'); await p.waitForTimeout(300);
  const open1 = await p.evaluate(() => document.getElementById('ztPaper').classList.contains('on'));
  ok(open1, 'U öffnet die Zeitung');
  fs.mkdirSync(outDir, { recursive: true });
  await p.screenshot({ path: path.join(outDir, 'zeitung-extrablatt.png') });
  await p.evaluate(() => { document.querySelector('#ztPaper .zs').scrollTop = 600; });
  await p.screenshot({ path: path.join(outDir, 'zeitung-unten.png') });
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200);
  const v = await p.evaluate(async () => (await import('/src/zeitung.js')).ZEITUNG.view);
  await p.screenshot({ path: path.join(outDir, 'zeitung-abendausgabe.png') });
  ok(v === 0, 'Pfeil links blättert zur älteren Ausgabe');
  await p.keyboard.press('KeyW');   // darf Alexander nicht bewegen
  const moved = await p.evaluate(async () => !!(await import('/src/player.js')).keys.KeyW);
  ok(!moved, 'Tasten gehen bei offener Zeitung nicht ans Spiel');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const st = await p.evaluate(async () => ({ open: document.getElementById('ztPaper').classList.contains('on'), menu: (await import('/src/venues.js')).DINE.menuOpen, paused: (await import('/src/input.js')).paused }));
  ok(!st.open && !st.menu && !st.paused, 'Esc schließt, Spiel läuft weiter');
  // schmal (Handy)
  await p.setViewportSize({ width: 390, height: 800 }); await p.keyboard.press('KeyU'); await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(outDir, 'zeitung-handy.png') });
  ok(errs.length === 0, 'keine JS-Fehler' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles in Ordnung');
  process.exit(fails ? 1 : 0);
})();
