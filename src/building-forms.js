import { T, mergeGeos, scene } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { addSeg, addGlow, lamps } from './facade-shader.js';
import { DOORS } from './entrances.js';
import { decoHouseDoor } from './deco.js';

/* =====================================================================
   V19 · GEBÄUDEVIELFALT UND ERSCHLIESSUNG: Erker über mehrere Geschosse,
   Balkone mit Brüstung, Arkaden-Erdgeschosse mit Säulengang, einfache Haustüren
   mit Stufe, Laterne und Türblatt für jedes Haus ohne Portal oder Laden
   ===================================================================== */
export const HOUSE_DOORS = [];   // {fx, fz, o, tint}
export const V19_DBG = { oriel: [], balc: [], arcade: [] };
// Fensterraster des Shaders nachrechnen (wie facadeRelief), damit Anbauten auf den Achsen sitzen
export function winGrid(L, style) {
  const cw = style < 0.5 ? 3.2 : 2.4, margin = 1.0, usable = Math.max(L - 2 * margin, 1), nc = Math.max(1, Math.floor(usable / cw + 0.002));   // V43: wie im Fassaden-Shader (gleiche Zellzahl)
  return { nc, cellW: usable / nc, margin };
}
export const DECO = { g: 1 };   // V23: Gruppennummer zusammengehöriger Zierteile (Erker mit Konsole und Dach, Balkon mit Brüstung)
export const SIDE_O = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
// Erker: vorspringende Fensterkästen über mehrere Geschosse, mit Konsole unten und Dach oben
export function addOriels(cx, cz, sw, sd, y0, y1, style, dens, tint, seed, edges, rr, rib) {
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
      const px = ax ? cx + o[0] * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + o[1] * (sd / 2 + deep / 2), dg = DECO.g++;
      addSeg({ x: px, z: pz, w: ax ? deep : wide, d: ax ? wide : deep, y0: yb, y1: yt, tint, seed: seed + 120 + k, style, dens, flood: 0, rib: [0, 0, 0], deco: dg }, false);
      // Konsole unten (abgeschrägt) und Dachplatte oben
      addSeg({ x: px - o[0] * 0.15, z: pz - o[1] * 0.15, w: ax ? deep - 0.3 : wide - 0.4, d: ax ? wide - 0.4 : deep - 0.3, y0: yb - 0.7, y1: yb, tint: ct, seed: seed + 121, style: 3, dens: -1, flood: 0, rib: [0, 0, 0], deco: dg }, false);
      addSeg({ x: px, z: pz, w: ax ? deep + 0.3 : wide + 0.4, d: ax ? wide + 0.4 : deep + 0.3, y0: yt, y1: yt + 0.25, tint: ct, seed: seed + 122, style: 3, dens: -1, flood: 0, rib: [0, 0, 0], deco: dg }, false);
    }
  }
}
// Balkone: auskragende Platten mit massiver Art-Déco-Brüstung, jedes zweite Geschoss, auf jeder zweiten Achse
export function addBalconies(cx, cz, sw, sd, y0, y1, style, tint, seed, edges, rr) {
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
        const px = ax ? cx + o[0] * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + o[1] * (sd / 2 + deep / 2), dg = DECO.g++;
        addSeg({ x: px, z: pz, w: ax ? deep : wide, d: ax ? wide : deep, y0: yy, y1: yy + 0.18, tint: ct, seed: seed + 130, style: 3, dens: -1, flood: 0, rib: [0, 0, 0], deco: dg }, false);
        const rx = ax ? cx + o[0] * (sw / 2 + deep - 0.06) : cx + u, rz = ax ? cz + u : cz + o[1] * (sd / 2 + deep - 0.06);
        addSeg({ x: rx, z: rz, w: ax ? 0.12 : wide - 0.05, d: ax ? wide - 0.05 : 0.12, y0: yy + 0.18, y1: yy + 1.05, tint: railT, seed: seed + 131, style: 3, dens: -1, flood: 0, rib: [0, 0, 0], deco: dg }, false);
        for (const s of [-1, 1]) addSeg({ x: ax ? px : cx + u + s * (wide / 2 - 0.06), z: ax ? cz + u + s * (wide / 2 - 0.06) : pz, w: ax ? deep : 0.12, d: ax ? 0.12 : deep, y0: yy + 0.18, y1: yy + 1.05, tint: railT, seed: seed + 132, style: 3, dens: -1, flood: 0, rib: [0, 0, 0], deco: dg }, false);
      }
    }
  }
}
// Arkade: Erdgeschoss um 3,5 m zurückgesetzt, davor eine Reihe Pfeiler, darunter Licht; der Gehweg läuft durch
export function addArcade(cx, cz, sw, sd, edges, tint, seed, dens, rr) {
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
      addSeg({ x: px, z: pz, w: 1.0, d: 1.0, y0: 0.2, y1: 4.9, tint: ct, seed: seed + 141 + k, style: 3, dens: -1, flood: 0.4, rib: [0, 0, 0] }, true);
      addSeg({ x: px, z: pz, w: 1.3, d: 1.3, y0: 4.9, y1: 5.3, tint: ct, seed: seed + 142, style: 3, dens: -1, flood: 0.4, rib: [0, 0, 0] }, false);
      addSeg({ x: px, z: pz, w: 1.2, d: 1.2, y0: 0.2, y1: 0.9, tint: ct.map(v => v * 0.8), seed: seed + 143, style: 3, dens: -1, flood: 0.2, rib: [0, 0, 0] }, false);
      if (k < n) { const um = u + (L - 1.0) / n / 2; const lx = ax ? cx + o[0] * (sw / 2 - A / 2) : cx + um, lz = ax ? cz + um : cz + o[1] * (sd / 2 - A / 2); addGlow(lx, 4.6, lz, [1.3, 0.9, 0.5], 1.2); lamps.push({ x: lx, z: lz, h: 0, wall: true }); }
    }
  }
  return { x0, x1, z0, z1 };
}
// Einfache Haustür: Gewände aus hellem Stein, Türblatt aus dunklem Holz, Oberlicht, Stufe, Laterne; Hausnummer
export function houseDoor(cx, cz, sw, sd, edges, tint, rr, kind = 'house') {
  const sides = Object.keys(edges).filter(k => edges[k]); if (!sides.length) return;
  const side = sides[Math.floor(rr() * sides.length)], o = SIDE_O[side], ax = o[0] !== 0, L = ax ? sd : sw;
  const u = (rr() - 0.5) * Math.max(0, L - 8);
  const fx = cx + o[0] * sw / 2 + (ax ? 0 : u), fz = cz + o[1] * sd / 2 + (ax ? u : 0);
  // V54: Gewände, Sturz und Tür baut der Eingangs-Baukasten (portal-kit.js); hier nur ein Platzhalter für die Schilder
  addSeg({ x: fx + o[0] * 0.3, z: fz + o[1] * 0.3, w: ax ? 0.6 : 3.4, d: ax ? 3.4 : 0.6, y0: 0.2, y1: 5.7, tint, seed: 995, style: 3, dens: 0, flood: 0, dead: true, blockOnly: true }, false);
  HOUSE_DOORS.push({ fx, fz, o, tint });
  addGlow(fx + o[0] * 0.5, 3.1, fz + o[1] * 0.5, [1.3, 0.9, 0.5], 1.0);
  DOORS.push({ x: fx + o[0] * 0.4, z: fz + o[1] * 0.4, nx: o[0], nz: o[1], kind });
  decoHouseDoor(fx, fz, o, tint[0] > tint[1] * 1.35, Math.hypot(cx, cz), tint);   // V38: Wandlaternen und kleines Vordach an Elitehäusern
}
