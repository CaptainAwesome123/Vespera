/* =====================================================================
   V55 · DIE STADT LEBT: Leute mit Aufgaben auf Straßen und Plätzen
   - Kellner laufen zwischen der Tür ihres Cafés oder Restaurants und den
     Tischen auf der Terrasse hin und her, nehmen Bestellungen auf (Block in
     der Hand), reden mit den Gästen und verschwinden wieder im Lokal.
   - Zeitungsjungen ziehen durch die Straßen, bleiben stehen, halten die
     Abendausgabe hoch und rufen die Schlagzeilen aus ("Extrablatt!");
     die festen Zeitungsjungen an den Ecken wechseln ebenso ab.
   - Polizisten gehen zu zweit Streife (die Verkehrspolizisten bleiben).
   - Straßenmusik: Leierkastenmänner an Hauswänden (drehen die Kurbel) und
     Straßenpianisten an offenen Plätzen, mit Sängerin und Zuhörern, die nach
     jedem Lied klatschen. Musik dazu in music.js (Walzer und Ragtime).
   Alles nur aus vorhandenen Figuren und Handlungen (kein neuer Shader-Code);
   die Instrumente sind ein einziges Netz (ein Zeichenaufruf).
   ===================================================================== */
import { T, MOBILE, mulberry32, scene, mergeGeos, shared, camera, $ } from './core.js';
import { blocks, PLAZA, inRect } from './island.js';
import { DOORS } from './entrances.js';
import { curbs, trees, lamps } from './facade-shader.js';
import { addCollider, nearBoxes, paintMat, mergeColored } from './people-skeleton.js';
import { setAct, turnHead, pedCrowd, SHIRTS, WORKWEAR, COATS, DRESSES, GOWNS } from './serpentine.js';
import { player } from './player.js';

