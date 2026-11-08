/* =====================================================================
   V74 · TÜREN UND EINSTEIGEN
   Bewegliche Vordertüren für die Wagen in der Nähe (Spielerwagen und die Wagen, an denen
   Leute ein- und aussteigen): ein kleiner gemeinsamer Vorrat aus vier Netzen (Tür rechts,
   Tür links, je mit Scheibe), jeder Wagen belegt einen Platz darin.
   Dazu der Ablauf des Ein- und Aussteigens im Wagenraum (x vorn, z rechts):
   hingehen, Tür öffnen, umdrehen und auf die Sitzkante setzen, die Beine hineinschwenken,
   Tür zuziehen; beim Aussteigen umgekehrt. Er gilt für Passanten wie für Alexander.
   Kein neuer Code im Menschen-Shader: Haltungen sind Stehen (act 1.1 / 0) und Sitzen (7.2),
   die Bewegung entsteht aus Lage, Drehung und Neigung der Figur.
   ===================================================================== */
import { T, scene, camera } from './core.js';
import { MAT } from './people-skeleton.js';
import { carDoorGeo, carDoorGlassGeo, carGlassMat, carDamageAttr, DOOR } from './cars.js';
import { SND, sndBurst, sndTone } from './audio.js';

export const TUER = { im: null, n: 6, used: [] };
const ZERO = new T.Matrix4().makeScale(0, 0, 0);
function build() {
  if (TUER.im) return;
  const mk = (geo, mat) => {
    const im = new T.InstancedMesh(geo, mat, TUER.n);
    im.frustumCulled = false; im.count = 0; im.instanceMatrix.setUsage(T.DynamicDrawUsage);
    for (let i = 0; i < TUER.n; i++) { im.setMatrixAt(i, ZERO); im.setColorAt(i, new T.Color(1, 1, 1)); }
    carDamageAttr(im); scene.add(im); return im;
  };
  const gm = carGlassMat();
  TUER.im = [mk(carDoorGeo(1), MAT.carPaint), mk(carDoorGeo(-1), MAT.carPaint), mk(carDoorGlassGeo(1), gm), mk(carDoorGlassGeo(-1), gm)];
  for (const k of [2, 3]) { TUER.im[k].renderOrder = 3; TUER.im[k].userData.noRefl = true; }
}
// einen Platz belegen (−1, wenn alle belegt sind)
export function doorSlot() {
  build();
  let i = TUER.used.indexOf(false);
  if (i < 0) { if (TUER.used.length >= TUER.n) return -1; i = TUER.used.length; TUER.used.push(true); } else TUER.used[i] = true;
  for (const im of TUER.im) im.count = TUER.used.length;
  return i;
}
export function hideDoors(i) {
  if (i < 0 || !TUER.im) return;
  for (const im of TUER.im) { im.setMatrixAt(i, ZERO); im.instanceMatrix.needsUpdate = true; }
}
const _h = new T.Matrix4(), _r = new T.Matrix4(), _b = new T.Matrix4(), _c = new T.Color();
// Türen eines Wagens setzen: M = Matrix der Karosserie, aR/aL = Öffnung 0..1, col = Lackfarbe
export const DOOR_MAX = 1.2;   // weit offen (knapp 70°)
export function setDoors(i, M, aR, aL, col) {
  if (i < 0 || !TUER.im) return;
  for (let k = 0; k < 2; k++) {
    const s = k ? -1 : 1, a = (k ? aL : aR) * DOOR_MAX * s;
    // um das Scharnier an der Vorderkante drehen
    _b.copy(M).multiply(_h.makeTranslation(DOOR.x1, 0, s * DOOR.hz)).multiply(_r.makeRotationY(a)).multiply(_h.makeTranslation(-DOOR.x1, 0, -s * DOOR.hz));
    TUER.im[k].setMatrixAt(i, _b); TUER.im[k + 2].setMatrixAt(i, _b);
  }
  if (col) { _c.setRGB(col[0], col[1], col[2]); for (const im of TUER.im) im.setColorAt(i, _c); }
  for (const im of TUER.im) { im.instanceMatrix.needsUpdate = true; if (col && im.instanceColor) im.instanceColor.needsUpdate = true; }
}

