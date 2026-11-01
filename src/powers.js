/* =====================================================================
   V33 · ALEXANDERS KRÄFTE
   Im Kern des Meteoriten, in dessen Krater Vespera steht, lag ein fremder
   Kristall. Er hat nur Alexander verändert: er fliegt, er bewegt Dinge mit
   dem Willen (Telekinese) und nichts kann ihn verletzen. Niemand sonst in
   der Stadt hat diese Kräfte.
   - Fliegen: F, oder im Sprung noch einmal Leertaste. Leertaste steigt,
     C sinkt, Shift schneller. Nahe am Boden sinken landet. Von hinten (V)
     sieht man die Figur im Flug: im Stand schwebend, im schnellen Flug
     waagrecht mit der Faust voraus.
   - Telekinese: T (oder rechte Maustaste halten) packt, worauf man schaut,
     bis 120 m weit: lose Dinge jeden Gewichts und Wagen. Mausrad näher und
     weiter, Klick schleudert, T / rechte Maustaste loslassen lässt fallen.
   - Unverwundbar: Wagen prallen an ihm ab und verbeulen, ein Sturz aus
     jeder Höhe endet in einer Landung, die den Schnee aufwirbelt.
   Sichtbar wird der Kristall nur leise: ein türkiser Schimmer um das, was er
   hält, und ein paar Funken in seiner Flugbahn.
   ===================================================================== */
import { T, camera } from './core.js';
import { player } from './player.js';
import { LOOSE, bumpSound } from './physics.js';
import { BODIES, looseFromTraffic, looseFromParked, impulse, crashDamage } from './driving.js';
import { TRF } from './traffic.js';
import { parked, peds, turnHead } from './serpentine.js';
import { fxEmit } from './particles.js';
import { toast, BOAT } from './boat.js';
import { DRIVE } from './eating.js';
import { DINE } from './venues.js';
import { PM } from './player-model.js';

export const POWERS = { tk: null, shake: 0, fov0: 0, fovOn: false, invT: 0, trail: 0, beam: 0, landT: 0 };
const TK_RANGE = 120, _pd = new T.Vector3(), _pv = new T.Vector3(), _pt = new T.Vector3(), _ph = new T.Vector3(), _pr = new T.Vector3();

/* ---------- Fliegen ---------- */
export function startFlight() {
  if (player.fly || DRIVE.on || BOAT.on || DINE.seat) return;
  player.fly = true; player.on = null;
  player.v.y = Math.max(player.v.y, 7);
  const p = player.p;
  fxEmit('snowburst', p.x, p.y + 0.1, p.z, 0, 1.2, 0, 14, 1.2, 0.7);
  fxEmit('crystal', p.x, p.y + 0.4, p.z, 0, 2.5, 0, 18, 0.6);
  toast('Alexander fliegt · Leertaste steigen · C sinken · Shift schneller · F landen');
}
export function stopFlight() {
  if (!player.fly) return;
  player.fly = false;
  toast('Zu Fuß');
}
export function toggleFlight() { if (player.fly) stopFlight(); else startFlight(); }

// Landung aus großer Höhe oder schnellem Sinkflug: unverwundbar, der Boden bebt ein wenig
export function superLanding(vImpact) {
  const p = player.p, k = Math.min(1, (vImpact - 14) / 45);
  if (k <= 0 || POWERS.landT > 0) return;
  POWERS.landT = 0.6;
  POWERS.shake = Math.min(1.2, POWERS.shake + 0.35 + 0.8 * k);
  const n = Math.round(14 + 26 * k);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, s = 5 + 9 * k;
    fxEmit('snowburst', p.x + Math.cos(a) * 0.6, p.y + 0.15, p.z + Math.sin(a) * 0.6, Math.cos(a) * s, 0.8 + Math.random(), Math.sin(a) * s, 1, 0.3, 0.8 + k);
  }
  fxEmit('dust', p.x, p.y + 0.2, p.z, 0, 1, 0, 6 + Math.round(8 * k), 1.5, 1.2);
  fxEmit('crystal', p.x, p.y + 0.3, p.z, 0, 3, 0, 10 + Math.round(20 * k), 1.2);
  bumpSound('wood', Math.min(1, 0.5 + k), 120 + 300 * k);
  // Druckwelle: lose Dinge fliegen weg, Leute drehen sich erschrocken um
  const R = 6 + 8 * k;
  for (const B of LOOSE.bodies) {
    if (B === LOOSE.held || B === LOOSE.tk) continue;
    const dx = B.x.x - p.x, dz = B.x.z - p.z, d = Math.hypot(dx, dz);
    if (d > R || Math.abs(B.x.y - p.y) > 3) continue;
    const f = (1 - d / R) * (5 + 9 * k) / Math.sqrt(Math.max(0.5, B.m) / 2);
    B.awake = true; B.still = 0; B.v.x += dx / (d || 1) * f; B.v.z += dz / (d || 1) * f; B.v.y += f * 0.45;
    B.w.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
  }
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.rag) continue;
    const e = pd.a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < (R * 2.5) ** 2 && Math.abs(e[13] - p.y) < 6) turnHead(pd.a, p.x, p.z);
  }
}

