/* =====================================================================
   V24 · SPIELERMODELL UND THIRD-PERSON-ANSICHT
   Der Spieler als eigene Figur (MakeHuman-Herrenkörper mit eigenem Gesicht nach
   den Referenzbildern, blondes Haar mit Seitenscheitel, Frack, Fliege, weiße Rose).
   Sie läuft mit demselben Skelett im Shader wie alle Menschen der Stadt: Gehen,
   Laufen, Springen, Stehen mit kleinen Gesten, Tanzen (Taste G).
   Taste V wechselt zwischen Ich-Ansicht und Ansicht von hinten über die Schulter;
   das Mausrad ändert den Abstand. Im Wagen, am Ruder, im Flug und am Tisch
   bleibt alles wie bisher.
   ===================================================================== */
import { T, scene, camera } from './core.js';
import { MAT, PL_U } from './people-skeleton.js';
import { POWERS, tkCenter } from './powers.js';
import { personShare } from './people-model.js';
import { MHP } from './people-mh.js';
import { player } from './player.js';
import { nearBoxes } from './people-skeleton.js';
import { LOOSE } from './physics.js';

// Aussehen in einer Zahl (wie personLook): Gesicht 5 (haselnussbraune Augen), heller Hautton, blondes Haar, ohne Hut
const PLAYER_LOOK = 5 + 64 * 0 + 320 * 2 + 7680 * 2;
export const PM = {
  mesh: null, show: false, view: 'first', dist: 2.7, distT: 2.7, dance: 0, yawB: 0, phase: 0, seed: 0.37, air: 0,
  gait: null, live: null, sc: 1.02,
  q: new T.Quaternion(), o: new T.Vector3(), heroW: 0,
};
try { if (localStorage.getItem('vespera.view') === 'third') PM.view = 'third'; } catch {}

export function buildPlayerModel() {
  if (!MHP.ready || PM.mesh) return;
  const geo = personShare('player', 2);
  const ga = PM.gait = new T.InstancedBufferAttribute(new Float32Array([PM.seed, 0, 0, PLAYER_LOOK]), 4);
  const li = PM.live = new T.InstancedBufferAttribute(new Float32Array([0, 0, 1, 1.15]), 4);
  ga.setUsage(T.DynamicDrawUsage); li.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('aGait', ga); geo.setAttribute('aLive', li);
  const im = PM.mesh = new T.InstancedMesh(geo, MAT.clothPlayer, 1);
  im.setColorAt(0, new T.Color(0.025, 0.025, 0.03)); im.instanceMatrix.setUsage(T.DynamicDrawUsage);
  im.frustumCulled = false; im.visible = false; scene.add(im);
  PM.yawB = player.yaw + Math.PI;
}
const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _e = new T.Euler(), _pc = new T.Vector3();
// Figur an einen Ort setzen; st: { act, amp, phase, smile }
PM.place = (x, y, z, yaw, st = {}) => {
  if (!PM.mesh) return;
  // V33: im Flug neigt sich der ganze Körper (pitch vor, roll in der Kurve) um die Körpermitte
  const pit = st.pitch || 0, rol = st.roll || 0;
  _q.setFromEuler(_e.set(pit, yaw, rol, 'YXZ')); _s.setScalar(PM.sc); _p.set(x, y, z);
  // V35: Drehpunkt der Neigung: im Flug die Körpermitte, beim Laufen (in die Kurve legen) die Füße
  if (pit || rol) { const c = (st.piv ?? 1.0) * PM.sc; _pc.set(0, c, 0).applyQuaternion(_q); _p.x -= _pc.x; _p.y += c - _pc.y; _p.z -= _pc.z; }
  PM.mesh.setMatrixAt(0, _m.compose(_p, _q, _s)); PM.mesh.instanceMatrix.needsUpdate = true;
  PM.q.copy(_q); PM.o.copy(_p);
  const walking = (st.amp || 0) > 0.01;
  PM.gait.setXYZW(0, PM.seed, walking ? 1 : (st.act || 0), walking ? st.amp : 0, PLAYER_LOOK); PM.gait.needsUpdate = true;
  PM.live.setXYZW(0, 0, st.phase || 0, 1, 1 + (st.smile ?? 0.4)); PM.live.needsUpdate = true;
};
PM.update = () => { if (PM.mesh) PM.mesh.visible = PM.show; };

