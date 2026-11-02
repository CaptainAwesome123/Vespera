import { T } from './core.js';
import { stdMat } from './people-skeleton.js';
import { loadTexture } from './assets.js';

/* =====================================================================
   V54 · EINGANGS-BAUKASTEN: alle Hauseingänge der Stadt aus einer Familie
   Ein Atlas (assets/textures/portal-*, gezeichnet mit tools/make-portal-atlas.py, 2048 px mit
   Relief-Normalen): Bronze-Glas-Doppeltür, Nussbaumtür mit Messing-Sonnenfächer, Arbeitertür aus
   Planken, halbrundes Fächer-Oberlicht, gerades Oberlicht, Sturz-Relief, Kalkstein, schwarzer Marmor,
   Bronzeblech, Kanneluren, Winkelrelief, Backstein. Wo Glas ist, ist das Bild durchsichtig; dahinter
   liegt eine beleuchtete Halle (eigene Fläche, unbeleuchtetes Material), so sieht man durch die
   Gitter ins Warme.
   Aufbau eines Eingangs: Stufen, gestufte Laibung in zwei bis drei Lagen (Art-déco-Zikkurat),
   Sturz mit Relief, Krone, Laternen, Vordach. Drei Stufen: Prachtportal (Zentrum), Bürgerhaus (Mitte),
   Arbeiterviertel (Backsteinpfeiler, Eisensturz, Plankentür, Emaillelampe).
   Zwei Materialien je Zelle (Baukasten + Halle); alles in eine Geometrie je Material.
   ===================================================================== */

const N = 2048, PAD = 2;
// x, y, w, h in Pixeln (y von oben) – gleich wie TILES in tools/make-portal-atlas.py
export const ATLAS = {
  doorBronze: [0, 0, 768, 1024], doorWood: [768, 0, 640, 1024], doorWork: [1408, 0, 512, 1024], glow: [1920, 0, 128, 1024],
  fan: [0, 1024, 1024, 512], transom: [1024, 1024, 1024, 256], relief: [1024, 1280, 1024, 256],
  lime: [0, 1536, 512, 512], marble: [512, 1536, 512, 512], bronze: [1024, 1536, 256, 512], flute: [1280, 1536, 256, 512], chevron: [1536, 1536, 256, 512], brick: [1792, 1536, 256, 512],
};
// Meter je Kachel (Breite, Höhe) für gekachelte Flächen
const TM = { lime: [1.6, 1.6], marble: [1.2, 1.2], bronze: [0.5, 1.0], flute: [0.5, 1.0], chevron: [0.5, 1.0], brick: [1.0, 2.0] };

// Ausschnitt einer Kachel als [u0, u1, v0, v1]; a/b = Anteile von links bzw. von unten
export function tileUV(name, a0 = 0, a1 = 1, b0 = 0, b1 = 1) {
  const [x, y, w, h] = ATLAS[name];
  const U = t => (x + PAD + (w - 2 * PAD) * t) / N, V = t => 1 - (y + h - PAD - (h - 2 * PAD) * t) / N;
  return [U(a0), U(a1), V(b0), V(b1)];
}

/* ---------- Materialien (einmal, Texturen kommen nach) ---------- */
let KM = null;
const ph = (r, g, b, a = 255) => { const t = new T.DataTexture(new Uint8Array([r, g, b, a]), 1, 1); t.needsUpdate = true; return t; };
function pullDepth(mat, key) {
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2;
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position = projectionMatrix * vec4(mvPosition.xyz * 0.9995, 1.0);'); };
  mat.customProgramCacheKey = () => key;
  return mat;
}
export function kitMats() {
  if (KM) return KM;
  const col = ph(200, 190, 170), nrm = ph(128, 128, 255), orm = ph(255, 200, 0);
  col.encoding = T.sRGBEncoding;
  const kit = stdMat({ map: col, normalMap: nrm, roughnessMap: orm, metalnessMap: orm, roughness: 1, metalness: 1, vertexColors: true, alphaTest: 0.5,
    emissive: 0x58493a, emissiveMap: col, envI: 0.32 });
  kit.normalScale = new T.Vector2(1.4, 1.4);
  const glow = pullDepth(new T.MeshBasicMaterial({ map: col, vertexColors: true }), 'kitGlow');
  KM = { kit, glow };
  // Atlas laden; die Programme bleiben dieselben (Platzhalter haben dieselben Plätze)
  const set = (name, fn) => loadTexture(name).then(t => { fn(t); }).catch(() => {});
  set('portal-color', t => { t.encoding = T.sRGBEncoding; kit.map = kit.emissiveMap = glow.map = t; });
  set('portal-normal', t => { t.encoding = T.LinearEncoding; kit.normalMap = t; });
  set('portal-orm', t => { t.encoding = T.LinearEncoding; kit.roughnessMap = kit.metalnessMap = t; });
  return KM;
}

