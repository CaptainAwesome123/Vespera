// V22 · Figuren aus MakeHuman (CC0): Körper, Kleidung, Haare, Augen, Brauen, Wimpern.
// Baut assets/people/people.glb (Netze in der Ruhehaltung des Spiels, mit Glied-Zuordnung),
// assets/people/people-atlas.webp (+ -m für Handys: Haut, Stoffe, Haare in einem Bild) und
// assets/people/people.json (Gelenkpunkte, Netze je Art, Atlas-Einteilung).
//
// Aufruf: node tools/make-people.mjs <makehuman/data> <makehuman-data/public/data> [vorschau-ordner]
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
};
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
  'brows-m':   { body: 'm', src: 'eyebrows/eyebrow001', brow: true },
  'brows-f':   { body: 'f', src: 'eyebrows/eyebrow010', brow: true },
  'lashes-m':  { body: 'm', src: 'eyelashes/Eyelashes01', brow: true },
  'lashes-f':  { body: 'f', src: 'eyelashes/Eyelashes01', brow: true },
};
const FAB = { skin: 1, hair: 2, wool: 3, silk: 4, cotton: 5, leather: 6, fur: 7, felt: 8, straw: 9, sequin: 10, knit: 11, metal: 12, satin: 13, stock: 14 };
// Atlas: 4 x 5 Kacheln zu 512 px. Haut: Kachel je Geschlecht und Alter/Herkunft (Auswahl im Shader)
const TILE = 512, AW = 4 * TILE, AH = 5 * TILE;
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
  const lp = readMhcloEyes();
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
for (const gk in bodies) shiftY(bodies[gk].pos, lift[gk]);
for (const k in parts) shiftY(parts[k].pos, lift[parts[k].def.body]);

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
    kn: ['finger3-1.R', 'finger3-2.R'].map(b => { const pp = B.P.pose[b], j = M.jointPos(skel, v, skel.bones[b].head).map(x => x * 0.1); const q = F.add(pp.T, F.mv(pp.R, F.sub(j, pp.P))); return +(wr[1] - (q[1] + L)).toFixed(4); }) };
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
function limbAttrs(ws, pos, gk) {
  const rig = RIG[gk], n = ws.length, limb = new Float32Array(n * 2), blend = new Float32Array(n), reg = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const lb = F.limbBlend(ws[i]), p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    limb[i * 2] = lb.limb;
    limb[i * 2 + 1] = lb.limb === 0 ? 0 : (lb.limb === 1 || lb.limb === 2 || lb.limb === 5 || lb.limb === 6) ? rig.hip : rig.top;
    blend[i] = lb.limb ? lb.w : 0;
    reg[i] = regionOf(ws[i], p, rig);
  }
  return { limb, blend, reg };
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
function uvRaster(P, size) {
  const R = new Float32Array(size * size * 4).fill(NaN);
  const { pos, U } = P, uv = U.uv, I = U.idx;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2];
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
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTie(p) && !isCloth(b, i)) { b[i] = shirtCol[0]; b[i + 1] = shirtCol[1]; b[i + 2] = shirtCol[2]; } } }), isCloth), RECT.tux);
  // Uniform: Messingknöpfe zweireihig, dunkle Krawatte
  const btn = (p) => { if (p[3] !== 1 || p[2] < 0.06) return 0; for (const y of [0.0, 0.1, 0.2, 0.3]) for (const sx of [-0.055, 0.055]) { const d = Math.hypot(p[0] - sx, p[1] - (rigM.waist - 0.08 + y)); if (d < 0.011) return 1; } return 0; };
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTie(p) && !isCloth(b, i)) { b[i] = 30; b[i + 1] = 28; b[i + 2] = 32; } if (btn(p)) { b[i] = 200; b[i + 1] = 160; b[i + 2] = 80; } } }),
    (b, i) => isCloth(b, i) && !(b[i] === 200 && b[i + 1] === 160)), RECT.uniform);
  // Kellner: Jacke in Farbe der Figur, Hose schwarz, schwarze Fliege statt Krawatte
  blit(paintMask(mk(b => { for (let i = 0; i < b.length; i += 4) { const p = at(i); if (isTie(p) && !isCloth(b, i)) { b[i] = shirtCol[0]; b[i + 1] = shirtCol[1]; b[i + 2] = shirtCol[2]; } if (p[3] === 1 && p[1] < rigM.hip - 0.02 && isCloth(b, i)) { b[i] = b[i + 1] = b[i + 2] = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * 0.35) | 1; } } }),
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
  for (const [k, part] of [['hairA_m', 'hairA-m'], ['hairB_m', 'hairB-m'], ['hairC_m', 'hairC-m'], ['hairA_f', 'hairA-f'], ['hairB_f', 'hairB-f'], ['hairC_f', 'hairC-f'], ['brows_m', 'brows-m'], ['brows_f', 'brows-f'], ['lashes', 'lashes-m']]) {
    const r = rectPx(RECT[k]); const b = await readRGBA(parts[part].tex, r[2], r[3]);
    let s = 0, c = 0; for (let i = 0; i < b.length; i += 4) if (b[i + 3] > 128) { s += lum(b[i], b[i + 1], b[i + 2]); c++; }
    const kk = c ? 0.75 * 255 / (s / c) : 1;
    for (let i = 0; i < b.length; i += 4) { const g = Math.min(255, lum(b[i], b[i + 1], b[i + 2]) * kk); b[i] = b[i + 1] = b[i + 2] = g; }
    blit(b, RECT[k]);
  }
  // Absatzschuhe: glattes Leder (Farbe kommt aus der Figur)
  { const [x0, y0, w, h] = rectPx(RECT.heels); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y0 + y) * AW + x0 + x) * 4; const g = 170 + 20 * Math.sin(x * 0.3) * Math.sin(y * 0.2); atlas[i] = atlas[i + 1] = atlas[i + 2] = g; atlas[i + 3] = 96; } }
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
const meshes = {};
function addMesh(name, m) { meshes[name] = m; }
// Körper: Verdeckung je Kleidungsstück als Bitmaske über die Grundnetz-Ecken
const HIDEBIT = { 'suit-m': 1, 'work-m': 2, 'shoes-m': 4, 'boots-m': 8, 'lady-f': 16, 'heels-f': 32 };
for (const [gk, B] of Object.entries(bodies)) {
  const { U, pos } = B, n = U.vid.length, ws = U.vid.map(b => W[b]);
  const la = limbAttrs(ws, pos, gk);
  const hide = new Uint16Array(n);
  for (const [pn, bit] of Object.entries(HIDEBIT)) { const P = parts[pn]; if (!P || P.def.body !== gk || !P.del) continue; for (let i = 0; i < n; i++) if (P.del[U.vid[i]]) hide[i] |= bit; }
  const uv = toAtlasUV(U.uv, RECT['skin_' + gk]);    // Haut: erste Kachel; Shader verschiebt je Figur
  const tex = new Float32Array(n).fill(2);
  const soft = new Float32Array(n * 3); for (let i = 0; i < n; i++) soft[i * 3] = FAB.skin;
  addMesh('body-' + gk, { pos, nrm: normals(pos, U.idx, U.vid), uv, tex, idx: U.idx, limb: la.limb, blend: la.blend, reg: la.reg, soft, opt: new Float32Array(n), hide });
  // Augen
  const eyes = eyeMesh(B, gk); addMesh('eyes-' + gk, eyes);
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
  const rk = { 'suit-m': 'suit', 'work-m': 'work', 'shoes-m': 'shoes', 'boots-m': 'boots', 'lady-f': 'lady', 'brows-m': 'brows_m', 'brows-f': 'brows_f', 'lashes-m': 'lashes', 'lashes-f': 'lashes' }[name] || name.replace('-', '_');
  const uv = toAtlasUV(P.U.uv, RECT[rk]);
  const kindTex = def.hair ? 3 : def.brow ? 5 : 1;
  const soft = new Float32Array(n * 3), opt = new Float32Array(n);
  const fab = def.hair || def.brow ? FAB.hair : FAB[def.fab];
  const rig = RIG[gk];
  // Bubikopf mit geradem Pony: was vor dem Gesicht unter die Brauen fällt, wird auf Brauenhöhe gekürzt
  if (def.bangs) { const cut = rig.eye[1] + 0.032, zf = rig.eye[2] - 0.035;
    for (let i = 0; i < n; i++) { const x = P.pos[i * 3], y = P.pos[i * 3 + 1], z = P.pos[i * 3 + 2]; if (z > zf && Math.abs(x) < 0.082 && y < cut && y > rig.eye[1] - 0.2) P.pos[i * 3 + 1] = cut + (y - cut) * 0.04; } }
  for (let i = 0; i < n; i++) {
    soft[i * 3] = fab;
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
  addMesh(name, { pos: P.pos, nrm: normals(P.pos, P.U.idx, P.U.vid), uv, tex: new Float32Array(n).fill(kindTex), idx, limb: la.limb, blend: la.blend, reg: la.reg, soft, opt });
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

/* ---------------- Detailstufe 1: vereinfacht ---------------- */
function simplify(m, ratio, err = 0.02) {
  const target = Math.max(3, Math.floor(m.idx.length * ratio / 3) * 3);
  const [ix] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, err, []);
  return { ...m, idx: ix };
}
// Ziel: höchstens etwa 6000 Dreiecke je Figur in der mittleren Stufe (bis 45 m stehen oft hunderte Figuren);
// Haare dürfen gröber werden (Fehler 0.05), in dem Abstand sieht man nur noch die Form
const LOD1 = { 'body-m': 0.15, 'body-f': 0.15, 'suit-m': 0.18, 'work-m': 0.25, 'lady-f': 0.3, 'shoes-m': 0.15, 'boots-m': 0.2, 'heels-f': 0.25, 'eyes-m': 1, 'eyes-f': 1,
  'hairA-m': 0.3, 'hairB-m': 0.4, 'hairC-m': 0.25, 'hairA-f': 0.3, 'hairB-f': 0.15, 'hairC-f': 0.2 };
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
