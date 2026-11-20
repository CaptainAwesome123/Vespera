// Rendert die Logo-SVGs aus assets/icons/ zu PNGs (Chromium). Aufruf: node tools/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'icons');
const jobs = [
  ['icon.svg', 'icon-512.png', 512], ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'apple-touch-icon.png', 180],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512], ['icon-maskable.svg', 'icon-maskable-192.png', 192],
  ['favicon.svg', 'favicon-32.png', 32], ['favicon.svg', 'favicon-48.png', 48],
];
(async () => {
  const b = await chromium.launch();
  for (const [src, out, n] of jobs) {
    const p = await b.newPage({ viewport: { width: n, height: n } });
    const svg = fs.readFileSync(path.join(dir, src), 'utf8').replace('width="512" height="512"', `width="${n}" height="${n}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await p.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    await p.close();
  }
  await b.close();
  console.log('ok');
})();
