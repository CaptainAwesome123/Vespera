import { T, scene } from './core.js';
import { DANCE } from './people-skeleton.js';
import { addNeon, NEON, neons } from './facade-shader.js';
import { interiorCrowd, BI, dancers, BALLROOM_F, swayers, walkersIn } from './belmont.js';

/* =====================================================================
   V17 · TANZ: Paare tanzen Foxtrott und ziehen in Tanzrichtung über das
   Parkett. Die Schritte macht der Shader (poseFox), hier wandert der Körper
   genau um so viel weiter, wie die Füße gesetzt werden. Alle im selben Takt.
   ===================================================================== */
export function foxBodyJS(u) {
  const s = x => Math.min(1, Math.max(0, x)), sm = x => { x = s((x - 0.1) / 0.9); return x * x * (3 - 2 * x); };
  return [0.15 * sm(s(u - 4)) + 0.15 * sm(s(u - 5)), 0.5 * sm(s(u / 2)) + 0.5 * sm(s((u - 2) / 2))];
}
// Richtung für die nächste Figur: entlang der Ellipse gegen den Uhrzeigersinn, zurück zur eigenen Bahn
export function foxPlan(c, F) {
  const dx = (c.fx - F.cx) / F.rx, dz = (c.fz - F.cz) / F.rz, a = Math.atan2(dz, dx), rho = Math.hypot(dx, dz);
  let tx = -Math.sin(a) * F.rx, tz = Math.cos(a) * F.rz; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
  const e = rho - c.rho0, nx = Math.cos(a), nz = Math.sin(a);
  let d = Math.atan2(tx - 3 * e * nx, tz - 3 * e * nz) - c.fh; d = Math.atan2(Math.sin(d), Math.cos(d));
  // ab und zu eine Drehung des Paares auf den schnellen Schritten
  const twirl = (c.fig * 7 + c.seed) % 5 === 0 ? 6.2832 * (c.seed % 2 ? 1 : -1) : 0;
  c.dh = Math.max(-0.9, Math.min(0.9, d)) + twirl;
}
// liefert Führenden und Folgende: [x, z, Blick, x, z, Blick]
export function foxCouple(c, t, F) {
  const B = t * DANCE.fox, fig = Math.floor(B / 6), u = B - fig * 6;
  if (c.fig == null || fig < c.fig || fig - c.fig > 60) {
    c.seed = c.seed ?? Math.floor(Math.random() * 1000);
    c.fx = F.cx + Math.cos(c.ang) * F.rx * c.rho0; c.fz = F.cz + Math.sin(c.ang) * F.rz * c.rho0;
    c.fh = Math.atan2(-Math.sin(c.ang) * F.rx, Math.cos(c.ang) * F.rz); c.fig = fig; foxPlan(c, F);
  }
  while (c.fig < fig) {
    const h1 = c.fh + c.dh, b = foxBodyJS(6), cs = Math.cos(h1), sn = Math.sin(h1);
    c.fx += b[0] * cs + b[1] * sn; c.fz += -b[0] * sn + b[1] * cs; c.fh = Math.atan2(Math.sin(h1), Math.cos(h1)); c.fig++; foxPlan(c, F);
  }
  const k = u / 6, hk = c.fh + c.dh * k * k * (3 - 2 * k), b = foxBodyJS(u), cs = Math.cos(hk), sn = Math.sin(hk);
  const x = c.fx + b[0] * cs + b[1] * sn, z = c.fz - b[0] * sn + b[1] * cs;
  const wx = -0.08, wz = 0.38;                                  // sie steht ihm gegenüber, etwas nach rechts versetzt
  return [x, z, hk, x + wx * cs + wz * sn, z - wx * sn + wz * cs, hk + Math.PI];
}
// Gangart setzen: 20 führt, 21 folgt, 22 Charleston, 23 Wippen; Paare teilen die Phase
export function setDance(c, mode) {
  c.m.gait[2] = 0; c.w.gait[2] = 0; c.w.gait[0] = c.m.gait[0]; c.mode = mode;
  if (mode === 'fox') { c.m.gait[1] = 20; c.w.gait[1] = 21; } else { c.m.gait[1] = 22; c.w.gait[1] = 22; }
}
// Charleston: zwei stehen sich gegenüber und drehen sich langsam
export function charlCouple(c, t) {
  const h = c.h0 + 0.35 * Math.sin(t * 0.13 + c.ang), cs = Math.sin(h), cc = Math.cos(h);
  return [c.cx - 0.55 * cs, c.cz - 0.55 * cc, h, c.cx + 0.55 * cs, c.cz + 0.55 * cc, h + Math.PI];
}
export function placeCouple(C, c, t, F, ox, oz, y, rot) {
  const p = c.mode === 'fox' ? foxCouple(c, t, F) : charlCouple(c, t);
  const tr = rot || ((x, z) => [x, z]), m = tr(p[0], p[1]), w = tr(p[3], p[4]), dr = rot ? rot.ry : 0;
  C.set(c.m, m[0] + ox, y, m[1] + oz, p[2] + dr); C.set(c.w, w[0] + ox, y, w[1] + oz, p[5] + dr);
}

export function addNeonArc(x, y, z, r) {
  for (let k = 0; k < 40; k++) { const a = (k + 0.5) / 40 * Math.PI; addNeon(x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0.18, Math.PI * r / 40 + 0.05, 0.18, NEON.gold, 0); neons[neons.length - 1].rz = a; }
}
export function updateInterior(t, near) {
  if (!interiorCrowd || !near) return;
  const C = interiorCrowd, P = BI.P;
  for (const c of dancers) placeCouple(C, c, t, BALLROOM_F, 0, 0, P);
  swayers.forEach((a, i) => C.set(a, a.x, a.y, a.z, a.yaw + Math.sin(t * 2.2 + i) * 0.12, 1, Math.sin(t * 4.4 + i * 1.7) * 0.05));
  for (const w of walkersIn) {
    const a = w.ph + t * w.sp, x = w.cx + Math.cos(a) * w.rx, z = w.cz + Math.sin(a) * w.rz;
    const dx = -Math.sin(a) * w.rx * Math.sign(w.sp), dz = Math.cos(a) * w.rz * Math.sign(w.sp);
    C.set(w.a, x, P + Math.abs(Math.sin(t * 6 + w.ph)) * 0.03, z, Math.atan2(dx, dz));
  }
  C.flag();
}

export function fanAtSingle(mat, x, y, z, wd) { const m = new T.Mesh(new T.PlaneGeometry(wd, wd / 2), mat); m.position.set(x, y + wd / 4, z); scene.add(m); }

/* ---------- Hafen: Kai, Balustrade, Wasser ---------- */
export const WATER_Y = -1.6;
