import { T, scene, camera, MOBILE, R, mergeGeos, canvasTex, $ } from './core.js';
import { MAT, mergeColored, paintMat, addCollider, stdMat, removeColliders } from './people-skeleton.js';
import { addGlow } from './facade-shader.js';
import { AV, ST } from './island.js';
import { TRF, OBSTACLES, lightGreen, lightAmber, tramGeos } from './traffic.js';
import { IB } from './shops.js';
import { COL, Crowd, COATS, DRESSES, FURCOATS, WORKWEAR, turnHead, STREET } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { addPlatform, pfRead, pfSave } from './harbour.js';
import { player, keys } from './player.js';
import { INTERACT } from './music.js';
import { toast, BOAT } from './boat.js';
import { lifeSay } from './life.js';
import { tramBell } from './audio.js';
import { KT, ktCash, ktOwns } from './kontor.js';
import { RUF, rufAdd } from './ruf.js';
import { playing, paused } from './input.js';
import { openChoice, DINE } from './venues.js';
import { PM, playerSitAt, toggleView } from './player-model.js';
import { tearInst } from './tear.js';
import { addTasten } from './pausemenu.js';
import { DRIVE } from './eating.js';
import { BAHN } from './bahn-hook.js';
import { IMP } from './imperial.js';

/* =====================================================================
   V63 · BAHN: zwei Straßenbahnlinien und eine Hochbahn als geschlossene Ringe durch die Viertel.
   - Linien laufen auf dem Straßenraster (Linie 1 West, Linie 2 Nord, Hochbahn Ost auf einem Stahlviadukt in 8,5 m Höhe),
     beide Richtungen, rechts in den Fahrspuren; Wagen halten an Haltestellen, an roten Ampeln, hinter Autos und vor Alexander.
   - Nahe Wagen (bis 60 m) werden gegen ein begehbares Modell mit Innenraum getauscht (Plattform wie Boote: mitfahren,
     herumgehen, hinsetzen). Türen öffnen sich an den Halten, Fahrgäste steigen ein und aus.
   - Einsteigen: einfach hineingehen oder E an der Tür; Aussteigen mit E am Halt; Wegfliegen jederzeit (F).
   - Fahrschein 1 Lumen (Kontor); gehören Alexander die Vespera-Verkehrsbetriebe, fährt er umsonst.
   - Taste V im Wagen: Ich-Ansicht, Figur, Außenansicht. Ansagen über #say (voice.js spricht sie).
   - Stadtkarte (Ebene „Bahn“): Linien, Haltestellen, fahrende Wagen; Schnellfahrt mit der Bahn von jeder Haltestelle.
   ===================================================================== */
// Linien: Ecken im Uhrzeigersinn auf Rasterknoten (Avenuen alle 110 m, Straßen alle 70 m); Haltestellen grob, werden auf die Blockmitte gesetzt
const BH_LINES = [
  { id: '1', kind: 'tram', name: 'Linie 1', title: 'Theater · Belmont · Hafen', col: '#5fe0d0', n: 3, v: 9.5,
    C: [[-330, -210], [-110, -210], [-110, 420], [-330, 420]],
    S: [['Salonviertel', -165, -210], ['Belmont-Platz West', -110, -35], ['Lichterviertel West', -110, 245], ['Hafenstraße', -165, 420], ['Lumière-Theater', -330, 175], ['Theaterviertel', -330, -105]] },
  { id: '2', kind: 'tram', name: 'Linie 2', title: 'Brass Lantern · Sternwarte · Salonviertel', col: '#e8b765', n: 3, v: 9.5,
    C: [[-220, -770], [330, -770], [330, -280], [-220, -280]],
    S: [['Arbeiterviertel', -165, -770], ['Brass Lantern · Kneipenplatz', 165, -770], ['Sternwarte', 330, -525], ['Belmont-Nord · Große Avenue', 55, -280], ['Salonviertel', -165, -280], ['Observatoriumsgärten', -220, -525]] },
  { id: 'H', kind: 'hoch', name: 'Hochbahn', title: 'Belmont · Börse · Eiskanal · Café Kranich', col: '#f3e2b0', n: 2, v: 13, y: 8.5, cars: 2,
    C: [[110, -210], [440, -210], [440, 350], [110, 350]],
    S: [['Belmont-Platz', 110, 35], ['Salonviertel Ost', 275, -210], ['Börse · Vespera-Bank', 440, -35], ['Eiskanal', 440, 245], ['Café Kranich', 165, 350]] },
];
const BH_FY = 0.62, BH_CARL = 13.9, BH_PLAT = 9.1;   // Wagenboden über Schienenoberkante, Abstand gekuppelter Wagen, Bahnsteig der Hochbahn
const bhNorm = (x, z) => { const L = Math.hypot(x, z) || 1; return [x / L, z / L]; };
const bhStreetHalf = (axisX) => axisX ? 7 : 11;   // entlang x: Straße (14 m), entlang z: Avenue (22 m)

/* ---------- Wege: Mittellinie mit Kurven, Gleise je Richtung rechts versetzt ---------- */
function bhCenter(C, Rr, step) {
  const n = C.length, P = [], O = [];
  for (let i = 0; i < n; i++) {
    const p = C[(i + n - 1) % n], c = C[i], q = C[(i + 1) % n], a = bhNorm(c[0] - p[0], c[1] - p[1]), b = bhNorm(q[0] - c[0], q[1] - c[1]);
    const S = [c[0] - a[0] * Rr, c[1] - a[1] * Rr], E = [c[0] + b[0] * Rr, c[1] + b[1] * Rr], m = Math.max(8, Math.ceil(Rr * 1.6 / step));
    const oa = Math.abs(a[0]) > 0.5 ? 1 : 0, ob = Math.abs(b[0]) > 0.5 ? 1 : 0;
    for (let k = 0; k < m; k++) { const t = k / m, u = 1 - t; P.push([u * u * S[0] + 2 * u * t * c[0] + t * t * E[0], u * u * S[1] + 2 * u * t * c[1] + t * t * E[1]]); O.push({ ax: t < 0.5 ? oa : ob, f: t, a: oa, b: ob, arc: true }); }
    const S2 = [q[0] - b[0] * Rr, q[1] - b[1] * Rr], L = Math.hypot(S2[0] - E[0], S2[1] - E[1]), m2 = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m2; k++) { const t = k / m2; P.push([E[0] + (S2[0] - E[0]) * t, E[1] + (S2[1] - E[1]) * t]); O.push({ ax: ob, arc: false }); }
  }
  return { P, O };
}
function bhCum(P, closed) {
  const c = [0]; for (let k = 1; k < P.length; k++) c.push(c[k - 1] + Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]));
  if (closed) c.push(c[c.length - 1] + Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]));
  return c;
}
// Punkt auf einem geschlossenen Weg: [x, z, dx, dz]
export function bhAt(tr, s) {
  const P = tr.P, c = tr.cum, L = tr.len; s = ((s % L) + L) % L;
  let lo = 1, hi = c.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (c[m] < s) lo = m + 1; else hi = m; }
  const k = Math.max(1, lo), a = P[(k - 1) % P.length], b = P[k % P.length], seg = (c[k] - c[k - 1]) || 1, t = (s - c[k - 1]) / seg;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (b[0] - a[0]) / seg, (b[1] - a[1]) / seg];
}
// nächster Wegpunkt zu (x, z): Bogenlänge
function bhProject(tr, x, z) {
  let bi = 0, bd = 1e18; const P = tr.P;
  for (let k = 0; k < P.length; k++) { const d = (P[k][0] - x) ** 2 + (P[k][1] - z) ** 2; if (d < bd) { bd = d; bi = k; } }
  return { s: tr.cum[bi], d: Math.sqrt(bd), k: bi };
}
function bhTrack(L, cen, d) {
  const n = cen.P.length, P = [], vl = [];
  const idx = k => d > 0 ? k : (n - k) % n;
  for (let q = 0; q < n; q++) {
    const k = idx(q), p = cen.P[k], a = cen.P[idx((q + n - 1) % n)], b = cen.P[idx((q + 1) % n)];
    const [tx, tz] = bhNorm(b[0] - a[0], b[1] - a[1]), nx = -tz, nz = tx;
    const o = cen.O[k];
    let off;
    if (L.kind === 'hoch') off = 1.6;
    else { const ofs = ax => ax ? 3.5 : 6.5; off = o.arc ? ofs(o.a) + (ofs(o.b) - ofs(o.a)) * o.f : ofs(o.ax); }
    P.push([p[0] + nx * off, p[1] + nz * off]);
    vl.push(o.arc ? (L.kind === 'hoch' ? 7.5 : 4.6) : L.v);
  }
  const tr = { L, d, P, cum: bhCum(P, true), stops: [], lights: [], y: L.y || 0.05, vl };
  tr.len = tr.cum[tr.cum.length - 1];
  return tr;
}
const bhVlim = (tr, s) => { const P = tr.P, c = tr.cum, L = tr.len; s = ((s % L) + L) % L; let lo = 0, hi = P.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (c[m] <= s) lo = m; else hi = m - 1; } return tr.vl[lo]; };

/* ---------- Bauen ---------- */
export function buildBahn() {
  if (BAHN.built) return;
  const rails = [], beds = [], deck = [], wire = [], poles = [], pil = [];
  const paint = [], lit = [], signs = [];
  for (const L of BH_LINES) {
    const cen = bhCenter(L.C, L.kind === 'hoch' ? 16 : 11, 1.5);
    const line = { ...L, cen, tracks: [], stations: [] };
    line.cumC = bhCum(cen.P, true); line.lenC = line.cumC[line.cumC.length - 1];
    BAHN.lines.push(line);
    for (const d of [1, -1]) { const tr = bhTrack(line, cen, d); line.tracks.push(tr); BAHN.tracks.push(tr); }
    // Haltestellen auf die Mitte des Straßenstücks setzen (zwischen den beiden nächsten Rasterkreuzungen)
    for (const [nm, x0, z0] of L.S) {
      const axX = L.C.some((c, i) => { const q = L.C[(i + 1) % L.C.length]; return c[1] === q[1] && Math.abs(z0 - c[1]) < 1 && x0 > Math.min(c[0], q[0]) && x0 < Math.max(c[0], q[0]); });
      const st = { id: L.id + ':' + nm, n: nm, line, x: x0, z: z0, axX, sides: [], wait: 2 + Math.floor(R() * 3), t: R() * 20 };
      line.stations.push(st); BAHN.stations.push(st);
    }
    if (L.kind === 'tram') bhTramInfra(line, rails, beds, wire, poles, paint, lit, signs);
    else bhHochInfra(line, rails, deck, pil, paint, lit, signs);
  }
  // Umsteigen: gleichnamige oder nahe Haltestellen anderer Linien
  for (const s of BAHN.stations) s.change = [...new Set(BAHN.stations.filter(o => o.line !== s.line && Math.hypot(o.x - s.x, o.z - s.z) < 140).map(o => o.line.name))];
  // Gleise, Bett, Viadukt
  const railM = stdMat({ color: 0x9aa0a6, metalness: 1, roughness: 0.22, envI: 1.2 });
  const bedM = stdMat({ color: 0x1b1f22, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const add = (list, mat) => { if (!list.length) return null; const m = new T.Mesh(mergeGeos(list), mat); m.frustumCulled = false; scene.add(m); return m; };
  add(rails, railM); add(beds, bedM);
  if (deck.length) { const m = new T.Mesh(mergeColored(deck), paintMat({ color: 0xffffff, metalness: 0.55, roughness: 0.55, envI: 0.5, side: T.DoubleSide })); m.frustumCulled = false; scene.add(m); }
  if (paint.length) { const m = new T.Mesh(mergeColored(paint), paintMat({ color: 0xffffff, metalness: 0.4, roughness: 0.5, envI: 0.7 })); m.frustumCulled = false; scene.add(m); }
  if (lit.length) { const g = mergeColored(lit), m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true })); m.frustumCulled = false; scene.add(m); }
  bhSigns(signs);
  // Oberleitungsmasten (ausreißbar wie früher) und Fahrdraht
  if (poles.length) {
    const pole = mergeGeos([new T.CylinderGeometry(0.1, 0.16, 7, 8).translate(0, 3.5, 0), new T.SphereGeometry(0.2, 8, 6).translate(0, 7.05, 0), new T.CylinderGeometry(0.22, 0.22, 0.5, 8).translate(0, 0.25, 0)]);
    const pm = new T.InstancedMesh(pole, MAT.brass, poles.length);
    poles.forEach(([px, pz], i) => {
      const m0 = new T.Matrix4().makeTranslation(px, 0.2, pz); pm.setMatrixAt(i, m0);
      addCollider(px - 0.2, 0, pz - 0.2, px + 0.2, 7, pz + 0.2);
      tearInst('mast:' + px.toFixed(0) + ',' + pz.toFixed(0), { name: 'Oberleitungsmast', m: 260, stuff: 'metal', kind: 'cyl' }, { x: px, y: 0.2, z: pz, he: [0.22, 3.6, 0.22], cy: 3.6, ims: [[pm, i]], m0, mesh: () => new T.Mesh(pole.clone().translate(0, -3.6, 0), MAT.brass) });
    });
    pm.frustumCulled = false; scene.add(pm);
  }
  if (wire.length) { const wl = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(wire, 3)), new T.LineBasicMaterial({ color: 0x3a3a3a })); wl.frustumCulled = false; scene.add(wl); }
  if (pil.length) {
    const g = mergeColored([[IB(0.9, 6.6, 0.9, 0, 3.3, 0), [0.07, 0.12, 0.11]], [IB(1.3, 0.5, 1.3, 0, 0.25, 0), [0.32, 0.3, 0.27]], [IB(1.2, 0.35, 1.2, 0, 6.5, 0), [0.07, 0.12, 0.11]], [IB(0.94, 0.12, 0.94, 0, 5.6, 0), COL.gold], [IB(0.94, 0.12, 0.94, 0, 1.2, 0), COL.gold], [IB(0.7, 0.6, 6.6, 0, 7.05, 0), [0.07, 0.12, 0.11]]]);
    const im = new T.InstancedMesh(g, paintMat({ color: 0xffffff, metalness: 0.6, roughness: 0.5, envI: 0.5 }), pil.length);
    pil.forEach(([x, z, ry], i) => { im.setMatrixAt(i, new T.Matrix4().makeRotationY(ry).setPosition(x, 0, z)); addCollider(x - 0.5, 0, z - 0.5, x + 0.5, 7.4, z + 0.5); });
    im.frustumCulled = false; scene.add(im);
  }
  bhClearFurniture();
  bhVehicles();
  bhDetails();
  bhCrowd();
  bhInteractions();
  BAHN.built = true;
}

