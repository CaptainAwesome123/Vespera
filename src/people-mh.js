/* =====================================================================
   V22 · MENSCHEN AUS MAKEHUMAN: echte Körper (Grundnetz hm08, CC0) mit
   Fotohaut, Kleidung, Haaren, Augen, Brauen und Wimpern. tools/make-people.mjs
   bringt sie in die Ruhehaltung des Spiels und schreibt je Ecke Glied,
   Mischgewicht und Stoffart; der Shader (people-skeleton.js) bewegt sie wie
   die gebauten Figuren: Gehen, Tanzen, Sitzen, Arbeiten, Ragdoll.
   Hüte, Requisiten, Werkzeuge, Mäntel, Abend- und Charlestonkleider kommen
   weiter aus personBuild und werden auf den neuen Körper gesetzt.
   V39: jede Art hat ihr eigenes Set aus drei Frisuren (aus fünf je Geschlecht),
   Herren tragen echte Fedoras aus MakeHuman, die Damen einen Pelzmantel (Art
   'furcoat'); der Shader der Menge ist dafür nicht gewachsen, alles kommt aus
   Netzen, Atlas und Daten.
   ===================================================================== */
import { T, MOBILE, ANISO } from './core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { resolveAsset, assetStats } from './assets.js';
import { HRIG } from './people-skeleton.js';
import { PB, personBuild, personMerge, HATMASK, FAB, HL, faceUV } from './people-model.js';

export const MHP = { ready: false, late: false, src: {}, meta: null, err: null, ms: 0 };

// Netz aus dem GLB in einfache Float32-Felder (Quantisierung aufgelöst, Knotenmatrix eingerechnet)
function flatMesh(o) {
  const g = o.geometry, out = {}, m = o.matrixWorld, nm = new T.Matrix3().getNormalMatrix(m), v = new T.Vector3();
  for (const [k, a] of Object.entries(g.attributes)) {
    const n = a.count, c = a.itemSize, arr = new Float32Array(n * c), get = [a.getX, a.getY, a.getZ, a.getW];
    for (let i = 0; i < n; i++) for (let d = 0; d < c; d++) arr[i * c + d] = get[d].call(a, i);
    out[k] = arr;
  }
  for (let i = 0; i < out.position.length; i += 3) { v.fromArray(out.position, i).applyMatrix4(m).toArray(out.position, i); }
  for (let i = 0; i < out.normal.length; i += 3) { v.fromArray(out.normal, i).applyMatrix3(nm).normalize().toArray(out.normal, i); }
  out.index = Uint32Array.from(g.index.array); out.count = out.position.length / 3;
  return out;
}

export async function loadPeople() {
  const t0 = performance.now();
  try {
    const res = await fetch(resolveAsset('people/people.json'));
    if (!res.ok) throw new Error('people.json HTTP ' + res.status);
    const meta = await res.json();
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await new Promise((ok, no) => loader.load(resolveAsset('people/people.glb'), ok, undefined, no));
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (o.isMesh) MHP.src[o.name] = flatMesh(o); });
    const tex = await new Promise((ok, no) => new T.TextureLoader().load(resolveAsset(MOBILE ? 'people/people-atlas-m.webp' : 'people/people-atlas.webp'), ok, undefined, no));
    tex.encoding = T.sRGBEncoding; tex.anisotropy = Math.min(4, ANISO);
    if (MHP.late) throw new Error('zu spät geladen');   // Stadt ist schon mit den gebauten Figuren entstanden
    HRIG.m = meta.rig.m; HRIG.f = meta.rig.f; HRIG.tex = tex; HRIG.tile = meta.atlas.tile / meta.atlas.w;
    MHP.meta = meta; MHP.ready = true; PB.geo = mhPersonGeo;
    assetStats.models++; assetStats.textures++;
  } catch (e) { MHP.err = String(e && e.message || e); assetStats.errors.push('Figuren: ' + MHP.err); console.warn('MakeHuman-Figuren nicht geladen, es bleiben die gebauten:', e); }
  MHP.ms = Math.round(performance.now() - t0);
  return MHP.ready;
}

