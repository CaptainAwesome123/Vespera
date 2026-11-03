/* =====================================================================
   V59 · ENERGIESCHUB: Alexanders Hauptangriff
   Linke Maustaste (ohne etwas zu halten): die Telekinese des Kristalls als
   Stoß. Ein kurzer Klick ist ein Handflächenstoß, abwechselnd rechts und
   links; jeder dritte schnelle Stoß kommt mit beiden Händen und doppelter
   Wucht. Gedrückt halten lädt auf: die Hände sammeln an der Hüfte eine
   türkise Kugel, Funken ziehen hinein, die Luft summt, der Schnee um seine
   Füße hebt sich; loslassen entlädt alles in einem weiten Kegel.
   Getroffen wird, was im Kegel liegt: lose Dinge fliegen davon, Wagen werden
   fortgeschleudert und verbeulen, Passanten fallen um (und stehen wieder
   auf), was fest steht (Bänke, Laternen, Poller, Möbel, Bäume) reißt es
   heraus. Die Leute erschrecken, staunen, ducken sich.
   Hält er etwas mit der Telekinese, schleudert die linke Taste es wie bisher
   (mit einem türkisen Stoß, throwPulse).

   Angriffs-Schnittstelle für spätere Gegner:
     addBlastTarget({ pos(out) -> out (Mitte in Weltkoordinaten), r, hit(h) })
       h = { dir, power, dmg, src, from, kind }   (dmg ~ 10 je Stärke)
     removeBlastTarget(t)
     energyPush(origin, dir, { power, range, cone, rad0, fixed, src, kind })
       trifft alles im Kegel (auch die Ziele oben), gibt die Treffer zurück
     onBlast(fn): fn({ origin, dir, power, kind, hits }) nach jedem Stoß
   Die Pose läuft im Spieler-Shader im Telekinese-Block (people-skeleton.js,
   uPl[7] und uPl[6].yzw), kein zusätzlicher Shader-Durchlauf.
   ===================================================================== */
import { T, camera, scene, canvasTex } from './core.js';
import { player } from './player.js';
import { POWERS, tkAim, groundCrack, shockRing, tearFx } from './powers.js';
import { LOOSE, furnBody, streetBody, tearBody, treeBody, movNear, movWorld, furnInfo, streetNear, streetCenter, treeCenter } from './physics.js';
import { tearNear, tearInfo } from './tear.js';
import { treeNear, peds, parked } from './serpentine.js';
import { BODIES, looseFromTraffic, looseFromParked, crashDamage } from './driving.js';
import { TRF } from './traffic.js';
import { knockDown } from './ragdoll.js';
import { aweBurst } from './awe.js';
import { fxEmit } from './particles.js';
import { PM } from './player-model.js';
import { DRIVE } from './eating.js';
import { BOAT } from './boat.js';
import { DINE } from './venues.js';
import { SND, sndTone, sndBurst, sndClip, crystalChime } from './audio.js';

export const BLAST = {
  st: 'idle', down: false, downT: 0, clock: 0, t: 0, kind: 'right', c: 0, fired: false, combo: 0, lastT: -9,
  // Pose für den Shader (player-model.js writeU): Gewicht, je Hand -1 Hüfte / 0 ausgeholt / 1 gestoßen, Ausfallschritt, Drehung, beidhändig, Aufladen
  w: 0, hR: 0, hL: 0, sx: 0, tw: 0, two: 0, ch: 0,
  aim: new T.Vector3(), dir: new T.Vector3(0, 0, -1), o: new T.Vector3(),
  stats: { shots: 0, hits: 0, last: null },
};
export const BLAST_TARGETS = new Set();
export function addBlastTarget(t) { BLAST_TARGETS.add(t); return t; }
export function removeBlastTarget(t) { BLAST_TARGETS.delete(t); }
const LISTEN = [];
export function onBlast(fn) { LISTEN.push(fn); return () => { const i = LISTEN.indexOf(fn); if (i >= 0) LISTEN.splice(i, 1); }; }

