/* =====================================================================
   V54 · LUFTSCHIFF-LABOR (index.html?lab=luftschiff[&composer=1][&view=salon][&t=12.5])
   Nur Alexanders Aurora Imperial (Hülle, Gondel, alle Räume, lose Dinge) ohne Stadt, das Schiff steht still:
   zum Prüfen der Treppe, der Gondel unter der Hülle, der Einrichtung und der beweglichen Dinge an Bord,
   auch im Software-Renderer (tools/lab-shot.js). Innen wie im Spiel ohne echte Lampen (Selbstleuchten der Stoffe).
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { buildImperial, IMP } from './imperial.js';
import * as IMPM from './imperial.js';
import { pfRead, pfSave } from './harbour.js';
import { LOOSE, updateLoose } from './physics.js';
import { player } from './player.js';

export async function startShipLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.00025;
  buildImperial();
  const g = IMP.g; g.position.set(0, 120, 0); g.rotation.set(0, 0, 0); g.updateMatrixWorld(true);
  pfRead(IMP.pf); pfSave(IMP.pf);
  IMP.inner.visible = true; IMP.farGlow.visible = false;
  player.on = IMP.pf;
  if (IMPM.impShipSpawns) IMPM.impShipSpawns(true);
  const D = IMP.D, W = (x, y, z) => new T.Vector3(x, 120 + y, z);
  const B = D.fyB, A = D.fyA;
  // Ansichten in Schiffskoordinaten: [Kamera, Blickpunkt]
  const V = {
    aussen: [[-60, -20, 95], [12, -6, 0]], aussennah: [[20, D.fyB - 2, 34], [16, D.yR, 0]], seite: [[14, D.fyB + 2, 60], [14, D.yR + 2, 0]], unten: [[60, D.fyB - 12, 40], [10, D.yR, 0]], heck: [[-55, D.fyB + 4, 18], [0, D.yR, 0]],
    achterdeck: [[-20.5, B + 1.7, 0], [-12, B + 1.4, 0]], achterdeck2: [[-12.6, B + 1.7, -5], [-21, B + 0.8, 4]],
    speise: [[-10.8, B + 1.7, -4.5], [0, B + 0.9, 2]], speise2: [[2.8, B + 1.7, 4.5], [-8, B + 1.0, -1]],
    halle: [[5.6, B + 1.7, -4.4], [10, B + 2.4, 4.5]], treppe: [[4.8, B + 1.6, 0.2], [11.3, A + 1.2, 4.6]], treppeoben: [[11.6, A + 1.7, 4.8], [4.6, B + 0.5, 4.6]], galerie: [[11.3, A + 1.7, -5.8], [5, A + 0.8, 2.5]],
    kueche: [[12.8, B + 1.7, 3.8], [22, B + 0.9, -2]], messe: [[24.8, B + 1.7, 3.8], [36, B + 0.8, -4]], funk: [[33, B + 1.7, 1], [37, B + 1.0, -6]],
    bruecke: [[39, B + 1.7, 3], [50, B + 1.2, -0.5]], bruecke2: [[48.5, B + 1.7, -5.5], [42, B + 0.9, 4]],
    suite: [[3.3, A + 1.7, 5.8], [-8, A + 0.8, -1]], suite2: [[-11.2, A + 1.7, -5.4], [-4, A + 0.8, 1.5]], bad: [[3.5, A + 1.7, -3.4], [1, A + 0.7, -6.3]],
    bibliothek: [[12.8, A + 1.7, 5.5], [21, A + 1.0, -3]], bibliothek2: [[23.2, A + 1.7, -5.8], [14, A + 1.0, 3]],
    salon: [[25, A + 1.7, -5.5], [40, A + 1.0, 2.5]], salon2: [[49, A + 1.7, 5.8], [32, A + 1.0, -2]], bar: [[30, A + 1.7, 0.5], [29, A + 1.2, 6.5]],
    steuer: [[D.XF - 3.2, B + 1.7, 0], [D.XF + 30, B - 2, 0]], steuerseite: [[D.XF - 6.5, B + 1.9, -4.5], [D.XF - 2, B + 1.0, 0.5]], sofa: [[31, A + 1.3, -3.6], [31, A + 0.9, 3]], tafel: [[-4.0, A - 3.9 + 1.25, 1.08], [-10, B + 0.9, 3.5]], bistro: [[-18.5, B + 1.25, 2.85], [-13, B + 1.0, 2.2]],
  };
  window.labView = name => { const v = V[name] || V.salon; camera.position.copy(W(...v[0])); camera.lookAt(W(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6;
    const ins = v[0][1] > D.fyB - 0.5 && v[0][0] > D.XT && v[0][0] < D.XF && Math.abs(v[0][2]) < D.ZW;
    U.uInside.value = ins ? 1 : 0; hemi.intensity = 0.9 * (1 - 0.72 * U.uInside.value); moonLight.intensity = ins ? 0 : 0.6; };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'salon');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(IMP.inner); const inner = { tris: Math.round(tris), draws }; tris = 0; draws = 0; cnt(scene); return { inner, all: { tris: Math.round(tris), draws }, bodies: LOOSE.bodies.length, onShip: LOOSE.bodies.filter(b => b.pf).length, awake: LOOSE.stats.awake, cam: camera.position.toArray().map(Math.round) }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible && (!i.object.parent || i.object.parent.visible))[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, Dp = null; if (params.get('composer')) { const Bm = await import('./bloom.js'); Dp = await import('./depth.js'); Bm.setupComposer(); comp = Bm.composer; }
  const t0 = performance.now();
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    try { updateLoose(1 / 60); } catch (e) { }
    if (comp) { Dp.skipDepthResolve(renderer, comp.renderTarget1); Dp.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
