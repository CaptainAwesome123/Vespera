/* =====================================================================
   V76 · TURM-LABOR (index.html?lab=turm[&view=sonne][&t=12.5][&composer=1])
   Eine Reihe hoher Türme mit den neuen Kronen (Sonnenkrone, Leuchtlaterne, Ankermast, Stufenkrone), Lisenen,
   Leuchtpylonen und angestrahlten Stufen, dazu ein paar Türme wie bisher zum Vergleich. Ohne die Stadt, damit es
   auch im Software-Renderer schnell geht (LAB=turm node tools/lab-shot.js ...).
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { neons, glowPts, segs } from './facade-shader.js';
import * as FS from './facade-shader.js';
import { decoBuilding } from './entrances.js';
import { FORCE76, KRONEN } from './stadtbild.js';
import { labFacadeMesh } from './deco.js';
import { buildTowerTops } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { loadManifest, applyTextures } from './assets.js';

export async function startTurmLab(params) {
  buildEnv(); getMats();
  try { await loadManifest(); await applyTextures(); } catch (e) { /* ohne Fotos */ }
  scene.fog.density = 0.0003; if (U.uFogDensity) U.uFogDensity.value = 0.0003;
  const floor = new T.Mesh(new T.PlaneGeometry(1600, 900), new T.MeshStandardMaterial({ color: 0x15130f, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const E = { n: true, s: true, w: true, e: true };
  // [Name, Bauform, Krone, Breite, Tiefe, Höhe]
  const ROW = [['sonne', 'classic', 'sonne', 30, 30, 150], ['laterne', 'chamfer', 'laterne', 30, 28, 130], ['mast', 'notch', 'mast', 28, 28, 170], ['stufen', 'classic', 'stufen', 34, 26, 120],
    ['sonne2', 'tiara', null, 30, 30, 140], ['blade', 'blade', 'sonne', 40, 26, 160], ['strom', 'stream', 'laterne', 28, 28, 110], ['zig', 'zig', 'mast', 30, 30, 125]];
  const V = {};
  ROW.forEach(([name, form, crown, w, d, H], i) => {
    const x = (i - (ROW.length - 1) / 2) * 62, z = (i % 2) * -40;
    FORCE76.form = form; FORCE76.crown = crown;
    // der Stadtzufall entscheidet, welche Sorte Aufsatz ein Turm bekommt; fürs Labor so oft bauen, bis die gewünschte Krone dabei ist
    for (let tries = 0; tries < 40; tries++) {
      const s0 = segs.length, n0 = neons.length, g0 = glowPts.length, f0 = KRONEN.fans.length, d0 = KRONEN.drums.length, sp0 = FS.spires.length, r0 = FS.roofs.length, t0 = FS.towers.length;
      KRONEN.last = null; decoBuilding(x, z, w, d, H + 0.2, 2000, E, false);
      if (!crown || KRONEN.last === crown) break;
      segs.length = s0; neons.length = n0; glowPts.length = g0; KRONEN.fans.length = f0; KRONEN.drums.length = d0; FS.spires.length = sp0; FS.roofs.length = r0; FS.towers.length = t0;
    }
    V[name] = [[x + 34, H * 0.93, z + 78], [x, H * 0.97, z]];
    V[name + 'nah'] = [[x + 16, H + 14, z + 38], [x, H + 12, z]];
    V[name + 'unten'] = [[x + 24, 1.8, z + 60], [x, H * 0.6, z]];
    V[name + 'stufe'] = [[x + 30, H * 0.62, z + 44], [x, H * 0.6, z]];
  });
  FORCE76.form = FORCE76.crown = null;
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; nm.frustumCulled = false; scene.add(nm); }
  buildTowerTops();
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  Object.assign(V, { alle: [[20, 70, 330], [0, 95, 0]], links: [[-120, 120, 190], [-95, 110, 0]], rechts: [[120, 120, 190], [95, 110, 0]], fern: [[60, 40, 720], [0, 110, 0]], flug: [[-40, 230, 210], [0, 120, -10]] });
  window.labView = name => { const v = V[name] || V.alle; camera.position.set(...v[0]); camera.lookAt(...v[1]); };
  const LABT = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABT.t = t; };
  window.labStats = () => ({ segs: segs.length, neons: neons.length, glows: glowPts.length, fans: KRONEN.fans.length, drums: KRONEN.drums.length });
  window.labView(params.get('view') || 'alle');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now();
  const loop = now => { U.uTime.value = LABT.t != null ? LABT.t : (now - t0) / 1000; U.uCam.value.copy(camera.position); if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera); window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
