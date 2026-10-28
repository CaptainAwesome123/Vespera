'use strict';
/* =====================================================================
   V16 · BOOT FAHREN: an einem Mahagoni-Runabout im Jachthafen E drücken.
   Schub, Ruder, Gleitfahrt (Bug hebt sich), Seitendrift, Wind und Wellen;
   Bugwelle, Gischt und Kielwasser; Anlegen am Steg zum Aussteigen
   ===================================================================== */
const BOAT = { on: false, v: null, x: 0, z: 0, h: 0, u: 0, s: 0, r: 0, thr: 0, rud: 0, y: 0, pitch: 0, roll: 0, py: 0, pv: 0, camP: null, lookT: 0, hit: 0, driver: null, slam: 0 };
const BP = { m: 1700, I: 5200, thrust: 15500, hl: 4.0, hw: 1.1 };
function nearRunabout(p) {
  let best = null, bd = 1e9;
  for (const v of VESSELS) {
    if (v.L !== 8.4 || (v.kind !== 'moored' && v.kind !== 'player')) continue;
    const d = Math.hypot(v.g.position.x - p.x, v.g.position.z - p.z);
    if (d < bd && d < 6.5) { bd = d; best = v; }
  }
  return best;
}
function boatEnter(v) {
  if (DRIVE.on) driveExit();
  initCarAudio();
  BOAT.on = true; BOAT.v = v; v.kind = 'player';
  const g = v.g; BOAT.x = g.position.x; BOAT.z = g.position.z; BOAT.h = g.rotation.y; BOAT.u = BOAT.s = BOAT.r = 0; BOAT.thr = 0; BOAT.rud = 0; BOAT.camP = null;
  player.fly = false; player.on = null; player.v.set(0, 0, 0);
  player.yaw = BOAT.h - Math.PI / 2; player.pitch = -0.12;
  toast(isTouch ? 'Am Ruder · zum Aussteigen an einen Steg fahren' : 'Am Ruder · W/S Gas und Rückwärts · A/D Ruder · E am Steg aussteigen');
}
function boatExit() {
  if (!BOAT.on) return;
  // freie Stelle auf einem Steg oder am Kai in der Nähe suchen
  let best = null, bd = 1e9;
  for (const b of nearBoxes(BOAT.x, BOAT.z, 9)) {
    if (b.y1 < PIER_Y - 0.1 || b.y1 > 0.4 || b.y0 > PIER_Y) continue;
    const px = Math.max(b.x0 + 0.4, Math.min(b.x1 - 0.4, BOAT.x)), pz = Math.max(b.z0 + 0.4, Math.min(b.z1 - 0.4, BOAT.z));
    const d = Math.hypot(px - BOAT.x, pz - BOAT.z); if (d < bd) { bd = d; best = [px, b.y1, pz]; }
  }
  if (!best || bd > 6) { toast('Zum Aussteigen an einen Steg oder an die Kaitreppe fahren'); return; }
  BOAT.on = false; BOAT.v.kind = 'moored'; BOAT.u = BOAT.s = BOAT.r = 0;
  player.p.set(best[0], best[1] + 0.02, best[2]); player.v.set(0, 0, 0); player.pitch = 0;
  toast('Angelegt und ausgestiegen');
}
function boatInteractions() {
  INTERACT.unshift({ test: () => BOAT.on, label: 'Am Steg aussteigen', act: boatExit });
  INTERACT.push({ test: p => !BOAT.on && !DRIVE.on && p.y < 1 && p.z > 530 && !!(BOAT.pick = nearRunabout(p)), label: 'Ans Ruder · Boot fahren', act: () => boatEnter(BOAT.pick) });
}
function updateBoatInput(dt) {
  if (player.fly) { player.fly = false; }
  const up = (keys.KeyW || keys.ArrowUp ? 1 : 0) + Math.max(0, touch.my), dn = (keys.KeyS || keys.ArrowDown ? 1 : 0) + Math.max(0, -touch.my);
  const st = Math.max(-1, Math.min(1, (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.mx));
  // Gashebel: rastet nicht, folgt der Taste mit etwas Verzögerung; rückwärts nur langsam
  const tgt = up > 0.1 ? Math.min(1, up) * (keys.ShiftLeft || keys.ShiftRight ? 1 : 0.85) : dn > 0.1 ? -0.4 * Math.min(1, dn) : 0;
  BOAT.thr += Math.max(-dt * 0.9, Math.min(dt * 0.6, tgt - BOAT.thr));
  BOAT.rud += Math.max(-dt * 2.2, Math.min(dt * 2.2, -st * 0.6 - BOAT.rud));
}
// Physik in Teilschritten
function stepBoat(dt) {
  const B = BOAT, fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  let u = B.u, s = B.s, r = B.r;
  // Widerstand: Verdränger bis zum Buckel um 6 m/s, dann gleitet der Rumpf auf und wird leichter
  const plane = Math.max(0, Math.min(1, (Math.abs(u) - 5) / 4));
  const cx = 230 - 150 * plane;
  let Fx = BP.thrust * B.thr * (B.thr < 0 ? 0.55 : 1) - cx * u * Math.abs(u) - 60 * u;
  let Fs = -2600 * s - 420 * s * Math.abs(s);
  // Ruder wirkt mit der Fahrt und im Schraubenwasser
  const flow = u * Math.abs(u) * 380 + B.thr * 5200;
  let M = B.rud * flow - r * (2500 + Math.abs(u) * 3000);
  // Wind: Windangriff auf Rumpf und Aufbauten
  const [wx, wz] = windAt(B.x, B.z, 2), ru = wx * fx + wz * fz - u, rs = wx * lx + wz * lz - s;
  Fx += 12 * ru * Math.abs(ru); Fs += 30 * rs * Math.abs(rs); M += 6 * rs * Math.abs(rs);
  u += (Fx / BP.m + s * r) * dt; s += (Fs / BP.m - u * r) * dt; r += M / BP.I * dt;
  B.u = u; B.s = s; B.r = r;
  B.x += (u * fx + s * lx) * dt; B.z += (u * fz + s * lz) * dt; B.h += r * dt;
}
// Ufer, Stege, andere Boote
function collideBoat() {
  const B = BOAT, body = { x: B.x, z: B.z, h: B.h, hl: BP.hl, hw: BP.hw, vx: 0, vz: 0, w: B.r, m: BP.m, I: BP.I };
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  body.vx = B.u * fx + B.s * lx; body.vz = B.u * fz + B.s * lz;
  let hit = 0;
  // Ufer: Messpunkte an Bug, Heck und Seiten gegen Insel und Berghang
  const shoreAt = (x, z) => { const ld = landDist(x, z); if (ld > -0.6) return 0.6 + ld; const th = terrainHeight(x, z); return th > WATER_Y - 0.6 ? th - WATER_Y + 0.6 : 0; };
  for (const [a, l] of [[BP.hl, 0], [-BP.hl, 0], [0, BP.hw], [0, -BP.hw], [BP.hl * 0.6, BP.hw * 0.8], [BP.hl * 0.6, -BP.hw * 0.8]]) {
    const px = B.x + fx * a + lx * l, pz = B.z + fz * a + lz * l, pen = shoreAt(px, pz);
    if (pen <= 0) continue;
    const e = 1.5, gx = shoreAt(px + e, pz) - shoreAt(px - e, pz), gz = shoreAt(px, pz + e) - shoreAt(px, pz - e), gl = Math.hypot(gx, gz) || 1;
    const nx = -gx / gl, nz = -gz / gl, d = Math.min(1.2, pen);
    body.x += nx * d; body.z += nz * d;
    const j = impulse(body, null, nx, nz, px, pz, 0.15); if (j > 0) hit = Math.max(hit, j / BP.m);
  }
  // Pfähle und Stege
  for (const b of nearBoxes(B.x, B.z, 6)) {
    if (b.y1 < WATER_Y - 0.4 || b.y0 > WATER_Y + 0.9) continue;
    const c = obbAabb(body, b); if (!c) continue;
    body.x += c.nx * c.d; body.z += c.nz * c.d;
    const j = impulse(body, null, c.nx, c.nz, c.px, c.pz, 0.2); if (j > 0) hit = Math.max(hit, j / BP.m);
  }
  // andere Boote und die Fähre (schwer, geben kaum nach)
  for (const v of VESSELS) {
    if (v === B.v || !v.g.visible) continue;
    const o = { x: v.g.position.x, z: v.g.position.z, h: v.g.rotation.y, hl: v.L / 2, hw: v.B / 2, vx: 0, vz: 0, w: 0, m: v.L > 20 ? 1e6 : 6000, I: 1e7 };
    if ((o.x - body.x) ** 2 + (o.z - body.z) ** 2 > (o.hl + 6) ** 2) continue;
    const c = obbObb(body, { ...o, hl: Math.min(o.hl, 3 + o.hl), hw: o.hw }); if (!c) continue;
    const nx = -c.nx, nz = -c.nz; body.x += nx * c.d; body.z += nz * c.d;
    const j = impulse(body, o, nx, nz, c.px, c.pz, 0.25); if (j > 0) hit = Math.max(hit, j / BP.m);
  }
  B.x = body.x; B.z = body.z; B.r = body.w;
  B.u = body.vx * fx + body.vz * fz; B.s = body.vx * lx + body.vz * lz;
  if (hit > 1.2) { carCrashSound(Math.min(1, hit / 6), 0.3); fxEmit('spray', B.x + fx * BP.hl, WATER_Y + 0.4, B.z + fz * BP.hl, 0, 2.5, 0, 12, 1.2); B.shake = Math.min(1, (B.shake || 0) + hit * 0.1); }
}
function updateBoat(dt) {
  if (!BOAT.on) return;
  const B = BOAT, v = B.v, t = U.uTime.value;
  const n = Math.max(1, Math.ceil(dt / (1 / 90)));
  for (let k = 0; k < n; k++) { stepBoat(dt / n); }
  collideBoat();
  // Lage im Wasser: Wellen + Trimm in Gleitfahrt + Krängung in der Kurve
  const P = floatPose(B.x, B.z, B.h, v.L, v.B, t), sp = Math.abs(B.u);
  const hump = Math.exp(-((sp - 6) ** 2) / 8) * 0.09, trim = Math.min(0.06, Math.max(0, sp - 3) * 0.012) + hump;
  const tp = P.pitch * (1 - Math.min(0.6, sp / 15)) + trim, tr = P.roll * 0.8 - B.r * B.u * 0.012;
  B.pv += ((tp - B.pitch) * 40 - B.pv * 7) * dt; B.pitch += B.pv * dt;
  B.roll += (tr - B.roll) * Math.min(1, dt * 3);
  // Aufsetzen auf Wellenkämme in schneller Fahrt
  const ty = P.y + Math.min(0.25, sp * 0.015);
  if (sp > 7 && P.pitch < -0.03 && Math.random() < dt * 2) { B.pv += 0.4 + Math.random() * 0.3; B.slam = 1; }
  B.y += (ty - B.y) * Math.min(1, dt * 6);
  const g = v.g; g.position.set(B.x, WATER_Y + B.y, B.z); g.rotation.y = B.h;
  v.body.rotation.z = B.pitch; v.body.rotation.x = B.roll;
  pfRead(v.pf);
  player.p.set(B.x, WATER_Y + B.y + 0.8, B.z);
  // Kielwasser in der letzten Spur des Wasser-Shaders
  U.uWake.value[3].set(B.x, B.z, -B.h, sp);
  U.uWakeL.value[3] = v.L;
  // Bugwelle, Gischt, Schaum am Heck
  const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h);
  if (sp > 2.5 && Math.random() < dt * sp * 3) for (const sd of [-1, 1]) fxEmit('spray', B.x + fx * 2.6 + lx * sd * 0.9, WATER_Y + B.y + 0.1, B.z + fz * 2.6 + lz * sd * 0.9, (fx * 0.3 + lx * sd) * sp * 0.25, 1.2 + sp * 0.12, (fz * 0.3 + lz * sd) * sp * 0.25, 1, 0.4, 0.7);
  if (B.slam > 0) { fxEmit('spray', B.x + fx * 3, WATER_Y + B.y + 0.3, B.z + fz * 3, 0, 3, 0, 18, 1.8, 1.2); B.slam = 0; }
  if (Math.abs(B.thr) > 0.1 && Math.random() < dt * 14) fxEmit('foam', B.x - fx * 4.3, WATER_Y + B.y + 0.05, B.z - fz * 4.3, -fx * B.u * 0.2, 0, -fz * B.u * 0.2, 1, 0.8, 0.9);
  B.shake = Math.max(0, (B.shake || 0) - dt * 2);
}
function boatCamera() {
  const B = BOAT;
  if ((B.lookT -= 1 / 60) <= 0) {
    let want = B.h - Math.PI / 2 + (B.u < -0.5 ? Math.PI : 0), cur = player.yaw;
    while (want - cur > Math.PI) want -= Math.PI * 2; while (want - cur < -Math.PI) want += Math.PI * 2;
    player.yaw = cur + (want - cur) * Math.min(1, (1 / 60) * 2.2);
    player.pitch += (-0.12 - player.pitch) * Math.min(1, (1 / 60) * 1.5);
  }
  const yaw = player.yaw, pitch = Math.max(-0.7, Math.min(0.35, player.pitch)), back = 11 + Math.abs(B.u) * 0.12;
  const fx = -Math.sin(yaw) * Math.cos(pitch), fz = -Math.cos(yaw) * Math.cos(pitch), fy = Math.sin(pitch);
  const tx = B.x - fx * back, ty = WATER_Y + B.y + 3.2 - fy * back, tz = B.z - fz * back;
  if (!B.camP) B.camP = new T.Vector3(tx, ty, tz);
  B.camP.lerp(_wv.set(tx, ty, tz), 0.25);
  camera.position.copy(B.camP); camera.position.y = Math.max(camera.position.y, WATER_Y + 1.2 + waterH(camera.position.x, camera.position.z));
  const sh = (B.shake || 0) ** 2 * 0.3;
  camera.rotation.set(pitch + (Math.random() - 0.5) * sh * 0.2 + B.pitch * 0.3, yaw, B.roll * 0.3 + (Math.random() - 0.5) * sh * 0.1);
}

