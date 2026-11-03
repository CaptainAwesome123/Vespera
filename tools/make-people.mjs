// V22 · Figuren aus MakeHuman (CC0): Körper, Kleidung, Haare, Augen, Brauen, Wimpern.
// V39: vier weitere Frisuren (short03, afro01, long01, braid01), echte Fedoras (zwei Formen), Pelzmantel der Damen
// (Coat von punkduck, CC BY 3.0) und braune Herrenschuhe (shoes04); der Atlas wächst um eine Reihe auf 2048 x 3584.
// V24: Gesichtsmerkmale (Brauen, Nase, Mund, Kinn) je Körper für die gemalten Gesichter; Spielerkörper 'p'
// (Herrenkörper mit eigenen Gesichtszügen) mit Gesichtskachel aus einem Referenzbild (tools/people/player-ref.jpg).
// Baut assets/people/people.glb (Netze in der Ruhehaltung des Spiels, mit Glied-Zuordnung),
// assets/people/people-atlas.webp (+ -m für Handys: Haut, Stoffe, Haare in einem Bild) und
// assets/people/people.json (Gelenkpunkte, Netze je Art, Atlas-Einteilung).
//
// Aufruf: node tools/make-people.mjs <makehuman/data> <makehuman-data/public/data> [vorschau-ordner]
//   (makehuman/data braucht 3dobjs, rigs, eyes, targets/macrodetails und für den Spieler targets/chin, mouth, cheek, nose, head)
//   <makehuman/data>: github.com/makehumancommunity/makehuman, Ordner makehuman/data (CC0 seit 2020)
//   <makehuman-data>: npm-Paket makehuman-data 0.0.2, Ordner public/data (Kleidung, Haare, Hautbilder
//                     aus der MakeHuman-Grundausstattung, laut MakeHuman-Lizenz CC0)
// Werkzeuge: npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import * as M from './people/mh.mjs';
import * as F from './people/fit.mjs';

// V56: dritter Ordner = die mit MakeHuman ausgelieferten Bilder in voller Größe (2048 px: Haut, Kleidung, Haare; CC0 wie die
//   Grundausstattung): github.com/dmaugis/makehuman-py3-assets, Ordner base (Dateien über Git LFS bzw. media.githubusercontent.com).
//   Fehlt er, werden die 512er-Bilder des npm-Pakets genommen (gröber, aber derselbe Aufbau)
const [,, MH, ND, HI, PREV] = process.argv;
if (!MH || !ND) { console.error('Aufruf: node tools/make-people.mjs <makehuman/data> <makehuman-data/public/data> [makehuman-py3-assets/base] [vorschau]'); process.exit(1); }
const hi = (...p) => { if (!HI) return null; const f = path.join(HI, ...p); return fs.existsSync(f) ? f : null; };
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'people');
fs.mkdirSync(OUT, { recursive: true });
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;

/* ---------------- Einstellungen ---------------- */
const BODIES = {
  m: { female: false, ethnic: { caucasian: 0.7, african: 0.15, asian: 0.15 }, abd: 0.075, heel: 0, footX: 0.9 },
  f: { female: true, ethnic: { caucasian: 0.7, african: 0.15, asian: 0.15 }, abd: 0.12, heel: 0.32, footX: 0.85 },
  // Spieler: derselbe Herrenkörper (gleiche Gelenke, gleiche Kleidung), nur das Gesicht nach dem Referenzbild:
  // kräftiges, breites Kinn, breiter lächelnder Mund, hohe Wangenknochen, gerade Nase. Schädel bleibt (Haare passen)
  p: { female: false, ethnic: { caucasian: 0.7, african: 0.15, asian: 0.15 }, abd: 0.075, heel: 0, footX: 0.9, player: true,
    // V48: näher an die Referenzbilder (Party, Luftschiff): schmaleres, jüngeres Gesicht mit klar gezeichnetem Kiefer statt breitem Kinn,
    // schmalere Wangen und Nase, volle Oberlippe, freundliches Lächeln. Nur Ziele, die Brauen und Wimpern nicht verschieben (die sitzen
    // als Herren-Proxies auf dem Herrenkörper) und den Schädel lassen (Haar passt)
    extra: [['chin/chin-prominent-incr.target', 0.3], ['chin/chin-width-incr.target', 0.15], ['chin/chin-height-incr.target', 0.15], ['chin/chin-bones-incr.target', 0.35],
      ['mouth/mouth-scale-horiz-incr.target', 0.2], ['mouth/mouth-angles-up.target', 0.35], ['mouth/mouth-lowerlip-volume-incr.target', 0.2], ['mouth/mouth-upperlip-volume-incr.target', 0.2],
      ['cheek/l-cheek-bones-incr.target', 0.35], ['cheek/r-cheek-bones-incr.target', 0.35], ['cheek/l-cheek-volume-decr.target', 0.35], ['cheek/r-cheek-volume-decr.target', 0.35],
      ['nose/nose-point-width-decr.target', 0.25], ['nose/nose-scale-vert-incr.target', 0.15], ['nose/nose-hump-decr.target', 0.3], ['nose/nose-scale-horiz-decr.target', 0.15],
      ['head/head-fat-decr.target', 0.35], ['head/head-age-decr.target', 0.25]] },
};
// Referenzbild für das Gesicht des Spielers und die Lage seiner Merkmale im Bild (Pixel): Augen (rechtes, linkes
// Auge der Figur = links, rechts im Bild), Mundwinkel, Kinnspitze. Nur das Gesicht wird übernommen, ohne Licht und Schatten.
const PLAYER_REF = { file: path.join(path.dirname(new URL(import.meta.url).pathname), 'people', 'player-ref.jpg'),
  eyeR: [90, 167], eyeL: [153, 153], mouthR: [100, 223], mouthL: [168, 215], chin: [137, 268] };
// Kleidung, Haare und Kleinteile (Proxies); body: für welchen Körper; tex: Bereich im Atlas; fab: Stoffart des Spiels
const PARTS = {
  'suit-m':    { body: 'm', src: 'clothes/male_elegantsuit01', fab: 'wool' },
  'work-m':    { body: 'm', src: 'clothes/male_worksuit01', fab: 'cotton' },
  'shoes-m':   { body: 'm', src: 'clothes/shoes03', fab: 'leather' },
  'boots-m':   { body: 'm', src: 'clothes/shoes01', fab: 'leather' },
  'lady-f':    { body: 'f', src: 'clothes/female_elegantsuit01', fab: 'wool', skirt: true },
  'hairA-m':   { body: 'm', src: 'hair/short02', hair: true },
  'hairB-m':   { body: 'm', src: 'hair/short04', hair: true },
  'hairC-m':   { body: 'm', src: 'hair/short01', hair: true },
  'hairA-f':   { body: 'f', src: 'hair/bob02', hair: true, sway: 0.7, bangs: true },
  'hairB-f':   { body: 'f', src: 'hair/bob01', hair: true, sway: 0.6, bangs: true },
  'hairC-f':   { body: 'f', src: 'hair/ponytail01', hair: true, sway: 0.8 },
  // V39: weitere Frisuren (Seitenscheitel, kurze Locken, lang offen, Zopf), Hüte und Mantel aus MakeHuman, zweite Herrenschuhe
  'hairD-m':   { body: 'm', src: 'hair/short03', hair: true },
  'hairE-m':   { body: 'm', src: 'hair/afro01', hair: true },
  'hairD-f':   { body: 'f', src: 'hair/long01', hair: true, sway: 0.9 },
  'hairE-f':   { body: 'f', src: 'hair/Braid01', hair: true, sway: 0.5 },
  'fedora-m':  { body: 'm', src: 'clothes/fedora', hat: true, fab: 'felt' },
  'fedora2-m': { body: 'm', src: 'clothes/fedora_cocked', hat: true, fab: 'felt' },
  'coat-f':    { body: 'f', src: 'clothes/Coat', fab: 'wool', skirt: true, furcoat: true },
  'shoes2-m':  { body: 'm', src: 'clothes/shoes04', fab: 'leather' },
  // V56: Kleidung der Zwanziger. Flapperkleid aus dem geraden TubeDress (punkduck, CC BY 3.0): Perlenmieder, tiefe Taille, Fransen
  // gemalt; Hemdsärmel mit Hosenträgern und Arbeitsjacke aus den MakeHuman-Freizeitanzügen 03 und 05 (Grundausstattung, CC0),
  // in den Kacheln zu Leinenhemd, Wollhose, Cordjacke umgemalt. Cloche (Glockenhut) und Kleidträger werden unten gebaut
  'flapper-f': { body: 'f', src: 'clothes/TubeDress', fab: 'silk', skirt: true },
  'braces-m':  { body: 'm', src: 'clothes/male_casualsuit03', fab: 'cotton' },
  'jacket-m':  { body: 'm', src: 'clothes/male_casualsuit05', fab: 'wool' },
  'brows-m':   { body: 'm', src: 'eyebrows/eyebrow001', brow: true },
  'brows-f':   { body: 'f', src: 'eyebrows/eyebrow010', brow: true },
  'lashes-m':  { body: 'm', src: 'eyelashes/Eyelashes01', brow: true },
  'lashes-f':  { body: 'f', src: 'eyelashes/Eyelashes01', brow: true },
};
const FAB = { skin: 1, hair: 2, wool: 3, silk: 4, cotton: 5, leather: 6, fur: 7, felt: 8, straw: 9, sequin: 10, knit: 11, metal: 12, satin: 13, stock: 14 };
// Atlas: 4 x 6 Kacheln zu 512 px. Haut: Kachel je Geschlecht und Alter/Herkunft (Auswahl im Shader); Reihe 5: Spieler
// V56: 18 Reihen (2048 x 9216). Köpfe 512 x 1024 (die Kopfinsel ist knapp doppelt so hoch wie breit), Anzüge, Kostüm, Flapperkleid
// und Latzhose 1024 px, alles aus den 2048er-Quellbildern. Handys und Grafik mit kleineren Texturen nehmen die halbe Fassung
const TILE = 512, AW = 4 * TILE, AH = 18 * TILE;
const SKIN = {
  m: ['young_caucasian_male/textures/young_lightskinned_male_diffuse.png', 'middleage_caucasian_male/textures/middleage_lightskinned_male_diffuse.png', 'old_caucasian_male/textures/old_lightskinned_male_diffuse.png', 'young_african_male/textures/young_darkskinned_male_diffuse.png'],
  f: ['young_caucasian_female/textures/young_lightskinned_female_diffuse.png', 'middleage_caucasian_female/textures/middleage_lightskinned_female_diffuse.png', 'old_caucasian_female/textures/old_lightskinned_female_diffuse.png', 'young_african_female/textures/young_darkskinned_female_diffuse.png'],
};
// V56: dieselben Hautbilder in 2048 px (makehuman-py3-assets/base/skins/textures), wenn vorhanden
const skinFile = (gk, k) => hi('skins', 'textures', path.basename(SKIN[gk][k])) || sk(SKIN[gk][k]);
// V56: Kleidungs- und Haarbilder in 2048 px (base/clothes/<name>/<name>_diffuse.png, base/hair/<name>/<name>_diffuse.png), sonst die des Teils
const HI_NAME = { 'hairE-m': 'afro' }, HI_PATH = { 'fedora-m': ['clothes', 'fedora01', 'materials', 'fedora_texture.png'] };
function partTex(name) {
  const P = parts[name], src = path.basename(P.def.src).toLowerCase(), dir = P.def.hair ? 'hair' : 'clothes';
  return (HI_PATH[name] && hi(...HI_PATH[name])) || hi(dir, src, (HI_NAME[name] || src) + '_diffuse.png') || P.tex;
}
const partAO = name => { const src = path.basename(parts[name].def.src); return hi('clothes', src, src + '_ao.png'); };
// Bereiche im Atlas [x, y, w, h] in Kacheln; Varianten der Anzüge werden gemalt (paintVariant)
const RECT = {
  skin_m: [0, 0, 1, 1], skin_f: [0, 1, 1, 1],                       // erste Kachel je Reihe; Reihe = Geschlecht, Spalte = Hautbild
  // V44/V56: Köpfe und Hände der Stadtleute in eigenen Kacheln (erste Kachel je Reihe, die Spalte wählt der Shader wie bei der Haut
  // nach Alter und Herkunft), mit gemalten Poren, Lippenlinien und Knöchelfalten; das Relief steckt im Alphakanal.
  // Hände: rechte Hand links, linke Hand rechts in der halben Kachel. Augen in voller Auflösung des Quellbilds (1024 px)
  face_m: [0, 2, 1, 2], face_f: [0, 4, 1, 2], hands_m: [0, 6, 1, 0.5], hands_f: [0, 6.5, 1, 0.5],
  skin_p: [0, 7, 1, 1], face_p: [1, 7, 1, 1], eyes: [2, 7, 2, 1],   // Spieler: Körperhaut und Kopf mit Gesicht
  // V56: Anzugfamilie in 1024 px (dieselbe UV-Anordnung: Varianten durch Verschieben und Skalieren in people-mh.js)
  suit: [0, 8, 2, 2], dbl: [2, 8, 2, 2], tux: [0, 10, 2, 2], lady: [2, 10, 2, 2],
  flapper: [0, 12, 2, 2], work: [2, 12, 2, 2],
  braces: [0, 14, 1, 1], jacket: [1, 14, 1, 1], uniform: [2, 14, 1, 1], waiter: [3, 14, 1, 1],
  furcoat: [0, 15, 1, 1], hairA_f: [1, 15, 1, 1], hairB_f: [2, 15, 1, 1], hairC_f: [3, 15, 1, 1],
  hairD_f: [0, 16, 1, 1], hairE_f: [1, 16, 1, 1],
  hairA_m: [2, 16, 0.5, 0.5], hairB_m: [2.5, 16, 0.5, 0.5], hairC_m: [2, 16.5, 0.5, 0.5], hairD_m: [2.5, 16.5, 0.5, 0.5], hairE_m: [3, 16, 0.5, 0.5],
  fedora: [3.5, 16, 0.5, 0.5], shoes2: [3, 16.5, 0.5, 0.5], cloche: [3.5, 16.5, 0.5, 0.5],
  shoes: [0, 17, 0.5, 0.5], boots: [0.5, 17, 0.5, 0.5], brows_m: [1, 17, 0.25, 0.25], brows_f: [1.25, 17, 0.25, 0.25], lashes: [1, 17.25, 0.5, 0.25],
  heels: [1.5, 17, 0.25, 0.25],
};
const CT = 2 * TILE;   // V56: Kantenlänge der großen Kleidungskacheln

/* ---------------- Grunddaten ---------------- */
const base = M.readObj(path.join(MH, '3dobjs/base.obj'));
const skel = M.readSkeleton(MH);
const NV = base.v.length / 3;
const W = M.vertexWeights(skel, NV);
const sk = s => path.join(ND, 'skins', s);