/* ---------- Arten: welche Teile, welcher Stoffbereich im Atlas, was aus personBuild bleibt ---------- */
const DARK_TROUSERS = [0.07, 0.07, 0.08], GLOVE_SATIN = [0.92, 0.9, 0.86];
// V39: hair = drei Frisuren der Art (A short02 Tolle, B short04 glatt, C short01, D short03 Seitenscheitel, E afro01 kurze Locken;
// Damen: A bob02, B bob01, C ponytail01, D long01 offen, E braid01 Zopf). mhHat = Hutvariante -> MakeHuman-Hut statt des gebauten
// (Farbe des Filzes dazu). shoes2 = braune Halbschuhe (shoes04).
const FED_DARK = [0.16, 0.14, 0.13], FED_BLACK = [0.05, 0.05, 0.06], FED_GREY = [0.24, 0.23, 0.22];
export const MH_KIND = {
  suit:      { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'suit', keep: ['hat', 'carry', 'props'], hair: ['A', 'D', 'B'], mhHat: { 1: ['fedora-m', FED_DARK] } },
  tux:       { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'tux', color: [0.025, 0.025, 0.03], keep: ['props'], shirt: true, bow: true, hair: ['B', 'D', 'A'] },
  livery:    { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'uniform', keep: ['hat', 'props'], hair: ['B', 'A', 'D'] },
  police:    { g: 'm', parts: ['suit-m', 'boots-m'], tile: 'uniform', keep: ['hat', 'props'], hair: ['B', 'C', 'D'] },
  chauffeur: { g: 'm', parts: ['suit-m', 'shoes2-m'], tile: 'uniform', keep: ['hat', 'props'], hair: ['B', 'A', 'D'] },
  waiter:    { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'waiter', keep: ['carry', 'props'], shirt: true, bow: true, hair: ['B', 'D', 'C'] },
  coat:      { g: 'm', parts: ['suit-m', 'shoes2-m'], tile: 'suit', keep: ['body', 'hat', 'carry', 'props'], coat: true, cover: { from: 0.48, to: 1.45, mg: 0.022 }, hair: ['D', 'C', 'E'], mhHat: { 1: ['fedora-m', FED_BLACK], 3: ['fedora2-m', FED_GREY] } },
  worker:    { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'props'], hair: ['C', 'E', 'A'] },
  sailor:    { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'props'], hair: ['C', 'A', 'E'] },
  kid:       { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'carry', 'props'], hair: ['A', 'C', 'D'] },
  lady:      { g: 'f', parts: ['lady-f', 'heels-f'], tile: 'lady', keep: ['hat', 'carry', 'props'], hair: ['A', 'B', 'E'] },
  gown:      { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.02, to: 1.366, mg: 0.012 }, gloves: GLOVE_SATIN, longGloves: true, hair: ['A', 'B', 'D'] },
  dress:     { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.42, to: 1.366, mg: 0.01 } , hair: ['B', 'A', 'C'] },
  // V39: Dame im langen Pelzmantel (Wintermantel mit Pelzkragen, -manschetten und -saum; Stoff in der Farbe der Figur), Hüte und Taschen wie das Kostüm
  furcoat:   { g: 'f', parts: ['coat-f', 'heels-f'], tile: 'furcoat', keep: ['hat', 'carry', 'props'], build: 'lady', hair: ['A', 'B', 'C'] },
  // V24: der Spieler (nach den Referenzbildern): eigenes Gesicht, blondes Haar, weiße Rose am Revers, Einstecktuch
  // V32: im Smoking (Hemdbrust mit Biesen und Onyxknöpfen) mit schwarzer Fliege; Haar glatt zurückgekämmt
  player:    { g: 'm', body: 'p', parts: ['suit-m', 'shoes-m'], tile: 'tux', color: [0.025, 0.025, 0.03], keep: ['props'], player: true, shirt: true, bow: true },
};
// V24: Brillen (3D, rund, Goldrand) für diese Arten; welche Figur eine trägt, entscheidet das Gesicht (FACE_SPECS, auch im Shader)
const SPECS_KINDS = { suit: 1, coat: 1, worker: 1, chauffeur: 1, waiter: 1 };
// Einstecktuch für Anzug und Frack am MakeHuman-Sakko
const POCKET_KINDS = { suit: 1, tux: 1, player: 1, coat: 0 };
const NOPAINT = [0.98, 0.98, 0.98];      // nicht ganz weiß: bekommt nicht die Farbe der Figur

