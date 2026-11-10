import { shared, T, scene, camera, pick, R } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { setAct, carGeoHi, parked } from './serpentine.js';
import { cars } from './airships.js';
import { _q, _up, _p, _m, _s, OBSTACLES } from './traffic.js';
import { glassFor, carDamageAttr } from './cars.js';
import { curbHeight } from './island.js';
import { doorSlot, hideDoors, setDoors, doorSound, boardIn, boardOut, carToWorld, BOARD } from './tueren.js';
import { DINE, _dv, _dw, openMenu, freeSeatNear, sitDown, seatStandPoint, walkGait } from './venues.js';
import { driveLeave, driveBoard } from './driving.js';
import { toast } from './boat.js';
import { INTERACT } from './music.js';
import { playing } from './input.js';

/* =====================================================================
   V16 · ESSEN AUS DER ICH-SICHT: die eigene Hand im Frackärmel greift mit der Gabel
   einen Bissen vom Teller und führt ihn zum Mund; beim Trinken hält sie das Glas
   ===================================================================== */
export const FPH = { g: null, fork: null, bite: null, glassHold: null };
export function fpHandBuild() {
  if (FPH.g) return;
  const g = new T.Group();
  const skin = stdMat({ color: 0xd8a07e, roughness: 0.55, envI: 0.25, emissive: 0x120806 });
  const tux = stdMat({ color: 0x101013, roughness: 0.75, envI: 0.2 }), shirt = stdMat({ color: 0xeeeae2, roughness: 0.6, envI: 0.3 });
  const silver = stdMat({ color: 0xd9dde2, metalness: 1, roughness: 0.22 }), gold = MAT.gold;
  const seg = (r0, r1, a, b, m, s = 10) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B); const c = new T.CylinderGeometry(r1, r0, L, s); c.translate(0, L / 2, 0); c.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize())); c.translate(A.x, A.y, A.z); const mm = new T.Mesh(c, m); g.add(mm); return mm; };
  // Ärmel und Manschette mit goldenem Knopf, Unterarm zur Kamera hin
  seg(0.05, 0.062, [0.05, -0.04, 0.08], [0.26, -0.2, 0.42], tux, 14);
  seg(0.046, 0.046, [0.035, -0.03, 0.055], [0.06, -0.05, 0.1], shirt, 14);
  { const b = new T.Mesh(new T.SphereGeometry(0.008, 8, 6), gold); b.position.set(0.075, -0.03, 0.075); g.add(b); }
  // Hand: Handrücken, vier gekrümmte Finger, Daumen
  { const p = new T.Mesh(new T.SphereGeometry(0.042, 14, 10), skin); p.scale.set(1.05, 0.55, 1.25); p.position.set(0.0, 0.0, 0.0); g.add(p); }
  for (let k = 0; k < 4; k++) {
    const x = -0.028 + k * 0.019, l = k === 3 ? 0.032 : 0.04;
    seg(0.0095, 0.009, [x, 0.0, -0.04], [x - 0.004, -0.012, -0.04 - l], skin, 7);
    seg(0.009, 0.008, [x - 0.004, -0.012, -0.04 - l], [x - 0.006, -0.04, -0.05 - l], skin, 7);
  }
  seg(0.011, 0.009, [-0.035, -0.005, 0.0], [-0.055, 0.005, -0.045], skin, 7);
  // Gabel mit Bissen
  const fork = new T.Group();
  { const h = new T.Mesh(new T.CylinderGeometry(0.0045, 0.006, 0.17, 6).rotateX(Math.PI / 2), silver); h.position.set(0, 0, -0.06); fork.add(h);
    for (let k = 0; k < 4; k++) { const t = new T.Mesh(new T.BoxGeometry(0.0025, 0.002, 0.04), silver); t.position.set(-0.008 + k * 0.0053, 0.004, -0.165); fork.add(t); }
    const bite = new T.Mesh(new T.SphereGeometry(0.016, 10, 8), stdMat({ color: 0x8a4a2a, roughness: 0.6, envI: 0.2 })); bite.scale.set(1.2, 0.8, 1); bite.position.set(0, 0.012, -0.17); fork.add(bite); FPH.bite = bite; }
  fork.position.set(-0.02, -0.012, -0.01); fork.rotation.x = 0.25; g.add(fork); FPH.fork = fork;
  g.visible = false; g.renderOrder = 5;
  g.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.userData.noRefl = true; } });
  scene.add(g); FPH.g = g;
}
export const _fa = new T.Vector3(), _fb = new T.Vector3(), _fo = new T.Vector3();
// Essen: t von 0 bis 1; base = Teller, tgt = Mund
export function fpEat(t, base) {
  fpHandBuild();
  const g = FPH.g, cam = camera;
  const off = _fo.set(0.3, -0.36, -0.32).applyQuaternion(cam.quaternion).add(cam.position);
  const mouth = _fb.set(0.015, -0.075, -0.3).applyQuaternion(cam.quaternion).add(cam.position);
  const plate = _fa.copy(base); plate.y += 0.05;
  const e = x => x * x * (3 - 2 * x);
  let p;
  if (t < 0.25) p = off.clone().lerp(plate, e(t / 0.25));
  else if (t < 0.36) p = plate.clone();
  else if (t < 0.68) p = plate.clone().lerp(mouth, e((t - 0.36) / 0.32));
  else if (t < 0.8) p = mouth.clone();
  else p = mouth.clone().lerp(off, e((t - 0.8) / 0.2));
  g.position.copy(p); g.quaternion.copy(cam.quaternion);
  // Gabel senkt sich am Teller, hebt sich zum Mund
  FPH.fork.rotation.x = t < 0.36 ? 0.25 - 0.5 * Math.sin(Math.min(1, Math.max(0, (t - 0.2) / 0.16)) * Math.PI) : 0.25 + 0.2 * Math.min(1, (t - 0.36) / 0.3);
  FPH.fork.visible = true;
  FPH.bite.visible = t > 0.3 && t < 0.74;
  g.visible = t < 0.999;
}
// Trinken: die Hand umfasst das Glas
export function fpHold(it, on) {
  fpHandBuild();
  const g = FPH.g;
  if (!on) { g.visible = false; return; }
  FPH.fork.visible = false;
  g.quaternion.copy(camera.quaternion);
  g.position.copy(_fa.set(0.04, 0.04, 0.0).applyQuaternion(camera.quaternion).add(it.getWorldPosition(_fb)));
  g.visible = true;
}