/* ---------- Geometrie-Sammler: Vierecke im Wandsystem (lx entlang der Wand, y hoch, lz nach außen) ---------- */
export class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; this.k = 0; this.col = [1, 1, 1]; }
  at(x, z, o) { this.fx = x; this.fz = z; this.o = o; this.ax = o[1]; this.az = -o[0]; return this; }   // echte Drehung (lx = rechts von außen gesehen), sonst kippt die Umlaufrichtung
  // Viereck: Ecke P, Achsen U, V (Einheitsvektoren, lokal), Größen su, sv, Atlas-Ausschnitt R
  quad(P, U, V, su, sv, R, flip = false) {
    const { fx, fz, o, ax, az } = this, c = this.col;
    const n = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]];
    const wn = [ax * n[0] + o[0] * n[2], n[1], az * n[0] + o[1] * n[2]];
    const [u0, u1, v0, v1] = R, ua = flip ? u1 : u0, ub = flip ? u0 : u1;
    const corners = [[0, 0, ua, v0], [su, 0, ub, v0], [su, sv, ub, v1], [0, sv, ua, v1]];
    for (const [a, b, u, v] of corners) {
      const lx = P[0] + U[0] * a + V[0] * b, y = P[1] + U[1] * a + V[1] * b, lz = P[2] + U[2] * a + V[2] * b;
      this.p.push(fx + ax * lx + o[0] * lz, y, fz + az * lx + o[1] * lz); this.n.push(...wn); this.uv.push(u, v); this.c.push(c[0], c[1], c[2]);
    }
    const k = this.k; this.i.push(k, k + 1, k + 2, k, k + 2, k + 3); this.k += 4;
  }
  // Fläche mit Kachel: fit = ganze Kachel (oder Ausschnitt r) auf die Fläche, sonst nach Metern gekachelt
  face(P, U, V, su, sv, S) {
    if (!S) return;
    if (typeof S === 'string') S = { t: S };
    if (S.fit || !TM[S.t]) { this.quad(P, U, V, su, sv, S.r || tileUV(S.t), S.flip); return; }
    const [mu, mv] = S.m || TM[S.t];
    const off = S.off || 0;
    for (let a = 0; a < su - 1e-4;) {
      let ua = (a + off) % mu; if (mu - ua < 1e-5) ua = 0;   // Rundung: sonst endlose Schritte von 1e-16
      const du = Math.min(su - a, mu - ua);
      for (let b = 0; b < sv - 1e-4;) {
        let vb = b % mv; if (mv - vb < 1e-5) vb = 0;
        const dv = Math.min(sv - b, mv - vb);
        this.quad([P[0] + U[0] * a + V[0] * b, P[1] + U[1] * a + V[1] * b, P[2] + U[2] * a + V[2] * b], U, V, du, dv, tileUV(S.t, ua / mu, (ua + du) / mu, vb / mv, (vb + dv) / mv));
        b += dv;
      }
      a += du;
    }
  }
  // Quader von x0..x1, y0..y1, z0..z1 (lokal); F: { f: vorne, s: Seiten, t: oben, b: unten } (fehlend = keine Fläche, Rückseite liegt an der Wand)
  box(x0, x1, y0, y1, z0, z1, F) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    this.face([x0, y0, z1], [1, 0, 0], [0, 1, 0], sx, sy, F.f);
    if (F.s) { this.face([x0, y0, z0], [0, 0, 1], [0, 1, 0], sz, sy, F.sl || F.s); this.face([x1, y0, z1], [0, 0, -1], [0, 1, 0], sz, sy, F.sr || F.s); }
    this.face([x0, y1, z1], [1, 0, 0], [0, 0, -1], sx, sz, F.t);
    this.face([x0, y0, z0], [1, 0, 0], [0, 0, 1], sx, sz, F.b);
  }
  // senkrechte Fläche nach vorn (Türen, Oberlichter, Halle)
  front(x0, x1, y0, y1, z, S) { this.face([x0, y0, z], [1, 0, 0], [0, 1, 0], x1 - x0, y1 - y0, S); }
  geo() {
    if (!this.k) return null;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.k > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
    return g;
  }
}

