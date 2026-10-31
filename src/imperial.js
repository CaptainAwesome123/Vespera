import { T, MOBILE, R, scene, camera, mergeGeos, geoView, canvasTex, mulberry32, $ } from './core.js';
import { stdMat, ENV, addCollider } from './people-skeleton.js';
import { buildAirship } from './airships.js';
import { portMats, addPlatform, bx6, wallRun, wuv, spotPeds, pfLocal, VILLA, easeIO, TEAK, MAHOG, PLATE } from './harbour.js';
import { roundBox, lathe, tube, FURN, placeFurn, FAN_TEX } from './entrances.js';
import { wallpaperTex } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { wantTexture } from './assets.js';
import { BEL } from './belmont.js';
import { INTERACT } from './music.js';
import { player } from './player.js';
import { toast } from './boat.js';
import { driveExit } from './driving.js';
import { liftProfile } from './main.js';

/* =====================================================================
   V33: AURORA IMPERIAL – Alexanders privates Luftschiff
   250 m lange Hülle in Champagner und Gold, darunter eine begehbare Gondel mit zwei Decks
   wie eine Motorjacht: unten Achterdeck, Speisesalon, Treppenhalle, Bordküche, Mannschaftsmesse
   mit Funkraum und die Brücke; oben Alexanders Suite mit Marmorbad, Galerie, Bibliothek mit
   Arbeitszimmer und der große Salon mit Bar und Panoramafenstern. An Bord nur Personal und Piloten.
   Das Schiff kreuzt über der Stadt und macht auf Befehl am Ankermast des Belmont fest.
   Einsteigen: Rufsäule auf der Ballsaal-Terrasse des Belmont oder am Ankermast der Villa.
   Schiffskoordinaten: +x zum Bug, y nach oben, z quer (−z Backbord); Plattform dreht nur um y.
   ===================================================================== */
export const IMP = {
  g: null, pf: null, inner: null, farGlow: null, L: 250, R0: 26, st: 'cruise', s: 0.12, v: 9, b: null,
  curve: null, len: 1, lift: null, D: null, rooms: [], room: null, cullT: 0, said: 0, cmdSaid: 0,
};
export const IMP_CAPTAIN = ['Guten Abend, Sir. Die Aurora Imperial liegt ruhig in der Luft.', 'Wind aus Nordost, Sir, schwach. Sicht über der Stadt ausgezeichnet.', 'Die Motoren laufen auf halber Kraft, Sir. Wir kreuzen über Vespera.', 'Das Nordlicht steht heute hoch, Sir. Vom Salon aus sehen Sie es am besten.'];

// Selbstleuchten nach der eigenen Farbe: innen gibt es keine echten Lampen, die Räume tragen ihr warmes Licht im Material
export function impSelfLit(m, k) {
  m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${k.toFixed(3)};`); };
  m.customProgramCacheKey = () => 'impSL' + k.toFixed(3);
  return m;
}
/* ---------- Texturen ---------- */
// weißer Marmor mit grauen und goldenen Adern in Platten (bis das Foto geladen ist)
export function impMarbleTex() {
  const t = canvasTex(512, 512, (g, W) => {
    const rr = mulberry32(3301);
    g.fillStyle = '#ece7de'; g.fillRect(0, 0, W, W);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,255,255' : '160,150,140'},${rr() * 0.08})`; g.fillRect(rr() * W, rr() * W, 2 + rr() * 8, 2 + rr() * 8); }
    for (let k = 0; k < 34; k++) {
      const gold = k % 7 === 0; g.strokeStyle = gold ? `rgba(190,150,80,${0.25 + rr() * 0.2})` : `rgba(110,104,98,${0.12 + rr() * 0.22})`; g.lineWidth = gold ? 1.2 : 0.4 + rr() * 2.2;
      let x = rr() * W, y = rr() * W; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 6; s++) { const nx = x + (rr() - 0.3) * 160, ny = y + (rr() - 0.5) * 120; g.bezierCurveTo(x + (rr() - 0.5) * 80, y + (rr() - 0.5) * 80, nx + (rr() - 0.5) * 60, ny + (rr() - 0.5) * 60, nx, ny); x = nx; y = ny; }
      g.stroke();
    }
    g.strokeStyle = 'rgba(90,80,70,0.35)'; g.lineWidth = 1.2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, W); g.moveTo(0, i * 128); g.lineTo(W, i * 128); g.stroke(); }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// Bücherwand: Regalböden aus Mahagoni, Rücken in Ochsenblut, Petrol, Tannengrün, Leder und Schwarz mit Goldprägung
export function impBookTex() {
  const t = canvasTex(512, 512, (g, W) => {
    const rr = mulberry32(3302), pal = ['#5a1418', '#123a3c', '#1d3322', '#7a5530', '#16161a', '#3a2a4a', '#8a6a3a', '#2a1a12'];
    g.fillStyle = '#2a170c'; g.fillRect(0, 0, W, W);
    for (let r = 0; r < 4; r++) {
      const y0 = r * 128 + 10, y1 = r * 128 + 116; let x = 4;
      while (x < W - 8) {
        const w = 7 + rr() * 12, h = (y1 - y0) * (0.72 + rr() * 0.28), c = pal[(rr() * pal.length) | 0];
        if (rr() < 0.06) { x += 10; continue; }
        g.fillStyle = c; g.fillRect(x, y1 - h, w - 1, h);
        g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y1 - h, 1.5, h);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + w - 2.5, y1 - h, 1.5, h);
        g.fillStyle = 'rgba(214,170,90,0.75)'; for (const f of [0.12, 0.2, 0.82]) g.fillRect(x + 1, y1 - h + h * f, w - 3, 1.4);
        x += w;
      }
      g.fillStyle = '#4a2a14'; g.fillRect(0, r * 128 + 116, W, 12); g.fillStyle = 'rgba(214,170,90,0.5)'; g.fillRect(0, r * 128 + 116, W, 1.5);
    }
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// Globus: petrolfarbenes Meer, Kontinente in altem Pergament, goldene Gradnetzlinien
export function impGlobeTex() {
  return canvasTex(512, 256, (g, W, H) => {
    const rr = mulberry32(3303);
    g.fillStyle = '#1c4a4c'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 14; k++) { const cx = rr() * W, cy = 40 + rr() * (H - 80); g.fillStyle = '#c9b48a'; g.beginPath(); for (let a = 0; a < 6.3; a += 0.4) { const r = 18 + rr() * 30; g.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r); } g.fill(); }
    g.strokeStyle = 'rgba(214,170,90,0.6)'; g.lineWidth = 1; for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo(i * W / 12, 0); g.lineTo(i * W / 12, H); g.stroke(); } for (let j = 1; j < 6; j++) { g.beginPath(); g.moveTo(0, j * H / 6); g.lineTo(W, j * H / 6); g.stroke(); }
  });
}
// Fensterband für die Fernsicht: warme Scheiben mit Sprossen, Pfosten dazwischen
export function impWinTex() {
  const t = canvasTex(128, 64, (g, W, H) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffd9a0'); gr.addColorStop(1, '#e89850');
    g.fillStyle = gr; g.fillRect(14, 4, W - 28, H - 8);
    g.fillStyle = 'rgba(60,30,10,0.7)'; g.fillRect(W / 2 - 1.5, 4, 3, H - 8); g.fillRect(14, H * 0.32, W - 28, 2);
  });
  t.wrapS = T.RepeatWrapping; return t;
}

