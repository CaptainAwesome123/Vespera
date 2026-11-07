/* =====================================================================
   V58 · LEBEN AUF DEM WASSER
   - Der gefrorene Kanal: eine Spalte von vier Blöcken im Osten (x um 495) ist ein Kanal geworden, Eis 2,8 m unter
     der Straße, Kaimauern aus Granit mit Geländer, unter den Querstraßen flache Gewölbe (die Straße ist die Brücke),
     an beiden Enden Schleusentore. Auf jedem offenen Stück eine eiserne Bogenbrücke, eine Treppe zum Eis, Lichterketten
     zwischen den Laternen, schmale Grachtenhäuser an den Avenuen, Bäume, Bänke, Maronenstand und Schlittschuhverleih.
     Auf dem Eis drehen Eisläufer ihre Runden (auch durch die Gewölbe), Kinder, Paare, eine Kunstläuferin.
   - Der Güterkai im Westen des Hafens: steinerne Mole mit Drehkran, Kisten, Fässern, Hafenamt; ein Schlepper zieht
     einen Lastkahn über die Bucht und legt an der Mole an, dann hebt der Kran Kisten an Land und Hafenarbeiter tragen sie fort.
   - Zwei Wassertaxis pendeln zwischen einem neuen Anleger und dem Fähranleger, Fischerboote mit Laternen liegen in
     der Bucht, Ruderboote treiben vor der Promenade, Angler sitzen auf der Mole.
   Alles mit eigenem Zufall (mulberry32): die übrige Stadt bleibt, wie sie war. Keine neuen Shader außer dem Eis
   (Standardmaterial mit gemalter Textur); Menschen in einer eigenen kleinen Menge (Crowd) mit den bekannten Posen.
   ===================================================================== */
import { T, scene, camera, U, mulberry32, MOBILE, canvasTex, FOGVIS, shared } from './core.js';
import { stdMat, addCollider } from './people-skeleton.js';
import { addGlow, addSeg, lamps, trees, roofs } from './facade-shader.js';
import { kit, Bx, wuv, benchGeo, hullShape, rubRail, deckBoxes, railing, nameplate, PLATFORMS, VESSELS, addPlatform, PORT_PEDS, bx6, PIER_Y, FERRY, pfLocal, terrainHeight } from './harbour.js';
import { CANAL, QUAY, onIsland } from './island.js';
import { roundBox, lathe } from './entrances.js';
import { WATER_Y } from './dance.js';
import { waterH } from './water.js';
import { makeGlowPoints } from './ragdoll.js';
import { Crowd, COATS, DRESSES, FURCOATS, FLAPPERS, WORKWEAR, SHIRTS, TWEEDS, TROUSERS } from './serpentine.js';
import { addLight } from './performance.js';
import { fxEmit } from './particles.js';
import { player } from './player.js';
import { INTERACT } from './music.js';
import { toast } from './boat.js';

export const WATER = { crowd: null, skaters: [], statics: [], carriers: [], tug: null, barge: null, taxis: [], drifters: [], crane: null, line: null, wakes: [], stats: {}, near: false };
export const FREIGHT = { x: -600, w: 14, z1: 625, top: 0.25 };   // Güterkai (Mole) westlich des Jachthafens
export const TAXI_LANDING = { x: 300, w: 24 };                     // neuer Anleger der Wassertaxis

const look = (face, tone, hair, hat = 2, style = 0) => face + 64 * tone + 320 * hair + 7680 * hat + 23040 * style;

