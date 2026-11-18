/* =====================================================================
   V106 · REAKTIONEN AUF ALEXANDER
   Bis V105 drehten sich die Leute zu ihm um, staunten, zogen den Hut oder
   duckten sich, blieben dabei aber stehen, wo sie waren. Jetzt bewegen sie
   sich seinetwegen:
   - FLUCHT: hebt er einen Wagen oder einen Menschen, wirft er etwas, stößt
     er mit Licht oder Druckwelle zu, dann laufen Ängstliche (und einige
     andere) ein paar Meter den Gehweg entlang davon, heben zitternd die
     Hände, schauen zurück und kommen erst danach langsam wieder.
   - SCHAULUSTIGE: schwebt er tief und langsam über einer Straße, kommen
     Passanten heran, zeigen nach oben, staunen, klatschen oder verschränken
     die Arme; fliegt er weiter, gehen sie wieder ihrer Wege.
   - FOTOGRAFEN vom Kurier kommen auf ihn zu, das Blitzlicht flammt auf
     (E: posieren, ein Wort für den Kurier, abwinken). Je besser er bei der
     Presse steht, desto öfter; bei schlechtem Ruf fragen sie spitz.
   - BITTSTELLER sprechen ihn an: Arbeit, Miete, ein krankes Kind, ein
     Erfinder, ein Ladenbesitzer wegen der Pacht, ein Autogramm (E: helfen,
     ein paar Lumen, abweisen). Wer abgewiesen wird, merkt es sich
     (gedaechtnis.js); ignoriert er sie, gehen sie nach einer Weile.
   - BUHRUFE: bei schlechtem Ruf buht eine Gruppe ihn aus, manchmal fliegt
     ein Schneeball; bei großer Bewunderung klatscht eine Gruppe.
   Alles über die Staun-Abläufe aus awe.js (pd.aw mit eigener Funktion),
   keine neuen Shader, Prüfungen alle 0,25 s, Suchen nur bei einem Anlass.
   ?reaktionen=aus = Stand V105.
   ===================================================================== */
import { T, scene, shared, MOBILE } from './core.js';
import { peds, turnHead, setAct, pedCrowd } from './serpentine.js';
import { player } from './player.js';
import { AWE, attOf, whoOf, startAwe, aweEnd, mobility } from './awe.js';
import { RUF, rufGet, rufAdd } from './ruf.js';
import { KT, ktCash } from './kontor.js';
import { lifeSay } from './life.js';
import { INTERACT } from './music.js';
import { openChoice, DINE } from './venues.js';
import { toast, districtAt, BOAT } from './boat.js';
import { DRIVE } from './eating.js';
import { GEGNER } from './gegner.js';
import { nearBoxes } from './people-skeleton.js';
import { playing, paused } from './input.js';

export const REAKTIONEN = typeof location === 'undefined' || new URLSearchParams(location.search).get('reaktionen') !== 'aus';
export const RK = { ready: false, tickT: 0.07, flee: 0, gather: [], hoverT: 0, photo: null, bitte: null, photoT: 50 + Math.random() * 40, bitteT: 70 + Math.random() * 60, booT: 25, ball: null, n: { flee: 0, gather: 0, photo: 0, bitte: 0, boo: 0, ball: 0 } };

