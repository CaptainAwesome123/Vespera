/* =====================================================================
   V116 · VIEL MEHR BEWEGLICHE DINGE, DRAUSSEN UND DRINNEN
   Wird aus clutter.planClutter() gerufen (nach dem Aufbau der ganzen Welt)
   und stellt alles als ruhende Instanzen hin; erst wenn Alexander ein Ding
   greift (Telekinese oder E), wird es in physics.js zu einem Körper.

   DRAUSSEN (gleiche Plätze-Belegung wie V53, eigener Zufall):
   - Gehwege der Bürgerviertel: Pakete und Milchflaschen an den Haustüren,
     Zeitungsbündel, Besen, Gießkannen bei Blumentöpfen, Gepäck, kleine
     Baustellen (Absperrbock, Warnlaterne, Ziegel, Sägebock, Farbeimer).
   - Arbeiterviertel: Brennholz, Wäschekörbe, Waschzuber, Reifen,
     Farbeimer, Ziegel, Schemel, Kanister; in den Gassen Wäsche und Holz,
     am Kneipenplatz Schemel und Kisten; Werkstätten mit Reifen und Kanistern.
   - Hafen: Fischkisten, Anker, Ruder, Tauwerk.
   - Dächer der Arbeiterhäuser: Wäschekorb und Zuber, bei den Bürgern Gießkannen.
   DRINNEN (je Haus eine Gruppe, nur aus der Nähe gezeichnet):
   - Belmont: Gepäck, Golftaschen und Samthocker in der Lobby, Klingel und
     Tintenfass an der Rezeption, Tabletts, Etageren, Kandelaber auf den
     Ballsaaltischen und Galerietischen, Notenständer und Instrumente auf
     der Bühne, Gläser und Karaffen an der Bar.
   - Penthouse: Bücherstapel, Schmuck, Parfüm, Luftschiffmodell, Obst,
     Karten, Schuhe, Golftasche, Hocker.
   - Villa: Raum für Raum, was in den Raum gehört (Küche: Milch, Holz,
     Körbe; Bibliothek: Bücher, Globus; Ankleide: Schuhe, Hutschachteln;
     Keller: Waschzuber, Besen, Kisten ...).
   - Brass Lantern: Bierkrüge, Karten, Schemel, Holz und Kohlenschütte.
     Restaurant Aurora und Café: Kerzen, Etageren, Obst, Tabletts.
   - Bank und Varieté: Schirmständer, Garderoben, Pakete, Hocker.
   Plätze drinnen: an Wänden, wo frei ist (kein Möbel, keine Treppe, keine
   Tür), und auf Tischen, Theken und Sideboards, deren Höhe bekannt ist.
   ===================================================================== */
import { MOBILE, mulberry32 } from './core.js';
import { nearBoxes } from './people-skeleton.js';
import { groundAt } from './driving.js';
import { VILLA } from './harbour.js';
import { VR } from './villa.js';
import { PH } from './penthouse.js';
import { BI, GAL } from './belmont.js';
import { VENUES } from './venues.js';
import { ORTE } from './orte.js';
import { WORK } from './workers.js';
import { SPAWNS } from './physics.js';
import { DOORS } from './entrances.js';
import { curbs, roofs } from './facade-shader.js';
import { blocks, PLAZA, MEDIAN, QUAY, QX } from './island.js';
import { QUAY_GAPS } from './harbour.js';
import { LIFE } from './life.js';
import { CLUT, clutterHouse } from './clutter.js';

const KS = { taken: 0 };
// Farben für die PAINT-Teile
const PAINTS = { gascan: [[0.45, 0.08, 0.06], [0.16, 0.24, 0.14], [0.3, 0.3, 0.32]], paintcan: [[0.85, 0.82, 0.74], [0.1, 0.3, 0.32], [0.55, 0.12, 0.1], [0.75, 0.6, 0.25]],
  ottoman: [[0.35, 0.06, 0.1], [0.06, 0.22, 0.24], [0.1, 0.12, 0.28], [0.55, 0.42, 0.2], [0.12, 0.3, 0.22]], towels: [[0.92, 0.9, 0.85], [0.1, 0.3, 0.32], [0.85, 0.75, 0.6]],
  bicycle: [[0.05, 0.05, 0.06], [0.08, 0.22, 0.2], [0.35, 0.06, 0.06]] };

export function planKram116(api) {
  const { put, K } = api, rs = mulberry32(11616), dens = api.dens;
  const col = k => PAINTS[k] ? PAINTS[k][Math.floor(rs() * PAINTS[k].length)] : null;
  const pick = W => { let t = 0; for (const w of W) t += w[1]; let u = rs() * t; for (const w of W) if ((u -= w[1]) <= 0) return w[0]; return W[0][0]; };
  const n0 = CLUT.items.length;
  outdoors(put, K, rs, dens, col, pick);
  const n1 = CLUT.items.length;
  indoors(put, K, rs, col, pick);
  KS.out = n1 - n0; KS.in = CLUT.items.length - n1;
  CLUT.stats.v116 = KS;
}

/* =====================================================================
   DRAUSSEN
   ===================================================================== */
