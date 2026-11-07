// V62: Prüft das Inventar ohne Bilder (ganze Stadt, Bild angehalten): Einstecken mit Umschalt+E, Benutzen, Ablegen,
// nach Hause schicken, Schenken, Gründungsmedaille, Oberfläche (Umschalt+I, vier Seiten), I bleibt Kontor, Speichern.
// Bildschirmfotos (SHOTS=1) nach out/inventar-<seite>.png.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/inventar-test.js http://localhost:8765/
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const [,, url = 'http://localhost:8765/'] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FEHLER ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').slice(0, 400))); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  if (process.env.THREE_DIR) await p.route(/cdn\.jsdelivr\.net\/npm\/three@0\.147\.0\/(.*)/, r => {
    const fp = path.join(process.env.THREE_DIR, r.request().url().replace(/.*three@0\.147\.0\//, '').split('?')[0]);
    fs.existsSync(fp) ? r.fulfill({ body: fs.readFileSync(fp), contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }) : r.abort();
  });
  const t0 = Date.now();
  await p.goto(url, { waitUntil: 'commit', timeout: 120000 });
  await p.evaluate(() => { try { localStorage.removeItem('vespera.kontor'); } catch (e) {} });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera.kontor && window.vespera.kontor.KT.ready, null, { timeout: 60000, polling: 300 });
  const r = await p.evaluate(async () => {
    const K = await import('/src/kontor.js'), I = await import('/src/inventar.js'), PL = await import('/src/player.js'), C = await import('/src/core.js'), PHY = await import('/src/physics.js'), RD = await import('/src/ragdoll.js'), PW = await import('/src/powers.js');
    const { KT } = K, { player } = PL, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    C.renderer.render = () => {};
    const key = o => document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...o }));   // wie eine echte Taste: vom Fokus zum Fenster
    const setP = (x, y, z) => { player.p.set(x, y, z); player.v.set(0, 0, 0); player.onGround = true; player.fly = false; };
    await wait(300);
    out.ready = I.INV.ready; out.meds = I.INV.med.length; out.hud = (document.querySelector('#ktHud .inv') || {}).textContent;
    // Einstecken: Champagnerflasche tragen, Umschalt+E
    const kai = K.postPos('kai'); setP(kai.x, kai.y, kai.z); await wait(200);
    const B = PHY.spawnProp('champagne', player.p.x + 1, player.p.y + 0.5, player.p.z, 0);
    PHY.pickUp(B); await wait(300); out.held = PHY.LOOSE.held === B; out.label = document.getElementById('prompt').textContent;
    const IN = await import('/src/input.js'); out.pre = { paused: IN.paused, playing: IN.playing, held: PHY.LOOSE.held === B };
    key({ code: 'KeyE', key: 'E', shiftKey: true });
    out.pocketed = KT.s.items.some(i => i.k === 'p:champagne') && !PHY.LOOSE.bodies.includes(B) && !PHY.LOOSE.held;
    if (!out.pocketed) { out.diag = { can: I.invCanPocket(B), heldNow: !!PHY.LOOSE.held, key: B.key, inBodies: PHY.LOOSE.bodies.includes(B), items: KT.s.items.length, menu: (await import('/src/venues.js')).DINE.menuOpen, kt: KT.open }; return out; }
    // nicht einsteckbar: Holzkiste
    const crate = PHY.spawnProp('crate', player.p.x + 1, player.p.y + 0.5, player.p.z, 0); out.crateNo = !I.invCanPocket(crate); PHY.dropBody(crate);
    // Benutzen: trinken bis leer
    const ch = KT.s.items.find(i => i.k === 'p:champagne'); out.u0 = ch.u; I.invUse(ch); out.u1 = ch.u;
    // Ladenware: Taschenuhr (bleibt), Rosen (verschenken)
    KT.s.items.push({ k: 'uhren', n: 'goldene Taschenuhr', from: 'JUWELIER GRAF' }, { k: 'blumen', n: 'Strauß weißer Rosen', from: 'BLUMEN ROSA' }, { k: 'buch', n: 'in Leder gebundenen Roman' });
    const uhr = KT.s.items.find(i => i.k === 'uhren'); I.invUse(uhr); out.uhrBleibt = KT.s.items.includes(uhr);
    // Ablegen: Champagner liegt wieder in der Welt
    const n0 = PHY.LOOSE.bodies.length; I.invDrop(ch); out.dropped = PHY.LOOSE.bodies.length === n0 + 1 && !KT.s.items.includes(ch);
    // Nach Hause schicken, unterwegs nicht mitnehmen
    const buch = KT.s.items.find(i => i.k === 'buch'); I.invSendHome(buch); out.home = KT.s.inv.home.length === 1; out.takeAway = I.invTakeHome(0);
    // Schenken an einen Bürger in der Nähe
    const c = RD.citizens.find(c => c.ped.a && c.ped.a.on && !c.use);
    if (c) { const e = c.ped.a.m.elements; setP(e[12] + 1, e[13], e[14]); out.near = !!I.invNearCitizen(); const rep = KT.s.rep.buerger + KT.s.rep.arbeiter + KT.s.rep.elite; I.invGift(KT.s.items.find(i => i.k === 'blumen')); out.gift = !KT.s.items.some(i => i.k === 'blumen') && KT.s.rep.buerger + KT.s.rep.arbeiter + KT.s.rep.elite > rep; }
    // Medaille: hinfliegen, einsammeln
    const o = I.INV.med.find(m => m.M.id === 'kai'); if (o) { setP(o.g.position.x, o.g.position.y - 1.3, o.g.position.z); await wait(500); out.med = !!KT.s.inv.med.kai; }
    // Oberfläche: öffnen mit Umschalt+I, alle Seiten
    key({ code: 'KeyI', key: 'I', shiftKey: true });
    out.open = I.INV.open && !document.getElementById('inv').hidden && !KT.open;
    out.tabs = [];
    for (const d of ['Digit1', 'Digit2', 'Digit3', 'Digit4']) { key({ code: d, key: d.slice(5) }); out.tabs.push([I.INV.tab, document.querySelectorAll('#inv .slot').length]); }
    key({ code: 'Escape', key: 'Escape' }); out.closed = !I.INV.open;
    // I öffnet weiterhin das Kontor
    key({ code: 'KeyI', key: 'i' }); out.kontor = KT.open; K.ktClose();
    K.ktSave(); const sv = JSON.parse(localStorage.getItem('vespera.kontor')); out.saved = sv.inv && sv.inv.home.length === 1 && sv.inv.med.kai && sv.items.some(i => i.k === 'uhren');
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.ready && r.meds >= 10, 'Inventar bereit, Medaillen in der Welt: ' + r.meds);
  ok(/TASCHEN/.test(r.hud || ''), 'Anzeige oben rechts: ' + r.hud);
  ok(r.held && /einstecken/.test(r.label), 'Hinweis beim Tragen: ' + r.label);
  ok(r.pocketed, 'Umschalt+E steckt die Flasche ein');
  ok(r.crateNo, 'Holzkiste lässt sich nicht einstecken');
  ok(r.u1 === r.u0 - 1, 'Trinken: ein Schluck weniger');
  ok(r.uhrBleibt, 'Taschenuhr bleibt nach dem Benutzen');
  ok(r.dropped, 'Ablegen: liegt wieder in der Welt');
  ok(r.home && !r.takeAway, 'nach Hause, unterwegs nicht mitnehmen');
  ok(r.near && r.gift, 'Schenken hebt Ansehen');
  ok(r.med, 'Medaille eingesammelt');
  ok(r.open && r.tabs.map(t => t[0]).join() === 'taschen,schluessel,sammlung,zuhause' && r.tabs.every(t => t[1] > 0) && r.closed, 'Oberfläche: ' + JSON.stringify(r.tabs));
  ok(r.kontor, 'I öffnet weiterhin das Kontor');
  ok(r.saved, 'gespeichert');
  if (process.env.SHOTS) {
    for (const t of ['taschen', 'schluessel', 'sammlung', 'zuhause']) {
      await p.evaluate(async t => { const I = await import('/src/inventar.js'); I.invClose(); I.invOpen(t); const ov = document.getElementById('overlay'); if (ov) ov.style.display = 'none'; }, t);
      await p.waitForTimeout(300); fs.mkdirSync('out', { recursive: true }); await p.screenshot({ path: 'out/inventar-' + t + '.png' });
    }
  }
  ok(!errs.length, 'keine Fehler' + (errs.length ? ':\n' + errs.join('\n') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})();
