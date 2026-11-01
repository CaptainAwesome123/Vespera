// V38 · Echtes 1920er-Auto: bereitet ein Sketchfab-Modell für Vespera auf.
// Eingabe: "1920'S Pierce Arrow" von Dkerr (https://sketchfab.com/3d-models/1920s-pierce-arrow-ab9e5dfffd474d3b9d8c76f46da1a499),
// CC BY 4.0. Die Datei (GLB, 15,7 MB, zehn Bilder mit 2048 px) liegt nicht im Repo, nur das Ergebnis.
//
// Aufruf: node tools/make-car.mjs <eingang.glb> [assets/models/pierce-arrow.glb]
// Werkzeuge: npm i @gltf-transform/core @gltf-transform/extensions meshoptimizer sharp
//
// Was passiert:
//  1. Alle Netze in Spielkoordinaten: vorn = +x, oben = +y, rechts = +z, Länge LEN Meter, Räder stehen auf y = 0.
//  2. Die vier Laufräder werden aus dem Reifennetz gelöst; ein Rad (vorn links, Achse z, außen +z) bleibt als
//     Vorlage 'wheel' um den Nullpunkt, damit das fahrbare Auto die Räder drehen und lenken kann.
//  3. Die vier Bildersätze (Karosserie, Reifen, zwei Seitenteile) kommen in einen Atlas (2 x 2):
//     Farbe 2048 px WebP mit Alpha = Lackmaske (Alpha 0 = Lack, bekommt im Spiel die Wagenfarbe),
//     Metall/Rauheit und Normalen je 1024 px JPEG.
//  4. Nachtstimmung: Lack glatter (glänzt im Laternenlicht), schwarze Scheiben glatt und spiegelnd.
//  5. 'lo': vereinfachte Fassung des ganzen Wagens (mit Rädern) für die Ferne.
// Ergebnis: ein GLB mit den Knoten body, wheel, lo und extras.car (Radstand, Radhalbmesser, Lampen).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [,, IN, OUT0] = process.argv;
if (!IN) { console.error('Aufruf: node tools/make-car.mjs <eingang.glb> [ausgang.glb]'); process.exit(1); }
const OUT = OUT0 || path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'models', 'pierce-arrow.glb');
await MeshoptSimplifier.ready;

/* ---------------- Einstellungen ---------------- */
const LEN = 5.1;            // Länge über alles in Metern (die eigenen Limousinen messen 5,3 m)
const TILE = 1024;          // Kachel im Farbatlas (Atlas = 2 x TILE)
const TILE_S = 512;         // Kachel in Metall/Rauheit- und Normalenatlas
const LO_RATIO = 0.16;      // Anteil der Dreiecke in der fernen Fassung

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const src = await io.read(IN);
const root = src.getRoot();

/* ---------------- 1. Netze einsammeln, in Weltlage bringen ---------------- */
// Weltmatrix je Knoten (Spalten wie glTF)
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const prims = [];
const texSets = [];       // je Material: [Farbe, MR, Normale]
const walk = (node, parentM) => {
  const M = mul(parentM, node.getMatrix());
  const mesh = node.getMesh();
  if (mesh) for (const p of mesh.listPrimitives()) {
    const mat = p.getMaterial();
    let ti = texSets.findIndex(t => t.mat === mat);
    if (ti < 0) { ti = texSets.length; texSets.push({ mat, base: mat.getBaseColorTexture(), mr: mat.getMetallicRoughnessTexture(), nrm: mat.getNormalTexture() }); }
    const pos = p.getAttribute('POSITION'), nor = p.getAttribute('NORMAL'), uv = p.getAttribute('TEXCOORD_0'), idx = p.getIndices();
    const n = pos.getCount(), P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), v = [0, 0, 0];
    for (let k = 0; k < n; k++) {
      pos.getElement(k, v);
      const x = M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12], y = M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13], z = M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14];
      P.set([x, y, z], k * 3);
      nor.getElement(k, v);
      const nx = M[0] * v[0] + M[4] * v[1] + M[8] * v[2], ny = M[1] * v[0] + M[5] * v[1] + M[9] * v[2], nz = M[2] * v[0] + M[6] * v[1] + M[10] * v[2], L = Math.hypot(nx, ny, nz) || 1;
      N.set([nx / L, ny / L, nz / L], k * 3);
      uv.getElement(k, v); U.set([v[0], v[1]], k * 2);
    }
    prims.push({ name: mat.getName(), tile: ti, P, N, U, I: Uint32Array.from(idx ? idx.getArray() : [...Array(n).keys()]) });
  }
  for (const c of node.listChildren()) walk(c, M);
};
const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const s of root.listScenes()) for (const n of s.listChildren()) walk(n, I16);
console.log('Netze:', prims.map(p => `${p.name} ${p.I.length / 3} Dreiecke`).join(', '));
if (texSets.length > 4) throw new Error('mehr als vier Bildersätze, Atlas 2 x 2 reicht nicht');

