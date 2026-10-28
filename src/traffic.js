'use strict';
/* =====================================================================
   V16 · VERKEHR: Autos fahren auf dem Straßennetz, biegen an Kreuzungen ab,
   halten an Ampeln, folgen dem Vordermann (IDM) und weichen dem Spielerwagen
   ===================================================================== */
const TRF = { lanes: [], cars: [], turns: new Map(), lights: [], t: 0 };
function lanePts(e, dir) {
  const P = dir > 0 ? e.pts : e.pts.slice().reverse();
  return offsetPoly(resample(P, 4), e.off);
}
function cumLen(P) { const c = [0]; for (let k = 1; k < P.length; k++) c.push(c[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])); return c; }
function trimPoly(P, s0, s1) {
  const c = cumLen(P), L = c[c.length - 1], out = [];
  const at = s => { let k = 1; while (k < P.length - 1 && c[k] < s) k++; const t = Math.max(0, Math.min(1, (s - c[k - 1]) / (c[k] - c[k - 1] || 1))); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * t]; };
  out.push(at(s0)); for (let k = 0; k < P.length; k++) if (c[k] > s0 + 0.5 && c[k] < L - s1 - 0.5) out.push(P[k]); out.push(at(L - s1));
  return out;
}
function buildLanes() {
  // Abstand der Haltelinie vom Knoten: halbe Breite der Querstraße plus Zebrastreifen
  const sb = (n, e) => { if (n.e.length <= 2 && n.kind === 'ring') return 0; let m = 0; for (const id of n.e) if (id !== e.id) m = Math.max(m, NET.edges[id].w / 2); return m + (n.e.length > 2 ? 2.5 : 0.5); };
  for (const e of NET.edges) for (const dir of [1, -1]) {
    const from = NET.nodes[dir > 0 ? e.a : e.b], to = NET.nodes[dir > 0 ? e.b : e.a];
    const raw = lanePts(e, dir), pts = trimPoly(raw, sb(from, e), sb(to, e));
    if (cumLen(pts).pop() < 3) continue;
    const c = cumLen(pts);
    const L = { id: TRF.lanes.length, e, dir, from: from.id, to: to.id, pts, cum: c, len: c[c.length - 1], cars: [], out: [], vmax: e.kind === 'ring' ? 15 : e.w > 20 ? 14 : 11 };
    const a = pts[pts.length - 2], b = pts[pts.length - 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    L.endDir = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
    const a0 = pts[0], b0 = pts[1], d0 = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) || 1;
    L.startDir = [(b0[0] - a0[0]) / d0, (b0[1] - a0[1]) / d0];
    L.axis = Math.abs(L.endDir[0]) > Math.abs(L.endDir[1]) ? 0 : 1;
    TRF.lanes.push(L);
  }
  const byFrom = new Map();
  for (const L of TRF.lanes) { let l = byFrom.get(L.from); if (!l) byFrom.set(L.from, l = []); l.push(L); }
  for (const L of TRF.lanes) {
    const outs = (byFrom.get(L.to) || []).filter(o => o.e !== L.e);
    L.out = outs.length ? outs : (byFrom.get(L.to) || []);
  }
  // Ampeln an Rasterkreuzungen mit drei oder mehr Straßen
  for (const n of NET.nodes) if (n.kind === 'grid' && n.e.length >= 3) { n.light = { ph: (n.gi * 7 + n.gj * 13) % 24 }; TRF.lights.push(n); }
}
// Abbiegebogen zwischen zwei Spuren (zwischengespeichert)
function turnOf(A, B) {
  const key = A.id * 100000 + B.id; let t = TRF.turns.get(key);
  if (t) return t;
  const a = A.pts[A.pts.length - 1], b = B.pts[0], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dot = A.endDir[0] * B.startDir[0] + A.endDir[1] * B.startDir[1];
  const pts = d < 0.6 ? [a, b] : (dot > 0.98 ? [a, b] : bez(a, A.endDir, b, B.startDir, Math.max(4, Math.round(d / 1.5)), 0.42));
  t = { pts, cum: cumLen(pts), len: 0, sharp: 1 - dot }; t.len = t.cum[t.cum.length - 1];
  TRF.turns.set(key, t);
  return t;
}
function polyAt(P, c, s) {
  let lo = 1, hi = P.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < s) lo = m + 1; else hi = m; }
  const k = Math.max(1, Math.min(P.length - 1, lo)), seg = (c[k] - c[k - 1]) || 1, t = Math.max(0, Math.min(1, (s - c[k - 1]) / seg));
  const a = P[k - 1], b = P[k];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
}
function lightGreen(n, axis, t) {
  if (!n || !n.light) return true;
  const u = (t + n.light.ph) % 24;
  return axis === 0 ? u < 10.5 : (u >= 12 && u < 22.5);
}
function lightAmber(n, axis, t) {
  if (!n || !n.light) return false;
  const u = (t + n.light.ph) % 24;
  return axis === 0 ? (u >= 10.5 && u < 11.5) : (u >= 22.5 && u < 23.5);
}
function pickNext(L) { const o = L.out; if (!o.length) return null; const st = o.filter(x => x.startDir[0] * L.endDir[0] + x.startDir[1] * L.endDir[1] > 0.9); return Math.random() < 0.55 && st.length ? st[0] : o[Math.floor(Math.random() * o.length)]; }
function placeTrafficCar(car, L, s) {
  car.lane = L; car.s = s; car.next = pickNext(L); car.turn = car.next ? turnOf(L, car.next) : null;
  L.cars.push(car);
}
function spawnTraffic(n) {
  const lanes = TRF.lanes.filter(L => L.len > 25), total = lanes.reduce((a, L) => a + L.len, 0);
  for (let i = 0; i < n; i++) {
    let u = Math.random() * total, L = lanes[0];
    for (const l of lanes) { if ((u -= l.len) <= 0) { L = l; break; } }
    const car = { v: 6 + Math.random() * 6, v0: 0.85 + Math.random() * 0.3, T: 1.1 + Math.random() * 0.6, wx: 0, wz: 0, wy: 0, yaw: 0, graph: true };
    placeTrafficCar(car, L, Math.random() * Math.max(1, L.len - 6));
    const q = polyAt(L.pts, L.cum, car.s); car.wx = q[0]; car.wz = q[1]; car.yaw = Math.atan2(-q[3], q[2]);
    TRF.cars.push(car);
  }
}
// Abstand zum Vordermann auf demselben Weg (Spur + Bogen), sonst auf der nächsten Spur
function leaderGap(car) {
  const L = car.lane; let best = 1e9, bv = 0;
  for (const o of L.cars) if (o !== car && o.s > car.s && o.s - car.s < best) { best = o.s - car.s; bv = o.v; }
  if (best > 1e8 && car.next) {
    const rest = L.len + (car.turn ? car.turn.len : 0) - car.s;
    for (const o of car.next.cars) if (o.s + rest < best) { best = o.s + rest; bv = o.v; }
  }
  return [best - 5.2, bv];
}
const _tq = { x: 0, z: 0 };
function updateTraffic(dt, t) {
  TRF.t = t;
  for (const L of TRF.lanes) if (L.cars.length > 1) L.cars.sort((a, b) => a.s - b.s);
  for (const car of TRF.cars) {
    if (car.dyn) continue;
    const L = car.lane, total = L.len + (car.turn ? car.turn.len : 0);
    // Wunschgeschwindigkeit: auf der Spur zügig, im Bogen je nach Schärfe langsamer
    let v0 = L.vmax * car.v0;
    const toEnd = L.len - car.s;
    if (car.turn && car.turn.sharp > 0.3) { const vt = 5.5 + (1 - car.turn.sharp) * 4; if (toEnd < 25) v0 = Math.min(v0, vt + toEnd * 0.35); if (car.s > L.len) v0 = Math.min(v0, vt); }
    let [gap, lv] = leaderGap(car);
    // Ampel: vor Rot an der Haltelinie stehen bleiben
    const node = NET.nodes[L.to];
    if (car.s < L.len - 0.5 && node.light && !lightGreen(node, L.axis, t)) {
      const stop = toEnd - 1.2;
      if (!(lightAmber(node, L.axis, t) && stop < car.v * 1.2)) { if (stop < gap) { gap = stop; lv = 0; } }
    }
    // Einfädeln vom Querweg auf den Ring: Vorfahrt achten
    if (car.s < L.len - 0.5 && toEnd < 18 && L.e.kind === 'link' && car.next && car.next.e.kind === 'ring') {
      for (const R of TRF.lanes) if (R.to === L.to && R.e.kind === 'ring') for (const o of R.cars) if (R.len - o.s < 28 && R.len - o.s > -3) { gap = Math.min(gap, toEnd - 1.2); lv = 0; }
    }
    // Spielerwagen, Unfallwagen und Fußgänger vor der Haube
    const hx = Math.cos(car.yaw), hz = -Math.sin(car.yaw);
    for (const ob of OBSTACLES) {
      const rx = ob.x - car.wx, rz = ob.z - car.wz, al = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx);
      if (al > 0 && al < 24 && lat < (ob.r || 1.2) + 1.1 && Math.abs((ob.y || 0) - car.wy) < 2.5) { const g = al - 3.2 - (ob.r || 1.2); if (g < gap) { gap = g; lv = ob.v || 0; } }
    }
    // IDM: Beschleunigung aus Wunschtempo und Lücke
    const a = 2.2, b = 3.5, s0 = 1.8, v = car.v;
    const ss = s0 + Math.max(0, v * car.T + v * (v - lv) / (2 * Math.sqrt(a * b)));
    let acc = a * (1 - Math.pow(v / Math.max(1, v0), 4) - Math.pow(ss / Math.max(0.3, gap), 2));
    acc = Math.max(-9, Math.min(a, acc));
    car.v = Math.max(0, v + acc * dt);
    if (gap < 0.3) car.v = Math.min(car.v, 0.3);
    car.acc = acc;
    car.s += car.v * dt;
    if (car.s >= total) {
      // nächste Spur
      const i = L.cars.indexOf(car); if (i >= 0) L.cars.splice(i, 1);
      const N = car.next || pickNext(L) || L;
      placeTrafficCar(car, N, Math.min(car.s - total, N.len - 1));
    }
    const Lc = car.lane;
    const p = car.s <= Lc.len ? polyAt(Lc.pts, Lc.cum, car.s) : polyAt(car.turn.pts, car.turn.cum, car.s - Lc.len);
    car.wx = p[0]; car.wz = p[1]; car.wy = 0;
    const ty = Math.atan2(-p[3], p[2]);
    let dy = ty - car.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    car.yaw += dy * Math.min(1, dt * 8);
  }
}
// Hindernisse für den Verkehr: Spielerwagen, Unfallwagen (vom Physikmodul gefüllt)
const OBSTACLES = [];

