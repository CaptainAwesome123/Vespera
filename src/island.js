import { shared, pick, R, rand, mulberry32, MOBILE, T, U, mergeGeos, scene } from './core.js';
import { addCollider, stdMat } from './people-skeleton.js';
import { STONES, addSeg, lamps, trees, addNeon, addGlow, NEON } from './facade-shader.js';
import { BRICK, isFactoryZone, snapArrays, buildBlock, buildFactory } from './shops.js';
import { pickW, DOORS } from './entrances.js';
import { WATER_Y } from './dance.js';
import { kit, ROAD_W, wuv, Bx, VIA } from './harbour.js';
import { GRASS, streetDetail, slabTextures } from './serpentine.js';
import { TRAM_LINES } from './traffic.js';

/* =====================================================================
   STADTPLAN: Raster aus Avenuen (Nord–Süd) und Straßen (Ost–West),
   Belmont-Platz in der Mitte, Grande Promenade nach Süden zum Hafen.
   ===================================================================== */
export const AV = []; for (let x = -990; x <= 990; x += 110) AV.push({ x, w: x === 0 ? 44 : 22 });
export const ST = []; for (let z = -980; z <= 490; z += 70) ST.push({ z, w: z === 490 ? 30 : 14 });
export const PLAZA = { x0: -99, x1: 99, z0: -133, z1: 133 };
export const MEDIAN = { x0: -8, x1: 8, z0: 137, z1: 471 };
export const QUAY = { z0: 505, z1: 535 };
export const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
export const blocks = [];
/* =====================================================================
   V16 · DIE INSEL: geschwungene Uferlinie statt Rechteck, Ringstraße am Ufer,
   gebogene Häuserzeilen in den Randvierteln, Straßennetz für den Verkehr
   ===================================================================== */
export const ISL = { cx: 0, cz: -252, a: 1045, bn: 792, bs: 905, n: 3.0, quay: 535 };
// Uferradius je Richtung (0 = Norden): Superellipse mit sanften Buchten und Landzungen; der Norden am Viadukt bleibt gerade
export function coastR(th) {
  const c = Math.sin(th), s = -Math.cos(th), b = s < 0 ? ISL.bn : ISL.bs;
  const r = 1 / Math.pow(Math.pow(Math.abs(c) / ISL.a, ISL.n) + Math.pow(Math.abs(s) / b, ISL.n), 1 / ISL.n);
  const k = 1 - Math.exp(-((th / 0.55) ** 2));
  const nz = 0.034 * Math.sin(3 * th + 0.7) + 0.024 * Math.sin(5 * th + 2.1) + 0.017 * Math.sin(8 * th + 4.0) + 0.009 * Math.sin(13 * th + 1.3);
  return r * (1 + nz * k);
}
// Abstand zum Ufer (positiv = an Land), näherungsweise radial; im Süden begrenzt die gerade Hafenkante
export function landDist(x, z) {
  const dx = x - ISL.cx, dz = z - ISL.cz, th = Math.atan2(dx, -dz);
  return Math.min(coastR(th) - Math.hypot(dx, dz), ISL.quay - z);
}
export const onIsland = (x, z, m = 0) => landDist(x, z) > m;
// Uferlinie als geschlossener Linienzug (von Süden über Westen, Norden, Osten), Punkte etwa alle step Meter
export function coastLine(step = 8) {
  const pts = [];
  for (let th = -Math.PI; th < Math.PI;) {
    const r = coastR(th);
    pts.push([ISL.cx + Math.sin(th) * r, Math.min(ISL.quay, ISL.cz - Math.cos(th) * r)]);
    th += step / Math.max(200, r);
  }
  return pts;
}
export const COAST = coastLine(6);
export const QX = (() => { const q = COAST.filter(p => p[1] >= ISL.quay - 0.01); return [Math.min(...q.map(p => p[0])), Math.max(...q.map(p => p[0]))]; })();
export const KEEP = 118;   // Rasterblöcke bleiben nur, wenn alle Ecken so weit vom Ufer liegen

