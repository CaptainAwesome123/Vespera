import { shared, canvasTex, mulberry32, T, mergeGeos, scene, MOBILE, U, pick, R, rand, camera, ANISO, FOG_GLSL, FOGVIS, snowy } from './core.js';
import { personGeoHi, personShare, HQ } from './people-model.js';
import { stdMat, MAT, addCollider, glowTex, paintMat, mergeColored, PAINT, personLook } from './people-skeleton.js';
import { lamps, trees, addGlow, NEON, addNeon, addSeg, shafts, spires, neons, segs, dedupeSegs, facadeMat, glowPts, roofs, curbs } from './facade-shader.js';
import { buildGroundMask, groundGrass, COAST, ISL, buildSidewalks, blocks, inRect, PLAZA, MEDIAN, BRIDGE_LOOPS } from './island.js';
import { buildHouseDoors } from './building-forms.js';
import { IB, FACTORY_LOOPS, FACTORY_IDLERS } from './shops.js';
import { makeSignTex, FAN_TEX, lathe, crownFins, caps, domes, buildEntrances, DOORS, TERRACE, CLOCKS } from './entrances.js';
import { WATER_Y, setDance, placeCouple } from './dance.js';
import { poolWaterMat, fountainJet } from './water.js';
import { VILLA, deckY, TER, terrainHeight, ROAD_Z0, VIA, ROAD_W, terrainHeightRaw, terrainInfo, VALLEY_W, PORT_LOOPS, PORT_PEDS } from './harbour.js';
import { makeGlowPoints, buildCitizens } from './ragdoll.js';
import { cars } from './airships.js';
import { carDamageAttr, carCabin, carLoft, carSweep, fenderPath, carWheel } from './cars.js';
import { OBSTACLES, _m, _p, _q, _up, _s, TRUCK_N, deliveryMen, buildDrivers } from './traffic.js';
import { dishModel, VENUE_PEDS } from './venues.js';
import { carScenePeds } from './eating.js';
import { fxEmit } from './particles.js';
import { impulse, crashDamage } from './driving.js';
import { windPatch } from './wind.js';
import { addLight } from './performance.js';
import { buildVillaRooms, updateVillaRooms } from './villa.js';

/* =====================================================================
   V16 · SERPENTINE ZUR VILLA: vom Viadukt zweigt eine gepflasterte Bergstraße ab
   und windet sich in neun Kehren den Hang hinauf; Stützmauern bergseitig, Brüstung
   mit Laternen talseitig, Prellsteine in den Kehren. Oben eine Allee mit Zypressen,
   ein Prunktor mit Goldfächer und ein Rondell mit Springbrunnen vor der Vorfahrt.
   Das Gelände wird in Bänke und Böschungen geformt, ein feines Netz zeigt es.
   ===================================================================== */
export const SERP = { on: false, roads: [], hash: new Map(), cell: 8, tp: [], th: new Map(), tc: 12, XA: 85, XB: 420, zJ: -1395, gap: 30, legs: 9, HW: 3.5, box: null, lanes: [], cars: [] };
export const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
export const serpWig = x => 6 * Math.sin(0.011 * x + 0.5) + 3 * Math.sin(0.029 * x + 1.7);
export function serpW(lx, lz) { const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry); return [VILLA.x + lx * cs + lz * sn, VILLA.z - lx * sn + lz * cs]; }
// eine Straße aus Punkten [x, z, Steigungsgewicht]: Bogenlänge, Normale (+n = rechts in Fahrtrichtung)
export function serpRoad(P, closed, walls) {
  const p = P.map(([x, z, w]) => ({ x, z, y: 0, w, s: 0, nx: 0, nz: 0 }));
  for (let i = 1; i < p.length; i++) p[i].s = p[i - 1].s + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = p[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tx = b.x - a.x, tz = b.z - a.z, L = Math.hypot(tx, tz) || 1;
    p[i].nx = -tz / L; p[i].nz = tx / L;
  }
  const R = { p, closed, walls, len: p[n - 1].s + (closed ? Math.hypot(p[0].x - p[n - 1].x, p[0].z - p[n - 1].z) : 0), wf: [new Int8Array(n), new Int8Array(n)], wh: [new Float32Array(n), new Float32Array(n)] };
  SERP.roads.push(R);
  return R;
}
export function planSerpentine() {
  const { XA, XB, zJ, gap } = SERP, by = VILLA.y, w4 = serpWig(4);
  const legZ = (k, x) => zJ - gap * k + serpWig(x) - w4;
  const P = [];
  const add = (x, z, w) => { const l = P[P.length - 1]; if (l && Math.hypot(x - l[0], z - l[1]) < 0.6) return; P.push([x, z, w]); };
  // erste Gerade vom Viadukt, flach über die kurze Brücke, dann die Kehren
  for (let x = 6.5; x < XB; x += 2) add(x, legZ(0, x), x < 12 ? 0 : 1);
  for (let k = 0; k < SERP.legs; k++) {
    const east = k % 2 === 0, X = east ? XB : XA;
    if (k > 0) for (let i = 0; i <= Math.round((XB - XA) / 2); i++) { const x = east ? XA + i * 2 : XB - i * 2; add(x, legZ(k, x), 1); }
    if (k === SERP.legs - 1) break;
    // Kehre: halbe Ellipse nach außen, etwas flacher als die Geraden
    const za = legZ(k, X), zb = legZ(k + 1, X), cz = (za + zb) / 2, r = (za - zb) / 2, ex = r * 1.18 * (east ? 1 : -1);
    for (let j = 1; j < 28; j++) { const f = j / 28 * Math.PI; add(X + ex * Math.sin(f), cz + r * Math.cos(f), 0.55); }
  }
  // Allee bis zum Rondell vor der Vorfahrt
  const RC = SERP.RC = serpW(-80, -40), Rr = SERP.Rr = 14;
  const A0 = P[P.length - 1], ux = RC[0] - A0[0], uz = RC[1] - A0[1], ul = Math.hypot(ux, uz);
  const E = [RC[0] - ux / ul * Rr, RC[1] - uz / ul * Rr];
  const c1 = [A0[0] + 30, A0[1]], c2 = [E[0] - ux / ul * 30, E[1] - uz / ul * 30];
  const nA = Math.ceil(Math.hypot(E[0] - A0[0], E[1] - A0[1]) / 2);
  for (let i = 1; i <= nA; i++) {
    const t = i / nA, u = 1 - t;
    add(u * u * u * A0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * E[0], u * u * u * A0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * E[1], -1);
  }
  const M = serpRoad(P, false, true);
  // Höhen: gleichmäßige Steigung nach Gewicht, Allee eben
  const yJ = deckY(zJ), wt = M.p.map((q, i) => i ? Math.max(0, q.w) * (q.s - M.p[i - 1].s) : 0);
  const tot = wt.reduce((a, b) => a + b, 0);
  let acc = 0;
  M.p.forEach((q, i) => { acc += wt[i]; q.y = yJ + (by - yJ) * acc / tot; q.alley = q.w < 0; });
  M.alley0 = M.p.findIndex(q => q.alley);
  // Rondell und Zufahrt zur Vorfahrt
  const ring = [];
  for (let k = 0; k < 44; k++) { const a = k / 44 * Math.PI * 2; ring.push([RC[0] + Math.cos(a) * Rr, RC[1] + Math.sin(a) * Rr, 0]); }
  serpRoad(ring, true, false).p.forEach(q => q.y = by);
  const F = serpW(-53, -40), dx = F[0] - RC[0], dz = F[1] - RC[1], dl = Math.hypot(dx, dz), sp = [];
  for (let d = Rr + SERP.HW - 0.6; d <= dl + 0.01; d += 2) sp.push([RC[0] + dx / dl * d, RC[1] + dz / dl * d, 0]);
  serpRoad(sp, false, false).p.forEach(q => q.y = by);
  // Raster: Fahrbahnabschnitte (eng) und Geländepunkte (weit)
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  SERP.roads.forEach((R, ri) => {
    const n = R.p.length, segs = R.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = R.p[i], b = R.p[(i + 1) % n], c = SERP.cell;
      for (let gx = Math.floor((Math.min(a.x, b.x) - 4.5) / c); gx <= Math.floor((Math.max(a.x, b.x) + 4.5) / c); gx++)
        for (let gz = Math.floor((Math.min(a.z, b.z) - 4.5) / c); gz <= Math.floor((Math.max(a.z, b.z) + 4.5) / c); gz++) {
          const key = gx * 100003 + gz; let l = SERP.hash.get(key); if (!l) SERP.hash.set(key, l = []); l.push(ri, i);
        }
    }
    R.p.forEach((q, i) => {
      const j = SERP.tp.length / 4;
      SERP.tp.push(q.x, q.z, q.y, ri === 0 ? q.s : 1e5 + ri * 1e4);
      const key = Math.floor(q.x / SERP.tc) * 100003 + Math.floor(q.z / SERP.tc); let l = SERP.th.get(key); if (!l) SERP.th.set(key, l = []); l.push(j);
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    });
  });
  SERP.box = { x0: x0 - 50, x1: x1 + 50, z0: z0 - 50, z1: z1 + 50 };
  // feines Geländenetz: etwas größer als der Einflussbereich
  SERP.patch = { x0: -40, x1: Math.max(620, x1 + 60), z0: z0 - 90, z1: z1 + 70 };
  SERP.on = true;
}
// Gelände: Bänke für die Fahrbahn, dazwischen gleichmäßige Hänge; außen Böschung (Damm) oder Felseinschnitt
export const _sc = [];
export function serpTerrain(x, z, h) {
  const B = SERP.box;
  if (!SERP.on || x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return h;
  const x0 = 9 + 21 * sstep(-1405, -1432, z), f = sstep(x0, x0 + 18, x);
  if (f <= 0) return h;
  const tp = SERP.tp, tc = SERP.tc, gx = Math.floor(x / tc), gz = Math.floor(z / tc), RM = 48;
  _sc.length = 0;
  let d1 = RM * RM, i1 = -1;
  for (let a = gx - 4; a <= gx + 4; a++) for (let b = gz - 4; b <= gz + 4; b++) {
    const l = SERP.th.get(a * 100003 + b); if (!l) continue;
    for (const j of l) { const dx = tp[j * 4] - x, dz = tp[j * 4 + 1] - z, d = dx * dx + dz * dz; if (d < RM * RM) { _sc.push(j, d); if (d < d1) { d1 = d; i1 = j; } } }
  }
  if (i1 < 0) return h;
  const s1 = tp[i1 * 4 + 3], ax = tp[i1 * 4] - x, az = tp[i1 * 4 + 1] - z;
  let d2 = RM * RM, i2 = -1;
  for (let k = 0; k < _sc.length; k += 2) {
    const j = _sc[k]; if (Math.abs(tp[j * 4 + 3] - s1) < 40 || _sc[k + 1] >= d2) continue;
    if ((tp[j * 4] - x) * ax + (tp[j * 4 + 1] - z) * az > 0) continue;
    d2 = _sc[k + 1]; i2 = j;
  }
  d1 = Math.sqrt(d1);
  const y1 = tp[i1 * 4 + 2] - 0.25, e1 = Math.max(0, d1 - 5.2);
  // zum See hin eine steile Ufermauer statt eines breiten Damms
  const fs = 0.85 + 2.8 * sstep(WATER_Y + 4, WATER_Y - 8, h);
  let hc = Math.min(y1 + e1 * 1.6, Math.max(y1 - e1 * fs, h)), em = e1;
  if (i2 >= 0) {
    // bergseitig steigt der Hang gleich hinter der Stützmauer an, talseitig bleibt ein Bankett hinter der Brüstung
    d2 = Math.sqrt(d2);
    const y2 = tp[i2 * 4 + 2] - 0.25, up = y2 > y1 + 1, ea = Math.max(0, d1 - (up ? 6.4 : 5.2)), eb = Math.max(0, d2 - (up ? 5.2 : 6.4));
    const t = ea / Math.max(0.01, ea + eb), ts = (t + t * t * (3 - 2 * t)) / 2;
    const hb = y1 + (y2 - y1) * ts, wb = 1 - sstep(30, 46, d2);
    hc += (hb - hc) * wb; em += (Math.min(ea, eb) - em) * wb;
  }
  // Fels und Erde: unregelmäßige Hänge statt glatter Rampen
  hc += ((TER.fbm(x * 0.03 + 3, z * 0.03 + 7) - 0.5) * 9 + (TER.noise(x * 0.13, z * 0.13) - 0.5) * 2.2) * sstep(0.5, 9, em) * (1 + Math.min(3, em * 0.05));
  const out = h + (hc - h) * (1 - sstep(38, 48, d1));
  return h + (out - h) * f;
}
// das grobe Bergnetz sinkt unter dem feinen Netz weg
export function serpSink(x, z) {
  const P = SERP.patch; if (!P) return 0;
  const d = Math.min(x - P.x0, P.x1 - x, z - P.z0, P.z1 - z);
  return d <= 0 ? 0 : 45 * sstep(0, 40, d);
}
export function serpNear(x, z, r) {
  const B = SERP.box; if (!SERP.on || x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return false;
  const tp = SERP.tp, tc = SERP.tc, gx = Math.floor(x / tc), gz = Math.floor(z / tc), n = Math.ceil(r / tc);
  for (let a = gx - n; a <= gx + n; a++) for (let b = gz - n; b <= gz + n; b++) {
    const l = SERP.th.get(a * 100003 + b); if (!l) continue;
    for (const j of l) if ((tp[j * 4] - x) ** 2 + (tp[j * 4 + 1] - z) ** 2 < r * r) return true;
  }
  return false;
}
// Lage auf der Straße: nächster Abschnitt, Querabstand, Höhe
export function serpProject(x, z, y, maxLat) {
  const B = SERP.box; if (!SERP.on || x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return null;
  const l = SERP.hash.get(Math.floor(x / SERP.cell) * 100003 + Math.floor(z / SERP.cell)); if (!l) return null;
  let best = null, bl = maxLat;
  for (let k = 0; k < l.length; k += 2) {
    const R = SERP.roads[l[k]], i = l[k + 1], a = R.p[i], b = R.p[(i + 1) % R.p.length];
    const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2));
    const px = a.x + ex * t, pz = a.z + ez * t, py = a.y + (b.y - a.y) * t;
    if (y !== undefined && Math.abs(y - py) > 4.5) continue;
    const L = Math.sqrt(L2), nx = -ez / L, nz = ex / L, lat = (x - px) * nx + (z - pz) * nz;
    if (Math.abs(lat) < bl) { bl = Math.abs(lat); best = { R, i, t, lat, nx, nz, y: py, px, pz, tx: ex / L, tz: ez / L }; }
  }
  return best;
}
export function villaRoadAt(x, z, y) {
  const q = serpProject(x, z, y, SERP.HW + 0.45);
  return q ? { y: q.y + 0.06, mu: 1, road: true, serp: q } : null;
}
// Stützmauer und Brüstung: Wagen prallen ab, schrammen entlang
export function serpWallHit(B) {
  const q = serpProject(B.x, B.z, B.y, 7); if (!q || !q.R.walls) return;
  const side = q.lat > 0 ? 0 : 1, sg = q.lat > 0 ? 1 : -1;
  const i = q.t < 0.5 ? q.i : Math.min(q.R.p.length - 1, q.i + 1);
  if (!q.R.wf[side][i]) return;
  const fx = Math.cos(B.h), fz = -Math.sin(B.h);
  const ext = B.hl * Math.abs(fx * q.nx + fz * q.nz) + B.hw * Math.abs(fx * q.tx + fz * q.tz);
  const lim = 3.82 - ext, over = Math.abs(q.lat) - lim;
  if (over <= 0) return;
  B.x -= q.nx * sg * over; B.z -= q.nz * sg * over;
  const nx = -q.nx * sg, nz = -q.nz * sg, px = B.x - nx * ext, pz = B.z - nz * ext;
  const vt = Math.abs(B.vx * q.tx + B.vz * q.tz);
  const j = impulse(B, null, nx, nz, px, pz, 0.2);
  if (j > 0) crashDamage(B, px, pz, j, vt);
  else if (vt > 3 && Math.random() < 0.5) fxEmit('spark', px, B.y + 0.6, pz, 0, 1, 0, 2, 1);
}

/* ---------- Bau ---------- */
// Bogenpflaster aus Granit: Fächer aus kleinen Steinen
export function settTex() {
  const t = canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(4711);
    g.fillStyle = '#26272a'; g.fillRect(0, 0, W, H);
    for (let row = -1; row < 7; row++) for (let col = -1; col < 6; col++) {
      const cx = col * 112 + (row % 2 ? 56 : 0), cy = row * 80 + 80;
      for (let r = 108; r > 6; r -= 12) {
        const n = Math.max(3, Math.round(r * 1.05 / 11));
        for (let k = 0; k < n; k++) {
          const a = -1.0 + (k + 0.5) / n * 2.0, x = cx + Math.sin(a) * r, y = cy - Math.cos(a) * r;
          const v = 0.62 + rr() * 0.4, warm = rr() < 0.2 ? 10 : 0;
          g.save(); g.translate(x, y); g.rotate(a);
          g.fillStyle = `rgb(${Math.round(102 * v + warm)},${Math.round(100 * v + warm * 0.6)},${Math.round(98 * v)})`;
          g.beginPath(); g.roundRect ? g.roundRect(-5, -5, 10, 10, 2.5) : g.rect(-5, -5, 10, 10); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-4, -4, 7, 2);
          g.restore();
        }
      }
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 8;
  return t;
}
// Querschnitt längs der Straße ziehen (lat seitlich, dy in der Höhe); prof darf je Punkt anders sein
export function serpSweep(R, i0, i1, sg, prof, uS, out) {
  const pos = [], uv = [], idx = [], n = R.p.length;
  let np = 0;
  for (let i = i0; i <= i1; i++) {
    const q = R.p[i % n], pr = typeof prof === 'function' ? prof(i % n) : prof;
    np = pr.length;
    let u = 0;
    for (let k = 0; k < np; k++) {
      if (k) u += Math.hypot(pr[k][0] - pr[k - 1][0], pr[k][1] - pr[k - 1][1]);
      pos.push(q.x + q.nx * pr[k][0] * sg, q.y + pr[k][1], q.z + q.nz * pr[k][0] * sg);
      uv.push(u / uS, (i === n && R.closed ? R.len : q.s) / uS);
    }
  }
  for (let i = 0; i < i1 - i0; i++) for (let k = 0; k < np - 1; k++) { const a = i * np + k, b = a + np; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  out.push(g);
}
export function buildSerpentine() {
  if (!SERP.on) return;
  const M = SERP.roads[0], by = VILLA.y, HW = SERP.HW;
  // Mauer oder Brüstung: Gelände neben der Fahrbahn entscheidet
  for (const R of SERP.roads) {
    if (!R.walls) continue;
    for (let sd = 0; sd < 2; sd++) {
      const sg = sd ? -1 : 1, raw = new Int8Array(R.p.length);
      R.p.forEach((q, i) => {
        if (q.alley || q.x < 8.6) return;
        const t = terrainHeight(q.x + q.nx * sg * 7.5, q.z + q.nz * sg * 7.5), t2 = terrainHeight(q.x + q.nx * sg * 8.2, q.z + q.nz * sg * 8.2);
        raw[i] = t > q.y + 1.3 ? 2 : t < q.y - 0.9 ? 1 : 0;
        R.wh[sd][i] = Math.max(1.2, Math.min(7.5, t2 - q.y + 0.4));
      });
      // kurze Wechsel glätten
      for (let i = 0; i < raw.length; i++) {
        const c = [0, 0, 0]; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < raw.length) c[raw[j]]++; }
        R.wf[sd][i] = c[2] >= c[1] && c[2] >= c[0] ? 2 : c[1] >= c[0] ? 1 : 0;
        if (M.p[i] && M.p[i].x < 8.6) R.wf[sd][i] = 0;
      }
      for (let i = 0; i < raw.length; i++) if (R.p[i].x < 30 && R.p[i].s < 30) R.wf[sd][i] = 1; // Brücke an der Abzweigung
      const wh = R.wh[sd].slice(); for (let i = 2; i < wh.length - 2; i++) R.wh[sd][i] = (wh[i - 2] + wh[i - 1] + wh[i] + wh[i + 1] + wh[i + 2]) / 5;
    }
  }
  // Materialien
  const sett = settTex(); sett.repeat.set(1, 1);
  const roadM = stdMat({ map: sett, color: 0xa4a29e, roughness: 0.78, metalness: 0.02, envI: 0.35, side: T.DoubleSide });
  const st = stoneTex(); st.wrapS = st.wrapT = T.RepeatWrapping;
  const wallM = stdMat({ map: st, color: 0xb0a898, roughness: 0.9, envI: 0.2, side: T.DoubleSide });
  const capM = stdMat({ color: 0xa89a80, roughness: 0.65, envI: 0.2, emissive: 0x0d0904, side: T.DoubleSide });
  const curbM = stdMat({ color: 0x8e8c88, roughness: 0.7, envI: 0.3, side: T.DoubleSide });
  const road = [], walls = [], caps = [], curbsG = [];
  const posts = [], guards = [], piers = [];
  for (const R of SERP.roads) {
    const n = R.p.length, ri = SERP.roads.indexOf(R), [rcx, rcz] = SERP.RC, rOut = SERP.Rr + HW - 0.2;
    let last = R.closed ? n : n - 1;
    if (R === M) while (last > 0 && Math.hypot(R.p[last].x - rcx, R.p[last].z - rcz) < rOut) last--;
    const gapA = ri === 1 ? [Math.atan2(M.p[M.p.length - 1].z - rcz, M.p[M.p.length - 1].x - rcx), Math.atan2(SERP.roads[2].p[1].z - rcz, SERP.roads[2].p[1].x - rcx)] : null;
    // Fahrbahn: am Viadukt an dessen Neigung angepasst
    serpSweep(R, 0, last, 1, i => { const q = R.p[i]; if (q.x < 9 && R === M) { const a = deckY(q.z - q.nz * HW) + 0.05 - q.y, b = deckY(q.z + q.nz * HW) + 0.05 - q.y; return [[-HW, a], [HW, b]]; } return [[-HW, 0.06], [HW, 0.06]]; }, 4.5, road);
    for (const sg of [1, -1]) {
      const sd = sg > 0 ? 0 : 1;
      // Bordstein überall (außer am Viadukt)
      let a = -1;
      const flush = (i0, i1, kind) => {
        if (i1 <= i0) return;
        if (kind === 0) serpSweep(R, i0, i1, sg, [[HW - 0.05, 0.06], [HW - 0.05, 0.2], [HW + 0.32, 0.2], [HW + 0.32, -0.8]], 2, curbsG);
        else if (kind === 1) {
          serpSweep(R, i0, i1, sg, [[HW - 0.05, 0.06], [HW - 0.05, 0.2], [HW + 0.32, 0.2], [HW + 0.32, 0.95], [HW + 0.85, 0.95], [HW + 0.85, -3.2]], 2.5, walls);
          serpSweep(R, i0, i1, sg, [[HW + 0.24, 0.95], [HW + 0.24, 1.1], [HW + 0.94, 1.1], [HW + 0.94, 0.95]], 1.5, caps);
        } else {
          serpSweep(R, i0, i1, sg, i => { const H = R.wh[sd][i]; return [[HW - 0.05, 0.06], [HW - 0.05, 0.2], [HW + 0.32, 0.2], [HW + 0.32, H], [HW + 3.4, H], [HW + 3.4, -0.5]]; }, 3, walls);
          serpSweep(R, i0, i1, sg, i => { const H = R.wh[sd][i]; return [[HW + 0.2, H], [HW + 0.2, H + 0.28], [HW + 0.75, H + 0.28], [HW + 0.75, H]]; }, 1.5, caps);
        }
      };
      const kindAt = i => {
        if (R === M && R.p[i].x < 8.6) return -1;
        if (gapA && sg < 0) { const a = Math.atan2(R.p[i].z - rcz, R.p[i].x - rcx); for (const g of gapA) if (Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < 0.27) return -1; }
        return R.walls ? R.wf[sd][i] : 0;
      };
      let cur = kindAt(0); a = 0;
      for (let i = 1; i <= last; i++) {
        const k = i < n ? kindAt(i) : kindAt(0);
        if (k !== cur || i === last) { if (cur >= 0) flush(a, i, cur); a = i; cur = k; }
      }
      // Pfeiler auf der Brüstung mit Laternen, Prellsteine an offenen Kanten, Pfeiler der Mauer
      if (!R.walls) continue;
      let lastPost = -99, lastGuard = -99, lastLamp = -99;
      R.p.forEach((q, i) => {
        const k = R.wf[sd][i]; if (q.alley || q.x < 8.6) return;
        const ox = q.x + q.nx * sg * (HW + 0.58), oz = q.z + q.nz * sg * (HW + 0.58);
        if (k === 1 && q.s - lastPost > 12) { lastPost = q.s; posts.push([ox, q.y + 0.65, oz]); if (q.s - lastLamp > 36) { lastLamp = q.s; lamps.push({ x: q.x + q.nx * sg * (HW + 1.55), z: q.z + q.nz * sg * (HW + 1.55), h: 5.2, y: q.y + 0.04 }); } }
        if (k === 2 && q.s - lastPost > 9) { lastPost = q.s; posts.push([q.x + q.nx * sg * (HW + 0.5), q.y + R.wh[sd][i] / 2, q.z + q.nz * sg * (HW + 0.5), R.wh[sd][i]]); }
        if (k === 0 && q.s - lastGuard > 5) { lastGuard = q.s; guards.push([q.x + q.nx * sg * (HW + 0.75), q.y, q.z + q.nz * sg * (HW + 0.75)]); }
      });
    }
  }
  // Brückenpfeiler an der Abzweigung
  for (const q of M.p) if (q.x > 12 && q.x < 30 && Math.abs(q.x - 14) < 1 || Math.abs(q.x - 24) < 1 && q.s < 30) piers.push(q);
  const merged = (list, mat) => { if (!list.length) return; const m = new T.Mesh(mergeGeos(list), mat); m.frustumCulled = false; m.receiveShadow = true; scene.add(m); return m; };
  merged(road, roadM); merged(walls, wallM); merged(caps, capM); merged(curbsG, curbM);
  // Pfeiler, Prellsteine
  const pp = [];
  for (const [x, y, z, H] of posts) {
    if (H) pp.push(new T.BoxGeometry(0.8, H, 0.8).translate(x, y, z));
    else { pp.push(new T.BoxGeometry(0.7, 1.3, 0.7).translate(x, y, z), new T.BoxGeometry(0.86, 0.12, 0.86).translate(x, y + 0.7, z)); }
  }
  for (const [x, y, z] of guards) pp.push(new T.CylinderGeometry(0.16, 0.24, 0.75, 8).translate(x, y + 0.37, z), new T.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y + 0.75, z));
  for (const q of piers) {
    const base = Math.min(terrainHeight(q.x, q.z), WATER_Y) - 18;
    pp.push(new T.BoxGeometry(2.4, q.y - base, 8.6).translate(q.x, (q.y + base) / 2 - 0.4, q.z));
  }
  merged(pp, capM);

  // ---------- Allee: Zypressen, Laternen, Hecken ----------
  const hedgeM = stdMat({ map: HEDGE_TEX.map, normalMap: HEDGE_TEX.normal, roughnessMap: HEDGE_TEX.rough, color: 0xb0c0a8, roughness: 1, envI: 0.15, emissive: 0x0a140a, emissiveMap: HEDGE_TEX.map });
  const hedges = [];
  const al = M.p.filter(q => q.alley), gateI = Math.floor(al.length * 0.42);
  al.forEach((q, i) => {
    if (i < 3 || i > al.length - 4 || Math.abs(i - gateI) < 7) return;
    for (const sg of [1, -1]) {
      if (i % 4 === 0) trees.push({ x: q.x + q.nx * sg * 6.6, z: q.z + q.nz * sg * 6.6, y: q.y + 0.1, s: 1.15, sp: 'cyp' });
      if (i % 8 === 2) lamps.push({ x: q.x + q.nx * sg * 4.6, z: q.z + q.nz * sg * 4.6, h: 4.8, y: q.y + 0.05 });
      const a = Math.atan2(-q.nx, q.nz);
      hedges.push(new T.BoxGeometry(2.3, 1.1, 0.9).rotateY(a).translate(q.x + q.nx * sg * 5.4, q.y + 0.6, q.z + q.nz * sg * 5.4));
    }
  });
  // Zypressen in den Kehren
  M.p.forEach((q, i) => {
    if (q.w !== 0.55 || i % 9 || q.alley) return;
    const c = M.p[i];
    for (const d of [-8, -13]) { const x = c.x + c.nx * d, z = c.z + c.nz * d; if (serpNear(x, z, 4.6)) continue; trees.push({ x, z, y: terrainHeight(x, z) - 0.2, s: 0.8 + (i % 3) * 0.12, sp: 'cyp' }); }
  });
  merged(hedges, hedgeM);
  // Bäume und Zypressen verstreut am Hang zwischen den Kehren
  { const rr = mulberry32(31337), B = SERP.box; let n = 0;
    for (let k = 0; k < 4000 && n < (MOBILE ? 140 : 320); k++) {
      const x = B.x0 + 40 + rr() * (B.x1 - B.x0 - 80), z = B.z0 + 40 + rr() * (B.z1 - B.z0 - 80);
      if (serpNear(x, z, 8.5) || !serpNear(x, z, 45) || Math.hypot(x - VILLA.x, z - VILLA.z) < VILLA.r) continue;
      const y = terrainHeight(x, z); if (y < WATER_Y + 2) continue;
      const sl = Math.abs(terrainHeight(x + 2, z) - y) + Math.abs(terrainHeight(x, z + 2) - y); if (sl > 5) continue;
      trees.push({ x, z, y: y - 0.3, s: 0.7 + rr() * 0.5, sp: rr() < 0.6 ? 'cyp' : undefined }); n++;
    } }

  // ---------- Prunktor: gestufte Pylonen mit Goldkrone, Bogen mit Goldfächer, offene Gitterflügel ----------
  const G = al[gateI], ga = Math.atan2(-G.nz, G.nx), gy = G.y;
  const gate = [], gold = [], cap2 = [];
  const tx = G.nz, tz = -G.nx;   // Fahrtrichtung
  const at = (lat, fw) => [G.x + G.nx * lat + tx * fw, G.z + G.nz * lat + tz * fw];
  const put = (arr, g, lat, y, fw, rot = 0) => { const [x, z] = at(lat, fw); arr.push(g.rotateY(ga + rot).translate(x, gy + y, z)); };
  for (const sg of [-1, 1]) {
    const L = sg * 5.6;
    put(gate, new T.BoxGeometry(2.6, 7.4, 2.6), L, 3.7, 0);
    put(gate, new T.BoxGeometry(3.0, 0.5, 3.0), L, 0.25, 0);
    put(gate, new T.BoxGeometry(2.1, 1.8, 2.1), L, 8.3, 0);
    put(gate, new T.BoxGeometry(1.5, 1.2, 1.5), L, 9.8, 0);
    put(gold, new T.ConeGeometry(0.7, 2.0, 4), L, 11.4, 0, Math.PI / 4);
    put(gold, new T.SphereGeometry(0.28, 12, 8), L, 12.5, 0);
    for (const f of [-1, 1]) for (const o of [-0.7, 0, 0.7]) put(gold, new T.BoxGeometry(0.1, 6.2, 0.06), L + o, 3.9, f * 1.31);
    put(gold, new T.BoxGeometry(2.7, 0.14, 2.7), L, 7.42, 0);
    { const [x, z] = at(L, 0); addGlow(x, gy + 12.6, z, [1.4, 1.0, 0.55], 2.6); }
    // geschwungene Flügelmauern mit Urnen
    for (let k = 0; k < 7; k++) {
      const a0 = k / 7 * Math.PI / 2, a1 = (k + 1) / 7 * Math.PI / 2, rA = 7;
      const p0 = [sg * (6.9 + rA - rA * Math.cos(a0)), -rA * Math.sin(a0)], p1 = [sg * (6.9 + rA - rA * Math.cos(a1)), -rA * Math.sin(a1)];
      const mx = (p0[0] + p1[0]) / 2, mf = (p0[1] + p1[1]) / 2, len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.1, ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      put(gate, new T.BoxGeometry(len, 2.2, 0.6), mx, 1.1, mf, ang);
      put(cap2, new T.BoxGeometry(len + 0.1, 0.18, 0.8), mx, 2.28, mf, ang);
    }
    put(cap2, new T.BoxGeometry(1.0, 2.6, 1.0), sg * 13.9, 1.3, -7);
    put(gold, new T.SphereGeometry(0.42, 12, 8).scale(1, 1.3, 1), sg * 13.9, 3.05, -7);
    // Gitterflügel, nach innen geöffnet
    const leaf = [];
    for (let b = 0; b < 9; b++) { const lx = 0.2 + b * 0.37; leaf.push(new T.CylinderGeometry(0.035, 0.035, 3.4, 5).translate(lx, 1.7, 0)); leaf.push(new T.ConeGeometry(0.07, 0.3, 5).translate(lx, 3.55, 0)); }
    leaf.push(new T.BoxGeometry(3.3, 0.08, 0.08).translate(1.65, 0.4, 0), new T.BoxGeometry(3.3, 0.08, 0.08).translate(1.65, 3.0, 0), new T.TorusGeometry(0.8, 0.04, 6, 20, Math.PI).translate(1.65, 1.6, 0));
    const lg = mergeGeos(leaf);
    if (sg > 0) lg.scale(-1, 1, 1);
    lg.rotateY(-sg * 1.35).translate(sg * 4.3, 0, 0);
    { const [x, z] = at(0, 0); lg.rotateY(ga).translate(x, gy, z); gold.push(lg); }
  }
  // Bogen über der Einfahrt mit Goldfächer (Sonnenaufgang)
  put(gate, new T.BoxGeometry(13.8, 1.0, 1.0), 0, 7.9, 0);
  put(gold, new T.BoxGeometry(13.9, 0.12, 1.06), 0, 7.42, 0);
  put(gold, new T.BoxGeometry(13.9, 0.12, 1.06), 0, 8.42, 0);
  for (let k = 0; k <= 12; k++) { const a = -Math.PI / 2 + k / 12 * Math.PI, L = k % 2 ? 2.2 : 3.0; const g = new T.BoxGeometry(0.11, L, 0.08).translate(0, L / 2 + 0.3, 0).rotateZ(a); put(gold, g, 0, 8.45, 0); }
  put(gold, new T.TorusGeometry(3.3, 0.09, 6, 32, Math.PI), 0, 8.45, 0);
  put(gold, new T.CircleGeometry(0.7, 20, 0, Math.PI), 0, 8.46, 0.05);
  { const [x, z] = at(0, 0); addGlow(x, gy + 10, z, [1.3, 0.95, 0.5], 4); }
  for (const sg of [-1, 1]) for (const fw of [-4, 4]) { const [x, z] = at(sg * 5.6, fw); lamps.push({ x, z, h: 4.4, y: gy + 0.05 }); }
  merged(gate, stdMat({ color: 0x24262b, roughness: 0.35, metalness: 0.15, envI: 0.8 })); merged(cap2, capM); merged(gold, MAT.gold);
  // Kollision der Pylonen und Flügelmauern
  for (const sg of [-1, 1]) { const [x, z] = at(sg * 5.6, 0); addCollider(x - 1.4, gy - 1, z - 1.4, x + 1.4, gy + 9, z + 1.4); }

  // ---------- Rondell: Brunnenbecken, Goldkugel, Fontäne, Blumen ----------
  const [rx, rz] = SERP.RC, ry0 = by;
  const fount = [], fgold = [];
  fount.push(new T.CylinderGeometry(7.2, 7.5, 0.9, 48).translate(rx, ry0 + 0.45, rz));
  fgold.push(new T.TorusGeometry(7.2, 0.14, 6, 64).rotateX(Math.PI / 2).translate(rx, ry0 + 0.92, rz));
  for (const [r, h, y] of [[2.0, 1.2, 0.9], [1.2, 1.6, 2.1], [0.6, 1.8, 3.7]]) fount.push(new T.CylinderGeometry(r * 0.75, r, h, 24).translate(rx, ry0 + y + h / 2, rz));
  for (const [r, y] of [[2.6, 2.05], [1.7, 3.65]]) fount.push(new T.CylinderGeometry(r, r * 0.6, 0.3, 32).translate(rx, ry0 + y, rz));
  fgold.push(new T.SphereGeometry(0.75, 20, 14).translate(rx, ry0 + 6.2, rz));
  const water = new T.Mesh(new T.CylinderGeometry(6.8, 6.8, 0.1, 48), poolWaterMat([0.04, 0.38, 0.42]));
  water.position.set(rx, ry0 + 0.82, rz); scene.add(water);
  fountainJet(rx, ry0 + 6.6, rz, 2.4, 0.55);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; addGlow(rx + Math.cos(a) * 6.2, ry0 + 0.95, rz + Math.sin(a) * 6.2, NEON.teal, 1.0); }
  // Blumenring zwischen Becken und Fahrbahn
  const bed = new T.Mesh(new T.RingGeometry(7.5, SERP.Rr - HW - 0.3, 48).rotateX(-Math.PI / 2), stdMat({ color: 0x2c4a2c, roughness: 0.95, envI: 0.1, emissive: 0x050a05 }));
  bed.position.set(rx, ry0 + 0.12, rz); scene.add(bed);
  for (let k = 0; k < 60; k++) { const a = k / 60 * Math.PI * 2, r = 8.2 + (k % 3) * 0.6; addGlow(rx + Math.cos(a) * r, ry0 + 0.45, rz + Math.sin(a) * r, k % 2 ? [1.3, 0.5, 0.45] : [1.25, 1.0, 0.55], 0.32); }
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + 0.2, r = SERP.Rr + HW + 1.2; lamps.push({ x: rx + Math.cos(a) * r, z: rz + Math.sin(a) * r, h: 4.8, y: ry0 + 0.05 }); }
  merged(fount, capM); merged(fgold, MAT.gold);
  addCollider(rx - 7.4, ry0, rz - 7.4, rx + 7.4, ry0 + 1.0, rz + 7.4);
  // Rondellboden unter der Fahrbahn (falls das Gelände leicht abweicht)
  const disc = new T.Mesh(new T.CircleGeometry(SERP.Rr + HW + 0.5, 48).rotateX(-Math.PI / 2), stdMat({ color: 0x3a3936, roughness: 0.9, envI: 0.1 }));
  disc.position.set(rx, ry0 - 0.02, rz); scene.add(disc);

  // Wegweiser an der Abzweigung: zwei Pylonen mit Goldkugeln, Laternen
  const J = M.p[Math.max(0, M.p.findIndex(q => q.x > 10))];
  for (const sg of [-1, 1]) { const x = J.x + J.nx * sg * (HW + 0.9), z = J.z + J.nz * sg * (HW + 0.9); const g = [new T.BoxGeometry(1.1, 3.2, 1.1).translate(x, J.y + 1.6, z), new T.BoxGeometry(1.3, 0.2, 1.3).translate(x, J.y + 3.25, z)]; merged(g, capM); merged([new T.SphereGeometry(0.4, 12, 8).translate(x, J.y + 3.75, z)], MAT.gold); addGlow(x, J.y + 3.8, z, [1.4, 1.0, 0.55], 1.6); }
  buildSerpTraffic();
}

