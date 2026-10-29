/* =====================================================================
   V26 · LOSE DINGE MIT PHYSIK: aufheben, tragen, ablegen, werfen
   (wie in Skyrim). Starre Körper nach "Detailed Rigid Body Simulation
   with Extended Position Based Dynamics" (Müller u. a. 2020): Teilschritte,
   Berührpunkte auf der Hülle (Ecken, Ränder von Flaschen, Kugeln für Obst),
   Haft- und Gleitreibung, Rückprall, Schlafen. Hindernisse: Boden, Straßen
   und Bordsteine (groundAt), alle Quader der Stadt (Wände, Tische, Theken,
   Regale), die Villa, der Spieler (schiebt beim Gehen), Fußgänger, Wagen
   (fahren hinein und schleudern weg) und die Dinge untereinander. Im Wasser
   schwimmt Holz, Glas geht unter. Glas zerbricht bei harten Stößen.
   Aufheben: E auf ein Ding im Blick (Waren im Laden, Flaschen, Gläser,
   Stühle, Koffer, Kisten ...); dann E ablegen, Klick werfen, R drehen.
   In der Ansicht von hinten trägt die Figur es vor sich (große Dinge mit
   beiden Händen, kleine in der rechten Hand).
   ===================================================================== */
import { T, scene, camera, MOBILE } from './core.js';
import { nearBoxes, paintMat, mergeColored, MAT } from './people-skeleton.js';
import { groundAt, BODIES } from './driving.js';
import { DRIVE } from './eating.js';
import { VILLA } from './harbour.js';
import { WATER_Y } from './dance.js';
import { TRF } from './traffic.js';
import { peds, turnHead } from './serpentine.js';
import { knockDown } from './ragdoll.js';
import { player } from './player.js';
import { PM } from './player-model.js';
import { INTERACT } from './music.js';
import { toast } from './boat.js';
import { fxEmit } from './particles.js';
import { GOODS_AT } from './assets.js';
import { goodsBaked, goodsMaterial } from './props.js';
import { VENUES } from './venues.js';
import { paused, isTouch } from './input.js';
import { BOAT } from './boat.js';
import { DINE } from './venues.js';
import { $ } from './core.js';

export const LOOSE = { bodies: [], batches: new Map(), held: null, aim: null, rot: 0, spawned: new Set(), mat: null, goodsIdx: null, stats: { awake: 0, bodies: 0, ms: 0 } };
const G = 9.81, SUB = MOBILE ? 5 : 8, MAX_BODIES = MOBILE ? 48 : 96, REACH = 2.6;
const _v = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4(), _s = new T.Vector3(), _up = new T.Vector3(0, 1, 0);

/* ---------- Formen: Hüllpunkte und Trägheit ---------- */
// Quader: Ecken, Kantenmitten und Flächenmitten (gleich große Kisten aufeinander berühren sich sonst nur genau an den Kanten)
function boxPts(hx, hy, hz) { const p = []; for (const x of [-hx, 0, hx]) for (const y of [-hy, 0, hy]) for (const z of [-hz, 0, hz]) if (x || y || z) p.push(new T.Vector3(x, y, z)); return p; }
function cylPts(r, hy, n = 8) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(new T.Vector3(x, -hy, z), new T.Vector3(x, hy, z)); } return p; }
function ballPts(r) { const p = [new T.Vector3(0, r, 0), new T.Vector3(0, -r, 0)]; for (const y of [-0.5, 0, 0.5]) { const rr = Math.sqrt(1 - y * y) * r; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + y; p.push(new T.Vector3(Math.cos(a) * rr, y * r, Math.sin(a) * rr)); } } return p; }
// Körper anlegen: shape { kind: 'box'|'cyl'|'ball', he: [hx, hy, hz] }, Masse, Stoff (Reibung, Rückprall, Klang)
const STUFF = { wood: { mu: 0.55, e: 0.25, snd: 'wood', rho: 500 }, glass: { mu: 0.35, e: 0.35, snd: 'glass', rho: 2500, brittle: 6.5 }, leather: { mu: 0.6, e: 0.15, snd: 'soft', rho: 300 },
  paper: { mu: 0.7, e: 0.05, snd: 'soft', rho: 400 }, food: { mu: 0.6, e: 0.1, snd: 'soft', rho: 700 }, metal: { mu: 0.4, e: 0.3, snd: 'metal', rho: 2000 } };
function makeBody(o) {
  const [hx, hy, hz] = o.he, st = STUFF[o.stuff] || STUFF.wood;
  const pts = o.kind === 'cyl' ? cylPts(Math.min(hx, hz), hy, hx > 0.12 ? 10 : 8) : o.kind === 'ball' ? ballPts(hx) : boxPts(hx, hy, hz);
  const m = o.m, a = 2 * hx, b = 2 * hy, c = 2 * hz;
  const I = new T.Vector3(m / 12 * (b * b + c * c), m / 12 * (a * a + c * c), m / 12 * (a * a + b * b));
  const B = { name: o.name, key: o.key, kind: o.kind, he: new T.Vector3(hx, hy, hz), r: Math.hypot(hx, hy, hz), pts, m, invM: 1 / m, Ii: new T.Vector3(1 / I.x, 1 / I.y, 1 / I.z),
    mu: o.mu ?? st.mu, e: o.e ?? st.e, snd: st.snd, brittle: st.brittle || 0, floats: st.rho < 950, small: o.small ?? Math.max(a, b, c) < 0.45, sc: o.sc || 1,
    x: new T.Vector3(...o.p), q: new T.Quaternion().setFromAxisAngle(_up, o.yaw || 0), v: new T.Vector3(), w: new T.Vector3(), xp: new T.Vector3(), qp: new T.Quaternion(), v0: new T.Vector3(), w0: new T.Vector3(),
    awake: true, still: 0, gpts: new Float32Array(pts.length).fill(-1e9), boxes: [], hitT: 0, src: o.src || null, held: false };
  LOOSE.bodies.push(B); addToBatch(B);
  return B;
}

/* ---------- Darstellung: je Form ein InstancedMesh, jeder Körper eine Instanz ---------- */
function addToBatch(B) {
  let bt = LOOSE.batches.get(B.key);
  if (!bt) { bt = { key: B.key, geo: GEOS[B.key] ? GEOS[B.key]() : null, mat: B.key.startsWith('goods:') ? goodsMaterial() : propMat(), list: [], im: null, cap: 0 }; LOOSE.batches.set(B.key, bt); }
  bt.list.push(B); B.batch = bt;
  if (bt.list.length > bt.cap) {
    if (bt.im) { scene.remove(bt.im); bt.im.dispose(); }
    bt.cap = Math.max(4, bt.cap * 2);
    const im = bt.im = new T.InstancedMesh(bt.geo, bt.mat, bt.cap); im.frustumCulled = false; im.castShadow = true;
    im.instanceMatrix.setUsage(T.DynamicDrawUsage); for (let i = 0; i < bt.cap; i++) im.setColorAt(i, new T.Color(1, 1, 1));
    scene.add(im);
  }
}
function removeBody(B) {
  const bt = B.batch; bt.list.splice(bt.list.indexOf(B), 1); LOOSE.bodies.splice(LOOSE.bodies.indexOf(B), 1);
  if (LOOSE.held === B) LOOSE.held = null;
}
function drawBatches() {
  for (const bt of LOOSE.batches.values()) {
    const im = bt.im; if (!im) continue;
    for (let i = 0; i < bt.list.length; i++) { const B = bt.list[i]; im.setMatrixAt(i, _m.compose(B.x, B.q, _s.setScalar(B.sc))); }
    im.count = bt.list.length; im.instanceMatrix.needsUpdate = true;
  }
}
function propMat() { return LOOSE.mat || (LOOSE.mat = paintMat({ color: 0xffffff, metalness: 0.12, roughness: 0.55, envI: 0.45, emissive: 0x080604 })); }