const CHARGE_AFTER = 0.22, CHARGE_FULL = 1.4, COMBO_GAP = 0.9;
// Ablauf je Art (Sekunden): ausholen, stoßen (am Ende trifft es), halten, zurück
const PLAN = {
  right: { wind: 0.09, thrust: 0.07, hold: 0.16, rec: 0.32 },
  left: { wind: 0.09, thrust: 0.07, hold: 0.16, rec: 0.32 },
  both: { wind: 0.13, thrust: 0.08, hold: 0.24, rec: 0.38 },
  charged: { wind: 0.02, thrust: 0.09, hold: 0.36, rec: 0.45 },
};
// Haltung ausgeholt / gestoßen: [hR, hL, Drehung, Ausfallschritt, beidhändig]
const POSE = {
  right: [[0, 0.6, -0.45, -1, 0], [1, -1, 0.3, -1, 0]],
  left: [[0.6, 0, 0.45, 1, 0], [-1, 1, -0.3, 1, 0]],
  both: [[0, 0, -0.4, -1, 1], [1, 1, 0.05, -1, 1]],
  charged: [[0, 0, -0.45, -1, 1], [1, 1, 0.05, -1, 1]],
};
const can = () => !(DRIVE.on || BOAT.on || DINE.seat || POWERS.tk || LOOSE.held);

/* ---------- Eingabe ---------- */
export function blastDown() {
  if (!can()) return false;
  BLAST.down = true; BLAST.downT = 0;
  return true;
}
export function blastUp() {
  const B = BLAST; if (!B.down) return;
  B.down = false;
  if (B.st === 'charge') { strike('charged', Math.min(1, B.ct / CHARGE_FULL)); stopHum(); }
  else blastTap();
}
// ein kurzer Stoß; schnell hintereinander rechts, links, beide
export function blastTap() {
  const B = BLAST; if (!can()) return false;
  if (B.st === 'strike' && !B.fired) return false;   // noch im Ausholen
  B.combo = B.clock - B.lastT < COMBO_GAP ? B.combo + 1 : 0;
  strike(B.combo % 3 === 2 ? 'both' : B.combo % 2 === 0 ? 'right' : 'left', 0);
  return true;
}
function strike(kind, c) {
  const B = BLAST;
  B.st = 'strike'; B.kind = kind; B.c = c; B.t = 0; B.fired = false; B.lastT = B.clock;
  if (kind === 'charged') B.ch = Math.max(B.ch, 0.4 + 0.6 * c);
  quickAim();
}
function startCharge() {
  const B = BLAST;
  B.st = 'charge'; B.ct = 0; B.kind = 'charged';
  startHum();
}
function cancelAll() {
  const B = BLAST;
  if (B.st === 'charge') stopHum();
  B.st = 'idle'; B.down = false;
}

/* ---------- Zielen ---------- */
const _cd = new T.Vector3(), _v = new T.Vector3(), _w = new T.Vector3(), _q = new T.Vector3(), _r = new T.Vector3();
// Punkt im Körperraum der Figur (x links, y oben, z vorn) -> Welt
function bodyPt(x, y, z, out) { return out.set(x, y, z).multiplyScalar(PM.sc).applyQuaternion(PM.q).add(PM.o); }
const third = () => PM.view === 'third' && PM.mesh && PM.show;
// wo die Energie die Hand verlässt
function handOrigin(kind, out) {
  const d = camera.getWorldDirection(_cd);
  if (third()) {
    const sx = kind === 'right' ? -0.19 : kind === 'left' ? 0.19 : 0;
    bodyPt(sx, 1.36, 0.05, out);
    _w.copy(BLAST.aim).sub(out); if (_w.lengthSq() > 1e-4) _w.normalize(); else _w.copy(d);
    return out.addScaledVector(_w, 0.78 * PM.sc);
  }
  _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  const side = kind === 'right' ? 0.22 : kind === 'left' ? -0.22 : 0;
  return out.copy(camera.position).addScaledVector(d, 0.9).addScaledVector(_r, side).add(_q.set(0, -0.28, 0));
}
// billig: entlang des Blicks
function quickAim() { const d = camera.getWorldDirection(_cd); BLAST.aim.copy(camera.position).addScaledVector(d, 40); }
// genau: was im Fadenkreuz liegt (zum Zeitpunkt des Stoßes)
function fullAim() {
  const d = camera.getWorldDirection(_cd), a = tkAim();
  BLAST.aim.copy(camera.position).addScaledVector(d, a && a.t < 90 ? a.t : 45);
  return a;
}

