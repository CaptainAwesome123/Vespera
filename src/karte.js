/* =====================================================================
   V62 · DIE STADTKARTE VON VESPERA (Taste Y)
   Ein Stadtplan im Stil der Zwanziger: dunkles Petrolpapier, Goldlinien, Strahlenkranz-Kompass,
   Titelkartusche. Alles aus den echten Spieldaten gezeichnet, nichts von Hand:
   - Gelände (terrainHeight) mit Schummerung und Höhenlinien, Kratersee, Kraterrand, Gletschertäler
   - Insel (COAST), Blöcke, Parks, Straßennetz (NET), Viadukt, Tunnel mit Zollhof,
     Privatstraße zur Villa (SERP), Straßenbahnlinien, Gebäude (segs, nach Höhe gestuft), Belmont, Hafen
   - Viertel (Schwerpunkte aus districtAt), Orte (Lokale, Metropol, Bank, Café), Kontor-Handelsplätze,
     Läden, Verstecke (erst wenn entdeckt), laufender Ärger, Aufgabenziele, Alexander, die Aurora Imperial
   Bedienung: Mausrad zoomt, Ziehen verschiebt, Klick setzt einen Wegpunkt (oder öffnet einen Ort),
   Rechtsklick löscht ihn, Leertaste zeigt auf Alexander, Y oder Esc schließt. Auf dem Handy: wischen,
   zwei Finger zoomen, tippen.
   Wegpunkt: goldene Raute in der Welt und auf dem Kompassring unten rechts (Umschalt+Y schaltet den Ring).
   Schnellreise: zu besuchten Orten fliegt Alexander selbst hin (steigt auf, fliegt über die Dächer, landet),
   kein Sprung. Jede Bewegungstaste bricht den Flug ab.
   Kosten: nichts beim Laden. Das Kartenbild (ein 2D-Canvas) entsteht nach dem Start in kleinen Häppchen
   (wenige Millisekunden je Bild), kein Shader, keine 3D-Teile.
   ===================================================================== */
import { T, $, MOBILE, camera } from './core.js';
import { player } from './player.js';
import { playing, paused, resume, tryLock, isTouch } from './input.js';
import { startFlight, stopFlight } from './powers.js';
import { toast, districtAt, VIEWS, boatExit, BOAT, MAP_HOOK } from './boat.js';
import { COAST, NET, OUTER, obbCorners, blocks, PLAZA, MEDIAN, CANAL, onIsland, ISL } from './island.js';
import { segs } from './facade-shader.js';
import { terrainHeight, VILLA, VIA, AP, MARINA_X, FERRY_X } from './harbour.js';
import { WATER_Y } from './dance.js';
import { SERP } from './serpentine.js';
import { BAHN } from './bahn-hook.js';   // V63: Straßenbahn- und Hochbahnlinien
import { VENUES, DINE } from './venues.js';
import { ORTE } from './orte.js';
import { SHOPS, DEPOTS } from './shops.js';
import { WORK } from './workers.js';
import { FREIGHT, TAXI_LANDING } from './wasser.js';
import { KT, POSTS, postPos, titleCase } from './kontor.js';
import { VERST } from './verstecke.js';
import { GEGNER } from './gegner.js';
import { progress } from './aufgaben.js';
import { IMP } from './imperial.js';
import { DRIVE } from './eating.js';
import { driveExit } from './driving.js';
import { inBelmont } from './belmont.js';
import { PH, inPenthouse } from './penthouse.js';
import { VR } from './villa.js';
import { UNTER } from './unter-hook.js';
import { addTasten } from './pausemenu.js';

