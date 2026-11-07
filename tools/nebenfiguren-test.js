// V63: Prüft die Nebenfiguren ohne Bilder (ganze Stadt, Bild angehalten): sechs Figuren mit Ort, Gesprächsfeld mit Auswahl
// (Tasten und Klick), Aufgabe annehmen und übergeben (Jo), Interview mit Zeitungsmeldung (Margot), Zielarten Lohn und Stiftung,
// Hallsteins letztes Wort, Anklopfen, Ruf-Buch-Abschnitt, Karte, Kapitänsmenü, Speichern.
// Aufruf: python3 -m http.server 8765 (im Repo), dann THREE_DIR=/pfad/zu/three-0.147.0/package node tools/nebenfiguren-test.js http://localhost:8765/
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
  await p.evaluate(() => { try { localStorage.removeItem('vespera.kontor'); localStorage.removeItem('vespera.ruf'); } catch (e) {} });
  await p.waitForFunction(() => window.vespera && window.vespera.renderer, null, { timeout: 400000, polling: 300 });
  await p.evaluate(() => { window.vespera.renderer.render = () => {}; });
  await p.waitForFunction(() => { const e = document.getElementById('enter'); return e && !e.disabled; }, null, { timeout: 600000, polling: 1000 });
  console.log('bereit nach', Date.now() - t0, 'ms');
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForFunction(() => window.vespera.nf && window.vespera.nf.NF.ready, null, { timeout: 90000, polling: 300 });
  const r = await p.evaluate(async () => {
    const K = await import('/src/kontor.js'), RD = await import('/src/ragdoll.js'), IM = await import('/src/imperial.js'), KA = await import('/src/karte.js'), R = await import('/src/ruf.js');
    const N = window.vespera.nf, { KT } = K, out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const news = []; window.addEventListener('vespera-news', e => news.push(e.detail && e.detail.titel));
    const key = code => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key: code.replace('Digit', ''), bubbles: true }));
    const opts = () => [...document.querySelectorAll('#nfDlg .op button')].map(b => b.textContent);
    const pickBy = re => { const i = opts().findIndex(t => re.test(t)); if (i >= 0) N.choose(i); return i; };
    KT.s.cash = Math.max(KT.s.cash, 5e6);
    // 1) Figuren
    const cits = RD.citizens.filter(c => c.nf);
    out.cits = cits.map(c => [c.nf, c.name, c.ped.kind, c.at.work.name]);
    out.pos = Object.keys(N.FIG).map(id => { const P = N.pos(id); return [id, !!P && Number.isFinite(P.x)]; });
    // 2) Jo: Gespräch, Bitte annehmen, Rosen übergeben
    N.open('jo'); await wait(50);
    out.jo1 = { open: N.NF.open && !document.getElementById('nfDlg').hidden, name: document.querySelector('#nfDlg h3').textContent, line: document.querySelector('#nfDlg .ln').textContent.slice(0, 60), opts: opts(), say: document.getElementById('say').textContent.slice(0, 40) };
    key('Digit1'); await wait(30);   // Kann ich etwas für Sie tun?
    out.jo2 = document.querySelector('#nfDlg .ln').textContent.slice(0, 50);
    key('Digit1'); await wait(30);   // Ich kümmere mich darum
    const qj = KT.s.q.list.find(q => q.nf === 'jo' && q.st === 'aktiv'); out.joQ = qj && [qj.title, qj.g.k, qj.src];
    key('Escape'); await wait(30); out.closed = !N.NF.open;
    KT.s.items.push({ k: 'blumen', n: 'Weiße Rosen' });
    const rel0 = N.s('jo').rel;
    N.open('jo'); await wait(30); out.giveOpt = opts()[0]; N.choose(0); await wait(30);
    out.joDone = { st: N.s('jo').st, rel: N.s('jo').rel - rel0, line: document.querySelector('#nfDlg .ln').textContent.slice(0, 40), items: KT.s.items.filter(i => i.k === 'blumen').length };
    N.close();
    // 3) Margot: Interview mit drei Fragen und Zeitungsmeldung
    N.open('margot'); await wait(30); pickBy(/Kann ich/); pickBy(/Fragen Sie/); N.choose(0); N.choose(2); N.choose(1); await wait(50);
    out.margot = { st: N.s('margot').st, news: news.includes('Ein Abend mit dem Gründer'), line: document.querySelector('#nfDlg .ln').textContent.slice(0, 40) };
    N.close();
    // 4) Kröger: Zielart Lohn (Kontor · Löhne)
    const sk = N.s('kroeger'); sk.st = 2; sk.rel = 30; N.open('kroeger'); await wait(30); pickBy(/noch etwas|Kann ich/); pickBy(/kümmere/); N.close();
    const qk = KT.s.q.list.find(q => q.nf === 'kroeger' && q.st === 'aktiv'); out.kroegerQ = qk && qk.g.k;
    const fid = Object.keys(KT.s.own).find(id => K.BIZ[id] && K.BIZ[id].inc > 0); if (fid) KT.s.own[fid].lohn = 2;
    await wait(1200); out.kroegerDone = N.s('kroeger').st;
    // 5) Hallstein: Stiftung, dann das letzte Wort
    const sh = N.s('hallstein'); sh.st = 3; sh.rel = 20; N.open('hallstein'); await wait(30); pickBy(/noch etwas|Kann ich/); pickBy(/kümmere/); N.close();
    const qh = KT.s.q.list.find(q => q.nf === 'hallstein' && q.st === 'aktiv'); out.hallQ = qh && [qh.g.k, qh.g.id];
    if (qh) KT.s.proj[qh.g.id] = true;
    await wait(1200); out.hallFinal = !!N.s('hallstein').f.final;
    const r0 = N.s('hallstein').rel; N.open('hallstein'); await wait(30); pickBy(/letzte Wort/); pickBy(/Partner/); N.close();
    out.hallAlly = { ally: !!N.s('hallstein').f.ally, d: N.s('hallstein').rel - r0, label: N.label('hallstein') };
    // 6) Anklopfen: Figur im Haus kommt vor die Tür
    const cb = RD.citizens.find(c => c.nf === 'brenner'); cb.st = 'in'; cb.wait = 50; cb.place = cb.at.home;
    window.vespera.player.p.set(cb.place.x, 0.3, cb.place.z);
    await wait(300); const lab = document.getElementById('prompt').textContent; out.knockLabel = lab;
    key('KeyE'); await wait(600); out.knock = cb.st;
    // 7) Ruf-Buch, Karte, Kapitän
    R.rufOpen(); await wait(100); out.ruf = { sec: [...document.querySelectorAll('#ruf section h3')].some(h => /Bekanntschaften/.test(h.textContent)), cards: document.querySelectorAll('#ruf .nfB .c').length }; R.rufClose();
    const L = []; for (const f of KA.KARTE.liveHooks) f(L, KA.KARTE.s.lay); out.karte = L.filter(x => x.cat === 'figuren').length;
    out.capt = IM.IMP_CAPT_HOOK.length;
    // 8) Speichern
    K.ktSave(); const sv = JSON.parse(localStorage.getItem('vespera.kontor') || 'null'); out.saved = !!(sv && sv.nf && sv.nf.jo && sv.nf.jo.st === 1 && sv.nf.hallstein.f.ally);
    out.inv = KT.s.items.map(i => i.k).filter(k => /^nf:/.test(k));
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  ok(r.cits.length === 4 && r.cits.every(c => c[1] && c[3]), 'Vier Bewohner sind Nebenfiguren: ' + r.cits.map(c => c[1] + ' (' + c[2] + ', ' + c[3] + ')').join(', '));
  ok(r.pos.every(x => x[1]), 'Alle sechs Figuren haben einen Ort');
  ok(r.jo1.open && /Lafleur/.test(r.jo1.name) && r.jo1.opts.length >= 3 && /Lafleur/.test(r.jo1.say), 'Gesprächsfeld offen, Sprechblase für die Stimme: ' + r.jo1.line);
  ok(r.joQ && r.joQ[1] === 'nfding' && r.joQ[2] === 'nf', 'Bitte angenommen (Taste 1): ' + (r.joQ || []).join(' · '));
  ok(r.closed, 'Esc schließt das Gespräch');
  ok(/Übergeben/.test(r.giveOpt || '') && r.joDone.st === 1 && r.joDone.rel >= 15 && r.joDone.items === 0, 'Rosen übergeben: Kapitel 1, Beziehung +' + r.joDone.rel);
  ok(r.margot.st === 1 && r.margot.news, 'Interview: drei Fragen, Meldung im Kurier');
  ok(r.kroegerQ === 'lohn' && r.kroegerDone === 3, 'Zielart Lohn erfüllt sich über das Kontor');
  ok(r.hallQ && r.hallQ[0] === 'stift' && r.hallFinal, 'Stiftung erfüllt, Hallstein will das letzte Wort');
  ok(r.hallAlly.ally && r.hallAlly.d >= 25, 'Handschlag: Partner, ' + r.hallAlly.label);
  ok(/Anklopfen/.test(r.knockLabel) && r.knock !== 'in', 'Anklopfen holt Brenner heraus: ' + r.knockLabel + ' → ' + r.knock);
  ok(r.ruf.sec && r.ruf.cards === 6, 'Ruf-Buch: Abschnitt Bekanntschaften mit 6 Karten');
  ok(r.karte === 6, 'Karte: 6 Figuren');
  ok(r.capt >= 1, 'Kapitänsmenü hat den Eintrag');
  ok(r.saved, 'Mit dem Kontor gespeichert');
  ok(errs.length === 0, 'keine Fehler im Browser' + (errs.length ? ': ' + errs.slice(0, 4).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FEHLER' : 'alles in Ordnung');
  process.exit(fails ? 1 : 0);
})();