const pick = a => a[Math.floor(Math.random() * a.length)];
const TAU = Math.PI * 2;
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// Gangart: Schrittlänge je Zyklus (people-skeleton.js) → Takt; Laufen ab Amplitude 0,74
export function gaitTo(pd, v) {
  const g = pd.a.gait, run = v > 2.4, L = run ? (pd.fem ? 2.0 : 2.3) : (pd.fem ? 1.164 : 1.366), c = v * TAU / L / (pd.sc || 1), amp = run ? 0.76 : (pd.fem ? 0.36 : 0.4);
  if (Math.abs(g[1] - c) > 0.02 || g[2] !== amp) { g[1] = c; g[2] = amp; pd.a.gv = (pd.a.gv | 0) + 1; }
}
// gehen bis zum Ziel; true = angekommen
export function walk(pd, A, tx, tz, v, dt) {
  const dx = tx - A.cx, dz = tz - A.cz, d = Math.hypot(dx, dz);
  if (d < 0.12) return true;
  const s = Math.min(d, v * dt); A.cx += dx / d * s; A.cz += dz / d * s;
  A.yaw += wrapA(Math.atan2(dx, dz) - A.yaw) * Math.min(1, dt * 7);
  gaitTo(pd, v); pedCrowd.set(pd.a, A.cx, A.y, A.cz, A.yaw, pd.sc);
  return false;
}
export function stand(pd, A, act, fx, fz, dt) {
  A.yaw += wrapA(Math.atan2(fx - A.cx, fz - A.cz) - A.yaw) * Math.min(1, dt * 5);
  setAct(pd, act); pedCrowd.set(pd.a, A.cx, A.y, A.cz, A.yaw, pd.sc, A.tilt || 0);
}
// frei? (Kollisionskästen der Häuser, Kioske, Laternen …)
export function clear(x0, z0, x1, z1, y) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(d / 1.1));
  for (let i = 1; i <= n; i++) {
    const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
    for (const b of nearBoxes(x, z, 0.5)) if (x > b.x0 - 0.35 && x < b.x1 + 0.35 && z > b.z0 - 0.35 && z < b.z1 + 0.35 && b.y0 < y + 1.6 && b.y1 > y + 0.25) return false;
  }
  return true;
}
export const pos = pd => { const e = pd.a.m.elements; return [e[12], e[13], e[14], Math.atan2(e[8], e[10])]; };
// ein Ablauf über awe.js: fn(pd, A, dt) liefert false, wenn er vorbei ist
export function begin(pd, fn, o = {}) {
  if (pd.aw) { if (pd.aw.fn) return null; aweEnd(pd); }
  const A = startAwe(pd, { act: 1.3, dur: 999, keep: false });
  const [x, y, z, yaw] = pos(pd);
  A.fn = fn; A.cx = x; A.cz = z; A.ox = x; A.oz = z; A.y = y; A.yaw = yaw; A.ph = 0; A.pt = 0; Object.assign(A, o);
  return A;
}
// zurück an den Ausgangspunkt, dann geht die Figur ihren alten Weg weiter
export function goHome(pd, A, dt) { if (walk(pd, A, A.ox, A.oz, A.homeV || 1.3, dt)) { pedCrowd.set(pd.a, A.ox, A.y, A.oz, A.yaw, pd.sc); return false; } return true; }
export const freePd = pd => pd.a && pd.a.on && !pd.rag && !pd.back && !pd.gg && !(pd.cit && pd.cit.nf) && !(pd.aw && pd.aw.fn) && mobility(pd) === 'walk';
const outdoor = () => {
  const p = player.p; if (p.y > 6 || DRIVE.on || BOAT.on) return false;
  let n = ''; try { n = districtAt(p.x, p.z, p.y)[0]; } catch (e) { n = ''; }
  return !/Belmont ·|Ballsaal|Penthouse|Bergvilla|Tunnel|Viadukt|Berge|Turm des/.test(n);
};
const quietHere = () => playing && !paused && !DINE.menuOpen && !GEGNER.ev && !player.fly && outdoor();
function say(who, s, dur = 4, force) { if (force) shared.sayTimer = 0; return lifeSay(who, s, dur); }

/* ---------- 1 · Flucht vor seinen Kräften ---------- */
const FLEE_KEYS = { heben: 1, wurfciv: 1.3, stossciv: 1.2, welle: 1.4, wagenwurf: 1.2, wagen: 0.8, moebel: 0.7 };
const FLEE_SAY = ['Weg hier!', 'Lauft! Er hebt schon wieder was!', 'Um Himmels willen, weg!', 'Nicht schon wieder!', 'Kinder, schnell, hinter mich!'];
function fleeStep(pd, A, dt) {
  const p = player.p;
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, A.v, dt)) { A.ph = 1; A.pt = 0; A.tilt = -0.12; } return true; }
  A.pt += dt;
  if (A.ph === 1) { stand(pd, A, A.fear ? 13.2 : 1.3, p.x, p.z, dt); if (A.pt > 1.2) turnHead(pd.a, p.x, p.z); if (A.pt > A.wait) { A.ph = 2; A.tilt = 0; } return true; }
  return goHome(pd, A, dt);
}
function flee(key) {
  const k = FLEE_KEYS[key]; if (!k || !RK.ready || player.fly && player.p.y > 30) return;
  const p = player.p, R = 15 + 4 * k, R2 = R * R, max = MOBILE ? 4 : 8;
  let n = 0;
  const list = [];
  for (const pd of peds) {
    if (!freePd(pd)) continue;
    const e = pd.a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2; if (d2 > R2 || d2 < 1 || Math.abs(e[13] - p.y) > 6) continue;
    list.push([d2, pd]);
  }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, pd] of list) {
    const att = attOf(pd), kid = pd.a.kind === 'kid', r = Math.random();
    const go = att === 'furcht' ? 1 : att === 'dienst' ? 0 : kid ? 0.35 : att === 'bew' || att === 'resp' ? 0.12 * k : 0.35 * k;
    if (r > go) continue;
    const [x, y, z, yaw] = pos(pd), fx = Math.sin(yaw), fz = Math.cos(yaw), away = (x - p.x) * fx + (z - p.z) * fz >= 0 ? 1 : -1, L = 7 + Math.random() * 5;
    let tx = x + fx * away * L, tz = z + fz * away * L;
    if (!clear(x, z, tx, tz, y)) { tx = x - fx * away * L * 0.6; tz = z - fz * away * L * 0.6; if (!clear(x, z, tx, tz, y) || (tx - p.x) ** 2 + (tz - p.z) ** 2 < (x - p.x) ** 2 + (z - p.z) ** 2) continue; }
    const A = begin(pd, fleeStep, { tx, tz, v: 3.3 + Math.random() * 0.9, wait: 2.2 + Math.random() * 2.5, fear: att === 'furcht' || Math.random() < 0.5, homeV: 1.25 });
    if (!A) continue;
    RK.n.flee++;
    if (++n >= max) break;
  }
  if (n && n >= 2 && AWE.sayT <= 0) { if (say('Aus der Menge', pick(FLEE_SAY), 2.6)) AWE.sayT = 6; }
}