/* ---------- feines Geländenetz über der Serpentine (gleiches Material wie das Gebirge) ---------- */
export function buildSerpTerrain(mat) {
  const P = SERP.patch; if (!P) return;
  const step = MOBILE ? 5 : 3, nx = Math.ceil((P.x1 - P.x0) / step), nz = Math.ceil((P.z1 - P.z0) / step);
  const g = new T.PlaneGeometry(P.x1 - P.x0, P.z1 - P.z0, nx, nz); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + (P.x0 + P.x1) / 2, z = pos.getZ(i) + (P.z0 + P.z1) / 2;
    pos.setXYZ(i, x, terrainHeight(x, z), z);
  }
  g.computeVertexNormals();
  const m = new T.Mesh(g, mat); m.frustumCulled = false; scene.add(m);
}

/* ---------- Verkehr: Gäste fahren zur Villa hinauf und wieder hinunter ---------- */
export function buildSerpTraffic() {
  const M = SERP.roads[0], zJ = SERP.zJ, pts = [];
  const add = (x, z, y) => { const l = pts[pts.length - 1]; if (l && Math.hypot(x - l[0], z - l[2]) < 0.5) return; pts.push([x, y, z]); };
  const bez = (a, da, b, db, k) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.5) + 2; for (let i = 1; i < n; i++) { const t = i / n, u = 1 - t; const c1 = [a[0] + da[0] * k, a[2] + da[1] * k], c2 = [b[0] - db[0] * k, b[2] - db[1] * k]; add(u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0], u * u * u * a[2] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[2], a[1] + (b[1] - a[1]) * t); } };
  const zIn = -1560, iS = M.p.findIndex(q => q.s > 14), iE = M.p.length - 1;
  const off = (q, o) => [q.x + q.nx * o, q.y + 0.02, q.z + q.nz * o];
  const tan = q => [-q.nz, q.nx];
  for (let z = zIn; z < zJ - 11; z += 2) add(-3.5, z, deckY(z));
  bez([-3.5, deckY(zJ - 11), zJ - 11], [0, 1], off(M.p[iS], 1.75), tan(M.p[iS]), 7);
  for (let i = iS; i <= iE; i++) { const p = off(M.p[i], 1.75); add(p[0], p[2], p[1]); }
  // Rondell im Kreis (rechts herum), zurück zur Allee
  const [rx, rz] = SERP.RC, eU = off(M.p[iE], 1.75), eD = off(M.p[iE], -1.75), q = M.p[iE];
  const a0 = Math.atan2(eU[2] - rz, eU[0] - rx), a1 = Math.atan2(eD[2] - rz, eD[0] - rx);
  const sgn = (-Math.sin(a0) * q.nx + Math.cos(a0) * q.nz) > 0 ? 1 : -1;
  let da = sgn > 0 ? a1 - a0 : a0 - a1; da = ((da % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  for (let k = 1; k < 60; k++) { const t = k / 60, a = a0 + sgn * da * t, r = SERP.Rr + 1.75 * Math.sin(Math.PI * Math.min(1, t * 4, (1 - t) * 4) / 2); add(rx + Math.cos(a) * r, rz + Math.sin(a) * r, VILLA.y + 0.02); }
  for (let i = iE; i >= iS; i--) { const p = off(M.p[i], -1.75); add(p[0], p[2], p[1]); }
  const tq = tan(M.p[iS]);
  bez(off(M.p[iS], -1.75), [-tq[0], -tq[1]], [3.5, deckY(zJ - 11), zJ - 11], [0, -1], 7);
  for (let z = zJ - 11; z > zIn; z -= 2) add(3.5, z, deckY(z));
  // Länge, Krümmung, Wunschtempo
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]));
  const n = pts.length, v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[i], c = pts[Math.min(n - 1, i + 2)];
    const ab = Math.hypot(b[0] - a[0], b[2] - a[2]), bc = Math.hypot(c[0] - b[0], c[2] - b[2]), ca = Math.hypot(a[0] - c[0], a[2] - c[2]);
    const cr = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
    const Rc = cr < 1e-6 ? 1e4 : ab * bc * ca / (2 * cr);
    v[i] = Math.max(4.5, Math.min(13, Math.sqrt(2.6 * Rc)));
  }
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] ** 2 + 2 * 2.4 * (cum[i + 1] - cum[i])));
  for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] ** 2 + 2 * 1.4 * (cum[i] - cum[i - 1])));
  const L = { path: true, pts, cum, len: cum[n - 1] + 7, v };
  SERP.lane = L;
  const N = MOBILE ? 4 : 7;
  for (let k = 0; k < N; k++) { const car = { l: L, s: (k + Math.random() * 0.4) / N * L.len, v: 6, yaw: 0, k: 0.88 + Math.random() * 0.16, serpCar: true }; cars.push(car); SERP.cars.push(car); }
}
export function serpLaneAt(L, s) {
  s = ((s % L.len) + L.len) % L.len;
  const n = L.pts.length;
  if (s >= L.cum[n - 1]) { const a = L.pts[n - 1], b = L.pts[0], t = (s - L.cum[n - 1]) / 7; return [a[0] + (b[0] - a[0]) * t, a[1], a[2] + (b[2] - a[2]) * t, 0, -1, 0, 4]; }
  let lo = 1, hi = n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (L.cum[m] < s) lo = m + 1; else hi = m; }
  const a = L.pts[lo - 1], b = L.pts[lo], d = (L.cum[lo] - L.cum[lo - 1]) || 1, t = (s - L.cum[lo - 1]) / d;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, (b[0] - a[0]) / d, (b[2] - a[2]) / d, (b[1] - a[1]) / d, L.v[lo - 1] + (L.v[lo] - L.v[lo - 1]) * t];
}
export function serpCarStep(car, dt) {
  const L = car.l, q = serpLaneAt(L, car.s);
  let vt = q[6] * car.k;
  // Spielerwagen, Unfallwagen und andere Gäste vor der Haube
  const hx = q[3], hz = q[4];
  for (const ob of OBSTACLES) {
    const rx = ob.x - q[0], rz = ob.z - q[2], al = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx);
    if (al > 0 && al < 18 && lat < 2.6 && Math.abs((ob.y || 0) - q[1]) < 2.5) vt = Math.min(vt, Math.max(0, (al - 6) * 0.6));
  }
  for (const o of SERP.cars) { if (o === car) continue; let ds = o.s - car.s; if (ds < 0) ds += L.len; if (ds < 22) vt = Math.min(vt, Math.max(0, (ds - 7) * 0.7)); }
  car.v += Math.max(-6 * dt, Math.min(1.8 * dt, vt - car.v));
  car.s = (car.s + Math.max(0, car.v) * dt) % L.len;
  const p = serpLaneAt(L, car.s);
  car.wx = p[0]; car.wz = p[2]; car.wy = p[1];
  const ty = Math.atan2(-p[4], p[3]);
  let dy = ty - car.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  car.yaw += dy * Math.min(1, dt * 7);
  car.pitch = Math.atan(p[5]);
}
// R am Steuer: auf der Serpentine zurück auf die eigene Spur
export function serpReset(B) {
  const q = serpProject(B.x, B.z, undefined, 60); if (!q) return false;
  const fwd = Math.cos(B.h) * q.tx - Math.sin(B.h) * q.tz >= 0 ? 1 : -1;
  B.x = q.px + q.nx * 1.75 * fwd; B.z = q.pz + q.nz * 1.75 * fwd; B.h = Math.atan2(-q.tz * fwd, q.tx * fwd);
  return q.y + 0.06;
}

