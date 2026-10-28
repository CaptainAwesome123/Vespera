import { registerLayer, chunkKey } from './chunks.js';
import { shared, MOBILE, canvasTex, T, mulberry32, scene, pick, camera, R, rand, mergeGeos, U } from './core.js';
import { addCollider, paintMat, mergeColored } from './people-skeleton.js';
import { FL, addSeg, addGlow, addNeon, NEON, curbs, lamps, trees, steamPts, segs, towers, shafts, neons, spires, glowPts, roofs } from './facade-shader.js';
import { BR_SPOTS } from './island.js';
import { bandC, pickW, DOORS, lathe, placeFurn, FURN, decoBuilding, caps, domes, signDefs } from './entrances.js';
import { kit, Bx, wuv, benchGeo } from './harbour.js';
import { DECO } from './building-forms.js';
import { DRESSES, SHIRTS, setAct, _e } from './serpentine.js';
import { _p, _q, _s, _m, _up } from './traffic.js';
import { player } from './player.js';
import { VENUE_PEDS } from './venues.js';
import { toast } from './boat.js';
import { goodsAt } from './assets.js';
import { INTERACT } from './music.js';
import { addLight } from './performance.js';

/* =====================================================================
   V19 · BEGEHBARE LÄDEN: Erdgeschosse mit 60 cm dicken Mauern, Schaufenstern mit
   Auslage, offener Ladentür, Innenraum (Boden, Decke, Lampen, Theke, Regale mit
   Waren), Händler hinter der Theke, Kundschaft; Namen auf Messingschildern
   ===================================================================== */
