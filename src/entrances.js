import { T, mergeGeos, scene, pick, R, rand, mulberry32, canvasTex } from './core.js';
import { stdMat, MAT, addCollider } from './people-skeleton.js';
import { addGlow, addSeg, addNeon, NEON, STONES, RIBS, spires, towers, roofs, neonPool, shafts, steamPts, segs, neons } from './facade-shader.js';
import { BR_SPOTS } from './island.js';
import { addArcade, addOriels, addBalconies, houseDoor } from './building-forms.js';
import { BRICK, wantShop, shopFloor, tier, facadeRelief } from './shops.js';
import { _m, _p, _q, _up, _s } from './traffic.js';

/* =====================================================================
   V16 · EINGÄNGE: Stufen aus Granit, verglaste Doppeltür mit Goldrahmen und
   Messinggriffen, Oberlicht mit Goldfächer, Wandlaternen; vor Hotels, Bars und
   Restaurants ein roter Läufer zwischen Messingpfosten mit Kordel
   ===================================================================== */
export const PORTALS = [];
export function buildEntrances() {
  if (!PORTALS.length) return;
  const stone = [], gold = [], glass = [], carpet = [];
  for (const P of PORTALS) {
    const { fx, fz, o, kind } = P, ax = -o[1], az = o[0], ry = Math.atan2(o[0], o[1]);
    // lokale Teile: x entlang der Wand, z nach außen
    const put = (arr, g, lx, y, lz) => arr.push(g.rotateY(ry).translate(fx + ax * lx + o[0] * lz, y, fz + az * lx + o[1] * lz));
    put(stone, new T.BoxGeometry(5.6, 0.14, 0.95), 0, 0.29, 0.48);
    put(stone, new T.BoxGeometry(5.2, 0.14, 0.55), 0, 0.43, 0.28);
    // Tür: zwei Glasflügel in Goldrahmen, Griffe, Oberlicht mit Fächer
    put(glass, new T.BoxGeometry(2.6, 3.3, 0.08), 0, 0.5 + 1.65, 0.04);
    for (const s of [-1, 1]) {
      put(gold, new T.BoxGeometry(0.08, 3.4, 0.12), s * 1.34, 2.2, 0.06);
      put(gold, new T.BoxGeometry(0.03, 0.55, 0.05), s * 0.18, 2.0, 0.12);
      put(gold, new T.BoxGeometry(0.04, 3.3, 0.1), 0, 2.15, 0.07);
      // Wandlaternen
      put(gold, new T.BoxGeometry(0.22, 0.42, 0.22), s * 2.05, 3.0, 0.2);
      addGlow(fx + ax * s * 2.05 + o[0] * 0.25, 3.0, fz + az * s * 2.05 + o[1] * 0.25, [1.35, 0.95, 0.55], 1.1);
    }
    put(gold, new T.BoxGeometry(2.76, 0.1, 0.12), 0, 3.86, 0.06);
    put(glass, new T.CircleGeometry(1.3, 20, 0, Math.PI), 0, 3.9, 0.05);
    put(gold, new T.TorusGeometry(1.3, 0.05, 5, 20, Math.PI), 0, 3.9, 0.07);
    for (let k = 1; k < 8; k++) { const a = k / 8 * Math.PI; put(gold, new T.BoxGeometry(0.035, 1.2, 0.03).translate(0, 0.6, 0).rotateZ(a - Math.PI / 2), 0, 3.9, 0.08); }
    if (kind === 'hotel' || kind === 'bar' || kind === 'restaurant') {
      put(carpet, new T.BoxGeometry(1.8, 0.02, 2.3), 0, 0.235, 2.0);
      put(carpet, new T.BoxGeometry(1.8, 0.02, 0.95), 0, 0.37, 0.48);
      for (const s of [-1, 1]) for (const lz of [1.3, 2.9]) { put(gold, new T.CylinderGeometry(0.035, 0.05, 0.95, 8), s * 1.15, 0.7, lz); put(gold, new T.SphereGeometry(0.06, 8, 6), s * 1.15, 1.2, lz); }
      for (const s of [-1, 1]) put(carpet, new T.CylinderGeometry(0.02, 0.02, 1.6, 5).rotateX(Math.PI / 2), s * 1.15, 1.08, 2.1);
    }
  }
  const add = (list, mat) => { if (!list.length) return; const m = new T.Mesh(mergeGeos(list), mat); m.frustumCulled = false; scene.add(m); };
  add(stone, stdMat({ color: 0x8e8b86, roughness: 0.7, envI: 0.3 }));
  add(gold, MAT.gold);
  add(glass, stdMat({ color: 0x0a0d10, metalness: 0.7, roughness: 0.12, envI: 1.4, emissive: 0x1a1006 }));
  add(carpet, stdMat({ color: 0x6a0d12, roughness: 0.85, envI: 0.15, emissive: 0x120202 }));
}