/* ---------- Treffen (auch für spätere Gegner) ---------- */
const _tp = new T.Vector3();
export function energyPush(o, dir, opt = {}) {
  const power = opt.power ?? 1, range = opt.range ?? 30, cone = opt.cone ?? 0.2, rad0 = opt.rad0 ?? 0.8, src = opt.src || 'alexander', kind = opt.kind || 'push';
  const hits = [];
  const inCone = (x, y, z, r) => {
    const vx = x - o.x, vy = y - o.y, vz = z - o.z, t = vx * dir.x + vy * dir.y + vz * dir.z;
    if (t < -r || t > range + r) return -1;
    const R = rad0 + Math.max(0, t) * cone + r;
    return vx * vx + vy * vy + vz * vz - t * t <= R * R ? Math.max(0, t) : -1;
  };
  const fall = t => 1 - 0.6 * Math.min(1, t / range);
  // Gegner und andere angemeldete Ziele
  for (const tg of BLAST_TARGETS) {
    const p = tg.pos(_tp), t = inCone(p.x, p.y, p.z, tg.r || 0.5); if (t < 0) continue;
    const f = power * fall(t);
    try { tg.hit({ dir: dir.clone(), power: f, dmg: 10 * f, src, from: o.clone(), kind }); } catch (e) { console.warn('Energieschub: Ziel', e); }
    hits.push({ kind: 'target', ref: tg, t });
  }
  // lose Dinge
  for (const B of LOOSE.bodies) {
    if (B === LOOSE.held || B === LOOSE.tk) continue;
    const t = inCone(B.x.x, B.x.y, B.x.z, B.r * B.sc); if (t < 0) continue;
    pushLoose(B, dir, power * fall(t)); hits.push({ kind: 'loose', ref: B, t, x: B.x.x, y: B.x.y, z: B.x.z });
  }
  // Wagen: freie Körper zuerst, dann fahrende und parkende (die dabei zu freien Körpern werden)
  const cars = [];
  for (const B of BODIES) if (!(B.player && DRIVE.on) && !B.sunk && !B.tk) { const t = inCone(B.x, B.y + 0.75, B.z, 1.5); if (t >= 0) cars.push([B, t]); }
  for (const c of TRF.cars) if (!c.dyn && !c.gone && c.wx !== undefined) { const t = inCone(c.wx, (c.wy || 0) + 0.75, c.wz, 1.5); if (t >= 0) cars.push([c, t, 'traffic']); }
  for (const c of parked) if (!c.hidden && !c.dyn) { const e = c.m.elements, t = inCone(e[12], e[13] + 0.6, e[14], 1.5); if (t >= 0) cars.push([c, t, 'parked']); }
  for (const [x, t, how] of cars) {
    const B = how === 'traffic' ? looseFromTraffic(x) : how === 'parked' ? looseFromParked(x) : x;
    if (!B) continue;
    pushCar(B, dir, power * fall(t)); hits.push({ kind: 'car', ref: B, t, x: B.x, y: B.y + 0.8, z: B.z });
  }
  // Menschen: fallen um, kommen wieder auf die Füße (höchstens so viele, wie Puppen frei sind; die übrigen erschrecken nur)
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.rag || pd.sit || pd.back) continue;
    const e = pd.a.m.elements, t = inCone(e[12], e[13] + 1, e[14], 0.35); if (t < 0) continue;
    const f = power * fall(t), v = 5 + 3.4 * f;
    if (knockDown(pd, dir.x * v, dir.z * v, o.x, o.z)) hits.push({ kind: 'ped', ref: pd, t, x: e[12], y: e[13] + 1, z: e[14] });
  }
  // was fest steht: das Angezielte, bei aufgeladenen Stößen auch mehr im Kegel
  let nFix = opt.fixed ?? 1;
  const fixed = [];
  const a = opt.aimed;
  if (a && (a.kind === 'furn' || a.kind === 'street' || a.kind === 'tear' || a.kind === 'tree') && a.t < range + 4) fixed.push([a, 0]);
  if (nFix > 1) {
    const R = range * 0.7, near = (x, y, z, r) => inCone(x, y, z, r);
    for (const e of tearNear(o.x, o.z, R)) { const I = tearInfo(e), t = near(I.c.x, I.c.y, I.c.z, 0.5); if (t >= 0) fixed.push([{ kind: 'tear', e }, t]); }
    for (const [p, k] of streetNear(o.x, o.z, R)) { const c = streetCenter(p, k), t = near(p.x, c.y, p.z, c.r); if (t >= 0) fixed.push([{ kind: 'street', p, k }, t]); }
    for (const e of movNear(o.x, o.z, R)) { const W = movWorld(e), I = furnInfo(e), t = near(W.x, W.y + I.cy, W.z, I.r); if (t >= 0) fixed.push([{ kind: 'furn', e }, t]); }
    if (power >= 2.6) for (const [st, p] of treeNear(o.x, o.z, Math.min(R, 30))) { const c = treeCenter(st, p), t = near(c.x, c.y, c.z, c.r); if (t >= 0) fixed.push([{ kind: 'tree', st, p }, t]); }
    fixed.sort((u, v) => u[1] - v[1]);
  }
  const seen = new Set();
  for (const [f, t] of fixed) {
    if (nFix <= 0) break;
    const id = f.e || f.p; if (seen.has(id)) continue; seen.add(id);
    let B = null;
    if (f.kind === 'furn') B = furnBody(f.e); else if (f.kind === 'street') B = streetBody(f.p, f.k); else if (f.kind === 'tear') B = tearBody(f.e); else if (f.kind === 'tree') B = treeBody(f.st, f.p);
    if (!B || B === 'sit') continue;
    nFix--;
    tearFx(B, f.kind === 'tree' ? 2 : Math.min(1.4, 0.5 + B.m / 400));
    pushLoose(B, dir, power * fall(t) * 0.85); hits.push({ kind: 'torn', ref: B, t, x: B.x.x, y: B.x.y, z: B.x.z });
  }
  BLAST.stats.hits += hits.length;
  return hits;
}
function pushLoose(B, dir, k) {
  const dv = Math.min(48, k * 22 / Math.sqrt(Math.max(1, B.m / 8)));
  B.awake = true; B.still = 0;
  B.v.addScaledVector(dir, dv); B.v.y += dv * 0.22 + 1.2;
  const s = Math.min(14, 1 + dv * 0.35);
  B.w.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
}
function pushCar(B, dir, k) {
  const dv = 6.5 * k;
  B.vx += dir.x * dv; B.vz += dir.z * dv; B.vy = Math.max(B.vy || 0, 0.8 * k + Math.max(0, dir.y) * dv);
  B.air = true; B.still = 0; B.w = (B.w || 0) + (Math.random() - 0.5) * 0.9 * k;
  B.pv = (B.pv || 0) + (Math.random() - 0.5) * 0.8 * k; B.rv = (B.rv || 0) + (Math.random() - 0.5) * 1.2 * k;
  try { crashDamage(B, B.x - dir.x * 1.6, B.z - dir.z * 1.6, dv * B.m * 0.6, 0); } catch (e) { /* Beulen sind Zierde */ }
}