/* ---------- Materialien und Bausatz ---------- */
export let IMP_M = null;
export function impMats() {
  if (IMP_M) return IMP_M;
  const P = portMats(), vc = o => stdMat({ vertexColors: true, ...o });
  const marbleT = impMarbleTex(), silk = wallpaperTex('#d6c49c', 'rgba(150,108,42,0.42)'), books = impBookTex();
  silk.wrapS = silk.wrapT = T.RepeatWrapping;
  IMP_M = {
    paintX: vc({ map: PLATE.map, normalMap: PLATE.normal, normalScale: new T.Vector2(0.5, 0.5), roughness: 0.4, metalness: 0.35, envI: 0.8, emissive: 0x1c140a }),
    gold: impSelfLit(vc({ color: 0xd2aa5e, metalness: 1, roughness: 0.28, envI: 1.1 }), 0.12),
    steel: impSelfLit(vc({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.32, envI: 1.0 }), 0.08),
    wood: impSelfLit(vc({ map: MAHOG.map, normalMap: MAHOG.normal, roughness: 0.22, envI: 0.9 }), 0.3),
    panel: P.inWood,
    deck: impSelfLit(vc({ map: TEAK.map, normalMap: TEAK.normal, roughnessMap: TEAK.rough, roughness: 0.85, envI: 0.35 }), 0.12),
    silk: vc({ map: silk, roughness: 0.75, envI: 0.25, emissive: 0xffffff, emissiveMap: silk, emissiveIntensity: 0.5 }),
    marble: wantTexture(impSelfLit(vc({ map: marbleT, roughness: 0.14, envI: 1.1 }), 0.34), { map: 'marble-color', normalMap: 'marble-normal', roughnessMap: 'marble-rough', normalScale: 0.4, roughness: 0.35, color: 0xfffaf0 }),
    parquet: P.parquet,
    carpet: P.carpet,
    tile: P.tile,
    ceil: P.ceil,
    leather: impSelfLit(vc({ roughness: 0.42, envI: 0.6 }), 0.28),
    velvet: impSelfLit(vc({ roughness: 0.95, envI: 0.15, side: T.DoubleSide }), 0.42),
    linen: impSelfLit(vc({ roughness: 0.92, envI: 0.15, side: T.DoubleSide }), 0.45),
    enamel: impSelfLit(vc({ roughness: 0.3, envI: 0.7 }), 0.3),
    lacquer: impSelfLit(vc({ color: 0x08080a, roughness: 0.1, envI: 1.6 }), 0.04),
    iron: impSelfLit(vc({ color: 0x222226, metalness: 0.7, roughness: 0.4 }), 0.08),
    plant: impSelfLit(vc({ roughness: 0.9, envI: 0.1, side: T.DoubleSide }), 0.25),
    books: impSelfLit(vc({ map: books, roughness: 0.8, envI: 0.2 }), 0.42),
    globe: impSelfLit(vc({ map: impGlobeTex(), roughness: 0.3, envI: 0.8 }), 0.35),
    mirror: stdMat({ color: 0xe6ecef, metalness: 1, roughness: 0.03, envI: 2.2, emissive: 0x141210 }),
    water: new T.MeshStandardMaterial({ color: 0x2a6a6c, metalness: 0.4, roughness: 0.05, transparent: true, opacity: 0.7, envMap: ENV, envMapIntensity: 1.6, emissive: 0x0a2a2a }),
    glass: P.glass,
    lit: P.lit,
    fan: new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(1.4, 1.2, 0.9), depthWrite: false, side: T.DoubleSide }),
    winF: new T.MeshBasicMaterial({ map: impWinTex(), color: new T.Color(1.15, 0.85, 0.55), side: T.DoubleSide }),
  };
  return IMP_M;
}
// wie kit() im Hafen, nur mit den Materialien des Luftschiffs (je Material ein Netz, Farbe je Teil)
export function impKit() {
  const G = {};
  return {
    add(k, g, c = [1, 1, 1]) { (G[k] ||= []).push([g, c]); return g; },
    build(parent) {
      const M = impMats(), P = portMats();
      for (const k in G) {
        const geos = G[k].map(([g]) => { g = !g.attributes.normal && g.index ? g.toNonIndexed() : geoView(g); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
        const m = mergeGeos(geos), col = new Float32Array(m.attributes.position.count * 3); let o = 0;
        geos.forEach((g, i) => { const c = G[k][i][1]; for (let j = 0; j < g.attributes.position.count; j++) col.set(c, (o + j) * 3); o += g.attributes.position.count; });
        m.setAttribute('color', new T.BufferAttribute(col, 3));
        const mesh = new T.Mesh(m, M[k] || P[k]); if (k === 'glass' || k === 'water') mesh.renderOrder = 3; if (k === 'fan') mesh.renderOrder = 2;
        parent.add(mesh);
      }
    },
  };
}

/* ---------- Aufbau ---------- */
export function buildImperial() {
  const L = IMP.L, R0 = IMP.R0;
  const ship = buildAirship(L, R0, null, false, { passenger: true, name: 'AURORA IMPERIAL', hullColor: 0xead8ae, hullEmissive: 0x30220e, engScale: 2.2, noWin: true, emblem: FAN_TEX, engX: [-L * 0.14, L * 0.24] });
  const hr = ship.userData.hr;
  IMP.g = ship;
  // Grundriss (Schiffskoordinaten): Achterdeck XA..XT, geschlossene Gondel XT..XF, Breite 14 m
  const XA = -22, XT = -12, XF = 50, ZW = 7, ZI = 6.86;
  const yR = -hr(XT) + 1.6, fyA = yR - 3.5, fyB = fyA - 3.9, HB = fyA - fyB, HA = yR - fyA;
  const XH0 = 4, XH1 = 12, XG = 24, XM = 38, XS = 24;   // Speisesalon | Halle | Küche | Messe | Brücke  /  Suite | Galerie | Bibliothek | Salon
  IMP.D = { XA, XT, XF, ZW, yR, fyA, fyB, XH0, XH1 };
  const KO = impKit(), KI = impKit(), KF = impKit(), inner = new T.Group();
  const boxes = [], spots = [], bulbs = [], outBulbs = [];
  const WHITE = [0.9, 0.88, 0.82], MAID = [0.08, 0.08, 0.1], NAVY = [0.06, 0.07, 0.16], CAPT = [0.92, 0.9, 0.86], CHAMP = [0.93, 0.84, 0.66];
  const GL = [1.5, 1.05, 0.6], CANDLE = [1.6, 1.0, 0.45];
  const col = (x0, y0, z0, x1, y1, z1) => boxes.push(bx6(x0, y0, z0, x1, y1, z1));
  const bx = (K, k, w, h, d, x, y, z, c, sc = 1.5) => K.add(k, wuv(new T.BoxGeometry(w, h, d).translate(x, y, z), sc), c);
  const rb = (K, k, w, h, d, r, x, y, z, c) => K.add(k, roundBox(w, h, d, r).translate(x, y, z), c);
  const glow = (x, y, z, c = GL, s = 0.45) => bulbs.push({ p: [x, y, z], c, s, ph: 0, bl: 0 });
  const FMV = { up: 'velvet', frame: 'gold', wood: 'wood', lamp: 'lit', cloth: 'linen', leaf: 'plant' };
  const FML = { ...FMV, up: 'leather' };
  const fur = (parts, map, cols, x, y, z, a = 0) => placeFurn(parts, map, (k, g) => KI.add(k, g, cols[k] || [1, 1, 1]), x, y, z, a);
  const floorP = (k, x0, x1, z0, z1, y, sc = 2, c) => KI.add(k, wuv(new T.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y + 0.004, (z0 + z1) / 2), sc), c);
  const ceilP = (x0, x1, y, c = [1, 0.95, 0.85]) => {
    KI.add('ceil', new T.PlaneGeometry(x1 - x0, 2 * ZI).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y - 0.004, 0), c);
    // Kassetten aus Goldleisten und eine umlaufende Hohlkehle
    for (let x = x0 + 2; x < x1 - 0.5; x += 2) bx(KI, 'gold', 0.07, 0.08, 2 * ZI - 0.6, x, y - 0.045, 0);
    for (const s of [-1, 1]) { bx(KI, 'gold', x1 - x0, 0.08, 0.07, (x0 + x1) / 2, y - 0.045, s * (ZI - 0.3)); bx(KI, 'gold', x1 - x0, 0.18, 0.18, (x0 + x1) / 2, y - 0.09, s * (ZI - 0.08), [0.9, 0.85, 0.8]); }
  };
  const rug = (x, z, y, w, d, a = 0) => {
    KI.add('carpet', wuv(new T.BoxGeometry(w, 0.025, d).rotateY(a).translate(x, y + 0.013, z), 1.6));
    for (const s of [-1, 1]) { KI.add('gold', new T.BoxGeometry(w + 0.1, 0.03, 0.08).translate(0, 0, s * d / 2).rotateY(a).translate(x, y + 0.014, z)); KI.add('gold', new T.BoxGeometry(0.08, 0.03, d).translate(s * w / 2, 0, 0).rotateY(a).translate(x, y + 0.014, z)); }
  };
  const chand = (x, y, z, r = 0.7) => {
    KI.add('gold', new T.CylinderGeometry(0.025, 0.025, 0.6, 6).translate(x, y - 0.3, z));
    KI.add('gold', lathe([[0.18, 0], [0.12, -0.1], [0.06, -0.2]], 12).translate(x, y, z));
    for (const [rr2, dy] of [[r, -0.95], [r * 0.68, -1.2], [r * 0.38, -1.42]]) { KI.add('gold', new T.TorusGeometry(rr2, 0.022, 5, 24).rotateX(Math.PI / 2).translate(x, y + dy, z)); }
    KI.add('lit', lathe([[0.001, -1.75], [0.18, -1.6], [0.26, -1.35], [0.2, -1.12], [0.06, -1.0]], 14).translate(x, y, z), [1.5, 1.15, 0.75]);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; glow(x + Math.cos(a) * r, y - 0.88, z + Math.sin(a) * r, GL, 0.35); KI.add('glass', lathe([[0.001, 0], [0.04, 0.12], [0.001, 0.26]], 6).translate(x + Math.cos(a) * r, y - 1.25, z + Math.sin(a) * r)); }
    glow(x, y - 1.3, z, GL, 1.4);
  };
  const sconces = (x0, x1, y, step = 3.3) => { for (let x = x0 + step / 2; x < x1; x += step) for (const s of [-1, 1]) { KI.add('gold', lathe([[0.06, 0], [0.1, 0.12], [0.03, 0.25]], 10).rotateX(s * Math.PI / 2).translate(x, y, s * (ZI - 0.02))); glow(x, y + 0.12, s * (ZI - 0.12), GL, 0.4); } };
  const palm = (x, z, y, s = 2) => {
    KI.add('gold', lathe([[0.22, 0], [0.32, 0.08], [0.34, 0.5], [0.4, 0.58], [0.3, 0.6]].map(([r, h]) => [r * s * 0.6, h * s * 0.6]), 16).translate(x, y, z));
    KI.add('wood', new T.CylinderGeometry(0.035 * s, 0.05 * s, 0.9 * s, 6).translate(x, y + 0.36 * s + 0.45 * s, z), [0.5, 0.36, 0.22]);
    for (let k = 0; k < 9; k++) { const a = k * 2.4, l = 0.55 * s; KI.add('plant', new T.PlaneGeometry(l, 0.16 * s).translate(l / 2, 0, 0).rotateX(Math.PI / 2 + 0.3).rotateZ(-0.45 - (k % 3) * 0.18).rotateY(a).translate(x, y + 1.25 * s, z), [0.26, 0.46, 0.22]); }
  };
  const wardrobe = (x, z, y, w, a) => {
    const P = [[roundBox(w, 2.3, 0.62, 0.03).translate(0, 1.15, 0), 'wood', [0.7, 0.5, 0.35]], [new T.BoxGeometry(w + 0.08, 0.1, 0.7).translate(0, 2.33, 0), 'wood', [0.7, 0.5, 0.35]]];
    for (const s of [-1, 1]) P.push([new T.BoxGeometry(0.02, 0.32, 0.03).translate(s * 0.06, 1.15, 0.33), 'gold', [1, 1, 1]], [new T.BoxGeometry(w / 2 - 0.16, 1.9, 0.012).translate(s * w / 4, 1.2, 0.315), 'wood', [0.45, 0.3, 0.2]], [new T.BoxGeometry(w / 2 - 0.08, 1.98, 0.008).translate(s * w / 4, 1.2, 0.312), 'gold', [1, 1, 1]]);
    for (const [g, k, c] of P) KI.add(k, wuv(g.rotateY(a).translate(x, y, z), 1.2), c);
  };

  /* ================= Außenhülle der Gondel ================= */
  KO.add('paintX', roundBox(XF - XA + 0.6, 1.5, 2 * ZW + 0.4, 0.65).translate((XA + XF) / 2, fyB - 0.72, 0), CHAMP);
  bx(KO, 'gold', XF - XA + 0.2, 0.12, 0.36, (XA + XF) / 2, fyB - 1.5, 0);
  for (const s of [-1, 1]) {
    bx(KO, 'gold', XF - XA + 0.5, 0.14, 0.08, (XA + XF) / 2, fyB + 0.04, s * (ZW + 0.2));
    bx(KO, 'gold', XF - XT + 0.2, 0.3, 0.12, (XT + XF) / 2, fyA - 0.15, s * (ZW + 0.1));
    bx(KO, 'gold', XF - XT + 0.2, 0.12, 0.12, (XT + XF) / 2, yR - 0.06, s * (ZW + 0.1));
  }
  bx(KO, 'gold', 0.12, 0.3, 2 * ZW + 0.2, XF + 0.1, fyA - 0.15, 0);
  KO.add('paintX', roundBox(XF - XT + 0.4, 0.7, 2 * ZW + 0.3, 0.3).translate((XT + XF) / 2, yR + 0.3, 0), CHAMP);
  // Streben vom Gondeldach in den Rumpf, Goldsonne am Bug
  for (const x of [XT + 2, XT + 20, XT + 40, XF - 2]) for (const s of [-1, 1]) KO.add('gold', new T.CylinderGeometry(0.12, 0.16, 4.5, 6).rotateX(s * 0.5).translate(x, yR + 1.8, s * (ZW - 1.2)));

  /* ================= Böden und Decken (Kollision) ================= */
  col(XA, fyB - 0.6, -ZW, XF, fyB, ZW);
  col(XT, fyA - 0.3, -ZW, XH0 + 0.5, fyA, ZW);
  col(XH0 + 0.5, fyA - 0.3, -ZW, XH1 - 0.7, fyA, 2.3);
  col(XH1 - 0.7, fyA - 0.3, -ZW, XF, fyA, ZW);
  col(XT, yR, -ZW, XF, yR + 0.6, ZW);
  // Zwischendecke sichtbar (Unterseite = Decke unten, Oberseite = Boden oben)
  for (const [x0, x1, z0, z1] of [[XT, XH0 + 0.5, -ZI, ZI], [XH0 + 0.5, XH1 - 0.7, -ZI, 2.3], [XH1 - 0.7, XF, -ZI, ZI]]) bx(KI, 'iron', x1 - x0, 0.26, z1 - z0, (x0 + x1) / 2, fyA - 0.16, (z0 + z1) / 2, [0.5, 0.45, 0.4]);

  /* ================= Wände (Außenwände mit Fenstern, Innenwände) ================= */
  const oW = { outK: 'paintX', outC: CHAMP };
  const sideL = { ...oW, sill: 0.85, head: 2.85, win: 1.35, post: 0.32 }, sideU = { ...oW, sill: 0.75, head: 2.95, win: 1.35, post: 0.32 };
  const sides = (x0, x1, y0, h, o, inK, inC, doorsP = [], doorsS = []) => {
    wallRun(KO, boxes, x0, -ZW, x1, -ZW, y0, h, { ...o, out: -1, inK, inC, doors: doorsP });
    wallRun(KO, boxes, x0, ZW, x1, ZW, y0, h, { ...o, out: 1, inK, inC, doors: doorsS });
  };
  // unten
  sides(XT, XH0, fyB, HB, sideL, 'panel');
  sides(XH0, XH1, fyB, HB, sideL, 'marble', [0.96, 0.93, 0.86], [[6 - XH0, 8 - XH0]]);
  sides(XH1, XG, fyB, HB, sideL, 'tile');
  sides(XG, XM, fyB, HB, sideL, 'panel');
  sides(XM, XF, fyB, HB, { ...sideL, sill: 0.75, head: 3.1 }, 'panel');
  // oben
  sides(XT, XH0, fyA, HA, sideU, 'silk');
  sides(XH0, XH1, fyA, HA, sideU, 'silk');
  sides(XH1, XS, fyA, HA, sideU, 'panel');
  sides(XS, XF, fyA, HA, { ...sideU, sill: 0.55, head: 3.15 }, 'silk');
  // Bug: Panoramafenster auf beiden Decks; Heck: Glastüren aufs Achterdeck, oben Fenster der Suite
  const pano = { ...oW, sill: 0.7, head: 3.2, win: 1.25, post: 0.14 };
  wallRun(KO, boxes, XF, -ZW, XF, ZW, fyB, HB, { ...pano, out: -1, inK: 'panel' });
  wallRun(KO, boxes, XF, -ZW, XF, ZW, fyA, HA, { ...pano, sill: 0.45, head: 3.25, out: -1, inK: 'silk' });
  wallRun(KO, boxes, XT, -ZW, XT, ZW, fyB, HB, { ...oW, out: 1, inK: 'panel', sill: 0.5, head: 2.9, win: 1.2, post: 0.25, doors: [[ZW - 1.1, ZW + 1.1]] });
  wallRun(KO, boxes, XT, -ZW, XT, ZW, fyA, HA, { ...oW, out: 1, inK: 'silk', sill: 0.6, head: 3.0, win: 1.2, post: 0.22 });
  // Innenwände: Material je Seite (outK zeigt nach +x bzw. +z)
  const iw = (ax, az, bx2, bz, y0, h, kA, kB, doors) => wallRun(KO, boxes, ax, az, bx2, bz, y0, h, { outK: kA, outC: [1, 1, 1], inK: kB, inC: [1, 1, 1], windows: false, doors, out: ax === bx2 ? -1 : 1 });
  // (Wand quer zum Schiff: Strecke von −z nach +z, out −1 → outK zeigt nach +x)
  iw(XH0, -ZW, XH0, ZW, fyB, HB, 'marble', 'panel', [[ZW - 1, ZW + 1]]);
  iw(XH1, -ZW, XH1, ZW, fyB, HB, 'tile', 'marble', [[ZW - 0.8, ZW + 0.8]]);
  iw(XG, -ZW, XG, ZW, fyB, HB, 'panel', 'tile', [[ZW - 0.8, ZW + 0.8]]);
  iw(XM, -ZW, XM, ZW, fyB, HB, 'panel', 'panel', [[ZW - 0.8, ZW + 0.8]]);
  iw(XH0, -ZW, XH0, -3, fyA, HA, 'silk', 'marble');
  iw(XH0, -3, XH0, ZW, fyA, HA, 'silk', 'silk', [[0.4, 2.4]]);
  iw(XH1, -ZW, XH1, ZW, fyA, HA, 'panel', 'silk', [[ZW + 1.6, 2 * ZW + 0.1]]);
  iw(XS, -ZW, XS, ZW, fyA, HA, 'silk', 'panel', [[ZW - 1.2, ZW + 1.2]]);
  // Marmorbad in der Suite: Wand quer bei x = 0 (Tür), Längswand bei z = −3
  iw(0, -ZW, 0, -3, fyA, HA, 'marble', 'silk', [[1.5, 2.7]]);
  iw(0, -3, XH0, -3, fyA, HA, 'silk', 'marble');
  // Eingangstür in der Halle (Backbord): im Flug geschlossen
  bx(KO, 'wood', 2, 2.5, 0.08, 7, fyB + 1.25, -ZW + 0.02); bx(KO, 'glass', 1.4, 1.6, 0.1, 7, fyB + 1.5, -ZW + 0.02); bx(KO, 'gold', 2.1, 0.08, 0.12, 7, fyB + 2.52, -ZW + 0.02);
  KI.add('gold', new T.CylinderGeometry(0.02, 0.02, 0.5, 6).translate(7.7, fyB + 1.1, -ZW + 0.1));
  col(6, fyB, -ZW - 0.05, 8, fyB + 2.6, -ZW + 0.1);
  // Rahmen und Goldsonne über der Glastür zum Achterdeck
  KO.add('fan', new T.PlaneGeometry(2.6, 1.3).rotateY(-Math.PI / 2).translate(XT - 0.08, fyB + 2.9, 0));

  /* ================= Achterdeck (offen) ================= */
  KI.add('deck', wuv(new T.PlaneGeometry(XT - XA, 2 * ZW).rotateX(-Math.PI / 2).translate((XA + XT) / 2, fyB + 0.005, 0), 2.5));
  KO.add('deck', wuv(new T.PlaneGeometry(XT - XA, 2 * ZW).rotateX(-Math.PI / 2).translate((XA + XT) / 2, fyB + 0.003, 0), 2.5));
  // Reling: Goldpfosten, Handlauf, Glasfelder; als Kollision schmale Quader
  const rail = (ax, az, bx2, bz, y, h = 1.1) => {
    const len = Math.hypot(bx2 - ax, bz - az), ang = Math.atan2(-(bz - az), bx2 - ax), cx = (ax + bx2) / 2, cz = (az + bz) / 2;
    KO.add('gold', new T.CylinderGeometry(0.045, 0.045, len, 8).rotateZ(Math.PI / 2).rotateY(ang).translate(cx, y + h, cz));
    KO.add('gold', new T.BoxGeometry(len, 0.06, 0.06).rotateY(ang).translate(cx, y + 0.12, cz));
    KO.add('glass', new T.PlaneGeometry(len, h - 0.2).rotateY(ang).translate(cx, y + 0.12 + (h - 0.2) / 2, cz));
    const n = Math.max(1, Math.round(len / 1.5)); for (let k = 0; k <= n; k++) { const t = k / n; KO.add('gold', lathe([[0.06, 0], [0.04, 0.1], [0.035, h - 0.05], [0.06, h + 0.04]], 8).translate(ax + (bx2 - ax) * t, y, az + (bz - az) * t)); }
    col(Math.min(ax, bx2) - 0.08, y, Math.min(az, bz) - 0.08, Math.max(ax, bx2) + 0.08, y + h + 0.05, Math.max(az, bz) + 0.08);
  };
  rail(XA + 0.1, -ZW + 0.1, XA + 0.1, ZW - 0.1, fyB);
  rail(XA + 0.1, -ZW + 0.1, XT, -ZW + 0.1, fyB);
  rail(XA + 0.1, ZW - 0.1, XT, ZW - 0.1, fyB);
  for (const [x, z] of [[XA + 0.1, -ZW + 0.1], [XA + 0.1, ZW - 0.1], [XA + 0.1, 0], [XT - 0.2, -ZW + 0.1], [XT - 0.2, ZW - 0.1]]) { KO.add('gold', lathe([[0.1, 0], [0.12, 0.2], [0.14, 0.4], [0.08, 0.5]], 10).translate(x, fyB + 1.15, z)); outBulbs.push({ p: [x, fyB + 1.75, z], c: [1.5, 1.1, 0.6], s: 0.9, ph: 0, bl: 0 }); KO.add('lit', new T.SphereGeometry(0.14, 10, 8).translate(x, fyB + 1.75, z), [1.6, 1.2, 0.75]); }
  // Liegestühle mit Polstern, Bistrotische, Palmen
  const lounger = (x, z, a) => {
    const P = [[roundBox(1.9, 0.12, 0.7, 0.05).translate(0, 0.35, 0), 'wood'], [roundBox(1.75, 0.1, 0.64, 0.05).translate(0, 0.45, 0), 'linen'], [roundBox(0.8, 0.1, 0.64, 0.05).rotateZ(-0.7).translate(-0.95, 0.7, 0), 'linen']];
    for (const sx of [-0.8, 0.7]) for (const sz of [-0.3, 0.3]) P.push([new T.CylinderGeometry(0.03, 0.03, 0.32, 6).translate(sx, 0.16, sz), 'gold']);
    for (const [g, k] of P) KI.add(k, g.rotateY(a).translate(x, fyB, z), k === 'linen' ? [0.94, 0.9, 0.8] : [1, 1, 1]);
  };
  for (const x of [-20.2, -17.6, -15.0]) lounger(x, -4.8, Math.PI / 2 + 0.15);
  for (const [x, z] of [[-18.5, 3.6], [-14.6, 4.2]]) {
    fur(FURN.roundTable(0.4, 0.74, true), FMV, { linen: [0.94, 0.92, 0.88] }, x, fyB, z); fur(FURN.tableLamp(0.36), FMV, { lit: CANDLE }, x, fyB + 0.76, z); glow(x, fyB + 1.0, z, CANDLE, 0.3);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) fur(FURN.bistroChair(), FMV, { wood: [0.95, 0.8, 0.5] }, x + Math.sin(a) * 0.75, fyB, z + Math.cos(a) * 0.75, a + Math.PI);
    col(x - 0.45, fyB, z - 0.45, x + 0.45, fyB + 0.76, z + 0.45);
  }
  palm(XA + 1, -ZW + 1, fyB, 2); palm(XA + 1, ZW - 1, fyB, 2); palm(XT - 1, ZW - 1, fyB, 1.6);

  /* ================= Unteres Deck ================= */
  // ---- Speisesalon ----
  floorP('parquet', XT, XH0, -ZI, ZI, fyB, 2); ceilP(XT, XH0, fyA - 0.3); sconces(XT, XH0, fyB + 2.3);
  rug(-4, 0, fyB, 11, 3.6);
  KI.add('wood', roundBox(9.4, 0.09, 1.5, 0.04).translate(-4, fyB + 0.74, 0)); KI.add('linen', new T.BoxGeometry(9.0, 0.01, 0.5).translate(-4, fyB + 0.79, 0), [0.95, 0.93, 0.88]);
  for (const x of [-8.2, -5.4, -2.6, 0.2]) KI.add('wood', lathe([[0.24, 0], [0.12, 0.08], [0.07, 0.3], [0.1, 0.45], [0.06, 0.66], [0.2, 0.7]], 12).translate(x, fyB, 0));
  col(-8.8, fyB, -0.78, 0.8, fyB + 0.8, 0.78);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) fur(FURN.diningChair(), FMV, { velvet: [0.12, 0.33, 0.34], wood: [0.6, 0.4, 0.25] }, -7.6 + i * 1.2, fyB, s * 1.08, s > 0 ? Math.PI : 0);
  for (const s of [-1, 1]) { fur(FURN.diningChair(), FMV, { velvet: [0.12, 0.33, 0.34], wood: [0.6, 0.4, 0.25] }, s > 0 ? 1.4 : -9.4, fyB, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2); col(-8.8, fyB, s * 0.78, 0.8, fyB + 1.1, s * 1.45); }
  for (const x of [-7, -4, -1]) {
    KI.add('gold', lathe([[0.12, 0], [0.04, 0.05], [0.025, 0.35], [0.05, 0.38]], 10).translate(x, fyB + 0.79, 0));
    for (const dz of [-0.22, 0, 0.22]) { KI.add('linen', new T.CylinderGeometry(0.018, 0.018, 0.16, 6).translate(x, fyB + 1.25, dz), [0.98, 0.96, 0.9]); glow(x, fyB + 1.37, dz, CANDLE, 0.22); }
    KI.add('gold', new T.BoxGeometry(0.04, 0.03, 0.5).translate(x, fyB + 1.17, 0));
  }
  fur(FURN.vasePlant(0.8), FMV, { plant: [0.75, 0.12, 0.16] }, -5.5, fyB + 0.79, 0); fur(FURN.vasePlant(0.8), FMV, { plant: [0.92, 0.9, 0.85] }, -2.5, fyB + 0.79, 0);
  for (const s of [-1, 1]) { rb(KI, 'wood', 0.6, 0.92, 2.6, 0.03, XT + 0.42, fyB + 0.46, s * 4.1); bx(KI, 'gold', 0.64, 0.03, 2.64, XT + 0.42, fyB + 0.935, s * 4.1); col(XT, fyB, s * 4.1 - 1.3, XT + 0.75, fyB + 0.95, s * 4.1 + 1.3); fur(FURN.tableLamp(0.5), FMV, { lit: GL }, XT + 0.42, fyB + 0.95, s * 4.1 - 0.8); glow(XT + 0.42, fyB + 1.3, s * 4.1 - 0.8, GL, 0.4); }
  chand(-6.5, fyA - 0.3, 0); chand(-1.5, fyA - 0.3, 0);

  // ---- Treppenhalle mit der großen Treppe ----
  floorP('marble', XH0, XH1, -ZI, ZI, fyB, 3);
  for (let x = XH0 + 0.8; x < XH1; x += 1.6) for (let z = -ZI + 0.8; z < ZI; z += 1.6) KI.add('marble', new T.PlaneGeometry(0.42, 0.42).rotateX(-Math.PI / 2).rotateY(Math.PI / 4).translate(x, fyB + 0.008, z), [0.12, 0.12, 0.14]);
  ceilP(XH0, XH0 + 0.5, fyA - 0.3); ceilP(XH1 - 0.7, XH1, fyA - 0.3);
  KI.add('ceil', new T.PlaneGeometry(XH1 - XH0 - 1.2, ZI + 2.3).rotateX(Math.PI / 2).translate((XH0 + XH1 - 0.2) / 2, fyA - 0.304, (-ZI + 2.3) / 2), [1, 0.95, 0.85]);
  const NS = 18, SX0 = XH0 + 0.5, SX1 = XH1 - 0.7, run = (SX1 - SX0) / NS, rise = HB / NS, SZ0 = 2.4, SZ1 = ZI;
  for (let k = 0; k < NS; k++) {
    const x0 = SX0 + k * run, top = fyB + (k + 1) * rise;
    bx(KI, 'marble', run + 0.01, top - fyB, SZ1 - SZ0, x0 + run / 2, (top + fyB) / 2, (SZ0 + SZ1) / 2, [0.97, 0.95, 0.9], 2);
    bx(KI, 'marble', 0.05, 0.04, SZ1 - SZ0 + 0.04, x0 + 0.02, top - 0.02, (SZ0 + SZ1) / 2, [0.85, 0.82, 0.76]);
    KI.add('carpet', wuv(new T.PlaneGeometry(run, 2.6).rotateX(-Math.PI / 2).translate(x0 + run / 2, top + 0.006, (SZ0 + SZ1) / 2), 1.6));
    KI.add('gold', new T.CylinderGeometry(0.012, 0.012, 2.7, 5).rotateX(Math.PI / 2).translate(x0 + 0.06, top + 0.02, (SZ0 + SZ1) / 2));
    col(x0, fyB, SZ0, x0 + run, top, ZW);
    // Geländer an der offenen Seite, Kollision ab der Stufe
    KI.add('gold', lathe([[0.022, 0], [0.03, 0.08], [0.016, 0.2], [0.03, 0.55], [0.016, 0.9]], 6).translate(x0 + run / 2, top, SZ0 + 0.06));
    col(x0, top, SZ0 - 0.06, x0 + run, top + 1.0, SZ0 + 0.1);
  }
  col(SX1, fyA - 0.3, SZ0, SX1 + 0.75, fyA, ZW);   // Absatz oben
  KI.add('gold', tube([[SX0 - 0.1, fyB + 1.05, SZ0 + 0.06], [SX1, fyA + 0.98, SZ0 + 0.06]], 0.045, 8));
  KI.add('gold', tube([[SX0 - 0.1, fyB + 1.0, SZ1 - 0.06], [SX1, fyA + 0.95, SZ1 - 0.06]], 0.035, 8));
  KI.add('marble', lathe([[0.22, 0], [0.22, 0.12], [0.15, 0.2], [0.13, 1.0], [0.2, 1.1], [0.001, 1.12]], 14).translate(SX0 - 0.15, fyB, SZ0 + 0.06), [0.15, 0.15, 0.17]);
  KI.add('lit', new T.SphereGeometry(0.17, 12, 10).translate(SX0 - 0.15, fyB + 1.3, SZ0 + 0.06), [1.6, 1.25, 0.8]); glow(SX0 - 0.15, fyB + 1.3, SZ0 + 0.06, GL, 0.9);
  col(SX0 - 0.4, fyB, SZ0 - 0.2, SX0 + 0.05, fyB + 1.2, SZ0 + 0.3);
  // Brüstung oben um den Treppenschacht
  const bal = (ax, az, bx2, bz) => {
    const len = Math.hypot(bx2 - ax, bz - az), n = Math.round(len / 0.22);
    KI.add('gold', tube([[ax, fyA + 1.0, az], [bx2, fyA + 1.0, bz]], 0.04, 4));
    KI.add('marble', new T.BoxGeometry(Math.abs(bx2 - ax) + 0.14, 0.1, Math.abs(bz - az) + 0.14).translate((ax + bx2) / 2, fyA + 0.05, (az + bz) / 2), [0.95, 0.92, 0.86]);
    for (let k = 0; k <= n; k++) { const t = k / n; KI.add('gold', lathe([[0.02, 0], [0.035, 0.12], [0.015, 0.35], [0.032, 0.6], [0.015, 0.95]], 6).translate(ax + (bx2 - ax) * t, fyA + 0.05, az + (bz - az) * t)); }
    col(Math.min(ax, bx2) - 0.07, fyA, Math.min(az, bz) - 0.07, Math.max(ax, bx2) + 0.07, fyA + 1.05, Math.max(az, bz) + 0.07);
  };
  bal(SX0, 2.3, SX1, 2.3); bal(SX0, 2.3, SX0, ZI);
  // Halle unten: Goldsonne an der Wand, Palmen, Butler an der Tür
  KI.add('fan', new T.PlaneGeometry(4.2, 2.1).rotateY(-Math.PI / 2).translate(XH1 - 0.08, fyB + 2.3, -3.6));
  palm(XH0 + 0.9, -ZI + 0.9, fyB, 1.8); palm(XH1 - 0.9, -ZI + 0.9, fyB, 1.8);
  chand((SX0 + SX1) / 2, yR, 4.6, 0.9);
  spots.push({ lx: 5.4, ly: fyB, lz: -5.6, lyaw: 0.4, kind: 'livery', col: WHITE, act: 36.2 });

  // ---- Bordküche ----
  floorP('tile', XH1, XG, -ZI, ZI, fyB, 1.6); ceilP(XH1, XG, fyA - 0.3, [1, 1, 1]);
  for (const s of [-1, 1]) {
    bx(KI, 'enamel', XG - XH1 - 1.4, 0.9, 0.66, (XH1 + XG) / 2, fyB + 0.45, s * (ZI - 0.33), [0.93, 0.92, 0.88]);
    bx(KI, 'steel', XG - XH1 - 1.3, 0.05, 0.72, (XH1 + XG) / 2, fyB + 0.92, s * (ZI - 0.36));
    col(XH1 + 0.6, fyB, s > 0 ? ZI - 0.72 : -ZW, XG - 0.6, fyB + 0.95, s > 0 ? ZW : -ZI + 0.72);
    for (let x = XH1 + 1.2; x < XG - 1; x += 0.9) bx(KI, 'gold', 0.12, 0.02, 0.02, x, fyB + 0.8, s * (ZI - 0.67), [0.8, 0.8, 0.8]);
    // Geschirrbord unter den Fenstern, Töpfe und Teller
    for (let x = XH1 + 1.5; x < XG - 1.5; x += 1.3) { KI.add('gold', lathe([[0.001, 0], [0.13, 0], [0.14, 0.16], [0.15, 0.17]], 12).translate(x, fyB + 0.95, s * (ZI - 0.35)), [1, 0.62, 0.45]); KI.add('enamel', new T.CylinderGeometry(0.12, 0.12, 0.08, 14).translate(x + 0.45, fyB + 0.99, s * (ZI - 0.4)), [0.97, 0.97, 0.95]); }
  }
  // Herdblock in der Mitte mit Messingstange, Kupfertöpfen und Haube
  bx(KI, 'iron', 4.2, 0.88, 1.6, 18, fyB + 0.44, 0); bx(KI, 'steel', 4.3, 0.05, 1.7, 18, fyB + 0.9, 0);
  for (const s of [-1, 1]) KI.add('gold', new T.CylinderGeometry(0.025, 0.025, 4.3, 6).rotateZ(Math.PI / 2).translate(18, fyB + 0.7, s * 0.9));
  for (const [x, z, r] of [[16.6, -0.4, 0.2], [17.6, 0.35, 0.16], [18.8, -0.3, 0.24], [19.6, 0.4, 0.14]]) { KI.add('gold', lathe([[0.001, 0], [r, 0], [r, r * 1.1], [r + 0.015, r * 1.15]], 14).translate(x, fyB + 0.93, z), [1, 0.6, 0.42]); KI.add('iron', new T.TorusGeometry(r * 0.9, 0.02, 4, 16).rotateX(Math.PI / 2).translate(x, fyB + 0.925, z)); }
  KI.add('steel', new T.CylinderGeometry(0.7, 1.7, 0.9, 4, 1, true).rotateY(Math.PI / 4).scale(1.4, 1, 0.6).translate(18, fyA - 0.85, 0));
  col(15.8, fyB, -0.85, 20.2, fyB + 0.95, 0.85);
  for (let x = 14; x < 23; x += 3) { KI.add('lit', new T.CylinderGeometry(0.25, 0.3, 0.12, 14).translate(x, fyA - 0.4, s2(x)), [1.4, 1.35, 1.2]); glow(x, fyA - 0.5, s2(x), [1.4, 1.3, 1.1], 0.7); }
  function s2(x) { return x % 2 ? -2.8 : 2.8; }
  spots.push({ lx: 18, ly: fyB, lz: -1.55, lyaw: 0, kind: 'waiter', col: WHITE, act: 0.6 }, { lx: 14.6, ly: fyB, lz: -5.7, lyaw: Math.PI, kind: 'waiter', col: WHITE, act: 25.0 }, { lx: 21.6, ly: fyB, lz: 5.7, lyaw: 0, kind: 'waiter', col: WHITE, act: 29.0 });

  // ---- Mannschaftsmesse und Funkraum ----
  floorP('deck', XG, XM, -ZI, ZI, fyB, 2); ceilP(XG, XM, fyA - 0.3, [0.95, 0.92, 0.85]); sconces(XG, XM, fyB + 2.2, 4.4);
  for (const x of [25.6, 28.0, 30.4]) {
    for (const y of [0.42, 1.55]) { rb(KI, 'linen', 2.0, 0.18, 0.86, 0.06, x, fyB + y, ZI - 0.48, [0.94, 0.92, 0.86]); bx(KI, 'linen', 1.4, 0.06, 0.88, x - 0.25, fyB + y + 0.1, ZI - 0.48, [0.12, 0.16, 0.3]); }
    for (const dx of [-1.02, 1.02]) bx(KI, 'iron', 0.06, 2.0, 0.06, x + dx, fyB + 1.0, ZI - 0.92);
    bx(KI, 'iron', 2.1, 0.05, 0.92, x, fyB + 0.32, ZI - 0.48); bx(KI, 'iron', 2.1, 0.05, 0.92, x, fyB + 1.45, ZI - 0.48);
  }
  col(24.5, fyB, ZI - 0.95, 31.5, fyB + 2.0, ZW);
  for (let x = 25; x < 31; x += 0.62) { bx(KI, 'steel', 0.6, 2.0, 0.5, x + 0.3, fyB + 1.0, -ZI + 0.26, [0.4, 0.46, 0.44]); bx(KI, 'gold', 0.03, 0.12, 0.02, x + 0.5, fyB + 1.1, -ZI + 0.52); }
  col(24.8, fyB, -ZW, 31.4, fyB + 2.0, -ZI + 0.52);
  bx(KI, 'wood', 3.6, 0.07, 1.1, 34.4, fyB + 0.74, -3, [0.8, 0.7, 0.6]); for (const dx of [-1.5, 1.5]) bx(KI, 'iron', 0.08, 0.72, 0.8, 34.4 + dx, fyB + 0.37, -3);
  for (const dz of [-0.95, 0.95]) bx(KI, 'wood', 3.4, 0.07, 0.4, 34.4, fyB + 0.45, -3 + dz, [0.8, 0.7, 0.6]);
  col(32.6, fyB, -3.55, 36.2, fyB + 0.78, -2.45);
  KI.add('enamel', new T.CylinderGeometry(0.05, 0.04, 0.1, 10).translate(33.8, fyB + 0.83, -2.8), [0.95, 0.95, 0.92]); KI.add('enamel', new T.CylinderGeometry(0.05, 0.04, 0.1, 10).translate(35.1, fyB + 0.83, -3.2), [0.95, 0.95, 0.92]);
  // Funkgerät mit Skalen am Backbordfenster
  bx(KI, 'wood', 1.6, 0.76, 0.7, 36.8, fyB + 0.38, -ZI + 0.36); bx(KI, 'iron', 1.3, 0.6, 0.4, 36.8, fyB + 1.06, -ZI + 0.22);
  for (const dx of [-0.4, 0, 0.4]) { KI.add('lit', new T.CircleGeometry(0.07, 14).translate(36.8 + dx, fyB + 1.12, -ZI + 0.43), [0.9, 1.3, 0.7]); glow(36.8 + dx, fyB + 1.12, -ZI + 0.46, [0.8, 1.3, 0.6], 0.18); }
  col(35.9, fyB, -ZW, 37.7, fyB + 1.4, -ZI + 0.72);
  spots.push(
    { lx: 33.6, ly: fyB + 0.48, lz: -3.95, lyaw: 0, sit: true, kind: 'sailor', act: 7.8 },
    { lx: 35.2, ly: fyB + 0.48, lz: -2.05, lyaw: Math.PI, sit: true, kind: 'sailor', act: 7.2 },
    { lx: 34.0, ly: fyB + 0.48, lz: -2.05, lyaw: Math.PI, sit: true, kind: 'sailor', act: 31.6 },
    { lx: 27.2, ly: fyB, lz: 4.6, lyaw: Math.PI / 2, kind: 'sailor', act: 0.6 },
    { lx: 36.8, ly: fyB + 0.48, lz: -5.75, lyaw: Math.PI, sit: true, kind: 'police', col: NAVY, act: 7.3 },
  );

  // ---- Brücke ----
  floorP('deck', XM, XF, -ZI, ZI, fyB, 2); ceilP(XM, XF, fyA - 0.3, [0.95, 0.92, 0.85]);
  const hx = XF - 2.0;
  KI.add('gold', new T.TorusGeometry(0.46, 0.04, 6, 28).rotateY(Math.PI / 2).translate(hx, fyB + 1.15, 0));
  for (let k = 0; k < 8; k++) KI.add('gold', new T.CylinderGeometry(0.02, 0.02, 1.12, 4).rotateX(k / 8 * Math.PI).translate(hx, fyB + 1.15, 0));
  KI.add('wood', new T.CylinderGeometry(0.12, 0.12, 0.2, 10).rotateZ(Math.PI / 2).translate(hx + 0.12, fyB + 1.15, 0));
  bx(KI, 'wood', 0.45, 1.0, 0.6, hx + 0.38, fyB + 0.5, 0); col(hx + 0.12, fyB, -0.32, hx + 0.62, fyB + 1.05, 0.32);
  KI.add('gold', new T.TorusGeometry(0.36, 0.035, 6, 24).translate(XF - 4, fyB + 1.1, -2.6)); for (let k = 0; k < 6; k++) KI.add('gold', new T.CylinderGeometry(0.018, 0.018, 0.72, 4).rotateZ(k / 6 * Math.PI).translate(XF - 4, fyB + 1.1, -2.6));
  bx(KI, 'wood', 0.5, 0.9, 0.4, XF - 4, fyB + 0.45, -2.95); col(XF - 4.3, fyB, -3.2, XF - 3.7, fyB + 0.95, -2.7);
  for (const s of [-1, 1]) { KI.add('gold', lathe([[0.18, 0], [0.1, 0.08], [0.07, 0.95], [0.2, 1.05], [0.2, 1.3], [0.001, 1.34]], 14).translate(XF - 1.0, fyB, s * 1.7)); KI.add('enamel', new T.CircleGeometry(0.17, 18).rotateY(-Math.PI / 2).translate(XF - 1.21, fyB + 1.18, s * 1.7), [0.95, 0.93, 0.85]); glow(XF - 1.24, fyB + 1.18, s * 1.7, [1.3, 1.2, 0.9], 0.25); col(XF - 1.25, fyB, s * 1.7 - 0.22, XF - 0.75, fyB + 1.35, s * 1.7 + 0.22); }
  bx(KI, 'wood', 0.5, 0.65, 2 * ZI - 0.6, XF - 0.3, fyB + 0.33, 0);
  for (let z = -5.5; z <= 5.5; z += 1.1) { if (Math.abs(z) < 2.2) continue; KI.add('lit', new T.CircleGeometry(0.08, 14).rotateY(-Math.PI / 2).rotateZ(0).translate(XF - 0.56, fyB + 0.66, z), [1.2, 1.1, 0.75]); glow(XF - 0.58, fyB + 0.66, z, [1.2, 1.0, 0.6], 0.2); }
  col(XF - 0.6, fyB, -ZI, XF, fyB + 0.7, ZI);
  KI.add('gold', lathe([[0.25, 0], [0.12, 0.1], [0.1, 0.9], [0.24, 1.0], [0.001, 1.15]], 14).translate(XF - 4.6, fyB, 1.9)); col(XF - 4.85, fyB, 1.65, XF - 4.35, fyB + 1.1, 2.15);
  bx(KI, 'wood', 1.8, 0.88, 1.0, 42, fyB + 0.44, 4.4); KI.add('linen', new T.PlaneGeometry(1.6, 0.85).rotateX(-Math.PI / 2).translate(42, fyB + 0.885, 4.4), [0.88, 0.82, 0.64]);
  col(41.1, fyB, 3.9, 42.9, fyB + 0.9, 4.9);
  KI.add('lit', new T.CylinderGeometry(0.22, 0.3, 0.16, 12).translate(42, fyA - 0.6, 4.4), [1.2, 1.3, 1.1]); glow(42, fyA - 0.7, 4.4, [1.2, 1.25, 1.0], 0.6);
  spots.push(
    { lx: hx - 0.52, ly: fyB, lz: 0, lyaw: Math.PI / 2, kind: 'police', col: NAVY, act: 33.5 },
    { lx: XF - 4, ly: fyB, lz: -2.08, lyaw: Math.PI, kind: 'police', col: NAVY, act: 33.5 },
    { lx: 42, ly: fyB, lz: 3.4, lyaw: 0, kind: 'police', col: NAVY, act: 28.4 },
    { lx: XF - 5.4, ly: fyB, lz: 0.9, lyaw: Math.PI / 2 - 0.25, kind: 'police', col: CAPT, act: 0.6 },
    { lx: -13.1, ly: fyB, lz: 2.4, lyaw: -Math.PI / 2, kind: 'waiter', col: WHITE, act: 0.6 },
    { lx: -10.9, ly: fyB, lz: -3.6, lyaw: Math.PI / 2, kind: 'waiter', col: WHITE, act: 0.1 },
  );

  /* ================= Oberes Deck ================= */
  // ---- Alexanders Suite ----
  floorP('parquet', XT, 0, -ZI, ZI, fyA, 2); floorP('parquet', 0, XH0, -3, ZI, fyA, 2); ceilP(XT, XH0, yR); sconces(XT, 0, fyA + 2.2, 4);
  rug(-5.2, 0, fyA, 5.2, 4.6);
  // Bett mit freistehendem Kopfteil in Samt und Gold, Nachttische, Bank am Fußende
  rb(KI, 'wood', 2.5, 0.4, 2.3, 0.06, -5, fyA + 0.2, 0, [0.7, 0.5, 0.35]);
  rb(KI, 'linen', 2.4, 0.26, 2.2, 0.1, -5, fyA + 0.52, 0, [0.96, 0.94, 0.9]);
  rb(KI, 'velvet', 1.8, 0.08, 2.26, 0.03, -5.35, fyA + 0.67, 0, [0.85, 0.72, 0.48]);
  for (const z of [-0.5, 0.5]) rb(KI, 'linen', 0.42, 0.18, 0.85, 0.08, -3.95, fyA + 0.74, z, [0.97, 0.96, 0.93]);
  rb(KI, 'velvet', 0.16, 1.9, 2.9, 0.06, -3.62, fyA + 0.95, 0, [0.1, 0.3, 0.31]);
  bx(KI, 'gold', 0.2, 0.08, 3.0, -3.62, fyA + 1.92, 0); for (const s of [-1, 1]) bx(KI, 'gold', 0.2, 1.95, 0.08, -3.62, fyA + 0.97, s * 1.47);
  KI.add('fan', new T.PlaneGeometry(1.6, 0.8).rotateY(-Math.PI / 2).translate(-3.72, fyA + 1.5, 0));
  col(-6.3, fyA, -1.2, -3.5, fyA + 0.7, 1.2); col(-3.75, fyA, -1.5, -3.5, fyA + 1.95, 1.5);
  for (const s of [-1, 1]) { rb(KI, 'wood', 0.55, 0.6, 0.5, 0.03, -4.0, fyA + 0.3, s * 1.75, [0.7, 0.5, 0.35]); fur(FURN.tableLamp(0.55), FMV, { lit: GL }, -4.0, fyA + 0.6, s * 1.75); glow(-4.0, fyA + 1.0, s * 1.75, GL, 0.4); }
  rb(KI, 'velvet', 0.5, 0.45, 1.8, 0.06, -6.6, fyA + 0.23, 0, [0.1, 0.3, 0.31]);
  // Sitzecke am Heckfenster mit Blick aufs Achterdeck
  for (const s of [-1, 1]) fur(FURN.clubChair(), FMV, { velvet: [0.86, 0.76, 0.56] }, XT + 1.4, fyA, s * 2.4, -Math.PI / 2 + s * 0.35);
  fur(FURN.roundTable(0.38, 0.55), FMV, { wood: [0.7, 0.5, 0.35] }, XT + 1.5, fyA, 0); KI.add('glass', lathe([[0.001, 0], [0.06, 0.02], [0.03, 0.3], [0.05, 0.36]], 8).translate(XT + 1.5, fyA + 0.55, 0.1));
  // Schreibtisch der Dame / Frisiertisch mit Spiegel am Backbordfenster
  rb(KI, 'wood', 1.6, 0.06, 0.6, 0.02, -8.2, fyA + 0.76, -ZI + 0.35, [0.7, 0.5, 0.35]); for (const dx of [-0.7, 0.7]) bx(KI, 'wood', 0.08, 0.74, 0.5, -8.2 + dx, fyA + 0.37, -ZI + 0.35, [0.7, 0.5, 0.35]);
  fur(FURN.diningChair(), FMV, { velvet: [0.86, 0.76, 0.56], wood: [0.7, 0.5, 0.35] }, -8.2, fyA, -ZI + 1.05, Math.PI);
  col(-9.05, fyA, -ZW, -7.35, fyA + 0.8, -ZI + 0.68);
  // Kleiderschränke an der Wand zur Galerie
  for (const z of [1.6, 4.6]) { wardrobe(XH0 - 0.38, z, fyA, 2.8, -Math.PI / 2); }
  col(XH0 - 0.75, fyA, 0.15, XH0, fyA + 2.4, ZI);
  chand(-5, yR, 0, 0.8);
  // Marmorbad: frei stehende Wanne mit Goldarmatur, Waschtisch mit Spiegel
  floorP('marble', 0, XH0, -ZI, -3, fyA, 1.5);
  rb(KI, 'marble', 1.9, 0.62, 0.92, 0.2, 2.0, fyA + 0.31, -5.75, [0.98, 0.97, 0.94]);
  KI.add('water', new T.PlaneGeometry(1.6, 0.66).rotateX(-Math.PI / 2).translate(2.0, fyA + 0.5, -5.75));
  for (const dx of [-0.75, 0.75]) for (const dz of [-0.32, 0.32]) KI.add('gold', new T.SphereGeometry(0.07, 8, 6).translate(2.0 + dx, fyA + 0.05, -5.75 + dz));
  KI.add('gold', tube([[2.95, fyA + 0.62, -5.75], [3.1, fyA + 0.95, -5.75], [2.85, fyA + 1.0, -5.75]], 0.03, 8));
  col(1.0, fyA, -6.25, 3.0, fyA + 0.64, -5.25);
  rb(KI, 'marble', 0.55, 0.12, 1.6, 0.03, XH0 - 0.3, fyA + 0.85, -4.6, [0.15, 0.15, 0.17]); bx(KI, 'gold', 0.06, 0.78, 0.06, XH0 - 0.45, fyA + 0.4, -4.0); bx(KI, 'gold', 0.06, 0.78, 0.06, XH0 - 0.45, fyA + 0.4, -5.2);
  KI.add('enamel', lathe([[0.001, 0], [0.18, 0.02], [0.22, 0.12], [0.24, 0.13]], 16).translate(XH0 - 0.3, fyA + 0.88, -4.6), [0.98, 0.98, 0.96]);
  KI.add('mirror', new T.PlaneGeometry(1.4, 1.2).rotateY(-Math.PI / 2).translate(XH0 - 0.08, fyA + 1.75, -4.6));
  bx(KI, 'gold', 0.04, 1.3, 0.06, XH0 - 0.08, fyA + 1.75, -5.32); bx(KI, 'gold', 0.04, 1.3, 0.06, XH0 - 0.08, fyA + 1.75, -3.88);
  glow(XH0 - 0.2, fyA + 2.5, -4.6, GL, 0.6); col(XH0 - 0.6, fyA, -5.4, XH0, fyA + 0.95, -3.8);
  palm(0.6, -6.3, fyA, 1.2);
  spots.push({ lx: -7.6, ly: fyA, lz: 3.2, lyaw: 1.1, kind: 'dress', col: MAID, act: 24.0 });

  // ---- Galerie über der Treppe ----
  floorP('marble', XH0, XH1, -ZI, 2.3, fyA, 3); floorP('marble', SX1, XH1, 2.3, ZI, fyA, 3); ceilP(XH0, XH1, yR);
  bx(KI, 'wood', 1.8, 0.85, 0.5, 8, fyA + 0.42, -ZI + 0.27); bx(KI, 'gold', 1.85, 0.03, 0.55, 8, fyA + 0.86, -ZI + 0.27);
  fur(FURN.vasePlant(1.1), FMV, { plant: [0.9, 0.85, 0.75] }, 8, fyA + 0.87, -ZI + 0.27); col(7.05, fyA, -ZW, 8.95, fyA + 0.9, -ZI + 0.55);
  KI.add('fan', new T.PlaneGeometry(3.4, 1.7).translate(8, fyA + 2.35, -ZI + 0.06));
  spots.push({ lx: 9.4, ly: fyA, lz: -1.4, lyaw: 0.2, kind: 'livery', col: WHITE, act: 36.2 });

  // ---- Bibliothek und Arbeitszimmer ----
  floorP('parquet', XH1, XS, -ZI, ZI, fyA, 2); ceilP(XH1, XS, yR, [0.9, 0.85, 0.75]); rug(18, 0.6, fyA, 6, 4.4);
  const shelf = (x, z0, z1, a) => {
    const w = z1 - z0, cz = (z0 + z1) / 2;
    bx(KI, 'wood', 0.42, HA - 0.25, w, x, fyA + (HA - 0.25) / 2, cz, [0.6, 0.4, 0.26]);
    KI.add('books', (() => { const g = new T.PlaneGeometry(w - 0.1, HA - 0.6).rotateY(a).translate(x + Math.sin(a) * 0.215, fyA + 0.3 + (HA - 0.6) / 2, cz); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * (w - 0.1) / 1.6, u.getY(i) * (HA - 0.6) / 1.6); return g; })());
    col(x - 0.22, fyA, z0, x + 0.22, fyA + HA, z1);
  };
  shelf(XS - 0.25, -ZI, -1.4, -Math.PI / 2); shelf(XS - 0.25, 1.4, ZI, -Math.PI / 2); shelf(XH1 + 0.25, -ZI, 1.4, Math.PI / 2);
  // Schreibtisch mit grünem Lederfeld, Bankerlampe, Sessel; Globus, Fernrohr am Fenster
  rb(KI, 'wood', 2.3, 0.08, 1.15, 0.03, 17, fyA + 0.76, -3.6, [0.6, 0.38, 0.24]); KI.add('leather', new T.PlaneGeometry(1.7, 0.7).rotateX(-Math.PI / 2).translate(17, fyA + 0.802, -3.6), [0.08, 0.24, 0.18]);
  for (const dx of [-0.85, 0.85]) bx(KI, 'wood', 0.5, 0.74, 1.0, 17 + dx, fyA + 0.37, -3.6, [0.6, 0.38, 0.24]);
  col(15.8, fyA, -4.2, 18.2, fyA + 0.82, -3.0);
  KI.add('gold', lathe([[0.08, 0], [0.02, 0.03], [0.015, 0.3]], 8).translate(17.7, fyA + 0.8, -3.9)); KI.add('lit', new T.CylinderGeometry(0.12, 0.12, 0.3, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).translate(17.7, fyA + 1.12, -3.9), [0.25, 1.0, 0.5]); glow(17.7, fyA + 1.05, -3.9, [0.6, 1.2, 0.6], 0.45);
  fur(FURN.clubChair(), FML, { leather: [0.36, 0.08, 0.07] }, 17, fyA, -4.75, 0);
  for (const [dx, c] of [[-0.5, [0.95, 0.94, 0.9]], [0.3, [0.2, 0.1, 0.05]]]) bx(KI, 'linen', 0.3, 0.02, 0.4, 17 + dx, fyA + 0.81, -3.4, c);
  KI.add('gold', lathe([[0.25, 0], [0.04, 0.06], [0.03, 0.7], [0.06, 0.78]], 10).translate(21.6, fyA, -5.4)); KI.add('globe', new T.SphereGeometry(0.34, 24, 16).translate(21.6, fyA + 1.12, -5.4)); KI.add('gold', new T.TorusGeometry(0.38, 0.015, 4, 28).rotateY(0.4).translate(21.6, fyA + 1.12, -5.4)); col(21.2, fyA, -5.8, 22, fyA + 1.4, -5.0);
  for (const a of [0, 2.1, 4.2]) KI.add('gold', new T.CylinderGeometry(0.015, 0.015, 1.3, 5).translate(0, -0.65, 0).rotateX(0.32).rotateY(a).translate(21.8, fyA + 1.25, 5.6));
  KI.add('gold', new T.CylinderGeometry(0.06, 0.09, 1.1, 10).rotateZ(Math.PI / 2 - 0.3).rotateY(-0.9).translate(21.8, fyA + 1.4, 5.6));
  fur(FURN.sofa(2.8), FML, { leather: [0.36, 0.08, 0.07] }, 17.6, fyA, 3.2, Math.PI); col(16.1, fyA, 2.7, 19.1, fyA + 0.9, 3.75);
  for (const s of [-1, 1]) fur(FURN.clubChair(), FML, { leather: [0.36, 0.08, 0.07] }, 17.6 + s * 2.4, fyA, 1.0, s * -Math.PI / 2 + Math.PI);
  rb(KI, 'wood', 1.4, 0.06, 0.8, 0.03, 17.6, fyA + 0.45, 1.3, [0.6, 0.38, 0.24]); bx(KI, 'wood', 1.2, 0.4, 0.6, 17.6, fyA + 0.22, 1.3, [0.5, 0.3, 0.2]);
  KI.add('glass', lathe([[0.001, 0], [0.07, 0.01], [0.07, 0.16], [0.03, 0.22], [0.04, 0.3]], 10).translate(17.3, fyA + 0.48, 1.2)); KI.add('glass', lathe([[0.001, 0], [0.04, 0.01], [0.04, 0.08]], 8).translate(17.8, fyA + 0.48, 1.4));
  fur(FURN.floorLamp(1.7), FMV, { lit: GL }, 15.2, fyA, 5.6); glow(15.2, fyA + 1.6, 5.6, GL, 0.6);
  chand(18, yR, 0, 0.75);
  spots.push({ lx: 18.6, ly: fyA, lz: -2.6, lyaw: Math.PI + 0.5, kind: 'suit', act: 28.4 });

  // ---- Großer Salon mit Bar und Panoramafenstern ----
  floorP('parquet', XS, XF, -ZI, ZI, fyA, 2); ceilP(XS, XF, yR);
  rug(31, -2.2, fyA, 6, 4.4); rug(39, 1.0, fyA, 5.4, 5.2); rug(46.2, 0, fyA, 4.4, 6.8);
  // Bar an Steuerbord: Tresen mit Goldkante und Fächerfeldern, Rückbuffet mit leuchtenden Flaschen und Spiegel
  rb(KI, 'wood', 6.2, 1.08, 0.7, 0.05, 29.2, fyA + 0.54, 4.6, [0.55, 0.32, 0.18]); bx(KI, 'marble', 6.4, 0.06, 0.82, 29.2, fyA + 1.11, 4.6, [0.12, 0.12, 0.14]);
  for (let k = 0; k < 5; k++) KI.add('fan', new T.PlaneGeometry(1.0, 0.5).rotateY(Math.PI).translate(26.8 + k * 1.2, fyA + 0.62, 4.24));
  col(26.1, fyA, 4.25, 32.3, fyA + 1.15, 4.95);
  bx(KI, 'wood', 6.2, 0.9, 0.5, 29.2, fyA + 0.45, ZI - 0.25, [0.55, 0.32, 0.18]); KI.add('mirror', new T.PlaneGeometry(6, 1.6).rotateY(Math.PI).translate(29.2, fyA + 1.85, ZI - 0.04));
  for (const y of [1.15, 1.6, 2.05]) bx(KI, 'glass', 6.0, 0.03, 0.28, 29.2, fyA + y, ZI - 0.2);
  for (let k = 0; k < 30; k++) { const x = 26.5 + (k % 10) * 0.6, y = fyA + [0.92, 1.18, 1.63][(k / 10) | 0], c = [[0.5, 1.2, 0.5], [1.6, 0.8, 0.3], [1.5, 1.25, 0.8], [1.3, 0.4, 0.35]][k % 4]; KI.add('lit', lathe([[0.04, 0], [0.04, 0.2], [0.015, 0.26], [0.015, 0.32]], 8).translate(x, y, ZI - 0.2), c); }
  for (const x of [27, 29.2, 31.4]) glow(x, fyA + 1.4, ZI - 0.25, [1.5, 1.0, 0.5], 0.8);
  col(26.1, fyA, ZI - 0.55, 32.3, fyA + 2.5, ZW);
  for (let k = 0; k < 5; k++) fur(FURN.barStool(), FMV, { velvet: [0.1, 0.3, 0.31] }, 26.8 + k * 1.2, fyA, 3.85);
  KI.add('gold', lathe([[0.001, 0], [0.11, 0.02], [0.13, 0.25], [0.12, 0.27]], 14).translate(28, fyA + 1.14, 4.6)); KI.add('glass', new T.CylinderGeometry(0.035, 0.035, 0.32, 8).translate(28.02, fyA + 1.4, 4.62), [0.2, 0.6, 0.25]);
  for (const dx of [0.6, 0.9]) KI.add('glass', lathe([[0.001, 0], [0.04, 0.005], [0.006, 0.02], [0.006, 0.12], [0.05, 0.2]], 8).translate(28 + dx, fyA + 1.14, 4.55));
  // Sitzgruppen: Samtsofas in Petrol, Sessel in Champagner, Glastische
  const group = (x, z, a, n2 = 2) => {
    // Sofa hinter der Mitte, Blick zur Mitte (Möbel schauen bei Drehung a nach (sin a, cos a)); Sessel links und rechts, zur Mitte gedreht
    fur(FURN.sofa(3.0), FMV, { velvet: [0.1, 0.32, 0.33] }, x - Math.sin(a) * 1.3, fyA, z - Math.cos(a) * 1.3, a);
    for (let k = 0; k < n2; k++) { const s = k ? 1 : -1, cx = x + Math.cos(a) * s * 1.8, cz = z - Math.sin(a) * s * 1.8; fur(FURN.clubChair(), FMV, { velvet: [0.88, 0.78, 0.58] }, cx, fyA, cz, Math.atan2(-s * Math.cos(a), s * Math.sin(a))); col(cx - 0.45, fyA, cz - 0.45, cx + 0.45, fyA + 0.8, cz + 0.45); }
    rb(KI, 'glass', 1.3, 0.04, 0.7, 0.02, x, fyA + 0.45, z); KI.add('gold', new T.BoxGeometry(1.2, 0.42, 0.6).translate(x, fyA + 0.22, z), [0.5, 0.42, 0.3]);
    KI.add('linen', lathe([[0.001, 0], [0.09, 0.02], [0.07, 0.18], [0.09, 0.22]], 12).translate(x + 0.3, fyA + 0.47, z), [0.95, 0.9, 0.8]); fur(FURN.vasePlant(0.5), FMV, { plant: [0.85, 0.2, 0.25] }, x - 0.35, fyA + 0.47, z);
    const sx = x - Math.sin(a) * 1.3, sz = z - Math.cos(a) * 1.3, ca = Math.abs(Math.cos(a)) > 0.5; col(sx - (ca ? 1.6 : 0.55), fyA, sz - (ca ? 0.55 : 1.6), sx + (ca ? 1.6 : 0.55), fyA + 0.85, sz + (ca ? 0.55 : 1.6));
    col(x - 0.65, fyA, z - 0.35, x + 0.65, fyA + 0.48, z + 0.35);
  };
  group(31, -2.6, 0); group(39, 1.2, Math.PI); group(45.6, 0, Math.PI / 2);
  // Flügel: schwarzer Lack, Deckel offen, Tasten, Bank
  {
    const sh = new T.Shape(); sh.moveTo(0, -0.75); sh.lineTo(0, 0.75); sh.lineTo(0.6, 0.75); sh.bezierCurveTo(1.3, 0.75, 1.4, 0.2, 1.8, 0.05); sh.bezierCurveTo(2.25, -0.1, 2.2, -0.75, 1.6, -0.75); sh.lineTo(0, -0.75);
    const body = new T.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 10 }).rotateX(Math.PI / 2), px = 41.8, pz = -4.6, py = fyA + 0.98;
    KI.add('lacquer', body.clone().translate(px, py, pz));
    KI.add('lacquer', new T.ExtrudeGeometry(sh, { depth: 0.025, bevelEnabled: false, curveSegments: 10 }).rotateX(Math.PI / 2).translate(0, 0, 0.75).rotateX(-0.6).translate(0, 0, -0.75).translate(px, py + 0.02, pz));
    KI.add('gold', new T.CylinderGeometry(0.01, 0.01, 0.72, 4).rotateX(0.0).translate(px + 1.2, py + 0.35, pz - 0.3));
    for (const [dx, dz] of [[0.2, -0.6], [0.2, 0.6], [1.7, -0.45]]) KI.add('lacquer', lathe([[0.06, 0], [0.05, 0.1], [0.07, 0.66]], 10).translate(px + dx, fyA, pz + dz));
    bx(KI, 'enamel', 0.16, 0.04, 1.3, px - 0.08, py - 0.26, pz, [0.97, 0.96, 0.92]); for (let k = 0; k < 18; k++) bx(KI, 'lacquer', 0.09, 0.025, 0.025, px - 0.06, py - 0.225, pz - 0.6 + k * 0.07);
    rb(KI, 'lacquer', 0.4, 0.06, 0.9, 0.02, px - 0.75, fyA + 0.48, pz); bx(KI, 'lacquer', 0.3, 0.45, 0.8, px - 0.75, fyA + 0.23, pz);
    col(px - 0.15, fyA, pz - 0.8, px + 2.25, fyA + 1.05, pz + 0.8);
    fur(FURN.vasePlant(0.6), FMV, { plant: [0.92, 0.9, 0.86] }, px + 1.1, py + 0.02, pz + 0.3);
  }
  palm(XS + 0.9, -ZI + 0.9, fyA, 2.0); palm(XF - 0.9, -ZI + 0.9, fyA, 1.8); palm(XF - 0.9, ZI - 0.9, fyA, 1.8); palm(34.5, ZI - 0.8, fyA, 1.6);
  for (const [x, z] of [[35, -5.8], [43.5, 5.8], [27.5, -5.8]]) { fur(FURN.floorLamp(1.75), FMV, { lit: GL }, x, fyA, z); glow(x, fyA + 1.62, z, GL, 0.6); }
  chand(29, yR, 0, 0.9); chand(37, yR, 0, 1.0); chand(45, yR, 0, 0.9);
  spots.push(
    { lx: 29.2, ly: fyA, lz: 5.6, lyaw: Math.PI, kind: 'waiter', col: WHITE, act: 0.6 },
    { lx: 35.6, ly: fyA, lz: -0.6, lyaw: 0.6, kind: 'waiter', col: WHITE, act: 0.1 },
    { lx: 44.2, ly: fyA, lz: 6.25, lyaw: 0, kind: 'dress', col: MAID, act: 29.0 },
  );

  /* ================= Fernsicht: Fensterbänder leuchten, solange das Innere ausgeblendet ist ================= */
  const band = (x0, x1, y0, y1, z, rot) => {
    const g = new T.PlaneGeometry(x1 - x0, y1 - y0); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i) * (x1 - x0) / 1.67);
    KF.add('winF', g.rotateY(rot).translate((x0 + x1) / 2, (y0 + y1) / 2, z));
  };
  for (const s of [-1, 1]) {
    band(XT + 0.3, XF - 0.3, fyB + 0.85, fyB + 2.85, s * (ZW + 0.075), s < 0 ? Math.PI : 0);
    band(XT + 0.3, XF - 0.3, fyA + 0.75, fyA + 2.95, s * (ZW + 0.075), s < 0 ? Math.PI : 0);
  }
  for (const [y0, y1] of [[fyB + 0.7, fyB + 3.2], [fyA + 0.45, fyA + 3.25]]) { const g = new T.PlaneGeometry(2 * ZW - 0.4, y1 - y0); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, u.getX(i) * (2 * ZW) / 1.4); KF.add('winF', g.rotateY(Math.PI / 2).translate(XF + 0.075, (y0 + y1) / 2, 0)); }

  /* ================= zusammensetzen ================= */
  KO.build(ship);
  KI.build(inner);
  inner.add(makeGlowPoints(bulbs));
  ship.add(inner); IMP.inner = inner;
  const farG = new T.Group(); KF.build(farG); ship.add(farG); IMP.farGlow = farG; farG.visible = false;
  outBulbs.push({ p: [(XA + XF) / 2, fyB - 1.8, 0], c: [1.5, 1.2, 0.8], s: 3.2, ph: 0, bl: 0 }, { p: [XF + 0.3, fyB - 1.2, 0], c: [1.6, 0.25, 0.15], s: 1.6, ph: 0.3, bl: 1 });
  ship.add(makeGlowPoints(outBulbs));
  IMP.pf = addPlatform(ship, boxes, 58, { ylo: fyB - 2.5, yhi: yR + 1.5 });
  IMP.pf.air = true;
  spotPeds(IMP.pf, MOBILE ? spots.filter((s, i) => i % 3 !== 2) : spots);
  // Räume für die Einblendung beim Betreten
  IMP.rooms = [
    ['Achterdeck', XA, XT, fyB], ['Speisesalon', XT, XH0, fyB], ['Treppenhalle', XH0, XH1, fyB], ['Bordküche', XH1, XG, fyB], ['Mannschaftsmesse und Funkraum', XG, XM, fyB], ['Brücke', XM, XF, fyB],
    ['Ihre Suite', XT, XH0, fyA], ['Galerie', XH0, XH1, fyA], ['Bibliothek und Arbeitszimmer', XH1, XS, fyA], ['Großer Salon mit Bar', XS, XF, fyA],
  ];

  // Flugroute: weite Schleife über der Stadt, steigt über die Türme
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, rr2 = 1 + 0.12 * Math.sin(a * 3 + 1); pts.push(new T.Vector3(Math.cos(a) * 700 * rr2, 315 + 25 * Math.sin(a * 2), -200 + Math.sin(a) * 540 * rr2)); }
  IMP.curve = new T.CatmullRomCurve3(pts, true, 'centripetal'); IMP.len = IMP.curve.getLength();
  IMP.lift = liftProfile(u => { const q = IMP.curve.getPointAt(((u % 1) + 1) % 1); return [q.x, q.y, q.z]; }, 140, 45);
  impPose('cruise', 0, IMP._p); impApply(IMP._p);
  buildImperialCallPost();
  impInteractions();
}
IMP._p = { x: 0, y: 0, z: 0, ry: 0 }; IMP._q = { x: 0, y: 0, z: 0, ry: 0 };