// mit Schwung gegen eine Mauer: Staub und Splitter von der Fassade, Alexander bleibt heil
export function flightBump(sp) {
  if (POWERS.landT > 0) return;
  POWERS.landT = 0.4;
  const p = player.p, k = Math.min(1, (sp - 30) / 100);
  fxEmit('dust', p.x, p.y + 1, p.z, 0, 0.5, 0, 6 + Math.round(10 * k), 1.6, 1 + k);
  fxEmit('spark', p.x, p.y + 1, p.z, 0, 1.5, 0, 4 + Math.round(10 * k), 2);
  fxEmit('crystal', p.x, p.y + 1, p.z, 0, 1, 0, 10, 0.8);
  POWERS.shake = Math.min(1.2, POWERS.shake + 0.3 + 0.6 * k);
  bumpSound('wood', Math.min(1, 0.4 + k), 200);
}

/* ---------- Telekinese ---------- */
function tkAim() {
  const o = camera.position, d = camera.getWorldDirection(_pd);
  let best = null, bt = TK_RANGE;
  const test = (x, y, z, r, hit) => {
    _pv.set(x - o.x, y - o.y, z - o.z);
    const t = _pv.dot(d); if (t < 0.6 || t > bt) return;
    if (_pv.lengthSq() - t * t < r * r) { bt = t; best = hit(); best.t = t; }
  };
  for (const B of LOOSE.bodies) if (B !== LOOSE.held) test(B.x.x, B.x.y, B.x.z, Math.max(0.3, B.r * B.sc + 0.15), () => ({ kind: 'loose', B }));
  for (const B of BODIES) if (!(B.player && DRIVE.on) && !B.sunk) test(B.x, B.y + 0.75, B.z, 2.1, () => ({ kind: 'car', B }));
  for (const c of TRF.cars) if (!c.dyn && !c.gone && c.wx !== undefined) test(c.wx, (c.wy || 0) + 0.75, c.wz, 2.1, () => ({ kind: 'traffic', c }));
  for (const c of parked) if (!c.hidden && !c.dyn) { const e = c.m.elements; test(e[12], e[13] + 0.5, e[14], 2.1, () => ({ kind: 'parked', c })); }
  return best;
}
export function tkGrab() {
  if (POWERS.tk || DRIVE.on || BOAT.on || DINE.seat) return false;
  const a = tkAim();
  if (!a) { toast('Telekinese: nichts im Blick'); return false; }
  let B = a.B, kind = a.kind === 'loose' ? 'loose' : 'car';
  if (a.kind === 'traffic') B = looseFromTraffic(a.c);
  else if (a.kind === 'parked') B = looseFromParked(a.c);
  const minD = (PM.view === 'third' && PM.mesh ? PM.dist : 0) + (kind === 'car' ? 7 : 2.2);
  POWERS.tk = { kind, B, dist: Math.max(minD, Math.min(40, a.t)), t: 0 };
  if (kind === 'loose') { LOOSE.tk = B; B.awake = true; B.still = 0; LOOSE.tkTarget = new T.Vector3().copy(B.x); }
  else { B.tk = true; B.air = true; B.still = 0; }
  const name = kind === 'loose' ? B.name : 'Wagen';
  toast(name + ' schwebt · Mausrad näher/weiter · Klick schleudern · T loslassen');
  return true;
}
export function tkRelease(throwIt) {
  const H = POWERS.tk; if (!H) return;
  POWERS.tk = null;
  const d = camera.getWorldDirection(_pd);
  if (H.kind === 'loose') {
    const B = H.B; LOOSE.tk = null; B.awake = true; B.still = 0;
    if (throwIt) { B.v.copy(d).multiplyScalar(B.m > 40 ? 26 : 38); B.v.y += 2; B.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); }
  } else {
    const B = H.B; B.tk = false; B.still = 0;
    if (throwIt) { B.vx = d.x * 32; B.vz = d.z * 32; B.vy = d.y * 32 + 4; B.w = (Math.random() - 0.5) * 3; B.air = true; }
  }
  if (throwIt) { const c = tkCenter(H); fxEmit('crystal', c.x, c.y, c.z, d.x * 6, d.y * 6, d.z * 6, 16, 0.8); }
}
export function tkToggle() { if (POWERS.tk) tkRelease(false); else tkGrab(); }
export function tkDistance(dy) { const H = POWERS.tk; if (H) H.dist = Math.max(H.kind === 'car' ? 6 : 1.8, Math.min(60, H.dist * (dy > 0 ? 1.12 : 1 / 1.12))); }
function tkCenter(H) { const B = H.B; return H.kind === 'loose' ? _pt.copy(B.x) : _pt.set(B.x, B.y + 0.75, B.z); }

