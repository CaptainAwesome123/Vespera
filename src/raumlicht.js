/* =====================================================================
   V67 · RAUMLICHT: vorberechnete Raumschatten, Kontaktschatten und
   gemalte Lichtflecken für die Innenräume (Belmont-Lobby, Ballsaal,
   Penthouse, Villa, Luftschiff).
   Alles sind flache, weiche Flecken aus einem kleinen Bildatlas, die
   beim Laden in ZWEI Netze je Raumgruppe zusammengefasst werden:
   - Schatten (schwarz, normal gemischt): Kontaktschatten unter Möbeln,
     dunklere Ränder dort, wo Boden und Wand oder Wand und Decke
     zusammenstoßen, weiche Dunkelheit unter Galerien und an Säulen.
   - Licht (warm, addiert): Lichtflecken unter Kronleuchtern und
     Lichtfächer über Wandleuchten.
   Kein Schatten im Shader, keine Verzweigung, kein zusätzliches Licht:
   je Raumgruppe zwei Zeichenaufrufe mit dem kleinsten Basis-Shader.
   Bewegliche Möbel (V52): ihr Kontaktschatten gehört zum Stück. Hebt
   Alexander es an, fällt der Fleck mit den übrigen Ecken des Stücks
   in sich zusammen (physics.js furnHide) und kehrt mit ihm zurück.
   Kein Import außer core.js, damit die Modulreihenfolge frei bleibt.
   ===================================================================== */
import { T, mulberry32 } from './core.js';

export const RL = { on: false, sh: [], li: [], stats: { quads: 0, meshes: 0 } };

// ---------- Bildatlas 256 x 256 in vier Feldern ----------
// 0 oben links: weiches Rechteck (Möbel), 1 oben rechts: Verlauf (Kanten, unten 1 -> oben 0),
// 2 unten links: runder Fleck (Tische, Säulen, Lichtflecken), 3 unten rechts: Lichtfächer einer Wandleuchte
let ATLAS = null;
function atlas() {
  if (ATLAS) return ATLAS;
  const N = 256, H = N / 2, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N), d = img.data;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = x < H ? 0 : 1, cy = y < H ? 0 : 1, u = ((x % H) + 0.5) / H, v = ((y % H) + 0.5) / H;   // v: 0 oben im Feld
    const dx = Math.abs(u - 0.5) * 2, dy = Math.abs(v - 0.5) * 2;
    let a = 0;
    if (cx === 0 && cy === 0) {
      // weiches Rechteck: innen voll, zum Rand hin weich auslaufend (Abstand zum Innenrechteck)
      const ex = Math.max(0, dx - 0.45) / 0.5, ey = Math.max(0, dy - 0.45) / 0.5, r = Math.min(1, Math.hypot(ex, ey));
      a = Math.pow(1 - sm(0, 1, r), 1.4);
    } else if (cx === 1 && cy === 0) {
      // Verlauf: unten im Feld 1, nach oben weich zu 0 (wie Umgebungsverdeckung in einer Ecke)
      const t = 1 - v; a = Math.pow(1 - Math.min(1, t / 0.97), 2.2) * sm(0.0, 0.06, Math.min(u, 1 - u) + 0.02);
    } else if (cx === 0 && cy === 1) {
      const r = Math.min(1, Math.hypot(dx, dy)); a = Math.pow(1 - sm(0, 1, r), 1.6);
    } else {
      // Lichtfächer: Ursprung in der Mitte, nach oben breit und lang, nach unten kurz
      const up = v < 0.5, ry = up ? (0.5 - v) / 0.5 : (v - 0.5) / 0.24, w = 0.12 + (up ? 0.85 : 0.45) * Math.min(1, ry);
      a = ry >= 1 ? 0 : Math.pow(Math.max(0, 1 - dx / w), 1.6) * Math.pow(1 - ry, up ? 1.5 : 2.2) * (0.35 + 0.65 * sm(0, 0.12, ry + 0.04));
    }
    const k = (y * N + x) * 4, b = Math.round(Math.min(1, a) * 255); d[k] = d[k + 1] = d[k + 2] = b; d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ATLAS = new T.CanvasTexture(c); ATLAS.minFilter = T.LinearMipmapLinearFilter; ATLAS.magFilter = T.LinearFilter;
  return ATLAS;
}
// Feldgrenzen im Atlas (mit Rand gegen Übersprechen der Nachbarfelder); CanvasTexture dreht v (flipY)
const IN = 3 / 256;
function cellUV(cell) {
  const cx = cell & 1, cy = cell >> 1;
  return { u0: cx * 0.5 + IN, u1: cx * 0.5 + 0.5 - IN, v0: 1 - (cy + 1) * 0.5 + IN, v1: 1 - cy * 0.5 - IN };   // v1 = oben im Feld
}