export const SHOPS = [];
export const SHOP_MAX = MOBILE ? 14 : 44;
export const SHOP_KINDS = [
  { k: 'hut', w: 1.2, names: ['CHAPEAU ROYAL', 'HUTSALON FALK', 'HÜTE & MÜTZEN LANG', 'MODISTIN MARGOT'], ware: 'einen Filzhut mit Seidenband', col: [0.35, 0.08, 0.1] },
  { k: 'buch', w: 1.2, names: ['BUCHHANDLUNG SEIDEL', 'ANTIQUARIAT NOVAK', 'BÜCHER & KARTEN', 'LESEZIRKEL WINTER'], ware: 'einen in Leder gebundenen Roman', col: [0.08, 0.2, 0.14] },
  { k: 'deli', w: 1.3, names: ['DELIKATESSEN MARCHETTI', 'FEINKOST DUBOIS', 'KÄSE · WURST · WEIN', 'KOLONIALWAREN ROTH'], ware: 'ein Stück Bergkäse und Oliven', col: [0.08, 0.14, 0.3] },
  { k: 'tabak', w: 1.0, names: ['TABAK & ZEITUNGEN', 'ZIGARREN HOFFMANN', 'TABAKWAREN LORENZ'], ware: 'eine Zigarre aus der Kiste', col: [0.3, 0.16, 0.06] },
  { k: 'uhren', w: 1.0, names: ['UHREN & JUWELEN STEIN', 'JUWELIER GRAF', 'CHRONOMETER ADLER'], ware: 'eine goldene Taschenuhr', col: [0.06, 0.1, 0.26] },
  { k: 'blumen', w: 1.0, names: ['BLUMEN ROSA', 'FLEURS DE NUIT', 'BLUMENHAUS SOMMER'], ware: 'einen Strauß weißer Rosen', col: [0.1, 0.3, 0.18] },
  { k: 'apotheke', w: 0.9, names: ['STERN-APOTHEKE', 'APOTHEKE ZUM MOND', 'ALTE APOTHEKE'], ware: 'Hustenbonbons und Kölnisch Wasser', col: [0.06, 0.22, 0.14] },
  { k: 'mode', w: 1.1, names: ['MODESALON VERA', 'MAISON LOUISE', 'KONFEKTION WEISS'], ware: 'ein Abendkleid mit Perlenstickerei', col: [0.3, 0.06, 0.16] },
  { k: 'platten', w: 0.9, names: ['GRAMMOPHON-HAUS', 'SCHALLPLATTEN KÖNIG', 'MUSIKALIEN ROTH'], ware: 'eine Schellackplatte mit Foxtrott', col: [0.1, 0.08, 0.2] },
  { k: 'spiel', w: 0.8, names: ['SPIELWAREN ZIEGLER', 'PUPPEN & ZINNSOLDATEN', 'SPIELZEUG-PARADIES'], ware: 'eine Blechlokomotive zum Aufziehen', col: [0.6, 0.12, 0.08] },
  { k: 'schneider', w: 0.9, names: ['SCHNEIDEREI KELLER', 'MASSATELIER MAYER', 'HERRENMODEN FISCHER'], ware: 'einen Anzug nach Maß', col: [0.12, 0.12, 0.16] },
  { k: 'friseur', w: 0.9, names: ['FRISEUR-SALON MORGAN', 'BARBIER O’HARA', 'SALON ELEGANCE'], ware: 'Rasur und Haarschnitt', col: [0.05, 0.2, 0.26] },
  { k: 'cafe', w: 1.3, names: ['CAFÉ VESPER', 'KAFFEEHAUS BRANDT', 'CAFÉ LUNA', 'KONDITOREI WAGNER'], ware: 'Mokka und ein Stück Torte', col: [0.6, 0.52, 0.38] },
  { k: 'bar', w: 1.0, names: ['BAR AZUR', 'COCKTAIL-SALON', 'ZUR GOLDENEN NACHT'], ware: 'einen Gin Fizz', col: [0.06, 0.1, 0.26] },
];
export const SHOP_SAY = {
  hut: ['Der steht Ihnen ausgezeichnet. Fünf Mark, mit Hutschachtel.', 'Ein Homburg für den Herrn? Oder lieber etwas Verwegenes?'],
  buch: ['Frisch aus der Druckerei. Lesen Sie es nicht in einer Nacht, es lohnt sich.', 'Die Erstausgabe habe ich hinten im Regal, wenn Sie Zeit haben.'],
  deli: ['Der Käse kommt von den Almen über dem Tunnel. Probieren Sie!', 'Oliven, Schinken, ein Glas Wein dazu? Ich packe es Ihnen ein.'],
  tabak: ['Handgerollt, aus der Kiste von heute Morgen.', 'Die Abendausgabe ist gerade gekommen. Der Belmont-Ball ist auf Seite eins.'],
  uhren: ['Schweizer Werk, geht auf die Sekunde. Auch um Mitternacht.', 'Für die Dame vielleicht die kleine Brosche mit Türkis?'],
  blumen: ['Weiße Rosen, heute Nacht frisch aus dem Gewächshaus.', 'Für den Ballsaal nehmen die Herrschaften meist Lilien.'],
  apotheke: ['Dreimal täglich, und nicht mit Champagner einnehmen.', 'Kölnisch Wasser, das Beste gegen die Tanznacht danach.'],
  mode: ['Seide aus Lyon, geschnitten nach dem neuesten Pariser Heft.', 'Dazu die langen Handschuhe, dann ist das Ensemble vollkommen.'],
  platten: ['Hören Sie, das Orchester vom Brass Lantern! Gestern aufgenommen.', 'Der Foxtrott läuft in jedem Salon der Stadt. Zwei Mark fünfzig.'],
  spiel: ['Aufziehen, loslassen, und sie fährt bis zur Tür.', 'Zinnsoldaten, handbemalt. Die Kinder lieben die Luftschiffer.'],
  schneider: ['Zweireiher, schmale Schulter. In einer Woche sitzt er wie angegossen.', 'Den Stoff habe ich extra aus dem Hafen holen lassen.'],
  friseur: ['Nehmen Sie Platz, heißes Tuch, dann die Klinge.', 'Pomade? Heute Abend will doch jeder glänzen.'],
  cafe: ['Ein Mokka, dazu Schwarzwälder. Setzen Sie sich ans Fenster.', 'Der Kaffee kommt direkt vom Luftschiffhafen, noch warm geröstet.'],
  bar: ['Gin Fizz, kalt wie der Gletscher. Wohl bekomm’s.', 'Die Band kommt um elf. Bis dahin: noch einen?'],
};
export const SHOP_NAMES_USED = new Set();
// Ladenschild: Messingschrift auf dunklem Grund, Schriftgröße passt sich der Länge an
export function shopSign(text, w, h) {
  const t = canvasTex(1024, 160, (g, W, H) => {
    g.fillStyle = '#1a1410'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c9a258'; g.lineWidth = 6; g.strokeRect(10, 10, W - 20, H - 20);
    let fs = 96; g.font = `${fs}px Limelight, Georgia, serif`;
    while (g.measureText(text).width > W - 70 && fs > 30) { fs -= 4; g.font = `${fs}px Limelight, Georgia, serif`; }
    g.fillStyle = '#f0cf86'; g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 6; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 4);
  });
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, color: new T.Color(1.25, 1.25, 1.25) }));
}
// Welche Bauten einen begehbaren Laden bekommen: nah am Zentrum, breit genug, mit Straßenseite
export function wantShop(dist, w, d, edges, worker, H, rr) {
  if (worker || SHOPS.length >= SHOP_MAX || dist > (MOBILE ? 420 : 560) || H < 20) return false;
  if (Math.min(w, d) < 13) return false;
  if (!Object.values(edges).some(v => v)) return false;
  return rr() < (MOBILE ? 0.1 : 0.16);
}
// Bausätze je Stadtviertel (500-m-Zellen): wenige Meshes, aber in der Ferne abschaltbar
export const SHOP_CELL = 500;
export const SHOP_KITS = {};
export let SK = null;
export function shopKit(x = 0, z = 0) {
  const cx = Math.floor(x / SHOP_CELL), cz = Math.floor(z / SHOP_CELL), key = chunkKey(cx, cz);
  return (SHOP_KITS[key] ||= { K: kit(), cx, cz, x: (cx + 0.5) * SHOP_CELL, z: (cz + 0.5) * SHOP_CELL, g: null }).K;
}
export const shopRR = mulberry32(19260);
export function shopFloor(cx, cz, w, d, edges, tint, seed, rr) {
  const K = shopKit(cx, cz); shopFillInit(K, shopRR);
  const y0 = 0.2, TOP = 5.3, TH = 0.6, PT = 0.3, FL = 0.3, CEIL = 4.3;
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const sides = Object.keys(edges).filter(k => edges[k]);
  const doorSide = sides[Math.floor(rr() * sides.length)];
  const o = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[doorSide], ax = o[0] !== 0;
  const L = ax ? d : w, DEPTH = Math.min(11, (ax ? w : d) - 2.5);
  // Ladenzeile entlang der Türseite: ein bis drei Läden nebeneinander, dahinter bleibt der Block massiv (mit gemalten Schaufenstern an den anderen Seiten)
  const nShops = Math.max(1, Math.min(3, Math.floor(L / 12), SHOP_MAX - SHOPS.length));
  const restD = (ax ? w : d) - DEPTH;
  addSeg({ x: cx - o[0] * DEPTH / 2, z: cz - o[1] * DEPTH / 2, w: ax ? restD : w, d: ax ? d : restD, y0, y1: TOP, tint, seed: seed + 3, style: 0, dens: 0.3, flood: 0, rib: [0, 0, 0] }, true);
  const wallSeg = (x, z, ww, dd, ya, yb, fl = 0.35) => addSeg({ x, z, w: ww, d: dd, y0: ya, y1: yb, tint, seed: seed + 7, style: 3, dens: -1, flood: fl, rib: [0, 0, 0] }, true);
  const plaster = [0.36, 0.31, 0.25].map(v => v * (0.85 + 0.3 * rr()));
  const wood = [0.55, 0.32, 0.18];
  // Weltposition aus Koordinaten entlang der Türseite (u von 0..L) und Tiefe t (0 = Außenkante, nach innen positiv)
  const W = (u, t) => ax ? { x: cx + o[0] * (w / 2 - t), z: z0 + u } : { x: x0 + u, z: cz + o[1] * (d / 2 - t) };
  for (let si = 0; si < nShops; si++) {
    const U0 = L * si / nShops, U1 = L * (si + 1) / nShops;
    const kind = pickW(rr, SHOP_KINDS.map(q => [q, q.w / (1 + 2 * (q.used || 0))])); kind.used = (kind.used || 0) + 1;
    let name = kind.names[Math.floor(rr() * kind.names.length)];
    if (SHOP_NAMES_USED.has(name)) name = kind.names.find(n => !SHOP_NAMES_USED.has(n)) || name;
    SHOP_NAMES_USED.add(name);
    // Raum: Innenmaße
    const tL = si === 0 ? TH : PT / 2, tR = si === nShops - 1 ? TH : PT / 2;   // Wanddicke links/rechts (Außenwand oder halbe Trennwand)
    const iu0 = U0 + tL, iu1 = U1 - tR, it0 = TH, it1 = DEPTH - PT;
    const cA = W((iu0 + iu1) / 2, (it0 + it1) / 2);
    const iw = ax ? it1 - it0 : iu1 - iu0, id = ax ? iu1 - iu0 : it1 - it0;
    const S = { x: cA.x, z: cA.z, w: iw + 1, d: id + 1, x0: cA.x - iw / 2, x1: cA.x + iw / 2, z0: cA.z - id / 2, z1: cA.z + id / 2, kind: kind.k, name, doorSide, tint, counter: null, merchant: null, items: [] };
    SHOPS.push(S);
    const accent = kind.col;
    // Box in Weltkoordinaten aus u0..u1 (entlang) und t0..t1 (Tiefe)
    const box = (u0, u1, t0, t1, ya, yb) => { const a = W(u0, t0), b = W(u1, t1); return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: Math.abs(b.x - a.x), d: Math.abs(b.z - a.z), ya, yb }; };
    // Innenverkleidung an einer Fläche: Holzpaneel unten, Putz oben
    const lining = (bx, ya, yb) => {
      const yA = Math.max(ya, y0), yB = Math.min(yb, CEIL); if (yB - yA < 0.02) return;
      const lin = (a2, b2, k, c) => { if (b2 - a2 < 0.02) return; K.add(k, Bx(Math.max(bx.w, 0.03), b2 - a2, Math.max(bx.d, 0.03), bx.x, (a2 + b2) / 2, bx.z, 1.4), c); };
      lin(yA, Math.min(yB, 1.1), 'inWood', wood); lin(Math.max(yA, 1.1), yB, 'lit', plaster);
      if (yA < 1.1 && yB > 1.14) K.add('gold', Bx(Math.max(bx.w, 0.03) + 0.02, 0.04, Math.max(bx.d, 0.03) + 0.02, bx.x, 1.12, bx.z, 1));
    };
    // Vorderwand (Straße): Eckpfeiler, Fensterachsen, eine Achse mit Tür
    const faceLen = U1 - U0;
    const piece = (u0, u1, ya, yb) => {
      if (u1 - u0 < 0.02 || yb - ya < 0.02) return;
      const b = box(u0, u1, 0, TH, ya, yb); wallSeg(b.x, b.z, b.w, b.d, ya, yb);
      lining(box(Math.max(u0, iu0), Math.min(u1, iu1), TH - 0.04, TH + 0.01, ya, yb), ya, yb);
    };
    const cm = si === 0 ? 1.1 : 0.55, cmR = si === nShops - 1 ? 1.1 : 0.55, PIER = 0.7;
    const nb = Math.max(1, Math.round((faceLen - cm - cmR) / 4.4)), bayW = (faceLen - cm - cmR - (nb - 1) * PIER) / nb;
    const doorBay = Math.floor(nb / 2);
    piece(U0, U0 + cm, y0, TOP); piece(U1 - cmR, U1, y0, TOP);
    for (let b = 0; b < nb; b++) {
      const u0 = U0 + cm + b * (bayW + PIER), u1 = u0 + bayW;
      if (b < nb - 1) piece(u1, u1 + PIER, y0, TOP);
      if (b === doorBay) {
        const DW = Math.min(2.4, bayW - 0.8), dm = (u0 + u1) / 2, d0 = dm - DW / 2, d1 = dm + DW / 2;
        piece(u0, d0, y0, TOP); piece(d1, u1, y0, TOP); piece(d0, d1, 3.4, TOP);
        for (const [uu, ww] of [[d0 - 0.03, 0.1], [d1 + 0.03, 0.1]]) { const f = box(uu - ww / 2, uu + ww / 2, 0.05, 0.3, y0, 3.5); K.add('gold', Bx(f.w, 3.5 - y0, f.d, f.x, (y0 + 3.5) / 2, f.z, 1)); }
        const lt = box(d0, d1, 0.05, 0.3, 3.3, 3.42); K.add('gold', Bx(lt.w, 0.12, lt.d, lt.x, 3.36, lt.z, 1));
        const fan = box(d0 + 0.08, d1 - 0.08, 0.12, 0.14, 2.75, 3.3); K.add('glass', Bx(fan.w, 0.55, fan.d, fan.x, 3.02, fan.z, 1));
        K.add('lit', Bx(fan.w * 0.96, 0.5, Math.max(0.01, fan.d), fan.x, 3.02, fan.z, 1), [1.1, 0.72, 0.36]);
        // Türflügel um 105° nach innen geöffnet, Glasfeld, Messingknauf
        const hg = W(d0 + 0.03, TH / 2);
        const alongW = ax ? [0, 1] : [1, 0], inw = [-o[0], -o[1]], ca = Math.cos(1.83), sa = Math.sin(1.83);
        const dir = [alongW[0] * ca + inw[0] * sa, alongW[1] * ca + inw[1] * sa], th = Math.atan2(-dir[1], dir[0]);
        K.add('varnish', Bx(DW - 1.28, 2.7, 0.06, (DW - 1.28) / 2, y0 + 1.37, 0, 1).rotateY(th).translate(hg.x, 0, hg.z), [0.5, 0.26, 0.14]);
        K.add('glass', new T.PlaneGeometry(0.6, 1.1).translate((DW - 1.28) / 2, y0 + 1.75, 0.035).rotateY(th).translate(hg.x, 0, hg.z));
        K.add('gold', Bx(DW - 1.7, 0.04, 0.08, (DW - 1.28) / 2, y0 + 1.2, 0, 1).rotateY(th).translate(hg.x, 0, hg.z)); K.add('gold', Bx(DW - 1.7, 0.04, 0.08, (DW - 1.28) / 2, y0 + 2.31, 0, 1).rotateY(th).translate(hg.x, 0, hg.z));
        K.add('gold', new T.SphereGeometry(0.035, 8, 6).translate(DW - 1.4, y0 + 1.1, 0.06).rotateY(th).translate(hg.x, 0, hg.z));
        const mat = box(d0 + 0.2, d1 - 0.2, TH + 0.1, TH + 1.1, FL, FL + 0.02); K.add('carpet', Bx(mat.w, 0.02, mat.d, mat.x, FL + 0.01, mat.z, 1), [0.3, 0.08, 0.08]);
        const st = box(d0 - 0.3, d1 + 0.3, -0.5, 0.0, y0 - 0.04, y0 + 0.1); K.add('stone', Bx(st.w, 0.14, st.d, st.x, y0 + 0.03, st.z, 2), [0.6, 0.58, 0.55]);
        const dp = W(dm, -0.3);
        S.door = { x: dp.x, z: dp.z, nx: o[0], nz: o[1], ux: ax ? 0 : 1, uz: ax ? 1 : 0 };
        DOORS.push({ x: dp.x, z: dp.z, nx: o[0], nz: o[1], kind: kind.k === 'cafe' ? 'cafe' : kind.k === 'bar' ? 'bar' : 'shop' });
        for (const uu of [d0 - 0.45, d1 + 0.45]) { const l = box(uu - 0.1, uu + 0.1, -0.3, -0.05, 2.9, 3.25); K.add('gold', Bx(l.w, 0.35, l.d, l.x, 3.07, l.z, 1)); K.add('lit', Bx(l.w * 0.6, 0.2, l.d * 0.6, l.x, 3.05, l.z, 1), [1.6, 1.1, 0.6]); addGlow(l.x + o[0] * 0.2, 3.0, l.z + o[1] * 0.2, [1.35, 0.95, 0.55], 0.9); }
        // Schild über der Tür
        const sg = shopSign(name, Math.min(bayW + 1.6, 7.5), 0.7);
        const sp = W(dm, -0.05); sg.position.set(sp.x, 4.25, sp.z); sg.rotation.y = Math.atan2(o[0], o[1]); scene.add(sg);
        addNeon(sp.x, 4.6, sp.z, ax ? 0.05 : bayW + 0.5, 0.04, ax ? bayW + 0.5 : 0.05, NEON.gold);
        continue;
      }
      // Schaufenster: Brüstung, Sturz, Scheibe 25 cm hinter der Fassade, Messingrahmen, Auslage dahinter, Markise
      const SILL = 0.95, HEAD = 3.9;
      piece(u0, u1, y0, SILL); piece(u0, u1, HEAD, TOP);
      const gl = W((u0 + u1) / 2, 0.25);
      K.add('glass', new T.PlaneGeometry(bayW, HEAD - SILL).rotateY(ax ? Math.PI / 2 : 0).translate(gl.x, (SILL + HEAD) / 2, gl.z));
      for (const [uu, ww] of [[u0 + 0.03, 0.06], [u1 - 0.03, 0.06], [(u0 + u1) / 2, 0.05]]) { const f = box(uu - ww / 2, uu + ww / 2, 0.2, 0.3, SILL, HEAD); K.add('gold', Bx(f.w, HEAD - SILL, f.d, f.x, (SILL + HEAD) / 2, f.z, 1)); }
      for (const yy of [SILL + 0.03, HEAD - 0.03, 3.25]) { const f = box(u0, u1, 0.2, 0.3, yy - 0.03, yy + 0.03); K.add('gold', Bx(f.w, 0.06, f.d, f.x, yy, f.z, 1)); }
      // Laibungen innen (Seiten und Sturz der Öffnung) aus hellem Stein
      for (const [uu, ww] of [[u0 - 0.02, 0.04], [u1 + 0.02, 0.04]]) { const f = box(uu - ww / 2, uu + ww / 2, 0.0, TH, SILL, HEAD); K.add('stone', Bx(f.w, HEAD - SILL, f.d, f.x, (SILL + HEAD) / 2, f.z, 1), [0.7, 0.68, 0.64]); }
      const pd = box(u0 + 0.1, u1 - 0.1, 0.32, TH + 0.7, SILL - 0.3, SILL + 0.02);
      K.add('inWood', Bx(pd.w, SILL + 0.02 - FL, pd.d, pd.x, (FL + SILL + 0.02) / 2, pd.z, 1), [0.6, 0.38, 0.22]);
      addCollider(pd.x - pd.w / 2, FL, pd.z - pd.d / 2, pd.x + pd.w / 2, SILL + 0.02, pd.z + pd.d / 2);
      S.items.push({ x: pd.x, z: pd.z, y: SILL + 0.02, w: pd.w, d: pd.d, ax, o, display: true });
      const aw = W((u0 + u1) / 2, -0.66);
      const awg = new T.BoxGeometry(ax ? 1.28 : bayW + 0.2, 0.04, ax ? bayW + 0.2 : 1.28);
      if (ax) awg.rotateZ(o[0] * -0.32); else awg.rotateX(o[1] * 0.32);
      awg.translate(aw.x, HEAD - 0.2, aw.z);
      K.add('cloth', wuv(awg, 1), accent.map(v => v * 1.6));
      const vf = W((u0 + u1) / 2, -1.29);
      K.add('cloth', Bx(ax ? 0.03 : bayW + 0.2, 0.22, ax ? bayW + 0.2 : 0.03, vf.x, HEAD - 0.52, vf.z, 1), accent.map(v => v * 1.3));
      // Schaufensterbummler: stehen vor der Scheibe und schauen auf die Auslage
      if (rr() < (MOBILE ? 0.15 : 0.32)) {
        const n = rr() < 0.4 ? 2 : 1;
        for (let i = 0; i < n; i++) { const du = (i - (n - 1) / 2) * 0.7 + (rr() - 0.5) * 0.4; const q = W((u0 + u1) / 2 + du, -1.0 - rr() * 0.4); VENUE_PEDS.push({ st: 4, x: q.x, y: 0.22, z: q.z, yaw: Math.atan2(-o[0], -o[1]) + (rr() - 0.5) * 0.3, sc: 0.93 + rr() * 0.12, v: 0, kind: pickW(rr, [['lady', 1.2], ['dress', 1], ['suit', 1], ['coat', 0.8]]), act: 31.1 + rr() * 0.3 }); }
      }
      // Leuchtröhre unter der Markise beleuchtet die Auslage
      addGlow(gl.x - o[0] * 0.3, HEAD - 0.4, gl.z - o[1] * 0.3, [1.3, 0.95, 0.6], 0.7);
    }
    // Seitenwände: Außenwand (fensterlos, massiv) oder Trennwand zum Nachbarladen (nur von links her gesetzt)
    for (const [side, uA, uB, isOuter] of [['L', U0, U0 + TH, si === 0], ['R', U1 - TH, U1, si === nShops - 1]]) {
      if (isOuter) { const b = box(uA, uB, TH, DEPTH, y0, TOP); wallSeg(b.x, b.z, b.w, b.d, y0, TOP); lining(box(side === 'L' ? uB : uA - 0.01, side === 'L' ? uB + 0.05 : uA + 0.04, TH, it1, y0, CEIL), y0, CEIL); }
      else if (side === 'R') { const b = box(U1 - PT / 2, U1 + PT / 2, TH, DEPTH, y0, TOP); wallSeg(b.x, b.z, b.w, b.d, y0, TOP); lining(box(U1 - PT / 2 - 0.05, U1 - PT / 2, TH, it1, y0, CEIL), y0, CEIL); }
      else lining(box(U0 + PT / 2, U0 + PT / 2 + 0.05, TH, it1, y0, CEIL), y0, CEIL);
    }
    // Rückwand (vor dem massiven Rest)
    lining(box(iu0, iu1, it1, it1 + 0.05, y0, CEIL), y0, CEIL);
    // Boden, Decke, Lampen
    const tiles = kind.k === 'deli' || kind.k === 'apotheke' || kind.k === 'friseur' || kind.k === 'blumen';
    const fb = box(iu0, iu1, it0, it1, y0, FL);
    K.add(tiles ? 'tile' : 'parquet', Bx(fb.w, FL - y0 + 0.02, fb.d, fb.x, (y0 + FL) / 2, fb.z, tiles ? 1.6 : 2.2), tiles ? [0.92, 0.9, 0.86] : [0.95, 0.8, 0.66]);
    addCollider(fb.x - fb.w / 2, 0, fb.z - fb.d / 2, fb.x + fb.w / 2, FL, fb.z + fb.d / 2);
    const ceilC = [0.2, 0.17, 0.13].map(v => v * (0.9 + 0.2 * rr()));
    K.add('lit', Bx(fb.w, 0.1, fb.d, fb.x, CEIL + 0.05, fb.z), ceilC);
    K.add('gold', Bx(fb.w - 0.2, 0.04, fb.d - 0.2, fb.x, CEIL - 0.01, fb.z, 1));
    K.add('lit', Bx(fb.w - 0.5, 0.05, fb.d - 0.5, fb.x, CEIL - 0.03, fb.z), ceilC.map(v => v * 1.1));
    for (let u = -fb.w / 2 + 1.6; u < fb.w / 2 - 0.8; u += 1.6) K.add('gold', Bx(0.05, 0.03, fb.d - 0.6, fb.x + u, CEIL - 0.06, fb.z, 1));
    for (let u = -fb.d / 2 + 1.6; u < fb.d / 2 - 0.8; u += 1.6) K.add('gold', Bx(fb.w - 0.6, 0.03, 0.05, fb.x, CEIL - 0.06, fb.z + u, 1));
    const nl = Math.max(2, Math.round(Math.max(fb.w, fb.d) / 3.6));
    for (let k = 0; k < nl; k++) {
      const t = (k + 0.5) / nl, lx = fb.w > fb.d ? fb.x - fb.w / 2 + fb.w * t : fb.x, lz = fb.w > fb.d ? fb.z : fb.z - fb.d / 2 + fb.d * t;
      K.add('iron', new T.CylinderGeometry(0.012, 0.012, 0.7, 5).translate(lx, CEIL - 0.35, lz));
      K.add('gold', lathe([[0.02, 0], [0.26, 0.02], [0.3, 0.1], [0.12, 0.3]], 16).translate(lx, CEIL - 0.95, lz));
      K.add('lit', new T.SphereGeometry(0.11, 12, 8).translate(lx, CEIL - 0.98, lz), [1.7, 1.25, 0.75]);
      addGlow(lx, CEIL - 1.0, lz, [1.3, 0.9, 0.5], 1.7);
    }
    addLight(0xffb878, 1.6, Math.max(fb.w, fb.d) * 0.9 + 2, 1.6, fb.x, CEIL - 1.2, fb.z);
    // Einrichtung: Theke vor der Rückwand, Regale, Händler, Kundschaft
    const bo = [-o[0], -o[1]];
    const bc = W((iu0 + iu1) / 2, it1);
    const edgesR = { n: false, s: false, w: false, e: false }; edgesR[doorSide] = true;
    shopInterior(K, S, kind, { cx: fb.x, cz: fb.z, iw: fb.w, id: fb.d, bx: bc.x, bz: bc.z, bo, ax, L: iu1 - iu0, FL, CEIL, TH, wood, accent, rr, edges: edgesR, back: { n: 's', s: 'n', w: 'e', e: 'w' }[doorSide] });
  }
}
// Einrichtung je Ladenart
// V23: Größe der echten Waren (größte Ausdehnung in Metern), Kenney Food Kit
export const GOODS_H = { 'wine-red': 0.31, 'wine-white': 0.31, bottle: 0.27, 'bottle-large': 0.33, 'soda-bottle': 0.24, cake: 0.27, pie: 0.25, cupcake: 0.085, muffin: 0.09, croissant: 0.15, cheese: 0.26, 'whole-ham': 0.36, bread: 0.26, loaf: 0.24, 'loaf-baguette': 0.52, apple: 0.08, orange: 0.085, pear: 0.095, cocktail: 0.15, 'glass-wine': 0.17, 'cup-saucer': 0.14 };
export const ware = (m, x, y, z, rr, yaw = rr() * 6.283) => goodsAt(m, x, y, z, yaw, GOODS_H[m] * (0.92 + rr() * 0.16));
export function shopInterior(K, S, kind, g) {
  const { cx, cz, iw, id, bx, bz, bo, ax, L, FL, CEIL, TH, wood, accent, rr, edges, back } = g;
  // Punkt im Laden: a entlang der Rückwand (−L/2..L/2), n Abstand von der Rückwand nach innen
  const P = (a, n) => ({ x: bx - bo[0] * n + (ax ? 0 : a), z: bz - bo[1] * n + (ax ? a : 0) });
  const yawIn = Math.atan2(-bo[0], -bo[1]);     // Blick von der Rückwand zur Tür
  const alongA = ax ? [0, 1] : [1, 0];           // Richtung von a in Weltkoordinaten
  const rot = ax ? Math.PI / 2 : 0;
  const k = kind.k;
  const colBox = (x, z, w, d, y0, y1) => addCollider(x - w / 2, y0, z - d / 2, x + w / 2, y1, z + d / 2);
  // Rückwandregal über die ganze Breite (außer Bar/Café/Friseur, die eigene Wände haben)
  const shelfWall = (depth = 0.38, rows = [1.25, 1.75, 2.25, 2.75], aMin = -L / 2 + 0.3, aMax = L / 2 - 0.3) => {
    const len = aMax - aMin, am = (aMin + aMax) / 2, pm = P(am, depth / 2);
    K.add('inWood', Bx(ax ? depth : len, 3.1 - FL, ax ? len : depth, pm.x, (FL + 3.1) / 2, pm.z, 1), wood.map(v => v * 0.9));
    for (const y of rows) K.add('varnish', Bx(ax ? depth + 0.04 : len, 0.035, ax ? len : depth + 0.04, pm.x - bo[0] * 0.02, y, pm.z - bo[1] * 0.02, 1), wood);
    K.add('gold', Bx(ax ? 0.03 : len, 0.05, ax ? len : 0.03, pm.x - bo[0] * depth / 2, 3.12, pm.z - bo[1] * depth / 2, 1));
    colBox(pm.x, pm.z, ax ? depth : len, ax ? len : depth, FL, 3.1);
    return { rows, depth, aMin, aMax };
  };
  // Theke parallel zur Rückwand, Abstand n von der Rückwand
  const counter = (n = 1.6, len = Math.min(L - 2.4, 6.5), top = 'stone', topC = [0.9, 0.88, 0.84]) => {
    const pm = P(0, n);
    K.add('inWood', Bx(ax ? 0.7 : len, 0.95, ax ? len : 0.7, pm.x, FL + 0.475, pm.z, 1), wood.map(v => v * 0.9));
    // Art-Déco-Front: vertikale Messingstäbe
    for (let a = -len / 2 + 0.3; a < len / 2 - 0.2; a += 0.6) { const q = P(a, n - 0.36); K.add('gold', Bx(0.03, 0.8, 0.03, q.x, FL + 0.5, q.z, 1)); }
    K.add(top, Bx(ax ? 0.84 : len + 0.1, 0.06, ax ? len + 0.1 : 0.84, pm.x, FL + 0.98, pm.z, 1), topC);
    K.add('gold', Bx(ax ? 0.02 : len + 0.1, 0.03, ax ? len + 0.1 : 0.02, pm.x - bo[0] * 0.42, FL + 1.0, pm.z - bo[1] * 0.42, 1));
    colBox(pm.x, pm.z, ax ? 0.7 : len, ax ? len : 0.7, FL, FL + 1.0);
    S.counter = { x: pm.x, z: pm.z, len, n, top: FL + 1.01 };
    // Kasse aus Messing
    const kq = P(len / 2 - 0.5, n);
    K.add('gold', Bx(0.32, 0.26, 0.3, kq.x, FL + 1.14, kq.z, 1)); K.add('iron', Bx(0.3, 0.1, 0.28, kq.x, FL + 1.32, kq.z, 1)); K.add('lit', Bx(0.22, 0.06, 0.02, kq.x - bo[0] * 0.15, FL + 1.34, kq.z - bo[1] * 0.15, 1), [1.4, 1.2, 0.8]);
    return S.counter;
  };
  // Händler hinter der Theke, Blick zur Tür
  const merchant = (kindP, col, act, a = -0.4) => {
    const c = S.counter, q = P(a, c ? c.n - 0.75 : 0.9);
    const m = { st: 4, x: q.x, y: FL, z: q.z, yaw: yawIn, sc: 0.95 + rr() * 0.1, v: 0, kind: kindP, col, act, shop: S };
    VENUE_PEDS.push(m); S.merchant = m; return m;
  };
  const customer = (a, n, yaw, kindP, act = 28 + rr() * 0.9) => { const q = P(a, n); const m = { st: 4, x: q.x, y: FL, z: q.z, yaw, sc: 0.93 + rr() * 0.12, v: 0, kind: kindP, act }; VENUE_PEDS.push(m); return m; };
  const fem = rr() < 0.5;
  // Waren auf einem Regalbrett: Callback je Position
  const onShelf = (sw, fn, step = 0.3, nAll = sw.rows) => { for (const y of nAll) for (let a = sw.aMin + 0.2; a < sw.aMax - 0.15; a += step * (MOBILE ? 1.8 : 1)) { const q = P(a, sw.depth - 0.16); fn(q.x, y + 0.02, q.z, a, y); } };
  // kleine Modelle
  const hat = (x, y, z, c) => { K.add('cloth', lathe([[0, 0], [0.19, 0], [0.19, 0.008], [0.105, 0.012], [0.1, 0.13], [0.08, 0.145], [0, 0.15]], 9).translate(x, y, z), c); K.add('cloth', new T.TorusGeometry(0.102, 0.012, 4, 9).rotateX(Math.PI / 2).translate(x, y + 0.03, z), [0.08, 0.07, 0.07]); };
  const bottle = (x, y, z, c, h = 0.26, r = 0.035) => K.add('lit', lathe([[r, 0], [r, h * 0.62], [r * 0.4, h * 0.78], [r * 0.38, h]], 6).translate(x, y, z), c.map(v => v * 0.55));
  const jar = (x, y, z, c, h = 0.2, r = 0.06) => { K.add('lit', lathe([[r, 0], [r, h * 0.85], [r * 0.8, h]], 7).translate(x, y, z), c.map(v => v * 0.5)); K.add('gold', new T.CylinderGeometry(r * 0.85, r * 0.85, 0.02, 10).translate(x, y + h, z)); };
  const book = (x, y, z, c, h = 0.24, wdt = 0.04) => K.add('leather', Bx(ax ? 0.17 : wdt, h, ax ? wdt : 0.17, x, y + h / 2, z, 1), c);
  const box3 = (x, y, z, w, h, d, c, mat = 'cloth') => K.add(mat, Bx(ax ? d : w, h, ax ? w : d, x, y + h / 2, z, 1), c);
  const bloom = (x, y, z, c) => { K.add('cloth', new T.CylinderGeometry(0.006, 0.006, 0.4, 4).translate(x, y + 0.2, z), [0.15, 0.35, 0.15]); K.add('lit', new T.SphereGeometry(0.045 + rr() * 0.02, 7, 5).scale(1, 0.75, 1).translate(x, y + 0.42, z), c.map(v => v * 0.7)); };
  const mannequin = (x, z, dress, yaw, hatC = null) => {
    K.add('iron', new T.CylinderGeometry(0.22, 0.26, 0.03, 12).translate(x, FL + 0.015, z)); K.add('iron', new T.CylinderGeometry(0.015, 0.015, 0.75, 6).translate(x, FL + 0.4, z));
    K.add('cloth', lathe([[0.02, 0], [0.19, 0.08], [0.16, 0.5], [0.19, 0.78], [0.14, 0.9], [0.0, 0.92]], 14).translate(x, FL + 0.75, z), dress);
    if (dress[3] !== 'suit') K.add('cloth', lathe([[0.1, 0], [0.42, 0.02], [0.2, 0.75]], 14).translate(x, FL + 0.05, z), dress);
    K.add('cloth', new T.SphereGeometry(0.11, 10, 8).scale(0.85, 1.1, 0.9).translate(x, FL + 1.82, z), [0.85, 0.78, 0.7]);
    if (hatC) hat(x, FL + 1.9, z, hatC);
    colBox(x, z, 0.5, 0.5, FL, FL + 1.9);
  };
  const tableSet = (x, z, cloth = false, guests = true) => {
    const FM = { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth' };
    const fadd = (kk, gg) => K.add(kk, gg, kk === 'leather' ? accent : kk === 'lit' ? [1.6, 1.05, 0.55] : kk === 'cloth' ? [0.94, 0.92, 0.86] : [1, 1, 1]);
    placeFurn(FURN.roundTable(0.4, 0.74, cloth), FM, fadd, x, FL, z); colBox(x, z, 0.6, 0.6, FL, FL + 0.76);
    K.add('lit', new T.SphereGeometry(0.012, 6, 4).scale(1, 1.8, 1).translate(x, FL + 0.86, z), [1.8, 1.2, 0.5]); K.add('cloth', new T.CylinderGeometry(0.016, 0.016, 0.09, 6).translate(x, FL + 0.8, z), [0.95, 0.92, 0.85]);
    const seats = [];
    for (const s of [-1, 1]) { const a = s * Math.PI / 2 + rot; const sx = x + Math.sin(a) * 0.72, sz = z + Math.cos(a) * 0.72; placeFurn(FURN.bistroChair(), FM, fadd, sx, FL, sz, a + Math.PI); seats.push({ x: sx, z: sz, yaw: a + Math.PI }); }
    for (const s of seats) if (rr() < 0.75) { const tx = x + (s.x - x) * 0.42, tz = z + (s.z - z) * 0.42; ware(cloth ? 'cup-saucer' : pc(['cocktail', 'glass-wine']), tx, FL + 0.76, tz, rr); }
    if (cloth && rr() < 0.5) ware(pc(['cake', 'pie', 'croissant']), x + alongA[1] * 0.14, FL + 0.76, z + alongA[0] * 0.14, rr);
    if (guests) for (const s of seats) if (rr() < 0.6) VENUE_PEDS.push({ st: 4, x: s.x, y: FL + 0.5, z: s.z, yaw: s.yaw, sc: 0.93 + rr() * 0.12, v: 0, sit: true, kind: pickW(rr, [['suit', 1], ['lady', 1], ['dress', 1], ['coat', 0.6]]), act: pickW(rr, [[7.8, 1], [11.4, 1], [10.4, 0.6]]) });
  };
  const GOODS = [[0.75, 0.5, 0.3], [0.3, 0.6, 0.6], [0.8, 0.25, 0.25], [0.9, 0.8, 0.5], [0.25, 0.3, 0.6], [0.4, 0.6, 0.3]];
  const pc = arr => arr[Math.floor(rr() * arr.length)];
  if (k === 'hut') {
    const sw = shelfWall(0.4, [1.2, 1.7, 2.2, 2.7]);
    onShelf(sw, (x, y, z) => hat(x, y, z, pc([[0.08, 0.07, 0.07], [0.3, 0.2, 0.12], [0.5, 0.45, 0.4], [0.2, 0.1, 0.1], [0.12, 0.14, 0.2], [0.7, 0.62, 0.5]])), 0.46);
    counter(1.7, Math.min(L - 2.6, 5));
    // Hutständer und Spiegel im Raum
    for (const a of [-L / 2 + 1.0, L / 2 - 1.0]) { const q = P(a, 3.4); K.add('iron', new T.CylinderGeometry(0.015, 0.015, 1.7, 6).translate(q.x, FL + 0.85, q.z)); K.add('iron', new T.CylinderGeometry(0.2, 0.22, 0.02, 10).translate(q.x, FL + 0.01, q.z)); for (let i = 0; i < 3; i++) { const an = i * 2.1; hat(q.x + Math.cos(an) * 0.08, FL + 1.3 + i * 0.2, q.z + Math.sin(an) * 0.08, pc([[0.08, 0.07, 0.07], [0.35, 0.22, 0.12], [0.6, 0.55, 0.5]])); } colBox(q.x, q.z, 0.5, 0.5, FL, FL + 1.8); }
    merchant(fem ? 'lady' : 'suit', fem ? pick(DRESSES) : [0.12, 0.1, 0.12], 29.3);
    customer(1.2, 3.0, yawIn + Math.PI, 'dress', 28.4);
    for (const it of S.items) for (let i = 0; i < 3; i++) hat(it.x + (it.ax ? 0 : (i - 1) * it.w * 0.3), it.y, it.z + (it.ax ? (i - 1) * it.d * 0.3 : 0), pc([[0.08, 0.07, 0.07], [0.3, 0.2, 0.12], [0.6, 0.12, 0.14]]));
  } else if (k === 'buch') {
    const sw = shelfWall(0.34, [0.6, 0.95, 1.3, 1.65, 2.0, 2.35, 2.7]);
    onShelf(sw, (x, y, z) => { if (rr() < 0.08) return; book(x, y, z, pc([[0.4, 0.1, 0.08], [0.1, 0.22, 0.14], [0.12, 0.14, 0.3], [0.5, 0.4, 0.25], [0.2, 0.08, 0.1], [0.6, 0.55, 0.45]]), 0.2 + rr() * 0.1, 0.03 + rr() * 0.03); }, 0.062);
    counter(1.5, Math.min(L - 2.6, 4.5), 'varnish', wood);
    // Lesetisch mit Lampe und Stapeln
    const q = P(0, 3.6); K.add('varnish', Bx(ax ? 0.9 : 1.6, 0.05, ax ? 1.6 : 0.9, q.x, FL + 0.76, q.z, 1), wood); for (const s of [-1, 1]) for (const t of [-1, 1]) K.add('varnish', Bx(0.06, 0.74, 0.06, q.x + (ax ? s * 0.38 : s * 0.72), FL + 0.37, q.z + (ax ? t * 0.72 : t * 0.38), 1), wood); colBox(q.x, q.z, ax ? 0.9 : 1.6, ax ? 1.6 : 0.9, FL, FL + 0.8);
    for (let i = 0; i < 5; i++) K.add('leather', Bx(0.2, 0.04, 0.28, q.x + (i - 2) * 0.26 * (ax ? 0 : 1), FL + 0.8 + (i % 2) * 0.04, q.z + (i - 2) * 0.26 * (ax ? 1 : 0), 1), pc(GOODS));
    K.add('gold', new T.CylinderGeometry(0.012, 0.012, 0.4, 6).translate(q.x, FL + 1.0, q.z)); K.add('lit', lathe([[0.02, 0], [0.16, 0.0], [0.1, 0.14]], 10).translate(q.x, FL + 1.18, q.z), [0.3, 0.9, 0.45]); addGlow(q.x, FL + 1.15, q.z, [0.4, 1.0, 0.5], 0.5);
    merchant('suit', [0.2, 0.18, 0.16], 29.1);
    customer(-L / 2 + 0.9, 1.0, Math.atan2(bo[0], bo[1]) + (ax ? 0 : 0), 'coat', 28.2);
    for (const it of S.items) for (let i = 0; i < 6; i++) book(it.x + (it.ax ? (i % 2) * 0.25 - 0.1 : (i - 2.5) * 0.3), it.y, it.z + (it.ax ? (i - 2.5) * 0.3 : (i % 2) * 0.25 - 0.1), pc(GOODS), 0.26, 0.05);
  } else if (k === 'deli') {
    const sw = shelfWall(0.4, [1.3, 1.75, 2.2, 2.65]);
    onShelf(sw, (x, y, z, a, yy) => { const r = rr(); if (r < 0.14) ware('cheese', x, y, z, rr); else if (r < 0.24) ware(pc(['bread', 'loaf']), x, y, z, rr); else if (r < 0.36) ware(pc(['wine-red', 'wine-white', 'bottle']), x, y, z, rr); else if (r < 0.42) for (let i = 0; i < 3; i++) ware(pc(['apple', 'orange', 'pear']), x + (i - 1) * 0.06 * alongA[0], y, z + (i - 1) * 0.06 * alongA[1], rr); else if (r < 0.6) jar(x, y, z, pc([[1.0, 0.7, 0.2], [0.8, 0.3, 0.2], [0.4, 0.7, 0.3], [0.9, 0.5, 0.1]]), 0.14 + rr() * 0.1, 0.045); else if (r < 0.7) bottle(x, y, z, pc([[0.6, 0.9, 0.4], [0.9, 0.3, 0.3], [1.0, 0.8, 0.4]])); else box3(x, y, z, 0.16, 0.1, 0.12, pc([[0.85, 0.75, 0.5], [0.3, 0.5, 0.6], [0.7, 0.3, 0.25]])); }, 0.19);
    counter(1.7, Math.min(L - 2.6, 6.5), 'stone', [0.92, 0.9, 0.86]);
    // Glasvitrine mit Käse und Wurst auf der Theke
    const c = S.counter; K.add('glass', Bx(ax ? 0.6 : c.len * 0.6, 0.45, ax ? c.len * 0.6 : 0.6, c.x, c.top + 0.23, c.z, 1));
    for (let a = -c.len * 0.28; a < c.len * 0.28; a += 0.36) { const q = P(a, c.n); ware(rr() < 0.55 ? 'cheese' : 'whole-ham', q.x, c.top + 0.01, q.z, rr); }
    // Brot und Baguettes im Korb am Thekenende
    { const q = P(-c.len / 2 + 0.45, c.n); K.add('varnish', lathe([[0.2, 0], [0.24, 0.12]], 12).translate(q.x, c.top, q.z), [0.55, 0.36, 0.18]); for (let i = 0; i < 3; i++) ware(pc(['loaf-baguette', 'bread', 'loaf']), q.x + (rr() - 0.5) * 0.12, c.top + 0.05, q.z + (rr() - 0.5) * 0.12, rr); }
    // Hängende Würste und Schinken an einer Stange über der Theke
    const rail = P(0, c.n); K.add('gold', new T.CylinderGeometry(0.015, 0.015, c.len * 0.8, 6).rotateZ(ax ? 0 : Math.PI / 2).rotateY(ax ? 0 : 0).rotateX(ax ? Math.PI / 2 : 0).translate(rail.x, FL + 2.5, rail.z));
    for (let a = -c.len * 0.38; a < c.len * 0.38; a += 0.25) { const q = P(a, c.n); const h = 0.3 + rr() * 0.3; K.add('leather', new T.CylinderGeometry(0.03, 0.035, h, 7).translate(q.x, FL + 2.5 - h / 2 - 0.05, q.z), pc([[0.45, 0.12, 0.08], [0.55, 0.25, 0.15], [0.35, 0.1, 0.1]])); }
    merchant('waiter', [0.92, 0.9, 0.85], 29.6);
    customer(0.8, 2.6, yawIn + Math.PI, 'lady', 28.6); customer(-1.6, 2.7, yawIn + Math.PI, 'coat', 31.2);
    for (const it of S.items) for (let i = 0; i < 5; i++) { const q = { x: it.x + (it.ax ? 0 : (i - 2) * it.w * 0.2), z: it.z + (it.ax ? (i - 2) * it.d * 0.2 : 0) }; if (i % 2) ware(pc(['wine-red', 'wine-white']), q.x, it.y, q.z, rr); else ware(i === 2 ? 'whole-ham' : 'cheese', q.x, it.y, q.z, rr); }
  } else if (k === 'tabak') {
    const sw = shelfWall(0.34, [1.1, 1.45, 1.8, 2.15, 2.5, 2.85]);
    onShelf(sw, (x, y, z) => { const r = rr(); if (r < 0.5) box3(x, y, z, 0.2, 0.07, 0.14, pc([[0.45, 0.25, 0.1], [0.6, 0.4, 0.2], [0.3, 0.15, 0.08]]), 'varnish'); else if (r < 0.8) K.add('chrome', new T.CylinderGeometry(0.05, 0.05, 0.08, 10).translate(x, y + 0.04, z)); else K.add('gold', Bx(0.1, 0.12, 0.06, x, y + 0.06, z, 1)); }, 0.24);
    counter(1.4, Math.min(L - 2.6, 4), 'varnish', wood);
    // Zeitungsständer neben der Tür, Pfeifenregal
    const q = P(L / 2 - 1.1, 3.2); for (let i = 0; i < 4; i++) K.add('cloth', Bx(ax ? 0.4 : 0.6, 0.03, ax ? 0.6 : 0.4, q.x, FL + 0.6 + i * 0.3, q.z, 1).rotateX(0), [0.85, 0.83, 0.78]); K.add('iron', Bx(ax ? 0.44 : 0.64, 1.6, ax ? 0.64 : 0.44, q.x + bo[0] * 0.2, FL + 0.8, q.z + bo[1] * 0.2, 1)); colBox(q.x, q.z, 0.7, 0.7, FL, FL + 1.6);
    merchant('worker', [0.35, 0.3, 0.26], 29.8);
    customer(0.6, 2.4, yawIn + Math.PI, 'coat', 28.7);
    for (const it of S.items) for (let i = 0; i < 4; i++) box3(it.x + (it.ax ? 0 : (i - 1.5) * 0.4), it.y, it.z + (it.ax ? (i - 1.5) * 0.4 : 0), 0.26, 0.08, 0.18, pc([[0.45, 0.25, 0.1], [0.6, 0.4, 0.2]]), 'varnish');
  } else if (k === 'uhren') {
    const sw = shelfWall(0.3, [1.4, 1.9, 2.4]);
    onShelf(sw, (x, y, z) => { K.add('gold', new T.CylinderGeometry(0.11, 0.11, 0.05, 16).rotateX(Math.PI / 2).rotateY(rot).translate(x, y + 0.14, z)); K.add('lit', new T.CylinderGeometry(0.085, 0.085, 0.052, 16).rotateX(Math.PI / 2).rotateY(rot).translate(x, y + 0.14, z), [0.95, 0.92, 0.82]); K.add('gold', Bx(0.08, 0.03, 0.08, x, y + 0.015, z, 1)); }, 0.42);
    counter(1.6, Math.min(L - 2.6, 5), 'varnish', [0.08, 0.07, 0.08]);
    const c = S.counter; K.add('glass', Bx(ax ? 0.62 : c.len * 0.8, 0.3, ax ? c.len * 0.8 : 0.62, c.x, c.top + 0.16, c.z, 1));
    for (let a = -c.len * 0.38; a < c.len * 0.38; a += 0.3) { const q = P(a, c.n); K.add('cloth', Bx(0.22, 0.04, 0.22, q.x, c.top + 0.02, q.z, 1), [0.08, 0.1, 0.3]); K.add('gold', new T.TorusGeometry(0.03, 0.006, 6, 14).translate(q.x, c.top + 0.06, q.z)); K.add('lit', new T.SphereGeometry(0.012, 6, 4).translate(q.x, c.top + 0.075, q.z), pc([[1.5, 1.5, 1.6], [0.3, 1.2, 1.2], [1.4, 0.3, 0.4]])); }
    // Standuhr
    const q = P(-L / 2 + 0.8, 0.45); K.add('varnish', Bx(0.5, 2.2, 0.32, q.x, FL + 1.1, q.z, 1), [0.3, 0.15, 0.08]); K.add('lit', new T.CylinderGeometry(0.17, 0.17, 0.02, 20).rotateX(Math.PI / 2).rotateY(rot).translate(q.x - bo[0] * 0.17, FL + 1.85, q.z - bo[1] * 0.17), [0.95, 0.9, 0.8]); K.add('gold', new T.CylinderGeometry(0.1, 0.1, 0.02, 14).rotateX(Math.PI / 2).rotateY(rot).translate(q.x - bo[0] * 0.17, FL + 0.9, q.z - bo[1] * 0.17)); colBox(q.x, q.z, 0.6, 0.6, FL, FL + 2.2);
    merchant('suit', [0.08, 0.08, 0.1], 29.4);
    customer(0.9, 2.7, yawIn + Math.PI, 'gown', 28.3);
    for (const it of S.items) { K.add('cloth', Bx(it.w * 0.7, 0.05, it.d * 0.7, it.x, it.y + 0.025, it.z, 1), [0.08, 0.1, 0.3]); for (let i = 0; i < 5; i++) { const x = it.x + (it.ax ? (rr() - 0.5) * 0.3 : (i - 2) * it.w * 0.15), z = it.z + (it.ax ? (i - 2) * it.d * 0.15 : (rr() - 0.5) * 0.3); K.add('gold', new T.CylinderGeometry(0.06, 0.06, 0.015, 14).translate(x, it.y + 0.06, z)); K.add('lit', new T.CylinderGeometry(0.045, 0.045, 0.017, 14).translate(x, it.y + 0.06, z), [0.95, 0.92, 0.82]); } }
  } else if (k === 'blumen') {
    const sw = shelfWall(0.4, [0.9, 1.6, 2.3]);
    onShelf(sw, (x, y, z) => { K.add('chrome', lathe([[0.1, 0], [0.12, 0.3]], 10).translate(x, y, z)); for (let i = 0; i < 4; i++) bloom(x + (rr() - 0.5) * 0.12, y + 0.1, z + (rr() - 0.5) * 0.12, pc([[1.4, 0.3, 0.4], [1.5, 1.4, 1.2], [1.4, 0.8, 0.2], [0.9, 0.4, 1.2], [1.4, 0.5, 0.2]])); }, 0.34);
    counter(1.8, Math.min(L - 2.6, 4), 'varnish', wood);
    // Eimer mit Sträußen am Boden, Palme
    for (let i = 0; i < 6; i++) { const q = P(-L / 2 + 0.8 + i * (L - 1.6) / 5, 3.3 + (i % 2) * 0.6); K.add('chrome', lathe([[0.16, 0], [0.19, 0.4]], 12).translate(q.x, FL, q.z)); for (let j = 0; j < 6; j++) bloom(q.x + (rr() - 0.5) * 0.2, FL + 0.25, q.z + (rr() - 0.5) * 0.2, pc([[1.4, 0.3, 0.4], [1.5, 1.4, 1.2], [1.4, 0.8, 0.2], [0.9, 0.4, 1.2]])); colBox(q.x, q.z, 0.4, 0.4, FL, FL + 0.5); }
    merchant('lady', pick(DRESSES), 29.5);
    customer(1.0, 2.8, yawIn + Math.PI, 'lady', 28.5);
    for (const it of S.items) for (let i = 0; i < 4; i++) { const x = it.x + (it.ax ? 0 : (i - 1.5) * it.w * 0.24), z = it.z + (it.ax ? (i - 1.5) * it.d * 0.24 : 0); K.add('chrome', lathe([[0.1, 0], [0.12, 0.3]], 10).translate(x, it.y, z)); for (let j = 0; j < 5; j++) bloom(x + (rr() - 0.5) * 0.12, it.y + 0.1, z + (rr() - 0.5) * 0.12, pc([[1.4, 0.3, 0.4], [1.5, 1.4, 1.2], [1.4, 0.8, 0.2]])); }
  } else if (k === 'apotheke') {
    const sw = shelfWall(0.32, [1.2, 1.55, 1.9, 2.25, 2.6, 2.95]);
    onShelf(sw, (x, y, z) => { const r = rr(); if (r < 0.55) bottle(x, y, z, pc([[0.6, 0.4, 0.2], [0.3, 0.6, 0.4], [0.5, 0.6, 0.9], [0.9, 0.85, 0.7]]), 0.18 + rr() * 0.12, 0.03 + rr() * 0.015); else if (r < 0.8) jar(x, y, z, [0.95, 0.95, 0.9], 0.16, 0.05); else box3(x, y, z, 0.1, 0.12, 0.06, [0.9, 0.9, 0.86]); }, 0.14);
    counter(1.6, Math.min(L - 2.6, 5.5), 'stone', [0.95, 0.94, 0.9]);
    const c = S.counter; const q = P(-c.len * 0.3, c.n); K.add('gold', new T.CylinderGeometry(0.012, 0.012, 0.4, 6).translate(q.x, c.top + 0.2, q.z)); K.add('gold', Bx(0.5, 0.012, 0.02, q.x, c.top + 0.4, q.z, 1).rotateY(rot)); for (const s of [-1, 1]) K.add('gold', new T.CylinderGeometry(0.08, 0.08, 0.01, 12).translate(q.x + s * 0.25 * alongA[0], c.top + 0.12, q.z + s * 0.25 * alongA[1]));
    const m = P(c.len * 0.3, c.n); K.add('stone', lathe([[0.06, 0], [0.1, 0.05], [0.13, 0.16]], 12).translate(m.x, c.top, m.z), [0.85, 0.84, 0.8]);
    merchant('waiter', [0.95, 0.94, 0.9], 29.2);
    customer(-0.5, 2.6, yawIn + Math.PI, 'coat', 31.3);
    for (const it of S.items) for (let i = 0; i < 5; i++) bottle(it.x + (it.ax ? 0 : (i - 2) * it.w * 0.2), it.y, it.z + (it.ax ? (i - 2) * it.d * 0.2 : 0), pc([[0.6, 0.4, 0.2], [0.3, 0.6, 0.4], [0.5, 0.6, 0.9]]), 0.3, 0.05);
  } else if (k === 'mode' || k === 'schneider') {
    const suit = k === 'schneider';
    // Kleiderstange an der Rückwand statt Regal
    const q = P(0, 0.45); K.add('chrome', new T.CylinderGeometry(0.015, 0.015, L - 1.2, 8).rotateZ(ax ? 0 : Math.PI / 2).rotateX(ax ? Math.PI / 2 : 0).translate(q.x, FL + 1.9, q.z));
    for (let a = -L / 2 + 0.8; a < L / 2 - 0.7; a += 0.22) { const p = P(a, 0.45); const c = suit ? pc([[0.1, 0.1, 0.12], [0.2, 0.18, 0.16], [0.14, 0.16, 0.26], [0.3, 0.26, 0.22]]) : pc(DRESSES); K.add('gold', new T.TorusGeometry(0.03, 0.004, 5, 10).rotateY(rot).translate(p.x, FL + 1.92, p.z)); K.add('cloth', Bx(ax ? 0.06 : 0.44, suit ? 0.8 : 1.3, ax ? 0.44 : 0.06, p.x, FL + 1.88 - (suit ? 0.4 : 0.65), p.z, 1), c); }
    K.add('varnish', Bx(ax ? 0.4 : L - 1.0, 0.4, ax ? L - 1.0 : 0.4, q.x, FL + 0.2, q.z, 1), wood); colBox(q.x, q.z, ax ? 0.9 : L - 1.0, ax ? L - 1.0 : 0.9, FL, FL + 2.0);
    counter(1.9, Math.min(L - 2.6, 4.5), 'varnish', wood);
    // Schneidertisch mit Stoffballen oder Puppen
    for (let i = 0; i < 3; i++) { const p = P(-L / 2 + 1.2 + i * (L - 2.4) / 2, 3.4); if (suit) mannequin(p.x, p.z, [...pc([[0.1, 0.1, 0.12], [0.2, 0.18, 0.16], [0.14, 0.16, 0.26]]), 'suit'], yawIn, [0.08, 0.07, 0.07]); else mannequin(p.x, p.z, pc(DRESSES), yawIn, i === 1 ? [0.6, 0.12, 0.14] : null); }
    if (suit) { const t = P(L / 2 - 1.3, 2.6); K.add('varnish', Bx(1.2, 0.05, 0.8, t.x, FL + 0.78, t.z, 1).rotateY(rot), wood); for (let i = 0; i < 5; i++) K.add('cloth', new T.CylinderGeometry(0.07, 0.07, 0.7, 10).rotateZ(Math.PI / 2).rotateY(rot).translate(t.x, FL + 0.87 + (i % 2) * 0.12, t.z + (i - 2) * 0.15), pc([[0.3, 0.3, 0.35], [0.5, 0.45, 0.4], [0.12, 0.14, 0.2], [0.4, 0.3, 0.2]])); K.add('iron', Bx(0.35, 0.22, 0.16, t.x, FL + 0.92, t.z - 0.3, 1)); K.add('gold', Bx(0.06, 0.3, 0.06, t.x, FL + 1.1, t.z - 0.3, 1)); colBox(t.x, t.z, 1.2, 1.2, FL, FL + 0.85); }
    // Spiegel an der Seitenwand
    const sm = P(L / 2 - 0.1, 2.5); K.add('glass', new T.PlaneGeometry(1.0, 2.0).rotateY(ax ? 0 : Math.PI / 2).translate(sm.x - alongA[0] * 0.06, FL + 1.3, sm.z - alongA[1] * 0.06)); K.add('gold', Bx(ax ? 1.1 : 0.04, 2.1, ax ? 0.04 : 1.1, sm.x - alongA[0] * 0.08, FL + 1.3, sm.z - alongA[1] * 0.08, 1));
    merchant(suit ? 'suit' : 'lady', suit ? [0.12, 0.12, 0.14] : pick(DRESSES), suit ? 29.7 : 29.3);
    customer(0.9, 3.0, yawIn + Math.PI, suit ? 'suit' : 'gown', 28.8);
    for (const it of S.items) mannequin(it.x, it.z, suit ? [0.1, 0.1, 0.12, 'suit'] : pc(DRESSES), Math.atan2(it.o[0], it.o[1]), [0.08, 0.07, 0.07]);
  } else if (k === 'platten') {
    const sw = shelfWall(0.36, [0.8, 1.25, 1.7, 2.15, 2.6]);
    onShelf(sw, (x, y, z) => { if (rr() < 0.15) return; K.add('cloth', Bx(ax ? 0.3 : 0.025, 0.3, ax ? 0.025 : 0.3, x, y + 0.16, z, 1), pc([[0.7, 0.6, 0.4], [0.3, 0.2, 0.3], [0.5, 0.15, 0.15], [0.2, 0.3, 0.4], [0.8, 0.75, 0.6]])); }, 0.04);
    counter(1.6, Math.min(L - 2.6, 5), 'varnish', wood);
    // Grammophone auf Tischen, eines spielt (Glühen am Trichter)
    for (let i = 0; i < 2; i++) { const p = P(-L / 4 + i * L / 2, 3.4); K.add('varnish', Bx(0.8, 0.05, 0.8, p.x, FL + 0.74, p.z, 1), wood); for (const s of [-1, 1]) for (const t of [-1, 1]) K.add('varnish', Bx(0.05, 0.72, 0.05, p.x + s * 0.35, FL + 0.36, p.z + t * 0.35, 1), wood); K.add('varnish', Bx(0.42, 0.18, 0.42, p.x, FL + 0.86, p.z, 1), [0.35, 0.18, 0.1]); K.add('iron', new T.CylinderGeometry(0.15, 0.15, 0.006, 20).translate(p.x, FL + 0.96, p.z)); const horn = lathe([[0.02, 0], [0.04, 0.2], [0.1, 0.4], [0.28, 0.62], [0.3, 0.64]], 16).rotateX(-0.9).rotateY(yawIn).translate(p.x - bo[0] * 0.1, FL + 1.1, p.z - bo[1] * 0.1); K.add('gold', horn); colBox(p.x, p.z, 0.9, 0.9, FL, FL + 1.6); if (i === 0) addGlow(p.x - bo[0] * 0.4, FL + 1.55, p.z - bo[1] * 0.4, [1.3, 1.0, 0.6], 0.5); }
    merchant('suit', [0.25, 0.2, 0.3], 29.9);
    customer(L / 4, 1.1, Math.atan2(bo[0], bo[1]), 'dress', 28.1);
    for (const it of S.items) for (let i = 0; i < 4; i++) { const x = it.x + (it.ax ? 0 : (i - 1.5) * 0.36), z = it.z + (it.ax ? (i - 1.5) * 0.36 : 0); K.add('iron', new T.CylinderGeometry(0.15, 0.15, 0.006, 20).rotateX(Math.PI / 2 - 0.3).rotateY(rot).translate(x, it.y + 0.15, z)); K.add('lit', new T.CylinderGeometry(0.05, 0.05, 0.008, 12).rotateX(Math.PI / 2 - 0.3).rotateY(rot).translate(x, it.y + 0.15, z), pc([[1.2, 0.4, 0.3], [0.9, 0.8, 0.3]])); }
  } else if (k === 'spiel') {
    const sw = shelfWall(0.4, [0.7, 1.2, 1.7, 2.2, 2.7]);
    onShelf(sw, (x, y, z) => { const r = rr(); if (r < 0.3) { K.add('cloth', new T.SphereGeometry(0.09, 8, 6).translate(x, y + 0.14, z), [0.45, 0.3, 0.15]); K.add('cloth', new T.SphereGeometry(0.065, 8, 6).translate(x, y + 0.29, z), [0.45, 0.3, 0.15]); } else if (r < 0.55) K.add('lit', new T.SphereGeometry(0.08, 10, 8).translate(x, y + 0.08, z), pc([[1.0, 0.3, 0.2], [0.3, 0.5, 1.0], [1.0, 0.8, 0.2]]).map(v => v * 0.6)); else if (r < 0.8) for (let i = 0; i < 3; i++) box3(x + (i - 1) * 0.07, y, z, 0.06, 0.06, 0.06, pc([[0.9, 0.2, 0.15], [0.2, 0.4, 0.9], [0.9, 0.8, 0.2], [0.2, 0.7, 0.3]]), 'paint'); else { box3(x, y, z, 0.22, 0.09, 0.09, pc([[0.7, 0.1, 0.1], [0.1, 0.3, 0.2]]), 'paint'); K.add('iron', new T.CylinderGeometry(0.03, 0.03, 0.11, 8).rotateZ(Math.PI / 2).rotateY(rot).translate(x, y + 0.03, z)); } }, 0.32);
    counter(1.6, Math.min(L - 2.6, 4.5), 'varnish', wood);
    // Schaukelpferd und Puppenhaus
    const p = P(-L / 2 + 1.3, 3.2); K.add('varnish', Bx(0.9, 0.06, 0.12, p.x, FL + 0.08, p.z - 0.25, 1).rotateY(rot), wood); K.add('varnish', Bx(0.9, 0.06, 0.12, p.x, FL + 0.08, p.z + 0.25, 1).rotateY(rot), wood); K.add('cloth', new T.SphereGeometry(0.2, 10, 8).scale(1.8, 1, 1).rotateY(rot).translate(p.x, FL + 0.65, p.z), [0.85, 0.82, 0.78]); K.add('cloth', new T.SphereGeometry(0.11, 8, 6).scale(1.5, 1, 1).rotateY(rot).translate(p.x + alongA[0] * 0.42, FL + 0.9, p.z + alongA[1] * 0.42), [0.85, 0.82, 0.78]); for (const s of [-1, 1]) for (const t of [-1, 1]) K.add('varnish', Bx(0.05, 0.4, 0.05, p.x + s * 0.3 * alongA[0] + t * 0.15 * (1 - alongA[0]), FL + 0.3, p.z + s * 0.3 * alongA[1] + t * 0.15 * (1 - alongA[1]), 1), wood); colBox(p.x, p.z, 1.0, 1.0, FL, FL + 1.0);
    const hq = P(L / 2 - 1.2, 3.0); K.add('paint', Bx(0.8, 0.9, 0.5, hq.x, FL + 0.45, hq.z, 1).rotateY(rot), [0.9, 0.75, 0.6]); K.add('paint', new T.ConeGeometry(0.55, 0.4, 4).rotateY(Math.PI / 4 + rot).translate(hq.x, FL + 1.1, hq.z), [0.6, 0.15, 0.1]); for (let i = 0; i < 4; i++) K.add('lit', Bx(0.12, 0.15, 0.02, hq.x + (i % 2 - 0.5) * 0.4 * (1 - alongA[0]) - bo[0] * 0.26, FL + 0.3 + Math.floor(i / 2) * 0.4, hq.z + (i % 2 - 0.5) * 0.4 * (1 - alongA[1]) - bo[1] * 0.26, 1), [1.4, 1.0, 0.5]); colBox(hq.x, hq.z, 0.9, 0.9, FL, FL + 1.3);
    merchant('worker', pick(SHIRTS), 29.6);
    VENUE_PEDS.push({ st: 4, x: P(0.6, 3.1).x, y: FL, z: P(0.6, 3.1).z, yaw: yawIn + Math.PI, sc: 0.6, v: 0, kind: 'kid', act: 28.5 }); customer(0.0, 3.4, yawIn + Math.PI, 'lady', 31.1);
    for (const it of S.items) for (let i = 0; i < 4; i++) { const x = it.x + (it.ax ? 0 : (i - 1.5) * 0.4), z = it.z + (it.ax ? (i - 1.5) * 0.4 : 0); if (i % 2) { K.add('cloth', new T.SphereGeometry(0.1, 8, 6).translate(x, it.y + 0.12, z), [0.45, 0.3, 0.15]); K.add('cloth', new T.SphereGeometry(0.07, 8, 6).translate(x, it.y + 0.28, z), [0.45, 0.3, 0.15]); } else { box3(x, it.y, z, 0.26, 0.1, 0.1, [0.7, 0.1, 0.1], 'paint'); K.add('iron', Bx(0.08, 0.1, 0.08, x, it.y + 0.15, z, 1)); } }
  } else if (k === 'friseur') {
    // Spiegelwand mit Konsolen und Friseurstühlen
    const q = P(0, 0.06); K.add('glass', new T.PlaneGeometry(L - 1.0, 1.6).rotateY(ax ? (bo[0] > 0 ? -Math.PI / 2 : Math.PI / 2) : (bo[1] > 0 ? Math.PI : 0)).translate(q.x, FL + 1.6, q.z));
    K.add('gold', Bx(ax ? 0.03 : L - 0.9, 1.7, ax ? L - 0.9 : 0.03, q.x + bo[0] * 0.02, FL + 1.6, q.z + bo[1] * 0.02, 1));
    const nch = Math.max(2, Math.floor((L - 1.4) / 2.0));
    for (let i = 0; i < nch; i++) {
      const a = -L / 2 + 1.2 + i * (L - 2.4) / Math.max(1, nch - 1), c = P(a, 0.4), s = P(a, 1.5);
      K.add('stone', Bx(ax ? 0.4 : 0.9, 0.1, ax ? 0.9 : 0.4, c.x, FL + 0.8, c.z, 1), [0.92, 0.9, 0.86]); K.add('stone', lathe([[0.12, 0], [0.2, 0.08], [0.22, 0.14]], 14).translate(c.x, FL + 0.85, c.z), [0.95, 0.94, 0.92]); K.add('chrome', new T.CylinderGeometry(0.012, 0.012, 0.22, 6).translate(c.x + bo[0] * 0.1, FL + 1.05, c.z + bo[1] * 0.1));
      for (let j = 0; j < 4; j++) bottle(c.x + alongA[0] * (j - 1.5) * 0.14 - bo[0] * 0.3, FL + 0.85, c.z + alongA[1] * (j - 1.5) * 0.14 - bo[1] * 0.3, pc([[0.3, 0.8, 0.9], [0.9, 0.6, 0.3], [0.8, 0.9, 0.5]]), 0.16, 0.025);
      colBox(c.x, c.z, 0.9, 0.9, FL, FL + 1.0);
      // Friseurstuhl: Chromfuß, Ledersitz, Rückenlehne, Fußstütze
      K.add('chrome', lathe([[0.3, 0], [0.32, 0.04], [0.06, 0.06], [0.06, 0.4]], 12).translate(s.x, FL, s.z));
      const FM = { up: 'leather', frame: 'chrome', wood: 'chrome', lamp: 'lit', cloth: 'cloth' }; placeFurn(FURN.clubChair(), FM, (kk, gg) => K.add(kk, gg, kk === 'leather' ? [0.35, 0.08, 0.08] : [1, 1, 1]), s.x, FL + 0.25, s.z, yawIn + Math.PI);
      colBox(s.x, s.z, 0.9, 0.9, FL, FL + 1.2);
      if (i === 0) { VENUE_PEDS.push({ st: 4, x: s.x, y: FL + 0.25 + 0.5, z: s.z, yaw: yawIn + Math.PI, sc: 0.98, v: 0, sit: true, kind: 'suit', act: 0.3 }); const b = P(a + 0.7, 1.6); VENUE_PEDS.push({ st: 4, x: b.x, y: FL, z: b.z, yaw: Math.atan2(s.x - b.x, s.z - b.z), sc: 1.0, v: 0, kind: 'waiter', col: [0.92, 0.9, 0.86], act: 30.4, shop: S }); }
    }
    // Wartebank, Kasse
    const wb = P(L / 2 - 1.0, 3.4); benchGeo(K, 1.6, wb.x, FL, wb.z, rot + Math.PI); colBox(wb.x, wb.z, 1.6, 0.6, FL, FL + 0.9); VENUE_PEDS.push({ st: 4, x: wb.x - alongA[0] * 0.3, y: FL + 0.45, z: wb.z - alongA[1] * 0.3, yaw: rot + Math.PI, sc: 1.0, v: 0, sit: true, kind: 'coat', act: 7.8 });
    S.counter = { x: P(-L / 2 + 1.0, 3.2).x, z: P(-L / 2 + 1.0, 3.2).z, len: 1.2, n: 3.2, top: FL + 1.0 }; K.add('varnish', Bx(1.0, 0.95, 0.6, S.counter.x, FL + 0.475, S.counter.z, 1).rotateY(rot), wood); colBox(S.counter.x, S.counter.z, 1.0, 1.0, FL, FL + 1.0);
    S.merchant = VENUE_PEDS[VENUE_PEDS.length - 2];
    for (const it of S.items) for (let i = 0; i < 5; i++) bottle(it.x + (it.ax ? 0 : (i - 2) * it.w * 0.2), it.y, it.z + (it.ax ? (i - 2) * it.d * 0.2 : 0), pc([[0.3, 0.8, 0.9], [0.9, 0.6, 0.3], [0.8, 0.9, 0.5]]), 0.22, 0.04);
  } else if (k === 'cafe' || k === 'bar') {
    const bar = k === 'bar';
    // Flaschen- oder Kuchenregal mit Spiegel an der Rückwand
    const q = P(0, 0.08); K.add('glass', new T.PlaneGeometry(Math.min(L - 1.0, 7), 1.4).rotateY(ax ? (bo[0] > 0 ? -Math.PI / 2 : Math.PI / 2) : (bo[1] > 0 ? Math.PI : 0)).translate(q.x, FL + 2.1, q.z));
    const sw = shelfWall(0.3, bar ? [1.5, 2.0, 2.5] : [1.4, 1.9], -Math.min(L - 1.0, 7) / 2, Math.min(L - 1.0, 7) / 2);
    onShelf(sw, (x, y, z) => { if (bar) { if (rr() < 0.6) ware(pc(['wine-red', 'wine-white', 'bottle', 'bottle-large', 'soda-bottle']), x, y, z, rr); else bottle(x, y, z, pc([[0.5, 1.0, 0.4], [1.4, 0.8, 0.3], [0.4, 0.8, 1.2], [1.2, 0.3, 0.3], [1.3, 1.2, 0.8]]), 0.22 + rr() * 0.1, 0.03); } else if (rr() < 0.7) { K.add('chrome', new T.CylinderGeometry(0.13, 0.13, 0.02, 14).translate(x, y + 0.01, z)); const m = pc(['cake', 'pie', 'cupcake', 'muffin', 'croissant']); if (m === 'cupcake' || m === 'muffin') for (let i = 0; i < 3; i++) ware(m, x + Math.cos(i * 2.1) * 0.06, y + 0.02, z + Math.sin(i * 2.1) * 0.06, rr); else ware(m, x, y + 0.02, z, rr); } else { K.add('chrome', new T.CylinderGeometry(0.1, 0.1, 0.03, 14).translate(x, y + 0.015, z)); K.add('cloth', new T.CylinderGeometry(0.085, 0.085, 0.07, 14).translate(x, y + 0.065, z), pc([[0.4, 0.2, 0.1], [0.9, 0.85, 0.75], [0.7, 0.3, 0.3], [0.95, 0.8, 0.4]])); } }, bar ? 0.13 : 0.32);
    counter(bar ? 1.5 : 1.7, Math.min(L - 2.4, 7), bar ? 'varnish' : 'stone', bar ? [0.1, 0.08, 0.08] : [0.92, 0.9, 0.86]);
    const c = S.counter;
    if (bar) { K.add('gold', new T.CylinderGeometry(0.02, 0.02, c.len, 8).rotateZ(ax ? 0 : Math.PI / 2).rotateX(ax ? Math.PI / 2 : 0).translate(c.x - bo[0] * 0.48, FL + 0.22, c.z - bo[1] * 0.48)); addNeon(c.x - bo[0] * 0.41, FL + 0.98, c.z - bo[1] * 0.41, ax ? 0.02 : c.len, 0.02, ax ? c.len : 0.02, NEON.amber);
      const FM = { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth' };
      for (let a = -c.len / 2 + 0.5; a < c.len / 2 - 0.3; a += 0.95) { const p = P(a, c.n + 0.95); placeFurn(FURN.barStool(), FM, (kk, gg) => K.add(kk, gg, kk === 'leather' ? [0.45, 0.12, 0.08] : [1, 1, 1]), p.x, FL, p.z); if (rr() < 0.55) VENUE_PEDS.push({ st: 4, x: p.x, y: FL + 0.89, z: p.z, yaw: yawIn + Math.PI, sc: 0.94 + rr() * 0.1, v: 0, sit: true, kind: pickW(rr, [['suit', 1], ['coat', 0.8], ['lady', 0.8], ['tux', 0.5], ['gown', 0.4]]), act: pickW(rr, [[11.4, 1], [7.8, 1]]) }); }
      // Shaker, Gläser auf der Theke
      for (let a = -c.len * 0.3; a < c.len * 0.3; a += 0.5) { const p = P(a, c.n); if (rr() < 0.4) K.add('chrome', lathe([[0.03, 0], [0.035, 0.12], [0.02, 0.17]], 8).translate(p.x, c.top, p.z)); else ware(pc(['cocktail', 'glass-wine']), p.x, c.top, p.z, rr); }
    } else {
      // Espressomaschine aus Chrom und Messing, Kuchenvitrine
      const m = P(-c.len * 0.3, c.n); K.add('chrome', Bx(0.6, 0.4, 0.45, m.x, c.top + 0.2, m.z, 1).rotateY(rot)); K.add('gold', Bx(0.64, 0.05, 0.49, m.x, c.top + 0.42, m.z, 1).rotateY(rot)); K.add('gold', new T.SphereGeometry(0.1, 10, 8).translate(m.x, c.top + 0.52, m.z)); K.add('chrome', new T.CylinderGeometry(0.012, 0.012, 0.3, 6).rotateZ(1.0).rotateY(rot).translate(m.x + alongA[0] * 0.4, c.top + 0.45, m.z + alongA[1] * 0.4));
      K.add('glass', Bx(ax ? 0.6 : c.len * 0.4, 0.4, ax ? c.len * 0.4 : 0.6, c.x + alongA[0] * c.len * 0.2, c.top + 0.21, c.z + alongA[1] * c.len * 0.2, 1));
      for (let a = c.len * 0.05; a < c.len * 0.38; a += 0.33) { const p = P(a, c.n); K.add('chrome', new T.CylinderGeometry(0.13, 0.13, 0.02, 14).translate(p.x, c.top + 0.01, p.z)); ware(pc(['cake', 'pie', 'cake']), p.x, c.top + 0.02, p.z, rr); }
    }
    // Tische im Raum
    const rows = Math.max(1, Math.floor((iw > id ? id : iw) / 3.2));
    for (let a = -L / 2 + 1.5; a < L / 2 - 1.0; a += 3.0) for (let r = 0; r < rows; r++) { const n = c.n + 2.6 + r * 2.8; if (n > (ax ? iw : id) - 1.2) continue; const p = P(a, n); tableSet(p.x, p.z, !bar, true); }
    merchant(bar ? 'waiter' : 'waiter', bar ? [0.42, 0.08, 0.08] : [0.94, 0.92, 0.87], bar ? 13.3 : 29.4);
    for (const it of S.items) if (bar) { for (let i = 0; i < 5; i++) bottle(it.x + (it.ax ? 0 : (i - 2) * it.w * 0.2), it.y, it.z + (it.ax ? (i - 2) * it.d * 0.2 : 0), pc([[0.5, 1.0, 0.4], [1.4, 0.8, 0.3], [0.4, 0.8, 1.2]]), 0.3, 0.045); } else for (let i = 0; i < 3; i++) { const x = it.x + (it.ax ? 0 : (i - 1) * it.w * 0.3), z = it.z + (it.ax ? (i - 1) * it.d * 0.3 : 0); K.add('chrome', new T.CylinderGeometry(0.16, 0.16, 0.02, 14).translate(x, it.y + 0.01, z)); ware(pc(['cake', 'pie']), x, it.y + 0.02, z, rr); K.add('glass', new T.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, it.y + 0.02, z)); }
  }
  // Regale an den fensterlosen Seitenwänden und Mitteltische, mit den Waren der Ladenart
  const fill = SHOP_FILL[k];
  if (fill) {
    for (const side of ['n', 's', 'w', 'e']) {
      if (edges[side] || side === back) continue;
      const os = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[side], axS = os[0] !== 0, LS = (axS ? id : iw) - 1.2, depth = 0.36;
      const wx = cx + os[0] * (iw / 2 - depth / 2), wz = cz + os[1] * (id / 2 - depth / 2);
      K.add('inWood', Bx(axS ? depth : LS, 2.6 - FL, axS ? LS : depth, wx, (FL + 2.6) / 2, wz, 1), wood.map(v => v * 0.9));
      colBox(wx, wz, axS ? depth : LS, axS ? LS : depth, FL, 2.6);
      for (const y of [1.1, 1.8, 2.5]) {
        K.add('varnish', Bx(axS ? depth + 0.04 : LS, 0.035, axS ? LS : depth + 0.04, wx - os[0] * 0.02, y, wz - os[1] * 0.02, 1), wood);
        for (let a = -LS / 2 + 0.2; a < LS / 2 - 0.15; a += fill.step * (MOBILE ? 2.2 : 1.4)) fill.fn(wx - os[0] * (depth / 2 - 0.1) + (axS ? 0 : a), y + 0.02, wz - os[1] * (depth / 2 - 0.1) + (axS ? a : 0), axS);
      }
    }
    // Mitteltische mit Auslage, wenn der Raum groß genug ist
    const c = S.counter, nT = Math.max(0, Math.min(1, Math.floor(((ax ? iw : id) - (c ? c.n : 1.6) - 4.5) / 3.2)));
    for (let t = 0; t < nT; t++) for (const a of L > 12 ? [-L / 4, L / 4] : [0]) {
      const q = P(a, (c ? c.n : 1.6) + 3.2 + t * 3.2);
      K.add('varnish', Bx(1.8, 0.05, 0.9, q.x, FL + 0.82, q.z, 1).rotateY(rot), wood); K.add('varnish', Bx(1.5, 0.78, 0.6, q.x, FL + 0.4, q.z, 1).rotateY(rot), wood.map(v => v * 0.8));
      colBox(q.x, q.z, 1.9, 1.9, FL, FL + 0.85);
      for (let i = -2; i <= 2; i++) fill.fn(q.x + alongA[0] * i * 0.32, FL + 0.85, q.z + alongA[1] * i * 0.32, ax);
    }
  }
  S.kindName = kind.k;
}
// Waren je Ladenart für Seitenregale und Tische
export const SHOP_FILL = {};
export function shopFillInit(K, rr) {
  if (SHOP_FILL.K === K) return; SHOP_FILL.K = K;
  const pc = arr => arr[Math.floor(rr() * arr.length)];
  const lit = (g, c) => K.add('lit', g, c);
  SHOP_FILL.hut = { step: 0.46, fn: (x, y, z) => { K.add('cloth', lathe([[0, 0], [0.19, 0], [0.19, 0.008], [0.105, 0.012], [0.1, 0.13], [0.08, 0.145], [0, 0.15]], 14).translate(x, y, z), pc([[0.08, 0.07, 0.07], [0.3, 0.2, 0.12], [0.5, 0.45, 0.4], [0.2, 0.1, 0.1], [0.7, 0.62, 0.5]])); K.add('cloth', new T.TorusGeometry(0.102, 0.012, 4, 9).rotateX(Math.PI / 2).translate(x, y + 0.03, z), [0.08, 0.07, 0.07]); } };
  SHOP_FILL.buch = { step: 0.062, fn: (x, y, z, ax) => { if (rr() < 0.08) return; const h = 0.2 + rr() * 0.1, w = 0.03 + rr() * 0.03; K.add('leather', Bx(ax ? 0.17 : w, h, ax ? w : 0.17, x, y + h / 2, z, 1), pc([[0.4, 0.1, 0.08], [0.1, 0.22, 0.14], [0.12, 0.14, 0.3], [0.5, 0.4, 0.25], [0.2, 0.08, 0.1], [0.6, 0.55, 0.45]])); } };
  SHOP_FILL.deli = { step: 0.2, fn: (x, y, z) => { const r = rr(); if (r < 0.3) { ware(pc(['cheese', 'wine-red', 'wine-white', 'bread', 'loaf', 'apple', 'orange', 'pear', 'whole-ham']), x, y, z, rr); return; } if (r < 0.55) { const h = 0.14 + rr() * 0.1; lit(lathe([[0.05, 0], [0.05, h * 0.85], [0.04, h]], 7).translate(x, y, z), pc([[1.0, 0.7, 0.2], [0.8, 0.3, 0.2], [0.4, 0.7, 0.3], [0.9, 0.5, 0.1]]).map(v => v * 0.5)); K.add('gold', new T.CylinderGeometry(0.042, 0.042, 0.02, 10).translate(x, y + h, z)); } else if (r < 0.75) lit(lathe([[0.035, 0], [0.035, 0.16], [0.014, 0.2], [0.013, 0.26]], 6).translate(x, y, z), pc([[0.6, 0.9, 0.4], [0.9, 0.3, 0.3], [1.0, 0.8, 0.4]]).map(v => v * 0.55)); else K.add('cloth', Bx(0.14, 0.1, 0.12, x, y + 0.05, z, 1), pc([[0.85, 0.75, 0.5], [0.3, 0.5, 0.6], [0.7, 0.3, 0.25]])); } };
  SHOP_FILL.tabak = { step: 0.24, fn: (x, y, z) => { const r = rr(); if (r < 0.5) K.add('varnish', Bx(0.2, 0.07, 0.14, x, y + 0.035, z, 1), pc([[0.45, 0.25, 0.1], [0.6, 0.4, 0.2], [0.3, 0.15, 0.08]])); else if (r < 0.8) K.add('chrome', new T.CylinderGeometry(0.05, 0.05, 0.08, 10).translate(x, y + 0.04, z)); else K.add('gold', Bx(0.1, 0.12, 0.06, x, y + 0.06, z, 1)); } };
  SHOP_FILL.apotheke = { step: 0.14, fn: (x, y, z) => { const r = rr(); if (r < 0.6) { const h = 0.18 + rr() * 0.12, rr0 = 0.03 + rr() * 0.015; lit(lathe([[rr0, 0], [rr0, h * 0.62], [rr0 * 0.4, h * 0.78], [rr0 * 0.38, h]], 6).translate(x, y, z), pc([[0.6, 0.4, 0.2], [0.3, 0.6, 0.4], [0.5, 0.6, 0.9], [0.9, 0.85, 0.7]]).map(v => v * 0.55)); } else K.add('cloth', Bx(0.1, 0.12, 0.06, x, y + 0.06, z, 1), [0.9, 0.9, 0.86]); } };
  SHOP_FILL.spiel = { step: 0.32, fn: (x, y, z) => { const r = rr(); if (r < 0.3) { K.add('cloth', new T.SphereGeometry(0.09, 8, 6).translate(x, y + 0.14, z), [0.45, 0.3, 0.15]); K.add('cloth', new T.SphereGeometry(0.065, 8, 6).translate(x, y + 0.29, z), [0.45, 0.3, 0.15]); } else if (r < 0.55) lit(new T.SphereGeometry(0.08, 10, 8).translate(x, y + 0.08, z), pc([[1.0, 0.3, 0.2], [0.3, 0.5, 1.0], [1.0, 0.8, 0.2]]).map(v => v * 0.6)); else for (let i = 0; i < 3; i++) K.add('paint', Bx(0.06, 0.06, 0.06, x + (i - 1) * 0.07, y + 0.03, z, 1), pc([[0.9, 0.2, 0.15], [0.2, 0.4, 0.9], [0.9, 0.8, 0.2], [0.2, 0.7, 0.3]])); } };
  SHOP_FILL.platten = { step: 0.04, fn: (x, y, z, ax) => { if (rr() < 0.15) return; K.add('cloth', Bx(ax ? 0.3 : 0.025, 0.3, ax ? 0.025 : 0.3, x, y + 0.16, z, 1), pc([[0.7, 0.6, 0.4], [0.3, 0.2, 0.3], [0.5, 0.15, 0.15], [0.2, 0.3, 0.4], [0.8, 0.75, 0.6]])); } };
  SHOP_FILL.blumen = { step: 0.4, fn: (x, y, z) => { K.add('chrome', lathe([[0.08, 0], [0.1, 0.26]], 10).translate(x, y, z)); for (let i = 0; i < 4; i++) { const bx = x + (rr() - 0.5) * 0.1, bz = z + (rr() - 0.5) * 0.1; K.add('cloth', new T.CylinderGeometry(0.006, 0.006, 0.36, 4).translate(bx, y + 0.3, bz), [0.15, 0.35, 0.15]); lit(new T.SphereGeometry(0.045, 7, 5).scale(1, 0.75, 1).translate(bx, y + 0.5, bz), pc([[1.4, 0.3, 0.4], [1.5, 1.4, 1.2], [1.4, 0.8, 0.2], [0.9, 0.4, 1.2]]).map(v => v * 0.7)); } } };
  SHOP_FILL.uhren = { step: 0.42, fn: (x, y, z) => { K.add('gold', new T.CylinderGeometry(0.09, 0.09, 0.04, 16).translate(x, y + 0.02, z)); lit(new T.CylinderGeometry(0.07, 0.07, 0.042, 16).translate(x, y + 0.02, z), [0.95, 0.92, 0.82]); } };
  SHOP_FILL.mode = { step: 0.5, fn: (x, y, z) => { K.add('cloth', Bx(0.26, 0.05, 0.3, x, y + 0.025, z, 1), pc(DRESSES)); K.add('cloth', Bx(0.22, 0.04, 0.26, x, y + 0.07, z, 1), pc(DRESSES)); } };
  SHOP_FILL.schneider = { step: 0.5, fn: (x, y, z, ax) => K.add('cloth', new T.CylinderGeometry(0.07, 0.07, 0.4, 10).rotateZ(ax ? 0 : Math.PI / 2).rotateX(ax ? Math.PI / 2 : 0).translate(x, y + 0.07, z), pc([[0.3, 0.3, 0.35], [0.5, 0.45, 0.4], [0.12, 0.14, 0.2], [0.4, 0.3, 0.2], [0.6, 0.6, 0.6]])) };
}
// Nach dem Stadtbau: alle Läden zu wenigen Meshes verschmelzen, Interaktion an den Theken
export function finishShops() {
  // Die Läden einer Zelle werden erst zu Meshes verschmolzen, wenn der Spieler in die Nähe kommt (Welt-Chunks),
  // und wieder vom Grafikspeicher gelöst, wenn er sich entfernt. Sichtweite wie bisher: 650 m plus Flughöhe.
  registerLayer({
    name: 'shops', size: SHOP_CELL, radius: cam => 650 + Math.max(0, cam.position.y),
    build(cx, cz) {
      const c = SHOP_KITS[chunkKey(cx, cz)]; if (!c) return null;
      if (!c.g) { c.g = new T.Group(); c.K.build(c.g); c.K = null; }
      return c.g;
    },
  });
  for (const k in SHOP_FILL) delete SHOP_FILL[k];   // Einzelteile der Planung freigeben
  const FIRSTS = ['Herr Falk', 'Frau Seidel', 'Herr Marchetti', 'Frau Dubois', 'Herr Lorenz', 'Herr Stein', 'Frau Rosa', 'Herr Adler', 'Frau Vera', 'Herr König', 'Herr Ziegler', 'Herr Keller', 'Herr O’Hara', 'Frau Brandt', 'Herr Graf', 'Frau Sommer', 'Herr Novak', 'Frau Weiß'];
  SHOPS.forEach((S, i) => {
    S.host = FIRSTS[i % FIRSTS.length];
    const inside = p => p.x > S.x0 + 0.5 && p.x < S.x1 - 0.5 && p.z > S.z0 + 0.5 && p.z < S.z1 - 0.5 && p.y < 4;
    const c = S.counter; if (!c) return;
    const kind = SHOP_KINDS.find(q => q.k === S.kind);
    INTERACT.push({ test: p => inside(p) && Math.abs(p.x - c.x) < (c.len / 2 + 1.4) && Math.abs(p.z - c.z) < (c.len / 2 + 1.4) && Math.hypot(Math.max(0, Math.abs(p.x - c.x) - (S.door && S.door.ux ? c.len / 2 : 0.35)), Math.max(0, Math.abs(p.z - c.z) - (S.door && S.door.uz ? c.len / 2 : 0.35))) < 1.5,
      label: `${S.kind === 'friseur' ? 'Platz nehmen' : 'Kaufen'}: ${kind.ware} · ${S.host}`,
      act: () => { const lines = SHOP_SAY[S.kind]; S.said = ((S.said || 0) + 1) % lines.length; toast(`${S.host}: „${lines[S.said]}“`); if (S.merchant && S.merchant.a) { setAct(S.merchant, 1.6); setTimeout(() => { if (S.merchant.a) setAct(S.merchant, S.merchant.act); }, 2600); } } });
  });
  // Begrüßung beim Betreten
  SHOPS.forEach(S => { S.greet = 0; });
}
export function updateShops(dt) {
  const p = player.p;
  for (const S of SHOPS) {
    const inS = p.x > S.x0 + 0.6 && p.x < S.x1 - 0.6 && p.z > S.z0 + 0.6 && p.z < S.z1 - 0.6 && p.y < 4;
    if (inS && !S.inside) { S.inside = true; if (S.greetCool === undefined || S.greetCool <= 0) { toast(`${S.name} · ${S.host}: „Guten Abend, treten Sie ein!“`); S.greetCool = 60; if (S.merchant && S.merchant.a) { setAct(S.merchant, 1.6); setTimeout(() => { if (S.merchant.a) setAct(S.merchant, S.merchant.act); }, 2000); } } }
    else if (!inS && S.inside) S.inside = false;
    if (S.greetCool > 0) S.greetCool -= dt;
  }
}

export function buildBlock(b) {
  const SW = 4.5;
  addCollider(b.x0, 0, b.z0, b.x1, 0.22, b.z1);
  // Laternen am Bordstein
  const per = [[b.x0 + 1, b.z0 + 1, b.x1 - 1, b.z0 + 1], [b.x1 - 1, b.z0 + 1, b.x1 - 1, b.z1 - 1], [b.x1 - 1, b.z1 - 1, b.x0 + 1, b.z1 - 1], [b.x0 + 1, b.z1 - 1, b.x0 + 1, b.z0 + 1]];
  if (b.d < 760) for (const [ax, az, bx, bz] of per) curbs.push({ ax, az, bx, bz, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 });
  for (const [ax, az, bx, bz] of per) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 24));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; lamps.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, h: 4.8 }); }
  }
  const ix0 = b.x0 + SW, ix1 = b.x1 - SW, iz0 = b.z0 + SW, iz1 = b.z1 - SW;
  if (b.park) {
    for (let x = ix0 + 4; x < ix1 - 2; x += 9) for (let z = iz0 + 4; z < iz1 - 2; z += 9) if (R() < 0.75) trees.push({ x: x + rand(-1.5, 1.5), z: z + rand(-1.5, 1.5), s: rand(0.8, 1.3) });
    for (let x = ix0 + 8; x < ix1; x += 18) addGlow(x, 3.2, (iz0 + iz1) / 2, NEON.gold, 1.4);
    return;
  }
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const nearProm = Math.abs(cx) < 120 && cz > 133;
  const waterfront = cz > 420;
  const tier = b.tier || 'fabric';
  const worker = tier === 'fabric' && b.d > 650 && !waterfront;
  let Hc = tier === 'landmark' ? 175 + 120 * Math.exp(-b.d / 320) : tier === 'mid' ? 62 + 58 * Math.exp(-b.d / 400) : 15 + 22 * Math.exp(-b.d / 500);
  if (nearProm && tier !== 'landmark') Hc *= 1.3;
  if (worker) Hc = 11 + 9 * R();
  const W = ix1 - ix0, D = iz1 - iz0;
  const nx = tier === 'landmark' ? 1 : (tier === 'mid' ? 2 : (W > 70 ? 3 : 2)), nz = tier === 'landmark' ? 1 : (tier === 'mid' ? 1 : 2);
  b.worker = worker;
  const ALLEY = 5;
  const xs = [ix0]; for (let k = 1; k < nx; k++) xs.push(ix0 + W * k / nx + rand(-4, 4)); xs.push(ix1);
  for (let k = 1; k < nx; k++) buildAlley(xs[k], iz0, iz1, b.d);
  const zs = [iz0]; for (let k = 1; k < nz; k++) zs.push(iz0 + D * k / nz + rand(-3, 3)); zs.push(iz1);
  for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
    let lx0 = xs[a] + (a > 0 ? ALLEY / 2 : 0), lx1 = xs[a + 1] - (a < nx - 1 ? ALLEY / 2 : 0);
    const lz0 = zs[c] + (c > 0 ? rand(0, 1.2) : 0), lz1 = zs[c + 1] - (c < nz - 1 ? rand(0, 1.2) : 0);
    // V23: Häuser hinter-/nebeneinander in einer Spalte nie exakt gleich breit, sonst liegen ihre Gesimse deckungsgleich (Flackern)
    if (c > 0) { const k = 0.45 + 0.6 * R(); lx0 += k; lx1 -= k; }
    let H = Hc * rand(tier === 'landmark' ? 0.9 : 0.7, 1.15);
    if (waterfront) H = Math.min(H, 60);
    H = Math.max(10, Math.min(H, 310));
    H = Math.round(H / 3.6) * 3.6 + 0.2;
    const edges = { n: c === 0, s: c === nz - 1, w: a === 0, e: a === nx - 1 };
    decoBuilding((lx0 + lx1) / 2, (lz0 + lz1) / 2, lx1 - lx0, lz1 - lz0, H, b.d, edges, worker);
  }
}