/* ---------- Autos: Bau und Darstellung (ersetzt die geraden Spuren von V15; Hochstraßen und Viadukt bleiben) ---------- */
let carGlass = null;
function buildCars() {
  buildLanes();
  const lanes = [];
  for (const e of ELEVATED) {
    const ax = e.axis === 'x', len = e.to - e.from;
    lanes.push({ dx: ax ? 1 : 0, dz: ax ? 0 : 1, len, y: e.y, start: [ax ? e.from : e.at - 3.5, ax ? e.at + 3.5 : e.from] });
    lanes.push({ dx: ax ? -1 : 0, dz: ax ? 0 : -1, len, y: e.y, start: [ax ? e.to : e.at + 3.5, ax ? e.at - 3.5 : e.to] });
  }
  const vl = ROAD_Z0 - VIA.end - 8;
  lanes.push({ dx: 0, dz: 1, len: vl, yf: deckY, start: [-3.5, VIA.end + 4], n: 7 });
  lanes.push({ dx: 0, dz: -1, len: vl, yf: deckY, start: [3.5, ROAD_Z0 - 4], n: 7 });
  for (const l of lanes) for (let k = 0; k < (l.n || 4); k++) cars.push({ l, s: rand(0, l.len), v: rand(9, 15), yaw: Math.atan2(-l.dz, l.dx) });
  spawnTraffic(MOBILE ? 150 : 260);
  cars.push(...TRF.cars);
  const body = carGeo();
  carBodyGeo = body;
  carMesh = new T.InstancedMesh(body, MAT.carPaint, cars.length);
  const paint = [[0.05, 0.05, 0.06], [0.28, 0.04, 0.06], [0.75, 0.68, 0.55], [0.05, 0.16, 0.1], [0.08, 0.1, 0.22], [0.5, 0.36, 0.16]];
  const c = new T.Color();
  cars.forEach((car, i) => { const p = car.col = pick(paint).map(v => v + (Math.random() - 0.5) * 0.012); carMesh.setColorAt(i, c.setRGB(p[0], p[1], p[2])); });
  carMeshHi = new T.InstancedMesh(carGeoHi({ driver: true }), MAT.carPaint, cars.length);
  carMeshHi.setColorAt(0, c.setRGB(1, 1, 1));
  carDamageAttr(carMeshHi); carDamageAttr(carMesh);
  for (const im of [carMesh, carMeshHi]) { im.count = 0; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); }
  carGlass = glassFor(carMeshHi);
  carCmp = lodCompactor(carMeshHi, carMesh, LOD_CAR2);
  const pts = [];
  for (let i = 0; i < cars.length; i++) {
    pts.push({ p: [0, 0, 0], c: [1.4, 1.25, 0.95], s: 0.9, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [1.4, 1.25, 0.95], s: 0.9, ph: 0, bl: 0 });
    pts.push({ p: [0, 0, 0], c: [1.4, 0.1, 0.06], s: 0.55, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [1.4, 0.1, 0.06], s: 0.55, ph: 0, bl: 0 });
  }
  carLights = makeGlowPoints(pts, true); scene.add(carLights);
  buildTrafficLights();
  buildFX();
  buildFlags();
  buildLeaves();
}
const _ce = new T.Euler();
// Fahrer und Fahrgäste in der Nähe der Kamera: eine kleine Menge, die den Wagen folgt
const DRV = { crowd: null, slots: [], player: null };
function buildDrivers() {
  const F = MOBILE ? 0.5 : 1, n = { suit: Math.round(9 * F), chauffeur: Math.round(5 * F), coat: Math.round(5 * F), lady: Math.round(7 * F) };
  DRV.crowd = new Crowd(Object.keys(n), 40);
  for (const k in n) for (let i = 0; i < n[k]; i++) {
    const a = DRV.crowd.add(k, k === 'chauffeur' ? [0.05, 0.07, 0.1] : k === 'lady' ? pick(COATS) : pick(COATS));
    DRV.slots.push({ a, kind: k, car: null, role: null, sc: 0.95 + Math.random() * 0.08 });
  }
  DRV.player = { a: DRV.crowd.add('suit', [0.08, 0.08, 0.1]), kind: 'suit', sc: 1, role: 'drv' };
  DRV.crowd.finish();
}
const drvH = (i, s) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
function seatPerson(sl, X, Y, Z, yaw, lx, lz, steer) {
  const a = sl.a, c = Math.cos(yaw), s = Math.sin(yaw), fem = sl.kind === 'lady';
  // Sitzfläche auf 1,1 m über dem Wagenboden; Hüfte darauf
  DRV.crowd.set(a, X + c * lx + s * lz, Y + 1.1 - (fem ? 0.8 : 0.87) * sl.sc, Z - s * lx + c * lz, yaw + Math.PI / 2, sl.sc);
  const g = a.gait, want = sl.role === 'drv' ? 32 + Math.round((0.5 + Math.max(-1.6, Math.min(1.6, steer)) / 3.4) * 48) / 48 : 7.2;
  if (g[1] !== want || g[2] !== 0) { g[1] = Math.min(want, 32.999); g[2] = 0; a.gv = (a.gv | 0) + 1; }
}
function updateDrivers(dt) {
  if (!DRV.crowd) return;
  const cp = camera.position, R2 = 40 * 40, d2 = car => (car._x - cp.x) ** 2 + (car._y - cp.y) ** 2 + (car._z - cp.z) ** 2;
  for (const sl of DRV.slots) if (sl.car && (sl.car._hid || d2(sl.car) > R2 * 1.2)) { sl.car[sl.role] = null; sl.car = null; sl.a.on = false; }
  const free = k => DRV.slots.find(sl => !sl.car && sl.kind === k) || DRV.slots.find(sl => !sl.car && sl.kind !== 'lady');
  cars.forEach((car, i) => {
    if (car._x === undefined || car._hid || d2(car) > R2) return;
    if (!car.drv) { const h = drvH(i, 1), sl = free(h < 0.25 ? 'chauffeur' : h < 0.5 ? 'coat' : h < 0.9 ? 'suit' : 'lady'); if (sl) { sl.car = car; sl.role = 'drv'; car.drv = sl; } }
    if (!car.pax && drvH(i, 2) < 0.38) { const sl = free(drvH(i, 3) < 0.7 ? 'lady' : 'suit'); if (sl) { sl.car = car; sl.role = 'pax'; car.pax = sl; } }
  });
  for (const sl of DRV.slots) {
    if (!sl.car) continue; const car = sl.car;
    if (sl.role === 'drv') { car._st = (car._st || 0) + ((car._yr || 0) * 2.4 - (car._st || 0)) * Math.min(1, dt * 5); seatPerson(sl, car._x, car._y, car._z, car._yaw, -0.42, 0.38, car._st); }
    else seatPerson(sl, car._x, car._y, car._z, car._yaw, -1.48, -0.36, 0);
  }
  // der eigene Wagen: Fahrer dreht das Lenkrad mit dem Einschlag der Vorderräder
  const B = DRIVE.body, P = DRV.player;
  if (B && DRIVE.on && DRIVE.mesh) { const by = (B.gy !== undefined && !B.air ? B.gy : B.y); seatPerson(P, B.x, by + 0.22, B.z, B.h, -0.42, 0.38, (DRIVE.delta || 0) * 3.2); }
  else P.a.on = false;
  DRV.crowd.flag();
}
function updateCars(dt) {
  updateTraffic(dt, U.uTime.value);
  const pos = carLights.geometry.attributes.position.array, cp = camera.position;
  carCmp.begin();
  cars.forEach((car, i) => {
    let x, z, ly, yaw, hidden = false, pitch = 0, roll = 0;
    if (car.graph) {
      if (car.dyn) { const b = car.dyn; x = b.x; z = b.z; ly = b.y; yaw = b.h; pitch = b.pitch; roll = b.roll; }
      else { x = car.wx; z = car.wz; ly = 0; yaw = car.yaw; pitch = Math.max(-0.03, Math.min(0.03, -(car.acc || 0) * 0.006)); }
      if (car.gone) hidden = true;
    } else if (car.l.path) {
      if (!paused) serpCarStep(car, dt);
      x = car.wx; z = car.wz; ly = car.wy; yaw = car.yaw; pitch = car.pitch || 0;
    } else {
      const { dx, dz, start } = car.l;
      let go = true;
      if (DRIVE.on && car.wx !== undefined) { const rx = DRIVE.x - car.wx, rz = DRIVE.z - car.wz, al = rx * dx + rz * dz; go = !(al > 0 && al < 9 && Math.abs(rx * dz - rz * dx) < 2.4 && Math.abs(DRIVE.y - car.wy) < 2); }
      if (go) car.s = (car.s + car.v * dt) % car.l.len;
      x = start[0] + dx * car.s; z = start[1] + dz * car.s;
      ly = car.l.yf ? car.l.yf(z) : (car.l.y || 0);
      yaw = Math.atan2(-dz, dx);
      car.wx = x; car.wz = z; car.wy = ly; car.yaw = yaw;
    }
    _q.setFromEuler(_ce.set(roll, yaw, pitch, 'YXZ'));
    _p.set(x, 0.22 + ly, z);
    car._x = x; car._y = 0.22 + ly; car._z = z; car._yr = car._yaw === undefined ? 0 : Math.atan2(Math.sin(yaw - car._yaw), Math.cos(yaw - car._yaw)) / Math.max(dt, 1e-3); car._yaw = yaw; car._hid = hidden;
    const cd2 = (x - cp.x) ** 2 + (z - cp.z) ** 2 + (_p.y - cp.y) ** 2;
    if (!hidden && cd2 < CAR_DIST2) carCmp.put(_m.compose(_p, _q, _s.setScalar(1)), car, car.col, cd2);
    const fx = Math.cos(yaw), fz = -Math.sin(yaw), sx = -fz, sz = fx, y = hidden ? -50 : 0.95 + ly;
    const o = i * 12, dmg = car.dmg, hl0 = dmg && dmg[0] > 0.55 ? -60 : 0, hl1 = dmg && dmg[0] > 0.8 ? -60 : 0;
    pos[o] = x + fx * 2.62 + sx * 0.62; pos[o + 1] = y + 0.12 + hl0; pos[o + 2] = z + fz * 2.62 + sz * 0.62;
    pos[o + 3] = x + fx * 2.62 - sx * 0.62; pos[o + 4] = y + 0.12 + hl1; pos[o + 5] = z + fz * 2.62 - sz * 0.62;
    pos[o + 6] = x - fx * 2.35 + sx * 0.7; pos[o + 7] = y; pos[o + 8] = z - fz * 2.35 + sz * 0.7;
    pos[o + 9] = x - fx * 2.35 - sx * 0.7; pos[o + 10] = y; pos[o + 11] = z - fz * 2.35 - sz * 0.7;
  });
  carCmp.end();
  updateDrivers(dt);
  if (carGlass) carGlass.count = carMeshHi.count;
  carLights.geometry.attributes.position.needsUpdate = true;
  updateTrafficLights();
}
// Verkehrsampeln der Zwanziger: gusseiserner Mast mit vier Laternen (Rot, Gelb, Grün) an den großen Kreuzungen
let TL_GLOW = null;
function buildTrafficLights() {
  const big = TRF.lights.filter(n => n.e.length === 4 && NET.edges[n.e[0]] && n.e.some(id => NET.edges[id].w >= 22));
  const parts = [];
  const iron = [0.06, 0.07, 0.065], brass = [0.62, 0.46, 0.22];
  parts.push([new T.CylinderGeometry(0.16, 0.2, 0.5, 10).translate(0, 0.25, 0), iron]);
  parts.push([new T.CylinderGeometry(0.07, 0.09, 3.6, 10).translate(0, 2.3, 0), iron]);
  parts.push([new T.CylinderGeometry(0.12, 0.12, 0.08, 10).translate(0, 1.0, 0), brass]);
  parts.push([new T.BoxGeometry(0.46, 1.1, 0.46).translate(0, 4.6, 0), iron]);
  parts.push([new T.ConeGeometry(0.4, 0.4, 4).rotateY(Math.PI / 4).translate(0, 5.35, 0), iron]);
  parts.push([new T.SphereGeometry(0.06, 8, 6).translate(0, 5.6, 0), brass]);
  for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) { const a = k * Math.PI / 2; parts.push([new T.CylinderGeometry(0.1, 0.1, 0.12, 10).rotateX(Math.PI / 2).translate(0, 4.95 - j * 0.32, 0.26).rotateY(a), brass]); }
  const geo = mergeColored(parts), mat = paintMat({ color: 0xffffff, metalness: 0.5, roughness: 0.45, envI: 0.6 });
  const list = [], glow = [];
  for (const n of big) {
    // Mast auf der Ecke des Bürgersteigs (Nordwest der Kreuzung)
    const i = n.gi, j = n.gj, x = n.x - AV[i].w / 2 - 1.2, z = n.z - ST[j].w / 2 - 1.2;
    if (!blockAt(x, z, 0.5)) continue;
    list.push(_m.compose(_p.set(x, 0.22, z), _q.identity(), _s.set(1, 1, 1)).clone());
    addCollider(x - 0.25, 0, z - 0.25, x + 0.25, 5.6, z + 0.25);
    // je Seite eine Leuchte, die gerade an ist (Achse x: Ost/West-Seite, Achse z: Nord/Süd-Seite)
    for (let k = 0; k < 4; k++) { const ax = k % 2 === 0 ? 1 : 0, dx = [0, 1, 0, -1][k], dz = [1, 0, -1, 0][k]; glow.push({ n, ax, x: x + dx * 0.36, z: z + dz * 0.36 }); }
  }
  if (!list.length) return;
  const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im);
  const pts = glow.map(g => ({ p: [g.x, 4.95, g.z], c: [0.2, 1.4, 0.5], s: 0.55, ph: 0, bl: 0 }));
  TL_GLOW = { pts: makeGlowPoints(pts, true), list: glow, t: 0 }; scene.add(TL_GLOW.pts);
  // Farbe wird je Bild gesetzt: Rot oben, Gelb Mitte, Grün unten
  TL_GLOW.col = TL_GLOW.pts.geometry.attributes.color || null;
}
function updateTrafficLights() {
  if (!TL_GLOW || (TL_GLOW.t -= 1 / 30) > 0) return;
  TL_GLOW.t = 0.25;
  const pos = TL_GLOW.pts.geometry.attributes.position.array, col = TL_GLOW.col && TL_GLOW.col.array, t = TRF.t;
  TL_GLOW.list.forEach((g, i) => {
    const green = lightGreen(g.n, g.ax, t), amber = lightAmber(g.n, g.ax, t);
    pos[i * 3 + 1] = green ? 4.31 : amber ? 4.63 : 4.95;
    if (col) { const c = green ? [0.25, 1.5, 0.6] : amber ? [1.6, 1.0, 0.2] : [1.7, 0.15, 0.1]; col.set(c, i * 3); }
  });
  TL_GLOW.pts.geometry.attributes.position.needsUpdate = true;
  if (col) TL_GLOW.col.needsUpdate = true;
}