// Straßenbahn: Gleise, Bett, Fahrdraht, Masten, Haltestellen mit Wartehäuschen
function bhTramInfra(line, rails, beds, wire, poles, paint, lit, signs) {
  const ribbon = (list, tr, lat, w, y) => {
    const P = tr.P, n = P.length, pos = [], idx = [];
    for (let q = 0; q <= n; q++) {
      const k = q % n, a = P[(k + n - 1) % n], b = P[(k + 1) % n], [tx, tz] = bhNorm(b[0] - a[0], b[1] - a[1]), nx = -tz, nz = tx;
      pos.push(P[k][0] + nx * (lat - w / 2), y, P[k][1] + nz * (lat - w / 2), P[k][0] + nx * (lat + w / 2), y, P[k][1] + nz * (lat + w / 2));
      if (q) { const o = (q - 1) * 2; idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { const N = g.attributes.normal.array; for (let i = 0; i < N.length; i++) N[i] = -N[i]; const I = g.index.array; for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } }
    list.push(g);
  };
  for (const tr of line.tracks) {
    ribbon(beds, tr, 0, 2.3, 0.012);
    for (const r of [-0.72, 0.72]) ribbon(rails, tr, r, 0.09, 0.035);
    // Fahrdraht: Polylinie in 5,75 m Höhe
    const P = tr.P, n = P.length;
    for (let k = 0; k < n; k += 4) { const a = P[k], b = P[Math.min(n, k + 4) % n]; wire.push(a[0], 5.75, a[1], b[0], 5.75, b[1]); }
  }
  // Masten am Bordstein beider Seiten, alle 36 m, nicht in Kreuzungen und Haltestellen
  const cen = line.cen, nC = cen.P.length;
  const nearNode = (x, z) => { const ax = AV.reduce((m, a) => Math.min(m, Math.abs(a.x - x)), 1e9), sz = ST.reduce((m, s) => Math.min(m, Math.abs(s.z - z)), 1e9); return ax < 16 && sz < 16; };
  let acc = 0;
  for (let k = 1; k < nC; k++) {
    acc += Math.hypot(cen.P[k][0] - cen.P[k - 1][0], cen.P[k][1] - cen.P[k - 1][1]);
    if (acc < 36 || cen.O[k].arc) continue;
    const [x, z] = cen.P[k]; if (nearNode(x, z)) continue;
    if (line.stations.some(s => Math.hypot(s.x - x, s.z - z) < 14)) continue;
    acc = 0;
    const axX = cen.O[k].ax === 1, h = bhStreetHalf(axX) + 0.6;
    const pa = axX ? [x, z - h] : [x - h, z], pb = axX ? [x, z + h] : [x + h, z];
    poles.push(pa, pb);
    wire.push(pa[0], 6.6, pa[1], pb[0], 6.6, pb[1]);
  }
  // Haltestellen: je Richtung ein Wartehäuschen am Bordstein rechts der Fahrt
  for (const st of line.stations) for (const tr of line.tracks) {
    const pr = bhProject(tr, st.x, st.z), q = bhAt(tr, pr.s), tx = q[2], tz = q[3], nx = -tz, nz = tx;
    const axX = Math.abs(tx) > 0.5, curb = bhStreetHalf(axX);
    const lc = curb - (axX ? 3.5 : 6.5);   // vom Gleis bis zum Bordstein (Gleis liegt in der rechten Fahrspur)
    const side = { tr, s: pr.s, x: q[0], z: q[1], tx, tz, nx, nz, lc, y: 0.22, hoch: false, st };
    st.sides.push(side); tr.stops.push(side);
    const W = (al, la) => [q[0] + tx * al + nx * la, q[1] + tz * al + nz * la];
    const ry = Math.atan2(-tz, tx), rot = g => g.rotateY(ry);
    const put = (g, al, la, y, c, list = paint) => { const [x, z] = W(al, la); list.push([rot(g).translate(x, y, z), c]); };
    const L0 = lc + 0.5, L1 = lc + 2.6;   // Häuschen vom Bordstein bis 2,6 m auf den Gehweg
    const petrol = [0.04, 0.2, 0.21], gold = COL.gold, dark = [0.05, 0.07, 0.08];
    for (const al of [-3.4, 3.4]) for (const la of [L0, L1]) { put(new T.CylinderGeometry(0.07, 0.08, 2.6, 8), al, la, 1.52, gold); const [x, z] = W(al, la); addCollider(x - 0.12, 0, z - 0.12, x + 0.12, 2.8, z + 0.12); }
    put(new T.BoxGeometry(7.4, 0.16, 2.6), 0, (L0 + L1) / 2, 2.9, petrol);
    put(new T.BoxGeometry(7.5, 0.06, 2.7), 0, (L0 + L1) / 2, 2.8, gold);
    put(new T.BoxGeometry(4.2, 0.45, 0.12), 0, L1 - 0.2, 3.2, petrol); put(new T.BoxGeometry(4.3, 0.05, 0.14), 0, L1 - 0.2, 3.45, gold);
    for (let f = -2; f <= 2; f++) put(new T.BoxGeometry(0.06, 0.5 - Math.abs(f) * 0.08, 0.13), f * 0.6, L1 - 0.2, 3.65 - Math.abs(f) * 0.04, gold);   // Fächer-Krone
    put(new T.BoxGeometry(6.8, 1.9, 0.05), 0, L1 + 0.05, 1.3, [0.08, 0.13, 0.15]);   // Rückwand aus Glas (dunkel)
    for (const al of [-2.3, 0, 2.3]) put(new T.BoxGeometry(0.05, 1.9, 0.07), al, L1 + 0.02, 1.3, gold);
    put(new T.BoxGeometry(5, 0.08, 0.45), 0, L1 - 0.35, 0.68, [0.35, 0.2, 0.1]); put(new T.BoxGeometry(5, 0.4, 0.06), 0, L1 - 0.12, 0.95, [0.35, 0.2, 0.1]);
    for (const al of [-2.2, 2.2]) put(new T.BoxGeometry(0.08, 0.45, 0.4), al, L1 - 0.35, 0.44, dark);
    { const [x, z] = W(0, L1 - 0.3); addCollider(x - (axX ? 2.6 : 0.4), 0, z - (axX ? 0.4 : 2.6), x + (axX ? 2.6 : 0.4), 0.72, z + (axX ? 0.4 : 2.6)); const [bx, bz] = W(0, L1 + 0.05); addCollider(bx - (axX ? 3.4 : 0.08), 0, bz - (axX ? 0.08 : 3.4), bx + (axX ? 3.4 : 0.08), 2.3, bz + (axX ? 0.08 : 3.4)); }
    // Haltestellenmast mit „H“-Scheibe am Bordstein
    put(new T.CylinderGeometry(0.05, 0.06, 2.7, 8), 4.6, lc + 0.35, 1.57, dark);
    put(new T.CylinderGeometry(0.34, 0.34, 0.05, 20).rotateX(Math.PI / 2), 4.6, lc + 0.35, 2.85, gold);
    put(new T.CylinderGeometry(0.28, 0.28, 0.06, 20).rotateX(Math.PI / 2), 4.6, lc + 0.35, 2.85, [0.05, 0.3, 0.29], lit);
    { const [x, z] = W(4.6, lc + 0.35); addCollider(x - 0.08, 0, z - 0.08, x + 0.08, 2.9, z + 0.08); }
    const [gx, gz] = W(0, (L0 + L1) / 2); addGlow(gx, 2.7, gz, [1.3, 0.92, 0.5], 2.0);
    // Schilder: Name auf dem Dach (zur Straße), Fahrplan an der Rückwand (zum Gehweg hin innen)
    const [sx, sz] = W(0, L1 - 0.27);
    signs.push({ kind: 'name', text: st.n.toUpperCase(), sub: line.name.toUpperCase() + ' · ' + line.title.toUpperCase(), col: line.col, x: sx, y: 3.2, z: sz, ry, w: 4.1, h: 0.42, both: true });
    const [fx, fz] = W(-2.9, L1 - 0.03);
    signs.push({ kind: 'plan', line, st, x: fx, y: 1.55, z: fz, ry: ry + Math.PI, w: 0.75, h: 1.0 });
    side.wait = [];
    for (let i = 0; i < 5; i++) { const al = -2.6 + i * 1.25, sit = i % 2 === 1; const [x, z] = sit ? W(al, L1 - 0.32) : W(al + 0.3, lc + 0.9 + (i % 3) * 0.25); side.wait.push({ x, z, y: 0.22, sit, yaw: Math.atan2(-nx, -nz) }); }
    side.door = (al) => W(al, 0);
    BAHN.keepOut.push({ x: gx, z: gz, r: 5 });
  }
}

// Hochbahn: Stahlviadukt mit Gleisen, Pfeilern, Bahnsteigen, Dächern und Treppen
function bhHochInfra(line, rails, deck, pil, paint, lit, signs) {
  const cen = line.cen, P = cen.P, n = P.length, Y = line.y, HW = 3.15;
  const steel = [0.07, 0.12, 0.11], fascia = [0.1, 0.16, 0.15], gold = COL.gold, bedC = [0.12, 0.12, 0.13];
  // Stationsbereiche (Bahnsteigseite: keine Brüstung)
  const stS = line.stations.map(st => { const pr = bhProject({ P, cum: line.cumC }, st.x, st.z); return pr.s; });
  const inStation = s => stS.some(t => { let d = Math.abs(s - t); d = Math.min(d, line.lenC - d); return d < 15.5; });
  // Bänder entlang der Mittellinie (Ober-, Unterseite, Seiten, Brüstung, Goldstreifen)
  const strip = (lat0, lat1, y0, y1, c, list, skipSt) => {
    const pos = [], col = [], idx = [];
    let v = 0;
    for (let q = 0; q < n; q++) {
      const k0 = q, k1 = (q + 1) % n, s0 = line.cumC[q];
      if (skipSt && inStation(s0)) continue;
      const seg = [k0, k1].map(k => { const a = P[(k + n - 1) % n], b = P[(k + 1) % n], [tx, tz] = bhNorm(b[0] - a[0], b[1] - a[1]); return [P[k][0], P[k][1], -tz, tx]; });
      const pt = (S, lat, y) => [S[0] + S[2] * lat, y, S[1] + S[3] * lat];
      const quad = [pt(seg[0], lat0, y0), pt(seg[0], lat1, y1), pt(seg[1], lat0, y0), pt(seg[1], lat1, y1)];
      for (const p of quad) { pos.push(...p); col.push(...c); }
      idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);   // Material beidseitig
      v += 4;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    list.push([g, c]);
  };
  strip(-HW, HW, Y - 0.05, Y - 0.05, bedC, deck);           // Fahrbahn
  strip(-HW, HW, Y - 1.05, Y - 1.05, steel, deck);          // Unterseite
  for (const sd of [-1, 1]) {
    strip(sd * HW, sd * HW, Y - 1.25, Y - 0.05, fascia, deck);           // Blechträger
    strip(sd * (HW + 0.01), sd * (HW + 0.01), Y - 0.75, Y - 0.62, gold, deck);   // Goldstreifen
    strip(sd * HW, sd * HW, Y - 0.05, Y + 0.95, steel, deck, true);      // Brüstung (nicht am Bahnsteig)
    strip(sd * HW - 0.05 * sd, sd * HW + 0.05 * sd, Y + 0.95, Y + 0.95, gold, deck, true);
  }
  for (const tr of line.tracks) for (const r of [-0.72, 0.72]) {
    const Q = tr.P, m = Q.length, pos = [], idx = [];
    for (let q = 0; q <= m; q++) { const k = q % m, a = Q[(k + m - 1) % m], b = Q[(k + 1) % m], [tx, tz] = bhNorm(b[0] - a[0], b[1] - a[1]), nx = -tz, nz = tx; pos.push(Q[k][0] + nx * (r - 0.045), Y + 0.04, Q[k][1] + nz * (r - 0.045), Q[k][0] + nx * (r + 0.045), Y + 0.04, Q[k][1] + nz * (r + 0.045)); if (q) { const o = (q - 1) * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); rails.push(g);
  }
  // Kollision: Fahrbahn und Brüstungen als Quader je Wegstück (ca. 6 m)
  for (let q = 0; q < n; q += 4) {
    const a = P[q], b = P[Math.min(n, q + 4) % n], x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), z0 = Math.min(a[1], b[1]), z1 = Math.max(a[1], b[1]);
    addCollider(x0 - HW, Y - 1.1, z0 - HW, x1 + HW, Y - 0.05, z1 + HW);
  }
  // Pfeiler in der Straßenmitte, nicht in Kreuzungen
  const nearNode = (x, z) => AV.some(av => Math.abs(av.x - x) < 15) && ST.some(s => Math.abs(s.z - z) < 13);
  let acc = 0;
  for (let k = 1; k < n; k++) {
    acc += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]);
    if (acc < 24 || cen.O[k].arc) continue;
    const [x, z] = P[k]; if (nearNode(x, z)) continue;
    acc = 0; pil.push([x, z, cen.O[k].ax ? 0 : Math.PI / 2]);
    for (const sd of [-1, 1]) { const axX = cen.O[k].ax === 1; addGlow(x + (axX ? 0 : sd * (HW + 0.2)), Y + 1.6, z + (axX ? sd * (HW + 0.2) : 0), [1.25, 0.86, 0.48], 1.2); }
  }
  // Bahnhöfe
  for (const st of line.stations) for (const tr of line.tracks) {
    const pr = bhProject(tr, st.x, st.z), q = bhAt(tr, pr.s), tx = q[2], tz = q[3], nx = -tz, nz = tx, axX = Math.abs(tx) > 0.5;
    const cq = bhAt({ P, cum: line.cumC, len: line.lenC }, bhProject({ P, cum: line.cumC }, st.x, st.z).s), lat0 = (q[0] - cq[0]) * nx + (q[1] - cq[1]) * nz;   // Gleis rechts der Mitte (≈1,6)
    const W = (al, la) => [cq[0] + tx * al + nx * la, cq[1] + tz * al + nz * la];
    const ry = Math.atan2(-tz, tx), rot = g => g.rotateY(ry);
    const put = (g, al, la, y, c, list = paint) => { const [x, z] = W(al, la); list.push([rot(g).translate(x, y, z), c]); };
    const box = (al0, al1, la0, la1, y0, y1) => { const A = W(al0, la0), B = W(al1, la1); addCollider(Math.min(A[0], B[0]), y0, Math.min(A[1], B[1]), Math.max(A[0], B[0]), y1, Math.max(A[1], B[1])); };
    const PL0 = HW, PL1 = 6.0, curb = bhStreetHalf(axX), SL0 = curb + 1.0, SL1 = curb + 3.0;
    const side = { tr, s: (pr.s + (BH_CARL / 2)) % tr.len, x: q[0], z: q[1], tx, tz, nx, nz, lc: PL0 - lat0, y: BH_PLAT, hoch: true, st, lat0 };
    st.sides.push(side); tr.stops.push(side);
    // Bahnsteig: Terrazzo mit Goldkante
    put(new T.BoxGeometry(30, 1.6, PL1 - PL0), 0, (PL0 + PL1) / 2, BH_PLAT - 0.8, [0.42, 0.38, 0.33]);
    put(new T.BoxGeometry(30, 0.04, 0.25), 0, PL0 + 0.13, BH_PLAT + 0.01, gold, lit);
    box(-15, 15, PL0, PL1, BH_PLAT - 1.6, BH_PLAT);
    // Dach auf Säulen
    for (let al = -12; al <= 12; al += 6) { put(new T.CylinderGeometry(0.09, 0.11, 3.0, 10), al, PL1 - 0.45, BH_PLAT + 1.5, gold); box(al - 0.15, al + 0.15, PL1 - 0.6, PL1 - 0.3, BH_PLAT, BH_PLAT + 3); }
    put(new T.BoxGeometry(31, 0.22, PL1 - PL0 + 0.6), 0, (PL0 + PL1) / 2 - 0.1, BH_PLAT + 3.1, [0.04, 0.17, 0.18]);
    put(new T.BoxGeometry(31.1, 0.1, 0.12), 0, PL0 - 0.35, BH_PLAT + 3.0, gold); put(new T.BoxGeometry(31.1, 0.1, 0.12), 0, PL1 + 0.25, BH_PLAT + 3.0, gold);
    for (let f = -3; f <= 3; f++) put(new T.BoxGeometry(0.08, 0.7 - Math.abs(f) * 0.08, 0.1), f * 0.5, PL1 + 0.25, BH_PLAT + 3.55 - Math.abs(f) * 0.04, gold);
    for (let al = -12; al <= 12; al += 6) { put(new T.SphereGeometry(0.12, 10, 8), al + 3, (PL0 + PL1) / 2, BH_PLAT + 2.85, [1.6, 1.25, 0.75], lit); const [x, z] = W(al + 3, (PL0 + PL1) / 2); addGlow(x, BH_PLAT + 2.7, z, [1.3, 0.92, 0.5], 1.8); }
    // Geländer an der Rückseite (Lücke am Treppenaufgang)
    const up = bhStairSide(st, side, W);   // +1: Treppe in Fahrtrichtung, -1 dagegen
    const gap0 = up > 0 ? 9.6 : -13.4, gap1 = up > 0 ? 13.4 : -9.6;
    for (const [a0, a1] of [[-15, gap0], [gap1, 15]]) { if (a1 - a0 < 0.2) continue; put(new T.BoxGeometry(a1 - a0, 1.0, 0.06), (a0 + a1) / 2, PL1 - 0.03, BH_PLAT + 0.5, steel); put(new T.BoxGeometry(a1 - a0, 0.06, 0.12), (a0 + a1) / 2, PL1 - 0.03, BH_PLAT + 1.02, gold); box(a0, a1, PL1 - 0.1, PL1 + 0.05, BH_PLAT, BH_PLAT + 1.05); }
    for (const al of [-15, 15]) { put(new T.BoxGeometry(0.06, 1.0, PL1 - PL0), al, (PL0 + PL1) / 2, BH_PLAT + 0.5, steel); box(al - 0.05, al + 0.05, PL0, PL1, BH_PLAT, BH_PLAT + 1.05); }
    // Bänke
    for (const al of [-7.5, 1.5]) { put(new T.BoxGeometry(2.6, 0.08, 0.45), al, PL1 - 0.6, BH_PLAT + 0.46, [0.35, 0.2, 0.1]); put(new T.BoxGeometry(2.6, 0.4, 0.06), al, PL1 - 0.38, BH_PLAT + 0.72, [0.35, 0.2, 0.1]); box(al - 1.3, al + 1.3, PL1 - 0.85, PL1 - 0.35, BH_PLAT, BH_PLAT + 0.5); }
    // Treppenpodest über Fahrspur und Bordstein, dann die Treppe auf dem Gehweg hinunter
    const A0 = up > 0 ? 9.6 : -13.4, A1 = up > 0 ? 13.4 : -9.6;
    put(new T.BoxGeometry(A1 - A0, 0.5, SL1 - PL1), (A0 + A1) / 2, (PL1 + SL1) / 2, BH_PLAT - 0.25, [0.42, 0.38, 0.33]);
    box(A0, A1, PL1, SL1, BH_PLAT - 0.5, BH_PLAT);
    put(new T.BoxGeometry(A1 - A0, 1.0, 0.06), (A0 + A1) / 2, SL1 + 0.03, BH_PLAT + 0.5, steel); box(A0, A1, SL1, SL1 + 0.1, BH_PLAT, BH_PLAT + 1.05);
    put(new T.BoxGeometry(A1 - A0, 0.06, 0.12), (A0 + A1) / 2, SL1 + 0.03, BH_PLAT + 1.02, gold);
    const N = 36, rise = (BH_PLAT - 0.22) / N, run = 0.3, a0 = up > 0 ? A1 : A0, dir = up;
    for (let k = 0; k < N; k++) {
      const top = BH_PLAT - (k + 1) * rise, s0 = a0 + dir * k * run, s1 = a0 + dir * (k + 1) * run;
      put(new T.BoxGeometry(run + 0.02, Math.max(0.08, rise), SL1 - SL0), (s0 + s1) / 2, (SL0 + SL1) / 2, top - Math.max(0.08, rise) / 2, [0.4, 0.36, 0.31]);
      box(Math.min(s0, s1), Math.max(s0, s1), SL0, SL1, 0, top);
    }
    const len = N * run, slope = Math.atan2(BH_PLAT - 0.22, len), mid = a0 + dir * len / 2;
    for (const la of [SL0 - 0.06, SL1 + 0.06]) {
      const g = new T.BoxGeometry(len / Math.cos(slope) + 0.3, 0.35, 0.08).rotateZ(-dir * slope); put(g, mid, la, (BH_PLAT + 0.22) / 2, steel);
      const h = new T.BoxGeometry(len / Math.cos(slope) + 0.3, 0.06, 0.1).rotateZ(-dir * slope); put(h, mid, la, (BH_PLAT + 0.22) / 2 + 0.95, gold);
    }
    { const A = W(a0, SL0), B = W(a0 + dir * len, SL1); BAHN.keepOut.push({ x: (A[0] + B[0]) / 2, z: (A[1] + B[1]) / 2, r: len / 2 + 1 }); }
    // Schilder unter dem Dach (zum Gleis) und Fahrplan am Podest
    const [sx, sz] = W(-4.5, PL0 + 0.6);
    signs.push({ kind: 'name', text: st.n.toUpperCase(), sub: 'HOCHBAHN · ' + line.title.toUpperCase(), col: line.col, x: sx, y: BH_PLAT + 2.45, z: sz, ry: ry + Math.PI, w: 4.6, h: 0.48, both: true });
    const [fx, fz] = W(-4.5, PL1 - 0.1);
    signs.push({ kind: 'plan', line, st, x: fx, y: BH_PLAT + 1.6, z: fz, ry: ry + Math.PI, w: 0.75, h: 1.0 });
    side.wait = [];
    for (let i = 0; i < 6; i++) { const al = -10 + i * 3.6, sit = i === 1 || i === 4; const [x, z] = sit ? W(i === 1 ? -7.8 : 1.2, PL1 - 0.62) : W(al, PL0 + 1.0 + (i % 2) * 0.6); side.wait.push({ x, z, y: BH_PLAT, sit, yaw: Math.atan2(-nx, -nz) }); }
    side.door = (al) => W(al, lat0);
    side.stair = { foot: W(a0 + dir * (len + 0.8), (SL0 + SL1) / 2), top: W(a0 - dir * 0.8, (SL0 + SL1) / 2), plat: W((A0 + A1) / 2, (PL0 + PL1) / 2) };
  }
}
// Stadtmobiliar (Bänke, Litfaßsäulen, Kioske) an Haltestellen und Treppen wegräumen, samt Kollision;
// die losen Dinge (clutter.js, später geplant) meiden BAHN.keepOut selbst
function bhClearFurniture() {
  const F = STREET.furniture; if (!F) return;
  for (const k in F.out) {
    const a = F.out[k];
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i]; if (!BAHN.keepOut.some(o => (o.x - p.x) ** 2 + (o.z - p.z) ** 2 < (o.r + 1) ** 2)) continue;
      const r = k === 'column' || k === 'kiosk' ? 1.0 : k === 'bench' ? 0.9 : 0.25;
      removeColliders(p.x - r, p.z - r, p.x + r, p.z + r, 0, 0.3); a.splice(i, 1);
    }
  }
}
// Treppe dorthin, wo keine Laterne steht
function bhStairSide(st, side, W) {
  const lamps = STREET.lamps || [];
  const bad = up => { const a0 = up > 0 ? 13.4 : -13.4; for (let k = 0; k < 12; k++) { const [x, z] = W(a0 + up * k, bhStreetHalf(Math.abs(side.tx) > 0.5) + 2); if (lamps.some(l => (l.x - x) ** 2 + (l.z - z) ** 2 < 2.2)) return true; } return false; };
  return bad(1) && !bad(-1) ? -1 : 1;
}