/* ---------- 2 · Schaulustige unter dem schwebenden Alexander ---------- */
const GATHER_SAY = { bew: ['Er schwebt direkt über uns!', 'Herr Alexander! Hier unten!', 'Schau doch, Mama, da oben!', 'Unglaublich … er steht einfach in der Luft.'], cool: ['Da hängt er wieder in der Luft und schaut auf uns herab.', 'Schön da oben, Herr Alexander? Hier unten ist es nass.', 'Na, wieder Zirkus heute?'] };
function gatherStep(pd, A, dt) {
  const p = player.p, gone = !player.fly || (p.x - A.cx) ** 2 + (p.z - A.cz) ** 2 > 45 * 45 || p.y > A.y + 45 || A.t > 50;
  if (gone && A.ph < 2) { A.ph = 2; A.homeV = 1.35; }
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, A.v, dt)) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) { A.pt += dt; stand(pd, A, A.act, p.x, p.z, dt); if (A.pt > 0.6) { A.pt = 0; turnHead(pd.a, p.x, p.z); } return true; }
  return goHome(pd, A, dt);
}
function gatherAct(pd, att) {
  const r = Math.random(), kid = pd.a.kind === 'kid';
  if (kid) return r < 0.5 ? 16.3 : 8.2;
  if (att === 'bew') return r < 0.35 ? 16.3 : r < 0.6 ? 8.2 : r < 0.8 ? 9.3 : 1.3;
  if (att === 'resp') return r < 0.4 ? 16.3 : 1.3;
  if (att === 'hass') return r < 0.6 ? 15.3 : 12.2;
  return r < 0.5 ? 12.2 : 1.3;   // neid, skep
}
function gather(dt) {
  const p = player.p;
  const v = Math.hypot(player.v ? player.v.x : 0, player.v ? player.v.z : 0);
  const low = player.fly && !DRIVE.on && v < 5 && p.y > 2.5 && p.y < 40 && Math.hypot(p.x, p.z) < 1100 && !GEGNER.ev;
  RK.hoverT = low ? RK.hoverT + dt : 0;
  if (RK.hoverT < 1.6 || (RK.gatherT = (RK.gatherT || 0) - dt) > 0) return;
  RK.gatherT = 1.2;
  let busy = 0; for (const pd of RK.gather) if (pd.aw && pd.aw.fn === gatherStep && pd.aw.ph < 2) busy++;
  RK.gather = RK.gather.filter(pd => pd.aw && pd.aw.fn === gatherStep);
  const max = MOBILE ? 5 : 9; if (busy >= max) return;
  let n = 0;
  for (const pd of peds) {
    if (!freePd(pd)) continue;
    const e = pd.a.m.elements, dx = e[12] - p.x, dz = e[14] - p.z, d2 = dx * dx + dz * dz; if (d2 > 32 * 32 || d2 < 9 || p.y - e[13] > 40) continue;
    const att = attOf(pd); if (att === 'furcht' || att === 'dienst' && Math.random() < 0.7 || Math.random() < 0.35) continue;
    const [x, y, z, yaw] = pos(pd), fx = Math.sin(yaw), fz = Math.cos(yaw);
    let s = (p.x - x) * fx + (p.z - z) * fz; s = Math.max(-14, Math.min(14, s));
    const off = (Math.random() - 0.5) * 3, tx = x + fx * (s + off), tz = z + fz * (s + off);
    if (Math.abs(s) < 1.5 || !clear(x, z, tx, tz, y)) continue;
    const kid = pd.a.kind === 'kid', A = begin(pd, gatherStep, { tx, tz, v: kid ? 3.0 : 1.35 + Math.random() * 0.4, act: gatherAct(pd, att), homeV: 1.3 });
    if (!A) continue;
    RK.gather.push(pd); RK.n.gather++;
    if (++n + busy >= max || n >= 3) break;
  }
  if (n && AWE.sayT <= 0 && Math.random() < 0.5) { const cool = rufGet('bew') < 50 || rufGet('arbeiter') < 40; if (say('Von unten', pick(cool ? GATHER_SAY.cool : GATHER_SAY.bew), 3)) AWE.sayT = 8; }
}

