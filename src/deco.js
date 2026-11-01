import { T, canvasTex, mulberry32, mergeGeos, MOBILE } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { registerLayer } from './chunks.js';
import { addGlow, roofs } from './facade-shader.js';

/* =====================================================================
   V38 · FASSADENSCHMUCK: Art-Déco-Details als eigene Chunk-Schicht (nur in der Nähe gebaut)
   Sonnenfächer über Portalen, Goldfriese an Gesimsen und Vordächern, Stufenkronen-Zinnen an den
   Gesimsecken, Kapitelle und Sockel der Pilaster, beleuchtete Vordächer mit Glühbirnenreihen,
   Wandlaternen, Türen für die Ringhäuser (hatten bisher keine), Dachreklame auf Steilschrift-Gestellen,
   verblasste Wandreklame auf Backstein im Arbeiterviertel.
   Alles aus geteilten Texturen (eine Leinwand je Motiv) und wenigen Materialien; der Fassaden-Shader
   wächst dafür nicht. Flächen vor der Wand sitzen 5 cm davor, liegen im Tiefenpuffer ein Stück vor
   (polygonOffset + Sehstrahl-Zug wie die Leuchtleisten in V34) und flackern so auch in der Ferne nicht.
   ===================================================================== */
export const DECOR = { portals: [], doors: [], outer: [], cornices: [], pilasters: [], ghosts: [], signs: [], planned: false };
export const DECO_CELL = 250, DECO_RADIUS = 360, DECO_FAR_CELL = 500, DECO_FAR_RADIUS = 1100;
export const ROOF_WORDS = ['AURORA', 'POLARIS', 'NORDLICHT', 'ZENITH', 'ORION', 'METEOR', 'LUMIÈRE', 'ODEON', 'ÉTOILE', 'KRISTALL', 'RADIO VESPERA', 'PALAIS', 'ARGENT', 'SAPHIR', 'CAPITOL', 'ASTORIA'];
export const GHOST_ADS = [['KOHLE & KOKS', 'GEBR. HALLER · SEIT 1899'], ['SEIFENFABRIK', 'NORDSTERN'], ['MASCHINENÖL', 'MARKE KRATER'], ['BRAUEREI', 'VESPERA · EXPORT'], ['ZIGARREN', 'HAVANNA IMPORT'], ['SCHMIEDE', 'EISEN · STAHL · GUSS']];

/* ---------- Planung (während des Stadtaufbaus) ---------- */
// Portal (entrances.js): fx/fz auf der Wand, o = Normale nach außen, kind, Arbeiterviertel ja/nein, Abstand zum Zentrum
export function decoPortal(fx, fz, o, kind, worker, dist) {
  DECOR.portals.push({ x: fx, z: fz, o, kind, worker, grade: worker ? 0 : dist < 520 ? 2 : 1 });
  if (!worker) for (const s of [-1, 1]) addGlow(fx - o[1] * s * 2.8 + o[0] * 1.3, 4.1, fz + o[0] * s * 2.8 + o[1] * 1.3, [1.3, 0.92, 0.55], 0.7);
}
// Haustür (building-forms.js)
export function decoHouseDoor(fx, fz, o, worker, dist) {
  const grade = worker ? 0 : dist < 560 ? 2 : 1;
  DECOR.doors.push({ x: fx, z: fz, o, worker, grade });
  if (grade > 0) for (const s of [-1, 1]) addGlow(fx - o[1] * s * 1.75 + o[0] * 0.32, 3.05, fz + o[0] * s * 1.75 + o[1] * 0.32, [1.3, 0.9, 0.5], 0.7);
}
// Eingang eines gedrehten Ringhauses (island.js rotHouse): Punkt auf der Wand, Normale (nx, nz), Art, Arbeiterhaus
export function decoOuterDoor(x, z, nx, nz, worker, kind, tint) {
  DECOR.outer.push({ x, z, o: [nx, nz], worker, kind, tint });
  addGlow(x + nx * 0.45, 3.0, z + nz * 0.45, worker ? [1.2, 0.72, 0.4] : [1.3, 0.92, 0.55], 0.9);
}
// Gesims einer Turmstufe (entrances.js decoBuilding): Zinnen auf den Ecken, bei hohen Elite-Türmen ein Goldfries auf der Gesimsfläche
export function decoCornice(cx, cz, w, d, yTop, h, corner, c, grade, tall) {
  if (grade < 2 || corner === 'round') return;
  DECOR.cornices.push({ x: cx, z: cz, w, d, yTop, h, c: corner === 'square' ? 0 : c, tall });
}
// Pilaster (shops.js facadeRelief): der Quader selbst, Achse (0: Wand läuft in x), Richtung nach außen, Tiefe
export function decoPilaster(seg, ax, out, deep, dist) { if (dist < 560) DECOR.pilasters.push({ seg, ax, out, deep }); }