/* ---------- Straßennetz: Raster, Ringstraße am Ufer und Querstraßen dazwischen ---------- */
export const NET = { nodes: [], edges: [], arcs: [], grid: new Map() };
export const RING_OFF = 25, RING_W = 16, WALK_W = 4.5;
export function polyLen(p) { let L = 0; for (let k = 1; k < p.length; k++) L += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return L; }
export function resample(p, step) {
  const out = [p[0]]; let acc = 0;
  for (let k = 1; k < p.length; k++) {
    let [ax, az] = p[k - 1]; const [bx, bz] = p[k]; let L = Math.hypot(bx - ax, bz - az);
    while (acc + L >= step) { const t = (step - acc) / L; ax += (bx - ax) * t; az += (bz - az) * t; out.push([ax, az]); L = Math.hypot(bx - ax, bz - az); acc = 0; }
    acc += L;
  }
  const e = p[p.length - 1], o = out[out.length - 1];
  if (Math.hypot(e[0] - o[0], e[1] - o[1]) > step * 0.3) out.push(e.slice()); else out[out.length - 1] = e.slice();
  return out;
}
// kubische Bézierkurve zwischen zwei Punkten mit Richtungen (Anschlüsse, Abbiegebögen)
export function bez(a, ta, b, tb, n = 10, k = 0.4) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * k, c1 = [a[0] + ta[0] * L, a[1] + ta[1] * L], c2 = [b[0] - tb[0] * L, b[1] - tb[1] * L], out = [];
  for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1]]); }
  return out;
}
export function segHit(ax, az, dx, dz, p, q) {
  const ex = q[0] - p[0], ez = q[1] - p[1], den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return -1;
  const s = ((p[0] - ax) * ez - (p[1] - az) * ex) / den, t = ((p[0] - ax) * dz - (p[1] - az) * dx) / den;
  return t >= 0 && t <= 1 && s > 0 ? s : -1;
}
// Seitenvektor eines Linienzugs an Punkt k (nach rechts in Fahrtrichtung)
export function polyNormal(P, k) {
  const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
}
export function offsetPoly(P, d) { return P.map((p, k) => { const n = polyNormal(P, k); return [p[0] + n[0] * d, p[1] + n[1] * d]; }); }
export function buildNetwork() {
  const keep = new Set(blocks.map(b => b.i + ',' + b.j)), has = (i, j) => keep.has(i + ',' + j);
  const grid = NET.grid;
  const node = (x, z, kind, o = {}) => { const n = { id: NET.nodes.length, x, z, kind, e: [], ...o }; NET.nodes.push(n); return n; };
  const edge = (a, b, pts, w, off, kind = 'grid') => { const e = { id: NET.edges.length, a: a.id, b: b.id, pts, w, off, kind, len: polyLen(pts) }; NET.edges.push(e); a.e.push(e.id); b.e.push(e.id); return e; };
  for (let i = 0; i < AV.length; i++) for (let j = 0; j < ST.length; j++) {
    if (!(has(i - 1, j - 1) || has(i, j - 1) || has(i - 1, j) || has(i, j))) continue;
    const x = AV[i].x, z = ST[j].z;
    if (Math.abs(x) < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1) continue;
    grid.set(i + ',' + j, node(x, z, 'grid', { gi: i, gj: j }));
  }
  const G = (i, j) => grid.get(i + ',' + j);
  const offAV = a => a.x === 0 ? 15 : a.w / 4, offST = s => s.w / 4;
  for (let i = 0; i < AV.length; i++) for (let j = 0; j < ST.length; j++) {
    const n = G(i, j); if (!n) continue;
    const e1 = G(i + 1, j); if (e1 && (has(i, j - 1) || has(i, j) || j === ST.length - 1)) edge(n, e1, [[n.x, n.z], [e1.x, e1.z]], ST[j].w, offST(ST[j]));
    const s1 = G(i, j + 1); if (s1 && (has(i - 1, j) || has(i, j))) edge(n, s1, [[n.x, n.z], [s1.x, s1.z]], AV[i].w, offAV(AV[i]));
  }
  // Ringstraße: zwei Bögen (West und Ost) im Abstand vom Ufer; im Norden liegt der Viadukt, im Süden die Hafenstraße
  const arc = sgn => {
    const pts = [];
    for (let th = 0.05; th < Math.PI; th += 0.003) {
      const t = sgn * th, r = coastR(t) - RING_OFF, x = ISL.cx + Math.sin(t) * r, z = ISL.cz - Math.cos(t) * r;
      if (z < ST[0].z - 2) continue;
      if (z > ST[ST.length - 1].z - 22) break;
      pts.push([x, z]);
    }
    return resample(pts, 6);
  };
  const nearest = (p, filt) => { let best = null, bd = 1e18; for (const n of grid.values()) { if (!filt(n)) continue; const d = (n.x - p[0]) ** 2 + (n.z - p[1]) ** 2; if (d < bd) { bd = d; best = n; } } return best; };
  const dir = (a, b) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const northEnds = [];
  for (const sgn of [-1, 1]) {
    const pts = arc(sgn), hits = [];
    // Querstraßen: vom äußeren Rasterknoten geradeaus bis zum Ring
    for (const n of grid.values()) {
      const i = n.gi, j = n.gj;
      if (j === 0 || j === ST.length - 1) continue;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (G(i + di, j + dj)) continue;
        const side = di ? [[i + (di > 0 ? 0 : -1), j - 1], [i + (di > 0 ? 0 : -1), j]] : [[i - 1, j + (dj > 0 ? 0 : -1)], [i, j + (dj > 0 ? 0 : -1)]];
        if (side.some(([a, b]) => has(a, b))) continue;
        let best = -1, bk = -1;
        for (let k = 1; k < pts.length; k++) { const s = segHit(n.x, n.z, di, dj, pts[k - 1], pts[k]); if (s > 0 && (best < 0 || s < best)) { best = s; bk = k; } }
        if (best < 12 || best > 230) continue;
        const hx = n.x + di * best, hz = n.z + dj * best;
        if (blocks.some(b => hx > b.x0 - 8 && hx < b.x1 + 8 && hz > b.z0 - 8 && hz < b.z1 + 8)) continue;
        hits.push({ n, k: bk, x: hx, z: hz, w: di ? ST[j].w : AV[i].w, off: di ? offST(ST[j]) : offAV(AV[i]) });
      }
    }
    // nur jede zweite Querstraße, damit Platz für Häuser und Gärten bleibt
    hits.sort((a, b) => a.k - b.k);
    const use = hits.filter((h, q) => q % 2 === 0 || q === hits.length - 1);
    const P = pts.map(p => p.slice());
    for (let q = use.length - 1; q >= 0; q--) { const h = use[q]; P.splice(h.k, 0, [h.x, h.z]); h.p = P[h.k]; }
    const ringNodes = [{ idx: 0, n: node(P[0][0], P[0][1], 'ring') }];
    for (let k = 1; k < P.length - 1; k++) { const h = use.find(m => m.p === P[k]); if (h) { const rn = node(h.x, h.z, 'ring'); ringNodes.push({ idx: k, n: rn }); edge(h.n, rn, [[h.n.x, h.n.z], [h.x, h.z]], h.w, h.off, 'link'); } }
    ringNodes.push({ idx: P.length - 1, n: node(P[P.length - 1][0], P[P.length - 1][1], 'ring') });
    for (let k = 1; k < ringNodes.length; k++) { const A = ringNodes[k - 1], B = ringNodes[k]; edge(A.n, B.n, P.slice(A.idx, B.idx + 1), RING_W, 4, 'ring'); }
    // Enden: an die Nordstraße und an die Hafenstraße anschließen
    const r0 = ringNodes[0].n, r1 = ringNodes[ringNodes.length - 1].n;
    const nN = nearest(P[0], n => n.gj === 0 && Math.sign(n.x || sgn) === sgn && Math.abs(n.x) < Math.abs(P[0][0]) - 20);
    const nS = nearest(P[P.length - 1], n => n.gj === ST.length - 1 && Math.sign(n.x || sgn) === sgn && Math.abs(n.x) < Math.abs(P[P.length - 1][0]) - 20);
    if (nN) edge(nN, r0, bez([nN.x, nN.z], [sgn, 0], [r0.x, r0.z], dir(P[0], P[1]), 12), 14, 3.5, 'ring');
    else northEnds.push({ sgn, n: r0 });
    if (nS) edge(r1, nS, bez([r1.x, r1.z], dir(P[P.length - 2], P[P.length - 1]), [nS.x, nS.z], [-sgn, 0], 12), 16, 4, 'ring');
    NET.arcs.push(P);
  }
  // V23: Nordstraße am Viadukt. Früher endete die große Allee 75 m vor der Rampe und beide Ringbögen liefen im Norden blind aus.
  // Jetzt: eine Uferstraße vom westlichen zum östlichen Ringende, jede Avenue mit einem Stich nach Norden, die Allee als Auffahrt
  // auf den Viadukt, und der Viadukt selbst ist eine Kante im Netz (Verkehr fährt bis in den Tunnel).
  if (northEnds.length === 2) {
    const zN = ST[0].z - 1, W0 = northEnds.find(q => q.sgn < 0).n, E0 = northEnds.find(q => q.sgn > 0).n;
    const zAt = x => { let z = zN; for (let k = 0; k < 12 && landDist(x, z) < RING_OFF; k++) z += 3; return z; };
    const top = new Map();   // nördlichster Rasterknoten je Avenue
    for (const n of grid.values()) { const t = top.get(n.gi); if (!t || n.gj < t.gj) top.set(n.gi, n); }
    const stops = [...top.values()].filter(n => n.x > W0.x + 30 && n.x < E0.x - 30 && !G(n.gi, n.gj - 1)).sort((a, b) => a.x - b.x);
    if (!stops.some(n => n.x === 0)) stops.push({ x: 0, z: null }), stops.sort((a, b) => a.x - b.x);
    let prev = W0;
    const line = (a, b) => { const pts = []; const n = Math.max(2, Math.ceil(Math.abs(b.x - a.x) / 6)); for (let k = 0; k <= n; k++) { const x = a.x + (b.x - a.x) * k / n; pts.push([x, k === 0 ? a.z : k === n ? b.z : zAt(x)]); } return pts; };
    for (const g of stops) {
      const j = node(g.x, zAt(g.x), g.x === 0 ? 'via' : 'ring');
      edge(prev, j, line(prev, j), 14, 3.5, 'north');
      if (g.z !== null) edge(g, j, [[g.x, g.z], [j.x, j.z]], g.x === 0 ? 22 : 14, g.x === 0 ? 5.5 : 3.5, g.x === 0 ? 'link' : 'grid');
      if (g.x === 0) NET.viaHead = j;
      prev = j;
    }
    edge(prev, E0, line(prev, E0), 14, 3.5, 'north');
    if (NET.viaHead) {
      // der Viadukt bis kurz vor das Tunnelende (Fahrbahnhöhe deckY, siehe traffic.js)
      const vt = node(0, VIA.end + 8, 'via'), h = NET.viaHead;
      const pts = []; for (let z = h.z; z > vt.z; z -= 25) pts.push([0, z]); pts.push([0, vt.z]);
      edge(h, vt, pts, ROAD_W, 3.5, 'via');
    }
  }
  // Spatialer Index der Straßenstücke: Abstand eines Punktes zur nächsten Fahrbahn
  for (const e of NET.edges) for (let k = 1; k < e.pts.length; k++) {
    const a = e.pts[k - 1], b = e.pts[k], s = { a, b, e };
    for (let ix = Math.floor((Math.min(a[0], b[0]) - 20) / 30); ix <= Math.floor((Math.max(a[0], b[0]) + 20) / 30); ix++)
      for (let iz = Math.floor((Math.min(a[1], b[1]) - 20) / 30); iz <= Math.floor((Math.max(a[1], b[1]) + 20) / 30); iz++) {
        const key = ix + ',' + iz; let l = EDGE_HASH.get(key); if (!l) EDGE_HASH.set(key, l = []); l.push(s);
      }
  }
}
export const EDGE_HASH = new Map();
export function distSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
// Abstand zum Fahrbahnrand (negativ = auf der Fahrbahn)
export function roadEdgeDist(x, z) {
  const l = EDGE_HASH.get(Math.floor(x / 30) + ',' + Math.floor(z / 30)); if (!l) return 1e9;
  let best = 1e9;
  for (const s of l) best = Math.min(best, distSeg(x, z, s.a, s.b) - s.e.w / 2);
  return best;
}
export function ringEdgeDist(x, z) {
  const l = EDGE_HASH.get(Math.floor(x / 30) + ',' + Math.floor(z / 30)); if (!l) return 1e9;
  let best = 1e9;
  for (const s of l) if (s.e.kind !== 'grid') best = Math.min(best, distSeg(x, z, s.a, s.b) - s.e.w / 2);
  return best;
}