/* ---------- Schilder und Fahrpläne: ein Atlas, ein Netz ---------- */
function bhSigns(list) {
  if (!list.length) return;
  const RW = 1024, RH = 128, PW = 192, PH = 256, nn = list.filter(s => s.kind === 'name').length, np = list.length - nn;
  const cols = Math.floor(RW / PW), rowsP = Math.ceil(np / cols), H = Math.min(4096, nn * RH + rowsP * PH);
  let iN = 0, iP = 0;
  const tex = canvasTex(RW, H, g => {
    for (const s of list) {
      if (s.kind === 'name') {
        const y = iN++ * RH; s.uv = [0, y / H, 1, (y + RH) / H];
        g.fillStyle = '#0a1418'; g.fillRect(0, y, RW, RH);
        g.strokeStyle = '#d9b26a'; g.lineWidth = 5; g.strokeRect(8, y + 8, RW - 16, RH - 16); g.lineWidth = 1.5; g.strokeRect(18, y + 18, RW - 36, RH - 36);
        g.fillStyle = s.col; g.beginPath(); g.arc(64, y + RH / 2, 30, 0, 6.283); g.fill();
        g.fillStyle = '#0a1418'; g.font = '700 34px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.sub.startsWith('HOCHBAHN') ? 'H' : s.sub.slice(6, 7), 64, y + RH / 2 + 2);
        g.fillStyle = '#fff3dc'; g.font = '56px Limelight, Georgia, serif'; g.textAlign = 'left';
        let fs = 56; while (g.measureText(s.text).width > RW - 150 && fs > 26) { fs -= 2; g.font = fs + 'px Limelight, Georgia, serif'; }
        g.fillText(s.text, 112, y + 52);
        g.fillStyle = '#d9b26a'; g.font = '600 20px Georgia, serif'; g.fillText(s.sub, 114, y + 98);
      } else {
        const c = iP % cols, r = Math.floor(iP / cols); iP++;
        const x = c * PW, y = nn * RH + r * PH; s.uv = [x / RW, y / H, (x + PW) / RW, (y + PH) / H];
        g.fillStyle = '#efe3c4'; g.fillRect(x, y, PW, PH); g.strokeStyle = '#7a5a26'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, PW - 8, PH - 8);
        g.fillStyle = '#123c3e'; g.fillRect(x + 10, y + 10, PW - 20, 40);
        g.fillStyle = '#f6dc9a'; g.font = '600 20px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.line.name.toUpperCase(), x + PW / 2, y + 31);
        g.fillStyle = '#1b1712'; g.font = '600 14px Georgia, serif'; g.textAlign = 'left';
        const sts = s.line.stations, i0 = sts.indexOf(s.st);
        for (let k = 0; k < sts.length; k++) { const o = sts[(i0 + k) % sts.length]; g.fillStyle = k === 0 ? '#8a5a12' : '#1b1712'; g.fillText((k === 0 ? '● ' : '○ ') + o.n.split(' · ')[0], x + 16, y + 70 + k * 21); }
        g.fillStyle = '#123c3e'; g.font = 'italic 13px Georgia, serif'; g.fillText(s.line.kind === 'hoch' ? 'Alle 4 Minuten · 1 Lumen' : 'Alle 3 Minuten · 1 Lumen', x + 16, y + PH - 22);
      }
    }
  });
  const pos = [], uv = [], idx = [];
  for (const s of list) {
    for (const face of s.both ? [0, 1] : [0]) {
      const ry = s.ry + (face ? Math.PI : 0), c = Math.cos(ry), sn = Math.sin(ry), hw = s.w / 2, hh = s.h / 2, o = pos.length / 3, push = (lx, ly) => pos.push(s.x + c * lx, s.y + ly, s.z - sn * lx);
      push(-hw, -hh); push(hw, -hh); push(hw, hh); push(-hw, hh);
      // etwas vor die Fläche, damit nichts flimmert
      const nx = Math.sin(ry) * 0.035, nz = Math.cos(ry) * 0.035; for (let k = 0; k < 4; k++) { pos[(o + k) * 3] += nx; pos[(o + k) * 3 + 2] += nz; }
      const [u0, v0, u1, v1] = s.uv;
      uv.push(u0, 1 - v1, u1, 1 - v1, u1, 1 - v0, u0, 1 - v0);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, color: new T.Color(1.15, 1.12, 1.05), side: T.DoubleSide })); m.frustumCulled = false; scene.add(m);
}