// Gasse zwischen zwei Häusern: Laternen, eiserne Stege, Dampf
export function buildAlley(x, z0, z1, dist) {
  const iron = [0.22, 0.2, 0.2];
  for (let z = z0 + 6; z < z1 - 4; z += 11) {
    const side = R() < 0.5 ? -1 : 1;
    addGlow(x + side * 2.2, 4.2, z, [1.25, 0.78, 0.4], 1.5);
    lamps.push({ x: x + side * 2.2, z, h: 0, wall: true });
  }
  const nb = 1 + Math.floor(R() * 2);
  for (let k = 0; k < nb; k++) {
    const z = rand(z0 + 8, z1 - 8), y = rand(7, 22);
    addSeg({ x, z, w: 6.4, d: 1.8, y0: y, y1: y + 0.3, tint: iron, seed: 800, style: 0, dens: 0, flood: 0, rib: [0, 0, 0] });
    for (const sd of [-1, 1]) { addNeon(x, y + 0.8, z + sd * 0.85, 6.4, 0.08, 0.08, [0.3, 0.26, 0.22]); addNeon(x, y + 0.45, z + sd * 0.85, 6.4, 0.06, 0.06, [0.3, 0.26, 0.22]); }
    addGlow(x, y + 1.4, z, [1.2, 0.75, 0.38], 1.1);
  }
  for (let z = z0 + 10; z < z1 - 6; z += rand(14, 24)) if (R() < 0.6) steamPts.push({ x: x + rand(-1.5, 1.5), z });
}