const KA_KEY = 'vespera-karte';
export const KARTE = {
  open: false, ready: false, gen: null, base: null, E: null, view: { cx: 0, cz: -200, k: 0.3 }, el: null, st: null, lv: null,
  W: 0, H: 0, dpr: 1, dirty: true, liveT: 0, hudT: 0, places: [], placeT: 0, card: null, hover: null, travel: null,
  districts: [], waterLabels: [], s: { v: {}, wp: null, ring: true, lay: { orte: true, handel: true, gegner: true, aufgaben: true, figuren: true, laeden: false, bezirke: true, bahn: true } },
  placeHooks: [],  // V78: weitere feste Orte mit Schnellreise: f(add)
  liveHooks: [],   // V63: weitere lebende Punkte (Nebenfiguren): f(liste, ebenen)
  mk: null, visitT: 0, fromPause: false, stats: {},
};
const KA_GOLD = '#d9b26a', KA_GOLD_HI = '#f6dc9a', KA_TEAL = '#6fd6cf', KA_RED = '#e0694f', KA_INK = '#f3e6c8';
const KA_DISPLAY = '"Limelight", "Didot", Georgia, serif', KA_BODY = '"Josefin Sans", "Futura", "Century Gothic", sans-serif';
const kaClamp = (v, a, b) => v < a ? a : v > b ? b : v;
const kaSS = (a, b, v) => { const t = kaClamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const kaFmtD = d => d < 1000 ? Math.round(d / 5) * 5 + ' m' : (d / 1000).toFixed(1).replace('.', ',') + ' km';

/* ---------- Speichern ---------- */
function kaLoad() {
  try { const S = JSON.parse(localStorage.getItem(KA_KEY) || 'null'); if (S) { Object.assign(KARTE.s.v, S.v || {}); KARTE.s.wp = S.wp || null; if (S.ring === false) KARTE.s.ring = false; Object.assign(KARTE.s.lay, S.lay || {}); } } catch (e) { /* ohne Speicher */ }
}
function kaSave() { try { localStorage.setItem(KA_KEY, JSON.stringify(KARTE.s)); } catch (e) { /* ohne Speicher */ } }

/* =====================================================================
   1) KARTENBILD (einmal, in Häppchen)
   ===================================================================== */
function kaExtent() {
  let x0 = -1500, x1 = 1500, z0 = -1700, z1 = 1150;
  const P = [[VILLA.x, VILLA.z], [0, VIA.end || -1500], [AP.x, AP.z + 120]];
  for (const [x, z] of P) if (Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < 5000 && Math.abs(z) < 5000) { x0 = Math.min(x0, x - 260); x1 = Math.max(x1, x + 260); z0 = Math.min(z0, z - 260); z1 = Math.max(z1, z + 260); }
  const L = Math.max(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const BW = MOBILE ? 1536 : 2560;
  return { x0: cx - L / 2, z0: cz - L / 2, L, BW, s: BW / L };
}
// Gelände: Höhen auf grobem Raster, dann feines Bild mit Schummerung, Höhenlinien und Wasserschraffur
function* kaGenTerrain(E, g) {
  const N = MOBILE ? 140 : 200, Hh = new Float32Array(N * N), Is = new Float32Array(N * N), d = E.L / N;
  let t0 = performance.now();
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = E.x0 + (i + 0.5) * d, z = E.z0 + (j + 0.5) * d, k = j * N + i;
      if (onIsland(x, z, 0)) { Is[k] = 1; Hh[k] = 0; } else Hh[k] = terrainHeight(x, z);
    }
    if (performance.now() - t0 > 6) { yield; t0 = performance.now(); }
  }
  const R = MOBILE ? 640 : 1024, img = g.createImageData(R, R), D = img.data, f = N / R;
  const band = new Int16Array(R), bandUp = new Int16Array(R);
  const at = (A, i, j) => A[kaClamp(j, 0, N - 1) * N + kaClamp(i, 0, N - 1)];
  // Licht von Nordwest (wie der Mond), Schummerung je Rasterpunkt
  const S = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const gx = (at(Hh, i + 1, j) - at(Hh, i - 1, j)) / (2 * d), gz = (at(Hh, i, j + 1) - at(Hh, i, j - 1)) / (2 * d);
    const nx = -gx, nz = -gz, ny = 1, L = Math.hypot(nx, ny, nz);
    S[j * N + i] = (nx * -0.55 + ny * 0.62 + nz * -0.55) / L;
  }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let py = 0; py < R; py++) {
    for (let px = 0; px < R; px++) {
      const u = (px + 0.5) * f - 0.5, v = (py + 0.5) * f - 0.5, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
      const bil = A => (at(A, i, j) * (1 - a) + at(A, i + 1, j) * a) * (1 - b) + (at(A, i, j + 1) * (1 - a) + at(A, i + 1, j + 1) * a) * b;
      const h = bil(Hh), isl = bil(Is), sh = bil(S);
      let r, gg, bb;
      const water = isl < 0.5 && h < WATER_Y + 0.4;
      if (isl >= 0.5) { r = 15; gg = 43; bb = 49; band[px] = -99; }
      else if (water) {
        const dep = kaClamp((WATER_Y - h) / 18, 0, 1);
        r = 11 - 6 * dep; gg = 50 - 22 * dep; bb = 58 - 22 * dep;
        if (py % 6 === 0) { r += 3; gg += 6; bb += 7; }   // feine Wasserschraffur wie auf alten Stadtplänen
        band[px] = -98;
      } else {
        const t = kaClamp(h / 1900, 0, 1), snow = kaSS(1100, 2100, h);
        r = 26 + 60 * t; gg = 52 + 56 * t; bb = 58 + 56 * t;
        r += (190 - r) * snow; gg += (202 - gg) * snow; bb += (204 - bb) * snow;
        const m = 0.45 + 0.95 * kaClamp(sh, 0, 1); r *= m; gg *= m; bb *= m;
        band[px] = Math.floor(h / 100);
      }
      // Höhenlinien: 100 m fein, 500 m kräftiger (Gold)
      const bl = px ? band[px - 1] : band[px], bu = py ? bandUp[px] : band[px], c = band[px];
      if (c >= 0 && ((bl !== c && bl >= -1) || (bu !== c && bu >= -1))) {
        const k = (c % 5 === 0 || bl % 5 === 0 && bl !== c || bu % 5 === 0 && bu !== c) ? 0.5 : 0.24;
        r += (217 - r) * k; gg += (178 - gg) * k; bb += (106 - bb) * k;
      }
      const n = (rnd() - 0.5) * 7;   // Papierkorn
      const o = (py * R + px) * 4; D[o] = r + n; D[o + 1] = gg + n; D[o + 2] = bb + n; D[o + 3] = 255;
    }
    bandUp.set(band);
    if (performance.now() - t0 > 6) { yield; t0 = performance.now(); }
  }
  const c = document.createElement('canvas'); c.width = c.height = R;
  c.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, E.BW, E.BW);
  KARTE.terrainH = { Hh, N, d };
}
const kaPoly = (g, P, close = true) => { g.beginPath(); P.forEach(([x, z], k) => k ? g.lineTo(x, z) : g.moveTo(x, z)); if (close) g.closePath(); };
// Stadt in Weltkoordinaten (g ist schon so verschoben, dass 1 Einheit = 1 m); px = Meter je Bildpunkt; R = Sichtrechteck oder null
function kaDrawCity(g, px, R, step) {
  const vis = (x0, z0, x1, z1) => !R || (x1 > R.x0 && x0 < R.x1 && z1 > R.z0 && z0 < R.z1);
  if (!step || step === 1) {
    // Insel und Kaimauer (doppelte Goldlinie)
    g.fillStyle = '#0f2b31'; kaPoly(g, COAST); g.fill();
    g.strokeStyle = KA_GOLD; g.lineWidth = 2.6 * px; g.stroke();
    g.strokeStyle = 'rgba(217,178,106,0.35)'; g.lineWidth = 1 * px; g.save(); g.clip(); g.lineWidth = 7 * px; g.strokeStyle = 'rgba(217,178,106,0.12)'; kaPoly(g, COAST); g.stroke(); g.restore();
    // Blöcke und Parks
    for (const b of blocks) {
      if (!vis(b.x0, b.z0, b.x1, b.z1)) continue;
      g.fillStyle = b.park ? '#123a31' : '#163c43'; g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
      if (b.park) { g.fillStyle = 'rgba(111,214,207,0.16)'; for (let x = b.x0 + 6; x < b.x1 - 3; x += 9) for (let z = b.z0 + 6 + ((x / 9) % 2) * 4; z < b.z1 - 3; z += 9) { g.beginPath(); g.arc(x, z, 1.6, 0, 6.283); g.fill(); } }
    }
    g.fillStyle = '#263e3b'; g.fillRect(PLAZA.x0, PLAZA.z0, PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0);
    g.fillStyle = '#123a31'; g.fillRect(MEDIAN.x0, MEDIAN.z0, MEDIAN.x1 - MEDIAN.x0, MEDIAN.z1 - MEDIAN.z0);
    g.fillStyle = '#1a3d43'; for (const h of OUTER.plots) { const C = obbCorners(h); if (R && !vis(C[0][0] - 40, C[0][1] - 40, C[0][0] + 40, C[0][1] + 40)) continue; kaPoly(g, C); g.fill(); }
    g.strokeStyle = '#3c5650'; g.lineWidth = 2; for (const P of OUTER.paths) { kaPoly(g, P, false); g.stroke(); }
    if (CANAL.on) { g.fillStyle = 'rgba(160,205,212,0.55)'; g.fillRect(CANAL.x - CANAL.hw, CANAL.zA, CANAL.hw * 2, CANAL.zB - CANAL.zA); }
  }
  if (!step || step === 2) {
    // Straßen: erst die Bodenstraßen, dann das Viadukt in Gold darüber
    g.lineCap = 'round'; g.lineJoin = 'round';
    const edges = NET.edges.filter(e => e.pts && e.pts.length > 1);
    const lifted = e => e.kind === 'via';
    for (const e of edges) { if (lifted(e)) continue; g.strokeStyle = '#2b5b62'; g.lineWidth = e.w + (e.kind === 'ring' ? 9 : 0.6); kaPoly(g, e.pts, false); g.stroke(); }
    for (const e of edges) { if (lifted(e)) continue; if (e.w < 20 && e.kind !== 'ring') continue; g.strokeStyle = 'rgba(217,178,106,0.28)'; g.lineWidth = 1 * px; kaPoly(g, e.pts, false); g.stroke(); }
    // Privatstraße zur Villa (Serpentine)
    for (const Rd of SERP.roads) {
      const P = Rd.p.map(q => [q.x, q.z]); if (Rd.closed) P.push(P[0]);
      g.strokeStyle = '#0b2228'; g.lineWidth = SERP.HW * 2 + 3 * px; kaPoly(g, P, false); g.stroke();
      g.strokeStyle = '#b9a98a'; g.lineWidth = SERP.HW * 2; kaPoly(g, P, false); g.stroke();
    }
    // Tunnel: gestrichelt bis zum Zollhof
    if (VIA.portalZ && VIA.end) {
      g.setLineDash([9 * px, 6 * px]); g.strokeStyle = KA_GOLD; g.lineWidth = 2.2 * px;
      g.beginPath(); g.moveTo(-5, VIA.portalZ); g.lineTo(-5, VIA.end); g.moveTo(5, VIA.portalZ); g.lineTo(5, VIA.end); g.stroke();
      if (VIA.cav) { g.beginPath(); g.arc(0, VIA.cav, VIA.R, 0, 6.283); g.stroke(); }
      g.setLineDash([]);
    }
    for (const e of edges) {
      if (!lifted(e)) continue;
      g.strokeStyle = '#0a1d22'; g.lineWidth = e.w + 5 * px; kaPoly(g, e.pts, false); g.stroke();
      g.strokeStyle = KA_GOLD; g.lineWidth = e.w + 1.5 * px; kaPoly(g, e.pts, false); g.stroke();
      g.strokeStyle = '#1d4349'; g.lineWidth = Math.max(1 * px, e.w - 2.4 * px); kaPoly(g, e.pts, false); g.stroke();
      g.setLineDash([5 * px, 5 * px]); g.strokeStyle = 'rgba(246,220,154,0.7)'; g.lineWidth = 0.9 * px; kaPoly(g, e.pts, false); g.stroke(); g.setLineDash([]);
    }
    // Viaduktpfeiler: kurze Querstriche
    for (const e of edges) {
      if (e.kind !== 'via') continue;
      g.strokeStyle = KA_GOLD; g.lineWidth = 1.2 * px;
      for (let k = 1; k < e.pts.length; k++) {
        const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / (L || 1), nz = (bx - ax) / (L || 1);
        for (let s = 0; s < L; s += 40) { const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, w = e.w / 2 + 4 * px; g.beginPath(); g.moveTo(x - nx * w, z - nz * w); g.lineTo(x + nx * w, z + nz * w); g.stroke(); }
      }
    }
    // V63: Straßenbahn (gestrichelt in Linienfarbe) und Hochbahn (doppelte Linie mit Pfeilerstrichen)
    for (const L of BAHN.lines) {
      const P = L.cen.P;
      if (L.kind === 'hoch') { g.strokeStyle = 'rgba(3,12,16,0.9)'; g.lineWidth = 4.2 * px; kaPoly(g, P, true); g.stroke(); g.strokeStyle = L.col; g.lineWidth = 2.4 * px; kaPoly(g, P, true); g.stroke(); g.strokeStyle = 'rgba(3,12,16,0.9)'; g.lineWidth = 0.8 * px; kaPoly(g, P, true); g.stroke(); }
      else { g.setLineDash([6 * px, 4 * px]); g.strokeStyle = L.col; g.lineWidth = 1.8 * px; kaPoly(g, P, true); g.stroke(); g.setLineDash([]); }
    }
  }
  if (!step || step === 3) {
    // Gebäude: nach Höhe sortiert, höhere Stufen heller (die Rücksprünge der Türme werden sichtbar)
    const S = KARTE.segSorted || (KARTE.segSorted = segs.filter(s => s.w > 0.5 && s.d > 0.5).sort((a, b) => a.y1 - b.y1));
    for (const s of S) {
      const x0 = s.x - s.w / 2, z0 = s.z - s.d / 2;
      if (!vis(x0, z0, x0 + s.w, z0 + s.d)) continue;
      const t = kaClamp(s.y1 / 280, 0, 1), r = 26 + 70 * t, gg = 66 + 84 * t, bb = 72 + 70 * t;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`; g.fillRect(x0, z0, s.w, s.d);
      if (s.y1 > 110) { g.strokeStyle = `rgba(217,178,106,${(0.35 + 0.5 * kaSS(110, 300, s.y1)).toFixed(2)})`; g.lineWidth = 0.9 * px; g.strokeRect(x0, z0, s.w, s.d); }
    }
  }
  if (!step || step === 4) {
    // The Belmont: gestufter Goldturm mit Strahlenkranz
    const st = [[48, '#3a3220'], [36, '#6a5530'], [27, '#9a7a40'], [19, '#c9a35c'], [11, '#e8c987'], [5, '#f6dc9a']];
    for (const [h, c] of st) { g.fillStyle = c; g.fillRect(-h, -h, 2 * h, 2 * h); }
    g.strokeStyle = 'rgba(246,220,154,0.55)'; g.lineWidth = 1 * px;
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * 52, Math.sin(a) * 52); g.lineTo(Math.cos(a) * (i % 2 ? 62 : 74), Math.sin(a) * (i % 2 ? 62 : 74)); g.stroke(); }
    // Hafen: Stege, Mole, Luftschiffhafen
    g.fillStyle = '#5b5646';
    for (const x of MARINA_X) g.fillRect(x - 1.6, 535, 3.2, 70);
    if (FERRY_X) g.fillRect(FERRY_X - 2.2, 535, 4.4, 46);
    if (FREIGHT) g.fillRect(FREIGHT.x - FREIGHT.w / 2, 535, FREIGHT.w, FREIGHT.z1 - 535);
    if (TAXI_LANDING) g.fillRect(TAXI_LANDING.x - TAXI_LANDING.w / 2, 535, TAXI_LANDING.w, 22);
    if (AP) {
      g.fillStyle = '#1f3d40'; g.strokeStyle = KA_GOLD; g.lineWidth = 1.6 * px;
      g.fillRect(AP.x - 70, 535, 14, AP.z - 535);   // Damm zur Plattform
      g.beginPath(); g.arc(AP.x, AP.z, 46, 0, 6.283); g.fill(); g.stroke();
      g.beginPath(); g.arc(AP.x, AP.z, 30, 0, 6.283); g.stroke();
    }
    // Bergvilla: Grundriss quer zur Blickrichtung auf die Stadt
    if (VILLA.y) {
      const ux = VILLA.ux || 0, uz = VILLA.uz || 1, vx = -uz, vz = ux;
      const R4 = (a, b, c, d) => [[VILLA.x + ux * a + vx * c, VILLA.z + uz * a + vz * c], [VILLA.x + ux * a + vx * d, VILLA.z + uz * a + vz * d], [VILLA.x + ux * b + vx * d, VILLA.z + uz * b + vz * d], [VILLA.x + ux * b + vx * c, VILLA.z + uz * b + vz * c]];
      g.fillStyle = 'rgba(30,60,62,0.9)'; kaPoly(g, R4(-30, 150, -70, 70)); g.fill();
      g.strokeStyle = 'rgba(217,178,106,0.5)'; g.lineWidth = 1 * px;
      for (const [a, b] of [[30, 52], [52, 72], [72, 90]]) { kaPoly(g, R4(a, b, -46, 46)); g.stroke(); }
      g.fillStyle = '#c9a35c'; kaPoly(g, R4(-22, 26, -55, 55)); g.fill();
      g.fillStyle = '#f6dc9a'; kaPoly(g, R4(-12, 16, -18, 18)); g.fill();
      g.fillStyle = '#5fb6b0'; kaPoly(g, R4(32, 46, -12, 12)); g.fill();   // Pool
    }
  }
}
function* kaGenBase() {
  const E = KARTE.E = kaExtent(), t0 = performance.now();
  const c = document.createElement('canvas'); c.width = c.height = E.BW;
  const g = c.getContext('2d');
  g.fillStyle = '#07171c'; g.fillRect(0, 0, E.BW, E.BW);
  yield* kaGenTerrain(E, g);
  const px = 1 / E.s;
  for (let step = 1; step <= 4; step++) {
    g.save(); g.setTransform(E.s, 0, 0, E.s, -E.x0 * E.s, -E.z0 * E.s);
    kaDrawCity(g, px, null, step);
    g.restore();
    yield;
  }
  kaDistricts(); yield;
  kaWaterLabels();
  KARTE.base = c; KARTE.ready = true; KARTE.dirty = true;
  KARTE.stats.build = Math.round(performance.now() - t0);
}
function kaPump(ms) {
  if (KARTE.ready || !KARTE.gen) return;
  const t = performance.now();
  try { while (performance.now() - t < ms) { if (KARTE.gen.next().done) { KARTE.gen = null; break; } } } catch (e) { console.warn('Karte:', e); KARTE.gen = null; }
}
function kaEnsure() { if (!KARTE.ready && !KARTE.gen) KARTE.gen = kaGenBase(); }

/* ---------- Viertel und Gewässer aus den Spieldaten ---------- */
const KA_SKIP = /^(The Belmont|Der große Ballsaal|Penthouse|Dachterrasse|Turm des|Bergvilla|Der Tunnel|Der große Viadukt|Die Berge|Hafenpromenade)/;
function kaDistricts() {
  const acc = new Map();
  for (let x = -1100; x <= 1100; x += 30) for (let z = -1100; z <= 560; z += 30) {
    if (!onIsland(x, z, 4)) continue;
    const n = districtAt(x, z, 0.3)[0]; if (KA_SKIP.test(n)) continue;
    const a = acc.get(n) || { n, x: 0, z: 0, c: 0 }; a.x += x; a.z += z; a.c++; acc.set(n, a);
  }
  KARTE.districts = [...acc.values()].filter(a => a.c >= 6).map(a => ({ n: a.n, x: a.x / a.c, z: a.z / a.c, c: a.c }));
  // Belmont-Platz und Promenade sind klein: Schrift direkt am Ort
  for (const D of KARTE.districts) if (D.n === 'Belmont-Platz') { D.x = 0; D.z = 100; }
}
function kaIsWater(x, z) { return !onIsland(x, z, 0) && terrainHeight(x, z) < WATER_Y + 0.4; }
function kaWaterLabels() {
  const L = [], cx = ISL.cx, cz = ISL.cz;
  for (const [ang, n] of [[Math.PI, 'Das Abendmeer'], [-Math.PI / 2, 'Kratersee'], [Math.PI / 2, 'Kratersee'], [Math.PI * 0.78, 'Kratersee']]) {
    const dx = Math.sin(ang), dz = -Math.cos(ang); let r1 = 0, r2 = 0;
    for (let r = 500; r < 2400; r += 12) { const w = kaIsWater(cx + dx * r, cz + dz * r); if (w && !r1) r1 = r; if (!w && r1) { r2 = r; break; } }
    if (r1 && r2 && r2 - r1 > 30) L.push({ n, x: cx + dx * (r1 + r2) / 2, z: cz + dz * (r1 + r2) / 2, rot: Math.abs(dx) > 0.9 ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2) : 0 });
  }
  // Kraterrand: im Norden, wo das Gelände über 260 m steigt
  for (const ang of [0, -0.6, 0.6]) {
    const dx = Math.sin(ang), dz = -Math.cos(ang);
    for (let r = 900; r < 2600; r += 20) { const x = cx + dx * r, z = cz + dz * r; if (!onIsland(x, z, 0) && terrainHeight(x, z) > 260) { L.push({ n: 'Der Kraterrand', x: x + dx * 120, z: z + dz * 120, rot: ang, rim: true }); break; } }
  }
  KARTE.waterLabels = L;
}

/* =====================================================================
   2) ORTE AUF DER KARTE
   ===================================================================== */
const KA_V_KIND = { bar: ['Bar', 'B'], pub: ['Kneipe', 'K'], restaurant: ['Restaurant', 'R'], cafe: ['Café', 'C'], theater: ['Varieté', 'V'] };
// nächster Straßenpunkt (Landeplatz für die Schnellreise in der Stadt)
function kaStreetNear(x, z) {
  let best = null, bd = 1e18;
  for (const e of NET.edges) {
    if (!e.pts || e.kind === 'via') continue;
    for (let k = 1; k < e.pts.length; k++) {
      const [ax, az] = e.pts[k - 1], [bx, bz] = e.pts[k], vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
      const t = kaClamp(((x - ax) * vx + (z - az) * vz) / L2, 0, 1), qx = ax + vx * t, qz = az + vz * t, d = (qx - x) ** 2 + (qz - z) ** 2;
      if (d < bd) { bd = d; best = [qx, qz]; }
    }
  }
  return best && bd < 160 * 160 ? { x: best[0], y: 0.3, z: best[1] } : { x, y: 0.3, z };
}
function kaPlaces() {
  const P = [];
  const add = o => { if (Number.isFinite(o.x) && Number.isFinite(o.z)) P.push(o); return o; };
  add({ id: 'belmont', cat: 'orte', icon: 'belmont', n: 'The Belmont', sub: 'Ihr Grand Hotel · Lobby, Ballsaal, Penthouse-Suite mit dem Kristall', x: 0, z: 0, prio: 10, big: true,
    ziele: [{ t: 'Vor das Portal', a: { x: 0, y: 0.3, z: 66 } }, { t: 'Auf die Penthouse-Terrasse', a: { x: 0, y: PH.F1 + 0.5, z: 30, via: { x: 0, y: PH.F1 + 7, z: 92 } } }] });
  if (VILLA.y) { const V = VIEWS.Digit5; add({ id: 'villa', cat: 'orte', icon: 'villa', n: 'Die Bergvilla', sub: 'Ihr Zuhause hoch über Vespera · Randolf und das Personal', x: VILLA.x, z: VILLA.z, prio: 9, big: true,
    ziele: [{ t: 'Auf die Terrasse', a: { x: V.p[0], y: V.p[1] + 0.4, z: V.p[2], via: { x: V.p[0] + VILLA.ux * 70, y: V.p[1] + 30, z: V.p[2] + VILLA.uz * 70 } } }] }); }
  add({ id: 'platz', cat: 'orte', icon: 'ort', n: 'Belmont-Platz', sub: 'Springbrunnen, Taxis, Portiers', x: 0, z: 118, prio: 4, ziele: [{ t: 'Hinfliegen', a: { x: 0, y: 0.3, z: 120 } }] });
  add({ id: 'hafen', cat: 'orte', icon: 'anker', n: 'Hafenpromenade', sub: 'Jachthafen, Fähre, Wassertaxis', x: 60, z: 522, prio: 6, ziele: [{ t: 'Hinfliegen', a: { x: 60, y: 0.3, z: 520 } }] });
  if (AP) add({ id: 'luftschiffhafen', cat: 'orte', icon: 'luftschiff', n: 'Luftschiffhafen', sub: 'Plattform im Abendmeer · Rundflüge, Fracht aus Paris und New York', x: AP.x, z: AP.z, prio: 7, ziele: [{ t: 'Hinfliegen', a: { x: 552, y: 0.3, z: 647.5 } }] });
  if (FREIGHT) add({ id: 'gueterkai', cat: 'orte', icon: 'anker', n: 'Güterkai', sub: 'Mole mit Kran und Hafenamt', x: FREIGHT.x, z: 590, prio: 3 });
  if (VIA.portalZ) add({ id: 'tunnel', cat: 'orte', icon: 'tunnel', n: 'Tunnelportal', sub: 'Die einzige Straße nach Vespera · dahinter der Zollhof', x: 0, z: VIA.portalZ, prio: 6,
    ziele: [{ t: 'Hinfliegen', a: { x: -4, y: (VIEWS.Digit6.p[1] || 30) + 0.4, z: VIA.portalZ + 14, via: { x: -4, y: (VIEWS.Digit6.p[1] || 30) + 40, z: VIA.portalZ + 110 } } }] });
  add({ id: 'viadukt', cat: 'orte', icon: 'ort', n: 'Der große Viadukt', sub: 'Über den Kratersee zum Berg', x: 0, z: ((VIA.portalZ || -1500) + -985) / 2, prio: 5, ziele: [{ t: 'Hinfliegen', a: { x: 0, y: 30, z: ((VIA.portalZ || -1500) + -985) / 2, deck: true } }] });
  const seen = new Set();
  for (const V of VENUES) {
    if (!V.name || seen.has(V.name)) continue; seen.add(V.name);
    const K = KA_V_KIND[V.pub ? 'pub' : V.kind] || ['Lokal', 'L'], brass = /BRASS/.test(V.name);
    add({ id: 'v:' + V.name, cat: 'orte', icon: 'lokal', ch: K[1], n: titleCase(V.name), sub: brass ? 'Die Arbeiterkneipe am Kneipenplatz · Klavier, Theke, Bier' : K[0], x: V.x, z: V.z, prio: brass ? 7 : 5, ziele: [{ t: 'Hinfliegen', a: null }] });
  }
  const Bk = ORTE.bank; if (Bk && Bk.x0 != null) add({ id: 'bank', cat: 'orte', icon: 'bank', n: 'Vespera-Bank', sub: 'Schalterhalle, Tresor, Direktor Varga · Börse im Kontorbuch (I)', x: (Bk.x0 + Bk.x1) / 2, z: (Bk.z0 + Bk.z1) / 2, prio: 6, ziele: [{ t: 'Hinfliegen', a: null }] });
  if (WORK.square) { const S = WORK.square; add({ id: 'kneipenplatz', cat: 'orte', icon: 'ort', n: 'Kneipenplatz', sub: 'Herz des Arbeiterviertels · Feuertonnen, Werkstätten', x: (S.X + S.X1) / 2, z: (S.Z + S.Z1) / 2 + 22, prio: 4, ziele: [{ t: 'Hinfliegen', a: null }] }); }
  for (const D of DEPOTS) add({ id: 'depot:' + D.name, cat: 'orte', icon: 'fabrik', n: titleCase(D.name), sub: 'Fabrik im Industriegebiet', x: D.x, z: D.z + 20, prio: 2 });
  // Kontor: Handelsplätze
  if (KT.ready) for (const pid in POSTS) { const Q = postPos(pid); if (Q) add({ id: 'post:' + pid, cat: 'handel', icon: 'handel', n: POSTS[pid].n, sub: 'Handelsplatz · ' + POSTS[pid].note, x: Q.x, z: Q.z, prio: 5, ziele: [{ t: 'Hinfliegen', a: { x: Q.x, y: 0.3, z: Q.z + (pid === 'luft' ? 0 : 0) } }] }); }
  // Läden
  for (const S of SHOPS) add({ id: 'shop:' + S.name + S.x.toFixed(0), cat: 'laeden', icon: 'laden', n: titleCase(S.name), sub: 'Laden', x: S.x, z: S.z, prio: 1 });
  // V63: Haltestellen der Straßenbahn und Bahnhöfe der Hochbahn
  for (const S of BAHN.stations) { const sd = S.sides[0]; if (!sd) continue; const L = S.line, ch = L.id, nm = L.kind === 'hoch' ? 'Hochbahn' : L.name;
    add({ id: 'bahn:' + S.id, cat: 'bahn', icon: 'bahn', ch, n: S.n, sub: nm + ' · ' + L.title + (S.change.length ? ' · Umsteigen: ' + S.change.join(', ') : ''), x: S.x, z: S.z, prio: 3, bahn: S.id,
      ziele: [{ t: 'Hinfliegen', a: { x: sd.x + sd.nx * (sd.lc + 1.4), y: sd.y, z: sd.z + sd.nz * (sd.lc + 1.4) } }] }); }
  // Verstecke (erst wenn entdeckt)
  for (const H of VERST.list) if (H.ok && H.known) add({ id: 'verst:' + H.id, cat: 'gegner', icon: H.cleared ? 'versteckAus' : 'versteck', n: H.name, sub: H.cleared ? 'Ausgehoben' : (H.def && H.def.sub || 'Versteck') + ' · Eingang hier', x: H.ex, z: H.ez, prio: 8, ziele: [{ t: 'Hinfliegen', a: { x: H.ex + 4, y: 0.3, z: H.ez + 4 } }] });
  for (const f of KARTE.placeHooks) try { f(add); } catch (e) { /* Ort fehlt */ }   // V78: Orte anderer Teile (Krater)
  return P;
}
// lebende Punkte: Ärger, Aufgaben, Luftschiff
function kaLivePoints() {
  const L = [];
  const E = GEGNER.ev;
  if (E && KARTE.s.lay.gegner) { try { const w = E.where && E.where(); if (w && Number.isFinite(w[0])) L.push({ cat: 'gegner', icon: 'aerger', n: E.label || 'Ärger', sub: 'Gerade eben', x: w[0], z: w[1] }); } catch (e) { /* Ereignis endet gerade */ } }
  if (KT.ready && KT.s && KT.s.q && KARTE.s.lay.aufgaben) {
    for (const q of KT.s.q.list) {
      if (q.st !== 'aktiv') continue;
      let pr = null; try { pr = progress(q); } catch (e) { pr = null; }
      if (pr && pr.pt && Number.isFinite(pr.pt.x)) L.push({ cat: 'aufgaben', icon: 'aufgabe', n: q.title, sub: pr.txt, x: pr.pt.x, z: pr.pt.z, track: KT.s.q.track === q.id });
    }
  }
  for (const f of KARTE.liveHooks) try { f(L, KARTE.s.lay); } catch (e) { /* Punkt fehlt */ }
  return L;
}

/* =====================================================================
   3) DIE KARTE (Bildschirm)
   ===================================================================== */
function kaCss() {
  if ($('kaCss')) return;
  const s = document.createElement('style'); s.id = 'kaCss';
  s.textContent = `
#karte{position:fixed;inset:0;z-index:40;background:radial-gradient(ellipse at 50% 40%,#0b252c 0%,#061419 70%,#030c10 100%);color:${KA_INK};font-family:var(--body);user-select:none;touch-action:none}
#karte[hidden]{display:none}
#karte canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
#karte .frame{position:absolute;inset:10px;border:1px solid rgba(217,178,106,.75);outline:1px solid rgba(217,178,106,.3);outline-offset:4px;pointer-events:none}
#karte .frame i{position:absolute;width:34px;height:34px;border:2px solid ${KA_GOLD};}
#karte .frame i:nth-child(1){left:-6px;top:-6px;border-right:0;border-bottom:0}#karte .frame i:nth-child(2){right:-6px;top:-6px;border-left:0;border-bottom:0}
#karte .frame i:nth-child(3){left:-6px;bottom:-6px;border-right:0;border-top:0}#karte .frame i:nth-child(4){right:-6px;bottom:-6px;border-left:0;border-top:0}
#karte header{position:absolute;left:50%;top:18px;transform:translateX(-50%);text-align:center;padding:8px 46px 9px;background:linear-gradient(#0a2128,#071a20);border:1px solid ${KA_GOLD};outline:1px solid rgba(217,178,106,.35);outline-offset:3px;pointer-events:none;
  clip-path:polygon(18px 0,calc(100% - 18px) 0,100% 50%,calc(100% - 18px) 100%,18px 100%,0 50%)}
#karte header h2{margin:0;font:400 34px/1 ${KA_DISPLAY};letter-spacing:.34em;color:${KA_GOLD_HI};padding-left:.34em;text-shadow:0 0 18px rgba(246,220,154,.25)}
#karte header small{display:block;margin-top:5px;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:#b9a98a}
#karte aside{position:absolute;right:22px;top:22px;width:228px;max-height:calc(100% - 110px);overflow:auto;padding:12px 14px;background:rgba(5,18,24,.86);border:1px solid rgba(217,178,106,.55);font-size:13px}
#karte aside h3{margin:2px 0 8px;font:400 15px/1.1 ${KA_DISPLAY};letter-spacing:.18em;color:${KA_GOLD_HI}}
#karte aside label{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;letter-spacing:.04em}
#karte aside input{accent-color:${KA_GOLD};margin:0}
#karte aside .sym{display:flex;align-items:center;gap:8px;padding:2px 0;color:#cdbf9f;font-size:12px}
#karte aside .sym b{display:inline-block;width:26px;height:8px;flex:none}
#karte aside .ziele button{display:block;width:100%;text-align:left;background:none;border:0;border-bottom:1px solid rgba(217,178,106,.15);color:${KA_INK};font:inherit;font-size:12.5px;padding:4px 2px;cursor:pointer}
#karte aside .ziele button:hover{color:${KA_GOLD_HI}}
#karte aside .ziele button em{float:right;font-style:normal;color:${KA_TEAL};font-size:11px}
#karte footer{position:absolute;left:50%;bottom:20px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 60px)}
#karte footer{flex-wrap:nowrap}
#karte aside .hilfe{margin-top:12px;font-size:11.5px;line-height:1.55;color:#b9a98a;letter-spacing:.03em}
#karte button.ka{white-space:nowrap;background:rgba(5,18,24,.86);border:1px solid ${KA_GOLD};color:${KA_GOLD_HI};font:600 12px/1 var(--body);letter-spacing:.14em;text-transform:uppercase;padding:8px 12px;cursor:pointer}
#karte button.ka:hover{background:rgba(217,178,106,.18)}#karte button.ka[disabled]{opacity:.45;cursor:default}
#karte .card{position:absolute;text-align:left;min-width:220px;max-width:300px;padding:12px 14px 12px;background:rgba(5,18,24,.95);border:1px solid ${KA_GOLD};outline:1px solid rgba(217,178,106,.3);outline-offset:3px;font-size:13px;line-height:1.45}
#karte .card[hidden]{display:none}
#karte .card b{display:block;font:400 17px/1.15 ${KA_DISPLAY};letter-spacing:.08em;color:${KA_GOLD_HI};margin-bottom:4px}
#karte .card p{margin:0 0 8px;color:#d5c8aa}#karte .card .d{color:${KA_TEAL};font-size:12px;letter-spacing:.08em;margin-bottom:8px}
#karte .card .btns{display:flex;flex-wrap:wrap;gap:6px}
#karte .card .no{font-size:11.5px;color:#9d917a;margin-top:6px}
@media (max-width:760px){#karte aside{display:none}#karte header h2{font-size:24px}#karte header{padding:6px 30px}#karte footer{flex-wrap:wrap}#karte button.ka{padding:7px 9px;font-size:11px}}
#mapWrap.kaRing{border:0;outline:0;background:transparent;border-radius:50%}
#mapWrap.kaRing.aus{display:none}
.kaMk{position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-100%);font:600 12px/1 var(--body);letter-spacing:.1em;color:${KA_GOLD_HI};text-align:center;text-shadow:0 0 6px #000,0 0 2px #000;white-space:nowrap}
.kaMk span{display:block;margin:0 auto 4px;width:12px;height:12px;border:2px solid ${KA_GOLD_HI};transform:rotate(45deg);background:rgba(217,178,106,.4);box-shadow:0 0 10px rgba(246,220,154,.6)}
`;
  document.head.append(s);
}
function kaDom() {
  if (KARTE.el) return;
  kaCss();
  const el = KARTE.el = document.createElement('div'); el.id = 'karte'; el.hidden = true;
  el.innerHTML = `<canvas class="st"></canvas><canvas class="lv"></canvas><div class="frame"><i></i><i></i><i></i><i></i></div>
<header><h2>VESPERA</h2><small>Stadtplan · Im Krater am Pol</small></header>
<aside><h3>Auf der Karte</h3>
<label><input type="checkbox" data-lay="orte">Orte und Lokale</label>
<label><input type="checkbox" data-lay="handel">Handelsplätze (Kontor)</label>
<label><input type="checkbox" data-lay="laeden">Läden</label>
<label><input type="checkbox" data-lay="bahn">Bahn: Haltestellen und Wagen</label>
<label><input type="checkbox" data-lay="gegner">Ärger und Verstecke</label>
<label><input type="checkbox" data-lay="aufgaben">Aufgaben</label>
<label><input type="checkbox" data-lay="figuren">Bekanntschaften</label>
<label><input type="checkbox" data-lay="bezirke">Viertel</label>
<h3 style="margin-top:12px">Zeichen</h3>
<div class="sym"><b style="background:#2b5b62;height:6px"></b>Straße</div>
<div class="sym"><b style="border:2px solid ${KA_GOLD};background:#1d4349;height:7px"></b>Viadukt</div>
<div class="sym"><b style="border-top:2px dashed ${KA_GOLD};height:0"></b>Tunnel</div>
<div class="sym"><b style="border-top:2px dashed #5fe0d0;height:0"></b>Linie 1</div>
<div class="sym"><b style="border-top:2px dashed #e8b765;height:0"></b>Linie 2</div>
<div class="sym"><b style="border-top:3px double #f3e2b0;height:0"></b>Hochbahn</div>
<div class="sym"><b style="background:#b9a98a;height:4px"></b>Privatstraße zur Villa</div>
<div class="sym"><b style="background:linear-gradient(90deg,#1a4248,#60968f);height:8px"></b>Gebäude, hell = hoch</div>
<h3 style="margin-top:12px">Ziele</h3><div class="ziele"></div><div class="hilfe">Mausrad: Zoom · Ziehen: verschieben · Klick: Wegpunkt oder Ort · Rechtsklick: Wegpunkt weg · Leertaste: zu Alexander · Pfeile und +/−: schieben, zoomen · Y oder Esc: schließen</div></aside>
<div class="card" hidden></div>
<footer><button type="button" class="ka" data-act="me">Zu Alexander</button><button type="button" class="ka" data-act="wpdel">Wegpunkt löschen</button><button type="button" class="ka" data-act="ring"></button><button type="button" class="ka" data-act="close">Schließen</button></footer>`;
  document.body.append(el);
  KARTE.st = el.querySelector('canvas.st'); KARTE.lv = el.querySelector('canvas.lv'); KARTE.card = el.querySelector('.card');
  for (const i of el.querySelectorAll('aside input')) { i.checked = !!KARTE.s.lay[i.dataset.lay]; i.addEventListener('change', () => { KARTE.s.lay[i.dataset.lay] = i.checked; kaSave(); KARTE.dirty = true; kaHideCard(); }); }
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'close') kaClose();
    else if (a === 'me') kaCenterMe();
    else if (a === 'wpdel') kaSetWp(null);
    else if (a === 'ring') kaToggleRing();
    else if (a === 'goto') { const P = KARTE.places.find(q => q.id === b.dataset.id); if (P) { KARTE.view.cx = P.x; KARTE.view.cz = P.z; KARTE.view.k = Math.max(KARTE.view.k, 0.9); KARTE.dirty = true; kaShowCard(P); } }
    else if (a === 'wp') { const P = KARTE.cardP; if (P) { kaSetWp({ x: P.x, z: P.z, n: P.n }); kaHideCard(); } }
    else if (a === 'fly') { const P = KARTE.cardP; if (P) kaFlyTo(P, +b.dataset.i || 0); }
    else if (a === 'bahn') { const P = KARTE.cardP; if (P && BAHN.travelTo) { const r = BAHN.travelTo(P.bahn); if (r) toast(r); else kaClose(); } }
    e.stopPropagation();
  });
  kaInputs(el);
  kaRingLabel();
}
function kaRingLabel() { const b = KARTE.el && KARTE.el.querySelector('[data-act="ring"]'); if (b) b.textContent = 'Kompassring: ' + (KARTE.s.ring ? 'an' : 'aus'); }
function kaResize() {
  const dpr = KARTE.dpr = Math.min(2, window.devicePixelRatio || 1), W = KARTE.W = innerWidth, H = KARTE.H = innerHeight;
  for (const c of [KARTE.st, KARTE.lv]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  KARTE.dirty = true;
}
function kaFit() {
  const E = KARTE.E; if (!E) return;
  KARTE.kMin = Math.min(KARTE.W, KARTE.H) / E.L * 1.05;
  KARTE.view.k = kaClamp(KARTE.view.k, KARTE.kMin, 3.2);
}
const kaSX = x => KARTE.W / 2 + (x - KARTE.view.cx) * KARTE.view.k;
const kaSZ = z => KARTE.H / 2 + (z - KARTE.view.cz) * KARTE.view.k;
const kaWX = sx => KARTE.view.cx + (sx - KARTE.W / 2) / KARTE.view.k;
const kaWZ = sy => KARTE.view.cz + (sy - KARTE.H / 2) / KARTE.view.k;

/* ---------- Zeichnen: feste Ebene (nur wenn sich die Ansicht ändert) ---------- */
function kaDrawStatic() {
  const g = KARTE.st.getContext('2d'), { W, H, dpr, E } = KARTE, V = KARTE.view;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!KARTE.ready) {
    g.fillStyle = KA_GOLD_HI; g.font = `400 22px ${KA_DISPLAY}`; g.textAlign = 'center'; g.fillText('Die Karte wird gezeichnet …', W / 2, H / 2); return;
  }
  const sc = V.k / E.s;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * (W / 2 - (V.cx - E.x0) * V.k), dpr * (H / 2 - (V.cz - E.z0) * V.k));
  g.drawImage(KARTE.base, 0, 0);
  // nah heran: Straßen und Häuser scharf nachzeichnen (nur der sichtbare Ausschnitt)
  if (V.k > E.s * 1.25) {
    const R = { x0: kaWX(0) - 20, x1: kaWX(W) + 20, z0: kaWZ(0) - 20, z1: kaWZ(H) + 20 };
    g.setTransform(dpr * V.k, 0, 0, dpr * V.k, dpr * (W / 2 - V.cx * V.k), dpr * (H / 2 - V.cz * V.k));
    g.save(); g.beginPath(); kaPoly(g, COAST); g.clip();
    kaDrawCity(g, 1 / V.k, R, 1); kaDrawCity(g, 1 / V.k, R, 2); kaDrawCity(g, 1 / V.k, R, 3);
    g.restore();
    kaDrawCity(g, 1 / V.k, R, 4);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  kaGrid(g);
  KARTE.boxes = [];
  if (KARTE.s.lay.bezirke) kaDistrictLabels(g);
  kaWaterText(g);
  kaPlaceIcons(g);
  kaScale(g); kaRose(g, 92, H - 120, 58);
}
// Planquadrate: Buchstaben oben, Zahlen links (250 m)
function kaGrid(g) {
  const { W, H } = KARTE, Gs = 250, E = KARTE.E;
  const gx0 = Math.floor((kaWX(0) - E.x0) / Gs), gx1 = Math.ceil((kaWX(W) - E.x0) / Gs), gz0 = Math.floor((kaWZ(0) - E.z0) / Gs), gz1 = Math.ceil((kaWZ(H) - E.z0) / Gs);
  g.strokeStyle = 'rgba(217,178,106,0.09)'; g.lineWidth = 1; g.beginPath();
  for (let i = gx0; i <= gx1; i++) { const x = Math.round(kaSX(E.x0 + i * Gs)) + 0.5; g.moveTo(x, 0); g.lineTo(x, H); }
  for (let j = gz0; j <= gz1; j++) { const y = Math.round(kaSZ(E.z0 + j * Gs)) + 0.5; g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.fillStyle = 'rgba(217,178,106,0.55)'; g.font = `600 11px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = gx0; i < gx1; i++) { if (i < 0 || i >= AB.length) continue; const x = kaSX(E.x0 + (i + 0.5) * Gs); if (x > 30 && x < W - 30) g.fillText(AB[i], x, 24); }
  for (let j = gz0; j < gz1; j++) { if (j < 0) continue; const y = kaSZ(E.z0 + (j + 0.5) * Gs); if (y > 60 && y < H - 30) g.fillText(String(j + 1), 24, y); }
  g.textBaseline = 'alphabetic';
}
function kaFree(x, y, w, h) {
  for (const b of KARTE.boxes) if (x < b[0] + b[2] && x + w > b[0] && y < b[1] + b[3] && y + h > b[1]) return false;
  KARTE.boxes.push([x, y, w, h]); return true;
}
function kaSpaced(g, txt, x, y, sp) {
  // Text mit Sperrung (Canvas kann letterSpacing nicht überall)
  const w = [...txt].reduce((a, c) => a + g.measureText(c).width + sp, -sp); let cx = x - w / 2;
  const al = g.textAlign; g.textAlign = 'left';
  for (const c of txt) { g.fillText(c, cx, y); cx += g.measureText(c).width + sp; }
  g.textAlign = al; return w;
}
function kaDistrictLabels(g) {
  const k = KARTE.view.k, size = kaClamp(10 + k * 9, 11, 20), a = 0.62 * (1 - kaSS(1.4, 2.6, k));
  if (a < 0.03) return;
  g.font = `400 ${size.toFixed(0)}px ${KA_DISPLAY}`; g.fillStyle = `rgba(246,220,154,${a.toFixed(2)})`;
  g.shadowColor = 'rgba(0,0,0,0.85)'; g.shadowBlur = 4;
  for (const D of KARTE.districts) {
    const x = kaSX(D.x), y = kaSZ(D.z); if (x < -200 || x > KARTE.W + 200 || y < -50 || y > KARTE.H + 50) continue;
    const t = D.n.toUpperCase(), w = g.measureText(t).width + t.length * size * 0.28;
    if (!kaFree(x - w / 2, y - size, w, size * 1.3)) continue;
    kaSpaced(g, t, x, y, size * 0.28);
  }
  g.shadowBlur = 0;
}
function kaWaterText(g) {
  const k = KARTE.view.k;
  for (const L of KARTE.waterLabels) {
    const x = kaSX(L.x), y = kaSZ(L.z); if (x < -300 || x > KARTE.W + 300 || y < -300 || y > KARTE.H + 300) continue;
    const size = kaClamp(9 + k * 14, 11, 22);
    g.save(); g.translate(x, y); g.rotate(L.rot);
    g.font = `italic 400 ${size.toFixed(0)}px Georgia, "Didot", serif`; g.fillStyle = L.rim ? 'rgba(220,226,222,0.6)' : 'rgba(111,214,207,0.6)';
    kaSpaced(g, L.n, 0, 0, size * 0.35);
    g.restore();
  }
}
// Symbole
function kaIcon(g, icon, x, y, r, o = {}) {
  g.save(); g.translate(x, y);
  const gold = o.dim ? 'rgba(217,178,106,0.5)' : KA_GOLD_HI;
  g.lineWidth = 1.6; g.strokeStyle = gold; g.fillStyle = 'rgba(6,22,28,0.92)';
  const dia = s => { g.beginPath(); g.moveTo(0, -s); g.lineTo(s, 0); g.lineTo(0, s); g.lineTo(-s, 0); g.closePath(); };
  if (icon === 'belmont') {
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); g.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); g.stroke(); }
    dia(r); g.fill(); g.stroke(); g.fillStyle = gold; dia(r * 0.45); g.fill();
  } else if (icon === 'villa') {
    g.beginPath(); g.moveTo(-r, r * 0.6); g.lineTo(-r, -r * 0.1); g.lineTo(0, -r); g.lineTo(r, -r * 0.1); g.lineTo(r, r * 0.6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = gold; g.fillRect(-r * 0.25, 0, r * 0.5, r * 0.6);
  } else if (icon === 'handel') {
    g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill(); g.stroke(); g.fillStyle = gold; g.font = `700 ${Math.round(r * 1.05)}px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Lm', 0, 1);
  } else if (icon === 'laden') {
    g.fillStyle = 'rgba(217,178,106,0.85)'; g.beginPath(); g.arc(0, 0, r * 0.45, 0, 6.283); g.fill();
  } else if (icon === 'versteck' || icon === 'versteckAus' || icon === 'aerger') {
    const c = icon === 'versteckAus' ? '#8a8272' : KA_RED;
    g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill(); g.stroke();
    if (icon === 'versteckAus') { g.beginPath(); g.moveTo(-r * 0.5, 0); g.lineTo(-r * 0.1, r * 0.4); g.lineTo(r * 0.55, -r * 0.45); g.stroke(); }
    else { g.fillStyle = c; g.font = `700 ${Math.round(r * 1.3)}px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 0, 1); }
  } else if (icon === 'aufgabe') {
    g.strokeStyle = KA_TEAL; g.lineWidth = 2; dia(r); g.fillStyle = 'rgba(64,200,190,0.35)'; g.fill(); g.stroke();
    if (o.track) { g.beginPath(); g.arc(0, 0, r * 1.6, 0, 6.283); g.stroke(); }
  } else if (icon === 'figur') {
    g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fillStyle = 'rgba(6,22,28,0.95)'; g.fill(); g.lineWidth = 2; g.strokeStyle = o.ready ? KA_GOLD_HI : KA_TEAL; g.stroke();
    g.fillStyle = o.ready ? KA_GOLD_HI : KA_TEAL; g.font = `700 ${Math.round(r * 1.1)}px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.ch || '·', 0, 1);
  } else if (icon === 'anker') {
    g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(0, -r * 0.55); g.lineTo(0, r * 0.55); g.moveTo(-r * 0.45, -r * 0.2); g.lineTo(r * 0.45, -r * 0.2); g.moveTo(-r * 0.5, r * 0.15); g.quadraticCurveTo(0, r * 0.85, r * 0.5, r * 0.15); g.stroke();
  } else if (icon === 'luftschiff') {
    g.beginPath(); g.ellipse(0, 0, r * 1.3, r * 0.55, 0, 0, 6.283); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-r * 1.3, 0); g.lineTo(r * 1.3, 0); g.stroke();
  } else if (icon === 'tunnel') {
    g.beginPath(); g.moveTo(-r, r * 0.7); g.lineTo(-r, -r * 0.1); g.arc(0, -r * 0.1, r, Math.PI, 0); g.lineTo(r, r * 0.7); g.closePath(); g.fill(); g.stroke();
  } else if (icon === 'bank') {
    g.beginPath(); g.moveTo(-r, -r * 0.35); g.lineTo(0, -r); g.lineTo(r, -r * 0.35); g.closePath(); g.fill(); g.stroke();
    g.fillRect(-r, r * 0.55, 2 * r, r * 0.3); g.strokeRect(-r, r * 0.55, 2 * r, r * 0.3);
    for (const xx of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(xx * r, -r * 0.2); g.lineTo(xx * r, r * 0.5); g.stroke(); }
  } else if (icon === 'bahn') {
    g.beginPath(); g.arc(0, 0, r * 0.95, 0, 6.283); g.fill(); g.stroke();
    g.fillStyle = gold; g.font = `700 ${Math.round(r * 1.05)}px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.ch || 'H', 0, 1);
  } else if (icon === 'bahnwagen') {
    g.fillStyle = o.col || KA_TEAL; g.strokeStyle = 'rgba(3,12,16,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, r * 0.55, 0, 6.283); g.fill(); g.stroke();
  } else if (icon === 'fabrik') {
    g.beginPath(); g.moveTo(-r, r * 0.7); g.lineTo(-r, -r * 0.2); g.lineTo(-r * 0.3, r * 0.15); g.lineTo(-r * 0.3, -r * 0.2); g.lineTo(r * 0.4, r * 0.15); g.lineTo(r * 0.4, -r); g.lineTo(r, -r); g.lineTo(r, r * 0.7); g.closePath(); g.fill(); g.stroke();
  } else {
    dia(r); g.fill(); g.stroke();
    if (o.ch) { g.fillStyle = gold; g.font = `700 ${Math.round(r * 1.0)}px ${KA_BODY}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.ch, 0, 1); }
    else { g.fillStyle = gold; g.beginPath(); g.arc(0, 0, r * 0.28, 0, 6.283); g.fill(); }
  }
  g.restore();
}
function kaLabel(g, P, x, y, r) {
  const k = KARTE.view.k, show = P.prio >= 9 || (P.prio >= 6 && k > 0.32) || (P.prio >= 4 && k > 0.6) || (P.prio >= 2 && k > 1.0) || k > 1.6;
  if (!show) return;
  const size = P.big ? 15 : 12.5;
  g.font = (P.big ? `400 ${size}px ${KA_DISPLAY}` : `600 ${size}px ${KA_BODY}`);
  const w = g.measureText(P.n).width, lx = x + r + 6, ly = y + size * 0.36;
  if (!kaFree(lx - 2, ly - size, w + 4, size * 1.35)) return;
  g.shadowColor = 'rgba(0,0,0,0.95)'; g.shadowBlur = 4; g.lineWidth = 3; g.strokeStyle = 'rgba(3,12,16,0.85)';
  g.textAlign = 'left'; g.strokeText(P.n, lx, ly);
  g.fillStyle = P.cat === 'gegner' ? '#f0a08a' : P.cat === 'laeden' ? '#d9c9a2' : KA_GOLD_HI; g.fillText(P.n, lx, ly);
  g.shadowBlur = 0;
}
function kaPlaceIcons(g) {
  const L = KARTE.s.lay, k = KARTE.view.k, list = KARTE.places.filter(P => L[P.cat]).sort((a, b) => b.prio - a.prio);
  KARTE.hits = [];
  for (const P of list) {
    if ((P.cat === 'laeden' || P.icon === 'fabrik') && k < 0.45) continue;
    const x = kaSX(P.x), y = kaSZ(P.z); if (x < -40 || x > KARTE.W + 40 || y < -40 || y > KARTE.H + 40) continue;
    const r = P.big ? 9 : P.cat === 'laeden' ? 5 : 7;
    kaIcon(g, P.icon, x, y, r, { ch: P.ch, dim: false });
    KARTE.boxes.push([x - r, y - r, 2 * r, 2 * r]);
    KARTE.hits.push({ P, x, y, r: Math.max(10, r + 4) });
  }
  for (const H of KARTE.hits) kaLabel(g, H.P, H.x, H.y, H.r - 4);
}
function kaScale(g) {
  const k = KARTE.view.k, want = 140 / k, steps = [25, 50, 100, 250, 500, 1000, 2000];
  const m = steps.find(s => s >= want * 0.6) || 2000, w = m * k, x = KARTE.W / 2 - w / 2, y = KARTE.H - 62;
  g.strokeStyle = KA_GOLD; g.fillStyle = KA_GOLD; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w, y - 5); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y - 3); g.stroke();
  g.fillRect(x, y - 2, w / 2, 2);
  g.font = `600 11px ${KA_BODY}`; g.textAlign = 'center'; g.fillStyle = KA_GOLD_HI;
  g.fillText(m >= 1000 ? (m / 1000) + ' km' : m + ' m', x + w / 2, y - 9);
}
// Kompassrose mit Strahlenkranz
function kaRose(g, x, y, R) {
  g.save(); g.translate(x, y);
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * 6.283, L = i % 8 === 0 ? R : i % 4 === 0 ? R * 0.72 : i % 2 === 0 ? R * 0.55 : R * 0.42;
    g.strokeStyle = i % 8 === 0 ? 'rgba(246,220,154,0.95)' : 'rgba(217,178,106,0.5)'; g.lineWidth = i % 8 === 0 ? 1.6 : 1;
    g.beginPath(); g.moveTo(Math.sin(a) * R * 0.18, -Math.cos(a) * R * 0.18); g.lineTo(Math.sin(a) * L, -Math.cos(a) * L); g.stroke();
  }
  g.strokeStyle = 'rgba(217,178,106,0.7)'; g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, R * 0.32, 0, 6.283); g.stroke(); g.beginPath(); g.arc(0, 0, R * 0.86, 0, 6.283); g.stroke();
  // Nordnadel
  g.fillStyle = KA_GOLD_HI; g.beginPath(); g.moveTo(0, -R * 1.02); g.lineTo(R * 0.12, -R * 0.2); g.lineTo(-R * 0.12, -R * 0.2); g.closePath(); g.fill();
  g.fillStyle = '#6a5530'; g.beginPath(); g.moveTo(0, R * 0.8); g.lineTo(R * 0.1, R * 0.2); g.lineTo(-R * 0.1, R * 0.2); g.closePath(); g.fill();
  g.font = `400 16px ${KA_DISPLAY}`; g.fillStyle = KA_GOLD_HI; g.textAlign = 'center'; g.fillText('N', 0, -R - 8);
  g.font = `600 10px ${KA_BODY}`; g.fillStyle = 'rgba(246,220,154,0.7)'; g.fillText('S', 0, R + 14); g.fillText('O', R + 10, 4); g.fillText('W', -R - 10, 4);
  g.restore();
}

/* ---------- Zeichnen: lebende Ebene (Alexander, Luftschiff, Ärger, Aufgaben, Wegpunkt) ---------- */
function kaArrow(g, x, y, ang, s, fill) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = fill; g.strokeStyle = 'rgba(3,12,16,0.9)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.62, s * 0.72); g.lineTo(0, s * 0.32); g.lineTo(-s * 0.62, s * 0.72); g.closePath(); g.stroke(); g.fill();
  g.restore();
}
function kaShip(g, x, y, ang, s) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = 'rgba(246,220,154,0.95)'; g.strokeStyle = 'rgba(3,12,16,0.9)'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 0, s * 0.38, s * 1.25, 0, 0, 6.283); g.stroke(); g.fill();
  g.fillStyle = '#0a2128'; g.fillRect(-s * 0.12, -s * 0.2, s * 0.24, s * 0.6);
  g.restore();
}
function kaWpMark(g, x, y, s) {
  g.save(); g.translate(x, y);
  g.shadowColor = 'rgba(246,220,154,0.8)'; g.shadowBlur = 10;
  g.fillStyle = 'rgba(217,178,106,0.45)'; g.strokeStyle = KA_GOLD_HI; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -s); g.lineTo(s * 0.7, 0); g.lineTo(0, s); g.lineTo(-s * 0.7, 0); g.closePath(); g.fill(); g.stroke();
  g.restore();
}
const kaShipAng = () => { const ry = IMP.g.rotation.y; return Math.atan2(Math.cos(ry), Math.sin(ry)); };
function kaDrawLive() {
  const g = KARTE.lv.getContext('2d'), { W, H, dpr } = KARTE;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  if (!KARTE.ready) return;
  KARTE.live = kaLivePoints();
  if (KARTE.s.lay.bahn) for (const v of BAHN.veh) { const c = v.cars[0]; kaIcon(g, 'bahnwagen', kaSX(c.x), kaSZ(c.z), 8, { col: v.line.col }); }   // V63: fahrende Wagen
  for (const P of KARTE.live) {
    kaIcon(g, P.icon, kaSX(P.x), kaSZ(P.z), P.cat === 'aufgaben' ? 8 : 9, { track: P.track, ch: P.ch, ready: P.ready });
    if (P.icon === 'figur' && KARTE.view.k > 0.3) { g.font = `600 11.5px ${KA_BODY}`; g.fillStyle = P.ready ? KA_GOLD_HI : '#bfe9e4'; g.textAlign = 'left'; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText(P.n + (P.ready ? ' !' : ''), kaSX(P.x) + 13, kaSZ(P.z) + 4); g.shadowBlur = 0; }
  }
  if (IMP.g) { const p = IMP.g.position; kaShip(g, kaSX(p.x), kaSZ(p.z), kaShipAng(), 11); if (KARTE.view.k > 0.25) { g.font = `600 11px ${KA_BODY}`; g.fillStyle = KA_GOLD_HI; g.textAlign = 'left'; g.shadowColor = '#000'; g.shadowBlur = 4; g.fillText('Aurora Imperial', kaSX(p.x) + 14, kaSZ(p.z) + 4); g.shadowBlur = 0; } }
  const wp = KARTE.s.wp;
  if (wp) {
    const x = kaSX(wp.x), y = kaSZ(wp.z), px = kaSX(player.p.x), py = kaSZ(player.p.z);
    g.setLineDash([6, 6]); g.strokeStyle = 'rgba(246,220,154,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, py); g.lineTo(x, y); g.stroke(); g.setLineDash([]);
    kaWpMark(g, x, y, 10);
  }
  if (KARTE.travel) { const T0 = KARTE.travel; g.strokeStyle = 'rgba(111,214,207,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(kaSX(player.p.x), kaSZ(player.p.z)); g.lineTo(kaSX(T0.E.x), kaSZ(T0.E.z)); g.stroke(); }
  // Alexander: goldener Pfeil mit Lichthof
  const ax = kaSX(player.p.x), ay = kaSZ(player.p.z), t = performance.now() / 1000;
  g.strokeStyle = `rgba(246,220,154,${(0.5 - 0.4 * ((t * 0.8) % 1)).toFixed(2)})`; g.lineWidth = 2; g.beginPath(); g.arc(ax, ay, 10 + 14 * ((t * 0.8) % 1), 0, 6.283); g.stroke();
  kaArrow(g, ax, ay, -player.yaw, 11, KA_GOLD_HI);
}

/* ---------- Ortskarte (Klick auf ein Symbol) ---------- */
function kaShowCard(P) {
  KARTE.cardP = P;
  const d = Math.hypot(P.x - player.p.x, P.z - player.p.z), visited = kaVisited(P), Z = P.ziele || [];
  let btn = `<button type="button" class="ka" data-act="wp">Wegpunkt setzen</button>`;
  if (Z.length) Z.forEach((z, i) => { btn += `<button type="button" class="ka" data-act="fly" data-i="${i}" ${visited ? '' : 'disabled'}>${Z.length > 1 ? z.t : 'Hinfliegen'}</button>`; });
  if (P.bahn) { const at = BAHN.sideAt && (BAHN.sideAt(player.p) || BAHN.ride); btn += `<button type="button" class="ka" data-act="bahn" ${at ? '' : 'disabled'}>Mit der Bahn hinfahren</button>`; }
  const el = KARTE.card;
  el.innerHTML = `<b></b><p></p><div class="d">${kaFmtD(d)} von Alexander</div><div class="btns">${btn}</div>${Z.length && !visited ? '<div class="no">Schnellreise, sobald Sie einmal dort waren.</div>' : ''}${P.bahn && !(BAHN.sideAt && (BAHN.sideAt(player.p) || BAHN.ride)) ? '<div class="no">Mit der Bahn: an einer Haltestelle oder im Wagen.</div>' : ''}`;
  el.querySelector('b').textContent = P.n; el.querySelector('p').textContent = P.sub || '';
  el.hidden = false;
  const x = kaSX(P.x), y = kaSZ(P.z), w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = kaClamp(x + 16, 16, KARTE.W - w - 16) + 'px'; el.style.top = kaClamp(y - h / 2, 70, KARTE.H - h - 70) + 'px';
}
function kaHideCard() { if (KARTE.card) KARTE.card.hidden = true; KARTE.cardP = null; }
function kaZiele() {
  const box = KARTE.el.querySelector('aside .ziele');
  const list = KARTE.places.filter(P => P.ziele && P.ziele.length && P.cat !== 'laeden' && P.cat !== 'bahn').sort((a, b) => b.prio - a.prio || a.n.localeCompare(b.n));
  box.innerHTML = list.map(P => `<button type="button" data-act="goto" data-id="${P.id.replace(/"/g, '&quot;')}"></button>`).join('');
  [...box.children].forEach((b, i) => { b.textContent = list[i].n; if (kaVisited(list[i])) { const e = document.createElement('em'); e.textContent = 'Flug'; b.append(e); } });
}