/* ---------- Ablauf ---------- */
export const BOARD = { p0x: -0.8, p0z: 1.55, sx: -0.4, sz: 1.0, seatX: -0.42, seatZ: 0.38 };
export const IN_T = 2.85, OUT_T = 2.75;
const sm = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
// Ergebnis: d = Türöffnung, x/z = Lage im Wagenraum, phi = Blickrichtung (Figur-Gierwinkel = Wagen + phi),
// sit = sitzt, y = Fußhöhe über der Karosserie-Null (stehend) bzw. Sitzfläche (sitzend), gk = Gewicht des Bodens (stehend), tilt = Vorbeugen
const R0 = { d: 0, x: 0, z: 0, phi: 0, sit: false, y: 0, gk: 0, tilt: 0, done: false, slam: false };
// Einsteigen: s = Seite (1 rechts, −1 links), seatZ = Sitz (Fahrer 0,38, Beifahrer −0,38); t ab Ankunft an der Tür
export function boardIn(t, s, seatZ, r = { ...R0 }) {
  const phc = s > 0 ? Math.PI : 0, pho = phc + s * Math.PI;
  Object.assign(r, { d: 1, x: BOARD.p0x, z: s * BOARD.p0z, phi: phc, sit: false, y: 0.5, gk: 1, tilt: 0, done: false, slam: false });
  if (t < 0.7) { r.d = sm(t / 0.7); return r; }
  if (t < 1.15) {
    // auf das Trittbrett steigen, dabei dem Wagen den Rücken zudrehen und den Kopf einziehen
    const k = sm((t - 0.7) / 0.45);
    r.x = lerp(BOARD.p0x, BOARD.sx, k); r.z = s * lerp(BOARD.p0z, BOARD.sz, k); r.gk = 1 - k; r.phi = phc + s * Math.PI * k; r.tilt = 0.3 * k;
    return r;
  }
  r.x = BOARD.sx; r.z = s * BOARD.sz; r.phi = pho; r.sit = true; r.gk = 0;
  if (t < 1.5) { const k = sm((t - 1.15) / 0.35); r.y = 1.1 + 0.12 * (1 - k); r.tilt = 0.15 * (1 - k); return r; }
  r.y = 1.1;
  if (t < 2.3) {
    // Beine hineinschwenken und auf den Platz rutschen
    const k = sm((t - 1.5) / 0.8);
    r.x = lerp(BOARD.sx, BOARD.seatX, k); r.z = lerp(s * BOARD.sz, seatZ, k); r.phi = pho + s * Math.PI / 2 * k;
    return r;
  }
  r.x = BOARD.seatX; r.z = seatZ; r.phi = pho + s * Math.PI / 2;
  const k = Math.min(1, (t - 2.3) / 0.55); r.d = 1 - k * k; r.slam = k >= 1; r.done = t >= IN_T;
  return r;
}
// Aussteigen (umgekehrt); am Ende steht die Figur neben dem Wagen, die Tür ist zu
export function boardOut(t, s, seatZ, r = { ...R0 }) {
  const phc = s > 0 ? Math.PI : 0, pho = phc + s * Math.PI, phs = pho + s * Math.PI / 2;
  Object.assign(r, { d: 1, x: BOARD.seatX, z: seatZ, phi: phs, sit: true, y: 1.1, gk: 0, tilt: 0, done: false, slam: false });
  if (t < 0.6) { r.d = sm(t / 0.6); return r; }
  if (t < 1.4) {
    const k = sm((t - 0.6) / 0.8);
    r.x = lerp(BOARD.seatX, BOARD.sx, k); r.z = lerp(seatZ, s * BOARD.sz, k); r.phi = phs - s * Math.PI / 2 * k;
    return r;
  }
  r.x = BOARD.sx; r.z = s * BOARD.sz; r.phi = pho;
  if (t < 1.75) {
    // aufstehen: kurz vorbeugen, dann steht man auf dem Trittbrett
    const k = (t - 1.4) / 0.35;
    if (k < 0.4) { r.y = 1.1 + 0.08 * k / 0.4; r.tilt = 0.2 * k / 0.4; }
    else { r.sit = false; r.y = 0.5; r.tilt = 0.3 * (1 - sm((k - 0.4) / 0.6)); }
    return r;
  }
  r.sit = false; r.y = 0.5;
  if (t < 2.2) {
    // hinunter und zur Tür umdrehen
    const k = sm((t - 1.75) / 0.45);
    r.x = lerp(BOARD.sx, BOARD.p0x, k); r.z = s * lerp(BOARD.sz, BOARD.p0z, k); r.gk = k; r.phi = pho - s * Math.PI * k;
    return r;
  }
  r.x = BOARD.p0x; r.z = s * BOARD.p0z; r.phi = phc; r.gk = 1;
  const k = Math.min(1, (t - 2.2) / 0.55); r.d = 1 - k * k; r.slam = k >= 1; r.done = t >= OUT_T;
  return r;
}
// Wagenraum -> Welt (Wagen bei X, Z mit Gierwinkel h)
export function carToWorld(X, Z, h, lx, lz, out) {
  const c = Math.cos(h), s = Math.sin(h);
  out[0] = X + c * lx + s * lz; out[1] = Z - s * lx + c * lz; return out;
}

/* ---------- Klang: Schloss beim Öffnen, schweres Zuschlagen ---------- */
export function doorSound(open, x, y, z) {
  if (!SND.ctx || !SND.on) return;
  const cp = camera.position, d = Math.hypot(x - cp.x, y - cp.y, z - cp.z), k = Math.max(0, 1 - d / 45) ** 1.5;
  if (k < 0.02) return;
  const t = SND.ctx.currentTime;
  if (open) { sndBurst(t, 0.05, 2600, 4, 0.08 * k); sndTone(900, t + 0.02, 0.06, 0.02 * k, 'square'); sndBurst(t + 0.05, 0.25, 700, 1.2, 0.03 * k); }
  else { sndBurst(t, 0.18, 180, 1.4, 0.22 * k, 'sfx', 'lowpass', true); sndTone(95, t, 0.16, 0.08 * k, 'sine'); sndBurst(t + 0.01, 0.05, 2200, 3, 0.05 * k); }
}