// Portal mit Rahmen, Vordach und Lichtband an der Straßenseite
export const DOORS = [];  // Eingänge für Passanten {x,z,nx,nz,kind}
export function portal(cx, cz, sw, sd, edges, tint, rr, kind) {
  const sides = Object.keys(edges).filter(k => edges[k]); if (!sides.length) return;
  const side = sides[Math.floor(rr() * sides.length)], o = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side];
  const ax = o[0] !== 0, L = ax ? sd : sw, u = (rr() - 0.5) * Math.max(0, L - 16);
  const fx = cx + o[0] * sw / 2 + (ax ? 0 : u), fz = cz + o[1] * sd / 2 + (ax ? u : 0);
  const pt = tint.map(v => v * 1.3);
  const S = (a, b, y0, y1, off, t, st = 3, fl = 0.6) => addSeg({ x: fx + o[0] * (off - 0.025), z: fz + o[1] * (off - 0.025), w: ax ? b + 0.05 : a, d: ax ? a : b + 0.05, y0, y1, tint: t, seed: 990, style: st, dens: 0, flood: fl }, false);
  for (const sd2 of [-1, 1]) addSeg({ x: fx + o[0] * 0.325 + (ax ? 0 : sd2 * 3.1), z: fz + o[1] * 0.325 + (ax ? sd2 * 3.1 : 0), w: ax ? 0.75 : 0.9, d: ax ? 0.9 : 0.75, y0: 0.2, y1: 8.2, tint: pt.map(v => v * 0.8), seed: 991, style: 3, dens: 0, flood: 0.1 }, false);
  S(7.5, 0.84, 7.2, 8.6, 0.42, pt);
  S(8.4, 2.6, 4.5, 4.85, 1.3, pt.map(v => v * 0.8), 3, 0.3);
  addNeon(fx + o[0] * 2.62, 4.68, fz + o[1] * 2.62, ax ? 0.08 : 8.4, 0.08, ax ? 8.4 : 0.08, NEON.gold);
  addGlow(fx + o[0] * 1.6, 4.3, fz + o[1] * 1.6, [1.2, 0.85, 0.45], 2.2);
  DOORS.push({ x: fx + o[0] * 0.3, z: fz + o[1] * 0.3, nx: o[0], nz: o[1], kind });
  PORTALS.push({ fx, fz, o, kind });
}
/* ---------- Möbel: weich gerundete Modelle statt Kisten (Sessel, Sofas, Bistrostühle, runde Tische, Lampen) ---------- */
export function roundBox(w, h, d, r, s = 3) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const g = new T.BoxGeometry(w, h, d, s * 2, s * 2, s * 2), p = g.attributes.position, v = new T.Vector3(), c = new T.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c); if (v.lengthSq() > 1e-9) v.normalize().multiplyScalar(r); p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.computeVertexNormals(); return g;
}
export const lathe = (pts, seg = 20) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(Math.max(r, 0.0001), y)), seg);
export const tube = (pts, r, seg = 10) => new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), seg, r, 6, false);
export const FURN = {
  clubChair() {
    const P = [[roundBox(0.92, 0.4, 0.86, 0.13).translate(0, 0.38, 0.02), 'up'], [roundBox(0.92, 0.78, 0.26, 0.12).rotateX(-0.14).translate(0, 0.82, -0.32), 'up']];
    for (const sx of [-1, 1]) { P.push([roundBox(0.22, 0.56, 0.9, 0.1).translate(sx * 0.44, 0.5, 0), 'up']); P.push([lathe([[0.035, 0], [0.025, 0.14]], 8).translate(sx * 0.36, 0, 0.3), 'frame'], [lathe([[0.035, 0], [0.025, 0.14]], 8).translate(sx * 0.36, 0, -0.3), 'frame']); }
    return P;
  },
  sofa(len = 3.4) {
    const P = [[roundBox(len, 0.38, 0.96, 0.13).translate(0, 0.33, 0), 'up'], [roundBox(len, 0.82, 0.28, 0.13).rotateX(-0.1).translate(0, 0.82, -0.37), 'up']];
    const n = Math.max(2, Math.round(len / 1.1));
    for (let k = 0; k < n; k++) P.push([roundBox(len / n - 0.08, 0.18, 0.78, 0.08).translate(-len / 2 + (k + 0.5) * len / n, 0.6, 0.06), 'up']);
    for (const sx of [-1, 1]) { P.push([roundBox(0.28, 0.62, 0.98, 0.13).translate(sx * len / 2, 0.5, 0), 'up']); for (const sz of [-0.36, 0.36]) P.push([lathe([[0.04, 0], [0.028, 0.15]], 8).translate(sx * (len / 2 - 0.05), 0, sz), 'frame']); }
    return P;
  },
  diningChair() {
    const P = [[roundBox(0.48, 0.1, 0.46, 0.04).translate(0, 0.48, 0), 'up']];
    const back = new T.CylinderGeometry(0.62, 0.62, 0.5, 14, 1, true, Math.PI - 0.4, 0.8).translate(0, 0.86, 0.38);
    P.push([back, 'up']);
    for (const [sx, sz] of [[-0.2, 0.18], [0.2, 0.18], [-0.2, -0.2], [0.2, -0.2]]) P.push([tube([[sx, 0.45, sz], [sx * 1.08, 0.22, sz * 1.08], [sx * 1.15, 0, sz * 1.2]], 0.02, 6), 'wood']);
    for (const sx of [-0.2, 0.2]) P.push([tube([[sx, 0.48, -0.2], [sx, 0.75, -0.25], [sx * 0.9, 1.08, -0.24]], 0.018, 6), 'wood']);
    return P;
  },
  bistroChair() {
    const P = [[lathe([[0, 0.46], [0.2, 0.46], [0.22, 0.48], [0.2, 0.5], [0, 0.5]], 18), 'wood']];
    for (const [sx, sz] of [[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.15], [0.15, -0.15]]) P.push([tube([[sx, 0.46, sz], [sx * 1.15, 0.2, sz * 1.15], [sx * 1.3, 0, sz * 1.3]], 0.014, 6), 'wood']);
    P.push([tube([[-0.17, 0.48, -0.12], [-0.2, 0.75, -0.2], [0, 0.98, -0.24], [0.2, 0.75, -0.2], [0.17, 0.48, -0.12]], 0.014, 16), 'wood']);
    P.push([new T.TorusGeometry(0.14, 0.012, 5, 18, Math.PI).translate(0, 0.7, -0.21), 'wood']);
    return P;
  },
  roundTable(r = 0.45, h = 0.74, cloth = false) {
    const P = [];
    if (cloth) P.push([lathe([[0, h + 0.02], [r, h + 0.02], [r + 0.05, h], [r + 0.08, h - 0.18], [r + 0.07, h - 0.3]], 28), 'cloth']);
    else P.push([lathe([[0, h], [r, h], [r + 0.025, h - 0.02], [r + 0.02, h - 0.045], [r - 0.03, h - 0.06], [0, h - 0.06]], 28), 'wood']);
    P.push([lathe([[0.2, 0], [0.22, 0.02], [0.08, 0.06], [0.04, 0.12], [0.035, h * 0.5], [0.05, h * 0.55], [0.035, h * 0.6], [0.04, h - 0.06]], 14), 'frame']);
    return P;
  },
  tableLamp(h = 0.5) {
    return [[lathe([[0.09, 0], [0.1, 0.02], [0.03, 0.06], [0.025, h * 0.6], [0.05, h * 0.65], [0.02, h * 0.7]], 12), 'frame'],
      [lathe([[0.15, h * 0.62], [0.08, h * 0.98]], 16), 'lamp']];
  },
  floorLamp(h = 1.7) {
    return [[lathe([[0.2, 0], [0.22, 0.02], [0.04, 0.05], [0.025, h - 0.25]], 14), 'frame'], [lathe([[0.3, h - 0.32], [0.14, h]], 18), 'lamp']];
  },
  barStool() {
    return [[lathe([[0, 0.8], [0.19, 0.8], [0.21, 0.83], [0.19, 0.88], [0, 0.89]], 16), 'up'], [lathe([[0.18, 0], [0.19, 0.02], [0.05, 0.05], [0.035, 0.8]], 12), 'frame'],
      [new T.TorusGeometry(0.16, 0.012, 5, 18).rotateX(Math.PI / 2).translate(0, 0.32, 0), 'frame']];
  },
  vasePlant(s = 1) {
    const P = [[lathe([[0.1, 0], [0.18, 0.12], [0.2, 0.3], [0.12, 0.48], [0.14, 0.56]].map(([r, y]) => [r * s, y * s]), 16), 'frame']];
    for (let k = 0; k < 7; k++) { const a = k * 2.4; P.push([new T.SphereGeometry(0.16 * s, 8, 6).scale(1, 0.8, 1).translate(Math.cos(a) * 0.14 * s, (0.65 + (k % 3) * 0.12) * s, Math.sin(a) * 0.14 * s), 'leaf']); }
    return P;
  },
};
// Ein Möbelstück aufstellen: Teile drehen, verschieben und in die passenden Materialgruppen legen
export function placeFurn(parts, map, add, x, y, z, a = 0) { for (const [g, role] of parts) add(map[role] || map.up, g.clone().rotateY(a).translate(x, y, z)); }
// Café-Terrassen vor Cafés und Restaurants: Bistrotische mit Stühlen und Kerzenlicht
export const TERRACE = [];
export function buildTerraces() {
  for (const d of DOORS) {
    if ((d.kind !== 'cafe' && d.kind !== 'restaurant') || Math.hypot(d.x, d.z) > 820) continue;
    const tx = -d.nz, tz = d.nx;
    for (const u of [-7.6, -4.9, 4.9, 7.6]) {
      const x = d.x + d.nx * 1.0 + tx * u, z = d.z + d.nz * 1.0 + tz * u;
      TERRACE.push({ x, z, a: Math.atan2(tx, tz) });
      addGlow(x, 1.02, z, [1.3, 0.75, 0.35], 0.45, Math.random(), 0);
      addCollider(x - 0.4, 0, z - 0.4, x + 0.4, 0.8, z + 0.4);
    }
  }
  if (!TERRACE.length) return;
  // ein Tisch mit zwei Stühlen, die sich gegenübersitzen, plus Kerze
  const wood = [], metal = [];
  const add = (k, g) => (k === 'frame' ? metal : wood).push(g);
  const FM = { frame: 'frame', wood: 'wood', up: 'wood', cloth: 'wood' };
  placeFurn(FURN.roundTable(0.36, 0.74), FM, add, 0, 0, 0);
  for (const sg of [-1, 1]) placeFurn(FURN.bistroChair(), FM, add, sg * 0.7, 0, 0, sg > 0 ? -Math.PI / 2 : Math.PI / 2);
  wood.push(new T.CylinderGeometry(0.03, 0.03, 0.12, 8).translate(0, 0.8, 0));
  const mats = [stdMat({ color: 0x2a1a10, roughness: 0.5, envI: 0.4, emissive: 0x060302 }), MAT.brass];
  [wood, metal].forEach((list, i) => {
    const im = new T.InstancedMesh(mergeGeos(list), mats[i], TERRACE.length);
    TERRACE.forEach((t, k) => im.setMatrixAt(k, _m.compose(_p.set(t.x, 0.22, t.z), _q.setFromAxisAngle(_up, t.a), _s.set(1, 1, 1))));
    im.frustumCulled = false; scene.add(im);
  });
}
export const caps = [];   // Kupfer- und Golddächer {x,z,y,w,d,h,gold}
export const domes = [];  // Kuppeln {x,z,y,r}
// V23: Gesims um eine Stufe mit Fase/Kerbe: Eckmaß so wählen, dass auch die Kerbflächen vorstehen (sonst deckungsgleich mit dem Schaft)
export const bandC = (corner, c, pad) => c + pad / 4;
export function pickW(rr, opts) { let t = 0; for (const o of opts) t += o[1]; let u = rr() * t; for (const o of opts) if ((u -= o[1]) <= 0) return o[0]; return opts[0][0]; }
export function decoBuilding(cx, cz, w, d, H, dist, edges, worker = false) {
  const s0 = segs.length, n0 = neons.length; let c0 = 0;
  const tint = worker ? pick(BRICK) : pick(STONES);
  const seed = Math.floor(R() * 1000);
  const style = worker ? 0 : (R() < 0.55 ? 1 : 0);
  const dens = worker ? rand(0.3, 0.5) : Math.min(0.7, rand(0.1, 0.32) + 0.25 * Math.exp(-dist / 400));
  const rib = (H > 50 && R() < 0.62) ? pick(RIBS) : [0, 0, 0];
  let n = H < 28 ? 1 : H < 70 ? 2 : H < 130 ? 3 : 4;
  let fr = { 1: [1], 2: [0.72, 1], 3: [0.58, 0.84, 1], 4: [0.48, 0.72, 0.88, 1] }[n];
  let sc = { 1: [1], 2: [1, 0.72], 3: [1, 0.76, 0.52], 4: [1, 0.8, 0.62, 0.44] }[n];
  const slab = R() < 0.3;
  // Eigener Zufall für die Bauform, damit der Stadtplan derselbe bleibt
  const rr = mulberry32(seed * 7919 + Math.round(cx * 13 + cz * 7));
  let form = 'classic';
  // V23: neue Bauformen: Scheibenhochhaus (blade), Krone aus gestaffelten Ringen (tiara), Uhrturm (clock), Stufenpyramide (zigtop), Häuserzeile (row)
  if (!worker && H > 70) form = pickW(rr, [['classic', 1.2], ['notch', 1.8], ['chamfer', 1.8], ['twin', w > 30 && d > 22 ? 1.2 : 0], ['zig', 1.1], ['buttress', 1.4], ['dome', Math.min(w, d) > 24 ? 0.9 : 0], ['rotunda', Math.min(w, d) > 24 ? 1.5 : 0], ['stream', 1.0], ['blade', Math.max(w, d) > 26 ? 1.4 : 0], ['tiara', Math.min(w, d) > 20 ? 1.5 : 0]]);
  else if (!worker && H > 26) form = pickW(rr, [['classic', 2.0], ['notch', 1.4], ['chamfer', 1.1], ['corner', w > 22 && d > 22 ? 1.6 : 0], ['buttress', 0.8], ['stream', 1.8], ['clock', Math.min(w, d) > 18 ? 1.0 : 0], ['zigtop', 1.1], ['blade', Math.max(w, d) > 30 ? 0.6 : 0]]);
  else if (!worker && H <= 26 && Math.max(w, d) > 26) form = pickW(rr, [['classic', 3], ['row', 1.4]]);
  else if (worker && H > 14) form = pickW(rr, [['classic', 2.6], ['stream', 0.8], ['row', Math.max(w, d) > 18 ? 2.4 : 0]]);
  else if (worker) form = pickW(rr, [['classic', 2], ['row', Math.max(w, d) > 18 ? 2.2 : 0]]);
  if (form === 'row') return rowHouses(cx, cz, w, d, H, dist, edges, worker, tint, rr);
  // Rundturm: kreisrunder Schaft auf quadratischer Grundfläche, nach oben gestaffelt
  if (form === 'rotunda') { w = d = Math.min(w, d); n = Math.max(n, 3); fr = n === 3 ? [0.5, 0.82, 1] : [0.42, 0.66, 0.86, 1]; sc = n === 3 ? [1, 0.8, 0.6] : [1, 0.82, 0.66, 0.5]; }
  if (form === 'blade' || form === 'tiara') n = Math.max(n, 3);
  if (form === 'zig') { n = 8; fr = [0.6, 0.66, 0.72, 0.78, 0.84, 0.9, 0.95, 1]; sc = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35]; }
  const corner = form === 'notch' ? 'notch' : (form === 'chamfer' || form === 'dome') ? 'chamfer' : (form === 'rotunda' || form === 'stream') ? 'round' : 'square';
  const cTint = tint.map(v => v * 1.15);
  const shopH = !false && form !== 'corner' && form !== 'twin' && wantShop(dist, w, d, edges, worker, H, rr);
  if (shopH) shopFloor(cx, cz, w, d, edges, tint, seed, rr);
  const arcade = !false && !shopH && !worker && form !== 'corner' && form !== 'twin' && H > 26 && H < 110 && dist < 700 && Math.min(w, d) > 18 && rr() < 0.18;
  const core = arcade ? addArcade(cx, cz, w, d, edges, tint, seed, dens, rr) : null;
  let hasDoor = shopH;
  let y = (shopH || arcade) ? 5.3 : 0.2, top = { x: cx, z: cz, w, d }, firstTop = H;
  const towerTop = (form === 'twin') ? H * 0.42 : H;
  for (let i = 0; i < n; i++) {
    let y1 = i === n - 1 ? towerTop : Math.max(y + 7.2, Math.round(towerTop * fr[i] / 3.6) * 3.6 + 0.2);
    if (form === 'twin') y1 = Math.round(towerTop * (i + 1) / n / 3.6) * 3.6 + 0.2;
    if (form === 'twin' && i > 0) break;
    let sw = w * (form === 'twin' ? 1 : sc[i]), sd = d * (form === 'twin' ? 1 : (slab ? Math.min(1, sc[i] + 0.25) : sc[i]));
    if (form === 'blade') { const k = Math.min(i, 3), L = [1, 0.95, 0.9, 0.86][k], S = [1, 0.6, 0.47, 0.4][k]; sw = w * (w >= d ? L : S); sd = d * (w >= d ? S : L); }
    const c = form === 'rotunda' ? (i === 0 ? Math.min(sw, sd) * 0.18 : Math.min(sw, sd) / 2) : form === 'stream' ? Math.max(2.4, Math.min(sw, sd) * 0.24) : Math.max(1.5, Math.min(sw, sd) * (corner === 'notch' ? 0.12 : 0.16));
    tier(cx, cz, sw, sd, y, form === 'twin' ? towerTop : y1, { tint, seed: seed + i, style, dens, flood: 0, rib }, corner, c);
    if (form === 'twin') y1 = towerTop;
    if (!worker || i === n - 1) tier(cx, cz, sw + 0.9, sd + 0.9, y1 - 0.8, y1 + 0.26 + (seed % 5) * 0.035, { tint: cTint, seed: seed + 50, style: 3, dens: 0, flood: 0 }, corner, bandC(corner, c, 0.9), false);
    if (!worker && i === 0 && H > 20) tier(cx, cz, sw + 0.5, sd + 0.5, 4.6, 5.38, { tint: tint.map(v => v * 1.2), seed: seed + 51, style: 3, dens: 0, flood: 0.3 }, corner, bandC(corner, c, 0.5), false);
    top = { x: cx, z: cz, w: sw, d: sd };
    if (i < n - 1 && rib[0] + rib[1] + rib[2] > 0 && form !== 'zig' && corner !== 'round') crownFins(cx, cz, sw, sd, y1, 3.5, rib);
    if (i === 0) { firstTop = y1; c0 = corner === 'square' ? 0 : c; }
    if (i === 0 && !worker && H > 20 && form !== 'buttress' && form !== 'twin') { const rF = rr(); if (rF < 0.26 && corner === 'square' && style < 1.5) addOriels(cx, cz, sw, sd, 5.3, y1 - 0.8, style, dens, tint, seed, edges, rr, rib); else if (rF < 0.48 && corner === 'square' && style < 0.5 && H < 100) addBalconies(cx, cz, sw, sd, 5.3, y1 - 0.8, style, tint, seed, edges, rr); else if (rF < 0.93) facadeRelief(cx, cz, sw, sd, 5.3, y1 - 0.8, style, tint, seed + 61, edges, rr, corner, c); }
    if (i === 0 && !worker && !shopH && !arcade && H > 20 && dist < 700 && rr() < 0.45) { portal(cx, cz, sw, sd, edges, tint, rr, H > 90 ? 'hotel' : pickW(rr, [['shop', 3], ['restaurant', 2], ['cafe', 1.5], ['bar', 1]])); hasDoor = true; }
    if (i === 0 && worker && rr() < 0.35) { portal(cx, cz, sw, sd, edges, tint, rr, pickW(rr, [['pub', 2], ['workshop', 2], ['shop', 1]])); hasDoor = true; }
    if (i === 0 && !hasDoor) { if (core) houseDoor((core.x0 + core.x1) / 2, (core.z0 + core.z1) / 2, core.x1 - core.x0, core.z1 - core.z0, edges, tint, rr); else houseDoor(cx, cz, sw, sd, edges, tint, rr); hasDoor = true; }
    // Strebepfeiler: Mauerrippen über die ganze Höhe des Schafts, oben als kleine Fialen
    if (form === 'buttress' && i === 0) {
      const pt = tint.map(v => v * 1.22);
      for (const ax of [0, 1]) {
        const L = ax ? sd : sw, k = Math.max(2, Math.floor(L / 7));
        for (let j = 1; j < k; j++) {
          const u = -L / 2 + L * j / k;
          for (const sgn of [-1, 1]) {
            const px = ax ? cx + sgn * (sw / 2 + 0.4) : cx + u, pz = ax ? cz + u : cz + sgn * (sd / 2 + 0.4);
            addSeg({ x: px, z: pz, w: ax ? 0.8 : 1.0, d: ax ? 1.0 : 0.8, y0: 5.3, y1: y1 + 3.2, tint: pt, seed: seed + 60, style: 3, dens: 0, flood: 0.2 }, false);
            spires.push({ x: px, z: pz, y0: y1 + 3.2, h: 3.2, b: 0.8 });
          }
        }
      }
    }
    y = y1;
  }
  // Zwillingstürme auf gemeinsamem Sockel, verbunden durch eine Himmelsbrücke
  if (form === 'twin') {
    const alongX = w >= d, L = alongX ? w : d, S = alongX ? d : w;
    const tw = L * 0.34, td = S * 0.62, off = L * 0.27;
    let hiTop = null;
    for (const sgn of [-1, 1]) {
      const tx = alongX ? cx + sgn * off : cx, tz = alongX ? cz : cz + sgn * off;
      const HT = Math.round(H * (sgn < 0 ? 1 : 0.9) / 3.6) * 3.6 + 0.2;
      let yy = towerTop, ww = alongX ? tw : td, dd = alongX ? td : tw;
      for (let k = 0; k < 3; k++) {
        const y1 = k === 2 ? HT : Math.round((towerTop + (HT - towerTop) * [0.62, 0.86][k]) / 3.6) * 3.6 + 0.2;
        const cc = Math.min(ww, dd) * 0.16;
        tier(tx, tz, ww, dd, yy, y1, { tint, seed: seed + 70 + k, style, dens, flood: 0, rib }, 'chamfer', cc);
        tier(tx, tz, ww + 0.8, dd + 0.8, y1 - 0.7, y1 + 0.3, { tint: cTint, seed: seed + 50, style: 3, dens: 0, flood: 0 }, 'chamfer', bandC('chamfer', cc, 0.8), false);
        if (rib[0] + rib[1] + rib[2] > 0) crownFins(tx, tz, ww, dd, y1, 3, rib);
        yy = y1; ww *= 0.78; dd *= 0.78;
      }
      if (sgn > 0) { caps.push({ x: tx, z: tz, y: HT, w: ww * 1.1, d: dd * 1.1, h: Math.min(ww, dd) * 1.3, gold: rr() < 0.5 }); towers.push({ x: tx, z: tz, w: ww, d: dd, H: HT }); }
      else hiTop = { x: tx, z: tz, w: ww, d: dd };
    }
    const by = towerTop + (H * 0.9 - towerTop) * 0.55, gap = L * 2 * 0.27 - tw;
    addSeg({ x: cx, z: cz, w: alongX ? gap + 1 : 6, d: alongX ? 6 : gap + 1, y0: by, y1: by + 4.6, tint, seed: seed + 80, style: 2, dens: 0.9, flood: 0.5 }, true);
    neonFrame(cx, by + 4.6, cz, alongX ? gap : 6, alongX ? 6 : gap, NEON.gold);
    top = hiTop; H = Math.round(H / 3.6) * 3.6 + 0.2;
  }
  // Eckturm mit Kupferhaube an der Straßenecke
  if (form === 'corner') {
    const sx = edges.e ? 1 : -1, sz = edges.s ? 1 : -1, a = Math.min(w, d) * 0.34;
    const tx = cx + sx * (w / 2 - a / 2 + 0.6), tz = cz + sz * (d / 2 - a / 2 + 0.6), HT = Math.round(H * 1.4 / 3.6) * 3.6 + 0.2;
    tier(tx, tz, a, a, 0.2, HT, { tint, seed: seed + 90, style, dens, flood: 0.2, rib }, 'chamfer', a * 0.2);
    tier(tx, tz, a + 0.9, a + 0.9, HT - 0.8, HT + 0.3, { tint: cTint, seed: seed + 50, style: 3, dens: 0, flood: 0 }, 'chamfer', bandC('chamfer', a * 0.2, 0.9), false);
    caps.push({ x: tx, z: tz, y: HT + 0.3, w: a * 0.95, d: a * 0.95, h: a * 0.9, gold: rr() < 0.25 });
    addGlow(tx, HT + a * 0.9 + 0.8, tz, [1.4, 0.15, 0.1], 1.6, rr(), 1);
  }
  // Kuppel auf achteckigem Tambour
  if (form === 'dome') {
    const r = Math.min(top.w, top.d) * 0.36;
    tier(cx, cz, r * 2, r * 2, H, H + 6, { tint, seed: seed + 95, style: 2, dens: 0.9, flood: 0.6 }, 'chamfer', r * 0.3);
    domes.push({ x: cx, z: cz, y: H + 6, r: r * 0.98 });
    neonFrame(cx, H + 6, cz, r * 2, r * 2, NEON.gold);
  }
  if (form === 'rotunda') {
    const r = top.w / 2;
    tier(cx, cz, r * 1.3, r * 1.3, H, H + 5, { tint: cTint, seed: seed + 96, style: 2, dens: 0.9, flood: 0.6 }, 'round', r * 0.65);
    domes.push({ x: cx, z: cz, y: H + 5, r: r * 0.64 });
  }
  if (form === 'tiara') { tiaraCrown(top, H, tint, cTint, seed, rib, rr); top = { ...top, done: true }; }
  if (form === 'clock') clockTower(top, H, tint, cTint, seed, rr);
  if (form === 'zigtop') zigTop(top, H, tint, cTint, seed, rr);
  const tall = H > 70 && !top.done;
  roofs.push({ x: top.x, z: top.z, w: top.w, d: top.d, H, worker, dist, edges, fw: w, fd: d, shop: shopH, arcade, fx: cx, fz: cz, crown: form === 'tiara' || form === 'clock' || form === 'zigtop' });
  if (!worker && firstTop > 20 && dist < 760) BR_SPOTS.push({ x: cx, z: cz, w, d, top: firstTop });
  const nc = rib[0] + rib[1] + rib[2] > 0 ? rib.map(v => v * 1.5) : NEON[pick(neonPool)];
  if (tall || top.done) towers.push({ x: top.x, z: top.z, w: top.w, d: top.d, H });
  if (tall && (rib[0] + rib[1] + rib[2] > 0)) {
    crownFins(top.x, top.z, top.w, top.d, H, 4 + H * 0.05, rib);
    if (R() < 0.6) shafts.push({ x: top.x, z: top.z, y: H, h: 260 + H * 1.2, w: Math.min(top.w, top.d) * 0.7, c: rib });
  }
  if (tall) {
    const r = R();
    const tx = top.x, tz = top.z;
    if (form === 'dome' || form === 'rotunda') { if (r < 0.38) rand(0, 1); addGlow(tx, form === 'dome' ? H + 6 + Math.min(top.w, top.d) * 0.36 + 1 : H + 5 + top.w * 0.32 + 1, tz, [1.4, 0.15, 0.1], 2.5, R(), 1); }
    else if (r < 0.38) {
      const bw = Math.min(top.w, top.d) * 0.55, sh = H * rand(0.16, 0.28);
      spires.push({ x: tx, z: tz, y0: H, h: sh, b: bw });
      addCollider(tx - bw / 4, H, tz - bw / 4, tx + bw / 4, H + sh * 0.6, tz + bw / 4);
      addGlow(tx, H + sh + 0.5, tz, [1.4, 0.15, 0.1], 3, R(), 1);
    } else if (r < 0.7) {
      const lw = top.w * 0.4, ld = top.d * 0.4;
      tier(tx, tz, lw, ld, H, H + 9, { tint, seed: seed + 9, style: 2, dens: 0.95, flood: 0.4 }, corner === 'square' ? 'square' : 'chamfer', Math.min(lw, ld) * 0.2);
      neonFrame(tx, H + 9, tz, lw, ld, nc);
      if (rr() < 0.45) caps.push({ x: tx, z: tz, y: H + 9, w: lw, d: ld, h: Math.min(lw, ld) * 0.8, gold: rr() < 0.6 });
      addGlow(tx, H + 10, tz, [1.4, 0.15, 0.1], 2.5, R(), 1);
    } else {
      neonFrame(tx, H + 0.3, tz, top.w + 0.9, top.d + 0.9, nc);
      addGlow(tx, H + 1, tz, [1.4, 0.15, 0.1], 2.5, R(), 1);
    }
  } else if (!worker && H > 24 && form !== 'corner' && form !== 'clock' && form !== 'zigtop' && !top.done && rr() < 0.3) {
    caps.push({ x: cx, z: cz, y: H + 0.3, w: top.w * 0.7, d: top.d * 0.7, h: Math.min(top.w, top.d) * 0.32, gold: false });
  }
  if (H > 40 && dist < 650 && R() < 0.28) {
    const c = NEON[pick(neonPool)], y1 = firstTop;
    if (corner !== 'round') for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { addNeon(cx + sx * (w / 2 + 0.1), (0.2 + y1) / 2 + 2.3, cz + sz * (d / 2 + 0.1), 0.28, y1 - 4.6, 0.28, c); neons[neons.length - 1].deco = true; }
  }
  const sctx = { s0, n0, c: c0, top: firstTop };
  if (worker && form === 'classic' && H < 22 && rr() < 0.4) caps.push({ x: top.x, z: top.z, y: H + 0.3, w: top.w + 0.6, d: top.d + 0.6, h: Math.min(top.w, top.d) * 0.28, slate: true });
  if (worker) { if (R() < 0.3) placeSign(cx, cz, w, d, edges, true, sctx); if (R() < 0.5) steamPts.push({ x: cx + (R() < 0.5 ? -1 : 1) * (w / 2 + 2), z: cz + rand(-d / 3, d / 3) }); }
  else if (dist < 700 && R() < 0.42) placeSign(cx, cz, w, d, edges, false, sctx);
}
// V23 · Tiara: fünf gestaffelte Kronenringe mit Goldkanten und Lichtflossen, darüber eine schlanke Nadel
export function tiaraCrown(top, H, tint, cTint, seed, rib, rr) {
  let w = top.w * 0.86, d = top.d * 0.86, y = H;
  const gold = rr() < 0.55, col = rib[0] + rib[1] + rib[2] > 0 ? rib : NEON.gold;
  for (let k = 0; k < 5; k++) {
    const h = 4.4 - k * 0.45;
    tier(top.x, top.z, w, d, y, y + h, { tint: k % 2 ? cTint : tint, seed: seed + 200 + k, style: 2, dens: 0.85, flood: 0.7, rib: col }, 'chamfer', Math.min(w, d) * 0.22);
    neonFrame(top.x, y + h, top.z, w, d, gold ? NEON.gold : col);
    crownFins(top.x, top.z, w, d, y + h, 2.2, col);
    y += h; w *= 0.8; d *= 0.8;
  }
  const b = Math.min(w, d) * 0.9, sh = 18 + H * 0.12;
  spires.push({ x: top.x, z: top.z, y0: y, h: sh, b });
  addGlow(top.x, y + sh + 0.6, top.z, [1.4, 0.15, 0.1], 3, R(), 1);
  shafts.push({ x: top.x, z: top.z, y: y, h: 220 + H, w: Math.min(top.w, top.d) * 0.5, c: gold ? [1.0, 0.8, 0.45] : col });
}
// V23 · Uhrturm: quadratischer Turm auf dem Dach mit vier beleuchteten Zifferblättern und Kupferhaube
export const CLOCKS = [];
export function clockTower(top, H, tint, cTint, seed, rr) {
  const a = Math.max(5, Math.min(top.w, top.d) * 0.36), th = Math.max(12, H * 0.42);
  tier(top.x, top.z, a, a, H, H + th, { tint, seed: seed + 210, style: 1, dens: 0.4, flood: 0.6 }, 'chamfer', a * 0.14);
  tier(top.x, top.z, a + 0.8, a + 0.8, H + th - 0.6, H + th + 0.3, { tint: cTint, seed: seed + 211, style: 3, dens: 0, flood: 0.4 }, 'chamfer', bandC('chamfer', a * 0.14, 0.8), false);
  tier(top.x, top.z, a * 0.86, a * 0.86, H + th + 0.3, H + th + 4.2, { tint: cTint, seed: seed + 212, style: 3, dens: 0, flood: 0.8 }, 'chamfer', a * 0.12);
  CLOCKS.push({ x: top.x, z: top.z, y: H + th + 2.2, r: a * 0.3, half: a * 0.43 + 0.04 });
  caps.push({ x: top.x, z: top.z, y: H + th + 4.2, w: a * 0.9, d: a * 0.9, h: a * 1.2, gold: rr() < 0.3 });
  towers.push({ x: top.x, z: top.z, w: a, d: a, H: H + th });
}
// V23 · Stufenpyramide: drei Absätze mit Goldkante und Laterne obenauf
export function zigTop(top, H, tint, cTint, seed, rr) {
  let w = top.w * 0.78, d = top.d * 0.78, y = H + 0.3;
  for (let k = 0; k < 3; k++) {
    const h = 2.6 + k * 0.4;
    addSeg({ x: top.x, z: top.z, w, d, y0: y - 0.3, y1: y + h, tint: k % 2 ? tint : cTint, seed: seed + 220 + k, style: 3, dens: 0, flood: 0.6 }, false);
    neonFrame(top.x, y + h, top.z, w, d, NEON.gold);
    y += h; w *= 0.7; d *= 0.7;
  }
  tier(top.x, top.z, Math.max(2, w), Math.max(2, d), y, y + 3.4, { tint: cTint, seed: seed + 224, style: 2, dens: 0.95, flood: 0.8 }, 'square');
  addGlow(top.x, y + 4.2, top.z, [1.4, 0.15, 0.1], 2.2, rr(), 1);
}
// V23 · Häuserzeile: zwei bis fünf schmale Häuser nebeneinander, jedes mit eigener Höhe, Farbe, Flucht, Tür und Dach
export function rowHouses(cx, cz, w, d, H, dist, edges, worker, tint0, rr) {
  const alongX = w >= d, L = alongX ? w : d, D = alongX ? d : w;
  const k = Math.max(2, Math.min(5, Math.round(L / (worker ? 8.5 : 10.5))));
  const cuts = [0]; for (let i = 1; i < k; i++) cuts.push(L * i / k + (rr() - 0.5) * L / k * 0.35); cuts.push(L);
  let lastH = -1;
  for (let i = 0; i < k; i++) {
    const u0 = cuts[i], u1 = cuts[i + 1], len = u1 - u0;
    let h = Math.max(worker ? 7.4 : 11, Math.round((H + (rr() - 0.5) * 9) / 3.6) * 3.6 + 0.2);
    if (Math.abs(h - lastH) < 1) h += rr() < 0.5 || h < 12 ? 3.6 : -3.6;
    lastH = h;
    const set = rr() * 1.1, dd = D - set, du = (u0 + u1) / 2 - L / 2, s0 = segs.length;
    const tint = (worker ? pick(BRICK) : pick(STONES)).map(v => v * (0.9 + rr() * 0.2));
    // Zurücksetzen von der Straßenseite (n bei alongX, sonst w); die Tiefe schrumpft dafür hinten
    const sideA = alongX ? (edges.n ? -1 : 1) : (edges.w ? -1 : 1);
    const px = alongX ? cx + du : cx - sideA * set / 2, pz = alongX ? cz - sideA * set / 2 : cz + du;
    const sw = alongX ? len : dd, sd = alongX ? dd : len;
    const e = { n: alongX ? edges.n : (i === 0 && edges.n), s: alongX ? edges.s : (i === k - 1 && edges.s), w: alongX ? (i === 0 && edges.w) : edges.w, e: alongX ? (i === k - 1 && edges.e) : edges.e };
    const seed = Math.floor(rr() * 1000), style = worker ? 0 : (rr() < 0.4 ? 1 : 0);
    const dens = worker ? 0.3 + rr() * 0.25 : 0.2 + rr() * 0.3;
    addSeg({ x: px, z: pz, w: sw, d: sd, y0: 0.2, y1: h, tint, seed, style, dens, flood: 0, rib: [0, 0, 0] });
    // Gesims (Breite leicht verschieden, damit Nachbargesimse nicht deckungsgleich liegen)
    const pad = 0.5 + 0.08 * (i % 3);
    addSeg({ x: px, z: pz, w: sw + pad, d: sd + pad, y0: h - 0.7, y1: h + 0.25, tint: tint.map(v => v * 1.18), seed: seed + 50, style: 3, dens: 0, flood: 0 }, false);
    if (!worker && h > 14) addSeg({ x: px, z: pz, w: sw + 0.36 + 0.04 * (i % 2), d: sd + 0.36 + 0.04 * (i % 2), y0: 4.6, y1: 5.2, tint: tint.map(v => v * 1.2), seed: seed + 51, style: 3, dens: 0, flood: 0.3 }, false);
    houseDoor(px, pz, sw, sd, e, tint, rr);
    const roof = rr();
    if (roof < 0.45) caps.push({ x: px, z: pz, y: h + 0.25, w: sw + 0.3, d: sd + 0.3, h: Math.min(sw, sd) * (0.3 + rr() * 0.15), slate: true });
    else if (roof < 0.6 && !worker) caps.push({ x: px, z: pz, y: h + 0.25, w: sw * 0.8, d: sd * 0.8, h: Math.min(sw, sd) * 0.25, gold: false });
    roofs.push({ x: px, z: pz, w: sw, d: sd, H: h + 0.25, worker: worker || roof < 0.45, dist, edges: e, fw: sw, fd: sd, shop: false, arcade: false, fx: px, fz: pz });
    if (rr() < (worker ? 0.35 : 0.25)) placeSign(px, pz, sw, sd, e, worker, { s0, n0: neons.length, c: 0, top: h });
    if (worker && rr() < 0.4) steamPts.push({ x: px + (alongX ? 0 : sideA * (sw / 2 + 1.5)), z: pz + (alongX ? sideA * (sd / 2 + 1.5) : 0) });
  }
}
// Zinnen und Flossen an der Krone, in Art-Deco-Staffelung
export function crownFins(x, z, w, d, y, h, c) {
  const col = c.map(v => v * 0.9);
  const nx = Math.max(2, Math.floor(w / 6)), nz = Math.max(2, Math.floor(d / 6));
  for (let i = 0; i <= nx; i++) {
    const fx = x - w / 2 + w * i / nx, k = 1 - Math.abs(i / nx - 0.5) * 0.9;
    for (const sz of [-1, 1]) addNeon(fx, y + h * k / 2, z + sz * (d / 2 - 0.3), 0.6, h * k, 0.8, col);
  }
  for (let i = 1; i < nz; i++) {
    const fz = z - d / 2 + d * i / nz, k = 1 - Math.abs(i / nz - 0.5) * 0.9;
    for (const sx of [-1, 1]) addNeon(x + sx * (w / 2 - 0.3), y + h * k / 2, fz, 0.8, h * k, 0.6, col);
  }
}
export function neonFrame(x, y, z, w, d, c) {
  addNeon(x, y + 0.15, z - d / 2, w + 0.3, 0.3, 0.3, c);
  addNeon(x, y + 0.15, z + d / 2, w + 0.3, 0.3, 0.3, c);
  addNeon(x - w / 2, y + 0.15, z, 0.3, 0.3, d + 0.3, c);
  addNeon(x + w / 2, y + 0.15, z, 0.3, 0.3, d + 0.3, c);
}

