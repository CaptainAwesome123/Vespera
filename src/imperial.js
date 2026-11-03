import { T, MOBILE, R, scene, camera, mergeGeos, geoView, canvasTex, mulberry32, $ } from './core.js';
import { stdMat, ENV, addCollider } from './people-skeleton.js';
import { buildAirship } from './airships.js';
import { portMats, addPlatform, bx6, wallRun, wuv, spotPeds, pfLocal, VILLA, easeIO, TEAK, PLATE, terrainHeight } from './harbour.js';
import { roundBox, lathe, tube, FURN, placeFurn, FAN_TEX, MOV, movOn, movOff } from './entrances.js';
import { cofferTex2, RUNNER_TEX, decoRugTex, damaskTex, veneerTex, tileTex, paintingTex } from './deco-tex.js';
import { RIDES, rideOn, rideHome, spawnProp, dropBody, LOOSE } from './physics.js';
import { wallpaperTex, planVillaSite } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { wantTexture } from './assets.js';
import { BEL } from './belmont.js';
import { INTERACT } from './music.js';
import { player, keys, touch } from './player.js';
import { toast } from './boat.js';
import { driveExit } from './driving.js';
import { liftProfile, skyline } from './main.js';
import { openChoice, DINE, standUp } from './venues.js';
import { PM, toggleView } from './player-model.js';
import { lifeSay } from './life.js';
import { buildBordservice, updateBordservice } from './bordservice.js';

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
  curve: null, len: 1, lift: null, D: null, rooms: [], room: null, cullT: 0, said: 0, cmdSaid: 0, hp: null,
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

// V54: poliertes Mahagonifurnier ohne Bretterfugen (die Bohlen-Textur sah an Möbeln und Wänden wie Ziegel aus)
export function impMahogTex() {
  const t = canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(5402);
    g.fillStyle = '#5a2412'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 220; k++) {
      const x0 = rr() * W, a = 2 + rr() * 9, ph = rr() * 6.3, dark = rr() < 0.6;
      g.strokeStyle = dark ? `rgba(30,10,4,${0.12 + rr() * 0.25})` : `rgba(160,80,40,${0.08 + rr() * 0.18})`; g.lineWidth = 0.6 + rr() * 2.6;
      g.beginPath(); for (let y = 0; y <= H; y += 8) { const x = x0 + Math.sin(y / H * Math.PI * 2 * 2 + ph) * a; y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    }
    // Flammen in der Mitte jeder Hälfte, warmer Glanzstreifen
    for (const cx of [W * 0.25, W * 0.75]) for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(${k % 2 ? '25,8,3' : '150,70,30'},0.18)`; g.lineWidth = 2; g.beginPath(); for (let y = 0; y <= H; y += 8) { const x = cx + (k - 7) * 6 + Math.sin(y / H * Math.PI * 6 + k * 0.4) * (14 - Math.abs(k - 7)); y ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    const gl = g.createLinearGradient(0, 0, W, 0); gl.addColorStop(0, 'rgba(255,200,150,0)'); gl.addColorStop(0.5, 'rgba(255,200,150,0.07)'); gl.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
  });
  t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
// V54: Seekarte für den Kartentisch der Brücke: Pergament, Küstenlinien, Gradnetz, Kompassrose, Kurslinie
export function impChartTex() {
  return canvasTex(512, 384, (g, W, H) => {
    const rr = mulberry32(5401);
    g.fillStyle = '#e4d6b0'; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '120,90,40' : '255,250,230'},${rr() * 0.08})`; g.fillRect(rr() * W, rr() * H, 2 + rr() * 5, 1 + rr() * 3); }
    g.strokeStyle = 'rgba(40,80,90,0.35)'; g.lineWidth = 1; for (let x = 0; x <= W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // Bergkessel als Ring, die Stadt in der Mitte
    g.strokeStyle = '#6a4a22'; g.lineWidth = 2;
    for (let r = 0; r < 4; r++) { g.beginPath(); for (let a = 0; a <= 6.3; a += 0.12) { const q = 120 + r * 18 + Math.sin(a * 5 + r) * 9 + rr() * 4; g.lineTo(W / 2 + Math.cos(a) * q * 1.3, H / 2 + Math.sin(a) * q * 0.82); } g.stroke(); }
    g.fillStyle = 'rgba(40,110,120,0.35)'; g.beginPath(); g.ellipse(W / 2 + 40, H / 2 + 50, 60, 22, 0.3, 0, 7); g.fill();
    g.fillStyle = '#3a2a14'; for (let k = 0; k < 60; k++) { const a = rr() * 6.3, q = rr() * 70; g.fillRect(W / 2 + Math.cos(a) * q * 1.3, H / 2 + Math.sin(a) * q * 0.8, 3, 3); }
    g.strokeStyle = '#8a2a1a'; g.lineWidth = 2; g.setLineDash([8, 6]); g.beginPath(); g.ellipse(W / 2, H / 2, 150, 92, 0.2, 0, 6.3); g.stroke(); g.setLineDash([]);
    g.save(); g.translate(W - 70, 70); g.fillStyle = '#a07830'; for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(k % 2 ? 4 : 7, 0); g.lineTo(0, k % 4 ? 26 : 46); g.lineTo(k % 2 ? -4 : -7, 0); g.fill(); } g.restore();
    g.fillStyle = '#3a2a14'; g.font = 'italic 22px Georgia, serif'; g.fillText('Vespera · Kesselkarte', 24, H - 24);
  });
}
// V54: Instrumententafel: dunkles Holz, Messingringe, Zifferblätter mit Zeigern, kleine Lampen
export function impDialTex() {
  return canvasTex(512, 128, (g, W, H) => {
    g.fillStyle = '#1c120a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(214,170,90,0.7)'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8);
    for (let k = 0; k < 5; k++) {
      const cx = 56 + k * 100, cy = H / 2, r = 40;
      g.fillStyle = '#c9a050'; g.beginPath(); g.arc(cx, cy, r + 5, 0, 7); g.fill();
      g.fillStyle = '#f2ead6'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.strokeStyle = '#2a2018'; g.lineWidth = 1.5; for (let t = 0; t < 24; t++) { const a = -2.4 + t / 23 * 4.8; g.beginPath(); g.moveTo(cx + Math.sin(a) * r * 0.78, cy - Math.cos(a) * r * 0.78); g.lineTo(cx + Math.sin(a) * r * 0.92, cy - Math.cos(a) * r * 0.92); g.stroke(); }
      g.strokeStyle = '#8a1a10'; g.lineWidth = 3; const a = -1.6 + k * 0.7; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * r * 0.8, cy - Math.cos(a) * r * 0.8); g.stroke();
      g.fillStyle = '#2a2018'; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill();
    }
  });
}
// V54: alle Gemälde an Bord in einem Bild (eine Zeichnung statt fünf): 3 × 2 Felder aus paintingTex
export function impArtTex() {
  return canvasTex(1152, 960, (g) => { for (let k = 0; k < 6; k++) { const t = paintingTex(k % 5); g.drawImage(t.image, (k % 3) * 384, (k / 3 | 0) * 480); t.dispose(); } });
}