export function stoneTex() {
  return canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(99);
    g.fillStyle = '#16191c'; g.fillRect(0, 0, W, H);
    const bh = 32;
    for (let y = 0; y < H; y += bh) for (let x = (y / bh % 2) * 40 - 40; x < W; x += 80) {
      const v = 0.75 + rr() * 0.45;
      g.fillStyle = `rgb(${Math.round(78 * v)},${Math.round(76 * v)},${Math.round(74 * v)})`;
      g.fillRect(x + 2, y + 2, 76, bh - 4);
      g.fillStyle = 'rgba(0,0,0,' + (0.15 * rr()) + ')'; g.fillRect(x + 2, y + bh - 9, 76, 7);
    }
  });
}
export function buildAccessRoad() {
  const z0 = ROAD_Z0, pz = VIA.portalZ;
  const groundAt = z => z > -1040 ? 0 : terrainHeight(0, z);
  const st = stoneTex(); st.wrapS = st.wrapT = T.RepeatWrapping; st.repeat.set(1 / 7, 1 / 3.5);
  const stoneM = stdMat({ map: st, color: 0x8f949a, roughness: 0.85, metalness: 0.02, envI: 0.25 });
  const parts = [], piers = [];
  // Pfeilerstellungen: kurze Bögen an der Rampe, weite Bögen über dem Tal
  const cuts = [z0];
  for (let z = z0; z > pz + 4;) {
    const H = deckY(z) - groundAt(z);
    const L = H < 10 ? 16 : H < 50 ? 26 : 38;
    z = Math.max(pz + 4, z - L); cuts.push(z);
  }
  const frustum = (h, bw, bd, tw, td) => {
    const g = new T.BoxGeometry(1, 1, 1), q = g.attributes.position;
    for (let i = 0; i < q.count; i++) { const top = q.getY(i) > 0; q.setXYZ(i, q.getX(i) * (top ? tw : bw), (q.getY(i) + 0.5) * h, q.getZ(i) * (top ? td : bd)); }
    g.computeVertexNormals(); return g;
  };
  const slope = Math.atan(VIA.grade);
  for (let i = 0; i < cuts.length; i++) {
    const zc = cuts[i], top = deckY(zc) - 1.2, base = Math.min(groundAt(zc), groundAt(zc + 6), groundAt(zc - 6)) - 3;
    const H = top - base, pw = 2.6 + H * 0.025;
    if (H > 1) {
      const p = frustum(H, ROAD_W + 2 + H * 0.06, pw * 1.25, ROAD_W + 1, pw);
      p.translate(0, base, zc); parts.push(p);
      piers.push([zc, base, top, pw]);
    }
    if (i === cuts.length - 1) break;
    // Bogenzwickel zwischen zwei Pfeilern
    const za = zc, zb = cuts[i + 1], r = (za - zb - pw) / 2, c = (za + zb) / 2;
    const ua = deckY(za) - 1.2, ub = deckY(zb) - 1.2, spring = Math.min(ua, ub) - r - 1.4;
    const sh = new T.Shape();
    sh.moveTo(za, ua); sh.lineTo(zb, ub); sh.lineTo(zb, spring); sh.lineTo(c - r, spring);
    for (let k = 1; k < 24; k++) { const a = Math.PI - k / 24 * Math.PI; sh.lineTo(c + Math.cos(a) * r, spring + Math.sin(a) * r); }
    sh.lineTo(c + r, spring); sh.lineTo(za, spring); sh.closePath();
    const eg = new T.ExtrudeGeometry(sh, { depth: ROAD_W + 1, bevelEnabled: false, curveSegments: 1 });
    eg.rotateY(-Math.PI / 2); eg.translate(ROAD_W / 2 + 0.5, 0, 0);
    parts.push(eg);
    // Fahrbahnplatte mit Gesims und Brüstung
    const L = za - zb, mz = c, my = deckY(c);
    parts.push(new T.BoxGeometry(ROAD_W + 2.2, 1.3, L + 0.05).rotateX(slope).translate(0, my - 0.65, mz));
    for (const sd of [-1, 1]) {
      const g0 = SERP.zJ - 5.2, g1 = SERP.zJ + 5.2;
      const pieces = sd > 0 && SERP.on && zb < g1 && za > g0 ? [[zb, g0], [g1, za]].filter(([a, b]) => b - a > 0.3) : [[zb, za]];
      for (const [a, b] of pieces) { const c2 = (a + b) / 2; parts.push(new T.BoxGeometry(0.55, 1.15, b - a + 0.05).rotateX(slope).translate(sd * (ROAD_W / 2 + 0.55), deckY(c2) + 0.55, c2)); }
    }
  }
  // Tunnel: gekacheltes Gewölbe, Profil entlang der Steigung
  const tileT = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#5a5246'; g.fillRect(0, 0, W, H);
    const rr = mulberry32(5);
    for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 64) { const v = 0.85 + rr() * 0.2; g.fillStyle = `rgb(${Math.round(196 * v)},${Math.round(184 * v)},${Math.round(160 * v)})`; g.fillRect(x + 2, y + 2, 60, 28); }
    g.fillStyle = '#7a5a2a'; g.fillRect(0, 120, W, 16);
  });
  tileT.wrapS = tileT.wrapT = T.RepeatWrapping; tileT.repeat.set(1 / 4, 1 / 4);
  const tileM = stdMat({ map: tileT, color: 0xb0a690, roughness: 0.45, metalness: 0, envI: 0.5, emissive: 0x0a0806 });
  const prof = new T.Shape();
  prof.moveTo(-11, -1.5); prof.lineTo(11, -1.5); prof.lineTo(11, 16); prof.lineTo(-11, 16); prof.closePath();
  const hole = new T.Path(); hole.moveTo(-8, 0); hole.lineTo(8, 0); hole.lineTo(8, 4.5);
  for (let k = 1; k < 20; k++) { const a = k / 20 * Math.PI; hole.lineTo(Math.cos(a) * 8, 4.5 + Math.sin(a) * 8); }
  hole.lineTo(-8, 4.5); hole.closePath(); prof.holes.push(hole);
  const tunnelParts = [];
  for (let z = pz + 2; z > VIA.end; z -= 20) {
    const L = Math.min(20, z - VIA.end), mz = z - L / 2;
    const tg = new T.ExtrudeGeometry(prof, { depth: L + 0.05, bevelEnabled: false, curveSegments: 1 });
    tg.translate(0, 0, -L / 2); tg.rotateX(slope); tg.translate(0, deckY(mz) - 0.02, mz);
    tunnelParts.push(tg);
    for (const sd of [-1, 1]) addCollider(sd > 0 ? 7.6 : -9, deckY(z) - 2, mz - L / 2, sd > 0 ? 9 : -7.6, deckY(z) + 14, mz + L / 2);
    addCollider(-9, deckY(z) + 11.5, mz - L / 2, 9, deckY(z) + 14, mz + L / 2);
    for (const sd of [-1, 1]) addGlow(sd * 7.4, deckY(mz) + 6.2, mz, [1.3, 0.95, 0.55], 1.6);
    addNeon(0, deckY(mz) + 12.35, mz, 0.5, 0.12, L * 0.8, [1.1, 0.85, 0.5]);
  }
  addCollider(-9, deckY(VIA.end) - 2, VIA.end - 4, 9, deckY(VIA.end) + 14, VIA.end + 0.5);
  const exitGlow = new T.Mesh(new T.PlaneGeometry(16, 12.5), new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.85, 0.7) }));
  exitGlow.position.set(0, deckY(VIA.end) + 6, VIA.end + 0.6); scene.add(exitGlow);
  addGlow(0, deckY(VIA.end) + 6, VIA.end + 2, [1.2, 1.1, 0.9], 30);
  const tm = new T.Mesh(mergeGeos(tunnelParts), tileM); tm.frustumCulled = false; scene.add(tm);

  const via = new T.Mesh(mergeGeos(parts), stoneM); via.frustumCulled = false; scene.add(via);
  for (const [zc, base, top, pw] of piers) if (top - base > 4) addCollider(-ROAD_W / 2 - 1, base, zc - pw / 2, ROAD_W / 2 + 1, top - 1.5, zc + pw / 2);
  // Brüstung als Kollision, abschnittsweise der Steigung folgend
  for (let z = z0; z > pz; z -= 10) for (const sd of [-1, 1]) {
    const g0 = SERP.zJ - 5.2, g1 = SERP.zJ + 5.2;
    const pieces = sd > 0 && SERP.on && z - 10 < g1 && z > g0 ? [[z - 10, g0], [g1, z]].filter(([a, b]) => b - a > 0.3) : [[z - 10, z]];
    for (const [a, b] of pieces) addCollider(sd > 0 ? ROAD_W / 2 + 0.25 : -ROAD_W / 2 - 0.85, deckY(b) - 3, a, sd > 0 ? ROAD_W / 2 + 0.85 : -ROAD_W / 2 - 0.25, deckY(a) + 1.1, b);
  }

  // Fahrbahn: nasser Asphalt, Mittellinie, Gehsteigkanten
  const pos = [], idx = [], uvs = [];
  const zs = []; for (let z = z0 + 2; z > VIA.end; z -= 8) zs.push(z); zs.push(VIA.end);
  zs.forEach((z, i) => { const y = deckY(z) + 0.03; pos.push(-ROAD_W / 2, y, z, ROAD_W / 2, y, z); uvs.push(0, (z0 - z) / 6, 1, (z0 - z) / 6); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
  const rg = new T.BufferGeometry();
  rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); rg.setIndex(idx); rg.computeVertexNormals();
  const roadT = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#23272c'; g.fillRect(0, 0, W, H);
    const rr = mulberry32(31); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '120,140,150'},${0.12 * rr()})`; g.fillRect(rr() * W, rr() * H, 3, 3); }
    g.fillStyle = '#5b5a52'; g.fillRect(0, 0, 22, H); g.fillRect(W - 22, 0, 22, H);
    g.fillStyle = '#b8a070'; g.fillRect(W / 2 - 3, 0, 6, H * 0.55);
  });
  roadT.wrapT = T.RepeatWrapping;
  const road = new T.Mesh(rg, stdMat({ map: roadT, color: 0xa8b0b8, roughness: 0.32, metalness: 0.1, envI: 0.7 }));
  road.frustumCulled = false; scene.add(road);
  // Laternen auf der Brüstung, im Wechsel
  for (let z = z0 - 12; z > pz + 6; z -= 22) for (const sd of [-1, 1]) lamps.push({ x: sd * (ROAD_W / 2 + 0.55), z: z + (sd > 0 ? 11 : 0), h: 5.2, y: deckY(z) + 1.1 });

  // Portal: gestaffelter Art-Deco-Rahmen im Fels, Goldkanneluren, Schriftzug
  const dp = deckY(pz), stone = [0.42, 0.4, 0.4], GR = [0.95, 0.72, 0.34];
  const S = (x, z, w, d, y0, y1, rib = GR, flood = 0.9) => addSeg({ x, z, w, d, y0, y1, tint: stone, seed: 860, style: 3, dens: 0, flood, rib });
  for (const sd of [-1, 1]) {
    S(sd * 13, pz - 2, 10, 12, dp - 3, dp + 26);
    S(sd * 29, pz - 1, 22, 9, dp - 3, dp + 15, [0, 0, 0], 0.5);
    S(sd * 46, pz, 14, 7, dp - 3, dp + 8, [0, 0, 0], 0.3);
    addGlow(sd * 10, dp + 9, pz + 4.6, [1.3, 0.9, 0.5], 3.2);
    addGlow(sd * 13, dp + 27.5, pz + 4.2, NEON.gold, 5);
    addNeon(sd * 8.15, dp + 6.4, pz + 4.05, 0.3, 12.8, 0.3, NEON.gold);
  }
  S(0, pz - 2, 16, 12, dp + 12.6, dp + 26);
  S(0, pz - 2, 26, 10, dp + 26, dp + 31);
  S(0, pz - 2, 12, 8, dp + 31, dp + 35);
  addNeon(0, dp + 12.75, pz + 4.05, 16.3, 0.3, 0.3, NEON.gold);
  const sign = makeSignTex('VESPERA', '#f6c76a', false);
  const sm = new T.Mesh(new T.PlaneGeometry(14, 14 * sign.H / sign.W), new T.MeshBasicMaterial({ map: sign.t, color: new T.Color(1.3, 1.25, 1.15), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  sm.position.set(0, dp + 19, pz + 4.1); scene.add(sm);
  const fanM = new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(1.4, 1.2, 0.9), depthWrite: false });
  const fm = new T.Mesh(new T.PlaneGeometry(12, 6), fanM); fm.position.set(0, dp + 28.6 + 0, pz + 3.1); scene.add(fm);
  shafts.push({ x: 0, z: pz + 2, y: dp + 35, h: 260, w: 10, c: [1.0, 0.8, 0.45] });
  buildCityGate();
}
// V23 · Stadttor am Ende des Viadukts: zwei Pylonen mit Goldkanneluren, ein Querbalken mit Schriftzug, Laternen
export function buildCityGate() {
  const z = ROAD_Z0 - 6, GR = [0.95, 0.72, 0.34], st = [0.78, 0.72, 0.6];
  const S = (x, w, d, y0, y1, o = {}) => addSeg({ x, z: z + (o.dz || 0), w, d, y0, y1, tint: o.tint || st, seed: 862, style: 3, dens: 0, flood: o.flood ?? 0.9, rib: o.rib || GR });
  for (const sd of [-1, 1]) {
    const x = sd * 11;
    S(x, 3.6, 3.6, 0, 1.2, { rib: [0, 0, 0], flood: 0.4 });
    S(x, 3.0, 3.0, 1.2, 21, {});
    S(x, 3.6, 3.6, 21, 21.6, { tint: [0.5, 0.42, 0.3] });
    S(x, 2.2, 2.2, 21.6, 25.5, {});
    S(x, 1.3, 1.3, 25.5, 27.5, { tint: [0.5, 0.42, 0.3] });
    spires.push({ x, z, y0: 27.5, h: 6, b: 1.1 });
    addGlow(x, 34, z, [1.4, 0.15, 0.1], 1.8, 0.2, 1);
    for (const e of [-1, 1]) addNeon(x + e * 1.52, 11, z, 0.12, 19, 0.12, NEON.gold), addNeon(x, 11, z + e * 1.52, 0.12, 19, 0.12, NEON.gold);
    addGlow(x, 3.2, z - 2.2, [1.35, 0.95, 0.55], 2.2); addGlow(x, 3.2, z + 2.2, [1.35, 0.95, 0.55], 2.2);
    shafts.push({ x, z, y: 27.5, h: 180, w: 2.2, c: [0.35, 1.0, 0.95] });
  }
  S(0, 19.2, 1.6, 15.2, 18.4, { flood: 1 });
  S(0, 20.2, 2.0, 18.4, 18.9, { tint: [0.5, 0.42, 0.3] });
  addNeon(0, 15.1, z, 19.4, 0.14, 1.7, NEON.gold);
  const sign = makeSignTex('VESPERA', '#f6c76a', false);
  for (const flip of [0, 1]) {
    const sm = new T.Mesh(new T.PlaneGeometry(13, 13 * sign.H / sign.W), new T.MeshBasicMaterial({ map: sign.t, color: new T.Color(1.3, 1.25, 1.15), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    sm.position.set(0, 16.8, z + (flip ? 0.81 : -0.81)); sm.rotation.y = flip ? 0 : Math.PI; scene.add(sm);
  }
  addGlow(0, 16.8, z - 2, [1.3, 0.95, 0.55], 6); addGlow(0, 16.8, z + 2, [1.3, 0.95, 0.55], 6);
}
export const VILLA_DOOR = { x: 7.5, w: 2.8, h: 5.0 };   // V23: Flügeltüren in der Rückwand der Villa (lokal ±x)
export function buildVilla() {
  // Standort suchen: ein Hang im Nordosten, von dem der Blick zur Stadt möglichst frei ist
  let bestA = 0, bestR = 0, bestY = 0, bestBlock = 1e9;
  for (let a = Math.PI * 0.12; a <= Math.PI * 0.42; a += Math.PI * 0.03) {
    let r = 1450, y = 0;
    for (; r < 2400; r += 10) { y = terrainHeightRaw(Math.sin(a) * r, -Math.cos(a) * r - 100); if (y > 300) break; }
    const px = Math.sin(a) * r, pz = -Math.cos(a) * r - 100, rr = Math.hypot(px, pz);
    let block = 0;
    for (let d = 80; d <= 500; d += 40) block = Math.max(block, terrainHeightRaw(px - px / rr * d, pz - pz / rr * d) - (y - d * 0.3));
    if (block < bestBlock) { bestBlock = block; bestA = a; bestR = r; bestY = y; }
  }
  VILLA.x = Math.sin(bestA) * bestR; VILLA.z = -Math.cos(bestA) * bestR - 100; VILLA.y = bestY;
  const rr0 = Math.hypot(VILLA.x, VILLA.z); VILLA.ux = -VILLA.x / rr0; VILLA.uz = -VILLA.z / rr0;
  U.uVilla.value.set(VILLA.x, VILLA.y + 8, VILLA.z);
  const cx = VILLA.x, cz = VILLA.z, by = VILLA.y;
  const ry = VILLA.ry = Math.atan2(VILLA.ux, VILLA.uz), cs = Math.cos(ry), sn = Math.sin(ry);
  U.uVillaRot.value.set(cs, sn, 1);
  // Lokales System: +lz zeigt zur Stadt, lx quer dazu
  const W = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
  const boxes = VILLA.boxes = [];
  const stone = [0.8, 0.72, 0.58], warm = [0.86, 0.8, 0.68], GR = [0.95, 0.72, 0.34];
  const V = (lx, lz, w, d, y0, y1, o = {}) => {
    const [x, z] = W(lx, lz);
    addSeg({ x, z, w, d, y0, y1, tint: o.tint || stone, seed: o.seed || 880, style: o.style ?? 3, dens: o.dens ?? 0, flood: o.flood ?? 0.8, rib: o.rib || [0, 0, 0], ry }, false);
    if (o.col !== false) boxes.push({ x0: lx - w / 2, x1: lx + w / 2, z0: lz - d / 2, z1: lz + d / 2, y0, y1 });
  };
  const N = (lx, y, lz, sx, sy, sz, c) => { const [x, z] = W(lx, lz); addNeon(x, y, z, sx, sy, sz, c, ry); };
  const G = (lx, y, lz, c, s) => { const [x, z] = W(lx, lz); addGlow(x, y, z, c, s); };
  const batch = {};
  const put = (k, g, lx, y, lz) => { const [x, z] = W(lx, lz); (batch[k] ||= []).push(g.rotateY(ry).translate(x, y, z)); };
  const colL = (x0, y0, z0, x1, y1, z1) => boxes.push({ x0, x1, z0, z1, y0, y1 });

  // ---------- Terrassen in den Hang gebaut, mit Freitreppe ----------
  const TER_ = [[30, 52, 92, by - 5], [52, 72, 76, by - 11], [72, 90, 58, by - 17]];
  // V33: Plateau des Hauses nur noch um das Haus herum; innen liegen Keller, Böden und Treppenschächte frei (sonst deckte die Platte die Kellertreppen zu)
  for (const [x0, x1, z0, z1] of [[-65, 65, -30, -23], [-65, 65, 7, 30], [-65, -55, -23, 7], [55, 65, -23, 7], [-29.4, 29.4, -1.3, 7]]) V((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, by - 3, by, { col: false, flood: 0.3 });
  // V28: Kollision des Plateaus ohne den Keller (lokal -56..56 / -24..8); dort gelten Kellerboden und -wände
  for (const [x0, x1, z0, z1] of [[-65, -56, -30, 30], [56, 65, -30, 30], [-56, 56, -30, -24], [-56, 56, 8, 30]]) colL(x0, by - 3, z0, x1, by, z1);
  for (const [z0, z1, w, top] of TER_) {
    V(0, (z0 + z1) / 2, w, z1 - z0, top - 70, top, { rib: GR, flood: 0.5 });
    // Balustrade an der Vorderkante, Laternen
    N(0, top + 1.0, z1 - 0.3, w, 0.12, 0.25, [0.45, 0.33, 0.15]); N(0, top + 0.15, z1 - 0.3, w, 0.2, 0.4, [0.3, 0.22, 0.1]);
    for (let x = -w / 2; x <= w / 2; x += 0.6) put('stone', new T.CylinderGeometry(0.07, 0.1, 0.85, 6), x, top + 0.55, z1 - 0.3);
    colL(-w / 2, top, z1 - 0.6, w / 2, top + 1.1, z1);
    for (let x = -w / 2 + 4; x <= w / 2 - 4; x += 8) { if (Math.abs(x) < 5) continue; put('stone', new T.CylinderGeometry(0.25, 0.3, 1.3, 8), x, top + 0.65, z1 - 0.3); put('lamp', new T.SphereGeometry(0.32, 10, 8), x, top + 1.6, z1 - 0.3); G(x, top + 1.6, z1 - 0.3, [1.35, 0.95, 0.55], 2.2); }
    for (const sd of [-1, 1]) { N(sd * w / 2, top + 1.0, (z0 + z1) / 2, 0.25, 0.12, z1 - z0, [0.45, 0.33, 0.15]); colL(sd * w / 2 - 0.3, top, z0, sd * w / 2 + 0.3, top + 1.1, z1); }
  }
  // Freitreppe in der Mitte: vom Plateau über alle Terrassen
  const stairs = (zTop, yTop, yBot) => {
    const n = Math.round((yTop - yBot) / 0.3), rise = (yTop - yBot) / n, run = 0.48;
    for (let k = 0; k < n; k++) { const top = yTop - (k + 1) * rise, z = zTop + k * run; V(0, z + run / 2, 9, run + 0.02, top - 1, top, { flood: 0.2 }); }
    const L = n * run, ang = Math.atan2(yTop - yBot, L);
    for (const sd of [-1, 1]) {
      put('stone', new T.BoxGeometry(0.5, 0.9, Math.hypot(L, yTop - yBot)).rotateX(ang), sd * 4.8, (yTop + yBot) / 2 + 0.5, zTop + L / 2);
      put('gold', new T.BoxGeometry(0.56, 0.08, Math.hypot(L, yTop - yBot)).rotateX(ang), sd * 4.8, (yTop + yBot) / 2 + 0.98, zTop + L / 2);
      for (let k = 0; k < n; k += 3) colL(sd * 4.8 - 0.3, yTop - (k + 3) * rise, zTop + k * run, sd * 4.8 + 0.3, yTop - k * rise + 1, zTop + (k + 3) * run);
      put('stone', new T.CylinderGeometry(0.35, 0.4, 1.6, 10), sd * 4.8, yBot + 0.8, zTop + L); put('lamp', new T.SphereGeometry(0.3, 10, 8), sd * 4.8, yBot + 1.9, zTop + L);
      G(sd * 4.8, yTop + 1.4, zTop, [1.35, 0.95, 0.55], 1.6); G(sd * 4.8, yBot + 1.9, zTop + L, [1.35, 0.95, 0.55], 1.8);
    }
  };
  stairs(30, by, by - 5); stairs(52, by - 5, by - 11); stairs(72, by - 11, by - 17);

  // ---------- Das Haus: Mittelbau, Rundturm, Loggia, zwei Flügel ----------
  const cream = warm;
  // Der Mittelbau ist im Erdgeschoss hohl und begehbar: Salon, Bibliothek und Bar hinter der Loggia
  const IH = 9, FW = { style: 2, dens: 1, flood: 1, rib: GR, tint: cream, seed: 881 };
  // V23: Rückwand mit zwei Flügeltüren zur Vorfahrt (links und rechts vom Kamin)
  const DX = VILLA_DOOR.x, DW = VILLA_DOOR.w, DH = VILLA_DOOR.h;
  for (const [a, b] of [[-30, -DX - DW / 2], [-DX + DW / 2, DX - DW / 2], [DX + DW / 2, 30]]) V((a + b) / 2, -22.7, b - a, 0.6, by, by + IH, { ...FW, seed: 881 + Math.round(a) });
  for (const sd of [-1, 1]) V(sd * DX, -22.7, DW, 0.6, by + DH, by + IH, { ...FW, style: 3, dens: 0 });
  // V28: Seitenwände, Loggiafassade, Obergeschoss, Flügel und alle Innenräume baut villa.js (buildVillaRooms)
  V(0, -12, 62, 24, by + 16, by + 17.2, { tint: [0.5, 0.42, 0.3], flood: 1, rib: GR, col: false });
  for (const sd of [-1, 1]) N(sd * 42, by + 16.15, -8, 27.2, 0.25, 31.2, NEON.gold);   // V28: Flügel so hoch wie der Mittelbau
  // Rundturm in der Mitte (gestuft) mit Goldkrone und Lichtsäule
  V(0, -10, 18, 18, by + 16, by + 27, { style: 2, dens: 1, flood: 1, rib: GR, tint: cream, seed: 884 });
  V(0, -10, 12, 12, by + 27, by + 35, { style: 2, dens: 1, flood: 1, rib: GR, tint: cream, seed: 885 });
  V(0, -10, 7, 7, by + 35, by + 40, { tint: [0.5, 0.4, 0.25], flood: 1, rib: GR });
  for (const [w, y] of [[18, by + 27], [12, by + 35]]) { const [x, z] = W(0, -10); crownFinsR(x, z, w, w, y, 3.5, GR, ry); }
  N(0, by + 16.15, -12, 60.3, 0.3, 22.3, NEON.gold);
  N(0, by + 27.15, -10, 18.3, 0.3, 18.3, NEON.gold);
  { const [x, z] = W(0, -10); spires.push({ x, z, y0: by + 40, h: 12, b: 5 }); addGlow(x, by + 52.5, z, [1.4, 0.2, 0.1], 2.4, 0.3, 1); shafts.push({ x, z, y: by + 40, h: 320, w: 12, c: [1.0, 0.8, 0.45] }); addGlow(x, by + 38, z, NEON.gold, 18); }
  // Loggia: Kolonnade vor dem Mittelbau, darüber eine Terrasse
  for (let x = -28; x <= 28; x += 4) { put('stone', new T.CylinderGeometry(0.5, 0.55, 9, 14), x, by + 4.5, 1.5); put('gold', new T.CylinderGeometry(0.8, 0.55, 0.6, 14), x, by + 8.7, 1.5); colL(x - 0.5, by, 1, x + 0.5, by + 9, 2); }
  // V33: Platte zwischen EG und OG nicht mehr quer durch die zweigeschossige Halle (dort lief man auf der Treppe durch eine Wand)
  for (const [x0, x1, z0, z1] of [[-30, -14.5, -11, 2], [14.5, 30, -11, 2], [-14.5, 14.5, -1.6, 2]]) V((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, by + 9, by + 10.2, { flood: 1, rib: GR, col: false, tint: cream });
  N(0, by + 10.3, 2, 60.2, 0.25, 0.25, NEON.gold);
  for (let x = -26; x <= 26; x += 4) G(x, by + 7.8, -0.5, [1.35, 0.95, 0.55], 1.3);
  // Große Fenstertüren zur Loggia: warme Lichtflächen
  for (let x = -24; x <= 24; x += 6) if (x !== 0 && Math.abs(x) !== 18) put('lamp', new T.PlaneGeometry(3.2, 6.2), x, by + 3.3, -0.94);
  // Pflanzkübel aus Stein mit Buchskugeln entlang der Loggia
  for (let x = -30; x <= 30; x += 10) { put('stone', new T.CylinderGeometry(0.75, 0.5, 1.0, 16), x + 2, by + 0.5, 4.2); put('gold', new T.TorusGeometry(0.75, 0.06, 6, 24).rotateX(Math.PI / 2), x + 2, by + 1.0, 4.2); put('hedge', new T.SphereGeometry(0.9, 14, 10), x + 2, by + 1.75, 4.2); colL(x + 1.2, by, 3.4, x + 2.8, by + 1.2, 5.0); }

  // ---------- Garten: Brunnen, Pool, Hecken, Zypressen, Belvedere ----------
  const water = poolWaterMat([0.04, 0.4, 0.42]);
  const M = {
    stone: stdMat({ color: 0xcfc2a8, roughness: 0.6, envI: 0.3, emissive: 0x15100a }), gold: MAT.gold, iron: stdMat({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.4 }),
    lamp: new T.MeshBasicMaterial({ color: new T.Color(1.05, 0.78, 0.48), side: T.DoubleSide }), water,
    hedge: stdMat({ map: HEDGE_TEX.map, normalMap: HEDGE_TEX.normal, roughnessMap: HEDGE_TEX.rough, normalScale: new T.Vector2(1.2, 1.2), color: 0xb0c0a8, roughness: 1, envI: 0.15, emissive: 0x0a140a, emissiveMap: HEDGE_TEX.map }), trunk: stdMat({ color: 0x2e2216, roughness: 0.9, env: false }),
    velvet: stdMat({ color: 0xe9e1cf, roughness: 0.8, envI: 0.2 }), dark: MAT.black, ...villaInteriorMats(),
    glassD: stdMat({ color: 0x0a0d10, metalness: 0.7, roughness: 0.12, envI: 1.4, emissive: 0x1a1006, transparent: true, opacity: 0.55 }),
    carpet: stdMat({ color: 0x6a0d12, roughness: 0.85, envI: 0.15, emissive: 0x120202 }),
    sofa: stdMat({ color: 0x8a6a3e, roughness: 0.75, env: false, emissive: 0x140c05 }),
    statue: stdMat({ color: 0xf2ede4, roughness: 0.35, envI: 0.6, emissive: 0x1a1612 }),
    roseW: stdMat({ color: 0xf4f0ea, roughness: 0.7, emissive: 0x3a3634 }), roseR: stdMat({ color: 0x8a0e1a, roughness: 0.6, emissive: 0x2a0306 }),
  };
  const basin = (lx, lz, r, y) => {
    put('stone', new T.CylinderGeometry(r + 0.5, r + 0.7, 0.9, 40), lx, y + 0.45, lz);
    put('water', new T.CylinderGeometry(r, r, 0.1, 40), lx, y + 0.86, lz);
    put('gold', new T.TorusGeometry(r + 0.5, 0.12, 6, 48).rotateX(Math.PI / 2), lx, y + 0.92, lz);
    colL(lx - r - 0.6, y, lz - r - 0.6, lx + r + 0.6, y + 0.9, lz + r + 0.6);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; G(lx + Math.cos(a) * r * 0.85, y + 0.95, lz + Math.sin(a) * r * 0.85, NEON.teal, 1.0); }
  };
  basin(0, 18, 5.5, by);
  for (const [r, h, y] of [[1.6, 1.4, 0.9], [1.0, 1.4, 2.3], [0.5, 1.6, 3.7]]) put('stone', new T.CylinderGeometry(r * 0.8, r, h, 20), 0, by + y + h / 2, 18);
  put('gold', new T.SphereGeometry(0.6, 16, 12), 0, by + 5.9, 18);
  { const [fx, fz] = W(0, 18); fountainJet(fx, by + 6.4, fz, 2.5, 0.5); }
  // Langer Pool auf der ersten Terrasse, innen beleuchtet
  const t1 = by - 5;
  for (const sd of [-1, 1]) {
    const px = sd * 18, pz = 45;
    put('stone', new T.BoxGeometry(22, 0.6, 10), px, t1 + 0.3, pz); put('water', new T.BoxGeometry(20.4, 0.1, 8.4), px, t1 + 0.56, pz);
    for (const e of [-1, 1]) { put('gold', new T.BoxGeometry(22, 0.12, 0.25), px, t1 + 0.62, pz + e * 5); put('gold', new T.BoxGeometry(0.25, 0.12, 10), px + e * 11, t1 + 0.62, pz); }
    colL(px - 11, t1, pz - 5, px + 11, t1 + 0.5, pz + 5);
    for (let k = -2; k <= 2; k++) G(px + k * 4, t1 + 0.3, pz, [0.3, 1.1, 1.1], 3.5);
    for (let k = 0; k < 5; k++) put('velvet', new T.BoxGeometry(0.9, 0.35, 2.0), px - 8 + k * 4, t1 + 0.18, 34.5);
  }
  // Hecken und Blumenbeete auf der zweiten Terrasse
  const t2 = by - 11;
  for (const sd of [-1, 1]) for (const lx of [10, 20, 30]) {
    put('hedge', new T.BoxGeometry(7, 1.4, 14), sd * lx, t2 + 0.7, 62); colL(sd * lx - 3.5, t2, 55, sd * lx + 3.5, t2 + 1.4, 69);
    for (let k = 0; k < 3; k++) G(sd * lx, t2 + 1.6, 57 + k * 5, [1.3, 0.55, 0.45], 0.5);
  }
  basin(0, 62, 3.5, t2);
  // Zypressen an den Rändern
  const cyp = (lx, lz, y, s = 1) => { const [x, z] = W(lx, lz); trees.push({ x, z, y, s, sp: 'cyp' }); };
  for (const sd of [-1, 1]) {
    for (let lz = -30; lz <= 26; lz += 8) cyp(sd * 63, lz, by, 1.1);
    for (const [z0, z1, w, top] of TER_) for (let lz = z0 + 4; lz < z1 - 2; lz += 7) cyp(sd * (w / 2 - 2.5), lz, top);
  }
  // Belvedere: Rundtempel mit Goldkuppel auf der untersten Terrasse
  const t3 = by - 17, bx = 18, bz = 82;
  put('stone', new T.CylinderGeometry(5.2, 5.4, 0.8, 32), bx, t3 + 0.4, bz);
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; put('stone', new T.CylinderGeometry(0.28, 0.32, 5.5, 10), bx + Math.cos(a) * 4.5, t3 + 3.55, bz + Math.sin(a) * 4.5); colL(bx + Math.cos(a) * 4.5 - 0.3, t3, bz + Math.sin(a) * 4.5 - 0.3, bx + Math.cos(a) * 4.5 + 0.3, t3 + 6, bz + Math.sin(a) * 4.5 + 0.3); }
  put('stone', new T.CylinderGeometry(5.2, 5.2, 0.7, 32), bx, t3 + 6.65, bz);
  put('gold', new T.SphereGeometry(5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), bx, t3 + 7.0, bz);
  G(bx, t3 + 4, bz, [1.3, 0.9, 0.5], 8);
  basin(-18, 82, 2.5, t3);

  // ---------- Vorfahrt hinter dem Haus mit Limousinen, Ankermast mit Privatluftschiff ----------
  // V23: Eingang von der Vorfahrt: Vordach auf vier Säulen, roter Läufer, verglaste Flügeltüren in Goldrahmen, Laternen
  {
    const DX = VILLA_DOOR.x, DW = VILLA_DOOR.w, DH = VILLA_DOOR.h, zW = -23.0, zC = -31.5, cw = 2 * DX + 9;
    V(0, (zW + zC) / 2 - 0.3, cw, zW - zC + 0.6, by + 6.2, by + 7.0, { tint: cream, flood: 1, rib: GR, col: false, seed: 886 });
    V(0, (zW + zC) / 2 - 0.3, cw + 0.8, zW - zC + 1.4, by + 7.0, by + 7.35, { tint: [0.5, 0.42, 0.3], flood: 1, rib: GR, col: false, seed: 887 });
    N(0, by + 7.45, zC - 1.0, cw + 0.9, 0.18, 0.18, NEON.gold); for (const sd of [-1, 1]) N(sd * (cw / 2 + 0.45), by + 7.45, (zW + zC) / 2 - 0.3, 0.18, 0.18, zW - zC + 1.4, NEON.gold);
    for (const lx of [-cw / 2 + 1.2, -DX + 2.6, DX - 2.6, cw / 2 - 1.2]) {
      put('stone', new T.CylinderGeometry(0.42, 0.48, 6.0, 16), lx, by + 3.1, zC); put('gold', new T.CylinderGeometry(0.7, 0.45, 0.45, 16), lx, by + 6.0, zC);
      put('stone', new T.BoxGeometry(1.2, 0.35, 1.2), lx, by + 0.18, zC); put('gold', new T.TorusGeometry(0.47, 0.04, 6, 20).rotateX(Math.PI / 2), lx, by + 0.9, zC);
      colL(lx - 0.5, by, zC - 0.5, lx + 0.5, by + 6.2, zC + 0.5);
    }
    // Sonnenfächer über dem Vordach, Lampen an der Unterseite
    { const [x, z] = W(0, zC - 1.05); const fm = new T.Mesh(new T.PlaneGeometry(8, 4), new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(1.3, 1.05, 0.7), depthWrite: false, side: T.DoubleSide })); fm.position.set(x, by + 9.3, z); fm.rotation.y = ry + Math.PI; scene.add(fm); }
    for (let lx = -cw / 2 + 3; lx <= cw / 2 - 3; lx += 4) { put('lamp', new T.CylinderGeometry(0.28, 0.28, 0.06, 14), lx, by + 6.15, (zW + zC) / 2); G(lx, by + 5.8, (zW + zC) / 2, [1.35, 0.95, 0.55], 1.6); }
    for (const sd of [-1, 1]) {
      const x0 = sd * DX;
      // Türgewände, Sturz mit Oberlicht, zwei nach innen geöffnete Glasflügel
      for (const e of [-1, 1]) put('gold', new T.BoxGeometry(0.22, DH + 0.2, 0.8), x0 + e * (DW / 2 + 0.05), by + DH / 2, zW + 0.25);
      put('gold', new T.BoxGeometry(DW + 0.5, 0.3, 0.8), x0, by + DH + 0.1, zW + 0.25);
      put('lamp', new T.PlaneGeometry(DW - 0.2, 0.9).rotateY(Math.PI), x0, by + DH - 0.55, zW - 0.02);
      for (const e of [-1, 1]) {
        const leaf = new T.BoxGeometry(DW / 2 - 0.08, DH - 1.25, 0.07).translate(-e * (DW / 4 - 0.04), 0, 0).rotateY(e * 1.35);
        put('glassD', leaf, x0 + e * (DW / 2 - 0.05), by + (DH - 1.25) / 2 + 0.05, zW + 0.3);
        put('gold', new T.BoxGeometry(DW / 2 - 0.04, 0.08, 0.1).translate(-e * (DW / 4 - 0.02), 0, 0).rotateY(e * 1.35), x0 + e * (DW / 2 - 0.05), by + 0.1, zW + 0.3);
      }
      // Wandlaternen neben den Türen
      for (const e of [-1, 1]) { put('gold', new T.BoxGeometry(0.3, 0.55, 0.3), x0 + e * (DW / 2 + 0.8), by + 3.6, zW - 0.35); put('lamp', new T.BoxGeometry(0.2, 0.4, 0.2), x0 + e * (DW / 2 + 0.8), by + 3.6, zW - 0.45); G(x0 + e * (DW / 2 + 0.8), by + 3.6, zW - 0.6, [1.4, 0.95, 0.55], 1.4); }
      // Läufer bis zur Vorfahrt, Schwelle aus Stein, Messingpfosten mit Kordel
      put('stone', new T.BoxGeometry(DW + 0.6, 0.06, 0.9), x0, by + 0.06, zW - 0.3);
      put('carpet', new T.BoxGeometry(2.0, 0.02, 9.0), x0, by + 0.09, zW - 5.2);
      for (const e of [-1, 1]) for (const lz of [zW - 2.2, zW - 5.2, zW - 8.2]) { put('gold', new T.CylinderGeometry(0.04, 0.06, 0.95, 8), x0 + e * 1.35, by + 0.5, lz); put('gold', new T.SphereGeometry(0.07, 8, 6), x0 + e * 1.35, by + 1.0, lz); }
      for (const e of [-1, 1]) for (const lz of [zW - 3.7, zW - 6.7]) put('carpet', new T.CylinderGeometry(0.025, 0.025, 3.0, 5).rotateX(Math.PI / 2), x0 + e * 1.35, by + 0.85, lz);
      // Pflanzkübel mit Buchskugeln zu beiden Seiten
      for (const e of [-1, 1]) { put('stone', new T.CylinderGeometry(0.6, 0.42, 0.85, 16), x0 + e * 2.6, by + 0.43, zW - 1.0); put('hedge', new T.SphereGeometry(0.72, 14, 10), x0 + e * 2.6, by + 1.4, zW - 1.0); colL(x0 + e * 2.6 - 0.6, by, zW - 1.6, x0 + e * 2.6 + 0.6, by + 1.2, zW - 0.4); }
    }
    VILLA.entry = (() => { const [x, z] = W(0, zC - 4); return { x, z, y: by }; })();
  }
  V(0, -40, 110, 34, by - 3, by + 0.05, { tint: [0.3, 0.29, 0.28], flood: 0.2 });
  const parked = [];
  for (let k = 0; k < 3; k++) { const lx = -10 + k * 10, lz = -44 + (k % 2) * 7; parked.push([lx, lz, ry + Math.PI / 2 + (k % 2 ? Math.PI : 0)]); }
  const cm = new T.InstancedMesh(carGeoHi(), MAT.carPaint, parked.length), pc = new T.Color();
  parked.forEach(([lx, lz, yaw], i) => { const [x, z] = W(lx, lz); cm.setMatrixAt(i, _m.compose(_p.set(x, by + 0.05, z), _q.setFromAxisAngle(_up, yaw), _s.set(1, 1, 1))); const c = pick([[0.04, 0.04, 0.05], [0.3, 0.04, 0.06], [0.8, 0.72, 0.58], [0.05, 0.16, 0.12], [0.08, 0.1, 0.22]]).map(v => v + (Math.random() - 0.5) * 0.012); cm.setColorAt(i, pc.setRGB(...c)); colL(lx - 1.1, by, lz - 2.6, lx + 1.1, by + 1.8, lz + 2.6); });
  cm.frustumCulled = false; scene.add(cm);
  for (let lx = -50; lx <= 50; lx += 12) { put('stone', new T.CylinderGeometry(0.12, 0.18, 4.5, 8), lx, by + 2.3, -57); G(lx, by + 4.8, -57, [1.35, 0.95, 0.55], 1.8); }
  const mastL = [38, -32], mastH = 42;
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [1.5, 1.5], [-1.5, 1.5]]) put('iron', new T.CylinderGeometry(0.18, 0.3, mastH, 6).rotateZ(-dx * 0.025).rotateX(dz * 0.025), mastL[0] + dx, by + mastH / 2, mastL[1] + dz);
  for (let y = 4; y < mastH; y += 4) put('iron', new T.TorusGeometry(1.6 - y * 0.012, 0.08, 4, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4), mastL[0], by + y, mastL[1]);
  put('gold', new T.CylinderGeometry(1.2, 1.2, 0.8, 16), mastL[0], by + mastH + 0.4, mastL[1]);
  G(mastL[0], by + mastH + 1.5, mastL[1], [1.5, 0.2, 0.1], 3);
  colL(mastL[0] - 2, by, mastL[1] - 2, mastL[0] + 2, by + mastH, mastL[1] + 2);
  VILLA.mast = { ...(() => { const [x, z] = W(mastL[0], mastL[1]); return { x, z }; })(), y: by + mastH };

  // ---------- V33: kein Fest mehr. Nur Randolf und die Bediensteten wohnen und arbeiten hier ----------
  const crowd = VILLA.crowd = new Crowd(['tux', 'gown', 'dress', 'livery'], 160);
  const pl = (kind, color, lx, y, lz, yaw) => { const a = crowd.add(kind, color); const [x, z] = W(lx, lz); a.x = x; a.y = y; a.z = z; a.yaw = yaw + ry; return a; };
  VILLA.sway = []; VILLA.dancers = [];
  // Portiers an den Türen zur Vorfahrt, Chauffeure bei den Wagen, ein Gärtner und ein Diener auf der Terrasse
  for (const sd of [-1, 1]) for (const e of [-1, 1]) pl('livery', [0.32, 0.05, 0.07], sd * VILLA_DOOR.x + e * 1.9, by, -24.6, Math.PI);
  for (let k = 0; k < 2; k++) pl('livery', [0.32, 0.05, 0.07], -6 + k * 18, by, -50, 0);
  pl('livery', [0.3, 0.32, 0.22], -24, by, 22, 0.8); pl('livery', [0.9, 0.88, 0.82], 9, by, 6, Math.PI * 0.2);
  // V28: alle Innenräume, ihre Möbel, Türen, Lichter und Bewohner (vor crowd.finish, weil Figuren dazukommen)
  buildVillaRooms({ W, V, G, colL, pl, by, ry, M, crowd });
  crowd.finish();
  for (const a of crowd.list) if (a.x !== undefined) crowd.set(a, a.x, a.y, a.z, a.yaw);
  crowd.flag();

  // ---------- Mehr Pracht: Marmorstatuen, Rosenbeete, Buffet mit Champagnerturm, Goldfinnen auf den Dächern ----------
  const statueGeo = kind => {
    // Figur ohne die Varianten (Hüte, andere Frisuren), als ein Stück Marmor
    const src = personGeoHi(kind, 1).toNonIndexed(), op = src.attributes.aOpt.array, pos = src.attributes.position.array, nor = src.attributes.normal.array, P = [], Nn = [];
    for (let i = 0; i < op.length; i += 3) { if (!(op[i] <= 0 || op[i] === 11)) continue; /* V32: Hände haben negative Werte (Fingergelenke) */ for (let k = 0; k < 3; k++) { P.push(pos[(i + k) * 3], pos[(i + k) * 3 + 1], pos[(i + k) * 3 + 2]); Nn.push(nor[(i + k) * 3], nor[(i + k) * 3 + 1], nor[(i + k) * 3 + 2]); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(P.length / 3 * 2), 2));
    return g;
  };
  const SG = { gown: statueGeo('gown'), dress: statueGeo('dress'), tux: statueGeo('tux') };
  const statue = (lx, lz, y, kind, a) => {
    put('stone', lathe([[0.75, 0], [0.75, 0.15], [0.6, 0.25], [0.55, 1.4], [0.7, 1.5], [0.72, 1.62], [0, 1.62]], 20), lx, y, lz);
    put('gold', new T.TorusGeometry(0.62, 0.04, 6, 24).rotateX(Math.PI / 2), lx, y + 1.45, lz);
    put('statue', SG[kind].clone().scale(1.25, 1.25, 1.25).rotateY(a), lx, y + 1.62, lz);
    G(lx, y + 0.3, lz + 1.2, [1.2, 0.95, 0.7], 1.6);
    colL(lx - 0.75, y, lz - 0.75, lx + 0.75, y + 3.8, lz + 0.75);
  };
  for (const sd of [-1, 1]) {
    statue(sd * 7.5, 29, by, sd < 0 ? 'gown' : 'tux', 0);
    for (const [, z1, w, top] of TER_) statue(sd * (w / 2 - 6), z1 - 2.5, top, pick(['gown', 'dress', 'tux']), 0);
    statue(sd * 30, 45, t1, 'dress', -sd * Math.PI / 2);
  }
  // Rosen: weiße und rote Blüten auf den Hecken, Rosenbögen über dem Weg zum Belvedere
  for (const sd of [-1, 1]) for (const lx of [10, 20, 30]) for (let k = 0; k < 46; k++) put(k % 3 ? 'roseW' : 'roseR', new T.SphereGeometry(0.11 + R() * 0.05, 6, 5), sd * lx + rand(-3.3, 3.3), t2 + 1.42 + R() * 0.05, 62 + rand(-6.8, 6.8));
  for (let k = 0; k < 4; k++) {
    const lz = 74 + k * 3.5;
    put('iron', new T.TorusGeometry(2.2, 0.06, 6, 24, Math.PI), 10, t3 + 0.05, lz);
    for (let j = 0; j < 18; j++) { const a = j / 17 * Math.PI; put(j % 2 ? 'roseW' : 'roseR', new T.SphereGeometry(0.14, 6, 5), 10 + Math.cos(a) * 2.2, t3 + Math.sin(a) * 2.2 + 0.05, lz + rand(-0.15, 0.15)); }
    for (const e of [-1, 1]) for (let j = 0; j < 6; j++) put('hedge', new T.SphereGeometry(0.22, 6, 5), 10 + e * 2.2 + rand(-0.15, 0.15), t3 + j * 0.35, lz);
  }
  // Buffet unter der Loggia: lange weiße Tafel, Silberplatten, Kerzenleuchter; daneben ein Champagnerturm
  const bx0 = 34, bz0 = 7;
  put('velvet', new T.BoxGeometry(12, 0.08, 1.6), bx0, by + 0.95, bz0); put('velvet', new T.BoxGeometry(12.1, 0.8, 1.7).translate(0, -0.4, 0), bx0, by + 0.95, bz0);
  put('gold', new T.BoxGeometry(12.12, 0.05, 1.72), bx0, by + 0.58, bz0);
  colL(bx0 - 6, by, bz0 - 0.85, bx0 + 6, by + 1.0, bz0 + 0.85);
  for (let k = 0; k < 4; k++) { const lx = bx0 - 4.5 + k * 3; put('gold', lathe([[0.1, 0], [0.03, 0.05], [0.025, 0.35], [0.12, 0.38], [0.03, 0.4], [0.03, 0.55]], 10), lx, by + 0.99, bz0 - 0.4); for (const e of [-1, 0, 1]) { put('lamp', new T.CylinderGeometry(0.015, 0.015, 0.1, 6), lx + e * 0.1, by + 1.6, bz0 - 0.4); G(lx + e * 0.1, by + 1.68, bz0 - 0.4, [1.4, 0.85, 0.4], 0.3); } }
  const dishes = ['lobster', 'oysters', 'cake', 'steak', 'oysters', 'sandwich', 'lobster', 'cake', 'soup'];
  dishes.forEach((d, k) => { const dm = dishModel(d), [x, z] = W(bx0 - 5.4 + k * 1.35, bz0 + 0.25); dm.position.set(x, by + 1.0, z); dm.scale.setScalar(1.6); dm.rotation.y = ry; scene.add(dm); });
  {
    const tx = 25, tz = 7;
    put('gold', lathe([[0.5, 0], [0.12, 0.08], [0.08, 0.9], [0.55, 0.95], [0.55, 1.0], [0, 1.0]], 20), tx, by, tz);
    colL(tx - 0.6, by, tz - 0.6, tx + 0.6, by + 1.8, tz + 0.6);
    const levels = [[0, 4], [0.14, 3], [0.28, 2], [0.42, 1]];
    for (const [dy, n] of levels) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (n > 1 && i > 0 && i < n - 1 && j > 0 && j < n - 1) continue;
      const dm = dishModel('coupe'), [x, z] = W(tx + (i - (n - 1) / 2) * 0.115, tz + (j - (n - 1) / 2) * 0.115); dm.position.set(x, by + 1.0 + dy, z); scene.add(dm);
    }
    G(tx, by + 1.3, tz, [1.3, 1.1, 0.6], 1.2);
  }
  // Goldfinnen auf den Flügeln und dem Mittelbau, Lichtband an den Gesimsen
  for (const sd of [-1, 1]) { const [x, z] = W(sd * 42, -8); crownFinsR(x, z, 26, 30, by + 17.2, 1.8, GR, ry); crownFinsR(x, z, 14, 18, by + 21, 2.4, GR, ry); }
  { const [x, z] = W(0, -12); crownFinsR(x, z, 62, 24, by + 17.2, 1.6, GR, ry); }
  // Fackeln an der Auffahrt und am Weg hinunter
  for (let lx = -48; lx <= 48; lx += 16) for (const lz of [-24.5, -55.5]) { put('iron', new T.CylinderGeometry(0.05, 0.07, 2.2, 6), lx, by + 1.1, lz); put('gold', new T.CylinderGeometry(0.16, 0.08, 0.3, 8), lx, by + 2.3, lz); G(lx, by + 2.65, lz, [1.6, 0.7, 0.2], 1.4); }

  const WUV = { hedge: 1.6, plaster: 4.2, parq: 4.0, marble: 4.2, panel: 2.0 };
  for (const k in batch) { const g = mergeGeos(batch[k]); if (WUV[k]) worldUV(g, WUV[k]); const m = new T.Mesh(g, M[k]); m.frustumCulled = false; scene.add(m); }
  { const [x, z] = W(0, 20); addLight(0xffc27a, 0.95, 140, 1.4, x, by + 12, z); }
  { const [x, z] = W(0, -12); addLight(0xffd29a, 0.7, 30, 1.6, x, by + 6.5, z); }
}
// Materialien der Innenräume (Marmor, Parkett, Täfelung, Tapete, Bücher …); die Räume selbst baut villa.js (V28)
export function villaInteriorMats() {
  const MB = marbleFloorTextures(), PQ = parquetTextures(), WP = wallpaperTex('#3a2a20', 'rgba(222,178,96,0.24)'), PN = woodPanelTextures(), RG = rugTex();
  WP.wrapS = WP.wrapT = T.RepeatWrapping;
  const books = canvasTex(512, 256, (g, W, H) => {
    g.fillStyle = '#2a1a10'; g.fillRect(0, 0, W, H);
    const cols = ['#5a1a18', '#1d3b34', '#6b4a22', '#2a2a40', '#7a6440', '#3d1f2e', '#17302f'];
    for (let row = 0; row < 4; row++) { let x = 4; const y0 = row * 64 + 6; while (x < W - 6) { const w = 6 + Math.random() * 10, h = 40 + Math.random() * 14; g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.fillRect(x, y0 + 52 - h, w, h); g.fillStyle = 'rgba(214,170,90,0.7)'; g.fillRect(x, y0 + 52 - h + 6, w, 2); g.fillRect(x, y0 + 52 - 10, w, 2); x += w + 1; } g.fillStyle = '#3a2414'; g.fillRect(0, row * 64 + 58, W, 6); }
  });
  books.wrapS = T.RepeatWrapping;
  return {
    marble: stdMat({ map: MB.map, roughnessMap: MB.rough, normalMap: MB.normal, normalScale: new T.Vector2(0.6, 0.6), roughness: 1, metalness: 0.0, envI: 0.9 }),
    parq: stdMat({ map: PQ.map, roughnessMap: PQ.rough, normalMap: PQ.normal, normalScale: new T.Vector2(0.8, 0.8), roughness: 1, envI: 0.45, emissive: 0x3a2a1c, emissiveMap: PQ.map }),
    panel: stdMat({ map: PN.map, roughnessMap: PN.rough, normalMap: PN.normal, roughness: 1, envI: 0.4, emissive: 0x403020, emissiveMap: PN.map }),
    plaster: stdMat({ map: WP, roughness: 0.85, env: false, emissive: 0x8a7462, emissiveMap: WP }),
    ceil: stdMat({ color: 0x3a2c1c, roughness: 0.9, env: false, emissive: 0x2a1c0e }),
    wood: stdMat({ color: 0x3a2214, roughness: 0.45, envI: 0.5, emissive: 0x080402 }),
    books: stdMat({ map: books, roughness: 0.8, envI: 0.2, emissive: 0x0c0806 }),
    leather: stdMat({ color: 0x5c1418, roughness: 0.5, envI: 0.35, emissive: 0x0c0203 }),
    rug: stdMat({ map: RG, roughness: 0.95, env: false, emissive: 0x8a7070, emissiveMap: RG }),
    fire: new T.MeshBasicMaterial({ color: new T.Color(1.6, 0.7, 0.25) }),
    fan: new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, depthWrite: false, color: new T.Color(0.9, 0.72, 0.45) }),
    bottle: new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.55, 0.22) }),
  };
}
export function crownFinsR(x, z, w, d, y, h, c, ry) {
  const n0 = neons.length; crownFins(0, 0, w, d, y, h, c);
  const cs = Math.cos(ry), sn = Math.sin(ry);
  for (let i = n0; i < neons.length; i++) { const n = neons[i], lx = n.x, lz = n.z; n.x = x + lx * cs + lz * sn; n.z = z - lx * sn + lz * cs; n.ry = ry; }
}
/* ---------- Feuerwerk über der Villa: aufsteigende Raketen, goldene, türkise und weiße Sterne, die langsam fallen ---------- */
export const FW = { n: 1400, pts: null, p: null, v: null, life: null, col: null, rockets: [], t: 3, head: 0 };
export function buildFireworks() {
  const n = FW.n, g = new T.BufferGeometry();
  FW.p = new Float32Array(n * 3); FW.v = new Float32Array(n * 3); FW.life = new Float32Array(n); FW.c0 = new Float32Array(n * 3);
  FW.col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) FW.p[i * 3 + 1] = -9999;
  g.setAttribute('position', new T.BufferAttribute(FW.p, 3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('color', new T.BufferAttribute(FW.col, 3).setUsage(T.DynamicDrawUsage));
  const m = new T.ShaderMaterial({
    uniforms: { uScale: U.uScale }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true,
    vertexShader: `uniform float uScale; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(2.6 * uScale / max(-mv.z, 1.0), 1.5, 40.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(vC * (pow(1.0 - r, 1.5) + exp(-r * r * 12.0)), 1.0); }`,
  });
  FW.pts = new T.Points(g, m); FW.pts.frustumCulled = false; FW.pts.renderOrder = 4; scene.add(FW.pts);
}
export const FW_COLS = [[1.6, 1.15, 0.45], [0.45, 1.5, 1.45], [1.6, 1.55, 1.4], [1.6, 0.55, 0.6], [1.3, 0.9, 1.6]];
export function fwBurst(x, y, z) {
  const c = pick(FW_COLS), c2 = Math.random() < 0.4 ? pick(FW_COLS) : c, k = 160 + Math.floor(Math.random() * 90), sp = 32 + Math.random() * 22, ring = Math.random() < 0.25;
  for (let j = 0; j < k; j++) {
    const i = FW.head; FW.head = (FW.head + 1) % FW.n;
    let dx, dy, dz;
    if (ring) { const a = j / k * Math.PI * 2; dx = Math.cos(a); dy = Math.sin(a) * 0.3; dz = Math.sin(a); }
    else { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); dx = r * Math.cos(a); dy = u; dz = r * Math.sin(a); }
    const s = sp * (0.85 + Math.random() * 0.3);
    FW.p.set([x, y, z], i * 3); FW.v.set([dx * s, dy * s, dz * s], i * 3); FW.life[i] = 2.2 + Math.random() * 1.2;
    FW.c0.set(j % 2 ? c : c2, i * 3);
  }
}
export function updateFireworks(dt) {
  if (!FW.pts) return;
  const cp = camera.position, far = (cp.x - VILLA.x) ** 2 + (cp.z - VILLA.z) ** 2 > 4200 * 4200;
  if (!far && (FW.t -= dt) <= 0) {
    FW.t = 1.2 + Math.random() * (Math.random() < 0.2 ? 0.4 : 4);
    const a = Math.random() * 6.28, r = Math.random() * 60;
    FW.rockets.push({ x: VILLA.x + Math.cos(a) * r + VILLA.ux * 80, y: VILLA.y, z: VILLA.z + Math.sin(a) * r + VILLA.uz * 80, vy: 70 + Math.random() * 25, t: 1.4 + Math.random() * 0.6 });
  }
  for (let k = FW.rockets.length - 1; k >= 0; k--) {
    const r = FW.rockets[k]; r.t -= dt; r.y += r.vy * dt; r.vy -= 18 * dt;
    // Funkenschweif der Rakete
    const i = FW.head; FW.head = (FW.head + 1) % FW.n; FW.p.set([r.x, r.y, r.z], i * 3); FW.v.set([0, -4, 0], i * 3); FW.life[i] = 0.6; FW.c0.set([1.4, 0.9, 0.4], i * 3);
    if (r.t <= 0) { fwBurst(r.x, r.y, r.z); FW.rockets.splice(k, 1); }
  }
  const P = FW.p, V = FW.v, L = FW.life, C = FW.col, C0 = FW.c0, drag = Math.exp(-dt * 1.6);
  for (let i = 0; i < FW.n; i++) {
    if (L[i] <= 0) { if (P[i * 3 + 1] > -9000) { P[i * 3 + 1] = -9999; C[i * 3] = C[i * 3 + 1] = C[i * 3 + 2] = 0; } continue; }
    L[i] -= dt;
    V[i * 3] *= drag; V[i * 3 + 1] = V[i * 3 + 1] * drag - 9 * dt; V[i * 3 + 2] *= drag;
    P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
    // funkeln und verglühen
    const f = Math.min(1, L[i] / 1.2) * (0.75 + 0.25 * Math.sin(L[i] * 40 + i));
    C[i * 3] = C0[i * 3] * f; C[i * 3 + 1] = C0[i * 3 + 1] * f; C[i * 3 + 2] = C0[i * 3 + 2] * f;
  }
  FW.pts.geometry.attributes.position.needsUpdate = true; FW.pts.geometry.attributes.color.needsUpdate = true;
}
export const VILLA_F = { cx: 14, cz: 16, rx: 8, rz: 5.6 };
export function updateVilla(t) {
  const C = VILLA.crowd; if (!C) return;
  const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry), by = VILLA.y;
  const rot = (lx, lz) => [VILLA.x + lx * cs + lz * sn, VILLA.z - lx * sn + lz * cs]; rot.ry = VILLA.ry;
  for (const c of VILLA.dancers) placeCouple(C, c, t, VILLA_F, 0, 0, by, rot);
  VILLA.sway.forEach((a, i) => C.set(a, a.x, a.y, a.z, a.yaw + Math.sin(t * 2.2 + i) * 0.12, 1, Math.sin(t * 4.4 + i) * 0.05));
  updateVillaRooms(t, C, rot);   // V28: Zonen, Türen, Tänzer im Ballsaal, Raumnamen
  C.flag();
}
export function buildMountains() {
  // Ein Netz bis an den Horizont: in der Mitte dicht (etwa 18 m), nach außen immer gröber
  const N = 440, HALF = 13000;
  const geo = new T.PlaneGeometry(2, 2, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const rnd = TER.rnd;
  const warp = u => u * (0.3 + 0.7 * u * u) * HALF;
  for (let i = 0; i < pos.count; i++) {
    const x = warp(pos.getX(i)), z = warp(pos.getZ(i));
    pos.setXYZ(i, x, terrainHeight(x, z - 100) - serpSink(x, z - 100), z);
  }
  geo.computeVertexNormals();
  const mat = new T.ShaderMaterial({
    uniforms: U,
    vertexShader: `varying vec3 vW; varying vec3 vN; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vec4 mv = viewMatrix*w; vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir; uniform vec3 uTeal; uniform vec3 uVilla; uniform vec3 uVillaRot; uniform vec3 uCam; uniform float uSnowCover; uniform float uMoonLit; varying vec3 vW; varying vec3 vN; varying float vD;
      ${FOG_GLSL}
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ return vnoise(p)*0.5 + vnoise(p*2.03+3.1)*0.25 + vnoise(p*4.11+7.3)*0.125 + vnoise(p*8.3+1.7)*0.0625; }
      void main(){
        // V33: im Grundriss der Villa kein Hang (das grobe Geländenetz ragte sonst in die Räume)
        #ifdef VILLA_CUT
        if (uVillaRot.z > 0.5) { vec2 dq = vW.xz - uVilla.xz; float hx = abs(dq.x*uVillaRot.x - dq.y*uVillaRot.y), hz = dq.x*uVillaRot.y + dq.y*uVillaRot.x;
          if (hx < 55.4 && hz > -23.4 && (hz < -0.9 || (hx > 29.2 && hz < 7.4)) && vW.y > uVilla.y - 30.0) discard; }
        #endif
        vec3 n0 = normalize(vN);
        // Feinrelief: Rauschen als Höhe, daraus eine gestörte Normale
        float fade = 1.0 - smoothstep(250.0, 1300.0, vD);
        vec2 q = vW.xz * 0.045 + vec2(0.0, vW.y * 0.02);
        float hgt = fbm(q) * 6.0 + vnoise(vW.xz * 0.35) * 0.6 * (1.0 - smoothstep(80.0, 300.0, vD));
        vec3 dpx = dFdx(vW), dpy = dFdy(vW);
        float dhx = dFdx(hgt), dhy = dFdy(hgt);
        vec3 r1 = cross(dpy, n0), r2 = cross(n0, dpx);
        float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
        vec3 n = normalize(abs(det) * n0 - grad * 0.9 * fade);
        if (dot(n, n) < 0.5 || abs(det) < 1e-6) n = n0;
        float moon = max(dot(n, uMoonDir), 0.0);
        float steep = 1.0 - n0.y;
        float strata = 0.75 + 0.5*vnoise(vec2(vW.y*0.09, (vW.x + vW.z)*0.01)) * (0.7 + 0.6*vnoise(vW.xz*0.02));
        float tone = 0.7 + 0.6*fbm(vW.xz*0.006);
        vec3 rock = mix(vec3(0.016, 0.03, 0.04), vec3(0.03, 0.035, 0.04), fbm(vW.xz*0.01)) * strata * tone;
        rock += vec3(0.09, 0.12, 0.16) * moon * strata;
        rock *= 0.65 + 0.35*smoothstep(-2.0, 3.0, hgt - 2.5);
        // Grasige, bewaldete Hänge unten, nackter Fels in den Steilwänden
        float meadow = smoothstep(0.45, 0.2, steep) * (1.0 - smoothstep(320.0, 520.0, vW.y)) * smoothstep(-170.0, -120.0, vW.y + 40.0*vnoise(vW.xz*0.01));
        rock = mix(rock, (vec3(0.012, 0.03, 0.026) + vec3(0.04, 0.07, 0.07)*moon) * (0.8 + 0.4*vnoise(vW.xz*0.08)), meadow*0.8);
        float snowLine = 640.0 + 160.0*fbm(vW.xz*0.003) - 60.0*n0.y - uSnowCover * 520.0;
        float snow = smoothstep(snowLine - 50.0, snowLine + 30.0, vW.y + 40.0*(vnoise(vW.xz*0.05) - 0.5)) * smoothstep(0.86, 0.42, steep + 0.15*(vnoise(vW.xz*0.2) - 0.5));
        // V30: Schnee auch an den Klippen: liegt auf Bändern und Simsen der Felsschichten, in Rinnen und auf flacheren Stufen; nur die
        // senkrechten Wände bleiben dunkel. Unten im Tal eine dünne, fleckige Decke über Wiese und Hängen.
        float ledge = smoothstep(0.55, 0.85, n.y) * smoothstep(0.45, 0.62, vnoise(vec2(vW.y*0.09, (vW.x + vW.z)*0.01)) + 0.25*fbm(vW.xz*0.04));
        float crev = smoothstep(0.6, 0.8, fbm(vW.xz*0.02 + vW.y*0.004)) * smoothstep(0.98, 0.55, steep);
        snow = max(snow, (max(ledge, crev) * 0.85) * smoothstep(-160.0, -60.0, vW.y) * clamp(0.6 + uSnowCover, 0.0, 1.0));
        snow = max(snow, smoothstep(0.42, 0.18, steep) * smoothstep(0.35, 0.65, fbm(vW.xz*0.03) + uSnowCover * 0.5) * 0.75);
        vec3 snowCol = vec3(0.16, 0.2, 0.27) + vec3(0.55, 0.62, 0.78)*pow(moon, 1.4) + uTeal*0.06;
        vec3 col = mix(rock, snowCol, snow);
        // Stadtschein auf den Hängen, die zur Stadt zeigen
        vec3 toCity = normalize(vec3(-vW.x, 0.0, -vW.z));
        float face = max(dot(n, toCity), 0.0);
        col += uTeal * 0.32 * face * exp(-max(vW.y + 180.0, 0.0)/420.0);
        col += vec3(0.9, 0.6, 0.3) * 0.22 * exp(-distance(vW, uVilla)/110.0);
        float fogF = vespFog(vD, vW.y, uCam.y, uFogDensity, 0.07);
        vec3 fogCol = mix(uFogColor*1.35, uFogColor*0.5, smoothstep(0.0, 900.0, vW.y));
        gl_FragColor = vec4(mix(col, fogCol, clamp(fogF, 0.0, 1.0)), 1.0);
      }`,
  });
  mat.extensions.derivatives = true;
  const m = new T.Mesh(geo, mat); m.position.set(0, 0, -100); m.frustumCulled = false; scene.add(m);
  // V33: die Dreiecke um die Villa bekommen ein eigenes Netz, das im Hausgrundriss verworfen wird (discard nur dort, nicht im ganzen Gelände)
  if (VILLA.y) {
    const ix = geo.index.array, P = pos.array, keep = [], cut = [];
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, x = (P[a] + P[b] + P[c]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - 100;
      (Math.hypot(x - VILLA.x, z - VILLA.z) < 140 ? cut : keep).push(ix[t], ix[t + 1], ix[t + 2]);
    }
    const g2 = new T.BufferGeometry(); for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]); g2.setIndex(cut);
    geo.setIndex(keep);
    const mc = mat.clone(); mc.uniforms = U; mc.defines = { VILLA_CUT: 1 }; mc.extensions.derivatives = true;
    const m2 = new T.Mesh(g2, mc); m2.position.copy(m.position); m2.frustumCulled = false; scene.add(m2);
  }
  buildSerpTerrain(mat);
  // Tannenwald im Tal und an den unteren Hängen
  const pine = mergeGeos([new T.ConeGeometry(2.6, 7, 6).translate(0, 5.5, 0), new T.ConeGeometry(1.9, 6, 6).translate(0, 9.5, 0), new T.CylinderGeometry(0.3, 0.4, 2.2, 5).translate(0, 1.1, 0)]);
  const pm = new T.InstancedMesh(pine, snowy(new T.MeshStandardMaterial({ color: 0x0f2a28, roughness: 0.95 }), 0.9), 2600);
  const mm = new T.Matrix4(); let np = 0;
  for (let tries = 0; tries < 9000 && np < 2600; tries++) {
    const ang = rnd() * Math.PI * 2, rr = 1130 + rnd() * 1100;
    const x = Math.sin(ang) * rr, z = -Math.cos(ang) * rr - 100;
    const info = terrainInfo(x, z);
    if (info.south > 0.3 || info.met < info.rim + VALLEY_W || Math.hypot(x - VILLA.x, z - VILLA.z) < VILLA.r + 30) continue;
    const y = terrainHeight(x, z);
    if (y > 420 || y < WATER_Y + 3 || serpNear(x, z, 14)) continue;
    const sc = 0.8 + rnd() * 0.9;
    mm.makeScale(sc, sc, sc).setPosition(x, y, z); pm.setMatrixAt(np++, mm);
  }
  pm.count = np; pm.frustumCulled = false; scene.add(pm);
  // Wasserfälle über den Felsabbruch
  const wfMat = new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform float uFogDensity; varying vec2 vUv; varying float vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float fall = noise(vec2(vUv.x*9.0, vUv.y*4.0 + uTime*1.4)) * noise(vec2(vUv.x*22.0 + 3.0, vUv.y*9.0 + uTime*2.2));
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float mist = (1.0 - smoothstep(0.0, 0.35, vUv.y)) * 0.5;
        float a = (0.25 + 1.3*fall) * edge * (0.55 + 0.45*vUv.y) + mist;
        a *= exp(-uFogDensity*uFogDensity*vD*vD*0.3);
        gl_FragColor = vec4(vec3(0.55, 0.85, 0.9) * a * 0.55, 1.0); }`,
  });
  // Wasserfälle stürzen vom Steilufer der Berge in den See
  for (let k = 0; k < 11; k++) {
    const ang = -Math.PI * 0.72 + (k + 0.5) / 11 * Math.PI * 1.44 + (rnd() - 0.5) * 0.12;
    if (Math.abs(ang) < 0.08) continue;
    const sx = Math.sin(ang), sz = -Math.cos(ang);
    let r = 1000, top = 0;
    for (; r < 2200; r += 2) if (terrainHeightRaw(sx * r, sz * r - 100) > 20) break;
    let dTop = 0;
    for (let d = 0; d < 80; d += 4) { const hh = terrainHeightRaw(sx * (r + d), sz * (r + d) - 100); if (hh > top && hh < 190) { top = hh; dTop = d; } }
    const x = sx * (r - 4), z = sz * (r - 4) - 100;
    if (Math.hypot(x - VILLA.x, z - VILLA.z) < VILLA.r + 60 || top < 40) continue;
    // die Bahn folgt der Felswand: unten vor dem Fels, oben an der Kante
    const w = 10 + rnd() * 14, h = top - WATER_Y, run = dTop + 4, len = Math.hypot(h, run);
    const m = new T.Mesh(new T.PlaneGeometry(w, len), wfMat);
    m.rotation.order = 'YXZ'; m.rotation.set(Math.atan2(run, h), Math.atan2(sx, sz), 0);
    m.position.set(x + sx * run / 2, WATER_Y + h / 2, z + sz * run / 2); m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
    shafts.push({ x, z, y: WATER_Y, h: 40, w: w * 2.2, c: [0.4, 0.8, 0.85] });
  }
  // ein paar Berghütten mit Lichtern an den Hängen
  const pts = [];
  for (let k = 0; k < 14; k++) {
    const ang = rnd() * Math.PI * 1.4 - Math.PI * 0.7 + Math.PI, r = 1500 + rnd() * 500;
    const x = Math.sin(ang) * r, z = -Math.cos(ang) * r - 100;
    const y = terrainHeight(x, z) + 4;
    if (y < 30) continue;
    for (let j = 0; j < 3 + Math.floor(rnd() * 4); j++) pts.push({ p: [x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 10, z + (rnd() - 0.5) * 60], c: [1.2, 0.8, 0.45], s: 5, ph: 0, bl: 0 });
  }
  if (pts.length) scene.add(makeGlowPoints(pts));
}