function outdoors(put, K, rs, dens, col, pick) {
  const blockAt = (x, z) => blocks.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  // ---- Gehwege: zweiter Durchgang mit den neuen Dingen (füllt Lücken zwischen den V53-Gruppen) ----
  const ELITE = [['parcels', 1.2], ['newsb', 0.9], ['broom', 0.7], ['garden', 0.8], ['luggage', 0.5], ['site', 0.35], ['milk', 0.6], ['bikes', 0.5]];
  const WORKER = [['firewood', 1.4], ['laundry', 1.1], ['washtub', 0.6], ['tyres', 0.6], ['paint', 0.6], ['bricks', 0.7], ['sawhorse', 0.5], ['broom', 0.8], ['stool', 0.8], ['gascan', 0.5], ['site', 0.45], ['milk', 0.4], ['scuttle', 0.4]];
  for (const c of curbs) {
    const b = blockAt(c.cx, c.cz); if (!b) continue;
    if (Math.hypot(c.cx, c.cz) > 1100) continue;
    const worker = (b.tier || 'fabric') === 'fabric' && b.d > 650 && c.cz <= 420;
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az); if (L < 10) continue;
    const dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L;
    let nx = -dz, nz = dx; if ((c.cx - c.ax) * nx + (c.cz - c.az) * nz < 0) { nx = -nx; nz = -nz; }
    const out = Math.atan2(-nx, -nz);
    for (let t = 8 + rs() * 8; t < L - 5; t += (b.park ? 40 : 11) + rs() * 16 / dens) {
      if (rs() > dens) continue;
      const ax = c.ax + dx * t, az = c.az + dz * t;
      if (ax > PLAZA.x0 - 2 && ax < PLAZA.x1 + 2 && az > PLAZA.z0 - 2 && az < PLAZA.z1 + 2) continue;
      if (ax > MEDIAN.x0 - 2 && ax < MEDIAN.x1 + 2 && az > MEDIAN.z0 - 2 && az < MEDIAN.z1 + 2) continue;
      if (LIFE.spots.some(q => Math.abs(q.x - ax) < 4.5 && Math.abs(q.z - az) < 4.5)) continue;
      const wall = (k, u = 0, tilt = 0, y0 = 0.22, force = false, insK = k) => { const I = K[insK]; if (!I || !K[k]) return null; const ins = 3.42 - I.he[2] * Math.cos(tilt) - Math.sin(tilt) * I.he[1]; return put(k, ax + dx * u + nx * ins, az + dz * u + nz * ins, out + (tilt || insK !== k ? 0 : (rs() - 0.5) * 0.3), y0, col(k), -tilt, force); };   // insK: auf ein anderes Ding gestellt (gleicher Abstand zur Wand)
      const v = b.park ? pick([['garden', 1], ['broom', 1]]) : pick(worker ? WORKER : ELITE);
      // erst die Gruppe beginnen, wenn das erste Ding Platz hat (sonst stünde die Hälfte einer Gruppe herum)
      if (v === 'parcels') { if (wall('parcel', 0)) { if (rs() < 0.6) wall('parcel', 0, 0, 0.22 + K.parcel.he[1] * 2, true); if (rs() < 0.5) wall('parcel', 0.5); } }
      else if (v === 'newsb') { if (wall('newsbundle', 0)) { wall('newsbundle', 0, 0, 0.22 + K.newsbundle.he[1] * 2, true); if (rs() < 0.5) wall('newsbundle', 0.5); } }
      else if (v === 'broom') { if (wall('broom', 0, 0.16)) { if (rs() < 0.5) wall(rs() < 0.5 ? 'bucket' : 'dustbin', 0.6); } }
      else if (v === 'garden') { if (wall('flowerpot', 0)) { wall('wateringcan', 0.5); if (rs() < 0.5) wall('flowerpot', -0.5); } }
      else if (v === 'luggage') { if (wall('trunk', 0)) { wall('suitcase', 0, 0, 0.22 + K.trunk.he[1] * 2, true, 'trunk'); if (rs() < 0.6) wall('hatbox', 0.7); } }
      else if (v === 'milk') { if (wall('milkcrate', 0) && rs() < 0.5) wall('milkcan', 0.5); }
      else if (v === 'bikes') { wall('bicycle', 0, 0.12); }
      else if (v === 'site') {   // kleine Baustelle: Absperrbock mit Warnlaterne, Ziegel, Sägebock, Farbe
        if (wall('barrier', 0)) { const bh = K.barrier.he[1] * 2; wall('warnlamp', -0.45, 0, 0.22 + bh, true, 'barrier'); wall('bricks', 1.2); wall('bricks', 1.75); wall('sawhorse', -1.6); wall('paintcan', 2.4); if (rs() < 0.5) wall('broom', 2.8, 0.16); }
      }
      else if (v === 'firewood') { if (wall('firewood', 0)) { wall('firewood', 0, 0, 0.22 + K.firewood.he[1] * 2, true); wall('firewood', 0.55); if (rs() < 0.5) wall('firewood', 0.55, 0, 0.22 + K.firewood.he[1] * 2, true); } }
      else if (v === 'laundry') { if (wall('laundrybasket', 0)) { if (rs() < 0.5) wall('stool', 0.7); } }
      else if (v === 'washtub') { if (wall('washtub', 0)) wall('bucket', 0.7); }
      else if (v === 'tyres') { if (wall('tyre', 0)) { wall('tyre', 0, 0, 0.22 + K.tyre.he[1] * 2, true); if (rs() < 0.5) wall('tyre', 0, 0, 0.22 + K.tyre.he[1] * 4, true); } }
      else if (v === 'paint') { if (wall('paintcan', 0)) { wall('paintcan', 0.3); if (rs() < 0.5) wall('ladder', 1.0); } }
      else if (v === 'bricks') { if (wall('bricks', 0)) wall('bricks', 0.6); }
      else if (v === 'sawhorse') { if (wall('sawhorse', 0)) wall('firewood', 0, 0, 0.22 + K.sawhorse.he[1] * 2, true, 'sawhorse'); }
      else if (v === 'stool') { if (wall('stool', 0)) { if (rs() < 0.5) wall('stool', 0.6); } }
      else if (v === 'gascan') { if (wall('gascan', 0)) { if (rs() < 0.5) wall('gascan', 0.4); } }
      else if (v === 'scuttle') { wall('coalscuttle', 0); }
    }
  }
  // ---- Haustüren und Werkstätten ----
  for (const d of DOORS) {
    const dist = Math.hypot(d.x, d.z); if (dist > 1000 || rs() > 0.5 * dens) continue;
    const tx = -d.nz, tz = d.nx, s = rs() < 0.5 ? 1 : -1, at = (k, u, ins, y0 = 0.22, force = false) => put(k, d.x + tx * u + d.nx * ins, d.z + tz * u + d.nz * ins, Math.atan2(d.nx, d.nz) + (rs() - 0.5) * 0.4, y0, col(k), 0, force);
    if (d.kind === 'house') { if (dist < 650) { if (rs() < 0.6) at('milkcrate', s * 1.0, 0.3); else at('parcel', s * 1.0, 0.3); } else at(rs() < 0.5 ? 'broom' : 'firewood', s * 1.1, 0.3); }
    else if (d.kind === 'workshop') { at('tyre', s * 2.0, 0.5); at('tyre', s * 2.0, 0.5, 0.22 + K.tyre.he[1] * 2, true); at('gascan', s * 2.8, 0.4); at('paintcan', -s * 2.0, 0.35); at('sawhorse', -s * 3.0, 0.7); }
    else if (d.kind === 'hotel') { at('golfbag', s * 2.4, 0.35); at('parcel', -s * 2.6, 0.35); }
    else if (d.kind === 'shop' && rs() < 0.4) at('parcel', s * 1.2, 0.3);
    else if ((d.kind === 'bar' || d.kind === 'pub') && rs() < 0.6) { at('bottlecrate', s * 1.6, 0.4); at('broom', -s * 1.4, 0.3); }
  }
  // ---- Gassen im Arbeiterviertel: Wäsche, Holz, Zuber, Schemel an den Wänden ----
  for (const A of WORK.alleys) {
    const ar = mulberry32(((A.x * 31) | 0) ^ ((A.z0 * 7) | 0) ^ 0x116);
    for (let z = A.z0 + 3; z < A.z1 - 2.5; z += 2.6 + ar() * 4) {
      if (ar() > 0.62 * dens || (A.props || []).some(q => Math.abs(q.z - z) < 1.4)) continue;
      const side = ar() < 0.5 ? -1 : 1, x = A.x + side * 1.55, g = groundAt(x, z, 4), y0 = g ? g.y : 0.2, yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      const v = pick([['laundrybasket', 1.2], ['washtub', 0.8], ['firewood', 1.2], ['stool', 0.8], ['broom', 0.6], ['paintcan', 0.4], ['tyre', 0.4], ['bucket', 0.5], ['bricks', 0.4], ['gascan', 0.3]]);
      put(v, x, z, yaw + (ar() - 0.5) * 0.3, y0, col(v), v === 'broom' ? 0.16 : 0);
      if (v === 'firewood') put('firewood', x, z, yaw, y0 + K.firewood.he[1] * 2, null, 0, true);
    }
  }
  // ---- Kneipenplatz: Schemel und Kisten an der Kneipe, Brennholz am Feuer ----
  const S = WORK.square;
  if (S) { const P = S.pub;
    for (const dx of [-8.5, -6.6, 6.6, 8.5]) { const x = P.x + dx + (rs() - 0.5) * 0.3, z = P.z + P.d / 2 + 1.0 + rs() * 0.4;   // neben der Tür, nicht davor
      if (put('stool', x, z, rs() * 6, 0.22) && rs() < 0.6) put('beermug', x + 0.05, z - 0.04, rs() * 6, 0.22 + K.stool.he[1] * 2, null, 0, true); }
    for (const b of WORK.braziers) { put('firewood', b.x - 1.6, b.z - 0.9, 0.4, 0.22); put('firewood', b.x - 1.6, b.z - 0.9, 0.5, 0.22 + K.firewood.he[1] * 2, null, 0, true); put('stool', b.x + 1.3, b.z - 1.2, rs() * 6, 0.22); }
  }
  // ---- Hafen: Fischkisten, Anker, Ruder, Tauwerk ----
  if (QUAY && QX) {
    const zE = QUAY.z1 - 1.6, zB = QUAY.z0 + 3;
    for (let x = QX[0] + 10; x < QX[1] - 8; x += 11 + rs() * 14) {
      if (QUAY_GAPS.some(([a, b]) => x > a - 4 && x < b + 4) || rs() > dens) continue;
      const v = pick([['fish', 1.4], ['anchor', 0.5], ['oars', 0.8], ['rope', 0.6], ['work', 0.6]]);
      if (v === 'fish') { if (put('fishcrate', x, zB + 1.2, 0.1, 0.25)) { put('fishcrate', x, zB + 1.2, 0.15, 0.25 + K.fishcrate.he[1] * 2, null, 0, true); put('fishcrate', x + 0.7, zB + 1.25, -0.1, 0.25); if (rs() < 0.5) put('bucket', x - 0.6, zB + 1.0, 0, 0.25); } }
      else if (v === 'anchor') put('anchor', x, zE, rs() * 6, 0.25, null, 1.5);
      else if (v === 'oars') { if (put('oar', x, zE - 0.4, 0.05, 0.25)) put('oar', x + 0.1, zE - 0.15, -0.05, 0.25 + 0.06, null, 0, true); }
      else if (v === 'rope') { put('ropecoil', x, zE, rs() * 6, 0.25); put('lifebuoy', x + 0.9, zE + 0.1, rs() * 6, 0.25); }
      else { put('gascan', x, zB, 0.2, 0.25, col('gascan')); put('paintcan', x + 0.4, zB, 0, 0.25, col('paintcan')); put('broom', x - 0.6, zB, 0, 0.25); }
    }
  }
  // ---- Dächer: Wäsche bei den Arbeitern, Gießkannen und Hocker bei den Bürgern ----
  for (const r of roofs) {
    if (r.H > 48 || r.H < 8 || r.crown || r.dist > 800 || rs() > (r.worker ? 0.12 : 0.08) * dens) continue;
    const y = r.H, x0 = r.x + (rs() - 0.5) * r.w * 0.4, z0 = r.z + (rs() - 0.5) * r.d * 0.4;
    if (r.worker) { put('laundrybasket', x0, z0, rs() * 6, y); put('washtub', x0 + 1.4, z0 + 0.3, rs() * 6, y); put('stool', x0 - 1.1, z0 + 0.6, rs() * 6, y); }
    else { put('wateringcan', x0, z0, rs() * 6, y); put('flowerpot', x0 + 0.6, z0, 0, y); put('flowerpot', x0 + 1.2, z0, 0, y); put('stool', x0 - 1.0, z0 + 0.5, rs() * 6, y); }
  }
}