/* ---------- 3 · Fotografen vom Kurier ---------- */
const PHOTO_SAY = {
  hi: ['Herr Alexander! Ein Bild für den Kurier! Nur eins!', 'Hierher, Herr Alexander! Lächeln!', 'Herr Alexander, für die Titelseite, bitte!'],
  lo: ['Herr Alexander! Stimmt es, was man über die Löhne sagt? Nur ein Foto!', 'Herr Alexander, ein Wort zu den Vorwürfen? Bitte recht freundlich!', 'Ein Bild für den Kurier, Herr Alexander. Die Leser wollen sehen, wie Sie lachen.'],
};
const flashEl = () => { let el = document.getElementById('rkFlash'); if (!el) { el = document.createElement('div'); el.id = 'rkFlash'; el.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40;transition:opacity .22s ease-out'; document.body.append(el); } return el; };
function flash(d) {
  const el = flashEl(), k = Math.max(0.08, 0.42 - d * 0.02);
  el.style.transition = 'none'; el.style.opacity = k; void el.offsetWidth; el.style.transition = 'opacity .28s ease-out'; el.style.opacity = 0;
  RK.flashes = (RK.flashes || 0) + 1;
}
function photoStep(pd, A, dt) {
  const p = player.p, d = Math.hypot(p.x - A.cx, p.z - A.cz);
  if (A.ph < 3 && (d > 32 || player.fly || A.t > 40 || DRIVE.on)) { A.ph = 3; RK.photo = null; }
  if (A.ph === 0) {
    const tx = p.x + (A.cx - p.x) / (d || 1) * 3.2, tz = p.z + (A.cz - p.z) / (d || 1) * 3.2;
    if (d < 3.6 || walk(pd, A, tx, tz, 1.9, dt)) { A.ph = 1; A.pt = 0; A.shots = 0; if (!A.said) { A.said = true; say('Ein Fotograf', pick(rufGet('presse') >= 55 ? PHOTO_SAY.hi : PHOTO_SAY.lo), 3.5); } }
    return true;
  }
  if (A.ph === 1) {   // fotografieren: Kamera vors Gesicht (Handlung 4), alle 1,3 s ein Blitz
    A.pt += dt; stand(pd, A, 4.2, p.x, p.z, dt);
    if (A.pt > 1.3) { A.pt = 0; A.shots++; flash(d); turnHead(pd.a, p.x, p.z); }
    if (A.shots >= (A.pose ? 5 : 3) && !A.wait) { A.wait = true; A.wt = A.t; }
    if (A.wait && A.t - A.wt > (A.pose ? 1 : 7)) { A.ph = 2; A.pt = 0; if (!A.done) { A.done = true; rufAdd({ presse: 0.2 }, 'Vom Kurier fotografiert', { key: 'foto', quiet: true }); } }
    return true;
  }
  if (A.ph === 2) { A.pt += dt; stand(pd, A, 1.3, p.x, p.z, dt); if (A.pt > 1.2) { A.ph = 3; RK.photo = null; } return true; }
  return goHome(pd, A, dt);
}
function photoMenu() {
  const pd = RK.photo, A = pd && pd.aw; if (!A || A.ph > 1) return;
  A.ph = 1; A.wait = false; A.t = Math.min(A.t, 20);
  openChoice('Ein Fotograf vom Vespera-Kurier', ['Für das Foto posieren', 'Ein Wort für den Kurier', 'Abwinken: keine Fotos'], i => {
    if (!KT.s) return;
    if (i === 0) { A.pose = true; A.shots = 0; rufAdd({ presse: 1, bew: 0.3 }, 'Für den Kurier posiert', { key: 'foto:pose' }); say('Der Fotograf', pick(['Wunderbar! Genau so! Das wird die Titelseite!', 'Noch eins … perfekt, Herr Alexander!']), 3, true); }
    else if (i === 1) {
      const good = rufGet('presse') >= 50;
      rufAdd({ presse: good ? 1.6 : 1.0 }, 'Ein Wort für den Kurier', { key: 'foto:wort' });
      say('Der Fotograf', good ? 'Danke, Herr Alexander! Das steht morgen im Kurier.' : 'Danke. Mal sehen, was die Redaktion daraus macht.', 3.4, true);
      try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel: good ? 'Alexander auf der Straße: „Vespera wächst weiter“' : 'Alexander auf der Straße: kurz angebunden', text: good ? 'Unser Fotograf traf Herrn Alexander zu Fuß in der Stadt. Er sprach von neuen Plänen für Vespera und ließ sich gern ablichten.' : 'Unser Fotograf traf Herrn Alexander zu Fuß in der Stadt. Auf Fragen nach Löhnen und Mieten antwortete er knapp; das Foto zeigt ein höfliches, aber kühles Lächeln.', rubrik: 'Stadt', prio: 4 } })); } catch (e) { /* ohne Zeitung */ }
      A.shots = 3;
    } else { rufAdd({ presse: -0.6 }, 'Den Fotografen abgewiesen', { key: 'foto:nein' }); say('Der Fotograf', pick(['Schon gut, schon gut. Kein Foto.', 'Wie Sie wünschen. Die Leser werden fragen, warum.']), 3, true); A.ph = 2; A.pt = 0; }
  });
}
function photoTry(dt) {
  if (RK.photo) { const A = RK.photo.aw; if (!A || A.fn !== photoStep) RK.photo = null; return; }
  if ((RK.photoT -= dt) > 0 || !quietHere()) return;
  const pr = rufGet('presse'); RK.photoT = (pr >= 70 ? 55 : pr >= 45 ? 85 : 120) + Math.random() * 50;
  let n = ''; try { n = districtAt(player.p.x, player.p.z, player.p.y)[0]; } catch (e) { n = ''; }
  if (/Arbeiterviertel|Industrie/.test(n) && Math.random() < 0.7) return;
  const pd = candidate(9, 26, pd => { const k = pd.a.kind; return k === 'coat' || k === 'suit' || k === 'lady' || k === 'dress' || !k; });
  if (!pd) return;
  if (begin(pd, photoStep)) { RK.photo = pd; RK.n.photo++; }
}
// ein freier Passant im Ring [r0, r1], der ihn erreichen kann
function candidate(r0, r1, ok) {
  const p = player.p; let best = null, bd = 1e9;
  for (const pd of peds) {
    if (!freePd(pd) || (ok && !ok(pd))) continue;
    const e = pd.a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2; if (d2 < r0 * r0 || d2 > r1 * r1 || Math.abs(e[13] - p.y) > 2.5) continue;
    const sc = d2 * (0.6 + Math.random() * 0.8); if (sc < bd && clear(e[12], e[14], p.x, p.z, e[13])) { bd = sc; best = pd; }
  }
  return best;
}