/* ---------- Materialien und Bausatz ---------- */
export let IMP_M = null;
export function impMats() {
  if (IMP_M) return IMP_M;
  const P = portMats(), vc = o => stdMat({ vertexColors: true, ...o });
  const marbleT = impMarbleTex(), mahog = impMahogTex(), silk = wallpaperTex('#d6c49c', 'rgba(150,108,42,0.42)'), books = impBookTex();
  silk.wrapS = silk.wrapT = T.RepeatWrapping;
  IMP_M = {
    paintX: vc({ map: PLATE.map, normalMap: PLATE.normal, normalScale: new T.Vector2(0.5, 0.5), roughness: 0.4, metalness: 0.35, envI: 0.8, emissive: 0x1c140a }),
    gold: impSelfLit(vc({ color: 0xd2aa5e, metalness: 1, roughness: 0.28, envI: 1.1 }), 0.12),
    steel: impSelfLit(vc({ color: 0xc8ccd0, metalness: 0.9, roughness: 0.32, envI: 1.0 }), 0.08),
    wood: impSelfLit(vc({ map: mahog, roughness: 0.22, envI: 0.9 }), 0.3),
    panel: impSelfLit(vc({ map: mahog, roughness: 0.3, envI: 0.7, color: 0xd8b8a0 }), 0.3),   // V54: Wandvertäfelung aus demselben Furnier, selbstleuchtend wie die übrigen Wände
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
    // V54: Kassettendecken, Treppenläufer, ganze Art-déco-Teppiche, Damast, Makassar-Furnier, Fliesen, Gemälde, Seekarte, Instrumente
    // (gleiche Selbstleucht-Stufen wie oben, damit keine neuen Shader-Varianten entstehen)
    coffer: impSelfLit(vc({ map: cofferTex2(), roughness: 0.6, envI: 0.3 }), 0.3),
    runner: impSelfLit(vc({ map: RUNNER_TEX(), roughness: 1, envI: 0.1 }), 0.3),
    rug: impSelfLit(vc({ map: decoRugTex('#0d2f33', '#c9a050', '#4a0c14', 3, 2), roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0.3),
    rugC: impSelfLit(vc({ map: decoRugTex('#e2d4b8', '#a8823c', '#0d3a3c', 3, 2), roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 0.3),
    damask: impSelfLit(vc({ map: damaskTex('#123c3e', '#1d5356'), roughness: 0.55, metalness: 0.15, envI: 0.4 }), 0.42),
    veneer: impSelfLit(vc({ map: veneerTex(), roughness: 0.18, metalness: 0.05, envI: 0.8 }), 0.3),
    tileW: impSelfLit(vc({ map: tileTex(), roughness: 0.2, envI: 0.8 }), 0.3),
    art: impSelfLit(vc({ map: impArtTex(), roughness: 0.8, envI: 0.1 }), 0.42),
    chart: impSelfLit(vc({ map: impChartTex(), roughness: 0.9, envI: 0.1 }), 0.42),
    dial: impSelfLit(vc({ map: impDialTex(), roughness: 0.3, envI: 0.6 }), 0.42),
  };
  for (const k of ['damask', 'veneer', 'tileW']) IMP_M[k].map.wrapS = IMP_M[k].map.wrapT = T.RepeatWrapping;
  return IMP_M;
}
// wie kit() im Hafen, nur mit den Materialien des Luftschiffs (je Material ein Netz, Farbe je Teil)
export function impKit() {
  const G = {};
  return {
    add(k, g, c = [1, 1, 1]) { (G[k] ||= []).push([g, c]); return g; },
    build(parent) {
      // V54: userData mitnehmen (Eckenbereiche beweglicher Möbel)
      const M = impMats(), P = portMats();
      for (const k in G) {
        const geos = G[k].map(([g]) => { const ud = g.userData; g = !g.attributes.normal && g.index ? g.toNonIndexed() : geoView(g); g.userData = ud; if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
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
  // V54: die Gondel hängt ganz unter der Hülle (vorher lag das Dach 1,6 m über dem tiefsten Punkt am Heck der Gondel,
  // mittschiffs steckte fast das ganze Oberdeck im Ballon). Dach knapp unter dem tiefsten Punkt der Hülle über der Gondel.
  let hMax = 0; for (let x = XA; x <= XF; x += 0.5) hMax = Math.max(hMax, hr(x));
  const yR = -hMax - 1.0, fyA = yR - 3.5, fyB = fyA - 3.9, HB = fyA - fyB, HA = yR - fyA;
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
  // V54: Möbel sind mit Telekinese greifbar (Verzeichnis MOV mit mitfahrendem Schiffssystem IMP.fr, Farben je Teil in e.cols)
  const fur = (parts, map, cols, x, y, z, a = 0) => { const n0 = MOV.list.length; placeFurn(parts, map, (k, g) => KI.add(k, g, cols[k] || [1, 1, 1]), x, y, z, a); for (let i = n0; i < MOV.list.length; i++) MOV.list[i].cols = cols; };
  IMP.fr = { x: 0, y: 0, z: 0, ry: 0, pf: null };
  movOn(IMP.fr);
  const floorP = (k, x0, x1, z0, z1, y, sc = 2, c) => KI.add(k, wuv(new T.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2).translate((x0 + x1) / 2, y + 0.004, (z0 + z1) / 2), sc), c);
  // Ebene mit Kachelung je `tile` Meter (Kassettendecke, Wandbespannung)
  const tiled = (g, w, h, tile) => { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * w / tile, u.getY(i) * h / tile); return g; };
  const ceilP = (x0, x1, y, c = [1, 0.95, 0.85], z0 = -ZI, z1 = ZI, k = 'coffer') => {
    // V54: Kassettendecke (Goldrahmen, Fächer in jedem Feld), umlaufende Hohlkehle mit Goldleiste
    KI.add(k, tiled(new T.PlaneGeometry(x1 - x0, z1 - z0).rotateX(Math.PI / 2).translate((x0 + x1) / 2, y - 0.004, (z0 + z1) / 2), x1 - x0, z1 - z0, 1.7), c);
    for (const s of [-1, 1]) { const zz = s < 0 ? z0 : z1; if (Math.abs(zz) < ZI - 0.01) continue; bx(KI, 'gold', x1 - x0, 0.06, 0.06, (x0 + x1) / 2, y - 0.2, s * (ZI - 0.2)); bx(KI, 'wood', x1 - x0, 0.18, 0.18, (x0 + x1) / 2, y - 0.09, s * (ZI - 0.08), [0.9, 0.85, 0.8]); }
  };
  // ganzer Art-déco-Teppich (Muster mit Rahmen und Fächern, eine Zeichnung je Stück)
  const rug = (x, z, y, w, d, a = 0, k = 'rug') => KI.add(k, new T.BoxGeometry(w, 0.025, d).rotateY(a).translate(x, y + 0.013, z));
  // Wandvertäfelung unter den Fenstern: Furnierfelder mit Goldleiste oben und Goldstäben zwischen den Feldern
  const wains = (x0, x1, y, h = 0.8, sides = [-1, 1], k = 'veneer') => {
    for (const s of sides) {
      KI.add(k, tiled(new T.PlaneGeometry(x1 - x0, h).rotateY(s < 0 ? 0 : Math.PI).translate((x0 + x1) / 2, y + h / 2, s * (ZI - 0.035)), x1 - x0, h, 1.2));
      bx(KI, 'gold', x1 - x0, 0.05, 0.05, (x0 + x1) / 2, y + h, s * (ZI - 0.05)); bx(KI, 'wood', x1 - x0, 0.12, 0.05, (x0 + x1) / 2, y + 0.06, s * (ZI - 0.05), [0.35, 0.22, 0.14]);
      for (let x = x0 + 1.2; x < x1 - 0.3; x += 1.2) bx(KI, 'gold', 0.025, h - 0.2, 0.02, x, y + h / 2 + 0.03, s * (ZI - 0.045));
    }
  };
  // Gemälde mit Goldrahmen (k = Feld im Bilderatlas 0..5); n = Blickrichtung (Wandnormale) als Winkel um y
  const painting = (k, x, y, z, w, h, ry) => {
    const g = new T.PlaneGeometry(w, h), u = g.attributes.uv, cu = (k % 3) / 3, cv = 1 - ((k / 3 | 0) + 1) / 2;
    for (let i = 0; i < u.count; i++) u.setXY(i, cu + u.getX(i) / 3, cv + u.getY(i) / 2);
    KI.add('art', g.rotateY(ry).translate(x, y, z));
    const fr = (fw, fh, dx, dy) => KI.add('gold', new T.BoxGeometry(fw, fh, 0.06).translate(dx, dy, -0.02).rotateY(ry).translate(x, y, z));
    fr(w + 0.2, 0.1, 0, h / 2 + 0.05); fr(w + 0.2, 0.1, 0, -h / 2 - 0.05); fr(0.1, h, w / 2 + 0.05, 0); fr(0.1, h, -w / 2 - 0.05, 0);
    glow(x + Math.sin(ry) * 0.25, y + h / 2 + 0.16, z + Math.cos(ry) * 0.25, GL, 0.3);
    KI.add('gold', new T.CylinderGeometry(0.02, 0.03, w * 0.6, 8).rotateZ(Math.PI / 2).rotateY(ry).translate(x + Math.sin(ry) * 0.2, y + h / 2 + 0.16, z + Math.cos(ry) * 0.2));
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
    // V54: gebogene, schmale Wedel mit Fiedern statt flacher Blätter
    for (let k = 0; k < 11; k++) KI.add('plant', frond(0.62 * s * (0.8 + (k % 3) * 0.12), 0.5 + (k % 4) * 0.22).rotateY(k * 2.4).translate(x, y + 1.25 * s, z), k % 2 ? [0.24, 0.44, 0.2] : [0.3, 0.5, 0.24]);
  };
  // Palmwedel: Mittelrippe nach außen und unten gebogen, Fiedern beidseits als schmale Dreiecke
  function frond(l, lift) {
    const P = [], N = 7;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, w = 0.16 * l * Math.sin(Math.PI * Math.min(0.95, t0 + 0.12)) + 0.02;
      const at = t => [t * l, lift * l * t - 1.1 * l * t * t];
      const [x0, y0] = at(t0), [x1, y1] = at(t1);
      for (const sd of [-1, 1]) P.push(x0, y0, 0, x1, y1, 0, (x0 + x1) / 2 + 0.03 * l, (y0 + y1) / 2 - 0.05 * l, sd * w);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
  }
  const wardrobe = (x, z, y, w, a) => {
    const P = [[roundBox(w, 2.3, 0.62, 0.03).translate(0, 1.15, 0), 'wood', [0.7, 0.5, 0.35]], [new T.BoxGeometry(w + 0.08, 0.1, 0.7).translate(0, 2.33, 0), 'wood', [0.7, 0.5, 0.35]]];
    for (const s of [-1, 1]) P.push([new T.BoxGeometry(0.02, 0.32, 0.03).translate(s * 0.06, 1.15, 0.33), 'gold', [1, 1, 1]], [new T.BoxGeometry(w / 2 - 0.16, 1.9, 0.012).translate(s * w / 4, 1.2, 0.315), 'wood', [0.45, 0.3, 0.2]], [new T.BoxGeometry(w / 2 - 0.08, 1.98, 0.008).translate(s * w / 4, 1.2, 0.312), 'gold', [1, 1, 1]]);
    for (const [g, k, c] of P) KI.add(k, wuv(g.rotateY(a).translate(x, y, z), 1.2), c);
  };

  /* ================= Außenhülle der Gondel ================= */
  KO.add('paintX', roundBox(XF - XA + 0.6, 1.5, 2 * ZW + 0.4, 0.65).translate((XA + XF) / 2, fyB - 0.77, 0), CHAMP);   // V54: Oberkante unter den Böden (deckte vorher alle Böden unten zu)
  bx(KO, 'gold', XF - XA + 0.2, 0.12, 0.36, (XA + XF) / 2, fyB - 1.5, 0);
  for (const s of [-1, 1]) {
    bx(KO, 'gold', XF - XA + 0.5, 0.14, 0.08, (XA + XF) / 2, fyB + 0.04, s * (ZW + 0.2));
    bx(KO, 'gold', XF - XT + 0.2, 0.3, 0.12, (XT + XF) / 2, fyA - 0.15, s * (ZW + 0.1));
    bx(KO, 'gold', XF - XT + 0.2, 0.12, 0.12, (XT + XF) / 2, yR - 0.06, s * (ZW + 0.1));
  }
  bx(KO, 'gold', 0.12, 0.3, 2 * ZW + 0.2, XF + 0.1, fyA - 0.15, 0);
  KO.add('paintX', roundBox(XF - XT + 0.4, 0.7, 2 * ZW + 0.3, 0.3).translate((XT + XF) / 2, yR + 0.36, 0), CHAMP);   // V54: Unterkante über der Kassettendecke (sie lag vorher darunter)
  // V54: Verkleidung zwischen Gondeldach und Hülle: unten so breit wie das Dach, oben schmaler und der Rundung der Hülle
  // folgend (reicht ein Stück in die Hülle hinein), mit Goldleiste über dem Dach und vier Goldrippen
  {
    const x0 = XT + 0.4, x1 = XF - 1.4, zw = ZW - 0.6, g = new T.BoxGeometry(1, 1, 1, 36, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) + 0.5, top = p.getY(i) > 0, x = x0 + (x1 - x0) * u, end = Math.min(1, Math.min(u, 1 - u) * 9);
      const zz = p.getZ(i) * 2 * zw * (top ? 0.62 : 0.86 + 0.14 * end);
      p.setXYZ(i, x, top ? -hr(x) + 1.4 : yR + 0.5, zz);
    }
    g.computeVertexNormals(); KO.add('paintX', wuv(g, 2), CHAMP);
    for (const s of [-1, 1]) KO.add('gold', tube([[x0 + 0.5, yR + 0.72, s * (zw * 0.86 + 0.03)], [x1 - 0.5, yR + 0.72, s * (zw * 0.86 + 0.03)]], 0.06, 4));
    for (const x of [XT + 8, XT + 24, XT + 40, XT + 54]) for (const s of [-1, 1]) { const yb = yR + 0.7, yt = -hr(x) + 0.2; KO.add('gold', tube([[x, yb, s * zw * 0.86], [x, yt, s * zw * 0.62]], 0.07, 6)); }
  }

  /* ================= Böden und Decken (Kollision) ================= */
  // V54: Treppenschacht kürzer (SX0..SX1), oben ein 1,7 m tiefer Absatz: vorher blieb zwischen Brüstung und Wand nur ein
  // halber Meter, man kam oben nicht zur Galerie und zur Suite weiter
  const SX0 = XH0 + 0.3, SX1 = XH1 - 1.7, SZ0 = 2.4, SZ1 = ZI;
  col(XA, fyB - 0.6, -ZW, XF, fyB, ZW);
  col(XT, fyA - 0.3, -ZW, SX0, fyA, ZW);
  col(SX0, fyA - 0.3, -ZW, SX1, fyA, 2.3);
  col(SX1, fyA - 0.3, -ZW, XF, fyA, ZW);
  col(XT, yR, -ZW, XF, yR + 0.6, ZW);
  // Zwischendecke sichtbar (Unterseite = Decke unten, Oberseite = Boden oben)
  for (const [x0, x1, z0, z1] of [[XT, SX0, -ZI, ZI], [SX0, SX1, -ZI, 2.3], [SX1, XF, -ZI, ZI]]) bx(KI, 'iron', x1 - x0, 0.26, z1 - z0, (x0 + x1) / 2, fyA - 0.16, (z0 + z1) / 2, [0.5, 0.45, 0.4]);

  /* ================= Wände (Außenwände mit Fenstern, Innenwände) ================= */
  const oW = { outK: 'paintX', outC: CHAMP };
  const sideL = { ...oW, sill: 0.85, head: 2.85, win: 1.35, post: 0.32 }, sideU = { ...oW, sill: 0.75, head: 2.95, win: 1.35, post: 0.32 };
  const sides = (x0, x1, y0, h, o, inK, inC, doorsP = [], doorsS = []) => {
    wallRun(KO, boxes, x0, -ZW, x1, -ZW, y0, h, { ...o, out: -1, inK, inC, doors: doorsP });
    wallRun(KO, boxes, x0, ZW, x1, ZW, y0, h, { ...o, out: 1, inK, inC, doors: doorsS });
  };
  // unten
  sides(XT, XH0, fyB, HB, sideL, 'panel');
  // Halle: Backbord Fenster und Eingangstür, Steuerbord (an der Treppe) geschlossene Marmorwand mit Gemälden
  wallRun(KO, boxes, XH0, -ZW, XH1, -ZW, fyB, HB, { ...sideL, out: -1, inK: 'marble', inC: [0.96, 0.93, 0.86], doors: [[6 - XH0, 8 - XH0]] });
  wallRun(KO, boxes, XH0, ZW, XH1, ZW, fyB, HB, { ...sideL, out: 1, inK: 'marble', inC: [0.96, 0.93, 0.86], windows: false });
  sides(XH1, XG, fyB, HB, sideL, 'tileW');
  sides(XG, XM, fyB, HB, sideL, 'panel');
  sides(XM, XF, fyB, HB, { ...sideL, sill: 0.75, head: 3.1 }, 'panel');
  // oben
  sides(XT, XH0, fyA, HA, sideU, 'silk');
  sides(XH0, XH1, fyA, HA, sideU, 'damask');   // V54: Galerie in Petrol-Damast
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
  iw(XH1, -ZW, XH1, ZW, fyB, HB, 'tileW', 'marble', [[ZW - 0.8, ZW + 0.8]]);
  iw(XG, -ZW, XG, ZW, fyB, HB, 'panel', 'tileW', [[ZW - 0.8, ZW + 0.8]]);
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
  // V54: neu gebaut: Marmorstufen mit goldener Trittkante, durchgehender Läufer auf Tritt und Setzstufe, an der offenen
  // Seite eine Mahagoni-Wange mit Goldkante (verdeckt die Stufenköpfe), darauf die Goldbaluster; an der Wand ein
  // Handlauf, Gemälde und Wandleuchten; oben ein tiefer Absatz zur Galerie und zur Bibliothek
  floorP('marble', XH0, XH1, -ZI, ZI, fyB, 3);
  for (let x = XH0 + 0.8; x < XH1; x += 1.6) for (let z = -ZI + 0.8; z < SZ0 - 0.3; z += 1.6) KI.add('marble', new T.PlaneGeometry(0.42, 0.42).rotateX(-Math.PI / 2).rotateY(Math.PI / 4).translate(x, fyB + 0.008, z), [0.12, 0.12, 0.14]);
  ceilP(XH0, XH1, fyA - 0.3, [1, 0.95, 0.85], -ZI, 2.3); ceilP(SX1, XH1, fyA - 0.3, [1, 0.95, 0.85], 2.3, ZI); ceilP(XH0, SX0, fyA - 0.3, [1, 0.95, 0.85], 2.3, ZI);
  const NS = 18, run = (SX1 - SX0) / NS, rise = HB / NS, SW = SZ1 - SZ0, SZM = (SZ0 + SZ1) / 2, RW = 2.3, stairY = x => fyB + Math.max(0, Math.min(NS, (x - SX0) / run)) * rise;
  for (let k = 0; k < NS; k++) {
    const x0 = SX0 + k * run, top = fyB + (k + 1) * rise;
    bx(KI, 'marble', run + 0.01, top - fyB, SW, x0 + run / 2, (top + fyB) / 2, SZM, [0.97, 0.95, 0.9], 2);
    bx(KI, 'gold', 0.05, 0.035, SW - 0.04, x0 + 0.02, top - 0.012, SZM);
    const tr = new T.PlaneGeometry(RW, run - 0.04).rotateX(-Math.PI / 2).rotateY(Math.PI / 2); { const u = tr.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, u.getY(i) * run / RW); }
    KI.add('runner', tr.translate(x0 + run / 2 + 0.02, top + 0.006, SZM + 0.2));
    const rs = new T.PlaneGeometry(RW, rise - 0.03).rotateY(-Math.PI / 2); { const u = rs.attributes.uv; for (let i = 0; i < u.count; i++) u.setY(i, u.getY(i) * rise / RW); }
    KI.add('runner', rs.translate(x0 - 0.006, top - rise / 2 - 0.015, SZM + 0.2), [0.85, 0.85, 0.85]);
    KI.add('gold', new T.CylinderGeometry(0.014, 0.014, RW + 0.16, 6).rotateX(Math.PI / 2).translate(x0 + 0.03, top - rise + 0.02, SZM + 0.2));
    col(x0, fyB, SZ0, x0 + run, top, ZW);
    // Wange und Geländer: eine Kollision je Stufe (vom Boden bis Handlaufhöhe)
    col(x0, fyB, SZ0 - 0.16, x0 + run, top + 1.0, SZ0 + 0.06);
    if (k % 2 === 0) KI.add('gold', lathe([[0.03, 0], [0.042, 0.08], [0.02, 0.22], [0.036, 0.5], [0.02, 0.78], [0.026, 0.86]], 8).translate(x0 + run / 2, top + 0.1, SZ0 - 0.07));
  }
  {
    const sh = new T.Shape(); sh.moveTo(SX0 - 0.2, 0); sh.lineTo(SX1, 0); sh.lineTo(SX1, HB + 0.14); sh.lineTo(SX0 - 0.2, rise + 0.1); sh.lineTo(SX0 - 0.2, 0);
    KI.add('veneer', wuv(new T.ExtrudeGeometry(sh, { depth: 0.14, bevelEnabled: false }).translate(0, fyB, SZ0 - 0.15), 0.8));
    KI.add('gold', tube([[SX0 - 0.2, fyB + rise + 0.12, SZ0 - 0.08], [SX1, fyA + 0.16, SZ0 - 0.08]], 0.05, 4));
    KI.add('gold', tube([[SX0 - 0.2, fyB + 0.14, SZ0 - 0.16], [SX1, fyB + 0.14, SZ0 - 0.16]], 0.03, 4));
    // Fächer-Relief auf der Wange
    for (let k = 1; k < 5; k++) { const x = SX0 + (SX1 - SX0) * k / 5; KI.add('fan', new T.PlaneGeometry(0.9, 0.45).translate(x, Math.max(fyB + 0.45, stairY(x) - 0.6), SZ0 - 0.16).rotateY(0)); }
  }
  KI.add('gold', tube([[SX0 - 0.2, fyB + rise + 1.02, SZ0 - 0.07], [SX1, fyA + 1.0, SZ0 - 0.07]], 0.05, 8));
  KI.add('gold', tube([[SX0 - 0.1, fyB + 0.95, SZ1 - 0.07], [SX1, fyA + 0.92, SZ1 - 0.07]], 0.035, 8));
  for (let x = SX0 + 0.8; x < SX1; x += 1.6) KI.add('gold', new T.CylinderGeometry(0.015, 0.015, 0.08, 5).rotateX(Math.PI / 2).translate(x, stairY(x) + 0.92, SZ1 - 0.03));
  // Antrittspfosten unten und oben: Marmorsäule mit Goldkugel und Leuchtkugel
  for (const [nx, ny] of [[SX0 - 0.2, fyB], [SX1 + 0.05, fyA]]) {
    KI.add('marble', lathe([[0.22, 0], [0.22, 0.12], [0.15, 0.2], [0.13, 1.0], [0.2, 1.1], [0.001, 1.12]], 14).translate(nx, ny, SZ0 - 0.07), [0.15, 0.15, 0.17]);
    KI.add('gold', lathe([[0.16, 0], [0.1, 0.06], [0.04, 0.16]], 12).translate(nx, ny + 1.12, SZ0 - 0.07));
    KI.add('lit', new T.SphereGeometry(0.17, 12, 10).translate(nx, ny + 1.4, SZ0 - 0.07), [1.6, 1.25, 0.8]); glow(nx, ny + 1.4, SZ0 - 0.07, GL, 0.9);
    col(nx - 0.24, ny, SZ0 - 0.3, nx + 0.24, ny + 1.2, SZ0 + 0.16);
  }
  // Treppenwand: Ahnengalerie (drei Gemälde steigen mit der Treppe), Leuchter dazwischen, Vertäfelung am Fuß
  for (const [k, x] of [[0, SX0 + 1.5], [2, SX0 + 3.3], [4, SX0 + 5.1]]) painting(k, x, stairY(x) + 2.0, ZI - 0.04, 0.95, 1.2, Math.PI);
  for (const x of [SX0 + 2.4, SX0 + 4.2]) { KI.add('gold', lathe([[0.06, 0], [0.1, 0.12], [0.03, 0.25]], 10).rotateX(-Math.PI / 2).translate(x, stairY(x) + 2.2, ZI - 0.02)); glow(x, stairY(x) + 2.32, ZI - 0.12, GL, 0.4); }
  floorP('marble', XH0, SX0, 2.3, ZI, fyA, 3);
  // Brüstung oben um den Treppenschacht
  const bal = (ax, az, bx2, bz) => {
    const len = Math.hypot(bx2 - ax, bz - az), n = Math.round(len / 0.22);
    KI.add('gold', tube([[ax, fyA + 1.0, az], [bx2, fyA + 1.0, bz]], 0.04, 4));
    KI.add('marble', new T.BoxGeometry(Math.abs(bx2 - ax) + 0.14, 0.1, Math.abs(bz - az) + 0.14).translate((ax + bx2) / 2, fyA + 0.05, (az + bz) / 2), [0.95, 0.92, 0.86]);
    for (let k = 0; k <= n; k++) { const t = k / n; KI.add('gold', lathe([[0.02, 0], [0.035, 0.12], [0.015, 0.35], [0.032, 0.6], [0.015, 0.95]], 6).translate(ax + (bx2 - ax) * t, fyA + 0.05, az + (bz - az) * t)); }
    col(Math.min(ax, bx2) - 0.07, fyA, Math.min(az, bz) - 0.07, Math.max(ax, bx2) + 0.07, fyA + 1.05, Math.max(az, bz) + 0.07);
  };
  bal(SX0, 2.3, SX1 - 0.25, 2.3); bal(SX0, 2.3, SX0, ZI);
  // Halle unten: Goldsonne an der Wand, Palmen, Butler an der Tür
  KI.add('fan', new T.PlaneGeometry(4.2, 2.1).rotateY(-Math.PI / 2).translate(XH1 - 0.08, fyB + 2.3, -3.6));
  palm(XH0 + 0.9, -ZI + 0.9, fyB, 1.8); palm(XH1 - 0.9, -ZI + 0.9, fyB, 1.8);
  chand((SX0 + SX1) / 2, yR, 4.6, 0.9);
  spots.push({ lx: 5.4, ly: fyB, lz: -5.6, lyaw: 0.4, kind: 'livery', col: WHITE, act: 36.2 });

  // ---- Bordküche ----
  floorP('tileW', XH1, XG, -ZI, ZI, fyB, 1.2, [0.82, 0.8, 0.78]); ceilP(XH1, XG, fyA - 0.3, [1, 1, 1], -ZI, ZI, 'tileW');
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
  fur(FURN.roundTable(0.38, 0.55), FMV, { wood: [0.7, 0.5, 0.35] }, XT + 1.5, fyA, 0);
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
    { lx: 44.2, ly: fyA, lz: 6.25, lyaw: 0, kind: 'dress', col: MAID, act: 29.0 },
  );

  /* ================= V54: mehr Einrichtung, Schmuck und lose Dinge ================= */
  const VEL = [0.1, 0.3, 0.31], RED = [0.42, 0.06, 0.08];
  // Vorhänge: Samt-Schabracke über den Fenstern mit Goldfransen, schwere Seitenbahnen in den Raumecken
  const drapes = (x0, x1, y, head, c = VEL) => {
    for (const s of [-1, 1]) {
      bx(KI, 'velvet', x1 - x0 - 0.1, 0.34, 0.07, (x0 + x1) / 2, y + head + 0.1, s * (ZI - 0.08), c);
      bx(KI, 'gold', x1 - x0 - 0.1, 0.05, 0.075, (x0 + x1) / 2, y + head - 0.08, s * (ZI - 0.08));
      for (const x of [x0 + 0.38, x1 - 0.38]) { rb(KI, 'velvet', 0.5, head + 0.2, 0.12, 0.05, x, y + (head + 0.2) / 2, s * (ZI - 0.1), c); bx(KI, 'gold', 0.54, 0.06, 0.15, x, y + 1.0, s * (ZI - 0.1)); }
    }
  };
  // Speisesalon: Vertäfelung, Vorhänge, zwei Gemälde, gedeckte Tafel (Platzteller, Teller, Besteck, Servietten)
  wains(XT + 0.8, XH0 - 0.1, fyB, 0.8); drapes(XT, XH0, fyB, 2.85, RED);
  painting(1, XH0 - 0.08, fyB + 1.95, -4.3, 1.0, 1.25, -Math.PI / 2); painting(3, XH0 - 0.08, fyB + 1.95, 4.3, 1.0, 1.25, -Math.PI / 2);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    const x = -7.6 + i * 1.2, z = s * 0.5, y = fyB + 0.795;
    KI.add('gold', new T.CylinderGeometry(0.16, 0.16, 0.01, 20).translate(x, y + 0.005, z));
    KI.add('enamel', lathe([[0.001, 0], [0.1, 0], [0.13, 0.012], [0.14, 0.02]], 18).translate(x, y + 0.01, z), [0.97, 0.96, 0.92]);
    KI.add('linen', new T.BoxGeometry(0.12, 0.03, 0.12).rotateY(0.785).translate(x, y + 0.04, z), [0.95, 0.94, 0.9]);
    for (const dx of [-0.2, -0.24, 0.2, 0.24]) KI.add('steel', new T.BoxGeometry(0.018, 0.006, 0.2).translate(x + dx, y + 0.004, z), [1, 0.92, 0.7]);
  }
  // Treppenhalle: Standuhr, Konsole unter der Goldsonne
  {
    const cx = XH0 + 0.35, cz = -3.2;
    rb(KI, 'veneer', 0.5, 2.3, 0.4, 0.03, cx, fyB + 1.15, cz); KI.add('enamel', new T.CircleGeometry(0.17, 24).rotateY(Math.PI / 2).translate(cx + 0.21, fyB + 1.95, cz), [0.96, 0.93, 0.85]);
    KI.add('gold', new T.TorusGeometry(0.18, 0.02, 6, 24).rotateY(Math.PI / 2).translate(cx + 0.21, fyB + 1.95, cz)); KI.add('gold', new T.CylinderGeometry(0.06, 0.06, 0.02, 14).rotateZ(Math.PI / 2).translate(cx + 0.21, fyB + 1.0, cz));
    KI.add('glass', new T.PlaneGeometry(0.3, 0.9).rotateY(Math.PI / 2).translate(cx + 0.21, fyB + 1.05, cz)); col(cx - 0.25, fyB, cz - 0.2, cx + 0.25, fyB + 2.3, cz + 0.2);
    rb(KI, 'veneer', 1.6, 0.06, 0.45, 0.02, XH1 - 0.3, fyB + 0.86, -3.6); for (const dz of [-0.7, 0.7]) KI.add('gold', lathe([[0.04, 0], [0.025, 0.1], [0.02, 0.8], [0.035, 0.84]], 8).translate(XH1 - 0.3, fyB, -3.6 + dz));
    col(XH1 - 0.55, fyB, -4.4, XH1, fyB + 0.9, -2.8);
  }
  // Küche: Pfannenreling über dem Herd, Regale mit Vorratsgläsern
  bx(KI, 'gold', 4.4, 0.04, 0.04, 18, fyA - 1.2, -1.1, [1, 0.62, 0.45]); bx(KI, 'gold', 4.4, 0.04, 0.04, 18, fyA - 1.2, 1.1, [1, 0.62, 0.45]);
  for (let k = 0; k < 6; k++) { const x = 16.2 + k * 0.72, z = k % 2 ? 1.1 : -1.1, r = 0.11 + (k % 3) * 0.03; KI.add('gold', lathe([[0.001, 0], [r, 0], [r + 0.01, r * 0.8]], 14).translate(x, fyA - 1.62, z), [1, 0.6, 0.42]); KI.add('iron', new T.CylinderGeometry(0.012, 0.012, 0.32, 4).translate(x, fyA - 1.36, z)); }
  for (const s of [-1, 1]) for (const y of [1.45, 1.85]) {
    bx(KI, 'wood', 0.3, 0.04, 2.4, XH1 + 0.2, fyB + y, s * 3.6, [0.6, 0.45, 0.3]);
    for (let k = 0; k < 6; k++) KI.add('glass', new T.CylinderGeometry(0.06, 0.06, 0.2, 10).translate(XH1 + 0.2, fyB + y + 0.12, s * 3.6 - 1.0 + k * 0.4), [[0.9, 0.6, 0.2], [0.5, 0.2, 0.1], [0.8, 0.8, 0.6], [0.3, 0.5, 0.2]][(k + (y > 1.6 ? 1 : 0)) % 4]);
  }
  // Messe: Seekarte an der Wand, Rettungsringe, Kleiderhaken
  KI.add('chart', new T.PlaneGeometry(1.7, 1.25).rotateY(-Math.PI / 2).translate(XM - 0.08, fyB + 1.75, -3.6)); bx(KI, 'wood', 0.05, 1.33, 1.78, XM - 0.06, fyB + 1.75, -3.6, [0.5, 0.35, 0.2]);
  for (const [x, z, ry] of [[XG + 0.08, -2.4, Math.PI / 2], [XM - 0.08, 3.2, -Math.PI / 2]]) { KI.add('enamel', new T.TorusGeometry(0.3, 0.07, 8, 20).rotateY(ry).translate(x, fyB + 1.7, z), [0.85, 0.16, 0.12]); for (let k = 0; k < 4; k++) KI.add('enamel', new T.TorusGeometry(0.3, 0.075, 8, 3, 0.35).rotateZ(k * Math.PI / 2).rotateY(ry).translate(x, fyB + 1.7, z), [0.96, 0.95, 0.9]); }
  // Brücke: Kartentisch mit Seekarte, Instrumententafel, Maschinentelegraf, Sprachrohre
  KI.add('chart', new T.PlaneGeometry(1.6, 0.85).rotateX(-Math.PI / 2).translate(42, fyB + 0.89, 4.4));
  for (const s of [-1, 1]) KI.add('dial', new T.PlaneGeometry(2.6, 0.5).rotateY(-Math.PI / 2).translate(XF - 0.56, fyB + 0.38, s * 3.8));
  {
    const tx = XF - 3.0, tz = 2.7;
    KI.add('gold', lathe([[0.2, 0], [0.12, 0.08], [0.08, 0.85], [0.1, 0.9]], 12).translate(tx, fyB, tz));
    KI.add('gold', new T.CylinderGeometry(0.24, 0.24, 0.16, 20).rotateZ(Math.PI / 2).translate(tx, fyB + 1.12, tz));
    for (const s of [-1, 1]) KI.add('enamel', new T.CircleGeometry(0.2, 20).rotateY(s * Math.PI / 2).translate(tx + s * 0.085, fyB + 1.12, tz), [0.96, 0.93, 0.85]);
    KI.add('gold', new T.BoxGeometry(0.04, 0.36, 0.04).rotateX(0.4).translate(tx, fyB + 1.3, tz)); col(tx - 0.25, fyB, tz - 0.25, tx + 0.25, fyB + 1.3, tz + 0.25);
    for (const z of [-0.9, -0.6]) KI.add('gold', tube([[XF - 0.9, fyA - 0.32, z], [XF - 0.9, fyB + 1.4, z], [XF - 1.1, fyB + 1.2, z]], 0.035, 6));
  }
  // Achterdeck: Rettungsringe an der Reling
  for (const z of [-ZW + 0.18, ZW - 0.18]) { KI.add('enamel', new T.TorusGeometry(0.3, 0.07, 8, 20).translate(-17, fyB + 0.75, z), [0.85, 0.16, 0.12]); for (let k = 0; k < 4; k++) KI.add('enamel', new T.TorusGeometry(0.3, 0.075, 8, 3, 0.35).rotateZ(k * Math.PI / 2).translate(-17, fyB + 0.75, z), [0.96, 0.95, 0.9]); }
  // Suite: Vertäfelung, Vorhänge, Standspiegel
  wains(XT + 0.8, -0.2, fyA, 0.65); drapes(XT, 0, fyA, 2.95);
  { const mx = -1.0, mz = 2.2; KI.add('mirror', new T.PlaneGeometry(0.6, 1.5).rotateY(-Math.PI / 2 - 0.5).translate(mx, fyA + 1.0, mz)); KI.add('gold', new T.TorusGeometry(0.32, 0.03, 6, 24, Math.PI).rotateY(-Math.PI / 2 - 0.5).translate(mx, fyA + 1.75, mz)); for (const d of [-0.32, 0.32]) KI.add('gold', new T.CylinderGeometry(0.025, 0.03, 1.75, 6).translate(mx + Math.cos(0.5) * d * 0 + Math.sin(-0.5) * 0, fyA + 0.88, mz + d)); col(mx - 0.3, fyA, mz - 0.4, mx + 0.3, fyA + 1.8, mz + 0.4); }
  // Galerie: Vertäfelung an der Fensterseite, zwei Gemälde, Lesesessel mit Beistelltisch, Vogelkäfig-Ständer
  wains(XH0 + 0.2, XH1 - 0.2, fyA, 0.65, [-1]);
  rug(7.6, -3.0, fyA, 5.4, 3.6, 0, 'rugC');
  // Messe: drei Deckenlampen (Milchglas in Messing)
  for (const x of [26.5, 30.5, 34.5]) { KI.add('lit', new T.SphereGeometry(0.2, 12, 8, 0, 6.3, 0, 1.6).translate(x, fyA - 0.32, 0), [1.4, 1.3, 1.1]); KI.add('gold', new T.CylinderGeometry(0.22, 0.22, 0.04, 14).translate(x, fyA - 0.33, 0)); glow(x, fyA - 0.5, 0, [1.4, 1.25, 1.0], 0.8); }
  painting(0, XH0 + 0.08, fyA + 1.75, -4.9, 1.1, 1.35, Math.PI / 2); painting(5, XH1 - 0.08, fyA + 1.75, -3.6, 1.1, 1.35, -Math.PI / 2);
  fur(FURN.clubChair(), FMV, { velvet: [0.86, 0.76, 0.56] }, 5.3, fyA, -6.0, Math.PI / 2 + 0.5); fur(FURN.roundTable(0.32, 0.55), FMV, { wood: [0.55, 0.32, 0.18] }, 6.3, fyA, -6.2);
  // Salon: Gemälde an der Wand zur Bibliothek, Beistelltisch mit Grammophon am Flügel, Vorhänge an den Panoramafenstern
  painting(2, XS + 0.08, fyA + 1.8, -4.4, 1.2, 1.5, Math.PI / 2); painting(4, XS + 0.08, fyA + 1.8, 3.1, 1.0, 1.25, Math.PI / 2);
  fur(FURN.roundTable(0.36, 0.62), FMV, { wood: [0.08, 0.08, 0.09] }, 44.6, fyA, -5.4);
  drapes(XS, XF, fyA, 3.15, VEL);
  movOff();

  // Lose Dinge an Bord: [Art, x, Oberfläche y, z, Drehung] in Schiffskoordinaten; beim Näherkommen ausgelegt (impShipSpawns)
  const S = IMP.items = [];
  const put = (t, x, y, z, a = 0) => S.push([t, x, y, z, a]);
  // Achterdeck
  for (const [x, z] of [[-18.5, 3.6], [-14.6, 4.2]]) { put('champagne', x + 0.18, fyB + 0.77, z - 0.12); put('coupe', x - 0.2, fyB + 0.77, z + 0.15); put('coupe', x + 0.05, fyB + 0.77, z + 0.25); }
  put('icebucket', -16.2, fyB, -3.4); put('deckchair', -20.3, fyB, 1.4, 1.4); put('lifebuoy', -13.5, fyB, -1.8); put('ropecoil', -21, fyB, -2.5); put('cushion', -17.6, fyB + 0.52, -4.8, 0.3);
  // Speisesalon: Schalen an jedem zweiten Platz, Flaschen, Kühler, Teeservice auf den Anrichten
  for (let i = 0; i < 7; i += 1) for (const s of [-1, 1]) if ((i + (s > 0 ? 1 : 0)) % 2 === 0) put('coupe', -7.6 + i * 1.2 + 0.18, fyB + 0.795, s * 0.27);
  put('champagne', -5.0, fyB + 0.795, 0.12); put('decanter', -3.0, fyB + 0.795, -0.12);
  put('icebucket', XT + 0.42, fyB + 0.95, -4.4); put('champagne', XT + 0.42, fyB + 0.95, -3.7); put('teatray', XT + 0.42, fyB + 0.95, 4.4, Math.PI / 2); put('candlestick', XT + 0.42, fyB + 0.95, 3.6);
  // Treppenhalle: Gepäck, Schirmständer, Garderobe, Vase, Uhr und Fernsprecher auf der Konsole
  put('trunk', 10.1, fyB, -4.5, 0.2); put('suitcase', 9.0, fyB, -4.9, -0.2); put('suitcase', 9.0, fyB + 0.42, -4.9, 0.1); put('hatbox', 10.1, fyB + 0.52, -4.5);
  put('umbrellastand', 8.6, fyB, -6.35); put('hatstand', 9.4, fyB, -6.2);
  put('flowervase', XH1 - 0.3, fyB + 0.89, -3.6); put('clock', XH1 - 0.3, fyB + 0.89, -4.1, -Math.PI / 2); put('telephone', XH1 - 0.3, fyB + 0.89, -3.05);
  // Küche
  for (let k = 0; k < 4; k++) { put(k % 2 ? 'orange' : 'apple', 14.2 + k * 0.18, fyB + 0.95, -6.4); put(k % 2 ? 'apple' : 'orange', 20.4 + k * 0.18, fyB + 0.95, 6.4); }
  put('champagne', 16.8, fyB + 0.95, 6.45); put('champagne', 17.1, fyB + 0.95, 6.45); put('decanter', 22.0, fyB + 0.95, -6.45); put('teatray', 19.0, fyB + 0.95, -6.4);
  put('fruitcrate', 22.9, fyB, -4.8); put('sack', 23.2, fyB, 4.9); put('winecrate', 13.2, fyB, 4.9); put('winecrate', 13.2, fyB + 0.44, 4.9, 0.2); put('bucket', 14.0, fyB, -4.9); put('milkcan', 22.9, fyB, -3.9);
  // Messe und Funkraum
  put('tumbler', 33.6, fyB + 0.78, -3.2); put('tumbler', 35.0, fyB + 0.78, -2.8); put('whisky', 34.4, fyB + 0.78, -3.0); put('ashtray', 33.9, fyB + 0.78, -2.75); put('chessboard', 35.4, fyB + 0.78, -3.25, 0.2); put('lantern', 32.9, fyB + 0.78, -2.8);
  put('papers', 36.5, fyB + 0.76, -6.55, 0.1); put('telephone', 37.3, fyB + 0.76, -6.55);
  put('toolbox', 31.8, fyB, 3.6); put('ropecoil', 25.2, fyB, 3.2); put('mailsack', 31.9, fyB, -5.9); put('bottlecrate', 26.0, fyB, -0.4, 0.3); put('suitcase', 28.6, fyB, 3.3, 1.4);
  // Brücke
  put('book', 41.6, fyB + 0.89, 4.3, 0.2); put('lantern', 42.6, fyB + 0.89, 4.6); put('clock', 42.2, fyB + 0.89, 4.1, Math.PI); put('ropecoil', 39.0, fyB, -5.8); put('lifebuoy', 39.2, fyB, 5.6);
  // Suite
  put('book', -4.15, fyA + 0.6, 1.98); put('clock', -4.15, fyA + 0.6, -1.98, -Math.PI / 2); put('cushion', -4.6, fyA + 0.72, 0.4, 0.2); put('cushionC', -4.6, fyA + 0.72, -0.4, -0.3);
  put('frame', -8.6, fyA + 0.79, -ZI + 0.3); put('flowervase', -7.7, fyA + 0.79, -ZI + 0.32); put('candlestick', -8.1, fyA + 0.79, -ZI + 0.25);
  put('decanter', XT + 1.45, fyA + 0.55, -0.1); put('tumbler', XT + 1.65, fyA + 0.55, 0.15); put('tumbler', XT + 1.3, fyA + 0.55, 0.15);
  put('trunk', -9.8, fyA, 5.6, 0.1); put('suitcase', -8.4, fyA, 6.1, -0.1); put('hatbox', -6.6, fyA + 0.46, 0.5);
  // Galerie
  put('candlestick', 7.3, fyA + 0.87, -ZI + 0.27); put('statuette', 8.7, fyA + 0.87, -ZI + 0.27); put('book', 6.3, fyA + 0.55, -6.2, 0.4); put('birdcage', 10.6, fyA, -6.3);
  // Bibliothek und Arbeitszimmer
  put('typewriter', 16.5, fyA + 0.8, -3.75, Math.PI); put('book', 17.5, fyA + 0.8, -3.3, 0.3); put('book', 17.55, fyA + 0.905, -3.3, 0.1); put('telephone', 16.0, fyA + 0.8, -3.95); put('ashtray', 17.9, fyA + 0.8, -3.35); put('cigarbox', 15.95, fyA + 0.8, -3.3, 0.3);
  put('decanter', 17.3, fyA + 0.48, 1.2); put('tumbler', 17.8, fyA + 0.48, 1.4); put('tumbler', 17.0, fyA + 0.48, 1.45); put('chessboard', 18.0, fyA + 0.48, 1.15, 0.1);
  put('book', 12.9, fyA, -2.0, 0.6); put('book', 12.9, fyA + 0.105, -2.0, 0.3); put('globe', 14.6, fyA, -5.6);
  // Großer Salon
  for (const [x, z] of [[31, -2.6], [39, 1.2], [45.6, 0]]) { put('coupe', x - 0.05, fyA + 0.47, z - 0.18); put('coupe', x + 0.12, fyA + 0.47, z + 0.2); put(x > 40 ? 'cigarbox' : 'ashtray', x - 0.55, fyA + 0.47, z + 0.18); }
  put('champagne', 31.0, fyA + 0.47, -2.45); put('book', 39.55, fyA + 0.47, 1.0, 0.5);
  put('icebucket', 28.0, fyA + 1.14, 4.6); put('champagne', 28.35, fyA + 1.14, 4.75); for (let k = 0; k < 4; k++) put('coupe', 29.3 + k * 0.3, fyA + 1.14, 4.55 + (k % 2) * 0.12);
  put('shaker', 31.2, fyA + 1.14, 4.6); put('whisky', 26.7, fyA + 1.14, 4.7); put('tumbler', 27.15, fyA + 1.14, 4.5); put('decanter', 31.8, fyA + 1.14, 4.7);
  put('gramophone', 44.6, fyA + 0.62, -5.4, 0.6); put('record', 39.9, fyA, -6.2); put('cushion', 31.6, fyA + 0.48, -3.85, 0.4); put('cushionC', 38.4, fyA + 0.48, 2.45, -0.2); put('flowervase', 46.9, fyA + 0.47, 0.25);

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
  // V54: Möbel und lose Dinge fahren mit; was über die Reling fliegt, gehört wieder der Stadt
  IMP.fr.pf = IMP.pf;
  RIDES.push({ pf: IMP.pf, inside: (lx, ly, lz) => lx > XA - 0.6 && lx < XF + 0.6 && Math.abs(lz) < ZW + 0.4 && ly > fyB - 1.2 && ly < yR + 0.6 });
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
  impVillaMast();   // V58: Ankermast an der Villa, Rufsäule auf der untersten Terrasse
  impInteractions();
  buildBordservice();   // V58: Stewards, Sitzplätze mit Bedienung
}
IMP._p = { x: 0, y: 0, z: 0, ry: 0 }; IMP._q = { x: 0, y: 0, z: 0, ry: 0 };

// Rufsäule auf der Ballsaal-Terrasse des Belmont: Messingsäule mit türkisem Signallicht
export function buildImperialCallPost() { impCallPost(5.2, BEL.s2, 22.6); }

/* ---------- Flug ----------
   V58: Lagen des Schiffs: cruise (Schleife über der Stadt), moor (Ankermast des Belmont), moorV (Ankermast der Villa),
   hold (in der Luft stehen), helm (Alexander steuert selbst), blend (unterwegs zwischen zwei Lagen). */
export function impPose(kind, t, o) {
  const I = IMP;
  if (kind === 'moor') {
    // am Ankermast des Belmont: Bug am Mast, das Heck dreht langsam mit dem Wind
    const a = Math.sin(t * 0.025) * 0.5 + 2.2, d = I.L / 2 + 3;
    o.x = Math.cos(a) * d; o.y = BEL.mast - 2 + Math.sin(t * 0.35) * 0.3; o.z = Math.sin(a) * d; o.ry = Math.PI - a;
    return o;
  }
  if (kind === 'moorV') {
    // V58: am Ankermast der Villa: Bug am Mast (zum Haus), die Hülle hängt über dem Tal zur Stadt hin; kaum Schwojen
    const m = VILLA.imast, ry = Math.atan2(VILLA.uz, -VILLA.ux) + Math.sin(t * 0.02) * 0.05, d = I.L / 2 + 3;
    o.x = m.x - Math.cos(ry) * d; o.z = m.z + Math.sin(ry) * d; o.y = m.y - 2 + Math.sin(t * 0.35) * 0.3; o.ry = ry;
    return o;
  }
  if (kind === 'hold') { const h = I.hp; o.x = h.x; o.y = h.y + Math.sin(t * 0.3) * 0.5; o.z = h.z; o.ry = h.ry; return o; }
  const s = I.s, p = I.curve.getPointAt(s), tg = I.curve.getTangentAt(s);
  o.x = p.x; o.y = p.y + I.lift(s) + Math.sin(t * 0.25) * 0.8; o.z = p.z; o.ry = Math.atan2(-tg.z, tg.x);
  return o;
}
export function impApply(o) { IMP.g.position.set(o.x, o.y, o.z); IMP.g.rotation.set(0, o.ry, 0); }
const wrapA = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
// Mindesthöhe der Schiffsmitte an einem Punkt: über Türmen (Gondel hängt 37 m unter der Mitte) und über dem Gelände
export function impNeed(x, z, ry) {
  const c = Math.cos(ry || 0), s = -Math.sin(ry || 0);
  let n = Math.max(skyline(x, z, 40) + 45, terrainHeight(x, z) + 55);
  for (const k of [-90, 90]) { const px = x + c * k, pz = z + s * k; n = Math.max(n, skyline(px, pz, 40) + 36, terrainHeight(px, pz) + 42); }
  return n;
}
export function impBlend(to) {
  const I = IMP, g = I.g, p = g.position;
  if (to === 'hold') { I.hp = { x: p.x, y: p.y, z: p.z, ry: g.rotation.y }; I.st = 'hold'; I.b = null; return; }
  if (to === 'cruise') {
    // nächsten Punkt der Schleife suchen und ein Stück voraus einfädeln
    let best = 0, bd = 1e18; for (let k = 0; k < 64; k++) { const q = I.curve.getPointAt(k / 64), d = (q.x - p.x) ** 2 + (q.z - p.z) ** 2; if (d < bd) { bd = d; best = k / 64; } }
    I.s = (best + Math.max(0.03, Math.min(0.25, (500 + Math.sqrt(bd) * 0.5) / I.len))) % 1;
  }
  impPose(to, 0, I._q);
  const rS = Math.hypot(p.x, p.z), aS = Math.atan2(p.z, p.x), rT = Math.hypot(I._q.x, I._q.z);
  if (to === 'moor') {
    const da = wrapA(Math.atan2(I._q.z, I._q.x) - aS);
    const dist = Math.abs(da) * Math.max(rS, 300) + Math.abs(rS - rT) + Math.abs(p.y - I._q.y);
    const aT = Math.atan2(I._q.z, I._q.x), atArc = u => { const ea = easeIO(Math.min(1, u / 0.7)), er = easeIO(Math.max(0, (u - 0.3) / 0.7)), a = aS + da * ea, r = rS + (rT - rS) * er; return [Math.cos(a) * r, Math.sin(a) * r]; };
    I.b = { t: 0, D: Math.min(150, Math.max(35, dist / 10)), to, kind: 'arc', x: p.x, y: p.y, z: p.z, ry: g.rotation.y, rS, aS, lift: impLiftPlan(atArc, p.y, I._q.y) };
    I.st = 'blend'; return;
  }
  // V58: freie Fahrt von Lage zu Lage: erst (vom Mast) ein Stück achteraus, dann eine weiche Kurve (Hermite) zum Ziel,
  // die Nase folgt dem Weg und steht am Ende in Zielrichtung; die Höhe hebt sich über Türme und Gelände
  const q = I._q, ry0 = g.rotation.y, moored = I.st === 'moor' || I.st === 'moorV';
  const f0 = [Math.cos(ry0), -Math.sin(ry0)], f1 = [Math.cos(q.ry), -Math.sin(q.ry)], back = moored ? 70 : 0;
  const A = [p.x - f0[0] * back, p.y, p.z - f0[1] * back];
  const dx = q.x - A[0], dz = q.z - A[2], L = Math.max(60, Math.hypot(dx, dz));
  const m0 = [(f0[0] * 0.35 + dx / L * 0.65) * L * 0.45, (f0[1] * 0.35 + dz / L * 0.65) * L * 0.45], m1 = [f1[0] * L * 0.5, f1[1] * L * 0.5];
  const H = (u, a, b, ma, mb) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * ma + (-2 * u3 + 3 * u2) * b + (u3 - u2) * mb; };
  const at = u => [H(u, A[0], q.x, m0[0], m1[0]), H(u, A[2], q.z, m0[1], m1[1])];
  // Höhe nach zurückgelegtem Weg (nicht nach Zeit), damit Steigen und Sinken gleichmäßig bleiben, wo der Weg sich krümmt
  const cum = new Float32Array(LIFT_N + 1); for (let i = 1; i <= LIFT_N; i++) { const [ax, az] = at((i - 1) / LIFT_N), [bx, bz] = at(i / LIFT_N); cum[i] = cum[i - 1] + Math.hypot(bx - ax, bz - az); }
  const sig = u => { const f = u * LIFT_N, i = Math.min(LIFT_N - 1, Math.floor(f)); return (cum[i] * (1 - (f - i)) + cum[i + 1] * (f - i)) / (cum[LIFT_N] || 1); };
  const DB = moored ? 14 : 0, DH = Math.max(30, L / 12 + 10);
  I.b = { t: 0, D: DB + DH, to, kind: 'path', DB, DH, A, q: { ...q }, ry0, f0, at, sig, lift: impLiftPlan(at, A[1], q.y), x: p.x, y: p.y, z: p.z };
  I.st = 'blend';
}
// Höhenbedarf entlang eines Wegs at(u) -> [x, z] (geglättet, an den Enden ausgeblendet): Zuschlag zur geraden Höhenlinie y0..y1
const LIFT_N = 32;
export function impLiftPlan(at, y0, y1) {
  const N = LIFT_N, need = new Float32Array(N + 1), lift = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const u = i / N, [x, z] = at(u), [x2, z2] = at(Math.min(1, u + 0.02)); need[i] = impNeed(x, z, Math.atan2(-(z2 - z), x2 - x)); }
  for (let i = 0; i <= N; i++) { let m = 0; for (let k = -2; k <= 2; k++) m = Math.max(m, need[Math.max(0, Math.min(N, i + k))]); lift[i] = Math.max(0, m - (y0 + (y1 - y0) * i / N)); }
  // Steigen und Sinken höchstens mit 0,3 (17°): Täler auffüllen, zu den Enden hin (Lage am Mast ist vorgegeben) abfallen lassen
  const ds = new Float32Array(N), SL = 0.3; let dist = 0;
  for (let i = 0; i < N; i++) { const [ax, az] = at(i / N), [bx, bz] = at((i + 1) / N); ds[i] = Math.hypot(bx - ax, bz - az); dist += ds[i]; }
  for (let i = 1; i <= N; i++) lift[i] = Math.max(lift[i], lift[i - 1] - SL * ds[i - 1]);
  for (let i = N - 1; i >= 0; i--) lift[i] = Math.max(lift[i], lift[i + 1] - SL * ds[i]);
  let d0 = 0; for (let i = 0; i <= N; i++) { lift[i] = Math.min(lift[i], 0.6 * d0, SL * (dist - d0)); if (i < N) d0 += ds[i]; }   // am Anfang darf es steiler hinauf (Turm gleich voraus)
  return lift;
}
const liftAt = (lift, u) => { const f = u * LIFT_N, i = Math.min(LIFT_N - 1, Math.floor(f)); return lift[i] * (1 - (f - i)) + lift[i + 1] * (f - i); };
export function updateImperial(dt, t) {
  const I = IMP; if (!I.g) return;
  const o = I._p;
  if (I.st === 'cruise') { I.s = (I.s + I.v * dt / I.len) % 1; impApply(impPose('cruise', t, o)); }
  else if (I.st === 'moor' || I.st === 'moorV' || I.st === 'hold') impApply(impPose(I.st, t, o));
  else if (I.st === 'helm') { /* Alexander steuert (impHelmInput, aus performance.js) */ }
  else {
    const b = I.b; b.t += dt;
    if (b.kind === 'arc') {
      impPose(b.to, t, o);
      const u = Math.min(1, b.t / b.D), k = easeIO(u);
      // Anflug zum Belmont im Bogen um den Turm (erst herumfahren, dann gerade auf den Mast zu), nie quer über die Turmspitze
      const at = (q, out) => {
        const ea = easeIO(Math.min(1, q / 0.7)), er = easeIO(Math.max(0, (q - 0.3) / 0.7)), rT = Math.hypot(o.x, o.z), a = b.aS + wrapA(Math.atan2(o.z, o.x) - b.aS) * ea, r = b.rS + (rT - b.rS) * er;
        out.x = Math.cos(a) * r; out.z = Math.sin(a) * r; return out;
      };
      const q0 = at(u, IMP._q), x0 = q0.x, z0 = q0.z, q1 = at(Math.min(1, u + 0.01), IMP._q), mv = Math.atan2(-(q1.z - z0), q1.x - x0);
      // Bug in Fahrtrichtung, zuletzt auf den Mast ausgerichtet
      const ky = u < 0.02 ? 0 : 1, kf = Math.min(1, Math.max(0, (u - 0.55) / 0.4)), yMove = b.ry + wrapA(mv - b.ry) * easeIO(Math.min(1, u / 0.15)) * ky;
      o.ry = yMove + wrapA(o.ry - yMove) * easeIO(kf); o.x = x0; o.z = z0; o.y = b.y + (o.y - b.y) * k + liftAt(b.lift, u);
    } else {
      impPose(b.to, t, o);   // Ziel (mit Schwojen und Wellen des Ziels)
      if (b.t < b.DB) {
        // vom Mast achteraus, Kurs bleibt
        const k = easeIO(b.t / b.DB); o.x = b.x + (b.A[0] - b.x) * k; o.z = b.z + (b.A[2] - b.z) * k; o.y = b.y; o.ry = b.ry0;
      } else {
        const u = Math.min(1, (b.t - b.DB) / b.DH), ue = easeIO(u), [x, z] = b.at(ue), [x2, z2] = b.at(Math.min(1, ue + 0.004)), lf = liftAt(b.lift, ue);
        const tang = Math.hypot(x2 - x, z2 - z) > 0.01 ? Math.atan2(-(z2 - z), x2 - x) : o.ry;
        const kt = easeIO(Math.min(1, u / 0.22)), kf = easeIO(Math.max(0, (u - 0.8) / 0.2));
        const head = b.ry0 + wrapA(tang - b.ry0) * kt;
        o.ry = head + wrapA(o.ry - head) * kf; o.x = x; o.z = z; o.y = b.y + (o.y - b.y) * easeIO(b.sig(ue)) + lf;
      }
    }
    impApply(o);
    if (b.t >= b.D) {
      I.st = b.to; I.b = null;
      if (b.to === 'hold') I.hp = { x: o.x, y: o.y, z: o.z, ry: o.ry };
      if (player.on === I.pf) toast(b.to === 'moor' ? 'Die Aurora Imperial hat am Ankermast des Belmont festgemacht' : b.to === 'moorV' ? 'Die Aurora Imperial hat am Ankermast der Villa festgemacht' : 'Die Aurora Imperial kreuzt über Vespera');
    }
  }
  // Inneres nur aus der Nähe; aus der Ferne leuchten die Fensterbänder
  if ((I.cullT -= dt) <= 0) {
    I.cullT = 0.4;
    impSpawnCheck();
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
  updateBordservice(dt);   // V58: Stewards an Bord
}

/* ---------- V58: Alexander am Steuer ---------- */
export const HELM = { v: 0, vy: 0, w: 0, cam: 'innen', camP: null, low: 0, hud: 0 };
const KMH = v => Math.round(Math.abs(v) * 3.6);
const COMPASS = a => ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round((((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8];
export function impTakeHelm() {
  const I = IMP; if (!I.g || player.on !== I.pf) return;
  if (DINE.seat) standUp();
  I.st = 'helm'; I.b = null; HELM.v = HELM.vy = HELM.w = 0; HELM.cam = 'innen'; HELM.low = 0;
  player.fly = false; player.yaw = I.g.rotation.y - Math.PI / 2; player.pitch = -0.02;
  const h = $('helm'); if (h) h.hidden = false;
  toast('Sie haben das Steuer · W/S Fahrt · A/D Ruder · Leertaste/C steigen, sinken · Shift volle Kraft · V Ansicht · E Steuer abgeben');
}
export function impLeaveHelm(to) {
  const I = IMP; if (I.st !== 'helm') return;
  const h = $('helm'); if (h) h.hidden = true;
  if (HELM.cam === 'aussen') { HELM.cam = 'innen'; player.yaw = I.g.rotation.y - Math.PI / 2; player.pitch = 0; }
  I.st = 'hold'; I.hp = { x: I.g.position.x, y: I.g.position.y, z: I.g.position.z, ry: I.g.rotation.y };
  if (to && to !== 'hold') impBlend(to);
}
// jedes Bild statt updatePlayer: Alexander steht am Steuer, das Schiff folgt den Tasten (träge wie 250 m Schiff)
export function impHelmInput(dt) {
  const I = IMP, pf = I.pf, D = I.D;
  if (player.fly || player.on !== pf) { impLeaveHelm('hold'); return; }
  const c = Math.cos(pf.ry), s = Math.sin(pf.ry), lx = D.XF - 3.2;
  player.p.set(pf.x + lx * c, pf.y + D.fyB, pf.z - lx * s); player.v.set(0, 0, 0); player.onGround = true; player.on = pf;
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touch.my;
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.mx;
  const up = (keys.Space ? 1 : 0) - (keys.KeyC || keys.KeyQ || keys.ControlLeft ? 1 : 0) + touch.up - touch.down;
  const fast = keys.ShiftLeft || keys.ShiftRight, vMax = fast ? 48 : 26;
  const vWant = fwd > 0 ? vMax * Math.min(1, fwd) : fwd < 0 ? 8 * Math.max(-1, fwd) : 0;
  HELM.v += (vWant - HELM.v) * Math.min(1, dt * (Math.abs(vWant) > Math.abs(HELM.v) ? 0.3 : 0.5));
  HELM.w += (-Math.max(-1, Math.min(1, side)) * 0.065 - HELM.w) * Math.min(1, dt * 0.9);
  HELM.vy += (Math.max(-1, Math.min(1, up)) * 7 - HELM.vy) * Math.min(1, dt * 1.1);
  const o = I._p, g = I.g; o.x = g.position.x; o.y = g.position.y; o.z = g.position.z; o.ry = g.rotation.y;
  o.ry += HELM.w * dt * (0.4 + 0.6 * Math.min(1, Math.abs(HELM.v) / 12));   // Ruder wirkt erst mit Fahrt
  o.x += Math.cos(o.ry) * HELM.v * dt; o.z -= Math.sin(o.ry) * HELM.v * dt; o.y += HELM.vy * dt;
  // nicht in Türme, Berge oder den Himmel; nicht aus dem Krater hinaus
  const need = impNeed(o.x, o.z, o.ry);
  HELM.low = Math.max(0, HELM.low - dt);
  if (o.y < need) { o.y += (need - o.y) * Math.min(1, dt * 1.8); if (HELM.vy < 0) HELM.vy = 0; HELM.low = 1.5; }
  if (o.y > 1500) { o.y = 1500; HELM.vy = Math.min(0, HELM.vy); }
  const r = Math.hypot(o.x, o.z); if (r > 2400) { o.x *= 2400 / r; o.z *= 2400 / r; HELM.v *= 0.5; HELM.low = 1.5; }
  impApply(o);
  if ((HELM.hud -= dt) <= 0) {
    HELM.hud = 0.25; const h = $('helm');
    if (h) h.innerHTML = `<b>${HELM.low > 0 ? 'Der Steuermann hält das Schiff frei' : 'Aurora Imperial'}</b> Fahrt ${KMH(HELM.v)} km/h${HELM.v < -0.5 ? ' achteraus' : ''} · Höhe ${Math.round(o.y)} m · Kurs ${COMPASS(Math.PI / 2 - o.ry)}${HELM.vy > 0.5 ? ' · steigt' : HELM.vy < -0.5 ? ' · sinkt' : ''}<br><kbd>W S</kbd> Fahrt <kbd>A D</kbd> Ruder <kbd>Leer C</kbd> Höhe <kbd>Shift</kbd> volle Kraft <kbd>V</kbd> Ansicht <kbd>E</kbd> Steuer abgeben`;
  }
}
// V: Ich-Ansicht am Steuer, von hinten, Außenansicht des ganzen Schiffs
export function impToggleCam() {
  const I = IMP;
  if (HELM.cam === 'aussen') { HELM.cam = 'innen'; if (PM.view === 'third') toggleView(); player.yaw = I.g.rotation.y - Math.PI / 2; player.pitch = 0; return 'Ich-Ansicht am Steuer'; }
  if (PM.view !== 'third') { toggleView(); return 'Ansicht von hinten'; }
  HELM.cam = 'aussen'; HELM.camP = null; player.yaw = I.g.rotation.y - Math.PI / 2; player.pitch = -0.22; return 'Außenansicht';
}
export function impHelmCamera(dt) {
  const g = IMP.g, yaw = player.yaw, pitch = Math.max(-1.1, Math.min(0.6, player.pitch)), cp = Math.cos(pitch), dist = 285;
  const fx = -Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = -Math.cos(yaw) * cp;
  const tx = g.position.x - fx * dist, ty = g.position.y - fy * dist + 12, tz = g.position.z - fz * dist;
  if (!HELM.camP) HELM.camP = new T.Vector3(tx, ty, tz); else HELM.camP.lerp(new T.Vector3(tx, ty, tz), 1 - Math.exp(-dt * 5));
  camera.position.copy(HELM.camP); camera.rotation.set(pitch, yaw, 0);
}
export const IMP_CAPT_OK = ['Sehr wohl, Sir.', 'Zu Befehl, Sir. Maschinen halbe Kraft.', 'Wird gemacht, Sir. Ruder liegt an.'];
export function impCaptainMenu() {
  const I = IMP, st = I.st, opts = [], acts = [];
  const add = (l, f) => { opts.push(l); acts.push(f); };
  const ok = (to, line) => () => { impBlend(to); lifeSay('Der Kapitän', line, 4); };
  if (st === 'helm') {
    add('Weiter selbst steuern', () => {});
    add('Steuer abgeben: hier in der Luft bleiben', () => { impLeaveHelm('hold'); lifeSay('Der Kapitän', 'Ich übernehme, Sir. Wir halten die Position.', 4); });
    add('Steuer abgeben: über Vespera kreuzen', () => { impLeaveHelm('cruise'); lifeSay('Der Kapitän', 'Ich übernehme, Sir. Wir kreuzen über der Stadt.', 4); });
    add('Steuer abgeben: Kurs Belmont, festmachen', () => { impLeaveHelm('moor'); lifeSay('Der Kapitän', 'Ich übernehme, Sir. Kurs auf den Belmont.', 4); });
    add('Steuer abgeben: Kurs Villa, festmachen', () => { impLeaveHelm('moorV'); lifeSay('Der Kapitän', 'Ich übernehme, Sir. Kurs auf Ihre Villa.', 4); });
  } else {
    add('Ich übernehme das Steuer', () => { impTakeHelm(); lifeSay('Der Kapitän', 'Das Schiff gehört Ihnen, Sir. Sachte mit dem Ruder, sie ist 250 Meter lang.', 5); });
    if (st !== 'moor' && !(st === 'blend' && I.b.to === 'moor')) add('Kurs auf das Belmont, am Ankermast festmachen', ok('moor', 'Sehr wohl, Sir. Kurs auf den Belmont.'));
    if (st !== 'moorV' && !(st === 'blend' && I.b.to === 'moorV')) add('Kurs auf die Villa, am Ankermast festmachen', ok('moorV', 'Sehr wohl, Sir. Kurs auf Ihre Villa am Berg.'));
    if (st !== 'cruise' && !(st === 'blend' && I.b.to === 'cruise')) add('Über Vespera kreuzen', ok('cruise', 'Leinen los, Sir. Wir kreuzen über der Stadt.'));
    if (st !== 'hold' && st !== 'moor' && st !== 'moorV') add('Hier in der Luft stehen bleiben', () => { impBlend('hold'); lifeSay('Der Kapitän', 'Maschinen stopp, Sir. Wir halten die Position.', 4); });
    add('Wie steht es, Kapitän?', () => { I.said = (I.said + 1) % IMP_CAPTAIN.length; lifeSay('Der Kapitän', IMP_CAPTAIN[I.said], 5); });
  }
  openChoice('Kapitän der Aurora Imperial', opts, i => { if (acts[i]) acts[i](); });
}

/* ---------- V58: Ankermast der Villa (am Hang unter der untersten Terrasse, zur Stadt hin) und Rufsäule auf der Terrasse ---------- */
export function impVillaMast() {
  planVillaSite();
  const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry), W = (lx, lz) => [VILLA.x + lx * cs + lz * sn, VILLA.z - lx * sn + lz * cs];
  const [mx, mz] = W(-62, 112), by = VILLA.y, base = Math.min(by - 20, terrainHeight(mx, mz) - 1), top = by + 8, H = top - base;
  VILLA.imast = { x: mx, z: mz, y: top, base };
  const K = impKit();
  // Stahlgitter: vier geneigte Beine, Ringe, Diagonalen; oben Goldkrone mit Ring und rotem Licht
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) K.add('iron', new T.CylinderGeometry(0.22, 0.42, H, 6).translate(0, H / 2, 0).rotateZ(-dx * 2.6 / H).rotateX(dz * 2.6 / H).translate(mx + dx * 2.6, base, mz + dz * 2.6), [0.42, 0.42, 0.44]);
  for (let y = 4; y < H - 2; y += 4) { const r = 2.6 + 2.2 * (1 - (y + 2) / H); K.add('iron', new T.TorusGeometry(r * 1.414, 0.09, 4, 4).rotateX(Math.PI / 2).rotateY(Math.PI / 4).translate(mx, base + y, mz), [0.42, 0.42, 0.44]); }
  K.add('gold', new T.CylinderGeometry(1.6, 1.8, 0.7, 16).translate(mx, top - 0.35, mz));
  K.add('gold', lathe([[1.0, 0], [1.2, 0.3], [0.7, 0.9], [0.55, 1.6], [0.001, 1.9]], 16).translate(mx, top, mz));
  K.add('gold', new T.TorusGeometry(1.3, 0.12, 6, 24).rotateX(Math.PI / 2).translate(mx, top + 1.0, mz));
  K.add('lit', new T.SphereGeometry(0.3, 12, 8).translate(mx, top + 2.2, mz), [1.6, 0.25, 0.15]);
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.add('lit', new T.SphereGeometry(0.12, 8, 6).translate(mx + Math.cos(a) * 1.7, top - 0.1, mz + Math.sin(a) * 1.7), [1.5, 1.15, 0.7]); }
  K.build(scene);
  scene.add(makeGlowPoints([{ p: [mx, top + 2.2, mz], c: [1.6, 0.2, 0.12], s: 5, ph: 0, bl: 1 }, { p: [mx, top - 0.1, mz], c: [1.4, 1.0, 0.55], s: 4, ph: 0, bl: 0 }]));
  addCollider(mx - 3, base, mz - 3, mx + 3, top + 1, mz + 3);
  // Rufsäule auf der untersten Terrasse: von hier geht es an Bord (Zubringer, oder die Gangway, wenn das Schiff am Mast liegt)
  const [px, pz] = W(-12, 87); VILLA.ipost = { x: px, y: by - 17, z: pz };
  impCallPost(px, by - 17, pz);
}
export function impCallPost(x, y, z) {
  const K = impKit();
  K.add('gold', lathe([[0.32, 0], [0.32, 0.12], [0.2, 0.2], [0.13, 0.3], [0.1, 1.0], [0.16, 1.1], [0.2, 1.18], [0.001, 1.2]], 16).translate(x, y, z));
  K.add('lit', new T.SphereGeometry(0.17, 14, 10).translate(x, y + 1.38, z), [0.4, 1.5, 1.4]);
  K.add('gold', new T.TorusGeometry(0.19, 0.02, 4, 18).rotateX(Math.PI / 2).translate(x, y + 1.38, z));
  K.add('fan', new T.PlaneGeometry(0.5, 0.25).translate(x, y + 0.85, z + 0.12));
  K.build(scene);
  scene.add(makeGlowPoints([{ p: [x, y + 1.38, z], c: [0.4, 1.4, 1.3], s: 1.6, ph: 0, bl: 0 }]));
  addCollider(x - 0.32, y, z - 0.32, x + 0.32, y + 1.3, z + 0.32);
}
// An Bord und im geschlossenen Teil der Gondel: kein Regen, kein Bodennebel
/* V54: lose Dinge an Bord: jeweils nur die in Alexanders Nähe (gleiches Deck, 22 m) liegen als Körper aus (ruhend, genau
   auf ihren Flächen), damit die Telekinese in der Stadt noch Platz hat. Unberührte Dinge weiter weg verschwinden wieder,
   bewegte bleiben, wo sie liegen. Schiff weit weg: alles zurück, beim nächsten Besuch neu ausgelegt. */
function impSpawnItem(it) {
  const pf = IMP.pf, c = Math.cos(pf.ry), s = Math.sin(pf.ry), [type, lx, ly, lz, a] = it;
  const B = spawnProp(type, pf.x + lx * c + lz * s, pf.y + ly, pf.z - lx * s + lz * c, a + pf.ry);
  if (B) { rideOn(B, pf); B.awake = false; it.B = B; it.y0 = B.x.y - pf.y; }
  return B;
}
export function impShipSpawns(all) {
  const I = IMP; if (!I.pf || !I.items) return;
  I.spawned = true;
  const q = impLocal(player.p), R2 = 22 * 22;
  I.items.forEach((it, i) => {
    if (MOBILE && i % 2) return;
    if (it.B && !LOOSE.bodies.includes(it.B)) { it.B = null; it.gone = true; }   // zerbrochen oder über Bord
    if (it.gone) return;
    const near = all || (q && (it[1] - q.lx) ** 2 + (it[3] - q.lz) ** 2 < R2 && Math.abs(it[2] - q.ly) < 3.2);
    if (near && !it.B) impSpawnItem(it);
    else if (!near && it.B && !all) {
      const B = it.B, l = impLocal(B.x);
      if (!B.awake && B !== LOOSE.held && B !== LOOSE.tk && Math.abs(l.lx - it[1]) < 0.06 && Math.abs(l.lz - it[3]) < 0.06 && Math.abs(l.ly - it.y0) < 0.06) { dropBody(B); it.B = null; }
    }
  });
}
function impSpawnCheck() {
  const I = IMP; if (!I.pf || !I.items) return;
  const d2 = (player.p.x - I.pf.x) ** 2 + (player.p.z - I.pf.z) ** 2, aboard = player.on === I.pf;
  if (aboard) impShipSpawns(false);
  else if (I.spawned && d2 > 420 * 420) { rideHome(I.pf); I.spawned = false; for (const it of I.items) { it.B = null; it.gone = false; } }
}
export function inImperial(p) {
  const I = IMP; if (!I.pf || player.on !== I.pf || (I.st === 'helm' && HELM.cam === 'aussen')) return false;   // V58: Außenansicht vom Steuer zählt als draußen
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
  const atBel = () => I.st === 'moor', atVilla = () => I.st === 'moorV';
  // V58: liegt das Schiff am Mast, geht es über die Gangway an Bord; sonst holt der Zubringer ab
  INTERACT.push({ test: p => Math.abs(p.x - 5.2) < 1.5 && Math.abs(p.z - 22.6) < 1.6 && Math.abs(p.y - BEL.s2) < 2, get label() { return atBel() ? 'Über die Gangway an Bord der Aurora Imperial' : 'Aurora Imperial rufen · der Zubringer bringt Sie an Bord'; }, act: boardHall });
  INTERACT.push({ test: p => { const m = VILLA.mast; return !!m && Math.hypot(p.x - m.x, p.z - m.z) < 6 && Math.abs(p.y - (m.y - 42)) < 3; }, label: 'Mit dem Zubringer zur Aurora Imperial', act: boardHall });
  INTERACT.push({ test: p => { const m = VILLA.ipost; return !!m && Math.hypot(p.x - m.x, p.z - m.z) < 2.2 && Math.abs(p.y - m.y) < 2; }, get label() { return atVilla() ? 'Über die Gangway an Bord der Aurora Imperial' : 'Aurora Imperial rufen · der Zubringer bringt Sie an Bord'; }, act: boardHall });
  // von Bord: an der Halle (Backbordtür) oder vom Achterdeck; wohin, hängt davon ab, wo das Schiff liegt
  const leaveBel = () => impLeave([3.6, BEL.s2 + 0.1, 22.8], Math.PI, 'The Belmont · Ballsaal-Terrasse');
  const leaveVilla = () => { const m = VILLA.ipost; if (m) impLeave([m.x + 1.6, m.y + 0.05, m.z - 1.2], VILLA.ry + Math.PI, 'Villa · Terrasse'); };
  INTERACT.push({ test: p => aboard(p, 5.6, 8.4, -6.95, -5.0, D.fyB), get label() { return atVilla() ? 'Von Bord gehen · Gangway zur Villa' : atBel() ? 'Von Bord gehen · Gangway zur Belmont-Terrasse' : 'Von Bord gehen · Zubringer zur Belmont-Terrasse'; }, act: () => atVilla() ? leaveVilla() : leaveBel() });
  INTERACT.push({ test: p => aboard(p, D.XA, D.XA + 2.6, -2, 2, D.fyB), get label() { return atBel() ? 'Von Bord gehen · Zubringer zur Villa' : atVilla() ? 'Von Bord gehen · Gangway zur Villa' : 'Von Bord gehen · Zubringer zur Villa'; }, act: leaveVilla });
  // Brücke: Kapitän (Kurs, Steuer) – am Steuer selbst: Steuer abgeben
  INTERACT.push({
    test: p => aboard(p, D.XF - 7, D.XF - 1.2, -2.6, 2.6, D.fyB),
    get label() { return I.st === 'helm' ? 'Steuer abgeben · mit dem Kapitän sprechen' : 'Mit dem Kapitän sprechen · Kurs, Anlegen, selbst steuern'; },
    act: impCaptainMenu,
  });
}