// UVs aus Weltkoordinaten: Böden von oben, Wände entlang ihrer Fläche, damit Muster nicht gestreckt werden
export function worldUV(g, sc) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
  for (let i = 0, j = 0; i < p.length; i += 3, j += 2) {
    if (Math.abs(n[i + 1]) > 0.7) { uv[j] = p[i] / sc; uv[j + 1] = p[i + 2] / sc; }
    else { const l = Math.hypot(n[i], n[i + 2]) || 1; uv[j] = (p[i] * -n[i + 2] + p[i + 2] * n[i]) / l / sc; uv[j + 1] = p[i + 1] / sc; }
  }
  g.attributes.uv.needsUpdate = true;
}
// Marmorboden: polierte Platten im Schachbrett, Adern, feine Fugen, Messingeinlagen
export function marbleFloorTextures() {
  const rr = mulberry32(6262);
  return texSet(512, (g, gr, gh, W) => {
    const n = 4, s = W / n;
    gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * s, y = j * s, light = (i + j) % 2 === 0;
      const gg = g.createLinearGradient(x, y, x + s, y + s);
      if (light) { gg.addColorStop(0, '#ece4d4'); gg.addColorStop(1, '#d6ccb8'); } else { gg.addColorStop(0, '#1d1a19'); gg.addColorStop(1, '#121010'); }
      g.fillStyle = gg; g.fillRect(x, y, s, s);
      g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = light ? `rgba(120,105,90,${0.1 + rr() * 0.22})` : `rgba(170,150,120,${0.05 + rr() * 0.12})`; g.lineWidth = 0.4 + rr() * 1.4;
        g.beginPath(); let px = x + rr() * s, py = y - 4; g.moveTo(px, py);
        while (py < y + s + 4) { const nx = px + (rr() - 0.5) * 40, ny = py + 8 + rr() * 24; g.quadraticCurveTo(px + (rr() - 0.5) * 30, (py + ny) / 2, nx, ny); px = nx; py = ny; }
        g.stroke();
      }
      for (let k = 0; k < 300; k++) { g.fillStyle = light ? `rgba(150,140,120,${rr() * 0.15})` : `rgba(90,80,70,${rr() * 0.2})`; g.fillRect(x + rr() * s, y + rr() * s, 1, 1); }
      g.restore();
      const rv = Math.round(18 + rr() * 22); gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(x, y, s, s);
      gh.fillStyle = 'rgb(220,0,0)'; gh.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
    }
    g.strokeStyle = '#b8924e'; g.lineWidth = 2; gr.strokeStyle = '#555'; gr.lineWidth = 3;
    for (let i = 0; i <= n; i++) for (const c of [g, gr]) { c.beginPath(); c.moveTo(i * s, 0); c.lineTo(i * s, W); c.moveTo(0, i * s); c.lineTo(W, i * s); c.stroke(); }
  }, 1.2);
}
// Teppich: Art-Déco-Muster mit Bordüre, Mittelmedaillon und Flor
export function rugTex() {
  return canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(8181);
    g.fillStyle = '#4e1216'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c2a2a'; g.fillRect(14, 14, W - 28, H - 28); g.fillStyle = '#5a161a'; g.fillRect(40, 40, W - 80, H - 80);
    g.strokeStyle = '#c9a258'; g.lineWidth = 3; g.strokeRect(20, 20, W - 40, H - 40); g.strokeRect(36, 36, W - 72, H - 72);
    for (let i = 0; i < 16; i++) { const t = 40 + i * (W - 80) / 16; for (const [x, y, r] of [[t + 14, 27, 0], [t + 14, H - 27, Math.PI], [27, t + 14, -Math.PI / 2], [W - 27, t + 14, Math.PI / 2]]) { g.save(); g.translate(x, y); g.rotate(r); g.fillStyle = '#c9a258'; g.beginPath(); g.moveTo(-8, 5); g.lineTo(0, -5); g.lineTo(8, 5); g.fill(); g.restore(); } }
    g.save(); g.translate(W / 2, H / 2);
    for (let r = 150; r > 20; r -= 26) { g.fillStyle = r % 52 === 46 ? '#1c3a36' : '#6e1c20'; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.8, 0); g.lineTo(0, r); g.lineTo(-r * 0.8, 0); g.closePath(); g.fill(); g.strokeStyle = '#c9a258'; g.lineWidth = 2; g.stroke(); }
    g.strokeStyle = 'rgba(201,162,88,0.55)'; g.lineWidth = 1.5; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); g.lineTo(Math.cos(a) * 200, Math.sin(a) * 200); g.stroke(); }
    g.restore();
    for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,220,200'},${rr() * 0.07})`; g.fillRect(rr() * W, rr() * H, 1, 1.5); }
  });
}
// Holzvertäfelung: Füllungen mit Rahmen und Maserung
export function woodPanelTextures() {
  const rr = mulberry32(7373);
  return texSet(256, (g, gr, gh, W) => {
    g.fillStyle = '#3a2214'; g.fillRect(0, 0, W, W); gr.fillStyle = '#6a6a6a'; gr.fillRect(0, 0, W, W); gh.fillStyle = 'rgb(120,0,0)'; gh.fillRect(0, 0, W, W);
    for (let k = 0; k < 140; k++) { g.strokeStyle = `rgba(${rr() < 0.5 ? '20,10,4' : '90,56,30'},${0.15 + rr() * 0.25})`; g.lineWidth = 0.5 + rr(); const y = rr() * W; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + (rr() - 0.5) * 8, W * 0.7, y + (rr() - 0.5) * 8, W, y); g.stroke(); }
    for (const [x, y, w, h] of [[16, 20, 96, 216], [144, 20, 96, 216]]) {
      g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(200,150,80,0.35)'; g.lineWidth = 1.5; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
      gh.fillStyle = 'rgb(60,0,0)'; gh.fillRect(x, y, w, h); gh.fillStyle = 'rgb(170,0,0)'; gh.fillRect(x + 8, y + 8, w - 16, h - 16);
    }
  }, 2.5);
}