/* ---------- Gegenstände der 20er Jahre (eigene Formen, Mitte = Schwerpunkt) ---------- */
const C = (g, c) => [g, c];
const cyl = (rt, rb, h, y = 0, n = 14) => new T.CylinderGeometry(rt, rb, h, n).translate(0, y, 0);
const box = (w, h, d, x = 0, y = 0, z = 0) => new T.BoxGeometry(w, h, d).translate(x, y, z);
const lathe = (pts, n = 16) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), n);
const GOLD = [0.75, 0.56, 0.25], BRASS = [0.6, 0.45, 0.22], DARKWOOD = [0.22, 0.12, 0.06];
export const GEOS = {
  // Bugholzstuhl (Thonet Nr. 14): runder Sitz, gebogene Lehne, vier schräge Beine; Mitte auf halber Höhe 0.45 m
  chair: () => {
    const P = [], wood = [0.2, 0.1, 0.05], y0 = -0.45;
    P.push(C(cyl(0.2, 0.2, 0.035, y0 + 0.46, 18), wood), C(cyl(0.205, 0.205, 0.02, y0 + 0.44, 18), [0.12, 0.06, 0.03]));
    for (const [x, z] of [[0.15, 0.15], [-0.15, 0.15], [0.15, -0.15], [-0.15, -0.15]]) { const l = cyl(0.014, 0.017, 0.46, 0, 6); l.rotateZ(-x * 0.35); l.rotateX(z * 0.35); l.translate(x * 1.1, y0 + 0.225, z * 1.1); P.push(C(l, wood)); }
    const ring = new T.TorusGeometry(0.15, 0.011, 6, 18); ring.rotateX(Math.PI / 2); ring.translate(0, y0 + 0.2, 0); P.push(C(ring, wood));
    for (const x of [-0.16, 0.16]) { const s = cyl(0.014, 0.014, 0.48, 0, 6); s.rotateX(-0.12); s.translate(x, y0 + 0.7, -0.17); P.push(C(s, wood)); }
    const bow = new T.TorusGeometry(0.16, 0.014, 6, 16, Math.PI); bow.translate(0, y0 + 0.9, -0.2); P.push(C(bow, wood));
    const bow2 = new T.TorusGeometry(0.12, 0.01, 6, 14, Math.PI); bow2.translate(0, y0 + 0.75, -0.18); P.push(C(bow2, wood));
    return mergeColored(P);
  },
  // Lederkoffer mit Messingecken und Griff
  suitcase: () => {
    const P = [], L = [0.36, 0.2, 0.11];
    P.push(C(box(0.62, 0.42, 0.2), L), C(box(0.625, 0.03, 0.205, 0, 0.05), [0.24, 0.13, 0.07]));
    for (const x of [-0.29, 0.29]) for (const y of [-0.19, 0.19]) P.push(C(box(0.05, 0.05, 0.21, x, y), BRASS));
    for (const x of [-0.14, 0.14]) P.push(C(box(0.03, 0.04, 0.03, x, 0.21, 0), BRASS));
    const h = new T.TorusGeometry(0.05, 0.012, 6, 10, Math.PI); h.translate(0, 0.21, 0); P.push(C(h, [0.15, 0.08, 0.04]));
    return mergeColored(P);
  },
  // Hutschachtel, rund, gestreift
  hatbox: () => {
    const P = [];
    for (let i = 0; i < 6; i++) P.push(C(cyl(0.2, 0.2, 0.04, -0.12 + i * 0.04 + 0.02, 22), i % 2 ? [0.85, 0.78, 0.66] : [0.12, 0.32, 0.33]));
    P.push(C(cyl(0.205, 0.205, 0.05, 0.135, 22), [0.12, 0.32, 0.33]), C(box(0.02, 0.012, 0.42, 0, 0.162), GOLD));
    return mergeColored(P);
  },
  // Holzkiste vom Hafen, Brettern und Leisten
  crate: () => {
    const P = [], w = [0.45, 0.33, 0.2], d = [0.32, 0.22, 0.13];
    P.push(C(box(0.58, 0.48, 0.48), w));
    for (const y of [-0.21, 0.21]) for (const z of [-0.21, 0.21]) P.push(C(box(0.6, 0.06, 0.06, 0, y, z), d));
    for (const x of [-0.27, 0.27]) for (const z of [-0.21, 0.21]) P.push(C(box(0.06, 0.48, 0.06, x, 0, z), d));
    P.push(C(box(0.3, 0.1, 0.005, 0, 0, 0.243), [0.1, 0.08, 0.06]));
    return mergeColored(P);
  },
  // Champagnerflasche: dunkelgrün, Goldfolie am Hals, Etikett
  champagne: () => {
    const g = lathe([[0, -0.15], [0.042, -0.15], [0.045, -0.13], [0.045, 0.02], [0.03, 0.07], [0.014, 0.1], [0.015, 0.15], [0, 0.155]]);
    const P = [C(g, [0.04, 0.12, 0.07]), C(cyl(0.0165, 0.0165, 0.06, 0.12, 10), GOLD), C(cyl(0.046, 0.046, 0.06, -0.06, 16), [0.88, 0.82, 0.68])];
    return mergeColored(P);
  },
  // Champagnerschale (Coupe)
  coupe: () => {
    const g = lathe([[0.035, -0.06], [0.035, -0.057], [0.004, -0.052], [0.004, 0.02], [0.03, 0.03], [0.05, 0.055], [0.052, 0.06], [0.048, 0.06], [0.0, 0.035]]);
    return mergeColored([C(g, [0.82, 0.86, 0.88]), C(cyl(0.045, 0.02, 0.012, 0.045, 14), [0.95, 0.82, 0.45])]);
  },
  // Zeitungsbündel mit Schnur
  papers: () => mergeColored([C(box(0.4, 0.14, 0.3), [0.86, 0.84, 0.78]), C(box(0.41, 0.145, 0.02), [0.55, 0.45, 0.3]), C(box(0.02, 0.145, 0.31), [0.55, 0.45, 0.3]), C(box(0.3, 0.005, 0.2, 0, 0.072, 0), [0.25, 0.25, 0.25])]),
  // Grammophon-Schallplattenkiste? Nein: Weinflasche liegt schon in den Waren. Dazu ein Blumentopf aus Messing mit Palme
  vase: () => {
    const g = lathe([[0, -0.15], [0.1, -0.15], [0.13, -0.05], [0.12, 0.1], [0.14, 0.15], [0, 0.15]], 18);
    const P = [C(g, BRASS)];
    for (let i = 0; i < 7; i++) { const l = box(0.04, 0.32, 0.01, 0, 0.3, 0); l.rotateZ(0.5 * Math.cos(i * 0.9)); l.rotateY(i * 0.9); P.push(C(l, [0.12, 0.3, 0.12])); }
    return mergeColored(P);
  },
};
// Maße, Masse, Stoff der eigenen Formen (Halbmaße wie die Hülle)
const KINDS = {
  chair: { name: 'Bugholzstuhl', kind: 'box', he: [0.21, 0.45, 0.22], m: 4.5, stuff: 'wood', small: false },
  suitcase: { name: 'Lederkoffer', kind: 'box', he: [0.31, 0.21, 0.1], m: 9, stuff: 'leather', small: false },
  hatbox: { name: 'Hutschachtel', kind: 'cyl', he: [0.2, 0.16, 0.2], m: 1.2, stuff: 'paper', small: false },
  crate: { name: 'Holzkiste', kind: 'box', he: [0.29, 0.24, 0.24], m: 14, stuff: 'wood', small: false },
  champagne: { name: 'Champagnerflasche', kind: 'cyl', he: [0.045, 0.155, 0.045], m: 1.6, stuff: 'glass', small: true },
  coupe: { name: 'Champagnerschale', kind: 'cyl', he: [0.05, 0.06, 0.05], m: 0.2, stuff: 'glass', small: true },
  papers: { name: 'Zeitungsbündel', kind: 'box', he: [0.2, 0.07, 0.15], m: 3, stuff: 'paper', small: false },
  vase: { name: 'Messingtopf mit Palme', kind: 'cyl', he: [0.14, 0.15, 0.14], m: 6, stuff: 'metal', small: false },
};
export function spawnProp(type, x, y, z, yaw = 0) {
  const k = KINDS[type]; if (!k || LOOSE.bodies.length >= MAX_BODIES) return null;
  return makeBody({ ...k, key: type, p: [x, y + k.he[1] + 0.01, z], yaw });
}