/* ---------- Aussichtspunkte ---------- */
const VIEWS = {
  Digit1: { name: 'Belmont-Platz', p: [0, 0.26, 120], yaw: 0, pitch: 0.22, fly: false },
  Digit2: { name: 'Ballsaal-Terrasse', p: [0, BEL.s2, 22.5], yaw: Math.PI, pitch: -0.12, fly: false },
  Digit3: { name: 'Hafenpromenade', p: [60, 0.26, 520], yaw: 0.12, pitch: 0.3, fly: false },
  Digit4: { name: 'Am Ankermast', p: [150, 405, 180], yaw: Math.atan2(150, 180), pitch: -0.05, fly: true },
  Digit5: { name: 'Bergvilla', get p() { return [VILLA.x + VILLA.ux * 88, VILLA.y - 17 + 0.1, VILLA.z + VILLA.uz * 88]; }, get yaw() { return Math.atan2(VILLA.ux, VILLA.uz); }, pitch: 0.12, fly: false },
  Digit7: { name: 'The Belmont · Lobby', p: [0, 0.26, 44], yaw: 0, pitch: 0.08, fly: false },
  Digit8: { name: 'Der große Ballsaal', p: [44.5, 8.0, -14], yaw: 0.93, pitch: -0.2, fly: false },
  Digit6: { name: 'Tunnelportal · Die Straße nach Vespera', get p() { return [-4, deckY(VIA.portalZ + 14) + 0.1, VIA.portalZ + 14]; }, yaw: Math.PI, pitch: -0.06, fly: false },
};
function goView(code) {
  const v = VIEWS[code]; if (!v) return;
  driveExit();
  player.p.set(...v.p); player.v.set(0, 0, 0); player.yaw = v.yaw; player.pitch = v.pitch; player.fly = v.fly;
  toast(v.name);
}

