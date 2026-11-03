/* =====================================================================
   V58 · MEHR ORTE ZUM BETRETEN
   Drei neue Häuser auf freien Parkblöcken, ganz mit eigenem Zufall gebaut (die
   übrige Stadt bleibt Stein für Stein, wie sie war):
   - VARIETÉ METROPOL (Parkblock östlich des Belmont, Eingang zur Avenue):
     Vordach mit Glühbirnen, Leuchtpylon, Foyer mit Kasse, Garderobe, Sektbar,
     Plakaten und Treppe hinauf in den ansteigenden Saal: 320 rote Plüschsitze
     (alle ausreißbar), Logen, Orchestergraben mit Kapelle, Bühne mit Portal,
     Vorhang, gemaltem Prospekt und Rampenlicht; sechs Tänzerinnen tanzen
     Charleston, der Conférencier singt, das Publikum applaudiert zwischen den
     Nummern. Man setzt sich auf einen freien Platz (Blick zur Bühne), die
     Platzanweiserin bringt Sekt, Pralinen oder das Programm. Kommt Alexander
     herein, erhebt sich Applaus, der Conférencier begrüßt ihn.
   - VESPERA-BANK (gleicher Block, Eingang zur östlichen Avenue): Tempelfront mit
     kannelierten Säulen, Uhr im Giebel, Bronzetüren; Schalterhalle mit
     Marmorboden, Kassettendecke, Messinggittern, Kassierern, Kundschaft an den
     Schaltern und Stehpulten, Wachmann, Direktor; dahinter der Tresorraum mit
     runder Stahltür, Schließfachwänden und Goldbarren, die sich mit Telekinese
     stapeln lassen.
   - CAFÉ KRANICH (Parkblock an der Hafenpromenade): Wiener Kaffeehaus über
     venues.venue() (eigener Zufall), Fliesen, helles Holz, Kuchentheke, Terrasse
     im Park, Mokka und Sachertorte am Tisch.
   Alle Leute laufen über VENUE_PEDS (reagieren auf Alexander wie überall:
   awe.js), lose Dinge über physics.SPAWNS, Möbel über tear.js.
   Keine neuen Shader; ein Ausdruck im Figuren-Shader (Applaus im Sitzen, 9.8).
   ===================================================================== */
import { T, scene, mulberry32, canvasTex, shared, MOBILE, camera, $ } from './core.js';
import { stdMat, addCollider } from './people-skeleton.js';
import { addGlow, addNeon, NEON, lamps, trees, glowPts, addSeg } from './facade-shader.js';
import { kit, Bx, wallRun, nameplate, benchGeo } from './harbour.js';
import { lathe, roundBox, placeFurn, FURN, DOORS, makeSignTex } from './entrances.js';
import { blocks } from './island.js';
import { COL, GOWNS, DRESSES, FLAPPERS, COATS, SHIRTS, setAct, turnHead } from './serpentine.js';
import { addLight } from './performance.js';
import { venue, VENUES, VENUE_PEDS, signBoard, walkGait, DINE } from './venues.js';
import { tearWrap } from './tear.js';
import { wantTexture } from './assets.js';
import { player } from './player.js';
import { ware } from './shops.js';
import { marbleTex } from './belmont.js';

export const ORTE = { theater: null, bank: null, cafe: null, spawns: [], show: { st: 'nummer', t: 0, n: 0, greet: 0, inside: false, vis: false } };
const pk = (rr, a) => a[Math.floor(rr() * a.length)];
const Y0 = 0.22;   // Oberkante der Blöcke (Gehweg)

/* ---------- Parkblock finden und freiräumen ---------- */
function takeBlock(nx, nz) {
  const cand = blocks.filter(b => b.park && !b.square && !b.taken);
  if (!cand.length) return null;
  cand.sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - nx, (a.z0 + a.z1) / 2 - nz) - Math.hypot((b.x0 + b.x1) / 2 - nx, (b.z0 + b.z1) / 2 - nz));
  const b = cand[0]; if (Math.hypot((b.x0 + b.x1) / 2 - nx, (b.z0 + b.z1) / 2 - nz) > 120) return null;
  b.taken = true; return b;
}
// Bäume und Weglichter des Parks aus einem Rechteck entfernen
function clearRect(x0, z0, x1, z1) {
  for (let i = trees.length - 1; i >= 0; i--) { const t = trees[i]; if (t.x > x0 && t.x < x1 && t.z > z0 && t.z < z1) trees.splice(i, 1); }
  for (let i = glowPts.length - 1; i >= 0; i--) { const g = glowPts[i]; if (g.p[0] > x0 && g.p[0] < x1 && g.p[2] > z0 && g.p[2] < z1 && Math.abs(g.p[1] - 3.2) < 0.01) glowPts.splice(i, 1); }
}
// Marmor (Foto aus dem Manifest, bis dahin heller Granit) als eigenes Material für den Bausatz
let marbleM = null;
function marble() {   // heller Marmor aus der Leinwand (Marble006 aus dem Manifest ist dunkel: damit wäre die Halle schwarz), nur Relief und Rauheit vom Foto
  if (!marbleM) { const t = marbleTex('#e8e2d6', '#7a7064', 58, 50); t.wrapS = t.wrapT = T.RepeatWrapping; marbleM = wantTexture(stdMat({ map: t, vertexColors: true, roughness: 0.3, metalness: 0.05, envI: 0.75 }), { normalMap: 'marble-normal', roughnessMap: 'marble-rough', normalScale: 0.4, roughness: 0.4, repeat: [0.5, 0.5] }); }
  return marbleM;
}
// Dachplatte für die Regenkarte (atmosphere.js) und als dunkle Attika
function roofSlab(x, z, w, d, y, seed) { addSeg({ x, z, w, d, y0: y, y1: y + 0.5, tint: [0.22, 0.2, 0.19], seed, style: 0, dens: 0, flood: 0, rib: [0, 0, 0] }, true); }
// Säule mit Kanneluren
function column(K, x, y, z, h, r, c, flutes = 12) {
  K.add('stone', lathe([[r * 1.3, 0], [r * 1.3, 0.12], [r * 1.05, 0.2], [r, 0.3], [r, h - 0.35], [r * 1.08, h - 0.25], [r * 1.35, h - 0.08], [r * 1.35, h]], 18).translate(x, y, z), c);
  for (let k = 0; k < flutes; k++) { const a = k / flutes * 6.283; K.add('stone', new T.BoxGeometry(r * 0.26, h - 0.75, r * 0.12).rotateY(-a).translate(x + Math.cos(a) * r * 0.98, y + h / 2 - 0.05, z + Math.sin(a) * r * 0.98), c.map(v => v * 0.9)); }
}
// Kronleuchter wie im Restaurant (Goldringe mit Kerzen)
function chandelier(K, x, y, z, s = 1) {
  K.add('gold', new T.CylinderGeometry(0.02, 0.02, 1.0 * s, 6).translate(x, y + 0.5 * s, z));
  for (let k = 0; k < 3; k++) K.add('gold', new T.TorusGeometry((0.55 - k * 0.15) * s, 0.02, 6, 28).rotateX(Math.PI / 2).translate(x, y - (0.6 - k * 0.18) * s, z));
  for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; K.add('lit', new T.CylinderGeometry(0.025, 0.025, 0.14, 6).translate(x + Math.cos(a) * 0.55 * s, y - 0.5 * s, z + Math.sin(a) * 0.55 * s), [1.8, 1.25, 0.7]); }
  addGlow(x, y - 0.55 * s, z, [1.4, 0.95, 0.5], 1.3 * s); addLight(0xffb070, 2.2, 16 * s, 1.6, x, y - 0.9 * s, z);
}
function sconce(K, x, y, z, nx, nz) {
  K.add('gold', lathe([[0.02, 0], [0.12, 0.05], [0.16, 0.3], [0.14, 0.32]], 10).translate(x + nx * 0.14, y, z + nz * 0.14));
  K.add('lit', new T.SphereGeometry(0.09, 8, 6).translate(x + nx * 0.14, y + 0.3, z + nz * 0.14), [1.7, 1.2, 0.65]);
  addGlow(x + nx * 0.3, y + 0.3, z + nz * 0.3, [1.3, 0.85, 0.45], 0.8);
}
const ped = (o) => { const p = { st: 4, v: 0, sc: 1, ...o }; VENUE_PEDS.push(p); return p; };
function say(who, s) {
  const el = $('say'); if (!el) return;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + s + '“'; el.style.opacity = 1; shared.sayTimer = 4.5;
}

/* =====================================================================
   VARIETÉ METROPOL
   ===================================================================== */
