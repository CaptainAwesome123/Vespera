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
//   (makehuman/data braucht 3dobjs, rigs, eyes, targets/macrodetails und für den Spieler targets/chin, mouth, cheek, nose)
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

const [,, MH, ND, PREV] = process.argv;
if (!MH || !ND) { console.error('Aufruf: node tools/make-people.mjs <makehuman/data> <makehuman-data/public/data> [vorschau]'); process.exit(1); }
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
    extra: [['chin/chin-prominent-incr.target', 0.35], ['chin/chin-width-incr.target', 0.45], ['chin/chin-height-incr.target', 0.15],
      ['mouth/mouth-scale-horiz-incr.target', 0.3], ['mouth/mouth-angles-up.target', 0.35], ['mouth/mouth-lowerlip-volume-incr.target', 0.2],
      ['cheek/l-cheek-bones-incr.target', 0.35], ['cheek/r-cheek-bones-incr.target', 0.35], ['cheek/l-cheek-volume-decr.target', 0.2], ['cheek/r-cheek-volume-decr.target', 0.2],
      ['nose/nose-point-width-decr.target', 0.25], ['nose/nose-scale-vert-incr.target', 0.15], ['nose/nose-hump-decr.target', 0.3]] },
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
  'brows-m':   { body: 'm', src: 'eyebrows/eyebrow001', brow: true },
  'brows-f':   { body: 'f', src: 'eyebrows/eyebrow010', brow: true },
  'lashes-m':  { body: 'm', src: 'eyelashes/Eyelashes01', brow: true },
  'lashes-f':  { body: 'f', src: 'eyelashes/Eyelashes01', brow: true },
};
const FAB = { skin: 1, hair: 2, wool: 3, silk: 4, cotton: 5, leather: 6, fur: 7, felt: 8, straw: 9, sequin: 10, knit: 11, metal: 12, satin: 13, stock: 14 };
// Atlas: 4 x 6 Kacheln zu 512 px. Haut: Kachel je Geschlecht und Alter/Herkunft (Auswahl im Shader); Reihe 5: Spieler
const TILE = 512, AW = 4 * TILE, AH = 7 * TILE;   // V39: eine Reihe mehr
const SKIN = {
  m: ['young_caucasian_male/textures/young_lightskinned_male_diffuse.png', 'middleage_caucasian_male/textures/middleage_lightskinned_male_diffuse.png', 'old_caucasian_male/textures/old_lightskinned_male_diffuse.png', 'young_african_male/textures/young_darkskinned_male_diffuse.png'],
  f: ['young_caucasian_female/textures/young_lightskinned_female_diffuse.png', 'middleage_caucasian_female/textures/middleage_lightskinned_female_diffuse.png', 'old_caucasian_female/textures/old_lightskinned_female_diffuse.png', 'young_african_female/textures/young_darkskinned_female_diffuse.png'],
};
// Bereiche im Atlas [x, y, w, h] in Kacheln; Varianten der Anzüge werden gemalt (paintVariant)
const RECT = {
  skin_m: [0, 0, 1, 1], skin_f: [0, 1, 1, 1],                       // erste Kachel je Reihe; Reihe = Geschlecht, Spalte = Hautbild
  suit: [0, 2, 1, 1], tux: [1, 2, 1, 1], uniform: [2, 2, 1, 1], waiter: [3, 2, 1, 1],
  work: [0, 3, 1, 1], lady: [1, 3, 1, 1],
  shoes: [2, 3, 0.5, 0.5], boots: [2.5, 3, 0.5, 0.5], eyes: [2, 3.5, 0.5, 0.5], brows_m: [2.5, 3.5, 0.25, 0.25], brows_f: [2.75, 3.5, 0.25, 0.25], lashes: [2.5, 3.75, 0.5, 0.25],
  heels: [3, 3, 0.25, 0.25],
  hairA_m: [0, 4, 0.5, 0.5], hairB_m: [0.5, 4, 0.5, 0.5], hairC_m: [0, 4.5, 0.5, 0.5],
  hairA_f: [1, 4, 1, 1], hairB_f: [2, 4, 1, 1], hairC_f: [3, 4, 1, 1],
  skin_p: [0, 5, 1, 1], face_p: [1, 5, 1, 1],                      // Spieler: Körperhaut und Kopf in dreifacher Auflösung mit Gesicht
  // V39
  hairD_m: [0.5, 4.5, 0.5, 0.5], hairD_f: [2, 5, 1, 1], hairE_f: [3, 5, 1, 1],
  furcoat: [0, 6, 1, 1], fedora: [1, 6, 0.5, 0.5], shoes2: [1.5, 6, 0.5, 0.5], hairE_m: [1, 6.5, 0.5, 0.5],
};

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

