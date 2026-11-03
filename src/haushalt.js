/* =====================================================================
   V57 · VILLA UND PENTHOUSE LEBEN
   Randolf empfängt Alexander in der Halle, folgt ihm in gebührendem Abstand
   (auf seinem eigenen Weg durchs Haus, nie durch Wände), plaudert je Raum,
   bringt auf Zuruf einen Drink (E: Wünsche), hält Türen offen.
   Das Personal hat feste Abläufe: Zimmermädchen wischen Staub, machen Betten
   und stellen frische Blumen hin, Köche rühren und schneiden, Diener richten
   die Tafel, Gärtner fegen und schaufeln Schnee. Zwischendurch macht jeder
   Pause in der Gesindestube im Keller (dort sitzt dann jemand mehr am Tisch).
   Betritt Alexander einen Raum, verbeugen sich alle, treten zur Seite und
   verstummen; bei Telekinese staunen sie; was er umwirft, räumen sie eifrig
   wieder an seinen Platz.
   Bedienung: im Salon, am Pool und an der Bar im Herrenzimmer bringt Randolf
   auf dem Tablett, was man bestellt; im Penthouse der Concierge Konrad
   (Salon), der Barkeeper (Bar) und ein Kellner (Terrasse). Ein Pianist
   spielt am Flügel und macht zwischen den Stücken Pause.
   Alles aus vorhandenen Figuren und Handlungen: kein neuer Shader-Code.
   ===================================================================== */
import { T, scene, camera } from './core.js';
import { Crowd, turnHead, COL } from './serpentine.js';
import { VR, villaLocal, inVillaHouse, RANDOLF_SAYS, Y1, YK } from './villa.js';
import { VILLA } from './harbour.js';
import { PH, inPenthouse, onPentTerrace } from './penthouse.js';
import { player } from './player.js';
import { INTERACT } from './music.js';
import { DINE, MENU, sitDown, serveOrder, openChoice } from './venues.js';
import { LOOSE, spawnProp, pickUp, drop } from './physics.js';
import { lifeSay } from './life.js';
import { SND, sndClip } from './audio.js';
import { mergeColored, paintMat, addCollider } from './people-skeleton.js';
import { toast } from './boat.js';

export const HS = { v: [], p: [], R: null, K: null, crumbs: [], pc: null, venues: [], clock: 0, sayT: 0, inV: false, inP: false, room: null, outT: 0, follow: true, flowers: [], trays: [], tidyT: 0, tkT: 0 };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const WHITE = [0.9, 0.88, 0.82], MAID = [0.08, 0.08, 0.1];

/* ---------- Figuren: Gangart, Handlung, Lage ---------- */
function gaitW(ag, sp) { const g = ag.a.gait, c = sp * (ag.fem ? 5.4 : 4.6) / ag.sc, s = ag.fem ? 0.36 : 0.4; if (g[1] !== c || g[2] !== s) { g[1] = c; g[2] = s; ag.a.gv = (ag.a.gv | 0) + 1; } }
function actA(ag, v) { const g = ag.a.gait; if (g[1] !== v || g[2] !== 0) { g[1] = v; g[2] = 0; ag.a.gv = (ag.a.gv | 0) + 1; } }
function put(ag) { if (ag.hidden) { ag.a.on = false; return; } ag.C.set(ag.a, ag.x, ag.y - ag.yo, ag.z, ag.yaw, ag.sc, ag.tilt); }
function faceTo(ag, x, z, dt, k = 6) { ag.yaw += wrap(Math.atan2(x - ag.x, z - ag.z) - ag.yaw) * Math.min(1, dt * k); }
// Weg abgehen: Punkte [x, z, y?]; true, wenn angekommen
function walk(ag, dt) {
  let step = ag.sp * dt, want = null;
  while (step > 0 && ag.path.length) {
    const P = ag.path[0], dx = P[0] - ag.x, dz = P[1] - ag.z, d = Math.hypot(dx, dz);
    if (d > 0.02) want = Math.atan2(dx, dz);
    if (d <= step) { ag.x = P[0]; ag.z = P[1]; if (P[2] != null) ag.y = P[2]; ag.path.shift(); step -= d; }
    else { const k = step / d; ag.x += dx * k; ag.z += dz * k; if (P[2] != null) ag.y += (P[2] - ag.y) * k; step = 0; }
  }
  if (want != null) ag.yaw += wrap(want - ag.yaw) * Math.min(1, dt * 8);
  if (ag.path.length) { gaitW(ag, ag.sp); return false; }
  return true;
}
function mk(a, C, zone, o = {}) {
  const fem = a.kind === 'dress' || a.kind === 'gown';
  return { a, C, zone, fem, x: a.x, y: a.y, z: a.z, yaw: a.yaw, sc: 1, tilt: 0, yo: 0, path: [], sp: 1.15, st: 'work', t: rnd(0, 4), i: 0, int: null, hidden: false, cool: 0, brkT: rnd(70, 200), ...o };
}
// Tablett mit zwei Champagnerschalen (eine Geometrie für alle)
let trayGeo = null;
export function trayMesh() {
  if (!trayGeo) {
    const P = [[new T.CylinderGeometry(0.2, 0.19, 0.015, 20), [0.82, 0.82, 0.84]], [new T.TorusGeometry(0.2, 0.008, 4, 24).rotateX(Math.PI / 2).translate(0, 0.008, 0), [0.75, 0.56, 0.26]]];
    for (const dx of [-0.07, 0.07]) P.push([new T.CylinderGeometry(0.006, 0.03, 0.01, 8).translate(dx, 0.012, 0), [0.85, 0.9, 0.9]], [new T.CylinderGeometry(0.004, 0.004, 0.09, 6).translate(dx, 0.06, 0), [0.85, 0.9, 0.9]], [new T.CylinderGeometry(0.05, 0.012, 0.035, 12).translate(dx, 0.12, 0), [0.92, 0.82, 0.45]]);
    trayGeo = mergeColored(P);
  }
  const m = new T.Mesh(trayGeo, HS.mat || (HS.mat = paintMat({ color: 0xffffff, metalness: 0.4, roughness: 0.25, envI: 0.9, emissive: 0x0c0a06 })));
  m.visible = false; m.matrixAutoUpdate = true; scene.add(m); return m;
}
function trayAt(ag) {
  const m = ag.tray; if (!m) return;
  const on = ag.carry && !ag.hidden; m.visible = on; if (!on) return;
  const s = Math.sin(ag.yaw), c = Math.cos(ag.yaw);
  m.position.set(ag.x + s * 0.42, ag.y - ag.yo + 1.06, ag.z + c * 0.42); m.rotation.y = ag.yaw;
}

/* ---------- Abläufe der Villa (Hauskoordinaten: lx quer, lz zur Stadt; p Ort, f Blickpunkt, to = fegen bis, d Dauer, 0 = nur Durchgang) ----------
   Handlungen: 29 Staub wischen (Lappen), 24 fegen (Besen), 26 schaufeln, 4.3 rühren, 25.3 schneiden, 2.2 kosten, 13.3 mixen/polieren,
   12.3 etwas halten und richten, 8.3 beide Hände vorn (Bett, Tablett), 37 Blumen, 36 Portier, 1.3/0.9 dastehen/reden */
