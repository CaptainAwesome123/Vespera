/* =====================================================================
   V52 · KRÄFTE-LABOR (index.html?lab=kraft[&view=moebel][&t=12.5])
   Ohne Stadt: eine Reihe Möbel (Sofa, Sessel, Stühle, Tisch, Lampen), die wie
   in den Räumen über placeFurn ins Verzeichnis kommen; ein Sofa und ein Sessel
   sind bereits von der Telekinese gepackt (eigenes Netz, schweben schräg), das
   feste Netz hat sie verloren. Davor Passanten in den Posen des Staunens
   (awe.js): nach oben zeigen, Arme heben, Applaus, Hut ziehen, Verbeugung.
   tools/lab-shot.js macht daraus Bilder (LAB=kraft).
   ===================================================================== */
import { T, scene, camera, renderer, U, $, mergeGeos } from './core.js';
import { buildEnv, getMats, stdMat, MAT } from './people-skeleton.js';
import { Crowd, COATS, DRESSES, GOWNS, turnHead, setAct } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';
import { PL_U } from './people-skeleton.js';
import { FURN, placeFurn, movOn, movOff, MOV } from './entrances.js';
import { LOOSE, furnBody, spawnProp, updateLoose, tearBody, treeBody } from './physics.js';
import { player } from './player.js';
import { kit, benchGeo, Bx } from './harbour.js';
import { tearWrap, TEAR, tearStats } from './tear.js';
import { trees } from './facade-shader.js';
import { buildTrees, TREE_SETS, updateTreeLod } from './serpentine.js';
import { energyLabFx, energyLabOrb, energyLabClear } from './energy.js';
import { buildFX, updateFX, FX } from './particles.js';