/* ---------- 4 · Bittsteller ---------- */
const BITTE = [
  { id: 'arbeit', who: k => k === 'worker', t: 'Ich suche Arbeit, Herr Alexander. Irgendwas. Ich kann anpacken, wirklich.',
    o: [['Eine Empfehlung fürs Kontor schreiben', 0, 'hilfe', { arbeiter: 1.2, buerger: 0.3 }], ['20 Lumen für heute', 20, 'gabe', { arbeiter: 0.5 }], ['Kein Bedarf', 0, 'nein', { arbeiter: -0.8 }]] },
  { id: 'miete', t: 'Die Miete ist fällig, und ich hab nur die Hälfte. Ihre Hausverwaltung kennt kein Erbarmen. Bitte, Herr Alexander.',
    o: [['Die Miete bezahlen · 120 Lumen', 120, 'hilfe', { buerger: 1.2, arbeiter: 0.8, presse: 0.3 }], ['20 Lumen geben', 20, 'gabe', { buerger: 0.3 }], ['Das ist nicht meine Sache', 0, 'nein', { buerger: -0.6, arbeiter: -0.6 }]] },
  { id: 'arzt', t: 'Meine Kleine hat Fieber, und der Arzt will Vorkasse. Ich weiß nicht, wen ich sonst fragen soll.',
    o: [['Den Arzt bezahlen · 80 Lumen', 80, 'hilfe', { buerger: 1, arbeiter: 1, bew: 0.4 }], () => KT.s && KT.s.proj && KT.s.proj.spital ? ['Ins Hospital am Kraterrand schicken', 0, 'hilfe', { buerger: 0.5 }] : ['Einen Arzt empfehlen', 0, 'gabe', { buerger: 0.2 }], ['Dafür habe ich keine Zeit', 0, 'nein', { buerger: -1, arbeiter: -0.8, presse: -0.2 }]] },
  { id: 'erfinder', who: k => k !== 'worker', t: 'Ein Patent, Herr Alexander! Eine Heizung, die mit dem Staub vom Kraterrand brennt. Ich brauche nur einen Geldgeber.',
    o: [['In die Erfindung investieren · 500 Lumen', 500, 'hilfe', { buerger: 0.8, presse: 0.5 }], ['Eine Visitenkarte geben', 0, 'gabe', { buerger: 0.2 }], ['Kein Interesse', 0, 'nein', { buerger: -0.3 }]] },
  { id: 'pacht', who: k => k !== 'worker', t: 'Mein Laden, Herr Alexander … die neue Pacht Ihrer Gesellschaft bringt mich um. Dreißig Jahre Hutmacherei, und jetzt das.',
    o: [['Einen Nachlass gewähren · 300 Lumen', 300, 'hilfe', { buerger: 1.5, presse: 0.4 }], ['50 Lumen Entschädigung', 50, 'gabe', { buerger: 0.4 }], ['Geschäft ist Geschäft', 0, 'nein', { buerger: -1.2, presse: -0.3 }]] },
  { id: 'autogramm', who: (k, att) => att === 'bew' || k === 'kid', t: 'Herr Alexander! Ein Autogramm, bitte! Für meine Mutter. Sie glaubt mir sonst nicht, dass ich Sie getroffen habe.',
    o: [['Unterschreiben', 0, 'autogramm', { bew: 0.4, buerger: 0.2 }], ['Keine Zeit', 0, 'nein', { bew: -0.3 }]] },
];
const BITTE_DANK = { hilfe: { warm: ['Danke, Herr Alexander! Das vergesse ich Ihnen nie.', 'Wirklich? Danke … ich weiß gar nicht, was ich sagen soll.'], cool: ['Danke. Ich hätte nicht gedacht, dass Sie das tun.', 'Na gut. Das war anständig, Herr Alexander.'] },
  gabe: { warm: ['Danke, Herr Alexander. Das hilft schon.', 'Vergelt’s Gott, Herr Alexander.'], cool: ['Zwanzig Lumen. Danke. Für Sie sind das Krümel, für mich ist es ein Abendessen.', 'Danke. Ein Anfang.'] },
  autogramm: { warm: ['Danke! Das rahme ich ein!', 'Meine Mutter wird weinen vor Freude!'], cool: ['Danke.'] },
  nein: { warm: ['Natürlich … verzeihen Sie die Störung.', 'Ich verstehe. Sie haben viel zu tun.'], cool: ['Hab ich mir gedacht.', 'Natürlich nicht. Wie immer.', 'Schönen Abend noch, im Penthouse.'] } };
