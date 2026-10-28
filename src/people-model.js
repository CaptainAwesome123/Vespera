'use strict';
/* =====================================================================
   V17 · MENSCHEN: modellierte Köpfe mit Gesichtszügen, Haar aus einzelnen
   Strähnen, Kleidung mit Falten und erkennbarem Stoff. Drei Detailstufen:
   nah (q 2), mittel (q 1), fern (personGeo). Jede Ecke trägt Stoffart und
   Schwunggewicht (aSoft), damit Haare, Röcke und Fransen sich bewegen
   ===================================================================== */
const HQ = { near2: (MOBILE ? 7 : 11) ** 2, cache: new Map() };
// Stoffarten für den Shader
const FAB = { skin: 1, hair: 2, wool: 3, silk: 4, cotton: 5, leather: 6, fur: 7, felt: 8, straw: 9, sequin: 10, knit: 11, metal: 12, satin: 13, stock: 14 };
// Schwungarten: 1 Haar, 2 Rock, 3 Fransen, 4 Mantelschoß, 5 Kette, 6 Krawatte
// Gesichtsmerkmale relativ zur Kopfmitte: Atlas und Modell benutzen dieselben Werte
const HL = { eyeX: 0.031, eyeY: -0.005, browY: 0.018, noseY: -0.039, mouthY: -0.064, chinY: -0.101, fw: 0.17, fh: 0.2, fy: -0.02 };
const hsm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hg2 = (x, y, x0, y0, sx, sy) => Math.exp(-(((x - x0) / sx) ** 2) - (((y - y0) / sy) ** 2));
// Gitterfläche: f(u, v) -> { p, uv?, s? }; wrap schließt den Ring in u
function hGrid(nu, nv, f, wrap = false, flipCheck = true) {
  const P = [], UV = [], S = [], I = [];
  let hasUV = false, hasS = false;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const r = f(i / nu, j / nv);
    P.push(r.p[0], r.p[1], r.p[2]);
    if (r.uv) hasUV = true; UV.push(...(r.uv || [-1, -1]));
    if (r.s) hasS = true; S.push(...(r.s || [0, 0, 0]));
  }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    I.push(a, b, d, a, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  if (hasUV) g.setAttribute('uv', new T.Float32BufferAttribute(UV, 2));
  if (hasS) g.setAttribute('aSoft', new T.Float32BufferAttribute(S, 3));
  g.setIndex(I);
  g.computeVertexNormals();
  if (flipCheck) hOrient(g);
  if (wrap) {
    // Naht schließen: Normalen der ersten und letzten Spalte mitteln
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * W, b = a + nu; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), L = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / L, y / L, z / L); n.setXYZ(b, x / L, y / L, z / L); }
  }
  return g;
}
// Dreiecke nach außen drehen (für geschlossene, ungefähr konvexe Teile)
function hOrient(g) {
  const p = g.attributes.position, n = g.attributes.normal; let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < p.count; i++) { cx += p.getX(i); cy += p.getY(i); cz += p.getZ(i); }
  cx /= p.count; cy /= p.count; cz /= p.count;
  let s = 0; for (let i = 0; i < p.count; i++) s += (p.getX(i) - cx) * n.getX(i) + (p.getY(i) - cy) * n.getY(i) + (p.getZ(i) - cz) * n.getZ(i);
  if (s < 0) hFlip(g);
}
function hFlip(g) {
  const I = g.index.array; for (let k = 0; k < I.length; k += 3) { const t = I[k + 1]; I[k + 1] = I[k + 2]; I[k + 2] = t; }
  g.index.needsUpdate = true; g.computeVertexNormals();
}
// Catmull-Rom durch Punkte (Arrays gleicher Länge), n Stützstellen
function hSpline(pts, n) {
  const out = [], m = pts.length - 1;
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) * m, i = Math.min(m - 1, Math.floor(t)), f = t - i;
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(m, i + 2)];
    out.push(p1.map((_, d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f * f + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * f * f * f)));
  }
  return out;
}
// Drehkörper mit elliptischem Querschnitt; fold(th, y, r) liefert Faltentiefe, sway(y) das Schwunggewicht
function hLathe(prof, o = {}) {
  const rings = o.rings || 24, seg = o.seg || 32, sz = o.sz ?? 0.74, sx = o.sx ?? 1, pw = o.pw || 2;
  const se = v => Math.sign(v) * Math.pow(Math.abs(v), 2 / pw);
  const S = hSpline(prof, rings);
  const fab = o.fab || 0, sk = o.swayKind || 0;
  const g = hGrid(seg, rings - 1, (u, v) => {
    const [r, y] = S[Math.round(v * (rings - 1))], th = u * Math.PI * 2;
    let rr = r; if (o.fold && r > 0.001) rr += o.fold(th, y, r);
    return { p: [se(Math.sin(th)) * rr * sx, y, se(Math.cos(th)) * rr * sz], s: [fab, o.sway ? o.sway(y, th) : 0, sk] };
  }, true);
  const rAt = y => { if (y <= S[0][1]) return S[0][0]; for (let k = 1; k < S.length; k++) if (S[k][1] >= y) { const a = S[k - 1], b = S[k], f = (y - a[1]) / Math.max(1e-6, b[1] - a[1]); return a[0] + (b[0] - a[0]) * f; } return S[S.length - 1][0]; };
  // Oberfläche vorn (side 1) oder hinten (side -1) an der Stelle x, y
  g.userData.surf = (x, y, side = 1) => { const r = rAt(y) * sx; return side * sz * r / sx * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / Math.max(r, 1e-4)), pw)), 1 / pw); };
  g.userData.rAt = rAt; g.userData.sz = sz;
  return g;
}
// Röhre entlang eines Pfads (Gliedmaßen, Strähnen): rads je Punkt, Querschnitt (ax, az) skaliert
function hTube(path, rads, o = {}) {
  const n = o.n || Math.max(4, path.length), seg = o.seg || 12;
  const C = hSpline(path, n), Rr = hSpline(rads.map(r => [r]), n).map(r => r[0]);
  const up0 = o.up ? new T.Vector3(...o.up) : null;
  const frames = []; let prevN = null;
  for (let k = 0; k < n; k++) {
    const a = new T.Vector3(...C[Math.max(0, k - 1)]), b = new T.Vector3(...C[Math.min(n - 1, k + 1)]);
    const t = b.sub(a).normalize();
    let nn;
    if (prevN) nn = prevN.clone().sub(t.clone().multiplyScalar(prevN.dot(t))).normalize();
    else { nn = (up0 || (Math.abs(t.y) > 0.9 ? new T.Vector3(0, 0, 1) : new T.Vector3(0, 1, 0))).clone(); nn.sub(t.clone().multiplyScalar(nn.dot(t))).normalize(); }
    prevN = nn; frames.push([t, nn, new T.Vector3().crossVectors(t, nn)]);
  }
  const ax = o.ax ?? 1, az = o.az ?? 1, fab = o.fab || 0;
  return hGrid(seg, n - 1, (u, v) => {
    const k = Math.round(v * (n - 1)), [, N, B] = frames[k], th = u * Math.PI * 2;
    let r = Rr[k]; if (o.fold) r += o.fold(th, v, C[k]);
    const c = C[k], cs = Math.cos(th) * r * ax, sn = Math.sin(th) * r * az;
    const res = { p: [c[0] + N.x * cs + B.x * sn, c[1] + N.y * cs + B.y * sn, c[2] + N.z * cs + B.z * sn], s: [fab, o.sway ? o.sway(v) : 0, o.swayKind || 0] };
    if (o.strand) res.uv = [-2 - u, v];
    return res;
  }, true, false);
}
// Ellipsoid aus dem Gitter, mit Verformung
function hEll(r, c, sc, o = {}) {
  const nu = o.nu || 16, nv = o.nv || 10;
  return hGrid(nu, nv, (u, v) => {
    const th = u * Math.PI * 2, e = (v - 0.5) * Math.PI;
    let p = [Math.sin(th) * Math.cos(e) * r * sc[0], Math.sin(e) * r * sc[1], Math.cos(th) * Math.cos(e) * r * sc[2]];
    if (o.warp) p = o.warp(p, th, e);
    return { p: [p[0] + c[0], p[1] + c[1], p[2] + c[2]], s: [o.fab || 0, 0, 0] };
  }, true);
}

/* ---------- Der Kopf: Schädel, Stirn, Augenhöhlen, Wangenknochen, Nase, Lippen, Kinn, Kiefer ---------- */
function headShape(th, e, fem) {
  const dx = Math.sin(th) * Math.cos(e), dy = Math.sin(e), dz = Math.cos(th) * Math.cos(e);
  const rx = fem ? 0.072 : 0.076, ry = fem ? 0.106 : 0.11, rz = fem ? 0.093 : 0.098;
  let x = dx * rx, y = dy * ry, z = dz * rz;
  const front = hsm(0.05, 0.75, dz), back = hsm(0.0, -0.8, dz);
  // Hinterkopf voller, Scheitel etwas flacher, Stirn fliehend
  z *= 1 + 0.13 * back * hsm(-0.45, 0.35, dy);
  y *= 1 - 0.05 * hsm(0.6, 1, dy);
  z -= 0.013 * front * hsm(0.2, 0.85, dy);
  // Wangen und Kiefer: unten breiter als eine Kugel, erst am Kinn schmal; der Kieferwinkel unter dem Ohr
  const low = hsm(0.0, -0.95, dy);
  x *= 1 + (fem ? 0.0 : 0.07) * hsm(-0.1, -0.62, dy) * (1 - hsm(-0.7, -0.98, dy));
  x *= 1 - (fem ? 0.3 : 0.2) * hsm(-0.62, -1.0, dy) * front - (fem ? 0.1 : 0.0) * hsm(-0.2, -0.8, dy);
  y -= (fem ? 0.006 : 0.01) * low * front;
  z *= 1 - 0.24 * low * (1 - front);
  // Schläfen eingezogen, Gesicht seitlich flacher
  x *= 1 - 0.06 * hg2(dy, dz, 0.3, 0.45, 0.3, 0.3);
  z *= 1 - 0.04 * front * hsm(0.3, 0.95, Math.abs(dx));
  // Formen im Gesicht (entlang +z), gewichtet zur Vorderseite
  const f = hsm(0.12, 0.55, dz);
  if (f > 0) {
    const ex = HL.eyeX, ey = HL.eyeY, ax = Math.abs(x);
    let d = 0;
    d += 0.006 * hg2(x, y, 0, -0.048, 0.034, 0.03);                             // Mundpartie wölbt sich vor
    d -= 0.014 * hg2(ax, y, ex, ey + 0.002, 0.021, 0.015);                      // Augenhöhle
    d += 0.0078 * hg2(ax, y, ex, ey - 0.0005, 0.0125, 0.0072);                  // Augapfel unter dem Lid
    d += 0.0018 * hg2(ax, y, ex, ey + 0.006, 0.013, 0.0024);                    // Oberlid
    d += 0.0012 * hg2(ax, y, ex + 0.002, ey - 0.0065, 0.011, 0.0018);           // Unterlid
    d += (fem ? 0.0045 : 0.0085) * hg2(ax, y, ex - 0.002, HL.browY, 0.024, 0.0078);   // Brauenbogen
    d -= 0.004 * hg2(ax, y, 0.064, HL.browY + 0.005, 0.012, 0.02);             // Schläfe
    // Nase: Rücken, Spitze, Flügel, Nasenlöcher, Steg
    const nt = hsm(HL.eyeY + 0.008, HL.noseY, y);
    d += (0.0055 + (fem ? 0.0085 : 0.011) * nt) * Math.exp(-((x / (0.0075 + 0.0055 * nt)) ** 2)) * hsm(HL.eyeY + 0.016, HL.eyeY - 0.001, y) * hsm(HL.noseY - 0.011, HL.noseY - 0.002, y);
    d += (fem ? 0.0075 : 0.0088) * hg2(x, y, 0, HL.noseY - 0.003, 0.0092, 0.0088);
    d += 0.006 * hg2(ax, y, 0.0128, HL.noseY - 0.0045, 0.006, 0.006);
    d -= 0.0018 * hg2(ax, y, 0.0185, HL.noseY - 0.002, 0.002, 0.008);
    d -= 0.003 * hg2(ax, y, 0.0068, HL.noseY - 0.0095, 0.003, 0.0022);
    d -= 0.0016 * hg2(x, y, 0, HL.noseY - 0.0165, 0.003, 0.0045);
    // Wangenknochen, Wangen, Falte von der Nase zum Mundwinkel
    d += (fem ? 0.0068 : 0.0058) * hg2(ax, y, 0.046, HL.eyeY - 0.021, 0.019, 0.012);
    d -= (fem ? 0.001 : 0.0028) * hg2(ax, y, 0.048, HL.mouthY + 0.004, 0.012, 0.016);
    d += 0.003 * hg2(ax, y, 0.032, HL.mouthY + 0.01, 0.014, 0.018);
    d -= 0.0017 * hg2(ax - 0.019 - (y - HL.noseY) * -0.3, y, 0, HL.noseY - 0.018, 0.003, 0.016);
    // Lippen: Oberlippe mit Bogen, Unterlippe voller, Mundspalte, Mundwinkel
    const lw = fem ? 0.021 : 0.024;
    d += (fem ? 0.0064 : 0.005) * hg2(x, y, 0, HL.mouthY + 0.0042, lw * 0.9, 0.0042) * (1 + 0.18 * hg2(ax, y, 0.006, HL.mouthY + 0.006, 0.004, 0.003));
    d += (fem ? 0.0075 : 0.0062) * hg2(x, y, 0, HL.mouthY - 0.0048, lw * 0.75, 0.0048);
    d -= 0.0026 * hg2(x, y, 0, HL.mouthY, lw, 0.0011);
    d -= 0.0018 * hg2(ax, y, lw, HL.mouthY + 0.0005, 0.0032, 0.0032);
    // Kinngrube und Kinn, beim Mann breiter und kantiger
    d -= 0.003 * hg2(x, y, 0, HL.mouthY - 0.015, 0.016, 0.0045);
    d += (fem ? 0.0055 : 0.0085) * hg2(x, y, 0, HL.chinY + 0.006, fem ? 0.014 : 0.021, 0.012);
    z += d * f;
  }
  return [x, y, z];
}
// Gesichtsabbildung: vorn eben projiziert; hinten außerhalb (durchsichtig)
const faceUV = (x, y, dz) => dz > -0.08 ? [0.5 + x / HL.fw, 0.5 + (y - HL.fy) / HL.fh] : [x < 0 ? -0.6 : 1.6, 0.5];
function headGeo(q, fem) {
  const nu = q > 1.5 ? 96 : 40, nv = q > 1.5 ? 74 : 30;
  // dicht vorn und in Gesichtshöhe, locker am Hinterkopf
  const au = u => { const s = u * 2 - 1; return Math.PI * Math.sign(s) * Math.pow(Math.abs(s), 1.45); };
  const ev = v => { const t = v * 2 - 1; return Math.PI / 2 * (0.62 * t + 0.38 * t * t * t) * 0.999; };
  return hGrid(nu, nv, (u, v) => {
    const th = au(u), e = ev(v), p = headShape(th, e, fem);
    return { p, uv: faceUV(p[0], p[1], Math.cos(th) * Math.cos(e)), s: [FAB.skin, 0, 0] };
  }, true);
}
// Ohr: Muschel mit Rand (Helix), Läppchen
function earGeo(sx, q, fem) {
  const n = q > 1.5 ? 1 : 0.6, P = [];
  const rim = hTube(Array.from({ length: 12 }, (_, k) => { const a = -0.6 + k / 11 * Math.PI * 1.55; return [0, Math.sin(a) * 0.024, Math.cos(a) * 0.016 - 0.004]; }), [0.0035, 0.0045, 0.005, 0.005, 0.0045, 0.004], { seg: Math.round(7 * n) + 2, n: Math.round(16 * n) + 4, fab: FAB.skin });
  const shell = hEll(1, [0.002, 0.001, -0.003], [0.006, 0.022, 0.014], { nu: 10, nv: 8, fab: FAB.skin });
  const lobe = hEll(1, [0.001, -0.021, 0.003], [0.005, 0.009, 0.007], { nu: 8, nv: 6, fab: FAB.skin });
  for (const g of [rim, shell, lobe]) { g.rotateY(sx * 0.25); g.rotateZ(-sx * 0.12); g.translate(sx * (fem ? 0.073 : 0.077), -0.003, -0.012); P.push(g); }
  return P;
}

