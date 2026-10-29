import { U, T, mulberry32, canvasTex, mergeGeos, geoView, pick, R, scene, camera, fogHideDist } from './core.js';
import { wantTexture } from './assets.js';
import { stdMat, ENV, addCollider } from './people-skeleton.js';
import { addNeon, NEON, lamps, addGlow, addSeg } from './facade-shader.js';
import { QUAY, QX, landDist } from './island.js';
import { roundBox, lathe, placeFurn, FURN, makeSignTex, neonFrame } from './entrances.js';
import { WATER_Y } from './dance.js';
import { bobVessel, waterH } from './water.js';
import { texSet, woodPanelTextures, worldUV, GOWNS, DRESSES, COL, COATS, CHATS, serpTerrain } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';
import { buildAirship } from './airships.js';
import { player } from './player.js';
import { toast } from './boat.js';
import { INTERACT, travel } from './music.js';
import { liftProfile } from './main.js';

/* =====================================================================
   HAFEN: Kaipromenade, Jachthafen mit begehbaren Booten, Fähre und Luftschiffhafen
   ===================================================================== */
// Plattformen: Boote und Luftschiffe, auf denen man stehen kann. Ihre Quader liegen im eigenen Koordinatensystem und fahren mit
export const PLATFORMS = [], PORT_PEDS = [], VESSELS = [];
U.uWake = { value: [new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0), new T.Vector4(0, 0, 0, 0)] };
export function addPlatform(g, boxes, r, opt = {}) {
  const pf = { g, boxes, r, x: 0, y: 0, z: 0, ry: 0, px: 0, py: 0, pz: 0, pry: 0, air: false, ...opt };
  pfRead(pf); pfSave(pf); PLATFORMS.push(pf); return pf;
}
export function pfRead(pf) { pf.x = pf.g.position.x; pf.y = pf.g.position.y; pf.z = pf.g.position.z; pf.ry = pf.g.rotation.y; }
export function pfSave(pf) { pf.px = pf.x; pf.py = pf.y; pf.pz = pf.z; pf.pry = pf.ry; }
export function pfLocal(pf, x, z) { const c = Math.cos(pf.ry), s = Math.sin(pf.ry), dx = x - pf.x, dz = z - pf.z; return [dx * c - dz * s, dx * s + dz * c]; }
export const bx6 = (x0, y0, z0, x1, y1, z1) => ({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1) });

