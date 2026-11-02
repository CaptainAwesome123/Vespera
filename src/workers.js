import { T, scene, mulberry32, shared, MOBILE, canvasTex } from './core.js';
import { stdMat, addCollider } from './people-skeleton.js';
import { registerLayer } from './chunks.js';
import { addGlow, addSeg, lamps, trees, glowPts, steamPts, segs, roofs } from './facade-shader.js';
import { kit, Bx, benchGeo } from './harbour.js';
import { wantTexture } from './assets.js';
import { lathe, roundBox } from './entrances.js';
import { blocks } from './island.js';
import { WORKWEAR, SHIRTS, COATS, STREET } from './serpentine.js';
import { addLight } from './performance.js';
import { VENUE_PEDS, signBoard } from './venues.js';
import { tearWrap } from './tear.js';

/* =====================================================================
   V46 · ARBEITERVIERTEL: Leben in den Backsteinvierteln am Rand des Kraters
   - Wäscheleinen quer über die Gassen der Arbeiterblöcke, Fallrohre und Dampfleitungen an den Wänden,
     Kisten, Fässer, Mülltonnen und Kohlensäcke (Chunk-Schicht 'arbeiter', nur in der Nähe gebaut)
   - Feuertonnen an Straßenecken, um die sich Arbeiter die Hände wärmen
   - Der Kneipenplatz: The Brass Lantern (innen in venues.js) mit Wohnungen darüber, daneben eine Autowerkstatt
     mit offenem Tor, zwei Mietshäuser mit eiserner Feuertreppe, Kopfsteinpflaster, Pumpe, Zeitungskiosk
   Alles mit eigenem Zufall (mulberry32): die übrige Stadt bleibt Stein für Stein, wie sie war.
   Keine neuen Shader außer dem Backstein (Standardmaterial mit Fototextur); Menschen nur über VENUE_PEDS.
   ===================================================================== */
export const WORK = { alleys: [], square: null, braziers: [], segIdx: null, mats: null };
export const WORK_CELL = 250, WORK_RADIUS = 300;

// Planung während des Stadtaufbaus (shops.js buildBlock): eine Gasse zwischen zwei Arbeiterhäusern
export function planWorkerAlley(x, z0, z1, Hc, b) {
  if (shared.SINK) return;   // Fabrikblöcke werden erst ohne Wirkung gebaut und dann ersetzt
  const rr = mulberry32(((x * 73.13) | 0) ^ ((z0 * 19.7) | 0) ^ 0x5eed);
  const A = { x, z0, z1, H: Hc, rr: rr(), lo: 4.6, hi: Math.min(9.2, Hc * 0.7 - 1.2), lines: null };
  WORK.alleys.push(A);
  // Kisten, Fässer, Tonnen an den Wänden (Kollision gleich hier, damit sie nicht doppelt entsteht)
  A.props = [];
  for (let z = z0 + 2.5; z < z1 - 2; z += 3 + rr() * 6) {
    if (rr() < 0.45) continue;
    const side = rr() < 0.5 ? -1 : 1, kind = rr() < 0.35 ? 'crates' : rr() < 0.55 ? 'barrel' : rr() < 0.75 ? 'bin' : 'coal';
    const px = x + side * (1.85 - rr() * 0.2);
    A.props.push({ kind, x: px, z, a: rr() * 6.28, n: 1 + Math.floor(rr() * 3) });
    addCollider(px - 0.4, 0.2, z - 0.4, px + 0.4, kind === 'crates' ? 1.4 : 1.1, z + 0.4);
  }
  // Dampf aus einem Gitter unter der Dampfleitung
  if (rr() < 0.5) steamPts.push({ x: x + (rr() < 0.5 ? -1.6 : 1.6), z: z0 + 4 + rr() * (z1 - z0 - 8) });
}

/* ---------- Materialien: Backstein mit Fotozeichnung (three.js-Beispiel, MIT), Rest aus dem Bausatz (harbour.js) ---------- */
export function workMats() {
  if (WORK.mats) return WORK.mats;
  const brick = wantTexture(stdMat({ vertexColors: true, color: 0x8a5040, roughness: 0.92, envI: 0.25 }), { map: 'brick-color', bumpMap: 'brick-bump', bumpScale: 0.04, repeat: [1.6, 1.6], color: 0xe2d6cc });
  return WORK.mats = { brick };
}