// Ansicht wechseln (Taste V, Knopf am Handy)
export function toggleView() {
  PM.view = PM.view === 'third' ? 'first' : 'third';
  try { localStorage.setItem('vespera.view', PM.view); } catch {}
  return PM.view;
}
export function toggleDance() { PM.dance = (PM.dance + 1) % 3; return PM.dance; }
export function zoomView(d) { PM.distT = Math.max(1.4, Math.min(6, PM.distT * (d > 0 ? 1.12 : 1 / 1.12))); }

// V35: Alexanders Bewegungen. Grundhaltung wie bisher über aGait (Stehen, Gehen, Laufen, Tragen, Tanzen, Fliegen); V37: Wechsel
// zwischen Gehen, Laufen und Stehen werden im Shader über die Aufnahmekanäle weich überblendet (uPl[0]). Darüber legen sich Sprung, Sturz, Landungen und Telekinese (uPl[1..6], siehe playerPose)
const AN = PM.an = { key: '', y: 0, z: 0, py: 0, pz: 0, fade: 0, ph0: 0, airW: 0, fallW: 0, prepW: 0, tkW: 0, brace: 0, heavy: 0, brake: 0, boost: 0, sp0: 0, lean: 0, roll: 0, spd: 0 };
const _d = new T.Vector3(), _qi = new T.Quaternion(), _hw = new T.Vector3();
const ease = (cur, want, rate, dt) => cur + (want - cur) * Math.min(1, dt * rate);
// Gangdaten setzen; bei einem Wechsel der Haltung die vorige fürs Überblenden merken
// V37: der Shader liest die vorige Aufnahme (Gehen, Laufen, Stehen) ein zweites Mal und mischt sie ein; die vorige Schrittphase
// läuft dabei im alten Takt weiter, damit die Beine beim Anhalten ausschwingen statt einzufrieren
const FADE_S = 0.35;
function baseState(y, z, key, dt) {
  const walkNow = key === 'walk' || key === 'run';
  if (key !== AN.key) {
    // mitten in einer Überblendung nicht hart springen: die stärkere der beiden bleibt die vorige
    if (AN.key && AN.fade < 0.5) { AN.py = AN.y; AN.pz = AN.z; AN.ph0 = PM.phase; AN.fade = 1; }
    AN.key = key;
  }
  AN.y = y; AN.z = z;
  if (walkNow) { AN.cad = PM.cad || 0; AN.ph0 = PM.phase; }
  else AN.ph0 = (AN.ph0 + dt * (AN.cad || 0) * Math.PI * 2) % (Math.PI * 2 * 1000);
  AN.fade = Math.max(0, AN.fade - dt / FADE_S);
}
function writeU(dt) {
  const U = PL_U.value, H = POWERS.hero, D = POWERS.dip, TO = POWERS.takeoff, TK = POWERS.tk, f = AN.fade;
  U[0].set(AN.py, AN.pz, f * f * (3 - 2 * f), AN.ph0);
  const vy = player.v.y;
  U[1].set(AN.airW, Math.max(-1, Math.min(1, vy / 7.2)), AN.fallW, AN.prepW);
  // Heldenlandung: kurz einrasten (0,05 s), dann knien, beim Aufstehen ausblenden
  const hw = PM.heroW = heroWeight();
  const dip = D ? D.k * sst(D.t / 0.07) * (1 - sst((D.t - 0.12) / 0.3)) : 0;
  U[2].set(H ? H.t : 0, hw, dip, 0);
  // Telekinese
  const thrT = POWERS.tkThrowT, thr = thrT >= 0 ? Math.min(1, thrT / 0.5) : 0;
  AN.tkW = ease(AN.tkW, TK || thr > 0 ? 1 : 0, TK ? 9 : 4, dt);
  if (TK) AN.heavy = ease(AN.heavy, TK.kind === 'car' || TK.kind === 'ped' ? 1 : Math.max(0, Math.min(1, (TK.B.m - 25) / 80)), 6, dt);
  U[3].set(AN.tkW, AN.heavy, thr, TK ? Math.min(1, TK.t / 0.45) : 1);
  if (TK) {
    // Richtung von der rechten Schulter zum Gehaltenen, in den Körperraum der Figur gedreht
    const c = tkCenter(TK); _d.set(c.x, c.y, c.z).sub(PM.o).applyQuaternion(_qi.copy(PM.q).invert()).divideScalar(PM.sc);
    _d.x += 0.19; _d.y -= 1.38; if (_d.lengthSq() > 1e-6) _d.normalize(); else _d.set(0, 0, 1);
    U[4].set(_d.x, _d.y, _d.z, 0.12 + 0.55 * AN.heavy);
  }
  U[5].set(TO ? Math.min(1, TO.t / 0.6) : 0, AN.brake, AN.boost, AN.brace);
  U[6].set(Math.max(0, Math.min(1, (-vy - 10) / 40)), 0, 0, 0);
}
function heroWeight() { const H = POWERS.hero; return H ? (H.rise < 0 ? Math.min(1, H.t / 0.05) : 1 - sst(H.rise / 0.6)) : 0; }
function sst(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
// rechte Hand der Figur in Weltkoordinaten (ungefähr, für den Lichtfaden der Telekinese)
PM.handWorld = out => {
  const U = PL_U.value, d = U[4], w = AN.tkW;
  _hw.set(-0.19 + d.x * 0.62 * w, 1.38 + d.y * 0.62 * w - 0.55 * (1 - w), 0.05 + d.z * 0.62 * w).multiplyScalar(PM.sc).applyQuaternion(PM.q).add(PM.o);
  return out.copy(_hw);
};

// Jedes Bild: Figur bewegen. on: zu Fuß und sichtbar (nicht im Wagen, Boot, am Tisch)
export function updatePlayerModel(dt, on) {
  if (!PM.mesh) { if (MHP.ready) buildPlayerModel(); if (!PM.mesh) return; }
  PM.show = on && PM.view === 'third';
  PM.mesh.visible = PM.show;
  if (!PM.show) { PM.heroW = heroWeight(); return; }
  dt = Math.min(dt, 0.1);
  const vx = player.v.x, vz = player.v.z, sp = Math.hypot(vx, vz);
  if (player.fly) { AN.airW = ease(AN.airW, 0, 12, dt); AN.fallW = 0; AN.prepW = 0; AN.brace = ease(AN.brace, 0, 8, dt); flyPose(dt); writeU(dt); return; }
  AN.brake = ease(AN.brake, 0, 6, dt); AN.boost = 0;
  // Körper dreht sich in die Laufrichtung, im Stand bleibt er, wie er stand; mit Telekinese im Stand dreht er sich zum Gehaltenen
  if (LOOSE.held) PM.dance = 0;
  const yaw0 = PM.yawB;
  if (sp > 0.6) { PM.dance = 0; const want = Math.atan2(vx, vz); let d = want - PM.yawB; d = Math.atan2(Math.sin(d), Math.cos(d)); PM.yawB += d * Math.min(1, dt * 10); }
  else if (POWERS.tk) { PM.dance = 0; const c = tkCenter(POWERS.tk), want = Math.atan2(c.x - player.p.x, c.z - player.p.z); let d = want - PM.yawB; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > 0.5 || AN.tkTurn) { AN.tkTurn = Math.abs(d) > 0.05; PM.yawB += d * Math.min(1, dt * 5); } }
  const st = { smile: 0.4 };
  const H = POWERS.hero;
  PM.air = player.onGround || H ? 0 : PM.air + dt;
  const inAir = PM.air > 0.08;
  // Luft: Sprung, langer Sturz, kurz vor dem Aufprall
  AN.airW = ease(AN.airW, inAir ? 1 : 0, inAir ? 10 : 18, dt);
  const fallW = inAir && PM.air > 0.45 && player.v.y < -9 ? 1 : 0;
  AN.fallW = ease(AN.fallW, fallW, 3, dt);
  const tti = (player.p.y - (player.gy ?? player.p.y)) / Math.max(1, -player.v.y);
  AN.prepW = ease(AN.prepW, inAir && player.v.y < -14 && tti < 0.32 ? 1 : 0, 14, dt);
  if (!inAir) { AN.fallW = 0; AN.prepW = 0; }
  // im Stand mit Telekinese: fester Stand
  AN.brace = ease(AN.brace, POWERS.tk && sp < 0.6 && !inAir && !H ? 1 : 0, 6, dt);
  if (inAir) {
    // Grundhaltung bleibt stehen, wie sie war (der Sprung legt sich darüber)
    st.amp = AN.key === 'walk' || AN.key === 'run' ? AN.z : 0; st.phase = PM.phase; st.act = AN.key === 'walk' || AN.key === 'run' ? 1 : AN.y;
    if (st.amp > 0.01) { st.act = 1; }
  } else if (sp > 0.3) {
    // Gehen bis 2,6 m/s mit passender Schrittfolge; schneller wird gelaufen (Schritte nicht schneller als 1,6 je Sekunde)
    // V26: mit etwas Großem in den Armen wird nicht gerannt (player.js bremst), mit etwas Kleinem schon
    // V35: Übergang mit Spielraum (2,4 / 2,8 m/s), damit es an der Grenze nicht hin und her springt
    const Hd = LOOSE.held, canRun = !(Hd && !Hd.small), run = canRun && (AN.key === 'run' ? sp > 2.4 : sp > 2.8), cad = run ? Math.min(1.6, sp / 2.3) : sp / 1.366;
    PM.phase = (PM.phase + dt * cad * Math.PI * 2) % (Math.PI * 2 * 1000); PM.cad = cad;
    st.amp = run ? 0.75 : Hd ? (Hd.small ? 0.62 : 0.55) : 0.4; st.phase = PM.phase;
    baseState(1, st.amp, run ? 'run' : 'walk', dt);
  } else {
    st.act = LOOSE.held ? (LOOSE.held.small ? 41.5 : 41) : PM.dance === 1 ? 22 : PM.dance === 2 ? 23 : 0;
    baseState(st.act, 0, 'act' + st.act, dt);
  }
  if (inAir) AN.fade = Math.max(0, AN.fade - dt / FADE_S);
  if (PM.dance) st.smile = 0.6;
  // beim Laufen in die Kurve legen, beim Antreten und Bremsen ein wenig vor und zurück
  const yr = Math.atan2(Math.sin(PM.yawB - yaw0), Math.cos(PM.yawB - yaw0)) / Math.max(dt, 1e-3), acc = (sp - AN.spd) / Math.max(dt, 1e-3);
  AN.spd = sp;
  const ground = !inAir && !H;
  AN.roll = ease(AN.roll, ground && sp > 2 ? Math.max(-0.2, Math.min(0.2, -yr * sp * 0.014)) : 0, 6, dt);
  AN.lean = ease(AN.lean, ground ? Math.max(-0.08, Math.min(0.1, acc * 0.01)) : 0, 5, dt);
  // aus dem Flug zurück auf die Füße: die Neigung legt sich weich
  PM.tilt = ease(PM.tilt, 0, 10, dt); PM.roll = ease(PM.roll, 0, 10, dt);
  st.pitch = PM.tilt + AN.lean; st.roll = PM.roll + AN.roll; st.piv = Math.min(1, Math.abs(PM.tilt) * 3);
  if (st.amp > 0.01) { st.act = 1; }
  PM.place(player.p.x, player.p.y, player.p.z, PM.yawB, st);
  writeU(dt);
}

