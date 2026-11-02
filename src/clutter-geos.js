/* =====================================================================
   V53 · NEUE LOSE DINGE: Formen und Maße
   Straße, Hof, Hafen, Dach und Zimmer der 20er Jahre: Zeitungsständer,
   Bistrotisch, Blumenkarren, Fahrrad, Kinderwagen, Kohlenkarren, Schubkarre,
   Stehleiter, Werkzeugkiste, Mehlsack, Obstkiste, Tauwerk, Rettungsring,
   Postsack, Blumentopf, Schneeschaufel, Schlitten, Maronistand, Telefonzelle,
   Schuhputzstuhl, Gepäckwagen, Liegestuhl, Grammophon, Radio, Schreibmaschine,
   Globus, Vogelkäfig, Garderobenständer, Sektkühler, Blumenvase, Schirmständer,
   Teeservice, Schachbrett, Bronzefigur, Bierkasten.
   Jede Form ist um ihren Schwerpunkt gebaut (Mitte der Hülle), mit
   Eckfarben (mergeColored); PAINT-Teile nehmen die Instanzfarbe an.
   physics.js hängt sie an GEOS und KINDS; src/clutter.js stellt sie als
   Instanzen in die Stadt, die erst beim Greifen zu Körpern werden.
   ===================================================================== */
import { T } from './core.js';
import { mergeColored, PAINT } from './people-skeleton.js';

