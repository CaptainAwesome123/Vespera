/* =====================================================================
   V61 · VERSTECK-LABOR (index.html?lab=versteck[&view=druckerei][&t=12.5])
   Ohne Stadt: die drei Verstecke (Druckerei, Kanalgewölbe, Station Nordstern
   mit Kasimir, seinen Leuten und der Höllenmaschine) und die drei Einstiege
   (Kellerluke, Gully, U-Bahn-Abgang). tools/lab-shot.js macht Bilder (LAB=versteck).
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { Crowd, COATS, WORKWEAR, turnHead } from './serpentine.js';
import { loadManifest } from './assets.js';
import { DEFS, buildRoom, buildEntry } from './verstecke.js';
import { dynamitGeo } from './anfuehrer.js';
import { propMaterial } from './physics.js';

export async function startVersteckLab(params) {
  buildEnv(); getMats();
  try { await loadManifest(); } catch (e) { /* ohne Fotos */ }
  scene.fog.density = 0.0004;
  hemi.intensity = 0.25; moonLight.intensity = 0;
  const at = { druckerei: [0, 0, 0], gewoelbe: [60, 0, 0], station: [130, 0, 0] }, H = {};
  for (const d of DEFS) {
    const h = H[d.id] = { id: d.id, name: d.name, kind: d.kind, def: d, lab: true, ox: at[d.id][0], oy: 0, oz: at[d.id][2] };
    buildRoom(h);
    for (const [x, y, z] of h.C.lights) { const l = new T.PointLight(d.id === 'station' ? 0xffd7a0 : 0xffb35c, d.id === 'station' ? 2.4 : 1.9, d.id === 'station' ? 18 : 12, 1.6); l.position.set(h.ox + x, y, h.oz + z); scene.add(l); }
  }
  // Einstiege auf Pflaster
  const street = new T.Mesh(new T.PlaneGeometry(40, 14), new T.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.8 })); street.rotation.x = -Math.PI / 2; street.position.set(10, 0, 60); scene.add(street);
  const wall = new T.Mesh(new T.BoxGeometry(6, 5, 0.4), new T.MeshStandardMaterial({ color: 0x6a3e30, roughness: 0.9 })); wall.position.set(0, 2.5, 61.6); scene.add(wall);
  [['druckerei', 0, 60, 0], ['gewoelbe', 10, 60, 0], ['station', 21, 60, 0]].forEach(([id, x, z, yaw]) => buildEntry({ ...H[id], ex: x, ey: 0, ez: z, eyaw: yaw, known: true }));
  for (const [x, z] of [[2, 56], [12, 56], [21, 54]]) { const l = new T.PointLight(0xffc27a, 1.6, 14, 1.6); l.position.set(x, 4, z); scene.add(l); }
  // Leute: Druckerei und Station
  const C = new Crowd(['worker', 'coat', 'jacket', 'braces', 'dbl', 'police'], 24);
  const A = (kind, col, x, y, z, yaw, act, tilt = 0) => { const a = C.add(kind, col); a.lab = { x, y, z, yaw, tilt }; a.gait.splice(0, 3, Math.random() * 7, act, 0); return a; };
  const KS = ['worker', 'coat', 'jacket', 'braces', 'worker'];
  for (const id of ['druckerei', 'station']) { const h = H[id]; h.X.spots.forEach(([x, z, act, yaw], i) => A(KS[i], KS[i] === 'coat' ? COATS[1] : WORKWEAR[i % WORKWEAR.length], h.ox + x, id === 'station' && x < 1.2 ? 0.9 : 0, h.oz + z, yaw, act)); }
  { const h = H.station, [bx, bz] = h.X.boss; A('dbl', [0.3, 0.045, 0.04], h.ox + bx, 0.9, h.oz + bz, 0.2, 3.7).lab.sc = 1.09; }
  C.finish();
  for (const a of C.list) { const L = a.lab; C.set(a, L.x, L.y, L.z, L.yaw, L.sc || 1, L.tilt); }
  const dy = new T.Mesh(dynamitGeo(), propMaterial()); dy.position.set(128, 1.6, -1); dy.rotation.set(0.6, 0.3, 0.9); scene.add(dy);
  const V = {
    druckerei: [[-5.6, 1.7, 3.8], [2, 1.0, -1.5]], presse: [[0, 1.6, -1], [2.5, 1.0, -4]], druckwand: [[1, 1.6, -2], [0.5, 1.6, 6]],
    gewoelbe: [[58, 1.6, -15], [60, 1.2, 4]], gold: [[61, 1.4, 1], [63.2, 0.4, 4.5]],
    station: [[127, 2.4, 14], [128, 1.6, -8]], bahnsteig: [[124, 2.2, -12], [127, 1.4, 4]], maschine: [[128.4, 1.9, -1.4], [127.4, 1.2, -4]], gleis: [[135, 1.8, 18], [134.5, 1.5, -10]],
    einstiege: [[10, 3.2, 52], [10, 0.4, 60]], luke: [[0, 1.8, 57], [0, 0.3, 60]], gully: [[10, 1.6, 57.5], [10, 0, 60]], ubahn: [[21, 2.6, 68], [21, 1.0, 60]],
  };
  window.labView = name => { const v = V[name] || V.druckerei; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { U.uTime.value = t; };
  window.labStats = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
  window.labView(params.get('view') || 'druckerei');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => {
    if (params.get('t') == null) U.uTime.value = (now - t0) / 1000; else U.uTime.value = +params.get('t');
    U.uCam.value.copy(camera.position); C.flag();
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