/* ---------- Eis: gemalte Textur (dunkles, klares Eis, Kufenspuren, Schneestaub, Risse, Schneewehen an den Mauern) ---------- */
let ICE_MAT = null;
export function iceMat() {
  if (ICE_MAT) return ICE_MAT;
  const rr = mulberry32(5858);
  const tex = canvasTex(512, 1024, (g, W, H) => {
    const grd = g.createLinearGradient(0, 0, W, 0);
    grd.addColorStop(0, '#9fb4bc'); grd.addColorStop(0.06, '#4a6670'); grd.addColorStop(0.16, '#22414b'); grd.addColorStop(0.5, '#1b3842'); grd.addColorStop(0.84, '#22414b'); grd.addColorStop(0.94, '#4a6670'); grd.addColorStop(1, '#a3b8c0');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    // trübe Flecken und eingefrorene Luftblasen
    for (let k = 0; k < 140; k++) { const x = rr() * W, y = rr() * H, r = 8 + rr() * 60; const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(150,180,190,${0.05 + rr() * 0.08})`); gg.addColorStop(1, 'rgba(150,180,190,0)'); g.fillStyle = gg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // Kufenspuren: lange, leicht gebogene helle Striche, vor allem in der Mitte
    g.lineCap = 'round';
    for (let k = 0; k < 520; k++) {
      const x = W * (0.12 + rr() * 0.76), y = rr() * H, len = 40 + rr() * 260, bend = (rr() - 0.5) * 60;
      g.strokeStyle = `rgba(215,232,238,${0.05 + rr() * 0.13})`; g.lineWidth = 0.6 + rr() * 1.2;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + bend, y + len / 2, x + (rr() - 0.5) * 30, y + len); g.stroke();
    }
    // Bögen der Kunstläufer
    for (let k = 0; k < 18; k++) { const x = W * (0.3 + rr() * 0.4), y = rr() * H, r = 20 + rr() * 40; g.strokeStyle = `rgba(220,236,240,${0.08 + rr() * 0.1})`; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, rr() * 6, rr() * 6 + 2 + rr() * 3); g.stroke(); }
    // Risse
    for (let k = 0; k < 14; k++) { let x = rr() * W, y = rr() * H; g.strokeStyle = `rgba(230,240,245,${0.12 + rr() * 0.15})`; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (rr() - 0.5) * 40; y += (rr() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    // Schneestaub
    for (let k = 0; k < 2600; k++) { const e = rr() < 0.5 ? rr() * 0.14 : 1 - rr() * 0.14, x = (rr() < 0.55 ? e : rr()) * W, y = rr() * H; g.fillStyle = `rgba(235,242,246,${0.12 + rr() * 0.3})`; g.fillRect(x, y, 1 + rr() * 2.5, 1 + rr() * 2.5); }
  });
  tex.wrapS = T.ClampToEdgeWrapping; tex.wrapT = T.RepeatWrapping;
  // Helligkeit = Rauheit: klares Eis glänzt, Schnee und Kratzer sind matt
  ICE_MAT = stdMat({ map: tex, roughnessMap: tex, color: 0xd4e6ec, roughness: 0.7, metalness: 0.0, envI: 0.45 });
  return ICE_MAT;
}

/* ---------- Kanal: Mauern, Gewölbe, Tore, Eis ---------- */
// Unterseite des flachen Gewölbes: Scheitel 0,35 m unter der Straße, Stichbogen über die ganze Breite
export const VAULT = { crown: -0.35, R: 40.6 };
export const vaultY = dx => VAULT.crown - (VAULT.R - Math.sqrt(Math.max(0, VAULT.R * VAULT.R - dx * dx)));
function vaultGeo(x, z0, z1, hw) {
  const n = 24, pos = [], idx = [];
  for (let i = 0; i <= n; i++) { const dx = -hw + 2 * hw * i / n, y = vaultY(dx); pos.push(x + dx, y, z0, x + dx, y, z1); }
  for (let i = 0; i < n; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, c, d, b); }   // Normalen nach unten
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return wuv(g.toNonIndexed(), 2);
}
// Stirnseite eines Gewölbes (Zwickel zwischen Bogen und Straße), Bogenring und Schlussstein
function archFace(K, x, z, hw, dir) {
  const n = 20;
  for (let i = 0; i < n; i++) {
    const a = -hw + 2 * hw * i / n, b = a + 2 * hw / n, y = Math.min(vaultY(a), vaultY(b));
    K.add('stone', Bx(b - a + 0.02, -y + 0.02, 0.7, x + (a + b) / 2, y / 2, z - dir * 0.35, 1), [0.78, 0.76, 0.74]);
  }
  const pts = []; for (let i = 0; i <= 30; i++) { const dx = -hw - 0.2 + (2 * hw + 0.4) * i / 30; pts.push(new T.Vector3(x + dx, vaultY(Math.min(hw, Math.abs(dx))) - 0.12, z + dir * 0.04)); }
  K.add('stone', new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.18, 5, false), [0.92, 0.89, 0.84]);
  K.add('stone', Bx(0.9, 0.7, 0.5, x, VAULT.crown - 0.15, z + dir * 0.12, 1), [0.95, 0.92, 0.86]);
  K.add('gold', new T.CircleGeometry(0.22, 16).rotateY(dir > 0 ? 0 : Math.PI).translate(x, VAULT.crown - 0.15, z + dir * 0.38));
}
// Geländer auf der Kaikante: Steinpfosten, eiserne Stäbe, goldener Handlauf; Lücken für Treppen. axis 'z': läuft in z bei x
function quayRail(K, axis, at, a0, a1, gaps = []) {
  let a = a0;
  for (const [g0, g1] of [...gaps.filter(g => g[1] > a0 && g[0] < a1).sort((p, q) => p[0] - q[0]), [a1, a1]]) {
    const b = Math.min(g0, a1);
    if (b - a > 0.4) {
      const L = b - a, m = (a + b) / 2, P = (u, y, z0) => axis === 'z' ? [at + z0, y, u] : [u, y, at + z0];
      const box = (w, h, d, u, y) => axis === 'z' ? Bx(d, h, w, at, y, u, 1) : Bx(w, h, d, u, y, at, 1);
      K.add('stone', box(L, 0.2, 0.75, m, 0.32), [0.86, 0.84, 0.8]);
      K.add('gold', axis === 'z' ? new T.CylinderGeometry(0.04, 0.04, L, 6).rotateX(Math.PI / 2).translate(...P(m, 1.12, 0)) : new T.CylinderGeometry(0.04, 0.04, L, 6).rotateZ(Math.PI / 2).translate(...P(m, 1.12, 0)));
      K.add('iron', box(L, 0.05, 0.05, m, 0.52));
      for (let u = a + 0.15; u < b; u += 0.32) K.add('iron', new T.CylinderGeometry(0.014, 0.014, 0.66, 4).translate(...P(u, 0.75, 0)));
      for (const u of [a + 0.2, b - 0.2]) { K.add('stone', box(0.38, 0.95, 0.38, u, 0.72), [0.88, 0.85, 0.8]); K.add('gold', new T.SphereGeometry(0.1, 8, 6).translate(...P(u, 1.28, 0))); }
      if (axis === 'z') addCollider(at - 0.2, 0.22, a, at + 0.2, 1.2, b); else addCollider(a, 0.22, at - 0.2, b, 1.2, at + 0.2);
    }
    a = Math.max(a, g1);
  }
}

export function buildCanal() {
  if (!CANAL.on) return;
  const K = kit(), cx = CANAL.x, hw = CANAL.hw, ice = CANAL.ice, zA = CANAL.zA, zB = CANAL.zB, rr = mulberry32(5801);
  // Eis über die ganze Länge (die offenen Stücke und die Gewölbe)
  { const g = new T.PlaneGeometry(2 * hw, zB - zA).rotateX(-Math.PI / 2).translate(cx, ice, (zA + zB) / 2), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - cx + hw) / (2 * hw), (p.getZ(i) - zA) / 40);
    const m = new T.Mesh(g, iceMat()); m.receiveShadow = true; scene.add(m); WATER.ice = m; }
  // Mauern links und rechts (durchgehend, hinter den Gewölben unsichtbar), Fuß mit Schneewehe
  for (const s of [-1, 1]) {
    K.add('stone', Bx(0.6, 3.6, zB - zA, cx + s * (hw + 0.3), -1.8 + 0.0, (zA + zB) / 2, 2), [0.72, 0.71, 0.7]);
    for (let z = zA; z < zB - 0.1; z += 6) { const L = Math.min(6, zB - z); K.add('cloth', new T.CylinderGeometry(0.55, 0.55, L, 8, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(s > 0 ? Math.PI / 2 : -Math.PI / 2).scale(1, 0.45, 1).translate(cx + s * (hw - 0.02), ice, z + L / 2), [0.88, 0.9, 0.94]); }
  }
  // Gewölbe unter den Straßen, Stirnseiten, Laternen im Gewölbe, Schleusentore an den Enden
  for (const t of CANAL.tun) {
    K.add('stone', vaultGeo(cx, t.z0, t.z1, hw), [0.8, 0.78, 0.76]);
    if (t.end !== -1) archFace(K, cx, t.z0, hw, -1);
    if (t.end !== 1) archFace(K, cx, t.z1, hw, 1);
    for (const s of [-1, 1]) addCollider(cx + s * hw + (s > 0 ? 0 : -0.6), -3.6, t.z0, cx + s * hw + (s > 0 ? 0.6 : 0), -0.3, t.z1);
    if (!t.end) addLight(0xffb870, 1.0, 16, 1.8, cx, ice + 1.6, (t.z0 + t.z1) / 2);
    for (let z = t.z0 + 3; z < t.z1 - 1; z += 7) for (const s of [-1, 1]) {
      const x = cx + s * (hw - 0.12);
      K.add('iron', Bx(0.22, 0.42, 0.3, x, ice + 0.85, z, 1)); K.add('lit', new T.PlaneGeometry(0.26, 0.3).rotateY(-s * Math.PI / 2).translate(x - s * 0.12, ice + 0.85, z), [1.6, 1.05, 0.55]);
      addGlow(x - s * 0.3, ice + 0.85, z, [1.25, 0.82, 0.42], 1.4);
    }
    if (t.end) {
      const z = t.end < 0 ? t.z0 : t.z1, d = t.end;
      K.add('iron', Bx(2 * hw, -ice + vaultY(0) + 0.05, 0.35, cx, (ice + vaultY(0)) / 2, z - d * 0.1, 2), [0.2, 0.22, 0.24]);
      for (let k = 0; k < 4; k++) K.add('iron', Bx(2 * hw, 0.12, 0.12, cx, ice + 0.4 + k * 0.6, z - d * 0.3, 2), [0.3, 0.3, 0.32]);
      for (let k = -4; k <= 4; k++) K.add('iron', Bx(0.14, -ice + vaultY(k * 2.2), 0.12, cx + k * 2.2, (ice + vaultY(k * 2.2)) / 2, z - d * 0.3, 1), [0.3, 0.3, 0.32]);
      K.add('gold', new T.TorusGeometry(0.7, 0.06, 6, 24).translate(cx, ice + 1.4, z - d * 0.4)); K.add('gold', new T.CircleGeometry(0.35, 16).rotateY(d > 0 ? Math.PI : 0).translate(cx, ice + 1.4, z - d * 0.38));
      addCollider(cx - hw, -3.6, z - (d > 0 ? 0.4 : 0), cx + hw, -0.3, z + (d > 0 ? 0 : 0.4));
      addGlow(cx, ice + 2.2, z - d * 1.2, [1.2, 0.8, 0.4], 1.6);
    }
  }
  // Offene Stücke: Kaikanten mit Geländer, Treppe, Brücke, Lichterketten, Laternen, Bäume, Bänke, Häuser
  const STAIR_W = 1.8, NST = 16, RISE = (0.22 - ice) / NST, RUN = 0.34;
  WATER.spots = [];
  CANAL.open.forEach((o, k) => {
    const b = o.b, side = k % 2 ? 1 : -1, zs = o.z0 + 6 + rr() * 4, zm = (o.z0 + o.z1) / 2 + (k % 2 ? 6 : -6);
    // Treppe an der Mauer: von der Kaikante hinunter aufs Eis
    const sx0 = cx + side * hw, sx1 = cx + side * (hw - STAIR_W);
    for (let i = 0; i < NST; i++) {
      const top = 0.22 - (i + 1) * RISE, za = zs + i * RUN, zb = za + RUN;
      K.add('stone', Bx(STAIR_W, top - ice + 0.05, RUN + 0.01, (sx0 + sx1) / 2, (top + ice - 0.05) / 2, (za + zb) / 2, 1), [0.82, 0.8, 0.77]);
      addCollider(Math.min(sx0, sx1), -3.6, za, Math.max(sx0, sx1), top, zb);
    }
    { // Treppengeländer zur Kanalseite (schräg)
      const xr = sx1 - side * 0.06, za = zs, zb = zs + NST * RUN, ya = 0.22 + 1.0, yb = ice + 1.0, L = Math.hypot(zb - za, ya - yb);
      K.add('gold', new T.CylinderGeometry(0.035, 0.035, L, 6).rotateX(Math.PI / 2 - Math.atan2(ya - yb, zb - za)).translate(xr, (ya + yb) / 2, (za + zb) / 2));
      for (let i = 0; i <= NST; i += 2) { const z = za + i * RUN, y = 0.22 - i * RISE; K.add('iron', new T.CylinderGeometry(0.02, 0.02, 1.0, 5).translate(xr, y + 0.5, z)); }
      for (let i = 0; i < NST; i++) addCollider(xr - 0.08, 0.22 - (i + 1) * RISE, zs + i * RUN, xr + 0.08, 0.22 - i * RISE + 1.0, zs + (i + 1) * RUN);
    }
    // Kaikanten mit Geländer (Lücke oben an der Treppe), Stirnseiten über den Gewölben
    for (const s of [-1, 1]) quayRail(K, 'z', cx + s * (hw + 0.2), o.z0 + 0.2, o.z1 - 0.2, s === side ? [[zs - 0.3, zs + 1.1]] : []);
    for (const z of [o.z0 - 0.2, o.z1 + 0.2]) quayRail(K, 'x', z, cx - hw - 0.4, cx + hw + 0.4);
    // eiserne Bogenbrücke mit Goldgeländer und zwei Laternen
    const BW = 3.2, span = hw + 0.6, yD = x => 0.22 + 0.9 * Math.cos(Math.PI / 2 * Math.min(1, Math.abs(x - cx) / span));
    for (let x = cx - span; x < cx + span - 0.01; x += 0.8) {
      const xe = Math.min(cx + span, x + 0.8), y0 = yD(x), y1 = yD(xe), L = Math.hypot(xe - x, y1 - y0), a = Math.atan2(y1 - y0, xe - x);
      K.add('plank', Bx(L + 0.04, 0.12, BW, 0, 0, 0, 1).rotateZ(a).translate((x + xe) / 2, (y0 + y1) / 2 - 0.06, zm), [0.55, 0.45, 0.36]);
      K.add('iron', new T.BoxGeometry(L + 0.04, 0.3, BW + 0.1).rotateZ(a).translate((x + xe) / 2, (y0 + y1) / 2 - 0.27, zm), [0.12, 0.14, 0.15]);
      addCollider(x, Math.max(y0, y1) - 0.45, zm - BW / 2, xe, Math.max(y0, y1), zm + BW / 2);
    }
    for (const s of [-1, 1]) {
      const zr = zm + s * (BW / 2 + 0.02), arch = [], top = [], mid = [];
      for (let i = 0; i <= 24; i++) { const x = cx - hw + 2 * hw * i / 24, u = (x - cx) / hw; arch.push(new T.Vector3(x, 0.75 - 2.55 * u * u, zr)); }
      for (let i = 0; i <= 24; i++) { const x = cx - span + 2 * span * i / 24; top.push(new T.Vector3(x, yD(x) + 1.05, zr)); mid.push(new T.Vector3(x, yD(x) + 0.5, zr)); }
      K.add('iron', new T.TubeGeometry(new T.CatmullRomCurve3(arch), 40, 0.09, 6, false), [0.16, 0.18, 0.2]);
      K.add('gold', new T.TubeGeometry(new T.CatmullRomCurve3(top), 40, 0.04, 6, false));
      K.add('iron', new T.TubeGeometry(new T.CatmullRomCurve3(mid), 40, 0.02, 4, false));
      for (let i = 1; i < 12; i++) { const x = cx - hw + 2 * hw * i / 12, u = (x - cx) / hw, ya = 0.75 - 2.55 * u * u, yb = yD(x) + 1.05; K.add('iron', new T.CylinderGeometry(0.018, 0.018, yb - ya, 4).translate(x, (ya + yb) / 2, zr)); }
      for (let i = 0; i < 24; i++) { const x = cx - span + (i + 0.5) * span / 12; addCollider(x - span / 24, yD(x), zr - 0.06, x + span / 24, yD(x) + 1.1, zr + 0.06); }
      // Bogenlaterne in der Mitte
      const ly = yD(cx);
      K.add('iron', new T.CylinderGeometry(0.05, 0.07, 2.2, 6).translate(cx, ly + 1.1, zr + s * 0.05));
      K.add('gold', lathe([[0.16, 0], [0.2, 0.08], [0.14, 0.42], [0.04, 0.55], [0, 0.6]], 8).translate(cx, ly + 2.25, zr + s * 0.05));
      K.add('lit', new T.SphereGeometry(0.15, 8, 6).translate(cx, ly + 2.42, zr + s * 0.05), [1.6, 1.1, 0.6]);
      addGlow(cx, ly + 2.42, zr + s * 0.05, [1.3, 0.9, 0.5], 2.2);
    }
    // Laternen auf dem Kai und Lichterketten über das Eis
    const lampZ = [];
    for (let z = o.z0 + 4; z < o.z1 - 2; z += 13) lampZ.push(z);
    for (const z of lampZ) for (const s of [-1, 1]) lamps.push({ x: cx + s * (hw + 1.3), z, h: 4.8, y: 0.22 });
    for (const z of lampZ) {
      if (Math.abs(z - zm) < 4) continue;
      const pts = [], n = 22, x0 = cx - hw - 1.3, x1 = cx + hw + 1.3;
      for (let i = 0; i <= n; i++) { const u = i / n; pts.push([x0 + (x1 - x0) * u, 0.22 + 4.65 - 1.1 * Math.sin(Math.PI * u), z]); }
      K.add('iron', new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(p => new T.Vector3(...p))), 30, 0.008, 3, false));
      for (let i = 1; i < n; i++) { const p = pts[i], c = i % 3 === 0 ? [1.7, 1.25, 0.7] : i % 3 === 1 ? [1.6, 1.0, 0.45] : [1.75, 1.45, 0.95]; K.add('lit', new T.OctahedronGeometry(0.075, 0).translate(p[0], p[1] - 0.09, p[2]), c); }
      addGlow(cx, 0.22 + 3.6, z, [1.25, 0.9, 0.5], 2.6);
    }
    addLight(0xffc27a, 1.5, 24, 1.6, cx, ice + 4.2, (o.z0 + o.z1) / 2);
    // Bäume und Bänke auf den Kaipromenaden (Bänke mit Blick aufs Eis)
    for (const s of [-1, 1]) {
      for (let z = o.z0 + 7; z < o.z1 - 4; z += 11) trees.push({ x: cx + s * (hw + 9.5), z: z + rr() * 2, s: 0.75 + rr() * 0.3, sp: 'linden' });
      for (let z = o.z0 + 10; z < o.z1 - 6; z += 15) {
        if (s === side && Math.abs(z - zs) < 6) continue;
        benchGeo(K, 2.0, cx + s * (hw + 3.6), 0.22, z, s > 0 ? Math.PI / 2 : -Math.PI / 2); addCollider(cx + s * (hw + 3.6) - 0.3, 0, z - 1, cx + s * (hw + 3.6) + 0.3, 0.66, z + 1);
        WATER.spots.push({ kind: 'bench', x: cx + s * (hw + 3.6), z, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, s });
      }
    }
    // Buden: auf dem ersten Stück Schlittschuhverleih an der Treppe, auf dem zweiten der Maronenstand, auf dem dritten Glühwein
    const bx = cx + side * (hw + 4.4);
    if (k % 3 === 0) booth(K, bx, zs + 0.5, side, 'SCHLITTSCHUHE', [0.08, 0.32, 0.34], 'rent');
    else if (k % 3 === 1) booth(K, bx, zs + 0.5, side, 'HEISSE MARONEN', [0.62, 0.12, 0.16], 'nuts');
    else booth(K, bx, zs + 0.5, side, 'PUNSCH', [0.78, 0.6, 0.3], 'punch');
    WATER.spots.push({ kind: 'booth', x: bx, z: zs + 0.5, s: side, k });
    WATER.spots.push({ kind: 'stair', x: cx + side * (hw - 0.9), z: zs + NST * RUN + 1.5, s: side, k });
    WATER.spots.push({ kind: 'bridge', x: cx, z: zm, k });
    // Grachtenhäuser an den Avenuen: schmal, verschieden hoch, Front zum Kanal, je eine Haustür mit Oberlicht
    const H = [[0.82, 0.74, 0.6], [0.72, 0.5, 0.4], [0.86, 0.8, 0.68], [0.5, 0.54, 0.64], [0.4, 0.58, 0.54], [0.84, 0.76, 0.6], [0.66, 0.44, 0.34], [0.58, 0.46, 0.62]];
    for (const s of [-1, 1]) {
      const n = 3, L = o.z1 - o.z0;
      let z = o.z0;
      for (let i = 0; i < n; i++) {
        const w = i < n - 1 ? L / n + (rr() - 0.5) * 4 : o.z1 - z, dep = 14.2 + rr() * 1.4, Hh = Math.round((13 + rr() * 12) / 3.6) * 3.6 + 0.2;
        const xin = s < 0 ? b.x0 + 4.5 : b.x1 - 4.5, xf = xin - s * dep, hx = (xin + xf) / 2, hz = z + w / 2, c = H[Math.floor(rr() * H.length)], sd = 470 + k * 10 + i + (s > 0 ? 5 : 0);
        addSeg({ x: hx, z: hz, w: dep, d: w - 0.3, y0: 0.2, y1: Hh, tint: c, seed: sd, style: rr() < 0.5 ? 0 : 1, dens: 0.42 + rr() * 0.2, flood: 0 }, true);
        addSeg({ x: hx, z: hz, w: dep + 0.5, d: w + 0.2, y0: Hh, y1: Hh + 0.45, tint: c.map(v => v * 0.85), seed: sd + 50, style: 3, dens: 0, flood: 0 }, false);
        roofs.push({ x: hx, z: hz, w: dep, d: w - 0.3, H: Hh + 0.45, worker: false, dist: Math.hypot(hx, hz), edges: { n: i === 0, s: i === n - 1 }, fw: dep, fd: w - 0.3, fx: hx, fz: hz, shop: false, arcade: false });
        const dz = hz + (rr() - 0.5) * (w - 5), nx = -s;
        K.add('plank', Bx(0.12, 2.4, 1.3, xf + nx * 0.06, 0.22 + 1.2, dz, 1), [0.22, 0.14, 0.09]);
        K.add('stone', Bx(0.3, 0.28, 1.9, xf + nx * 0.12, 0.22 + 2.56, dz, 1), [0.86, 0.8, 0.7]);
        K.add('lit', new T.PlaneGeometry(1.1, 0.36).rotateY(nx * Math.PI / 2).translate(xf + nx * 0.14, 0.22 + 2.75, dz), [1.5, 1.0, 0.55]);
        K.add('gold', Bx(0.1, 0.08, 0.5, xf + nx * 0.15, 0.22 + 0.06, dz, 1));
        addGlow(xf + nx * 0.6, 0.22 + 3.0, dz, [1.2, 0.8, 0.42], 1.0);
        z += w;
      }
    }
  });
  // Schilder an den Brückenköpfen der Straßen: "EISKANAL"
  { const sg = nameplate('EISKANAL', 3.2, 0.6, '#f2d08a', '#0e2a2e'); const o = CANAL.open[0]; sg.position.set(cx + hw + 0.8, 1.55, o.z0 - 0.2); sg.rotation.y = 0; scene.add(sg);
    K.add('iron', new T.CylinderGeometry(0.04, 0.05, 1.9, 6).translate(cx + hw + 0.8, 0.22 + 0.95, o.z0 - 0.25)); }
  K.build(scene);
  WATER.stats.canal = { open: CANAL.open.length, tunnels: CANAL.tun.length, len: Math.round(zB - zA) };
}
// Bude mit gestreiftem Dach, Theke, Schild und Glut (Maronen) oder Regal mit Schlittschuhen
function booth(K, x, z, side, label, stripe, kind) {
  const w = 2.6, d = 1.8, y = 0.22, nx = -side;   // Front zum Kanal
  K.add('varnish', wuv(roundBox(d, 1.1, w, 0.05).translate(x, y + 0.55, z), 1.5), [0.55, 0.36, 0.22]);
  K.add('plank', Bx(d + 0.2, 0.06, w + 0.2, x, y + 1.13, z, 1), [0.5, 0.4, 0.3]);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) K.add('iron', new T.CylinderGeometry(0.035, 0.035, 1.4, 5).translate(x + sx * d / 2, y + 1.8, z + sz * w / 2));
  for (let i = 0; i < 6; i++) K.add('cloth', new T.PlaneGeometry(w / 6, d + 0.5).rotateX(-Math.PI / 2).rotateZ(nx * 0.25).translate(x, y + 2.55, z - w / 2 + (i + 0.5) * w / 6), i % 2 ? [0.9, 0.86, 0.78] : stripe);
  const sg = nameplate(label, 2.2, 0.42, '#f6d48e', '#14110e'); sg.position.set(x + nx * (d / 2 + 0.3), y + 2.25, z); sg.rotation.y = nx > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(sg);
  addCollider(x - d / 2, 0, z - w / 2, x + d / 2, y + 1.15, z + w / 2);
  if (kind === 'nuts') {
    K.add('iron', lathe([[0.3, 0], [0.32, 0.25], [0.3, 0.5], [0.05, 0.52]], 10).translate(x + nx * 0.2, y + 1.16, z - 0.6), [0.2, 0.18, 0.17]);
    K.add('lit', new T.CircleGeometry(0.26, 12).rotateX(-Math.PI / 2).translate(x + nx * 0.2, y + 1.69, z - 0.6), [1.9, 0.6, 0.15]);
    addGlow(x + nx * 0.2, y + 1.85, z - 0.6, [1.5, 0.55, 0.15], 1.6); addLight(0xff8a3a, 0.9, 7, 2, x + nx * 0.8, y + 2.0, z);
  } else if (kind === 'rent') {
    for (let i = 0; i < 8; i++) { const zz = z - 1.0 + i * 0.28; K.add('leather', roundBox(0.12, 0.2, 0.28, 0.04).translate(x - nx * 0.6, y + 1.35, zz), i % 2 ? [0.15, 0.1, 0.07] : [0.85, 0.82, 0.76]); K.add('chrome', Bx(0.02, 0.03, 0.34, x - nx * 0.6, y + 1.22, zz, 1)); }
    addGlow(x + nx * 0.5, y + 2.2, z, [1.25, 0.9, 0.5], 1.4); addLight(0xffc27a, 0.7, 7, 2, x + nx * 0.8, y + 2.2, z);
  } else {
    K.add('chrome', lathe([[0.25, 0], [0.26, 0.45], [0.2, 0.55], [0.05, 0.6]], 12).translate(x + nx * 0.25, y + 1.16, z + 0.6));
    for (let i = 0; i < 6; i++) K.add('glass', new T.CylinderGeometry(0.04, 0.035, 0.1, 8).translate(x + nx * 0.6, y + 1.21, z - 0.8 + i * 0.18));
    addGlow(x + nx * 0.5, y + 2.2, z, [1.3, 0.85, 0.45], 1.4); addLight(0xffb060, 0.7, 7, 2, x + nx * 0.8, y + 2.2, z);
  }
}

/* ---------- Güterkai: steinerne Mole mit Drehkran, Kisten, Fässern, Hafenamt, Laternen ---------- */
export function buildFreightQuay() {
  const K = kit(), F = FREIGHT, x0 = F.x - F.w / 2, x1 = F.x + F.w / 2, za = QUAY.z1, zb = F.z1, top = F.top, rr = mulberry32(6061);
  addCollider(x0, -3, za - 0.1, x1, top, zb);
  K.add('stone', Bx(F.w, 4.6, zb - za, F.x, -2.05, (za + zb) / 2, 3), [0.74, 0.73, 0.74]);
  K.add('stone', Bx(F.w, 0.2, zb - za, F.x, top - 0.1, (za + zb) / 2, 4), [0.86, 0.84, 0.8]);
  // Fender aus Holz an der Westseite (dort legt der Lastkahn an), Poller, Leitern
  for (let z = za + 4; z < zb - 1; z += 3) K.add('plank', Bx(0.3, 2.6, 0.35, x0 - 0.15, -1.2, z, 1), [0.3, 0.22, 0.16]);
  K.add('plank', Bx(0.35, 0.3, zb - za - 4, x0 - 0.2, -0.05, (za + zb) / 2 + 1.5, 1), [0.3, 0.22, 0.16]);
  for (let z = za + 8; z < zb - 2; z += 12) { K.add('iron', lathe([[0.22, 0], [0.18, 0.08], [0.14, 0.4], [0.22, 0.48], [0.24, 0.55], [0, 0.58]], 12).translate(x0 + 0.6, top, z)); addCollider(x0 + 0.38, 0, z - 0.22, x0 + 0.82, top + 0.6, z + 0.22); }
  for (const s of [-1, 1]) for (let z = za + 20; z < zb; z += 30) for (let k = 0; k < 8; k++) K.add('iron', Bx(0.03, 0.03, 0.5, F.x + s * (F.w / 2 + 0.05), top - 0.3 - k * 0.3, z, 1));
  // Ostseite und Kopf: Kante mit niedriger Brüstung
  K.add('stone', Bx(0.5, 0.6, zb - za - 2, x1 - 0.25, top + 0.3, (za + zb) / 2 + 1, 1), [0.82, 0.8, 0.76]); addCollider(x1 - 0.5, 0, za + 2, x1, top + 0.9, zb);
  K.add('stone', Bx(F.w, 0.6, 0.5, F.x, top + 0.3, zb - 0.25, 1), [0.82, 0.8, 0.76]); addCollider(x0, 0, zb - 0.5, x1, top + 0.9, zb);
  // Kranschienen
  for (const dx of [-3.5, 1.5]) K.add('iron', Bx(0.12, 0.08, 40, F.x + dx, top + 0.04, 590, 1), [0.4, 0.38, 0.36]);
  // Kistenstapel, Fässer, Säcke (der Kran setzt seine Kisten daneben ab)
  const crate = (x, y, z, s = 1, c = [0.55, 0.42, 0.28], a = 0) => { K.add('plank', Bx(1.2 * s, 1.0 * s, 1.0 * s, 0, 0, 0, 1).rotateY(a).translate(x, y + 0.5 * s, z), c); for (const dy of [0.1, 0.9]) K.add('plank', Bx(1.24 * s, 0.08 * s, 1.04 * s, 0, 0, 0, 1).rotateY(a).translate(x, y + dy * s, z), c.map(v => v * 0.75)); };
  const stacks = [[-595.5, 603], [-595.5, 608], [-597.8, 612]];
  for (const [sx, sz] of stacks) { const n = 2 + Math.floor(rr() * 2); for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) crate(sx + (j ? 1.25 : 0), top + i, sz + (rr() - 0.5) * 0.2, 1, [[0.55, 0.42, 0.28], [0.42, 0.34, 0.24], [0.6, 0.5, 0.36]][Math.floor(rr() * 3)]); addCollider(sx - 0.65, 0, sz - 0.55, sx + 1.9, top + n, sz + 0.55); }
  for (let i = 0; i < 7; i++) { const x = -598 + (i % 4) * 0.75, z = 618 + Math.floor(i / 4) * 0.8; K.add('varnish', lathe([[0.3, 0], [0.34, 0.45], [0.3, 0.9], [0.01, 0.9]], 12).translate(x, top, z), [0.38, 0.26, 0.16]); for (const y of [0.15, 0.75]) K.add('iron', new T.TorusGeometry(0.33, 0.015, 4, 16).rotateX(Math.PI / 2).translate(x, top + y, z)); }
  addCollider(-598.4, 0, 617.6, -595.4, top + 0.9, 619.4);
  for (let i = 0; i < 6; i++) K.add('cloth', new T.SphereGeometry(0.42, 8, 6).scale(1.2, 0.55, 0.8).translate(-603.8 + (i % 3) * 0.95, top + 0.25 + Math.floor(i / 3) * 0.42, 617 + (rr() - 0.5) * 0.3), [0.62, 0.55, 0.42]);
  // Hafenamt: kleines Haus mit Uhr und erleuchteten Fenstern an der Wurzel der Mole
  { const hx = -596.2, hz = za + 7, w = 4.6, d = 6;
    K.add('stone', Bx(w, 3.4, d, hx, top + 1.7, hz, 2), [0.84, 0.8, 0.72]);
    K.add('paint', wuv(roundBox(w + 0.5, 0.3, d + 0.5, 0.08).translate(hx, top + 3.55, hz), 2), [0.14, 0.24, 0.24]);
    for (const dz of [-1.5, 1.5]) { K.add('lit', new T.PlaneGeometry(1.1, 1.2).rotateY(-Math.PI / 2).translate(hx - w / 2 - 0.01, top + 1.9, hz + dz), [1.4, 0.95, 0.5]); K.add('gold', Bx(0.06, 1.3, 1.2, hx - w / 2 - 0.02, top + 1.9, hz + dz, 1)); }
    K.add('plank', Bx(0.1, 2.2, 1.0, hx - w / 2 - 0.05, top + 1.1, hz - d / 2 + 0.9, 1), [0.25, 0.16, 0.1]);
    K.add('lit', new T.CircleGeometry(0.42, 20).rotateY(-Math.PI / 2).translate(hx - w / 2 - 0.02, top + 3.0, hz), [1.5, 1.35, 1.0]);
    addCollider(hx - w / 2, 0, hz - d / 2, hx + w / 2, top + 3.7, hz + d / 2);
    const sg = nameplate('HAFENAMT', 2.6, 0.5, '#f2d08a', '#0e2a2e'); sg.position.set(hx - w / 2 - 0.05, top + 3.55, hz); sg.rotation.y = -Math.PI / 2; scene.add(sg);
    addGlow(hx - w / 2 - 0.6, top + 2.8, hz - d / 2 + 0.9, [1.25, 0.82, 0.42], 1.3); }
  // Tor mit Leuchtschrift am Kai
  { const gz = za - 0.2;
    for (const s of [-1, 1]) { K.add('stone', Bx(0.7, 5.2, 0.7, F.x + s * 6.3, 2.8, gz, 1), [0.82, 0.78, 0.7]); K.add('gold', new T.ConeGeometry(0.3, 0.8, 4).translate(F.x + s * 6.3, 5.8, gz)); }
    K.add('iron', Bx(13.2, 0.5, 0.4, F.x, 5.2, gz, 1), [0.2, 0.2, 0.22]);
    for (const [ry, dz] of [[Math.PI, -0.25], [0, 0.25]]) { const sg = nameplate('GÜTERKAI', 4.4, 0.8, '#f6c76a', null); sg.position.set(F.x, 4.4, gz + dz); sg.rotation.y = ry; scene.add(sg); } }
  for (let z = za + 14; z < zb - 3; z += 16) lamps.push({ x: x1 - 1.0, z, h: 4.8, y: top });
  lamps.push({ x: x0 + 1.0, z: zb - 2, h: 4.8, y: top });
  K.build(scene);
  buildCrane();
}

/* ---------- Drehkran auf Schienen: Portal, drehbares Haus mit Ausleger, Seil und Haken mit Kiste ---------- */
export const CRANE = { x: -603, z: 595, top: 0, pick: [-611.5, 595], drop: [], yaw: 0, t: 0, slot: 0, g: null, tur: null, rope: null, hook: null, crate: null, placed: [] };
function buildCrane() {
  const F = FREIGHT, C = CRANE; C.top = F.top + 6.2;
  C.drop = [0.75, 0.88, 1.01, 1.14, 1.27];   // Schwenkwinkel der Ablageplätze (auf dem Kreis, den der Haken beschreibt)
  const g = new T.Group(); g.position.set(C.x, F.top, C.z); scene.add(g); C.g = g;
  const K = kit();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { K.add('paint', Bx(0.35, 6.0, 0.35, sx * 2.5 + 1, 3.0, sz * 2.2, 1), [0.62, 0.18, 0.12]); K.add('iron', Bx(0.6, 0.35, 0.8, sx * 2.5 + 1, 0.18, sz * 2.2, 1)); }
  for (const sz of [-1, 1]) for (const y of [2.2, 5.9]) K.add('paint', Bx(5.4, 0.3, 0.3, 1, y, sz * 2.2, 1), [0.62, 0.18, 0.12]);
  for (const sx of [-1, 1]) K.add('paint', Bx(0.3, 0.3, 4.7, sx * 2.5 + 1, 5.9, 0, 1), [0.62, 0.18, 0.12]);
  for (const sz of [-1, 1]) K.add('paint', new T.BoxGeometry(0.12, 6.4, 0.12).rotateZ(0.72).translate(1, 3.0, sz * 2.2), [0.5, 0.15, 0.1]);
  K.add('iron', new T.CylinderGeometry(1.4, 1.5, 0.4, 16).translate(1, 6.2, 0));
  K.build(g);
  const tur = new T.Group(); tur.position.set(1, 6.4, 0); g.add(tur); C.tur = tur;
  const KT = kit();
  KT.add('paint', wuv(roundBox(3.2, 2.6, 2.6, 0.12).translate(-0.6, 1.3, 0), 2), [0.82, 0.78, 0.66]);
  KT.add('paint', Bx(3.5, 0.18, 2.9, -0.6, 2.7, 0, 2), [0.2, 0.24, 0.24]);
  for (const s of [-1, 1]) KT.add('lit', new T.PlaneGeometry(1.2, 0.7).translate(0.2, 1.7, s * 1.31).rotateY(s > 0 ? 0 : Math.PI), [1.3, 0.9, 0.5]);
  KT.add('lit', new T.PlaneGeometry(1.4, 0.7).rotateY(Math.PI / 2).translate(1.01, 1.7, 0), [1.3, 0.9, 0.5]);
  KT.add('iron', Bx(1.6, 1.2, 2.0, -2.6, 0.6, 0, 1), [0.25, 0.25, 0.27]);   // Gegengewicht
  // Ausleger als Fachwerk: zwei Gurte, Streben, unter 38 Grad aufwärts nach +x
  const Lj = 12, ang = 0.66, tip = [Math.cos(ang) * Lj + 0.8, Math.sin(ang) * Lj + 0.6];
  for (const s of [-1, 1]) KT.add('paint', new T.BoxGeometry(Lj, 0.16, 0.16).translate(Lj / 2, 0, 0).rotateZ(ang).translate(0.8, 0.6, s * 0.45), [0.75, 0.55, 0.12]);
  for (let i = 1; i < 12; i++) { const u = i / 12 * Lj, x = 0.8 + Math.cos(ang) * u, y = 0.6 + Math.sin(ang) * u; KT.add('paint', Bx(0.08, 0.08, 0.95, x, y, 0, 1), [0.7, 0.5, 0.1]); KT.add('paint', new T.BoxGeometry(0.06, 1.0, 0.06).rotateX(i % 2 ? 0.75 : -0.75).translate(x, y, 0), [0.7, 0.5, 0.1]); }
  KT.add('iron', new T.CylinderGeometry(0.03, 0.03, 4.6, 4).rotateZ(-0.9).translate(-0.4, 3.6, 0));
  KT.build(tur);
  tur.add(makeGlowPoints([{ p: [tip[0], tip[1] + 0.2, 0], c: [1.5, 0.2, 0.1], s: 0.6, ph: 0, bl: 1 }, { p: [1.05, 1.7, 0], c: [1.2, 0.85, 0.45], s: 0.9, ph: 0, bl: 0 }]));
  C.tip = tip; C.reach = tip[0];   // Abstand Seil zur Drehachse (Drehachse liegt 1 m östlich der Kranmitte)
  const iron = stdMat({ color: 0x1e1e20, metalness: 0.7, roughness: 0.45 });
  C.rope = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1, 4).translate(0, -0.5, 0), iron); scene.add(C.rope);
  C.hook = new T.Mesh(new T.BoxGeometry(0.35, 0.45, 0.25), new T.MeshStandardMaterial({ color: 0xc9a258, metalness: 0.8, roughness: 0.4 })); scene.add(C.hook);
  const crateG = Bx(1.2, 1.0, 1.0, 0, -0.5, 0, 1); const KC = kit(); KC.add('plank', crateG, [0.58, 0.45, 0.3]); KC.add('rope', new T.BoxGeometry(0.04, 0.5, 1.02).translate(0, -0.25 + 0.25, 0), [0.6, 0.55, 0.4]);
  const cg = new T.Group(); KC.build(cg); scene.add(cg); C.crate = cg;
  for (let i = 0; i < C.drop.length; i++) { const c2 = cg.clone(); c2.visible = false; scene.add(c2); C.placed.push(c2); }
}
// Kranlauf: Haken in den Kahn, Kiste hoch, schwenken, an Land absetzen; ohne Kahn ruht der Kran
function updateCrane(dt, moored) {
  const C = CRANE; if (!C.g) return;
  const P = 44, piv = [C.x + 1, C.z];
  if (moored) C.t += dt; else { C.t = Math.max(0, Math.min(C.t, 0.01)); }
  const u = C.t % P, cyc = Math.floor(C.t / P);
  const angTo = ([x, z]) => Math.atan2(-(z - piv[1]), x - piv[0]);
  const aPick = angTo(C.pick), aDrop = C.drop[cyc % C.drop.length];
  const ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  let yaw, hookY, carry;
  const yTip = C.top + 0.2 + C.tip[1], low = FREIGHT.top - 0.9, high = FREIGHT.top + 7.5, land = FREIGHT.top + 1.0;
  if (!moored) { yaw = aDrop + 0.4; hookY = high; carry = false; }
  else if (u < 6) { yaw = aPick; hookY = high + (low - high) * ss(0, 6, u); carry = false; }
  else if (u < 9) { yaw = aPick; hookY = low; carry = u > 7.5; }
  else if (u < 15) { yaw = aPick; hookY = low + (high - low) * ss(9, 15, u); carry = true; }
  else if (u < 25) { yaw = aPick + (aDrop - aPick) * ss(15, 25, u); hookY = high; carry = true; }
  else if (u < 31) { yaw = aDrop; hookY = high + (land - high) * ss(25, 31, u); carry = true; }
  else if (u < 34) { yaw = aDrop; hookY = land; carry = u < 32; }
  else { yaw = aDrop + (aPick - aDrop) * ss(34, 44, u); hookY = land + (high - land) * ss(34, 38, u); carry = false; }
  // abgesetzte Kisten bleiben stehen, bis der Kahn wieder ablegt
  if (moored && u >= 32 && C.placed[cyc % C.drop.length] && !C.placed[cyc % C.drop.length].visible) { const pc = C.placed[cyc % C.drop.length]; pc.position.set(piv[0] + Math.cos(aDrop) * C.reach, land, piv[1] - Math.sin(aDrop) * C.reach); pc.rotation.y = aDrop; pc.visible = true; }
  if (!moored && C.t === 0) for (const pc of C.placed) pc.visible = false;
  C.tur.rotation.y = yaw;
  const hx = piv[0] + Math.cos(yaw) * C.reach, hz = piv[1] - Math.sin(yaw) * C.reach;
  C.rope.position.set(hx, yTip, hz); C.rope.scale.set(1, Math.max(0.1, yTip - hookY - 0.25), 1);
  C.hook.position.set(hx, hookY, hz);
  C.crate.visible = carry; C.crate.position.set(hx, hookY - 0.25, hz); C.crate.rotation.y = yaw;
}

/* ---------- Boote ---------- */
function vessel(make, rr, x, z, ry, kind) {
  const b = make(rr);
  b.g.position.set(x, WATER_Y, z); b.g.rotation.y = ry; scene.add(b.g);
  const pf = addPlatform(b.g, b.boxes, b.L / 2 + 2, { ylo: -2, yhi: 12 });
  const v = { ...b, pf, kind, ph: rr() * 6.28, w: 0.6 + rr() * 0.5, amp: 0.035 + rr() * 0.03, roll: b.L > 20 ? 0.004 : 0.012 };
  VESSELS.push(v);
  // Leute an Bord (wie spotPeds, aber mit eigenem Zufall)
  for (const s of b.spots || []) PORT_PEDS.push({ st: 8, pf, lx: s.lx, ly: s.ly, lz: s.lz, lyaw: s.lyaw, act: s.act ?? 0.6, sit: !!s.sit, kind: s.kind || 'worker', col: s.col || WORKWEAR[Math.floor(rr() * 4)], sc: s.kind === 'kid' ? 0.64 : 0.94 + rr() * 0.12, v: 0, tilt: 0 });
  return v;
}
// Schlepper: schwarzer Rumpf, weißes Steuerhaus mit Lichtern, Schornstein mit rotem Band und goldenem Ring, Fender aus Tauwerk
export function boatTug(rr) {
  const L = 15, B = 4.8, hs = hullShape(L, B, 1.35, 1.4, { transom: 0.75, rise: 0.75, fine: 0.4, sternRise: 0.15 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('hull', hs.hull, [0.07, 0.07, 0.08]); K.add('deck', hs.deck); rubRail(K, hs, 'rope', [0.42, 0.34, 0.24], 0.16, -0.25);
  const boxes = deckBoxes(hs, -L / 2 + 0.3, L / 2 - 0.8, 1.0), spots = [];
  const wx = 2.0, ys = hs.sheer(wx), cream = [0.9, 0.87, 0.78];
  K.add('paint', wuv(roundBox(4.2, 2.0, 3.2, 0.1).translate(wx - 0.6, ys + 1.0, 0), 2), cream);
  K.add('paint', wuv(roundBox(2.6, 1.6, 2.8, 0.1).translate(wx + 0.2, ys + 2.8, 0), 2), cream);
  K.add('paint', Bx(3.0, 0.14, 3.2, wx + 0.2, ys + 3.65, 0, 2), [0.1, 0.1, 0.1]);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.add('lit', new T.PlaneGeometry(0.6, 0.55).translate(wx - 0.6 + i * 0.75, ys + 2.95, s * 1.405).rotateY(0), [1.3, 0.9, 0.5]);
  K.add('lit', new T.PlaneGeometry(2.2, 0.6).rotateY(Math.PI / 2).translate(wx + 1.51, ys + 2.95, 0), [1.3, 0.9, 0.5]);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.add('lit', new T.CircleGeometry(0.16, 12).translate(wx - 1.8 + i * 1.1, ys + 1.2, s * 1.605).rotateY(s > 0 ? 0 : Math.PI), [1.2, 0.8, 0.42]);
  boxes.push(bx6(wx - 2.7, ys, -1.6, wx + 1.5, ys + 2.0, 1.6));
  // Schornstein
  const fx = -0.8;
  K.add('paint', new T.CylinderGeometry(0.62, 0.7, 3.4, 16).translate(fx, ys + 2.4, 0), [0.06, 0.06, 0.06]);
  K.add('paint', new T.CylinderGeometry(0.64, 0.64, 0.55, 16).translate(fx, ys + 3.4, 0), [0.62, 0.1, 0.08]);
  K.add('gold', new T.TorusGeometry(0.66, 0.05, 6, 20).rotateX(Math.PI / 2).translate(fx, ys + 3.75, 0));
  boxes.push(bx6(fx - 0.7, ys, -0.7, fx + 0.7, ys + 3.4, 0.7));
  // Schlepphaken, Poller, Rettungsringe, Mast mit Lichtern
  K.add('iron', new T.TorusGeometry(0.22, 0.05, 6, 12).translate(-L / 2 + 2.6, hs.sheer(-L / 2 + 2.6) + 0.9, 0));
  K.add('iron', new T.CylinderGeometry(0.06, 0.06, 0.9, 6).translate(-L / 2 + 2.6, hs.sheer(-L / 2 + 2.6) + 0.45, 0));
  for (const x of [L / 2 - 1.6, -L / 2 + 1.0]) K.add('iron', lathe([[0.16, 0], [0.12, 0.3], [0.18, 0.36], [0, 0.4]], 10).translate(x, hs.sheer(x), 0));
  for (const s of [-1, 1]) K.add('cloth', new T.TorusGeometry(0.32, 0.08, 6, 14).translate(wx - 0.6, ys + 1.2, s * 1.62), [0.9, 0.4, 0.2]);
  K.add('gold', new T.CylinderGeometry(0.05, 0.06, 4.2, 6).translate(wx + 0.6, ys + 5.7, 0));
  K.build(body);
  body.add(makeGlowPoints([{ p: [wx + 0.6, ys + 7.85, 0], c: [1.4, 1.3, 1.1], s: 0.7, ph: 0, bl: 0 }, { p: [wx + 0.6, ys + 7.1, 0], c: [1.4, 1.3, 1.1], s: 0.6, ph: 0, bl: 0 }, { p: [wx + 1.6, ys + 3.3, -1.5], c: [1.4, 0.1, 0.08], s: 0.5, ph: 0, bl: 0 }, { p: [wx + 1.6, ys + 3.3, 1.5], c: [0.1, 1.3, 0.3], s: 0.5, ph: 0, bl: 0 }]));
  spots.push({ lx: wx + 0.6, ly: ys + 2.0, lz: -0.5, lyaw: Math.PI / 2, act: 0.2, kind: 'sailor', col: [0.1, 0.12, 0.2] });
  spots.push({ lx: -L / 2 + 2.0, ly: hs.sheer(-L / 2 + 2), lz: 0.9, lyaw: -Math.PI / 2, act: 15.3, kind: 'worker', col: WORKWEAR[1] });
  return { g, body, boxes, spots, L, B, hs, funnel: [fx, ys + 4.1, 0] };
}
// Lastkahn: flacher Stahlrumpf mit offenem Laderaum voller Kisten und Kohle, Ruderhäuschen am Heck
export function boatBarge(rr) {
  const L = 30, B = 7, hs = hullShape(L, B, 1.6, 1.5, { transom: 0.95, rise: 0.25, fine: 0.16, sternRise: 0.05 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('hull', hs.hull, [0.22, 0.14, 0.1]); rubRail(K, hs, 'plank', [0.32, 0.24, 0.16], 0.14, -0.1);
  const ys = hs.sheer(0), boxes = [], spots = [];
  // Gangbord rundherum, Laderaum in der Mitte (tiefer)
  for (const s of [-1, 1]) { K.add('deck', Bx(L - 5, 0.1, 0.9, -0.5, ys - 0.05, s * (B / 2 - 0.5), 1)); boxes.push(bx6(-L / 2 + 2, ys - 0.8, s * (B / 2 - 0.05), L / 2 - 3, ys, s * (B / 2 - 0.95))); }
  K.add('deck', Bx(4, 0.1, B - 0.4, L / 2 - 2.6, ys + 0.1, 0, 1)); boxes.push(bx6(L / 2 - 4.6, ys - 0.7, -B / 2 + 0.3, L / 2 - 0.8, ys + 0.1, B / 2 - 0.3));
  K.add('deck', Bx(4, 0.1, B - 0.4, -L / 2 + 2.2, ys + 0.05, 0, 1)); boxes.push(bx6(-L / 2 + 0.4, ys - 0.7, -B / 2 + 0.3, -L / 2 + 4.2, ys + 0.05, B / 2 - 0.3));
  K.add('paint', Bx(L - 9, 0.5, 0.15, -0.5, ys + 0.25, B / 2 - 1.0, 1), [0.3, 0.2, 0.14]); K.add('paint', Bx(L - 9, 0.5, 0.15, -0.5, ys + 0.25, -B / 2 + 1.0, 1), [0.3, 0.2, 0.14]);
  K.add('iron', Bx(L - 9, 0.1, B - 2.2, -0.5, ys - 0.9, 0, 2), [0.12, 0.12, 0.13]);
  // Ladung: Kisten in Reihen, ein Kohlehaufen, Fässer
  for (let i = 0; i < 7; i++) for (let j = 0; j < 3; j++) if (rr() < 0.82) { const h = 1 + Math.floor(rr() * 2); for (let k = 0; k < h; k++) K.add('plank', Bx(1.2, 0.95, 1.4, -10 + i * 1.5, ys - 0.85 + 0.48 + k * 0.97, -1.6 + j * 1.6, 1), [[0.58, 0.45, 0.3], [0.45, 0.36, 0.25], [0.62, 0.52, 0.38]][Math.floor(rr() * 3)]); }
  K.add('iron', new T.SphereGeometry(2.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.5, 0.85).translate(5, ys - 0.85, 0), [0.06, 0.06, 0.065]);
  for (let i = 0; i < 6; i++) K.add('varnish', lathe([[0.28, 0], [0.32, 0.4], [0.28, 0.82], [0.01, 0.82]], 10).translate(9 + (i % 3) * 0.7, ys - 0.85, -1 + Math.floor(i / 3) * 0.75), [0.36, 0.24, 0.15]);
  // Ruderhaus am Heck, Ankerwinde am Bug
  const hx = -L / 2 + 2.4;
  K.add('paint', wuv(roundBox(2.2, 2.0, 2.6, 0.08).translate(hx, ys + 1.05, 0), 2), [0.2, 0.28, 0.24]);
  K.add('paint', Bx(2.6, 0.12, 3.0, hx, ys + 2.1, 0, 2), [0.1, 0.1, 0.1]);
  for (const s of [-1, 1]) K.add('lit', new T.PlaneGeometry(1.0, 0.6).translate(hx, ys + 1.5, s * 1.31).rotateY(0), [1.3, 0.9, 0.5]);
  K.add('iron', new T.CylinderGeometry(0.06, 0.06, 1.8, 6).translate(hx, ys + 3.0, 0));
  boxes.push(bx6(hx - 1.1, ys, -1.3, hx + 1.1, ys + 2.1, 1.3));
  K.add('iron', new T.CylinderGeometry(0.25, 0.25, 1.4, 10).rotateX(Math.PI / 2).translate(L / 2 - 2.2, ys + 0.45, 0));
  K.build(body);
  body.add(makeGlowPoints([{ p: [hx, ys + 3.95, 0], c: [1.4, 1.3, 1.1], s: 0.6, ph: 0, bl: 0 }, { p: [L / 2 - 1, ys + 0.6, 0], c: [1.4, 1.2, 0.8], s: 0.5, ph: 0, bl: 0 }]));
  spots.push({ lx: hx + 1.5, ly: ys + 0.05, lz: 1.2, lyaw: Math.PI / 2, act: 15.3, kind: 'braces', col: TROUSERS[1] });
  return { g, body, boxes, spots, L, B, hs };
}
// Wassertaxi: Barkasse aus Mahagoni mit gestreiftem Sonnendach auf Messingstangen, Bänken und Leuchtschild
export function boatTaxi(rr, idx = 0) {
  const L = 11, B = 3.2, hs = hullShape(L, B, 0.85, 0.7, { transom: 0.8, rise: 0.3, fine: 0.42 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('whull', hs.hull); K.add('varnish', hs.deck); rubRail(K, hs, 'gold', [1, 1, 1], 0.04);
  const boxes = deckBoxes(hs, -L / 2 + 0.3, L / 2 - 0.6, 1.0), spots = [], y0 = hs.sheer(0);
  const stripe = idx % 2 ? [0.08, 0.32, 0.34] : [0.62, 0.12, 0.16];
  // Bänke längs, Dach auf Stangen
  for (const s of [-1, 1]) { K.add('leather', roundBox(5.2, 0.16, 0.5, 0.05).translate(-1.2, y0 + 0.42, s * 1.05), [0.86, 0.79, 0.62]); K.add('varnish', Bx(5.2, 0.4, 0.08, -1.2, y0 + 0.62, s * 1.32, 1)); boxes.push(bx6(-3.8, y0, s * 0.8, 1.4, y0 + 0.5, s * 1.3)); }
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) K.add('gold', new T.CylinderGeometry(0.03, 0.03, 1.75, 6).translate(-3.6 + i * 1.6, y0 + 0.88 + 0.5, s * 1.3));
  for (let i = 0; i < 8; i++) K.add('cloth', new T.PlaneGeometry(6.4 / 8, 3.0).rotateX(-Math.PI / 2).translate(-4.0 + (i + 0.5) * 0.8, y0 + 2.28, 0), i % 2 ? [0.9, 0.86, 0.78] : stripe);
  for (const s of [-1, 1]) for (let i = 0; i < 16; i++) K.add('cloth', new T.PlaneGeometry(0.2, 0.16).translate(-4.0 + (i + 0.5) * 0.4, y0 + 2.18, s * 1.5), i % 2 ? [0.9, 0.86, 0.78] : stripe);
  // Steuerstand vorn
  K.add('varnish', Bx(0.6, 0.9, 1.4, 2.4, y0 + 0.45, -0.5, 1)); K.add('chrome', new T.TorusGeometry(0.2, 0.02, 6, 18).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(2.15, y0 + 1.05, -0.5));
  K.add('glass', new T.PlaneGeometry(2.4, 0.45).rotateY(Math.PI / 2).translate(3.0, y0 + 1.05, 0));
  K.build(body);
  const sg = nameplate('WASSERTAXI', 2.8, 0.45, '#f6d48e', '#14110e'); sg.position.set(-0.8, y0 + 2.62, 0); sg.rotation.y = Math.PI / 2; body.add(sg);
  const sg2 = sg.clone(); sg2.rotation.y = -Math.PI / 2; body.add(sg2);
  body.add(makeGlowPoints([{ p: [-0.8, y0 + 2.95, 0], c: [1.4, 1.1, 0.6], s: 0.9, ph: 0, bl: 0 }, { p: [L / 2 - 0.5, hs.sheer(L / 2) + 0.15, -0.2], c: [1.4, 0.1, 0.08], s: 0.4, ph: 0, bl: 0 }, { p: [L / 2 - 0.5, hs.sheer(L / 2) + 0.15, 0.2], c: [0.1, 1.3, 0.3], s: 0.4, ph: 0, bl: 0 }]));
  spots.push({ lx: 1.9, ly: y0 + 0.02, lz: -0.5, lyaw: Math.PI / 2, act: 0.2, kind: 'sailor', col: [0.93, 0.93, 0.9] });
  const fares = [['lady', COATS[5]], ['suit', COATS[3]], ['furcoat', FURCOATS[1]], ['dbl', COATS[0]], ['flapper', FLAPPERS[2]], ['coat', COATS[2]]];
  for (let i = 0; i < 6; i++) if (rr() < 0.55) { const s = i % 2 ? 1 : -1, x = -3.4 + Math.floor(i / 2) * 1.6; const [kind, col] = fares[(i + idx * 3) % fares.length]; spots.push({ lx: x, ly: y0 + 0.5, lz: s * 1.0, lyaw: s > 0 ? Math.PI : 0, sit: true, act: 7 + (rr() < 0.5 ? 0.8 : 0.2), kind, col }); }
  return { g, body, boxes, spots, L, B, hs };
}
// Fischerboot: kleiner Kutter mit Ruderhaus, Ladebaum, Netz, Laterne am Mast; zwei Fischer, einer angelt
export function boatFisher(rr) {
  const L = 8, B = 2.8, hs = hullShape(L, B, 0.95, 0.9, { double: true, rise: 0.45, blunt: 0.1 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  const hc = [[0.18, 0.32, 0.36], [0.55, 0.18, 0.12], [0.85, 0.82, 0.74]][Math.floor(rr() * 3)];
  K.add('hull', hs.hull, hc); K.add('plank', hs.deck, [0.5, 0.42, 0.32]); rubRail(K, hs, 'plank', [0.3, 0.24, 0.18], 0.06);
  const y0 = hs.sheer(0), boxes = deckBoxes(hs, -L / 2 + 0.5, L / 2 - 0.5, 1.0), spots = [];
  K.add('paint', wuv(roundBox(1.6, 1.6, 1.6, 0.06).translate(1.4, y0 + 0.8, 0), 2), [0.86, 0.83, 0.74]);
  K.add('paint', Bx(1.9, 0.1, 1.9, 1.4, y0 + 1.65, 0, 2), [0.2, 0.15, 0.1]);
  K.add('lit', new T.PlaneGeometry(0.9, 0.5).translate(1.4, y0 + 1.1, 0.81), [1.2, 0.8, 0.42]); K.add('lit', new T.PlaneGeometry(0.9, 0.5).rotateY(Math.PI).translate(1.4, y0 + 1.1, -0.81), [1.2, 0.8, 0.42]);
  boxes.push(bx6(0.6, y0, -0.8, 2.2, y0 + 1.6, 0.8));
  K.add('varnish', new T.CylinderGeometry(0.06, 0.08, 4.5, 6).translate(0.2, y0 + 2.25, 0));
  K.add('varnish', new T.CylinderGeometry(0.04, 0.04, 3.2, 6).rotateZ(1.0).translate(-1.1, y0 + 2.4, 0));
  K.add('cloth', new T.PlaneGeometry(1.6, 1.2, 4, 3).rotateX(-1.2).translate(-2.4, y0 + 0.5, 0.2), [0.2, 0.24, 0.2]);
  for (let i = 0; i < 3; i++) K.add('cloth', new T.SphereGeometry(0.12, 6, 4).translate(-2.8 + i * 0.35, y0 + 0.2, -0.9), [0.85, 0.5, 0.15]);
  // Angel über die Bordwand, Schnur ins Wasser
  const s = rr() < 0.5 ? 1 : -1;
  K.add('varnish', new T.CylinderGeometry(0.012, 0.025, 3.2, 5).rotateX(s * 1.0).translate(-1.4, y0 + 1.6, s * 2.0));
  K.add('iron', new T.CylinderGeometry(0.004, 0.004, 3.4, 3).translate(-1.4, y0 + 1.1, s * 3.27));
  K.build(body);
  body.add(makeGlowPoints([{ p: [0.2, y0 + 4.2, 0], c: [1.5, 1.05, 0.55], s: 1.1, ph: 0, bl: 0 }, { p: [-1.4, y0 + 0.9, -s * 0.6], c: [1.4, 0.95, 0.5], s: 0.7, ph: 0, bl: 0 }]));
  spots.push({ lx: -1.4, ly: y0 + 0.42, lz: s * 0.85, lyaw: s > 0 ? 0 : Math.PI, sit: true, act: 7.2, kind: 'jacket', col: TWEEDS[Math.floor(rr() * TWEEDS.length)] });
  spots.push({ lx: -0.2, ly: y0 + 0.02, lz: -s * 0.4, lyaw: rr() * 6, act: rr() < 0.5 ? 15.3 : 8.3, kind: 'worker', col: WORKWEAR[Math.floor(rr() * 4)] });
  return { g, body, boxes, spots, L, B, hs };
}
// Ruderboot: Mahagoni, zwei Duchten, Riemen eingezogen, Laterne am Heck; ein Paar sitzt sich gegenüber
export function boatRow(rr) {
  const L = 4.6, B = 1.45, hs = hullShape(L, B, 0.55, 0.35, { transom: 0.6, rise: 0.25, fine: 0.5 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('whull', hs.hull); rubRail(K, hs, 'varnish', [1, 1, 1], 0.03);
  const y0 = hs.sheer(0), spots = [];
  K.add('varnish', Bx(L - 0.8, 0.03, B - 0.3, -0.1, y0 - 0.32, 0, 1));
  for (const x of [-1.0, 0.5]) K.add('varnish', Bx(0.25, 0.04, B - 0.15, x, y0 - 0.12, 0, 1));
  for (const s of [-1, 1]) K.add('varnish', new T.CylinderGeometry(0.025, 0.025, 2.6, 5).rotateZ(Math.PI / 2).translate(-0.1, y0 + 0.02, s * 0.55));
  K.add('gold', new T.CylinderGeometry(0.02, 0.02, 0.9, 5).translate(-L / 2 + 0.25, y0 + 0.45, 0));
  K.build(body);
  body.add(makeGlowPoints([{ p: [-L / 2 + 0.25, y0 + 0.95, 0], c: [1.6, 1.1, 0.55], s: 0.9, ph: 0, bl: 0 }]));
  const pairs = [[['suit', COATS[3]], ['lady', COATS[5]]], [['coat', COATS[2]], ['furcoat', FURCOATS[0]]], [['dbl', COATS[0]], ['flapper', FLAPPERS[6]]]];
  const [m, f] = pairs[Math.floor(rr() * pairs.length)];
  spots.push({ lx: -1.0, ly: y0 - 0.1, lz: 0, lyaw: Math.PI / 2, sit: true, act: 7.8, kind: f[0], col: f[1] });
  spots.push({ lx: 0.5, ly: y0 - 0.1, lz: 0, lyaw: -Math.PI / 2, sit: true, act: 7.2, kind: m[0], col: m[1] });
  return { g, body, boxes: [], spots, L, B, hs };
}

/* ---------- Wege der Boote: geschlossene Kurven, Stopps, Ausweichen vor der Fähre ---------- */
function makeRoute(pts) {
  const c = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), true, 'centripetal');
  const N = 1600, P = c.getSpacedPoints(N), cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + P[i].distanceTo(P[i - 1]));
  const len = cum[N];
  return { c, len, at(s) { const u = (((s % len) + len) % len) / len; return [c.getPointAt(u), c.getTangentAt(u)]; },
    sOf(x, z) { let best = 0, bd = 1e9; for (let i = 0; i < N; i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return cum[best]; } };
}
// liegt ein Weg überall im freien Wasser? (für die Prüfung im Labor)
export function routeWet(R0, step = 6) { const bad = []; for (let s = 0; s < R0.len; s += step) { const [p] = R0.at(s); if (onIsland(p.x, p.z, -6) || terrainHeight(p.x, p.z) > WATER_Y - 0.8) bad.push([Math.round(p.x), Math.round(p.z)]); } return bad; }

// Anleger der Wassertaxis: sechs Stufen vom Kai hinunter, Ponton auf Pfählen, Laternen, Schild
export function buildTaxiLanding() {
  const K = kit(), x = TAXI_LANDING.x, z1 = QUAY.z1, hw = TAXI_LANDING.w / 2;
  for (let k = 0; k < 6; k++) { const top = 0.25 - 0.2 * (k + 1); addCollider(x - 1.6, -3, z1 + k, x + 1.6, top, z1 + k + 1); K.add('plank', Bx(3.2, 0.12, 1.0, x, top - 0.06, z1 + k + 0.5, 2)); }
  for (const s of [-1, 1]) { addCollider(x + s * 1.6 - 0.05, -2, z1, x + s * 1.6 + 0.05, 1.2, z1 + 6); K.add('gold', new T.CylinderGeometry(0.03, 0.03, 6.3, 6).rotateX(Math.PI / 2 - Math.atan2(1.2, 6)).translate(x + s * 1.6, 0.3, z1 + 3)); }
  addCollider(x - hw, -1.4, z1 + 6, x + hw, PIER_Y, z1 + 14);
  K.add('plank', Bx(2 * hw, 0.3, 8, x, PIER_Y - 0.15, z1 + 10, 2));
  for (let i = 0; i <= 6; i++) for (const zz of [z1 + 6.2, z1 + 13.8]) K.add('varnish', wuv(new T.CylinderGeometry(0.14, 0.16, 4.2, 8).translate(x - hw + i * hw / 3, PIER_Y - 1.4, zz), 1), [0.35, 0.28, 0.22]);
  for (const s of [-1, 1]) lamps.push({ x: x + s * (hw - 1), z: z1 + 12.5, h: 3.4, y: PIER_Y });
  for (const s of [-1, 1]) K.add('iron', lathe([[0.1, 0], [0.08, 0.15], [0.12, 0.2], [0, 0.22]], 8).translate(x + s * 8, PIER_Y, z1 + 13.6));
  K.build(scene);
  const sg = nameplate('WASSERTAXI', 3.0, 0.55, '#f6d48e', '#14110e'); sg.position.set(x, 3.2, z1 - 0.3); scene.add(sg);
  const sb = sg.clone(); sb.rotation.y = Math.PI; sb.position.z = z1 - 0.32; scene.add(sb);
  for (const s of [-1, 1]) { const kk = kit(); kk.add('iron', new T.CylinderGeometry(0.06, 0.08, 3.0, 6).translate(x + s * 1.7, 1.75, z1 - 0.3)); kk.build(scene); }
  addGlow(x, 3.7, z1 - 0.3, [1.25, 0.9, 0.5], 1.6);
}

export function buildBoats() {
  const rr = mulberry32(7171), F = FREIGHT;
  // Schlepper mit Lastkahn: Liegeplatz an der Westseite der Mole (Bug nach Norden), dann eine Runde über die Bucht
  const tugR = makeRoute([[-611, 620], [-611, 590], [-611, 560], [-622, 546], [-646, 545], [-668, 562], [-680, 615], [-692, 700], [-650, 785], [-540, 818], [-445, 770], [-462, 695], [-540, 660], [-596, 652]]);
  const tug = vessel(boatTug, rr, -611, 560, Math.PI / 2, 'route'), barge = vessel(boatBarge, rr, -611, 590, Math.PI / 2, 'route');
  WATER.tug = { v: tug, b: barge, R: tugR, s0: tugR.sOf(-611, 558), s: 0, v0: 0, wait: 70 + rr() * 40, gap: tug.L / 2 + 6 + barge.L / 2, smoke: 0 };
  WATER.tug.s = WATER.tug.s0;
  WATER.line = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1, 4).rotateX(Math.PI / 2).translate(0, 0, 0.5), stdMat({ color: 0x5a4a36, roughness: 1 })); scene.add(WATER.line);
  // Wassertaxis: Anleger vor dem Kai bei x = 300 und Westseite des Fähranlegers
  const taxiR = makeRoute([[330, 551], [300, 551], [262, 552], [200, 562], [80, 610], [-30, 640], [-86, 622], [-114, 600], [-114, 575], [-118, 553], [-138, 545], [-160, 560], [-166, 605], [-130, 655], [0, 690], [200, 668], [330, 612], [348, 572]]);
  const stops = [taxiR.sOf(296, 551), taxiR.sOf(-114, 572)];
  for (let i = 0; i < (MOBILE ? 1 : 2); i++) {
    const s = stops[i], [p, tg] = taxiR.at(s), v = vessel(r => boatTaxi(r, i), rr, p.x, p.z, Math.atan2(-tg.z, tg.x), 'route');
    WATER.taxis.push({ v, R: taxiR, stops, next: (i + 1) % 2, s, sp: 0, wait: 12 + i * 20 });
  }
  // Fischerboote vor Anker draußen in der Bucht, Ruderboote treiben vor der Promenade
  for (const [x, z] of [[160, 880], [690, 845], [-250, 805], [880, 720]].slice(0, MOBILE ? 2 : 4)) vessel(boatFisher, rr, x, z, rr() * 6.28, 'moored');
  for (const [x, z] of [[790, 610], [-800, 640], [330, 900]].slice(0, MOBILE ? 1 : 3)) { const v = vessel(boatRow, rr, x, z, rr() * 6.28, 'route'); WATER.drifters.push({ v, c: [x, z], r: 10 + rr() * 10, w: (rr() < 0.5 ? 1 : -1) * (0.012 + rr() * 0.01), a: rr() * 6.28 }); }
  WATER.routes = { tug: tugR, taxi: taxiR };
}

/* ---------- Menschen: Eisläufer, Zuschauer, Hafenarbeiter, Angler ---------- */
const KINDS = ['coat', 'lady', 'furcoat', 'suit', 'kid', 'dress', 'flapper', 'dbl', 'jacket', 'braces', 'worker'];
export function buildWaterPeople() {
  const rr = mulberry32(9393), cx = CANAL.x, ice = CANAL.ice, list = [];
  const P = (kind, col, o) => { list.push({ kind, col, ...o }); return list[list.length - 1]; };
  const lady = () => [['lady', COATS[Math.floor(rr() * COATS.length)]], ['furcoat', FURCOATS[Math.floor(rr() * FURCOATS.length)]], ['dress', DRESSES[Math.floor(rr() * DRESSES.length)]], ['flapper', FLAPPERS[Math.floor(rr() * FLAPPERS.length)]]][Math.floor(rr() * 4)];
  const man = () => [['coat', COATS[Math.floor(rr() * COATS.length)]], ['suit', COATS[Math.floor(rr() * COATS.length)]], ['dbl', COATS[Math.floor(rr() * COATS.length)]], ['jacket', TWEEDS[Math.floor(rr() * TWEEDS.length)]]][Math.floor(rr() * 4)];
  if (CANAL.on) {
    // Bahnen: innen schnell, außen gemächlich; alle auf einer Bahn gleich schnell (niemand läuft durch den anderen)
    const lanes = [[2.6, 3.4], [3.4, 2.9], [4.2, 2.35], [5.0, 1.8]], per = MOBILE ? 4 : 9;
    for (const [r, v] of lanes) {
      const zL = CANAL.zB - CANAL.zA - 12, loop = 2 * zL + 2 * Math.PI * r;
      for (let i = 0; i < per; i++) {
        const s = (i + 0.2 + rr() * 0.6) / per * loop, kid = v < 2 && rr() < 0.45, pair = !kid && rr() < 0.3;
        const [k1, c1] = kid ? ['kid', SHIRTS[Math.floor(rr() * SHIRTS.length)]] : rr() < 0.5 ? lady() : man();
        const sk = P(k1, c1, { mode: 'skate', r, v, s, loop, zL, off: pair ? -0.42 : 0, sc: kid ? 0.62 + rr() * 0.06 : 0.94 + rr() * 0.1, sway: 0.18 + rr() * 0.14 });
        if (pair) { const [k2, c2] = k1 === 'lady' || k1 === 'furcoat' || k1 === 'dress' || k1 === 'flapper' ? man() : lady(); P(k2, c2, { mode: 'skate', r, v, s, loop, zL, off: 0.42, sc: 0.94 + rr() * 0.1, sway: sk.sway }); }
      }
    }
    // Kunstläuferin in der Mitte des zweiten offenen Stücks, Grüppchen auf dem Eis, Zuschauer am Geländer, Leute auf den Bänken und an den Buden
    const o2 = CANAL.open[Math.min(1, CANAL.open.length - 1)];
    P('dress', [0.08, 0.32, 0.34], { mode: 'figure', x: cx, z: (o2.z0 + o2.z1) / 2 - 12, sc: 0.95 });
    for (const sp of WATER.spots) {
      if (sp.kind === 'stair') { const n = 2 + Math.floor(rr() * 2), gx = cx + sp.s * 7.6, gz = sp.z + 2; for (let i = 0; i < n; i++) { const a = i / n * 6.28 + rr(), x = gx + Math.cos(a) * 0.65, z = gz + Math.sin(a) * 0.65, [k, c] = i % 2 ? man() : lady(); P(k, c, { mode: 'stand', x, y: ice, z, yaw: Math.atan2(gx - x, gz - z), act: [0.6, 1.5, 0.8, 2.7][i % 4] }); } }
      if (sp.kind === 'bench' && rr() < 0.55) { const n = rr() < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) { const [k, c] = i ? lady() : man(); P(k, c, { mode: 'stand', x: sp.x, y: 0.66, z: sp.z + (n > 1 ? (i ? 0.45 : -0.45) : (rr() - 0.5) * 0.8), yaw: sp.yaw, act: 7 + (rr() < 0.5 ? 0.8 : 0.2), sit: true }); } }
      if (sp.kind === 'booth') { const fx = sp.x - sp.s * 1.6; P('worker', WORKWEAR[Math.floor(rr() * 4)], { mode: 'stand', x: sp.x + sp.s * 0.2, y: 0.22, z: sp.z + 0.4, yaw: sp.s > 0 ? -Math.PI / 2 : Math.PI / 2, act: sp.k % 3 === 1 ? 8.3 : 28.3 });
        for (let i = 0; i < 2 + Math.floor(rr() * 2); i++) { const [k, c] = i % 2 ? lady() : man(); P(k, c, { mode: 'stand', x: fx - sp.s * (rr() * 1.2), y: 0.22, z: sp.z - 1 + i * 0.9, yaw: sp.s > 0 ? Math.PI / 2 : -Math.PI / 2, act: sp.k % 3 === 0 ? 0.6 : [17.3, 19.3, 1.5][i % 3] }); } }
      if (sp.kind === 'bridge') for (let i = 0; i < 3; i++) { const s = i % 2 ? 1 : -1, x = cx + (rr() - 0.5) * 9, [k, c] = rr() < 0.5 ? man() : lady(); P(k, c, { mode: 'stand', x, y: 0.22 + 0.9 * Math.cos(Math.PI / 2 * Math.min(1, Math.abs(x - cx) / 10.6)), z: sp.z + s * 1.15, yaw: s > 0 ? 0 : Math.PI, act: [0.6, 15.3, 1.5][i] }); }
    }
    for (const o of CANAL.open) for (let i = 0; i < (MOBILE ? 2 : 4); i++) { const s = rr() < 0.5 ? -1 : 1, z = o.z0 + 3 + rr() * (o.z1 - o.z0 - 6), [k, c] = rr() < 0.5 ? man() : lady(); P(k, c, { mode: 'stand', x: cx + s * (CANAL.hw + 0.75), y: 0.22, z, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, act: [0.6, 1.5, 0.8, 15.3][i % 4] }); }
  }
  // Güterkai: Vorarbeiter mit Block, Stapler, Raucher, Angler am Kopf der Mole, zwei Träger
  const F = FREIGHT, top = F.top;
  P('jacket', TWEEDS[0], { mode: 'stand', x: -596.3, y: top, z: 598.8, yaw: -2.2, act: 28.3 });
  P('worker', WORKWEAR[0], { mode: 'stand', x: -594.6, y: top, z: 600.6, yaw: Math.PI, act: 27.3 });
  P('braces', TROUSERS[2], { mode: 'stand', x: -596.8, y: top, z: 614.4, yaw: 0.3, act: 27.7 });
  P('worker', WORKWEAR[2], { mode: 'stand', x: -593.9, y: top, z: 556, yaw: -1.6, act: 15.3 });
  for (const [x, z, yaw] of [[-604.6, 623.6, Math.PI], [-600.2, 623.8, Math.PI], [-595.8, 623.6, Math.PI]]) P('jacket', TWEEDS[Math.floor(rr() * TWEEDS.length)], { mode: 'stand', x, y: top + 0.45, z, yaw: yaw + (rr() - 0.5) * 0.3, act: 7.2, sit: true, rod: true });
  for (let i = 0; i < 2; i++) P(i ? 'braces' : 'worker', i ? TROUSERS[0] : WORKWEAR[1], { mode: 'carry', pa: [-606.2, 589 + i * 3], pb: [-597.2, 606 - i * 2.2], ph: i * 0.5 });
  // Angler am Kai mit Ruten über dem Geländer
  for (const x of [-520, -470, 60, 410, 470].slice(0, MOBILE ? 2 : 5)) P(rr() < 0.5 ? 'jacket' : 'coat', rr() < 0.5 ? TWEEDS[Math.floor(rr() * 6)] : COATS[2], { mode: 'stand', x, y: 0.25, z: QUAY.z1 - 1.1, yaw: 0.05, act: 0.4, rodQuay: true });
  // Ruten (eine Form für alle)
  { const K = kit(); for (const p of list) {
      if (p.rod) { K.add('varnish', new T.CylinderGeometry(0.012, 0.025, 3.4, 5).rotateX(1.0).translate(p.x, top + 1.5, p.z + 1.6)); const yt = top + 1.5 + 1.7 * Math.cos(1.0); K.add('iron', new T.CylinderGeometry(0.004, 0.004, yt - WATER_Y, 3).translate(p.x, (yt + WATER_Y) / 2, p.z + 1.6 + 1.7 * Math.sin(1.0))); K.add('varnish', lathe([[0.22, 0], [0.24, 0.42], [0.01, 0.44]], 10).translate(p.x, top, p.z - 0.05), [0.36, 0.26, 0.17]); }
      if (p.rodQuay) { K.add('varnish', new T.CylinderGeometry(0.012, 0.025, 3.4, 5).rotateX(0.9).translate(p.x + 0.5, 1.6, p.z + 1.4)); const yt = 1.6 + 1.7 * Math.cos(0.9); K.add('iron', new T.CylinderGeometry(0.004, 0.004, yt - WATER_Y, 3).translate(p.x + 0.5, (yt + WATER_Y) / 2, p.z + 1.4 + 1.7 * Math.sin(0.9))); }
    } K.build(scene); }
  const C = WATER.crowd = new Crowd(KINDS, list.length + 2);
  C.far = 260;
  for (const p of list) { p.a = C.add(p.kind, p.col); if (p.mode === 'stand') { p.a.gait[1] = p.act; p.a.gait[2] = 0; } }
  C.finish();
  for (const p of list) if (p.mode === 'stand') C.set(p.a, p.x, p.y - (p.sit ? 0.87 * (p.sc || 1) * (p.kind === 'lady' || p.kind === 'furcoat' || p.kind === 'dress' || p.kind === 'flapper' ? 0.92 : 1) : 0), p.z, p.yaw, p.sc || 1);
  WATER.people = list;
  WATER.stats.people = { skaters: list.filter(p => p.mode === 'skate' || p.mode === 'figure').length, all: list.length };
}
// Eisläufer auf der Bahn: im Osten nach Süden, im Westen nach Norden, Kehren an den Enden (unter den Gewölben)
function skatePos(p, s) {
  const zA = CANAL.zA + 6, zL = p.zL, r = p.r, cx = CANAL.x;
  s = ((s % p.loop) + p.loop) % p.loop;
  if (s < zL) return [cx + r, zA + s, 0, 1];
  s -= zL; if (s < Math.PI * r) { const a = s / r; return [cx + r * Math.cos(a), zA + zL + r * Math.sin(a), -Math.sin(a), Math.cos(a)]; }
  s -= Math.PI * r; if (s < zL) return [cx - r, zA + zL - s, 0, -1];
  s -= zL; const a = s / r; return [cx - r * Math.cos(a), zA - r * Math.sin(a), Math.sin(a), -Math.cos(a)];
}
function updatePeople(dt, t) {
  const C = WATER.crowd; if (!C) return;
  const cp = camera.position, dC = CANAL.on ? Math.hypot(cp.x - CANAL.x, Math.max(0, Math.abs(cp.z - (CANAL.zA + CANAL.zB) / 2) - 140)) : 1e9, dF = Math.hypot(cp.x - FREIGHT.x, cp.z - 590);
  const near = Math.min(dC, dF) < 380 + Math.max(0, cp.y) * 0.5;
  if (!near) { if (WATER.near) { C.show(false); WATER.near = false; } return; }
  if (!WATER.near) { C.show(true); WATER.near = true; }
  for (const p of WATER.people) {
    if (p.mode === 'skate') {
      if (dC > 420) continue;
      p.s += p.v * dt;
      const [x, z, dx, dz] = skatePos(p, p.s), a = p.a, fq = 1.15 * p.v + 0.6;
      if (a.gait[1] !== fq || a.gait[2] !== 0.42) { a.gait[1] = fq; a.gait[2] = 0.42; a.gv = (a.gv | 0) + 1; }
      const ph = t * fq + a.gait[0], sw = Math.sin(ph) * p.sway, nx = dz, nz = -dx;
      C.set(a, x + nx * (sw + p.off), CANAL.ice + 0.06, z + nz * (sw + p.off), Math.atan2(dx, dz) + Math.cos(ph) * 0.22, p.sc, 0.16);
    } else if (p.mode === 'figure') {
      if (dC > 420) continue;
      const a = p.a, cyc = t % 24, spin = cyc > 19;
      if (spin) { if (a.gait[2] !== 0) { a.gait[1] = 3.6; a.gait[2] = 0; a.gv = (a.gv | 0) + 1; } C.set(a, p.x + 2.2 * Math.cos(19 * 0.9), CANAL.ice + 0.06, p.z + 2.2 * Math.sin(19 * 0.9), t * 9, p.sc); }
      else { if (a.gait[2] !== 0.38) { a.gait[1] = 2.4; a.gait[2] = 0.38; a.gv = (a.gv | 0) + 1; } const ang = cyc * 0.9; C.set(a, p.x + 2.2 * Math.cos(ang), CANAL.ice + 0.06, p.z + 2.2 * Math.sin(ang), Math.atan2(-Math.sin(ang), Math.cos(ang)) + 0.25, p.sc, 0.12); }
    } else if (p.mode === 'carry') {
      if (dF > 300) continue;
      // hin mit Kiste (Tragehaltung), zurück leer; an den Enden kurz bücken (Kisten stapeln)
      const a = p.a, Pp = 26, u = (t / Pp + p.ph) % 1, L = Math.hypot(p.pb[0] - p.pa[0], p.pb[1] - p.pa[1]);
      let k, act = null, amp = 0.38;
      if (u < 0.1) { k = 0; act = 27.3; } else if (u < 0.45) { k = (u - 0.1) / 0.35; amp = 0.53; } else if (u < 0.55) { k = 1; act = 27.6; } else { k = 1 - (u - 0.55) / 0.45; }
      const x = p.pa[0] + (p.pb[0] - p.pa[0]) * k, z = p.pa[1] + (p.pb[1] - p.pa[1]) * k, dir = u < 0.5 ? 1 : -1;
      if (act != null) { if (a.gait[1] !== act || a.gait[2] !== 0) { a.gait[1] = act; a.gait[2] = 0; a.gv = (a.gv | 0) + 1; } }
      else { const fq = (amp > 0.5 ? 1.0 : 1.3) * 4.6 * (L / (Pp * 0.35)) / 1; if (a.gait[1] !== fq || a.gait[2] !== amp) { a.gait[1] = fq; a.gait[2] = amp; a.gv = (a.gv | 0) + 1; } }
      C.set(a, x, FREIGHT.top, z, Math.atan2((p.pb[0] - p.pa[0]) * dir, (p.pb[1] - p.pa[1]) * dir), 1);
    }
  }
  C.flag();
}

/* ---------- Bewegung (aus updatePort, zwischen den Plattform-Schritten: wer an Bord steht, fährt mit) ---------- */
const ss01 = k => k * k * (3 - 2 * k);
function place(v, x, z, ang, t, roll = 0) {
  v.g.position.set(x, WATER_Y + waterH(x, z) * (v.L > 20 ? 0.25 : 0.6), z); v.g.rotation.y = ang;
  v.body.rotation.x = Math.sin(t * 0.7 + v.ph) * v.roll * 0.8 + roll; v.body.rotation.z = Math.sin(t * 0.55 + v.ph) * v.roll * 0.5;
}
export function updateWaterLife(dt, t) {
  WATER.wakes.length = 0;
  const T0 = WATER.tug;
  if (T0) {
    const R0 = T0.R;
    let rel = ((T0.s - T0.s0) % R0.len + R0.len) % R0.len;
    if (T0.wait > 0) { T0.wait -= dt; T0.v0 = 0; if (T0.wait <= 0) rel = 0.01; }
    else {
      const rem = R0.len - rel, vt = Math.min(4.2, Math.sqrt(2 * 0.12 * Math.max(0, rem)) + 0.2);
      T0.v0 += Math.max(-0.25 * dt, Math.min(0.12 * dt, vt - T0.v0));
      rel += T0.v0 * dt;
      if (rel >= R0.len - 0.05) { rel = 0; T0.wait = 80 + Math.random() * 40; T0.v0 = 0; }
    }
    T0.s = T0.s0 + rel;
    const [p, tg] = R0.at(T0.s), [pb, tb] = R0.at(T0.s - T0.gap), a = Math.atan2(-tg.z, tg.x), ab = Math.atan2(-tb.z, tb.x);
    place(T0.v, p.x, p.z, a, t, -T0.v0 * 0.006); place(T0.b, pb.x, pb.z, ab, t);
    // Schleppleine vom Haken zum Bug des Kahns
    const hx = p.x - tg.x * (T0.v.L / 2 - 2.6), hz = p.z - tg.z * (T0.v.L / 2 - 2.6), bx = pb.x + tb.x * (T0.b.L / 2 - 0.3), bz = pb.z + tb.z * (T0.b.L / 2 - 0.3);
    const yH = WATER_Y + 2.2, yB = WATER_Y + 1.7, L = Math.hypot(bx - hx, bz - hz, yB - yH);
    WATER.line.position.set(hx, yH, hz); WATER.line.lookAt(bx, yB - Math.min(0.6, L * 0.02), bz); WATER.line.scale.set(1, 1, L); WATER.line.visible = T0.v.g.visible;
    if (T0.v0 > 0.3) { WATER.wakes.push([p.x, p.z, Math.atan2(tg.z, tg.x), T0.v0, T0.v.L]); WATER.wakes.push([pb.x, pb.z, Math.atan2(tb.z, tb.x), T0.v0, T0.b.L]); }
    // Rauch aus dem Schornstein, wenn man nahe ist
    T0.smoke -= dt;
    if (T0.smoke <= 0 && T0.v.g.visible && Math.hypot(camera.position.x - p.x, camera.position.z - p.z) < 450) {
      T0.smoke = T0.v0 > 0.5 ? 0.18 : 0.6;
      const f = T0.v.funnel, c = Math.cos(a), s = Math.sin(a), wx = p.x + f[0] * c, wz = p.z - f[0] * s;
      fxEmit('smoke', wx, WATER_Y + f[1], wz, -tg.x * T0.v0 * 0.5, 1.6, -tg.z * T0.v0 * 0.5, 1, 0.3, 0.9);
    }
    updateCrane(dt, T0.wait > 0 && rel < 1);
  }
  // Wassertaxis: von Anleger zu Anleger, warten, vor der Fähre anhalten
  for (const X of WATER.taxis) {
    const R0 = X.R, tgtS = X.stops[X.next];
    let rem = ((tgtS - X.s) % R0.len + R0.len) % R0.len;
    if (X.wait > 0) { X.wait -= dt; X.sp = 0; }
    else {
      let vt = Math.min(5.5 * (shared.wxBoat || 1), Math.sqrt(2 * 0.35 * rem) + 0.15);   // V63: Eisgang, Sturm: vorsichtig
      const [ah] = R0.at(X.s + 22);
      if (FERRY.g && FERRY.v > 0.2 && Math.hypot(FERRY.g.position.x - ah.x, FERRY.g.position.z - ah.z) < 34) vt = 0;   // Vorfahrt für die Fähre
      X.sp += Math.max(-0.8 * dt, Math.min(0.5 * dt, vt - X.sp));
      X.s += X.sp * dt; rem -= X.sp * dt;
      if (rem < 0.1 || rem > R0.len - 1) { X.s = tgtS; X.wait = 30 + Math.random() * 15; X.next = (X.next + 1) % X.stops.length; X.sp = 0; }
    }
    const [p, tg] = R0.at(X.s);
    place(X.v, p.x, p.z, Math.atan2(-tg.z, tg.x), t, -X.sp * 0.008);
    if (X.sp > 0.3) WATER.wakes.push([p.x, p.z, Math.atan2(tg.z, tg.x), X.sp, X.v.L]);
  }
  // Ruderboote treiben langsam im Kreis
  for (const D of WATER.drifters) {
    D.a += D.w * dt; const x = D.c[0] + Math.cos(D.a) * D.r, z = D.c[1] + Math.sin(D.a) * D.r;
    place(D.v, x, z, Math.atan2(-Math.cos(D.a) * Math.sign(D.w), -Math.sin(D.a) * Math.sign(D.w)), t);
    D.v.body.rotation.z = Math.sin(t * 0.9 + D.v.ph) * 0.03; D.v.body.rotation.x = Math.sin(t * 1.1 + D.v.ph) * 0.02;
  }
  updatePeople(dt, t);
}
// Kielwasser: die nächsten Boote zur Kamera bekommen die drei freien Plätze im Wasser-Shader (Platz 0 hat die Fähre)
export function assignWakes(list) {
  const W = U.uWake.value, WL = U.uWakeL.value, cp = camera.position;
  list.sort((a, b) => ((a[0] - cp.x) ** 2 + (a[1] - cp.z) ** 2) - ((b[0] - cp.x) ** 2 + (b[1] - cp.z) ** 2));
  for (let k = 1; k < 4; k++) { const w = list[k - 1]; if (w) { W[k].set(w[0], w[1], w[2], w[3]); WL[k] = w[4]; } else W[k].set(0, 0, 0, 0); }
}

export function waterInteractions() {
  INTERACT.push({ test: () => WATER.taxis.some(X => X.wait > 3 && player.on === X.v.pf), label: 'Wassertaxi ablegen lassen', act: () => { for (const X of WATER.taxis) if (player.on === X.v.pf) X.wait = 1.5; toast('Das Wassertaxi legt ab'); } });
  INTERACT.push({ test: () => WATER.tug && WATER.tug.wait > 3 && (player.on === WATER.tug.v.pf || player.on === WATER.tug.b.pf), label: 'Mit dem Schlepper hinausfahren', act: () => { WATER.tug.wait = 1.5; toast('Leinen los: der Schlepper zieht den Kahn über die Bucht'); } });
}
// Alles bauen (aus main.js nach buildPort, vor buildVenues): Kanal, Güterkai, Boote; Menschen nach buildGround
export function buildWaterLife() {
  buildCanal();
  buildFreightQuay();
  buildTaxiLanding();
  buildBoats();
}
