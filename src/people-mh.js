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
   V56: Haut, Kleidung und Haare aus den 2048er-Originalbildern (Atlas 2048 x
   9216, Köpfe 512 x 1024, Anzüge 1024); Kleidung der Zwanziger: Zweireiher mit
   Kreidestreifen und Weste, Hemdsärmel mit Hosenträgern, Tweedjacke, Flapper-
   kleid mit Perlenmieder, Fransen und Trägern, Cloche-Hüte der Damen. Kacheln
   anderer Größe erreicht tileMap (Verschieben und Skalieren der Atlas-UV).
   ===================================================================== */
import { T, MOBILE, ANISO, renderer } from './core.js';
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
    // V44: der Atlas ist 2048 x 5120 px; wenn die Grafik so große Texturen nicht hält, nimmt auch der PC die halbe Fassung
    const small = MOBILE || renderer.capabilities.maxTextureSize < Math.max(meta.atlas.w, meta.atlas.h);
    const tex = await new Promise((ok, no) => new T.TextureLoader().load(resolveAsset(small ? 'people/people-atlas-m.webp' : 'people/people-atlas.webp'), ok, undefined, no));
    tex.encoding = T.sRGBEncoding; tex.anisotropy = Math.min(MOBILE ? 4 : 8, ANISO);   // V44: 8 am PC, Gesichter und Hände bleiben schräg scharf
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
// V56: Cloche-Farben (Filz): dunkles Bordeaux, Schwarz, Creme
const CLO_DARK = [0.26, 0.09, 0.1], CLO_BLACK = [0.05, 0.05, 0.06], CLO_CREAM = [0.62, 0.55, 0.42], CLO_PLUM = [0.2, 0.1, 0.22];
// V56: Grundkachel je Kleidungsteil; eine andere Kachel der Art (K.tile) wird durch Verschieben und Skalieren der Atlas-UV erreicht
const BASE_TILE = { 'suit-m': 'suit', 'work-m': 'work', 'lady-f': 'lady', 'flapper-f': 'flapper', 'braces-m': 'braces', 'jacket-m': 'jacket' };
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
  lady:      { g: 'f', parts: ['lady-f', 'heels-f'], tile: 'lady', keep: ['hat', 'carry', 'props'], hair: ['A', 'B', 'E'], mhHat: { 1: ['cloche-f', CLO_DARK], 3: ['cloche-f', CLO_PLUM] } },   // V79: Glockenhut statt des gerippten Turbans
  gown:      { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.02, to: 1.366, mg: 0.012 }, gloves: GLOVE_SATIN, longGloves: true, hair: ['A', 'B', 'D'] },
  dress:     { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.42, to: 1.366, mg: 0.01 } , hair: ['B', 'A', 'C'] },
  // V39: Dame im langen Pelzmantel (Wintermantel mit Pelzkragen, -manschetten und -saum; Stoff in der Farbe der Figur), Hüte und Taschen wie das Kostüm
  furcoat:   { g: 'f', parts: ['coat-f', 'heels-f'], tile: 'furcoat', keep: ['hat', 'carry', 'props'], build: 'lady', hair: ['A', 'B', 'C'], mhHat: { 1: ['cloche-f', CLO_DARK], 3: ['cloche-f', CLO_CREAM] } },
  // V56: Kleidung der Zwanziger. Zweireiher mit Kreidestreifen und Weste (Anzugnetz, eigene Kachel); Hemdsärmel mit Hosenträgern und
  // Arbeitsjacke (MakeHuman-Freizeitanzüge, umgemalt); Flapperkleid mit Perlenmieder, Fransen, Trägern, langen Handschuhen und Cloche
  dbl:       { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'dbl', keep: ['hat', 'carry', 'props'], build: 'suit', hair: ['D', 'B', 'A'], mhHat: { 1: ['fedora-m', FED_GREY] } },
  braces:    { g: 'm', parts: ['braces-m', 'boots-m'], tile: 'braces', keep: ['hat', 'carry', 'props'], build: 'worker', hair: ['C', 'E', 'A'] },
  jacket:    { g: 'm', parts: ['jacket-m', 'boots-m'], tile: 'jacket', keep: ['hat', 'carry', 'props'], build: 'worker', hair: ['A', 'C', 'E'] },
  flapper:   { g: 'f', parts: ['flapper-f', 'straps-f', 'heels-f'], tile: 'flapper', keep: ['hat', 'carry', 'props'], build: 'lady', hair: ['A', 'B', 'E'], gloves: GLOVE_SATIN, longGloves: true, mhHat: { 1: ['cloche-f', CLO_BLACK], 3: ['cloche-f', CLO_DARK] } },
  // V24: der Spieler (nach den Referenzbildern): eigenes Gesicht, blondes Haar, weiße Rose am Revers (V47: ohne Einstecktuch)
  // V32: im Smoking (Hemdbrust mit Biesen und Onyxknöpfen) mit schwarzer Fliege; Haar glatt zurückgekämmt
  player:    { g: 'm', body: 'p', parts: ['suit-m', 'shoes-m'], tile: 'tux', color: [0.025, 0.025, 0.03], keep: ['props'], player: true, shirt: true, bow: true },
};
// V24: Brillen (3D, rund, Goldrand) für diese Arten; welche Figur eine trägt, entscheidet das Gesicht (FACE_SPECS, auch im Shader)
const SPECS_KINDS = { suit: 1, coat: 1, worker: 1, chauffeur: 1, waiter: 1 };
// Einstecktuch für Anzug und Frack am MakeHuman-Sakko
// V47: Alexander trägt keins mehr, nur die weiße Rose
const POCKET_KINDS = { suit: 1, tux: 1, player: 0, coat: 0 };
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
    // V82: Nasenzwicker (wie Morpheus): zwei kleine ovale, fast schwarze Gläser ohne Bügel, auf die Nasenwurzel geklemmt;
    // ein schmaler Bügel aus dunklem Metall federt über der Nase, zwei Klemmplättchen sitzen seitlich am Nasenrücken
    {
    const z = fc.noseZ - 0.014, y = fc.eyeY - 0.0005, R = 0.0128, cxl = fc.eyeX - 0.003, rim = [0.06, 0.06, 0.065], tint = [0.025, 0.022, 0.022];
    for (const sx of [-1, 1]) {
      P(new T.TorusGeometry(R, 0.0007, 5, 26).scale(1.05, 0.88, 1).translate(sx * cxl, y, z), rim, 0, FAB.metal);
      P(new T.CylinderGeometry(R, R, 0.001, 26).rotateX(Math.PI / 2).scale(1.05, 0.88, 1).translate(sx * cxl, y, z + 0.0003), tint, 0, FAB.patent);
      P(new T.BoxGeometry(0.0022, 0.006, 0.0012).rotateY(sx * 0.9).translate(sx * (cxl - R * 1.02), y - 0.001, z - 0.004), rim, 0, FAB.metal);
    }
    const gap = cxl - R * 1.05;
    P(new T.TorusGeometry(gap, 0.0009, 5, 12, Math.PI).translate(0, y + 0.004, z - 0.002), rim, 0, FAB.metal);
    }
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