/* ---------- Stadtviertel ---------- */
function districtAt(x, z, y) {
  if (inBelmont(x, z, y)) return z > -5 ? ['The Belmont · Lobby', 'Grand Hotel seit 1912'] : ['Der große Ballsaal', 'Jazz, Champagner und Tanz'];
  if (y > 200 && Math.hypot(x, z) < 60) return ['Turm des Belmont', 'Grand Hotel · ' + Math.round(y) + ' m'];
  if (inRect(x, z, PLAZA, 2)) return ['Belmont-Platz', 'Grand Hotel The Belmont'];
  if (z > 500) return ['Hafenpromenade', 'Am Abendmeer'];
  if (Math.hypot(x - VILLA.x, z - VILLA.z) < 160) return ['Bergvilla', 'Hoch über Vespera'];
  if (z < VIA.portalZ + 2 && Math.abs(x) < 10 && y < deckY(z) + 12) return ['Der Tunnel', 'Durch den Berg zur Außenwelt'];
  if (z < -990 && Math.abs(x) < 30) return ['Der große Viadukt', 'Die einzige Straße nach Vespera'];
  if (z < -1000) return ['Die Berge', 'Rund um den Kessel'];
  if (x > 690 && z < 430 && Math.hypot(x, z) > 650) return ['Industriegebiet Ost', 'Fabriken, Laufkräne und rauchende Schlote'];
  if (Math.hypot(x, z) > 680 && z < 450) return ['Arbeiterviertel', 'Werkstätten, Dampf und The Brass Lantern'];
  if (Math.abs(x) < 24 && z > 133) return ['Grande Promenade', 'Boulevard der Bälle'];
  if (z > 300) return [x < 0 ? 'Lichterviertel West' : 'Lichterviertel Ost', 'Revuen und Varietés'];
  if (x < -330) return ['Theaterviertel', 'Odeon · Orpheum · Lumière'];
  if (x > 330) return ['Börsenviertel', 'Banken und Handelshäuser'];
  if (z < -450) return ['Observatoriumsviertel', 'Gärten und Sternwarten'];
  return ['Salonviertel', 'Cafés, Salons und Ateliers'];
}
let lastDistrict = '';
let districtTimer = 0;
function showDistrict(d) {
  const el = $('district');
  el.innerHTML = '';
  el.append(d[0]); const s = document.createElement('small'); s.textContent = d[1]; el.append(s);
  el.style.opacity = 1; districtTimer = 4.5;
}
let toastTimer = 0;
function toast(text) { const t = $('toast'); t.textContent = text; t.style.opacity = 1; toastTimer = 2.4; }

