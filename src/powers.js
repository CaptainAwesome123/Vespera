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
import { T, camera, scene, canvasTex } from './core.js';
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
import { ragLift } from './ragdoll.js';

export const POWERS = { tk: null, shake: 0, fov0: 0, fovOn: false, invT: 0, trail: 0, beam: 0, landT: 0,
  // V35: Heldenlandung (kniet, steht auf), kleine Landung (federn), Abheben (in die Knie, dann hinauf), Wurf (ausholen, dann loslassen)
  hero: null, dip: null, takeoff: null, tkWind: 0, tkThrowT: -1 };
const TK_RANGE = 120, _pd = new T.Vector3(), _pv = new T.Vector3(), _pt = new T.Vector3(), _ph = new T.Vector3(), _pr = new T.Vector3();

/* ---------- Fliegen ---------- */
export function startFlight() {
  if (player.fly || DRIVE.on || BOAT.on || DINE.seat) return;
  // V35: vom Boden aus geht er erst tief in die Knie und stößt sich dann mit Wucht ab; aus dem Sprung hebt er sofort ab
  const ground = player.onGround;
  player.fly = true; player.on = null; POWERS.hero = null; POWERS.dip = null;
  POWERS.takeoff = { t: ground ? 0 : TAKEOFF_HOLD, launched: !ground };
  if (!ground) launch(false);
  toast('Alexander fliegt · Leertaste steigen · C sinken · Shift schneller · F landen');
}
const TAKEOFF_HOLD = 0.216, TAKEOFF_T = 0.6;
function launch(ground) {
  const p = player.p;
  player.v.y = Math.max(player.v.y, ground ? 17 : 9);
  fxEmit('snowburst', p.x, p.y + 0.1, p.z, 0, 1.2, 0, ground ? 26 : 12, ground ? 2.2 : 1.2, 0.8);
  fxEmit('crystal', p.x, p.y + 0.4, p.z, 0, 4, 0, ground ? 26 : 16, 0.8);
  if (ground) {
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; fxEmit('snowburst', p.x + Math.cos(a) * 0.5, p.y + 0.1, p.z + Math.sin(a) * 0.5, Math.cos(a) * 7, 0.4, Math.sin(a) * 7, 1, 0.2, 0.7); }
    shockRing(p.x, p.y, p.z, 4.5, 0.6);
    POWERS.shake = Math.min(1.2, POWERS.shake + 0.3); bumpSound('wood', 0.5, 160);
  }
}
// V35: in der Hocke vor dem Abheben hält player.js ihn am Boden
export function takeoffHold() { const T0 = POWERS.takeoff; return !!T0 && !T0.launched; }
export function stopFlight() {
  if (!player.fly) return;
  player.fly = false; POWERS.takeoff = null;
  toast('Zu Fuß');
}
export function toggleFlight() { if (player.fly) stopFlight(); else startFlight(); }