// Eckenliste mit eigenen UV-Koordinaten: (Grundnetz-Ecke, UV-Index) -> neue Ecke
function unweld(faces, uvArr, keepFace) {
  const key = new Map(), vid = [], uvs = [], idx = [];
  for (const f of faces) {
    if (keepFace && !keepFace(f)) continue;
    const c = f.v.map((v, k) => {
      const t = f.t ? f.t[k] : v, K = v * 1e6 + t;
      let i = key.get(K); if (i === undefined) { i = vid.length; key.set(K, i); vid.push(v); uvs.push(uvArr[t * 2] ?? 0, uvArr[t * 2 + 1] ?? 0); }
      return i;
    });
    idx.push(c[0], c[1], c[2]); if (c.length === 4) idx.push(c[0], c[2], c[3]);
  }
  return { vid, uv: Float32Array.from(uvs), idx: Uint32Array.from(idx) };
}
// Normalen: glatt über gleiche Grundnetz-Ecken (keine Kanten an UV-Nähten)
function normals(pos, idx, weldKey) {
  const n = pos.length / 3, acc = new Float64Array(n * 3);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const u = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
    const v = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
    const nn = F.cross(u, v);
    for (const i of [a, b, c]) for (let d = 0; d < 3; d++) acc[i * 3 + d] += nn[d];
  }
  if (weldKey) {
    const g = new Map(); for (let i = 0; i < n; i++) { const k = weldKey[i]; const s = g.get(k); if (s) for (let d = 0; d < 3; d++) s[d] += acc[i * 3 + d]; else g.set(k, [acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]]); }
    for (let i = 0; i < n; i++) { const s = g.get(weldKey[i]); for (let d = 0; d < 3; d++) acc[i * 3 + d] = s[d]; }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const L = Math.hypot(acc[i * 3], acc[i * 3 + 1], acc[i * 3 + 2]) || 1; for (let d = 0; d < 3; d++) out[i * 3 + d] = acc[i * 3 + d] / L; }
  return out;
}
const mergeW = (refs, ws) => { const m = new Map(); refs.forEach((r, k) => { for (const [b, g] of W[r]) m.set(b, (m.get(b) || 0) + g * ws[k]); }); return [...m]; };

/* ---------------- Körper ---------------- */
const bodies = {};
for (const [gk, cfg] of Object.entries(BODIES)) {
  const v = M.macroBody(MH, base, cfg);
  const P = F.makePose(v, skel, cfg);
  const skinPt = (p, w) => F.skinPoint(p, null, w, P.pose)[0];
  // Haut
  const bodyF = base.faces.filter(f => f.g === 'body');
  const U = unweld(bodyF, base.vt);
  const n = U.vid.length, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const b = U.vid[i]; pos.set(skinPt([v[b * 3] * 0.1, v[b * 3 + 1] * 0.1, v[b * 3 + 2] * 0.1], W[b]), i * 3); }
  // Augen (Hilfsnetz im Grundnetz) mit den UV des Low-Poly-Auges
  const eyeF = base.faces.filter(f => f.g === 'helper-l-eye' || f.g === 'helper-r-eye');
  const lp = cfg.player ? null : readMhcloEyes();
  bodies[gk] = { cfg, v, P, U, pos, eyeF, lp, skinPt };
}
function readMhcloEyes() {
  // low-poly.mhclo: jede Proxy-Ecke sitzt genau auf einer Grundnetz-Ecke
  const dir = path.join(MH, 'eyes/low-poly'), txt = fs.readFileSync(path.join(dir, 'low-poly.mhclo'), 'utf8').split('\n');
  const i0 = txt.findIndex(l => l.startsWith('verts')); const ref = [];
  for (let i = i0 + 1; i < txt.length; i++) { const p = txt[i].trim().split(/\s+/); if (!p[0] || isNaN(+p[0])) break; ref.push(+p[0]); }
  const obj = M.readObj(path.join(dir, 'low-poly.obj'));
  return { ref, obj };
}

/* ---------------- Teile (Proxies) aufsetzen ---------------- */
const parts = {};
for (const [name, def] of Object.entries(PARTS)) {
  const B = bodies[def.body], px = M.readProxy(path.join(ND, 'proxies', def.src, path.basename(def.src) + '.json'));
  const fitted = M.fitProxy(px, B.v);
  const U = unweld(px.faces, px.uv);
  const n = U.vid.length, pos = new Float32Array(n * 3), w = [];
  for (let i = 0; i < n; i++) {
    const k = U.vid[i], ws = mergeW(px.ref[k], px.w[k]); w.push(ws);
    pos.set(B.skinPt([fitted[k * 3] * 0.1, fitted[k * 3 + 1] * 0.1, fitted[k * 3 + 2] * 0.1], ws), i * 3);
  }
  const tex = path.join(px.dir, px.mat.mapDiffuse || '');
  parts[name] = { def, px, U, pos, w, tex: fs.existsSync(tex) ? tex : null, del: px.meta.deleteVerts || null };
}

/* ---------------- Boden: Schuhsohlen auf 0 ---------------- */
// Herren: tiefster Punkt der Schuhe; Damen: Absatzschuhe werden aus dem Fuß gebaut (heelShoes)
const lift = {};
{
  let y = 1e9; const p = parts['shoes-m'].pos; for (let i = 1; i < p.length; i += 3) y = Math.min(y, p[i]); lift.m = -y;
  let yf = 1e9; const bp = bodies.f.pos; for (let i = 1; i < bp.length; i += 3) yf = Math.min(yf, bp[i]); lift.f = -yf + 0.012;
}
const shiftY = (pos, d) => { for (let i = 1; i < pos.length; i += 3) pos[i] += d; };
lift.p = lift.m;
for (const gk in bodies) shiftY(bodies[gk].pos, lift[gk]);
for (const k in parts) shiftY(parts[k].pos, lift[parts[k].def.body]);

/* ---------------- V32: Hemdbrust ohne Krawatte (Smoking, Frack, Kellner) ---------------- */
// Im Herrenanzug ist die Krawatte ein Wulst auf der Hemdbrust (eine UV-Insel mit Kragen und Hemd). Für Smoking und Kellner
// gibt es diese Insel als eigenes Netz 'shirt-m' mit flacher Hemdbrust; im Anzug wird sie dann ausgeblendet (Bit 64)
const TIE = {};
{
  const P = parts['suit-m'], n = P.U.vid.length, pos = P.pos;
  const isl = (() => { const idx = P.U.idx, par = Int32Array.from({ length: n }, (_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let t = 0; t < idx.length; t += 3) { const a = f(idx[t]), b = f(idx[t + 1]), c = f(idx[t + 2]); par[b] = a; par[f(c)] = a; } return Int32Array.from({ length: n }, (_, i) => f(i)); })();
  // Insel mit den meisten Ecken vorn in der Mitte über dem obersten Knopf
  let ys = []; for (let i = 0; i < n; i++) ys.push(pos[i * 3 + 1]); const yMax = Math.max(...ys);
  const cnt = new Map(); for (let i = 0; i < n; i++) if (Math.abs(pos[i * 3]) < 0.012 && pos[i * 3 + 2] > 0.06 && pos[i * 3 + 1] > yMax - 0.45) cnt.set(isl[i], (cnt.get(isl[i]) || 0) + 1);
  let best = -1, bc = 0; for (const [k, c] of cnt) if (c > bc) { bc = c; best = k; }
  const inT = new Uint8Array(n); for (let i = 0; i < n; i++) inT[i] = isl[i] === best ? 1 : 0;
  // Hemd glätten: im Band je Zentimeter die Höhe neben der Krawatte (|x| 2,8 bis 4,5 cm) als Fläche nehmen, leicht gewölbt
  const flat = Float32Array.from(pos), BW = 0.01, ref = new Map();
  for (let i = 0; i < n; i++) if (inT[i]) { const ax = Math.abs(pos[i * 3]); if (ax > 0.028 && ax < 0.045) { const b = Math.round(pos[i * 3 + 1] / BW); ref.set(b, Math.max(ref.get(b) ?? -1, pos[i * 3 + 2])); } }
  const refAt = y => { const b = Math.round(y / BW); for (let d = 0; d < 6; d++) { if (ref.has(b - d)) return ref.get(b - d); if (ref.has(b + d)) return ref.get(b + d); } return null; };
  for (let i = 0; i < n; i++) if (inT[i]) { const x = pos[i * 3], ax = Math.abs(x); if (ax > 0.03) continue; const zr = refAt(pos[i * 3 + 1]); if (zr === null) continue;
    const want = zr + 0.0045 * (1 - (x / 0.03) ** 2); if (flat[i * 3 + 2] > want) flat[i * 3 + 2] = want; }
  TIE.inT = inT; TIE.flat = flat;
  console.log('Hemdbrust: Insel', best, 'Ecken', inT.reduce((a, b) => a + b, 0));
}

/* ---------------- Gelenkpunkte fürs Spiel ---------------- */
const RIG = {};
for (const [gk, B] of Object.entries(bodies)) {
  const L = lift[gk], v = B.v;
  const R = B.P.R, up = p => [p[0], p[1] + L, p[2]];
  const sh = up(R.Sh), el = up(R.Et), wr = up(R.Wt), hip = up(R.H), knee = up(R.Kt), ank = up(R.At);
  const eyeR = up(M.jointPos(skel, v, skel.bones['eye.R'].head).map(x => x * 0.1));
  const neck = up(M.jointPos(skel, v, skel.bones['neck01'].head).map(x => x * 0.1));
  const skull = up(M.jointPos(skel, v, skel.bones['head'].head).map(x => x * 0.1));
  const spine3 = up(M.jointPos(skel, v, skel.bones['spine03'].head).map(x => x * 0.1));
  // Kopfmitte so, dass die Augen wie im Spiel 5 mm darunter liegen; z: Mitte zwischen Augen und Hinterkopf
  const headC = eyeR[1] + 0.005;
  RIG[gk] = { top: +sh[1].toFixed(4), shX: +(-sh[0]).toFixed(4), shZ: +sh[2].toFixed(4),
    el: [+(-el[0]).toFixed(4), +el[1].toFixed(4), +el[2].toFixed(4)], wr: [+(-wr[0]).toFixed(4), +wr[1].toFixed(4), +wr[2].toFixed(4)],
    hip: +hip[1].toFixed(4), hx: +(-hip[0]).toFixed(4), knee: +knee[1].toFixed(4), ank: +ank[1].toFixed(4), ankX: +(-ank[0]).toFixed(4),
    headC: +headC.toFixed(4), headZ: +(eyeR[2] - 0.085).toFixed(4), neck: +((neck[1] + skull[1]) / 2 - 0.02).toFixed(4), neckZ: +neck[2].toFixed(4), waist: +spine3[1].toFixed(4),
    eye: [+(-eyeR[0]).toFixed(4), +eyeR[1].toFixed(4), +eyeR[2].toFixed(4)],
    // Fingergelenke: Abstand unter dem Handgelenk (Grundgelenke, Mittelgelenke des Mittelfingers)
    kn: ['finger3-1.R', 'finger3-2.R'].map(b => { const pp = B.P.pose[b], j = M.jointPos(skel, v, skel.bones[b].head).map(x => x * 0.1); const q = F.add(pp.T, F.mv(pp.R, F.sub(j, pp.P))); return +(wr[1] - (q[1] + L)).toFixed(4); }),
    face: faceMarks(B, gk, eyeR),
    // V32: Fingergelenke der rechten Hand (Lage, Beugeachse) je Finger (Daumen bis kleiner Finger) und Gelenk (Grund-, Mittel-, Endgelenk)
    hand: B.P.fingers.R.map(f => f.map(j => [...up(j.J).map(x => +x.toFixed(4)), ...j.A.map(x => +x.toFixed(4))])) };
}
// V24: Gesichtsmerkmale (Meter, Ruhehaltung): Brauenbogen, Nasenspitze, Mundspalte, Mundwinkel, Kinn. Aus den Mundknochen
// (oris) und dem Profil der Mittellinie; damit legen die gemalten Gesichter (FACE_ATLAS) Lippen, Bart und Schminke genau auf
function faceMarks(B, gk, eyeR) {
  const L = lift[gk], v = B.v, J = (b, e = 'head') => M.jointPos(skel, v, skel.bones[b][e]).map(x => x * 0.1);
  const ey = eyeR[1], prof = [];
  for (const f of base.faces) if (f.g === 'body') for (const i of f.v) { const x = v[i * 3] * 0.1; if (Math.abs(x) < 0.0015) prof.push([v[i * 3 + 1] * 0.1 + L, v[i * 3 + 2] * 0.1]); }
  const maxZ = (y0, y1) => { let b = null; for (const p of prof) if (p[0] > y0 && p[0] < y1 && (!b || p[1] > b[1])) b = p; return b; };
  const brow = maxZ(ey, ey + 0.04), nose = maxZ(ey - 0.06, ey - 0.015);
  const up = J('oris05', 'tail'), lo = J('oris01', 'tail'), cor = J('oris03.L', 'tail'), chin = J('special04');
  const r4 = x => +x.toFixed(4);
  return { eyeX: r4(-eyeR[0]), eyeY: r4(ey), browY: r4(brow[0]), noseY: r4(nose[0]), noseZ: r4(nose[1]), mouthY: r4((up[1] + lo[1]) / 2 + L), mouthZ: r4(up[2]),
    mouthW: r4(cor[0] + 0.005), chinY: r4(chin[1] + L + 0.012), chinZ: r4(maxZ(chin[1] + L, (up[1] + lo[1]) / 2 + L - 0.02)[1]) };
}
function jointBone(j) { return j.split('____')[0]; }
console.log('RIG', JSON.stringify(RIG));

/* ---------------- Glied-Zuordnung, Bereiche ---------------- */
// Bereich je Ecke: 1 Kopf, 2 Hals, 3 Rumpf, 4 Oberarm, 5 Unterarm, 6 Hand, 7 Oberschenkel, 8 Unterschenkel, 9 Fuß
function regionOf(w, p, rig) {
  let best = null, bw = -1; for (const [b, g] of w) if (g > bw) { bw = g; best = b; }
  const l = F.limbOfBone(best);
  if (/^(wrist|metacarpal|finger)/.test(best)) return 6;
  if (/^(foot|toe)/.test(best)) return 9;
  if (l === 3 || l === 4) return 4; if (l === 7 || l === 8) return 5;
  if (l === 1 || l === 2) return 7; if (l === 5 || l === 6) return 8;
  if (p[1] > rig.neck + 0.035) return 1;
  if (p[1] > rig.top + 0.02 && Math.abs(p[0]) < 0.075) return 2;
  return 3;
}
// V32: je Ecke der Hand: Finger (1 Daumen … 5 kleiner Finger) und Anteil hinter Grund-, Mittel- und Endgelenk
function handAttr(w) {
  const by = [0, 0, 0, 0, 0, 0].map(() => [0, 0, 0]); let tw = 0;
  for (const [b, g] of w) { tw += g; const m = /^finger(\d)-(\d)\./.exec(b); if (m) by[+m[1]][+m[2] - 1] += g; }
  let f = 0, fw = 0; for (let k = 1; k <= 5; k++) { const s = by[k][0] + by[k][1] + by[k][2]; if (s > fw) { fw = s; f = k; } }
  if (!f || fw / tw < 0.02) return [0, 0, 0, 0];
  const q = by[f].map(x => x / tw);
  return [f, Math.min(1, q[0] + q[1] + q[2]), Math.min(1, q[1] + q[2]), Math.min(1, q[2])];
}
function limbAttrs(ws, pos, gk) {
  const rig = RIG[gk], n = ws.length, limb = new Float32Array(n * 2), blend = new Float32Array(n), reg = new Uint8Array(n), hand = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    hand.set(handAttr(ws[i]), i * 4);
    const lb = F.limbBlend(ws[i]), p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    limb[i * 2] = lb.limb;
    limb[i * 2 + 1] = lb.limb === 0 ? 0 : (lb.limb === 1 || lb.limb === 2 || lb.limb === 5 || lb.limb === 6) ? rig.hip : rig.top;
    blend[i] = lb.limb ? lb.w : 0;
    reg[i] = regionOf(ws[i], p, rig);
  }
  return { limb, blend, reg, hand };
}