export function consume() { if (DINE.item && DINE.anim <= 0 && DINE.sips > 0) { DINE.animT = DINE.order && DINE.order[1] === 'food' ? 2.8 : 1.9; DINE.anim = DINE.animT; } }
export function updateDine(dt) {
  const it = DINE.item; if (!it) return;
  const s = DINE.seat, base = _dv.set(s.tx, s.ty, s.tz);
  if (DINE.anim > 0) {
    DINE.anim = Math.max(0, DINE.anim - dt);
    const t = 1 - DINE.anim / (DINE.animT || 1.6), k = Math.sin(Math.min(1, t) * Math.PI), drink = DINE.order[1] === 'drink';
    // Zielpunkt knapp unter der Kamera
    camera.getWorldDirection(_dw);
    const tgt = _dw.multiplyScalar(0.32).add(camera.position); tgt.y -= drink ? 0.1 : 0.16;
    if (drink) { it.position.lerpVectors(base, tgt, k); it.rotation.x = 0; it.rotation.z = -0.7 * Math.max(0, k - 0.6) / 0.4; fpHold(it, true); }
    else { it.position.copy(base); fpEat(t, base); }
    if (DINE.anim === 0) {
      DINE.sips--;
      const f = it.userData.fill, left = DINE.sips / (drink ? 5 : 6);
      if (f) { if (drink) f.scale.set(1, Math.max(0.02, left), 1); else { f.scale.setScalar(Math.max(0.01, 0.35 + 0.65 * left)); f.position.y = 0; } f.visible = DINE.sips > 0; }
      it.position.copy(base); it.rotation.z = 0; if (FPH.g) FPH.g.visible = false;
      if (DINE.sips <= 0) { toast(drink ? 'Ausgetrunken · E für eine neue Bestellung' : 'Aufgegessen · E für eine neue Bestellung'); DINE.order = null; DINE.done = it; DINE.item = null; setTimeout(() => { if (DINE.done) { DINE.done.removeFromParent(); DINE.done = null; } }, 6000); }
    }
  }
}
export function venueInteractions() {
  INTERACT.unshift(
    { test: () => !!(DINE.seat && DINE.item && DINE.order && DINE.order[1] === 'drink' && DINE.anim <= 0), label: 'Trinken', act: consume },
    { test: () => !!(DINE.seat && DINE.item && DINE.order && DINE.order[1] === 'food' && DINE.anim <= 0), label: 'Essen', act: consume },
    { test: () => !!(DINE.seat && !DINE.order && !DINE.menuOpen), label: 'Bestellen', act: openMenu },
    { test: () => !!(DINE.seat && DINE.order && !DINE.item), label: 'Der Kellner kommt gleich …', act: () => {} },
  );
  INTERACT.push({ test: p => !DINE.seat && !DRIVE.on && !!(DINE.pick = freeSeatNear(p)), label: 'Hinsetzen', act: () => sitDown(...DINE.pick) });
}

