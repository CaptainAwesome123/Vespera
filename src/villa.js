import { T, MOBILE, R, pick, rand, scene, mergeGeos, canvasTex } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { addGlow, NEON } from './facade-shader.js';
import { VILLA } from './harbour.js';
import { FURN, placeFurn, lathe, FAN_TEX } from './entrances.js';
import { worldUV, wallpaperTex, GOWNS } from './serpentine.js';
import { setDance, placeCouple } from './dance.js';
import { addLight } from './performance.js';
import { INTERACT } from './music.js';
import { toast } from './boat.js';
import { player } from './player.js';
import { dishModel } from './venues.js';

/* =====================================================================
   V28 · DIE LUXUSVILLA: Innenräume auf drei Ebenen
   Die Villa gehört dem Spieler, dem reichsten Mann von Vespera. Erdgeschoss: Eingangshalle mit
   zweiläufiger Freitreppe, Salon, Herrenzimmer mit Bar und Billard, Speisesaal mit langer Tafel,
   Küche, Ballsaal mit Band. Obergeschoss: Galerie, Arbeitszimmer mit Bibliothek, Wintergarten,
   Schlafzimmer, Bad, Ankleide, Gästezimmer. Keller: Dienstbotenküche, Gesindestube, Zimmer der
   Bediensteten, Randolfs Zimmer, Weinkeller, Tresor, Kesselraum, Schwimmhalle.
   Alles im lokalen Hausraster der Villa (lx quer, +lz zur Stadt, y über dem Plateau VILLA.y).
   Drei Zonen (eg / og / kel) als eigene Netze je Material, die je nach Standort ein- und
   ausgeblendet werden (Handy: enger).
   ===================================================================== */
export const VR = { by: 0, cs: 1, sn: 0, groups: {}, doors: [], rooms: [], room: null, dancers: [], randolf: null, said: 0, mats: null, far: false };
export const H1 = 9, Y1 = 10.2, H2 = 5.2, YK = -4.2, HK = 3.5, HB = 9.6;   // Geschosshöhen: EG, OG-Boden, OG, Kellerboden, Keller, Ballsaal
export const RANDOLF_SAYS = ['Guten Abend, Sir. Willkommen zu Hause.', 'Die Gäste sind im Ballsaal, Sir. Der Champagner steht kalt.', 'Ihr Bad ist eingelassen, Sir. Der Smoking liegt in der Ankleide bereit.', 'Die Küche hat Hummer und Austern vorbereitet, Sir.', 'Soll ich den Wagen vorfahren lassen, Sir?', 'Im Weinkeller lagert der 1911er Champagner, Sir. Ein Jahrgang wie dieser Abend.', 'Die Dienstboten haben die Schwimmhalle geheizt, Sir.'];
const _l = { x: 0, y: 0, z: 0 };
export function villaLocal(p, o = _l) { const dx = p.x - VILLA.x, dz = p.z - VILLA.z; o.x = dx * VR.cs - dz * VR.sn; o.z = dx * VR.sn + dz * VR.cs; o.y = p.y - VR.by; return o; }
// Innerhalb des Hauses (Mittelbau oder Flügel), über alle Geschosse
export function inVillaHouse(p) {
  if (!VILLA.boxes || Math.abs(p.x - VILLA.x) > 90 || Math.abs(p.z - VILLA.z) > 90) return false;
  const l = villaLocal(p);
  if (l.y < YK - 1 || l.y > 16) return false;
  return Math.abs(l.x) < 55 && l.z > -23 && (l.z < -1 || (Math.abs(l.x) > 29 && l.z < 7));
}
// Im Keller oder auf dem Weg hinunter: dort gilt nicht der Hang als Boden, sondern die Kellerquader
export function inVillaCellar(p) { return inVillaHouse(p) && _l.y < 0.6; }

export function villaMats(M) {
  const tile = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#e8e2d4'; g.fillRect(0, 0, W, H);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { g.fillStyle = (i + j) % 2 ? '#ebe6da' : '#d9d2c2'; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
    g.strokeStyle = '#8a7a66'; g.lineWidth = 1.5; for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, H); g.moveTo(0, i * 32); g.lineTo(W, i * 32); g.stroke(); }
    g.fillStyle = '#1b3a3c'; for (let j = 0; j < 8; j += 2) for (let i = 0; i < 8; i += 2) g.fillRect(i * 32 + 12, j * 32 + 12, 8, 8);
  });
  tile.wrapS = tile.wrapT = T.RepeatWrapping;
  const blue = wallpaperTex('#24343c', 'rgba(222,178,96,0.26)'); blue.wrapS = blue.wrapT = T.RepeatWrapping;
  const green = wallpaperTex('#28362a', 'rgba(222,178,96,0.22)'); green.wrapS = green.wrapT = T.RepeatWrapping;
  return {
    ...M,
    white: stdMat({ color: 0xf0e9dc, roughness: 0.32, envI: 0.7, emissive: 0x1a1612 }),
    black: stdMat({ color: 0x101014, roughness: 0.18, envI: 1.3, emissive: 0x050506 }),
    linen: stdMat({ color: 0xf2ecdf, roughness: 0.92, env: false, emissive: 0x2a2620 }),
    tile: stdMat({ map: tile, roughness: 0.35, envI: 0.6, emissive: 0x332e28, emissiveMap: tile }),
    copper: stdMat({ color: 0xb87333, metalness: 0.85, roughness: 0.35, envI: 1.2 }),
    steel: stdMat({ color: 0x9aa0a4, metalness: 0.9, roughness: 0.3, envI: 1.0 }),
    mirror: stdMat({ color: 0xdfe6ea, metalness: 1.0, roughness: 0.04, envI: 2.2 }),
    glassW: stdMat({ color: 0x06090d, metalness: 0.8, roughness: 0.08, envI: 1.6, emissive: 0x0b1418, transparent: true, opacity: 0.88, side: T.DoubleSide }),
    bluewall: stdMat({ map: blue, roughness: 0.85, env: false, emissive: 0x7a8a92, emissiveMap: blue }),
    greenwall: stdMat({ map: green, roughness: 0.85, env: false, emissive: 0x6a7a62, emissiveMap: green }),
    stoneF: stdMat({ color: 0x8a8378, roughness: 0.9, envI: 0.2, emissive: 0x0e0c0a }),
    brassM: MAT.brass,
    brick: stdMat({ color: 0x6a3a2a, roughness: 0.95, env: false, emissive: 0x100804 }),
    cream: stdMat({ color: 0xe6dcc6, roughness: 0.8, env: false, emissive: 0x6a5e4c }),
    plantD: stdMat({ color: 0x3e6a3a, roughness: 0.9, env: false, emissive: 0x0a1a0a }),
    trunkP: stdMat({ color: 0x5a4030, roughness: 0.9, env: false }),
    tealG: new T.MeshBasicMaterial({ color: new T.Color(0.5, 1.2, 1.15), transparent: true, opacity: 0.35, depthWrite: false }),
  };
}