function bitteStep(pd, A, dt) {
  const p = player.p, d = Math.hypot(p.x - A.cx, p.z - A.cz);
  if (A.ph < 3 && (d > 26 || player.fly || DRIVE.on || A.t > 60)) { A.ph = 3; RK.bitte = null; }
  if (A.ph === 0) {
    const tx = p.x + (A.cx - p.x) / (d || 1) * 1.7, tz = p.z + (A.cz - p.z) / (d || 1) * 1.7;
    if (d < 2.0 || walk(pd, A, tx, tz, 1.5, dt)) { A.ph = 1; A.pt = 0; A.tilt = -0.04; say(whoOf(pd), A.B.t, 6, true); }
    return true;
  }
  if (A.ph === 1) {   // warten auf Antwort (E); nach 14 s gibt er auf
    A.pt += dt; stand(pd, A, A.B.id === 'autogramm' ? 3.6 : 1.3, p.x, p.z, dt);
    if (A.pt > 3 && Math.floor(A.pt) % 4 === 0) turnHead(pd.a, p.x, p.z);
    if (A.pt > 14 && !DINE.menuOpen) { A.ph = 2; A.pt = 0; A.tilt = 0; rufAdd({}, 'Einen Bittsteller übergangen', { key: 'bitte:nein', quiet: true }); say(whoOf(pd), pick(['Schon gut … Sie haben Wichtigeres zu tun.', 'Hab ich mir gedacht.', 'Entschuldigen Sie die Störung, Herr Alexander.']), 3); }
    return true;
  }
  if (A.ph === 2) { A.pt += dt; stand(pd, A, A.act2 || 1.3, p.x, p.z, dt); if (A.pt > 2.4) { A.ph = 3; RK.bitte = null; } return true; }
  return goHome(pd, A, dt);
}
function bitteMenu() {
  const pd = RK.bitte, A = pd && pd.aw; if (!A || A.ph !== 1) return;
  A.pt = Math.min(A.pt, 2);
  const opts = A.B.o.map(o => typeof o === 'function' ? o() : o);
  openChoice(whoOf(pd) + ' · ' + { arbeit: 'sucht Arbeit', miete: 'kann die Miete nicht zahlen', arzt: 'braucht einen Arzt', erfinder: 'hat eine Erfindung', pacht: 'wegen der Pacht', autogramm: 'möchte ein Autogramm' }[A.B.id], opts.map(o => o[0]), i => {
    if (!KT.s || !opts[i]) return;
    const [label, cost, kind, ch] = opts[i];
    if (cost) ktCash(-cost, 'Bittsteller: ' + label.replace(/ · .*$/, ''));
    // Schlüssel für das Gedächtnis (gedaechtnis.js): hilfe, gabe, autogramm, nein
    rufAdd(ch, kind === 'nein' ? 'Einen Bittsteller abgewiesen' : kind === 'autogramm' ? 'Ein Autogramm gegeben' : kind === 'hilfe' ? 'Einem Bittsteller geholfen' : 'Einem Bittsteller etwas gegeben', { key: 'bitte:' + kind });
    const att = attOf(pd), cool = att === 'hass' || att === 'skep' || att === 'neid', L = BITTE_DANK[kind];
    say(whoOf(pd), pick(cool ? L.cool : L.warm), 4, true);
    A.ph = 2; A.pt = 0; A.tilt = 0; A.act2 = kind === 'nein' ? 1.3 : kind === 'autogramm' ? 8.2 : (!pd.fem && Math.random() < 0.5 ? 5.3 : 1.3);
  });
}
function bitteTry(dt) {
  if (RK.bitte) { const A = RK.bitte.aw; if (!A || A.fn !== bitteStep) RK.bitte = null; return; }
  if ((RK.bitteT -= dt) > 0 || !quietHere() || RK.photo) return;
  let n = ''; try { n = districtAt(player.p.x, player.p.z, player.p.y)[0]; } catch (e) { n = ''; }
  const poor = /Arbeiterviertel|Industrie/.test(n), wohl = KT.s ? KT.s.wohl || 50 : 50;
  RK.bitteT = (poor ? 70 : 110) + (wohl - 50) * 0.8 + Math.random() * 60;
  const pd = candidate(6, 22, pd => { const a = attOf(pd); return a !== 'furcht' && a !== 'hass' && a !== 'dienst'; });
  if (!pd) return;
  const k = pd.a.kind, att = attOf(pd), L = BITTE.filter(B => !B.who || B.who(k, att)), B = k === 'kid' ? BITTE[5] : pick(L);
  if (begin(pd, bitteStep, { B })) { RK.bitte = pd; RK.n.bitte++; }
}