export const LIFE = { spots: [], waiters: [], news: [], sayT: 0, mesh: null };
const near2 = (x, z, r) => (x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 < r * r;

/* ---------- Instrumente (lokal: +z zeigt zum Musiker) ---------- */
const BX = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);
const CY = (rt, rb, h, n, x, y, z) => new T.CylinderGeometry(rt, rb, h, n).translate(x, y, z);
const VAR = [0.13, 0.07, 0.04], IVORY = [0.93, 0.9, 0.82], EBONY = [0.03, 0.03, 0.03], BRASS = [0.75, 0.56, 0.26], CREAM = [0.9, 0.86, 0.74];
// Aufrechtes Klavier mit Kerzenleuchtern, Notenblatt und hohem Hocker (Maße wie das Kneipenklavier in venues.js)
export function pianoParts() {
  const P = [];
  P.push([BX(1.55, 1.3, 0.6, 0, 0.67, 0), VAR], [BX(1.62, 0.06, 0.66, 0, 1.35, 0), VAR], [BX(1.45, 0.08, 0.36, 0, 0.74, 0.45), VAR]);
  P.push([BX(1.3, 0.025, 0.16, 0, 0.795, 0.52), IVORY], [BX(1.36, 0.1, 0.03, 0, 0.84, 0.29), VAR]);
  for (let k = 0; k < 18; k++) P.push([BX(0.035, 0.025, 0.09, -0.6 + k * 0.071, 0.815, 0.49), EBONY]);
  for (const s of [-1, 1]) { P.push([BX(0.08, 0.66, 0.08, s * 0.66, 0.33, 0.5), VAR], [BX(0.1, 0.06, 0.2, s * 0.66, 0.03, 0.55), VAR]); }
  P.push([BX(0.5, 0.32, 0.02, 0, 1.05, 0.31), CREAM]);   // Notenblatt
  for (const s of [-1, 1]) { P.push([CY(0.015, 0.03, 0.16, 8, s * 0.6, 1.4, 0.2), BRASS], [CY(0.012, 0.012, 0.09, 6, s * 0.6, 1.52, 0.2), CREAM]); }
  P.push([BX(1.2, 0.4, 0.02, 0, 0.5, 0.305), [0.18, 0.1, 0.06]]);   // Füllung unten
  // Hocker: rund, gedrechselt, hoch (der Pianist sitzt wie in der Brass Lantern)
  P.push([CY(0.2, 0.2, 0.07, 14, 0, 0.75, 1.05), [0.25, 0.08, 0.06]], [CY(0.05, 0.07, 0.7, 8, 0, 0.36, 1.05), VAR], [CY(0.2, 0.22, 0.05, 12, 0, 0.03, 1.05), VAR]);
  // Hut für Münzen vor dem Klavier
  P.push([CY(0.15, 0.15, 0.015, 14, 0.95, 0.008, 0.9), [0.05, 0.05, 0.06]], [CY(0.09, 0.1, 0.1, 12, 0.95, 0.06, 0.9), [0.05, 0.05, 0.06]]);
  return P;
}
// Leierkasten auf einem Karren: bemalter Kasten mit Messingpfeifen vorn, Kurbel hinten (zum Spieler), zwei Räder
export function organParts() {
  const P = [], RED = [0.42, 0.06, 0.07], GRN = [0.05, 0.22, 0.18];
  P.push([BX(0.72, 0.52, 0.42, 0, 1.0, 0), RED], [BX(0.76, 0.05, 0.46, 0, 1.28, 0), [0.62, 0.45, 0.2]], [BX(0.76, 0.05, 0.46, 0, 0.73, 0), [0.62, 0.45, 0.2]]);
  P.push([BX(0.6, 0.36, 0.02, 0, 1.0, -0.215), GRN]);   // Bildfeld vorn
  for (let k = 0; k < 9; k++) P.push([CY(0.018, 0.018, 0.16 + 0.12 * Math.sin(k / 8 * Math.PI), 8, -0.24 + k * 0.06, 1.0, -0.235), BRASS]);
  P.push([BX(0.66, 0.03, 0.03, 0, 1.2, -0.23), BRASS], [BX(0.66, 0.03, 0.03, 0, 0.8, -0.23), BRASS]);
  // Kurbel: Nabe und Scheibe auf der Rückseite (Achse zum Spieler), Griff oben
  P.push([CY(0.03, 0.03, 0.06, 8, 0, 0, 0).rotateX(Math.PI / 2).translate(0.0, 1.15, 0.24), BRASS], [CY(0.15, 0.15, 0.015, 18, 0, 0, 0).rotateX(Math.PI / 2).translate(0.0, 1.15, 0.255), [0.2, 0.12, 0.06]]);
  P.push([BX(0.025, 0.15, 0.02, 0.0, 1.22, 0.27), BRASS], [CY(0.018, 0.018, 0.09, 6, 0, 0, 0).rotateX(Math.PI / 2).translate(0.0, 1.29, 0.31), [0.15, 0.09, 0.05]]);
  // Karren: Gestell, Räder, Deichsel, Stütze
  P.push([BX(0.8, 0.04, 0.5, 0, 0.7, 0), VAR]);
  for (const s of [-1, 1]) { P.push([CY(0.34, 0.34, 0.04, 20, 0, 0, 0).rotateZ(Math.PI / 2).translate(s * 0.44, 0.35, 0), [0.1, 0.06, 0.03]], [CY(0.05, 0.05, 0.06, 8, 0, 0, 0).rotateZ(Math.PI / 2).translate(s * 0.44, 0.35, 0), BRASS]); }
  P.push([CY(0.02, 0.02, 0.92, 6, 0, 0, 0).rotateZ(Math.PI / 2).translate(0, 0.35, 0), [0.1, 0.1, 0.1]]);
  P.push([BX(0.04, 0.68, 0.04, 0.3, 0.36, 0.2), VAR], [BX(0.04, 0.68, 0.04, -0.3, 0.36, 0.2), VAR]);
  // Blechbüchse für Münzen auf dem Kasten
  P.push([CY(0.06, 0.05, 0.1, 10, 0.24, 1.36, -0.08), [0.6, 0.6, 0.62]]);
  return P;
}
function placeParts(parts, x, z, yaw, y = 0.22) {
  return parts.map(([g, c]) => [g.clone().rotateY(yaw).translate(x, y, z), c]);
}
export function lifeMesh(parts) {
  const m = new T.Mesh(mergeColored(parts), paintMat({ color: 0xffffff, metalness: 0.25, roughness: 0.42, envI: 0.55, emissive: 0x070504 }));
  m.matrixAutoUpdate = false; return m;
}