/* ---------- Waren aus den Läden (Kenney Food Kit) als Körper ---------- */
const GOODS_NAME = { 'wine-red': 'Rotwein', 'wine-white': 'Weißwein', bottle: 'Flasche', 'bottle-large': 'große Flasche', 'soda-bottle': 'Limonade', cake: 'Torte', pie: 'Kuchen', cupcake: 'Törtchen', muffin: 'Muffin',
  croissant: 'Hörnchen', cheese: 'Käselaib', 'whole-ham': 'Schinken', bread: 'Brot', loaf: 'Laib Brot', 'loaf-baguette': 'Baguette', apple: 'Apfel', orange: 'Orange', pear: 'Birne', cocktail: 'Cocktail', 'glass-wine': 'Weinglas', 'cup-saucer': 'Tasse' };
const GOODS_SHAPE = m => /wine|bottle|glass|cocktail|cup/.test(m) ? 'cyl' : /apple|orange|pear/.test(m) ? 'ball' : /cake|pie|cheese|cupcake|muffin/.test(m) ? 'cyl' : 'box';
function goodsBody(g) {
  const b = goodsBaked(g.m); if (!b) return null;
  const key = 'goods:' + g.m;
  if (!GEOS[key]) { const bb = b.geo.boundingBox || (b.geo.computeBoundingBox(), b.geo.boundingBox); const cy = (bb.min.y + bb.max.y) / 2; GEOS[key] = () => b.geo.clone().translate(0, -cy, 0); }
  const bb = b.geo.boundingBox, s = g.h, he = [(bb.max.x - bb.min.x) / 2 * s, (bb.max.y - bb.min.y) / 2 * s, (bb.max.z - bb.min.z) / 2 * s];
  const glass = /wine|bottle|glass|cocktail/.test(g.m), vol = 8 * he[0] * he[1] * he[2] * (GOODS_SHAPE(g.m) === 'box' ? 0.8 : 0.55);
  const m = Math.max(0.08, Math.min(6, vol * (glass ? 1100 : 600)));
  const B = makeBody({ name: GOODS_NAME[g.m] || 'Ware', key, kind: GOODS_SHAPE(g.m), he, m, stuff: glass ? 'glass' : 'food', small: true, sc: s, p: [g.x, g.y + he[1], g.z], yaw: g.yaw, src: g });
  return B;
}
// Index der Waren nach 2-m-Feldern (einmal, beim ersten Blick)
function goodsNear(x, z, r) {
  if (!LOOSE.goodsIdx) { LOOSE.goodsIdx = new Map(); for (const g of GOODS_AT) { const k = Math.floor(g.x / 2) + ',' + Math.floor(g.z / 2); if (!LOOSE.goodsIdx.has(k)) LOOSE.goodsIdx.set(k, []); LOOSE.goodsIdx.get(k).push(g); } }
  const out = [];
  for (let ix = Math.floor((x - r) / 2); ix <= Math.floor((x + r) / 2); ix++) for (let iz = Math.floor((z - r) / 2); iz <= Math.floor((z + r) / 2); iz++) { const a = LOOSE.goodsIdx.get(ix + ',' + iz); if (a) for (const g of a) if (!g.taken && g._im) out.push(g); }
  return out;
}
function takeGoods(g) {
  const B = goodsBody(g); if (!B) return null;
  g.taken = true;
  if (g._im) { g._im.setMatrixAt(g._i, _m.makeScale(0, 0, 0)); g._im.instanceMatrix.needsUpdate = true; }
  return B;
}