const CAR_DIST2 = 750 * 750;
function buildCarsV15() {
  const lanes = [];
  for (const a of AV) {
    if (Math.abs(a.x) > 900) continue;
    const off = a.x === 0 ? 15 : a.w / 4;
    lanes.push({ x: a.x + off, z: 0, dx: 0, dz: -1, len: 1485, start: [a.x + off, 505] });
    lanes.push({ x: a.x - off, z: 0, dx: 0, dz: 1, len: 1485, start: [a.x - off, -980] });
  }
  for (const s of ST) {
    if (s.z < -900) continue;
    const off = s.w / 4;
    lanes.push({ dx: 1, dz: 0, len: 1800, start: [-900, s.z + off] });
    lanes.push({ dx: -1, dz: 0, len: 1800, start: [900, s.z - off] });
  }
  for (const e of ELEVATED) {
    const ax = e.axis === 'x', len = e.to - e.from;
    lanes.push({ dx: ax ? 1 : 0, dz: ax ? 0 : 1, len, y: e.y, start: [ax ? e.from : e.at - 3.5, ax ? e.at + 3.5 : e.from] });
    lanes.push({ dx: ax ? -1 : 0, dz: ax ? 0 : -1, len, y: e.y, start: [ax ? e.to : e.at + 3.5, ax ? e.at - 3.5 : e.to] });
  }
  // Auf dem Viadukt: aus dem Tunnel in die Stadt und zurück
  const vl = ROAD_Z0 - VIA.end - 8;
  lanes.push({ dx: 0, dz: 1, len: vl, yf: deckY, start: [-3.5, VIA.end + 4], n: 7 });
  lanes.push({ dx: 0, dz: -1, len: vl, yf: deckY, start: [3.5, ROAD_Z0 - 4], n: 7 });
  for (const l of lanes) for (let k = 0; k < (l.n || 4); k++) cars.push({ l, s: rand(0, l.len), v: rand(9, 15) });
  const body = carGeo();
  carBodyGeo = body;
  carMesh = new T.InstancedMesh(body, MAT.carPaint, cars.length);
  const paint = [[0.05, 0.05, 0.06], [0.28, 0.04, 0.06], [0.75, 0.68, 0.55], [0.05, 0.16, 0.1], [0.08, 0.1, 0.22], [0.5, 0.36, 0.16]];
  const c = new T.Color();
  cars.forEach((car, i) => { const p = car.col = pick(paint).map(v => v + (Math.random() - 0.5) * 0.012); carMesh.setColorAt(i, c.setRGB(p[0], p[1], p[2])); });
  carMeshHi = new T.InstancedMesh(carGeoHi(), MAT.carPaint, cars.length);
  for (const im of [carMesh, carMeshHi]) { im.count = 0; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); }
  carCmp = lodCompactor(carMeshHi, carMesh, LOD_CAR2);
  const pts = [];
  for (let i = 0; i < cars.length; i++) {
    pts.push({ p: [0, 0, 0], c: [1.4, 1.25, 0.95], s: 0.9, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [1.4, 1.25, 0.95], s: 0.9, ph: 0, bl: 0 });
    pts.push({ p: [0, 0, 0], c: [1.4, 0.1, 0.06], s: 0.55, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [1.4, 0.1, 0.06], s: 0.55, ph: 0, bl: 0 });
  }
  carLights = makeGlowPoints(pts, true); scene.add(carLights);
}
const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
function updateCarsV15(dt) {
  const pos = carLights.geometry.attributes.position.array, cp = camera.position;
  carCmp.begin();
  cars.forEach((car, i) => {
    const { dx, dz, start } = car.l;
    // vor dem selbst gefahrenen Wagen anhalten
    let go = true;
    if (DRIVE.on && car.wx !== undefined) { const rx = DRIVE.x - car.wx, rz = DRIVE.z - car.wz, al = rx * dx + rz * dz; go = !(al > 0 && al < 9 && Math.abs(rx * dz - rz * dx) < 2.4 && Math.abs(DRIVE.y - car.wy) < 2); }
    if (go) car.s = (car.s + car.v * dt) % car.l.len;
    const x = start[0] + dx * car.s, z = start[1] + dz * car.s;
    const ly = car.l.yf ? car.l.yf(z) : (car.l.y || 0);
    car.wx = x; car.wz = z; car.wy = ly;
    const hidden = !car.l.y && !car.l.yf && (inRect(x, z, PLAZA, 3) || inRect(x, z, MEDIAN, 2) || z > 504);
    const yaw = Math.atan2(-dz, dx);
    _q.setFromAxisAngle(_up, yaw);
    _p.set(x, 0.22 + ly, z);
    const cd2 = (x - cp.x) ** 2 + (z - cp.z) ** 2 + (_p.y - cp.y) ** 2;
    if (!hidden && cd2 < CAR_DIST2) carCmp.put(_m.compose(_p, _q, _s.setScalar(1)), car, car.col, cd2);
    const fx = dx, fz = dz, sx = -dz, sz = dx, y = hidden ? -50 : 0.95 + ly;
    const o = i * 12;
    pos[o] = x + fx * 2.62 + sx * 0.62; pos[o + 1] = y + 0.12; pos[o + 2] = z + fz * 2.62 + sz * 0.62;
    pos[o + 3] = x + fx * 2.62 - sx * 0.62; pos[o + 4] = y + 0.12; pos[o + 5] = z + fz * 2.62 - sz * 0.62;
    pos[o + 6] = x - fx * 2.35 + sx * 0.7; pos[o + 7] = y; pos[o + 8] = z - fz * 2.35 + sz * 0.7;
    pos[o + 9] = x - fx * 2.35 - sx * 0.7; pos[o + 10] = y; pos[o + 11] = z - fz * 2.35 - sz * 0.7;
  });
  carCmp.end();
  carLights.geometry.attributes.position.needsUpdate = true;
}


