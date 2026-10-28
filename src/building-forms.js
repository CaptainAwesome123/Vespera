'use strict';
/* =====================================================================
   V19 · GEBÄUDEVIELFALT UND ERSCHLIESSUNG: Erker über mehrere Geschosse,
   Balkone mit Brüstung, Arkaden-Erdgeschosse mit Säulengang, einfache Haustüren
   mit Stufe, Laterne und Türblatt für jedes Haus ohne Portal oder Laden
   ===================================================================== */
const HOUSE_DOORS = [];   // {fx, fz, o, tint}
const V19_DBG = { oriel: [], balc: [], arcade: [] };
// Fensterraster des Shaders nachrechnen (wie facadeRelief), damit Anbauten auf den Achsen sitzen
function winGrid(L, style) {
  const cw = style < 0.5 ? 3.2 : 2.4, margin = 1.0, usable = Math.max(L - 2 * margin, 1), nc = Math.max(1, Math.floor(usable / cw));
  return { nc, cellW: usable / nc, margin };
}
const SIDE_O = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
// Erker: vorspringende Fensterkästen über mehrere Geschosse, mit Konsole unten und Dach oben
function addOriels(cx, cz, sw, sd, y0, y1, style, dens, tint, seed, edges, rr, rib) {
  if (y1 - y0 < 12) return;
  V19_DBG.oriel.push([cx, cz, sw, sd]);
  const deep = 0.9, wide = style < 0.5 ? 2.5 : 2.0, ct = tint.map(v => v * 1.1);
  const yb = y0 + 3.6 * (1 + Math.floor(rr() * 2)), yt = Math.min(y1 - 3.6, yb + 3.6 * (3 + Math.floor(rr() * 5)));
  if (yt - yb < 7) return;
  for (const side of ['n', 's', 'w', 'e']) {
    if (!edges[side] || rr() < 0.3) continue;
    const o = SIDE_O[side], ax = o[0] !== 0, L = ax ? sd : sw, g = winGrid(L, style);
    const every = g.nc > 7 ? 3 : 2, start = g.nc > 4 ? 1 : 0;
    for (let k = start; k < g.nc; k += every) {
      if (g.nc > 3 && (k === 0 || k === g.nc - 1)) continue;
      const u = -L / 2 + g.margin + (k + 0.5) * g.cellW;
      const px = ax ? cx + o[0] * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + o[1] * (sd / 2 + deep / 2);
      addSeg({ x: px, z: pz, w: ax ? deep : wide, d: ax ? wide : deep, y0: yb, y1: yt, tint, seed: seed + 120 + k, style, dens, flood: 0, rib: [0, 0, 0] }, false);
      // Konsole unten (abgeschrägt) und Dachplatte oben
      addSeg({ x: px - o[0] * 0.15, z: pz - o[1] * 0.15, w: ax ? deep - 0.3 : wide - 0.4, d: ax ? wide - 0.4 : deep - 0.3, y0: yb - 0.7, y1: yb, tint: ct, seed: seed + 121, style: 3, dens: -1, flood: 0, rib: [0, 0, 0] }, false);
      addSeg({ x: px, z: pz, w: ax ? deep + 0.3 : wide + 0.4, d: ax ? wide + 0.4 : deep + 0.3, y0: yt, y1: yt + 0.25, tint: ct, seed: seed + 122, style: 3, dens: -1, flood: 0, rib: [0, 0, 0] }, false);
    }
  }
}
// Balkone: auskragende Platten mit massiver Art-Déco-Brüstung, jedes zweite Geschoss, auf jeder zweiten Achse
function addBalconies(cx, cz, sw, sd, y0, y1, style, tint, seed, edges, rr) {
  const deep = 1.1, ct = tint.map(v => v * 1.15), railT = tint.map(v => v * 0.75);
  const sides = ['n', 's', 'w', 'e'].filter(s => edges[s]); if (!sides.length) return;
  V19_DBG.balc.push([cx, cz, sw, sd]);
  const use = sides.length > 1 && rr() < 0.5 ? [sides[Math.floor(rr() * sides.length)]] : sides;
  const off = rr() < 0.5 ? 0 : 1;
  for (const side of use) {
    const o = SIDE_O[side], ax = o[0] !== 0, L = ax ? sd : sw, g = winGrid(L, style);
    const wide = Math.min(g.cellW * 0.86, 3.0);
    for (let yy = y0 + 3.6 * 2 - 0.05; yy < y1 - 3.0; yy += 7.2) {
      for (let k = off; k < g.nc; k += 2) {
        const u = -L / 2 + g.margin + (k + 0.5) * g.cellW;
        const px = ax ? cx + o[0] * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + o[1] * (sd / 2 + deep / 2);
        addSeg({ x: px, z: pz, w: ax ? deep : wide, d: ax ? wide : deep, y0: yy, y1: yy + 0.18, tint: ct, seed: seed + 130, style: 3, dens: -1, flood: 0, rib: [0, 0, 0] }, false);
        const rx = ax ? cx + o[0] * (sw / 2 + deep - 0.06) : cx + u, rz = ax ? cz + u : cz + o[1] * (sd / 2 + deep - 0.06);
        addSeg({ x: rx, z: rz, w: ax ? 0.12 : wide, d: ax ? wide : 0.12, y0: yy + 0.18, y1: yy + 1.05, tint: railT, seed: seed + 131, style: 3, dens: -1, flood: 0, rib: [0, 0, 0] }, false);
        for (const s of [-1, 1]) addSeg({ x: ax ? px : cx + u + s * (wide / 2 - 0.06), z: ax ? cz + u + s * (wide / 2 - 0.06) : pz, w: ax ? deep : 0.12, d: ax ? 0.12 : deep, y0: yy + 0.18, y1: yy + 1.05, tint: railT, seed: seed + 132, style: 3, dens: -1, flood: 0, rib: [0, 0, 0] }, false);
      }
    }
  }
}
// Arkade: Erdgeschoss um 3,5 m zurückgesetzt, davor eine Reihe Pfeiler, darunter Licht; der Gehweg läuft durch
function addArcade(cx, cz, sw, sd, edges, tint, seed, dens, rr) {
  const A = 3.5, ct = tint.map(v => v * 1.12); V19_DBG.arcade.push([cx, cz, sw, sd]);
  const ins = { n: edges.n ? A : 0, s: edges.s ? A : 0, w: edges.w ? A : 0, e: edges.e ? A : 0 };
  const x0 = cx - sw / 2 + ins.w, x1 = cx + sw / 2 - ins.e, z0 = cz - sd / 2 + ins.n, z1 = cz + sd / 2 - ins.s;
  addSeg({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, y0: 0.2, y1: 5.3, tint, seed: seed + 140, style: 0, dens: 0.4, flood: 0, rib: [0, 0, 0] }, true);
  for (const side of ['n', 's', 'w', 'e']) {
    if (!edges[side]) continue;
    const o = SIDE_O[side], ax = o[0] !== 0, L = ax ? sd : sw, n = Math.max(2, Math.round(L / 4.6));
    for (let k = 0; k <= n; k++) {
      const u = -L / 2 + 0.5 + (L - 1.0) * k / n;
      const px = ax ? cx + o[0] * (sw / 2 - 0.5) : cx + u, pz = ax ? cz + u : cz + o[1] * (sd / 2 - 0.5);
      addSeg({ x: px, z: pz, w: 1.0, d: 1.0, y0: 0.2, y1: 5.3, tint: ct, seed: seed + 141 + k, style: 3, dens: -1, flood: 0.4, rib: [0, 0, 0] }, true);
      addSeg({ x: px, z: pz, w: 1.3, d: 1.3, y0: 4.9, y1: 5.3, tint: ct, seed: seed + 142, style: 3, dens: -1, flood: 0.4, rib: [0, 0, 0] }, false);
      addSeg({ x: px, z: pz, w: 1.2, d: 1.2, y0: 0.2, y1: 0.9, tint: ct.map(v => v * 0.8), seed: seed + 143, style: 3, dens: -1, flood: 0.2, rib: [0, 0, 0] }, false);
      if (k < n) { const um = u + (L - 1.0) / n / 2; const lx = ax ? cx + o[0] * (sw / 2 - A / 2) : cx + um, lz = ax ? cz + um : cz + o[1] * (sd / 2 - A / 2); addGlow(lx, 4.6, lz, [1.3, 0.9, 0.5], 1.2); lamps.push({ x: lx, z: lz, h: 0, wall: true }); }
    }
  }
  return { x0, x1, z0, z1 };
}
// Einfache Haustür: Gewände aus hellem Stein, Türblatt aus dunklem Holz, Oberlicht, Stufe, Laterne; Hausnummer
function houseDoor(cx, cz, sw, sd, edges, tint, rr, kind = 'house') {
  const sides = Object.keys(edges).filter(k => edges[k]); if (!sides.length) return;
  const side = sides[Math.floor(rr() * sides.length)], o = SIDE_O[side], ax = o[0] !== 0, L = ax ? sd : sw;
  const u = (rr() - 0.5) * Math.max(0, L - 8);
  const fx = cx + o[0] * sw / 2 + (ax ? 0 : u), fz = cz + o[1] * sd / 2 + (ax ? u : 0);
  const ct = tint.map(v => v * 1.25);
  const S = (a, b, y0, y1, off, t) => addSeg({ x: fx + o[0] * off + (ax ? 0 : 0), z: fz + o[1] * off, w: ax ? b : a, d: ax ? a : b, y0, y1, tint: t, seed: 995, style: 3, dens: -1, flood: 0.3, rib: [0, 0, 0] }, false);
  for (const s of [-1, 1]) addSeg({ x: fx + o[0] * 0.2 + (ax ? 0 : s * 1.25), z: fz + o[1] * 0.2 + (ax ? s * 1.25 : 0), w: ax ? 0.4 : 0.4, d: 0.4, y0: 0.2, y1: 3.9, tint: ct, seed: 996, style: 3, dens: -1, flood: 0.3, rib: [0, 0, 0] }, false);
  S(2.9, 0.45, 3.5, 4.1, 0.22, ct);
  HOUSE_DOORS.push({ fx, fz, o, tint });
  addGlow(fx + o[0] * 0.5, 3.1, fz + o[1] * 0.5, [1.3, 0.9, 0.5], 1.0);
  DOORS.push({ x: fx + o[0] * 0.4, z: fz + o[1] * 0.4, nx: o[0], nz: o[1], kind });
}
// Türblätter, Stufen und Laternen der Haustüren (ein Mesh je Material)
function buildHouseDoors() {
  if (!HOUSE_DOORS.length) return;
  const wood = [], gold = [], stone = [], glass = [];
  for (const D of HOUSE_DOORS) {
    const { fx, fz, o } = D, ax = -o[1], az = o[0], ry = Math.atan2(o[0], o[1]);
    const put = (arr, g, lx, y, lz) => arr.push(g.rotateY(ry).translate(fx + ax * lx + o[0] * lz, y, fz + az * lx + o[1] * lz));
    put(stone, new T.BoxGeometry(3.2, 0.16, 0.9), 0, 0.3, 0.45);
    put(wood, new T.BoxGeometry(2.0, 3.0, 0.1), 0, 1.72, 0.1);
    for (const s of [-1, 1]) { put(wood, new T.BoxGeometry(0.72, 0.9, 0.04), s * 0.48, 2.5, 0.16); put(wood, new T.BoxGeometry(0.72, 1.2, 0.04), s * 0.48, 1.0, 0.16); }
    put(gold, new T.BoxGeometry(0.03, 0.3, 0.05), 0.22, 1.3, 0.18); put(gold, new T.SphereGeometry(0.04, 8, 6), 0.72, 1.25, 0.2);
    put(glass, new T.BoxGeometry(2.0, 0.55, 0.04), 0, 3.22, 0.12); put(gold, new T.BoxGeometry(2.1, 0.05, 0.08), 0, 2.98, 0.14);
    for (let k = 1; k < 5; k++) put(gold, new T.BoxGeometry(0.03, 0.56, 0.03), -1.0 + k * 0.4, 3.22, 0.14);
    put(gold, new T.BoxGeometry(0.2, 0.36, 0.2), 0, 3.1, 0.55); put(gold, new T.BoxGeometry(0.04, 0.04, 0.5), 0, 3.3, 0.28);
    put(gold, new T.BoxGeometry(0.22, 0.14, 0.02), 1.0, 3.6, 0.2);
  }
  const add = (list, mat) => { if (!list.length) return; const m = new T.Mesh(mergeGeos(list), mat); m.frustumCulled = false; scene.add(m); };
  add(stone, stdMat({ color: 0x85827d, roughness: 0.75, envI: 0.3 }));
  add(wood, stdMat({ color: 0x2a1a10, roughness: 0.45, envI: 0.5 }));
  add(gold, MAT.gold);
  add(glass, stdMat({ color: 0x1a1408, metalness: 0.5, roughness: 0.15, envI: 1.2, emissive: 0x3a2408 }));
}