/* ---------- Maus, Finger, Tasten in der Karte ---------- */
function kaZoomAt(sx, sy, f) {
  const wx = kaWX(sx), wz = kaWZ(sy), V = KARTE.view;
  V.k = kaClamp(V.k * f, KARTE.kMin || 0.1, 3.2);
  V.cx = wx - (sx - KARTE.W / 2) / V.k; V.cz = wz - (sy - KARTE.H / 2) / V.k;
  kaClampView(); KARTE.dirty = true; kaHideCard();
}
function kaClampView() {
  const E = KARTE.E; if (!E) return; const V = KARTE.view;
  V.cx = kaClamp(V.cx, E.x0, E.x0 + E.L); V.cz = kaClamp(V.cz, E.z0, E.z0 + E.L);
}
function kaInputs(el) {
  const ptrs = new Map(); let down = null, pinch = null;
  const cv = KARTE.lv;
  el.addEventListener('wheel', e => { e.preventDefault(); e.stopPropagation(); kaZoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); kaSetWp(null); });
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, cx: KARTE.view.cx, cz: KARTE.view.cz, moved: false, btn: e.button };
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: KARTE.view.k }; down = null; }
  });
  cv.addEventListener('pointermove', e => {
    const q = ptrs.get(e.pointerId);
    if (!q) { kaHover(e.clientX, e.clientY); return; }
    q.x = e.clientX; q.y = e.clientY;
    if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); kaZoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.k * d / pinch.d / KARTE.view.k); return; }
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      if (down.moved) { KARTE.view.cx = down.cx - dx / KARTE.view.k; KARTE.view.cz = down.cz - dy / KARTE.view.k; kaClampView(); KARTE.dirty = true; kaHideCard(); }
    }
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (down && !down.moved && down.btn === 0 && e.type === 'pointerup') kaClick(e.clientX, e.clientY);
    if (!ptrs.size) down = null;
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('dblclick', e => kaZoomAt(e.clientX, e.clientY, 2));
}
function kaHit(sx, sy) {
  let best = null, bd = 1e9;
  for (const P of KARTE.live || []) { const d = Math.hypot(kaSX(P.x) - sx, kaSZ(P.z) - sy); if (d < 13 && d < bd) { bd = d; best = P; } }
  for (const H of KARTE.hits || []) { const d = Math.hypot(H.x - sx, H.y - sy); if (d < H.r && d < bd) { bd = d; best = H.P; } }
  return best;
}
function kaHover(sx, sy) { const h = kaHit(sx, sy); KARTE.lv.style.cursor = h ? 'pointer' : 'crosshair'; }
function kaClick(sx, sy) {
  const P = kaHit(sx, sy);
  if (P) { kaShowCard(P); return; }
  if (KARTE.cardP) { kaHideCard(); return; }
  kaSetWp({ x: kaWX(sx), z: kaWZ(sy), n: 'Wegpunkt' });
}
function kaCenterMe() { KARTE.view.cx = player.p.x; KARTE.view.cz = player.p.z; KARTE.view.k = Math.max(KARTE.view.k, 0.7); kaClampView(); KARTE.dirty = true; kaHideCard(); }
function kaKey(e) {
  if (!KARTE.open) return false;
  const k = (e.key || '').toLowerCase();
  if (e.code === 'Escape' || (k === 'y' && !e.shiftKey)) kaClose();
  else if (e.code === 'Space') kaCenterMe();
  else if (k === '+' || e.code === 'Equal' || e.code === 'NumpadAdd') kaZoomAt(KARTE.W / 2, KARTE.H / 2, 1.4);
  else if (k === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') kaZoomAt(KARTE.W / 2, KARTE.H / 2, 1 / 1.4);
  else {
    const step = 120 / KARTE.view.k, V = KARTE.view;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') V.cx -= step; else if (e.code === 'ArrowRight' || e.code === 'KeyD') V.cx += step;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') V.cz -= step; else if (e.code === 'ArrowDown' || e.code === 'KeyS') V.cz += step;
    kaClampView(); KARTE.dirty = true;
  }
  return true;
}

