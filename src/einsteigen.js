/* =====================================================================
   V112 · ALEXANDER STEIGT EIN UND AUS
   Eigener Ablauf nur für die Spielerfigur (die Passanten behalten den Ablauf aus tueren.js).
   Einsteigen: an die Tür treten, mit der Hand an den Griff, die Tür aufziehen und dabei einen
   Schritt zurück, sie schwingt ganz auf; auf das Trittbrett steigen (ein Bein voraus), sich mit
   der anderen Hand vorn am Türholm halten, den Kopf einziehen und mit dem Rücken zum Sitz niedersetzen
   (die Füße bleiben dabei auf dem Trittbrett stehen); die Beine anheben und hineinschwenken,
   nach dem inneren Griff greifen und die Tür zuziehen, auf den Platz rutschen.
   Aussteigen umgekehrt: an den Rand rutschen, die Tür aufdrücken, die Beine hinausschwenken,
   die Füße aufs Trittbrett, am Holm festhalten und geduckt aufstehen, hinuntersteigen,
   sich umdrehen und die Tür mit der Hand zuschlagen.
   Alles im Wagenraum (x vorn, y über der Karosserie-Null, z rechts). Die Haltungen dazu stehen im
   Spieler-Shader (playerPose, uPl[8..11]); player-model.js rechnet die Punkte in den Körperraum.
   ===================================================================== */
import { DOOR_MAX } from './tueren.js';
import { DOOR } from './cars.js';

// Annäherung (zu Fuß), Stand auf dem Trittbrett, Sitzkante, Fußhöhe auf dem Trittbrett, Sitz
export const PB = { sc: 1.02, ax: -0.78, az: 1.38, bx: -1.0, bz: 1.72, sx: -0.38, sz: 1.02, ex: -0.4, ez: 0.6, board: 0.5, seatY: 1.1, ox: -0.62, oz: 1.92 };
export const PIN_T = 4.35, POUT_T = 4.55;
const sm = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
const lin = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));
const env = (t, a, b, c, d) => sm(lin(t, a, b)) * (1 - sm(lin(t, c, d)));   // ein, halten, aus
const lerp = (a, b, k) => a + (b - a) * k;
const bell = k => Math.sin(Math.PI * Math.max(0, Math.min(1, k)));

// Punkt der Tür (Türraum der rechten Tür, z > 0) bei Öffnung d auf Seite s, in den Wagenraum
export function doorPoint(lx, ly, lz, s, d, out) {
  const a = d * DOOR_MAX * s, c = Math.cos(a), sn = Math.sin(a), rx = lx - DOOR.x1, rz = s * lz - s * DOOR.hz;
  out.x = DOOR.x1 + rx * c + rz * sn; out.y = ly; out.z = s * DOOR.hz - rx * sn + rz * c;
  return out;
}
const GRIP_OUT = [DOOR.x0 + 0.17, 1.2, 0.9], GRIP_IN = [-0.12, 1.08, 0.74], EDGE = [DOOR.x0 + 0.05, 1.42, 0.9], PILLAR = [0.22, 1.5, 0.84];   // PILLAR: Holm vorn an der Türöffnung

function blank(r) {
  r.pl = true; r.done = false; r.slam = false; r.tilt = 0; r.gk = 0; r.sit = false; r.y = PB.board; r.d = 0;
  r.duck = 0; r.sb = 0; r.lift = 0; r.lead = 0; r.look = 0;
  r.hA = r.hA || { x: 0, y: 0, z: 0, w: 0 }; r.hB = r.hB || { x: 0, y: 0, z: 0, w: 0 }; r.hA.w = 0; r.hB.w = 0;
  r.F = r.F || { x: 0, y: 0, z: 0 };
  return r;
}
const setP = (h, p, w) => { h.x = p.x; h.y = p.y; h.z = p.z; h.w = w; };
const _p = { x: 0, y: 0, z: 0 };
const roof = s => { _p.x = PILLAR[0]; _p.y = PILLAR[1]; _p.z = s * PILLAR[2]; return _p; };
// Lage beim Setzen/Aufstehen: Gewicht k mischt Stand auf dem Trittbrett (Fußpunkt) und Sitz (Becken über der Sitzkante)
function seatBlend(r, s, k, sc) {
  r.sb = k; r.x = lerp(PB.sx, PB.ex, k); r.z = s * lerp(PB.sz, PB.ez, k);
  r.y = lerp(PB.board, PB.seatY - 0.87 * sc, k);
  r.F.x = PB.sx; r.F.y = PB.board; r.F.z = s * PB.sz;
}