/* ---------- der eigentliche Stoß ---------- */
function fire() {
  const B = BLAST, kind = B.kind, c = B.c;
  const a = fullAim();
  handOrigin(kind, B.o);
  B.dir.copy(B.aim).sub(B.o); if (B.dir.lengthSq() < 1e-4) camera.getWorldDirection(B.dir); B.dir.normalize();
  const power = kind === 'charged' ? 2 + 3 * c : kind === 'both' ? 1.7 : 1;
  const range = kind === 'charged' ? 40 + 45 * c : kind === 'both' ? 40 : 32;
  const cone = kind === 'charged' ? 0.2 + 0.16 * c : kind === 'both' ? 0.17 : 0.12;
  const hits = energyPush(B.o, B.dir, { power, range, cone, rad0: kind === 'charged' ? 1.2 : 0.8, fixed: kind === 'charged' ? 1 + Math.round(3 * c) : 1, aimed: a, kind });
  B.stats.shots++; B.stats.last = { kind, power, range, hits: hits.length };
  blastFx(B.o, B.dir, power, range, cone, kind, hits);
  blastSound(kind, power, hits);
  POWERS.shake = Math.min(1.6, POWERS.shake + 0.1 + 0.12 * power);
  // Rückstoß im Flug
  if (player.fly) player.v.addScaledVector(B.dir, -1.5 * power);
  // aufgeladen am Boden: der Boden reißt unter ihm auf, Schnee wirbelt nach außen
  const gy = player.onGround ? player.p.y : null;
  if (kind === 'charged' && gy != null && c > 0.45) {
    groundCrack(player.p.x, gy, player.p.z, 1.6 + 2.4 * c, c);
    shockRing(player.p.x, gy, player.p.z, 5 + 7 * c, 0.45);
  }
  aweBurst('blast', 22 + 9 * power, 0.95);
  for (const fn of LISTEN) try { fn({ origin: B.o.clone(), dir: B.dir.clone(), power, kind, hits }); } catch (e) { console.warn(e); }
}
// V59: geschleuderte Dinge (Linksklick beim Halten) bekommen einen kleinen türkisen Stoß mit
export function throwPulse(c, d, k = 1) {
  ring(c, d, 1.2 + 1.2 * k, 0.3, 0.8);
  beam(c, d, 6 + 6 * k, 0.16, 0.6 * k, 0.32);
  if (SND.ctx && SND.on) { const t = SND.ctx.currentTime; sndTone(200, t, 0.3, 0.12 * k, 'sine', 'sfx', 60); crystalChime(t, 0.01); }
}

