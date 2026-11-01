import { shared, T, scene, camera } from './core.js';
import { MAT, mergeColored, nearBoxes } from './people-skeleton.js';
import { onIsland, curbHeight, maskAt } from './island.js';
import { WATER_Y } from './dance.js';
import { waterSplash } from './water.js';
import { roadHeightAt, terrainHeight } from './harbour.js';
import { villaRoadAt, SERP, carGeoHi, COL, serpReset, parked, serpWallHit } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { cars } from './airships.js';
import { carDamageAttr, glassFor } from './cars.js';
import { CARM, modelCarMeshes } from './carmodel.js';
import { TRF, OBSTACLES, placeTrafficCar, polyAt, _q, _ce, _p, _s, _m } from './traffic.js';
import { player, keys, touch } from './player.js';
import { DRIVE } from './eating.js';
import { fxEmit, skidMark, updateFX } from './particles.js';
import { windAt, updateLeaves, updateWindAudio } from './wind.js';
import { toast, BOAT } from './boat.js';
import { isTouch, paused } from './input.js';
import { audioCtx, audioBus } from './audio.js';

/* =====================================================================
   V16 · FAHRPHYSIK: Einspurmodell mit Reifenkräften (Schräglauf, Kammscher Kreis),
   Lastverlagerung, Viergang-Getriebe, Handbremse, Federung mit Nicken und Wanken;
   Zusammenstöße mit Impulsen (Mauern, Häuser, Verkehr, parkende Wagen),
   Schadensmodell (Beulen, Scheiben, Scheinwerfer, Motor), Reifenspuren, Qualm,
   Funken und Motorklang
   ===================================================================== */
export const VP = { m: 1450, I: 2500, a: 1.38, b: 1.52, hcg: 0.55, Cf: 100000, Cr: 118000, rw: 0.4, gears: [2.85, 1.85, 1.33, 1.0], rev: 3.3, fd: 3.9, hl: 2.62, hw: 0.98, idle: 720, red: 4600 };
export const GRAV = 9.81, VL = VP.a + VP.b;
export const BODIES = new Set();   // frei bewegliche Wagen: Spielerwagen, Unfallwagen, angeschobene Parker
export function makeBody(x, y, z, h, vx = 0, vz = 0, w = 0) {
  return { x, y, z, h, vx, vz, w, vy: 0, m: VP.m, I: VP.I, hl: VP.hl, hw: VP.hw, pitch: 0, roll: 0, pv: 0, rv: 0, dmg: [0, 0, 0, 0], still: 0, air: false, sunk: 0 };
}
export const tireF = (al, C, Fm) => { if (Fm < 1) return 0; const B = C / (1.45 * Fm); return Fm * Math.sin(1.45 * Math.atan(B * al)); };
export function engineT(rpm) { const k = Math.max(0, Math.min(1, (rpm - VP.idle) / (VP.red - VP.idle))); return 275 * (0.6 + 0.55 * Math.sin(Math.PI * (0.25 + k * 0.6))); }
// Boden unter einem Punkt: Viadukt/Tunnel, Bürgersteig, Insel; außerhalb der Insel Wasser (null)
export function groundAt(x, z, y) {
  const rd = roadHeightAt(x, z, y + 1);
  if (rd.y > -1e8) return { y: rd.y, mu: 1, road: true, via: true };
  if (typeof villaRoadAt === 'function') { const v = villaRoadAt(x, z, y); if (v) return v; }
  if (!onIsland(x, z, -0.4)) {
    // am Berg: Gelände (Bankett, Wiese, Fels)
    if (SERP.on) { const th = terrainHeight(x, z); if (th > WATER_Y + 0.3) return { y: th, mu: 0.7, grass: true, hill: true }; }
    return null;
  }
  const c = curbHeight(x, z);
  if (c > 0) return { y: c, mu: 0.92, road: false };
  const m = maskAt(x, z);
  if (m[0] > 0.5) return { y: 0.02, mu: 0.62, grass: true };
  if (m[1] > 0.5) return { y: 0.02, mu: 0.7, gravel: true };
  return { y: 0, mu: 1, road: true };
}

