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
import { T, scene, camera, MOBILE, mergeGeos } from './core.js';
import { nearBoxes, paintMat, mergeColored, removeColliders, addCollider } from './people-skeleton.js';
import { MOV, FURN } from './entrances.js';
import { STREET } from './serpentine.js';
import { props } from './props.js';
import { DOORS } from './entrances.js';
import { WORK } from './workers.js';
import { interiorCrowd } from './belmont.js';
import { mulberry32 } from './core.js';
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
import { ORTE } from './orte.js';
import { paused, isTouch } from './input.js';
import { BOAT } from './boat.js';
import { DINE } from './venues.js';
import { $ } from './core.js';
import { clutterGeos, clutterKinds } from './clutter-geos.js';
import { CLUT, clutterNear, clutterMatrix, clutterMoved } from './clutter.js';
import { decoLampGeo, decoLampMats } from './decolamp.js';
import { lampFx } from './serpentine.js';
import { invalidateLayer } from './chunks.js';
import { TEAR, tearInfo, tearNear } from './tear.js';
import { TREE_SETS, treeNear, treeDirty } from './serpentine.js';

export const LOOSE = { bodies: [], batches: new Map(), held: null, tk: null, tkTarget: null, aim: null, rot: 0, spawned: new Set(), mat: null, goodsIdx: null, stats: { awake: 0, bodies: 0, ms: 0 } };
const G = 9.81, SUB = MOBILE ? 5 : 8, MAX_BODIES = MOBILE ? 56 : 128, REACH = 2.6;   // V52: mehr Platz (Möbel, Straßenmöbel, neue Gruppen); ferne Gruppen räumt cullBodies wieder ab
const _v = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _q = new T.Quaternion(), _q2 = new T.Quaternion(), _m = new T.Matrix4(), _s = new T.Vector3(), _up = new T.Vector3(0, 1, 0);

/* ---------- Formen: Hüllpunkte und Trägheit ---------- */
// Quader: Ecken, Kantenmitten und Flächenmitten (gleich große Kisten aufeinander berühren sich sonst nur genau an den Kanten)
function boxPts(hx, hy, hz) { const p = []; for (const x of [-hx, 0, hx]) for (const y of [-hy, 0, hy]) for (const z of [-hz, 0, hz]) if (x || y || z) p.push(new T.Vector3(x, y, z)); return p; }
function cylPts(r, hy, n = 8) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push(new T.Vector3(x, -hy, z), new T.Vector3(x, hy, z)); } return p; }
function ballPts(r) { const p = [new T.Vector3(0, r, 0), new T.Vector3(0, -r, 0)]; for (const y of [-0.5, 0, 0.5]) { const rr = Math.sqrt(1 - y * y) * r; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + y; p.push(new T.Vector3(Math.cos(a) * rr, y * r, Math.sin(a) * rr)); } } return p; }
// Körper anlegen: shape { kind: 'box'|'cyl'|'ball', he: [hx, hy, hz] }, Masse, Stoff (Reibung, Rückprall, Klang)
const STUFF = { wood: { mu: 0.55, e: 0.25, snd: 'wood', rho: 500 }, glass: { mu: 0.35, e: 0.35, snd: 'glass', rho: 2500, brittle: 6.5 }, leather: { mu: 0.6, e: 0.15, snd: 'soft', rho: 300 },
  paper: { mu: 0.7, e: 0.05, snd: 'soft', rho: 400 }, food: { mu: 0.6, e: 0.1, snd: 'soft', rho: 700 }, metal: { mu: 0.4, e: 0.3, snd: 'metal', rho: 2000 }, clay: { mu: 0.6, e: 0.1, snd: 'glass', rho: 1800, brittle: 7.5 } };   // V53: Terrakotta zerspringt
function makeBody(o) {
  const [hx, hy, hz] = o.he, st = STUFF[o.stuff] || STUFF.wood;
  const pts = o.kind === 'cyl' ? cylPts(Math.min(hx, hz), hy, hx > 0.12 ? 10 : 8) : o.kind === 'ball' ? ballPts(hx) : boxPts(hx, hy, hz);
  const m = o.m, a = 2 * hx, b = 2 * hy, c = 2 * hz;
  const I = new T.Vector3(m / 12 * (b * b + c * c), m / 12 * (a * a + c * c), m / 12 * (a * a + b * b));
  const B = { name: o.name, key: o.key, kind: o.kind, he: new T.Vector3(hx, hy, hz), r: Math.hypot(hx, hy, hz), pts, m, invM: 1 / m, Ii: new T.Vector3(1 / I.x, 1 / I.y, 1 / I.z),
    mu: o.mu ?? st.mu, e: o.e ?? st.e, snd: st.snd, brittle: st.brittle || 0, floats: st.rho < 950, small: o.small ?? Math.max(a, b, c) < 0.45, sc: o.sc || 1,
    x: new T.Vector3(...o.p), q: new T.Quaternion().setFromAxisAngle(_up, o.yaw || 0), v: new T.Vector3(), w: new T.Vector3(), xp: new T.Vector3(), qp: new T.Quaternion(), v0: new T.Vector3(), w0: new T.Vector3(),
    awake: true, still: 0, gpts: new Float32Array(pts.length).fill(-1e9), boxes: [], hitT: 0, src: o.src || null, held: false, col: o.col || null, mesh: o.mesh || null, furn: o.furn || null };
  LOOSE.bodies.push(B);
  // V52: Möbel bringen ein eigenes Netz mit den Materialien des Raums mit; alles andere wird je Form gesammelt gezeichnet
  if (B.mesh) { B.mesh.frustumCulled = false; B.mesh.castShadow = true; scene.add(B.mesh); } else addToBatch(B);
  return B;
}

/* ---------- Darstellung: je Form ein InstancedMesh, jeder Körper eine Instanz ---------- */
function addToBatch(B) {
  let bt = LOOSE.batches.get(B.key);
  if (!bt) { const gf = GEOS[B.key]; bt = { key: B.key, geo: gf ? gf() : null, mat: gf && gf.mat ? gf.mat : B.key.startsWith('goods:') ? goodsMaterial() : propMat(), list: [], im: null, cap: 0 }; LOOSE.batches.set(B.key, bt); }   // V52: gf.mat = eigener Stoff (Straßenmöbel)
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
  const bt = B.batch; if (bt) bt.list.splice(bt.list.indexOf(B), 1); LOOSE.bodies.splice(LOOSE.bodies.indexOf(B), 1);
  if (B.mesh) { scene.remove(B.mesh); B.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); B.mesh = null; }   // V54: auch Kinder (Laterne, Baum)
  if (LOOSE.held === B) LOOSE.held = null;
  if (LOOSE.tk === B) LOOSE.tk = null;
}
function drawBatches() {
  for (const bt of LOOSE.batches.values()) {
    const im = bt.im; if (!im) continue;
    let colDirty = false;
    for (let i = 0; i < bt.list.length; i++) { const B = bt.list[i]; im.setMatrixAt(i, _m.compose(B.x, B.q, _s.setScalar(B.sc))); if (B.col && B.colI !== i) { im.setColorAt(i, _cc.setRGB(B.col[0], B.col[1], B.col[2])); B.colI = i; colDirty = true; } }
    im.count = bt.list.length; im.instanceMatrix.needsUpdate = true; if (colDirty && im.instanceColor) im.instanceColor.needsUpdate = true;
  }
  for (const B of LOOSE.bodies) if (B.mesh) { B.mesh.position.copy(B.x); B.mesh.quaternion.copy(B.q); }
}
const _cc = new T.Color();
function propMat() { return LOOSE.mat || (LOOSE.mat = paintMat({ color: 0xffffff, metalness: 0.12, roughness: 0.55, envI: 0.45, emissive: 0x080604 })); }