/* ---------------- Atlas ---------------- */
const atlas = Buffer.alloc(AW * AH * 4, 0);
const rectPx = r => [Math.round(r[0] * TILE), Math.round(r[1] * TILE), Math.round(r[2] * TILE), Math.round(r[3] * TILE)];
async function readRGBA(file, w, h) { return (await sharp(file).ensureAlpha().resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer()); }
function blit(buf, r) { const [x0, y0, w, h] = rectPx(r); for (let y = 0; y < h; y++) buf.copy(atlas, ((y0 + y) * AW + x0) * 4, y * w * 4, (y + 1) * w * 4); }
// UV eines Teils in seinen Atlasbereich legen (V nach unten wie im Bild: v_atlas = 1 - y/AH)
function toAtlasUV(uv, r) {
  const out = new Float32Array(uv.length);
  for (let i = 0; i < uv.length; i += 2) {
    const u = Math.min(1, Math.max(0, uv[i])), v = Math.min(1, Math.max(0, uv[i + 1]));
    out[i] = (r[0] + u * r[2]) * TILE / AW; out[i + 1] = 1 - (r[1] + (1 - v) * r[3]) * TILE / AH;
  }
  return out;
}
// Rasterung eines Teils in seinem Texturraum: je Texel die Lage am Körper (Ruhehaltung), für gemalte Varianten
function uvRaster(P, size, triOk) {
  const R = new Float32Array(size * size * 4).fill(NaN);
  const { pos, U } = P, uv = U.uv, I = U.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
    if (triOk && !triOk(a, b, c)) continue;
    const X = [uv[a * 2] * size, uv[b * 2] * size, uv[c * 2] * size], Y = [(1 - uv[a * 2 + 1]) * size, (1 - uv[b * 2 + 1]) * size, (1 - uv[c * 2 + 1]) * size];
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]); if (Math.abs(den) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...Y))); py <= Math.min(size - 1, Math.ceil(Math.max(...Y))); py++)
      for (let px = Math.max(0, Math.floor(Math.min(...X))); px <= Math.min(size - 1, Math.ceil(Math.max(...X))); px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const w0 = ((Y[1] - Y[2]) * (qx - X[2]) + (X[2] - X[1]) * (qy - Y[2])) / den, w1 = ((Y[2] - Y[0]) * (qx - X[2]) + (X[0] - X[2]) * (qy - Y[2])) / den, w2 = 1 - w0 - w1;
        if (w0 < -0.02 || w1 < -0.02 || w2 < -0.02) continue;
        const k = (py * size + px) * 4;
        for (let d = 0; d < 3; d++) R[k + d] = pos[a * 3 + d] * w0 + pos[b * 3 + d] * w1 + pos[c * 3 + d] * w2;
        R[k + 3] = 1;
      }
  }
  return R;
}
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
// Stoffbild in Detail (grau) + Farbmaske (Alpha: 1 = Farbe der Figur) umwandeln
function paintMask(buf, isPaint) {
  // mittlere Helligkeit der zu färbenden Stellen auf 0,7 bringen
  let s = 0, c = 0; for (let i = 0; i < buf.length; i += 4) if (isPaint(buf, i)) { s += lum(buf[i], buf[i + 1], buf[i + 2]); c++; }
  const k = c ? 0.7 * 255 / (s / c) : 1;
  for (let i = 0; i < buf.length; i += 4) {
    // Alpha: 255 = Farbe des Bildes, 96 = Farbe der Figur mal Helligkeit (nie 0, sonst verwirft WebP die Farbe)
    if (isPaint(buf, i)) { const g = Math.min(255, lum(buf[i], buf[i + 1], buf[i + 2]) * k); buf[i] = buf[i + 1] = buf[i + 2] = g; buf[i + 3] = 96; }
    else buf[i + 3] = 255;
  }
  return buf;
}
const sat = (b, i) => { const mx = Math.max(b[i], b[i + 1], b[i + 2]), mn = Math.min(b[i], b[i + 1], b[i + 2]); return mx ? (mx - mn) / mx : 0; };

/* ---------------- V44 · gemalte Hautdetails ---------------- */
// Die MakeHuman-Hautbilder haben 512 px; der Kopf belegt darin 180 x 342, eine Hand 99 x 95 Texel. Köpfe und Hände bekommen
// eigene Kacheln (512 bzw. 256 px), das Quellbild wird hochgerechnet und nachgeschärft, und darauf kommen Details, die das
// Quellbild nicht hat: Poren und Hautflecken (im Raum gerechnet, also ohne Nähte), Lippenlinien, Krähenfüße mit dem Alter,
// Knöchelfalten und Beugefalten der Finger (an den Gelenken des Skeletts). Die Höhe der Details steht im Alphakanal
// (128 = eben), der Shader macht daraus das Relief; vorher rechnete er Poren als Rauschen je Bildpunkt
const hash3 = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };
function vN3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let fx = x - ix, fy = y - iy, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx), l(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx), fy),
    l(l(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx), l(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx), fy), fz);
}
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Quellausschnitt eines Inselkastens hochrechnen und nachschärfen (Alpha wird in skinDetail gesetzt)
// V56: der Kasten ist in Pixeln des 512er-Bilds angegeben; aus einem 2048er-Quellbild wird der viermal so große Ausschnitt genommen
async function upscaleBox(file, box, w, h, sigma) {
  const meta = await sharp(file).metadata(), S = meta.width / TILE;
  const skin = await readRGBA(file, meta.width, meta.height);
  return sharp(skin, { raw: { width: meta.width, height: meta.height, channels: 4 } }).extract({ left: Math.round(box[0] * S), top: Math.round(box[1] * S), width: Math.round(box[2] * S), height: Math.round(box[3] * S) })
    .resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).sharpen({ sigma: S > 1 ? sigma * 0.7 : sigma, m1: 0.5, m2: 1.3 }).raw().toBuffer();
}
// buf: Kachel (RGBA, size x size); R: Rasterung (rasterRect) mit Lage und Normale je Texel; o: { face, age (0 jung … 1 alt),
// dark, hand (Gelenke der rechten Hand), mirror (linke Hand: Lage und Normale an x spiegeln) }
function skinDetail(buf, size, R, o) {   // size: Kantenlänge oder [Breite, Höhe]
  const npx = Array.isArray(size) ? size[0] * size[1] : size * size;
  const face = o.face, dark = o.dark ? 0.7 : 1, age = o.age || 0, smooth = o.smooth || 1;   // V48: smooth < 1 dämpft Poren und Flecken
  // Fingergelenke: Lage, Richtung zum nächsten Gelenk, Handflächenseite (dahin krümmt sich der Finger: Achse x Richtung)
  const joints = [];
  if (o.hand) for (const fg of o.hand) for (let j = 0; j < 3; j++) {
    const J = fg[j].slice(0, 3), A = fg[j].slice(3), N = fg[Math.min(j + 1, 2)], P2 = fg[Math.min(j, 1)], D = F.nrm(F.sub(N.slice(0, 3), P2.slice(0, 3)));
    joints.push({ J, D, P: F.nrm(F.cross(A, D)), first: j === 0 });
  }
  for (let t = 0; t < npx; t++) {
    const k = t * 4;
    if (!(R[t * 7 + 6] > 0)) { buf[k + 3] = 128; continue; }
    let x = R[t * 7], y = R[t * 7 + 1], z = R[t * 7 + 2], nx = R[t * 7 + 3], ny = R[t * 7 + 4], nz = R[t * 7 + 5];
    if (o.mirror) { x = -x; nx = -nx; }
    let r = buf[k], g = buf[k + 1], b = buf[k + 2], h = 0;
    // Poren (zwei Körnungen) und Hautflecken (leicht rötlich)
    // Poren: etwa 1,5 mm (ein bis zwei Texel); feiner wäre im Bild nur Körnung. Farbe nur schwach, Relief aus der gleichen Körnung
    const pore = (vN3(x * 650, y * 650, z * 650) - 0.5) * 0.7 + (vN3(x * 1300 + 7, y * 1300, z * 1300) - 0.5) * 0.3;
    const mott = vN3(x * 220 + 3, y * 220, z * 220) - 0.5;
    let rw = 0.6, mw = 0.5, lip = 0, cf = 0;
    if (face) {
      const ax = Math.abs(x);
      const nose = sst(0.026, 0.014, ax) * sst(face.noseY - 0.02, face.noseY - 0.008, y) * sst(face.noseY + 0.045, face.noseY + 0.03, y) * sst(face.noseZ - 0.045, face.noseZ - 0.025, z);
      const cheek = sst(0.016, 0.026, ax) * sst(0.075, 0.06, ax) * sst(face.mouthY - 0.012, face.mouthY, y) * sst(face.eyeY, face.eyeY - 0.012, y) * sst(face.mouthZ - 0.09, face.mouthZ - 0.06, z);
      const lid = sst(0.028, 0.018, Math.abs(ax - face.eyeX)) * sst(0.016, 0.009, Math.abs(y - face.eyeY)) * sst(face.noseZ - 0.08, face.noseZ - 0.05, z);
      const fore = sst(face.browY + 0.002, face.browY + 0.014, y) * sst(face.noseZ - 0.12, face.noseZ - 0.08, z) * sst(face.browY + 0.1, face.browY + 0.075, y);
      rw = (0.6 + 0.5 * nose + 0.4 * cheek + 0.25 * fore) * (1 - 0.7 * lid);
      mw = 0.4 + 0.6 * Math.max(nose, cheek);
      // Lippen: dichter, Längsfältchen quer zur Mundspalte, etwas gesättigter
      lip = sst(0.013, 0.007, Math.abs(y - face.mouthY)) * sst(face.mouthW + 0.005, face.mouthW - 0.001, ax) * sst(face.mouthZ - 0.03, face.mouthZ - 0.015, z);
      if (lip > 0.002) {
        const f = 0.5 + 0.5 * Math.cos(x * 6.2832 / 0.0016 + (vN3(x * 500, y * 500, z * 500) - 0.5) * 4);
        const a = lip * (0.75 + 0.6 * age);
        r *= 1 + 0.05 * lip - 0.1 * f * a; g *= 1 - 0.03 * lip - 0.12 * f * a; b *= 1 - 0.05 * lip - 0.12 * f * a; h += (f - 0.5) * 0.9 * lip;
      }
      // Krähenfüße: mit dem Alter feine Linien vom äußeren Augenwinkel nach außen
      cf = age * sst(face.eyeX + 0.016, face.eyeX + 0.024, ax) * sst(face.eyeX + 0.046, face.eyeX + 0.034, ax) * sst(0.014, 0.006, Math.abs(y - face.eyeY + 0.003)) * sst(face.noseZ - 0.12, face.noseZ - 0.09, z);
      if (cf > 0.002) { const f = Math.pow(0.5 + 0.5 * Math.cos((y - face.eyeY) * 6.2832 / 0.0048 + (ax - face.eyeX) * 90 + (vN3(x * 250, y * 250, z * 250) - 0.5) * 7), 3.0); r *= 1 - 0.1 * f * cf; g *= 1 - 0.12 * f * cf; b *= 1 - 0.12 * f * cf; h -= f * 1.0 * cf; }
    }
    const pa = (1 - 0.7 * lip) * rw * (1 + 0.35 * age);
    const pc = 1 + pore * (HI ? 0.04 : 0.06) * pa * dark * smooth; r *= pc; g *= pc; b *= pc; h += pore * 0.5 * pa * smooth;
    const mk = HI ? 0.7 : 1; r *= 1 + mott * 0.09 * mk * mw * dark * smooth; g *= 1 - mott * 0.03 * mk * mw * smooth; b *= 1 - mott * 0.05 * mk * mw * smooth;
    // Hände: Knöchelfalten auf dem Rücken, Beugefalten in der Fläche, Knöchel leicht gerötet
    for (const q of joints) {
      const dx = x - q.J[0], dy = y - q.J[1], dz = z - q.J[2], t1 = dx * q.D[0] + dy * q.D[1] + dz * q.D[2];
      const rx = dx - t1 * q.D[0], ry = dy - t1 * q.D[1], rz = dz - t1 * q.D[2], rad = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rad > (q.first ? 0.02 : 0.014) || Math.abs(t1) > 0.008) continue;
      const band = Math.exp(-(t1 * t1) / (0.0022 * 0.0022)), side = nx * q.P[0] + ny * q.P[1] + nz * q.P[2];
      const bw = sst(-0.15, -0.6, side), pw = sst(0.15, 0.6, side);
      if (bw > 0.002) { const w = 0.5 + 0.5 * Math.cos(t1 * 6.2832 / 0.0011 + (vN3(x * 900, y * 900, z * 900) - 0.5) * 3); const a = band * bw; r *= 1 - 0.06 * w * a + 0.03 * a; g *= 1 - 0.08 * w * a; b *= 1 - 0.08 * w * a; h += (w - 0.5) * 0.9 * a; }
      if (pw > 0.002) { const c = Math.exp(-(t1 * t1) / (0.0012 * 0.0012)) * pw; r *= 1 - 0.09 * c; g *= 1 - 0.11 * c; b *= 1 - 0.11 * c; h -= 0.7 * c; }
    }
    buf[k] = Math.max(0, Math.min(255, Math.round(r))); buf[k + 1] = Math.max(0, Math.min(255, Math.round(g))); buf[k + 2] = Math.max(0, Math.min(255, Math.round(b)));
    buf[k + 3] = Math.max(1, Math.min(255, Math.round(128 + h * 110)));
  }
  return buf;
}
// Körperhaut: nur ein leichtes Relief (Alpha), die Farbe bleibt das Quellbild
function bodyRelief(buf, w, h, seed) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; buf[i + 3] = Math.round(128 + (vN3(x / 5, y / 5, seed) - 0.5) * 40); }
  return buf;
}
// Köpfe und Hände der Stadtleute: je Geschlecht und Hautbild eine Kopfkachel und zwei halbe Handkacheln
async function detailTiles() {
  const rastAt = (gk, code, size, sizeY) => rasterRect({ ...SKINRAST[gk], inHead: Uint8Array.from(SKINRAST[gk].where, w => w === code ? 1 : 0) }, size, sizeY);
  for (const gk of ['m', 'f']) {
    const fr = RECT['face_' + gk], hr = RECT['hands_' + gk], FW = fr[2] * TILE, FH = fr[3] * TILE;
    const rh = rastAt(gk, 1, FW, FH), rR = rastAt(gk, 2, TILE / 2), rL = rastAt(gk, 3, TILE / 2);
    for (let k = 0; k < 4; k++) {
      const file = skinFile(gk, k), age = k === 1 ? 0.45 : k === 2 ? 1 : 0, dark = k === 3;
      blit(skinDetail(await upscaleBox(file, HEADBOX.head, FW, FH, 0.8), [FW, FH], rh, { face: RIG[gk].face, age, dark }), [fr[0] + k, fr[1], fr[2], fr[3]]);
      blit(skinDetail(await upscaleBox(file, HEADBOX.handR, TILE / 2, TILE / 2, 1.2), TILE / 2, rR, { hand: RIG[gk].hand, age, dark }), [hr[0] + k, hr[1], 0.5, 0.5]);
      blit(skinDetail(await upscaleBox(file, HEADBOX.handL, TILE / 2, TILE / 2, 1.2), TILE / 2, rL, { hand: RIG[gk].hand, mirror: true, age, dark }), [hr[0] + k + 0.5, hr[1], 0.5, 0.5]);
    }
  }
}