// Landung aus großer Höhe oder schnellem Sinkflug: unverwundbar, der Boden bebt ein wenig
export function superLanding(vImpact) {
  const p = player.p, k = Math.min(1, (vImpact - 14) / 45);
  if (k <= 0 || POWERS.landT > 0) return;
  POWERS.landT = 0.6;
  // V35: Heldenlandung: auf ein Knie, die Faust aufs Pflaster; der Boden reißt sternförmig auf, eine Druckwelle läuft über den Platz
  POWERS.hero = { t: 0, rise: -1, k }; POWERS.dip = null;
  groundCrack(p.x, p.y, p.z, 2.2 + 3.2 * k, k);
  shockRing(p.x, p.y, p.z, 8 + 14 * k, 0.5 + 0.25 * k);
  POWERS.shake = Math.min(1.6, POWERS.shake + 0.6 + 1.0 * k);
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

// V35: jede Landung aus Sprung, Sturz oder Flug. Ab 14 m/s die Heldenlandung, darunter federt er in die Knie
export function landed(vImpact) {
  if (vImpact > 14) { superLanding(vImpact); if (POWERS.hero) return; }
  if (vImpact < 2) return;
  POWERS.dip = { t: 0, k: Math.min(1, (vImpact - 1.5) / 8) };
}
// nach der Heldenlandung: 1 = kniet (keine Bewegung), dann beim Aufstehen weniger. want: der Spieler will losgehen oder springen
export function heroLock(want) {
  const H = POWERS.hero; if (!H) return 0;
  if (H.rise < 0 && H.t > (want ? 0.45 : 1.25)) H.rise = 0;
  return H.rise < 0 ? 1 : 1 - Math.min(1, H.rise / HERO_RISE);
}
const HERO_RISE = 0.6;
// Risse im Boden: Sterne aus gezackten Linien, frisch türkis glimmend (der Kristall), dann nur noch dunkel; nach einigen Sekunden verblassen sie
const CRACKS = { tex: null, list: [], rings: [], geo: null };
function crackTex() {
  if (CRACKS.tex) return CRACKS.tex;
  CRACKS.tex = canvasTex(512, 512, (g, w) => {
    const c = w / 2, rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
    g.clearRect(0, 0, w, w);
    // zertrümmerte Mitte
    const rg = g.createRadialGradient(c, c, 0, c, c, w * 0.16); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(c, c, w * 0.16, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const crack = (x, y, a, len, wd, depth) => {
      g.lineWidth = wd; g.beginPath(); g.moveTo(x, y);
      const n = 6 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        a += (rnd() - 0.5) * 0.7; const l = len / n; x += Math.cos(a) * l; y += Math.sin(a) * l; g.lineTo(x, y);
        if (depth > 0 && rnd() < 0.3) { g.stroke(); crack(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.6), len * (0.3 + rnd() * 0.3), wd * 0.6, depth - 1); g.lineWidth = wd; g.beginPath(); g.moveTo(x, y); }
        wd *= 0.86; g.lineWidth = wd;
      }
      g.stroke();
    };
    for (let i = 0; i < 14; i++) crack(c, c, i / 14 * Math.PI * 2 + rnd() * 0.3, w * (0.26 + rnd() * 0.2), 7 + rnd() * 4, 2);
    // ein Ring von Bruchkanten
    g.lineWidth = 2.5; for (let i = 0; i < 9; i++) { const a0 = rnd() * Math.PI * 2, r = w * (0.14 + rnd() * 0.1); g.beginPath(); g.arc(c, c, r, a0, a0 + 0.4 + rnd() * 0.6); g.stroke(); }
  });
  return CRACKS.tex;
}
function groundCrack(x, y, z, R, k) {
  if (!CRACKS.geo) CRACKS.geo = new T.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  let C = CRACKS.list.length >= 3 ? CRACKS.list.shift() : null;
  if (!C) {
    const mk = (blend, col) => { const m = new T.Mesh(CRACKS.geo, new T.MeshBasicMaterial({ map: crackTex(), color: col, transparent: true, depthWrite: false, blending: blend, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); m.renderOrder = 2; m.frustumCulled = false; scene.add(m); return m; };
    C = { dark: mk(T.NormalBlending, 0x050506), glow: mk(T.AdditiveBlending, 0x5fe8dc) };
  }
  C.t = 0; C.k = k;
  for (const m of [C.dark, C.glow]) { m.position.set(x, y + 0.025, z); m.scale.setScalar(R); m.rotation.y = Math.random() * Math.PI * 2; m.visible = true; }
  CRACKS.list.push(C);
}
// Druckwelle: ein flacher heller Ring, der rasch über den Boden läuft und verblasst
function shockRing(x, y, z, R, life) {
  let S = CRACKS.rings.find(r => !r.m.visible);
  if (!S) {
    const m = new T.Mesh(new T.RingGeometry(0.82, 1, 64).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xbff8f2, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = 3; scene.add(m); S = { m }; CRACKS.rings.push(S);
  }
  S.t = 0; S.R = R; S.life = life; S.m.position.set(x, y + 0.12, z); S.m.scale.setScalar(0.3); S.m.visible = true;
}
function updateCracks(dt) {
  for (const C of CRACKS.list) {
    if (!C.dark.visible) continue;
    C.t += dt;
    C.dark.material.opacity = 0.85 * (1 - Math.min(1, Math.max(0, (C.t - 7) / 2.5)));
    C.glow.material.opacity = (0.4 + 0.6 * C.k) * Math.exp(-C.t * 1.1) * (0.85 + 0.15 * Math.sin(C.t * 30));
    if (C.t > 9.5) C.dark.visible = C.glow.visible = false;
  }
  for (const S of CRACKS.rings) {
    if (!S.m.visible) continue;
    S.t += dt; const u = S.t / S.life;
    S.m.scale.setScalar(0.3 + S.R * (1 - Math.pow(1 - Math.min(1, u), 2.2)));
    S.m.material.opacity = 0.75 * Math.pow(Math.max(0, 1 - u), 1.6);
    if (u >= 1) S.m.visible = false;
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
  // V35: auch Menschen (sanft, sie kommen auf die Füße zurück)
  for (const pd of peds) if (pd.a && pd.a.on && !pd.rag && !pd.sit && !pd.back) { const e = pd.a.m.elements; test(e[12], e[13] + 1.0, e[14], 0.5, () => ({ kind: 'ped', pd })); }
  return best;
}
export function tkGrab() {
  if (POWERS.tk || DRIVE.on || BOAT.on || DINE.seat) return false;
  const a = tkAim();
  if (!a) { toast('Telekinese: nichts im Blick'); return false; }
  if (a.kind === 'ped') {
    const S = ragLift(a.pd);
    if (!S) { toast('Telekinese: gerade nicht'); return false; }
    const minP = (PM.view === 'third' && PM.mesh ? PM.dist : 0) + 2.2;
    POWERS.tk = { kind: 'ped', S, pd: a.pd, dist: Math.max(minP, Math.min(30, a.t)), t: 0 };
    toast('Ein Passant schwebt (er nimmt es mit Humor) · Mausrad näher/weiter · Klick sanft werfen · T absetzen');
    return true;
  }
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
// V35: Werfen: erst holt Alexander aus (das Gehaltene zieht kurz zu ihm heran), dann lässt er es los
export function tkRelease(throwIt) {
  const H = POWERS.tk; if (!H) return;
  if (throwIt) { if (POWERS.tkWind <= 0) { POWERS.tkWind = 0.19; POWERS.tkThrowT = 0; } return; }
  tkLetGo(false);
}
function tkLetGo(throwIt) {
  const H = POWERS.tk; if (!H) return;
  POWERS.tk = null; POWERS.tkWind = 0;
  const d = camera.getWorldDirection(_pd);
  if (H.kind === 'ped') {
    // sanft: die Person sinkt gebremst zu Boden und landet auf den Füßen; geworfen nur ein leichter Bogen
    const S = H.S;
    if (S.busy && S.pd === H.pd && S.ph === 'tk') {
      S.ph = 'drop'; S.t = 0; S.B = { x: player.p.x, z: player.p.z };
      if (throwIt) { const dt = 1 / 60; for (let i = 0; i < S.p.length; i++) { S.q[i][0] = S.p[i][0] - d.x * 7 * dt; S.q[i][1] = S.p[i][1] - (d.y * 7 + 2.5) * dt; S.q[i][2] = S.p[i][2] - d.z * 7 * dt; } }
    }
  } else if (H.kind === 'loose') {
    const B = H.B; LOOSE.tk = null; B.awake = true; B.still = 0;
    if (throwIt) { B.v.copy(d).multiplyScalar(B.m > 40 ? 26 : 38); B.v.y += 2; B.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); }
  } else {
    const B = H.B; B.tk = false; B.still = 0;
    if (throwIt) { B.vx = d.x * 32; B.vz = d.z * 32; B.vy = d.y * 32 + 4; B.w = (Math.random() - 0.5) * 3; B.air = true; }
  }
  if (throwIt) { const c = tkCenter(H); fxEmit('crystal', c.x, c.y, c.z, d.x * 6, d.y * 6, d.z * 6, 16, 0.8); }
}
export function tkToggle() { if (POWERS.tk) tkRelease(false); else tkGrab(); }
export function tkDistance(dy) { const H = POWERS.tk; if (H) H.dist = Math.max(H.kind === 'car' ? 6 : H.kind === 'ped' ? 2.2 : 1.8, Math.min(H.kind === 'ped' ? 40 : 60, H.dist * (dy > 0 ? 1.12 : 1 / 1.12))); }
export function tkCenter(H) { if (H.kind === 'ped') { const c = H.S.p[0]; return _pt.set(c[0], c[1], c[2]); } const B = H.B; return H.kind === 'loose' ? _pt.copy(B.x) : _pt.set(B.x, B.y + 0.75, B.z); }

/* ---------- Jedes Bild (vor den Wagen und den losen Dingen) ---------- */
export function updatePowers(dt, t) {
  POWERS.landT = Math.max(0, POWERS.landT - dt);
  LOOSE.tkAny = !!POWERS.tk;
  const H = POWERS.tk;
  if (H && (DRIVE.on || BOAT.on || DINE.seat || (H.kind === 'car' && (H.B.sunk || !BODIES.has(H.B))) || (H.kind === 'loose' && LOOSE.bodies.indexOf(H.B) < 0)
    || (H.kind === 'ped' && (!H.S.busy || H.S.pd !== H.pd || H.S.ph !== 'tk')))) tkLetGo(false);
  // V35: Ausholen zum Wurf, dann loslassen
  if (POWERS.tkThrowT >= 0) { POWERS.tkThrowT += dt; if (POWERS.tkThrowT > 0.6) POWERS.tkThrowT = -1; }
  if (POWERS.tkWind > 0) { POWERS.tkWind -= dt; if (POWERS.tk) POWERS.tk.dist = Math.max(1.8, POWERS.tk.dist * (1 - dt * 1.2)); if (POWERS.tkWind <= 0) tkLetGo(true); }
  // V35: Landung, Abheben, Risse
  const HL = POWERS.hero;
  if (HL) { HL.t += dt; if (HL.rise < 0 && HL.t > 1.25) HL.rise = 0; if (HL.rise >= 0) { HL.rise += dt; if (HL.rise > HERO_RISE) POWERS.hero = null; } if (player.fly) POWERS.hero = null; }
  if (POWERS.dip) { POWERS.dip.t += dt; if (POWERS.dip.t > 0.5) POWERS.dip = null; }
  const T0 = POWERS.takeoff;
  if (T0) { T0.t += dt; if (!T0.launched && T0.t >= TAKEOFF_HOLD) { T0.launched = true; launch(true); } if (T0.t > TAKEOFF_T || !player.fly) POWERS.takeoff = null; }
  updateCracks(dt);
  if (POWERS.tk) {
    const H2 = POWERS.tk, d = camera.getWorldDirection(_pd);
    H2.t += dt;
    _ph.copy(camera.position).addScaledVector(d, H2.dist);
    if (H2.kind === 'loose') LOOSE.tkTarget.copy(_ph);
    else if (H2.kind === 'ped') { H2.S.tkP.copy(_ph); H2.S.tkYaw = Math.atan2(player.p.x - _ph.x, player.p.z - _ph.z); }
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
    const c = tkCenter(H2), big = H2.kind === 'car' ? 2.2 : H2.kind === 'ped' ? 0.9 : Math.max(0.25, H2.B.r * H2.B.sc);
    POWERS.beam += dt * (H2.kind === 'car' ? 70 : H2.kind === 'ped' ? 55 : 40);
    _pr.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    // V35: der Faden beginnt an Alexanders rechter Hand (von hinten gesehen), in der Ich-Ansicht unten rechts im Bild
    const third = PM.view === 'third' && PM.mesh && PM.show;
    if (third) PM.handWorld(_ph);
    const hx = third ? _ph.x : camera.position.x + _pr.x * 0.25 + d.x * 0.6;
    const hy = third ? _ph.y : camera.position.y - 0.3 + d.y * 0.6;
    const hz = third ? _ph.z : camera.position.z + _pr.z * 0.25 + d.z * 0.6;
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
  // V35: bei der Heldenlandung geht der Blick mit ihm in die Knie
  const hw = PM.heroW || 0; if (hw > 0.001) camera.position.y -= hw * (PM.view === 'third' && PM.show ? 0.35 : 0.85);
  if (POWERS.shake <= 0.001) return;
  const s = POWERS.shake * 0.22;
  camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s;
  POWERS.shake *= Math.exp(-dt * 5);
}
// für Konsole und Tests
Object.assign(POWERS, { startFlight, stopFlight, tkGrab, tkRelease, superLanding, landed, pedList: () => peds });