/* ---------- Umgebung: wo steckt ein Punkt drin? ---------- */
const HIT = { n: new T.Vector3(), d: 0, vx: 0, vz: 0 };
// Vorbereitung je Bild und Körper: Quader in der Nähe, Bodenhöhe unter jedem Hüllpunkt
function prepEnv(B) {
  const r = B.r + 0.6, x = B.x.x, z = B.x.z, y = B.x.y;
  B.boxes.length = 0;
  for (const b of nearBoxes(x, z, r)) if (b.x1 > x - r && b.x0 < x + r && b.z1 > z - r && b.z0 < z + r && b.y1 > y - r - 0.5 && b.y0 < y + r) B.boxes.push(b);
  B.villa = null;
  if (VILLA.boxes && Math.abs(x - VILLA.x) < 260 && Math.abs(z - VILLA.z) < 260) {
    const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry), dx = x - VILLA.x, dz = z - VILLA.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
    B.villa = VILLA.boxes.filter(b => b.x1 > lx - r && b.x0 < lx + r && b.z1 > lz - r && b.z0 < lz + r && b.y1 > y - r - 0.5 && b.y0 < y + r);
  }
  for (let i = 0; i < B.pts.length; i++) {
    _v.copy(B.pts[i]).multiplyScalar(B.sc).applyQuaternion(B.q).add(B.x);
    const g = groundAt(_v.x, _v.z, _v.y + 0.3);
    B.gpts[i] = g ? g.y : -1e9;
  }
  B.wet = groundAt(x, z, y + 0.3) === null;
}
function inBox(P, P0, b, n) {
  if (P.x <= b.x0 || P.x >= b.x1 || P.y <= b.y0 || P.y >= b.y1 || P.z <= b.z0 || P.z >= b.z1) return 0;
  // Seite: bevorzugt die, vor der der Punkt im letzten Teilschritt noch lag
  const c = [[P.x - b.x0, -1, 0, 0, P0.x <= b.x0 + 1e-4], [b.x1 - P.x, 1, 0, 0, P0.x >= b.x1 - 1e-4], [P.y - b.y0, 0, -1, 0, P0.y <= b.y0 + 1e-4], [b.y1 - P.y, 0, 1, 0, P0.y >= b.y1 - 1e-4], [P.z - b.z0, 0, 0, -1, P0.z <= b.z0 + 1e-4], [b.z1 - P.z, 0, 0, 1, P0.z >= b.z1 - 1e-4]];
  let best = null;
  for (const k of c) if (k[4] && (!best || k[0] < best[0])) best = k;
  if (!best) for (const k of c) if (!best || k[0] < best[0]) best = k;
  n.set(best[1], best[2], best[3]); return best[0];
}
// Punkt P (Welt), vorher P0, Hüllpunkt i des Körpers B: Eindringtiefe und Normale (aus dem Hindernis heraus)
function envHit(B, i, P, P0) {
  let d = 0;
  const gy = B.gpts[i];
  if (gy > -1e8 && P.y < gy) { d = gy - P.y; HIT.n.set(0, 1, 0); }
  for (const b of B.boxes) { const dd = inBox(P, P0, b, _v3); if (dd > d) { d = dd; HIT.n.copy(_v3); } }
  if (B.villa && B.villa.length) {
    const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry);
    const lp = new T.Vector3((P.x - VILLA.x) * cs - (P.z - VILLA.z) * sn, P.y, (P.x - VILLA.x) * sn + (P.z - VILLA.z) * cs);
    const l0 = new T.Vector3((P0.x - VILLA.x) * cs - (P0.z - VILLA.z) * sn, P0.y, (P0.x - VILLA.x) * sn + (P0.z - VILLA.z) * cs);
    for (const b of B.villa) { const dd = inBox(lp, l0, b, _v3); if (dd > d) { d = dd; HIT.n.set(_v3.x * cs + _v3.z * sn, _v3.y, -_v3.x * sn + _v3.z * cs); } }
  }
  HIT.d = d; return d;
}

/* ---------- XPBD: Positionsstoß, Geschwindigkeitsstoß ---------- */
// verallgemeinerte inverse Masse am Hebel r (Welt) in Richtung n
function wInv(B, r, n) {
  if (!B) return 0;
  _v2.crossVectors(r, n).applyQuaternion(_q.copy(B.q).invert());
  return B.invM + _v2.x * _v2.x * B.Ii.x + _v2.y * _v2.y * B.Ii.y + _v2.z * _v2.z * B.Ii.z;
}
// Iw⁻¹ · v (Weltraum) in out
function applyIinv(B, v, out) { _q.copy(B.q).invert(); out.copy(v).applyQuaternion(_q); out.set(out.x * B.Ii.x, out.y * B.Ii.y, out.z * B.Ii.z).applyQuaternion(B.q); return out; }
const _dq = new T.Quaternion(), _t1 = new T.Vector3(), _t2 = new T.Vector3();
function posImpulse(B, r, p, sign) {
  if (!B || B.held && sign === 0) return;
  B.x.addScaledVector(p, B.invM * sign);
  applyIinv(B, _t1.crossVectors(r, p).multiplyScalar(sign), _t2);
  _dq.set(_t2.x, _t2.y, _t2.z, 0).multiply(B.q);
  B.q.x += 0.5 * _dq.x; B.q.y += 0.5 * _dq.y; B.q.z += 0.5 * _dq.z; B.q.w += 0.5 * _dq.w; B.q.normalize();
}
function velImpulse(B, r, p, sign) {
  if (!B) return;
  B.v.addScaledVector(p, B.invM * sign);
  applyIinv(B, _t1.crossVectors(r, p).multiplyScalar(sign), _t2); B.w.add(_t2);
}
const CONTACTS = [];
const _bl = new T.Vector3(), _bw = new T.Vector3(), _he = new T.Vector3(), _rA = new T.Vector3(), _rB = new T.Vector3(), _P = new T.Vector3(), _P0 = new T.Vector3(), _n = new T.Vector3(), _dp = new T.Vector3(), _pp = new T.Vector3();
// Berührung lösen: A (Körper), B (Körper oder null = fest), Punkt P (Welt), Normale n von B nach A, Tiefe d; kin: Geschwindigkeit des festen Hindernisses
function contact(A, Bb, P, n, d, h, kin, pl) {
  _rA.subVectors(P, A.x); if (Bb) _rB.subVectors(P, Bb.x);
  const wA = wInv(A, _rA, n), wB = Bb ? wInv(Bb, _rB, n) : 0, w = wA + wB; if (w <= 0) return;
  const dl = d / w;
  _pp.copy(n).multiplyScalar(dl);
  posImpulse(A, _rA, _pp, 1); if (Bb) posImpulse(Bb, _rB, _pp, -1);
  // Haftreibung: tangentiale Verschiebung des Berührpunkts (Hüllpunkt pl von A) seit Anfang des Teilschritts zurücknehmen
  const mu = Bb ? Math.sqrt(A.mu * Bb.mu) : A.mu;
  _dp.copy(pl).applyQuaternion(A.q).add(A.x).sub(_P0.copy(pl).applyQuaternion(A.qp).add(A.xp));
  // Bewegung des Hindernisses (Wagen, Spieler) oder des anderen Körpers an dieser Stelle abziehen
  if (kin) _dp.addScaledVector(kin, -h);
  if (Bb) { _q2.copy(Bb.q).invert(); _bl.copy(P).sub(Bb.x).applyQuaternion(_q2); _dp.sub(_bw.copy(_bl).applyQuaternion(Bb.q).add(Bb.x)).add(_bl.applyQuaternion(Bb.qp).add(Bb.xp)); }
  _dp.addScaledVector(n, -_dp.dot(n));
  const dt = _dp.length();
  if (dt > 1e-7 && dt < mu * 1.1 * d) {
    _n.copy(_dp).multiplyScalar(-1 / dt);
    const wt = wInv(A, _rA, _n) + (Bb ? wInv(Bb, _rB, _n) : 0);
    _pp.copy(_n).multiplyScalar(dt / wt); posImpulse(A, _rA, _pp, 1); if (Bb) posImpulse(Bb, _rB, _pp, -1);
  }
  CONTACTS.push({ A, B: Bb, r: _rA.clone(), rb: Bb ? _rB.clone() : null, n: n.clone(), lam: dl, vn0: relVel(A, Bb, _rA, Bb ? _rB : null, kin, true).dot(n), kin: kin ? kin.clone() : null, mu, soft: SOFT.on });
}
const _rv = new T.Vector3(), _rv2 = new T.Vector3();
function relVel(A, Bb, rA, rB, kin, pre) {
  const v = pre ? A.v0 : A.v, w = pre ? A.w0 : A.w;
  _rv.crossVectors(w, rA).add(v);
  if (Bb) { const vb = pre ? Bb.v0 : Bb.v, wb = pre ? Bb.w0 : Bb.w; _rv2.crossVectors(wb, rB).add(vb); _rv.sub(_rv2); }
  if (kin) _rv.sub(kin);
  return _rv;
}
function solveVelocities(h) {
  for (const c of CONTACTS) {
    const { A, B: Bb, r, rb, n } = c;
    const v = relVel(A, Bb, r, rb, c.kin, false), vn = v.dot(n);
    _v.copy(v).addScaledVector(n, -vn);   // tangential
    const vt = _v.length(), fn = c.lam / (h * h);
    const dv = new T.Vector3();
    if (vt > 1e-6) dv.copy(_v).multiplyScalar(-Math.min(h * c.mu * 0.85 * fn, vt) / vt);
    const e = Math.abs(c.vn0) < 2 * G * h || c.soft ? 0 : (Bb ? Math.min(A.e, Bb.e) : A.e);
    dv.addScaledVector(n, -vn + Math.max(-e * c.vn0, 0));
    const L = dv.length(); if (L < 1e-7) continue;
    _n.copy(dv).multiplyScalar(1 / L);
    const w = wInv(A, r, _n) + (Bb ? wInv(Bb, rb, _n) : 0);
    _pp.copy(_n).multiplyScalar(L / w);
    velImpulse(A, r, _pp, 1); if (Bb) velImpulse(Bb, rb, _pp, -1);
    // Aufprall: Klang, Glas bricht
    if (c.vn0 < -1.6) impact(A, -c.vn0, c);
    if (Bb && c.vn0 < -1.6) impact(Bb, -c.vn0, c);
  }
}

