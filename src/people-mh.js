/* =====================================================================
   V22 · MENSCHEN AUS MAKEHUMAN: echte Körper (Grundnetz hm08, CC0) mit
   Fotohaut, Kleidung, Haaren, Augen, Brauen und Wimpern. tools/make-people.mjs
   bringt sie in die Ruhehaltung des Spiels und schreibt je Ecke Glied,
   Mischgewicht und Stoffart; der Shader (people-skeleton.js) bewegt sie wie
   die gebauten Figuren: Gehen, Tanzen, Sitzen, Arbeiten, Ragdoll.
   Hüte, Requisiten, Werkzeuge, Mäntel, Abend- und Charlestonkleider kommen
   weiter aus personBuild und werden auf den neuen Körper gesetzt.
   ===================================================================== */
import { T, MOBILE, ANISO } from './core.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { resolveAsset, assetStats } from './assets.js';
import { HRIG } from './people-skeleton.js';
import { PB, personBuild, personMerge, HATMASK, FAB } from './people-model.js';

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
export const MH_KIND = {
  suit:      { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'suit', keep: ['hat', 'carry', 'props'] },
  tux:       { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'tux', color: [0.025, 0.025, 0.03], keep: ['bow', 'props'] },
  livery:    { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'uniform', keep: ['hat', 'props'] },
  police:    { g: 'm', parts: ['suit-m', 'boots-m'], tile: 'uniform', keep: ['hat', 'props'] },
  chauffeur: { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'uniform', keep: ['hat', 'props'] },
  waiter:    { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'waiter', keep: ['bow', 'carry', 'props'] },
  coat:      { g: 'm', parts: ['suit-m', 'shoes-m'], tile: 'suit', keep: ['body', 'hat', 'carry', 'props'], coat: true, cover: { from: 0.48, to: 1.45, mg: 0.022 } },
  worker:    { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'props'] },
  sailor:    { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'props'] },
  kid:       { g: 'm', parts: ['work-m', 'boots-m'], tile: 'work', keep: ['hat', 'carry', 'props'] },
  lady:      { g: 'f', parts: ['lady-f', 'heels-f'], tile: 'lady', keep: ['hat', 'carry', 'props'] },
  gown:      { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.02, to: 1.366, mg: 0.012 }, gloves: GLOVE_SATIN, longGloves: true },
  dress:     { g: 'f', parts: ['heels-f'], keep: ['body', 'hat', 'props'], cover: { from: 0.42, to: 1.366, mg: 0.01 } },
};
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

// Kragen vorn (für Fliegen): höchster Punkt des Hemdkragens in der Mitte
const collarCache = {};
function collarFront(gk) {
  if (collarCache[gk]) return collarCache[gk];
  const s = MHP.src['suit-m'], r = HRIG[gk]; let best = null;
  if (s) for (let i = 0; i < s.count; i++) { const x = s.position[i * 3], y = s.position[i * 3 + 1], z = s.position[i * 3 + 2]; if (Math.abs(x) < 0.012 && y > r.top - 0.02 && y < r.neck + 0.03 && z > 0.03 && (!best || y > best[1])) best = [x, y, z]; }
  return (collarCache[gk] = best || [0, r.neck - 0.03, 0.07]);
}

/* ---------- Eine Art zusammensetzen ---------- */
export function mhPersonGeo(kind, q) {
  const K = MH_KIND[kind] || MH_KIND.suit, gk = K.g, rig = HRIG[gk], fine = q > 1.5, lod = fine ? '' : '@1';
  const S = n => MHP.src[n + lod] || MHP.src[n];
  const meta = MHP.meta, RECT = meta.atlas.rect, AW = meta.atlas.w, AH = meta.atlas.h, TILE = meta.atlas.tile, hm = HATMASK[kind] || 0;
  // Zubehör aus personBuild (Hüte, Requisiten, Werkzeuge, Mäntel und Kleider)
  PB.mh = { rig, gloves: null }; let parts;
  try { parts = personBuild(kind, q); } finally { K._gloves = PB.mh.gloves; PB.mh = null; }
  const keep = parts.filter(p => K.keep.includes(p[6]));
  const procHC = gk === 'f' ? 1.58 : 1.62, cf = collarFront(gk);
  for (const p of keep) {
    const g = p[0];
    if (p[6] === 'hat') g.translate(0, rig.headC - procHC, rig.headZ - 0.004);
    else if (p[6] === 'bow') g.translate(0, cf[1] - 0.028 - 1.474, cf[2] + 0.004 - 0.066);
    if (p[2] >= 3 && p[2] <= 8 && p[2] !== 5 && p[2] !== 6) p[3] = rig.top;     // Arm-Glieder drehen an der MakeHuman-Schulter
  }
  const bodySrc = S('body-' + gk), coverParts = keep.filter(p => p[6] === 'body');
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
      if (glove && src._reg && (src._reg[i] === 6 || (K.longGloves && src._reg[i] === 5)) && o.isBody) { c = glove; tk = 0; fab = glove === GLOVE_SATIN ? FAB.satin : FAB.leather; }
      A.pos.push(src.position[i * 3], src.position[i * 3 + 1], src.position[i * 3 + 2]);
      A.nrm.push(src.normal[i * 3], src.normal[i * 3 + 1], src.normal[i * 3 + 2]);
      A.uv.push(-1, -1); A.col.push(c[0], c[1], c[2]);
      A.limb.push(src._limb[i * 2], src._limb[i * 2 + 1]); A.opt.push(src._opt[i]);
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
  add(bodySrc, { isBody: true, drop: i => (bodySrc._hide[i] & mask) !== 0 || (inCover(bodySrc, i) && bodySrc._reg[i] !== 4 && bodySrc._reg[i] !== 5 && bodySrc._reg[i] !== 6 && bodySrc._reg[i] !== 1) });
  add(S('eyes-' + gk));
  for (const h of ['A', 'B', 'C']) add(S(`hair${h}-${gk}`));
  if (fine) { add(S('brows-' + gk)); add(S('lashes-' + gk)); }
  for (const pn of K.parts) {
    const src = S(pn); if (!src) continue;
    const o = {};
    if (pn === 'heels-f') o.color = [0.05, 0.04, 0.045];
    else if (pn === 'shoes-m' || pn === 'boots-m') o.color = NOPAINT;
    else {
      const baseTile = pn === 'suit-m' ? 'suit' : pn === 'work-m' ? 'work' : 'lady', t = K.tile || baseTile;
      if (t !== baseTile) { o.du = (RECT[t][0] - RECT[baseTile][0]) * TILE / AW; o.dv = -(RECT[t][1] - RECT[baseTile][1]) * TILE / AH; }
      o.color = K.color || [1, 1, 1];
      if (K.coat && pn === 'suit-m') {
        // unter dem Mantel: Ärmel in Mantelfarbe, Hose dunkel; was der Mantel verdeckt, fällt weg
        o.color = i => { const l = src._limb[i * 2]; return (l > 2.5 && l < 4.5) || l > 6.5 ? [1, 1, 1] : DARK_TROUSERS; };
        o.drop = i => { const l = src._limb[i * 2]; return inCover(src, i) && !((l > 2.5 && l < 4.5) || l > 6.5); };
      }
    }
    add(src, o);
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