/* ---------- Kommen und Gehen: Gäste betreten und verlassen die Lokale, Leute steigen in Autos ein und aus ---------- */
export function setSit(pd, on) { pd.sit = on; pd.yo = on ? (pd.fem ? 0.8 : 0.87) * pd.sc : 0; }
// Weg vom Platz zur Tür: über den Gang zwischen den Tischreihen und an der Wand entlang
export function exitPath(V, s) {
  const sp = seatStandPoint(s), lane = s.tz + (s.tz < (V.z0 + V.z1) / 2 ? 1.6 : -1.6), cx = V.x0 + 4.6, wz = V.z1 - 1.0;
  return s.stool ? [[sp.x, sp.z], [cx, s.z], [cx, wz], [V.x, wz], [V.x, V.z1 + 3.5]] : [[sp.x, sp.z], [sp.x, lane], [cx, lane], [cx, wz], [V.x, wz], [V.x, V.z1 + 3.5]];
}
export function stepPath(pd, dt, sp = 1.25) {
  const [px, pz] = pd.path[0], dx = px - pd.x, dz = pz - pd.z, d = Math.hypot(dx, dz), st = sp * dt;
  if (d <= st) { pd.x = px; pd.z = pz; pd.path.shift(); }
  else { pd.x += dx / d * st; pd.z += dz / d * st; pd.yaw = Math.atan2(dx, dz); }
  return !pd.path.length;
}
export function updateGuestFlow(V, dt) {
  // ab und zu bricht jemand auf, kurz darauf kommt ein neuer Gast herein
  if ((V.flowT = (V.flowT ?? 6 + Math.random() * 8) - dt) <= 0) {
    const seated = V.peds.filter(p => p.seat && !p.g && p.a), out = V.peds.filter(p => p.g === 'gone');
    // V76: Zielbelegung nach der Uhrzeit (alltag.js): ist das Lokal zu leer oder zu voll, wechseln die Gäste schneller
    const dir = V.occN == null ? 0 : Math.sign(V.occN - seated.length - V.peds.filter(p => p.g === 'in' || p.g === 'sitdown').length);
    V.flowT = dir ? 2.5 + Math.random() * 3.5 : 14 + Math.random() * 18;
    if (out.length && (dir > 0 || (!dir && Math.random() < 0.6))) {
      const free = V.seats.filter(s => !s.taken);
      if (free.length) {
        const pd = pick(out), s = pick(free);
        s.taken = pd; pd.seat = s; pd.g = 'in'; pd.x = V.x; pd.z = V.z1 + 3.5; pd.y = V.F; setSit(pd, false);
        pd.path = exitPath(V, s).reverse(); pd.path.shift(); pd.path.push([s.x, s.z]);
      }
    } else if (seated.length && dir <= 0) {
      const pd = pick(seated);
      pd.g = 'out'; pd.seat.taken = null; pd.path = exitPath(V, pd.seat); pd.seat = null; setSit(pd, false); pd.y = V.F;
      if (pd.dish) pd.dish.visible = false;
    }
  }
  for (const pd of V.peds) {
    if (!pd.g || pd.g === 'gone' || !pd.a) continue;
    if (pd.g === 'sitdown') {
      // hinsetzen: kurz am Stuhl stehen, dann sinkt man auf den Sitz
      if ((pd.gt -= dt) <= 0) { const s = pd.seat; pd.g = null; pd.y = s.y; setSit(pd, true); pd.yaw = s.yaw; pd.act = 7.8; walkGait(pd, false); setAct(pd, 7.8); pd.dineT = 9 + Math.random() * 6; pd.dishT = 12 + Math.random() * 10; }
      continue;
    }
    walkGait(pd, true);
    if (stepPath(pd, dt, 1.15)) {
      if (pd.g === 'out') { pd.g = 'gone'; pd.st = 6; pd.a.on = false; }
      else { pd.g = 'sitdown'; pd.gt = 0.6; pd.yaw = pd.seat.yaw; walkGait(pd, false); pd.act = 1.2; setAct(pd, 1.2); }
    }
    if (pd.g === 'in' && pd.st === 6) pd.st = 4;
  }
  // Teller und Gläser kommen nach einer Weile an den neuen Platz
  for (const pd of V.peds) if (pd.dishT > 0 && (pd.dishT -= dt) <= 0 && pd.seat && pd.dish) { pd.dish.position.set(pd.seat.tx, pd.seat.ty, pd.seat.tz); pd.dish.rotation.y = pd.seat.yaw; pd.dish.visible = true; }
}

