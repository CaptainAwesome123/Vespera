/* =====================================================================
   ROCKETBOX-TEST (index.html?lab=rocketbox[&view=vergleich][&t=3])
   Vergleich: links unsere MakeHuman-Leute (Shader-Skelett, Mocap), rechts
   fünf Figuren aus Microsoft Rocketbox (MIT) als normale three.js-Figuren
   mit eigenem Skelett und eigenen Bewegungen (Stehen, Gehen auf der Stelle).
   Nur ein Test: in der Stadt laufen weiter die MakeHuman-Leute.
   Modelle baut tools/make-rocketbox.mjs nach assets/rocketbox/.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, ANISO } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { Crowd, COATS, DRESSES } from './serpentine.js';
import { resolveAsset } from './assets.js';
import { buildPlayerModel, PM } from './player-model.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/addons/utils/SkeletonUtils.js';

const load = (loader, rel) => new Promise((ok, no) => loader.load(resolveAsset(rel), ok, undefined, no));

// Gehen-Bewegung auf der Stelle: die waagerechte Wanderung der Wurzel (Bip01) herausrechnen
function inPlace(clip) {
  for (const tr of clip.tracks) {
    if (!tr.name.endsWith('.position')) continue;
    const v = tr.values, n = v.length / 3;
    let travel = 0; for (let i = 1; i < n; i++) travel += Math.hypot(v[i * 3] - v[i * 3 - 3], v[i * 3 + 2] - v[i * 3 - 1]);
    if (travel < 0.4) continue;
    const x0 = v[0], z0 = v[2];
    for (let i = 0; i < n; i++) { v[i * 3] = x0; v[i * 3 + 2] = z0; }
  }
  return clip;
}

const loadAlex = gl => load(gl, 'rocketbox/alexander-probe.glb');
// vorderster Punkt der Haut-Figur bei (x, y), im Ruhezustand
function frontAt(o, x, y, r = 0.025) {
  let sm; o.traverse(c => { if (c.isSkinnedMesh) sm = c; });
  sm.skeleton.update();
  const p = sm.geometry.attributes.position, v = new T.Vector3(); let best = -1e9;
  for (let i = 0; i < p.count; i++) { sm.boneTransform(i, v.fromBufferAttribute(p, i)); v.applyMatrix4(sm.matrixWorld); if (Math.abs(v.x - x) < r && Math.abs(v.y - y) < r && v.z > best) best = v.z; }
  return best > -1e8 ? best : o.position.z + 0.12;
}
// Fliege (schwarzer Satin) und weiße Rose am Revers, an Hals- und Brustknochen gehängt
function dressAlex(o) {
  const cx = o.position.x, satin = new T.MeshStandardMaterial({ color: 0x060608, roughness: 0.32, metalness: 0.1 });
  const bow = new T.Group();
  for (const sd of [-1, 1]) { const w = new T.Mesh(new T.ConeGeometry(0.02, 0.046, 12).rotateZ(sd * Math.PI / 2).translate(sd * 0.023, 0, 0), satin); w.scale.set(1, 1, 0.45); bow.add(w); }
  bow.add(new T.Mesh(new T.SphereGeometry(0.011, 10, 8).scale(1, 1.1, 0.7), satin));
  const yb = 1.475, zb = frontAt(o, cx, yb); bow.position.set(cx, yb, zb + 0.006); scene.add(bow);
  const rose = new T.Group(), petal = new T.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.55 }), leaf = new T.MeshStandardMaterial({ color: 0x1f4a26, roughness: 0.6 });
  for (let i = 0; i < 7; i++) { const a = i * 2.4, r = i ? 0.011 : 0, m = new T.Mesh(new T.SphereGeometry(i ? 0.011 : 0.01, 8, 6).scale(1, 0.8, 0.6), petal); m.position.set(Math.cos(a) * r, Math.sin(a) * r, i ? 0 : 0.004); rose.add(m); }
  { const l = new T.Mesh(new T.SphereGeometry(0.012, 6, 4).scale(1.6, 0.5, 0.3), leaf); l.position.set(0.012, -0.018, -0.004); l.rotation.z = -0.6; rose.add(l); }
  const xr = cx + 0.105, yr = 1.36, zr = frontAt(o, xr, yr); rose.position.set(xr, yr, zr + 0.008); scene.add(rose);
  const neck = o.getObjectByName('Bip01_Neck'), chest = o.getObjectByName('Bip01_Spine2');
  if (neck) neck.attach(bow); if (chest) chest.attach(rose);
}

export async function startRocketboxLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  const L = (c, i, d, x, y, z) => { const l = new T.PointLight(c, i, d, 1.6); l.position.set(x, y, z); scene.add(l); };
  L(0xffc27a, 2.4, 16, -2.2, 3.6, 2.6); L(0xffc27a, 2.4, 16, 2.6, 3.6, 2.6); L(0x58d0d0, 0.9, 14, 0, 2.5, -2.5);
  scene.add(new T.HemisphereLight(0x3a6a70, 0x1a120c, 0.35));
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), stdMat({ color: 0x1a1612, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const mark = new T.Mesh(new T.PlaneGeometry(0.03, 6), new T.MeshBasicMaterial({ color: 0xc9a258 })); mark.rotation.x = -Math.PI / 2; mark.position.set(0, 0.005, -1); scene.add(mark);

  // ---- links: MakeHuman-Leute wie in der Stadt ----
  const C = new Crowd(['suit', 'lady', 'worker', 'coat', 'tux', 'dress'], 12);
  const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;
  const A = (kind, col, x, z, yaw, gait, face) => { const a = C.add(kind, col, face); a.lab = { x, z, yaw }; if (gait) a.gait.splice(0, 3, ...gait); return a; };
  A('suit', COATS[3], -0.8, 0, 0, [3.3, 0, 0], look(9, 3, 0));
  A('lady', COATS[5], -1.5, 0, 0, [4.1, 0, 0], look(36, 2, 3));
  A('worker', [0.55, 0.62, 0.72], -2.2, 0, 0, [5.2, 0, 0], look(21, 1, 5));
  A('coat', [0.16, 0.12, 0.09], -2.9, 0, 0, [7.6, 0, 0], look(17, 3, 0, 2, 2));
  A('tux', COATS[0], -3.6, 0, 0, [0.3, 0, 0], look(3, 0, 1));
  A('suit', COATS[4], -1.6, -2.4, 0, [0.9, 7.4, 0.75], look(12, 0, 1));
  A('dress', DRESSES[2], -3.0, -2.4, 0, [2.9, 5.2, 0.4], look(41, 1, 3));
  C.finish();
  for (const a of C.list) C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw);

  // ---- rechts: Rocketbox ----
  const gl = new GLTFLoader();
  const FIG = [['herr-anzug', 'm', 0.8], ['dame-kostuem', 'f', 1.5], ['arbeiter', 'm', 2.2], ['herr-weste', 'm', 2.9], ['uniform', 'm', 3.6]];
  const WALK = [['herr-anzug', 'm', 1.6], ['dame-kostuem', 'f', 3.0]];
  const [figs, anims] = await Promise.all([
    Promise.all([...new Set(FIG.map(f => f[0]))].map(n => load(gl, 'rocketbox/' + n + '.glb').then(g => [n, g]))),
    Promise.all(['m-gehen', 'f-gehen', 'm-stehen', 'f-stehen'].map(n => load(gl, 'rocketbox/anim-' + n + '.glb').then(g => [n, g.animations[0]]))),
  ]);
  const G = Object.fromEntries(figs), CL = Object.fromEntries(anims);
  inPlace(CL['m-gehen']); inPlace(CL['f-gehen']);
  let tris = 0;
  for (const [, g] of figs) g.scene.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const m = o.material; if (m.map) m.map.anisotropy = ANISO;
    m.envMap = null;   // Laborlicht wie bei den MakeHuman-Leuten: Lampen, kein Spiegelbild
    tris += o.geometry.index.count / 3;
  });
  const mixers = [];
  const put = (name, sex, x, z, clip, phase) => {
    const o = skClone(G[name].scene); o.position.set(x, 0, z); scene.add(o);
    const mx = new T.AnimationMixer(o); const act = mx.clipAction(CL[sex + '-' + clip]); act.play(); act.time = phase;
    mixers.push(mx); return o;
  };
  FIG.forEach(([n, s, x], i) => put(n, s, x, 0, 'stehen', i * 1.7));
  WALK.forEach(([n, s, x], i) => put(n, s, x, -2.4, 'gehen', i * 0.4));

  // ---- Probe: so könnte Alexander aussehen (rechts) neben dem jetzigen Alexander (links) ----
  const ax = loadAlex(gl).then(g => {
    g.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material.envMap = null; if (o.material.map) o.material.map.anisotropy = ANISO; } });
    const o = skClone(g.scene); o.position.set(0.55, 0, 2.2); scene.add(o); o.updateMatrixWorld(true);
    dressAlex(o);
    const mx = new T.AnimationMixer(o); mx.clipAction(CL['m-stehen']).play(); mixers.push(mx);
  });
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; PM.place(-0.55, 0, 2.2, 0, { act: 0 }); }
  await ax;

  const V = {
    alle: [[0, 1.5, 6.2], [0, 1.0, -1]],
    vergleich: [[0, 1.62, 1.9], [0, 1.58, 0]],                  // MakeHuman-Herr links, Rocketbox-Herr rechts
    herr: [[0.8, 1.68, 0.78], [0.8, 1.66, 0]], herrmh: [[-0.8, 1.68, 0.78], [-0.8, 1.66, 0]],
    dame: [[1.5, 1.6, 0.75], [1.5, 1.58, 0]], damemh: [[-1.5, 1.58, 0.75], [-1.5, 1.55, 0]],
    rechts: [[2.2, 1.45, 3.4], [2.2, 1.0, 0]], links: [[-2.2, 1.45, 3.4], [-2.2, 1.0, 0]],
    gehen: [[-5.6, 1.1, -2.4], [0, 0.9, -2.4]], gehen2: [[5.6, 1.1, -2.4], [0, 0.9, -2.4]],
    arbeiter: [[2.2, 1.55, 1.3], [2.2, 1.3, 0]], haende: [[1.05, 1.0, 0.75], [0.8, 0.9, 0]],
    alexander: [[0, 1.45, 4.6], [0, 1.0, 2.2]], alexanderneu: [[0.62, 1.66, 3.05], [0.55, 1.58, 2.2]], alexanderalt: [[-0.48, 1.66, 3.05], [-0.55, 1.58, 2.2]],
    alexanderschraeg: [[1.25, 1.62, 3.1], [0.55, 1.5, 2.2]],
  };
  let LT = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = V[name] || V.alle; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { LT = t; };
  window.labStats = () => ({ rocketboxTris: tris / figs.length | 0, figures: figs.length, programs: renderer.info.programs.length, calls: renderer.info.render.calls });
  window.labView(params.get('view') || 'alle');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => {
    const t = LT != null ? LT : (now - t0) / 1000;
    U.uTime.value = t;
    for (const mx of mixers) mx.setTime(t);
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