/* ---------- Bauteile ---------- */
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
// Steinfarbe: heller Kalkstein, leicht zur Hausfarbe gezogen (so passt der Eingang zur Fassade)
function stoneCol(tint) {
  if (!tint) return [1, 1, 1];
  const l = (tint[0] + tint[1] + tint[2]) / 3 || 1;
  return tint.map(v => 0.9 + 0.1 * Math.min(1.4, v / l));
}
const COL = { white: [1, 1, 1], bronzeDark: [0.75, 0.75, 0.75], iron: [0.22, 0.22, 0.24], concrete: [0.58, 0.58, 0.6] };

// Halle hinter dem Glas und die Tür davor
function opening(K, G, x0, x1, y0, y1, light) {
  G.col = [light, light, light];
  G.front(x0, x1, y0, y1, 0.03, { t: 'glow', fit: true });
}

/* Prachtportal (grade 2), Bürgerhaus-Portal (1) und Arbeiter-Portal (0).
   K/G: Sammler für Baukasten und Halle; p: Teile aus deco.js (Laternen, Vordach-Birnen, Friese) */
export function kitPortal(P, K, G, p, parts) {
  K.at(P.x, P.z, P.o); G.at(P.x, P.z, P.o);
  if (P.grade === 0) return workerPortal(P, K, G, p, parts);
  const noir = (P.kind === 'bar' || P.kind === 'restaurant') && hash(P.x, P.z) < 0.6;   // schwarzer Marmor mit Gold
  const sc = stoneCol(P.tint), jamb = noir ? 'marble' : 'lime';
  // Halle, Türen, Oberlichter, Seitenlichter
  opening(K, G, -2.15, 2.15, 0.5, 4.95, 1);
  K.col = COL.white;
  K.front(-1.2, 1.2, 0.5, 3.7, 0.1, { t: 'doorBronze', fit: true });
  K.front(-1.2, 1.2, 3.75, 4.95, 0.1, { t: 'fan', fit: true });
  const sideR = s => tileUV('doorBronze', s < 0 ? 0 : 0.5, s < 0 ? 0.5 : 1, 0, 1), sideT = s => tileUV('doorBronze', s < 0 ? 0 : 0.5, s < 0 ? 0.5 : 1, 0.6, 1);
  for (const s of [-1, 1]) {
    const a = s < 0 ? -2.13 : 1.27, b = s < 0 ? -1.27 : 2.13;
    K.front(a, b, 0.5, 3.7, 0.1, { r: sideR(s), fit: true });
    K.front(a, b, 3.77, 4.95, 0.1, { r: sideT(s), fit: true });
    K.box(s * 1.235 - 0.04, s * 1.235 + 0.04, 0.5, 4.95, 0, 0.17, { f: 'bronze', s: 'bronze' });   // Pfosten zwischen Tür und Seitenlicht
  }
  K.box(-2.15, 2.15, 3.69, 3.78, 0, 0.17, { f: 'bronze', t: 'bronze', b: 'bronze' });   // Kämpfer
  // Schwelle und Stufen aus schwarzem Marmor
  K.box(-2.2, 2.2, 0.36, 0.5, 0, 0.32, { f: 'marble', t: 'marble', s: 'marble' });
  K.box(-3.0, 3.0, 0.2, 0.36, 0, 1.25, { f: 'marble', t: 'marble', s: 'marble' });
  K.box(-2.6, 2.6, 0.36, 0.5, 0.32, 0.75, { f: 'marble', t: 'marble', s: 'marble' });
  // Laibung, innere Lage: Kanneluren
  K.col = sc;
  for (const s of [-1, 1]) K.box(s < 0 ? -2.5 : 2.15, s < 0 ? -2.15 : 2.5, 0.5, 5.3, 0, 0.45, { f: noir ? 'marble' : { t: 'flute', m: [0.5, 1.0] }, s: jamb, t: jamb });
  K.box(-2.5, 2.5, 4.95, 5.3, 0, 0.45, { f: jamb, b: jamb, t: jamb });
  // mittlere Lage: Winkelrelief
  for (const s of [-1, 1]) K.box(s < 0 ? -2.95 : 2.5, s < 0 ? -2.5 : 2.95, 0.36, 5.75, 0, 0.7, { f: P.grade > 1 && !noir ? { t: 'chevron', m: [0.5, 1.0] } : jamb, s: jamb, t: jamb });
  K.box(-2.95, 2.95, 5.3, 5.75, 0, 0.7, { f: jamb, b: jamb, t: jamb });
  if (noir) { K.col = COL.white; for (const s of [-1, 1]) K.box(s * 2.5 - 0.035, s * 2.5 + 0.035, 0.36, 5.75, 0.7, 0.73, { f: 'bronze', s: 'bronze' }); K.col = sc; }   // Goldfuge
  let top = 5.75;
  if (P.grade > 1) {
    // äußere Lage mit Sockel, Sturz mit Relief (zwei Kacheln), Stufenkrone, Pylonen mit Kugel
    for (const s of [-1, 1]) {
      const a = s < 0 ? -3.45 : 2.95, b = s < 0 ? -2.95 : 3.45;
      K.box(a, b, 0.9, 6.6, 0, 0.95, { f: jamb, s: jamb });
      K.col = COL.white; K.box(a - 0.03, b + 0.03, 0.2, 0.9, 0, 1.0, { f: 'marble', s: 'marble', t: 'marble' }); K.col = sc;
      K.box(a + 0.05, b - 0.05, 6.6, 6.95, 0.05, 0.9, { f: jamb, s: jamb, t: jamb });
      K.box(a + 0.12, b - 0.12, 6.95, 7.3, 0.12, 0.83, { f: jamb, s: jamb, t: jamb });
      parts.push(['gold', new T.SphereGeometry(0.17, 12, 8), s * 3.2, 7.47, 0.47]);
    }
    K.box(-2.95, 0, 5.75, 6.61, 0, 0.95, { f: { t: 'relief', fit: true }, b: jamb, t: jamb });
    K.box(0, 2.95, 5.75, 6.61, 0, 0.95, { f: { t: 'relief', fit: true, flip: true }, b: jamb, t: jamb });
    K.box(-2.4, 2.4, 6.61, 6.95, 0, 0.8, { f: jamb, t: jamb, s: jamb });
    K.box(-1.5, 1.5, 6.95, 7.3, 0, 0.65, { f: jamb, t: jamb, s: jamb });
    K.box(-0.7, 0.7, 7.3, 7.65, 0, 0.5, { f: jamb, t: jamb, s: jamb });
    p('orn', planeOrn('fan', 1.3, 0.55), 0, 7.03, 0.66);   // Goldfächer auf der Krone
    top = 7.65;
  }
  // Vordach (Marquise) aus Bronze mit Glühbirnen und Fries, an Zugstangen
  K.col = COL.white;
  const cw = P.grade > 1 ? 2.88 : 2.7, cd = P.kind === 'hotel' ? 3.4 : P.grade > 1 ? 2.9 : 2.3;
  K.box(-cw, cw, 5.32, 5.58, 0.7, cd, { f: 'bronze', s: 'bronze', t: 'bronze' });
  K.box(-cw + 0.35, cw - 0.35, 5.58, 5.72, 0.7, cd - 0.35, { f: 'bronze', s: 'bronze', t: 'bronze' });
  p('lit', planeOrn(P.grade > 1 ? 'lit' : 'dim', 2 * cw - 0.2, cd - 0.85, (2 * cw) / 6.4).rotateX(Math.PI / 2), 0, 5.315, (cd + 0.7) / 2);
  p('orn', planeOrn('frieze', 2 * cw, 0.24, 2 * cw / 2.8), 0, 5.45, cd + 0.012);
  for (const s of [-1, 1]) {
    if (P.grade > 1) parts.push(['bronze', rod(0.035, 5.58, cd - 0.15, 6.5, 0.97), s * (cw - 0.25), 0, 0]);
    // Pendelleuchten unter dem Vordach
    p('gold', new T.BoxGeometry(0.03, 0.3, 0.03), s * 1.6, 5.17, (cd + 0.7) / 2);
    p('lamp', new T.SphereGeometry(0.14, 12, 8), s * 1.6, 4.92, (cd + 0.7) / 2);
    p('gold', new T.ConeGeometry(0.2, 0.12, 12, 1, true), s * 1.6, 5.06, (cd + 0.7) / 2);
  }
  // Laternen an der äußeren Lage
  const lx = P.grade > 1 ? 3.2 : 2.72, lz = P.grade > 1 ? 1.25 : 1.0;
  for (const s of [-1, 1]) parts.push(['lantern', null, s * lx, 3.0, lz]);
  // Hotel, Bar, Restaurant: roter Läufer zwischen Messingpfosten mit Kordel
  if (P.kind === 'hotel' || P.kind === 'bar' || P.kind === 'restaurant') {
    p('carpet', new T.BoxGeometry(1.8, 0.02, 2.6), 0, 0.215, 2.55);
    p('carpet', new T.BoxGeometry(1.8, 0.02, 0.45), 0, 0.51, 0.53);
    p('carpet', new T.BoxGeometry(1.8, 0.02, 0.5), 0, 0.37, 1.0);
    for (const s of [-1, 1]) {
      for (const z of [1.6, 3.5]) { p('gold', new T.CylinderGeometry(0.035, 0.05, 0.95, 10), s * 1.15, 0.67, z); p('gold', new T.SphereGeometry(0.06, 10, 7), s * 1.15, 1.17, z); p('gold', new T.CylinderGeometry(0.16, 0.18, 0.05, 14), s * 1.15, 0.22, z); }
      p('carpet', new T.CylinderGeometry(0.02, 0.02, 1.9, 6).rotateX(Math.PI / 2), s * 1.15, 1.05, 2.55);
    }
  }
}