// Einsteigen und Aussteigen an geparkten Wagen in der Nähe der Kamera
// V74: mit beweglichen Türen und eigenem Ablauf (tueren.js): hingehen, Tür auf, hinsetzen, Beine hinein, Tür zu;
// Fahrer (rechts) und manchmal ein Beifahrer (links) sitzen sichtbar im Wagen, auch beim Ausparken und Einparken
export const CARSCENE = { peds: [], cars: [], t: 4, geo: null };
export function carScenePeds() {
  for (let k = 0; k < 8; k++) { const pd = { st: 6, x: 0, y: 0.22, z: 0, yaw: 0, sc: 0.94 + R() * 0.12, v: 0, act: 1.2, kind: pick(['coat', 'suit', 'lady', 'dress', 'coat', 'tux', 'gown', 'chauffeur']), carActor: true }; CARSCENE.peds.push(pd); }
  return CARSCENE.peds;
}
export function carActor() {
  let c = CARSCENE.cars.find(c => !c.busy);
  if (!c && CARSCENE.cars.length < 4) {
    const geo = CARSCENE.geo || (CARSCENE.geo = carGeoHi({ driver: true, tub: true }));
    const im = new T.InstancedMesh(geo, MAT.carPaintCut, 1); im.frustumCulled = false; im.visible = false; scene.add(im); im.setColorAt(0, new T.Color(1, 1, 1));
    if (!geo.attributes.aDmg) carDamageAttr(im);
    const gl = glassFor(im, { doors: true }); gl.count = 1; gl.visible = false;
    c = { im, gl, slot: doorSlot(), dR: 0, dL: 0 }; CARSCENE.cars.push(c);
  }
  return c;
}
function actorShow(c, on) { c.im.visible = c.gl.visible = on; if (!on) hideDoors(c.slot); }
export function placeActor(c, x, y, z, h) {
  _q.setFromAxisAngle(_up, h); _p.set(x, y, z); c.im.setMatrixAt(0, _m.compose(_p, _q, _s.setScalar(1))); c.im.instanceMatrix.needsUpdate = true;
  c.X = x; c.Y = y; c.Z = z; c.H = h;
  setDoors(c.slot, _m, c.dR, c.dL, null);
}
const _w = [0, 0], _br = {};
const groundY = (x, z) => Math.max(0, curbHeight(x, z));
const lw = (S, lx, lz) => carToWorld(S.pc.x, S.pc.z, S.h, lx, lz, [0, 0]);
function stand(pd, a) { if (pd.sit) setSit(pd, false); if (pd.act !== a || pd.a.gait[2] !== 0) { pd.act = a; walkGait(pd, false); } }
function sitDownAct(pd, a) { if (!pd.sit) setSit(pd, true); if (pd.act !== a || pd.a.gait[2] !== 0) { pd.act = a; walkGait(pd, false); } }
// Weg vom Gehweg zur Tür (bei der Tür auf der Straßenseite hinten um den Wagen herum) und umgekehrt
function doorPath(S, R, from) {
  const c = Math.cos(S.h), sn = Math.sin(S.h), wz = (from[0] - S.pc.x) * sn + (from[1] - S.pc.z) * c, sw = wz >= 0 ? 1 : -1, s = R.s;
  const pts = [];
  if (sw !== s) { pts.push(lw(S, -3.6, sw * 1.9), lw(S, -3.6, s * 2.0)); }
  pts.push(lw(S, -1.7, s * 2.0), lw(S, BOARD.p0x, s * BOARD.p0z));
  return pts;
}
export function startCarScene() {
  const cp = camera.position, car = carActor();
  const free = CARSCENE.peds.filter(p => p.st === 6 && p.a && !p.busy && !p.rag);
  if (!free.length || !car || cp.y > 40) return;
  const cand = parked.filter(c => !c.hidden && !c.scene && !c.model && c.ox !== undefined && (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 < 70 * 70 && (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 12 * 12);
  if (!cand.length) return;
  const pc = pick(cand), e = pc.m.elements, h = Math.atan2(e[8], e[0]), fx = Math.cos(h), fz = -Math.sin(h);
  const drv = free.find(p => !p.fem) || free[0], pax = Math.random() < 0.35 ? free.find(p => p !== drv) : null;
  const S = { pc, car, h, fx, fz, y: e[13], walk: [pc.x - pc.ox * 4.2 + fx * (Math.random() * 10 - 5), pc.z - pc.oz * 4.2 + fz * (Math.random() * 10 - 5)], t: 0, d: 0, v: 0, riders: [] };
  for (const [ped, s, seatZ, role] of [[drv, 1, BOARD.seatZ, 'drv'], [pax, -1, -BOARD.seatZ, 'pax']]) if (ped) { ped.busy = true; S.riders.push({ ped, s, seatZ, role, st: '', t: 0 }); }
  car.busy = S; pc.scene = S; car.dR = car.dL = 0;
  car.im.setColorAt(0, new T.Color(...pc.c)); car.im.instanceColor.needsUpdate = true;
  setDoors(car.slot, _m.identity(), 0, 0, pc.c);
  pc.hidden = true; shared.parkedTimer = 0; actorShow(car, true);
  if (Math.random() < 0.5) {
    // Abfahrt: die Leute kommen vom Gehweg, steigen ein, dann parkt der Wagen aus
    S.mode = 'leave'; placeActor(car, pc.x, S.y, pc.z, h);
    S.riders.forEach((R, i) => {
      const ped = R.ped, w = [S.walk[0] + fx * i * 0.9, S.walk[1] + fz * i * 0.9];
      ped.st = 4; ped.x = w[0]; ped.z = w[1]; ped.y = groundY(w[0], w[1]); ped.tilt = 0; stand(ped, 1.2);
      ped.path = doorPath(S, R, w); R.st = 'walk';
    });
  } else {
    // Ankunft: der Wagen rollt heran und parkt ein, dann steigen sie aus
    S.mode = 'arrive'; S.d = 70;
    for (const R of S.riders) { R.st = 'seat'; R.ped.st = 4; R.ped.tilt = 0; }
  }
}
// eine Figur im Wagen: Lage aus dem Ablauf (tueren.js) und der Lage des Wagens
function riderPlace(S, R, r) {
  const c = S.car, ped = R.ped;
  carToWorld(c.X, c.Z, c.H, r.x, r.z, _w);
  ped.x = _w[0]; ped.z = _w[1]; ped.yaw = c.H + r.phi; ped.tilt = r.tilt;
  if (r.sit) { sitDownAct(ped, R.role === 'drv' && S.v > 0.3 ? 32.5 : 7.2); ped.y = c.Y + r.y; }
  else { stand(ped, 1.1); const gy = groundY(ped.x, ped.z); ped.y = gy + (c.Y + r.y - gy) * (1 - r.gk); }
  if (R.s > 0) c.dR = r.d; else c.dL = r.d;
  if (r.d > 0.05 && !R.opened) { R.opened = true; doorSound(true, ped.x, c.Y + 1, ped.z); }
  if (r.slam && !R.slammed) { R.slammed = true; doorSound(false, ped.x, c.Y + 1, ped.z); }
}
function riderSeat(S, R) { riderPlace(S, R, Object.assign(_br, { d: 0, x: BOARD.seatX, z: R.seatZ, phi: Math.PI / 2, sit: true, y: 1.1, gk: 0, tilt: 0, slam: false })); }
export function updateCarScenes(dt) {
  if (!playing) return;
  if (!DRIVE.on && (CARSCENE.t -= dt) <= 0) { CARSCENE.t = 5 + Math.random() * 7; startCarScene(); }   // V42: öfter (vorher 9–19 s); V74: laufende Szenen gehen auch beim Fahren weiter
  for (const car of CARSCENE.cars) {
    const S = car.busy; if (!S) continue;
    const { pc, h, fx, fz } = S, ox = pc.ox, oz = pc.oz;
    S.t += dt;
    // wer umgestoßen oder gepackt wird, ist aus der Szene heraus
    for (const R of S.riders) if (R.st !== 'gone' && (R.ped.rag || !R.ped.a)) { R.st = 'gone'; R.ped.busy = false; R.ped.path = null; if (R.s > 0) car.dR = 0; else car.dL = 0; }
    const live = S.riders.filter(R => R.st !== 'gone');
    if (S.mode === 'leave') {
      if (!S.go) {
        for (const R of live) {
          const ped = R.ped;
          if (R.st === 'walk') { walkGait(ped, true); ped.tilt = 0; if (stepPath(ped, dt, 1.3)) { R.st = 'in'; R.t = 0; } ped.y = groundY(ped.x, ped.z); }
          else if (R.st === 'in') { R.t += dt; const r = boardIn(R.t, R.s, R.seatZ, _br); riderPlace(S, R, r); if (r.done) R.st = 'seat'; }
          else riderSeat(S, R);
        }
        placeActor(car, pc.x, S.y, pc.z, h);
        if (!live.length) { endCarScene(car, 0); continue; }
        if (live.every(R => R.st === 'seat')) { S.go = true; S.t = 0; }
        continue;
      }
      // ausparken: anfahren, schräg auf die Fahrbahn, dann geradeaus davon
      if (S.t > 0.7) { S.v = Math.min(12, (S.v || 0) + 3.2 * dt); S.d += S.v * dt; }
      const lat = 2.6 * Math.min(1, S.d / 14) ** 2 * (3 - 2 * Math.min(1, S.d / 14));
      const dl = S.d < 14 ? 2.6 * 6 * (S.d / 14) * (1 - S.d / 14) / 14 : 0;
      placeActor(car, pc.x + fx * S.d + ox * lat, S.y, pc.z + fz * S.d + oz * lat, h + Math.atan2(dl * (fx * oz - fz * ox), 1));
      for (const R of live) riderSeat(S, R);
      if (S.d > 160) endCarScene(car, 50);
    } else {
      if (S.d > 0) {
        // einparken: abbremsen, von der Fahrbahn an den Rand
        S.d = Math.max(0, S.d - Math.max(1.2, Math.min(12, S.d * 0.6)) * dt); S.v = S.d > 0 ? 1 : 0;
        const u = Math.min(1, S.d / 14), lat = 2.6 * u * u * (3 - 2 * u), dl = S.d < 14 ? 2.6 * 6 * u * (1 - u) / 14 : 0;
        placeActor(car, pc.x - fx * S.d + ox * lat, S.y, pc.z - fz * S.d + oz * lat, h - Math.atan2(dl * (fx * oz - fz * ox), 1));
        for (const R of live) riderSeat(S, R);
        if (S.d === 0) S.t = 0;
        continue;
      }
      S.v = 0; placeActor(car, pc.x, S.y, pc.z, h);
      live.forEach((R, i) => {
        const ped = R.ped;
        if (R.st === 'seat') { riderSeat(S, R); if (S.t > 0.8 + i * 0.6) { R.st = 'out'; R.t = 0; } }
        else if (R.st === 'out') {
          R.t += dt; const r = boardOut(R.t, R.s, R.seatZ, _br); riderPlace(S, R, r);
          if (r.done) {
            R.st = 'off'; ped.tilt = 0;
            const c = Math.cos(h), sn = Math.sin(h), cs = (-ox * sn - oz * c) >= 0 ? 1 : -1;   // Gehwegseite im Wagenraum
            ped.path = []; if (cs !== R.s) ped.path.push(lw(S, -1.7, R.s * 2.0), lw(S, -3.6, R.s * 2.0), lw(S, -3.6, cs * 2.0));
            ped.path.push([S.walk[0] + fx * i * 0.9, S.walk[1] + fz * i * 0.9], [S.walk[0] - ox * 2 + fx * (25 + i), S.walk[1] - oz * 2 + fz * (25 + i)]);
          }
        } else if (R.st === 'off') { walkGait(ped, true); ped.y = groundY(ped.x, ped.z); if (stepPath(ped, dt, 1.3)) { R.st = 'gone'; ped.path = null; ped.st = 6; ped.a.on = false; ped.busy = false; } }
      });
      if (S.riders.every(R => R.st === 'gone')) endCarScene(car, 0);
    }
  }
}
export function endCarScene(car, hideFor) {
  const S = car.busy; if (!S) return;
  const { pc } = S;
  for (const R of S.riders) { const ped = R.ped; if (!ped.rag) { ped.st = 6; if (ped.a) ped.a.on = false; } ped.path = null; ped.tilt = 0; ped.busy = false; if (ped.sit) setSit(ped, false); }
  car.busy = null; car.dR = car.dL = 0; actorShow(car, false);
  if (S.mode === 'arrive' || !S.go) { pc.hidden = false; shared.parkedTimer = 0; pc.scene = null; }
  else { pc.backT = hideFor; CARSCENE.gone = CARSCENE.gone || []; CARSCENE.gone.push(pc); }
}
// V74: fahrende Szenenwagen sind Hindernisse für den Verkehr (kein Auffahren beim Ausparken)
export function carSceneObstacles() {
  for (const car of CARSCENE.cars) { const S = car.busy; if (S && car.X !== undefined && (S.go || S.d > 0)) OBSTACLES.push({ x: car.X, z: car.Z, y: car.Y - 0.22, r: 2.2, v: S.v || 0 }); }
}
// weggefahrene Wagen kommen später wieder (wenn man nicht hinsieht)
export function updateCarReturns(dt) {
  const L = CARSCENE.gone; if (!L) return;
  for (let i = L.length - 1; i >= 0; i--) { const pc = L[i]; if ((pc.backT -= dt) > 0) continue; const cp = camera.position; if ((pc.x - cp.x) ** 2 + (pc.z - cp.z) ** 2 < 120 * 120) continue; pc.hidden = false; pc.scene = null; shared.parkedTimer = 0; L.splice(i, 1); }
}

/* ---------- Selbst fahren: an einem geparkten Wagen E drücken, dann von hinten (Verfolgerkamera) durch die Stadt ---------- */
export const DRIVE = { on: false, mesh: null, src: null, x: 0, y: 0, z: 0, h: 0, v: 0, steer: 0, lookT: 0, col: null };
export function nearestParked(p, r) {
  let best = null, bd = r * r;
  for (const c of parked) { if (c.hidden || Math.abs(c.m.elements[13] - 0.22 - p.y) > 1.5) continue; const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (d < bd) { bd = d; best = c; } }
  return best;
}
export function driveInteractions() {
  INTERACT.unshift({ test: () => DRIVE.on && !DRIVE.anim, label: 'Aussteigen', act: driveLeave });   // V74: mit Ablauf (Tür auf, aussteigen, Tür zu)
  INTERACT.push({
    test: p => {
      if (DRIVE.on || DRIVE.anim) return false;
      if (DRIVE.mesh && (DRIVE.x - p.x) ** 2 + (DRIVE.z - p.z) ** 2 < 12) { DRIVE.pick = null; return true; }
      return !!(DRIVE.pick = nearestParked(p, 3.3));
    },
    label: 'Einsteigen und fahren', act: () => driveBoard(DRIVE.pick),
  });
}