/* ---------- Leuchtreklame ---------- */
export const WORKER_WORDS = ['BRASS LANTERN', 'WERKSTATT', 'GARAGE', 'BAR', 'PFANDHAUS', 'DAMPFBAD', 'KOHLE & EISEN', 'SPEISEHAUS'];
export const SIGN_WORDS = ['HOTEL', 'CAFÉ', 'JAZZ', 'ODEON', 'LUMIÈRE', 'BAR', 'KINO', 'TANZ', 'AURORA', 'ORPHEUM', 'SALON', 'CASINO', 'REVUE', 'ÉTOILE', 'TABAK', 'PALAIS', 'NOCTURNE', 'VARIÉTÉ'];
export const signTex = {};
export const signDefs = [];
export function makeSignTex(word, color, vertical) {
  const key = word + color + vertical;
  if (signTex[key]) return signTex[key];
  const chars = [...word];
  const W = vertical ? 128 : 96 * chars.length + 80, H = vertical ? 104 * chars.length + 60 : 150;
  const t = canvasTex(W, H, (g) => {
    g.fillStyle = '#0d0a1c'; g.fillRect(0, 0, W, H);
    g.strokeStyle = color; g.lineWidth = 6; g.shadowColor = color; g.shadowBlur = 18;
    g.strokeRect(10, 10, W - 20, H - 20);
    g.lineWidth = 2; g.strokeRect(22, 22, W - 44, H - 44);
    g.fillStyle = '#fff6e6'; g.font = '84px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowBlur = 26;
    if (vertical) chars.forEach((ch, i) => g.fillText(ch, W / 2, 30 + 104 * i + 56));
    else g.fillText(word, W / 2, H / 2 + 6);
  });
  return signTex[key] = { t, W, H };
}
// V23: Schilder bekommen einen freien Platz an der Fassade. Früher hingen sie an fester Stelle und Portale, Pilaster,
// Erker oder Balkone ragten durch die Schrift. Jetzt: Seite und Lage durchprobieren, bis nichts im Weg ist; nur reine
// Zierteile (deco) dürfen weichen, Portale und Türen nie. Findet sich kein Platz, bleibt das Haus ohne Schild.
export function signSize(word, vertical) {
  const n = [...word].length, W = vertical ? 128 : 96 * n + 80, H = vertical ? 104 * n + 60 : 150;
  return { W, H };
}
export function segBox(sg) {
  if (!sg.ry) return [sg.x - sg.w / 2, sg.y0, sg.z - sg.d / 2, sg.x + sg.w / 2, sg.y1, sg.z + sg.d / 2];
  const c = Math.abs(Math.cos(sg.ry)), sn = Math.abs(Math.sin(sg.ry)), hx = c * sg.w / 2 + sn * sg.d / 2, hz = sn * sg.w / 2 + c * sg.d / 2;
  return [sg.x - hx, sg.y0, sg.z - hz, sg.x + hx, sg.y1, sg.z + hz];
}
export const boxHit = (a, b) => a[0] < b[3] && a[3] > b[0] && a[1] < b[4] && a[4] > b[1] && a[2] < b[5] && a[5] > b[2];
export function placeSign(cx, cz, w, d, edges, worker = false, ctx = null) {
  const sides = Object.keys(edges).filter(k => edges[k]);
  if (!sides.length) return;
  const side = pick(sides), word = worker ? pick(WORKER_WORDS) : pick(SIGN_WORDS);
  const color = worker ? pick(['#f6c76a', '#ffb36b', '#ffd9a0']) : pick(['#f6c76a', '#f6c76a', '#7ff0e6', '#ffb36b', '#fff1cc']);
  let vertical = worker ? false : R() < 0.55;
  const u0 = R();
  if (!ctx) { signDefs.push({ cx, cz, w, d, side, word, color, vertical, off: 0, wd: null }); return; }
  const blockers = [];
  for (let i = ctx.s0; i < segs.length; i++) { const sg = segs[i]; if (!sg.dead) blockers.push({ b: segBox(sg), sg }); }
  for (let i = ctx.n0; i < neons.length; i++) { const n = neons[i]; blockers.push({ b: [n.x - n.sx / 2, n.y - n.sy / 2, n.z - n.sz / 2, n.x + n.sx / 2, n.y + n.sy / 2, n.z + n.sz / 2], n }); }
  // Schilderkasten in Weltkoordinaten: t = Abstand von der Fassade, u = Lage entlang der Fassade
  const boxFor = (sd, u, vert, wd, h) => {
    const out = SIDE_OUT[sd], ax = out[0] !== 0, fx = cx + out[0] * w / 2, fz = cz + out[1] * d / 2;
    const t0 = vert ? 0.3 : 0.3, t1 = vert ? 0.3 + wd : 0.5, ua = vert ? u - 0.12 : u - wd / 2, ub = vert ? u + 0.12 : u + wd / 2;
    const y0 = vert ? 6 : 4.65, y1 = vert ? 6 + h : 4.75 + h;
    const p = (t, uu) => ax ? [fx + out[0] * t, cz + uu] : [cx + uu, fz + out[1] * t];
    const A = p(t0, ua), B = p(t1, ub);
    return [Math.min(A[0], B[0]), y0, Math.min(A[1], B[1]), Math.max(A[0], B[0]), y1, Math.max(A[1], B[1])];
  };
  const order = [side, ...sides.filter(q => q !== side)];
  const tryPlace = (vert, allowDeco) => {
    const { W, H } = signSize(word, vert);
    for (const sd of order) {
      const out = SIDE_OUT[sd], L = out[0] !== 0 ? d : w, flat = L / 2 - (ctx.c || 0);
      let wd, h, lim;
      if (vert) { h = 1.6 * H / 104; wd = h * W / H; lim = Math.min(L / 2 - 3, flat - 0.6) * 0.8; if (6 + h > ctx.top - 1.0) continue; }
      else { wd = Math.min(Math.min(L, 2 * flat) - 4, W / 60); h = wd * H / W; lim = Math.min(L, 2 * flat) / 2 - 2 - wd / 2; if (wd < 2.5) continue; }
      if (lim < 0) continue;
      const cand = [(u0 * 2 - 1) * lim]; for (let k = 0; k <= 8; k++) cand.push(-lim + 2 * lim * k / 8);
      if (!vert) cand.unshift(0);
      for (const u of cand) {
        const bx = boxFor(sd, u, vert, wd, h), hits = blockers.filter(q => boxHit(bx, q.b));
        if (hits.some(q => !(q.sg && q.sg.deco) && !(q.n && q.n.deco))) continue;
        if (hits.length && !allowDeco) continue;
        const grp = new Set(hits.filter(q => q.sg).map(q => q.sg.deco));
        for (const q of hits) if (q.n) q.n.dead = true;
        for (const q of blockers) if (q.sg && q.sg.deco && grp.has(q.sg.deco)) q.sg.dead = true;
        signDefs.push({ cx, cz, w, d, side: sd, word, color, vertical: vert, off: u, wd, h });
        return true;
      }
    }
    return false;
  };
  if (tryPlace(vertical, false) || tryPlace(!vertical && !worker, false) || tryPlace(vertical, true) || (!worker && tryPlace(!vertical, true))) return;
}
export const SIDE_OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
export function buildSigns() {
  const frames = [];
  for (const s of signDefs) {
    const tex = makeSignTex(s.word, s.color, s.vertical);
    const mat = new T.MeshBasicMaterial({ map: tex.t, color: new T.Color(1.35, 1.35, 1.35), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
    const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[s.side];
    const fx = s.cx + out[0] * s.w / 2, fz = s.cz + out[1] * s.d / 2;
    if (s.vertical) {
      const h = 1.6 * tex.H / 104 * 1.0, wd = h * tex.W / tex.H;
      const geo = new T.PlaneGeometry(wd, h);
      const off = s.off;
      const px = out[0] !== 0 ? fx + out[0] * (wd / 2 + 0.3) : fx + off;
      const pz = out[1] !== 0 ? fz + out[1] * (wd / 2 + 0.3) : fz + off;
      const ry = out[0] !== 0 ? 0 : Math.PI / 2, nx = Math.sin(ry), nz = Math.cos(ry);
      for (const flip of [0, Math.PI]) {
        const m = new T.Mesh(geo, mat), sg = flip ? -1 : 1;
        m.position.set(px + nx * 0.065 * sg, 6 + h / 2, pz + nz * 0.065 * sg);
        m.rotation.y = ry + flip;
        scene.add(m);
      }
      // V23: Rahmen aus dunkler Bronze, zwei Ausleger zur Wand
      frames.push(new T.BoxGeometry(wd + 0.18, h + 0.18, 0.11).rotateY(ry).translate(px, 6 + h / 2, pz));
      for (const yy of [6 + h - 0.35, 6 + 0.35]) frames.push(new T.BoxGeometry(0.34, 0.07, 0.07).rotateY(ry).translate(fx + out[0] * 0.17 + (out[0] !== 0 ? 0 : off), yy, fz + out[1] * 0.17 + (out[0] !== 0 ? off : 0)));
      addGlow(px, 6 + h / 2, pz, hexToArr(s.color, 0.35), h * 1.3);
    } else {
      const wd = s.wd || Math.min((out[0] !== 0 ? s.d : s.w) - 4, tex.W / 60), h = wd * tex.H / tex.W;
      const m = new T.Mesh(new T.PlaneGeometry(wd, h), mat);
      const px = fx + out[0] * 0.42 + (out[0] !== 0 ? 0 : s.off || 0), pz = fz + out[1] * 0.42 + (out[0] !== 0 ? s.off || 0 : 0), ry = Math.atan2(out[0], out[1]);
      m.position.set(px, 4.5 + h / 2 + 0.2, pz);
      m.rotation.y = ry;
      scene.add(m);
      frames.push(new T.BoxGeometry(wd + 0.2, h + 0.2, 0.1).translate(0, 0, -0.1).rotateY(ry).translate(px, 4.5 + h / 2 + 0.2, pz));
    }
  }
  if (frames.length) { const fm = new T.Mesh(mergeGeos(frames), stdMat({ color: 0x3a2a16, metalness: 0.7, roughness: 0.4, envI: 0.6 })); fm.frustumCulled = false; scene.add(fm); }
}
export function hexToArr(hex, k = 1) { const c = new T.Color(hex); return [c.r * k, c.g * k, c.b * k]; }

// Das Belmont-Symbol: Sonnenstrahl-Fächer
export const FAN_TEX = canvasTex(512, 256, (g, W, H) => {
  g.clearRect(0, 0, W, H);
  g.translate(W / 2, H);
  for (let i = 0; i < 15; i++) {
    const a = Math.PI + (i + 0.5) / 15 * Math.PI;
    g.save(); g.rotate(a);
    const gr = g.createLinearGradient(0, 0, H, 0); gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(1, 'rgba(255,190,90,0.15)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(14, -3); g.lineTo(H - 6, -9); g.lineTo(H - 6, 9); g.lineTo(14, 3); g.fill(); g.restore();
  }
  g.strokeStyle = 'rgba(255,225,150,1)'; g.lineWidth = 5;
  for (const r of [40, 140, 246]) { g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.stroke(); }
});