/* ---------- Lieferverkehr: Lastwagen bringen Waren von den Fabriken zu Läden, Lokalen und Hotels ---------- */
const trucks = [], TRUCK_N = 30, deliveryMen = [];
let truckCmp = null, truckLights = null, parcelMesh = null;
function truckGeo() {
  const B = IB, C = (r, h, seg, x, y, z) => new T.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2).translate(x, y, z);
  const cab = [0.035, 0.15, 0.16], gold = [0.85, 0.62, 0.28];
  const parts = [
    [B(6.8, 0.32, 1.8, -0.2, 0.72, 0), COL.dark],
    [B(1.7, 1.45, 2.06, 1.95, 1.62, 0), cab], [B(1.86, 0.1, 2.14, 1.95, 2.38, 0), cab],
    [B(0.04, 0.62, 1.8, 2.81, 1.98, 0), COL.glass], [B(1.0, 0.56, 2.08, 2.05, 1.98, 0), COL.glass],
    [B(1.25, 0.82, 1.5, 3.4, 1.28, 0), cab], [B(0.08, 0.8, 1.15, 4.04, 1.28, 0), COL.chrome],
    [B(0.3, 0.14, 2.0, 4.1, 0.78, 0), COL.chrome],
    [B(4.3, 2.35, 2.3, -1.25, 2.06, 0), PAINT],
    [B(4.34, 0.12, 2.34, -1.25, 3.2, 0), gold], [B(4.34, 0.1, 2.34, -1.25, 0.95, 0), gold],
    [B(0.06, 2.1, 2.2, -3.42, 2.06, 0), COL.dark],
  ];
  for (const sz of [-1, 1]) {
    parts.push([C(0.16, 0.22, 10, 4.0, 1.5, sz * 0.62).rotateZ(0), COL.chrome]);
    parts.push([B(1.2, 0.2, 0.42, 3.3, 0.95, sz * 0.9), cab]);
    for (const sx of [3.2, -1.1, -2.3]) { parts.push([C(0.5, 0.3, 16, sx, 0.5, sz * 0.92), COL.tyre]); parts.push([C(0.26, 0.32, 12, sx, 0.5, sz * 0.92), COL.chrome]); }
  }
  return mergeColored(parts);
}
const roadST = z => ST.reduce((a, s) => Math.abs(s.z - z) < Math.abs(a.z - z) ? s : a).z;
const roadAV = x => AV.filter(a => a.x >= 110).reduce((a, v) => Math.abs(v.x - x) < Math.abs(a.x - x) ? v : a).x;
function truckTarget() {
  const ok = DOORS.filter(d => d.x > 120 && d.z < 480 && d.z > -960 && d.kind !== 'workshop' && (d.nx === 0 || d.nz === 0) && blockAt(d.x - d.nx * 2, d.z - d.nz * 2, 1));
  return ok[Math.floor(Math.random() * ok.length)];
}
// Mittellinie der Fahrt: Straße entlang, an einer Avenue abbiegen, bis vor die Tür
function truckPath(dep, door) {
  const zs = dep.roadZ, xs = dep.x, pts = [[xs, zs]];
  if (door.nz !== 0) {
    const zt = roadST(door.z + door.nz * 9), xt = door.x;
    if (zt !== zs) { const xa = roadAV(xt + door.nz * 45); pts.push([xa, zs], [xa, zt]); }
    pts.push([xt, zt]);
  } else {
    const xt = roadAV(door.x + door.nx * 9), zt = door.z;
    pts.push([xt, zs], [xt, zt]);
  }
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.5);
}
// Rechtsverkehr: jede Ecke um die Spurbreite nach rechts versetzen
function laneOf(pts, off = 3.5) {
  const n = pts.length, out = [];
  const dir = i => { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  for (let i = 0; i < n; i++) {
    let ox = 0, oz = 0;
    if (i > 0) { const d = dir(i - 1); ox += -d[1]; oz += d[0]; }
    if (i < n - 1) { const d = dir(i); if (i > 0) { const p = dir(i - 1); if (Math.abs(p[0] * d[0] + p[1] * d[1]) > 0.9) { ox = 0; oz = 0; } } ox += -d[1]; oz += d[0]; }
    if (i > 0 && i < n - 1 && (ox * ox + oz * oz) > 3) { ox /= 2; oz /= 2; } // geradeaus: nicht doppelt versetzen
    out.push([pts[i][0] + ox * off, pts[i][1] + oz * off]);
  }
  const segs = []; let total = 0;
  for (let i = 0; i < n - 1; i++) { const a = out[i], b = out[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, L, s0: total }); total += L; }
  return { segs, total };
}
function truckPlan(tr) {
  tr.door = truckTarget();
  tr.center = truckPath(tr.dep, tr.door);
  tr.path = laneOf(tr.center); tr.s = 0; tr.st = 0;
}
function buildTrucks() {
  if (!DEPOTS.length) return;
  const geo = truckGeo(), m = new T.InstancedMesh(geo, MAT.carPaint, TRUCK_N);
  m.count = 0; m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; scene.add(m);
  truckCmp = compactor(m);
  const livery = [[0.32, 0.05, 0.06], [0.04, 0.2, 0.2], [0.72, 0.62, 0.45], [0.06, 0.16, 0.1], [0.08, 0.1, 0.24], [0.45, 0.3, 0.1]];
  parcelMesh = new T.InstancedMesh(IB(0.6, 0.45, 0.45, 0, 0, 0), new T.MeshStandardMaterial({ color: 0x6b4c2c, roughness: 0.9 }), TRUCK_N);
  parcelMesh.instanceMatrix.setUsage(T.DynamicDrawUsage); parcelMesh.frustumCulled = false; parcelMesh.count = TRUCK_N; scene.add(parcelMesh);
  const pts = [];
  for (let i = 0; i < TRUCK_N; i++) {
    const tr = { dep: DEPOTS[i % DEPOTS.length], col: livery[i % livery.length], v: 7.5 + Math.random() * 2, yaw: 0, man: deliveryMen[i] };
    truckPlan(tr);
    if (Math.random() < 0.7) tr.s = Math.random() * tr.path.total; else { tr.st = 3; tr.wait = Math.random() * 15; }
    trucks.push(tr);
    pts.push({ p: [0, -50, 0], c: [1.4, 1.25, 0.95], s: 0.95, ph: 0, bl: 0 }, { p: [0, -50, 0], c: [1.4, 1.25, 0.95], s: 0.95, ph: 0, bl: 0 });
    pts.push({ p: [0, -50, 0], c: [1.4, 0.1, 0.06], s: 0.6, ph: 0, bl: 0 }, { p: [0, -50, 0], c: [1.4, 0.1, 0.06], s: 0.6, ph: 0, bl: 0 });
  }
  truckLights = makeGlowPoints(pts, true); scene.add(truckLights);
}
function pathAt(path, s) {
  let sg = path.segs[path.segs.length - 1];
  for (const g of path.segs) if (s <= g.s0 + g.L) { sg = g; break; }
  const k = Math.min(1, Math.max(0, (s - sg.s0) / (sg.L || 1)));
  return [sg.a[0] + (sg.b[0] - sg.a[0]) * k, sg.a[1] + (sg.b[1] - sg.a[1]) * k, (sg.b[0] - sg.a[0]) / (sg.L || 1), (sg.b[1] - sg.a[1]) / (sg.L || 1)];
}
function updateTrucks(dt) {
  if (!truckCmp) return;
  const pos = truckLights.geometry.attributes.position.array, cp = camera.position;
  truckCmp.begin();
  trucks.forEach((tr, i) => {
    const man = tr.man || (tr.man = deliveryMen[i] && deliveryMen[i].a ? deliveryMen[i] : null);
    if (tr.st === 0 || tr.st === 2) {
      // langsam in die Kurven und vor dem Ziel
      const rest = tr.path.total - tr.s;
      tr.s += Math.min(tr.v, 2 + rest * 0.6) * dt;
      if (tr.s >= tr.path.total) {
        tr.s = tr.path.total;
        if (tr.st === 0) { tr.st = 1; tr.t = 0; } else { tr.st = 3; tr.wait = 8 + Math.random() * 14; }
      }
    } else if (tr.st === 1) {
      // Abladen: Fahrer trägt ein Paket zur Tür und kommt zurück
      tr.t += dt;
      const [x, z, dx, dz] = pathAt(tr.path, tr.path.total), rx = x - dx * 4.0 - dz * 1.6, rz = z - dz * 4.0 + dx * 1.6;
      const D = Math.hypot(tr.door.x - rx, tr.door.z - rz), walk = D / 1.3, T1 = walk, T2 = walk + 5, T3 = 2 * walk + 5;
      if (man) {
        let k = -1, out = true;
        if (tr.t < T1) k = tr.t / T1; else if (tr.t > T2 && tr.t < T3) { k = 1 - (tr.t - T2) / walk; out = false; }
        if (k >= 0) {
          const mx = rx + (tr.door.x - rx) * k, mz = rz + (tr.door.z - rz) * k, yaw = Math.atan2((tr.door.x - rx) * (out ? 1 : -1), (tr.door.z - rz) * (out ? 1 : -1));
          pedCrowd.set(man.a, mx, 0.22, mz, yaw, 1);
          if (out) { _p.set(mx + Math.sin(yaw) * 0.42, 1.25, mz + Math.cos(yaw) * 0.42); _q.setFromAxisAngle(_up, yaw); parcelMesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(1))); }
          else parcelMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        } else { man.a.on = false; parcelMesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); }
      }
      if (tr.t > T3 + 1.5) {
        // zurück zur Fabrik: dieselbe Strecke rückwärts, wieder auf der rechten Spur
        tr.path = laneOf(tr.center.slice().reverse()); tr.s = 0; tr.st = 2;
      }
    } else if (tr.st === 3) {
      tr.wait -= dt;
      if (tr.wait <= 0) truckPlan(tr);
    }
    if (man && tr.st !== 1) man.a.on = false;
    if (tr.st !== 1) parcelMesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
    const [x, z, dx, dz] = pathAt(tr.path, tr.s);
    const ty = Math.atan2(-dz, dx);
    let dy = ty - tr.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    tr.yaw += dy * Math.min(1, dt * 4);
    const fx = Math.cos(tr.yaw), fz = -Math.sin(tr.yaw), sx = -fz, sz = fx;
    _q.setFromAxisAngle(_up, tr.yaw); _p.set(x, 0.22, z);
    const cd2 = (x - cp.x) ** 2 + (z - cp.z) ** 2;
    if (cd2 < CAR_DIST2) truckCmp.put(_m.compose(_p, _q, _s.setScalar(1)), tr, tr.col);
    const o = i * 12, y = 1.72;
    pos[o] = x + fx * 4.05 + sx * 0.62; pos[o + 1] = y - 0.22; pos[o + 2] = z + fz * 4.05 + sz * 0.62;
    pos[o + 3] = x + fx * 4.05 - sx * 0.62; pos[o + 4] = y - 0.22; pos[o + 5] = z + fz * 4.05 - sz * 0.62;
    pos[o + 6] = x - fx * 3.48 + sx * 0.95; pos[o + 7] = 1.1; pos[o + 8] = z - fz * 3.48 + sz * 0.95;
    pos[o + 9] = x - fx * 3.48 - sx * 0.95; pos[o + 10] = 1.1; pos[o + 11] = z - fz * 3.48 - sz * 0.95;
  });
  truckCmp.end();
  parcelMesh.instanceMatrix.needsUpdate = true;
  truckLights.geometry.attributes.position.needsUpdate = true;
}