/* ---------- Wagen: fern als Instanzen, nah als begehbares Modell ---------- */
function bhHochGeos() {
  const B = IB, navy = [0.05, 0.08, 0.16], champ = [0.82, 0.74, 0.56], gold = COL.gold, roof = [0.14, 0.14, 0.16];
  const parts = [
    [B(13.2, 1.0, 2.3, 0, 0.95, 0), navy], [B(13.22, 0.12, 2.33, 0, 1.5, 0), gold], [B(13.2, 1.05, 2.24, 0, 2.1, 0), champ],
    [B(13.4, 0.22, 2.4, 0, 2.72, 0), roof], [B(9, 0.3, 1.4, 0, 2.97, 0), roof], [B(13.25, 0.06, 2.3, 0, 2.62, 0), gold],
  ];
  for (const sx of [-4.6, 4.6]) { parts.push([B(2.6, 0.5, 1.9, sx, 0.4, 0), COL.dark]); for (const w of [-0.75, 0.75]) for (const sz of [-0.72, 0.72]) parts.push([new T.CylinderGeometry(0.36, 0.36, 0.12, 12).rotateX(Math.PI / 2).translate(sx + w, 0.36, sz), COL.tyre]); }
  const win = [];
  for (let k = -5; k <= 5; k++) for (const sz of [-1, 1]) win.push(B(0.86, 0.72, 0.03, k * 1.1, 2.12, sz * 1.125));
  for (const sx of [-1, 1]) win.push(B(0.03, 0.7, 1.6, sx * 6.61, 2.12, 0));
  return { body: mergeColored(parts), win: mergeGeos(win) };
}
function bhVehicles() {
  for (const line of BAHN.lines) for (const tr of line.tracks) {
    tr.stops.sort((a, b) => a.s - b.s);
    if (line.kind === 'tram') for (const nd of TRF.lights) {
      const pr = bhProject(tr, nd.x, nd.z); if (pr.d > 11) continue;
      const q = bhAt(tr, pr.s - 16), axis = Math.abs(q[2]) > Math.abs(q[3]) ? 0 : 1;
      tr.lights.push({ s: pr.s - (axis === 0 ? 13 : 9.5), nd, axis });
    }
    const n = MOBILE ? Math.max(1, line.n - 1) : line.n;
    for (let k = 0; k < n; k++) {
      const v = { id: BAHN.veh.length, line, tr, s: (k / n) * tr.len + R() * 25, v: 0, st: 'run', dwell: 0, door: 0, next: 0, pax: 3 + Math.floor(R() * 6), cars: [], kind: line.kind, ncar: line.cars || 1, held: 0, out: 0 };
      v.next = bhNextStop(v);
      for (let c = 0; c < v.ncar; c++) { const car = { veh: v, k: c, kind: line.kind, x: 0, y: tr.y, z: 0, ry: 0, det: null, i: BAHN.cars.filter(q => q.kind === line.kind).length }; v.cars.push(car); BAHN.cars.push(car); }
      BAHN.veh.push(v);
    }
  }
  const nT = BAHN.cars.filter(c => c.kind === 'tram').length, nH = BAHN.cars.length - nT;
  const winM = new T.MeshBasicMaterial({ color: new T.Color(1.25, 0.86, 0.48) });
  const g = tramGeos(), h = bhHochGeos(), bodyM = paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.35, envI: 0.8 });
  BAHN.im = { tram: [new T.InstancedMesh(g.body, bodyM, nT), new T.InstancedMesh(g.win, winM, nT)], hoch: [new T.InstancedMesh(h.body, bodyM, Math.max(1, nH)), new T.InstancedMesh(h.win, winM, Math.max(1, nH))] };
  for (const k in BAHN.im) for (const im of BAHN.im[k]) { im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; scene.add(im); }
  const pts = [];
  for (const c of BAHN.cars) pts.push({ p: [0, -50, 0], c: [1.4, 1.3, 1.0], s: 1.3, ph: 0, bl: 0 }, { p: [0, -50, 0], c: [1.4, 0.15, 0.08], s: 0.8, ph: 0, bl: 0 }, c.kind === 'tram' ? { p: [0, -50, 0], c: [0.4, 1.2, 1.3], s: 0.9, ph: R(), bl: 1 } : { p: [0, -50, 0], c: [1.3, 0.95, 0.55], s: 0.7, ph: 0, bl: 0 });
  BAHN.glow = makeGlowPoints(pts, true); scene.add(BAHN.glow);
}
function bhNextStop(v) {
  const S = v.tr.stops, L = v.tr.len; let bi = 0, bd = 1e9;
  S.forEach((st, i) => { const d = (st.s - v.s + L) % L; if (d > 0.5 && d < bd) { bd = d; bi = i; } });
  return bi;
}
// begehbares Modell: Hülle (beleuchtet von der Szene) und Innenraum (warm, selbstleuchtend), Quader für Boden, Wände, Bänke, Dach
function bhDetail(kind) {
  const B = IB, hoch = kind === 'hoch', HL = 6.6, FY = BH_FY;
  const lo = hoch ? [0.05, 0.08, 0.16] : [0.03, 0.2, 0.21], hi = hoch ? [0.82, 0.74, 0.56] : [0.8, 0.73, 0.58], gold = COL.gold, roof = [0.15, 0.15, 0.17];
  const lk = 1.0, L = c => c.map(v => v * lk);
  const wood = L([0.42, 0.24, 0.12]), floor = L([0.3, 0.17, 0.09]), velvet = L([0.55, 0.08, 0.1]), cream = L([0.98, 0.9, 0.72]), brass = L([1.1, 0.82, 0.42]), mah = L([0.36, 0.18, 0.09]);
  const sh = [], li = [], boxes = [];
  const D = [-3.9, 3.9], DW = 1.1;   // Türen rechts (+z)
  const inDoor = x => D.some(d => Math.abs(x - d) < DW / 2);
  const bx = (x0, y0, z0, x1, y1, z1) => boxes.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1) });
  // Fahrwerk und Boden
  sh.push([B(2 * HL, 0.3, 2.2, 0, FY - 0.15, 0), COL.dark]);
  for (const sx of hoch ? [-4.6, 4.6] : [-4.2, 4.2]) { sh.push([B(2.6, 0.4, 1.9, sx, 0.35, 0), COL.dark]); for (const w of [-0.75, 0.75]) for (const sz of [-0.72, 0.72]) sh.push([new T.CylinderGeometry(0.36, 0.36, 0.12, 12).rotateX(Math.PI / 2).translate(sx + w, 0.36, sz), COL.tyre]); }
  li.push([B(2 * HL - 0.1, 0.02, 2.16, 0, FY + 0.01, 0), floor]);
  bx(-HL, 0.0, -1.15, HL, FY, 1.15);
  for (const d of D) { sh.push([B(DW, 0.08, 0.36, d, 0.34, 1.32), gold]); bx(d - DW / 2, 0, 1.15, d + DW / 2, 0.36, 1.5); }
  // Seitenwände: außen Lack, innen Holz; rechts mit Türöffnungen
  for (const sd of [-1, 1]) {
    const zo = sd * 1.13, zi = sd * 1.09;
    const runs = sd > 0 ? [[-HL, D[0] - DW / 2], [D[0] + DW / 2, D[1] - DW / 2], [D[1] + DW / 2, HL]] : [[-HL, HL]];
    for (const [a, b] of runs) {
      const m = (a + b) / 2, w = b - a;
      sh.push([B(w, 0.8, 0.04, m, FY + 0.38, zo), lo]); sh.push([B(w + 0.01, 0.09, 0.05, m, FY + 0.8, zo), gold]);
      li.push([B(w, 0.8, 0.02, m, FY + 0.4, zi), mah]);
      bx(a, FY, sd > 0 ? 1.07 : -1.2, b, 2.62, sd > 0 ? 1.2 : -1.07);
    }
    // Fensterpfosten
    for (let x = -HL + 0.12; x <= HL - 0.1; x += 1.1) { if (sd > 0 && (inDoor(x) || inDoor(x + 0.12) || inDoor(x - 0.12))) continue; sh.push([B(0.22, 0.95, 0.04, x, FY + 1.27, zo), hi]); li.push([B(0.2, 0.95, 0.02, x, FY + 1.27, zi), mah]); }
    sh.push([B(2 * HL, 0.42, 0.04, 0, FY + 1.95, zo), hi]); li.push([B(2 * HL, 0.42, 0.02, 0, FY + 1.95, zi), cream]);
    sh.push([B(2 * HL + 0.01, 0.05, 0.05, 0, FY + 1.74, zo), gold]);
  }
  // Stirnseiten mit Fenstern
  for (const sx of [-1, 1]) {
    const xo = sx * (HL + 0.02);
    sh.push([B(0.04, 0.8, 2.3, xo, FY + 0.38, 0), lo]); sh.push([B(0.05, 0.42, 2.3, xo, FY + 1.95, 0), hi]);
    for (const z of [-1.05, 0, 1.05]) sh.push([B(0.04, 0.95, 0.2, xo, FY + 1.27, z), hi]);
    sh.push([new T.SphereGeometry(0.16, 10, 8).translate(xo + sx * 0.05, FY + 0.55, 0), sx > 0 ? [1.7, 1.55, 1.2] : [1.4, 0.15, 0.08]]);
    bx(sx * HL - 0.06, FY, -1.15, sx * HL + 0.06, 2.62, 1.15);
  }
  // Dach, Laternendach, beim Straßenbahnwagen der Stromabnehmer
  sh.push([B(2 * HL + 0.3, 0.14, 2.46, 0, FY + 2.24, 0), roof]); sh.push([B(9, 0.28, 1.3, 0, FY + 2.45, 0), roof]); sh.push([B(2 * HL + 0.32, 0.05, 2.48, 0, FY + 2.16, 0), gold]);
  bx(-HL - 0.1, FY + 2.0, -1.25, HL + 0.1, FY + 2.6, 1.25);
  if (!hoch) { for (const sz of [-0.5, 0.5]) { sh.push([B(0.06, 1.7, 0.06, -0.5, FY + 3.2, sz).rotateZ(0.5), COL.dark]); sh.push([B(0.06, 1.7, 0.06, 0.5, FY + 3.2, sz).rotateZ(-0.5), COL.dark]); } sh.push([B(0.1, 0.06, 1.6, 0, 4.75, 0), COL.chrome]); }
  li.push([B(2 * HL - 0.1, 0.02, 2.16, 0, FY + 1.92, 0), cream]);
  // Bänke längs der Wände, Haltestangen, Lampen
  const seats = [];
  const bench = (x0, x1, sd) => {
    const m = (x0 + x1) / 2, w = x1 - x0, z = sd * 0.86;
    li.push([B(w, 0.09, 0.46, m, FY + 0.44, z), velvet]); li.push([B(w, 0.46, 0.08, m, FY + 0.74, sd * 1.05), velvet]); li.push([B(w, 0.4, 0.04, m, FY + 0.2, sd * 0.63), wood]);
    li.push([B(w + 0.02, 0.05, 0.05, m, FY + 1.0, sd * 1.06), brass]);
    bx(x0, FY, sd > 0 ? 0.62 : -1.1, x1, FY + 0.46, sd > 0 ? 1.1 : -0.62);
    for (let x = x0 + 0.33; x < x1 - 0.2; x += 0.62) seats.push({ lx: x, lz: sd * 0.82, f: -sd });
  };
  bench(-5.5, 5.5, -1);
  bench(D[0] + DW / 2 + 0.25, D[1] - DW / 2 - 0.25, 1);
  bench(D[1] + DW / 2 + 0.2, 5.5, 1); bench(-5.5, D[0] - DW / 2 - 0.2, 1);
  for (const x of [D[0] - DW / 2 - 0.05, D[0] + DW / 2 + 0.05, D[1] - DW / 2 - 0.05, D[1] + DW / 2 + 0.05, 0]) li.push([new T.CylinderGeometry(0.025, 0.025, 1.9, 6).translate(x, FY + 0.95, x === 0 ? 0 : 0.96), brass]);
  for (const sz of [-0.45, 0.45]) li.push([B(2 * HL - 1.6, 0.03, 0.03, 0, FY + 1.75, sz), brass]);
  for (let x = -4.8; x <= 4.8; x += 2.4) li.push([new T.SphereGeometry(0.09, 10, 8).translate(x, FY + 1.84, 0), [2.2, 1.75, 1.05]]);
  // Führerstand vorn
  li.push([B(0.04, 1.1, 2.1, 5.62, FY + 0.55, 0), mah]); li.push([B(0.32, 0.95, 0.32, 6.2, FY + 0.48, -0.45), L([0.2, 0.18, 0.16])]); li.push([new T.CylinderGeometry(0.15, 0.15, 0.05, 14).translate(6.2, FY + 0.98, -0.45), brass]);
  bx(5.58, FY, -1.1, 5.66, FY + 1.1, 0.55);
  const grp = new T.Group();
  const ms = new T.Mesh(mergeColored(sh), BAHN.shellM || (BAHN.shellM = paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.4, envI: 0.8 })));
  const mi = new T.Mesh(mergeColored(li), BAHN.inM || (BAHN.inM = new T.MeshBasicMaterial({ vertexColors: true })));
  grp.add(ms, mi); grp.visible = false; scene.add(grp);
  for (const m of [ms, mi]) m.frustumCulled = false;
  const det = { kind, g: grp, boxes, seats, doors: D, car: null, snap: false };
  // V71: solange der Wagen keinem Zug gehört, ist er aus. Vorher stand er unsichtbar am Ursprung, mitten in der Belmont-Lobby vor dem
  // Ballsaaltor (unsichtbare Wand), oder dort, wo er zuletzt war (Geisterwagen auf der Straße)
  det.pf = addPlatform(grp, boxes, 8, { ylo: -1, yhi: 4, off: true });
  return det;
}
function bhDetails() {
  const nT = MOBILE ? 2 : 3, nH = MOBILE ? 2 : 3;
  for (let i = 0; i < nT; i++) BAHN.pool.tram.push(bhDetail('tram'));
  for (let i = 0; i < nH; i++) BAHN.pool.hoch.push(bhDetail('hoch'));
  const all = [...BAHN.pool.tram, ...BAHN.pool.hoch];
  const leaf = mergeColored([[IB(0.54, 1.62, 0.04, 0, 0, 0), [0.04, 0.2, 0.21]], [IB(0.42, 0.7, 0.045, 0, 0.35, 0), [0.9, 0.82, 0.62]], [IB(0.56, 0.05, 0.05, 0, -0.1, 0), COL.gold]]);
  BAHN.doorIm = new T.InstancedMesh(leaf, paintMat({ color: 0xffffff, metalness: 0.4, roughness: 0.4, envI: 0.7 }), all.length * 4);
  BAHN.doorIm.instanceMatrix.setUsage(T.DynamicDrawUsage); BAHN.doorIm.frustumCulled = false; BAHN.doorIm.count = 0; scene.add(BAHN.doorIm);
}

