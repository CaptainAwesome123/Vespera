/* =====================================================================
   V116 · NOCH MEHR LOSE DINGE: Formen, Maße, Gewicht und Stoff
   Draußen: Brennholz, Benzinkanister, Autoreifen, Farbeimer, Sägebock,
   Ziegelstapel, Zeitungsbündel, Pakete, Besen, Absperrbock, Warnlaterne,
   Wäschekorb, Waschzuber, Fischkiste, Anker, Ruder, Milchflaschenkorb,
   Schemel, Gießkanne.
   Drinnen: Kohlenschütte, Samthocker, Schmuckkästchen, Parfümflakon,
   Etagere, Saxophon, Trompete, Notenständer, Standmikrofon, Bücherstapel,
   Silbertablett mit Schalen, Kandelaber, Obstschale, Spielkarten mit
   Jetons, Bierkrug, Empfangsklingel, Marmorbüste, Luftschiffmodell,
   Handtuchstapel, Lackschuhe, Golftasche, Tintenfass mit Feder,
   Zigarrenkiste offen, Kerzenleuchter klein, Champagnerflaschen im Kühler.
   Jede Form wird beim ersten Gebrauch einmal gebaut und um die Mitte ihrer
   Hülle gelegt; die Halbmaße (he) kommen aus dieser Hülle, damit Form und
   Körper nie auseinanderlaufen. PAINT-Teile nehmen die Instanzfarbe an.
   Low-Poly (6 bis 12 Segmente), ein gemeinsamer Stoff (physics.propMaterial).
   ===================================================================== */
import { T } from './core.js';
import { mergeColored, PAINT } from './people-skeleton.js';

const C = (g, c) => [g, c];
const cyl = (rt, rb, h, x = 0, y = 0, z = 0, n = 10) => new T.CylinderGeometry(rt, rb, h, n).translate(x, y, z);
const box = (w, h, d, x = 0, y = 0, z = 0) => new T.BoxGeometry(w, h, d).translate(x, y, z);
const lathe = (pts, n = 12) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(Math.max(r, 0.0001), y)), n);
const tor = (r, t, rs = 5, ts = 14, arc = Math.PI * 2) => new T.TorusGeometry(r, t, rs, ts, arc);
const ball = (r, x = 0, y = 0, z = 0, w = 8, h = 6) => new T.SphereGeometry(r, w, h).translate(x, y, z);
const rod = (a, b, r, n = 5) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); const g = new T.CylinderGeometry(r, r, L, n); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize())); return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); };
const IRON = [0.07, 0.07, 0.08], BRASS = [0.6, 0.45, 0.22], GOLD = [0.75, 0.56, 0.25], SILVER = [0.72, 0.72, 0.74], WOOD = [0.42, 0.28, 0.15], DARKW = [0.22, 0.12, 0.06],
  CREAM = [0.88, 0.83, 0.72], RUBBER = [0.04, 0.04, 0.045], GLASS = [0.62, 0.72, 0.7], WHITE = [0.9, 0.88, 0.84], ZINC = [0.5, 0.52, 0.54], STRING = [0.75, 0.68, 0.5];
// Geometrie zusammenfügen und um die Mitte der Hülle legen
function fin(P) {
  const g = mergeColored(P); g.computeBoundingBox();
  const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox(); g.computeBoundingSphere(); return g;
}
// kleiner Zufall mit festem Start (gleiche Form bei jedem Laden)
const rnd = s => () => (s = (s * 9301 + 49297) % 233280) / 233280;