// Dachreklame und Wandreklame aus der Dachliste planen (vor dem Ausgießen der Lichtpunkte, damit addGlow noch wirkt)
export function planDeco() {
  if (DECOR.planned) return; DECOR.planned = true;
  const rr = mulberry32(38381), maxSigns = MOBILE ? 14 : 44;
  let nSigns = 0;
  for (const r of roofs) {
    if (r.worker) {
      // verblasste Reklame auf einer Straßenseite der Backsteinhäuser
      if (r.H < 10 || r.shop || rr() > 0.38) continue;
      const sides = Object.keys(r.edges || {}).filter(k => r.edges[k]); if (!sides.length) continue;
      const side = sides[Math.floor(rr() * sides.length)], o = SIDE[side], ax = o[0] !== 0, L = ax ? r.fd : r.fw;
      // seitlich der Feuerleiter (sie hängt in der Mitte der Wand), höchstens 9 m breit
      const w = Math.min(L / 2 - 2.6, 9), h = Math.min(r.H - 6.4, 5.2); if (w < 3.5 || h < 2.4) continue;
      const u = (rr() < 0.5 ? -1 : 1) * (1.8 + w / 2 + rr() * Math.max(0, L / 2 - 0.8 - 1.8 - w));
      const bx = r.fx ?? r.x, bz = r.fz ?? r.z;
      DECOR.ghosts.push({ x: bx + o[0] * r.fw / 2 + (ax ? 0 : u), z: bz + o[1] * r.fd / 2 + (ax ? u : 0), o, w, h, y: 5.6 + h / 2, v: Math.floor(rr() * GHOST_ADS.length) });
      continue;
    }
    if (nSigns >= maxSigns || r.crown || r.shop || r.H < 26 || r.H > 100 || Math.min(r.w, r.d) < 12 || r.dist > 760 || rr() > 0.2) continue;
    const sides = Object.keys(r.edges || {}).filter(k => r.edges[k]); if (!sides.length) continue;
    const side = sides[Math.floor(rr() * sides.length)], o = SIDE[side], ax = o[0] !== 0, L = ax ? r.d : r.w;
    const word = ROOF_WORDS[Math.floor(rr() * ROOF_WORDS.length)], n = [...word].length;
    const w = Math.min(L - 4, n * 1.9 + 1.2); if (w < 6) continue;
    const h = w * 160 / (110 * n + 40), col = rr() < 0.55 ? 'gold' : rr() < 0.5 ? 'teal' : 'rose';
    const inset = 1.4, x = r.x + o[0] * (r.w / 2 - inset), z = r.z + o[1] * (r.d / 2 - inset);
    DECOR.signs.push({ x, z, o, w, h, y: r.H + 1.4 + h / 2, word, col, H: r.H });
    addGlow(x + o[0] * 0.6, r.H + 1.4 + h / 2, z + o[1] * 0.6, SIGN_GLOW[col], h * 1.3);
    nSigns++;
  }
}
export const SIDE = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
export const SIGN_GLOW = { gold: [1.3, 1.0, 0.55], teal: [0.5, 1.2, 1.1], rose: [1.3, 0.55, 0.7] };
export const SIGN_COL = { gold: [1.6, 1.42, 1.0], teal: [0.7, 1.6, 1.5], rose: [1.6, 0.75, 0.95] };