const J = {
  'halle-w': [{ p: [-11.2, -6.7], a: 29, d: 9, f: [-9.8, -6] }, { p: [-11.2, -11.4], a: 29, d: 9, f: [-9.8, -11] }, { p: [-12.6, -20.4], a: 24, d: 12, to: [-12.6, -15] }],
  'halle-o': [{ p: [11.2, -6.7], a: 29, d: 9, f: [9.8, -6] }, { p: [11.2, -11.4], a: 29, d: 9, f: [9.8, -11] }, { p: [12.6, -14.8], a: 24, d: 10, to: [12.6, -7.4] }],
  salon: [{ p: [-24.6, -6.8], a: 29, d: 9, f: [-25.5, -5.2] }, { p: [-19.4, -8.2] }, { p: [-19.4, -19.6] }, { p: [-22, -20.7], a: 29, d: 8, f: [-22, -23] }, { p: [-19.4, -19.6] }, { p: [-19.4, -8.2] }, { p: [-18.3, -5.9], a: 37, d: 3.5, f: [-17.2, -4.8], flw: 'salon' }],
  bar: [{ p: [18, -20.6], a: 29, d: 8, f: [18, -22.4] }, { p: [22, -20.6], a: 13.3, d: 6, f: [22, -17.6] }, { p: [26, -20.6], a: 29, d: 8, f: [26, -22.4] }, { p: [22, -20.6], a: 12.3, d: 5, f: [22, -17.6] }],
  koch: [{ p: [-42.6, -15.5], a: 4.3, d: 8, f: [-42.6, -17] }, { p: [-40, -15.5], a: 25.3, d: 7, f: [-40, -17] }, { p: [-39, -15.5], a: 2.2, d: 3, f: [-39, -17] }],
  'kueche-s': [{ p: [-47, -20.8], a: 25.3, d: 8, f: [-47, -21.8] }, { p: [-38, -20.8], a: 4.3, d: 7, f: [-38, -21.8] }, { p: [-33.4, -20.8], a: 29, d: 6, f: [-33.4, -21.9] }],
  'kueche-n': [{ p: [-45, -13], a: 25.3, d: 8, f: [-45, -11.9] }, { p: [-36, -13], a: 12.3, d: 6, f: [-36, -11.9], tilt: -0.1 }],
  buffet: [{ p: [52.4, -7.0], a: 29, d: 9, f: [53.5, -7] }, { p: [51.0, -9.6] }, { p: [52.4, -12.0], a: 12.3, d: 6, f: [53.4, -11.2] }, { p: [51.0, -9.6] }],
  tische: [{ p: [35.4, 2.9], a: 29, d: 7, f: [34, 4], tilt: -0.1 }, { p: [35.4, -17.9], a: 29, d: 7, f: [34, -19], tilt: -0.1 }, { p: [35.4, -16.6] }, { p: [49.6, -16.6] }, { p: [49.6, -17.9], a: 29, d: 7, f: [51, -19], tilt: -0.1 }, { p: [49.6, 2.9], a: 29, d: 7, f: [51, 4], tilt: -0.1 }],
  'tafel-w': [{ p: [-52, 4], a: 1.3, d: 5, f: [-43.0, 0] }, { p: [-44.6, 5.6] }, { p: [-44.6, 3.4], a: 12.3, d: 4, f: [-43.0, 3.4], tilt: -0.12 }, { p: [-44.6, 0.6], a: 12.3, d: 4, f: [-43.0, 0.6], tilt: -0.12 }, { p: [-44.6, -2.2], a: 12.3, d: 4, f: [-43.0, -2.2], tilt: -0.12 }, { p: [-44.6, -5.0], a: 12.3, d: 4, f: [-43.0, -5.0], tilt: -0.12 }, { p: [-44.6, -7.8], a: 12.3, d: 4, f: [-43.0, -7.8], tilt: -0.12 }, { p: [-44.6, -9.8] }, { p: [-44.6, 5.6] }],
  'tafel-o': [{ p: [-33, 4], a: 1.3, d: 5, f: [-41.4, 0] }, { p: [-39.8, 5.6] }, { p: [-39.8, 3.4], a: 12.3, d: 4, f: [-41.4, 3.4], tilt: -0.12 }, { p: [-39.8, 0.6], a: 12.3, d: 4, f: [-41.4, 0.6], tilt: -0.12 }, { p: [-39.8, -2.2], a: 12.3, d: 4, f: [-41.4, -2.2], tilt: -0.12 }, { p: [-39.8, -5.0], a: 12.3, d: 4, f: [-41.4, -5.0], tilt: -0.12 }, { p: [-39.8, -7.8], a: 12.3, d: 4, f: [-41.4, -7.8], tilt: -0.12 }, { p: [-39.8, -9.8] }, { p: [-39.8, 5.6] }],
  galerie: [{ p: [-8, -20.4], a: 29, d: 8, f: [-8, -22.4] }, { p: [-2, -20.6], a: 24, d: 10, to: [5, -20.6] }, { p: [8, -20.4], a: 29, d: 8, f: [8, -22.4] }],
  wintergarten: [{ p: [21, -6], a: 12.3, d: 7, f: [21.6, -7], tilt: -0.15 }, { p: [23.4, -6], a: 12.3, d: 7, f: [24, -7], tilt: -0.15 }],
  loggia: [{ p: [-21.5, 0.4], a: 24, d: 14, to: [-11.6, 0.4] }, { p: [-10, -0.9] }, { p: [-8.4, 0.5], a: 26, d: 10, to: [-3, 0.5] }, { p: [-10, -0.9] }],
  schlaf: [{ p: [-44.3, -5.2], a: 8.3, d: 7, f: [-42.2, -5.2], tilt: -0.32 }, { p: [-44.3, -2.7] }, { p: [-40.1, -2.7] }, { p: [-40.1, -5.2], a: 8.3, d: 7, f: [-42.2, -5.2], tilt: -0.32 }, { p: [-40.1, -2.7] }, { p: [-44.3, -2.7] }, { p: [-46, -3], a: 37, d: 3.5, f: [-47, -3.6] }],
  'kel-koch': [{ a: 4.3, d: 9, f: [-45, -22.4] }, { a: 25.3, d: 7, f: [-45, -22.4] }],
  'kel-1': [{ p: [-36.5, -18], a: 25.3, d: 8, f: [-38, -18] }, { p: [-36.5, -20.5], a: 12.3, d: 6, f: [-38, -20.5], tilt: -0.1 }],
  'kel-2': [{ p: [-39.4, -17.5], a: 29, d: 8, f: [-38, -17.5] }, { p: [-39.4, -20.5], a: 4.3, d: 7, f: [-38, -20.5] }],
  kamin: [{ a: 0.9, d: 8 }, { a: 1.3, d: 6 }],
  heizer: [{ a: 26, d: 14 }, { a: 1.3, d: 5 }],
  'bad-diener': [{ p: [33.4, -10], a: 12.3, d: 8, f: [35, -8] }, { p: [33.4, -4], a: 24, d: 10, to: [33.4, 0] }],
  'bad-maedchen': [{ p: [36, 1.6], a: 8.3, d: 5, f: [36, 3.2], tilt: -0.25 }, { p: [41.2, 1.6], a: 8.3, d: 5, f: [41.2, 3.2], tilt: -0.25 }, { p: [46.4, 1.6], a: 8.3, d: 5, f: [46.4, 3.2], tilt: -0.25 }],
  portier: [{ a: 36, d: 60 }],
  terrasse: [{ a: 36, d: 60 }],
  schnee: [{ p: [-26, 22], a: 24, d: 16, to: [-18, 22] }, { p: [-18, 23.5], a: 26, d: 10, to: [-25, 23.5] }],
};
// Pausen machen nur, die durch die Räume gehen (nicht die Köche im Keller, nicht die Portiers)
const NO_BREAK = { 'kel-koch': 1, 'kel-1': 1, 'kel-2': 1, kamin: 1, heizer: 1, portier: 1, terrasse: 1, randolf: 1, stuhl: 1 };
const Lw = (lx, lz) => [VILLA.x + lx * VR.cs + lz * VR.sn, VILLA.z - lx * VR.sn + lz * VR.cs];
const roomAt = (lx, ly, lz) => VR.rooms.find(q => lx > q.x0 && lx < q.x1 && lz > q.z0 && lz < q.z1 && ly > q.y - 0.4 && ly < q.y + 4.5) || null;
function stationsW(list, ag) {
  return list.map(s => ({ ...s, w: s.p ? Lw(...s.p) : [ag.x, ag.z], fw: s.f ? Lw(...s.f) : null, tw: s.to ? Lw(...s.to) : null }));
}

/* ---------- Aufbau der Villa (beim ersten Bild, wenn die Figuren der Villa stehen) ---------- */
function initVilla() {
  const C = VILLA.crowd; HS.vInit = true;
  for (const a of C.list) {
    if (!a.job) continue;
    const key = a.job.key, ag = mk(a, C, 'villa', { key });
    const l = villaLocal(ag); ag.room = roomAt(l.x, l.y, l.z);
    if (key === 'randolf') { HS.R = ag; ag.post = [ag.x, ag.z, ag.y, ag.yaw]; ag.st = 'post'; ag.tray = trayMesh(); ag.sp = 1.3; HS.v.push(ag); continue; }
    if (key === 'stuhl') { ag.sit = true; ag.yo = ag.fem ? 0.8 : 0.87; ag.y += a.job.sit + 0.04; ag.perm = a.job.perm; ag.st = 'sit'; ag.hidden = !ag.perm; ag.t = rnd(1, 6); HS.v.push(ag); continue; }
    const S = J[key]; if (!S) continue;
    ag.S = stationsW(S, ag); ag.brk = !NO_BREAK[key]; ag.i = 0;
    // erste Station sofort einnehmen (ohne Weg)
    const s = ag.S[0]; ag.x = s.w[0]; ag.z = s.w[1]; arrive(ag);
    HS.v.push(ag);
  }
  HS.slots = HS.v.filter(g => g.st === 'sit');
  for (const g of HS.slots) { g.act = 7.9; actA(g, 7.9); }
  // frische Blumen: im Salon (Bistrotisch) und im Schlafzimmer (Kommode am Kamin)
  flowerSpot('salon', ...Lw(-17.25, -4.7), VR.by + 0.74, false);
  // Feuerstellen für das Knistern (Salon, Arbeitszimmer, Schlafzimmer, Gesindestube)
  HS.fires = [[-22, -21.3, 0], [-18.6, -11, Y1], [-53.4, -1, Y1], [-53.9, -3.2, YK]].map(([lx, lz, y]) => [...Lw(lx, lz), VR.by + y]);
  // Sitzplätze mit Bedienung (Randolf bringt es)
  villaSeats();
}
// zur nächsten Station gehen oder dort arbeiten
function arrive(ag) {
  const s = ag.S[ag.i];
  if (!s.d) { nextStation(ag); return; }
  ag.st = 'work'; ag.t = s.d * rnd(0.8, 1.25); ag.tilt0 = s.tilt || 0; actA(ag, s.a);
  if (s.tw) { ag.sw = 0; ag.swDir = 1; }
}
function nextStation(ag) {
  const s0 = ag.S[ag.i];
  if (s0.flw) freshFlowers(s0.flw);
  ag.i = (ag.i + 1) % ag.S.length; const s = ag.S[ag.i];
  ag.tilt0 = 0;
  if (Math.hypot(s.w[0] - ag.x, s.w[1] - ag.z) < 0.05) { arrive(ag); return; }
  ag.path = [[s.w[0], s.w[1]]]; ag.st = 'walk'; ag.sp = 1.1;
}
function routine(ag, dt) {
  if (ag.st === 'walk') { if (walk(ag, dt)) arrive(ag); ag.tilt += (0 - ag.tilt) * Math.min(1, dt * 4); return; }
  if (ag.st !== 'work') return;
  const s = ag.S[ag.i];
  ag.tilt += (ag.tilt0 - ag.tilt) * Math.min(1, dt * 3);
  if (s.tw) {
    // fegen oder schaufeln: langsam die Strecke entlang und zurück
    const [x0, z0] = s.w, [x1, z1] = s.tw, L = Math.hypot(x1 - x0, z1 - z0) || 1;
    ag.sw = Math.max(0, Math.min(1, ag.sw + ag.swDir * dt * 0.32 / L)); if (ag.sw >= 1 || ag.sw <= 0) ag.swDir *= -1;
    ag.x = x0 + (x1 - x0) * ag.sw; ag.z = z0 + (z1 - z0) * ag.sw;
    ag.yaw += wrap(Math.atan2((x1 - x0) * ag.swDir, (z1 - z0) * ag.swDir) - ag.yaw) * Math.min(1, dt * 2);
  } else if (s.fw) faceTo(ag, s.fw[0], s.fw[1], dt, 4);
  if ((ag.t -= dt) <= 0) nextStation(ag);
}