/* ---------- Hindernisse, die sich bewegen: Spieler, Fußgänger, Wagen ---------- */
const KIN = [];   // { type: 'cap', x, y0, y1, z, r, v } | { type: 'car', x, y, z, h, hl, hw, top, v }
function gatherKinematic(cx, cz, R) {
  KIN.length = 0;
  if (!player.fly && !DRIVE.on) KIN.push({ type: 'cap', x: player.p.x, z: player.p.z, y0: player.p.y + 0.06, y1: player.p.y + 1.8, r: 0.32, v: player.v.clone(), player: true });
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.rag) continue;
    const e = pd.a.m.elements; if ((e[12] - cx) ** 2 + (e[14] - cz) ** 2 > R * R) continue;
    KIN.push({ type: 'cap', x: e[12], z: e[14], y0: e[13] + 0.1, y1: e[13] + 1.7, r: 0.24, v: new T.Vector3(), pd });
  }
  const car = (x, y, z, h, vx, vz) => { if ((x - cx) ** 2 + (z - cz) ** 2 < (R + 3) ** 2) KIN.push({ type: 'car', x, y: y || 0, z, h, hl: 2.25, hw: 0.9, top: (y || 0) + 1.45, v: new T.Vector3(vx, 0, vz) }); };
  for (const B of BODIES) car(B.x, B.y, B.z, B.h, B.vx, B.vz);
  for (const c of TRF.cars) if (!c.dyn && !c.gone && c.wx !== undefined) car(c.wx, c.wy, c.wz, c.yaw, Math.cos(c.yaw) * c.v, -Math.sin(c.yaw) * c.v);
}
function kinHit(P, k) {
  if (k.type === 'cap') {
    if (P.y < k.y0 || P.y > k.y1) return 0;
    const dx = P.x - k.x, dz = P.z - k.z, d = Math.hypot(dx, dz); if (d >= k.r) return 0;
    if (d < 1e-5) HIT.n.set(1, 0, 0); else HIT.n.set(dx / d, 0, dz / d);
    return k.r - d;
  }
  const fx = Math.cos(k.h), fz = -Math.sin(k.h), dx = P.x - k.x, dz = P.z - k.z, lf = dx * fx + dz * fz, ls = -dx * fz + dz * fx;
  if (Math.abs(lf) > k.hl || Math.abs(ls) > k.hw || P.y > k.top || P.y < k.y + 0.12) return 0;
  const pf = k.hl - Math.abs(lf), ps = k.hw - Math.abs(ls), pu = k.top - P.y;
  if (pu < pf && pu < ps) { HIT.n.set(0, 1, 0); return pu; }
  if (pf < ps) { const s = Math.sign(lf) || 1; HIT.n.set(fx * s, 0.25, fz * s).normalize(); return pf; }
  const s = Math.sign(ls) || 1; HIT.n.set(-fz * s, 0.25, fx * s).normalize(); return ps;
}

