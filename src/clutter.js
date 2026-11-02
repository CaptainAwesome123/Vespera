/* =====================================================================
   V53 · DIE STADT VOLLER: lose Dinge überall, alle mit Telekinese greifbar
   planClutter() verteilt beim Aufbau Tausende Dinge der 20er Jahre über
   Gehwege, Ladeneingänge, Hauseingänge, Café-Terrassen, Kai und Dächer:
   Fahrräder, Kinderwagen, Zeitungsständer, Blumenkarren, Maronistände,
   Telefonzellen, Schuhputzstühle, Schneeschaufeln, Schlitten, im
   Arbeiterviertel Kohlenkarren, Schubkarren, Leitern, Säcke, Kisten; am Kai
   Tauwerk, Rettungsringe, Kisten und Fässer; auf flachen Dächern kleine
   Dachgärten mit Liegestühlen und Blumentöpfen.
   Gezeichnet werden sie als Instanzen der Chunk-Schicht 'clutter' (je Zelle
   und Art ein InstancedMesh, kein eigener Shader). Erst wenn Alexander eines
   greift (Telekinese oder E), wird es in physics.js zu einem Körper
   (clutterBody); die Instanz schrumpft dann auf 0. Weit weg und unbewegt
   kehrt es an seinen Platz zurück; bewegt bleibt es, wo es liegt.
   Zum Suchen: ein 8-m-Raster (CLUT.grid) mit Dingen und Laternen.
   ?nokram schaltet alles ab.
   ===================================================================== */
import { T, MOBILE, mulberry32 } from './core.js';
import { registerLayer } from './chunks.js';
import { addCollider } from './people-skeleton.js';
import { curbs, roofs, lamps } from './facade-shader.js';
import { DOORS, TERRACE } from './entrances.js';
import { SHOPS } from './shops.js';
import { STREET } from './serpentine.js';
import { blocks, PLAZA, MEDIAN, QUAY, QX } from './island.js';
import { QUAY_GAPS } from './harbour.js';
import { GEOS, KINDS_OF, propMaterial } from './physics.js';

export const CLUT = { items: [], grid: new Map(), cell: 8, on: true, stats: { items: 0, kinds: 0 } };
export const CLUT_CELL = 200;
const _cm = new T.Matrix4(), _cq = new T.Quaternion(), _cp = new T.Vector3(), _cs = new T.Vector3(1, 1, 1), _cup = new T.Vector3(0, 1, 0);

/* ---------- Raster zum Suchen (Dinge und Laternen) ---------- */
function gridKey(x, z) { return Math.floor(x / CLUT.cell) + ',' + Math.floor(z / CLUT.cell); }
export function clutGridAdd(e) { const k = gridKey(e.p.x, e.p.z); let a = CLUT.grid.get(k); if (!a) CLUT.grid.set(k, a = []); a.push(e); e.gk = k; }
export function clutGridMove(e) { const k = gridKey(e.p.x, e.p.z); if (k === e.gk) return; const a = CLUT.grid.get(e.gk); if (a) { const i = a.indexOf(e); if (i >= 0) a.splice(i, 1); } clutGridAdd(e); }
// [p, k] in der Nähe: k = 'c:<art>' für Dinge, 'lamp' für Laternen
export function clutterNear(x, z, r) {
  const out = [], c = CLUT.cell;
  for (let ix = Math.floor((x - r) / c); ix <= Math.floor((x + r) / c); ix++) for (let iz = Math.floor((z - r) / c); iz <= Math.floor((z + r) / c); iz++) {
    const a = CLUT.grid.get(ix + ',' + iz); if (!a) continue;
    for (const e of a) if (!e.p.taken && (e.p.x - x) ** 2 + (e.p.z - z) ** 2 < r * r) out.push([e.p, e.k]);
  }
  return out;
}