/* ---------- Frische Blumen: ein Strauß in einer Vase erscheint, der alte verschwindet ---------- */
let flowerGeo = null;
function flowerSpot(name, x, z, y, pent) {
  if (!flowerGeo) {
    const mk1 = rose => { const P = [[new T.CylinderGeometry(0.07, 0.05, 0.22, 12).translate(0, 0.11, 0), [0.85, 0.88, 0.9]], [new T.TorusGeometry(0.07, 0.008, 4, 16).rotateX(Math.PI / 2).translate(0, 0.22, 0), [0.75, 0.56, 0.26]]];
      for (let k = 0; k < 9; k++) { const a = k * 2.4, r = k ? 0.06 + (k % 3) * 0.02 : 0, h = 0.36 + (k % 2) * 0.05; P.push([new T.CylinderGeometry(0.004, 0.004, h - 0.2, 4).translate(Math.cos(a) * r * 0.5, 0.2 + (h - 0.2) / 2, Math.sin(a) * r * 0.5), [0.15, 0.32, 0.12]], [new T.SphereGeometry(0.035, 7, 5).translate(Math.cos(a) * r, h, Math.sin(a) * r), k % 4 === 3 ? [0.95, 0.93, 0.88] : rose]); }
      for (let k = 0; k < 5; k++) { const a = k * 1.26; P.push([new T.SphereGeometry(0.04, 5, 4).scale(1, 0.3, 0.6).translate(Math.cos(a) * 0.08, 0.27, Math.sin(a) * 0.08), [0.12, 0.3, 0.1]]); }
      return mergeColored(P); };
    flowerGeo = [mk1([0.62, 0.05, 0.08]), mk1([0.95, 0.86, 0.6])];
  }
  const mat = HS.mat || (HS.mat = paintMat({ color: 0xffffff, metalness: 0.4, roughness: 0.25, envI: 0.9, emissive: 0x0c0a06 }));
  const ms = flowerGeo.map((g, i) => { const m = new T.Mesh(g, mat); m.position.set(x, y, z); m.visible = i === 0; scene.add(m); return m; });
  HS.flowers.push({ name, ms, k: 0, grow: 1, pent });
}
function freshFlowers(name) {
  const F = HS.flowers.find(f => f.name === name); if (!F) return;
  F.ms[F.k].visible = false; F.k = 1 - F.k; F.ms[F.k].visible = true; F.grow = 0;
}
function growFlowers(dt) { for (const F of HS.flowers) if (F.grow < 1) { F.grow = Math.min(1, F.grow + dt * 0.9); const s = 0.3 + 0.7 * F.grow; F.ms[F.k].scale.set(s, s, s); } }