/* ---------- Öffnen und Schließen ---------- */
export function kaOpen() {
  if (KARTE.open || !playing) return;
  if (DINE.menuOpen) return;   // Speisekarte, Kontorbuch oder ein Gespräch ist offen
  kaDom(); kaEnsure(); kaPump(1e9);   // falls das Bild noch nicht fertig ist: jetzt zu Ende zeichnen
  KARTE.open = true; KARTE.fromPause = paused; DINE.menuOpen = true; DINE.onPick = null;
  KARTE.el.hidden = false; kaResize(); kaFit();
  KARTE.places = kaPlaces(); kaZiele(); kaRingLabel();
  if (!KARTE.seen) { KARTE.seen = true; KARTE.view.k = Math.max(KARTE.kMin, 0.32); }
  KARTE.view.cx = player.p.x; KARTE.view.cz = player.p.z; kaClampView();
  kaHideCard(); KARTE.dirty = true;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* egal */ }
}
export function kaClose() {
  if (!KARTE.open) return;
  KARTE.open = false; DINE.menuOpen = false; KARTE.el.hidden = true; kaHideCard();
  if (!isTouch && playing && !paused) tryLock();
}
export function kaToggle() { if (KARTE.open) kaClose(); else kaOpen(); }

/* =====================================================================
   4) WEGPUNKT, KOMPASSRING, MARKE IN DER WELT
   ===================================================================== */