/* ---------- Spielerwagen ---------- */
// Fahrzustand des Spielerwagens; wird in build() gesetzt (nicht beim Laden, damit die Modulreihenfolge keine Rolle spielt)
export function initDriveState() { Object.assign(DRIVE, { body: null, gear: 0, rpm: VP.idle, shiftT: 0, revMode: false, revT: 0, delta: 0, spin: [0, 0, 0, 0], wheelA: 0, slip: 0, lock: 0, axf: 0, ayf: 0, shake: 0, wheels: null, glass: null, lights: null, stalled: false, au: null, lastW: null, fov0: 0, camP: null, splashT: 0 }); }
export function playerCarMesh() {
  if (DRIVE.mesh) return;
  DRIVE.mesh = new T.InstancedMesh(carGeoHi({ driver: true, noWheels: true }), MAT.carPaint, 1);
  carDamageAttr(DRIVE.mesh);
  DRIVE.mesh.frustumCulled = false; scene.add(DRIVE.mesh);
  DRIVE.mesh.setColorAt(0, new T.Color(0.3, 0.05, 0.06));
  DRIVE.glass = glassFor(DRIVE.mesh); DRIVE.glass.count = 1;
  DRIVE.wheels = new T.InstancedMesh(wheelGeo(), MAT.carPaint, 4); DRIVE.wheels.frustumCulled = false; scene.add(DRIVE.wheels);
  DRIVE.wheels.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const lp = [];
  for (let k = 0; k < 2; k++) lp.push({ p: [0, -50, 0], c: [1.5, 1.35, 1.0], s: 1.1, ph: 0, bl: 0 });
  for (let k = 0; k < 2; k++) lp.push({ p: [0, -50, 0], c: [1.5, 0.1, 0.06], s: 0.6, ph: 0, bl: 0 });
  DRIVE.lights = makeGlowPoints(lp, true); scene.add(DRIVE.lights);
  // V39: Pierce Arrow als Spielerwagen (Karosserie und vier drehbare Räder aus dem Modell); verborgen, bis man einen nimmt
  if (CARM.ready) {
    const M = modelCarMeshes(1, false); M.lo.visible = false; DRIVE.mMesh = M.hi;
    DRIVE.mWheels = new T.InstancedMesh(CARM.geoWheel, CARM.mat, 4); DRIVE.mWheels.frustumCulled = false; DRIVE.mWheels.castShadow = true; DRIVE.mWheels.count = 0;
    DRIVE.mWheels.instanceMatrix.setUsage(T.DynamicDrawUsage); for (let k = 0; k < 4; k++) DRIVE.mWheels.setColorAt(k, new T.Color(1, 1, 1)); scene.add(DRIVE.mWheels);
  }
  carKind(false);
}
// V39: sichtbaren Wagentyp des Spielerwagens wählen (eigene Limousine oder Pierce Arrow)
export function carKind(model) {
  DRIVE.model = !!(model && DRIVE.mMesh);
  DRIVE.mesh.count = DRIVE.glass.count = DRIVE.model ? 0 : 1; DRIVE.wheels.count = DRIVE.model ? 0 : 4;
  if (DRIVE.mMesh) { DRIVE.mMesh.count = DRIVE.model ? 1 : 0; DRIVE.mWheels.count = DRIVE.model ? 4 : 0; }
}
// Drahtspeichenrad mit Weißwandreifen (Achse entlang z, außen = +z)
export function wheelGeo() {
  const P = [];
  P.push([new T.TorusGeometry(0.34, 0.1, 8, 22), COL.tyre]);
  P.push([new T.CylinderGeometry(0.3, 0.3, 0.02, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.1), COL.wall]);
  P.push([new T.CylinderGeometry(0.075, 0.09, 0.2, 10).rotateX(Math.PI / 2).translate(0, 0, 0.02), COL.chrome]);
  P.push([new T.CylinderGeometry(0.24, 0.24, 0.015, 18).rotateX(Math.PI / 2).translate(0, 0, -0.04), COL.dark]);
  for (let k = 0; k < 12; k++) { const g = new T.BoxGeometry(0.013, 0.5, 0.013); g.rotateZ(k * Math.PI / 12); g.translate(0, 0, (k % 2) ? 0.04 : -0.02); P.push([g, COL.chrome]); }
  // Profil: kleine Stollen auf der Lauffläche, damit man das Drehen sieht
  for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; P.push([new T.BoxGeometry(0.06, 0.03, 0.16).rotateZ(a).translate(Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0), [0.05, 0.05, 0.05]]); }
  return mergeColored(P);
}
export function driveEnter(c) {
  playerCarMesh();
  initCarAudio();
  if (c) {
    // den geparkten Wagen übernehmen: Lage, Richtung und Farbe
    c.hidden = true; shared.parkedTimer = 0;
    const e = c.m.elements;
    const h = Math.atan2(e[8], e[0]), x = e[12], z = e[14];
    if (DRIVE.body) BODIES.delete(DRIVE.body);
    DRIVE.body = makeBody(x, Math.max(0, e[13] - 0.22), z, h);
    if (c.dyn) { Object.assign(DRIVE.body, { vx: c.dyn.vx, vz: c.dyn.vz, w: c.dyn.w, dmg: c.dyn.dmg }); BODIES.delete(c.dyn); }
    if (c.dmg) DRIVE.body.dmg = c.dmg.slice();
    DRIVE.col = c.c;
    DRIVE.mesh.setColorAt(0, new T.Color(...c.c)); DRIVE.mesh.instanceColor.needsUpdate = true;
    DRIVE.wheels.setColorAt(0, new T.Color(...c.c)); for (let k = 1; k < 4; k++) DRIVE.wheels.setColorAt(k, new T.Color(...c.c)); DRIVE.wheels.instanceColor.needsUpdate = true;
    carKind(c.model);
    if (DRIVE.model) { DRIVE.mMesh.setColorAt(0, new T.Color(...c.c)); DRIVE.mMesh.instanceColor.needsUpdate = true; }
    BODIES.add(DRIVE.body); DRIVE.body.player = true;
    DRIVE.gear = 0; DRIVE.rpm = VP.idle; DRIVE.revMode = false; DRIVE.stalled = false;
  }
  const B = DRIVE.body;
  DRIVE.on = true; DRIVE.x = B.x; DRIVE.z = B.z; DRIVE.y = B.y; DRIVE.h = B.h;
  player.fly = false; player.on = null; player.v.set(0, 0, 0);
  player.yaw = B.h - Math.PI / 2; player.pitch = -0.16;
  DRIVE.camP = null;
  toast(isTouch ? 'Am Steuer · Knopf ▼ Handbremse' : 'Am Steuer · W/S Gas und Bremse · Leertaste Handbremse · R Wagen aufrichten');
}
export function driveExit() {
  if (!DRIVE.on) return;
  DRIVE.on = false;
  // links neben der Fahrertür aussteigen (Fahrer sitzt rechts, also über den Beifahrersitz, wenn die Straße frei ist)
  const B = DRIVE.body, lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  player.p.set(B.x + lx * 2.1, Math.max(0, B.y) + 0.05, B.z + lz * 2.1);
  if (!onIsland(player.p.x, player.p.z, 1)) player.p.set(B.x - lx * 2.1, Math.max(0, B.y) + 0.05, B.z - lz * 2.1);
  player.v.set(0, 0, 0); player.pitch = 0;
  if (camera.fov !== DRIVE.fov0 && DRIVE.fov0) { camera.fov = DRIVE.fov0; camera.updateProjectionMatrix(); }
  toast('Ausgestiegen');
}
// Wagen aufrichten und auf die nächste Fahrspur stellen (R)
export function driveReset() {
  const B = DRIVE.body; if (!B) return;
  let best = null, bd = 1e18;
  const sy = typeof serpReset === 'function' ? serpReset(B) : false;
  if (sy === false) for (const L of TRF.lanes) { if (L.e.kind === 'link') continue; for (let k = 0; k < L.pts.length; k += 2) { const p = L.pts[k], d = (p[0] - B.x) ** 2 + (p[1] - B.z) ** 2; if (d < bd) { bd = d; best = [L, k]; } } }
  if (best && sy === false) {
    const [L, k] = best, p = L.pts[k], q = L.pts[Math.min(L.pts.length - 1, k + 1)], r = L.pts[Math.max(0, k - 1)];
    B.x = p[0]; B.z = p[1]; B.h = Math.atan2(-(q[1] - r[1]), q[0] - r[0]);
  }
  Object.assign(B, { vx: 0, vz: 0, w: 0, vy: 0, y: sy || 0, pitch: 0, roll: 0, pv: 0, rv: 0, air: false, sunk: 0, dmg: [0, 0, 0, 0] });
  DRIVE.stalled = false; DRIVE.gear = 0; DRIVE.revMode = false; DRIVE.camP = null;
  toast('Wagen repariert und aufgerichtet');
}
export const _dp = { x: 0, y: 0, z: 0 };
export function updateDrive(dt) {
  if (player.fly) { driveExit(); return; }
  // Eingaben sammeln; die Physik läuft in updateVehicles
  const up = (keys.KeyW || keys.ArrowUp ? 1 : 0) + Math.max(0, touch.my), dn = (keys.KeyS || keys.ArrowDown ? 1 : 0) + Math.max(0, -touch.my);
  DRIVE.inp = { up: Math.min(1, up), dn: Math.min(1, dn), st: Math.max(-1, Math.min(1, (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.mx)), hb: !!(keys.Space || touch.down), boost: !!(keys.ShiftLeft || keys.ShiftRight) };
  if (keys.KeyR && !DRIVE.rDown) driveReset();
  DRIVE.rDown = !!keys.KeyR;
}
// ein Teilschritt für den Spielerwagen
export function stepPlayerCar(B, dt, inp) {
  const D = DRIVE, fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  let u = B.vx * fx + B.vz * fz, v = B.vx * lx + B.vz * lz, r = B.w;
  const dm = B.dmg, dAvg = (dm[0] + dm[1] + dm[2] + dm[3]) / 4;
  const mu = (B.mu || 1) * (1 - 0.1 * dAvg);
  // Lastverlagerung beim Bremsen und Beschleunigen
  const Fzf = Math.max(800, VP.m * GRAV * VP.b / VL - VP.m * D.axf * VP.hcg / VL), Fzr = Math.max(800, VP.m * GRAV * VP.a / VL + VP.m * D.axf * VP.hcg / VL);
  // Gas, Bremse, Rückwärtsgang
  let thr = 0, brk = 0;
  if (!D.revMode) { thr = inp.up; brk = inp.dn; if (inp.dn > 0.5 && Math.abs(u) < 0.6 && !inp.up) { if ((D.revT += dt) > 0.25) { D.revMode = true; D.revT = 0; } } else D.revT = 0; }
  else { thr = inp.dn; brk = inp.up; if (inp.up > 0.5 && Math.abs(u) < 0.6 && !inp.dn) { if ((D.revT += dt) > 0.15) { D.revMode = false; D.revT = 0; } } else D.revT = 0; }
  if (D.stalled) thr = 0;
  // Getriebe: automatisch schalten, kurze Zugkraftunterbrechung
  const ratio = D.revMode ? VP.rev : VP.gears[D.gear];
  const wheelRpm = Math.abs(u) / VP.rw * ratio * VP.fd * 60 / (2 * Math.PI);
  let rpm = Math.max(wheelRpm, VP.idle + thr * 1900 * Math.max(0, 1 - Math.abs(u) / 7));
  if (D.spinning) rpm = Math.max(rpm, D.rpm + (VP.red - D.rpm) * 4 * dt * thr);
  rpm = Math.min(rpm, VP.red + 60);
  D.rpm += (rpm - D.rpm) * Math.min(1, dt * 14);
  if (!D.revMode && D.shiftT <= 0) {
    if (D.rpm > 4150 && D.gear < 3 && thr > 0.2) { D.gear++; D.shiftT = 0.28; }
    else if (D.gear > 0 && wheelRpm * VP.gears[D.gear - 1] / VP.gears[D.gear] < 3300 && D.rpm < 1750) { D.gear--; D.shiftT = 0.2; }
  }
  D.shiftT -= dt;
  let Fd = 0;
  if (thr > 0 && D.rpm < VP.red) Fd = engineT(D.rpm) * ratio * VP.fd / VP.rw * 0.85 * thr * (inp.boost ? 1.3 : 1) * (1 - 0.55 * Math.max(0, dm[0] - 0.3)) * (D.shiftT > 0 ? 0.15 : 1);
  if (D.revMode) { Fd = -Fd * 0.6; if (u < -9) Fd = 0; }
  // Bremsen (60 % vorn), Handbremse blockiert die Hinterräder
  const su = Math.abs(u) < 0.25 ? 0 : Math.sign(u);
  const Fb = brk * 1.05 * VP.m * GRAV * mu;
  let Fxf = -su * Fb * 0.6, Fxr = Fd - su * Fb * 0.4;
  if (inp.hb) Fxr = Fd * 0.3 - su * mu * Fzr * 0.95;
  // stehend: Bremse/Handbremse halten den Wagen fest
  if (su === 0 && (brk > 0.1 || inp.hb) && !thr) { u *= Math.max(0, 1 - dt * 12); }
  // Kammscher Kreis: was längs übertragen wird, fehlt quer
  // V26: Reifen-Lastempfindlichkeit: in schnellen Kurven trägt das äußere Rad mehr, aber nicht im gleichen Maß mehr Haftung;
  // die Achse verliert etwas Griff (vorn weniger als hinten: der Wagen schiebt erst sanft, dann bricht das Heck aus, wie bei echten Wagen)
  const lat = VP.m * Math.abs(D.ayf) * VP.hcg / 1.45, lsF = 1 - 0.16 * Math.min(1, (lat * 0.5 / Fzf) ** 2), lsR = 1 - 0.2 * Math.min(1, (lat * 0.5 / Fzr) ** 2);
  const mxf = mu * Fzf * lsF, mxr = mu * Fzr * lsR;
  D.lock = Math.abs(Fxf) > mxf ? 1 : 0;
  if (Math.abs(Fxf) > mxf) Fxf = Math.sign(Fxf) * mxf * 0.9;
  D.spinning = Fd !== 0 && Math.abs(Fxr) > mxr;
  const rearLock = inp.hb || Math.abs(Fxr) > mxr;
  if (Math.abs(Fxr) > mxr) Fxr = Math.sign(Fxr) * mxr * 0.9;
  const Fyfm = Math.sqrt(Math.max(0, mxf * mxf - Fxf * Fxf)) * (D.lock ? 0.5 : 1), Fyrm = Math.sqrt(Math.max(0, mxr * mxr - Fxr * Fxr)) * (rearLock ? 0.6 : 1);
  // Lenkung: geschwindigkeitsabhängiger Einschlag, sanfte Gegenlenkhilfe, Zug zur beschädigten Seite
  const beta = Math.abs(u) > 3 ? Math.atan2(v, Math.abs(u)) : 0;
  const dmax = 0.62 / (1 + Math.abs(u) * 0.07);
  let tgt = -inp.st * dmax + beta * (Math.abs(inp.st) < 0.1 ? 0.7 : 0.35);
  // Lenkhilfe: Vorderräder nur bis knapp über den besten Schräglauf einschlagen (kein Schieben über die Vorderachse)
  if (u > 4 && !inp.hb) { const kin = Math.atan((v + VP.a * r) / u); tgt = Math.max(kin - 0.16, Math.min(kin + 0.16, tgt)); }
  tgt = Math.max(-0.7, Math.min(0.7, tgt)) + (dm[3] - dm[2]) * 0.06;
  const rate = Math.abs(inp.st) > 0.1 ? 2.6 : 3.6;
  D.delta += Math.max(-rate * dt, Math.min(rate * dt, tgt - D.delta));
  const del = D.delta, sg = u >= 0 ? 1 : -1, ua = Math.max(Math.abs(u), 1.5);
  const af = sg * del - Math.atan((v + VP.a * r) / ua), ar = -Math.atan((v - VP.b * r) / ua);
  const Fyf = tireF(af, VP.Cf, Fyfm), Fyr = tireF(ar, VP.Cr, Fyrm);
  // Luftwiderstand, Rollwiderstand (Wiese bremst stärker)
  const drag = 1.15 * u * Math.abs(u) + (Math.abs(u) > 0.05 ? Math.sign(u) * VP.m * GRAV * (B.grass ? 0.06 : 0.014) : 0);
  const cd = Math.cos(del), sd = Math.sin(del);
  // Seitenwind: auf dem Viadukt spürbar, Böen versetzen den Wagen
  const wv = windAt(B.x, B.z, B.y), wl = wv[0] * lx + wv[1] * lz - v, Fw = 3.8 * wl * Math.abs(wl) * (B.y > 8 ? 2.2 : 1);
  const ax = (Fxr + Fxf * cd - Fyf * sd - drag) / VP.m, ay = (Fyf * cd + Fxf * sd + Fyr + Fw) / VP.m;
  let du = ax + v * r, dv = ay - u * r, dr = (VP.a * (Fyf * cd + Fxf * sd) - VP.b * Fyr) / VP.I;
  u += du * dt; v += dv * dt; r += dr * dt;
  // langsam: rein geometrisches Lenken, damit Rangieren ruhig bleibt
  const kb = Math.max(0, Math.min(1, (Math.abs(u) - 1.2) / 3));
  r = r * kb + (u * Math.tan(del) / VL) * (1 - kb); v *= kb + (1 - kb) * Math.max(0, 1 - dt * 10);
  if (su === 0 && !thr && Math.abs(u) < 0.25) u *= Math.max(0, 1 - dt * 3);
  D.axf += (ax - D.axf) * Math.min(1, dt * 6); D.ayf += (ay - D.ayf) * Math.min(1, dt * 6);
  D.slip = Math.max(Math.abs(ar), Math.abs(af) * 0.7) * Math.min(1, Math.abs(u) / 6) + (rearLock && Math.abs(u) > 2 ? 0.4 : 0) + (D.spinning ? 0.5 : 0) + (D.lock && Math.abs(u) > 2 ? 0.5 : 0);
  B.vx = u * fx + v * lx; B.vz = u * fz + v * lz; B.w = r;
  D.u = u;
}
// ein Unfallwagen ohne Fahrer am Steuer: rollt aus, rutscht quer, dreht sich aus
export function stepLooseCar(B, dt) {
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  let u = B.vx * fx + B.vz * fz, v = B.vx * lx + B.vz * lz;
  const mu = B.mu || 1, brake = B.player ? (DRIVE.on ? 0 : 6) : 5.5;
  u -= Math.sign(u) * Math.min(Math.abs(u), (brake + 0.3) * mu * dt);
  v -= Math.sign(v) * Math.min(Math.abs(v), 8 * mu * dt);
  B.w *= Math.max(0, 1 - dt * 2.2 * mu);
  B.vx = u * fx + v * lx; B.vz = u * fz + v * lz;
}

/* ---------- Zusammenstöße ---------- */
export const _cn = { nx: 0, nz: 0, d: 0, px: 0, pz: 0 };
// Rechteck (Wagen) gegen achsenparallelen Quader; Ergebnis: Normale vom Quader zum Wagen, Tiefe, Berührpunkt
export function obbAabb(B, b) {
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  const bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2;
  let ex = (b.x1 - b.x0) / 2, ez = (b.z1 - b.z0) / 2;
  // Masten, Laternen und Bäume: für Fußgänger großzügig, für Wagen nur der Stamm
  if (ex < 1.1 && ez < 1.1) { ex = Math.min(ex, 0.3); ez = Math.min(ez, 0.3); b = { x0: bx - ex, x1: bx + ex, z0: bz - ez, z1: bz + ez }; }
  const dx = B.x - bx, dz = B.z - bz;
  let best = 1e9, nx = 0, nz = 0, carAxis = false;
  for (const [ax, az, isCar] of [[1, 0, false], [0, 1, false], [fx, fz, true], [lx, lz, true]]) {
    const rc = B.hl * Math.abs(fx * ax + fz * az) + B.hw * Math.abs(lx * ax + lz * az), rb = ex * Math.abs(ax) + ez * Math.abs(az);
    const d = dx * ax + dz * az, o = rc + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = ax * s; nz = az * s; carAxis = isCar; }
  }
  _cn.nx = nx; _cn.nz = nz; _cn.d = best;
  if (!carAxis) { const sf = Math.sign(fx * nx + fz * nz), sl = Math.sign(lx * nx + lz * nz); _cn.px = B.x - fx * B.hl * sf - lx * B.hw * sl; _cn.pz = B.z - fz * B.hl * sf - lz * B.hw * sl; }
  else { _cn.px = Math.max(b.x0, Math.min(b.x1, bx + ex * Math.sign(nx || 1e-9))); _cn.pz = Math.max(b.z0, Math.min(b.z1, bz + ez * Math.sign(nz || 1e-9))); if (Math.abs(nx) > Math.abs(nz)) _cn.pz = Math.max(b.z0, Math.min(b.z1, B.z)); else _cn.px = Math.max(b.x0, Math.min(b.x1, B.x)); }
  return _cn;
}
// Rechteck gegen Rechteck (zwei Wagen); Normale von A nach B
export function obbObb(A, B) {
  const ax = [[Math.cos(A.h), -Math.sin(A.h)], [-Math.sin(A.h), -Math.cos(A.h)]], bx = [[Math.cos(B.h), -Math.sin(B.h)], [-Math.sin(B.h), -Math.cos(B.h)]];
  const dx = B.x - A.x, dz = B.z - A.z;
  if (dx * dx + dz * dz > 36) return null;
  let best = 1e9, nx = 0, nz = 0, fromA = true;
  for (let k = 0; k < 4; k++) {
    const [qx, qz] = k < 2 ? ax[k] : bx[k - 2];
    const ra = A.hl * Math.abs(ax[0][0] * qx + ax[0][1] * qz) + A.hw * Math.abs(ax[1][0] * qx + ax[1][1] * qz);
    const rb = B.hl * Math.abs(bx[0][0] * qx + bx[0][1] * qz) + B.hw * Math.abs(bx[1][0] * qx + bx[1][1] * qz);
    const d = dx * qx + dz * qz, o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = qx * s; nz = qz * s; fromA = k < 2; }
  }
  // Berührpunkt: die tiefste Ecke des anderen Wagens
  const C = fromA ? B : A, e = fromA ? bx : ax, sgn = fromA ? -1 : 1;
  const s0 = Math.sign(e[0][0] * nx + e[0][1] * nz) * sgn, s1 = Math.sign(e[1][0] * nx + e[1][1] * nz) * sgn;
  _cn.px = C.x + e[0][0] * C.hl * s0 + e[1][0] * C.hw * s1; _cn.pz = C.z + e[0][1] * C.hl * s0 + e[1][1] * C.hw * s1;
  _cn.nx = nx; _cn.nz = nz; _cn.d = best;
  return _cn;
}
// Stoß: A gegen B (B = null: feste Wand); n zeigt von B nach A
export function impulse(A, B, nx, nz, px, pz, e = 0.25) {
  const rax = px - A.x, raz = pz - A.z;
  let vax = A.vx + A.w * raz, vaz = A.vz - A.w * rax;
  let vbx = 0, vbz = 0, rbx = 0, rbz = 0;
  if (B) { rbx = px - B.x; rbz = pz - B.z; vbx = B.vx + B.w * rbz; vbz = B.vz - B.w * rbx; }
  const rvx = vax - vbx, rvz = vaz - vbz, vn = rvx * nx + rvz * nz;
  if (vn >= 0) return 0;
  const ca = raz * nx - rax * nz, cb = rbz * nx - rbx * nz;
  const k = 1 / A.m + ca * ca / A.I + (B ? 1 / B.m + cb * cb / B.I : 0);
  const j = -(1 + e) * vn / k;
  // Reibung entlang der Berührfläche (Schrammen)
  const tx = -nz, tz = nx, vt = rvx * tx + rvz * tz;
  const cta = raz * tx - rax * tz, ctb = rbz * tx - rbx * tz;
  const kt = 1 / A.m + cta * cta / A.I + (B ? 1 / B.m + ctb * ctb / B.I : 0);
  const jt = Math.max(-0.45 * j, Math.min(0.45 * j, -vt / kt));
  const Jx = j * nx + jt * tx, Jz = j * nz + jt * tz;
  A.vx += Jx / A.m; A.vz += Jz / A.m; A.w += (raz * Jx - rax * Jz) / A.I;
  if (B) { B.vx -= Jx / B.m; B.vz -= Jz / B.m; B.w -= (rbz * Jx - rbx * Jz) / B.I; }
  return j;
}
// Schaden an der getroffenen Seite; Funken, Glassplitter, Klang
export function crashDamage(B, px, pz, j, vt) {
  const dv = j / B.m;
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  const rx = px - B.x, rz = pz - B.z, a = (rx * fx + rz * fz) / B.hl, l = (rx * lx + rz * lz) / B.hw;
  if (dv > 1.6) {
    const amt = Math.min(0.6, (dv - 1.6) * 0.055);
    const side = Math.abs(a) > Math.abs(l) * 0.9 ? (a > 0 ? 0 : 1) : (l > 0 ? 2 : 3);
    B.dmg[side] = Math.min(1, B.dmg[side] + amt);
    // benachbarte Seiten bekommen etwas ab
    if (side < 2) B.dmg[l > 0 ? 2 : 3] = Math.min(1, B.dmg[l > 0 ? 2 : 3] + amt * 0.25); else B.dmg[a > 0 ? 0 : 1] = Math.min(1, B.dmg[a > 0 ? 0 : 1] + amt * 0.25);
  }
  const y = (B.y || 0) + 0.7;
  if (dv > 2.5 || vt > 3) fxEmit('spark', px, y, pz, B.vx * 0.3, 1.5, B.vz * 0.3, Math.min(30, 4 + dv * 3 + vt), 1.6);
  if (dv > 5) fxEmit('glass', px, y + 0.6, pz, B.vx * 0.2, 1.2, B.vz * 0.2, 12, 1.4);
  if (dv > 3) fxEmit('dust', px, 0.4, pz, 0, 0.5, 0, 3, 1);
  if (B.player || (Math.hypot(B.x - camera.position.x, B.z - camera.position.z) < 60)) carCrashSound(Math.min(1, dv / 10), Math.min(1, vt / 8));
  if (B.player) { DRIVE.shake = Math.min(1, DRIVE.shake + dv * 0.08); if (B.dmg[0] > 0.95 && DRIVE.on && !DRIVE.stalled) { DRIVE.stalled = true; toast('Motor abgesoffen · R zum Reparieren'); } }
}
// Verkehrswagen und Parker werden bei Berührung zu freien Körpern
export function looseFromTraffic(car) {
  if (car.dyn) return car.dyn;
  const B = makeBody(car.wx, car.wy || 0, car.wz, car.yaw, Math.cos(car.yaw) * car.v, -Math.sin(car.yaw) * car.v, 0);
  B.traffic = car; B.dmg = car.dmg || [0, 0, 0, 0]; car.dmg = B.dmg;
  car.dyn = B; const i = car.lane.cars.indexOf(car); if (i >= 0) car.lane.cars.splice(i, 1);
  BODIES.add(B);
  return B;
}
export function looseFromParked(c) {
  if (c.dyn) return c.dyn;
  const e = c.m.elements, B = makeBody(e[12], 0, e[14], Math.atan2(e[8], e[0]));
  B.parked = c; B.dmg = c.dmg || [0, 0, 0, 0]; c.dmg = B.dmg; c.dyn = B; BODIES.add(B);
  return B;
}
// Verkehr in der Nähe: Hüllkörper ohne Speicher (Kreis-Vorfilter)
export const _tb = { x: 0, z: 0, h: 0, hl: VP.hl, hw: VP.hw };
export function collideBody(B) {
  let hits = 0;
  // Häuser, Mauern, Masten
  for (const b of nearBoxes(B.x, B.z, 4)) {
    if (b.y1 <= B.y + 0.35 || b.y0 >= B.y + 1.9) continue;
    const c = obbAabb(B, b); if (!c) continue;
    B.x += c.nx * c.d; B.z += c.nz * c.d;
    const vt = Math.abs(B.vx * -c.nz + B.vz * c.nx);
    const j = impulse(B, null, c.nx, c.nz, c.px, c.pz, 0.2);
    if (j > 0) crashDamage(B, c.px, c.pz, j, vt);
    else if (vt > 3 && Math.random() < 0.5) fxEmit('spark', c.px, B.y + 0.6, c.pz, 0, 1, 0, 2, 1);
    hits++;
  }
  // fahrende Wagen
  for (const car of TRF.cars) {
    if (car.dyn || car.gone) continue;
    if ((car.wx - B.x) ** 2 + (car.wz - B.z) ** 2 > 36 || Math.abs((car.wy || 0) - B.y) > 2) continue;
    _tb.x = car.wx; _tb.z = car.wz; _tb.h = car.yaw;
    if (!obbObb(B, _tb)) continue;
    const O = looseFromTraffic(car); hits += collidePair(B, O);
  }
  for (const car of cars) {
    if (car.graph || car.wx === undefined) continue;
    if ((car.wx - B.x) ** 2 + (car.wz - B.z) ** 2 > 9 || Math.abs((car.wy || 0) - B.y) > 2) continue;
    // Hochstraße und Viadukt: einfacher Abstand, diese Wagen bleiben auf der Schiene
    const dx = B.x - car.wx, dz = B.z - car.wz, d = Math.hypot(dx, dz) || 1;
    B.x += dx / d * (3 - d) * 0.5; B.z += dz / d * (3 - d) * 0.5;
    const j = impulse(B, null, dx / d, dz / d, car.wx + dx / d * 1.5, car.wz + dz / d * 1.5, 0.2); if (j > 0) crashDamage(B, car.wx + dx / d * 1.5, car.wz + dz / d * 1.5, j, 0);
  }
  // parkende Wagen
  for (const c of parked) {
    if (c.hidden || c.dyn) continue;
    if ((c.x - B.x) ** 2 + (c.z - B.z) ** 2 > 36) continue;
    const e = c.m.elements; _tb.x = e[12]; _tb.z = e[14]; _tb.h = Math.atan2(e[8], e[0]);
    if (!obbObb(B, _tb)) continue;
    const O = looseFromParked(c); hits += collidePair(B, O);
  }
  return hits;
}
export function collidePair(A, O) {
  const c = obbObb(A, O); if (!c) return 0;
  // Normale zeigt von A nach O; A nach außen schieben
  const nx = -c.nx, nz = -c.nz, w = O.m / (A.m + O.m);
  A.x += nx * c.d * w; A.z += nz * c.d * w; O.x -= nx * c.d * (1 - w); O.z -= nz * c.d * (1 - w);
  const vt = Math.abs((A.vx - O.vx) * -nz + (A.vz - O.vz) * nx);
  const j = impulse(A, O, nx, nz, c.px, c.pz, 0.3);
  if (j > 0) { crashDamage(A, c.px, c.pz, j, vt); crashDamage(O, c.px, c.pz, j, vt); }
  return 1;
}