/* ---------- Ein Bild: Teilschritte ---------- */
export function updateLoose(dt) {
  const H0 = LOOSE.held;
  if (H0 && (player.fly || DRIVE.on || BOAT.on || DINE.seat || H0.stuck > 0.45)) { if (H0.stuck > 0.45) toast(H0.name + ' bleibt hängen'); drop(false); }
  if (isTouch) { const el = $('tThrow'); if (el.hidden === !!LOOSE.held) el.hidden = !LOOSE.held; }
  if (paused || !LOOSE.bodies.length) { drawBatches(); return; }
  const t0 = performance.now();
  dt = Math.min(dt, 1 / 30);
  const cp = camera.position, H = LOOSE.held;
  const act = LOOSE.bodies.filter(B => { const far = (B.x.x - cp.x) ** 2 + (B.x.z - cp.z) ** 2 > 160 * 160; return !far && (B.awake || B === H); });
  // Wecken: der Spieler, Wagen und Fußgänger in der Nähe schlafender Dinge
  gatherKinematic(player.p.x, player.p.z, 30);
  for (const B of LOOSE.bodies) if (!B.awake) for (const k of KIN) {
    const sp = k.v.lengthSq(); if (k.type === 'cap' && !k.player && sp < 0.01) continue;
    const r = k.type === 'car' ? 2.6 : k.r + 0.1;
    if ((B.x.x - k.x) ** 2 + (B.x.z - k.z) ** 2 < (B.r + r) ** 2 && (k.type === 'car' ? sp > 0.04 : sp > 0.0025)) { B.awake = true; B.still = 0; act.push(B); break; }
  }
  LOOSE.stats.awake = act.length; LOOSE.stats.bodies = LOOSE.bodies.length;
  if (!act.length) { drawBatches(); return; }
  for (const B of LOOSE.bodies) B.inAct = false;
  for (const B of act) { prepEnv(B); B.inAct = true; }
  const h = dt / SUB;
  const target = H ? holdTarget() : null;
  for (let s = 0; s < SUB; s++) {
    CONTACTS.length = 0;
    for (const B of act) {
      B.v0.copy(B.v); B.w0.copy(B.w); B.xp.copy(B.x); B.qp.copy(B.q);
      if (B === H) holdDrive(B, target, h);
      else {
        B.v.y -= G * h;
        // Wasser: Auftrieb und Dämpfung (Holz und Papier schwimmen, Glas sinkt langsam)
        if (B.wet && B.x.y < WATER_Y + B.he.y) {
          const sub = Math.min(1, (WATER_Y + B.he.y - B.x.y) / (2 * B.he.y));
          B.v.y += G * h * sub * (B.floats ? 1.7 : 0.6); B.v.multiplyScalar(1 - h * 1.8); B.w.multiplyScalar(1 - h * 2.5);
          if (!B.splashed && B.v0.y < -2) { B.splashed = true; fxEmit('spray', B.x.x, WATER_Y + 0.1, B.x.z, 0, 2, 0, 10, 0.6, 0.6); }
        }
      }
      B.x.addScaledVector(B.v, h);
      _dq.set(B.w.x, B.w.y, B.w.z, 0).multiply(B.q);
      B.q.x += 0.5 * h * _dq.x; B.q.y += 0.5 * h * _dq.y; B.q.z += 0.5 * h * _dq.z; B.q.w += 0.5 * h * _dq.w; B.q.normalize();
    }
    // Berührungen mit der Umgebung und den bewegten Hindernissen
    for (const B of act) {
      for (let i = 0; i < B.pts.length; i++) {
        const pl = B.pts[i].clone().multiplyScalar(B.sc);
        _P.copy(pl).applyQuaternion(B.q).add(B.x); _P0.copy(pl).applyQuaternion(B.qp).add(B.xp);
        const P0 = _P0.clone();
        let d = envHit(B, i, _P, P0);
        if (d > 0) addHit(_P, HIT.n, d, pl, null, null);
        for (const k of KIN) {
          if (k.player && B === H) continue;
          const dd = kinHit(_P, k); if (dd <= 0) continue;
          addHit(_P, HIT.n, dd, pl, k, null);
          if (k.pd && B.v0.lengthSq() > 9 && !k.pd.hitT) { k.pd.hitT = 1; bumpPed(k.pd, B); }
        }
      }
      flushHits(B, h);
    }
    // Dinge untereinander: Hüllpunkte von A im Quader von B
    for (let i = 0; i < act.length; i++) {
      const A = act[i];
      for (const Bb of LOOSE.bodies) {
        if (Bb === A || (Bb.inAct && act.indexOf(Bb) < i)) continue;
        const rr = A.r * A.sc + Bb.r * Bb.sc; if (A.x.distanceToSquared(Bb.x) > rr * rr) continue;
        pairContacts(A, Bb, h); pairContacts(Bb, A, h);
      }
    }
    // Geschwindigkeit aus der Bewegung, dann Reibung und Rückprall
    for (const B of act) {
      B.v.subVectors(B.x, B.xp).multiplyScalar(1 / h);
      _dq.copy(B.q).multiply(_q.copy(B.qp).invert());
      B.w.set(_dq.x, _dq.y, _dq.z).multiplyScalar((_dq.w >= 0 ? 2 : -2) / h);
    }
    solveVelocities(h);
    for (const B of act) { B.v.multiplyScalar(1 - 0.02 * h); B.w.multiplyScalar(1 - (B.kind === 'ball' ? 0.6 : 0.3) * h); }
  }
  // Schlafen, Herunterfallen aus der Welt
  for (const B of act) {
    if (B === H) { B.still = 0; continue; }
    // ruhig: bewegt sich kaum noch von der Stelle (kleines Zittern im Stapel zählt nicht)
    const calm = B.v.lengthSq() < 0.06 && B.w.lengthSq() < 0.4;
    if (calm) { if (!B.anchor) { B.anchor = B.x.clone(); B.anchorQ = B.q.clone(); B.still = 0; } B.still += dt; if (B.x.distanceTo(B.anchor) > 0.012 || B.q.angleTo(B.anchorQ) > 0.03) { B.anchor = null; B.still = 0; } }
    else { B.anchor = null; B.still = 0; }
    if (B.still > 0.5) { B.awake = false; B.v.set(0, 0, 0); B.w.set(0, 0, 0); B.anchor = null; }
    if (B.x.y < WATER_Y - 30) removeBody(B);
    B.hitT = Math.max(0, B.hitT - dt);
  }
  for (const pd of peds) if (pd.hitT) pd.hitT = Math.max(0, pd.hitT - dt);
  drawBatches();
  LOOSE.stats.ms = +(performance.now() - t0).toFixed(2);
}
const _lp = new T.Vector3(), _ln = new T.Vector3();
function pairContacts(A, Bb, h) {
  _q2.copy(Bb.q).invert();
  const he = _he.copy(Bb.he).multiplyScalar(Bb.sc);
  for (const pt of A.pts) {
    const pl = _v2.copy(pt).multiplyScalar(A.sc).clone();
    _P.copy(pl).applyQuaternion(A.q).add(A.x);
    _lp.copy(_P).sub(Bb.x).applyQuaternion(_q2);
    const dx = he.x - Math.abs(_lp.x), dy = he.y - Math.abs(_lp.y), dz = he.z - Math.abs(_lp.z);
    if (dx <= 0 || dy <= 0 || dz <= 0) continue;
    // runde Körper: nicht in den leeren Ecken des Quaders anstoßen
    if (Bb.kind !== 'box' && _lp.x * _lp.x + _lp.z * _lp.z > he.x * he.x) continue;
    if (dx < dy && dx < dz) _ln.set(Math.sign(_lp.x) || 1, 0, 0); else if (dy < dz) _ln.set(0, Math.sign(_lp.y) || 1, 0); else _ln.set(0, 0, Math.sign(_lp.z) || 1);
    const d = Math.min(dx, dy, dz);
    _ln.applyQuaternion(Bb.q);
    // schlafende Körper halten wie feste Hindernisse; ein kräftiger Stoß weckt sie fürs nächste Bild
    if (!Bb.inAct && (A.v.lengthSq() > 1 || d > 0.02)) { Bb.awake = true; Bb.still = 0; }
    addHit(_P, _ln, d, pl, null, Bb.inAct ? Bb : null);
  }
  flushHits(A, h);
}
// Berührpunkte eines Körpers zu Flächen zusammenfassen (gleiche Normale, gleiches Hindernis): ein Stoß je Fläche am
// tiefengewichteten Mittelpunkt. So kippt eine flach landende Flasche nicht, nur weil ein Randpunkt zuerst gelöst wurde
const MAN = [], SOFT = { on: false };
function addHit(P, n, d, pl, kin, other) {
  for (const m of MAN) if (m.kin === kin && m.other === other && m.n.dot(n) > 0.9) { m.w += d; m.P.addScaledVector(P, d); m.pl.addScaledVector(pl, d); m.nn.addScaledVector(n, d); if (d > m.d) m.d = d; return; }
  MAN.push({ P: P.clone().multiplyScalar(d), pl: pl.clone().multiplyScalar(d), nn: n.clone().multiplyScalar(d), n: n.clone(), d, w: d, kin, other });
}
function flushHits(B, h) {
  // Menschen schieben weich (kein Abprallen), Wagen prallen ab
  for (const m of MAN) { m.P.multiplyScalar(1 / m.w); m.pl.multiplyScalar(1 / m.w); m.nn.normalize(); SOFT.on = !!(m.kin && m.kin.type === 'cap'); contact(B, m.other, m.P, m.nn, m.d, h, m.kin ? m.kin.v : null, m.pl); }
  SOFT.on = false;
  MAN.length = 0;
}