export function clutterGeos() {
  const C = (g, c) => [g, c];
  const cyl = (rt, rb, h, y = 0, n = 10) => new T.CylinderGeometry(rt, rb, h, n).translate(0, y, 0);
  const box = (w, h, d, x = 0, y = 0, z = 0) => new T.BoxGeometry(w, h, d).translate(x, y, z);
  const lathe = (pts, n = 14) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(Math.max(r, 0.0001), y)), n);
  const tor = (r, t, rs = 5, ts = 16, arc = Math.PI * 2) => new T.TorusGeometry(r, t, rs, ts, arc);
  const ball = (r, x, y, z, w = 8, h = 6) => new T.SphereGeometry(r, w, h).translate(x, y, z);
  // Stab von a nach b (für Rahmen, Speichen, Griffe)
  const rod = (a, b, r, n = 5) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), d = B.clone().sub(A), L = d.length(); const g = new T.CylinderGeometry(r, r, L, n); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize())); return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); };
  // Speichenrad in der x-y-Ebene (Achse z)
  const wheel = (r, x, y, z, tire, spokeCol, n = 8, t = 0.022) => { const P = [C(tor(r, t, 5, 22).translate(x, y, z), tire), C(cyl(0.03, 0.03, 0.06, 0, 8).rotateX(Math.PI / 2).translate(x, y, z), spokeCol)]; for (let k = 0; k < n; k++) { const a = k / n * Math.PI; P.push(C(rod([x - Math.cos(a) * r, y - Math.sin(a) * r, z], [x + Math.cos(a) * r, y + Math.sin(a) * r, z], 0.005, 3), spokeCol)); } return P; };
  const IRON = [0.07, 0.07, 0.08], BRASS = [0.6, 0.45, 0.22], GOLD = [0.75, 0.56, 0.25], WOOD = [0.42, 0.28, 0.15], DARKW = [0.22, 0.12, 0.06], CREAM = [0.88, 0.83, 0.72], RUBBER = [0.04, 0.04, 0.045];
  const FLOWERS = [[0.85, 0.12, 0.2], [0.95, 0.8, 0.3], [0.92, 0.9, 0.85], [0.7, 0.25, 0.6], [0.95, 0.5, 0.2], [0.55, 0.15, 0.4]];
  const bouquet = (n, x, y, z, rx, rz, seed = 1) => { const P = []; let s = seed; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let k = 0; k < n; k++) { const px = x + (r() - 0.5) * rx, pz = z + (r() - 0.5) * rz; P.push(C(ball(0.035 + r() * 0.02, px, y + r() * 0.08, pz, 6, 4), FLOWERS[Math.floor(r() * FLOWERS.length)])); if (k % 2 === 0) P.push(C(ball(0.045, px + 0.03, y - 0.03, pz, 5, 4).scale(1, 0.6, 1), [0.1, 0.3, 0.12])); } return P; };
  return {
    /* ---------- Straße ---------- */
    // Zeitungsständer: Holzgestell mit schrägen Fächern, Zeitungen und Schild oben
    newsstand: () => { const P = []; for (const x of [-0.32, 0.32]) P.push(C(box(0.04, 1.1, 0.04, x, 0, -0.18), DARKW), C(box(0.04, 0.9, 0.04, x, -0.1, 0.2), DARKW), C(rod([x, -0.55, 0.2], [x, 0.35, -0.18], 0.018), DARKW));
      for (let k = 0; k < 3; k++) { const y = -0.35 + k * 0.28, z = 0.12 - k * 0.1; P.push(C(box(0.66, 0.02, 0.2, 0, y, z).rotateX(-0.5).translate(0, 0, 0), WOOD)); for (let j = 0; j < 3; j++) P.push(C(box(0.18, 0.24, 0.01, -0.21 + j * 0.21, y + 0.12, z - 0.02).rotateX(-0.25), j === 1 ? [0.9, 0.86, 0.76] : [0.8, 0.78, 0.7]), C(box(0.14, 0.03, 0.012, -0.21 + j * 0.21, y + 0.2, z - 0.04).rotateX(-0.25), [0.1, 0.1, 0.1])); }
      P.push(C(box(0.7, 0.16, 0.03, 0, 0.5, -0.18), PAINT), C(box(0.5, 0.05, 0.035, 0, 0.5, -0.18), CREAM)); return mergeColored(P); },
    // Bistrotisch: Marmorplatte auf gusseisernem Fuß
    bistroTable: () => mergeColored([C(cyl(0.32, 0.32, 0.03, 0.35, 18), [0.86, 0.84, 0.8]), C(cyl(0.325, 0.325, 0.012, 0.33, 18), BRASS), C(cyl(0.025, 0.035, 0.64, 0.02, 8), IRON), C(lathe([[0, -0.37], [0.22, -0.37], [0.2, -0.34], [0.05, -0.28], [0, -0.26]], 12), IRON)]),
    // Blumenkarren: Holzwagen mit zwei Speichenrädern, Eimern voller Blumen und Griffen
    flowercart: () => { const P = [C(box(1.3, 0.3, 0.75, -0.1, -0.05, 0), PAINT), C(box(1.34, 0.04, 0.79, -0.1, 0.11, 0), WOOD), C(box(1.3, 0.04, 0.7, -0.1, -0.2, 0), WOOD)];
      for (const z of [-0.43, 0.43]) P.push(...wheel(0.32, 0.15, -0.23, z, DARKW, DARKW, 6, 0.03));
      for (const z of [-0.3, 0.3]) P.push(C(rod([-0.75, 0.0, z], [-0.98, 0.1, z], 0.022), DARKW), C(box(0.05, 0.42, 0.05, -0.68, -0.33, z), DARKW));
      let s = 3; for (const x of [-0.55, -0.15, 0.25]) for (const z of [-0.18, 0.18]) { P.push(C(cyl(0.11, 0.09, 0.22, 0.24, 8).translate(x, 0, z), [0.5, 0.52, 0.55])); P.push(...bouquet(5, x, 0.42, z, 0.18, 0.18, s++)); }
      return mergeColored(P); },
    // Fahrrad (Herrenrad): zwei Räder, Diamantrahmen, Sattel, Lenker, Schutzbleche
    bicycle: () => { const r = 0.34, y0 = -0.16, F = PAINT, P = [...wheel(r, -0.52, y0, 0, RUBBER, [0.55, 0.55, 0.58], 10), ...wheel(r, 0.52, y0, 0, RUBBER, [0.55, 0.55, 0.58], 10)];
      const bb = [-0.08, y0, 0], st = [-0.18, 0.28, 0], ht = [0.38, 0.3, 0], hb = [0.42, 0.18, 0];
      P.push(C(rod(bb, st, 0.017), F), C(rod(st, ht, 0.016), F), C(rod(bb, hb, 0.017), F), C(rod(bb, [-0.52, y0, 0.04], 0.012), F), C(rod(st, [-0.52, y0, 0.04], 0.011), F), C(rod(ht, [0.52, y0, 0.03], 0.014), F), C(rod(hb, ht, 0.02), F));
      P.push(C(box(0.22, 0.05, 0.11, -0.2, 0.35, 0), [0.25, 0.14, 0.07]), C(rod([-0.19, 0.28, 0], [-0.19, 0.34, 0], 0.012), IRON), C(rod([0.38, 0.3, 0], [0.36, 0.42, 0], 0.012), IRON), C(rod([0.33, 0.43, -0.24], [0.33, 0.43, 0.24], 0.011), [0.6, 0.6, 0.62]));
      for (const z of [-0.24, 0.24]) P.push(C(cyl(0.017, 0.017, 0.09, 0, 6).rotateX(Math.PI / 2).translate(0.33, 0.43, z), [0.15, 0.1, 0.06]));
      for (const x of [-0.52, 0.52]) P.push(C(tor(r + 0.03, 0.02, 3, 12, Math.PI * 0.55).rotateZ(x < 0 ? 0.55 : 0.85).translate(x, y0, 0), F));
      P.push(C(cyl(0.05, 0.05, 0.03, 0, 10).rotateX(Math.PI / 2).translate(-0.08, y0, 0.04), [0.6, 0.6, 0.62]), C(cyl(0.035, 0.03, 0.06, 0, 8).rotateZ(Math.PI / 2).translate(0.42, 0.33, 0), [0.75, 0.6, 0.3]));
      return mergeColored(P); },
    // Kinderwagen: tiefe Wanne auf Federn, Verdeck halb offen, vier Räder, Schiebegriff
    pram: () => { const F = PAINT, P = [];
      P.push(C(new T.SphereGeometry(0.4, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1.05, 0.55, 0.62).translate(0, 0.1, 0), F));
      P.push(C(box(0.82, 0.02, 0.48, 0, 0.1, 0), [0.85, 0.82, 0.75]), C(new T.SphereGeometry(0.3, 12, 8, 0, Math.PI, 0, Math.PI / 2).rotateY(-Math.PI / 2).scale(1, 1.05, 1.05).translate(-0.18, 0.1, 0), [0.06, 0.06, 0.07]));
      for (const x of [-0.26, 0.26]) for (const z of [-0.27, 0.27]) P.push(...wheel(0.17, x, -0.36, z, RUBBER, [0.6, 0.6, 0.62], 6, 0.015));
      for (const z of [-0.2, 0.2]) P.push(C(rod([-0.26, -0.36, z], [0.0, -0.06, z * 0.9], 0.012), [0.6, 0.6, 0.62]), C(rod([0.26, -0.36, z], [0.0, -0.06, z * 0.9], 0.012), [0.6, 0.6, 0.62]), C(rod([0.36, 0.0, z], [0.58, 0.4, z], 0.013), [0.6, 0.6, 0.62]));
      P.push(C(rod([0.58, 0.4, -0.22], [0.58, 0.4, 0.22], 0.02), [0.1, 0.07, 0.05]));
      return mergeColored(P); },
    // Kohlenkarren: Holzkasten auf zwei Rädern, Kohlenhaufen, Deichsel
    handcart: () => { const P = [C(box(1.1, 0.4, 0.8, 0.1, 0.0, 0), [0.32, 0.22, 0.13])]; for (const y of [-0.12, 0.08]) P.push(C(box(1.12, 0.03, 0.82, 0.1, y, 0), [0.2, 0.13, 0.07]));
      P.push(C(new T.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3, 0.45, 0.9).translate(0.1, 0.18, 0), [0.05, 0.05, 0.055]));
      for (let k = 0; k < 9; k++) P.push(C(new T.DodecahedronGeometry(0.06 + (k % 3) * 0.02).translate(-0.3 + k * 0.1, 0.24 + (k % 2) * 0.06, ((k * 37) % 7 - 3) * 0.07), [0.06, 0.06, 0.065]));
      for (const z of [-0.47, 0.47]) P.push(...wheel(0.32, 0.2, -0.13, z, IRON, [0.25, 0.17, 0.1], 8, 0.03));
      for (const z of [-0.3, 0.3]) P.push(C(rod([-0.45, -0.1, z], [-0.95, -0.38, z], 0.025), [0.3, 0.2, 0.11]));
      P.push(C(rod([-0.95, -0.38, -0.3], [-0.95, -0.38, 0.3], 0.02), [0.3, 0.2, 0.11]));
      return mergeColored(P); },
    // Schubkarre aus Blech mit Holzholmen und einem Rad
    wheelbarrow: () => { const P = [C(lathe([[0, -0.15], [0.26, -0.15], [0.36, 0.13], [0.34, 0.13], [0.24, -0.12], [0, -0.12]], 12).scale(1.3, 1, 1).translate(0.05, 0.08, 0), [0.32, 0.4, 0.38])];
      P.push(...wheel(0.18, 0.62, -0.12, 0, RUBBER, IRON, 6, 0.03));
      for (const z of [-0.2, 0.2]) P.push(C(rod([0.62, -0.12, z * 0.25], [-0.68, 0.04, z], 0.022), [0.4, 0.27, 0.14]), C(rod([-0.2, -0.06, z * 0.9], [-0.22, -0.3, z], 0.018), IRON));
      return mergeColored(P); },
    // Stehleiter aus Holz (zwei Schenkel, fünf Sprossen, Spreizkette)
    ladder: () => { const P = [], H = 1.8, W = 0.24; for (const s of [-1, 1]) for (const z of [-W, W]) P.push(C(rod([s * 0.38, -H / 2, z], [s * 0.04, H / 2, z * 0.9], 0.025, 4), [0.6, 0.45, 0.28]));
      for (let k = 0; k < 5; k++) { const t = (k + 0.7) / 6, x = 0.38 - 0.34 * t, y = -H / 2 + H * t; P.push(C(box(0.08, 0.025, W * 2, x, y, 0), [0.55, 0.4, 0.24])); }
      P.push(C(box(0.18, 0.04, W * 2 + 0.06, 0, H / 2 + 0.02, 0), [0.5, 0.36, 0.2]), C(rod([0.2, -0.1, W], [-0.2, -0.1, W], 0.004, 3), IRON));
      return mergeColored(P); },
    // Werkzeugkiste aus Holz, Griffstange, Hammer und Zange darin
    toolbox: () => mergeColored([C(box(0.5, 0.16, 0.22, 0, -0.04), [0.45, 0.3, 0.16]), C(box(0.03, 0.2, 0.22, -0.235, 0.0), [0.4, 0.26, 0.14]), C(box(0.03, 0.2, 0.22, 0.235, 0.0), [0.4, 0.26, 0.14]), C(rod([-0.235, 0.1, 0], [0.235, 0.1, 0], 0.012), [0.3, 0.2, 0.1]),
      C(box(0.28, 0.025, 0.025, -0.05, 0.06, 0.05), [0.35, 0.22, 0.1]), C(box(0.04, 0.05, 0.05, -0.2, 0.06, 0.05), IRON), C(box(0.2, 0.02, 0.03, 0.08, 0.05, -0.05).rotateY(0.3), [0.3, 0.3, 0.33])]),
    // Mehlsack aus Jute mit Stempel
    sack: () => mergeColored([C(new T.SphereGeometry(0.24, 10, 8).scale(0.85, 1.2, 0.7), [0.78, 0.7, 0.55]), C(cyl(0.06, 0.1, 0.12, 0.3, 8), [0.75, 0.67, 0.52]), C(tor(0.08, 0.012, 4, 10).rotateX(Math.PI / 2).translate(0, 0.27, 0), [0.45, 0.35, 0.2]), C(box(0.16, 0.12, 0.01, 0, 0.0, 0.165), [0.25, 0.3, 0.55])]),
    // Obstkiste mit Äpfeln
    fruitcrate: () => { const P = [C(box(0.5, 0.06, 0.36, 0, -0.12), [0.62, 0.48, 0.3])]; for (const z of [-0.17, 0.17]) P.push(C(box(0.5, 0.12, 0.02, 0, -0.03, z), [0.65, 0.5, 0.32])); for (const x of [-0.24, 0.24]) P.push(C(box(0.02, 0.2, 0.36, x, -0.05, 0), [0.55, 0.42, 0.26]));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P.push(C(ball(0.05, -0.16 + i * 0.105, 0.0 + ((i + j) % 2) * 0.02, -0.1 + j * 0.1, 7, 5), (i + j) % 3 ? [0.66, 0.1, 0.07] : [0.55, 0.62, 0.15]));
      return mergeColored(P); },
    // Tauwerk: aufgeschossenes Seil
    ropecoil: () => { const P = []; for (let k = 0; k < 4; k++) P.push(C(tor(0.26 - k * 0.025, 0.035, 5, 20).rotateX(Math.PI / 2).translate(0, -0.06 + k * 0.045, 0), [0.62, 0.52, 0.36])); P.push(C(rod([0.2, -0.06, 0.1], [0.42, -0.08, 0.2], 0.03), [0.6, 0.5, 0.34])); return mergeColored(P); },
    // Rettungsring, weiß und rot, mit Leine
    lifebuoy: () => { const P = []; for (let k = 0; k < 4; k++) P.push(C(tor(0.27, 0.075, 8, 8, Math.PI / 2).rotateX(Math.PI / 2).rotateY(k * Math.PI / 2), k % 2 ? [0.75, 0.1, 0.08] : [0.92, 0.9, 0.86])); P.push(C(tor(0.36, 0.008, 3, 24).rotateX(Math.PI / 2), [0.7, 0.62, 0.45])); return mergeColored(P); },
    // Postsack aus Segeltuch mit Aufdruck
    mailsack: () => mergeColored([C(new T.SphereGeometry(0.24, 10, 8).scale(0.9, 1.3, 0.75), [0.55, 0.5, 0.38]), C(cyl(0.07, 0.12, 0.12, 0.33, 8), [0.52, 0.47, 0.35]), C(tor(0.09, 0.014, 4, 10).rotateX(Math.PI / 2).translate(0, 0.3, 0), [0.35, 0.2, 0.1]), C(box(0.2, 0.08, 0.01, 0, 0.04, 0.175), [0.75, 0.6, 0.15])]),
    // Terrakottatopf mit Blumen
    flowerpot: () => mergeColored([C(lathe([[0, -0.22], [0.12, -0.22], [0.17, 0.0], [0.18, 0.0], [0.18, 0.04], [0, 0.04]], 12), [0.62, 0.32, 0.2]), C(cyl(0.16, 0.16, 0.01, 0.03, 12), [0.15, 0.1, 0.06]), ...[0, 1, 2, 3, 4, 5].map(k => C(ball(0.07, Math.cos(k) * 0.08, 0.1 + (k % 2) * 0.04, Math.sin(k) * 0.08, 6, 4), [0.1, 0.32, 0.12])), ...bouquet(7, 0, 0.17, 0, 0.2, 0.2, 7)]),
    // Schneeschaufel mit Holzstiel (lehnt an der Wand)
    shovel: () => mergeColored([C(box(0.36, 0.42, 0.02, 0, -0.42, 0.0).rotateX(0.12), [0.4, 0.42, 0.44]), C(box(0.36, 0.03, 0.06, 0, -0.62, 0.04), [0.35, 0.36, 0.38]), C(cyl(0.017, 0.017, 1.0, 0.28, 6), [0.5, 0.36, 0.2]), C(box(0.14, 0.03, 0.03, 0, 0.78), [0.4, 0.28, 0.14])]),
    // Rodelschlitten: Holzlatten auf geschwungenen Kufen
    sled: () => { const P = []; for (const z of [-0.18, 0.18]) { P.push(C(box(0.9, 0.025, 0.035, 0, -0.1, z), [0.55, 0.4, 0.22]), C(tor(0.1, 0.017, 4, 8, Math.PI).rotateZ(Math.PI / 2).translate(0.45, 0.0, z), [0.55, 0.4, 0.22])); for (const x of [-0.3, 0.0, 0.3]) P.push(C(box(0.04, 0.15, 0.03, x, -0.02, z), [0.5, 0.35, 0.18])); }
      for (let k = 0; k < 5; k++) P.push(C(box(0.14, 0.022, 0.44, -0.3 + k * 0.15, 0.065, 0), [0.62, 0.46, 0.26])); P.push(C(rod([0.5, 0.1, -0.18], [0.5, 0.1, 0.18], 0.01), [0.4, 0.3, 0.2])); return mergeColored(P); },
    // Maronistand: Blechofen auf Rädern, glühende Kohlen, Rohr, Tüten
    chestnut: () => { const P = [C(box(0.8, 0.5, 0.5, 0, -0.1), PAINT), C(box(0.84, 0.04, 0.54, 0, 0.16), BRASS), C(cyl(0.22, 0.22, 0.06, 0.2, 14), [0.12, 0.12, 0.13]), C(cyl(0.2, 0.2, 0.02, 0.23, 14), [1.4, 0.55, 0.18]),
      C(cyl(0.05, 0.05, 0.6, 0.5, 8).translate(0.3, 0, -0.15), [0.12, 0.12, 0.13]), C(cyl(0.08, 0.05, 0.06, 0.82, 8).translate(0.3, 0, -0.15), [0.12, 0.12, 0.13]), C(box(0.6, 0.2, 0.02, 0, -0.15, 0.26), [0.9, 0.82, 0.6])];
      for (let k = 0; k < 10; k++) P.push(C(ball(0.025, Math.cos(k * 2.4) * 0.12, 0.25, Math.sin(k * 2.4) * 0.12, 5, 4), [0.35, 0.18, 0.08]));
      for (const z of [-0.27, 0.27]) P.push(...wheel(0.18, -0.25, -0.5, z, IRON, IRON, 6, 0.02)); P.push(C(box(0.05, 0.3, 0.05, 0.33, -0.5, 0), IRON), C(rod([-0.4, 0.0, -0.2], [-0.65, 0.12, -0.2], 0.015), DARKW), C(rod([-0.4, 0.0, 0.2], [-0.65, 0.12, 0.2], 0.015), DARKW));
      return mergeColored(P); },
    // Telefonzelle: Holz und Glas, Krone mit Schild, kleine Lampe
    phonebooth: () => { const P = [C(box(1.0, 0.12, 1.0, 0, -1.19), [0.2, 0.2, 0.21]), C(box(1.06, 0.18, 1.06, 0, 1.12), PAINT), C(box(0.9, 0.12, 0.9, 0, 1.27), PAINT), C(new T.ConeGeometry(0.62, 0.2, 4).rotateY(Math.PI / 4).translate(0, 1.43, 0), PAINT)];
      for (const x of [-0.47, 0.47]) for (const z of [-0.47, 0.47]) P.push(C(box(0.07, 2.2, 0.07, x, -0.03, z), PAINT));
      for (const [x, z, ry] of [[0, 0.47, 0], [0, -0.47, 0], [0.47, 0, Math.PI / 2], [-0.47, 0, Math.PI / 2]]) { P.push(C(box(0.86, 1.5, 0.015, 0, 0.1, 0).rotateY(ry).translate(x, 0, z), [0.12, 0.2, 0.22])); for (const y of [-0.3, 0.3]) P.push(C(box(0.86, 0.03, 0.03, 0, y + 0.1, 0).rotateY(ry).translate(x, 0, z), PAINT)); P.push(C(box(0.86, 0.5, 0.03, 0, -0.9, 0).rotateY(ry).translate(x, 0, z), PAINT)); }
      P.push(C(box(0.7, 0.12, 0.02, 0, 1.12, 0.54), CREAM), C(box(0.5, 0.04, 0.025, 0, 1.12, 0.545), [0.1, 0.1, 0.12]), C(ball(0.06, 0, 1.0, 0, 6, 4), [1.4, 1.1, 0.7]), C(box(0.2, 0.3, 0.12, 0, 0.2, -0.36), [0.05, 0.05, 0.06]), C(box(0.05, 0.12, 0.05, 0.05, 0.25, -0.29), [0.05, 0.05, 0.06]));
      return mergeColored(P); },
    // Schuhputzstuhl: erhöhter Sessel auf Podest mit Fußstützen aus Messing
    shoeshine: () => mergeColored([C(box(0.7, 0.45, 0.7, 0, -0.38), [0.32, 0.18, 0.08]), C(box(0.6, 0.12, 0.55, 0, -0.05, -0.02), [0.45, 0.08, 0.08]), C(box(0.6, 0.55, 0.1, 0, 0.27, -0.28), [0.45, 0.08, 0.08]), C(box(0.08, 0.3, 0.5, -0.31, 0.12, -0.02), [0.32, 0.18, 0.08]), C(box(0.08, 0.3, 0.5, 0.31, 0.12, -0.02), [0.32, 0.18, 0.08]),
      C(box(0.12, 0.04, 0.22, -0.13, -0.2, 0.48), BRASS), C(box(0.12, 0.04, 0.22, 0.13, -0.2, 0.48), BRASS), C(rod([-0.13, -0.6, 0.38], [-0.13, -0.2, 0.45], 0.015), BRASS), C(rod([0.13, -0.6, 0.38], [0.13, -0.2, 0.45], 0.015), BRASS), C(box(0.3, 0.15, 0.2, 0, -0.52, 0.58), [0.25, 0.14, 0.07])]),
    // Gepäckwagen des Hotels: Messingrahmen auf vier Rädern, Stange mit Bogen
    luggagecart: () => { const P = [C(box(1.1, 0.04, 0.6, 0, -0.32), [0.45, 0.08, 0.1]), C(box(1.14, 0.03, 0.64, 0, -0.29), GOLD)];
      for (const x of [-0.53, 0.53]) for (const z of [-0.28, 0.28]) P.push(C(rod([x, -0.3, z], [x, 0.65, z], 0.018), GOLD), C(cyl(0.07, 0.07, 0.04, 0, 10).rotateX(Math.PI / 2).translate(x, -0.47, z), RUBBER));
      for (const z of [-0.28, 0.28]) P.push(C(tor(0.53, 0.02, 5, 16, Math.PI).translate(0, 0.65, z), GOLD)); P.push(C(rod([0, 1.18, -0.28], [0, 1.18, 0.28], 0.02), GOLD));
      return mergeColored(P); },
    // Liegestuhl aus Holz und gestreiftem Stoff (Dachterrasse)
    deckchair: () => { const P = []; for (const z of [-0.27, 0.27]) P.push(C(rod([-0.55, -0.3, z], [0.35, 0.3, z], 0.022, 4), [0.6, 0.45, 0.26]), C(rod([0.2, -0.3, z], [-0.2, 0.08, z], 0.022, 4), [0.6, 0.45, 0.26]), C(rod([0.55, -0.3, z], [0.3, -0.05, z], 0.022, 4), [0.6, 0.45, 0.26]));
      for (let k = 0; k < 5; k++) P.push(C(box(1.0, 0.012, 0.104, 0, 0, -0.208 + k * 0.104).rotateZ(0.588).translate(-0.12, -0.02, 0), k % 2 ? [0.92, 0.88, 0.8] : PAINT)); return mergeColored(P); },   // Stoffbahn in Längsstreifen
    /* ---------- Zimmer ---------- */
    // Grammophon: Holzkasten, Plattenteller, großer Messingtrichter
    gramophone: () => mergeColored([C(box(0.36, 0.18, 0.36, 0, -0.22), [0.32, 0.17, 0.08]), C(box(0.38, 0.02, 0.38, 0, -0.12), [0.2, 0.1, 0.05]), C(cyl(0.15, 0.15, 0.01, -0.105, 18), [0.05, 0.05, 0.06]), C(cyl(0.004, 0.004, 0.08, 0, 4).rotateZ(1.2).translate(0.1, -0.09, 0.1), [0.6, 0.6, 0.62]),
      C(rod([0.13, -0.1, 0.13], [0.12, 0.05, 0.12], 0.012), BRASS), C(lathe([[0.012, 0], [0.03, 0.12], [0.07, 0.22], [0.15, 0.3], [0.2, 0.32], [0.19, 0.32], [0.14, 0.29], [0.06, 0.21], [0.02, 0.11], [0.006, 0]], 16).rotateZ(-0.9).translate(0.12, 0.05, 0.12), GOLD), C(box(0.02, 0.06, 0.02, 0.19, -0.2, 0), BRASS)]),
    // Röhrenradio im Kathedralen-Gehäuse
    radio: () => mergeColored([C(box(0.38, 0.32, 0.22, 0, -0.08), [0.38, 0.2, 0.09]), C(new T.CylinderGeometry(0.19, 0.19, 0.22, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).scale(1, 0.7, 1).translate(0, 0.08, 0), [0.38, 0.2, 0.09]),
      C(box(0.24, 0.26, 0.01, 0, 0.0, 0.111), [0.75, 0.62, 0.38]), ...[-0.06, 0, 0.06].map(x => C(box(0.012, 0.24, 0.012, x, 0.0, 0.116), [0.3, 0.16, 0.07])), C(cyl(0.025, 0.025, 0.02, 0, 10).rotateX(Math.PI / 2).translate(-0.08, -0.18, 0.115), GOLD), C(cyl(0.025, 0.025, 0.02, 0, 10).rotateX(Math.PI / 2).translate(0.08, -0.18, 0.115), GOLD), C(box(0.4, 0.03, 0.24, 0, -0.245), [0.25, 0.13, 0.06])]),
    // Schreibmaschine: schwarzer Lack, Tasten in Reihen, Walze, Papier
    typewriter: () => { const P = [C(box(0.34, 0.08, 0.3, 0, -0.04, 0.02), [0.05, 0.05, 0.06]), C(box(0.3, 0.06, 0.12, 0, 0.02, -0.08).rotateX(-0.3), [0.05, 0.05, 0.06]), C(cyl(0.025, 0.025, 0.42, 0, 10).rotateZ(Math.PI / 2).translate(0, 0.07, -0.1), [0.08, 0.08, 0.09]), C(box(0.21, 0.2, 0.004, 0, 0.17, -0.11).rotateX(-0.2), [0.93, 0.9, 0.84]), C(box(0.04, 0.02, 0.02, 0.24, 0.08, -0.1), [0.7, 0.7, 0.72])];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) P.push(C(cyl(0.011, 0.011, 0.01, 0, 6).translate(-0.13 + k * 0.032 + r * 0.008, 0.005 + r * 0.012, 0.12 - r * 0.035), [0.85, 0.83, 0.78]));
      return mergeColored(P); },
    // Globus auf Holzständer mit Messingmeridian
    globe: () => mergeColored([C(ball(0.16, 0, 0.1, 0, 14, 10), [0.55, 0.62, 0.5]), ...[0, 1, 2, 3].map(k => C(ball(0.07, Math.cos(k * 1.7) * 0.11, 0.1 + Math.sin(k * 2.3) * 0.08, Math.sin(k * 1.7) * 0.11, 6, 4).scale(1, 0.6, 1), [0.62, 0.52, 0.32])), C(tor(0.18, 0.008, 4, 22).rotateZ(0.4).translate(0, 0.1, 0), BRASS), C(cyl(0.02, 0.03, 0.2, -0.13, 8), [0.32, 0.17, 0.08]), C(cyl(0.13, 0.15, 0.04, -0.26, 14), [0.32, 0.17, 0.08])]),
    // Vogelkäfig aus Messing mit Kuppel, Ring und Stange
    birdcage: () => { const P = [C(cyl(0.16, 0.17, 0.04, -0.28, 14), BRASS), C(tor(0.16, 0.006, 4, 16).rotateX(Math.PI / 2).translate(0, 0.05, 0), BRASS), C(new T.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.08, 0), [0.6, 0.45, 0.22]), C(tor(0.04, 0.006, 4, 10).translate(0, 0.28, 0), BRASS), C(rod([-0.12, -0.12, 0], [0.12, -0.12, 0], 0.005), DARKW), C(ball(0.035, 0.02, -0.08, 0, 6, 5).scale(1.3, 1, 0.9), [0.95, 0.8, 0.2])];
      for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; P.push(C(rod([Math.cos(a) * 0.16, -0.26, Math.sin(a) * 0.16], [Math.cos(a) * 0.16, 0.08, Math.sin(a) * 0.16], 0.003, 3), BRASS)); }
      return mergeColored(P); },
    // Garderobenständer aus Bugholz, mit Hut und Mantel
    hatstand: () => { const P = [C(cyl(0.025, 0.03, 1.8, 0, 8), DARKW)]; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; P.push(C(rod([0, -0.75, 0], [Math.cos(a) * 0.3, -0.9, Math.sin(a) * 0.3], 0.02, 5), DARKW), C(rod([0, 0.7, 0], [Math.cos(a) * 0.2, 0.82, Math.sin(a) * 0.2], 0.015, 5), DARKW)); }
      P.push(C(ball(0.035, 0, 0.92, 0, 6, 5), BRASS), C(cyl(0.16, 0.16, 0.012, 0.85, 14).translate(0.17, 0, 0.07), [0.08, 0.08, 0.09]), C(cyl(0.09, 0.1, 0.12, 0.92, 12).translate(0.17, 0, 0.07), [0.08, 0.08, 0.09]), C(cyl(0.1, 0.1, 0.02, 0.88, 12).translate(0.17, 0, 0.07), [0.4, 0.1, 0.1]));
      P.push(C(new T.CylinderGeometry(0.1, 0.22, 1.05, 10, 1, true).translate(-0.05, 0.25, -0.17), [0.16, 0.13, 0.1]), C(cyl(0.12, 0.1, 0.08, 0.78, 8).translate(-0.05, 0, -0.17), [0.16, 0.13, 0.1]));
      return mergeColored(P); },
    // Sektkühler aus Silber auf Fuß, Flasche im Eis
    icebucket: () => mergeColored([C(lathe([[0, -0.2], [0.07, -0.2], [0.03, -0.17], [0.03, -0.07], [0.1, -0.06], [0.12, 0.08], [0.115, 0.08], [0.09, -0.04], [0, -0.04]], 16), [0.82, 0.84, 0.86]), C(cyl(0.105, 0.105, 0.01, 0.06, 14), [0.9, 0.95, 1.0]),
      C(lathe([[0, -0.03], [0.04, -0.03], [0.042, 0.12], [0.028, 0.16], [0.014, 0.19], [0.015, 0.24], [0, 0.24]], 10).rotateZ(0.25).translate(0.02, 0, 0), [0.04, 0.12, 0.07]), C(cyl(0.016, 0.016, 0.06, 0.22, 8).rotateZ(0.25).translate(-0.03, 0, 0), GOLD), C(tor(0.03, 0.006, 4, 8, Math.PI).translate(0.12, 0.05, 0).rotateY(0), [0.82, 0.84, 0.86])]),
    // Kristallvase mit langstieligen Rosen
    flowervase: () => { const P = [C(lathe([[0, -0.25], [0.07, -0.25], [0.05, -0.2], [0.06, -0.05], [0.08, 0.0], [0.07, 0.02], [0, 0.0]], 14), [0.8, 0.88, 0.9])]; for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.03 + (k % 3) * 0.02, tx = Math.cos(a) * (r + 0.05), tz = Math.sin(a) * (r + 0.05); P.push(C(rod([Math.cos(a) * 0.02, -0.05, Math.sin(a) * 0.02], [tx, 0.18 + (k % 2) * 0.05, tz], 0.004, 3), [0.12, 0.3, 0.12]), C(ball(0.03, tx, 0.2 + (k % 2) * 0.05, tz, 6, 5), k % 3 ? [0.75, 0.05, 0.1] : [0.95, 0.92, 0.85])); }
      return mergeColored(P); },
    // Schirmständer aus Messing mit drei Schirmen und einem Spazierstock
    umbrellastand: () => { const P = [C(lathe([[0, -0.45], [0.12, -0.45], [0.13, -0.42], [0.11, -0.1], [0.12, -0.08], [0.0, -0.08]], 12), BRASS)]; for (let k = 0; k < 3; k++) { const a = k * 2.1; P.push(C(new T.ConeGeometry(0.045, 0.62, 8).translate(Math.cos(a) * 0.05, 0.13, Math.sin(a) * 0.05).rotateZ(0.05 * Math.cos(a)), [[0.08, 0.08, 0.09], [0.35, 0.08, 0.1], [0.1, 0.25, 0.26]][k]), C(tor(0.035, 0.008, 4, 8, Math.PI).translate(Math.cos(a) * 0.05 + 0.035, 0.48, Math.sin(a) * 0.05), DARKW)); }
      P.push(C(rod([0.04, -0.1, -0.04], [0.06, 0.5, -0.05], 0.009), DARKW), C(ball(0.02, 0.06, 0.51, -0.05, 6, 4), GOLD)); return mergeColored(P); },
    // Teeservice auf Silbertablett
    teatray: () => { const P = [C(cyl(0.22, 0.2, 0.015, -0.07, 18).scale(1, 1, 0.7), [0.8, 0.82, 0.84]), C(lathe([[0, -0.06], [0.06, -0.06], [0.075, 0.0], [0.06, 0.04], [0.02, 0.05], [0.03, 0.065], [0, 0.07]], 12).translate(-0.06, 0, 0), [0.92, 0.9, 0.86]), C(rod([-0.05, 0.0, 0], [0.01, 0.03, 0], 0.008), [0.92, 0.9, 0.86])];
      for (const [x, z] of [[0.1, 0.06], [0.1, -0.06]]) P.push(C(cyl(0.04, 0.04, 0.008, -0.058, 12).translate(x, 0, z), [0.92, 0.9, 0.86]), C(lathe([[0, -0.055], [0.022, -0.055], [0.032, -0.02], [0.03, -0.02], [0.02, -0.05], [0, -0.05]], 10).translate(x, 0, z), [0.92, 0.9, 0.86]), C(cyl(0.028, 0.028, 0.004, -0.028, 10).translate(x, 0, z), [0.45, 0.22, 0.08]));
      return mergeColored(P); },
    // Schachbrett mit Figuren
    chessboard: () => { const P = [C(box(0.4, 0.03, 0.4, 0, -0.025), [0.3, 0.17, 0.08])]; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) P.push(C(box(0.045, 0.004, 0.045, -0.1575 + i * 0.045, -0.009, -0.1575 + j * 0.045), (i + j) % 2 ? [0.15, 0.1, 0.06] : [0.85, 0.78, 0.62]));
      for (let k = 0; k < 14; k++) { const i = k % 8, j = k < 8 ? (k % 2 ? 1 : 0) : (k % 2 ? 6 : 7), h = k % 5 === 0 ? 0.06 : 0.035; P.push(C(cyl(0.008, 0.014, h, -0.007 + h / 2, 6).translate(-0.1575 + i * 0.045, 0, -0.1575 + j * 0.045), j < 4 ? [0.9, 0.86, 0.75] : [0.08, 0.06, 0.05])); }
      return mergeColored(P); },
    // Bronzefigur einer Tänzerin auf Marmorsockel (Art déco)
    statuette: () => { const B = [0.5, 0.36, 0.16], P = [C(box(0.12, 0.08, 0.12, 0, -0.21), [0.12, 0.1, 0.1]), C(box(0.13, 0.015, 0.13, 0, -0.165), GOLD), C(rod([0, -0.16, 0], [0.01, 0.0, 0], 0.012), B), C(rod([0.01, -0.16, 0], [-0.03, -0.04, 0.04], 0.01), B), C(new T.ConeGeometry(0.05, 0.12, 8).translate(0.01, -0.0, 0), B), C(rod([0.01, 0.0, 0], [0.01, 0.1, 0], 0.016), B), C(ball(0.022, 0.01, 0.13, 0, 8, 6), B)];
      P.push(C(rod([0.01, 0.09, 0], [0.09, 0.2, 0.02], 0.007), B), C(rod([0.01, 0.09, 0], [-0.07, 0.19, -0.02], 0.007), B), C(tor(0.08, 0.004, 3, 10, Math.PI).translate(0.01, 0.15, 0), GOLD)); return mergeColored(P); },
    // Bierkasten aus Holz mit zwölf braunen Flaschen
    bottlecrate: () => { const P = [C(box(0.42, 0.04, 0.3, 0, -0.12), [0.5, 0.38, 0.22])]; for (const z of [-0.14, 0.14]) P.push(C(box(0.42, 0.18, 0.02, 0, -0.05, z), [0.55, 0.42, 0.25])); for (const x of [-0.2, 0.2]) P.push(C(box(0.02, 0.24, 0.3, x, -0.02, 0), [0.5, 0.38, 0.22]));
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) P.push(C(lathe([[0, -0.1], [0.03, -0.1], [0.03, 0.03], [0.012, 0.08], [0.012, 0.12], [0, 0.12]], 7).translate(-0.135 + i * 0.09, 0, -0.09 + j * 0.09), [0.28, 0.14, 0.04]));
      return mergeColored(P); },
  };
}