/* ---------- Bilder: Kegel, Ringe, Kugel, Funken ---------- */
const FXS = { beams: [], rings: [], tex: null, ring: null, orb: null, halo: null, glow: null };
const TEAL = new T.Color(0.45, 1.9, 1.75), CORE = new T.Color(1.3, 2.2, 2.1);
function streakTex() {
  if (FXS.tex) return FXS.tex;
  FXS.tex = canvasTex(64, 256, (g, w, h) => {
    h = h || 256;
    g.clearRect(0, 0, w, h);
    const rnd = (() => { let x = 11; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
    // Streifen entlang des Kegels, zur Spitze und zum Ende hin weich
    for (let i = 0; i < 46; i++) {
      const x = rnd() * w, y0 = rnd() * h * 0.5, len = h * (0.3 + rnd() * 0.6), a = 0.25 + rnd() * 0.6;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x, y0, 1 + rnd() * 2.5, len);
    }
    const fade = g.createLinearGradient(0, 0, 0, h); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.12, 'rgba(0,0,0,0)'); fade.addColorStop(0.7, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = fade; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
  });
  FXS.tex.wrapS = FXS.tex.wrapT = T.RepeatWrapping;
  return FXS.tex;
}
function orbTex() {
  if (FXS.orbTex) return FXS.orbTex;
  FXS.orbTex = canvasTex(128, 128, (g, w) => {
    const c = w / 2, rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.18, 'rgba(255,255,255,0.85)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.25)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.clearRect(0, 0, w, w); g.fillStyle = rg; g.fillRect(0, 0, w, w);
  });
  return FXS.orbTex;
}
const _Y = new T.Vector3(0, 1, 0), _Z = new T.Vector3(0, 0, 1);
// ein Kegel aus Lichtstreifen: Spitze an der Hand, öffnet sich zum Ziel
function beam(o, d, range, cone, k, life = 0.45) {
  let E = FXS.beams.find(b => !b.on);
  if (!E) {
    if (FXS.beams.length >= 4) E = FXS.beams.reduce((a, b) => (a.t / a.life > b.t / b.life ? a : b));
    else {
      if (!FXS.coneGeo) FXS.coneGeo = new T.ConeGeometry(1, 1, 28, 1, true).translate(0, -0.5, 0).rotateX(Math.PI);
      const mk = (col, op) => { const tx = streakTex().clone(); tx.needsUpdate = true; const m = new T.Mesh(FXS.coneGeo, new T.MeshBasicMaterial({ map: tx, color: col, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); m.frustumCulled = false; m.renderOrder = 5; m.visible = false; m.userData.noRefl = true; scene.add(m); return m; };
      E = { outer: mk(TEAL, 0.7), core: mk(CORE, 1) }; FXS.beams.push(E);
    }
  }
  Object.assign(E, { on: true, t: 0, life, range, cone, k });
  E.q = (E.q || new T.Quaternion()).setFromUnitVectors(_Y, d);
  for (const m of [E.outer, E.core]) { m.position.copy(o); m.quaternion.copy(E.q); m.visible = true; m.material.map.offset.set(Math.random(), 0); }
}
// flacher Ring quer zur Stoßrichtung (Druckwelle in der Luft)
function ring(o, d, R, life, k) {
  let S = FXS.rings.find(r => !r.on);
  if (!S) {
    if (!FXS.ringGeo) FXS.ringGeo = new T.RingGeometry(0.72, 1, 48);
    const m = new T.Mesh(FXS.ringGeo, new T.MeshBasicMaterial({ color: TEAL, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = 5; m.visible = false; m.userData.noRefl = true; scene.add(m); S = { m }; FXS.rings.push(S);
  }
  Object.assign(S, { on: true, t: 0, R, life, k });
  S.m.position.copy(o); S.m.quaternion.setFromUnitVectors(_Z, d); S.m.scale.setScalar(0.2); S.m.visible = true;
}
function orbBuild() {
  if (FXS.orb) return;
  const mk = (col, op) => { const s = new T.Sprite(new T.SpriteMaterial({ map: orbTex(), color: col, transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false })); s.visible = false; s.renderOrder = 6; s.userData.noRefl = true; scene.add(s); return s; };
  FXS.orb = mk(CORE, 1); FXS.halo = mk(TEAL, 0.5);
  FXS.flash = 0; FXS.flashP = new T.Vector3();
}
function blastFx(o, d, power, range, cone, kind, hits) {
  const big = kind === 'charged';
  beam(o, d, range, cone, Math.min(1.6, 0.55 + 0.22 * power), big ? 0.6 : 0.4);
  if (big || kind === 'both') beam(o, d, range * 0.55, cone * 0.45, 0.9, 0.3);
  ring(o, d, 1.2 + 0.5 * power, 0.28, 1);
  _v.copy(o).addScaledVector(d, Math.min(range * 0.3, 10)); ring(_v, d, 2 + 1.2 * power, 0.4, 0.7);
  if (big) { _v.copy(o).addScaledVector(d, Math.min(range * 0.6, 26)); ring(_v, d, 4 + 2 * power, 0.55, 0.5); }
  // Funken entlang des Strahls, schnell davon
  const n = Math.round(14 + 12 * power);
  for (let i = 0; i < n; i++) {
    const u = Math.random() * Math.random(), t = u * range * 0.8, r = (0.8 + t * cone) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
    _w.set(Math.cos(a), Math.sin(a), 0).applyQuaternion(_q4.setFromUnitVectors(_Z, d));
    const s = 18 + Math.random() * 26;
    fxEmit('crystal', o.x + d.x * t + _w.x * r, o.y + d.y * t + _w.y * r, o.z + d.z * t + _w.z * r, d.x * s, d.y * s, d.z * s, 1, 0.3, 1 + power * 0.25);
  }
  fxEmit('crystal', o.x, o.y, o.z, d.x * 6, d.y * 6, d.z * 6, 10 + Math.round(4 * power), 1.2, 1.4);
  // dicht am Boden: der Stoß pflügt eine Schneespur
  const gy = player.onGround ? player.p.y : null;
  if (gy != null && o.y - gy < 2.6) {
    const L = Math.min(range * 0.7, 10 + 6 * power), hz = Math.hypot(d.x, d.z) || 1;
    for (let s = 1; s < L; s += 1.6) {
      const x = o.x + d.x / hz * s, z = o.z + d.z / hz * s, sp = 2 + power;
      fxEmit('snowburst', x, gy + 0.1, z, d.x / hz * 6 - d.z / hz * sp * (Math.random() - 0.5) * 2, 0.8 + Math.random() * 1.5, d.z / hz * 6 + d.x / hz * sp * (Math.random() - 0.5) * 2, 1, 0.4, 0.6 + 0.15 * power);
    }
  }
  // an jedem Treffer: Funken und Staub
  let m = 0;
  for (const h of hits) {
    if (h.x === undefined || m++ > 12) continue;
    fxEmit('crystal', h.x, h.y, h.z, d.x * 5, d.y * 5 + 1, d.z * 5, 10, 1.2, 1);
    fxEmit('dust', h.x, h.y - 0.4, h.z, d.x * 3, 0.6, d.z * 3, h.kind === 'car' ? 6 : 3, 1, h.kind === 'car' ? 1.2 : 0.7);
  }
  orbBuild(); FXS.flash = big ? 1.4 : 0.9; FXS.flashP.copy(o);
}
const _q4 = new T.Quaternion();
function updateFx(dt) {
  for (const E of FXS.beams) {
    if (!E.on) continue;
    E.t += dt; const u = E.t / E.life;
    if (u >= 1) { E.on = false; E.outer.visible = E.core.visible = false; continue; }
    const grow = 1 - Math.pow(1 - Math.min(1, E.t / 0.14), 3), L = Math.max(0.5, E.range * grow), R = 0.25 + L * E.cone;
    const fade = Math.pow(1 - u, 1.6) * E.k;
    E.outer.scale.set(R, L, R); E.core.scale.set(R * 0.4, L * 0.92, R * 0.4);
    E.outer.material.opacity = 0.75 * fade; E.core.material.opacity = Math.min(1, 1.1 * fade);
    E.outer.material.map.offset.y -= dt * 2.6; E.core.material.map.offset.y -= dt * 4.1;
  }
  for (const S of FXS.rings) {
    if (!S.on) continue;
    S.t += dt; const u = S.t / S.life;
    if (u >= 1) { S.on = false; S.m.visible = false; continue; }
    S.m.scale.setScalar(0.2 + S.R * (1 - Math.pow(1 - u, 2.4)));
    S.m.material.opacity = 0.9 * S.k * Math.pow(1 - u, 1.5);
  }
}

/* ---------- Klang ---------- */
const HUM = { nodes: null };
function startHum() {
  const ctx = SND.ctx; if (!ctx || !SND.on || HUM.nodes) return;
  const t = ctx.currentTime, o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  o1.type = 'sine'; o1.frequency.setValueAtTime(82, t); o1.frequency.exponentialRampToValueAtTime(196, t + CHARGE_FULL);
  o2.type = 'sawtooth'; o2.frequency.setValueAtTime(164.5, t); o2.frequency.exponentialRampToValueAtTime(392, t + CHARGE_FULL); o2.detune.value = 7;
  f.type = 'lowpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2600, t + CHARGE_FULL); f.Q.value = 3;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + CHARGE_FULL);
  o1.connect(g); o2.connect(f); f.connect(g); g.connect(SND.bus.sfx);
  o1.start(t); o2.start(t);
  HUM.nodes = { o1, o2, g };
  crystalChime(t + 0.05, 0.012);
}
function stopHum() {
  const N = HUM.nodes; HUM.nodes = null; if (!N || !SND.ctx) return;
  const t = SND.ctx.currentTime;
  N.g.gain.cancelScheduledValues(t); N.g.gain.setTargetAtTime(0.0001, t, 0.03);
  N.o1.stop(t + 0.2); N.o2.stop(t + 0.2);
}
function blastSound(kind, power, hits) {
  const ctx = SND.ctx; if (!ctx || !SND.on) return;
  const t = ctx.currentTime;
  if (kind === 'charged') {
    sndTone(150, t, 0.9, 0.5, 'sine', 'sfx', 30, 0.35); sndTone(75, t, 1.2, 0.3, 'triangle', 'sfx', 28);
    sndBurst(t, 1.1, 650, 0.6, 0.32, 'sfx', 'lowpass', true); sndBurst(t, 0.35, 2400, 0.8, 0.12);
    sndClip('woosh', 0.9, 0.7); crystalChime(t, 0.03);
    if (player.onGround) sndClip('debris', 0.45, 0.8);
  } else {
    const lo = kind === 'both' ? 0.8 : 1;
    sndTone(230 * lo, t, 0.3, kind === 'both' ? 0.3 : 0.22, 'sine', 'sfx', 55 * lo, 0.15);
    sndBurst(t, 0.26, 1500 * lo, 0.9, kind === 'both' ? 0.16 : 0.11);
    sndClip('woosh', 0.6, 1.15 + Math.random() * 0.25); crystalChime(t, 0.012);
  }
  // Treffer: dumpfe Schläge, Blech bei Wagen
  let nc = 0, nl = 0;
  for (const h of hits) { if (h.kind === 'car') nc++; else if (h.kind !== 'target') nl++; }
  const delay = 0.06 + Math.min(0.25, (hits[0] ? hits[0].t : 10) / 120);
  if (nc) setTimeout(() => sndClip('metal', Math.min(0.8, 0.35 + 0.15 * nc), 0.8), delay * 1000);
  if (nl) setTimeout(() => sndClip('thud', Math.min(0.8, 0.3 + 0.08 * nl), 0.9), delay * 1000);
}

/* ---------- jedes Bild (nach updatePowers) ---------- */
const ease = (cur, want, rate, dt) => cur + (want - cur) * Math.min(1, dt * rate);
export function updateEnergy(dt) {
  const B = BLAST;
  B.clock += dt;
  if (!can() && B.st !== 'idle') cancelAll();
  if (B.down) { B.downT += dt; if (B.st !== 'charge' && B.downT > CHARGE_AFTER && can() && (B.st === 'idle' || B.fired)) startCharge(); }
  let tgt = null, rate = 18, wWant = 0;
  if (B.st === 'charge') {
    B.ct += dt; B.ch = Math.min(1, B.ct / CHARGE_FULL);
    tgt = POSE.charged[0]; wWant = 1; quickAim();
    chargeFx(dt);
  } else if (B.st === 'strike') {
    const P = PLAN[B.kind];
    B.t += dt;
    const t1 = P.wind, t2 = t1 + P.thrust, t3 = t2 + P.hold, t4 = t3 + P.rec;
    tgt = POSE[B.kind][B.t < t1 ? 0 : 1]; rate = B.t < t1 ? 22 : 34;
    wWant = B.t < t3 ? 1 : 0;
    if (!B.fired && B.t >= t2 - 0.02) { B.fired = true; fire(); }
    if (B.kind !== 'charged') B.ch = ease(B.ch, 0, 8, dt);
    else if (B.fired) B.ch = ease(B.ch, 0, 3, dt);
    if (B.t >= t4) B.st = 'idle';
  } else B.ch = ease(B.ch, 0, 6, dt);
  B.w = ease(B.w, wWant, wWant ? 20 : 5.5, dt); if (B.w < 0.002 && !wWant) B.w = 0;
  if (tgt) {
    B.hR = ease(B.hR, tgt[0], rate, dt); B.hL = ease(B.hL, tgt[1], rate, dt); B.tw = ease(B.tw, tgt[2], rate * 0.7, dt);
    B.sx = ease(B.sx, tgt[3], 14, dt); B.two = ease(B.two, tgt[4], 16, dt);
  }
  updateFx(dt);
  updateOrb(dt);
}
// Aufladen: Kugel zwischen den Händen, Funken ziehen hinein, Schnee hebt sich, ein leises Beben bei voller Ladung
const _orbP = new T.Vector3();
function orbPos(out) {
  if (third()) return bodyPt(-0.16, 1.12, 0.3, out);
  const d = camera.getWorldDirection(_cd); _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  return out.copy(camera.position).addScaledVector(d, 0.75).addScaledVector(_r, 0.12).add(_q.set(0, -0.32, 0));
}
let chargeAcc = 0;
function chargeFx(dt) {
  const B = BLAST, ch = B.ch, o = orbPos(_orbP);
  chargeAcc += dt * (30 + 70 * ch);
  while (chargeAcc > 1) {
    chargeAcc -= 1;
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), r = 0.7 + Math.random() * 0.7;
    const x = Math.sin(b) * Math.cos(a) * r, y = Math.cos(b) * r * 0.7, z = Math.sin(b) * Math.sin(a) * r;
    fxEmit('crystal', o.x + x, o.y + y, o.z + z, -x * 2.6 - z * 1.2, -y * 2.6, -z * 2.6 + x * 1.2, 1, 0.02, 0.7 + 0.5 * ch);
  }
  if (ch > 0.5 && player.onGround && Math.random() < dt * 14 * ch) {
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.6, p = player.p;
    fxEmit('snowburst', p.x + Math.cos(a) * r, p.y + 0.05, p.z + Math.sin(a) * r, -Math.sin(a) * 1.5, 0.6 + Math.random() * 0.8 * ch, Math.cos(a) * 1.5, 1, 0.2, 0.5);
  }
  if (ch >= 1) POWERS.shake = Math.max(POWERS.shake, 0.06);
}
function updateOrb(dt) {
  const B = BLAST;
  if (!FXS.orb && B.st !== 'charge') return;
  orbBuild();
  const O = FXS.orb, H = FXS.halo;
  FXS.flash = Math.max(0, FXS.flash - dt * 5);
  if (B.st === 'charge') {
    const ch = B.ch, p = orbPos(_orbP), fl = 0.85 + 0.15 * Math.sin(B.clock * 37) + 0.08 * Math.sin(B.clock * 23);
    O.position.copy(p); H.position.copy(p);
    O.scale.setScalar((0.16 + 0.32 * ch) * fl); H.scale.setScalar((0.5 + 1.3 * ch) * fl);
    O.material.opacity = 0.6 + 0.4 * ch; H.material.opacity = 0.25 + 0.45 * ch;
    O.visible = H.visible = true;
  } else if (FXS.flash > 0) {
    const f = FXS.flash; O.position.copy(FXS.flashP); H.position.copy(FXS.flashP);
    O.scale.setScalar(0.35 * f + 0.1); H.scale.setScalar(1.8 * f);
    O.material.opacity = Math.min(1, f); H.material.opacity = Math.min(0.7, 0.5 * f);
    O.visible = H.visible = true;
  } else O.visible = H.visible = false;
}

// für Konsole, Tests und Labor
export function energyLabFx(o, d, kind = 'charged', c = 1, t = 0.08) {
  const power = kind === 'charged' ? 2 + 3 * c : kind === 'both' ? 1.7 : 1, range = kind === 'charged' ? 40 + 45 * c : 32, cone = kind === 'charged' ? 0.2 + 0.16 * c : 0.12;
  blastFx(o, d, power, range, cone, kind, []);
  updateFx(t); FXS.flash = 0;
}
export function energyLabOrb(p, ch) {
  orbBuild(); const O = FXS.orb, H = FXS.halo;
  O.position.copy(p); H.position.copy(p); O.scale.setScalar(0.16 + 0.32 * ch); H.scale.setScalar(0.5 + 1.3 * ch);
  O.material.opacity = 0.6 + 0.4 * ch; H.material.opacity = 0.25 + 0.45 * ch; O.visible = H.visible = true;
}
Object.assign(BLAST, { tap: blastTap, push: energyPush, addTarget: addBlastTarget, removeTarget: removeBlastTarget, onBlast, fire: (kind = 'right', c = 1) => strike(kind, c) });
