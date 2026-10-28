// MakeHuman-Daten lesen: Grundnetz (hm08), Ziele (Targets), Skelett, Gewichte, Proxies (Kleidung, Haare).
// Alle Werte in MakeHuman-Einheiten (1 = 1 dm); die Umrechnung in Meter passiert in fit.mjs.
import fs from 'node:fs';
import path from 'node:path';

export function readObj(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const v = [], vt = [], faces = []; let group = '';
  for (const line of txt.split('\n')) {
    if (line.startsWith('v ')) { const p = line.split(/\s+/); v.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith('vt ')) { const p = line.split(/\s+/); vt.push(+p[1], +p[2]); }
    else if (line.startsWith('g ')) group = line.slice(2).trim();
    else if (line.startsWith('f ')) {
      const p = line.trim().split(/\s+/).slice(1).map(s => s.split('/').map(x => +x - 1));
      faces.push({ v: p.map(a => a[0]), t: p.map(a => a[1]), g: group });
    }
  }
  return { v: Float64Array.from(v), vt: Float64Array.from(vt), faces };
}

// Target-Datei: "index dx dy dz" je Zeile
export function readTarget(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line || line[0] === '#') continue;
    const p = line.trim().split(/\s+/); if (p.length < 4) continue;
    out.push([+p[0], +p[1], +p[2], +p[3]]);
  }
  return out;
}
export function applyTarget(v, t, w) { if (!w) return; for (const [i, x, y, z] of t) { v[i * 3] += x * w; v[i * 3 + 1] += y * w; v[i * 3 + 2] += z * w; } }

// Makro wie in MakeHuman: Geschlecht, Alter, Muskel, Gewicht, Herkunft (Anteile)
export function macroBody(MH, base, o) {
  const v = Float64Array.from(base.v);
  const T = n => readTarget(path.join(MH, 'targets/macrodetails', n + '.target'));
  const g = o.female ? 'female' : 'male', age = o.age || 'young';
  const mus = o.muscle || 'averagemuscle', wt = o.weight || 'averageweight';
  applyTarget(v, T(`universal-${g}-${age}-${mus}-${wt}`), 1);
  for (const [eth, w] of Object.entries(o.ethnic || { caucasian: 1 })) applyTarget(v, T(`${eth}-${g}-${age}`), w);
  for (const [file, w] of o.extra || []) applyTarget(v, readTarget(path.join(MH, 'targets', file)), w);
  return v;
}

export function readSkeleton(MH) {
  const s = JSON.parse(fs.readFileSync(path.join(MH, 'rigs/default.mhskel'), 'utf8'));
  const w = JSON.parse(fs.readFileSync(path.join(MH, 'rigs/default_weights.mhw'), 'utf8')).weights;
  return { bones: s.bones, joints: s.joints, weights: w };
}
export function jointPos(skel, v, name) {
  const ids = skel.joints[name]; let x = 0, y = 0, z = 0;
  for (const i of ids) { x += v[i * 3]; y += v[i * 3 + 1]; z += v[i * 3 + 2]; }
  return [x / ids.length, y / ids.length, z / ids.length];
}
export function bonePos(skel, v, b) { const B = skel.bones[b]; return [jointPos(skel, v, B.head), jointPos(skel, v, B.tail)]; }

// Gewichte je Ecke als Liste [knochen, gewicht]
export function vertexWeights(skel, nv) {
  const W = Array.from({ length: nv }, () => []);
  for (const [b, list] of Object.entries(skel.weights)) for (const [i, w] of list) if (i < nv) W[i].push([b, w]);
  return W;
}

// Proxy im three.js-JSON-Format (npm makehuman-data): ref_vIdxs, weights, offsets, vertices, uvs, faces
export function readProxy(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const faces = parseFaces(d.faces, d.uvs.length);
  return { name: path.basename(file, '.json'), ref: d.ref_vIdxs, w: d.weights, off: d.offsets, scale: d.scale ?? 1, uv: d.uvs[0] || [], faces, meta: d.metadata || {}, mat: (d.materials || [])[0] || {}, dir: path.dirname(file), raw: d };
}
// three.js-JSON-Flächen (Format 3): Bitmaske je Fläche
function parseFaces(F, nUvLayers) {
  const out = []; let i = 0;
  while (i < F.length) {
    const t = F[i++], quad = t & 1, nvx = quad ? 4 : 3;
    const vv = F.slice(i, i + nvx); i += nvx;
    if (t & 2) i++;                      // Material
    if (t & 4) i += nUvLayers;           // Flächen-UV
    let uu = null;
    if (t & 8) { uu = F.slice(i, i + nvx); i += nvx * nUvLayers; }
    if (t & 16) i++; if (t & 32) i += nvx; if (t & 64) i++; if (t & 128) i += nvx;
    out.push({ v: vv, t: uu || vv });
  }
  return out;
}
// Proxy auf ein verformtes Grundnetz setzen: Summe der drei Bezugsecken plus Versatz
export function fitProxy(px, v) {
  const n = px.ref.length, out = new Float64Array(n * 3);
  for (let k = 0; k < n; k++) {
    const [a, b, c] = px.ref[k], [wa, wb, wc] = px.w[k], o = px.off[k];
    for (let d = 0; d < 3; d++) out[k * 3 + d] = wa * v[a * 3 + d] + wb * v[b * 3 + d] + wc * v[c * 3 + d] + (o ? o[d] * px.scale : 0);
  }
  return out;
}