/* ---------- V80: Alexanders Frisur, neu gebaut ----------
   Die MakeHuman-Haarkarten (short04, V32 bis V79) begannen gut drei Zentimeter hinter dem Ansatz: von vorn sah man eine nackte
   Stirn bis weit in den Scheitel und darüber eine schwebende Haube. Jetzt wächst das Haar aus dem Schädel selbst: Strahlen aus der
   Kopfmitte treffen die Kopfhaut des Spielerkörpers, darüber liegt eine Haarschale, die genau am gezeichneten Haaransatz auf
   der Haut beginnt (dort 0,25 mm darüber, die Kante ist eine glatte Linie) und erst dahinter Fülle bekommt:
   vorn eine flache, zurückgekämmte Welle, oben voll, an den Seiten und im Nacken kurz (Herrenschnitt der Zwanziger), Scheitel links.
   Strähnen laufen von der Stirn zum Wirbel hinten oben (Koordinaten für den Haar-Shader: quer = Winkel um die Achse Stirn-Wirbel,
   längs = Abstand vom Ansatz); feine Kammrillen in der Form. Rund 5000 Ecken, nur für den Spieler, beim Laden in wenigen ms gebaut */
const PH_LINE = [   // Haaransatz: Winkel um die Hochachse (0 vorn, 90 links/rechts über dem Ohr, 180 hinten) -> Höhe in m
  [0, 1.7245], [16, 1.7255], [30, 1.728], [41, 1.7275], [48, 1.7225], [53, 1.712], [57, 1.698], [61, 1.681], [66, 1.665], [71, 1.652], [76, 1.648], [79, 1.66],
  [82, 1.669], [86, 1.667], [92, 1.664], [98, 1.66], [101, 1.648], [104, 1.628], [108, 1.612], [116, 1.603], [128, 1.596], [142, 1.589], [160, 1.584], [180, 1.582]];
function phLineY(deg) {
  const a = Math.min(180, Math.abs(deg));
  let k = 1; while (k < PH_LINE.length - 1 && PH_LINE[k][0] < a) k++;
  const [a0, y0] = PH_LINE[k - 1], [a1, y1] = PH_LINE[k], f = Math.max(0, Math.min(1, (a - a0) / (a1 - a0))), s = f * f * (3 - 2 * f);
  // feine Unruhe im Ansatz (kein Linealstrich), vorn am feinsten
  return y0 + (y1 - y0) * s + 0.0007 * Math.sin(deg * 0.61) + 0.0005 * Math.sin(deg * 1.37 + 1.3);
}
const phSst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/* V83: Seitenscheitel mit Volumen (nach dem Referenzbild des Spielers). Scheitel auf der rechten Kopfseite der Figur
   (von vorn gesehen links); das Deckhaar steigt aus der Stirn, wölbt sich gleich dahinter zu einer weichen Tolle von knapp
   3 cm und fällt in großem Bogen zur linken Seite und nach hinten; Seiten und Nacken kurz, die kleine Seite flach gekämmt */