// Höhen der gebauten Figur -> Höhen am MakeHuman-Körper (stückweise linear)
function yMap(gk) {
  const r = HRIG[gk], fem = gk === 'f';
  const pts = fem ? [[0, 0], [0.4576, r.knee], [0.88, r.hip], [1.31, r.top], [1.43, r.neck], [1.58, r.headC]]
    : [[0, 0], [0.494, r.knee], [0.95, r.hip], [1.34, r.top], [1.47, r.neck], [1.62, r.headC]];
  return y => { if (y <= pts[0][0]) return y; for (let k = 1; k < pts.length; k++) if (y <= pts[k][0]) { const a = pts[k - 1], b = pts[k]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); } const l = pts[pts.length - 1]; return l[1] + (y - l[0]); };
}
// Umriss je Zentimeter Höhe: größte Breite, Tiefe vorn und hinten
const BAND = 0.01, NB = 200;
function extents(list) {
  const xM = new Float32Array(NB), zP = new Float32Array(NB), zN = new Float32Array(NB), has = new Uint8Array(NB);
  for (const [pos, ok] of list) for (let i = 0; i < pos.length / 3; i++) {
    if (ok && !ok(i)) continue;
    const b = Math.max(0, Math.min(NB - 1, Math.floor(pos[i * 3 + 1] / BAND)));
    const x = Math.abs(pos[i * 3]), z = pos[i * 3 + 2];
    if (!has[b]) { has[b] = 1; xM[b] = x; zP[b] = Math.max(0.01, z); zN[b] = Math.min(-0.01, z); }
    else { xM[b] = Math.max(xM[b], x); zP[b] = Math.max(zP[b], z); zN[b] = Math.min(zN[b], z); }
  }
  // Lücken füllen, dann je 2 cm das Größte nehmen (kein Durchstechen zwischen den Bändern)
  let last = -1; for (let b = 0; b < NB; b++) if (has[b]) { if (last < 0) for (let k = 0; k < b; k++) { xM[k] = xM[b]; zP[k] = zP[b]; zN[k] = zN[b]; } else for (let k = last + 1; k < b; k++) { const f = (k - last) / (b - last); xM[k] = xM[last] + (xM[b] - xM[last]) * f; zP[k] = zP[last] + (zP[b] - zP[last]) * f; zN[k] = zN[last] + (zN[b] - zN[last]) * f; } last = b; }
  if (last >= 0) for (let k = last + 1; k < NB; k++) { xM[k] = xM[last]; zP[k] = zP[last]; zN[k] = zN[last]; }
  const mx = a => { const o = new Float32Array(NB); for (let b = 0; b < NB; b++) { let m = a === zN ? 0 : -1e9; for (let k = Math.max(0, b - 2); k <= Math.min(NB - 1, b + 2); k++) m = a === zN ? Math.min(m, a[k]) : Math.max(m, a[k]); o[b] = m; } return o; };
  return { xM: mx(xM), zP: mx(zP), zN: mx(zN) };
}
const bandOf = y => Math.max(0, Math.min(NB - 1, Math.floor(y / BAND)));

// Gebaute Kleider (Mantel, Abendkleid, Charlestonkleid) auf den MakeHuman-Körper weiten
function fitCover(parts, gk, K, bodySrc, extraSrc) {
  const ym = yMap(gk), mg = K.cover.mg;
  const regOK = i => { const r = bodySrc._reg[i]; return r === 2 || r === 3 || r === 7 || r === 8 || r === 9; };
  const list = [[bodySrc.position, regOK]];
  if (extraSrc) list.push([extraSrc.position, i => { const l = extraSrc._limb[i * 2]; return l < 2.5 || (l > 4.5 && l < 6.5); }]);
  const E = extents(list);
  // Umriss des gebauten Kleides: aus seinem größten Teil
  let main = parts[0]; for (const p of parts) if (p[0].attributes.position.count > main[0].attributes.position.count) main = p;
  const PE = extents([[main[0].attributes.position.array]]);
  let topY = 0; { const a = main[0].attributes.position.array; for (let i = 1; i < a.length; i += 3) topY = Math.max(topY, a[i]); }
  for (const [g] of parts) {
    const pa = g.attributes.position, a = pa.array;
    for (let i = 0; i < pa.count; i++) {
      const x = a[i * 3], y = a[i * 3 + 1], z = a[i * 3 + 2], Y = ym(y), b = bandOf(Y), bp = bandOf(y);
      const nearTop = y > topY - 0.06, lo = nearTop ? 0.85 : 1.0;
      const sX = Math.min(1.7, Math.max(lo, (E.xM[b] + mg) / Math.max(0.02, PE.xM[bp])));
      const sZ = z >= 0 ? Math.min(1.7, Math.max(lo, (E.zP[b] + mg) / Math.max(0.02, PE.zP[bp]))) : Math.min(1.7, Math.max(lo, (E.zN[b] - mg) / Math.min(-0.02, PE.zN[bp])));
      a[i * 3] = x * sX; a[i * 3 + 1] = Y; a[i * 3 + 2] = z * sZ;
    }
    pa.needsUpdate = true;
  }
  return { y0: ym(K.cover.from) + 0.02, y1: ym(K.cover.to) - 0.03 };
}