// V24 · Spielerkacheln: Körperhaut (junger hellhäutiger Herr) und Kopf in dreifacher Auflösung. Ins Gesicht kommt aus dem
// Referenzbild nur die Zeichnung (Brauen, Lidfalten, Nase, Lippen, Lachfalten): Bild geteilt durch seine weichgezeichnete
// Fassung, also ohne Licht und Schatten der Aufnahme, auf die Haut gelegt. Die Lage im Bild kommt über die Merkmale (PLAYER_REF)
async function playerTiles() {
  const skinFile = sk(SKIN.m[0]);
  const bodyTile = bodyRelief(await readRGBA(skinFile, TILE, TILE), TILE, TILE, 9);
  // V44: nachgeschärft, unten Poren und Lippen wie bei allen. V47: die Kopfinsel ist um das Gesicht gedehnt (siehe Netze): die Kachel
  // wird je Texel über die ursprüngliche UV (dreiecksweise wie auf der Grafikkarte) aus einem doppelt so großen Ausschnitt abgetastet
  const SB = TILE * 2, big = await upscaleBox(skinFile, HEADBOX.head, SB, SB, 0.8), S0 = rasterSrc(HEADP, TILE);
  const head = Buffer.alloc(TILE * TILE * 4);
  for (let t = 0; t < TILE * TILE; t++) {
    const u = S0[t * 3 + 2] > 0 ? S0[t * 3] : ((t % TILE) + 0.5) / TILE, v = S0[t * 3 + 2] > 0 ? S0[t * 3 + 1] : 1 - (Math.floor(t / TILE) + 0.5) / TILE;
    const x = Math.min(SB - 1.001, Math.max(0, u * SB - 0.5)), y = Math.min(SB - 1.001, Math.max(0, (1 - v) * SB - 0.5)), x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    for (let d = 0; d < 3; d++) { const a = big[(y0 * SB + x0) * 4 + d], b = big[(y0 * SB + x0 + 1) * 4 + d], c = big[((y0 + 1) * SB + x0) * 4 + d], e = big[((y0 + 1) * SB + x0 + 1) * 4 + d];
      head[t * 4 + d] = Math.round((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy); }
    head[t * 4 + 3] = 255;
  }
  if (fs.existsSync(PLAYER_REF.file)) {
    const meta = await sharp(PLAYER_REF.file).metadata(), RW = meta.width, RH = meta.height;
    const ref = await sharp(PLAYER_REF.file).removeAlpha().raw().toBuffer(), blur = await sharp(PLAYER_REF.file).removeAlpha().blur(5).raw().toBuffer();
    // Merkmale am Spielerkopf (Meter) -> Bildpunkte: affine Abbildung nach kleinsten Quadraten
    const fm = RIG.p.face, src = [[-fm.eyeX, fm.eyeY], [fm.eyeX, fm.eyeY], [-fm.mouthW, fm.mouthY], [fm.mouthW, fm.mouthY], [0, fm.chinY - 0.012]];
    const dst = [PLAYER_REF.eyeR, PLAYER_REF.eyeL, PLAYER_REF.mouthR, PLAYER_REF.mouthL, PLAYER_REF.chin];
    const A = affineFit(src, dst);
    const R = rasterRect(HEADP, TILE);
    const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const samp = (buf, x, y) => { x = Math.min(RW - 1.001, Math.max(0, x)); y = Math.min(RH - 1.001, Math.max(0, y)); const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = [0, 0, 0];
      for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) { const k = ((y0 + dy) * RW + x0 + dx) * 3; for (let d = 0; d < 3; d++) o[d] += buf[k + d] * w; } return o; };
    for (let t = 0; t < TILE * TILE; t++) {
      if (!(R[t * 7 + 6] > 0)) continue;
      const x = R[t * 7], y = R[t * 7 + 1], nz = R[t * 7 + 5];
      // nur die Vorderseite des Gesichts, weich auslaufend; Stirn nur bis unter den Haaransatz des Bildes
      const w = sst(0.3, 0.6, nz) * sst(0.056, 0.04, Math.abs(x)) * sst(fm.chinY - 0.026, fm.chinY - 0.01, y) * sst(fm.eyeY + 0.04, fm.eyeY + 0.026, y);
      if (w < 0.003) continue;
      const px = A[0] * x + A[1] * y + A[2], py = A[3] * x + A[4] * y + A[5];
      const c = samp(ref, px, py), b = samp(blur, px, py), k = t * 4;
      // Zeichnung als Verhältnis zur Umgebung; aufhellen nur wenig (Glanzlichter und Ränder vor dunklem Haar wären sonst helle Striche)
      for (let d = 0; d < 3; d++) { const det = Math.min(1.22, Math.max(0.4, (c[d] + 4) / (b[d] + 4))); head[k + d] = Math.min(255, head[k + d] * (1 + (Math.pow(det, 1.15) - 1) * w * 0.95)); }
    }
  } else console.warn('Referenzbild fehlt:', PLAYER_REF.file);
  // V48: wärmer und gleichmäßiger wie auf den Referenzbildern (leicht gebräunt statt rosig, weniger Flecken und Poren)
  warmSkin(head); warmSkin(bodyTile);
  const HR = rasterRect(HEADP, TILE);
  blit(paintScalp(skinDetail(head, TILE, HR, { face: RIG.p.face, age: 0, smooth: 0.5 }), HR, RIG.p), RECT.face_p);
  blit(bodyTile, RECT.skin_p);
}
// V49: Haaransatz vorn in der Mitte (Höhe in m), gemeinsam für die heruntergezogene Frisur und die gemalte Kopfhaut
const HAIRLINE = 1.731;
// V48: unter Alexanders Frisur ist die Kopfhaut honigblond gemalt (zurückgekämmte Strähnen): so liegt der Haaransatz vorn knapp 5 cm
// über den Brauen wie auf den Referenzbildern statt einer hohen, kahlen Stirn, und an Schläfen und Hinterkopf scheint keine Haut durch
function paintScalp(buf, R, rig) {
  const f = rig.face, col = [168, 142, 72];
  for (let t = 0; t < TILE * TILE; t++) {
    if (!(R[t * 7 + 6] > 0)) continue;
    const x = R[t * 7], y = R[t * 7 + 1], z = R[t * 7 + 2], ax = Math.abs(x), k = t * 4;
    // Haaransatz: vorn über der Stirn, zu den Schläfen hin etwas tiefer (leichte Geheimratsecken), hinter den Ohren bis in den Nacken
    const front = sst(f.noseZ - 0.11, f.noseZ - 0.06, z), side = sst(0.045, 0.07, ax);
    let hl = HAIRLINE + 0.004 + 0.01 * sst(0.02, 0.055, ax) * front;
    hl = hl * front + (1 - front) * (rig.headC + 0.005 - 0.075 * sst(rig.headZ - 0.03, rig.headZ - 0.08, z));
    hl = Math.min(hl, f.browY + 0.054 + 0.03 * side);
    // V49: weicher Ansatz über knapp 1 cm (feine Härchen, leicht ausgefranst), ohne Körnung und Relief: vorher wirkte der Streifen wie Stoppeln
    // V50: ganz glatt: keine Helligkeitsflecken, kein ausgefranster Rand, und in einem Saum von 1 cm unter dem Ansatz auch kein
    // Poren-Relief (Alpha 128): das Relief der Haut war am Übergang noch als leichte Körnung zu sehen
    const m = sst(hl - 0.006, hl + 0.004, y), flat = sst(hl - 0.016, hl - 0.006, y);
    if (flat < 0.002) continue;
    for (let d = 0; d < 3; d++) buf[k + d] = Math.round(buf[k + d] * (1 - m) + col[d] * m);
    buf[k + 3] = Math.round(buf[k + 3] * (1 - flat) + 128 * flat);
  }
  return buf;
}
// V48: Hautton des Spielers: etwas wärmer und weniger rosa, Unterschiede zur mittleren Farbe gedämpft (ebenmäßiger Teint)
function warmSkin(buf) {
  let n = 0; const m = [0, 0, 0];
  for (let i = 0; i < buf.length; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] > 60) { for (let d = 0; d < 3; d++) m[d] += buf[i + d]; n++; }
  for (let d = 0; d < 3; d++) m[d] /= Math.max(1, n);
  const tint = [1.0, 0.975, 0.93];
  for (let i = 0; i < buf.length; i += 4) for (let d = 0; d < 3; d++) buf[i + d] = Math.max(0, Math.min(255, Math.round((m[d] + (buf[i + d] - m[d]) * 0.8) * tint[d])));
}
// Rasterung des Kopfes in seiner Kachel: je Texel Lage (x, y, z) und Normale (x, y, z), Deckung
function rasterRect(H, size, sizeY = size) {   // V56: auch rechteckig (Breite, Höhe)
  const R = new Float32Array(size * sizeY * 7), I = H.idx, uv = H.uv, P = H.pos, N = H.nrm;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2]; if (!H.inHead[a] || !H.inHead[b] || !H.inHead[c]) continue;
    const X = [uv[a * 2] * size, uv[b * 2] * size, uv[c * 2] * size], Y = [(1 - uv[a * 2 + 1]) * sizeY, (1 - uv[b * 2 + 1]) * sizeY, (1 - uv[c * 2 + 1]) * sizeY];
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]); if (Math.abs(den) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...Y))); py <= Math.min(sizeY - 1, Math.ceil(Math.max(...Y))); py++)
      for (let px = Math.max(0, Math.floor(Math.min(...X))); px <= Math.min(size - 1, Math.ceil(Math.max(...X))); px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const w0 = ((Y[1] - Y[2]) * (qx - X[2]) + (X[2] - X[1]) * (qy - Y[2])) / den, w1 = ((Y[2] - Y[0]) * (qx - X[2]) + (X[0] - X[2]) * (qy - Y[2])) / den, w2 = 1 - w0 - w1;
        if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
        const k = (py * size + px) * 7;
        for (let d = 0; d < 3; d++) { R[k + d] = P[a * 3 + d] * w0 + P[b * 3 + d] * w1 + P[c * 3 + d] * w2; R[k + 3 + d] = N[a * 3 + d] * w0 + N[b * 3 + d] * w1 + N[c * 3 + d] * w2; }
        R[k + 6] = 1;
      }
  }
  return R;
}
// V47: je Texel der Kopfkachel die ursprüngliche UV (H.src0, vor dem Dehnen) und Deckung; ohne src0 die UV selbst
function rasterSrc(H, size) {
  const R = new Float32Array(size * size * 3), I = H.idx, uv = H.uv, S = H.src0 || H.uv;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2]; if (!H.inHead[a] || !H.inHead[b] || !H.inHead[c]) continue;
    const X = [uv[a * 2] * size, uv[b * 2] * size, uv[c * 2] * size], Y = [(1 - uv[a * 2 + 1]) * size, (1 - uv[b * 2 + 1]) * size, (1 - uv[c * 2 + 1]) * size];
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]); if (Math.abs(den) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...Y))); py <= Math.min(size - 1, Math.ceil(Math.max(...Y))); py++)
      for (let px = Math.max(0, Math.floor(Math.min(...X))); px <= Math.min(size - 1, Math.ceil(Math.max(...X))); px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const w0 = ((Y[1] - Y[2]) * (qx - X[2]) + (X[2] - X[1]) * (qy - Y[2])) / den, w1 = ((Y[2] - Y[0]) * (qx - X[2]) + (X[0] - X[2]) * (qy - Y[2])) / den, w2 = 1 - w0 - w1;
        if (w0 < -0.03 || w1 < -0.03 || w2 < -0.03) continue;
        const k = (py * size + px) * 3;
        if (R[k + 2] > 0 && Math.min(w0, w1, w2) < 0) continue;   // Texel, die ein Dreieck wirklich enthält, gewinnen gegen den Saum
        R[k] = S[a * 2] * w0 + S[b * 2] * w1 + S[c * 2] * w2; R[k + 1] = S[a * 2 + 1] * w0 + S[b * 2 + 1] * w1 + S[c * 2 + 1] * w2; R[k + 2] = 1;
      }
  }
  return R;
}
// Affine Abbildung (x, y) -> (u, v) aus Punktpaaren, kleinste Quadrate: [a, b, c, d, e, f] mit u = a x + b y + c, v = d x + e y + f
function affineFit(src, dst) {
  const M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], bu = [0, 0, 0], bv = [0, 0, 0];
  src.forEach(([x, y], i) => { const r = [x, y, 1]; for (let p = 0; p < 3; p++) { for (let q = 0; q < 3; q++) M3[p][q] += r[p] * r[q]; bu[p] += r[p] * dst[i][0]; bv[p] += r[p] * dst[i][1]; } });
  const solve = b => { const m = M3.map((r, i) => [...r, b[i]]); for (let i = 0; i < 3; i++) { let piv = i; for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[piv][i])) piv = k; [m[i], m[piv]] = [m[piv], m[i]];
    for (let k = 0; k < 3; k++) if (k !== i) { const f = m[k][i] / m[i][i]; for (let q = i; q < 4; q++) m[k][q] -= f * m[i][q]; } } return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]]; };
  return [...solve(bu), ...solve(bv)];
}
async function buildAtlas() {
  // Haut
  for (const [gk, list] of Object.entries(SKIN)) for (let k = 0; k < 4; k++) {
    const r = RECT['skin_' + gk]; const buf = await readRGBA(skinFile(gk, k), TILE, TILE);
    blit(bodyRelief(buf, TILE, TILE, k + (gk === 'f' ? 4 : 0)), [r[0] + k, r[1], 1, 1]);   // V44: leichtes Relief im Alphakanal
  }
  // Anzug und Varianten: dunkler Stoff = Farbe der Figur; Hemd, Krawatte, Knöpfe bleiben
  // V56: 1024 px aus dem 2048er-Quellbild (Uniform und Kellner werden auf 512 verkleinert); im Anzug steckt jetzt eine Weste
  const suit = parts['suit-m'];
  const suitBuf = await readRGBA(partTex('suit-m'), CT, CT);
  const suitRaster = uvRaster(suit, CT);
  const isCloth = (b, i) => lum(b[i], b[i + 1], b[i + 2]) < 105 && sat(b, i) < 0.35;
  const at = (i) => { const k = i; return [suitRaster[k], suitRaster[k + 1], suitRaster[k + 2], suitRaster[k + 3]]; };
  const mk = (fn) => { const b = Buffer.from(suitBuf); fn && fn(b); return b; };
  const rigM = RIG.m;
  // Krawatte: schmaler Streifen vorn in der Mitte zwischen Kragen und Bauch
  const isTie = (p) => p[3] === 1 && Math.abs(p[0]) < 0.035 && p[1] > rigM.top - 0.33 && p[1] < rigM.neck - 0.02 && p[2] > 0.05;
  const shirtCol = [236, 233, 226];
  // V32: Smoking: Hemdbrust (eigene Insel, ohne Krawatte) weiß mit feinen Biesen und drei Onyxknöpfen
  const shirtR = uvRaster(suit, CT, (a, b, c) => TIE.inT[a] && TIE.inT[b] && TIE.inT[c]);
  const shAt = i => [shirtR[i], shirtR[i + 1], shirtR[i + 2], shirtR[i + 3]];
  const sm = meshes['suit-m'], sp = sm.pos, nS = sp.length / 3, BW = 0.01, band = y => Math.round(y / BW);
  const edge = new Map();
  for (let i = 0; i < nS; i++) {
    const x = Math.abs(sp[i * 3]), y = sp[i * 3 + 1], z = sp[i * 3 + 2];
    if (!TIE.inT[i] && sm.limb[i * 2] === 0 && z > 0.05 && y > rigM.hip) edge.set(band(y), Math.min(edge.get(band(y)) ?? 1, x));
  }
  let yBtn = rigM.hip; for (let y = rigM.hip; y < rigM.top; y += BW) { const e = edge.get(band(y)); if (e !== undefined && e < 0.012) yBtn = y; }
  let yColl = 0; for (let i = 0; i < nS; i++) if (TIE.inT[i] && Math.abs(sp[i * 3]) < 0.01) yColl = Math.max(yColl, sp[i * 3 + 1]);
  const stud = (x, y) => [0.075, 0.13, 0.185].some(o => yColl - o > yBtn + 0.01 && Math.hypot(x, y - (yColl - o)) < 0.0042);
  console.log('Smoking: oberster Knopf', yBtn.toFixed(3), 'Kragen', yColl.toFixed(3), 'Hüfte', rigM.hip.toFixed(3), 'Taille', rigM.waist.toFixed(3), 'Schulter', rigM.top.toFixed(3));
  // V56: Dreiteiler. Auf der Hemdinsel liegt unter dem Krawattenknoten eine Weste: V-Ausschnitt, feiner Fischgrat, vier Hornknöpfe;
  // die Krawatte (gesättigte Texel des Quellbilds) bleibt darüber. Grau und dunkel gemalt, damit sie die Farbe der Figur bekommt
  const isTieTex = (b, i, p) => isTie(p) && sat(b, i) > 0.25;
  const vestEdge = x => yColl - 0.075 + Math.abs(x) * 1.2;
  const vestBtn = (x, y) => Math.abs(x) < 0.0038 && [0.11, 0.155, 0.2, 0.245].some(o => Math.abs(y - (yColl - o)) < 0.0038);
  const paintVest = (b, i, sh, p) => {
    if (sh[3] !== 1 || isTieTex(b, i, p) || sh[1] > vestEdge(sh[0])) return false;
    if (vestBtn(sh[0], sh[1])) { b[i] = 118; b[i + 1] = 82; b[i + 2] = 46; return true; }
    const hb = 0.5 + 0.5 * Math.sin((sh[0] * (Math.floor(sh[1] / 0.008) % 2 ? 1 : -1) + sh[1]) * 6.2832 / 0.0032);
    const g = 72 + 16 * (vN3(sh[0] * 900, sh[1] * 900, sh[2] * 900) - 0.5) + 9 * (hb - 0.5);
    b[i] = b[i + 1] = b[i + 2] = Math.max(40, Math.min(100, g)); return true;
  };
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) paintVest(b, i, shAt(i), at(i)); }), isCloth), RECT.suit);
  // V56: Zweireiher: Kreidestreifen (senkrecht am Rumpf, längs am Ärmel) und sechs Hornknöpfe in zwei Reihen, dazu die Weste
  const armP = (() => { const d = [rigM.wr[0] - rigM.shX, rigM.wr[1] - rigM.top], l = Math.hypot(d[0], d[1]); return [-d[1] / l, d[0] / l]; })();
  const dblBtn = p => { if (p[2] < 0.05 || Math.abs(p[0]) > 0.2) return 0; for (const y of [0, 0.085, 0.17]) for (const sx of [-0.045, 0.045]) if (Math.hypot(p[0] - sx, p[1] - (rigM.waist - 0.03 + y)) < 0.0095) return 1; return 0; };
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (p[3] !== 1) continue;
    if (paintVest(b, i, shAt(i), p)) continue;
    if (dblBtn(p)) { b[i] = 52; b[i + 1] = 38; b[i + 2] = 28; continue; }
    if (isCloth(b, i)) {
      // Streifen laufen rund um Rumpf, Arm oder Bein (Winkel um die jeweilige Achse mal Umfang), so bleiben sie überall gleich breit
      const arm = Math.abs(p[0]) > 0.2 && p[1] > rigM.hip, leg = !arm && p[1] < rigM.hip - 0.04;
      const cx = arm ? Math.sign(p[0]) * (rigM.shX + (rigM.wr[0] - rigM.shX) * Math.min(1, Math.max(0, (rigM.top - p[1]) / (rigM.top - rigM.wr[1])))) : leg ? Math.sign(p[0]) * rigM.hx : 0;
      const cz = arm ? rigM.shZ : 0, nst = arm ? 24 : leg ? 42 : 76, ang = Math.atan2(p[0] - cx, p[2] - cz) / 6.2832 * nst, f = ang - Math.floor(ang);
      const st = Math.exp(-Math.pow((f - 0.5) / 0.05, 2)), g = Math.min(104, lum(b[i], b[i + 1], b[i + 2]) * (1 + 0.8 * st));
      b[i] = b[i + 1] = b[i + 2] = g;
    } } }), isCloth), RECT.dbl);
  // Frack: Krawatte weg (weißes Hemd, die Fliege kommt als Teil dazu), Revers in Satin dunkler
  // V24: der ganze Krawattenstreifen wird Hemd (vorher blieben die dunklen Streifen der Krawatte stehen)
  const isTieBand = (b, i, p) => isTie(p) && (!isCloth(b, i) || Math.abs(p[0]) < 0.022);
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) {
    const sh = shAt(i), p = at(i);
    if (sh[3] === 1) {
      const ax = Math.abs(sh[0]), bib = ax < 0.05 && sh[1] < yColl - 0.035 ? 1 : 0;
      const pl = bib ? 0.95 + 0.05 * Math.cos(ax / 0.0065 * Math.PI * 2) : 1;
      if (stud(sh[0], sh[1])) { b[i] = 22; b[i + 1] = 22; b[i + 2] = 26; }
      else { b[i] = shirtCol[0] * pl; b[i + 1] = shirtCol[1] * pl; b[i + 2] = shirtCol[2] * pl; }
    }
  } }), isCloth), RECT.tux);
  const shrink = async (b, from, to) => sharp(b, { raw: { width: from, height: from, channels: 4 } }).resize(to, to, { kernel: 'lanczos3' }).raw().toBuffer();
  // Uniform: Messingknöpfe zweireihig, dunkle Krawatte
  const btn = (p) => { if (p[3] !== 1 || p[2] < 0.06) return 0; for (const y of [0.0, 0.1, 0.2, 0.3]) for (const sx of [-0.055, 0.055]) { const d = Math.hypot(p[0] - sx, p[1] - (rigM.waist - 0.08 + y)); if (d < 0.011) return 1; } return 0; };
  blit(await shrink(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTie(p) && !isCloth(b, i)) { b[i] = 30; b[i + 1] = 28; b[i + 2] = 32; } if (btn(p)) { b[i] = 200; b[i + 1] = 160; b[i + 2] = 80; } } }),
    (b, i) => isCloth(b, i) && !(b[i] === 200 && b[i + 1] === 160)), CT, TILE), RECT.uniform);
  // Kellner: Jacke in Farbe der Figur, Hose schwarz, schwarze Fliege statt Krawatte
  blit(await shrink(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTieBand(b, i, p)) { b[i] = shirtCol[0]; b[i + 1] = shirtCol[1]; b[i + 2] = shirtCol[2]; } if (p[3] === 1 && p[1] < rigM.hip - 0.02 && isCloth(b, i)) { b[i] = b[i + 1] = b[i + 2] = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * 0.35) | 1; } } }),
    (b, i) => isCloth(b, i) && !(b[i] & 1 && b[i] === b[i + 1] && b[i] < 40)), CT, TILE), RECT.waiter);
  // Latzhose: der Stoff wird gefärbt, Schnallen und Knöpfe bleiben (V56: 1024 px mit den Schatten der Falten aus dem AO-Bild)
  const work = await mulAO(await readRGBA(partTex('work-m'), CT, CT), partAO('work-m'), CT);
  blit(paintMask(work, (b, i) => b[i + 3] > 10 && b[i + 2] > b[i] * 1.15 && lum(b[i], b[i + 1], b[i + 2]) > 60), RECT.work);
  // Damenkostüm: dunkler Stoff gefärbt, Bluse bleibt (V56: 1024 px, mehr Zeichnung aus dem Quellbild und den Faltenschatten)
  const lady = await mulAO(await readRGBA(partTex('lady-f'), CT, CT), partAO('lady-f'), CT);
  paintMask(lady, (b, i) => b[i + 3] > 10);
  for (let i = 0; i < lady.length; i += 4) lady[i] = lady[i + 1] = lady[i + 2] = Math.round(170 * 0.6 + lady[i] * 0.4);
  blit(lady, RECT.lady);
  // V56: Hemdsärmel mit Hosenträgern (Freizeitanzug 03: gestreiftes Hemd und Jeans): das Hemd wird cremefarbenes Leinen mit der
  // Webstruktur der Streifen, die Jeans eine Wollhose mit Fischgrat in der Farbe der Figur, dazu Lederträger vorn und hinten
  {
    const P = parts['braces-m'], R = uvRaster(P, TILE), b = await mulAO(await readRGBA(partTex('braces-m'), TILE, TILE), partAO('braces-m'), TILE);
    const flag = new Uint8Array(TILE * TILE);
    for (let i = 0; i < b.length; i += 4) {
      if (b[i + 3] < 10) continue;
      const p = [R[i], R[i + 1], R[i + 2], R[i + 3]], L = lum(b[i], b[i + 1], b[i + 2]);
      if (b[i + 2] > b[i] + 12) { b[i] = b[i + 1] = b[i + 2] = herring(p, L); flag[i / 4] = 1; continue; }
      if (p[3] === 1 && p[1] > rigM.hip - 0.03 && p[1] < rigM.top + 0.045 && Math.abs(p[0]) < 0.12 && Math.abs(Math.abs(p[0]) - 0.062) < 0.017) {
        const e = Math.min(1, (1 - Math.abs(Math.abs(p[0]) - 0.062) / 0.017) * 4), d = 0.8 + 0.2 * e;
        b[i] = 86 * d; b[i + 1] = 58 * d; b[i + 2] = 34 * d; continue;
      }
      const w = 0.88 + 0.12 * (L / 255) + 0.05 * (vN3(p[0] * 1500, p[1] * 1500, p[2] * 1500) - 0.5);
      b[i] = 234 * w; b[i + 1] = 216 * w; b[i + 2] = 180 * w;
    }
    blit(paintMask(b, (bb, i) => flag[i / 4] === 1), RECT.braces);
  }
  // V56: Arbeitsjacke (Freizeitanzug 05: Jacke, gestreiftes Hemd, Jeans): Jacke in Figurenfarbe mit Tweed-Noppen, Hemd Leinen,
  // Hose dunkel mit Fischgrat
  {
    const P = parts['jacket-m'], R = uvRaster(P, TILE), b = await mulAO(await readRGBA(partTex('jacket-m'), TILE, TILE), partAO('jacket-m'), TILE);
    const flag = new Uint8Array(TILE * TILE);
    for (let i = 0; i < b.length; i += 4) {
      if (b[i + 3] < 10) continue;
      const p = [R[i], R[i + 1], R[i + 2], R[i + 3]], L = lum(b[i], b[i + 1], b[i + 2]);
      if (b[i + 2] > b[i] + 12) { const g = herring(p, L) * 0.5; b[i] = g * 1.1; b[i + 1] = g; b[i + 2] = g * 0.9; continue; }       // Hose: dunkles Braungrau, bleibt
      const frontV = p[3] === 1 && Math.abs(p[0]) < 0.09 && p[2] > 0.03 && p[1] > rigM.waist - 0.1;
      if (b[i] > b[i + 1] + 30 || (L < 40 && frontV)) { const w = 0.86 + 0.14 * Math.min(1, L / 120); b[i] = 234 * w; b[i + 1] = 216 * w; b[i + 2] = 180 * w; continue; }   // Hemd (nur vorn im Ausschnitt)
      const fl = vN3(p[0] * 700 + 1, p[1] * 700, p[2] * 700), g = 70 + 0.3 * L + (fl > 0.74 ? 26 : fl < 0.22 ? -18 : 0) + 8 * (vN3(p[0] * 300, p[1] * 300, p[2] * 300) - 0.5);
      b[i] = b[i + 1] = b[i + 2] = Math.max(30, Math.min(104, g)); flag[i / 4] = 1;
    }
    blit(paintMask(b, (bb, i) => flag[i / 4] === 1), RECT.jacket);
  }
  // V56: Flapperkleid (TubeDress, weiß mit Schattierung): Mieder mit Perlen-Chevrons und Goldlinien, tiefe Taille mit Goldband,
  // Rock in Figurenfarbe, unten Fransen (helle und dunkle Strähnen um den Körper). Gold bleibt, alles andere wird gefärbt
  {
    const P = parts['flapper-f'], R = uvRaster(P, CT), b = await readRGBA(P.tex, CT, CT), rf = RIG.f;
    const waistY = rf.hip - 0.02, fringeY = rf.hip - 0.17, gold = [214, 176, 96], flag = new Uint8Array(CT * CT), fr = x => x - Math.floor(x);
    for (let i = 0; i < b.length; i += 4) {
      if (b[i + 3] < 10) continue;
      const p = [R[i], R[i + 1], R[i + 2], R[i + 3]]; if (p[3] !== 1) continue;
      const L = lum(b[i], b[i + 1], b[i + 2]) / 255, ang = Math.atan2(p[0], p[2]) / 6.2832, y = p[1];
      let g = 150 + 70 * (L - 0.82), isGold = Math.abs(y - waistY) < 0.007;
      if (y > waistY + 0.007) {
        const tri = Math.abs(fr(ang * 10) * 2 - 1), z1 = fr((y - waistY) / 0.034 + 0.5 * tri);
        if (Math.abs(z1 - 0.5) < 0.075) isGold = true;
        else if (vN3(p[0] * 2200, p[1] * 2200, p[2] * 2200) > 0.82) g += 45;   // Perlen
      } else if (y < fringeY) {
        if (Math.abs(y - fringeY) < 0.005) isGold = true;
        else { const sN = fr(ang * 110 + 0.25 * fr(ang * 13)); g *= 0.72 + 0.5 * (sN < 0.5 ? 1 : 0) + 0.12 * (vN3(p[0] * 600, p[1] * 60, p[2] * 600) - 0.5); }
      }
      if (isGold) { const sh = 0.8 + 0.25 * L; b[i] = gold[0] * sh; b[i + 1] = gold[1] * sh; b[i + 2] = gold[2] * sh; }
      else { b[i] = b[i + 1] = b[i + 2] = Math.max(20, Math.min(250, g)); flag[i / 4] = 1; }
    }
    blit(paintMask(b, (bb, i) => flag[i / 4] === 1), RECT.flapper);
  }
  // V56: Cloche: Filz mit Körnung, dunkles Ripsband und eine Schleife links; Spalte = Winkel, Zeile = Höhe (Krone oben, Krempe unten)
  {
    const [x0, y0, w, h] = rectPx(RECT.cloche), [v0, v1] = CLOCHE.band;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = ((y0 + y) * AW + x0 + x) * 4, u = x / w, v = y / h;
      let g = 150 + 18 * (vN3(x / 2.5, y / 2.5, 7) - 0.5) + 6 * (vN3(x / 9, y / 9, 3) - 0.5);
      const inBand = v > v0 && v < v1, bow = Math.hypot((u - 0.3) * 2.2, (v - (v0 + v1) / 2) / (v1 - v0) * 0.9) < 1;
      if (inBand) g *= 0.5 + 0.05 * Math.sin(y * 2.2);
      if (bow) g *= 0.72 + 0.35 * Math.pow(Math.max(0, 1 - Math.hypot((u - 0.3) * 2.2, (v - (v0 + v1) / 2) / (v1 - v0) * 0.9)), 1.5);
      atlas[i] = atlas[i + 1] = atlas[i + 2] = Math.max(30, Math.min(230, g)); atlas[i + 3] = 96;
    }
  }
  // Schuhe
  for (const [k, part] of [['shoes', 'shoes-m'], ['boots', 'boots-m']]) { const r = rectPx(RECT[k]); const b = await readRGBA(partTex(part), r[2], r[3]); for (let i = 3; i < b.length; i += 4) b[i] = 255; blit(b, RECT[k]); }
  // Augen (braun; die Farbe der Iris wählt der Shader)
  { const r = rectPx(RECT.eyes); const b = await readRGBA(path.join(MH, 'eyes/materials/brown_eye.png'), r[2], r[3]); blit(b, RECT.eyes); }
  // Haare, Brauen, Wimpern: Grauwert (Strähnen) + Deckung
  for (const [k, part] of [['hairA_m', 'hairA-m'], ['hairB_m', 'hairB-m'], ['hairC_m', 'hairC-m'], ['hairA_f', 'hairA-f'], ['hairB_f', 'hairB-f'], ['hairC_f', 'hairC-f'], ['brows_m', 'brows-m'], ['brows_f', 'brows-f'], ['lashes', 'lashes-m'],
    ['hairD_m', 'hairD-m'], ['hairE_m', 'hairE-m'], ['hairD_f', 'hairD-f'], ['hairE_f', 'hairE-f']]) {
    // V56: aus den 2048er-Bildern (feinere Strähnen); hairB-m bleibt beim alten Bild, damit Alexanders Frisur gleich aussieht
    const r = rectPx(RECT[k]); const b = await readRGBA(part === 'hairB-m' ? parts[part].tex : partTex(part), r[2], r[3]);
    let s = 0, c = 0; for (let i = 0; i < b.length; i += 4) if (b[i + 3] > 128) { s += lum(b[i], b[i + 1], b[i + 2]); c++; }
    const kk = c ? 0.75 * 255 / (s / c) : 1;
    for (let i = 0; i < b.length; i += 4) { const g = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * kk); b[i] = b[i + 1] = b[i + 2] = g; }
    blit(b, RECT[k]);
  }
  // Absatzschuhe: glattes Leder (Farbe kommt aus der Figur)
  { const [x0, y0, w, h] = rectPx(RECT.heels); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y0 + y) * AW + x0 + x) * 4; const g = 170 + 20 * Math.sin(x * 0.3) * Math.sin(y * 0.2); atlas[i] = atlas[i + 1] = atlas[i + 2] = g; atlas[i + 3] = 96; } }
  // V39: Fedora (Filz, Farbe der Figur bzw. des Hutes), braune Herrenschuhe, Pelzmantel (blaugrauer Stoff wird gefärbt, Pelz und Schnalle bleiben)
  { const r = rectPx(RECT.fedora); const b = await readRGBA(partTex('fedora-m'), r[2], r[3]); blit(paintMask(b, (bb, i) => bb[i + 3] > 10), RECT.fedora); }
  { const r = rectPx(RECT.shoes2); const b = await readRGBA(partTex('shoes2-m'), r[2], r[3]); for (let i = 3; i < b.length; i += 4) b[i] = 255; blit(b, RECT.shoes2); }
  { const b = await readRGBA(parts['coat-f'].tex, TILE, TILE); blit(paintMask(b, (bb, i) => bb[i + 3] > 10 && bb[i + 2] > bb[i] + 8), RECT.furcoat); }
  await playerTiles();
  await detailTiles();   // V44
  // Ränder auffüllen: leere Texel bekommen die Farbe des nächsten Nachbarn (keine Säume beim Mipmapping)
  dilate(atlas, AW, AH, 4);
  // V44: Alpha trägt jetzt das Hautrelief (Rauschen); mit alphaQuality 90 wäre die Datei 3,4 MB, mit 65 etwa 1,5 MB bei gleichem Bild
  await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).webp({ quality: 86, alphaQuality: 65, effort: 5 }).toFile(path.join(OUT, 'people-atlas.webp'));
  await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).resize(AW / 2, AH / 2, { kernel: 'lanczos3' }).webp({ quality: 82, alphaQuality: 60, effort: 5 }).toFile(path.join(OUT, 'people-atlas-m.webp'));
}
// V56: Schatten der Falten aus dem AO-Bild der Grundausstattung (sanft, nie unter 0,55)
async function mulAO(buf, file, size) {
  if (!file) return buf;
  const ao = await readRGBA(file, size, size);
  for (let i = 0; i < buf.length; i += 4) { const a = Math.max(0.55, Math.pow(ao[i] / 255, 0.5)); buf[i] *= a; buf[i + 1] *= a; buf[i + 2] *= a; }
  return buf;
}
// V56: Fischgrat (Wollhose): schräge Grate, die Richtung wechselt alle 1,2 cm; Grauwert fürs Färben
function herring(p, L) {
  const col = Math.floor(p[0] / 0.012), d = col % 2 ? 1 : -1, hb = 0.5 + 0.5 * Math.sin((p[0] * d * 0.9 + p[1]) * 6.2832 / 0.0045);
  return Math.max(30, Math.min(104, 62 + 0.1 * L + 9 * (hb - 0.5) + 7 * (vN3(p[0] * 400, p[1] * 400, p[2] * 400) - 0.5)));
}
function dilate(buf, w, h, n) {
  // nur Farbe auffüllen, wo das Bild ganz leer ist (Alpha 0 und schwarz)
  for (let it = 0; it < n; it++) {
    const src = Buffer.from(buf);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; if (src[i] + src[i + 1] + src[i + 2] > 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const j = (yy * w + xx) * 4; if (src[j] + src[j + 1] + src[j + 2] > 0) { buf[i] = src[j]; buf[i + 1] = src[j + 1]; buf[i + 2] = src[j + 2]; break; } }
    }
  }
}

