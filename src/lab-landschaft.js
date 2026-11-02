/* =====================================================================
   V44 · LANDSCHAFTS-LABOR (index.html?lab=landschaft[&composer=1][&view=wasserfall][&t=12.5])
   Nur See, Felswand, Berge, Wasserfälle, Gletscher, Eis und der Viadukt, ohne die Stadt: zum Prüfen von Klippen-
   netz, Wasserfallbahnen, Bachbetten, Eissaum, Schollen und Viaduktschmuck, auch im Software-Renderer (tools/lab-shot.js).
   Villa-Standort und Serpentine werden nur geplant (nicht gebaut), damit Wasserfälle und Eis dieselben Lücken lassen wie im Spiel.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, mergeGeos } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { planAccess, VIA, deckY, terrainHeight } from './harbour.js';
import { buildAccessRoad, buildMountains, planVillaSite, planSerpentine } from './serpentine.js';
import { planLandscape, buildLandscape, LAND, landRay, shoreAt } from './landscape.js';
import { buildHarborWaterMat, waterGridGeo, updateWaves } from './water.js';
import { WATER_Y } from './dance.js';
import { buildSky } from './sky.js';
import { buildGroundFog } from './airships.js';
import { neons, glowPts, lamps } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { labFacadeMesh } from './deco.js';
import { player } from './player.js';

export async function startLandscapeLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats(); planAccess();
  planVillaSite(); planSerpentine();
  planLandscape();
  buildAccessRoad();
  buildMountains();
  buildLandscape();
  // Wasser wie im Spiel (ohne echte Spiegelung)
  const water = new T.Mesh(waterGridGeo(), buildHarborWaterMat()); water.position.set(0, WATER_Y, 0); water.frustumCulled = false; scene.add(water);
  updateWaves(1);
  buildSky();
  if (!params.has('ohnenebel')) buildGroundFog();
  // Fassadensegmente (Portal, Stadttor), Neon, Glühpunkte und Laternen des Viadukts sichtbar machen
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  { const g = [], h = []; for (const l of lamps) { const y = l.y || 0; g.push(new T.CylinderGeometry(0.08, 0.12, l.h || 5, 6).translate(l.x, y + (l.h || 5) / 2, l.z)); h.push(new T.SphereGeometry(0.35, 8, 6).translate(l.x, y + (l.h || 5) + 0.3, l.z)); }
    if (g.length) { scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x3a3a3f, roughness: 0.6 }))); scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); } }
  // Ansichten: aus den geplanten Wasserfällen und Gletschern abgeleitet
  const F = LAND.falls, big = F.find(f => f.big && f.baseX != null) || F.find(f => f.baseX != null) || F[0], small = F.find(f => !f.big && f.baseX != null && f !== big) || big;
  const G0 = LAND.glaciers[0], G1 = LAND.glaciers[1];
  const at = (f, back, up, lift = 0) => f ? [[f.baseX - f.dx * back, WATER_Y + up, f.baseZ - f.dz * back], [f.baseX + f.dx * 6, WATER_Y + lift, f.baseZ + f.dz * 6]] : [[0, 20, -900], [0, 60, -1400]];
  const gl = (G, back, up, lift) => { const [sx, sz] = landRay(G.ang, G.mShore), [cx, cz] = landRay(G.ang, G.mShore - back); return [[cx, WATER_Y + up, cz], [sx, WATER_Y + lift, sz]]; };
  const cliffAng = -0.78, [cx0, cz0] = landRay(cliffAng, shoreAt(cliffAng) - 130), [cw0, cwz0] = landRay(cliffAng, shoreAt(cliffAng) + 12);
  const lip = (f, d) => f ? [f.lipX + f.dx * d, terrainHeight(f.lipX + f.dx * d, f.lipZ + f.dz * d), f.lipZ + f.dz * d] : [0, 0, 0];
  const V = {
    uebersicht: [[-200, 320, -700], [-1000, 40, -1500]],
    klippe: [[cx0, 14, cz0], [cw0, 70, cwz0]],
    klippenah: [[cx0 * 0.5 + cw0 * 0.5, 6, cz0 * 0.5 + cwz0 * 0.5], [cw0, 30, cwz0]],
    wasserfall: at(big, 120, 18, big ? big.hFall * 0.45 : 40),
    wasserfallnah: at(big, 42, 5, 8),
    wasserfalloben: big ? [[...lip(big, -40).map((v, i) => i === 1 ? v + 30 : v)], lip(big, 2)] : at(big, 80, 60, 60),
    wasserfallklein: at(small, 90, 12, small ? small.hFall * 0.4 : 30),
    bach: big ? [[...lip(big, 70).map((v, i) => i === 1 ? v + 28 : v)], lip(big, 15)] : at(big, 80, 60, 60),
    bachnah: big ? [[...lip(big, 40).map((v, i) => i === 1 ? v + 6 : v)], lip(big, 10)] : at(big, 80, 60, 60),
    gletscher: gl(G0, 170, 26, 40),
    gletschernah: gl(G0, 60, 6, 20),
    gletscheroben: (() => { const [sx, sz] = landRay(G0.ang, G0.mShore + 40), [ux, uz] = landRay(G0.ang, G0.mShore + 420); return [[sx, terrainHeight(sx, sz) + 120, sz], [ux, terrainHeight(ux, uz) + 20, uz]]; })(),
    gletscher2: gl(G1, 200, 30, 50),
    eis: (() => { const [cx, cz] = landRay(G1.ang + 0.08, G1.mShore - 140), [sx, sz] = landRay(G1.ang, G1.mShore); return [[cx, WATER_Y + 4, cz], [sx, WATER_Y + 25, sz]]; })(),
    eisnah: (() => { const [cx, cz] = landRay(G1.ang - 0.05, G1.mShore - 60), [sx, sz] = landRay(G1.ang - 0.02, G1.mShore - 20); return [[cx, WATER_Y + 2.2, cz], [sx, WATER_Y + 1, sz]]; })(),
    viadukt: [[-110, 8, -1130], [0, deckY(-1230), -1230]],
    viaduktpfeiler: [[-34, 2.5, -1290], [0, 10, -1330]],
    viaduktoben: [[1.5, deckY(-1100) + 1.7, -1100], [0, deckY(-1400) + 4, -1400]],
    viaduktfern: [[-380, 40, -1050], [0, deckY(-1500) + 10, -1500]],
    see: [[-520, 4, -1040], [-760, 90, -1480]],
    sued: [[0, 60, 700], [0, 300, 2200]],
  };
  window.labView = name => { const v = V[name] || V.uebersicht; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; U.uInside.value = 0; hemi.intensity = 0.9; };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'uebersicht');
  window.labStats = () => ({ ...LAND.stats, falls: LAND.falls.map(f => ({ ang: +f.ang.toFixed(2), top: Math.round(f.top), w: Math.round(f.w), h: Math.round(f.hFall || 0), run: Math.round(f.run || 0) })), glaciers: LAND.glaciers, drawCalls: renderer.info.render.calls, tris: renderer.info.render.triangles });
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now();
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