// Einsteigen: s = Seite (1 rechts, −1 links), seatZ = Sitz; t ab Ankunft an der Tür. hA = Hand an der Tür, hB = Hand am Dach
export function plBoardIn(t, s, seatZ, sc, r = {}) {
  blank(r);
  const phc = s > 0 ? Math.PI : 0, phOut = phc - s * Math.PI, phSeat = phc - s * Math.PI / 2;
  // Tür: aufziehen (bis gut die Hälfte), dann schwingt sie ganz auf; zum Schluss wird sie zugezogen
  const open = 0.55 * sm(lin(t, 0.4, 1.0)) + 0.45 * sm(lin(t, 0.9, 1.45)), shut = lin(t, 3.35, 3.85);
  r.d = open * (1 - shut * shut); r.slam = t >= 3.85;
  // Hand an den äußeren Griff und mit der Tür mitgehen, loslassen, wenn sie von selbst aufschwingt
  const wO = env(t, 0.05, 0.4, 0.85, 1.15);
  if (wO > 0) setP(r.hA, doorPoint(GRIP_OUT[0], GRIP_OUT[1], GRIP_OUT[2], s, Math.min(r.d, 0.6), _p), wO);
  // die andere Hand hält sich beim Einsteigen am Dach
  const wR = env(t, 1.3, 1.6, 2.45, 2.8);
  if (wR > 0) setP(r.hB, roof(s), wR);
  // innerer Griff: zuziehen
  const wI = env(t, 3.05, 3.35, 3.9, 4.2);
  if (wI > 0) setP(r.hA, doorPoint(GRIP_IN[0], GRIP_IN[1], GRIP_IN[2], s, Math.max(r.d, 0.0), _p), wI);
  if (t < 1.1) {
    // vor der Tür; beim Aufziehen ein Schritt schräg zurück, der Blick geht zur Öffnung
    const k = sm(lin(t, 0.45, 1.05));
    r.x = lerp(PB.ax, PB.bx, k); r.z = s * lerp(PB.az, PB.bz, k); r.phi = phc - s * 0.55 * k; r.gk = 1; r.y = 0;
    r.lead = -s * 0.35 * bell(lin(t, 0.45, 1.0));
    return r;
  }
  if (t < 1.8) {
    // aufs Trittbrett steigen (das Bein an der Wagenseite voraus) und dem Sitz den Rücken zudrehen
    const k = sm(lin(t, 1.1, 1.8));
    r.x = lerp(PB.bx, PB.sx, k); r.z = s * lerp(PB.bz, PB.sz, k); r.gk = 1 - sm(lin(t, 1.2, 1.7)); r.y = PB.board;
    r.phi = lerp(phc - s * 0.55, phOut, k);
    r.lead = s * bell(lin(t, 1.12, 1.6)); r.duck = 0.5 * sm(lin(t, 1.45, 1.8));
    return r;
  }
  r.phi = phOut;
  if (t < 2.55) {
    // geduckt niedersetzen, die Füße bleiben auf dem Trittbrett
    seatBlend(r, s, sm(lin(t, 1.8, 2.5)), sc);
    r.sit = t >= 2.48; r.duck = 0.5 + 0.5 * bell(lin(t, 1.8, 2.7));
    return r;
  }
  if (t < 3.35) {
    // Beine anheben und hineinschwenken
    const k = sm(lin(t, 2.55, 3.3));
    seatBlend(r, s, 1, sc); r.sb = 1 - sm(lin(t, 2.6, 3.2)); r.sit = true;
    r.phi = lerp(phOut, phSeat, k); r.lift = bell(lin(t, 2.55, 3.3)); r.duck = 0.5 * (1 - k);
    r.x = lerp(PB.ex, -0.42, k);
    return r;
  }
  // zuziehen, dann auf den Platz rutschen
  seatBlend(r, s, 1, sc); r.sb = 0; r.sit = true; r.phi = phSeat;
  const k = sm(lin(t, 3.85, 4.3));
  r.x = -0.42; r.z = lerp(s * PB.ez, seatZ, k);
  r.done = t >= PIN_T;
  return r;
}

