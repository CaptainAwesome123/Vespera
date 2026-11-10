import { T, mulberry32, canvasTex, scene, MOON_DIR } from './core.js';
import { addSeg, addNeon, addGlow, spires, NEON } from './facade-shader.js';
import { addCollider } from './people-skeleton.js';
import { caps } from './entrances.js';

/* =====================================================================
   V76 · STADTBILD: neue Turmkronen, Lisenen und Leuchtpylone
   Alles hier ist Zugabe auf die bestehenden Türme: der Stadtplan, die Höhen, Läden und Eingänge bleiben, wie sie sind.
   Darum würfelt dieses Update nur mit einem eigenen Zufall je Turm (plan76) und nie mit dem der Stadt.
   - Sonnenkrone: goldene Pyramide, aus der auf jeder Seite vier gestaffelte Bögen mit leuchtenden Dreiecksfenstern wachsen
   - Leuchtlaterne: drei achteckige Glastrommeln übereinander mit goldenen Strebeflossen
   - Ankermast: schlanker Mast aus Trommeln mit Flügeln, wie für ein Luftschiff gebaut
   - Stufenkrone: kreuzförmig gestaffelte Blöcke mit hohen Bogenfenstern und Goldflossen
   - Lisenen: Steinpfeiler laufen an den oberen Stufen hoch und enden als kleine Zinnen über der Brüstung
   - Leuchtpylone: gestufte Steinblöcke mit Feuerschein auf den Ecken der Rücksprünge; die Stufen darüber werden angestrahlt
   Kosten: Bögen und Trommeln sind zwei Sammelnetze (zwei Zeichenaufrufe, ein kleines Programm ohne Licht), alles andere
   benutzt die vorhandenen Fassadenquader, Leuchtleisten, Dächer und Lichtpunkte.
   ===================================================================== */
export const KRONEN = { fans: [], drums: [], last: null };   // Bögen {x,y,z,ry,w,h,t}, Trommeln {x,y,z,r,h,v}
export const GOLD76 = [0.9, 0.64, 0.3];   // mattes Blattgold für Flossen (leuchtet nicht nach)
export const FORCE76 = { form: null, crown: null };   // nur fürs Labor (?lab=turm): Bauform und Krone vorgeben