export const KLAB = { crowd: null, t: null, bodies: [] };
export function startKraftLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  const lamp = new T.PointLight(0xffc27a, 2.4, 18, 1.6); lamp.position.set(1.6, 3.8, 2.4); scene.add(lamp);
  const teal = new T.PointLight(0x58d0d0, 0.9, 16, 1.6); teal.position.set(-4, 2.5, -2); scene.add(teal);
  const back = new T.PointLight(0xffc27a, 1.6, 20, 1.6); back.position.set(-3, 3.5, -7); scene.add(back);
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  // ---- Möbel wie in einem Raum: Materialgruppen, dann ein Netz je Material ----
  const M = { velvet: stdMat({ color: 0x0f4a4c, roughness: 0.9, envI: 0.12 }), cream: stdMat({ color: 0xe6d7bc, roughness: 0.85, envI: 0.15 }), leather: stdMat({ color: 0x6a3416, roughness: 0.42, envI: 0.55 }),
    gold: MAT.gold, lacquer: MAT.black, wood: stdMat({ color: 0x5a3418, roughness: 0.5, envI: 0.4 }), lamp: new T.MeshBasicMaterial({ color: new T.Color(1.45, 1.12, 0.7) }), leaf: stdMat({ color: 0x1e4a24, roughness: 0.8, envI: 0.2 }) };
  const B = {}, put = (k, g) => (B[k] ||= []).push(g);
  const MAP = (up, extra = {}) => ({ up, frame: 'gold', wood: 'wood', lamp: 'lamp', cloth: 'cream', leaf: 'leaf', ...extra });
  movOn();
  const Z = -6;
  placeFurn(FURN.sofa(3.4), MAP('velvet'), put, -4.5, 0, Z, 0);
  placeFurn(FURN.sofa(2.6), MAP('cream'), put, 0.5, 0, Z, 0);
  placeFurn(FURN.clubChair(), MAP('leather'), put, 3.6, 0, Z, 0);
  placeFurn(FURN.clubChair(), MAP('velvet'), put, 5.2, 0, Z, -0.4);
  placeFurn(FURN.roundTable(0.4, 0.74), MAP('lacquer'), put, -2.5, 0, Z + 3, 0);
  placeFurn(FURN.tableLamp(0.6), MAP('lacquer'), put, -2.5, 0.74, Z + 3, 0);
  placeFurn(FURN.diningChair(), MAP('cream'), put, -3.4, 0, Z + 3, Math.PI / 2);
  placeFurn(FURN.diningChair(), MAP('cream'), put, -1.6, 0, Z + 3, -Math.PI / 2);
  placeFurn(FURN.bistroChair(), MAP('wood'), put, 1.0, 0, Z + 3, 0.3);
  placeFurn(FURN.barStool(), MAP('leather'), put, 2.2, 0, Z + 3, 0);
  placeFurn(FURN.floorLamp(1.8), MAP('lacquer'), put, 7, 0, Z, 0);
  placeFurn(FURN.vasePlant(1), MAP('gold'), put, 3.4, 0, Z + 3, 0);
  movOff();
  for (const k in B) { const geos = B[k].map(g => { if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }); scene.add(new T.Mesh(mergeGeos(geos), M[k])); }
  // ---- zwei Stücke sind gepackt: eigenes Netz, schweben schräg über der Reihe ----
  const lift = (i, x, y, z, rx, rz) => { const e = MOV.list[i], Bd = furnBody(e); if (!Bd || Bd === 'sit') { console.warn('Labor: Körper fehlt', i, Bd); return; } Bd.x.set(x, y, z); Bd.q.setFromEuler(new T.Euler(rx, 0.3, rz)); Bd.awake = false; Bd.v.set(0, 0, 0); Bd.w.set(0, 0, 0); KLAB.bodies.push(Bd); return Bd; };
  lift(1, 0.5, 2.3, Z + 1.2, 0.35, 0.2);   // das cremefarbene Sofa
  lift(3, 5.2, 1.9, Z + 1.5, -0.25, 0.4);   // der Samt-Sessel
  lift(7, -1.6, 1.6, Z + 4.2, 0.5, -0.3);   // ein Stuhl
  // ein paar lose Dinge der Straße (neue Arten)
  for (const [k, x, z] of [['barrel', -7.5, Z + 3.5], ['dustbin', -6.5, Z + 3.8], ['coalsack', -5.6, Z + 3.4], ['milkcan', -4.8, Z + 3.9], ['trunk', -7.2, Z + 5.2], ['lantern', -5.9, Z + 5.0], ['bucket', -5.0, Z + 5.2], ['signboard', -8.2, Z + 5.0], ['winecrate', -4.0, Z + 5.3]]) { const Bd = spawnProp(k, x, 0, z, 0.3); if (Bd) { Bd.awake = false; } }
  // ---- V54: Ausreißen. Rechts eine Reihe fester Stücke aus dem Bausatz (Bank, Poller, Fass mit Platte, Kistenstapel), eine Bank und
  //      der Poller sind herausgerissen (eigener Körper, schweben schräg); dazu zwei Bäume, eine Platane ist herausgerissen ----
  const RX = 12, RZ = Z + 2, K = kit();
  const lamp2 = new T.PointLight(0xffc27a, 2.6, 22, 1.5); lamp2.position.set(RX + 4, 4.5, RZ + 3); scene.add(lamp2);
  tearWrap('lab:bank', { name: 'Bank', m: 55, stuff: 'wood', seat: true }, () => benchGeo(K, 2.0, RX, 0, RZ, 0));
  tearWrap('lab:bank2', { name: 'Bank', m: 55, stuff: 'wood', seat: true }, () => benchGeo(K, 2.0, RX + 3, 0, RZ, 0));
  tearWrap('lab:poller', { name: 'Poller', m: 90, stuff: 'metal', kind: 'cyl' }, () => K.add('iron', new T.LatheGeometry([[0.2, 0], [0.17, 0.08], [0.13, 0.4], [0.2, 0.48], [0.22, 0.55], [0, 0.58]].map(([r, y]) => new T.Vector2(r, y)), 12).translate(RX + 5, 0, RZ)));
  tearWrap('lab:fass', { name: 'Stehtisch-Fass', m: 65, stuff: 'wood', kind: 'cyl' }, () => { K.add('plank', new T.CylinderGeometry(0.34, 0.3, 0.9, 14).translate(RX + 6.5, 0.45, RZ), [0.55, 0.38, 0.24]); K.add('plank', new T.CylinderGeometry(0.42, 0.42, 0.05, 14).translate(RX + 6.5, 0.93, RZ), [0.42, 0.28, 0.18]); });
  tearWrap('lab:kisten', { name: 'Kistenstapel', m: 40, stuff: 'wood' }, () => { for (let k = 0; k < 3; k++) K.add('plank', Bx(0.6, 0.45, 0.6, RX + 8, 0.225 + k * 0.45, RZ + (k % 2) * 0.05, 1), [0.5, 0.38, 0.26]); });
  K.build(scene);
  const torn = (key, x, y, z, rx, rz) => { const e = TEAR.map.get(key), Bd = tearBody(e); if (!Bd || Bd === 'sit') { console.warn('Labor: Ausreißen fehlt', key, Bd); return; } Bd.x.set(x, y, z); Bd.q.setFromEuler(new T.Euler(rx, 0.4, rz)); Bd.awake = false; Bd.v.set(0, 0, 0); Bd.w.set(0, 0, 0); KLAB.bodies.push(Bd); };
  torn('lab:bank', RX, 2.0, RZ + 2.5, 0.4, 0.3);
  torn('lab:poller', RX + 5, 1.6, RZ + 2.5, 1.1, 0.2);
  trees.length = 0; trees.push({ x: RX + 2, z: RZ - 6, y: 0, s: 0.9, sp: 'plane' }, { x: RX + 9, z: RZ - 6, y: 0, s: 0.8, sp: 'linden' }, { x: RX - 3, z: RZ - 7, y: 0, s: 1.0, sp: 'cyp' });
  try { buildTrees(); const st = TREE_SETS.find(s => s.sp === 'plane'); const Bd = st && treeBody(st, st.pts[0]); if (Bd) { Bd.x.set(RX + 2, 6.5, RZ - 2); Bd.q.setFromEuler(new T.Euler(0.9, 0.3, 0.35)); Bd.awake = false; Bd.v.set(0, 0, 0); Bd.w.set(0, 0, 0); KLAB.bodies.push(Bd); } else console.warn('Labor: Baum fehlt'); } catch (e) { console.warn('Labor: Bäume', e); }
  // ---- Leute, die staunen (Posen aus awe.js), schauen alle zum Spieler ----
  const C = KLAB.crowd = new Crowd(['tux', 'gown', 'dress', 'suit', 'lady', 'worker', 'coat', 'furcoat'], 24);
  const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;
  // Zeitverschiebung so, dass Hut ziehen (5) und Zeigen (16) bei t = 12,5 gerade oben sind: tt = 12,5·(0,9 + 0,2·fract(g·3,7)) + 7·g
  const ph = act => { const fr = x => x - Math.floor(x), P = act < 6 ? 7 : 12, s0 = act < 6 ? 0.2 : 0.3; for (let n = 0; n < 400; n++) { const g = n * 0.0137, tt = 12.5 * (0.9 + 0.2 * fr(g * 3.7)) + g * 7, f = fr(tt / P); if (f > s0 && f < s0 + 0.02) return g; } return 0; };
  const A = (kind, col, x, z, yaw, act, face, tilt = 0) => { const a = C.add(kind, col, face); a.lab = { x, z, yaw, tilt }; a.gait.splice(0, 3, act > 4.5 && act < 5.5 ? ph(5) : act > 15.5 && act < 16.5 ? ph(16) : Math.random() * 7, act, 0); return a; };
  A('suit', COATS[3], -3.0, 0, 0.3, 16.3, look(9, 3, 0, 0, 1));      // zeigt nach oben
  A('coat', COATS[1], -1.8, 0.2, 0.15, 8.2, look(14, 0, 4, 2, 2));    // staunt, Arme hoch
  A('dress', DRESSES[1], -0.6, 0, 0, 9.3, look(45, 0, 2));            // Applaus
  A('tux', COATS[0], 0.6, 0.1, -0.1, 5.3, look(3, 0, 1, 2, 0));       // zieht den Hut
  A('worker', [0.55, 0.62, 0.72], 1.8, 0, -0.25, 1.3, look(21, 1, 5), -0.3);   // Verbeugung
  A('lady', COATS[5], 3.0, 0.2, -0.35, 1.3, look(36, 2, 3));          // schaut nur
  A('furcoat', [0.36, 0.07, 0.1], 4.2, 0, -0.45, 8.2, look(38, 0, 2, 2, 0));
  A('gown', GOWNS[3], -4.2, 0.1, 0.45, 9.3, look(40, 1, 0));
  C.finish();
  for (const a of C.list) { C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw, 1, a.lab.tilt); if (a.live) { a.live[3] = 1.55; } turnHead(a, 0, 4); }
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; for (const v of PL_U.value) v.set(0, 0, 0, 0); PL_U.value[3].set(1, 0, 0, 1); PL_U.value[4].set(0.35, 0.15, 0.92, 0.1); PL_U.value[5].set(0, 0, 0, 1); PM.place(0, 0, 4, Math.PI, { act: 0 }); }
  player.p.set(0, 0, 4);
  const V = {
    moebel: [[0, 2.2, 3.5], [0, 1.0, Z + 1]], moebelnah: [[2.5, 2.4, -1.5], [2.5, 1.4, Z + 1]], sofa: [[-1.5, 2.6, -2.2], [0.5, 2.0, Z + 1.2]],
    reihe: [[-2.5, 1.4, -0.5], [-2.5, 0.6, Z + 3]], dinge: [[-6, 1.6, 2.5], [-6, 0.5, Z + 4.4]],
    staunen: [[0, 1.6, 4.8], [0, 1.1, 0]], staunenlinks: [[-2.2, 1.5, 3.2], [-2.2, 1.1, 0]], staunenrechts: [[2.4, 1.5, 3.2], [2.4, 1.0, 0]], hut: [[0.6, 1.65, 2.2], [0.6, 1.3, 0]], verbeugung: [[3.4, 1.3, 2.0], [1.8, 0.9, 0]],
    spieler: [[0.8, 1.6, 6.4], [0, 1.0, 4]], alles: [[0, 3.5, 9], [0, 0.8, -2]],
    schub: [[5.5, 2.4, 7.5], [-0.5, 1.2, 1]], schubhinten: [[1.1, 2.0, 7.6], [0, 1.4, 0]], schubnah: [[2.6, 1.6, 5.6], [0, 1.2, 3.4]],
    reissen: [[RX + 4, 3.2, RZ + 11], [RX + 4, 2.2, RZ - 2]], reissennah: [[RX + 1.5, 1.8, RZ + 5.5], [RX + 2.5, 1.2, RZ + 1]], baum: [[RX - 2, 5, RZ + 7], [RX + 2, 5, RZ - 3]], baumseite: [[RX - 9, 2.5, RZ - 2], [RX + 2, 5.5, RZ - 2]],
  };
  KLAB.t = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = V[name] || V.alles; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { KLAB.t = t; };
  // V59: Energieschub im Standbild: Pose (wie im Figuren-Labor) und die Lichter des Stoßes, Spieler bei (0,0,4) schaut nach -z
  const SCHUB = {
    stoss: { u: [[6, 0, -1, 0.3, 0], [7, 1, 1, -1, 0]], fx: 'right', o: [-0.19, 1.36] }, links: { u: [[6, 0, 1, -0.3, 0], [7, 1, -1, 1, 0]], fx: 'left', o: [0.19, 1.36] },
    aufladen: { u: [[6, 0, -1, -0.45, 1], [7, 1, 0, 0, 1]], orb: 1 }, entladen: { u: [[6, 0, -1, 0.05, 1], [7, 1, 1, 1, 0.5]], fx: 'charged', o: [0, 1.36] },
  };
  window.labSchub = name => {
    const S = SCHUB[name]; if (!S || !PM.mesh) return;
    for (const v of PL_U.value) v.set(0, 0, 0, 0);
    PL_U.value[3].set(1, 0, 0, 1); PL_U.value[4].set(0, 0.02, 1, S.orb ? 0.8 : 0.2); PL_U.value[5].set(0, 0, 0, 1);
    for (const [i, x, y, z, w] of S.u) PL_U.value[i].set(x, y, z, w);
    PM.place(0, 0, 4, Math.PI, { act: 0 });
    if (!Object.keys(FX.sets).length) buildFX();
    energyLabClear();
    if (S.orb) energyLabOrb(new T.Vector3(0.16, 1.12, 3.7), 1);
    if (S.fx) energyLabFx(new T.Vector3(-S.o[0], S.o[1], 4 - 0.85), new T.Vector3(0, 0.02, -1).normalize(), S.fx, 1, S.fx === 'charged' ? 0.1 : 0.07);
    updateFX(0.03);
  };
  window.labPose = window.labSchub;   // tools/lab-shot.js: ansicht#schub
  window.labStats = () => ({ mov: MOV.list.length, taken: MOV.list.filter(e => e.taken).length, bodies: LOOSE.bodies.length, meshes: LOOSE.bodies.filter(b => b.mesh).length, tear: tearStats(), ranges: MOV.list.reduce((s, e) => s + e.ranges.length, 0) });
  window.labView(params.get('view') || 'alles');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => {
    U.uTime.value = KLAB.t != null ? KLAB.t : (now - t0) / 1000; U.uCam.value.copy(camera.position);
    C.flag(); if (PM.mesh) PM.update(0);
    try { updateLoose(1 / 60); updateTreeLod(1 / 60); } catch (e) { /* nur zeichnen */ }
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