/* ---------- Industriegebiet Ost: Fabrikhallen mit Sheddach, Schlote, Laufkräne, Förderbänder ---------- */
shared.SINK = false;           // Block wird zur Fabrik: der normale Aufbau läuft ins Leere, damit der Zufall gleich bleibt
export const FACTORIES = [], FACTORY_LOOPS = [], FACTORY_IDLERS = [], DEPOTS = [], SMOKE = [];
export const IND_STATIC = [], IND_GLASS = [];
export const FACTORY_NAMES = ['STAHLWERK', 'GIESSEREI', 'TURBINENBAU', 'LUFTSCHIFFWERFT', 'MASCHINENFABRIK', 'BRAUEREI', 'DRUCKEREI', 'KABELWERK', 'GLASHÜTTE', 'RADIOWERK', 'LOKOMOTIVBAU', 'MÜHLE'];
export const isFactoryZone = b => (b.tier || 'fabric') === 'fabric' && !b.park && b.d > 650 && (b.x0 + b.x1) / 2 > 700 && (b.z0 + b.z1) / 2 < 420;
export function snapArrays() { return [segs, towers, shafts, neons, spires, glowPts, lamps, trees, steamPts, roofs, curbs, DOORS, caps, domes, signDefs, BR_SPOTS].map(a => [a, a.length]); }
export const IB = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);
export function buildFactory(b, rf, idx) {
  addCollider(b.x0, 0, b.z0, b.x1, 0.22, b.z1);
  const per = [[b.x0 + 1, b.z0 + 1, b.x1 - 1, b.z0 + 1], [b.x1 - 1, b.z0 + 1, b.x1 - 1, b.z1 - 1], [b.x1 - 1, b.z1 - 1, b.x0 + 1, b.z1 - 1], [b.x0 + 1, b.z1 - 1, b.x0 + 1, b.z0 + 1]];
  for (const [ax, az, bx, bz] of per) {
    curbs.push({ ax, az, bx, bz, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2 });
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 24));
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; lamps.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, h: 4.8 }); }
  }
  const SW = 4.5, ix0 = b.x0 + SW, ix1 = b.x1 - SW, iz0 = b.z0 + SW, iz1 = b.z1 - SW, W = ix1 - ix0, D = iz1 - iz0;
  const brick = BRICK[Math.floor(rf() * BRICK.length)], dark = brick.map(v => v * 0.65);
  const flip = rf() < 0.5, hw = W * (0.5 + rf() * 0.1), HH = 12 + Math.floor(rf() * 3) * 1.8;
  const hx0 = flip ? ix1 - hw : ix0, hx1 = hx0 + hw, hcx = (hx0 + hx1) / 2;
  const yx0 = flip ? ix0 : hx1 + 0.5, yx1 = flip ? hx0 - 0.5 : ix1, ycx = (yx0 + yx1) / 2, yw = yx1 - yx0;
  const head = 10, hz1 = iz1 - head;
  // Halle mit hohen Bogenfenstern, davor ein Kopfbau mit Kontor und Firmenschild
  addSeg({ x: hcx, z: (iz0 + hz1) / 2, w: hw, d: hz1 - iz0, y0: 0.2, y1: HH, tint: brick, seed: 600 + idx, style: 2, dens: 0.7, flood: 0.15, rib: [0, 0, 0] });
  addSeg({ x: hcx, z: (iz0 + hz1) / 2, w: hw + 0.7, d: hz1 - iz0 + 0.7, y0: HH - 0.5, y1: HH + 0.2, tint: dark, seed: 601, style: 3, dens: 0, flood: 0 }, false);
  const HK = HH + 5.4;
  addSeg({ x: hcx, z: hz1 + head / 2, w: hw, d: head, y0: 0.2, y1: HK, tint: brick.map(v => v * 1.08), seed: 610 + idx, style: 0, dens: 0.55, flood: 0.2, rib: [0, 0, 0] });
  addSeg({ x: hcx, z: hz1 + head / 2, w: hw + 0.8, d: head + 0.8, y0: HK - 0.7, y1: HK + 0.2, tint: dark, seed: 611, style: 3, dens: 0, flood: 0 }, false);
  for (const sx of [-1, 1]) addSeg({ x: hcx + sx * (hw / 2 - 0.4), z: iz1 + 0.25, w: 1.4, d: 0.9, y0: 0.2, y1: HK + 1.6, tint: dark, seed: 612, style: 3, dens: 0, flood: 0.2 }, false);
  signDefs.push({ cx: hcx, cz: (iz0 + iz1) / 2, w: hw, d: D, side: 's', word: FACTORY_NAMES[idx % FACTORY_NAMES.length], color: '#ffd9a0', vertical: false });
  // Sheddach: Zähne mit verglaster Nordseite
  const nT = Math.max(2, Math.floor((hz1 - iz0) / 6)), tl = (hz1 - iz0) / nT;
  for (let k = 0; k < nT; k++) {
    const z0 = iz0 + k * tl, z1 = z0 + tl, y0 = HH + 0.2, y1 = y0 + 3;
    const s = new T.BufferGeometry(), x0 = hx0 + 0.2, x1 = hx1 - 0.2;
    s.setAttribute('position', new T.Float32BufferAttribute([x0, y0, z1, x1, y0, z1, x1, y1, z0, x0, y0, z1, x1, y1, z0, x0, y1, z0, x0, y0, z1, x0, y1, z0, x0, y0, z0, x1, y0, z1, x1, y0, z0, x1, y1, z0], 3));
    s.computeVertexNormals();
    IND_STATIC.push([s, [0.12, 0.12, 0.14]]);
    IND_GLASS.push(new T.PlaneGeometry(hw - 0.6, 2.6).rotateY(Math.PI).translate(hcx, y0 + 1.45, z0 + 0.02));
  }
  // Schlote mit Ringen; Rauch steigt auf
  const nC = 1 + (rf() < 0.55 ? 1 : 0);
  for (let k = 0; k < nC; k++) {
    const x = hcx + (k ? -1 : 1) * hw * 0.22, z = iz0 + 4 + k * 7, h = 34 + rf() * 22, r = 1.7 + rf() * 0.5;
    IND_STATIC.push([new T.CylinderGeometry(r * 0.72, r, h, 16, 1, true).translate(x, h / 2, z), brick]);
    for (let y = 8; y < h - 2; y += 9) IND_STATIC.push([new T.CylinderGeometry(r * (1 - y / h * 0.28) + 0.12, r * (1 - y / h * 0.28) + 0.12, 0.5, 16).translate(x, y, z), dark]);
    IND_STATIC.push([new T.CylinderGeometry(r * 0.8, r * 0.74, 1.4, 16, 1, true).translate(x, h + 0.5, z), [0.08, 0.07, 0.07]]);
    addCollider(x - r, 0, z - r, x + r, h, z + r);
    SMOKE.push({ x, y: h + 1, z });
    addGlow(x, h + 1.4, z, [0.9, 0.38, 0.12], 2.4);
  }
  // Mauer um den Hof mit Tor zur Straße
  const wallH = 1.6, wt = 0.5;
  const wallSeg = (x, z, w, d) => { IND_STATIC.push([IB(w, wallH - 0.2, d, x, 0.2 + (wallH - 0.2) / 2, z), brick.map(v => v * 0.55)], [IB(w + 0.12, 0.12, d + 0.12, x, wallH + 0.06, z), [0.18, 0.16, 0.15]]); addCollider(x - w / 2, 0, z - d / 2, x + w / 2, wallH, z + d / 2); };
  const gate = 9;
  wallSeg(ycx - (yw + gate) / 4, iz0 + wt / 2, (yw - gate) / 2, wt); wallSeg(ycx + (yw + gate) / 4, iz0 + wt / 2, (yw - gate) / 2, wt);
  wallSeg(ycx, iz1 - wt / 2, yw, wt);
  wallSeg(flip ? yx0 + wt / 2 : yx1 - wt / 2, (iz0 + iz1) / 2, wt, D);
  for (const sx of [-1, 1]) { IND_STATIC.push([IB(0.9, 3.2, 0.9, ycx + sx * (gate / 2 + 0.45), 1.8, iz0 + wt / 2), dark]); addGlow(ycx + sx * (gate / 2 + 0.45), 3.7, iz0 + wt / 2, [1.2, 0.78, 0.4], 1.3); }
  // Laufkran über dem Hof
  const CH = 10.5, rx0 = yx0 + 1.2, rx1 = yx1 - 1.2, rz0 = iz0 + 1.5, rz1 = iz1 - 1.5;
  const iron = [0.42, 0.3, 0.1];
  IND_STATIC.push([IB(yw - 1, 0.04, D - 1, ycx, 0.24, (iz0 + iz1) / 2), [0.07, 0.068, 0.07]]);
  for (const rx of [rx0, rx1]) {
    IND_STATIC.push([IB(0.6, 0.8, rz1 - rz0, rx, CH, (rz0 + rz1) / 2), iron]);
    for (let z = rz0; z <= rz1 + 0.1; z += (rz1 - rz0) / Math.round((rz1 - rz0) / 9)) {
      IND_STATIC.push([IB(0.5, CH, 0.5, rx, CH / 2, z), iron]);
      addCollider(rx - 0.3, 0, z - 0.3, rx + 0.3, CH, z + 0.3);
    }
  }
  // Förderband aus der Halle in den Hof, Dampfmaschine mit Schwungrad
  const wallX = flip ? hx0 : hx1, dir = flip ? -1 : 1, cz1 = iz0 + D * 0.32, cL = Math.min(15, yw - 5);
  IND_STATIC.push([IB(cL, 0.25, 1.3, wallX + dir * cL / 2, 1.1, cz1), [0.05, 0.05, 0.05]]);
  for (const sz of [-0.7, 0.7]) IND_STATIC.push([IB(cL, 0.32, 0.12, wallX + dir * cL / 2, 1.18, cz1 + sz), iron]);
  for (let k = 0; k <= cL; k += 3) IND_STATIC.push([IB(0.15, 1.0, 1.3, wallX + dir * k, 0.5, cz1), iron]);
  IND_STATIC.push([IB(2.4, 3.2, 2.4, wallX + dir * cL, 1.6, cz1), [0.25, 0.2, 0.14]]);
  addCollider(Math.min(wallX, wallX + dir * cL), 0, cz1 - 0.8, Math.max(wallX, wallX + dir * cL) + 1.2, 1.4, cz1 + 0.8);
  const ez = iz0 + D * 0.68, ex = wallX + dir * 3.2;
  IND_STATIC.push([IB(3.4, 1.0, 6.4, ex, 0.6, ez), [0.14, 0.13, 0.13]]);
  IND_STATIC.push([IB(1.0, 3.4, 0.8, ex, 2.0, ez - 0.2), iron]);
  IND_STATIC.push([new T.CylinderGeometry(0.9, 0.9, 3.2, 14).rotateX(Math.PI / 2).translate(ex, 1.9, ez + 2.0), [0.3, 0.12, 0.08]]);
  addCollider(ex - 1.8, 0, ez - 3.2, ex + 1.8, 4.6, ez + 3.2);
  steamPts.push({ x: ex, z: ez + 3.4 }, { x: wallX + dir * cL, z: cz1 + 1.4 });
  // Kisten- und Fässerstapel
  for (let k = 0; k < 5; k++) {
    const x = rx0 + 2 + rf() * (rx1 - rx0 - 4), z = iz0 + D * (0.45 + rf() * 0.1) + (k % 2 ? 1 : -1) * 2.5, n = 1 + Math.floor(rf() * 3);
    if (Math.abs(x - ex) < 4) continue;
    for (let j = 0; j < n; j++) IND_STATIC.push([IB(1.4, 1.2, 1.4, x + (j % 2) * 0.2, 0.8 + j * 1.2, z), [0.36, 0.25, 0.14]]);
  }
  for (let k = 0; k < 6; k++) IND_STATIC.push([new T.CylinderGeometry(0.42, 0.42, 1.3, 10).translate(rx1 - 1.5 - (k % 3) * 0.95, 0.85, iz1 - 2.5 - Math.floor(k / 3) * 0.95), [0.3, 0.16, 0.08]]);
  // Hofbeleuchtung
  for (const z of [iz0 + D * 0.25, iz0 + D * 0.75]) {
    IND_STATIC.push([IB(0.25, 8, 0.25, rx0 + 0.6, 4.2, z), iron]);
    addGlow(rx0 + 1.4, 8.2, z, [1.25, 0.8, 0.42], 2.2);
  }
  // Ladetor zur Straße, dort halten die Lieferwagen
  addSeg({ x: hcx, z: iz0 - 0.15, w: 7, d: 0.4, y0: 0.2, y1: 5.6, tint: [0.08, 0.075, 0.07], seed: 630, style: 3, dens: 0, flood: 0 }, false);
  addNeon(hcx, 6.1, iz0 - 0.3, 7.4, 0.1, 0.1, NEON.amber);
  DEPOTS.push({ x: hcx, z: b.z0, roadZ: b.z0 - 7, name: FACTORY_NAMES[idx % FACTORY_NAMES.length] });
  // Arbeiter: Rundgang im Hof und Leute an den Maschinen
  FACTORY_LOOPS.push({ pts: [[rx0 + 1.3, rz0 + 1], [rx1 - 1.3, rz0 + 1], [rx1 - 1.3, rz1 - 1], [rx0 + 1.3, rz1 - 1]], y: 0.22, per: 11, worker: true });
  FACTORY_IDLERS.push({ x: wallX + dir * (cL - 2), z: cz1 + 1.4, yaw: Math.PI }, { x: wallX + dir * (cL * 0.5), z: cz1 - 1.4, yaw: 0 }, { x: ex + dir * 2.4, z: ez, yaw: dir > 0 ? -Math.PI / 2 : Math.PI / 2 });
  FACTORIES.push({ b, gx: ycx, hx0, hx1, rx0, rx1, rz0, rz1, CH, wallX, dir, cz1, cL, ex, ez, ph: rf() * 100, cx: ycx, cz: (iz0 + iz1) / 2 });
}
export let indMeshes = null;
export function buildIndustry() {
  if (!FACTORIES.length) return;
  const mat = paintMat({ color: 0xffffff, metalness: 0.25, roughness: 0.78, envI: 0.35 });
  const st = new T.Mesh(mergeColored(IND_STATIC), paintMat({ color: 0xffffff, metalness: 0.2, roughness: 0.82, envI: 0.3, side: T.DoubleSide })); scene.add(st);
  const gm = new T.Mesh(mergeGeos(IND_GLASS), new T.MeshBasicMaterial({ color: new T.Color(0.62, 0.42, 0.22), side: T.DoubleSide })); scene.add(gm);
  const n = FACTORIES.length, iron = [0.5, 0.36, 0.1];
  const IM = (geo, count) => { const m = new T.InstancedMesh(geo, mat, count); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); return m; };
  const bridge = IM(mergeColored([[IB(1, 1.1, 1.0, 0, 0, 0.55), iron], [IB(1, 1.1, 1.0, 0, 0, -0.55), iron], [IB(1, 0.15, 2.2, 0, 0.6, 0), [0.6, 0.45, 0.12]]]), n);
  const trolley = IM(mergeColored([[IB(2.2, 1.2, 2.6, 0, 0.9, 0), [0.55, 0.38, 0.1]], [IB(1.2, 0.8, 1.2, 0, 0.0, 0), [0.15, 0.14, 0.13]]]), n);
  const cable = IM(mergeColored([[IB(0.06, 1, 0.06, -0.2, -0.5, 0), [0.1, 0.1, 0.1]], [IB(0.06, 1, 0.06, 0.2, -0.5, 0), [0.1, 0.1, 0.1]]]), n);
  const load = IM(mergeColored([[IB(0.7, 0.5, 0.4, 0, -0.25, 0), [0.6, 0.45, 0.12]], [IB(2.8, 1.6, 1.8, 0, -1.4, 0), [0.32, 0.22, 0.12]]]), n);
  const spokes = [[new T.TorusGeometry(2.1, 0.22, 8, 28).rotateY(Math.PI / 2), [0.12, 0.11, 0.11]], [new T.CylinderGeometry(0.35, 0.35, 0.6, 10).rotateZ(Math.PI / 2), [0.6, 0.45, 0.15]]];
  for (let k = 0; k < 6; k++) spokes.push([IB(0.14, 4.1, 0.2, 0, 0, 0).rotateX(k * Math.PI / 6), [0.14, 0.12, 0.11]]);
  const wheel = IM(mergeColored(spokes), n);
  const rod = IM(mergeColored([[IB(0.18, 0.18, 3.0, 0, 0, 0), [0.7, 0.68, 0.62]], [IB(0.5, 0.5, 0.6, 0, 0, 1.5), [0.2, 0.18, 0.16]]]), n);
  const crates = IM(mergeColored([[IB(0.9, 0.7, 0.9, 0, 0.35, 0), [0.42, 0.3, 0.16]]]), n * 5);
  indMeshes = { bridge, trolley, cable, load, wheel, rod, crates };
  // Rauch aus den Schloten
  const PER = 26, ns = SMOKE.length * PER, sp = new Float32Array(ns * 3), sph = new Float32Array(ns);
  SMOKE.forEach((o, i) => { for (let k = 0; k < PER; k++) { sp.set([o.x, o.y, o.z], (i * PER + k) * 3); sph[i * PER + k] = (k + Math.random() * 0.6) / PER; } });
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('phase', new T.BufferAttribute(sph, 1));
  const smoke = new T.Points(sg, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: `attribute float phase; uniform float uTime; uniform float uScale; uniform vec4 uWind; varying float vA; varying float vL;
      void main(){ float life = fract(uTime*0.03 + phase); float s = phase*57.0;
        float wk = life * (6.0 + uWind.z * 4.5 + uWind.w * 8.0);
        vec3 p = position + vec3(uWind.x * wk + sin(s + uTime*0.2)*life*3.0, (life*24.0 + life*life*10.0) * (1.25 - min(0.8, uWind.z / 10.0)), uWind.y * wk + cos(s*1.3 + uTime*0.17)*life*5.0);
        vec4 mv = modelViewMatrix*vec4(p,1.0); float d = -mv.z; vL = life;
        vA = (1.0 - life) * smoothstep(0.0, 0.06, life) * 0.3 * smoothstep(1800.0, 700.0, d) * smoothstep(2.0, 8.0, d);
        gl_PointSize = clamp((2.0 + life*11.0)*uScale/max(d,0.1), 1.5, 260.0); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; varying float vL; void main(){ float r = length(gl_PointCoord-0.5)*2.0; if(r>1.0) discard;
      vec3 c = mix(vec3(0.62, 0.32, 0.14), vec3(0.15, 0.16, 0.18), smoothstep(0.0, 0.25, vL));
      gl_FragColor = vec4(c, (1.0-r*r)*vA); }`,
  }));
  smoke.frustumCulled = false; smoke.renderOrder = 3; scene.add(smoke);
}
export function updateIndustry(t) {
  if (!indMeshes) return;
  const M = indMeshes, cp = camera.position;
  FACTORIES.forEach((f, i) => {
    if (Math.hypot(f.cx - cp.x, f.cz - cp.z) > 700 && f.done) return;
    f.done = true;
    const tt = t + f.ph;
    const bz = (f.rz0 + f.rz1) / 2 + Math.sin(tt * 0.11) * ((f.rz1 - f.rz0) / 2 - 2.5);
    const tx = (f.rx0 + f.rx1) / 2 + Math.sin(tt * 0.17 + 1.3) * ((f.rx1 - f.rx0) / 2 - 2);
    const hook = 3.2 + (1 + Math.sin(tt * 0.29)) * 2.6;
    _p.set((f.rx0 + f.rx1) / 2, f.CH + 0.9, bz); _q.identity(); _s.set(f.rx1 - f.rx0 + 0.6, 1, 1); M.bridge.setMatrixAt(i, _m.compose(_p, _q, _s));
    _p.set(tx, f.CH + 1.5, bz); _s.set(1, 1, 1); M.trolley.setMatrixAt(i, _m.compose(_p, _q, _s));
    const top = f.CH + 1.0, len = top - hook;
    _p.set(tx, top, bz); _s.set(1, len, 1); M.cable.setMatrixAt(i, _m.compose(_p, _q, _s));
    _p.set(tx, hook, bz); _s.set(1, 1, 1); _q.setFromAxisAngle(_up, Math.sin(tt * 0.4) * 0.3); M.load.setMatrixAt(i, _m.compose(_p, _q, _s));
    _q.setFromEuler(_e.set(tt * 1.6, 0, 0)); _p.set(f.ex - f.dir * 2.0, 2.5, f.ez - 1.2); M.wheel.setMatrixAt(i, _m.compose(_p, _q, _s));
    _q.identity(); _p.set(f.ex, 1.9, f.ez + 0.3 + Math.sin(tt * 1.6) * 1.0); M.rod.setMatrixAt(i, _m.compose(_p, _q, _s));
    for (let k = 0; k < 5; k++) {
      const u = ((tt * 0.9 + k * f.cL / 5) % f.cL);
      _p.set(f.wallX + f.dir * u, 1.23, f.cz1); M.crates.setMatrixAt(i * 5 + k, _m.compose(_p, _q, _s));
    }
  });
  for (const k in M) M[k].instanceMatrix.needsUpdate = true;
}