// Eigener Zufall und Entscheidungen je Turm. Liefert null für alles, was kein hoher Elite-Turm ist.
export function plan76(seed, cx, cz, H, dist, worker, form) {
  if (worker || H <= 70 || form === 'twin') return null;
  const rng = mulberry32(seed * 9176 + Math.round(cx * 3 + cz * 5) + 76);
  const a = rng(), b = rng(), c = rng(), d = rng(), e = rng();
  return {
    rng, crown: d,
    lit: a < 0.8 ? 0.6 + 0.4 * b : 0,                                   // Stufen über dem Sockel angestrahlt (Fluter auf den Rücksprüngen)
    piers: form !== 'zig' && form !== 'buttress' && c < 0.72,             // Lisenen an den oberen Stufen
    band: form !== 'zig' && form !== 'rotunda' && form !== 'stream' && e < 0.4,   // Lichtband: hohe Bogenfenster in der Mitte jeder Seite
    pylons: dist < 760 && (form === 'classic' || form === 'tiara'),
  };
}
// Fensterraster des Fassaden-Shaders (wie winGrid in building-forms.js)
function grid76(L, style) {
  const cw = style < 0.5 ? 3.2 : 2.4, usable = Math.max(L - 2, 1), nc = Math.max(1, Math.floor(usable / cw + 0.002));
  return { nc, cellW: usable / nc };
}
// Lisenen: Pfeiler auf den Achsen zwischen den Fenstern, über die ganze Stufe, oben als abgetreppte Zinne über die Brüstung hinaus
export function towerPiers(P, cx, cz, sw, sd, y0, y1, style, tint, seed, corner, c, flood, skip = 0) {
  if (corner === 'round' || y1 - y0 < 10) return;
  const pt = tint.map(v => Math.min(1, v * 1.45)), deep = 0.42, wide = 0.78;
  for (const [ax, out] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
    const L = ax ? sd : sw, g = grid76(L, style);
    if (g.nc < 4) continue;
    const every = g.nc > 9 ? 3 : 2, k0 = Math.max(1, Math.round((g.nc % every) / 2)) || every;
    for (let k = k0; k < g.nc; k += every) {
      const u = -L / 2 + 1 + k * g.cellW;
      if (corner !== 'square' && Math.abs(u) > L / 2 - c - 0.6) continue;
      if (Math.abs(u) < skip) continue;
      const px = ax ? cx + out * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + out * (sd / 2 + deep / 2);
      addSeg({ x: px, z: pz, w: ax ? deep : wide, d: ax ? wide : deep, y0: y0 + 0.4, y1: y1 + 1.7, tint: pt, seed: seed + 3, style: 3, dens: 0, flood }, false);
      addSeg({ x: px - (ax ? out * 0.06 : 0), z: pz - (ax ? 0 : out * 0.06), w: ax ? deep - 0.12 : wide - 0.3, d: ax ? wide - 0.3 : deep - 0.12, y0: y1 + 1.7, y1: y1 + 2.7, tint: pt, seed: seed + 4, style: 3, dens: 0, flood: 0 }, false);
    }
  }
}
// Lichtband: ein flacher Vorbau in der Mitte jeder Seite mit hohen, hell erleuchteten Bogenfenstern über die ganze Stufe.
// Liefert die halbe Breite des Bands (dort stehen keine Lisenen).
export function lightBand(P, cx, cz, sw, sd, y0, y1, tint, seed, corner, c, flood) {
  if (corner === 'round' || y1 - y0 < 14) return 0;
  let half = 0;
  for (const [ax, out] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
    const L = (ax ? sd : sw) - (corner === 'square' ? 0 : 2 * c), n = L > 27 ? 2 : 1, bw = n * 5.2 + 3.2;
    if (L < bw + 5) continue;
    half = Math.max(half, bw / 2 + 0.5);
    const px = ax ? cx + out * (sw / 2 + 0.05) : cx, pz = ax ? cz : cz + out * (sd / 2 + 0.05);
    addSeg({ x: px, z: pz, w: ax ? 0.7 : bw, d: ax ? bw : 0.7, y0: y0 + 0.3, y1: y1 + 0.9, tint: tint.map(v => v * 0.8), seed: seed + 5, style: 2, dens: 0.72, flood: Math.max(flood, 0.5), fl: 2 }, false);
  }
  return half;
}
// Leuchtpylone auf den vier Ecken eines Rücksprungs (untere Stufe sw x sd, obere nw x nd)
export function setbackPylons(P, cx, cz, sw, sd, nw, nd, y, tint, seed) {
  if ((sw - nw) / 2 < 2.7 || (sd - nd) / 2 < 2.7) return;
  const pt = tint.map(v => v * 1.2);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const x = cx + sx * (sw / 2 - 1.25), z = cz + sz * (sd / 2 - 1.25);
    addSeg({ x, z, w: 1.7, d: 1.7, y0: y, y1: y + 2.5, tint: pt, seed: seed + 7, style: 3, dens: 0, flood: 0.5 }, false);
    addSeg({ x, z, w: 1.1, d: 1.1, y0: y + 2.5, y1: y + 3.5, tint: pt, seed: seed + 8, style: 3, dens: 0, flood: 0.3 }, false);
    addNeon(x, y + 3.62, z, 0.7, 0.24, 0.7, [1.3, 0.86, 0.42]);
    addGlow(x, y + 4.0, z, [1.3, 0.85, 0.45], 2.4, P.rng(), 0);
  }
}