// ---------- Sammeln ----------
export function shadeBegin() { RL.on = true; RL.sh = []; RL.li = []; }
// Eine Fläche: vier Ecken (je [x,y,z]), vier UV, Stärke a; mov = Stück (Kontaktschatten beweglicher Möbel)
function push(list, P, UV, a, mov) { list.push({ P, UV, a, mov }); }
// liegende Fläche um (cx, y, cz), Breite w (x), Tiefe d (z), gedreht um ry
export function shadeQuad(cx, y, cz, w, d, ry, a, cell = 0, mov = null, light = false) {
  const c = Math.cos(ry), s = Math.sin(ry), hw = w / 2, hd = d / 2, C = cellUV(cell);
  const pt = (lx, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
  push(light ? RL.li : RL.sh, [pt(-hw, hd), pt(hw, hd), pt(hw, -hd), pt(-hw, -hd)], [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, mov);
}
// Kante am Boden (oder an der Decke): Linie (x0,z0)-(x1,z1) in Höhe y, Fleck läuft w Meter in Richtung (nx, nz) aus
export function shadeEdge(x0, z0, x1, z1, y, nx, nz, w, a) {
  if (Math.hypot(x1 - x0, z1 - z0) < 0.05) return;
  const C = cellUV(1);
  push(RL.sh, [[x0, y, z0], [x1, y, z1], [x1 + nx * w, y, z1 + nz * w], [x0 + nx * w, y, z0 + nz * w]], [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, null);
}
// Wandfuß: senkrechte Fläche vor der Wand (Normale nx, nz zeigt in den Raum), dunkel an der Kante bei y0, läuft bis y0 + h aus.
// h < 0: Deckenkante, dunkel oben, läuft nach unten aus.
export function shadeWall(x0, z0, x1, z1, y0, h, nx, nz, a) {
  if (Math.hypot(x1 - x0, z1 - z0) < 0.05) return;
  const C = cellUV(1), o = 0.018, X0 = x0 + nx * o, Z0 = z0 + nz * o, X1 = x1 + nx * o, Z1 = z1 + nz * o;
  push(RL.sh, [[X0, y0, Z0], [X1, y0, Z1], [X1, y0 + h, Z1], [X0, y0 + h, Z0]], [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, null);
}
// Ein rechteckiger Raum (Innenmaße): Boden- und Deckenkanten aller vier Wände. gaps: [x0, x1, z0, z1] (Türen, Treppenaugen),
// dort bleiben die Kanten offen. o: { a, w (Bodenstreifen), wh (Wandfuß), ceil (Deckenhöhe über y oder 0), sides: 'nsew' }
export function shadeRoom(x0, x1, z0, z1, y, o = {}) {
  const a = o.a ?? 0.5, w = o.w ?? 0.9, wh = o.wh ?? 0.75, H = o.ceil || 0, sides = o.sides || 'nsew', gaps = o.gaps || [];
  // eine Wand in Stücke ohne Lücken teilen; along: 'x' (Wand bei festem z) oder 'z'
  const pieces = (lo, hi, fixed, along) => {
    const cut = [];
    for (const [gx0, gx1, gz0, gz1] of gaps) {
      if (along === 'x' ? fixed >= gz0 - 0.3 && fixed <= gz1 + 0.3 : fixed >= gx0 - 0.3 && fixed <= gx1 + 0.3) cut.push(along === 'x' ? [gx0, gx1] : [gz0, gz1]);
    }
    cut.sort((p, q) => p[0] - q[0]);
    const out = []; let s = lo;
    for (const [c0, c1] of cut) { if (c1 <= s || c0 >= hi) continue; if (c0 > s) out.push([s, c0]); s = Math.max(s, c1); }
    if (s < hi) out.push([s, hi]);
    return out;
  };
  const wall = (ax, az, bx, bz, nx, nz) => {
    shadeEdge(ax, az, bx, bz, y + 0.05, nx, nz, w, a);
    shadeWall(ax, az, bx, bz, y, wh, nx, nz, a * 0.8);
    if (H) { shadeWall(ax, az, bx, bz, y + H, -wh * 1.2, nx, nz, a * 0.7); shadeEdge(ax, az, bx, bz, y + H - 0.02, nx, nz, w * 1.2, a * 0.6); }
  };
  if (sides.includes('n')) for (const [p, q] of pieces(x0, x1, z0, 'x')) wall(p, z0, q, z0, 0, 1);
  if (sides.includes('s')) for (const [p, q] of pieces(x0, x1, z1, 'x')) wall(q, z1, p, z1, 0, -1);
  if (sides.includes('w')) for (const [p, q] of pieces(z0, z1, x0, 'z')) wall(x0, q, x0, p, 1, 0);
  if (sides.includes('e')) for (const [p, q] of pieces(z0, z1, x1, 'z')) wall(x1, p, x1, q, -1, 0);
}
// runder Kontaktschatten (Säulen, Tische, Kübel)
export function shadeDisc(x, y, z, r, a) { shadeQuad(x, y + 0.052, z, r * 2, r * 2, 0, a, 2); }
// Säule: Fleck am Fuß
export function shadeColumn(x, y, z, r, a = 0.5) { shadeDisc(x, y, z, r * 2.4, a); }
// warmer Lichtfleck auf dem Boden (unter Kronleuchtern und Lampen); c = [r, g, b] (bis etwa 1)
export function lightPool(x, y, z, r, c, a = 0.25) { shadeQuad(x, y + 0.058, z, r * 2, r * 2, 0, a, 2, null, true); RL.li[RL.li.length - 1].c = c; }
// Lichtfächer über einer Wandleuchte; (nx, nz) zeigt von der Wand in den Raum, w Breite, h Höhe (Ursprung bei 0,5 h)
export function wallWash(x, y, z, nx, nz, w, h, c, a = 0.35) {
  const C = cellUV(3), o = 0.025, tx = -nz, tz = nx, X = x + nx * o, Z = z + nz * o, hw = w / 2;
  push(RL.li, [[X - tx * hw, y - h / 2, Z - tz * hw], [X + tx * hw, y - h / 2, Z + tz * hw], [X + tx * hw, y + h / 2, Z + tz * hw], [X - tx * hw, y + h / 2, Z - tz * hw]],
    [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, null);
  RL.li[RL.li.length - 1].c = c;
}
// Waagerechter Lichtschleier (Decke an einer Voute oder Boden vor einer Lichtkante): hell an der Linie, läuft w Meter aus
export function lightBand(x0, z0, x1, z1, y, nx, nz, w, c, a = 0.3) {
  const C = cellUV(1);
  push(RL.li, [[x0, y, z0], [x1, y, z1], [x1 + nx * w, y, z1 + nz * w], [x0 + nx * w, y, z0 + nz * w]], [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, null);
  RL.li[RL.li.length - 1].c = c;
}
// Gerader Lichtstreifen an einer Wand oder Decke (Vouten): wie wallWash, aber ohne Fächer (Verlauf von der Kante weg)
export function lightEdge(x0, z0, x1, z1, y0, h, nx, nz, c, a = 0.3) {
  const C = cellUV(1), o = 0.022, X0 = x0 + nx * o, Z0 = z0 + nz * o, X1 = x1 + nx * o, Z1 = z1 + nz * o;
  push(RL.li, [[X0, y0, Z0], [X1, y0, Z1], [X1, y0 + h, Z1], [X0, y0 + h, Z0]], [[C.u0, C.v0], [C.u1, C.v0], [C.u1, C.v1], [C.u0, C.v1]], a, null);
  RL.li[RL.li.length - 1].c = c;
}

// ---------- Kontaktschatten der Möbel (placeFurn in entrances.js ruft das, solange gesammelt wird) ----------
const FS = {   // Feld, Stärke, Rand (m), nur am Boden
  sofa: [0, 0.6, 0.16], clubChair: [0, 0.58, 0.14], diningChair: [0, 0.38, 0.1], bistroChair: [0, 0.34, 0.1], barStool: [2, 0.36, 0.1],
  roundTable: [2, 0.42, 0.22], floorLamp: [2, 0.38, 0.12], vasePlant: [2, 0.48, 0.14],
};
export function furnShadow(parts, x, y, z, a, e) {
  if (!RL.on) return;
  const F = parts.furn, s = F && FS[F.type]; if (!s) return;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y0 = 1e9;
  for (const [g] of parts) {
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 2] < z0) z0 = p[i + 2]; if (p[i + 2] > z1) z1 = p[i + 2]; if (p[i + 1] < y0) y0 = p[i + 1]; }
  }
  if (y0 > 0.25 || x1 < x0) return;   // hängt oder steht nicht am Boden
  const [cell, str, m] = s, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, c = Math.cos(a), sn = Math.sin(a);
  const w = x1 - x0 + m * 2, d = z1 - z0 + m * 2, r = cell === 2 ? Math.max(w, d) : 0;
  shadeQuad(x + cx * c + cz * sn, y + 0.055, z - cx * sn + cz * c, r || w, r || d, a, str, cell, e);
}

// ---------- Zusammenfassen ----------
let MS = null, ML = null;
function mats() {
  if (MS) return;
  const t = atlas();
  MS = new T.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, vertexColors: true, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  ML = new T.MeshBasicMaterial({ color: 0xffffff, alphaMap: t, transparent: true, vertexColors: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 });
}
function build(list, mat, light) {
  const n = list.length * 4, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 4), idx = n > 65535 ? new Uint32Array(list.length * 6) : new Uint16Array(list.length * 6);
  const geo = new T.BufferGeometry();
  list.forEach((q, k) => {
    const o = k * 4, c = light ? (q.c || [1, 0.75, 0.45]) : [1, 1, 1];
    for (let i = 0; i < 4; i++) { pos.set(q.P[i], (o + i) * 3); nor.set([0, 1, 0], (o + i) * 3); uv.set(q.UV[i], (o + i) * 2); col.set([c[0], c[1], c[2], q.a], (o + i) * 4); }
    idx.set([o, o + 1, o + 2, o, o + 2, o + 3], k * 6);
    // Kontaktschatten beweglicher Möbel: Eckenbereich merken wie mergeGeos (core.js), damit furnHide ihn mit zusammenfallen lässt
    if (q.mov) q.mov.ranges.push({ geo, role: 'shadow', key: 'shadow', o, c: 4, io: k * 6, ic: 6 });
  });
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setAttribute('color', new T.BufferAttribute(col, 4)); geo.setIndex(new T.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  const m = new T.Mesh(geo, mat); m.renderOrder = light ? 2 : 1; m.name = light ? 'raumlicht' : 'raumschatten'; m.userData.noRefl = true;   // nicht ins Spiegelbild des Pflasters
  RL.stats.quads += list.length; RL.stats.meshes++;
  return m;
}
// Gesammeltes in parent hängen (lokale Koordinaten der Gruppe, z. B. Luftschiff) und Sammeln beenden.
// o.pick(y) -> Gruppe: Flecken nach Höhe auf mehrere Gruppen verteilen (Villa: Keller, Erdgeschoss, Obergeschoss);
// o.matrix: Lage der gesammelten Koordinaten in der Welt (Villa: gedreht und verschoben)
export function shadeEnd(parent, o = {}) {
  RL.on = false;
  const sh = RL.sh, li = RL.li; RL.sh = []; RL.li = [];
  if (!parent && !o.pick) return;
  mats();
  const groups = new Map(), at = q => o.pick ? o.pick(q.P[0][1]) : parent;
  for (const [list, light] of [[sh, false], [li, true]]) for (const q of list) { const g = at(q); if (!g) continue; const k = groups.get(g) || groups.set(g, [[], []]).get(g); k[light ? 1 : 0].push(q); }
  for (const [g, [a, b]] of groups) for (const [list, light] of [[a, false], [b, true]]) {
    if (!list.length) continue;
    const m = build(list, light ? ML : MS, light);
    if (o.matrix) { m.geometry.applyMatrix4(o.matrix); m.geometry.computeBoundingSphere(); }
    g.add(m);
  }
}

// ---------- Bodenglanz zähmen ----------
// Rauheitskarte für spiegelnde Böden: Grundwert mit Marmoradern und leichten Laufspuren, damit Punktlichter keine grellen
// weißen Ellipsen mehr werfen. rects: [u0, v0, u1, v1, Wert] (u, v von oben links, 0..1) für Läufer und Tanzflächen.
export function roughTex(W, H, o = {}) {
  const base = o.base ?? 0.32, vari = o.vari ?? 0.08, rr = mulberry32(o.seed ?? 5), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), gray = v => { const k = Math.round(Math.min(1, Math.max(0, v)) * 255); return `rgb(${k},${k},${k})`; };
  g.fillStyle = gray(base); g.fillRect(0, 0, W, H);
  // weiche Flecken (Politur ungleichmäßig)
  for (let i = 0; i < 60; i++) { const x = rr() * W, y = rr() * H, r = (0.04 + rr() * 0.12) * Math.max(W, H), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, gray(base + (rr() - 0.5) * vari * 2)); gr.addColorStop(1, gray(base)); g.globalAlpha = 0.5; g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // Adern: glatter (dunkler) als der Stein
  g.globalAlpha = 0.6; g.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    let x = rr() * W, y = rr() * H, a = rr() * Math.PI * 2; g.strokeStyle = gray(base - vari * 1.2); g.lineWidth = 0.6 + rr() * 1.6; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 14; k++) { a += (rr() - 0.5) * 0.9; x += Math.cos(a) * W * 0.03; y += Math.sin(a) * W * 0.03; g.lineTo(x, y); }
    g.stroke();
  }
  g.globalAlpha = 1;
  for (const [u0, v0, u1, v1, v] of o.rects || []) { g.fillStyle = gray(v); g.fillRect(u0 * W, v0 * H, (u1 - u0) * W, (v1 - v0) * H); }
  const t = new T.CanvasTexture(c); t.encoding = T.LinearEncoding;
  return t;
}

// ---------- V70: Samtschein für Polster und Vorhänge ----------
// Samt leuchtet an den Rändern, wo der Blick flach über den Flor streift. Eine Zeile im Standard-Shader (kein Zweig):
// Eigenleuchten + Farbe * (1 - N·V)^3 * Stärke, mal etwas Umgebungslicht. Ein Programm für alle Samtstoffe (Cache-Schlüssel).
export function addSheen(mat, k = 0.5) {
  if (!mat || mat.userData.sheen) return mat;
  mat.userData.sheen = k;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.uniforms.uSheen = { value: k };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSheen;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += (diffuseColor.rgb * 1.5 + 0.03) * uSheen * pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 3.0);');
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '|sheen';
  mat.needsUpdate = true;
  return mat;
}