/* ---------- Wäsche, Rohre, Kram: Teile für den Bausatz ---------- */
const LAUNDRY = [[0.86, 0.84, 0.78], [0.9, 0.88, 0.82], [0.78, 0.76, 0.7], [0.52, 0.6, 0.74], [0.6, 0.27, 0.24], [0.2, 0.26, 0.4], [0.62, 0.6, 0.55], [0.74, 0.66, 0.5], [0.34, 0.4, 0.3]];
// Ein Wäschestück hängt am Punkt (x, y, z) der Leine (Leine läuft in x)
function garment(K, rr, x, y, z, kind) {
  const c = LAUNDRY[Math.floor(rr() * LAUNDRY.length)], tilt = (rr() - 0.5) * 0.12, wob = (rr() - 0.5) * 0.25;
  const P = (w, h, dx = 0, dy = 0) => K.add('cloth', new T.PlaneGeometry(w, h).translate(dx, -h / 2 + dy, 0).rotateX(tilt).rotateY(wob).translate(x, y, z), c);
  if (kind === 0) { const w = 0.9 + rr() * 0.5, h = 1.0 + rr() * 0.5; P(w, h); return w; }            // Laken
  if (kind === 1) { P(0.5, 0.72); for (const s of [-1, 1]) P(0.18, 0.42, s * 0.33, -0.02); return 0.86; }   // Hemd mit Ärmeln
  if (kind === 2) { for (const s of [-1, 1]) P(0.2, 0.9, s * 0.13); P(0.46, 0.18); return 0.5; }          // Hose
  if (kind === 3) { P(0.28, 0.36); return 0.32; }                                                          // Handtuch, Socken
  const w = 0.55 + rr() * 0.2; P(w, 0.5 + rr() * 0.2); return w;                                           // Kleid, Schürze
}
function crateStack(K, x, z, a, n, y0 = 0.22) {
  for (let k = 0; k < n; k++) {
    const s = 0.55 + (k % 2) * 0.05, ox = (k === 2 ? 0.32 : 0), yy = y0 + (k === 1 ? 0.6 : 0) + s / 2;
    K.add('plank', new T.BoxGeometry(s, s, s).rotateY(a + k * 0.3).translate(x + ox * Math.cos(a), yy, z + ox * Math.sin(a)), [0.62, 0.48, 0.34]);
    K.add('iron', new T.BoxGeometry(s + 0.02, 0.05, s + 0.02).rotateY(a + k * 0.3).translate(x + ox * Math.cos(a), yy, z + ox * Math.sin(a)), [1, 1, 1]);
  }
}
function barrel(K, x, z, y0 = 0.22, wood = true) {
  K.add(wood ? 'plank' : 'paint', lathe([[0.26, 0], [0.31, 0.25], [0.33, 0.45], [0.31, 0.65], [0.26, 0.9], [0, 0.9]], 14).translate(x, y0, z), wood ? [0.5, 0.34, 0.22] : [0.18, 0.24, 0.2]);
  for (const h of [0.12, 0.78]) K.add('iron', new T.CylinderGeometry(0.3, 0.3, 0.05, 14, 1, true).translate(x, y0 + h, z));
}
function bin(K, x, z, y0 = 0.22) {
  K.add('iron', new T.CylinderGeometry(0.27, 0.24, 0.8, 12).translate(x, y0 + 0.4, z), [0.9, 0.92, 0.95]);
  K.add('iron', new T.CylinderGeometry(0.3, 0.3, 0.06, 12).translate(x, y0 + 0.83, z), [0.9, 0.92, 0.95]);
}
function coal(K, x, z, a, n, y0 = 0.22) {
  for (let k = 0; k < n; k++) K.add('cloth', new T.SphereGeometry(0.3, 8, 6).scale(1.1, 0.75, 0.8).rotateY(a + k).translate(x + Math.cos(a + k * 2) * 0.35 * k, y0 + 0.2 + (k === 2 ? 0.32 : 0), z + Math.sin(a + k * 2) * 0.35 * k), [0.35, 0.3, 0.22]);
}
// Feuertonne: Ölfass mit Lochreihen, Glut, Funkenlicht
export function brazierGeo(K, x, z, y0 = 0.22) {
  K.add('paint', new T.CylinderGeometry(0.3, 0.3, 0.86, 14, 1, true).translate(x, y0 + 0.43, z), [0.2, 0.14, 0.1]);
  for (const h of [0.08, 0.5, 0.84]) K.add('iron', new T.TorusGeometry(0.305, 0.02, 4, 16).rotateX(Math.PI / 2).translate(x, y0 + h, z));
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.28; K.add('lit', new T.CircleGeometry(0.04, 6).rotateY(Math.PI / 2 - a).translate(x + Math.cos(a) * 0.307, y0 + 0.3, z - Math.sin(a) * 0.307), [1.8, 0.7, 0.2]); }
  K.add('lit', new T.CylinderGeometry(0.27, 0.27, 0.04, 14).translate(x, y0 + 0.8, z), [1.9, 0.75, 0.22]);
  for (let k = 0; k < 5; k++) { const a = k * 1.3; K.add('lit', new T.ConeGeometry(0.08 + (k % 2) * 0.04, 0.3 + (k % 3) * 0.12, 5).translate(x + Math.cos(a) * 0.12, y0 + 0.95 + (k % 3) * 0.04, z + Math.sin(a) * 0.12), [2.0, 0.95 - k * 0.08, 0.25]); }
  addGlow(x, y0 + 1.15, z, [1.5, 0.6, 0.18], 1.6, Math.random(), 0);
  addGlow(x, y0 + 0.9, z, [1.6, 0.8, 0.3], 0.8, Math.random(), 0);
  addLight(0xff8a3a, 1.5, 8, 1.8, x, y0 + 1.3, z);
  steamPts.push({ x, z });   // Rauch
  addCollider(x - 0.32, y0, z - 0.32, x + 0.32, y0 + 0.9, z + 0.32);
}
// Leute um eine Feuertonne: wärmen sich die Hände (8), trinken (15), lehnen und rauchen (36)
function brazierPeople(x, z, y0, rr, n) {
  for (let k = 0; k < n; k++) {
    const a = rr() * 6.28 / n + k * 6.28 / n, r = 0.95 + rr() * 0.2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r, kind = rr() < 0.75 ? 'worker' : rr() < 0.6 ? 'coat' : 'sailor';
    const act = rr() < 0.6 ? 8 + 0.3 + rr() * 0.4 : rr() < 0.6 ? 15.3 + rr() * 0.4 : 0.3 + rr() * 0.4;
    VENUE_PEDS.push({ st: 4, x: px, y: y0, z: pz, yaw: Math.atan2(x - px, z - pz), sc: 0.95 + rr() * 0.1, v: 0, kind, col: kind === 'worker' ? (rr() < 0.5 ? WORKWEAR : SHIRTS)[Math.floor(rr() * 4)] : COATS[Math.floor(rr() * COATS.length)], act });
  }
}