/* ---------- Kronen ---------- */
// Sonnenkrone. top = oberste Stufe {x,z,w,d}, H = ihre Dachhöhe. Liefert die Höhe der Spitze.
export function sunCrown(top, H, tint, cTint, seed, P) {
  KRONEN.last = 'sonne';
  const s = Math.min(top.w, top.d) * 0.86, half = s / 2, hb = 4.6, hp = s * 1.2, y = H + hb, x = top.x, z = top.z;
  addSeg({ x, z, w: s, d: s, y0: H, y1: y, tint, seed: seed + 301, style: 2, dens: 0.95, flood: 0.8 }, true);
  addSeg({ x, z, w: s + 0.7, d: s + 0.7, y0: y - 0.5, y1: y + 0.25, tint: cTint, seed: seed + 302, style: 3, dens: 0, flood: 0.4 }, false);
  caps.push({ x, z, y: y + 0.2, w: s, d: s, h: hp, gold: true, v76: 2 });
  for (let k = 0; k < 4; k++) {
    const r = half * (0.97 - 0.2 * k), w = 2 * r * 0.985, h = w * (0.6 + 0.03 * k), yk = y + 0.2 + hp * (1 - r / half) - 0.25, t = 0.55;
    for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2;
      KRONEN.fans.push({ x: x + Math.sin(a) * (r + t / 2 - 0.02), y: yk, z: z + Math.cos(a) * (r + t / 2 - 0.02), ry: a, w, h, t });
    }
    addGlow(x, yk + h * 0.55, z, [1.3, 0.92, 0.5], s * (0.5 - 0.08 * k), P.rng(), 0);
  }
  const sy = y + hp * 0.84, sh = s * 1.15;
  spires.push({ x, z, y0: sy, h: sh, b: s * 0.13 });
  addCollider(x - half * 0.5, y, z - half * 0.5, x + half * 0.5, y + hp * 0.5, z + half * 0.5);
  return sy + sh;
}
// Trommel-Stapel für Leuchtlaterne und Ankermast: Liste von [Radius, Höhe, Bildzeile], dazu Strebeflossen an der untersten Trommel
function drumStack(x, y, z, list, col, fins, P) {
  list.forEach(([r, h, v], i) => {
    KRONEN.drums.push({ x, y, z, r, h, v });
    if (i === 0 && fins) for (let q = 0; q < fins; q++) {
      const a = (q + 0.5) * Math.PI * 2 / fins, fr = r * 1.06 + 0.35;
      addNeon(x + Math.sin(a) * fr, y + h * 0.56, z + Math.cos(a) * fr, 0.34, h * 1.12, 1.1, col, a);
      addNeon(x + Math.sin(a) * (fr + 0.5), y + h * 0.3, z + Math.cos(a) * (fr + 0.5), 0.3, h * 0.6, 0.9, col.map(c => c * 0.8), a);
    }
    addGlow(x, y + h * 0.5, z, [1.3, 0.95, 0.55], r * 2.6, P.rng(), 0);
    y += h;
  });
  return y;
}
export function lanternCrown(top, H, tint, cTint, seed, P) {
  KRONEN.last = 'laterne';
  const col = GOLD76;
  const m = Math.min(top.w, top.d), x = top.x, z = top.z, r = m * 0.34, h = Math.max(7, m * 0.5);
  addSeg({ x, z, w: m * 0.86, d: m * 0.86, y0: H, y1: H + 2.2, tint: cTint, seed: seed + 311, style: 3, dens: 0, flood: 0.7 }, true);
  const y = drumStack(x, H + 2.2, z, [[r, h, 0], [r * 0.68, h * 0.8, 0], [r * 0.42, h * 0.62, 0]], col, 8, P);
  caps.push({ x, z, y, w: r * 0.9, d: r * 0.9, h: r * 1.5, gold: true, v76: 1 });
  addCollider(x - r * 0.7, H, z - r * 0.7, x + r * 0.7, H + 2.2 + h, z + r * 0.7);
  return y + r * 1.5;
}
export function mastCrown(top, H, tint, cTint, seed, P) {
  KRONEN.last = 'mast';
  const col = GOLD76;
  const m = Math.min(top.w, top.d), x = top.x, z = top.z, r = Math.max(1.6, m * 0.15), h = Math.max(8, m * 0.55);
  addSeg({ x, z, w: m * 0.5, d: m * 0.5, y0: H, y1: H + 3.2, tint: cTint, seed: seed + 321, style: 3, dens: 0, flood: 0.7 }, true);
  addSeg({ x, z, w: m * 0.34, d: m * 0.34, y0: H + 3.2, y1: H + 5.2, tint, seed: seed + 322, style: 3, dens: 0, flood: 0.5 }, true);
  const y = drumStack(x, H + 5.2, z, [[r, h, 1], [r * 0.74, h * 0.7, 1], [r * 0.5, h * 0.5, 1]], col, 4, P);
  const sh = m * 0.9;
  spires.push({ x, z, y0: y, h: sh, b: r * 0.6 });
  addCollider(x - r, H, z - r, x + r, y, z + r);
  return y + sh;
}
// Stufenkrone: Kreuz aus zwei niedrigen Riegeln, darauf ein Mittelblock mit hohen Bogenfenstern, Goldflossen und Nadel
export function stepCrown(top, H, tint, cTint, seed, P) {
  KRONEN.last = 'stufen';
  const col = GOLD76;
  const x = top.x, z = top.z, w = top.w, d = top.d, hc = 10 + H * 0.04;
  addSeg({ x, z, w: w * 0.82, d: d * 0.34, y0: H, y1: H + hc * 0.5, tint, seed: seed + 331, style: 2, dens: 0.95, flood: 0.8 }, true);
  addSeg({ x, z, w: w * 0.34, d: d * 0.82, y0: H, y1: H + hc * 0.5 - 0.14, tint, seed: seed + 332, style: 2, dens: 0.95, flood: 0.8 }, true);
  addSeg({ x, z, w: w * 0.46, d: d * 0.46, y0: H + 0.1, y1: H + hc, tint: cTint, seed: seed + 333, style: 2, dens: 0.95, flood: 0.9 }, true);
  for (const [sx, sz, ww, dd] of [[1, 0, 0.36, d * 0.34 * 0.45], [-1, 0, 0.36, d * 0.34 * 0.45], [0, 1, w * 0.34 * 0.45, 0.36], [0, -1, w * 0.34 * 0.45, 0.36]])
    for (let k = 0; k < 3; k++) addNeon(x + sx * (w * 0.41 - 0.8 - k * 1.5), H + hc * 0.5 + (1.2 + k * 1.1) / 2, z + sz * (d * 0.41 - 0.8 - k * 1.5), ww, 1.2 + k * 1.1, dd, col);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) addNeon(x + sx * (w * 0.23 - 0.3), H + hc + 1.3, z + sz * (d * 0.23 - 0.3), 0.45, 2.6, 0.45, col);
  const b = Math.min(w, d) * 0.12, sh = 9 + H * 0.07;
  spires.push({ x, z, y0: H + hc, h: sh, b });
  return H + hc + sh;
}

