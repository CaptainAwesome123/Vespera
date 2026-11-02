/* =====================================================================
   V55 · LEBEN-LABOR (index.html?lab=leben[&view=musik][&t=12.5])
   Ohne Stadt: ein Straßenpianist mit Sängerin und Zuhörern, ein
   Leierkastenmann an einer Hauswand, ein Kellner mit Block, ein
   Zeitungsjunge, und eine Reihe Leute, die Alexander je nach Haltung
   begrüßen: Hut ziehen und winken (Bewunderung), wegschauen (Neid),
   rauchend mustern (Skepsis), ducken (Furcht), Mütze ziehen (Respekt),
   Gruß des Polizisten, Verbeugung des Portiers.
   tools/lab-shot.js macht daraus Bilder (LAB=leben).
   ===================================================================== */
import { T, scene, camera, renderer, U, $ } from './core.js';
import { buildEnv, getMats, PL_U } from './people-skeleton.js';
import { Crowd, COATS, DRESSES, GOWNS, SHIRTS, WORKWEAR, turnHead } from './serpentine.js';
import { buildPlayerModel, PM } from './player-model.js';
import { pianoParts, organParts, lifeMesh } from './life.js';

export const LLAB = { crowd: null, t: null };
export function startLifeLab(params) {
  buildEnv(); getMats();
  scene.fog.density = 0.0002;
  for (const [c, i, x, y, z] of [[0xffc27a, 2.4, 1.6, 4.2, 3.4], [0x58d0d0, 0.9, -5, 2.5, -1], [0xffc27a, 1.8, -6, 3.5, -5], [0xffc27a, 1.6, 7, 3.5, -4]]) { const l = new T.PointLight(c, i, 22, 1.6); l.position.set(x, y, z); scene.add(l); }
  const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.MeshStandardMaterial({ color: 0x24201c, roughness: 0.7 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const wall = new T.Mesh(new T.BoxGeometry(30, 6, 0.4), new T.MeshStandardMaterial({ color: 0x5a3a2c, roughness: 0.85 })); wall.position.set(0, 3, -9.2); scene.add(wall);
  // Klavier links (Front nach +z), Leierkasten rechts an der Wand (Mann schaut an der Wand entlang nach -x)
  const P = [], put = (parts, x, z, yaw) => { for (const [g, c] of parts) P.push([g.clone().rotateY(yaw).translate(x, 0, z), c]); };
  put(pianoParts(), -6, -6, 0);
  put(organParts(), 5.2, -8.45, Math.PI / 2);   // Kurbel zeigt nach +x, zum Mann
  scene.add(lifeMesh(P));
  const C = LLAB.crowd = new Crowd(['tux', 'gown', 'dress', 'suit', 'lady', 'worker', 'coat', 'furcoat', 'police', 'livery', 'kid', 'waiter'], 40);
  const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;
  // Zeitverschiebung so, dass Hut ziehen (5) bei t = 12,5 gerade oben ist (wie lab-kraft.js)
  const ph = act => { const fr = x => x - Math.floor(x), P0 = act < 6 ? 7 : 12, s0 = act < 6 ? 0.2 : 0.3; for (let n = 0; n < 400; n++) { const g = n * 0.0137, tt = 12.5 * (0.9 + 0.2 * fr(g * 3.7)) + g * 7, f = fr(tt / P0); if (f > s0 && f < s0 + 0.02) return g; } return 0; };
  const A = (kind, col, x, z, yaw, act, face, tilt = 0, y = 0, look2 = null) => { const a = C.add(kind, col, face); a.lab = { x, y, z, yaw, tilt, look: look2 }; a.gait.splice(0, 3, act > 4.5 && act < 5.5 ? ph(5) : Math.random() * 7, act, 0); return a; };
  // ---- Straßenmusik ----
  A('tux', COATS[0], -6, -4.95, Math.PI, 14.5, look(3, 0, 1, 2, 0), 0, 0.82 - 0.87);   // Pianist auf dem Hocker
  A('gown', GOWNS[3], -4.75, -5.05, 0.5, 0.95, look(40, 1, 0));                        // Sängerin
  A('lady', COATS[5], -7.6, -2.6, 2.6, 9.3, look(36, 2, 3));                            // Zuhörer: Applaus, Nicken, Rauchen
  A('suit', COATS[3], -6.2, -2.2, 3.1, 1.5, look(9, 3, 0, 0, 1));
  A('furcoat', [0.36, 0.07, 0.1], -4.6, -2.5, -2.8, 9.3, look(38, 0, 2, 2, 0));
  A('worker', WORKWEAR[0], 6.0, -8.45, -Math.PI / 2, 29.05, look(21, 1, 5));         // Leierkastenmann: Kurbel drehen
  A('worker', SHIRTS[1], 4.2, -6.4, 2.2, 15.3, look(14, 0, 4));
  A('dress', DRESSES[1], 6.3, -6.2, -2.5, 0.6, look(45, 0, 2));
  A('waiter', [0.92, 0.9, 0.85], 0.4, -6.5, 0, 28.3, look(12, 0, 1));                  // Kellner mit Block
  A('kid', SHIRTS[0], 2.0, -6.8, 0.3, 6.6, look(30, 1, 2), 0, 0, null).sc = 0.64;     // Zeitungsjunge ruft aus
  A('kid', SHIRTS[3], 2.8, -6.6, -0.3, 31.2, look(31, 0, 3)).sc = 0.64;               // … und zeigt die Zeitung
  // ---- Haltungen zu Alexander (er steht bei 0, 0, 4) ----
  A('suit', COATS[2], -4.0, 0.6, 0.6, 5.3, look(5, 0, 0, 2, 0));                       // Bewunderung: Hut ziehen
  A('lady', COATS[1], -2.8, 0.2, 0.45, 3.6, look(44, 0, 3));                           // Bewunderung: winken
  A('furcoat', [0.05, 0.2, 0.21], -1.6, 0.0, -0.9, 12.2, look(41, 0, 2, 2, 0), 0, 0, [-6, -2]);   // Neid: wegschauen, Hand am Kinn
  A('worker', SHIRTS[2], -0.4, 0.0, 0.05, 15.3, look(22, 1, 5), 0.05);                // Skepsis: rauchen, mustern
  A('worker', WORKWEAR[1], 0.9, 0.3, -0.25, 13.2, look(24, 2, 4), -0.4);              // Furcht: geduckt, Arme hoch
  A('worker', WORKWEAR[3], 2.1, 0.2, -0.4, 5.3, look(26, 0, 4), -0.1);                // Respekt: Mütze ziehen
  A('police', [0.06, 0.07, 0.16], 3.3, 0.6, -0.55, 5.3, look(7, 0, 0));               // Polizist grüßt
  A('livery', [0.3, 0.06, 0.08], 4.5, 1.2, -0.75, 1.3, look(8, 0, 1), -0.23);         // Portier verneigt sich
  C.finish();
  for (const a of C.list) { const L = a.lab; C.set(a, L.x, L.y, L.z, L.yaw, a.sc || 1, L.tilt); if (a.live && !L.look && a.kind !== 'worker') a.live[3] = 1.55; if (L.look) turnHead(a, L.look[0], L.look[1]); else if (L.z > -1) turnHead(a, 0, 4); }
  buildPlayerModel();
  if (PM.mesh) { PM.show = true; for (const v of PL_U.value) v.set(0, 0, 0, 0); PL_U.value[5].set(0, 0, 0, 1); PM.place(0, 0, 4, Math.PI, { act: 0 }); }
  const V = {
    alles: [[0, 4.2, 10], [0, 0.8, -3]], musik: [[-4.2, 1.9, 1.2], [-5.6, 1.0, -5]], klavier: [[-3.6, 1.6, -3.4], [-6, 1.0, -5.6]], leierkasten: [[7.6, 1.7, -4.2], [5.0, 1.1, -7.8]],
    haltung: [[0.2, 1.7, 6.6], [0.2, 1.1, 0.3]], haltunglinks: [[-2.4, 1.6, 3.6], [-2.4, 1.1, 0.2]], haltungrechts: [[2.8, 1.6, 3.6], [2.8, 1.0, 0.4]],
    kellner: [[1.6, 1.6, -3.2], [1.4, 1.0, -6.6]], spieler: [[0.8, 1.6, 6.4], [0, 1.0, 4]],
  };
  LLAB.t = params.get('t') != null ? +params.get('t') : null;
  window.labView = name => { const v = V[name] || V.alles; camera.position.set(...v[0]); camera.lookAt(...v[1]); C.flag(); };
  window.labTime = t => { LLAB.t = t; };
  window.labStats = () => ({ people: C.list.length });
  window.labView(params.get('view') || 'alles');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => {
    U.uTime.value = LLAB.t != null ? LLAB.t : (now - t0) / 1000; U.uCam.value.copy(camera.position);
    C.flag(); if (PM.mesh) PM.update(0);
    renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