/* ---------- Fahren ---------- */
const _bm = new T.Matrix4(), _bq = new T.Quaternion(), _bp = new T.Vector3(), _bs = new T.Vector3(1, 1, 1), _bu = new T.Vector3(0, 1, 0), _bl = new T.Matrix4(), _bz = new T.Matrix4().makeScale(0, 0, 0);
const BH_HALF = 7.2;
function bhLeader(v) {
  const L = v.tr.len; let g = 1e9;
  for (const o of BAHN.veh) { if (o === v || o.tr !== v.tr) continue; const rear = o.s - (o.ncar - 1) * BH_CARL - BH_HALF, d = ((rear - (v.s + BH_HALF)) % L + L) % L; if (d < g) g = d; }
  return g;
}
function bhMove(v, dt) {
  const tr = v.tr, L = tr.len;
  if (v.st === 'halt') {
    v.dwell -= dt;
    if (KT.bahnStill) v.dwell = Math.max(v.dwell, 4);   // V76: Bahnerstreik, die Wagen bleiben mit offenen Türen an den Haltestellen
    if (v.dwell > 1.8) v.door = Math.min(1, v.door + dt / 1.3); else v.door = Math.max(0, v.door - dt / 1.3);
    // Tür aufhalten, solange Alexander in der Tür steht
    if (v.dwell < 2.4 && v.held < 8 && bhInDoor(v, player.p)) { v.dwell += dt; v.held += dt; }
    bhExchange(v, dt);
    if (v.dwell <= 0 && v.door <= 0) { v.st = 'run'; const from = tr.stops[v.next]; v.next = (v.next + 1) % tr.stops.length; bhDepart(v, from); }
    v.v = 0; return;
  }
  let vt = Math.min(bhVlim(tr, v.s + 4), bhVlim(tr, v.s + 16) + 1.6, bhVlim(tr, v.s + 30) + 3.2, bhVlim(tr, v.s - (v.ncar - 1) * BH_CARL));
  const stp = tr.stops[v.next], dS = ((stp.s - v.s) % L + L) % L;
  const brake = (d, b = 1.15) => Math.sqrt(2 * b * Math.max(0, d));
  if (dS < L - 5) vt = Math.min(vt, brake(dS) + (dS > 0.3 ? 0.35 : 0));
  if (dS < 0.3 || dS > L - 1) { v.st = 'halt'; v.dwell = 9 + R() * 4 + (v.line.kind === 'hoch' ? 2 : 0); v.held = 0; v.v = 0; v.s = stp.s; bhArrive(v, stp); return; }
  vt = Math.min(vt, brake(bhLeader(v) - 3.5, 1.8));
  if (tr.lights.length) {
    const fr = v.s + BH_HALF;
    for (const lt of tr.lights) {
      const d = ((lt.s - fr) % L + L) % L; if (d > 55) continue;
      if (!lightGreen(lt.nd, lt.axis, TRF.t) && !(lightAmber(lt.nd, lt.axis, TRF.t) && d < v.v * 1.3)) vt = Math.min(vt, brake(d - 0.5, 1.8));
    }
  }
  if (v.kind === 'tram') {
    // Autos und Alexander vor dem Wagen
    const c0 = v.cars[0], hx = Math.cos(c0.ry), hz = -Math.sin(c0.ry);
    let gap = 1e9;
    for (const c of TRF.cars) {
      if (c.gone) continue; const cx = c.dyn ? c.dyn.x : c.wx, cz = c.dyn ? c.dyn.z : c.wz; if (cx === undefined) continue;
      const rx = cx - c0.x, rz = cz - c0.z; if (rx * rx + rz * rz > 1600) continue;
      const al = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx); if (al > 0 && lat < 1.9) gap = Math.min(gap, al - BH_HALF - 2.6);
    }
    if (DRIVE.on && DRIVE.body) { const B = DRIVE.body, rx = B.x - c0.x, rz = B.z - c0.z, al = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx); if (al > 0 && al < 40 && lat < 2) gap = Math.min(gap, al - BH_HALF - 2.6); }
    if (playing && !player.fly && player.on !== (c0.det && c0.det.pf) && player.p.y < 2) {
      const rx = player.p.x - c0.x, rz = player.p.z - c0.z, al = rx * hx + rz * hz, lat = Math.abs(rx * hz - rz * hx);
      if (al > 0 && al < 28 && lat < 1.7) { gap = Math.min(gap, al - BH_HALF - 0.8); if ((BAHN.bellT -= dt) < 0 && al < 22) { BAHN.bellT = 4; try { tramBell(0.9); } catch (e) { /* ohne Ton */ } } }
    }
    if (gap < 1e8) vt = Math.min(vt, brake(gap - 1.5, 2.2));
  }
  if (v.wlMul) vt *= v.wlMul;   // V63 Wetter (wetterlage.js): Schneesturm bremst, Schneewehe hält fest
  if (v.wlStuck) vt = 0;
  v.v += Math.max(-2.6 * dt, Math.min(1.0 * dt, vt - v.v)); if (v.v < 0) v.v = 0;
  v.s = (v.s + v.v * dt) % L;
}
function bhPose(v) {
  const tr = v.tr, ax = v.kind === 'hoch' ? 4.6 : 4.2;
  for (const c of v.cars) {
    const sc = v.s - c.k * BH_CARL, f = bhAt(tr, sc + ax), b = bhAt(tr, sc - ax);
    c.x = (f[0] + b[0]) / 2; c.z = (f[1] + b[1]) / 2; c.ry = Math.atan2(-(f[1] - b[1]), f[0] - b[0]); c.y = tr.y;
  }
}
function bhAssign() {
  const cp = camera.position, d2 = c => (c.x - cp.x) ** 2 + (c.y - cp.y) ** 2 + (c.z - cp.z) ** 2;
  for (const kind of ['tram', 'hoch']) {
    const pool = BAHN.pool[kind];
    for (const d of pool) if (d.car && d2(d.car) > 80 * 80 && player.on !== d.pf && !(BAHN.sit && BAHN.sit.det === d)) { d.car.det = null; d.car = null; d.g.visible = false; d.pf.off = true; }
    let cand = null;
    for (const d of pool) {
      if (d.car) continue;
      cand = cand || BAHN.cars.filter(c => c.kind === kind && !c.det && d2(c) < 62 * 62).sort((a, b) => d2(a) - d2(b));
      const c = cand.shift(); if (!c) break;
      d.car = c; c.det = d; d.g.visible = true; d.snap = true; d.pf.off = false;
    }
  }
}
export function updateBahn(dt) {
  if (!BAHN.built) return;
  BAHN.t += dt;
  for (const k in BAHN.pool) for (const d of BAHN.pool[k]) pfSave(d.pf);
  if (!paused || !playing) for (const v of BAHN.veh) bhMove(v, dt);
  for (const v of BAHN.veh) bhPose(v);
  bhAssign();
  // Darstellung
  const pos = BAHN.glow.geometry.attributes.position.array;
  let nd = 0;
  BAHN.cars.forEach((c, j) => {
    const [body, win] = BAHN.im[c.kind];
    if (c.det) { body.setMatrixAt(c.i, _bz); win.setMatrixAt(c.i, _bz); const d = c.det;
      d.g.position.set(c.x, c.y, c.z); d.g.rotation.y = c.ry; d.g.updateMatrix(); d.g.updateMatrixWorld(true);
      pfRead(d.pf); if (d.snap) { pfSave(d.pf); d.snap = false; }
      const op = c.veh.door;
      for (const dc of d.doors) for (const sg of [-1, 1]) { _bl.makeTranslation(dc + sg * (0.28 + op * 0.5), BH_FY + 0.82, 1.17); BAHN.doorIm.setMatrixAt(nd++, _bm.multiplyMatrices(d.g.matrix, _bl)); }
    } else {
      _bq.setFromAxisAngle(_bu, c.ry); _bp.set(c.x, c.y, c.z); _bm.compose(_bp, _bq, _bs); body.setMatrixAt(c.i, _bm); win.setMatrixAt(c.i, _bm);
    }
    const fx = Math.cos(c.ry), fz = -Math.sin(c.ry), o = j * 9, head = c.k === 0, tail = c.k === c.veh.ncar - 1;
    pos[o] = head ? c.x + fx * 7.0 : 0; pos[o + 1] = head ? c.y + 1.1 : -60; pos[o + 2] = head ? c.z + fz * 7.0 : 0;
    pos[o + 3] = tail ? c.x - fx * 7.0 : 0; pos[o + 4] = tail ? c.y + 1.1 : -60; pos[o + 5] = tail ? c.z - fz * 7.0 : 0;
    pos[o + 6] = c.x; pos[o + 7] = c.y + (c.kind === 'tram' ? 5.75 : 3.25); pos[o + 8] = c.z;
  });
  BAHN.doorIm.count = nd; BAHN.doorIm.instanceMatrix.needsUpdate = true;
  for (const k in BAHN.im) for (const im of BAHN.im[k]) im.instanceMatrix.needsUpdate = true;
  BAHN.glow.geometry.attributes.position.needsUpdate = true;
  bhRideState(dt);
  bhCrowdUpdate(dt);
}
// Autos halten hinter der Straßenbahn (nach dem Zurücksetzen der Hindernisse in updateVehicles)
// V64: die eigenen Einträge des letzten Bildes erst entfernen. Im Startbild und in der Pause leert updateVehicles die Liste nicht;
// dort kamen vorher jedes Bild neue dazu (nach einer Minute im Menü über 20 000, der Verkehr prüfte jeden für jeden Wagen: 25 ms je Bild
// und mehr). Die Einträge werden wiederverwendet statt jedes Bild neu angelegt.
const BH_OB = [];
export function bahnObstacles() {
  if (!BAHN.built) return;
  if (BH_OB.length) { let w = 0; for (let i = 0; i < OBSTACLES.length; i++) { const o = OBSTACLES[i]; if (!o.bahn) OBSTACLES[w++] = o; } OBSTACLES.length = w; }
  let n = 0;
  for (const v of BAHN.veh) {
    if (v.kind !== 'tram') continue; const c = v.cars[0], fx = Math.cos(c.ry), fz = -Math.sin(c.ry);
    for (const k of [-4.6, 0, 4.6]) { const o = BH_OB[n] || (BH_OB[n] = { x: 0, z: 0, y: 0, r: 1.3, v: 0, bahn: true }); n++; o.x = c.x + fx * k; o.z = c.z + fz * k; o.v = v.v; OBSTACLES.push(o); }
  }
}

