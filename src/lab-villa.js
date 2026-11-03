/* =====================================================================
   V41 · VILLA-LABOR (index.html?lab=villa[&composer=1][&view=halle][&t=12.5])
   Nur Alexanders Bergvilla (Haus, Terrassen, Garten, Vorfahrt) ohne Stadt und Berg: zum Prüfen der Helligkeit,
   der Treppe, der Einrichtung, des Brunnens und der Pflanzen, auch im Software-Renderer (tools/lab-shot.js).
   Lichter wie im Spiel: höchstens vier Punktlichter, die der Kamera nächsten; innen nur, wenn die Kamera im Haus steht.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { buildVilla } from './serpentine.js';
import { VILLA } from './harbour.js';
import { VR, updateVillaZones, updateVillaRooms, inVillaHouse, villaLocal } from './villa.js';
import { neons, glowPts } from './facade-shader.js';
import { makeGlowPoints } from './ragdoll.js';
import { LIGHTS } from './performance.js';
import { player } from './player.js';
import { labFacadeMesh } from './deco.js';
import { SPAWNS, spawnProp, updateLoose } from './physics.js';
import { hookVilla } from './haushalt.js';   // V57: Personal, Randolf, Bedienung

export async function startVillaLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  scene.fog.density = 0.00025;
  buildVilla(); hookVilla();
  // V58: &schiff=1 legt die Aurora Imperial an den neuen Ankermast der Villa (zum Prüfen von Mast, Lage und Rufsäule)
  if (params.get('schiff')) { const IM = await import('./imperial.js'); const HB = await import('./harbour.js'); IM.buildImperial(); IM.IMP.st = 'moorV'; IM.impApply(IM.impPose('moorV', 0, IM.IMP._p)); IM.IMP.g.updateMatrixWorld(true); HB.pfRead(IM.IMP.pf); HB.pfSave(IM.IMP.pf); IM.IMP.inner.visible = false; IM.IMP.farGlow.visible = true; }
  scene.add(labFacadeMesh(FS));
  { const box = new T.BoxGeometry(1, 1, 1), nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2 }), neons.length), m = new T.Matrix4(), c = new T.Color(), q = new T.Quaternion(), e = new T.Euler(), p = new T.Vector3(), s = new T.Vector3();
    neons.forEach((n, i) => { m.compose(p.set(n.x, n.y, n.z), q.setFromEuler(e.set(0, n.ry || 0, n.rz || 0)), s.set(n.sx, n.sy, n.sz)); nm.setMatrixAt(i, m); nm.setColorAt(i, c.setRGB(...n.c)); }); scene.add(nm); }
  scene.add(makeGlowPoints(glowPts));
  if (VILLA.crowd) VILLA.crowd.flag();
  for (const S of SPAWNS) if (S.y0 != null && Math.abs(S.y0 - (VILLA.y - 30)) < 1) { S.done = true; for (const [type, x, z, yaw, up] of S.items) { const B = spawnProp(type, x, S.floor + (up || 0) + 0.02, z, yaw); if (B) B.awake = true; } }   // lose Gegenstände wie im Spiel
  const pool = []; for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); scene.add(l); pool.push(l); }
  const relight = () => {
    const cp = camera.position, ins = inVillaHouse(cp);
    U.uInside.value = ins ? 1 : 0; hemi.intensity = 0.9 * (1 - 0.72 * U.uInside.value); moonLight.intensity = ins ? 0 : moonLight.intensity;   // wie performance.js im Spiel
    const near = LIGHTS.filter(a => a.inside === ins && cp.distanceTo(a.p) / a.d < 1.5).sort((a, b) => cp.distanceTo(a.p) / a.d - cp.distanceTo(b.p) / b.d).slice(0, 4);
    pool.forEach((l, i) => { const a = near[i]; l.intensity = a ? a.i : 0; if (a) { l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay; } });
  };
  // Ansichten in Hauskoordinaten (lx, y über Plateau, lz; +lz zur Stadt): [Kamera, Blickpunkt]
  const by = VILLA.y, cs = VR.cs, sn = VR.sn;
  const Wp = (lx, y, lz) => new T.Vector3(VILLA.x + lx * cs + lz * sn, by + y, VILLA.z - lx * sn + lz * cs);
  const V = {
    halle: [[-6, 1.7, -3], [0, 3, -17]], treppe: [[0, 1.7, -20], [0, 4, -8]], treppeoben: [[0, 11.8, -3], [0, 6, -14]], halleoben: [[-9, 11.8, -3], [0, 4, -18]], unterlauf: [[-1, 1.7, -4], [6, 7.5, -10]], podest: [[0, 6.7, -3], [0, 8, -14]],
    salon: [[-16, 1.7, -4], [-24, 1.4, -16]], salon2: [[-28, 1.7, -20], [-18, 1.4, -8]], herren: [[16, 1.7, -4], [24, 1.4, -16]], speise: [[-32, 1.7, 5], [-45, 1.3, -3]],
    ballsaal: [[32, 1.7, 5], [45, 2.5, -12]], keller: [[0, -2.5, -12], [0, -3, -20]], schwimmhalle: [[36, -2.5, -8], [44, -3.5, -2]],
    og: [[3, 11.8, -2.5], [-10, 11.5, -18]], schreibtisch: [[-21, 11.8, -12.3], [-23.6, 11.0, -15]], palme: [[-10, 1.7, -2.5], [-12.4, 2.6, -5]], bibliothek: [[-19.5, 11.8, -3], [-26, 11.2, -5.5]], schlaf: [[-30, 11.8, -2], [-42, 11.3, -16]], arbeit: [[30, 11.8, -2], [42, 11.3, -16]],
    garten: [[0, 2.0, 2], [0, 3, 18]], gesinde: [[-45, -2.5, -11], [-49, -3.6, -2]], kueche: [[-31.5, 1.7, -12.5], [-42, 1.0, -18]], speisediener: [[-36, 1.7, 5.5], [-43, 1.0, -3]], betten: [[-36, 11.8, 2], [-43, 10.8, -5]], loggiagarten: [[-2, 11.8, 1.2], [-18, 10.8, 0.4]], randolf: [[-4, 1.7, -10], [0, 1.0, -16.2]], liegen: [[42.5, -2.5, -6], [42.5, -3.8, 3]], brunnen: [[6, 1.7, 10], [0, 2.5, 18]], loggia: [[20, 1.7, 8], [-10, 4, 0]], aussen: [[0, 10, 60], [0, 8, 0]], vorfahrt: [[-8, 2.5, -58], [0, 5, -24]], parkplatz: [[-20, 6, -60], [0, 2, -42]],
    pool: [[0, -3, 36], [18, -4.5, 45]], terrassen: [[-40, 6, 100], [0, -8, 50]],
    mast: [[-20, -15.3, 86], [-62, 4, 150]], mastseite: [[40, 20, 170], [-62, -10, 240]], mastoben: [[10, 60, 60], [-62, -10, 230]], rufsaeule: [[-5, -15.3, 81], [-12, -16, 87]],
  };
  const vis = () => { const v = updateVillaZones(true); if (VILLA.crowd) VILLA.crowd.flag(); return v; };
  window.labView = name => { const v = V[name] || V.halle; camera.position.copy(Wp(...v[0])); camera.lookAt(Wp(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; relight(); vis(); };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labRun = s => { for (let k = 0; k < s * 10; k++) { if (VR.tick) VR.tick(0.1, 0, null); } VILLA.crowd.flag(); };   // V57: Abläufe vorspulen
  window.labView(params.get('view') || 'halle');
  window.labStats = () => { let tris = 0, draws = 0; const cnt = o => { if (o.visible === false) return; if (o.isMesh && o.geometry) { const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (o.isInstancedMesh ? o.count : 1); draws++; } for (const c of o.children) cnt(c); }; cnt(scene); return { tris: Math.round(tris), draws, zones: Object.fromEntries(Object.entries(VR.groups).map(([k, g]) => [k, g.visible])), local: (() => { const l = villaLocal(camera.position); return [l.x, l.y, l.z].map(v => +v.toFixed(1)); })(), lights: pool.map(l => +l.intensity.toFixed(2)) }; };
  const ray = new T.Raycaster();
  window.labPick = (u, v) => { ray.setFromCamera(new T.Vector2(u * 2 - 1, 1 - v * 2), camera); const h = ray.intersectObjects(scene.children, true).filter(i => i.object.visible && (!i.object.parent || i.object.parent.visible))[0]; return h ? [h.object.material && h.object.material.name, h.object.type, h.point.toArray().map(x => +x.toFixed(2)), h.distance.toFixed(2)] : null; };
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now();
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000; U.uTime.value = t; U.uCam.value.copy(camera.position);
    try { updateVillaRooms(t, VILLA.crowd, 0); updateLoose(1 / 60); } catch (e) { }
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