/* ---------- Welt: alle beweglichen Wagen, Federung, Wasser, Darstellung ---------- */
export function updateVehicles(dt) {
  OBSTACLES.length = 0;
  const cp = camera.position;
  for (const B of BODIES) {
    const ctl = B.player && DRIVE.on && !B.sunk;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      const g = groundAt(B.x, B.z, B.y);
      B.mu = g ? g.mu : 0.2; B.grass = g && (g.grass || g.gravel);
      if (!B.air && !B.sunk) { if (ctl) stepPlayerCar(B, h, DRIVE.inp || { up: 0, dn: 0, st: 0, hb: true }); else stepLooseCar(B, h); }
      else { const k = B.sunk ? 1.6 : 0.02; B.vx *= Math.max(0, 1 - h * k); B.vz *= Math.max(0, 1 - h * k); B.w *= Math.max(0, 1 - h * k); }
      const ox = B.x, oz = B.z;
      B.x += B.vx * h; B.z += B.vz * h; B.h += B.w * h;
      // nicht über die Brüstung des Viadukts
      const g2 = groundAt(B.x, B.z, B.y);
      if (g && g.via && (!g2 || (!g2.via && !g2.serp && g2.y < g.y - 2))) { B.x = ox; B.z = oz; const nx = Math.sign(-B.x) || 1; const j = impulse(B, null, nx, 0, B.x - nx * B.hw, B.z, 0.15); if (j > 0) crashDamage(B, B.x - nx * B.hw, B.z, j, 4); B.vx = nx * Math.abs(B.vx) * 0.2; }
      if (g && g.serp && (s === n - 1 || B.player)) serpWallHit(B);
      // Hangabtrieb: bergauf langsamer, bergab schneller
      if (B.slope && !B.air) { const fxs = Math.cos(B.h), fzs = -Math.sin(B.h), a = GRAV * Math.sin(B.slope) * h; B.vx -= fxs * a; B.vz -= fzs * a; }
      if (s === n - 1 || B.player) collideBody(B);
    }
    // Höhe: Federung zum Boden, Fall ins Wasser
    const g = groundAt(B.x, B.z, B.y);
    if (B.tk) {
      // V33: von Alexanders Telekinese gehalten: schwebt ohne Schwerkraft, setzt höchstens auf dem Boden auf
      B.y += B.vy * dt; if (g && B.y < g.y) { B.y = g.y; B.vy = Math.max(0, B.vy); }
      if (!g && B.y < WATER_Y + 0.5) { B.y = WATER_Y + 0.5; B.vy = Math.max(0, B.vy); }
      B.air = true;
    } else if (g) {
      if (B.y > g.y + 0.25) { B.air = true; B.vy -= GRAV * dt; B.y += B.vy * dt; if (B.y <= g.y) { if (B.vy < -4) { B.pv -= B.vy * 0.02; if (B.player) DRIVE.shake = Math.min(1, DRIVE.shake - B.vy * 0.04); }
        // V33: geschleuderte Wagen schlagen hart auf und verbeulen
        if (B.vy < -9) { crashDamage(B, B.x + Math.cos(B.h) * 1.6 * Math.sign(Math.random() - 0.5), B.z - Math.sin(B.h) * 1.6, -B.vy * B.m * 0.22, 2); fxEmit('dust', B.x, g.y + 0.3, B.z, 0, 0.8, 0, 6, 2, 1.3); }
        B.y = g.y; B.vy = 0; B.air = false; } }
      else { B.air = false; B.vy = 0; B.y += (g.y - B.y) * Math.min(1, dt * 14); }
    } else {
      // über die Kaimauer: Flug, Aufschlag, Gischt, Versinken
      B.air = true; B.vy -= GRAV * dt; B.y += B.vy * dt;
      if (B.y < WATER_Y + 0.4 && !B.sunk) {
        B.sunk = 0.001; fxEmit('spray', B.x, WATER_Y + 0.2, B.z, B.vx * 0.2, 4.5, B.vz * 0.2, 40, 2.2, 1.4); fxEmit('foam', B.x, WATER_Y + 0.1, B.z, 0, 0, 0, 16, 2.5, 1.5);
        if (typeof waterSplash === 'function') waterSplash(B.x, B.z, 1.2);
        carCrashSound(0.6, 0, true);
        if (B.player && DRIVE.on) toast('Ins Wasser gestürzt · R holt den Wagen zurück an Land');
      }
      if (B.sunk) { B.sunk += dt; B.vy = Math.max(B.vy, -0.6 - B.sunk * 0.2); B.vy *= Math.max(0, 1 - dt * 3); if (Math.random() < dt * 8) fxEmit('foam', B.x + (Math.random() - 0.5) * 3, WATER_Y + 0.05, B.z + (Math.random() - 0.5) * 3, 0, 0, 0, 1, 0.6, 0.6); if (B.y < WATER_Y - 6) B.y = WATER_Y - 6; }
    }
    // Federung: Nicken beim Bremsen, Wanken in der Kurve, Feder-Dämpfer zweiter Ordnung
    const fx = Math.cos(B.h), fz = -Math.sin(B.h);
    const ax = B.player && ctl ? DRIVE.axf : 0, ay = B.player && ctl ? DRIVE.ayf : 0;
    const tp = Math.max(-0.07, Math.min(0.07, ax * 0.011)), tr = Math.max(-0.08, Math.min(0.08, ay * 0.0105));
    // Bürgersteigkante unter einzelnen Rädern
    let gp = 0, gr = 0;
    if (g && !B.air && (B.player || (B.x - cp.x) ** 2 + (B.z - cp.z) ** 2 < 2500)) {
      const lx = -Math.sin(B.h), lz = -Math.cos(B.h), hh = (px, pz) => { const q = groundAt(px, pz, B.y); return q ? q.y : g.y; };
      const fl = hh(B.x + fx * 1.55 + lx * 0.86, B.z + fz * 1.55 + lz * 0.86), fr = hh(B.x + fx * 1.55 - lx * 0.86, B.z + fz * 1.55 - lz * 0.86);
      const rl = hh(B.x - fx * 1.55 + lx * 0.86, B.z - fz * 1.55 + lz * 0.86), rr = hh(B.x - fx * 1.55 - lx * 0.86, B.z - fz * 1.55 - lz * 0.86);
      gp = Math.atan2((fl + fr - rl - rr) / 2, 3.1); gr = Math.atan2((fr + rr - fl - rl) / 2, 1.72);
      B.slope = Math.abs(gp) < 0.5 ? gp : 0;
      B.gy = (fl + fr + rl + rr) / 4;
      if (B.grass && B.player && Math.hypot(B.vx, B.vz) > 3) { B.pv += (Math.random() - 0.5) * dt * 3; B.rv += (Math.random() - 0.5) * dt * 3; }
    }
    if (!B.tk) { B.pv += ((tp + gp - B.pitch) * 90 - B.pv * 11) * dt; B.rv += ((tr + gr - B.roll) * 80 - B.rv * 10) * dt; }
    B.pitch += B.pv * dt; B.roll += B.rv * dt;
    // Hindernis für den Verkehr
    OBSTACLES.push({ x: B.x, z: B.z, y: B.y, r: 2.2, v: Math.hypot(B.vx, B.vz) * 0.5 });
    // Rauch aus dem Motor bei Frontschaden
    if (B.dmg[0] > 0.45 && (B.x - cp.x) ** 2 + (B.z - cp.z) ** 2 < 40000 && !B.sunk) {
      const k = B.dmg[0] > 0.8 ? 'black' : 'smoke';
      if (Math.random() < dt * (B.dmg[0] > 0.8 ? 14 : 6)) fxEmit(k, B.x + fx * 1.9, B.y + 1.3, B.z + fz * 1.9, B.vx * 0.6, 0.8, B.vz * 0.6, 1, 0.3);
      if (B.dmg[0] > 0.9 && Math.random() < dt * 6) fxEmit('ember', B.x + fx * 2.1, B.y + 1.1, B.z + fz * 2.1, 0, 1.2, 0, 1, 0.4);
    }
    // ruhig liegende Unfallwagen kommen später in den Verkehr zurück
    const sp = Math.hypot(B.vx, B.vz);
    B.still = sp < 0.3 ? B.still + dt : 0;
    if (B.traffic && B.still > 18 && !B.tk) {
      const d2 = (B.x - cp.x) ** 2 + (B.z - cp.z) ** 2;
      if (d2 > 140 * 140 || B.still > 60) respawnTraffic(B);
    }
    if (B.parked && B.still > 1.5 && !B.air) { BODIES.delete(B); B.parked.dyn = null; }
  }
  // freie Wagen untereinander
  const list = [...BODIES];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const A = list[i], O = list[j]; if (A.sunk || O.sunk || Math.abs(A.y - O.y) > 2) continue;
    if ((A.x - O.x) ** 2 + (A.z - O.z) ** 2 < 36) collidePair(A, O);
  }
  syncBodies();
}
export function respawnTraffic(B) {
  const car = B.traffic, cp = camera.position;
  BODIES.delete(B); car.dyn = null; car.dmg = null;
  let L = null;
  for (let k = 0; k < 40 && !L; k++) { const c = TRF.lanes[Math.floor(Math.random() * TRF.lanes.length)]; if (c.len > 30 && (c.pts[0][0] - cp.x) ** 2 + (c.pts[0][1] - cp.z) ** 2 > 250 * 250) L = c; }
  L ||= TRF.lanes[0];
  placeTrafficCar(car, L, 2); car.v = 4;
  const q = polyAt(L.pts, L.cum, car.s); car.wx = q[0]; car.wz = q[1]; car.yaw = Math.atan2(-q[3], q[2]);
}
// Körper in die Darstellung übertragen
export function syncBodies() {
  for (const B of BODIES) {
    if (B.traffic) { const c = B.traffic; c.wx = B.x; c.wz = B.z; c.wy = B.y; c.yaw = B.h; c.v = 0; }
    else if (B.parked) {
      const c = B.parked;
      _q.setFromEuler(_ce.set(B.roll, B.h, B.pitch, 'YXZ')); c.m.compose(_p.set(B.x, B.y + 0.22, B.z), _q, _s.setScalar(1));
      c.x = B.x; c.z = B.z; shared.parkedTimer = 0;
    }
  }
}
// Spielerwagen zeichnen: Karosserie mit Federung, Räder mit Lenkung und Drehung, Lichter, Schaden
export const _wq = new T.Quaternion(), _wq2 = new T.Quaternion(), _wv = new T.Vector3(), _wm = new T.Matrix4(), _wy = new T.Vector3(0, 1, 0), _wz = new T.Vector3(0, 0, 1);
export function drawPlayerCar(dt) {
  const B = DRIVE.body; if (!B || !DRIVE.mesh) return;
  const D = DRIVE;
  D.x = B.x; D.z = B.z; D.y = B.y; D.h = B.h; D.v = D.on ? (D.u || 0) : 0;
  if (D.on) player.p.set(B.x, Math.max(B.y, WATER_Y + 0.5), B.z);
  const by = (B.gy !== undefined && !B.air ? B.gy : B.y);
  _q.setFromEuler(_ce.set(B.roll, B.h, B.pitch, 'YXZ'));
  _p.set(B.x, by + 0.22 + Math.min(0.05, Math.abs(B.pv) * 0.02), B.z);
  const BM = D.model ? D.mMesh : D.mesh, WM = D.model ? D.mWheels : D.wheels, MD = CARM.dim;
  BM.setMatrixAt(0, _m.compose(_p, _q, _s.setScalar(1))); BM.instanceMatrix.needsUpdate = true;
  if (!D.model) { const da = D.mesh.geometry.attributes.aDmg; da.setXYZW(0, B.dmg[0], B.dmg[1], B.dmg[2], 1 - B.dmg[3]); da.needsUpdate = true; }
  // Radlage: eigene Limousine (Achsen ±1,55, Spur 0,86, Halbmesser 0,44) oder Pierce Arrow (aus dem Modell)
  const ax = D.model ? [MD.front, MD.rear] : [1.55, -1.55], tr = D.model ? MD.track : 0.86, wr = D.model ? MD.r : 0.44;
  // Räder: Drehung aus der Geschwindigkeit, durchdrehen und blockieren sichtbar
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), u = B.vx * fx + B.vz * fz;
  const spinV = D.on && D.spinning ? Math.sign(D.revMode ? -1 : 1) * 30 : (D.lock || (D.inp && D.inp.hb && D.on)) ? 0 : u / (D.model ? wr : VP.rw);
  D.wheelA = (D.wheelA + spinV * dt) % (Math.PI * 2);
  const frontLock = D.lock ? 0 : 1;
  let k = 0;
  for (const sx of ax) for (const sz of [1, -1]) {
    const steer = sx > 0 ? D.delta : 0, ang = sx > 0 && !frontLock ? 0 : D.wheelA;
    _wq.setFromAxisAngle(_wy, B.h + steer); _wq2.setFromAxisAngle(_wz, -ang);
    if (sz < 0) _wq2.premultiply(new T.Quaternion().setFromAxisAngle(_wy, Math.PI));
    _wq.multiply(_wq2);
    _wv.set(sx, wr, sz * tr).applyQuaternion(_q);
    _p.set(B.x + _wv.x, by + 0.22 + _wv.y, B.z + _wv.z);
    // Räder bleiben am Boden, die Karosserie federt darüber
    _p.y = Math.max(by + wr, _p.y - 0.05);
    WM.setMatrixAt(k++, _wm.compose(_p, _wq, _s.setScalar(1)));
  }
  WM.instanceMatrix.needsUpdate = true;
  // Scheinwerfer und Rücklichter (Bremslicht heller); kaputte Lampen bleiben dunkel
  const pos = D.lights.geometry.attributes.position.array, sx2 = -fz, sz2 = fx;
  const LP = D.model ? [MD.lamp[0] + 0.1, MD.lamp[1] + 0.22, MD.lamp[2], -MD.tail[0], MD.tail[1] + 0.22, MD.tail[2]] : [2.55, 1.34, 0.62, 2.47, 1.17, 0.7], y = by + LP[1];
  const hl = [B.dmg[0] < 0.55, B.dmg[0] < 0.8], brake = D.on && D.inp && (D.revMode ? D.inp.up : D.inp.dn) > 0.1;
  pos.set([B.x + fx * LP[0] + sx2 * LP[2], hl[0] ? y : -60, B.z + fz * LP[0] + sz2 * LP[2], B.x + fx * LP[0] - sx2 * LP[2], hl[1] ? y : -60, B.z + fz * LP[0] - sz2 * LP[2],
    B.x - fx * LP[3] + sx2 * LP[5], by + LP[4], B.z - fz * LP[3] + sz2 * LP[5], B.x - fx * LP[3] - sx2 * LP[5], by + LP[4], B.z - fz * LP[3] - sz2 * LP[5]]);
  D.lights.geometry.attributes.position.needsUpdate = true;
  const sa = D.lights.geometry.attributes.size || D.lights.geometry.attributes.aSize;
  if (sa) { sa.array[2] = sa.array[3] = brake ? 1.0 : 0.55; sa.needsUpdate = true; }
  // Reifenspuren und Qualm, wenn die Reifen rutschen
  if (D.on && !B.air && !B.sunk) {
    const lx = -Math.sin(B.h), lz = -Math.cos(B.h), slip = D.slip || 0;
    const wp = [[ax[1], tr], [ax[1], -tr], [ax[0], tr], [ax[0], -tr]].map(([a, l]) => [B.x + fx * a + lx * l, B.z + fz * a + lz * l]);
    if (slip > 0.22 && Math.hypot(B.vx, B.vz) > 2 && D.lastW) {
      const n = D.lock ? 4 : 2;
      for (let i = 0; i < n; i++) skidMark(D.lastW[i][0], D.lastW[i][1], wp[i][0], wp[i][1], by, 0.2);
      if (!B.grass && Math.random() < dt * 30 * Math.min(1, slip)) { const w = wp[Math.random() < 0.5 ? 0 : 1]; fxEmit('tire', w[0], by + 0.3, w[1], B.vx * 0.15, 0.4, B.vz * 0.15, 1, 0.6); }
      if (B.grass && Math.random() < dt * 25) { const w = wp[Math.floor(Math.random() * 2)]; fxEmit('dust', w[0], by + 0.3, w[1], B.vx * 0.2, 0.8, B.vz * 0.2, 1, 0.6); }
    }
    D.lastW = wp;
  } else D.lastW = null;
  D.shake = Math.max(0, D.shake - dt * 1.8);
}
export function driveCamera() {
  const B = DRIVE.body;
  if (!DRIVE.fov0) DRIVE.fov0 = camera.fov;
  const sp = B ? Math.hypot(B.vx, B.vz) : 0;
  // Kamera folgt dem Wagen mit etwas Nachlauf; bei Tempo weiter weg und weiterer Blickwinkel
  if ((DRIVE.lookT -= 1 / 60) <= 0 && B) {
    const u = DRIVE.u || 0;
    // Blickrichtung zwischen Fahrzeugnase und Fahrtrichtung (zeigt das Driften)
    const mvH = sp > 4 ? Math.atan2(-B.vz, B.vx) : B.h;
    let dh = mvH - B.h; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    let want = B.h + dh * 0.45 - Math.PI / 2 + (u < -1 ? Math.PI : 0), cur = player.yaw;
    while (want - cur > Math.PI) want -= Math.PI * 2; while (want - cur < -Math.PI) want += Math.PI * 2;
    player.yaw = cur + (want - cur) * Math.min(1, (1 / 60) * 3.2);
    player.pitch += (-0.15 - player.pitch) * Math.min(1, (1 / 60) * 1.5);
  }
  const yaw = player.yaw, pitch = Math.max(-0.7, Math.min(0.35, player.pitch)), back = 7.0 + sp * 0.07;
  const fx = -Math.sin(yaw) * Math.cos(pitch), fz = -Math.cos(yaw) * Math.cos(pitch), fy = Math.sin(pitch);
  const tx = DRIVE.x - fx * back, ty = DRIVE.y + 2.3 - fy * back, tz = DRIVE.z - fz * back;
  if (!DRIVE.camP) DRIVE.camP = new T.Vector3(tx, ty, tz);
  DRIVE.camP.lerp(_wv.set(tx, ty, tz), 0.35);
  camera.position.copy(DRIVE.camP);
  camera.position.y = Math.max(camera.position.y, DRIVE.y + 0.8, WATER_Y + 0.6);
  const sh = DRIVE.shake * DRIVE.shake * 0.35;
  camera.rotation.set(pitch + (Math.random() - 0.5) * sh * 0.3, yaw + (Math.random() - 0.5) * sh * 0.3, (Math.random() - 0.5) * sh * 0.2);
  const fov = DRIVE.fov0 + Math.min(14, sp * 0.3);
  if (Math.abs(camera.fov - fov) > 0.15) { camera.fov += (fov - camera.fov) * 0.1; camera.updateProjectionMatrix(); }
}