/* ---------- Türen, Halte, Ansagen ---------- */
// Türen eines Wagens in der Welt (Mitte der Öffnung, etwas außen)
function bhDoorWorld(c, dx, out = 0.9) { const cs = Math.cos(c.ry), sn = Math.sin(c.ry), lz = 1.15 + out; return [c.x + dx * cs + lz * sn, c.z - dx * sn + lz * cs]; }
function bhLocal(c, x, z) { const cs = Math.cos(c.ry), sn = Math.sin(c.ry), dx = x - c.x, dz = z - c.z; return [dx * cs - dz * sn, dx * sn + dz * cs]; }
function bhWorld(c, lx, lz) { const cs = Math.cos(c.ry), sn = Math.sin(c.ry); return [c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs]; }
function bhInDoor(v, p) {
  for (const c of v.cars) { if (Math.abs(p.y - (c.y + BH_FY)) > 1.6) continue; const [lx, lz] = bhLocal(c, p.x, p.z); if (lz > 0.5 && lz < 2.6 && [-3.9, 3.9].some(d => Math.abs(lx - d) < 0.9)) return true; }
  return false;
}
const bhSpeaker = v => v.kind === 'hoch' ? 'Der Zugführer' : 'Der Schaffner';
function bhChangeText(st) { if (!st.change.length) return ''; const L = st.change.map(n => n === 'Hochbahn' ? 'zur Hochbahn' : 'zur ' + n); return '. Umsteigen ' + L.join(' und '); }
function bhArrive(v, side) {
  side.st.t = 0;
  // ferne Halte: Fahrgäste tauschen sofort, nahe: bhExchange lässt sie gehen
  v.out = Math.min(v.pax, Math.floor(R() * 3.2));
  v.inQ = Math.floor(side.wc || 0);
  if (!v.cars.some(c => c.det)) { v.pax += v.inQ - v.out; side.wc = Math.max(0, (side.wc || 0) - v.inQ); v.out = 0; v.inQ = 0; }
  if (BAHN.ride === v) { lifeSay(bhSpeaker(v), side.st.n + '!' + (v.kind === 'hoch' ? ' Ausstieg rechts.' : ''), 3.2); try { tramBell(0.8); } catch (e) { /* ohne Ton */ } }
}
function bhDepart(v, from) {
  v.out = 0; v.inQ = 0;
  if (BAHN.ride === v) {
    const nx = v.tr.stops[v.next].st;
    setTimeout(() => { if (BAHN.ride === v) lifeSay(bhSpeaker(v), 'Nächster Halt: ' + nx.n + bhChangeText(nx) + '.', 4.5); }, 1600);
    try { tramBell(0.7); } catch (e) { /* ohne Ton */ }
    if (!BAHN.repDone && v.pax > 1 && RUF.ready) { BAHN.repDone = true; rufAdd({ buerger: 0.6, arbeiter: v.line.id === '2' ? 0.7 : 0.2, presse: 0.2 }, 'Mit den Bürgern ' + (v.kind === 'hoch' ? 'Hochbahn' : 'Straßenbahn') + ' gefahren', { key: 'bahn' }); }
  }
  void from;
}
function bhExchange(v, dt) {
  // ohne sichtbare Figuren: nach und nach umsteigen
  if (v.door < 0.9) return;
  v.xT = (v.xT || 0) - dt; if (v.xT > 0) return; v.xT = 0.9;
  if (v.cars.some(c => c.det)) return;   // nah: das machen die Figuren (bhCrowdUpdate)
  if (v.out > 0) { v.out--; v.pax = Math.max(0, v.pax - 1); }
  else if (v.inQ > 0) { v.inQ--; v.pax++; const sd = v.tr.stops[v.next]; sd.wc = Math.max(0, (sd.wc || 0) - 1); }
}