/* ---------------- Netze zusammenstellen ---------------- */
// Ein Netz fürs Spiel: Lage, Normale, Atlas-UV, Glied, Mischung, Stoff, Variante, Bereich, Verdeckung
const meshes = {}, HEADP = {}, HEADBOX = {}, SKINRAST = {};   // V44: Inselkästen im Hautbild und Rasterdaten je Geschlecht
function addMesh(name, m) { meshes[name] = m; }
// Körper: Verdeckung je Kleidungsstück als Bitmaske über die Grundnetz-Ecken
const HIDEBIT = { 'suit-m': 1, 'work-m': 2, 'shoes-m': 4, 'boots-m': 8, 'lady-f': 16, 'heels-f': 32, 'coat-f': 128, 'shoes2-m': 256, 'flapper-f': 512, 'braces-m': 1024, 'jacket-m': 2048 };   // 64: Krawatte im Anzug (eigenes Netz); V56: Flapperkleid, Hemdsärmel, Jacke
for (const [gk, B] of Object.entries(bodies)) {
  const { U, pos } = B, n = U.vid.length, ws = U.vid.map(b => W[b]);
  const la = limbAttrs(ws, pos, gk);
  const hide = new Uint16Array(n);
  const clothOf = gk === 'p' ? 'm' : gk;            // der Spieler trägt die Herrenkleidung
  for (const [pn, bit] of Object.entries(HIDEBIT)) { const P = parts[pn]; if (!P || P.def.body !== clothOf) continue; const del = P.del || (pn === 'shoes2-m' ? parts['shoes-m'].del : null); if (!del) continue; for (let i = 0; i < n; i++) if (del[U.vid[i]]) hide[i] |= bit; }
  // V39: der Pelzmantel bringt keine Verdeckungsliste mit: Rumpf, Arme und Beine oberhalb des Saums (plus Rand) fallen unter ihm weg
  if (gk === 'f' && parts['coat-f']) { let hem = 1e9; const cp = parts['coat-f'].pos; for (let i = 1; i < cp.length; i += 3) hem = Math.min(hem, cp[i]);
    for (let i = 0; i < n; i++) { const r = la.reg[i], y = pos[i * 3 + 1]; if ((r === 3 || r === 4 || r === 5 || r === 7 || r === 8) && y > hem + 0.03 && y < RIG.f.top + 0.03) hide[i] |= HIDEBIT['coat-f']; }
    console.log('Pelzmantel: Saum bei', hem.toFixed(3)); }
  const nrm = normals(pos, U.idx, U.vid);
  // V24/V44: Kopfinsel der UV (Gesicht, Schädel, Ohren) und die beiden Handinseln bekommen eigene, größere Kacheln; der Rest
  // bleibt in der Hautkachel. Spieler: Art 6 = feste Haut (keine Wahl nach Alter und Herkunft), Kopf in face_p, Hände in der
  // ersten Herren-Handkachel (junge helle Haut, wie seine Körperhaut). Stadtleute: Art 2, der Shader schiebt die Spalte
  const isl = uvIslands(U.idx, n);
  const cnt = new Map(), hi = new Map(), hd = new Map(), sx = new Map();
  for (let i = 0; i < n; i++) { const k = isl[i]; cnt.set(k, (cnt.get(k) || 0) + 1); if (pos[i * 3 + 1] > RIG[gk === 'p' ? 'm' : gk].neck - 0.02) hi.set(k, (hi.get(k) || 0) + 1); if (la.hand[i * 4]) hd.set(k, (hd.get(k) || 0) + 1); sx.set(k, (sx.get(k) || 0) + pos[i * 3]); }
  // die größte Kopfinsel (Mundinneres und Augenwinkel bleiben in der Hautkachel); Hände: Inseln, die vor allem aus Fingern bestehen
  let best = -1, bc = 0; for (const [k, c] of cnt) if ((hi.get(k) || 0) > c * 0.8 && c > bc) { bc = c; best = k; }
  const handR = [], handL = []; for (const [k, c] of cnt) if ((hd.get(k) || 0) > c * 0.5 && c > 500) (sx.get(k) < 0 ? handR : handL).push(k);
  if (handR.length !== 1 || handL.length !== 1) console.warn(gk, 'Handinseln:', handR.length, handL.length);
  // Ausschnitt einer Inselgruppe im 512er-Hautbild, auf ganze Pixel gerundet (dann passt der Ausschnitt genau); lokale UV 0…1 darin
  const skinU = gk === 'p' ? RECT.skin_p : RECT['skin_' + gk], HB = HEADBOX;
  const local = new Float32Array(U.uv), where = new Uint8Array(n);   // 0 Haut, 1 Kopf, 2 rechte Hand, 3 linke Hand
  const remap = (keys, code, name) => {
    const set = new Set(keys); let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
    for (let i = 0; i < n; i++) if (set.has(isl[i])) { u0 = Math.min(u0, U.uv[i * 2]); u1 = Math.max(u1, U.uv[i * 2]); v0 = Math.min(v0, U.uv[i * 2 + 1]); v1 = Math.max(v1, U.uv[i * 2 + 1]); }
    const px0 = Math.max(0, Math.floor(u0 * TILE) - 2), px1 = Math.min(TILE, Math.ceil(u1 * TILE) + 2), py0 = Math.max(0, Math.floor((1 - v1) * TILE) - 2), py1 = Math.min(TILE, Math.ceil((1 - v0) * TILE) + 2);
    HB[name] = [px0, py0, px1 - px0, py1 - py0];   // gleich für alle Körper (dieselbe UV-Anordnung des Grundnetzes)
    const bu0 = px0 / TILE, bu1 = px1 / TILE, bv1 = 1 - py0 / TILE, bv0 = 1 - py1 / TILE;
    for (let i = 0; i < n; i++) if (set.has(isl[i])) { where[i] = code; local[i * 2] = (U.uv[i * 2] - bu0) / (bu1 - bu0); local[i * 2 + 1] = (U.uv[i * 2 + 1] - bv0) / (bv1 - bv0); }
  };
  remap([best], 1, 'head'); remap(handR, 2, 'handR'); remap(handL, 3, 'handL');
  // V47: Alexanders Gesicht bekommt mehr Texel. In der Kopfinsel nimmt das Gesicht nur etwa ein Zehntel der Kachel ein (der Rest
  // ist Schädel unter dem Haar, Ohren und Hals). Die Insel wird um die Gesichtsmitte radial gedehnt (Mitte 2,6-fach, zum Rand hin
  // stetig zurück auf 1), so liegen Augen, Nase und Mund auf etwa doppelt so vielen Texeln; Schädel und Nacken werden dafür enger.
  // Die Quell-UV bleibt in src0 (die Kachel wird darüber aus dem Hautbild abgetastet)
  if (gk === 'p') {
    const fm = RIG.p.face; let cu = 0, cv = 0, cn = 0;
    for (let i = 0; i < n; i++) if (where[i] === 1) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (Math.abs(x) < 0.03 && y > fm.mouthY && y < fm.eyeY && z > fm.noseZ - 0.05) { cu += local[i * 2]; cv += local[i * 2 + 1]; cn++; } }
    cu /= cn; cv /= cn;
    const src0 = new Float32Array(local), R0 = 0.46, MAG = 2.6, h = s => s * MAG / (1 + (MAG - 1) * s);
    for (let i = 0; i < n; i++) if (where[i] === 1) {
      const du = local[i * 2] - cu, dv = local[i * 2 + 1] - cv, r = Math.hypot(du, dv);
      if (r < 1e-6 || r >= R0) continue;
      const f = R0 * h(r / R0) / r; local[i * 2] = Math.min(0.997, Math.max(0.003, cu + du * f)); local[i * 2 + 1] = Math.min(0.997, Math.max(0.003, cv + dv * f));
    }
    HEADP.src0 = src0; HEADP.c = [cu, cv];
    console.log('Spielergesicht: Mitte', cu.toFixed(3), cv.toFixed(3), 'aus', cn, 'Ecken, Dehnung', MAG);
  }
  const hr = gk === 'f' ? RECT.hands_f : RECT.hands_m, half = r => [r[0], r[1], r[2] / 2, r[3]];
  const dest = [toAtlasUV(local, skinU), toAtlasUV(local, gk === 'p' ? RECT.face_p : RECT['face_' + gk]), toAtlasUV(local, half(hr)), toAtlasUV(local, [hr[0] + hr[2] / 2, hr[1], hr[2] / 2, hr[3]])];
  const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const s2 = dest[where[i]]; uv[i * 2] = s2[i * 2]; uv[i * 2 + 1] = s2[i * 2 + 1]; }
  const tex = new Float32Array(n).fill(gk === 'p' ? 6 : 2);
  // Rasterdaten für die gemalten Details (Lage und Normale je Texel): Spieler wie bisher (HEADP), Stadtleute je Geschlecht
  const rast = { pos, nrm, uv: local, where, idx: U.idx, hand: la.hand };
  if (gk === 'p') Object.assign(HEADP, rast, { inHead: Uint8Array.from(where, w => w === 1 ? 1 : 0) }); else SKINRAST[gk] = rast;
  const soft = new Float32Array(n * 3); for (let i = 0; i < n; i++) soft[i * 3] = FAB.skin;
  // V32: Finger und Gelenkanteile stecken (negativ) in der Variante: -(Finger·32768 + Grund·1024 + Mittel·32 + End), Anteile 0…31
  const opt = new Float32Array(n);
  for (let i = 0; i < n; i++) { const h = la.hand.subarray(i * 4, i * 4 + 4); if (h[0]) opt[i] = -(h[0] * 32768 + Math.round(h[1] * 31) * 1024 + Math.round(h[2] * 31) * 32 + Math.round(h[3] * 31)); }
  addMesh('body-' + gk, { pos, nrm, uv, tex, idx: U.idx, limb: la.limb, blend: la.blend, reg: la.reg, soft, opt, hide, hand: la.hand });
  // Augen (der Spieler nimmt die des Herrenkörpers: der Schädel ist derselbe)
  if (gk !== 'p') { const eyes = eyeMesh(B, gk); addMesh('eyes-' + gk, eyes); }
}
// Zusammenhängende UV-Inseln (Dreiecke, die Ecken teilen)
function uvIslands(idx, n) {
  const par = Int32Array.from({ length: n }, (_, i) => i), f = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let t = 0; t < idx.length; t += 3) { const a = f(idx[t]), b = f(idx[t + 1]), c = f(idx[t + 2]); par[b] = a; par[f(c)] = a; }
  const out = new Int32Array(n); for (let i = 0; i < n; i++) out[i] = f(i); return out;
}
function eyeMesh(B, gk) {
  const { ref, obj } = B.lp; const vpos = [], vw = [];
  for (let k = 0; k < ref.length; k++) { const r = ref[k]; vw.push(W[r]); vpos.push(B.skinPt([B.v[r * 3] * 0.1, B.v[r * 3 + 1] * 0.1, B.v[r * 3 + 2] * 0.1], W[r])); }
  const U = unweld(obj.faces, obj.vt); const n = U.vid.length, pos = new Float32Array(n * 3), ws = [];
  for (let i = 0; i < n; i++) { pos.set(vpos[U.vid[i]], i * 3); pos[i * 3 + 1] += lift[gk]; ws.push(vw[U.vid[i]]); }
  const la = limbAttrs(ws, pos, gk);
  const soft = new Float32Array(n * 3); for (let i = 0; i < n; i++) soft[i * 3] = FAB.skin;
  return { pos, nrm: normals(pos, U.idx, U.vid), uv: toAtlasUV(U.uv, RECT.eyes), tex: new Float32Array(n).fill(4), idx: U.idx, limb: la.limb, blend: la.blend, reg: la.reg, soft, opt: new Float32Array(n) };
}
// Proxies
for (const [name, P] of Object.entries(parts)) {
  const def = P.def, gk = def.body, n = P.U.vid.length;
  const la = limbAttrs(P.w, P.pos, gk);
  const rk = { 'suit-m': 'suit', 'work-m': 'work', 'shoes-m': 'shoes', 'boots-m': 'boots', 'lady-f': 'lady', 'brows-m': 'brows_m', 'brows-f': 'brows_f', 'lashes-m': 'lashes', 'lashes-f': 'lashes',
    'fedora-m': 'fedora', 'fedora2-m': 'fedora', 'coat-f': 'furcoat', 'shoes2-m': 'shoes2', 'flapper-f': 'flapper', 'braces-m': 'braces', 'jacket-m': 'jacket' }[name] || name.replace('-', '_');
  const uv = toAtlasUV(P.U.uv, RECT[rk]);
  const kindTex = def.hair ? 3 : def.brow ? 5 : 1;
  const soft = new Float32Array(n * 3), opt = new Float32Array(n);
  const fab = def.hair || def.brow ? FAB.hair : FAB[def.fab];
  const rig = RIG[gk];
  // Bubikopf mit geradem Pony: was vor dem Gesicht unter die Brauen fällt, wird auf Brauenhöhe gekürzt
  if (def.bangs) { const cut = rig.eye[1] + 0.032, zf = rig.eye[2] - 0.035;
    for (let i = 0; i < n; i++) { const x = P.pos[i * 3], y = P.pos[i * 3 + 1], z = P.pos[i * 3 + 2]; if (z > zf && Math.abs(x) < 0.082 && y < cut && y > rig.eye[1] - 0.2) P.pos[i * 3 + 1] = cut + (y - cut) * 0.04; } }
  // V39: Hüte: der Shader staucht das Haar unter dem Hut nur um 10 %, die MakeHuman-Krone liegt aber eng am Kopf (12,7 cm über der
  // Kopfmitte, Haar bis 13,6 cm): die Krone wird höher (x 1,3) und weiter (x 1,15), weich ab der Krempe, die Krempe bleibt
  if (def.hat) { const hc = rig.headC, hz = rig.headZ, sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < n; i++) { const y = P.pos[i * 3 + 1], k = sst(hc + 0.015, hc + 0.06, y); P.pos[i * 3] *= 1 + 0.15 * k; P.pos[i * 3 + 2] = hz + (P.pos[i * 3 + 2] - hz) * (1 + 0.15 * k); P.pos[i * 3 + 1] = y + (y - hc - 0.035) * 0.3 * k; } }
  const coatPix = def.furcoat ? await readRGBA(P.tex, TILE, TILE) : null;
  for (let i = 0; i < n; i++) {
    soft[i * 3] = fab;
    if (name === 'flapper-f') soft[i * 3] = P.pos[i * 3 + 1] > rig.hip - 0.013 ? FAB.sequin : FAB.silk;   // V56: Perlenmieder glitzert, der Rock ist Seide
    if (coatPix) { const u = P.U.uv[i * 2], v = P.U.uv[i * 2 + 1], k = ((Math.min(TILE - 1, Math.max(0, Math.floor((1 - v) * TILE)))) * TILE + Math.min(TILE - 1, Math.max(0, Math.floor(u * TILE)))) * 4;
      if (!(coatPix[k + 2] > coatPix[k] + 8) && coatPix[k + 3] > 10) soft[i * 3] = FAB.fur; }
    if (def.hair) {
      // Haar: schwingt unterhalb der Kopfmitte nach; Art 1 = Haar (unter dem Hut zusammengedrückt)
      const y = P.pos[i * 3 + 1]; soft[i * 3 + 1] = (def.sway || 0.3) * Math.min(1, Math.max(0, (rig.headC - y) / 0.15)); soft[i * 3 + 2] = 1;
      opt[i] = { A: 11, B: 12, C: 13 }[name[4]];
    }
    if (def.skirt) {
      // Rock: unterhalb der Hüfte geht der Stoff mit den Beinen (Art 2)
      const y = P.pos[i * 3 + 1]; if (y < rig.hip + 0.04 && la.limb[i * 2] === 0 || (y < rig.hip - 0.05 && la.blend[i] < 0.95)) { soft[i * 3 + 1] = Math.min(1, Math.max(0, (rig.hip + 0.04 - y) / 0.5)) * 0.8; soft[i * 3 + 2] = 2; la.limb[i * 2] = 0; la.limb[i * 2 + 1] = 0; la.blend[i] = 0; }
    }
  }
  // Haare und Brauen beidseitig: Karten von hinten sind sonst unsichtbar
  let idx = P.U.idx; if (def.hair || def.brow) { const d = new Uint32Array(idx.length * 2); d.set(idx); for (let t = 0; t < idx.length; t += 3) { d[idx.length + t] = idx[t]; d[idx.length + t + 1] = idx[t + 2]; d[idx.length + t + 2] = idx[t + 1]; } idx = d; }
  const m = { pos: P.pos, nrm: normals(P.pos, P.U.idx, P.U.vid), uv, tex: new Float32Array(n).fill(kindTex), idx, limb: la.limb, blend: la.blend, reg: la.reg, soft, opt };
  if (name === 'suit-m') {
    // V32: Hemdbrust mit Krawatte (Bit 64) und ihr Ersatz ohne Krawatte, nur aus den Dreiecken dieser Insel
    m.hide = Uint16Array.from(TIE.inT, v => v ? 64 : 0);
    const keep = []; for (let t = 0; t < idx.length; t += 3) if (TIE.inT[idx[t]] && TIE.inT[idx[t + 1]] && TIE.inT[idx[t + 2]]) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    addMesh('shirt-m', { ...m, pos: TIE.flat, nrm: normals(TIE.flat, P.U.idx, P.U.vid), idx: Uint32Array.from(keep), hide: null });
  }
  addMesh(name, m);
}
// Absatzschuhe der Damen: Hülle um den Fuß (4 mm), Sohle, Absatz
{
  const B = meshes['body-f'], n = B.pos.length / 3, take = new Int32Array(n).fill(-1), P = [], N = [], ids = [], L = [], R = [];
  for (let i = 0; i < n; i++) if (B.reg[i] === 9 || (B.reg[i] === 8 && B.pos[i * 3 + 1] < RIG.f.ank + 0.03)) take[i] = 1;
  let k = 0; const map = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (take[i] > 0) B.hide[i] |= HIDEBIT['heels-f'];
  for (let i = 0; i < n; i++) if (take[i] > 0) { map[i] = k++; for (let d = 0; d < 3; d++) { P.push(B.pos[i * 3 + d] + B.nrm[i * 3 + d] * 0.004); N.push(B.nrm[i * 3 + d]); } L.push(B.limb[i * 2], B.limb[i * 2 + 1]); }
  for (let t = 0; t < B.idx.length; t += 3) { const a = map[B.idx[t]], b = map[B.idx[t + 1]], c = map[B.idx[t + 2]]; if (a >= 0 && b >= 0 && c >= 0) ids.push(a, b, c); }
  // Zehen verschwinden im Schuh: Hülle glätten (Nachbarn über gleiche Lage, auch über UV-Nähte), dann wieder etwas aufblähen
  { const m = P.length / 3, key = new Map(), gid = new Int32Array(m);
    for (let i = 0; i < m; i++) { const kk = P.slice(i * 3, i * 3 + 3).map(x => Math.round(x * 1e4)).join(','); if (!key.has(kk)) key.set(kk, key.size); gid[i] = key.get(kk); }
    const nb = Array.from({ length: key.size }, () => new Set());
    for (let t = 0; t < ids.length; t += 3) for (let e = 0; e < 3; e++) { const a = gid[ids[t + e]], b = gid[ids[t + (e + 1) % 3]]; nb[a].add(b); nb[b].add(a); }
    let G = new Float64Array(key.size * 3); for (let i = 0; i < m; i++) for (let d = 0; d < 3; d++) G[gid[i] * 3 + d] = P[i * 3 + d];
    const y0 = new Float64Array(key.size); for (let g = 0; g < key.size; g++) y0[g] = G[g * 3 + 1];
    for (let it = 0; it < 10; it++) { const H = new Float64Array(G); for (let g = 0; g < key.size; g++) { if (!nb[g].size) continue; let a = [0, 0, 0]; for (const q of nb[g]) for (let d = 0; d < 3; d++) a[d] += G[q * 3 + d]; for (let d = 0; d < 3; d++) H[g * 3 + d] = G[g * 3 + d] * 0.4 + a[d] / nb[g].size * 0.6; H[g * 3 + 1] = Math.max(H[g * 3 + 1], Math.min(y0[g], 0.004)); } G = H; }
    for (let i = 0; i < m; i++) for (let d = 0; d < 3; d++) P[i * 3 + d] = G[gid[i] * 3 + d] + N[i * 3 + d] * 0.003; }
  // Absatz: Klotz unter der Ferse, je Fuß
  const addBox = (cx, y0, y1, cz, wx, wz, limb) => { const o = P.length / 3; const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const y of [y0, y1]) for (const [sx, sz] of c) { P.push(cx + sx * wx, y, cz + sz * wz); N.push(sx * 0.7, y === y0 ? -0.7 : 0.7, sz * 0.7); L.push(limb, RIG.f.hip); }
    for (const q of [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [3, 2, 1, 0]]) ids.push(o + q[0], o + q[1], o + q[2], o + q[0], o + q[2], o + q[3]); };
  for (const [sx, limb] of [[-1, 5], [1, 6]]) {
    // Ferse: hinterster, tiefster Punkt des Fußes
    let hz = 1e9, hx = 0, hy = 1e9; for (let i = 0; i < n; i++) if (take[i] > 0 && Math.sign(B.pos[i * 3]) === sx) { if (B.pos[i * 3 + 2] < hz) { hz = B.pos[i * 3 + 2]; hx = B.pos[i * 3]; } }
    for (let i = 0; i < n; i++) if (take[i] > 0 && Math.sign(B.pos[i * 3]) === sx && B.pos[i * 3 + 2] < hz + 0.05) hy = Math.min(hy, B.pos[i * 3 + 1]);
    addBox(hx, 0, hy + 0.01, hz + 0.022, 0.012, 0.013, limb);
  }
  const m = P.length / 3, soft = new Float32Array(m * 3); for (let i = 0; i < m; i++) soft[i * 3] = FAB.leather;
  const uv = new Float32Array(m * 2); const r = RECT.heels; for (let i = 0; i < m; i++) { uv[i * 2] = (r[0] + 0.5 * r[2]) * TILE / AW; uv[i * 2 + 1] = 1 - (r[1] + 0.5 * r[3]) * TILE / AH; }
  const reg = new Uint8Array(m).fill(9), blend = new Float32Array(m).fill(1);
  addMesh('heels-f', { pos: Float32Array.from(P), nrm: Float32Array.from(N), uv, tex: new Float32Array(m).fill(1), idx: Uint32Array.from(ids), limb: Float32Array.from(L), blend, reg, soft, opt: new Float32Array(m), paint: true });
}