/* ---------- Aufbau ---------- */
export function buildVillaRooms(ctx) {
  const { W, V, G, colL, pl, by, ry, M } = ctx;
  VR.by = by; VR.cs = Math.cos(ry); VR.sn = Math.sin(ry);
  const mats = VR.mats = villaMats(M);
  const B = {};
  // Geometrie lokal setzen; die Weltlage kommt beim Zusammenbau je Netz dazu
  const A = (zone, mat, g, lx = 0, y = 0, lz = 0, a = 0) => { if (a) g.rotateY(a); g.translate(lx, y, lz); (B[zone + '|' + mat] ||= []).push(g); return g; };
  const box = (zone, mat, w, h, d, lx, y, lz, a = 0) => A(zone, mat, new T.BoxGeometry(w, h, d), lx, y + h / 2, lz, a);
  const col = (x0, y0, z0, x1, y1, z1) => colL(Math.min(x0, x1), by + y0, Math.min(z0, z1), Math.max(x0, x1), by + y1, Math.max(z0, z1));
  const glow = (lx, y, lz, c, s) => G(lx, by + y, lz, c, s);
  const light = (lx, y, lz, c, i, d) => { const [x, z] = W(lx, lz); addLight(c, i, d, 1.5, x, by + y, z, true); };
  const SV = (lx, lz, w, d, y0, y1, o) => V(lx, lz, w, d, by + y0, by + y1, o);
  const GR = [0.95, 0.72, 0.34], cream = [0.86, 0.8, 0.68];
  const FW = { style: 2, dens: 1, flood: 1, rib: GR, tint: cream, seed: 881 }, FP = { style: 3, dens: 0, flood: 1, rib: GR, tint: cream, seed: 889 };

  // Wand aus Stücken mit Lücken (Türen): ax 'x' läuft entlang lx bei lz = c, ax 'z' entlang lz bei lx = c
  const wall = (zone, mat, ax, c, a0, a1, y0, h, thk, gaps = [], o = {}) => {
    const pieces = [];
    let s = Math.min(a0, a1); const e = Math.max(a0, a1);
    const gs = gaps.map(g => [Math.min(g[0], g[1]), Math.max(g[0], g[1]), g[2] ?? h]).sort((p, q) => p[0] - q[0]);
    for (const [g0, g1, gh] of gs) { if (g0 > s) pieces.push([s, g0, 0, h]); if (gh < h) pieces.push([g0, g1, gh, h]); s = Math.max(s, g1); }
    if (e > s) pieces.push([s, e, 0, h]);
    for (const [p0, p1, b0, b1] of pieces) {
      const L = p1 - p0, m = (p0 + p1) / 2;
      if (mat) { if (ax === 'x') box(zone, mat, L, b1 - b0, thk, m, y0 + b0, c); else box(zone, mat, thk, b1 - b0, L, c, y0 + b0, m); }
      if (o.col !== false) { if (ax === 'x') col(p0, y0 + b0, c - thk / 2, p1, y0 + b1, c + thk / 2); else col(c - thk / 2, y0 + b0, p0, c + thk / 2, y0 + b1, p1); }
    }
    // Sockelleiste und Goldfries an der Innenseite (nur bei sichtbaren Wänden)
    if (mat && o.trim !== false) for (const [p0, p1, b0] of pieces) {
      if (b0 > 0) continue;
      const L = p1 - p0, m = (p0 + p1) / 2, t2 = thk / 2 + 0.07;
      for (const sd of (o.side ? [o.side] : [-1, 1])) {
        if (ax === 'x') { box(zone, 'wood', L, 0.3, 0.12, m, y0, c + sd * t2); box(zone, 'gold', L, 0.08, 0.1, m, y0 + h - 0.9, c + sd * t2); }
        else { box(zone, 'wood', 0.12, 0.3, L, c + sd * t2, y0, m); box(zone, 'gold', 0.1, 0.08, L, c + sd * t2, y0 + h - 0.9, m); }
      }
    }
  };
  const floor = (zone, mat, x0, x1, z0, z1, y) => A(zone, mat, new T.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)).rotateX(-Math.PI / 2), (x0 + x1) / 2, y, (z0 + z1) / 2);
  const ceiling = (zone, mat, x0, x1, z0, z1, y, coffer = 0) => {
    A(zone, mat, new T.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0)).rotateX(Math.PI / 2), (x0 + x1) / 2, y, (z0 + z1) / 2);
    if (!coffer) return;
    for (let x = Math.min(x0, x1) + coffer; x < Math.max(x0, x1) - 0.5; x += coffer) box(zone, 'gold', 0.16, 0.28, Math.abs(z1 - z0), x, y - 0.28, (z0 + z1) / 2);
    for (let z = Math.min(z0, z1) + coffer; z < Math.max(z0, z1) - 0.5; z += coffer) box(zone, 'gold', Math.abs(x1 - x0), 0.28, 0.16, (x0 + x1) / 2, y - 0.28, z);
  };
  // Säule mit Basis und Goldkapitell
  const column = (zone, lx, lz, y0, h, r, mat = 'white') => {
    A(zone, mat, new T.CylinderGeometry(r, r * 1.08, h, 16), lx, y0 + h / 2, lz);
    A(zone, mat, new T.BoxGeometry(r * 2.6, 0.25, r * 2.6), lx, y0 + 0.125, lz);
    A(zone, 'gold', new T.CylinderGeometry(r * 1.5, r * 1.02, 0.5, 16), lx, y0 + h - 0.25, lz);
    A(zone, 'gold', new T.TorusGeometry(r * 1.05, 0.04, 6, 20).rotateX(Math.PI / 2), lx, y0 + 0.4, lz);
    col(lx - r, y0, lz - r, lx + r, y0 + h, lz + r);
  };
  // Balustrade: Goldhandlauf auf Marmorbalustern, mit Kollision
  const balu = (zone, ax, c, a0, a1, y, o = {}) => {
    const L = Math.abs(a1 - a0), m = (a0 + a1) / 2, hh = 1.05;
    const rail = (w, h, d) => ax === 'x' ? box(zone, 'gold', L, h, d, m, y + hh - h, c) : box(zone, 'gold', d, h, L, c, y + hh - h, m);
    rail(L, 0.12, 0.3);
    if (ax === 'x') box(zone, 'white', L, 0.1, 0.22, m, y, c); else box(zone, 'white', 0.22, 0.1, L, c, y, m);
    const n = Math.max(2, Math.round(L / 0.45));
    for (let k = 0; k <= n; k++) { const u = Math.min(a0, a1) + k / n * L, g = lathe([[0.05, 0], [0.08, 0.1], [0.05, 0.3], [0.08, 0.55], [0.05, 0.8], [0.07, 0.93]], 8); if (ax === 'x') A(zone, 'white', g, u, y + 0.08, c); else A(zone, 'white', g, c, y + 0.08, u); }
    if (ax === 'x') col(Math.min(a0, a1), y, c - 0.15, Math.max(a0, a1), y + hh, c + 0.15); else col(c - 0.15, y, Math.min(a0, a1), c + 0.15, y + hh, Math.max(a0, a1));
    if (o.posts) for (const u of [a0, a1]) { const g = new T.BoxGeometry(0.3, hh + 0.3, 0.3); if (ax === 'x') A(zone, 'white', g, u, y + hh / 2 + 0.15, c); else A(zone, 'white', g, c, y + hh / 2 + 0.15, u); }
  };
  // Treppenlauf entlang lz: von zA (Höhe yA) nach zB (Höhe yB), Breite x0..x1
  const flight = (zone, mat, x0, x1, zA, zB, yA, yB, base) => {
    const n = Math.max(2, Math.round(Math.abs(yB - yA) / 0.28)), rise = (yB - yA) / n, run = (zB - zA) / n, w = Math.abs(x1 - x0), xm = (x0 + x1) / 2;
    base = base ?? Math.min(yA, yB) - 0.3;
    for (let k = 0; k < n; k++) {
      const top = yA + (k + 1) * rise, z0 = zA + k * run, z1 = zA + (k + 1) * run, hgt = Math.max(0.1, top - base);
      box(zone, mat, w, hgt, Math.abs(run) + 0.01, xm, base, (z0 + z1) / 2);
      col(x0, base, Math.min(z0, z1), x1, top, Math.max(z0, z1));
      if (k < n - 1) box(zone, 'gold', w, 0.03, 0.06, xm, top, z1 - run * 0.02);   // Messingkante an jeder Stufe
    }
    return { n, rise, run, ang: Math.atan2(yB - yA, zB - zA), L: Math.hypot(zB - zA, yB - yA) };
  };
  // Wangen/Brüstung schräg am Lauf entlang
  const parapet = (zone, lx, zA, zB, yA, yB, h = 1.0, mat = 'white') => {
    const L = Math.hypot(zB - zA, yB - yA), ang = Math.atan2(yB - yA, zB - zA);
    A(zone, mat, new T.BoxGeometry(0.3, h, L).rotateX(-ang), lx, (yA + yB) / 2 + h / 2, (zA + zB) / 2);
    A(zone, 'gold', new T.BoxGeometry(0.36, 0.08, L).rotateX(-ang), lx, (yA + yB) / 2 + h, (zA + zB) / 2);
    for (let k = 0; k < 4; k++) { const t0 = k / 4, t1 = (k + 1) / 4; col(lx - 0.15, yA + (yB - yA) * Math.min(t0, t1), zA + (zB - zA) * t0, lx + 0.15, yA + (yB - yA) * Math.max(t0, t1) + h + 0.2, zA + (zB - zA) * t1); }
  };
  // Fenster von innen: dunkles Glas in Goldrahmen mit Sprossen, n Stück zwischen a0 und a1
  const windows = (zone, ax, c, a0, a1, y0, h, n, w = 2.2, skip = []) => {
    for (let k = 0; k < n; k++) {
      const u = a0 + (k + 0.5) / n * (a1 - a0);
      if (skip.some(s => u > s[0] && u < s[1])) continue;
      const pane = new T.PlaneGeometry(w, h), fr = [new T.BoxGeometry(w + 0.3, 0.15, 0.2).translate(0, h / 2 + 0.07, 0), new T.BoxGeometry(w + 0.3, 0.15, 0.2).translate(0, -h / 2 - 0.07, 0), new T.BoxGeometry(0.15, h + 0.3, 0.2).translate(w / 2 + 0.07, 0, 0), new T.BoxGeometry(0.15, h + 0.3, 0.2).translate(-w / 2 - 0.07, 0, 0), new T.BoxGeometry(0.06, h, 0.08), new T.BoxGeometry(w, 0.06, 0.08).translate(0, h * 0.2, 0)];
      const a = ax === 'x' ? 0 : Math.PI / 2, px = ax === 'x' ? u : c, pz = ax === 'x' ? c : u;
      A(zone, 'glassW', pane, px, y0 + h / 2, pz, a);
      for (const g of fr) A(zone, 'gold', g, px, y0 + h / 2, pz, a);
      // Vorhänge aus Samt links und rechts
      for (const sd of [-1, 1]) { const g = new T.BoxGeometry(0.5, h + 0.2, 0.35).translate(sd * (w / 2 + 0.35), 0, 0.2); A(zone, 'carpet', g, px, y0 + h / 2, pz, a); }
    }
  };
  // Tür: Goldgewände, dazu ein oder zwei Flügel, die aufschwingen, wenn der Spieler nahe kommt
  const door = (zone, ax, c, u, w, h, o = {}) => {
    const a = ax === 'x' ? 0 : Math.PI / 2, px = ax === 'x' ? u : c, pz = ax === 'x' ? c : u, dp = o.depth ?? 0.5;
    for (const sd of [-1, 1]) A(zone, 'gold', new T.BoxGeometry(0.22, h + 0.1, dp).translate(sd * (w / 2 + 0.11), 0, 0), px, h / 2, pz, a);
    A(zone, 'gold', new T.BoxGeometry(w + 0.44, 0.26, dp).translate(0, 0, 0), px, h + 0.13, pz, a);
    if (o.arch) A(zone, 'gold', new T.BoxGeometry(w + 0.9, 0.6, dp * 0.6).translate(0, 0, 0), px, h + 0.4, pz, a);
    if (o.leaves === false) return;
    const grp = new T.Group(), [x, z] = W(px, pz); grp.position.set(x, by + (o.y ?? 0), z); grp.rotation.y = ry + a; scene.add(grp);
    const leafMat = o.glass ? mats.glassD : mats.wood, nL = o.double ? 2 : 1, lw = w / nL - 0.03, leaves = [];
    for (let k = 0; k < nL; k++) {
      const s = nL === 1 ? -1 : (k ? -1 : 1), hinge = nL === 1 ? -w / 2 : s * w / 2;
      const g = mergeGeos([new T.BoxGeometry(lw, h - 0.08, 0.07).translate(-s * (lw / 2), h / 2, 0), new T.BoxGeometry(0.06, 0.25, 0.1).translate(-s * (lw - 0.25), h * 0.5, 0.06), new T.BoxGeometry(lw - 0.3, h * 0.3, 0.02).translate(-s * (lw / 2), h * 0.7, 0.045), new T.BoxGeometry(lw - 0.3, h * 0.3, 0.02).translate(-s * (lw / 2), h * 0.27, 0.045)]);
      const m = new T.Mesh(g, leafMat); m.position.set(hinge, 0, 0); grp.add(m);
      if (o.glass) { const pm = new T.Mesh(new T.BoxGeometry(lw - 0.3, h - 0.5, 0.03).translate(-s * (lw / 2), h / 2, 0), mats.glassW); m.add(pm); }
      leaves.push({ m, s });
    }
    for (const L of leaves) L.m.rotation.y = L.s * (o.open ?? 0) * 1.5 * (o.dir ?? 1);
    grp.visible = false; grp.userData.zone = zone;
    VR.doors.push({ grp, lx: px, lz: pz, y: o.y ?? 0, leaves, open: o.open ?? 0, fixed: !!o.open, zone, dir: o.dir ?? 1 });
  };
  // Kronleuchter: Goldringe mit Kristalltropfen und Licht
  const chand = (zone, lx, lz, y, r, s = 1) => {
    A(zone, 'gold', new T.CylinderGeometry(0.04, 0.04, 1.6 * s, 6), lx, y + 0.8 * s, lz);
    for (const [rr, dy] of [[r, 0], [r * 0.65, 0.5 * s], [r * 0.32, 0.95 * s]]) {
      A(zone, 'gold', new T.TorusGeometry(rr, 0.05, 6, 32).rotateX(Math.PI / 2), lx, y + dy, lz);
      const n = Math.round(rr * (MOBILE ? 6 : 10));
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; A(zone, 'lamp', new T.OctahedronGeometry(0.09), lx + Math.cos(a) * rr, y + dy - 0.2, lz + Math.sin(a) * rr); }
    }
    glow(lx, y + 0.2, lz, [1.35, 1.0, 0.65], 2.5 + r * 1.6);
  };
  const lampF = (zone, lx, lz, y) => { placeFurn(FURN.floorLamp(), FM, (k, g) => A(zone, k, g), lx, y, lz); glow(lx, y + 1.55, lz, [1.3, 0.9, 0.5], 1.3); };
  const lampT = (zone, lx, lz, y) => { placeFurn(FURN.tableLamp(), FM, (k, g) => A(zone, k, g), lx, y, lz); glow(lx, y + 0.42, lz, [1.3, 0.9, 0.5], 0.9); };
  const FM = { up: 'sofa', frame: 'gold', wood: 'wood', lamp: 'lamp', leaf: 'hedge', cloth: 'velvet' }, FL = { ...FM, up: 'leather' }, FC = { ...FM, up: 'linen' };
  const furn = (zone, parts, map, lx, y, lz, a = 0) => placeFurn(parts, map, (k, g) => A(zone, k, g), lx, y, lz, a);
  // Palme im Kübel: Stamm aus Zylindern, Wedel aus flachen Kästen
  const palm = (zone, lx, lz, y, h = 3.2) => {
    A(zone, 'stone', lathe([[0.5, 0], [0.55, 0.1], [0.45, 0.8], [0.6, 0.9]], 14), lx, y, lz);
    A(zone, 'trunkP', new T.CylinderGeometry(0.07, 0.12, h, 7), lx, y + 0.9 + h / 2, lz);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + R(), g = new T.BoxGeometry(0.28, 0.03, 1.8).translate(0, 0, 0.9).rotateX(0.5 + R() * 0.3).rotateY(a); A(zone, 'plantD', g, lx, y + 0.9 + h, lz); }
    col(lx - 0.5, y, lz - 0.5, lx + 0.5, y + 1.2, lz + 0.5);
  };
  const fern = (zone, lx, lz, y, s = 1) => furn(zone, FURN.vasePlant(s), FM, lx, y, lz);
  const bed = (zone, lx, lz, y, w, L, a = 0, o = {}) => {
    const add = (k, g) => A(zone, k, g.rotateY(a).translate(lx, y, lz));
    add('wood', new T.BoxGeometry(w + 0.2, 0.45, L + 0.2).translate(0, 0.225, 0));
    add('linen', new T.BoxGeometry(w, 0.3, L).translate(0, 0.6, 0));
    add(o.silk ? 'velvet' : 'linen', new T.BoxGeometry(w + 0.1, 0.12, L * 0.62).translate(0, 0.78, L * 0.14));
    for (const sx of [-1, 1]) add('linen', new T.BoxGeometry(w * 0.42, 0.18, 0.5).translate(sx * w * 0.24, 0.84, -L / 2 + 0.4));
    add(o.panel || 'wood', new T.BoxGeometry(w + 0.3, o.canopy ? 1.6 : 1.1, 0.12).translate(0, 0.9, -L / 2 - 0.1));
    if (o.canopy) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add('gold', new T.CylinderGeometry(0.05, 0.07, 2.6, 8).translate(sx * (w / 2 + 0.1), 1.3, sz * (L / 2 + 0.05)));
      add('velvet', new T.BoxGeometry(w + 0.5, 0.12, L + 0.4).translate(0, 2.65, 0)); add('gold', new T.BoxGeometry(w + 0.6, 0.06, L + 0.5).translate(0, 2.73, 0));
    }
    const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), hw = (w * cs + L * sn) / 2 + 0.1, hd = (w * sn + L * cs) / 2 + 0.1;
    col(lx - hw, y, lz - hd, lx + hw, y + 0.7, lz + hd);
  };
  const wardrobe = (zone, lx, lz, y, w, a = 0, mat = 'panel') => {
    const add = (k, g) => A(zone, k, g.rotateY(a).translate(lx, y, lz));
    add(mat, new T.BoxGeometry(w, 2.6, 0.65).translate(0, 1.3, 0)); add('gold', new T.BoxGeometry(w + 0.1, 0.12, 0.7).translate(0, 2.62, 0));
    const n = Math.max(1, Math.round(w / 0.8));
    for (let k = 0; k < n; k++) { add('gold', new T.BoxGeometry(0.03, 0.3, 0.04).translate(-w / 2 + (k + 0.5) * w / n + 0.12, 1.1, 0.35)); if (k) add('wood', new T.BoxGeometry(0.03, 2.4, 0.03).translate(-w / 2 + k * w / n, 1.25, 0.33)); }
    const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a)), hw = (w * cs + 0.65 * sn) / 2, hd = (w * sn + 0.65 * cs) / 2;
    col(lx - hw, y, lz - hd, lx + hw, y + 2.6, lz + hd);
  };
  const fireplace = (zone, lx, lz, y, a = 0, mat = 'white') => {
    const add = (k, g) => A(zone, k, g.rotateY(a).translate(lx, y, lz));
    add(mat, new T.BoxGeometry(3.2, 2.2, 0.7).translate(0, 1.1, -0.3)); add('dark', new T.BoxGeometry(1.6, 1.3, 0.5).translate(0, 0.65, -0.05));
    add('fire', new T.PlaneGeometry(1.3, 0.7).translate(0, 0.5, 0.02)); add('gold', new T.BoxGeometry(3.5, 0.15, 0.9).translate(0, 2.25, -0.3));
    add('fan', new T.PlaneGeometry(3.0, 1.5).translate(0, 3.2, 0.03));
    const cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
    col(lx - (3.2 * cs + 0.9 * sn) / 2, y, lz - (3.2 * sn + 0.9 * cs) / 2, lx + (3.2 * cs + 0.9 * sn) / 2, y + 2.3, lz + (3.2 * sn + 0.9 * cs) / 2);
    const [gx, gz] = [lx + Math.sin(a) * 0.8, lz + Math.cos(a) * 0.8]; glow(gx, y + 0.6, gz, [1.4, 0.6, 0.2], 2.4);
  };
  const bookwall = (zone, ax, c, a0, a1, y, h) => {
    const L = Math.abs(a1 - a0), m = (a0 + a1) / 2;
    if (ax === 'x') { A(zone, 'books', new T.PlaneGeometry(L, h), m, y + h / 2, c); box(zone, 'wood', L + 0.2, 0.3, 0.6, m, y + h, c); box(zone, 'wood', L + 0.2, 0.15, 0.5, m, y, c); col(Math.min(a0, a1), y, c - 0.4, Math.max(a0, a1), y + h + 0.3, c + 0.4); }
    else { A(zone, 'books', new T.PlaneGeometry(L, h).rotateY(Math.PI / 2), c, y + h / 2, m); box(zone, 'wood', 0.6, 0.3, L + 0.2, c, y + h, m); box(zone, 'wood', 0.5, 0.15, L + 0.2, c, y, m); col(c - 0.4, y, Math.min(a0, a1), c + 0.4, y + h + 0.3, Math.max(a0, a1)); }
  };
  const table = (zone, lx, lz, y, w, L, mat = 'wood', h = 0.76) => {
    box(zone, mat, w, 0.08, L, lx, y + h - 0.08, lz); box(zone, 'gold', w + 0.04, 0.03, L + 0.04, lx, y + h - 0.11, lz);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(zone, mat, 0.12, h - 0.1, 0.12, lx + sx * (w / 2 - 0.15), y, lz + sz * (L / 2 - 0.15));
    col(lx - w / 2, y, lz - L / 2, lx + w / 2, y + h, lz + L / 2);
  };
  const desk = (zone, lx, lz, y, a = 0) => {
    const add = (k, g) => A(zone, k, g.rotateY(a).translate(lx, y, lz));
    add('wood', new T.BoxGeometry(2.6, 0.08, 1.3).translate(0, 0.76, 0)); add('leather', new T.BoxGeometry(1.6, 0.02, 0.8).translate(0, 0.81, 0));
    for (const sx of [-1, 1]) add('wood', new T.BoxGeometry(0.6, 0.7, 1.2).translate(sx * 0.95, 0.35, 0));
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) add('gold', new T.BoxGeometry(0.2, 0.02, 0.03).translate(sx * 0.95, 0.18 + k * 0.2, 0.6));
    col(lx - 1.4, y, lz - 0.7, lx + 1.4, y + 0.8, lz + 0.7);
  };
  const rug = (zone, mat, lx, lz, y, w, L) => { A(zone, mat, new T.BoxGeometry(w, 0.03, L), lx, y + 0.015, lz); box(zone, 'gold', w + 0.2, 0.02, 0.12, lx, y, lz - L / 2); box(zone, 'gold', w + 0.2, 0.02, 0.12, lx, y, lz + L / 2); };
  const statue = (zone, lx, lz, y, s = 1.4) => {
    A(zone, 'white', lathe([[0.45, 0], [0.45, 0.12], [0.35, 0.2], [0.32, 1.0], [0.42, 1.1], [0, 1.1]], 16), lx, y, lz);
    A(zone, 'white', new T.SphereGeometry(0.22 * s, 10, 8).scale(1, 1.6, 1).translate(0, 1.1 + 0.5 * s, 0), lx, y, lz);
    A(zone, 'white', new T.SphereGeometry(0.11 * s, 10, 8).translate(0, 1.1 + 1.0 * s, 0), lx, y, lz);
    A(zone, 'gold', new T.TorusGeometry(0.4, 0.03, 6, 20).rotateX(Math.PI / 2), lx, y + 1.05, lz);
    glow(lx, y + 0.3, lz + 0.7, [1.2, 0.95, 0.7], 1.2); col(lx - 0.45, y, lz - 0.45, lx + 0.45, y + 2.5, lz + 0.45);
  };
  const room = (name, zone, x0, x1, z0, z1, y, hint) => VR.rooms.push({ name, zone, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y, hint });
  const person = (kind, color, lx, lz, y, yaw) => pl(kind, color, lx, by + y, lz, yaw);
  const WHITE = [0.9, 0.88, 0.82], BLACK = [0.05, 0.05, 0.06], MAID = [0.08, 0.08, 0.1];

  /* ================= Außenhülle: Mittelbau-Obergeschoss, Flügel, Dächer ================= */
  const EG = 'eg', OG = 'og', KE = 'kel';
  // Mittelbau: Seitenwände mit Durchgang zu Speisesaal und Ballsaal, Fassade zur Loggia mit Fenstertüren, Obergeschoss, Dachplatte
  for (const sd of [-1, 1]) {
    SV(sd * 29.7, -15.5, 0.6, 15, 0, H1, FW); SV(sd * 29.7, -2.5, 0.6, 3, 0, H1, FW); SV(sd * 29.7, -6, 0.6, 4, 4.2, H1, FP);
    SV(sd * 29.7, -12, 0.6, 22, H1, 16, { ...FW, seed: 893 });
    SV(sd * 25, -1.3, 10, 0.6, 0, H1, { ...FW, seed: 894 }); SV(sd * 9.4, -1.3, 15.2, 0.6, 0, H1, { ...FW, seed: 895 }); SV(sd * 18.5, -1.3, 3, 0.6, 4.2, H1, FP);
    SV(sd * 7.5, -1.3, 15, 0.6, H1, 13.6, { ...FW, seed: 896 }); SV(sd * 16, -1.3, 2, 0.6, 13.6, 16, FP); SV(sd * 23.5, -1.3, 13, 0.6, H1, 16, { ...FW, seed: 897 });
  }
  SV(0, -1.3, 3.6, 0.6, 4.2, H1, FP); SV(0, -1.3, 2, 0.6, 13.6, 16, FP);
  SV(0, -22.7, 60, 0.6, H1, 16, { ...FW, seed: 898 });
  SV(0, -12, 60, 22, 15.4, 16, { tint: [0.5, 0.42, 0.3], flood: 1, rib: GR, col: false });
  // Flügel: dieselbe Höhe wie der Mittelbau, mit Gartentüren nach vorn, Dachplatte, Gesims, Goldfinnen, Aufsatz
  for (const sd of [-1, 1]) {
    SV(sd * 42.35, -22.7, 25.3, 0.6, 0, 16, { ...FW, seed: 900 + sd });
    SV(sd * 54.7, -8, 0.6, 30, 0, 16, { ...FW, seed: 902 + sd });
    SV(sd * 29.7, 3, 0.6, 8, 0, 16, { ...FW, seed: 904 + sd });
    const dh = sd < 0 ? 4.2 : 5.0;
    SV(sd * 34.85, 6.7, 10.3, 0.6, 0, 16, { ...FW, seed: 906 + sd }); SV(sd * 50, 6.7, 10, 0.6, 0, 16, { ...FW, seed: 908 + sd }); SV(sd * 42.5, 6.7, 5, 0.6, dh, 16, FP);
    SV(sd * 42, -8, 26, 30, 15.4, 16, { tint: [0.5, 0.42, 0.3], flood: 1, rib: GR, col: false });
    SV(sd * 42, -8, 27, 31, 16, 17.2, { tint: [0.5, 0.42, 0.3], flood: 1, rib: GR, col: false });
    SV(sd * 42, -8, 14, 18, 17.2, 21, { style: 2, dens: 1, flood: 1, tint: cream, seed: 910 + sd });
    for (const [dx, dz] of [[-12, 12], [12, 12], [-12, -12], [12, -12]]) glow(sd * 42 + dx, 17.8, -8 + dz, [1.3, 0.92, 0.55], 1.5);
  }
  // Ballsaal-Decke liegt tiefer als das OG: Platte dazwischen
  SV(42, -8, 25, 30, HB, Y1, { tint: cream, flood: 1, col: false, style: 3, dens: 0 });
  // Loggia-Terrasse: begehbar, mit Balustrade; Balkon vor dem Schlafzimmer
  col(-30, H1, -1.6, 30, Y1, 2.0);
  balu(OG, 'x', 1.75, -29.5, 29.5, Y1, { posts: true });
  for (const sd of [-1, 1]) { balu(OG, 'z', sd * 29.5, -1.6, 1.75, Y1); for (const lz of [-0.4]) palm(OG, sd * 24, lz + 0.6, Y1, 2.6); fern(OG, sd * 10, 0.6, Y1, 1.6); }
  box(EG, 'stone', 15, 0.6, 3.5, -42.5, Y1 - 0.6, 8.45); col(-50, Y1 - 0.6, 6.7, -35, Y1, 10.2);
  balu(OG, 'x', 10.05, -49.8, -35.2, Y1, { posts: true }); for (const sd of [-1, 1]) balu(OG, 'z', -42.5 + sd * 7.35, 6.7, 10.05, Y1);
  for (const sd of [-1, 1]) { fern(OG, -42.5 + sd * 6, 9.4, Y1, 1.5); glow(-42.5 + sd * 6, Y1 + 0.6, 9.4, [1.3, 0.9, 0.5], 1.0); }

  /* ================= Erdgeschoss ================= */
  // ---------- Eingangshalle mit Imperialtreppe ----------
  room('Eingangshalle', EG, -14.5, 14.5, -22.4, -1.6, 0, 'Randolf erwartet Sie');
  floor(EG, 'marble', -14.5, 14.5, -22.4, -1.6, 0.03);
  A(EG, 'gold', new T.RingGeometry(3.6, 3.9, 48).rotateX(-Math.PI / 2), 0, 0.05, -17.5);
  A(EG, 'black', new T.CircleGeometry(3.6, 48).rotateX(-Math.PI / 2), 0, 0.045, -17.5);
  A(EG, 'gold', new T.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), 0, 0.055, -17.5);
  rug(EG, 'carpet', 0, -20.5, 0.06, 6, 3.6);
  ceiling(EG, 'ceil', -14.3, 14.3, -22.4, -13, H1 - 0.05, 3.5);           // unter der Galerie
  ceiling(OG, 'ceil', -14.3, 14.3, -13, -1.6, Y1 + H2 - 0.05, 4);         // über der Halle: zwei Geschosse hoch
  wall(EG, 'plaster', 'z', -14.4, -22.4, -1.6, 0, Y1, 0.14, [[-19, -15, 4.2]], { col: false, side: 1 });
  wall(EG, 'plaster', 'z', 14.4, -22.4, -1.6, 0, Y1, 0.14, [[-13, -9, 4.2]], { col: false, side: -1 });
  wall(EG, 'plaster', 'x', -22.3, -14.3, 14.3, 0, H1, 0.14, [[-8.9, -6.1, 5.0], [6.1, 8.9, 5.0]], { col: false, side: 1 });
  wall(EG, 'plaster', 'x', -1.7, -14.3, 14.3, 0, Y1 + H2, 0.14, [[-1.8, 1.8, 4.2]], { col: false, side: -1 });
  // großes Bogenfenster über dem Treppenpodest, Sonnenfächer
  A(EG, 'lamp', new T.PlaneGeometry(7, 3.2), 0, 7.2, -1.86); A(EG, 'gold', new T.BoxGeometry(7.4, 0.2, 0.25), 0, 5.5, -1.9); A(EG, 'gold', new T.BoxGeometry(7.4, 0.2, 0.25), 0, 8.9, -1.9);
  A(OG, 'fan', new T.PlaneGeometry(9, 4.5), 0, 12.0, -1.88);
  // Trennwände Halle/Salon/Herrenzimmer (Kollision) und Treppenkammer zum Keller
  wall(EG, null, 'z', -14.5, -22.4, -1.6, 0, Y1, 0.4, [[-19, -15, 4.2]]);
  wall(EG, null, 'z', 14.5, -22.4, -1.6, 0, Y1, 0.4, [[-13, -9, 4.2]]);
  wall(EG, 'plaster', 'z', 11, -22.4, -16, 0, H1, 0.3, [], { side: -1 });
  wall(EG, 'plaster', 'x', -16, 11, 14.5, 0, H1, 0.3, [[12.9, 14.1, 2.4]], { side: 1 });
  door(EG, 'x', -16, 13.5, 1.2, 2.4);
  door(EG, 'z', -14.5, -17, 4, 4.2, { double: true, arch: true });
  door(EG, 'z', 14.5, -11, 4, 4.2, { double: true, arch: true });
  door(EG, 'x', -1.3, 0, 3.6, 4.2, { double: true, glass: true, open: 1 });
  // Säulenreihen, Imperialtreppe: Mittellauf zum Podest, zwei Seitenläufe zur Galerie
  for (const sd of [-1, 1]) for (const lz of [-20.5, -16.5]) column(EG, sd * 9.8, lz, 0, H1 - 0.05, 0.5);
  for (const sd of [-1, 1]) for (const lz of [-11, -6]) column(EG, sd * 9.8, lz, 0, Y1 + H2 - 0.05, 0.55);
  flight(EG, 'white', -3, 3, -13, -5, 0, 5.1);
  box(EG, 'white', 13, 0.35, 3.4, 0, 4.75, -3.3); col(-6.5, 4.75, -5, 6.5, 5.1, -1.6);
  A(EG, 'carpet', new T.BoxGeometry(2.4, 0.02, 3.4), 0, 5.11, -3.3);
  for (const sd of [-1, 1]) { flight(EG, 'white', sd * 3.5, sd * 6.5, -5, -13, 5.1, Y1, 4.75); column(EG, sd * 6.2, -3.6, 0, 4.75, 0.42); }
  for (const sd of [-1, 1]) { parapet(EG, sd * 3.15, -13.2, -5, 0, 5.1); parapet(EG, sd * 6.65, -5, -13.2, 5.1, Y1); parapet(EG, sd * 3.35, -5, -13.2, 5.1, Y1, 0.9); balu(EG, 'z', sd * 6.5, -5, -1.6, 5.1); }
  for (const sd of [-1, 1]) { A(EG, 'gold', new T.SphereGeometry(0.22, 12, 8), sd * 3.15, 1.25, -13.3); glow(sd * 3.15, 1.4, -13.3, [1.3, 0.95, 0.55], 1.4); statue(EG, sd * 12.5, -21, 0, 1.4); }
  for (const sd of [-1, 1]) palm(EG, sd * 12.4, -5, 0, 3.6);
  chand(EG, 0, -7.3, Y1 + H2 - 2.2, 2.6, 1.6); chand(EG, 0, -17.5, H1 - 1.6, 1.3);
  light(0, 6, -10, 0xffd9a6, 1.1, 32); light(0, 5, -18, 0xffd9a6, 0.8, 22);
  VR.randolf = person('tux', BLACK, 0, -16.2, 0, Math.PI);
  person('dress', MAID, -12, -8, 0, Math.PI * 0.5); person('dress', MAID, 12.5, -14.5, 0, -Math.PI * 0.4);

  // ---------- Salon (links) ----------
  room('Salon', EG, -29.4, -14.7, -22.4, -1.6, 0);
  floor(EG, 'marble', -29.4, -14.7, -22.4, -1.6, 0.03); ceiling(EG, 'ceil', -29.4, -14.7, -22.4, -1.6, H1 - 0.05, 3.5);
  wall(EG, 'plaster', 'z', -29.3, -22.4, -1.6, 0, H1, 0.14, [[-8, -4, 4.2]], { col: false, side: 1 });
  wall(EG, 'plaster', 'z', -14.6, -22.4, -1.6, 0, H1, 0.14, [[-19, -15, 4.2]], { col: false, side: -1 });
  wall(EG, 'plaster', 'x', -22.3, -29.4, -14.7, 0, H1, 0.14, [], { col: false, side: 1 });
  wall(EG, 'plaster', 'x', -1.7, -29.4, -14.7, 0, H1, 0.14, [[-20, -17, 4.2]], { col: false, side: -1 });
  windows(EG, 'x', -1.85, -29, -21, 1.2, 5.6, 3); windows(EG, 'x', -1.85, -16.6, -15, 1.2, 5.6, 1);
  windows(EG, 'x', -22.2, -29, -24, 1.2, 5.6, 1);
  door(EG, 'x', -1.3, -18.5, 3, 4.2, { double: true, glass: true });
  door(EG, 'z', -29.7, -6, 4, 4.2, { double: true, arch: true, depth: 0.8 });
  fireplace(EG, -22, -22.1, 0, 0, 'black');
  rug(EG, 'rug', -22, -12, 0.04, 13, 9);
  for (const [lx, lz, a] of [[-27, -12, Math.PI / 2], [-17, -12, -Math.PI / 2], [-22, -17, 0]]) { furn(EG, FURN.sofa(4), FM, lx, 0, lz, a); }
  col(-28, 0, -14.5, -26, 1.1, -9.5); col(-18, 0, -14.5, -16, 1.1, -9.5); col(-24, 0, -18, -20, 1.1, -16.4);
  furn(EG, FURN.roundTable(1.0, 0.46), FM, -22, 0, -12); furn(EG, FURN.vasePlant(0.7), FM, -22, 0.46, -12);
  for (const sx of [-1, 1]) { lampF(EG, -22 + sx * 6.2, -15.6, 0); fern(EG, -22 + sx * 5.5, -21, 0, 1.6); }
  // Flügel mit offenem Deckel, Bistrotisch in der Fensterecke
  box(EG, 'black', 2.6, 0.5, 1.6, -25.5, 1.0, -5.2); A(EG, 'black', new T.BoxGeometry(2.4, 0.06, 1.4).rotateZ(-0.6), -25.2, 1.75, -5.2);
  for (const dx of [-1, 1]) box(EG, 'black', 0.16, 0.75, 0.16, -25.5 + dx * 1.1, 0, -5.2); box(EG, 'velvet', 0.4, 0.06, 1.6, -26.9, 0.82, -5.2); col(-26.9, 0, -6.1, -24.1, 1.3, -4.3);
  furn(EG, FURN.roundTable(0.5), FM, -17, 0, -5); lampT(EG, -17, -5, 0.74); for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; furn(EG, FURN.bistroChair(), FM, -17 + Math.sin(a) * 0.85, 0, -5 + Math.cos(a) * 0.85, a + Math.PI); } col(-17.6, 0, -5.6, -16.4, 0.8, -4.4);
  chand(EG, -22, -12, H1 - 1.6, 1.6);
  light(-22, 5.5, -12, 0xffd9a6, 0.9, 26);
  for (let k = 0; k < 5; k++) person(R() < 0.5 ? 'tux' : 'gown', pick(GOWNS), rand(-27, -17), rand(-20, -6), 0, R() * 6.28);

  // ---------- Herrenzimmer mit Bar und Billard (rechts) ----------
  room('Herrenzimmer', EG, 14.7, 29.4, -22.4, -1.6, 0, 'Bar und Billard');
  floor(EG, 'parq', 14.7, 29.4, -22.4, -1.6, 0.03); ceiling(EG, 'ceil', 14.7, 29.4, -22.4, -1.6, H1 - 0.05, 3.5);
  wall(EG, 'panel', 'z', 29.3, -22.4, -1.6, 0, H1, 0.14, [[-8, -3, 5.0]], { col: false, side: -1 });
  wall(EG, 'panel', 'z', 14.6, -22.4, -1.6, 0, H1, 0.14, [[-13, -9, 4.2]], { col: false, side: 1 });
  wall(EG, 'panel', 'x', -22.3, 14.7, 29.4, 0, H1, 0.14, [], { col: false, side: 1 });
  wall(EG, 'panel', 'x', -1.7, 14.7, 29.4, 0, H1, 0.14, [[17, 20, 4.2]], { col: false, side: -1 });
  windows(EG, 'x', -1.85, 21, 29, 1.2, 5.6, 3); windows(EG, 'x', -1.85, 15, 16.6, 1.2, 5.6, 1);
  door(EG, 'x', -1.3, 18.5, 3, 4.2, { double: true, glass: true });
  door(EG, 'z', 29.7, -5.5, 5, 5.0, { double: true, arch: true, depth: 0.8 });
  // Bar: Tresen mit Goldkante, Spiegelwand mit Flaschen, Hocker
  box(EG, 'wood', 12, 1.15, 1.0, 22, 0, -17.6); box(EG, 'gold', 12.2, 0.08, 1.15, 22, 1.15, -17.6); box(EG, 'gold', 12, 0.1, 0.1, 22, 0.3, -17.0); col(16, 0, -18.1, 28, 1.2, -17.1);
  box(EG, 'mirror', 13, 4.2, 0.1, 22, 1.2, -22.15); box(EG, 'gold', 13.3, 0.15, 0.2, 22, 5.4, -22.15);
  for (let row = 0; row < 3; row++) { box(EG, 'gold', 12.6, 0.06, 0.45, 22, 1.6 + row * 1.15, -21.9); for (let k = 0; k < 26; k++) A(EG, 'bottle', new T.CylinderGeometry(0.06, 0.08, 0.42 + (k % 3) * 0.06, 8), 16.2 + k * 0.46, 1.9 + row * 1.15, -21.85); }
  glow(22, 3.0, -21.2, [1.3, 0.75, 0.35], 3.5);
  for (let k = 0; k < 7; k++) furn(EG, FURN.barStool(), FL, 16.6 + k * 1.75, 0, -16.55);
  person('livery', WHITE, 22, -20.6, 0, 0);
  // Billardtisch mit grünem Tuch und Kugeln, Queue-Ständer
  box(EG, 'wood', 3.0, 0.7, 1.7, 22, 0.1, -8); box(EG, 'plantD', 2.8, 0.06, 1.5, 22, 0.8, -8); box(EG, 'wood', 3.1, 0.12, 1.8, 22, 0.82, -8);
  for (let k = 0; k < 7; k++) A(EG, k % 2 ? 'gold' : 'leather', new T.SphereGeometry(0.04, 8, 6), 22 + rand(-1.1, 1.1), 0.9, -8 + rand(-0.55, 0.55));
  A(EG, 'white', new T.SphereGeometry(0.04, 8, 6), 21, 0.9, -8); col(20.4, 0, -8.95, 23.6, 0.95, -7.05);
  box(EG, 'gold', 1.6, 0.06, 0.3, 22, 2.6, -8.9); for (const dx of [-0.6, -0.2, 0.2, 0.6]) glow(22 + dx, 2.5, -8, [1.3, 0.95, 0.55], 0.9);
  for (const [lx, lz, a] of [[17.5, -4.5, 0.5], [26.5, -4.5, -0.5], [17.5, -12.5, 0.4], [26.5, -12.5, -0.4]]) { furn(EG, FURN.clubChair(), FL, lx, 0, lz, a); col(lx - 0.55, 0, lz - 0.55, lx + 0.55, 1.0, lz + 0.55); }
  furn(EG, FURN.roundTable(0.5, 0.6), FM, 17.5, 0, -8.5); lampT(EG, 17.5, -8.5, 0.6); box(EG, 'wood', 1.2, 1.1, 0.5, 27.5, 0, -14); box(EG, 'gold', 1.0, 0.03, 0.4, 27.5, 1.11, -14); col(26.9, 0, -14.3, 28.1, 1.2, -13.7);
  chand(EG, 22, -12, H1 - 1.6, 1.2); light(22, 5.5, -12, 0xffd0a0, 0.9, 26);
  for (let k = 0; k < 6; k++) person('tux', [1, 1, 1], 17 + k * 1.8, -15.6, 0, Math.PI);
  person('tux', [1, 1, 1], 24, -5.5, 0, 1.2);

  // ---------- Speisesaal mit langer Tafel (linker Flügel vorn) ----------
  room('Speisesaal', EG, -54.4, -30, -10.8, 6.4, 0, 'Die lange Tafel ist gedeckt');
  floor(EG, 'marble', -54.4, -30, -10.8, 6.4, 0.03); ceiling(EG, 'ceil', -54.4, -30, -10.8, 6.4, H1 - 0.05, 4);
  wall(EG, 'plaster', 'z', -54.3, -10.8, 6.4, 0, H1, 0.14, [], { col: false, side: 1 });
  wall(EG, 'plaster', 'z', -30.1, -10.8, 6.4, 0, H1, 0.14, [[-8, -4, 4.2]], { col: false, side: -1 });
  wall(EG, 'plaster', 'x', 6.3, -54.4, -30, 0, H1, 0.14, [[-45, -40, 4.2]], { col: false, side: -1 });
  wall(EG, 'plaster', 'x', -11, -54.4, -30, 0, H1, 0.4, [[-33.8, -32.2, 2.6]], { side: 1 });
  windows(EG, 'z', -54.2, -10, 6, 1.2, 5.6, 4); windows(EG, 'x', 6.2, -54, -46, 1.2, 5.6, 2); windows(EG, 'x', 6.2, -39, -30.5, 1.2, 5.6, 2);
  door(EG, 'x', 6.7, -42.5, 5, 4.2, { double: true, glass: true });
  door(EG, 'x', -11, -33, 1.6, 2.6);
  rug(EG, 'carpet', -42.2, -2.2, 0.04, 6, 18, 'carpet');
  table(EG, -42.2, -2.2, 0, 1.8, 14, 'wood');
  A(EG, 'linen', new T.BoxGeometry(1.9, 0.02, 14.2), -42.2, 0.77, -2.2);
  for (let k = 0; k < 10; k++) for (const sd of [-1, 1]) { const lz = -8.5 + k * 1.4; furn(EG, FURN.diningChair(), FC, -42.2 + sd * 1.35, 0, lz, sd > 0 ? Math.PI / 2 : -Math.PI / 2); A(EG, 'white', new T.CylinderGeometry(0.17, 0.17, 0.015, 18), -42.2 + sd * 0.65, 0.78, lz); A(EG, 'gold', new T.TorusGeometry(0.17, 0.006, 4, 24).rotateX(Math.PI / 2), -42.2 + sd * 0.65, 0.79, lz); for (const e of [-0.12, 0.12]) A(EG, 'steel', new T.BoxGeometry(0.015, 0.004, 0.2), -42.2 + sd * 0.65 + e, 0.79, lz); }
  for (const sd of [-1, 1]) { furn(EG, FURN.diningChair(), FC, -42.2, 0, -2.2 + sd * 7.6, sd > 0 ? Math.PI : 0); }
  for (let k = 0; k < 4; k++) { const lz = -7.5 + k * 3.5; A(EG, 'gold', lathe([[0.12, 0], [0.03, 0.05], [0.025, 0.4], [0.14, 0.43], [0.03, 0.45], [0.03, 0.6]], 10), -42.2, 0.78, lz); for (const e of [-0.12, 0, 0.12]) { A(EG, 'lamp', new T.CylinderGeometry(0.015, 0.015, 0.12, 6), -42.2 + e, 1.42, lz); glow(-42.2 + e, 1.5, lz, [1.4, 0.85, 0.4], 0.35); } }
  ['lobster', 'cake', 'oysters', 'steak', 'soup'].forEach((d, k) => { const dm = dishModel(d), [x, z] = W(-42.2, -6 + k * 1.9); dm.position.set(x, by + 0.78, z); dm.scale.setScalar(1.5); dm.rotation.y = ry; dm.userData.zone = EG; scene.add(dm); (VR.extra ||= []).push(dm); });
  for (const lz of [-6, 1]) chand(EG, -42.2, lz, H1 - 1.6, 1.3);
  // Anrichte mit Silber, Statuen, Palmen
  box(EG, 'panel', 4.5, 1.1, 0.7, -52.5, 0, -2); box(EG, 'white', 4.6, 0.06, 0.75, -52.5, 1.1, -2); col(-54.4, 0, -2.4, -50.2, 1.2, -1.6);
  for (let k = 0; k < 4; k++) A(EG, 'steel', lathe([[0.18, 0], [0.2, 0.02], [0.08, 0.05], [0.1, 0.12], [0.22, 0.14], [0.22, 0.18]], 12), -54 + k * 1.1, 1.16, -2);
  for (const sd of [-1, 1]) { palm(EG, -42.2 + sd * 10.5, 5.2, 0, 3.2); statue(EG, -42.2 + sd * 5, -10, 0, 1.4); }
  light(-42.2, 5.5, -2, 0xffd9a6, 1.0, 30);
  for (const lx of [-52, -33]) person('livery', WHITE, lx, 4, 0, Math.PI);

  // ---------- Küche (linker Flügel hinten) ----------
  room('Küche', EG, -51.5, -30, -22.4, -11.2, 0);
  floor(EG, 'tile', -54.4, -30, -22.4, -11.2, 0.03); ceiling(EG, 'cream', -54.4, -30, -22.4, -11.2, 5.0);
  wall(EG, 'tile', 'x', -22.3, -54.4, -30, 0, 5.0, 0.14, [], { col: false, side: 1, trim: false });
  wall(EG, 'tile', 'z', -30.1, -22.4, -11.2, 0, 5.0, 0.14, [], { col: false, side: -1, trim: false });
  wall(EG, 'tile', 'x', -11.27, -51.5, -30, 0, 5.0, 0.14, [[-33.8, -32.2, 2.6]], { col: false, side: 1, trim: false });
  wall(EG, 'tile', 'z', -51.5, -22.4, -16, 0, 5.0, 0.3, [], { trim: false });
  wall(EG, 'tile', 'x', -16, -54.4, -51.5, 0, 5.0, 0.3, [[-54.25, -53.05, 2.3]], { trim: false });
  wall(EG, 'tile', 'z', -54.3, -22.4, -11.2, 0, 5.0, 0.14, [], { col: false, side: 1, trim: false });
  door(EG, 'x', -16, -53.65, 1.2, 2.3);
  windows(EG, 'x', -22.2, -50, -31, 1.6, 2.4, 3, 1.8);
  // Herdblock in der Mitte, Arbeitstische an den Wänden, Kupfertöpfe, Regale mit Vorräten
  box(EG, 'black', 5, 0.95, 1.6, -41, 0, -17); box(EG, 'steel', 5.1, 0.06, 1.7, -41, 0.95, -17); for (let k = 0; k < 6; k++) A(EG, 'steel', new T.TorusGeometry(0.14, 0.02, 5, 14).rotateX(Math.PI / 2), -43 + k * 0.8, 1.02, -17 + (k % 2 ? 0.35 : -0.35)); box(EG, 'brassM', 4.8, 0.06, 0.06, -41, 0.5, -16.15); col(-43.5, 0, -17.8, -38.5, 1.0, -16.2);
  for (const k of [0, 1, 2]) { A(EG, 'copper', lathe([[0.18, 0], [0.2, 0.22], [0.22, 0.25]], 12), -42 + k * 0.9, 1.01, -17.2); glow(-42 + k * 0.9, 0.7, -16.0, [1.4, 0.6, 0.2], 0.5); }
  box(EG, 'gold', 4.0, 0.08, 0.08, -41, 2.6, -17); for (let k = 0; k < 8; k++) A(EG, 'copper', lathe([[0.12, 0], [0.14, 0.2], [0.16, 0.22]], 10).rotateX(Math.PI), -42.8 + k * 0.5, 2.55, -17);
  for (const [lz, w] of [[-21.8, 20], [-11.9, 17]]) { box(EG, 'wood', w, 0.9, 0.8, -40.5, 0, lz); box(EG, 'white', w, 0.06, 0.85, -40.5, 0.9, lz); col(-40.5 - w / 2, 0, lz - 0.45, -40.5 + w / 2, 0.95, lz + 0.45); }
  for (let k = 0; k < 14; k++) { const lx = -50 + k * 1.4; A(EG, k % 3 ? 'white' : 'copper', lathe([[0.1, 0], [0.12, 0.12], [0.05, 0.15], [0.04, 0.3]], 8), lx, 0.96, -21.8); }
  for (let k = 0; k < 3; k++) { box(EG, 'wood', 2.5, 0.05, 0.4, -33, 1.6 + k * 0.6, -21.9); for (let j = 0; j < 6; j++) A(EG, j % 2 ? 'bottle' : 'white', new T.CylinderGeometry(0.07, 0.07, 0.3, 8), -34.1 + j * 0.44, 1.65 + k * 0.6, -21.9); }
  for (const lx of [-46, -36]) { A(EG, 'brassM', new T.ConeGeometry(0.35, 0.3, 14, 1, true), lx, 3.0, -17); glow(lx, 2.9, -17, [1.35, 0.95, 0.55], 1.6); }
  light(-41, 3.5, -17, 0xffe0b0, 0.8, 22);
  person('livery', WHITE, -41, -15.6, 0, Math.PI); person('dress', MAID, -46, -20.9, 0, 0); person('dress', MAID, -35, -13.1, 0, Math.PI);

  // ---------- Ballsaal (rechter Flügel) ----------
  room('Ballsaal', EG, 30, 54.4, -22.4, 6.4, 0, 'Die Band spielt');
  floor(EG, 'marble', 30, 54.4, -22.4, 6.4, 0.03); floor(EG, 'parq', 33, 52, -17, 2, 0.045);
  box(EG, 'gold', 19.2, 0.02, 0.12, 42.5, 0.045, -17); box(EG, 'gold', 19.2, 0.02, 0.12, 42.5, 0.045, 2); box(EG, 'gold', 0.12, 0.02, 19.2, 33, 0.045, -7.5); box(EG, 'gold', 0.12, 0.02, 19.2, 52, 0.045, -7.5);
  ceiling(EG, 'ceil', 30, 54.4, -22.4, 6.4, HB - 0.05, 4);
  wall(EG, 'plaster', 'z', 30.1, -22.4, 6.4, 0, HB, 0.14, [[-8, -3, 5.0]], { col: false, side: 1 });
  wall(EG, 'plaster', 'z', 54.3, -22.4, 6.4, 0, HB, 0.14, [], { col: false, side: -1 });
  wall(EG, 'plaster', 'x', -22.3, 30, 54.4, 0, HB, 0.14, [], { col: false, side: 1 });
  wall(EG, 'plaster', 'x', 6.3, 30, 54.4, 0, HB, 0.14, [[40, 45, 5.0]], { col: false, side: -1 });
  windows(EG, 'z', 54.2, -21, 5, 1.4, 6.4, 5); windows(EG, 'x', 6.2, 30.5, 39, 1.4, 6.4, 2); windows(EG, 'x', 6.2, 46, 54, 1.4, 6.4, 2);
  door(EG, 'x', 6.7, 42.5, 5, 5.0, { double: true, glass: true });
  // Spiegel zwischen Pilastern an der Rückwand, Säulenreihen, Bühne für die Band
  for (let k = 0; k < 5; k++) { const lx = 32.5 + k * 5; box(EG, 'mirror', 3.0, 5.5, 0.08, lx, 1.4, -22.2); box(EG, 'gold', 3.3, 0.18, 0.2, lx, 6.9, -22.2); box(EG, 'gold', 3.3, 0.18, 0.2, lx, 1.25, -22.2); }
  for (const lx of [32.3, 52.1]) for (let k = 0; k < 6; k++) column(EG, lx, -20 + k * 5.2, 0, HB - 0.05, 0.45);
  box(EG, 'dark', 12, 0.7, 4.5, 42.5, 0, -20); col(36.5, 0, -22.4, 48.5, 0.7, -17.75);
  { const [x, z] = W(42.5, -17.7); const fm = new T.Mesh(new T.PlaneGeometry(10, 5), new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(1.2, 1.0, 0.7), depthWrite: false, side: T.DoubleSide })); fm.position.set(x, by + 3.6, z); fm.rotation.y = ry; fm.userData.zone = EG; scene.add(fm); (VR.extra ||= []).push(fm); }
  glow(42.5, 4, -20, [1.3, 0.9, 0.5], 6);
  for (const lx of [36, 42.5, 49]) chand(EG, lx, -7.5, HB - 2.0, lx === 42.5 ? 2.2 : 1.4, 1.3);
  light(42.5, 6, -8, 0xffd9a6, 1.2, 36); light(42.5, 4, -19, 0xffc080, 0.8, 18);
  // Buffet mit Champagnerkühlern, Sitzgruppen am Rand, Palmen in den Ecken
  box(EG, 'velvet', 8, 0.8, 1.2, 52.8, 0, -7.5); box(EG, 'gold', 8.1, 0.05, 1.25, 52.8, 0.8, -7.5); col(48.8, 0, -8.1, 54.4, 0.85, -6.9);
  for (let k = 0; k < 4; k++) { A(EG, 'steel', lathe([[0.16, 0], [0.2, 0.3], [0.22, 0.35]], 12), 52.8, 0.85, -10 + k * 1.7); A(EG, 'bottle', new T.CylinderGeometry(0.04, 0.05, 0.3, 8), 52.8, 1.1, -10 + k * 1.7); }
  for (const lz of [-19, 4]) for (const lx of [34, 51]) { furn(EG, FURN.roundTable(0.5), FM, lx, 0, lz); lampT(EG, lx, lz, 0.74); for (let j = 0; j < 2; j++) furn(EG, FURN.bistroChair(), FM, lx + (j ? 0.9 : -0.9), 0, lz, j ? -Math.PI / 2 : Math.PI / 2); col(lx - 0.6, 0, lz - 0.6, lx + 0.6, 0.8, lz + 0.6); }
  for (const [lx, lz] of [[31.4, 5.2], [53, 5.2], [31.4, -21.2], [53, -21.2]]) palm(EG, lx, lz, 0, 3.4);
  VR.ballF = { cx: 42.5, cz: -7.5, rx: 8.2, rz: 7.2 };
  for (let k = 0; k < (MOBILE ? 6 : 8); k++) { const ch = k >= 6, c = { ang: k / 6 * Math.PI * 2, rho0: 0.5 + (k % 2) * 0.4, cx: 42.5 + (k % 2 - 0.5) * 2.6, cz: -1, h0: R() * 6.28 }; c.m = ctx.crowd.add('tux', [1, 1, 1]); c.w = ctx.crowd.add(ch ? 'dress' : 'gown', pick(GOWNS)); setDance(c, ch ? 'charl' : 'fox'); VR.dancers.push(c); }
  for (const [lx, kind] of [[38.5, 'tux'], [40.5, 'tux'], [42.5, 'gown'], [44.5, 'tux'], [46.5, 'tux']]) VILLA.sway.push(person(kind, [0.95, 0.75, 0.38], lx, -20, 0.7, 0));
  for (let k = 0; k < (MOBILE ? 8 : 14); k++) person(R() < 0.5 ? 'tux' : 'gown', pick(GOWNS), rand(31.5, 53), R() < 0.5 ? rand(-21, -17.5) : rand(2.5, 5.5), 0, R() * 6.28);
  person('livery', WHITE, 50.5, -7.5, 0, -Math.PI / 2); person('livery', WHITE, 33, -2, 0, Math.PI / 2);

  /* ================= Obergeschoss ================= */
  // ---------- Galerie um die Halle, Seitengalerien, Flur nach hinten ----------
  room('Galerie', OG, -17.5, 17.5, -22.4, -13, Y1);
  floor(OG, 'marble', -17.5, 17.5, -22.4, -13, Y1 + 0.03); ceiling(OG, 'ceil', -17.5, 17.5, -22.4, -13, Y1 + H2 - 0.05, 3.5);
  for (const sd of [-1, 1]) { floor(OG, 'marble', sd * 14.5, sd * 17.5, -13, -1.6, Y1 + 0.03); ceiling(OG, 'ceil', sd * 14.5, sd * 17.7, -13, -1.6, Y1 + H2 - 0.05); }
  // Boden/Decke als Kollision: Galerie, Seitengalerien, Flure, Zimmer; Lücke über der Halle
  col(-17.5, H1, -23, 17.5, Y1, -13); for (const sd of [-1, 1]) { col(sd * 14.5, H1, -13, sd * 17.7, Y1, -1.6); col(sd * 17.7, H1, -23, sd * 55, Y1, -1.6); col(sd * 29.7, H1, -1.6, sd * 55, Y1, 7); }
  box(EG, 'plaster', 35, 1.2, 9.4, 0, H1, -17.7); for (const sd of [-1, 1]) box(EG, 'plaster', 3, 1.2, 11.4, sd * 16, H1, -7.3);   // Galerie-Platte: Stirnseiten zur Halle
  balu(OG, 'x', -12.85, -14.5, -6.5, Y1, { posts: true }); balu(OG, 'x', -12.85, -3.5, 3.5, Y1); balu(OG, 'x', -12.85, 6.5, 14.5, Y1, { posts: true });
  for (const sd of [-1, 1]) { balu(OG, 'z', sd * 14.6, -13, -1.6, Y1); for (const lz of [-13, -7.3, -1.6]) column(OG, sd * 14.6, lz, Y1, H2 - 0.05, 0.3); }
  wall(OG, 'plaster', 'x', -22.3, -17.5, 17.5, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'plaster', 'x', -1.7, 14.5, 17.5, Y1, H2, 0.14, [[15, 17, 3.4]], { col: false, side: -1 }); wall(OG, 'plaster', 'x', -1.7, -17.5, -14.5, Y1, H2, 0.14, [[-17, -15, 3.4]], { col: false, side: -1 });
  for (const sd of [-1, 1]) door(OG, 'x', -1.3, sd * 16, 2, 3.4, { double: true, glass: true, y: Y1 });
  windows(OG, 'x', -22.2, -16, 16, Y1 + 0.9, 3.2, 5);
  for (const sd of [-1, 1]) { fern(OG, sd * 10, -21, Y1, 1.8); statue(OG, sd * 16.5, -21.5, Y1, 1.2); }
  chand(OG, 0, -17.5, Y1 + H2 - 1.5, 1.2); light(0, Y1 + 3.5, -17.5, 0xffd9a6, 0.8, 22);
  person('dress', MAID, -8, -20, Y1, Math.PI * 0.5);
  // Flur hinten (beide Seiten) bis in die Flügel
  for (const sd of [-1, 1]) {
    room(sd < 0 ? 'Flur West' : 'Flur Ost', OG, sd * 17.5, sd * 54.4, -22.4, -20, Y1);
    floor(OG, 'marble', sd * 17.5, sd * 54.4, -22.4, -20, Y1 + 0.03); ceiling(OG, 'ceil', sd * 17.5, sd * 54.4, -22.4, -20, Y1 + H2 - 0.05);
    wall(OG, 'plaster', 'x', -22.3, sd * 17.5, sd * 54.4, Y1, H2, 0.14, [], { col: false, side: 1 });
    wall(OG, 'plaster', 'z', sd * 54.3, -22.4, -20, Y1, H2, 0.14, [], { col: false, side: -sd });
    windows(OG, 'x', -22.2, sd * 18, sd * 54, Y1 + 0.9, 3.2, 6);
    for (let k = 0; k < 3; k++) { glow(sd * (22 + k * 11), Y1 + 3.8, -21.2, [1.3, 0.95, 0.55], 1.4); A(OG, 'gold', new T.CylinderGeometry(0.3, 0.3, 0.06, 12), sd * (22 + k * 11), Y1 + H2 - 0.1, -21.2); fern(OG, sd * (27 + k * 11), -20.6, Y1, 1.0); }
  }
  // Trennwände OG mit Türen (Kollision)
  wall(OG, null, 'x', -19.8, -54.4, -17.7, Y1, H2, 0.4, [[-24.8, -23.2, 3], [-37.8, -36.2, 3], [-49.8, -48.2, 3]]);
  wall(OG, null, 'x', -19.8, 17.7, 54.4, Y1, H2, 0.4, [[23.2, 24.8, 3], [41, 44, 3.4]]);
  wall(OG, null, 'z', -17.7, -19.8, -1.6, Y1, H2, 0.4, [[-12, -10.4, 3], [-6, -4.4, 3]]);
  wall(OG, null, 'z', 17.7, -19.8, -1.6, Y1, H2, 0.4, [[-12, -10.4, 3]]);
  wall(OG, null, 'z', -29.7, -22.4, 6.4, Y1, H2, 0.6, [[-22.4, -20, 3.4]]);
  wall(OG, null, 'x', -9, -54.4, -29.7, Y1, H2, 0.4, [[-38.2, -35.8, 3], [-49.8, -48.2, 3]]);
  wall(OG, null, 'z', -43, -19.8, -9, Y1, H2, 0.4, []);
  wall(OG, null, 'x', -9, -29.4, -17.7, Y1, H2, 0.4, [[-25.2, -22, 3.6]]);
  wall(OG, null, 'z', 29.7, -22.4, 6.4, Y1, H2, 0.6, [[-22.4, -20, 3.4]]);
  wall(OG, null, 'z', 40.8, -19.8, 6.4, Y1, H2, 0.4, [[-14, -12.4, 3], [0, 1.6, 3]]);
  wall(OG, null, 'z', 44.2, -19.8, 6.4, Y1, H2, 0.4, [[-14, -12.4, 3], [0, 1.6, 3]]);
  wall(OG, null, 'x', -6, 30, 40.8, Y1, H2, 0.4, []); wall(OG, null, 'x', -6, 44.2, 54.4, Y1, H2, 0.4, []);

  // ---------- Arbeitszimmer mit Bibliothek (links) ----------
  room('Arbeitszimmer', OG, -29.4, -17.9, -19.6, -9.2, Y1);
  floor(OG, 'parq', -29.4, -17.9, -19.6, -9.2, Y1 + 0.03); ceiling(OG, 'ceil', -29.4, -17.9, -19.6, -9.2, Y1 + H2 - 0.05);
  wall(OG, 'panel', 'z', -29.5, -19.6, -9.2, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'panel', 'z', -17.8, -19.6, -9.2, Y1, H2, 0.14, [[-12, -10.4, 3]], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -19.7, -29.4, -17.9, Y1, H2, 0.14, [[-24.8, -23.2, 3]], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -9.1, -29.4, -17.9, Y1, H2, 0.14, [[-25.2, -22, 3.6]], { col: false, side: 1 });
  door(OG, 'x', -19.8, -24, 1.6, 3, { y: Y1 }); door(OG, 'z', -17.7, -11.2, 1.6, 3, { y: Y1 }); door(OG, 'x', -9, -23.6, 3.2, 3.6, { y: Y1, leaves: false, arch: true });
  desk(OG, -23.6, -15, Y1, 0); lampT(OG, -22.6, -15.4, Y1 + 0.8);
  furn(OG, FURN.clubChair(), FL, -23.6, Y1, -16.3, Math.PI); furn(OG, FURN.clubChair(), FL, -22.4, Y1, -13.4, 0.3); furn(OG, FURN.clubChair(), FL, -24.8, Y1, -13.4, -0.3);
  bookwall(OG, 'z', -29.1, -19.3, -9.6, Y1, 4.2);
  A(OG, 'gold', new T.SphereGeometry(0.4, 16, 12), -19.5, Y1 + 1.2, -18.5); A(OG, 'wood', lathe([[0.3, 0], [0.1, 0.1], [0.06, 0.8]], 10), -19.5, Y1, -18.5); col(-19.9, Y1, -18.9, -19.1, Y1 + 1.6, -18.1);
  fireplace(OG, -18.0, -11, Y1, Math.PI / 2, 'black'); rug(OG, 'rug', -23.6, -14.4, Y1 + 0.03, 7, 7);
  windows(OG, 'x', -19.7, -29, -26, Y1 + 0.9, 3.2, 1);
  chand(OG, -23.6, -14.4, Y1 + H2 - 1.4, 1.0); light(-23.6, Y1 + 3.5, -14.4, 0xffd0a0, 0.8, 20);
  room('Bibliothek', OG, -29.4, -17.9, -8.8, -1.6, Y1);
  floor(OG, 'parq', -29.4, -17.9, -8.8, -1.6, Y1 + 0.03); ceiling(OG, 'ceil', -29.4, -17.9, -8.8, -1.6, Y1 + H2 - 0.05);
  wall(OG, 'panel', 'z', -29.5, -8.8, -1.6, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'panel', 'z', -17.8, -8.8, -1.6, Y1, H2, 0.14, [[-6, -4.4, 3]], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -8.9, -29.4, -17.9, Y1, H2, 0.14, [[-25.2, -22, 3.6]], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -1.7, -29.4, -17.9, Y1, H2, 0.14, [], { col: false, side: -1 });
  door(OG, 'z', -17.7, -5.2, 1.6, 3, { y: Y1 });
  bookwall(OG, 'z', -29.1, -8.4, -2.0, Y1, 4.6); bookwall(OG, 'x', -2.1, -29, -18.5, Y1, 4.6); bookwall(OG, 'z', -18.2, -8.4, -6.4, Y1, 4.6);
  for (let k = 0; k < 8; k++) box(OG, 'wood', 0.05, 0.04, 0.5, -26 + (k % 2) * 0.5 - 0.5, Y1 + 0.5 + k * 0.5, -3.5); box(OG, 'wood', 0.05, 4.4, 0.06, -26.6, Y1, -3.5); box(OG, 'wood', 0.05, 4.4, 0.06, -25.9, Y1, -3.5);
  for (const [lx, lz, a] of [[-24, -5.5, 0.4], [-21, -5.5, -0.4]]) { furn(OG, FURN.clubChair(), FL, lx, Y1, lz, a); col(lx - 0.55, Y1, lz - 0.55, lx + 0.55, Y1 + 1, lz + 0.55); }
  furn(OG, FURN.roundTable(0.4, 0.58), FM, -22.5, Y1, -6); lampT(OG, -22.5, -6, Y1 + 0.58); lampF(OG, -28.6, -2.6, Y1);
  rug(OG, 'rug', -23, -5.2, Y1 + 0.03, 6, 5);

  // ---------- Wintergarten (rechts) ----------
  room('Wintergarten', OG, 17.9, 29.4, -19.6, -1.6, Y1, 'Palmen und Farne');
  floor(OG, 'tile', 17.9, 29.4, -19.6, -1.6, Y1 + 0.03); ceiling(OG, 'cream', 17.9, 29.4, -19.6, -1.6, Y1 + H2 - 0.05);
  for (let x = 19; x < 29.4; x += 2.6) box(OG, 'gold', 0.12, 0.2, 18, x, Y1 + H2 - 0.25, -10.6); for (let z = -18; z < -1.6; z += 2.6) box(OG, 'gold', 11.5, 0.2, 0.12, 23.65, Y1 + H2 - 0.25, z);
  A(OG, 'lamp', new T.PlaneGeometry(10, 16).rotateX(Math.PI / 2), 23.65, Y1 + H2 - 0.3, -10.6);   // Glasdach: Mondlicht
  wall(OG, 'greenwall', 'z', 29.5, -19.6, -1.6, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'greenwall', 'z', 17.8, -19.6, -1.6, Y1, H2, 0.14, [[-12, -10.4, 3]], { col: false, side: 1 });
  wall(OG, 'greenwall', 'x', -19.7, 17.9, 29.4, Y1, H2, 0.14, [[23.2, 24.8, 3]], { col: false, side: -1 });
  wall(OG, 'greenwall', 'x', -1.7, 17.9, 29.4, Y1, H2, 0.14, [], { col: false, side: -1 });
  door(OG, 'x', -19.8, 24, 1.6, 3, { y: Y1 }); door(OG, 'z', 17.7, -11.2, 1.6, 3, { y: Y1 });
  windows(OG, 'z', 29.4, -19, -2, Y1 + 0.9, 3.4, 4); windows(OG, 'x', -1.8, 18.5, 29, Y1 + 0.9, 3.4, 3);
  for (const [lx, lz] of [[19.5, -17.5], [27.8, -17.5], [19.5, -3.5], [27.8, -3.5], [23.6, -17.8]]) palm(OG, lx, lz, Y1, 2.8);
  for (let k = 0; k < 10; k++) fern(OG, rand(19, 28.5), rand(-18.5, -2.5), Y1, 0.8 + R() * 1.2);
  furn(OG, FURN.roundTable(0.5), FM, 23.6, Y1, -9); for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; furn(OG, FURN.bistroChair(), FM, 23.6 + Math.sin(a) * 0.95, Y1, -9 + Math.cos(a) * 0.95, a + Math.PI); } col(23, Y1, -9.6, 24.2, Y1 + 0.8, -8.4);
  A(OG, 'stone', lathe([[1.2, 0], [1.3, 0.15], [1.1, 0.5], [1.3, 0.6]], 24), 23.6, Y1, -14); A(OG, 'water', new T.CylinderGeometry(1.1, 1.1, 0.05, 24), 23.6, Y1 + 0.55, -14); col(22.3, Y1, -15.3, 24.9, Y1 + 0.6, -12.7);
  for (let k = 0; k < 6; k++) glow(23.6 + Math.cos(k) * 0.9, Y1 + 0.62, -14 + Math.sin(k) * 0.9, NEON.teal, 0.5);
  light(23.6, Y1 + 3.5, -10, 0xcfe8ff, 0.7, 20);
  person('gown', pick(GOWNS), 21, -6, Y1, 0.6); person('tux', [1, 1, 1], 26, -6, Y1, -0.6);

  // ---------- Schlafzimmer, Bad, Ankleide (linker Flügel) ----------
  room('Schlafzimmer', OG, -54.4, -30, -8.8, 6.4, Y1);
  floor(OG, 'parq', -54.4, -30, -8.8, 6.4, Y1 + 0.03); ceiling(OG, 'ceil', -54.4, -30, -8.8, 6.4, Y1 + H2 - 0.05, 3.5);
  wall(OG, 'bluewall', 'z', -54.3, -8.8, 6.4, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'bluewall', 'z', -30.1, -8.8, 6.4, Y1, H2, 0.14, [], { col: false, side: -1 });
  wall(OG, 'bluewall', 'x', -8.9, -54.4, -30, Y1, H2, 0.14, [[-38.2, -35.8, 3], [-49.8, -48.2, 3]], { col: false, side: 1 });
  wall(OG, 'bluewall', 'x', 6.3, -54.4, -30, Y1, H2, 0.14, [[-44.5, -40.5, 3.4]], { col: false, side: -1 });
  windows(OG, 'z', -54.2, -8, 6, Y1 + 0.9, 3.4, 3); windows(OG, 'x', 6.2, -54, -46, Y1 + 0.9, 3.4, 2); windows(OG, 'x', 6.2, -39, -30.5, Y1 + 0.9, 3.4, 2);
  door(OG, 'x', 6.7, -42.5, 4, 3.4, { double: true, glass: true, y: Y1 });
  door(OG, 'x', -9, -37, 2.4, 3, { double: true, y: Y1 }); door(OG, 'x', -9, -49, 1.6, 3, { y: Y1 });
  bed(OG, -42.2, -5.4, Y1, 2.4, 2.4, 0, { canopy: true, silk: true, panel: 'velvet' });
  for (const sd of [-1, 1]) { box(OG, 'wood', 0.7, 0.6, 0.5, -42.2 + sd * 1.75, Y1, -6.4); lampT(OG, -42.2 + sd * 1.75, -6.4, Y1 + 0.6); col(-42.2 + sd * 1.75 - 0.35, Y1, -6.65, -42.2 + sd * 1.75 + 0.35, Y1 + 0.6, -6.15); }
  rug(OG, 'rug', -42.2, -1, Y1 + 0.03, 9, 7);
  fireplace(OG, -54.0, -1, Y1, -Math.PI / 2, 'white');
  furn(OG, FURN.sofa(2.6), FM, -42.2, Y1, 1.5, 0); col(-43.5, Y1, 1, -40.9, Y1 + 1, 2);
  for (const [lx, lz, a] of [[-33, -5, -0.6], [-33, 2, -2.4]]) { furn(OG, FURN.clubChair(), FM, lx, Y1, lz, a); col(lx - 0.55, Y1, lz - 0.55, lx + 0.55, Y1 + 1, lz + 0.55); }
  furn(OG, FURN.roundTable(0.5, 0.6), FM, -32.5, Y1, -1.5); lampT(OG, -32.5, -1.5, Y1 + 0.6);
  box(OG, 'panel', 2.4, 1.0, 0.6, -52.5, Y1, 4.5); box(OG, 'mirror', 2.0, 1.4, 0.06, -52.5, Y1 + 1.1, 4.78); box(OG, 'gold', 2.2, 0.08, 0.1, -52.5, Y1 + 2.5, 4.78); col(-53.7, Y1, 4.2, -51.3, Y1 + 1.0, 4.8);
  fern(OG, -31, 5.5, Y1, 1.4); fern(OG, -53.5, -8, Y1, 1.4);
  chand(OG, -42.2, -1, Y1 + H2 - 1.4, 1.3); light(-42.2, Y1 + 3.5, -1, 0xffd0a8, 0.9, 24);
  person('dress', MAID, -46, -3, Y1, Math.PI * 0.9);
  room('Badezimmer', OG, -54.4, -43.2, -19.6, -9.2, Y1);
  floor(OG, 'marble', -54.4, -43.2, -19.6, -9.2, Y1 + 0.03); ceiling(OG, 'cream', -54.4, -43.2, -19.6, -9.2, Y1 + H2 - 0.05);
  wall(OG, 'tile', 'z', -54.3, -19.6, -9.2, Y1, H2, 0.14, [], { col: false, side: 1, trim: false });
  wall(OG, 'tile', 'z', -43.3, -19.6, -9.2, Y1, H2, 0.14, [], { col: false, side: -1, trim: false });
  wall(OG, 'tile', 'x', -19.7, -54.4, -43.2, Y1, H2, 0.14, [[-49.8, -48.2, 3]], { col: false, side: -1, trim: false });
  wall(OG, 'tile', 'x', -9.1, -54.4, -43.2, Y1, H2, 0.14, [[-49.8, -48.2, 3]], { col: false, side: 1, trim: false });
  door(OG, 'x', -19.8, -49, 1.6, 3, { y: Y1 });
  windows(OG, 'z', -54.2, -18, -11, Y1 + 1.2, 2.4, 2);
  // Freistehende Wanne auf Goldfüßen, Doppelwaschtisch mit Spiegel, Pflanzen, Handtuchwärmer
  A(OG, 'white', lathe([[0.6, 0], [0.9, 0.1], [0.95, 0.5], [0.9, 0.62]], 24).scale(1.9, 1, 1), -48.8, Y1 + 0.15, -16); A(OG, 'water', new T.CylinderGeometry(0.8, 0.8, 0.04, 24).scale(1.9, 1, 1), -48.8, Y1 + 0.68, -16);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) A(OG, 'gold', new T.SphereGeometry(0.1, 8, 6), -48.8 + sx * 1.4, Y1 + 0.1, -16 + sz * 0.6);
  A(OG, 'gold', new T.CylinderGeometry(0.03, 0.03, 0.8, 8), -50.5, Y1 + 0.4, -16); A(OG, 'gold', new T.TorusGeometry(0.12, 0.025, 6, 12).rotateX(Math.PI / 2), -50.5, Y1 + 0.82, -16);
  col(-50.7, Y1, -17, -46.9, Y1 + 0.8, -15); glow(-48.8, Y1 + 1.0, -16, [0.5, 1.1, 1.1], 1.2);
  box(OG, 'white', 3.6, 0.9, 0.7, -47, Y1, -9.6); box(OG, 'black', 3.7, 0.05, 0.75, -47, Y1 + 0.9, -9.6); col(-48.8, Y1, -10, -45.2, Y1 + 0.95, -9.2);
  for (const sd of [-1, 1]) { A(OG, 'white', lathe([[0.3, 0], [0.33, 0.08], [0.1, 0.1]], 16), -47 + sd * 0.9, Y1 + 0.95, -9.6); A(OG, 'gold', new T.CylinderGeometry(0.02, 0.02, 0.25, 6), -47 + sd * 0.9, Y1 + 1.1, -9.85); }
  box(OG, 'mirror', 3.4, 1.6, 0.05, -47, Y1 + 1.3, -9.3); box(OG, 'gold', 3.6, 0.1, 0.1, -47, Y1 + 2.9, -9.3); for (let k = 0; k < 4; k++) glow(-48.5 + k, Y1 + 3.0, -9.5, [1.35, 1.0, 0.65], 0.8);
  box(OG, 'gold', 0.06, 1.2, 0.8, -43.5, Y1 + 0.6, -14); for (let k = 0; k < 4; k++) box(OG, 'gold', 0.1, 0.03, 0.8, -43.5, Y1 + 0.7 + k * 0.25, -14); box(OG, 'linen', 0.12, 0.5, 0.5, -43.55, Y1 + 1.2, -14);
  for (const [lx, lz] of [[-53.5, -19], [-44, -19]]) fern(OG, lx, lz, Y1, 1.6);
  A(OG, 'white', lathe([[0.5, 0], [0.55, 0.1], [0.3, 0.2], [0.25, 0.9], [0.5, 1.0]], 14), -53, Y1, -12.5); fern(OG, -53, -12.5, Y1 + 1.0, 1.0);
  light(-48.8, Y1 + 3.5, -14, 0xd8f0ff, 0.8, 18);
  room('Ankleidezimmer', OG, -42.8, -30, -19.6, -9.2, Y1);
  floor(OG, 'parq', -42.8, -30, -19.6, -9.2, Y1 + 0.03); ceiling(OG, 'ceil', -42.8, -30, -19.6, -9.2, Y1 + H2 - 0.05);
  wall(OG, 'panel', 'z', -42.7, -19.6, -9.2, Y1, H2, 0.14, [], { col: false, side: 1 });
  wall(OG, 'panel', 'z', -30.1, -19.6, -9.2, Y1, H2, 0.14, [], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -19.7, -42.8, -30, Y1, H2, 0.14, [[-37.8, -36.2, 3]], { col: false, side: -1 });
  wall(OG, 'panel', 'x', -9.1, -42.8, -30, Y1, H2, 0.14, [[-38.2, -35.8, 3]], { col: false, side: 1 });
  door(OG, 'x', -19.8, -37, 1.6, 3, { y: Y1 });
  wardrobe(OG, -36.4, -19.1, Y1, 9, 0); wardrobe(OG, -42.4, -14.4, Y1, 8, Math.PI / 2); wardrobe(OG, -30.4, -14.4, Y1, 8, -Math.PI / 2);
  // Insel mit Spiegel, Smoking auf der Puppe, Schuhregal, Hutablage
  box(OG, 'panel', 2.4, 0.95, 1.2, -36.4, Y1, -13.5); box(OG, 'white', 2.5, 0.05, 1.3, -36.4, Y1 + 0.95, -13.5); col(-37.6, Y1, -14.1, -35.2, Y1 + 1, -12.9);
  box(OG, 'mirror', 1.4, 2.4, 0.06, -36.4, Y1 + 0.3, -9.5); box(OG, 'gold', 1.6, 0.1, 0.12, -36.4, Y1 + 2.7, -9.5); box(OG, 'gold', 1.6, 0.1, 0.12, -36.4, Y1 + 0.2, -9.5);
  A(OG, 'black', new T.BoxGeometry(0.55, 0.9, 0.3).translate(0, 1.1, 0), -33, Y1, -10.5); A(OG, 'white', new T.BoxGeometry(0.2, 0.6, 0.31).translate(0, 1.2, 0), -33, Y1, -10.5); A(OG, 'wood', new T.CylinderGeometry(0.03, 0.03, 0.8, 6), -33, Y1 + 0.4, -10.5); A(OG, 'wood', new T.CylinderGeometry(0.3, 0.35, 0.05, 12), -33, Y1, -10.5); col(-33.4, Y1, -10.9, -32.6, Y1 + 1.8, -10.1);
  for (let k = 0; k < 3; k++) { box(OG, 'wood', 3.2, 0.04, 0.35, -40.6, Y1 + 0.3 + k * 0.3, -10.2); for (let j = 0; j < 8; j++) A(OG, j % 3 ? 'black' : 'leather', new T.BoxGeometry(0.1, 0.08, 0.28), -42.0 + j * 0.4, Y1 + 0.38 + k * 0.3, -10.2); }
  lampF(OG, -31, -18.5, Y1); chand(OG, -36.4, -14.4, Y1 + H2 - 1.2, 0.8); light(-36.4, Y1 + 3.5, -14.4, 0xffd9a6, 0.7, 18);

  // ---------- Gästezimmer und Gästebad (rechter Flügel) ----------
  room('Gästeflur', OG, 41, 44, -20, 6.4, Y1);
  floor(OG, 'marble', 41, 44, -20, 6.4, Y1 + 0.03); ceiling(OG, 'ceil', 41, 44, -20, 6.4, Y1 + H2 - 0.05);
  wall(OG, 'plaster', 'z', 40.9, -20, 6.4, Y1, H2, 0.14, [[-14, -12.4, 3], [0, 1.6, 3]], { col: false, side: 1 });
  wall(OG, 'plaster', 'z', 44.1, -20, 6.4, Y1, H2, 0.14, [[-14, -12.4, 3], [0, 1.6, 3]], { col: false, side: -1 });
  wall(OG, 'plaster', 'x', 6.3, 41, 44, Y1, H2, 0.14, [], { col: false, side: -1 }); windows(OG, 'x', 6.2, 41.5, 43.5, Y1 + 0.9, 3.4, 1);
  glow(42.5, Y1 + 3.8, -7, [1.3, 0.95, 0.55], 1.4); fern(OG, 42.5, 5.6, Y1, 1.2);
  const guest = (name, x0, x1, z0, z1, side, dz, bath) => {
    room(name, OG, x0, x1, z0, z1, Y1);
    floor(OG, bath ? 'marble' : 'parq', x0, x1, z0, z1, Y1 + 0.03); ceiling(OG, 'ceil', x0, x1, z0, z1, Y1 + H2 - 0.05);
    const wm = bath ? 'tile' : 'plaster', tr = { trim: !bath };
    wall(OG, wm, 'z', x0 + 0.07, z0, z1, Y1, H2, 0.14, side < 0 ? [[dz, dz + 1.6, 3]] : [], { col: false, side: 1, ...tr });
    wall(OG, wm, 'z', x1 - 0.07, z0, z1, Y1, H2, 0.14, side > 0 ? [[dz, dz + 1.6, 3]] : [], { col: false, side: -1, ...tr });
    wall(OG, wm, 'x', z0 + 0.07, x0, x1, Y1, H2, 0.14, [], { col: false, side: 1, ...tr }); wall(OG, wm, 'x', z1 - 0.07, x0, x1, Y1, H2, 0.14, [], { col: false, side: -1, ...tr });
    door(OG, 'z', side < 0 ? x0 - 0.2 : x1 + 0.2, dz + 0.8, 1.6, 3, { y: Y1 });
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (z1 > 6) windows(OG, 'x', 6.2, x0 + 1, x1 - 1, Y1 + 0.9, 3.4, 2); else { box(OG, 'mirror', 1.6, 2.2, 0.05, cx, Y1 + 0.5, z0 + 0.18); box(OG, 'gold', 1.8, 0.1, 0.1, cx, Y1 + 2.75, z0 + 0.18); }
    if (x1 > 54) windows(OG, 'z', 54.2, z0 + 1, z1 - 1, Y1 + 0.9, 3.4, 2);
    if (bath) {
      A(OG, 'white', lathe([[0.55, 0], [0.8, 0.1], [0.85, 0.5], [0.8, 0.62]], 20).scale(1.8, 1, 1), cx, Y1 + 0.1, cz + 2); A(OG, 'water', new T.CylinderGeometry(0.72, 0.72, 0.04, 20).scale(1.8, 1, 1), cx, Y1 + 0.62, cz + 2); col(cx - 1.6, Y1, cz + 1.1, cx + 1.6, Y1 + 0.75, cz + 2.9);
      box(OG, 'white', 2.2, 0.9, 0.6, cx, Y1, z0 + 0.5); box(OG, 'mirror', 2.0, 1.3, 0.05, cx, Y1 + 1.2, z0 + 0.25); col(cx - 1.1, Y1, z0, cx + 1.1, Y1 + 0.95, z0 + 0.8);
      fern(OG, x0 + 1, z1 - 1, Y1, 1.4); glow(cx, Y1 + 2.8, cz, [1.35, 1.0, 0.65], 1.6); light(cx, Y1 + 3.2, cz, 0xd8f0ff, 0.6, 14);
    } else {
      bed(OG, cx, z0 + 2.2, Y1, 2.0, 2.2, 0, {}); for (const sd of [-1, 1]) { box(OG, 'wood', 0.6, 0.55, 0.45, cx + sd * 1.5, Y1, z0 + 1.4); lampT(OG, cx + sd * 1.5, z0 + 1.4, Y1 + 0.55); }
      wardrobe(OG, x0 + 0.4, cz + 2, Y1, 3, Math.PI / 2); furn(OG, FURN.clubChair(), FM, x1 - 1.4, Y1, z1 - 1.4, -2.4); col(x1 - 2, Y1, z1 - 2, x1 - 0.8, Y1 + 1, z1 - 0.8);
      furn(OG, FURN.roundTable(0.45, 0.6), FM, x1 - 2.6, Y1, z1 - 2.6); fern(OG, x1 - 2.6, z1 - 2.6, Y1 + 0.6, 0.7); rug(OG, 'rug', cx, cz + 1, Y1 + 0.03, 4, 4);
      chand(OG, cx, cz, Y1 + H2 - 1.2, 0.8); light(cx, Y1 + 3.2, cz, 0xffd9a6, 0.6, 14);
    }
  };
  guest('Gästezimmer', 30, 40.6, -19.6, -6.2, 1, -14, false);
  guest('Gästezimmer', 30, 40.6, -5.8, 6.4, 1, 0, false);
  guest('Gästezimmer', 44.4, 54.4, -19.6, -6.2, -1, -14, false);
  guest('Gästebad', 44.4, 54.4, -5.8, 6.4, -1, 0, true);

  /* ================= Keller ================= */
  const KY = YK, KH = HK;
  // Böden und Decken, Kollision (ohne die beiden Treppenschächte, ohne das Becken)
  col(-56, KY - 0.4, -24, 35, KY, 8); col(35, KY - 0.4, -24, 50, KY, -9); col(35, KY - 0.4, -1, 50, KY, 8); col(50, KY - 0.4, -24, 56, KY, 8);
  col(-51.5, -0.7, -23, 11.2, 0, 8); col(-55, -0.7, -17.5, -51.5, 0, 8); col(11.2, -0.7, -17.5, 14.3, 0, 8); col(14.3, -0.7, -23, 55, 0, 8); col(-56, -0.7, -24, -55, 0, 8); col(55, -0.7, -24, 56, 0, 8); col(-56, -0.7, -24, 56, 0, -23);
  // Flur mit Gewölbebögen, Laternen; Treppenschächte von Halle und Küche
  room('Kellerflur', KE, -54.4, 30, -16, -13, KY);
  floor(KE, 'stoneF', -54.4, 30, -16, -13, KY + 0.03); ceiling(KE, 'cream', -54.4, 30, -16, -13, KY + KH - 0.05);
  wall(KE, 'cream', 'x', -16.2, -51.5, 30, KY, KH, 0.4, [[-40.6, -39.4, 2.3], [-27.3, -26.1, 2.3], [-21.4, -20.2, 2.3], [-15.4, -14.2, 2.3], [-9.4, -8.2, 2.3], [-1.4, -0.2, 2.3], [7, 8.2, 2.3], [21, 23.2, 2.4], [11.3, 12.5, 2.3]], { trim: false });
  wall(KE, 'cream', 'x', -12.8, -54.4, 30, KY, KH, 0.4, [[-49.6, -48.4, 2.3], [-36.6, -35.4, 2.3], [-22.6, -21.4, 2.3], [-0.6, 0.6, 2.3], [21.4, 22.6, 2.3]], { trim: false });
  wall(KE, 'cream', 'z', 30, -16.2, -12.8, KY, KH, 0.4, [[-15.5, -13.5, 2.6]], { trim: false });
  wall(KE, 'cream', 'z', -54.4, -16.2, -12.8, KY, KH, 0.14, [], { col: false, trim: false });
  for (let lx = -48; lx < 30; lx += 8) { for (const sd of [-1, 1]) box(KE, 'stoneF', 0.5, KH, 0.5, lx, KY, -14.5 + sd * 1.3); A(KE, 'stoneF', new T.TorusGeometry(1.5, 0.25, 6, 16, Math.PI).rotateY(Math.PI / 2), lx, KY + KH - 1.5, -14.5); A(KE, 'brassM', new T.BoxGeometry(0.25, 0.4, 0.25), lx + 4, KY + KH - 0.6, -14.5); glow(lx + 4, KY + KH - 0.85, -14.5, [1.3, 0.85, 0.45], 1.3); }
  wall(KE, null, 'z', -29.7, -22.4, -16.4, KY, KH, 0.6, []); wall(KE, null, 'z', 29.7, -22.4, -16.2, KY, KH, 0.6, []); wall(KE, null, 'z', 30, -12.8, 6.4, KY, KH, 0.4, []);
  for (const [x0, x1] of [[-54.4, -51.5], [11.15, 14.3]]) {
    const pass = x0 < 0 ? [x1 - 1.4, x1] : [x0, x0 + 1.5], st = x0 < 0 ? [x0, x1 - 1.4] : [x0 + 1.5, x1];
    wall(KE, 'cream', 'z', x0 < 0 ? x1 : x0, -22.4, -16, KY, KH + 0.8, 0.3, [], { trim: false });
    wall(KE, 'cream', 'x', -22.3, x0, x1, KY, KH + 0.8, 0.14, [], { col: false, trim: false });
    wall(KE, 'cream', 'z', x0 < 0 ? x0 + 0.07 : x1 - 0.07, -22.4, -16, KY, KH + 0.8, 0.14, [], { col: false, trim: false });
    wall(KE, 'cream', 'x', -16, x0, x1, KY, KH + 0.4, 0.3, [[(pass[0] + pass[1]) / 2 - 0.6, (pass[0] + pass[1]) / 2 + 0.6, 2.3]], { trim: false });
    door(KE, 'x', -16, (pass[0] + pass[1]) / 2, 1.2, 2.3, { y: KY });
    flight(EG, 'stoneF', st[0], st[1], -17.5, -22.4, 0, KY, KY - 0.1);
    glow((x0 + x1) / 2, -1.2, -19, [1.3, 0.85, 0.45], 1.2); glow((x0 + x1) / 2, KY + 2.6, -17, [1.3, 0.85, 0.45], 1.2);
  }
  // Dienstbotenküche (Randolf führt hier das Regiment)
  room('Dienstbotenküche', KE, -51.3, -30, -22.4, -16.4, KY);
  floor(KE, 'tile', -51.3, -30, -22.4, -16.4, KY + 0.03); ceiling(KE, 'cream', -51.3, -30, -22.4, -16.4, KY + KH - 0.05);
  wall(KE, 'tile', 'x', -22.3, -51.3, -30, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'tile', 'z', -30, -22.4, -16.4, KY, KH, 0.4, [], { trim: false }); wall(KE, 'tile', 'z', -51.3, -22.4, -16.4, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
  door(KE, 'x', -16.2, -40, 1.2, 2.3, { y: KY });
  box(KE, 'black', 4.2, 0.95, 1.2, -45, KY, -21.6); box(KE, 'steel', 4.3, 0.06, 1.25, -45, KY + 0.95, -21.6); col(-47.2, KY, -22.3, -42.8, KY + 1.0, -21.0);
  for (const k of [0, 1, 2]) { A(KE, 'copper', lathe([[0.16, 0], [0.18, 0.2], [0.2, 0.22]], 12), -46 + k * 0.9, KY + 1.01, -21.6); glow(-46 + k * 0.9, KY + 0.6, -20.9, [1.4, 0.6, 0.2], 0.4); }
  table(KE, -38, -19.2, KY, 1.4, 7, 'wood', 0.85); for (let k = 0; k < 10; k++) A(KE, k % 2 ? 'white' : 'copper', lathe([[0.12, 0], [0.14, 0.1], [0.06, 0.12]], 8), -41 + k * 0.7, KY + 0.86, -19.2 + (k % 2 ? 0.3 : -0.3));
  for (const lx of [-34, -31.5]) { box(KE, 'wood', 0.1, 2.4, 2.2, lx, KY, -20); for (let k = 0; k < 4; k++) { box(KE, 'wood', 0.3, 0.04, 2.2, lx + 0.1, KY + 0.5 + k * 0.6, -20); for (let j = 0; j < 5; j++) A(KE, j % 2 ? 'bottle' : 'white', new T.CylinderGeometry(0.07, 0.07, 0.3, 8), lx + 0.1, KY + 0.55 + k * 0.6, -21 + j * 0.5); } }
  box(KE, 'gold', 5, 0.06, 0.06, -45, KY + 2.5, -19); for (let k = 0; k < 9; k++) A(KE, 'copper', lathe([[0.1, 0], [0.12, 0.18], [0.14, 0.2]], 10).rotateX(Math.PI), -47 + k * 0.5, KY + 2.45, -19);
  glow(-40, KY + KH - 0.5, -19, [1.3, 0.9, 0.5], 2.0); light(-40, KY + 2.8, -19, 0xffe0b0, 0.8, 20);
  person('livery', WHITE, -45, -20.3, KY, Math.PI); person('dress', MAID, -36, -18, KY, 0); person('dress', MAID, -41, -17.5, KY, 2.8);
  // Zimmer der Bediensteten, Randolfs Zimmer, Silberkammer, Tresor (hinten)
  const cell = (name, x0, x1, dz, fn) => {
    room(name, KE, x0, x1, -22.4, -16.4, KY);
    floor(KE, 'parq', x0, x1, -22.4, -16.4, KY + 0.03); ceiling(KE, 'cream', x0, x1, -22.4, -16.4, KY + KH - 0.05);
    wall(KE, 'cream', 'x', -22.3, x0, x1, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'cream', 'z', x0 + 0.07, -22.4, -16.4, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'cream', 'z', x1 - 0.07, -22.4, -16.4, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
    wall(KE, null, 'z', x1 + 0.2, -22.4, -16.4, KY, KH, 0.4, []);
    door(KE, 'x', -16.2, dz, 1.2, 2.3, { y: KY });
    glow((x0 + x1) / 2, KY + KH - 0.4, -19.4, [1.3, 0.9, 0.5], 1.2); fn((x0 + x1) / 2);
  };
  const servantRoom = cx => { bed(KE, cx - 1.2, -21.2, KY, 1.0, 2.0, 0, {}); box(KE, 'wood', 0.5, 0.5, 0.5, cx + 1.4, KY, -21.9); lampT(KE, cx + 1.4, -21.9, KY + 0.5); box(KE, 'wood', 1.0, 0.75, 0.6, cx + 1.4, KY, -17.2); furn(KE, FURN.bistroChair(), FM, cx + 1.4, KY, -18.0, Math.PI); col(cx + 0.9, KY, -17.5, cx + 1.9, KY + 0.8, -16.9); A(KE, 'linen', new T.BoxGeometry(0.02, 0.5, 0.4), cx, KY + 1.2, -22.3); };
  cell('Zimmer der Bediensteten', -29.4, -24, -26.7, servantRoom); cell('Zimmer der Bediensteten', -23.6, -18, -20.8, servantRoom); cell('Zimmer der Bediensteten', -17.6, -12, -14.8, servantRoom); cell('Zimmer der Bediensteten', -11.6, -6, -8.8, servantRoom);
  cell('Randolfs Zimmer', -5.6, 4, -0.8, cx => {
    bed(KE, cx - 2.6, -21, KY, 1.2, 2.2, 0, { panel: 'panel' }); box(KE, 'wood', 0.6, 0.55, 0.5, cx - 0.9, KY, -21.9); lampT(KE, cx - 0.9, -21.9, KY + 0.55);
    desk(KE, cx + 2.2, -21.4, KY, 0); furn(KE, FURN.bistroChair(), FM, cx + 2.2, KY, -20.3, Math.PI); lampT(KE, cx + 3.1, -21.6, KY + 0.8);
    bookwall(KE, 'z', 3.75, -19.5, -16.8, KY + 0.8, 2.0); furn(KE, FURN.clubChair(), FL, cx + 1.5, KY, -17.5, -0.8); col(cx + 1, KY, -18, cx + 2, KY + 1, -17);
    rug(KE, 'rug', cx, -19, KY + 0.03, 4, 3);
    // Randolfs Livree auf dem Ständer, ein Bild des Hausherrn, eine Taschenuhr auf dem Tisch
    A(KE, 'black', new T.BoxGeometry(0.5, 0.85, 0.28).translate(0, 1.1, 0), cx - 4.0, KY, -17.2); A(KE, 'white', new T.BoxGeometry(0.18, 0.55, 0.29).translate(0, 1.25, 0), cx - 4.0, KY, -17.2); A(KE, 'wood', new T.CylinderGeometry(0.03, 0.03, 0.8, 6), cx - 4.0, KY + 0.4, -17.2); A(KE, 'wood', new T.CylinderGeometry(0.28, 0.32, 0.05, 12), cx - 4.0, KY, -17.2); col(cx - 4.4, KY, -17.6, cx - 3.6, KY + 1.8, -16.8);
    box(KE, 'gold', 0.8, 1.0, 0.05, cx, KY + 1.6, -22.25); A(KE, 'velvet', new T.PlaneGeometry(0.64, 0.84), cx, KY + 2.1, -22.21); A(KE, 'gold', new T.CylinderGeometry(0.05, 0.05, 0.01, 12).rotateX(Math.PI / 2), cx + 2.6, KY + 0.82, -21.3);
    light(cx, KY + 2.8, -19.4, 0xffd9a6, 0.6, 12);
  });
  cell('Silberkammer', 4.4, 10.8, 7.6, cx => { for (const lz of [-21.6, -17.2]) { box(KE, 'wood', 5.6, 0.04, 0.5, cx, KY + 1.0, lz); box(KE, 'wood', 5.6, 0.04, 0.5, cx, KY + 1.8, lz); box(KE, 'wood', 5.6, 0.04, 0.5, cx, KY + 2.6, lz); col(cx - 2.8, KY, lz - 0.3, cx + 2.8, KY + 2.8, lz + 0.3); for (let k = 0; k < 9; k++) for (const y of [1.0, 1.8, 2.6]) A(KE, 'steel', lathe([[0.18, 0], [0.2, 0.02], [0.06, 0.05], [0.08, 0.1], [0.2, 0.12], [0.2, 0.16]], 10), cx - 2.4 + k * 0.6, KY + y + 0.04, lz); } });
  room('Tresorraum', KE, 14.7, 29.4, -22.4, -16.4, KY, 'Das Gold von Vespera');
  floor(KE, 'stoneF', 14.7, 29.4, -22.4, -16.4, KY + 0.03); ceiling(KE, 'steel', 14.7, 29.4, -22.4, -16.4, KY + KH - 0.05);
  wall(KE, 'steel', 'x', -22.3, 14.7, 29.4, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'steel', 'z', 14.8, -22.4, -16.4, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'steel', 'z', 29.3, -22.4, -16.4, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
  wall(KE, null, 'z', 14.5, -22.4, -16.4, KY, KH, 0.4, []);
  // Runde Tresortür aus Stahl mit Goldrad, offen; Goldbarren auf Paletten, Geldkisten, Safes
  A(KE, 'steel', new T.CylinderGeometry(1.35, 1.35, 0.4, 32).rotateX(Math.PI / 2).rotateY(0.9), 23.4, KY + 1.4, -16.6); A(KE, 'gold', new T.TorusGeometry(0.5, 0.05, 6, 20).rotateY(0.9), 23.55, KY + 1.4, -16.3); for (let k = 0; k < 4; k++) A(KE, 'gold', new T.BoxGeometry(1.0, 0.05, 0.05).rotateZ(k * Math.PI / 4).rotateY(0.9), 23.55, KY + 1.4, -16.3);
  A(KE, 'steel', new T.TorusGeometry(1.4, 0.18, 8, 32), 22, KY + 1.4, -16.2); col(22.5, KY, -17.3, 24.6, KY + 2.8, -16.2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const lx = 17 + i * 2.6, lz = -21 + j * 2.2; box(KE, 'wood', 1.6, 0.15, 1.2, lx, KY, lz); col(lx - 0.8, KY, lz - 0.6, lx + 0.8, KY + 1.2, lz + 0.6); for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 3; c++) A(KE, 'gold', new T.BoxGeometry(0.28, 0.1, 0.52), lx - 0.6 + a * 0.3, KY + 0.2 + c * 0.11, lz - 0.3 + b * 0.2 * (c % 2 ? 1 : 1)); }
  for (let k = 0; k < 3; k++) { box(KE, 'black', 1.1, 1.6, 0.8, 28.8, KY, -21.5 + k * 1.8); A(KE, 'gold', new T.TorusGeometry(0.18, 0.03, 6, 14).rotateY(Math.PI / 2), 28.2, KY + 0.9, -21.5 + k * 1.8); col(28.2, KY, -22 + k * 1.8, 29.4, KY + 1.7, -21 + k * 1.8); }
  glow(22, KY + KH - 0.4, -19.4, [1.4, 1.1, 0.6], 2.2); light(22, KY + 2.8, -19.4, 0xffe6b0, 0.9, 16);
  // Vorn: Gesindestube, Waschküche, Vorratskammer, Kesselraum, Weinkeller
  const front = (name, x0, x1, z1, mat, fn) => {
    room(name, KE, x0, x1, -12.8, z1, KY);
    floor(KE, mat, x0, x1, -12.8, z1, KY + 0.03); ceiling(KE, 'cream', x0, x1, -12.8, z1, KY + KH - 0.05);
    wall(KE, 'cream', 'x', z1 - 0.07, x0, x1, KY, KH, 0.14, [], { col: false, side: -1, trim: false }); wall(KE, 'cream', 'z', x0 + 0.07, -12.8, z1, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'cream', 'z', x1 - 0.07, -12.8, z1, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
    wall(KE, null, 'z', x1 + 0.2, -12.8, z1, KY, KH, 0.4, []);
    door(KE, 'x', -12.8, (x0 + x1) / 2, 1.2, 2.3, { y: KY });
    fn((x0 + x1) / 2, (-12.8 + z1) / 2, x0, x1);
  };
  front('Gesindestube', -54.4, -43.2, 6.4, 'parq', (cx, cz, x0) => {
    table(KE, cx, cz, KY, 1.2, 7, 'wood'); for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) furn(KE, FURN.diningChair(), FM, cx + sd * 1.0, KY, cz - 2.4 + k * 1.6, sd > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let k = 0; k < 6; k++) A(KE, 'white', new T.CylinderGeometry(0.14, 0.14, 0.015, 14), cx + (k % 2 ? 0.5 : -0.5), KY + 0.78, cz - 2 + k * 0.8);
    fireplace(KE, x0 + 0.45, cz, KY, Math.PI / 2, 'brick'); glow(cx, KY + KH - 0.4, cz, [1.3, 0.85, 0.45], 1.8); light(cx, KY + 2.8, cz, 0xffd0a0, 0.7, 16);
    person('livery', WHITE, cx - 1.6, cz + 1, KY, Math.PI / 2); person('dress', MAID, cx + 1.6, cz - 1, KY, -Math.PI / 2); person('livery', WHITE, cx, cz + 4.5, KY, Math.PI);
    bookwall(KE, 'x', 6.0, cx - 3, cx + 3, KY + 0.8, 1.6);
  });
  front('Waschküche', -42.8, -30, 6.4, 'tile', (cx, cz) => {
    for (let k = 0; k < 3; k++) { A(KE, 'copper', lathe([[0.5, 0], [0.55, 0.9], [0.6, 0.95]], 16), cx - 3 + k * 2.5, KY, cz - 6); glow(cx - 3 + k * 2.5, KY + 1.4, cz - 6, [1.2, 1.2, 1.2], 0.5); col(cx - 3.6 + k * 2.5, KY, cz - 6.6, cx - 2.4 + k * 2.5, KY + 1, cz - 5.4); }
    for (let k = 0; k < 4; k++) { box(KE, 'iron', 0.04, 0.04, 14, cx - 4 + k * 2.6, KY + 2.4, cz); for (let j = 0; j < 7; j++) A(KE, 'linen', new T.BoxGeometry(0.5, 0.7 + (j % 3) * 0.2, 0.02), cx - 4 + k * 2.6, KY + 2.0, cz - 6 + j * 2); }
    box(KE, 'wood', 8, 0.85, 1.0, cx, KY, cz + 7); box(KE, 'white', 8, 0.05, 1.0, cx, KY + 0.85, cz + 7); col(cx - 4, KY, cz + 6.5, cx + 4, KY + 0.9, cz + 7.5);
    glow(cx, KY + KH - 0.4, cz, [1.3, 0.9, 0.6], 1.6);
  });
  front('Vorratskammer', -29.4, -14.7, -1.6, 'stoneF', (cx, cz) => {
    for (const lz of [cz - 4, cz, cz + 4]) { for (let k = 0; k < 4; k++) box(KE, 'wood', 12, 0.04, 0.6, cx, KY + 0.4 + k * 0.7, lz); col(cx - 6, KY, lz - 0.35, cx + 6, KY + 2.6, lz + 0.35); for (let k = 0; k < 20; k++) for (let j = 0; j < 4; j++) A(KE, j % 2 ? 'bottle' : (k % 3 ? 'white' : 'copper'), new T.CylinderGeometry(0.08, 0.08, 0.26, 8), cx - 5.7 + k * 0.6, KY + 0.44 + j * 0.7, lz); }
    for (let k = 0; k < 6; k++) A(KE, 'wood', new T.CylinderGeometry(0.35, 0.3, 0.7, 10), cx - 5 + k * 2, KY, cz + 5.5);
    glow(cx, KY + KH - 0.4, cz, [1.3, 0.9, 0.6], 1.4);
  });
  front('Kesselraum', -14.3, 14.3, -1.6, 'stoneF', (cx, cz) => {
    for (let k = 0; k < 3; k++) { const lx = cx - 7 + k * 7; A(KE, 'iron', new T.CylinderGeometry(1.6, 1.6, 3.0, 18), lx, KY + 1.5, cz - 1.5); A(KE, 'iron', new T.SphereGeometry(1.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), lx, KY + 3.0, cz - 1.5); col(lx - 1.7, KY, cz - 3.2, lx + 1.7, KY + 3.4, cz + 0.2); A(KE, 'fire', new T.PlaneGeometry(0.8, 0.5), lx, KY + 0.7, cz + 0.12); glow(lx, KY + 0.7, cz + 0.6, [1.5, 0.6, 0.2], 2.0); for (const dx of [-0.8, 0.8]) A(KE, 'copper', new T.CylinderGeometry(0.1, 0.1, 6, 8).rotateX(Math.PI / 2), lx + dx, KY + 3.2, cz + 1.5); A(KE, 'brassM', new T.TorusGeometry(0.25, 0.04, 6, 16).rotateX(Math.PI / 2), lx + 1.0, KY + 2.2, cz + 0.4); }
    box(KE, 'copper', 0.2, 0.2, 28, 0, KY + 3.1, cz + 2.5); box(KE, 'iron', 28, 0.1, 0.1, 0, KY + 3.3, cz + 4);
    A(KE, 'tealG', new T.SphereGeometry(2, 10, 8).scale(3, 0.6, 1), cx, KY + 3.0, cz + 2); light(cx, KY + 2.5, cz, 0xffa060, 0.8, 18);
    person('livery', [0.3, 0.28, 0.26], cx + 3, cz + 3, KY, Math.PI);
  });
  front('Weinkeller', 14.7, 29.4, -1.6, 'stoneF', (cx, cz) => {
    for (const lx of [cx - 6, cx - 2, cx + 2, cx + 6]) { for (let k = 0; k < 5; k++) box(KE, 'wood', 0.5, 0.04, 9, lx, KY + 0.4 + k * 0.55, cz - 1); box(KE, 'wood', 0.06, 3.0, 9, lx - 0.25, KY, cz - 1); box(KE, 'wood', 0.06, 3.0, 9, lx + 0.25, KY, cz - 1); col(lx - 0.3, KY, cz - 5.5, lx + 0.3, KY + 3.0, cz + 3.5); for (let k = 0; k < 5; k++) for (let j = 0; j < 26; j++) A(KE, j % 4 === 0 ? 'bottle' : 'black', new T.CylinderGeometry(0.04, 0.04, 0.3, 6).rotateZ(Math.PI / 2), lx, KY + 0.48 + k * 0.55, cz - 5.3 + j * 0.34); }
    for (let k = 0; k < 4; k++) { A(KE, 'wood', new T.CylinderGeometry(0.55, 0.55, 1.1, 14).rotateZ(Math.PI / 2), cx - 4.5 + k * 3, KY + 0.55, cz + 4.6); for (const dx of [-0.4, 0.4]) A(KE, 'iron', new T.TorusGeometry(0.56, 0.03, 4, 14).rotateY(Math.PI / 2), cx - 4.5 + k * 3 + dx, KY + 0.55, cz + 4.6); }
    col(cx - 5, KY, cz + 4, cx + 5, KY + 1.1, cz + 5.2);
    furn(KE, FURN.roundTable(0.5, 0.95), FM, cx, KY, cz + 1.8); for (const sd of [-1, 1]) furn(KE, FURN.barStool(), FL, cx + sd * 0.8, KY, cz + 1.8);
    for (let k = 0; k < 3; k++) A(KE, 'lamp', new T.CylinderGeometry(0.03, 0.03, 0.14, 6), cx - 0.2 + k * 0.2, KY + 1.05, cz + 1.8); glow(cx, KY + 1.2, cz + 1.8, [1.4, 0.85, 0.4], 0.8);
    glow(cx, KY + KH - 0.4, cz - 2, [1.3, 0.75, 0.4], 1.6); light(cx, KY + 2.6, cz, 0xffc080, 0.7, 16);
  });
  // ---------- Schwimmhalle unter dem Ballsaal ----------
  room('Schwimmhalle', KE, 30.3, 54.4, -22.4, 6.4, KY, 'Dampf über türkisem Wasser');
  floor(KE, 'tile', 30.3, 54.4, -22.4, 6.4, KY + 0.03); ceiling(KE, 'cream', 30.3, 54.4, -22.4, 6.4, KY + KH - 0.05);
  wall(KE, 'tile', 'z', 30.3, -22.4, 6.4, KY, KH, 0.14, [[-15.5, -13.5, 2.6]], { col: false, side: 1, trim: false }); wall(KE, 'tile', 'z', 54.3, -22.4, 6.4, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
  wall(KE, 'tile', 'x', -22.3, 30.3, 54.4, KY, KH, 0.14, [], { col: false, side: 1, trim: false }); wall(KE, 'tile', 'x', 6.3, 30.3, 54.4, KY, KH, 0.14, [], { col: false, side: -1, trim: false });
  door(KE, 'z', 30, -14.5, 2, 2.6, { double: true, glass: true, y: KY });
  // Becken: Wände und Boden gefliest, Wasser mit Kaustik, Stufen am Kopfende, Goldleiter
  const PX0 = 35, PX1 = 50, PZ0 = -9, PZ1 = -1, PB = KY - 1.6;
  floor(KE, 'tile', PX0, PX1, PZ0, PZ1, PB + 0.02); col(PX0 - 0.5, PB - 0.3, PZ0 - 0.5, PX1 + 0.5, PB, PZ1 + 0.5);
  box(KE, 'tile', 0.3, KY - PB, PZ1 - PZ0, PX0 - 0.15, PB, (PZ0 + PZ1) / 2); box(KE, 'tile', 0.3, KY - PB, PZ1 - PZ0, PX1 + 0.15, PB, (PZ0 + PZ1) / 2);
  box(KE, 'tile', PX1 - PX0 + 0.6, KY - PB, 0.3, (PX0 + PX1) / 2, PB, PZ0 - 0.15); box(KE, 'tile', PX1 - PX0 + 0.6, KY - PB, 0.3, (PX0 + PX1) / 2, PB, PZ1 + 0.15);
  A(KE, 'water', new T.PlaneGeometry(PX1 - PX0, PZ1 - PZ0).rotateX(-Math.PI / 2), (PX0 + PX1) / 2, KY - 0.25, (PZ0 + PZ1) / 2);
  box(KE, 'gold', PX1 - PX0 + 0.8, 0.06, 0.25, (PX0 + PX1) / 2, KY, PZ0 - 0.25); box(KE, 'gold', PX1 - PX0 + 0.8, 0.06, 0.25, (PX0 + PX1) / 2, KY, PZ1 + 0.25); box(KE, 'gold', 0.25, 0.06, PZ1 - PZ0, PX0 - 0.25, KY, (PZ0 + PZ1) / 2); box(KE, 'gold', 0.25, 0.06, PZ1 - PZ0, PX1 + 0.25, KY, (PZ0 + PZ1) / 2);
  for (let k = 0; k < 3; k++) { const y = PB + k * 0.53, w = 2.0; box(KE, 'tile', 0.6 * (3 - k), 0.53, w, PX0 + 0.3 * (3 - k), y, -5); col(PX0, y, -6, PX0 + 0.6 * (3 - k), y + 0.53, -4); }
  for (const sd of [-1, 1]) A(KE, 'gold', new T.CylinderGeometry(0.03, 0.03, 2.2, 8), PX1 - 0.3, KY - 0.6, -5 + sd * 0.3); for (let k = 0; k < 4; k++) A(KE, 'gold', new T.CylinderGeometry(0.02, 0.02, 0.6, 6).rotateX(Math.PI / 2), PX1 - 0.3, KY - 1.3 + k * 0.4, -5);
  for (let k = 0; k < 10; k++) glow(PX0 + 1.5 + k * 1.4, KY - 1.0, k % 2 ? PZ0 + 0.2 : PZ1 - 0.2, [0.3, 1.1, 1.1], 1.6);
  for (const lx of [32.4, 52.3]) for (let k = 0; k < 5; k++) column(KE, lx, -19 + k * 6, KY, KH - 0.05, 0.4);
  for (const lz of [-20, 4]) for (let k = 0; k < 5; k++) column(KE, 35 + k * 3.8, lz, KY, KH - 0.05, 0.3);
  for (let k = 0; k < 6; k++) { const lx = 36 + k * 2.6; A(KE, 'linen', new T.BoxGeometry(0.7, 0.3, 1.9).rotateX(-0.25), lx, KY + 0.35, 3.2); A(KE, 'gold', new T.BoxGeometry(0.72, 0.05, 1.9), lx, KY + 0.2, 3.2); col(lx - 0.4, KY, 2.2, lx + 0.4, KY + 0.5, 4.2); }
  for (const [lx, lz] of [[31.6, 5.4], [53.2, 5.4], [31.6, -21.2], [53.2, -21.2], [42.5, -19]]) palm(KE, lx, lz, KY, 2.4);
  A(KE, 'tealG', new T.PlaneGeometry(16, 9).rotateX(-Math.PI / 2), 42.5, KY + 0.9, -5); A(KE, 'tealG', new T.PlaneGeometry(18, 10).rotateX(-Math.PI / 2), 42.5, KY + 1.8, -5);
  A(KE, 'tile', new T.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2).rotateY(Math.PI / 4), 42.5, KY + 0.035, -14.5); box(KE, 'gold', 0.12, 0.02, 6, 42.5, KY + 0.035, -17.5);
  for (const lx of [36, 42.5, 49]) { A(KE, 'gold', new T.TorusGeometry(0.9, 0.05, 6, 24).rotateX(Math.PI / 2), lx, KY + KH - 0.7, -5); for (let k = 0; k < 8; k++) A(KE, 'lamp', new T.OctahedronGeometry(0.07), lx + Math.cos(k * 0.785) * 0.9, KY + KH - 0.85, -5 + Math.sin(k * 0.785) * 0.9); glow(lx, KY + KH - 0.9, -5, [0.6, 1.2, 1.2], 2.2); }
  light(42.5, KY + 2.4, -5, 0x60e0d8, 1.0, 26); light(42.5, KY + 2.0, -17, 0xffd0a0, 0.5, 14);
  person('gown', pick(GOWNS), 44, 2, KY, Math.PI); person('tux', [1, 1, 1], 46.5, 2, KY, Math.PI * 0.9); person('livery', WHITE, 33, -10, KY, Math.PI / 2);

  /* ================= Zusammenbau: je Zone und Material ein Netz ================= */
  const WUV = { marble: 4.2, parq: 4.0, plaster: 4.2, panel: 2.0, tile: 2.2, bluewall: 4.2, greenwall: 4.2, hedge: 1.6, brick: 2.0 };
  const cs = VR.cs, sn = VR.sn;
  for (const key in B) {
    const [zone, mk] = key.split('|');
    const list = B[key].map(g => { if (g.index) g = g.toNonIndexed(); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
    const g = mergeGeos(list); g.rotateY(ry); g.translate(VILLA.x, by, VILLA.z);
    if (WUV[mk]) worldUV(g, WUV[mk]);
    const mat = mats[mk]; if (!mat) { console.warn('Villa: Material fehlt', mk); continue; }
    const m = new T.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = mk === 'glassW' || mk === 'tealG' ? 3 : 0;
    (VR.groups[zone] ||= new T.Group()).add(m);
  }
  for (const z in VR.groups) { VR.groups[z].visible = false; scene.add(VR.groups[z]); }
  // Randolf ansprechen
  INTERACT.push({
    test: p => { const a = VR.randolf; if (!a || !VR.groups.eg || !VR.groups.eg.visible) return false; const e = a.m.elements; return (p.x - e[12]) ** 2 + (p.z - e[14]) ** 2 < 2.4 * 2.4 && Math.abs(p.y - e[13]) < 2; },
    label: 'Mit Randolf sprechen', act: () => { VR.said = (VR.said + 1) % RANDOLF_SAYS.length; toast(`Randolf: „${RANDOLF_SAYS[VR.said]}“`); },
  });
}

/* ---------- Je Bild: Zonen ein- und ausblenden, Türen schwingen, Tänzer im Ballsaal, Raumnamen ---------- */
export function updateVillaZones(near) {
  const G = VR.groups; if (!G.eg) return;
  if (!near) { if (!VR.far) { for (const z in G) G[z].visible = false; for (const d of VR.doors) d.grp.visible = false; if (VR.extra) for (const m of VR.extra) m.visible = false; VR.far = true; } return; }
  VR.far = false;
  const l = villaLocal(player.p), dist = Math.hypot(l.x, l.z), lim = MOBILE ? 120 : 190;
  const inH = inVillaHouse(player.p);
  const eg = dist < lim, og = eg && (!inH || l.y > 4 || (Math.abs(l.x) < 17.5 && l.z < -1)), kel = eg && inH && l.y < -0.3;
  const vis = { eg, og, kel };
  for (const z in G) G[z].visible = !!vis[z];
  for (const d of VR.doors) d.grp.visible = !!vis[d.zone];
  if (VR.extra) for (const m of VR.extra) m.visible = !!vis[m.userData.zone];
  return vis;
}
export function updateVillaRooms(t, C, rot) {
  const vis = updateVillaZones(true); if (!vis) return;
  const dt = Math.min(0.1, Math.max(0, t - (VR.lastT ?? t))); VR.lastT = t;
  const l = villaLocal(player.p);
  // Türen öffnen sich, wenn der Spieler nahe kommt
  for (const d of VR.doors) {
    if (!d.grp.visible) continue;
    const dx = l.x - d.lx, dz = l.z - d.lz, dy = l.y - d.y, want = d.fixed || (dx * dx + dz * dz < 7.3 && dy > -1.5 && dy < 2.5) ? 1 : 0;
    if (Math.abs(want - d.open) < 0.002) continue;
    d.open += (want - d.open) * Math.min(1, dt * 3.2);
    for (const L of d.leaves) L.m.rotation.y = L.s * d.open * 1.5 * d.dir;
  }
  // Tänzer und Band im Ballsaal
  if (vis.eg) for (const c of VR.dancers) placeCouple(C, c, t, VR.ballF, 0, 0, VR.by, rot);
  // Raumnamen beim Betreten, Randolfs Gruß in der Halle
  let r = null;
  for (const q of VR.rooms) if (l.x > q.x0 && l.x < q.x1 && l.z > q.z0 && l.z < q.z1 && l.y > q.y - 0.4 && l.y < q.y + 4.5) { r = q; break; }
  if (r && r !== VR.room) {
    VR.room = r;
    if (!r.seen) { r.seen = true; toast(r.name === 'Eingangshalle' ? 'Randolf: „Guten Abend, Sir. Willkommen zu Hause.“' : r.hint ? `${r.name} · ${r.hint}` : r.name); }
    else toast(r.name);
  }
}