/* ---------- Sammelnetze für Bögen und Trommeln ---------- */
// Bogenbild: Strahlenkranz aus Gold, dazwischen die leuchtenden Dreiecksfenster in zwei Ringen
function fanTex() {
  const t = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#3a2810'; g.fillRect(0, 0, W, H);
    g.translate(W / 2, H); g.scale(W / 2, -H);
    const gr = g.createRadialGradient(0, 0, 0.05, 0, 0, 1); gr.addColorStop(0, '#9a7030'); gr.addColorStop(0.6, '#684a1e'); gr.addColorStop(1, '#4a3414');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1.05, 0, Math.PI); g.fill();
    const N = 9;
    for (let i = 0; i < N; i++) {
      const a0 = Math.PI * i / N, a1 = Math.PI * (i + 1) / N, am = (a0 + a1) / 2, da = (a1 - a0) * 0.3;
      for (const [r0, r1, lit] of [[0.36, 0.56, (i * 7 + 3) % 5 !== 0], [0.68, 0.9, (i * 5 + 1) % 7 !== 0]]) {
        g.fillStyle = lit ? ((i + (r0 > 0.5 ? 1 : 0)) % 3 ? '#ffdc9a' : '#fff0c8') : '#221a12';
        g.beginPath(); g.moveTo(Math.cos(am - da) * r0, Math.sin(am - da) * r0); g.lineTo(Math.cos(am + da) * r0, Math.sin(am + da) * r0); g.lineTo(Math.cos(am) * r1, Math.sin(am) * r1); g.closePath(); g.fill();
      }
    }
    g.strokeStyle = '#c89a4a'; g.lineWidth = 0.035;
    for (let i = 0; i <= N; i++) { const a = Math.PI * i / N; g.beginPath(); g.moveTo(Math.cos(a) * 0.2, Math.sin(a) * 0.2); g.lineTo(Math.cos(a) * 1.02, Math.sin(a) * 1.02); g.stroke(); }
    for (const [r, lw, c] of [[0.3, 0.03, '#c89a4a'], [0.62, 0.035, '#c89a4a'], [0.965, 0.07, '#e0b260']]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.stroke(); }
    g.fillStyle = '#d8a850'; g.beginPath(); g.arc(0, 0, 0.2, 0, Math.PI); g.fill();
  });
  return t;
}
// Trommelbild: zwei Zeilen (oben Laterne mit hohem Glas, unten Mast mit schmalen Schlitzen), je ein Feld, das achtmal umläuft
function drumTex() {
  const t = canvasTex(64, 256, (g, W, H) => {
    for (let row = 0; row < 2; row++) {
      const y0 = row * H / 2, h = H / 2;
      g.fillStyle = '#6e5022'; g.fillRect(0, y0, W, h);
      const gx = row ? 22 : 9, gw = W - 2 * gx;
      const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, '#ffe6b0'); gr.addColorStop(0.5, '#ffd184'); gr.addColorStop(1, '#f0a85a');
      g.fillStyle = gr; g.fillRect(gx, y0 + 12, gw, h - 22);
      g.fillStyle = '#5a4018'; for (let k = 1; k < (row ? 7 : 5); k++) g.fillRect(gx, y0 + 12 + (h - 22) * k / (row ? 7 : 5) - 1, gw, 2);
      if (!row) g.fillRect(W / 2 - 1, y0 + 12, 2, h - 22);
      g.fillStyle = '#c89a4a'; g.fillRect(0, y0, W, 5); g.fillRect(0, y0 + h - 6, W, 6); g.fillRect(0, y0, 3, h); g.fillRect(W - 3, y0, 3, h);
      g.fillStyle = '#e6ba68'; g.fillRect(0, y0 + 5, W, 2);
    }
  });
  t.wrapS = T.RepeatWrapping;
  return t;
}
// Bogenplatte: Breite 1 (x), Höhe 1 (y), Dicke 1 (z, Schauseite bei +z); Halbellipse mit Vorder-, Rückseite und Rand
function fanGeo() {
  const N = 20, pos = [], uv = [], idx = [];
  const P = i => { const a = Math.PI * i / N; return [-Math.cos(a) * 0.5, Math.sin(a)]; };
  for (const zf of [0.5, -0.5]) {
    const b = pos.length / 3;
    pos.push(0, 0, zf); uv.push(0.5, 0.0);
    for (let i = 0; i <= N; i++) { const [x, y] = P(i); pos.push(x, y, zf); uv.push(x + 0.5, y); }
    for (let i = 0; i < N; i++) zf > 0 ? idx.push(b, b + 2 + i, b + 1 + i) : idx.push(b, b + 1 + i, b + 2 + i);
  }
  const rb = pos.length / 3;
  for (let i = 0; i <= N; i++) { const [x, y] = P(i); pos.push(x, y, 0.5, x, y, -0.5); uv.push(0.5, 0.955, 0.5, 0.965); }
  for (let i = 0; i < N; i++) { const a = rb + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// Achteckige Trommel: Radius 1 (über die Ecken), Höhe 1 ab y = 0, mit Golddeckel; die Bildzeile (v) kommt je Stück als Attribut
function drumGeo() {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= 8; i++) { const a = (i + 0.5) * Math.PI / 4, x = Math.sin(a), z = Math.cos(a); pos.push(x, 0, z, x, 1, z); uv.push(i, 0.012, i, 0.488); }
  for (let i = 0; i < 8; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const c = pos.length / 3; pos.push(0, 1, 0); uv.push(0.5, 0.008);
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4; pos.push(Math.sin(a), 1, Math.cos(a)); uv.push(0.5, 0.008); }
  for (let i = 0; i < 8; i++) idx.push(c, c + 1 + i, c + 1 + (i + 1) % 8);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// Nach dem Stadtbau: die gesammelten Bögen und Trommeln als zwei Sammelnetze in die Szene (flushInstances)
export function buildKronen(into = scene) {
  const m = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(), up = new T.Vector3(0, 1, 0), col = new T.Color();
  const out = [];
  if (KRONEN.fans.length) {
    const im = new T.InstancedMesh(fanGeo(), new T.MeshBasicMaterial({ map: fanTex() }), KRONEN.fans.length);
    KRONEN.fans.forEach((f, i) => {
      im.setMatrixAt(i, m.compose(p.set(f.x, f.y, f.z), q.setFromAxisAngle(up, f.ry), s.set(f.w, f.h, f.t)));
      // die Mondseite heller, die abgewandten Seiten matter: wirkt wie beleuchtetes Blattgold, ohne eigenes Licht im Programm
      const k = 0.92 + 0.5 * Math.max(0, Math.sin(f.ry) * MOON_DIR.x + Math.cos(f.ry) * MOON_DIR.z);
      im.setColorAt(i, col.setRGB(1.12 * k, 1.06 * k, 0.98 * k));
    });
    im.frustumCulled = false; into.add(im); out.push(im);
  }
  if (KRONEN.drums.length) {
    const geo = drumGeo(), voff = new Float32Array(KRONEN.drums.length);
    const mat = new T.MeshBasicMaterial({ map: drumTex(), color: new T.Color(1.15, 1.08, 0.98) });
    mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRow;').replace('#include <uv_vertex>', '#include <uv_vertex>\n  vUv.y += aRow * 0.5;'); };
    mat.customProgramCacheKey = () => 'trommel76';
    const im = new T.InstancedMesh(geo, mat, KRONEN.drums.length);
    KRONEN.drums.forEach((d, i) => { im.setMatrixAt(i, m.makeScale(d.r, d.h, d.r).setPosition(d.x, d.y, d.z)); voff[i] = d.v ? 0 : 1; });
    geo.setAttribute('aRow', new T.InstancedBufferAttribute(voff, 1));
    im.frustumCulled = false; into.add(im); out.push(im);
  }
  return out;
}