// V33/V35: Flugpose. Schwebend aufrecht; je schneller, desto mehr legt er sich in die Flugrichtung (waagrecht im Geradeausflug,
// aufrecht beim Steigen, kopfüber im Sturzflug), rechte Faust voraus. Scharfes Bremsen richtet ihn auf, die Beine schwingen nach vorn
PM.tilt = 0; PM.roll = 0;
function flyPose(dt) {
  PM.dance = 0;
  const v = player.v, s3 = v.length(), hs = Math.hypot(v.x, v.z), k = Math.min(1, Math.max(0, (s3 - 3) / 25));
  const dec = (AN.sp0 - s3) / Math.max(dt, 1e-3); AN.sp0 = s3;
  AN.brake = ease(AN.brake, AN.sp0 > 6 && dec > 12 ? Math.min(1, (dec - 12) / 30) : 0, dec > 12 ? 8 : 3, dt);
  AN.boost = ease(AN.boost, Math.max(0, Math.min(1, (s3 - 45) / 80)), 3, dt);
  let want = hs > 1.5 ? Math.atan2(v.x, v.z) : player.yaw + Math.PI;
  if (POWERS.tk && hs < 4) { const c = tkCenter(POWERS.tk); want = Math.atan2(c.x - player.p.x, c.z - player.p.z); }
  let d = want - PM.yawB; d = Math.atan2(Math.sin(d), Math.cos(d));
  const turn = d * Math.min(1, dt * (hs > 1.5 ? 5 : 2.5));
  PM.yawB += turn;
  const tiltT = (s3 > 0.5 ? k * Math.min(2.6, Math.acos(Math.max(-1, Math.min(1, v.y / s3)))) : 0) * (1 - AN.brake) - 0.25 * AN.brake;
  PM.tilt += (tiltT - PM.tilt) * Math.min(1, dt * 4);
  const rollT = Math.max(-0.7, Math.min(0.7, -turn / Math.max(dt, 1e-3) * 0.35)) * k;
  PM.roll += (rollT - PM.roll) * Math.min(1, dt * 3);
  const act = 43 + Math.min(0.99, k);
  baseState(act, 0, 'fly', dt);
  PM.place(player.p.x, player.p.y, player.p.z, PM.yawB, { act, smile: 0.45, pitch: PM.tilt, roll: PM.roll });
}