/* ---------- 5 · Buhrufe, Schneebälle, Applaus von Gruppen ---------- */
const BOO = ['Buh! Zurück ins Penthouse!', 'Buuuh! Erst die Löhne, dann der Spaziergang!', 'Da kommt der Herr der Türme! Buh!', 'Pfui! Von unserem Schweiß gebaut!'];
const CHEER = ['Bravo, Herr Alexander!', 'Ein Hoch auf den Herrn von Vespera!', 'Da ist er! Herr Alexander!'];
function booTry(dt) {
  if ((RK.booT -= dt) > 0 || !quietHere()) return;
  RK.booT = 3;
  const p = player.p, arb = rufGet('arbeiter'), bew = rufGet('bew');
  for (const pd of peds) {
    const c = pd.chat; if (!c || !c.m || c.m.length < 2 || c.rkT > AWE.clock || !pd.a || !pd.a.on) continue;
    const e = pd.a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2; if (d2 > 14 * 14 || d2 < 4 || Math.abs(e[13] - p.y) > 3) continue;
    c.rkT = AWE.clock + 120;
    let hass = 0, fan = 0; for (const o of c.m) { const a = o.a && attOf(o); if (a === 'hass') hass++; else if (a === 'skep' && arb < 40) hass += 0.5; if (a === 'bew') fan++; }
    const boo = hass >= 1.5 && hass >= c.m.length * 0.5, cheer = !boo && fan >= 2 && bew >= 70 && Math.random() < 0.6;
    if (!boo && !cheer) continue;
    for (const o of c.m) if (o.a && o.a.on && !o.aw && !o.rag) { startAwe(o, { act: boo ? (Math.random() < 0.6 ? 15.3 : 12.2) : (Math.random() < 0.7 ? 9.3 : 8.2), dur: 3.2 + Math.random() * 1.5, keep: mobility(o) !== 'walk', lean: boo ? 0.06 : 0 }); turnHead(o.a, p.x, p.z); }
    shared.sayTimer = 0; lifeSay(boo ? 'Aus der Gruppe' : 'Aus der Gruppe', pick(boo ? BOO : CHEER), 3.2);
    if (boo) { RK.n.boo++; rufAdd({}, 'Ausgebuht', { key: 'buhrufe', quiet: true }); if (!RK.ball && (arb < 35 || hass >= 2) && Math.random() < 0.45) throwBall(c.m.find(o => o.a && o.a.on && attOf(o) === 'hass') || pd); }
    else RK.n.cheer = (RK.n.cheer || 0) + 1;
    RK.booT = 40 + Math.random() * 40;
    return;
  }
}
// Schneeball: eine kleine Kugel im Bogen vom Werfer zu Alexander (er ist unverwundbar; es geht um die Geste)
function throwBall(pd) {
  if (!pd || !pd.a) return;
  if (!RK.ballMesh) { RK.ballMesh = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), new T.MeshStandardMaterial({ color: 0xeef4f8, roughness: 0.9 })); RK.ballMesh.frustumCulled = false; scene.add(RK.ballMesh); }
  const e = pd.a.m.elements, p = player.p;
  RK.ball = { t: 0, x0: e[12], y0: e[13] + 1.7, z0: e[14], dur: 0.75 + Math.hypot(p.x - e[12], p.z - e[14]) * 0.04, pd };
  RK.ballMesh.visible = true; RK.n.ball++;
  startAwe(pd, { act: 15.3, dur: 2.5, keep: mobility(pd) !== 'walk' });
}
function ballStep(dt) {
  const B = RK.ball; if (!B) return;
  B.t += dt; const p = player.p, k = Math.min(1, B.t / B.dur), tx = p.x, ty = p.y + 1.45, tz = p.z;
  RK.ballMesh.position.set(B.x0 + (tx - B.x0) * k, B.y0 + (ty - B.y0) * k + Math.sin(k * Math.PI) * 1.6, B.z0 + (tz - B.z0) * k);
  if (k >= 1) {
    RK.ball = null; RK.ballMesh.visible = false;
    toast('Ein Schneeball zerplatzt an Ihrem Mantel.');
    rufAdd({ furcht: -0.4 }, 'Mit einem Schneeball beworfen', { key: 'schneeball' });
    setTimeout(() => { shared.sayTimer = 0; lifeSay(whoOf(B.pd), pick(['Grüße aus dem Viertel, Herr Alexander!', 'Der war für die Löhne!', 'Treffer! Und jetzt? Werfen Sie mich auch durch die Luft?']), 3.4); }, 300);
  }
}

