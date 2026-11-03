/* =====================================================================
   V58 · ORTE-LABOR (index.html?lab=orte[&view=saal][&t=12.5][&composer=1])
   Nur der Theaterblock (Varieté Metropol, Vespera-Bank) und der Parkblock mit dem Café Kranich samt
   Nachbarblöcken, mit den Leuten. Zum Prüfen im Software-Renderer (tools/lab-shot.js, LAB=orte);
   die ganze Stadt wäre dort zu schwer. Die Revue läuft (updateOrte), die Leute stehen und sitzen wie im Spiel.
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
import { VENUE_PEDS, VENUES } from './venues.js';
import { ORTE, buildOrte, updateOrte } from './orte.js';
import { Crowd, STREET, cobbleTextures, COATS } from './serpentine.js';
import { loadManifest, applyTextures } from './assets.js';
import { buildParticles } from './traffic.js';

export async function startOrteLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  try { await loadManifest(); } catch (e) { /* ohne Fotos */ }
  scene.fog.density = 0.0006;
  for (let i = 0; i < AV.length - 1; i++) for (let j = 0; j < ST.length - 1; j++) {
    const b = { x0: AV[i].x + AV[i].w / 2, x1: AV[i + 1].x - AV[i + 1].w / 2, z0: ST[j].z + ST[j].w / 2, z1: ST[j + 1].z - ST[j + 1].w / 2 };
    if (b.x1 > PLAZA.x0 && b.x0 < PLAZA.x1 && b.z1 > PLAZA.z0 && b.z0 < PLAZA.z1) continue;
    if (![[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].every(([x, z]) => onIsland(x, z, KEEP))) continue;
    b.i = i; b.j = j; b.d = Math.hypot((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2); blocks.push(b);
  }
  const at = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  const sites = [[385, -35], [165, 315]];
  for (const [x, z] of sites) { const b = blocks.find(q => at(q, x, z)); if (b) { b.park = true; b.tier = 'fabric'; buildBlock(b); } }
  const only = params.get('nur');   // nur=theater | cafe: Nachbarn nur um diesen Ort
  for (const b of blocks) if (!b.park) for (const [x, z] of sites) if ((!only || (only === 'cafe') === (z > 0)) && Math.abs((b.x0 + b.x1) / 2 - x) < 150 && Math.abs((b.z0 + b.z1) / 2 - z) < 110) { b.tier = 'fabric'; buildBlock(b); break; }
  buildOrte();
  const cob = cobbleTextures(); cob.map.repeat.set(1, 1);
  const ground = new T.Mesh(new T.PlaneGeometry(2400, 2400).rotateX(-Math.PI / 2), stdMat({ map: cob.map, roughnessMap: cob.rough, normalMap: cob.normal, color: 0x9ca4a8, roughness: 0.85, metalness: 0.08, envI: 0.45 }));
  { const pp = ground.geometry.attributes.position, uv = ground.geometry.attributes.uv; for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / 5, pp.getZ(i) / 5); }
  scene.add(ground); STREET.ground = ground;
  { const { mergeGeos } = await import('./core.js'); const g = []; for (const b of blocks) if (b.tier || b.park) g.push(new T.BoxGeometry(b.x1 - b.x0, 0.22, b.z1 - b.z0).translate((b.x0 + b.x1) / 2, 0.11, (b.z0 + b.z1) / 2)); if (g.length) scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x6a6c70, roughness: 0.8 }))); }
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), Math.max(1, neons.length)), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); nm.count = neons.length; scene.add(nm); }
  if (glowPts.length) scene.add(makeGlowPoints(glowPts));
  { const { mergeGeos } = await import('./core.js'); const g = [], h = []; for (const l of lamps) { if (l.wall) continue; const y = l.y || 0.22; g.push(new T.CylinderGeometry(0.08, 0.12, l.h || 5, 6).translate(l.x, y + (l.h || 5) / 2, l.z)); h.push(new T.SphereGeometry(0.3, 8, 6).translate(l.x, y + (l.h || 5), l.z)); }
    if (g.length) { scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x2a2a2e, roughness: 0.6 }))); scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); } }
  { const { trees } = FS; const { mergeGeos } = await import('./core.js'); const g = []; for (const t of trees) { g.push(new T.ConeGeometry(1.6 * t.s, 5 * t.s, 7).translate(t.x, 0.22 + 2.5 * t.s + 1.2, t.z)); g.push(new T.CylinderGeometry(0.12, 0.16, 1.4, 6).translate(t.x, 0.9, t.z)); } if (g.length) scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x1e3a2a, roughness: 0.9 }))); }
  buildParticles();
  const C = new Crowd(['coat', 'suit', 'worker', 'lady', 'dress', 'furcoat', 'police', 'kid', 'tux', 'gown', 'livery', 'waiter', 'sailor', 'chauffeur', 'braces', 'jacket', 'dbl', 'flapper'], VENUE_PEDS.length + 4);
  for (const pd of VENUE_PEDS) { const k = pd.kind || 'coat'; pd.a = C.add(k, pd.col || COATS[1]); pd.fem = k === 'lady' || k === 'dress' || k === 'gown' || k === 'furcoat' || k === 'flapper'; pd.a.gait[1] = pd.act ?? 0.6; pd.a.gait[2] = 0; if (pd.sit) pd.yo = (pd.fem ? 0.8 : 0.87) * (pd.sc || 1); }
  C.finish();
  const place = () => { for (const pd of VENUE_PEDS) C.set(pd.a, pd.x, pd.y - (pd.yo || 0), pd.z, pd.yaw, pd.sc || 1, pd.tilt || 0); };
  place();
  for (const V of VENUES) if (V.dishes) V.dishes.visible = true;
  await applyTextures().catch(() => {});
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const TH = ORTE.theater, BK = ORTE.bank, CF = ORTE.cafe;
  const relight = () => {
    const cp = camera.position, ins = (TH && TH.inside(cp.x, cp.z, cp.y)) || (BK && BK.inside(cp.x, cp.z, cp.y)) || (CF && CF.inside(cp.x, cp.z, cp.y));
    hemi.intensity = 0.9 * (ins ? 0.3 : 1); moonLight.intensity = ins ? 0 : 0.45;
    const near = LIGHTS.filter(a => cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  const Vw = {};
  if (TH) { const { x0: X0, x1: X1, z0: Z0, z1: Z1, z: cz, F, xT, xS, LY, SY, rx0 } = TH;
    Object.assign(Vw, {
      theater: [[X0 - 26, 3.5, cz + 16], [X0 + 4, 6, cz]], vordach: [[X0 - 7, 1.7, cz - 4], [X0 - 1, 3.4, cz + 2]], plakat: [[X0 - 2.6, 1.6, cz + 7.6], [X0 - 0.3, 2.1, cz + 5.6]],
      foyer: [[X0 + 0.9, 1.9, cz + 0.5], [X0 + 9, 3.4, cz + 1.5]], kasse: [[X0 + 5, 1.7, Z0 + 9], [X0 + 2, 1.5, Z0 + 4]], theaterbar: [[X0 + 2.2, 1.7, Z1 - 6.5], [X0 + 5.5, 1.4, Z1 - 1.3]], treppe: [[X0 + 4.5, 1.7, cz - 7], [xT + 1, LY + 1.2, cz - 2]],
      saal: [[xT + 1.0, LY + 1.7, cz], [xS + 6, SY + 2, cz]], buehne: [[rx0 + 5.5, F + 2.4, cz + 3], [xS + 6, SY + 1.4, cz]], reihen: [[xS + 1, SY + 1.9, cz + 1], [rx0 + 2, LY, cz]], loge: [[rx0 + 4.5, F + 2.4, cz - 7], [rx0 + 1.5, F + 4.0, Z0 + 1.5]], graben: [[rx0 + 6.5, F + 1.8, cz - 6], [xS - 1.2, F + 1.0, cz + 1]],
    }); }
  if (BK) { const { x0: X0, x1: X1, cz, F, ix0, ix1, sx, hx, hz0, vault } = BK;
    Object.assign(Vw, {
      bank: [[X1 + 13, 2.2, cz + 17], [X1 + 1, 6, cz]], portal: [[X1 + 8, 1.9, cz + 3], [X1 + 0.5, 3.5, cz]],
      halle: [[ix1 - 1.5, F + 1.8, cz + 0.5], [ix0 + 5, F + 2.2, cz]], schalter: [[sx + 5.5, F + 1.7, cz - 6], [sx, F + 1.7, cz - 1.5]], decke: [[hx + 4, F + 1.7, cz + 8], [hx - 6, F + 8.5, cz - 4]],
      tresortuer: [[vault.door.x + 1.5, F + 1.7, hz0 + 3.0], [vault.door.x, F + 1.5, hz0 - 2]], tresor: [[(vault.x0 + vault.x1) / 2 + 2.6, F + 1.7, vault.z1 - 1.2], [(vault.x0 + vault.x1) / 2, F + 1.0, (vault.z0 + vault.z1) / 2]],
    }); }
  if (CF) { const { x0, x1, z0, z1, x, z, F } = CF;
    Object.assign(Vw, { cafe: [[x + 4, 2.0, z1 + 16], [x, 3.5, z]], cafeinnen: [[x1 - 2, 1.75, z1 - 1.2], [x0 + 2, 1.3, z0 + 6]], terrasse: [[x - 12, 1.9, z0 - 7], [x + 5, 1.2, z0 - 2.4]], kuchen: [[x0 + 6, 1.7, z0 + 8], [x0 + 1, 1.4, z0 + 4]] }); }
  window.labView = name => { const v = Vw[name] || Vw.theater || Object.values(Vw)[0]; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; relight(); C.flag(); };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'theater');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(scene); return { tris: Math.round(tris), draws, peds: VENUE_PEDS.length, lights: LIGHTS.length }; };
  window.labOrte = { ORTE, VENUE_PEDS, VENUES, place, C };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now(); let last = 0;
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
    if (!params.has('still')) { updateOrte(dt); place(); }
    C.flag();
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