/* ---------- Randviertel: Häuserzeilen folgen der Ringstraße, dahinter ein Gartenweg mit Villen, dazwischen Parks ---------- */
export const OUTER = { houses: [], paths: [], plots: [], walks: [] };
export function obbCorners(o, pad = 0) {
  const c = Math.cos(o.ry), s = Math.sin(o.ry), hw = o.w / 2 + pad, hd = o.d / 2 + pad;
  // lokales x (Breite) zeigt nach (cos, -sin), lokales z (Tiefe) nach (sin, cos)
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [o.x + u * c + v * s, o.z - u * s + v * c]);
}
export function obbOverlap(A, B, pad = 0) {
  const ca = obbCorners(A, pad), cb = obbCorners(B, pad);
  for (const o of [A, B]) for (const ax of [[Math.cos(o.ry), -Math.sin(o.ry)], [Math.sin(o.ry), Math.cos(o.ry)]]) {
    const pa = ca.map(p => p[0] * ax[0] + p[1] * ax[1]), pb = cb.map(p => p[0] * ax[0] + p[1] * ax[1]);
    if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
  }
  return true;
}
export const blockAt = (x, z, m = 0) => blocks.find(b => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
export function plotFree(o, roadPad) {
  const pts = obbCorners(o, 0.5);
  pts.push([o.x, o.z], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], [(pts[2][0] + pts[3][0]) / 2, (pts[2][1] + pts[3][1]) / 2], [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2], [(pts[3][0] + pts[0][0]) / 2, (pts[3][1] + pts[0][1]) / 2]);
  for (const [x, z] of pts) {
    if (!onIsland(x, z, 6)) return false;
    if (blockAt(x, z, 12)) return false;
    if (roadEdgeDist(x, z) < roadPad) return false;
    if (inRect(x, z, PLAZA, 8) || (z < ST[0].z - 6 && Math.abs(x) < 600)) return false;
    for (const e of ELEVATED) { const ax = e.axis === 'x'; if (Math.abs((ax ? z : x) - e.at) < 11 && (ax ? x : z) > e.from - 4 && (ax ? x : z) < e.to + 4) return false; }
    for (const L of TRAM_LINES) { const ax = L.axis === 'x'; if (Math.abs((ax ? z : x) - L.at) < 9) return false; }
  }
  for (const h of OUTER.plots) if (Math.hypot(h.x - o.x, h.z - o.z) < (h.w + o.w + h.d + o.d) / 2 && obbOverlap(h, o, 0.8)) return false;
  return true;
}
// Haus in gedrehter Lage: Fassadenquader, Gesims, Sockel, Dachaufbauten, Eingang mit Stufen und Vordach
export function rotHouse(o) {
  const { x, z, w, d, ry, H, worker } = o, c = Math.cos(ry), s = Math.sin(ry);
  const L = (u, v) => [x + u * c + v * s, z - u * s + v * c];
  const tint = worker ? pick(BRICK) : pick(STONES), seed = Math.floor(R() * 1000), cT = tint.map(v => v * 1.15);
  const seg = (u, v, ww, dd, y0, y1, t, st, dens, fl, rib) => { const [px, pz] = L(u, v); addSeg({ x: px, z: pz, w: ww, d: dd, y0, y1, tint: t, seed, style: st, dens, flood: fl, rib: rib || [0, 0, 0], ry }, false); };
  seg(0, 0, w, d, 0.2, H, tint, worker ? 0 : (R() < 0.5 ? 1 : 0), worker ? rand(0.3, 0.5) : rand(0.15, 0.4), 0);
  seg(0, 0, w + 0.7, d + 0.7, H - 0.6, H + 0.3, cT, 3, 0, 0);                        // Kranzgesims
  seg(0, 0, w + 0.3, d + 0.3, 0.2, 1.1, tint.map(v => v * 0.8), 3, 0, 0);             // Sockel
  if (!worker) seg(0, 0, w + 0.4, d + 0.4, 4.4, 4.75, cT, 3, 0, 0.2);                 // Gurtgesims über dem Erdgeschoss
  // Staffelgeschoss oder Mansarde
  if (!worker && H > 14 && R() < 0.55) { seg(0, 0, w * 0.82, d * 0.8, H + 0.3, H + 3.6, tint.map(v => v * 0.95), 1, 0.35, 0); seg(0, 0, w * 0.82 + 0.5, d * 0.8 + 0.5, H + 3.4, H + 3.8, cT, 3, 0, 0); }
  // Schornsteine, Wassertank auf Arbeiterhäusern
  for (let k = 0; k < (worker ? 3 : 2); k++) { const u = rand(-w / 2 + 1.5, w / 2 - 1.5), v = rand(-d / 2 + 1.5, d / 2 - 1.5); seg(u, v, 0.9, 0.9, H, H + 2.2 + R() * 1.5, worker ? [0.36, 0.22, 0.17] : tint, 3, 0, 0); }
  // Kollision: entlang der Länge in Streifen (achsenparallel)
  const nStrip = Math.max(1, Math.ceil(w / 4));
  for (let k = 0; k < nStrip; k++) {
    const u0 = -w / 2 + w * k / nStrip + 0.3, u1 = -w / 2 + w * (k + 1) / nStrip - 0.3, P = [L(u0, -d / 2 + 0.4), L(u1, -d / 2 + 0.4), L(u0, d / 2 - 0.4), L(u1, d / 2 - 0.4)];
    addCollider(Math.min(...P.map(p => p[0])), 0, Math.min(...P.map(p => p[1])), Math.max(...P.map(p => p[0])), H, Math.max(...P.map(p => p[1])));
  }
  // Eingang zur Straße (lokal -z = Vorderseite): Stufen, Rahmen, Vordach, zwei Laternen, Hausnummer
  const front = -d / 2, kind = worker ? pickW(R, [['pub', 1], ['workshop', 1.2], ['shop', 1.5], ['home', 4]]) : pickW(R, [['shop', 1.5], ['cafe', 1], ['restaurant', 0.8], ['home', 4]]);
  const du = rand(-w / 4, w / 4);
  ENTRANCES.push({ x: L(du, front)[0], z: L(du, front)[1], ry, worker, kind, tint });
  const [ex, ez] = L(du, front - 0.3), nx = -s, nz = -c;   // Normale nach außen (lokal -z)
  DOORS.push({ x: ex + nx * 0.3, z: ez + nz * 0.3, nx, nz, kind: kind === 'home' ? 'shop' : kind });
  lamps.push({ x: ex + nx * 0.25 + c * 1.6, z: ez + nz * 0.25 - s * 1.6, h: 0, wall: true });
  OUTER.houses.push(o);
}
export const ENTRANCES = [];
export function buildOuter() {
  const rr = mulberry32(16016);
  const workerAt = (x, z) => (Math.hypot(x, z) > 650 && z < 420 && rr() < 0.75) || x > 650;
  // Rückt eine Häuserzeile entlang eines Linienzugs auf eine Seite; die Fassade schaut zur Linie
  const placeRow = (P, side, front, depthR, opt) => {
    const cum = [0]; for (let k = 1; k < P.length; k++) cum.push(cum[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
    const at = sv => { let k = 1; while (k < P.length - 1 && cum[k] < sv) k++; const t = (sv - cum[k - 1]) / (cum[k] - cum[k - 1] || 1); return { p: [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t], n: polyNormal(P, k) }; };
    let s = (opt.s0 || 0) + rr() * 3, placed = 0;
    const end = cum[cum.length - 1] - (opt.s1 || 0);
    while (s < end - 8) {
      const w = Math.min(end - s, opt.wr[0] + rr() * (opt.wr[1] - opt.wr[0])), d = depthR[0] + rr() * (depthR[1] - depthR[0]);
      if (w < 8) break;
      const A = at(s + w / 2), nI = [A.n[0] * side, A.n[1] * side], off = front + d / 2;
      const cx = A.p[0] + nI[0] * off, cz = A.p[1] + nI[1] * off;
      const ry = Math.atan2(nI[0], nI[1]);           // lokales +z zeigt von der Straße weg, die Vorderseite (-z) zur Straße
      const worker = opt.worker ? opt.worker(cx, cz) : false;
      const H = worker ? 9 + rr() * 9 : opt.lane ? 8 + rr() * 6 : 12 + rr() * 16;
      const o = { x: cx, z: cz, w, d, ry, H: Math.round(H / 3.6) * 3.6 + 0.2, worker, lane: opt.lane };
      if (plotFree(o, opt.pad)) { OUTER.plots.push(o); rotHouse(o); placed++; s += w + 0.3 + (rr() < 0.15 ? 5 + rr() * 8 : 0); }
      else s += 3;
    }
    return placed;
  };
  // Ende einer Straße an einer Kreuzung freihalten
  const setback = (e, nodeId) => { const n = NET.nodes[nodeId]; let m = 0; for (const id of n.e) if (id !== e.id) { const o = NET.edges[id]; if (!(o.kind === 'ring' && e.kind === 'ring')) m = Math.max(m, o.w / 2 + WALK_W + 1.5); } return m; };
  for (const e of NET.edges) {
    // Rasterstraßen nur am Rand des Rasters (eine Seite Rasen)
    if (e.kind === 'grid') {
      const [a, b] = [e.pts[0], e.pts[e.pts.length - 1]], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, n = polyNormal(e.pts, 0);
      const free = sd => !blockAt(mx + n[0] * sd * (e.w / 2 + 14), mz + n[1] * sd * (e.w / 2 + 14), 0) && onIsland(mx + n[0] * sd * (e.w / 2 + 14), mz + n[1] * sd * (e.w / 2 + 14), 10);
      e.sides = [-1, 1].filter(free);
      if (!e.sides.length || mz > ST[ST.length - 1].z - 1 || mz < ST[0].z + 1) continue;
    } else if (e.kind === 'via') { e.sides = []; e.walkSides = []; continue; }
    else e.sides = [-1, 1];
    const P = resample(e.pts, 2), s0 = setback(e, e.a), s1 = setback(e, e.b);
    e.walkSides = [];
    for (const sd of e.sides) {
      const k = placeRow(P, sd, e.w / 2 + WALK_W + 0.6, [12, 18], { s0, s1, wr: [12, 22], pad: WALK_W - 0.2, worker: workerAt });
      if (k || e.kind === 'ring') e.walkSides.push({ sd, s0, s1 });
    }
  }
  // Gartenwege hinter der Ringbebauung, mit kleinen Villen
  for (const P0 of NET.arcs) {
    const k0 = Math.floor(P0.length / 2), n0 = polyNormal(P0, k0);
    const sideIn = landDist(P0[k0][0] + n0[0] * 20, P0[k0][1] + n0[1] * 20) > landDist(P0[k0][0], P0[k0][1]) ? 1 : -1;
    const laneOff = RING_W / 2 + WALK_W + 0.6 + 22;
    const lane = offsetPoly(P0, laneOff * sideIn).filter(p => onIsland(p[0], p[1], 30) && !blockAt(p[0], p[1], 14) && roadEdgeDist(p[0], p[1]) > 6 && !OUTER.plots.some(h => Math.hypot(h.x - p[0], h.z - p[1]) < Math.min(h.w, h.d) / 2));
    let cur = [];
    const flush = () => { if (cur.length > 6) { OUTER.paths.push(cur); placeRow(cur, sideIn, 3.2, [10, 14], { wr: [10, 16], pad: 3, lane: true, worker: () => rr() < 0.2 }); } cur = []; };
    for (const p of lane) { if (cur.length && Math.hypot(p[0] - cur[cur.length - 1][0], p[1] - cur[cur.length - 1][1]) > 9) flush(); cur.push(p); }
    flush();
  }
  // Lampen und Bäume entlang der Ringstraße (beidseits), Bänke zur Seeseite
  for (const e of NET.edges) {
    if (!e.walkSides || !e.walkSides.length) continue;
    const P = resample(e.pts, 3), ring = e.kind === 'ring';
    for (let k = 0; k < P.length; k += 1) {
      const n = polyNormal(P, k);
      for (const sd of [-1, 1]) {
        const off = sd * (e.w / 2 + 0.9), x = P[k][0] + n[0] * off, z = P[k][1] + n[1] * off;
        if (k % 9 === (sd > 0 ? 0 : 4)) { if (roadEdgeDist(x, z) > 0.4 && !blockAt(x, z, 1)) lamps.push({ x, z, h: 4.8 }); }
        const off2 = sd * (e.w / 2 + WALK_W + 4), tx = P[k][0] + n[0] * off2, tz = P[k][1] + n[1] * off2;
        if (ring && k % 4 === 2 && onIsland(tx, tz, 3) && roadEdgeDist(tx, tz) > 3 && !blockAt(tx, tz, 6) && !OUTER.plots.some(h => Math.hypot(h.x - tx, h.z - tz) < (h.w + h.d) / 2 + 2))
          trees.push({ x: tx, z: tz, y: 0.02, s: 0.9 + rr() * 0.4, sp: rr() < 0.5 ? 'plane' : 'linden' });
      }
    }
  }
  // Uferpromenade: Kiesweg am Wasser, Bänke, Laternen
  const prom = resample(COAST.filter(p => p[1] < ISL.quay - 1 && !(Math.abs(p[0]) < 600 && p[1] < ST[0].z)), 4).map(p => { const dx = p[0] - ISL.cx, dz = p[1] - ISL.cz, L = Math.hypot(dx, dz); return [p[0] - dx / L * 7, p[1] - dz / L * 7]; }).filter(p => roadEdgeDist(p[0], p[1]) > 2.5 + WALK_W);
  let cur = [];
  for (const p of prom) { if (cur.length && Math.hypot(p[0] - cur[cur.length - 1][0], p[1] - cur[cur.length - 1][1]) > 10) { if (cur.length > 4) OUTER.paths.push(cur); cur = []; } cur.push(p); }
  if (cur.length > 4) OUTER.paths.push(cur);
  // Parks: in den freien Rasenflächen Bäume in lockeren Gruppen, dazu Blumenbeete
  for (let tries = 0; tries < 9000; tries++) {
    const x = (rr() - 0.5) * 2100, z = -1060 + rr() * 1560;
    const ld = landDist(x, z);
    if (ld < 6 || ld > KEEP + 40) continue;
    if (blockAt(x, z, 10) || roadEdgeDist(x, z) < 5 || inRect(x, z, PLAZA, 6)) continue;
    if (OUTER.plots.some(h => Math.hypot(h.x - x, h.z - z) < (h.w + h.d) / 2 + 3)) continue;
    if (OUTER.paths.some(P => P.some(p => Math.abs(p[0] - x) < 3 && Math.abs(p[1] - z) < 3))) continue;
    if (trees.some(t => Math.abs(t.x - x) < 7 && Math.abs(t.z - z) < 7)) continue;
    if (z < ST[0].z - 4 && Math.abs(x) < 600) continue;
    const r = rr();
    trees.push({ x, z, y: 0.02, s: 0.85 + rr() * 0.6, sp: r < 0.12 ? 'cyp' : r < 0.55 ? 'plane' : 'linden' });
  }
}

/* ---------- Boden: Pflaster, Rasen und Kieswege aus einer Maske (Canvas), Form der Uferlinie ---------- */
export const MASK = { x0: -1110, z0: -1110, w: 2220, h: 1700, tex: null };
export function buildGroundMask() {
  const W = MOBILE ? 1024 : 2048, H = Math.round(W * MASK.h / MASK.w), sx = W / MASK.w, sz = H / MASK.h;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const X = x => (x - MASK.x0) * sx, Z = z => (z - MASK.z0) * sz;
  g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, W, H);                    // Rasen
  g.fillStyle = '#000';
  for (const b of blocks) g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * sx, (b.z1 - b.z0) * sz);
  g.fillRect(X(PLAZA.x0 - 11), Z(PLAZA.z0 - 7), (PLAZA.x1 - PLAZA.x0 + 22) * sx, (PLAZA.z1 - PLAZA.z0 + 14) * sz);
  g.fillRect(X(-640), Z(-1110), 1280 * sx, (ST[0].z + 7 + 1110) * sz);       // Platz am Viadukt
  g.fillRect(X(-1110), Z(ST[ST.length - 1].z - 15), 2220 * sx, 200 * sz);     // Hafenstraße und Kai
  g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const e of NET.edges) { g.lineWidth = (e.w + (e.kind === 'ring' ? 2 * WALK_W : 0.6)) * sx; g.beginPath(); e.pts.forEach((p, k) => k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); }
  // Hausplätze gepflastert
  for (const h of OUTER.plots) { const P = obbCorners(h, 2.2); g.beginPath(); P.forEach((p, k) => k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.closePath(); g.fill(); }
  // Kieswege
  g.strokeStyle = 'rgb(0,255,0)';
  for (const P of OUTER.paths) { g.lineWidth = 3.6 * sx; g.beginPath(); P.forEach((p, k) => k ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); g.stroke(); }
  // Blumenbeete am Weg (blauer Kanal)
  const rr = mulberry32(777);
  g.fillStyle = 'rgb(255,0,255)';
  for (const P of OUTER.paths) for (let k = 6; k < P.length; k += 14 + Math.floor(rr() * 10)) {
    const n = polyNormal(P, k), sd = rr() < 0.5 ? -1 : 1, x = P[k][0] + n[0] * sd * 4.5, z = P[k][1] + n[1] * sd * 4.5;
    if (roadEdgeDist(x, z) < 4 || blockAt(x, z, 4)) continue;
    g.beginPath(); g.ellipse(X(x), Z(z), (2 + rr() * 2.5) * sx, (1.2 + rr() * 1.2) * sz, Math.atan2(n[1], n[0]), 0, Math.PI * 2); g.fill();
  }
  const t = new T.CanvasTexture(cv); t.flipY = false; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
  MASK.tex = t; MASK.cv = cv; MASK.sx = sx; MASK.sz = sz;
  return t;
}
// Rasenanteil an einer Stelle (aus der Maske), für Gras, Blumen und Bäume
export function maskAt(x, z) {
  if (!MASK.cv) return [0, 0, 0];
  const g = MASK.ctx ||= MASK.cv.getContext('2d', { willReadFrequently: true });
  MASK.data ||= g.getImageData(0, 0, MASK.cv.width, MASK.cv.height).data;
  const i = Math.floor((x - MASK.x0) * MASK.sx), j = Math.floor((z - MASK.z0) * MASK.sz);
  if (i < 0 || j < 0 || i >= MASK.cv.width || j >= MASK.cv.height) return [0, 0, 0];
  const o = (j * MASK.cv.width + i) * 4; return [MASK.data[o] / 255, MASK.data[o + 1] / 255, MASK.data[o + 2] / 255];
}
// Gras im Bodenshader: Rasen, Kies und Blumenbeete aus der Maske über das Pflaster gelegt
export function groundGrass(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uMask = { value: MASK.tex }; sh.uniforms.uGrass = { value: GRASS.map }; sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `uniform sampler2D uMask, uGrass; uniform float uTime; uniform vec4 uWind; varying vec3 vGW;
      float ggH(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float ggN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(ggH(i), ggH(i+vec2(1,0)), f.x), mix(ggH(i+vec2(0,1)), ggH(i+vec2(1,1)), f.x), f.y); }
      ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 gmk = texture2D(uMask, (vGW.xz - vec2(${MASK.x0.toFixed(1)}, ${MASK.z0.toFixed(1)})) / vec2(${MASK.w.toFixed(1)}, ${MASK.h.toFixed(1)})).rgb;
        float grassK = smoothstep(0.35, 0.75, gmk.r), gravelK = smoothstep(0.35, 0.75, gmk.g) * (1.0 - grassK * 0.0), bedK = smoothstep(0.3, 0.7, gmk.b);
        grassK = max(grassK, bedK);
        {
          // Rasen: zwei Grastexturen gegeneinander gedreht, großflächige Farbflecken (trocken, saftig), Kleeblüten, im Wind wandernde Glanzstreifen
          vec2 gq = vGW.xz;
          vec3 g1 = texture2D(uGrass, gq / 2.3).rgb, g2 = texture2D(uGrass, mat2(0.8, -0.6, 0.6, 0.8) * gq / 3.7).rgb;
          float gpatch = ggN(gq * 0.05) * 0.6 + ggN(gq * 0.17 + 3.0) * 0.4;
          vec3 gc = mix(g1, g2, 0.5) * mix(vec3(0.62, 0.78, 0.52), vec3(0.95, 1.05, 0.7), gpatch) * 0.95;
          vec2 wd = uWind.xy; float wave = sin(dot(gq, wd) * 0.35 - uTime * (1.2 + uWind.z * 0.25)) * 0.5 + 0.5;
          gc *= 0.9 + 0.22 * wave * uWind.z * 0.12;
          vec2 fc = floor(gq * 2.2), fo = fract(gq * 2.2) - 0.5; float fh = ggH(fc);
          float flower = step(0.93, fh) * step(length(fo - (vec2(ggH(fc + 1.7), ggH(fc + 4.1)) - 0.5) * 0.6), 0.09);
          vec3 fcol = fh > 0.975 ? vec3(0.95, 0.92, 0.8) : fh > 0.955 ? vec3(0.9, 0.75, 0.25) : vec3(0.7, 0.45, 0.75);
          gc = mix(gc, fcol, flower * 0.85 * (1.0 - smoothstep(0.03, 0.15, length(fwidth(gq)))));
          // Beete: dunkle Erde mit dichten bunten Blüten
          vec2 bc = floor(gq * 5.0), bo = fract(gq * 5.0) - 0.5; float bh = ggH(bc + 9.0);
          vec3 bcol = bh > 0.66 ? vec3(0.75, 0.08, 0.12) : bh > 0.33 ? vec3(0.95, 0.85, 0.7) : vec3(0.85, 0.55, 0.15);
          vec3 bed = mix(vec3(0.07, 0.05, 0.04), bcol, step(length(bo), 0.32) * step(0.25, bh));
          bed = mix(bed, gc * 0.7, step(0.6, ggH(bc + 2.0)) * 0.6);
          gc = mix(gc, bed, bedK);
          diffuseColor.rgb = mix(diffuseColor.rgb, gc, grassK);
          // Kies: helle Körnung
          float gr = ggH(floor(gq * 30.0)), gr2 = ggN(gq * 4.0);
          vec3 kc = vec3(0.42, 0.38, 0.32) * (0.75 + 0.4 * gr) * (0.85 + 0.25 * gr2);
          diffuseColor.rgb = mix(diffuseColor.rgb, kc, gravelK * (1.0 - grassK));
          sdPud *= (1.0 - grassK) * (1.0 - gravelK); man *= 1.0 - max(grassK, gravelK); grate *= 1.0 - max(grassK, gravelK);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.92, max(grassK, gravelK));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 gn = normalize(vNormal + vec3(ggN(vGW.xz * 3.0) - 0.5, 0.0, ggN(vGW.zx * 3.0 + 5.0) - 0.5) * 0.35); normal = normalize(mix(normal, gn, max(grassK, gravelK))); }`);
  };
}

