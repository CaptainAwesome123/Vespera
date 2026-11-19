/* =====================================================================
   V122 · GLAS UND BRUCH
   Schaufenster und die Glaslaternen der Straßenlaternen zerspringen,
   wenn ein schnell fliegendes Ding sie trifft (Wurf, Telekinese) oder
   Alexanders Landungs-Druckwelle sie erreicht: die Scheibe verschwindet,
   Scherben fallen klirrend aufs Pflaster (Körper aus physics.js), dazu
   ein Glitzerregen. Laternen gehen dabei aus und sprühen Funken.
   Was zerbrochen ist, wird wieder heil, wenn Alexander weit weg ist
   (wie die Trümmer in V89). Kein Shader, keine neuen Netze.
   ?scherben=aus schaltet es ab.
   ===================================================================== */
import { camera } from './core.js';
import { fxEmit } from './particles.js';
import { STREET, lampFx } from './serpentine.js';

export const SCH = { on: new URLSearchParams(location.search).get('scherben') !== 'aus', list: [], grid: new Map(), broken: [], burst: null, sound: null };
const CELL = 8, key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

// Schaufenster anmelden: g = Glasfläche (vor dem Verschmelzen im Bausatz), Mitte x/z, Höhe y0..y1, Breite w,
// ax = Scheibe liegt in der z-Achse (Normale x), n = Normale nach außen
export function regGlass(g, x, z, y0, y1, w, ax, nx, nz) {
  if (!SCH.on) return;
  const r = { x, z, y0, y1, w, ax, nx, nz, ranges: [], broken: false, saved: null };
  if (!g.userData.mov) g.userData = { ...g.userData, mov: { e: r, role: 'glass', key: 'glass' } };
  SCH.list.push(r);
  const h = w / 2 + 0.5;
  for (let cx = Math.floor((x - h) / CELL); cx <= Math.floor((x + h) / CELL); cx++) for (let cz = Math.floor((z - h) / CELL); cz <= Math.floor((z + h) / CELL); cz++) {
    const k = key(cx, cz); let a = SCH.grid.get(k); if (!a) SCH.grid.set(k, a = []); a.push(r);
  }
}
// Ecken der Scheibe in den verschmolzenen Netzen auf einen Punkt legen (wie furnHide in physics.js) oder zurückholen
function setRanges(r, hide) {
  const per = new Map();
  if (hide) r.saved = [];
  for (const q of r.ranges) {
    const at = q.geo.attributes.position, a = at.array, o = q.o * 3, n = q.c * 3;
    if (hide) { r.saved.push(a.slice(o, o + n)); const x = a[o], y = a[o + 1], z = a[o + 2]; for (let i = 0; i < n; i += 3) { a[o + i] = x; a[o + i + 1] = y; a[o + i + 2] = z; } }
    else if (r.saved && r.saved.length) a.set(r.saved.shift(), o);
    const u = per.get(at) || { o, e: o + n }; u.o = Math.min(u.o, o); u.e = Math.max(u.e, o + n); per.set(at, u);
  }
  for (const [at, u] of per) { at.updateRange.offset = u.o; at.updateRange.count = u.e - u.o; at.needsUpdate = true; }
}
function breakGlass(r, vx, vz) {
  if (r.broken || !r.ranges.length) return false;
  r.broken = true; setRanges(r, true);
  const cy = (r.y0 + r.y1) / 2, h = r.y1 - r.y0, near = (r.x - camera.position.x) ** 2 + (r.z - camera.position.z) ** 2 < 1600;
  // Glitzer über die ganze Scheibe, Scherben fallen nach außen und innen
  for (let k = 0; k < 5; k++) {
    const u = (k / 4 - 0.5) * r.w * 0.85, x = r.ax ? r.x : r.x + u, z = r.ax ? r.z + u : r.z;
    fxEmit('glass', x, cy + (Math.random() - 0.5) * h * 0.7, z, r.nx * 1.2 + vx * 0.15, 0.4, r.nz * 1.2 + vz * 0.15, 7, 0.6, 0.6);
  }
  if (SCH.burst) SCH.burst(r.x, cy, r.z, r.ax ? 0.04 : r.w * 0.45, h * 0.45, r.ax ? r.w * 0.45 : 0.04, r.nx + vx * 0.1, r.nz + vz * 0.1, near ? 10 : 5);
  if (near && SCH.sound) SCH.sound('shatter', 1, 4);
  SCH.broken.push({ x: r.x, z: r.z, fn: () => { r.broken = false; setRanges(r, false); } });
  return true;
}
// Laterne: Glaskopf zerspringt, Licht geht aus, Funken
function breakLamp(l, vx, vz) {
  if (l._broken) return false;
  l._broken = true; lampFx(l, false);
  const y = (l.y ?? 0.2) + (l.hs || 4.5);
  fxEmit('glass', l.x, y, l.z, vx * 0.15, 0.6, vz * 0.15, 20, 0.4, 0.6);
  fxEmit('spark', l.x, y, l.z, vx * 0.1, 1.2, vz * 0.1, 14, 0.4);
  if (SCH.burst) SCH.burst(l.x, y, l.z, 0.15, 0.1, 0.15, vx * 0.1, vz * 0.1, 6);
  if ((l.x - camera.position.x) ** 2 + (l.z - camera.position.z) ** 2 < 1600 && SCH.sound) SCH.sound('shatter', 1, 3);
  SCH.broken.push({ x: l.x, z: l.z, fn: () => { l._broken = false; lampFx(l, true); } });
  return true;
}
// Laternen im Raster (für Treffer)
let LG = null, LGn = -1;
function lampGrid() {
  const L = STREET.lamps; if (LG && LGn === L.length) return LG;
  LG = new Map(); LGn = L.length;
  for (const l of L) { const k = key(Math.floor(l.x / CELL), Math.floor(l.z / CELL)); let a = LG.get(k); if (!a) LG.set(k, a = []); a.push(l); }
  return LG;
}
// Ein fliegendes Ding an (x, y, z) mit Geschwindigkeit (vx, vy, vz), Radius rad: trifft es eine Scheibe oder einen Laternenkopf?
export function glassHit(x, y, z, vx, vy, vz, rad = 0.2) {
  if (!SCH.on || vx * vx + vy * vy + vz * vz < 20) return false;
  const k = key(Math.floor(x / CELL), Math.floor(z / CELL));
  for (const r of SCH.grid.get(k) || []) {
    if (r.broken || y < r.y0 - rad || y > r.y1 + rad) continue;
    const dx = x - r.x, dz = z - r.z, along = r.ax ? dz : dx, across = r.ax ? dx : dz;
    if (Math.abs(along) < r.w / 2 + rad && Math.abs(across) < rad + 0.3) return breakGlass(r, vx, vz);
  }
  for (const l of lampGrid().get(k) || []) {
    const hy = (l.y ?? 0.2) + (l.hs || 4.5);
    if ((x - l.x) ** 2 + (z - l.z) ** 2 < (0.35 + rad) ** 2 && Math.abs(y - hy) < 0.45 + rad) return breakLamp(l, vx, vz);
  }
  return false;
}
// Druckwelle (Landung, Energieschub): Scheiben und Laternen im Umkreis r zerspringen, nahe sicher, weiter weg zufällig
export function glassWave(x, y, z, R) {
  if (!SCH.on) return 0;
  let n = 0;
  const c0x = Math.floor((x - R) / CELL), c1x = Math.floor((x + R) / CELL), c0z = Math.floor((z - R) / CELL), c1z = Math.floor((z + R) / CELL);
  const G = lampGrid();
  for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
    const k = key(cx, cz);
    for (const r of SCH.grid.get(k) || []) {
      const d = Math.hypot(r.x - x, r.z - z); if (r.broken || d > R || Math.abs(r.y0 - y) > 6 || Math.random() > 1.2 - d / R) continue;
      if (breakGlass(r, (r.x - x) / (d || 1) * 4, (r.z - z) / (d || 1) * 4)) n++;
    }
    for (const l of G.get(k) || []) {
      const d = Math.hypot(l.x - x, l.z - z); if (d > R * 0.8 || Math.abs((l.y ?? 0.2) - y) > 6 || Math.random() > 1.1 - d / R) continue;
      if (breakLamp(l, (l.x - x) / (d || 1) * 4, (l.z - z) / (d || 1) * 4)) n++;
    }
  }
  return n;
}
// heil machen, was weit hinter Alexander liegt (320 m)
let tk = 0;
export function scherbenTick(dt, p) {
  if ((tk -= dt) > 0 || !SCH.broken.length) return; tk = 1;
  for (let i = SCH.broken.length - 1; i >= 0; i--) { const b = SCH.broken[i]; if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 > 320 * 320) { b.fn(); SCH.broken.splice(i, 1); } }
}
