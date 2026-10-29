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
import { MAT } from './people-skeleton.js';
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
};
try { if (localStorage.getItem('vespera.view') === 'third') PM.view = 'third'; } catch {}

export function buildPlayerModel() {
  if (!MHP.ready || PM.mesh) return;
  const geo = personShare('player', 2);
  const ga = PM.gait = new T.InstancedBufferAttribute(new Float32Array([PM.seed, 0, 0, PLAYER_LOOK]), 4);
  const li = PM.live = new T.InstancedBufferAttribute(new Float32Array([0, 0, 1, 1.15]), 4);
  ga.setUsage(T.DynamicDrawUsage); li.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('aGait', ga); geo.setAttribute('aLive', li);
  const im = PM.mesh = new T.InstancedMesh(geo, MAT.cloth, 1);
  im.setColorAt(0, new T.Color(0.025, 0.025, 0.03)); im.instanceMatrix.setUsage(T.DynamicDrawUsage);
  im.frustumCulled = false; im.visible = false; scene.add(im);
  PM.yawB = player.yaw + Math.PI;
}
const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _e = new T.Euler();
// Figur an einen Ort setzen; st: { act, amp, phase, smile }
PM.place = (x, y, z, yaw, st = {}) => {
  if (!PM.mesh) return;
  _q.setFromEuler(_e.set(0, yaw, 0)); _s.setScalar(PM.sc); _p.set(x, y, z);
  PM.mesh.setMatrixAt(0, _m.compose(_p, _q, _s)); PM.mesh.instanceMatrix.needsUpdate = true;
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

// Jeden Bild: Figur bewegen. on: zu Fuß und sichtbar (nicht im Flug, Wagen, Boot, am Tisch)
export function updatePlayerModel(dt, on) {
  if (!PM.mesh) { if (MHP.ready) buildPlayerModel(); if (!PM.mesh) return; }
  PM.show = on && PM.view === 'third';
  PM.mesh.visible = PM.show;
  if (!PM.show) return;
  const vx = player.v.x, vz = player.v.z, sp = Math.hypot(vx, vz);
  // Körper dreht sich in die Laufrichtung, im Stand bleibt er, wie er stand
  if (LOOSE.held) PM.dance = 0;
  if (sp > 0.6) { PM.dance = 0; const want = Math.atan2(vx, vz); let d = want - PM.yawB; d = Math.atan2(Math.sin(d), Math.cos(d)); PM.yawB += d * Math.min(1, dt * 10); }
  const st = { smile: 0.4 };
  PM.air = player.onGround ? 0 : PM.air + dt;
  if (PM.air > 0.12) {
    // in der Luft: Laufschritt angehalten, Arme weit
    st.amp = 0.75; st.phase = Math.PI * 0.55;
  } else if (sp > 0.3) {
    // Gehen bis 2,6 m/s mit passender Schrittfolge; schneller wird gelaufen (Schritte nicht schneller als 1,6 je Sekunde)
    // V26: mit etwas Großem in den Armen wird nicht gerannt (player.js bremst), mit etwas Kleinem schon
    const H = LOOSE.held, run = sp > 2.6 && !(H && !H.small), cad = run ? Math.min(1.6, sp / 2.3) : sp / 1.366;
    PM.phase = (PM.phase + dt * cad * Math.PI * 2) % (Math.PI * 2 * 1000);
    st.amp = run ? 0.75 : H ? (H.small ? 0.62 : 0.55) : 0.4; st.phase = PM.phase;
  } else st.act = LOOSE.held ? (LOOSE.held.small ? 41.5 : 41) : PM.dance === 1 ? 22 : PM.dance === 2 ? 23 : 0;
  if (PM.dance) st.smile = 0.6;
  PM.place(player.p.x, player.p.y, player.p.z, PM.yawB, st);
}

// Kamera hinter dem Spieler, leicht über der rechten Schulter; Wände schieben sie heran
const _t = new T.Vector3(), _c = new T.Vector3(), _f = new T.Vector3(), _r = new T.Vector3();
export function thirdPersonCamera(dt) {
  PM.dist += (PM.distT - PM.dist) * Math.min(1, dt * 6);
  const cp = Math.cos(player.pitch), f = _f.set(-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp);
  _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
  _t.set(player.p.x, player.p.y + 1.55 * PM.sc, player.p.z).addScaledVector(_r, 0.32);
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