/* ---------- Bürgersteige mit gerundeten Ecken (Radius 5 m) und gebogene Gehwege an der Ringstraße ---------- */
export const CURB_R = 5, WALKS = [], WALK_HASH = new Map();
export function roundRectShape(x0, z0, x1, z1, r) {
  // Form im XY-System mit y = -z, damit nach dem Drehen +z nach Süden zeigt
  const s = new T.Shape(), a = x0, b = -z1, c = x1, d = -z0;
  s.moveTo(a + r, b); s.lineTo(c - r, b); s.absarc(c - r, b + r, r, -Math.PI / 2, 0, false);
  s.lineTo(c, d - r); s.absarc(c - r, d - r, r, 0, Math.PI / 2, false);
  s.lineTo(a + r, d); s.absarc(a + r, d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(a, b + r); s.absarc(a + r, b + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
export function walkMaterial(sl, mode) {
  const m = stdMat({ map: sl.map, roughnessMap: sl.rough, normalMap: sl.normal, normalScale: new T.Vector2(0.8, 0.8), color: 0x8e979c, roughness: 0.82, metalness: 0.05, envI: 0.4 });
  m.onBeforeCompile = sh => {
    sh.vertexShader = (mode === 'rect' ? 'attribute vec4 aRect;\n' : 'attribute float aCurb;\n') + 'varying vec2 vWq; varying float vTop, vCurbD;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      vec4 wpU = modelMatrix * vec4(position, 1.0);
      vTop = step(0.5, normal.y);
      vUv = vTop > 0.5 ? wpU.xz / 3.0 : vec2(wpU.x + wpU.z, wpU.y * 4.0) / 3.0;
      vWq = wpU.xz;
      ${mode === 'rect' ? `{ vec2 q = abs(wpU.xz - aRect.xy) - aRect.zw + ${CURB_R.toFixed(1)}; vCurbD = -(length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - ${CURB_R.toFixed(1)}); }` : 'vCurbD = aCurb;'}`);
    sh.fragmentShader = 'varying vec2 vWq; varying float vTop, vCurbD;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      float curb = max(1.0 - vTop, 1.0 - step(0.34, vCurbD));
      float gran = 0.82 + 0.3 * fract(sin(dot(floor(vWq * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
      float joint = step(0.49, abs(fract((vWq.x + vWq.y) / 1.2) - 0.5));
      float lip = vTop * smoothstep(0.03, 0.0, vCurbD);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.37, 0.39) * gran * (1.0 - 0.6 * joint) * (1.0 + 0.4 * lip), curb);`);
  };
  streetDetail(m, 'merged');
  return m;
}
export function buildSidewalks() {
  const sl = slabTextures();
  // Blöcke: gerundete Rechtecke, extrudiert
  const geos = [];
  for (const b of blocks) {
    const sh = roundRectShape(b.x0, b.z0, b.x1, b.z1, CURB_R);
    const g = new T.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 5 }).rotateX(-Math.PI / 2);
    const n = g.attributes.position.count, a = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) a.set([(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.x1 - b.x0) / 2, (b.z1 - b.z0) / 2], i * 4);
    g.setAttribute('aRect', new T.BufferAttribute(a, 4));
    g.deleteAttribute('uv'); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(n * 2), 2));
    geos.push(g.index ? g.toNonIndexed() : g);
  }
  const walk = new T.Mesh(mergeGeos(geos), walkMaterial(sl, 'rect')); walk.frustumCulled = false; scene.add(walk);
  // Ring: Gehweg-Bänder links und rechts der Fahrbahn
  const pos = [], cd = [], idx = [];
  const ribbon = (P, side, wOff) => {
    // Querschnitt: Bordkante unten, Bordkante oben, 0,34 m, innen
    const prof = [[0, 0, 0], [0, 0.22, 0], [0.34, 0.22, 0.34], [WALK_W, 0.22, WALK_W], [WALK_W + 0.05, 0.0, WALK_W]];
    const base = pos.length / 3;
    P.forEach((p, k) => { const n = polyNormal(P, k); for (const [o, y, c] of prof) { const off = side * (wOff + o); pos.push(p[0] + n[0] * off, y, p[1] + n[1] * off); cd.push(c); } });
    const np = prof.length;
    for (let k = 1; k < P.length; k++) for (let j = 0; j < np - 1; j++) {
      const a = base + (k - 1) * np + j, b = a + 1, c = base + k * np + j, d = c + 1;
      if (side > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  };
  for (const e of NET.edges) if (e.walkSides) for (const ws of e.walkSides) {
    const cum = [0], P0 = resample(e.pts, 3); for (let k = 1; k < P0.length; k++) cum.push(cum[k - 1] + Math.hypot(P0[k][0] - P0[k - 1][0], P0[k][1] - P0[k - 1][1]));
    const P = P0.filter((p, k) => cum[k] >= ws.s0 - 0.01 && cum[k] <= cum[cum.length - 1] - ws.s1 + 0.01);
    if (P.length > 1) {
      ribbon(P, ws.sd, e.w / 2); WALKS.push({ P, sd: ws.sd, off: e.w / 2 });
      for (let k = 1; k < P.length; k++) { const w = { a: P[k - 1], b: P[k], sd: ws.sd, off: e.w / 2 }, mx = (w.a[0] + w.b[0]) / 2, mz = (w.a[1] + w.b[1]) / 2;
        for (let ix = Math.floor((mx - 16) / 20); ix <= Math.floor((mx + 16) / 20); ix++) for (let iz = Math.floor((mz - 16) / 20); iz <= Math.floor((mz + 16) / 20); iz++) { const key = ix + ',' + iz; let l = WALK_HASH.get(key); if (!l) WALK_HASH.set(key, l = []); l.push(w); } }
    }
  }
  if (idx.length) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aCurb', new T.Float32BufferAttribute(cd, 1));
    g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.Mesh(g, walkMaterial(sl, 'ribbon')); m.frustumCulled = false; scene.add(m);
  }
}
// Höhe des Bodens für Fahrzeuge und Fußgänger auf der Insel: Bürgersteig 22 cm, sonst Fahrbahn
export function curbHeight(x, z) {
  const b = blockAt(x, z, 0.5);
  if (b) {
    const qx = Math.abs(x - (b.x0 + b.x1) / 2) - (b.x1 - b.x0) / 2 + CURB_R, qz = Math.abs(z - (b.z0 + b.z1) / 2) - (b.z1 - b.z0) / 2 + CURB_R;
    const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - CURB_R;
    if (d < 0) return 0.22;
  }
  const l = WALK_HASH.get(Math.floor(x / 20) + ',' + Math.floor(z / 20));
  if (l) for (const w of l) {
    const dx = w.b[0] - w.a[0], dz = w.b[1] - w.a[1], L2 = dx * dx + dz * dz || 1, t = ((x - w.a[0]) * dx + (z - w.a[1]) * dz) / L2;
    if (t < -0.05 || t > 1.05) continue;
    const lat = ((x - w.a[0]) * -dz + (z - w.a[1]) * dx) / Math.sqrt(L2) * w.sd;
    if (lat > w.off && lat < w.off + WALK_W) return 0.22;
  }
  return 0;
}

