/* =====================================================================
   V51 · BELMONT-LABOR (index.html?lab=belmont[&composer=1][&view=lobby][&t=12.5])
   Nur Lobby und Grand Ballroom des Belmont mit Gästen, Band und Tanzpaaren, ohne Stadt und Turm:
   zum Prüfen von Materialien, Licht und Ausstattung im Software-Renderer (tools/lab-shot.js, LAB=belmont).
   Lichter wie im Spiel: höchstens vier Punktlichter, die der Kamera nächsten (innen).
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { buildBelmontInterior, buildBelmontDoor, BEL_IN, interiorCrowd } from './belmont.js';
import { updateInterior } from './dance.js';
import { neons, glowPts } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { labFacadeMesh } from './deco.js';
import { loadManifest, applyTextures } from './assets.js';

export async function startBelmontLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  try { await loadManifest(); } catch (e) { /* ohne Fotos */ }
  scene.fog.density = 0.00025;
  buildBelmontInterior(); buildBelmontDoor();
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  await applyTextures().catch(() => {});
  U.uInside.value = 1; hemi.intensity = 0.9 * 0.28; moonLight.intensity = 0;   // wie im Spiel, wenn man im Belmont steht
  if (interiorCrowd) interiorCrowd.show(true);
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const relight = () => {
    const cp = camera.position;
    const near = LIGHTS.filter(a => a.inside && cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  const P = 0.26 + 1.7;
  const V = {
    lobby: [[0, P, 44], [0, 6, 4]], lobbyhoch: [[20, 12, 44], [-6, 2, 14]], rezeption: [[-30, P, 35], [-46, 2.5, 20]], aufzug: [[30, P, 14], [47, 3, 24]],
    sitzgruppe: [[-8, P, 4], [-18, 1.2, 12]], kronleuchter: [[8, P, 30], [0, 11, 20]], tor: [[0, P, 12], [0, 6, -6]],
    ballsaal: [[0, P, -8], [0, 6, -40]], ballhoch: [[0, 16.7 + 1.7, -12], [0, 4, -36]], buehne: [[0, P, -24], [0, 5, -46]], band: [[-4, P + 1.3, -37], [-2, 2.8, -45]],
    tische: [[-14, P, -20], [-27, 1.2, -32]], bar: [[-40.2, P, -15], [-44.5, 1.4, -27]], tisch: [[-17.5, P, -23], [-23, 0.9, -30]], treppe: [[26, P, -44], [36, 4, -20]], galerie: [[38, 8.0 + 1.7, -16], [0, 5, -32]],
    tanz: [[10, P, -20], [0, 1.4, -28]], spiegel: [[34, P, -30], [48, 3.5, -30]],
  };
  window.labView = name => { const v = V[name] || V.lobby; camera.position.set(...v[0]); camera.lookAt(...v[1]); player.p.copy(camera.position); player.p.y -= 1.6; relight(); };
  const LABB = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABB.t = t; };
  window.labView(params.get('view') || 'lobby');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(scene); return { tris: Math.round(tris), draws, people: interiorCrowd ? interiorCrowd.list.length : 0, lights: pool.map(l => +l.intensity.toFixed(2)), inner: BEL_IN.g ? BEL_IN.g.children.length : 0 }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now();
  // im Software-Renderer dauert ein Bild des Ballsaals sehr lange: nach drei Bildern je Ansicht anhalten (labView setzt labFrames zurück)
  const hold = !!params.get('hold');
  const loop = now => {
    if (hold && (window.labFrames || 0) >= 3) { requestAnimationFrame(loop); return; }
    const t = LABB.t != null ? LABB.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    try { updateInterior(t, true); } catch (e) { }
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; window.labMs = Math.round(performance.now() - now); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