/* ---------- Plätze für die Musiker suchen ---------- */
// frei: keine Wände/Möbel (Quader über 0,6 m), keine Bäume, Laternen, Türen, Wege der Passanten
function freeSpot(x, z, r, loops, apart = true) {
  if (DOORS.some(d => Math.hypot(d.x - x, d.z - z) < r + 3.5)) return false;
  if (apart && LIFE.spots.some(s => Math.hypot(s.x - x, s.z - z) < 40)) return false;
  if (trees.some(t => Math.abs(t.x - x) < r + 1.6 && Math.abs(t.z - z) < r + 1.6)) return false;
  if (lamps.some(l => Math.abs(l.x - x) < r + 0.9 && Math.abs(l.z - z) < r + 0.9)) return false;
  for (const b of nearBoxes(x, z, r + 1)) {
    if (b.y1 < 0.6 || b.y0 > 2.2) continue;
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (dx * dx + dz * dz < r * r) return false;
  }
  if (loops) for (const lp of loops) {
    if (!lp.pts || lp.pts.length !== 4) continue;
    for (let k = 0; k < 4; k++) {
      const a = lp.pts[k], b = lp.pts[(k + 1) % 4], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1;
      const u = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2)), px = a[0] + ex * u - x, pz = a[1] + ez * u - z;
      if (px * px + pz * pz < (r + 0.7) ** 2) return false;
    }
  }
  return true;
}
// Leierkasten: an einer Hauswand, Musiker und Kasten hintereinander an der Wand entlang (Front des Kastens zum Gehweg hin)
function organSpots(rr, loops, max) {
  const out = [], blockAt = (x, z) => blocks.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const order = curbs.map((c, i) => [rr(), i]).sort((a, b) => a[0] - b[0]).map(o => curbs[o[1]]);
  for (const c of order) {
    if (out.length >= max) break;
    const b = blockAt(c.cx, c.cz); if (!b || b.park || Math.hypot(c.cx, c.cz) > 900) continue;
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az); if (L < 24) continue;
    const dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L;
    let nx = -dz, nz = dx; if ((c.cx - c.ax) * nx + (c.cz - c.az) * nz < 0) { nx = -nx; nz = -nz; }
    const t = 8 + rr() * (L - 16), ins = 2.95, x = c.ax + dx * t + nx * ins, z = c.az + dz * t + nz * ins;
    if (inRect(x, z, PLAZA, 4)) continue;
    // Wand muss dahinter stehen (sonst ist es kein Haus), davor muss Platz sein
    let wall = false; for (const q of nearBoxes(x + nx * 1.1, z + nz * 1.1, 0.5)) if (q.y1 > 2.5 && x + nx * 1.1 > q.x0 - 0.3 && x + nx * 1.1 < q.x1 + 0.3 && z + nz * 1.1 > q.z0 - 0.3 && z + nz * 1.1 < q.z1 + 0.3) { wall = true; break; }
    if (!wall || !freeSpot(x, z, 0.75, null)) continue;
    if (!freeSpot(x + dx * 0.9, z + dz * 0.9, 0.5, null) || !freeSpot(x - dx * 0.9, z - dz * 0.9, 0.5, null)) continue;
    out.push({ type: 'organ', x, z, tx: dx, tz: dz, nx, nz, worker: (b.tier || 'fabric') === 'fabric' && b.d > 650 });
    LIFE.spots.push(out[out.length - 1]);
  }
  return out;
}
// Klavier: auf dem Belmont-Platz, im Rand zwischen Gehweg-Runde und Platzkante (dort ist Granit, kein Rasen)
function pianoSpots(rr, loops, max) {
  const cand = [];
  for (let k = 0; k < 60; k++) { const side = rr() < 0.5 ? -1 : 1; cand.push([side * (89 + rr() * 6), -112 + rr() * 224]); cand.push([-86 + rr() * 172, side * (123 + rr() * 6)]); }
  const out = [];
  for (const [x, z] of cand.sort(() => rr() - 0.5)) {
    if (out.length >= max) break;
    if (!freeSpot(x, z, 2.6, loops)) continue;
    const s = { type: 'piano', x, z, yaw: rr() * 6.28 }; out.push(s); LIFE.spots.push(s);
  }
  return out;
}