/* ---------- Ufer: Kaimauer aus Granit entlang der geschwungenen Linie, Brüstung mit Goldband, Laternen; Lücke für den Viadukt ---------- */
export function buildShoreV16() {
  const K = kit(), gap = ROAD_W / 2 + 1;
  const P = COAST.filter(p => p[1] < ISL.quay - 0.05);
  // nur die gebogenen Ufer: der gerade Hafenkai im Süden hat seine eigene Mauer
  const runs = []; let cur = [];
  for (let k = 0; k < P.length; k++) {
    const p = P[k], skip = Math.abs(p[0]) < gap && p[1] < -1000;
    if (skip) { if (cur.length > 1) runs.push(cur); cur = []; continue; }
    if (cur.length && Math.hypot(p[0] - cur[cur.length - 1][0], p[1] - cur[cur.length - 1][1]) > 20) { if (cur.length > 1) runs.push(cur); cur = []; }
    cur.push(p);
  }
  if (cur.length > 1) runs.push(cur);
  // die Läufe an den Kai anschließen
  for (const r of runs) {
    const a = r[0], b = r[r.length - 1];
    if (a[1] > ISL.quay - 40) r.unshift([a[0] < 0 ? QX[0] : QX[1], ISL.quay]);
    if (b[1] > ISL.quay - 40) r.push([b[0] < 0 ? QX[0] : QX[1], ISL.quay]);
  }
  let post = 0;
  for (const r of runs) for (let k = 1; k < r.length; k++) {
    const [ax, az] = r[k - 1], [bx, bz] = r[k], L = Math.hypot(bx - ax, bz - az); if (L < 0.05) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    // Außen = vom Inselmittelpunkt weg
    let nx = tz, nz = -tx; if ((mx - ISL.cx) * nx + (mz - ISL.cz) * nz < 0) { nx = -nx; nz = -nz; }
    const ry = Math.atan2(-tz, tx);
    const W = (w, h, ox, y, ext = 0.15) => { const g = new T.BoxGeometry(L + ext, h, w).rotateY(ry).translate(mx + nx * ox, y, mz + nz * ox); return wuv(g, 3); };
    K.add('stone', W(5, 18, -2.5, -9.05), [0.62, 0.62, 0.66]);
    K.add('stone', W(0.5, 0.9, 0.15, WATER_Y + 0.2), [0.38, 0.4, 0.42]);
    K.add('stone', W(1.4, 0.16, -0.55, 0.08), [0.86, 0.84, 0.8]);
    K.add('stone', W(0.42, 0.85, -0.55, 0.58), [0.8, 0.78, 0.74]);
    K.add('stone', W(0.6, 0.12, -0.55, 1.06), [0.9, 0.88, 0.83]);
    K.add('gold', new T.BoxGeometry(L + 0.1, 0.05, 0.05).rotateY(ry).translate(mx - nx * 0.55, 1.14, mz - nz * 0.55));
    // Kollision: kurze Stücke als achsenparallele Kästchen
    for (let t = 0; t < L; t += 1.2) { const px = ax + tx * t - nx * 0.55, pz = az + tz * t - nz * 0.55; addCollider(px - 0.35, 0, pz - 0.35, px + 0.35, 1.15, pz + 0.35); }
    post += L;
    if (post > 12) {
      post = 0;
      const px = bx - nx * 0.55, pz = bz - nz * 0.55;
      K.add('stone', Bx(0.75, 1.35, 0.75, px, 0.68, pz, 1), [0.88, 0.85, 0.8]);
      K.add('gold', new T.ConeGeometry(0.3, 0.5, 4).rotateY(Math.PI / 4).translate(px, 1.6, pz));
      if ((SHORE_N = (SHORE_N || 0) + 1) % 3 === 0) lamps.push({ x: px - 1.4 * nx, z: pz - 1.4 * nz, h: 5 });
      if (SHORE_N % 8 === 4) for (let j = 0; j < 7; j++) K.add('iron', new T.BoxGeometry(0.5, 0.03, 0.03).rotateY(ry).translate(bx + nx * 0.08, -0.15 - j * 0.3, bz + nz * 0.08));
    }
  }
  K.build(scene);
}
export let SHORE_N = 0;