// Ausrichtung: längste waagrechte Achse = Wagenachse. Beim Pierce Arrow (y oben nach der Wurzeldrehung) liegt die
// Wagenachse auf x, der Kühler bei -x. Spiel: vorn = +x -> x und z spiegeln (Drehung um y um 180°).
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const p of prims) for (let k = 0; k < p.P.length; k += 3) for (let d = 0; d < 3; d++) { mn[d] = Math.min(mn[d], p.P[k + d]); mx[d] = Math.max(mx[d], p.P[k + d]); }
const FRONT = -1;     // Kühler liegt bei -x (aus der Vorschau: Scheinwerfer und Kühler an der Seite mit kleinem x)
const S = LEN / (mx[0] - mn[0]), cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
for (const p of prims) {
  for (let k = 0; k < p.P.length; k += 3) {
    // Drehung um y um 180° (vorn -x im Modell -> +x im Spiel), Händigkeit bleibt
    p.P[k] = FRONT * (p.P[k] - cx) * S;
    p.P[k + 1] = (p.P[k + 1] - mn[1]) * S;
    p.P[k + 2] = FRONT * (p.P[k + 2] - cz) * S;
    p.N[k] *= FRONT; p.N[k + 2] *= FRONT;
  }
}
const bb = () => { const a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const p of prims) for (let k = 0; k < p.P.length; k += 3) for (let d = 0; d < 3; d++) { a[d] = Math.min(a[d], p.P[k + d]); b[d] = Math.max(b[d], p.P[k + d]); } return [a, b]; };
console.log('Maße (m):', bb().map(v => v.map(x => x.toFixed(2)).join(' ')).join(' bis '));