// V24: Gesichtskoordinaten für den gemalten Gesichteratlas: die Merkmale des MakeHuman-Kopfes (people.json, face) werden
// stückweise linear auf die des gemalten Gesichts gelegt (HL), damit Lippen, Bart, Lidschatten und Falten genau sitzen
const faceMapCache = {};
function faceMapper(gk) {
  if (faceMapCache[gk]) return faceMapCache[gk];
  const r = HRIG[gk], fc = r && r.face; if (!fc) return null;
  const hc = r.headC, kx = HL.eyeX / fc.eyeX;
  const pts = [[fc.chinY - hc, HL.chinY], [fc.mouthY - hc, HL.mouthY], [fc.noseY - hc, HL.noseY], [fc.eyeY - hc, HL.eyeY], [fc.browY - hc, HL.browY]];
  const my = y => { if (y <= pts[0][0]) return pts[0][1] + (y - pts[0][0]); for (let k = 1; k < pts.length; k++) if (y <= pts[k][0]) { const a = pts[k - 1], b = pts[k]; return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]); } const l = pts[pts.length - 1]; return l[1] + (y - l[0]); };
  return (faceMapCache[gk] = (x, y, z) => faceUV(x * kx, my(y - hc), (z - r.headZ) / 0.09));
}
// Vorderseite des Sakkos (für Einstecktuch und Rose): vorderster Punkt nahe (x, y)
function suitFront(x, y) {
  const s = MHP.src['suit-m']; let z = null;
  if (s) for (let i = 0; i < s.count; i++) { const dx = s.position[i * 3] - x, dy = s.position[i * 3 + 1] - y; if (dx * dx + dy * dy < 0.012 * 0.012 && (z === null || s.position[i * 3 + 2] > z)) z = s.position[i * 3 + 2]; }
  return z ?? 0.12;
}
// V32: Hemdbrust vorn (für die Fliege): vorderster Punkt der glatten Hemdbrust nahe (x, y)
function shirtFront(x, y) {
  const s = MHP.src['shirt-m'] || MHP.src['suit-m']; let z = null;
  if (s) for (let i = 0; i < s.count; i++) { const dx = s.position[i * 3] - x, dy = s.position[i * 3 + 1] - y; if (dx * dx + dy * dy < 0.015 * 0.015 && (z === null || s.position[i * 3 + 2] > z)) z = s.position[i * 3 + 2]; }
  return z ?? 0.1;
}
// Ein Flügel der Fliege (sd = Seite): Schlauch entlang x, Querschnitt flache Ellipse, Höhe wächst nach außen und rundet sich ab
function bowWing(sd) {
  const NU = 12, NV = 12, pos = [], idx = [];
  for (let i = 0; i <= NU; i++) {
    const u = i / NU, x = 0.005 + u * 0.045;
    const end = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (u - 0.72) / 0.28), 2)));
    const hy = (0.005 + 0.012 * Math.pow(Math.sin(Math.min(1, u / 0.72) * Math.PI / 2), 0.8)) * end + 0.0004;
    const hz = (0.0032 + 0.0018 * u) * (0.4 + 0.6 * end) + 0.0003;
    const dent = 1 - 0.18 * Math.exp(-Math.pow((u - 0.86) / 0.08, 2));   // Kerbe außen: Schmetterlingsform
    for (let j = 0; j < NV; j++) {
      const a = j / NV * Math.PI * 2, cy = Math.cos(a), cz = Math.sin(a);
      pos.push(sd * x, cy * hy * (Math.abs(cy) > 0.6 ? dent : 1) + 0.0012 * Math.sin(u * 5.0) * sd, cz * hz - 0.003 * u * u + 0.0025 * Math.sin(u * Math.PI));
    }
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * NV + j, b = i * NV + (j + 1) % NV, c = a + NV, d = b + NV; idx.push(a, b, c, b, d, c); }
  // äußeres Ende schließen
  const tip = pos.length / 3; pos.push(sd * 0.0505, 0, 0); for (let j = 0; j < NV; j++) idx.push(NU * NV + j, NU * NV + (j + 1) % NV, tip);
  // jedes Dreieck nach außen drehen (vom Kern des Flügels weg, am Ende nach außen)
  const V = k => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
  for (let t = 0; t < idx.length; t += 3) {
    const A = V(idx[t]), B = V(idx[t + 1]), C = V(idx[t + 2]), u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
    const cx = (A[0] + B[0] + C[0]) / 3, cy = (A[1] + B[1] + C[1]) / 3, cz = (A[2] + B[2] + C[2]) / 3;
    const out = t >= NU * NV * 6 ? [sd, 0, 0] : [0, cy, cz];
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Kragen vorn (für Fliegen): höchster Punkt des Hemdkragens in der Mitte
const collarCache = {};
function collarFront(gk) {
  if (collarCache[gk]) return collarCache[gk];
  const s = MHP.src['suit-m'], r = HRIG[gk]; let best = null;
  if (s) for (let i = 0; i < s.count; i++) { const x = s.position[i * 3], y = s.position[i * 3 + 1], z = s.position[i * 3 + 2]; if (Math.abs(x) < 0.012 && y > r.top - 0.02 && y < r.neck + 0.03 && z > 0.03 && (!best || y > best[1])) best = [x, y, z]; }
  return (collarCache[gk] = best || [0, r.neck - 0.03, 0.07]);
}

/* ---------- V24: Zubehör am MakeHuman-Körper: Brille, Einstecktuch, Rose ---------- */
function extraParts(K, kind, rig, keep) {
  const fc = rig.face; if (!fc) return;
  const P = (g, c, limb, fab, opt = 0) => keep.push([g, c, limb, limb ? rig.top : 0, opt, fab, 'extra']);
  if (SPECS_KINDS[kind]) {
    // runde Brille: zwei Ringe vor den Augen, Steg über der Nase, Bügel zu den Ohren (Variante 71, Shader blendet je Gesicht ein)
    const z = fc.noseZ - 0.028, y = fc.eyeY + 0.001, R = 0.0158, rim = [0.62, 0.48, 0.24];
    for (const sx of [-1, 1]) {
      P(new T.TorusGeometry(R, 0.0011, 5, 22).translate(sx * fc.eyeX, y, z), rim, 0, FAB.metal, 71);
      P(new T.CylinderGeometry(R * 0.96, R * 0.96, 0.0006, 20).rotateX(Math.PI / 2).translate(sx * fc.eyeX, y, z), [0.75, 0.8, 0.82], 0, FAB.silk, 71);   // Glas
      const a = new T.Vector3(sx * (fc.eyeX + R), y + 0.002, z - 0.002), b = new T.Vector3(sx * 0.071, y + 0.006, rig.headZ - 0.005), d = b.clone().sub(a);
      P(new T.CylinderGeometry(0.0009, 0.0009, d.length(), 4).translate(0, d.length() / 2, 0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize())).translate(a.x, a.y, a.z), rim, 0, FAB.metal, 71);
    }
    P(new T.TorusGeometry(fc.eyeX - R, 0.001, 4, 10, Math.PI).translate(0, y + 0.002, z + 0.002), rim, 0, FAB.metal, 71);
  }
  if (POCKET_KINDS[kind]) {
    // Einstecktuch in der linken Brusttasche (links der Figur = +x)
    const x = 0.105, y = rig.top - 0.17, z = suitFront(x, y);
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-0.024, 0, 0, 0.024, 0, 0, -0.012, 0.03, 0, 0.0, 0.022, 0, 0.014, 0.032, 0], 3)); g.setIndex([0, 1, 3, 0, 3, 2, 1, 4, 3]);
    g.translate(x, y, z + 0.004); g.computeVertexNormals(); P(g, [0.97, 0.97, 0.95], 0, FAB.silk);
  }
  if (K.bow) {
    // V32: Fliege aus schwarzem Satin: zwei Flügel, in der Mitte gerafft, außen gerundet und leicht gewellt, dazu der Knoten
    const cf = collarFront(K.g), y = cf[1] - 0.03, z = shirtFront(0, y) + 0.004, black = [0.018, 0.018, 0.022];
    P(bowWing(1).translate(0, y, z), black, 0, FAB.satin); P(bowWing(-1).translate(0, y, z), black, 0, FAB.satin);
    P(new T.SphereGeometry(0.0085, 10, 8).scale(0.85, 1.05, 0.7).translate(0, y, z + 0.0035), black, 0, FAB.satin);
  }
  if (K.player) {
    // weiße Rose am linken Revers: Blütenblätter in Lagen, Kelch und Stiel, ein Blatt
    const x = 0.098, y = rig.top - 0.075, z = suitFront(x, y) + 0.012, white = [0.96, 0.95, 0.9], green = [0.18, 0.32, 0.12];
    P(new T.SphereGeometry(0.008, 10, 8).scale(1, 1, 0.8).translate(x, y, z + 0.004), [0.93, 0.91, 0.82], 0, FAB.silk);
    for (let L = 0; L < 3; L++) for (let k = 0; k < 5 + L; k++) {
      const a = k / (5 + L) * Math.PI * 2 + L * 0.6, r = 0.006 + L * 0.0045;
      P(new T.SphereGeometry(0.0065 + L * 0.002, 8, 6).scale(1, 0.75, 0.35).rotateZ(a).rotateX(-0.4 - L * 0.25).translate(x + Math.cos(a) * r, y + Math.sin(a) * r, z - L * 0.003), white, 0, FAB.silk);
    }
    P(new T.SphereGeometry(0.006, 8, 6).scale(1, 1, 0.8).translate(x, y - 0.012, z - 0.006), green, 0, FAB.cotton);
    P(new T.CylinderGeometry(0.0018, 0.0015, 0.03, 5).translate(0, -0.015, 0).rotateZ(0.25).translate(x, y - 0.014, z - 0.007), green, 0, FAB.cotton);
    P(new T.SphereGeometry(0.009, 8, 6).scale(1, 0.45, 0.2).rotateZ(-0.7).translate(x + 0.012, y - 0.02, z - 0.008), [0.14, 0.28, 0.1], 0, FAB.cotton);
  }
}