/* ---------- Formen (Boden bei y = 0, fin() zentriert) ---------- */
const BUILD = {
  /* ----- Straße, Hof, Hafen ----- */
  // Bündel Brennholz: gespaltene Scheite, zweimal verschnürt
  firewood: () => { const P = [], r = rnd(7); for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - (i === 2 ? 1 : 0); j++) { const x = (j - (i === 2 ? 0.5 : 1)) * 0.12, y = 0.06 + i * 0.1; P.push(C(cyl(0.06, 0.06, 0.5, 0, 0, 0, 5).rotateX(Math.PI / 2).rotateZ(r() * 3).translate(x, y, (r() - 0.5) * 0.04), [0.42 + r() * 0.12, 0.3 + r() * 0.06, 0.18])); P.push(C(cyl(0.052, 0.052, 0.505, 0, 0, 0, 5).rotateX(Math.PI / 2).translate(x, y, 0), [0.62, 0.5, 0.34])); }
    for (const z of [-0.15, 0.15]) P.push(C(tor(0.2, 0.008, 3, 14).scale(1, 0.85, 1).translate(0, 0.15, z), STRING)); return fin(P); },
  // Blechkanister (20 l) mit drei Griffen und Schraubverschluss
  gascan: () => fin([C(box(0.34, 0.44, 0.16, 0, 0.22), PAINT), C(box(0.3, 0.02, 0.17, 0, 0.12), [0.2, 0.2, 0.2]), C(box(0.3, 0.02, 0.17, 0, 0.32), [0.2, 0.2, 0.2]),
    C(box(0.08, 0.03, 0.02, -0.08, 0.47, 0), PAINT), C(box(0.08, 0.03, 0.02, 0.06, 0.47, 0), PAINT), C(box(0.22, 0.02, 0.025, 0, 0.49, 0), PAINT), C(cyl(0.025, 0.025, 0.05, 0.13, 0.46, 0, 8), BRASS)]),
  // Autoreifen mit Weißwand (liegt flach)
  tyre: () => fin([C(tor(0.29, 0.075, 6, 16).rotateX(Math.PI / 2).translate(0, 0.075, 0), RUBBER), C(tor(0.25, 0.022, 4, 16).rotateX(Math.PI / 2).translate(0, 0.15, 0), WHITE), C(tor(0.25, 0.022, 4, 16).rotateX(Math.PI / 2).translate(0, 0.0, 0), WHITE)]),
  // Farbeimer mit Drahtbügel und Farbnasen
  paintcan: () => fin([C(cyl(0.11, 0.1, 0.24, 0, 0.12, 0, 12), ZINC), C(cyl(0.112, 0.112, 0.08, 0, 0.12, 0, 12), PAINT), C(cyl(0.104, 0.104, 0.005, 0, 0.243, 0, 12), PAINT),
    C(tor(0.11, 0.004, 3, 10, Math.PI).translate(0, 0.24, 0), IRON), C(box(0.02, 0.06, 0.005, 0.06, 0.21, 0.1), PAINT), C(box(0.015, 0.09, 0.005, -0.04, 0.2, 0.105), PAINT)]),
  // Sägebock: Balken auf zwei gespreizten Beinpaaren
  sawhorse: () => { const P = [C(box(1.0, 0.1, 0.1, 0, 0.72), [0.55, 0.42, 0.26])]; for (const x of [-0.38, 0.38]) for (const s of [-1, 1]) P.push(C(rod([x, 0.7, 0], [x, 0, s * 0.26], 0.03, 4), [0.5, 0.38, 0.23]));
    for (const x of [-0.38, 0.38]) P.push(C(box(0.04, 0.04, 0.4, x, 0.25, 0), [0.45, 0.34, 0.2])); return fin(P); },
  // Ziegelstapel, im Verband gesetzt
  bricks: () => { const P = [], r = rnd(11); for (let l = 0; l < 5; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const rot = l % 2, c = [0.5 + r() * 0.12, 0.2 + r() * 0.06, 0.13 + r() * 0.04];
    P.push(C(rot ? box(0.115, 0.07, 0.24, -0.12 + j * 0.12, 0.035 + l * 0.072, -0.06 + i * 0.12 + (i ? 0.0 : 0)).translate(0, 0, (i - 0.5) * 0.12) : box(0.24, 0.07, 0.115, -0.125 + i * 0.25, 0.035 + l * 0.072, -0.12 + j * 0.12), c)); }
    return fin(P); },
  // verschnürtes Zeitungsbündel
  newsbundle: () => { const P = [], r = rnd(3); for (let k = 0; k < 8; k++) P.push(C(box(0.42, 0.024, 0.3, (r() - 0.5) * 0.02, 0.012 + k * 0.025, (r() - 0.5) * 0.02).rotateY((r() - 0.5) * 0.06), k % 3 ? [0.82, 0.8, 0.72] : [0.76, 0.74, 0.66]));
    P.push(C(box(0.18, 0.004, 0.08, -0.08, 0.202, 0.05), [0.12, 0.12, 0.12]), C(box(0.43, 0.21, 0.01, 0, 0.1, 0), STRING), C(box(0.01, 0.21, 0.31, 0, 0.1, 0), STRING)); return fin(P); },
  // Paket in Packpapier, über Kreuz verschnürt, Siegel
  parcel: () => fin([C(box(0.4, 0.24, 0.3, 0, 0.12), [0.62, 0.48, 0.32]), C(box(0.41, 0.245, 0.012, 0, 0.12), STRING), C(box(0.012, 0.245, 0.31, 0, 0.12), STRING), C(cyl(0.025, 0.025, 0.006, 0.08, 0.243, 0.06, 8), [0.6, 0.08, 0.06]), C(box(0.12, 0.004, 0.07, -0.1, 0.242, -0.07), CREAM)]),
  // Straßenbesen aus Reisig (lehnt an der Wand)
  broom: () => fin([C(cyl(0.015, 0.015, 1.25, 0, 0.82, 0, 6), [0.55, 0.42, 0.26]), C(cyl(0.035, 0.09, 0.42, 0, 0.21, 0, 8).scale(1, 1, 0.55), [0.55, 0.45, 0.25]), C(tor(0.045, 0.008, 3, 8).rotateX(Math.PI / 2).translate(0, 0.4, 0), IRON), C(tor(0.06, 0.008, 3, 8).rotateX(Math.PI / 2).scale(1, 1, 0.6).translate(0, 0.28, 0), IRON)]),
  // Absperrbock: rot-weiße Latte auf zwei Böcken
  barrier: () => { const P = []; for (let k = 0; k < 6; k++) P.push(C(box(0.23, 0.16, 0.03, -0.575 + k * 0.23, 0.82, 0), k % 2 ? WHITE : [0.7, 0.1, 0.08]));
    for (const x of [-0.6, 0.6]) for (const s of [-1, 1]) P.push(C(rod([x, 0.9, 0], [x, 0, s * 0.3], 0.025, 4), [0.3, 0.3, 0.32])); return fin(P); },
  // Warnlaterne mit rotem Glas (für Baustellen)
  warnlamp: () => fin([C(cyl(0.08, 0.09, 0.03, 0, 0.015, 0, 8), IRON), C(cyl(0.065, 0.065, 0.14, 0, 0.1, 0, 8), [0.85, 0.12, 0.08]), C(cyl(0.04, 0.085, 0.05, 0, 0.195, 0, 8), IRON), C(tor(0.05, 0.007, 3, 8, Math.PI).translate(0, 0.23, 0), IRON)]),
  // Wäschekorb aus Weide mit gefalteter Wäsche
  laundrybasket: () => { const P = [C(lathe([[0, 0], [0.24, 0], [0.3, 0.28], [0.285, 0.28], [0.225, 0.02], [0, 0.02]], 14).scale(1.2, 1, 0.8), [0.68, 0.55, 0.34])];
    for (let k = 0; k < 4; k++) P.push(C(box(0.42 - k * 0.04, 0.05, 0.3 - k * 0.03, (k % 2 - 0.5) * 0.03, 0.18 + k * 0.045, 0).rotateY(k * 0.15), k % 2 ? WHITE : [0.82, 0.86, 0.9]));
    for (const s of [-1, 1]) P.push(C(tor(0.05, 0.012, 3, 8, Math.PI).translate(s * 0.34, 0.28, 0).rotateY(0), [0.6, 0.48, 0.3])); return fin(P); },
  // Waschzuber aus Zink mit Waschbrett
  washtub: () => fin([C(lathe([[0, 0], [0.28, 0], [0.34, 0.32], [0.355, 0.33], [0.33, 0.33], [0.27, 0.02], [0, 0.02]], 14), ZINC), C(cyl(0.3, 0.3, 0.01, 0, 0.24, 0, 14), [0.5, 0.58, 0.6]),
    C(box(0.08, 0.02, 0.03, 0.37, 0.3, 0), ZINC), C(box(0.08, 0.02, 0.03, -0.37, 0.3, 0), ZINC), C(box(0.3, 0.6, 0.03, 0, 0.36, -0.2).rotateX(-0.3), [0.55, 0.42, 0.26]), C(box(0.24, 0.3, 0.032, 0, 0.36, -0.2).rotateX(-0.3), [0.6, 0.62, 0.64])]),
  // Fischkiste mit Eis und Fischen
  fishcrate: () => { const P = [C(box(0.6, 0.04, 0.4, 0, 0.02), [0.5, 0.42, 0.3])]; for (const z of [-0.19, 0.19]) P.push(C(box(0.6, 0.18, 0.02, 0, 0.11, z), [0.55, 0.46, 0.32])); for (const x of [-0.29, 0.29]) P.push(C(box(0.02, 0.18, 0.4, x, 0.11, 0), [0.5, 0.42, 0.3]));
    P.push(C(box(0.56, 0.06, 0.36, 0, 0.12), [0.85, 0.92, 0.95])); const r = rnd(5); for (let k = 0; k < 6; k++) { const z = -0.13 + k * 0.052; P.push(C(ball(0.05, 0, 0.16, z, 7, 4).scale(3.2, 0.6, 1).rotateY((r() - 0.5) * 0.3), [0.5, 0.56, 0.6]), C(new T.ConeGeometry(0.035, 0.07, 4).rotateZ(Math.PI / 2).scale(1, 0.6, 1.4).translate(0.2, 0.16, z), [0.4, 0.45, 0.5])); }
    return fin(P); },
  // kleiner Bootsanker mit Ring
  anchor: () => fin([C(cyl(0.03, 0.03, 0.8, 0, 0.45, 0, 6), IRON), C(box(0.5, 0.04, 0.04, 0, 0.72), IRON), C(tor(0.07, 0.015, 4, 10).translate(0, 0.9, 0), IRON),
    C(tor(0.28, 0.03, 4, 12, Math.PI).rotateZ(Math.PI).translate(0, 0.33, 0), IRON), C(new T.ConeGeometry(0.06, 0.14, 4).rotateZ(0.5).translate(-0.27, 0.36, 0), IRON), C(new T.ConeGeometry(0.06, 0.14, 4).rotateZ(-0.5).translate(0.27, 0.36, 0), IRON)]),
  // Ruder (liegt)
  oar: () => fin([C(cyl(0.025, 0.025, 1.7, 0, 0, 0, 6).rotateZ(Math.PI / 2).translate(-0.35, 0.03, 0), [0.62, 0.5, 0.34]), C(box(0.6, 0.015, 0.16, 0.75, 0.03, 0), [0.6, 0.48, 0.32]), C(box(0.12, 0.02, 0.06, -1.15, 0.03, 0), [0.4, 0.3, 0.2])]),
  // Drahtkorb mit Milchflaschen (vor der Haustür)
  milkcrate: () => { const P = []; for (const y of [0.02, 0.18]) P.push(C(box(0.36, 0.012, 0.25, 0, y), IRON)); for (const x of [-0.18, 0.18]) for (const z of [-0.125, 0.125]) P.push(C(box(0.012, 0.2, 0.012, x, 0.1, z), IRON));
    P.push(C(tor(0.1, 0.008, 3, 8, Math.PI).translate(0, 0.2, 0), IRON)); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = -0.11 + i * 0.11, z = -0.06 + j * 0.12; P.push(C(lathe([[0, 0], [0.04, 0], [0.042, 0.14], [0.022, 0.2], [0.022, 0.22], [0, 0.22]], 8).translate(x, 0.02, z), WHITE), C(cyl(0.024, 0.024, 0.012, x, 0.245, z, 8), [0.75, 0.6, 0.3])); }
    return fin(P); },
  // Holzschemel (dreibeinig)
  stool: () => { const P = [C(cyl(0.17, 0.17, 0.04, 0, 0.46, 0, 12), [0.5, 0.36, 0.2])]; for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; P.push(C(rod([Math.cos(a) * 0.1, 0.44, Math.sin(a) * 0.1], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], 0.018, 5), [0.45, 0.32, 0.18])); } return fin(P); },
  // Gießkanne aus Zink
  wateringcan: () => fin([C(cyl(0.11, 0.12, 0.26, 0, 0.13, 0, 12), ZINC), C(rod([0.1, 0.06, 0], [0.32, 0.3, 0], 0.016, 6), ZINC), C(cyl(0.035, 0.02, 0.04, 0, 0, 0, 8).rotateZ(-0.8).translate(0.33, 0.31, 0), ZINC), C(tor(0.1, 0.012, 3, 10, Math.PI).translate(-0.02, 0.26, 0), ZINC)]),
  // Kohlenschütte aus Messing mit Kohle
  coalscuttle: () => fin([C(cyl(0.16, 0.13, 0.34, 0, 0.17, 0, 12).scale(1, 1, 0.8).rotateZ(0.0), [0.4, 0.28, 0.12]), C(ball(0.14, 0, 0.32, 0, 8, 4).scale(1, 0.4, 0.75), [0.05, 0.05, 0.055]), C(tor(0.16, 0.012, 3, 10, Math.PI).translate(0, 0.36, 0), BRASS), C(box(0.36, 0.02, 0.2, 0, 0.01), BRASS)]),

  /* ----- Salon, Ballsaal, Kneipe, Villa ----- */
  // Samthocker mit Knopfheftung und Goldfuß
  ottoman: () => { const P = [C(cyl(0.26, 0.26, 0.32, 0, 0.24, 0, 16), PAINT), C(ball(0.26, 0, 0.4, 0, 16, 6).scale(1, 0.18, 1), PAINT), C(cyl(0.2, 0.22, 0.06, 0, 0.04, 0, 12), GOLD), C(tor(0.26, 0.012, 3, 18).rotateX(Math.PI / 2).translate(0, 0.08, 0), GOLD)];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; P.push(C(ball(0.012, Math.cos(a) * 0.14, 0.44, Math.sin(a) * 0.14, 5, 4), GOLD)); } return fin(P); },
  // Schmuckkästchen aus Lack mit Goldbeschlag
  jewelbox: () => fin([C(box(0.2, 0.08, 0.14, 0, 0.04), [0.1, 0.04, 0.05]), C(box(0.21, 0.025, 0.15, 0, 0.09), [0.12, 0.05, 0.06]), C(box(0.212, 0.008, 0.152, 0, 0.08), GOLD), C(box(0.04, 0.03, 0.01, 0, 0.065, 0.075), GOLD), C(new T.OctahedronGeometry(0.018).translate(0, 0.11, 0), [0.3, 0.75, 0.7])]),
  // Parfümflakon in Stufenform mit Goldkappe
  perfume: () => fin([C(box(0.07, 0.07, 0.04, 0, 0.035), [0.85, 0.7, 0.75]), C(box(0.05, 0.03, 0.03, 0, 0.085), [0.85, 0.72, 0.78]), C(cyl(0.012, 0.012, 0.02, 0, 0.11, 0, 6), GOLD), C(new T.OctahedronGeometry(0.025).scale(1, 1.2, 0.5).translate(0, 0.14, 0), GOLD)]),
  // Etagere: drei Porzellanteller mit Törtchen an Goldstange
  cakestand: () => { const P = [C(cyl(0.012, 0.012, 0.42, 0, 0.21, 0, 6), GOLD), C(tor(0.03, 0.006, 3, 8).translate(0, 0.43, 0), GOLD)], r = rnd(9), cols = [[0.95, 0.75, 0.8], [0.6, 0.35, 0.2], [0.95, 0.92, 0.8], [0.5, 0.75, 0.55]];
    [[0.16, 0.02], [0.12, 0.17], [0.08, 0.31]].forEach(([R, y]) => { P.push(C(cyl(R, R * 0.6, 0.015, 0, y, 0, 14), WHITE), C(tor(R, 0.004, 3, 14).rotateX(Math.PI / 2).translate(0, y + 0.008, 0), GOLD)); const n = Math.round(R * 50); for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; P.push(C(cyl(0.022, 0.024, 0.025, Math.cos(a) * R * 0.65, y + 0.02, Math.sin(a) * R * 0.65, 6), cols[Math.floor(r() * 4)])); } });
    return fin(P); },
  // Saxophon auf kleinem Ständer
  saxophone: () => fin([C(cyl(0.022, 0.035, 0.42, 0, 0.36, 0, 8), BRASS), C(tor(0.06, 0.035, 6, 10, Math.PI).rotateZ(Math.PI).translate(0.06, 0.15, 0), BRASS), C(cyl(0.065, 0.04, 0.16, 0.13, 0.22, 0, 10).rotateZ(-0.15), BRASS),
    C(rod([0, 0.57, 0], [-0.06, 0.66, 0], 0.012, 5), BRASS), C(box(0.02, 0.03, 0.015, -0.07, 0.67, 0), RUBBER), C(cyl(0.12, 0.14, 0.02, 0.03, 0.01, 0, 8), IRON), C(cyl(0.008, 0.008, 0.18, 0.03, 0.1, 0, 4), IRON)]),
  // Trompete (liegt)
  trumpet: () => fin([C(cyl(0.012, 0.012, 0.36, 0, 0, 0, 6).rotateZ(Math.PI / 2).translate(0, 0.05, 0), BRASS), C(cyl(0.065, 0.012, 0.16, 0, 0, 0, 10).rotateZ(Math.PI / 2).translate(0.25, 0.05, 0), BRASS), C(tor(0.04, 0.01, 4, 10).translate(0.0, 0.05, 0.04).rotateX(Math.PI / 2).translate(0, 0.05, 0.0), BRASS),
    C(tor(0.05, 0.01, 4, 10, Math.PI).rotateX(Math.PI / 2).translate(-0.18, 0.05, -0.05), BRASS), C(cyl(0.012, 0.012, 0.05, -0.02, 0.09, 0, 6), SILVER), C(cyl(0.012, 0.012, 0.05, 0.02, 0.09, 0, 6), SILVER), C(cyl(0.012, 0.012, 0.05, 0.06, 0.09, 0, 6), SILVER), C(cyl(0.018, 0.012, 0.04, -0.2, 0.05, 0, 6).rotateZ(0), SILVER)]),
  // Notenständer mit aufgeschlagenen Noten
  musicstand: () => fin([C(cyl(0.012, 0.012, 1.0, 0, 0.55, 0, 6), IRON), ...[0, 2.1, 4.2].map(a => C(rod([0, 0.1, 0], [Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25], 0.01, 4), IRON)), C(box(0.46, 0.3, 0.012, 0, 1.12, 0.04).rotateX(-0.3).translate(0, 0.3, -0.33), [0.12, 0.12, 0.13]),
    C(box(0.2, 0.26, 0.004, -0.1, 1.13, 0.05).rotateX(-0.3).translate(0, 0.3, -0.33), CREAM), C(box(0.2, 0.26, 0.004, 0.1, 1.13, 0.05).rotateX(-0.3).translate(0, 0.3, -0.33), CREAM)]),
  // Standmikrofon der 20er: Ring mit Federn, schwerer Fuß
  microphone: () => fin([C(cyl(0.16, 0.18, 0.04, 0, 0.02, 0, 12), IRON), C(cyl(0.012, 0.012, 1.45, 0, 0.75, 0, 6), SILVER), C(tor(0.07, 0.01, 4, 14).translate(0, 1.52, 0), SILVER), C(cyl(0.04, 0.04, 0.06, 0, 0, 0, 10).rotateX(Math.PI / 2).translate(0, 1.52, 0), [0.15, 0.15, 0.16]), C(cyl(0.035, 0.035, 0.062, 0, 0, 0, 10).rotateX(Math.PI / 2).translate(0, 1.52, 0), GOLD)]),
  // Bücherstapel
  bookstack: () => { const P = [], r = rnd(13), cols = [[0.35, 0.08, 0.08], [0.1, 0.2, 0.15], [0.12, 0.12, 0.25], [0.45, 0.3, 0.15], [0.15, 0.1, 0.07]]; let y = 0;
    for (let k = 0; k < 5; k++) { const h = 0.03 + r() * 0.025, w = 0.2 + r() * 0.06, d = 0.14 + r() * 0.04, a = (r() - 0.5) * 0.5; P.push(C(box(w, h, d, 0, y + h / 2, 0).rotateY(a), cols[k % 5]), C(box(w - 0.01, h - 0.008, d + 0.002, 0.004, y + h / 2, 0).rotateY(a), CREAM)); y += h; }
    return fin(P); },
  // Silbertablett mit vier Champagnerschalen
  servingtray: () => { const P = [C(cyl(0.22, 0.22, 0.012, 0, 0.006, 0, 18), SILVER), C(tor(0.22, 0.008, 3, 18).rotateX(Math.PI / 2).translate(0, 0.014, 0), SILVER)];
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4, x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12; P.push(C(cyl(0.03, 0.03, 0.004, x, 0.014, z, 8), GLASS), C(cyl(0.004, 0.004, 0.08, x, 0.055, z, 4), GLASS), C(lathe([[0.005, 0], [0.05, 0.03], [0.052, 0.035]], 10).translate(x, 0.095, z), GLASS), C(cyl(0.044, 0.044, 0.004, x, 0.12, z, 10), [0.95, 0.82, 0.45])); }
    return fin(P); },
  // dreiarmiger Kandelaber mit Kerzen
  candelabra: () => { const P = [C(cyl(0.07, 0.09, 0.025, 0, 0.012, 0, 10), GOLD), C(lathe([[0.02, 0], [0.03, 0.1], [0.015, 0.2], [0.02, 0.3], [0, 0.3]], 8).translate(0, 0.02, 0), GOLD)];
    for (const s of [-1, 0, 1]) { const x = s * 0.13, y = s ? 0.34 : 0.4; if (s) P.push(C(tor(0.065, 0.01, 4, 8, Math.PI).rotateZ(s > 0 ? Math.PI : 0).translate(s * 0.065, 0.32, 0), GOLD)); P.push(C(cyl(0.025, 0.018, 0.03, x, y, 0, 8), GOLD), C(cyl(0.012, 0.012, 0.14, x, y + 0.085, 0, 6), CREAM), C(cyl(0.002, 0.006, 0.02, x, y + 0.165, 0, 4), [1.4, 1.0, 0.55])); }
    return fin(P); },
  // Obstschale aus Silber mit Früchten
  fruitbowl: () => { const P = [C(lathe([[0.04, 0], [0.05, 0.05], [0.02, 0.06], [0.06, 0.07], [0.15, 0.12], [0.155, 0.13]], 14), SILVER)], r = rnd(17), F = [[0.66, 0.1, 0.07], [0.95, 0.55, 0.12], [0.55, 0.62, 0.2], [0.42, 0.12, 0.4]];
    for (let k = 0; k < 7; k++) { const a = k * 2.4, rr = k ? 0.075 : 0; P.push(C(ball(0.042, Math.cos(a) * rr, 0.12 + (k ? 0 : 0.05), Math.sin(a) * rr, 7, 5), F[Math.floor(r() * 4)])); } return fin(P); },
  // Spielkarten im Fächer und Jetonstapel
  cards: () => { const P = []; for (let k = 0; k < 6; k++) P.push(C(box(0.06, 0.002, 0.09, 0, 0.003 + k * 0.002, 0).translate(0, 0, 0.03).rotateY(-0.5 + k * 0.2).translate(-0.04, 0, 0), k % 2 ? WHITE : [0.92, 0.9, 0.86]));
    for (const [x, z, c] of [[0.07, -0.02, [0.7, 0.1, 0.08]], [0.1, 0.04, [0.08, 0.08, 0.1]], [0.05, 0.05, [0.9, 0.88, 0.8]]]) for (let k = 0; k < 5; k++) P.push(C(cyl(0.02, 0.02, 0.006, x, 0.003 + k * 0.0065, z, 10), c)); return fin(P); },
  // Bierkrug aus Glas mit Schaum
  beermug: () => fin([C(cyl(0.045, 0.042, 0.16, 0, 0.08, 0, 10), [0.85, 0.6, 0.2]), C(cyl(0.046, 0.046, 0.025, 0, 0.165, 0, 10), [0.96, 0.94, 0.88]), C(tor(0.045, 0.011, 4, 8, Math.PI).rotateZ(-Math.PI / 2).translate(0.045, 0.09, 0), GLASS)]),
  // Empfangsklingel aus Messing
  deskbell: () => fin([C(cyl(0.05, 0.05, 0.015, 0, 0.0075, 0, 12), [0.12, 0.08, 0.05]), C(ball(0.045, 0, 0.015, 0, 12, 6).scale(1, 0.8, 1), BRASS), C(cyl(0.006, 0.006, 0.03, 0, 0.065, 0, 6), BRASS), C(ball(0.009, 0, 0.082, 0, 6, 4), BRASS)]),
  // Marmorbüste auf Sockel
  bust: () => fin([C(box(0.2, 0.12, 0.2, 0, 0.06), [0.15, 0.14, 0.14]), C(cyl(0.06, 0.08, 0.06, 0, 0.15, 0, 10), [0.85, 0.83, 0.8]), C(ball(0.14, 0, 0.25, 0, 12, 6, ).scale(1.3, 0.55, 0.75), [0.88, 0.86, 0.82]), C(cyl(0.045, 0.05, 0.08, 0, 0.33, 0, 8), [0.88, 0.86, 0.82]),
    C(ball(0.085, 0, 0.44, 0.0, 10, 8).scale(0.85, 1.1, 0.95), [0.9, 0.88, 0.84]), C(ball(0.08, 0, 0.47, -0.015, 10, 6).scale(0.9, 0.85, 0.95), [0.84, 0.82, 0.78])]),
  // Modell von Alexanders Luftschiff auf Messingständer
  airshipmodel: () => fin([C(box(0.36, 0.03, 0.14, 0, 0.015), [0.12, 0.07, 0.04]), C(cyl(0.008, 0.008, 0.2, -0.1, 0.12, 0, 5), BRASS), C(cyl(0.008, 0.008, 0.2, 0.1, 0.12, 0, 5), BRASS), C(ball(0.08, 0, 0.3, 0, 14, 8).scale(3.6, 1, 1), [0.82, 0.8, 0.74]),
    C(tor(0.08, 0.004, 3, 14).rotateY(Math.PI / 2).translate(0.1, 0.3, 0), GOLD), C(tor(0.08, 0.004, 3, 14).rotateY(Math.PI / 2).translate(-0.1, 0.3, 0), GOLD), C(box(0.12, 0.035, 0.05, 0.02, 0.225, 0), [0.1, 0.1, 0.12]),
    C(box(0.07, 0.07, 0.004, -0.28, 0.3, 0), [0.75, 0.56, 0.25]), C(box(0.07, 0.004, 0.07, -0.28, 0.3, 0), [0.75, 0.56, 0.25])]),
  // Stapel gefalteter Handtücher
  towels: () => fin([C(box(0.34, 0.06, 0.24, 0, 0.03), PAINT), C(box(0.33, 0.06, 0.23, 0.005, 0.09).rotateY(0.05), WHITE), C(box(0.32, 0.06, 0.22, -0.005, 0.15).rotateY(-0.04), PAINT), C(box(0.342, 0.012, 0.242, 0, 0.04), GOLD)]),
  // Paar Lackschuhe
  shoes: () => { const P = []; for (const s of [-1, 1]) { const x = s * 0.06; P.push(C(ball(0.05, 0, 0, 0, 10, 6).scale(1, 0.55, 2.4).translate(x, 0.03, 0.02), [0.04, 0.04, 0.045]), C(box(0.08, 0.025, 0.07, x, 0.012, -0.08), [0.06, 0.04, 0.03]), C(box(0.075, 0.04, 0.09, x, 0.05, -0.06), [0.05, 0.05, 0.055])); } return fin(P); },
  // Golftasche aus Leder mit Schlägern
  golfbag: () => { const P = [C(cyl(0.12, 0.12, 0.85, 0, 0.425, 0, 12), [0.45, 0.25, 0.12]), C(cyl(0.125, 0.125, 0.06, 0, 0.83, 0, 12), [0.25, 0.12, 0.06]), C(cyl(0.125, 0.125, 0.05, 0, 0.05, 0, 12), [0.25, 0.12, 0.06]), C(box(0.02, 0.6, 0.06, 0.12, 0.45, 0), [0.25, 0.12, 0.06])];
    for (let k = 0; k < 5; k++) { const a = k * 1.3, x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06; P.push(C(cyl(0.008, 0.008, 0.3, x, 1.0, z, 4), SILVER), C(box(0.06, 0.03, 0.03, x + 0.02, 1.16, z), k % 2 ? SILVER : [0.4, 0.26, 0.14])); }
    return fin(P); },
  // Tintenfass mit Feder auf Schreibunterlage
  inkwell: () => fin([C(box(0.28, 0.012, 0.2, 0, 0.006), [0.15, 0.25, 0.18]), C(cyl(0.035, 0.04, 0.05, 0.06, 0.035, 0, 8), [0.15, 0.2, 0.25]), C(cyl(0.02, 0.02, 0.012, 0.06, 0.066, 0, 8), GOLD), C(cyl(0.003, 0.002, 0.2, 0, 0, 0, 4).rotateZ(0.5).translate(0.03, 0.12, 0), WHITE), C(box(0.02, 0.08, 0.002, 0, 0, 0).rotateZ(0.5).translate(-0.02, 0.18, 0), WHITE)]),
};