/* ---------- Straßenbahnen: zwei Linien mit Gleisen, Oberleitung und Haltestellen ---------- */
const TRAM_LINES = [
  { axis: 'x', at: -210, from: -985, to: 985, off: 1.4, pole: 8.4, name: 'LINIE 1 · BELMONT', n: 5 },
  { axis: 'z', at: -220, from: -975, to: 498, off: 2.0, pole: 12.2, name: 'LINIE 2 · HAFEN', n: 4 },
];
const trams = [];
let tramMesh, tramWin, tramLights;
function tramGeos() {
  const B = IB;
  const petrol = [0.03, 0.2, 0.21], cream = [0.8, 0.73, 0.58], gold = [0.85, 0.62, 0.28], roof = [0.16, 0.16, 0.18];
  const half = (r, h, y, x, start) => new T.CylinderGeometry(r, r, h, 14, 1, false, start, Math.PI).translate(x, y, 0);
  const parts = [
    [B(12, 1.0, 2.3, 0, 0.95, 0), petrol], [B(12.02, 0.13, 2.33, 0, 1.52, 0), gold], [B(12, 1.05, 2.24, 0, 2.1, 0), cream],
    [B(12.4, 0.22, 2.4, 0, 2.72, 0), roof], [B(8, 0.32, 1.3, 0, 2.98, 0), roof],
    [half(1.15, 1.0, 0.95, 6, 0), petrol], [half(1.15, 1.0, 0.95, -6, Math.PI), petrol],
    [half(1.12, 1.05, 2.1, 6, 0), cream], [half(1.12, 1.05, 2.1, -6, Math.PI), cream],
    [half(1.17, 0.13, 1.52, 6, 0), gold], [half(1.17, 0.13, 1.52, -6, Math.PI), gold],
    [half(1.2, 0.22, 2.72, 6, 0), roof], [half(1.2, 0.22, 2.72, -6, Math.PI), roof],
  ];
  for (const sx of [-4.2, 4.2]) { parts.push([B(2.6, 0.5, 1.9, sx, 0.4, 0), COL.dark]); for (const w of [-0.75, 0.75]) for (const sz of [-0.72, 0.72]) parts.push([new T.CylinderGeometry(0.36, 0.36, 0.12, 12).rotateX(Math.PI / 2).translate(sx + w, 0.36, sz), COL.tyre]); }
  // Stromabnehmer bis zum Fahrdraht
  for (const sz of [-0.5, 0.5]) { parts.push([B(0.06, 1.7, 0.06, -0.5, 3.9, sz).rotateZ(0.5), COL.dark]); parts.push([B(0.06, 1.7, 0.06, 0.5, 3.9, sz).rotateZ(-0.5), COL.dark]); }
  parts.push([B(0.1, 0.06, 1.6, 0, 4.75, 0), COL.chrome]);
  const win = [];
  for (let k = -5; k <= 5; k++) for (const sz of [-1, 1]) win.push(B(0.86, 0.72, 0.03, k * 1.06, 2.12, sz * 1.125));
  for (const sx of [-1, 1]) { win.push(B(0.03, 0.7, 1.2, sx * 7.12, 2.12, 0)); win.push(B(0.03, 0.26, 1.0, sx * 6.95, 2.66, 0)); }
  return { body: mergeColored(parts), win: mergeGeos(win) };
}
function buildTrams() {
  const railM = stdMat({ color: 0x9aa0a6, metalness: 1, roughness: 0.22, envI: 1.2 });
  const bedM = stdMat({ color: 0x1b1f22, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rails = [], beds = [], poles = [], wire = [];
  for (const L of TRAM_LINES) {
    const ax = L.axis === 'x', len = L.to - L.from, mid = (L.from + L.to) / 2;
    for (const sd of [-1, 1]) {
      const c = L.at + sd * L.off;
      beds.push(new T.BoxGeometry(ax ? len : 2.3, 0.02, ax ? 2.3 : len).translate(ax ? mid : c, 0.012, ax ? c : mid));
      for (const r of [-0.72, 0.72]) rails.push(new T.BoxGeometry(ax ? len : 0.09, 0.05, ax ? 0.09 : len).translate(ax ? mid : c + r, 0.03, ax ? c + r : mid));
      wire.push(ax ? L.from : c, 5.75, ax ? c : L.from, ax ? L.to : c, 5.75, ax ? c : L.to);
    }
    for (let t = L.from + 18; t < L.to; t += 36) {
      for (const sd of [-1, 1]) {
        const px = ax ? t : L.at + sd * L.pole, pz = ax ? L.at + sd * L.pole : t;
        if (inRect(px, pz, PLAZA, 2)) continue;
        poles.push(px, pz);
        addCollider(px - 0.2, 0, pz - 0.2, px + 0.2, 7, pz + 0.2);
      }
      wire.push(ax ? t : L.at - L.pole, 6.6, ax ? L.at - L.pole : t, ax ? t : L.at + L.pole, 6.6, ax ? L.at + L.pole : t);
    }
    // Haltestellen mit Wartehäuschen und Leuchtschild
    for (let k = 1; k <= 4; k++) {
      const t = L.from + len * k / 5, side = k % 2 ? 1 : -1;
      const px = ax ? t : L.at + side * (L.pole - 1.6), pz = ax ? L.at + side * (L.pole - 1.6) : t;
      if (inRect(px, pz, PLAZA, 6)) continue;
      addSeg({ x: px, z: pz, w: ax ? 7 : 2.2, d: ax ? 2.2 : 7, y0: 3.0, y1: 3.25, tint: [0.4, 0.33, 0.22], seed: 870, style: 3, dens: 0, flood: 0.8, rib: [0.85, 0.62, 0.28] }, false);
      for (const e of [-3.2, 3.2]) addSeg({ x: px + (ax ? e : 0), z: pz + (ax ? 0 : e), w: 0.18, d: 0.18, y0: 0.22, y1: 3.0, tint: [0.5, 0.4, 0.25], seed: 871, style: 3, dens: 0, flood: 0.5 });
      addNeon(px, 3.45, pz, ax ? 3.2 : 0.12, 0.35, ax ? 0.12 : 3.2, NEON.gold);
      addGlow(px, 2.9, pz, [1.3, 0.9, 0.5], 2.2);
      const sg = makeSignTex(L.name, '#7ff0e6', false);
      const m = new T.Mesh(new T.PlaneGeometry(3.4, 3.4 * sg.H / sg.W), new T.MeshBasicMaterial({ map: sg.t, color: new T.Color(1.2, 1.2, 1.2), side: T.DoubleSide }));
      m.position.set(px, 3.75, pz); m.rotation.y = ax ? 0 : Math.PI / 2; scene.add(m);
    }
    for (let k = 0; k < L.n * 2; k++) {
      const dir = k % 2 ? -1 : 1;
      trams.push({ L, dir, s: (k >> 1) / L.n * len + rand(0, 40), v: rand(8, 10.5), len });
    }
  }
  const rm = new T.Mesh(mergeGeos(rails), railM); rm.frustumCulled = false; scene.add(rm);
  const bm = new T.Mesh(mergeGeos(beds), bedM); bm.frustumCulled = false; scene.add(bm);
  const pole = mergeGeos([new T.CylinderGeometry(0.1, 0.16, 7, 8).translate(0, 3.5, 0), new T.SphereGeometry(0.2, 8, 6).translate(0, 7.05, 0), new T.CylinderGeometry(0.22, 0.22, 0.5, 8).translate(0, 0.25, 0)]);
  const pm = new T.InstancedMesh(pole, MAT.brass, poles.length / 2);
  for (let i = 0; i < poles.length / 2; i++) pm.setMatrixAt(i, _m.makeTranslation(poles[i * 2], 0.2, poles[i * 2 + 1]));
  pm.frustumCulled = false; scene.add(pm);
  const wl = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(wire, 3)), new T.LineBasicMaterial({ color: 0x3a3a3a }));
  wl.frustumCulled = false; scene.add(wl);
  const g = tramGeos();
  tramMesh = new T.InstancedMesh(g.body, paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.35, envI: 0.8 }), trams.length);
  tramWin = new T.InstancedMesh(g.win, new T.MeshBasicMaterial({ color: new T.Color(1.25, 0.86, 0.48) }), trams.length);
  for (const im of [tramMesh, tramWin]) { im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); }
  const pts = [];
  for (let i = 0; i < trams.length; i++) pts.push({ p: [0, 0, 0], c: [1.4, 1.3, 1.0], s: 1.4, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [1.4, 0.15, 0.08], s: 0.8, ph: 0, bl: 0 }, { p: [0, 0, 0], c: [0.4, 1.2, 1.3], s: 0.9, ph: R(), bl: 1 });
  tramLights = makeGlowPoints(pts, true); scene.add(tramLights);
}
function updateTrams(dt) {
  if (!tramMesh) return;
  const pos = tramLights.geometry.attributes.position.array;
  trams.forEach((tr, i) => {
    tr.s = (tr.s + tr.v * dt) % tr.len;
    const L = tr.L, ax = L.axis === 'x';
    const dx = ax ? tr.dir : 0, dz = ax ? 0 : tr.dir;
    const along = tr.dir > 0 ? L.from + tr.s : L.to - tr.s;
    const side = ax ? tr.dir : -tr.dir;
    const x = ax ? along : L.at + side * L.off, z = ax ? L.at + side * L.off : along;
    _q.setFromAxisAngle(_up, Math.atan2(-dz, dx)); _p.set(x, 0.05, z); _s.set(1, 1, 1);
    _m.compose(_p, _q, _s); tramMesh.setMatrixAt(i, _m); tramWin.setMatrixAt(i, _m);
    const o = i * 9;
    pos[o] = x + dx * 7.2; pos[o + 1] = 1.2; pos[o + 2] = z + dz * 7.2;
    pos[o + 3] = x - dx * 7.2; pos[o + 4] = 1.2; pos[o + 5] = z - dz * 7.2;
    pos[o + 6] = x; pos[o + 7] = 5.8; pos[o + 8] = z;
  });
  tramMesh.instanceMatrix.needsUpdate = true; tramWin.instanceMatrix.needsUpdate = true;
  tramLights.geometry.attributes.position.needsUpdate = true;
}