/* ---------- Klang und Bruch ---------- */
function impact(B, vn, c) {
  if (B.hitT > 0) return;
  B.hitT = 0.12;
  const near = B.x.distanceTo(camera.position) < 40;
  if (near) bumpSound(B.snd, Math.min(1, vn / 7), B.m);
  if (B.brittle && vn > B.brittle && B !== LOOSE.held) {
    fxEmit('glass', B.x.x, B.x.y, B.x.z, B.v.x * 0.2, 1.2, B.v.z * 0.2, B.m > 1 ? 18 : 8, 0.5, 0.5);
    if (near) bumpSound('shatter', 1, B.m);
    if (B.src) B.src.broken = true;
    removeBody(B);
  }
}
export function bumpSound(kind, k, m) {
  const A = DRIVE.au; if (!A || paused) return;
  const ctx = A.ctx, t = ctx.currentTime, out = A.out;
  if (kind === 'glass' || kind === 'shatter' || kind === 'metal') {
    const n = kind === 'shatter' ? 6 : 2;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.value = (kind === 'metal' ? 700 : 2200) * (1 + Math.random() * (kind === 'shatter' ? 1.5 : 0.3)) / Math.cbrt(m + 0.3);
      const tt = t + i * (kind === 'shatter' ? 0.018 : 0.004);
      g.gain.setValueAtTime(0.0001, tt); g.gain.exponentialRampToValueAtTime(0.06 * k + 0.01, tt + 0.003); g.gain.exponentialRampToValueAtTime(0.0002, tt + (kind === 'metal' ? 0.5 : 0.25));
      o.connect(g); g.connect(out); o.start(tt); o.stop(tt + 0.6);
    }
  }
  if (kind !== 'glass') {
    const s = ctx.createBufferSource(); s.buffer = A.nb; const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = (kind === 'wood' ? 900 : kind === 'shatter' ? 5000 : 500) / Math.cbrt(m * 0.5 + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 + 0.25 * k * Math.min(1, m / 6), t + 0.005); g.gain.exponentialRampToValueAtTime(0.0003, t + 0.12 + 0.1 * k);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.4);
  }
}
// Wer getroffen wird, dreht sich zum Spieler um; ein schweres Ding mit Wucht wirft um
function bumpPed(pd, B) {
  if (B.m > 3 && B.v0.lengthSq() > 36) knockDown(pd, B.v0.x * B.m / 30, B.v0.z * B.m / 30, player.p.x, player.p.z);
  else turnHead(pd.a, player.p.x, player.p.z);
}

