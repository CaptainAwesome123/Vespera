// Bilder aus dem Figuren-Labor (index.html?lab=menschen) oder dem Fassaden-Labor (LAB=fassade, V38), schnell auch im Software-Renderer.
// Aufruf: python3 -m http.server 8765 (im Repo), dann
//   THREE_DIR=/pfad/zu/three-0.147.0 node tools/lab-shot.js http://localhost:8765/ out/lab gesichter,tanz [zeit] [breite]x[höhe]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/', out = 'lab', views = 'alle', time = '12.5', size = '800x600'] = process.argv;
(async () => {
  const [w, h] = size.split('x').map(Number);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  p.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url + (url.includes('?') ? '&' : '?') + 'lab=' + (process.env.LAB || 'menschen') + '&t=' + time, { waitUntil: 'commit', timeout: 120000 });
  try { await p.waitForFunction(() => (window.labFrames || 0) > 1, null, { timeout: 240000, polling: 500 }); }
  catch (e) { console.log('kein Bild:', logs.join('\n')); await b.close(); process.exit(1); }
  console.log('Labor bereit nach', Date.now() - t0, 'ms');
  for (const v of views.split(',')) {
    const [nv, tt] = v.split('@'), [name, pose] = nv.split('#');   // V35: ansicht#pose (Alexanders Bewegungen, siehe LAB.poses)
    await p.evaluate(([n, t, ps]) => { window.labView(n); if (ps && window.labPose) window.labPose(ps); if (t) window.labTime(+t); window.labFrames = 0; }, [name, tt, pose]);
    await p.waitForFunction(() => window.labFrames > 1, null, { timeout: 120000, polling: 200 });
    await p.screenshot({ path: `${out}-${name}${pose ? '-' + pose : ''}${tt ? '-' + tt : ''}.png`, timeout: 120000 });
    console.log(name, Date.now() - t0, 'ms');
  }
  console.log(logs.join('\n') || 'keine Fehler');
  await b.close();
})();