/* ---------- Gegenstände der 20er Jahre (eigene Formen, Mitte = Schwerpunkt) ---------- */
const C = (g, c) => [g, c];
const cyl = (rt, rb, h, y = 0, n = 14) => new T.CylinderGeometry(rt, rb, h, n).translate(0, y, 0);
const box = (w, h, d, x = 0, y = 0, z = 0) => new T.BoxGeometry(w, h, d).translate(x, y, z);
const lathe = (pts, n = 16) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), n);
const GOLD = [0.75, 0.56, 0.25], BRASS = [0.6, 0.45, 0.22];
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
  /* ---- V41: Dinge in Alexanders Penthouse (Mitte = Schwerpunkt) ---- */
  // Bücherstapel: drei Bände in Leder, Goldprägung am Rücken
  book: () => {
    const P = [], cols = [[0.42, 0.1, 0.08], [0.1, 0.25, 0.26], [0.3, 0.2, 0.12]], hs = [0.035, 0.03, 0.04];
    let y = -0.0525;
    cols.forEach((c, i) => { const h = hs[i], w = 0.22 - i * 0.015, d = 0.16 - i * 0.01, ox = (i % 2) * 0.015;
      P.push(C(box(w, h, d, ox, y + h / 2), c), C(box(w - 0.02, h - 0.006, d - 0.012, ox + 0.012, y + h / 2), [0.9, 0.86, 0.76]), C(box(0.004, h - 0.01, 0.1, ox - w / 2 + 0.002, y + h / 2), GOLD)); y += h; });
    return mergeColored(P);
  },
  // Kerzenleuchter aus Messing mit Kerze
  candlestick: () => mergeColored([C(lathe([[0, -0.16], [0.06, -0.16], [0.065, -0.145], [0.02, -0.12], [0.015, -0.02], [0.03, 0], [0.02, 0.01], [0, 0.01]], 14), BRASS), C(cyl(0.011, 0.011, 0.14, 0.08, 10), [0.93, 0.9, 0.82]), C(cyl(0.002, 0.002, 0.012, 0.156, 4), [0.1, 0.1, 0.1])]),
  // Kristallkaraffe mit Stöpsel, halb voll mit Whisky
  decanter: () => mergeColored([C(lathe([[0, -0.14], [0.065, -0.14], [0.07, -0.08], [0.06, -0.02], [0.025, 0.02], [0.022, 0.09], [0.028, 0.1], [0, 0.1]], 16), [0.86, 0.9, 0.92]), C(lathe([[0, -0.135], [0.06, -0.135], [0.065, -0.08], [0.055, -0.03], [0, -0.03]], 14), [0.62, 0.3, 0.08]), C(lathe([[0, 0.1], [0.02, 0.1], [0.028, 0.12], [0.012, 0.14], [0, 0.14]], 10), [0.9, 0.94, 0.96])]),
  // Whiskyglas (Tumbler), schwerer Boden
  tumbler: () => mergeColored([C(lathe([[0, -0.05], [0.035, -0.05], [0.04, 0.05], [0.036, 0.05], [0.032, -0.03], [0, -0.03]], 14), [0.85, 0.88, 0.9]), C(cyl(0.031, 0.031, 0.025, -0.017, 12), [0.68, 0.36, 0.1])]),
  // Zigarrenkiste aus Zedernholz mit Messingschloss
  cigarbox: () => mergeColored([C(box(0.24, 0.07, 0.16), [0.5, 0.3, 0.14]), C(box(0.242, 0.006, 0.162, 0, 0.012), [0.3, 0.17, 0.08]), C(box(0.03, 0.02, 0.004, 0, 0, 0.082), BRASS), C(box(0.14, 0.001, 0.08, 0, 0.0355), [0.85, 0.75, 0.5])]),
  // Kissen (Samt, petrol) und Kissen (Seide, creme) mit Goldkordel
  cushion: () => mergeColored([C(new T.SphereGeometry(0.22, 12, 8).scale(1, 0.32, 1), [0.06, 0.3, 0.31]), C(new T.TorusGeometry(0.2, 0.008, 5, 24).rotateX(Math.PI / 2), GOLD)]),
  cushionC: () => mergeColored([C(new T.SphereGeometry(0.22, 12, 8).scale(1, 0.32, 1), [0.9, 0.84, 0.72]), C(new T.TorusGeometry(0.2, 0.008, 5, 24).rotateX(Math.PI / 2), GOLD)]),
  // Stehrahmen mit Bild (Goldrahmen, dunkles Bild, Stütze hinten)
  frame: () => mergeColored([C(box(0.22, 0.28, 0.02), GOLD), C(box(0.18, 0.24, 0.004, 0, 0, 0.011), [0.12, 0.1, 0.09]), C(box(0.12, 0.16, 0.004, 0, 0, 0.012), [0.5, 0.42, 0.34]), C(box(0.02, 0.22, 0.006, 0, -0.03, -0.04).rotateX(0.3), [0.3, 0.2, 0.1])]),
  // Aschenbecher aus Messing
  ashtray: () => mergeColored([C(lathe([[0, -0.02], [0.08, -0.02], [0.085, 0.015], [0.07, 0.02], [0.06, -0.005], [0, -0.005]], 16), BRASS)]),
  // Cocktailshaker, Chrom
  shaker: () => mergeColored([C(lathe([[0, -0.13], [0.04, -0.13], [0.045, 0.03], [0.04, 0.06], [0.035, 0.09], [0.02, 0.11], [0.02, 0.13], [0, 0.13]], 16), [0.85, 0.87, 0.9])]),
  // Schellackplatte mit Etikett
  record: () => mergeColored([C(cyl(0.15, 0.15, 0.012, 0, 32), [0.06, 0.06, 0.07]), C(cyl(0.05, 0.05, 0.013, 0, 20), [0.7, 0.2, 0.12]), C(cyl(0.004, 0.004, 0.014, 0, 6), [0.9, 0.9, 0.9])]),
  // Kaminuhr: Holzgehäuse mit Rundbogen, Messingzifferblatt
  clock: () => mergeColored([C(box(0.26, 0.17, 0.11, 0, -0.035), [0.35, 0.18, 0.08]), C(cyl(0.13, 0.13, 0.11, 0.05, 20).rotateX(Math.PI / 2).translate(0, 0, 0), [0.35, 0.18, 0.08]), C(cyl(0.095, 0.095, 0.004, 0, 24).rotateX(Math.PI / 2).translate(0, 0.03, 0.056), [0.92, 0.88, 0.75]), C(box(0.006, 0.07, 0.002, 0, 0.065, 0.059), [0.1, 0.1, 0.1]), C(box(0.05, 0.006, 0.002, 0.02, 0.03, 0.059), [0.1, 0.1, 0.1]), C(box(0.28, 0.02, 0.13, 0, -0.11), BRASS)]),
  // Tischfernsprecher (Kerzenständer-Telefon), schwarzer Lack und Messing
  telephone: () => mergeColored([C(lathe([[0, -0.15], [0.08, -0.15], [0.085, -0.13], [0.03, -0.11], [0.015, 0.05], [0.03, 0.07], [0.05, 0.1], [0.04, 0.12], [0, 0.12]], 14), [0.05, 0.05, 0.06]), C(cyl(0.012, 0.012, 0.14, 0.02, 8).rotateZ(Math.PI / 2).translate(-0.04, 0.02, 0), BRASS), C(lathe([[0, 0], [0.025, 0], [0.03, 0.05], [0, 0.06]], 10).translate(-0.11, 0.0, 0), [0.05, 0.05, 0.06]), C(cyl(0.006, 0.006, 0.1, 0.06, 6).rotateX(0.6).translate(0.05, 0.0, 0.08), [0.1, 0.1, 0.1])]),
  // Whiskyflasche, bernsteinfarbenes Glas, Etikett
  whisky: () => mergeColored([C(lathe([[0, -0.14], [0.04, -0.14], [0.042, 0.0], [0.03, 0.05], [0.014, 0.08], [0.014, 0.13], [0.017, 0.14], [0, 0.14]], 12), [0.5, 0.28, 0.08]), C(cyl(0.043, 0.043, 0.06, -0.06, 14), [0.9, 0.86, 0.74]), C(cyl(0.016, 0.016, 0.02, 0.135, 8), [0.2, 0.12, 0.06])]),
  // Apfel und Orange
  apple: () => mergeColored([C(new T.SphereGeometry(0.04, 12, 9).scale(1, 0.92, 1), [0.65, 0.12, 0.08]), C(cyl(0.003, 0.003, 0.02, 0.045, 5), [0.3, 0.2, 0.1])]),
  orange: () => mergeColored([C(new T.SphereGeometry(0.04, 12, 9), [0.9, 0.45, 0.08])]),
  /* ---- V52: Dinge der Straßen, des Hafens und des Arbeiterviertels ---- */
  // Holzfass mit Eisenreifen
  barrel: () => { const P = [C(lathe([[0, -0.42], [0.27, -0.42], [0.31, -0.2], [0.32, 0], [0.31, 0.2], [0.27, 0.42], [0, 0.42]], 18), [0.4, 0.27, 0.15])]; for (const y of [-0.3, -0.1, 0.1, 0.3]) P.push(C(new T.TorusGeometry(0.3 + 0.02 * (1 - Math.abs(y) * 2), 0.012, 5, 22).rotateX(Math.PI / 2).translate(0, y, 0), [0.1, 0.1, 0.11])); return mergeColored(P); },
  // Mülltonne aus Blech mit Deckel und Griffen
  dustbin: () => mergeColored([C(cyl(0.26, 0.23, 0.78, 0, 16), [0.4, 0.42, 0.43]), C(cyl(0.28, 0.27, 0.06, 0.41, 16), [0.35, 0.36, 0.37]), C(new T.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.44, 0), [0.38, 0.4, 0.41]), C(new T.TorusGeometry(0.05, 0.012, 5, 10).rotateX(Math.PI / 2).translate(0, 0.52, 0), [0.3, 0.3, 0.3]), C(box(0.03, 0.04, 0.1, 0.28, 0.1, 0), [0.3, 0.3, 0.3]), C(box(0.03, 0.04, 0.1, -0.28, 0.1, 0), [0.3, 0.3, 0.3])]),
  // Kohlensack aus Jute, zugebunden
  coalsack: () => mergeColored([C(new T.SphereGeometry(0.26, 12, 9).scale(0.85, 1.15, 0.75), [0.32, 0.27, 0.2]), C(cyl(0.07, 0.11, 0.1, 0.3, 10), [0.3, 0.25, 0.18]), C(new T.TorusGeometry(0.09, 0.012, 5, 10).rotateX(Math.PI / 2).translate(0, 0.27, 0), [0.5, 0.42, 0.3])]),
  // Blecheimer mit Henkel
  bucket: () => mergeColored([C(lathe([[0, -0.14], [0.11, -0.14], [0.14, 0.14], [0.145, 0.15], [0.125, 0.15], [0.1, -0.12], [0, -0.12]], 14), [0.45, 0.47, 0.5]), C(new T.TorusGeometry(0.14, 0.008, 5, 16, Math.PI).translate(0, 0.14, 0), [0.25, 0.25, 0.27])]),
  // Handlaterne (Sturmlaterne), Glas warm leuchtend
  lantern: () => mergeColored([C(cyl(0.07, 0.08, 0.05, -0.13, 10), [0.2, 0.2, 0.22]), C(cyl(0.055, 0.055, 0.14, -0.03, 10), [1.3, 0.95, 0.55]), C(cyl(0.08, 0.05, 0.05, 0.07, 10), [0.2, 0.2, 0.22]), C(cyl(0.012, 0.012, 0.06, 0.12, 6), [0.2, 0.2, 0.22]), C(new T.TorusGeometry(0.06, 0.006, 5, 12, Math.PI).translate(0, 0.14, 0), [0.25, 0.25, 0.27]), C(cyl(0.006, 0.006, 0.26, -0.05, 4).translate(0.058, 0, 0), [0.2, 0.2, 0.22]), C(cyl(0.006, 0.006, 0.26, -0.05, 4).translate(-0.058, 0, 0), [0.2, 0.2, 0.22])]),
  // Schrankkoffer, Leder mit Holzleisten und Messingbeschlägen
  trunk: () => { const P = [C(box(0.9, 0.5, 0.5), [0.3, 0.17, 0.09])]; for (const x of [-0.3, 0, 0.3]) P.push(C(box(0.05, 0.52, 0.52, x), [0.55, 0.42, 0.25])); for (const x of [-0.43, 0.43]) for (const y of [-0.23, 0.23]) P.push(C(box(0.05, 0.05, 0.52, x, y), BRASS)); P.push(C(box(0.92, 0.03, 0.52, 0, 0.08), [0.55, 0.42, 0.25]), C(box(0.08, 0.1, 0.02, 0, 0, 0.255), BRASS), C(new T.TorusGeometry(0.06, 0.012, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(0.46, 0, 0), [0.2, 0.12, 0.06]), C(new T.TorusGeometry(0.06, 0.012, 5, 10, Math.PI).rotateY(Math.PI / 2).translate(-0.46, 0, 0), [0.2, 0.12, 0.06])); return mergeColored(P); },
  // Milchkanne aus Blech
  milkcan: () => mergeColored([C(lathe([[0, -0.3], [0.17, -0.3], [0.18, 0.05], [0.14, 0.2], [0.09, 0.24], [0.09, 0.3], [0.1, 0.3], [0, 0.3]], 16), [0.6, 0.62, 0.64]), C(new T.TorusGeometry(0.05, 0.01, 5, 10, Math.PI).rotateZ(-Math.PI / 2).translate(0.19, 0.12, 0), [0.4, 0.4, 0.42]), C(new T.TorusGeometry(0.05, 0.01, 5, 10, Math.PI).rotateZ(Math.PI / 2).translate(-0.19, 0.12, 0), [0.4, 0.4, 0.42])]),
  // Hinweisschild auf Ständer ("Frisch gestrichen" braucht keine Schrift: Emailleschild mit Rand)
  signboard: () => mergeColored([C(box(0.5, 0.36, 0.02, 0, 0.42), [0.08, 0.3, 0.32]), C(box(0.44, 0.3, 0.004, 0, 0.42, 0.012), [0.9, 0.86, 0.75]), C(box(0.3, 0.03, 0.004, 0, 0.45, 0.015), [0.1, 0.1, 0.12]), C(box(0.2, 0.02, 0.004, 0, 0.39, 0.015), [0.1, 0.1, 0.12]), C(cyl(0.015, 0.015, 0.5, 0.0, 6), [0.15, 0.15, 0.16]), C(cyl(0.14, 0.16, 0.04, -0.23, 12), [0.15, 0.15, 0.16])]),
  // Weinkiste mit Flaschen
  winecrate: () => { const P = [C(box(0.5, 0.3, 0.34), [0.6, 0.47, 0.3]), C(box(0.46, 0.02, 0.3, 0, 0.14), [0.4, 0.3, 0.18])]; for (const x of [-0.17, -0.06, 0.06, 0.17]) for (const z of [-0.09, 0.09]) P.push(C(cyl(0.035, 0.035, 0.16, 0.2, 8).translate(x, 0, z), [0.05, 0.15, 0.08]), C(cyl(0.013, 0.013, 0.08, 0.3, 6).translate(x, 0, z), [0.05, 0.15, 0.08])); return mergeColored(P); },
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
  // V41: Penthouse
  book: { name: 'Bücherstapel', kind: 'box', he: [0.115, 0.0525, 0.08], m: 1.6, stuff: 'paper', small: true },
  candlestick: { name: 'Kerzenleuchter', kind: 'cyl', he: [0.065, 0.16, 0.065], m: 1.4, stuff: 'metal', small: true },
  decanter: { name: 'Karaffe', kind: 'cyl', he: [0.07, 0.14, 0.07], m: 1.8, stuff: 'glass', small: true },
  tumbler: { name: 'Whiskyglas', kind: 'cyl', he: [0.04, 0.05, 0.04], m: 0.3, stuff: 'glass', small: true },
  cigarbox: { name: 'Zigarrenkiste', kind: 'box', he: [0.12, 0.035, 0.08], m: 0.9, stuff: 'wood', small: true },
  cushion: { name: 'Samtkissen', kind: 'box', he: [0.2, 0.07, 0.2], m: 0.6, stuff: 'leather', small: true },
  cushionC: { name: 'Seidenkissen', kind: 'box', he: [0.2, 0.07, 0.2], m: 0.6, stuff: 'leather', small: true },
  frame: { name: 'Bilderrahmen', kind: 'box', he: [0.11, 0.14, 0.03], m: 0.5, stuff: 'wood', small: true },
  ashtray: { name: 'Aschenbecher', kind: 'cyl', he: [0.085, 0.02, 0.085], m: 0.7, stuff: 'metal', small: true },
  shaker: { name: 'Cocktailshaker', kind: 'cyl', he: [0.045, 0.13, 0.045], m: 0.8, stuff: 'metal', small: true },
  record: { name: 'Schellackplatte', kind: 'cyl', he: [0.15, 0.012, 0.15], m: 0.25, stuff: 'paper', small: true },
  clock: { name: 'Kaminuhr', kind: 'box', he: [0.14, 0.13, 0.065], m: 3, stuff: 'wood', small: true },
  telephone: { name: 'Fernsprecher', kind: 'cyl', he: [0.085, 0.15, 0.085], m: 2.4, stuff: 'metal', small: true },
  whisky: { name: 'Whiskyflasche', kind: 'cyl', he: [0.043, 0.14, 0.043], m: 1.2, stuff: 'glass', small: true },
  apple: { name: 'Apfel', kind: 'ball', he: [0.04, 0.04, 0.04], m: 0.18, stuff: 'food', small: true },
  orange: { name: 'Orange', kind: 'ball', he: [0.04, 0.04, 0.04], m: 0.2, stuff: 'food', small: true },
  // V52: Straßen, Hafen, Arbeiterviertel
  barrel: { name: 'Holzfass', kind: 'cyl', he: [0.32, 0.42, 0.32], m: 38, stuff: 'wood', small: false },
  dustbin: { name: 'Mülltonne', kind: 'cyl', he: [0.27, 0.46, 0.27], m: 13, stuff: 'metal', small: false },
  coalsack: { name: 'Kohlensack', kind: 'box', he: [0.22, 0.3, 0.2], m: 24, stuff: 'leather', small: false },
  bucket: { name: 'Eimer', kind: 'cyl', he: [0.145, 0.15, 0.145], m: 2.2, stuff: 'metal', small: true },
  lantern: { name: 'Sturmlaterne', kind: 'cyl', he: [0.08, 0.16, 0.08], m: 1.1, stuff: 'metal', small: true },
  trunk: { name: 'Schrankkoffer', kind: 'box', he: [0.46, 0.26, 0.26], m: 28, stuff: 'leather', small: false },
  milkcan: { name: 'Milchkanne', kind: 'cyl', he: [0.18, 0.3, 0.18], m: 9, stuff: 'metal', small: false },
  signboard: { name: 'Hinweisschild', kind: 'box', he: [0.25, 0.3, 0.16], m: 4, stuff: 'metal', small: false },
  winecrate: { name: 'Weinkiste', kind: 'box', he: [0.25, 0.22, 0.17], m: 11, stuff: 'wood', small: false },
};
// V53: die neuen Dinge (src/clutter-geos.js)
Object.assign(GEOS, clutterGeos()); Object.assign(KINDS, clutterKinds());
export function KINDS_OF() { return KINDS; }
export function propMaterial() { return propMat(); }
export function spawnProp(type, x, y, z, yaw = 0) {
  const k = KINDS[type]; if (!k || LOOSE.bodies.length >= MAX_BODIES) return null;
  return makeBody({ ...k, key: type, p: [x, y + k.he[1] + 0.01, z], yaw });
}