export function buildCity() {
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < ST.length - 1; j++) {
    const b = {
      x0: AV[i].x + AV[i].w / 2, x1: AV[i + 1].x - AV[i + 1].w / 2,
      z0: ST[j].z + ST[j].w / 2, z1: ST[j + 1].z - ST[j + 1].w / 2,
    };
    if (b.x1 > PLAZA.x0 && b.x0 < PLAZA.x1 && b.z1 > PLAZA.z0 && b.z0 < PLAZA.z1) continue;
    // V16: nur Blöcke, die ganz im Inneren der Insel liegen; außen folgen gebogene Häuserzeilen
    if (![[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].every(([x, z]) => onIsland(x, z, KEEP))) continue;
    b.i = i; b.j = j;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    b.d = Math.hypot(cx, cz);
    b.park = b.d > 320 && R() < 0.045;
    blocks.push(b);
  }
  // Hierarchie: etwa 28 prägende Türme, rund 70 mittlere, der Rest Stadtgefüge
  const cand = blocks.filter(b => !b.park && b.d < 820 && !(Math.abs((b.x0 + b.x1) / 2) < 120 && (b.z0 + b.z1) / 2 > 133)).sort(() => R() - 0.5);
  cand.sort((a, b) => (a.d + R() * 500) - (b.d + R() * 500));
  cand.slice(0, 28).forEach(b => b.tier = 'landmark');
  cand.filter(b => !b.tier).slice(0, 70).forEach(b => b.tier = 'mid');
  const rf = mulberry32(8128); let fi = 0;
  for (const b of blocks) {
    if (isFactoryZone(b) && rf() < 0.7) {
      // normaler Aufbau ohne Wirkung (gleiche Zufallsfolge), dann die Fabrik an seiner Stelle
      const snap = snapArrays(); shared.SINK = true; buildBlock(b); shared.SINK = false;
      for (const [a, n] of snap) a.length = n;
      b.factory = true; b.worker = true; buildFactory(b, rf, fi++);
    } else buildBlock(b);
  }
}