export const BRICK = [[0.46, 0.27, 0.2], [0.38, 0.24, 0.2], [0.3, 0.22, 0.2], [0.5, 0.36, 0.26]];
// Grundriss einer Turmstufe: Quader, Kreuz mit zurückgesetzten Ecken oder abgeschrägte Ecken (Achteck)
export function tier(x, z, w, d, y0, y1, seg, corner = 'square', c = 0, collide = true) {
  if (corner === 'square' || c < 1.2) { addSeg({ ...seg, x, z, w, d, y0, y1 }, collide); return; }
  // V23: Mittelstück und zwei Endkappen überlappen sich nicht mehr (früher zwei gekreuzte Quader mit deckungsgleichen
  // Dächern und Unterseiten: das flackerte). Innere Kanten bekommen keine dunkle Dachbrüstung (fl-Bits, siehe facade-shader.js).
  // Eckstücke (Fase, Rundung) liegen 12 cm tiefer bzw. höher, damit ihre Dächer nicht mit dem Kreuz kämpfen.
  const cross = cc => {
    addSeg({ ...seg, x, z, w, d: d - 2 * cc, y0, y1, fl: (seg.fl || 0) | FL.zN | FL.zP }, collide);
    for (const sz of [-1, 1]) addSeg({ ...seg, x, z: z + sz * (d / 2 - cc / 2), w: w - 2 * cc, d: cc, y0, y1, seed: seg.seed + 17, fl: (seg.fl || 0) | (sz < 0 ? FL.zP : FL.zN) }, collide);
  };
  const lo = Math.min(0.12, (y1 - y0) * 0.2), cy0 = y0 + lo, cy1 = y1 - lo;
  if (corner === 'round') {
    // Gerundete Ecken (Stromlinie) oder ganz rund (c = halbe Breite): Viertelkreise aus schmalen Fassadenstücken
    c = Math.min(c, w / 2, d / 2);
    if (d - 2 * c > 0.4 && w - 2 * c > 0.4) cross(c);
    else if (d - 2 * c > 0.4) addSeg({ ...seg, x, z, w, d: d - 2 * c, y0, y1 }, collide);
    else if (w - 2 * c > 0.4) addSeg({ ...seg, x, z, w: w - 2 * c, d, y0, y1, seed: seg.seed + 17 }, collide);
    if (collide) addCollider(x - w / 2 + c * 0.3, y0, z - d / 2 + c * 0.3, x + w / 2 - c * 0.3, y1, z + d / 2 - c * 0.3);
    const k = Math.max(2, Math.round(c * Math.PI / 2 / 3.4)), chord = 2 * c * Math.tan(Math.PI / 4 / k) + 0.06;
    const full = w - 2 * c <= 0.4 && d - 2 * c <= 0.4;   // ganz rund: die Keile sind das ganze Dach
    for (const [sx, sz, a0] of [[1, 1, 0], [1, -1, Math.PI / 2], [-1, -1, Math.PI], [-1, 1, Math.PI * 1.5]]) {
      const ox = x + sx * (w / 2 - c), oz = z + sz * (d / 2 - c);
      for (let j = 0; j < k; j++) {
        const a = a0 + (j + 0.5) * Math.PI / 2 / k, dx = Math.sin(a), dz = Math.cos(a), r = c * Math.cos(Math.PI / 4 / k);
        // Keile nebeneinander überlappen an der Spitze; ein ganz runder Bau bekommt eine eigene Dachscheibe
        addSeg({ ...seg, x: ox + dx * r / 2, z: oz + dz * r / 2, w: chord, d: r, y0: cy0, y1: full ? cy1 - 0.02 * (j % 2) : cy1, ry: a, seed: seg.seed + 31 + j, fl: (seg.fl || 0) | FL.xN | FL.xP | FL.zN }, false);
      }
    }
    if (full) addSeg({ ...seg, x, z, w: c * 1.41, d: c * 1.41, y0: y1 - 0.05, y1, ry: Math.PI / 4, seed: seg.seed + 30, fl: (seg.fl || 0) | FL.all | FL.noBot }, false);
    return;
  }
  cross(c);
  if (corner === 'chamfer') for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    // nach 45° gedreht zeigt lokal +z nach (1,1), -z nach (-1,-1), +x nach (1,-1), -x nach (-1,1): nur diese Kante ist außen
    const outer = sx > 0 ? (sz > 0 ? FL.zP : FL.xP) : (sz > 0 ? FL.xN : FL.zN);
    addSeg({ ...seg, x: x + sx * (w / 2 - c), z: z + sz * (d / 2 - c), w: c * 1.414, d: c * 1.414, y0: cy0, y1: cy1, ry: Math.PI / 4, seed: seg.seed + 29, fl: (seg.fl || 0) | (FL.all & ~outer) }, false);
  }
}
// Plastische Fassade: Pilaster zwischen den Fensterachsen (am Fensterraster des Shaders ausgerichtet) und Gurtgesimse
export function facadeRelief(cx, cz, sw, sd, y0, y1, style, tint, seed, edges, rr, corner, c) {
  const cw = style < 0.5 ? 3.2 : 2.4, margin = 1.0, pt = tint.map(v => v * 1.12);
  const every = rr() < 0.5 ? 2 : 3, deep = 0.35 + rr() * 0.25;
  for (const [side, ax, out] of [['n', 0, -1], ['s', 0, 1], ['w', 1, -1], ['e', 1, 1]]) {
    if (!edges[side]) continue;
    const L = ax ? sd : sw, usable = Math.max(L - 2 * margin, 1), nc = Math.max(1, Math.floor(usable / cw)), cellW = usable / nc;
    if (nc < 4) continue;
    for (let k = every; k <= nc - every; k += every) {
      const u = -L / 2 + margin + k * cellW;
      if (corner !== 'square' && Math.abs(u) > L / 2 - c - 0.5) continue;
      const px = ax ? cx + out * (sw / 2 + deep / 2) : cx + u, pz = ax ? cz + u : cz + out * (sd / 2 + deep / 2);
      addSeg({ x: px, z: pz, w: ax ? deep : 0.7, d: ax ? 0.7 : deep, y0, y1, tint: pt, seed, style: 3, dens: 0, flood: 0.0, deco: DECO.g++ }, false);
    }
  }
  if (rr() < 0.7) {
    const stepF = 3 + Math.floor(rr() * 4);
    for (let yy = y0 + 3.6 * stepF - 0.3; yy < y1 - 3; yy += 3.6 * stepF)
      tier(cx, cz, sw + 0.4, sd + 0.4, yy, yy + 0.3, { tint: pt, seed: seed + 3, style: 3, dens: 0, flood: 0.0, deco: DECO.g++ }, corner, bandC(corner, c, 0.4), false);
  }
}