/* ---------- Planen ---------- */
export function planClutter() {
  if (new URLSearchParams(location.search).has('nokram')) { CLUT.on = false; return; }
  const K = KINDS_OF(), rr = mulberry32(5353), dens = MOBILE ? 0.45 : 1;
  // belegte Plätze: Laternen, Stadtmobiliar, Eingänge, Terrassen (1,5-m-Felder)
  const occ = new Set(), ok = (x, z, r) => { for (let ix = Math.floor((x - r) / 1.5); ix <= Math.floor((x + r) / 1.5); ix++) for (let iz = Math.floor((z - r) / 1.5); iz <= Math.floor((z + r) / 1.5); iz++) if (occ.has(ix + ',' + iz)) return false; return true; };
  const take = (x, z, r) => { for (let ix = Math.floor((x - r) / 1.5); ix <= Math.floor((x + r) / 1.5); ix++) for (let iz = Math.floor((z - r) / 1.5); iz <= Math.floor((z + r) / 1.5); iz++) occ.add(ix + ',' + iz); };
  for (const l of lamps) take(l.x, l.z, 0.5);
  const F = STREET.furniture; if (F) for (const k in F.out) for (const p of F.out[k]) take(p.x, p.z, k === 'kiosk' || k === 'column' ? 1.6 : k === 'bench' || k === 'planter' ? 1.0 : 0.4);
  for (const d of DOORS) take(d.x + d.nx * 1.2, d.z + d.nz * 1.2, 1.3);
  // Ding hinstellen: Boden y0 (Unterkante), Gierwinkel, Farbe (für PAINT-Teile), tilt = Neigung um die eigene x-Achse (Anlehnen)
  const put = (k, x, z, yaw, y0 = 0.22, c = null, tilt = 0, force = false) => {
    const I = K[k]; if (!I) return null;
    const r = Math.max(I.he[0], I.he[2]) * 0.8;
    if (!force && !ok(x, z, r)) return null;
    take(x, z, r);
    const p = { k, x, y: y0 + I.he[1] * Math.cos(tilt) + (tilt ? Math.abs(Math.sin(tilt)) * I.he[2] : 0), z, yaw, tilt, c, taken: false };
    CLUT.items.push(p); p._e = { p, k: 'c:' + k }; clutGridAdd(p._e);
    if (I.solid) { const h = Math.max(I.he[0], I.he[2]); p.col = [x - h, z - h, x + h, z + h]; addCollider(x - h, y0, z - h, x + h, y0 + I.he[1] * 2, z + h); }
    return p;
  };
  const PAINTS = { bicycle: [[0.05, 0.05, 0.06], [0.08, 0.22, 0.2], [0.35, 0.06, 0.06], [0.1, 0.12, 0.25], [0.55, 0.42, 0.18]], pram: [[0.06, 0.06, 0.07], [0.12, 0.2, 0.3], [0.85, 0.82, 0.74], [0.3, 0.12, 0.14]],
    newsstand: [[0.1, 0.25, 0.22], [0.35, 0.08, 0.08], [0.1, 0.1, 0.2]], flowercart: [[0.1, 0.3, 0.2], [0.55, 0.15, 0.12], [0.75, 0.68, 0.5]], chestnut: [[0.35, 0.08, 0.06], [0.1, 0.2, 0.18]],
    phonebooth: [[0.08, 0.22, 0.2], [0.35, 0.05, 0.05], [0.14, 0.1, 0.06]], deckchair: [[0.1, 0.35, 0.36], [0.6, 0.12, 0.1], [0.12, 0.18, 0.4]] };
  const col = k => PAINTS[k] ? PAINTS[k][Math.floor(rr() * PAINTS[k].length)] : null;
  const pick = W => { let t = 0; for (const w of W) t += w[1]; let u = rr() * t; for (const w of W) if ((u -= w[1]) <= 0) return w[0]; return W[0][0]; };

  // ---- Gehwege: an der Hauswand und am Bordstein ----
  const blockAt = (x, z) => blocks.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const ELITE = [['bike', 2.2], ['pram', 1], ['news', 1.2], ['pots', 1.4], ['chestnut', 0.5], ['phone', 0.55], ['shoeshine', 0.35], ['shovel', 0.9], ['sled', 0.6], ['crates', 0.7], ['mail', 0.5], ['bin', 0.6], ['sign', 0.5]];
  const WORKER = [['handcart', 1], ['barrow', 1], ['ladder', 0.8], ['tools', 1], ['sacks', 1.2], ['fruit', 0.8], ['bike', 1.2], ['pram', 0.6], ['shovel', 1], ['sled', 0.7], ['barrel', 0.8], ['milk', 0.6], ['coal', 0.8], ['bin', 1]];
  for (const c of curbs) {
    const b = blockAt(c.cx, c.cz); if (!b) continue;
    const dist = Math.hypot(c.cx, c.cz); if (dist > 1100) continue;
    const worker = (b.tier || 'fabric') === 'fabric' && b.d > 650 && c.cz <= 420;
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az); if (L < 10) continue;
    const dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L;
    let nx = -dz, nz = dx; if ((c.cx - c.ax) * nx + (c.cz - c.az) * nz < 0) { nx = -nx; nz = -nz; }
    const out = Math.atan2(-nx, -nz);           // +z der Form zeigt zur Straße, x läuft an der Wand entlang
    const W = worker ? WORKER : ELITE;
    for (let t = 5 + rr() * 6; t < L - 5; t += (b.park ? 30 : 9) + rr() * 14 / dens) {
      if (rr() > dens) continue;
      const ax = c.ax + dx * t, az = c.az + dz * t;
      if (ax > PLAZA.x0 - 2 && ax < PLAZA.x1 + 2 && az > PLAZA.z0 - 2 && az < PLAZA.z1 + 2) continue;
      if (ax > MEDIAN.x0 - 2 && ax < MEDIAN.x1 + 2 && az > MEDIAN.z0 - 2 && az < MEDIAN.z1 + 2) continue;
      // an der Wand: Abstand vom Bordstein = 3,5 m minus halbe Tiefe
      const wall = (k, u = 0, extra = 0, tilt = 0) => { const I = K[k]; const ins = 3.42 - I.he[2] * Math.cos(tilt) - Math.sin(tilt) * I.he[1] - extra; return put(k, ax + dx * u + nx * ins, az + dz * u + nz * ins, out + (tilt ? 0 : (rr() - 0.5) * 0.12), 0.22, col(k), -tilt); };   // angelehnt: oben zur Wand
      const kerb = (k, u = 0, ins = 1.2) => put(k, ax + dx * u + nx * ins, az + dz * u + nz * ins, out + Math.PI / 2 * (rr() < 0.5 ? 1 : -1) + (rr() - 0.5) * 0.3, 0.22, col(k));
      const v = b.park ? pick([['pram', 1], ['sled', 1], ['bike', 1]]) : pick(W);
      if (v === 'bike') { wall('bicycle', 0, 0, 0.12); if (rr() < 0.35) wall('bicycle', 1.9, 0, 0.12); }
      else if (v === 'pram') wall('pram');
      else if (v === 'news') { wall('newsstand'); if (rr() < 0.5) wall('papers', 0.9); }
      else if (v === 'pots') { wall('flowerpot', -0.5); wall('flowerpot', 0.5); if (rr() < 0.5) wall('flowerpot', 1.4); }
      else if (v === 'chestnut') kerb('chestnut', 0, 1.6);
      else if (v === 'phone') kerb('phonebooth', 0, 1.7);
      else if (v === 'shoeshine') wall('shoeshine');
      else if (v === 'shovel') { wall('shovel', 0, 0, 0.18); if (rr() < 0.5) wall('bucket', 0.6); }
      else if (v === 'sled') wall('sled', 0, 0);
      else if (v === 'crates') { wall('crate', 0); wall('winecrate', 0.75); if (rr() < 0.5) wall('crate', -0.75); }
      else if (v === 'mail') { wall('mailsack', 0); wall('mailsack', 0.55); }
      else if (v === 'bin') wall('dustbin');
      else if (v === 'sign') kerb('signboard', 0, 2.2);
      else if (v === 'handcart') wall('handcart');
      else if (v === 'barrow') { wall('wheelbarrow'); if (rr() < 0.5) wall('sack', 1.2); }
      else if (v === 'ladder') { wall('ladder', 0, 0, 0); wall('bucket', 0.9); }
      else if (v === 'tools') { wall('toolbox', 0); wall('bucket', 0.6); }
      else if (v === 'sacks') { wall('sack', 0); wall('sack', 0.5); if (rr() < 0.5) wall('sack', 1.0); }
      else if (v === 'fruit') { wall('fruitcrate', 0); wall('fruitcrate', 0.6); }
      else if (v === 'barrel') { wall('barrel', 0); if (rr() < 0.5) wall('barrel', 0.75); }
      else if (v === 'milk') { wall('milkcan', 0); wall('milkcan', 0.45); }
      else if (v === 'coal') { wall('coalsack', 0); wall('coalsack', 0.55); }
    }
  }

  // ---- Läden: was zur Ware passt, vor die Tür ----
  for (const S of SHOPS) {
    const d = S.door; if (!d) continue;
    const tx = -d.nz, tz = d.nx, at = (k, u, ins, yaw = 0) => put(k, d.x + tx * u + d.nx * ins, d.z + tz * u + d.nz * ins, Math.atan2(d.nx, d.nz) + yaw, 0.22, col(k), 0, true);
    const s = rr() < 0.5 ? 1 : -1;
    if (S.kind === 'blumen') { at('flowercart', s * 2.6, 0.9); at('flowerpot', -s * 1.7, 0.4); at('flowerpot', -s * 2.2, 0.4); at('flowerpot', s * 1.6, 0.4); }
    else if (S.kind === 'deli') { at('fruitcrate', s * 1.8, 0.4); at('fruitcrate', s * 2.4, 0.4); at('winecrate', -s * 1.9, 0.4); }
    else if (S.kind === 'tabak' || S.kind === 'buch') at('newsstand', s * 2.0, 0.35);
    else if (S.kind === 'spiel') { at('sled', s * 2.0, 0.5, Math.PI / 2); at('pram', -s * 2.1, 0.6); }
    else if (S.kind === 'friseur') at('shoeshine', s * 2.2, 0.6);
    else if (S.kind === 'cafe') at('signboard', s * 1.8, 0.8);
    else if (S.kind === 'hut' || S.kind === 'mode') at('hatbox', s * 1.7, 0.4);
  }
  // ---- Hotels und Hauseingänge ----
  for (const d of DOORS) {
    if (rr() > 0.55 * dens || Math.hypot(d.x, d.z) > 1000) continue;
    const tx = -d.nz, tz = d.nx, at = (k, u, ins) => put(k, d.x + tx * u + d.nx * ins, d.z + tz * u + d.nz * ins, Math.atan2(d.nx, d.nz) + (rr() - 0.5) * 0.3, 0.22, col(k));
    if (d.kind === 'hotel') { at('luggagecart', 3.2, 1.0); at('umbrellastand', -1.9, 0.3); }
    else if (d.kind === 'house' || d.kind === 'shop') { if (Math.hypot(d.x, d.z) < 650) { at('flowerpot', 1.5, 0.35); at('flowerpot', -1.5, 0.35); } else { at(rr() < 0.5 ? 'bucket' : 'shovel', 1.6, 0.3); } }
  }
  // ---- Café-Terrassen: Tisch und zwei Bugholzstühle, alle beweglich (vorher fest) ----
  for (const t of TERRACE) {
    const cs = Math.cos(t.a), sn = Math.sin(t.a);
    put('bistroTable', t.x, t.z, t.a, 0.22, null, 0, true);
    for (const sg of [-1, 1]) put('chair', t.x + sg * 0.72 * cs, t.z - sg * 0.72 * sn, t.a + (sg > 0 ? -Math.PI / 2 : Math.PI / 2), 0.22, null, 0, true);
    if (rr() < 0.4) put('icebucket', t.x + 0.12, t.z + 0.08, 0, 0.22 + 0.74, null, 0, true);
  }
  // ---- Kai: Tauwerk, Rettungsringe, Kisten, Fässer, Säcke ----
  if (QUAY && QX) {
    const zE = QUAY.z1 - 1.6, zB = QUAY.z0 + 3;
    for (let x = QX[0] + 6; x < QX[1] - 6; x += 9 + rr() * 16) {
      if (QUAY_GAPS.some(([a, b]) => x > a - 4 && x < b + 4) || rr() > dens) continue;
      const v = pick([['rope', 1.4], ['buoy', 1], ['crates', 1.2], ['barrels', 1], ['sacks', 0.8], ['cart', 0.4], ['mail', 0.4]]);
      if (v === 'rope') { put('ropecoil', x, zE, rr() * 6, 0.25); if (rr() < 0.4) put('ropecoil', x + 0.8, zE - 0.3, rr() * 6, 0.25); }
      else if (v === 'buoy') put('lifebuoy', x, zE + 0.2, rr() * 6, 0.25);
      else if (v === 'crates') { put('crate', x, zB, 0.1, 0.25); put('crate', x + 0.65, zB, 0.05, 0.25); put('crate', x + 0.3, zB, 0.2, 0.25 + 0.48, null, 0, true); }
      else if (v === 'barrels') { put('barrel', x, zB, 0, 0.25); put('barrel', x + 0.7, zB + 0.1, 0, 0.25); }
      else if (v === 'sacks') { put('sack', x, zB, 0.3, 0.25); put('sack', x + 0.5, zB + 0.1, 1.2, 0.25); put('fruitcrate', x + 1.1, zB, 0, 0.25); }
      else if (v === 'cart') put('handcart', x, zB + 0.5, Math.PI / 2, 0.25);
      else { put('mailsack', x, zB, 0, 0.25); put('trunk', x + 0.9, zB, 0.2, 0.25); }
    }
  }
  // ---- Dachgärten auf flachen, niedrigen Dächern ----
  for (const r of roofs) {
    if (r.H > 48 || r.H < 8 || r.crown || r.dist > 800 || rr() > (r.worker ? 0.08 : 0.2) * dens) continue;
    const y = r.H, x0 = r.x, z0 = r.z, a = rr() * 0.4 - 0.2;
    if (r.worker) { put('chair', x0 + 1, z0, a, y); put('bucket', x0 + 1.8, z0 + 0.6, 0, y); put('sled', x0 - 1.5, z0 - 1, a, y); continue; }
    put('bistroTable', x0, z0, a, y); put('chair', x0 + 0.75, z0, a - Math.PI / 2, y); put('chair', x0 - 0.75, z0, a + Math.PI / 2, y);
    put('deckchair', x0 + 2.4, z0 + 1.8, a + 0.3, y, col('deckchair')); put('deckchair', x0 - 2.4, z0 + 1.8, a - 0.3, y, col('deckchair'));
    for (let k = 0; k < 4; k++) put('flowerpot', x0 + (k - 1.5) * 1.1, z0 - 2.4, 0, y);
  }
  CLUT.stats.items = CLUT.items.length; CLUT.stats.kinds = new Set(CLUT.items.map(p => p.k)).size;
}
// Laternen ins Suchraster (werden in flushInstances geplant, deshalb erst hier)
export function indexLamps() { for (const l of STREET.lamps) clutGridAdd({ p: l, k: 'lamp' }); }