/* ---------- Texturen: drei geteilte Atlanten (Ornamente, Wandreklame, Leuchtbuchstaben) ---------- */
const TEX = {};
const GOLD = '#d9b35c', GOLD2 = '#f2d790', DARK = '#17120e';
// Ornament-Atlas 1024 x 512: oben links der Sonnenfächer, darunter drei kachelbare Streifen über die volle Breite
// (Glühbirnen hell, Glühbirnen gedämpft, Zickzack-Fries). Wiederholung läuft nur in u, darum passen Streifen und Fächer in ein Bild.
const ORN = { fan: [0, 0.5, 0.5, 1], lit: [0, 1, 0.25, 0.5], dim: [0, 1, 0.125, 0.25], frieze: [0, 1, 0, 0.125] };   // u0 u1 v0 v1
function ornTex() {
  const t = canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = DARK; g.fillRect(0, 0, W, H);
    // Sonnenfächer (0..512, 0..256): Strahlen und Bögen in Gold auf dunklem Bronzegrund, Stufenrahmen
    g.fillStyle = '#2a2016'; g.fillRect(8, 8, 496, 248);
    const cx = 256, cy = 244;
    for (let i = 0; i < 17; i++) {
      const a0 = Math.PI + i / 17 * Math.PI, a1 = Math.PI + (i + 0.55) / 17 * Math.PI;
      const gr = g.createRadialGradient(cx, cy, 10, cx, cy, 256); gr.addColorStop(0, GOLD2); gr.addColorStop(1, GOLD);
      g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 236, a0, a1); g.closePath(); g.fill();
    }
    g.strokeStyle = GOLD2; g.lineWidth = 5; for (const r of [36, 110, 180, 232]) { g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.stroke(); }
    g.fillStyle = GOLD2; g.beginPath(); g.arc(cx, cy, 22, Math.PI, 0); g.fill();
    g.fillStyle = GOLD; for (let k = 0; k < 4; k++) { const w = 10, hh = 14 * (4 - k); g.fillRect(14 + k * w, 256 - hh - 4, w, hh); g.fillRect(512 - 14 - (k + 1) * w, 256 - hh - 4, w, hh); }
    g.fillRect(0, 250, 512, 6); g.fillRect(0, 0, 512, 5);
    // Glühbirnenreihen (y 256..384 hell, 384..448 gedämpft): 16 Birnen je Streifen, zwei Reihen
    const bulbs = (y0, h, k) => {
      g.fillStyle = '#2b2118'; g.fillRect(0, y0, W, h);
      g.strokeStyle = `rgba(217,179,92,${0.5 * k})`; g.lineWidth = 2; g.strokeRect(1, y0 + 1, W - 2, h - 2); g.strokeRect(0, y0 + h / 2 - 1, W, 2);
      for (let y = y0 + h / 4; y < y0 + h; y += h / 2) for (let x = W / 32; x < W; x += W / 16) {
        const r = h / 8, gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, `rgba(255,246,220,${k})`); gr.addColorStop(0.35, `rgba(255,217,138,${k})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      }
    };
    bulbs(256, 128, 1.0); bulbs(384, 64, 0.55);
    // Zickzack-Fries (y 448..512) mit Doppellinie und Punkten
    g.fillStyle = DARK; g.fillRect(0, 448, W, 64);
    g.fillStyle = GOLD; g.fillRect(0, 450, W, 4); g.fillRect(0, 506, W, 4);
    g.strokeStyle = GOLD2; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, 448 + ((x / 16) % 2 ? 16 : 46)); g.stroke();
    g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, 448 + ((x / 16) % 2 ? 24 : 54)); g.stroke();
    for (let x = 32; x < W; x += 64) { g.fillStyle = GOLD2; g.beginPath(); g.arc(x, 479, 5, 0, 7); g.fill(); }
  });
  t.wrapS = T.RepeatWrapping; t.wrapT = T.ClampToEdgeWrapping; return t;
}
// Wandreklame-Atlas 1024 x 768: sechs verblasste Anzeigen (Alpha = Farbreste auf dem Ziegel)
function ghostTex() {
  const t = canvasTex(1024, 768, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    GHOST_ADS.forEach(([a, b], v) => {
      const rr = mulberry32(900 + v), x0 = (v % 2) * 512, y0 = Math.floor(v / 2) * 256;
      g.save(); g.beginPath(); g.rect(x0, y0, 512, 256); g.clip(); g.translate(x0, y0);
      g.fillStyle = 'rgba(236,226,200,0.62)'; g.fillRect(14, 14, 484, 228); g.clearRect(26, 26, 460, 204);
      g.fillStyle = 'rgba(236,226,200,0.7)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 60px Georgia, serif'; g.fillText(a, 256, 102, 452);
      g.font = '30px Georgia, serif'; g.fillText(b, 256, 184, 442);
      g.globalCompositeOperation = 'destination-out';
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(0,0,0,${0.3 + rr() * 0.7})`; g.fillRect(rr() * 512, rr() * 256, 2 + rr() * 8, 1 + rr() * 3); }
      g.restore();
    });
  });
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t;
}
// Leuchtbuchstaben-Atlas: alle Wörter der Dachreklame in Regalen zu 160 px, Buchstaben hell, Rest durchsichtig
const WORD_UV = {};
function lettersTex() {
  const W = 2048, ROW = 160, rows = []; let y = 0, x = 0;
  for (const word of ROOF_WORDS) {
    const n = [...word].length, w = 110 * n + 40;
    if (x + w > W) { x = 0; y += ROW; }
    rows.push({ word, x, y, w }); WORD_UV[word] = { x, y, w }; x += w + 8;
  }
  const H = y + ROW;
  for (const r of rows) { const u = WORD_UV[r.word]; u.u0 = u.x / W; u.u1 = (u.x + u.w) / W; u.v0 = 1 - (u.y + ROW) / H; u.v1 = 1 - u.y / H; u.ratio = u.w / ROW; }
  const t = canvasTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    g.font = '118px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const r of rows) {
      g.lineWidth = 10; g.strokeStyle = '#2a1a10'; g.strokeText(r.word, r.x + r.w / 2, r.y + ROW / 2 + 6, r.w - 24);
      g.fillStyle = '#fff4dc'; g.fillText(r.word, r.x + r.w / 2, r.y + ROW / 2 + 6, r.w - 24);
    }
  });
  t.wrapS = t.wrapT = T.ClampToEdgeWrapping; return t;
}
// Materialien, erst beim ersten Zellenbau angelegt (dann gibt es Umgebungskarte und MAT.gold). Sieben je Zelle:
// Metall und mattes Material tragen ihre Farbe je Ecke (Gold/Bronze bzw. Eisen/Stein/Holz), so bleibt es bei einem Draw Call je Sorte.
let M = null;
function pull(mat, key) {
  mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -2;
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position = projectionMatrix * vec4(mvPosition.xyz * 0.9995, 1.0);'); };
  mat.customProgramCacheKey = () => key;
  return mat;
}
function mats() {
  if (M) return M;
  TEX.orn = ornTex(); TEX.ghost = ghostTex(); TEX.letters = lettersTex();
  M = {
    metal: stdMat({ color: 0xffffff, vertexColors: true, metalness: 0.95, roughness: 0.42, emissive: 0x100903, envI: 0.7 }),
    matte: stdMat({ color: 0xffffff, vertexColors: true, metalness: 0.25, roughness: 0.62, envI: 0.4 }),
    glass: stdMat({ color: 0x1a1408, metalness: 0.5, roughness: 0.15, envI: 1.2, emissive: 0x4a2c0a }),
    lamp: new T.MeshBasicMaterial({ color: new T.Color(1.5, 1.2, 0.8) }),
    orn: pull(stdMat({ map: TEX.orn, emissive: 0xffffff, emissiveMap: TEX.orn, emissiveIntensity: 0.3, metalness: 0.85, roughness: 0.38, envI: 0.9 }), 'decoOrn'),
    lit: pull(new T.MeshBasicMaterial({ map: TEX.orn, color: new T.Color(1.25, 1.2, 1.1) }), 'decoLit'),
    ghost: pull(stdMat({ map: TEX.ghost, alphaTest: 0.3, roughness: 1, metalness: 0, envI: 0.08, emissive: 0xffdcae, emissiveMap: TEX.ghost, emissiveIntensity: 0.4 }), 'decoGhost'),
    letters: new T.MeshBasicMaterial({ map: TEX.letters, alphaTest: 0.5, side: T.DoubleSide, vertexColors: true }),
  };
  return M;
}