/* ---------- Jedes Bild (vor den Wagen und den losen Dingen) ---------- */
export function updatePowers(dt, t) {
  POWERS.landT = Math.max(0, POWERS.landT - dt);
  LOOSE.tkAny = !!POWERS.tk;
  const H = POWERS.tk;
  if (H && (DRIVE.on || BOAT.on || DINE.seat || (H.kind === 'car' && (H.B.sunk || !BODIES.has(H.B))) || (H.kind === 'loose' && LOOSE.bodies.indexOf(H.B) < 0))) tkRelease(false);
  if (POWERS.tk) {
    const H2 = POWERS.tk, d = camera.getWorldDirection(_pd);
    H2.t += dt;
    _ph.copy(camera.position).addScaledVector(d, H2.dist);
    if (H2.kind === 'loose') LOOSE.tkTarget.copy(_ph);
    else {
      // Wagen: weich zum Zielpunkt schweben, leicht schaukelnd; keine Reifen, keine Schwerkraft solange er gehalten wird
      const B = H2.B; B.tk = true; B.air = true; B.still = 0;
      const k = Math.min(1, dt * 5), ex = _ph.x - B.x, ey = _ph.y - (B.y + 0.75), ez = _ph.z - B.z;
      const L = Math.hypot(ex, ey, ez), s = Math.min(28, L * 3.2) / (L || 1);
      B.vx += (ex * s - B.vx) * k; B.vz += (ez * s - B.vz) * k; B.vy += (ey * s - B.vy) * k;
      B.w *= Math.exp(-dt * 2.5);
      B.pv = (0.1 * Math.sin(H2.t * 1.3) - B.pitch) * 2.2; B.rv = (0.08 * Math.sin(H2.t * 0.9 + 1) - B.roll) * 2.2;
    }
    // Schimmer des Kristalls um das Gehaltene und ein feiner Faden von Alexanders Hand dorthin
    const c = tkCenter(H2), big = H2.kind === 'car' ? 2.2 : Math.max(0.25, H2.B.r * H2.B.sc);
    POWERS.beam += dt * (H2.kind === 'car' ? 70 : 40);
    _pr.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const hx = PM.view === 'third' && PM.mesh && !player.fly ? player.p.x - _pr.x * 0.25 : camera.position.x + _pr.x * 0.25 + d.x * 0.6;
    const hy = PM.view === 'third' && PM.mesh && !player.fly ? player.p.y + 1.25 : camera.position.y - 0.3 + d.y * 0.6;
    const hz = PM.view === 'third' && PM.mesh && !player.fly ? player.p.z - _pr.z * 0.25 : camera.position.z + _pr.z * 0.25 + d.z * 0.6;
    while (POWERS.beam > 1) {
      POWERS.beam -= 1;
      const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), r = big * (0.7 + Math.random() * 0.5);
      fxEmit('crystal', c.x + Math.sin(b) * Math.cos(a) * r, c.y + Math.cos(b) * r, c.z + Math.sin(b) * Math.sin(a) * r, 0, 0.3, 0, 1, 0.05);
      if (Math.random() < 0.5) { const u = Math.random(); fxEmit('crystal', hx + (c.x - hx) * u, hy + (c.y - hy) * u, hz + (c.z - hz) * u, (c.x - hx) * 0.15, (c.y - hy) * 0.15, (c.z - hz) * 0.15, 1, 0.03, 0.6); }
    }
  }
  // Funken des Kristalls im schnellen Flug
  const sp = player.v.length();
  if (player.fly && sp > 22) {
    POWERS.trail += dt * Math.min(30, sp * 0.3);
    while (POWERS.trail > 1) { POWERS.trail -= 1; fxEmit('crystal', player.p.x, player.p.y + 0.9, player.p.z, -player.v.x * 0.05, -player.v.y * 0.05, -player.v.z * 0.05, 1, 0.5, 0.8); }
  }
  // Unverwundbar: Wagen, die in Alexander fahren, prallen ab wie an einem Pfeiler
  POWERS.invT = Math.max(0, POWERS.invT - dt);
  if (!DRIVE.on && !BOAT.on) {
    const p = player.p;
    for (const c of TRF.cars) {
      if (c.dyn || c.gone || c.wx === undefined || c.v < 3) continue;
      if ((c.wx - p.x) ** 2 + (c.wz - p.z) ** 2 > 9 || Math.abs((c.wy || 0) - p.y) > 1.6) continue;
      const dx = c.wx - p.x, dz = c.wz - p.z, dd = Math.hypot(dx, dz) || 1;
      if (-(Math.cos(c.yaw) * dx - Math.sin(c.yaw) * dz) / dd * c.v < 1.5) continue;   // fährt nicht auf ihn zu
      if (carTouches(c.wx, c.wz, c.yaw, p)) carHitsAlexander(looseFromTraffic(c));
    }
    for (const B of BODIES) {
      if (B.tk || (B.player && DRIVE.on) || B.sunk) continue;
      if ((B.x - p.x) ** 2 + (B.z - p.z) ** 2 > 12 || Math.abs(B.y - p.y) > 1.6) continue;
      if (carTouches(B.x, B.z, B.h, p)) carHitsAlexander(B);
    }
  }
  // Blickwinkel weitet sich im schnellen Flug ein wenig
  if (!DRIVE.on && !BOAT.on) {
    if (!POWERS.fov0) POWERS.fov0 = DRIVE.fov0 || camera.fov;
    const want = POWERS.fov0 + (player.fly ? Math.max(0, Math.min(1, (sp - 35) / 110)) * 11 : 0);
    if (Math.abs(camera.fov - want) > 0.05 && (player.fly || POWERS.fovOn)) { camera.fov += (want - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); POWERS.fovOn = Math.abs(camera.fov - POWERS.fov0) > 0.05; }
  }
}
// Liegt der Spieler (Kreis 0,4 m) im Grundriss des Wagens?
function carTouches(x, z, h, p) {
  const fx = Math.cos(h), fz = -Math.sin(h), dx = p.x - x, dz = p.z - z;
  return Math.abs(dx * fx + dz * fz) < 2.25 + 0.4 && Math.abs(-dx * fz + dz * fx) < 0.95 + 0.4;
}
function carHitsAlexander(B) {
  const p = player.p, dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
  const vn = -(B.vx * nx + B.vz * nz);
  if (vn < 1.5) return;   // stehende oder langsam rollende Wagen schiebt er nicht beiseite
  // aus ihm heraus schieben: der Wagen weicht, nicht Alexander
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lf = -dx * fx - dz * fz, ls = dx * fz - dz * fx;
  const pf = 2.65 - Math.abs(lf), ps = 1.35 - Math.abs(ls);
  if (pf < ps) { const s = -Math.sign(lf) || 1; B.x += fx * s * pf; B.z += fz * s * pf; } else { const s = -Math.sign(ls) || 1; B.x += -fz * s * ps; B.z += fx * s * ps; }
  const j = impulse(B, null, nx, nz, p.x + nx * 0.4, p.z + nz * 0.4, 0.15);
  if (j > 0) crashDamage(B, p.x + nx * 0.4, p.z + nz * 0.4, j * 1.4, 0);
  fxEmit('crystal', p.x + nx * 0.5, p.y + 1.0, p.z + nz * 0.5, nx * 2, 1.5, nz * 2, 12, 0.4);
  POWERS.shake = Math.min(1, POWERS.shake + Math.min(0.5, vn * 0.03));
  if (POWERS.invT <= 0 && vn > 4) { POWERS.invT = 8; toast('Der Wagen prallt an Alexander ab · unverwundbar'); }
}
// nach dem Setzen der Kamera: leichtes Beben
export function powersCamera(dt) {
  if (POWERS.shake <= 0.001) return;
  const s = POWERS.shake * 0.22;
  camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s;
  POWERS.shake *= Math.exp(-dt * 5);
}
// für Konsole und Tests
Object.assign(POWERS, { startFlight, stopFlight, tkGrab, tkRelease, superLanding });