/* ---------- Haar: Haaransatz als Kappe, darauf Strähnen, die der Frisur folgen ---------- */
// Richtung auf dem Kopf -> Punkt auf der Haaroberfläche (Abstand h über der Kopfhaut)
function scalpPt(th, e, fem, h) {
  const p = headShape(th, e, fem), L = Math.hypot(...p), k = (L + h) / L;
  return [p[0] * k, p[1] * k, p[2] * k];
}
// Strähne: Pfad über die Kopfhaut (Liste aus [th, e, h]), danach optional frei hängend
function hairLock(pts, fem, w, t, o = {}) {
  const path = pts.map(([th, e, h], k) => scalpPt(th, e, fem, h * (0.3 + 0.7 * hsm(0, 0.3, k / (pts.length - 1)))));
  if (o.tail) for (const q of o.tail) path.push(q(path[path.length - 1], path));
  const n = path.length, rads = path.map((_, k) => { const f = k / (n - 1); return w * (0.45 + 0.55 * Math.sin(Math.min(1, f * 2.5) * Math.PI / 2)) * (1 - Math.pow(f, o.taper ?? 1.6) * 0.85); });
  const sw = o.sway ?? 0.5;
  const p0 = path[0], L0 = Math.hypot(...p0) || 1;
  return hTube(path, rads, { seg: o.seg || 5, n: o.n || Math.max(6, n * 2), ax: t / w, az: 1, fab: FAB.hair, strand: true, swayKind: o.kind ?? 1, sway: v => Math.pow(v, o.swPow ?? 1.4) * sw, up: o.up || [p0[0] / L0, p0[1] / L0, p0[2] / L0] });
}
// Kappe unter den Strähnen; mask(th, e) sagt, wo Haar wächst
function hairCap(fem, q, h, mask, o = {}) {
  const nu = q > 1.5 ? 56 : 26, nv = q > 1.5 ? 18 : 9, lim = mask.lim || (() => 0.3);
  return hGrid(nu, nv, (u, v) => {
    const th = (u * 2 - 1) * Math.PI, l = lim(th), e = l + (Math.PI / 2 - l) * Math.pow(v, 0.8) * 0.999;
    const fade = hsm(0, 0.25, v), p = scalpPt(th, e, fem, h * (0.2 + 0.8 * fade) + 0.0012);
    return { p, uv: [-2 - u * 6, v], s: [FAB.hair, o.sway ? o.sway(th, e) : 0, 1] };
  }, true);
}
// Haaransatz: vorn hoch (Stirn), an den Seiten über den Ohren, hinten tief im Nacken
const HAIRLINE = [[0, 0.5], [0.3, 0.52], [0.55, 0.57], [0.85, 0.48], [1.12, 0.2], [1.3, 0.12], [1.48, 0.3], [1.66, 0.34], [1.86, 0.12], [2.2, -0.25], [2.6, -0.55], [Math.PI, -0.68]];
function hairLim(th, o = {}) {
  const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
  let k = 1; while (k < HAIRLINE.length - 1 && HAIRLINE[k][0] < a) k++;
  const [a0, l0] = HAIRLINE[k - 1], [a1, l1] = HAIRLINE[k], t = hsm(a0, a1, a);
  let lim = l0 + (l1 - l0) * t;
  lim -= (o.front ?? 0) * hsm(1.0, 0.0, a);
  lim += (1 - (o.nape ?? 1)) * 0.4 * hsm(2.0, 3.0, a);
  lim -= (o.burns ?? 0) * Math.exp(-(((a - 1.25) / 0.12) ** 2));
  return lim;
}
const hairline = (th, e, o = {}) => e > hairLim(th, o) ? 1 : 0;
// Bogen über den Kopf: von Richtung d0 über mid nach d1 (Bezier auf der Kugel), Höhe h(f)
const dirTE = d => { const L = Math.hypot(d[0], d[1], d[2]) || 1; return [Math.atan2(d[0], d[2]), Math.asin(Math.max(-0.999, Math.min(0.999, d[1] / L)))]; };
const dirOf = (th, e) => [Math.sin(th) * Math.cos(e), Math.sin(e), Math.cos(th) * Math.cos(e)];
function arcPts(d0, d1, n, h, mid, wig) {
  const out = [];
  const m = mid || [(d0[0] + d1[0]) / 2, (d0[1] + d1[1]) / 2 + 0.5, (d0[2] + d1[2]) / 2];
  for (let s = 0; s <= n; s++) {
    const f = s / n, a = (1 - f) * (1 - f), b = 2 * f * (1 - f), c = f * f;
    let d = [a * d0[0] + b * m[0] + c * d1[0], a * d0[1] + b * m[1] + c * d1[1], a * d0[2] + b * m[2] + c * d1[2]];
    if (wig) d = wig(d, f);
    const [th, e] = dirTE(d); out.push([th, e, h(f)]);
  }
  return out;
}
function hairGeo(style, fem, q, P, hc, opt, push) {
  const R = mulberry32(style * 97 + (fem ? 13 : 0) + 7), rr = (a, b) => a + R() * (b - a);
  const dense = q > 1.5 ? 1 : 0.38;
  const add = g => push(g);
  const capMask = o => { const f = (th, e) => hairline(th, e, o); f.lim = th => hairLim(th, o); return f; };
  const N = k => Math.max(6, Math.round(k * dense));
  if (!fem) {
    if (style === 0) {
      // glatt zurückgekämmt mit Pomade: flach anliegend, glänzend; nur hinten etwas locker
      add(hairCap(fem, q, 0.008, capMask({ front: 0.02 })));
      for (let k = 0; k < N(80); k++) {
        const th0 = rr(-1.3, 1.3), d0 = dirOf(th0, hairLim(th0, { front: 0.02 }) + rr(0.03, 0.09));
        const th1 = Math.sign(th0 || 0.01) * (Math.PI - Math.abs(th0) * 0.55), d1 = dirOf(th1, rr(-0.55, -0.3));
        const pts = arcPts(d0, d1, 7, f => 0.01 + 0.007 * Math.sin(f * Math.PI), [(d0[0] + d1[0]) * 0.5, 1.15, (d0[2] + d1[2]) * 0.5]);
        add(hairLock(pts, fem, rr(0.006, 0.009), 0.0025, { sway: 0.12, swPow: 3 }));
      }
    } else if (style === 1) {
      // Seitenscheitel links, Tolle vorn, Seiten kurz
      add(hairCap(fem, q, 0.01, capMask({ front: 0.0 })));
      for (let k = 0; k < N(90); k++) {
        const z0 = rr(-0.75, 0.75), left = R() < 0.3, d0 = [0.36, 0.92, z0];
        const d1 = left ? [0.98, 0.0, z0 * 0.85] : [-0.98, rr(-0.05, 0.15), z0 * 0.9 - 0.08];
        const mid = left ? [0.85, 0.8, z0] : [-0.1, 1.25, z0 * 1.05];
        add(hairLock(arcPts(d0, d1, 7, f => 0.011 + (left ? 0.006 : 0.016) * Math.sin(f * Math.PI), mid), fem, rr(0.007, 0.01), 0.003, { sway: left ? 0.15 : 0.32 }));
      }
      // Tolle: dicke Strähnen vorn, hoch und nach hinten geschwungen; wippen beim Gehen
      for (let k = 0; k < N(16); k++) {
        const x0 = rr(-0.45, 0.35), thx = Math.asin(x0), d0 = dirOf(thx, hairLim(thx) + 0.05), d1 = [x0 - 0.35, 0.9, -0.3];
        add(hairLock(arcPts(d0, d1, 7, f => 0.013 + 0.034 * Math.sin(f * Math.PI * 0.85), [x0 - 0.1, 1.3, 0.55]), fem, rr(0.009, 0.012), 0.0035, { sway: 0.5 }));
      }
    } else {
      // kurz an den Seiten, oben länger und nach hinten gelegt; ein paar Strähnen fallen in die Stirn
      add(hairCap(fem, q, 0.006, capMask({ front: 0.02, burns: 0.1 })));
      for (let k = 0; k < N(70); k++) {
        const x0 = rr(-0.5, 0.5), thx = Math.asin(x0 * 0.9), d0 = dirOf(thx, hairLim(thx, { front: 0.02 }) + rr(0.04, 0.1)), d1 = [x0 * 1.4, 0.55, -0.82];
        add(hairLock(arcPts(d0, d1, 8, f => 0.012 + 0.016 * Math.sin(f * Math.PI), [x0 * 1.1, 1.25, 0.1]), fem, rr(0.008, 0.011), 0.0032, { sway: 0.3 }));
      }
      for (let k = 0; k < N(10); k++) {
        const x0 = rr(-0.35, 0.2), d0 = [x0, 0.85, 0.5];
        add(hairLock(arcPts(d0, [x0 - 0.12, 0.42, 0.9], 5, f => 0.02 + 0.01 * Math.sin(f * Math.PI), [x0 - 0.05, 0.85, 0.85]), fem, rr(0.005, 0.007), 0.0025, { sway: 0.8 }));
      }
    }
    return;
  }
  if (style === 0) {
    // Bubikopf: kinnlang, die Spitzen nach innen gedreht, Pony über der Stirn
    add(hairCap(fem, q, 0.012, capMask({ front: -0.02, nape: 0.9 })));
    const n0 = N(120);
    for (let k = 0; k < n0; k++) {
      const th0 = (k / n0) * Math.PI * 2 - Math.PI + rr(-0.03, 0.03);
      if (Math.cos(th0) > 0.5) continue;
      const pts = arcPts(dirOf(th0 * 0.3, 1.3), dirOf(th0, -0.12), 6, f => 0.013 + f * 0.02, dirOf(th0 * 0.85, 0.7));
      const inw = (p, sc, dy) => { const L = Math.hypot(p[0], p[2]) || 1; return [p[0] - p[0] / L * sc, p[1] - dy, p[2] - p[2] / L * sc]; };
      add(hairLock(pts, fem, rr(0.008, 0.012), 0.0035, { tail: [p => inw(p, -0.004, 0.03), p => inw(p, 0.012, 0.022), p => inw(p, 0.022, 0.004)], sway: 0.9, swPow: 2, n: 13 }));
    }
    for (let k = 0; k < N(26); k++) {
      const x0 = rr(-0.5, 0.5);
      add(hairLock(arcPts([x0 * 0.6, 0.95, 0.15], [x0, 0.42, 0.9], 5, f => 0.012 + 0.01 * f, [x0 * 0.8, 0.95, 0.7]), fem, rr(0.007, 0.01), 0.003, { sway: 0.6, swPow: 2 }));
    }
  } else if (style === 1) {
    // Knoten im Nacken, Wellen nach hinten gelegt, ein paar lose Strähnen an den Schläfen
    add(hairCap(fem, q, 0.011, capMask({ front: 0.0, nape: 0.85 })));
    for (let k = 0; k < N(90); k++) {
      const th0 = rr(-1.65, 1.65), d0 = dirOf(th0, hairLim(th0) + rr(0.03, 0.08)), d1 = dirOf(Math.sign(th0 || 0.01) * rr(2.75, 3.1), -0.32);
      add(hairLock(arcPts(d0, d1, 8, f => 0.012 + 0.005 * Math.max(0, Math.sin(f * 10)) + 0.006 * Math.sin(f * Math.PI), [(d0[0] + d1[0]) * 0.5, 0.95, (d0[2] + d1[2]) * 0.5]), fem, rr(0.008, 0.011), 0.003, { sway: 0.15, swPow: 3 }));
    }
    // Knoten: Strähnen im Kreis gelegt
    const bun = [0, -0.035, -0.112];
    for (let k = 0; k < N(18) ; k++) {
      const a0 = k / 6 * Math.PI * 2, rad = 0.022 + (k % 3) * 0.008, path = [];
      for (let s = 0; s <= 10; s++) { const a = a0 + s / 10 * Math.PI * 1.3; path.push([bun[0] + Math.cos(a) * rad * 1.3, bun[1] + Math.sin(a) * rad, bun[2] - 0.012 * Math.sin(s / 10 * Math.PI) - (k % 3) * 0.006]); }
      add(hTube(path, [0.009, 0.011, 0.011, 0.009], { seg: 5, n: 14, ax: 0.45, fab: FAB.hair, strand: true, swayKind: 1, sway: () => 0.05, up: [0, 0, -1] }));
    }
    // lose Strähnen vor den Ohren, die frei schwingen
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
      const th0 = sd * (1.05 + k * 0.12), pts = [[th0, 0.3, 0.012], [th0 + sd * 0.1, 0.05, 0.016], [th0 + sd * 0.12, -0.2, 0.02]];
      add(hairLock(pts, fem, 0.0045, 0.002, { tail: [p => [p[0] + sd * 0.004, p[1] - 0.025, p[2] + 0.004], p => [p[0] + sd * 0.002, p[1] - 0.02, p[2] - 0.002]], sway: 1, swPow: 1.2, n: 12, seg: 4 }));
    }
  } else {
    // Wasserwellen: kurz, in S-Wellen eng am Kopf, Löckchen im Nacken
    add(hairCap(fem, q, 0.01, capMask({ front: -0.01, nape: 0.9 })));
    for (let k = 0; k < N(100); k++) {
      const th0 = rr(-Math.PI, Math.PI); if (Math.cos(th0) > 0.55) continue;
      const pts = arcPts(dirOf(th0 * 0.2, 1.3), dirOf(th0, -0.15), 9, f => 0.012 + 0.008 * Math.max(0, Math.sin(f * 11)), dirOf(th0 * 0.9, 0.6), (d, f) => { const t = [-d[2], 0, d[0]]; const w = 0.09 * Math.sin(f * 11); return [d[0] + t[0] * w, d[1], d[2] + t[2] * w]; });
      const curl = [p => [p[0] * 1.03, p[1] - 0.012, p[2] * 1.03], p => [p[0] * 0.99, p[1] - 0.018, p[2] * 0.99], p => [p[0] * 0.95, p[1] - 0.008, p[2] * 0.95]];
      add(hairLock(pts, fem, rr(0.008, 0.011), 0.003, { tail: curl, sway: 0.55, swPow: 2.5, n: 18 }));
    }
    // Welle über der Stirn, seitlich gelegt
    for (let k = 0; k < N(14); k++) { const x0 = rr(-0.55, 0.3); add(hairLock(arcPts([x0, 0.75, 0.66], [x0 + 0.65, 0.55, 0.6], 6, f => 0.016 + 0.008 * Math.sin(f * 7), [x0 + 0.3, 0.95, 0.7]), fem, 0.009, 0.0035, { sway: 0.3 })); }
  }
}

