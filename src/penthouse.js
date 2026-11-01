import { T, scene, camera, MOBILE, mergeGeos } from './core.js';
import { wantTexture } from './assets.js';
import { addCollider, stdMat, MAT } from './people-skeleton.js';
import { addSeg, addNeon, addGlow, NEON } from './facade-shader.js';
import { FURN, placeFurn, roundBox, lathe, tube } from './entrances.js';
import { poolWaterMat } from './water.js';
import { player } from './player.js';
import { addLight } from './performance.js';
import { BEL, boxW, marbleTex } from './belmont.js';
import { inlayFloorTex, travertineTex, decoRugTex, damaskTex, veneerTex, onyxTex, cofferTex2, booksTex, tileTex, mosaicTex, glowRoomTex } from './deco-tex.js';

/* =====================================================================
   V33 · ALEXANDERS PENTHOUSE-SUITE IM BELMONT (250 m, in der Turmstufe über der Terrasse)
   Das Belmont gehört Alexander; die Suite ist privat. 40 x 40 m hinter einer Glasfassade mit Goldsprossen.
   Ebene 1 (250 m): Salon mit doppelter Höhe, Esstisch, Flügel, Grammophon, Küche, Bar mit Rauchersalon,
     Foyer mit privatem Fahrstuhl, Wendeltreppe in der Mitte.
   Ebene 2 (256,4 m): Schlafzimmer, Bad mit freistehender Wanne und Dusche, Bibliotheks-Galerie über dem Salon.
   Schiebetüren aus Glas führen auf die Terrasse, die nach Süden, Osten und Westen auskragt
   (Travertin, Becken, Liegen, Feuerschalen, Pflanzen, Tafel, Laternen).
   Innenleben wird nur in der Nähe gezeichnet; von weitem leuchtet ein warmer Kasten hinter dem Glas.
   ===================================================================== */
export const PH = {
  F1: 250, F2: 256.4, SLAB: 256.0, TOP: 263, W: 19.95,
  stair: { x: 0, z: -4, r: 2.55, n: 27, turn: Math.PI * 2.5 },
  doors: [], inner: null, terrace: null, far: null, shell: null,
};
// Spieler in der Suite (für Licht, Nebel, Regen, Musik, Ortsnamen)
export const inPenthouse = p => Math.abs(p.x) < 20 && Math.abs(p.z) < 20 && p.y > PH.F1 - 0.5 && p.y < PH.TOP;
export const onPentTerrace = p => Math.abs(p.x) < 32 && Math.abs(p.z) < 36 && p.y > PH.F1 - 0.5 && p.y < PH.F1 + 6 && !inPenthouse(p);