// Arbeiterviertel: Backsteinpfeiler, Eisensturz, zwei Plankenflügel, Betonstufe, Emaillelampe
function workerPortal(P, K, G, p, parts) {
  opening(K, G, -1.4, 1.4, 0.36, 3.06, 0.6);
  K.col = COL.white;
  K.front(-1.38, 0, 0.36, 3.06, 0.1, { t: 'doorWork', fit: true });
  K.front(0, 1.38, 0.36, 3.06, 0.1, { t: 'doorWork', fit: true, flip: true });   // Angeln außen
  for (const s of [-1, 1]) K.box(s < 0 ? -1.95 : 1.38, s < 0 ? -1.38 : 1.95, 0.2, 3.9, 0, 0.3, { f: 'brick', s: 'brick', t: 'brick' });
  K.box(-1.38, 1.38, 3.36, 3.9, 0, 0.3, { f: 'brick', b: 'brick', t: 'brick' });
  K.col = COL.iron; K.box(-1.98, 1.98, 3.06, 3.36, 0, 0.34, { f: 'bronze', b: 'bronze', t: 'bronze', s: 'bronze' });
  K.col = COL.concrete; K.box(-1.8, 1.8, 0.2, 0.36, 0, 0.7, { f: 'lime', t: 'lime', s: 'lime' });
  enamelLamp(p, 0, 4.35, 0.9);
}
function enamelLamp(p, lx, y, lz) {
  p('iron', new T.BoxGeometry(0.06, 0.06, lz), lx, y + 0.35, lz / 2);
  p('iron', new T.BoxGeometry(0.05, 0.38, 0.05), lx, y + 0.17, lz);
  p('enamel', new T.ConeGeometry(0.3, 0.16, 14, 1, true), lx, y - 0.04, lz);
  p('lamp', new T.SphereGeometry(0.07, 8, 6), lx, y - 0.1, lz);
}