/* ---------- Das feine Modell ---------- */
function personGeoHi(kind, q = 1) {
  const key = kind + ':' + q; if (HQ.cache.has(key)) return HQ.cache.get(key);
  const geo = personBuild(kind, q); HQ.cache.set(key, geo); return geo;
}
// eine Kopie mit denselben Puffern (jede Menge hat ihre eigenen Instanz-Attribute)
function personShare(kind, q) {
  const src = personGeoHi(kind, q), g = new T.BufferGeometry();
  for (const k in src.attributes) g.setAttribute(k, src.attributes[k]);
  if (src.index) g.setIndex(src.index);
  return g;
}
function personBuild(kind, q) {
  // Teile: [Geometrie, Farbe, Glied, Drehpunkthöhe, Variante, Stoff]
  const P = []; let LB = [0, 0], HIP = 0.95, OPT = 0, FB = 0;
  const female = kind === 'lady' || kind === 'gown' || kind === 'dress'; const WR = {};
  const S = q > 1.5 ? 1 : 0.55;                                  // Feinheit
  const sg = n => Math.max(6, Math.round(n * S));
  const push = (g, c, fab) => P.push([g, c, LB[0], LB[1], OPT, fab ?? FB ?? 0]);
  const fabOf = c => c === COL.skin ? FAB.skin : c === COL.hair || c === COL.blond ? FAB.hair : c === COL.shirt ? FAB.cotton : c === COL.dark ? FAB.leather : c === COL.gold ? FAB.metal : c === PAINT ? MAINFAB : 0;
  const MAINFAB = kind === 'gown' ? FAB.silk : kind === 'dress' ? FAB.sequin : kind === 'waiter' || kind === 'sailor' || kind === 'worker' || kind === 'kid' ? FAB.cotton : FAB.wool;
  const P0 = (g, c, fab) => push(g, c, fab ?? fabOf(c));
  // einfache Teile wie bisher, nur feiner
  const cyl = (rt, rb, h, x, y, z, c, seg = 10, rx = 0, rz = 0, fab) => { const g = new T.CylinderGeometry(rt, rb, h, sg(seg * 1.4), 1); g.translate(0, h / 2, 0); if (rz) g.rotateZ(rz); if (rx) g.rotateX(rx); P0(g.translate(x, y, z), c, fab); };
  const sph = (r, x, y, z, c, sx = 1, sy = 1, sz = 1, ws = 12, hs = 9, fab) => P0(new T.SphereGeometry(r, sg(ws * 1.3), sg(hs * 1.3)).scale(sx, sy, sz).translate(x, y, z), c, fab);
  const box = (w, h, d, x, y, z, c, rx = 0, ry = 0, rz = 0, fab) => P0(new T.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z), c, fab);
  const tor = (r, t, y, z, c, sz = 0.74, tilt = 0, fab) => P0(new T.TorusGeometry(r, t, sg(6), sg(28)).rotateX(Math.PI / 2 + tilt).scale(1, 1, sz).translate(0, y, z), c, fab);
  const limb = (r0, r1, a, b, c, seg = 12, fab, o = {}) => { const g = hTube([a, b], [r0, r1], { seg: sg(seg * 1.3), n: o.n || sg(6), fold: o.fold, ...o }); P0(g, c, fab); return g; };
  const lathe = (pts, c, sz = 0.74, o = {}) => { const g = hLathe(pts.map(([r, y]) => [r, y]), { ...o, sz, seg: sg(o.seg || 44), rings: sg(o.rings || 30), fab: o.fab ?? fabOf(c) }); P0(g, c, o.fab); return g; };
  const hairC = COL.hair;
  // Männerschultern: schmaler, mit Trapezmuskel zum Hals hin
  const SHO = [[0.208, 1.33], [0.196, 1.395], [0.158, 1.445], [0.095, 1.482], [0.04, 1.494], [0, 1.496]];
  // Faltenwürfe
  const wob = (a, b) => Math.sin(a * 1.7 + b) * 0.5 + Math.sin(a * 2.9 + b * 1.3) * 0.5;
  const jacketFold = (th, y) => { const c = Math.cos(th);
    return -0.004 * Math.abs(Math.sin(th * 3)) * hsm(1.12, 1.0, y) * hsm(0.8, 0.95, y) * (1 - Math.abs(c))       // Taille, seitlich gerafft
      + 0.003 * Math.sin(th * 9 + 1) * hsm(0.98, 0.85, y)                                                       // Schoß fällt in Falten
      + 0.0025 * Math.sin((y - 1.18) * 90 + th) * hsm(1.1, 1.2, y) * hsm(1.32, 1.24, y) * Math.pow(Math.abs(Math.sin(th)), 6); };  // Achselfalten
  const coatFold = (th, y) => 0.006 * Math.sin(th * 7 + wob(y * 4, th)) * hsm(0.98, 0.6, y) + 0.003 * Math.sin(th * 13) * hsm(0.75, 0.48, y) - 0.003 * hsm(1.04, 0.98, y) * hsm(0.94, 0.98, y);
  const trouserFold = sx => (th, v, c) => { const y = c[1], fr = Math.cos(th), bk = -fr;
    return 0.0035 * Math.exp(-((Math.atan2(Math.sin(th), Math.cos(th)) / 0.1) ** 2))                         // Bügelfalte vorn
      + 0.004 * Math.sin((y - 0.4) * 75) * hsm(0.38, 0.46, y) * hsm(0.62, 0.52, y) * Math.max(0, bk)          // Kniekehle
      + 0.006 * Math.max(0, Math.sin((y - 0.1) * 55 + th)) * hsm(0.22, 0.12, y) * Math.max(0, fr) * 0.9; };    // Stoß über dem Schuh
  const sleeveFold = upper => (th, v, c) => { const fr = Math.cos(th), y = c[1];
    const near = upper ? hsm(0.5, 0.95, v) : hsm(0.5, 0.05, v);
    return 0.0035 * Math.sin(v * (upper ? 60 : 50) + th * 0.5) * near * (0.4 + 0.6 * Math.max(0, fr))
      + (upper ? 0 : 0.003 * Math.sin(v * 70) * hsm(0.85, 1.0, v)); };
  /* Kopf mit Hals und Ohren; drei Frisuren je Geschlecht */
  const head = (y) => {
    const neck = hTube([[0, y - 0.215, -0.024], [0, y - 0.16, -0.016], [0, y - 0.1, -0.008], [0, y - 0.05, -0.01]], female ? [0.045, 0.039, 0.04, 0.035] : [0.058, 0.051, 0.05, 0.045], { seg: sg(18), n: sg(8), az: 0.95, fab: FAB.skin });
    P0(neck, COL.skin, FAB.skin);
    if (!female) sph(0.012, 0, y - 0.15, 0.045, COL.skin, 0.8, 1.3, 0.7, 8, 6, FAB.skin);           // Adamsapfel
    const hg = headGeo(q, female); hg.translate(0, y, 0.004); hg.userData.face = true; P0(hg, COL.skin, FAB.skin);
    for (const sx of [-1, 1]) for (const g of earGeo(sx, q, female)) { g.translate(0, y, 0.004); P0(g, COL.skin, FAB.skin); }
    OPT = 11; hairGeo(0, female, q, P, y, OPT, g => { g.translate(0, y, 0.004); P0(g, hairC, FAB.hair); });
    OPT = 12; hairGeo(1, female, q, P, y, OPT, g => { g.translate(0, y, 0.004); P0(g, hairC, FAB.hair); });
    OPT = 13; hairGeo(2, female, q, P, y, OPT, g => { g.translate(0, y, 0.004); P0(g, hairC, FAB.hair); });
    OPT = 0;
  };
  // Hüte: drei Varianten je Art; Variante 3 heißt meistens barhäuptig
  const hats = (y, list) => { list.forEach((fn, i) => { OPT = i + 1; if (fn) fn(y); }); OPT = 0; };
  const brimF = (r0, r1, yy, c, curl = 0.012, fab = FAB.felt) => { const g = hLathe([[r0, yy - 0.004], [r1 * 0.75, yy - 0.003], [r1 * 0.97, yy + curl * 0.3], [r1, yy + curl], [r1 * 0.97, yy + curl + 0.004], [r1 * 0.75, yy + 0.006], [r0, yy + 0.006]], { sz: 1.05, seg: sg(40), rings: sg(14), fab }); P0(g, c, fab); };
  const fedora = c => y => { brimF(0.09, 0.19, y + 0.06, c, 0.014); const cr = hLathe([[0.104, y + 0.06], [0.106, y + 0.12], [0.1, y + 0.17], [0.07, y + 0.19], [0.02, y + 0.175], [0, y + 0.17]], { sz: 1.12, seg: sg(36), rings: sg(14), fab: FAB.felt, fold: (th, yy) => -0.012 * Math.exp(-(((Math.cos(th) - 1) / 0.25) ** 2)) * hsm(y + 0.14, y + 0.18, yy) }); P0(cr, c, FAB.felt); cyl(0.107, 0.107, 0.028, 0, y + 0.064, 0, [0.08, 0.05, 0.03], 16, 0, 0, FAB.silk); };
  const bowler = c => y => { brimF(0.09, 0.16, y + 0.06, c, 0.022); sph(0.11, 0, y + 0.08, 0, c, 1, 0.95, 1.08, 14, 8, FAB.felt); cyl(0.111, 0.111, 0.02, 0, y + 0.063, 0, [0.03, 0.03, 0.03], 16, 0, 0, FAB.silk); };
  const boater = y => { brimF(0.09, 0.2, y + 0.06, [0.82, 0.72, 0.5], 0.002, FAB.straw); cyl(0.105, 0.105, 0.08, 0, y + 0.065, 0, [0.82, 0.72, 0.5], 16, 0, 0, FAB.straw); cyl(0.107, 0.107, 0.028, 0, y + 0.08, 0, [0.08, 0.08, 0.12], 16, 0, 0, FAB.silk); };
  const flatCap = c => y => { sph(0.112, 0, y + 0.075, 0.0, c, 1.05, 0.45, 1.15, 14, 6, FAB.wool); box(0.16, 0.012, 0.08, 0, y + 0.06, 0.11, c, 0.25, 0, 0, FAB.wool); };
  const newsboy = c => y => { sph(0.125, 0, y + 0.08, 0.0, c, 1.08, 0.5, 1.12, 14, 6, FAB.wool); sph(0.02, 0, y + 0.14, 0.0, c, 1, 1, 1, 8, 6, FAB.wool); box(0.15, 0.012, 0.07, 0, y + 0.06, 0.115, c, 0.3, 0, 0, FAB.wool); };
  const cloche = c => y0 => { const y = y0 + 0.04; const g = hLathe([[0.122, y - 0.035], [0.124, y - 0.01], [0.118, y + 0.05], [0.095, y + 0.1], [0.05, y + 0.125], [0, y + 0.13]], { sz: 1.08, seg: sg(36), rings: sg(14), fab: FAB.felt }); g.translate(0, 0, -0.008); P0(g, c, FAB.felt); tor(0.12, 0.012, y - 0.005, -0.008, [0.5, 0.1, 0.12], 1.08, 0, FAB.silk); sph(0.022, 0.085, y + 0.0, 0.05, [0.5, 0.1, 0.12], 1, 0.6, 0.6, 8, 6, FAB.silk); };
  const wideBrim = c => y0 => { const y = y0 + 0.025; brimF(0.1, 0.22, y + 0.02, c, -0.01); sph(0.11, 0, y + 0.05, -0.01, c, 1.0, 0.8, 1.05, 14, 8, FAB.felt); sph(0.035, 0.09, y + 0.07, 0.07, [0.85, 0.3, 0.35], 1, 1, 1, 6, 5, FAB.silk); };
  const headband = y => { tor(0.103, 0.008, y + 0.05, -0.016, COL.gold, 1.08, 0.15); for (let k = 0; k < 3; k++) P0(hTube([[0.065, y + 0.075, -0.03], [0.075 + k * 0.006, y + 0.14, -0.04], [0.06 + k * 0.012, y + 0.22, -0.07 - k * 0.01]], [0.007, 0.012, 0.004], { seg: 5, n: 8, az: 0.25, swayKind: 1, sway: v => v * 0.8, fab: FAB.fur }), [0.95, 0.92, 0.85], FAB.fur); };
  // Schuhe: Leisten mit Sohle, Absatz, Kappe und Schnürung; Damen mit hohem Absatz und Spange
  const shoes = (heel = false) => {
    for (const sx of [-1, 1]) {
      LB = [sx < 0 ? 5 : 6, HIP]; const x = sx * (heel ? 0.085 : 0.1);
      if (heel) {
        const g = hEll(1, [x, 0.07, 0.05], [0.038, 0.032, 0.105], { nu: sg(18), nv: sg(10), fab: FAB.leather, warp: (p) => [p[0] * (p[2] > 0 ? 1 - p[2] * 2.5 : 1), Math.max(p[1], -0.03 + (p[2] + 0.1) * 0.35 * (p[2] < 0.04 ? 1 : 0.2)), p[2]] });
        P0(g, COL.dark, FAB.leather); cyl(0.012, 0.008, 0.075, x, 0.0, -0.035, COL.dark, 6); box(0.07, 0.008, 0.012, x, 0.088, 0.03, COL.dark);
      } else {
        const g = hEll(1, [x, 0.045, 0.055], [0.05, 0.04, 0.14], { nu: sg(22), nv: sg(12), fab: FAB.leather, warp: (p) => [p[0] * (1 - Math.max(0, p[2] - 0.06) * 3) * (p[2] < -0.06 ? 0.92 : 1), Math.max(p[1], -0.035) + (p[2] > 0.05 ? -(p[2] - 0.05) * 0.25 : 0), p[2]] });
        P0(g, COL.dark, FAB.leather);
        box(0.1, 0.022, 0.29, x, 0.011, 0.055, [0.025, 0.02, 0.02], 0, 0, 0, FAB.leather);
        for (let k = 0; k < 3; k++) box(0.04, 0.004, 0.006, x, 0.08 - k * 0.006, 0.07 + k * 0.022, [0.06, 0.05, 0.04]);
      }
    }
    LB = [0, 0];
  };
  // Hände: flacher Handteller, vier Finger aus drei Gliedern (locker gekrümmt), Daumen; ins zeigt zur Handfläche
  const hand = (wr, sx, c) => {
    const fab = c === COL.skin ? FAB.skin : FAB.leather, ins = -sx, [wx, wy, wz] = wr;
    // Handteller als abgerundeter Quader: oben schmal am Handgelenk, unten breit über den Fingerknöcheln
    const box3 = (v, r, e) => Math.sign(v) * Math.pow(Math.abs(v) / r, e) * r;
    P0(hEll(1, [wx + ins * 0.001, wy - 0.05, wz + 0.002], [0.0135, 0.046, 0.037], { nu: sg(22), nv: sg(16), fab,
      warp: p => { const t = hsm(0.046, -0.04, p[1]); return [box3(p[0], 0.0135, 0.8) * (0.85 + 0.15 * t) - ins * 0.0025 * (1 - (p[2] / 0.037) ** 2) * t, box3(p[1], 0.046, 0.55), box3(p[2], 0.037, 0.6) * (0.78 + 0.22 * t)]; } }), c, fab);
    const FZ = [-0.026, -0.0088, 0.0085, 0.0255], FL = [0.058, 0.074, 0.08, 0.072], FR = [0.0072, 0.0082, 0.0086, 0.0084];
    for (let k = 0; k < 4; k++) {
      const z = wz + FZ[k], L = FL[k], r = FR[k], x0 = wx + ins * 0.001, y0 = wy - (k === 0 ? 0.08 : 0.086);
      const pts = [[x0, y0 + 0.008, z]]; let px = x0, py = y0, ang = 0;
      pts.push([px, py, z]);
      for (const [f, a] of [[0.45, 0.16], [0.3, 0.22], [0.25, 0.2]]) { ang += a; px += ins * Math.sin(ang) * L * f; py -= Math.cos(ang) * L * f; pts.push([px, py, z]); }
      pts.push([px + ins * Math.sin(ang) * 0.004, py - Math.cos(ang) * 0.004, z]);
      P0(hTube(pts, [r * 1.1, r * 1.05, r * 0.93, r * 0.84, r * 0.74, r * 0.2], { seg: sg(10), n: sg(16), fab, az: 0.88 }), c, fab);
    }
    P0(hTube([[wx + ins * 0.004, wy - 0.03, wz + 0.02], [wx + ins * 0.01, wy - 0.05, wz + 0.04], [wx + ins * 0.016, wy - 0.07, wz + 0.05], [wx + ins * 0.02, wy - 0.087, wz + 0.052], [wx + ins * 0.021, wy - 0.092, wz + 0.051]], [0.0135, 0.0108, 0.0092, 0.0078, 0.0018], { seg: sg(9), n: sg(12), fab }), c, fab);
  };
  // Requisiten in den Händen (blendet der Shader je nach Handlung ein): Sektschale, belegtes Brot in drei Bissen, Gabel und Messer
  const props = () => {
    const wr = WR[-1], wl = WR[1], top = WR.top; if (!wr) return;
    const hx = wr[0] - 0.004, hy = wr[1] - 0.07, hz = wr[2] + 0.02;
    LB = [7, top];
    OPT = 41;
    { const g = new T.LatheGeometry([[0, 0], [0.03, 0], [0.03, 0.005], [0.006, 0.014], [0.005, 0.07], [0.04, 0.078], [0.055, 0.1], [0.052, 0.102], [0.0, 0.086]].map(([r, y]) => new T.Vector2(r, y)), 14);
      g.rotateX(Math.PI / 2).translate(hx, hy, hz - 0.06); P0(g, [0.82, 0.86, 0.88], FAB.metal);
      const w = new T.CylinderGeometry(0.044, 0.03, 0.012, 14).rotateX(Math.PI / 2).translate(hx, hy, hz + 0.034); P0(w, [0.95, 0.78, 0.38], 0); }
    const bread = [0.66, 0.44, 0.2], fill = [0.75, 0.32, 0.26];
    [[42, 0.105], [43, 0.06], [44, 0.015]].forEach(([o, dz]) => {
      OPT = o;
      P0(new T.CylinderGeometry(0.03, 0.03, 0.046, 10).scale(1, 1, 0.8).rotateX(Math.PI / 2).translate(hx, hy, hz + dz), bread, 0);
      P0(new T.CylinderGeometry(0.032, 0.032, 0.044, 10).scale(1, 0.25, 0.85).rotateX(Math.PI / 2).translate(hx, hy, hz + dz), fill, 0);
    });
    OPT = 45; limb(0.005, 0.004, [hx, hy, hz - 0.05], [hx, hy + 0.01, hz + 0.12], [0.85, 0.86, 0.88], 5, FAB.metal); box(0.022, 0.003, 0.04, hx, hy + 0.012, hz + 0.14, [0.85, 0.86, 0.88], 0, 0, 0, FAB.metal);
    if (wl) { LB = [8, top]; OPT = 46; limb(0.005, 0.004, [wl[0] + 0.004, wl[1] - 0.07, wl[2] - 0.03], [wl[0] + 0.004, wl[1] - 0.06, wl[2] + 0.15], [0.85, 0.86, 0.88], 5, FAB.metal); }
    // V18: Werkzeuge in der Faust (starr am Unterarm)
    const wood = [0.42, 0.27, 0.14], iron = [0.2, 0.2, 0.22], fx = wr[0] + 0.012, fy = wr[1] - 0.088, fz = wr[2] + 0.008;
    LB = [7, top];
    OPT = 56; limb(0.011, 0.013, [fx, fy, fz - 0.05], [fx, fy, fz + 0.25], wood, 8, FAB.leather); box(0.03, 0.115, 0.034, fx, fy - 0.005, fz + 0.26, iron, 0, 0, 0, FAB.metal);   // Hammer
    OPT = 58; limb(0.0035, 0.003, [fx - 0.004, fy + 0.012, fz + 0.012], [fx + 0.012, fy - 0.075, fz + 0.06], [0.85, 0.7, 0.2], 5, FAB.leather);                        // Bleistift
    OPT = 59; sph(0.032, fx + 0.006, fy - 0.012, fz, [0.82, 0.78, 0.66], 0.85, 1.25, 1.05, 9, 7, FAB.cotton);                                                       // Lappen
    OPT = 60; limb(0.008, 0.009, [fx, fy + 0.01, fz - 0.03], [fx, fy, fz + 0.16], wood, 7, FAB.leather); box(0.03, 0.012, 0.03, fx, fy, fz + 0.17, [0.75, 0.66, 0.4], 0, 0, 0, FAB.metal); box(0.036, 0.012, 0.045, fx, fy, fz + 0.2, [0.62, 0.12, 0.1], 0, 0, 0, FAB.fur);   // Pinsel mit roter Farbe
    OPT = 61; limb(0.0042, 0.0042, [fx - 0.004, wr[1] - 0.132, wr[2] + 0.004], [fx - 0.004, wr[1] - 0.132, wr[2] + 0.075], [0.95, 0.93, 0.88], 6, FAB.cotton); sph(0.0046, fx - 0.004, wr[1] - 0.132, wr[2] + 0.077, [1.0, 0.45, 0.12], 1, 1, 1, 6, 5, 0);   // Zigarette, Glut
    OPT = 62; { for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, r = k ? 0.028 : 0; limb(0.003, 0.003, [fx, fy, fz - 0.03], [fx + Math.cos(a) * r * 0.6, fy + Math.sin(a) * r * 0.6, fz + 0.2], [0.2, 0.4, 0.15], 4, FAB.cotton); sph(0.022, fx + Math.cos(a) * r, fy + Math.sin(a) * r, fz + 0.21, [[0.85, 0.12, 0.18], [0.95, 0.85, 0.8], [0.9, 0.5, 0.6]][k % 3], 1, 1, 0.8, 8, 6, FAB.silk); }
      P0(new T.CylinderGeometry(0.06, 0.018, 0.16, sg(14), 1, true).rotateX(Math.PI / 2).translate(fx, fy, fz + 0.1), [0.92, 0.9, 0.84], FAB.cotton); }          // Blumenstrauß
    if (wl) { LB = [8, top]; OPT = 57; box(0.014, 0.15, 0.105, wl[0] - 0.03, wl[1] - 0.09, wl[2] + 0.01, [0.9, 0.88, 0.8], 0, 0, 0, FAB.cotton); box(0.004, 0.152, 0.107, wl[0] - 0.022, wl[1] - 0.09, wl[2] + 0.01, [0.25, 0.12, 0.08], 0, 0, 0, FAB.leather); }   // Notizblock
    // Werkzeuge mit zwei Händen: in eigenem Raum, der Shader legt sie zwischen die Hände
    LB = [9, 0];
    OPT = 51; limb(0.013, 0.014, [0, 0.06, 0], [0, -1.16, 0], wood, 8, FAB.leather); box(0.22, 0.05, 0.05, 0, -1.16, 0, [0.3, 0.2, 0.1], 0, 0, 0, FAB.leather);
      P0(hLathe([[0.11, -1.17], [0.13, -1.25], [0.15, -1.33], [0.001, -1.335]], { sz: 0.22, seg: sg(16), rings: sg(6), fab: FAB.straw }), [0.68, 0.55, 0.32], FAB.straw);   // Besen
    OPT = 52; box(0.12, 0.022, 0.026, 0, 0.02, 0, wood, 0, 0, 0, FAB.leather); for (const x of [-0.05, 0.05]) limb(0.008, 0.008, [x, 0.02, 0], [0, -0.08, 0], wood, 5, FAB.leather); limb(0.016, 0.017, [0, -0.08, 0], [0, -0.96, 0], wood, 8, FAB.leather);
      box(0.24, 0.3, 0.008, 0, -1.1, 0.012, iron, 0.12, 0, 0, FAB.metal); box(0.25, 0.02, 0.03, 0, -0.96, 0.0, iron, 0, 0, 0, FAB.metal);      // Schaufel
    OPT = 53; box(0.46, 0.3, 0.34, 0, 0, 0, [0.55, 0.4, 0.22], 0, 0, 0, FAB.straw); for (const y of [-0.1, 0.1]) box(0.47, 0.035, 0.35, 0, y, 0, [0.36, 0.25, 0.13], 0, 0, 0, FAB.leather); box(0.3, 0.06, 0.004, 0, 0.0, 0.172, [0.1, 0.08, 0.06]);   // Kiste
    OPT = 54; P0(new T.TorusGeometry(0.18, 0.0155, sg(10), sg(40)), [0.05, 0.035, 0.03], FAB.leather); for (let k = 0; k < 3; k++) box(0.012, 0.17, 0.008, Math.sin(k * 2.094) * 0.085, Math.cos(k * 2.094 + Math.PI) * 0.085, 0.012, [0.72, 0.6, 0.38], 0, 0, -k * 2.094, FAB.metal); P0(new T.CylinderGeometry(0.03, 0.035, 0.04, sg(14)).rotateX(Math.PI / 2).translate(0, 0, 0.02), [0.72, 0.6, 0.38], FAB.metal);   // Lenkrad
    OPT = 55; for (const sx of [-1, 1]) { box(0.28, 0.38, 0.004, sx * 0.138, 0, 0, [0.88, 0.86, 0.8], 0, sx * 0.14, 0, FAB.cotton); for (let k = 0; k < 4; k++) box(0.1, 0.008 + (k ? 0 : 0.02), 0.006, sx * 0.14 + (k % 2 ? 0.05 : -0.05) * 0.7, 0.14 - k * 0.07, 0, [0.15, 0.14, 0.13], 0, sx * 0.14, 0, FAB.cotton); }   // Zeitung
    LB = [0, 0]; OPT = 0;
  };
  const sleeveFoldC = (th, v, cc) => { const fr = Math.cos(th);
    return 0.0035 * Math.sin(v * 75 + th * 0.5) * hsm(0.5, 0.64, v) * hsm(0.8, 0.68, v) * (0.3 + 0.7 * Math.max(0, fr))     // Ellbogenfalten innen
      + 0.0025 * Math.sin(v * 46 + th) * hsm(0.12, 0.22, v) * hsm(0.4, 0.3, v) * Math.max(0, -Math.sin(th * 0.5 + 1))         // Achsel
      + 0.003 * Math.sin(v * 90) * hsm(0.86, 1.0, v); };                                                                         // Stoff staucht sich am Handgelenk
  const arms = (top, len, c, opts = {}) => {
    const S = opts.spread ?? 0.215, hc = opts.hand ?? COL.skin, bare = c === COL.skin;
    for (const sx of [-1, 1]) {
      LB = [sx < 0 ? 3 : 4, top];
      const el = [sx * (S + 0.022), top - len * 0.5, -0.025], wr = [sx * (S + 0.008), top - len, 0.05];
      const path = [[sx * (S - 0.078), top - 0.016, 0.0], [sx * (S - 0.034), top + 0.002, 0.0], [sx * (S - 0.002), top - 0.045, -0.004], [sx * (S + 0.014), top - 0.15, -0.012], el, [sx * (S + 0.017), top - len * 0.75, 0.014], wr];
      const rad = bare ? [0.034, 0.045, 0.046, 0.041, 0.031, 0.034, 0.024] : [0.046, 0.056, 0.057, 0.054, 0.05, 0.047, 0.044];
      if (opts.rolled) {
        // Hemdsärmel bis über den Ellbogen, aufgekrempelt, darunter nackter Unterarm
        const mid = [el[0] + (wr[0] - el[0]) * 0.3, el[1] + (wr[1] - el[1]) * 0.3, el[2] + (wr[2] - el[2]) * 0.3];
        P0(hTube([...path.slice(0, 5), mid], [...rad.slice(0, 5), 0.054], { seg: sg(24), n: sg(28), fold: sleeveFoldC, az: 0.95 }), c);
        P0(hTube([[mid[0], mid[1] + 0.03, mid[2] - 0.006], mid, [mid[0], mid[1] - 0.025, mid[2] + 0.006]], [0.056, 0.062, 0.056], { seg: sg(20), n: sg(8), fold: (th, v) => 0.005 * Math.sin(v * 28 + th * 2) }), c);
        P0(hTube([[el[0], el[1] + 0.02, el[2]], el, [sx * (S + 0.017), top - len * 0.75, 0.014], wr], [0.033, 0.034, 0.036, 0.025], { seg: sg(20), n: sg(18), fab: FAB.skin }), COL.skin, FAB.skin);
      } else {
        P0(hTube(path, rad, { seg: sg(24), n: sg(36), fold: bare ? null : sleeveFoldC, az: bare ? 0.92 : 0.95, fab: bare ? FAB.skin : undefined }), c, bare ? FAB.skin : undefined);
        if (opts.cuff) P0(hTube([[wr[0], wr[1] + 0.03, wr[2] - 0.004], [wr[0], wr[1] + 0.008, wr[2] - 0.001], [wr[0], wr[1] - 0.006, wr[2]]], [0.043, 0.043, 0.041], { seg: sg(20), n: sg(6) }), opts.cuff);
      }
      hand(wr, sx, hc); WR[sx] = wr; WR.top = top;
    }
    LB = [0, 0];
  };
  // Dinge, die eine Figur bei sich trägt (Variante je Figur): Aktentasche, Spazierstock, Zeitung unter dem Arm
  const carry = (top, list) => {
    const wr = WR[1], wl = WR[-1];
    list.forEach((k, i) => { OPT = k === 'news' ? 0 : 31 + i;
      if (k === 'case') { LB = [8, top]; box(0.36, 0.26, 0.09, wr[0] + 0.02, wr[1] - 0.27, wr[2], [0.22, 0.12, 0.06], 0, 0, 0, FAB.leather); box(0.1, 0.03, 0.03, wr[0] + 0.02, wr[1] - 0.12, wr[2], [0.1, 0.06, 0.03], 0, 0, 0, FAB.leather); box(0.37, 0.02, 0.095, wr[0] + 0.02, wr[1] - 0.2, wr[2], COL.gold); }
      else if (k === 'cane') { LB = [8, top]; limb(0.012, 0.012, [wr[0] + 0.01, wr[1] - 0.08, wr[2] + 0.02], [wr[0] + 0.03, 0.03, wr[2] + 0.12], [0.08, 0.05, 0.03], 6, FAB.leather); sph(0.022, wr[0] + 0.01, wr[1] - 0.06, wr[2] + 0.02, COL.gold); }
      else if (k === 'paper') { LB = [3, top]; box(0.03, 0.3, 0.2, wl[0] + 0.04, wl[1] + 0.22, wl[2] - 0.02, [0.85, 0.82, 0.74], 0, 0, 0, FAB.cotton); }
      else if (k === 'umbrella') { LB = [8, top]; limb(0.02, 0.035, [wr[0], wr[1] - 0.08, wr[2]], [wr[0] + 0.02, 0.12, wr[2] + 0.1], [0.06, 0.06, 0.07], 8, FAB.silk); }
      else if (k === 'bag') { LB = [7, top]; box(0.3, 0.26, 0.14, wl[0] - 0.03, wl[1] - 0.25, wl[2], [0.45, 0.35, 0.2], 0, 0, 0, FAB.leather); }
      else if (k === 'news') { LB = [0, 0]; box(0.3, 0.3, 0.1, 0.25, 0.85, 0.05, [0.4, 0.3, 0.18], 0, 0, 0, FAB.leather); box(0.26, 0.08, 0.06, 0.25, 1.02, 0.06, [0.88, 0.85, 0.78], 0, 0, 0, FAB.cotton); limb(0.012, 0.012, [0.25, 1.0, 0.05], [-0.12, 1.42, 0.08], [0.3, 0.22, 0.12], 4, FAB.leather); }
      LB = [0, 0]; });
    OPT = 0;
  };
  // Beine: Hose mit Bund, Bügelfalte, Kniekehle und Aufschlag
  const legs = (c, cuff = true, shin) => {
    for (const sx of [-1, 1]) {
      const x = sx * 0.1;
      LB = [sx < 0 ? 5 : 6, HIP];
      if (shin) {
        P0(hTube([[x, 0.075, 0.002], [x, 0.22, -0.012], [x, 0.36, -0.004], [x, 0.43, 0.0]], [0.04, 0.05, 0.048, 0.046], { seg: sg(22), n: sg(16), fab: FAB.knit }), shin, FAB.knit);
        P0(hTube([[x, 0.4, 0.0], [x, 0.494, 0.006], [x * 0.97, 0.7, 0.006], [x * 0.93, 0.96, 0]], [0.043, 0.047, 0.06, 0.08], { seg: sg(22), n: sg(18), fab: FAB.skin }), COL.skin, FAB.skin);
      } else {
        P0(hTube([[x, 0.075, 0.004], [x, 0.25, -0.004], [x, 0.494, 0.005], [x * 0.97, 0.72, 0.005], [x * 0.93, 0.98, 0]], [0.068, 0.064, 0.069, 0.085, 0.097], { seg: sg(26), n: sg(34), fold: (th, v, cc) => trouserFold(sx)(th, v, cc) + 0.0035 * Math.sin(v * 60 + th) * hsm(0.36, 0.44, v) * hsm(0.56, 0.48, v) * Math.max(0, -Math.cos(th)) }), c);
        if (cuff) P0(hTube([[x, 0.075, 0.004], [x, 0.1, 0.002], [x, 0.122, 0.0]], [0.071, 0.072, 0.07], { seg: sg(22), n: sg(5) }), c);
      }
    }
    LB = [0, 0];
  };
  // Hemdkragen um den Hals (Stehkragen mit Ecken beim Frack), Fliege am Kragen
  const collar = (wing) => { P0(hLathe([[0.059, 1.458], [0.064, 1.468], [0.062, 1.505], [0.059, 1.514], [0.055, 1.511]], { sz: 0.95, seg: sg(32), rings: sg(6), fab: FAB.cotton }).translate(0, 0, 0.006), COL.shirt, FAB.cotton);
    if (wing) for (const sx of [-1, 1]) box(0.022, 0.016, 0.004, sx * 0.016, 1.482, 0.066, COL.shirt, 0.3, 0, sx * 0.5, FAB.cotton); };
  const bow = (c) => { for (const sx of [-1, 1]) P0(hEll(1, [sx * 0.022, 1.474, 0.066], [0.022, 0.014, 0.008], { nu: sg(10), nv: sg(6), fab: FAB.satin }), c, FAB.satin); sph(0.009, 0, 1.474, 0.07, c, 1, 1, 0.8, 6, 5, FAB.satin); };
  const tieOpts = (y0, y1, z) => { [[0.45, 0.06, 0.08], [0.1, 0.16, 0.3], [0.5, 0.4, 0.15]].forEach((c, i) => { OPT = 21 + i; strip([[0, y1 - 0.01], [0, (y0 + y1) / 2], [0, y0]], [0.03, 0.038, 0.044], z, 0.006, c, FAB.silk, 6); box(0.03, 0.03, 0.018, 0, y1 - 0.004, BODY.userData.surf(0, y1 - 0.01) + z + 0.008, c, -0.3, 0, 0, FAB.silk); }); OPT = 0; };
  // Band auf dem Körper (Revers, Krawatte, Knopfleiste): Pfad in x/y, Breiten, folgt der Oberfläche des zuletzt gebauten Rumpfs
  let BODY = null;
  const strip = (pts, ws, off, th, c, fab, swayKind = 0, side = 1) => {
    const n = sg(14), C = hSpline(pts, n), Wd = hSpline(ws.map(w => [w]), n).map(w => w[0]);
    const surf = (x, y) => BODY ? BODY.userData.surf(x, y, side) : 0.17 * side;
    const g = hGrid(4, n - 1, (u, v) => {
      const k = Math.round(v * (n - 1)), c0 = C[k], c1 = C[Math.min(n - 1, k + 1)], c_ = C[Math.max(0, k - 1)];
      let dx = c1[0] - c_[0], dy = c1[1] - c_[1]; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const side4 = Math.floor(u * 4 + 1e-6) % 4, lr = side4 === 0 || side4 === 3 ? 1 : -1, tb = side4 < 2 ? 1 : 0;
      const x = c0[0] - dy * Wd[k] / 2 * lr, y = c0[1] + dx * Wd[k] / 2 * lr;
      return { p: [x, y, surf(x, y) + side * (off + th * tb)], s: [fab ?? fabOf(c), swayKind ? hsm(0.0, 1.0, v) * 0.6 : 0, swayKind] };
    }, true, false);
    // Oberseite nach außen
    const nz = g.attributes.normal.getZ(0) * side; if (nz < 0) hFlip(g);
    P0(g, c, fab);
  };

  // Gürtel, Bund, Kummerbund: ein Band, das dem Rumpf folgt
  const band = (y, h, off, c, fab) => { const r = BODY.userData.rAt, y0 = y - h / 2, y1 = y + h / 2; P0(hLathe([[r(y0) - 0.004, y0], [r(y0) + off, y0 + 0.002], [r(y) + off * 1.1, y], [r(y1) + off, y1 - 0.002], [r(y1) - 0.004, y1]], { sz: BODY.userData.sz, seg: sg(48), rings: sg(8), fab: fab ?? fabOf(c) }), c, fab); };
  if (!female) {
    const NAVY = [0.06, 0.08, 0.2];
    const legC = kind === 'coat' ? [0.07, 0.07, 0.08] : kind === 'worker' ? [0.17, 0.14, 0.11] : kind === 'suit' || kind === 'police' || kind === 'chauffeur' ? PAINT : kind === 'kid' ? [0.3, 0.24, 0.16] : kind === 'sailor' ? NAVY : COL.tux;
    FB = kind === 'worker' ? FAB.cotton : FAB.wool;
    shoes(); if (kind === 'kid') legs(legC, false, [0.62, 0.6, 0.56]); else legs(legC);
    FB = 0;
    if (kind === 'coat') {
      // Mantel: zweireihig, Gürtel, Kragen, Taschenklappen, Schal; der Schoß schwingt
      BODY = lathe([[0.001, 0.48], [0.265, 0.5], [0.25, 0.62], [0.232, 0.85], [0.212, 1.0], [0.232, 1.18], [0.252, 1.32], [0.21, 1.4], [0.12, 1.445], [0, 1.45]], PAINT, 0.74, { fold: coatFold, swayKind: 4, sway: y => hsm(0.95, 0.5, y) });
      strip([[0.03, 0.5], [0.03, 1.0], [0.06, 1.3]], [0.016, 0.016, 0.016], 0.002, 0.004, [0.04, 0.04, 0.045], FAB.wool);
      for (const y of [0.88, 1.02, 1.16]) for (const sx of [-0.055, 0.055]) sph(0.012, sx, y, BODY.userData.surf(sx, y) + 0.004, COL.dark, 1, 1, 0.6, 6, 4, FAB.leather);
      band(1.0, 0.045, 0.008, [0.1, 0.07, 0.05], FAB.leather); box(0.05, 0.04, 0.012, 0, 1.0, BODY.userData.surf(0, 1.0) + 0.012, COL.gold);
      for (const sx of [-1, 1]) { box(0.11, 0.025, 0.03, sx * 0.12, 0.82, 0.18, [0.06, 0.06, 0.065], 0, 0, sx * 0.08, FAB.wool); strip([[sx * 0.07, 1.42], [sx * 0.1, 1.33], [sx * 0.085, 1.2]], [0.05, 0.08, 0.02], 0.004, 0.008, PAINT, FAB.wool); }
      const scarf = Math.random() < 0.5 ? COL.shirt : [0.5, 0.08, 0.1];
      tor(0.08, 0.03, 1.42, 0.01, scarf, 1, 0, FAB.knit);
      strip([[0.04, 1.4], [0.06, 1.25], [0.06, 1.1]], [0.06, 0.06, 0.055], 0.012, 0.01, scarf, FAB.knit, 6);
      arms(1.34, 0.56, PAINT, { hand: Math.random() < 0.5 ? COL.dark : COL.skin });
      head(1.62); hats(1.62, [fedora(COL.dark), bowler([0.05, 0.045, 0.04]), null]);
      carry(1.34, ['case', 'cane', 'paper']);
    } else if (kind === 'police') {
      // Schutzmann: Uniformrock mit Messingknöpfen, Koppel mit Schulterriemen, Schirmmütze, Schlagstock
      BODY = lathe([[0.001, 0.76], [0.212, 0.76], [0.208, 0.9], [0.19, 1.04], [0.2, 1.22], ...SHO], PAINT, 0.74, { fold: jacketFold });
      for (const y of [0.88, 0.99, 1.1, 1.21, 1.32]) sph(0.011, 0, y, BODY.userData.surf(0, y) + 0.003, COL.gold, 1, 1, 0.6, 6, 4);
      band(0.98, 0.05, 0.008, [0.1, 0.06, 0.03], FAB.leather); box(0.05, 0.045, 0.012, 0, 0.98, BODY.userData.surf(0, 0.98) + 0.012, COL.gold);
      box(0.04, 0.62, 0.012, 0.0, 1.2, 0.168, [0.1, 0.06, 0.03], 0, 0, 0.62, FAB.leather); box(0.04, 0.6, 0.012, 0.0, 1.2, -0.168, [0.1, 0.06, 0.03], 0, 0, -0.62, FAB.leather);
      tor(0.07, 0.02, 1.42, 0.0, PAINT, 1); limb(0.018, 0.018, [-0.22, 0.95, 0.06], [-0.24, 0.6, 0.1], [0.06, 0.04, 0.03], 6, FAB.leather);
      for (const sx of [-1, 1]) box(0.05, 0.02, 0.08, sx * 0.2, 1.4, 0, COL.gold);
      arms(1.34, 0.56, PAINT, { cuff: PAINT });
      head(1.62); cyl(0.108, 0.104, 0.08, 0, 1.69, 0, PAINT, 16); cyl(0.13, 0.115, 0.035, 0, 1.765, 0, PAINT, 18); box(0.18, 0.012, 0.08, 0, 1.69, 0.1, [0.02, 0.02, 0.02], 0.2, 0, 0, FAB.leather); sph(0.018, 0, 1.74, 0.11, COL.gold, 1, 1, 0.5, 6, 4); tor(0.109, 0.01, 1.7, 0, [0.02, 0.02, 0.02], 1, 0, FAB.leather);
    } else if (kind === 'kid') {
      // Zeitungsjunge: kurze Hose, Kniestrümpfe, Hemd mit Weste, Schiebermütze, Tasche mit Zeitungen
      BODY = lathe([[0.001, 0.5], [0.2, 0.5], [0.205, 0.62], [0.2, 0.86], [0.196, 1.05], [0.208, 1.22], ...SHO], PAINT, 0.74, { fold: jacketFold });
      lathe([[0.204, 0.88], [0.2, 1.05], [0.226, 1.22], [0.236, 1.3], [0.12, 1.33]], [0.2, 0.17, 0.13], 0.76, { fab: FAB.wool });
      lathe([[0.21, 0.5], [0.215, 0.62], [0.205, 0.9], [0.001, 0.9]], [0.3, 0.24, 0.16], 0.76, { fab: FAB.wool });
      arms(1.34, 0.56, PAINT, { rolled: true });
      carry(1.34, ['news']); OPT = 0;
      head(1.62); hats(1.62, [flatCap([0.25, 0.22, 0.18]), newsboy([0.2, 0.17, 0.13]), newsboy([0.3, 0.26, 0.2])]);
    } else if (kind === 'worker') {
      // Arbeiter: Hemd mit hochgekrempelten Ärmeln (Instanzfarbe), dunkle Weste, Hosenträger, Mütze
      BODY = lathe([[0.001, 0.86], [0.2, 0.86], [0.205, 0.95], [0.196, 1.05], [0.208, 1.22], ...SHO], PAINT, 0.74, { fold: (th, y) => jacketFold(th, y) + 0.003 * Math.sin(th * 11 + y * 30) * hsm(1.1, 0.95, y) });
      const vest = lathe([[0.206, 0.88], [0.21, 0.95], [0.2, 1.05], [0.226, 1.22], [0.236, 1.3], [0.12, 1.33]], [0.09, 0.08, 0.075], 0.76, { fab: FAB.wool, fold: (th) => -0.03 * Math.exp(-((Math.atan2(Math.sin(th), Math.cos(th)) / 0.2) ** 2)) });
      for (const y of [0.95, 1.03, 1.11, 1.19]) sph(0.009, 0.0, y, 0.15, [0.3, 0.26, 0.18], 1, 1, 0.6, 5, 3);
      box(0.06, 0.06, 0.012, 0.09, 1.2, 0.168, [0.07, 0.06, 0.055], 0, 0, 0, FAB.wool);
      box(0.01, 0.12, 0.004, 0.07, 1.06, 0.155, COL.gold);                                                  // Uhrkette
      band(0.9, 0.04, 0.006, [0.12, 0.08, 0.05], FAB.leather);
      tor(0.065, 0.015, 1.415, 0.02, PAINT, 1);
      arms(1.34, 0.56, PAINT, { rolled: true });
      head(1.62); hats(1.62, [flatCap([0.2, 0.18, 0.15]), newsboy([0.14, 0.12, 0.1]), null]);
    } else if (kind === 'waiter') {
      // Kellner: kurze weiße Jacke (Instanzfarbe), Fliege, Kummerbund, Serviette über dem linken Unterarm
      BODY = lathe([[0.001, 0.86], [0.205, 0.86], [0.205, 0.92], [0.188, 1.04], [0.2, 1.22], ...SHO], PAINT, 0.74, { fold: jacketFold });
      strip([[0, 1.38], [0, 1.2], [0, 1.06]], [0.11, 0.12, 0.1], 0.001, 0.003, COL.shirt, FAB.cotton);
      collar(true);
      bow(COL.tux);
      band(0.92, 0.09, 0.006, COL.tux, FAB.satin);
      for (const y of [1.0, 1.1, 1.2]) sph(0.009, 0.06, y, BODY.userData.surf(0.06, y) + 0.003, COL.gold, 1, 1, 0.5, 5, 3);
      arms(1.34, 0.56, PAINT, { cuff: COL.shirt });
      LB = [7, 1.34]; box(0.03, 0.24, 0.13, -0.31, 0.86, 0.02, [0.96, 0.95, 0.92], 0, 0, 0, FAB.cotton); LB = [0, 0];
      head(1.62);
    } else if (kind === 'sailor') {
      // Matrose: Bluse (Instanzfarbe) mit blauem Kragen, Halstuch, weite Hose, weiße Mütze
      BODY = lathe([[0.001, 0.86], [0.2, 0.86], [0.205, 0.95], [0.196, 1.05], [0.208, 1.22], ...SHO], PAINT, 0.74, { fold: (th, y) => jacketFold(th, y) + 0.004 * Math.sin(th * 10) * hsm(1.05, 0.9, y) });
      strip([[0, 1.42], [0, 1.32], [0, 1.22]], [0.34, 0.36, 0.36], 0.002, 0.004, NAVY, FAB.cotton, 0, -1);
      for (const sx of [-1, 1]) strip([[sx * 0.11, 1.42], [sx * 0.05, 1.3], [0, 1.2]], [0.035, 0.035, 0.03], 0.002, 0.004, NAVY, FAB.cotton);
      strip([[0, 1.22], [0, 1.15], [0.01, 1.08]], [0.05, 0.04, 0.025], 0.006, 0.006, COL.dark, FAB.silk, 6);
      band(0.89, 0.05, 0.006, NAVY, FAB.cotton);
      arms(1.34, 0.56, PAINT, { cuff: NAVY });
      head(1.62); cyl(0.105, 0.1, 0.06, 0, 1.68, 0, [0.95, 0.95, 0.93], 14, 0, 0, FAB.cotton); tor(0.106, 0.018, 1.74, 0, [0.95, 0.95, 0.93], 1, 0, FAB.cotton);
    } else if (kind === 'chauffeur') {
      // Chauffeur: zweireihige Uniformjacke (Instanzfarbe), Lederhandschuhe, Schirmmütze
      BODY = lathe([[0.001, 0.7], [0.225, 0.7], [0.22, 0.85], [0.205, 1.02], [0.208, 1.22], ...SHO], PAINT, 0.74, { fold: jacketFold, swayKind: 4, sway: y => hsm(0.9, 0.7, y) * 0.6 });
      for (const y of [0.9, 1.02, 1.14, 1.26]) for (const sx of [-0.06, 0.06]) sph(0.01, sx, y, BODY.userData.surf(sx, y) + 0.003, COL.gold, 1, 1, 0.6, 5, 3);
      band(0.98, 0.045, 0.007, [0.05, 0.04, 0.035], FAB.leather); tor(0.07, 0.025, 1.42, 0, PAINT, 1);
      arms(1.34, 0.56, PAINT, { hand: COL.dark });
      head(1.62); cyl(0.106, 0.104, 0.07, 0, 1.69, 0, PAINT, 16); cyl(0.125, 0.112, 0.03, 0, 1.755, 0, PAINT, 18); box(0.17, 0.012, 0.08, 0, 1.69, 0.1, [0.02, 0.02, 0.02], 0.2, 0, 0, FAB.leather);
    } else {
      // Anzug, Frack, Livree: Sakko mit Revers, Hemdbrust, Weste, Einstecktuch
      const jacket = kind === 'tux' ? COL.tux : PAINT;
      BODY = lathe([[0.001, 0.8], [0.205, 0.8], [0.205, 0.9], [0.188, 1.04], [0.2, 1.22], ...SHO], jacket, 0.74, { fab: FAB.wool, fold: (th, y) => jacketFold(th, y) - 0.012 * Math.exp(-((Math.atan2(Math.sin(th), Math.cos(th)) / 0.32) ** 2)) * hsm(1.05, 1.2, y) * hsm(1.42, 1.35, y), swayKind: 4, sway: y => hsm(0.95, 0.8, y) * 0.4 });
      strip([[0, 1.4], [0, 1.25], [0, 1.08]], [0.1, 0.12, 0.09], 0.0, 0.003, COL.shirt, FAB.cotton);
      collar(kind === 'tux');
      if (kind === 'suit') { strip([[0, 1.15], [0, 1.06], [0, 0.98]], [0.15, 0.15, 0.13], 0.0, 0.004, [0.08, 0.075, 0.07], FAB.wool); for (const y of [1.02, 1.08, 1.14]) sph(0.007, 0, y, BODY.userData.surf(0, y) + 0.006, COL.gold, 1, 1, 0.5, 4, 3); collar(false); tieOpts(1.12, 1.46, BODY.userData.surf(0, 1.25) - 0.15); }
      // Revers: vom Kragen schräg zur Knopfstelle, mit Kerbe
      for (const sx of [-1, 1]) {
        strip([[sx * 0.065, 1.43], [sx * 0.085, 1.33], [sx * 0.07, 1.2], [sx * 0.025, 1.06]], [0.03, 0.07, 0.065, 0.015], 0.004, 0.004, kind === 'tux' ? [0.035, 0.035, 0.04] : kind === 'livery' ? COL.gold : jacket, kind === 'tux' ? FAB.satin : kind === 'livery' ? FAB.metal : FAB.wool);
        strip([[sx * 0.05, 1.45], [sx * 0.1, 1.42]], [0.03, 0.025], 0.003, 0.004, jacket, FAB.wool, 0, -1);
      }
      if (kind !== 'livery') { box(0.06, 0.012, 0.012, 0.13, 1.28, BODY.userData.surf(0.13, 1.28) + 0.002, COL.shirt, 0, 0, 0, FAB.silk); box(0.05, 0.03, 0.01, 0.13, 1.295, BODY.userData.surf(0.13, 1.3) + 0.003, COL.shirt, 0, 0, 0, FAB.silk); }   // Einstecktuch
      if (kind === 'tux') { bow(COL.tux); band(0.95, 0.08, 0.003, [0.03, 0.03, 0.035], FAB.satin); for (const y of [1.12, 1.2, 1.28]) sph(0.008, 0, y, BODY.userData.surf(0, y) + 0.005, [0.95, 0.95, 0.95], 1, 1, 0.5, 5, 3); }
      if (kind === 'livery') { for (const y of [0.95, 1.05, 1.15, 1.25]) sph(0.014, 0, y, BODY.userData.surf(0, y) + 0.004, COL.gold, 1, 1, 0.6, 5, 3); for (const sx of [-1, 1]) { box(0.1, 0.02, 0.07, sx * 0.24, 1.38, 0, COL.gold); for (let k = 0; k < 4; k++) P0(hTube([[sx * (0.2 + k * 0.025), 1.37, 0.03], [sx * (0.2 + k * 0.025), 1.33, 0.032], [sx * (0.2 + k * 0.025), 1.3, 0.03]], [0.004, 0.004, 0.003], { seg: 4, n: 5, swayKind: 3, sway: v => v * 0.4 }), COL.gold, FAB.metal); } }
      for (const sx of [-1, 1]) box(0.1, 0.012, 0.025, sx * 0.11, 0.9, BODY.userData.surf(sx * 0.11, 0.9) + 0.004, [0.04, 0.04, 0.045], 0, 0, 0, FAB.wool);           // Taschenpatten
      arms(1.34, 0.56, jacket, { cuff: COL.shirt });
      head(1.62);
      if (kind === 'livery') { cyl(0.1, 0.1, 0.09, 0, 1.69, 0, PAINT, 14); cyl(0.102, 0.102, 0.02, 0, 1.7, 0, COL.gold, 14); }
      else if (kind === 'suit') { hats(1.62, [fedora([0.22, 0.2, 0.18]), boater, null]); carry(1.34, ['case', 'paper', 'umbrella']); }
    }
  } else {
    // Frauen: Hüfte auf 0,88 m, Knie auf 0,46 m; Seidenstrümpfe
    HIP = 0.88; shoes(true);
    const stock = [0.72, 0.5, 0.38];
    for (const sx of [-1, 1]) {
      const x = sx * 0.085; LB = [sx < 0 ? 5 : 6, HIP];
      P0(hTube([[x, 0.075, -0.002], [x, 0.2, -0.014], [x, 0.33, -0.006], [x, 0.4576, 0.004], [x * 1.03, 0.62, 0.006], [x * 1.08, 0.78, 0.004], [x * 1.1, 0.93, 0]], [0.027, 0.043, 0.046, 0.046, 0.057, 0.069, 0.08], { seg: sg(24), n: sg(34), fab: FAB.stock }), stock, FAB.stock);
    }
    LB = [0, 0];
    // nackte Schultern, Schlüsselbein und Nacken über dem Kleid; schmale Träger über die Schulter
    const shoulders = () => P0(hLathe([[0.11, 1.26], [0.148, 1.3], [0.152, 1.345], [0.146, 1.385], [0.122, 1.42], [0.08, 1.45], [0.035, 1.462], [0, 1.464]], { sz: 0.8, seg: sg(40), rings: sg(14), fab: FAB.skin,
      fold: (th, y) => 0.004 * Math.exp(-(((y - 1.4) / 0.012) ** 2)) * Math.max(0, Math.cos(th)) * hsm(0.9, 0.3, Math.abs(Math.cos(th))) - 0.004 * Math.exp(-(((y - 1.39) / 0.02) ** 2)) * Math.exp(-((Math.atan2(Math.sin(th), Math.cos(th)) / 0.25) ** 2)) }), COL.skin, FAB.skin);
    const straps = (c, fab) => { for (const sx of [-1, 1]) P0(hTube([[sx * 0.088, 1.348, 0.104], [sx * 0.098, 1.392, 0.084], [sx * 0.102, 1.426, 0.0], [sx * 0.098, 1.392, -0.084], [sx * 0.088, 1.348, -0.098]], [0.0075, 0.0075, 0.0075, 0.0075, 0.0075], { seg: sg(16), n: 6, az: 0.45, fab }), c, fab); };
    // Büste unter dem Stoff
    const bust = (th, y) => 0.022 * Math.exp(-(((Math.abs(Math.atan2(Math.sin(th), Math.cos(th))) - 0.42) / 0.3) ** 2) - (((y - 1.2) / 0.06) ** 2));
    if (kind === 'gown') {
      // Abendkleid aus Seide, schräg geschnitten: fließt in Bahnen bis zum Boden, schwingt beim Gehen und Tanzen
      BODY = lathe([[0.001, 0.02], [0.33, 0.02], [0.3, 0.2], [0.24, 0.5], [0.19, 0.78], [0.18, 0.92], [0.15, 1.02], [0.14, 1.08], [0.158, 1.22], [0.158, 1.32], [0.154, 1.352], [0.146, 1.362], [0.1, 1.366], [0, 1.366]], PAINT, 0.8,
        { seg: 56, rings: 40, fold: (th, y) => bust(th, y) + 0.011 * Math.sin(th * 13 + wob(y * 3, th) * 0.8) * Math.pow(hsm(0.95, 0.05, y), 1.6) + 0.004 * Math.sin(th * 5 + y * 8) * hsm(1.1, 0.8, y),
          swayKind: 2, sway: y => hsm(0.92, 0.1, y) });
      shoulders(); straps(PAINT, FAB.silk);
      // Perlenkette in Bögen, schwingt mit
      for (let r = 0; r < 2; r++) for (let k = 0; k < 19; k++) { const a = (k - 9) * 0.16; sph(0.0075, Math.sin(a) * (0.085 + r * 0.02), 1.36 - (9 - Math.abs(k - 9)) * (0.012 + r * 0.008) - 0.02 * r, 0.07 + Math.cos(a) * 0.065 + r * 0.008, [0.95, 0.93, 0.88], 1, 1, 1, 5, 4, FAB.satin); }
      arms(1.31, 0.54, COL.skin, { spread: 0.178 });
      for (const sx of [-1, 1]) { LB = [sx < 0 ? 7 : 8, 1.31]; P0(hTube([[sx * 0.196, 1.03, -0.012], [sx * 0.196, 0.9, 0.02], [sx * 0.19, 0.79, 0.05]], [0.033, 0.03, 0.026], { seg: sg(14), n: sg(8), fold: (th, v) => 0.004 * Math.sin(v * 40) * hsm(0.0, 0.3, v) }), [0.92, 0.9, 0.86], FAB.satin); }   // lange Handschuhe
      LB = [0, 0];
    } else if (kind === 'dress') {
      // Charleston-Kleid: tiefe Taille, Pailletten, drei Reihen Fransen, die fliegen; lange Perlenkette
      BODY = lathe([[0.001, 0.42], [0.25, 0.42], [0.235, 0.6], [0.2, 0.8], [0.172, 0.95], [0.152, 1.08], [0.162, 1.22], [0.158, 1.32], [0.154, 1.352], [0.146, 1.362], [0.1, 1.366], [0, 1.366]], PAINT, 0.8,
        { seg: 52, rings: 34, fold: (th, y) => bust(th, y) * 0.7 + 0.003 * Math.sin(th * 9) * hsm(0.8, 0.45, y), swayKind: 2, sway: y => hsm(0.85, 0.42, y) * 0.8 });
      const N = Math.round((q > 1.5 ? 54 : 28));
      for (const [y0, len] of [[0.7, 0.16], [0.56, 0.16], [0.44, 0.13]]) {
        const rr0 = BODY.userData.rAt(y0) + 0.006;
        for (let k = 0; k < N; k++) {
          const th = (k + (y0 * 10 % 1)) / N * Math.PI * 2, sx = Math.sin(th), cz = Math.cos(th);
          const a = [sx * rr0, y0, cz * rr0 * 0.8], b = [sx * (rr0 + 0.012), y0 - len * 0.5, cz * (rr0 + 0.012) * 0.8], c = [sx * (rr0 + 0.018), y0 - len, cz * (rr0 + 0.018) * 0.8];
          P0(hTube([a, b, c], [0.006, 0.006, 0.005], { seg: 4, n: q > 1.5 ? 5 : 3, ax: 0.35, az: 1, swayKind: 3, sway: v => v * 1.0 + 0.15, fab: FAB.sequin, up: [sx, 0, cz], flip: false }), PAINT, FAB.sequin);
        }
      }
      band(0.82, 0.03, 0.005, COL.gold, FAB.metal);
      shoulders(); straps(PAINT, FAB.sequin);
      // lange Perlenkette, fällt bis zur Taille
      for (let k = 0; k < 31; k++) { const a = (k - 15) * 0.085, dep = Math.cos(a * 1.4); sph(0.0085, Math.sin(a) * 0.1, 1.36 - (15 - Math.abs(k - 15)) * 0.024, 0.09 + Math.cos(a) * 0.06 + (1 - dep) * 0.02, [0.95, 0.93, 0.88], 1, 1, 1, 5, 4, FAB.satin); }
      arms(1.31, 0.54, COL.skin, { spread: 0.178 });
    } else {
      // Damenmantel mit Pelzkragen, Gürtel, Handtasche, Perlenkette
      BODY = lathe([[0.001, 0.38], [0.255, 0.38], [0.21, 0.7], [0.165, 0.98], [0.155, 1.06], [0.18, 1.22], [0.172, 1.33], [0.11, 1.4], [0, 1.41]], PAINT, 0.8,
        { fold: (th, y) => bust(th, y) * 0.6 + 0.007 * Math.sin(th * 8 + wob(y * 5, th)) * hsm(0.95, 0.42, y), swayKind: 4, sway: y => hsm(0.95, 0.4, y) });
      band(1.06, 0.035, 0.006, [0.08, 0.06, 0.05], FAB.leather);
      P0(hLathe([[0.07, 1.42], [0.12, 1.43], [0.16, 1.39], [0.17, 1.33], [0.14, 1.3], [0.09, 1.34]], { sz: 0.95, seg: sg(40), rings: sg(10), fab: FAB.fur, fold: (th, y) => 0.006 * Math.sin(th * 23) * Math.sin(y * 90) }), [0.32, 0.25, 0.2], FAB.fur);
      for (const y of [0.75, 0.9, 1.15]) sph(0.011, 0.04, y, BODY.userData.surf(0.04, y) + 0.004, COL.dark, 1, 1, 0.6, 5, 3, FAB.leather);
      box(0.16, 0.12, 0.06, 0.25, 0.68, 0.06, COL.dark, 0, 0, 0, FAB.leather); box(0.17, 0.012, 0.065, 0.25, 0.74, 0.06, COL.gold); limb(0.006, 0.006, [0.2, 0.74, 0.06], [0.22, 1.0, 0.04], COL.dark, 4, FAB.leather);
      arms(1.31, 0.54, PAINT, { spread: 0.178, hand: Math.random() < 0.5 ? [0.92, 0.9, 0.86] : COL.skin, cuff: [0.32, 0.25, 0.2] });
    }
    head(1.58);
    if (kind === 'gown') { tor(0.09, 0.005, 1.648, -0.012, COL.gold, 1.12, 0.3); sph(0.011, 0.055, 1.672, 0.06, [0.85, 0.95, 1.0], 1, 1, 0.6, 8, 6, FAB.metal); for (const sx of [-1, 1]) { sph(0.004, sx * 0.073, 1.555, -0.006, COL.gold, 1, 1, 1, 4, 3); P0(hTube([[sx * 0.073, 1.553, -0.006], [sx * 0.0735, 1.535, -0.006], [sx * 0.0735, 1.518, -0.005]], [0.0018, 0.0018, 0.0018], { seg: 4, n: 4, swayKind: 5, sway: v => v * 0.6 }), COL.gold, FAB.metal); sph(0.0075, sx * 0.0735, 1.512, -0.005, [0.95, 0.93, 0.88], 1, 1.25, 1, 8, 6, FAB.satin); } }
    else if (kind === 'dress') hats(1.58, [headband, cloche([0.3, 0.06, 0.08]), null]);
    else { hats(1.58, [cloche(COL.dark), wideBrim([0.15, 0.12, 0.1]), cloche([0.2, 0.22, 0.3])]); carry(1.31, ['umbrella', 'bag', 'paper']); }
  }
  props();
  return personMerge(P, kind);
}
// Hutmaske je Art: welche Hutvarianten das Haar bedecken (Bit 0-2), 8 = immer eine Mütze
const HATMASK = { coat: 3, suit: 3, worker: 3, kid: 7, lady: 7, dress: 2, police: 8, chauffeur: 8, sailor: 8, livery: 8 };
// Zusammenfügen mit Index; Farben, Glieder, Varianten, Stoffart und Schwung je Ecke
function personMerge(parts, kind) {
  let n = 0, ni = 0;
  const geos = parts.map(([g]) => { if (!g.index) { const c = g.attributes.position.count; g.setIndex(Array.from({ length: c }, (_, i) => i)); } n += g.attributes.position.count; ni += g.index.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), lb = new Float32Array(n * 2), op = new Float32Array(n), so = new Float32Array(n * 3);
  const idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const hm = HATMASK[kind] || 0;
  let o = 0, oi = 0;
  geos.forEach((g, i) => {
    const [, c, limb, piv, opt, fab] = parts[i], cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    const isFace = g.userData.face, guv = g.attributes.uv, gs = g.attributes.aSoft;
    for (let k = 0; k < cnt; k++) {
      if (guv && (isFace || guv.getX(k) < -1.5)) { uv[(o + k) * 2] = guv.getX(k); uv[(o + k) * 2 + 1] = guv.getY(k); } else { uv[(o + k) * 2] = -1; uv[(o + k) * 2 + 1] = -1; }
      col.set(c, (o + k) * 3); lb[(o + k) * 2] = limb || 0; lb[(o + k) * 2 + 1] = piv || 0; op[o + k] = opt || 0;
      let f = fab || 0, w = 0, sk = 0;
      if (gs) { f = gs.getX(k) || f; w = gs.getY(k); sk = gs.getZ(k); }
      if (sk === 1) sk += 16 * hm;
      so[(o + k) * 3] = f; so[(o + k) * 3 + 1] = w; so[(o + k) * 3 + 2] = sk;
    }
    const I = g.index.array; for (let k = 0; k < I.length; k++) idx[oi + k] = I[k] + o;
    o += cnt; oi += I.length;
  });
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2));
  m.setAttribute('color', new T.BufferAttribute(col, 3)); m.setAttribute('aLimb', new T.BufferAttribute(lb, 2)); m.setAttribute('aOpt', new T.BufferAttribute(op, 1)); m.setAttribute('aSoft', new T.BufferAttribute(so, 3));
  m.setIndex(new T.BufferAttribute(idx, 1));
  m.computeBoundingSphere();
  return m;
}