/* ---------- Goldstaub und Brunnenwasser ---------- */
let dust, fountain, fountainData = [], steam;
function buildParticles() {
  const n = 1400, pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos.set([rand(0, 140), rand(0, 140), rand(0, 140)], i * 3); ph[i] = R(); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('phase', new T.BufferAttribute(ph, 1));
  dust = new T.Points(g, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute float phase; uniform float uTime; uniform vec3 uCam; uniform float uScale; varying float vA;
      void main(){ vec3 p = position + vec3(sin(uTime*0.1 + phase*30.0)*3.0, uTime*(0.25 + phase*0.3), cos(uTime*0.08 + phase*20.0)*3.0);
        p = mod(p - uCam + 70.0, 140.0) - 70.0 + uCam;
        vec4 mv = modelViewMatrix*vec4(p,1.0); float d = -mv.z;
        vA = (0.4 + 0.6*sin(uTime*2.0 + phase*60.0)) * smoothstep(70.0, 20.0, d) * smoothstep(0.5, 3.0, d);
        gl_PointSize = clamp(0.22*uScale/max(d,0.1), 1.0, 8.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor = vec4(vec3(1.0,0.8,0.45)*(1.0-r)*vA*0.8, 1.0); }`,
  }));
  dust.frustumCulled = false; scene.add(dust);

  // Dampf aus Gullys und Rohren in den Gassen
  if (steamPts.length) {
    const PER = 7, ns = steamPts.length * PER, sp = new Float32Array(ns * 3), sph = new Float32Array(ns);
    steamPts.forEach((o, i) => { for (let k = 0; k < PER; k++) { sp.set([o.x, 0.3, o.z], (i * PER + k) * 3); sph[i * PER + k] = R(); } });
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('phase', new T.BufferAttribute(sph, 1));
    steam = new T.Points(sg, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: T.NormalBlending,
      vertexShader: `attribute float phase; uniform float uTime; uniform float uScale; varying float vA;
        void main(){ float life = fract(uTime*0.09 + phase); vec3 p = position + vec3(sin(phase*40.0 + uTime*0.3)*(0.5 + life*2.5), life*9.0, cos(phase*30.0 + uTime*0.25)*(0.5 + life*2.5));
          vec4 mv = modelViewMatrix*vec4(p,1.0); float d = -mv.z;
          vA = (1.0 - life) * smoothstep(0.0, 0.15, life) * 0.22 * smoothstep(160.0, 40.0, d) * smoothstep(1.0, 4.0, d);
          gl_PointSize = clamp((1.2 + life*3.5)*uScale/max(d,0.1), 2.0, 180.0); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float r = length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard; gl_FragColor = vec4(vec3(0.55,0.72,0.75), (1.0-r)*(1.0-r)*vA); }`,
    }));
    steam.frustumCulled = false; steam.renderOrder = 3; scene.add(steam);
  }

  const fp = [];
  for (let i = 0; i < 700; i++) {
    const ring = i % 3;
    fountainData.push({ ring, a: R() * Math.PI * 2, t0: R() * 2.4 });
    fp.push({ p: [0, 0, 0], c: ring === 0 ? [0.9, 0.8, 0.55] : [0.4, 0.85, 0.85], s: 0.35, ph: 0, bl: 0 });
  }
  fountain = makeGlowPoints(fp, true); scene.add(fountain);
}
function updateFountain(t) {
  const a = fountain.geometry.attributes.position.array;
  fountainData.forEach((f, i) => {
    const life = f.ring === 0 ? 2.4 : 1.6;
    const tt = (t + f.t0) % life;
    let x, y, z;
    if (f.ring === 0) { const v = 0.6; x = Math.cos(f.a) * v * tt; z = Math.sin(f.a) * v * tt; y = 6.4 + 11 * tt - 4.9 * tt * tt; }
    else { const r0 = f.ring === 1 ? 4 : 11, v = f.ring === 1 ? 1.6 : -2.2; x = Math.cos(f.a) * (r0 + v * tt); z = Math.sin(f.a) * (r0 + v * tt); y = 1.0 + 6 * tt - 4.9 * tt * tt * 1.6; }
    a[i * 3] = x; a[i * 3 + 1] = Math.max(y, 0.9) + 0.26; a[i * 3 + 2] = 95 + z;
  });
  fountain.geometry.attributes.position.needsUpdate = true;
}