// Name, Hüllform, Masse, Stoff; solid = sperrt den Weg; tall = lehnt man an die Wand (wie Besen)
const INFO = {
  firewood: ['Bündel Brennholz', 'box', 14, 'wood'], gascan: ['Benzinkanister', 'box', 18, 'metal'], tyre: ['Autoreifen', 'cyl', 12, 'leather'], paintcan: ['Farbeimer', 'cyl', 5, 'metal'],
  sawhorse: ['Sägebock', 'box', 9, 'wood'], bricks: ['Ziegelstapel', 'box', 30, 'clay'], newsbundle: ['Zeitungsbündel', 'box', 7, 'paper'], parcel: ['Paket', 'box', 3, 'paper'],
  broom: ['Straßenbesen', 'box', 1.6, 'wood'], barrier: ['Absperrbock', 'box', 14, 'wood'], warnlamp: ['Warnlaterne', 'cyl', 1.2, 'metal'], laundrybasket: ['Wäschekorb', 'box', 5, 'leather'],
  washtub: ['Waschzuber', 'cyl', 9, 'metal'], fishcrate: ['Fischkiste', 'box', 16, 'wood'], anchor: ['Anker', 'box', 55, 'metal'], oar: ['Ruder', 'box', 4, 'wood'],
  milkcrate: ['Milchflaschenkorb', 'box', 6, 'glass'], stool: ['Schemel', 'cyl', 3, 'wood'], wateringcan: ['Gießkanne', 'box', 2, 'metal'], coalscuttle: ['Kohlenschütte', 'cyl', 9, 'metal'],
  ottoman: ['Samthocker', 'cyl', 9, 'leather'], jewelbox: ['Schmuckkästchen', 'box', 1, 'wood'], perfume: ['Parfümflakon', 'box', 0.3, 'glass'], cakestand: ['Etagere', 'cyl', 1.6, 'glass'],
  saxophone: ['Saxophon', 'box', 2.6, 'metal'], trumpet: ['Trompete', 'box', 1.1, 'metal'], musicstand: ['Notenständer', 'box', 2.5, 'metal'], microphone: ['Standmikrofon', 'cyl', 6, 'metal'],
  bookstack: ['Bücherstapel', 'box', 3, 'paper'], servingtray: ['Silbertablett', 'cyl', 1.8, 'glass'], candelabra: ['Kandelaber', 'box', 3, 'metal'], fruitbowl: ['Obstschale', 'cyl', 2, 'metal'],
  cards: ['Spielkarten', 'box', 0.3, 'paper'], beermug: ['Bierkrug', 'cyl', 0.9, 'glass'], deskbell: ['Empfangsklingel', 'cyl', 0.4, 'metal'], bust: ['Marmorbüste', 'box', 24, 'clay'],
  airshipmodel: ['Luftschiffmodell', 'box', 3, 'metal'], towels: ['Handtuchstapel', 'box', 1.5, 'leather'], shoes: ['Lackschuhe', 'box', 1, 'leather'], golfbag: ['Golftasche', 'cyl', 9, 'leather'],
  inkwell: ['Tintenfass', 'box', 0.6, 'glass'],
};

// Formen einmal bauen (beim ersten Gebrauch), dann teilen
const GEO = {};
const geo = k => GEO[k] || (GEO[k] = BUILD[k]());
export function kram116Geos() { const o = {}; for (const k in BUILD) o[k] = () => geo(k); return o; }
export function kram116Kinds() {
  const o = {};
  for (const k in INFO) {
    const [name, kind, m, stuff] = INFO[k];
    let he = null;
    o[k] = { name, kind, m, stuff, get he() { if (!he) { const b = geo(k).boundingBox, h = [(b.max.x - b.min.x) / 2, (b.max.y - b.min.y) / 2, (b.max.z - b.min.z) / 2]; if (kind === 'cyl') h[0] = h[2] = Math.max(h[0], h[2]); he = h; } return he; },
      get small() { const h = this.he; return Math.max(h[0], h[1], h[2]) * 2 < 0.45; } };
  }
  return o;
}
export const KRAM116_KINDS = Object.keys(INFO);
