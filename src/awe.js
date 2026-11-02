/* =====================================================================
   V52 · STAUNEN UND RESPEKT: wie die Stadt auf Alexanders Kräfte reagiert
   Hebt er ab, fliegt er vorbei, landet er mit Wucht, schwebt ein Sofa oder
   ein Wagen vor ihm, dann halten die Leute in der Nähe inne: Gehende bleiben
   stehen und drehen sich zu ihm, Grüppchen wenden sich um, wer sitzt, schaut
   wenigstens hin. Dazu Gesten aus dem Bestand der Figuren: nach oben zeigen
   (16), staunend die Arme heben (8), Applaus (9), die Herren ziehen den Hut
   (5), und bei der Heldenlandung verbeugen sich manche (Neigung der ganzen
   Figur, kein Shader-Zusatz). Ein Lächeln legt sich auf die Gesichter
   (aLive.w). Nach ein paar Sekunden geht jeder seiner Wege.
   Niemand sonst hat solche Kräfte; die Stadt weiß, wer er ist: ab und zu
   ruft jemand etwas ("Seht nur, Alexander fliegt!").
   ===================================================================== */
import { $, shared, U } from './core.js';
import { peds, turnHead, setAct, pedCrowd } from './serpentine.js';
import { player } from './player.js';
import { interiorCrowd } from './belmont.js';
import { VILLA } from './harbour.js';

