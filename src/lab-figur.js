/* =====================================================================
   V79 · FIGUREN-SCHAU (index.html?lab=figur): wenige Figuren ganz nah, zum
   Prüfen von Haut, Augen, Haar, Händen, Stoff und Bewegungen. Schnell auch im
   Software-Renderer (tools/lab-shot.js mit LAB=figur).
   ?lab=figur&licht=salon|strasse|studio   Lichtstimmung
   ?lab=figur&akt=17                       Handlung aller Figuren (Zahl wie im Spiel, .5 = Teilnehmer 2)
   ?lab=figur&wer=tux,flapper              nur diese Arten (schneller)
   Maus ziehen dreht, Rad zoomt, Pfeile links/rechts wechseln die Figur, auf/ab die Handlung.
   window.labView(name | 'x_y_z_tx_ty_tz'), window.labPose(akt), window.labTime(t)
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats, PL_W } from './people-skeleton.js';
import { Crowd, GOWNS, COATS } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';

export const FLAB = { crowd: null, t: null, views: {}, cast: [], sel: 0, akt: 0, orbit: null };
// Handlungen zum Durchblättern (Pfeil auf/ab): Zahl wie im Shader, Name fürs Schild
export const FLAB_AKTE = [[0, 'stehen'], [1, 'reden'], [3, 'winken'], [5, 'trinken (Stand)'], [7, 'sitzen'], [10, 'trinken (Sitz)'], [11, 'essen (Sitz)'], [12, 'rauchen'], [15, 'Zigarette'], [17, 'Imbiss'], [44, 'anstoßen'], [45, 'Tasse'], [46, 'Besteck'], [47, 'Uhr'], [48, 'Hut ziehen'], [49, 'Zeitung']];

export function startFigurLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  camera.fov = 36; camera.near = 0.05; camera.updateProjectionMatrix();   // Porträtbrennweite, nah heran
  const licht = params.get('licht') || 'strasse';
  if (licht === 'salon') {
    const a = new T.PointLight(0xffd9a8, 2.4, 16, 1.4); a.position.set(1.2, 3.0, 2.8); scene.add(a);
    const b = new T.PointLight(0xffc890, 1.2, 14, 1.4); b.position.set(-2.6, 2.4, 1.6); scene.add(b);
    const c = new T.PointLight(0xfff0d8, 0.9, 12, 1.4); c.position.set(0, 2.6, -2.5); scene.add(c);
  } else if (licht === 'studio') {
    const a = new T.DirectionalLight(0xfff4e6, 1.6); a.position.set(2, 4, 4); scene.add(a);
    const b = new T.DirectionalLight(0xbfd8ff, 0.5); b.position.set(-3, 2, 1); scene.add(b);
    const c = new T.DirectionalLight(0xffffff, 0.8); c.position.set(0, 3, -4); scene.add(c);
  } else {
    // wie auf der Straße: warme Laterne schräg von vorn, türkiser Schein der Stadt von der anderen Seite
    const lamp = new T.PointLight(0xffc27a, 2.2, 14, 1.6); lamp.position.set(1.6, 3.6, 2.4); scene.add(lamp);
    const teal = new T.PointLight(0x58d0d0, 0.8, 12, 1.6); teal.position.set(-3, 2.5, -1); scene.add(teal);
  }
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;
  // Besetzung: Art, Farbe, Platz x, Aussehen
  const ALL = [
    ['tux', COATS[0], -0.9, look(3, 0, 1)],
    ['flapper', [0.5, 0.05, 0.08], 0.9, look(35, 0, 0, 0, 0)],
    ['suit', COATS[3], -1.8, look(9, 3, 0, 2, 1)],
    ['gown', GOWNS[3], 1.8, look(40, 1, 2)],
    ['braces', [0.2, 0.19, 0.17], -2.7, look(21, 1, 5, 2, 1)],
    ['furcoat', [0.07, 0.07, 0.09], 2.7, look(49, 2, 4, 2, 0)],
    ['dbl', [0.08, 0.08, 0.12], -3.6, look(29, 0, 4, 2, 2)],
    ['lady', [0.1, 0.12, 0.2], 3.6, look(43, 0, 3, 2, 2)],
  ];
  const wer = params.get('wer') ? params.get('wer').split(',') : null;
  const cast = ALL.filter(c => !wer || wer.includes(c[0]));
  const C = FLAB.crowd = new Crowd([...new Set(cast.map(c => c[0]))], 16);
  for (const [kind, col, x, face] of cast) { const a = C.add(kind, col, face); a.bw = 1; a.lab = { x, z: 0, yaw: 0 }; a.gait.splice(0, 3, 0.3 + x, 0.3, 0); FLAB.cast.push(a); }
  C.finish();
  for (const a of C.list) C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw);
  if (!wer || wer.includes('player')) { buildPlayerModel(); if (PM.mesh) { PM.show = true; PM.place(0, 0, 0, 0, { act: 0 }); } }
  const V = FLAB.views = { alle: [[0, 1.45, 5.2], [0, 1.0, 0]], vorn: [[0, 1.5, 2.9], [0, 1.2, 0]] };
  // je Figur: Kopf von vorn, Dreiviertel, Profil, Büste, ganz, hinten, Hände
  const spots = [['p', 0, 1.69], ...cast.map(c => [c[0], c[2], c[0] === 'tux' || c[0] === 'suit' || c[0] === 'braces' || c[0] === 'dbl' ? 1.67 : 1.56])];
  for (const [n, x, hy] of spots) {
    V[n + '-kopf'] = [[x, hy + 0.01, 0.4], [x, hy, 0.05]]; V[n + '-drei'] = [[x + 0.2, hy + 0.02, 0.36], [x, hy, 0.04]]; V[n + '-profil'] = [[x + 0.36, hy + 0.01, 0.06], [x, hy, 0.04]];
    V[n + '-bueste'] = [[x + 0.1, hy - 0.06, 0.72], [x, hy - 0.13, 0]]; V[n + '-ganz'] = [[x + 0.4, 1.2, 2.9], [x, 0.9, 0]]; V[n + '-hinten'] = [[x - 0.3, 1.3, -2.6], [x, 0.95, 0]];
    V[n + '-hand'] = [[x - 0.32, 0.92, 0.36], [x - 0.22, 0.84, 0.06]]; V[n + '-hand2'] = [[x + 0.42, 0.9, 0.25], [x + 0.22, 0.84, 0.06]]; V[n + '-seite'] = [[x + 2.6, 1.1, 0.3], [x, 0.9, 0]];
    V[n + '-ober'] = [[x + 0.25, hy - 0.2, 1.55], [x, hy - 0.42, 0]]; V[n + '-auge'] = [[x + 0.05, hy, 0.24], [x + 0.03, hy - 0.005, 0.1]];
  }
  const setCam = v => { camera.position.set(...v[0]); camera.lookAt(...v[1]); FLAB.orbit = { c: new T.Vector3(...v[1]), r: new T.Vector3(...v[0]).distanceTo(new T.Vector3(...v[1])), a: Math.atan2(v[0][0] - v[1][0], v[0][2] - v[1][2]), e: Math.asin((v[0][1] - v[1][1]) / Math.max(0.01, new T.Vector3(...v[0]).distanceTo(new T.Vector3(...v[1])))) }; C.flag(); };
  window.labView = name => { const q = String(name).split('_').map(Number); setCam(q.length === 6 && q.every(isFinite) ? [q.slice(0, 3), q.slice(3)] : V[name] || V.alle); };
  // Handlung für alle (die Spielerfigur bleibt bei ihren eigenen Posen): akt wie im Shader; 'akt:teil' setzt den Nachkommateil
  window.labPose = akt => { FLAB.akt = +akt || 0; for (const a of FLAB.cast) { a.gait[1] = FLAB.akt; a.gait[2] = 0; a.k6 = null; if (!window.labBlend) a.bl = null; C.set(a, a.lab.x, 0, a.lab.z, a.lab.yaw); } tag(); };
  window.labGait = (amp, speed = 4.6) => { for (const a of FLAB.cast) { a.gait[1] = speed; a.gait[2] = amp; } };
  window.labTime = t => { FLAB.t = t; };
  // V88: Fahrtwind am Spieler (Körperraum, m/s; z<0 = Luft von vorn) und Wind für alle: labAir(0,0,-30), labWind(1,0,12,0.5)
  window.labAir = (x, y, z, lx = 0, ly = 0, lz = 0) => { PL_W.value[0].set(x, y, z, 0); PL_W.value[1].set(lx, ly, lz, 0); };
  window.labWind = (x, z, s, g = 0) => { U.uWind.value.set(x, z, s, g); };
  FLAB.t = params.get('t') != null ? +params.get('t') : null;
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  // Schild unten links: was man sieht
  const sign = document.createElement('div');
  sign.style.cssText = 'position:fixed;left:14px;bottom:12px;color:#e8d9b0;font:14px Georgia,serif;text-shadow:0 1px 3px #000;pointer-events:none;z-index:9';
  if (params.get('t') == null) document.body.appendChild(sign);
  const tag = () => { const k = FLAB_AKTE.find(a => a[0] === Math.floor(FLAB.akt)); sign.textContent = `Figuren-Schau · ${spots[FLAB.sel][0] === 'p' ? 'Alexander' : spots[FLAB.sel][0]} · ${k ? k[1] : 'Handlung ' + FLAB.akt} · Maus dreht, Rad zoomt, Pfeile wechseln`; };
  window.labView(params.get('view') || 'vorn'); if (params.get('akt')) window.labPose(params.get('akt')); tag();
  // Maus und Tasten
  const orb = () => { const o = FLAB.orbit; camera.position.set(o.c.x + o.r * Math.sin(o.a) * Math.cos(o.e), o.c.y + o.r * Math.sin(o.e), o.c.z + o.r * Math.cos(o.a) * Math.cos(o.e)); camera.lookAt(o.c); };
  let drag = null;
  addEventListener('pointerdown', e => { drag = [e.clientX, e.clientY]; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', e => { if (!drag) return; const o = FLAB.orbit; o.a -= (e.clientX - drag[0]) * 0.006; o.e = Math.max(-0.4, Math.min(1.2, o.e + (e.clientY - drag[1]) * 0.005)); drag = [e.clientX, e.clientY]; orb(); });
  addEventListener('wheel', e => { const o = FLAB.orbit; o.r = Math.max(0.18, Math.min(9, o.r * (e.deltaY > 0 ? 1.1 : 0.9))); orb(); }, { passive: true });
  addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { FLAB.sel = (FLAB.sel + (e.key === 'ArrowRight' ? 1 : spots.length - 1)) % spots.length; window.labView(spots[FLAB.sel][0] + '-bueste'); tag(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const i = FLAB_AKTE.findIndex(a => a[0] === Math.floor(FLAB.akt)); window.labPose(FLAB_AKTE[(Math.max(0, i) + (e.key === 'ArrowUp' ? 1 : FLAB_AKTE.length - 1)) % FLAB_AKTE.length][0]); }
  });
  const t0 = performance.now();
  const loop = now => {
    U.uTime.value = FLAB.t != null ? FLAB.t : (now - t0) / 1000;
    for (const a of FLAB.cast) { a.live[0] = 0; a.live[1] = U.uTime.value; }   // keine zufälligen Blicke zur Seite
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
