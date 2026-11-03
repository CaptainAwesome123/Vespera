/* =====================================================================
   V60 · GEGNER-LABOR (index.html?lab=gegner[&view=alles][&t=12.5])
   Ohne Stadt: ein Räuber bedroht einen Herrn (Hände hoch), eine Gruppe
   Anarchisten (Fäuste, Wurf, Revolver), ein besiegter Gauner liegt auf
   dem Rücken, zwei Polizisten stehen bei ihm, die Bombe mit Zündschnur
   vor einer Tür, ein Stein und eine Flasche im Flug, Alexander.
   tools/lab-shot.js macht daraus Bilder (LAB=gegner).
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats, PL_U } from './people-skeleton.js';
import { Crowd, COATS, WORKWEAR, turnHead } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';
import { gegnerBombGeo, gegnerProjGeos } from './gegner.js';
import { propMaterial } from './physics.js';
import { buildFX, fxEmit, updateFX } from './particles.js';

export const GLAB = { t: null };
export function startGegnerLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  for (const [c, i, x, y, z] of [[0xffc27a, 2.4, 1.6, 4.2, 3.4], [0x58d0d0, 0.9, -5, 2.5, -1], [0xffc27a, 1.8, -6, 3.5, -5], [0xffc27a, 1.6, 7, 3.5, -4]]) { const l = new T.PointLight(c, i, 22, 1.6); l.position.set(x, y, z); scene.add(l); }
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x24201c, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = new T.Mesh(new T.BoxGeometry(30, 6, 0.4), new T.MeshStandardMaterial({ color: 0x5a3a2c, roughness: 0.85 })); wall.position.set(0, 3, -9.2); scene.add(wall);
  const door = new T.Mesh(new T.BoxGeometry(1.6, 2.6, 0.1), new T.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.6 })); door.position.set(6, 1.3, -8.95); scene.add(door);
  const C = new Crowd(['coat', 'dbl', 'suit', 'worker', 'jacket', 'braces', 'police', 'lady'], 20);
  const A = (kind, col, x, z, yaw, act, tilt = 0, y = 0) => { const a = C.add(kind, col); a.lab = { x, y, z, yaw, tilt }; a.gait.splice(0, 3, Math.random() * 7, act, 0); return a; };
  // Überfall: Räuber (Arm vor, Revolver) und Herr mit erhobenen Händen
  A('dbl', COATS[0], -6.2, -3.2, 0.9, 4.3);
  A('suit', COATS[4], -5.1, -2.5, 0.9 + Math.PI, 8.2);
  // Anarchisten: Anführer mit Fäusten, Werfer, Revolver, einer schreit
  A('worker', WORKWEAR[0], -1.2, -1.8, 0.1, 13.1);
  A('jacket', WORKWEAR[1], -0.1, -2.6, -0.1, 6.6);
  A('coat', COATS[1], 1.1, -2.1, -0.3, 12.3);
  A('braces', WORKWEAR[3], 0.3, -1.2, -0.05, 4.3);
  // besiegter Gauner auf dem Rücken, zwei Polizisten bei ihm
  A('coat', COATS[3], 4.0, -1.0, -Math.PI / 2, 0.3, -Math.PI / 2, 0.13);
  A('police', [0.06, 0.07, 0.16], 3.2, -2.0, 0.8, 4.3);
  A('police', [0.06, 0.07, 0.16], 3.3, 0.2, 2.2, 4.3);
  // Zuschauerin duckt sich
  A('lady', COATS[5], -3.4, 1.5, 2.6, 13.2);
  C.finish();
  for (const a of C.list) { const L = a.lab; C.set(a, L.x, L.y, L.z, L.yaw, 1, L.tilt); if (a.kind !== 'police' && !L.tilt) turnHead(a, 0, 4); }
  // Bombe vor der Tür, Stein und Flasche in der Luft
  const bomb = new T.Mesh(gegnerBombGeo(), propMaterial()); bomb.position.set(6, 0.16, -7.6); bomb.rotation.y = 0.6; scene.add(bomb);
  const G = gegnerProjGeos(), st = new T.Mesh(G.stone, propMaterial()), bt = new T.Mesh(G.bottle, propMaterial());
  st.position.set(-0.2, 2.4, 0.8); bt.position.set(0.9, 2.2, 1.4); bt.rotation.set(0.8, 0.2, 0.5); scene.add(st, bt);
  buildFX();
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; for (const v of PL_U.value) v.set(0, 0, 0, 0); PL_U.value[5].set(0, 0, 0, 1); PM.place(0, 0, 4, Math.PI, { act: 0 }); }
  const V = {
    alles: [[0, 4.6, 11], [0, 0.8, -3]], ueberfall: [[-3.4, 1.7, 0.6], [-5.7, 1.1, -2.9]], anarchisten: [[0.2, 1.7, 3.2], [0.1, 1.2, -2]],
    festnahme: [[6.4, 1.8, 1.8], [3.6, 0.6, -1]], bombe: [[6.6, 0.9, -5.6], [6, 0.2, -7.6]], spieler: [[0.8, 1.6, 6.4], [0, 1.0, 4]],
  };
  GLAB.t = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = V[name] || V.alles; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { GLAB.t = t; };
  window.labStats = () => ({ people: C.list.length });
  window.labView(params.get('view') || 'alles');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  let last = t0;
  const loop = now => {
    U.uTime.value = GLAB.t != null ? GLAB.t : (now - t0) / 1000; U.uCam.value.copy(camera.position);
    // Funken der Zündschnur
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    for (let i = 0; i < 3; i++) fxEmit('spark', 6.05, 0.42, -7.6, 0, 1.2, 0, 1, 0.03, 0.8);
    updateFX(dt);
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