// V56: Cloche (Glockenhut der Damen): Drehkörper um die Kopfmitte, Krone hoch genug für die Frisuren darunter (der Shader staucht
// das Haar unter dem Hut nur um 10 %), unten eine kleine, nach unten gezogene Krempe. Spalte der Kachel = Winkel, Zeile = Höhe
const CLOCHE = { band: [0, 0] };
{
  const R = RIG.f, hc = R.headC, hz = R.headZ;
  // Profil (Radius, Höhe über der Kopfmitte) von der Krone zur Krempe
  // Unterkante vorn auf Brauenhöhe (gut 2 cm über der Kopfmitte), hinten und seitlich 2 cm tiefer über Ohren und Nacken
  // Krone weit genug für Bubikopf und Bob darunter (Haarradius bis 12,6 cm)
  const prof = [[0, 0.172], [0.04, 0.169], [0.075, 0.158], [0.1, 0.138], [0.113, 0.11], [0.12, 0.078], [0.124, 0.048], [0.126, 0.03], [0.13, 0.024], [0.138, 0.016], [0.144, 0.01]];
  const NA = 28, pos = [], nrm = [], uv = [], idx = [], yTop = prof[0][1], yBot = prof[prof.length - 1][1];
  for (let j = 0; j < prof.length; j++) for (let a = 0; a <= NA; a++) {
    const t = a / NA * Math.PI * 2, [r, y0] = prof[j], y = y0 - 0.022 * Math.max(0, -Math.cos(t)) * sst(0.06, 0.03, y0), flare = 1 + 0.05 * Math.max(0, Math.cos(t)) * sst(0.03, 0.012, y0);
    pos.push(Math.sin(t) * r * flare, hc + y, hz + Math.cos(t) * r * flare); uv.push(a / NA, 1 - (yTop - y0) / (yTop - yBot));
    const pj = prof[Math.max(0, j - 1)], nj = prof[Math.min(prof.length - 1, j + 1)], dr = nj[0] - pj[0], dy = nj[1] - pj[1], l = Math.hypot(dr, dy) || 1;
    nrm.push(Math.sin(t) * dy / l, -dr / l, Math.cos(t) * dy / l);
  }
  for (let j = 0; j < prof.length - 1; j++) for (let a = 0; a < NA; a++) { const o = j * (NA + 1) + a; idx.push(o, o + NA + 1, o + 1, o + 1, o + NA + 1, o + NA + 2); }
  CLOCHE.band = [(yTop - 0.044) / (yTop - yBot), (yTop - 0.031) / (yTop - yBot)];   // Ripsband knapp über der Krempe
  const n = pos.length / 3, soft = new Float32Array(n * 3); for (let i = 0; i < n; i++) soft[i * 3] = FAB.felt;
  addMesh('cloche-f', { pos: Float32Array.from(pos), nrm: Float32Array.from(nrm), uv: toAtlasUV(Float32Array.from(uv), RECT.cloche), tex: new Float32Array(n).fill(1), idx: Uint32Array.from(idx),
    limb: new Float32Array(n * 2), blend: new Float32Array(n), reg: new Uint8Array(n).fill(1), soft, opt: new Float32Array(n) });
}
// V56: Träger des Flapperkleids: zwei dünne Bänder vom vorderen Rand des Mieders über die Schulter zum hinteren Rand
{
  const D = meshes['flapper-f'], B = meshes['body-f'], R = RIG.f, P = [], N = [], idx = [], L = [];
  const topAt = (sx, back) => { let best = null; for (let i = 0; i < D.pos.length; i += 3) { const x = D.pos[i], y = D.pos[i + 1], z = D.pos[i + 2]; if (Math.abs(x - sx) < 0.012 && (back ? z < 0 : z > 0) && (!best || y > best[1])) best = [x, y, z]; } return best; };
  for (const sd of [-1, 1]) {
    const f = topAt(sd * 0.07, false), b = topAt(sd * 0.07, true); if (!f || !b) continue;
    let sh = null; for (let i = 0; i < B.pos.length; i += 3) { const x = B.pos[i], y = B.pos[i + 1], z = B.pos[i + 2]; if (Math.abs(x - sd * 0.07) < 0.012 && Math.abs(z - (f[2] + b[2]) / 2) < 0.03 && (!sh || y > sh[1])) sh = [x, y, z]; }
    const top = sh ? sh[1] + 0.006 : R.top + 0.03, pts = [f, [f[0], (f[1] + top) / 2 + 0.01, f[2] * 0.75], [sd * 0.072, top, (f[2] + b[2]) / 2], [b[0], (b[1] + top) / 2 + 0.01, b[2] * 0.75], b];
    const o = P.length / 3, NS = 6, r = 0.0045;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[Math.min(k + 1, pts.length - 1)], pr = pts[Math.max(k - 1, 0)], d = F.nrm(F.sub(q, pr)), u = F.nrm(F.cross(d, [1, 0, 0])), v = F.cross(d, u);
      for (let s2 = 0; s2 < NS; s2++) { const a = s2 / NS * Math.PI * 2, nn = F.add(F.mul(u, Math.cos(a)), F.mul(v, Math.sin(a))); P.push(...F.add(p, F.mul(nn, r))); N.push(...nn); L.push(0, 0); }
    }
    for (let k = 0; k < pts.length - 1; k++) for (let s2 = 0; s2 < NS; s2++) { const a = o + k * NS + s2, b2 = o + k * NS + (s2 + 1) % NS; idx.push(a, a + NS, b2, b2, a + NS, b2 + NS); }
  }
  const n = P.length / 3, soft = new Float32Array(n * 3); for (let i = 0; i < n; i++) soft[i * 3] = FAB.silk;
  const uv = new Float32Array(n * 2), rr = RECT.heels; for (let i = 0; i < n; i++) { uv[i * 2] = (rr[0] + 0.5 * rr[2]) * TILE / AW; uv[i * 2 + 1] = 1 - (rr[1] + 0.5 * rr[3]) * TILE / AH; }
  addMesh('straps-f', { pos: Float32Array.from(P), nrm: Float32Array.from(N), uv, tex: new Float32Array(n).fill(1), idx: Uint32Array.from(idx), limb: Float32Array.from(L), blend: new Float32Array(n), reg: new Uint8Array(n).fill(3), soft, opt: new Float32Array(n) });
  console.log('Kleidträger:', n, 'Ecken');
}
// V48: Alexanders eigene Frisur nach den Referenzbildern: die glatt zurückgekämmte short04 mit mehr Fülle. Oben und vorn hebt sich das
// Haar rundum etwas vom Kopf (oben 1 cm, vorn bis 1,5 cm, wie eine zurückgekämmte Tolle), nach unten (Schläfen, Ohren, Nacken) läuft es weich auf die alte
// Lage aus, damit keine Lücke zur Kopfhaut entsteht (die Haarkarten haben zu viele Ränder, um nach dem Rand zu gehen)
{
  const src = meshes['hairB-m'], R = RIG.m, n = src.pos.length / 3, pos = Float32Array.from(src.pos);
  // vorderster Rand der Frisur in der Mitte (Höhe) vor dem Verformen
  let y0 = 9; for (let i = 0; i < n; i++) if (Math.abs(src.pos[i * 3]) < 0.03 && src.pos[i * 3 + 2] > R.headZ + 0.05) y0 = Math.min(y0, src.pos[i * 3 + 1]);
  for (let i = 0; i < n; i++) {
    const x = src.pos[i * 3], y = src.pos[i * 3 + 1], z = src.pos[i * 3 + 2];
    const w = sst(R.headC - 0.05, R.headC + 0.02, y), dx = x, dy = y - R.headC, dz = z - R.headZ, l = Math.hypot(dx, dy, dz) || 1;
    const top = sst(R.headC + 0.04, R.headC + 0.11, y), front = sst(R.headZ - 0.01, R.headZ + 0.07, z) * sst(R.headC + 0.03, R.headC + 0.09, y);
    // V49: die vorderste Reihe liegt flach auf der Stirn (kein Hutrand), die Fülle setzt erst 2-3 cm dahinter ein
    const lie = 1 - sst(R.headZ + 0.07, R.headZ + 0.1, z) * sst(0.06, 0.03, Math.abs(x)) * (1 - sst(y0 + 0.012, y0 + 0.035, y));
    const a = w * (0.005 + 0.004 * top + 0.007 * front) * lie;
    pos[i * 3] = x + dx / l * a; pos[i * 3 + 1] = y + dy / l * a + w * front * 0.003 * lie; pos[i * 3 + 2] = z + dz / l * a;
  }
  // V49: Haaransatz vorn: die Frisur endete gut 1 cm über dem gemalten Ansatz (dazwischen sah man einen Stoppelstreifen). Die vorderen
  // Strähnen werden bis zum Ansatz heruntergezogen und folgen dabei der Stirn (Profil des Spielerkopfs in der Mitte)
  const B = meshes['body-p'].pos, prof = [];
  for (let i = 0; i < B.length; i += 3) if (Math.abs(B[i]) < 0.008 && B[i + 1] > 1.66 && B[i + 1] < 1.8 && B[i + 2] > 0.05) prof.push([B[i + 1], B[i + 2]]);
  prof.sort((p, q) => p[0] - q[0]);
  const fz = y => { let k = 0; while (k < prof.length - 2 && prof[k + 1][0] < y) k++; const [ya, za] = prof[k], [yb, zb] = prof[k + 1]; return za + (zb - za) * Math.min(1, Math.max(0, (y - ya) / Math.max(1e-5, yb - ya))); };
  const drop = Math.max(0, y0 - HAIRLINE);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const k = sst(R.headZ + 0.03, R.headZ + 0.07, z) * sst(0.075, 0.045, Math.abs(x)) * (1 - sst(y0, y0 + 0.03, y));
    if (k < 0.001) continue;
    const yn = y - drop * k; pos[i * 3 + 1] = yn; pos[i * 3 + 2] = z + (fz(yn) - fz(y)) * Math.min(1, k * 1.5);
  }
  addMesh('hairP-m', { ...src, pos });
}
// V39: Höhen von Hüten und Frisuren über der Kopfmitte (Haar unter dem Hut wird im Shader nur um 10 % gestaucht)
for (const k of ['fedora-m', 'fedora2-m', 'cloche-f', 'hairA-m', 'hairB-m', 'hairC-m', 'hairD-m', 'hairE-m', 'hairA-f', 'hairB-f', 'hairD-f', 'hairE-f']) { const m = meshes[k]; if (!m) continue; let y = -1e9, r = 0; const hc = RIG[k.endsWith('-f') ? 'f' : 'm'].headC; for (let i = 0; i < m.pos.length; i += 3) { y = Math.max(y, m.pos[i + 1]); if (m.pos[i + 1] > hc + 0.02) r = Math.max(r, Math.hypot(m.pos[i], m.pos[i + 2] - RIG.m.headZ)); } console.log(k, 'oben', (y - hc).toFixed(3), 'Radius', r.toFixed(3)); }
/* ---------------- Detailstufe 1: vereinfacht ---------------- */
function simplify(m, ratio, err = 0.02) {
  const target = Math.max(3, Math.floor(m.idx.length * ratio / 3) * 3);
  const [ix] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, err, []);
  return { ...m, idx: ix };
}
// Ziel: höchstens etwa 6000 Dreiecke je Figur in der mittleren Stufe (bis 45 m stehen oft hunderte Figuren);
// Haare dürfen gröber werden (Fehler 0.05), in dem Abstand sieht man nur noch die Form
const LOD1 = { 'shirt-m': 0.5, 'body-m': 0.15, 'body-f': 0.15, 'body-p': 0.3, 'suit-m': 0.18, 'work-m': 0.25, 'lady-f': 0.3, 'shoes-m': 0.15, 'boots-m': 0.2, 'heels-f': 0.25, 'eyes-m': 1, 'eyes-f': 1,
  'hairA-m': 0.3, 'hairB-m': 0.4, 'hairP-m': 0.4, 'hairC-m': 0.25, 'hairA-f': 0.3, 'hairB-f': 0.15, 'hairC-f': 0.2,
  'hairD-m': 0.3, 'hairE-m': 0.2, 'hairD-f': 0.2, 'hairE-f': 0.15, 'fedora-m': 0.3, 'fedora2-m': 0.3, 'coat-f': 0.18, 'shoes2-m': 0.15,
  'flapper-f': 0.35, 'braces-m': 0.3, 'jacket-m': 0.25, 'cloche-f': 0.5, 'straps-f': 1 };