/* =====================================================================
   DRINNEN
   ===================================================================== */
// Bezugssystem eines Hauses: W = lokal -> Welt, yaw = Gierwinkel lokal -> Welt, boxes = Quader im lokalen System (y in Welt)
const WORLD = {
  W: (x, z) => [x, z], yaw: a => a,
  boxes(x0, x1, z0, z1) { const out = [], r = Math.max(x1 - x0, z1 - z0) / 2 + 1; for (const b of nearBoxes((x0 + x1) / 2, (z0 + z1) / 2, r)) if (b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1) out.push(b); return out; },
};
function villaFrame() {
  const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry);
  return { W: (lx, lz) => [VILLA.x + lx * cs + lz * sn, VILLA.z - lx * sn + lz * cs], yaw: a => { const x = Math.sin(a), z = Math.cos(a); return Math.atan2(x * cs + z * sn, -x * sn + z * cs); },
    boxes: (x0, x1, z0, z1) => (VILLA.boxes || []).filter(b => b.x1 > x0 && b.x0 < x1 && b.z1 > z0 && b.z0 < z1) };
}
// Oberkante unter (lx, lz) bis yTop: Boden der Stadt und Quader des Hauses
function surface(F, B, lx, lz, yTop) {
  const [x, z] = F.W(lx, lz), g = groundAt(x, z, yTop); let y = g ? g.y : -1e9;
  for (const b of B) if (lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1 && b.y1 <= yTop && b.y1 > y) y = b.y1;
  return y;
}
const MAXN = { airshipmodel: 1, bust: 2, golfbag: 2, microphone: 1, globe: 2, washtub: 2, saxophone: 1, trumpet: 1 };