function kaSetWp(w) {
  KARTE.s.wp = w ? { x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10, n: w.n || 'Wegpunkt' } : null;
  kaSave();
  if (w) toast('Wegpunkt: ' + (w.n || 'gesetzt') + ' · ' + kaFmtD(Math.hypot(w.x - player.p.x, w.z - player.p.z)));
}
export function kaToggleRing() {
  KARTE.s.ring = !KARTE.s.ring; kaSave(); kaRingLabel();
  const w = $('mapWrap'); if (w) w.classList.toggle('aus', !KARTE.s.ring);
  if (!KARTE.open) toast('Kompassring ' + (KARTE.s.ring ? 'an' : 'aus'));
}
// der Ring unten rechts: Kartenausschnitt rund, Goldring mit Strichen, Ziele am Rand
function kaHud() {
  const c = $('map'); if (!c || !KARTE.ready || !KARTE.s.ring) return;
  const g = c.getContext('2d'), Wc = c.width, r = Wc / 2, E = KARTE.E, span = 560, k = Wc / span, px = player.p.x, pz = player.p.z;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, Wc, Wc);
  g.save(); g.beginPath(); g.arc(r, r, r - 12, 0, 6.283); g.clip();
  g.fillStyle = '#07171c'; g.fillRect(0, 0, Wc, Wc);
  g.imageSmoothingEnabled = true;
  g.setTransform(k / E.s, 0, 0, k / E.s, r - (px - E.x0) * k, r - (pz - E.z0) * k); g.drawImage(KARTE.base, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const rad = r - 22;
  const put = (x, z, fn) => {
    let dx = (x - px) * k, dz = (z - pz) * k; const d = Math.hypot(dx, dz), out = d > rad;
    if (out) { dx *= rad / d; dz *= rad / d; }
    fn(r + dx, r + dz, out);
  };
  if (IMP.g) { const p = IMP.g.position; put(p.x, p.z, (x, y, o) => { if (!o) kaShip(g, x, y, kaShipAng(), 12); }); }
  const E0 = GEGNER.ev; if (E0) { try { const w = E0.where && E0.where(); if (w) put(w[0], w[1], (x, y) => kaIcon(g, 'aerger', x, y, 10)); } catch (e) { /* egal */ } }
  if (KT.ready && KT.s && KT.s.q && KT.s.q.track) { const q = KT.s.q.list.find(q => q.id === KT.s.q.track && q.st === 'aktiv'); if (q) { let pr = null; try { pr = progress(q); } catch (e) { pr = null; } if (pr && pr.pt) put(pr.pt.x, pr.pt.z, (x, y) => kaIcon(g, 'aufgabe', x, y, 10)); } }
  const wp = KARTE.s.wp; if (wp) put(wp.x, wp.z, (x, y) => kaWpMark(g, x, y, 13));
  g.restore();
  // Goldring
  g.strokeStyle = 'rgba(3,12,16,0.85)'; g.lineWidth = 10; g.beginPath(); g.arc(r, r, r - 7, 0, 6.283); g.stroke();
  g.strokeStyle = KA_GOLD; g.lineWidth = 2.4; g.beginPath(); g.arc(r, r, r - 12, 0, 6.283); g.stroke();
  g.lineWidth = 1.2; g.beginPath(); g.arc(r, r, r - 3, 0, 6.283); g.stroke();
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * 6.283, L = i % 12 === 0 ? 9 : i % 4 === 0 ? 6 : 3;
    g.beginPath(); g.moveTo(r + Math.sin(a) * (r - 12), r - Math.cos(a) * (r - 12)); g.lineTo(r + Math.sin(a) * (r - 12 - L), r - Math.cos(a) * (r - 12 - L)); g.stroke();
  }
  g.font = `400 22px ${KA_DISPLAY}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `400 20px ${KA_DISPLAY}`; g.fillStyle = '#04121a'; g.beginPath(); g.arc(r, 24, 13, 0, 6.283); g.fill();
  g.fillStyle = KA_GOLD_HI; g.fillText('N', r, 25);
  g.textBaseline = 'alphabetic';
  kaArrow(g, r, r, -player.yaw, 17, KA_GOLD_HI);
  if (wp) {
    const d = Math.hypot(wp.x - px, wp.z - pz), txt = kaFmtD(d);
    g.font = `600 19px ${KA_BODY}`; const w = g.measureText(txt).width + 26;
    g.fillStyle = 'rgba(4,18,26,0.85)'; g.fillRect(r - w / 2, Wc - 64, w, 26); g.strokeStyle = 'rgba(217,178,106,0.6)'; g.lineWidth = 1; g.strokeRect(r - w / 2, Wc - 64, w, 26);
    g.fillStyle = KA_GOLD_HI; g.fillText(txt, r, Wc - 44);
  }
}
// Raute über dem Wegpunkt in der Welt
const _kav = new T.Vector3();
function kaWorldMark() {
  const wp = KARTE.s.wp, show = wp && playing && !paused && !KARTE.open;
  if (!show) { if (KARTE.mk && !KARTE.mk.hidden) KARTE.mk.hidden = true; return; }
  if (!KARTE.mk) { kaCss(); const d = KARTE.mk = document.createElement('div'); d.className = 'kaMk'; d.innerHTML = '<span></span><b></b>'; document.body.append(d); }
  const d = Math.hypot(wp.x - player.p.x, wp.z - player.p.z);
  if (d < 22) { toast('Wegpunkt erreicht'); kaSetWp(null); KARTE.mk.hidden = true; return; }
  const y = onIsland(wp.x, wp.z, 0) ? 6 : Math.max(WATER_Y, KARTE.wpY != null && KARTE.wpYk === wp.x + ',' + wp.z ? KARTE.wpY : (KARTE.wpYk = wp.x + ',' + wp.z, KARTE.wpY = terrainHeight(wp.x, wp.z))) + 6;
  _kav.set(wp.x, y + Math.min(60, d * 0.04), wp.z).project(camera);
  const el = KARTE.mk;
  if (_kav.z > 1 || _kav.z < -1 || Math.abs(_kav.x) > 1.05 || Math.abs(_kav.y) > 1.05) { el.hidden = true; return; }
  if (el.hidden) el.hidden = false;
  // V64: Lage nur schreiben, wenn sie sich ändert (jede Änderung lässt den Browser Stil und Lage neu rechnen)
  const L = ((_kav.x + 1) / 2 * innerWidth).toFixed(0) + 'px', Tp = ((1 - _kav.y) / 2 * innerHeight).toFixed(0) + 'px';
  if (el._l !== L) { el._l = L; el.style.left = L; } if (el._tp !== Tp) { el._tp = Tp; el.style.top = Tp; }
  const t = (wp.n && wp.n !== 'Wegpunkt' ? wp.n + ' · ' : '') + kaFmtD(d);
  if (el._t !== t) { el._t = t; el.querySelector('b').textContent = t; }
}

/* =====================================================================
   5) SCHNELLREISE: ALEXANDER FLIEGT SELBST
   ===================================================================== */
function kaVisited(P) { return !!(KARTE.s.v[P.id] || P.id === 'belmont' || P.id === 'villa' || P.id === 'platz'); }
function kaVisitScan() {
  const p = player.p;
  for (const P of KARTE.places) {
    if (!P.ziele || !P.ziele.length || kaVisited(P)) continue;
    if ((P.x - p.x) ** 2 + (P.z - p.z) ** 2 < 70 * 70) { KARTE.s.v[P.id] = 1; kaSave(); toast('Auf der Karte vermerkt: ' + P.n + ' · Schnellreise mit Y'); }
  }
}
function kaInside() {
  const p = player.p;
  if (inBelmont(p.x, p.z, p.y) || inPenthouse(p)) return 'Erst ins Freie: aus dem Belmont kommt Alexander nur durch Tür oder Terrasse.';
  if (VR.room) return 'Erst aus der Villa ins Freie gehen.';
  if (UNTER.test && UNTER.test(p)) return 'Erst die Leiter hinauf, hier unten kann Alexander nicht fliegen.';
  for (const V of VENUES) if (p.x > V.x0 && p.x < V.x1 && p.z > V.z0 && p.z < V.z1 && p.y < 6) return 'Erst aus dem Lokal hinausgehen.';
  for (const S of SHOPS) if (p.x > S.x0 && p.x < S.x1 && p.z > S.z0 && p.z < S.z1 && p.y < 5) return 'Erst aus dem Laden hinausgehen.';
  if (IMP.st === 'helm') return 'Erst das Steuer der Aurora Imperial übergeben.';
  return null;
}
// höchstes Hindernis entlang der Strecke (Gebäude, Belmont, Berge)
function kaClear(ax, az, bx, bz) {
  let top = 0; const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
  const dist = (x, z) => { const t = kaClamp(((x - ax) * vx + (z - az) * vz) / L2, 0, 1); return Math.hypot(ax + vx * t - x, az + vz * t - z); };
  for (const s of segs) if (s.y1 > top && dist(s.x, s.z) < Math.max(s.w, s.d) / 2 + 40) top = s.y1;
  if (dist(0, 0) < 90) top = Math.max(top, 440);
  const n = 40; for (let i = 0; i <= n; i++) { const x = ax + vx * i / n, z = az + vz * i / n; if (!onIsland(x, z, 0)) top = Math.max(top, terrainHeight(x, z)); }
  return top;
}
function kaFlyTo(P, zi) {
  const Z = (P.ziele || [])[zi]; if (!Z) return;
  const why = kaInside(); if (why) { toast(why); return; }
  if (BOAT.on) boatExit();
  if (DRIVE.on) driveExit();
  if (DINE.seat) { toast('Erst vom Tisch aufstehen.'); return; }
  let A = Z.a;
  if (!A) A = kaStreetNear(P.x, P.z);
  if (A.deck) A = { x: A.x, y: A.y, z: A.z };
  const S = player.p.clone(), Ev = new T.Vector3(A.x, A.y + 1.2, A.z);
  const via = A.via ? new T.Vector3(A.via.x, A.via.y, A.via.z) : null, F = via || Ev;
  const D = Math.hypot(F.x - S.x, F.z - S.z), top = kaClear(S.x, S.z, F.x, F.z);
  const Hc = Math.max(S.y, F.y) + 30 < top + 45 ? top + 45 : Math.max(S.y, F.y) + 30, cruise = Math.max(Hc, Math.min(240, 80 + D * 0.08));
  const dx = (F.x - S.x) / (D || 1), dz = (F.z - S.z) / (D || 1), lead = Math.min(D * 0.22, 240);
  const pts = [S.clone(), new T.Vector3(S.x, S.y + (cruise - S.y) * 0.55, S.z)];
  if (D > 160) { pts.push(new T.Vector3(S.x + dx * lead, cruise, S.z + dz * lead), new T.Vector3(F.x - dx * lead, cruise, F.z - dz * lead)); }
  pts.push(new T.Vector3(F.x, F.y + (cruise - F.y) * 0.5, F.z));
  if (via) pts.push(via.clone());
  pts.push(Ev.clone());
  const curve = new T.CatmullRomCurve3(pts, false, 'centripetal', 0.5), len = curve.getLength();
  const dur = kaClamp(3 + len / 190, 4, 24);
  kaClose(); if (paused) resume();
  if (!player.fly) startFlight();
  KARTE.travel = { curve, len, dur, t: 0, wait: 0.7, E: Ev, n: P.n, land: !A.stay, prev: S.clone() };
  toast('Alexander fliegt: ' + P.n + ' · eine Bewegungstaste bricht ab');
}
const _kp = new T.Vector3(), _kq = new T.Vector3();
function kaTravelStep(dt) {
  const T0 = KARTE.travel; if (!T0) return;
  if (!playing || DRIVE.on || BOAT.on) { KARTE.travel = null; return; }
  if (paused) return;
  if (T0.wait > 0) { T0.wait -= dt; if (!player.fly) { KARTE.travel = null; } return; }   // in die Knie, abstoßen
  if (!player.fly) player.fly = true;
  T0.t += dt;
  const u = kaClamp(T0.t / T0.dur, 0, 1), e = (1 - Math.cos(Math.PI * u)) / 2, e2 = (1 - Math.cos(Math.PI * kaClamp(u + 0.004, 0, 1))) / 2;
  T0.curve.getPointAt(e, _kp); T0.curve.getPointAt(Math.min(1, e2), _kq);
  const vScale = 1 / Math.max(1e-3, T0.dur * 0.004);
  player.p.copy(_kp);
  player.v.copy(_kq).sub(_kp).multiplyScalar(vScale);
  const hv = Math.hypot(player.v.x, player.v.z);
  if (hv > 3) {
    const want = Math.atan2(-player.v.x, -player.v.z);
    let d = want - player.yaw; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    player.yaw += d * Math.min(1, dt * 3);
  }
  player.pitch += (kaClamp(Math.atan2(player.v.y, hv + 1) * 0.6, -0.5, 0.35) - player.pitch) * Math.min(1, dt * 2);
  if (u >= 1) {
    player.p.copy(T0.E); player.v.set(0, 0, 0); KARTE.travel = null;
    if (T0.land) stopFlight();
    toast('Angekommen: ' + T0.n);
  }
}
function kaCancelTravel(e) {
  if (!KARTE.travel || KARTE.open) return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyC', 'KeyQ', 'KeyF', 'Escape'].includes(e.code)) {
    KARTE.travel = null; player.v.multiplyScalar(0.3); toast('Flug abgebrochen');
  }
}

/* =====================================================================
   6) TAKT, TASTEN, ANSCHLUSS
   ===================================================================== */
let kaLast = 0;
function kaLoop(t) {
  requestAnimationFrame(kaLoop);
  const dt = Math.min(0.1, kaLast ? (t - kaLast) / 1000 : 0); kaLast = t;
  if (playing && !KARTE.ready) { kaEnsure(); kaPump(KARTE.open ? 1e9 : 5); }
  kaTravelStep(dt);
  if (KARTE.open) {
    if (KARTE.dirty) { KARTE.dirty = false; if (KARTE.ready) { KARTE.places = KARTE.places.length ? KARTE.places : kaPlaces(); } kaDrawStatic(); }
    if ((KARTE.liveT -= dt) <= 0) { KARTE.liveT = 1 / 15; kaDrawLive(); }
    if ((KARTE.placeT -= dt) <= 0) { KARTE.placeT = 2; const n = KARTE.places.length; KARTE.places = kaPlaces(); if (KARTE.places.length !== n) KARTE.dirty = true; }
  } else if (playing) {
    if ((KARTE.hudT -= dt) <= 0) { KARTE.hudT = 1 / 15; kaHud(); }
    if ((KARTE.visitT -= dt) <= 0) { KARTE.visitT = 1; if (KARTE.ready) { if (!KARTE.places.length || Math.random() < 0.1) KARTE.places = kaPlaces(); kaVisitScan(); } }
  }
  kaWorldMark();
}
function kaSetup() {
  kaLoad(); kaCss();
  const w = $('mapWrap'); if (w) { w.classList.add('kaRing'); w.classList.toggle('aus', !KARTE.s.ring); }
  MAP_HOOK.draw = () => KARTE.ready || !KARTE.s.ring;   // alte eckige Minikarte nur, bis das neue Kartenbild fertig ist
  addTasten('stadt', [
    { id: 'karte', k: ['Y'], t: 'Stadtkarte', d: 'Ganz Vespera: Orte, Handel, Ärger, Aufgaben, Alexander und die Aurora Imperial. Klick setzt einen Wegpunkt, besuchte Orte fliegt Alexander selbst an', act: () => { kaOpen(); return false; } },
    { id: 'kartering', k: ['Umschalt', '+', 'Y'], t: 'Kompassring', d: 'Der runde Kartenausschnitt unten rechts mit Wegpunkt und Ziel', an: () => KARTE.s.ring ? 'an' : 'aus', act: () => { kaToggleRing(); } },
  ]);
  const bar = $('pauseKeys');
  if (bar && !$('pauseKarte')) { const b = document.createElement('button'); b.type = 'button'; b.className = 'qual'; b.id = 'pauseKarte'; b.textContent = 'Stadtkarte'; b.addEventListener('click', () => kaOpen()); bar.append(b); }
  const hint = $('hint'); if (hint && !hint.textContent.includes('Stadtkarte')) hint.insertAdjacentHTML('beforeend', ' · <kbd>Y</kbd> Stadtkarte');
  const tu = $('touchUI'); if (tu && !$('tMap')) { const b = document.createElement('button'); b.type = 'button'; b.id = 'tMap'; b.textContent = 'KARTE'; b.addEventListener('click', () => kaOpen()); tu.append(b); }
  window.addEventListener('resize', () => { if (KARTE.open) { kaResize(); kaFit(); } });
  document.addEventListener('pointerlockchange', () => { if (KARTE.open && document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* egal */ } });
  if (window.vespera) window.vespera.karte = { KARTE, open: kaOpen, close: kaClose, setWp: kaSetWp, flyTo: (id, i = 0) => { const P = (KARTE.places.length ? KARTE.places : (KARTE.places = kaPlaces())).find(q => q.id === id); if (P) { KARTE.s.v[P.id] = 1; kaFlyTo(P, i); } return !!P; }, places: () => kaPlaces(), build: () => { kaEnsure(); kaPump(1e9); return KARTE.stats; } };
}
if (typeof window !== 'undefined') {
  // vor input.js (Fangphase): Y öffnet, Umschalt+Y schaltet den Ring; solange die Karte offen ist, gehören ihr die Tasten
  window.addEventListener('keydown', e => {
    if (KARTE.open) { kaKey(e); e.stopImmediatePropagation(); if (e.code !== 'F5' && e.code !== 'F12') e.preventDefault(); return; }
    kaCancelTravel(e);
    const k = (e.key || '').toLowerCase();
    if (k !== 'y' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || !playing || document.activeElement?.tagName === 'INPUT') return;
    if (e.shiftKey) { kaToggleRing(); e.stopImmediatePropagation(); return; }
    if (DINE.menuOpen) return;
    kaOpen(); e.stopImmediatePropagation(); e.preventDefault();
  }, true);
  setTimeout(kaSetup, 30);
  requestAnimationFrame(kaLoop);
}