/* ---------- Der Kneipenplatz ---------- */
// Sucht den Park in den Arbeiterblöcken nahe (165, -735) und macht daraus den Platz; gibt die Lage der Kneipe zurück
export function buildWorkersQuarter() {
  const cand = blocks.filter(b => b.park && b.d > 650 && (b.z0 + b.z1) / 2 < 420 && (b.x0 + b.x1) / 2 < 650 && b.x1 - b.x0 > 80 && b.z1 - b.z0 > 50);
  if (!cand.length) return null;
  cand.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - 165, (a.z0 + a.z1) / 2 + 735) - Math.hypot((b.x0 + b.x1) / 2 - 165, (b.z0 + b.z1) / 2 + 735));
  const b = cand[0];
  b.park = false; b.square = true;
  // Parkbäume und die Lichter der Parkwege heraus
  const inB = (x, z) => x > b.x0 + 3 && x < b.x1 - 3 && z > b.z0 + 3 && z < b.z1 - 3;
  for (let i = trees.length - 1; i >= 0; i--) if (inB(trees[i].x, trees[i].z)) trees.splice(i, 1);
  for (let i = glowPts.length - 1; i >= 0; i--) if (inB(glowPts[i].p[0], glowPts[i].p[2]) && Math.abs(glowPts[i].p[1] - 3.2) < 0.01) glowPts.splice(i, 1);
  const rr = mulberry32(44044), X = b.x0 + 4.5, Z = b.z0 + 4.5, X1 = b.x1 - 4.5, Z1 = b.z1 - 4.5, y0 = 0.22;
  const S = WORK.square = { b, X, Z, X1, Z1, pub: { x: X + 23, z: Z + 8, w: 24, d: 15 } };
  const K = kit(workMats()), cols = [];
  const BR = [[0.46, 0.27, 0.2], [0.38, 0.24, 0.2], [0.5, 0.3, 0.22], [0.42, 0.25, 0.19]];
  // --- Wohnungen über der Kneipe (Fassaden-Shader, zwei Geschosse) und die Mietshäuser links und rechts
  const P = S.pub, PH = 0.3 + 5.2 + 0.6;
  addSeg({ x: P.x, z: P.z, w: P.w + 0.36, d: P.d + 0.36, y0: PH, y1: PH + 7.4, tint: BR[0], seed: 441, style: 0, dens: 0.48, flood: 0 }, true);
  roofs.push({ x: P.x, z: P.z, w: P.w, d: P.d, H: PH + 7.4, worker: true, dist: b.d, edges: { n: true }, fw: P.w, fd: P.d, fx: P.x, fz: P.z, shop: false, arcade: false });
  const tA = { x: X + 4, z: Z + 12, w: 8, d: 24, H: 18.2 }, tB = { x: X1 - 8.5, z: Z + 13, w: 17, d: 26, H: 14.6 };
  for (const [t, c, sd] of [[tA, BR[1], 442], [tB, BR[2], 443]]) {
    addSeg({ x: t.x, z: t.z, w: t.w, d: t.d, y0: 0.2, y1: t.H, tint: c, seed: sd, style: 0, dens: 0.42, flood: 0 }, true);
    addSeg({ x: t.x, z: t.z, w: t.w + 0.5, d: t.d + 0.5, y0: t.H, y1: t.H + 0.45, tint: c.map(v => v * 0.85), seed: sd + 1, style: 3, dens: 0, flood: 0 }, false);
    roofs.push({ x: t.x, z: t.z, w: t.w, d: t.d, H: t.H + 0.45, worker: true, dist: b.d, edges: { n: true, s: true }, fw: t.w, fd: t.d, fx: t.x, fz: t.z, shop: false, arcade: false });
  }
  // Haustüren der Mietshäuser zum Platz (Holz, Oberlicht, Lampe)
  for (const [dx, dz, nx] of [[tA.x + tA.w / 2, tA.z + 6, 1], [tB.x - tB.w / 2, tB.z + 4, -1]]) {
    K.add('plank', Bx(0.12, 2.3, 1.3, dx + nx * 0.06, y0 + 1.15, dz, 1), [0.24, 0.16, 0.1]);
    K.add('stone', Bx(0.3, 0.25, 1.9, dx + nx * 0.12, y0 + 2.45, dz, 1), [0.6, 0.55, 0.5]);
    K.add('lit', new T.PlaneGeometry(1.1, 0.35).rotateY(nx * Math.PI / 2).translate(dx + nx * 0.13, y0 + 2.62, dz), [1.5, 1.0, 0.55]);
    K.add('stone', Bx(0.8, 0.18, 1.8, dx + nx * 0.4, y0 + 0.09, dz, 1), [0.55, 0.53, 0.5]);
    K.add('iron', new T.CylinderGeometry(0.02, 0.02, 0.5, 6).rotateZ(Math.PI / 2).translate(dx + nx * 0.25, y0 + 2.9, dz + 1.1));
    K.add('lit', new T.SphereGeometry(0.11, 8, 6).translate(dx + nx * 0.45, y0 + 2.8, dz + 1.1), [1.6, 1.1, 0.6]);
    addGlow(dx + nx * 0.5, y0 + 2.8, dz + 1.1, [1.3, 0.8, 0.4], 0.9);
  }
  // Eiserne Feuertreppe am rechten Mietshaus (Westwand zum Platz): Podeste je Geschoss, Läufe im Zickzack, Geländer
  { const fx = tB.x - tB.w / 2 - 0.65, zc = tB.z + 4;
    for (let f = 1; f * 3.6 + 0.4 < tB.H - 1; f++) {
      const y = f * 3.6 + 0.4;
      K.add('iron', Bx(1.2, 0.06, 4.2, fx, y, zc, 1));
      K.add('iron', Bx(0.04, 0.04, 4.2, fx - 0.58, y + 0.95, zc, 1)); K.add('iron', Bx(0.04, 0.04, 4.2, fx - 0.58, y + 0.5, zc, 1));
      for (let k = -2; k <= 2; k++) K.add('iron', Bx(0.03, 0.95, 0.03, fx - 0.58, y + 0.48, zc + k * 1.0, 1));
      for (const s of [-1, 1]) K.add('iron', Bx(1.2, 0.04, 0.04, fx, y + 0.95, zc + s * 2.08, 1));
      if (f > 1) { const L = Math.hypot(3.2, 3.6), a = Math.atan2(3.6, 3.2), dir = f % 2 ? 1 : -1;
        K.add('iron', new T.BoxGeometry(0.7, 0.05, L).rotateX(dir * a).translate(fx + 0.12, y - 1.8, zc));
        for (const s of [-1, 1]) K.add('iron', new T.BoxGeometry(0.04, 0.04, L).rotateX(dir * a).translate(fx + 0.12 + s * 0.36, y - 0.9, zc)); }
    }
    // Leiter vom untersten Podest (hochgezogen)
    for (const s of [-1, 1]) K.add('iron', Bx(0.04, 2.4, 0.04, fx - 0.4, 4.0 - 1.2 + 0.4, zc + 1.6 + s * 0.22, 1));
    for (let k = 0; k < 7; k++) K.add('iron', Bx(0.03, 0.03, 0.44, fx - 0.4, 2.0 + k * 0.33, zc + 1.6, 1));
  }
  // --- Werkstatt: Backsteinhalle mit offenem Tor zum Platz, darüber zwei Wohngeschosse
  const W = S.shop = { x0: X + 38.5, x1: X + 58.5, z0: Z + 0.5, z1: Z + 14.5, h: 5.2 };
  { const { x0, x1, z0, z1, h } = W, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, th = 0.36, bc = [0.95, 0.88, 0.84];
    const wall = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), along = Math.abs(bx - ax) > 0.01; K.add('brick', Bx(along ? L : th, h, along ? th : L, (ax + bx) / 2, y0 + h / 2, (az + bz) / 2), bc); addCollider(Math.min(ax, bx) - (along ? 0 : th / 2), y0, Math.min(az, bz) - (along ? th / 2 : 0), Math.max(ax, bx) + (along ? 0 : th / 2), y0 + h, Math.max(az, bz) + (along ? th / 2 : 0)); };
    wall(x0, z0, x1, z0); wall(x0, z0, x0, z1); wall(x1, z0, x1, z1);
    // Front: zwei Pfeiler, Sturz über dem 7 m breiten Tor, Fensterband daneben
    const gate = [cx - 3.5, cx + 3.5];
    wall(x0, z1, gate[0], z1); wall(gate[1], z1, x1, z1);
    K.add('brick', Bx(7.0, h - 4.3, th, cx, y0 + 4.3 + (h - 4.3) / 2, z1, 2), bc);
    K.add('iron', Bx(7.2, 0.25, 0.42, cx, y0 + 4.2, z1, 1));
    for (const s of [-1, 1]) { const gx = cx + s * 6.2; K.add('lit', new T.PlaneGeometry(3.3, 1.5).translate(gx, y0 + 2.6, z1 + 0.19), [0.72, 0.58, 0.4]); /* Milchglas, von innen beleuchtet */ for (let k = -1; k <= 1; k++) K.add('iron', Bx(0.05, 1.6, 0.05, gx + k * 1.13, y0 + 2.6, z1 + 0.2, 1)); K.add('iron', Bx(3.4, 0.05, 0.05, gx, y0 + 2.6, z1 + 0.2, 1)); }
    // offene Falttore an den Seiten des Tors
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) K.add('paint', Bx(0.06, 4.1, 0.85, cx + s * (3.45 - k * 0.07), y0 + 2.05, z1 + 0.5 + k * 0.82, 1).rotateY(0), [0.16, 0.24, 0.2]);
    K.add('stone', Bx(x1 - x0 + 0.7, 0.5, z1 - z0 + 0.7, cx, y0 + h + 0.25, cz, 3), [0.42, 0.26, 0.2]);
    K.add('ceil', Bx(x1 - x0 - 0.4, 0.1, z1 - z0 - 0.4, cx, y0 + h - 0.06, cz), [0.55, 0.5, 0.45]);
    K.add('stone', Bx(x1 - x0 - 0.1, 0.06, z1 - z0 - 0.1, cx, y0 + 0.03, cz, 2), [0.42, 0.42, 0.42]);   // Betonboden mit Ölflecken (dunkel)
    addSeg({ x: cx, z: cz, w: x1 - x0 + 0.36, d: z1 - z0 + 0.36, y0: y0 + h + 0.5, y1: y0 + h + 7.7, tint: BR[3], seed: 445, style: 0, dens: 0.4, flood: 0 }, false);
    roofs.push({ x: cx, z: cz, w: x1 - x0, d: z1 - z0, H: y0 + h + 7.7, worker: true, dist: b.d, edges: { n: true }, fw: x1 - x0, fd: z1 - z0, fx: cx, fz: cz, shop: false, arcade: false });
    // Schild über dem Tor
    const sg = signBoard('AUTOWERKSTATT · H. BRANDT', 6.6, 0.7, '#f3c56c', '#1a1410'); sg.position.set(cx, y0 + 4.75, z1 + 0.2); scene.add(sg);
    // innen: Hängelampen, Werkbank mit Schraubstock, Motor auf dem Bock, Reifenstapel, Ölfässer, Regal, Kettenzug
    for (const lx of [cx - 5, cx, cx + 5]) { K.add('iron', new T.CylinderGeometry(0.01, 0.01, 1.2, 4).translate(lx, y0 + h - 0.7, cz)); K.add('paint', new T.ConeGeometry(0.42, 0.3, 14, 1, true).translate(lx, y0 + h - 1.4, cz), [0.2, 0.32, 0.26]); K.add('lit', new T.CircleGeometry(0.2, 10).rotateX(Math.PI / 2).translate(lx, y0 + h - 1.5, cz), [2, 1.7, 1.2]); addGlow(lx, y0 + h - 1.6, cz, [1.3, 1.05, 0.7], 1.4); }
    addLight(0xffd29a, 1.8, 13, 1.6, cx, y0 + h - 1.8, cz);
    K.add('varnish', Bx(6, 0.08, 0.9, cx - 3, y0 + 0.92, z0 + 0.8, 1), [0.5, 0.36, 0.24]);
    for (const lx of [cx - 5.8, cx - 0.2]) K.add('iron', Bx(0.08, 0.9, 0.8, lx, y0 + 0.45, z0 + 0.8, 1));
    K.add('iron', Bx(0.25, 0.2, 0.22, cx - 1.2, y0 + 1.06, z0 + 0.95, 1)); K.add('iron', Bx(0.5, 0.06, 0.06, cx - 1.2, y0 + 1.12, z0 + 1.1, 1));
    K.add('plank', Bx(5.6, 1.4, 0.04, cx - 3, y0 + 1.9, z0 + 0.22, 1), [0.45, 0.4, 0.32]);   // Werkzeugwand
    for (let k = 0; k < 9; k++) K.add('iron', Bx(0.05, 0.3 + (k % 3) * 0.1, 0.03, cx - 5.4 + k * 0.6, y0 + 2.0, z0 + 0.26, 1));
    K.add('paint', roundBox(1.0, 0.7, 0.6, 0.08).translate(cx + 2.5, y0 + 1.1, cz - 1), [0.22, 0.24, 0.26]);   // Motorblock
    K.add('iron', Bx(0.9, 0.7, 0.5, cx + 2.5, y0 + 0.4, cz - 1, 1));
    for (let k = 0; k < 4; k++) K.add('cloth', new T.TorusGeometry(0.36, 0.12, 6, 14).rotateX(Math.PI / 2).translate(x1 - 1.2, y0 + 0.12 + k * 0.24, z0 + 1.4), [0.12, 0.12, 0.12]);
    for (let k = 0; k < 3; k++) barrel(K, x0 + 0.9, z0 + 1.2 + k * 0.75, y0, false);
    K.add('iron', Bx(0.12, h - 0.4, 0.12, cx + 2.5, y0 + (h - 0.4) / 2, cz + 2.5, 1)); K.add('iron', Bx(4, 0.2, 0.12, cx + 2.5, y0 + h - 0.5, cz + 2.5, 1));
    for (let k = 0; k < 12; k++) K.add('iron', new T.TorusGeometry(0.04, 0.012, 4, 6).rotateY(k * 1.57).translate(cx + 3.6, y0 + h - 0.7 - k * 0.09, cz + 2.5));
    // Schweißlicht: blauweißes Flackern an der Werkbank
    addGlow(cx - 4.2, y0 + 1.1, z0 + 1.1, [0.9, 1.2, 1.6], 0.7, 0.3, 1);
    VENUE_PEDS.push({ st: 4, x: cx - 3.2, y: y0, z: z0 + 1.6, yaw: Math.PI, sc: 1, v: 0, kind: 'worker', col: WORKWEAR[0], act: 25.4 });
    VENUE_PEDS.push({ st: 4, x: cx + 2.5, y: y0, z: cz - 0.15, yaw: Math.PI, sc: 1.02, v: 0, kind: 'worker', col: WORKWEAR[3], act: 4.4 });
    VENUE_PEDS.push({ st: 4, x: cx + 4.2, y: y0, z: z1 - 1.6, yaw: -0.4, sc: 0.98, v: 0, kind: 'worker', col: SHIRTS[2], act: 36.4 });
  }
  // --- der Platz: Kopfsteinpflaster (Material des Straßenbodens, in main.js nach buildGround), Pumpe, Kiosk, Bänke, Laternen
  const sq = { x0: X, x1: X1, z0: Z + 15.5, z1: Z1 };
  const bx = P.x - 1, bz = Z + 25;
  brazierGeo(K, bx, bz, y0); brazierPeople(bx, bz, y0, rr, 4);
  // Fässer als Stehtische vor der Kneipe, zwei Trinker
  for (const [ox, oz] of [[-7.5, 1.6], [7.5, 1.6]]) {
    const tx = P.x + ox, tz = Z + 15.5 + oz;
    tearWrap('stehfass:' + ox, { name: 'Stehtisch-Fass', m: 65, stuff: 'wood', kind: 'cyl' }, () => { barrel(K, tx, tz, y0); K.add('plank', new T.CylinderGeometry(0.42, 0.42, 0.05, 14).translate(tx, y0 + 0.93, tz), [0.42, 0.28, 0.18]); });   // V54: ausreißbar
    addCollider(tx - 0.4, y0, tz - 0.4, tx + 0.4, y0 + 0.95, tz + 0.4);
    VENUE_PEDS.push({ st: 4, x: tx + 0.62, y: y0, z: tz + 0.1, yaw: -Math.PI / 2, sc: 1, v: 0, kind: 'worker', col: SHIRTS[Math.floor(rr() * 5)], act: 15.4 + rr() * 0.4 });
    if (rr() < 0.7) VENUE_PEDS.push({ st: 4, x: tx - 0.6, y: y0, z: tz + 0.2, yaw: Math.PI / 2, sc: 0.98, v: 0, kind: rr() < 0.5 ? 'coat' : 'chauffeur', col: COATS[Math.floor(rr() * 4)], act: 0.3 + rr() * 0.4 });
  }
  // Raucher an der Kneipenwand
  VENUE_PEDS.push({ st: 4, x: P.x - 5.2, y: y0, z: Z + 15.95, yaw: 0, sc: 1, v: 0, kind: 'worker', col: WORKWEAR[2], act: 36.2 });
  // Schwengelpumpe mit Trog
  { const px = X + 45, pz = Z + 30;
    tearWrap('pumpe', { name: 'Schwengelpumpe', m: 140, stuff: 'metal', kind: 'cyl' }, () => {   // V54: ausreißbar (der Trog bleibt)
    K.add('iron', lathe([[0.12, 0], [0.1, 0.1], [0.08, 1.2], [0.11, 1.3], [0.06, 1.42], [0, 1.45]], 10).translate(px, y0, pz), [0.25, 0.4, 0.34]);
    K.add('iron', new T.CylinderGeometry(0.035, 0.03, 0.4, 6).rotateZ(Math.PI / 2).translate(px + 0.25, y0 + 1.0, pz), [0.25, 0.4, 0.34]);
    K.add('iron', new T.BoxGeometry(0.7, 0.04, 0.04).rotateZ(-0.35).translate(px - 0.3, y0 + 1.42, pz), [0.25, 0.4, 0.34]); });
    K.add('stone', Bx(1.6, 0.5, 0.7, px + 0.9, y0 + 0.25, pz, 1), [0.55, 0.53, 0.5]);
    K.add('glass', new T.PlaneGeometry(1.4, 0.5).rotateX(-Math.PI / 2).translate(px + 0.9, y0 + 0.42, pz));
    addCollider(px - 0.15, y0, pz - 0.35, px + 1.7, y0 + 0.5, pz + 0.35); addCollider(px - 0.13, y0, pz - 0.13, px + 0.13, y0 + 1.45, pz + 0.13);
  }
  // Zeitungskiosk: achteckig, grün gestrichen, beleuchtetes Fenster, Plakate
  { const kx = X1 - 12, kz = Z1 - 6;
    K.add('paint', new T.CylinderGeometry(1.15, 1.15, 2.4, 8).translate(kx, y0 + 1.2, kz), [0.12, 0.26, 0.2]);
    K.add('paint', new T.ConeGeometry(1.55, 0.9, 8).translate(kx, y0 + 2.85, kz), [0.1, 0.2, 0.16]);
    K.add('iron', new T.SphereGeometry(0.12, 8, 6).translate(kx, y0 + 3.35, kz), [1.4, 1.1, 0.6]);
    K.add('lit', new T.PlaneGeometry(1.1, 0.7).translate(kx, y0 + 1.55, kz + 1.08), [1.5, 1.15, 0.7]);
    K.add('plank', Bx(1.2, 0.06, 0.4, kx, y0 + 1.12, kz + 1.25, 1), [0.5, 0.36, 0.22]);
    for (let k = 0; k < 4; k++) K.add('cloth', new T.PlaneGeometry(0.22, 0.3).rotateX(-1.2).translate(kx - 0.45 + k * 0.3, y0 + 1.17, kz + 1.25), [0.86, 0.84, 0.76]);
    const post = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#d9cfb5'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1a14'; g.font = 'bold 34px Georgia, serif'; g.textAlign = 'center'; g.fillText('VESPERA', w / 2, 44); g.fillStyle = '#1a1a1a'; g.font = '20px Georgia, serif'; g.fillText('ABENDPOST · 10 PF.', w / 2, 80); g.fillText('Neues vom Kraterrand', w / 2, 108); });
    for (const a of [Math.PI * 0.75, -Math.PI * 0.75, Math.PI]) { const m = new T.Mesh(new T.PlaneGeometry(0.8, 0.4), new T.MeshBasicMaterial({ map: post, color: 0x9a9a92 })); m.position.set(kx + Math.sin(a) * 1.17, y0 + 1.8, kz + Math.cos(a) * 1.17); m.rotation.y = a; scene.add(m); }
    addGlow(kx, y0 + 1.5, kz + 1.3, [1.3, 0.95, 0.55], 1.0);
    addCollider(kx - 1.1, y0, kz - 1.1, kx + 1.1, y0 + 2.4, kz + 1.1);
    VENUE_PEDS.push({ st: 4, x: kx + 1.6, y: y0, z: kz + 1.0, yaw: -1.2, sc: 0.96, v: 0, kind: 'coat', col: COATS[2], act: 31.4 });
    VENUE_PEDS.push({ st: 4, x: kx - 0.2, y: y0, z: kz + 2.0, yaw: Math.PI, sc: 1.0, v: 0, kind: 'suit', col: COATS[4], act: 31.2 });
  }
  // Kisten und Handkarren vor der Werkstatt, zwei Packer
  tearWrap('kisten:a', { name: 'Kistenstapel', m: 48, stuff: 'wood' }, () => crateStack(K, W.x1 - 1.2, W.z1 + 2.4, 0.2, 3, y0)); tearWrap('kisten:b', { name: 'Kistenstapel', m: 32, stuff: 'wood' }, () => crateStack(K, W.x1 - 2.4, W.z1 + 3.4, 0.9, 2, y0));   // V54: ausreißbar
  addCollider(W.x1 - 3, y0, W.z1 + 1.8, W.x1 - 0.6, y0 + 1.3, W.z1 + 4);
  { const hx = W.x0 + 1.5, hz = W.z1 + 3;
    tearWrap('handkarren', { name: 'Handkarren', m: 45, stuff: 'wood' }, () => {   // V54: ausreißbar
    K.add('plank', Bx(1.0, 0.35, 1.6, hx, y0 + 0.75, hz, 1), [0.5, 0.38, 0.26]);
    for (const s of [-1, 1]) { K.add('plank', new T.TorusGeometry(0.42, 0.04, 5, 14).rotateY(Math.PI / 2).translate(hx + s * 0.56, y0 + 0.42, hz), [0.3, 0.2, 0.12]); K.add('plank', Bx(0.06, 0.06, 1.3, hx + s * 0.4, y0 + 0.62, hz - 1.3, 1).rotateX(0), [0.4, 0.3, 0.2]); }
    crateStack(K, hx, hz + 0.3, 0.1, 1, y0 + 0.92); });
    addCollider(hx - 0.6, y0, hz - 0.8, hx + 0.6, y0 + 1.3, hz + 0.8);
  }
  VENUE_PEDS.push({ st: 4, x: W.x1 - 1.8, y: y0, z: W.z1 + 1.5, yaw: Math.PI, sc: 1, v: 0, kind: 'worker', col: WORKWEAR[1], act: 27.3 });
  VENUE_PEDS.push({ st: 4, x: W.x0 + 2.6, y: y0, z: W.z1 + 4.4, yaw: -0.6, sc: 1, v: 0, kind: 'worker', col: SHIRTS[0], act: 24.4 });
  // Bänke unter zwei Laternen, ein Paar im Gespräch an der Haustür
  for (const bx of [X + 13, X + 33]) tearWrap('platzbank:' + bx, { name: 'Bank', m: 50, stuff: 'wood', seat: true }, () => benchGeo(K, 1.9, bx, y0, Z1 - 1.2, Math.PI, 'plank'));   // V54: ausreißbar
  lamps.push({ x: X + 9, z: Z1 - 1.6, h: 4.8 }, { x: X + 37, z: Z1 - 1.6, h: 4.8 }, { x: X + 62, z: Z + 20, h: 4.8 });
  VENUE_PEDS.push({ st: 4, x: tB.x - tB.w / 2 - 1.4, y: y0, z: tB.z + 6.0, yaw: Math.PI / 2 + 0.6, sc: 0.96, v: 0, kind: 'lady', col: [0.32, 0.26, 0.22], act: 0.4 });
  VENUE_PEDS.push({ st: 4, x: tB.x - tB.w / 2 - 2.3, y: y0, z: tB.z + 6.6, yaw: -Math.PI / 2 - 0.5, sc: 1, v: 0, kind: 'worker', col: WORKWEAR[0], act: 0.7 });
  // Gullys mit Dampf
  steamPts.push({ x: X + 30, z: Z + 36 }, { x: X + 55, z: Z + 40 }, { x: X + 9.5, z: Z + 5 });
  // Wäscheleinen in den Lücken zwischen den Häusern (wie die Gassen geprüft: nur wo beide Wände stehen)
  for (const [gx0, gx1, lo] of [[tA.x + tA.w / 2, P.x - P.w / 2 - 0.18, PH + 0.6], [P.x + P.w / 2 + 0.18, W.x0 - 0.18, PH + 0.6], [W.x1 + 0.18, tB.x - tB.w / 2, PH + 0.6]])
    WORK.alleys.push({ x: (gx0 + gx1) / 2, z0: Z + 1, z1: Z + 15, H: 13, lo, hi: Math.min(12.4, PH + 6.6), gap: true, props: [], rr: rr() });
  K.build(scene);
  // Braziers in den übrigen Arbeiterblöcken: an einer Ecke des Gehwegs, mit zwei bis drei Leuten
  const KB = kit(), rb = mulberry32(4404);
  for (const o of blocks) {
    if (o === b || !o.worker || o.factory || o.park || rb() > (MOBILE ? 0.08 : 0.16)) continue;
    const cx = rb() < 0.5 ? o.x0 + 2.6 : o.x1 - 2.6, cz = rb() < 0.5 ? o.z0 + 2.6 : o.z1 - 2.6;
    brazierGeo(KB, cx, cz, y0); brazierPeople(cx, cz, y0, rb, 2 + Math.floor(rb() * 2));
    WORK.braziers.push({ x: cx, z: cz });
  }
  KB.build(scene);
  return S.pub;
}
// Kopfsteinpflaster auf dem Platz: dasselbe Material wie der Straßenboden (Pfützen, Nässe, Spiegelung), etwas über dem Gehweg
export function buildSquareGround() {
  const S = WORK.square; if (!S || !STREET.ground) return;
  const { b } = S, w = b.x1 - b.x0 - 9, d = b.z1 - b.z0 - 9, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const g = new T.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx, 0.235, cz), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 5, p.getZ(i) / 5);
  const m = new T.Mesh(g, STREET.ground.material); scene.add(m); S.ground = m;
}