/* ---------- Tragen ---------- */
const _tg = { p: new T.Vector3(), q: new T.Quaternion() };
function holdTarget() {
  const B = LOOSE.held;
  if (PM.view === 'third' && PM.mesh && !player.fly) {
    // vor dem Bauch (groß) oder in der rechten Hand (klein), wie die Arme der Figur greifen
    const yaw = PM.yawB, s = PM.sc, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const lx = B.small ? -0.13 : 0, ly = B.small ? 1.12 : 1.02 + B.he.y * B.sc * 0.4, lz = B.small ? 0.4 : 0.33 + B.he.z * B.sc;
    _tg.p.set(player.p.x + (lx * cs + lz * sn) * s, player.p.y + ly * s, player.p.z + (-lx * sn + lz * cs) * s);
    _tg.q.setFromAxisAngle(_up, yaw + LOOSE.rot).multiply(B.holdQ);
  } else {
    const d = Math.max(0.75, Math.min(1.6, 0.55 + B.r * B.sc * 1.6));
    camera.getWorldDirection(_v2);
    _tg.p.copy(camera.position).addScaledVector(_v2, d); _tg.p.y -= 0.12;
    _tg.q.setFromAxisAngle(_up, player.yaw + LOOSE.rot).multiply(B.holdQ);
  }
  return _tg;
}
function holdDrive(B, tg, h) {
  // gedämpfte Feder zum Zielpunkt; schwere Dinge folgen träger
  const k = 16 * Math.min(1, 7 / B.m) + 4;
  _v.subVectors(tg.p, B.x);
  B.v.copy(_v).multiplyScalar(k).clampLength(0, 9);
  _q.copy(tg.q).multiply(_q2.copy(B.q).invert()); if (_q.w < 0) { _q.x = -_q.x; _q.y = -_q.y; _q.z = -_q.z; _q.w = -_q.w; }
  const ang = 2 * Math.acos(Math.min(1, _q.w)), sn = Math.sqrt(Math.max(1e-9, 1 - _q.w * _q.w));
  B.w.set(_q.x / sn, _q.y / sn, _q.z / sn).multiplyScalar(Math.min(ang * 10, 14));
  B.stuck = _v.length() > 1.1 ? (B.stuck || 0) + h : 0;
}
export function pickUp(B) {
  if (!B) return;
  if (B.m > 20) { toast('Zu schwer zum Tragen'); return; }
  LOOSE.held = B; B.held = true; B.awake = true; B.still = 0; LOOSE.rot = 0;
  // Lage zum Blick merken, damit das Ding so bleibt, wie es gegriffen wurde (aufrecht bleibt aufrecht)
  const yaw = PM.view === 'third' && PM.mesh ? PM.yawB : player.yaw;
  B.holdQ = _q.setFromAxisAngle(_up, -yaw).multiply(B.q).clone();
  // umgefallene Flaschen und Stühle richtet man beim Aufheben auf
  const upL = _v.set(0, 1, 0).applyQuaternion(B.holdQ);
  if (upL.y < 0.7) B.holdQ.premultiply(_q2.setFromUnitVectors(upL, _up));
  toast(B.name + ' aufgehoben · E ablegen · Klick werfen · R drehen');
}
export function drop(throwIt) {
  const B = LOOSE.held; if (!B) return;
  LOOSE.held = null; B.held = false; B.awake = true; B.still = 0;
  if (throwIt) {
    camera.getWorldDirection(_v2);
    const sp = Math.min(11, 16 / Math.sqrt(B.m + 0.5));
    B.v.copy(_v2).multiplyScalar(sp).add(player.v); B.v.y += 1.2;
    B.w.set((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
  } else B.v.multiplyScalar(0.5);
}
export function rotateHeld() { if (LOOSE.held) LOOSE.rot += Math.PI / 4; }

/* ---------- Zielen: was liegt im Blick? ---------- */
const _ro = new T.Vector3(), _rd = new T.Vector3(), _lo = new T.Vector3(), _ldir = new T.Vector3();
function rayOBB(B, o, d) {
  _q.copy(B.q).invert(); _lo.copy(o).sub(B.x).applyQuaternion(_q); _ldir.copy(d).applyQuaternion(_q);
  let t0 = 0, t1 = REACH + 2;
  for (const ax of ['x', 'y', 'z']) {
    const e = B.he[ax] * B.sc + 0.03, oo = _lo[ax], dd = _ldir[ax];
    if (Math.abs(dd) < 1e-8) { if (oo < -e || oo > e) return -1; continue; }
    let a = (-e - oo) / dd, b = (e - oo) / dd; if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1;
  }
  return t0;
}
function aim() {
  if (player.fly || DRIVE.on) return null;
  // vom Kopf der Figur aus (auch in der Ansicht von hinten), entlang der Blickrichtung
  _ro.set(player.p.x, player.p.y + 1.62, player.p.z);
  camera.getWorldDirection(_rd);
  if (PM.view === 'third') { const cp = camera.position; const along = _ro.clone().sub(cp).dot(_rd); _ro.copy(cp).addScaledVector(_rd, Math.max(0, along)); }
  let best = null, bt = REACH;
  for (const B of LOOSE.bodies) {
    if (B.x.distanceToSquared(_ro) > (REACH + B.r * B.sc) ** 2) continue;
    const t = rayOBB(B, _ro, _rd); if (t >= 0 && t < bt) { bt = t; best = { body: B }; }
  }
  for (const g of goodsNear(_ro.x, _ro.z, REACH)) {
    const r = Math.max(0.07, g.h * 0.5), cy = g.y + g.h * 0.45;
    _v.set(g.x - _ro.x, cy - _ro.y, g.z - _ro.z);
    const t = _v.dot(_rd); if (t < 0 || t > bt) continue;
    const dd = _v.lengthSq() - t * t; if (dd > r * r) continue;
    bt = t; best = { goods: g };
  }
  return best;
}
export function setupLoose() {
  // Zuerst prüfen: beim Tragen geht E an das Ablegen, nicht an Türen oder Sitze
  INTERACT.unshift({ test: () => !!LOOSE.held, label: 'Ablegen · Klick: werfen · R: drehen', act: () => drop(false) });
  INTERACT.push({
    test: p => { if (LOOSE.held || p.y > 1500) return false; LOOSE.aim = aim(); if (!LOOSE.aim) return false; const a = LOOSE.aim; aimLabel.label = 'Aufheben: ' + (a.body ? a.body.name : GOODS_NAME[a.goods.m] || 'Ware'); return true; },
    get label() { return aimLabel.label; },
    act: () => { const a = LOOSE.aim; if (!a) return; pickUp(a.body || takeGoods(a.goods)); },
  });
  for (const V of VENUES) SPAWNS.push(...venueSpawns(V));
}
const aimLabel = { label: 'Aufheben' };

/* ---------- Wo Dinge herumliegen: Gruppen, die beim Näherkommen entstehen ---------- */
// [x, z, Art, Gierwinkel, Höhe (Boden darunter wird gesucht, von hier aus nach unten)]
export const SPAWNS = [
  // vor dem Belmont, gleich am Startpunkt: Gepäck eines ankommenden Gastes, Zeitungen, ein Palmentopf
  { x: -5, z: 116, items: [['suitcase', -5, 116, 0.3], ['suitcase', -4.3, 116.6, 1.8], ['hatbox', -5.6, 116.9, 0], ['papers', 5.5, 117, 0.6], ['papers', 5.9, 116.5, 2.1], ['crate', 6.8, 118.2, 0.2], ['vase', -7.5, 114, 0], ['chair', 4.2, 115.2, 2.4]], y: 3 },
  // Hafen: Kisten gestapelt, Koffer an der Mole
  { x: 60, z: 512, items: [['crate', 58, 512, 0.1], ['crate', 58.7, 512.1, 0.15], ['crate', 58.35, 512, 0.05, 0.55], ['crate', 62, 510.5, 0.9], ['suitcase', 61, 514, 0.4], ['suitcase', 61.3, 514.4, 0.2, 0.25]], y: 3 },
];
function venueSpawns(V) {
  const out = [], F = V.F || 0, items = [];
  V.tables.slice(0, 6).forEach((t, i) => {
    if (i % 2 === 0) items.push(['champagne', t.x + 0.08, t.z - 0.05, 0, F + 0.78 - (F + 0.0)]);
    items.push(['coupe', t.x - 0.12, t.z + 0.1, 0, F + 0.78 - F], ['coupe', t.x + 0.15, t.z + 0.16, 0, F + 0.78 - F]);
  });
  for (let k = 0; k < 3; k++) items.push(['chair', V.x0 + 2.5 + k * 1.6, V.z1 - 1.4, Math.PI + k * 0.3]);
  out.push({ x: (V.x0 + V.x1) / 2, z: (V.z0 + V.z1) / 2, items: items.map(([a, x, z, y, up]) => [a, x, z, y, up]), y: F + 2.2, floor: F });
  return out;
}
// Oberkante unter (x, z) unterhalb von yTop: Quader der Stadt und Boden
function floorBelow(x, z, yTop) {
  let y = -1e9; const g = groundAt(x, z, yTop); if (g) y = g.y;
  for (const b of nearBoxes(x, z, 1)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y1 <= yTop && b.y1 > y) y = b.y1;
  return y;
}
export function updateSpawns() {
  const p = player.p;
  for (const S of SPAWNS) {
    if (S.done || (S.x - p.x) ** 2 + (S.z - p.z) ** 2 > 110 * 110) continue;
    S.done = true;
    for (const [type, x, z, yaw, up] of S.items) {
      const yTop = (S.floor ?? 0) + (typeof up === 'number' && up > 0.3 ? up + 0.3 : S.y);
      const y = floorBelow(x, z, yTop);
      const B = spawnProp(type, x, (y > -1e8 ? y : 0) + (typeof up === 'number' && up <= 0.3 ? up : 0), z, yaw);
      if (B) { B.awake = true; }
    }
  }
}
// für Konsole und Tests: vespera.loose.pickUp(vespera.loose.bodies[0]) usw.
Object.assign(LOOSE, { pickUp, drop, spawnProp, rotateHeld });