// Kamera hinter dem Spieler, leicht über der rechten Schulter; Wände schieben sie heran
const _t = new T.Vector3(), _c = new T.Vector3(), _f = new T.Vector3(), _r = new T.Vector3();
export function thirdPersonCamera(dt) {
  // V33: im Flug etwas weiter weg, damit man die ganze Figur sieht
  const far = player.fly ? PM.distT + 2.2 : PM.distT;
  PM.dist += (far - PM.dist) * Math.min(1, dt * 6);
  const cp = Math.cos(player.pitch), f = _f.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp);
  _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  _t.set(player.p.x, player.p.y + (player.fly ? 1.15 : 1.55) * PM.sc, player.p.z).addScaledVector(_r, 0.32);
  let d = PM.dist;
  // Strahl vom Kopf nach hinten gegen die Quader der Umgebung
  for (const b of nearBoxes(_t.x, _t.z, d + 1)) {
    const h = rayBox(_t, f, b, d); if (h >= 0) d = Math.min(d, Math.max(0.35, h - 0.25));
  }
  _c.copy(_t).addScaledVector(f, -d);
  // nicht unter den Boden, auf dem der Spieler steht
  if (_c.y < player.p.y + 0.3) _c.y = player.p.y + 0.3;
  camera.position.copy(_c);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
// Abstand entlang -dir bis zum Quader b (oder -1)
function rayBox(o, dir, b, maxD) {
  let t0 = 0, t1 = maxD;
  for (const [ax, lo, hi] of [['x', b.x0, b.x1], ['y', b.y0, b.y1], ['z', b.z0, b.z1]]) {
    const dd = -dir[ax], oo = o[ax];
    if (Math.abs(dd) < 1e-6) { if (oo < lo || oo > hi) return -1; continue; }
    let a = (lo - oo) / dd, c = (hi - oo) / dd; if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return -1;
  }
  return t0;
}