// V24 · Spielerkacheln: Körperhaut (junger hellhäutiger Herr) und Kopf in dreifacher Auflösung. Ins Gesicht kommt aus dem
// Referenzbild nur die Zeichnung (Brauen, Lidfalten, Nase, Lippen, Lachfalten): Bild geteilt durch seine weichgezeichnete
// Fassung, also ohne Licht und Schatten der Aufnahme, auf die Haut gelegt. Die Lage im Bild kommt über die Merkmale (PLAYER_REF)
async function playerTiles() {
  const skinFile = sk(SKIN.m[0]);
  blit(await readRGBA(skinFile, TILE, TILE), RECT.skin_p);
  const [bx, by, bw, bh] = HEADP.box;
  const skin512 = await readRGBA(skinFile, TILE, TILE);
  const head = await sharp(skin512, { raw: { width: TILE, height: TILE, channels: 4 } }).extract({ left: bx, top: by, width: bw, height: bh })
    .resize(TILE, TILE, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
  for (let i = 3; i < head.length; i += 4) head[i] = 255;
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
  blit(head, RECT.face_p);
}
// Rasterung des Kopfes in seiner Kachel: je Texel Lage (x, y, z) und Normale (x, y, z), Deckung
function rasterRect(H, size) {
  const R = new Float32Array(size * size * 7), I = H.idx, uv = H.uv, P = H.pos, N = H.nrm;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2]; if (!H.inHead[a] || !H.inHead[b] || !H.inHead[c]) continue;
    const X = [uv[a * 2] * size, uv[b * 2] * size, uv[c * 2] * size], Y = [(1 - uv[a * 2 + 1]) * size, (1 - uv[b * 2 + 1]) * size, (1 - uv[c * 2 + 1]) * size];
    const den = (Y[1] - Y[2]) * (X[0] - X[2]) + (X[2] - X[1]) * (Y[0] - Y[2]); if (Math.abs(den) < 1e-9) continue;
    for (let py = Math.max(0, Math.floor(Math.min(...Y))); py <= Math.min(size - 1, Math.ceil(Math.max(...Y))); py++)
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
    const r = RECT['skin_' + gk]; const buf = await readRGBA(sk(list[k]), TILE, TILE);
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
    blit(buf, [r[0] + k, r[1], 1, 1]);
  }
  // Anzug und Varianten: dunkler Stoff = Farbe der Figur; Hemd, Krawatte, Knöpfe bleiben
  const suit = parts['suit-m'];
  const suitBuf = await readRGBA(suit.tex, TILE, TILE);
  const suitRaster = uvRaster(suit, TILE);
  const isCloth = (b, i) => lum(b[i], b[i + 1], b[i + 2]) < 105 && sat(b, i) < 0.35;
  const at = (i) => { const k = i; return [suitRaster[k], suitRaster[k + 1], suitRaster[k + 2], suitRaster[k + 3]]; };
  const mk = (fn) => { const b = Buffer.from(suitBuf); fn && fn(b); return b; };
  const rigM = RIG.m;
  // Krawatte: schmaler Streifen vorn in der Mitte zwischen Kragen und Bauch
  const isTie = (p) => p[3] === 1 && Math.abs(p[0]) < 0.035 && p[1] > rigM.top - 0.33 && p[1] < rigM.neck - 0.02 && p[2] > 0.05;
  const shirtCol = [236, 233, 226];
  blit(paintMask(mk(), isCloth), RECT.suit);
  // Frack: Krawatte weg (weißes Hemd, die Fliege kommt als Teil dazu), Revers in Satin dunkler
  // V24: der ganze Krawattenstreifen wird Hemd (vorher blieben die dunklen Streifen der Krawatte stehen)
  const isTieBand = (b, i, p) => isTie(p) && (!isCloth(b, i) || Math.abs(p[0]) < 0.022);
  // V32: Smoking: Hemdbrust (eigene Insel, ohne Krawatte) weiß mit feinen Biesen und drei Onyxknöpfen
  const shirtR = uvRaster(suit, TILE, (a, b, c) => TIE.inT[a] && TIE.inT[b] && TIE.inT[c]);
  const sm = meshes['suit-m'], sp = sm.pos, nS = sp.length / 3, BW = 0.01, band = y => Math.round(y / BW);
  const edge = new Map();
  for (let i = 0; i < nS; i++) {
    const x = Math.abs(sp[i * 3]), y = sp[i * 3 + 1], z = sp[i * 3 + 2];
    if (!TIE.inT[i] && sm.limb[i * 2] === 0 && z > 0.05 && y > rigM.hip) edge.set(band(y), Math.min(edge.get(band(y)) ?? 1, x));
  }
  let yBtn = rigM.hip; for (let y = rigM.hip; y < rigM.top; y += BW) { const e = edge.get(band(y)); if (e !== undefined && e < 0.012) yBtn = y; }
  let yColl = 0; for (let i = 0; i < nS; i++) if (TIE.inT[i] && Math.abs(sp[i * 3]) < 0.01) yColl = Math.max(yColl, sp[i * 3 + 1]);
  const stud = (x, y) => [0.075, 0.13, 0.185].some(o => yColl - o > yBtn + 0.01 && Math.hypot(x, y - (yColl - o)) < 0.0042);
  console.log('Smoking: oberster Knopf', yBtn.toFixed(3), 'Kragen', yColl.toFixed(3));
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) {
    const k = i, sh = [shirtR[k], shirtR[k + 1], shirtR[k + 2], shirtR[k + 3]], p = at(i);
    if (sh[3] === 1) {
      const ax = Math.abs(sh[0]), bib = ax < 0.05 && sh[1] < yColl - 0.035 ? 1 : 0;
      const pl = bib ? 0.95 + 0.05 * Math.cos(ax / 0.0065 * Math.PI * 2) : 1;
      if (stud(sh[0], sh[1])) { b[i] = 22; b[i + 1] = 22; b[i + 2] = 26; }
      else { b[i] = shirtCol[0] * pl; b[i + 1] = shirtCol[1] * pl; b[i + 2] = shirtCol[2] * pl; }
    }
  } }), isCloth), RECT.tux);
  // Uniform: Messingknöpfe zweireihig, dunkle Krawatte
  const btn = (p) => { if (p[3] !== 1 || p[2] < 0.06) return 0; for (const y of [0.0, 0.1, 0.2, 0.3]) for (const sx of [-0.055, 0.055]) { const d = Math.hypot(p[0] - sx, p[1] - (rigM.waist - 0.08 + y)); if (d < 0.011) return 1; } return 0; };
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTie(p) && !isCloth(b, i)) { b[i] = 30; b[i + 1] = 28; b[i + 2] = 32; } if (btn(p)) { b[i] = 200; b[i + 1] = 160; b[i + 2] = 80; } } }),
    (b, i) => isCloth(b, i) && !(b[i] === 200 && b[i + 1] === 160)), RECT.uniform);
  // Kellner: Jacke in Farbe der Figur, Hose schwarz, schwarze Fliege statt Krawatte
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTieBand(b, i, p)) { b[i] = shirtCol[0]; b[i + 1] = shirtCol[1]; b[i + 2] = shirtCol[2]; } if (p[3] === 1 && p[1] < rigM.hip - 0.02 && isCloth(b, i)) { b[i] = b[i + 1] = b[i + 2] = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * 0.35) | 1; } } }),
    (b, i) => isCloth(b, i) && !(b[i] & 1 && b[i] === b[i + 1] && b[i] < 40)), RECT.waiter);
  // Latzhose: der Stoff wird gefärbt, Schnallen und Knöpfe bleiben
  const work = await readRGBA(parts['work-m'].tex, TILE, TILE);
  blit(paintMask(work, (b, i) => b[i + 3] > 10 && b[i + 2] > b[i] * 1.15 && lum(b[i], b[i + 1], b[i + 2]) > 60), RECT.work);
  // Damenkostüm: dunkler Stoff gefärbt, Bluse bleibt
  const lady = await readRGBA(parts['lady-f'].tex, TILE, TILE);
  paintMask(lady, (b, i) => b[i + 3] > 10);
  for (let i = 0; i < lady.length; i += 4) lady[i] = lady[i + 1] = lady[i + 2] = Math.round(180 * 0.75 + lady[i] * 0.25);
  blit(lady, RECT.lady);
  // Schuhe
  for (const [k, part] of [['shoes', 'shoes-m'], ['boots', 'boots-m']]) { const r = rectPx(RECT[k]); const b = await readRGBA(parts[part].tex, r[2], r[3]); for (let i = 3; i < b.length; i += 4) b[i] = 255; blit(b, RECT[k]); }
  // Augen (braun; die Farbe der Iris wählt der Shader)
  { const r = rectPx(RECT.eyes); const b = await readRGBA(path.join(MH, 'eyes/materials/brown_eye.png'), r[2], r[3]); blit(b, RECT.eyes); }
  // Haare, Brauen, Wimpern: Grauwert (Strähnen) + Deckung
  for (const [k, part] of [['hairA_m', 'hairA-m'], ['hairB_m', 'hairB-m'], ['hairC_m', 'hairC-m'], ['hairA_f', 'hairA-f'], ['hairB_f', 'hairB-f'], ['hairC_f', 'hairC-f'], ['brows_m', 'brows-m'], ['brows_f', 'brows-f'], ['lashes', 'lashes-m'],
    ['hairD_m', 'hairD-m'], ['hairE_m', 'hairE-m'], ['hairD_f', 'hairD-f'], ['hairE_f', 'hairE-f']]) {
    const r = rectPx(RECT[k]); const b = await readRGBA(parts[part].tex, r[2], r[3]);
    let s = 0, c = 0; for (let i = 0; i < b.length; i += 4) if (b[i + 3] > 128) { s += lum(b[i], b[i + 1], b[i + 2]); c++; }
    const kk = c ? 0.75 * 255 / (s / c) : 1;
    for (let i = 0; i < b.length; i += 4) { const g = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * kk); b[i] = b[i + 1] = b[i + 2] = g; }
    blit(b, RECT[k]);
  }
  // Absatzschuhe: glattes Leder (Farbe kommt aus der Figur)
  { const [x0, y0, w, h] = rectPx(RECT.heels); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y0 + y) * AW + x0 + x) * 4; const g = 170 + 20 * Math.sin(x * 0.3) * Math.sin(y * 0.2); atlas[i] = atlas[i + 1] = atlas[i + 2] = g; atlas[i + 3] = 96; } }
  // V39: Fedora (Filz, Farbe der Figur bzw. des Hutes), braune Herrenschuhe, Pelzmantel (blaugrauer Stoff wird gefärbt, Pelz und Schnalle bleiben)
  { const r = rectPx(RECT.fedora); const b = await readRGBA(parts['fedora-m'].tex, r[2], r[3]); blit(paintMask(b, (bb, i) => bb[i + 3] > 10), RECT.fedora); }
  { const r = rectPx(RECT.shoes2); const b = await readRGBA(parts['shoes2-m'].tex, r[2], r[3]); for (let i = 3; i < b.length; i += 4) b[i] = 255; blit(b, RECT.shoes2); }
  { const b = await readRGBA(parts['coat-f'].tex, TILE, TILE); blit(paintMask(b, (bb, i) => bb[i + 3] > 10 && bb[i + 2] > bb[i] + 8), RECT.furcoat); }
  await playerTiles();
  // Ränder auffüllen: leere Texel bekommen die Farbe des nächsten Nachbarn (keine Säume beim Mipmapping)
  dilate(atlas, AW, AH, 4);
  await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).webp({ quality: 86, alphaQuality: 90, effort: 5 }).toFile(path.join(OUT, 'people-atlas.webp'));
  await sharp(atlas, { raw: { width: AW, height: AH, channels: 4 } }).resize(AW / 2, AH / 2, { kernel: 'lanczos3' }).webp({ quality: 82, alphaQuality: 85, effort: 5 }).toFile(path.join(OUT, 'people-atlas-m.webp'));
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
const meshes = {}, HEADP = {};
function addMesh(name, m) { meshes[name] = m; }
// Körper: Verdeckung je Kleidungsstück als Bitmaske über die Grundnetz-Ecken
const HIDEBIT = { 'suit-m': 1, 'work-m': 2, 'shoes-m': 4, 'boots-m': 8, 'lady-f': 16, 'heels-f': 32, 'coat-f': 128, 'shoes2-m': 256 };   // 64: Krawatte im Anzug (eigenes Netz)
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
  let uv, tex;
  if (gk === 'p') {
    // Spieler: Kopfinseln der UV (Gesicht, Ohren) in eine eigene Kachel in dreifacher Auflösung, der Rest in seine Hautkachel.
    // Art 6 = feste Haut (der Shader wählt keine Hautkachel nach Alter und Herkunft)
    const isl = uvIslands(U.idx, n), head = new Set();
    const cnt = new Map(), hi = new Map(); for (let i = 0; i < n; i++) { cnt.set(isl[i], (cnt.get(isl[i]) || 0) + 1); if (pos[i * 3 + 1] > RIG.m.neck - 0.02) hi.set(isl[i], (hi.get(isl[i]) || 0) + 1); }
    // die größte Kopfinsel (Gesicht, Schädel, Ohren); Mundinneres und Augenwinkel bleiben in der Hautkachel
    let best = -1, bc = 0; for (const [k, c] of cnt) if ((hi.get(k) || 0) > c * 0.8 && c > bc) { bc = c; best = k; } head.add(best);
    let u0 = 1, v0 = 1, u1 = 0, v1 = 0; for (let i = 0; i < n; i++) if (head.has(isl[i])) { u0 = Math.min(u0, U.uv[i * 2]); u1 = Math.max(u1, U.uv[i * 2]); v0 = Math.min(v0, U.uv[i * 2 + 1]); v1 = Math.max(v1, U.uv[i * 2 + 1]); }
    // auf ganze Pixel des 512er-Hautbilds runden (dann passt der Ausschnitt genau)
    const px0 = Math.max(0, Math.floor(u0 * TILE) - 2), px1 = Math.min(TILE, Math.ceil(u1 * TILE) + 2), py0 = Math.max(0, Math.floor((1 - v1) * TILE) - 2), py1 = Math.min(TILE, Math.ceil((1 - v0) * TILE) + 2);
    HEADP.box = [px0, py0, px1 - px0, py1 - py0];
    const bu0 = px0 / TILE, bu1 = px1 / TILE, bv1 = 1 - py0 / TILE, bv0 = 1 - py1 / TILE;
    const local = new Float32Array(U.uv.length), inHead = new Uint8Array(n);
    for (let i = 0; i < n; i++) { if (head.has(isl[i])) { inHead[i] = 1; local[i * 2] = (U.uv[i * 2] - bu0) / (bu1 - bu0); local[i * 2 + 1] = (U.uv[i * 2 + 1] - bv0) / (bv1 - bv0); } else { local[i * 2] = U.uv[i * 2]; local[i * 2 + 1] = U.uv[i * 2 + 1]; } }
    const a = toAtlasUV(local, RECT.face_p), b = toAtlasUV(local, RECT.skin_p);
    uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const s2 = inHead[i] ? a : b; uv[i * 2] = s2[i * 2]; uv[i * 2 + 1] = s2[i * 2 + 1]; }
    tex = new Float32Array(n).fill(6);
    Object.assign(HEADP, { pos, nrm, uv: local, inHead, idx: U.idx });
  } else { uv = toAtlasUV(U.uv, RECT['skin_' + gk]); tex = new Float32Array(n).fill(2); }   // Haut: erste Kachel; Shader verschiebt je Figur
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
    'fedora-m': 'fedora', 'fedora2-m': 'fedora', 'coat-f': 'furcoat', 'shoes2-m': 'shoes2' }[name] || name.replace('-', '_');
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

