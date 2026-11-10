// V78: Krater außerhalb der Stadt, ohne Bildvergleich: Lager und Höhlen platziert, Gedenktafel ansprechbar,
// Höhle betreten (Boden hält, Ausgang), Fundstücke, Inventar-Reiter Krater, Stadtkarte, Entscheidung am Steinmann.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three node tools/krater-test.js http://localhost:8765/ [mobile]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', mobile] = process.argv;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', hasTouch: true, isMobile: true } : { viewport: { width: 480, height: 270 } });
  const p = await ctx.newPage(), logs = [];
  p.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /Krater|krater/.test(m.text()))) logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').slice(0, 500)));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  await p.addInitScript(() => { try { localStorage.removeItem('vespera-krater'); } catch (e) { /* egal */ } });
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 400000, polling: 500 });
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => vespera.krater && vespera.krater.KR.placed, null, { timeout: 120000, polling: 500 });
  const ok = [], bad = [], check = (c, t) => (c ? ok : bad).push(t);
  const st = await p.evaluate(() => vespera.krater.KR.stats);
  console.log('Platzierung', JSON.stringify(st));
  check(st.camp && st.caves.length === 2, 'Lager und zwei Höhlen platziert');
  const prompt = () => p.evaluate(() => document.getElementById('prompt').style.opacity === '1' ? document.getElementById('prompt').textContent : '');
  // Gedenktafel
  await p.evaluate(() => { const C = vespera.krater.KR.camp; vespera.player.p.set(C.denk[0], C.denkY + 0.3, C.denk[1]); vespera.player.v.set(0, 0, 0); vespera.player.fly = false; });
  await p.waitForTimeout(2500);
  const pr1 = await prompt(); check(/Gedenktafel/.test(pr1), 'Gedenktafel am Steinmann: ' + pr1);
  const y1 = await p.evaluate(() => [vespera.player.p.y, vespera.krater.KR.camp.denkY]); check(Math.abs(y1[0] - y1[1]) < 2.5, 'Alexander steht im Lager auf dem Boden: ' + y1.map(v => v.toFixed(1)).join(' / '));
  // Höhle: hinein, Boden hält, Ausgang angeboten
  await p.evaluate(() => vespera.krater.enter('blau'));
  await p.waitForTimeout(3500);
  const inC = await p.evaluate(() => ({ y: vespera.player.p.y, z: vespera.player.p.z, oz: vespera.krater.KR.caves[0].oz, vis: vespera.krater.KR.caves[0].group.visible }));
  check(Math.abs(inC.y + 60) < 1.5 && inC.vis, 'In der Blauen Grotte, Boden hält: y ' + inC.y.toFixed(2));
  const pr2 = await prompt(); check(/Hinaus/.test(pr2), 'Ausgang angeboten: ' + pr2);
  // zum Pickel gehen: Aufheben angeboten
  await p.evaluate(() => { const F = vespera.krater.FUNDE.find(f => f.id === 'pickel'); vespera.player.p.set(F.p[0] - 1.2, -60 + 0.1, F.p[2]); });
  await p.waitForTimeout(2000);
  const pr3 = await prompt(); check(/Aufheben: Halvorsens Eispickel/.test(pr3), 'Fundstück in der Höhle: ' + pr3);
  const y3 = await p.evaluate(() => vespera.player.p.y); check(Math.abs(y3 + 60) < 1, 'Boden hält im Dom: ' + y3.toFixed(2));
  // Karte: Orte da
  const kp = await p.evaluate(() => vespera.karte.places().filter(P => P.id.startsWith('krater:')).map(P => P.id));
  check(kp.length === 3, 'Stadtkarte zeigt ' + kp.join(', '));
  // alle Funde, Inventar-Reiter, Entscheidung
  await p.evaluate(() => { for (const F of vespera.krater.FUNDE) vespera.krater.found(F.id); });
  const n = await p.evaluate(() => vespera.krater.FUNDE.filter(F => vespera.krater.KR.s.f[F.id]).length); check(n === 12, 'zwölf Fundstücke gefunden: ' + n);
  await p.evaluate(() => { const C = vespera.krater.KR.camp; vespera.player.p.set(C.denk[0], C.denkY + 0.3, C.denk[1]); });
  await p.waitForTimeout(2500);
  const pr4 = await prompt(); check(/Entscheiden/.test(pr4), 'Entscheidung angeboten: ' + pr4);
  await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
  const menu = await p.evaluate(() => { const m = document.getElementById('menuCard'); return m && !m.hidden ? m.textContent.slice(0, 160) : ''; });
  check(/Wem gehören/.test(menu), 'Auswahl offen: ' + menu.slice(0, 80));
  await p.keyboard.press('Digit1'); await p.waitForTimeout(600);
  const w = await p.evaluate(() => vespera.krater.KR.s.wahl); check(w === 'museum', 'Entscheidung gespeichert: ' + w);
  await p.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyI', key: 'I', shiftKey: true, bubbles: true })));
  await p.waitForTimeout(400);
  await p.evaluate(() => document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5', key: '5', bubbles: true })));
  await p.waitForTimeout(400);
  const inv = await p.evaluate(() => { const e = document.getElementById('inv'); return e && !e.hidden ? e.querySelector('.info').textContent.slice(0, 200) : ''; });
  check(/Funde vom Krater · 12 von 12/.test(inv), 'Inventar-Reiter Krater: ' + inv.slice(0, 90));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  console.log(ok.map(t => 'OK   ' + t).join('\n')); console.log(bad.map(t => 'FEHL ' + t).join('\n'));
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close(); process.exit(bad.length || logs.some(l => l.startsWith('PAGEERROR')) ? 1 : 0);
})();