function buildTheater(b, rr) {
  const F = Y0 + 0.3, X0 = 345.5 + (b.x0 - 341), Z0 = -50 + (b.z0 + 63), X1 = X0 + 41, Z1 = Z0 + 32, cz = (Z0 + Z1) / 2;
  // Lage im Block (der Block kann ein anderer sein, wenn sich die Stadt je ändert: alles relativ zur Blockecke)
  const K = kit(), cols = [], H = 10.5, HF = 6.0, HS = 14;
  clearRect(X0 - 6, Z0 - 4, X1 + 3, Z1 + 4);
  const stone = [0.84, 0.8, 0.7], dark = [0.6, 0.56, 0.5], red = [0.5, 0.08, 0.1], wood = [0.36, 0.2, 0.12];
  const V = { name: 'VARIETÉ METROPOL', kind: 'theater', x: (X0 + X1) / 2, z: cz, x0: X0, x1: X1, z0: Z0, z1: Z1, F, seats: [], tables: [], waiters: [], station: null, staff: [], peds: [], still: true, sitHint: 'Platz genommen · E bestellen · W aufstehen', cols };
  VENUES.push(V); ORTE.theater = V;
  // ---- Grundriss: Foyer x0..xF, Treppe, Saal bis xS, Bühne bis xB, Hinterbühne bis x1
  const xF = X0 + 7.1, xT = X0 + 10.0, xS = X0 + 24.0, xB = X0 + 38.0, LY = F + 1.19;
  V.foyer = { x0: X0, x1: xT, z0: Z0, z1: Z1 }; V.hall = { x0: xT, x1: xS, z0: Z0 + 0.5, z1: Z1 - 0.5, y: LY }; Object.assign(V, { xF, xT, xS, xB, LY, H, HF, HS });
  // Plinthe und Stufen zum Eingang
  K.add('stone', Bx(X1 - X0, F - Y0, Z1 - Z0, (X0 + X1) / 2, (Y0 + F) / 2, cz, 3), dark); addCollider(X0, 0, Z0, X1, F, Z1);
  for (let k = 0; k < 2; k++) { const w = 12 - k * 0.6; K.add('stone', Bx(0.5, 0.15, w, X0 - 0.25 - k * 0.5, Y0 + 0.075 + (1 - k) * 0.15, cz, 2), dark); addCollider(X0 - 0.5 - k * 0.5, 0, cz - w / 2, X0 - k * 0.5, Y0 + 0.15 + (1 - k) * 0.15, cz + w / 2); }
  // ---- Außenwände: Foyer hoch 7 m, Saal 11 m, Bühnenhaus 14.5 m; hell verputzt mit Lisenen
  const outer = (ax, az, bx, bz, h, doors) => wallRun(K, cols, ax, az, bx, bz, F, h, { outK: 'stone', outC: stone, inK: 'inWood', inC: wood, th: 0.5, windows: false, doors });
  // (Umlauf wie in venue(): Süd x0->x1, Ost z1->z0, Nord x1->x0, West z0->z1, dann zeigt die Steinseite nach außen)
  outer(X0, Z0, X0, cz - 2.4, HF + 0.6); outer(X0, cz + 2.4, X0, Z1, HF + 0.6);   // Front (West) mit 4,8 m breitem Portal
  K.add('stone', Bx(0.5, HF + 0.6 - 3.4, 4.8, X0, F + 3.4 + (HF + 0.6 - 3.4) / 2, cz, 2), stone); addCollider(X0 - 0.25, F + 3.4, cz - 2.4, X0 + 0.25, F + HF + 0.6, cz + 2.4);
  K.add('gold', Bx(0.6, 0.12, 5.0, X0, F + 3.42, cz, 1)); for (const s of [-1, 1]) K.add('gold', Bx(0.6, 3.4, 0.12, X0, F + 1.7, cz + s * 2.42, 1));
  outer(xT, Z0, X0, Z0, HF + 0.6); outer(X0, Z1, xT, Z1, HF + 0.6);            // Foyer Nord/Süd
  outer(xB, Z0, xT, Z0, H + 0.8); outer(xT, Z1, xB, Z1, H + 0.8);             // Saal Nord/Süd
  outer(X1, Z0, xB, Z0, HS); outer(X1, Z1, X1, Z0, HS); outer(xB, Z1, X1, Z1, HS);   // Bühnenhaus
  for (const c of cols) addCollider(c.x0, c.y0, c.z0, c.x1, c.y1, c.z1);
  // Lisenen und Gesimse außen, Dachplatten (Regen bleibt draußen)
  for (const [x0, x1, h] of [[X0, xT, HF + 0.6], [xT, xB, H + 0.8], [xB, X1, HS]]) {
    K.add('stone', Bx(x1 - x0 + 0.7, 0.5, Z1 - Z0 + 0.7, (x0 + x1) / 2, F + h + 0.25, cz, 3), stone.map(v => v * 1.05));
    K.add('gold', Bx(x1 - x0 + 0.8, 0.1, Z1 - Z0 + 0.8, (x0 + x1) / 2, F + h - 0.05, cz, 1));
    roofSlab((x0 + x1) / 2, cz, x1 - x0, Z1 - Z0, F + h + 0.5, 5801 + x0 | 0);
    for (const zz of [Z0 - 0.3, Z1 + 0.3]) for (let x = x0 + 3; x < x1 - 1; x += 6) K.add('stone', Bx(0.6, h - 0.3, 0.25, x, F + h / 2, zz, 1), stone.map(v => v * 0.92));
  }
  // ---- Eingangsfront: Pylon mit Leuchtschrift, Vordach mit Glühbirnen, Plakatkästen, Laternen
  { const px = X0 - 0.9, py = F + 3.5, pz = cz + 6.8;
    K.add('stone', Bx(1.3, 12, 1.3, px, F + 6, pz, 1), stone.map(v => v * 0.95));
    const sm = new T.MeshBasicMaterial({ map: makeSignTex('METROPOL', '#ffd27a', true).t, color: new T.Color(1.2, 1.2, 1.2), side: T.DoubleSide });
    for (const [sx, sz, ry] of [[px - 0.66, pz, -Math.PI / 2], [px, pz + 0.66, 0], [px, pz - 0.66, Math.PI]]) { const m = new T.Mesh(new T.PlaneGeometry(1.1, 7.8), sm); m.position.set(sx, py + 3.4, sz); m.rotation.y = ry; scene.add(m); }
    addNeon(px - 0.7, F + 12.0, pz, 0.08, 0.08, 1.3, NEON.gold); addNeon(px - 0.7, F + 2.7, pz, 0.08, 0.08, 1.3, NEON.gold);
    addGlow(px - 0.9, py + 3.4, pz, [1.4, 1.0, 0.5], 2.6);
    // Vordach
    const my = F + 3.6, mw = 10.5, md = 2.8;
    K.add('gold', Bx(md, 0.14, mw, X0 - md / 2, my, cz, 1)); K.add('iron', Bx(md - 0.2, 0.5, mw - 0.2, X0 - md / 2, my + 0.32, cz, 1), [0.12, 0.1, 0.1]);
    K.add('gold', Bx(md - 0.1, 0.06, mw - 0.1, X0 - md / 2, my + 0.6, cz, 1));
    const sgn = signBoard('HEUTE · DIE KRATER-REVUE · 20 UHR', mw - 0.5, 0.42, '#ffe2a0', '#1a0c10'); sgn.position.set(X0 - md + 0.02, my + 0.32, cz); sgn.rotation.y = -Math.PI / 2; scene.add(sgn);
    for (let u = -mw / 2 + 0.3; u <= mw / 2 - 0.29; u += 0.45) { K.add('lit', new T.SphereGeometry(0.05, 6, 5).translate(X0 - md + 0.05, my - 0.1, cz + u), [2.0, 1.5, 0.8]); K.add('lit', new T.SphereGeometry(0.05, 6, 5).translate(X0 - md + 0.05, my + 0.68, cz + u), [2.0, 1.5, 0.8]); }
    for (let u = 0.3; u < md - 0.2; u += 0.45) for (const s of [-1, 1]) K.add('lit', new T.SphereGeometry(0.05, 6, 5).translate(X0 - u, my - 0.1, cz + s * (mw / 2 - 0.05)), [2.0, 1.5, 0.8]);
    for (let u = -mw / 2 + 0.6; u < mw / 2; u += 1.2) K.add('lit', new T.SphereGeometry(0.07, 6, 5).translate(X0 - md / 2, my - 0.1, cz + u), [2.0, 1.5, 0.8]);
    addGlow(X0 - md / 2, my - 0.3, cz, [1.5, 1.1, 0.6], 3.0); addLight(0xffd090, 2.6, 16, 1.5, X0 - md / 2, my - 0.4, cz);
    for (const s of [-1, 1]) { K.add('gold', Bx(0.12, 0.12, 0.12, X0 - md + 0.2, my - 0.5, cz + s * (mw / 2 - 0.4), 1)); K.add('gold', new T.CylinderGeometry(0.02, 0.02, 1.9, 6).rotateZ(0.65).translate(X0 - md / 2 - 0.2, my + 0.9, cz + s * (mw / 2 - 0.4))); }
    // Plakatkästen mit Revue-Plakaten links und rechts vom Portal
    const poster = canvasTex(256, 384, (g, W, Hh) => {
      g.fillStyle = '#1c0e2a'; g.fillRect(0, 0, W, Hh);
      const gr = g.createRadialGradient(W / 2, Hh * 0.42, 10, W / 2, Hh * 0.42, 150); gr.addColorStop(0, '#f6d27a'); gr.addColorStop(1, 'rgba(246,210,122,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = '#f0c060'; g.lineWidth = 2; for (let k = 0; k < 14; k++) { const a = Math.PI + k / 13 * Math.PI; g.beginPath(); g.moveTo(W / 2, Hh * 0.42); g.lineTo(W / 2 + Math.cos(a) * 170, Hh * 0.42 + Math.sin(a) * 170); g.stroke(); }
      g.fillStyle = '#120818'; for (let k = 0; k < 5; k++) { const x = 40 + k * 44; g.beginPath(); g.ellipse(x, Hh * 0.5, 9, 22, 0, 0, 7); g.fill(); g.fillRect(x - 3, Hh * 0.5 + 16, 6, 40); g.beginPath(); g.moveTo(x, Hh * 0.5 + 50); g.lineTo(x - 14 + (k % 2) * 28, Hh * 0.5 + 84); g.lineTo(x + 6 - (k % 2) * 12, Hh * 0.5 + 86); g.fill(); }
      g.fillStyle = '#ffe0a0'; g.font = 'bold 30px Limelight, Georgia, serif'; g.textAlign = 'center'; g.fillText('KRATER', W / 2, 46); g.fillText('REVUE', W / 2, 80);
      g.font = '17px Georgia, serif'; g.fillStyle = '#f0d0a0'; g.fillText('Sechs Girls · Orchester', W / 2, Hh - 60); g.fillText('Allabendlich 20 Uhr', W / 2, Hh - 36);
      g.strokeStyle = '#c9a258'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, Hh - 12);
    });
    const pm = new T.MeshBasicMaterial({ map: poster, color: 0xb8b0a0 });
    for (const dz of [-5.6, -3.9, 3.9, 5.6]) { const m = new T.Mesh(new T.PlaneGeometry(1.1, 1.65), pm); m.position.set(X0 - 0.3, F + 2.1, cz + dz); m.rotation.y = -Math.PI / 2; scene.add(m); K.add('gold', Bx(0.08, 1.8, 1.25, X0 - 0.26, F + 2.1, cz + dz, 1)); addGlow(X0 - 0.6, F + 3.1, cz + dz, [1.3, 1.0, 0.6], 0.6); }
    for (const s of [-1, 1]) lamps.push({ x: X0 - 3.2, z: cz + s * 8.5, h: 4.4 });
    DOORS.push({ x: X0 - 0.6, z: cz, nx: -1, nz: 0, kind: 'hotel' });   // Grüppchen vor der Tür, Leute gehen hinein wie in ein Hotel
  }
  // ---- Foyer: Teppich, Stuckdecke, Kronleuchter, Kasse, Garderobe, Sektbar, Spiegel, Palmen, Treppe
  K.add('carpet', Bx(xT - X0 - 0.6, 0.04, Z1 - Z0 - 1, (X0 + xT) / 2, F + 0.02, cz, 3), [0.7, 0.35, 0.35]);
  K.add('ceil', Bx(xT - X0 - 0.4, 0.2, Z1 - Z0 - 0.6, (X0 + xT) / 2, F + HF - 0.1, cz), [1, 1, 1]);
  for (const k of [0, 1]) K.add('gold', Bx(xT - X0 - 0.8 - k * 1.4, 0.06, Z1 - Z0 - 1.2 - k * 1.4, (X0 + xT) / 2, F + HF - 0.24 - k * 0.05, cz, 1));
  chandelier(K, (X0 + xF) / 2, F + HF - 1.4, cz, 1.2); chandelier(K, (X0 + xF) / 2, F + HF - 1.4, cz - 9, 0.8); chandelier(K, (X0 + xF) / 2, F + HF - 1.4, cz + 9, 0.8);
  for (const zz of [Z0 + 0.3, Z1 - 0.3]) for (let x = X0 + 2; x < xT - 1; x += 3.5) sconce(K, x, F + 2.6, zz, 0, zz < cz ? 1 : -1);
  // Kasse (Nordseite neben dem Eingang): Kabine mit Fenster, Schild, Kassiererin
  { const kx = X0 + 2.0, kz = Z0 + 4.2;
    K.add('varnish', Bx(2.0, 1.1, 2.4, kx, F + 0.55, kz, 1), [0.3, 0.14, 0.08]); K.add('gold', Bx(2.1, 0.05, 2.5, kx, F + 1.12, kz, 1));
    for (const [dx, dz] of [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]]) K.add('gold', Bx(0.08, 1.4, 0.08, kx + dx, F + 1.85, kz + dz, 1));
    K.add('glass', new T.PlaneGeometry(2.3, 1.3).rotateY(0).translate(kx, F + 1.8, kz + 1.18)); K.add('gold', Bx(2.1, 0.06, 2.5, kx, F + 2.55, kz, 1)); K.add('cloth', Bx(2.2, 0.3, 2.6, kx, F + 2.72, kz, 1), red);
    const sg = signBoard('KASSE', 1.4, 0.3, '#ffe0a0', '#2a0c12'); sg.position.set(kx, F + 2.72, kz + 1.32); scene.add(sg);
    addCollider(kx - 1.05, F, kz - 1.25, kx + 1.05, F + 2.6, kz + 1.25);
    ped({ x: kx, y: F, z: kz, yaw: 0, kind: 'dress', col: DRESSES[4], act: 28.3, busy: true });
    ped({ x: kx + 0.2, y: F, z: kz + 2.0, yaw: Math.PI, kind: 'suit', col: COATS[3], act: 31.2 });
    ped({ x: kx - 0.5, y: F, z: kz + 3.0, yaw: Math.PI + 0.2, kind: 'lady', col: COATS[5], act: 0.7, sc: 0.95 });
    ware('cup-saucer', kx + 0.6, F + 1.15, kz - 0.6, rr);
  }
  // Garderobe entlang der Nordwand: Theke, Hakenleiste mit Mänteln, Garderobiere
  { const gz = Z0 + 0.9, gx0 = X0 + 4.2, gx1 = xF;
    K.add('varnish', Bx(gx1 - gx0, 1.05, 0.6, (gx0 + gx1) / 2, F + 0.53, gz + 0.9, 1), [0.3, 0.14, 0.08]); K.add('gold', Bx(gx1 - gx0 + 0.05, 0.05, 0.65, (gx0 + gx1) / 2, F + 1.07, gz + 0.9, 1));
    addCollider(gx0, F, gz + 0.6, gx1, F + 1.1, gz + 1.2);
    K.add('varnish', Bx(gx1 - gx0, 0.08, 0.06, (gx0 + gx1) / 2, F + 1.9, gz + 0.3, 1), [0.3, 0.14, 0.08]);
    for (let x = gx0 + 0.25; x < gx1 - 0.1; x += 0.3) { K.add('gold', new T.SphereGeometry(0.025, 6, 5).translate(x, F + 1.86, gz + 0.33)); if (rr() < 0.7) K.add('cloth', roundBox(0.24, 1.0 + rr() * 0.25, 0.1, 0.04).translate(x, F + 1.3, gz + 0.38), pk(rr, COATS)); }
    ped({ x: gx0 + 1.4, y: F, z: gz + 0.35, yaw: Math.PI, kind: 'dress', col: DRESSES[1], act: 1.3, busy: true });
    const sg = signBoard('GARDEROBE', 2.2, 0.3, '#ffe0a0', '#2a0c12'); sg.position.set((gx0 + gx1) / 2, F + 2.5, gz + 0.3); scene.add(sg);
  }
  // Sektbar an der Südwand: Theke, Spiegel, Regal mit Flaschen, Barkeeper, Gäste
  { const bz = Z1 - 1.0, bx0 = X0 + 3.0, bx1 = xF + 1.2, bm = (bx0 + bx1) / 2;
    K.add('varnish', Bx(bx1 - bx0, 1.05, 0.7, bm, F + 0.53, bz - 0.9, 1), [0.3, 0.14, 0.08]); K.add('stone', Bx(bx1 - bx0 + 0.1, 0.06, 0.8, bm, F + 1.08, bz - 0.9, 1), [0.92, 0.9, 0.86]);
    addNeon(bm, F + 1.0, bz - 0.5, bx1 - bx0, 0.02, 0.02, NEON.gold); addCollider(bx0, F, bz - 1.25, bx1, F + 1.1, bz - 0.55);
    K.add('glass', new T.PlaneGeometry(bx1 - bx0, 1.6).translate(bm, F + 2.2, bz - 0.2));
    for (const sy of [1.5, 2.0]) { K.add('varnish', Bx(bx1 - bx0, 0.04, 0.3, bm, F + sy, bz - 0.15, 1), [0.3, 0.14, 0.08]); for (let x = bx0 + 0.2; x < bx1 - 0.1; x += 0.16) if (rr() < 0.7) ware(pk(rr, ['wine-white', 'wine-red', 'bottle', 'soda-bottle']), x, F + sy + 0.02, bz - 0.15, rr); }
    for (let x = bx0 + 0.6; x < bx1 - 0.3; x += 0.9) ware(pk(rr, ['glass-wine', 'cocktail', 'glass-wine']), x, F + 1.11, bz - 0.9 + (rr() - 0.5) * 0.3, rr);
    addLight(0xffc080, 1.6, 9, 1.8, bm, F + 2.8, bz - 0.5);
    ped({ x: bm, y: F, z: bz - 0.3, yaw: 0, kind: 'waiter', col: [0.92, 0.9, 0.85], act: 13.3, busy: true, bartender: true });
    for (const [dx, k, c, a] of [[-1.8, 'tux', COL.tux, 15.3], [-1.1, 'gown', GOWNS[0], 0.7], [1.4, 'suit', COATS[1], 11.4], [2.1, 'flapper', FLAPPERS[1], 0.9]]) ped({ x: bm + dx, y: F, z: bz - 1.75, yaw: Math.PI, kind: k, col: c, act: a, sc: 0.95 + rr() * 0.08 });
    for (let x = bx0 + 0.8; x < bx1 - 0.4; x += 1.1) tearWrap('metropol:hocker:' + x.toFixed(1), { name: 'Barhocker', m: 8, stuff: 'wood', seat: true }, () => placeFurn(FURN.barStool(), { up: 'leather', frame: 'gold' }, (k, g) => K.add(k, g, k === 'leather' ? red : [1, 1, 1]), x, F, bz - 1.65));
    ORTE.spawns.push({ x: bm, z: bz - 1, items: [['champagne', bm - 2.6, bz - 0.9, 0.3, F + 1.11 - F], ['coupe', bm - 2.3, bz - 0.95, 0, F + 1.11 - F], ['coupe', bm + 2.6, bz - 0.85, 0, F + 1.11 - F], ['hatbox', X0 + 1.2, bz - 0.4, 0.4], ['papers', X0 + 1.5, Z0 + 7.5, 0.6]], y: F + 2.2, floor: F });
  }
  // Palmen, Spiegel in Goldrahmen, Plakate an den Wänden
  for (const [x, z] of [[X0 + 1.2, cz - 3.2], [X0 + 1.2, cz + 3.2], [xF - 0.3, Z0 + 7.5], [xF - 0.3, Z1 - 7.5]]) tearWrap('metropol:palme:' + x.toFixed(0) + ',' + z.toFixed(0), { name: 'Palme', m: 30, stuff: 'metal' }, () => placeFurn(FURN.vasePlant(1.6), { up: 'cloth', frame: 'gold', leaf: 'cloth' }, (k, g) => K.add(k, g, k === 'cloth' ? [0.15, 0.4, 0.2] : [1, 1, 1]), x, F, z));
  for (const zz of [cz - 7, cz + 7]) { K.add('gold', Bx(0.1, 3.0, 1.6, X0 + 0.3, F + 2.2, zz, 1)); K.add('glass', new T.PlaneGeometry(1.4, 2.8).rotateY(Math.PI / 2).translate(X0 + 0.36, F + 2.2, zz)); }
  // Treppe hinauf zum Saal (sieben Stufen über die ganze Breite), Messinghandläufe, Saaltüren mit Vorhang
  const ST = 7, sh = (LY - F) / ST, sd = (xT - xF) / ST;
  for (let k = 0; k < ST; k++) { const x0 = xF + k * sd, y1 = F + (k + 1) * sh; K.add('carpet', Bx(xT - x0, y1 - F, Z1 - Z0 - 1, (x0 + xT) / 2, (F + y1) / 2, cz, 3), [0.7, 0.35, 0.35]); K.add('gold', Bx(0.04, 0.03, Z1 - Z0 - 1, x0 + 0.02, y1 - 0.015, cz, 1)); addCollider(x0, F, Z0 + 0.5, xT, y1, Z1 - 0.5); }
  for (const zz of [cz - 2.6, cz + 2.6, Z0 + 1.3, Z1 - 1.3]) { for (let k = 0; k <= ST; k += 2) K.add('gold', new T.CylinderGeometry(0.02, 0.02, 0.95, 6).translate(xF + k * sd, F + k * sh + 0.48, zz)); K.add('gold', new T.CylinderGeometry(0.025, 0.025, Math.hypot(xT - xF, LY - F), 6).rotateZ(Math.PI / 2 - Math.atan2(LY - F, xT - xF)).translate((xF + xT) / 2, (F + LY) / 2 + 0.95, zz)); }
  V.station = { x: xT + 1.0, z: Z1 - 1.6 };
  // Saalwand zum Foyer: zwei Türöffnungen mit Samtvorhang, Oberlicht "SAAL"
  { const wz = (a, b) => { K.add('inWood', Bx(0.3, H - 0.2, b - a, xT, F + (H - 0.2) / 2 + 0.1, (a + b) / 2, 1.3), wood); addCollider(xT - 0.15, F, a, xT + 0.15, F + H, b); };
    wz(Z0 + 0.5, cz - 5.6); wz(cz - 3.6, cz + 3.6); wz(cz + 5.6, Z1 - 0.5);
    for (const dz of [-4.6, 4.6]) { K.add('inWood', Bx(0.3, H - 3.0, 2.0, xT, F + 3.0 + (H - 3.0) / 2, cz + dz, 1.3), wood); addCollider(xT - 0.15, F + 3.0, cz + dz - 1, xT + 0.15, F + H, cz + dz + 1);
      for (const s of [-1, 1]) K.add('cloth', roundBox(0.25, 2.9, 0.42, 0.08).translate(xT, F + 1.5, cz + dz + s * 0.8), red);   // zurückgebundene Vorhänge
      K.add('cloth', Bx(0.34, 0.5, 2.1, xT, F + 2.75, cz + dz, 1), red); K.add('gold', Bx(0.36, 0.05, 2.15, xT, F + 2.98, cz + dz, 1));
      const sg = signBoard('SAAL', 0.9, 0.28, '#ffe0a0', '#2a0c12'); sg.position.set(xT - 0.17, F + 3.3, cz + dz); sg.rotation.y = -Math.PI / 2; scene.add(sg); addGlow(xT - 0.5, F + 3.3, cz + dz, [1.3, 0.9, 0.5], 0.7); }
  }
  // ---- Saal: ansteigende Reihen, Mittelgang und Seitengänge, Logen, Decke mit Sonnenfächer, Wandleuchten
  const rows = 8, pitch = 1.0, rise = 0.17, rx0 = xT + 2.5, seatW = 0.55, perSide = 20;
  const blockZ = [[cz - 1.0 - perSide * seatW, cz - 1.0], [cz + 1.0, cz + 1.0 + perSide * seatW]];   // zwei Sitzblöcke, Mittelgang 2 m
  V.rowY = x => { const r = Math.round((x - rx0) / pitch); return F + (rows - 1 - Math.max(0, Math.min(rows - 1, r))) * rise; };
  V.rx0 = rx0; V.pitch = pitch; V.rows = rows; V.aisles = [Z0 + 1.6, cz, Z1 - 1.6];
  K.add('carpet', Bx(rx0 - 0.5 - xT, 0.04, Z1 - Z0 - 1, (xT + rx0 - 0.5) / 2, LY + 0.02, cz, 3), [0.55, 0.22, 0.24]); addCollider(xT, F, Z0 + 0.5, rx0 - 0.5, LY, Z1 - 0.5);   // Landung hinter der letzten Reihe
  const seatMats = { up: 'leather', frame: 'varnish', wood: 'varnish' }, seatAdd = (k, g) => K.add(k, g, k === 'leather' ? red : [0.2, 0.1, 0.06]);
  const seatGeo = () => [[roundBox(0.48, 0.1, 0.44, 0.04).translate(0, 0.46, 0.02), 'up'], [roundBox(0.48, 0.62, 0.1, 0.04).rotateX(0.12).translate(0, 0.72, -0.26), 'up'], [roundBox(0.5, 0.06, 0.5, 0.02).translate(0, 0.4, 0), 'wood'],
    [new T.BoxGeometry(0.06, 0.08, 0.42).translate(-0.26, 0.62, -0.02), 'wood'], [new T.BoxGeometry(0.06, 0.08, 0.42).translate(0.26, 0.62, -0.02), 'wood'], [new T.BoxGeometry(0.04, 0.4, 0.04).translate(-0.2, 0.2, 0.1), 'wood'], [new T.BoxGeometry(0.04, 0.4, 0.04).translate(0.2, 0.2, 0.1), 'wood']];
  const dens = MOBILE ? 0.16 : 0.4;
  for (let r = 0; r < rows; r++) {
    const x = rx0 + r * pitch, yf = F + (rows - 1 - r) * rise;
    K.add('carpet', Bx(pitch, yf - F + 0.04, Z1 - Z0 - 1, x, (F + yf) / 2 + 0.02, cz, 3), [0.55, 0.22, 0.24]);
    addCollider(x - pitch / 2, F, Z0 + 0.5, x + pitch / 2, yf, Z1 - 0.5);
    K.add('lit', Bx(0.03, 0.03, Z1 - Z0 - 1.2, x - pitch / 2 + 0.02, yf + 0.01, cz, 1), [0.5, 0.35, 0.15]);   // Stufenlicht
    for (const [za, zb] of blockZ) for (let k = 0; k < perSide; k++) {
      const z = za + (k + 0.5) * seatW, sx = x - 0.1;
      tearWrap('metropol:sitz:' + r + ',' + z.toFixed(1), { name: 'Theatersitz', m: 14, stuff: 'wood', seat: true }, () => placeFurn(seatGeo(), seatMats, seatAdd, sx, yf, z, Math.PI / 2));
      const s = { x: sx, z, y: yf + 0.46, yaw: Math.PI / 2, tx: sx + 0.1, tz: z + 0.3, ty: yf + 0.64, pitch: -0.04, up: [x + 0.5, yf + 0.02, z], row: r };
      V.seats.push(s);
      if (rr() < dens) {
        const kind = pk(rr, ['tux', 'gown', 'suit', 'lady', 'dress', 'flapper', 'dbl', 'furcoat', 'gown', 'tux']), r2 = rr();
        const pd = ped({ x: sx, y: s.y, z, yaw: Math.PI / 2, kind, col: kind === 'gown' ? pk(rr, GOWNS) : kind === 'dress' ? pk(rr, DRESSES) : kind === 'flapper' ? pk(rr, FLAPPERS) : kind === 'tux' ? COL.tux : pk(rr, COATS), sc: 0.93 + rr() * 0.12, sit: true, act: r2 < 0.72 ? 7.0 + rr() * 0.3 : r2 < 0.86 ? 11.4 : 7.8, seat: s, audience: true, dineT: 1e9 });
        s.taken = pd; V.peds.push(pd);
      }
    }
    if (r > 0) addCollider(x - pitch / 2 - 0.05, yf, Z0 + 0.5, x - pitch / 2 + 0.05, yf + rise, Z1 - 0.5);   // kleine Kante je Stufe (nur Kollision der Stufe selbst)
  }
  // Logen an beiden Seitenwänden (zwei je Seite), mit Brüstung, Lämpchen und Gästen
  for (const s of [-1, 1]) for (const lx of [rx0 + 1.5, rx0 + 5.5]) {
    const lz = s < 0 ? Z0 + 0.5 + 1.4 : Z1 - 0.5 - 1.4, ly = F + 3.4;
    K.add('inWood', Bx(3.2, 0.25, 2.8, lx, ly - 0.12, lz, 1.3), wood); K.add('cloth', Bx(3.2, 0.9, 0.12, lx, ly + 0.45, lz - s * 1.4, 1), red); K.add('gold', Bx(3.3, 0.06, 0.16, lx, ly + 0.92, lz - s * 1.4, 1));
    for (const dx of [-1.6, 1.6]) K.add('gold', new T.CylinderGeometry(0.06, 0.08, 3.4 - 0.1, 8).translate(lx + dx, F + (ly - F) / 2, lz - s * 1.4));
    K.add('lit', new T.SphereGeometry(0.07, 8, 6).translate(lx, ly + 1.0, lz - s * 1.45), [1.6, 1.1, 0.6]); addGlow(lx, ly + 1.0, lz - s * 1.6, [1.3, 0.85, 0.45], 0.7);
    for (const dx of [-0.7, 0.7]) { placeFurn(FURN.diningChair(), { up: 'leather', wood: 'varnish' }, seatAdd, lx + dx, ly, lz + s * 0.2, s < 0 ? Math.PI : 0); if (rr() < 0.75) ped({ x: lx + dx, y: ly + 0.48, z: lz + s * 0.2, yaw: s < 0 ? Math.PI : 0, kind: rr() < 0.5 ? 'tux' : 'gown', col: rr() < 0.5 ? COL.tux : pk(rr, GOWNS), sc: 0.96 + rr() * 0.08, sit: true, act: rr() < 0.6 ? 7.2 : 11.4, audience: true, loge: true }); }
  }
  // Decke: dunkel mit goldenem Sonnenfächer über der Bühne, Wandleuchten, kleine Deckenlichter
  K.add('ceil', Bx(xB - xT, 0.2, Z1 - Z0 - 0.8, (xT + xB) / 2, F + H - 0.1, cz), [0.35, 0.3, 0.3]);
  for (let k = 0; k < 9; k++) { const a = Math.PI * 0.5 + (k - 4) * 0.19; K.add('gold', new T.BoxGeometry(0.12, 0.04, 7.0).rotateY(a).translate(xS - 1.5 + Math.cos(a - Math.PI / 2) * 3.5, F + H - 0.24, cz + Math.sin(a - Math.PI / 2) * 3.5), [1, 1, 1]); }
  for (let x = xT + 3; x < xS; x += 4) for (const zz of [cz - 6, cz + 6]) { K.add('lit', new T.SphereGeometry(0.12, 8, 6).translate(x, F + H - 0.25, zz), [1.2, 0.85, 0.5]); addGlow(x, F + H - 0.3, zz, [1.0, 0.7, 0.4], 0.9); }
  for (const zz of [Z0 + 0.75, Z1 - 0.75]) for (let x = xT + 1.5; x < xS; x += 3) sconce(K, x, F + 2.8 + (xS - x) * 0.0, zz, 0, zz < cz ? 1 : -1);
  for (const zz of [Z0 + 0.75, Z1 - 0.75]) K.add('inWood', Bx(xS - xT - 0.3, H - 0.4, 0.1, (xT + xS) / 2, F + H / 2, zz, 1.3), [0.42, 0.22, 0.16]);   // Holzpaneele
  // ---- Orchestergraben mit Brüstung, Kapelle: Klavier, Kontrabass, Schlagzeug
  const px = rx0 + (rows - 1) * pitch + 0.5, pit0 = px, pit1 = xS - 0.3;
  K.add('varnish', Bx(pit1 - pit0, 0.1, Z1 - Z0 - 1, (pit0 + pit1) / 2, F + 0.05, cz, 1), [0.2, 0.1, 0.06]);
  K.add('varnish', Bx(0.12, 0.9, 12, pit0 + 0.06, F + 0.45, cz, 1), wood); K.add('gold', Bx(0.16, 0.05, 12.1, pit0 + 0.06, F + 0.92, cz, 1)); addCollider(pit0, F, cz - 6, pit0 + 0.12, F + 0.95, cz + 6);
  { const kx = pit0 + 1.6, kz = cz - 2.5;   // Klavier (aufrecht), Pianist
    tearWrap('metropol:klavier', { name: 'Klavier', m: 230, stuff: 'wood' }, () => { K.add('varnish', Bx(1.55, 1.32, 0.6, kx, F + 0.66, kz, 1), [0.08, 0.06, 0.05]); K.add('varnish', Bx(1.45, 0.08, 0.36, kx, F + 0.74, kz + 0.45, 1), [0.08, 0.06, 0.05]); K.add('cloth', Bx(1.3, 0.02, 0.16, kx, F + 0.79, kz + 0.52, 1), [0.95, 0.93, 0.86]); for (let k = 0; k < 18; k++) K.add('varnish', Bx(0.035, 0.025, 0.09, kx - 0.6 + k * 0.071, F + 0.805, kz + 0.49, 1), [0.03, 0.03, 0.03]); });
    addCollider(kx - 0.8, F, kz - 0.3, kx + 0.8, F + 1.35, kz + 0.3);
    placeFurn(FURN.barStool(), { up: 'leather', frame: 'gold' }, seatAdd, kx, F - 0.05, kz + 1.05);
    ped({ x: kx, y: F + 0.82, z: kz + 1.05, yaw: Math.PI, kind: 'tux', col: COL.tux, sit: true, act: 14.5, band: true });
    // Kontrabass mit Spieler
    const bxx = pit0 + 1.4, bz = cz + 1.2;
    tearWrap('metropol:bass', { name: 'Kontrabass', m: 12, stuff: 'wood' }, () => { K.add('varnish', lathe([[0.02, 0], [0.3, 0.2], [0.36, 0.5], [0.22, 0.75], [0.34, 1.05], [0.3, 1.25], [0.02, 1.3]], 14).scale(1, 1, 0.45).rotateZ(0.25).translate(bxx, F + 0.1, bz), [0.5, 0.26, 0.12]); K.add('varnish', new T.CylinderGeometry(0.03, 0.03, 0.9, 6).rotateZ(0.25).translate(bxx - 0.22, F + 1.7, bz), [0.1, 0.06, 0.04]); });
    ped({ x: bxx + 0.35, y: F, z: bz, yaw: Math.PI, kind: 'tux', col: COL.tux, act: 13.3, band: true });
    // Schlagzeug: große Trommel, kleine Trommel, Becken, Schlagzeuger
    const dx = pit0 + 1.5, dz = cz + 4.0;
    tearWrap('metropol:schlagzeug', { name: 'Schlagzeug', m: 25, stuff: 'metal' }, () => { K.add('cloth', new T.CylinderGeometry(0.34, 0.34, 0.4, 16).rotateX(Math.PI / 2).translate(dx, F + 0.36, dz), [0.9, 0.86, 0.75]); K.add('chrome', new T.CylinderGeometry(0.36, 0.36, 0.05, 16).rotateX(Math.PI / 2).translate(dx, F + 0.36, dz + 0.22)); K.add('cloth', new T.CylinderGeometry(0.18, 0.18, 0.14, 14).translate(dx + 0.45, F + 0.75, dz - 0.3), [0.92, 0.9, 0.84]); K.add('chrome', new T.CylinderGeometry(0.02, 0.02, 0.75, 6).translate(dx + 0.45, F + 0.37, dz - 0.3)); K.add('chrome', new T.CylinderGeometry(0.28, 0.28, 0.01, 18).translate(dx - 0.5, F + 1.2, dz - 0.2)); K.add('chrome', new T.CylinderGeometry(0.02, 0.02, 1.2, 6).translate(dx - 0.5, F + 0.6, dz - 0.2)); });
    placeFurn(FURN.barStool(), { up: 'leather', frame: 'gold' }, seatAdd, dx, F - 0.05, dz + 0.9);
    ped({ x: dx, y: F + 0.82, z: dz + 0.9, yaw: Math.PI, kind: 'tux', col: COL.tux, sit: true, act: 9.8, band: true });
    addLight(0xffc890, 1.2, 8, 1.8, pit0 + 1.5, F + 2.0, cz);
  }
  // ---- Bühne: Podium, Portal mit Sonnenfächer, Vorhang, Prospekt, Rampenlicht, Scheinwerfer
  const SY = F + 0.9, bw = Z1 - Z0 - 4.0; V.SY = SY;
  K.add('varnish', Bx(X1 - xS, SY - F, Z1 - Z0 - 1, (xS + X1) / 2, (F + SY) / 2, cz, 2), [0.3, 0.17, 0.09]); addCollider(xS, F, Z0 + 0.5, X1, SY, Z1 - 0.5);
  K.add('varnish', Bx(0.5, 0.06, Z1 - Z0 - 1, xS + 0.25, SY + 0.03, cz, 1), [0.5, 0.3, 0.15]);
  for (let u = -bw / 2 + 0.4; u < bw / 2; u += 0.8) { K.add('lit', new T.SphereGeometry(0.06, 8, 6, 0, 6.3, 0, 1.6).translate(xS + 0.15, SY + 0.04, cz + u), [2.0, 1.6, 0.9]); if (((u + bw / 2) / 0.8 | 0) % 3 === 0) addGlow(xS + 0.4, SY + 0.2, cz + u, [1.4, 1.1, 0.6], 0.8); }
  // Portal: Pfeiler, Sturz mit Fächer, goldene Rahmung; Decke der Bühne
  for (const s of [-1, 1]) { const pz = cz + s * (bw / 2 + 0.6); K.add('gold', Bx(1.2, H - 0.3, 1.2, xS + 0.6, F + (H - 0.3) / 2, pz, 1)); K.add('stone', Bx(1.0, H - 0.5, 1.0, xS + 0.6, F + (H - 0.5) / 2, pz, 1), [0.3, 0.26, 0.24]); for (let k = 0; k < 3; k++) K.add('gold', Bx(0.1, H - 1.0, 0.1, xS + 0.1, F + (H - 1) / 2 + 0.3, pz - s * (0.35 - k * 0.3), 1)); addCollider(xS, F, pz - 0.6, xS + 1.2, F + H, pz + 0.6); }
  K.add('gold', Bx(1.2, 1.4, bw + 2.4, xS + 0.6, F + H - 0.9, cz, 1)); K.add('stone', Bx(1.0, 1.2, bw + 2.2, xS + 0.6, F + H - 0.9, cz, 1), [0.3, 0.26, 0.24]);
  for (let k = 0; k < 15; k++) { const a = Math.PI + (k - 7) * 0.2; K.add('gold', new T.BoxGeometry(0.1, 2.6, 0.08).rotateX(a - Math.PI).translate(xS + 0.02, F + H - 1.6 + Math.cos(a - Math.PI) * 1.3 - 1.3, cz + Math.sin(a - Math.PI) * 1.3)); }
  K.add('ceil', Bx(X1 - xS - 0.6, 0.2, Z1 - Z0 - 0.8, (xS + X1) / 2, F + HS - 0.6, cz), [0.2, 0.18, 0.18]);
  // Vorhang: oben Lambrequin, seitlich gerafft (gefaltete Bahnen)
  K.add('cloth', Bx(0.5, 1.6, bw, xS + 1.2, F + H - 2.1, cz, 1), red); K.add('gold', Bx(0.55, 0.08, bw, xS + 1.2, F + H - 2.9, cz, 1));
  for (let k = 0; k < 16; k++) K.add('cloth', new T.CylinderGeometry(0.1, 0.1, 1.5, 6).translate(xS + 1.0, F + H - 2.1, cz - bw / 2 + 0.3 + k * (bw - 0.6) / 15), red.map(v => v * (0.75 + 0.3 * (k % 2))));
  for (const s of [-1, 1]) for (let k = 0; k < 6; k++) { const zz = cz + s * (bw / 2 - 0.3 - k * 0.25); K.add('cloth', new T.CylinderGeometry(0.11, 0.16, H - 3.2, 7).translate(xS + 1.3 + k * 0.1, SY + (H - 3.2) / 2 - 0.3, zz), red.map(v => v * (0.8 + 0.3 * (k % 2)))); }
  for (const s of [-1, 1]) K.add('gold', new T.TorusGeometry(0.4, 0.05, 6, 16).rotateY(Math.PI / 2).translate(xS + 1.6, SY + 2.2, cz + s * (bw / 2 - 1.0)));
  // Prospekt: gemalte Nacht über Vespera (Sonnenfächer, Türme, Mond, Polarlicht)
  const back = canvasTex(1024, 384, (g, W, Hh) => {
    const sky = g.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, '#0a1430'); sky.addColorStop(0.6, '#133a46'); sky.addColorStop(1, '#0a1a22'); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = 'rgba(80,220,200,0.18)'; g.lineWidth = 18; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(0, 60 + k * 22); g.bezierCurveTo(W * 0.3, 20 + k * 30, W * 0.6, 110 + k * 10, W, 40 + k * 26); g.stroke(); }
    g.strokeStyle = 'rgba(246,210,122,0.5)'; g.lineWidth = 3; for (let k = 0; k < 24; k++) { const a = Math.PI + k / 23 * Math.PI; g.beginPath(); g.moveTo(W / 2, Hh); g.lineTo(W / 2 + Math.cos(a) * 700, Hh + Math.sin(a) * 700); g.stroke(); }
    g.fillStyle = '#f2e8c0'; g.beginPath(); g.arc(W * 0.78, 80, 34, 0, 7); g.fill(); g.fillStyle = '#0a1430'; g.beginPath(); g.arc(W * 0.78 + 16, 72, 30, 0, 7); g.fill();
    for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(255,255,230,' + (0.3 + (k % 5) * 0.14) + ')'; g.fillRect((k * 137) % W, (k * 71) % 150, 2, 2); }
    g.fillStyle = '#06101a'; const tw = [60, 40, 90, 50, 140, 70, 46, 110, 60, 80, 48, 120, 64, 42, 96];
    let x = 0; tw.forEach((h, i) => { const w = 40 + (i % 3) * 22; const hh = i === 7 ? 300 : 90 + h; g.fillRect(x, Hh - hh, w, hh); if (i === 7) { g.fillRect(x + w / 2 - 6, Hh - hh - 40, 12, 40); } g.fillStyle = '#e8c070'; for (let yy = Hh - hh + 10; yy < Hh - 8; yy += 12) for (let xx = x + 6; xx < x + w - 6; xx += 10) if ((xx * 7 + yy * 3) % 5 < 3) g.fillRect(xx, yy, 4, 6); g.fillStyle = '#06101a'; x += w + 8; });
  });
  { const m = new T.Mesh(new T.PlaneGeometry(bw - 1, H - 2.4), new T.MeshBasicMaterial({ map: back, color: 0xc0b8a8 })); m.position.set(xB - 0.6, SY + (H - 2.4) / 2 + 0.2, cz); m.rotation.y = -Math.PI / 2; scene.add(m); addCollider(xB - 0.9, F, Z0 + 0.5, X1, F + HS, Z1 - 0.5); }
  // Scheinwerfer: zwei warme Lichter auf die Tänzerinnen, Glühen am Portal
  addLight(0xffe0b0, 3.0, 22, 1.4, xS + 5, SY + 6.5, cz - 3); addLight(0xffd0a0, 3.0, 22, 1.4, xS + 5, SY + 6.5, cz + 3);
  for (const s of [-1, 1]) { K.add('iron', new T.CylinderGeometry(0.12, 0.2, 0.5, 10).rotateX(Math.PI / 2 + 0.4 * s).translate(xS - 1.0, F + H - 0.6, cz + s * 5), [0.15, 0.15, 0.16]); addGlow(xS - 1.0, F + H - 0.7, cz + s * 5, [1.4, 1.2, 0.8], 1.0); }
  // ---- Die Nummer: sechs Girls in Flapperkleidern, Charleston im Gleichschritt; Conférencier am Bühnenrand
  V.dancers = []; const danceX = xS + 6.0;
  for (let k = 0; k < 6; k++) { const z = cz - 4.5 + k * 1.8; const pd = ped({ x: danceX, y: SY, z, yaw: -Math.PI / 2, kind: 'flapper', col: k % 2 ? [0.92, 0.82, 0.5] : [0.05, 0.05, 0.08], sc: 0.97, act: 22, dancer: true, busy: true }); V.dancers.push(pd); }
  V.mc = ped({ x: xS + 2.2, y: SY, z: cz + 8.5, yaw: -Math.PI / 2 - 0.3, kind: 'tux', col: COL.tux, act: 2.3, busy: true, mc: true });
  tearWrap('metropol:mikro', { name: 'Mikrofonständer', m: 6, stuff: 'metal' }, () => { K.add('chrome', new T.CylinderGeometry(0.015, 0.015, 1.4, 6).translate(xS + 1.6, SY + 0.7, cz + 8.5)); K.add('chrome', new T.CylinderGeometry(0.15, 0.15, 0.02, 10).translate(xS + 1.6, SY + 0.01, cz + 8.5)); K.add('iron', new T.CylinderGeometry(0.05, 0.04, 0.16, 8).rotateX(1.2).translate(xS + 1.55, SY + 1.42, cz + 8.5), [0.5, 0.5, 0.52]); });
  // Platzanweiserin (Kellnerin des Theaters): wartet an der Landung, bringt Sekt und Programm an den Platz
  const wt = { st: 4, x: V.station.x, y: LY, z: V.station.z, yaw: 0, sc: 1, v: 0, kind: 'dress', col: [0.3, 0.08, 0.1], act: 12.5, waiter: true, path: [], wait: 3, carry: null, target: null };
  V.waiters.push(wt); VENUE_PEDS.push(wt); V.staff.push(wt);
  V.pathFn = (from, to) => {
    const az = to.z < cz - 6 ? V.aisles[0] : to.z > cz + 6 ? V.aisles[2] : V.aisles[1];
    return [[from.x, from.z], [from.x, az], [to.x, az], [to.x, to.z]];   // Landung -> Gang -> Lücke hinter der Reihe -> Platz
  };
  V.dishes = new T.Group(); scene.add(V.dishes); V.dishes.visible = false;
  // Türsteher draußen, Paar vor den Plakaten
  ped({ x: X0 - 1.3, y: Y0, z: cz - 3.0, yaw: -Math.PI / 2, kind: 'livery', act: 36.4 });
  ped({ x: X0 - 2.0, y: Y0, z: cz + 5.3, yaw: Math.PI / 2 + 0.3, kind: 'suit', col: COATS[2], act: 31.4 }); ped({ x: X0 - 2.3, y: Y0, z: cz + 6.1, yaw: Math.PI / 2 - 0.2, kind: 'lady', col: COATS[5], act: 0.8, sc: 0.95 });
  K.build(scene);
  V.inside = (x, z, y) => x > X0 && x < X1 && z > Z0 && z < Z1 && y < F + HS;
  V.inHall = (x, z, y) => x > xT && x < xS + 1 && z > Z0 && z < Z1 && y < F + H;
  return V;
}