/* ---------------- 2. Laufräder lösen ---------------- */
// Zusammenhängende Teile (gleiche Lage = verbunden) des Reifennetzes; Teile um die vier Radmitten sind Laufräder
function components(p) {
  const n = p.P.length / 3, par = new Int32Array(n).map((_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
  const seen = new Map();
  for (let k = 0; k < n; k++) { const key = `${Math.round(p.P[k * 3] * 500)},${Math.round(p.P[k * 3 + 1] * 500)},${Math.round(p.P[k * 3 + 2] * 500)}`; if (seen.has(key)) par[f(k)] = f(seen.get(key)); else seen.set(key, k); }
  for (let t = 0; t < p.I.length; t += 3) { par[f(p.I[t + 1])] = f(p.I[t]); par[f(p.I[t + 2])] = f(p.I[t]); }
  const comp = new Map();
  for (let k = 0; k < n; k++) { const r = f(k); let c = comp.get(r); if (!c) comp.set(r, c = { mn: [1e9, 1e9, 1e9], mx: [-1e9, -1e9, -1e9], verts: [] }); c.verts.push(k); for (let d = 0; d < 3; d++) { c.mn[d] = Math.min(c.mn[d], p.P[k * 3 + d]); c.mx[d] = Math.max(c.mx[d], p.P[k * 3 + d]); } }
  return { root: f, comps: [...comp.values()] };
}
const tyre = prims.find(p => /TYRE/i.test(p.name));
const { root: tyreRoot, comps } = components(tyre);
// Radmitten: Teile, die bis zum Boden reichen (Reifen), nach Vorder-/Hinterachse und Seite getrennt
const treads = comps.filter(c => c.mn[1] < 0.05 && c.mx[1] - c.mn[1] > 0.6);
if (treads.length !== 4) throw new Error('erwarte 4 Laufflächen, gefunden ' + treads.length);
const W = treads.map(c => ({ x: (c.mn[0] + c.mx[0]) / 2, y: (c.mn[1] + c.mx[1]) / 2, z: (c.mn[2] + c.mx[2]) / 2, r: (c.mx[1] - c.mn[1]) / 2, zi: c.mn[2], za: c.mx[2] }));
const wheelOf = new Map();
for (const c of comps) {
  const m = [(c.mn[0] + c.mx[0]) / 2, (c.mn[1] + c.mx[1]) / 2, (c.mn[2] + c.mx[2]) / 2];
  const w = W.findIndex(w => Math.hypot(m[0] - w.x, m[1] - w.y) < w.r * 0.5 && m[2] > w.zi - 0.08 && m[2] < w.za + 0.08 && c.mx[1] - c.mn[1] < w.r * 2.2);
  if (w >= 0) for (const k of c.verts) wheelOf.set(k, w);
}
const ax = W.map(w => w.x), wr = W.reduce((s, w) => s + w.r, 0) / 4, wy = W.reduce((s, w) => s + w.y, 0) / 4;
const front = Math.max(...ax), rear = Math.min(...ax), track = W.reduce((s, w) => s + Math.abs(w.z), 0) / 4;
console.log('Räder: vorn x', front.toFixed(2), 'hinten x', rear.toFixed(2), 'Spur ±', track.toFixed(2), 'Halbmesser', wr.toFixed(2), 'Achshöhe', wy.toFixed(2));
// Vorlage: Rad vorn rechts (+z, außen +z) um den Nullpunkt
const tmplW = W.findIndex(w => w.x > 0 && w.z > 0);
const sub = (p, keep) => {
  const map = new Int32Array(p.P.length / 3).fill(-1), P = [], N = [], U = [], I = [];
  for (let t = 0; t < p.I.length; t += 3) {
    if (!keep(p.I[t])) continue;
    for (let j = 0; j < 3; j++) { const k = p.I[t + j]; if (map[k] < 0) { map[k] = P.length / 3; P.push(p.P[k * 3], p.P[k * 3 + 1], p.P[k * 3 + 2]); N.push(p.N[k * 3], p.N[k * 3 + 1], p.N[k * 3 + 2]); U.push(p.U[k * 2], p.U[k * 2 + 1]); } I.push(map[k]); }
  }
  return { name: p.name, tile: p.tile, P: Float32Array.from(P), N: Float32Array.from(N), U: Float32Array.from(U), I: Uint32Array.from(I) };
};
const wheel = sub(tyre, k => wheelOf.get(k) === tmplW);
{ const w = W[tmplW]; for (let k = 0; k < wheel.P.length; k += 3) { wheel.P[k] -= w.x; wheel.P[k + 1] -= w.y; wheel.P[k + 2] -= w.z; } }
const tyreRest = sub(tyre, k => !wheelOf.has(k));
const bodyPrims = prims.filter(p => p !== tyre).concat([tyreRest]);
console.log('Rad-Vorlage:', wheel.I.length / 3, 'Dreiecke; Reifennetz ohne Laufräder:', tyreRest.I.length / 3);

/* ---------------- 3. Atlas ---------------- */
// UV in die Kachel; Koordinaten außerhalb 0..1 (gespiegelte Seitenteile) je Dreieck zurückschieben
function atlasUV(p) {
  const P = [], N = [], U = [], I = [];
  const tx = p.tile % 2, ty = Math.floor(p.tile / 2), pad = 2 / (2 * TILE);
  const key = new Map();
  for (let t = 0; t < p.I.length; t += 3) {
    const us = [0, 1, 2].map(j => p.U[p.I[t + j] * 2]), vs = [0, 1, 2].map(j => p.U[p.I[t + j] * 2 + 1]);
    const ou = Math.floor((us[0] + us[1] + us[2]) / 3), ov = Math.floor((vs[0] + vs[1] + vs[2]) / 3);
    for (let j = 0; j < 3; j++) {
      const k = p.I[t + j], u = Math.min(1, Math.max(0, us[j] - ou)), v = Math.min(1, Math.max(0, vs[j] - ov));
      const kk = k + ':' + ou + ':' + ov;
      let o = key.get(kk);
      if (o === undefined) { o = P.length / 3; key.set(kk, o); P.push(p.P[k * 3], p.P[k * 3 + 1], p.P[k * 3 + 2]); N.push(p.N[k * 3], p.N[k * 3 + 1], p.N[k * 3 + 2]); U.push((tx + pad + u * (1 - 2 * pad)) / 2, (ty + pad + v * (1 - 2 * pad)) / 2); }
      I.push(o);
    }
  }
  return { P: Float32Array.from(P), N: Float32Array.from(N), U: Float32Array.from(U), I: Uint32Array.from(I) };
}
const merge = list => {
  const P = [], N = [], U = [], I = []; let o = 0;
  for (const g of list) { P.push(...g.P); N.push(...g.N); U.push(...g.U); for (const i of g.I) I.push(i + o); o += g.P.length / 3; }
  return { P: Float32Array.from(P), N: Float32Array.from(N), U: Float32Array.from(U), I: Uint32Array.from(I) };
};
const body = merge(bodyPrims.map(atlasUV)), wheelG = atlasUV(wheel);

// Bilder: Farbe (RGB + Lackmaske im Alpha), Metall/Rauheit (G = Rauheit, B = Metall), Normalen
const img = async (tex, size, fill) => tex ? sharp(Buffer.from(tex.getImage())).removeAlpha().resize(size, size).raw().toBuffer() : Buffer.alloc(size * size * 3, fill);
const baseA = Buffer.alloc(4 * TILE * TILE * 4), mrA = Buffer.alloc(4 * TILE_S * TILE_S * 3), nA = Buffer.alloc(4 * TILE_S * TILE_S * 3);
let paintPx = 0;
for (let ti = 0; ti < texSets.length; ti++) {
  const ts = texSets[ti], tx = ti % 2, ty = Math.floor(ti / 2);
  const b = await img(ts.base, TILE, 128), mr = await img(ts.mr, TILE_S, 128), nr = await img(ts.nrm, TILE_S, 0);
  if (!ts.nrm) for (let k = 0; k < nr.length; k += 3) { nr[k] = 128; nr[k + 1] = 128; nr[k + 2] = 255; }
  // Lackmaske: hellblaue Flächen (Farbton 180..220°, mäßig gesättigt, hell)
  const paint = new Uint8Array(TILE * TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    const r = b[i * 3] / 255, g = b[i * 3 + 1] / 255, bl = b[i * 3 + 2] / 255, M = Math.max(r, g, bl), m = Math.min(r, g, bl), s = M > 0 ? (M - m) / M : 0;
    let h = 0; if (M - m > 1e-4) { if (M === bl) h = 240 + 60 * (r - g) / (M - m); else if (M === g) h = 120 + 60 * (bl - r) / (M - m); else h = (360 + 60 * (g - bl) / (M - m)) % 360; }
    if (h > 180 && h < 225 && s > 0.12 && s < 0.6 && M > 0.45) paint[i] = 1;
  }
  // mittlere Helligkeit des Lacks: der Lack wird grau (Helligkeit relativ zum Mittel), die Wagenfarbe kommt im Spiel dazu
  let sum = 0, cnt = 0; for (let i = 0; i < TILE * TILE; i++) if (paint[i]) { sum += b[i * 3] * 0.3 + b[i * 3 + 1] * 0.59 + b[i * 3 + 2] * 0.11; cnt++; }
  const mean = cnt ? sum / cnt : 1; paintPx += cnt;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const i = y * TILE + x, o = ((ty * TILE + y) * 2 * TILE + tx * TILE + x) * 4;
    if (paint[i]) {
      const l = (b[i * 3] * 0.3 + b[i * 3 + 1] * 0.59 + b[i * 3 + 2] * 0.11) / mean, g = Math.round(255 * Math.min(1, 0.9 * Math.pow(Math.min(1.2, l), 1 / 2.2)));
      baseA[o] = baseA[o + 1] = baseA[o + 2] = g; baseA[o + 3] = 0;
    } else { baseA[o] = b[i * 3]; baseA[o + 1] = b[i * 3 + 1]; baseA[o + 2] = b[i * 3 + 2]; baseA[o + 3] = 255; }
  }
  const f = TILE / TILE_S;
  for (let y = 0; y < TILE_S; y++) for (let x = 0; x < TILE_S; x++) {
    const i = y * TILE_S + x, o = ((ty * TILE_S + y) * 2 * TILE_S + tx * TILE_S + x) * 3, bi = (y * f) * TILE + x * f;
    let R = mr[i * 3], G = mr[i * 3 + 1], B = mr[i * 3 + 2];
    const lum = (b[bi * 3] + b[bi * 3 + 1] + b[bi * 3 + 2]) / 765;
    if (paint[bi]) { G = 70; B = 30; }                      // Lack: glatt, leicht metallisch (Klarlack-Glanz im Laternenlicht)
    else if (lum < 0.07 && B < 128) { G = Math.min(G, 50); } // schwarze Scheiben, Kotflügel: spiegelnd
    mrA.set([R, G, B], o);
    nA.set([nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]], o);
  }
}
console.log('Lackfläche:', (100 * paintPx / (texSets.length * TILE * TILE)).toFixed(1), '% der Atlasfläche');
const baseWebp = await sharp(baseA, { raw: { width: 2 * TILE, height: 2 * TILE, channels: 4 } }).webp({ quality: 82, alphaQuality: 100, effort: 6 }).toBuffer();
const mrJpg = await sharp(mrA, { raw: { width: 2 * TILE_S, height: 2 * TILE_S, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
const nJpg = await sharp(nA, { raw: { width: 2 * TILE_S, height: 2 * TILE_S, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
console.log('Bilder:', (baseWebp.length / 1024).toFixed(0), 'KB Farbe,', (mrJpg.length / 1024).toFixed(0), 'KB MR,', (nJpg.length / 1024).toFixed(0), 'KB Normalen');

/* ---------------- 5. ferne Fassung ---------------- */
// ganzer Wagen mit Rädern, vereinfacht (Ränder dürfen wandern: in 90 m Abstand sieht man keine UV-Nähte)
// Räder der linken Seite: Vorlage um y um 180° gedreht (wie im Spiel)
const allW = W.map(w => { const g = { ...wheelG, P: Float32Array.from(wheelG.P), N: Float32Array.from(wheelG.N) }; const flip = w.z < 0; for (let k = 0; k < g.P.length; k += 3) { if (flip) { g.P[k] = -g.P[k]; g.P[k + 2] = -g.P[k + 2]; g.N[k] = -g.N[k]; g.N[k + 2] = -g.N[k + 2]; } g.P[k] += w.x; g.P[k + 1] += wy; g.P[k + 2] += w.z; } return g; });
const full = merge([body, ...allW]);
const target = Math.floor(full.I.length * LO_RATIO / 3) * 3;
const sl = MeshoptSimplifier.simplify(full.I, full.P, 3, target, 0.04), loI = Array.isArray(sl) ? sl[0] : sl;   // nicht „sloppy“: das würde UV-Inseln verschmelzen und die Bilder verzerren
const lo = { P: full.P, N: full.N, U: full.U, I: Uint32Array.from(loI) };
console.log('Dreiecke: Karosserie', body.I.length / 3, '· Rad', wheelG.I.length / 3, '· fern', lo.I.length / 3);

/* ---------------- Ausgabe ---------------- */
const doc = new Document(); const buf = doc.createBuffer();
const webpExt = doc.createExtension(EXTTextureWebP).setRequired(true);
const tBase = doc.createTexture('farbe').setImage(new Uint8Array(baseWebp)).setMimeType('image/webp');
const tMR = doc.createTexture('mr').setImage(new Uint8Array(mrJpg)).setMimeType('image/jpeg');
const tN = doc.createTexture('normalen').setImage(new Uint8Array(nJpg)).setMimeType('image/jpeg');
const mat = doc.createMaterial('pierce').setBaseColorTexture(tBase).setMetallicRoughnessTexture(tMR).setNormalTexture(tN).setMetallicFactor(1).setRoughnessFactor(1).setDoubleSided(true);
const scene = doc.createScene('wagen');
const addMesh = (name, g) => {
  const n = g.P.length / 3, small = n < 65536;
  const prim = doc.createPrimitive().setMaterial(mat)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.P).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.N).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(g.U).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(small ? Uint16Array.from(g.I) : g.I).setBuffer(buf));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
};
// ungenutzte Ecken der fernen Fassung weglassen
const compact = g => { const map = new Map(), P = [], N = [], U = [], I = []; for (const k of g.I) { if (!map.has(k)) { map.set(k, P.length / 3); P.push(g.P[k * 3], g.P[k * 3 + 1], g.P[k * 3 + 2]); N.push(g.N[k * 3], g.N[k * 3 + 1], g.N[k * 3 + 2]); U.push(g.U[k * 2], g.U[k * 2 + 1]); } I.push(map.get(k)); } return { P: Float32Array.from(P), N: Float32Array.from(N), U: Float32Array.from(U), I: Uint32Array.from(I) }; };
addMesh('body', body); addMesh('wheel', wheelG); addMesh('lo', compact(lo));
const [B0, B1] = bb();
scene.setExtras({ car: {
  len: +(B1[0] - B0[0]).toFixed(3), width: +(B1[2] - B0[2]).toFixed(3), height: +B1[1].toFixed(3),
  front: +front.toFixed(3), rear: +rear.toFixed(3), track: +track.toFixed(3), r: +wr.toFixed(3), axle: +wy.toFixed(3),
  // Scheinwerfer (Gläser vorn außen) und Rücklichter, gemessen am Modell
  lamp: [2.3, 1.22, 0.9], tail: [-2.45, 1.0, 0.72]
} });
doc.getRoot().getAsset().extras = { author: 'Dkerr (https://sketchfab.com/daleraymondkerr)', license: 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)', source: 'https://sketchfab.com/3d-models/1920s-pierce-arrow-ab9e5dfffd474d3b9d8c76f46da1a499', title: "1920'S Pierce Arrow", changes: 'Vespera V38: neu ausgerichtet und skaliert, Räder gelöst, Bilder in einen Atlas verkleinert, Lackmaske, ferne Fassung (tools/make-car.mjs)' };
await new NodeIO().registerExtensions([EXTTextureWebP]).write(OUT, doc);
console.log('geschrieben:', OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
console.log('extras:', JSON.stringify(scene.getExtras()));