/* ---------- Randolf ---------- */
const R_GREET = ['Guten Abend, Sir. Willkommen zu Hause.', 'Willkommen zurück, Sir. Darf ich Ihnen den Mantel abnehmen?', 'Sir. Das Haus ist bereit, der Kamin im Salon brennt.', 'Guten Abend, Sir. Ganz Vespera spricht von Ihnen, wenn ich das sagen darf.'];
const R_ROOM = {
  Salon: ['Der Kamin brennt, Sir. Das Grammophon spielt Ihre Lieblingsplatte.', 'Nehmen Sie Platz, Sir. Ich bringe Ihnen gern etwas.'],
  Herrenzimmer: ['Der zwanzigjährige Whisky ist eingetroffen, Sir.', 'Eine Partie Billard, Sir? Ich habe die Kugeln poliert.'],
  Speisesaal: ['Die Tafel ist für Sie gedeckt, Sir. Wie jeden Abend.', 'Der Koch empfiehlt heute Hummer, Sir.'],
  Küche: ['Verzeihen Sie die Hitze, Sir. Die Küche ist ganz Ihre.', 'Der Koch fragt, ob Sie Wünsche für morgen haben, Sir.'],
  Ballsaal: ['Spiegelblank, Sir. Bereit für den nächsten Ball, wann immer Sie es wünschen.'],
  Galerie: ['Von hier oben sieht man die ganze Halle, Sir.'],
  Arbeitszimmer: ['Ihre Post liegt auf dem Schreibtisch, Sir. Nichts, was nicht warten könnte.'],
  Bibliothek: ['Ich habe die Erstausgaben abstauben lassen, Sir.'],
  Wintergarten: ['Der Gärtner sagt, die Orchideen blühen bald, Sir. Trotz der Polarnacht.'],
  Schlafzimmer: ['Ihr Bett ist frisch bezogen, Sir. Seide, wie Sie es mögen.'],
  Badezimmer: ['Ihr Bad ist eingelassen, Sir.'],
  Ankleidezimmer: ['Der Smoking ist gebürstet, die Fliege gebunden, Sir.'],
  Schwimmhalle: ['Das Wasser hat genau achtundzwanzig Grad, Sir.', 'Soll ich Ihnen ein Glas an den Pool bringen, Sir?'],
  Tresorraum: ['Das Gold ist vollzählig, Sir. Ich habe es selbst nachgezählt.'],
  Weinkeller: ['Der 1911er Champagner, Sir. Ein Jahrgang wie dieser Abend.'],
  Gesindestube: ['Haltung, bitte! Der Herr ist im Raum.'],
  'Randolfs Zimmer': ['Oh. Mein bescheidenes Zimmer, Sir. Verzeihen Sie die Unordnung.'],
};
const R_BYE = ['Gute Nacht, Sir. Ich halte das Haus warm.', 'Gute Fahrt, Sir.', 'Kommen Sie gut zurück, Sir.'];
const R_TK = ['Beeindruckend wie immer, Sir.', 'Sehr wohl, Sir. Ich halte Abstand.', 'Ich hole schon einmal den Besen, Sir.'];
function rSay(s, d = 4) { if (lifeSay('Randolf', s, d)) { HS.sayT = 6; return true; } return false; }
const pick = L => L[Math.floor(Math.random() * L.length)];
// Brotkrumen: der Weg, den Alexander durchs Haus gegangen ist (Randolf folgt ihm darauf, nie quer durch Wände)
function crumbs() {
  const p = player.p, C = HS.crumbs;
  if (!HS.inV || player.fly || DINE.seat || !player.onGround) return;
  const l = C[C.length - 1];
  if (!l || (p.x - l[0]) ** 2 + (p.z - l[1]) ** 2 > 0.25 || Math.abs(p.y - l[2]) > 0.4) { C.push([p.x, p.z, p.y]); if (C.length > 400) { C.shift(); if (HS.R) HS.R.ci = Math.max(0, (HS.R.ci | 0) - 1); } }
}
function rFollowFrom(R) {
  // nächste Krume zu Randolf (auf seiner Höhe), von dort weiter
  const C = HS.crumbs; let bi = -1, bd = 1e9;
  for (let i = 0; i < C.length; i++) { const d = (C[i][0] - R.x) ** 2 + (C[i][1] - R.z) ** 2 + 4 * (C[i][2] - R.y) ** 2; if (d < bd) { bd = d; bi = i; } }
  R.ci = Math.max(0, bi); R.st = 'follow';
}
const inView = (x, y, z) => { const c = camera.position, dx = x - c.x, dy = y + 1 - c.y, dz = z - c.z, d = Math.hypot(dx, dy, dz); if (d > 40) return false; const f = new T.Vector3(); camera.getWorldDirection(f); return (dx * f.x + dy * f.y + dz * f.z) / d > 0.55; };
function randolf(dt) {
  const R = HS.R; if (!R || R.int) return;
  const p = player.p, C = HS.crumbs;
  if (R.st === 'serve') return;
  if (R.st === 'post' || R.st === 'wait') {
    actA(R, 36.05);
    if (R.st === 'post') { faceTo(R, R.x + Math.sin(R.post[3]), R.z + Math.cos(R.post[3]), dt, 2); if (HS.inV && HS.follow && C.length > 2 && Math.hypot(p.x - R.x, p.z - R.z) > 3.5) rFollowFrom(R); }
    else faceTo(R, p.x, p.z, dt, 3);
    return;
  }
  if (R.st === 'home') {
    // zurück auf den Posten, sobald niemand hinsieht
    if (!inView(R.x, R.y, R.z) || Math.hypot(p.x - R.x, p.z - R.z) > 30) { [R.x, R.z, R.y] = R.post; R.yaw = R.post[3]; R.st = 'post'; R.path = []; }
    else { actA(R, 36.05); faceTo(R, p.x, p.z, dt, 3); }
    return;
  }
  // folgen
  if (!HS.inV) {
    if ((HS.outT += dt) > 2.5) { R.st = 'home'; if (Math.hypot(p.x - R.x, p.z - R.z) < 20 && HS.sayT <= 0) rSay(pick(R_BYE)); }
    actA(R, 36.05); return;
  }
  HS.outT = 0;
  let ci = Math.min(R.ci | 0, C.length - 1); if (ci < 0) { actA(R, 36.05); return; }
  // Wegrest bis zu Alexander
  let rest = Math.hypot(C[ci][0] - R.x, C[ci][1] - R.z);
  for (let i = ci; i < C.length - 1 && rest < 9; i++) rest += Math.hypot(C[i + 1][0] - C[i][0], C[i + 1][1] - C[i][1]);
  rest += Math.hypot(p.x - C[C.length - 1][0], p.z - C[C.length - 1][1]);
  const gap = Math.hypot(C[ci][0] - R.x, C[ci][1] - R.z) + Math.abs(C[ci][2] - R.y) * 2;
  if (gap > 4 && !inView(R.x, R.y, R.z) && !inView(C[ci][0], C[ci][2], C[ci][1])) { R.x = C[ci][0]; R.z = C[ci][1]; R.y = C[ci][2]; }   // Alexander ist geflogen oder durch eine Lücke: Randolf holt ungesehen auf
  if (rest > 2.9) {
    R.sp = rest > 8 ? 2.5 : rest > 4.5 ? 1.7 : 1.25;
    let step = R.sp * dt, want = null;
    while (step > 0 && ci < C.length) {
      const P = C[ci], dx = P[0] - R.x, dz = P[1] - R.z, d = Math.hypot(dx, dz);
      if (d > 0.02) want = Math.atan2(dx, dz);
      if (d <= step) { R.x = P[0]; R.z = P[1]; R.y = P[2]; step -= d; ci++; } else { const k = step / d; R.x += dx * k; R.z += dz * k; R.y += (P[2] - R.y) * k; step = 0; }
      if (rest - (R.sp * dt - step) < 2.6) break;
    }
    R.ci = Math.min(ci, C.length - 1);
    if (want != null) R.yaw += wrap(want - R.yaw) * Math.min(1, dt * 7);
    gaitW(R, R.sp);
  } else { actA(R, 36.05); faceTo(R, p.x, p.z, dt, 3); }
}
// E bei Randolf: Wünsche
function randolfMenu() {
  const R = HS.R; if (!R) return;
  const f = HS.follow;
  openChoice('Randolf · Ihr Butler', ['Ein Glas Champagner, bitte', 'Einen Whisky, bitte', f ? 'Warten Sie hier, Randolf' : 'Folgen Sie mir, Randolf', VR.doorsOpen ? 'Die Türen schließen' : 'Die Türen öffnen', 'Wie steht es im Haus?', 'Danke, das ist alles'], i => {
    if (i === 0 || i === 1) { rSay('Sehr wohl, Sir. Einen Augenblick.'); handDrink(i === 0 ? 'coupe' : 'tumbler'); }
    else if (i === 2) { HS.follow = !f; if (HS.follow) { rSay('Sehr wohl, Sir. Ich bin direkt hinter Ihnen.'); rFollowFrom(R); } else { rSay('Ich warte hier, Sir. Sie müssen nur rufen.'); R.st = 'wait'; } }
    else if (i === 3) {
      VR.doorsOpen = !VR.doorsOpen;
      for (const d of VR.doors) { if (d.fixed0 === undefined) d.fixed0 = !!d.fixed; d.fixed = d.fixed0 || VR.doorsOpen; }
      rSay(VR.doorsOpen ? 'Ich lasse alle Türen öffnen, Sir.' : 'Die Türen werden geschlossen, Sir. Es zieht sonst.');
      startInt(R, { act: 36.3, dur: 3, face: nearestDoor(R) });
    }
    else if (i === 4) { VR.said = (VR.said + 1) % RANDOLF_SAYS.length; rSay(RANDOLF_SAYS[VR.said], 5); }
    else rSay('Sehr wohl, Sir.');
  });
}
function nearestDoor(ag) {
  let best = null, bd = 1e9;
  for (const d of VR.doors) { const [x, z] = Lw(d.lx, d.lz), dd = (x - ag.x) ** 2 + (z - ag.z) ** 2; if (dd < bd && Math.abs(VR.by + d.y - ag.y) < 2) { bd = dd; best = [x, z]; } }
  return best;
}
// Drink im Stehen: Randolf holt ihn (durch die nächste Tür), kommt mit dem Tablett zurück und reicht das Glas
function handDrink(kind) {
  const R = HS.R, door = nearestDoor(R) || [R.x, R.z];
  R.serve = { ph: 'go', kind, door, stand: null };
  R.st = 'serve'; R.path = [[door[0], door[1]]]; R.sp = 1.4;
}
function serveStep(ag, dt) {
  const S = ag.serve; if (!S) return false;
  const p = player.p;
  if (S.ph === 'go') { if (walk(ag, dt)) { S.ph = S.mix ? 'mix' : 'away'; S.t = S.mix ? 3.2 : 4.5; if (!S.mix) ag.hidden = true; } return true; }
  if (S.ph === 'away' || S.ph === 'mix') {
    if (S.mix) { actA(ag, 13.3); if (S.mixF) faceTo(ag, S.mixF[0], S.mixF[1], dt, 4); }
    if ((S.t -= dt) > 0) return true;
    ag.hidden = false; ag.carry = true; sndClip('glass', 0.25);
    S.ph = 'back';
    // zurück: zum Platz des Bestellenden oder zu Alexander (im Stehen)
    ag.path = S.back ? S.back.map(q => q.slice()) : [[p.x + (ag.x - p.x) * 0.0, p.z]];
    if (!S.back) S.follow = true;
    ag.sp = 1.7; return true;
  }
  if (S.ph === 'back') {
    if (S.follow) { const d = Math.hypot(p.x - ag.x, p.z - ag.z); if (d > 1.15) { ag.path = [[p.x - (p.x - ag.x) / d * 1.05, p.z - (p.z - ag.z) / d * 1.05]]; walk(ag, dt); if (Math.abs(p.y - ag.y) > 3 && !inView(ag.x, ag.y, ag.z)) { ag.x = p.x - Math.sin(player.yaw) * 1.2; ag.z = p.z - Math.cos(player.yaw) * 1.2; ag.y = p.y; } return true; } }
    else if (!walk(ag, dt)) return true;
    S.ph = 'offer'; S.t = 1.4; actA(ag, 8.3); return true;
  }
  if (S.ph === 'offer') {
    if (S.seat) faceTo(ag, S.seat.x, S.seat.z, dt, 5); else faceTo(ag, p.x, p.z, dt, 5);
    ag.tilt = -0.12;
    if ((S.t -= dt) > 0) return true;
    ag.carry = false; ag.tilt = 0;
    if (S.seat) { if (DINE.seat === S.seat && DINE.order && !DINE.item) { serveOrder(); sndClip('glass', 0.35); lifeSay(S.who || 'Randolf', pick(S.lines || ['Bitte sehr, Sir.', 'Wohl bekomm’s, Sir.', 'Zum Wohl, Sir.']), 3); } }
    else {
      const B = spawnProp(S.kind, ag.x + Math.sin(ag.yaw) * 0.5, ag.y + 1.0, ag.z + Math.cos(ag.yaw) * 0.5, ag.yaw);
      if (B) { if (LOOSE.held) drop(false); pickUp(B); }
      lifeSay(S.who || 'Randolf', S.kind === 'coupe' ? 'Ihr Champagner, Sir. Der 1911er.' : 'Ihr Whisky, Sir. Zwanzig Jahre alt, ohne Eis.', 3.5); sndClip('glass', 0.35);
    }
    S.ph = 'ret'; S.t = 0; ag.path = S.home ? S.home.map(q => q.slice()) : [];
    return true;
  }
  if (S.ph === 'ret') {
    if (!walk(ag, dt)) return true;
    ag.serve = null;
    if (ag === HS.R) { if (HS.follow && HS.inV) rFollowFrom(ag); else ag.st = HS.inV ? 'wait' : 'home'; }
    else if (ag.S) { ag.st = 'walk'; const s = ag.S[ag.i]; ag.path = [[s.w[0], s.w[1]]]; }
    else ag.st = 'post';
    return false;
  }
  return false;
}