// Aussteigen; am Ende steht die Figur neben dem Wagen, die Tür ist zu
export function plBoardOut(t, s, seatZ, sc, r = {}) {
  blank(r);
  const phc = s > 0 ? Math.PI : 0, phOut = phc - s * Math.PI, phSeat = phc - s * Math.PI / 2;
  const open = 0.55 * sm(lin(t, 0.45, 0.95)) + 0.45 * sm(lin(t, 0.9, 1.35));
  // zuschlagen: die Hand drückt die Tür an der Hinterkante zu, ab halber Strecke fällt sie ins Schloss
  const push = sm(lin(t, 3.55, 3.95)), fall = lin(t, 3.95, 4.2);
  r.d = open * (1 - 0.55 * push) * (1 - fall * fall); r.slam = t >= 4.2;
  const wI = env(t, 0.15, 0.45, 0.95, 1.25);
  if (wI > 0) setP(r.hA, doorPoint(GRIP_IN[0], GRIP_IN[1], GRIP_IN[2], s, Math.min(r.d, 0.6), _p), wI);
  const wR = env(t, 1.75, 2.05, 2.6, 2.9);
  if (wR > 0) setP(r.hB, roof(s), wR);
  const wE = env(t, 3.3, 3.55, 3.95, 4.25);
  if (wE > 0) setP(r.hA, doorPoint(EDGE[0], EDGE[1], EDGE[2], s, Math.max(r.d, 0.45), _p), wE);
  if (t < 1.05) {
    // an den Rand rutschen und die Tür aufdrücken
    seatBlend(r, s, 1, sc); r.sb = 0; r.sit = true; r.phi = phSeat;
    const k = sm(lin(t, 0, 0.5));
    r.x = -0.42; r.z = lerp(seatZ, s * PB.ez, k);
    return r;
  }
  if (t < 1.9) {
    // Beine hinausschwenken, die Füße setzen auf dem Trittbrett auf
    const k = sm(lin(t, 1.05, 1.85));
    seatBlend(r, s, 1, sc); r.sb = sm(lin(t, 1.2, 1.85)); r.sit = true;
    r.phi = lerp(phSeat, phOut, k); r.lift = bell(lin(t, 1.05, 1.85)); r.x = lerp(-0.42, PB.ex, k);
    r.duck = 0.4 * k;
    return r;
  }
  r.phi = phOut;
  if (t < 2.65) {
    // geduckt aufstehen, mit der Hand am Dach
    seatBlend(r, s, 1 - sm(lin(t, 1.95, 2.6)), sc);
    r.sit = t < 1.98; r.duck = 0.4 + 0.6 * bell(lin(t, 1.85, 2.75));
    return r;
  }
  if (t < 3.35) {
    // hinuntersteigen, umdrehen zur offenen Tür
    const k = sm(lin(t, 2.65, 3.3));
    r.x = lerp(PB.sx, PB.ox, k); r.z = s * lerp(PB.sz, PB.oz, k); r.gk = sm(lin(t, 2.7, 3.15)); r.y = PB.board;
    r.phi = lerp(phOut, phc - s * 0.35 * Math.PI, k); r.lead = s * bell(lin(t, 2.68, 3.15)); r.duck = 0.25 * (1 - k);
    return r;
  }
  // die Tür zuschlagen und einen halben Schritt zurück
  const k = sm(lin(t, 3.9, 4.45));
  r.x = lerp(PB.ox, PB.ox - 0.25, k); r.z = s * lerp(PB.oz, PB.oz - 0.05, k); r.gk = 1; r.y = PB.board; r.phi = lerp(phc - s * 0.35 * Math.PI, phc - s * 0.15 * Math.PI, k);
  r.done = t >= POUT_T;
  return r;
}
// Weg zur Tür: Stelle der Annäherung im Wagenraum
export const approachSpot = s => [PB.ax, s * PB.az];