/* ---------- Schleife ---------- */
function tick(dt) {
  gather(dt);
  photoTry(dt);
  bitteTry(dt);
  booTry(dt);
}
function init() {
  if (RK.ready || !REAKTIONEN) return;
  RK.ready = true;
  RUF.onAdd.push(key => { if (FLEE_KEYS[key] && (!GEGNER.ev || Math.random() < 0.5)) flee(key); });
  INTERACT.unshift({ test: p => { const pd = RK.bitte; if (!pd || !pd.aw || pd.aw.ph !== 1) return false; const A = pd.aw; return (A.cx - p.x) ** 2 + (A.cz - p.z) ** 2 < 3.2 * 3.2; }, get label() { return RK.bitte ? 'Anhören: ' + whoOf(RK.bitte) : ''; }, act: bitteMenu });
  INTERACT.unshift({ test: p => { const pd = RK.photo; if (!pd || !pd.aw || pd.aw.ph > 1) return false; const A = pd.aw; return (A.cx - p.x) ** 2 + (A.cz - p.z) ** 2 < 4.5 * 4.5; }, label: 'Fotograf vom Kurier', act: photoMenu });
  if (window.vespera) window.vespera.reaktionen = { RK, flee, gather, photoTry, bitteTry, booTry, throwBall, photoMenu, bitteMenu, BITTE, clear, candidate };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!RK.ready || why !== 'frame') return;
  ballStep(dt);
  if ((RK.tickT -= dt) > 0) return;
  const step = 0.25 - RK.tickT; RK.tickT = 0.25;
  if (playing && !paused) tick(step);
});