/* ---------- Bauteile ---------- */
const C = { gold: [0.79, 0.64, 0.35], bronze: [0.48, 0.35, 0.17], iron: [0.16, 0.15, 0.14], stone: [0.54, 0.53, 0.5], wood: [0.17, 0.11, 0.06] };
const KIND = { gold: 'metal', bronze: 'metal', iron: 'matte', stone: 'matte', wood: 'matte' };
const inCell = (p, cx, cz, size) => p.x >= cx * size && p.x < (cx + 1) * size && p.z >= cz * size && p.z < (cz + 1) * size;
const B = (w, h, d, x = 0, y = 0, z = 0) => new T.BoxGeometry(w, h, d).translate(x, y, z);
// Farbe je Ecke als aCol (mergeGeos nimmt eigene a*-Attribute mit; danach wird es zu color)
function col(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('aCol', new T.BufferAttribute(a, 3)); return g; }
// Teile in das Wandsystem drehen: lx entlang der Wand, y Höhe, lz nach außen (wie entrances.js)
function frame(x, z, o) {
  const ax = -o[1], az = o[0], ry = Math.atan2(o[0], o[1]);
  return (bag, geo, lx, y, lz) => bag.push(geo.rotateY(ry).translate(x + ax * lx + o[0] * lz, y, z + az * lx + o[1] * lz));
}
// Fläche mit Ausschnitt aus dem Ornament-Atlas; rep = Wiederholungen in u (nur für die Streifen über die volle Breite)
function plane(w, h, R = null, rep = 1) {
  const g = new T.PlaneGeometry(w, h);
  if (R) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, R[0] + (R[1] - R[0]) * uv.getX(i) * rep, R[2] + (R[3] - R[2]) * uv.getY(i)); }
  return g;
}
const FRIEZE_M = 2.8, BULB_M = 6.4;   // Meter je Atlasbreite der Streifen
// Wandlaterne: Arm, Laternenkasten mit warmem Glas, kleine Haube (Gold an Elitehäusern, Eisen im Arbeiterviertel)
function lantern(p, lx, y, lz, dark) {
  const m = dark ? 'iron' : 'gold';
  p(m, B(0.05, 0.05, lz - 0.02), lx, y + 0.22, lz / 2);
  p(m, B(0.26, 0.04, 0.26), lx, y + 0.2, lz); p(m, B(0.22, 0.04, 0.22), lx, y - 0.2, lz);
  p(m, new T.ConeGeometry(0.17, 0.12, 6), lx, y + 0.28, lz);
  p('glass', B(0.18, 0.36, 0.18), lx, y, lz);
  p('lamp', B(0.06, 0.1, 0.06), lx, y, lz);
}
// Vordach: dunkles Blech, Goldkanten, Fries an der Stirn, Unterseite voller Glühbirnen (dim = gedämpft)
function canopy(p, w, depth, y, dim) {
  p('iron', B(w, 0.12, depth), 0, y + 0.06, depth / 2);
  p('orn', plane(w, 0.3, ORN.frieze, w / FRIEZE_M), 0, y + 0.03, depth + 0.03);
  for (const s of [-1, 1]) p('gold', B(0.05, 0.3, depth + 0.02), s * (w / 2 - 0.02), y + 0.03, depth / 2);
  p('lit', plane(w - 0.2, depth - 0.16, dim ? ORN.dim : ORN.lit, w / BULB_M).rotateX(Math.PI / 2), 0, y - 0.005, depth / 2);
}
// p(art, geo, lx, y, lz): Farbteile landen eingefärbt im Metall- oder Mattbeutel, der Rest in seinem Beutel
const putter = (I, bag) => { const put = frame(I.x, I.z, I.o); return (k, g, lx, y, lz) => put(bag[KIND[k] || k], C[k] ? col(g, C[k]) : g, lx, y, lz); };
function buildPortalDeco(P, bag) {
  const p = putter(P, bag);
  // Unterseite des vorhandenen Vordachs (Platte y 4,5–4,85, 0 bis 2,6 m vor der Wand) mit Glühbirnen, Goldfries an seiner Stirn
  p('lit', plane(8.0, 2.3, P.grade ? ORN.lit : ORN.dim, 8 / BULB_M).rotateX(Math.PI / 2), 0, 4.485, 1.27);
  if (!P.grade) return;
  p('orn', plane(8.4, 0.3, ORN.frieze, 8.4 / FRIEZE_M), 0, 4.675, 2.63);
  // Sonnenfächer in der Wand zwischen Vordach und Sturz
  p('orn', plane(5.2, 2.2, ORN.fan), 0, 6.03, 0.06);
  // zwei Pendelleuchten unter dem Vordach
  for (const s of [-1, 1]) { p('gold', B(0.04, 0.5, 0.04), s * 2.8, 4.25, 1.3); p('lamp', new T.SphereGeometry(0.15, 10, 7), s * 2.8, 3.95, 1.3); p('gold', new T.ConeGeometry(0.2, 0.1, 10), s * 2.8, 4.05, 1.3); }
}
function buildDoorDeco(D, bag) {
  if (!D.grade) return;
  const p = putter(D, bag);
  for (const s of [-1, 1]) lantern(p, s * 1.75, 3.05, 0.32, false);
  // kleines Vordach über dem Sturz (Oberkante 4,1 m), darunter ein Fries auf der Wand
  canopy(p, 3.4, 1.1, 4.5, D.grade < 2);
  p('orn', plane(3.1, 0.3, ORN.frieze, 3.1 / FRIEZE_M), 0, 4.3, 0.05);
}
// Ringhäuser: Stufe, Gewände, Türblatt mit Füllungen, Griff, Oberlicht mit Sprossen, Laterne; Elitehäuser mit Vordach
function buildOuterDoor(E, bag) {
  const p = putter(E, bag), w = E.worker, m = w ? 'iron' : 'gold', f = w ? 'iron' : 'stone';
  p('stone', B(3.0, 0.16, 0.9), 0, 0.3, 0.45);
  p(f, B(0.28, 3.1, 0.3), -1.0, 1.75, 0.15); p(f, B(0.28, 3.1, 0.3), 1.0, 1.75, 0.15);
  p(f, B(2.3, 0.3, 0.3), 0, 3.45, 0.15);
  p('wood', B(1.7, 2.6, 0.1), 0, 1.52, 0.1);
  for (const s of [-1, 1]) { p('wood', B(0.6, 0.8, 0.04), s * 0.4, 2.2, 0.16); p('wood', B(0.6, 1.1, 0.04), s * 0.4, 1.0, 0.16); }
  p(m, B(0.03, 0.28, 0.05), 0.2, 1.2, 0.18); p(m, new T.SphereGeometry(0.04, 8, 6), 0.6, 1.15, 0.2);
  p('glass', B(1.7, 0.45, 0.04), 0, 3.05, 0.12); p(m, B(1.8, 0.05, 0.08), 0, 2.84, 0.14);
  for (let k = 1; k < 4; k++) p(m, B(0.03, 0.46, 0.03), -0.85 + k * 0.425, 3.05, 0.14);
  lantern(p, 1.45, 3.0, 0.42, w);
  if (!w) canopy(p, 3.0, 1.0, 3.9, true);
}
function buildCornice(Cn, bag) {
  const hw = Cn.w / 2, hd = Cn.d / 2, ins = Cn.c > 1.2 ? Cn.c * 0.5 + 0.7 : 0.8;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = Cn.x + sx * (hw - ins), z = Cn.z + sz * (hd - ins);
    // Stufenkrone: drei Stufen, oben eine Kugel
    for (const g of [B(1.3, 0.26, 1.3, x, Cn.yTop + 0.14, z), B(0.9, 0.26, 0.9, x, Cn.yTop + 0.4, z), B(0.5, 0.34, 0.5, x, Cn.yTop + 0.7, z), new T.SphereGeometry(0.16, 8, 6).translate(x, Cn.yTop + 0.98, z)]) bag.metal.push(col(g, C.gold));
  }
  if (!Cn.tall) return;
  // Goldfries auf den vier Gesimsflächen (bei Fasen zwischen den Ecken)
  const y = Cn.yTop - Cn.h * 0.5, cut = Cn.c > 1.2 ? Cn.c * 2 : 0;
  for (const [o, L] of [[[0, -1], Cn.w - cut], [[0, 1], Cn.w - cut], [[-1, 0], Cn.d - cut], [[1, 0], Cn.d - cut]]) {
    if (L < 2) continue;
    const put = frame(Cn.x + o[0] * hw, Cn.z + o[1] * hd, o);
    put(bag.orn, plane(L, Math.min(0.5, Cn.h * 0.6), ORN.frieze, L / FRIEZE_M), 0, y, 0.05);
  }
}
function buildPilaster(Pi, bag) {
  const s = Pi.seg; if (s.dead) return;
  const w = Pi.ax ? Pi.deep + 0.08 : 0.95, d = Pi.ax ? 0.95 : Pi.deep + 0.08;
  const x = s.x + (Pi.ax ? Pi.out * 0.03 : 0), z = s.z + (Pi.ax ? 0 : Pi.out * 0.03);
  bag.metal.push(col(B(w, 0.32, d, x, s.y1 - 0.18, z), C.gold));
  bag.metal.push(col(B(w - 0.04, 0.5, d - 0.04, x, s.y0 + 0.25, z), C.bronze));
}
function buildGhost(G, bag) {
  const put = frame(G.x, G.z, G.o), v = G.v % GHOST_ADS.length, u0 = (v % 2) * 0.5, row = Math.floor(v / 2);
  put(bag.ghost, plane(G.w, G.h, [u0, u0 + 0.5, 1 - (row + 1) / 3, 1 - row / 3]), 0, G.y, 0.05);
}
function buildSign(S, bag) {
  const put = frame(S.x, S.z, S.o), u = WORD_UV[S.word];
  put(bag.letters, col(plane(S.w, S.h, [u.u0, u.u1, u.v0, u.v1]), SIGN_COL[S.col]), 0, S.y, 0);
  // Stahlgestell: Fußschwelle, Pfosten alle 3 m, obere Schiene, Streben nach hinten
  const n = Math.max(2, Math.round(S.w / 3)), top = S.y + S.h / 2 + 0.15;
  put(bag.iron, B(S.w + 0.3, 0.1, 0.1), 0, S.H + 1.3, 0); put(bag.iron, B(S.w + 0.3, 0.08, 0.08), 0, top, 0);
  for (let k = 0; k <= n; k++) {
    const lx = -S.w / 2 + S.w * k / n;
    put(bag.iron, B(0.08, top - S.H, 0.08), lx, (top + S.H) / 2, 0);
    const L = Math.hypot(top - S.H, 1.6);
    put(bag.iron, B(0.06, L, 0.06).rotateX(Math.atan2(1.6, top - S.H)), lx, (top + S.H) / 2, -0.8);
  }
}