/* ---------- Zeichnen: Chunk-Schicht ---------- */
const _ce = new T.Euler();
export function clutterMatrix(p, m) {
  if (p.q) _cq.copy(p.q); else { _ce.set(p.tilt || 0, p.yaw, 0, 'YXZ'); _cq.setFromEuler(_ce); }
  return m.compose(_cp.set(p.x, p.y, p.z), _cq, _cs);
}
export function setupClutterLayer() {
  if (!CLUT.on || !CLUT.items.length) return;
  const byCell = new Map();
  for (const p of CLUT.items) { const k = Math.floor(p.x / CLUT_CELL) + ',' + Math.floor(p.z / CLUT_CELL); (byCell.get(k) || byCell.set(k, []).get(k)).push(p); }
  CLUT.byCell = byCell;
  const geoOf = new Map(), cc = new T.Color();
  registerLayer({
    name: 'clutter', size: CLUT_CELL, radius: cam => Math.min(MOBILE ? 200 : 320, (MOBILE ? 120 : 170) + Math.max(0, cam.position.y) * 0.35),
    build(cx, cz) {
      const here = byCell.get(cx + ',' + cz); if (!here) return null;
      const by = new Map();
      for (const p of here) if (!p.taken && Math.floor(p.x / CLUT_CELL) === cx && Math.floor(p.z / CLUT_CELL) === cz) (by.get(p.k) || by.set(p.k, []).get(p.k)).push(p);
      if (!by.size) return null;
      const g = new T.Group();
      for (const [k, list] of by) {
        let geo = geoOf.get(k); if (!geo) { const f = GEOS[k]; if (!f) continue; geo = f(); geoOf.set(k, geo); }
        const im = new T.InstancedMesh(geo, propMaterial(), list.length);
        list.forEach((p, i) => { im.setMatrixAt(i, clutterMatrix(p, _cm)); im.setColorAt(i, p.c ? cc.setRGB(p.c[0], p.c[1], p.c[2]) : cc.setRGB(1, 1, 1)); p._im = im; p._i = i; });
        im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.userData.items = list;
        g.add(im);
      }
      return g.children.length ? g : null;
    },
    dispose(obj) { for (const im of obj.children) for (const p of im.userData.items || []) if (p._im === im) p._im = null; },
  });
}
// Ding wandert in eine andere Zelle (bewegt abgelegt): Zellliste und Raster nachführen
export function clutterMoved(p) {
  if (p._e) clutGridMove(p._e);
  for (const [k, a] of CLUT.byCell || []) { const i = a.indexOf(p); if (i >= 0) { a.splice(i, 1); break; } }
  const k = Math.floor(p.x / CLUT_CELL) + ',' + Math.floor(p.z / CLUT_CELL); if (CLUT.byCell) (CLUT.byCell.get(k) || CLUT.byCell.set(k, []).get(k)).push(p);
}