/* ---------- Figuren erzeugen (aus buildPedestrians, vor pedCrowd) ---------- */
const WHITE = [0.92, 0.9, 0.85];
export function lifePeds(loops) {
  const rr = mulberry32(5454), F = MOBILE ? 0.45 : 1, out = [], pickR = a => a[Math.floor(rr() * a.length)];
  // ---- Kellner auf den Terrassen ----
  for (const d of DOORS) {
    if ((d.kind !== 'cafe' && d.kind !== 'restaurant') || Math.hypot(d.x, d.z) > 820 || rr() > 0.75 * F) continue;
    const tx = -d.nz, tz = d.nx, tabs = [-7.6, -4.9, 4.9, 7.6].map(u => ({ x: d.x + d.nx * 1.0 + tx * u, z: d.z + d.nz * 1.0 + tz * u }));
    const pd = { st: 10, x: d.x, y: 0.22, z: d.z, yaw: 0, sc: 0.95 + rr() * 0.1, v: 0, kind: 'waiter', col: WHITE, act: 0.6,
      life: { type: 'waiter', d, tabs, ph: 'in', t: rr() * 12, path: null, pi: 0, pos: null, yaw: 0 } };
    out.push(pd); LIFE.waiters.push(pd);
  }
  // ---- Polizeistreifen zu zweit und laufende Zeitungsjungen auf den Gehwegen ----
  for (const lp of loops) {
    if (!lp.block || lp.worker || lp.block.d > 560) continue;
    const r = rr();
    if (r < 0.055 * F) {
      const v = (rr() < 0.5 ? 1 : -1) * (0.85 + rr() * 0.15), t = rr() * lp.total;
      const grp = [-0.36, 0.36].map(lat => ({ lp, t, v, ph: rr() * 6.28, sc: 1 + rr() * 0.06, st: 0, cool: 1e9, mcool: 1e9, lat, kind: 'police', patrol: true }));
      for (const g of grp) g.pair = grp.filter(o => o !== g);
      out.push(...grp);
    } else if (r < 0.1 * F) {
      const pd = { lp, t: rr() * lp.total, v: (rr() < 0.5 ? 1 : -1) * (1.0 + rr() * 0.2), ph: rr() * 6.28, sc: 0.64, st: 0, cool: 1e9, mcool: 1e9, kind: 'kid', col: pickR(SHIRTS) };
      pd.life = { type: 'news', t: 4 + rr() * 12, walk: true }; out.push(pd); LIFE.news.push(pd);
    }
  }
  // ---- Straßenmusik ----
  const parts = [];
  const listeners = (s, cx, cz, n, fx, fz, worker, rad0, y, walkers) => {
    // Zuhörer im Halbkreis um (cx, cz), auf der Seite -f, alle schauen zur Mitte
    for (let k = 0; k < n; k++) {
      const an = Math.atan2(-fx, -fz) + (k - (n - 1) / 2) * 0.55 + (rr() - 0.5) * 0.15, rad = rad0 + rr() * 0.5;
      const x = cx + Math.sin(an) * rad, z = cz + Math.cos(an) * rad;
      if (!freeSpot(x, z, 0.3, walkers ? loops : null, false)) continue;
      const fem = !worker && rr() < 0.5, kind = worker ? (rr() < 0.8 ? 'worker' : 'coat') : fem ? pickR(['lady', 'dress', 'furcoat']) : pickR(['coat', 'suit', 'suit']);
      const col = kind === 'worker' ? pickR(rr() < 0.5 ? SHIRTS : WORKWEAR) : kind === 'dress' ? pickR(DRESSES) : undefined;
      const r = rr(), act = r < 0.35 ? 0.6 + rr() * 0.3 : r < 0.6 ? 1.5 : r < 0.75 ? 15.3 : 0.2;
      const pd = { st: 4, x, y, z, yaw: Math.atan2(cx - x, cz - z), sc: 0.92 + rr() * 0.14, v: 0, kind, act, listen: s };
      if (col) pd.col = col;
      s.peds.push(pd); out.push(pd);
    }
  };
  for (const s of organSpots(rr, loops, Math.round(9 * F))) {
    // Leierkastenmann steht an der Wand und schaut an ihr entlang auf die Kurbel; der Kasten 0,85 m vor ihm
    const dir = rr() < 0.5 ? 1 : -1, fx = s.tx * dir, fz = s.tz * dir, ox = s.x + fx * 0.8, oz = s.z + fz * 0.8;
    s.yaw = Math.atan2(fx, fz); s.ox = ox; s.oz = oz; s.peds = [];
    parts.push(...placeParts(organParts(), ox, oz, Math.atan2(-fx, -fz)));
    addCollider(ox - 0.45, 0, oz - 0.45, ox + 0.45, 1.4, oz + 0.45);
    const man = { st: 4, x: s.x - fx * 0.0, y: 0.22, z: s.z, yaw: s.yaw, sc: 0.95 + rr() * 0.08, v: 0, kind: s.worker || rr() < 0.6 ? 'worker' : 'coat', col: pickR(WORKWEAR), act: 29.05, busy: true, music: s };
    s.peds.push(man); out.push(man);
    // Publikum steht auf dem Gehweg davor (zur Straße hin)
    listeners(s, s.x + fx * 0.4, s.z + fz * 0.4, 2 + Math.floor(rr() * 2), s.nx, s.nz, s.worker, 1.5, 0.22, false);
    s.songT = 20 + rr() * 20;
  }
  for (const s of pianoSpots(rr, loops, Math.round(4 * F + 0.4))) {
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);   // Klavierfront zeigt nach (fx, fz)
    s.peds = [];
    const Y = inRect(s.x, s.z, PLAZA) ? 0.26 : 0.22;
    parts.push(...placeParts(pianoParts(), s.x, s.z, s.yaw, Y));
    addCollider(s.x - 0.85, 0, s.z - 0.85, s.x + 0.85, 1.4, s.z + 0.85);
    const pianist = { st: 4, x: s.x + fx * 1.05, y: Y + 0.82, z: s.z + fz * 1.05, yaw: s.yaw + Math.PI, sc: 1, v: 0, kind: rr() < 0.5 ? 'tux' : 'suit', col: COATS[Math.floor(rr() * 3)], sit: true, act: 14.5, busy: true, music: s };
    const rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);   // rechts von der Klavierfront
    const singer = { st: 4, x: s.x + fx * 0.95 + rx * 1.25, y: Y, z: s.z + fz * 0.95 + rz * 1.25, yaw: s.yaw + 0.5, sc: 0.98, v: 0, kind: rr() < 0.6 ? 'gown' : 'dress', col: pickR(GOWNS), act: 0.95, busy: true, music: s, singer: true };
    s.peds.push(pianist, singer); out.push(pianist, singer);
    listeners(s, s.x + fx * 1.2 + rx * 0.6, s.z + fz * 1.2 + rz * 0.6, 4 + Math.floor(rr() * 2), -fx, -fz, false, 2.3, Y, true);
    s.songT = 25 + rr() * 20;
  }
  if (parts.length) { LIFE.mesh = lifeMesh(parts); scene.add(LIFE.mesh); }
  return out;
}
// Zeitungsjungen an Ecken (aus buildPedestrians) bekommen denselben Wechsel aus Ausrufen und Zeitung-Zeigen
export function newsCorner(pd) { pd.life = { type: 'news', t: Math.random() * 5, walk: false }; LIFE.news.push(pd); }

