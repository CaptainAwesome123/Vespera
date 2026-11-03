/* =====================================================================
   V41 · PENTHOUSE-LABOR (index.html?lab=penthouse[&composer=1][&view=salon][&t=12.5])
   Nur Alexanders Suite mit Terrasse und den Turmstufen darum, ohne die Stadt: zum Prüfen der Einrichtung,
   der Glasfassade von außen und der losen Dinge, auch im Software-Renderer (tools/lab-shot.js macht Bilder).
   Lichter: wie im Spiel höchstens vier Punktlichter, die der Kamera nächsten; innen nur, wenn die Kamera in der Suite steht.
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { buildPenthouse, updatePenthouse, PH, inPenthouse } from './penthouse.js';
import { addSeg, addNeon, neons, glowPts, NEON } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { BEL } from './belmont.js';
import { labFacadeMesh } from './deco.js';
import { LOOSE, SPAWNS, spawnProp, updateLoose } from './physics.js';
import { buildPentStaff, updatePentStaff } from './haushalt.js';

export async function startPenthouseLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  scene.fog.density = 0.00025;
  // Turmstufen um die Suite: Stufe 2 darunter (50 m), Stufe darüber (40 m), Eckpfeiler
  const cream = [0.17, 0.155, 0.18];
  addSeg({ x: 0, z: 0, w: 50, d: 50, y0: BEL.s1, y1: BEL.s2, tint: cream, seed: 504, style: 1, dens: 0.66, flood: 1, rib: [0.5, 0.36, 0.16] });
  addSeg({ x: 0, z: 0, w: 40, d: 40, y0: BEL.s2 + 13, y1: BEL.s3, tint: [0.3, 0.26, 0.24], seed: 505, style: 2, dens: 1, flood: 1, fl: FS.FL.noBot }, false);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { addSeg({ x: sx * 25, z: sz * 25, w: 6, d: 6, y0: BEL.s1, y1: BEL.s2 + 10, tint: cream, seed: 511, style: 1, dens: 0.3, flood: 1 }, false); addNeon(sx * 25, BEL.s2 + 10.2, sz * 25, 6.4, 0.35, 6.4, NEON.gold); }
  buildPenthouse();
  buildPentStaff();   // V57: Personal der Suite
  scene.add(labFacadeMesh(FS));
  // Leuchtleisten schlicht (ohne das Verbreitern aus flushInstances)
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), neons.length), m = new T.Matrix4(), c = new T.Color();
    neons.forEach((n, i) => { m.makeScale(n.sx, n.sy, n.sz).setPosition(n.x, n.y, n.z); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); scene.add(nm); }
  scene.add(makeGlowPoints(glowPts));
  // Lose Dinge der Suite sofort ausstreuen (im Spiel beim Näherkommen)
  for (const S of SPAWNS) if (S.pent) for (const [type, x, z, yaw, up] of S.items) { const B = spawnProp(type, x, (S.floor ?? 0) + (up || 0), z, yaw); if (B) B.awake = true; }
  // Lichter: Pool aus vier Punktlichtern, bei jedem Blickwechsel neu verteilt
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const relight = () => {
    const cp = camera.position, ins = inPenthouse(cp);
    const near = LIGHTS.filter(a => a.inside === ins && cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  const F1 = PH.F1, F2 = PH.F2;
  const V = {
    salon: [[0, F1 + 1.7, 18.5], [0, F1 + 1.6, 4]], salonoben: [[-3, F2 + 1.7, -0.8], [2, F1 + 2.5, 12]], kamin: [[6, F1 + 1.6, 12], [-6, F1 + 1.6, 9]],
    essen: [[-6, F1 + 1.7, 8], [-13, F1 + 1.3, 2]], kueche: [[-9, F1 + 1.7, -6], [-16, F1 + 1.3, -14]], bar: [[9, F1 + 1.7, -2], [14, F1 + 1.4, -10]],
    raucher: [[9.5, F1 + 1.6, -13], [13, F1 + 1.0, -17]], foyer: [[0, F1 + 1.7, -7.5], [0, F1 + 1.5, -16]], schreibtisch: [[12.5, F1 + 1.7, -1.0], [16.4, F1 + 1.0, -3.4]], bib2: [[0, F2 + 1.6, -12.3], [0, F2 + 1.8, -16.3]], bib3: [[-3.5, F2 + 1.2, -9.5], [0, F2 + 2.0, -16.3]], vitrine: [[1.5, F1 + 1.5, 4.5], [0, F1 + 1.3, 1.8]], kaminnah: [[-3.0, F1 + 1.5, 9.5], [-6.0, F1 + 1.4, 9.5]], kueche2: [[-16, F1 + 1.6, -13], [-12, F1 + 1.2, -19.5]], bad2: [[-16.5, F2 + 1.6, -5], [-12.5, F2 + 1.0, -1]], ost: [[9, F1 + 1.7, 16], [16, F1 + 1.3, 6]],
    schlaf: [[8, F2 + 1.7, -8], [14, F2 + 1.0, -2]], bad: [[-7, F2 + 1.7, -7], [-14, F2 + 1.0, -14]], bibliothek: [[0, F2 + 1.7, -5], [0, F2 + 1.6, -13]],
    treppe: [[3, F1 + 1.6, 2], [0, F1 + 3, -4]], fluegel: [[-8.6, F1 + 1.5, 16.2], [-11.6, F1 + 0.9, 13.4]], konrad: [[5.5, F1 + 1.6, -7.5], [2.6, F1 + 1.1, -12.2]], kellner: [[-2, F1 + 1.7, 20.5], [8, F1 + 1.0, 25]], terrasse: [[0, F1 + 1.7, 23], [0, F1 + 1.2, 32]],
    aussen: [[70, 262, 95], [0, 256, 0]], aussenfern: [[0, 150, 330], [0, 256, 0]], strasse: [[40, 2, 150], [0, 252, 0]], aussennah: [[0, 254, 60], [0, 255, 0]], aussen200: [[60, 262, 190], [0, 256, 0]], aussen600: [[200, 120, 560], [0, 256, 0]],
  };
  window.labView = name => { const v = V[name] || V.salon; camera.position.set(...v[0]); camera.lookAt(...v[1]); player.p.copy(camera.position); player.p.y -= 1.6; relight(); updatePenthouse(0, true); };
  const LABP = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABP.t = t; };
  window.labRun = s => { for (let k = 0; k < s * 10; k++) updatePentStaff(0.1); };   // V57: Abläufe vorspulen
  window.labView(params.get('view') || 'salon');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(PH.inner); const inner = { tris: Math.round(tris), draws }; tris = 0; draws = 0; cnt(PH.terrace); return { inner, terrace: { tris: Math.round(tris), draws }, bodies: LOOSE.bodies.length, emis: PH.emis.length, farK: PH.farK, innerVisible: PH.inner.visible, farVisible: PH.far.visible, cam: camera.position.toArray().map(Math.round) }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now(); let last = 0;
  const loop = now => {
    const t = LABP.t != null ? LABP.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try { updateLoose(dt); } catch (e) { /* Physik braucht im Labor nicht alles */ }
    try { updatePentStaff(dt); } catch (e) { console.error(e); }
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