/* ---------- Boden ---------- */
// Farbe, Rauheit und Relief (Normalenkarte aus einer Höhenkarte) aus einer Zeichenfunktion
// Unscharfmaskierung (nahtlos): Farbe + k * (Farbe - 3x3-Mittel) lässt Fugen und Körnung schärfer wirken
export function sharpen(g, N, k) {
  const im = g.getImageData(0, 0, N, N), d = im.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < N; y++) {
    const ym = ((y + N - 1) % N) * N, y0 = y * N, yp = ((y + 1) % N) * N;
    for (let x = 0; x < N; x++) {
      const xm = (x + N - 1) % N, xp = (x + 1) % N, i = (y0 + x) * 4;
      for (let c = 0; c < 3; c++) {
        const b = (src[(ym + xm) * 4 + c] + src[(ym + x) * 4 + c] + src[(ym + xp) * 4 + c] + src[(y0 + xm) * 4 + c] + src[i + c] + src[(y0 + xp) * 4 + c] + src[(yp + xm) * 4 + c] + src[(yp + x) * 4 + c] + src[(yp + xp) * 4 + c]) / 9;
        d[i + c] = src[i + c] + k * (src[i + c] - b);
      }
    }
  }
  g.putImageData(im, 0, 0);
}
export function texSet(W, draw, strength = 2.2, S = 0) {
  // am PC feiner: kleine Kacheln dreifach, große zweieinhalbfach aufgelöst (S = 0); S fest vorgegeben gilt nur am PC
  if (MOBILE) S = 1; else if (!S) S = W <= 256 ? 3 : 2.5;
  const N = W * S;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'); g.scale(S, S); return [c, g]; };
  const [c, g] = mk(), [r, gr] = mk(), [, gh] = mk();
  draw(g, gr, gh, W);
  if (!MOBILE) sharpen(g, N, 0.5);
  const hd = gh.getImageData(0, 0, N, N).data, nc = document.createElement('canvas'); nc.width = nc.height = N;
  const nctx = nc.getContext('2d'), out = nctx.createImageData(N, N), o = out.data;
  // Höhe als Zahl 0..1 einmal vorab, Nachbarn ohne Modulo je Pixel (gleiche Rechnung wie vorher, nur schneller)
  const hf = new Float64Array(N * N); for (let j = 0; j < N * N; j++) hf[j] = hd[j * 4] / 255;
  for (let y = 0; y < N; y++) {
    const r0 = y * N, rm = ((y + N - 1) % N) * N, rp = ((y + 1) % N) * N;
    for (let x = 0; x < N; x++) {
      const xm = x === 0 ? N - 1 : x - 1, xp = x === N - 1 ? 0 : x + 1;
      const dx = (hf[r0 + xp] - hf[r0 + xm]) * strength * S / 2, dy = (hf[rp + x] - hf[rm + x]) * strength * S / 2, l = Math.hypot(dx, dy, 1), i = (r0 + x) * 4;
      o[i] = (-dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255;
    }
  }
  nctx.putImageData(out, 0, 0);
  const map = new T.CanvasTexture(c), rough = new T.CanvasTexture(r), normal = new T.CanvasTexture(nc);
  for (const t of [map, rough, normal]) { t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = ANISO; if (MOBILE) t.onUpdate = () => { t.image.width = t.image.height = 1; t.onUpdate = null; }; }
  return { map, rough, normal };
}
// Gehwegplatten: Betonplatten mit Fugen, Körnung, Rissen, Flecken und nassen Stellen
export function slabTextures() {
  const rr = mulberry32(4242);
  return texSet(512, (g, gr, gh, W) => {
    g.fillStyle = '#2a2e31'; g.fillRect(0, 0, W, W); gr.fillStyle = '#404040'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    const n = 3, s = W / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = i * s, y = j * s, v = 0.9 + rr() * 0.14, warm = rr() * 6;
      g.fillStyle = `rgb(${Math.round((74 + warm) * v)},${Math.round(78 * v)},${Math.round((84 - warm) * v)})`; g.fillRect(x + 2, y + 2, s - 4, s - 4);
      for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '20,20,22' : '120,122,120'},${0.05 + rr() * 0.09})`; g.fillRect(x + 2 + rr() * (s - 4), y + 2 + rr() * (s - 4), 0.5 + rr(), 0.5 + rr()); }
      for (let k = 0; k < 5; k++) { const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, `rgba(${rr() < 0.6 ? '25,24,22' : '140,140,135'},0.12)`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x + rr() * s, y + rr() * s); g.scale(10 + rr() * 30, 8 + rr() * 22); g.fillStyle = rg; g.fillRect(-1, -1, 2, 2); g.restore(); }
      g.strokeStyle = 'rgba(160,160,155,0.12)'; g.lineWidth = 1.5; g.strokeRect(x + 3.5, y + 3.5, s - 7, s - 7);
      if (rr() < 0.25) { g.strokeStyle = 'rgba(15,15,16,0.7)'; g.lineWidth = 1; g.beginPath(); let px = x + rr() * s, py = y + 2; g.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (rr() - 0.5) * 22; py += s / 7; g.lineTo(px, py); } g.stroke(); }
      if (rr() < 0.4) { g.fillStyle = 'rgba(20,18,16,0.25)'; g.beginPath(); g.ellipse(x + rr() * s, y + rr() * s, 6 + rr() * 22, 4 + rr() * 14, rr() * 3, 0, Math.PI * 2); g.fill(); }
      const wet = rr(); const rv = Math.round(60 + 130 * (1 - wet * 0.8));
      gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(x + 2, y + 2, s - 4, s - 4);
      if (wet > 0.55) { gr.fillStyle = 'rgb(25,25,25)'; gr.beginPath(); gr.ellipse(x + s * 0.5, y + s * 0.5, s * 0.35 * wet, s * 0.25 * wet, rr() * 3, 0, Math.PI * 2); gr.fill(); }
      const hgr = gh.createLinearGradient(x, y, x + s, y + s); hgr.addColorStop(0, 'rgb(210,0,0)'); hgr.addColorStop(1, 'rgb(180,0,0)');
      gh.fillStyle = hgr; gh.fillRect(x + 2, y + 2, s - 4, s - 4); gh.fillStyle = 'rgb(225,0,0)'; gh.fillRect(x + 5, y + 5, s - 10, s - 10);
    }
  }, 2.0);
}
// Stabparkett für Innenräume: versetzte Eichendielen mit Maserung, Astlöchern, Fugen und Glanz
export function parquetTextures() {
  const rr = mulberry32(5151);
  return texSet(512, (g, gr, gh, W) => {
    g.fillStyle = '#1a0f08'; g.fillRect(0, 0, W, W); gr.fillStyle = '#707070'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    const B = W / 24;
    for (let row = 0; row < 24; row++) {
      const y = row * B; let x = -rr() * 200;
      while (x < W) {
        const len = 90 + rr() * 140, v = 0.72 + rr() * 0.42, c = [128 * v, 78 * v, 42 * v];
        // Nahtlos: Dielen, die über den Rand laufen, werden auf der anderen Seite fortgesetzt
        for (const ox of [0, -W, W]) {
          const x0 = x + ox; if (x0 > W || x0 + len < 0) continue;
          const gg = g.createLinearGradient(0, y, 0, y + B); gg.addColorStop(0, `rgb(${c.map(q => Math.round(q * 1.08)).join(',')})`); gg.addColorStop(1, `rgb(${c.map(q => Math.round(q * 0.86)).join(',')})`);
          g.fillStyle = gg; g.fillRect(x0 + 0.7, y + 0.7, len - 1.4, B - 1.4);
          const r2 = mulberry32(Math.floor(x * 1000 + row));
          for (let k = 0; k < 7; k++) { g.strokeStyle = `rgba(${r2() < 0.5 ? '45,22,8' : '170,110,60'},${0.12 + r2() * 0.22})`; g.lineWidth = 0.4 + r2() * 0.8; const yy = y + 2 + r2() * (B - 4), a1 = (r2() - 0.5) * 3, a2 = (r2() - 0.5) * 3; g.beginPath(); g.moveTo(x0 + 1, yy); g.bezierCurveTo(x0 + len * 0.33, yy + a1, x0 + len * 0.66, yy + a2, x0 + len - 1, yy + (a1 + a2) * 0.3); g.stroke(); }
          if (r2() < 0.25) { const kx = x0 + 10 + r2() * (len - 20), ky = y + B * (0.3 + r2() * 0.4); g.fillStyle = 'rgba(40,18,6,0.65)'; g.beginPath(); g.ellipse(kx, ky, 2 + r2() * 2.5, 1.2 + r2(), 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(50,24,8,0.3)'; g.lineWidth = 0.6; g.beginPath(); g.ellipse(kx, ky, 6, 2.6, 0, 0, Math.PI * 2); g.stroke(); }
          const hv = Math.round(170 + r2() * 60); gh.fillStyle = `rgb(${hv},0,0)`; gh.fillRect(x0 + 0.7, y + 0.7, len - 1.4, B - 1.4);
          const rv = Math.round(60 + r2() * 60); gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(x0 + 0.7, y + 0.7, len - 1.4, B - 1.4);
        }
        x += len;
      }
    }
    // Gebrauchsspuren: Kratzer und matte Laufwege
    for (let k = 0; k < 120; k++) { g.strokeStyle = `rgba(200,160,110,${rr() * 0.08})`; g.lineWidth = 0.4; const x = rr() * W, y = rr() * W; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rr() - 0.5) * 30, y + (rr() - 0.5) * 8); g.stroke(); }
  }, 1.4);
}
// Tapete mit Art-Déco-Fächermuster
export function wallpaperTex(base = '#3b2c22', ink = 'rgba(214,170,90,0.35)') {
  return canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    g.strokeStyle = ink; g.lineWidth = 2;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const cx = i * 64 + (j % 2) * 32, cy = j * 64 + 48;
      for (let r = 10; r <= 34; r += 8) { g.beginPath(); g.arc(cx, cy, r, Math.PI, 0); g.stroke(); }
      for (let k = 0; k <= 6; k++) { const a = Math.PI + k * Math.PI / 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34); g.stroke(); }
    }
    g.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = 0; x < W; x += 8) g.fillRect(x, 0, 3, H);
  });
}
export function cobbleTextures() {
  // Kleinpflaster mit Fugen, nassen Glanzflecken und einem Relief (Normalenkarte) aus einer Höhenkarte
  return texSet(512, (g, gr, gh, W) => {
    g.fillStyle = '#10181b'; g.fillRect(0, 0, W, W);
    gr.fillStyle = '#5a5a5a'; gr.fillRect(0, 0, W, W);
    gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    const rr = mulberry32(777);
    const cw = 26, ch = 20;
    for (let y = -ch; y < W + ch; y += ch) for (let x = ((y / ch + 2) % 2) * cw / 2 - cw; x < W + cw; x += cw) {
      const v = 0.72 + rr() * 0.55, wet = rr(), tint = rr();
      const px = x + rr() * 2 - 1, py = y + rr() * 2 - 1, w0 = cw - 2.6 - rr() * 1.2, h0 = ch - 2.6 - rr() * 1.2;
      // V30: hellere Steine mit mehr Farbchargen (bläulicher und warmer Granit), damit das Pflaster im Nachtlicht lesbar bleibt
      const base = [74 + 22 * tint, 80 + 4 * tint, 88 - 14 * tint].map(q => Math.round(q * v));
      const gg = g.createLinearGradient(0, py, 0, py + h0);
      gg.addColorStop(0, `rgb(${base.map(q => Math.min(255, q + 14)).join(',')})`); gg.addColorStop(1, `rgb(${base.map(q => Math.round(q * 0.78)).join(',')})`);
      g.fillStyle = gg; g.beginPath(); g.roundRect(px + 1.3, py + 1.3, w0, h0, 5); g.fill();
      for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,255,255'},${0.04 + rr() * 0.05})`; g.fillRect(px + 2 + rr() * (w0 - 4), py + 2 + rr() * (h0 - 4), 1 + rr() * 2, 1 + rr() * 2); }
      g.fillStyle = 'rgba(120,200,210,' + (0.04 + 0.1 * wet) + ')';
      g.beginPath(); g.roundRect(px + 4, py + 3, w0 - 7, 4, 2); g.fill();
      const rough = Math.round(70 + 120 * (1 - wet) * (0.6 + 0.4 * rr()));
      gr.fillStyle = `rgb(${rough},${rough},${rough})`; gr.beginPath(); gr.roundRect(px + 1.3, py + 1.3, w0, h0, 5); gr.fill();
      const hg = gh.createRadialGradient(px + 1.3 + w0 / 2, py + 1.3 + h0 / 2, 1, px + 1.3 + w0 / 2, py + 1.3 + h0 / 2, w0 * 0.62);
      hg.addColorStop(0, `rgb(${200 + Math.round(rr() * 55)},0,0)`); hg.addColorStop(0.7, 'rgb(150,0,0)'); hg.addColorStop(1, 'rgb(40,0,0)');
      gh.fillStyle = hg; gh.beginPath(); gh.roundRect(px + 1.3, py + 1.3, w0, h0, 5); gh.fill();
    }
  }, MOBILE ? 4.4 : 2.2, 2);
}
// Straßendetails im Shader, damit keine Stelle der anderen gleicht: Farbchargen der Steine, ausgebesserte Flecken,
// Pfützen mit Spiegelglanz, Kanaldeckel und Gitterroste, Laub, Zeitungsfetzen, Ölflecken; auf dem Gehweg Kaugummi und Versorgungsdeckel
export function streetDetail(mat, walk) {
  // V27: walk === 'plaza' = Belmont-Platz (eigenes Fugenbild, daher ohne Plattenraster, Kaugummi und Roste)
  const plaza = walk === 'plaza';
  const prev = mat.onBeforeCompile;
  mat.userData.street = true;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    // V25: Nässe, Schneedecke, Regenringe und die echte Spiegelung der Straße (water.js rendert sie bei Nässe in Bodenhöhe)
    sh.uniforms.uTimeSd = U.uTime;
    for (const k of ['uWet', 'uSnowCover', 'uRain', 'uRefl', 'uReflMat', 'uStreetRefl', 'uFogColor', 'uMoonDir', 'uMoonLit', 'uLamps']) sh.uniforms[k] = U[k];
    sh.vertexShader = 'varying vec3 vSdW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vSdW = (modelMatrix * ${walk === true ? 'instanceMatrix * ' : ''}vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = `#define SD_NL ${LAMP_N}
      uniform vec4 uLamps[16];
      varying vec3 vSdW; uniform float uWet, uSnowCover, uRain, uTimeSd, uStreetRefl, uMoonLit; uniform sampler2D uRefl; uniform mat4 uReflMat; uniform vec3 uFogColor, uMoonDir;
      float sdH(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
      float sdN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(sdH(i), sdH(i + vec2(1.0, 0.0)), f.x), mix(sdH(i + vec2(0.0, 1.0)), sdH(i + vec2(1.0, 1.0)), f.x), f.y); }
      ` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec2 sw = vSdW.xz; float sdTop = step(${walk ? '0.2' : '-1.0'}, vSdW.y);
        float sdPx = length(fwidth(sw)), sdFine = 1.0 - smoothstep(0.02, 0.12, sdPx);
        // Farbchargen und ausgebesserte Flächen: großräumig wechselnde Tönung
        float big = sdN(sw * 0.045) * 0.6 + sdN(sw * 0.13 + 17.0) * 0.4;
        diffuseColor.rgb *= mix(vec3(0.9, 0.92, 0.95), vec3(1.08, 1.03, 0.96), big);
        ${plaza ? '' : walk ? 'diffuseColor.rgb *= 0.9 + 0.2 * sdH(floor(sw / 1.0) + 3.1);' : 'diffuseColor.rgb *= mix(1.0, 0.82, smoothstep(0.62, 0.66, sdN(sw * 0.07 + 40.0)));'}
        // Pfützen
        // V25: je nasser, desto mehr und größere Pfützen; nasser Stein ist dunkler
        float pudN = sdN(sw * 0.09 + 5.0) * 0.75 + sdN(sw * 0.4) * 0.25;
        float pud = smoothstep(0.71 - 0.13 * uWet, 0.75 - 0.13 * uWet, pudN) * sdTop;
        diffuseColor.rgb *= (1.0 - 0.45 * pud) * (1.0 - 0.22 * uWet);
        // Schneedecke: zuerst in Fugen und Rinnen, dann geschlossen; Fahrspuren bleiben dunkler
        // V30: die dauernde leichte Decke (uSnowCover ab 0,4) liegt in Flecken und in den Fugen, Fahrspuren und Laufwege bleiben frei
        float sdSnow = min(uSnowCover * 1.25, 1.0) * sdTop * smoothstep(0.2, 0.55, uSnowCover * 0.9 + sdN(sw * 0.35 + 3.0) * 0.45 + sdN(sw * 1.7 + 8.0) * 0.12 - ${walk ? '0.2' : '0.42 * smoothstep(3.0, 0.0, abs(abs(fract(sw.x / 110.0 + 0.5) * 110.0 - 55.0) - 4.0)) - 0.12'});
        #ifdef USE_MAP
          sdSnow = max(sdSnow, (1.0 - smoothstep(0.1, 0.17, sampledDiffuseColor.g)) * smoothstep(0.25, 0.6, uSnowCover) * 0.8 * sdTop * sdFine${plaza ? ' * 0.0' : ''});
        #endif
        // Regenringe in den Pfützen
        vec2 sdRip = vec2(0.0);
        if (uRain > 0.01) for (int k = 0; k < 2; k++) {
          vec2 rp = sw * (k == 0 ? 2.2 : 3.4) + float(k) * 11.0, rc = floor(rp), rf = fract(rp) - 0.5;
          float h0 = sdH(rc + 0.37), age = fract(uTimeSd * 1.6 + h0 * 9.0);
          vec2 ro = rf - (vec2(sdH(rc + 1.7), sdH(rc + 4.1)) - 0.5) * 0.5; float rr = length(ro), R0 = age * 0.42;
          sdRip += ro / max(rr, 0.01) * sin((rr - R0) * 70.0) * smoothstep(0.05, 0.0, abs(rr - R0)) * (1.0 - age) * step(h0, uRain);
        }
        sdRip *= sdFine;
        // Ölflecken
        ${walk ? '' : 'diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.75, 0.82, sdN(sw * 0.6 + 9.0)) * step(0.7, sdN(sw * 0.05 + 2.0));'}
        // Kanaldeckel aus Gusseisen mit Rippen und Ringen; Gitterroste
        vec2 mc = floor(sw / 13.0), mo = (vec2(sdH(mc + 1.3), sdH(mc + 7.7)) * 0.7 + 0.15) * 13.0;
        vec2 md = sw - mc * 13.0 - mo; float mr = length(md);
        float manOn = step(${walk ? '0.92' : '0.8'}, sdH(mc + 4.4)) * sdTop${plaza ? ' * 0.0' : ''};
        float man = manOn * step(mr, ${walk ? '0.0' : '0.36'});
        float manRim = manOn * step(abs(mr - 0.35), 0.02) * ${walk ? '0.0' : '1.0'};
        float rib = step(0.5, fract(atan(md.y, md.x) * 3.8197)) * step(0.1, mr) * step(mr, 0.28) + step(abs(mr - 0.3), 0.012) + step(abs(mr - 0.12), 0.01);
        vec3 iron = vec3(0.09, 0.085, 0.08) * (0.9 + 0.3 * sdN(md * 20.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, iron * (1.0 + 0.6 * rib * sdFine), man);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.15, 0.14), manRim);
        vec2 gq = abs(md - vec2(1.6, 0.0));
        float grate = manOn * step(gq.x, ${walk ? '0.3' : '0.25'}) * step(gq.y, ${walk ? '0.3' : '0.45'}) * step(0.5, sdH(mc + 2.2));
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.02), vec3(0.12, 0.11, 0.1), step(0.45, fract(gq.y * ${walk ? '12.0' : '10.0'}))), grate);
        // Laub und Zeitungsfetzen, eher selten
        vec2 lc = floor(sw / 0.7), lo = fract(sw / 0.7) - vec2(sdH(lc + 0.5), sdH(lc + 9.1));
        float lr = sdH(lc + 3.3), la = sdH(lc + 6.6) * 6.28, lcs = cos(la), lsn = sin(la);
        vec2 lp = vec2(lo.x * lcs - lo.y * lsn, lo.x * lsn + lo.y * lcs);
        float leaf = step(0.965, lr) * step(length(lp * vec2(1.0, 2.2)), 0.06) * sdTop;
        float paper = step(lr, 0.008) * step(abs(lp.x), 0.1) * step(abs(lp.y), 0.07) * sdTop;
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.32, 0.16, 0.05), vec3(0.4, 0.3, 0.08), sdH(lc)), leaf * sdFine);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.6, 0.55) * (0.85 + 0.15 * step(0.5, fract(lp.y * 40.0))), paper * sdFine);
        ${walk && !plaza ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.13, 0.13), step(0.985, sdH(floor(sw * 6.0))) * sdTop * sdFine * step(length(fract(sw * 6.0) - 0.5), 0.3));' : ''}
        float sdPud = pud * (1.0 - man) * (1.0 - grate);
        ${walk ? '' : `
        // Rinnstein entlang der Bordsteine (dunkler, nass) und Fußgängerüberwege aus Messingnägeln an den Kreuzungen (nur im Straßenraster)
        float inGrid = step(-1000.0, sw.x) * step(sw.x, 1000.0) * step(-1000.0, sw.y) * step(sw.y, 500.0);
        float hwA = 11.0, axd = abs(mod(sw.x + 990.0 + 55.0, 110.0) - 55.0); if (abs(sw.x) < 55.0) { axd = abs(sw.x); hwA = 22.0; }
        float hwS = 7.0, azd = abs(mod(sw.y + 980.0 + 35.0, 70.0) - 35.0); if (abs(sw.y - 490.0) < 35.0) { azd = abs(sw.y - 490.0); hwS = 15.0; }
        float bxg = axd - hwA, bzg = azd - hwS;
        // V30: Abstand zur Bordkante mit den gerundeten Blockecken (Radius 5 m wie in island.js), vorher lief die Rinne an den Ecken spitz
        vec2 cq = -vec2(bxg, bzg) + 5.0; float dCurb = length(max(cq, 0.0)) + min(max(cq.x, cq.y), 0.0) - 5.0;
        float gutter = (1.0 - smoothstep(0.15, 0.7, dCurb)) * inGrid * step(0.0, dCurb);
        diffuseColor.rgb *= 1.0 - 0.28 * gutter;
        // Rinnstein: drei Reihen längs gelegter Granitsteine (45 cm), heller als das Pflaster, Fugen quer, in der Mitte ein nasser Wasserfilm
        float gStrip = (1.0 - step(0.45, dCurb)) * step(0.0, dCurb) * inGrid;
        float gAlong = abs(bxg) < abs(bzg) ? sw.y : sw.x;
        float gRow = floor(dCurb / 0.15), gJ = step(0.46, abs(fract(gAlong / 0.42 + sdH(vec2(gRow, 3.0))) - 0.5)) + step(0.45, abs(fract(dCurb / 0.15) - 0.5));
        vec3 gStone = vec3(0.3, 0.31, 0.32) * (0.8 + 0.35 * sdH(vec2(floor(gAlong / 0.42 + sdH(vec2(gRow, 3.0))), gRow)));
        diffuseColor.rgb = mix(diffuseColor.rgb, gStone * (1.0 - 0.65 * min(gJ, 1.0)), gStrip * 0.9);
        float gFilm = gStrip * smoothstep(0.08, 0.0, abs(dCurb - 0.2)) * (0.4 + 0.6 * uWet);
        float studA = step(abs(azd - (hwS + 1.4)), 0.9) * step(axd, hwA - 0.3) * step(bzg, 2.4);
        float studS = step(abs(axd - (hwA + 1.4)), 0.9) * step(azd, hwS - 0.3) * step(bxg, 2.4);
        vec2 sq = fract(sw * 2.0) - 0.5; float stud = step(length(sq), 0.14) * inGrid * sdFine;
        float studRow = step(abs(fract((bzg > 0.0 ? azd - hwS : axd - hwA) * 2.0 / 1.0) - 0.5), 0.15);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.45, 0.28) * (0.8 + 0.4 * sdH(floor(sw * 2.0))), stud * clamp(studA + studS, 0.0, 1.0) * studRow);
        sdPud = max(sdPud * (1.0 - gutter * 0.5), gFilm);
        sdSnow = max(sdSnow * (1.0 - gStrip * 0.5), gStrip * (1.0 - step(0.15, dCurb)) * smoothstep(0.3, 0.7, uSnowCover));`}
        sdPud *= 1.0 - sdSnow;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.68, 0.78), sdSnow);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor *= 1.0 - 0.45 * uWet; roughnessFactor = mix(roughnessFactor, 0.04, sdPud); roughnessFactor = mix(roughnessFactor, 0.55, man); roughnessFactor = mix(roughnessFactor, 0.8, sdSnow);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, normalize(vNormal), max(sdPud * 0.9, sdSnow * 0.7)));
        normal = normalize(normal + vec3(sdRip.x, 0.0, sdRip.y) * 0.25 * sdPud);`)
      .replace('#include <output_fragment>', `{
        vec3 sdV = normalize(cameraPosition - vSdW);
        // V30: warmes Laternenlicht: Lichtkreis um jeden Mast und ein gestreckter Glanz auf nassen Steinen, Pfützen und Schnee
        {
          vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
          float wetK = clamp(0.25 + 0.6 * uWet + 0.6 * sdPud, 0.0, 1.0) * (1.0 - 0.7 * sdSnow);
          float shin = mix(18.0, 260.0, wetK);
          vec3 lD = vec3(0.0), lS = vec3(0.0);
          for (int i = 0; i < SD_NL; i++) {
            vec4 lp = uLamps[i]; vec3 Lv = lp.xyz - vSdW; float d2 = dot(Lv, Lv);
            if (lp.w <= 0.0 || d2 > 400.0) continue;
            vec3 L = Lv * inversesqrt(d2);
            float att = lp.w * smoothstep(400.0, 60.0, d2) / (1.0 + 0.09 * d2);
            lD += att * max(dot(nW, L), 0.0);
            vec3 H = normalize(L + sdV);
            lS += att * pow(max(dot(nW, H), 0.0), shin) * (shin + 8.0) * 0.04;
          }
          vec3 lampC = vec3(1.0, 0.66, 0.32);
          outgoingLight += lampC * (diffuseColor.rgb * lD * 2.2 + lS * wetK * 0.35 * (1.0 - sdSnow) + vec3(0.55, 0.6, 0.7) * lD * sdSnow * 0.5);
        }
        // Spiegelung: Pfützen klar, nasses Pflaster verschwommen und zu Lichtsäulen gezogen; ohne echte Spiegelung (Handy) der Himmel und Nebel
        float sdFr = 0.02 + 0.98 * pow(1.0 - clamp(sdV.y, 0.0, 1.0), 5.0);
        float sdK = (sdPud + 0.3 * uWet * (1.0 - sdPud)) * (1.0 - sdSnow) * sdTop;
        vec3 sdR = uFogColor * 1.6 + vec3(0.6, 0.62, 0.7) * pow(max(dot(reflect(-sdV, vec3(0.0, 1.0, 0.0)), uMoonDir), 0.0), 300.0) * uMoonLit * 3.0;
        if (uStreetRefl > 0.5 && sdK > 0.01) {
          vec4 rc = uReflMat * vec4(vSdW.x, 0.0, vSdW.z, 1.0);
          vec2 ruv = rc.xy / rc.w + sdRip * 0.01 * sdPud;
          float blur = (1.0 - sdPud) * 0.03 + 0.004;
          vec3 s0 = texture2D(uRefl, clamp(ruv, 0.002, 0.998)).rgb;
          vec3 s1 = texture2D(uRefl, clamp(ruv + vec2(0.0, blur), 0.002, 0.998)).rgb, s2 = texture2D(uRefl, clamp(ruv - vec2(0.0, blur), 0.002, 0.998)).rgb;
          vec3 s3 = texture2D(uRefl, clamp(ruv + vec2(0.0, blur * 2.2), 0.002, 0.998)).rgb;
          sdR = mix(s0, (s0 + s1 + s2 + s3) * 0.25, 1.0 - sdPud);
        }
        outgoingLight = mix(outgoingLight, sdR, clamp(sdFr * sdK * 1.1, 0.0, 0.92));
      }
      #include <output_fragment>`);
  };
}
export function buildGround() {
  const cob = cobbleTextures();
  cob.map.repeat.set(2080 / 5, 1575 / 5); cob.rough.repeat.copy(cob.map.repeat); cob.normal.repeat.copy(cob.map.repeat);
  const roadMat = stdMat({ map: cob.map, roughnessMap: cob.rough, normalMap: cob.normal, normalScale: new T.Vector2(0.9, 0.9), color: 0xc4ccd0, roughness: 0.85, metalness: 0.08, envI: 0.45 });
  streetDetail(roadMat, false);
  buildGroundMask(); groundGrass(roadMat);
  cob.map.repeat.set(1, 1); cob.rough.repeat.set(1, 1); cob.normal.repeat.set(1, 1);
  const shp = new T.Shape(COAST.map(([x, z]) => { const dx = x - ISL.cx, dz = z - ISL.cz, L = Math.hypot(dx, dz) || 1; return new T.Vector2(x + dx / L * 1.2, -(z + (z > ISL.quay - 1 ? 1.2 : dz / L * 1.2))); }));
  const gg = new T.ShapeGeometry(shp).rotateX(-Math.PI / 2);
  { const p = gg.attributes.position, uv = gg.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 5, p.getZ(i) / 5); }
  const g = new T.Mesh(gg, roadMat); g.frustumCulled = false; scene.add(g); STREET.ground = g;
  // Bürgersteige als eine InstancedMesh
  // Gehwegplatten mit Bordstein aus Granit: Texturkoordinaten aus der Weltlage, damit die Platten überall gleich groß sind
  const sl = slabTextures();
  const walkMat = stdMat({ map: sl.map, roughnessMap: sl.rough, normalMap: sl.normal, normalScale: new T.Vector2(0.8, 0.8), color: 0xb8c0c4, roughness: 0.8, metalness: 0.05, envI: 0.45 });
  walkMat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying vec2 vLoc, vHalf, vWq; varying float vTop;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      vec4 wpU = modelMatrix * instanceMatrix * vec4(position, 1.0);
      vec3 nU = normalize(mat3(modelMatrix * instanceMatrix) * normal);
      vTop = step(0.5, nU.y);
      vUv = vTop > 0.5 ? wpU.xz / 3.0 : vec2(wpU.x + wpU.z, wpU.y * 4.0) / 3.0;
      vHalf = 0.5 * vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[2].xyz));
      vLoc = position.xz * 2.0 * vHalf; vWq = wpU.xz;`);
    // Bordstein: Granit mit feiner Körnung und Stoßfugen alle 1,2 m
    sh.fragmentShader = 'varying vec2 vLoc, vHalf, vWq; varying float vTop;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      vec2 vEdge = vHalf - abs(vLoc);
      float curb = max(1.0 - vTop, 1.0 - step(0.34, min(vEdge.x, vEdge.y)));
      float gran = 0.82 + 0.3 * fract(sin(dot(floor(vWq * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
      float along = vEdge.x < vEdge.y ? vWq.y : vWq.x;
      float joint = step(0.49, abs(fract(along / 1.2) - 0.5));
      float lip = vTop * smoothstep(0.03, 0.0, min(vEdge.x, vEdge.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.36, 0.37, 0.39) * gran * (1.0 - 0.6 * joint) * (1.0 + 0.4 * lip), curb);`);
  };
  streetDetail(walkMat, true);
  buildSidewalks();
  const m = new T.Matrix4();
  // Parkflächen
  const parks = blocks.filter(b => b.park);
  if (parks.length) {
    const lawn = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), snowy(worldUVMat(stdMat({ map: GRASS.map, normalMap: GRASS.normal, roughnessMap: GRASS.rough, roughness: 1, color: 0x9ab09a, envI: 0.2, emissive: 0x050a05, emissiveMap: GRASS.map }), 2.5), 0.85), parks.length);
    parks.forEach((b, i) => { m.makeScale(b.x1 - b.x0 - 9, 0.05, b.z1 - b.z0 - 9).setPosition((b.x0 + b.x1) / 2, 0.245, (b.z0 + b.z1) / 2); lawn.setMatrixAt(i, m); });
    lawn.frustumCulled = false; scene.add(lawn);
    buildParkPlants(parks);
  }
}

// Laternen-Modelle nur in der Nähe zeichnen; in der Ferne bleibt der Lichtpunkt
export const LAMP_SETS = []; export let lampTimer = 0;
// V21: Laternen und Stadtmobiliar werden hier nur geplant; gebaut werden sie als Chunk-Schichten in props.js
export const STREET = { lamps: [], lampParts: null, furniture: null };
// V30: die LAMP_N nächsten Laternen gehen als Lichtquellen an den Straßenshader (uLamps)
export const LAMP_N = MOBILE ? 8 : 16;
const _lampD = new Float32Array(16), _lampL = [];
function updateStreetLamps(cp) {
  let n = 0;
  for (const l of STREET.lamps) {
    const d = (l.x - cp.x) ** 2 + (l.z - cp.z) ** 2; if (d > 3600) continue;
    let i; if (n < LAMP_N) i = n++; else if (d < _lampD[LAMP_N - 1]) i = LAMP_N - 1; else continue;
    while (i > 0 && _lampD[i - 1] > d) { _lampD[i] = _lampD[i - 1]; _lampL[i] = _lampL[i - 1]; i--; }
    _lampD[i] = d; _lampL[i] = l;
  }
  const A = U.uLamps.value, out = cp.y > 80 || U.uInside.value > 0.5;
  for (let i = 0; i < 16; i++) { const l = i < n && !out ? _lampL[i] : null; if (l) A[i].set(l.x, l.y + l.hs + 0.3, l.z, 1); else A[i].set(0, -1000, 0, 0); }
}
export function updateLampLod(dt) {
  if ((lampTimer -= dt) > 0) return;
  lampTimer = 0.25;
  updateStreetLamps(camera.position);
  const cp = camera.position, D2 = (260 + Math.max(0, cp.y) * 1.5) ** 2;
  for (const st of LAMP_SETS) {
    let n = 0;
    const dd = st.near ? (st.near + Math.max(0, cp.y)) ** 2 : D2;
    for (const q of st.pts) if ((q.x - cp.x) ** 2 + (q.z - cp.z) ** 2 < dd) st.im.setMatrixAt(n++, q.m);
    st.im.count = n; st.im.instanceMatrix.needsUpdate = true;
  }
}
/* ---------- Licht in der feuchten Nachtluft: Lichtkegel unter den Laternen, Spiegelungen auf dem nassen Pflaster ---------- */
export function buildLampFx(heads) {
  const n = heads.length, attr = new Float32Array(n * 4);
  heads.forEach((h, i) => attr.set([h[0], h[4], h[2], h[1] - h[4]], i * 4));
  // Spiegelstreifen: liegen flach auf dem Boden und zeigen immer vom Laternenfuß zum Betrachter
  const sg = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1, 1, 4).translate(0, 0.5, 0));
  sg.instanceCount = n; sg.setAttribute('aL', new T.InstancedBufferAttribute(attr, 4));
  const streaks = new T.Mesh(sg, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `attribute vec4 aL; uniform vec3 uCam; uniform float uFogDensity; varying vec2 vUv; varying float vA;
      void main(){
        vec2 toC = uCam.xz - aL.xz; float d = length(toC); vec2 dir = toC / max(d, 0.001); vec2 side = vec2(-dir.y, dir.x);
        float hc = uCam.y - aL.y;
        vA = smoothstep(240.0, 25.0, d) * smoothstep(70.0, 6.0, hc) * smoothstep(1.5, 5.0, d) * exp(-uFogDensity*uFogDensity*d*d);
        if (vA < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float len = min(aL.w * 4.0, d * 0.85);
        vec2 xz = aL.xz + side * position.x * (0.9 + d*0.006) + dir * (position.y * len - 0.4);
        vUv = vec2(position.x * 2.0, position.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, aL.y + 0.05, xz.y, 1.0);
      }`,
    fragmentShader: `uniform float uTime; uniform float uWet; uniform float uSnowCover; uniform float uStreetRefl; varying vec2 vUv; varying float vA;
      void main(){
        float a = exp(-vUv.x*vUv.x*5.0) * pow(sin(3.14159*clamp(vUv.y, 0.0, 1.0)), 0.8) * (1.0 - 0.6*vUv.y);
        a *= 0.88 + 0.12*sin(vUv.y*30.0 + uTime*0.7 + vUv.x*2.0);
        // V25: nasser = längere, hellere Lichtbahnen; mit echter Spiegelung nur noch ein Rest, auf Schnee fast keine
        a *= (0.5 + 1.1 * uWet) * (1.0 - 0.45 * uStreetRefl) * (1.0 - 0.8 * uSnowCover);
        gl_FragColor = vec4(vec3(1.0, 0.68, 0.36) * a * vA * 0.3, 1.0);
      }`,
  }));
  streaks.frustumCulled = false; streaks.renderOrder = 2; scene.add(streaks);
  // Lichtkegel: offener Kegel von der Laterne zum Boden, nur in der Nähe sichtbar
  const cg = new T.InstancedBufferGeometry().copy(new T.ConeGeometry(1, 1, 18, 1, true).translate(0, -0.5, 0));
  cg.instanceCount = n; cg.setAttribute('aL', new T.InstancedBufferAttribute(attr, 4));
  const cones = new T.Mesh(cg, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `attribute vec4 aL; uniform vec3 uCam; varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 top = vec3(aL.x, aL.y + aL.w, aL.z);
        float d = distance(uCam, top);
        vA = smoothstep(150.0, 20.0, d) * smoothstep(0.8, 4.0, d);
        if (vA < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float r = aL.w * 0.5;
        vec3 wp = top + vec3(position.x * r, position.y * aL.w, position.z * r);
        vT = -position.y; vN = normalize(vec3(normal.x, normal.y * 0.5, normal.z)); vV = normalize(uCam - wp);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform float uMist; uniform float uRain; uniform float uSnow; uniform float uFrost; uniform float uTime; varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
      void main(){
        float e = pow(abs(dot(vN, vV)), 1.6);
        float a = e * pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.06, vT) * vA;
        // V25: im Nebel, im Regen und im Schneetreiben wird der Lichtkegel sichtbar dichter, Tropfen glitzern darin
        float vol = 0.55 + 0.45 * uMist + 0.9 * uRain + 0.7 * uSnow + 0.4 * uFrost;
        vol *= 1.0 + (uRain + uSnow) * 0.25 * sin(vT * 40.0 - uTime * 9.0);
        gl_FragColor = vec4(vec3(1.0, 0.75, 0.42) * a * 0.075 * vol, 1.0);
      }`,
  }));
  cones.frustumCulled = false; cones.renderOrder = 3; scene.add(cones);
}