/* ---------- Texturen: Bohlen, Teak, Mahagoni, Stahlplatten, Granit, Teppich ---------- */
export function boardTex(seed, rows, base, vari, seam, grain, nails) {
  return texSet(256, (g, gr, gh, W) => {
    const rr = mulberry32(seed), h = W / rows;
    g.fillStyle = seam; g.fillRect(0, 0, W, W); gr.fillStyle = '#f2f2f2'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    for (let j = 0; j < rows; j++) {
      const y = j * h; let x = rr() * W; const end = x + W;
      while (x < end - 6) {
        const len = Math.min(end - x, W * (0.3 + rr() * 0.55)), k = 1 + (rr() - 0.5) * vari, rv = 110 + rr() * 100 | 0, hv = 160 + rr() * 60 | 0;
        const lines = []; for (let q = 0; q < 8; q++) lines.push([1.2 + rr() * (h - 2.4), rr(), 0.25 + rr() * 0.6, rr() * 6]);
        const knot = rr() < 0.25 ? [rr() * len, 2 + rr() * (h - 4), 1 + rr() * 2] : null;
        const draw = ox => {
          const bx = x + ox;
          g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; g.fillRect(bx + 0.7, y + 0.7, len - 1.4, h - 1.4);
          gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(bx + 0.7, y + 0.7, len - 1.4, h - 1.4);
          gh.fillStyle = `rgb(${hv},0,0)`; gh.fillRect(bx + 0.7, y + 0.7, len - 1.4, h - 1.4);
          for (const [yy, dk, lw, ph] of lines) {
            g.strokeStyle = dk < 0.65 ? `rgba(0,0,0,${grain})` : `rgba(255,225,180,${grain * 0.6})`; g.lineWidth = lw; g.beginPath();
            for (let s = 0; s <= 10; s++) { const px = bx + 1 + (len - 2) * s / 10, py = y + yy + Math.sin(s * 0.9 + ph) * 0.5; s ? g.lineTo(px, py) : g.moveTo(px, py); }
            g.stroke();
          }
          if (knot) { g.fillStyle = 'rgba(20,10,4,0.5)'; g.beginPath(); g.ellipse(bx + knot[0], y + knot[1], knot[2] * 1.8, knot[2], 0, 0, 6.3); g.fill(); }
          if (nails) for (const nx of [3, len - 3]) for (const ny of [0.3, 0.7]) { g.fillStyle = 'rgba(30,26,22,0.9)'; g.fillRect(bx + nx - 0.6, y + h * ny - 0.6, 1.2, 1.2); gh.fillStyle = 'rgb(120,0,0)'; gh.fillRect(bx + nx - 0.6, y + h * ny - 0.6, 1.2, 1.2); }
        };
        if (x < W) draw(0); if (x + len > W) draw(-W);
        x += len;
      }
    }
    for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,240,220'},${rr() * 0.06})`; g.fillRect(rr() * W, rr() * W, 1 + rr() * 2, 1); }
  }, 1.6);
}
export let PLANK, TEAK, MAHOG, PLATE, QSTONE, CARPET, WOODP, PM = null;
export function portTextures() {
  PLANK = boardTex(5150, 10, [96, 84, 70], 0.35, '#141110', 0.18, true);       // verwitterte Stegbohlen
  TEAK = boardTex(5151, 14, [150, 104, 62], 0.25, '#0c0a08', 0.16, false);     // Teakdeck mit schwarzen Fugen
  MAHOG = boardTex(5152, 9, [112, 42, 22], 0.3, '#cfc2a8', 0.22, false);       // Mahagoni mit hellen Fugen
  // Stahlplatten: Stöße, Nietreihen, Rostläufer; hell, damit die Teilfarbe durchkommt
  PLATE = texSet(256, (g, gr, gh, W) => {
    const rr = mulberry32(5153);
    g.fillStyle = '#e6e3dc'; g.fillRect(0, 0, W, W); gr.fillStyle = '#707070'; gr.fillRect(0, 0, W, W); gh.fillStyle = 'rgb(128,0,0)'; gh.fillRect(0, 0, W, W);
    for (let j = 0; j < 4; j++) {
      const y = j * 64;
      g.fillStyle = 'rgba(60,55,50,0.35)'; g.fillRect(0, y, W, 1.2); gh.fillStyle = 'rgb(90,0,0)'; gh.fillRect(0, y, W, 1.5);
      for (let x = (j % 2) * 64; x < W + 1; x += 128) { g.fillStyle = 'rgba(60,55,50,0.35)'; g.fillRect(x, y, 1.2, 64); gh.fillStyle = 'rgb(90,0,0)'; gh.fillRect(x, y, 1.5, 64); }
      for (let x = 2; x < W; x += 6) { g.fillStyle = 'rgba(80,70,60,0.4)'; g.fillRect(x, y + 3, 1.3, 1.3); gh.fillStyle = 'rgb(200,0,0)'; gh.fillRect(x, y + 3, 1.3, 1.3); }
    }
    for (let k = 0; k < 40; k++) { const x = rr() * W, y = rr() * W, l = 10 + rr() * 50, gg = g.createLinearGradient(x, y, x, y + l); gg.addColorStop(0, 'rgba(90,60,40,0.12)'); gg.addColorStop(1, 'rgba(90,60,40,0)'); g.fillStyle = gg; g.fillRect(x, y, 1 + rr() * 2, l); }
    for (let k = 0; k < 3000; k++) { g.fillStyle = `rgba(0,0,0,${rr() * 0.04})`; g.fillRect(rr() * W, rr() * W, 1, 1); }
  }, 1.4);
  // Granitplatten der Kaimauer: Läuferverband, Körnung, nasse Stellen
  QSTONE = texSet(256, (g, gr, gh, W) => {
    const rr = mulberry32(5154), rows = 4, h = W / rows;
    g.fillStyle = '#26262a'; g.fillRect(0, 0, W, W); gr.fillStyle = '#d0d0d0'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
    for (let j = 0; j < rows; j++) {
      let x = rr() * W; const end = x + W, y = j * h;
      while (x < end - 8) {
        const len = Math.min(end - x, h * (1.2 + rr() * 0.9)), v = 88 + rr() * 34, tn = rr() * 10, rv = 140 + rr() * 80 | 0, hv = 190 + rr() * 40 | 0;
        const draw = ox => { const bx = x + ox; g.fillStyle = `rgb(${v + tn | 0},${v + tn * 0.5 | 0},${v | 0})`; g.fillRect(bx + 1.2, y + 1.2, len - 2.4, h - 2.4); gr.fillStyle = `rgb(${rv},${rv},${rv})`; gr.fillRect(bx + 1.2, y + 1.2, len - 2.4, h - 2.4); gh.fillStyle = `rgb(${hv},0,0)`; gh.fillRect(bx + 1.8, y + 1.8, len - 3.6, h - 3.6); };
        if (x < W) draw(0); if (x + len > W) draw(-W);
        x += len;
      }
    }
    for (let k = 0; k < 9000; k++) { const l = rr() < 0.5; g.fillStyle = l ? `rgba(230,225,215,${rr() * 0.3})` : `rgba(10,10,12,${rr() * 0.4})`; g.fillRect(rr() * W, rr() * W, 0.8 + rr() * 1.2, 0.8 + rr() * 1.2); }
    for (let k = 0; k < 10; k++) { const x = 30 + rr() * (W - 60), y = 30 + rr() * (W - 60), r = 8 + rr() * 22, gg = gr.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, 'rgba(30,30,30,0.8)'); gg.addColorStop(1, 'rgba(30,30,30,0)'); gr.fillStyle = gg; gr.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, 1.8);
  // Teppich der Salons: Rautengitter in Gold, Fächer, Flor
  CARPET = canvasTex(256, 256, (g, W) => {
    const rr = mulberry32(5155);
    g.fillStyle = '#123a3c'; g.fillRect(0, 0, W, W);
    for (const [x, y] of [[0, 0], [W, 0], [0, W], [W, W]]) for (let r = 46; r > 6; r -= 10) { g.fillStyle = (r / 10 | 0) % 2 ? '#b89048' : '#123a3c'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    g.strokeStyle = '#c9a258'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W, W / 2); g.lineTo(W / 2, W); g.lineTo(0, W / 2); g.closePath(); g.stroke();
    g.fillStyle = '#6e1a20'; g.beginPath(); g.moveTo(W / 2, W * 0.3); g.lineTo(W * 0.7, W / 2); g.lineTo(W / 2, W * 0.7); g.lineTo(W * 0.3, W / 2); g.closePath(); g.fill(); g.stroke();
    for (let k = 0; k < 7000; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,230,200'},${rr() * 0.08})`; g.fillRect(rr() * W, rr() * W, 1, 1.5); }
  });
  CARPET.wrapS = CARPET.wrapT = T.RepeatWrapping;
  WOODP = woodPanelTextures();
}
// Rumpf: unter der Wasserlinie Antifouling, darüber ein heller Wasserpass, knapp darüber nasser, dunklerer Lack
export function hullMat(set, rough, metal) {
  const m = stdMat({ vertexColors: true, map: set.map, normalMap: set.normal, roughnessMap: set.rough, roughness: rough * 1.6, metalness: metal, envI: 0.9, side: T.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vHY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vHY = position.y;');
    sh.fragmentShader = 'varying float vHY;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vHY < 0.03) diffuseColor.rgb = vec3(0.2, 0.05, 0.04);
      else if (vHY < 0.15) diffuseColor.rgb = vec3(0.86, 0.83, 0.75);
      else diffuseColor.rgb *= 1.0 - 0.3 * smoothstep(0.55, 0.15, vHY);`);
  };
  return m;
}
export function portMats() {
  if (PM) return PM;
  portTextures();
  const vc = o => stdMat({ vertexColors: true, ...o });
  PM = {
    hull: hullMat(PLATE, 0.4, 0.25),
    whull: hullMat(MAHOG, 0.18, 0.0),
    deck: vc({ map: TEAK.map, normalMap: TEAK.normal, roughnessMap: TEAK.rough, roughness: 0.9, envI: 0.35, side: T.DoubleSide }),
    plank: vc({ map: PLANK.map, normalMap: PLANK.normal, roughnessMap: PLANK.rough, roughness: 1, envI: 0.25 }),
    paint: vc({ map: PLATE.map, normalMap: PLATE.normal, normalScale: new T.Vector2(0.6, 0.6), roughness: 0.45, metalness: 0.15, envI: 0.6 }),
    varnish: vc({ map: MAHOG.map, normalMap: MAHOG.normal, roughness: 0.22, envI: 0.9 }),
    chrome: vc({ color: 0xd8dde2, metalness: 1, roughness: 0.14 }),
    gold: vc({ color: 0xc9a258, metalness: 1, roughness: 0.33, emissive: 0x140c03, envI: 0.9 }),
    iron: vc({ color: 0x1e1e20, metalness: 0.7, roughness: 0.45 }),
    stone: vc({ map: QSTONE.map, normalMap: QSTONE.normal, roughnessMap: QSTONE.rough, roughness: 1, envI: 0.35 }),
    cloth: vc({ roughness: 0.92, envI: 0.2, side: T.DoubleSide }),
    leather: vc({ roughness: 0.42, envI: 0.55 }),
    rope: vc({ roughness: 1, envI: 0.1 }),
    glass: new T.MeshStandardMaterial({ color: 0x0b1618, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.3, envMap: ENV, envMapIntensity: 1.4, depthWrite: false, side: T.DoubleSide }),
    lit: new T.MeshBasicMaterial({ vertexColors: true }),
    // Innenräume leuchten warm aus sich heraus, so braucht es keine echten Lampen
    inWood: vc({ map: WOODP.map, normalMap: WOODP.normal, roughness: 0.4, emissive: 0xffffff, emissiveMap: WOODP.map, emissiveIntensity: 0.45, envI: 0.5 }),
    carpet: vc({ map: CARPET, roughness: 1, emissive: 0xffffff, emissiveMap: CARPET, emissiveIntensity: 0.4 }),
    ceil: vc({ roughness: 0.8, emissive: new T.Color(0.32, 0.24, 0.15) }),
    // V23: Böden aus Fotos (ambientCG, CC0): Fliesen für Feinkost, Apotheke, Friseur, Blumen; Parkett für Läden und Bar.
    // Bis die Fotos geladen sind, stehen die gezeichneten Texturen; das Eigenleuchten folgt dem Foto
    tile: wantTexture(vc({ map: QSTONE.map, normalMap: QSTONE.normal, roughness: 0.5, emissive: 0xffffff, emissiveMap: QSTONE.map, emissiveIntensity: 0.3, envI: 0.7 }), { map: 'tiles-color', normalMap: 'tiles-normal', roughnessMap: 'tiles-rough', normalScale: 0.7, roughness: 0.75, then: m => { m.emissiveMap = m.map; } }),
    parquet: wantTexture(vc({ map: WOODP.map, normalMap: WOODP.normal, roughness: 0.4, emissive: 0xffffff, emissiveMap: WOODP.map, emissiveIntensity: 0.4, envI: 0.6 }), { map: 'parquet-color', normalMap: 'parquet-normal', roughnessMap: 'parquet-rough', normalScale: 0.6, roughness: 0.7, then: m => { m.emissiveMap = m.map; } }),
  };
  return PM;
}
// Bausatz: Teile nach Material sammeln, am Ende je Material zu einem Mesh verschmelzen (Farbe pro Teil)
export function kit() {
  const G = {};
  return {
    add(k, g, c = [1, 1, 1]) { (G[k] ||= []).push([g, c]); return g; },
    build(parent) {
      const P = portMats(), out = [];
      for (const k in G) {
        const geos = G[k].map(([g]) => { g = !g.attributes.normal && g.index ? g.toNonIndexed() : geoView(g); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
        const m = mergeGeos(geos), col = new Float32Array(m.attributes.position.count * 3); let o = 0;
        geos.forEach((g, i) => { const c = G[k][i][1]; for (let j = 0; j < g.attributes.position.count; j++) col.set(c, (o + j) * 3); o += g.attributes.position.count; });
        m.setAttribute('color', new T.BufferAttribute(col, 3));
        const mesh = new T.Mesh(m, P[k]); if (k === 'glass') mesh.renderOrder = 3; parent.add(mesh); out.push(mesh);
      }
      return out;
    },
  };
}
// UV in Metern (für Holz, Lack und Stein), Größe einer Kachel in Metern
export const wuv = (g, sc) => { if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); worldUV(g, sc); return g; };
export const Bx = (w, h, d, x, y, z, sc = 2) => wuv(new T.BoxGeometry(w, h, d).translate(x, y, z), sc);

/* ---------- Rumpf aus Spanten: Spiegelheck oder doppelendig, Kimm gerundet, Sprung zum Bug ---------- */
export function hullShape(L, B, H, Tr, o = {}) {
  const tr = o.transom ?? 0.8, rise = o.rise ?? 0.3, fine = o.fine ?? 0.42, srise = o.sternRise ?? 0, dbl = !!o.double, blunt = o.blunt ?? 0;
  const half = u => {
    if (dbl) { const k = Math.abs(u - 0.5) * 2; return B / 2 * Math.max(blunt, Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, k - 0.4) / 0.6, 2)), 0.55)); }
    return u < 1 - fine ? B / 2 * (tr + (1 - tr) * Math.sin(Math.min(1, u / ((1 - fine) * 0.7)) * Math.PI / 2)) : B / 2 * Math.pow(Math.max(0, Math.cos((u - 1 + fine) / fine * Math.PI / 2)), 0.75);
  };
  const sheer = u => dbl ? H + rise * Math.pow(Math.abs(u - 0.5) * 2, 2.2) : H + rise * Math.pow(u, 2.2) + srise * Math.pow(1 - u, 2.5);
  const keel = u => { const e = dbl ? Math.abs(u - 0.5) * 2 : u; let k = e > 0.72 ? 1 - Math.pow((e - 0.72) / 0.28, 1.5) * 0.85 : 1; if (!dbl && u < 0.1) k *= 0.7 + u * 3; return -Tr * k; };
  const NS = o.ns ?? 40, NM = 9, C = 2 * NM + 1, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const u = i / NS, x = (u - 0.5) * L, hb = Math.max(half(u), 0.004), ys = sheer(u), yk = keel(u);
    for (let j = 0; j < C; j++) {
      const s = (j - NM) / NM, th = Math.abs(s) * Math.PI / 2;
      const w = hb * Math.pow(Math.sin(th), 0.5), y = yk + (ys - yk) * (1 - Math.pow(Math.cos(th), 1.3));
      pos.push(x, y, Math.sign(s) * w); uv.push(x / 2, y / 2);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < C - 1; j++) { const a = i * C + j, b = a + 1, c = a + C, d = c + 1; idx.push(a, c, b, b, c, d); }
  // Spiegel und stumpfe Enden: Fächer aus der Mitte
  const cap = i => {
    const u = i / NS, base = pos.length / 3; pos.push((u - 0.5) * L, (sheer(u) + keel(u)) / 2, 0); uv.push(0, 0);
    for (let j = 0; j < C - 1; j++) idx.push(base, i * C + j, i * C + j + 1);
    idx.push(base, i * C + C - 1, i * C);
  };
  if (half(0) > 0.02) cap(0); if (half(1) > 0.02) cap(NS);
  const hull = new T.BufferGeometry();
  hull.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); hull.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); hull.setIndex(idx); hull.computeVertexNormals();
  // Deck mit leichter Wölbung
  const dpos = [], duv = [], didx = [], camber = B * 0.015;
  for (let i = 0; i <= NS; i++) { const u = i / NS, x = (u - 0.5) * L, hb = Math.max(half(u) - 0.03, 0.002), ys = sheer(u) - 0.01; for (const z of [-hb, 0, hb]) { dpos.push(x, ys + (z === 0 ? camber : 0), z); duv.push(x / 2, z / 2); } }
  for (let i = 0; i < NS; i++) for (const j of [0, 1]) { const a = i * 3 + j, b = a + 1, c = a + 3, d = c + 1; didx.push(a, b, c, b, d, c); }
  const deck = new T.BufferGeometry();
  deck.setAttribute('position', new T.Float32BufferAttribute(dpos, 3)); deck.setAttribute('uv', new T.Float32BufferAttribute(duv, 2)); deck.setIndex(didx); deck.computeVertexNormals();
  const at = x => (x / L + 0.5);
  return { hull, deck, L, B, H, half: x => half(Math.min(1, Math.max(0, at(x)))), sheer: x => sheer(Math.min(1, Math.max(0, at(x)))) + camber * 0.5 };
}
// Scheuerleiste entlang der Deckskante
export function rubRail(K, hs, k, c, r = 0.05, y = 0) {
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 30; i++) { const x = (i / 30 - 0.5) * hs.L * 0.995; pts.push(new T.Vector3(x, hs.sheer(x) - 0.04 + y, s * (hs.half(x) + 0.01))); }
    K.add(k, new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, r, 6, false), c);
  }
}
// Begehbares Deck: Quader entlang des Rumpfs, Oberkante am Deck
export function deckBoxes(hs, x0, x1, step = 1.0, inset = 0.05, yTop) {
  const out = [];
  for (let x = x0; x < x1 - 0.01; x += step) {
    const xe = Math.min(x1, x + step), hb = Math.min(hs.half(x), hs.half(xe)) - inset;
    if (hb < 0.25) continue;
    const top = yTop ?? Math.min(hs.sheer(x), hs.sheer(xe));
    out.push(bx6(x, top - 0.8, -hb, xe, top, hb));
  }
  return out;
}
// Reling: Pfosten, Handlauf und Draht, als Kollision dünne Quader; Lücken für Gangways
export function railing(K, boxes, hs, x0, x1, gaps = [], o = {}) {
  const h = o.h ?? 1.0, k = o.k ?? 'chrome', c = o.c ?? [1, 1, 1], yOf = o.y ?? (x => hs.sheer(x));
  const inGap = (x, s) => gaps.some(g => (g[2] === undefined || g[2] === s) && x > g[0] && x < g[1]);
  for (const s of [-1, 1]) {
    let run = [];
    const flush = () => { if (run.length > 1) { const top = run.map(p => new T.Vector3(p.x, p.y + h, p.z)), mid = run.map(p => new T.Vector3(p.x, p.y + h * 0.5, p.z)); K.add(k, new T.TubeGeometry(new T.CatmullRomCurve3(top), run.length * 2, 0.025, 5, false), c); K.add(k, new T.TubeGeometry(new T.CatmullRomCurve3(mid), run.length * 2, 0.008, 4, false), c); } run = []; };
    for (let x = x0; x <= x1 + 0.001; x += 0.5) {
      if (inGap(x, s)) { flush(); continue; }
      const z = s * (hs.half(x) - 0.06), y = yOf(x); run.push({ x, y, z });
      if (Math.round(x * 2) % 3 === 0) K.add(k, new T.CylinderGeometry(0.018, 0.018, h, 5).translate(x, y + h / 2, z), c);
      if (boxes) boxes.push(bx6(x - 0.26, y, z - 0.06, x + 0.26, y + h + 0.05, z + 0.06));
    }
    flush();
  }
}
// Wand mit Fensterreihe zwischen zwei Punkten (Plattform-Koordinaten): Brüstung, Sturz, Pfosten, Glas; innen Holz, außen Lack
export function wallRun(K, boxes, ax, az, bx, bz, y0, h, o = {}) {
  const sill = o.sill ?? 0.9, head = o.head ?? h - 0.45, win = o.win ?? 1.3, post = o.post ?? 0.35, th = o.th ?? 0.12, out = o.out ?? 1;
  const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ang = Math.atan2(-dz, dx), nx = -dz / len * out, nz = dx / len * out;
  const outC = o.outC ?? [0.9, 0.88, 0.8], outK = o.outK ?? 'paint', inK = o.inK ?? 'inWood', inC = o.inC ?? [1, 1, 1];
  const piece = (u0, u1, ya, yb) => {
    if (u1 - u0 < 0.01 || yb - ya < 0.01) return;
    const u = (u0 + u1) / 2, cx = ax + dx * u / len, cz = az + dz * u / len, yy = (ya + yb) / 2;
    const mk = (k, c, off, sc) => K.add(k, wuv(new T.BoxGeometry(u1 - u0, yb - ya, th / 2).rotateY(ang).translate(cx + nx * off, y0 + yy, cz + nz * off), sc), c);
    mk(outK, outC, th / 4, 2); mk(inK, inC, -th / 4, 1.3);
  };
  const doors = (o.doors || []).slice().sort((a, b) => a[0] - b[0]), solid = [];
  let s = 0; for (const d of doors) { if (d[0] > s) solid.push([s, d[0]]); piece(d[0], d[1], Math.min(2.1, h), h); s = d[1]; } if (s < len) solid.push([s, len]);
  for (const [s0, s1] of solid) {
    piece(s0, s1, 0, sill); piece(s0, s1, head, h);
    const n = o.windows === false ? 0 : Math.floor((s1 - s0 - post) / (win + post));
    if (n < 1) { piece(s0, s1, sill, head); continue; }
    const w = (s1 - s0 - post * (n + 1)) / n;
    for (let i = 0; i <= n; i++) { const p0 = s0 + i * (w + post); piece(p0, p0 + post, sill, head);
      if (i < n) { const u = p0 + post + w / 2, cx = ax + dx * u / len, cz = az + dz * u / len; K.add('glass', new T.PlaneGeometry(w, head - sill).rotateY(ang).translate(cx, y0 + (sill + head) / 2, cz)); if (o.glow) K.add('lit', new T.PlaneGeometry(w * 0.96, (head - sill) * 0.94).rotateY(ang).translate(cx - nx * 0.05, y0 + (sill + head) / 2, cz - nz * 0.05), o.glow); } }
  }
  if (!boxes) return;
  // Kollision: achsenparallele Wände als ein Quader je Stück, schräge als Kette kleiner Quader
  const axis = Math.abs(dx) < 1e-3 || Math.abs(dz) < 1e-3;
  for (const [s0, s1] of solid) {
    if (axis) { const p0x = ax + dx * s0 / len, p0z = az + dz * s0 / len, p1x = ax + dx * s1 / len, p1z = az + dz * s1 / len; boxes.push(bx6(p0x - (Math.abs(dz) > 1e-3 ? 0.08 : 0), y0, p0z - (Math.abs(dx) > 1e-3 ? 0.08 : 0), p1x + (Math.abs(dz) > 1e-3 ? 0.08 : 0), y0 + h, p1z + (Math.abs(dx) > 1e-3 ? 0.08 : 0))); }
    else for (let u = s0; u < s1; u += 0.35) { const cx = ax + dx * u / len, cz = az + dz * u / len; boxes.push(bx6(cx - 0.18, y0, cz - 0.18, cx + 0.18, y0 + h, cz + 0.18)); }
  }
}
// Sitzbank aus Latten mit eisernen Wangen, Sitzfläche nach +z
export function benchGeo(K, len, x, y, z, a = 0, wood = 'varnish') {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push([wood, new T.BoxGeometry(len, 0.03, 0.08).translate(0, 0.44, -0.16 + k * 0.105)]);
  for (let k = 0; k < 3; k++) parts.push([wood, new T.BoxGeometry(len, 0.08, 0.025).rotateX(-0.2).translate(0, 0.6 + k * 0.12, -0.24 - k * 0.025)]);
  for (const sx of [-1, 1]) parts.push(['iron', new T.BoxGeometry(0.05, 0.44, 0.42).translate(sx * (len / 2 - 0.12), 0.22, 0)], ['iron', new T.BoxGeometry(0.04, 0.5, 0.05).rotateX(-0.2).translate(sx * (len / 2 - 0.12), 0.68, -0.27)]);
  for (const [k, g] of parts) K.add(k, wuv(g.rotateY(a).translate(x, y, z), 1.5));
}

/* ---------- Boote ---------- */
export const NAME_TEX = {};
export function nameplate(text, w, h, color = '#e8c47a', bg = null) {
  const key = text + color + bg;
  const t = NAME_TEX[key] ||= canvasTex(512, 96, (g, W, H) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); } g.fillStyle = color; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4; g.font = '64px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 4); });
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, transparent: !bg, color: new T.Color(1.3, 1.3, 1.3), side: T.DoubleSide }));
}
// Runabout aus Mahagoni: zwei Sitzbänke aus Leder, Windschutzscheibe mit Chromrahmen, Lenkrad, Flaggenstock
export function boatRunabout(rr) {
  const L = 8.4, B = 2.3, hs = hullShape(L, B, 0.62, 0.42, { transom: 0.82, rise: 0.22, fine: 0.45 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('whull', hs.hull); K.add('varnish', hs.deck);
  rubRail(K, hs, 'chrome', [1, 1, 1], 0.035);
  const lc = pick([[0.86, 0.79, 0.62], [0.55, 0.1, 0.08], [0.12, 0.26, 0.3], [0.9, 0.88, 0.84]]), spots = [];
  for (const sx of [0.55, -1.45]) {
    const y = hs.sheer(sx);
    K.add('leather', roundBox(0.6, 0.18, 1.7, 0.06).translate(sx, y + 0.12, 0), lc);
    K.add('leather', roundBox(0.14, 0.5, 1.75, 0.05).rotateZ(0.15).translate(sx - 0.34, y + 0.4, 0), lc);
    K.add('varnish', Bx(0.9, 0.1, 2.0, sx + 0.05, y + 0.02, 0, 2));
    for (const z of [-0.45, 0.45]) if (rr() < 0.3 && !(sx > 0 && z < 0)) spots.push({ lx: sx + 0.02, ly: y + 0.21, lz: z, lyaw: Math.PI / 2, sit: true, act: 7 + (rr() < 0.5 ? 0.8 : 0.2) });
  }
  // am Steuer sitzt der Bootsführer
  spots.push({ lx: 0.57, ly: hs.sheer(0.55) + 0.21, lz: -0.45, lyaw: Math.PI / 2, sit: true, act: 34.5, kind: 'suit', col: [0.92, 0.9, 0.84] });
  const yw = hs.sheer(1.35);
  K.add('glass', new T.PlaneGeometry(1.9, 0.4).rotateY(Math.PI / 2).rotateZ(0.5).translate(1.35, yw + 0.24, 0));
  K.add('chrome', new T.BoxGeometry(0.04, 0.03, 1.95).rotateZ(0.5).translate(1.24, yw + 0.42, 0));
  for (const z of [-0.95, 0, 0.95]) K.add('chrome', new T.BoxGeometry(0.03, 0.44, 0.03).rotateZ(0.5).translate(1.35, yw + 0.22, z));
  K.add('chrome', new T.TorusGeometry(0.17, 0.018, 6, 20).rotateY(Math.PI / 2).rotateZ(0.5).translate(0.98, yw + 0.4, -0.45));
  K.add('chrome', new T.CylinderGeometry(0.02, 0.02, 0.3, 6).rotateZ(Math.PI / 2 + 0.5).translate(1.08, yw + 0.33, -0.45));
  K.add('chrome', Bx(1.2, 0.04, 0.06, -0.45, hs.sheer(-0.45) + 0.05, 0));
  for (const x of [L / 2 - 0.6, -L / 2 + 0.35]) K.add('chrome', new T.BoxGeometry(0.2, 0.05, 0.06).translate(x, hs.sheer(x) + 0.03, 0));
  K.add('chrome', new T.CylinderGeometry(0.012, 0.015, 0.9, 6).translate(-L / 2 + 0.15, hs.sheer(-L / 2) + 0.45, 0));
  const fl = pick([[0.85, 0.12, 0.1], [0.08, 0.3, 0.32], [0.9, 0.86, 0.75]]);
  K.add('cloth', new T.PlaneGeometry(0.42, 0.28).translate(-L / 2 - 0.06, hs.sheer(-L / 2) + 0.75, 0).rotateY(0.15), fl);
  K.build(body);
  body.add(makeGlowPoints([{ p: [L / 2 - 0.5, hs.sheer(L / 2) + 0.12, -0.12], c: [1.4, 0.1, 0.08], s: 0.35, ph: 0, bl: 0 }, { p: [L / 2 - 0.5, hs.sheer(L / 2) + 0.12, 0.12], c: [0.1, 1.3, 0.3], s: 0.35, ph: 0, bl: 0 }]));
  return { g, body, boxes: deckBoxes(hs, -L / 2 + 0.2, L / 2 - 0.5, 0.9), spots, L, B, hs };
}
// Kajütboot: lackierter Rumpf, Kajüte aus Mahagoni mit Bullaugen, Achterdeck mit Liegestühlen
export function boatCruiser(rr) {
  const L = 12.5, B = 3.6, hs = hullShape(L, B, 0.95, 0.75, { transom: 0.86, rise: 0.35, fine: 0.42 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  const hc = pick([[0.92, 0.9, 0.85], [0.06, 0.09, 0.16], [0.08, 0.22, 0.18], [0.5, 0.08, 0.07], [0.92, 0.9, 0.85]]);
  K.add('hull', hs.hull, hc); K.add('deck', hs.deck); rubRail(K, hs, 'gold', [1, 1, 1], 0.045);
  const cx = 1.1, ys = hs.sheer(cx), cream = [0.9, 0.87, 0.78], spots = [], boxes = deckBoxes(hs, -L / 2 + 0.2, L / 2 - 0.6, 1.0);
  K.add('varnish', wuv(roundBox(4.6, 1.25, 2.5, 0.12).translate(cx, ys + 0.6, 0), 2));
  K.add('paint', wuv(roundBox(4.9, 0.1, 2.75, 0.04).translate(cx, ys + 1.27, 0), 2), cream);
  K.add('glass', new T.PlaneGeometry(2.2, 0.5).rotateY(Math.PI / 2).rotateZ(0.5).translate(cx + 2.38, ys + 0.95, 0));
  K.add('lit', new T.PlaneGeometry(2.1, 0.44).rotateY(Math.PI / 2).rotateZ(0.5).translate(cx + 2.33, ys + 0.95, 0), [1.1, 0.72, 0.38]);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = cx - 1.6 + k * 1.05;
    K.add('gold', new T.TorusGeometry(0.13, 0.025, 6, 16).translate(x, ys + 0.75, s * 1.26));
    K.add('lit', new T.CircleGeometry(0.11, 14).rotateY(s > 0 ? 0 : Math.PI).translate(x, ys + 0.75, s * 1.262), [1.2, 0.8, 0.42]);
  }
  boxes.push(bx6(cx - 2.3, ys, -1.25, cx + 2.3, ys + 1.32, 1.25));
  // Achterdeck: Liegestühle mit gestreiftem Segeltuch, kleiner Tisch
  const stripe = pick([[0.85, 0.82, 0.72], [0.08, 0.32, 0.34], [0.62, 0.12, 0.12]]);
  for (const z of [-0.8, 0.8]) {
    const x = -3.6, y = hs.sheer(x);
    K.add('varnish', Bx(0.06, 0.06, 0.62, x + 0.4, y + 0.32, z));
    K.add('cloth', new T.PlaneGeometry(0.55, 1.1).rotateX(-Math.PI / 2).rotateZ(-0.7).rotateY(Math.PI / 2).translate(x, y + 0.45, z), stripe);
    for (const zz of [-0.28, 0.28]) K.add('varnish', Bx(1.1, 0.04, 0.04, x, y + 0.3, z + zz));
    if (rr() < 0.45) spots.push({ lx: x + 0.1, ly: y + 0.3, lz: z, lyaw: Math.PI / 2 });
  }
  K.add('varnish', wuv(new T.CylinderGeometry(0.3, 0.3, 0.04, 16).translate(-3.6, hs.sheer(-3.6) + 0.55, 0), 1));
  K.add('gold', new T.CylinderGeometry(0.03, 0.03, 0.55, 6).translate(-3.6, hs.sheer(-3.6) + 0.27, 0));
  // Flaggenstock, Mast auf dem Dach mit Topplicht
  K.add('varnish', new T.CylinderGeometry(0.02, 0.025, 1.4, 6).translate(-L / 2 + 0.2, hs.sheer(-L / 2) + 0.7, 0));
  K.add('cloth', new T.PlaneGeometry(0.6, 0.4).translate(-L / 2 - 0.12, hs.sheer(-L / 2) + 1.15, 0), pick([[0.85, 0.12, 0.1], [0.08, 0.3, 0.32], [0.9, 0.75, 0.3]]));
  K.add('gold', new T.CylinderGeometry(0.03, 0.04, 1.6, 6).translate(cx + 1.4, ys + 2.1, 0));
  K.build(body);
  body.add(makeGlowPoints([{ p: [cx + 1.4, ys + 2.95, 0], c: [1.4, 1.3, 1.1], s: 0.5, ph: 0, bl: 0 }, { p: [L / 2 - 0.6, hs.sheer(L / 2) + 0.15, -0.2], c: [1.4, 0.1, 0.08], s: 0.4, ph: 0, bl: 0 }, { p: [L / 2 - 0.6, hs.sheer(L / 2) + 0.15, 0.2], c: [0.1, 1.3, 0.3], s: 0.4, ph: 0, bl: 0 }]));
  return { g, body, boxes, spots, L, B, hs };
}
// Segelyacht: Mast mit Salingen und Wanten, Großbaum mit Persenning, kleiner Kajütaufbau, Pinne
export function boatSail(rr) {
  const L = 10.5, B = 3.0, hs = hullShape(L, B, 0.75, 1.3, { transom: 0.55, rise: 0.4, fine: 0.5, sternRise: 0.05 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  const varnished = rr() < 0.3, hc = pick([[0.92, 0.9, 0.85], [0.05, 0.1, 0.2], [0.12, 0.3, 0.3], [0.92, 0.9, 0.85]]);
  K.add(varnished ? 'whull' : 'hull', hs.hull, varnished ? [1, 1, 1] : hc); K.add('deck', hs.deck); rubRail(K, hs, 'varnish', [1, 1, 1], 0.045);
  const ys = hs.sheer(0.8), boxes = deckBoxes(hs, -L / 2 + 0.2, L / 2 - 0.7, 1.0), mx = 1.6;
  K.add('paint', wuv(roundBox(2.8, 0.5, 1.8, 0.12).translate(0.6, ys + 0.24, 0), 2), [0.9, 0.87, 0.78]);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { K.add('gold', new T.TorusGeometry(0.08, 0.018, 5, 12).translate(-0.3 + k * 0.85, ys + 0.26, s * 0.91)); K.add('lit', new T.CircleGeometry(0.065, 10).rotateY(s > 0 ? 0 : Math.PI).translate(-0.3 + k * 0.85, ys + 0.26, s * 0.912), [1.1, 0.75, 0.4]); }
  boxes.push(bx6(-0.8, ys, -0.9, 2.0, ys + 0.5, 0.9));
  const mh = 13.5, my = hs.sheer(mx);
  K.add('varnish', wuv(new T.CylinderGeometry(0.07, 0.1, mh, 10).translate(mx, my + mh / 2, 0), 2));
  K.add('varnish', new T.BoxGeometry(0.06, 0.06, 2.2).translate(mx, my + mh * 0.55, 0));
  K.add('varnish', new T.CylinderGeometry(0.06, 0.06, 4.6, 8).rotateZ(Math.PI / 2).translate(mx - 2.3, my + 1.5, 0));
  K.add('cloth', new T.CylinderGeometry(0.17, 0.12, 4.2, 10).rotateZ(Math.PI / 2).translate(mx - 2.3, my + 1.68, 0), pick([[0.08, 0.14, 0.3], [0.86, 0.82, 0.72], [0.1, 0.3, 0.3]]));
  K.add('varnish', new T.BoxGeometry(1.2, 0.05, 0.06).translate(-L / 2 + 0.7, hs.sheer(-L / 2) + 0.35, 0));
  const rig = [mx, my + mh, 0, L / 2 - 0.1, hs.sheer(L / 2), 0, mx, my + mh, 0, -L / 2 + 0.2, hs.sheer(-L / 2), 0];
  for (const s of [-1, 1]) rig.push(mx, my + mh * 0.55, s * 1.1, mx, my + 0.05, s * (hs.half(mx) - 0.05), mx, my + mh * 0.55, s * 1.1, mx, my + mh, 0);
  const lines = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(rig, 3)), new T.LineBasicMaterial({ color: 0x6a6a64 }));
  body.add(lines);
  K.build(body);
  body.add(makeGlowPoints([{ p: [mx, my + mh + 0.1, 0], c: [1.4, 1.35, 1.2], s: 0.6, ph: R(), bl: 0 }]));
  return { g, body, boxes, spots: [], L, B, hs };
}
// Motorjacht im Stil der Zwanziger: dunkler Rumpf, Salon mit Fensterband (begehbar), Oberdeck mit Brücke und Schornstein, Achterdeck mit Gesellschaft
export function boatYacht() {
  const L = 36, B = 7.2, hs = hullShape(L, B, 1.65, 1.9, { transom: 0.72, rise: 0.7, fine: 0.42, sternRise: 0.15, ns: 64 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  K.add('hull', hs.hull, [0.05, 0.07, 0.12]); K.add('deck', hs.deck); rubRail(K, hs, 'gold', [1, 1, 1], 0.06); rubRail(K, hs, 'gold', [1, 1, 1], 0.03, -0.5);
  const boxes = deckBoxes(hs, -L / 2 + 0.3, L / 2 - 1.2, 1.0), spots = [], cream = [0.93, 0.9, 0.82];
  // Salon: x -8..7, Boden flach, Tür achtern
  const s0 = -8, s1 = 7, SW = 2.3, FY = 1.98, SH = 2.45, UY = FY + SH + 0.12;
  boxes.push(bx6(s0, FY - 0.6, -SW, s1, FY, SW));
  K.add('carpet', (() => { const p = new T.PlaneGeometry(s1 - s0, SW * 2).rotateX(-Math.PI / 2).translate((s0 + s1) / 2, FY + 0.01, 0); const a = p.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * (s1 - s0) / 1.6, a.getY(i) * SW * 2 / 1.6); return p; })());
  K.add('ceil', new T.PlaneGeometry(s1 - s0, SW * 2).rotateX(Math.PI / 2).translate((s0 + s1) / 2, FY + SH - 0.01, 0), cream);
  const wo = { outC: cream, glow: null, sill: 0.85, head: 2.05, win: 1.5, post: 0.35 };
  wallRun(K, boxes, s0, -SW, s1, -SW, FY, SH, { ...wo, out: -1 });
  wallRun(K, boxes, s0, SW, s1, SW, FY, SH, { ...wo, out: 1 });
  wallRun(K, boxes, s1, -SW, s1, SW, FY, SH, { ...wo, out: -1, windows: false });
  wallRun(K, boxes, s0, -SW, s0, SW, FY, SH, { ...wo, out: 1, doors: [[SW - 0.75, SW + 0.75]], win: 0.9 });
  for (let x = s0 + 1; x < s1; x += 2.5) K.add('gold', new T.BoxGeometry(0.08, 0.06, SW * 2 - 0.2).translate(x, FY + SH - 0.05, 0));
  // Oberdeck über die volle Breite
  const ub = bx6(s0, UY - 0.14, -3.45, s1, UY, 3.45); boxes.push(ub);
  K.add('deck', (() => { const p = new T.BoxGeometry(s1 - s0, 0.14, 6.9).translate((s0 + s1) / 2, UY - 0.07, 0); return wuv(p, 2); })());
  K.add('paint', Bx(s1 - s0 + 0.1, 0.16, 0.08, (s0 + s1) / 2, UY - 0.2, 3.46), cream); K.add('paint', Bx(s1 - s0 + 0.1, 0.16, 0.08, (s0 + s1) / 2, UY - 0.2, -3.46), cream);
  for (let x = s0 + 0.5; x < s1; x += 2.5) for (const s of [-1, 1]) K.add('paint', new T.CylinderGeometry(0.05, 0.05, SH, 8).translate(x, FY + SH / 2, s * 3.3), cream);
  const uhs = { L: 30, half: () => 3.5, sheer: () => UY };
  railing(K, boxes, uhs, s0 + 0.1, s1 - 0.1, [[s0 - 1, s0 + 1.2, 1]], { y: () => UY, k: 'chrome' });
  boxes.push(bx6(s0 - 0.06, UY, -3.45, s0 + 0.06, UY + 1.05, 2.3), bx6(s1 - 0.06, UY, -3.45, s1 + 0.06, UY + 1.05, 3.45));
  K.add('chrome', new T.CylinderGeometry(0.025, 0.025, 5.8, 5).rotateX(Math.PI / 2).translate(s0, UY + 1.0, -0.55)); K.add('chrome', new T.CylinderGeometry(0.025, 0.025, 6.9, 5).rotateX(Math.PI / 2).translate(s1, UY + 1.0, 0));
  // Brückenhaus vorn auf dem Oberdeck
  const b0 = 3.0, b1 = 6.6, BW = 1.8, BH = 2.15;
  wallRun(K, boxes, b0, -BW, b1, -BW, UY, BH, { outC: cream, out: -1, sill: 0.95, head: 1.85, win: 0.9, post: 0.25 });
  wallRun(K, boxes, b0, BW, b1, BW, UY, BH, { outC: cream, out: 1, sill: 0.95, head: 1.85, win: 0.9, post: 0.25 });
  wallRun(K, boxes, b1, -BW, b1, BW, UY, BH, { outC: cream, out: -1, sill: 0.95, head: 1.85, win: 0.9, post: 0.25 });
  wallRun(K, boxes, b0, -BW, b0, BW, UY, BH, { outC: cream, out: 1, doors: [[BW - 0.45, BW + 0.45]], windows: false });
  K.add('paint', wuv(roundBox(b1 - b0 + 0.5, 0.14, BW * 2 + 0.5, 0.05).translate((b0 + b1) / 2, UY + BH + 0.07, 0), 2), cream);
  K.add('gold', new T.TorusGeometry(0.32, 0.03, 6, 20).rotateY(Math.PI / 2).translate(b1 - 0.6, UY + 1.2, 0));
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; K.add('gold', new T.CylinderGeometry(0.015, 0.015, 0.78, 4).rotateX(a).translate(b1 - 0.6, UY + 1.2, 0)); }
  K.add('varnish', Bx(0.5, 1.0, 1.4, b1 - 0.35, UY + 0.5, 0, 1.5));
  spots.push({ lx: b1 - 1.0, ly: UY, lz: 0, lyaw: Math.PI / 2, kind: 'police', col: [0.06, 0.07, 0.16], act: 0.2 });
  // Schornstein: stromlinienförmig, creme mit schwarzer Kappe und Goldband
  const fx = -0.8;
  K.add('paint', new T.CylinderGeometry(0.75, 0.9, 2.4, 22).scale(1.7, 1, 1).rotateZ(0.14).translate(fx, UY + 1.2, 0), cream);
  K.add('iron', new T.CylinderGeometry(0.7, 0.76, 0.5, 22).scale(1.7, 1, 1).rotateZ(0.14).translate(fx - 0.33, UY + 2.55, 0));
  K.add('gold', new T.CylinderGeometry(0.79, 0.79, 0.14, 22).scale(1.7, 1, 1).rotateZ(0.14).translate(fx - 0.22, UY + 1.95, 0));
  boxes.push(bx6(fx - 1.5, UY, -0.9, fx + 1.5, UY + 2.6, 0.9));
  // Beiboot in Klampen
  const lb = hullShape(4.4, 1.5, 0.5, 0.3, { transom: 0.6, rise: 0.2, fine: 0.5, ns: 18 });
  K.add('paint', lb.hull.clone().translate(-5.0, UY + 0.45, 2.3), [0.93, 0.92, 0.88]); K.add('deck', lb.deck.clone().translate(-5.0, UY + 0.45, 2.3));
  boxes.push(bx6(-7.2, UY, 1.5, -2.8, UY + 1.0, 3.1));
  for (const x of [-6.2, -3.8]) K.add('varnish', Bx(0.25, 0.4, 1.4, x, UY + 0.2, 2.3, 1.5));
  // Liegestühle auf dem Oberdeck
  for (const z of [-2.2, -1.0]) { K.add('varnish', Bx(1.6, 0.06, 0.6, -6.4, UY + 0.32, z, 1.5)); K.add('cloth', new T.PlaneGeometry(0.58, 0.75).rotateX(-Math.PI / 2).rotateZ(-0.9).rotateY(Math.PI / 2).translate(-5.45, UY + 0.6, z), [0.86, 0.82, 0.7]); }
  // Treppe vom Achterdeck aufs Oberdeck (Steuerbord)
  const stY0 = hs.sheer(-12.5), nSt = 9, stLen = 4.4;
  for (let k = 0; k < nSt; k++) {
    const x0 = -12.5 + k * stLen / nSt, top = stY0 + (UY - stY0) * (k + 1) / nSt;
    boxes.push(bx6(x0, top - 0.3, 2.35, x0 + stLen / nSt, top, 3.35));
    K.add('varnish', Bx(stLen / nSt + 0.02, 0.06, 1.0, x0 + stLen / nSt / 2, top - 0.03, 2.85, 1.5));
  }
  boxes.push(bx6(-12.5, stY0, 2.25, s0, UY + 1.0, 2.33));
  K.add('chrome', new T.CylinderGeometry(0.025, 0.025, Math.hypot(stLen, UY - stY0), 5).rotateZ(-Math.atan2(stLen, UY - stY0)).translate(-12.5 + stLen / 2, (stY0 + UY) / 2 + 1.0, 2.3));
  // Hauptdeck-Reling mit Lücke für die Gangway (Backbord) und am Treppenfuß
  railing(K, boxes, hs, -L / 2 + 0.4, L / 2 - 1.4, [[-13.2, -10.8, -1]]);
  // Gangway zum Steg (Backbord, -z)
  const gwY = hs.sheer(-12), hb = hs.half(-12);
  for (const [z0, z1, top] of [[-hb - 0.75, -hb + 0.1, gwY - 0.37], [-hb - 1.5, -hb - 0.75, gwY - 0.74]]) { boxes.push(bx6(-12.8, top - 0.3, z0, -11.2, top, z1)); K.add('varnish', Bx(1.6, 0.06, z1 - z0, -12, top - 0.03, (z0 + z1) / 2, 1.5)); }
  for (const x of [-12.8, -11.2]) { K.add('chrome', new T.CylinderGeometry(0.02, 0.02, 1.6, 5).rotateX(Math.PI / 2 - 0.4).translate(x, gwY + 0.35, -hb - 0.7)); boxes.push(bx6(x - 0.05, gwY - 1.0, -hb - 1.5, x + 0.05, gwY + 0.9, -hb)); }
  // Vorschiff: Ankerwinde, Bugkorb, Flaggenstock; Mast mit Lichterketten zum Heck
  K.add('iron', new T.CylinderGeometry(0.25, 0.25, 0.8, 12).rotateX(Math.PI / 2).translate(13, hs.sheer(13) + 0.3, 0));
  K.add('varnish', new T.CylinderGeometry(0.03, 0.04, 1.8, 6).translate(L / 2 - 0.9, hs.sheer(L / 2 - 0.9) + 0.9, 0));
  const mastX = 4.8, mastTop = UY + BH + 4.2;
  K.add('gold', new T.CylinderGeometry(0.05, 0.08, mastTop - UY - BH, 8).translate(mastX, (mastTop + UY + BH) / 2, 0));
  K.add('varnish', new T.CylinderGeometry(0.03, 0.04, 2.2, 6).translate(-L / 2 + 0.6, hs.sheer(-L / 2) + 1.1, 0));
  K.add('cloth', new T.PlaneGeometry(1.1, 0.7).translate(-L / 2 - 0.0, hs.sheer(-L / 2) + 1.85, 0), [0.08, 0.3, 0.32]);
  // Achterdeck: Tisch mit Gläsern, Grammophon, Korbsessel
  const ax = -14.5, ay = hs.sheer(ax);
  K.add('cloth', lathe([[0, 0.76], [0.6, 0.76], [0.66, 0.72], [0.68, 0.5]], 20).translate(ax, ay, 0), [0.92, 0.9, 0.86]);
  K.add('gold', new T.CylinderGeometry(0.04, 0.12, 0.74, 8).translate(ax, ay + 0.37, 0));
  for (let k = 0; k < 5; k++) { const a = k * 1.25; K.add('glass', new T.CylinderGeometry(0.03, 0.02, 0.12, 8).translate(ax + Math.cos(a) * 0.35, ay + 0.83, Math.sin(a) * 0.35)); }
  K.add('lit', new T.SphereGeometry(0.05, 8, 6).translate(ax, ay + 0.85, 0), [1.6, 1.0, 0.5]);
  K.add('varnish', Bx(0.4, 0.3, 0.4, -10.2, ay + 0.15, -1.8, 1)); K.add('gold', lathe([[0.02, 0], [0.04, 0.05], [0.28, 0.4]], 14).rotateZ(0.6).translate(-10.2, ay + 0.35, -1.8));
  boxes.push(bx6(ax - 0.65, ay, -0.65, ax + 0.65, ay + 0.78, 0.65));
  // Lichterketten vom Mast zum Bug und zum Heck
  const bulbs = [];
  for (const [ex, ey] of [[L / 2 - 0.9, hs.sheer(L / 2) + 1.8], [-L / 2 + 0.6, hs.sheer(-L / 2) + 2.2]]) for (let k = 1; k < 18; k++) { const t = k / 18, x = mastX + (ex - mastX) * t, y = mastTop + (ey - mastTop) * t - Math.sin(t * Math.PI) * 1.2; bulbs.push({ p: [x, y, 0], c: k % 3 === 0 ? [1.5, 0.9, 0.4] : k % 3 === 1 ? [1.4, 1.2, 0.8] : [0.5, 1.2, 1.2], s: 0.38, ph: R(), bl: 0 }); }
  bulbs.push({ p: [mastX, mastTop + 0.1, 0], c: [1.4, 1.35, 1.2], s: 0.8, ph: 0, bl: 0 });
  for (let x = s0 + 1.2; x < s1; x += 2.5) for (const z of [-1.4, 1.4]) bulbs.push({ p: [x, FY + SH - 0.15, z], c: [1.4, 0.95, 0.5], s: 0.45, ph: 0, bl: 0 });
  K.build(body);
  body.add(makeGlowPoints(bulbs));
  for (const s of [-1, 1]) { const n = nameplate('ÉTOILE', 3.2, 0.6); n.position.set(L / 2 - 4.5, hs.sheer(L / 2 - 4.5) - 0.45, s * (hs.half(L / 2 - 4.5) + 0.03)); n.rotation.y = s > 0 ? 0 : Math.PI; n.rotation.x = 0; body.add(n); }
  { const n = nameplate('ÉTOILE · VESPERA', 4, 0.5); n.position.set(-L / 2 - 0.02, hs.sheer(-L / 2) - 0.5, 0); n.rotation.y = -Math.PI / 2; body.add(n); }
  // Salon: Sofas, Sessel, Flügel, Bar
  const SM = { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth', leaf: 'cloth' }, SK = kit(), sadd = (k, g2) => SK.add(k, g2, k === 'leather' ? [0.55, 0.1, 0.1] : k === 'lit' ? [1.5, 1.0, 0.55] : k === 'cloth' ? [0.92, 0.9, 0.86] : [1, 1, 1]);
  placeFurn(FURN.sofa(2.6), SM, sadd, -5.5, FY, -1.75, 0); placeFurn(FURN.sofa(2.6), SM, sadd, -5.5, FY, 1.75, Math.PI);
  placeFurn(FURN.roundTable(0.5, 0.5), SM, sadd, -5.5, FY, 0); placeFurn(FURN.tableLamp(), SM, sadd, -5.5, FY + 0.5, 0);
  placeFurn(FURN.clubChair(), SM, sadd, -1.5, FY, -1.6, 0.4); placeFurn(FURN.clubChair(), SM, sadd, -1.5, FY, 1.6, Math.PI - 0.4);
  placeFurn(FURN.floorLamp(), SM, sadd, -2.8, FY, -1.9); placeFurn(FURN.floorLamp(), SM, sadd, -2.8, FY, 1.9);
  // Flügel
  SK.add('iron', roundBox(1.5, 0.3, 1.4, 0.15).translate(4.6, FY + 0.82, 1.2)); SK.add('iron', new T.BoxGeometry(1.4, 0.03, 1.3).rotateX(-0.6).translate(4.6, FY + 1.25, 1.5));
  for (const [dx2, dz2] of [[-0.6, -0.5], [0.6, -0.5], [0, 0.55]]) SK.add('iron', new T.CylinderGeometry(0.05, 0.04, 0.68, 8).translate(4.6 + dx2, FY + 0.34, 1.2 + dz2));
  SK.add('cloth', new T.BoxGeometry(1.2, 0.04, 0.18).translate(4.6, FY + 0.7, 0.42), [0.92, 0.9, 0.85]);
  boxes.push(bx6(3.8, FY, 0.45, 5.4, FY + 1.0, 1.95));
  spots.push({ lx: 4.6, ly: FY + 0.48, lz: 0.05, lyaw: Math.PI, sit: true, kind: 'tux', act: 7.2 });
  // Bar vorn an Backbord
  SK.add('varnish', wuv(roundBox(2.4, 1.05, 0.55, 0.05).translate(5.2, FY + 0.52, -1.4), 1.5)); SK.add('gold', new T.BoxGeometry(2.45, 0.05, 0.6).translate(5.2, FY + 1.07, -1.4));
  for (let k = 0; k < 7; k++) SK.add('lit', new T.CylinderGeometry(0.035, 0.035, 0.28, 8).translate(4.3 + k * 0.3, FY + 1.5, -2.15), k % 2 ? [0.7, 1.0, 0.4] : [1.5, 0.8, 0.3]);
  boxes.push(bx6(4.0, FY, -1.7, 6.4, FY + 1.05, -1.1));
  spots.push({ lx: 5.2, ly: FY, lz: -1.95, lyaw: 0, kind: 'livery', col: [0.9, 0.88, 0.84], act: 0.0 });
  SK.build(body);
  // Gesellschaft: auf dem Achterdeck und im Salon
  const party = [[-15.6, 0.9, 'gown', 2.6], [-15.4, -0.9, 'tux', 0.8], [-13.4, 1.2, 'gown', 5.7], [-13.2, -1.3, 'tux', 0.9], [-16.5, -0.2, 'tux', 1.5], [-11.8, 0.4, 'gown', 2.6], [-11.6, -0.6, 'tux', 5.6], [-3.6, 0.3, 'gown', 0.8], [-3.2, -0.6, 'tux', 1.6], [0.5, 1.2, 'gown', 5.7], [0.8, 0.1, 'tux', 2.7]];
  for (const [x, z, kind, act] of party) spots.push({ lx: x, ly: x > s0 ? FY : hs.sheer(x), lz: z, lyaw: 0, face: true, kind, act });
  spots.push({ lx: -5.2, ly: FY + 0.4, lz: -1.6, lyaw: 0, sit: true, kind: 'gown', act: 7.8 }, { lx: -5.8, ly: FY + 0.4, lz: 1.6, lyaw: Math.PI, sit: true, kind: 'tux', act: 7.6 });
  return { g, body, boxes, spots, L, B, hs };
}
// Hafenfähre: doppelendig, Fahrgastsalon mit Bänken, offenes Oberdeck, Steuerhaus mit Schornstein
export function boatFerry() {
  const L = 27, B = 7.6, hs = hullShape(L, B, 1.0, 1.5, { double: true, rise: 0.35, blunt: 0.4, ns: 54 }), K = kit(), g = new T.Group(), body = new T.Group(); g.add(body);
  const teal = [0.05, 0.27, 0.29], cream = [0.92, 0.88, 0.78];
  K.add('hull', hs.hull, teal); K.add('deck', hs.deck); rubRail(K, hs, 'gold', [1, 1, 1], 0.07);
  const boxes = deckBoxes(hs, -L / 2 + 0.3, L / 2 - 0.3, 1.0), spots = [];
  const s0 = -8, s1 = 8, SW = 2.75, FY = 1.06, SH = 2.4, UY = FY + SH + 0.12;
  boxes.push(bx6(s0, FY - 0.6, -SW, s1, FY, SW));
  K.add('deck', wuv(new T.BoxGeometry(s1 - s0, 0.04, SW * 2).translate(0, FY - 0.02, 0), 2));
  K.add('ceil', new T.PlaneGeometry(s1 - s0, SW * 2).rotateX(Math.PI / 2).translate(0, FY + SH - 0.01, 0), cream);
  const wo = { outC: cream, sill: 0.8, head: 2.0, win: 1.25, post: 0.3, inK: 'paint', inC: [0.78, 0.7, 0.55] };
  wallRun(K, boxes, s0, -SW, s1, -SW, FY, SH, { ...wo, out: -1 });
  wallRun(K, boxes, s0, SW, s1, SW, FY, SH, { ...wo, out: 1 });
  wallRun(K, boxes, s1, -SW, s1, SW, FY, SH, { ...wo, out: -1, doors: [[SW - 0.7, SW + 0.7]], win: 0.8 });
  wallRun(K, boxes, s0, -SW, s0, SW, FY, SH, { ...wo, out: 1, doors: [[SW - 0.7, SW + 0.7]], win: 0.8 });
  K.add('gold', new T.BoxGeometry(s1 - s0 + 0.05, 0.08, 0.02).translate(0, FY + 0.82, -SW - 0.07)); K.add('gold', new T.BoxGeometry(s1 - s0 + 0.05, 0.08, 0.02).translate(0, FY + 0.82, SW + 0.07));
  // Bänke Rücken an Rücken in der Mitte, Fahrgäste schauen hinaus
  for (const s of [-1, 1]) for (const x of [-5.5, -2, 2, 5.5]) {
    benchGeo(K, 2.6, x, FY, s * 0.35, s > 0 ? 0 : Math.PI);
    boxes.push(bx6(x - 1.3, FY, s * 0.1, x + 1.3, FY + 0.45, s * 0.6));
    for (const dx2 of [-0.8, 0, 0.8]) if (R() < 0.45) spots.push({ lx: x + dx2, ly: FY + 0.45, lz: s * 0.47, lyaw: s > 0 ? 0 : Math.PI, sit: true, act: 7 + (R() < 0.4 ? 0.8 : 0.2) });
  }
  // Oberdeck
  K.add('deck', wuv(new T.BoxGeometry(s1 - s0 + 0.4, 0.14, 6.2).translate(0, UY - 0.07, 0), 2));
  K.add('paint', Bx(s1 - s0 + 0.5, 0.2, 0.1, 0, UY - 0.12, 3.12), teal); K.add('paint', Bx(s1 - s0 + 0.5, 0.2, 0.1, 0, UY - 0.12, -3.12), teal);
  boxes.push(bx6(s0 - 0.2, UY - 0.14, -3.1, s1 + 0.2, UY, 3.1));
  const uhs = { L: 30, half: () => 3.15, sheer: () => UY };
  railing(K, boxes, uhs, s0 - 0.1, s1 + 0.1, [], { y: () => UY, k: 'gold' });
  for (const xe of [s0 - 0.15, s1 + 0.15]) { const gap = xe > 0 ? [1.55, 2.65] : null; for (let z = -3.1; z < 3.1; z += 0.5) { if (gap && z + 0.5 > gap[0] && z < gap[1]) continue; boxes.push(bx6(xe - 0.06, UY, z, xe + 0.06, UY + 1.05, z + 0.5)); } K.add('gold', new T.CylinderGeometry(0.025, 0.025, 6.2, 5).rotateX(Math.PI / 2).translate(xe, UY + 1.0, 0)); }
  for (const s of [-1, 1]) for (const x of [-6, -3.5, 3.5, 6]) { benchGeo(K, 2.0, x, UY, s * 2.35, s > 0 ? Math.PI : 0, 'varnish'); boxes.push(bx6(x - 1, UY, s * 2.1, x + 1, UY + 0.45, s * 2.6)); if (R() < 0.35) spots.push({ lx: x, ly: UY + 0.45, lz: s * 2.45, lyaw: s > 0 ? Math.PI : 0, sit: true, act: 7.3 }); }
  // Steuerhaus mit Schornstein, Fahrgäste an der Reling
  const WH = 2.2;
  K.add('paint', wuv(roundBox(3.2, WH, 3.2, 0.25).translate(0, UY + WH / 2, 0), 2), cream);
  for (const s of [-1, 1]) { K.add('glass', new T.PlaneGeometry(2.6, 0.8).rotateY(s > 0 ? 0 : Math.PI).translate(0, UY + 1.45, s * 1.61)); K.add('lit', new T.PlaneGeometry(2.5, 0.76).rotateY(s > 0 ? 0 : Math.PI).translate(0, UY + 1.45, s * 1.58), [1.0, 0.7, 0.38]); K.add('glass', new T.PlaneGeometry(2.6, 0.8).rotateY(s * Math.PI / 2).translate(s * 1.61, UY + 1.45, 0)); K.add('lit', new T.PlaneGeometry(2.5, 0.76).rotateY(s * Math.PI / 2).translate(s * 1.58, UY + 1.45, 0), [1.0, 0.7, 0.38]); }
  K.add('paint', wuv(roundBox(3.6, 0.14, 3.6, 0.06).translate(0, UY + WH + 0.07, 0), 2), teal);
  K.add('paint', new T.CylinderGeometry(0.45, 0.55, 1.8, 18).scale(1.4, 1, 1).translate(-0.6, UY + WH + 0.9, 0), cream);
  K.add('iron', new T.CylinderGeometry(0.42, 0.45, 0.35, 18).scale(1.4, 1, 1).translate(-0.6, UY + WH + 1.9, 0));
  K.add('gold', new T.CylinderGeometry(0.47, 0.47, 0.12, 18).scale(1.4, 1, 1).translate(-0.6, UY + WH + 1.3, 0));
  boxes.push(bx6(-1.6, UY, -1.6, 1.6, UY + WH, 1.6));
  // Treppe am einen Ende hinauf
  const stY0 = hs.sheer(12.4), nSt = 9;
  for (let k = 0; k < nSt; k++) { const x1 = 12.4 - k * 4.2 / nSt, x0 = x1 - 4.2 / nSt, top = stY0 + (UY - stY0) * (k + 1) / nSt; boxes.push(bx6(x0, top - 0.3, 1.55, x1, top, 2.65)); K.add('varnish', Bx(4.2 / nSt + 0.02, 0.06, 1.1, (x0 + x1) / 2, top - 0.03, 2.1, 1.5)); }
  for (const z of [1.5, 2.7]) boxes.push(bx6(s1 + 0.1, stY0, z - 0.04, 12.4, UY + 1.0, z + 0.04));
  // Reling unten mit Zugängen an beiden Enden, beidseitig
  railing(K, boxes, hs, -L / 2 + 0.5, L / 2 - 0.5, [[-11.6, -9.4], [9.4, 11.6]], { k: 'gold' });
  for (const xe of [-L / 2 + 0.45, L / 2 - 0.45]) { const hb = hs.half(xe) - 0.06, y = hs.sheer(xe); boxes.push(bx6(xe - 0.08, y, -hb, xe + 0.08, y + 1.05, hb)); K.add('gold', new T.CylinderGeometry(0.025, 0.025, hb * 2, 5).rotateX(Math.PI / 2).translate(xe, y + 1.0, 0)); }
  K.build(body);
  for (const s of [-1, 1]) { const n = nameplate('VESPERA I', 2.8, 0.45, '#f2d08a', '#0d2a2c'); n.position.set(0, UY + WH + 0.36, s * 1.82); n.rotation.y = s > 0 ? 0 : Math.PI; body.add(n); }
  const bulbs = [];
  for (let x = -6; x <= 6; x += 3) for (const z of [-1.5, 1.5]) bulbs.push({ p: [x, FY + SH - 0.15, z], c: [1.4, 1.0, 0.6], s: 0.5, ph: 0, bl: 0 });
  bulbs.push({ p: [1.0, UY + WH + 2.4, 0], c: [1.4, 1.35, 1.2], s: 0.8, ph: 0, bl: 0 }, { p: [0, UY + 0.4, -3.15], c: [1.5, 0.12, 0.08], s: 0.5, ph: 0, bl: 0 }, { p: [0, UY + 0.4, 3.15], c: [0.1, 1.4, 0.3], s: 0.5, ph: 0, bl: 0 });
  { const KK = kit(); KK.add('gold', new T.CylinderGeometry(0.04, 0.05, 2.4, 6).translate(1.0, UY + WH + 1.2, 0)); KK.build(body); }
  body.add(makeGlowPoints(bulbs));
  spots.push({ lx: 0.6, ly: UY, lz: 0.4, lyaw: Math.PI / 2, kind: 'police', col: [0.06, 0.07, 0.16], act: 0.2 });
  spots.push({ lx: -6.8, ly: UY, lz: -2.8, lyaw: Math.PI, act: 8, rail: true }, { lx: -6.2, ly: UY, lz: -2.8, lyaw: Math.PI, act: 8, rail: true }, { lx: 11.2, ly: hs.sheer(11.2), lz: -1.2, lyaw: Math.PI / 2, act: 0.8 }, { lx: 11.4, ly: hs.sheer(11.4), lz: -0.4, lyaw: -Math.PI / 2, act: 1.7 });
  return { g, body, boxes, spots, L, B, hs };
}
// Personen auf einer Plattform verteilen (Fahrgäste, Gäste, Besatzung)
export function spotPeds(pf, spots) {
  for (const s of spots) {
    const kind = s.kind || pick(['coat', 'suit', 'lady', 'dress', 'suit', 'lady', 'sailor']);
    const col = s.col || (kind === 'gown' ? pick(GOWNS) : kind === 'dress' ? pick(DRESSES) : kind === 'tux' ? COL.tux : kind === 'sailor' ? [0.93, 0.93, 0.9] : pick(COATS));
    let lyaw = s.lyaw;
    if (s.face) { const others = spots.filter(o => o !== s && o.face && Math.hypot(o.lx - s.lx, o.lz - s.lz) < 2.6); if (others.length) { const cx = others.reduce((a, o) => a + o.lx, 0) / others.length, cz = others.reduce((a, o) => a + o.lz, 0) / others.length; lyaw = Math.atan2(cx - s.lx, cz - s.lz); } }
    PORT_PEDS.push({ st: 8, pf, lx: s.lx, ly: s.ly, lz: s.lz, lyaw, act: s.act ?? (R() < 0.6 ? 0.7 : 1.5), sit: !!s.sit, kind, col, sc: kind === 'kid' ? 0.64 : 0.94 + R() * 0.12, v: 0, tilt: s.rail ? 0.22 : 0 });
  }
}
export function placeVessel(b, x, z, ry, kind = 'moored') {
  b.g.position.set(x, WATER_Y, z); b.g.rotation.y = ry; scene.add(b.g);
  const pf = addPlatform(b.g, b.boxes, b.L / 2 + 2, { ylo: -2, yhi: 12 });
  const v = { ...b, pf, kind, ph: R() * 6.28, w: 0.6 + R() * 0.5, amp: 0.035 + R() * 0.03, roll: b.L > 20 ? 0.004 : 0.012 };
  VESSELS.push(v); spotPeds(pf, b.spots); return v;
}

/* ---------- Bau: Kai, Jachthafen, Fähranleger, Luftschiffhafen ---------- */
export const PIER_Y = -0.95, MARINA_X = [-400, -300, -200], FERRY_X = -110;
export const AP = { x: 620, z: 637.5, fy: 34, tx: 0, tz: 0 };
export const QUAY_GAPS = [[-401.7, -398.3], [-301.7, -298.3], [-201.7, -198.3], [-112.2, -107.8], [600, 616]];
export function buildPort() {
  const K = kit(), z1 = QUAY.z1;
  // Kaimauer: Granitbelag, Kantensteine, eiserne Reling mit Goldhandlauf und Lichtband, Poller, Leitern
  K.add('stone', Bx(QX[1] - QX[0], 0.12, z1 - QUAY.z0, (QX[0] + QX[1]) / 2, 0.19, (QUAY.z0 + z1) / 2, 4));
  K.add('stone', Bx(QX[1] - QX[0], 3.6, 0.6, (QX[0] + QX[1]) / 2, -1.65, z1 - 0.3, 3), [0.8, 0.8, 0.82]);
  let x = QX[0];
  for (const [g0, g1] of [...QUAY_GAPS, [QX[1], QX[1]]]) {
    const a = x, b = g0;
    if (b - a > 0.5) {
      addCollider(a, 0, z1 - 0.7, b, 1.1, z1);
      K.add('iron', new T.BoxGeometry(b - a, 0.06, 0.06).translate((a + b) / 2, 0.35, z1 - 0.45));
      K.add('gold', new T.CylinderGeometry(0.04, 0.04, b - a, 6).rotateZ(Math.PI / 2).translate((a + b) / 2, 1.02, z1 - 0.45));
      addNeon((a + b) / 2, 1.07, z1 - 0.45, b - a, 0.025, 0.025, NEON.gold);
      for (let px = a + 0.2; px < b; px += 2.4) {
        K.add('iron', new T.CylinderGeometry(0.035, 0.045, 0.8, 6).translate(px, 0.65, z1 - 0.45));
        K.add('iron', new T.BoxGeometry(0.02, 0.6, 0.02).rotateZ(0.5).translate(px + 0.6, 0.65, z1 - 0.45)); K.add('iron', new T.BoxGeometry(0.02, 0.6, 0.02).rotateZ(-0.5).translate(px + 0.6, 0.65, z1 - 0.45));
      }
      for (const px of [a + 0.6, b - 0.6]) { if (b - a < 2) continue; K.add('stone', Bx(0.5, 1.15, 0.5, px, 0.82, z1 - 0.45, 1), [0.85, 0.83, 0.8]); K.add('gold', new T.SphereGeometry(0.16, 10, 8).translate(px, 1.5, z1 - 0.45)); }
    }
    x = g1;
  }
  for (let px = QX[0] + 10; px <= QX[1] - 18; px += 15) if (!QUAY_GAPS.some(([a, b]) => px > a - 3 && px < b + 3)) { K.add('iron', lathe([[0.2, 0], [0.17, 0.08], [0.13, 0.4], [0.2, 0.48], [0.22, 0.55], [0, 0.58]], 12).translate(px + 7.5, 0.25, z1 - 1.3)); addCollider(px + 7.3, 0, z1 - 1.5, px + 7.7, 0.8, z1 - 1.1); }
  for (let px = QX[0] + 20; px <= QX[1] - 20; px += 60) for (let k = 0; k < 9; k++) K.add('iron', new T.BoxGeometry(0.5, 0.03, 0.03).translate(px, -0.2 - k * 0.3, z1 + 0.05));
  // Bänke zum Wasser hin
  for (let px = QX[0] + 15; px <= QX[1] - 15; px += 32) if (!QUAY_GAPS.some(([a, b]) => px > a - 6 && px < b + 6)) {
    benchGeo(K, 2.0, px, 0.25, z1 - 3.0, 0); addCollider(px - 1, 0, z1 - 3.3, px + 1, 0.45, z1 - 2.7);
    if (Math.abs(px) < 800 && R() < 0.4) { const m = []; for (const dx of R() < 0.5 ? [-0.4, 0.4] : [(R() - 0.5) * 1.2]) m.push({ st: 4, x: px + dx, y: 0.69, z: z1 - 3.02, yaw: dx > 0 ? -0.25 : 0.25, sc: 0.92 + R() * 0.14, v: 0, sit: true, act: 7.8 }); PORT_PEDS.push(...m); if (m.length > 1) CHATS.push({ m, t: R() * 3, sit: true, x: px, z: z1 - 3 }); }
  }

  // Treppen vom Kai zu den Stegen (sechs Stufen hinunter)
  const stairs = (cx, w, zStart, dir = 1, axis = 'z') => {
    for (let k = 0; k < 6; k++) {
      const top = 0.25 - 0.2 * (k + 1), a = zStart + dir * k, b = a + dir;
      if (axis === 'z') { addCollider(cx - w / 2, -3, Math.min(a, b), cx + w / 2, top, Math.max(a, b)); K.add('plank', Bx(w, 0.12, 1.0, cx, top - 0.06, (a + b) / 2, 2)); }
      else { addCollider(Math.min(a, b), -3, cx - w / 2, Math.max(a, b), top, cx + w / 2); K.add('plank', Bx(1.0, 0.12, w, (a + b) / 2, top - 0.06, cx, 2)); }
    }
    for (const s of [-1, 1]) {
      if (axis === 'z') { addCollider(cx + s * w / 2 - 0.05, -2, zStart, cx + s * w / 2 + 0.05, 1.2, zStart + dir * 6); K.add('gold', new T.CylinderGeometry(0.03, 0.03, 6.3, 6).rotateX(Math.PI / 2 - Math.atan2(1.2, 6) * dir).translate(cx + s * w / 2, 0.3, zStart + dir * 3)); }
      else { addCollider(zStart, -2, cx + s * w / 2 - 0.05, zStart + dir * 6, 1.2, cx + s * w / 2 + 0.05); K.add('gold', new T.CylinderGeometry(0.03, 0.03, 6.3, 6).rotateZ(Math.PI / 2 + Math.atan2(1.2, 6) * dir).translate(zStart + dir * 3, 0.3, cx + s * w / 2)); }
    }
  };
  // Steg: Bohlen auf Pfählen, Collider bis knapp unter die Oberkante
  const pier = (x0, z0, x1, z1b, lamp = true) => {
    addCollider(Math.min(x0, x1), -1.4, Math.min(z0, z1b), Math.max(x0, x1), PIER_Y, Math.max(z0, z1b));
    K.add('plank', Bx(Math.abs(x1 - x0), 0.3, Math.abs(z1b - z0), (x0 + x1) / 2, PIER_Y - 0.15, (z0 + z1b) / 2, 2));
    const lx = Math.abs(x1 - x0) > Math.abs(z1b - z0);
    const n = Math.max(1, Math.round((lx ? Math.abs(x1 - x0) : Math.abs(z1b - z0)) / 4));
    for (let k = 0; k <= n; k++) for (const s of [0, 1]) {
      const t = k / n, px = lx ? x0 + (x1 - x0) * t : (s ? Math.max(x0, x1) : Math.min(x0, x1)), pz = lx ? (s ? Math.max(z0, z1b) : Math.min(z0, z1b)) : z0 + (z1b - z0) * t;
      K.add('varnish', wuv(new T.CylinderGeometry(0.14, 0.16, 4.2, 8).translate(px, PIER_Y - 1.4, pz), 1), [0.35, 0.28, 0.22]);
    }
  };
  for (const px of MARINA_X) {
    stairs(px, 3.2, z1, 1);
    pier(px - 1.5, z1 + 6, px + 1.5, 650);
    pier(px - 14, 650, px + 14, 653);
    for (let z = z1 + 14; z < 645; z += 16) lamps.push({ x: px + 1.3, z, h: 3.4, y: PIER_Y });
    for (const s of [-1, 1]) lamps.push({ x: px + s * 13, z: 651.5, h: 3.4, y: PIER_Y });
    for (const zf of [552, 566, 580, 594, 608, 622, 636]) for (const s of [-1, 1]) {
      pier(px + s * 1.5, zf - 0.6, px + s * 10.5, zf + 0.6, false);
      K.add('iron', lathe([[0.1, 0], [0.08, 0.15], [0.12, 0.2], [0, 0.22]], 8).translate(px + s * 10.1, PIER_Y, zf));
    }
  }
  // Fähranleger mit Wartehalle
  stairs(FERRY_X, 4.2, z1, 1);
  pier(FERRY_X - 2.1, z1 + 6, FERRY_X + 2.1, 592);
  for (let z = z1 + 12; z < 592; z += 14) lamps.push({ x: FERRY_X - 1.9, z, h: 3.4, y: PIER_Y });
  { const hx = FERRY_X, hz = z1 - 7.5;
    K.add('gold', wuv(roundBox(8, 0.2, 3.6, 0.08).translate(hx, 3.0, hz), 2)); for (const [dx2, dz2] of [[-3.8, -1.6], [3.8, -1.6], [-3.8, 1.6], [3.8, 1.6]]) K.add('iron', new T.CylinderGeometry(0.06, 0.08, 2.75, 8).translate(hx + dx2, 1.6, hz + dz2));
    K.add('glass', new T.PlaneGeometry(7.6, 2.2).translate(hx, 1.4, hz - 1.6)); benchGeo(K, 3.0, hx - 1.8, 0.25, hz - 1.1); benchGeo(K, 3.0, hx + 1.8, 0.25, hz - 1.1);
    addCollider(hx - 4, 0, hz - 1.7, hx + 4, 2.5, hz - 1.5);
    const sg = makeSignTex('FÄHRE · LUFTSCHIFFHAFEN', '#7ff0e6', false), sm = new T.Mesh(new T.PlaneGeometry(7.6, 7.6 * sg.H / sg.W), new T.MeshBasicMaterial({ map: sg.t, color: new T.Color(1.4, 1.4, 1.4) }));
    sm.position.set(hx, 3.6, hz + 1.85); scene.add(sm); addGlow(hx, 3.0, hz, [1.2, 0.85, 0.5], 3);
  }
  // Tor zum Jachthafen mit Leuchtschrift
  { const gx = -300, gz = z1 - 0.2;
    for (const s of [-1, 1]) { K.add('stone', Bx(0.7, 5.2, 0.7, gx + s * 2.3, 2.8, gz, 1), [0.86, 0.83, 0.78]); K.add('gold', new T.ConeGeometry(0.3, 0.8, 4).translate(gx + s * 2.3, 5.8, gz)); }
    K.add('stone', Bx(5.3, 0.6, 0.6, gx, 5.2, gz, 1), [0.86, 0.83, 0.78]);
    const sg = makeSignTex('JACHTHAFEN', '#f6c76a', false), sm = new T.Mesh(new T.PlaneGeometry(4.2, 4.2 * sg.H / sg.W), new T.MeshBasicMaterial({ map: sg.t, color: new T.Color(1.4, 1.4, 1.4), side: T.DoubleSide }));
    sm.position.set(gx, 4.4, gz - 0.32); sm.rotation.y = Math.PI; scene.add(sm); const sb = sm.clone(); sb.position.z = gz + 0.32; sb.rotation.y = 0; scene.add(sb);
  }
  K.build(scene);

  // Boote an die Fingerstege legen, die Jacht an den Kopf des mittleren Stegs
  const rr = mulberry32(8080);
  for (const px of MARINA_X) for (const zf of [552, 566, 580, 594, 608, 622, 636]) for (const s of [-1, 1]) {
    if (rr() < 0.22) continue;
    const r0 = rr(), b = r0 < 0.4 ? boatRunabout(rr) : r0 < 0.72 ? boatCruiser(rr) : boatSail(rr);
    const bz = zf + 0.6 + 0.35 + b.B / 2, bxp = px + s * (1.5 + 0.6 + b.L / 2);
    placeVessel(b, bxp, bz, s > 0 ? Math.PI : 0);
  }
  { const y = boatYacht(), hb = y.hs.half(-12); placeVessel(y, -300, 653 + hb + 1.5, 0); }
  for (const px of [-400, -200]) { const b = rr() < 0.5 ? boatSail(rr) : boatCruiser(rr); placeVessel(b, px + (rr() - 0.5) * 6, 653 + 0.35 + b.B / 2, rr() < 0.5 ? 0 : Math.PI); }
  // Fähre
  const fb = boatFerry(), fv = placeVessel(fb, 0, 0, 0, 'ferry');
  FERRY.v0 = fv; FERRY.g = fb.g;
  const A = new T.Vector3(FERRY_X + 2.1 + 0.3 + fb.hs.half(0), 0, 566), Bp = new T.Vector3(505 - 0.3 - fb.hs.half(0), 0, 625);
  FERRY.curve = new T.CubicBezierCurve3(A, A.clone().add(new T.Vector3(0, 0, 230)), Bp.clone().add(new T.Vector3(0, 0, 230)), Bp);
  FERRY.len = FERRY.curve.getLength();
  // Kleine Motorboote, die draußen in der Bucht Kreise ziehen
  for (let k = 0; k < 3; k++) { const b = boatRunabout(rr); b.g.position.set(0, WATER_Y, 900); scene.add(b.g); CRUISERS.push({ g: b.g, body: b.body, c: [[-150, 980], [420, 1100], [-620, 860]][k], r: [[260, 120], [200, 140], [180, 90]][k], w: [0.032, -0.04, 0.05][k], ph: k * 2 }); }

  buildAirport();
  // Spaziergänger auf der Promenade und auf den Stegen
  PORT_LOOPS.push({ pts: [[-700, 512], [700, 512], [700, 529], [-700, 529]], y: 0.25, per: 9 });
  for (const px of MARINA_X) PORT_LOOPS.push({ pts: [[px - 0.7, 543], [px + 0.7, 543], [px + 0.7, 648], [px - 0.7, 648]], y: PIER_Y, per: 30 });
  PORT_LOOPS.push({ pts: [[603, 538], [613, 538], [613, 690], [603, 690]], y: 0.25, per: 14 });
  // Plaudernde Grüppchen am Kai und auf den Stegköpfen
  const grp = (cx, cz, y, n) => { for (let k = 0; k < n; k++) { const a = k / n * 6.28 + R(); const x = cx + Math.cos(a) * 0.7, z = cz + Math.sin(a) * 0.7; PORT_PEDS.push({ st: 4, x, y, z, yaw: Math.atan2(cx - x, cz - z), sc: 0.92 + R() * 0.14, v: 0, act: [0.8, 1.6, 2.7, 5.7, 0.6][k % 5] }); } CHATS.push({ m: PORT_PEDS.slice(-n), t: R() * 3, x: cx, z: cz }); };
  for (let px = -880; px < 880; px += 70 + R() * 40) grp(px, z1 - 5 - R() * 10, 0.25, 2 + (R() * 3 | 0));
  for (const px of MARINA_X) grp(px + 8, 651.5, PIER_Y, 3);
  grp(FERRY_X, 585, PIER_Y, 3); grp(FERRY_X + 0.5, z1 - 9, 0.25, 4);
}
export const PORT_LOOPS = [], CRUISERS = [];
export const FERRY = { s: 0, dir: 1, wait: 25, v: 0, curve: null, len: 1, g: null };

/* ---------- Ufer der Stadtinsel: Kaimauer aus Granit, Brüstung mit Goldlicht, Laternen; Lücke nur für den Viadukt ---------- */
/* ---------- Luftschiffhafen: Plattform im Wasser, Damm, Abfertigungshalle, Landeturm mit Fahrstuhl, Ankermast ---------- */
export const ZEP = { state: 'dock', t: 0, s: 0, g: null, pf: null, gate: null, y0: 0, len: 1, curve: null, lines: null };
export function buildAirport() {
  const K = kit(), x0 = 520, x1 = 720, za = 575, zb = 700, top = 0.25;
  addCollider(x0, -3, za, x1, top, zb);
  K.add('stone', Bx(x1 - x0, 0.2, zb - za, (x0 + x1) / 2, top - 0.1, (za + zb) / 2, 4));
  K.add('stone', Bx(x1 - x0 + 0.4, 4.4, zb - za + 0.4, (x0 + x1) / 2, -2.25, (za + zb) / 2, 3), [0.75, 0.74, 0.76]);
  addCollider(600, -3, QUAY.z1 - 0.1, 616, top, za);
  K.add('stone', Bx(16, 4.6, za - QUAY.z1, 608, -2.05, (za + QUAY.z1) / 2, 3), [0.78, 0.77, 0.78]);
  K.add('stone', Bx(16, 0.2, za - QUAY.z1, 608, top - 0.1, (za + QUAY.z1) / 2, 4));
  // Brüstungen am Damm und rund um die Plattform
  const bal = (ax, az, bx, bz) => {
    addCollider(Math.min(ax, bx) - 0.2, 0, Math.min(az, bz) - 0.2, Math.max(ax, bx) + 0.2, 1.1, Math.max(az, bz) + 0.2);
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    K.add('stone', wuv(new T.BoxGeometry(len, 0.18, 0.45).rotateY(ang).translate((ax + bx) / 2, 1.0, (az + bz) / 2), 2), [0.86, 0.83, 0.78]);
    K.add('stone', wuv(new T.BoxGeometry(len, 0.2, 0.4).rotateY(ang).translate((ax + bx) / 2, 0.35, (az + bz) / 2), 2), [0.7, 0.68, 0.66]);
    const n = Math.floor(len / 0.5); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; K.add('stone', lathe([[0.09, 0], [0.06, 0.15], [0.1, 0.32], [0.06, 0.5], [0.09, 0.55]], 8).translate(ax + (bx - ax) * t, 0.4, az + (bz - az) * t), [0.86, 0.83, 0.78]); }
    addNeon((ax + bx) / 2, 1.12, (az + bz) / 2, Math.abs(bx - ax) + 0.05, 0.03, Math.abs(bz - az) + 0.05, NEON.gold);
  };
  bal(600, QUAY.z1 + 0.3, 600, za); bal(616, QUAY.z1 + 0.3, 616, za);
  bal(x0, za, 600, za); bal(616, za, x1, za); bal(x1, za, x1, zb); bal(x0, zb, x1, zb); bal(x0, za, x0, 621.5); bal(x0, 626.5, x0, zb);
  for (let z = QUAY.z1 + 6; z < za; z += 12) for (const s of [600.6, 615.4]) lamps.push({ x: s, z, h: 5, y: top });
  for (let x = x0 + 8; x < x1; x += 24) { lamps.push({ x, z: za + 1, h: 5, y: top }); lamps.push({ x, z: zb - 1, h: 5, y: top }); }
  // Treppe hinunter zum Fähranleger und der Ponton
  for (let k = 0; k < 6; k++) { const t2 = top - 0.2 * (k + 1), a = x0 - k, b = a - 1; addCollider(b, -3, 622, a, t2, 626); K.add('plank', Bx(1, 0.12, 4, (a + b) / 2, t2 - 0.06, 624, 2)); }
  for (const z of [621.9, 626.1]) addCollider(x0 - 6, -2, z - 0.06, x0, 1.2, z + 0.06);
  addCollider(505, -1.4, 600, 514, PIER_Y, 650); K.add('plank', Bx(9, 0.4, 50, 509.5, PIER_Y - 0.2, 625, 2));
  for (let z = 604; z < 650; z += 15) lamps.push({ x: 512.8, z, h: 3.4, y: PIER_Y });
  // Abfertigungshalle mit Leuchtschrift
  addSeg({ x: 552, z: 668, w: 50, d: 34, y0: top, y1: 13, tint: [0.88, 0.8, 0.66], seed: 951, style: 1, dens: 0.55, flood: 1.0 });
  addSeg({ x: 552, z: 668, w: 30, d: 20, y0: 13, y1: 18, tint: [0.88, 0.8, 0.66], seed: 952, style: 1, dens: 0.4, flood: 1.0 });
  neonFrame(552, 13, 668, 50, 34, NEON.gold); neonFrame(552, 18, 668, 30, 20, NEON.teal || NEON.gold);
  { const sg = makeSignTex('LUFTSCHIFFHAFEN', '#f6c76a', false), sm = new T.Mesh(new T.PlaneGeometry(22, 22 * sg.H / sg.W), new T.MeshBasicMaterial({ map: sg.t, color: new T.Color(1.4, 1.4, 1.4) })); sm.position.set(552, 10.5, 650.9); sm.rotation.y = Math.PI; scene.add(sm); }
  // Luftschiff mit begehbarer Fahrgastgondel
  const L = 170, ship = buildAirship(L, 19.5, 0, false, { passenger: true });
  const gd = passengerGondola(ship, L);
  ZEP.g = ship; ZEP.y0 = AP.fy - gd.fy; ZEP.gd = gd;
  ship.position.set(AP.x, ZEP.y0, AP.z); ship.rotation.y = 0;
  ZEP.pf = addPlatform(ship, gd.boxes, L / 2 + 4, { ylo: gd.fy - 3, yhi: gd.fy + 6 });
  spotPeds(ZEP.pf, gd.spots);
  // Landeturm neben der Gondel: Fahrstuhl, Plattform oben, überdachte Gangway zur Gondeltür
  const tx = AP.x + gd.gx - 1, tz = AP.z - gd.GW / 2 - 8 - 6; AP.tx = tx; AP.tz = tz;
  addSeg({ x: tx, z: tz, w: 12, d: 12, y0: top, y1: AP.fy, tint: [0.9, 0.84, 0.72], seed: 953, style: 1, dens: 0.5, flood: 1.0 });
  neonFrame(tx, AP.fy, tz, 12, 12, NEON.gold);
  const TK = kit(), fy = AP.fy;
  for (const [dx2, dz2] of [[-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6], [5.6, 5.6]]) TK.add('gold', new T.CylinderGeometry(0.12, 0.14, 3.3, 8).translate(tx + dx2, fy + 1.65, tz + dz2));
  TK.add('paint', wuv(roundBox(12.6, 0.3, 12.6, 0.12).translate(tx, fy + 3.45, tz), 2), [0.9, 0.84, 0.72]);
  for (const [ax, az, bx, bz] of [[-6, -6, 6, -6], [-6, -6, -6, 6], [6, -6, 6, 6], [-6, 6, -1.4, 6], [1.4, 6, 6, 6]]) {
    addCollider(tx + Math.min(ax, bx) - 0.05, fy, tz + Math.min(az, bz) - 0.05, tx + Math.max(ax, bx) + 0.05, fy + 1.1, tz + Math.max(az, bz) + 0.05);
    const len = Math.hypot(bx - ax, bz - az); TK.add('gold', new T.CylinderGeometry(0.035, 0.035, len, 6).rotateZ(Math.PI / 2).rotateY(Math.atan2(-(bz - az), bx - ax)).translate(tx + (ax + bx) / 2, fy + 1.05, tz + (az + bz) / 2));
    TK.add('glass', new T.PlaneGeometry(len, 0.9).rotateY(Math.atan2(-(bz - az), bx - ax)).translate(tx + (ax + bx) / 2, fy + 0.55, tz + (az + bz) / 2));
  }
  const gz0 = tz + 6, gz1 = AP.z - gd.GW / 2, gx0 = AP.x + gd.door - 0.1;
  addCollider(gx0 - 1.3, fy - 0.3, gz0, gx0 + 1.3, fy, gz1 + 0.15);
  for (const s of [-1, 1]) addCollider(gx0 + s * 1.3 - 0.06, fy, gz0, gx0 + s * 1.3 + 0.06, fy + 1.1, gz1);
  TK.add('plank', Bx(2.6, 0.2, gz1 - gz0, gx0, fy - 0.1, (gz0 + gz1) / 2, 2));
  TK.add('glass', new T.CylinderGeometry(1.45, 1.45, gz1 - gz0, 14, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(gx0, fy + 1.4, (gz0 + gz1) / 2));
  for (let z = gz0; z <= gz1; z += 2) TK.add('gold', new T.TorusGeometry(1.45, 0.05, 6, 16, Math.PI).rotateZ(0).translate(gx0, fy + 1.4, z).rotateY(0));
  TK.add('gold', new T.CylinderGeometry(0.04, 0.04, gz1 - gz0, 6).rotateX(Math.PI / 2).translate(gx0 - 1.3, fy + 1.0, (gz0 + gz1) / 2)); TK.add('gold', new T.CylinderGeometry(0.04, 0.04, gz1 - gz0, 6).rotateX(Math.PI / 2).translate(gx0 + 1.3, fy + 1.0, (gz0 + gz1) / 2));
  // Fahrstuhltür unten
  TK.add('gold', Bx(2.8, 3.4, 0.25, tx, top + 1.7, tz - 6.05, 1)); TK.add('lit', new T.PlaneGeometry(2.2, 2.9).translate(tx, top + 1.5, tz - 6.2), [1.3, 0.95, 0.55]);
  TK.add('lit', new T.PlaneGeometry(2.2, 2.6).rotateY(Math.PI).translate(tx, fy + 1.4, tz - 5.0 + 0.0), [1.3, 0.95, 0.55]);
  addCollider(tx - 1.4, fy, tz - 6, tx + 1.4, fy + 3, tz - 4.9);
  // Ankermast am Bug: Stahlgitter, Laterne an der Spitze
  const mx = AP.x + L / 2 + 3, mz = AP.z, mh = ZEP.y0 + 1;
  for (const [dx2, dz2] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) TK.add('iron', new T.CylinderGeometry(0.12, 0.2, mh, 6).rotateX(dz2 > 0 ? -0.035 : 0.035).rotateZ(dx2 > 0 ? 0.035 : -0.035).translate(mx + dx2 * 0.5, top + mh / 2, mz + dz2 * 0.5));
  for (let y = 4; y < mh - 2; y += 4) { const w = 5 - (y / mh) * 3.2; TK.add('iron', new T.BoxGeometry(w, 0.12, 0.12).translate(mx, top + y, mz - w / 2)); TK.add('iron', new T.BoxGeometry(w, 0.12, 0.12).translate(mx, top + y, mz + w / 2)); TK.add('iron', new T.BoxGeometry(0.12, 0.12, w).translate(mx - w / 2, top + y, mz)); TK.add('iron', new T.BoxGeometry(0.12, 0.12, w).translate(mx + w / 2, top + y, mz)); }
  TK.add('gold', new T.ConeGeometry(1.4, 2.2, 10).rotateZ(Math.PI / 2).translate(mx - 1.6, top + mh, mz));
  addCollider(mx - 2.6, 0, mz - 2.6, mx + 2.6, mh, mz + 2.6);
  TK.build(scene); K.build(scene);
  addGlow(mx, top + mh + 1.6, mz, [1.5, 0.2, 0.12], 2.2, 0, 1); addGlow(tx, fy + 4, tz, [1.4, 1.2, 0.9], 2.5);
  // Haltetaue vom Rumpf zu Ankern auf der Plattform
  const lp = []; for (const [lx, s] of [[-50, -1], [-50, 1], [10, -1], [10, 1], [55, -1], [55, 1]]) { lp.push(lx, -19.5 * 0.6, s * 19.5 * 0.75, lx + s * 6, -ZEP.y0 + top + 0.3, s * 30); }
  ZEP.lines = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(lp, 3)), new T.LineBasicMaterial({ color: 0x8a7a5a }));
  ship.add(ZEP.lines);
  // Tor am Ende der Gangway: geschlossen, solange das Schiff unterwegs ist
  const gateG = new T.Group(); gateG.position.set(0, 0, 0); scene.add(gateG);
  ZEP.gate = addPlatform(gateG, [], 2000, { ylo: -1e5, yhi: 1e5 });
  ZEP.gateBox = bx6(gx0 - 1.3, fy, gz1 - 0.3, gx0 + 1.3, fy + 2.2, gz1);
  // Rundflug: rückwärts ablegen, wenden, über die Stadt und zurück
  const P0 = [AP.x - 80, ZEP.y0 + 45, AP.z];
  const pts = [P0, [440, ZEP.y0 + 55, 640], [300, 150, 600], [80, 230, 430], [-260, 300, 190], [-560, 330, -180], [-420, 340, -560], [60, 340, -690], [520, 330, -430], [700, 300, -20], [570, 250, 330], [330, 170, 540], [300, 125, 645], [420, ZEP.y0 + 48, 640], P0].map(p => new T.Vector3(...p));
  ZEP.curve = new T.CatmullRomCurve3(pts, false, 'centripetal'); ZEP.len = ZEP.curve.getLength();
  ZEP.lift = liftProfile(u => { const q = ZEP.curve.getPointAt(Math.min(1, u)); return [q.x, q.y, q.z]; }, 110, 40);
  // Leute auf der Plattform und oben am Turm
  const grp = (cx, cz, y, n) => { for (let k = 0; k < n; k++) { const a = k / n * 6.28 + R(); const x = cx + Math.cos(a) * 0.7, z = cz + Math.sin(a) * 0.7; PORT_PEDS.push({ st: 4, x, y, z, yaw: Math.atan2(cx - x, cz - z), sc: 0.92 + R() * 0.14, v: 0, act: [0.8, 1.6, 2.7, 6.7, 0.6][k % 5] }); } CHATS.push({ m: PORT_PEDS.slice(-n), t: R() * 3, x: cx, z: cz }); };
  grp(590, 600, top, 4); grp(640, 590, top, 3); grp(560, 630, top, 3); grp(tx - 3, tz - 9, top, 2); grp(tx + 3, tz + 2, fy, 3);
}
// Fahrgastgondel: Speisesalon mit Fensterbändern, Bar achtern, Brücke vorn; Tür an Backbord zur Gangway
export function passengerGondola(ship, L) {
  const hr = ship.userData.hr, gx = L * 0.08, GL = 36, GW = 7.4, GH = 3.0, x0 = gx - GL / 2, x1 = gx + GL / 2, fy = -hr(gx) - GH - 0.15;
  const K = kit(), boxes = [], spots = [], skin = [0.6, 0.58, 0.55], cream = [0.92, 0.88, 0.8];
  K.add('paint', wuv(roundBox(GL + 0.4, 1.3, GW + 0.3, 0.6).translate(gx - 0.3, fy - 0.67, 0), 2), skin);
  K.add('paint', wuv(new T.BoxGeometry(GL, 0.7, GW + 0.2).translate(gx - 1.5, fy + GH + 0.35, 0), 2), skin);
  K.add('gold', new T.BoxGeometry(GL + 0.2, 0.1, GW + 0.34).translate(gx - 0.3, fy + 0.05, 0));
  K.add('carpet', (() => { const p = new T.PlaneGeometry(GL - 0.4, GW - 0.3).rotateX(-Math.PI / 2).translate(gx, fy + 0.01, 0); const a = p.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * GL / 1.6, a.getY(i) * GW / 1.6); return p; })());
  K.add('ceil', new T.PlaneGeometry(GL - 0.4, GW - 0.3).rotateX(Math.PI / 2).translate(gx, fy + GH - 0.01, 0), cream);
  for (let x = x0 + 1; x < x1 - 1; x += 2) K.add('gold', new T.BoxGeometry(0.08, 0.1, GW - 0.3).translate(x, fy + GH - 0.06, 0));
  boxes.push(bx6(x0, fy - 0.5, -GW / 2, x1, fy, GW / 2));
  const door = gx - 1.0, wo = { outC: skin, outK: 'paint', sill: 0.75, head: 2.3, win: 1.5, post: 0.5 };
  const nb = x1 - 3;
  wallRun(K, boxes, x0, -GW / 2, nb, -GW / 2, fy, GH, { ...wo, out: -1, doors: [[door - x0 - 0.9, door - x0 + 0.9]] });
  wallRun(K, boxes, x0, GW / 2, nb, GW / 2, fy, GH, { ...wo, out: 1 });
  wallRun(K, boxes, x0, -GW / 2, x0, GW / 2, fy, GH, { ...wo, out: 1, windows: false });
  wallRun(K, boxes, nb, -GW / 2, x1, -1.7, fy, GH, { ...wo, out: -1, sill: 0.6, head: 2.5, win: 1.2, post: 0.3 });
  wallRun(K, boxes, nb, GW / 2, x1, 1.7, fy, GH, { ...wo, out: 1, sill: 0.6, head: 2.5, win: 1.2, post: 0.3 });
  wallRun(K, boxes, x1, -1.7, x1, 1.7, fy, GH, { ...wo, out: -1, sill: 0.6, head: 2.5, win: 1.0, post: 0.25 });
  wallRun(K, boxes, gx + 11, -GW / 2, gx + 11, GW / 2, fy, GH, { outK: 'inWood', inK: 'inWood', outC: [1, 1, 1], out: 1, windows: false, doors: [[GW / 2 - 0.65, GW / 2 + 0.65]] });
  K.add('gold', new T.BoxGeometry(GL - 3, 0.1, 0.03).translate(gx - 1.5, fy + 0.75, -GW / 2 - 0.08)); K.add('gold', new T.BoxGeometry(GL - 3, 0.1, 0.03).translate(gx - 1.5, fy + 0.75, GW / 2 + 0.08));
  // Speisetische an den Fenstern, Stühle gegenüber, Tischlampen
  const FM = { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth', leaf: 'cloth' }, fadd = (k, g) => K.add(k, g, k === 'leather' ? [0.5, 0.09, 0.1] : k === 'lit' ? [1.5, 1.0, 0.55] : k === 'cloth' ? [0.93, 0.91, 0.87] : [1, 1, 1]);
  for (let x = x0 + 4.5; x < gx + 9.5; x += 3) for (const s of [-1, 1]) {
    if (s < 0 && Math.abs(x - door) < 2.2) continue;
    const z = s * (GW / 2 - 0.85);
    placeFurn(FURN.roundTable(0.45, 0.74, true), FM, fadd, x, fy, z); placeFurn(FURN.tableLamp(0.42), FM, fadd, x, fy + 0.76, z);
    boxes.push(bx6(x - 0.5, fy, z - 0.5, x + 0.5, fy + 0.76, z + 0.5));
    for (const d of [-1, 1]) { placeFurn(FURN.diningChair(), FM, fadd, x + d * 0.78, fy, z, d > 0 ? -Math.PI / 2 : Math.PI / 2); if (R() < 0.62) spots.push({ lx: x + d * 0.74, ly: fy + 0.48, lz: z, lyaw: d > 0 ? -Math.PI / 2 : Math.PI / 2, sit: true, act: 7 + (R() < 0.55 ? 0.8 : 0.2), kind: pick(['tux', 'gown', 'suit', 'lady', 'gown', 'tux']) }); }
  }
  // Bar achtern: Tresen, beleuchtetes Flaschenregal, Hocker, Barmann
  K.add('varnish', wuv(roundBox(0.65, 1.08, 5.0, 0.06).translate(x0 + 2.8, fy + 0.54, 0), 1.5)); K.add('gold', new T.BoxGeometry(0.72, 0.05, 5.05).translate(x0 + 2.8, fy + 1.1, 0));
  boxes.push(bx6(x0 + 2.45, fy, -2.5, x0 + 3.15, fy + 1.1, 2.5));
  for (let k = 0; k < 16; k++) K.add('lit', new T.CylinderGeometry(0.04, 0.04, 0.3, 8).translate(x0 + 0.35, fy + 1.45 + (k % 2) * 0.55, -2.4 + (k >> 1) * 0.68), k % 3 === 0 ? [0.6, 1.0, 0.4] : k % 3 === 1 ? [1.6, 0.8, 0.3] : [1.4, 1.2, 0.8]);
  K.add('varnish', Bx(0.3, 0.05, 5.4, x0 + 0.3, fy + 1.28, 0, 1.5)); K.add('varnish', Bx(0.3, 0.05, 5.4, x0 + 0.3, fy + 1.83, 0, 1.5));
  for (let k = 0; k < 4; k++) placeFurn(FURN.barStool(), FM, fadd, x0 + 3.6, fy, -1.8 + k * 1.2);
  spots.push({ lx: x0 + 1.5, ly: fy, lz: 0.4, lyaw: Math.PI / 2, kind: 'livery', col: [0.92, 0.9, 0.86], act: 0.6 }, { lx: x0 + 3.75, ly: fy, lz: -0.6, lyaw: -Math.PI / 2, kind: 'tux', act: 5.6 }, { lx: x0 + 3.9, ly: fy, lz: 0.6, lyaw: -Math.PI / 2 - 0.4, kind: 'gown', act: 2.7 });
  spots.push({ lx: gx - 4.0, ly: fy, lz: 0.2, lyaw: 0.3, kind: 'livery', col: [0.92, 0.9, 0.86], act: 0.1 }, { lx: gx + 2, ly: fy, lz: 2.6, lyaw: Math.PI / 2, kind: 'gown', act: 8.0, rail: true });
  // Brücke: Steuerrad, Höhenruderrad, Maschinentelegraf, Kartentisch, Kapitän und Offizier
  const bw = x1 - 1.6;
  K.add('gold', new T.TorusGeometry(0.38, 0.035, 6, 24).rotateY(Math.PI / 2).translate(bw, fy + 1.15, 0));
  for (let k = 0; k < 8; k++) K.add('gold', new T.CylinderGeometry(0.018, 0.018, 0.92, 4).rotateX(k / 8 * Math.PI).translate(bw, fy + 1.15, 0));
  K.add('varnish', Bx(0.4, 0.9, 0.6, bw + 0.35, fy + 0.45, 0, 1.5));
  K.add('gold', new T.TorusGeometry(0.32, 0.03, 6, 20).translate(bw - 0.4, fy + 1.1, -1.25)); K.add('varnish', Bx(0.4, 0.8, 0.4, bw - 0.4, fy + 0.4, -1.55, 1.5));
  K.add('gold', lathe([[0.16, 0], [0.09, 0.08], [0.06, 0.9], [0.17, 1.0], [0.17, 1.2], [0, 1.24]], 12).translate(bw - 0.6, fy, 1.4));
  K.add('varnish', Bx(1.6, 0.85, 0.9, gx + 13, fy + 0.42, 2.6, 1.5)); K.add('cloth', new T.PlaneGeometry(1.4, 0.75).rotateX(-Math.PI / 2).translate(gx + 13, fy + 0.86, 2.6), [0.86, 0.8, 0.62]);
  boxes.push(bx6(gx + 12.2, fy, 2.15, gx + 13.8, fy + 0.86, 3.6), bx6(bw + 0.15, fy, -0.3, bw + 0.55, fy + 0.9, 0.3));
  spots.push({ lx: bw - 0.52, ly: fy, lz: 0, lyaw: Math.PI / 2, kind: 'police', col: [0.92, 0.9, 0.86], act: 33.5 }, { lx: gx + 13, ly: fy, lz: 1.75, lyaw: 0, kind: 'police', col: [0.06, 0.07, 0.16], act: 28.4 });
  K.build(ship);
  const bulbs = [];
  for (let x = x0 + 2; x < x1 - 1; x += 2.5) for (const z of [-1.6, 1.6]) bulbs.push({ p: [x, fy + GH - 0.18, z], c: [1.4, 0.95, 0.55], s: 0.5, ph: 0, bl: 0 });
  for (let x = x0 + 3.5; x < gx + 9.5; x += 3) for (const s of [-1, 1]) bulbs.push({ p: [x, fy + 1.05, s * (GW / 2 - 0.85)], c: [1.6, 1.0, 0.5], s: 0.3, ph: 0, bl: 0 });
  ship.add(makeGlowPoints(bulbs));
  return { boxes, spots, fy, gx, GW, GL, door };
}

/* ---------- Bewegung: Boote schaukeln, Fähre pendelt, Motorboote kreisen, Luftschiff fliegt Rundflüge ---------- */
export const easeIO = k => k * k * (3 - 2 * k);
export let portTimer = 0;
export function updatePort(dt, t) {
  for (const pf of PLATFORMS) pfSave(pf);
  const cp = camera.position;
  portTimer -= dt;
  const cull = portTimer <= 0, dens = U.uFogDensity.value; if (cull) portTimer = 0.5;
  for (const v of VESSELS) {
    if (cull) {
      // V29: wie Laternen und Bäume (V27): was ganz im Bodennebel liegt, wird nicht gezeichnet (Höhe der Mastspitze über null)
      if (v.top === undefined) v.top = new T.Box3().setFromObject(v.g).max.y + 0.5;
      const lim = Math.min(v.L > 20 ? 1500 : 700, fogHideDist(v.top, cp.y, dens) + 8);
      v.g.visible = (v.g.position.x - cp.x) ** 2 + (v.g.position.z - cp.z) ** 2 < lim * lim;
    }
    if (v.kind !== 'moored' || !v.g.visible) continue;
    bobVessel(v, t);
  }
  const W = U.uWake.value;
  // Fähre
  const F = FERRY;
  if (F.g) {
    if (F.wait > 0) { F.wait -= dt; F.v = 0; }
    else {
      const rem = (F.dir > 0 ? 1 - F.s : F.s) * F.len, vt = Math.min(7.5, Math.sqrt(2 * 0.35 * Math.max(rem, 0)) + 0.25);
      F.v += Math.max(-0.6 * dt, Math.min(0.35 * dt, vt - F.v));
      F.s += F.dir * F.v * dt / F.len;
      if (F.s >= 1 || F.s <= 0) { F.s = Math.max(0, Math.min(1, F.s)); F.dir = -F.dir; F.wait = 40; F.v = 0; }
    }
    const p = F.curve.getPointAt(F.s), tg = F.curve.getTangentAt(F.s);
    F.g.position.set(p.x, WATER_Y + waterH(p.x, p.z) * 0.35, p.z); F.g.rotation.y = Math.atan2(-tg.z, tg.x);
    F.v0.body.rotation.x = Math.sin(t * 0.55) * 0.006; F.v0.body.rotation.z = Math.sin(t * 0.43) * 0.004 + F.v * 0.0015 * -F.dir;
    W[0].set(p.x, p.z, Math.atan2(tg.z, tg.x) + (F.dir < 0 ? Math.PI : 0), F.v);
  }
  // Motorboote in der Bucht
  CRUISERS.forEach((c, i) => {
    const a = c.ph + t * c.w, x = c.c[0] + Math.cos(a) * c.r[0], z = c.c[1] + Math.sin(a) * c.r[1];
    const dx = -Math.sin(a) * c.r[0] * Math.sign(c.w), dz = Math.cos(a) * c.r[1] * Math.sign(c.w), sp = Math.hypot(dx, dz) * Math.abs(c.w);
    c.g.position.set(x, WATER_Y + 0.05 + waterH(x, z) * 0.8, z); c.g.rotation.y = Math.atan2(-dz, dx); c.body.rotation.z = 0.05; c.body.rotation.x = Math.sin(t * 2.1 + i) * 0.015 + 0.04 * Math.sign(c.w);
    W[i + 1].set(x, z, Math.atan2(dz, dx), sp);
  });
  updateZeppelin(dt, t);
  for (const pf of PLATFORMS) pfRead(pf);
}
export function updateZeppelin(dt, t) {
  const Z = ZEP; if (!Z.g) return;
  const bob = Math.sin(t * 0.35) * 0.1, P0x = AP.x - 80;
  if (Z.state === 'dock') { Z.g.position.set(AP.x, Z.y0 + bob, AP.z); Z.g.rotation.y = 0; }
  else if (Z.state === 'out') {
    Z.t += dt; const k = easeIO(Math.min(1, Z.t / 30));
    Z.g.position.set(AP.x - 80 * easeIO(Math.min(1, Z.t / 22)), Z.y0 + 45 * k + bob, AP.z); Z.g.rotation.y = Math.PI * easeIO(Math.min(1, Math.max(0, (Z.t - 10) / 20)));
    if (Z.t >= 30) { Z.state = 'fly'; Z.s = 0; }
  } else if (Z.state === 'fly') {
    Z.s = Math.min(1, Z.s + 21 * dt / Z.len);
    const p = Z.curve.getPointAt(Z.s), tg = Z.curve.getTangentAt(Z.s);
    let ry = Math.atan2(-tg.z, tg.x); const cur = Z.g.rotation.y; while (ry - cur > Math.PI) ry -= Math.PI * 2; while (ry - cur < -Math.PI) ry += Math.PI * 2;
    const lift = ZEP.lift(Z.s) * Math.min(1, Z.s * 12, (1 - Z.s) * 12);
    Z.g.position.set(p.x, p.y + lift + bob, p.z); Z.g.rotation.y = cur + (ry - cur) * Math.min(1, dt * 1.5);
    if (Z.s >= 1) { Z.state = 'in'; Z.t = 0; }
  } else if (Z.state === 'in') {
    Z.t += dt; const k = easeIO(Math.min(1, Z.t / 28));
    Z.g.position.set(P0x + 80 * k, Z.y0 + 45 * (1 - k) + bob, AP.z);
    let r = Z.g.rotation.y; while (r > Math.PI) r -= Math.PI * 2; while (r < -Math.PI) r += Math.PI * 2; Z.g.rotation.y = r * (1 - Math.min(1, dt * 1.2));
    if (Z.t >= 28) { Z.state = 'dock'; Z.g.rotation.y = 0; toast('Das Luftschiff hat am Landeturm festgemacht'); }
  }
  Z.pf.air = Z.state !== 'dock';
  Z.lines.visible = Z.state === 'dock';
  Z.gate.boxes = Z.state === 'dock' ? [] : [Z.gateBox];
}
// Spieler fährt mit: Stand er zuletzt auf einer Plattform, wird er mit ihr verschoben und gedreht
export function carryPlayer() {
  const pf = player.on; if (!pf || player.fly) return;
  const dx = player.p.x - pf.px, dz = player.p.z - pf.pz, c0 = Math.cos(pf.pry), s0 = Math.sin(pf.pry), lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0, c1 = Math.cos(pf.ry), s1 = Math.sin(pf.ry);
  player.p.x = pf.x + lx * c1 + lz * s1; player.p.z = pf.z - lx * s1 + lz * c1; player.p.y += pf.y - pf.py; player.yaw += pf.ry - pf.pry;
}
export function portInteractions() {
  INTERACT.push({ test: p => Math.abs(p.x - AP.tx) < 2 && p.z > AP.tz - 8.5 && p.z < AP.tz - 5.5 && p.y < 3, label: 'Fahrstuhl zum Luftschiff · Landeturm', act: () => travel([AP.tx, AP.fy, AP.tz - 3.5], Math.PI, 0, 'Landeturm · Gangway zum Luftschiff') });
  INTERACT.push({ test: p => Math.abs(p.x - AP.tx) < 2 && p.z > AP.tz - 5 && p.z < AP.tz - 2.5 && Math.abs(p.y - AP.fy) < 1.5, label: 'Fahrstuhl hinunter zum Hafen', act: () => travel([AP.tx, 0.25, AP.tz - 8], 0, 0, 'Luftschiffhafen') });
  const inBridge = p => { if (!ZEP.pf) return false; const [lx, lz] = pfLocal(ZEP.pf, p.x, p.z); return lx > ZEP.gd.gx + 11 && lx < ZEP.gd.gx + 18 && Math.abs(lz) < 3.6 && Math.abs(p.y - (ZEP.pf.y + ZEP.gd.fy)) < 1.5; };
  INTERACT.push({ test: p => ZEP.state === 'dock' && inBridge(p), label: 'Rundflug über Vespera starten', act: () => { ZEP.state = 'out'; ZEP.t = 0; toast('Leinen los: Rundflug über Vespera'); } });
  INTERACT.push({ test: p => FERRY.g && FERRY.wait > 3 && player.on === FERRY.v0.pf, label: 'Fähre legt gleich ab', act: () => { FERRY.wait = 2; toast('Die Fähre legt ab'); } });
}

/* ---------- Berge: ein Gebirgsring um die Stadt, zur Bucht hin offen ---------- */
// Gelände: Stadtplateau, Felsabbruch, Tal mit Tannen, dahinter der Gebirgsring
export const TER = (() => {
  const rnd = mulberry32(4242);
  const perm = []; for (let i = 0; i < 256; i++) perm.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const h2 = (x, y) => perm[(perm[x & 255] + y) & 255] / 255;
  const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (h2(ix, iy) * (1 - u) + h2(ix + 1, iy) * u) * (1 - v) + (h2(ix, iy + 1) * (1 - u) + h2(ix + 1, iy + 1) * u) * v; };
  const fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2.1 + 3, y * 2.1 + 7) * 0.25 + noise(x * 4.3 + 11, y * 4.3 + 5) * 0.125 + noise(x * 8.7 + 1, y * 8.7 + 9) * 0.0625;
  return { rnd, noise, fbm };
})();
export const RIM = 1120, CLIFF = 178, VALLEY_W = 190;
export function terrainInfo(wx, wz) {
  const x = wx, z = wz + 100;
  const r = Math.hypot(x, z), sq = Math.max(Math.abs(x), Math.abs(z)), ang = Math.atan2(x, -z);
  const met = sq;
  const south = Math.max(0, Math.cos(ang - Math.PI));
  const rim = RIM + 520 * south * south + (TER.fbm(x * 0.012, z * 0.012) - 0.5) * 160;
  const inner = rim + VALLEY_W, peak = 2100 + 300 * south;
  return { r, ang, met, south, rim, inner, peak };
}
export const VILLA = { x: 0, z: 0, y: 0, r: 170, ux: 0, uz: 0, ry: 0, boxes: null };
export function terrainHeight(wx, wz) {
  let h = accessCarve(wx, wz, terrainHeightRaw(wx, wz));
  if (!VILLA.y) return h;
  const dx = wx - VILLA.x, dz = wz - VILLA.z, d = Math.hypot(dx, dz);
  // Sichtschneise zur Stadt: davor fällt das Gelände ab
  const u = dx * VILLA.ux + dz * VILLA.uz, v = Math.abs(-dx * VILLA.uz + dz * VILLA.ux);
  if (u > 0 && u < 700 && v < 260) {
    const cap = VILLA.y - 3 - u * 0.42, k = Math.min(1, Math.max(0, (260 - v) / 90));
    h = Math.min(h, h + (cap - h) * k);
  }
  if (d < VILLA.r) {
    // Plateau für Haus und Vorfahrt
    const t = Math.min(1, Math.max(0, (d - 80) / (VILLA.r - 80)));
    h = VILLA.y + (h - VILLA.y) * t * t * (3 - 2 * t);
  }
  // vor dem Haus: der Hang folgt den Terrassen, sie liegen eingebettet darin
  if (u > -20 && u < 150 && v < 110) {
    const by = VILLA.y;
    const top = u < 30 ? by : u < 52 ? by - 5 : u < 72 ? by - 11 : u < 90 ? by - 17 : by - 17 - (u - 90) * 0.9;
    const target = top - 0.7 + Math.max(0, v - 46) * 0.35;
    const kv = Math.min(1, Math.max(0, (110 - v) / 50)), ku = u > 120 ? (150 - u) / 30 : (u < 0 ? (u + 20) / 20 : 1);
    h = h + (target - h) * kv * ku;
  }
  return serpTerrain(wx, wz, h);
}
export function terrainHeightRaw(wx, wz) {
  const { r, ang, met, south, inner, peak } = terrainInfo(wx, wz);
  const x = wx, z = wz + 100;
  // Die Stadt liegt auf einer Insel: außerhalb der Ufermauer Seegrund, erst am Gebirge steigt das Land wieder
  const shore = -landDist(wx, wz);
  if (shore <= 0) return -2.5;
  const detail = TER.fbm(x * 0.0017 + 40, z * 0.0017 + 40);
  const jag = TER.noise(x * 0.04, z * 0.04) * 0.6 + TER.noise(x * 0.11 + 7, z * 0.11) * 0.4;
  const floor = -2.5 - 14 * Math.min(1, shore / 18) - 4 * detail;
  if (met < inner) return floor;
  // Steilufer: Felswand aus dem See, über die die Wasserfälle stürzen
  const tc = Math.min(1, (met - inner) / (38 + 14 * jag)), wall = tc * tc * (3 - 2 * tc) * (1 - south) * (CLIFF * 0.75 + 30 * jag);
  const rise = Math.min(1, Math.max(0, (met - inner) / (peak - inner)));
  const base = rise * rise * (3 - 2 * rise) * (1 - 0.3 * south);
  const ridge = 0.35 + 0.65 * (1 - Math.abs(2 * TER.fbm(ang * 2.2, r * 0.0009) - 1));
  // Grate und Rinnen: gefaltetes Rauschen in drei Maßstäben, nach oben stärker
  const rn = (u, v) => 1 - Math.abs(2 * TER.noise(u, v) - 1);
  const crest = rn(x * 0.0024, z * 0.0024) * 0.5 + rn(x * 0.0061 + 5, z * 0.0061) * 0.3 + rn(x * 0.016, z * 0.016 + 3) * 0.2;
  const far = Math.min(1, Math.max(0, (met - peak) / 2500));
  return floor * (1 - rise) + wall + base * (650 + 750 * ridge * detail) + Math.pow(rise, 1.3) * crest * crest * (380 + 500 * far) + rise * 22 * jag - 2.5;
}
/* ---------- Die einzige Zufahrt: ein durchgehender Viadukt bis an den Berg, dann der Tunnel ---------- */
export const ROAD_W = 14, ROAD_Z0 = -985;
export const VIA = { grade: 0.045, portalZ: 0, tunnelLen: 280, end: 0 };
export const deckY = z => 0.3 + Math.max(0, ROAD_Z0 - z) * VIA.grade;
export function planAccess() {
  VIA.portalZ = -1700;
  for (let z = -1260; z > -2600; z -= 2) if (terrainHeightRaw(0, z) > deckY(z) + 34) { VIA.portalZ = z; break; }
  VIA.end = VIA.portalZ - VIA.tunnelLen;
}
// Gelände entlang der Trasse: Felseinschnitt vor dem Portal, genug Fels über dem Tunnel
export function accessCarve(wx, wz, h) {
  if (!VIA.portalZ) return h;
  const ax = Math.abs(wx);
  if (ax > 120 || wz > VIA.portalZ + 300 || wz < VIA.end - 80) return h;
  const d = deckY(Math.max(wz, VIA.end));
  if (wz > VIA.portalZ) return Math.min(h, d - 5 + Math.max(0, ax - 11) * 1.5);
  if (ax < 30) return Math.max(h, d + 22 - ax * 0.3);
  return h;
}
export function roadHeightAt(x, z, y) {
  if (Math.abs(x) > ROAD_W / 2 + 0.4 || z > ROAD_Z0 || z < VIA.end) return { y: -1e9 };
  const d = deckY(z);
  if (z < VIA.portalZ + 2 && y < d + 9) return { y: d, tunnel: true };
  return y > d - 3 ? { y: d } : { y: -1e9 };
}