const PH_PART = -0.3;   // Scheitel: x-Anteil der Richtung aus der Kopfmitte
function phVol(dx, dy, dz, s) {   // Höhe des Haars über der Haut (m) in Richtung (dx, dy, dz), s = Abstand vom Ansatz
  const tp = phSst(0.05, 0.6, dy), back = phSst(-0.1, -0.6, dz), nape = phSst(-0.15, -0.5, dy), big = phSst(PH_PART - 0.03, PH_PART + 0.07, dx);
  let T = (0.005 + 0.0105 * tp + 0.003 * back * (1 - nape) - 0.0025 * nape) * (0.66 + 0.34 * big);
  // V84: hinter dem Ohr voller (Haar deckt die Stelle zwischen Ohr und Nacken)
  T += 0.003 * phSst(0.45, 0.75, Math.abs(dx)) * phSst(0.1, -0.45, dz) * phSst(0.35, 0.0, dy);
  // V85: über dem Ohr flach anliegend (keine dunkle Kante auf dem Ohr)
  T *= 1 - 0.8 * phSst(0.55, 0.8, Math.abs(dx)) * phSst(0.28, 0.08, dy) * phSst(-0.4, -0.1, dz);
  const fr = phSst(0.0, 0.6, dz) * phSst(0.15, 0.5, dy), lump = Math.exp(-(((dx - PH_PART - 0.42) / 0.55) ** 2));
  T += 0.0085 * fr * lump * big * phSst(0.003, 0.03, s) * (1 - 0.55 * phSst(0.045, 0.12, s));
  T -= 0.005 * Math.exp(-(((dx - PH_PART) / 0.03) ** 2)) * phSst(-0.3, 0.3, dz) * tp;
  const ramp = 0.009 + 0.009 * fr;   // V85: auch an den Seiten weich auslaufend (keine Stufe über dem Ohr)
  return 0.00025 + (Math.max(0.0012, T) - 0.00025) * phSst(0, ramp, s);
}
function phFlow(d, s) {   // Kämmstrich (ungefähre Richtung im Raum), s = Abstand vom Ansatz
  const [dx, dy, dz] = d, big = dx > PH_PART, fr = phSst(0.1, 0.6, dz) * phSst(0.1, 0.45, dy), g = 1 - fr * (1 - phSst(0.003, 0.022, s));
  const sw = big ? [1, 0.25, -0.75] : [-0.9, -0.3, -0.6];
  const up = big ? [1.0, 1, -0.25] : [-0.5, 1, -0.3];
  let v = [up[0] * (1 - g) + sw[0] * g, up[1] * (1 - g) + sw[1] * g, up[2] * (1 - g) + sw[2] * g];
  const wb = phSst(-0.05, -0.5, dz) * phSst(0.8, 0.35, dy);
  v = v.map((c, i) => c * (1 - wb) + [0.2 * Math.sign(dx), -1, -0.25][i] * wb);
  const wl = phSst(0.4, 0.05, dy) * (1 - wb);
  return v.map((c, i) => c * (1 - wl) + [0, -0.45, -1][i] * wl);
}
export function playerHairGeo(body, rig, fine) {
  const P = body.position, I = body.index, cx = 0, cy = rig.headC, cz = rig.headZ;
  // Dreiecke des Kopfes nach Richtung (von der Kopfmitte aus) in Fächer sortieren
  const NAZ = 72, NEL = 36, bins = Array.from({ length: NAZ * NEL }, () => []), tris = [];
  const dirOf = i => { const x = P[i * 3] - cx, y = P[i * 3 + 1] - cy, z = P[i * 3 + 2] - cz, r = Math.hypot(x, y, z) || 1; return [Math.atan2(x, z), Math.asin(y / r)]; };
  const bi = (az, el) => [Math.max(0, Math.min(NAZ - 1, Math.floor((az + Math.PI) / (2 * Math.PI) * NAZ))), Math.max(0, Math.min(NEL - 1, Math.floor((el + Math.PI / 2) / Math.PI * NEL)))];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (P[a * 3 + 1] < cy - 0.16 || P[b * 3 + 1] < cy - 0.16 || P[c * 3 + 1] < cy - 0.16) continue;   // Kopf und Hals (der Nacken gehört nicht zum Kopf)
    const ti = tris.length; tris.push(a, b, c);
    const D = [dirOf(a), dirOf(b), dirOf(c)], els = D.map(d => d[1]), azs = D.map(d => d[0]);
    const e0 = bi(0, Math.min(...els))[1] - 1, e1 = bi(0, Math.max(...els))[1] + 1;
    let ranges; const lo = Math.min(...azs), hi = Math.max(...azs);
    if (Math.max(...els.map(Math.abs)) > 1.3) ranges = [[0, NAZ - 1]];
    else if (hi - lo > Math.PI) { const pos = azs.filter(v => v > 0), neg = azs.filter(v => v <= 0); ranges = [[bi(Math.min(...pos), 0)[0] - 1, NAZ - 1], [0, bi(Math.max(...neg), 0)[0] + 1]]; }
    else ranges = [[bi(lo, 0)[0] - 1, bi(hi, 0)[0] + 1]];
    for (const [r0, r1] of ranges) for (let j = Math.max(0, r0); j <= Math.min(NAZ - 1, r1); j++) for (let e = Math.max(0, e0); e <= Math.min(NEL - 1, e1); e++) bins[e * NAZ + j].push(ti);
  }
  // Strahl aus der Kopfmitte: erster Treffer auf der Haut (Ohren liegen außerhalb und werden nicht getroffen)
  const hit = (az, el) => {
    const dx = Math.sin(az) * Math.cos(el), dy = Math.sin(el), dz = Math.cos(az) * Math.cos(el);
    const test = list => { let best = Infinity;
      for (const ti of list) {
        const a = tris[ti] * 3, b = tris[ti + 1] * 3, c = tris[ti + 2] * 3;
        const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2], e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x, det = e1x * px + e1y * py + e1z * pz;
        if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, sx = cx - P[a], sy = cy - P[a + 1], sz = cz - P[a + 2], u = (sx * px + sy * py + sz * pz) * inv; if (u < -1e-4 || u > 1.0001) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x, v = (dx * qx + dy * qy + dz * qz) * inv; if (v < -1e-4 || u + v > 1.0002) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv; if (t > 0.03 && t < best) best = t;
      }
      return best; };
    const [j, e] = bi(az, el); let r = test(bins[e * NAZ + j]);
    if (r === Infinity) r = test(tris.map((_, k) => k).filter(k => k % 3 === 0));
    if (r === Infinity) r = 0.09;
    return [dx, dy, dz, r];
  };
  const NU = fine ? 150 : 56, NV = fine ? 30 : 12, top = Math.PI / 2;
  // Achse Stirn -> Wirbel (hinten oben): die Strähnen laufen auf Großkreisen um sie herum nach hinten
  const cols = NU + 1, rows = NV + 1, n = cols * rows;
  const pos = new Float32Array(n * 3), uvA = new Float32Array(n * 2), dirs = new Float32Array(n * 3);
  const eHs = new Float32Array(cols);
  for (let j = 0; j < cols; j++) {
    const az = -Math.PI + 2 * Math.PI * j / NU, deg = az * 180 / Math.PI, yh = phLineY(deg);
    // Höhe des Ansatzes in dieser Richtung: von oben herab, bis der Treffer unter der Linie liegt, dann halbieren
    let eHi = top - 0.02, eLo = eHi;
    for (let e = top - 0.04; e > -1.4; e -= 0.02) { const h = hit(az, e); if (cy + h[1] * h[3] < yh) { eLo = e; break; } eHi = e; }
    for (let k = 0; k < 10; k++) { const m = (eHi + eLo) / 2, h = hit(az, m); if (cy + h[1] * h[3] < yh) eLo = m; else eHi = m; }
    const eH = (eHi + eLo) / 2;
    eHs[j] = eH;
    let s = 0, prev = null;
    for (let k = 0; k < rows; k++) {
      const w = k / NV, el = eH + (top - eH) * Math.pow(w, 1.55), h = hit(az, k === NV ? top - 1e-4 : el);
      const x = h[0] * h[3], y = h[1] * h[3], z = h[2] * h[3];
      if (prev) s += Math.hypot(x - prev[0], y - prev[1], z - prev[2]); prev = [x, y, z];
      const t = phVol(h[0], h[1], h[2], s), o = (j * rows + k) * 3;
      pos[o] = cx + h[0] * (h[3] + t); pos[o + 1] = cy + h[1] * (h[3] + t); pos[o + 2] = cz + h[2] * (h[3] + t);
      dirs[o] = h[0]; dirs[o + 1] = h[1]; dirs[o + 2] = h[2];
      // V83: die Schale ist nur der Unterbau zwischen den Locken: ruhige Koordinaten, keine eigenen Rillen
      uvA[(j * rows + k) * 2] = az * 0.9; uvA[(j * rows + k) * 2 + 1] = s / 0.028;
    }
  }
  // Dreiecke; wo der Winkel quer über die Naht springt, eigene Ecken mit fortgesetztem Winkel
  const idx = [], extra = [], WRAP = 2 * Math.PI * 0.9;
  const tri = (a, b, c) => {
    const ua = uvA[a * 2], ub = uvA[b * 2], uc = uvA[c * 2], span = Math.max(ua, ub, uc) - Math.min(ua, ub, uc);
    if (span < WRAP / 2) { idx.push(a, b, c); return; }
    const out = []; for (const v of [a, b, c]) { const nv = n + extra.length; extra.push([v, uvA[v * 2] < 0 ? uvA[v * 2] + WRAP : uvA[v * 2]]); out.push(nv); }
    idx.push(...out);
  };
  for (let j = 0; j < NU; j++) for (let k = 0; k < NV; k++) {
    const a = j * rows + k, b = (j + 1) * rows + k, c = a + 1, d = b + 1;
    tri(a, c, b); tri(b, c, d);
  }
  const N = n + extra.length, fp = new Float32Array(N * 3), fu = new Float32Array(N * 2);
  fp.set(pos); fu.set(uvA);
  extra.forEach(([v, u], i) => { fp.set(pos.subarray(v * 3, v * 3 + 3), (n + i) * 3); fu[(n + i) * 2] = u; fu[(n + i) * 2 + 1] = uvA[v * 2 + 1]; });
  const nrm = new Float32Array(N * 3), acc = new Float32Array(n * 3);
  const base = v => v < n ? v : extra[v - n][0];
  const canon = v => { const b = base(v), j = Math.floor(b / rows), k = b % rows; return k === NV ? NV : (j % NU) * rows + k; };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ux = fp[b * 3] - fp[a * 3], uy = fp[b * 3 + 1] - fp[a * 3 + 1], uz = fp[b * 3 + 2] - fp[a * 3 + 2], wx = fp[c * 3] - fp[a * 3], wy = fp[c * 3 + 1] - fp[a * 3 + 1], wz = fp[c * 3 + 2] - fp[a * 3 + 2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    for (const v of [a, b, c]) { const q = canon(v) * 3; acc[q] += nx; acc[q + 1] += ny; acc[q + 2] += nz; }
  }
  for (let v = 0; v < N; v++) {
    const q = canon(v) * 3, b = base(v) * 3; let x = acc[q], y = acc[q + 1], z = acc[q + 2];
    if (x * dirs[b] + y * dirs[b + 1] + z * dirs[b + 2] < 0) { x = -x; y = -y; z = -z; }
    const l = Math.hypot(x, y, z); if (l < 1e-12) { x = dirs[b]; y = dirs[b + 1]; z = dirs[b + 2]; } else { x /= l; y /= l; z /= l; }
    nrm[v * 3] = x; nrm[v * 3 + 1] = y; nrm[v * 3 + 2] = z;
  }
  let out = 0; for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const ux = fp[b * 3] - fp[a * 3], uy = fp[b * 3 + 1] - fp[a * 3 + 1], uz = fp[b * 3 + 2] - fp[a * 3 + 2], wx = fp[c * 3] - fp[a * 3], wy = fp[c * 3 + 1] - fp[a * 3 + 1], wz = fp[c * 3 + 2] - fp[a * 3 + 2];
    out += (uy * wz - uz * wy) * (fp[a * 3] - cx) + (uz * wx - ux * wz) * (fp[a * 3 + 1] - cy) + (ux * wy - uy * wx) * (fp[a * 3 + 2] - cz); }
  if (out < 0) for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  // V83: Locken. Jede Locke ist ein weich gewölbtes Band (fünf Ecken quer), das vom Scheitel, vom Stirnansatz oder irgendwo
  // aus dem Haar dem Kämmstrich folgt (phFlow): vorn erst aufwärts aus der Stirn, dann in großem Bogen zur linken Seite und
  // nach hinten; auf der kleinen Seite rechts vom Scheitel zum Ohr; hinten abwärts in den Nacken. Breite 0,6 bis 1,4 cm,
  // Wölbung bis 4 mm, jede Locke etwas höher als die darunter, die Spitzen heben sich oben leicht ab (weich, nicht geleckt).
  // Die Eckenfarbe (r) dunkelt die Zwischenräume ab und gibt jeder Locke eine eigene Helligkeit (Sonnensträhnen)
  const P2 = [], N2 = [], U2 = [], C2 = [], I2 = [], SW2 = [];
  const col = new Float32Array(N).fill(0.7);
  const rad = new Float32Array(n); for (let v = 0; v < n; v++) rad[v] = Math.hypot(pos[v * 3] - cx, pos[v * 3 + 1] - cy, pos[v * 3 + 2] - cz);
  const eAt = az => { const fj = (az + Math.PI) / (2 * Math.PI) * NU, j0 = Math.min(NU - 1, Math.floor(fj)), tj = fj - j0; return eHs[j0] * (1 - tj) + eHs[j0 + 1] * tj; };
  const shellR = (d) => {   // Radius der Schale in Richtung d (Einheitsvektor), null außerhalb des Haars
    const az = Math.atan2(d[0], d[2]), el = Math.asin(Math.max(-1, Math.min(1, d[1])));
    const fj = (az + Math.PI) / (2 * Math.PI) * NU, j0 = Math.min(NU - 1, Math.floor(fj)), tj = fj - j0;
    const eH = eHs[j0] * (1 - tj) + eHs[j0 + 1] * tj; if (el < eH + 0.006) return null;
    const fk = Math.pow(Math.min(1, (el - eH) / (top - eH)), 1 / 1.55) * NV, k0 = Math.min(NV - 1, Math.floor(fk)), tk = fk - k0;
    const r = (j, k) => rad[j * rows + k];
    return (r(j0, k0) * (1 - tj) + r(j0 + 1, k0) * tj) * (1 - tk) + (r(j0, k0 + 1) * (1 - tj) + r(j0 + 1, k0 + 1) * tj) * tk;
  };
  const nv3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const vdir = v => nv3([pos[v * 3] - cx, pos[v * 3 + 1] - cy, pos[v * 3 + 2] - cz]);
  const NS = fine ? 230 : 80, STEP = fine ? 0.006 : 0.01, X5 = [-1, -0.55, 0, 0.55, 1];
  for (let q = 0; q < NS; q++) {
    // Anfang: ein Drittel am Stirn- und Schläfenansatz, ein Fünftel am Scheitel, der Rest überall im Haar
    let d, kind = q % 15;
    if (kind < 5) { const az = (rnd() - 0.5) * 3.6, j = Math.max(0, Math.min(NU, Math.round((az + Math.PI) / (2 * Math.PI) * NU))); d = vdir(j * rows + 1 + Math.floor(rnd() * 2)); }
    else if (kind < 8) { for (let g = 0; g < 40; g++) { const v = Math.floor(rnd() * n); d = vdir(v); if (Math.abs(d[0] - PH_PART - 0.035) < 0.05 && d[1] > 0.25 && d[2] > -0.5) break; } }
    else { const j = Math.floor(rnd() * NU), k = 1 + Math.floor(rnd() * (NV - 3)); d = vdir(j * rows + k); }
    const tpq = phSst(0.1, 0.6, d[1]) * phSst(-0.6, 0.0, d[2]), big = d[0] > PH_PART ? 1 : 0;
    const L = (0.05 + 0.05 * rnd()) * (1 + 0.6 * tpq * big + 0.3 * tpq), steps = Math.max(4, Math.round(L / STEP));
    const W = (0.006 + 0.005 * rnd()) * (1 + 0.3 * tpq), H0 = (0.0012 + 0.0016 * rnd()) * (0.6 + 0.9 * tpq), lay = 0.0004 + 0.0018 * rnd() * (0.4 + tpq);
    const fluff = tpq * (0.001 + 0.004 * rnd()), wa = 0.15 + 0.3 * rnd(), wf = 30 + 30 * rnd(), wp = rnd() * 6.28, uo = rnd() * 40, br = 0.84 + 0.32 * rnd();
    // V85: erst den Weg gehen, dann bauen: so läuft jede Locke spitz aus, auch wenn sie vorzeitig am Haaransatz endet
    // (vorher brach sie dort in voller Breite ab: die kantige dunkle Platte über dem Ohr)
    const path = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, r = shellR(d); if (r === null) break;
      const az = Math.atan2(d[0], d[2]), sIn = (Math.asin(Math.max(-1, Math.min(1, d[1]))) - eAt(az)) * r;
      const F = phFlow(d, sIn), dot = F[0] * d[0] + F[1] * d[1] + F[2] * d[2], t0 = [F[0] - d[0] * dot, F[1] - d[1] * dot, F[2] - d[2] * dot];
      if (Math.hypot(...t0) < 0.05) break;
      const t = nv3(t0), sd = nv3(crs(d, t)); path.push([d, sd, r]);
      const wv = Math.sin(u * wf * L + wp) * wa, rs = r + lay;
      d = nv3([d[0] + (t[0] + sd[0] * wv) * STEP / rs, d[1] + (t[1] + sd[1] * wv) * STEP / rs, d[2] + (t[2] + sd[2] * wv) * STEP / rs]);
    }
    const base = P2.length / 3, made = path.length >= 3 ? path.length : 0, Lr = (made - 1) * STEP;
    for (let i = 0; i < made; i++) {
      const [dd, sd, r] = path[i], u = i / (made - 1), d = dd;
      const taper = u < 0.12 ? 0.55 + 0.45 * u / 0.12 : 1 - 0.85 * phSst(0.5, 1, u), w = W * taper; let h = H0 * (u < 0.12 ? 0.5 + 0.5 * u / 0.12 : 1 - 0.7 * phSst(0.6, 1, u));
      // V86: am Ohrrand liegen die Locken flach an (sonst stechen sie durch die Ohrmuschel)
      const ez = phSst(0.55, 0.8, Math.abs(d[0])) * phSst(0.28, 0.08, d[1]) * phSst(-0.4, -0.1, d[2]);
      const rr = r + (lay + fluff * phSst(0.45, 1, u)) * (1 - 0.85 * ez); h *= 1 - 0.75 * ez;
      for (const e of X5) {
        // Ränder tauchen immer in die Schale ein (auch bei abstehenden Spitzen): die Unterseite einer Locke bleibt unsichtbar
        const sink = r - 0.0006 - rr, off = e * w / 2, lift = sink + (h - sink) * Math.sqrt(Math.max(0, 1 - e * e));
        P2.push(cx + d[0] * (rr + lift) + sd[0] * off, cy + d[1] * (rr + lift) + sd[1] * off, cz + d[2] * (rr + lift) + sd[2] * off);
        N2.push(...nv3([d[0] + sd[0] * e * 0.75, d[1] + sd[1] * e * 0.75, d[2] + sd[2] * e * 0.75]));
        U2.push(uo + e * 0.5, 0.35 + u * Lr / 0.028); C2.push(br * (Math.abs(e) > 0.9 ? 0.74 : Math.abs(e) > 0.4 ? 0.95 : 1.06));
        SW2.push(0.32 * Math.pow(u, 1.5) * (0.55 + 0.45 * tpq) * (1 - ez));   // V88: Spitzen schwingen leicht im Wind und im Flug
      }
    }
    for (let i = 0; i + 1 < made; i++) for (let e = 0; e < 4; e++) {
      const a = base + i * 5 + e, b = a + 1, c = a + 5, dd = a + 6;
      I2.push(a, c, b, b, c, dd);
    }
    if (made < 2) { P2.length = N2.length = base * 3; U2.length = base * 2; C2.length = base; SW2.length = base; }
  }
  // Ausrichtung der Bänder nach außen (jede Locke einzeln: der Kämmstrich wechselt am Scheitel die Richtung)
  for (let t = 0; t < I2.length; t += 3) { const a = I2[t] * 3, b = I2[t + 1] * 3, c = I2[t + 2] * 3;
    const ux = P2[b] - P2[a], uy = P2[b + 1] - P2[a + 1], uz = P2[b + 2] - P2[a + 2], wx = P2[c] - P2[a], wy = P2[c + 1] - P2[a + 1], wz = P2[c + 2] - P2[a + 2];
    if ((uy * wz - uz * wy) * (P2[a] - cx) + (uz * wx - ux * wz) * (P2[a + 1] - cy) + (ux * wy - uy * wx) * (P2[a + 2] - cz) < 0) { const k = I2[t + 1]; I2[t + 1] = I2[t + 2]; I2[t + 2] = k; } }
  const M = N + P2.length / 3, fp2 = new Float32Array(M * 3), nr2 = new Float32Array(M * 3), fu2 = new Float32Array(M * 2), cl2 = new Float32Array(M);
  fp2.set(fp); fp2.set(P2, N * 3); nr2.set(nrm); nr2.set(N2, N * 3); fu2.set(fu); fu2.set(U2, N * 2); cl2.set(col); cl2.set(C2, N);
  const idx2 = Uint32Array.from([...idx, ...I2.map(v => v + N)]);
  // Eckenfarbe geteilt durch 1,25 (der Shader nimmt sie mal 1,25): Farben mit Summe >= 2,97 ersetzt der Shader durch die
  // Instanzfarbe (Anzug), daran lagen in V82 die schwarzen Kratzer in hellen Strähnen
  for (let i = 0; i < M; i++) cl2[i] = Math.min(0.97, cl2[i] / 1.25);
  const soft = new Float32Array(M * 3); for (let i = 0; i < M; i++) soft[i * 3] = FAB.hair;
  for (let i = 0; i < SW2.length; i++) { soft[(N + i) * 3 + 1] = SW2[i]; soft[(N + i) * 3 + 2] = SW2[i] > 0.002 ? 6 : 0; }   // V88: Art 6 = kurze Locken
  return { position: fp2, normal: nr2, uv: new Float32Array(M * 2), index: idx2, count: M, faceUV: fu2, shade: cl2,
    _limb: new Float32Array(M * 2), _opt: new Float32Array(M), _soft: soft, _texk: new Float32Array(M), _blend: new Float32Array(M) };
}

