/* =====================================================================
   V24 · FIGUREN-LABOR (index.html?lab=menschen): nur ein paar Figuren vor
   dunklem Grund, unter Laterne und Mond, ohne die Stadt. Zum schnellen
   Prüfen von Gesichtern, Kleidung, Tänzen und dem Spielermodell, auch im
   Software-Renderer (tools/lab-shot.js macht daraus Bilder).
   ?lab=menschen&t=12.5  hält die Zeit an; window.labView(name) wählt den Ausschnitt.
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { Crowd, GOWNS, DRESSES, COATS } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';
import { PL_U } from './people-skeleton.js';

export const LAB = { crowd: null, t: null, views: {} };
export function startLab(params) {
  if (params.get('lab') === 'fassade') { import('./deco.js').then(D => D.startFacadeLab(params)); return; }   // V38: Fassaden-Labor
  if (params.get('lab') === 'penthouse') { import('./lab-penthouse.js').then(L => L.startPenthouseLab(params)); return; }   // V41: Penthouse-Labor
  if (params.get('lab') === 'villa') { import('./lab-villa.js').then(L => L.startVillaLab(params)); return; }   // V41: Villa-Labor
  if (params.get('lab') === 'strassen') { import('./lab-strassen.js').then(L => L.startRoadsLab(params)); return; }   // V42: Straßen-Labor
  if (params.get('lab') === 'arbeiter') { import('./lab-arbeiter.js').then(L => L.startWorkersLab(params)); return; }   // V46: Arbeiterviertel und Brass Lantern
  if (params.get('lab') === 'belmont') { import('./lab-belmont.js').then(L => L.startBelmontLab(params)); return; }   // V51: Lobby und Ballsaal
  if (params.get('lab') === 'luftschiff') { import('./lab-luftschiff.js').then(L => L.startShipLab(params)); return; }   // V54: Aurora Imperial innen
  if (params.get('lab') === 'wetter') { import('./lab-wetter.js').then(L => L.startWeatherLab(params)); return; }   // V54: Polarlicht, Schneesturm, Eisblumen, nasse Straßen
  if (params.get('lab') === 'kram') { import('./lab-kram.js').then(L => L.startKramLab(params)); return; }   // V53: die vielen neuen losen Dinge
  if (params.get('lab') === 'gegner') { import('./lab-gegner.js').then(L => L.startGegnerLab(params)); return; }   // V60: Anarchisten, Räuber, Festnahme
  if (params.get('lab') === 'leben') { import('./lab-leben.js').then(L => L.startLifeLab(params)); return; }   // V55: Straßenmusik, Kellner, Haltungen zu Alexander
  if (params.get('lab') === 'orte') { import('./lab-orte.js').then(L => L.startOrteLab(params)); return; }   // V58: Theater, Bank, Café
  if (params.get('lab') === 'kraft') { import('./lab-kraft.js').then(L => L.startKraftLab(params)); return; }   // V52: Telekinese-Möbel und staunende Leute
  if (params.get('lab') === 'wasser') { import('./lab-wasser.js').then(L => L.startWaterLab(params)); return; }   // V58: gefrorener Kanal, Güterkai, Boote
  if (params.get('lab') === 'landschaft') { import('./lab-landschaft.js').then(L => L.startLandscapeLab(params)); return; }   // V44: Landschafts-Labor
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  const lamp = new T.PointLight(0xffc27a, 2.2, 14, 1.6); lamp.position.set(1.6, 3.6, 2.4); scene.add(lamp);
  const teal = new T.PointLight(0x58d0d0, 0.8, 12, 1.6); teal.position.set(-3, 2.5, -1); scene.add(teal);
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const C = LAB.crowd = new Crowd(['tux', 'gown', 'dress', 'suit', 'lady', 'worker', 'coat', 'furcoat', 'dbl', 'braces', 'jacket', 'flapper'], 60);
  const A = (kind, col, x, z, yaw, gait, face) => { const a = C.add(kind, col, face); a.lab = { x, z, yaw }; if (gait) a.gait.splice(0, 3, ...gait); return a; };
  // vordere Reihe: Gesichter (stehend), hintere Reihe: Gehen und Tanzen
  const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;
  A('tux', COATS[0], -0.9, 0, 0, [0.3, 0, 0], look(3, 0, 1));
  A('gown', GOWNS[3], -0.3, 0, 0, [1.3, 0, 0], look(40, 1, 0));
  A('dress', DRESSES[1], 0.3, 0, 0, [2.3, 0, 0], look(45, 0, 2));
  A('suit', COATS[3], 0.9, 0, 0, [3.3, 0, 0], look(9, 3, 0));
  A('lady', COATS[5], 1.5, 0, 0, [4.1, 0, 0], look(36, 2, 3));
  A('worker', [0.55, 0.62, 0.72], -1.5, 0, 0, [5.2, 0, 0], look(21, 1, 5));
  // V39: Pelzmantel, MakeHuman-Fedoras (Anzug Variante 1, Mantel Varianten 1 und 3), neue Frisuren (Seitenscheitel, Locken, Zopf, offen)
  A('furcoat', [0.36, 0.07, 0.1], 2.1, 0, 0, [6.1, 0, 0], look(38, 0, 2, 2, 0));
  A('furcoat', [0.05, 0.2, 0.21], 2.7, 0.0, 0.3, [6.6, 0, 0], look(42, 1, 1, 0, 1));
  A('suit', [0.22, 0.2, 0.26], -2.1, 0, 0, [7.1, 0, 0], look(13, 0, 1, 0, 1));
  A('coat', [0.16, 0.12, 0.09], -2.7, 0, -0.3, [7.6, 0, 0], look(17, 3, 0, 2, 2));
  A('coat', [0.08, 0.08, 0.12], -3.3, 0, 0, [8.1, 0, 0], look(19, 1, 4, 0, 0));
  A('lady', [0.3, 0.26, 0.2], 3.3, 0, 0, [8.6, 0, 0], look(50, 2, 1, 2, 2));
  A('gown', [0.85, 0.78, 0.62], 3.9, 0, 0, [9.1, 0, 0], look(53, 0, 2, 2, 2));
  // V56: Zwanziger: rechts Flapper (mit und ohne Cloche), Dame im Kostüm mit Cloche, Pelzmantel mit cremefarbener Cloche;
  // links Zweireiher, Hemdsärmel mit Hosenträgern, Arbeitsjacke, Zweireiher ohne Hut
  A('flapper', [0.05, 0.05, 0.06], 4.6, 0, 0, [9.6, 0, 0], look(35, 0, 1, 0, 0));
  A('flapper', [0.78, 0.66, 0.42], 5.2, 0, -0.2, [10.1, 0, 0], look(39, 1, 0, 1, 1));
  A('lady', [0.1, 0.12, 0.2], 5.8, 0, 0, [10.6, 0, 0], look(43, 0, 2, 0, 2));
  A('furcoat', [0.07, 0.07, 0.09], 6.4, 0, 0.2, [11.1, 0, 0], look(49, 2, 4, 2, 0));
  A('dbl', [0.08, 0.08, 0.12], -3.9, 0, 0, [11.6, 0, 0], look(23, 0, 0, 0, 0));
  A('braces', [0.2, 0.19, 0.17], -4.5, 0, 0.2, [12.1, 0, 0], look(25, 1, 1, 1, 1));
  A('jacket', [0.24, 0.18, 0.12], -5.1, 0, -0.2, [12.6, 0, 0], look(27, 3, 0, 2, 2));
  A('dbl', [0.16, 0.12, 0.09], -5.7, 0, 0, [13.1, 0, 0], look(29, 1, 3, 1, 1));
  // Tanzpaare und Gehende
  A('tux', COATS[0], -1.2, -3, 0, [0, 20, 0], look(5, 0, 0)); A('gown', GOWNS[0], -1.28, -2.62, Math.PI, [0, 21, 0], look(33, 0, 2));
  A('tux', COATS[0], 1.2, -3, 0.4, [0.7, 22, 0], look(7, 1, 1)); A('dress', DRESSES[0], 1.2, -2.2, 0.4 + Math.PI, [0.7, 22, 0], look(47, 0, 0));
  A('suit', COATS[2], -3, -1.5, 1.57, [0.2, 4.6, 0.42], look(11, 1, 2)); A('coat', COATS[1], 3, -1.5, -1.57, [1.7, 4.6, 0.4], look(14, 0, 4));
  // V26: Läufer, Dame im Gang, Charleston einzeln (seitlich zu sehen)
  A('suit', COATS[4], -3, 1.5, 1.57, [0.9, 7.4, 0.75], look(12, 0, 1)); A('dress', DRESSES[2], 3, 1.5, -1.57, [2.9, 5.2, 0.4], look(41, 1, 3));
  A('tux', COATS[0], 0, -5.5, 1.57, [1.9, 22, 0], look(6, 0, 2)); A('gown', GOWNS[1], 0, -7, -1.57, [3.9, 22, 0], look(44, 0, 1));
  C.finish();
  for (const a of C.list) C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw);
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; PM.place(0, 0, 2.2, 0, { act: 0 }); }
  LAB.views = {
    alle: [[0, 1.5, 6.5], [0, 1.0, -1]],
    gesichter: [[0, 1.62, 2.6], [0, 1.55, 0]],
    herr: [[-0.9, 1.68, 0.75], [-0.9, 1.66, 0]],
    dame: [[-0.3, 1.58, 0.7], [-0.3, 1.55, 0]],
    tanz: [[0, 1.2, 1.2], [0, 0.8, -3]],
    beine: [[-4.2, 0.75, -2.8], [-1.2, 0.55, -2.8]],
    beine2: [[4.2, 0.75, -2.6], [1.2, 0.55, -2.6]],
    spieler: [[0, 1.6, 4.0], [0, 1.0, 2.2]],
    gang: [[0, 1.0, 5.5], [0, 0.9, 0.0]],
    seite: [[-7.5, 1.1, 0.0], [0, 0.85, 0.0]],
    charl: [[4.5, 1.2, -6.2], [0, 0.9, -6.2]],
    spielerkopf: [[0, 1.68, 2.95], [0, 1.67, 2.2]],
    // V32: Fliege und Hemdbrust, Hände des Spielers, Hände der vorderen Reihe
    brust: [[0.05, 1.42, 3.0], [0, 1.36, 2.2]],
    haende: [[-0.45, 1.0, 2.95], [-0.2, 0.85, 2.2]],
    haende2: [[-1.05, 1.05, 0.8], [-0.75, 0.85, 0.0]],
    laeufer: [[-3.0, 1.0, 3.1], [-3.0, 0.95, 1.5]],
    // V39: neue Figuren rechts und links der vorderen Reihe
    neu: [[0.4, 1.5, 6.2], [0.4, 1.0, 0]], neurechts: [[3.0, 1.45, 2.6], [3.0, 1.1, 0]], neulinks: [[-2.7, 1.45, 2.6], [-2.7, 1.1, 0]],
    neuhut: [[-2.4, 1.78, 1.5], [-2.4, 1.62, 0]], neupelz: [[2.4, 1.3, 1.6], [2.4, 1.1, 0]], neuzopf: [[3.9, 1.6, -1.4], [3.3, 1.45, 0]],
    // V44: ganz nah an Gesicht und Hand (Poren, Lippen, Knöchel), auch beim Spieler
    herrnah: [[-0.86, 1.67, 0.62], [-0.9, 1.65, 0]], damenah: [[-0.27, 1.57, 0.6], [-0.3, 1.55, 0]], altnah: [[2.07, 1.6, 0.62], [2.1, 1.58, 0]],
    handnah: [[-1.0, 0.98, 0.7], [-0.75, 0.85, 0.0]], spielerhand: [[-0.4, 0.98, 2.9], [-0.2, 0.85, 2.2]], spielernah: [[0, 1.68, 2.82], [0, 1.67, 2.2]],
    // V48: Alexander im Dreiviertelprofil (wie auf den Referenzbildern)
    spielerportraet: [[0.42, 1.7, 2.85], [0, 1.66, 2.2]], spielerprofil: [[0.72, 1.7, 2.25], [0, 1.66, 2.2]],
    // V56: Zwanziger-Reihen rechts und links, Nahaufnahmen von Weste, Zweireiher, Hosenträgern, Jacke, Flapper und Cloche
    zwanziger: [[5.5, 1.4, 3.4], [5.5, 1.0, 0]], zwanzigerl: [[-4.8, 1.4, 3.4], [-4.8, 1.0, 0]],
    weste: [[0.9, 1.35, 1.0], [0.9, 1.28, 0]], zweireiher: [[-3.9, 1.3, 1.5], [-3.9, 1.15, 0]], zweireiherseite: [[-2.9, 1.3, 0.6], [-3.9, 1.15, 0]],
    hosentraeger: [[-4.5, 1.3, 1.4], [-4.5, 1.15, 0]], hosentraegerhinten: [[-4.5, 1.3, -1.4], [-4.5, 1.15, 0]], jacke: [[-5.1, 1.3, 1.4], [-5.1, 1.15, 0]],
    flapper: [[4.6, 1.2, 1.7], [4.6, 1.0, 0]], flapperseite: [[5.9, 1.2, 1.0], [5.2, 1.0, 0]], cloche: [[4.5, 1.7, 0.75], [4.6, 1.62, 0]], clochedame: [[5.8, 1.7, 0.75], [5.8, 1.62, 0]],
    gesichtnah2: [[5.25, 1.6, 0.55], [5.2, 1.57, 0]], haut2: [[-4.5, 1.62, 0.5], [-4.5, 1.6, 0]],
  };
  // V35: Alexanders Bewegungen als Standbild (?pose=... oder window.labPose(name)); u: [Platz im uPl, x, y, z, w]
  LAB.poses = {
    stand: { act: 0 }, landung: { act: 0, u: [[2, 1.0, 1, 0, 0]] }, aufprall: { act: 0, u: [[2, 0.08, 1, 0, 0]] },
    tk: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0.35, 0.15, 0.92, 0.1], [5, 0, 0, 0, 1]] }, tkschwer: { act: 0, u: [[3, 1, 1, 0, 1], [4, 0.1, 0.3, 0.95, 0.5], [5, 0, 0, 0, 1]] },
    wurf: { act: 0, u: [[3, 1, 0, 0.25, 1], [4, 0.2, 0.1, 0.97, 0.1], [5, 0, 0, 0, 1]] }, sturz: { act: 0, u: [[1, 1, -1, 1, 0]] }, aufprallvor: { act: 0, u: [[1, 1, -1, 1, 1]] },
    sprung: { act: 0, u: [[1, 1, 0.8, 0, 0]] }, abheben: { act: 43, u: [[5, 0.25, 0, 0, 0]] }, start: { act: 43, u: [[5, 0.55, 0, 0, 0]] },
    schweben: { act: 43 }, flug: { act: 43.99, pitch: 1.5 }, bremsen: { act: 43.5, u: [[5, 0, 1, 0, 0]] },
    // V59: Energieschub (energy.js): ausholen, Stoß rechts / links, aufladen mit beiden Händen, beidhändiger Stoß, im Flug
    schubaus: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0, 0.02, 1, 0.1], [5, 0, 0, 0, 1], [6, 0, -1, -0.45, 0], [7, 1, 0, 0.6, 0]] },
    schub: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0, 0.02, 1, 0.1], [5, 0, 0, 0, 1], [6, 0, -1, 0.3, 0], [7, 1, 1, -1, 0]] },
    schublinks: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0, 0.02, 1, 0.1], [5, 0, 0, 0, 1], [6, 0, 1, -0.3, 0], [7, 1, -1, 1, 0]] },
    aufladen: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0, 0.02, 1, 0.8], [5, 0, 0, 0, 1], [6, 0, -1, -0.45, 1], [7, 1, 0, 0, 1]] },
    schubbeide: { act: 0, u: [[3, 1, 0, 0, 1], [4, 0, 0.02, 1, 0.3], [5, 0, 0, 0, 1], [6, 0, -1, 0.05, 1], [7, 1, 1, 1, 0.5]] },
    schubflug: { act: 43, u: [[3, 1, 0, 0, 1], [4, 0, -0.1, 1, 0.1], [6, 0, -1, 0.3, 0], [7, 1, 1, -1, 0]] },
    fahren: { act: 32.5, y: 1.1 - 0.87 }, fahrenlinks: { act: 32.02, y: 1.1 - 0.87 }, fahrenrechts: { act: 32.98, y: 1.1 - 0.87 },   // V42: Alexander am Steuer (Sitz wie seatPerson: y = Wagen + 1,1 − 0,87·sc)
  };
  window.labPose = name => {
    const P = LAB.poses[name] || LAB.poses.stand;
    for (const v of PL_U.value) v.set(0, 0, 0, 0);
    for (const [i, x, y, z, w] of P.u || []) PL_U.value[i].set(x, y, z, w);
    if (PM.mesh) PM.place(0, P.y != null ? P.y * PM.sc : P.act >= 43 && P.pitch ? 0.6 : P.act >= 43 ? 0.3 : 0, 2.2, 0, { act: P.act, pitch: P.pitch || 0 });
  };
  if (params.get('pose')) window.labPose(params.get('pose'));
  Object.assign(LAB.views, { spielerseite: [[3.4, 1.0, 2.2], [0, 0.8, 2.2]], spielerschraeg: [[2.6, 1.4, 4.6], [0, 0.8, 2.2]] });
  LAB.t = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = LAB.views[name] || LAB.views.alle; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { LAB.t = t; };
  window.labView(params.get('view') || 'alle');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let t0 = performance.now();
  const loop = now => {
    U.uTime.value = LAB.t != null ? LAB.t : (now - t0) / 1000;
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