/* ---------- Instanzen erzeugen ---------- */
export function flushInstances() {
  // Gebäude
  const box = new T.BoxGeometry(1, 1, 1);
  const geo = box.clone();
  dedupeSegs();
  const tint = new Float32Array(segs.length * 3), par = new Float32Array(segs.length * 4), rib = new Float32Array(segs.length * 3), flg = new Float32Array(segs.length);
  const im = new T.InstancedMesh(geo, facadeMat, segs.length);
  const m = new T.Matrix4();
  segs.forEach((s, i) => {
    if (s.ry) m.compose(_p.set(s.x, (s.y0 + s.y1) / 2, s.z), _q.setFromAxisAngle(_up, s.ry), _s.set(s.w, s.y1 - s.y0, s.d));
    else m.makeScale(s.w, s.y1 - s.y0, s.d).setPosition(s.x, (s.y0 + s.y1) / 2, s.z);
    im.setMatrixAt(i, m);
    tint.set(s.tint, i * 3); par.set([s.seed, s.style, s.dens, s.flood], i * 4); if (s.rib) rib.set(s.rib, i * 3); flg[i] = s.fl || 0;
  });
  geo.setAttribute('aFlag', new T.InstancedBufferAttribute(flg, 1));
  geo.setAttribute('aTint', new T.InstancedBufferAttribute(tint, 3));
  geo.setAttribute('aRib', new T.InstancedBufferAttribute(rib, 3));
  geo.setAttribute('aParams', new T.InstancedBufferAttribute(par, 4));
  im.frustumCulled = false; scene.add(im);

  // Leuchtleisten
  // V33: Leuchtleisten liegen oft nur 5 bis 30 cm vor der Fassade; aus der Ferne reicht die Tiefengenauigkeit dafür nicht,
  // daher werden sie um ein paar Tiefenstufen nach vorn geschoben (wirkt nur in der Ferne merklich)
  const nm = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xd2d2d2, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -3 }), neons.length);
  const col = new T.Color();
  neons.forEach((n, i) => { if (n.ry || n.rz) m.compose(_p.set(n.x, n.y, n.z), _q.setFromEuler(_e.set(0, n.ry || 0, n.rz || 0)), _s.set(n.sx, n.sy, n.sz)); else m.makeScale(n.sx, n.sy, n.sz).setPosition(n.x, n.y, n.z); nm.setMatrixAt(i, m); nm.setColorAt(i, col.setRGB(n.c[0], n.c[1], n.c[2])); });
  nm.frustumCulled = false; scene.add(nm);

  // Turmspitzen
  const cone = new T.ConeGeometry(0.5, 1, 4, 1); cone.rotateY(Math.PI / 4); cone.translate(0, 0.5, 0);
  const sm = new T.InstancedMesh(cone, new T.MeshStandardMaterial({ color: 0xc8a060, metalness: 0.85, roughness: 0.32, emissive: 0x2c1c08 }), spires.length);
  spires.forEach((s, i) => { m.makeScale(s.b * 1.414, s.h, s.b * 1.414).setPosition(s.x, s.y0, s.z); sm.setMatrixAt(i, m); });
  sm.frustumCulled = false; scene.add(sm);

  // Walmdächer aus grüner Kupferpatina oder Blattgold, Kuppeln mit Laterne
  const roofCapGeo = new T.ConeGeometry(0.7071, 1, 4, 1); roofCapGeo.rotateY(Math.PI / 4); roofCapGeo.translate(0, 0.5, 0);
  // V23: dritte Sorte Dach: Schiefer auf den Arbeiter- und Reihenhäusern (ohne Warnlicht)
  for (const kind of ['copper', 'gold', 'slate']) {
    const list = caps.filter(c => (c.slate ? 'slate' : c.gold ? 'gold' : 'copper') === kind); if (!list.length) continue;
    const cm = new T.InstancedMesh(roofCapGeo, kind === 'gold' ? MAT.gold : kind === 'slate' ? stdMat({ color: 0x3a3d44, metalness: 0.15, roughness: 0.6, envI: 0.45 }) : stdMat({ color: 0x3e8a7c, metalness: 0.35, roughness: 0.45, envI: 0.6 }), list.length);
    list.forEach((c, i) => { cm.setMatrixAt(i, m.makeScale(c.w, c.h, c.d).setPosition(c.x, c.y, c.z)); if (!c.slate) addGlow(c.x, c.y + c.h + 0.6, c.z, [1.4, 0.15, 0.1], 1.4, R(), 1); });
    cm.frustumCulled = false; scene.add(cm);
  }
  // V23: Zifferblätter der Uhrtürme (vier Seiten, leuchtend)
  if (CLOCKS.length) {
    const faces = [], hands = [];
    for (const c of CLOCKS) for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, ox = Math.sin(a) * c.half, oz = Math.cos(a) * c.half;
      faces.push(new T.CircleGeometry(c.r, 28).rotateY(a).translate(c.x + ox, c.y, c.z + oz));
      hands.push(new T.TorusGeometry(c.r + 0.08, 0.09, 5, 28).rotateY(a).translate(c.x + ox * 1.01, c.y, c.z + oz * 1.01));
      addGlow(c.x + ox * 1.15, c.y, c.z + oz * 1.15, [1.3, 1.1, 0.8], c.r * 1.6);
    }
    const fm = new T.Mesh(mergeGeos(faces), new T.MeshBasicMaterial({ map: CLOCK_TEX, color: new T.Color(1.25, 1.15, 0.95), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
    const hm = new T.Mesh(mergeGeos(hands), MAT.gold);
    fm.frustumCulled = hm.frustumCulled = false; scene.add(fm, hm);
  }
  if (domes.length) {
    const dg = mergeGeos([new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.CylinderGeometry(0.12, 0.16, 0.35, 10).translate(0, 1.12, 0), new T.ConeGeometry(0.1, 0.4, 8).translate(0, 1.48, 0)]);
    const dm = new T.InstancedMesh(dg, stdMat({ color: 0x3e8a7c, metalness: 0.4, roughness: 0.4, envI: 0.7 }), domes.length);
    const ribs = new T.InstancedMesh(new T.SphereGeometry(1.012, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.66, 0.3), wireframe: true }), domes.length);
    domes.forEach((d, i) => { m.makeScale(d.r, d.r * 1.1, d.r).setPosition(d.x, d.y, d.z); dm.setMatrixAt(i, m); ribs.setMatrixAt(i, m); addGlow(d.x, d.y + d.r * 1.75, d.z, [1.3, 0.95, 0.5], 2.5); });
    dm.frustumCulled = ribs.frustumCulled = false; scene.add(dm, ribs);
  }

  // Laternen: Art-Deco-Kandelaber (Sockel, kannelierter Schaft, Laterne), Lichtfleck, Lichtkegel, nasse Spiegelung
  const byH = new Map();
  lamps.forEach(l => { if (l.wall) return; const k = Math.round(l.h * 10) / 10; if (!byH.has(k)) byH.set(k, []); byH.get(k).push(l); });
  const poleMat = stdMat({ color: 0x2a2620, metalness: 0.75, roughness: 0.38 });
  const lanternGeo = mergeGeos([
    new T.CylinderGeometry(0.2, 0.15, 0.62, 8).translate(0, 0.31, 0),
  ]);
  const capGeo = mergeGeos([
    new T.ConeGeometry(0.3, 0.32, 8).translate(0, 0.78, 0), new T.SphereGeometry(0.06, 6, 4).translate(0, 0.98, 0),
    new T.CylinderGeometry(0.24, 0.24, 0.05, 8).translate(0, 0.63, 0), new T.CylinderGeometry(0.17, 0.12, 0.08, 8).translate(0, -0.02, 0),
  ]);
  const heads = [];
  // V21: die Laternen werden nicht mehr hier gebaut, sondern als Chunk-Schicht in props.js (echtes Modell, sonst dieser Kandelaber)
  STREET.lampParts = { poleMat, lanternGeo, capGeo };
  for (const [h, list] of byH) {
    const hs = h - 0.75;
    const g = mergeGeos([
      new T.CylinderGeometry(0.2, 0.27, 0.62, 8).translate(0, 0.31, 0),
      new T.CylinderGeometry(0.15, 0.2, 0.14, 8).translate(0, 0.69, 0),
      new T.CylinderGeometry(0.065, 0.1, hs - 0.76, 8).translate(0, 0.76 + (hs - 0.76) / 2, 0),
      new T.CylinderGeometry(0.11, 0.08, 0.12, 8).translate(0, hs * 0.55, 0),
      new T.CylinderGeometry(0.14, 0.07, 0.18, 8).translate(0, hs - 0.06, 0),
    ]);
    list.forEach(l => { const y0 = l.y ?? (inRect(l.x, l.z, PLAZA) ? 0.26 : 0.22); STREET.lamps.push({ x: l.x, y: y0, z: l.z, h, hs, geo: g }); heads.push([l.x, y0 + hs, l.z, l.h, y0]); });
  }
  const pools = new T.InstancedMesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: glowTex, color: new T.Color(0.2, 0.14, 0.07), transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: true }), lamps.length);
  lamps.forEach((l, i) => {
    const y0 = l.y ?? (inRect(l.x, l.z, PLAZA) ? 0.26 : 0.22);
    const ps = l.wall ? 7 : l.h * 2.2;
    m.makeScale(ps, 1, ps).setPosition(l.x, y0 + 0.03, l.z); pools.setMatrixAt(i, m);
    if (!l.wall) addGlow(l.x, y0 + l.h - 0.38, l.z, [1.25, 0.85, 0.48], 1.3);
  });
  pools.frustumCulled = false; pools.renderOrder = 1;
  scene.add(pools);
  buildLampFx(heads);

  buildEntrances();
  buildHouseDoors();
  // Bäume
  buildTrees();

  buildRoofs();
  buildAwnings();
  buildParkedCars();
  buildStreetFurniture();
  buildPedestrians();
  scene.add(makeGlowPoints(glowPts));
}

/* ---------- Dachaufbauten: Wassertürme, Schornsteine, Antennen ---------- */
export function buildRoofs() {
  const m = new T.Matrix4();
  const tank = mergeGeos([
    new T.CylinderGeometry(1.6, 1.6, 2.6, 10).translate(0, 3.9, 0),
    new T.ConeGeometry(1.8, 1.1, 10).translate(0, 5.75, 0),
    new T.BoxGeometry(0.18, 2.6, 0.18).translate(1.1, 1.3, 1.1), new T.BoxGeometry(0.18, 2.6, 0.18).translate(-1.1, 1.3, 1.1),
    new T.BoxGeometry(0.18, 2.6, 0.18).translate(1.1, 1.3, -1.1), new T.BoxGeometry(0.18, 2.6, 0.18).translate(-1.1, 1.3, -1.1),
  ]);
  const chim = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const mast = new T.CylinderGeometry(0.12, 0.25, 1, 5).translate(0, 0.5, 0);
  const tanks = [], chims = [], masts = [];
  for (const r of roofs) {
    if (r.crown) continue;
    if (r.H < 95 && r.w > 9 && r.d > 9 && R() < 0.4) tanks.push(m.makeScale(1, 1, 1).setPosition(r.x + rand(-r.w / 2 + 3, r.w / 2 - 3), r.H, r.z + rand(-r.d / 2 + 3, r.d / 2 - 3)).clone());
    if (r.worker || (r.H < 60 && R() < 0.5)) {
      const n = 1 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) chims.push(m.makeScale(rand(0.7, 1.4), rand(1.2, 2.6), rand(0.7, 1.4)).setPosition(r.x + rand(-r.w / 2 + 1.5, r.w / 2 - 1.5), r.H, r.z + rand(-r.d / 2 + 1.5, r.d / 2 - 1.5)).clone());
    }
    if (r.H > 60 && R() < 0.35) {
      const h = rand(6, 16), px = r.x + rand(-r.w / 3, r.w / 3), pz = r.z + rand(-r.d / 3, r.d / 3);
      masts.push(m.makeScale(1, h, 1).setPosition(px, r.H, pz).clone());
      addGlow(px, r.H + h + 0.3, pz, [1.4, 0.15, 0.1], 1.2, R(), 1);
    }
  }
  const mk = (geo, list, mat) => { if (!list.length) return; const im = new T.InstancedMesh(geo, mat, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm)); im.frustumCulled = false; scene.add(im); };
  mk(tank, tanks, new T.MeshStandardMaterial({ color: 0x3a2e24, roughness: 0.9 }));
  mk(chim, chims, new T.MeshStandardMaterial({ color: 0x2a211d, roughness: 0.95 }));
  mk(mast, masts, new T.MeshStandardMaterial({ color: 0x55504a, metalness: 0.7, roughness: 0.4 }));
}

/* ---------- Markisen über den Schaufenstern ---------- */
export function buildAwnings() {
  const list = [], cols = [];
  const palette = [[0.35, 0.05, 0.08], [0.06, 0.22, 0.14], [0.06, 0.1, 0.26], [0.6, 0.52, 0.38], [0.3, 0.16, 0.06]];
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler();
  // V23: keine Markise vor Türen, Portalen (Vordach bis 4,2 m zur Seite) oder Arkaden
  const keep = DOORS.map(dd => ({ x: dd.x, z: dd.z, r: dd.kind === 'house' ? 4.2 : 6.8 }));
  const kh = new Map(); for (const k of keep) { const key = Math.floor(k.x / 20) + ',' + Math.floor(k.z / 20); (kh.get(key) || kh.set(key, []).get(key)).push(k); }
  const blocked = (x, z) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of kh.get((Math.floor(x / 20) + i) + ',' + (Math.floor(z / 20) + j)) || []) if ((k.x - x) ** 2 + (k.z - z) ** 2 < k.r * k.r) return true; return false; };
  for (const r of roofs) {
    if (r.shop || r.arcade || r.dist > 560 || r.worker && R() < 0.5) continue;
    const c = pick(palette);
    for (const side of Object.keys(r.edges)) {
      if (!r.edges[side] || R() < 0.45) continue;
      const out = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side];
      const len = out[0] ? r.fd : r.fw;
      for (let u = -len / 2 + 6; u < len / 2 - 3; u += 7) {
        if (R() < 0.3) continue;
        const bx = r.fx ?? r.x, bz = r.fz ?? r.z;
        const px = bx + out[0] * (r.fw / 2 + 0.9) + (out[0] ? 0 : u), pz = bz + out[1] * (r.fd / 2 + 0.9) + (out[1] ? 0 : u);
        if (blocked(px, pz)) continue;
        e.set(0, Math.atan2(out[0], out[1]), 0); q.setFromEuler(e);
        m.compose(new T.Vector3(px, 3.7, pz), q, new T.Vector3(4.6, 0.25, 1.8));
        list.push(m.clone()); cols.push(c);
      }
    }
  }
  if (!list.length) return;
  const geo = new T.BoxGeometry(1, 1, 1); geo.rotateX(0.35);
  const im = new T.InstancedMesh(geo, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), list.length);
  const col = new T.Color();
  list.forEach((mm, i) => { im.setMatrixAt(i, mm); im.setColorAt(i, col.setRGB(cols[i][0], cols[i][1], cols[i][2])); });
  im.frustumCulled = false; scene.add(im);
}

/* ---------- Stadtmobiliar: Litfaßsäulen, Bänke, Briefkästen, Hydranten, Papierkörbe, Kioske, Straßenuhren, Pflanzkübel ---------- */
export const POSTER_TEX = canvasTex(1536, 384, (g, W, H) => {
  const rr = mulberry32(2626);
  g.fillStyle = '#3a3226'; g.fillRect(0, 0, W, H);
  const P = [
    ['JAZZ', 'THE BRASS LANTERN', 'JEDE NACHT', '#14302e', '#e9b860'], ['LUFTSCHIFF', 'LINIEN VESPERA', 'ÜBER DIE GIPFEL', '#1d2a44', '#f0d29a'],
    ['GRAND BALL', 'THE BELMONT', 'SAMSTAG 22 UHR', '#2a1030', '#f2c46d'], ['KINO', 'METROPOL', 'DIE STERNENSTADT', '#3a0f12', '#f6e2b0'],
    ['CIRCUS', 'AURELIA', 'NUR 3 TAGE', '#0f2a22', '#f2b55a'], ['TANZ', 'PALAIS ORPHEUM', 'CHARLESTON', '#18183a', '#e8c070'],
    ['RADIO', 'VESPERA 1', 'MUSIK BIS MITTERNACHT', '#2e2412', '#f0d090'], ['OPERETTE', 'DIE GOLDENE STADT', 'PREMIERE', '#301416', '#f4c878'],
  ];
  const pw = W / P.length;
  P.forEach(([a, b, c, bg, fg], i) => {
    const x = i * pw + 6, w = pw - 12, y = 18, h = H - 36;
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    // Sonnenstrahlen oder Zickzack im Hintergrund
    g.translate(x + w / 2, y + h * 0.42);
    for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? 'rgba(255,220,150,0.08)' : 'rgba(0,0,0,0.12)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, h, k / 24 * Math.PI * 2, (k + 1) / 24 * Math.PI * 2); g.fill(); }
    g.fillStyle = fg; g.beginPath(); g.arc(0, 0, w * 0.22, 0, Math.PI * 2); g.globalAlpha = 0.3; g.fill(); g.globalAlpha = 1;
    g.restore();
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${Math.round(w * 0.24)}px Limelight, Georgia, serif`; g.fillText(a, x + w / 2, y + h * 0.42, w - 24);
    g.font = `${Math.round(w * 0.1)}px Georgia, serif`; g.fillText(b, x + w / 2, y + h * 0.66, w - 24);
    g.font = `italic ${Math.round(w * 0.075)}px Georgia, serif`; g.fillText(c, x + w / 2, y + h * 0.8, w - 24);
    // Papier: Falten, Verblassen, abgerissene Ecken
    g.fillStyle = 'rgba(240,230,200,0.08)'; for (let k = 0; k < 4; k++) g.fillRect(x, y + rr() * h, w, 1.5);
    if (rr() < 0.6) { g.fillStyle = '#3a3226'; g.beginPath(); g.moveTo(x + w, y + h); g.lineTo(x + w - 20 - rr() * 30, y + h); g.lineTo(x + w, y + h - 20 - rr() * 30); g.fill(); }
  });
  for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,240,210'},${rr() * 0.06})`; g.fillRect(rr() * W, rr() * H, 2, 2); }
});
POSTER_TEX.wrapS = T.RepeatWrapping;
export const CLOCK_TEX = canvasTex(256, 256, (g, W) => {
  g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill();
  g.strokeStyle = '#b08a4a'; g.lineWidth = 10; g.stroke();
  g.fillStyle = '#1a1612'; g.font = '28px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['XII', 'III', 'VI', 'IX'].forEach((t, i) => { const a = i * Math.PI / 2 - Math.PI / 2; g.fillText(t, 128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); });
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 108 - 2, 128 + Math.sin(a) * 108 - 2, 4, 4); }
  g.strokeStyle = '#1a1612'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 40, 128 - 30); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 20, 128 - 85); g.stroke();
});
export function buildStreetFurniture() {
  const rr = mulberry32(31337), mat = paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.55, envI: 0.5, emissive: 0x080604 });
  const W = (geos) => mergeColored(geos);
  const C = (rt, rb, h, seg, x, y, z) => new T.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
  const B = IB;
  const S = (r, x, y, z, sx = 1, sy = 1, sz = 1) => new T.SphereGeometry(r, 10, 7).scale(sx, sy, sz).translate(x, y, z);
  const iron = [0.05, 0.05, 0.055], brass = [0.62, 0.46, 0.22], wood = [0.32, 0.19, 0.1], stone = [0.42, 0.4, 0.37];
  const TYPES = {
    hydrant: W([[C(0.13, 0.15, 0.08, 10, 0, 0, 0), PAINT], [C(0.1, 0.11, 0.55, 10, 0, 0.08, 0), PAINT], [S(0.11, 0, 0.63, 0, 1, 0.7, 1), PAINT], [C(0.03, 0.03, 0.06, 6, 0, 0.68, 0), brass],
      [C(0.04, 0.045, 0.12, 8, 0, 0, 0).rotateZ(Math.PI / 2).translate(0.14, 0.42, 0), PAINT], [C(0.04, 0.045, 0.12, 8, 0, 0, 0).rotateZ(-Math.PI / 2).translate(-0.14, 0.42, 0), PAINT], [C(0.05, 0.05, 0.05, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 0.38, 0.14), brass]]),
    bench: W([...[-0.12, 0.0, 0.12].map(z => [B(1.8, 0.04, 0.1, 0, 0.45, z), wood]), ...[0.62, 0.74, 0.86].map(y => [B(1.8, 0.08, 0.03, 0, y, -0.2), wood]),
      ...[-0.75, 0.75].flatMap(x => [[B(0.05, 0.45, 0.38, x, 0.225, 0), iron], [B(0.05, 0.5, 0.05, x, 0.68, -0.21), iron], [B(0.05, 0.05, 0.4, x, 0.62, -0.02), iron], [S(0.035, x, 0.65, 0.18), iron]])]),
    mailbox: W([[C(0.05, 0.06, 0.9, 8, 0, 0, 0), iron], [B(0.38, 0.5, 0.3, 0, 1.12, 0), PAINT], [C(0.15, 0.15, 0.38, 14, 0, 0, 0).rotateZ(Math.PI / 2).scale(1, 0.6, 1).translate(0, 1.37, 0), PAINT],
      [B(0.24, 0.025, 0.02, 0, 1.25, 0.155), iron], [B(0.2, 0.08, 0.01, 0, 1.06, 0.155), brass], [B(0.4, 0.03, 0.32, 0, 0.86, 0), brass]]),
    bin: W([[C(0.22, 0.18, 0.7, 14, 0, 0.05, 0), iron], [C(0.235, 0.235, 0.05, 14, 0, 0.73, 0), brass], [C(0.04, 0.05, 0.05, 6, 0, 0, 0), iron], [S(0.08, 0.05, 0.75, 0.04, 1.4, 0.5, 1), [0.62, 0.6, 0.55]]]),
    clock: W([[C(0.18, 0.24, 0.5, 10, 0, 0, 0), iron], [C(0.07, 0.09, 2.8, 10, 0, 0.5, 0), iron], [C(0.11, 0.07, 0.2, 10, 0, 3.0, 0), brass], [C(0.42, 0.42, 0.18, 24, 0, 0, 0).rotateX(Math.PI / 2).translate(0, 3.55, 0), brass],
      [C(0.07, 0.0, 0.25, 8, 0, 4.0, 0), brass], [S(0.05, 0, 4.28, 0), brass]]),
    planter: W([[B(1.6, 0.55, 0.6, 0, 0.275, 0), stone], [B(1.7, 0.06, 0.7, 0, 0.58, 0), [0.52, 0.5, 0.46]], ...Array.from({ length: 7 }, (_, k) => [S(0.2 + rr() * 0.1, -0.6 + k * 0.2, 0.75, (rr() - 0.5) * 0.25, 1, 0.8, 1), [0.06, 0.16 + rr() * 0.08, 0.08]]),
      ...Array.from({ length: 10 }, () => [S(0.05, -0.7 + rr() * 1.4, 0.9 + rr() * 0.1, (rr() - 0.5) * 0.4), [[0.8, 0.15, 0.2], [0.9, 0.75, 0.3], [0.85, 0.85, 0.8], [0.6, 0.2, 0.5]][Math.floor(rr() * 4)]])]),
    kiosk: W([[B(2.2, 2.1, 1.6, 0, 1.05, 0), PAINT], [B(2.6, 0.12, 2.0, 0, 2.2, 0), [0.1, 0.1, 0.1]], [C(1.4, 1.3, 0.25, 8, 0, 2.26, 0).scale(1, 1, 0.78), PAINT], [B(2.0, 0.9, 0.04, 0, 1.25, 0.81), [0.05, 0.05, 0.06]],
      [B(2.24, 0.06, 1.64, 0, 0.8, 0), brass], [B(2.24, 0.06, 1.64, 0, 1.75, 0), brass],
      ...Array.from({ length: 18 }, (_, k) => [B(0.18, 0.25, 0.02, -0.85 + (k % 9) * 0.21, 1.0 + Math.floor(k / 9) * 0.32, 0.83), [[0.8, 0.3, 0.2], [0.2, 0.4, 0.6], [0.85, 0.75, 0.4], [0.9, 0.88, 0.8], [0.3, 0.55, 0.4]][Math.floor(rr() * 5)]]),
      [B(2.2, 0.35, 0.03, 0, 2.0, 0.82), [0.85, 0.66, 0.3]]]),
  };
  const colGeo = new T.CylinderGeometry(0.6, 0.6, 2.4, 28, 1, true).translate(0, 1.55, 0);
  const colParts = W([[C(0.7, 0.72, 0.35, 20, 0, 0, 0), iron], [C(0.64, 0.64, 0.06, 20, 0, 0.32, 0), brass], [C(0.66, 0.62, 0.1, 20, 0, 2.75, 0), brass], [C(0.0, 0.72, 0.4, 20, 0, 2.85, 0), [0.22, 0.42, 0.36]], [S(0.1, 0, 3.4, 0), brass]]);
  const WEIGHT = [['bench', 3], ['bin', 3], ['hydrant', 2], ['mailbox', 1.5], ['column', 1.2], ['planter', 1.5], ['clock', 0.5], ['kiosk', 0.6]];
  const TOT = WEIGHT.reduce((a, b) => a + b[1], 0);
  const pickT = () => { let x = rr() * TOT; for (const [k, w] of WEIGHT) if ((x -= w) < 0) return k; return 'bin'; };
  const COLS = { hydrant: [[0.5, 0.06, 0.05], [0.12, 0.3, 0.2], [0.65, 0.5, 0.12]], mailbox: [[0.08, 0.26, 0.24], [0.45, 0.08, 0.06], [0.1, 0.12, 0.25]], kiosk: [[0.1, 0.22, 0.2], [0.35, 0.08, 0.08], [0.2, 0.15, 0.1]] };
  const out = {}; Object.keys(TYPES).concat('column').forEach(k => out[k] = []);
  const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), one = new T.Vector3(1, 1, 1);
  for (const c of curbs) {
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az), dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L, ox = -dz, oz = dx;
    for (let t = 5; t < L - 5; t += 5 + rr() * 9) {
      const k = pickT(), big = k === 'column' || k === 'kiosk', inset = big ? 1.4 : k === 'bench' || k === 'planter' ? 0.9 : 0.35;
      const px = c.ax + dx * t - ox * inset, pz = c.az + dz * t - oz * inset;
      if (inRect(px, pz, PLAZA, 2) || inRect(px, pz, MEDIAN, 2)) continue;
      if (lamps.some(l => Math.abs(l.x - px) < 2.2 && Math.abs(l.z - pz) < 2.2)) continue;
      if (DOORS.some(d => Math.abs(d.x - px) < 3 && Math.abs(d.z - pz) < 3)) continue;
      // Bänke und Kioske schauen zur Straße, der Rest steht beliebig gedreht
      const yaw = k === 'bench' || k === 'kiosk' || k === 'planter' ? Math.atan2(ox, oz) : k === 'clock' ? Math.atan2(dx, dz) : rr() * 6.28;
      q.setFromAxisAngle(up, yaw); m.compose(new T.Vector3(px, 0.22, pz), q, one);
      out[k].push({ x: px, z: pz, m: m.clone(), c: (COLS[k] || [[1, 1, 1]])[Math.floor(rr() * (COLS[k] || [0]).length)] });
      const r = big ? 1.0 : k === 'bench' ? 0.9 : 0.25;
      if (k !== 'bin' && k !== 'hydrant') addCollider(px - r, 0, pz - r, px + r, 2.5, pz + r);
      t += big ? 3 : 0;
    }
  }
  // V21: Aufstellung als Chunk-Schicht in props.js (Bank und Papierkorb aus echten Modellen, der Rest aus diesen Formen)
  const posterMat = stdMat({ map: POSTER_TEX, roughness: 0.8, envI: 0.25, emissive: 0x303030, emissiveMap: POSTER_TEX });
  const faceGeo = new T.CircleGeometry(0.38, 24); const faces = mergeGeos([faceGeo.clone().translate(0, 3.55, 0.095), faceGeo.clone().rotateY(Math.PI).translate(0, 3.55, -0.095)]);
  STREET.furniture = { out, TYPES, mat, colGeo, colParts, posterMat, faces, faceMat: new T.MeshBasicMaterial({ map: CLOCK_TEX, color: new T.Color(1.1, 1.0, 0.85) }) };
  for (const p of out.clock) addGlow(p.x, 3.55 + 0.22, p.z, [1.2, 0.95, 0.6], 0.8);
}