// Hochstraßen auf Pfeilern, mit Laternen und eigenem Verkehr
export const ELEVATED = [{ axis: 'x', at: -350, y: 16, from: -900, to: 900 }, { axis: 'z', at: -440, y: 22, from: -973, to: 480 }];
export function buildElevated() {
  const gray = [0.3, 0.3, 0.33], rail = [0.42, 0.32, 0.18];
  for (const e of ELEVATED) {
    const len = e.to - e.from, mid = (e.from + e.to) / 2, ax = e.axis === 'x';
    addSeg({ x: ax ? mid : e.at, z: ax ? e.at : mid, w: ax ? len : 16, d: ax ? 16 : len, y0: e.y - 1.4, y1: e.y, tint: gray, seed: 820, style: 0, dens: 0, flood: 0, rib: [0, 0, 0] });
    for (const sd of [-1, 1]) {
      addNeon(ax ? mid : e.at + sd * 7.6, e.y + 0.9, ax ? e.at + sd * 7.6 : mid, ax ? len : 0.25, 0.12, ax ? 0.25 : len, rail);
      addCollider(ax ? e.from : e.at + sd * 7.6 - 0.3, e.y, ax ? e.at + sd * 7.6 - 0.3 : e.from, ax ? e.to : e.at + sd * 7.6 + 0.3, e.y + 1.1, ax ? e.at + sd * 7.6 + 0.3 : e.to);
    }
    for (let t = e.from + 17; t < e.to; t += 34) {
      const px = ax ? t : e.at, pz = ax ? e.at : t;
      if (inRect(px, pz, PLAZA, 10)) continue;
      addSeg({ x: px, z: pz, w: 2.6, d: 2.6, y0: 0, y1: e.y - 1.4, tint: gray, seed: 821, style: 0, dens: 0, flood: 0, rib: [0, 0, 0] });
      for (const sd of [-1, 1]) addGlow(ax ? t : e.at + sd * 7.4, e.y + 4.6, ax ? e.at + sd * 7.4 : t, [1.25, 0.85, 0.48], 1.3);
    }
  }
}