/* ---------- Karte ---------- */
const mapBase = document.createElement('canvas');
function buildMap() {
  mapBase.width = mapBase.height = 1400;
  const g = mapBase.getContext('2d'), s = 1400 / 2400, X = x => (x + 1200) * s, Z = z => (z + 1100) * s;
  g.fillStyle = '#0b1830'; g.fillRect(0, 0, 1400, 1400);
  g.fillStyle = '#16261f'; g.beginPath(); COAST.forEach(([x, z], k) => k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.closePath(); g.fill();
  g.strokeStyle = '#2a2433'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const e of NET.edges) { g.lineWidth = e.w * s; g.beginPath(); e.pts.forEach(([x, z], k) => k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); }
  g.fillStyle = '#4a3f58'; for (const h of OUTER.plots) { g.beginPath(); obbCorners(h).forEach(([x, z], k) => k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.closePath(); g.fill(); }
  g.strokeStyle = '#5a5040'; g.lineWidth = 2; for (const P of OUTER.paths) { g.beginPath(); P.forEach(([x, z], k) => k ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); }
  for (const b of blocks) { g.fillStyle = b.park ? '#1d3a30' : '#3b3348'; g.fillRect(X(b.x0), Z(b.z0), (b.x1 - b.x0) * s, (b.z1 - b.z0) * s); }
  g.fillStyle = '#5a4a62';
  for (const sg of segs) if (sg.y0 < 1 && sg.flood === 0) g.fillRect(X(sg.x - sg.w / 2), Z(sg.z - sg.d / 2), sg.w * s, sg.d * s);
  g.fillStyle = '#4a3c2a'; g.fillRect(X(PLAZA.x0), Z(PLAZA.z0), 198 * s, 266 * s);
  g.fillStyle = '#d9b26a'; g.fillRect(X(-50), Z(-50), 100 * s, 100 * s);
  g.fillStyle = '#1d3a30'; g.fillRect(X(MEDIAN.x0), Z(MEDIAN.z0), 16 * s, (MEDIAN.z1 - MEDIAN.z0) * s);
  g.fillStyle = '#8a7a5a'; g.fillRect(X(-7), Z(VIA.portalZ), 14 * s, (ROAD_Z0 - VIA.portalZ) * s);
  g.strokeStyle = '#4fb8b0'; g.lineWidth = 3;
  for (const L of TRAM_LINES) { g.beginPath(); if (L.axis === 'x') { g.moveTo(X(L.from), Z(L.at)); g.lineTo(X(L.to), Z(L.at)); } else { g.moveTo(X(L.at), Z(L.from)); g.lineTo(X(L.at), Z(L.to)); } g.stroke(); }
}
function drawMap() {
  const c = $('map'), g = c.getContext('2d'), W = c.width, s = 1400 / 2400;
  const span = 520, px = (player.p.x + 1200) * s, pz = (player.p.z + 1100) * s, half = span * s / 2;
  g.clearRect(0, 0, W, W);
  g.drawImage(mapBase, px - half, pz - half, half * 2, half * 2, 0, 0, W, W);
  g.save(); g.translate(W / 2, W / 2); g.rotate(-player.yaw);
  g.fillStyle = '#f6dc9a'; g.beginPath(); g.moveTo(0, -12); g.lineTo(7, 8); g.lineTo(0, 4); g.lineTo(-7, 8); g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#d9b26a'; g.font = '600 18px "Josefin Sans", sans-serif'; g.textAlign = 'center'; g.fillText('N', W / 2, 22);
}