/* ---------- Jedes Bild ---------- */
const HEAD = ['Extrablatt! Extrablatt! Alexander fliegt über den Krater!', 'Abendausgabe! Polarlicht über Vespera, so hell wie nie!', 'Extrablatt! Die Aurora Imperial über der Stadt!',
  'Neueste Nachrichten! Großer Ball im Belmont, ganz Vespera tanzt!', 'Abendausgabe! Vespera baut weiter: drei neue Türme!', 'Extrablatt! Herr Alexander hebt Automobil mit bloßem Blick!',
  'Abendausgabe! Börse im Hoch, die Stadt feiert!', 'Extrablatt! Wer ist die geheimnisvolle Dame im Belmont?'];
const HEAD_HIM = ['Herr Alexander! Sie sind auf der Titelseite!', 'Eine Zeitung für Herrn Alexander? Geht aufs Haus!', 'Extrablatt! … oh! Guten Abend, Herr Alexander!'];
const MUSIC_HIM = { organ: ['Ein Walzer für den Herrn von Vespera!', 'Für Sie spiel’ ich den schönsten, Herr Alexander!'], piano: ['Das nächste Lied ist für Herrn Alexander!', 'Meine Damen und Herren … Herr Alexander hört zu!'] };
export function lifeSay(who, s, dur = 4) {
  const el = $('say'); if (!el || shared.sayTimer > 0.5) return false;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + s + '“';
  el.style.opacity = 1; shared.sayTimer = dur; return true;
}
const walkOn = (pd, on) => { const g = pd.a.gait; if (on) { g[1] = 1.25 * (pd.fem ? 5.4 : 4.6) / pd.sc; g[2] = pd.fem ? 0.36 : 0.4; } else { g[1] = pd.act; g[2] = 0; } pd.a.gv = (pd.a.gv | 0) + 1; };
// Kellner (st 10): drinnen – zur Tür hinaus – zu einem Tisch – Bestellung aufnehmen – zurück
export function lifeStep(pd, dt) {
  const L = pd.life, a = pd.a; if (!a) return;
  const d = L.d;
  if (!near2(d.x, d.z, 260)) { L.ph = 'in'; L.t = Math.min(L.t, 6); a.on = false; return; }
  if (L.ph === 'in') {
    a.on = false;
    if ((L.t -= dt) > 0) return;
    const tb = L.tabs[Math.floor(Math.random() * L.tabs.length)], lx = d.x + d.nx * 2.1, lz = d.z + d.nz * 2.1;
    L.stand = { x: tb.x + d.nx * 0.8, z: tb.z + d.nz * 0.8, yaw: Math.atan2(-d.nx, -d.nz) };
    L.path = [[d.x - d.nx * 1.4, d.z - d.nz * 1.4], [lx, lz], [lx + (tb.x - d.x), lz + (tb.z - d.z)], [L.stand.x, L.stand.z]]; L.pi = 0; L.pos = null; L.back = false; L.ph = 'walk';
    walkOn(pd, true);
  }
  if (L.ph === 'walk') {
    const P = L.path; let step = 1.25 * dt, [x, z] = L.pos || P[0];
    while (step > 0 && L.pi < P.length - 1) { const [tx, tz] = P[L.pi + 1], dd = Math.hypot(tx - x, tz - z); if (dd <= step) { x = tx; z = tz; step -= dd; L.pi++; } else { x += (tx - x) / dd * step; z += (tz - z) / dd * step; step = 0; } }
    L.pos = [x, z];
    const nx = P[Math.min(L.pi + 1, P.length - 1)], want = Math.atan2(nx[0] - x, nx[1] - z);
    if (L.pi < P.length - 1) L.yaw += Math.atan2(Math.sin(want - L.yaw), Math.cos(want - L.yaw)) * Math.min(1, dt * 8);
    pedCrowd.set(a, x, 0.22, z, L.yaw, pd.sc);
    if (L.pi >= P.length - 1) {
      if (L.back) { L.ph = 'in'; L.t = 6 + Math.random() * 16; a.on = false; walkOn(pd, false); }
      else { L.ph = 'serve'; L.t = 5 + Math.random() * 6; const r = Math.random(); pd.act = r < 0.55 ? 28.2 + Math.random() * 0.3 : r < 0.8 ? 0.9 : 36.2; walkOn(pd, false); L.yaw = L.stand.yaw; }
    }
    return;
  }
  if (L.ph === 'serve') {
    pedCrowd.set(a, L.stand.x, 0.22, L.stand.z, L.yaw, pd.sc);
    if ((L.t -= dt) <= 0) { L.path = L.path.slice().reverse(); L.pi = 0; L.pos = null; L.back = true; L.ph = 'walk'; walkOn(pd, true); }
  }
}
// Zeitungsjungen, Applaus nach dem Lied, Rufe der Musiker; aus updatePedestrians
export function updateLife(dt) {
  LIFE.sayT -= dt;
  const p = player.p;
  for (const pd of LIFE.news) {
    const L = pd.life, a = pd.a; if (!a || !a.on || pd.aw || pd.rag) continue;
    const e = a.m.elements; if (!near2(e[12], e[14], 140)) continue;
    if ((L.t -= dt) > 0) continue;
    if (L.walk && pd.st === 0) {
      // stehen bleiben und ausrufen
      pd.x = e[12]; pd.y = e[13]; pd.z = e[14]; pd.yaw = Math.atan2(e[8], e[10]) + (Math.random() - 0.5) * 1.2;
      L.g = [a.gait[1], a.gait[2]]; pd.st = 4; L.stop = 6 + Math.random() * 6; L.t = 0;
    }
    if (pd.st !== 4) continue;
    // wechseln: Zeitung hochhalten und rufen (6) oder aufgeschlagen zeigen (31)
    const shout = !(a.gait[1] > 5.5 && a.gait[1] < 7.5);
    setAct(pd, shout ? 6.6 : 31.2); L.t = shout ? 2.5 + Math.random() * 2 : 3 + Math.random() * 3;
    if (shout && LIFE.sayT <= 0) {
      const d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
      if (d2 < 18 * 18 && Math.abs(e[13] - p.y) < 6) { const him = d2 < 6 * 6; if (him) turnHead(a, p.x, p.z); if (lifeSay('Ein Zeitungsjunge', (him ? HEAD_HIM : HEAD)[Math.floor(Math.random() * (him ? HEAD_HIM : HEAD).length)], 3.5)) LIFE.sayT = 9 + Math.random() * 6; }
    }
    if (L.walk && (L.stop -= L.t) <= 0) {
      // weiter
      pd.st = 0; a.gait[1] = L.g[0]; a.gait[2] = L.g[1]; a.gv = (a.gv | 0) + 1; L.t = 15 + Math.random() * 25;
    }
  }
  for (const s of LIFE.spots) {
    if (!s.peds || !near2(s.x, s.z, 110)) continue;
    if (s.clap > 0) {
      if ((s.clap -= dt) <= 0) for (const pd of s.peds) { if (pd.aw || !pd.a) continue; if (pd.listen) setAct(pd, pd.act); else if (pd.singer) { pd.tilt = 0; setAct(pd, 0.95); } }
      continue;
    }
    if ((s.songT -= dt) <= 0) {
      // Lied zu Ende: Applaus, die Sängerin verneigt sich
      s.songT = 28 + Math.random() * 22; s.clap = 3.2;
      for (const pd of s.peds) { if (pd.aw || !pd.a) continue; if (pd.listen && Math.random() < 0.85) setAct(pd, 9.2 + Math.random() * 0.5); else if (pd.singer) { pd.tilt = -0.18; setAct(pd, 1.3); } }
    }
    // kommt Alexander näher, widmen sie ihm ein Lied
    const d2 = (s.x - p.x) ** 2 + (s.z - p.z) ** 2;
    if (d2 < 7 * 7 && Math.abs(p.y - 0.3) < 4 && !(s.him > 0) && LIFE.sayT <= 0) {
      const L = MUSIC_HIM[s.type], who = s.type === 'organ' ? 'Der Leierkastenmann' : 'Die Sängerin';
      if (lifeSay(who, L[Math.floor(Math.random() * L.length)], 4)) { s.him = 60; LIFE.sayT = 8; for (const pd of s.peds) if (pd.a && pd.a.on) turnHead(pd.a, p.x, p.z); }
    }
    if (s.him > 0) s.him -= dt;
  }
}
// Nächster Musikplatz (für music.js): Art und Entfernung
export function nearestMusic(p) {
  let best = null, bd = 1e9;
  for (const s of LIFE.spots) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } }
  return best ? { s: best, d: bd } : null;
}