/* ---------- Chunk-Schichten ---------- */
export function setupDecoLayers() {
  const q = new URLSearchParams(location.search);   // Fehlersuche: ?nodeco schaltet den Schmuck ab, ?nofar nur die Dachreklame
  if (q.has('nodeco')) return;
  registerLayer({
    name: 'deco', size: DECO_CELL, radius: cam => DECO_RADIUS + Math.max(0, cam.position.y) * 0.8,
    build(cx, cz) {
      const Mt = mats();
      const bag = { metal: [], matte: [], glass: [], lamp: [], orn: [], lit: [], ghost: [] };
      for (const P of DECOR.portals) if (inCell(P, cx, cz, DECO_CELL)) buildPortalDeco(P, bag);
      for (const D of DECOR.doors) if (inCell(D, cx, cz, DECO_CELL)) buildDoorDeco(D, bag);
      for (const E of DECOR.outer) if (inCell(E, cx, cz, DECO_CELL)) buildOuterDoor(E, bag);
      for (const Cn of DECOR.cornices) if (inCell(Cn, cx, cz, DECO_CELL)) buildCornice(Cn, bag);
      for (const Pi of DECOR.pilasters) if (inCell(Pi.seg, cx, cz, DECO_CELL)) buildPilaster(Pi, bag);
      for (const G of DECOR.ghosts) if (inCell(G, cx, cz, DECO_CELL)) buildGhost(G, bag);
      const g = new T.Group();
      for (const k in bag) if (bag[k].length) g.add(mesh(bag[k], Mt[k]));
      return g.children.length ? g : null;
    },
  });
  if (q.has('nofar')) return;
  registerLayer({
    name: 'decoFar', size: DECO_FAR_CELL, radius: cam => DECO_FAR_RADIUS + Math.max(0, cam.position.y) * 1.5,
    build(cx, cz) {
      const Mt = mats(), bag = { iron: [], letters: [] };   // iron: Gestell, eingefärbt im Mattmaterial
      for (const S of DECOR.signs) if (inCell(S, cx, cz, DECO_FAR_CELL)) buildSign(S, bag);
      if (!bag.iron.length) return null;
      const g = new T.Group(); g.add(mesh(bag.iron.map(q => col(q, C.iron)), Mt.matte), mesh(bag.letters, Mt.letters));
      return g;
    },
  });
}
function mesh(list, mat) {
  const g = mergeGeos(list);
  if (g.attributes.aCol) { g.setAttribute('color', g.attributes.aCol); g.deleteAttribute('aCol'); }
  const m = new T.Mesh(g, mat); m.frustumCulled = false; return m;
}
export const decoStats = () => ({ portals: DECOR.portals.length, doors: DECOR.doors.length, outer: DECOR.outer.length, cornices: DECOR.cornices.length, pilasters: DECOR.pilasters.length, ghosts: DECOR.ghosts.length, signs: DECOR.signs.length });

