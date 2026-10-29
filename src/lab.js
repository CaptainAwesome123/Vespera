/* =====================================================================
   V24 · FIGUREN-LABOR (index.html?lab=menschen): nur ein paar Figuren vor
   dunklem Grund, unter Laterne und Mond, ohne die Stadt. Zum schnellen
   Prüfen von Gesichtern, Kleidung, Tänzen und dem Spielermodell, auch im
   Software-Renderer (tools/lab-shot.js macht daraus Bilder).
   ?lab=menschen&t=12.5  hält die Zeit an; window.labView(name) wählt den Ausschnitt.
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { Crowd, GOWNS, DRESSES, COATS } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';

export const LAB = { crowd: null, t: null, views: {} };
export function startLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  const lamp = new T.PointLight(0xffc27a, 2.2, 14, 1.6); lamp.position.set(1.6, 3.6, 2.4); scene.add(lamp);
  const teal = new T.PointLight(0x58d0d0, 0.8, 12, 1.6); teal.position.set(-3, 2.5, -1); scene.add(teal);
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const C = LAB.crowd = new Crowd(['tux', 'gown', 'dress', 'suit', 'lady', 'worker', 'coat'], 40);
  const A = (kind, col, x, z, yaw, gait, face) => { const a = C.add(kind, col, face); a.lab = { x, z, yaw }; if (gait) a.gait.splice(0, 3, ...gait); return a; };
  // vordere Reihe: Gesichter (stehend), hintere Reihe: Gehen und Tanzen
  const look = (face, tone, hair) => face + 64 * tone + 320 * hair + 7680 * 2;
  A('tux', COATS[0], -0.9, 0, 0, [0.3, 0, 0], look(3, 0, 1));
  A('gown', GOWNS[3], -0.3, 0, 0, [1.3, 0, 0], look(40, 1, 0));
  A('dress', DRESSES[1], 0.3, 0, 0, [2.3, 0, 0], look(45, 0, 2));
  A('suit', COATS[3], 0.9, 0, 0, [3.3, 0, 0], look(9, 3, 0));
  A('lady', COATS[5], 1.5, 0, 0, [4.1, 0, 0], look(36, 2, 3));
  A('worker', [0.55, 0.62, 0.72], -1.5, 0, 0, [5.2, 0, 0], look(21, 1, 5));
  // Tanzpaare und Gehende
  A('tux', COATS[0], -1.2, -3, 0, [0, 20, 0], look(5, 0, 0)); A('gown', GOWNS[0], -1.28, -2.62, Math.PI, [0, 21, 0], look(33, 0, 2));
  A('tux', COATS[0], 1.2, -3, 0.4, [0.7, 22, 0], look(7, 1, 1)); A('dress', DRESSES[0], 1.2, -2.2, 0.4 + Math.PI, [0.7, 22, 0], look(47, 0, 0));
  A('suit', COATS[2], -3, -1.5, 1.57, [0.2, 4.6, 0.42], look(11, 1, 2)); A('coat', COATS[1], 3, -1.5, -1.57, [1.7, 4.6, 0.4], look(14, 0, 4));
  // V26: Läufer, Dame im Gang, Charleston einzeln (seitlich zu sehen)
  A('suit', COATS[4], -3, 1.5, 1.57, [0.9, 7.4, 0.75], look(12, 0, 1)); A('dress', DRESSES[2], 3, 1.5, -1.57, [2.9, 5.2, 0.4], look(41, 1, 3));
  A('tux', COATS[0], 0, -5.5, 1.57, [1.9, 22, 0], look(6, 0, 2)); A('gown', GOWNS[1], 0, -7, -1.57, [3.9, 22, 0], look(44, 0, 1));
  C.finish();
  for (const a of C.list) C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw);
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; PM.place(0, 0, 2.2, 0, { act: 0 }); }
  LAB.views = {
    alle: [[0, 1.5, 6.5], [0, 1.0, -1]],
    gesichter: [[0, 1.62, 2.6], [0, 1.55, 0]],
    herr: [[-0.9, 1.68, 0.75], [-0.9, 1.66, 0]],
    dame: [[-0.3, 1.58, 0.7], [-0.3, 1.55, 0]],
    tanz: [[0, 1.2, 1.2], [0, 0.8, -3]],
    beine: [[-4.2, 0.75, -2.8], [-1.2, 0.55, -2.8]],
    beine2: [[4.2, 0.75, -2.6], [1.2, 0.55, -2.6]],
    spieler: [[0, 1.6, 4.0], [0, 1.0, 2.2]],
    gang: [[0, 1.0, 5.5], [0, 0.9, 0.0]],
    seite: [[-7.5, 1.1, 0.0], [0, 0.85, 0.0]],
    charl: [[4.5, 1.2, -6.2], [0, 0.9, -6.2]],
    spielerkopf: [[0, 1.68, 2.95], [0, 1.67, 2.2]],
  };
  LAB.t = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = LAB.views[name] || LAB.views.alle; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { LAB.t = t; };
  window.labView(params.get('view') || 'alle');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let t0 = performance.now();
  const loop = now => {
    U.uTime.value = LAB.t != null ? LAB.t : (now - t0) / 1000;
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