/* ---------- Reaktionen: verbeugen, Platz machen, verstummen, staunen ---------- */
function startInt(ag, o) {
  if (ag.sit) { ag.int = { t: 0, dur: o.dur, act: o.sitAct ?? 7.0, face: o.face, bow: o.bow ? 0.12 : 0, sit: true }; actA(ag, ag.int.act); if (o.face) turnHead(ag.a, o.face[0], o.face[1]); return; }
  ag.int = { t: 0, dur: o.dur, act: o.act ?? 1.3, face: o.face, bow: o.bow || 0, sx: o.sx || 0, sz: o.sz || 0, x0: ag.x, z0: ag.z };
  actA(ag, ag.int.act);
}
function intStep(ag, dt) {
  const I = ag.int; I.t += dt;
  const ease = Math.min(1, I.t / 0.5) * Math.min(1, Math.max(0, (I.dur - I.t) / 0.6));
  if (I.face) faceTo(ag, I.face[0], I.face[1], dt, 5);
  if (I.sit) { ag.tilt = -I.bow * ease; }
  else {
    const u = I.t, b = I.bow * (u < 0.5 ? u / 0.5 : u < 1.5 ? 1 : Math.max(0, 1 - (u - 1.5) / 0.6));
    ag.tilt = -0.36 * b;
    if (I.sx || I.sz) { const k = Math.min(1, I.t / 0.6); ag.x = I.x0 + I.sx * k; ag.z = I.z0 + I.sz * k; }
  }
  if (I.t >= I.dur) {
    ag.int = null; ag.tilt = 0;
    if (ag.sit) actA(ag, ag.act || 7.9);
    else if (ag.st === 'work' && ag.S) actA(ag, ag.S[ag.i].a);
    else if (ag.st === 'walk' && ag.S) { const s = ag.S[ag.i]; ag.path = [[s.w[0], s.w[1]]]; }
    else if (ag.st === 'tidy' && ag.td) { /* weiter aufräumen */ }
  }
}
// Alexander betritt einen Raum: alle im Raum verbeugen sich (Damen knicksen), wer im Weg steht, tritt zur Seite; die Pause verstummt
function enterRoom(list, inRoom) {
  const p = player.p;
  for (const ag of list) {
    if (ag.hidden || ag.int || ag.serve || ag === HS.R || (ag.bowT || 0) > HS.clock || !inRoom(ag)) continue;
    ag.bowT = HS.clock + 25;
    const d = Math.hypot(ag.x - p.x, ag.z - p.z);
    if (ag.sit) { startInt(ag, { dur: rnd(6, 9), face: [p.x, p.z], bow: true, sitAct: 7.0 }); continue; }
    let sx = 0, sz = 0; if (d < 2.4) { sx = (ag.x - p.x) / (d || 1) * 0.7; sz = (ag.z - p.z) / (d || 1) * 0.7; }
    startInt(ag, { act: ag.fem ? 1.3 : 1.3, dur: rnd(2.6, 3.6), face: [p.x, p.z], bow: ag.fem ? 0.55 : 0.85, sx, sz });
    ag.int.t = -Math.random() * 0.5;
    ag.cool = 20;
  }
}
// unterwegs im Weg: zur Seite treten und kurz verneigen
function nearPlayer(list) {
  const p = player.p;
  for (const ag of list) {
    if (ag.hidden || ag.int || ag.serve || ag.sit || ag === HS.R || ag.cool > 0) continue;
    const dx = ag.x - p.x, dz = ag.z - p.z, d = Math.hypot(dx, dz);
    if (d > 1.8 || Math.abs(ag.y - ag.yo - p.y) > 1.6) continue;
    startInt(ag, { act: 1.3, dur: 2.2, face: [p.x, p.z], bow: 0.4, sx: dx / (d || 1) * 0.8, sz: dz / (d || 1) * 0.8 });
    ag.cool = 15;
  }
}
// Telekinese: staunen (Arme hoch) und hinschauen
function tkAwe(list) {
  const B = LOOSE.tk; if (!B || HS.tkT > 0) return; HS.tkT = 1.0;
  let any = null;
  for (const ag of list) {
    if (ag.hidden || ag.int || ag.serve || (ag.tkCool || 0) > HS.clock) continue;
    if (Math.hypot(ag.x - B.x.x, ag.z - B.x.z) > 18 || Math.abs(ag.y - B.x.y) > 6) continue;
    ag.tkCool = HS.clock + 14;
    if (ag.sit) { startInt(ag, { dur: 3.5, face: [B.x.x, B.x.z], sitAct: 7.0 }); turnHead(ag.a, B.x.x, B.x.z); continue; }
    startInt(ag, { act: Math.random() < 0.6 ? 8.2 : 13.2, dur: rnd(3, 4.5), face: [B.x.x, B.x.z] });
    if (!any || Math.random() < 0.3) any = ag;
  }
  if (any && HS.sayT <= 0) { if (any === HS.R) rSay(pick(R_TK)); else if (lifeSay(any.fem ? 'Ein Zimmermädchen' : 'Ein Diener', pick(['Oh! Herr Alexander …', 'Gütiger Himmel!', 'Wie macht er das nur?', 'Ich sehe nichts, ich sehe nichts …']), 3)) HS.sayT = 7; }
}

/* ---------- Aufräumen: was Alexander umgeworfen oder verschoben hat, kommt an seinen Platz zurück ---------- */
const _q = new T.Quaternion(), _up = new T.Vector3(0, 1, 0);
function tidyScan(list, inArea, sameArea) {
  const now = HS.clock;
  for (const B of LOOSE.bodies) {
    if (B.held || LOOSE.tk === B || B.tidyBy) continue;
    if (!B.home) { if (!inArea(B.x.x, B.x.y, B.x.z) || B.v.lengthSq() > 0.01) continue; B.home = { x: B.furn && B.x0 ? B.x0.clone() : B.x.clone(), q: B.furn ? new T.Quaternion() : B.q.clone() }; continue; }
    if (B.awake || !inArea(B.x.x, B.x.y, B.x.z)) { B.tidyAt = 0; continue; }
    const off = B.x.distanceTo(B.home.x) > 0.3 || B.q.angleTo(B.home.q) > 0.45;
    if (!off) { B.tidyAt = 0; continue; }
    if (!B.tidyAt) { B.tidyAt = now + rnd(2, 4.5); continue; }
    if (now < B.tidyAt) continue;
    // wer ist frei und in der Nähe (gleicher Raum, gleiche Ebene)?
    let best = null, bd = 22 * 22;
    for (const ag of list) {
      if (ag.hidden || ag.int || ag.serve || ag.sit || ag.td || ag.onBreak) continue;
      if (ag === HS.R && ag.st !== 'follow' && ag.st !== 'wait') continue;
      const d = (ag.x - B.x.x) ** 2 + (ag.z - B.x.z) ** 2;
      if (d < bd && Math.abs(ag.y - ag.yo - B.x.y) < 2.2 && sameArea(ag, B)) { bd = d; best = ag; }
    }
    if (!best) { B.tidyAt = now + 3; continue; }
    B.tidyBy = best; best.td = { B, ph: 'go', st0: best.st };
    const dx = best.x - B.x.x, dz = best.z - B.x.z, d = Math.hypot(dx, dz) || 1, r = Math.min(1.2, B.r) + 0.35;
    best.path = [[B.x.x + dx / d * r, B.x.z + dz / d * r]]; best.st = 'tidy'; best.sp = 1.5;
    if (HS.sayT <= 0 && Math.random() < 0.5) { const L = ['Sofort, Sir!', 'Ich räume das gleich auf, Sir.', 'Keine Sorge, Sir, das mache ich.', 'Das haben wir gleich wieder.']; if (best === HS.R ? rSay(pick(L)) : lifeSay(best.fem ? 'Ein Zimmermädchen' : 'Ein Diener', pick(L), 2.5)) HS.sayT = 6; }
    return;
  }
}
function tidyStep(ag, dt) {
  const T_ = ag.td, B = T_.B;
  if (B.held || LOOSE.tk === B || !LOOSE.bodies.includes(B)) { endTidy(ag); return; }
  const big = !!B.furn || B.m > 20;
  if (T_.ph === 'go') { if (walk(ag, dt)) { T_.ph = 'pick'; T_.t = 1.1; actA(ag, 8.3); } return; }
  faceTo(ag, T_.ph === 'carry' ? (T_.dest[0]) : B.x.x, T_.ph === 'carry' ? T_.dest[1] : B.x.z, dt, 5);
  if (T_.ph === 'pick') {
    ag.tilt += (-0.42 - ag.tilt) * Math.min(1, dt * 5);
    if ((T_.t -= dt) > 0) return;
    // tragen (kleine Dinge in den Händen) oder schieben (Möbel)
    const H = B.home.x, dx = ag.x - H.x, dz = ag.z - H.z, d = Math.hypot(dx, dz) || 1, r = big ? B.r * 0.6 + 0.5 : 0.5;
    T_.dest = [H.x + dx / d * r, H.z + dz / d * r]; ag.path = [[T_.dest[0], T_.dest[1]]]; ag.sp = big ? 0.8 : 1.2; T_.ph = 'carry'; T_.q0 = B.q.clone(); T_.k = 0;
    if (!big) actA(ag, 8.3);
    sndClip(B.snd === 'glass' ? 'glass' : 'thud', 0.15);
    return;
  }
  if (T_.ph === 'carry') {
    ag.tilt += (0 - ag.tilt) * Math.min(1, dt * 4);
    const done = walk(ag, dt); if (!big) actA(ag, 8.3);
    T_.k = Math.min(1, T_.k + dt * 0.8);
    const s = Math.sin(ag.yaw), c = Math.cos(ag.yaw), H = B.home;
    if (big) { const r = B.r * 0.6 + 0.5; B.x.set(ag.x + s * r, H.x.y, ag.z + c * r); }
    else B.x.set(ag.x + s * 0.45, ag.y - ag.yo + 1.0, ag.z + c * 0.45);
    B.q.copy(T_.q0).slerp(H.q, T_.k); B.v.set(0, 0, 0); B.w.set(0, 0, 0); B.awake = false;
    if (done) { T_.ph = 'place'; T_.t = 0; T_.p0 = B.x.clone(); T_.q1 = B.q.clone(); actA(ag, 8.3); }
    return;
  }
  if (T_.ph === 'place') {
    T_.t = Math.min(1, T_.t + dt * 1.6);
    ag.tilt = -0.3 * Math.sin(T_.t * Math.PI);
    B.x.copy(T_.p0).lerp(B.home.x, T_.t); B.q.copy(T_.q1).slerp(B.home.q, T_.t); B.v.set(0, 0, 0); B.w.set(0, 0, 0); B.awake = false;
    if (T_.t >= 1) { B.still = 1; endTidy(ag); }
  }
}
function endTidy(ag) {
  const T_ = ag.td; if (T_ && T_.B) { T_.B.tidyBy = null; T_.B.tidyAt = 0; }
  ag.td = null; ag.tilt = 0;
  if (ag === HS.R) { if (HS.follow && HS.inV) rFollowFrom(ag); else ag.st = 'wait'; return; }
  if (ag.S) { ag.st = 'walk'; const s = ag.S[ag.i]; ag.path = [[s.w[0], s.w[1]]]; }
  else { ag.st = 'post'; ag.path = ag.postPath ? [ag.postPath] : []; }
}

