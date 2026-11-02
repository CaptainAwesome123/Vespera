/* =====================================================================
   V53 · KRAM-LABOR (index.html?lab=kram[&view=alles][&t=12.5])
   Ohne Stadt: alle neuen losen Dinge in Reihen auf dunklem Boden, dazu ein
   Stück Gehweg mit Hauswand, wie planClutter() es füllt (Fahrrad angelehnt,
   Kinderwagen, Zeitungsständer, Blumentöpfe, Maronistand, Telefonzelle,
   Schaufel, Schlitten), eine Café-Terrasse, ein Dachgarten-Eck und eine
   Laterne, die gerade von der Telekinese gepackt schwebt.
   tools/lab-shot.js macht daraus Bilder (LAB=kram).
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { GEOS, KINDS_OF, propMaterial, LOOSE, spawnProp, updateLoose } from './physics.js';
import { clutterGeos } from './clutter-geos.js';
import { decoLampGeo, decoLampMats } from './decolamp.js';
import { awningTex, tankTex, chimTex } from './serpentine.js';

export function startKramLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  const L = (c, i, d, x, y, z) => { const l = new T.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); };
  L(0xffc27a, 2.6, 22, 2, 4.5, 4); L(0x58d0d0, 1.0, 20, -6, 3, 1); L(0xffc27a, 2.0, 22, 10, 4.5, -2); L(0xffc27a, 2.0, 22, -12, 4.5, -2); L(0xffc27a, 1.6, 18, 0, 4, -9);
  const floor = new T.Mesh(new T.PlaneGeometry(80, 60), stdMat({ color: 0x24201c, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const K = KINDS_OF(), names = Object.keys(clutterGeos()), mat = propMaterial(), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  const place = (k, x, z, yaw = 0, y0 = 0, tilt = 0, col = null) => {
    const g = GEOS[k](), I = K[k], mesh = new T.Mesh(g, mat);
    if (col) { const im = new T.InstancedMesh(g, mat, 1); e.set(tilt, yaw, 0, 'YXZ'); im.setMatrixAt(0, m.compose(new T.Vector3(x, y0 + I.he[1] * Math.cos(tilt) + Math.abs(Math.sin(tilt)) * I.he[2], z), q.setFromEuler(e), new T.Vector3(1, 1, 1))); im.setColorAt(0, new T.Color(...col)); scene.add(im); return; }
    mesh.position.set(x, y0 + I.he[1] * Math.cos(tilt) + Math.abs(Math.sin(tilt)) * I.he[2], z); mesh.rotation.set(tilt, yaw, 0, 'YXZ'); scene.add(mesh);
  };
  // ---- alle neuen Arten in drei Reihen (Reihe 1: Straße, 2: Hof/Hafen/Dach, 3: Zimmer) ----
  const rows = [names.slice(0, 12), names.slice(12, 22), names.slice(22)];
  const W = { phonebooth: 1.4, flowercart: 2.0, bicycle: 2.0, handcart: 1.8, wheelbarrow: 1.6, luggagecart: 1.4, chestnut: 1.2, deckchair: 1.3, ladder: 1.0, shoeshine: 1.0 };
  rows.forEach((row, r) => { let x = 0; const ws = row.map(k => W[k] || 0.75), tot = ws.reduce((a, b) => a + b, 0); x = -tot / 2;
    row.forEach((k, i) => { x += ws[i] / 2; const PAINTS = { bicycle: [0.08, 0.22, 0.2], pram: [0.12, 0.2, 0.3], newsstand: [0.1, 0.25, 0.22], flowercart: [0.1, 0.3, 0.2], chestnut: [0.35, 0.08, 0.06], phonebooth: [0.35, 0.05, 0.05], deckchair: [0.1, 0.35, 0.36] }; place(k, x, -r * 2.6, 0.25, 0, 0, PAINTS[k] || [1, 1, 1]); x += ws[i] / 2; }); });
  // ---- Gehweg mit Hauswand (rechts, x 14..30), Bordstein bei z = 6, Wand bei z = 2.5 ----
  const SX = 22, wall = new T.Mesh(new T.BoxGeometry(18, 6, 0.4), stdMat({ color: 0x6a5a4c, roughness: 0.85 })); wall.position.set(SX, 3, 2.3); scene.add(wall);
  const walk = new T.Mesh(new T.BoxGeometry(18, 0.22, 3.6), stdMat({ color: 0x55565a, roughness: 0.8 })); walk.position.set(SX, 0.11, 4.3); scene.add(walk);
  const y = 0.22, out = 0;   // +z zur Straße
  place('bicycle', SX - 7, 2.5 + 0.12 * Math.cos(0.12) + Math.sin(0.12) * 0.5 + 0.02, out, y, -0.12, [0.35, 0.06, 0.06]);
  place('bicycle', SX - 5.1, 2.5 + 0.12 * Math.cos(0.12) + Math.sin(0.12) * 0.5 + 0.02, out, y, -0.12, [0.08, 0.22, 0.2]);
  place('pram', SX - 3.3, 2.5 + 0.34, out, y, 0, [0.06, 0.06, 0.07]);
  place('newsstand', SX - 1.6, 2.5 + 0.26, out, y, 0, [0.1, 0.25, 0.22]); place('papers', SX - 0.7, 2.5 + 0.2, 0.3, y);
  place('flowerpot', SX + 0.5, 2.7, 0, y); place('flowerpot', SX + 1.5, 2.7, 0, y);
  place('shovel', SX + 2.6, 2.5 + 0.06 + Math.sin(0.18) * 0.8, out, y, -0.18); place('bucket', SX + 3.2, 2.7, 0, y);
  place('sled', SX + 4.4, 2.75, out, y); place('shoeshine', SX + 6.2, 2.5 + 0.46, out, y);
  place('chestnut', SX - 4, 5.0, Math.PI / 2, y, 0, [0.35, 0.08, 0.06]); place('phonebooth', SX + 2.5, 5.2, 0, y, 0, [0.35, 0.05, 0.05]);
  place('ladder', SX + 8, 2.5 + 0.28, out, y); place('handcart', SX - 8.4, 5.0, 0.3, y);
  // ---- Markise über dem Gehweg, Wassertank und Schornstein auf einem Dachstück (neue Texturen) ----
  { const a = new T.Mesh(new T.BoxGeometry(1, 1, 1).rotateX(0.35), new T.MeshStandardMaterial({ color: new T.Color(0.35, 0.05, 0.08), map: awningTex(), roughness: 0.95 })); a.position.set(SX + 1, 3.7, 3.4); a.scale.set(4.6, 0.25, 1.8); scene.add(a);
    const roof = new T.Mesh(new T.BoxGeometry(8, 0.3, 6), stdMat({ color: 0x3a3632, roughness: 0.9 })); roof.position.set(SX + 4, 6.15, -1); scene.add(roof);
    const tk = new T.Mesh(new T.CylinderGeometry(1.6, 1.6, 2.6, 10), new T.MeshStandardMaterial({ color: 0x8a7462, map: tankTex(), roughness: 0.9 })); tk.position.set(SX + 6, 6.3 + 3.9, -1.5); scene.add(tk);
    const tc = new T.Mesh(new T.ConeGeometry(1.8, 1.1, 10), new T.MeshStandardMaterial({ color: 0x8a7462, map: tankTex(), roughness: 0.9 })); tc.position.set(SX + 6, 6.3 + 5.75, -1.5); scene.add(tc);
    const ch = new T.Mesh(new T.BoxGeometry(1.1, 2.2, 1.1), new T.MeshStandardMaterial({ color: 0x8a6c60, map: chimTex(), roughness: 0.95 })); ch.position.set(SX + 2, 6.3 + 1.1, -1); scene.add(ch);
    for (const [k, x, z, a2] of [['deckchair', SX + 1, 0.6, 0.3], ['bistroTable', SX + 3.5, 0.8, 0], ['flowerpot', SX + 0.2, -2.8, 0], ['flowerpot', SX + 1.2, -2.8, 0]]) place(k, x, z, a2, 6.3, 0, k === 'deckchair' ? [0.1, 0.35, 0.36] : [1, 1, 1]); }
  // ---- Café-Terrasse (links) ----
  for (const [tx, tz] of [[-20, 2], [-17.5, 2], [-20, 4.5]]) { place('bistroTable', tx, tz, 0, 0); place('chair', tx + 0.72, tz, -Math.PI / 2, 0); place('chair', tx - 0.72, tz, Math.PI / 2, 0); }
  place('icebucket', -19.9, 2.1, 0, 0.74); place('flowervase', -17.4, 2.0, 0, 0.74);
  // ---- Kai-Ecke ----
  place('ropecoil', -14, 6, 0.4, 0); place('ropecoil', -13.2, 6.3, 1.4, 0); place('lifebuoy', -12, 6, 0.2, 0); place('crate', -14.2, 7.6, 0.1, 0); place('crate', -13.55, 7.6, 0.05, 0); place('crate', -13.9, 7.6, 0.2, 0.48);
  // ---- eine Laterne schwebt (Telekinese) ----
  { const G = decoLampGeo(4.8, 0), M = decoLampMats(), g = new T.Group(); g.add(new T.Mesh(G.metal, M.metal), new T.Mesh(G.glass, M.glass)); g.position.set(10, 1.6, 7); g.rotation.set(0.35, 0, 0.5); scene.add(g); }
  // ---- zwei Dinge als echte Körper, die fallen (Physik läuft) ----
  { const B = spawnProp('typewriter', -6, 2.5, 6, 0.4); const B2 = spawnProp('globe', -5, 3.2, 6.3, 0); if (B) B.awake = true; if (B2) B2.awake = true; }
  const V = {
    alles: [[0, 6.5, 15], [0, 0.5, -1]], strassel: [[-4.5, 1.7, 3.6], [-4.5, 0.6, 0]], strasser: [[4.5, 1.9, 3.8], [4.5, 0.7, 0]], hofl: [[-3.5, 1.6, 0.9], [-3.5, 0.4, -2.6]], hofr: [[3.5, 1.6, 0.9], [3.5, 0.4, -2.6]],
    zimmer: [[0, 1.4, -1.2], [0, 0.5, -5.2]],
    gehweg: [[SX - 2, 1.8, 11], [SX - 1, 1.0, 3]], gehwegl: [[SX - 5, 1.5, 7.5], [SX - 5, 0.7, 2.6]], gehwegr: [[SX + 4, 1.6, 7.8], [SX + 4, 0.8, 2.6]],
    terrasse: [[-18.5, 1.8, 8], [-18.5, 0.6, 3]], dach: [[SX + 3, 10.5, 9], [SX + 3, 6.5, -1]], kai: [[-12.5, 1.6, 10.5], [-13.2, 0.4, 6.6]], laterne: [[10, 2.5, 13], [10, 2, 7]],
  };
  let LT = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = V[name] || V.alles; camera.position.set(...v[0]); camera.lookAt(...v[1]); };
  window.labTime = t => { LT = t; };
  window.labStats = () => ({ kinds: names.length, bodies: LOOSE.bodies.length });
  window.labView(params.get('view') || 'alles');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => {
    U.uTime.value = LT != null ? LT : (now - t0) / 1000; U.uCam.value.copy(camera.position);
    try { updateLoose(1 / 60); } catch (err) { /* nur zeichnen */ }
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