// Verglaste Fußgängergalerien zwischen benachbarten Häusern; Passanten gehen hindurch und verschwinden in den Gebäuden
export const BR_SPOTS = [], BRIDGE_LOOPS = [];
export function buildBridges() {
  const rb = mulberry32(5150), used = new Map();
  const pairs = [];
  for (let i = 0; i < BR_SPOTS.length; i++) for (let j = i + 1; j < BR_SPOTS.length; j++) {
    const a = BR_SPOTS[i], b = BR_SPOTS[j];
    const dx = b.x - a.x, dz = b.z - a.z, alongX = Math.abs(dx) > Math.abs(dz);
    const gap = alongX ? Math.abs(dx) - (a.w + b.w) / 2 : Math.abs(dz) - (a.d + b.d) / 2;
    const over = alongX ? Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2) : Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
    if (gap < 6 || gap > 40 || over < 8) continue;
    pairs.push({ a, b, alongX, gap, over, i, j });
  }
  pairs.sort((p, q) => p.gap - q.gap);
  let n = 0;
  for (const P of pairs) {
    if (n >= 120 || (used.get(P.i) || 0) >= 2 || (used.get(P.j) || 0) >= 2 || rb() > 0.55) continue;
    const { a, b, alongX } = P;
    const top = Math.min(a.top, b.top), y = Math.round(top * (0.3 + rb() * 0.5) / 3.6) * 3.6 + 0.2;
    if (y < 12) continue;
    // Brücke liegt mittig in der gemeinsamen Überdeckung der beiden Fassaden
    const lo = alongX ? Math.max(a.z - a.d / 2, b.z - b.d / 2) : Math.max(a.x - a.w / 2, b.x - b.w / 2);
    const mid = lo + P.over / 2;
    const e0 = alongX ? Math.min(a.x, b.x) + (a.x < b.x ? a.w : b.w) / 2 : Math.min(a.z, b.z) + (a.z < b.z ? a.d : b.d) / 2;
    const len = P.gap + 0.6, c = e0 + P.gap / 2;
    const mx = alongX ? c : mid, mz = alongX ? mid : c;
    const W = (l, q) => ({ x: mx, z: mz, w: alongX ? l : q, d: alongX ? q : l });
    const stone = pick(STONES).map(v => v * 0.9);
    addSeg({ ...W(len, 5.0), y0: y - 0.6, y1: y, tint: stone, seed: 700 + n, style: 3, dens: 0, flood: 0.2 });
    addSeg({ ...W(len, 4.4), y0: y, y1: y + 3.4, tint: stone, seed: 760 + n, style: 2, dens: 0.92, flood: 0.25 }, false);
    addSeg({ ...W(len + 0.4, 5.2), y0: y + 3.4, y1: y + 3.9, tint: stone.map(v => v * 1.15), seed: 820 + n, style: 3, dens: 0, flood: 0.2 }, false);
    for (const sd of [-1, 1]) {
      addNeon(mx + (alongX ? 0 : sd * 2.6), y + 3.95, mz + (alongX ? sd * 2.6 : 0), alongX ? len + 0.4 : 0.12, 0.12, alongX ? 0.12 : len + 0.4, NEON.gold);
      addCollider(alongX ? mx - len / 2 : mx + sd * 2.2 - 0.2, y, alongX ? mz + sd * 2.2 - 0.2 : mz - len / 2, alongX ? mx + len / 2 : mx + sd * 2.2 + 0.2, y + 3.4, alongX ? mz + sd * 2.2 + 0.2 : mz + len / 2);
    }
    const h = len / 2 + 2.5;
    BRIDGE_LOOPS.push({ pts: alongX ? [[mx - h, mz - 0.9], [mx + h, mz - 0.9], [mx + h, mz + 0.9], [mx - h, mz + 0.9]] : [[mx - 0.9, mz - h], [mx - 0.9, mz + h], [mx + 0.9, mz + h], [mx + 0.9, mz - h]], y, per: 7, far: true });
    used.set(P.i, (used.get(P.i) || 0) + 1); used.set(P.j, (used.get(P.j) || 0) + 1);
    n++;
  }
}