/* ---------- Eine Art zusammensetzen ---------- */
export function mhPersonGeo(kind, q) {
  const K = MH_KIND[kind] || MH_KIND.suit, gk = K.g, rig = HRIG[gk], fine = q > 1.5, lod = fine ? '' : '@1';
  const S = n => MHP.src[n + lod] || MHP.src[n];
  const meta = MHP.meta, RECT = meta.atlas.rect, AW = meta.atlas.w, AH = meta.atlas.h, TILE = meta.atlas.tile, hm = HATMASK[kind] || 0;
  // Zubehör aus personBuild (Hüte, Requisiten, Werkzeuge, Mäntel und Kleider)
  PB.mh = { rig, gloves: null }; let parts;
  try { parts = personBuild(K.player ? 'tux' : K.build || kind, q); } finally { K._gloves = PB.mh.gloves; PB.mh = null; }
  // V39: Hutvarianten, die ein MakeHuman-Hut ersetzt, fallen aus den gebauten Teilen (Ohrringe tragen Variante 0 und bleiben)
  const keep = parts.filter(p => K.keep.includes(p[6]) && !(p[6] === 'hat' && K.mhHat && K.mhHat[p[4]]));
  const procHC = gk === 'f' ? 1.58 : 1.62, cf = collarFront(gk);
  for (const p of keep) {
    const g = p[0];
    if (p[6] === 'hat') g.translate(0, rig.headC - procHC, rig.headZ - 0.004);
    else if (p[6] === 'bow') g.translate(0, cf[1] - 0.028 - 1.474, cf[2] + 0.004 - 0.066);
    if (p[2] >= 3 && p[2] <= 8 && p[2] !== 5 && p[2] !== 6) p[3] = rig.top;     // Arm-Glieder drehen an der MakeHuman-Schulter
  }
  extraParts(K, kind, rig, keep);
  const bodySrc = S('body-' + (K.body || gk)), coverParts = keep.filter(p => p[6] === 'body');
  const cover = K.cover && coverParts.length ? fitCover(coverParts, gk, K, MHP.src['body-' + gk], K.coat ? MHP.src['suit-m'] : null) : null;

  // Sammelfelder
  const A = { pos: [], nrm: [], uv: [], col: [], limb: [], opt: [], soft: [], tuv: [], tk: [], bl: [], idx: [], n: 0 };
  const glove = K.gloves || K._gloves || null;
  const add = (src, o = {}) => {
    if (!src) return;
    const n = src.count, base = A.n, du = o.du || 0, dv = o.dv || 0, map = new Int32Array(n).fill(-1);
    // Dreiecke filtern (verdeckt), dann nur benutzte Ecken übernehmen
    const I = src.index; const tris = [];
    for (let t = 0; t < I.length; t += 3) { const a = I[t], b = I[t + 1], c = I[t + 2]; if (o.drop && o.drop(a) && o.drop(b) && o.drop(c)) continue; tris.push(a, b, c); }
    let k = 0; for (const i of tris) if (map[i] < 0) map[i] = k++;
    const inv = new Int32Array(k); for (let i = 0; i < n; i++) if (map[i] >= 0) inv[map[i]] = i;
    for (let j = 0; j < k; j++) {
      const i = inv[j]; let c = o.color ? (typeof o.color === 'function' ? o.color(i) : o.color) : NOPAINT, tk = src._texk[i], fab = src._soft[i * 3];
      if (o.fab) { tk = 0; fab = o.fab; }
      if (glove && src._reg && (src._reg[i] === 6 || (K.longGloves && src._reg[i] === 5)) && o.isBody) { c = glove; tk = 0; fab = glove === GLOVE_SATIN ? FAB.satin : FAB.leather; }
      A.pos.push(src.position[i * 3], src.position[i * 3 + 1], src.position[i * 3 + 2]);
      A.nrm.push(src.normal[i * 3], src.normal[i * 3 + 1], src.normal[i * 3 + 2]);
      const fu = o.face ? o.face(i) : null;
      if (fu) A.uv.push(fu[0], fu[1]); else A.uv.push(-1, -1);
      A.col.push(c[0], c[1], c[2]);
      A.limb.push(src._limb[i * 2], src._limb[i * 2 + 1]); A.opt.push(o.opt0 ? 0 : o.opt != null ? o.opt : src._opt[i]);
      let sk = src._soft[i * 3 + 2]; if (sk === 1) sk += 16 * hm;
      A.soft.push(fab, src._soft[i * 3 + 1], sk);
      A.tuv.push(src.uv[i * 2] + du, src.uv[i * 2 + 1] + dv); A.tk.push(tk); A.bl.push(src._blend[i]);
    }
    for (const i of tris) A.idx.push(base + map[i]);
    A.n += k;
  };
  // Körper: unter der Kleidung verdeckte Dreiecke fallen weg
  const bits = meta.hideBits; let mask = 0; for (const p of K.parts) mask |= bits[p] || 0;
  const inCover = (src, i) => cover && src.position[i * 3 + 1] > cover.y0 && src.position[i * 3 + 1] < cover.y1;
  // V24: Kopf und Hals vorn bekommen Gesichtskoordinaten (gemalte Schminke, Bärte, Falten); der Spieler hat sein eigenes Gesicht
  const fm = K.player ? null : faceMapper(gk), r = rig, chin = r.face ? r.face.chinY - 0.045 : r.neck - 0.05;
  const face = fm ? i => { const g = bodySrc._reg[i], y = bodySrc.position[i * 3 + 1]; return (g === 1 || g === 2) && y > chin ? fm(bodySrc.position[i * 3], y, bodySrc.position[i * 3 + 2]) : null; } : null;
  add(bodySrc, { isBody: true, face, drop: i => (bodySrc._hide[i] & mask) !== 0 || (inCover(bodySrc, i) && bodySrc._reg[i] !== 4 && bodySrc._reg[i] !== 5 && bodySrc._reg[i] !== 6 && bodySrc._reg[i] !== 1) });
  add(S('eyes-' + gk));
  if (K.player) add(S(`hairB-${gk}`), { opt0: true });       // V32: glatt zurückgekämmt mit Seitenscheitel (MakeHuman short04), immer
  else (K.hair || ['A', 'B', 'C']).forEach((h, i) => add(S(`hair${h}-${gk}`) || S(`hair${'ABC'[i]}-${gk}`), { opt: 11 + i }));   // V39: Frisur-Set der Art, Variante 11..13
  // V39: Hüte aus MakeHuman (Filz in fester Farbe), sichtbar wie die gebauten über die Hutvariante der Figur
  if (K.mhHat) for (const [v, [pn, col]] of Object.entries(K.mhHat)) add(S(pn), { opt: +v, color: col });
  add(S('brows-' + gk)); if (fine) add(S('lashes-' + gk));
  for (const pn of K.parts) {
    const src = S(pn); if (!src) continue;
    const o = {};
    if (pn === 'heels-f') o.color = [0.05, 0.04, 0.045];
    else if (pn === 'shoes-m' && K.player) { o.color = [0.014, 0.014, 0.017]; o.fab = FAB.patent; }   // V35: schwarze Lackschuhe
    else if (pn === 'shoes-m' || pn === 'boots-m' || pn === 'shoes2-m') o.color = NOPAINT;
    else if (pn === 'coat-f') o.color = [1, 1, 1];                                              // V39: Mantelstoff in Figurenfarbe, Pelz aus dem Atlas
    else {
      const baseTile = pn === 'suit-m' ? 'suit' : pn === 'work-m' ? 'work' : 'lady', t = K.tile || baseTile;
      // V32: Smoking und Kellner: Hemdbrust ohne Krawatte statt der mit
      if (K.shirt && pn === 'suit-m' && src._hide && MHP.src['shirt-m']) { o.drop = i => (src._hide[i] & 64) !== 0; o.shirt = true; }
      if (t !== baseTile) { o.du = (RECT[t][0] - RECT[baseTile][0]) * TILE / AW; o.dv = -(RECT[t][1] - RECT[baseTile][1]) * TILE / AH; }
      o.color = K.color || [1, 1, 1];
      if (K.coat && pn === 'suit-m') {
        // unter dem Mantel: Ärmel in Mantelfarbe, Hose dunkel; was der Mantel verdeckt, fällt weg
        o.color = i => { const l = src._limb[i * 2]; return (l > 2.5 && l < 4.5) || l > 6.5 ? [1, 1, 1] : DARK_TROUSERS; };
        o.drop = i => { const l = src._limb[i * 2]; return inCover(src, i) && !((l > 2.5 && l < 4.5) || l > 6.5); };
      }
    }
    add(src, o);
    if (o.shirt) add(S('shirt-m'), { du: o.du, dv: o.dv, color: o.color });
  }
  // Zubehör anhängen (gleiche Felder wie personMerge)
  if (keep.length) {
    const g = personMerge(keep, kind), n = g.attributes.position.count, base = A.n;
    const at = k => g.attributes[k].array;
    const P = at('position'), N = at('normal'), UV = at('uv'), C = at('color'), L = at('aLimb'), O = at('aOpt'), SO = at('aSoft');
    for (let i = 0; i < n; i++) {
      A.pos.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); A.nrm.push(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]); A.uv.push(UV[i * 2], UV[i * 2 + 1]);
      A.col.push(C[i * 3], C[i * 3 + 1], C[i * 3 + 2]); A.limb.push(L[i * 2], L[i * 2 + 1]); A.opt.push(O[i]); A.soft.push(SO[i * 3], SO[i * 3 + 1], SO[i * 3 + 2]);
      A.tuv.push(0, 0); A.tk.push(0); A.bl.push(1);
    }
    const I = g.index.array; for (let k = 0; k < I.length; k++) A.idx.push(base + I[k]);
    A.n += n;
  }
  const m = new T.BufferGeometry(), F32 = a => new Float32Array(a);
  m.setAttribute('position', new T.BufferAttribute(F32(A.pos), 3)); m.setAttribute('normal', new T.BufferAttribute(F32(A.nrm), 3));
  m.setAttribute('uv', new T.BufferAttribute(F32(A.uv), 2)); m.setAttribute('color', new T.BufferAttribute(F32(A.col), 3));
  m.setAttribute('aLimb', new T.BufferAttribute(F32(A.limb), 2)); m.setAttribute('aOpt', new T.BufferAttribute(F32(A.opt), 1)); m.setAttribute('aSoft', new T.BufferAttribute(F32(A.soft), 3));
  // ein vec4 für alles Neue (WebGL erlaubt nur 16 Attribut-Plätze, die Instanzmatrix braucht schon vier):
  // Atlas-u, Atlas-v, Stoffart, Mischgewicht + 2 (ab 2 = MakeHuman-Maße)
  const mh = new Float32Array(A.n * 4);
  for (let i = 0; i < A.n; i++) { mh[i * 4] = A.tuv[i * 2]; mh[i * 4 + 1] = A.tuv[i * 2 + 1]; mh[i * 4 + 2] = A.tk[i]; mh[i * 4 + 3] = A.bl[i] + 2; }
  m.setAttribute('aMH', new T.BufferAttribute(mh, 4));
  m.setIndex(new T.BufferAttribute(A.n > 65535 ? new Uint32Array(A.idx) : new Uint16Array(A.idx), 1));
  m.computeBoundingSphere();
  m.userData.mh = true;
  return m;
}