/* Haustür: Bürgerhaus (grade 2/1, Nussbaumtür, gestufte Laibung, Relief-Sturz) oder Arbeiterhaus (0) */
export function kitDoor(D, K, G, p, parts) {
  K.at(D.x, D.z, D.o); G.at(D.x, D.z, D.o);
  if (!D.grade) {
    opening(K, G, -0.68, 0.68, 0.36, 3.06, 0.55);
    K.col = COL.white;
    K.front(-0.675, 0.675, 0.36, 3.06, 0.1, { t: 'doorWork', fit: true });
    for (const s of [-1, 1]) K.box(s < 0 ? -1.1 : 0.675, s < 0 ? -0.675 : 1.1, 0.2, 3.62, 0, 0.26, { f: 'brick', s: 'brick', t: 'brick' });
    K.box(-0.675, 0.675, 3.32, 3.62, 0, 0.26, { f: 'brick', b: 'brick', t: 'brick' });
    K.col = COL.iron; K.box(-1.12, 1.12, 3.06, 3.32, 0, 0.3, { f: 'bronze', b: 'bronze', t: 'bronze', s: 'bronze' });
    K.col = COL.concrete; K.box(-1.25, 1.25, 0.2, 0.36, 0, 0.6, { f: 'lime', t: 'lime', s: 'lime' });
    enamelLamp(p, 0, 4.1, 0.75);
    return;
  }
  const sc = stoneCol(D.tint), g2 = D.grade > 1;
  opening(K, G, -1.0, 1.0, 0.5, 4.05, 0.85);
  K.col = COL.white;
  K.front(-0.94, 0.94, 0.5, 3.5, 0.1, { t: 'doorWood', fit: true });
  K.front(-1.0, 1.0, 3.55, 4.05, 0.1, { t: 'transom', fit: true });
  K.box(-1.0, 1.0, 3.49, 3.56, 0, 0.16, { f: 'bronze', t: 'bronze', b: 'bronze' });
  const st = g2 ? 'marble' : 'lime';
  if (!g2) K.col = sc;
  K.box(-1.75, 1.75, 0.2, 0.36, 0, 1.0, { f: st, t: st, s: st });
  K.box(-1.45, 1.45, 0.36, 0.5, 0, 0.6, { f: st, t: st, s: st });
  K.col = sc;
  for (const s of [-1, 1]) K.box(s < 0 ? -1.24 : 0.94, s < 0 ? -0.94 : 1.24, 0.5, 4.35, 0, 0.3, { f: { t: 'flute', m: [0.5, 1.0] }, s: 'lime', t: 'lime' });
  K.box(-1.24, 1.24, 4.05, 4.35, 0, 0.3, { f: 'lime', b: 'lime', t: 'lime' });
  for (const s of [-1, 1]) K.box(s < 0 ? -1.62 : 1.24, s < 0 ? -1.24 : 1.62, 0.36, g2 ? 5.21 : 4.75, 0, 0.5, { f: g2 ? { t: 'chevron', m: [0.5, 1.0] } : 'lime', s: 'lime', t: 'lime' });
  if (g2) {
    K.box(-1.62, 1.62, 4.35, 5.21, 0, 0.5, { f: { r: tileUV('relief', 0.03, 0.97, 0, 1), fit: true }, b: 'lime', t: 'lime' });
    K.box(-1.1, 1.1, 5.21, 5.45, 0, 0.38, { f: 'lime', t: 'lime', s: 'lime' });
    K.box(-0.5, 0.5, 5.45, 5.69, 0, 0.26, { f: 'lime', t: 'lime', s: 'lime' });
  } else K.box(-1.62, 1.62, 4.35, 4.75, 0, 0.5, { f: 'lime', b: 'lime', t: 'lime' });
  for (const s of [-1, 1]) parts.push(['lantern', null, s * 1.95, 3.0, 0.42]);
}

/* ---------- kleine Helfer für deco.js ---------- */
// Zugstange in der Ebene x = 0 von (y0, z0) nach (y1, z1), danach mit lx verschoben
function rod(r, y0, z0, y1, z1) {
  const L = Math.hypot(y1 - y0, z1 - z0), g = new T.CylinderGeometry(r, r, L, 6);
  g.rotateX(Math.atan2(z1 - z0, y1 - y0)); g.translate(0, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}
let ORNF = null;
export function setOrnPlane(fn) { ORNF = fn; }
const planeOrn = (k, w, h, rep) => ORNF(k, w, h, rep);