/* =====================================================================
   VESPERA-BANK
   ===================================================================== */
function buildBank(b, rr) {
  const X1 = b.x1 - 4.5, X0 = X1 - 33, Z1 = -20 + (b.z1 + 7), Z0 = Z1 - 38, cz = Z1 - 14, F = Y0 + 1.0;   // Halle z Z1-28..Z1, Tresorflügel dahinter (Nord)
  const K = kit({ marble: marble() }), cols = [], H = 9.0;
  clearRect(X0 - 3, Z0 - 3, X1 + 6, Z1 + 3);
  const stone = [0.8, 0.78, 0.72], dark = [0.55, 0.52, 0.48], wood = [0.34, 0.18, 0.1];
  const hz0 = Z1 - 28, hz1 = Z1;   // Halle (Außenmaß)
  const Bk = ORTE.bank = { x0: X0, x1: X1, z0: Z0, z1: Z1, F, H, cz };
  const vx0 = X0 + 10, vx1 = X1 - 8, vz0 = Z0 + 0.6, vz1 = hz0 - 0.6, vcx = (vx0 + vx1) / 2, vcz = (vz0 + vz1) / 2, dz = hz0, dxw = vcx;   // Tresorraum, Tür bei x = vcx in der Nordwand der Halle
  // Podium mit Freitreppe zur Avenue (Ost)
  K.add('stone', Bx(X1 - X0, F - Y0, Z1 - Z0, (X0 + X1) / 2, (Y0 + F) / 2, (Z0 + Z1) / 2, 3), dark); addCollider(X0, 0, Z0, X1, F, Z1);
  const ns = 6; for (let k = 0; k < ns; k++) { const w = 16 - k * 0.3, x = X1 + 0.5 + k * 0.42, y1 = F - k * (F - Y0) / ns; K.add('stone', Bx(0.42, y1 - Y0, w, x, (Y0 + y1) / 2, cz, 2), dark); addCollider(x - 0.21, 0, cz - w / 2, x + 0.21, y1, cz + w / 2); }
  // ---- Mauern: Halle 10 m, Tresorflügel 6 m; Tempelfront mit Säulen, Gebälk, Attika mit Uhr
  const outer = (ax, az, bx, bz, h, o = {}) => wallRun(K, cols, ax, az, bx, bz, F, h, { outK: 'stone', outC: stone, inK: 'marble', inC: [0.92, 0.9, 0.86], th: 0.6, ...o });
  outer(X1, hz1, X1, cz + 2.3, H + 1.0, { windows: false }); outer(X1, cz - 2.3, X1, hz0, H + 1.0, { windows: false });   // Front (Ost) mit 4,6 m breitem Bronzeportal
  K.add('stone', Bx(0.6, H + 1.0 - 6.3, 4.6, X1, F + 6.3 + (H + 1.0 - 6.3) / 2, cz, 2), stone); addCollider(X1 - 0.3, F + 6.3, cz - 2.3, X1 + 0.3, F + H + 1, cz + 2.3);
  outer(X0, hz1, X1, hz1, H + 1.0, { sill: 2.6, head: H - 1.2, win: 2.4, post: 1.2 });   // Süd: hohe Fenster
  outer(X0, hz0, X0, hz1, H + 1.0, { windows: false });                                   // West (hinter den Schaltern)
  outer(X1, hz0, vcx + 1.3, hz0, H + 1.0, { windows: false }); outer(vcx - 1.3, hz0, X0, hz0, H + 1.0, { windows: false });   // Nord mit Tresordurchgang
  K.add('stone', Bx(2.6, H + 1.0 - 3.3, 0.6, vcx, F + 3.3 + (H + 1.0 - 3.3) / 2, hz0, 2), stone); addCollider(vcx - 1.3, F + 3.3, hz0 - 0.3, vcx + 1.3, F + H + 1, hz0 + 0.3);
  outer(X0, Z0, X0, hz0, 6.5, { windows: false }); outer(X1, Z0, X0, Z0, 6.5, { windows: false }); outer(X1, hz0, X1, Z0, 6.5, { windows: false });   // Tresorflügel
  for (const c of cols) addCollider(c.x0, c.y0, c.z0, c.x1, c.y1, c.z1);
  K.add('stone', Bx(X1 - X0 + 0.8, 0.6, hz1 - hz0 + 0.8, (X0 + X1) / 2, F + H + 1.3, cz, 3), stone.map(v => v * 1.05)); roofSlab((X0 + X1) / 2, cz, X1 - X0, hz1 - hz0, F + H + 1.6, 5841);
  K.add('stone', Bx(X1 - X0 + 0.6, 0.5, hz0 - Z0 + 0.6, (X0 + X1) / 2, F + 6.75, (Z0 + hz0) / 2, 3), stone); roofSlab((X0 + X1) / 2, (Z0 + hz0) / 2, X1 - X0, hz0 - Z0, F + 7.0, 5842);
  // Säulenhalle vor der Front
  for (let k = 0; k < 6; k++) column(K, X1 + 1.8, F, cz - 12.5 + k * 5, H + 0.6, 0.55, stone.map(v => v * 1.08));
  for (let k = 0; k < 6; k++) addCollider(X1 + 1.1, F, cz - 12.5 + k * 5 - 0.7, X1 + 2.5, F + H, cz - 12.5 + k * 5 + 0.7);
  for (let k = 0; k < 6; k++) { const z = cz - 12.5 + k * 5; K.add('lit', Bx(0.5, 0.1, 0.5, X1 + 2.7, F + 0.05, z, 1), [1.5, 1.25, 0.8]); addGlow(X1 + 2.7, F + 0.4, z, [1.3, 1.1, 0.7], 1.5); }   // Bodenstrahler vor jeder Säule
  addLight(0xffe0b0, 1.6, 20, 1.3, X1 + 3.5, F + 4.5, cz - 8); addLight(0xffe0b0, 1.6, 20, 1.3, X1 + 3.5, F + 4.5, cz + 8);   // die Tempelfront angestrahlt
  K.add('stone', Bx(3.4, 1.6, 30, X1 + 1.1, F + H + 1.4, cz, 3), stone.map(v => v * 1.05)); K.add('gold', Bx(3.5, 0.08, 30.1, X1 + 1.1, F + H + 0.64, cz, 1)); K.add('gold', Bx(3.5, 0.08, 30.1, X1 + 1.1, F + H + 2.16, cz, 1));
  K.add('stone', Bx(3.4, 0.3, 30.4, X1 + 1.1, F + H + 2.35, cz, 3), stone);
  { const sg = signBoard('VESPERA-BANK', 12, 1.1, '#ffd98a', '#2a2622'); sg.position.set(X1 + 2.82, F + H + 1.4, cz); sg.rotation.y = Math.PI / 2; scene.add(sg); addNeon(X1 + 2.8, F + H + 2.0, cz, 0.05, 0.05, 12.4, NEON.gold); }
  // Attika mit Uhr (Zifferblatt gezeichnet), Stufen, Goldkugel
  for (const [w, h] of [[20, 1.2], [12, 1.6], [6, 2.2]]) K.add('stone', Bx(2.6, h, w, X1 - 0.6, F + H + 2.5 + h / 2, cz, 2), stone);
  const clock = canvasTex(256, 256, (g, W) => { g.fillStyle = '#f2ead8'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.fill(); g.strokeStyle = '#2a2420'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 116, 0, 7); g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; g.fillStyle = '#2a2420'; g.fillRect(0, 0, 0, 0); g.beginPath(); g.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); g.lineTo(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 112); g.lineWidth = k % 3 ? 4 : 8; g.stroke(); } g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 60 * Math.cos(-1.05), 128 + 60 * Math.sin(-1.05)); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 95 * Math.cos(1.57 + 1.2), 128 + 95 * Math.sin(1.57 + 1.2)); g.stroke(); });
  { const m = new T.Mesh(new T.CircleGeometry(1.6, 32), new T.MeshBasicMaterial({ map: clock, color: 0xd8d0c0 })); m.position.set(X1 + 0.72, F + H + 4.4, cz); m.rotation.y = Math.PI / 2; scene.add(m); K.add('gold', new T.TorusGeometry(1.62, 0.07, 8, 40).rotateY(Math.PI / 2).translate(X1 + 0.7, F + H + 4.4, cz)); addGlow(X1 + 1.1, F + H + 4.4, cz, [1.3, 1.1, 0.8], 1.6); }
  K.add('gold', new T.SphereGeometry(0.5, 12, 8).translate(X1 - 0.6, F + H + 8.1, cz));
  // Bronzeportal: zwei offene Türflügel, Oberlicht mit Fächer, Laternen
  for (const s of [-1, 1]) { K.add('gold', Bx(0.1, 4.4, 1.9, X1 + 0.45, F + 2.2, cz + s * 3.05, 1), [0.6, 0.45, 0.2]); for (let k = 0; k < 3; k++) K.add('gold', Bx(0.14, 0.5, 1.3, X1 + 0.5, F + 0.9 + k * 1.4, cz + s * 3.05, 1), [0.75, 0.56, 0.25]); addCollider(X1 + 0.35, F, cz + s * 3.05 - 0.95, X1 + 0.55, F + 4.4, cz + s * 3.05 + 0.95); }
  K.add('gold', Bx(0.12, 0.3, 4.6, X1 + 0.3, F + 4.55, cz, 1), [0.6, 0.45, 0.2]); K.add('lit', new T.PlaneGeometry(4.3, 1.5).rotateY(Math.PI / 2).translate(X1 + 0.32, F + 5.5, cz), [1.3, 1.0, 0.55]);
  for (let k = -3; k <= 3; k++) K.add('gold', Bx(0.16, 1.6, 0.06, X1 + 0.3, F + 5.5, cz + k * 0.6, 1), [0.6, 0.45, 0.2]);
  for (const s of [-1, 1]) { K.add('gold', lathe([[0.2, 0], [0.25, 0.1], [0.16, 0.2], [0.16, 0.9], [0.3, 1.0], [0.3, 1.35], [0.05, 1.5]], 8).translate(X1 + 0.9, F + 2.9, cz + s * 3.4)); K.add('lit', new T.CylinderGeometry(0.2, 0.17, 0.5, 8).translate(X1 + 0.9, F + 3.5, cz + s * 3.4), [1.8, 1.3, 0.7]); addGlow(X1 + 1.1, F + 3.5, cz + s * 3.4, [1.4, 1.0, 0.5], 1.1); }
  addLight(0xffd8a0, 2.0, 14, 1.5, X1 + 1.5, F + 5, cz);
  for (const s of [-1, 1]) lamps.push({ x: X1 + 4.0, z: cz + s * 10, h: 4.4 });
  DOORS.push({ x: X1 + 0.6, z: cz, nx: 1, nz: 0, kind: 'hotel' });
  // ---- Schalterhalle: Marmorboden im Schachbrett, Kassettendecke, Pilaster, Kronleuchter, Uhr
  const ix0 = X0 + 0.6, ix1 = X1 - 0.6, iz0 = hz0 + 0.6, iz1 = hz1 - 0.6, hx = (ix0 + ix1) / 2;
  K.add('marble', Bx(ix1 - ix0, 0.04, iz1 - iz0, hx, F + 0.02, cz, 2), [0.9, 0.88, 0.84]);
  for (let x = ix0 + 1; x < ix1 - 0.5; x += 2) for (let z = iz0 + 1; z < iz1 - 0.5; z += 2) if (((x + z) / 2 | 0) % 2 === 0) K.add('marble', Bx(1.9, 0.05, 1.9, x + 0.5, F + 0.025, z + 0.5, 2), [0.22, 0.2, 0.2]);
  K.add('ceil', Bx(ix1 - ix0, 0.2, iz1 - iz0, hx, F + H - 0.1, cz), [1, 1, 1]);
  for (let x = ix0 + 2; x < ix1; x += 4) K.add('gold', Bx(0.14, 0.3, iz1 - iz0, x, F + H - 0.2, cz, 1)); for (let z = iz0 + 2; z < iz1; z += 4) K.add('gold', Bx(ix1 - ix0, 0.3, 0.14, hx, F + H - 0.2, z, 1));
  for (let x = ix0 + 4; x < ix1 - 1; x += 4) for (let z = iz0 + 4; z < iz1 - 1; z += 4) { K.add('lit', Bx(0.6, 0.04, 0.6, x, F + H - 0.33, z), [1.2, 1.0, 0.75]); }
  chandelier(K, hx - 6, F + H - 1.2, cz, 1.4); chandelier(K, hx + 6, F + H - 1.2, cz, 1.4);
  addLight(0xffe4c0, 1.5, 24, 1.4, hx - 6, F + H - 2.4, cz, true); addLight(0xffe4c0, 1.5, 24, 1.4, hx + 6, F + H - 2.4, cz, true);   // warmes Licht unter den Kronleuchtern
  for (const zz of [iz0, iz1]) for (let x = ix0 + 3; x < ix1 - 1; x += 5) { K.add('marble', Bx(0.9, H - 0.3, 0.4, x, F + (H - 0.3) / 2, zz + (zz < cz ? 0.2 : -0.2), 1), [0.86, 0.84, 0.8]); K.add('gold', Bx(1.0, 0.5, 0.5, x, F + H - 0.6, zz + (zz < cz ? 0.2 : -0.2), 1)); sconce(K, x + 2.5, F + 3.2, zz, 0, zz < cz ? 1 : -1); }
  K.add('gold', Bx(ix1 - ix0, 0.08, 0.08, hx, F + 1.1, iz0 + 0.05, 1)); K.add('gold', Bx(ix1 - ix0, 0.08, 0.08, hx, F + 1.1, iz1 - 0.05, 1));
  { const m = new T.Mesh(new T.CircleGeometry(0.9, 32), new T.MeshBasicMaterial({ map: clock, color: 0xd8d0c0 })); m.position.set(ix0 + 0.06, F + 6.2, cz); m.rotation.y = Math.PI / 2; scene.add(m); K.add('gold', new T.TorusGeometry(0.92, 0.05, 8, 40).rotateY(Math.PI / 2).translate(ix0 + 0.05, F + 6.2, cz)); }
  { const sg = signBoard('VESPERA-BANK · GEGRÜNDET VON ALEXANDER', 9, 0.6, '#f2d08a', '#1e1a18'); sg.position.set(ix0 + 0.06, F + 7.6, cz); sg.rotation.y = Math.PI / 2; scene.add(sg); }
  // Schalter an der Westwand: Mahagonitheke, Marmorplatte, Messinggitter, fünf Fenster mit Schildern
  const sx = ix0 + 3.6, sz0 = cz - 11, sz1 = cz + 11;
  K.add('varnish', Bx(0.9, 1.1, sz1 - sz0, sx, F + 0.55, cz, 1), wood); K.add('marble', Bx(1.1, 0.06, sz1 - sz0 + 0.1, sx, F + 1.13, cz, 1), [0.9, 0.88, 0.84]); addCollider(sx - 0.55, F, sz0, sx + 0.55, F + 1.16, sz1);
  K.add('gold', Bx(0.05, 2.2, sz1 - sz0, sx + 0.1, F + 1.16 + 1.1, cz, 1)); K.add('gold', Bx(0.08, 0.1, sz1 - sz0 + 0.1, sx + 0.1, F + 3.35, cz, 1));
  // die Wand aus Messinggittern: feine Stäbe, dazwischen die fünf Schalteröffnungen
  const win = []; for (let k = 0; k < 5; k++) win.push(sz0 + 2.2 + k * 4.4);
  for (let z = sz0 + 0.1; z < sz1; z += 0.12) { const open = win.some(w => Math.abs(z - w) < 0.8); K.add('gold', Bx(0.02, open ? 0.9 : 2.1, 0.02, sx + 0.1, open ? F + 1.16 + 1.65 : F + 1.16 + 1.05, z, 1)); }
  win.forEach((w, k) => { K.add('gold', Bx(0.06, 0.06, 1.7, sx + 0.1, F + 2.25, w, 1)); K.add('marble', Bx(0.5, 0.04, 1.5, sx + 0.3, F + 1.17, w, 1), [0.9, 0.88, 0.84]); const sg = signBoard('KASSE ' + (k + 1), 1.2, 0.26, '#f2d08a', '#1e1a18'); sg.position.set(sx + 0.14, F + 2.5, w); sg.rotation.y = Math.PI / 2; scene.add(sg); addCollider(sx - 0.1, F + 1.16, w - 2.2, sx + 0.2, F + 3.4, w - 0.8); addCollider(sx - 0.1, F + 1.16, w + 0.8, sx + 0.2, F + 3.4, w + 2.2); });
  addCollider(sx - 0.1, F + 1.16, sz0, sx + 0.2, F + 3.4, sz0 + 1.4); addCollider(sx - 0.1, F + 1.16, sz1 - 1.4, sx + 0.2, F + 3.4, sz1);
  // Schreibtische der Kassierer hinter der Theke, Aktenregal an der Westwand, Kassierer, Schreibkraft an der Schreibmaschine
  for (const w of win) { K.add('varnish', Bx(1.2, 0.76, 0.7, sx - 1.6, F + 0.38, w, 1), wood); K.add('gold', lathe([[0.08, 0], [0.03, 0.03], [0.02, 0.4], [0.12, 0.42], [0.1, 0.52]], 8).translate(sx - 1.3, F + 0.76, w + 0.25)); K.add('lit', new T.SphereGeometry(0.06, 8, 6).translate(sx - 1.3, F + 1.2, w + 0.25), [1.6, 1.3, 0.7]); addGlow(sx - 1.3, F + 1.25, w + 0.25, [1.3, 1.0, 0.5], 0.5); }
  for (let z = sz0 + 1; z < sz1; z += 1.2) for (const yy of [0.4, 0.9, 1.4, 1.9, 2.4]) { K.add('varnish', Bx(0.4, 0.04, 1.1, ix0 + 0.3, F + yy, z, 1), wood); for (let k = 0; k < 6; k++) if (rr() < 0.8) K.add('cloth', Bx(0.32, 0.26, 0.15, ix0 + 0.3, F + yy + 0.15, z - 0.45 + k * 0.18, 1), pk(rr, [[0.6, 0.5, 0.35], [0.35, 0.3, 0.22], [0.5, 0.2, 0.15], [0.25, 0.3, 0.4]])); }
  addCollider(ix0, F, sz0 - 1, ix0 + 0.5, F + 2.6, sz1 + 1);
  win.forEach((w, k) => { ped({ x: sx - 0.85, y: F, z: w, yaw: Math.PI / 2, kind: 'suit', col: COATS[3], act: k % 2 ? 28.2 : 31.1, busy: true, sc: 0.96 + rr() * 0.06 }); });
  { const tx = sx - 3.0, tz = cz + 6; K.add('varnish', Bx(1.4, 0.76, 0.8, tx, F + 0.38, tz, 1), wood); placeFurn(FURN.diningChair(), { up: 'leather', wood: 'varnish' }, (k, g) => K.add(k, g, k === 'leather' ? [0.3, 0.15, 0.1] : [0.2, 0.1, 0.06]), tx + 0.75, F, tz, Math.PI / 2); ped({ x: tx + 0.75, y: F + 0.48, z: tz, yaw: -Math.PI / 2, kind: 'dress', col: DRESSES[3], sit: true, act: 14.5, busy: true }); ORTE.spawns.push({ x: tx, z: tz, items: [['typewriter', tx - 0.1, tz, Math.PI / 2, 0.76], ['papers', tx + 0.1, tz + 0.3, 0.3, 0.76]], y: F + 2, floor: F }); }
  // Kundschaft an den Schaltern und in der Schlange, am Stehpult, auf der Bank; Wachmann an der Tür, Direktor
  win.forEach((w, k) => { if (k === 1) return; ped({ x: sx + 1.1, y: F, z: w, yaw: -Math.PI / 2, kind: pk(rr, ['suit', 'coat', 'lady', 'dbl', 'furcoat']), col: pk(rr, COATS), act: k === 2 ? 0.7 : 31.1 + rr() * 0.4, sc: 0.94 + rr() * 0.1 }); if (k === 2) for (let q = 1; q <= 2; q++) ped({ x: sx + 1.1 + q * 1.0, y: F, z: w + (rr() - 0.5) * 0.3, yaw: -Math.PI / 2, kind: pk(rr, ['suit', 'coat', 'lady']), col: pk(rr, COATS), act: q === 1 ? 31.4 : 12.2, sc: 0.95 + rr() * 0.08 }); });
  for (const [dx, dz] of [[-2, -4], [-2, 4], [4, 0]]) { const px = hx + dx, pz = cz + dz; tearWrap('bank:pult:' + dx + ',' + dz, { name: 'Stehpult', m: 45, stuff: 'wood' }, () => { K.add('varnish', Bx(1.3, 0.08, 0.7, px, F + 1.05, pz, 1).rotateX(0), wood); K.add('varnish', Bx(0.5, 1.0, 0.5, px, F + 0.5, pz, 1), wood); K.add('gold', Bx(1.32, 0.04, 0.72, px, F + 1.1, pz, 1)); K.add('gold', lathe([[0.08, 0], [0.03, 0.03], [0.02, 0.35], [0.12, 0.37], [0.1, 0.45]], 8).translate(px + 0.45, F + 1.12, pz - 0.2)); K.add('lit', new T.SphereGeometry(0.05, 8, 6).translate(px + 0.45, F + 1.5, pz - 0.2), [1.6, 1.3, 0.7]); }); addGlow(px + 0.45, F + 1.55, pz - 0.2, [1.3, 1.0, 0.5], 0.45); addCollider(px - 0.66, F, pz - 0.36, px + 0.66, F + 1.1, pz + 0.36);
    if (rr() < 0.8) ped({ x: px, y: F, z: pz + 0.75, yaw: Math.PI, kind: pk(rr, ['suit', 'coat', 'dbl']), col: pk(rr, COATS), act: 28.4, sc: 0.95 + rr() * 0.08 });
    ORTE.spawns.push({ x: px, z: pz, items: [['book', px - 0.3, pz + 0.1, 0.2, 1.1], ['papers', px + 0.1, pz + 0.05, 0.9, 1.1]], y: F + 2, floor: F }); }
  for (const zz of [iz1 - 1.2]) for (const bxp of [hx - 7, hx + 7]) { tearWrap('bank:bank:' + bxp.toFixed(0), { name: 'Wartebank', m: 60, stuff: 'wood', seat: true }, () => benchGeo(K, 2.6, bxp, F, zz, 0, 'varnish')); addCollider(bxp - 1.3, F, zz - 0.3, bxp + 1.3, F + 0.9, zz + 0.3); if (rr() < 0.8) ped({ x: bxp - 0.6, y: F + 0.47, z: zz - 0.05, yaw: 0, kind: pk(rr, ['coat', 'lady', 'suit']), col: pk(rr, COATS), sit: true, act: rr() < 0.5 ? 7.1 : 7.8, sc: 0.95 + rr() * 0.08 }); if (rr() < 0.6) ped({ x: bxp + 0.6, y: F + 0.47, z: zz - 0.05, yaw: 0, kind: 'dress', col: pk(rr, DRESSES), sit: true, act: 7.8, sc: 0.95 }); }
  ped({ x: ix1 - 2.0, y: F, z: cz + 4.2, yaw: Math.PI / 2 + 0.6, kind: 'police', col: [0.1, 0.1, 0.14], act: 36.3, busy: true, guard: true });
  ped({ x: hx + 8.5, y: F, z: cz - 5.5, yaw: Math.PI / 2 - 0.4, kind: 'tux', col: COL.tux, act: 0.8, director: true });
  // Palmen, Schirmständer, Papierkörbe
  for (const [x, z] of [[ix1 - 1.2, iz0 + 1.2], [ix1 - 1.2, iz1 - 1.2]]) tearWrap('bank:palme:' + z.toFixed(0), { name: 'Palme', m: 30, stuff: 'metal' }, () => placeFurn(FURN.vasePlant(1.5), { up: 'cloth', frame: 'gold', leaf: 'cloth' }, (k, g) => K.add(k, g, k === 'cloth' ? [0.15, 0.4, 0.2] : [1, 1, 1]), x, F, z));
  ORTE.spawns.push({ x: ix1 - 2, z: cz, items: [['umbrellastand', ix1 - 1.0, cz + 6.5, 0], ['dustbin', ix1 - 1.0, cz - 6.5, 0], ['signboard', ix1 - 3, cz - 2.5, 1.2]], y: F + 2, floor: F });
  addLight(0xfff0d0, 2.0, 18, 1.5, hx, F + 5, cz);
  // ---- Tresorraum im Nordflügel: Durchgang hinter dem Schalter (Nordwand der Halle), runde Stahltür, Schließfächer, Goldbarren
  // Rahmen des Tresoreingangs (Stahl), Schild, Schwelle
  K.add('chrome', Bx(0.5, 3.3, 0.7, dxw - 1.55, F + 1.65, dz, 1), [0.7, 0.72, 0.75]); K.add('chrome', Bx(0.5, 3.3, 0.7, dxw + 1.55, F + 1.65, dz, 1), [0.7, 0.72, 0.75]); K.add('chrome', Bx(3.6, 0.4, 0.7, dxw, F + 3.5, dz, 1), [0.7, 0.72, 0.75]);
  K.add('marble', Bx(2.6, 0.04, 1.2, dxw, F + 0.02, dz, 1), [0.9, 0.88, 0.84]);
  { const sg = signBoard('TRESOR', 1.6, 0.3, '#f2d08a', '#1e1a18'); sg.position.set(dxw, F + 3.5, dz + 0.36); scene.add(sg); }
  // die runde Tresortür: dicke Scheibe mit Speichenrad und Riegeln, um 70° nach innen aufgeschwenkt (Angel an der Westkante des Durchgangs)
  { const hx0 = dxw - 1.3, hzh = dz - 0.35, a = 1.22, Dm = g => g.rotateY(a).translate(hx0, F + 1.6, hzh);
    tearWrap('bank:tresortuer', { name: 'Tresortür', m: 1800, stuff: 'metal' }, () => {
      K.add('chrome', Dm(new T.CylinderGeometry(1.05, 1.05, 0.5, 28).rotateX(Math.PI / 2).translate(1.05, 0, 0)), [0.72, 0.74, 0.78]);
      K.add('iron', Dm(new T.TorusGeometry(0.42, 0.04, 8, 24).translate(1.05, 0, 0.3)), [0.3, 0.3, 0.32]);
      for (let k = 0; k < 4; k++) K.add('iron', Dm(new T.BoxGeometry(0.84, 0.05, 0.05).rotateZ(k * Math.PI / 4).translate(1.05, 0, 0.3)), [0.3, 0.3, 0.32]);
      for (let k = 0; k < 8; k++) { const b2 = k / 8 * 6.283; K.add('chrome', Dm(new T.CylinderGeometry(0.07, 0.07, 0.36, 8).rotateZ(Math.PI / 2 + b2).translate(1.05 + Math.cos(b2) * 1.1, Math.sin(b2) * 1.1, 0)), [0.8, 0.82, 0.86]); }
    });
    const cxd = hx0 + Math.cos(a) * 1.05, czd = hzh - Math.sin(a) * 1.05; addCollider(cxd - 0.9, F, czd - 0.5, cxd + 0.9, F + 2.7, czd + 0.5);
    for (const yy of [0.5, 2.7]) K.add('iron', new T.CylinderGeometry(0.1, 0.1, 0.5, 8).translate(hx0, F + yy, hzh), [0.25, 0.25, 0.27]);
  }
  // Raum: Stahlboden, Schließfachwände (gezeichnet), Decke, Tisch mit Barren, Rollwagen, Deckenlampen
  K.add('paint', Bx(vx1 - vx0, 0.04, vz1 - vz0, vcx, F + 0.02, vcz, 1.4), [0.55, 0.56, 0.6]);
  K.add('ceil', Bx(vx1 - vx0, 0.2, vz1 - vz0, vcx, F + 4.4, vcz), [0.6, 0.6, 0.62]);
  const boxes = canvasTex(512, 256, (g, W, Hh) => { g.fillStyle = '#2a2622'; g.fillRect(0, 0, W, Hh); for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) { const x = i * 32 + 2, y = j * 32 + 2; g.fillStyle = (i + j) % 2 ? '#b08a4a' : '#a8843f'; g.fillRect(x, y, 28, 28); g.fillStyle = '#6a5020'; g.fillRect(x + 4, y + 4, 20, 2); g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(x + 14, y + 17, 3, 0, 7); g.fill(); g.fillStyle = '#e8d8a0'; g.font = '7px Georgia'; g.fillText(String(j * 16 + i + 1), x + 5, y + 26); } });
  boxes.wrapS = boxes.wrapT = T.RepeatWrapping;
  const boxM = new T.MeshStandardMaterial({ map: boxes, metalness: 0.7, roughness: 0.35, emissive: 0xffffff, emissiveMap: boxes, emissiveIntensity: 0.25 });
  const wallBox = (w, h, x, y, z, ry) => { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * h / 2); const m = new T.Mesh(g, boxM); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); };
  wallBox(vz1 - vz0 - 0.4, 3.6, vx0 + 0.05, F + 2.0, vcz, Math.PI / 2); wallBox(vz1 - vz0 - 0.4, 3.6, vx1 - 0.05, F + 2.0, vcz, -Math.PI / 2); wallBox(vx1 - vx0 - 0.4, 3.6, vcx, F + 2.0, vz0 + 0.05, 0);
  addCollider(vx0, F, vz0, vx0 + 0.1, F + 4, vz1); addCollider(vx1 - 0.1, F, vz0, vx1, F + 4, vz1); addCollider(vx0, F, vz0, vx1, F + 4, vz0 + 0.1);
  // Zwischenwände des Nordflügels: der Tresorraum ist von den Büros abgetrennt (Westteil und Ostteil bleiben zu)
  K.add('stone', Bx(vx0 - X0 - 0.6, 6.3, hz0 - Z0 - 1.2, (X0 + 0.6 + vx0) / 2, F + 3.15, (Z0 + hz0) / 2, 2), [0.85, 0.83, 0.78]); addCollider(X0, F, Z0, vx0, F + 6.3, hz0);
  K.add('stone', Bx(X1 - 0.6 - vx1, 6.3, hz0 - Z0 - 1.2, (vx1 + X1 - 0.6) / 2, F + 3.15, (Z0 + hz0) / 2, 2), [0.85, 0.83, 0.78]); addCollider(vx1, F, Z0, X1, F + 6.3, hz0);
  { const tx = vcx, tz = vcz + 0.5; K.add('iron', Bx(2.4, 0.08, 1.1, tx, F + 0.9, tz, 1), [0.35, 0.35, 0.38]); for (const [dx, dz2] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) K.add('iron', Bx(0.08, 0.86, 0.08, tx + dx, F + 0.43, tz + dz2, 1), [0.35, 0.35, 0.38]); addCollider(tx - 1.2, F, tz - 0.55, tx + 1.2, F + 0.94, tz + 0.55);
    const items = []; for (let k = 0; k < 12; k++) { const row = k % 4, lay = Math.floor(k / 4); items.push(['goldbar', tx - 0.6 + row * 0.3 + (lay % 2) * 0.05, tz - 0.25 + (lay % 2) * 0.12, lay % 2 ? Math.PI / 2 : 0, 0.94 + lay * 0.075]); }
    for (let k = 0; k < 3; k++) items.push(['coinsack', tx - 0.9 + k * 0.5, tz + 0.3, rr() * 2, 0.94]);
    items.push(['goldbar', vx0 + 0.6, vz1 - 0.8, 0.4, 0], ['goldbar', vx0 + 0.9, vz1 - 1.0, 1.2, 0], ['coinsack', vx1 - 0.7, vz0 + 0.9, 0, 0], ['trunk', vx1 - 1.5, vz1 - 1.2, 0.3, 0], ['luggagecart', vx1 - 1.2, vcz, Math.PI / 2, 0]);
    ORTE.spawns.push({ x: tx, z: tz, items, y: F + 2.5, floor: F }); }
  for (const dx of [-3, 3]) { K.add('iron', new T.CylinderGeometry(0.2, 0.3, 0.12, 12).translate(vcx + dx, F + 4.25, vcz), [0.3, 0.3, 0.32]); K.add('lit', new T.SphereGeometry(0.14, 10, 8).translate(vcx + dx, F + 4.1, vcz), [1.6, 1.5, 1.2]); addGlow(vcx + dx, F + 4.0, vcz, [1.2, 1.15, 0.9], 1.2); }
  addLight(0xfff4e0, 1.8, 12, 1.6, vcx, F + 3.6, vcz, true);
  ped({ x: vcx - 2.2, y: F, z: vcz - 1.5, yaw: Math.PI / 2 + 0.5, kind: 'suit', col: COATS[3], act: 28.5, busy: true });
  K.build(scene);
  Bk.inside = (x, z, y) => x > X0 && x < X1 && z > Z0 && z < Z1 && y < F + H + 1;
  Bk.vault = { x0: vx0, x1: vx1, z0: vz0, z1: vz1, door: { x: dxw, z: dz } }; Object.assign(Bk, { hz0, ix0, ix1, iz0, iz1, sx, hx, win });
  return Bk;
}

