/* =====================================================================
   V42 · STRASSEN-LABOR (index.html?lab=strassen[&composer=1][&view=viadukt][&t=12.5])
   Nur das Straßennetz ohne Häuser: Viadukt, Tunnel und Wendehalle, dazu der fließende Verkehr als einfache Wagen.
   V65: die Hochstraßen mit ihren Rampen sind abgerissen. Zum Prüfen im Software-Renderer (tools/lab-shot.js).
   Blöcke sind nur dunkle Klötze als Maßstab.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight, mergeGeos } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { AV, ST, PLAZA, KEEP, onIsland, blocks, buildNetwork, NET } from './island.js';
import { planAccess, VIA, deckY } from './harbour.js';
import { buildAccessRoad, carGeo } from './serpentine.js';
import { buildLanes, spawnTraffic, updateTraffic, TRF } from './traffic.js';
import { neons, glowPts, lamps } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { labFacadeMesh } from './deco.js';

export async function startRoadsLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats(); planAccess();
  scene.fog.density = 0.00022;
  // Blöcke wie in buildCity (nur die Rechtecke, keine Häuser), damit buildNetwork das Raster kennt
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < ST.length - 1; j++) {
    const b = { x0: AV[i].x + AV[i].w / 2, x1: AV[i + 1].x - AV[i + 1].w / 2, z0: ST[j].z + ST[j].w / 2, z1: ST[j + 1].z - ST[j + 1].w / 2 };
    if (b.x1 > PLAZA.x0 && b.x0 < PLAZA.x1 && b.z1 > PLAZA.z0 && b.z0 < PLAZA.z1) continue;
    if (![[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].every(([x, z]) => onIsland(x, z, KEEP))) continue;
    b.i = i; b.j = j; b.d = Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); blocks.push(b);
  }
  buildNetwork(); buildAccessRoad();
  // Boden und Straßenbänder aus dem Netz (flach, nur zur Orientierung)
  const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), stdMat({ color: 0x1a1b1f, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const strips = [], asph = stdMat({ color: 0x2c2d33, roughness: 0.9 });
  for (const e of NET.edges) {
    const P = e.pts;
    for (let k = 1; k < P.length; k++) {
      const [x0, z0] = P[k - 1], [x1, z1] = P[k], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.01) continue;
      if (e.kind === 'via' && Math.min(z0, z1) < VIA.end + 2) continue;   // in der Wendehalle liegt der eigene Boden
      const n = e.kind === 'via' ? Math.ceil(L / 12) : 1;   // Viadukt: Stücke entlang der Steigung
      for (let q = 0; q < n; q++) { const sx = x0 + (x1 - x0) * q / n, sz = z0 + (z1 - z0) * q / n, ex = x0 + (x1 - x0) * (q + 1) / n, ez = z0 + (z1 - z0) * (q + 1) / n;
        const g = new T.BoxGeometry(L / n, 0.1, e.w); g.rotateY(-Math.atan2(ez - sz, ex - sx)); g.translate((sx + ex) / 2, e.kind === 'via' ? deckY((sz + ez) / 2) - 0.02 : 0.02, (sz + ez) / 2); strips.push(g); }
    }
  }
  if (strips.length) scene.add(new T.Mesh(mergeGeos(strips), asph));
  // Blöcke als dunkle Klötze
  const bl = []; for (const b of blocks) { const g = new T.BoxGeometry(b.x1 - b.x0 - 6, 12, b.z1 - b.z0 - 6); g.translate((b.x0 + b.x1) / 2, 6, (b.z0 + b.z1) / 2); bl.push(g); }
  if (bl.length) scene.add(new T.Mesh(mergeGeos(bl), stdMat({ color: 0x24221f, roughness: 0.9 })));
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  // Laternen (Viadukt) als Masten mit Leuchtkopf
  { const g = [], h = []; for (const l of lamps) { const y = l.y || 0; g.push(new T.CylinderGeometry(0.08, 0.12, l.h || 5, 6).translate(l.x, y + (l.h || 5) / 2, l.z)); h.push(new T.SphereGeometry(0.35, 8, 6).translate(l.x, y + (l.h || 5) + 0.3, l.z)); }
    if (g.length) { scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x3a3a3f, roughness: 0.6 }))); scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); } }
  // Verkehr: Netzwagen wie im Spiel (Logik), Darstellung als einfache Karosserien
  buildLanes(); spawnTraffic(260);
  const carM = new T.InstancedMesh(carGeo(), stdMat({ color: 0x8a8a90, roughness: 0.4, metalness: 0.3 }), TRF.cars.length); carM.frustumCulled = false; scene.add(carM);
  const cc = new T.Color(), pal = [[0.05, 0.05, 0.06], [0.28, 0.04, 0.06], [0.75, 0.68, 0.55], [0.05, 0.16, 0.1], [0.08, 0.1, 0.22], [0.5, 0.36, 0.16]];
  TRF.cars.forEach((c, i) => carM.setColorAt(i, cc.setRGB(...pal[i % pal.length])));
  const _m = new T.Matrix4(), _p = new T.Vector3(), _q = new T.Quaternion(), _e = new T.Euler(), _s = new T.Vector3(1, 1, 1);
  const placeCars = () => {
    TRF.cars.forEach((car, i) => {
      const L = car.lane; let ly = 0;
      if (L && L.e.kind === 'via') ly = Math.max(0, deckY(car.wz) - 0.22);
      car.wy = ly;
      const ok = Number.isFinite(car.wx + car.wz + ly + car.yaw) && !car.gone;
      _q.setFromEuler(_e.set(0, ok ? car.yaw : 0, 0, 'YXZ')); _p.set(ok ? car.wx : 0, ok ? 0.22 + ly : -50, ok ? car.wz : 0);
      carM.setMatrixAt(i, _m.compose(_p, _q, _s));
    });
    carM.instanceMatrix.needsUpdate = true;
  };
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const relight = () => {
    const cp = camera.position; U.uInside.value = 0; hemi.intensity = 0.9;
    const near = LIGHTS.filter(a => cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  const dE = deckY(VIA.end);
  const V = {
    kreuz: [[-380, 40, -290], [-440, 2, -350]], kreuzunten: [[-452, 1.7, -320], [-440, 4, -350]],
    viadukt: [[22, deckY(-1200) + 3, -1150], [0, deckY(-1400) + 2, -1400]], viaduktfahrbahn: [[3, deckY(-1150) + 1.7, -1150], [0, deckY(-1300) + 1, -1300]],
    tunnel: [[0, deckY(VIA.end + 120) + 1.7, VIA.end + 120], [0, dE + 2, VIA.cav]], wendehalle: [[0, dE + 1.7, VIA.end + 6], [0, dE + 4, VIA.cav]], tor: [[12, dE + 1.7, VIA.cav + 4], [0, dE + 5, VIA.cav - VIA.R]],
    wendehalleoben: [[VIA.R - 4, dE + 14, VIA.cav + 10], [0, dE + 2, VIA.cav]], uebersicht: [[200, 220, 300], [-300, 0, -300]],
  };
  window.labView = name => { const v = V[name] || V.viadukt; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; relight(); };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'viadukt');
  window.labStats = () => { const byKind = {}; for (const c of TRF.cars) { const k = c.lane ? c.lane.e.kind : '?'; byKind[k] = (byKind[k] || 0) + 1; } return { cars: TRF.cars.length, byKind, maxY: Math.max(...TRF.cars.map(c => c.wy || 0)), lights: pool.map(l => +l.intensity.toFixed(2)) }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  // Verkehr 40 s vorlaufen lassen, damit die Wagen verteilt sind
  for (let k = 0; k < 400; k++) { try { updateTraffic(0.1, k * 0.1); } catch (e) { console.error(e); break; } }
  placeCars();
  const t0 = performance.now();
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    try { if (LABV.t == null) { updateTraffic(1 / 60, t); placeCars(); } } catch (e) { }
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