// V39: Höhen von Hüten und Frisuren über der Kopfmitte (Haar unter dem Hut wird im Shader nur um 10 % gestaucht)
for (const k of ['fedora-m', 'fedora2-m', 'hairA-m', 'hairB-m', 'hairC-m', 'hairD-m', 'hairE-m', 'hairA-f', 'hairB-f', 'hairD-f', 'hairE-f']) { const m = meshes[k]; if (!m) continue; let y = -1e9, r = 0; const hc = RIG[k.endsWith('-f') ? 'f' : 'm'].headC; for (let i = 0; i < m.pos.length; i += 3) { y = Math.max(y, m.pos[i + 1]); if (m.pos[i + 1] > hc + 0.02) r = Math.max(r, Math.hypot(m.pos[i], m.pos[i + 2] - RIG.m.headZ)); } console.log(k, 'oben', (y - hc).toFixed(3), 'Radius', r.toFixed(3)); }
/* ---------------- Detailstufe 1: vereinfacht ---------------- */
function simplify(m, ratio, err = 0.02) {
  const target = Math.max(3, Math.floor(m.idx.length * ratio / 3) * 3);
  const [ix] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, err, []);
  return { ...m, idx: ix };
}
// Ziel: höchstens etwa 6000 Dreiecke je Figur in der mittleren Stufe (bis 45 m stehen oft hunderte Figuren);
// Haare dürfen gröber werden (Fehler 0.05), in dem Abstand sieht man nur noch die Form
const LOD1 = { 'shirt-m': 0.5, 'body-m': 0.15, 'body-f': 0.15, 'body-p': 0.3, 'suit-m': 0.18, 'work-m': 0.25, 'lady-f': 0.3, 'shoes-m': 0.15, 'boots-m': 0.2, 'heels-f': 0.25, 'eyes-m': 1, 'eyes-f': 1,
  'hairA-m': 0.3, 'hairB-m': 0.4, 'hairC-m': 0.25, 'hairA-f': 0.3, 'hairB-f': 0.15, 'hairC-f': 0.2,
  'hairD-m': 0.3, 'hairE-m': 0.2, 'hairD-f': 0.2, 'hairE-f': 0.15, 'fedora-m': 0.3, 'fedora2-m': 0.3, 'coat-f': 0.18, 'shoes2-m': 0.15 };
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