export function buildPenthouse() {
  const { F1, F2, SLAB, TOP, W } = PH;
  const inner = new T.Group(), terr = new T.Group(), shell = new T.Group();
  PH.inner = inner; PH.terrace = terr; PH.shell = shell; scene.add(inner, terr, shell);
  const B = { inner: {}, terr: {}, shell: {} };
  const put = (k, g, where = 'inner') => (B[where][k] ||= []).push(g);
  const col = addCollider;
  const glow = (x, y, z, c, s) => addGlow(x, y, z, c, s);
  const BOX = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);
  const CYL = (r0, r1, h, x, y, z, n = 16) => new T.CylinderGeometry(r0, r1, h, n).translate(x, y, z);
  // Rechteck in der Waagerechten mit UV aus einem Rahmen [X0, Z0, B, T] (Leinwand oben = Norden) oder gekachelt (rep Meter)
  const rectXZ = (x0, x1, z0, z1, y, frame, down = false, rep = 0) => {
    const g = new T.BufferGeometry(), P = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const pos = [], uv = [];
    for (const [x, z] of P) { pos.push(x, y, z); if (rep) uv.push(x / rep, -z / rep); else uv.push((x - frame[0]) / frame[2], 1 - (z - frame[1]) / frame[3]); }
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(down ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); return g;
  };

  // ---------- Materialien ----------
  const whiteT = marbleTex('#e6e0d4', '#7a7064', 21, 50); whiteT.wrapS = whiteT.wrapT = T.RepeatWrapping;
  const blackT = marbleTex('#0a090b', '#a09070', 22, 40); blackT.wrapS = blackT.wrapT = T.RepeatWrapping;
  const off = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const floor1T = inlayFloorTex(40, 40, { seed: 31, fields: [[1.2, 20.6, 38.8, 38.8], [14, 4.4, 26, 13.6]], stars: [[20, 9, 1.9], [20, 29.5, 3.2]], checker: [[0.3, 0.3, 13, 14]] });
  const floor2T = inlayFloorTex(40, 19.5, { res: 1200, seed: 32, fields: [[1, 1, 14.6, 18.6], [15.4, 3.6, 24.6, 15.8]], wood: [[25, 0.05, 39.95, 19.45]] });
  const M = {
    floor1: stdMat({ map: floor1T, roughness: 0.22, metalness: 0.05, envI: 0.9, ...off }),
    floor2: stdMat({ map: floor2T, roughness: 0.28, metalness: 0.05, envI: 0.8, ...off }),
    terr: stdMat({ map: travertineTex(), roughness: 0.75, envI: 0.3, ...off }),
    white: stdMat({ map: whiteT, roughness: 0.18, metalness: 0.03, envI: 0.75 }),
    dark: wantTexture(stdMat({ map: blackT, roughness: 0.12, metalness: 0.05, envI: 0.85 }), { map: 'marble-color', normalMap: 'marble-normal', roughnessMap: 'marble-rough', repeat: [2, 2], normalScale: 0.5, roughness: 0.45, color: 0xfff4e4 }),
    gold: wantTexture(MAT.gold.clone(), { map: 'gold-color', normalMap: 'gold-normal', roughnessMap: 'gold-rough', repeat: [3, 3], normalScale: 0.35, roughness: 0.9, color: 0xf2d79a }),
    chrome: MAT.chrome, lacquer: MAT.black,
    glass: new T.MeshStandardMaterial({ color: 0x18282a, metalness: 0.7, roughness: 0.04, transparent: true, opacity: 0.2, depthWrite: false, side: T.DoubleSide, emissive: 0x120c06 }),
    veneer: stdMat({ map: veneerTex(), roughness: 0.18, metalness: 0.05, envI: 0.8 }),
    velvet: stdMat({ color: 0x0f4a4c, roughness: 0.9, envI: 0.12 }),
    cream: stdMat({ color: 0xe6d7bc, roughness: 0.85, envI: 0.15 }),
    champ: stdMat({ color: 0xc9ae7c, roughness: 0.6, metalness: 0.25, envI: 0.4 }),
    bordeaux: stdMat({ color: 0x5a1220, roughness: 0.85, envI: 0.12 }),
    leather: stdMat({ color: 0x6a3416, roughness: 0.42, envI: 0.55 }),
    linen: stdMat({ color: 0xf2ece0, roughness: 0.85, envI: 0.2, emissive: 0x15110a }),
    onyx: stdMat({ map: onyxTex(), emissiveMap: null, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.15, envI: 0.6 }),
    lamp: new T.MeshBasicMaterial({ color: new T.Color(1.45, 1.12, 0.7) }),
    crystal: new T.MeshBasicMaterial({ color: new T.Color(1.25, 1.18, 1.05) }),
    bottles: new T.MeshBasicMaterial({ color: new T.Color(0.85, 0.5, 0.2) }),
    bottlesG: new T.MeshBasicMaterial({ color: new T.Color(0.25, 0.55, 0.3) }),
    mirror: stdMat({ color: 0xc9d0d4, metalness: 1, roughness: 0.04, envI: 1.4 }),
    tile: stdMat({ map: tileTex(), roughness: 0.2, envI: 0.8 }),
    cab: stdMat({ color: 0xece4d4, roughness: 0.3, envI: 0.6 }),
    iron: stdMat({ color: 0x141416, roughness: 0.5, metalness: 0.6, envI: 0.5 }),
    leaf: stdMat({ color: 0x1d4a2c, roughness: 0.7, envI: 0.2, side: T.DoubleSide }),
    trunk: stdMat({ color: 0x3a2a1a, roughness: 0.9, env: false }),
    bloom: stdMat({ color: 0xf2e6e0, roughness: 0.7, envI: 0.2, emissive: 0x2a1a18 }),
    rose: stdMat({ color: 0x9a1828, roughness: 0.7, envI: 0.2, emissive: 0x200408 }),
    coffer: stdMat({ map: cofferTex2(), roughness: 0.5, metalness: 0.2, envI: 0.5, emissive: 0x2a2014 }),
    damask: stdMat({ map: damaskTex('#123c3e', '#1d5356'), roughness: 0.55, metalness: 0.15, envI: 0.4 }),
    books: stdMat({ map: booksTex(), roughness: 0.7, envI: 0.2, emissive: 0x0c0806 }),
    mosaic: stdMat({ map: mosaicTex(), roughness: 0.2, envI: 0.7, emissive: 0x041a1c }),
    fire: new T.MeshBasicMaterial({ color: new T.Color(1.6, 0.75, 0.25) }),
    stone: stdMat({ color: 0x8a8070, roughness: 0.6, envI: 0.35 }),
    cushion: stdMat({ color: 0xf0e6d2, roughness: 0.9, envI: 0.12 }),
    rug1: stdMat({ map: decoRugTex('#e2d4b8', '#a8823c', '#0d3a3c', 12, 8), roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    rug2: stdMat({ map: decoRugTex('#0d2f33', '#c9a050', '#4a0c14', 6, 5), roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
  // Onyx leuchtet von hinten: Eigenleuchten aus derselben Textur
  M.onyx.emissiveMap = M.onyx.map; M.onyx.emissiveIntensity = 0.75;

  /* ================= Fassade der Suite: Glas mit Goldsprossen, Schiebetüren ================= */
  const DOOR_H = 3.2, BAY = 2.5;
  // Türfelder: Seite, Feldanfang, Richtung des Aufschiebens
  const DOORS = [['S', -2.5, -1], ['S', 0, 1], ['E', 5, 1], ['W', 5, 1], ['N', 7.5, 1]];
  const isDoor = (side, u0) => DOORS.some(d => d[0] === side && Math.abs(d[1] - u0) < 0.01);
  const SIDES = { S: [0, 1], N: [0, -1], E: [1, 0], W: [-1, 0] };
  for (const side in SIDES) {
    const [ox, oz] = SIDES[side], ax = oz !== 0;   // ax: Wand läuft entlang x
    const at = (u, off2 = 0) => ax ? [u, oz * (W + off2)] : [ox * (W + off2), u];
    const ry = ax ? (oz > 0 ? 0 : Math.PI) : (ox > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const u0 = -20 + i * BAY, um = u0 + BAY / 2, [x, z] = at(um), door = isDoor(side, u0);
      if (!door) { put('glass', new T.PlaneGeometry(BAY, DOOR_H).rotateY(ry).translate(x, F1 + DOOR_H / 2, z), 'shell'); }
      put('glass', new T.PlaneGeometry(BAY, SLAB - F1 - DOOR_H).rotateY(ry).translate(x, (F1 + DOOR_H + SLAB) / 2, z), 'shell');
      put('glass', new T.PlaneGeometry(BAY, 260.0 - 256.8).rotateY(ry).translate(x, (256.8 + 260) / 2, z), 'shell');
      put('glass', new T.PlaneGeometry(BAY, 262.6 - 260.0).rotateY(ry).translate(x, 261.3, z), 'shell');
      // Fächer im Oberlicht
      for (let k = -2; k <= 2; k++) { const a = k * 0.32, [fx, fz] = at(um, 0.03); put('gold', BOX(0.05, 2.2, 0.05).translate(0, 1.1, 0).rotateZ(a).rotateY(ry).translate(fx, 260.05, fz), 'shell'); }
      // Wandfelder: Kollision, an Türen nur oberhalb der Tür
      const [cx0, cz0] = at(u0), [cx1, cz1] = at(u0 + BAY);
      const bx0 = Math.min(cx0, cx1) - (ax ? 0 : 0.15), bx1 = Math.max(cx0, cx1) + (ax ? 0 : 0.15), bz0 = Math.min(cz0, cz1) - (ax ? 0.15 : 0), bz1 = Math.max(cz0, cz1) + (ax ? 0.15 : 0);
      col(bx0, door ? F1 + DOOR_H : F1, bz0, bx1, TOP, bz1);
    }
    // Sprossen (Ecksprossen nur einmal, sonst flackern zwei gleiche Kanten), Riegel, Brüstungsband (schwarz mit Goldkanten) auf Höhe der Galerie, Traufband
    for (let i = ax ? 0 : 1; i <= (ax ? 16 : 15); i++) { const [x, z] = at(-20 + i * BAY, 0.02); put('gold', (ax ? BOX(0.12, TOP - F1, 0.16) : BOX(0.16, TOP - F1, 0.12)).translate(x, (F1 + TOP) / 2, z), 'shell'); }
    const [mx, mz] = at(0, 0.02), L = ax ? 40.2 : 39.7;
    const hb = (h, y, t = 0.14, mat = 'gold') => put(mat, (ax ? BOX(L, h, t) : BOX(t, h, L)).translate(mx, y, mz), 'shell');
    hb(0.12, F1 + DOOR_H); hb(0.8, 256.4, 0.3, 'lacquer'); hb(0.08, 256.0); hb(0.08, 256.8); hb(0.1, 260.0); hb(0.4, 262.8, 0.3); hb(0.18, F1 + 0.09, 0.3);
  }
  // Schiebetüren: Glasflügel mit Goldrahmen, gleiten beim Näherkommen vor das Nachbarfeld
  for (const [side, u0, dir] of DOORS) {
    const [ox, oz] = SIDES[side], ax = oz !== 0, um = u0 + BAY / 2;
    const g = new T.Group(); const ry = ax ? (oz > 0 ? 0 : Math.PI) : (ox > 0 ? Math.PI / 2 : -Math.PI / 2);
    const lb = {};
    const lput = (k, geo) => (lb[k] ||= []).push(geo);
    lput('glass', new T.PlaneGeometry(BAY - 0.1, DOOR_H - 0.1).translate(0, DOOR_H / 2, 0));
    for (const [w, h, x, y] of [[BAY, 0.1, 0, 0.05], [BAY, 0.1, 0, DOOR_H - 0.05], [0.1, DOOR_H, -BAY / 2 + 0.05, DOOR_H / 2], [0.1, DOOR_H, BAY / 2 - 0.05, DOOR_H / 2], [BAY, 0.05, 0, 1.0]]) lput('gold', BOX(w, h, 0.07, x, y, 0));
    lput('gold', BOX(0.04, 0.9, 0.12, dir * -(BAY / 2 - 0.25), 1.1, 0));
    for (const k in lb) { const m = new T.Mesh(mergeGeos(lb[k].map(q => q.attributes.uv ? q : q)), M[k]); if (k === 'glass') m.renderOrder = 3; g.add(m); }
    g.rotation.y = ry;
    const base = ax ? new T.Vector3(um, F1, oz * (W - 0.12)) : new T.Vector3(ox * (W - 0.12), F1, um);
    g.position.copy(base); shell.add(g);
    const t = ax ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, 1);
    const c0 = ax ? [u0, oz * W - 0.15, u0 + BAY, oz * W + 0.15] : [ox * W - 0.15, u0, ox * W + 0.15, u0 + BAY];
    const c = col(c0[0], F1, c0[1], c0[2], F1 + DOOR_H, c0[3]);
    PH.doors.push({ g, base, t, dir, c, open: 0, cx: ax ? um : ox * W, cz: ax ? oz * W : um });
  }
  // Ferne: warmer Kasten hinter dem Glas statt des Innenlebens (V34: 80 cm hinter Glas und Sprossen statt 25 cm, die flackerten aus der Ferne dagegen)
  { const t = glowRoomTex(); t.wrapS = T.RepeatWrapping; t.repeat.set(2, 1);
    const far = new T.Mesh(new T.BoxGeometry(38.4, TOP - F1 - 0.4, 38.4), new T.MeshBasicMaterial({ map: t, color: new T.Color(0.8, 0.7, 0.6) }));
    far.position.set(0, (F1 + TOP) / 2, 0); scene.add(far); PH.far = far; }

  /* ================= Böden, Decken, Galerie, Kern ================= */
  const st = PH.stair, HX = 2.75, hz0 = st.z - 2.75, hz1 = st.z + 2.75;
  put('floor1', rectXZ(-W, W, -W, W, F1 + 0.02, [-20, -20, 40, 40]));
  const F2F = [-20, -19.95, 40, 19.5];
  for (const [x0, x1, z0, z1] of [[-W, W, -W, hz0], [-W, -HX, hz0, hz1], [HX, W, hz0, hz1], [-W, W, hz1, -0.5]]) {
    put('floor2', rectXZ(x0, x1, z0, z1, F2 + 0.01, F2F));
    put('coffer', rectXZ(x0, x1, z0, z1, SLAB - 0.01, null, true, 2.5));
    col(x0, SLAB, z0, x1, F2, z1);
  }
  put('coffer', rectXZ(-W, W, -W, W, TOP - 0.06, null, true, 2.5));
  // Stirnseite der Galerie und des Treppenauges
  put('lacquer', BOX(2 * W, 0.42, 0.12, 0, (SLAB + F2) / 2, -0.44)); put('gold', BOX(2 * W, 0.05, 0.16, 0, SLAB + 0.02, -0.42)); put('gold', BOX(2 * W, 0.05, 0.16, 0, F2 - 0.02, -0.42));
  for (const [w, d, x, z] of [[2 * HX, 0.1, 0, hz0], [2 * HX, 0.1, 0, hz1], [0.1, 2 * 2.75, -HX, st.z], [0.1, 2 * 2.75, HX, st.z]]) put('gold', BOX(w, 0.42, d, x, (SLAB + F2) / 2, z));
  // Aufzugskern (schwarzer Marmor, Goldkanten)
  put('dark', boxW(4, TOP - F1, 3.45, 0, (F1 + TOP) / 2, -W + 1.725, 2)); col(-2, F1, -W, 2, TOP, -16.5);
  for (const x of [-2.02, 2.02]) put('gold', BOX(0.06, TOP - F1, 0.06, x, (F1 + TOP) / 2, -16.48));
  // Fahrstuhltür mit Sonnenstrahl und Stockwerksanzeige
  put('gold', BOX(2.3, 3.1, 0.06, 0, F1 + 1.55, -16.45)); put('dark', BOX(0.04, 3.1, 0.08, 0, F1 + 1.55, -16.42));
  for (let k = -5; k <= 5; k++) put('lacquer', BOX(0.03, 1.4, 0.02, 0, 0.7, 0).rotateZ(k * 0.24).translate(0, F1 + 1.9, -16.41));
  put('gold', new T.CylinderGeometry(0.55, 0.55, 0.05, 24, 1, false, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, F1 + 3.35, -16.44));
  glow(0, F1 + 3.5, -16.2, [1.4, 1.0, 0.55], 1.2);

  /* ================= Wände: Küche, Bar, Ebene 2 ================= */
  // Wand aus zwei Schalen (je Seite eigenes Material), entlang x oder z, mit Lücken [a, b]
  const wall = (axis, c, a0, a1, y0, y1, matA, matB, gaps = []) => {
    const segs = []; let s = a0;
    for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }
    if (a1 > s) segs.push([s, a1]);
    for (const [p0, p1] of segs) {
      const L = p1 - p0, m = (p0 + p1) / 2, h = y1 - y0, ym = (y0 + y1) / 2;
      if (axis === 'x') { put(matA, boxW(L, h, 0.1, m, ym, c - 0.05, 2)); put(matB, boxW(L, h, 0.1, m, ym, c + 0.05, 2)); col(p0, y0, c - 0.1, p1, y1, c + 0.1); }
      else { put(matA, boxW(0.1, h, L, c - 0.05, ym, m, 2)); put(matB, boxW(0.1, h, L, c + 0.05, ym, m, 2)); col(c - 0.1, y0, p0, c + 0.1, y1, p1); }
      put('gold', axis === 'x' ? BOX(L, 0.12, 0.24, m, y0 + 0.06, c) : BOX(0.24, 0.12, L, c, y0 + 0.06, m));
    }
    for (const [g0, g1] of gaps) for (const e of [g0, g1]) put('gold', axis === 'x' ? BOX(0.1, y1 - y0, 0.26, e, (y0 + y1) / 2, c) : BOX(0.26, y1 - y0, 0.1, c, (y0 + y1) / 2, e));
  };
  wall('z', -7, -W, -11, F1, SLAB, 'tile', 'white'); wall('z', 7, -W, -11, F1, SLAB, 'white', 'veneer');
  // Küche: Rückwände hinter dem Glas (Fliesen)
  put('tile', boxW(12.95, SLAB - F1, 0.1, -13.475, (F1 + SLAB) / 2, -W + 0.2, 1)); put('tile', boxW(0.1, SLAB - F1, 13.95, -W + 0.2, (F1 + SLAB) / 2, -12.975, 1));
  // Ebene 2: Bad (Westen), Schlafzimmer (Osten), Galerie in der Mitte
  wall('z', -5, -W, -0.5, F2, TOP, 'white', 'white', [[-10, -8.6]]);
  wall('z', 5, -W, -0.5, F2, TOP, 'damask', 'damask', [[-10, -8.6]]);
  wall('x', -0.5, -W, -5, F2, TOP, 'white', 'damask');
  wall('x', -0.5, 5, W, F2, TOP, 'damask', 'damask');
  // Zierfelder zur Salonseite: goldene Sonnenstrahlen über dem Damast
  for (const sx of [-1, 1]) {
    const cx = sx * 12.5;
    for (let k = -8; k <= 8; k++) put('gold', BOX(0.06, 4.6, 0.04).translate(0, 2.3, 0).rotateZ(k * 0.17).translate(cx, F2 + 0.6, -0.39));
    put('gold', new T.TorusGeometry(4.7, 0.07, 6, 40, Math.PI).translate(cx, F2 + 0.6, -0.38)); put('gold', new T.TorusGeometry(1.2, 0.06, 6, 24, Math.PI).translate(cx, F2 + 0.6, -0.38));
    for (const dx of [-6.5, 6.5]) { put('gold', CYL(0.05, 0.12, 0.4, cx + dx, F2 + 3.2, -0.3, 8).rotateX(0)); put('lamp', new T.ConeGeometry(0.25, 0.5, 12, 1, true).translate(cx + dx, F2 + 3.55, -0.25)); glow(cx + dx, F2 + 3.6, -0.15, [1.35, 0.95, 0.55], 1.4); }
  }
  // Galeriebrüstung (Glas mit Goldhandlauf) und Geländer am Treppenauge
  const rail = (x0, z0, x1, z1, y, where = 'inner', h = 1.05) => {
    const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    put('gold', ax ? BOX(L, 0.08, 0.12, mx, y + h, mz) : BOX(0.12, 0.08, L, mx, y + h, mz), where);
    put('glass', (ax ? new T.PlaneGeometry(L, h - 0.15) : new T.PlaneGeometry(L, h - 0.15).rotateY(Math.PI / 2)).translate(mx, y + (h - 0.1) / 2 + 0.05, mz), where);
    for (let t = 0; t <= L + 1e-6; t += Math.max(L / Math.ceil(L / 1.6), 0.4)) { const k = t / L; put('gold', BOX(0.07, h, 0.07, x0 + (x1 - x0) * k, y + h / 2, z0 + (z1 - z0) * k), where); }
    col(Math.min(x0, x1) - 0.1, y, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, y + h + 0.05, Math.max(z0, z1) + 0.1);
  };
  rail(-5, -0.55, 5, -0.55, F2);
  rail(-HX, hz0, HX, hz0, F2); rail(-HX, hz1, HX, hz1, F2); rail(-HX, hz0, -HX, hz1, F2);
  rail(HX, hz0, HX, st.z - 1.4, F2); rail(HX, st.z + 1.4, HX, hz1, F2);

  /* ================= Wendeltreppe (eineinviertel Umdrehungen, Mittelsäule, Goldgeländer) ================= */
  {
    const { x: cx, z: cz, r, n, turn } = st, rise = (F2 - F1) / n, da = turn / n;
    for (let k = 0; k < n; k++) {
      const a = k * da, top = F1 + (k + 1) * rise;
      put('dark', new T.CylinderGeometry(r, r, 0.09, 6, 1, false, a, da * 1.04).translate(cx, top - 0.045, cz));
      put('gold', new T.CylinderGeometry(r + 0.02, r + 0.02, 0.03, 6, 1, true, a, da).translate(cx, top - 0.03, cz));
      const am = a + da / 2, bx = cx + Math.sin(am) * (r - 0.1), bz = cz + Math.cos(am) * (r - 0.1);
      put('gold', CYL(0.018, 0.024, 0.95, bx, top + 0.475, bz, 6));
    }
    const hel = (rr, dy, N = 90) => Array.from({ length: N + 1 }, (_, i) => { const a = i / N * turn; return [cx + Math.sin(a) * rr, F1 + a / turn * (F2 - F1) + dy, cz + Math.cos(a) * rr]; });
    put('gold', tube(hel(r - 0.1, 1.0), 0.045, 140));
    put('dark', tube(hel(r - 0.05, -0.12), 0.11, 140));
    put('lacquer', CYL(0.62, 0.62, F2 + 1.1 - F1, cx, (F1 + F2 + 1.1) / 2, cz, 24));
    for (let y = F1 + 0.6; y < F2 + 1.1; y += 1.2) put('gold', new T.TorusGeometry(0.63, 0.04, 6, 24).rotateX(Math.PI / 2).translate(cx, y, cz));
    put('gold', new T.SphereGeometry(0.3, 16, 10).translate(cx, F2 + 1.35, cz)); glow(cx, F2 + 1.4, cz, [1.4, 1.05, 0.6], 1.4);
    // Kollision: dünne Rampenplatten auf drei Radien (sanft steigend, kein Hängenbleiben), Mittelsäule, Geländer außen
    col(cx - 0.65, F1, cz - 0.65, cx + 0.65, F2 + 1.15, cz + 0.65);
    const step = 4 * Math.PI / 180;
    for (let a = 0; a <= turn + 1e-6; a += step) {
      const y1 = F1 + 0.02 + a / turn * (F2 - F1 - 0.02);
      for (const rr of [1.3, 1.8, 2.3]) { const x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr; col(x - 0.28, y1 - 0.3, z - 0.28, x + 0.28, y1, z + 0.28); }
      if (a > 0.2 && a < turn - 0.6 && Math.round(a / step) % 2 === 0) { const x = cx + Math.sin(a) * 2.78, z = cz + Math.cos(a) * 2.78; col(x - 0.12, y1, z - 0.12, x + 0.12, y1 + 1.1, z + 0.12); }
    }
    // Austrittspodest oben: verbindet das Treppenende mit der Galerie (sonst Lücke bis zur Deckenkante)
    col(cx + 1.0, F2 - 0.25, cz - 1.45, cx + HX + 0.2, F2, cz + 0.3);
  }

  /* ================= Möbel ================= */
  const MAP = (up, extra = {}) => ({ up, frame: 'gold', wood: 'veneer', lamp: 'lamp', cloth: 'linen', leaf: 'leaf', ...extra });
  const furn = (parts, mp, x, y, z, ry = 0, where = 'inner') => placeFurn(parts, mp, (k, g) => put(k, g, where), x, y, z, ry);
  const palm = (x, y, z, h = 3.0, s = 1, where = 'inner') => {
    put('gold', CYL(0.5 * s, 0.36 * s, 0.85 * s, x, y + 0.425 * s, z), where);
    put('trunk', CYL(0.07 * s, 0.13 * s, h, x, y + 0.85 * s + h / 2, z, 6), where);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + x; put('leaf', new T.PlaneGeometry(0.5 * s, 1.9 * s).translate(0, 0.95 * s, 0).rotateX(-0.9 - (k % 3) * 0.2).rotateY(a).translate(x, y + 0.85 * s + h, z), where); }
    col(x - 0.5 * s, y, z - 0.5 * s, x + 0.5 * s, y + 1.2, z + 0.5 * s);
  };
  const flowers = (x, y, z, s, n, where = 'inner') => {
    for (let k = 0; k < n; k++) { const a = k * 2.399, rr = (0.04 + 0.05 * Math.sqrt(k / n)) * s * 2.2, h = (0.12 + 0.1 * (1 - k / n)) * s; put(k % 3 === 0 ? 'rose' : 'bloom', new T.SphereGeometry(0.035 * s * 1.6, 7, 5).translate(x + Math.cos(a) * rr, y + h, z + Math.sin(a) * rr), where); }
    for (let k = 0; k < 6; k++) put('leaf', new T.PlaneGeometry(0.06 * s, 0.22 * s).translate(0, 0.11 * s, 0).rotateX(-0.9).rotateY(k * 1.05).translate(x, y + 0.04 * s, z), where);
  };
  const vase = (x, y, z, s = 1, where = 'inner') => { put('crystal', lathe([[0.06 * s, 0], [0.1 * s, 0.06 * s], [0.07 * s, 0.24 * s], [0.1 * s, 0.3 * s]], 12).translate(x, y, z), where); flowers(x, y + 0.24 * s, z, s * 1.4, MOBILE ? 8 : 14, where); };
  const chandelier = (x, z, yTop, r, drop, tiers = 4) => {
    put('gold', CYL(0.05, 0.05, drop, x, yTop - drop / 2, z, 6));
    const y = yTop - drop;
    for (let t = 0; t < tiers; t++) {
      const tr = r * (1 - t * 0.22), dy = t * 0.75;
      put('gold', new T.TorusGeometry(tr, 0.06, 6, 40).rotateX(Math.PI / 2).translate(x, y + dy, z));
      const nn = Math.max(10, Math.round(tr * 10));
      for (let k = 0; k < nn; k++) { const a = k / nn * Math.PI * 2; put('crystal', CYL(0.03, 0.03, 0.8 + (k % 3) * 0.35, x + Math.cos(a) * tr, y + dy - 0.5, z + Math.sin(a) * tr, 4)); if (k % 3 === 0) glow(x + Math.cos(a) * tr, y + dy + 0.1, z + Math.sin(a) * tr, [1.35, 1.1, 0.7], 0.5); }
    }
    put('crystal', new T.ConeGeometry(r * 0.22, 1.4, 12).rotateX(Math.PI).translate(x, y - 0.7, z));
    glow(x, y + 0.5, z, [1.2, 0.85, 0.45], r * 4);
  };
  const table = (x, y, z, w, d, h = 0.76, mat = 'veneer', where = 'inner') => {
    put(mat, boxW(w, 0.06, d, x, y + h - 0.03, z, 1.5), where); put('gold', BOX(w + 0.02, 0.025, d + 0.02, x, y + h - 0.07, z), where);
    for (const sx of [-1, 1]) put(mat, boxW(0.14, h - 0.06, d * 0.7, x + sx * (w / 2 - 0.3), y + (h - 0.06) / 2, z, 1), where);
    col(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
  };

  // ---------- Salon (doppelte Höhe) ----------
  { const m = new T.Mesh(new T.PlaneGeometry(12, 8), M.rug1); m.rotation.x = -Math.PI / 2; m.position.set(0, F1 + 0.035, 9.5); inner.add(m); }
  furn(FURN.sofa(4.6), MAP('cream'), 0, F1, 6.0, 0); col(-2.5, F1, 5.4, 2.5, F1 + 0.9, 6.6);
  furn(FURN.sofa(3.8), MAP('velvet'), 0, F1, 13.2, Math.PI); col(-2.1, F1, 12.6, 2.1, F1 + 0.9, 13.8);
  for (const sx of [-1, 1]) { furn(FURN.clubChair(), MAP('velvet'), sx * 3.6, F1, 9.5, -sx * Math.PI / 2); col(sx * 3.6 - 0.5, F1, 9.0, sx * 3.6 + 0.5, F1 + 0.9, 10.0); }
  put('lacquer', lathe([[0, 0.42], [1.15, 0.42], [1.2, 0.38], [1.12, 0.34], [0.5, 0.3], [0.35, 0.05], [0.6, 0], [0, 0]], 40).translate(0, F1, 9.5)); put('gold', new T.TorusGeometry(1.17, 0.025, 6, 48).rotateX(Math.PI / 2).translate(0, F1 + 0.42, 9.5));
  col(-1.2, F1, 8.3, 1.2, F1 + 0.42, 10.7);
  vase(0.3, F1 + 0.42, 9.3, 1.2);
  for (const sx of [-1, 1]) { furn(FURN.roundTable(0.32, 0.58), MAP('lacquer'), sx * 2.9, F1, 5.7); furn(FURN.tableLamp(0.7), MAP('lacquer'), sx * 2.9, F1 + 0.58, 5.7); glow(sx * 2.9, F1 + 1.1, 5.7, [1.35, 0.95, 0.55], 1.0); }
  for (const [x, z] of [[-5.2, 4.8], [5.2, 4.8]]) { furn(FURN.floorLamp(1.9), MAP('lacquer'), x, F1, z); glow(x, F1 + 1.75, z, [1.35, 0.95, 0.55], 1.6); }
  chandelier(0, 9.5, TOP - 0.06, 2.6, 5.2, 5);
  // Flügel (Konzertflügel aus schwarzem Lack, Deckel offen) und Bank; Tastatur nach Osten
  {
    const x = -12.4, z = 13.5, sh = new T.Shape();
    sh.moveTo(-0.75, 0); sh.lineTo(0.75, 0); sh.lineTo(0.75, 0.9); sh.bezierCurveTo(0.75, 1.6, 0.2, 1.7, 0.1, 2.2); sh.bezierCurveTo(0.0, 2.6, -0.75, 2.7, -0.75, 2.2); sh.closePath();
    // Umriss in der Waagerechten: Form-y zeigt nach Westen (-x), Form-x nach Süden
    const flat = g => g.rotateX(-Math.PI / 2).rotateY(Math.PI / 2);
    put('lacquer', flat(new T.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 16 })).translate(x, F1 + 0.64, z));
    put('lacquer', flat(new T.ShapeGeometry(sh, 16)).rotateZ(-0.42).translate(x, F1 + 0.95, z));
    put('lacquer', BOX(0.03, 0.95, 0.03, x - 1.6, F1 + 1.35, z - 0.55));
    put('cab', BOX(0.26, 0.04, 1.45, x + 0.13, F1 + 0.8, z)); put('lacquer', BOX(0.06, 0.04, 1.45, x + 0.27, F1 + 0.83, z)); put('lacquer', BOX(0.3, 0.25, 1.5, x + 0.12, F1 + 0.62, z));
    for (const [dx, dz] of [[-0.15, -0.6], [-0.15, 0.6], [-2.0, -0.2]]) { put('lacquer', CYL(0.06, 0.05, 0.64, x + dx, F1 + 0.32, z + dz, 8)); put('gold', CYL(0.04, 0.04, 0.05, x + dx, F1 + 0.025, z + dz, 8)); }
    put('lacquer', roundBox(0.45, 0.1, 0.95, 0.03).translate(x + 0.95, F1 + 0.5, z)); for (const dz of [-0.4, 0.4]) put('lacquer', CYL(0.025, 0.025, 0.48, x + 0.95, F1 + 0.24, z + dz, 6));
    col(x - 2.75, F1, z - 0.8, x + 0.3, F1 + 1.0, z + 0.8);
  }
  // Grammophon auf einer Kommode
  { const x = -18.6, z = 9.5;
    put('veneer', boxW(0.6, 0.9, 1.4, x, F1 + 0.45, z, 1)); put('gold', BOX(0.62, 0.03, 1.42, x, F1 + 0.9, z));
    put('veneer', boxW(0.42, 0.14, 0.42, x, F1 + 0.98, z, 1)); put('lacquer', CYL(0.17, 0.17, 0.01, x, F1 + 1.06, z, 24));
    put('gold', CYL(0.02, 0.02, 0.4, x, F1 + 1.25, z + 0.12, 6)); put('gold', new T.ConeGeometry(0.42, 0.75, 16, 1, true).rotateZ(-1.0).translate(x + 0.28, F1 + 1.65, z + 0.12));
    col(x - 0.3, F1, z - 0.7, x + 0.3, F1 + 1.2, z + 0.7); }
  // Esstisch für acht, Kronleuchter, Anrichte
  { const x = -12, z = 3.2;
    table(x, F1, z, 5.2, 1.7, 0.76, 'veneer');
    for (const dx of [-1.7, 0, 1.7]) for (const sz of [-1, 1]) furn(FURN.diningChair(), MAP('champ'), x + dx, F1, z + sz * 1.15, sz > 0 ? Math.PI : 0);
    for (const sx of [-1, 1]) furn(FURN.diningChair(), MAP('champ'), x + sx * 3.0, F1, z, -sx * Math.PI / 2);
    for (const dx of [-1.7, 0, 1.7]) { put('gold', CYL(0.02, 0.06, 0.4, x + dx, F1 + 0.96, z, 8)); put('lamp', CYL(0.012, 0.012, 0.12, x + dx, F1 + 1.22, z, 6)); glow(x + dx, F1 + 1.3, z, [1.4, 0.95, 0.5], 0.5); }
    vase(x - 0.85, F1 + 0.76, z, 0.8); vase(x + 0.85, F1 + 0.76, z, 0.8);
    chandelier(x, z, TOP - 0.06, 1.6, 5.0, 3);
    put('veneer', boxW(0.55, 0.95, 3.6, -19.3, F1 + 0.475, z, 1)); put('gold', BOX(0.57, 0.03, 3.62, -19.3, F1 + 0.95, z));
    vase(-19.3, F1 + 0.95, z - 1.0, 1.0); put('mirror', new T.PlaneGeometry(2.6, 1.8).rotateY(Math.PI / 2).translate(-19.55, F1 + 2.1, z));
    col(-19.6, F1, z - 1.8, -19.0, F1 + 1.0, z + 1.8); }
  // Ostseite: Globus, Leseecke mit Chaiselongue, Fernrohr am Südfenster, zwei Sessel
  { put('gold', CYL(0.25, 0.35, 0.9, 17.5, F1 + 0.45, 2.0, 12)); put('champ', new T.SphereGeometry(0.5, 24, 16).translate(17.5, F1 + 1.4, 2.0)); put('gold', new T.TorusGeometry(0.56, 0.025, 6, 32).rotateY(0.4).translate(17.5, F1 + 1.4, 2.0)); col(17.1, F1, 1.6, 17.9, F1 + 1.9, 2.4);
    put('velvet', roundBox(0.8, 0.4, 2.0, 0.12).translate(14.2, F1 + 0.35, 6.0)); put('velvet', roundBox(0.8, 0.7, 0.3, 0.12).rotateX(-0.5).translate(14.2, F1 + 0.75, 5.2)); for (const dz of [-0.85, 0.85]) put('gold', CYL(0.03, 0.02, 0.18, 14.2, F1 + 0.09, 6 + dz, 6)); col(13.8, F1, 5.0, 14.6, F1 + 0.8, 7.0);
    furn(FURN.floorLamp(1.8), MAP('lacquer'), 15.4, F1, 4.6); glow(15.4, F1 + 1.65, 4.6, [1.35, 0.95, 0.55], 1.4);
    const tx = 16.2, tz = 17.6;
    for (const a of [0, 2.1, 4.2]) put('veneer', CYL(0.02, 0.025, 1.4, 0, 0, 0, 6).rotateZ(0.3).translate(0.2, 0.68, 0).rotateY(a).translate(tx, F1, tz));
    put('gold', CYL(0.08, 0.11, 1.8, 0, 0, 0, 16).rotateX(Math.PI / 2 - 0.5).translate(tx, F1 + 1.5, tz + 0.2)); put('gold', CYL(0.12, 0.12, 0.12, 0, 0, 0, 16).rotateX(Math.PI / 2 - 0.5).translate(tx, F1 + 1.9, tz + 0.95));
    col(tx - 0.5, F1, tz - 0.5, tx + 0.5, F1 + 1.6, tz + 0.5);
    for (const [x, z, ry] of [[12.2, 13.2, Math.PI / 2], [14.6, 13.2, -Math.PI / 2]]) { furn(FURN.clubChair(), MAP('leather'), x, F1, z, ry); col(x - 0.5, F1, z - 0.5, x + 0.5, F1 + 0.9, z + 0.5); }
    furn(FURN.roundTable(0.35, 0.55), MAP('lacquer'), 13.4, F1, 13.2); col(13.05, F1, 12.85, 13.75, F1 + 0.55, 13.55);
  }
  for (const [x, z] of [[-18.5, 18.5], [18.5, 18.5], [18.5, 0.8], [-6.8, 18.8], [6.8, 18.8]]) palm(x, F1, z, 3.2);
  // ---------- Küche ----------
  {
    const y = F1, H = 0.92;
    const counter = (x0, x1, z0, z1) => { const w = x1 - x0, d = z1 - z0, x = (x0 + x1) / 2, z = (z0 + z1) / 2; put('cab', boxW(w, H - 0.06, d, x, y + (H - 0.06) / 2, z, 1)); put('dark', boxW(w + 0.04, 0.06, d + 0.04, x, y + H - 0.03, z, 1.5)); put('lacquer', BOX(w - 0.04, 0.1, d - 0.04, x, y + 0.05, z)); col(x0, y, z0, x1, y + H, z1); };
    counter(-19.7, -8.3, -19.75, -19.05); counter(-19.75, -19.05, -19.05, -12.4);
    for (let x = -19.2; x < -8.4; x += 0.6) put('gold', BOX(0.16, 0.025, 0.03, x + 0.3, y + 0.72, -19.03));
    for (let z = -18.6; z < -12.5; z += 0.6) put('gold', BOX(0.03, 0.025, 0.16, -19.03, y + 0.72, z + 0.3));
    // Herd mit Haube, Spüle, Oberschränke
    put('iron', BOX(1.4, 0.04, 0.66, -13.5, y + H + 0.02, -19.4)); for (const dx of [-0.35, 0.35]) for (const dz of [-0.15, 0.15]) put('lacquer', CYL(0.14, 0.14, 0.02, -13.5 + dx, y + H + 0.05, -19.4 + dz, 16));
    put('gold', lathe([[0.95, 0], [0.75, 0.6], [0.25, 1.2], [0.22, 2.4]], 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).translate(-13.5, y + 2.2, -19.2));
    put('chrome', BOX(0.8, 0.02, 0.45, -17, y + H + 0.005, -19.4)); put('gold', tube([[-17, y + H, -19.65], [-17, y + H + 0.4, -19.65], [-17, y + H + 0.42, -19.42]], 0.02, 8));
    for (const [x0, x1] of [[-19.7, -14.4], [-12.6, -8.3]]) { const w = x1 - x0, x = (x0 + x1) / 2; put('cab', boxW(w, 1.0, 0.38, x, y + 2.3, -19.6, 1)); put('gold', BOX(w, 0.03, 0.4, x, y + 1.8, -19.6)); for (let k = x0 + 0.6; k < x1; k += 0.6) put('gold', BOX(0.02, 0.95, 0.02, k, y + 2.3, -19.4)); }
    // Hoher Kühlschrank und Vorrat an der Westwand
    put('cab', boxW(0.7, 2.5, 4.6, -19.4, y + 1.25, -9.6, 1)); for (const z of [-11.3, -9.6, -7.9]) { put('gold', BOX(0.04, 1.6, 0.04, -19.03, y + 1.3, z + 0.7)); put('lacquer', BOX(0.02, 2.4, 0.02, -19.04, y + 1.25, z + 0.85)); }
    col(-19.75, y, -11.9, -19.05, y + 2.5, -7.3);
    // Kochinsel mit Marmorplatte, Hocker, Pendelleuchten, Obstschale
    counter(-15.6, -10.8, -11.2, -10.0); put('dark', boxW(5.0, 0.06, 1.65, -13.2, y + H - 0.03, -10.45, 1.5));
    for (const x of [-14.6, -13.2, -11.8]) { furn(FURN.barStool(), MAP('leather'), x, y, -9.3); put('gold', CYL(0.012, 0.012, 1.9, x, y + 4.6, -10.6, 4)); put('lamp', new T.SphereGeometry(0.2, 14, 10).translate(x, y + 3.55, -10.6)); glow(x, y + 3.55, -10.6, [1.4, 1.0, 0.6], 1.0); }
    put('gold', lathe([[0, 0], [0.2, 0.02], [0.28, 0.1]], 16).translate(-12.6, y + H, -10.5));
    for (let k = 0; k < 6; k++) put(k % 2 ? 'rose' : 'bottlesG', new T.SphereGeometry(0.06, 8, 6).translate(-12.6 + Math.cos(k) * 0.12, y + H + 0.1, -10.5 + Math.sin(k) * 0.12));
  }
  // ---------- Bar mit Onyxtheke, Rückbuffet, Rauchersalon ----------
  {
    const y = F1, z = -8.4;
    put('onyx', boxW(8.6, 1.02, 0.08, 13.5, y + 0.55, z + 0.33, 1.6)); put('lacquer', boxW(8.6, 1.02, 0.6, 13.5, y + 0.55, z, 1)); put('dark', boxW(8.9, 0.07, 0.85, 13.5, y + 1.1, z, 1.5));
    put('gold', BOX(8.92, 0.04, 0.04, 13.5, y + 1.07, z + 0.43)); put('gold', BOX(8.7, 0.08, 0.06, 13.5, y + 0.08, z + 0.38)); put('gold', CYL(0.025, 0.025, 8.6, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(13.5, y + 0.25, z + 0.62));
    put('lacquer', boxW(0.6, 1.02, 1.6, 17.5, y + 0.55, z - 1.1, 1)); put('dark', boxW(0.85, 0.07, 1.6, 17.5, y + 1.1, z - 1.1, 1.5));
    col(9.2, y, z - 0.45, 17.8, y + 1.15, z + 0.45); col(17.2, y, z - 1.9, 17.8, y + 1.15, z - 0.45);
    for (let x = 9.8; x <= 17.2; x += 1.6) furn(FURN.barStool(), MAP('leather'), x, y, z + 1.05);
    glow(13.5, y + 0.5, z + 0.5, [1.4, 0.8, 0.35], 4.0);
    // Champagner im Kühler, Shaker, Gläser
    put('chrome', lathe([[0.12, 0], [0.14, 0.24], [0.15, 0.26]], 14).translate(11.5, y + 1.135, z)); put('bottlesG', CYL(0.04, 0.045, 0.3, 11.5, y + 1.38, z, 8));
    for (const x of [12.6, 12.85, 15.1]) put('crystal', lathe([[0.035, 0], [0.006, 0.02], [0.006, 0.1], [0.05, 0.12], [0.06, 0.15]], 10).translate(x, y + 1.135, z + 0.15));
    // Rückbuffet: Furnier, Spiegel, Goldböden mit Flaschen
    const zb = -12.2;
    put('veneer', boxW(10, 3.2, 0.5, 13.5, y + 1.6, zb, 1)); put('mirror', new T.PlaneGeometry(9.2, 2.0).translate(13.5, y + 2.0, zb + 0.26));
    col(8.5, y, zb - 0.25, 18.5, y + 3.2, zb + 0.25);
    for (const yy of [1.2, 1.85, 2.5]) { put('gold', BOX(9.2, 0.03, 0.32, 13.5, y + yy, zb + 0.4)); for (let x = 9.1; x < 17.9; x += 0.22) put(Math.round(x * 7) % 3 ? 'bottles' : 'bottlesG', lathe([[0.04, 0], [0.04, 0.2], [0.015, 0.28], [0.015, 0.34]], 8).translate(x, y + yy + 0.015, zb + 0.4)); }
    for (let x = 9.5; x <= 17.5; x += 2) glow(x, y + 2.9, zb + 0.5, [1.35, 0.9, 0.5], 1.0);
    put('gold', BOX(10.1, 0.12, 0.6, 13.5, y + 3.26, zb)); put('lamp', BOX(9.6, 0.04, 0.1, 13.5, y + 3.15, zb + 0.32));
    // Rauchersalon: Ledersessel, Tisch, Humidor
    for (const [x, ry] of [[11.2, Math.PI / 2], [14.6, -Math.PI / 2]]) { furn(FURN.clubChair(), MAP('leather'), x, y, -16.6, ry); col(x - 0.5, y, -17.1, x + 0.5, y + 0.9, -16.1); }
    furn(FURN.roundTable(0.4, 0.5), MAP('lacquer'), 12.9, y, -16.6); put('gold', CYL(0.12, 0.08, 0.04, 12.9, y + 0.52, -16.6, 12));
    put('veneer', boxW(0.6, 1.8, 1.2, 7.45, y + 0.9, -17.5, 1)); put('glass', new T.PlaneGeometry(1.0, 1.2).rotateY(Math.PI / 2).translate(7.77, y + 1.1, -17.5)); col(7.1, y, -18.1, 7.8, y + 1.8, -16.9);
    furn(FURN.floorLamp(1.8), MAP('lacquer'), 16.6, y, -18.4); glow(16.6, y + 1.65, -18.4, [1.35, 0.95, 0.55], 1.4);
    { const m = new T.Mesh(new T.PlaneGeometry(6, 5), M.rug2); m.rotation.x = -Math.PI / 2; m.position.set(12.9, y + 0.035, -16.6); inner.add(m); }
  }
  // ---------- Foyer ----------
  { const y = F1;
    put('dark', CYL(0.55, 0.65, 0.78, 0, y + 0.39, -11, 20)); put('gold', CYL(0.95, 0.95, 0.04, 0, y + 0.8, -11, 32)); put('dark', CYL(0.93, 0.93, 0.03, 0, y + 0.835, -11, 32));
    vase(0, y + 0.85, -11, 2.0); col(-0.95, y, -11.95, 0.95, y + 0.85, -10.05);
    for (const sx of [-1, 1]) {
      const x = sx * 6.6;
      put('veneer', boxW(0.5, 0.85, 2.4, x, y + 0.425, -13.5, 1)); put('gold', BOX(0.52, 0.03, 2.42, x, y + 0.85, -13.5)); col(x - 0.25, y, -14.7, x + 0.25, y + 0.9, -12.3);
      put('mirror', new T.PlaneGeometry(1.8, 2.6).rotateY(-sx * Math.PI / 2).translate(sx * 6.84, y + 2.4, -13.5));
      put('gold', lathe([[0.18, 0], [0.08, 0.15], [0.05, 0.6], [0.09, 0.85], [0.05, 0.95]], 12).translate(x, y + 0.85, -14.2)); put('gold', new T.SphereGeometry(0.08, 10, 8).translate(x, y + 1.9, -14.2));
      vase(x, y + 0.85, -12.9, 0.9);
      palm(sx * 5.6, y, -7.6, 2.8);
    }
  }

  // ---------- Ebene 2: Schlafzimmer ----------
  { const y = F2, bx = 12.5;
    { const m = new T.Mesh(new T.PlaneGeometry(6, 5), M.rug2); m.rotation.x = -Math.PI / 2; m.position.set(bx, y + 0.03, -3.2); inner.add(m); }
    put('velvet', roundBox(2.4, 0.45, 2.5, 0.08).translate(bx, y + 0.25, -1.95)); put('linen', roundBox(2.3, 0.28, 2.4, 0.1).translate(bx, y + 0.6, -1.95));
    put('cream', roundBox(2.36, 0.08, 1.7, 0.04).translate(bx, y + 0.76, -2.45)); put('velvet', roundBox(2.4, 0.06, 0.6, 0.03).translate(bx, y + 0.79, -2.95));
    for (const dx of [-0.6, 0.6]) { put('linen', roundBox(0.8, 0.22, 0.45, 0.1).rotateX(-0.25).translate(bx + dx, y + 0.85, -0.95)); put('champ', roundBox(0.6, 0.18, 0.3, 0.08).rotateX(-0.2).translate(bx + dx * 0.9, y + 0.86, -1.25)); }
    // Kopfteil: Fächer aus Samt mit Goldkante
    for (let k = -4; k <= 4; k++) put('champ', roundBox(0.32, 1.9, 0.12, 0.05).translate(0, 0.95, 0).rotateZ(k * 0.12).translate(bx, y + 0.2, -0.62));
    put('gold', new T.TorusGeometry(1.95, 0.04, 6, 32, Math.PI * 0.6).rotateZ(Math.PI * 0.2).translate(bx, y + 0.2, -0.6));
    col(bx - 1.25, y, -3.2, bx + 1.25, y + 0.85, -0.6);
    for (const sx of [-1, 1]) { const x = bx + sx * 1.75; put('veneer', boxW(0.6, 0.6, 0.5, x, y + 0.3, -0.9, 1)); put('gold', BOX(0.62, 0.02, 0.52, x, y + 0.61, -0.9)); furn(FURN.tableLamp(0.6), MAP('lacquer'), x, y + 0.6, -0.9); glow(x, y + 1.05, -0.9, [1.35, 0.95, 0.55], 1.0); col(x - 0.3, y, -1.15, x + 0.3, y + 0.6, -0.65); }
    put('velvet', roundBox(1.8, 0.45, 0.5, 0.1).translate(bx, y + 0.25, -3.6)); col(bx - 0.9, y, -3.85, bx + 0.9, y + 0.5, -3.35);
    // Kleiderschränke an der Wand zum Flur
    put('veneer', boxW(0.65, 2.8, 8.0, 5.45, y + 1.4, -15.3, 1)); for (let z = -19.1; z < -11.4; z += 1.0) put('gold', BOX(0.04, 0.6, 0.03, 5.79, y + 1.3, z + 0.5)); col(5.1, y, -19.3, 5.8, y + 2.8, -11.3);
    // Frisiertisch mit Spiegel, Chaiselongue, zwei Sessel
    put('veneer', boxW(1.6, 0.75, 0.5, 17.0, y + 0.375, -19.4, 1)); put('mirror', new T.CircleGeometry(0.7, 32).translate(17.0, y + 1.65, -19.62)); put('gold', new T.TorusGeometry(0.72, 0.04, 6, 32).translate(17.0, y + 1.65, -19.6)); col(16.2, y, -19.7, 17.8, y + 0.8, -19.1);
    furn(FURN.diningChair(), MAP('champ'), 17.0, y, -18.6, Math.PI);
    put('velvet', roundBox(0.8, 0.4, 2.0, 0.12).translate(18.6, y + 0.35, -9.0)); put('velvet', roundBox(0.8, 0.7, 0.3, 0.12).rotateX(-0.5).translate(18.6, y + 0.75, -9.8)); col(18.2, y, -10.0, 19.0, y + 0.8, -8.0);
    for (const [x, ry] of [[8.2, Math.PI / 2], [10.4, -Math.PI / 2]]) furn(FURN.clubChair(), MAP('cream'), x, y, -17.2, ry);
    furn(FURN.roundTable(0.35, 0.55), MAP('lacquer'), 9.3, y, -17.2); vase(9.3, y + 0.55, -17.2, 0.7); col(7.7, y, -17.7, 10.9, y + 0.9, -16.7);
    furn(FURN.floorLamp(1.8), MAP('lacquer'), 18.4, y, -11.0); glow(18.4, y + 1.65, -11.0, [1.35, 0.95, 0.55], 1.4);
    chandelier(bx, -9.5, TOP - 0.06, 1.3, 1.6, 3);
    palm(18.6, y, -1.2, 2.6);
  }
  // ---------- Ebene 2: Bad ----------
  { const y = F2;
    // freistehende Wanne vor dem Nordfenster
    const tx = -12.5, tz = -16.5;
    put('white', lathe([[0, 0.12], [0.85, 0.12], [1.0, 0.3], [1.05, 0.62], [1.1, 0.66], [1.0, 0.66], [0.92, 0.3], [0, 0.25]], 40).scale(1.45, 1, 0.85).translate(tx, y, tz));
    put('gold', new T.TorusGeometry(1.08, 0.03, 6, 40).rotateX(Math.PI / 2).scale(1.45, 1, 0.85).translate(tx, y + 0.66, tz));
    for (const [dx, dz] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) put('gold', new T.SphereGeometry(0.08, 10, 8).translate(tx + dx, y + 0.08, tz + dz));
    { const w = new T.Mesh(new T.CircleGeometry(0.92, 32).scale(1.45, 0.85, 1), poolWaterMat([0.06, 0.4, 0.42])); w.rotation.x = -Math.PI / 2; w.position.set(tx, y + 0.55, tz); inner.add(w); }
    put('gold', tube([[tx + 1.75, y, tz], [tx + 1.75, y + 1.0, tz], [tx + 1.5, y + 1.1, tz]], 0.03, 10));
    col(tx - 1.55, y, tz - 0.9, tx + 1.55, y + 0.66, tz + 0.9);
    // Doppelwaschtisch mit großem Spiegel an der Wand zur Galerie
    put('dark', boxW(7.0, 0.08, 0.65, -12.5, y + 0.9, -0.95, 1.5)); put('veneer', boxW(6.8, 0.75, 0.55, -12.5, y + 0.48, -0.9, 1)); col(-16, y, -1.3, -9, y + 0.95, -0.55);
    for (const dx of [-1.8, 1.8]) { put('white', lathe([[0, 0], [0.25, 0.02], [0.3, 0.14]], 20).translate(-12.5 + dx, y + 0.94, -1.0)); put('gold', tube([[-12.5 + dx, y + 0.94, -0.7], [-12.5 + dx, y + 1.25, -0.7], [-12.5 + dx, y + 1.25, -0.88]], 0.018, 8)); }
    put('mirror', new T.PlaneGeometry(6.4, 2.0).rotateY(Math.PI).translate(-12.5, y + 2.2, -0.62)); for (const [w, h, x, yy] of [[6.6, 0.1, -12.5, y + 3.25], [6.6, 0.1, -12.5, y + 1.15], [0.1, 2.2, -15.75, y + 2.2], [0.1, 2.2, -9.25, y + 2.2]]) put('gold', BOX(w, h, 0.05, x, yy, -0.64));
    for (const x of [-16.3, -8.7]) { put('lamp', CYL(0.08, 0.08, 0.6, x, y + 2.2, -0.7, 10)); glow(x, y + 2.2, -0.8, [1.35, 1.0, 0.65], 1.1); }
    // Dusche aus Glas mit Regenbrause in der Südwestecke
    for (const [w, x, z, ry] of [[3.4, -18.2, -4.5, 0], [2.6, -16.5, -3.2, Math.PI / 2]]) { put('glass', new T.PlaneGeometry(w, 2.3).rotateY(ry).translate(x, y + 1.15, z)); put('gold', (ry ? BOX(0.05, 0.05, w) : BOX(w, 0.05, 0.05)).translate(x, y + 2.3, z)); col(ry ? x - 0.05 : x - w / 2, y, ry ? z - w / 2 : z - 0.05, ry ? x + 0.05 : x + w / 2, y + 2.3, ry ? z + w / 2 : z + 0.05); }
    put('gold', CYL(0.3, 0.3, 0.03, -18.2, y + 2.4, -2.6, 20)); put('gold', CYL(0.02, 0.02, 0.6, -18.2, y + 2.7, -2.6, 6));
    put('tile', boxW(3.4, 0.03, 3.8, -18.2, y + 0.02, -2.6, 1));
    // Handtücher, Hocker, Pflanzen
    put('gold', BOX(0.04, 1.2, 0.04, -5.25, y + 1.0, -14.5)); put('gold', BOX(0.04, 1.2, 0.04, -5.25, y + 1.0, -12.9)); for (const yy of [0.7, 1.1, 1.5]) put('gold', CYL(0.015, 0.015, 1.6, 0, 0, 0, 6).rotateX(Math.PI / 2).translate(-5.3, y + yy, -13.7));
    put('linen', BOX(0.06, 0.7, 1.2, -5.36, y + 1.05, -13.7)); put('linen', BOX(0.06, 0.5, 1.2, -5.36, y + 0.55, -13.7));
    put('velvet', CYL(0.28, 0.28, 0.45, -12.5, y + 0.23, -2.1, 16));
    palm(-18.6, y, -18.6, 2.4); palm(-6.0, y, -18.8, 2.2);
    chandelier(-12.5, -9.5, TOP - 0.06, 1.2, 1.6, 3);
  }
  // ---------- Ebene 2: Bibliotheksgalerie ----------
  { const y = F2;
    put('veneer', boxW(4.0, 3.2, 0.4, 0, y + 1.6, -16.3, 1)); put('books', BOX(3.7, 2.6, 0.02, 0, y + 1.55, -16.09));
    for (const sx of [-1, 1]) { put('veneer', boxW(0.4, 3.2, 4.4, sx * 4.75, y + 1.6, -13.6, 1)); put('books', BOX(0.02, 2.6, 4.1, sx * 4.54, y + 1.55, -13.6).rotateY(0)); col(sx * 4.75 - 0.2, y, -15.8, sx * 4.75 + 0.2, y + 3.2, -11.4); }
    col(-2, y, -16.5, 2, y + 3.2, -16.1);
    for (const [x, ry] of [[-2.4, Math.PI / 4], [2.4, -Math.PI / 4]]) furn(FURN.clubChair(), MAP('leather'), x, y, -11.8, ry);
    furn(FURN.roundTable(0.35, 0.55), MAP('lacquer'), 0, y, -11.4); furn(FURN.tableLamp(0.6), MAP('lacquer'), 0, y + 0.55, -11.4); glow(0, y + 1.0, -11.4, [1.35, 0.95, 0.55], 1.0);
    col(-3.0, y, -12.4, 3.0, y + 0.9, -11.0);
    { const m = new T.Mesh(new T.PlaneGeometry(5, 3.6), M.rug2); m.rotation.x = -Math.PI / 2; m.position.set(0, y + 0.03, -11.8); inner.add(m); }
  }

  /* ================= Terrasse: größer, mit Becken, Liegen, Feuerschalen ================= */
  {
    const y = F1, cream = [0.17, 0.155, 0.18], GD = [0.5, 0.36, 0.16];
    // Auskragungen nach Süden (10 m), Osten und Westen (6 m) mit gestuften Konsolen darunter
    addSeg({ x: 0, z: 30.5, w: 32, d: 11, y0: y - 1.0, y1: y, tint: cream, seed: 560, style: 3, dens: -1, flood: 1 });
    for (const [w, d, y0, y1] of [[26, 8.5, y - 2.6, y - 1.0], [18, 5.5, y - 4.4, y - 2.6], [10, 2.8, y - 6.4, y - 4.4]]) addSeg({ x: 0, z: 25 + d / 2, w, d, y0, y1, tint: cream, seed: 561, style: 3, dens: -1, flood: 1 }, false);
    for (const sx of [-1, 1]) {
      addSeg({ x: sx * 28, z: 0, w: 6, d: 18, y0: y - 1.0, y1: y, tint: cream, seed: 562, style: 3, dens: -1, flood: 1 });
      for (const [w, d, y0, y1] of [[4.2, 13, y - 2.6, y - 1.0], [2.4, 7, y - 4.4, y - 2.6]]) addSeg({ x: sx * (25 + w / 2), z: 0, w, d, y0, y1, tint: cream, seed: 563, style: 3, dens: -1, flood: 1 }, false);
      addNeon(sx * 31.05, y - 0.5, 0, 0.1, 0.12, 18.1, NEON.gold);
    }
    addNeon(0, y - 0.5, 36.05, 32.1, 0.12, 0.1, NEON.gold);
    for (const sx of [-1, 1]) addNeon(sx * 16.05, y - 0.5, 30.5, 0.1, 0.12, 11, NEON.gold);
    // Boden: Travertin auf allen Flächen
    for (const [x0, x1, z0, z1] of [[-22, 22, 20, 25], [-16, 16, 25, 36], [-22, 22, -25, -20], [20, 25, -22, 22], [-25, -20, -22, 22], [25, 31, -9, 9], [-31, -25, -9, 9]])
      put('terr', rectXZ(x0, x1, z0, z1, y + 0.025, null, false, 3.6), 'terr');
    // Brüstung: Steinsockel, Glas, Goldhandlauf, Pfosten mit Laternen
    const trail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      put('stone', ax ? BOX(L, 0.3, 0.32, mx, y + 0.15, mz) : BOX(0.32, 0.3, L, mx, y + 0.15, mz), 'terr');
      put('gold', ax ? BOX(L, 0.08, 0.14, mx, y + 1.12, mz) : BOX(0.14, 0.08, L, mx, y + 1.12, mz), 'terr');
      put('glass', (ax ? new T.PlaneGeometry(L, 0.8) : new T.PlaneGeometry(L, 0.8).rotateY(Math.PI / 2)).translate(mx, y + 0.7, mz), 'terr');
      const n = Math.max(1, Math.round(L / 2.4));
      for (let i = 0; i <= n; i++) { const k = i / n, px = x0 + (x1 - x0) * k, pz = z0 + (z1 - z0) * k; put('gold', BOX(0.1, 1.1, 0.1, px, y + 0.6, pz), 'terr'); if (i % 3 === 0) { put('lamp', new T.SphereGeometry(0.12, 10, 8).translate(px, y + 1.3, pz), 'terr'); glow(px, y + 1.32, pz, [1.4, 1.0, 0.55], 0.9); } }
      col(Math.min(x0, x1) - 0.16, y, Math.min(z0, z1) - 0.16, Math.max(x0, x1) + 0.16, y + 1.16, Math.max(z0, z1) + 0.16);
    };
    trail(-22, 24.85, -16, 24.85); trail(-16, 24.85, -16, 35.85); trail(-16, 35.85, 16, 35.85); trail(16, 35.85, 16, 24.85); trail(16, 24.85, 22, 24.85);
    trail(-22, -24.85, 22, -24.85);
    for (const sx of [-1, 1]) { const e = sx * 24.85, o = sx * 30.85; trail(e, -22, e, -9); trail(e, -9, o, -9); trail(o, -9, o, 9); trail(o, 9, e, 9); trail(e, 9, e, 22); }
    // Becken (Mosaik, Wasser, Goldrand), angehoben, mit Unterwasserlicht
    const px0 = -5, px1 = 5, pz0 = 28.5, pz1 = 33.5, ph = 0.62;
    put('stone', BOX(px1 - px0 + 0.6, ph, 0.3, 0, y + ph / 2, pz0 - 0.15), 'terr'); put('stone', BOX(px1 - px0 + 0.6, ph, 0.3, 0, y + ph / 2, pz1 + 0.15), 'terr');
    put('stone', BOX(0.3, ph, pz1 - pz0, px0 - 0.15, y + ph / 2, (pz0 + pz1) / 2), 'terr'); put('stone', BOX(0.3, ph, pz1 - pz0, px1 + 0.15, y + ph / 2, (pz0 + pz1) / 2), 'terr');
    put('gold', BOX(px1 - px0 + 0.64, 0.04, pz1 - pz0 + 0.64, 0, y + ph + 0.02, (pz0 + pz1) / 2).scale(1, 1, 1), 'terr');
    put('mosaic', rectXZ(px0, px1, pz0, pz1, y + 0.04, null, false, 1.5), 'terr');
    { const w = new T.Mesh(new T.PlaneGeometry(px1 - px0, pz1 - pz0), poolWaterMat([0.05, 0.45, 0.48])); w.rotation.x = -Math.PI / 2; w.position.set(0, y + ph - 0.08, (pz0 + pz1) / 2); terr.add(w); }
    for (const x of [-3, 0, 3]) glow(x, y + 0.3, (pz0 + pz1) / 2, NEON.teal, 2.2);
    for (const [x0, z0, x1, z1] of [[px0 - 0.3, pz0 - 0.3, px1 + 0.3, pz0], [px0 - 0.3, pz1, px1 + 0.3, pz1 + 0.3], [px0 - 0.3, pz0, px0, pz1], [px1, pz0, px1 + 0.3, pz1]]) col(x0, y, z0, x1, y + ph, z1);
    // Liegen beiderseits des Beckens
    const lounger = (x, z, ry) => {
      const parts = [[roundBox(0.75, 0.12, 1.4, 0.05).translate(0, 0.35, 0.3), 'up'], [roundBox(0.75, 0.12, 0.8, 0.05).rotateX(0.6).translate(0, 0.55, -0.62), 'up'],
        [BOX(0.7, 0.04, 2.1, 0, 0.27, 0), 'frame'], ...[[-0.32, 0.9], [0.32, 0.9], [-0.32, -0.85], [0.32, -0.85]].map(([dx, dz]) => [CYL(0.02, 0.02, 0.27, dx, 0.135, dz, 6), 'frame'])];
      furn(parts, MAP('cushion'), x, y, z, ry, 'terr'); col(x - 0.4, y, z - 1.05, x + 0.4, y + 0.5, z + 1.05);
    };
    for (const sx of [-1, 1]) for (const dz of [-1.0, 1.4]) lounger(sx * 7.0 + sx * (dz > 0 ? 0 : 1.1), 31 + dz, sx > 0 ? -0.15 : 0.15);
    // Feuerschalen (Polarnacht!) und Sitzgruppe im Süden
    const fireBowl = (x, z) => { put('gold', lathe([[0, 0], [0.2, 0], [0.12, 0.35], [0.15, 0.5], [0.6, 0.65], [0.62, 0.72], [0, 0.6]], 24).translate(x, y, z), 'terr'); for (let k = 0; k < 5; k++) put('fire', new T.ConeGeometry(0.12 + 0.04 * (k % 2), 0.45 + 0.15 * (k % 3), 6).translate(x + Math.cos(k * 1.3) * 0.2, y + 0.9, z + Math.sin(k * 1.3) * 0.2), 'terr'); glow(x, y + 1.0, z, [1.6, 0.8, 0.3], 2.4); col(x - 0.62, y, z - 0.62, x + 0.62, y + 0.72, z + 0.62); };
    fireBowl(-11.5, 31); fireBowl(11.5, 31);
    for (const [x, z, ry] of [[-11.5, 33.4, Math.PI], [11.5, 33.4, Math.PI], [-13.8, 31, Math.PI / 2], [13.8, 31, -Math.PI / 2]]) { furn(FURN.sofa(2.2), MAP('cushion', { frame: 'gold' }), x, y, z, ry, 'terr'); const q = Math.abs(Math.sin(ry)) > 0.5; col(x - (q ? 0.6 : 1.2), y, z - (q ? 1.2 : 0.6), x + (q ? 0.6 : 1.2), y + 0.8, z + (q ? 1.2 : 0.6)); }
    // Pflanzkübel mit Formschnitt-Kegeln
    const topiary = (x, z, h = 2.2) => { put('stone', BOX(1.0, 0.8, 1.0, x, y + 0.4, z), 'terr'); put('gold', BOX(1.04, 0.05, 1.04, x, y + 0.8, z), 'terr'); put('leaf', new T.ConeGeometry(0.45, h, 10).translate(x, y + 0.8 + h / 2, z), 'terr'); col(x - 0.5, y, z - 0.5, x + 0.5, y + 0.8, z + 0.5); };
    for (const [x, z] of [[-15, 26], [15, 26], [-15, 35], [15, 35], [-8, 35], [8, 35], [-21, 22.6], [21, 22.6], [-21, -22.6], [21, -22.6]]) topiary(x, z);
    // Ostterrasse: Tafel für sechs mit Kandelaber; Westterrasse: Tagesbett unter einem Baldachin
    table(28, y, 0, 1.4, 3.4, 0.76, 'veneer', 'terr');
    for (const dz of [-1.0, 0, 1.0]) for (const sx of [-1, 1]) furn(FURN.diningChair(), MAP('champ'), 28 + sx * 1.05, y, dz, -sx * Math.PI / 2, 'terr');
    put('gold', lathe([[0.1, 0], [0.04, 0.05], [0.03, 0.45], [0.2, 0.5], [0.22, 0.52]], 12).translate(28, y + 0.76, 0), 'terr'); for (const dz of [-0.2, 0, 0.2]) put('lamp', CYL(0.015, 0.015, 0.14, 28, y + 1.35, dz, 6), 'terr'); glow(28, y + 1.45, 0, [1.4, 0.95, 0.5], 1.2);
    put('cushion', roundBox(1.8, 0.4, 2.4, 0.12).translate(-28, y + 0.35, 0), 'terr'); put('champ', roundBox(1.8, 0.6, 0.3, 0.12).translate(-28.8, y + 0.75, 0).rotateY(0), 'terr'); col(-29, y, -1.2, -27.1, y + 0.6, 1.2);
    for (const [dx, dz] of [[-1.1, -1.4], [1.1, -1.4], [-1.1, 1.4], [1.1, 1.4]]) put('gold', CYL(0.04, 0.04, 2.6, -28 + dx, y + 1.3, dz, 8), 'terr');
    put('gold', BOX(2.3, 0.06, 2.9, -28, y + 2.6, 0), 'terr'); put('cream', BOX(2.2, 0.02, 2.8, -28, y + 2.64, 0), 'terr');
    for (const sx of [-1, 1]) topiary(sx * 29.6, -7.6, 1.8);
  }

  /* ================= Netze bauen ================= */
  for (const where in B) {
    const parent = where === 'inner' ? inner : where === 'terr' ? terr : shell;
    for (const k in B[where]) {
      const geos = B[where][k].map(g => { if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
      const m = new T.Mesh(mergeGeos(geos), M[k]); if (k === 'glass') m.renderOrder = 3; parent.add(m);   // V34: wieder nach Sichtfeld aussortiert
    }
  }
  // Licht: Salon, Speisezimmer und Küche, Bar, Schlafzimmer, Bad (nur wenn man drinnen ist), Terrasse
  for (const [x, yy, z, i, d] of [[0, F1 + 5.5, 9.5, 1.0, 26], [-12, F1 + 4.2, -3, 0.7, 18], [13.5, F1 + 3.2, -10, 0.7, 16], [12.5, F2 + 4.5, -9, 0.6, 16], [-12.5, F2 + 4.5, -9, 0.6, 16]]) addLight(0xffc27a, i * 0.75, d, 1.6, x, yy, z, true);
  addLight(0xffa860, 0.6, 30, 1.8, 0, F1 + 3, 30);
  updatePenthouse(0, true);
}

// Nähe: Innenleben und Terrassenmöbel zeigen oder den warmen Kasten; Schiebetüren öffnen sich vor dem Spieler
export function updatePenthouse(dt, force = false) {
  if (!PH.inner) return;
  const c = camera.position, d = Math.hypot(c.x, c.y - 256, c.z), lim = MOBILE ? 150 : 260;
  const near = d < lim;
  if (near !== PH.inner.visible || force) { PH.inner.visible = near; PH.far.visible = !near; PH.terrace.visible = d < lim * 1.2; }
  const p = player.p;
  if (Math.abs(p.y - PH.F1) > 8 || Math.abs(p.x) > 40 || Math.abs(p.z) > 40) { if (!near) return; }
  for (const D of PH.doors) {
    const want = Math.hypot(p.x - D.cx, p.z - D.cz) < 3.6 && Math.abs(p.y - PH.F1) < 3 ? 1 : 0;
    D.open += (want - D.open) * Math.min(1, dt * 2.5);
    D.g.position.copy(D.base).addScaledVector(D.t, D.dir * 2.4 * D.open);
    D.c.y1 = D.open > 0.6 ? D.c.y0 : PH.F1 + 3.2;
  }
}