/* ---------- Mitfahren ---------- */
function bhDetOfPlayer() {
  if (BAHN.sit) return BAHN.sit.det;
  for (const k in BAHN.pool) for (const d of BAHN.pool[k]) if (d.car && player.on === d.pf) return d;
  // im Sprung (player.on ist dann leer) oder auf der Türstufe zählt der Wagenkasten selbst
  if (player.fly) return null;
  for (const k in BAHN.pool) for (const d of BAHN.pool[k]) {
    const c = d.car; if (!c) continue; const dy = player.p.y - (c.y + BH_FY); if (dy < -0.4 || dy > 2.2) continue;
    const [lx, lz] = bhLocal(c, player.p.x, player.p.z); if (Math.abs(lx) < 6.7 && Math.abs(lz) < 1.2) return d;
  }
  return null;
}
function bhRideState(dt) {
  const d = playing ? bhDetOfPlayer() : null, v = d ? d.car.veh : null;
  if (v !== BAHN.ride) {
    const was = BAHN.ride; BAHN.ride = v;
    if (v) bhBoarded(v);
    else {
      if (BAHN.cam === 'aussen') BAHN.cam = 'innen';
      if (was && player.fly && was.v > 2) lifeSay('Eine Dame', 'Er fliegt einfach aus der fahrenden Bahn!', 3);
      BAHN.repDone = false;
    }
  }
  if (v) BAHN.rideT = (BAHN.rideT || 0) + dt;
}
const BH_GREET = {
  '1': ['Herr Alexander! In der Straßenbahn? Wie bescheiden!', 'Guten Abend, Herr Alexander. Eine schöne Fahrt!', 'Sehen Sie nur, Alexander fährt mit uns!', 'Nehmen Sie doch meinen Platz, Herr Alexander!'],
  '2': ['Der Herr von Vespera bei uns in der Linie 2? Das glaubt mir keiner!', 'Abend, Herr Alexander. Die Linie 2 ist pünktlich wie nie.', 'Mit uns einfachen Leuten? Alle Achtung, Herr Alexander.', 'Fahren Sie ruhig mit, Herr Alexander. Für Sie ist der Fahrschein ja Kleingeld, für uns ein halbes Mittagessen.'],
  H: ['Von hier oben sieht man das Belmont leuchten, nicht wahr, Herr Alexander?', 'Die Hochbahn ist die schönste Aussicht der Stadt!', 'Herr Alexander! Darf ich Ihnen die Zeitung reichen?'],
};
function bhBoarded(v) {
  BAHN.rides++; BAHN.rideT = 0;
  const own = KT.ready && ktOwns('bahn');
  if (own) toast('Freifahrt · Ihre Vespera-Verkehrsbetriebe');
  else if (KT.ready && KT.s) { ktCash(-BAHN.fare, 'Fahrschein ' + v.line.name); toast('Fahrschein gelöst · ' + BAHN.fare + ' Lumen · ' + v.line.name + ' · ' + v.line.title); }
  else toast(v.line.name + ' · ' + v.line.title);
  const st = v.tr.stops[v.next].st;
  setTimeout(() => {
    if (BAHN.ride !== v) return;
    if (own && R() < 0.6) lifeSay(bhSpeaker(v), 'Der Herr Direktor persönlich! Alles pünktlich, Herr Alexander.', 4);
    else if (v.pax > 0) { const L = BH_GREET[v.line.id], who = v.line.id === '2' ? (R() < 0.5 ? 'Ein Arbeiter' : 'Eine Frau') : (R() < 0.5 ? 'Eine Dame' : 'Ein Herr'); lifeSay(who, L[Math.floor(R() * L.length)], 4); }
    else lifeSay(bhSpeaker(v), 'Guten Abend! Nächster Halt: ' + st.n + '.', 3.5);
    // Köpfe drehen sich zu Alexander
    for (const A of BAHN.ag) if (A.role === 'seat' && A.car && A.car.veh === v && A.a.on) turnHead(A.a, player.p.x, player.p.z);
  }, 900);
}
// freier Platz im Wagen nahe Alexander
function bhFreeSeat(d, p, r = 1.6) {
  const c = d.car; if (!c) return -1; const [lx, lz] = bhLocal(c, p.x, p.z); let bi = -1, bd = r * r;
  d.seats.forEach((s, i) => { if (d.taken && d.taken.has(i)) return; const dd = (s.lx - lx) ** 2 + (s.lz - lz) ** 2; if (dd < bd) { bd = dd; bi = i; } });
  return bi;
}
function bhSitDown(d, i) {
  BAHN.sit = { det: d, i };
  player.v.set(0, 0, 0);
  const s = d.seats[i], c = d.car; player.yaw = Math.atan2(-(s.f * Math.sin(c.ry)), -(s.f * Math.cos(c.ry)));   // Blick zur anderen Wagenseite
  toast('Platz genommen · E aufstehen · W losgehen · V Ansicht');
}
function bhStandUp(out) {
  const S = BAHN.sit; if (!S) return; BAHN.sit = null;
  const c = S.det.car, s = S.det.seats[S.i];
  if (c) { const [x, z] = bhWorld(c, s.lx, out ? 0.6 : s.lz * 0.2); player.p.set(x, c.y + BH_FY + 0.02, z); }
  player.v.set(0, 0, 0); player.on = S.det.pf;
}
export function bahnSeatInput(dt) {
  const S = BAHN.sit; if (!S) return;
  const c = S.det.car;
  if (!c || player.fly) { BAHN.sit = null; return; }
  const mv = keys.KeyW || keys.KeyS || keys.KeyA || keys.KeyD || keys.ArrowUp || keys.ArrowDown;
  if (mv) { bhStandUp(false); return; }
  const s = S.det.seats[S.i], [x, z] = bhWorld(c, s.lx, s.lz);
  player.p.set(x, c.y + BH_FY + 0.01, z); player.v.set(0, 0, 0); player.onGround = true; player.on = S.det.pf;
  void dt;
}
export function bahnSeatModel(dt) {
  const S = BAHN.sit; if (!S || !S.det.car) return;
  if (PM.view !== 'third' && BAHN.cam !== 'aussen') return;
  const c = S.det.car, s = S.det.seats[S.i], [x, z] = bhWorld(c, s.lx, s.lz), sc = PM.sc || 1;
  const yaw = Math.atan2(s.f * Math.sin(c.ry), s.f * Math.cos(c.ry));
  playerSitAt(x, c.y + BH_FY + 0.46 - 0.87 * sc, z, yaw, dt);
}
// Kamera: Außenansicht hinter dem Wagen, im Sitzen Augenhöhe oder von hinten
const _bc = new T.Vector3(), _bt = new T.Vector3();
export function bahnCamera(dt) {
  if (!BAHN.built || (!BAHN.ride && !BAHN.sit)) return false;
  const v = BAHN.ride || (BAHN.sit && BAHN.sit.det.car && BAHN.sit.det.car.veh); if (!v) return false;
  if (BAHN.cam === 'aussen') {
    const c = v.cars[0], fx = Math.cos(c.ry), fz = -Math.sin(c.ry), back = 14 + (v.ncar - 1) * BH_CARL;
    _bt.set(c.x - fx * (v.ncar - 1) * BH_CARL * 0.5, c.y + 2.2, c.z - fz * (v.ncar - 1) * BH_CARL * 0.5);
    _bc.set(c.x - fx * back - fz * 5, c.y + 8.5, c.z - fz * back + fx * 5);
    if (!BAHN.camInit) { camera.position.copy(_bc); BAHN.camInit = true; } else camera.position.lerp(_bc, Math.min(1, dt * 3));
    camera.lookAt(_bt); return true;
  }
  BAHN.camInit = false;
  if (!BAHN.sit) return false;
  const c = BAHN.sit.det.car, s = BAHN.sit.det.seats[BAHN.sit.i], [x, z] = bhWorld(c, s.lx, s.lz), eye = c.y + BH_FY + 1.22;
  if (PM.view === 'third') {
    const d = Math.min(PM.dist || 2.6, 2.4), cp = Math.cos(player.pitch);
    camera.position.set(x + Math.sin(player.yaw) * cp * d, eye + 0.3 - Math.sin(player.pitch) * d, z + Math.cos(player.yaw) * cp * d);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else { camera.position.set(x, eye, z); camera.rotation.set(player.pitch, player.yaw, 0); }
  return true;
}
function bhCycleView() {
  if (BAHN.cam === 'aussen') { BAHN.cam = 'innen'; if (PM.view === 'third') toggleView(); return 'Ich-Ansicht im Wagen'; }
  if (PM.view !== 'third') { toggleView(); return 'Alexander im Wagen'; }
  BAHN.cam = 'aussen'; return 'Außenansicht der Bahn';
}

/* ---------- Haltestellen: wo steht Alexander? ---------- */
function bhSideAt(p) {
  if (!BAHN.built) return null;
  for (const sd of BAHN.stations.flatMap(s => s.sides)) {
    if (Math.abs(p.y - sd.y) > 1.3) continue;
    const rx = p.x - sd.x, rz = p.z - sd.z, al = rx * sd.tx + rz * sd.tz, la = rx * sd.nx + rz * sd.nz;
    if (sd.hoch ? (Math.abs(al) < 15 && la > sd.lc - 0.4 && la < sd.lc + 3.2) : (Math.abs(al) < 9 && la > sd.lc - 2.6 && la < sd.lc + 3.4)) return sd;
  }
  return null;
}
// Alexander am Hochbahnsteig: der Halt liegt um eine halbe Wagenlänge versetzt (Zugmitte am Bahnhof)
function bhEta(sd) {
  let best = 1e9, here = null;
  for (const v of BAHN.veh) {
    if (v.tr !== sd.tr) continue;
    if (v.st === 'halt' && v.tr.stops[v.next] === sd) { here = v; continue; }
    const d = ((sd.s - v.s) % sd.tr.len + sd.tr.len) % sd.tr.len; best = Math.min(best, d / (v.line.v * 0.62));
  }
  return { here, t: best };
}
const bhFmtT = t => t < 20 ? 'gleich' : t < 60 ? 'in ' + Math.round(t / 5) * 5 + ' s' : 'in ' + Math.floor(t / 60) + ':' + String(Math.round(t % 60)).padStart(2, '0') + ' min';
function bhDirName(sd) { const S = sd.tr.stops, i = S.indexOf(sd); return S[(i + Math.floor(S.length / 2)) % S.length].st.n.split(' · ')[0]; }
// Tür eines haltenden Wagens in Reichweite
function bhBoardable(p) {
  for (const v of BAHN.veh) {
    if (v.st !== 'halt' || v.door < 0.6) continue;
    for (const c of v.cars) for (const dx of [-3.9, 3.9]) {
      const [x, z] = bhDoorWorld(c, dx, 0.9); if ((x - p.x) ** 2 + (z - p.z) ** 2 > 9 || Math.abs(p.y - (c.y + BH_FY)) > 1.7) continue;
      return { v, c, dx };
    }
  }
  return null;
}
function bhBoard(B) {
  const c = B.c;
  if (!c.det) { const pool = BAHN.pool[c.kind], d = pool.find(q => !q.car) || pool.find(q => player.on !== q.pf && !(BAHN.sit && BAHN.sit.det === q)); if (!d) return; if (d.car) d.car.det = null; d.car = c; c.det = d; d.g.visible = true; d.snap = true; d.pf.off = false; d.g.position.set(c.x, c.y, c.z); d.g.rotation.y = c.ry; d.g.updateMatrix(); pfRead(d.pf); pfSave(d.pf); }
  const [x, z] = bhWorld(c, B.dx, 0.35);
  player.p.set(x, c.y + BH_FY + 0.02, z); player.v.set(0, 0, 0); player.fly = false; player.on = c.det.pf;
  player.yaw = c.ry;   // Blick in den Wagen
  const i = bhFreeSeat(c.det, player.p, 3.2); if (i >= 0) toast('Eingestiegen · E Hinsetzen · V Außenansicht');
}
function bhAlight() {
  const v = BAHN.ride || (BAHN.sit && BAHN.sit.det.car && BAHN.sit.det.car.veh); if (!v) return;
  const d = bhDetOfPlayer(), c = d && d.car; if (!c) return;
  if (BAHN.sit) BAHN.sit = null;
  const [lx] = bhLocal(c, player.p.x, player.p.z), dx = Math.abs(lx - 3.9) < Math.abs(lx + 3.9) ? 3.9 : -3.9, sd = v.tr.stops[v.next];
  const [x, z] = bhDoorWorld(c, dx, (sd.lc || 2) + 0.6);
  player.p.set(x, sd.y + 0.02, z); player.v.set(0, 0, 0); player.on = null;
  toast(sd.st.n + (sd.st.change.length ? ' · Umsteigen: ' + sd.st.change.join(', ') : ''));
}

/* ---------- Schnellfahrt mit der Bahn ---------- */
function bhStationMenu(sd) {
  const here = sd.st, list = [...here.line.stations.filter(s => s !== here), ...BAHN.stations.filter(s => s.line !== here.line && s.n !== here.n)];
  const opts = list.map(s => (s.line === here.line ? s.line.name : 'umsteigen · ' + s.line.name) + ' → ' + s.n);
  const own = KT.ready && ktOwns('bahn');
  openChoice(here.n + ' · Schnellfahrt (' + (own ? 'frei' : BAHN.fare + ' Lumen') + ')', opts, i => bhTravel(sd, list[i]));
}
function bhTravel(from, to) {
  if (!to || BAHN.travel) return false;
  if (DRIVE.on || BOAT.on || IMP.st === 'helm') { toast('Erst aussteigen.'); return false; }
  if (KT.bahnStill) { toast('Die Bahner streiken. Heute fährt keine Bahn (Kontor · Imperium).'); return false; }   // V76
  BAHN.travel = to; const f = $('fade'); if (f) f.style.opacity = 1;
  setTimeout(() => {
    BAHN.travel = null; if (BAHN.sit) BAHN.sit = null;
    const sd = to.sides[0], w = sd.wait[0], [x, z] = [sd.x + sd.nx * (sd.lc + 1.4), sd.z + sd.nz * (sd.lc + 1.4)];
    player.p.set(x, sd.y + 0.05, z); player.v.set(0, 0, 0); player.fly = false; player.on = null; player.yaw = Math.atan2(sd.nx, sd.nz); void w;
    const own = KT.ready && ktOwns('bahn'), via = from && from.st.line !== to.line ? ' · umgestiegen' : '';
    if (!own && KT.ready && KT.s) ktCash(-BAHN.fare, 'Fahrschein ' + to.line.name);
    toast('Mit der ' + (to.line.kind === 'hoch' ? 'Hochbahn' : to.line.name) + ' nach ' + to.n + via + (own ? ' · Freifahrt' : ' · ' + BAHN.fare + ' Lumen'));
    if (RUF.ready && !BAHN.repTravel) { BAHN.repTravel = true; rufAdd({ buerger: 0.3, presse: 0.1 }, 'Mit der Bahn durch die Stadt', { key: 'bahn' }); setTimeout(() => { BAHN.repTravel = false; }, 120000); }
    if (f) setTimeout(() => { f.style.opacity = 0; }, 350);
  }, 900);
  return true;
}
function bhTravelTo(stId) {
  const to = BAHN.stations.find(s => s.id === stId); if (!to) return 'unbekannt';
  const sd = bhSideAt(player.p) || (BAHN.ride ? BAHN.ride.tr.stops[BAHN.ride.next] : null);
  if (!sd) return 'Schnellfahrt mit der Bahn nur von einer Haltestelle oder aus einem Wagen.';
  if (sd.st === to) return 'Sie sind schon dort.';
  return bhTravel(sd, to) ? '' : 'Gerade nicht möglich.';
}

/* ---------- Benutzen (E) ---------- */
function bhInteractions() {
  INTERACT.push({
    test: () => !!BAHN.sit,
    get label() { const v = BAHN.sit && BAHN.sit.det.car && BAHN.sit.det.car.veh; return v && v.st === 'halt' && v.door > 0.5 ? 'Aussteigen · ' + v.tr.stops[v.next].st.n : 'Aufstehen'; },
    act: () => { const v = BAHN.sit.det.car && BAHN.sit.det.car.veh; if (v && v.st === 'halt' && v.door > 0.5) bhAlight(); else bhStandUp(false); },
  });
  INTERACT.push({
    test: p => { if (!BAHN.ride || BAHN.sit) return false; const v = BAHN.ride; if (v.st === 'halt' && v.door > 0.5) return true; const d = bhDetOfPlayer(); return !!d && bhFreeSeat(d, p) >= 0; },
    get label() { const v = BAHN.ride; return v && v.st === 'halt' && v.door > 0.5 ? 'Aussteigen · ' + v.tr.stops[v.next].st.n : 'Hinsetzen'; },
    act: () => { const v = BAHN.ride; if (v && v.st === 'halt' && v.door > 0.5) { bhAlight(); return; } const d = bhDetOfPlayer(), i = d ? bhFreeSeat(d, player.p) : -1; if (i >= 0) bhSitDown(d, i); },
  });
  INTERACT.push({
    test: p => !BAHN.ride && !DRIVE.on && !!(BAHN.boardQ = bhBoardable(p)),
    get label() { const B = BAHN.boardQ; return B ? 'Einsteigen · ' + B.v.line.name + ' Richtung ' + bhDirName(B.v.tr.stops[B.v.next]) + (KT.ready && ktOwns('bahn') ? ' · frei' : ' · ' + BAHN.fare + ' Lumen') : 'Einsteigen'; },
    act: () => { if (BAHN.boardQ) bhBoard(BAHN.boardQ); },
  });
  INTERACT.push({
    test: p => !BAHN.ride && !DRIVE.on && !!(BAHN.atSide = bhSideAt(p)),
    get label() {
      const sd = BAHN.atSide; if (!sd) return '';
      const e = bhEta(sd), nm = sd.st.line.kind === 'hoch' ? 'Hochbahn' : sd.st.line.name;
      return sd.st.n + ' · ' + nm + ' nach ' + bhDirName(sd) + (e.here ? ' steht bereit' : ' ' + bhFmtT(e.t)) + ' · Schnellfahrt';
    },
    act: () => { if (BAHN.atSide) bhStationMenu(BAHN.atSide); },
  });
}

/* ---------- Fahrgäste: Wartende an den Haltestellen, Sitzende in den nahen Wagen, Ein- und Aussteigende ---------- */
const BH_KINDS = ['coat', 'suit', 'lady', 'dress', 'furcoat', 'worker', 'flapper', 'jacket'];
function bhCrowd() {
  const n = MOBILE ? 22 : 40, C = BAHN.crowd = new Crowd(BH_KINDS, n);
  for (let i = 0; i < n; i++) {
    const kind = BH_KINDS[i % BH_KINDS.length], col = kind === 'dress' || kind === 'flapper' ? DRESSES[i % DRESSES.length] : kind === 'furcoat' ? FURCOATS[i % FURCOATS.length] : kind === 'worker' || kind === 'jacket' ? WORKWEAR[i % WORKWEAR.length] : COATS[i % COATS.length];
    const a = C.add(kind, col), fem = kind === 'lady' || kind === 'dress' || kind === 'furcoat' || kind === 'flapper';
    BAHN.ag.push({ a, kind, fem, sc: 0.95 + R() * 0.08, role: null, key: null, idle: 0.6 + R() * 0.35 });
  }
  C.finish();
  for (const s of BAHN.stations) for (const sd of s.sides) sd.wc = 1 + Math.floor(R() * 3);
}
const bhGait = (A, sp) => { const g = A.a.gait, c = sp * (A.fem ? 5.4 : 4.6) / A.sc, s = A.fem ? 0.36 : 0.4; if (g[1] !== c || g[2] !== s) { g[1] = c; g[2] = s; A.a.gv = (A.a.gv | 0) + 1; } };
const bhAct = (A, v) => { const g = A.a.gait; if (g[1] !== v || g[2] !== 0) { g[1] = v; g[2] = 0; A.a.gv = (A.a.gv | 0) + 1; } };
function bhCrowdUpdate(dt) {
  const C = BAHN.crowd; if (!C) return;
  const cp = camera.position, d2 = (x, z) => (x - cp.x) ** 2 + (z - cp.z) ** 2;
  // Wartende wachsen langsam nach
  BAHN.wT = (BAHN.wT || 0) - dt;
  if (BAHN.wT < 0) { BAHN.wT = 2; for (const s of BAHN.stations) for (const sd of s.sides) if (R() < 0.08) sd.wc = Math.min(sd.wait.length, (sd.wc || 0) + 1); }
  // gewünschte Plätze: Wartende (nahe Haltestellen) und Sitzende (nahe Wagen)
  const want = new Map();
  const sides = BAHN.stations.flatMap(s => s.sides).filter(sd => d2(sd.x, sd.z) < 150 * 150 && Math.abs(cp.y - sd.y) < 160).sort((a, b) => d2(a.x, a.z) - d2(b.x, b.z)).slice(0, 5);
  for (const sd of sides) for (let i = 0; i < Math.min(sd.wait.length, Math.floor(sd.wc || 0)); i++) want.set('w' + sd.st.id + sd.tr.d + ':' + i, { t: 'wait', sd, i });
  for (const k in BAHN.pool) for (const d of BAHN.pool[k]) {
    if (!d.car) continue; const v = d.car.veh, share = v.ncar > 1 ? Math.ceil(v.pax / v.ncar) - (d.car.k ? (v.pax % v.ncar ? 1 : 0) : 0) : v.pax;
    d.taken = d.taken || new Set(); d.taken.clear();
    let n = 0; const order = d.seats.map((s, i) => i).sort((a, b) => ((a * 7919 + v.id * 31) % 97) - ((b * 7919 + v.id * 31) % 97));
    for (const i of order) { if (n >= Math.min(share, d.seats.length - 2)) break; if (BAHN.sit && BAHN.sit.det === d && BAHN.sit.i === i) continue; d.taken.add(i); want.set('s' + v.id + ':' + d.car.k + ':' + i, { t: 'seat', d, i }); n++; }
    if (BAHN.sit && BAHN.sit.det === d) d.taken.add(BAHN.sit.i);
  }
  // Wechsel an haltenden Wagen mit Figuren: Aussteiger gehen hinaus, Wartende steigen ein
  for (const v of BAHN.veh) {
    if (v.st !== 'halt' || v.door < 0.9 || !v.cars.some(c => c.det)) continue;
    v.xT = (v.xT || 0) - dt; if (v.xT > 0) continue; v.xT = 1.1;
    const sd = v.tr.stops[v.next];
    if (v.out > 0 && v.pax > 0) {
      const A = BAHN.ag.find(q => !q.role && !want.has(q.key || '')) ; v.out--; v.pax--;
      if (A) { const c = v.cars[Math.floor(R() * v.ncar)], dx = R() < 0.5 ? -3.9 : 3.9, [x0, z0] = bhDoorWorld(c, dx, -0.6), [x1, z1] = bhDoorWorld(c, dx, (sd.lc || 2) + 1.2), [x2, z2] = [x1 + sd.tx * (R() < 0.5 ? -9 : 9), z1 + sd.tz * (R() < 0.5 ? -9 : 9)];
        Object.assign(A, { role: 'walk', key: 'x' + A.a.gait[0], path: [[x0, c.y + BH_FY, z0], [x1, sd.y, z1], [x2, sd.y, z2]], pi: 0, x: x0, y: c.y + BH_FY, z: z0, done: 'gone' }); }
    } else if (v.inQ > 0 && (sd.wc || 0) >= 1) {
      v.inQ--; const i = Math.floor(sd.wc) - 1, key = 'w' + sd.st.id + sd.tr.d + ':' + i; sd.wc = Math.max(0, sd.wc - 1);
      const A = BAHN.ag.find(q => q.key === key && q.role === 'wait');
      if (A) { const c = v.cars[Math.floor(R() * v.ncar)], dx = R() < 0.5 ? -3.9 : 3.9, [x1, z1] = bhDoorWorld(c, dx, 0.7), [x2, z2] = bhDoorWorld(c, dx, -0.7), w = sd.wait[i];
        Object.assign(A, { role: 'walk', key: 'b' + A.a.gait[0], path: [[x1, sd.y, z1], [x2, c.y + BH_FY, z2]], pi: 0, done: 'board', veh: v, x: w.x, y: w.y, z: w.z }); }
      else v.pax++;
    }
  }
  // freigeben, was nicht mehr gewünscht ist
  for (const A of BAHN.ag) if (A.role && A.role !== 'walk' && !want.has(A.key)) { A.role = null; A.key = null; A.a.on = false; }
  const used = new Set(BAHN.ag.filter(A => A.role && A.role !== 'walk').map(A => A.key));
  for (const [key, w] of want) {
    if (used.has(key)) continue;
    const A = BAHN.ag.find(q => !q.role); if (!A) break;
    A.role = w.t; A.key = key; A.w = w;
  }
  // stellen und bewegen
  for (const A of BAHN.ag) {
    if (!A.role) { A.a.on = false; continue; }
    if (A.role === 'wait') {
      const sd = A.w.sd, p = sd.wait[A.w.i];
      C.set(A.a, p.x, p.sit ? p.y + 0.46 - (A.fem ? 0.8 : 0.87) * A.sc : p.y, p.z, p.yaw, A.sc);
      bhAct(A, p.sit ? 7.2 : A.idle);
    } else if (A.role === 'seat') {
      const d = A.w.d, c = d.car; if (!c) { A.role = null; A.a.on = false; continue; }
      const s = d.seats[A.w.i], [x, z] = bhWorld(c, s.lx, s.lz), yaw = Math.atan2(s.f * Math.sin(c.ry), s.f * Math.cos(c.ry));
      C.set(A.a, x, c.y + BH_FY + 0.46 - (A.fem ? 0.8 : 0.87) * A.sc, z, yaw, A.sc); A.car = c;
      bhAct(A, 7.2);
    } else if (A.role === 'walk') {
      const tg = A.path[A.pi]; if (A.x === undefined) { A.x = tg[0]; A.y = tg[1]; A.z = tg[2]; }
      const dx = tg[0] - A.x, dz = tg[2] - A.z, L = Math.hypot(dx, dz), sp = 1.25;
      if (L < 0.15) { A.pi++; if (A.pi >= A.path.length) { if (A.done === 'board' && A.veh) A.veh.pax++; A.role = null; A.key = null; A.a.on = false; A.x = undefined; } continue; }
      const k = Math.min(1, sp * dt / L); A.x += dx * k; A.z += dz * k; A.y += (tg[1] - A.y) * Math.min(1, dt * 4);
      C.set(A.a, A.x, A.y, A.z, Math.atan2(dx, dz), A.sc); bhGait(A, sp);
    }
  }
  C.flag();
}

/* ---------- Anmelden ---------- */
BAHN.build = buildBahn; BAHN.update = updateBahn; BAHN.obstacles = bahnObstacles; BAHN.seatInput = bahnSeatInput; BAHN.seatModel = bahnSeatModel; BAHN.camera = bahnCamera;
BAHN.travelTo = bhTravelTo; BAHN.sideAt = p => bhSideAt(p);
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyV' || e.repeat || !(BAHN.ride || BAHN.sit) || !playing || paused || DINE.menuOpen) return;
    toast(bhCycleView()); e.stopImmediatePropagation(); e.preventDefault();
  }, true);
  setTimeout(() => {
    try {
      addTasten('reisen', [
        { id: 'bahnE', k: ['E'], t: 'Straßenbahn und Hochbahn', d: 'An der Haltestelle: Schnellfahrt · an der offenen Tür: einsteigen · im Wagen: hinsetzen, am Halt aussteigen (1 Lumen)' },
        { id: 'bahnV', k: ['V'], t: 'In der Bahn: Ansicht', d: 'Ich-Ansicht, Alexander im Wagen, Außenansicht' },
        { id: 'bahnF', k: ['F'], t: 'Aus der Bahn fliegen', d: 'Jederzeit, auch während der Fahrt' },
      ]);
    } catch (e) { /* Pausenmenü fehlt */ }
  }, 0);
}