/* =====================================================================
   CAFÉ KRANICH im Park an der Promenade
   ===================================================================== */
function buildCafe(b, rr) {
  const x = b.x0 + 4.5 + 16, z = b.z0 + 4.5 + 24, w = 28, d = 16;
  clearRect(x - w / 2 - 4, z - d / 2 - 9, x + w / 2 + 4, z + d / 2 + 6);
  const V = venue({ name: 'CAFÉ KRANICH', kind: 'cafe', cafe: true, x, z, w, d, rng: rr });
  ORTE.cafe = V;
  // Weg vom Gehweg zur Tür, Laternen, Bänke im Park, Zeitungsständer
  const K = kit(), F = V.F;
  K.add('stone', Bx(4, 0.08, b.z1 - (z + d / 2) + 0.5, x, Y0 + 0.04, (z + d / 2 + b.z1) / 2, 2), [0.6, 0.58, 0.54]);
  for (const s of [-1, 1]) lamps.push({ x: x + s * 4.5, z: z + d / 2 + 6, h: 4.4 });
  for (const [bx, bz, a] of [[x - w / 2 - 3, z, Math.PI / 2], [x + w / 2 + 3, z, -Math.PI / 2]]) { tearWrap('cafe:bank:' + bx.toFixed(0), { name: 'Parkbank', m: 55, stuff: 'wood', seat: true }, () => benchGeo(K, 1.9, bx, Y0, bz, a)); addCollider(bx - 0.4, Y0, bz - 1, bx + 0.4, Y0 + 0.9, bz + 1); }
  ped({ x: x - w / 2 - 3.2, y: Y0 + 0.46, z: z - 0.5, yaw: Math.PI / 2, kind: 'coat', col: COATS[1], sit: true, act: 31.2, sc: 0.98 });
  // Zeitungen an der Tür, Kuchenvitrine innen (Waren auf der Theke macht venue), Kaffeeduft: Dampf aus der Küche
  ORTE.spawns.push({ x, z: z + d / 2 + 2, items: [['papers', x + 2.4, z + d / 2 + 1.0, 0.4], ['papers', x + 2.7, z + d / 2 + 1.3, 1.1], ['signboard', x - 2.6, z + d / 2 + 1.2, 0.2], ['flowerpot', x + 3.2, z + d / 2 + 0.6, 0], ['flowerpot', x - 3.2, z + d / 2 + 0.6, 0]], y: 3 });
  K.build(scene);
  V.inside = (px, pz, py) => px > V.x0 && px < V.x1 && pz > V.z0 && pz < V.z1 && py < F + 5.5;
  return V;
}