/* ---------- Bäume und Pflanzen: Platanen, Linden, Zypressen mit Blattkarten, Rinde und Wind ---------- */
// Blätteratlas: viele einzelne Blätter mit Stiel und Mittelrippe auf transparentem Grund
export const LEAF_TEX = (() => {
  const t = canvasTex(512, 512, (g, W) => {
    const rr = mulberry32(5577);
    g.clearRect(0, 0, W, W);
    for (let k = 0; k < 680; k++) {
      const x = 20 + rr() * (W - 40), y = 20 + rr() * (W - 40), a = rr() * 6.28, L = 10 + rr() * 12, w = L * (0.45 + rr() * 0.2);
      const v = 0.55 + rr() * 0.6, yel = rr() < 0.08 ? 1 : 0;
      g.save(); g.translate(x, y); g.rotate(a);
      g.fillStyle = `rgb(${Math.round((40 + yel * 70) * v)},${Math.round((92 + yel * 30) * v)},${Math.round((44 - yel * 10) * v)})`;
      g.beginPath(); g.moveTo(0, -L); g.quadraticCurveTo(w, -L * 0.2, 0, L * 0.7); g.quadraticCurveTo(-w, -L * 0.2, 0, -L); g.fill();
      g.strokeStyle = 'rgba(20,40,20,0.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -L * 0.9); g.lineTo(0, L * 0.9); g.stroke();
      g.fillStyle = 'rgba(255,255,220,0.12)'; g.beginPath(); g.ellipse(-w * 0.25, -L * 0.2, w * 0.25, L * 0.4, 0, 0, 7); g.fill();
      g.restore();
    }
  });
  t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
  return t;
})();
// Rinde: Längsfurchen, Borke, bei Platanen helle Flecken
export const BARK = texSet(256, (g, gr, gh, W) => {
  const rr = mulberry32(6688);
  g.fillStyle = '#3a2c20'; g.fillRect(0, 0, W, W); gr.fillStyle = '#c0c0c0'; gr.fillRect(0, 0, W, W); gh.fillStyle = 'rgb(120,0,0)'; gh.fillRect(0, 0, W, W);
  for (let k = 0; k < 90; k++) {
    const x = rr() * W, w = 2 + rr() * 5, len = 30 + rr() * 120, y = rr() * W;
    for (const oy of [0, -W, W]) {
      g.fillStyle = `rgba(${rr() < 0.5 ? '20,14,10' : '90,72,55'},${0.3 + rr() * 0.4})`; g.fillRect(x, y + oy, w, len);
      gh.fillStyle = `rgb(${rr() < 0.5 ? 30 : 200},0,0)`; gh.fillRect(x, y + oy, w, len);
    }
  }
  for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${150 + rr() * 60},${140 + rr() * 50},${110 + rr() * 40},0.25)`; g.beginPath(); g.ellipse(rr() * W, rr() * W, 6 + rr() * 16, 10 + rr() * 22, 0, 0, 7); g.fill(); }
}, 3.0);
BARK.map.repeat.set(2, 3); BARK.normal.repeat.set(2, 3); BARK.rough.repeat.set(2, 3);
export function treeGeos(sp) {
  const rr = mulberry32(sp === 'plane' ? 11 : sp === 'linden' ? 22 : 33);
  const bark = [], blobs = [], cards = [];
  const limb = (r0, r1, a, b) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), L = A.distanceTo(B); const g = new T.CylinderGeometry(r1, r0, L, 7, 3); g.translate(0, L / 2, 0); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize())); bark.push(g.translate(A.x, A.y, A.z)); };
  const crownBase = sp === 'cyp' ? 0.9 : sp === 'plane' ? 3.0 : 3.4, CR = sp === 'plane' ? 3.4 : sp === 'linden' ? 2.5 : 0.95, CH = sp === 'plane' ? 4.8 : sp === 'linden' ? 6.0 : 8.6;
  // Stamm mit Wurzelanlauf, leicht geneigt
  const prof = [[0.42, 0], [0.3, 0.25], [0.24, 0.6], [0.21, crownBase], [0.14, crownBase + CH * 0.5], [0.04, crownBase + CH * 0.9]].map(([r, y]) => new T.Vector2(r * (sp === 'cyp' ? 0.6 : 1), y));
  const tr = new T.LatheGeometry(prof, 12); { const lean = (rr() - 0.5) * 0.05, p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + lean * y * y * 0.3 + Math.sin(y * 1.7) * 0.03 * y); } } bark.push(tr);
  const centers = [];
  if (sp === 'cyp') {
    for (let k = 0; k < 7; k++) { const y = crownBase + 0.5 + k * (CH / 7), r = CR * Math.sin(Math.PI * (0.12 + 0.82 * (k + 0.5) / 7)) * 1.05; centers.push([0, y, 0, Math.max(0.35, r)]); }
  } else {
    const n = sp === 'plane' ? 14 : 12;
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.28 + rr() * 0.6, up = rr();
      const rad = (0.35 + 0.5 * rr()) * CR, y = crownBase + CH * (0.3 + 0.55 * up);
      centers.push([Math.cos(a) * rad * (1 - up * 0.4), y, Math.sin(a) * rad * (1 - up * 0.4), CR * (0.42 + 0.2 * rr())]);
    }
    centers.push([0, crownBase + CH * 0.85, 0, CR * 0.5]);
    // Äste vom Stamm zu den Laubbüscheln
    for (const c of centers.slice(0, 10)) limb(0.13, 0.04, [0, crownBase - 0.2 + rr() * 0.6, 0], [c[0] * 0.8, c[1] - c[3] * 0.4, c[2] * 0.8]);
  }
  const ctr = new T.Vector3(0, crownBase + CH * 0.5, 0);
  // Weiche Beleuchtung: Normalen zeigen von der Kronenmitte nach außen
  const sphereNormals = g => { const p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(ctr); v.y *= sp === 'cyp' ? 0.3 : 0.8; v.normalize(); n.setXYZ(i, v.x, v.y, v.z); } return g; };
  for (const [x, y, z, r] of centers) {
    const b = new T.IcosahedronGeometry(r * 0.78, 1); const p = b.attributes.position;
    for (let i = 0; i < p.count; i++) { const f = 0.8 + 0.4 * rr(); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * (sp === 'cyp' ? 1.4 : 0.85), p.getZ(i) * f); }
    blobs.push(sphereNormals(b.translate(x, y, z)));
    const nCards = sp === 'cyp' ? 16 : 22;
    for (let k = 0; k < nCards; k++) {
      const s = r * (0.9 + rr() * 0.5), q = new T.PlaneGeometry(s, s);
      q.rotateX((rr() - 0.5) * 2.4); q.rotateY(rr() * 6.28);
      const d = new T.Vector3(rr() - 0.5, (rr() - 0.4) * (sp === 'cyp' ? 2.0 : 0.9), rr() - 0.5).normalize().multiplyScalar(r * (0.55 + rr() * 0.35));
      cards.push(sphereNormals(q.translate(x + d.x, y + d.y, z + d.z)));
    }
  }
  return { bark: mergeGeos(bark), blobs: mergeGeos(blobs), cards: mergeGeos(cards), lo: mergeGeos([...blobs.map(g => g.clone()), new T.CylinderGeometry(0.15, 0.3, crownBase + 1, 5).translate(0, (crownBase + 1) / 2, 0)]) };
}
// Laub für Hecken und Buchs: dichte kleine Blätter mit Licht und Schatten
export const HEDGE_TEX = texSet(256, (g, gr, gh, W) => {
  const rr = mulberry32(4455);
  g.fillStyle = '#0c1c10'; g.fillRect(0, 0, W, W); gr.fillStyle = '#b0b0b0'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
  for (let k = 0; k < 2600; k++) {
    const x = rr() * W, y = rr() * W, a = rr() * 6.28, L = 2.5 + rr() * 3, v = 0.5 + rr() * 0.7;
    for (const [ox, oy] of [[0, 0], [W, 0], [-W, 0], [0, W], [0, -W]]) {
      g.save(); g.translate(x + ox, y + oy); g.rotate(a); g.fillStyle = `rgb(${Math.round(30 * v)},${Math.round(72 * v)},${Math.round(36 * v)})`; g.beginPath(); g.ellipse(0, 0, L, L * 0.5, 0, 0, 7); g.fill(); g.restore();
      gh.fillStyle = `rgb(${Math.round(80 + 170 * v / 1.2)},0,0)`; gh.beginPath(); gh.ellipse(x + ox, y + oy, L, L * 0.5, a, 0, 7); gh.fill();
    }
  }
}, 2.5);
// Rasen: Halme in Büscheln, Klee, kahle Stellen
export const GRASS = texSet(256, (g, gr, gh, W) => {
  const rr = mulberry32(3344);
  g.fillStyle = '#18301a'; g.fillRect(0, 0, W, W); gr.fillStyle = '#d0d0d0'; gr.fillRect(0, 0, W, W); gh.fillStyle = 'rgb(90,0,0)'; gh.fillRect(0, 0, W, W);
  for (let k = 0; k < 9000; k++) {
    const x = rr() * W, y = rr() * W, v = 0.5 + rr() * 0.8, a = (rr() - 0.5) * 1.2, L = 2 + rr() * 4;
    g.strokeStyle = `rgba(${Math.round(40 * v)},${Math.round(90 * v)},${Math.round(40 * v)},0.8)`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); g.stroke();
    gh.strokeStyle = `rgb(${Math.round(120 + 120 * rr())},0,0)`; gh.lineWidth = 0.7; gh.beginPath(); gh.moveTo(x, y); gh.lineTo(x + Math.sin(a) * L, y - Math.cos(a) * L); gh.stroke();
  }
  for (let k = 0; k < 30; k++) { g.fillStyle = 'rgba(60,50,30,0.25)'; g.beginPath(); g.ellipse(rr() * W, rr() * W, 4 + rr() * 10, 3 + rr() * 8, 0, 0, 7); g.fill(); }
}, 1.5);
// Grasbüschel und Blumen als gekreuzte Karten, die sich im Wind wiegen
export const TUFT_TEX = (() => { const t = canvasTex(256, 256, (g, W) => {
  const rr = mulberry32(2233); g.clearRect(0, 0, W, W);
  for (let k = 0; k < 120; k++) { const x = 20 + rr() * 216, h = 70 + rr() * 170, bend = (rr() - 0.5) * 60, v = 0.5 + rr() * 0.7;
    g.strokeStyle = `rgb(${Math.round(45 * v)},${Math.round(100 * v)},${Math.round(42 * v)})`; g.lineWidth = 2 + rr() * 2.5; g.beginPath(); g.moveTo(x, W); g.quadraticCurveTo(x + bend * 0.3, W - h * 0.6, x + bend, W - h); g.stroke(); }
  for (let k = 0; k < 9; k++) { const x = 40 + rr() * 176, y = 60 + rr() * 90, c = [['#d84a5a', '#f2d36a'], ['#f4efe4', '#f2c440'], ['#8a5ad0', '#f6e08a'], ['#f2a83a', '#6a3a10']][Math.floor(rr() * 4)];
    if (rr() < 0.25) continue; g.strokeStyle = '#2a5a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, W); g.lineTo(x, y); g.stroke();
    g.fillStyle = c[0]; for (let p = 0; p < 6; p++) { const a = p / 6 * 6.28; g.beginPath(); g.ellipse(x + Math.cos(a) * 7, y + Math.sin(a) * 7, 6, 3.5, a, 0, 7); g.fill(); } g.fillStyle = c[1]; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
}); t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter; return t; })();
export function worldUVMat(mat, sc) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      { vec4 wq = modelMatrix * vec4(position, 1.0);
        #ifdef USE_INSTANCING
          wq = modelMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
        vec3 nq = abs(normal); vUv = (nq.y > 0.5 ? wq.xz : nq.x > 0.5 ? wq.zy : wq.xy) / ${sc.toFixed(2)}; }`);
  };
  return mat;
}
export function buildParkPlants(parks) {
  if (MOBILE || !parks.length) return;
  const rr = mulberry32(7766), list = [], m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  for (const b of parks) {
    const x0 = b.x0 + 5, x1 = b.x1 - 5, z0 = b.z0 + 5, z1 = b.z1 - 5, n = Math.min(6000, Math.round((x1 - x0) * (z1 - z0) / 1.3));
    for (let k = 0; k < n; k++) {
      const x = x0 + rr() * (x1 - x0), z = z0 + rr() * (z1 - z0), s = 0.35 + rr() * 0.45;
      q.setFromAxisAngle(up, rr() * 6.28); list.push({ x, z, m: m.compose(new T.Vector3(x, 0.27, z), q, new T.Vector3(s * 1.4, s, s * 1.4)).clone() });
    }
  }
  const card = mergeGeos([new T.PlaneGeometry(1, 1).translate(0, 0.5, 0), new T.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]);
  { const n = card.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  const mat = windPatch(stdMat({ map: TUFT_TEX, alphaTest: 0.5, side: T.DoubleSide, roughness: 0.9, envI: 0.2, emissive: 0x0a140a, emissiveMap: TUFT_TEX }), 0.7, 0.015, true);
  mat.onBeforeCompile = (prev => sh => { prev(sh); sh.vertexShader = sh.vertexShader.replace('transformed.x += sw * 0.09 * bend;', 'transformed.x += sw * 0.09 * bend + sin(uTime * 2.2 + ph * 7.0 + position.x) * 0.12 * position.y;'); })(mat.onBeforeCompile);
  const im = new T.InstancedMesh(card, mat, list.length);
  list.forEach((p, i) => im.setMatrixAt(i, p.m));
  im.frustumCulled = false; scene.add(im); LAMP_SETS.push({ im, pts: list, near: 90 });
}

export const TREE_SETS = []; export let treeTimer = 0;
export function buildTrees() {
  if (!trees.length) return;
  const barkMat = snowy(windPatch(stdMat({ map: BARK.map, normalMap: BARK.normal, roughnessMap: BARK.rough, roughness: 1, color: 0x9a8a78, envI: 0.2, emissive: 0x0a0806 }), 0.5), 0.5);
  const leafMat = snowy(windPatch(stdMat({ map: LEAF_TEX, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.75, metalness: 0, envI: 0.35, emissive: 0x0b1408, emissiveMap: LEAF_TEX }), 1, 0.05), 0.6);
  const blobMat = snowy(windPatch(stdMat({ color: 0x1d3a22, roughness: 0.9, envI: 0.2, emissive: 0x060c06 }), 1), 0.8);
  const loMat = snowy(windPatch(stdMat({ color: 0x24442a, roughness: 0.9, envI: 0.2, emissive: 0x070d07 }), 1), 0.8);
  const bySp = {};
  const rr = mulberry32(8899);
  for (const t of trees) { const sp = t.sp || (rr() < 0.55 ? 'plane' : 'linden'); (bySp[sp] ||= []).push(t); }
  const m = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0), c = new T.Color();
  for (const sp in bySp) {
    const list = bySp[sp], G = treeGeos(sp), n = list.length;
    const mk = (geo, mat, tint) => { const im = new T.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.count = 0; im.instanceMatrix.setUsage(T.DynamicDrawUsage); if (tint) { for (let i = 0; i < n; i++) im.setColorAt(i, c); im.userData.tint = true; } scene.add(im); return im; };
    const hi = [mk(G.bark, barkMat), mk(G.blobs, blobMat, true), mk(G.cards, leafMat, true)], lo = [mk(G.lo, loMat, true)];
    const pts = list.map(t => { q.setFromAxisAngle(up, rr() * 6.28); const s = t.s * (sp === 'cyp' ? 1.0 : 1.1); m.compose(new T.Vector3(t.x, t.y ?? 0.25, t.z), q, new T.Vector3(s, s * (0.9 + rr() * 0.2), s)); return { x: t.x, z: t.z, m: m.clone(), c: new T.Color().setHSL(0.25 + rr() * 0.1, 0.3 + rr() * 0.25, sp === 'cyp' ? 0.32 : 0.4 + rr() * 0.2) }; });
    TREE_SETS.push({ hi, lo, pts });
  }
  updateTreeLod(1);
}
export function updateTreeLod(dt) {
  if ((treeTimer -= dt) > 0) return;
  treeTimer = 0.3;
  const cp = camera.position, D2 = ((MOBILE ? 110 : 230) + Math.max(0, cp.y) * 0.5) ** 2, F2 = Math.min(2600, FOGVIS.tall) ** 2;
  for (const st of TREE_SETS) {
    let a = 0, b = 0;
    st.pts.forEach((p, i) => {
      const d2 = (p.x - cp.x) ** 2 + (p.z - cp.z) ** 2;
      if (d2 < D2) { for (const im of st.hi) { im.setMatrixAt(a, p.m); if (im.userData.tint) im.setColorAt(a, p.c); } a++; }
      else if (d2 < F2) { st.lo[0].setMatrixAt(b, p.m); st.lo[0].setColorAt(b, p.c); b++; }
    });
    for (const im of [...st.hi, ...st.lo]) { im.count = im === st.lo[0] ? b : a; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
}

/* ---------- Parkende Limousinen am Bordstein ---------- */
shared.carBodyGeo = undefined;
export function buildParkedCars() {
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), list = [];
  for (const c of curbs) {
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az), dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L;
    const ox = dz, oz = -dx; // vom Bordstein nach außen auf die Fahrbahn
    for (let t = 8; t < L - 8; t += 13) {
      if (R() > 0.38) continue;
      const px = c.ax + dx * t + ox * 2.3, pz = c.az + dz * t + oz * 2.3;
      if (inRect(px, pz, PLAZA, 6) || inRect(px, pz, MEDIAN, 8)) continue;
      e.set(0, Math.atan2(-dz, dx) + (R() < 0.5 ? Math.PI : 0), 0); q.setFromEuler(e);
      const mm = m.compose(new T.Vector3(px, 0.22, pz), q, new T.Vector3(1, 1, 1)).clone(); mm.ox = ox; mm.oz = oz; list.push(mm);
    }
  }
  // zwei Roadster am Rondell der Villa, bereit für die Fahrt hinunter
  if (SERP.on) for (const lz of [-50, -30]) { const [x, z] = serpW(-47, lz), cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry); e.set(0, Math.atan2(-sn, -cs), 0); q.setFromEuler(e); const mm = m.compose(new T.Vector3(x, VILLA.y + 0.27, z), q, new T.Vector3(1, 1, 1)).clone(); mm.ox = 0; mm.oz = 0; list.push(mm); }
  if (!list.length) return;
  const im = new T.InstancedMesh(shared.carBodyGeo, MAT.carPaint, list.length), imHi = new T.InstancedMesh(carGeoHi(), MAT.carPaint, list.length);
  const paint = [[0.05, 0.05, 0.06], [0.22, 0.04, 0.06], [0.05, 0.14, 0.1], [0.08, 0.1, 0.22], [0.45, 0.33, 0.15], [0.12, 0.12, 0.13]];
  const col = new T.Color();
  list.forEach((mm, i) => { im.setMatrixAt(i, mm); const p = pick(paint).map(v => v + (Math.random() - 0.5) * 0.012); im.setColorAt(i, col.setRGB(p[0], p[1], p[2])); parked.push({ m: mm, c: p, x: mm.elements[12], z: mm.elements[14], ox: mm.ox, oz: mm.oz }); });
  im.frustumCulled = imHi.frustumCulled = false; im.count = imHi.count = 0; scene.add(im, imHi);
  carDamageAttr(imHi); carDamageAttr(im);
  parkedCmp = lodCompactor(imHi, im, LOD_CAR2);
}
export const parked = []; export let parkedCmp = null; shared.parkedTimer = 0;
export function updateParked(dt) {
  if (!parkedCmp || (shared.parkedTimer -= dt) > 0) return;
  shared.parkedTimer = 0.15;
  const cp = camera.position, D2 = Math.min(420 + Math.max(0, cp.y), FOGVIS.ped) ** 2;   // V27: im Nebel nur so weit, wie man sieht
  parkedCmp.begin();
  for (const c of parked) { if (c.hidden) continue; const d2 = (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 + cp.y * cp.y; if (d2 < D2) parkedCmp.put(c.m, c, c.c, d2); }
  parkedCmp.end();
}


/* ---------- Modelle: Limousine, Menschen, Straßenbahn (je ein farbiges Netz) ---------- */
export const COL = { skin: [0.88, 0.58, 0.42], hair: [0.07, 0.05, 0.04], blond: [0.62, 0.5, 0.3], tux: [0.025, 0.025, 0.03], shirt: [0.92, 0.9, 0.86], dark: [0.04, 0.04, 0.045], chrome: [0.85, 0.86, 0.88], glass: [0.03, 0.045, 0.06], tyre: [0.03, 0.03, 0.03], wall: [0.85, 0.83, 0.78], gold: [0.9, 0.66, 0.3] };
export function carGeo() {
  const B = IB;
  const C = (rt, rb, h, seg, x, y, z, rx = 0, rz = 0) => { const g = new T.CylinderGeometry(rt, rb, h, seg); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); return g.translate(x, y, z); };
  const parts = [
    [B(5.0, 0.12, 1.9, 0, 0.42, 0), COL.dark],                     // Trittbretter
    [B(1.9, 0.62, 1.15, 1.5, 0.95, 0), PAINT],                      // lange Motorhaube
    [B(0.08, 0.66, 0.9, 2.47, 0.95, 0), COL.chrome],                // Kühlergrill
    [B(0.3, 0.12, 1.2, 2.52, 0.55, 0), COL.chrome],                 // Stoßstange
    [B(2.6, 0.78, 1.72, -0.75, 0.95, 0), PAINT],                    // Fahrgastraum
    [B(2.15, 0.6, 1.6, -0.85, 1.64, 0), COL.glass],                 // Fenster
    [B(2.35, 0.08, 1.7, -0.85, 1.98, 0), PAINT],                    // Dach
    [B(0.12, 0.62, 1.62, 0.2, 1.64, 0), PAINT], [B(0.12, 0.62, 1.62, -0.85, 1.64, 0), PAINT],
    [B(0.55, 0.6, 1.5, -2.25, 0.9, 0), PAINT],                       // Koffer
    [C(0.45, 0.45, 0.18, 14, -2.62, 1.0, 0, 0, Math.PI / 2), COL.tyre], // Reserverad
    [B(0.08, 0.08, 0.5, 0.75, 1.3, 0), COL.chrome],                  // Kühlerfigur
    [C(0.16, 0.13, 0.22, 10, 2.45, 1.15, 0.62, 0, Math.PI / 2), COL.chrome],
    [C(0.16, 0.13, 0.22, 10, 2.45, 1.15, -0.62, 0, Math.PI / 2), COL.chrome],
  ];
  for (const sx of [1.55, -1.55]) for (const sz of [1, -1]) {
    parts.push([C(0.44, 0.44, 0.24, 16, sx, 0.44, sz * 0.86, Math.PI / 2), COL.tyre]);
    parts.push([C(0.3, 0.3, 0.26, 16, sx, 0.44, sz * 0.86, Math.PI / 2), COL.wall]);
    parts.push([C(0.12, 0.12, 0.28, 8, sx, 0.44, sz * 0.86, Math.PI / 2), COL.chrome]);
    // geschwungene Kotflügel
    const f = new T.CylinderGeometry(0.56, 0.56, 0.36, 14, 1, true, -Math.PI / 2, Math.PI); f.rotateX(Math.PI / 2); f.translate(sx, 0.48, sz * 0.86);
    parts.push([f, PAINT]);
  }
  return mergeColored(parts);
}
// Figuren schauen nach +z. Weiß = Instanzfarbe (Mantel, Kleid, Livree)
export function personGeo(kind) {
  const P = []; let LB = [0, 0]; const push0 = P.push.bind(P); P.push = e => push0([e[0], e[1], LB[0], LB[1]]);
  const cyl = (rt, rb, h, x, y, z, c, seg = 8) => P.push([new T.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z), c]);
  const sph = (r, x, y, z, c, sy = 1) => P.push([new T.SphereGeometry(r, 10, 8).scale(1, sy, 1).translate(x, y, z), c]);
  const box = (w, h, d, x, y, z, c) => P.push([new T.BoxGeometry(w, h, d).translate(x, y, z), c]);
  const male = kind !== 'lady' && kind !== 'gown' && kind !== 'dress';
  if (male) {
    const leg = kind === 'coat' ? [0.07, 0.07, 0.08] : kind === 'worker' || kind === 'kid' ? [0.17, 0.14, 0.11] : kind === 'suit' || kind === 'police' ? PAINT : COL.tux;
    for (const sx of [-0.1, 0.1]) { LB = [sx < 0 ? 1 : 2, 0.9]; cyl(0.075, 0.065, 0.86, sx, 0.02, 0, leg); box(0.12, 0.08, 0.26, sx, 0.04, 0.04, COL.dark); } LB = [0, 0];
    const jacket = kind === 'tux' ? COL.tux : PAINT;
    if (kind === 'coat') cyl(0.23, 0.27, 0.75, 0, 0.62, 0, PAINT, 10); else cyl(0.22, 0.2, 0.5, 0, 0.84, 0, jacket, 10);
    cyl(0.17, 0.23, 0.12, 0, 1.33, 0, jacket, 10);
    if (kind === 'worker') box(0.3, 0.32, 0.36, 0, 1.06, 0, [0.09, 0.08, 0.075]);
    else if (kind !== 'coat') { box(0.13, 0.3, 0.02, 0, 1.2, 0.205, COL.shirt); box(0.1, 0.035, 0.03, 0, 1.4, 0.21, kind === 'tux' ? COL.tux : COL.gold); }
    for (const sx of [-0.27, 0.27]) { LB = [sx < 0 ? 3 : 4, 1.42]; cyl(0.06, 0.055, 0.62, sx, 0.82, 0, jacket); sph(0.045, sx, 0.8, 0, COL.skin); } LB = [0, 0];
    cyl(0.055, 0.06, 0.1, 0, 1.44, 0, COL.skin);
    sph(0.11, 0, 1.62, 0, COL.skin, 1.12);
    if (kind === 'coat') { cyl(0.21, 0.21, 0.02, 0, 1.69, 0, COL.dark, 14); cyl(0.11, 0.12, 0.13, 0, 1.7, 0, COL.dark, 12); }
    else if (kind === 'livery') { sph(0.112, 0, 1.66, -0.01, COL.hair, 0.8); cyl(0.11, 0.115, 0.1, 0, 1.71, 0, PAINT, 12); }
    else if (kind === 'worker') sph(0.118, 0, 1.69, 0.01, [0.2, 0.18, 0.15], 0.5);
    else sph(0.115, 0, 1.665, -0.015, Math.random() < 0.5 ? COL.hair : COL.blond, 0.78);
  } else {
    const gown = kind === 'gown';
    for (const sx of [-0.085, 0.085]) { LB = [sx < 0 ? 1 : 2, 0.88]; cyl(0.06, 0.035, 0.84, sx, 0.02, 0, [0.55, 0.42, 0.34]); } LB = [0, 0];
    if (gown) cyl(0.15, 0.3, 1.18, 0, 0.0, 0, PAINT, 14); else if (kind === 'dress') cyl(0.16, 0.25, 0.8, 0, 0.42, 0, PAINT, 12); else cyl(0.16, 0.26, 0.85, 0, 0.42, 0, PAINT, 12);
    cyl(0.15, 0.16, 0.18, 0, 1.18, 0, PAINT, 12);
    cyl(0.13, 0.15, 0.08, 0, 1.36, 0, gown ? COL.skin : PAINT, 12);
    for (const sx of [-0.2, 0.2]) { LB = [sx < 0 ? 3 : 4, 1.4]; cyl(0.04, 0.035, 0.58, sx, 0.84, 0, gown ? COL.skin : PAINT); } LB = [0, 0];
    cyl(0.045, 0.05, 0.09, 0, 1.43, 0, COL.skin);
    sph(0.1, 0, 1.6, 0, COL.skin, 1.12);
    if (gown) { sph(0.112, 0, 1.635, -0.02, Math.random() < 0.4 ? COL.blond : COL.hair, 0.85); box(0.05, 0.05, 0.02, 0.07, 1.7, 0.06, COL.gold); }
    else { sph(0.125, 0, 1.66, -0.01, COL.dark, 0.7); cyl(0.17, 0.17, 0.015, 0, 1.63, 0, COL.dark, 14); }
  }
  return mergeColored(P);
}

