/* =====================================================================
   V61 · GALA-LABOR (index.html?lab=gala[&view=ballsaal][&start=1][&fw=1])
   Wie das Belmont-Labor (Lobby und Ballsaal ohne Stadt), dazu läuft die Gala:
   window.galaStart() beginnt sie, window.galaSkip(s) spult die Zeit vor,
   window.galaRede(i) wählt Alexanders Rede. ?fw=1 zeigt nur das Feuerwerk über
   einem dunklen Platzhalter des Belmont (schnell im Software-Renderer).
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { GALA, updateGala, startGala, startFireworks, FEUERWERK } from './gala.js';
import { player } from './player.js';
import { closeMenu } from './venues.js';

export async function startGalaLab(params) {
  GALA.force = true;
  if (params.get('fw')) return fireworksOnly(params);
  if (params.get('norender')) renderer.render = () => {};   // Ablauf-Test ohne Bilder (Software-Renderer braucht Minuten je Ballsaal-Bild)
  const L = await import('./lab-belmont.js');
  await L.startBelmontLab(params);
  const base = window.labView;
  const V = { gala: [[0, 1.96, -22], [0, 3.2, -40.6]], ehre: [[0, 9.7, -14], [0, 0.5, -30]], walzer: [[12, 3.5, -18], [0, 0.5, -29]] };
  window.labView = name => { if (V[name]) { camera.position.set(...V[name][0]); camera.lookAt(...V[name][1]); player.p.set(0, 0.26, -24); window.labFrames = 0; } else base(name); };
  if (V[params.get('view')]) window.labView(params.get('view'));
  window.galaStart = () => { startGala(); return GALA.st; };
  window.galaRede = i => { GALA.rede = i; closeMenu(); };
  // vorspulen in Schritten von 1/20 s (Redner gehen, Ablauf läuft weiter)
  window.galaSkip = s => { for (let k = 0; k < s * 20; k++) updateGala(0.05); return { st: GALA.st, step: GALA.step, n: GALA.script ? GALA.script.length : 0, line: GALA.lastLine, rede: GALA.rede, solo: !!GALA.solo, fw: FEUERWERK.on }; };
  window.GALA = GALA; window.FEUERWERK = FEUERWERK;
  if (params.get('start')) startGala();
  let last = performance.now();
  const loop = now => { const dt = Math.min(0.1, (now - last) / 1000); last = now; if (!params.get('hold')) { try { updateGala(dt); } catch (e) { console.error(e); } } requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}

function fireworksOnly(params) {
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  scene.fog.density = 0.0012; U.uFogDensity && (U.uFogDensity.value = 0.0012);
  // Platzhalter: der Turm des Belmont als dunkle Silhouette mit goldenen Kanten
  const m = new T.MeshBasicMaterial({ color: 0x0a0d10 });
  for (const [w, y0, y1] of [[100, 0, 34], [60, 34, 190], [44, 190, 290], [30, 290, 340], [14, 340, 418]]) { const b = new T.Mesh(new T.BoxGeometry(w, y1 - y0, w), m); b.position.set(0, (y0 + y1) / 2, 0); scene.add(b); }
  const v = params.get('view') || 'platz';
  const VW = { platz: [[0, 2, 330], [0, 200, 0]], terrasse: [[0, 252, 34], [60, 240, 160]], flug: [[220, 260, 260], [0, 220, 0]] };
  const c = VW[v] || VW.platz; camera.position.set(...c[0]); camera.lookAt(...c[1]);
  startFireworks(+(params.get('len') || 60));
  window.GALA = GALA; window.FEUERWERK = FEUERWERK;
  // ?t=8: so viele Sekunden vorspulen, dann anhalten (für Standbilder)
  const pre = +(params.get('t') || 0); for (let k = 0; k < pre * 30; k++) updateGala(1 / 30);
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!pre) updateGala(dt);
    U.uTime.value = now / 1000; U.uCam.value.copy(camera.position);
    renderer.render(scene, camera); window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