/* ---------- Chunk-Schicht: Wäsche, Rohre und Kram in den Gassen der Arbeiterblöcke ---------- */
// Wände in der Nähe: Fassadenquader (nicht gedreht) in 20-m-Zellen
function segIndex() {
  if (WORK.segIdx) return WORK.segIdx;
  const M = new Map();
  for (const s of segs) {
    if (s.dead || s.ry || s.y1 < 4 || s.w < 3 || s.d < 3) continue;
    const i0 = Math.floor((s.x - s.w / 2) / 20), i1 = Math.floor((s.x + s.w / 2) / 20), j0 = Math.floor((s.z - s.d / 2) / 20), j1 = Math.floor((s.z + s.d / 2) / 20);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = i + ',' + j; (M.get(k) || M.set(k, []).get(k)).push(s); }
  }
  return WORK.segIdx = M;
}
// Nächste Wand von x aus in Richtung dir (+1 Osten, -1 Westen) auf Höhe y bei z: x der Wandfläche oder null
function wallFace(x, z, y, dir, maxD = 4.6) {
  const L = segIndex().get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || [], L2 = segIndex().get(Math.floor((x + dir * maxD) / 20) + ',' + Math.floor(z / 20)) || [];
  let best = null;
  for (const s of L.concat(L2)) {
    if (y < s.y0 + 0.3 || y > s.y1 - 0.3 || z < s.z - s.d / 2 + 0.25 || z > s.z + s.d / 2 - 0.25) continue;
    const f = dir > 0 ? s.x - s.w / 2 : s.x + s.w / 2, dd = (f - x) * dir;
    if (dd > 0.3 && dd < maxD && (best === null || dd < (best - x) * dir)) best = f;
  }
  return best;
}
// Eiserne Stege über der Gasse (shops.js buildAlley): dort keine Leine
function bridgeNear(x, z, y) {
  for (const s of segIndex().get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || []) if (Math.abs(s.x - x) < 0.01 && s.seed === 800 && Math.abs(s.z - z) < 1.6 && Math.abs(s.y0 - y) < 1.8) return true;
  return false;
}
// Erst beim ersten Bau der Zelle (die Fassaden stehen dann fest): Leinen und Rohre an echte Wände hängen
function planAlleyParts(A) {
  if (A.lines) return;
  const rr = mulberry32((A.rr * 1e9) | 0);
  A.lines = []; A.pipes = [];
  for (let z = A.z0 + 2 + rr() * 2; z < A.z1 - 1.5; z += (A.gap ? 1.8 : 2.8) + rr() * (A.gap ? 1.5 : 3.5)) {
    if (rr() < (A.gap ? 0.15 : 0.2)) continue;
    const n = rr() < 0.35 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const y = A.lo + rr() * Math.max(0.2, A.hi - A.lo) + k * 2.8; if (y > A.hi + 2.8 || bridgeNear(A.x, z, y)) continue;
      const xw = wallFace(A.x, z, y, -1), xe = wallFace(A.x, z, y, 1);
      if (xw === null || xe === null || xe - xw > 7) continue;
      A.lines.push({ z, y, xw, xe });
    }
  }
  if (A.gap) return;
  // Fallrohre an beiden Wänden, eine Dampfleitung mit Ventil auf einer Seite
  for (const dir of [-1, 1]) for (let k = 0; k < 2; k++) {
    const z = A.z0 + 3 + rr() * (A.z1 - A.z0 - 6), f = wallFace(A.x, z, 2, dir);
    if (f === null) continue;
    let top = 2; while (top < 30 && wallFace(A.x, z, top + 1, dir) !== null) top += 1;
    A.pipes.push({ kind: 'down', x: f - dir * 0.12, z, y1: top + 0.3 });
  }
  const dir = rr() < 0.5 ? -1 : 1, za = A.z0 + 4 + rr() * Math.max(1, A.z1 - A.z0 - 20), zb = Math.min(A.z1 - 3, za + 6 + rr() * 10);
  const fa = wallFace(A.x, za, 3.2, dir), fb = wallFace(A.x, zb, 3.2, dir);
  if (fa !== null && fb !== null && Math.abs(fa - fb) < 0.05) A.pipes.push({ kind: 'steam', x: fa - dir * 0.22, za, zb, y: 3.2 + rr() * 0.6 });
}
function buildAlleyParts(A, K) {
  planAlleyParts(A);
  const rr = mulberry32(((A.rr * 7e8) | 0) + 3);
  for (const L of A.lines) {
    // Leine mit Durchhang, zwei Haken in der Wand
    const n = 5, sag = 0.12 + (L.xe - L.xw) * 0.04, yAt = x => L.y - sag * (1 - ((2 * (x - L.xw)) / (L.xe - L.xw) - 1) ** 2);
    for (let i = 0; i < n; i++) { const xa = L.xw + (L.xe - L.xw) * i / n, xb = L.xw + (L.xe - L.xw) * (i + 1) / n, ya = yAt(xa), yb = yAt(xb), len = Math.hypot(xb - xa, yb - ya);
      K.add('rope', new T.BoxGeometry(len, 0.012, 0.012).rotateZ(Math.atan2(yb - ya, xb - xa)).translate((xa + xb) / 2, (ya + yb) / 2, L.z), [0.7, 0.68, 0.62]); }
    for (const x of [L.xw + 0.03, L.xe - 0.03]) K.add('iron', Bx(0.08, 0.05, 0.05, x, L.y + 0.02, L.z, 1));
    let x = L.xw + 0.25 + rr() * 0.4;
    while (x < L.xe - 0.6) {
      if (rr() < 0.18) { x += 0.4 + rr() * 0.6; continue; }
      const kind = rr() < 0.28 ? 0 : rr() < 0.45 ? 1 : rr() < 0.5 ? 2 : rr() < 0.6 ? 3 : 4, wDummy = 0.9;
      const xm = x + wDummy / 2; if (xm > L.xe - 0.4) break;
      const w = garment(K, rr, xm, yAt(xm) - 0.01, L.z, kind);
      x = xm + w / 2 + 0.08 + rr() * 0.15;
    }
  }
  for (const P of A.pipes || []) {
    if (P.kind === 'down') {
      K.add('iron', new T.CylinderGeometry(0.065, 0.065, P.y1 - 0.2, 8).translate(P.x, 0.2 + (P.y1 - 0.2) / 2, P.z), [0.55, 0.5, 0.45]);
      K.add('iron', new T.CylinderGeometry(0.16, 0.07, 0.3, 8).translate(P.x, P.y1, P.z), [0.55, 0.5, 0.45]);
      for (let y = 1.5; y < P.y1 - 0.5; y += 2.4) K.add('iron', new T.CylinderGeometry(0.085, 0.085, 0.06, 8).translate(P.x, y, P.z), [0.4, 0.38, 0.35]);
      K.add('iron', new T.CylinderGeometry(0.065, 0.08, 0.35, 8).rotateZ(Math.PI / 2 * Math.sign(A.x - P.x)).translate(P.x + Math.sign(A.x - P.x) * 0.15, 0.32, P.z), [0.55, 0.5, 0.45]);
    } else {
      const L = P.zb - P.za, zc = (P.za + P.zb) / 2;
      K.add('iron', new T.CylinderGeometry(0.11, 0.11, L, 10).rotateX(Math.PI / 2).translate(P.x, P.y, zc), [0.42, 0.32, 0.26]);
      for (let z = P.za + 0.3; z < P.zb; z += 2.2) { K.add('iron', new T.CylinderGeometry(0.16, 0.16, 0.08, 10).rotateX(Math.PI / 2).translate(P.x, P.y, z)); K.add('iron', Bx(0.3, 0.05, 0.06, P.x + Math.sign(P.x - A.x) * 0.12, P.y - 0.14, z, 1)); }
      K.add('iron', new T.TorusGeometry(0.16, 0.025, 5, 12).rotateY(Math.PI / 2).translate(P.x + Math.sign(A.x - P.x) * 0.22, P.y, zc), [0.6, 0.12, 0.08]);
      K.add('iron', new T.CylinderGeometry(0.03, 0.03, 0.2, 6).rotateZ(Math.PI / 2).translate(P.x + Math.sign(A.x - P.x) * 0.12, P.y, zc));
      // senkrechter Abgang in den Boden
      K.add('iron', new T.CylinderGeometry(0.11, 0.11, P.y - 0.2, 10).translate(P.x, 0.2 + (P.y - 0.2) / 2, P.zb), [0.42, 0.32, 0.26]);
    }
  }
  // V54: Kisten, Fässer, Tonnen und Kohle der Gassen sind ausreißbar; die Zelle baut gerade herausgerissene Stücke nicht mit
  for (const p of A.props || []) {
    const key = 'gasse:' + p.x.toFixed(1) + ',' + p.z.toFixed(1), info = p.kind === 'crates' ? { name: 'Kisten', m: 14 * p.n, stuff: 'wood' } : p.kind === 'barrel' ? { name: 'Fass', m: 45, stuff: 'wood', kind: 'cyl' } : p.kind === 'bin' ? { name: 'Mülltonne', m: 18, stuff: 'metal', kind: 'cyl' } : { name: 'Kohlenhaufen', m: 60, stuff: 'wood' };
    tearWrap(key, { ...info, layer: 'arbeiter' }, () => {
      if (p.kind === 'crates') crateStack(K, p.x, p.z, p.a, p.n);
      else if (p.kind === 'barrel') { barrel(K, p.x, p.z); if (p.n > 1) barrel(K, p.x, p.z + 0.68 * Math.sign(p.a - 3)); }
      else if (p.kind === 'bin') { bin(K, p.x, p.z); if (p.n > 2) bin(K, p.x, p.z + 0.62); }
      else coal(K, p.x, p.z, p.a, p.n);
    });
  }
}
export function setupWorkerLayer() {
  if (new URLSearchParams(location.search).has('noarbeiter')) return;   // Fehlersuche
  registerLayer({
    name: 'arbeiter', size: WORK_CELL, radius: cam => WORK_RADIUS + Math.max(0, cam.position.y) * 0.6,
    build(cx, cz) { return buildWorkerCell(cx, cz); },
  });
}
export function buildWorkerCell(cx, cz) {
  const K = kit(); let n = 0;
  for (const A of WORK.alleys) {
    const zc = (A.z0 + A.z1) / 2;
    if (Math.floor(A.x / WORK_CELL) !== cx || Math.floor(zc / WORK_CELL) !== cz) continue;
    buildAlleyParts(A, K); n++;
  }
  if (!n) return null;
  const g = new T.Group(); K.build(g);
  for (const m of g.children) m.frustumCulled = true;
  return g;
}
export const workStats = () => ({ alleys: WORK.alleys.length, lines: WORK.alleys.reduce((s, A) => s + (A.lines ? A.lines.length : 0), 0), braziers: WORK.braziers.length, square: !!WORK.square });