// Feine Modelle für die Nähe (unter etwa 60 m bei Personen, 130 m bei Autos)
export function carGeoHi(opts = {}) {
  // Varianten: 1 Limousine, 2 Cabriolet mit offenem Verdeck, 3 Taxi; 4 = Dach für Limousine und Taxi
  const P = []; let OPT = 0; const push0 = P.push.bind(P); P.push = e => push0([e[0], e[1], 0, 0, OPT]);
  const B = (w, h, d, x, y, z, c) => P.push([new T.BoxGeometry(w, h, d).translate(x, y, z), c]);
  const ext = (pts, depth, z, c, bevel = 0.05) => {
    const sh = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
    const g = new T.ExtrudeGeometry(sh, { depth: depth - 2 * bevel, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
    P.push([g.translate(0, 0, z - depth / 2 + bevel), c]);
  };
  // V27: Karosserie aus Querschnitten (carLoft in cars.js): gewölbte lange Haube, Fahrgastraum mit eingezogenen Flanken, rund abfallendes Heck
  P.push([carLoft([
    { x: 0.55, w: 0.58, yb: 0.62, yt: 1.29, n: 5 }, { x: 1.2, w: 0.575, yb: 0.62, yt: 1.27, n: 5 }, { x: 2.0, w: 0.55, yb: 0.63, yt: 1.23, n: 4.5 },
    { x: 2.36, w: 0.52, yb: 0.64, yt: 1.2, n: 4 }, { x: 2.44, w: 0.49, yb: 0.66, yt: 1.16, n: 3.5 }]), PAINT]);
  P.push([carLoft([
    { x: -2.53, w: 0.42, yb: 0.76, yt: 0.86, n: 2.4 }, { x: -2.48, w: 0.62, yb: 0.69, yt: 0.99, n: 3 }, { x: -2.36, w: 0.75, yb: 0.63, yt: 1.15, n: 3.6 },
    { x: -2.1, w: 0.83, yb: 0.6, yt: 1.29, n: 4.2 }, { x: -1.5, w: 0.86, yb: 0.58, yt: 1.335, n: 5 }, { x: -0.2, w: 0.865, yb: 0.58, yt: 1.33, n: 5 },
    { x: 0.5, w: 0.85, yb: 0.6, yt: 1.32, n: 5 }, { x: 0.64, w: 0.8, yb: 0.62, yt: 1.3, n: 4.5 }], 26), PAINT]);
  OPT = 4;
  if (!opts.driver) ext([[-1.98, 1.3], [0.42, 1.3], [0.24, 1.93], [-1.82, 1.96], [-2.02, 1.72]], 1.58, 0, COL.glass, 0.02);
  // gewölbtes Dach mit Regenrinne
  P.push([carLoft([{ x: -2.02, w: 0.78, yb: 1.86, yt: 1.95, n: 2.6 }, { x: -1.85, w: 0.83, yb: 1.9, yt: 2.03, n: 3.2 }, { x: -0.8, w: 0.845, yb: 1.91, yt: 2.06, n: 3.4 }, { x: 0.1, w: 0.835, yb: 1.91, yt: 2.03, n: 3.2 }, { x: 0.3, w: 0.8, yb: 1.9, yt: 1.97, n: 2.8 }], 18), PAINT]);
  for (const sz of [-1, 1]) B(2.25, 0.025, 0.025, -0.85, 1.905, sz * 0.84, COL.chrome);
  B(0.2, 0.025, 1.52, 0.4, 1.96, 0, PAINT);                                             // Sonnenblende über der Frontscheibe
  for (const x of [0.3, -0.78, -1.88]) for (const sz of [-1, 1]) B(0.08, 0.66, 0.05, x, 1.63, sz * 0.8, PAINT);
  OPT = 0;
  B(0.08, 0.04, 1.6, 0.36, 1.31, 0, COL.chrome);                                        // Scheibenrahmen
  // Taxi: Dachschild und Taxameter
  OPT = 3; B(0.5, 0.2, 0.12, -0.6, 2.13, 0, [1.0, 0.82, 0.35]); B(0.54, 0.03, 0.16, -0.6, 2.04, 0, COL.chrome); B(0.12, 0.14, 0.1, 0.5, 1.42, 0.6, COL.chrome);
  // Cabriolet: niedrige Windschutzscheibe, gefaltetes Verdeck, Ledersitze, Lenkrad
  OPT = 2;
  P.push([new T.BoxGeometry(0.03, 0.42, 1.5).rotateZ(-0.2).translate(0.4, 1.52, 0), COL.glass]); B(0.05, 0.03, 1.54, 0.44, 1.73, 0, COL.chrome);
  P.push([new T.CylinderGeometry(0.22, 0.22, 1.6, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1.4, 1, 1).translate(-1.95, 1.33, 0), [0.08, 0.07, 0.06]]);
  OPT = 0;
  for (const sz of [-1, 1]) { B(2.4, 0.025, 0.02, -0.75, 1.3, sz * 0.86, COL.chrome); B(0.12, 0.02, 0.02, -0.2, 1.12, sz * 0.86, COL.chrome); B(0.12, 0.02, 0.02, -1.3, 1.12, sz * 0.86, COL.chrome); }
  // Kühlergrill mit Lamellen, Kühlerfigur, Scheinwerfer, Hupe
  B(0.08, 0.64, 0.98, 2.46, 0.94, 0, COL.chrome);
  for (let k = -4; k <= 4; k++) B(0.04, 0.54, 0.035, 2.5, 0.94, k * 0.095, COL.dark);
  B(0.06, 0.1, 0.06, 2.42, 1.3, 0, COL.chrome); P.push([new T.ConeGeometry(0.03, 0.16, 6).rotateZ(-Math.PI / 2.5).translate(2.45, 1.38, 0), COL.chrome]);
  for (const sz of [-1, 1]) {
    // V27: große Scheinwerfer in Geschossform auf einem Querträger
    P.push([new T.SphereGeometry(0.19, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62).rotateZ(-Math.PI / 2).scale(1.35, 1, 1).translate(2.3, 1.12, sz * 0.64), COL.chrome]);
    P.push([new T.CircleGeometry(0.165, 18).rotateY(Math.PI / 2).translate(2.395, 1.12, sz * 0.64), [1.0, 0.95, 0.8]]);
    P.push([new T.TorusGeometry(0.17, 0.014, 4, 18).rotateY(Math.PI / 2).translate(2.4, 1.12, sz * 0.64), COL.chrome]);
    B(0.05, 0.05, 0.05, 2.32, 1.02, sz * 0.62, COL.chrome);
    P.push([new T.CylinderGeometry(0.05, 0.02, 0.22, 10).rotateZ(-Math.PI / 2).translate(2.3, 0.98, sz * 0.36), COL.chrome]);
    B(0.06, 0.08, 0.1, -2.44, 0.95, sz * 0.7, [0.6, 0.04, 0.04]);                       // Rücklichter
    B(0.02, 0.1, 0.05, 0.34, 1.42, sz * 0.88, COL.chrome);                               // Spiegelhalter
  }
  P.push([new T.CylinderGeometry(0.025, 0.025, 1.1, 8).rotateX(Math.PI / 2).translate(2.32, 1.0, 0), COL.chrome]);   // Lampenträger
  // V27: Stoßstangen als zwei runde Chromstäbe mit Hörnern, vorn und hinten
  for (const [x, y] of [[2.64, 0.58], [-2.62, 0.62]]) {
    for (const dy of [0.04, -0.05]) P.push([new T.CylinderGeometry(0.035, 0.035, 1.86, 10).rotateX(Math.PI / 2).translate(x, y + dy, 0), COL.chrome]);
    for (const sz of [-0.55, 0.55]) { P.push([new T.CylinderGeometry(0.03, 0.03, 0.26, 8).translate(x + Math.sign(x) * 0.02, y + 0.06, sz), COL.chrome]); B(0.22, 0.04, 0.04, x - Math.sign(x) * 0.09, y, sz, COL.chrome); }
    B(0.02, 0.12, 0.34, x - Math.sign(x) * 0.03, y + 0.2, 0, [0.85, 0.82, 0.7]);        // Nummernschild
  }
  // Kühlerfigur mit Flügeln
  for (const sz of [-1, 1]) P.push([new T.BoxGeometry(0.1, 0.012, 0.09).rotateX(sz * 0.5).rotateZ(0.35).translate(2.4, 1.36, sz * 0.05), COL.chrome]);
  // Reserverad am Heck
  P.push([new T.TorusGeometry(0.36, 0.09, 6, 16).rotateY(Math.PI / 2).translate(-2.56, 1.0, 0), COL.tyre]);
  P.push([new T.CylinderGeometry(0.28, 0.28, 0.08, 18).rotateZ(Math.PI / 2).translate(-2.56, 1.0, 0), PAINT]);

  // V27: gewölbte Kotflügel, die dem Rad folgen; vorn bis ins Trittbrett gezogen, hinten als Tropfen mit Heckschürze
  for (const sz of [-1, 1]) {
    P.push([carSweep(fenderPath(1.55, 0.53, -0.38, Math.PI + 0.05, [[0.82, 0.5], [0.62, 0.47], [0.4, 0.46]]), sz * 0.87, 0.44, 0.075), PAINT]);
    P.push([carSweep([[-0.95, 0.47], ...fenderPath(-1.55, 0.53, 0.15, Math.PI + 0.1, [[-2.2, 0.4], [-2.28, 0.46]])], sz * 0.87, 0.44, 0.075), PAINT]);
    B(1.9, 0.05, 0.38, 0.0, 0.465, sz * 0.9, COL.dark);                                  // Trittbrett mit Gummimatten und Chromleisten
    for (const x of [0.55, 0, -0.55]) B(0.42, 0.012, 0.3, x, 0.495, sz * 0.9, [0.06, 0.06, 0.06]);
    B(1.9, 0.02, 0.02, 0.0, 0.5, sz * 1.08, COL.chrome);
    // Türgriffe, Scharniere
    for (const x of [0.44, -1.1]) B(0.12, 0.025, 0.035, x, 1.2, sz * 0.875, COL.chrome);
    for (const x of [0.6, -0.96]) for (const y of [0.85, 1.15]) B(0.03, 0.06, 0.02, x, y, sz * 0.872, COL.chrome);
    // Reserverad im vorderen Kotflügel mit lackierter Haube und Spiegel obendrauf
    P.push([new T.TorusGeometry(0.33, 0.095, 8, 22).rotateY(sz * 0.12).translate(0.78, 0.86, sz * 1.0), COL.tyre]);
    P.push([new T.CylinderGeometry(0.34, 0.34, 0.07, 22).rotateX(Math.PI / 2).rotateY(sz * 0.12).translate(0.78, 0.86, sz * 1.04), PAINT]);
    P.push([new T.TorusGeometry(0.34, 0.012, 4, 22).rotateY(sz * 0.12).translate(0.78, 0.86, sz * 1.075), COL.chrome]);
    B(0.02, 0.16, 0.02, 0.78, 1.28, sz * 1.0, COL.chrome); P.push([new T.CylinderGeometry(0.06, 0.06, 0.02, 12).rotateX(Math.PI / 2).translate(0.78, 1.38, sz * 1.0), COL.chrome]);
    // Positionsleuchten auf den Kotflügeln, Begrenzungsleuchte am Windlauf
    P.push([new T.SphereGeometry(0.045, 10, 6).scale(1.6, 1, 1).translate(1.62, 1.03, sz * 0.87), COL.chrome]);
    P.push([new T.SphereGeometry(0.04, 10, 6).scale(1.4, 1, 1).translate(0.62, 1.36, sz * 0.66), COL.chrome]);
  }
  // Drahtspeichenräder mit Weißwandreifen
  for (const sx of opts.noWheels ? [] : [1.55, -1.55]) for (const sz of [1, -1]) carWheel((g, c) => P.push([g, c]), sx, sz * 0.86, sz, COL);
  carCabin((g, c, o = 0) => push0([g, c, 0, 0, o]), opts);
  return mergeColored(P);
}
// Ein Menschen-Satz: mehrere Kleidungsarten, jede eine InstancedMesh mit Farben pro Person
export class Crowd {
  constructor(kinds, max) { this.nr = {}; this.hi = {}; this.lo = {}; this.list = []; this.max = max; this.kinds = kinds; this.vis = true; this.far = 320; }
  // Statur: jede Figur etwas schmaler oder kräftiger
  add(kind, color, face) { const fem = kind === 'lady' || kind === 'gown' || kind === 'dress'; this.list.push({ kind, color, m: new T.Matrix4(), on: false, bw: fem ? 0.9 + Math.random() * 0.16 : 0.9 + Math.random() * 0.26, gait: [Math.random() * 6.28, 0, 0, face ?? personLook(kind)], live: [0, -9, 0, 1] }); return this.list[this.list.length - 1]; }
  finish() {
    for (const k of this.kinds) {
      const n = this.list.filter(a => a.kind === k).length;
      if (!n) continue;
      for (const [store, geo] of [[this.nr, personShare(k, MOBILE ? 1 : 2)], [this.hi, personShare(k, 1)], [this.lo, personGeo(k)]]) {
        geo.setAttribute('aGait', new T.InstancedBufferAttribute(new Float32Array(n * 4), 4));
        if (store !== this.lo) geo.setAttribute('aLive', new T.InstancedBufferAttribute(new Float32Array(n * 4).fill(1), 4));
        const im = new T.InstancedMesh(geo, MAT.cloth, n); im.count = 0; for (let j = 0; j < n; j++) im.setColorAt(j, new T.Color(1, 1, 1));
        im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; scene.add(im);
        store[k] = compactor(im); store[k].im = im;
      }
    }
  }
  // V29: Matrix direkt aus Gierwinkel und Neigung (statt Euler -> Quaternion -> Matrix); wer still steht oder sitzt,
  // bekommt dieselben Werte wie im letzten Bild, dann bleibt die Matrix einfach stehen
  set(a, x, y, z, yaw, sc = 1, tilt = 0) {
    a.on = true;
    const k = a.k6 || (a.k6 = [NaN, 0, 0, 0, 0, 0]);
    if (k[0] === x && k[1] === y && k[2] === z && k[3] === yaw && k[4] === sc && k[5] === tilt) return;
    k[0] = x; k[1] = y; k[2] = z; k[3] = yaw; k[4] = sc; k[5] = tilt;
    const c = Math.cos(yaw), s = Math.sin(yaw), sx = sc * a.bw, sy = sc, sz = sc * (0.55 + 0.45 * a.bw), te = a.m.elements;
    if (tilt) {
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      te[0] = c * sx; te[1] = 0; te[2] = -s * sx;
      te[4] = s * st * sy; te[5] = ct * sy; te[6] = c * st * sy;
      te[8] = s * ct * sz; te[9] = -st * sz; te[10] = c * ct * sz;
    } else {
      te[0] = c * sx; te[1] = 0; te[2] = -s * sx;
      te[4] = 0; te[5] = sy; te[6] = 0;
      te[8] = s * sz; te[9] = 0; te[10] = c * sz;
    }
    te[3] = 0; te[7] = 0; te[11] = 0; te[12] = x; te[13] = y; te[14] = z; te[15] = 1;
  }
  // Nahe Figuren als feines Modell, entfernte als einfaches, ganz ferne gar nicht
  flag() {
    if (!this.vis) return;
    const cp = camera.position, far2 = Math.min(this.far + Math.max(0, cp.y), FOGVIS.ped) ** 2;
    for (const k in this.hi) { this.nr[k].begin(); this.hi[k].begin(); this.lo[k].begin(); }
    glances(this);
    for (const a of this.list) {
      if (!a.on) continue;
      const e = a.m.elements, d2 = (e[12] - cp.x) ** 2 + (e[13] - cp.y) ** 2 + (e[14] - cp.z) ** 2;
      if (d2 < 900 && NEAR.length < 64) NEAR.push(a);
      if (d2 < HQ.near2) this.nr[a.kind].put(a.m, a, a.color, a.gait);
      else if (d2 < LOD_PERSON2) this.hi[a.kind].put(a.m, a, a.color, a.gait);
      else if (d2 < far2) this.lo[a.kind].put(a.m, a, a.color, a.gait);
    }
    for (const k in this.hi) { this.nr[k].end(); this.hi[k].end(); this.lo[k].end(); for (const st of [this.nr, this.hi, this.lo]) st[k].im.visible = st[k].n > 0; }
  }
  show(v) { this.vis = v; for (const k in this.hi) { this.nr[k].im.visible = v; this.hi[k].im.visible = v; this.lo[k].im.visible = v; } }
}
// V24: Köpfe drehen sich zu Vorübergehenden (aus der Liste naher Figuren des letzten Bildes)
const NEAR = [];
function glances(C) {
  const now = U.uTime.value;
  if (NEAR.length > 1 && now - (C.gt || 0) > 0.2) {
    C.gt = now;
    for (let k = 0; k < 3; k++) {
      const a = NEAR[Math.floor(Math.random() * NEAR.length)];
      if (now - a.live[1] < 5 || Math.random() < 0.5) continue;
      const e = a.m.elements, anyone = Math.random() < 0.3; let best = null, bd = 25;
      for (const b of NEAR) {
        if (b === a || (!anyone && b.gait[2] < 0.05)) continue;   // meist fällt auf, wer vorbeigeht, manchmal ein Nachbar
        const f = b.m.elements, d = (f[12] - e[12]) ** 2 + (f[14] - e[14]) ** 2;
        if (d > 0.5 && d < bd) { bd = d; best = b; }
      }
      if (best) turnHead(a, best.m.elements[12], best.m.elements[14]);
    }
  }
  NEAR.length = 0;
}
// Kopf (und Blick) einer Figur für ein paar Sekunden zu einem Punkt drehen
export function turnHead(a, x, z) {
  if (!a.live) return;
  const e = a.m.elements, yaw = Math.atan2(e[8], e[10]);
  let d = Math.atan2(x - e[12], z - e[14]) - yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) > 1.9) return;   // hinter sich schaut niemand
  a.live[0] = Math.max(-1.05, Math.min(1.05, d)); a.live[1] = U.uTime.value; a.gv = (a.gv | 0) + 1;
}
export const LOD_PERSON2 = 45 * 45, LOD_CAR2 = 90 * 90;
// Zwei Detailstufen hinter einer Schnittstelle: put() entscheidet nach Abstand
export function lodCompactor(hi, lo, near2) {
  const H = compactor(hi), L = compactor(lo);
  return { begin() { H.begin(); L.begin(); }, put(m, k, c, d2) { (d2 < near2 ? H : L).put(m, k, c); }, end() { H.end(); L.end(); } };
}
export const _cc = new T.Color();
export function compactor(im) {
  const key = new Array(im.count).fill(null), gv = new Int32Array(im.count); let DA = null;
  return {
    n: 0, dirty: false,
    begin() { this.n = 0; DA = im.geometry.attributes.aDmg || null; },
    put(m, k, c, gait) {
      const n = this.n++; im.setMatrixAt(n, m);
      if (DA) { const d = k.dmg; if (d || DA.getX(n) + DA.getY(n) + DA.getZ(n) > 0 || DA.getW(n) < 1) { DA.setXYZW(n, d ? d[0] : 0, d ? d[1] : 0, d ? d[2] : 0, d ? 1 - d[3] : 1); this.dDirty = true; } }
      if (key[n] !== k || gv[n] !== (k.gv | 0)) { key[n] = k; gv[n] = k.gv | 0; im.setColorAt(n, _cc.setRGB(c[0], c[1], c[2])); const ga = im.geometry.attributes.aGait; if (ga && gait) ga.setXYZW(n, gait[0], gait[1], gait[2], gait[3] || 0); const la = im.geometry.attributes.aLive; if (la) { const l = k.live; if (l) la.setXYZW(n, l[0], l[1], l[2], l[3]); else la.setXYZW(n, 0, -9, 0, 1); } this.dirty = true; }
    },
    end() { im.count = this.n; im.instanceMatrix.needsUpdate = true; if (this.dDirty && DA) { DA.needsUpdate = true; this.dDirty = false; } if (this.dirty && im.instanceColor) { im.instanceColor.needsUpdate = true; if (im.geometry.attributes.aGait) im.geometry.attributes.aGait.needsUpdate = true; if (im.geometry.attributes.aLive) im.geometry.attributes.aLive.needsUpdate = true; this.dirty = false; } },
  };
}
export const _e = new T.Euler();
export const WORKWEAR = [[0.1, 0.14, 0.24], [0.14, 0.18, 0.28], [0.2, 0.15, 0.1], [0.12, 0.12, 0.13]];
export const SHIRTS = [[0.82, 0.8, 0.74], [0.55, 0.62, 0.72], [0.7, 0.66, 0.56], [0.42, 0.48, 0.58], [0.78, 0.74, 0.66]];
export const DRESSES = [[0.62, 0.12, 0.16], [0.08, 0.32, 0.34], [0.78, 0.66, 0.42], [0.5, 0.48, 0.6], [0.12, 0.12, 0.14], [0.72, 0.5, 0.45], [0.3, 0.42, 0.28], [0.85, 0.8, 0.7]];
export const COATS = [[0.06, 0.05, 0.05], [0.1, 0.08, 0.07], [0.16, 0.12, 0.09], [0.08, 0.08, 0.12], [0.3, 0.26, 0.2], [0.22, 0.07, 0.08], [0.05, 0.14, 0.15], [0.35, 0.3, 0.24]];
export const GOWNS = [[0.75, 0.6, 0.35], [0.85, 0.78, 0.62], [0.6, 0.62, 0.66], [0.45, 0.05, 0.08], [0.04, 0.22, 0.24], [0.06, 0.06, 0.07], [0.7, 0.45, 0.4], [0.9, 0.86, 0.8]];
/* ---------- Passanten auf den Gehsteigen ---------- */
export const peds = [];
export let pedCrowd;
export function buildPedestrians() {
  const loops = [];
  for (const b of blocks) {
    if (b.d > 640) continue;
    const i = 2.2;
    loops.push({ pts: [[b.x0 + i, b.z0 + i], [b.x1 - i, b.z0 + i], [b.x1 - i, b.z1 - i], [b.x0 + i, b.z1 - i]], y: 0.22, per: MOBILE ? 22 : 16, block: b });
  }
  loops.push(...BRIDGE_LOOPS, ...FACTORY_LOOPS, ...PORT_LOOPS);
  loops.push({ pts: [[-84, -118], [84, -118], [84, 118], [-84, 118]], y: 0.26, per: 9 });
  loops.push({ pts: [[-30, 60], [30, 60], [30, 125], [-30, 125]], y: 0.26, per: 8 });
  loops.push({ pts: [[-6.5, 140], [6.5, 140], [6.5, 468], [-6.5, 468]], y: 0.32, per: 12 });
  loops.push({ pts: [[-26, 140], [-19, 140], [-19, 468], [-26, 468]], y: 0.22, per: 16 });
  loops.push({ pts: [[19, 140], [26, 140], [26, 468], [19, 468]], y: 0.22, per: 16 });
  for (const lp of loops) {
    const segsL = []; let total = 0;
    for (let k = 0; k < 4; k++) { const a = lp.pts[k], b = lp.pts[(k + 1) % 4]; const L = Math.hypot(b[0] - a[0], b[1] - a[1]); segsL.push({ a, b, L }); total += L; }
    lp.segs = segsL; lp.total = total;
    if (lp.block) lp.doors = loopDoors(lp);
    const n = Math.max(1, Math.round(total / lp.per * (MOBILE ? 0.5 : 1))) + (lp.doors ? lp.doors.length : 0);
    for (let k = 0; k < n; k++) {
      const pd = { lp, t: R() * total, v: rand(0.9, 1.6) * (R() < 0.5 ? 1 : -1), ph: R() * 6.28, sc: rand(0.9, 1.08), st: 0, cool: R() * 20, mcool: R() * 25 };
      // ein Teil sitzt gerade schon im Lokal
      if (lp.doors && lp.doors.length && k < lp.doors.length) { pd.go = lp.doors[k]; pd.t = pd.go.t; pd.st = 2; pd.wait = R() * 40; }
      // Paare gehen Seite an Seite, im gleichen Tempo
      else if (!lp.worker && R() < 0.12) { pd.v = Math.sign(pd.v) * rand(0.9, 1.15); pd.lat = 0.32; pd.cool = 1e9; pd.kind = R() < 0.5 ? 'suit' : 'coat'; peds.push({ lp, t: pd.t, v: pd.v, ph: pd.ph, sc: rand(0.9, 1.0), st: 0, cool: 1e9, lat: -0.32, kind: R() < 0.55 ? 'lady' : 'dress' }); }
      peds.push(pd);
    }
  }
  peds.push(...buildCitizens(loops));
  // Grüppchen, die vor Bars, Pubs, Cafés und Hotels stehen und plaudern
  const rd = mulberry32(4711);
  for (const d of DOORS) {
    if (d.kind === 'shop' || d.kind === 'workshop' || d.kind === 'house' || rd() < 0.32) continue;
    const n = 2 + Math.floor(rd() * 2), cx = d.x + d.nx * 2.6, cz = d.z + d.nz * 2.6, off = (rd() - 0.5) * 4, m = [];
    for (let k = 0; k < n; k++) {
      const an = k / n * 6.28 + rd(), x = cx + Math.cos(an) * 0.65 + d.nz * off, z = cz + Math.sin(an) * 0.65 + d.nx * off;
      m.push({ st: 4, x, y: 0.22, z, yaw: Math.atan2(cx + d.nz * off - x, cz + d.nx * off - z), sc: 0.9 + rd() * 0.18, v: 0, act: 0.7, eat: rd() < 0.2 });
    }
    if (n === 2 && rd() < 0.5) {
      // zwei teilen sich ein belegtes Brot: einander gegenüber, Hände treffen sich in der Mitte
      const mx = cx + d.nz * off, mz = cz + d.nx * off, an = rd() * 6.28, ux = Math.cos(an), uz = Math.sin(an);
      m.forEach((pd, i) => { const s = i ? 1 : -1; pd.x = mx + ux * 0.56 * s; pd.z = mz + uz * 0.56 * s; pd.yaw = Math.atan2(-ux * s, -uz * s); pd.act = i ? 18.75 : 18.25; pd.eat = false; pd.sc = 0.98 + rd() * 0.06; });
      peds.push(...m); CHATS.push({ m, t: 1e9, x: cx, z: cz, share: true });
    } else { peds.push(...m); CHATS.push({ m, t: rd() * 3, x: cx, z: cz }); }
  }
  peds.push(...PORT_PEDS, ...VENUE_PEDS, ...carScenePeds());
  // Gäste auf den Café-Terrassen: sitzen sich gegenüber, reden, trinken
  for (const tr of TERRACE) {
    if (R() > (MOBILE ? 0.3 : 0.6)) continue;
    const both = R() < 0.65, m = [];
    for (const sg of both ? [-1, 1] : [R() < 0.5 ? -1 : 1]) {
      const lx = sg * 0.66, x = tr.x + lx * Math.cos(tr.a), z = tr.z - lx * Math.sin(tr.a);
      m.push({ st: 4, x, y: 0.22 + 0.5, z, yaw: tr.a - sg * Math.PI / 2, sc: 0.92 + R() * 0.14, v: 0, sit: true, act: 7.8, eat: R() < 0.3 });
    }
    peds.push(...m); if (m.length > 1) CHATS.push({ m, t: R() * 3, sit: true, x: tr.x, z: tr.z });
  }
  // Zeitungsjungen an Straßenecken halten die Abendausgabe hoch
  for (const b of blocks) { if (b.d > 520 || R() > 0.08) continue; peds.push({ st: 4, x: b.x0 + 1.2, y: 0.22, z: b.z0 + 1.2, yaw: -Math.PI * 0.75, sc: 0.64, v: 0, kind: 'kid', act: 6.5 }); }
  {
    const rw = mulberry32(1918), F = MOBILE ? 0.5 : 1;
    const at = (d, o, side, yaw, extra) => { const tx = d.nz * side, tz = -d.nx * side; return { st: 4, x: d.x + d.nx * o.n + tx * o.t, y: 0.22, z: d.z + d.nz * o.n + tz * o.t, yaw, sc: 0.93 + rw() * 0.12, v: 0, ...extra }; };
    for (const d of DOORS) {
      const r = rw(), side = rw() < 0.5 ? -1 : 1, out = Math.atan2(d.nx, d.nz), inn = Math.atan2(-d.nx, -d.nz), along = Math.atan2(d.nz * side, -d.nx * side);
      if (d.kind === 'hotel' && r < 0.85 * F) {
        // Portiers in Livree zu beiden Seiten der Tür
        peds.push(at(d, { n: 0.9, t: 1.35 }, 1, out, { kind: 'livery', act: 36 + rw() * 0.9 }));
        if (rw() < 0.6) peds.push(at(d, { n: 0.9, t: 1.35 }, -1, out, { kind: 'livery', act: 36 + rw() * 0.9 }));
      } else if ((d.kind === 'shop' || d.kind === 'cafe') && r < 0.14 * F) peds.push(at(d, { n: 0.55, t: 1.9 }, side, inn, { kind: 'worker', col: pick(SHIRTS), act: 29 + rw() * 0.9 }));
      else if (d.kind === 'shop' && r < 0.19 * F) peds.push(at(d, { n: 0.6, t: 2.4 }, side, inn, { kind: 'worker', col: pick(WORKWEAR), act: 30 + rw() * 0.9 }));
      else if ((d.kind === 'cafe' || d.kind === 'restaurant') && r < 0.3 * F) peds.push(at(d, { n: 2.4, t: 3.2 }, side, out + (rw() - 0.5) * 0.8, { kind: rw() < 0.6 ? 'dress' : 'lady', act: 37 + rw() * 0.9 }));
      else if (d.kind === 'workshop' && r < 0.4 * F) peds.push(at(d, { n: 0.45, t: 1.3 }, side, out + side * 0.3, { kind: 'worker', col: pick(SHIRTS), act: 38 + rw() * 0.9 }));
      else if ((d.kind === 'bar' || d.kind === 'pub') && r < 0.2 * F) peds.push(at(d, { n: 0.45, t: 1.5 }, side, out - side * 0.25, { kind: rw() < 0.5 ? 'coat' : 'suit', act: 38 + rw() * 0.9 }));
      else if (d.kind === 'shop' && r < 0.25 * F) peds.push(at(d, { n: 1.3, t: 1.6 }, side, inn + 0.4, { kind: 'suit', act: 28 + rw() * 0.9 }));
      else if (r > 1 - 0.07 * F) peds.push(at(d, { n: 1.2, t: 2.6 }, side, along, { kind: 'worker', col: pick(WORKWEAR), act: 24 + rw() * 0.9 }));
      else if (r > 1 - 0.1 * F) peds.push(at(d, { n: 1.5, t: 3.0 }, side, out, { kind: rw() < 0.5 ? 'suit' : 'coat', act: 31 + rw() * 0.4 }));
    }
    // Verkehrspolizisten an den Ecken großer Kreuzungen, Blick auf die Kreuzung
    for (const b of blocks) {
      if (b.d > 420 || rw() > 0.06 * F) continue;
      const cx = rw() < 0.5 ? b.x0 : b.x1, cz = rw() < 0.5 ? b.z0 : b.z1, sx = cx === b.x0 ? 1 : -1, sz = cz === b.z0 ? 1 : -1;
      peds.push({ st: 4, x: cx + sx * 0.9, y: 0.22, z: cz + sz * 0.9, yaw: Math.atan2(-sx, -sz), sc: 1, v: 0, kind: 'police', act: 35 + rw() * 0.9 });
    }
  }
  for (let k = 0; k < TRUCK_N; k++) { const m = { st: 5, sc: 1, v: 1.3, col: WORKWEAR[2], kind: 'worker' }; deliveryMen.push(m); peds.push(m); }
  for (const w of FACTORY_IDLERS) { const r = R(); peds.push({ st: 4, x: w.x, y: 0.22, z: w.z, yaw: w.yaw, sc: 1, v: 0, col: pick(SHIRTS), kind: 'worker', act: r < 0.2 ? 15.4 : r < 0.4 ? 25.3 : r < 0.6 ? 26.3 : r < 0.85 ? 27.3 : 38.3 }); }
  for (const pd of peds) if (pd.lp && pd.lp.worker) { pd.col = pick(SHIRTS); pd.kind = 'worker'; pd.cool = 1e9; }
  pedCrowd = new Crowd(['coat', 'suit', 'worker', 'lady', 'dress', 'police', 'kid', 'tux', 'gown', 'livery', 'waiter', 'sailor', 'chauffeur'], peds.length);
  pedCrowd.far = 420;
  peds.forEach(pd => { const r0 = R(), r1 = Math.random(), kd = r1 < 0.03 ? 'police' : r1 < 0.06 ? 'kid' : r0 < 0.28 ? 'coat' : r0 < 0.52 ? 'suit' : r0 < 0.78 ? 'lady' : 'dress', k = pd.kind || kd, cl = k === 'dress' ? pick(DRESSES) : k === 'police' ? [0.06, 0.07, 0.16] : k === 'kid' ? pick(SHIRTS) : k === 'gown' ? pick(GOWNS) : k === 'tux' ? COL.tux : pick(COATS); if (k === 'kid') pd.sc = 0.6 + Math.random() * 0.08; pd.a = pedCrowd.add(k, pd.col || cl); const fem = k === 'lady' || k === 'dress' || k === 'gown'; pd.fem = fem; pd.a.gait[1] = Math.abs(pd.v) * (fem ? 5.4 : 4.6) / pd.sc; pd.a.gait[2] = pd.st === 4 || pd.st === 8 ? 0 : (fem ? 0.34 : 0.38) + Math.random() * 0.1; if (pd.st === 4 || pd.st === 8) pd.a.gait[1] = pd.act != null ? pd.act : Math.random() < 0.6 ? 0.6 + Math.random() * 0.35 : 0; if (pd.sit) pd.yo = (fem ? 0.8 : 0.87) * pd.sc; });
  for (const c of CHATS) if (c.share && c.m[0].a && c.m[1].a) c.m[1].a.gait[0] = c.m[0].a.gait[0];
  pedCrowd.finish();
  buildDrivers();
}
// Eingänge, die an einem Gehweg-Rundweg liegen: Position auf dem Weg (t) und Tür
export function loopDoors(lp) {
  const out = [];
  for (const d of DOORS) {
    let acc = 0, best = null;
    for (const sg of lp.segs) {
      const ex = (sg.b[0] - sg.a[0]) / sg.L, ez = (sg.b[1] - sg.a[1]) / sg.L;
      const k = Math.max(0, Math.min(sg.L, (d.x - sg.a[0]) * ex + (d.z - sg.a[1]) * ez));
      const px = sg.a[0] + ex * k, pz = sg.a[1] + ez * k, dd = Math.hypot(px - d.x, pz - d.z);
      if (dd < 14 && (!best || dd < best.dd) && (px - d.x) * d.nx + (pz - d.z) * d.nz > 0.5) best = { t: acc + k, x: px, z: pz, dd, d };
      acc += sg.L;
    }
    if (best) out.push(best);
  }
  return out;
}
// Wie lange Leute drinnen bleiben, je nach Lokal (Sekunden)
export const STAY = { hotel: [20, 60], shop: [8, 25], restaurant: [30, 80], cafe: [15, 45], bar: [25, 70], pub: [25, 70], workshop: [20, 50] };
// Handlung einer Figur ändern (der Shader liest sie aus der Gangart)
// Position auf der Runde mit gerundeten Ecken (Bogen von 1,2 m): Ort und Blickrichtung
export function loopRound(lp, t, sgn) {
  const S = lp.segs; let u = t, i = 0;
  for (; i < S.length - 1; i++) { if (u <= S[i].L) break; u -= S[i].L; }
  const sg = S[i], R = Math.min(1.2, sg.L * 0.45), dx = (sg.b[0] - sg.a[0]) / sg.L, dz = (sg.b[1] - sg.a[1]) / sg.L;
  let C = null, d0, d1, s;
  if (sg.L - u < R) { const n = S[(i + 1) % S.length]; C = sg.b; d0 = [dx, dz]; d1 = [(n.b[0] - n.a[0]) / n.L, (n.b[1] - n.a[1]) / n.L]; s = (R - (sg.L - u)) / (2 * R); }
  else if (u < R) { const p = S[(i + S.length - 1) % S.length]; C = sg.a; d0 = [(p.b[0] - p.a[0]) / p.L, (p.b[1] - p.a[1]) / p.L]; d1 = [dx, dz]; s = 0.5 + u / (2 * R); }
  if (!C || Math.abs(d0[0] * d1[1] - d0[1] * d1[0]) < 0.05) return [sg.a[0] + dx * u, sg.a[1] + dz * u, dx * sgn, dz * sgn];
  const P0 = [C[0] - d0[0] * R, C[1] - d0[1] * R], P2 = [C[0] + d1[0] * R, C[1] + d1[1] * R], m = 1 - s;
  const x = m * m * P0[0] + 2 * m * s * C[0] + s * s * P2[0], z = m * m * P0[1] + 2 * m * s * C[1] + s * s * P2[1];
  let tx = m * (C[0] - P0[0]) + s * (P2[0] - C[0]), tz = m * (C[1] - P0[1]) + s * (P2[1] - C[1]); const L = Math.hypot(tx, tz) || 1;
  return [x, z, tx / L * sgn, tz / L * sgn];
}
export function setAct(pd, v) { const g = pd.a.gait; if (g[1] !== v || g[2] !== 0) { g[1] = v; g[2] = 0; pd.a.gv = (pd.a.gv | 0) + 1; } }
export function loopPos(lp, t) {
  let u = t, sg = lp.segs[0];
  for (const sgm of lp.segs) { if (u <= sgm.L) { sg = sgm; break; } u -= sgm.L; }
  const k = u / sg.L; return [sg.a[0] + (sg.b[0] - sg.a[0]) * k, sg.a[1] + (sg.b[1] - sg.a[1]) * k];
}
export function startMeet(A, B, d) {
  const lp = A.lp, sgn = Math.sign(A.v), mid = A.t + d / 2, wrap = t => ((t % lp.total) + lp.total) % lp.total;
  A.t = wrap(mid - 0.46 * sgn); B.t = wrap(mid + 0.46 * sgn);
  const [ax, az] = loopPos(lp, A.t), [bx, bz] = loopPos(lp, B.t);
  for (const [P, Q, x, z, ox, oz] of [[A, B, ax, az, bx, bz], [B, A, bx, bz, ax, az]]) { P.st = 7; P.mp = Q; P.mx = x; P.mz = z; P.myaw = Math.atan2(ox - x, oz - z); P.gw = [P.a.gait[1], P.a.gait[2]]; }
  A.lead = true; B.lead = false; A.mt = 0; A.md = 9 + Math.random() * 16; A.seed = Math.random();
}
export function endMeet(P) { P.st = 0; P.lead = false; P.a.gait[1] = P.gw[0]; P.a.gait[2] = P.gw[1]; P.a.gv = (P.a.gv | 0) + 1; P.mcool = 45 + Math.random() * 60; }
export let meetTimer = 0;
export const CHATS = [];
export function pedSocial(dt) {
  // Gesprächsrunden: einer erzählt, die anderen nicken, manchmal lachen alle oder jemand nimmt einen Schluck
  const cp = camera.position;
  for (const c of CHATS) {
    if (c.share || (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 140 * 140 || (c.t -= dt) > 0) continue;
    const n = c.m.length, spk = Math.floor(Math.random() * n), laugh = Math.random() < 0.16, base = c.sit ? 7 : 0;
    c.m.forEach((pd, i) => { if (!pd.a) return; let v;
      if (laugh) v = c.sit ? 7.3 : 2.6 + i * 0.05;
      else if (i === spk) v = base + 0.9;
      else { const r = Math.random(); v = c.sit ? (r < 0.3 ? 11.4 : 7.2) : (r < 0.5 ? 1.6 : r < 0.65 ? 5.6 : r < 0.8 ? 15.5 : r < 0.88 ? 16.5 : 0.3); }
      if (pd.eat && !laugh) v = c.sit ? 19.4 : 17.4;
      setAct(pd, v);
      const sp = c.m[spk].a; if (i !== spk && sp && pd.a.on && !laugh) { const f = sp.m.elements; turnHead(pd.a, f[12], f[14]); } });
    c.t = laugh ? 2.2 : 2.5 + Math.random() * 3;
  }
  // Begegnungen auf dem Gehweg: wer sich entgegenkommt, bleibt manchmal stehen
  if ((meetTimer -= dt) > 0) return; meetTimer = 0.3;
  const byLoop = new Map();
  for (const pd of peds) {
    if (pd.st !== 0 || pd.lat || !pd.lp || pd.lp.worker || !pd.a || !pd.a.on) continue;
    if ((pd.mcool = (pd.mcool ?? 10) - 0.3) > 0) continue;
    const e = pd.a.m.elements; if ((e[12] - cp.x) ** 2 + (e[14] - cp.z) ** 2 > 160 * 160) continue;
    let a = byLoop.get(pd.lp); if (!a) byLoop.set(pd.lp, a = []); a.push(pd);
  }
  for (const [lp, list] of byLoop) for (let i = 0; i < list.length; i++) {
    const A = list[i]; if (A.st !== 0) continue;
    for (let j = i + 1; j < list.length; j++) {
      const B = list[j]; if (B.st !== 0 || Math.sign(A.v) === Math.sign(B.v)) continue;
      let d = B.t - A.t; d -= Math.round(d / lp.total) * lp.total;
      if (Math.abs(d) > 1.9 || Math.sign(d) !== Math.sign(A.v)) continue;
      if (Math.random() < 0.45) { A.mcool = 25 + Math.random() * 30; B.mcool = 25 + Math.random() * 30; break; }
      startMeet(A, B, d); break;
    }
  }
}
