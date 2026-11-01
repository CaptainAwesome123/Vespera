import { shared, T, scene, camera, pick, R } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { setAct, carGeoHi, parked } from './serpentine.js';
import { cars } from './airships.js';
import { _q, _up, _p, _m, _s } from './traffic.js';
import { DINE, _dv, _dw, openMenu, freeSeatNear, sitDown, seatStandPoint, walkGait } from './venues.js';
import { driveExit, driveEnter } from './driving.js';
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
    V.flowT = 14 + Math.random() * 18;
    const seated = V.peds.filter(p => p.seat && !p.g && p.a), out = V.peds.filter(p => p.g === 'gone');
    if (out.length && Math.random() < 0.6) {
      const free = V.seats.filter(s => !s.taken);
      if (free.length) {
        const pd = pick(out), s = pick(free);
        s.taken = pd; pd.seat = s; pd.g = 'in'; pd.x = V.x; pd.z = V.z1 + 3.5; pd.y = V.F; setSit(pd, false);
        pd.path = exitPath(V, s).reverse(); pd.path.shift(); pd.path.push([s.x, s.z]);
      }
    } else if (seated.length) {
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
export const CARSCENE = { peds: [], cars: [], t: 4 };
export function carScenePeds() {
  for (let k = 0; k < 6; k++) { const pd = { st: 6, x: 0, y: 0.22, z: 0, yaw: 0, sc: 0.94 + R() * 0.12, v: 0, act: 1.2, kind: pick(['coat', 'suit', 'lady', 'dress', 'coat', 'tux', 'gown', 'chauffeur']), carActor: true }; CARSCENE.peds.push(pd); }
  return CARSCENE.peds;
}
export function carActor() {
  let c = CARSCENE.cars.find(c => !c.busy);
  if (!c && CARSCENE.cars.length < 3) { const im = new T.InstancedMesh(carGeoHi(), MAT.carPaint, 1); im.frustumCulled = false; im.visible = false; scene.add(im); c = { im }; CARSCENE.cars.push(c); }
  return c;
}
export function placeActor(c, x, y, z, h) { _q.setFromAxisAngle(_up, h); _p.set(x, y, z); c.im.setMatrixAt(0, _m.compose(_p, _q, _s.setScalar(1))); c.im.instanceMatrix.needsUpdate = true; }
export function startCarScene() {
  const cp = camera.position, ped = CARSCENE.peds.find(p => p.st === 6 && p.a && !p.busy), car = carActor();
  if (!ped || !car || cp.y > 40) return;
  const cand = parked.filter(c => !c.hidden && !c.scene && !c.model && c.ox !== undefined && (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 < 70 * 70 && (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 12 * 12);
  if (!cand.length) return;
  const pc = pick(cand), e = pc.m.elements, h = Math.atan2(e[8], e[0]), fx = Math.cos(h), fz = -Math.sin(h);
  // Fahrertür auf der Straßenseite oder zum Gehweg, je nachdem wie der Wagen steht
  const lx = -Math.sin(h), lz = -Math.cos(h), side = lx * pc.ox + lz * pc.oz > 0 ? 1 : -1;
  const S = { pc, ped, car, h, fx, fz, door: [pc.x + lx * side * 1.15 + fx * 0.3, pc.z + lz * side * 1.15 + fz * 0.3], walk: [pc.x - pc.ox * 4.2 + fx * (Math.random() * 10 - 5), pc.z - pc.oz * 4.2 + fz * (Math.random() * 10 - 5)], t: 0 };
  car.busy = S; pc.scene = S; ped.busy = true;
  car.im.setColorAt(0, new T.Color(...pc.c)); car.im.instanceColor.needsUpdate = true;
  ped.st = 4; ped.y = 0.22;
  if (Math.random() < 0.5) {
    // Abfahrt: zum Wagen gehen, einsteigen, losfahren
    S.mode = 'leave'; ped.x = S.walk[0]; ped.z = S.walk[1]; ped.path = [[S.door[0] - lx * side * 0.6, S.door[1] - lz * side * 0.6], S.door];
  } else {
    // Ankunft: der Wagen rollt heran und parkt ein, dann steigt jemand aus
    S.mode = 'arrive'; pc.hidden = true; shared.parkedTimer = 0; ped.st = 6; ped.a.on = false; S.d = 70;
    car.im.visible = true;
  }
}
export function updateCarScenes(dt) {
  if (!playing || DRIVE.on) return;
  if ((CARSCENE.t -= dt) <= 0) { CARSCENE.t = 9 + Math.random() * 10; startCarScene(); }
  for (const car of CARSCENE.cars) {
    const S = car.busy; if (!S) continue;
    const { pc, ped, h, fx, fz } = S, ox = pc.ox, oz = pc.oz;
    S.t += dt;
    if (S.mode === 'leave') {
      if (ped.path.length) { walkGait(ped, true); stepPath(ped, dt, 1.3); if (!ped.path.length) { S.t = 0; walkGait(ped, false); ped.act = 1.1; setAct(ped, 1.1); ped.yaw = Math.atan2(pc.x - ped.x, pc.z - ped.z); } continue; }
      if (S.t < 1.1) {
        // bücken und in den Wagen gleiten
        const k = S.t / 1.1; ped.x += (pc.x - ped.x) * dt * 1.2; ped.z += (pc.z - ped.z) * dt * 1.2; ped.y = 0.22 - 0.5 * k * k; ped.tilt = 0.5 * Math.sin(Math.min(1, k * 1.4) * Math.PI / 2);
      } else if (ped.st !== 6) { ped.st = 6; ped.a.on = false; ped.tilt = 0; pc.hidden = true; shared.parkedTimer = 0; car.im.visible = true; S.d = 0; S.v = 0; }
      if (S.t > 2.2) {
        // ausparken: anfahren, schräg auf die Fahrbahn, dann geradeaus davon
        S.v = Math.min(12, (S.v || 0) + 3.2 * dt); S.d += S.v * dt;
        const lat = 2.6 * Math.min(1, S.d / 14) ** 2 * (3 - 2 * Math.min(1, S.d / 14)) / 1;
        const dl = S.d < 14 ? 2.6 * 6 * (S.d / 14) * (1 - S.d / 14) / 14 : 0;
        placeActor(car, pc.x + fx * S.d + ox * lat, 0.22, pc.z + fz * S.d + oz * lat, h + Math.atan2(dl * (fx * oz - fz * ox), 1));
        if (S.d > 160) endCarScene(car, 50);
      } else placeActor(car, pc.x, 0.22, pc.z, h);
    } else {
      if (S.d > 0) {
        // einparken: abbremsen, von der Fahrbahn an den Rand
        S.d = Math.max(0, S.d - Math.max(1.2, Math.min(12, S.d * 0.6)) * dt);
        const u = Math.min(1, S.d / 14), lat = 2.6 * u * u * (3 - 2 * u), dl = S.d < 14 ? 2.6 * 6 * u * (1 - u) / 14 : 0;
        placeActor(car, pc.x - fx * S.d + ox * lat, 0.22, pc.z - fz * S.d + oz * lat, h - Math.atan2(dl * (fx * oz - fz * ox), 1));
        if (S.d === 0) S.t = 0;
        continue;
      }
      if (ped.st === 6 && S.t > 0.8) {
        ped.st = 4; ped.x = pc.x + (S.door[0] - pc.x) * 0.55; ped.z = pc.z + (S.door[1] - pc.z) * 0.55; ped.y = -0.3; ped.yaw = Math.atan2(S.door[0] - pc.x, S.door[1] - pc.z); ped.tilt = 0.5; S.t2 = 0;
        walkGait(ped, false); ped.act = 1.1; setAct(ped, 1.1);
      }
      if (ped.st === 4) {
        S.t2 += dt;
        if (S.t2 < 1.2) { const k = S.t2 / 1.2; ped.x += (S.door[0] - ped.x) * dt * 2; ped.z += (S.door[1] - ped.z) * dt * 2; ped.y = -0.3 + 0.52 * Math.min(1, k * 1.2); ped.tilt = 0.5 * (1 - k); }
        else {
          if (!ped.path) { ped.tilt = 0; ped.y = 0.22; ped.path = [[S.door[0] - pc.ox * 1.5, S.door[1] - pc.oz * 1.5], S.walk, [S.walk[0] - pc.ox * 2 + fx * 25, S.walk[1] - pc.oz * 2 + fz * 25]]; }
          walkGait(ped, true);
          if (stepPath(ped, dt, 1.3)) { ped.path = null; endCarScene(car, 0); }
        }
      }
    }
  }
}
export function endCarScene(car, hideFor) {
  const S = car.busy; if (!S) return;
  const { pc, ped } = S;
  ped.st = 6; ped.a.on = false; ped.path = null; ped.tilt = 0; ped.busy = false;
  car.busy = null; car.im.visible = S.mode === 'leave' ? false : car.im.visible;
  if (S.mode === 'arrive') { pc.hidden = false; car.im.visible = false; shared.parkedTimer = 0; pc.scene = null; }
  else { pc.backT = hideFor; CARSCENE.gone = CARSCENE.gone || []; CARSCENE.gone.push(pc); }
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
  INTERACT.unshift({ test: () => DRIVE.on, label: 'Aussteigen', act: driveExit });
  INTERACT.push({
    test: p => {
      if (DRIVE.on) return false;
      if (DRIVE.mesh && (DRIVE.x - p.x) ** 2 + (DRIVE.z - p.z) ** 2 < 12) { DRIVE.pick = null; return true; }
      return !!(DRIVE.pick = nearestParked(p, 3.3));
    },
    label: 'Einsteigen und fahren', act: () => driveEnter(DRIVE.pick),
  });
}
