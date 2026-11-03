/* =====================================================================
   V58 · WASSER-LABOR (index.html?lab=wasser[&composer=1][&view=eis][&t=40])
   Ohne die übrige Stadt: der gefrorene Kanal mit Gewölben, Brücken, Treppen, Buden und Grachtenhäusern, die
   Nachbarblöcke als dunkle Klötze; dazu Hafenwasser, Kai, Jachthafen, Güterkai mit Kran, Schlepper, Lastkahn,
   Wassertaxis, Fischer- und Ruderboote, Eisläufer und Hafenarbeiter. window.labTime(t) spult das Leben auf dem
   Wasser bis zur Zeit t vor (Schlepper, Kran, Taxis, Eisläufer). tools/lab-shot.js macht daraus Bilder (LAB=wasser).
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, mergeGeos } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { AV, ST, PLAZA, KEEP, onIsland, blocks, buildNetwork, buildSidewalks, planCanal, CANAL, COAST, ISL, rectPath } from './island.js';
import { planAccess, buildPort, PORT_PEDS, VESSELS } from './harbour.js';
import { buildHarborWaterMat, waterGridGeo, updateWaves, bobVessel } from './water.js';
import { WATER_Y } from './dance.js';
import { neons, glowPts, lamps } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { labFacadeMesh } from './deco.js';
import { Crowd, COATS, buildTrees } from './serpentine.js';
import { buildFX } from './particles.js';
import { buildCanal, buildFreightQuay, buildTaxiLanding, buildBoats, buildWaterPeople, updateWaterLife, assignWakes, WATER, FREIGHT, CRANE, routeWet } from './wasser.js';

export async function startWaterLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats(); planAccess();
  scene.fog.density = 0.0004;
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < ST.length - 1; j++) {
    const b = { x0: AV[i].x + AV[i].w / 2, x1: AV[i + 1].x - AV[i + 1].w / 2, z0: ST[j].z + ST[j].w / 2, z1: ST[j + 1].z - ST[j + 1].w / 2 };
    if (b.x1 > PLAZA.x0 && b.x0 < PLAZA.x1 && b.z1 > PLAZA.z0 && b.z0 < PLAZA.z1) continue;
    if (![[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]].every(([x, z]) => onIsland(x, z, KEEP))) continue;
    b.i = i; b.j = j; b.d = Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); blocks.push(b);
  }
  planCanal(); buildNetwork(); buildSidewalks();
  // Boden der Insel mit den Löchern des Kanals, wie im Spiel
  { const shp = new T.Shape(COAST.map(([x, z]) => new T.Vector2(x, -z)));
    for (const o of CANAL.open) shp.holes.push(rectPath(CANAL.x - CANAL.hw, o.z0, CANAL.x + CANAL.hw, o.z1));
    const g = new T.Mesh(new T.ShapeGeometry(shp).rotateX(-Math.PI / 2), stdMat({ color: 0x3a3c40, roughness: 0.85, envI: 0.4 })); scene.add(g); }
  // Nachbarblöcke als dunkle Klötze mit warmen Fenstern (Maßstab), nicht die Kanalblöcke
  { const bl = []; for (const b of blocks) if (!b.canal && Math.abs((b.x0 + b.x1) / 2 - CANAL.x) < 260 && (b.z0 + b.z1) / 2 > 0) { const h = 18 + ((b.i * 7 + b.j * 3) % 5) * 6; bl.push(new T.BoxGeometry(b.x1 - b.x0 - 9, h, b.z1 - b.z0 - 9).translate((b.x0 + b.x1) / 2, h / 2, (b.z0 + b.z1) / 2)); }
    if (bl.length) scene.add(new T.Mesh(mergeGeos(bl), stdMat({ color: 0x2a2724, roughness: 0.9 }))); }
  // Hafen: Wasser, Kai, Jachthafen, Fähranleger, Luftschiffhafen (wie im Spiel)
  const water = new T.Mesh(waterGridGeo(), buildHarborWaterMat()); water.position.set(0, WATER_Y, 0); water.frustumCulled = false; scene.add(water);
  { const q = new T.Mesh(new T.BoxGeometry(1600, 0.3, 30).translate(40, 0.1, 520), stdMat({ color: 0x6e6c6a, roughness: 0.8 })); scene.add(q); }
  try { buildPort(); } catch (e) { console.warn('Labor: Hafen', e); }
  buildFX();
  buildCanal(); buildFreightQuay(); buildTaxiLanding(); buildBoats();
  try { buildTrees(); } catch (e) { console.warn('Labor: Bäume', e); }
  buildWaterPeople();
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  { const g = [], h = []; for (const l of lamps) { if (l.wall) continue; const y = l.y ?? 0.22; g.push(new T.CylinderGeometry(0.08, 0.12, l.h || 5, 6).translate(l.x, y + (l.h || 5) / 2, l.z)); h.push(new T.SphereGeometry(0.3, 8, 6).translate(l.x, y + (l.h || 5) + 0.25, l.z)); }
    if (g.length) { scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x2a2a2e, roughness: 0.6 }))); scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); } }
  // Leute an Bord und am Kai (im Spiel macht das die große Menge)
  const PC = new Crowd([...new Set(PORT_PEDS.map(pd => pd.kind || 'coat'))], PORT_PEDS.length + 2);
  for (const pd of PORT_PEDS) { const k = pd.kind || 'coat'; pd.a = PC.add(k, pd.col || COATS[1]); pd.a.gait[1] = pd.act ?? 0.6; pd.a.gait[2] = 0; if (pd.sit) pd.yo = (k === 'lady' || k === 'dress' || k === 'gown' || k === 'furcoat' || k === 'flapper' ? 0.8 : 0.87) * (pd.sc || 1); }
  PC.finish();
  const placePeds = () => { for (const pd of PORT_PEDS) { if (pd.st === 8) { const g = pd.pf.g, c = Math.cos(g.rotation.y), sn = Math.sin(g.rotation.y); PC.set(pd.a, g.position.x + pd.lx * c + pd.lz * sn, g.position.y + pd.ly - (pd.yo || 0), g.position.z - pd.lx * sn + pd.lz * c, g.rotation.y + pd.lyaw, pd.sc || 1); } else if (pd.x != null) PC.set(pd.a, pd.x, pd.y - (pd.yo || 0), pd.z, pd.yaw || 0, pd.sc || 1); } PC.flag(); };
  // Licht wie im Spiel: die vier nächsten Punktlichter
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const relight = () => {
    const cp = camera.position; U.uInside.value = 0; hemi.intensity = 0.9;
    const near = LIGHTS.filter(a => cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  // Zeit: das Leben auf dem Wasser in festen Schritten bis t vorspulen (Schlepper legt nach 70-110 s ab, Kran arbeitet vorher)
  const SIM = { t: 0 };
  const sim = t => { while (SIM.t < t - 1e-6) { const dt = Math.min(0.1, t - SIM.t); SIM.t += dt; U.uTime.value = SIM.t; updateWaves(dt); updateWaterLife(dt, SIM.t); for (const v of VESSELS) if (v.kind === 'moored') bobVessel(v, SIM.t); } assignWakes(WATER.wakes.slice()); placePeds(); };
  const cx = CANAL.x, o = CANAL.open, o1 = o[1] || o[0], o0 = o[0], ice = CANAL.ice, tn = CANAL.tun[1] || CANAL.tun[0];
  const br = WATER.spots.find(s => s.kind === 'bridge' && s.k === 1) || WATER.spots.find(s => s.kind === 'bridge');
  const st0 = WATER.spots.find(s => s.kind === 'stair'), bo = WATER.spots.filter(s => s.kind === 'booth');
  const tug = WATER.tug && WATER.tug.v.g.position, taxi = WATER.taxis[0] && WATER.taxis[0].v.g.position;
  const V = {
    kanal: [[cx + 70, 55, o0.z0 - 40], [cx, -2, (CANAL.zA + CANAL.zB) / 2]],
    kanalhoch: [[cx - 160, 140, CANAL.zA - 120], [cx, 0, (CANAL.zA + CANAL.zB) / 2]],
    eis: [[cx - 6.5, ice + 1.6, o1.z0 + 4], [cx + 2, ice + 1.0, o1.z0 + 26]],
    eisnah: [[cx + 1.5, ice + 1.5, o1.z0 + 2], [cx + 3.5, ice + 1.0, o1.z0 + 12]],
    bruecke: [[br.x - 4, 2.0, br.z - 20], [br.x, 0.5, br.z]],
    vonbruecke: [[br.x + 3, 2.9, br.z + 1.6], [br.x + 3, ice, br.z + 30]],
    strasse: [[cx - 26, 1.7, tn.z0 - 1], [cx + 10, 0.6, (tn.z0 + tn.z1) / 2]],
    gewoelbe: [[cx - 1.5, ice + 1.6, tn.z0 - 14], [cx + 1, ice + 1.2, tn.z1 + 4]],
    imgewoelbe: [[cx - 4, ice + 1.5, (tn.z0 + tn.z1) / 2 - 6], [cx + 3, ice + 1.0, tn.z1 + 10]],
    treppe: [[st0.x - st0.s * 9, 2.4, st0.z - 12], [st0.x, ice + 0.5, st0.z - 3]],
    bude: bo[0] ? [[bo[0].x - bo[0].s * 7, 1.7, bo[0].z - 5], [bo[0].x, 1.4, bo[0].z]] : [[0, 2, 0], [0, 0, 10]],
    maronen: bo[1] ? [[bo[1].x - bo[1].s * 7, 1.7, bo[1].z + 5], [bo[1].x, 1.4, bo[1].z]] : [[0, 2, 0], [0, 0, 10]],
    haeuser: [[cx + 4, 1.8, o1.z1 - 4], [cx - 22, 6, o1.z0 + 14]],
    gueterkai: [[FREIGHT.x + 26, 9, 640], [FREIGHT.x - 6, 1, 590]],
    kran: [[FREIGHT.x + 12, 4, 572], [CRANE.x - 4, 6, 594]],
    mole: [[FREIGHT.x + 2, 1.7, 572], [FREIGHT.x - 2, 1.2, 610]],
    schlepper: tug ? [[tug.x - 22, 6, tug.z + 18], [tug.x, 1, tug.z + 8]] : [[0, 2, 0], [0, 0, 10]],
    taxi: taxi ? [[taxi.x + 14, 3, taxi.z + 12], [taxi.x, 0, taxi.z]] : [[0, 2, 0], [0, 0, 10]],
    anleger: [[300 + 14, 3.0, 528], [300, -0.5, 548]],
    bucht: [[-150, 80, 470], [-150, 0, 760]],
    buchtwest: [[-520, 40, 520], [-620, 0, 720]],
    fischer: [[160 - 14, 3, 880 - 10], [160, 0, 880]],
  };
  window.labView = name => { const v = V[name] || V.kanal; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; relight(); placePeds(); updateWaterLife(0, SIM.t); };
  window.labTime = t => { sim(t); };
  window.labStats = () => {
    let tris = 0, draws = 0; const cnt = o2 => { if (o2.visible === false) return; if (o2.isMesh && o2.geometry) { const g = o2.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o2.isInstancedMesh ? o2.count : 1); draws++; } for (const c of o2.children) cnt(c); }; cnt(scene);
    return { tris: Math.round(tris), draws, ...WATER.stats, tug: WATER.tug && { wait: +WATER.tug.wait.toFixed(1), v: +WATER.tug.v0.toFixed(2), x: Math.round(tug.x), z: Math.round(tug.z) }, taxis: WATER.taxis.map(X => ({ wait: +X.wait.toFixed(1), sp: +X.sp.toFixed(2), x: Math.round(X.v.g.position.x), z: Math.round(X.v.g.position.z) })), wetTug: routeWet(WATER.routes.tug).slice(0, 8), wetTaxi: routeWet(WATER.routes.taxi).slice(0, 8), simT: SIM.t };
  };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible)[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  sim(params.get('t') != null ? +params.get('t') : 40);
  window.labView(params.get('view') || 'kanal');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const loop = () => {
    U.uTime.value = SIM.t; U.uCam.value.copy(camera.position);
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
