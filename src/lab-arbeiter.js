/* =====================================================================
   V44 · ARBEITER-LABOR (index.html?lab=arbeiter[&composer=1][&view=platz][&t=12.5])
   Nur der Kneipenplatz im Arbeiterviertel und die Blöcke drumherum: The Brass Lantern innen und außen,
   Werkstatt, Mietshäuser, Feuertreppe, Kiosk, Feuertonnen, Wäscheleinen und Rohre in den Gassen, mit den
   Leuten. Zum Prüfen im Software-Renderer (tools/lab-shot.js, LAB=arbeiter); die ganze Stadt wäre dort zu schwer.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { AV, ST, PLAZA, KEEP, onIsland, blocks } from './island.js';
import { buildBlock } from './shops.js';
import { neons, glowPts, lamps } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { labFacadeMesh } from './deco.js';
import { venue, VENUE_PEDS, VENUES } from './venues.js';
import { WORK, buildWorkersQuarter, buildSquareGround, buildWorkerCell, WORK_CELL, workStats } from './workers.js';
import { Crowd, STREET, cobbleTextures, COATS } from './serpentine.js';
import { loadManifest, applyTextures } from './assets.js';
import { buildParticles } from './traffic.js';

export async function startWorkersLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  try { await loadManifest(); } catch (e) { /* ohne Fotos */ }
  scene.fog.density = 0.0006;
  // Blöcke wie in buildCity; gebaut werden nur die um den Platz (Arbeiterblöcke), der Platzblock ist ein Park
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < ST.length - 1; j++) {
    const b = { x0: AV[i].x + AV[i].w / 2, x1: AV[i + 1].x - AV[i + 1].w / 2, z0: ST[j].z + ST[j].w / 2, z1: ST[j + 1].z - ST[j + 1].w / 2 };
    if (b.x1 > PLAZA.x0 && b.x0 < PLAZA.x1 && b.z1 > PLAZA.z0 && b.z0 < PLAZA.z1) continue;
    if (![[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].every(([x, z]) => onIsland(x, z, KEEP))) continue;
    b.i = i; b.j = j; b.d = Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); blocks.push(b);
  }
  const at = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  const sqB = blocks.find(b => at(b, 165, -735)) || blocks[0];
  sqB.park = true; sqB.tier = 'fabric';
  for (const b of blocks) if (b !== sqB && Math.abs((b.x0 + b.x1) / 2 - 165) < 200 && Math.abs((b.z0 + b.z1) / 2 + 735) < 130) { b.tier = 'fabric'; buildBlock(b); }
  const pub = buildWorkersQuarter();
  if (pub) venue({ name: 'THE BRASS LANTERN', kind: 'bar', ...pub, pub: true });
  // Boden: Kopfsteinpflaster, Gehwege der Blöcke als flache Platten
  const cob = cobbleTextures(); cob.map.repeat.set(1, 1);
  const gg = new T.PlaneGeometry(900, 600).rotateX(-Math.PI / 2).translate(165, 0, -735), pp = gg.attributes.position, uv = gg.attributes.uv;
  for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / 5, pp.getZ(i) / 5);
  const ground = new T.Mesh(gg, stdMat({ map: cob.map, roughnessMap: cob.rough, normalMap: cob.normal, color: 0xc4ccd0, roughness: 0.85, metalness: 0.08, envI: 0.45 }));
  scene.add(ground); STREET.ground = ground;
  { const g = []; for (const b of blocks) if (Math.abs((b.x0 + b.x1) / 2 - 165) < 300 && Math.abs((b.z0 + b.z1) / 2 + 735) < 200) g.push(new T.BoxGeometry(b.x1 - b.x0, 0.22, b.z1 - b.z0).translate((b.x0 + b.x1) / 2, 0.11, (b.z0 + b.z1) / 2));
    const { mergeGeos } = await import('./core.js'); scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x6a6c70, roughness: 0.8 }))); }
  buildSquareGround();
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  { const g = [], h = []; for (const l of lamps) { if (l.wall) continue; const y = l.y || 0.22; g.push(new T.CylinderGeometry(0.08, 0.12, l.h || 5, 6).translate(l.x, y + (l.h || 5) / 2, l.z)); h.push(new T.SphereGeometry(0.3, 8, 6).translate(l.x, y + (l.h || 5) + 0.25, l.z)); }
    const { mergeGeos } = await import('./core.js');
    if (g.length) { scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x2a2a2e, roughness: 0.6 }))); scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); } }
  buildParticles();
  // Gassen: alle Zellen in der Nähe bauen (im Spiel macht das die Chunk-Schicht)
  const cells = new Set(WORK.alleys.map(A => Math.floor(A.x / WORK_CELL) + ',' + Math.floor((A.z0 + A.z1) / 2 / WORK_CELL)));
  for (const k of cells) { const [cx, cz] = k.split(',').map(Number); const g = buildWorkerCell(cx, cz); if (g) scene.add(g); }
  // Leute: wie im Spiel über VENUE_PEDS (Kneipe, Platz, Feuertonnen)
  const C = new Crowd(['coat', 'suit', 'worker', 'lady', 'dress', 'furcoat', 'police', 'kid', 'tux', 'gown', 'livery', 'waiter', 'sailor', 'chauffeur'], VENUE_PEDS.length + 4);
  for (const pd of VENUE_PEDS) { const k = pd.kind || 'coat'; pd.a = C.add(k, pd.col || COATS[1]); pd.fem = k === 'lady' || k === 'dress' || k === 'gown' || k === 'furcoat'; pd.a.gait[1] = pd.act ?? 0.6; pd.a.gait[2] = 0; if (pd.sit) pd.yo = (pd.fem ? 0.8 : 0.87) * pd.sc; }
  C.finish();
  for (const pd of VENUE_PEDS) C.set(pd.a, pd.x, pd.y - (pd.yo || 0), pd.z, pd.yaw, pd.sc || 1);
  for (const V of VENUES) if (V.dishes) V.dishes.visible = true;
  await applyTextures().catch(() => {});
  // Lichter wie im Spiel: die vier nächsten Punktlichter
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const PV = VENUES[0], A = WORK.alleys.filter(a => !a.gap && a.lines).sort((a, b) => b.lines.length - a.lines.length)[0] || WORK.alleys[0], S = WORK.square;
  const relight = () => {
    const cp = camera.position, ins = PV && cp.x > PV.x0 && cp.x < PV.x1 && cp.z > PV.z0 && cp.z < PV.z1 && cp.y < 5.5;
    hemi.intensity = 0.9 * (ins ? 0.3 : 1); moonLight.intensity = ins ? 0 : moonLight.intensity;
    const near = LIGHTS.filter(a => !a.inside && cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  const px = PV ? PV.x : 165, pz1 = PV ? PV.z1 : -740, px0 = PV ? PV.x0 : 150, pz0 = PV ? PV.z0 : -755, px1 = PV ? PV.x1 : 175;
  const Vw = {
    platz: [[px + 6, 1.7, pz1 + 24], [px + 4, 4, pz1 - 4]],
    platzhoch: [[px + 10, 14, pz1 + 40], [px + 10, 2, pz1 - 2]],
    eingang: [[px + 1, 1.7, pz1 + 6], [px, 3.2, pz1]],
    laterne: [[px1 - 3, 2.2, pz1 + 6], [px1 - 1.4, 4.4, pz1 + 1.6]],
    kneipe: [[px1 - 2, 1.75, pz1 - 1.2], [px0 + 2, 1.3, pz0 + 6]],
    theke: [[px0 + 6.5, 1.75, pz0 + 9], [px0 + 1, 1.5, pz0 + 5]],
    klavier: [[px0 + 15, 1.75, pz1 - 4], [px1 - 0.5, 1.2, pz1 - 3]],
    dart: [[px0 + 11, 1.7, pz0 + 7.5], [px0 + 11, 1.6, pz0]],
    werkstatt: [[S ? (S.shop.x0 + S.shop.x1) / 2 + 1 : px, 1.8, S ? S.shop.z1 + 8 : pz1], [S ? (S.shop.x0 + S.shop.x1) / 2 : px, 1.6, S ? S.shop.z0 : pz0]],
    feuertreppe: [[S ? S.X1 - 30 : px, 2, S ? S.Z + 22 : pz1], [S ? S.X1 - 17 : px, 7, S ? S.Z + 17 : pz1]],
    kiosk: [[S ? S.X1 - 18 : px, 1.7, S ? S.Z1 - 1 : pz1], [S ? S.X1 - 12 : px, 1.5, S ? S.Z1 - 6 : pz1]],
    tonne: [[px + 3, 1.6, pz1 + 13.5], [px - 1, 1.0, pz1 + 9.5]],
    gasse: [[A ? A.x + 0.5 : px, 1.7, A ? A.z0 + 0.5 : pz1], [A ? A.x : px, 7.5, A ? A.z0 + 22 : pz1]],
    gasse2: [[A ? A.x : px, 2.2, A ? A.z1 - 3 : pz1], [A ? A.x : px, 7.5, A ? A.z0 + 8 : pz1]],
    luecke: [[px0 - 1.5, 2, pz1 + 8], [px0 - 1.5, 9, pz0 + 4]],
  };
  window.labView = name => { const v = Vw[name] || Vw.platz; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; relight(); C.flag(); };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'platz');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(scene); return { tris: Math.round(tris), draws, peds: VENUE_PEDS.length, ...workStats(), lights: pool.map(l => +l.intensity.toFixed(2)) }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now();
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position); C.flag();
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