/* ---------- Eine Art zusammensetzen ---------- */
export function mhPersonGeo(kind, q) {
  const K = MH_KIND[kind] || MH_KIND.suit, gk = K.g, rig = HRIG[gk], fine = q > 1.5, lod = fine ? '' : '@1';
  const S = n => MHP.src[n + lod] || MHP.src[n];
  const meta = MHP.meta, RECT = meta.atlas.rect, AW = meta.atlas.w, AH = meta.atlas.h, TILE = meta.atlas.tile, hm = HATMASK[kind] || 0;
  // V56: Atlas-UV einer Grundkachel auf eine andere (auch anders große) Kachel legen: [u0', v0', u0, v0, su, sv]; v zählt von unten
  const tileMap = (a, b) => [b[0] * TILE / AW, 1 - (b[1] + b[3]) * TILE / AH, a[0] * TILE / AW, 1 - (a[1] + a[3]) * TILE / AH, b[2] / a[2], b[3] / a[3]];
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
      if (o.map) A.tuv.push(o.map[0] + (src.uv[i * 2] - o.map[2]) * o.map[4], o.map[1] + (src.uv[i * 2 + 1] - o.map[3]) * o.map[5]);
      else A.tuv.push(src.uv[i * 2] + du, src.uv[i * 2 + 1] + dv);
      A.tk.push(tk); A.bl.push(src._blend[i]);
    }
    for (const i of tris) A.idx.push(base + map[i]);
    A.n += k;
  };
  // Körper: unter der Kleidung verdeckte Dreiecke fallen weg
  const bits = meta.hideBits; let mask = 0; for (const p of K.parts) mask |= bits[p] || 0;
  const inCover = (src, i) => cover && src.position[i * 3 + 1] > cover.y0 && src.position[i * 3 + 1] < cover.y1;
  // V24: Kopf und Hals vorn bekommen Gesichtskoordinaten (gemalte Schminke, Bärte, Falten); der Spieler hat sein eigenes Gesicht
  // V79: das gemalte Gesicht (FACE_ATLAS) liegt nicht mehr auf den MakeHuman-Köpfen: Lider, Brauenschatten und Lippen sind in die
  // Hautkacheln gemalt (tools/make-people.mjs, faceFinish) und sitzen dort genau; der Shader spart zwei Texturzugriffe je Bildpunkt
  const fm = null, r = rig, chin = r.face ? r.face.chinY - 0.045 : r.neck - 0.05;
  const face = fm ? i => { const g = bodySrc._reg[i], y = bodySrc.position[i * 3 + 1]; return (g === 1 || g === 2) && y > chin ? fm(bodySrc.position[i * 3], y, bodySrc.position[i * 3 + 2]) : null; } : null;
  // V79: Farbe der Hautecken = Gewicht "Kopfhaut unter dem Haar" für die drei Frisuren der Art (r, g, b); der Shader nimmt das der
  // gewählten Frisur und färbt die Haut dort in der Haarfarbe (sonst 0: reine Haut)
  const HL5 = 'ABCDE', hs = K.player ? ['A', 'A', 'A'] : (K.hair || ['A', 'B', 'C']), scq = bodySrc._scalp, sce = bodySrc._scalq;
  const scalpCol = K.player ? [0, 0, 0] : scq ? i => hs.map(h => { const k = HL5.indexOf(h); return k < 4 ? scq[i * 4 + k] : sce[i]; }) : [0, 0, 0];
  add(bodySrc, { isBody: true, face, color: scalpCol, drop: i => (bodySrc._hide[i] & mask) !== 0 || (inCover(bodySrc, i) && bodySrc._reg[i] !== 4 && bodySrc._reg[i] !== 5 && bodySrc._reg[i] !== 6 && bodySrc._reg[i] !== 1) });
  add(S('eyes-' + gk));
  if (K.player) {   // V80: eigene Haarschale statt der MakeHuman-Karten (siehe playerHairGeo)
    const hg = MHP.hairP || (MHP.hairP = {}), key = fine ? 'f' : 'c';
    const H = hg[key] || (hg[key] = playerHairGeo(MHP.src['body-p'], rig, fine));
    add(H, { opt0: true, fab: FAB.hair, color: i => [H.shade[i], H.shade[i], H.shade[i]], face: i => [H.faceUV[i * 2], H.faceUV[i * 2 + 1]] });
  }       // V32: glatt zurückgekämmt mit Seitenscheitel (MakeHuman short04), immer; V48: mit mehr Fülle (hairP-m)
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
    else if (pn === 'coat-f' || pn === 'straps-f') o.color = [1, 1, 1];                         // V39: Mantelstoff in Figurenfarbe, Pelz aus dem Atlas; V56: Kleidträger
    else {
      const baseTile = BASE_TILE[pn] || 'lady', t = K.tile || baseTile;
      // V32: Smoking und Kellner: Hemdbrust ohne Krawatte statt der mit
      if (K.shirt && pn === 'suit-m' && src._hide && MHP.src['shirt-m']) { o.drop = i => (src._hide[i] & 64) !== 0; o.shirt = true; }
      if (t !== baseTile) o.map = tileMap(RECT[baseTile], RECT[t]);
      o.color = K.color || [1, 1, 1];
      if (K.coat && pn === 'suit-m') {
        // unter dem Mantel: Ärmel in Mantelfarbe, Hose dunkel; was der Mantel verdeckt, fällt weg
        o.color = i => { const l = src._limb[i * 2]; return (l > 2.5 && l < 4.5) || l > 6.5 ? [1, 1, 1] : DARK_TROUSERS; };
        o.drop = i => { const l = src._limb[i * 2]; return inCover(src, i) && !((l > 2.5 && l < 4.5) || l > 6.5); };
      }
    }
    add(src, o);
    if (o.shirt) add(S('shirt-m'), { map: o.map, color: o.color });
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