/* ---------- V38 · FASSADEN-LABOR (index.html?lab=fassade): ein Elitehaus mit Portal, Haustür und Dachreklame,
   ein Backsteinhaus mit Wandreklame, eine Ringhaus-Tür, vor dunklem Grund; tools/lab-shot.js macht Bilder (LAB=fassade) ---------- */
export async function startFacadeLab(params) {
  const { scene, camera, renderer, U, $ } = await import('./core.js');
  const PS = await import('./people-skeleton.js'), FS = await import('./facade-shader.js');
  const EN = await import('./entrances.js'), BF = await import('./building-forms.js'), SH = await import('./shops.js');
  const CH = await import('./chunks.js');
  PS.buildEnv(); PS.getMats();
  scene.fog.density = 0.0002;
  const floor = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const rr = mulberry32(7);
  // Elitehaus 26 x 18 x 48 m mit Gesims, Pilastern, Portal nach Süden, Haustür nach Osten
  const tint = FS.STONES[0], seed = 123, edges = { n: true, s: true, w: true, e: true };
  SH.tier(0, 0, 26, 18, 0.2, 48.2, { tint, seed, style: 0, dens: 0.4, flood: 0.2, rib: [0, 0, 0] }, 'square', 0);
  SH.tier(0, 0, 26.9, 18.9, 47.4, 48.5, { tint: tint.map(v => v * 1.15), seed: seed + 50, style: 3, dens: 0, flood: 0 }, 'square', 0, false);
  decoCornice(0, 0, 26.9, 18.9, 48.5, 1.1, 'square', 0, 2, true);
  SH.tier(0, 0, 26.5, 18.5, 4.6, 5.38, { tint: tint.map(v => v * 1.2), seed: seed + 51, style: 3, dens: 0, flood: 0.3 }, 'square', 0, false);
  SH.facadeRelief(0, 0, 26, 18, 5.3, 47.4, 0, tint, seed + 61, { n: false, s: true, w: false, e: true }, rr, 'square', 0);
  EN.portal(0, 0, 26, 18, { s: true }, tint, rr, 'hotel');
  BF.houseDoor(0, 0, 26, 18, { e: true }, tint, rr);
  roofs.push({ x: 0, z: 0, w: 26, d: 18, H: 48.2, worker: false, dist: 100, edges, fw: 26, fd: 18, fx: 0, fz: 0, shop: false, arcade: false, crown: false });
  // Backsteinhaus 14 x 10 x 12 m
  const bt = SH.BRICK[0];
  FS.addSeg({ x: 40, z: 0, w: 14, d: 10, y0: 0.2, y1: 12.2, tint: bt, seed: 77, style: 0, dens: 0.4, flood: 0, rib: [0, 0, 0] }, false);
  FS.addSeg({ x: 40, z: 0, w: 14.5, d: 10.5, y0: 11.5, y1: 12.45, tint: bt.map(v => v * 1.18), seed: 127, style: 3, dens: 0, flood: 0 }, false);
  roofs.push({ x: 40, z: 0, w: 14, d: 10, H: 12.2, worker: true, dist: 700, edges: { s: true }, fw: 14, fd: 10, fx: 40, fz: 0, shop: false, arcade: false });
  BF.houseDoor(40, 0, 14, 10, { s: true }, bt, rr);
  // Ringhaus-Tür an einer gedrehten Wand
  const ry = 0.6, nx = -Math.sin(ry), nz = -Math.cos(ry);
  FS.addSeg({ x: -40, z: 0, w: 14, d: 10, y0: 0.2, y1: 15.2, tint: FS.STONES[1], seed: 55, style: 1, dens: 0.4, flood: 0, rib: [0, 0, 0], ry }, false);
  decoOuterDoor(-40 + nx * 5, 0 + nz * 5, nx, nz, false, 'cafe', FS.STONES[1]);
  decoOuterDoor(40 - 7, -3, -1, 0, true, 'pub', bt);
  planDeco();
  DECOR.signs.push({ x: 0, z: 9 - 1.4, o: [0, 1], w: 14, h: 14 * 160 / (110 * 6 + 40), y: 48.2 + 1.4 + 1.6, word: 'AURORA', col: 'gold', H: 48.2 });
  // Fassadenquader wie in flushInstances
  const box = new T.BoxGeometry(1, 1, 1), S = FS.segs, m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), p3 = new T.Vector3(), s3 = new T.Vector3();
  const tintA = new Float32Array(S.length * 3), par = new Float32Array(S.length * 4), rib = new Float32Array(S.length * 3), flg = new Float32Array(S.length);
  const im = new T.InstancedMesh(box, FS.facadeMat, S.length);
  S.forEach((s, i) => {
    if (s.ry) m.compose(p3.set(s.x, (s.y0 + s.y1) / 2, s.z), q.setFromAxisAngle(up, s.ry), s3.set(s.w, s.y1 - s.y0, s.d)); else m.makeScale(s.w, s.y1 - s.y0, s.d).setPosition(s.x, (s.y0 + s.y1) / 2, s.z);
    im.setMatrixAt(i, m); tintA.set(s.tint, i * 3); par.set([s.seed, s.style, s.dens, s.flood], i * 4); if (s.rib) rib.set(s.rib, i * 3); flg[i] = s.fl || 0;
  });
  box.setAttribute('aFlag', new T.InstancedBufferAttribute(flg, 1)); box.setAttribute('aTint', new T.InstancedBufferAttribute(tintA, 3));
  box.setAttribute('aRib', new T.InstancedBufferAttribute(rib, 3)); box.setAttribute('aParams', new T.InstancedBufferAttribute(par, 4));
  im.frustumCulled = false; scene.add(im);
  EN.buildEntrances(); BF.buildHouseDoors();
  setupDecoLayers();
  for (const L of CH.layers) for (let cx = -1; cx <= 1; cx++) for (let cz = -1; cz <= 1; cz++) { const o = L.build(cx, cz, 0, {}); if (o) scene.add(o); }
  const V = {
    alle: [[30, 12, 70], [0, 14, 0]], portal: [[2, 3.2, 20], [0, 4.5, 9]], portalnah: [[-3, 5.5, 13.5], [0, 5.8, 9]],
    tuer: [[20, 2.6, 2], [13, 2.8, 0]], krone: [[22, 54, 24], [0, 48.5, 0]], dach: [[0, 50, 40], [0, 50, 9]],
    reklame: [[40, 6, 22], [40, 7.5, 5]], ring: [[-40 + nx * 14, 2.4, nz * 14 - 3], [-40 + nx * 5, 2.4, nz * 5]], pub: [[33, 2.4, -14], [33, 2.4, -3]],
  };
  window.labView = name => { const v = V[name] || V.alle; camera.position.set(...v[0]); camera.lookAt(...v[1]); };
  window.labTime = t => { LABF.t = t; }; const LABF = { t: params.get('t') != null ? +params.get('t') : null };
  window.labView(params.get('view') || 'alle');
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  const t0 = performance.now();
  const loop = now => { U.uTime.value = LABF.t != null ? LABF.t : (now - t0) / 1000; U.uCam.value.copy(camera.position); renderer.render(scene, camera); window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}