// Maße (Halbmaße der Hülle), Masse, Stoff; solid = sperrt den Weg (Kollisionsquader, solange es an seinem Platz steht)
export function clutterKinds() {
  return {
    newsstand: { name: 'Zeitungsständer', kind: 'box', he: [0.36, 0.56, 0.24], m: 14, stuff: 'wood', small: false },
    bistroTable: { name: 'Bistrotisch', kind: 'cyl', he: [0.32, 0.37, 0.32], m: 18, stuff: 'metal', small: false },
    flowercart: { name: 'Blumenkarren', kind: 'box', he: [0.78, 0.55, 0.5], m: 70, stuff: 'wood', small: false, solid: true },
    bicycle: { name: 'Fahrrad', kind: 'box', he: [0.86, 0.5, 0.12], m: 16, stuff: 'metal', small: false },
    pram: { name: 'Kinderwagen', kind: 'box', he: [0.5, 0.54, 0.32], m: 14, stuff: 'leather', small: false },
    handcart: { name: 'Kohlenkarren', kind: 'box', he: [0.7, 0.47, 0.5], m: 85, stuff: 'wood', small: false, solid: true },
    wheelbarrow: { name: 'Schubkarre', kind: 'box', he: [0.68, 0.3, 0.32], m: 22, stuff: 'metal', small: false },
    ladder: { name: 'Stehleiter', kind: 'box', he: [0.4, 0.92, 0.26], m: 11, stuff: 'wood', small: false },
    toolbox: { name: 'Werkzeugkiste', kind: 'box', he: [0.25, 0.12, 0.11], m: 7, stuff: 'wood', small: false },
    sack: { name: 'Mehlsack', kind: 'box', he: [0.2, 0.32, 0.17], m: 25, stuff: 'leather', small: false },
    fruitcrate: { name: 'Obstkiste', kind: 'box', he: [0.25, 0.15, 0.18], m: 8, stuff: 'wood', small: false },
    ropecoil: { name: 'Tauwerk', kind: 'cyl', he: [0.3, 0.1, 0.3], m: 16, stuff: 'leather', small: false },
    lifebuoy: { name: 'Rettungsring', kind: 'cyl', he: [0.36, 0.075, 0.36], m: 2.5, stuff: 'leather', small: false },
    mailsack: { name: 'Postsack', kind: 'box', he: [0.21, 0.36, 0.18], m: 12, stuff: 'leather', small: false },
    flowerpot: { name: 'Blumentopf', kind: 'cyl', he: [0.18, 0.22, 0.18], m: 9, stuff: 'clay', small: false },
    shovel: { name: 'Schneeschaufel', kind: 'box', he: [0.18, 0.8, 0.06], m: 2.5, stuff: 'wood', small: false },
    sled: { name: 'Schlitten', kind: 'box', he: [0.52, 0.12, 0.22], m: 7, stuff: 'wood', small: false },
    chestnut: { name: 'Maronistand', kind: 'box', he: [0.45, 0.68, 0.34], m: 60, stuff: 'metal', small: false, solid: true },
    phonebooth: { name: 'Telefonzelle', kind: 'box', he: [0.53, 1.3, 0.53], m: 420, stuff: 'wood', small: false, solid: true },
    shoeshine: { name: 'Schuhputzstuhl', kind: 'box', he: [0.36, 0.6, 0.45], m: 45, stuff: 'wood', small: false, solid: true },
    luggagecart: { name: 'Gepäckwagen', kind: 'box', he: [0.57, 0.5, 0.32], m: 30, stuff: 'metal', small: false },
    deckchair: { name: 'Liegestuhl', kind: 'box', he: [0.56, 0.3, 0.28], m: 7, stuff: 'wood', small: false },
    gramophone: { name: 'Grammophon', kind: 'box', he: [0.2, 0.32, 0.2], m: 8, stuff: 'wood', small: false },
    radio: { name: 'Radio', kind: 'box', he: [0.2, 0.26, 0.12], m: 7, stuff: 'wood', small: true },
    typewriter: { name: 'Schreibmaschine', kind: 'box', he: [0.2, 0.09, 0.16], m: 6, stuff: 'metal', small: true },
    globe: { name: 'Globus', kind: 'cyl', he: [0.18, 0.28, 0.18], m: 4, stuff: 'wood', small: false },
    birdcage: { name: 'Vogelkäfig', kind: 'cyl', he: [0.17, 0.31, 0.17], m: 2, stuff: 'metal', small: false },
    hatstand: { name: 'Garderobenständer', kind: 'cyl', he: [0.3, 0.95, 0.3], m: 9, stuff: 'wood', small: false },
    icebucket: { name: 'Sektkühler', kind: 'cyl', he: [0.12, 0.22, 0.12], m: 4, stuff: 'metal', small: true },
    flowervase: { name: 'Blumenvase', kind: 'cyl', he: [0.1, 0.25, 0.1], m: 2, stuff: 'glass', small: true },
    umbrellastand: { name: 'Schirmständer', kind: 'cyl', he: [0.13, 0.48, 0.13], m: 6, stuff: 'metal', small: false },
    teatray: { name: 'Teeservice', kind: 'box', he: [0.22, 0.07, 0.15], m: 2.5, stuff: 'glass', small: true },
    chessboard: { name: 'Schachbrett', kind: 'box', he: [0.2, 0.04, 0.2], m: 1.5, stuff: 'wood', small: true },
    statuette: { name: 'Bronzefigur', kind: 'box', he: [0.07, 0.25, 0.07], m: 4, stuff: 'metal', small: true },
    bottlecrate: { name: 'Bierkasten', kind: 'box', he: [0.21, 0.14, 0.15], m: 14, stuff: 'wood', small: false },
  };
}