/* ---------- Pause im Keller: unsichtbar im Raum, sichtbar am Tisch der Gesindestube ---------- */
function breaks(dt) {
  for (const ag of HS.v) {
    if (!ag.brk) continue;
    if (ag.onBreak) {
      if ((ag.onBreak.t -= dt) > 0 || (HS.room && HS.room === ag.room)) continue;
      const sl = ag.onBreak.slot; if (HS.room && HS.room.name === 'Gesindestube') continue;   // nicht vor Alexanders Augen vom Tisch verschwinden
      sl.hidden = true; sl.busy = null; ag.hidden = false; ag.onBreak = null; ag.brkT = rnd(120, 260);
      continue;
    }
    if (ag.int || ag.serve || ag.td || (ag.brkT -= dt) > 0 || (HS.room && HS.room === ag.room) || inView(ag.x, ag.y, ag.z)) continue;
    const sl = HS.slots.find(s => !s.perm && !s.busy && s.hidden && s.a.kind === ag.a.kind);
    if (!sl || (HS.room && HS.room.name === 'Gesindestube')) { ag.brkT = rnd(30, 60); continue; }
    sl.busy = ag; sl.hidden = false; sl.act = Math.random() < 0.5 ? 10.2 : 7.9; actA(sl, sl.act);
    ag.hidden = true; ag.onBreak = { slot: sl, t: rnd(45, 110) };
  }
}
// Gespräche am Tisch: reden, trinken (Tee), lachen; still, solange Alexander im Raum ist
function slotTalk(dt) {
  const here = HS.room && HS.room.name === 'Gesindestube';
  for (const s of HS.slots) {
    if (s.hidden || s.int) continue;
    if (here) { if (s.act !== 7.0) { s.act = 7.0; actA(s, 7.0); } continue; }
    if ((s.t -= dt) > 0) continue;
    s.t = rnd(4, 10); const r = Math.random(); s.act = r < 0.45 ? 7.9 : r < 0.75 ? 10.2 : r < 0.85 ? 7.3 : 7.2; actA(s, s.act);
  }
}

/* ---------- Plätze mit Bedienung ---------- */
function seat(V, x, y, z, yaw, tx, ty, tz, up, stand) { const s = { x, y, z, yaw, tx, ty, tz, up, stand, V }; V.seats.push(s); return s; }
function villaSeats() {
  const by = VR.by, ry = Math.atan2(VR.sn, VR.cs);
  const mkV = (name, door, y) => { const V = { priv: true, kind: 'villa', name, seats: [], door: Lw(...door), F: by + y }; HS.venues.push(V); return V; };
  const S = (V, lx, ly, lz, lyaw, tlx, tly, tlz, ulx, ulz) => { const [x, z] = Lw(lx, lz), [tx, tz] = Lw(tlx, tlz), [ux, uz] = Lw(ulx, ulz); seat(V, x, by + ly, z, lyaw + ry, tx, by + tly, tz, [ux, V.F, uz], [ux, uz]); };
  // Salon: drei Sofas um den Couchtisch
  const sal = mkV('Salon', [-15.3, -17], 0);
  for (const dz of [-1.1, 0, 1.1]) { S(sal, -26.95, 0.56, -12 + dz, Math.PI / 2, -22.75, 0.47, -12 + dz * 0.5, -25.7, -12 + dz); S(sal, -17.05, 0.56, -12 + dz, -Math.PI / 2, -21.25, 0.47, -12 + dz * 0.5, -18.3, -12 + dz); S(sal, -22 + dz, 0.56, -16.95, 0, -22 + dz * 0.5, 0.47, -12.75, -22 + dz, -15.7); }
  // Herrenzimmer: Barhocker am Tresen
  const her = mkV('Herrenzimmer', [15.3, -11], 0);
  for (let k = 0; k < 7; k++) { const lx = 16.6 + k * 1.75; S(her, lx, 0.89, -16.55, Math.PI, lx, 1.235, -17.45, lx, -15.4); }
  // Schwimmhalle: Liegen am Becken, Getränke auf den Beistelltischen
  const pool = mkV('Schwimmhalle', [31, -14.5], YK);
  for (let k = 0; k < 6; k++) { const lx = 36 + k * 2.6, tl = [37.3, 37.3, 42.5, 42.5, 47.7, 47.7][k]; S(pool, lx, YK + 0.5, 3.0, Math.PI, tl, YK + 0.51, 3.2, lx, 1.5); }
  MENU.villa = { title: 'Randolf · Getränke und kleine Speisen', items: [['Champagner 1911', 'drink', 'coupe'], ['Whisky, 20 Jahre', 'drink', 'tumbler'], ['Bordeaux', 'drink', 'wine'], ['Mokka', 'drink', 'cup'], ['Austern', 'food', 'oysters'], ['Hummer', 'food', 'lobster'], ['Schokoladentorte', 'food', 'cake']] };
  addSeatUse();
}
let seatUse = false;
function addSeatUse() {
  if (seatUse) return; seatUse = true;
  INTERACT.push({ test: p => { if (DINE.seat) return false; HS.pick = null; let bd = 1.3 * 1.3;
    for (const V of HS.venues) { if (Math.abs(p.y - V.F) > 1.8) continue; for (const s of V.seats) { const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (d < bd) { bd = d; HS.pick = s; } } }
    return !!HS.pick; }, label: 'Platz nehmen', act: () => { const s = HS.pick; if (s) { sitDown(s.V, s); toast(s.V.kind === 'villa' ? 'Platz genommen · E: Randolf bringt Ihnen etwas · W aufstehen' : 'Platz genommen · E bestellen · W aufstehen'); } } });
}
// bestellt: wer bedient, holt es und bringt es auf dem Tablett
function dispatch() {
  const V = DINE.venue; if (!V || !V.priv || !DINE.order || DINE.item) return;
  const s = DINE.seat, ag = V.server ? V.server() : HS.R; if (!ag || ag.serve) return;
  if (ag.int) ag.int = null;
  if (ag.td) endTidy(ag);
  const plan = V.plan ? V.plan(ag, s) : villaPlan(ag, s, V);
  ag.serve = { ph: 'go', seat: s, ...plan };
  ag.st = 'serve'; ag.path = plan.go; ag.sp = 1.8; ag.carry = false;
  if (ag.onBreak) { ag.onBreak.slot.hidden = true; ag.onBreak.slot.busy = null; ag.onBreak = null; ag.hidden = false; }
}
function villaPlan(R, s, V) {
  // Randolf geht zur Tür des Raums (oder erscheint dort, wenn er weit weg ist), holt es und kommt zurück
  const d = V.door, far = Math.hypot(R.x - d[0], R.z - d[1]) > 16 || Math.abs(R.y - V.F) > 1.5;
  if (far) { R.x = d[0]; R.z = d[1]; R.y = V.F; }
  return { go: [[d[0], d[1], V.F]], back: [[s.stand[0], s.stand[1]]], home: [], who: 'Randolf' };
}