// Raum ausstatten: Dinge an freie Wandplätze (nicht in Türen, nicht auf Möbeln oder Stufen) und auf bekannte Tischflächen
function furnish(put, K, rs, col, pick, H, F, R, spec) {
  const fy = R.y, mul = MOBILE ? 0.6 : 1;
  const B = F.boxes(R.x0 - 1.5, R.x1 + 1.5, R.z0 - 1.5, R.z1 + 1.5);
  const obst = B.filter(b => b.y1 > fy + 0.06 && b.y0 < fy + 1.9), tall = B.filter(b => b.y1 > fy + 1.4 && b.y0 < fy + 1.0);
  const hit = (L, x, z) => L.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const count = H.count || (H.count = {});
  const place = (k, lx, lz, yawL, y0) => {
    if (MAXN[k] && (count[k] || 0) >= MAXN[k]) return null;
    const [x, z] = F.W(lx, lz), p = put(k, x, z, F.yaw(yawL), y0, col(k), 0, true, H);
    if (p) count[k] = (count[k] || 0) + 1; return p;
  };
  const used = [];
  const far = (x, z, d) => used.every(([ux, uz, ud]) => (ux - x) ** 2 + (uz - z) ** 2 > (d + ud) ** 2);
  // ---- an den Wänden ----
  const nF = Math.round((spec.nFloor ?? (R.x1 - R.x0) * (R.z1 - R.z0) / (spec.per || 14)) * mul);
  if (nF > 0 && spec.floor) {
    const cand = [], step = 0.7;
    for (let x = R.x0 + 0.35; x < R.x1 - 0.3; x += step) for (let z = R.z0 + 0.35; z < R.z1 - 0.3; z += step) {
      const jx = x + (rs() - 0.5) * 0.2, jz = z + (rs() - 0.5) * 0.2;
      if (hit(obst, jx, jz)) continue;
      let dir = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (hit(tall, jx + dx * 0.6, jz + dz * 0.6)) { if (hit(tall, jx - dx * 1.4, jz - dz * 1.4)) { dir = null; break; } dir = dir || [dx, dz]; }
      if (dir) cand.push([jx, jz, dir]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rs() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    let n = 0;
    for (const [x, z, [dx, dz]] of cand) {
      if (n >= nF) break;
      const k = pick(spec.floor), I = K[k]; if (!I) continue;
      const r = Math.max(I.he[0], I.he[2]) + 0.05;
      // ganz an die Wand rücken, Fuß frei, Boden darunter auf Raumhöhe
      const px = x + dx * (0.6 - r - 0.02) * 0.5, pz = z + dz * (0.6 - r - 0.02) * 0.5;
      if (!far(px, pz, r + 0.25)) continue;
      if ([[r, 0], [-r, 0], [0, r], [0, -r]].some(([ox, oz]) => hit(obst, px + ox, pz + oz))) continue;
      const sy = surface(F, B, px, pz, fy + 0.3); if (Math.abs(sy - fy) > 0.15) continue;
      const yaw = Math.atan2(-dx, -dz) + (spec.loose ? rs() * 6.28 : (rs() - 0.5) * 0.35);
      if (place(k, px, pz, yaw, sy)) { used.push([px, pz, r]); n++; }
    }
  }
  // ---- auf Tischen: seeds = [x, z, Oberkante, Radius] (exact: Höhe vertrauen, sonst prüfen) ----
  if (spec.table && spec.seeds) for (const [sx, sz] of spec.seeds) used.push([sx, sz, 0.06]);   // dort steht schon etwas (Lampe, lose Dinge der Gruppe)
  if (spec.table && spec.seeds) for (const [sx, sz, top, rad, exact] of spec.seeds) {
    const TB = exact ? null : F.boxes(sx - rad - 0.5, sx + rad + 0.5, sz - rad - 0.5, sz + rad + 0.5);
    const m = spec.perTable ?? 2;
    for (let t = 0, n = 0; t < 6 && n < m; t++) {
      if (rs() > mul) continue;
      const a = rs() * 6.28, d = rad * (0.35 + rs() * 0.55), x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d;
      const k = pick(spec.table), I = K[k]; if (!I) continue;
      const r = Math.max(I.he[0], I.he[2]);
      if (d + r * 0.6 > rad || !far(x, z, r * 0.8)) continue;
      if (spec.busy && spec.busy.some(([bx, bz, br]) => (bx - x) ** 2 + (bz - z) ** 2 < (br + r) ** 2)) continue;
      let y = top;
      if (!exact) { y = surface(F, TB, x, z, top + 0.15); if (Math.abs(y - top) > 0.09) continue; }
      if (place(k, x, z, rs() * 6.28, y)) { used.push([x, z, r]); n++; }
    }
  }
}
// Tischflächen aus den losen Dingen der Gruppen (physics.SPAWNS: up = Höhe der Fläche über dem Boden)
// (up enthält etwas Spielraum: die wirkliche Oberkante wird unter dem Punkt gesucht; F, loc: Bezugssystem des Hauses)
function spawnSeeds(test, F, loc = (x, z) => [x, z]) {
  const out = [];
  for (const S of SPAWNS) { if (!test(S)) continue; const fl = S.floor || 0;
    for (const it of S.items) { const up = it[4]; if (!(typeof up === 'number' && up > 0.3)) continue;
      const [lx, lz] = loc(it[1], it[2]), y = surface(F, F.boxes(lx - 0.2, lx + 0.2, lz - 0.2, lz + 0.2), lx, lz, fl + up + 0.3);
      if (y > fl + 0.3 && y < fl + 1.8) out.push([lx, lz, y, 0.45]); } }
  return out;
}

function indoors(put, K, rs, col, pick) {
  const fur = (H, F, R, spec) => furnish(put, K, rs, col, pick, H, F, R, spec);
  /* ---------- Belmont: Lobby und Ballsaal ---------- */
  { const P = BI.P, H = clutterHouse('Belmont', -48, 48, -48, 48, 0, 26, 28), S0 = P + 1.3;
    // Lobby: an den Wänden Gepäck, Golftaschen, Hocker, Schirmständer
    fur(H, WORLD, { x0: -47.5, x1: 47.5, z0: -3.6, z1: 47.5, y: P }, { per: 40, floor: [['suitcase', 2], ['trunk', 1], ['hatbox', 1.5], ['golfbag', 0.8], ['ottoman', 1.6], ['umbrellastand', 1], ['hatstand', 0.6], ['parcel', 0.4]],
      table: [['deskbell', 0.5], ['inkwell', 1], ['papers', 1], ['flowervase', 1], ['bookstack', 0.6], ['parcel', 0.3]], perTable: 1,
      seeds: [...Array.from({ length: 11 }, (_, i) => [-38.5, 12 + i * 2, P + 1.24, 0.4, true])] });   // Rezeption (Oberkante der Goldleiste)
    place1(put, H, 'deskbell', -38.5, 21.6, 0, P + 1.24); place1(put, H, 'deskbell', -38.5, 25.4, 0, P + 1.24);
    // runde Tische der Sitzgruppen (Platte 0,46 m)
    fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: P }, { table: [['servingtray', 1], ['ashtray', 1], ['flowervase', 1], ['papers', 1], ['cigarbox', 0.6], ['bookstack', 0.4], ['fruitbowl', 0.6]], perTable: 3,
      seeds: [[-16, 10, P + 0.455, 0.9, true], [16, 10, P + 0.455, 0.9, true], [-16, 34, P + 0.455, 0.9, true], [16, 34, P + 0.455, 0.9, true]] });
    // Ballsaal: Tische (Leinen 1,065 m), Lampe in der Mitte, Flasche bei (+0,35, +0,2)
    const tables = []; for (const sx of [-1, 1]) for (let z = -38; z <= -18; z += 5) for (const xo of [22, 27.5]) tables.push([sx * xo, z]);
    for (let x = -24; x <= 24; x += 6) if (Math.abs(x) > 2) tables.push([x, -16.2]);
    const busy = []; for (const [x, z] of tables) busy.push([x, z, 0.18], [x + 0.35, z + 0.2, 0.08]);
    fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: P }, { table: [['servingtray', 1], ['cakestand', 1.1], ['candelabra', 0.7], ['fruitbowl', 0.6], ['flowervase', 0.4], ['coupe', 1.2], ['champagne', 0.5], ['perfume', 0.15], ['cards', 0.2]], perTable: 2, busy,
      seeds: tables.map(([x, z]) => [x, z, P + 0.805, 0.85, true]) });
    // Galerietische (Platte ~0,81 m über der Galerie; Schalen bei (±0,3, ∓0,3), Blumen bei (-0,25, +0,1))
    const gb = []; for (const [x, , z] of GAL.tables) gb.push([x, z, 0.18], [x + 0.3, z - 0.3, 0.07], [x - 0.3, z + 0.3, 0.07], [x - 0.25, z + 0.1, 0.16]);
    fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: P }, { table: [['servingtray', 1], ['candelabra', 0.6], ['fruitbowl', 0.6], ['cakestand', 0.6], ['champagne', 0.5], ['cards', 0.3], ['cigarbox', 0.4]], perTable: 1, busy: gb,
      seeds: GAL.tables.map(([x, y, z]) => [x, z, y + 0.805, 0.6, true]) });
    // Ballsaal an den Wänden: Hocker, Sektkühler
    fur(H, WORLD, { x0: -47.5, x1: 47.5, z0: -47.5, z1: -6.4, y: P }, { per: 90, floor: [['ottoman', 2], ['icebucket', 0.5], ['hatbox', 0.4], ['umbrellastand', 0.3], ['musicstand', 0.2]] });
    // Bar unter der Westgalerie (Oberkante 1,24 m)
    fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: P }, { table: [['coupe', 2], ['decanter', 0.8], ['tumbler', 1], ['shaker', 0.8], ['champagne', 0.8], ['icebucket', 0.6], ['servingtray', 0.5]], perTable: 1,
      seeds: Array.from({ length: 10 }, (_, i) => [-44, -39 + i * 2.2, P + 1.24, 0.45, true]) });
    // Bühne: Notenständer vor den Bläsern, Saxophon und Trompete auf dem Boden, Mikrofon der Sängerin steht schon
    for (const x of [6.8, 9.3, 11.8]) place1(put, H, 'musicstand', x, -42.4, 0, S0);
    place1(put, H, 'saxophone', 13.6, -43.6, -0.4, S0); place1(put, H, 'trumpet', 6.0, -44.2, 0.6, S0); place1(put, H, 'musicstand', -7.2, -43.0, 0.5, S0);
    place1(put, H, 'microphone', -2.6, -41.0, 0, S0);
  }
  /* ---------- Penthouse (beide Ebenen, Mitte über dem Belmont) ---------- */
  { const H = clutterHouse('Penthouse', -21, 21, -21, 21, PH.F1 - 1, PH.TOP, 40), pent = S => S.pent;
    const seeds = spawnSeeds(pent, WORLD);
    fur(H, WORLD, { x0: -19.6, x1: 19.6, z0: -19.6, z1: 19.6, y: PH.F1 }, { per: 34, floor: [['ottoman', 0.7], ['golfbag', 0.5], ['bookstack', 0.4], ['shoes', 0.25], ['hatbox', 0.4], ['vase', 0.16], ['coalscuttle', 0.25], ['globe', 0.3], ['bust', 0.3], ['gramophone', 0.2], ['icebucket', 0.4], ['suitcase', 0.3]],
      table: [['bookstack', 0.5], ['airshipmodel', 1.2], ['perfume', 0.4], ['jewelbox', 0.5], ['fruitbowl', 0.6], ['candelabra', 0.5], ['inkwell', 0.5], ['cards', 0.4], ['servingtray', 0.4], ['deskbell', 0.1], ['bust', 0.2]],
      seeds: seeds.filter(s => s[2] < PH.F2 - 0.5), perTable: 1 });
    fur(H, WORLD, { x0: -19.6, x1: 19.6, z0: -19.6, z1: 19.6, y: PH.F2 }, { per: 34, floor: [['ottoman', 0.6], ['shoes', 0.7], ['hatbox', 0.7], ['suitcase', 0.5], ['bookstack', 0.8], ['towels', 0.4], ['laundrybasket', 0.2]],
      table: [['perfume', 1], ['jewelbox', 1], ['bookstack', 0.8], ['flowervase', 0.5], ['candelabra', 0.4], ['fruitbowl', 0.3]],
      seeds: seeds.filter(s => s[2] >= PH.F2 - 0.5), perTable: 1 });
  }
  /* ---------- Villa: Raum für Raum ---------- */
  if (VILLA.boxes && VR.rooms.length) {
    const F = villaFrame(), c = [[-56, -26], [56, -26], [-56, 10], [56, 10]].map(([a, b]) => F.W(a, b));
    const H = clutterHouse('Villa', Math.min(...c.map(q => q[0])), Math.max(...c.map(q => q[0])), Math.min(...c.map(q => q[1])), Math.max(...c.map(q => q[1])), VR.by - 6, VR.by + 22, 45);
    // Tischflächen der Villa (lokal): aus den losen Dingen (welt -> lokal)
    const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry), loc = (x, z) => { const dx = x - VILLA.x, dz = z - VILLA.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; };
    const seeds = spawnSeeds(S => S.y0 != null && Math.abs(S.y0 - (VR.by - 30)) < 1, F, loc);
    const SPEC = {
      'Eingangshalle': { per: 39, floor: [['golfbag', 1], ['suitcase', 1], ['umbrellastand', 0.6], ['ottoman', 1], ['vase', 0.32], ['parcel', 0.4]], table: [['flowervase', 1], ['papers', 0.6], ['candelabra', 0.6]] },
      'Salon': { per: 24, floor: [['ottoman', 1], ['bookstack', 0.8], ['coalscuttle', 0.6], ['vase', 0.2], ['globe', 0.3]], table: [['bookstack', 1], ['candelabra', 0.8], ['fruitbowl', 0.6], ['cards', 0.6], ['servingtray', 0.5], ['jewelbox', 0.3]] },
      'Herrenzimmer': { per: 24, floor: [['golfbag', 1], ['coalscuttle', 0.6], ['ottoman', 0.6], ['bottlecrate', 0.3]], table: [['cards', 1], ['cigarbox', 0.8], ['ashtray', 0.8], ['decanter', 0.5], ['tumbler', 1], ['bookstack', 0.4]] },
      'Speisesaal': { per: 33, floor: [['icebucket', 0.3], ['ottoman', 0.5], ['vase', 0.24]], table: [['candelabra', 1], ['fruitbowl', 1], ['cakestand', 0.8], ['servingtray', 0.6], ['flowervase', 0.4]] },
      'Küche': { per: 12, floor: [['milkcrate', 1], ['firewood', 1], ['coalscuttle', 0.6], ['bucket', 0.8], ['stool', 1], ['sack', 0.8], ['fruitcrate', 1], ['laundrybasket', 0.4], ['broom', 0.5]], table: [['fruitbowl', 1], ['teatray', 0.8], ['bookstack', 0.3], ['beermug', 0.2]] },
      'Ballsaal': { per: 45, floor: [['ottoman', 1.5], ['microphone', 0.3], ['musicstand', 0.6], ['icebucket', 0.3], ['saxophone', 0.2]] },
      'Galerie': { per: 30, floor: [['ottoman', 1], ['vase', 0.4], ['bust', 0.4]] },
      'Arbeitszimmer': { per: 14, floor: [['bookstack', 1.2], ['globe', 0.6], ['parcel', 0.4], ['ottoman', 0.4]], table: [['inkwell', 1], ['airshipmodel', 1], ['bookstack', 1], ['deskbell', 0.2]] },
      'Bibliothek': { per: 10, floor: [['bookstack', 2], ['globe', 0.5], ['ottoman', 0.6], ['bust', 0.4]], table: [['bookstack', 1.5], ['candelabra', 0.6], ['inkwell', 0.4]] },
      'Wintergarten': { per: 12, floor: [['wateringcan', 1], ['flowerpot', 1.5], ['vase', 0.32], ['deckchair', 0.5], ['birdcage', 0.3], ['ottoman', 0.4]], table: [['flowervase', 1], ['teatray', 0.6], ['fruitbowl', 0.6]] },
      'Schlafzimmer': { per: 18, floor: [['shoes', 1.2], ['hatbox', 1], ['suitcase', 0.6], ['ottoman', 0.8], ['towels', 0.3], ['bookstack', 0.4]], table: [['perfume', 1], ['jewelbox', 1], ['bookstack', 0.6], ['flowervase', 0.4]] },
      'Badezimmer': { per: 14, floor: [['towels', 1.2], ['laundrybasket', 0.8], ['stool', 0.4]], table: [['perfume', 1], ['towels', 0.6]] },
      'Ankleidezimmer': { per: 9, floor: [['shoes', 2], ['hatbox', 1.4], ['suitcase', 0.8], ['trunk', 0.5], ['golfbag', 0.4], ['hatstand', 0.4]], table: [['jewelbox', 1], ['perfume', 1]] },
      'Dienstbotenküche': { per: 9, floor: [['milkcrate', 1], ['firewood', 1], ['bucket', 1], ['stool', 1.2], ['sack', 0.8], ['washtub', 0.4], ['broom', 0.8], ['fruitcrate', 0.8]], table: [['beermug', 0.8], ['teatray', 0.6], ['cards', 0.5], ['fruitbowl', 0.3]] },
      _keller: { per: 10, floor: [['laundrybasket', 1], ['washtub', 0.6], ['broom', 1], ['bucket', 1], ['milkcrate', 0.6], ['firewood', 1], ['coalscuttle', 0.6], ['stool', 0.8], ['winecrate', 1], ['bottlecrate', 0.8], ['crate', 0.8], ['sack', 0.6], ['paintcan', 0.4]] },
      _og: { per: 21, floor: [['suitcase', 1], ['hatbox', 1], ['towels', 0.6], ['shoes', 0.6], ['ottoman', 0.8], ['vase', 0.24]], table: [['flowervase', 1], ['bookstack', 0.8], ['perfume', 0.4]] },
    };
    for (const r of VR.rooms) {
      const spec = SPEC[r.name] || (r.y < 0 ? SPEC._keller : r.y > 1 ? SPEC._og : null); if (!spec) continue;
      const fy = VR.by + r.y, rs2 = seeds.filter(s => s[0] > r.x0 && s[0] < r.x1 && s[1] > r.z0 && s[1] < r.z1 && s[2] > fy + 0.3 && s[2] < fy + 1.8);
      fur(H, F, { x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y: fy }, { ...spec, seeds: rs2, perTable: 1 });
    }
  }
  /* ---------- Lokale: Brass Lantern, Restaurant Aurora, Café ---------- */
  for (const V of VENUES) {
    if (V.kind === 'theater') continue;
    const pub = V.kind === 'bar', F = V.F || 0.3, H = clutterHouse(V.name || 'Lokal', V.x0, V.x1, V.z0, V.z1, F - 1, F + 6, 30);
    const tseeds = V.tables.map(t => [t.x, t.z, F + 0.76, pub ? 0.36 : 0.48]), busy = V.tables.map(t => [t.x, t.z, 0.1]);
    const cseeds = V.counter ? Array.from({ length: Math.max(1, Math.floor((V.counter.z1 - V.counter.z0) / 1.3)) }, (_, i) => [V.counter.x, V.counter.z0 + 0.6 + i * 1.3, V.counter.y, 0.3]) : [];
    if (pub) {
      fur(H, WORLD, { x0: V.x0 + 0.3, x1: V.x1 - 0.3, z0: V.z0 + 0.3, z1: V.z1 - 0.3, y: F }, { per: 9, floor: [['stool', 1.4], ['bottlecrate', 1], ['firewood', 0.8], ['coalscuttle', 0.5], ['broom', 0.2], ['bucket', 0.5], ['newsbundle', 0.4], ['barrel', 0.3]],
        table: [['beermug', 2.2], ['cards', 0.8], ['ashtray', 0.6], ['newsbundle', 0.1], ['papers', 0.4]], seeds: tseeds, perTable: 2, busy });
      fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: F }, { table: [['beermug', 2], ['tumbler', 0.6], ['ashtray', 0.4]], seeds: cseeds, perTable: 1 });
    } else {
      fur(H, WORLD, { x0: V.x0 + 0.3, x1: V.x1 - 0.3, z0: V.z0 + 0.3, z1: V.z1 - 0.3, y: F }, { per: 20, floor: [['icebucket', 0.4], ['umbrellastand', 0.6], ['hatstand', 0.5], ['vase', 0.24], ['ottoman', 0.4]],
        table: V.cafe ? [['cakestand', 1], ['flowervase', 0.6], ['fruitbowl', 0.4], ['papers', 0.6], ['teatray', 0.5]] : [['candelabra', 0.6], ['flowervase', 0.6], ['fruitbowl', 0.4], ['icebucket', 0.4], ['servingtray', 0.4]], seeds: tseeds, perTable: 1, busy });
      fur(H, WORLD, { x0: 0, x1: 0, z0: 0, z1: 0, y: F }, { table: [['cakestand', 0.6], ['fruitbowl', 0.6], ['servingtray', 0.6], ['coupe', 0.8]], seeds: cseeds, perTable: 1 });
    }
  }
  /* ---------- Bank und Varieté ---------- */
  const Bk = ORTE.bank;
  if (Bk) { const H = clutterHouse('Bank', Bk.x0, Bk.x1, Bk.z0, Bk.z1, (Bk.F || 0) - 1, (Bk.F || 0) + (Bk.H || 8), 25);
    fur(H, WORLD, { x0: Bk.x0 + 0.3, x1: Bk.x1 - 0.3, z0: Bk.z0 + 0.3, z1: Bk.z1 - 0.3, y: Bk.F || 0.3 }, { per: 26, floor: [['umbrellastand', 0.4], ['hatstand', 0.6], ['parcel', 0.8], ['bookstack', 0.5], ['newsbundle', 0.3], ['ottoman', 0.5], ['vase', 0.2]] }); }
  const Th = ORTE.theater;
  if (Th && Th.foyer) { const fo = Th.foyer, H = clutterHouse('Varieté', fo.x0, fo.x1, fo.z0, fo.z1, (Th.F || 0) - 1, (Th.F || 0) + 8, 25);
    fur(H, WORLD, { x0: fo.x0 + 0.3, x1: fo.x1 - 0.3, z0: fo.z0 + 0.3, z1: fo.z1 - 0.3, y: Th.F || 0.3 }, { per: 16, floor: [['umbrellastand', 1], ['hatstand', 1], ['ottoman', 1], ['icebucket', 0.6], ['hatbox', 0.4], ['vase', 0.2]] }); }
}
// einzelnes Ding an fester Stelle in einem Haus (Welt)
function place1(put, H, k, x, z, yaw, y0) { return put(k, x, z, yaw, y0, null, 0, true, H); }