export const AWE = { sayT: 0, flyT: 0, tkT: 0, n: 0, lines: 0 };
const SAY = {
  takeoff: ['Seht nur, er hebt ab!', 'Da fliegt er! Alexander!', 'Meine Güte, er fliegt wirklich!', 'Hut ab, Herr Alexander!'],
  fly: ['Seht nur, Alexander fliegt!', 'Da oben! Das ist Alexander!', 'Guten Abend, Herr Alexander!', 'Unglaublich … er fliegt.'],
  land: ['Meine Güte!', 'Das war Alexander!', 'Haben Sie das gesehen?', 'Der Herr von Vespera persönlich.'],
  tk: ['Es schwebt! Es schwebt einfach!', 'Haben Sie das gesehen? Ganz ohne Hände!', 'Das kann nur Alexander.', 'Mein Gott, der Wagen fliegt!', 'Unglaublich, Herr Alexander!'],
  throw: ['Bravo!', 'Haben Sie das gesehen?', 'Was für eine Kraft!', 'Bravo, Herr Alexander!'],
};
// Geste je Anlass: [Handlung, Wahrscheinlichkeit] (Herren tragen Hut: 5; nach oben zeigen: 16; staunen: 8; Applaus: 9; einfach hinsehen: 1)
function pickAct(kind, fem) {
  const r = Math.random();
  if (kind === 'fly' || kind === 'takeoff') return fem ? (r < 0.2 ? 8.2 : 1.3) : (r < 0.35 ? 16.3 : r < 0.5 ? 8.2 : r < 0.62 ? 5.3 : 1.3);
  if (kind === 'land') return r < 0.4 ? 8.2 : r < 0.6 ? 9.3 : (!fem && r < 0.75 ? 5.3 : 1.3);
  if (kind === 'throw') return r < 0.5 ? 9.3 : r < 0.8 ? 8.2 : 1.3;
  return fem ? (r < 0.3 ? 8.2 : r < 0.45 ? 9.3 : 1.3) : (r < 0.25 ? 8.2 : r < 0.45 ? 9.3 : r < 0.6 ? 5.3 : 1.3);   // tk
}
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// Hut ziehen (5) und nach oben zeigen (16) sind im Shader Zyklen von 7 bzw. 12 s; die Zeitverschiebung der Figur (gait[0]) wird
// so gewählt, dass die Geste jetzt beginnt (tt = uTime·(0,9 + 0,2·fract(g·3,7)) + 7·g, siehe people-skeleton.js)
function phaseFor(act, g0) {
  const P = act < 6 ? 7 : 12, s0 = act < 6 ? 0.0 : 0.05, t = U.uTime.value, fr = x => x - Math.floor(x);
  for (let n = 0; n < 240; n++) { const g = g0 + n * 0.0417, tt = t * (0.9 + 0.2 * fr(g * 3.7)) + g * 7, f = fr(tt / P); if (f >= s0 && f < s0 + 0.025) return g; }
  return g0;
}
/* Alle in der Nähe reagieren. kind: 'takeoff' | 'fly' | 'land' | 'tk' | 'throw'; R: Umkreis; k: Anteil derer, die stehen bleiben */
export function aweBurst(kind, R, k = 0.9) {
  if (!pedCrowd) return;
  const p = player.p, R2 = R * R, dy = kind === 'fly' || kind === 'takeoff' ? 70 : 9;
  let nearest = null, nd = 1e9, n = 0;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.rag || pd.back) continue;
    const e = a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 > R2 || Math.abs(e[13] - p.y) > dy) continue;
    if (pd.aw) { pd.aw.dur = Math.max(pd.aw.dur, pd.aw.t + 2.5 + Math.random() * 2); turnHead(a, p.x, p.z); continue; }
    if (pd.awCool > 0 && kind === 'fly') continue;
    turnHead(a, p.x, p.z);
    // wer sitzt oder gerade durch eine Tür geht, schaut nur hin (und lächelt)
    const walking = pd.st === 0 && pd.lp, group = pd.st === 4 && !pd.sit, cit = pd.cit && (pd.cit.st === 'walk' || pd.cit.st === 'task' || pd.cit.st === 'loop');
    if (a.live) { pd.sm0 = pd.sm0 ?? a.live[3]; a.live[3] = 1.55; a.gv = (a.gv | 0) + 1; }
    if (!(walking || group || cit) || Math.random() > k) { pd.awCool = 3; AWE.smiles.push(pd); continue; }
    const yaw0 = Math.atan2(e[8], e[10]), g = a.gait;
    const A = pd.aw = { t: 0, dur: 3.2 + Math.random() * 3, x: e[12], y: e[13], z: e[14], yaw: yaw0, yaw0, act: pickAct(kind, pd.fem), act0: g[1], g2: g[2], g0: g[0], st0: pd.st, keep: group, lookT: 0,
      bow: kind === 'land' && !pd.fem && Math.random() < 0.5 ? 0.3 + Math.random() * 0.3 : kind !== 'fly' && !pd.fem && Math.random() < 0.15 ? 0.6 : 0 };
    if (A.bow) A.act = 1.3;
    if (walking) pd.st = 9;
    if (A.act > 4.5 && A.act < 5.5) { g[0] = phaseFor(5, g[0]); A.dur = Math.max(A.dur, 3.4); }
    else if (A.act > 15.5 && A.act < 16.5) { g[0] = phaseFor(16, g[0]); A.dur = Math.max(A.dur, 6.5); }
    setAct(pd, A.act); a.gv = (a.gv | 0) + 1;
    n++;
    if (d2 < nd) { nd = d2; nearest = pd; }
  }
  AWE.n = n;
  // Gäste und Personal im Belmont und in der Villa (eigene Figurenlisten): Kopf drehen und lächeln
  for (const C of [interiorCrowd, VILLA.crowd]) {
    if (!C || !C.list) continue;
    for (const a of C.list) {
      if (!a.on || !a.live) continue;
      const e = a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 > R2 || Math.abs(e[13] - p.y) > dy) continue;
      turnHead(a, p.x, p.z);
      if (a.sm0 == null) { a.sm0 = a.live[3]; a.live[3] = 1.55; a.gv = (a.gv | 0) + 1; AWE.smiles.push({ a, awCool: 5, ext: true }); }
    }
  }
  // ab und zu ruft jemand etwas (nur in Hörweite)
  if (nearest && nd < 16 * 16 && AWE.sayT <= 0 && Math.random() < 0.6) {
    const L = SAY[kind] || SAY.tk, s = L[Math.floor(Math.random() * L.length)], el = $('say');
    if (el) { el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = nearest.cit ? nearest.cit.name : nearest.fem ? 'Eine Dame' : 'Ein Herr'; el.querySelector('span').textContent = '„' + s + '“'; el.style.opacity = 1; shared.sayTimer = 4; }
    AWE.sayT = 7 + Math.random() * 6; AWE.lines++;
  }
}
AWE.smiles = [];
// Jedes Bild für eine staunende Figur: zu Alexander drehen, Geste halten, Verbeugung, dann weiter wie vorher
export function aweStep(pd, dt) {
  const A = pd.aw, a = pd.a; if (!A) return;
  if (pd.rag || !a || !a.on) { aweEnd(pd); return; }
  A.t += dt;
  const p = player.p, want = Math.atan2(p.x - A.x, p.z - A.z);
  A.yaw += wrapA(want - A.yaw) * Math.min(1, dt * 4);
  let tilt = 0;
  if (A.bow) { const u = A.t; tilt = A.bow * (u < 0.5 ? u / 0.5 : u < 1.6 ? 1 : Math.max(0, 1 - (u - 1.6) / 0.7)); tilt = -0.38 * tilt; }   // negativ = nach vorn
  if (A.keep) { pd.yaw = A.yaw; pd.tilt = tilt; }
  else pedCrowd.set(a, A.x, A.y, A.z, A.yaw, pd.sc, tilt);
  if (A.t - A.lookT > 0.35) { A.lookT = A.t; turnHead(a, p.x, p.z); }
  if (A.t > A.dur) aweEnd(pd);
}
export function aweEnd(pd) {
  const A = pd.aw; if (!A) return;
  pd.aw = null; pd.awCool = 4; AWE.smiles.push(pd);   // das Lächeln verblasst erst nach der Abkühlzeit
  const a = pd.a;
  if (A.keep) { pd.yaw = A.yaw0; pd.tilt = 0; if (a) setAct(pd, A.act0); }
  else { if (pd.st === 9) pd.st = A.st0; if (a) { const g = a.gait; g[0] = A.g0; g[1] = A.act0; g[2] = A.g2; a.gv = (a.gv | 0) + 1; } }
  if (A.keep && a) { a.gait[0] = A.g0; a.gv = (a.gv | 0) + 1; }
}
// Zeiten: Lächeln der Zuschauer verblasst, Rufe und Abkühlzeiten laufen ab
export function updateAwe(dt) {
  AWE.sayT -= dt;
  for (let i = AWE.smiles.length - 1; i >= 0; i--) {
    const pd = AWE.smiles[i]; pd.awCool -= dt;
    if (pd.awCool > 0) continue;
    AWE.smiles.splice(i, 1);
    if (pd.ext) { const a = pd.a; if (a.sm0 != null) { a.live[3] = a.sm0; a.sm0 = null; a.gv = (a.gv | 0) + 1; } continue; }
    const a = pd.a; if (a && a.live && pd.sm0 != null && !pd.aw) { a.live[3] = pd.sm0; pd.sm0 = null; a.gv = (a.gv | 0) + 1; }
  }
}