/* ---------- Penthouse: Concierge Konrad, Barkeeper, Kellner auf der Terrasse, Pianist, Zimmermädchen ---------- */
const K_GREET = ['Willkommen zu Hause, Herr Alexander. Die Suite ist bereit.', 'Guten Abend, Herr Alexander. Das Belmont ist ganz zu Ihren Diensten.', 'Herr Alexander. Der Pianist spielt, die Terrasse ist geheizt.'];
const K_SAYS = ['Heute Abend tanzen dreihundert Gäste im Ballsaal, Herr Alexander. Alle fragen nach Ihnen.', 'Die Aurora Imperial liegt am Mast, Herr Alexander. Die Mannschaft steht bereit.', 'Der Pianist fragt, ob Sie einen Wunsch haben.', 'Ich habe Ihnen die Abendzeitung hingelegt. Sie sind wieder auf der Titelseite.', 'Der Kristall … ich habe niemanden in seine Nähe gelassen, Herr Alexander. Wie immer.', 'Die Terrasse ist geheizt, die Feuerschalen brennen.'];
const PIANO_HIM = ['Ein Wunsch, Herr Alexander? Ich spiele, was Sie mögen.', 'Für Sie, Herr Alexander: etwas Ruhiges zum Abend.'];
export function buildPentStaff() {
  hookVilla();
  const F1 = PH.F1, C = HS.pc = new Crowd(['tux', 'waiter', 'dress'], 8);
  const add = (kind, col, x, y, z, yaw, o) => { const a = C.add(kind, col); a.x = x; a.y = y; a.z = z; a.yaw = yaw; const ag = mk(a, C, 'pent', o); HS.p.push(ag); return ag; };
  HS.K = add('tux', COL.tux, 2.6, F1, -12.2, Math.atan2(-2.6, -2.2), { key: 'konrad', st: 'post', name: 'Konrad' });
  HS.K.post = [2.6, -12.2, F1, HS.K.yaw]; HS.K.tray = trayMesh();
  HS.pianist = add('tux', COL.tux, -11.45, F1 + 0.55 + 0.04, 13.5, -Math.PI / 2, { key: 'pianist', st: 'piano', sit: true, yo: 0.87, t: rnd(120, 200) });
  HS.bar = add('waiter', WHITE, 13.5, F1, -10.0, 0, { key: 'barkeeper', st: 'barwork', t: 3 });
  HS.bar.post = [13.5, -10.0, F1, 0]; HS.bar.tray = null;
  const W1 = HS.w1 = add('waiter', WHITE, 6, F1, 22.4, Math.PI, { key: 'kellner' });
  W1.S = [{ w: [6, 22.4], a: 36.1, d: 12, fw: [6, 30] }, { w: [12.6, 27.4], a: 8.3, d: 6, fw: [12.6, 29], tray: 1 }, { w: [3, 22.6], a: 13.3, d: 4, fw: [3, 23.6] }, { w: [-9.6, 26.6], a: 8.3, d: 6, fw: [-9.6, 28], tray: 1 }, { w: [-3, 22.6], a: 36.1, d: 8, fw: [0, 30] }];
  W1.tray = trayMesh(); W1.i = 0; arrive(W1);
  const W2 = HS.w2 = add('waiter', WHITE, 23, F1, 6, 0, { key: 'kellner2' });
  W2.S = [{ w: [23, 6], a: 36.1, d: 10, fw: [28, 0] }, { w: [26.2, -1.6], a: 8.3, d: 6, fw: [28, 0], tray: 1 }, { w: [23, -6], a: 36.1, d: 8, fw: [28, 0] }];
  W2.tray = trayMesh(); W2.i = 0; arrive(W2);
  const M = add('dress', MAID, -11.15, F1, 1.6, 0, { key: 'pmaid' });
  M.S = [{ w: [-11.15, 1.6], a: 37, d: 3.5, fw: [-12, 3.2], flw: 'pdine' }, { w: [-15.9, 1.6] }, { w: [-15.9, 6] }, { w: [-17.8, 9.5], a: 29, d: 8, fw: [-18.6, 9.5] }, { w: [-15.9, 6] }, { w: [-15.9, 1.6] }, { w: [-8.2, 1.4], a: 29, d: 7, fw: [-8.2, 0] }];
  M.i = 0; arrive(M); M.brk = false;
  C.finish();
  for (const ag of HS.p) { ag.a.on = true; put(ag); }
  actA(HS.pianist, 14.5); actA(HS.K, 36.05); actA(HS.bar, 13.3);
  // Servierwagen auf der Südterrasse (Champagner im Kühler, Gläser)
  {
    const P = [], x = 3, z = 23.5, y = F1, GD = [0.75, 0.56, 0.26];
    for (const yy of [0.35, 0.82]) P.push([new T.BoxGeometry(0.9, 0.03, 0.5).translate(x, y + yy, z), [0.2, 0.1, 0.06]]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push([new T.CylinderGeometry(0.014, 0.014, 0.84, 6).translate(x + sx * 0.42, y + 0.44, z + sz * 0.22), GD]);
    for (const sx of [-1, 1]) P.push([new T.TorusGeometry(0.07, 0.02, 6, 12).rotateY(Math.PI / 2).translate(x + sx * 0.42, y + 0.07, z), [0.05, 0.05, 0.05]]);
    P.push([new T.CylinderGeometry(0.11, 0.09, 0.22, 12).translate(x - 0.22, y + 0.95, z), [0.82, 0.82, 0.85]], [new T.CylinderGeometry(0.035, 0.04, 0.32, 8).translate(x - 0.22, y + 1.1, z), [0.06, 0.18, 0.08]]);
    for (let k = 0; k < 4; k++) P.push([new T.CylinderGeometry(0.045, 0.01, 0.03, 10).translate(x + 0.05 + k * 0.1, y + 0.97, z + 0.1), [0.85, 0.9, 0.9]], [new T.CylinderGeometry(0.004, 0.004, 0.1, 5).translate(x + 0.05 + k * 0.1, y + 0.89, z + 0.1), [0.85, 0.9, 0.9]]);
    // Beistelltische neben den Sofas der Terrasse
    for (const [tx, tz] of [[-9.8, 33.4], [9.8, 33.4], [-13.8, 29.4], [13.8, 29.4]]) { P.push([new T.CylinderGeometry(0.3, 0.3, 0.03, 18).translate(tx, y + 0.55, tz), [0.06, 0.05, 0.05]], [new T.TorusGeometry(0.3, 0.012, 4, 24).rotateX(Math.PI / 2).translate(tx, y + 0.565, tz), GD], [new T.CylinderGeometry(0.03, 0.03, 0.54, 8).translate(tx, y + 0.27, tz), GD], [new T.CylinderGeometry(0.18, 0.2, 0.03, 14).translate(tx, y + 0.015, tz), GD]); addCollider(tx - 0.3, y, tz - 0.3, tx + 0.3, y + 0.57, tz + 0.3); }
    const m = new T.Mesh(mergeColored(P), HS.mat || (HS.mat = paintMat({ color: 0xffffff, metalness: 0.4, roughness: 0.25, envI: 0.9, emissive: 0x0c0a06 })));
    m.matrixAutoUpdate = false; m.updateMatrix(); scene.add(m); HS.pentMesh = m;
    addCollider(x - 0.47, y, z - 0.27, x + 0.47, y + 1.0, z + 0.27);
  }
  flowerSpot('pdine', -12.3, 3.2, F1 + 0.8, true);
  HS.pfires = [[-6.6, 9.5]];
  pentSeats();
  INTERACT.push({ test: p => { const K = HS.K; return !!K && inPenthouse(p) && !K.serve && (p.x - K.x) ** 2 + (p.z - K.z) ** 2 < 2.4 * 2.4; }, label: 'Mit Konrad sprechen', act: konradMenu });
}
function konradMenu() {
  openChoice('Konrad · Concierge des Belmont', ['Ein Glas Champagner, bitte', 'Was gibt es Neues?', 'Bitten Sie den Pianisten um ein Lied', 'Danke, Konrad'], i => {
    const K = HS.K;
    if (i === 0) { lifeSay('Konrad', 'Sehr gern, Herr Alexander.', 3); K.serve = { ph: 'go', kind: 'coupe', mix: true, mixF: [4.4, 13.4], go: konradToCart(K), who: 'Konrad', home: [] }; K.st = 'serve'; K.path = K.serve.go; K.sp = 1.4; }
    else if (i === 1) { HS.kSaid = ((HS.kSaid ?? -1) + 1) % K_SAYS.length; lifeSay('Konrad', K_SAYS[HS.kSaid], 5); }
    else if (i === 2) { const P = HS.pianist; P.st = 'piano'; P.t = rnd(150, 220); actA(P, 14.5); lifeSay('Der Pianist', pick(['Mit Vergnügen, Herr Alexander. Etwas von Gershwin.', 'Für Sie, Herr Alexander, immer.']), 4); }
    else lifeSay('Konrad', 'Sehr wohl, Herr Alexander.', 2.5);
  });
}
// Wege im Salon des Penthouse: um die Wendeltreppe herum, am Sessel vorbei, zum Barwagen
function konradToCart(K) { const P = [[4.4, 4.0], [5.0, 9.5], [4.4, 12.6]]; return Math.hypot(K.x - 4.4, K.z - 12.6) < 4 ? [[4.4, 12.6]] : K.z < -2 ? [[3.6, -6.8], ...P] : P; }
function pentSeats() {
  const F1 = PH.F1;
  const MS = MENU.penthouse = { title: 'The Belmont · Penthouse-Suite', items: [['Champagner', 'drink', 'coupe'], ['Martini', 'drink', 'wine'], ['Whisky', 'drink', 'tumbler'], ['Mokka', 'drink', 'cup'], ['Kaviar und Austern', 'food', 'oysters'], ['Hummer', 'food', 'lobster'], ['Petits Fours', 'food', 'cake']] };
  // Salon: Konrad
  const sal = { priv: true, kind: 'penthouse', name: 'Salon', seats: [], F: F1, server: () => HS.K };
  sal.plan = (K, s) => ({ go: konradToCart(K), mix: true, mixF: [4.4, 13.4], back: s.route.map(q => q.slice()), home: [...s.route.slice(0, -1).reverse(), [5.0, 9.5], [4.4, 4.0], [3.6, -6.8], [K.post[0], K.post[1]]], who: 'Konrad', lines: ['Bitte sehr, Herr Alexander.', 'Zum Wohl, Herr Alexander.'] });
  for (const dx of [-1.2, 0, 1.2]) { const s = seat(sal, dx, F1 + 0.56, 6.05, 0, dx * 0.5, F1 + 0.43, 8.65, [dx, F1, 7.1], null); s.route = [[5.0, 9.5], [5.0, 7.4], [dx + 0.6, 7.4]]; }
  for (const dx of [-1.0, 1.0]) { const s = seat(sal, dx, F1 + 0.56, 13.15, Math.PI, dx * 0.5, F1 + 0.43, 10.35, [dx, F1, 12.1], null); s.route = [[dx + 0.6, 11.95]]; }
  { const s = seat(sal, 3.6, F1 + 0.5, 9.5, -Math.PI / 2, 0.9, F1 + 0.43, 9.5, [2.6, F1, 9.5], null); s.route = [[3.6, 10.75]]; }
  { const s = seat(sal, -3.6, F1 + 0.5, 9.5, Math.PI / 2, -0.9, F1 + 0.43, 9.5, [-2.6, F1, 9.5], null); s.route = [[2.4, 11.6], [-2.4, 11.6], [-3.6, 10.75]]; }
  HS.venues.push(sal);
  // Bar: der Barkeeper
  const bar = { priv: true, kind: 'penthouse', name: 'Bar', seats: [], F: F1, server: () => HS.bar };
  bar.plan = (b, s) => ({ go: [[s.x, -9.9]], mix: true, mixF: [s.x, -12.2], back: [[s.x, -9.6]], home: [[13.5, -10.0]], who: 'Der Barkeeper', lines: ['Bitte sehr, Herr Alexander. Geschüttelt, nicht gerührt.', 'Zum Wohl, Herr Alexander.', 'Aufs Haus, Herr Alexander. Wie immer.'] });
  for (let x = 9.8; x <= 17.2; x += 1.6) seat(bar, x, F1 + 0.89, -7.35, Math.PI, x, F1 + 1.14, -8.2, [x, F1, -6.3], null);
  HS.venues.push(bar);
  // Terrasse: der Kellner (Servierwagen, dann um das Becken herum)
  const ter = { priv: true, kind: 'penthouse', name: 'Terrasse', seats: [], F: F1, server: () => HS.w1 };
  ter.plan = (w, s) => ({ go: [[3, 22.6]], mix: true, mixF: [3, 23.6], back: s.route.map(q => q.slice()), home: [], who: 'Der Kellner', lines: ['Champagner für Herrn Alexander!', 'Bitte sehr, Herr Alexander. Die Feuerschalen wärmen.'] });
  for (const sx of [-1, 1]) {
    const via = [sx * 9.6, 26.6];
    { const s = seat(ter, sx * 11.5, F1 + 0.56, 33.35, Math.PI, sx * 9.8, F1 + 0.58, 33.4, [sx * 11.5, F1, 32.3], null); s.route = [via, [sx * 10.6, 32.3]]; }
    { const s = seat(ter, sx * 13.75, F1 + 0.56, 31, -sx * Math.PI / 2, sx * 13.8, F1 + 0.58, 29.4, [sx * 12.7, F1, 31], null); s.route = [via, [sx * 12.6, 29.7]]; }
    for (const [lx, lz] of [[7.0 + 1.1, 30], [7.0, 32.4]]) { const s = seat(ter, sx * lx, F1 + 0.5, lz, 0, sx * 5.32, F1 + 0.66, lz, [sx * (lx + 0.9), F1, lz + 0.3], null); s.route = [via, [sx * (lx + 0.95), lz + 0.2]]; }
  }
  HS.venues.push(ter);
  addSeatUse();
}

/* ---------- jedes Bild: Villa (aus updateVillaRooms) ---------- */
let lastRoom = null;
function tickVilla(dt, t, r) {
  if (!HS.vInit) initVilla();
  HS.vc = (HS.vc || 0) + dt; HS.clock = Math.max(HS.vc, HS.pc2 || 0);   // Spieluhr (läuft mit dt, auch im Test)
  HS.sayT -= dt; HS.tkT -= dt;
  const p = player.p, inV = inVillaHouse(p);
  if (inV && !HS.inV) {
    // Alexander kommt heim: Randolf begrüßt ihn (wenn er auf seinem Posten steht)
    const R = HS.R;
    if (R && (R.st === 'post' || R.st === 'home')) { if (R.st === 'home') { if (!inView(R.x, R.y, R.z)) { [R.x, R.z, R.y] = R.post; R.yaw = R.post[3]; } R.st = 'post'; } startInt(R, { act: 1.3, dur: 2.8, face: [p.x, p.z], bow: 0.9 }); if (Math.hypot(p.x - R.x, p.z - R.z) < 18) rSay(pick(R_GREET), 4.5); }
    HS.crumbs.length = 0; if (R) R.ci = 0;
  }
  HS.inV = inV;
  const l = villaLocal(p); HS.room = inV ? roomAt(l.x, l.y, l.z) : null;
  crumbs();
  if (HS.room !== lastRoom) {
    if (HS.room) {
      enterRoom(HS.v, ag => ag.room === HS.room);
      const R = HS.R, L = R_ROOM[HS.room.name];
      if (L && R && R.st === 'follow' && HS.sayT <= 0 && (HS.room.said || 0) < HS.clock && Math.random() < 0.7) { HS.room.said = HS.clock + 90; setTimeout(() => { if (HS.room && R_ROOM[HS.room.name] === L) rSay(pick(L)); }, 1400); }
    }
    lastRoom = HS.room;
  }
  if (inV) { nearPlayer(HS.v); tkAwe(HS.v); }
  if ((HS.tidyT -= dt) <= 0) { HS.tidyT = 0.7; tidyScan(HS.v, (x, y, z) => inVillaHouse({ x, y, z }), (ag, B) => { const a = villaLocal(ag), b = villaLocal(B.x); return roomAt(a.x, a.y, a.z) === roomAt(b.x, b.y, b.z); }); }
  dispatch();
  breaks(dt); slotTalk(dt);
  // Wer geht, wo Türen sind (Randolf und wer bedient), öffnet sie
  const W = VR.walkers || (VR.walkers = []); W.length = 0;
  for (const ag of HS.v) {
    if (ag.cool > 0) ag.cool -= dt;
    if (ag.int) intStep(ag, dt);
    else if (ag.serve) { serveStep(ag, dt); if (!ag.serve && ag.st === 'serve') ag.st = 'post'; }
    else if (ag.td) tidyStep(ag, dt);
    else if (ag === HS.R) randolf(dt);
    else if (ag.S && !ag.hidden) routine(ag, dt);
    if (ag === HS.R || ag.serve) { const q = villaLocal(ag); W.push({ x: q.x, y: q.y, z: q.z }); }
    put(ag); trayAt(ag);
  }
  growFlowers(dt);
  fireNear(inV, HS.fires);
}
function fireNear(on, list) {
  if (!on || !list) { if (!HS.inP && !HS.inV) SND.fireK = undefined; return; }
  const p = player.p; let d = 99;
  for (const [x, z, y] of list) if (y === undefined || Math.abs(p.y - y) < 4) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  SND.fireK = 0.3 + 0.9 * Math.max(0, 1 - d / 14);
}

/* ---------- jedes Bild: Penthouse (aus performance.js) ---------- */
export function updatePentStaff(dt) {
  const C = HS.pc; if (!C) return;
  const vis = !!(PH.inner && (PH.inner.visible || (PH.terrace && PH.terrace.visible)));
  C.show(vis);
  if (HS.pentMesh) HS.pentMesh.visible = vis;
  for (const F of HS.flowers) if (F.pent) F.ms.forEach((m, i) => { m.visible = vis && i === F.k; });
  if (!vis) { for (const ag of HS.p) if (ag.tray) ag.tray.visible = false; SND.pianoK = 1; return; }
  const p = player.p, inP = inPenthouse(p), onT = onPentTerrace(p);
  HS.pc2 = (HS.pc2 || 0) + dt; HS.clock = Math.max(HS.vc || 0, HS.pc2); if (!HS.inV) { HS.sayT -= dt; HS.tkT -= dt; }
  if (inP && !HS.inP) {
    const K = HS.K; if (K && !K.serve) { startInt(K, { act: 1.3, dur: 2.8, face: [p.x, p.z], bow: 0.9 }); if (Math.hypot(p.x - K.x, p.z - K.z) < 14) lifeSay('Konrad', pick(K_GREET), 4.5); }
    enterRoom(HS.p, ag => ag !== HS.pianist && ag.zone === 'pent' && Math.abs(ag.x) < 20 && Math.abs(ag.z) < 20);
  }
  if (onT && !HS.onT) enterRoom(HS.p, ag => ag.key === 'kellner' || ag.key === 'kellner2');
  HS.inP = inP; HS.onT = onT;
  if (inP || onT) { nearPlayer(HS.p); tkAwe(HS.p); }
  if ((HS.ptidyT = (HS.ptidyT || 0) - dt) <= 0) { HS.ptidyT = 0.7; tidyScan(HS.p, (x, y, z) => Math.abs(x) < 20 && Math.abs(z) < 20 && y > PH.F1 - 0.5 && y < PH.F1 + 4, (ag, B) => ag !== HS.pianist && ag.key !== 'kellner' && ag.key !== 'kellner2' && ag !== HS.bar && Math.abs(ag.x) < 20 && Math.abs(ag.z) < 20); }
  dispatch();
  const P = HS.pianist;
  for (const ag of HS.p) {
    if (ag.cool > 0) ag.cool -= dt;
    if (ag === P) pianoStep(P, dt, p);
    else if (ag.int) intStep(ag, dt);
    else if (ag.serve) { serveStep(ag, dt); if (!ag.serve && ag.st === 'serve') ag.st = 'post'; }
    else if (ag.td) tidyStep(ag, dt);
    else if (ag === HS.K) { const [x, z] = ag.post; if (Math.hypot(ag.x - x, ag.z - z) > 0.1) { if (!ag.path.length) ag.path = [...(ag.z > 8 ? [[5.0, 9.5]] : []), ...(ag.z > -3 ? [[4.4, 4.0], [3.6, -6.8]] : []), [x, z]]; walk(ag, dt); } else { actA(ag, 36.05); ag.yaw += wrap(ag.post[3] - ag.yaw) * Math.min(1, dt * 2); } }
    else if (ag === HS.bar) barStep(ag, dt);
    else if (ag.S) { routine(ag, dt); const s = ag.S[ag.i]; ag.carry = ag.st === 'work' ? !!s.tray : ag.key !== 'pmaid'; }
    put(ag); trayAt(ag);
  }
  if (!HS.inV) growFlowers(dt);
  if (inP) fireNear(true, HS.pfires.map(([x, z]) => [x, z, PH.F1])); else if (!HS.inV) SND.fireK = undefined;
  C.flag();
}
// Pianist: spielt, macht zwischen den Stücken Pause, widmet Alexander ein Lied
function pianoStep(P, dt, p) {
  P.t -= dt;
  if (P.st === 'piano') { actA(P, 14.5); SND.pianoK = 1; if (P.t <= 0) { P.st = 'pause'; P.t = rnd(14, 24); actA(P, 7.0); } }
  else { SND.pianoK = 0.2; if (P.t <= 0) { P.st = 'piano'; P.t = rnd(150, 240); actA(P, 14.5); } else if (P.t < 10 && Math.random() < dt * 0.2) turnHead(P.a, p.x, p.z); }
  if (inPenthouse(p) && Math.hypot(p.x - P.x, p.z - P.z) < 4 && !(P.him > HS.clock) && HS.sayT <= 0) { P.him = HS.clock + 120; turnHead(P.a, p.x, p.z); if (lifeSay('Der Pianist', pick(PIANO_HIM), 4)) HS.sayT = 6; }
}
// Barkeeper: poliert Gläser, schüttelt, geht hinter der Theke auf und ab
function barStep(b, dt) {
  if (b.path.length) { if (walk(b, dt)) actA(b, b.nextAct || 13.3); return; }
  faceTo(b, b.x, b.fz ?? -8, dt, 4);
  if ((b.t -= dt) > 0) return;
  b.t = rnd(4, 9); const r = Math.random();
  b.path = [[rnd(10.2, 16.8), -10.0]]; b.fz = r < 0.5 ? -8 : -12; b.nextAct = r < 0.5 ? 13.3 : 29;
}

// Villa einhängen (nach buildVilla): updateVillaRooms ruft VR.tick jedes Bild; der Aufbau geschieht beim ersten Aufruf
export function hookVilla() {
  VR.tick = tickVilla;
  VR.talk = () => { if (!HS.vInit) initVilla(); return randolfMenu(); };
}