for (const [k, r] of Object.entries(LOD1)) if (meshes[k]) meshes[k + '@1'] = r < 1 ? simplify(meshes[k], r, /^hair/.test(k) ? 0.05 : 0.02) : meshes[k];

/* ---------------- Vorschau ---------------- */
if (PREV) {
  const { preview } = await import('./people/preview.mjs');
  fs.mkdirSync(PREV, { recursive: true });
  for (const [gk, list] of [['m', ['body-m', 'suit-m', 'shoes-m', 'hairA-m', 'eyes-m']], ['f', ['body-f', 'lady-f', 'heels-f', 'hairA-f', 'eyes-f']]]) {
    for (const lod of ['', '@1']) {
      const ms = list.map(k => { const m = meshes[k + lod] || meshes[k]; const H = HIDEBIT; let idx = m.idx;
        if (k.startsWith('body')) { const mask = list.reduce((a, p) => a | (H[p] || 0), 0); const keep = []; for (let t = 0; t < idx.length; t += 3) { if ((m.hide[idx[t]] & m.hide[idx[t + 1]] & m.hide[idx[t + 2]] & mask) === 0) keep.push(idx[t], idx[t + 1], idx[t + 2]); } idx = Uint32Array.from(keep); }
        const col = k.startsWith('body') ? [0.86, 0.66, 0.55] : k.startsWith('hair') ? [0.35, 0.22, 0.12] : k.startsWith('eyes') ? [0.9, 0.9, 0.9] : [0.25, 0.28, 0.35];
        return { pos: m.pos, idx, col, double: true }; });
      await preview(path.join(PREV, `fig-${gk}${lod ? '-lod1' : ''}.png`), ms, { lines: [RIG[gk].hip, RIG[gk].knee, RIG[gk].top, RIG[gk].headC] });
      await preview(path.join(PREV, `head-${gk}${lod ? '-lod1' : ''}.png`), ms, { y0: RIG[gk].headC - 0.2, y1: RIG[gk].headC + 0.16, w: 300, h: 300, views: [[0, 0], [0.7, 0], [Math.PI, 0]] });
    }
    // V32: Hände: entspannt und (wie im Shader gerechnet) zur Faust geschlossen
    { const m = meshes['body-' + gk], R = RIG[gk], wr = R.wr;
      const rot = (v, a, t) => { const c = Math.cos(t), s = Math.sin(t), d = F.dot(a, v), cr = F.cross(a, v); return [v[0] * c + cr[0] * s + a[0] * d * (1 - c), v[1] * c + cr[1] * s + a[1] * d * (1 - c), v[2] * c + cr[2] * s + a[2] * d * (1 - c)]; };
      for (const [nm, k] of [['entspannt', 0], ['faust', 1], ['offen', -0.35]]) {
        const pos = Float32Array.from(m.pos);
        for (let i = 0; i < pos.length / 3; i++) { const f = m.hand[i * 4]; if (!f || pos[i * 3] > 0) continue;
          const H = R.hand[f - 1], CURL = f === 1 ? [0.35, 0.8, 0.8] : [1.05, 1.45, 0.9];   // wie FIST im Shader (people-skeleton.js)
          let p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
          for (let j = 2; j >= 0; j--) { const J = H[j].slice(0, 3), A = H[j].slice(3), w = m.hand[i * 4 + 1 + j]; p = F.add(J, rot(F.sub(p, J), A, k * CURL[j] * w)); }
          pos.set(p, i * 3); }
        // nur die rechte Hand, ums Handgelenk zentriert
        const keep = []; for (let t = 0; t < m.idx.length; t += 3) { const a = m.idx[t]; if (pos[a * 3] < 0 && (m.reg[a] === 6 || m.reg[a] === 5) && pos[a * 3 + 1] < wr[1] + 0.06) keep.push(m.idx[t], m.idx[t + 1], m.idx[t + 2]); }
        for (let i = 0; i < pos.length / 3; i++) { pos[i * 3] += wr[0]; pos[i * 3 + 2] -= wr[2]; }
        await preview(path.join(PREV, `hand-${gk}-${nm}.png`), [{ pos, idx: Uint32Array.from(keep), col: [0.86, 0.66, 0.55], double: true }], { y0: wr[1] - 0.22, y1: wr[1] + 0.04, w: 260, h: 260, views: [[0, 0], [Math.PI / 2, 0], [-Math.PI / 2, 0], [Math.PI, 0]] });
      }
    }
    for (const h of ['B', 'C']) {
      const ms = ['body-' + gk, 'eyes-' + gk, `hair${h}-${gk}`].map(k => ({ pos: meshes[k].pos, idx: meshes[k].idx, col: k.startsWith('hair') ? [0.35, 0.22, 0.12] : [0.86, 0.66, 0.55], double: true }));
      await preview(path.join(PREV, `head-${gk}-${h}.png`), ms, { y0: RIG[gk].headC - 0.2, y1: RIG[gk].headC + 0.16, w: 300, h: 300, views: [[0, 0], [0.7, 0], [Math.PI, 0]] });
    }
  }
}