// Rufsäule auf der Ballsaal-Terrasse des Belmont: Messingsäule mit türkisem Signallicht
export function buildImperialCallPost() {
  const K = impKit(), x = 5.2, z = 22.6, y = BEL.s2;
  K.add('gold', lathe([[0.32, 0], [0.32, 0.12], [0.2, 0.2], [0.13, 0.3], [0.1, 1.0], [0.16, 1.1], [0.2, 1.18], [0.001, 1.2]], 16).translate(x, y, z));
  K.add('lit', new T.SphereGeometry(0.17, 14, 10).translate(x, y + 1.38, z), [0.4, 1.5, 1.4]);
  K.add('gold', new T.TorusGeometry(0.19, 0.02, 4, 18).rotateX(Math.PI / 2).translate(x, y + 1.38, z));
  K.add('fan', new T.PlaneGeometry(0.5, 0.25).translate(x, y + 0.85, z + 0.12));
  K.build(scene);
  scene.add(makeGlowPoints([{ p: [x, y + 1.38, z], c: [0.4, 1.4, 1.3], s: 1.6, ph: 0, bl: 0 }]));
  addCollider(x - 0.32, y, z - 0.32, x + 0.32, y + 1.3, z + 0.32);
}

/* ---------- Flug ---------- */
export function impPose(kind, t, o) {
  const I = IMP;
  if (kind === 'moor') {
    // am Ankermast des Belmont: Bug am Mast, das Heck dreht langsam mit dem Wind
    const a = Math.sin(t * 0.025) * 0.5 + 2.2, d = I.L / 2 + 3;
    o.x = Math.cos(a) * d; o.y = BEL.mast - 2 + Math.sin(t * 0.35) * 0.3; o.z = Math.sin(a) * d; o.ry = Math.PI - a;
    return o;
  }
  const s = I.s, p = I.curve.getPointAt(s), tg = I.curve.getTangentAt(s);
  o.x = p.x; o.y = p.y + I.lift(s) + Math.sin(t * 0.25) * 0.8; o.z = p.z; o.ry = Math.atan2(-tg.z, tg.x);
  return o;
}
export function impApply(o) { IMP.g.position.set(o.x, o.y, o.z); IMP.g.rotation.set(0, o.ry, 0); }
export function impBlend(to) {
  const I = IMP, g = I.g;
  if (to === 'cruise') {
    // nächsten Punkt der Schleife suchen und von dort weiterfliegen
    let best = 0, bd = 1e18; for (let k = 0; k < 64; k++) { const q = I.curve.getPointAt(k / 64), d = (q.x - g.position.x) ** 2 + (q.z - g.position.z) ** 2; if (d < bd) { bd = d; best = k / 64; } }
    I.s = best;
  }
  impPose(to, 0, I._q);
  const p = g.position, rS = Math.hypot(p.x, p.z), aS = Math.atan2(p.z, p.x), rT = Math.hypot(I._q.x, I._q.z);
  let da = Math.atan2(I._q.z, I._q.x) - aS; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  const dist = to === 'moor' ? Math.abs(da) * Math.max(rS, 300) + Math.abs(rS - rT) + Math.abs(p.y - I._q.y) : Math.hypot(I._q.x - p.x, I._q.y - p.y, I._q.z - p.z);
  I.b = { t: 0, D: Math.min(150, Math.max(35, dist / 10)), to, x: p.x, y: p.y, z: p.z, ry: g.rotation.y, rS, aS };
  I.st = 'blend';
}
export function updateImperial(dt, t) {
  const I = IMP; if (!I.g) return;
  const o = I._p;
  if (I.st === 'cruise') { I.s = (I.s + I.v * dt / I.len) % 1; impApply(impPose('cruise', t, o)); }
  else if (I.st === 'moor') impApply(impPose('moor', t, o));
  else {
    const b = I.b; b.t += dt;
    if (b.to === 'cruise') I.s = (I.s + I.v * dt / I.len * Math.min(1, b.t / b.D)) % 1;
    impPose(b.to, t, o);
    const u = Math.min(1, b.t / b.D), k = easeIO(u), wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
    if (b.to === 'moor') {
      // Anflug zum Belmont im Bogen um den Turm (erst herumfahren, dann gerade auf den Mast zu), nie quer über die Turmspitze
      const at = (q, out) => {
        const ea = easeIO(Math.min(1, q / 0.7)), er = easeIO(Math.max(0, (q - 0.3) / 0.7)), rT = Math.hypot(o.x, o.z), a = b.aS + wrapA(Math.atan2(o.z, o.x) - b.aS) * ea, r = b.rS + (rT - b.rS) * er;
        out.x = Math.cos(a) * r; out.z = Math.sin(a) * r; return out;
      };
      const q0 = at(u, IMP._q), x0 = q0.x, z0 = q0.z, q1 = at(Math.min(1, u + 0.01), IMP._q), mv = Math.atan2(-(q1.z - z0), q1.x - x0);
      // Bug in Fahrtrichtung, zuletzt auf den Mast ausgerichtet
      const ky = u < 0.02 ? 0 : 1, kf = Math.min(1, Math.max(0, (u - 0.55) / 0.4)), yMove = b.ry + wrapA(mv - b.ry) * easeIO(Math.min(1, u / 0.15)) * ky;
      o.ry = yMove + wrapA(o.ry - yMove) * easeIO(kf); o.x = x0; o.z = z0; o.y = b.y + (o.y - b.y) * k;
    } else {
      // Ablegen: ein Stück rückwärts vom Mast, dabei wenden (die Drehung ist vor der Fahrt fertig)
      const dr = wrapA(o.ry - b.ry), kr = easeIO(Math.min(1, u / 0.6));
      o.x = b.x + (o.x - b.x) * k; o.y = b.y + (o.y - b.y) * k; o.z = b.z + (o.z - b.z) * k; o.ry = b.ry + dr * kr;
    }
    impApply(o);
    if (b.t >= b.D) { I.st = b.to; I.b = null; if (player.on === I.pf) toast(b.to === 'moor' ? 'Die Aurora Imperial hat am Ankermast des Belmont festgemacht' : 'Die Aurora Imperial kreuzt über Vespera'); }
  }
  // Inneres nur aus der Nähe; aus der Ferne leuchten die Fensterbänder
  if ((I.cullT -= dt) <= 0) {
    I.cullT = 0.4;
    const near = camera.position.distanceToSquared(I.g.position) < (MOBILE ? 190 : 300) ** 2;
    I.inner.visible = near; I.farGlow.visible = !near;
  }
  // Raumnamen beim Betreten
  if (player.on === I.pf) {
    const [lx] = pfLocal(I.pf, player.p.x, player.p.z), ly = player.p.y - I.pf.y, up = ly > I.D.fyA - 0.5;
    const r = I.rooms.find(q => lx >= q[1] && lx < q[2] && (q[3] === I.D.fyA) === up);
    const name = r ? r[0] : null;
    if (name !== I.room) { I.room = name; if (name) toast('Aurora Imperial · ' + name); }
  } else I.room = null;
}
// An Bord und im geschlossenen Teil der Gondel: kein Regen, kein Bodennebel
export function inImperial(p) {
  const I = IMP; if (!I.pf || player.on !== I.pf) return false;
  const [lx, lz] = pfLocal(I.pf, p.x, p.z); return lx > I.D.XT && lx < I.D.XF && Math.abs(lz) < I.D.ZW;
}
// Ortswechsel mit Abblenden; der Zielpunkt wird erst im Moment des Sprungs aus der Lage des Schiffs berechnet
export function impBoard(lx, ly, lz, lyaw, name) {
  const f = $('fade'); f.style.opacity = 1; driveExit();
  setTimeout(() => {
    const pf = IMP.pf, c = Math.cos(pf.ry), s = Math.sin(pf.ry);
    player.p.set(pf.x + lx * c + lz * s, pf.y + ly + 0.05, pf.z - lx * s + lz * c); player.v.set(0, 0, 0);
    player.on = pf; player.yaw = pf.ry + lyaw; player.pitch = -0.05; player.fly = false; toast(name); f.style.opacity = 0;
  }, 480);
}
export function impLeave(pos, yaw, name) {
  const f = $('fade'); f.style.opacity = 1;
  setTimeout(() => { player.p.set(...pos); player.v.set(0, 0, 0); player.on = null; player.yaw = yaw; player.pitch = 0; player.fly = false; toast(name); f.style.opacity = 0; }, 480);
}
export function impLocal(p) { const I = IMP; if (!I.pf) return null; const [lx, lz] = pfLocal(I.pf, p.x, p.z); return { lx, lz, ly: p.y - I.pf.y }; }
export function impInteractions() {
  const I = IMP, D = I.D;
  const aboard = (p, x0, x1, z0, z1, y) => { if (player.on !== I.pf) return false; const q = impLocal(p); return q.lx > x0 && q.lx < x1 && q.lz > z0 && q.lz < z1 && Math.abs(q.ly - y) < 1.3; };
  const boardHall = () => impBoard(7, D.fyB, -4.6, Math.PI, 'An Bord der Aurora Imperial · Treppenhalle');
  INTERACT.push({ test: p => Math.abs(p.x - 5.2) < 1.5 && Math.abs(p.z - 22.6) < 1.6 && Math.abs(p.y - BEL.s2) < 2, label: 'Aurora Imperial rufen · an Bord gehen', act: () => { boardHall(); } });
  INTERACT.push({ test: p => { const m = VILLA.mast; return !!m && Math.hypot(p.x - m.x, p.z - m.z) < 6 && Math.abs(p.y - (m.y - 42)) < 3; }, label: 'Mit dem Zubringer zur Aurora Imperial', act: () => boardHall() });
  INTERACT.push({ test: p => aboard(p, 5.6, 8.4, -6.95, -5.0, D.fyB), label: 'Von Bord gehen · Zubringer zur Belmont-Terrasse', act: () => impLeave([3.6, BEL.s2 + 0.1, 22.8], Math.PI, 'The Belmont · Ballsaal-Terrasse') });
  INTERACT.push({ test: p => aboard(p, D.XA, D.XA + 2.6, -2, 2, D.fyB), label: 'Von Bord gehen · Zubringer zur Villa', act: () => { const m = VILLA.mast; if (m) impLeave([m.x + 5, m.y - 42 + 0.6, m.z + 5], player.yaw, 'Villa · Ankermast'); } });
  INTERACT.push({
    test: p => aboard(p, D.XF - 7, D.XF - 1.2, -1.8, 2.2, D.fyB),
    get label() { return I.st === 'cruise' ? 'Kapitän: am Ankermast des Belmont festmachen' : I.st === 'moor' ? 'Kapitän: ablegen und über Vespera kreuzen' : 'Mit dem Kapitän sprechen'; },
    act: () => {
      if (I.st === 'cruise') { impBlend('moor'); toast('Kapitän: „Sehr wohl, Sir. Kurs auf den Belmont.“'); }
      else if (I.st === 'moor') { impBlend('cruise'); toast('Kapitän: „Leinen los. Wir kreuzen über der Stadt, Sir.“'); }
      else { I.said = (I.said + 1) % IMP_CAPTAIN.length; toast('Kapitän: „' + IMP_CAPTAIN[I.said] + '“'); }
    },
  });
}