/* ---------- Klang: Reihensechszylinder, Reifenquietschen, Blech ---------- */
export function initCarAudio() {
  if (DRIVE.au) { audioCtx(); return; }
  try {
    const ctx = audioCtx(); if (!ctx) return;   // V38: gemeinsamer Context (src/audio.js)
    const out = ctx.createGain(); out.gain.value = 0.55; out.connect(audioBus('sfx'));
    const eg = ctx.createGain(); eg.gain.value = 0; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 2.5;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square'; o3.type = 'triangle';
    const g2 = ctx.createGain(); g2.gain.value = 0.35; const g3 = ctx.createGain(); g3.gain.value = 0.5;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp); lp.connect(eg); eg.connect(out);
    // Brummen des Auspuffs: Rauschen, im Takt der Zündungen moduliert
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1900; nf.Q.value = 3; const sg = ctx.createGain(); sg.gain.value = 0;
    ns.connect(nf); nf.connect(sg); sg.connect(out);
    const ns2 = ctx.createBufferSource(); ns2.buffer = nb; ns2.loop = true; const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 400; const rg = ctx.createGain(); rg.gain.value = 0;
    ns2.connect(rf); rf.connect(rg); rg.connect(out);
    o1.start(); o2.start(); o3.start(); ns.start(); ns2.start(0, 0.7);
    DRIVE.au = { ctx, out, eg, lp, o1, o2, o3, sg, nf, rg, nb };
  } catch (e) { DRIVE.au = null; }
}
export function updateCarAudio() {
  const A = DRIVE.au; if (!A) return;
  const boat = typeof BOAT !== 'undefined' && BOAT.on;
  const t = A.ctx.currentTime, on = (DRIVE.on || boat) && !paused && !(DRIVE.on && DRIVE.body && DRIVE.body.sunk) && !(DRIVE.on && DRIVE.stalled);
  const thr = boat ? Math.abs(BOAT.thr) : DRIVE.inp ? Math.max(DRIVE.revMode ? DRIVE.inp.dn : DRIVE.inp.up, 0) : 0;
  // im Boot: tiefer Einbaumotor, dessen Drehzahl mit dem Gashebel steigt
  const f = boat ? 34 + thr * 85 + Math.abs(BOAT.u) * 2.5 : Math.max(30, DRIVE.rpm / 60 * 3);
  A.o1.frequency.setTargetAtTime(f, t, 0.03); A.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03); A.o3.frequency.setTargetAtTime(f * 1.5, t, 0.03);
  A.lp.frequency.setTargetAtTime(260 + thr * 1300 + DRIVE.rpm * 0.12, t, 0.05);
  A.eg.gain.setTargetAtTime(on ? 0.05 + thr * 0.07 : 0, t, 0.08);
  const sl = on && !boat && DRIVE.body && !DRIVE.body.grass ? Math.max(0, Math.min(1, ((DRIVE.slip || 0) - 0.25) * 1.6)) * Math.min(1, Math.hypot(DRIVE.body.vx, DRIVE.body.vz) / 6) : 0;
  A.sg.gain.setTargetAtTime(sl * 0.16, t, 0.05); A.nf.frequency.setTargetAtTime(1500 + sl * 900, t, 0.1);
  const sp = boat ? Math.abs(BOAT.u) * 2.5 : DRIVE.body ? Math.hypot(DRIVE.body.vx, DRIVE.body.vz) : 0;
  A.rg.gain.setTargetAtTime(on ? Math.min(0.12, sp * 0.004) * (DRIVE.body && DRIVE.body.grass ? 2 : 1) : 0, t, 0.1);
}
export function carCrashSound(k, scrape, water) {
  const A = DRIVE.au; if (!A || paused) return;
  const ctx = A.ctx, t = ctx.currentTime;
  if (A.lastCrash && t - A.lastCrash < 0.12 && !water) return; A.lastCrash = t;
  const s = ctx.createBufferSource(); s.buffer = A.nb; const f = ctx.createBiquadFilter(), g = ctx.createGain();
  f.type = water ? 'lowpass' : 'bandpass'; f.frequency.value = water ? 700 : 900 + Math.random() * 1500; f.Q.value = 0.7;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 + k * 0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + (water ? 1.4 : 0.25 + k * 0.5));
  s.connect(f); f.connect(g); g.connect(A.out); s.start(t, Math.random()); s.stop(t + 1.6);
  // dumpfer Schlag und blechernes Klirren
  if (k > 0.15) {
    const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    og.gain.setValueAtTime(0.4 * k, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.4); o.connect(og); og.connect(A.out); o.start(t); o.stop(t + 0.45);
    for (let i = 0; i < 3; i++) { const m = ctx.createOscillator(), mg = ctx.createGain(); m.type = 'square'; m.frequency.value = 600 + Math.random() * 2400; mg.gain.setValueAtTime(0.03 * k, t + i * 0.03); mg.gain.exponentialRampToValueAtTime(0.0003, t + 0.2 + i * 0.05); m.connect(mg); mg.connect(A.out); m.start(t + i * 0.03); m.stop(t + 0.35); }
  }
}
// pro Bild: Physik aller freien Wagen, Spielerwagen zeichnen, Partikel, Klang
export function updateVehicleWorld(dt) {
  if (!paused) { updateVehicles(dt); drawPlayerCar(dt); updateFX(dt); updateLeaves(dt); }
  updateCarAudio(); updateWindAudio();
}