/* ---------------- Schreiben ---------------- */
await buildAtlas();
const doc = new Document(); const buf = doc.createBuffer();
const scene = doc.createScene();
const stats = {};
for (const [name, m] of Object.entries(meshes)) {
  // nur benutzte Ecken (nach dem Vereinfachen)
  const used = new Int32Array(m.pos.length / 3).fill(-1); let n = 0;
  for (const i of m.idx) if (used[i] < 0) used[i] = n++;
  const pick = (a, c, T = Float32Array) => { const o = new T(n * c); for (let i = 0; i < used.length; i++) if (used[i] >= 0) for (let d = 0; d < c; d++) o[used[i] * c + d] = a[i * c + d]; return o; };
  const idx = Uint32Array.from(m.idx, i => used[i]);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pick(m.pos, 3)).setBuffer(buf))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(pick(m.nrm, 3)).setBuffer(buf))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(pick(m.uv, 2)).setBuffer(buf))
    .setAttribute('_LIMB', doc.createAccessor().setType('VEC2').setArray(pick(m.limb, 2)).setBuffer(buf))
    .setAttribute('_BLEND', doc.createAccessor().setType('SCALAR').setArray(pick(m.blend, 1)).setBuffer(buf))
    .setAttribute('_TEXK', doc.createAccessor().setType('SCALAR').setArray(pick(m.tex, 1)).setBuffer(buf))
    .setAttribute('_SOFT', doc.createAccessor().setType('VEC3').setArray(pick(m.soft, 3)).setBuffer(buf))
    .setAttribute('_OPT', doc.createAccessor().setType('SCALAR').setArray(pick(m.opt, 1)).setBuffer(buf))
    .setAttribute('_REG', doc.createAccessor().setType('SCALAR').setArray(pick(Float32Array.from(m.reg), 1)).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(n > 65535 ? idx : Uint16Array.from(idx)).setBuffer(buf));
  if (m.hide) prim.setAttribute('_HIDE', doc.createAccessor().setType('SCALAR').setArray(pick(Float32Array.from(m.hide), 1)).setBuffer(buf));
  const mesh = doc.createMesh(name).addPrimitive(prim);
  scene.addChild(doc.createNode(name).setMesh(mesh));
  stats[name] = { verts: n, tris: idx.length / 3 };
}
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeGeneric: 12 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
await io.write(path.join(OUT, 'people.glb'), doc);

const meta = {
  comment: 'V22: Figuren aus MakeHuman (CC0). Erzeugt von tools/make-people.mjs. RIG: Gelenkpunkte der Ruhehaltung (Meter, rechte Seite positiv nach außen), m = Herren, f = Damen.',
  rig: RIG, hideBits: HIDEBIT, atlas: { w: AW, h: AH, tile: TILE, rect: RECT, skinTiles: 4 }, meshes: stats,
};
fs.writeFileSync(path.join(OUT, 'people.json'), JSON.stringify(meta, null, 1));
console.log(Object.entries(stats).map(([k, s]) => `${k}: ${s.verts}/${s.tris}`).join('  '));
for (const f of fs.readdirSync(OUT)) console.log(f, Math.round(fs.statSync(path.join(OUT, f)).size / 1024), 'KB');