/* ---------- Aufbau (nach buildVenues, vor flushInstances) ---------- */
export function buildOrte() {
  const rr = mulberry32(5858);
  const bT = takeBlock(385, -35), bC = takeBlock(165, 315);
  if (bT) { buildTheater(bT, rr); buildBank(bT, rr); }
  if (bC) buildCafe(bC, rr);
}

/* ---------- Ablauf: die Nummer, Applaus, Begrüßung, Platzanweiserin auf den Stufen ---------- */
const SHOW = ORTE.show;
export function updateOrte(dt) {
  const V = ORTE.theater; if (!V) return;
  const p = player.p, cp = camera.position;
  const near = (cp.x - V.x) ** 2 + (cp.z - V.z) ** 2 < 120 * 120;
  SHOW.vis = near;
  if (!near) { SHOW.inside = false; return; }
  const S = SHOW; S.t += dt;
  // Gleichschritt der Girls: dieselbe Phase (einmal, sobald die Figuren da sind)
  if (!S.sync && V.dancers[0].a) { S.sync = true; for (const d of V.dancers) { d.a.gait[0] = 0.2; d.a.gv = (d.a.gv | 0) + 1; } }
  // Nummer (50 s) -> Verbeugung mit Applaus (7 s) -> Pause (6 s, die Girls stehen, der Conférencier redet) -> nächste Nummer
  const len = S.st === 'nummer' ? 50 : S.st === 'applaus' ? 7 : 6;
  if (S.t > len) {
    S.t = 0; S.st = S.st === 'nummer' ? 'applaus' : S.st === 'applaus' ? 'pause' : 'nummer';
    if (S.st === 'nummer') S.n++;
    for (const d of V.dancers) if (d.a) { setAct(d, S.st === 'nummer' ? 22 : S.st === 'applaus' ? 1.3 : 0.6 + (d.z % 1) * 0.3); d.tilt = 0; }
    if (V.mc.a) setAct(V.mc, S.st === 'pause' ? 2.3 : S.st === 'applaus' ? 9.3 : 0.9);
    if (S.st === 'applaus') clap(V, 6.5);
  }
  if (S.st === 'applaus') { const u = S.t; const k = u < 0.6 ? u / 0.6 : u < 3.2 ? 1 : Math.max(0, 1 - (u - 3.2) / 0.8); for (const d of V.dancers) d.tilt = -0.42 * k; }
  // Alexander betritt den Saal: Applaus, Begrüßung durch den Conférencier (einmal je Besuch)
  const inHall = V.inHall(p.x, p.z, p.y);
  if (inHall && !S.inside) { S.inside = true; if (S.greet <= 0) { S.greet = 90; clap(V, 5.5, true); if (V.mc.a) { setAct(V.mc, 2.3); S.mcT = 4; } say('Der Conférencier', pk(Math.random, ['Meine Damen und Herren … Alexander ist im Haus!', 'Applaus für den Herrn von Vespera: Alexander!', 'Herr Alexander! Die Loge gehört Ihnen, das ganze Haus gehört Ihnen!'])); } }
  if (!inHall) S.inside = false;
  if (S.greet > 0) S.greet -= dt;
  if (S.mcT > 0 && (S.mcT -= dt) <= 0 && V.mc.a) setAct(V.mc, S.st === 'nummer' ? 0.9 : 2.3);
  // Applaus beenden
  if (S.clapT > 0 && (S.clapT -= dt) <= 0) for (const pd of S.clapping) { if (pd.a && !pd.aw) setAct(pd, pd.act); }
  // Platzanweiserin: Höhe nach der Stufe, auf der sie gerade steht
  for (const wt of V.waiters) { const inRows = wt.x > V.rx0 - 0.5; wt.y = inRows ? V.rowY(wt.x) : V.hall.y; }
}
// Publikum klatscht (im Sitzen, 9.8), die Kapelle hält inne; forPlayer: Köpfe zu Alexander
function clap(V, dur, forPlayer = false) {
  SHOW.clapT = dur; SHOW.clapping = [];
  for (const pd of V.peds) { if (!pd.a || pd.aw || !pd.audience) continue; if (Math.random() < 0.85) { setAct(pd, 9.8); SHOW.clapping.push(pd); if (forPlayer) turnHead(pd.a, player.p.x, player.p.z); } }
}
// Wo ist Alexander gerade (für Musik und Nebel)
export function inOrt(x, z, y) {
  if (ORTE.theater && ORTE.theater.inside(x, z, y)) return 'theater';
  if (ORTE.bank && ORTE.bank.inside(x, z, y)) return 'bank';
  if (ORTE.cafe && ORTE.cafe.inside(x, z, y)) return 'cafe';
  return null;
}