// V17 · Gesichteratlas: 8 x 8 Gesichter, 0-31 Männer, 32-63 Frauen. Die Formen stecken jetzt im Modell;
// gemalt werden Augen, Lider, Wimpern, Brauen aus Härchen, Lippen, Schminke, Bart, Falten und Sommersprossen.
// Zweiter Atlas (FACE_MAT): R Glanz, G Relief, B Art des Pixels (0 Haut tönt, 1/3 Haarfarbe, 2/3 feste Farbe, 1 Auge)
const FACE_RES = MOBILE ? 128 : 320;
// Merkmale je Gesicht, auch im Shader (humanShape) aus der Nummer berechnet: Schönheit -1..1 und Alter 0..1
const FACE_TRAIT = i => ({ b: ((i * 0.618034) % 1) * 2 - 1, age: (i * 0.754877 + 0.13) % 1 });
const FACE_ATLAS = (() => {
  const S = FACE_RES, M = MOBILE ? S / 2 : S, W = S * 8, rnd = mulberry32(3141);
  const cv = document.createElement('canvas'); cv.width = cv.height = W; const g = cv.getContext('2d');
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = M * 8; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, M * 8, M * 8); return [c, x]; };
  const [cR, gR] = mk(), [cG, gG] = mk(), [cB, gB] = mk();
  gG.fillStyle = 'rgb(128,128,128)'; gG.fillRect(0, 0, M * 8, M * 8);
  const lay = [g, gR, gG, gB];
  // Zeichnen in Metern (Kopfmitte = 0, y nach oben), wie das Modell
  const setCell = i => { const cx = i % 8, cy = 7 - Math.floor(i / 8); for (const [x, s] of [[g, S], [gR, M], [gG, M], [gB, M]]) x.setTransform(s / HL.fw, 0, 0, -s / HL.fh, cx * s + 0.5 * s, cy * s + 0.5 * s + HL.fy * s / HL.fh); };
  const ell = (x, cx, cy, rx, ry, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), rot, 0, Math.PI * 2); };
  const soft = (x, cx, cy, rx, ry, col, a) => { const r = Math.max(rx, ry); x.save(); x.translate(cx, cy); x.scale(rx / r, ry / r); const gr = x.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.restore(); };
  // Klasse und Glanz/Relief zugleich malen
  const cls = (v) => `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`;
  const grey = (v, a = 1) => `rgba(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)},${a})`;
  for (let i = 0; i < 64; i++) {
    const fem = i >= 32; setCell(i);
    for (const x of lay) { x.save(); x.beginPath(); x.rect(-HL.fw / 2, HL.fy - HL.fh / 2, HL.fw, HL.fh); x.clip(); }
    const ex = HL.eyeX, ey = HL.eyeY, r = () => rnd(), FT = FACE_TRAIT(i), bty = FT.b, ug = Math.max(0, -bty), age = fem ? FT.age * 0.8 : FT.age, arch = Math.floor(r() * 4);
    // ---------- Haut: Schatten in den Augenhöhlen, Rötung an Nase und Wangen, Augenringe ----------
    for (const sd of [-1, 1]) {
      soft(g, sd * ex, ey + 0.002, 0.02, 0.012, 'rgba(70,50,60,A)', 0.22 + age * 0.12);
      soft(g, sd * (ex + 0.002), ey - 0.009, 0.014, 0.005, 'rgba(90,60,80,A)', 0.12 + age * 0.2);
      soft(g, sd * 0.042, ey - 0.03, 0.02, 0.014, fem ? 'rgba(210,90,90,A)' : 'rgba(190,100,90,A)', fem ? 0.35 : 0.14);
    }
    soft(g, 0, HL.noseY, 0.01, 0.008, 'rgba(200,100,95,A)', 0.2);
    // gemalte Verschattung passend zu den Formen: unter den Brauen, am Nasenrücken, unter Nase und Unterlippe, unter dem Kinn, am Haaransatz
    for (const sd of [-1, 1]) {
      soft(g, sd * ex, ey + 0.0075, 0.017, 0.0055, 'rgba(85,55,50,A)', 0.3);
      soft(g, sd * 0.0135, ey + 0.001, 0.0065, 0.008, 'rgba(80,50,50,A)', 0.32);
      soft(g, sd * 0.047, HL.mouthY + 0.003, 0.012, 0.016, 'rgba(90,60,55,A)', fem ? 0.06 : 0.14);
      g.strokeStyle = 'rgba(95,55,45,0.07)'; g.lineWidth = 0.004; g.beginPath(); g.moveTo(sd * 0.014, HL.noseY - 0.004); g.quadraticCurveTo(sd * 0.025, HL.mouthY + 0.006, sd * 0.027, HL.mouthY - 0.008); g.stroke();
      soft(g, sd * 0.06, ey + 0.012, 0.01, 0.025, 'rgba(90,60,55,A)', 0.14);
    }
    soft(g, 0, HL.noseY - 0.0125, 0.011, 0.004, 'rgba(70,40,35,A)', 0.16);
    soft(g, 0, HL.mouthY - 0.0115, 0.016, 0.0042, 'rgba(70,40,35,A)', 0.3);
    soft(g, 0, HL.chinY - 0.016, 0.05, 0.012, 'rgba(60,38,32,A)', 0.42);
    
    soft(g, 0, HL.browY + 0.016, 0.03, 0.012, 'rgba(255,245,230,A)', 0.12);
    soft(g, 0, HL.mouthY - 0.004, 0.03, 0.016, 'rgba(110,80,70,A)', 0.08);
    // Lider: Lidfalte und Wimpernrand
    for (const sd of [-1, 1]) {
      const cx = sd * ex;
      g.strokeStyle = `rgba(80,45,40,${0.35 + age * 0.15})`; g.lineWidth = 0.0007; g.beginPath(); g.ellipse(cx, ey + 0.0018, 0.0128, 0.0068, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke();
      gG.strokeStyle = grey(0.25); gG.lineWidth = 0.0012; gG.beginPath(); gG.ellipse(cx, ey + 0.0018, 0.0128, 0.0068, 0, Math.PI * 0.12, Math.PI * 0.88); gG.stroke();
    }
    // ---------- Hautbild: Unebenheiten, Rötungen, Poren und Narben; je weniger ebenmäßig, desto mehr ----------
    const mott = 6 + Math.round(ug * 26 + age * 10);
    for (let k = 0; k < mott; k++) {
      const fx = (r() - 0.5) * 0.12, fy = HL.chinY + r() * 0.13, rr = 0.004 + r() * 0.012;
      soft(g, fx, fy, rr, rr * (0.6 + r() * 0.6), r() < 0.55 ? 'rgba(200,85,80,A)' : 'rgba(95,65,55,A)', (0.05 + 0.1 * r() * (0.4 + ug)) * (fem ? 0.45 : 1));
    }
    // Pockennarben und grobe Poren auf Wangen und Nase
    if ((!fem && ug > 0.35) || r() < 0.06) {
      const n = (fem ? 60 : 120) + Math.round(ug * (fem ? 80 : 260));
      for (let k = 0; k < n; k++) {
        const sd = r() < 0.5 ? -1 : 1, fx = sd * (0.018 + r() * 0.04), fy = ey - 0.012 - r() * 0.05, rr = 0.0005 + r() * 0.0009;
        g.fillStyle = `rgba(105,62,55,${0.15 + r() * 0.2})`; ell(g, fx, fy, rr, rr * 0.8); g.fill();
        gG.fillStyle = grey(0.42 + r() * 0.06, 0.6); ell(gG, fx, fy, rr, rr * 0.8); gG.fill();
      }
    }
    // Rosacea, Trinkernase, geplatzte Äderchen
    if ((!fem && ug > 0.5 && r() < 0.6) || r() < 0.06) {
      soft(g, 0, HL.noseY - 0.002, 0.012, 0.012, 'rgba(215,70,70,A)', 0.45); for (const sd of [-1, 1]) soft(g, sd * 0.04, ey - 0.026, 0.02, 0.014, 'rgba(210,70,75,A)', 0.4);
      g.lineWidth = 0.00025; for (let k = 0; k < 24; k++) { const sd = r() < 0.5 ? -1 : 1, x0 = sd * (0.006 + r() * 0.045), y0 = HL.noseY - 0.01 + r() * 0.03; g.strokeStyle = `rgba(190,40,50,${0.25 + r() * 0.3})`; g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + (r() - 0.5) * 0.006, y0 + (r() - 0.5) * 0.006, x0 + (r() - 0.5) * 0.01, y0 + (r() - 0.5) * 0.008); g.stroke(); }
    }
    // Narbe: über Braue, Wange oder Kinn, hell und leicht erhaben
    if (!fem && (ug > 0.45 ? r() < 0.55 : r() < 0.07)) {
      const sd = r() < 0.5 ? -1 : 1, kind = Math.floor(r() * 3);
      const [x0, y0, x1, y1] = kind === 0 ? [sd * 0.02, HL.browY + 0.014, sd * 0.034, ey - 0.002] : kind === 1 ? [sd * 0.03, ey - 0.014, sd * 0.05, HL.mouthY + 0.004] : [sd * 0.004, HL.chinY + 0.004, sd * 0.016, HL.chinY - 0.012];
      for (const [x, st, w] of [[g, 'rgba(215,150,150,0.75)', 0.0016], [g, 'rgba(240,195,185,0.6)', 0.0007], [gG, grey(0.7), 0.0016], [gB, cls(0), 0.0016]]) { x.strokeStyle = st; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo((x0 + x1) / 2 + 0.003, (y0 + y1) / 2, x1, y1); x.stroke(); }
      for (let k = 0; k < 5; k++) { const t = (k + 0.5) / 5, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t; g.strokeStyle = 'rgba(200,140,140,0.35)'; g.lineWidth = 0.0004; g.beginPath(); g.moveTo(cx - 0.0018, cy - 0.0012); g.lineTo(cx + 0.0018, cy + 0.0012); g.stroke(); }
    }
    // Warzen und Muttermale als kleine Erhebungen
    const nw = ug > 0.55 ? 1 + Math.floor(r() * 3) : (r() < 0.12 ? 1 : 0);
    for (let k = 0; k < nw; k++) { const fx = (r() - 0.5) * 0.1, fy = HL.chinY + 0.01 + r() * 0.09, rr = 0.0012 + r() * 0.0014; g.fillStyle = 'rgba(120,75,60,0.8)'; ell(g, fx, fy, rr, rr); g.fill(); soft(gG, fx, fy, rr * 1.4, rr * 1.4, 'rgba(255,255,255,A)', 0.8); }
    // Tränensäcke und Augenringe, mit Alter und Müdigkeit
    const bag = Math.min(1, age * 0.9 + ug * 0.6 + r() * 0.2);
    if (bag > 0.35) for (const sd of [-1, 1]) {
      const cx = sd * ex, a = (bag - 0.35) / 0.65;
      soft(g, cx + sd * 0.002, ey - 0.012, 0.016, 0.006, 'rgba(105,70,85,A)', 0.22 + 0.25 * a);
      for (const [x, st, w] of [[g, `rgba(95,55,55,${0.15 + 0.3 * a})`, 0.0006], [gG, grey(0.3), 0.0011]]) { x.strokeStyle = st; x.lineWidth = w; x.beginPath(); x.ellipse(cx + sd * 0.002, ey - 0.006, 0.013, 0.01 + 0.002 * a, 0, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
      gG.fillStyle = grey(0.62); ell(gG, cx + sd * 0.002, ey - 0.011, 0.011, 0.0035); gG.fill();
    }
    // Altersflecken
    if (age > 0.75) for (let k = 0; k < 6 + r() * 10; k++) { const fx = (r() - 0.5) * 0.12, fy = HL.browY + r() * 0.03 - r() * 0.06; soft(g, fx, fy, 0.002 + r() * 0.003, 0.002 + r() * 0.002, 'rgba(120,80,50,A)', 0.3 + r() * 0.2); }
    // Glanz: ölige T-Zone bei manchen, matt gepudert bei den Damen
    soft(gR, 0, HL.noseY + 0.01, 0.009, 0.03, 'rgba(255,255,255,A)', fem ? 0.15 : 0.25 + r() * 0.35);
    for (const sd of [-1, 1]) soft(gR, sd * 0.038, ey - 0.02, 0.014, 0.01, 'rgba(255,255,255,A)', fem ? 0.1 : 0.15 + r() * 0.2);
    // ---------- Augen: Mandelform, Lederhaut, Iris mit Muster, Pupille, Glanzpunkt ----------
    const iris = [[74, 46, 28], [45, 29, 18], [61, 106, 138], [79, 106, 74], [106, 106, 112], [90, 58, 32], [52, 80, 110]][Math.floor(r() * 7)];
    const ew = 0.0118 + r() * 0.0012, eh = (fem ? 0.0046 : 0.0041) + r() * 0.0008, tilt = (r() - 0.4) * 0.12;
    const smk = ['rgba(40,30,45,A)', 'rgba(60,40,30,A)', 'rgba(30,40,55,A)', 'rgba(55,35,50,A)'][Math.floor(r() * 4)], smkA = 0.45 + r() * 0.25;
    for (const sd of [-1, 1]) {
      const cx = sd * ex, cy = ey;
      // Lidschatten: rauchig, nach außen gezogen (die Mode der Zwanziger)
      if (fem) { soft(g, cx + sd * 0.002, cy + 0.005, 0.017, 0.0075, smk, smkA); ell(gB, cx + sd * 0.002, cy + 0.005, 0.017, 0.0075); gB.fillStyle = cls(2 / 3); gB.fill(); }
      const eye = x => { x.beginPath(); x.moveTo(cx - sd * ew, cy - 0.0004); x.bezierCurveTo(cx - sd * ew * 0.5, cy + eh * 1.25 + sd * tilt * 0.002, cx + sd * ew * 0.45, cy + eh * 1.2, cx + sd * ew, cy + 0.0012 + tilt * 0.004); x.bezierCurveTo(cx + sd * ew * 0.45, cy - eh * 0.8, cx - sd * ew * 0.5, cy - eh * 0.85, cx - sd * ew, cy - 0.0004); x.closePath(); };
      eye(g); g.fillStyle = 'rgb(232,226,218)'; g.fill();
      eye(gB); gB.fillStyle = cls(1); gB.fill(); eye(gR); gR.fillStyle = grey(1); gR.fill();
      g.save(); eye(g); g.clip();
      soft(g, cx - sd * ew * 0.9, cy, 0.004, 0.004, 'rgba(160,100,100,A)', 0.5);
      soft(g, cx + sd * ew, cy, 0.005, 0.004, 'rgba(150,120,120,A)', 0.4);
      const ix = cx + sd * 0.0006, iy = cy + 0.0006, ir = 0.0054;
      const gr = g.createRadialGradient(ix, iy, 0, ix, iy, ir);
      gr.addColorStop(0, 'rgb(10,8,8)'); gr.addColorStop(0.36, 'rgb(10,8,8)'); gr.addColorStop(0.4, `rgb(${iris.map(v => v * 0.75 | 0)})`);
      gr.addColorStop(0.75, `rgb(${iris})`); gr.addColorStop(0.92, `rgb(${iris.map(v => v * 0.55 | 0)})`); gr.addColorStop(1, 'rgb(30,24,22)');
      g.fillStyle = gr; g.beginPath(); g.arc(ix, iy, ir, 0, Math.PI * 2); g.fill();
      g.strokeStyle = `rgba(${iris.map(v => Math.min(255, v * 1.6) | 0)},0.5)`; g.lineWidth = 0.00025;
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; g.beginPath(); g.moveTo(ix + Math.cos(a) * ir * 0.42, iy + Math.sin(a) * ir * 0.42); g.lineTo(ix + Math.cos(a + 0.2) * ir * 0.85, iy + Math.sin(a + 0.2) * ir * 0.85); g.stroke(); }
      // Schatten des Oberlids auf dem Auge
      const sh = g.createLinearGradient(0, cy + eh, 0, cy); sh.addColorStop(0, 'rgba(40,25,20,0.55)'); sh.addColorStop(1, 'rgba(40,25,20,0)'); g.fillStyle = sh; g.fillRect(cx - 0.015, cy, 0.03, eh + 0.002);
      g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(ix - 0.0016, iy + 0.0018, 0.0009, 0, Math.PI * 2); g.fill();
      g.restore();
      // Wimpernrand oben, dünner unten; Frauen mit Kajal und geschwungenen Wimpern
      g.strokeStyle = fem ? 'rgba(14,9,8,0.95)' : 'rgba(35,20,16,0.85)'; g.lineCap = 'round'; g.lineWidth = fem ? 0.0011 : 0.0006;
      g.beginPath(); g.moveTo(cx - sd * ew, cy - 0.0004); g.bezierCurveTo(cx - sd * ew * 0.5, cy + eh * 1.25, cx + sd * ew * 0.45, cy + eh * 1.2, cx + sd * ew, cy + 0.0012 + tilt * 0.004); g.stroke();
      gB.strokeStyle = cls(2 / 3); gB.lineWidth = 0.0012; gB.stroke();
      g.strokeStyle = 'rgba(60,35,30,0.45)'; g.lineWidth = 0.0004; g.beginPath(); g.moveTo(cx - sd * ew * 0.9, cy - 0.0008); g.bezierCurveTo(cx - sd * ew * 0.4, cy - eh * 0.95, cx + sd * ew * 0.4, cy - eh * 0.9, cx + sd * ew * 0.95, cy); g.stroke();
      if (fem) {
        g.strokeStyle = 'rgba(12,8,8,0.9)'; g.lineWidth = 0.00045;
        for (let k = 0; k < 9; k++) { const f = 0.15 + k / 9 * 0.85, bx = cx + sd * ew * (f * 2 - 1) * 0.95, by = cy + eh * 1.2 * Math.sin(f * Math.PI) * 0.95 + 0.0002; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sd * 0.0008 * f, by + 0.0016, bx + sd * 0.0018 * f, by + 0.0019); g.stroke(); }
      }
    }
    // ---------- Brauen aus einzelnen Härchen ----------
    const pencil = fem && r() < 0.55;   // gezupfte, hochgezogene Bleistiftbrauen der Zwanziger
    const bThick = fem ? (pencil ? 0.0005 : 0.0011 + r() * 0.0006) : 0.0014 + r() * 0.0012 + age * 0.0008 + ug * 0.0008, bArch = fem ? (pencil ? 0.0065 + r() * 0.002 : 0.003 + r() * 0.002) : 0.001 + r() * 0.0018 - ug * 0.001, bLen = fem ? (pencil ? 0.027 : 0.023) : 0.021 + r() * 0.004, bY = HL.browY + (fem ? (pencil ? 0.005 : 0.003) : 0.001 - ug * 0.0025) + (r() - 0.5) * 0.002;
    const uni = !fem && ug > 0.6 && r() < 0.5;
    for (const sd of [-1, 1]) {
      const x0 = sd * (ex - bLen * 0.55), x1 = sd * (ex + bLen * 0.5);
      const at = f => [x0 + (x1 - x0) * f, bY + Math.sin(Math.min(1, f * 1.3) * Math.PI * 0.8) * bArch - f * 0.0015];
      const nH = fem ? (pencil ? 30 : 46) : 70 + Math.round(age * 40 + ug * 30);
      for (let k = 0; k < nH; k++) {
        const f = r(), [bx, by] = at(f), th = bThick * (1 - Math.abs(f - 0.3) * 0.8) * (0.6 + 0.4 * r());
        const oy = (r() - 0.5) * th * 2, ang = (f < 0.35 ? 1.2 : 0.25) * sd, len = 0.003 + r() * 0.002;
        for (const [x, st, w] of [[g, `rgba(${30 + r() * 20 | 0},${20 + r() * 12 | 0},${14 + r() * 8 | 0},0.85)`, 0.00035], [gB, cls(1 / 3), 0.0006], [gG, grey(0.6), 0.0005]]) {
          x.strokeStyle = st; x.lineWidth = w; x.beginPath(); x.moveTo(bx, by + oy); x.lineTo(bx + Math.cos(ang) * len * sd * 0.7, by + oy + Math.sin(Math.abs(ang)) * len * 0.4); x.stroke();
        }
      }
    }
    if (uni) for (let k = 0; k < 26; k++) { const bx = (r() - 0.5) * 0.016, by = bY - 0.001 + (r() - 0.5) * 0.002; g.strokeStyle = 'rgba(35,24,16,0.7)'; g.lineWidth = 0.00035; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (r() - 0.5) * 0.002, by + 0.0025); g.stroke(); gB.strokeStyle = cls(1 / 3); gB.lineWidth = 0.0005; gB.stroke(); }
    // ---------- Nase: Nasenlöcher, Glanz auf Spitze und Rücken ----------
    for (const sd of [-1, 1]) {
      g.fillStyle = 'rgba(40,18,16,0.35)'; ell(g, sd * 0.0058, HL.noseY - 0.0112, 0.0022, 0.0011, sd * 0.35); g.fill();
      gG.fillStyle = grey(0.2); ell(gG, sd * 0.0058, HL.noseY - 0.0112, 0.0022, 0.0011, sd * 0.35); gG.fill();
    }
    soft(gR, 0, HL.noseY, 0.006, 0.006, 'rgba(255,255,255,A)', 0.5); soft(gR, 0, HL.browY + 0.015, 0.025, 0.012, 'rgba(255,255,255,A)', 0.3);
    // ---------- Mund: Lippen mit Bogen, Spalte, Glanz; Frauen mit Lippenstift ----------
    const bee = fem && r() < 0.4, thin = age * 0.5 + ug * 0.5 + r() * 0.3;
    const mw = fem ? (bee ? 0.014 + r() * 0.002 : 0.017 + r() * 0.003) : 0.02 + r() * 0.004, my = HL.mouthY, up = (bee ? 0.0056 : 0.0042) * (1.15 - 0.45 * thin), lo = 0.0052 * (1.15 - 0.4 * thin), smile = (r() - 0.35 - 0.25 * ug) * 0.0016;
    const lips = (x, part) => {
      x.beginPath();
      if (part !== 'lo') { x.moveTo(-mw, my + smile); x.bezierCurveTo(-mw * 0.6, my + up * 0.7, -mw * 0.25, my + up * 1.25, 0, my + up * 0.85); x.bezierCurveTo(mw * 0.25, my + up * 1.25, mw * 0.6, my + up * 0.7, mw, my + smile); x.quadraticCurveTo(0, my - 0.0004 - smile * 0.4, -mw, my + smile); }
      if (part !== 'up') { x.moveTo(-mw, my + smile); x.quadraticCurveTo(0, my - 0.0004 - smile * 0.4, mw, my + smile); x.bezierCurveTo(mw * 0.55, my - lo * 1.15, -mw * 0.55, my - lo * 1.15, -mw, my + smile); }
    };
    const lipC = fem ? [[130, 18, 30], [150, 28, 36], [105, 20, 34], [160, 60, 62], [120, 30, 30]][Math.floor(r() * 5)] : null;
    if (fem) { lips(g, 'all'); g.fillStyle = `rgba(${lipC},0.92)`; g.fill(); lips(gB, 'all'); gB.fillStyle = cls(2 / 3); gB.fill(); lips(gR, 'all'); gR.fillStyle = grey(0.75); gR.fill(); }
    else { lips(g, 'all'); g.fillStyle = 'rgba(175,95,95,0.5)'; g.fill(); lips(gR, 'all'); gR.fillStyle = grey(0.45); gR.fill(); }
    soft(g, 0, my - 0.0026, mw * 0.4, 0.0012, 'rgba(255,230,225,A)', 0.25);
    lips(gG, 'lo'); gG.fillStyle = grey(0.62); gG.fill(); lips(gG, 'up'); gG.fillStyle = grey(0.58); gG.fill();
    for (const [x, st, w] of [[g, 'rgba(45,16,16,0.85)', 0.0005], [gG, grey(0.15), 0.0008]]) { x.strokeStyle = st; x.lineWidth = w; x.beginPath(); x.moveTo(-mw, my + smile); x.quadraticCurveTo(0, my - 0.0004 - smile * 0.4, mw, my + smile); x.stroke(); }
    for (const sd of [-1, 1]) soft(g, sd * mw, my + smile, 0.0016, 0.0014, 'rgba(60,30,25,A)', 0.22);
    // Lippenrinne (Philtrum)
    for (const sd of [-1, 1]) { g.strokeStyle = 'rgba(110,60,50,0.07)'; g.lineWidth = 0.0009; g.beginPath(); g.moveTo(sd * 0.0025, HL.noseY - 0.014); g.lineTo(sd * 0.0032, my + up); g.stroke(); }
    // ---------- Alter: Stirnfalten, Krähenfüße, Nasolabialfalte ----------
    if (age > 0.4 || ug > 0.6) {
      const a = Math.min(1, Math.max((age - 0.4) / 0.6, (ug - 0.6) * 1.2));
      for (const [x, st, w] of [[g, `rgba(90,50,40,${0.12 + 0.38 * a})`, 0.0006 + 0.0004 * a], [gG, grey(0.3 - 0.1 * a), 0.0012 + 0.0008 * a]]) {
        x.strokeStyle = st; x.lineWidth = w;
        for (const sd of [-1, 1]) {
          x.beginPath(); x.moveTo(sd * 0.012, HL.noseY - 0.006); x.quadraticCurveTo(sd * 0.024, HL.mouthY + 0.004, sd * (mw + 0.004), HL.mouthY - 0.006); x.stroke();
          for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(sd * (ex + 0.014), ey + 0.002 - k * 0.0025); x.lineTo(sd * (ex + 0.02), ey + 0.003 - k * 0.0045); x.stroke(); }
        }
        if (a > 0.3) for (let k = 0; k < 3 + Math.round(a * 2); k++) { const yk = HL.browY + 0.015 + k * (0.005 + 0.0015 * Math.sin(i + k)); for (let seg = 0; seg < 2; seg++) { const q = n => { const v = Math.sin(i * 91.7 + k * 17.3 + seg * 5.1 + n * 3.7) * 4375.85; return v - Math.floor(v); }; const xa = seg ? 0.002 + q(1) * 0.006 : -0.03 + q(2) * 0.008, xb = seg ? 0.026 - q(3) * 0.008 : -0.002 - q(4) * 0.006; x.beginPath(); x.moveTo(xa, yk + (q(5) - 0.5) * 0.002); x.bezierCurveTo(xa + (xb - xa) * 0.33, yk + (q(6) - 0.5) * 0.004 - 0.001, xa + (xb - xa) * 0.66, yk + (q(7) - 0.5) * 0.004 - 0.001, xb, yk + (q(8) - 0.5) * 0.002); x.stroke(); } }
      }
    }
    // ---------- Wangen, Sommersprossen, Leberfleck ----------
    if (fem) { const rg = r() < 0.3; for (const sd of [-1, 1]) soft(g, sd * (rg ? 0.044 : 0.042), ey - (rg ? 0.028 : 0.024), rg ? 0.011 : 0.016, rg ? 0.011 : 0.012, 'rgba(215,70,80,A)', rg ? 0.5 : 0.25 + r() * 0.2); }
    // Lippenfältchen und Mundwinkelfalten (Marionettenfalten) im Alter
    if (age > 0.55) { const a = (age - 0.55) / 0.45; for (const [x, st, w] of [[g, `rgba(100,55,45,${0.1 + 0.25 * a})`, 0.0005], [gG, grey(0.25), 0.0009]]) { x.strokeStyle = st; x.lineWidth = w; for (let k = 0; k < 10; k++) { const fx = (k / 9 - 0.5) * mw * 1.8; x.beginPath(); x.moveTo(fx, my + up * 0.9); x.lineTo(fx * 1.05, my + up + 0.004); x.stroke(); } for (const sd of [-1, 1]) { x.beginPath(); x.moveTo(sd * (mw + 0.001), my - 0.001); x.quadraticCurveTo(sd * (mw + 0.004), my - 0.012, sd * (mw + 0.002), HL.chinY + 0.006); x.stroke(); } } }
    if (r() < 0.2) { for (let k = 0; k < 40; k++) { const fx = (r() - 0.5) * 0.08, fy = ey - 0.012 - r() * 0.03 + Math.abs(fx) * 0.2; g.fillStyle = `rgba(120,60,30,${0.25 + r() * 0.3})`; ell(g, fx, fy, 0.0006 + r() * 0.0005, 0.0006); g.fill(); } }
    if (r() < (fem ? 0.4 : 0.15)) { const sd = r() < 0.5 ? -1 : 1, mx = sd * (0.02 + r() * 0.012), mY = my + 0.008 + r() * 0.006; g.fillStyle = 'rgba(30,15,12,0.9)'; ell(g, mx, mY, 0.0011, 0.0011); g.fill(); gB.fillStyle = cls(2 / 3); ell(gB, mx, mY, 0.0013, 0.0013); gB.fill(); }
    // ---------- Männer: Bartschatten, Schnurrbart, Vollbart, Brille ----------
    if (!fem) {
      // Bartmode: Dandys glatt oder mit Bleistiftbart, Ältere mit Walross- oder Vollbart, Arbeiter mit Stoppeln
      const pick = (...w) => { let t = r() * w.reduce((a, v) => a + v[1], 0); for (const [k, v] of w) { if ((t -= v) <= 0) return k; } return 0; };
      const bt = bty > 0.4 ? pick([0, 4], [1, 4], [2, 2]) : age > 0.7 ? pick([3, 3.5], [4, 2.5], [2, 2], [6, 1], [0, 1]) : pick([0, 3.5], [1, 1.5], [2, 2], [4, 1], [5, 1], [6, 1]);
      const beardA = bty > 0.4 ? 0.04 + r() * 0.08 : 0.12 + r() * 0.3 + ug * 0.15;
      const jaw = x => { x.beginPath(); x.moveTo(-0.062, 0.0); x.quadraticCurveTo(-0.06, HL.chinY - 0.01, 0, HL.chinY - 0.018); x.quadraticCurveTo(0.06, HL.chinY - 0.01, 0.062, 0.0); x.lineTo(0.035, HL.noseY - 0.012); x.quadraticCurveTo(0, HL.noseY - 0.006, -0.035, HL.noseY - 0.012); x.closePath(); };
      // Stoppeln mit weichem Rand: oben an der Wangenlinie, seitlich zu den Ohren hin auslaufend
      const top = ax => ax < 0.03 ? HL.noseY - 0.01 : HL.noseY - 0.01 + (ax - 0.03) / 0.032 * (0.01 - HL.noseY);
      for (let k = 0; k < 2600; k++) { const fx = (r() - 0.5) * 0.13, fy = HL.chinY - 0.02 + r() * 0.09, ax = Math.abs(fx);
        const w = hsm(0, 0.014, top(ax) - fy) * hsm(0.066, 0.05, ax) * hsm(HL.chinY - 0.024, HL.chinY - 0.008, fy) * (1 - 0.7 * hsm(0.012, 0, Math.hypot(fx * 0.7, fy - my)));
        if (w < 0.02) continue; g.fillStyle = `rgba(30,22,18,${beardA * r() * w})`; g.fillRect(fx, fy, 0.00035, 0.0006); }
      soft(g, 0, HL.mouthY - 0.012, 0.045, 0.03, 'rgba(60,50,48,A)', beardA * 0.5);
      // Barthaar in Haarfarbe: Fläche, dann einzelne Härchen in Wuchsrichtung
      const hairy = (shape, n, x0, x1, y0, y1, dy) => {
        for (const [x, st] of [[g, 'rgba(30,20,14,0.9)'], [gB, cls(1 / 3)], [gG, grey(0.57, 0.7)]]) { x.fillStyle = st; shape(x); x.fill(); }
        g.save(); shape(g); g.clip(); g.lineWidth = 0.0003;
        for (let k = 0; k < n; k++) { const fx = x0 + r() * (x1 - x0), fy = y0 + r() * (y1 - y0); g.strokeStyle = `rgba(${r() < 0.5 ? '8,5,3' : '90,70,55'},${0.35 + r() * 0.3})`; g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + fx * 0.08 + (r() - 0.5) * 0.001, fy + dy * (0.6 + r() * 0.6)); g.stroke(); }
        g.restore();
      };
      if (bt === 1) {
        // Bleistiftbart: schmaler Strich über der Lippe, in der Mitte geteilt
        for (const sd of [-1, 1]) hairy(x => { x.beginPath(); x.moveTo(sd * 0.0025, my + 0.0072); x.quadraticCurveTo(sd * mw * 0.6, my + 0.0078, sd * (mw - 0.001), my + 0.0035); x.quadraticCurveTo(sd * mw * 0.6, my + 0.0056, sd * 0.0025, my + 0.0058); x.closePath(); }, 40, sd < 0 ? -mw : 0, sd < 0 ? 0 : mw, my + 0.004, my + 0.008, -0.0015);
      } else if (bt === 2) {
        hairy(x => { x.beginPath(); x.moveTo(-mw - 0.002, my + 0.001); x.quadraticCurveTo(-0.006, my + 0.011, 0, my + 0.0085); x.quadraticCurveTo(0.006, my + 0.011, mw + 0.002, my + 0.001); x.quadraticCurveTo(0, my + 0.0045, -mw - 0.002, my + 0.001); x.closePath(); }, 110, -mw - 0.002, mw + 0.002, my + 0.001, my + 0.011, -0.005);
      } else if (bt === 3) {
        // Walross: buschig über die Oberlippe hängend, Enden nach unten
        hairy(x => { x.beginPath(); x.moveTo(-mw - 0.008, my - 0.008); x.quadraticCurveTo(-mw - 0.004, my + 0.012, 0, my + 0.0105); x.quadraticCurveTo(mw + 0.004, my + 0.012, mw + 0.008, my - 0.008); x.quadraticCurveTo(mw * 0.5, my - 0.001, 0, my - 0.0005); x.quadraticCurveTo(-mw * 0.5, my - 0.001, -mw - 0.008, my - 0.008); x.closePath(); }, 260, -mw - 0.008, mw + 0.008, my - 0.008, my + 0.012, -0.007);
      } else if (bt === 4) {
        const full = x => { x.beginPath(); x.moveTo(-0.06, 0.0); x.quadraticCurveTo(-0.058, HL.chinY - 0.016, 0, HL.chinY - 0.026); x.quadraticCurveTo(0.058, HL.chinY - 0.016, 0.06, 0.0); x.lineTo(0.05, -0.012); x.quadraticCurveTo(0.03, HL.noseY - 0.015, mw + 0.004, my + 0.003); x.quadraticCurveTo(0, my + 0.01, -mw - 0.004, my + 0.003); x.quadraticCurveTo(-0.03, HL.noseY - 0.015, -0.05, -0.012); x.closePath(); };
        hairy(full, 600, -0.06, 0.06, HL.chinY - 0.026, 0.0, -0.005);
        lips(g, 'lo'); g.fillStyle = 'rgba(160,90,85,0.9)'; g.fill(); lips(gB, 'lo'); gB.fillStyle = cls(0); gB.fill();
      } else if (bt === 5) {
        // Kinnbart mit kurzem Schnurrbart
        hairy(x => { x.beginPath(); x.moveTo(-0.011, my - 0.006); x.quadraticCurveTo(-0.013, HL.chinY - 0.01, 0, HL.chinY - 0.02); x.quadraticCurveTo(0.013, HL.chinY - 0.01, 0.011, my - 0.006); x.quadraticCurveTo(0, my - 0.0045, -0.011, my - 0.006); x.closePath(); }, 160, -0.013, 0.013, HL.chinY - 0.02, my - 0.004, -0.005);
        hairy(x => { x.beginPath(); x.moveTo(-mw, my + 0.002); x.quadraticCurveTo(0, my + 0.011, mw, my + 0.002); x.quadraticCurveTo(0, my + 0.006, -mw, my + 0.002); x.closePath(); }, 60, -mw, mw, my + 0.002, my + 0.01, -0.004);
      } else if (bt === 6) {
        // Koteletten bis zur Wange
        for (const sd of [-1, 1]) hairy(x => { x.beginPath(); x.moveTo(sd * 0.068, 0.012); x.lineTo(sd * 0.06, 0.012); x.quadraticCurveTo(sd * 0.055, -0.03, sd * 0.05, HL.mouthY + 0.004); x.quadraticCurveTo(sd * 0.06, HL.mouthY - 0.004, sd * 0.066, HL.mouthY + 0.01); x.closePath(); }, 150, sd < 0 ? -0.068 : 0.05, sd < 0 ? -0.05 : 0.068, HL.mouthY - 0.004, 0.012, -0.004);
      }
      if (r() < 0.16) for (const [x, st, w] of [[g, 'rgba(200,160,80,0.95)', 0.0009], [gB, cls(2 / 3), 0.0012], [gR, grey(1), 0.0012]]) { x.strokeStyle = st; x.lineWidth = w; for (const sd of [-1, 1]) { x.beginPath(); x.arc(sd * ex, ey, 0.0145, 0, Math.PI * 2); x.stroke(); } x.beginPath(); x.moveTo(-ex + 0.0145, ey + 0.002); x.quadraticCurveTo(0, ey + 0.006, ex - 0.0145, ey + 0.002); x.stroke(); }
    }
    for (const x of lay) x.restore();
  }
  for (const x of lay) x.setTransform(1, 0, 0, 1, 0, 0);
  // Materialatlas zusammensetzen
  const N = M * 8, out = document.createElement('canvas'); out.width = out.height = N; const go = out.getContext('2d');
  const dR = gR.getImageData(0, 0, N, N).data, dG = gG.getImageData(0, 0, N, N).data, dB = gB.getImageData(0, 0, N, N).data, od = go.createImageData(N, N);
  for (let k = 0; k < N * N * 4; k += 4) { od.data[k] = dR[k]; od.data[k + 1] = dG[k]; od.data[k + 2] = dB[k]; od.data[k + 3] = 255; }
  go.putImageData(od, 0, 0);
  const t = new T.CanvasTexture(cv); t.anisotropy = ANISO; t.generateMipmaps = true; t.minFilter = T.LinearMipmapLinearFilter;
  const tm = new T.CanvasTexture(out); tm.generateMipmaps = true; tm.minFilter = T.LinearMipmapLinearFilter;
  t.userData.mat = tm;
  return t;
})();
const FACE_MAT = FACE_ATLAS.userData.mat;