/* ---------- V52: Möbel der Räume als Körper (Telekinese auf Sofas, Sessel, Stühle, Tische, Lampen) ----------
   entrances.js (placeFurn) hat jedes Stück ins Verzeichnis MOV.list geschrieben, core.js (mergeGeos) die Eckenbereiche
   im festen Netz. Hier: Weltlage, Hüllmaße, Gewicht; das Stück verschwindet aus dem festen Netz (Ecken fallen auf einen
   Punkt zusammen, Kollisionsquader weg) und bekommt ein eigenes Netz mit denselben Materialien. Weit entfernt und unbewegt
   kommt es zurück (furnRestore). */
const FURN_INFO = {
  sofa: { name: 'Sofa', m: a => 70 + 14 * (a[0] || 3.4), stuff: 'leather', r: a => (a[0] || 3.4) / 2 + 0.3, cy: 0.5 },
  clubChair: { name: 'Sessel', m: () => 42, stuff: 'leather', r: () => 0.7, cy: 0.5 },
  diningChair: { name: 'Stuhl', m: () => 9, stuff: 'wood', r: () => 0.5, cy: 0.55 },
  bistroChair: { name: 'Bistrostuhl', m: () => 6, stuff: 'wood', r: () => 0.45, cy: 0.5 },
  roundTable: { name: 'Tisch', m: a => 16 + (a[2] ? 4 : 0), stuff: 'wood', r: a => (a[0] || 0.45) + 0.2, cy: 0.45 },
  barStool: { name: 'Barhocker', m: () => 8, stuff: 'wood', r: () => 0.4, cy: 0.45 },
  floorLamp: { name: 'Stehlampe', m: () => 12, stuff: 'metal', r: () => 0.5, cy: 0.9 },
  tableLamp: { name: 'Tischlampe', m: () => 2.5, stuff: 'metal', r: () => 0.3, cy: 0.25 },
  vasePlant: { name: 'Pflanzkübel', m: () => 9, stuff: 'metal', r: () => 0.5, cy: 0.45 },
};
export function furnInfo(e) { const I = FURN_INFO[e.type]; return { name: I.name, m: I.m(e.args), r: I.r(e.args), cy: I.cy, stuff: I.stuff }; }
// Weltlage eines Stücks (Villa: lokales System erst drehen)
export function movWorld(e) {
  if (e.w) return e.w;
  const f = e.frame; if (!f) return (e.w = { x: e.x, y: e.y, z: e.z, yaw: e.a });
  if (f.pf) f.x = f.pf.x, f.y = f.pf.y, f.z = f.pf.z, f.ry = f.pf.ry;   // V54: Luftschiff: das System fährt mit, nichts merken
  const cs = Math.cos(f.ry), sn = Math.sin(f.ry), w = { x: f.x + e.x * cs + e.z * sn, y: f.y + e.y, z: f.z - e.x * sn + e.z * cs, yaw: e.a + f.ry };
  if (!f.pf) e.w = w;
  return w;
}
// Material eines zusammengefassten Netzes (einmal gesucht, dann gemerkt)
const MAT_OF = new Map();
function matOfGeo(geo) {
  if (MAT_OF.has(geo)) return MAT_OF.get(geo);
  let mat = null; scene.traverse(o => { if (!mat && o.isMesh && o.geometry === geo) mat = o.material; });
  MAT_OF.set(geo, mat); return mat;
}
// Sitzt jemand darauf oder steht jemand mitten darin? (Ballsaal, Lobby, Villa)
function someoneOn(x0, z0, x1, z1, y) {
  for (const pd of peds) { if (!pd.sit || !pd.a || !pd.a.on) continue; const e = pd.a.m.elements; if (e[12] > x0 - 0.3 && e[12] < x1 + 0.3 && e[14] > z0 - 0.3 && e[14] < z1 + 0.3 && Math.abs(e[13] - y) < 1.6) return true; }
  // Gäste der Belmont-Lobby und des Ballsaals (eigene Figurenliste; sitzende Handlungen 7, 10, 11, 14, 19)
  if (interiorCrowd) for (const a of interiorCrowd.list) { const v = Math.floor(a.gait[1]); if (!(v === 7 || v === 10 || v === 11 || v === 14 || v === 19)) continue; if (a.x > x0 - 0.3 && a.x < x1 + 0.3 && a.z > z0 - 0.3 && a.z < z1 + 0.3 && Math.abs(a.y - y) < 1.6) return true; }
  return false;
}
// Ecken eines Stücks im festen Netz auf einen Punkt fallen lassen (und merken, um sie zurückzuholen)
function furnHide(e) {
  e.saved = [];
  const per = new Map();
  for (const r of e.ranges) {
    const at = r.geo.attributes.position, a = at.array, o = r.o * 3, n = r.c * 3;
    e.saved.push({ r, pos: a.slice(o, o + n) });
    const x = a[o], y = a[o + 1], z = a[o + 2];
    for (let i = 0; i < n; i += 3) { a[o + i] = x; a[o + i + 1] = y; a[o + i + 2] = z; }
    const u = per.get(at) || { o: o, e: o + n }; u.o = Math.min(u.o, o); u.e = Math.max(u.e, o + n); per.set(at, u);
  }
  for (const [at, u] of per) { at.updateRange.offset = u.o; at.updateRange.count = u.e - u.o; at.needsUpdate = true; }
}
function furnShow(e) {
  const per = new Map();
  for (const { r, pos } of e.saved || []) { const at = r.geo.attributes.position; at.array.set(pos, r.o * 3); const u = per.get(at) || { o: r.o * 3, e: r.o * 3 + pos.length }; u.o = Math.min(u.o, r.o * 3); u.e = Math.max(u.e, r.o * 3 + pos.length); per.set(at, u); }
  for (const [at, u] of per) { at.updateRange.offset = u.o; at.updateRange.count = u.e - u.o; at.needsUpdate = true; }
  e.saved = null;
}
export function furnBody(e) {
  if (!e || e.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  const I = furnInfo(e), W = movWorld(e), f = e.frame;
  const parts = FURN[e.type](...e.args).map(([g, role]) => [g.rotateY(e.a), role]);
  // lokaler Grundriss (für die Villa-Quader), dann die Weltlage
  const lb = new T.Box3(); for (const [g] of parts) { g.computeBoundingBox(); lb.union(g.boundingBox); }
  if (f) for (const [g] of parts) g.rotateY(f.ry);
  const bb = new T.Box3(); for (const [g] of parts) { g.computeBoundingBox(); bb.union(g.boundingBox); }
  const c = bb.getCenter(new T.Vector3()), he = bb.getSize(new T.Vector3()).multiplyScalar(0.5);
  const cx = W.x + c.x, cy = W.y + c.y, cz = W.z + c.z;
  if (someoneOn(cx - he.x, cz - he.z, cx + he.x, cz + he.z, W.y)) return 'sit';
  // Materialgruppen wie im Raum
  const byMat = new Map();
  for (const [g, role] of parts) {
    const key = e.map[role] || e.map.up, r = e.ranges.find(q => q.key === key), mat = (r && matOfGeo(r.geo)) || propMat();
    g.translate(-c.x, -c.y, -c.z); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // V54: Luftschiff-Stoffe färben je Ecke (Farbe des Teils aus e.cols), sonst wäre das Stück schwarz
    g.userData.cc = e.cols ? (e.cols[key] || [1, 1, 1]) : null;
    (byMat.get(mat) || byMat.set(mat, []).get(mat)).push(g);
  }
  const mats = [], gg = []; for (const [mat, list] of byMat) { mats.push(mat); gg.push(mergeGeos(list)); }
  const geo = mergeGeos(gg); let off = 0; gg.forEach((g, i) => { geo.addGroup(off, g.index.count, i); off += g.index.count; });
  if (e.cols) { const ca = new Float32Array(geo.attributes.position.count * 3); let o = 0; for (const list of byMat.values()) for (const g of list) { const n = g.attributes.position.count; for (let i = 0; i < n; i++) ca.set(g.userData.cc, (o + i) * 3); o += n; } geo.setAttribute('color', new T.BufferAttribute(ca, 3)); }
  const mesh = new T.Mesh(geo, mats);
  furnHide(e);
  e.taken = true;
  e.removed = { world: [], villa: [] };
  // Kollisionsquader des Stücks
  removeColliders(cx - he.x, cz - he.z, cx + he.x, cz + he.z, W.y, W.y + he.y * 2, e.removed.world);
  const LB = f && f.pf ? f.pf.boxes : f ? VILLA.boxes : null, ly = f && f.pf ? e.y : W.y;   // V54: Luftschiff: Quader der Gondel (y relativ zum Schiff)
  if (LB) {
    const lx0 = e.x + lb.min.x, lx1 = e.x + lb.max.x, lz0 = e.z + lb.min.z, lz1 = e.z + lb.max.z;
    for (let i = LB.length - 1; i >= 0; i--) {
      const b = LB[i];
      if (b.x1 - b.x0 > 6 || b.z1 - b.z0 > 6 || b.y1 - b.y0 > 2.6 || b.x0 < lx0 - 0.45 || b.x1 > lx1 + 0.45 || b.z0 < lz0 - 0.45 || b.z1 > lz1 + 0.45 || b.y0 < ly - 0.4 || b.y0 > ly + he.y * 2) continue;
      e.removed.villa.push(LB.splice(i, 1)[0]);
    }
  }
  const B = makeBody({ name: I.name, key: 'furn:' + e.id, kind: 'box', he: [he.x, he.y, he.z], m: I.m, stuff: I.stuff, small: false, p: [cx, cy, cz], yaw: 0, mesh, furn: e });
  B.x0 = B.x.clone();
  if (f && f.pf) rideOn(B, f.pf);
  return B;
}
// weit weg und unbewegt: das Stück kehrt an seinen Platz zurück
function furnRestore(B) {
  const e = B.furn; removeBody(B);
  furnShow(e); e.taken = false;
  for (const b of e.removed.world) addColliderBack(b);
  const LB = e.frame && e.frame.pf ? e.frame.pf.boxes : VILLA.boxes;
  if (LB) for (const b of e.removed.villa) LB.push(b);
  e.removed = null;
}
function addColliderBack(b) { const q = addCollider(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1); return q; }

/* ---------- V54: Ausreißen fester Stücke (src/tear.js): Poller, Masten, Fahnen, Tische, Hocker, Klavier, Fässer, Kisten, Bänke, Pumpe ----------
   Zusammengefasste Netze: die Ecken des Stücks werden mit Farben kopiert (Material des Netzes), im festen Netz fallen sie zusammen.
   Instanzen: Instanz auf 0, eigenes Netz aus der Vorlage. */
function sliceRanges(e, c) {
  // je Netz (= Material) ein Stück Geometrie mit position/normal/uv/color und umgerechnetem Index
  const by = new Map();
  for (const r of e.ranges) { if (!by.has(r.geo)) by.set(r.geo, []); by.get(r.geo).push(r); }
  const parts = [];
  for (const [geo, rs] of by) {
    const A = geo.attributes, hasC = !!A.color, hasUv = !!A.uv;
    let n = 0, ni = 0; for (const r of rs) { n += r.c; ni += r.ic || 0; }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = hasC ? new Float32Array(n * 3) : null, idx = new Uint32Array(ni);
    let o = 0, oi = 0;
    for (const r of rs) {
      const P = A.position.array, N = A.normal.array;
      for (let i = 0; i < r.c; i++) { const s = (r.o + i) * 3, d = (o + i) * 3; pos[d] = P[s] - c.x; pos[d + 1] = P[s + 1] - c.y; pos[d + 2] = P[s + 2] - c.z; nor[d] = N[s]; nor[d + 1] = N[s + 1]; nor[d + 2] = N[s + 2]; if (hasC) { col[d] = A.color.array[s]; col[d + 1] = A.color.array[s + 1]; col[d + 2] = A.color.array[s + 2]; } }
      if (hasUv) uv.set(A.uv.array.subarray(r.o * 2, (r.o + r.c) * 2), o * 2);
      if (geo.index && r.ic) { const I = geo.index.array; for (let k = 0; k < r.ic; k++) idx[oi + k] = I[r.io + k] - r.o + o; oi += r.ic; }
      o += r.c;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (hasC) g.setAttribute('color', new T.BufferAttribute(col, 3));
    if (ni) g.setIndex(new T.BufferAttribute(idx, 1));
    parts.push([g, matOfGeo(geo) || propMat()]);
  }
  // ein Netz mit Gruppen je Material
  let n = 0, ni = 0; for (const [g] of parts) { n += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3).fill(1), idx = new Uint32Array(ni), mats = [];
  const out = new T.BufferGeometry(); let o = 0, oi = 0;
  parts.forEach(([g, mat], gi) => {
    const c2 = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    const ic = g.index ? g.index.count : c2; if (g.index) { const I = g.index.array; for (let k = 0; k < ic; k++) idx[oi + k] = I[k] + o; } else for (let k = 0; k < ic; k++) idx[oi + k] = o + k;
    out.addGroup(oi, ic, gi); mats.push(mat); o += c2; oi += ic;
  });
  out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setAttribute('color', new T.BufferAttribute(col, 3)); out.setIndex(new T.BufferAttribute(idx, 1));
  return new T.Mesh(out, mats);
}
export function tearBody(e) {
  if (!e || e.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  const I = tearInfo(e); if (!I) return null;
  const c = I.c, he = I.he;
  if (e.seat && someoneOn(c.x - he.x, c.z - he.z, c.x + he.x, c.z + he.z, c.y - he.y)) return 'sit';
  let mesh;
  if (e.inst) { mesh = e.mesh(); hideInst(e); }
  else { mesh = sliceRanges(e, c); furnHide(e); }
  e.taken = true; e.removed = [];
  removeColliders(c.x - he.x, c.z - he.z, c.x + he.x, c.z + he.z, c.y - he.y, c.y + he.y, e.removed);
  const B = makeBody({ name: e.name, key: 'tear:' + e.id, kind: e.kind || 'box', he: [he.x, he.y, he.z], m: e.m || Math.max(5, Math.round(he.x * he.y * he.z * 8 * 220)), stuff: e.stuff || 'wood', small: false, p: [c.x, c.y, c.z], yaw: 0, mesh });
  B.tear = e; B.x0 = B.x.clone();
  return B;
}
function tearRestore(B) {
  const e = B.tear; removeBody(B); e.taken = false;
  if (e.inst) showInst(e, e.m0); else { furnShow(e); if (e.layer) invalidateLayer(e.layer); }
  for (const b of e.removed || []) addColliderBack(b);
  e.removed = null;
}

/* ---------- V54: Bäume ausreißen (serpentine.js TREE_SETS: Instanzen je Art, Nah- und Fernform) ----------
   Der Körper ist ein Quader um Stamm und Krone; sein Netz sind drei InstancedMeshes mit je einer Instanz (so bleiben die
   Shader-Varianten der Baum-Materialien gleich, Wind und Schnee inbegriffen, und die Kronenfarbe kommt als Instanzfarbe mit). */
const _tq = new T.Quaternion(), _tp = new T.Vector3(), _ts = new T.Vector3();
export function treeBody(st, p) {
  if (!st || !p || p.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  p.m.decompose(_tp, _tq, _ts);
  const bb = st.bb, sx = _ts.x, sy = _ts.y, sz = _ts.z;
  // Mitte und Halbmaße in Baumkoordinaten (vor der Drehung), dann gedreht an den Platz
  const cl = new T.Vector3((bb.min.x + bb.max.x) / 2 * sx, (bb.min.y + bb.max.y) / 2 * sy, (bb.min.z + bb.max.z) / 2 * sz);
  const he = [Math.max(0.6, (bb.max.x - bb.min.x) / 2 * sx * 0.8), Math.max(1, (bb.max.y - bb.min.y) / 2 * sy), Math.max(0.6, (bb.max.z - bb.min.z) / 2 * sz * 0.8)];
  const cw = cl.clone().applyQuaternion(_tq).add(_tp);
  const bake = new T.Matrix4().compose(cl.clone().negate(), new T.Quaternion(), new T.Vector3(1, 1, 1)).multiply(new T.Matrix4().makeScale(sx, sy, sz));
  const one = (geo, mat, tint) => { const im = new T.InstancedMesh(geo.clone().applyMatrix4(bake), mat, 1); im.setMatrixAt(0, new T.Matrix4()); if (tint) im.setColorAt(0, p.c); im.frustumCulled = false; return im; };
  const mesh = one(st.G.bark, st.mats.bark, false);
  mesh.add(one(st.G.blobs, st.mats.blobs, true), one(st.G.cards, st.mats.cards, true));
  p.taken = true; treeDirty();
  const m = Math.round(420 * sx * sy * sz * (st.sp === 'cyp' ? 0.6 : 1));
  const B = makeBody({ name: st.sp === 'cyp' ? 'Zypresse' : st.sp === 'plane' ? 'Platane' : 'Linde', key: 'tree:' + st.sp, kind: 'box', he, m, stuff: 'wood', small: false, p: [cw.x, cw.y, cw.z], yaw: 0, mesh });
  B.q.copy(_tq); B.tree = { st, p, cl, s: new T.Vector3(sx, sy, sz), q0: _tq.clone() }; B.x0 = B.x.clone();
  return B;
}
// Mitte und Greifradius eines stehenden Baums (für die Telekinese)
export function treeCenter(st, p) {
  p.m.decompose(_tp, _tq, _ts); const bb = st.bb;
  return { x: _tp.x, y: _tp.y + (bb.min.y + bb.max.y) / 2 * _ts.y, z: _tp.z, r: Math.max(0.8, (bb.max.x - bb.min.x) / 2 * _ts.x * 0.7), name: st.sp === 'cyp' ? 'Zypresse' : st.sp === 'plane' ? 'Platane' : 'Linde' };
}
// weit weg: der Baum kehrt in die Instanzen zurück, umgestürzt bleibt er liegen, wie er liegt
function treeRestore(B) {
  const t = B.tree, p = t.p; removeBody(B);
  if (B.x.distanceTo(B.x0) > 0.3 || B.q.angleTo(t.q0) > 0.05) {
    const M = new T.Matrix4().compose(B.x, B.q, new T.Vector3(1, 1, 1)).multiply(new T.Matrix4().makeTranslation(-t.cl.x, -t.cl.y, -t.cl.z)).multiply(new T.Matrix4().makeScale(t.s.x, t.s.y, t.s.z));
    p.m.copy(M); p.x = B.x.x; p.z = B.x.z;
  }
  p.taken = false; treeDirty();
}

/* ---------- V52: Straßenmöbel (Bänke, Papierkörbe, Hydranten, Briefkästen, Pflanzkübel) als Körper ----------
   Sie stehen als Instanzen in der Chunk-Schicht 'furniture' (props.js). Gepackt: Instanz auf Größe 0, p.taken, und ein
   Körper aus derselben Form; Bank und Papierkorb sind gebackene Modelle, der Rest Formen aus serpentine.js. */
const STREET_INFO = {
  bench: { name: 'Parkbank', m: 55, stuff: 'wood', kind: 'box', he: [0.9, 0.45, 0.25], cy: 0.45 },
  bin: { name: 'Papierkorb', m: 14, stuff: 'metal', kind: 'cyl', he: [0.24, 0.4, 0.24], cy: 0.4 },
  hydrant: { name: 'Hydrant', m: 85, stuff: 'metal', kind: 'cyl', he: [0.16, 0.37, 0.16], cy: 0.37 },
  mailbox: { name: 'Briefkasten', m: 60, stuff: 'metal', kind: 'box', he: [0.2, 0.7, 0.16], cy: 0.7 },
  planter: { name: 'Blumenkübel', m: 160, stuff: 'metal', kind: 'box', he: [0.85, 0.45, 0.35], cy: 0.45 },
  // V53: auch Kioske, Litfaßsäulen und Straßenuhren
  kiosk: { name: 'Kiosk', m: 600, stuff: 'wood', kind: 'box', he: [1.3, 1.2, 1.0], cy: 1.2 },
  column: { name: 'Litfaßsäule', m: 900, stuff: 'metal', kind: 'cyl', he: [0.72, 1.7, 0.72], cy: 1.7 },
  clock: { name: 'Straßenuhr', m: 240, stuff: 'metal', kind: 'cyl', he: [0.42, 2.15, 0.42], cy: 2.15 },
};
export const STREET_KINDS = Object.keys(STREET_INFO);
export function streetBody(p, k) {
  if (k === 'lamp') return lampBody(p);
  if (k && k.startsWith('c:')) return clutterBody(p);
  const I = STREET_INFO[k], F = STREET.furniture; if (!I || !F || p.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  const key = 'street:' + k;
  if (!GEOS[key]) {
    const bk = props.baked && props.baked[k], src = bk ? bk.geo : k === 'column' ? F.colParts : F.TYPES[k]; if (!src) return null;
    const bb0 = (k === 'column' ? F.colGeo : src), bb = bb0.boundingBox || (bb0.computeBoundingBox(), bb0.boundingBox);
    const b2 = src.boundingBox || (src.computeBoundingBox(), src.boundingBox), y0 = Math.min(bb.min.y, b2.min.y), y1 = Math.max(bb.max.y, b2.max.y), cy = (y0 + y1) / 2;
    const g = src.clone().translate(0, -cy, 0);
    GEOS[key] = () => g; GEOS[key].mat = bk ? (bk.material || F.mat) : F.mat; GEOS[key].cy = cy;
    if (!bk) I.he = [Math.max(0.1, (b2.max.x - b2.min.x) / 2), (y1 - y0) / 2, Math.max(0.1, (b2.max.z - b2.min.z) / 2)];
  }
  p.taken = true;
  hideInst(p);
  const e = p.m.elements, yaw = Math.atan2(e[8], e[10]), y = e[13];
  removeColliders(p.x - I.he[0] - 0.2, p.z - I.he[2] - 0.2, p.x + I.he[0] + 0.2, p.z + I.he[2] + 0.2, y, y + I.he[1] * 2, []);
  // Litfaßsäule (Plakate) und Uhr (Zifferblätter) haben zwei Netze: eigenes Netz mit Kind
  let mesh = null;
  if (k === 'column' || k === 'clock') {
    const cy = GEOS[key].cy;
    mesh = new T.Mesh(GEOS[key]().clone(), F.mat);
    mesh.add(new T.Mesh((k === 'column' ? F.colGeo : F.faces).clone().translate(0, -cy, 0), k === 'column' ? F.posterMat : F.faceMat));
  }
  const B = makeBody({ name: I.name, key, kind: I.kind, he: I.he, m: I.m, stuff: I.stuff, small: false, p: [p.x, y + GEOS[key].cy, p.z], yaw, col: p.c, src: p, mesh });
  B.street = p; B.x0 = B.x.clone();
  return B;
}
// V53: Instanz(en) eines Stücks verstecken oder zurückholen (p._ims: alle Netze der Zelle, in denen es steht)
function hideInst(p) {
  for (const [im, i] of p._ims || (p._im ? [[p._im, p._i]] : [])) if (im && im.parent) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.instanceMatrix.needsUpdate = true; }
}
function showInst(p, m) {
  for (const [im, i] of p._ims || (p._im ? [[p._im, p._i]] : [])) if (im && im.parent) { im.setMatrixAt(i, m); im.instanceMatrix.needsUpdate = true; }
}

/* ---------- V53: Laternen als Körper (Lichtkegel, Spiegelung und Leuchtpunkt gehen mit aus) ---------- */
function lampBody(l) {
  if (l.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  const G = decoLampGeo(l.h, 0), M = decoLampMats(), cy = l.h / 2;
  const mesh = new T.Mesh(G.metal.clone().translate(0, -cy, 0), M.metal);
  mesh.add(new T.Mesh(G.glass.clone().translate(0, -cy, 0), M.glass));
  l.taken = true; hideInst(l); lampFx(l, false);
  removeColliders(l.x - 0.45, l.z - 0.45, l.x + 0.45, l.z + 0.45, l.y, l.y + l.h, []);
  const B = makeBody({ name: 'Laterne', key: 'lamp', kind: 'box', he: [0.3, cy, 0.3], m: 150, stuff: 'metal', small: false, p: [l.x, l.y + cy, l.z], yaw: 0, mesh });
  B.lamp = l; B.x0 = B.x.clone();
  return B;
}
function lampRestore(B) { const l = B.lamp; removeBody(B); l.taken = false; lampFx(l, true); showInst(l, _m.makeTranslation(l.x, l.y, l.z)); }

/* ---------- V53: die vielen Dinge aus src/clutter.js ---------- */
function clutterBody(p) {
  const I = KINDS[p.k]; if (!I || p.taken || LOOSE.bodies.length >= MAX_BODIES) return null;
  p.taken = true; hideInst(p);
  if (p.col) { removeColliders(p.col[0] - 0.05, p.col[1] - 0.05, p.col[2] + 0.05, p.col[3] + 0.05, p.y - I.he[1] - 0.1, p.y + I.he[1], []); p.col = null; }
  const B = makeBody({ ...I, key: p.k, p: [p.x, p.y, p.z], yaw: p.yaw, col: p.c, src: p });
  clutterMatrix(p, _m); _m.decompose(_v, B.q, _s);
  B.clut = p; B.x0 = B.x.clone();
  return B;
}
function clutterRestore(B) {
  const p = B.clut, moved = B.x.distanceTo(B.x0) > 1.5;
  if (moved || B.x.distanceTo(B.x0) > 0.05) { p.x = B.x.x; p.y = B.x.y; p.z = B.x.z; p.q = B.q.clone(); }
  removeBody(B); p.taken = false;
  if (moved) { clutterMoved(p); return true; }
  showInst(p, clutterMatrix(p, _m));
  return false;
}
// Mittelpunkt, Greifradius und Gewicht eines Straßenstücks, einer Laterne oder eines Dings (für Telekinese und E)
export function streetCenter(p, k) {
  if (k === 'lamp') return { y: p.y + p.h * 0.5, r: 0.6, m: 150, name: 'Laterne' };
  if (k.startsWith('c:')) { const I = KINDS[p.k]; return { y: p.y, r: Math.max(0.25, Math.min(1.1, Math.max(I.he[0], I.he[1], I.he[2]) + 0.1)), m: I.m, name: I.name }; }
  const I = STREET_INFO[k]; return { y: p.m.elements[13] + I.cy, r: k === 'bench' || k === 'planter' || k === 'kiosk' || k === 'column' ? 1.0 : 0.5, m: I.m, name: I.name };
}
// weit weg und unbewegt: die Instanz kommt zurück (Kollision der Bank bleibt weg, sie sperrt nur den Gehweg)
function streetRestore(B) {
  const p = B.street; removeBody(B); p.taken = false;
  showInst(p, p.m);
}
// Nahes Straßenmöbel (für Telekinese und Aufheben): [p, art, Mittelpunkt]
export function streetNear(x, z, r) {
  const F = STREET.furniture, out = []; if (!F) return out;
  for (const k of STREET_KINDS) for (const p of F.out[k] || []) if (!p.taken && (p.x - x) ** 2 + (p.z - z) ** 2 < r * r) out.push([p, k]);
  if (CLUT.grid.size) out.push(...clutterNear(x, z, r));   // V53: Dinge und Laternen
  return out;
}
// Nahe Möbel des Verzeichnisses
export function movNear(x, z, r) {
  const out = [];
  for (const e of MOV.list) { if (e.taken) continue; const W = movWorld(e); if ((W.x - x) ** 2 + (W.z - z) ** 2 < r * r) out.push(e); }
  return out;
}
// V52: Platz schaffen: ferne, schlafende Körper abräumen. Gruppen (SPAWNS) merken sich, wo ihre Dinge liegen blieben,
// Möbel und Straßenmöbel kehren an ihren Platz zurück
let cullT = 0;
export function cullBodies(dt) {
  if ((cullT -= dt) > 0 || LOOSE.bodies.length < MAX_BODIES * 0.6) return; cullT = 3;
  const p = player.p; let relay = false;
  for (const B of LOOSE.bodies.slice()) {
    if (B.awake || B.pf || B.lev || B === LOOSE.held || B === LOOSE.tk || (B.x.x - p.x) ** 2 + (B.x.z - p.z) ** 2 < 320 * 320) continue;   // V54: an Bord räumt das Luftschiff selbst auf
    if (B.furn) { if (B.x0 && B.x.distanceTo(B.x0) < 1.5) furnRestore(B); }
    else if (B.street) { if (B.x0 && B.x.distanceTo(B.x0) < 1.5) streetRestore(B); }
    else if (B.lamp) { if (B.x0 && B.x.distanceTo(B.x0) < 1.5) lampRestore(B); }
    else if (B.clut) { if (clutterRestore(B)) relay = true; }
    else if (B.tear) { if (B.x0 && B.x.distanceTo(B.x0) < 1.5) tearRestore(B); }   // V54
    else if (B.tree) treeRestore(B);   // V54: umgestürzt bleibt er liegen
    else if (B.spawn) {
      const S = B.spawn.S, it = B.spawn.it;
      // bleibt liegen, wo es ist: beim Wiederkommen entsteht es dort (die Gruppe erst, wenn keines ihrer Dinge mehr da ist)
      const e = B.q, yaw = Math.atan2(2 * (e.w * e.y + e.x * e.z), 1 - 2 * (e.y * e.y + e.z * e.z)), up = B.x.y - B.he.y * B.sc - (S.floor || 0);
      it[1] = B.x.x; it[2] = B.x.z; it[3] = yaw; it[4] = up > 0.3 ? up : 0;
      removeBody(B);
      if (!LOOSE.bodies.some(b => b.spawn && b.spawn.S === S)) S.done = false;
    }
  }
  if (relay) invalidateLayer('clutter');   // V53: verschobene Dinge stehen in einer anderen Zelle
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
const HIT = { n: new T.Vector3(), d: 0, vx: 0, vz: 0 }, _lp1 = new T.Vector3(), _lp2 = new T.Vector3();

/* ---------- V54: Dinge an Bord fahren mit (Luftschiff) ----------
   RIDES: Plattformen, die Dinge mitnehmen ({ pf, inside(lx, ly, lz) }); ein Körper mit B.pf wird jedes Bild um die
   Bewegung der Plattform seit dem letzten Bild verschoben und gedreht (auch schlafend) und stößt nur an deren Quader.
   Fliegt er aus der Gondel (über die Reling), gehört er wieder zur Stadt; fliegt etwas hinein, fährt es mit. */
export const RIDES = [];
export function rideOn(B, pf) { B.pf = pf; B.pl = { x: pf.x, y: pf.y, z: pf.z, ry: pf.ry }; }
function rideLocal(pf, v) { const cs = Math.cos(pf.ry), sn = Math.sin(pf.ry), dx = v.x - pf.x, dz = v.z - pf.z; return [dx * cs - dz * sn, v.y - pf.y, dx * sn + dz * cs]; }
function carryRides() {
  if (!RIDES.length) return;
  for (const B of LOOSE.bodies) {
    if (B.pf) {
      const f = B.pf, l = B.pl;
      const dr = f.ry - l.ry;
      if (dr || f.x !== l.x || f.y !== l.y || f.z !== l.z) {
        const c0 = Math.cos(l.ry), s0 = Math.sin(l.ry), c1 = Math.cos(f.ry), s1 = Math.sin(f.ry);
        const mv = v => { const dx = v.x - l.x, dz = v.z - l.z, lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0; v.x = f.x + lx * c1 + lz * s1; v.z = f.z - lx * s1 + lz * c1; v.y += f.y - l.y; };
        mv(B.x); if (B.anchor) mv(B.anchor);
        if (dr) { _q.setFromAxisAngle(_up, dr); B.q.premultiply(_q); if (B.anchorQ) B.anchorQ.premultiply(_q); B.v.applyQuaternion(_q); }
        l.x = f.x; l.y = f.y; l.z = f.z; l.ry = f.ry;
      }
      const R = RIDES.find(q => q.pf === f), [lx, ly, lz] = rideLocal(f, B.x);
      if (!R || !R.inside(lx, ly, lz)) { B.pf = null; B.pl = null; B.awake = true; }
    } else if (B.awake || B === LOOSE.held || B === LOOSE.tk) {
      for (const R of RIDES) { const [lx, ly, lz] = rideLocal(R.pf, B.x); if (R.inside(lx, ly, lz)) { rideOn(B, R.pf); break; } }
    }
  }
}
export function dropBody(B) { removeBody(B); }
// Plattform weit weg: alles an Bord zurück an seinen Platz (Möbel) bzw. weg (Dinge, die das Schiff neu auslegt)
export function rideHome(pf) {
  let n = 0;
  for (const B of LOOSE.bodies.slice()) {
    if (B.pf !== pf || B === LOOSE.held || B === LOOSE.tk) continue;
    if (B.furn) furnRestore(B); else removeBody(B);
    n++;
  }
  return n;
}
// Vorbereitung je Bild und Körper: Quader in der Nähe, Bodenhöhe unter jedem Hüllpunkt
function prepEnv(B) {
  const r = B.r + 0.6, x = B.x.x, z = B.x.z, y = B.x.y;
  B.boxes.length = 0;
  if (B.pf) {
    // V54: an Bord des Luftschiffs: nur die Quader der Gondel (lokal), kein Boden der Stadt darunter
    const f = B.pf, cs = Math.cos(f.ry), sn = Math.sin(f.ry), dx = x - f.x, dz = z - f.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, ly = y - f.y;
    B.pfb = f.boxes.filter(b => b.x1 > lx - r && b.x0 < lx + r && b.z1 > lz - r && b.z0 < lz + r && b.y1 > ly - r - 0.5 && b.y0 < ly + r);
    B.villa = null; B.gpts.fill(-1e9); B.wet = false;
    return;
  }
  B.pfb = null;
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
  if (B.pfb && B.pfb.length) {
    const f = B.pf, cs = Math.cos(f.ry), sn = Math.sin(f.ry);
    const lp = _lp1.set((P.x - f.x) * cs - (P.z - f.z) * sn, P.y - f.y, (P.x - f.x) * sn + (P.z - f.z) * cs);
    const l0 = _lp2.set((P0.x - f.x) * cs - (P0.z - f.z) * sn, P0.y - f.y, (P0.x - f.x) * sn + (P0.z - f.z) * cs);
    for (const b of B.pfb) { const dd = inBox(lp, l0, b, _v3); if (dd > d) { d = dd; HIT.n.set(_v3.x * cs + _v3.z * sn, _v3.y, -_v3.x * sn + _v3.z * cs); } }
  }
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
  if (isTouch) { const el = $('tThrow'), lab = LOOSE.held || LOOSE.tkAny ? 'WERFEN' : 'STOSS'; if (el.hidden) el.hidden = false; if (el.textContent !== lab) el.textContent = lab; }   // V33: auch für die Telekinese; V59: sonst Energieschub
  if (!paused) carryRides();   // V54: Dinge an Bord des Luftschiffs fahren mit
  if (paused || !LOOSE.bodies.length) { drawBatches(); return; }
  const t0 = performance.now();
  dt = Math.min(dt, 1 / 30);
  cullBodies(dt);
  const cp = camera.position, H = LOOSE.held;
  const act = LOOSE.bodies.filter(B => { const far = (B.x.x - cp.x) ** 2 + (B.x.z - cp.z) ** 2 > 160 * 160; return !far && (B.awake || B === H || B === LOOSE.tk || B.lev); });
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
      else if (B === LOOSE.tk && LOOSE.tkTarget) tkDrive(B, LOOSE.tkTarget, h);
      else if (B.lev) tkDrive(B, B.lev, h);   // V60: Levitation, kreist um Alexander (kraefte.js)
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
    if (B === H || B === LOOSE.tk || B.lev) { B.still = 0; continue; }
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
// V33: Telekinese (Alexander): jedes Gewicht schwebt zum Zielpunkt vor dem Blick und dreht sich langsam
function tkDrive(B, p, h) {
  _v.subVectors(p, B.x);
  B.v.copy(_v).multiplyScalar(6).clampLength(0, 40);
  B.w.multiplyScalar(1 - Math.min(1, h * 3)); B.w.y += h * 0.6;
}
export function pickUp(B) {
  if (!B) return;
  if (LOOSE.tk === B) return;
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
  // V52: leichte Möbel (Stühle, Hocker, Lampen) und Papierkörbe lassen sich auch von Hand aufheben
  for (const e of movNear(_ro.x, _ro.z, REACH + 1)) {
    const I = furnInfo(e); if (I.m > 20) continue;
    const W = movWorld(e); _v.set(W.x - _ro.x, W.y + I.cy - _ro.y, W.z - _ro.z);
    const t = _v.dot(_rd); if (t < 0 || t > bt) continue;
    if (_v.lengthSq() - t * t > I.r * I.r) continue;
    bt = t; best = { furn: e, name: I.name };
  }
  // V53: Papierkörbe und alle leichten Dinge (bis 30 kg) von Hand
  for (const [p, k] of streetNear(_ro.x, _ro.z, REACH + 1)) {
    if (k !== 'bin' && !k.startsWith('c:')) continue;
    const c = streetCenter(p, k); if (c.m > 30) continue;
    _v.set(p.x - _ro.x, c.y - _ro.y, p.z - _ro.z);
    const t = _v.dot(_rd); if (t < 0 || t > bt) continue;
    if (_v.lengthSq() - t * t > Math.min(0.5, c.r) ** 2) continue;
    bt = t; best = { street: p, kind: k, name: c.name };
  }
  // V54: leichte feste Stücke (Hocker, Stühle, Kisten) lassen sich auch von Hand herausreißen
  for (const e of tearNear(_ro.x, _ro.z, REACH + 1)) {
    if ((e.m || 99) > 30) continue;
    const I = tearInfo(e); _v.set(I.c.x - _ro.x, I.c.y - _ro.y, I.c.z - _ro.z);
    const t = _v.dot(_rd); if (t < 0 || t > bt) continue;
    if (_v.lengthSq() - t * t > Math.min(0.6, Math.max(I.he.x, I.he.z) + 0.1) ** 2) continue;
    bt = t; best = { tear: e, name: e.name };
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
    test: p => { if (LOOSE.held || p.y > 1500) return false; LOOSE.aim = aim(); if (!LOOSE.aim) return false; const a = LOOSE.aim; aimLabel.label = 'Aufheben: ' + (a.body ? a.body.name : a.name || GOODS_NAME[a.goods.m] || 'Ware'); return true; },
    get label() { return aimLabel.label; },
    act: () => { const a = LOOSE.aim; if (!a) return; if (a.furn) { const B = furnBody(a.furn); if (B === 'sit') { toast('Da sitzt jemand'); return; } pickUp(B); return; } if (a.street) { pickUp(streetBody(a.street, a.kind)); return; } if (a.tear) { const B = tearBody(a.tear); if (B === 'sit') { toast('Da sitzt jemand'); return; } pickUp(B); return; } pickUp(a.body || takeGoods(a.goods)); },
  });
  for (const V of VENUES) SPAWNS.push(...venueSpawns(V));
  SPAWNS.push(...ORTE.spawns);   // V58: Goldbarren im Tresor, Sekt an der Theaterbar, Zeitungen am Café
  citySpawns();
}
// V52: Dinge, die in der ganzen Stadt herumstehen: vor Läden, bei den Cafés, an den Feuertonnen und auf dem Kneipenplatz
function citySpawns() {
  const rs = mulberry32(5252);
  let n = 0;
  for (const d of DOORS) {
    if (Math.hypot(d.x, d.z) > 820 || rs() > 0.3 || n > 60) continue;
    const tx = -d.nz, tz = d.nx, sd = rs() < 0.5 ? -1 : 1, x = d.x + d.nx * 1.3 + tx * sd * 1.7, z = d.z + d.nz * 1.3 + tz * sd * 1.7, yaw = Math.atan2(d.nx, d.nz) + (rs() - 0.5);
    let items;
    if (d.kind === 'shop') items = rs() < 0.5 ? [['winecrate', x, z, yaw], ['winecrate', x + tx * sd * 0.6, z + tz * sd * 0.6, yaw + 0.2], ['signboard', x - tx * sd * 0.8, z - tz * sd * 0.8, yaw]] : [['crate', x, z, yaw], ['papers', x + tx * sd * 0.7, z + tz * sd * 0.7, yaw + 1], ['dustbin', x + d.nx * 0.4 + tx * sd * 1.4, z + d.nz * 0.4 + tz * sd * 1.4, yaw]];
    else if (d.kind === 'cafe' || d.kind === 'restaurant') items = [['signboard', x, z, yaw], ['milkcan', x + tx * sd * 0.6, z + tz * sd * 0.6, 0]];
    else if (d.kind === 'bar' || d.kind === 'pub') items = [['barrel', x, z, 0], ['dustbin', x + tx * sd * 0.8, z + tz * sd * 0.8, 0], ['bucket', x + d.nx * 0.5, z + d.nz * 0.5, 0]];
    else if (d.kind === 'workshop') items = [['barrel', x, z, 0], ['coalsack', x + tx * sd * 0.7, z + tz * sd * 0.7, 0], ['bucket', x + tx * sd * 1.2, z + tz * sd * 1.2, 0], ['lantern', x - tx * sd * 0.5, z - tz * sd * 0.5, 0]];
    else if (d.kind === 'hotel') items = [['trunk', x, z, yaw], ['suitcase', x + tx * sd * 0.8, z + tz * sd * 0.8, yaw + 0.3], ['hatbox', x + tx * sd * 0.5, z + tz * sd * 0.5 + 0.3, 0]];
    else continue;
    SPAWNS.push({ x, z, items, y: 3 }); n++;
  }
  for (const b of WORK.braziers) SPAWNS.push({ x: b.x, z: b.z, items: [['coalsack', b.x + 1.5, b.z + 0.4, 0], ['coalsack', b.x + 1.9, b.z + 0.9, 0.7], ['bucket', b.x - 1.4, b.z + 0.8, 0], ['barrel', b.x + 0.5, b.z - 1.7, 0]], y: 3 });
  const S = WORK.square;
  if (S) { const P = S.pub, x = P.x - P.w / 2 - 1.6, z = P.z + P.d / 2 + 1.2;
    SPAWNS.push({ x, z, items: [['barrel', x, z, 0], ['barrel', x + 0.75, z + 0.1, 0.4], ['barrel', x + 0.37, z + 0.05, 0.2, 0.86], ['coalsack', x + 1.8, z + 0.6, 0], ['coalsack', x + 2.2, z + 0.2, 0.5], ['bucket', x - 0.9, z + 0.5, 0], ['lantern', x - 0.6, z - 0.4, 0], ['milkcan', x + 2.9, z + 0.3, 0], ['milkcan', x + 3.3, z + 0.5, 0], ['dustbin', x - 1.8, z + 0.2, 0], ['trunk', P.x + P.w / 2 + 1.5, z, 0.2], ['crate', P.x + P.w / 2 + 2.4, z + 0.3, 0.1]], y: 3 }); }
}
const aimLabel = { label: 'Aufheben' };

/* ---------- Wo Dinge herumliegen: Gruppen, die beim Näherkommen entstehen ---------- */
// [x, z, Art, Gierwinkel, Höhe (Boden darunter wird gesucht, von hier aus nach unten)]
export const SPAWNS = [
  // vor dem Belmont, gleich am Startpunkt: Gepäck eines ankommenden Gastes, Zeitungen, ein Palmentopf
  { x: -5, z: 116, items: [['suitcase', -5, 116, 0.3], ['suitcase', -4.3, 116.6, 1.8], ['hatbox', -5.6, 116.9, 0], ['papers', 5.5, 117, 0.6], ['papers', 5.9, 116.5, 2.1], ['crate', 6.8, 118.2, 0.2], ['vase', -7.5, 114, 0], ['chair', 4.2, 115.2, 2.4]], y: 3 },
  // Hafen: Kisten gestapelt, Koffer an der Mole
  { x: 60, z: 512, items: [['crate', 58, 512, 0.1], ['crate', 58.7, 512.1, 0.15], ['crate', 58.35, 512, 0.05, 0.55], ['crate', 62, 510.5, 0.9], ['suitcase', 61, 514, 0.4], ['suitcase', 61.3, 514.4, 0.2, 0.25],
    // V52: Fässer, Milchkannen, ein Schrankkoffer, Laternen und Eimer an der Mole
    ['barrel', 64.5, 512.2, 0], ['barrel', 65.2, 512.0, 0.5], ['barrel', 64.85, 512.1, 0.2, 0.86], ['milkcan', 56.2, 514.8, 0], ['milkcan', 56.6, 515.1, 0.3], ['trunk', 63.5, 515.5, 0.4], ['lantern', 57.5, 510.6, 0], ['bucket', 63, 509, 0], ['coalsack', 66.5, 514, 0.3], ['coalsack', 66.9, 514.4, 0.9]], y: 3 },
  // V52: vor dem Belmont auch ein Schrankkoffer und Hinweisschilder des Portiers
  { x: 8, z: 116, items: [['trunk', 8.2, 116.8, 0.4], ['signboard', -8.6, 118.5, 0.1], ['lantern', 7.4, 115.6, 0], ['luggagecart', 10.5, 117.6, 0.3], ['umbrellastand', -9.8, 115.4, 0]], y: 3 },
];
function venueSpawns(V) {
  const out = [], F = V.F || 0, items = [];
  const pub = V.kind === 'bar';   // V46: in der Kneipe Whisky, Gläser und Aschenbecher statt Champagner
  V.tables.slice(0, 6).forEach((t, i) => {
    if (i % 2 === 0) items.push([pub ? 'whisky' : 'champagne', t.x + 0.08, t.z - 0.05, 0, F + 0.78 - (F + 0.0)]);
    items.push([pub ? 'tumbler' : 'coupe', t.x - 0.12, t.z + 0.1, 0, F + 0.78 - F], [pub ? 'ashtray' : 'coupe', t.x + 0.15, t.z + 0.16, 0, F + 0.78 - F]);
  });
  for (let k = 0; k < 3; k++) items.push(['chair', V.x0 + 2.5 + k * 1.6, V.z1 - 1.4, Math.PI + k * 0.3]);
  // V53: in der Kneipe Bierkästen am Eingang, im Restaurant Rosen und Sektkühler
  if (pub) items.push(['bottlecrate', V.x0 + 1.0, V.z1 - 1.0, 0.2], ['bottlecrate', V.x0 + 1.0, V.z1 - 1.0, 0.25, 0.3], ['radio', V.x1 - 1.2, V.z0 + 1.0, 0]);
  else V.tables.slice(0, 4).forEach((t, i) => items.push([i % 2 ? 'flowervase' : 'icebucket', t.x - 0.1, t.z - 0.15, 0, 0.78]));
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
    if (S.done || (S.x - p.x) ** 2 + (S.z - p.z) ** 2 > 110 * 110 || (S.y0 != null && p.y < S.y0)) continue;   // V41: y0 = erst ab dieser Höhe (Penthouse über der Lobby)
    S.done = true;
    for (const it of S.items) {
      const [type, x, z, yaw, up] = it;
      const yTop = (S.floor ?? 0) + (typeof up === 'number' && up > 0.3 ? up + 0.3 : S.y);
      const y = floorBelow(x, z, yTop);
      const B = spawnProp(type, x, (y > -1e8 ? y : 0) + (typeof up === 'number' && up <= 0.3 ? up : 0), z, yaw);
      if (B) { B.awake = true; B.spawn = { S, it }; }
    }
  }
}
// für Konsole und Tests: vespera.loose.pickUp(vespera.loose.bodies[0]) usw.
Object.assign(LOOSE, { pickUp, drop, spawnProp, rotateHeld });
