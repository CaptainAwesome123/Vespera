import { wantTexture } from './assets.js';
import { canvasTex, T, scene, mulberry32, ANISO, mergeGeos, pick, R, rand, MOBILE, camera } from './core.js';
import { RUNNER_TEX, decoRugTex, friezeTex, muralTex, damaskTex } from './deco-tex.js';
import { addCollider, stdMat, MAT } from './people-skeleton.js';
import { addSeg, addNeon, addGlow, NEON, shafts, spires, lamps, trees, FL } from './facade-shader.js';
import { PLAZA, MEDIAN } from './island.js';
import { crownFins, neonFrame, FAN_TEX, makeSignTex, lathe, DOORS, placeFurn, FURN, movOn, movOff } from './entrances.js';
import { fanAtSingle, addNeonArc, setDance } from './dance.js';
import { kit, Bx } from './harbour.js';
import { Crowd, GOWNS } from './serpentine.js';
import { makeBeam } from './airships.js';
import { player } from './player.js';
import { addLight } from './performance.js';
import { plazaMaterial } from './plaza.js';
import { buildFountain } from './fountain.js';
import { buildBelmontLuxe } from './belmont-luxe.js';
import { galaPeople } from './gala.js';
import { shadeBegin, shadeEnd, shadeRoom, shadeQuad, shadeEdge, shadeWall, shadeDisc, shadeColumn, lightPool, roughTex, addSheen } from './raumlicht.js';

/* =====================================================================
   THE BELMONT — das Grand Hotel im Zentrum
   ===================================================================== */
export const BEL = { podium: 34, s1: 190, s2: 250, s3: 290, s4: 320, s5: 340, spire: 418, mast: 432 };
export function buildBelmont() {
  const cream = [0.17, 0.155, 0.18], dark = [0.1, 0.09, 0.11];
  const P = 0.26;
  // Platz
  addCollider(PLAZA.x0, 0, PLAZA.z0, PLAZA.x1, P, PLAZA.z1);
  // V27: das Pflaster rechnet der Shader aus der Weltlage (src/plaza.js), scharf in jeder Nähe
  const plazaTop = new T.Mesh(new T.PlaneGeometry(198, 266), plazaMaterial());
  plazaTop.rotation.x = -Math.PI / 2; plazaTop.position.set(0, P, 0); scene.add(plazaTop);

  const GR = [0.95, 0.72, 0.34], GD = [0.5, 0.36, 0.16];
  // Sockel mit Ballsälen und Arkaden, dazu zwei Seitenflügel
  // Sockel als begehbare Hülle: vier Mauern, Dach, Portalöffnung im Süden
  const pod = (x, z, w, d, y0 = P, y1 = 32) => addSeg({ x, z, w, d, y0, y1, tint: cream, seed: 501, style: 0, dens: 0.45, flood: 0.6, rib: GD });
  pod(0, -49, 100, 2); pod(-49, 0, 2, 96); pod(49, 0, 2, 96);
  pod(-29, 49, 42, 2); pod(29, 49, 42, 2); pod(0, 49, 16, 2, 9.2, 32);
  pod(0, 0, 100, 100, 32, BEL.podium);
  // Arkadendach rund um den Sockel
  for (const [x, z, w, d] of [[0, -52.5, 110, 5], [0, 52.5, 110, 5], [-52.5, 0, 5, 100], [52.5, 0, 5, 100]])
    addSeg({ x, z, w, d, y0: 6, y1: 7.2, tint: dark, seed: 502, style: 3, dens: 0, flood: 0.6, rib: GD }, false);
  for (let k = -51; k <= 51; k += 6) for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (Math.abs(k) < 15 && oz === 1) continue;
    addSeg({ x: ox ? ox * 54 : k, z: oz ? oz * 54 : k, w: 1.2, d: 1.2, y0: P, y1: 6, tint: [0.22, 0.2, 0.2], seed: 548, style: 0, dens: 0, flood: 0.6 });
    addNeon(ox ? ox * 54 : k, 5.7, oz ? oz * 54 : k, 1.5, 0.3, 1.5, [0.55, 0.4, 0.18]);
    addNeon(ox ? ox * 54 : k, 0.6, oz ? oz * 54 : k, 1.5, 0.25, 1.5, [0.35, 0.26, 0.12]);
  }
  for (let k = -40; k <= 40; k += 10) for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) addGlow(ox ? ox * 52 : k, 5.0, oz ? oz * 52 : k, [1.2, 0.8, 0.42], 1.3);
  for (const sx of [-1, 1]) {
    addSeg({ x: sx * 66, z: -10, w: 32, d: 70, y0: P, y1: 22, tint: cream, seed: 540, style: 0, dens: 0.6, flood: 1, rib: GR });
    addSeg({ x: sx * 66, z: -10, w: 24, d: 60, y0: 22, y1: 30, tint: cream, seed: 541, style: 0, dens: 0.6, flood: 1, rib: GR });
    crownFins(sx * 66, -10, 24, 60, 30, 4, GR);
    neonFrame(sx * 66, 22, -10, 32, 70, NEON.gold);
  }
  // Kannelierte Pilaster am Sockel (V34: beginnen auf dem Arkadendach; vorher lag ihre Unterseite in der Unterseite des Dachs und flackerte)
  for (let k = -45; k <= 45; k += 6) for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    if (Math.abs(k) < 12 && oz === 1) continue;
    addSeg({ x: ox ? ox * 50.4 : k, z: oz ? oz * 50.4 : k, w: ox ? 0.8 : 1.6, d: oz ? 0.8 : 1.6, y0: 7.2, y1: BEL.podium - 2, tint: cream, seed: 545, style: 0, dens: 0, flood: 0.5, rib: GD }, false);
  }
  crownFins(0, 0, 100, 100, BEL.podium, 5, GR);
  // Turmstufen
  addSeg({ x: 0, z: 0, w: 62, d: 62, y0: BEL.podium, y1: BEL.s1, tint: cream, seed: 503, style: 1, dens: 0.6, flood: 1, rib: GR });
  addSeg({ x: 0, z: 0, w: 50, d: 50, y0: BEL.s1, y1: BEL.s2, tint: cream, seed: 504, style: 1, dens: 0.66, flood: 1, rib: GR });
  // V33: die unteren 13 m dieser Stufe sind jetzt Alexanders Penthouse-Suite hinter Glas (src/penthouse.js); die Fassade beginnt darüber
  addSeg({ x: 0, z: 0, w: 40, d: 40, y0: BEL.s2 + 13, y1: BEL.s3, tint: [0.3, 0.26, 0.24], seed: 505, style: 2, dens: 1, flood: 1, fl: FL.noBot });
  addSeg({ x: 0, z: 0, w: 28, d: 28, y0: BEL.s3, y1: BEL.s4, tint: cream, seed: 506, style: 1, dens: 0.7, flood: 1, rib: GR });
  addSeg({ x: 0, z: 0, w: 18, d: 18, y0: BEL.s4, y1: BEL.s5, tint: [0.3, 0.26, 0.24], seed: 507, style: 2, dens: 1, flood: 1 });
  crownFins(0, 0, 62, 62, BEL.s1, 7, GR);
  crownFins(0, 0, 40, 40, BEL.s3, 6, GR);
  crownFins(0, 0, 28, 28, BEL.s4, 5, GR);
  crownFins(0, 0, 18, 18, BEL.s5, 6, GR);
  // Kanneluren an den Turmstufen (V33: an der Terrasse auf 250 m enden sie bündig, sonst stünden sie im neuen Boden)
  for (const [w, y0, y1] of [[62, BEL.podium, BEL.s1], [50, BEL.s1, BEL.s2], [28, BEL.s3, BEL.s4]]) {
    const step = w > 40 ? 5 : 4;
    for (let k = -w / 2 + step; k < w / 2; k += step) for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      if (Math.abs(Math.abs(k) - w / 2) < 1) continue;
      if (w === 50 && ((oz === 1 && Math.abs(k) < 16.5) || (ox && Math.abs(k) < 9.5))) continue;   // V33: dort hängen die neuen Terrassen-Auskragungen
      // V34: an der Nordseite umschloss die mittlere Kannelur die goldene Lichtleiste (gleich breit, gleiche Seitenflächen): 53 m Flackern
      if (w === 50 && Math.abs(k) < 1) continue;
      addSeg({ x: ox ? ox * (w / 2 + 0.3) : k, z: oz ? oz * (w / 2 + 0.3) : k, w: ox ? 0.6 : 1.2, d: oz ? 0.6 : 1.2, y0, y1: y1 + (y1 === BEL.s2 ? 0 : 2), tint: cream, seed: 546, style: 0, dens: 0, flood: 0.5, rib: GD }, false);
    }
  }
  shafts.push({ x: 0, z: 0, y: BEL.s5, h: 900, w: 24, c: [1.0, 0.78, 0.4] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) shafts.push({ x: sx * 31, z: sz * 31, y: BEL.s1 + 12, h: 420, w: 7, c: [1.0, 0.8, 0.45] });
  // Eckpfeiler (Hochzeitstorten-Silhouette)
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    addSeg({ x: sx * 31, z: sz * 31, w: 8, d: 8, y0: BEL.podium, y1: BEL.s1 + 12, tint: cream, seed: 510, style: 1, dens: 0.3, flood: 1 });
    addNeon(sx * 31, BEL.s1 + 12.2, sz * 31, 8.4, 0.35, 8.4, NEON.gold);
    addSeg({ x: sx * 25, z: sz * 25, w: 6, d: 6, y0: BEL.s1, y1: BEL.s2 + 10, tint: cream, seed: 511, style: 1, dens: 0.3, flood: 1 });
    addNeon(sx * 25, BEL.s2 + 10.2, sz * 25, 6.4, 0.35, 6.4, NEON.gold);
    addNeon(sx * 20, BEL.s3 + 0.2, sz * 20, 1.2, 0.4, 1.2, NEON.pearl);
    addNeon(sx * 50, 12, sz * 50, 0.4, 24, 0.4, NEON.gold);
  }
  // Mittelrippen mit goldenen Lichtbändern
  for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const fx = ox * 32.2, fz = oz * 32.2;
    addSeg({ x: fx, z: fz, w: ox ? 2.6 : 6, d: oz ? 2.6 : 6, y0: BEL.podium, y1: BEL.s1 + 16, tint: cream, seed: 520, style: 0, dens: 0, flood: 1 });
    for (const k of [-1.6, 0, 1.6]) addNeon(fx + ox * 1.35 + (oz ? k : 0), (BEL.podium + BEL.s1 + 16) / 2, fz + oz * 1.35 + (ox ? k : 0), ox ? 0.15 : 0.35, BEL.s1 + 16 - BEL.podium, oz ? 0.15 : 0.35, NEON.gold);
    addNeon(ox * 25.2, (BEL.s1 + BEL.s2 - 6.6) / 2, oz * 25.2, ox ? 0.2 : 1.2, BEL.s2 - BEL.s1 - 6.6, oz ? 0.2 : 1.2, NEON.gold);   // V33: endet unter den Konsolen der Terrasse
    addNeon(ox * 14.2, (BEL.s3 + BEL.s4) / 2, oz * 14.2, ox ? 0.2 : 0.9, BEL.s4 - BEL.s3, oz ? 0.2 : 0.9, NEON.pearl);
  }
  neonFrame(0, BEL.podium, 0, 100, 100, NEON.gold);
  neonFrame(0, BEL.s1, 0, 62, 62, NEON.gold);
  neonFrame(0, BEL.s3, 0, 40, 40, NEON.gold);
  neonFrame(0, BEL.s4, 0, 28, 28, NEON.gold);
  neonFrame(0, BEL.s5, 0, 18, 18, NEON.pearl);
  // V33: Terrasse (Brüstung, Auskragungen, Möbel) baut jetzt src/penthouse.js
  // Turmspitze und Ankermast
  spires.push({ x: 0, z: 0, y0: BEL.s5, h: BEL.spire - BEL.s5, b: 15 });
  addCollider(-4, BEL.s5, -4, 4, BEL.spire - 20, 4);
  const mast = new T.Mesh(new T.CylinderGeometry(0.6, 1.1, BEL.mast - BEL.spire + 6, 10), new T.MeshStandardMaterial({ color: 0xc9a25a, metalness: 0.9, roughness: 0.3, emissive: 0x2a1a06 }));
  mast.position.set(0, BEL.spire - 3 + (BEL.mast - BEL.spire + 6) / 2, 0); scene.add(mast);
  const ring = new T.Mesh(new T.TorusGeometry(2.4, 0.25, 8, 24), new T.MeshBasicMaterial({ color: new T.Color(1.3, 1, 0.55) }));
  ring.rotation.x = Math.PI / 2; ring.position.set(0, BEL.mast - 2, 0); scene.add(ring);
  addGlow(0, BEL.mast + 1, 0, [1.6, 0.2, 0.12], 6, 0, 1);
  addGlow(0, BEL.s5 + 4, 0, NEON.gold, 26);

  // Sonnenstrahl-Fächer an der Krone
  const fan = FAN_TEX;
  const fanMat = new T.MeshBasicMaterial({ map: fan, transparent: true, color: new T.Color(1.4, 1.2, 0.9), depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const fanAt = (y, half, wd) => {
    for (const [ox, oz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const m = new T.Mesh(new T.PlaneGeometry(wd, wd / 2), fanMat);
      m.position.set(ox * (half + 0.3), y + wd / 4, oz * (half + 0.3));   // V33: 30 statt 12 cm vor der Wand (flackerte aus der Ferne)
      m.rotation.y = Math.atan2(ox, oz); scene.add(m);
    }
  };
  fanAt(BEL.s4 + 1.5, 9, 15);
  fanAt(BEL.s3 + 2, 14, 22);
  fanAt(BEL.s1 + 18, 25, 30);

  // Portal: goldene Türen, Vordach, Schriftzug
  // offenes Portal mit Goldrahmen
  addNeon(-8.15, P + 4.5, 50.12, 0.36, 9, 0.3, NEON.gold); addNeon(8.15, P + 4.5, 50.12, 0.36, 9, 0.3, NEON.gold);   // V34: etwas breiter als die Laibung (vorher bündig: Flackern)
  addNeon(0, 9.2, 50.12, 16.6, 0.3, 0.3, NEON.gold);
  addSeg({ x: 0, z: 61, w: 26, d: 14, y0: 11.5, y1: 12.6, tint: [0.5, 0.42, 0.3], seed: 530, style: 0, dens: 0, flood: 1 }, false);
  addNeon(0, 11.4, 68, 26, 0.25, 0.25, NEON.gold);
  // V68: Vordach von unten beleuchtet (Kassetten mit Sonnenfächer, warm), Glühbirnenkante rundum, Lichtfleck auf dem Pflaster
  { const under = canvasTex(512, 276, (g, W, H) => {
      const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.6); gr.addColorStop(0, '#fff0cc'); gr.addColorStop(0.6, '#d9b47a'); gr.addColorStop(1, '#7a5a30');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,80,30,0.85)'; g.lineWidth = 6;
      for (let x = 0; x <= W; x += W / 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y <= H; y += H / 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = '#f6d48a'; g.lineWidth = 10; g.strokeRect(8, 8, W - 16, H - 16);
      g.globalAlpha = 0.55; sunburst(g, W / 2, H / 2, H * 0.42, 32, '#fff6dc', 'rgba(200,150,80,0.2)'); g.globalAlpha = 1;
    });
    const um = new T.Mesh(new T.PlaneGeometry(25.6, 13.6).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ map: under, color: new T.Color(0.95, 0.8, 0.6) }));
    um.position.set(0, 11.47, 61); scene.add(um);
    for (let x = -12.6; x <= 12.61; x += 0.9) addGlow(x, 11.32, 67.9, [1.45, 1.05, 0.55], 0.55);
    for (const sx of [-1, 1]) for (let z = 54.6; z <= 67.5; z += 0.9) addGlow(sx * 12.9, 11.32, z, [1.45, 1.05, 0.55], 0.55);
    for (const sx of [-1, 1]) addNeon(sx * 13, 11.4, 61, 0.25, 0.25, 14, NEON.gold);
    shadeBegin(); lightPool(0, P, 61.5, 13, [1, 0.74, 0.42], 0.2); lightPool(0, P, 61.5, 6, [1, 0.8, 0.5], 0.14); shadeEnd(scene); }
  for (const sx of [-12, 12]) { addSeg({ x: sx, z: 67, w: 1, d: 1, y0: P, y1: 11.5, tint: [0.7, 0.55, 0.3], seed: 531, style: 0, dens: 0, flood: 1 }); }
  for (const sx of [-30, -24, 24, 30]) { addSeg({ x: sx, z: 58, w: 0.3, d: 0.3, y0: 7.2, y1: 24, tint: [0.7, 0.55, 0.3], seed: 532, style: 0, dens: 0, flood: 1 }, false); addGlow(sx, 24.4, 58, [1.3, 0.95, 0.5], 1.2); }
  for (let k = 1; k <= 8; k++) { const f = k / 9, y = BEL.s5 + (BEL.spire - BEL.s5) * f, r = 7.5 * (1 - f); for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) addGlow(sx * r, y, sz * r, [1.2, 0.9, 0.5], 1.1); }
  fanAtSingle(fanMat, 0, 12.8, 54.1, 18);
  const nameTex = canvasTex(1024, 160, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#ffe7b0'; g.shadowColor = '#f0b860'; g.shadowBlur = 22;
    // V65: Schrift auf die Leinwand einpassen (in Limelight war der Schriftzug breiter als 1024 px: vorn fehlte das T, hinten halb)
    let fs = 110; g.font = fs + 'px Limelight, Georgia, serif';
    const tw = g.measureText('THE BELMONT').width; if (tw > W * 0.9) { fs = Math.floor(fs * W * 0.9 / tw); g.font = fs + 'px Limelight, Georgia, serif'; }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('THE BELMONT', W / 2, H / 2 + 6);
  });
  const name = new T.Mesh(new T.PlaneGeometry(44, 6.9), new T.MeshBasicMaterial({ map: nameTex, transparent: true, color: new T.Color(1.4, 1.25, 1), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  name.position.set(0, 26.5, 50.15); scene.add(name);
  const vTex = makeSignTex('BELMONT', '#f6c76a', true);
  const vSign = new T.Mesh(new T.PlaneGeometry(9, 9 * vTex.H / vTex.W), new T.MeshBasicMaterial({ map: vTex.t, color: new T.Color(1.3, 1.25, 1.15), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
  vSign.position.set(0, 120, 33.75);   // V33: lag nur 5 cm vor der Mittelrippe und flackerte aus der Ferne scene.add(vSign);

  // Flutlicht auf den Platz
  for (const [x, z] of [[-40, 70], [40, 70], [0, -70]]) addLight(0xffb066, 0.42, 120, 2, x, 14, z);

  // Brunnen (V27: eigener Baustein in src/fountain.js)
  buildFountain(P);
  for (let a = 0; a < 12; a++) addGlow(Math.cos(a / 12 * Math.PI * 2) * 14, P + 1.2, 95 + Math.sin(a / 12 * Math.PI * 2) * 14, NEON.teal, 1.6);

  // Laternen und Bäume am Platz
  for (let x = -90; x <= 90; x += 20) for (const z of [-126, 126]) lamps.push({ x, z, h: 7 });
  for (let z = -110; z <= 110; z += 20) for (const x of [-92, 92]) lamps.push({ x, z, h: 7 });
  for (let z = 70; z <= 120; z += 12) for (const x of [-70, -56, 56, 70]) trees.push({ x, z, s: 1.1 });
  for (let x = -60; x <= 60; x += 15) for (const z of [-75, -90]) trees.push({ x, z, s: 1 });

  // Grande Promenade: Mittelstreifen mit Bäumen und Doppellaternen
  addCollider(MEDIAN.x0, 0, MEDIAN.z0, MEDIAN.x1, 0.32, MEDIAN.z1);
  const med = new T.Mesh(new T.BoxGeometry(MEDIAN.x1 - MEDIAN.x0, 0.32, MEDIAN.z1 - MEDIAN.z0), new T.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.9 }));
  med.position.set(0, 0.16, (MEDIAN.z0 + MEDIAN.z1) / 2); scene.add(med);
  for (let z = MEDIAN.z0 + 6; z < MEDIAN.z1; z += 13) { trees.push({ x: -4.5, z, s: 0.9 }); trees.push({ x: 4.5, z: z + 6, s: 0.9 }); }
  for (let z = MEDIAN.z0 + 12; z < MEDIAN.z1; z += 26) lamps.push({ x: 0, z, h: 6.5 });
}
/* =====================================================================
   THE BELMONT VON INNEN: Lobby im Süden, großer Ballsaal im Norden
   Lobby: z -4 … 48, 18 m hoch. Ballsaal: z -48 … -6, 31 m hoch, zwei Galerien.
   ===================================================================== */
export const BI = { P: 0.26, G1: 8.0, G2: 16.0, LOBBY_H: 18.26, BALL_H: 31.6 };
/* =====================================================================
   V19 · BELMONT-EINGANG: Bronze-Glas-Wand in der 16 m breiten Südöffnung,
   mittig eine Drehtür (Glastrommel, vier Flügel, dreht sich, wenn jemand kommt),
   seitlich zwei Pendeltüren, die sich selbsttätig öffnen; Sonnenstrahl-Relief,
   roter Läufer, Portiers
   ===================================================================== */
export const BDOOR = { wings: null, spin: 0, speed: 0, leafs: [], carpetOn: true };
export function buildBelmontDoor() {
  const K = kit(), P = BI.P, Z = 49, H = 9.2, bronze = [1, 1, 1];
  const glassP = (w, h, x, y, z, ry = 0) => K.add('glass', new T.PlaneGeometry(w, h).rotateY(ry).translate(x, y, z));
  // Seitliche Glaswände mit Bronzesprossen, Riegel bei 3,3 und 6,6 m, Oberband mit Sonnenstrahlen
  for (const s of [-1, 1]) {
    const xa = s * 3.9, xb = s * 8;
    glassP(4.1, H - P, (xa + xb) / 2, (P + H) / 2, Z);
    for (const x of [3.9, 5.3, 6.7, 8.0]) K.add('gold', Bx(0.12, H - P, 0.3, s * x, (P + H) / 2, Z, 1));
    for (const y of [3.3, 6.6]) K.add('gold', Bx(4.2, 0.12, 0.3, (xa + xb) / 2, y, Z, 1));
    // Pendeltür: Rahmen, Flügel als eigene Gruppe mit Drehpunkt an der Außenkante
    const px = s * 2.4;
    K.add('gold', Bx(0.14, 3.3, 0.3, px, P + 1.65, Z, 1)); K.add('gold', Bx(1.7, 0.16, 0.3, s * 3.15, P + 3.32, Z, 1));
    glassP(1.4, H - 3.5, s * 3.15, (3.5 + H) / 2, Z);
    const leaf = new T.Group(); leaf.position.set(s * 3.85, P, Z);
    const LK = kit();
    LK.add('gold', Bx(0.06, 3.2, 0.1, -s * 0.72, 1.6, 0, 1)); LK.add('gold', Bx(0.06, 3.2, 0.1, -s * 1.4, 1.6, 0, 1));
    for (const y of [0.03, 0.9, 2.2, 3.17]) LK.add('gold', Bx(1.42, 0.06, 0.1, -s * 0.73, y, 0, 1));
    LK.add('gold', Bx(1.42, 0.8, 0.06, -s * 0.73, 0.45, 0, 1), [0.9, 0.9, 0.9]);
    LK.add('glass', new T.PlaneGeometry(1.3, 2.2).translate(-s * 0.73, 1.55, 0));
    LK.add('gold', new T.CylinderGeometry(0.02, 0.02, 0.9, 8).translate(-s * 1.3, 1.3, 0.16)); LK.add('gold', new T.CylinderGeometry(0.02, 0.02, 0.9, 8).translate(-s * 1.3, 1.3, -0.16));
    LK.build(leaf); scene.add(leaf);
    const col = addCollider(Math.min(px, s * 3.9) - 0.02, P, Z - 0.15, Math.max(px, s * 3.9) + 0.02, P + 3.3, Z + 0.15);
    BDOOR.leafs.push({ g: leaf, s, col, open: 0, cx: s * 3.15 });
  }
  // Oberband über der ganzen Breite: Bronzeplatte mit Sonnenstrahlen und Belmont-Fächer
  K.add('gold', Bx(16, 0.6, 0.34, 0, H - 0.3, Z, 1), [0.8, 0.8, 0.8]);
  for (let k = -7; k <= 7; k++) { const a = k / 7 * 1.1; K.add('gold', Bx(0.05, 3.6, 0.08, 0, 1.8, 0, 1).rotateZ(-a).translate(0, 4.9, Z + 0.2)); }
  for (const s of [-1, 1]) for (let k = 1; k <= 5; k++) { const a = k / 5 * 1.1; K.add('gold', Bx(0.04, 1.6, 0.06, 0, 0.8, 0, 1).rotateZ(-s * a).translate(s * 5.9, H - 1.6, Z - 0.19)); }
  // Drehtür: Trommel (zwei Viertelbögen aus Glas mit Bronzering oben und unten), Haube, vier Flügel
  const R0 = 2.0;
  for (const s of [-1, 1]) {
    const a0 = s > 0 ? -Math.PI / 4 : Math.PI * 0.75;
    const arc = new T.CylinderGeometry(R0, R0, 3.3, 24, 1, true, a0 + 0.0, Math.PI / 2).translate(0, P + 1.65, Z);
    K.add('glass', arc);
    for (const y of [P + 0.1, P + 3.25]) K.add('gold', new T.TorusGeometry(R0, 0.08, 8, 28, Math.PI / 2).rotateX(Math.PI / 2).rotateY(-a0 - Math.PI / 2 + Math.PI / 2).translate(0, y, Z));
    for (let k = 0; k <= 4; k++) { const a = a0 + k * Math.PI / 8; const x = Math.sin(a) * R0, z = Math.cos(a) * R0; K.add('gold', Bx(0.07, 3.3, 0.07, x, P + 1.65, Z + z, 1)); addCollider(x - 0.25, P, Z + z - 0.25, x + 0.25, P + 3.3, Z + z + 0.25); }
  }
  K.add('gold', new T.CylinderGeometry(R0 + 0.3, R0 + 0.3, 0.3, 32).translate(0, P + 3.45, Z));
  K.add('gold', lathe([[R0 + 0.3, 0], [R0 + 0.1, 0.5], [1.2, 0.9], [0, 1.1]], 32).translate(0, P + 3.6, Z), [0.85, 0.85, 0.85]);
  glassP(4.8, H - 4.8, 0, (4.7 + H) / 2, Z);
  for (const x of [-2.4, -0.8, 0.8, 2.4]) K.add('gold', Bx(0.1, H - 4.7, 0.3, x, (4.7 + H) / 2, Z, 1));
  K.add('gold', Bx(4.9, 0.12, 0.3, 0, 6.6, Z, 1));
  // Flügel
  const wings = new T.Group(); wings.position.set(0, P, Z);
  const WK = kit();
  WK.add('gold', new T.CylinderGeometry(0.1, 0.1, 3.25, 10).translate(0, 1.62, 0));
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    const g = (geo) => geo.rotateY(a);
    WK.add('gold', g(Bx(R0 - 0.12, 0.06, 0.08, (R0 - 0.1) / 2, 0.06, 0, 1))); WK.add('gold', g(Bx(R0 - 0.12, 0.06, 0.08, (R0 - 0.1) / 2, 3.2, 0, 1)));
    WK.add('gold', g(Bx(0.06, 3.2, 0.08, R0 - 0.12, 1.6, 0, 1)));
    WK.add('gold', g(Bx(R0 - 0.12, 0.05, 0.08, (R0 - 0.1) / 2, 1.0, 0, 1)));
    WK.add('glass', g(new T.PlaneGeometry(R0 - 0.2, 3.1).rotateY(Math.PI / 2).translate((R0 - 0.1) / 2, 1.6, 0)));
    WK.add('gold', g(new T.CylinderGeometry(0.018, 0.018, 0.8, 8).translate(R0 - 0.5, 1.2, 0.07))); WK.add('gold', g(new T.CylinderGeometry(0.018, 0.018, 0.8, 8).translate(R0 - 0.5, 1.2, -0.07)));
  }
  WK.build(wings); scene.add(wings); BDOOR.wings = wings;
  // Boden: Bronzeschwelle, roter Läufer vom Platz bis in die Lobby, Messingpfosten mit Kordel
  K.add('gold', Bx(16, 0.03, 0.5, 0, P + 0.015, Z, 1), [0.7, 0.7, 0.7]);
  K.add('cloth', Bx(2.6, 0.02, 14, 0, P + 0.012, Z + 3.5, 3), [0.5, 0.06, 0.08]);
  K.add('cloth', Bx(2.6, 0.02, 7, 0, P + 0.012, Z - 5.5, 3), [0.5, 0.06, 0.08]);
  for (const s of [-1, 1]) for (let z = Z + 2.2; z < Z + 11; z += 2.2) { K.add('gold', new T.CylinderGeometry(0.035, 0.05, 0.95, 8).translate(s * 1.65, P + 0.48, z)); K.add('gold', new T.SphereGeometry(0.06, 8, 6).translate(s * 1.65, P + 0.98, z)); if (z + 2.2 < Z + 11) K.add('rope', new T.CylinderGeometry(0.02, 0.02, 2.1, 5).rotateX(Math.PI / 2).translate(s * 1.65, P + 0.86, z + 1.1), [0.5, 0.08, 0.1]); }
  K.build(scene);
  // Licht über der Drehtür, Portiers an der Tür
  addGlow(0, P + 4.9, Z + 0.5, [1.4, 1.0, 0.6], 2.2); addGlow(0, P + 2.6, Z + 2.4, [1.3, 0.9, 0.5], 1.4);
  addLight(0xffc080, 2.0, 14, 1.5, 0, P + 4.0, Z + 2);
  DOORS.push({ x: 0, z: Z + 2.6, nx: 0, nz: 1, kind: 'hotel' });
  addCollider(-8, P, Z - 0.15, -3.9, H, Z + 0.15); addCollider(3.9, P, Z - 0.15, 8, H, Z + 0.15);
  addCollider(-2.4, P + 3.3, Z - 0.15, 2.4, H, Z + 0.15);
}
export function updateBelmontDoor(dt) {
  const c = camera.position;
  if (BALL_DECO.g) BALL_DECO.g.visible = Math.abs(c.x) < 70 && Math.abs(c.z) < 75 && c.y < 45;
  // durch das offene Portal sieht man die Lobby auch vom Platz und von der Allee aus
  if (BEL_IN.g) BEL_IN.g.visible = c.y < 120 && Math.hypot(c.x, c.z) < 420;
  if (!BDOOR.wings) return;
  const p = player.p, d = Math.hypot(p.x, p.z - 49);
  // Drehtür dreht, wenn jemand näher als 7 m ist, langsam auslaufend
  const want = d < 7 ? 1.1 : 0;
  BDOOR.speed += (want - BDOOR.speed) * Math.min(1, dt * 1.5);
  BDOOR.spin += BDOOR.speed * dt; BDOOR.wings.rotation.y = BDOOR.spin;
  // Pendeltüren öffnen sich nach innen, wenn der Spieler nahe ist
  for (const L of BDOOR.leafs) {
    const near = Math.abs(p.x - L.cx) < 2.6 && Math.abs(p.z - 49) < 4.5 && p.y < 5;
    L.open += ((near ? 1 : 0) - L.open) * Math.min(1, dt * 2.2);
    L.g.rotation.y = L.s * -1.45 * L.open;
    L.col.y1 = L.open > 0.35 ? L.col.y0 : BI.P + 3.3;
  }
}

export const inBelmont = (x, z, y) => Math.abs(x) < 48 && Math.abs(z) < 48 && y < 32;
export let interiorCrowd = null;
export const dancers = [], swayers = [], walkersIn = [];
export const BALLROOM_F = { cx: 0, cz: -28, rx: 13, rz: 7.2 };
export function marbleTex(base, vein, seed, n = 60) {
  return canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(seed);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(255,255,255,${0.015 * rr()})`; g.beginPath(); g.arc(rr() * W, rr() * H, 6 + rr() * 30, 0, 7); g.fill(); }
    g.strokeStyle = vein; g.lineCap = 'round';
    for (let k = 0; k < n; k++) {
      g.globalAlpha = 0.08 + 0.3 * rr(); g.lineWidth = 0.5 + rr() * 1.8;
      let x = rr() * W, y = rr() * H; g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 8; j++) { x += (rr() - 0.3) * 70; y += (rr() - 0.5) * 50; g.lineTo(x, y); }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}
export function sunburst(g, cx, cy, r, rays, gold, dark) {
  for (let i = 0; i < rays; i++) {
    const a0 = i / rays * Math.PI * 2, a1 = (i + 1) / rays * Math.PI * 2;
    g.fillStyle = i % 2 ? gold : dark;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath(); g.fill();
  }
  g.strokeStyle = gold; g.lineWidth = r * 0.025;
  for (const k of [0.18, 0.55, 1]) { g.beginPath(); g.arc(cx, cy, r * k, 0, 7); g.stroke(); }
  g.fillStyle = gold; g.beginPath(); g.arc(cx, cy, r * 0.12, 0, 7); g.fill();
}
// Box mit UV in Metern, damit Marmor und Kacheln überall gleich groß bleiben
export function boxW(w, h, d, x, y, z, s = 4) {
  const g = new T.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); }
  return g.translate(x, y, z);
}
export function buildBelmontInterior() {
  const { P, G1, G2, LOBBY_H, BALL_H } = BI;
  const batch = {};
  const put = (k, g) => (batch[k] ||= []).push(g);
  // V34: Lobby und Ballsaal in einer eigenen Gruppe, die nur in der Nähe des Belmont gezeichnet wird (vorher immer, aus der ganzen Stadt,
  // im Hauptbild und im Spiegelbild des Pflasters). Die zusammengefassten Netze werden außerdem wieder nach Sichtfeld aussortiert.
  const IG = new T.Group(); BEL_IN.g = IG; scene.add(IG);
  movOn();   // V52: Sofas, Sessel und Stühle der Lobby und des Ballsaals sind mit Telekinese greifbar
  shadeBegin();   // V67: Kontaktschatten der Möbel und Raumschatten sammeln (raumlicht.js)
  const col = addCollider;
  const glow = (x, y, z, c, s) => addGlow(x, y, z, c, s);

  // ---------- Materialien ----------
  // V51: Wände in hellem Champagner-Marmor statt fast schwarzem Petrol (Lobby und Ballsaal wirkten finster)
  const wallT = marbleTex('#b8a685', '#6e5a3a', 11); wallT.wrapS = wallT.wrapT = T.RepeatWrapping;
  const darkT = marbleTex('#08080a', '#9a8a70', 12, 40); darkT.wrapS = darkT.wrapT = T.RepeatWrapping;
  const M = {
    // V21: Fototexturen (ambientCG Marble006 / Metal007, CC0) kommen per applyTextures, bis dahin die gezeichneten
    wall: stdMat({ map: wallT, color: 0xf0e6d8, roughness: 0.2, metalness: 0.05, envI: 0.7 }),
    // V21: schwarzer Marmor und Gold als Fototexturen (ambientCG Marble006 / Metal007, CC0) per applyTextures, bis dahin die gezeichneten
    dark: wantTexture(stdMat({ map: darkT, color: 0xffffff, roughness: 0.12, metalness: 0.05, envI: 0.8 }), { map: 'marble-color', normalMap: 'marble-normal', roughnessMap: 'marble-rough', repeat: [2, 2], normalScale: 0.5, roughness: 0.45, color: 0xfff4e4 }),
    gold: wantTexture(MAT.gold.clone(), { map: 'gold-color', normalMap: 'gold-normal', roughnessMap: 'gold-rough', repeat: [3, 3], normalScale: 0.35, roughness: 0.9, color: 0xf2d79a }), brass: MAT.brass, chrome: MAT.chrome, piano: MAT.black,
    wood: stdMat({ color: 0x3b1d10, roughness: 0.35, metalness: 0.05, envI: 0.5 }),
    velvet: stdMat({ color: 0x0c3d40, roughness: 0.95, envI: 0.1 }),
    velvetBlue: stdMat({ color: 0x0f1d3a, roughness: 0.95, envI: 0.1 }),
    linen: stdMat({ color: 0xeee6d6, roughness: 0.8, envI: 0.2, emissive: 0x16110a }),
    leaf: stdMat({ color: 0x1d4a2c, roughness: 0.7, envI: 0.2, side: T.DoubleSide }),
    trunk: stdMat({ color: 0x3a2a1a, roughness: 0.9, env: false }),
    lamp: new T.MeshBasicMaterial({ color: new T.Color(1.45, 1.1, 0.68) }),
    crystal: new T.MeshBasicMaterial({ color: new T.Color(1.25, 1.18, 1.05) }),
    bottles: new T.MeshBasicMaterial({ color: new T.Color(0.9, 0.55, 0.22) }),
    drumhead: stdMat({ color: 0xe8e0d0, roughness: 0.6, envI: 0.2 }),
    runner: stdMat({ map: RUNNER_TEX(), color: 0xffffff, roughness: 0.95, envI: 0.1 }),
    bass: stdMat({ color: 0x5a2a12, roughness: 0.3, envI: 0.6 }),
  };
  addSheen(M.velvet, 0.55); addSheen(M.velvetBlue, 0.55);   // V70: Samtschein

  // ---------- Böden ----------
  const lobbyFloor = canvasTex(2048, 1110, (g, W, H) => {
    const X = x => (x + 48) / 96 * W, Z = z => (z + 4) / 52 * H, S = W / 96;
    g.drawImage(darkT.image, 0, 0, W / 2, W / 2); g.drawImage(darkT.image, W / 2, 0, W / 2, W / 2); g.drawImage(darkT.image, 0, W / 2, W / 2, W / 2); g.drawImage(darkT.image, W / 2, W / 2, W / 2, W / 2);
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2;
    for (let x = -48; x <= 48; x += 4) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke(); }
    for (let z = -4; z <= 48; z += 4) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(W, Z(z)); g.stroke(); }
    g.strokeStyle = '#c9a050'; g.lineWidth = 5;
    g.strokeRect(X(-46), Z(-2), 92 * S, 48 * S); g.lineWidth = 2; g.strokeRect(X(-45), Z(-1), 90 * S, 46 * S);
    // Diagonalraster in Gold
    g.lineWidth = 1.5; g.globalAlpha = 0.55;
    for (let k = -100; k <= 100; k += 8) { g.beginPath(); g.moveTo(X(k - 30), Z(-1)); g.lineTo(X(k + 16), Z(45)); g.stroke(); g.beginPath(); g.moveTo(X(k + 30), Z(-1)); g.lineTo(X(k - 16), Z(45)); g.stroke(); }
    g.globalAlpha = 1;
    // Teppichläufer vom Portal zum Ballsaal
    g.fillStyle = '#071a1c'; g.fillRect(X(-3.5), Z(-4), 7 * S, 52 * S);
    g.strokeStyle = '#7a6030'; g.lineWidth = 4; g.strokeRect(X(-3.2), Z(-4), 6.4 * S, 52 * S);
    g.lineWidth = 2; for (let z = 0; z < 48; z += 3) { g.beginPath(); g.moveTo(X(-2), Z(z)); g.lineTo(X(0), Z(z + 1.5)); g.lineTo(X(2), Z(z)); g.stroke(); }
    sunburst(g, X(0), Z(22), 10 * S, 48, '#c9a050', '#0a0a0c');
  });
  lobbyFloor.anisotropy = ANISO;
  // V67: Rauheit 0,26 bis 0,4 mit Adern statt glatt 0,12 (die Punktlichter warfen grelle weiße Flecken auf den schwarzen Boden)
  const lobbyRough = roughTex(512, 278, { base: 0.33, vari: 0.07, seed: 21, rects: [[44.5 / 96, 0, 51.5 / 96, 1, 0.94]] });
  const fl = new T.Mesh(new T.PlaneGeometry(96, 52), stdMat({ map: lobbyFloor, roughnessMap: lobbyRough, roughness: 1, metalness: 0.1, envI: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, P + 0.01, 22); IG.add(fl);
  const ballFloor = canvasTex(2048, 896, (g, W, H) => {
    const X = x => (x + 48) / 96 * W, Z = z => (z + 48) / 42 * H, S = W / 96;
    for (let i = 0; i < 4; i++) g.drawImage(darkT.image, i * W / 4, 0, W / 4, W / 4), g.drawImage(darkT.image, i * W / 4, W / 4, W / 4, W / 4);
    g.strokeStyle = '#c9a050'; g.lineWidth = 3;
    for (let x = -42; x <= 42; x += 6) { g.beginPath(); g.moveTo(X(x), Z(-47)); g.lineTo(X(x), Z(-7)); g.globalAlpha = 0.35; g.stroke(); }
    g.globalAlpha = 1;
    // Tanzfläche: Fischgrät-Parkett, Goldrand, Sonnenstrahl
    const rr = mulberry32(8);
    for (let x = -18; x < 18; x += 0.9) for (let z = -37; z < -19; z += 0.45) {
      const v = 0.75 + rr() * 0.4, alt = (Math.floor(x / 0.9) + Math.floor(z / 0.45)) % 2;
      g.fillStyle = `rgb(${Math.round((alt ? 62 : 46) * v)},${Math.round((alt ? 34 : 25) * v)},${Math.round(15 * v)})`;
      g.fillRect(X(x) + 1, Z(z) + 1, 0.9 * S - 2, 0.45 * S - 2);
    }
    g.strokeStyle = '#d8b060'; g.lineWidth = 8; g.strokeRect(X(-18), Z(-37), 36 * S, 18 * S);
    g.globalAlpha = 0.45; sunburst(g, X(0), Z(-28), 7 * S, 32, '#b08840', 'rgba(40,20,8,0.0)'); g.globalAlpha = 1;
  });
  ballFloor.anisotropy = ANISO;
  // V23: Tanzfläche aus echtem Parkett (ambientCG WoodFloor043, CC0), sobald das Foto geladen ist:
  // Streifen von 1,8 m, abwechselnd um ±45° gedreht (Fischgrät), warm abgedunkelt, darüber Goldrand und Sonnenstrahl
  wantTexture(new T.MeshBasicMaterial(), { map: 'parquet-color', then: m => {
    const img = m.map.image, g = ballFloor.image.getContext('2d'), W = 2048, H = 896, S = W / 96, X = x => (x + 48) / 96 * W, Z = z => (z + 48) / 42 * H, tile = 2.4 * S;
    g.save(); g.beginPath(); g.rect(X(-18), Z(-37), 36 * S, 18 * S); g.clip();
    for (let col = 0; col < 20; col++) {
      const x0 = X(-18) + col * 1.8 * S;
      g.save(); g.beginPath(); g.rect(x0, Z(-37), 1.8 * S, 18 * S); g.clip();
      g.translate(x0 + 0.9 * S, Z(-28)); g.rotate(col % 2 ? Math.PI / 4 : -Math.PI / 4);
      for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) g.drawImage(img, i * tile, j * tile, tile, tile);
      g.restore();
      g.fillStyle = 'rgba(20,10,4,0.5)'; g.fillRect(x0, Z(-37), 1.5, 18 * S);
    }
    g.fillStyle = 'rgba(40,18,6,0.38)'; g.fillRect(X(-18), Z(-37), 36 * S, 18 * S);
    g.globalAlpha = 0.45; sunburst(g, X(0), Z(-28), 7 * S, 32, '#b08840', 'rgba(40,20,8,0.0)'); g.globalAlpha = 1;
    g.restore();
    g.strokeStyle = '#d8b060'; g.lineWidth = 8; g.strokeRect(X(-18), Z(-37), 36 * S, 18 * S);
    ballFloor.needsUpdate = true;
  } });
  const ballRough = roughTex(512, 224, { base: 0.34, vari: 0.07, seed: 22, rects: [[30 / 96, 11 / 42, 66 / 96, 29 / 42, 0.46]] });
  const bf = new T.Mesh(new T.PlaneGeometry(96, 42), stdMat({ map: ballFloor, roughnessMap: ballRough, roughness: 1, metalness: 0.08, envI: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  bf.rotation.x = -Math.PI / 2; bf.position.set(0, P + 0.01, -27); IG.add(bf);

  // ---------- Kassettendecken ----------
  const coffer = canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#0d0b0a'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.42); gr.addColorStop(0, '#6a4a22'); gr.addColorStop(1, '#14100c');
    g.fillStyle = gr; g.fillRect(40, 40, W - 80, H - 80);
    g.strokeStyle = '#d4a85a'; g.lineWidth = 10; g.strokeRect(20, 20, W - 40, H - 40);
    g.lineWidth = 3; g.strokeRect(50, 50, W - 100, H - 100);
    g.save(); g.translate(W / 2, H / 2); g.globalAlpha = 0.8; sunburst(g, 0, 0, 110, 24, '#d4a85a', '#2a1c0c'); g.restore();
  });
  coffer.wrapS = coffer.wrapT = T.RepeatWrapping;
  const ceilMat = (rx, ry) => { const t = coffer.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return stdMat({ map: t, emissiveMap: t, emissive: 0x6a5030, roughness: 0.5, metalness: 0.4, envI: 0.6 }); };
  const c1 = new T.Mesh(new T.PlaneGeometry(96, 52), ceilMat(12, 6.5)); c1.rotation.x = Math.PI / 2; c1.position.set(0, LOBBY_H, 22); IG.add(c1);
  const c2 = new T.Mesh(new T.PlaneGeometry(96, 42), ceilMat(12, 5.25)); c2.rotation.x = Math.PI / 2; c2.position.set(0, BALL_H, -27); IG.add(c2);
  col(-48, LOBBY_H, -4, 48, LOBBY_H + 1, 48);

  // ---------- Wände: Marmorverkleidung, Goldlinien, Trennwand mit Ballsaaltor ----------
  const lining = (x0, x1, y0, y1, z0, z1) => put('wall', boxW(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 5));
  lining(-48, -47.9, 0, LOBBY_H, -4, 48); lining(47.9, 48, 0, LOBBY_H, -4, 48);
  lining(-48, -8, 0, LOBBY_H, 47.9, 48); lining(8, 48, 0, LOBBY_H, 47.9, 48); lining(-8, 8, 9.2, LOBBY_H, 47.9, 48);
  lining(-48, -47.9, 0, BALL_H, -48, -6); lining(47.9, 48, 0, BALL_H, -48, -6); lining(-48, 48, 0, BALL_H, -48, -47.9);
  // Trennwand
  lining(-48, -9, 0, BALL_H, -6, -4); lining(9, 48, 0, BALL_H, -6, -4); lining(-9, 9, 7.2, BALL_H, -6, -4);
  col(-48, 0, -6, -9, 32, -4); col(9, 0, -6, 48, 32, -4); col(-9, 7.2, -6, 9, 32, -4);
  for (const zz of [-3.9, -6.1]) {
    put('gold', new T.BoxGeometry(0.4, 7.2, 0.15).translate(-9.2, 3.6 + P, zz)); put('gold', new T.BoxGeometry(0.4, 7.2, 0.15).translate(9.2, 3.6 + P, zz));
    put('gold', new T.BoxGeometry(18.8, 0.4, 0.15).translate(0, 7.3, zz));
  }
  const bsign = makeSignTex('GRAND BALLROOM', '#f6c76a', false);
  const bs = new T.Mesh(new T.PlaneGeometry(12, 12 * bsign.H / bsign.W), new T.MeshBasicMaterial({ map: bsign.t, color: new T.Color(1.2, 1.15, 1.05) }));
  bs.position.set(0, 9.6, -3.85); IG.add(bs);
  const fanM = new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(1.08, 0.9, 0.64), depthWrite: false, side: T.DoubleSide });
  // V64: alle Sonnenfächer der Halle in einem Netz (vorher 28 einzelne, je ein Zeichenaufruf)
  const fanGeos = [];
  const fanPlane = (x, y, z, w, ry) => { fanGeos.push(new T.PlaneGeometry(w, w / 2).rotateY(ry).translate(x, y + w / 4, z)); };
  fanPlane(0, 11.2, -3.88, 10, 0);
  // Goldlinien und Pilaster
  for (let z = 0; z <= 46; z += 4) for (const sx of [-1, 1]) {
    put('gold', new T.BoxGeometry(0.12, LOBBY_H, 0.18).translate(sx * 47.85, LOBBY_H / 2, z));
    if (z % 8 === 4) { glow(sx * 47.4, 6.5, z, [1.3, 0.92, 0.55], 2.4); fanPlane(sx * 47.8, 5.8, z, 2.2, -sx * Math.PI / 2); }
  }
  for (let x = -44; x <= 44; x += 4) if (Math.abs(x) > 9) put('gold', new T.BoxGeometry(0.18, LOBBY_H, 0.12).translate(x, LOBBY_H / 2, 47.85));
  for (let z = -46; z <= -8; z += 6) for (const sx of [-1, 1]) put('gold', new T.BoxGeometry(0.16, BALL_H, 0.22).translate(sx * 47.85, BALL_H / 2, z));
  for (let x = -45; x <= 45; x += 6) put('gold', new T.BoxGeometry(0.22, BALL_H, 0.16).translate(x, BALL_H / 2, -47.85));
  // Fächerreliefs oben im Ballsaal
  for (let z = -43; z <= -11; z += 8) for (const sx of [-1, 1]) fanPlane(sx * 47.8, 22.5, z, 6, -sx * Math.PI / 2);
  // Gesimse
  for (const [y, zc, dz] of [[LOBBY_H - 0.3, 22, 52], [BALL_H - 0.3, -27, 42], [G2 + 4.5, -27, 42]]) {
    put('gold', new T.BoxGeometry(95.6, 0.3, 0.4).translate(0, y, zc - dz / 2 + 0.3 + (zc > 0 ? 0 : 0)));
    for (const sx of [-1, 1]) put('gold', new T.BoxGeometry(0.4, 0.3, dz).translate(sx * 47.7, y, zc));
  }

  // ---------- Lobby ----------
  // Säulenreihen aus schwarzem Marmor mit Goldkapitellen
  for (const sx of [-1, 1]) for (const z of [4, 16, 28, 40]) {
    const x = sx * 27;
    put('dark', new T.CylinderGeometry(0.85, 0.85, LOBBY_H - 2.2, 20).translate(x, P + (LOBBY_H - 2.2) / 2, z));
    put('gold', new T.CylinderGeometry(1.25, 0.9, 1.4, 20).translate(x, LOBBY_H - 1.6, z));
    put('gold', new T.BoxGeometry(2.8, 0.5, 2.8).translate(x, LOBBY_H - 0.6, z));
    put('gold', new T.CylinderGeometry(1.1, 1.2, 0.6, 20).translate(x, P + 0.3, z));
    for (let k = 0; k < 3; k++) put('gold', new T.TorusGeometry(0.87, 0.05, 6, 24).rotateX(Math.PI / 2).translate(x, 4 + k * 0.35, z));
    col(x - 0.9, 0, z - 0.9, x + 0.9, LOBBY_H, z + 0.9);
  }
  // Rezeption im Westen, mit Schlüsselwand und Uhr
  put('wood', boxW(3, 1.15, 22, -39, P + 0.575, 22, 2)); put('gold', new T.BoxGeometry(3.3, 0.08, 22.3).translate(-39, P + 1.2, 22));
  for (let z = 12; z <= 32; z += 2.5) put('gold', new T.BoxGeometry(0.05, 1.0, 0.12).translate(-37.47, P + 0.6, z));
  put('dark', boxW(0.3, 4.5, 24, -47.6, P + 3.6, 22, 3));
  for (let z = 11; z <= 33; z += 1.1) for (let y = 2.2; y <= 5; y += 0.7) put('brass', new T.BoxGeometry(0.06, 0.5, 0.8).translate(-47.42, P + y, z));
  const clock = new T.Mesh(new T.CircleGeometry(1.4, 40), M.lamp); clock.position.set(-47.4, 9.5, 22); clock.rotation.y = Math.PI / 2; IG.add(clock);
  put('gold', new T.TorusGeometry(1.45, 0.12, 8, 40).rotateY(Math.PI / 2).translate(-47.38, 9.5, 22));
  col(-40.5, 0, 11, -37.5, 1.2, 33);
  const desk = makeSignTex('RECEPTION', '#f6c76a', false);
  const ds = new T.Mesh(new T.PlaneGeometry(6, 6 * desk.H / desk.W), new T.MeshBasicMaterial({ map: desk.t, color: new T.Color(1.2, 1.15, 1.05) }));
  ds.position.set(-47.3, 7.2, 22); ds.rotation.y = Math.PI / 2; IG.add(ds);
  for (let z = 14; z <= 30; z += 8) { put('brass', new T.CylinderGeometry(0.05, 0.12, 0.6, 8).translate(-39, P + 1.5, z)); put('lamp', new T.CylinderGeometry(0.18, 0.32, 0.3, 12).translate(-39, P + 1.9, z)); glow(-39, P + 1.9, z, [1.3, 0.9, 0.5], 1.5); }
  // Fahrstühle im Osten
  for (const z of [12, 22, 32]) {
    put('gold', new T.BoxGeometry(0.15, 5.2, 3.4).translate(47.8, P + 2.6, z));
    put('dark', new T.BoxGeometry(0.2, 5.8, 4.2).translate(47.88, P + 2.9, z));
    put('chrome', new T.BoxGeometry(0.16, 5.2, 0.04).translate(47.75, P + 2.6, z));
    fanPlane(47.62, P + 5.9, z, 4, -Math.PI / 2);
    glow(47.5, P + 8.4, z, [1.4, 0.95, 0.5], 1.4);
  }
  // Sitzgruppen aus Samt, Palmen in Messingkübeln
  const BM = mk => ({ up: mk, frame: 'gold', wood: 'piano', lamp: 'lamp', cloth: 'linen', leaf: 'leaf' }), badd = (k, g) => put(k, g);
  const sofa = (x, z, ry, mk = 'velvet') => placeFurn(FURN.sofa(3.6), BM(mk), badd, x, P, z, ry);
  const chair = (x, z, ry, mk = 'velvet') => placeFurn(FURN.clubChair(), BM(mk), badd, x, P, z, ry);
  const palm = (x, z, h = 3.2, s = 1) => {
    put('brass', new T.CylinderGeometry(0.55 * s, 0.4 * s, 0.9 * s, 16).translate(x, P + 0.45 * s, z));
    put('trunk', new T.CylinderGeometry(0.08 * s, 0.14 * s, h, 6).translate(x, P + 0.9 * s + h / 2, z));
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + x;
      put('leaf', new T.PlaneGeometry(0.5 * s, 2.0 * s).translate(0, 1.0 * s, 0).rotateX(-0.9 - (k % 3) * 0.2).rotateY(a).translate(x, P + 0.9 * s + h, z));
    }
    col(x - 0.55 * s, 0, z - 0.55 * s, x + 0.55 * s, 1.2, z + 0.55 * s);
  };
  for (const sx of [-1, 1]) for (const z0 of [10, 34]) {
    const x0 = sx * 16;
    put('dark', new T.CylinderGeometry(1.0, 1.0, 0.45, 24).translate(x0, P + 0.23, z0)); put('gold', new T.TorusGeometry(1.0, 0.05, 6, 32).rotateX(Math.PI / 2).translate(x0, P + 0.46, z0));
    sofa(x0, z0 - 2.4, 0); sofa(x0, z0 + 2.4, Math.PI, sx < 0 ? 'velvetBlue' : 'velvet'); chair(x0 - 3, z0, Math.PI / 2); chair(x0 + 3, z0, -Math.PI / 2);
    col(x0 - 3.6, 0, z0 - 3, x0 + 3.6, 0.9, z0 + 3);
    palm(x0 + sx * 5.5, z0 - 4, 3.6); palm(x0 + sx * 5.5, z0 + 4, 3.0);
    glow(x0, P + 0.75, z0, [1.0, 0.7, 0.35], 0.6);
  }
  // Rundsofa mit großer Palme unter dem Kronleuchter
  put('velvet', new T.CylinderGeometry(4.2, 4.2, 0.5, 40).translate(0, P + 0.25, 22));
  put('velvet', new T.CylinderGeometry(2.6, 2.8, 1.1, 40).translate(0, P + 0.55, 22));
  put('gold', new T.TorusGeometry(4.2, 0.06, 6, 48).rotateX(Math.PI / 2).translate(0, P + 0.5, 22));
  col(-4.2, 0, 17.8, 4.2, 1.1, 26.2);
  palm(0, 22, 4.2, 1.5);
  for (const sx of [-1, 1]) for (const z of [46, -2]) palm(sx * 44, z, 3.4);
  for (const sx of [-1, 1]) { palm(sx * 11, 45.5, 3.2); palm(sx * 11, -2.2, 3.2); }

  // ---------- Kronleuchter und Pendelleuchten ----------
  const chandelier = (x, y, z, r, ceil) => {
    put('gold', new T.CylinderGeometry(0.06, 0.06, ceil - y - 2.4, 6).translate(x, (ceil + y + 2.4) / 2, z));
    const tiers = [[r, 0], [r * 0.72, 1.0], [r * 0.45, 1.9], [r * 0.2, 2.5]];
    for (const [tr, dy] of tiers) {
      put('gold', new T.TorusGeometry(tr, 0.07, 6, 40).rotateX(Math.PI / 2).translate(x, y + dy, z));
      const n = Math.max(8, Math.round(tr * 9));
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, cx = x + Math.cos(a) * tr, cz = z + Math.sin(a) * tr;
        put('crystal', new T.CylinderGeometry(0.035, 0.035, 0.9 + (k % 2) * 0.4, 4).translate(cx, y + dy - 0.5, cz));
        if (k % 2 === 0) glow(cx, y + dy + 0.15, cz, [1.35, 1.1, 0.7], 0.55);
      }
    }
    put('crystal', new T.ConeGeometry(r * 0.25, 1.6, 12).rotateX(Math.PI).translate(x, y - 0.8, z));
    glow(x, y + 0.6, z, [1.2, 0.85, 0.45], r * 4.5);
  };
  chandelier(0, 12.5, 22, 3.2, LOBBY_H);
  const pendant = (x, y, z, ceil) => {
    put('gold', new T.CylinderGeometry(0.04, 0.04, ceil - y, 6).translate(x, (ceil + y) / 2, z));
    for (const [r, h, dy] of [[0.9, 0.7, 0], [0.7, 0.6, 0.7], [0.45, 0.5, 1.3]]) { put('lamp', new T.CylinderGeometry(r, r * 0.92, h, 16).translate(x, y + dy, z)); put('gold', new T.TorusGeometry(r, 0.04, 6, 24).rotateX(Math.PI / 2).translate(x, y + dy + h / 2, z)); }
    glow(x, y + 0.6, z, [1.3, 0.9, 0.5], 9);
  };
  for (const sx of [-1, 1]) for (const z of [6, 38]) pendant(sx * 14, 11, z, LOBBY_H);
  chandelier(0, 21, -28, 4.6, BALL_H); chandelier(-26, 22.5, -28, 3.0, BALL_H); chandelier(26, 22.5, -28, 3.0, BALL_H);

  // ---------- Ballsaal: Galerien, Treppen, Bühne ----------
  const galleries = (y, cols) => {
    const slab = (x0, x1, z0, z1) => { put('dark', boxW(x1 - x0, 0.6, z1 - z0, (x0 + x1) / 2, y - 0.3, (z0 + z1) / 2, 4)); col(x0, y - 0.6, z0, x1, y, z1); put('gold', new T.BoxGeometry(x1 - x0, 0.12, 0.12).translate((x0 + x1) / 2, y - 0.66, z0 > -14 ? z0 : z1)); };
    slab(-48, -41, -48, -13); slab(41, 48, -48, -13);
    // V65: oben zwei Treppenaugen an der Trennwand (Treppen von der ersten Galerie herauf), Podest in der Mitte
    if (cols) slab(-48, 48, -13, -6);
    else { const { x0, x1, z0 } = GAL.stair; slab(-48, -x1, -13, -6); slab(x1, 48, -13, -6); slab(-x0, x0, -13, -6); for (const sx of [-1, 1]) slab(Math.min(sx * x0, sx * x1), Math.max(sx * x0, sx * x1), -13, z0); }
    // Balustraden mit Goldhandlauf und Docken
    const rail = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      put('gold', new T.BoxGeometry(ax ? L : 0.14, 0.1, ax ? 0.14 : L).translate((x0 + x1) / 2, y + 1.05, (z0 + z1) / 2));
      put('gold', new T.BoxGeometry(ax ? L : 0.08, 0.06, ax ? 0.08 : L).translate((x0 + x1) / 2, y + 0.15, (z0 + z1) / 2));
      for (let t = 0; t <= L; t += 0.45) { const k = t / L; put('dark', new T.CylinderGeometry(0.05, 0.07, 0.9, 6).translate(x0 + (x1 - x0) * k, y + 0.6, z0 + (z1 - z0) * k)); }
      col(Math.min(x0, x1) - 0.1, y, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, y + 1.1, Math.max(z0, z1) + 0.1);
    };
    for (const sx of [-1, 1]) rail(sx * 41, -48, sx * 41, -13);
    if (cols) { rail(-41, -13, -39.2, -13); rail(-32.8, -13, 32.8, -13); rail(39.2, -13, 41, -13); }
    else { rail(-41, -13, 41, -13); const { x0, x1, z0 } = GAL.stair; for (const sx of [-1, 1]) { rail(sx * x0, z0, sx * x1, z0); rail(sx * (x1 + 0.1), z0, sx * (x1 + 0.1), -6.1); } }
    for (let k = -40; k <= 40; k += 10) glow(k, y + 1.4, -13, [1.25, 0.88, 0.5], 1.0);
    for (const sx of [-1, 1]) for (let z = -44; z <= -16; z += 7) glow(sx * 41, y + 1.4, z, [1.25, 0.88, 0.5], 1.0);
  };
  galleries(G1, true); galleries(G2, false);
  // Säulen unter den Galerien
  for (const sx of [-1, 1]) for (let z = -46; z <= -13; z += 7) for (const [y0, y1] of [[P, G1 - 0.6], [G1, G2 - 0.6]]) {
    put('dark', new T.CylinderGeometry(0.4, 0.4, y1 - y0 - 0.8, 14).translate(sx * 41.4, y0 + (y1 - y0 - 0.8) / 2, z));
    put('gold', new T.CylinderGeometry(0.75, 0.42, 0.8, 14).translate(sx * 41.4, y1 - 0.4, z));
    if (y0 < 1) col(sx * 41.4 - 0.45, 0, z - 0.45, sx * 41.4 + 0.45, y1, z + 0.45);
  }
  for (let x = -34; x <= 34; x += 8.5) for (const [y0, y1] of [[P, G1 - 0.6], [G1, G2 - 0.6]]) {
    if (Math.abs(x) < 3) continue;
    put('dark', new T.CylinderGeometry(0.4, 0.4, y1 - y0 - 0.8, 14).translate(x, y0 + (y1 - y0 - 0.8) / 2, -13.4));
    put('gold', new T.CylinderGeometry(0.75, 0.42, 0.8, 14).translate(x, y1 - 0.4, -13.4));
    if (y0 < 1) col(x - 0.45, 0, -13.85, x + 0.45, y1, -12.95);
  }
  // Zwei Freitreppen hinauf zur ersten Galerie
  // V33: Geländer auf beiden Seiten, richtig geneigt (vorher fiel der Handlauf nach oben hin ab und stand nur innen),
  // Messingdocken auf jeder Stufe, Antrittspfosten mit Leuchtkugel, Läufer aus Samt auf Stufen und Setzstufen
  const nSteps = 26, rise = (G1 - P) / nSteps, run = 27 / nSteps, ang = Math.atan2(G1 - P, 27), L = Math.hypot(27, G1 - P);
  const railY = z => P + (z + 40) / 27 * (G1 - P) + 0.95;
  for (const sx of [-1, 1]) {
    const x0 = sx > 0 ? 33 : -39, x1 = sx > 0 ? 39 : -33, xm = (x0 + x1) / 2;
    for (let k = 0; k < nSteps; k++) {
      const z0 = -40 + k * run, top = P + (k + 1) * rise;
      put('dark', boxW(6, top, run + 0.02, xm, top / 2, z0 + run / 2, 3));
      put('gold', new T.BoxGeometry(6, 0.04, 0.06).translate(xm, top + 0.01, z0 + 0.03));
      put('runner', boxW(3.4, 0.025, run - 0.04, xm, top + 0.012, z0 + run / 2 + 0.02, 1.2));
      put('runner', boxW(3.4, rise - 0.03, 0.02, xm, top - rise / 2, z0 - 0.012, 1.2));
      for (const ex of [-1.75, 1.75]) put('gold', new T.CylinderGeometry(0.014, 0.014, run, 6).rotateX(Math.PI / 2).translate(xm + ex, top + 0.03, z0 + run / 2));
      col(x0, 0, z0, x1, top, z0 + run);
    }
    for (const rx of [x0 + 0.18, x1 - 0.18]) {
      // Handlauf und Fußleiste parallel zur Stufenlinie
      put('gold', new T.BoxGeometry(0.13, 0.09, L).rotateX(-ang).translate(rx, (P + G1) / 2 + 0.95, -26.5));
      put('dark', new T.BoxGeometry(0.22, 0.2, L).rotateX(-ang).translate(rx, (P + G1) / 2 + 0.1 + rise * 0.5, -26.5));
      put('gold', new T.BoxGeometry(0.05, 0.05, L).rotateX(-ang).translate(rx, (P + G1) / 2 + 0.55, -26.5));
      for (let k = 0; k < nSteps; k++) for (const f of [0.25, 0.75]) {
        const z = -40 + (k + f) * run, top = P + (k + 1) * rise, h = railY(z) - top;
        put('gold', new T.CylinderGeometry(0.022, 0.03, h, 6).translate(rx, top + h / 2, z));
      }
      // Antrittspfosten unten (schwarzer Marmor, Goldkugel mit Licht) und oben
      put('dark', boxW(0.36, 1.25, 0.36, rx, P + 0.625, -40.2, 2)); put('gold', new T.BoxGeometry(0.42, 0.08, 0.42).translate(rx, P + 1.29, -40.2));
      put('lamp', new T.SphereGeometry(0.17, 14, 10).translate(rx, P + 1.5, -40.2)); glow(rx, P + 1.5, -40.2, [1.4, 1.0, 0.55], 1.1);
      put('gold', boxW(0.26, 1.1, 0.26, rx, G1 + 0.55, -13.1, 2)); put('gold', new T.SphereGeometry(0.12, 12, 8).translate(rx, G1 + 1.2, -13.1));
      col(rx - 0.12, 0, -40.4, rx + 0.12, G1 + 1.1, -13);
    }
    palm(sx * 36, -42, 3.0);
  }
  // V65: zwei Treppen von der ersten zur zweiten Galerie, an der Trennwand, zur Mitte hin steigend (oben ein gemeinsames Podest)
  {
    const { x0, x1, z0 } = GAL.stair, z1 = -6.05, n = 44, rise = (G2 - G1) / n, run = (x1 - x0) / n, zm = (z0 + z1) / 2, wz = z1 - z0;
    const ang = Math.atan2(G2 - G1, x1 - x0), L = Math.hypot(x1 - x0, G2 - G1), xm = (x0 + x1) / 2, ym = (G1 + G2) / 2;
    for (const sx of [-1, 1]) {
      for (let k = 0; k < n; k++) {
        const xa = x1 - (k + 1) * run, xb = x1 - k * run, top = G1 + (k + 1) * rise, xc = sx * (xa + xb) / 2;
        put('dark', boxW(run + 0.02, top - G1, wz, xc, (G1 + top) / 2, zm, 3));
        put('runner', boxW(run - 0.04, 0.025, 2.0, xc, top + 0.012, zm, 1.2));
        put('gold', new T.BoxGeometry(0.06, 0.04, wz).translate(sx * (xb - 0.03), top + 0.01, zm));
        col(Math.min(sx * xa, sx * xb), G1, z0, Math.max(sx * xa, sx * xb), top, z1);
        if (k % 2 === 0) { const xr = sx * (xb - run); put('gold', new T.CylinderGeometry(0.022, 0.03, 0.95, 6).translate(xr, top + 0.475, z0 + 0.12)); }
      }
      // Handlauf und Wange auf der offenen Seite, Antrittspfosten mit Leuchtkugel
      put('gold', new T.BoxGeometry(L, 0.09, 0.13).rotateZ(sx * -ang).translate(sx * xm, ym + 0.98, z0 + 0.12));
      put('dark', new T.BoxGeometry(L, 0.32, 0.22).rotateZ(sx * -ang).translate(sx * xm, ym - 0.05, z0 + 0.1));
      col(Math.min(sx * x0, sx * x1), G1, z0 - 0.02, Math.max(sx * x0, sx * x1), G2 + 1.1, z0 + 0.24);
      put('dark', boxW(0.36, 1.25, 0.36, sx * (x1 + 0.1), G1 + 0.625, z0 + 0.12, 2)); put('gold', new T.BoxGeometry(0.42, 0.08, 0.42).translate(sx * (x1 + 0.1), G1 + 1.29, z0 + 0.12));
      put('lamp', new T.SphereGeometry(0.17, 14, 10).translate(sx * (x1 + 0.1), G1 + 1.5, z0 + 0.12)); glow(sx * (x1 + 0.1), G1 + 1.5, z0 + 0.12, [1.4, 1.0, 0.55], 1.1);
      put('gold', boxW(0.26, 1.1, 0.26, sx * x0, G2 + 0.55, z0 + 0.12, 2)); put('gold', new T.SphereGeometry(0.12, 12, 8).translate(sx * x0, G2 + 1.2, z0 + 0.12));
    }
  }
  // Bühne mit Musikmuschel und großem Sonnenstrahl
  const S0 = P + 1.3;
  put('dark', boxW(30, 1.3, 9, 0, P + 0.65, -43.5, 3)); put('gold', new T.BoxGeometry(30.2, 0.12, 0.12).translate(0, S0, -39));
  col(-15, 0, -48, 15, S0, -39);
  for (let k = 0; k < 3; k++) { const z = -38.6 + k * 0.6, y = S0 - (k + 1) * 0.43; put('dark', boxW(10, y, 0.6, 0, y / 2, z, 2)); col(-5, 0, z - 0.3, 5, y, z + 0.3); }
  const bigFan = new T.Mesh(new T.PlaneGeometry(34, 17), new T.MeshBasicMaterial({ map: FAN_TEX, transparent: true, color: new T.Color(0.92, 0.74, 0.48), depthWrite: false })   /* V67: weniger überstrahlt */);
  bigFan.position.set(0, S0 + 8.5, -47.8); IG.add(bigFan);
  for (const r of [16, 17.2, 18.4]) put('gold', new T.TorusGeometry(r, 0.12, 6, 64, Math.PI).translate(0, S0, -47.6));
  for (const r of [16.6, 17.8]) addNeonArc(0, S0, -47.5, r);
  // Band: Flügel, Kontrabass, Schlagzeug, Bläser, Sängerin
  put('piano', new T.BoxGeometry(1.5, 0.35, 2.2).translate(-9, S0 + 0.95, -44.2));
  put('piano', new T.BoxGeometry(1.5, 0.05, 2.0).rotateZ(-0.55).translate(-8.55, S0 + 1.55, -44.3));
  for (const [dx, dz] of [[-0.6, -1], [0.6, -1], [0, 0.9]]) put('piano', new T.CylinderGeometry(0.06, 0.06, 0.8, 6).translate(-9 + dx, S0 + 0.4, -44.2 + dz));
  put('piano', new T.BoxGeometry(0.5, 0.5, 1.0).translate(-10.2, S0 + 0.25, -44.2));
  put('bass', new T.SphereGeometry(1, 16, 12).scale(0.32, 0.55, 0.14).translate(-4.6, S0 + 0.75, -44.6));
  put('piano', new T.BoxGeometry(0.06, 1.0, 0.06).translate(-4.6, S0 + 1.7, -44.62));
  put('drumhead', new T.CylinderGeometry(0.36, 0.36, 0.35, 20).rotateX(Math.PI / 2).translate(3.5, S0 + 0.38, -45));
  put('drumhead', new T.CylinderGeometry(0.2, 0.2, 0.15, 16).translate(2.9, S0 + 0.7, -44.6));
  put('drumhead', new T.CylinderGeometry(0.18, 0.18, 0.2, 16).translate(3.9, S0 + 0.95, -45.1));
  for (const [cx, cy, cz] of [[2.6, 1.3, -45.2], [4.5, 1.45, -44.8]]) { put('gold', new T.CylinderGeometry(0.32, 0.05, 0.03, 20).translate(cx, S0 + cy, cz)); put('chrome', new T.CylinderGeometry(0.015, 0.015, cy, 4).translate(cx, S0 + cy / 2, cz)); }
  const fanStand = (x, z) => { put('dark', new T.BoxGeometry(0.9, 0.9, 0.06).translate(x, S0 + 0.45, z)); fanPlane(x, S0 + 0.35, z + 0.04, 0.85, 0); };
  for (const x of [7.5, 10, 12.5]) fanStand(x, -43.2);
  put('chrome', new T.CylinderGeometry(0.015, 0.03, 1.55, 6).translate(0, S0 + 0.78, -40.3)); put('chrome', new T.SphereGeometry(0.06, 8, 6).translate(0, S0 + 1.58, -40.3));
  const spot = makeBeam(BALL_H - S0 - 2, 2.2, 0.08); spot.position.set(0, BALL_H - 1, -40.6); spot.rotation.x = Math.PI; IG.add(spot);
  // Tische mit Leinen, Tischlampen und Champagner
  const tables = [];
  for (const sx of [-1, 1]) for (let z = -38; z <= -18; z += 5) for (const xo of [22, 27.5]) tables.push([sx * xo, z]);
  for (let x = -24; x <= 24; x += 6) if (Math.abs(x) > 2) tables.push([x, -16.2]);
  for (const [x, z] of tables) {
    put('linen', new T.CylinderGeometry(1.0, 1.05, 0.05, 20).translate(x, P + 0.78, z));
    put('linen', new T.CylinderGeometry(1.02, 1.08, 0.5, 20, 1, true).translate(x, P + 0.53, z));
    put('gold', new T.CylinderGeometry(0.05, 0.25, 0.3, 8).translate(x, P + 0.15, z));
    put('gold', new T.CylinderGeometry(0.03, 0.08, 0.35, 6).translate(x, P + 0.98, z)); put('lamp', new T.ConeGeometry(0.16, 0.18, 10, 1, true).translate(x, P + 1.22, z));
    glow(x, P + 1.15, z, [1.35, 0.9, 0.5], 1.3);
    put('piano', new T.CylinderGeometry(0.04, 0.05, 0.32, 6).translate(x + 0.35, P + 0.97, z + 0.2));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; placeFurn(FURN.diningChair(), BM('velvetBlue'), badd, x + Math.cos(a) * 1.45, P, z + Math.sin(a) * 1.45, -a - Math.PI / 2); }
    col(x - 1.05, 0, z - 1.05, x + 1.05, 0.85, z + 1.05);
  }
  // Bar unter der Westgalerie
  put('wood', boxW(1.6, 1.15, 22, -44, P + 0.58, -29, 2)); put('gold', new T.BoxGeometry(1.8, 0.08, 22.2).translate(-44, P + 1.2, -29));
  col(-44.8, 0, -40, -43.2, 1.2, -18);
  for (let y = 1.6; y <= 5.2; y += 0.9) { put('gold', new T.BoxGeometry(0.5, 0.05, 20).translate(-47.6, P + y, -29)); put('bottles', new T.BoxGeometry(0.22, 0.4, 19).translate(-47.6, P + y + 0.22, -29)); }
  glow(-47, 3.8, -29, [1.2, 0.7, 0.3], 9);
  for (const z of [-36, -29, -22]) glow(-44, P + 1.6, z, [1.3, 0.9, 0.5], 1.2);
  palm(-45, -45, 3.2); palm(45, -45, 3.2); palm(-45, -10, 2.8); palm(45, -10, 2.8);

  // ---------- V33: Ballsaal mit mehr Ausstattung ----------
  buildBallroomDeco({ P, G1, G2, BALL_H, S0, tables, put, col, glow, M });
  // ---------- V51: Licht, Wandleuchten, Gemälde, Teppiche, Gepäckwagen, Barhocker ----------
  buildBelmontLuxe({ IG, P, G1, G2, LOBBY_H, BALL_H, put, col, glow, M });

  // ---------- Lichter ----------
  // V65: Lichtpool auch auf den Galerien (Tische, Logen, Treppe); gezeichnet werden ohnehin nur die vier nächsten
  for (const sx of [-1, 1]) for (const [x, y, z] of [[44.5, G1 + 3, -38], [44.5, G1 + 3, -22], [44, G2 + 3, -40], [44, G2 + 3, -22], [14, G1 + 5.5, -8], [28, G1 + 3, -9]]) addLight(0xffc27a, 0.4, 16, 1.6, sx * x, y, z, true);
  for (const [x, y, z, i, d] of [[0, 12, 22, 1.2, 70], [0, 13, 40, 0.7, 40], [0, 24, -24, 0.9, 70], [-28, 15, -30, 0.7, 50], [28, 15, -30, 0.7, 50], [0, 10, -40, 0.6, 22]]) {
    addLight(0xffc27a, i * 0.72, d, 1.6, x, y, z, true);
  }

  // ---------- V67: Raumschatten, Kontaktschatten und Lichtflecken (raumlicht.js, zwei Zeichenaufrufe) ----------
  belmontShade({ P, G1, G2, LOBBY_H, BALL_H, S0, tables, put, M });

  movOff();
  for (const k in batch) IG.add(new T.Mesh(mergeGeos(batch[k]), M[k]));
  if (fanGeos.length) IG.add(new T.Mesh(mergeGeos(fanGeos), fanM));
  shadeEnd(IG);

  // ---------- Menschen ----------
  const C = interiorCrowd = new Crowd(['tux', 'gown', 'dress', 'livery'], 680);
  const place = (kind, color, x, y, z, yaw) => { const a = C.add(kind, color); a.x = x; a.y = y; a.z = z; a.yaw = yaw; return a; };
  const tux = (x, y, z, yaw) => place('tux', [1, 1, 1], x, y, z, yaw);
  const gown = (x, y, z, yaw) => place('gown', pick(GOWNS), x, y, z, yaw);
  const staff = (x, y, z, yaw, c = [0.32, 0.05, 0.07]) => place('livery', c, x, y, z, yaw);
  // V51: Tätigkeiten (Nachkommastelle = Stärke): 0.6 plaudern, 5.3 Glas trinken, 9 klatschen, 7.8 sitzend plaudern, 11.4 sitzend trinken
  const act = (a, v) => { a.gait[1] = v; return a; };
  const anyone = (x, y, z, yaw, v) => act((R() < 0.5 ? tux : gown)(x, y, z, yaw), v);
  const sitAt = (x, seatY, z, yaw, v) => { const m = R() < 0.5; return act((m ? tux : gown)(x, seatY - (m ? 0.87 : 0.8), z, yaw), v); };
  const dens = MOBILE ? 0.55 : 1;   // auf dem Handy weniger Zuschauer und Galeriegäste
  const standAct = () => { const r = R(); return r < 0.45 ? 0.6 : r < 0.8 ? 5.3 : 0.2; };
  // Band
  const face = Math.PI * 0 + 0;
  const band = [
    tux(-9.1, S0 - 0.45, -45.3, 0.35), tux(-4.1, S0, -44.1, -0.4), tux(3.6, S0 - 0.45, -45.7, 0),
    tux(7.5, S0, -44, 0.1), tux(10, S0, -44.3, 0), tux(12.5, S0, -44, -0.1),
  ];
  const singer = place('gown', [0.95, 0.75, 0.38], 0, S0, -40.6, face);
  for (const a of [...band, singer]) swayers.push(a);
  singer.gait[1] = 23;
  for (const x of [7.5, 10, 12.5]) put('gold', new T.CylinderGeometry(0.04, 0.09, 0.5, 8).rotateX(1.1).translate(x, S0 + 1.38, -43.6));
  // Tanzpaare im Kreis
  const NC = MOBILE ? 18 : 26;   // V51: mehr Paare
  for (let k = 0; k < NC; k++) {
    const ring = k % 2, ang = k / NC * Math.PI * 2;
    const c = { ang, rho0: ring ? 0.5 : 0.9, cx: (k / NC * 3 - 1.5) * 2.6, cz: -28 + (k % 3 - 1) * 0.6, h0: R() * 6.28 };
    c.m = C.add('tux', [1, 1, 1]); c.w = C.add(k % 6 === 5 ? 'dress' : 'gown', pick(GOWNS));
    setDance(c, k % 6 === 5 ? 'charl' : 'fox');
    dancers.push(c);
  }
  // Gäste an Tischen, an der Bar, auf den Galerien
  // V51: Gäste sitzen auf den Stühlen an den Tischen (vorher standen sie daneben), dazu ein paar Stehende
  for (const [x, z] of tables) {
    const n = 2 + Math.floor(R() * 3);
    for (let k = 0; k < 4; k++) { if (k >= n) break; const a = k * Math.PI / 2 + 0.4; sitAt(x + Math.cos(a) * 1.45, P + 0.52, z + Math.sin(a) * 1.45, -a - Math.PI / 2, R() < 0.5 ? 11.4 : 7.8); }
    if (R() < 0.3) { const a = 0.4 + Math.PI * 0.25 + Math.floor(R() * 4) * Math.PI / 2; anyone(x + Math.cos(a) * 1.9, P, z + Math.sin(a) * 1.9, Math.atan2(-Math.cos(a), -Math.sin(a)), 0.6); }
  }
  // Zuschauer am Rand der Tanzfläche: klatschen, trinken, plaudern
  for (let x = -16; x <= 16; x += rand(1.3, 2.2)) if (Math.abs(x) > 1.6 && R() < 0.75 * dens) anyone(x, P, -18.3 + rand(-0.2, 0.3), Math.PI + rand(-0.3, 0.3), R() < 0.35 ? 9 : standAct());
  for (const sx of [-1, 1]) for (let z = -35; z <= -21; z += rand(1.4, 2.4)) if (R() < 0.7 * dens) anyone(sx * (19.1 + rand(0, 0.3)), P, z, (sx > 0 ? -Math.PI / 2 : Math.PI / 2) + rand(-0.3, 0.3), R() < 0.35 ? 9 : standAct());
  // Bar: Gäste auf den Barhockern (Sitz 0,89 m) und davor
  for (let z = -38.5; z <= -19.5; z += 1.5) if (R() < 0.6) sitAt(-42.9, P + 0.88, z, -Math.PI / 2, R() < 0.6 ? 11.4 : 7.8);
  for (let z = -37; z <= -21; z += rand(2.5, 4)) anyone(-41.4 + rand(-0.2, 0.3), P, z, -Math.PI / 2 + rand(-0.6, 0.6), standAct());
  for (const z of [-36, -29, -22]) staff(-45.6, P, z, Math.PI / 2, [0.88, 0.86, 0.8]);
  for (const y of [G1, G2]) {
    for (let x = -38; x <= 38; x += rand(1.8, 3.6)) if (R() < 0.75 * dens) anyone(x, y, -12.6 + rand(0, 1.2) * -1 + 1.2, Math.PI, standAct());
    // V65: an den Seiten der ersten Galerie stehen sie nur noch vorn an der Brüstung (dahinter Tische), die zweite hat Logen
    if (y === G1) for (const sx of [-1, 1]) for (let z = -46; z <= -15; z += rand(2.4, 4.5)) if (R() < 0.55 * dens) anyone(sx * (41.7 + rand(0, 0.7)), y, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, standAct());
  }
  // V65: Gäste an den Galerietischen und in den VIP-Logen (ein paar Logen bleiben frei)
  for (const st of GAL.seats) if (R() < (st.vip ? (st.back ? 0.45 : 0.7) : 0.6) * (MOBILE ? 0.7 : 1)) sitAt(st.x, st.y, st.z, st.yaw, R() < 0.5 ? 11.4 : 7.8);
  for (const sx of [-1, 1]) for (const z of [-40, -25]) staff(sx * 47.1, G2, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, [0.9, 0.88, 0.82]);
  // Kellner mit Champagner, die durch den Saal gehen
  for (let k = 0; k < 6; k++) walkersIn.push({ a: staff(0, P, 0, 0, [0.9, 0.88, 0.82]), cx: k < 3 ? -24 : 24, cz: -27, rx: 3.5 + k % 3, rz: 9 + (k % 3), sp: 0.12 + 0.03 * k, ph: k * 2 });
  // V51: Gäste und Kellner unter der Ostgalerie (an den Spiegeln vorbei)
  for (let k = 0; k < 4; k++) walkersIn.push({ a: k % 2 ? staff(0, P, 0, 0, [0.9, 0.88, 0.82]) : anyone(0, P, 0, 0, 0), cx: 44.5, cz: -29, rx: 1.1, rz: 13, sp: (0.05 + 0.012 * k) * (k % 2 ? 1 : -1), ph: k * 1.6 });
  // Lobby: Personal, Gäste in Gruppen, Pagen
  for (const z of [16, 22, 28]) staff(-41.8, P, z, Math.PI / 2);
  for (const sx of [-1, 1]) staff(sx * 6.5, P, 46, Math.PI);
  for (const z of [12, 22, 32]) staff(46, P, z + 2.2, -Math.PI / 2);
  // V51: in den Sitzgruppen sitzen die Gäste auf Sofas und Sesseln (vorher standen sie in den Polstern)
  for (const sx of [-1, 1]) for (const z0 of [10, 34]) {
    const x0 = sx * 16;
    for (const dx of [-0.85, 0.85]) { if (R() < 0.7) sitAt(x0 + dx, P + 0.6, z0 - 2.47, 0, R() < 0.4 ? 11.4 : 7.8); if (R() < 0.6) sitAt(x0 + dx, P + 0.6, z0 + 2.47, Math.PI, R() < 0.4 ? 11.4 : 7.8); }
    for (const s of [-1, 1]) if (R() < 0.6) sitAt(x0 + s * 3.05, P + 0.56, z0, s < 0 ? Math.PI / 2 : -Math.PI / 2, 7.8);
  }
  // Gäste am Empfang, Gruppen zwischen den Säulen, ein Page am Gepäckwagen
  for (const z of [14.5, 21, 27.5]) anyone(-35.9, P, z + rand(-0.3, 0.3), -Math.PI / 2 + rand(-0.15, 0.15), 0.6);
  anyone(-35.6, P, 23.2, -Math.PI / 2 - 0.5, 0.2);
  for (const [gx, gz] of [[-20.9, 22], [20.9, 22], [-9, 6], [10, 38], [-34, 40], [35, 8], [-33, 4]]) {
    const n = 2 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) { const a = k / n * 6.28 + R(); anyone(gx + Math.cos(a) * 0.75, P, gz + Math.sin(a) * 0.75, Math.atan2(-Math.cos(a), -Math.sin(a)), standAct()); }
  }
  staff(-6.2, P, 42.3, Math.PI - 0.2); staff(41.2, P, 5, Math.PI / 2 + Math.PI, [0.12, 0.12, 0.14]);
  for (let k = 0; k < 6; k++) walkersIn.push({ a: anyone(0, P, 0, 0, 0), cx: k < 3 ? -23.5 : 23.5, cz: 22, rx: 1.2, rz: 12.5 + 0.5 * (k % 2), sp: (0.04 + 0.01 * k) * (k % 2 ? 1 : -1), ph: k * 2.1, lobby: true });
  for (let k = 0; k < 8; k++) walkersIn.push({ a: (k % 2 ? tux : gown)(0, P, 0, 0), cx: k < 4 ? -8 : 8, cz: 22, rx: 3 + k % 3, rz: 18 + 3 * (k % 2), sp: (0.03 + 0.008 * k) * (k % 3 ? 1 : -1), ph: k * 1.3, lobby: true });
  for (const w of walkersIn) { w.a.gait[1] = 5.2; w.a.gait[2] = 0.36; }
  galaPeople(C, { P, S0, tux, gown, singer });   // V61: Gala zu Ehren von Alexander (Direktor, Bürgermeister, Extra-Paare)
  C.finish();
  for (const a of C.list) if (a.x !== undefined) C.set(a, a.x, a.y, a.z, a.yaw);
  C.flag();
}

/* =====================================================================
   V33 · BALLSAAL: Teppiche unter den Tischen, Goldfries an den Galerien, Wandbild über der Galerie,
   Spiegel mit Wandleuchten, Bühnenvorhang und Rampenlicht, Blumen und Champagnerschalen auf den Tischen,
   eine Champagnerpyramide, Urnen mit Blumen, zwei Bronzetänzerinnen, Deckenmedaillon, Damastfelder
   Alles in eigenen Netzen (BALL_DECO), die nur in der Nähe des Belmont gezeichnet werden.
   ===================================================================== */
export const BALL_DECO = { g: null };
// V65: Galerien des Ballsaals: Treppe zur zweiten Galerie (x0 oben, x1 unten, z0 offene Kante), Tische der ersten Galerie, VIP-Logen der zweiten
export const GAL = { stair: { x0: 7.6, x1: 20.8, z0: -9.4 }, tables: [], seats: [] };
export const BEL_IN = { g: null };   // V34: Lobby und Ballsaal (nur in der Nähe sichtbar)
// V67: Lobby und Ballsaal bekommen Raumtiefe ohne Schatten im Shader: dunklere Boden- und Deckenkanten an den Wänden,
// weiche Dunkelheit unter den Galerien, Flecken an Säulenfüßen, unter Tischen, Tresen und Bühne, warme Lichtflecken unter
// den Kronleuchtern und auf den Tischtüchern. Dazu Teppichläufer auf den Galerien (vorher schwarzer Marmor, fast unsichtbar).
function belmontShade({ P, G1, G2, LOBBY_H, BALL_H, S0, tables, put, M }) {
  const warm = [1, 0.72, 0.42];
  // Lobby: Innenmaße zwischen den Wandverkleidungen; offen bleiben Portal und Ballsaaltor
  shadeRoom(-47.78, 47.78, -3.78, 47.78, P, { a: 0.5, w: 1.1, wh: 0.9, ceil: LOBBY_H - P, gaps: [[-8.3, 8.3, 47, 49], [-9.6, 9.6, -5, -3]] });
  // Ballsaal: Boden und Decke; unter den Galerien ist es ohnehin dunkler (siehe unten)
  shadeRoom(-47.78, 47.78, -47.78, -6.1, P, { a: 0.45, w: 1.0, wh: 0.8, ceil: BALL_H - P, gaps: [[-9.2, 9.2, -7, -5]] });
  // unter den Galerien: weiche Dunkelheit, zum Saal hin auslaufend
  for (const sx of [-1, 1]) { shadeQuad(sx * 44.6, P + 0.05, -30.5, 9.5, 37, 0, 0.2, 0); shadeQuad(sx * 44.6, G1 + 0.05, -30.5, 9.5, 37, 0, 0.15, 0); }
  shadeQuad(0, P + 0.05, -9.4, 90, 9.6, 0, 0.2, 0);
  // Galerieböden: Wandkanten (Außenwand, Nordwand, Trennwand) und Unterseite der nächsten Platte
  const st = GAL.stair;
  for (const y of [G1, G2]) {
    const H = y === G1 ? G2 - 0.6 - G1 : BALL_H - G2;
    for (const sx of [-1, 1]) {
      shadeEdge(sx * 47.78, -47.78, sx * 47.78, -6.1, y + 0.05, -sx, 0, 1.0, 0.45); shadeWall(sx * 47.78, -47.78, sx * 47.78, -6.1, y, 0.8, -sx, 0, 0.36);
      shadeWall(sx * 47.78, -47.78, sx * 47.78, -6.1, y + H, -1.0, -sx, 0, 0.32);
      shadeEdge(sx * 41.2, -47.78, sx * 47.78, -47.78, y + 0.05, 0, 1, 1.0, 0.45); shadeWall(sx * 41.2, -47.78, sx * 47.78, -47.78, y, 0.8, 0, 1, 0.36);
      // Trennwand: neben den Treppen (V65) offen lassen
      for (const [a, b] of [[st.x1 + 0.3, 47.78], [0, st.x0 - 0.2]]) { shadeEdge(sx * a, -6.1, sx * b, -6.1, y + 0.05, 0, -1, 1.0, 0.42); shadeWall(sx * a, -6.1, sx * b, -6.1, y, 0.8, 0, -1, 0.34); }
    }
  }
  // Teppichläufer auf den Galerien (Läufer aus der Lobby, längs gekachelt)
  M.galRug = stdMat({ map: RUNNER_TEX(), color: 0xe6d4c8, roughness: 0.95, envI: 0.15, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const rug = (x0, x1, z0, z1, y) => {
    const alongZ = z1 - z0 > x1 - x0, w = alongZ ? x1 - x0 : z1 - z0, L = alongZ ? z1 - z0 : x1 - x0, g = new T.PlaneGeometry(w, L), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * L / w);
    g.rotateX(-Math.PI / 2); if (!alongZ) g.rotateY(Math.PI / 2);
    put('galRug', g.translate((x0 + x1) / 2, y + 0.015, (z0 + z1) / 2));
  };
  for (const sx of [-1, 1]) for (const y of [G1, G2]) rug(Math.min(sx * 41.6, sx * 47.5), Math.max(sx * 41.6, sx * 47.5), -47.5, -13.4, y);
  rug(-40.6, 40.6, -12.6, -6.5, G1); rug(-40.6, 40.6, -12.6, -9.8, G2);
  // Säulenfüße: Lobby, unter den Galerien, vorn an der Quergalerie
  for (const sx of [-1, 1]) for (const z of [4, 16, 28, 40]) shadeColumn(sx * 27, P, z, 1.2, 0.55);
  for (const sx of [-1, 1]) for (let z = -46; z <= -13; z += 7) { shadeColumn(sx * 41.4, P, z, 0.45, 0.5); shadeColumn(sx * 41.4, G1, z, 0.45, 0.45); }
  for (let x = -34; x <= 34; x += 8.5) if (Math.abs(x) >= 3) { shadeColumn(x, P, -13.4, 0.45, 0.5); shadeColumn(x, G1, -13.4, 0.45, 0.45); }
  // Lobby: Rundsofa, Sitzgruppen-Tische, Empfang, Palmenkübel
  shadeDisc(0, P, 22, 5.0, 0.55);
  for (const sx of [-1, 1]) for (const z0 of [10, 34]) { shadeDisc(sx * 16, P, z0, 1.5, 0.45); for (const [dx, dz] of [[5.5, -4], [5.5, 4]]) shadeDisc(sx * 16 + sx * dx, P, z0 + dz, 0.95, 0.45); }
  shadeQuad(-39, P + 0.05, 22, 3.8, 22.8, 0, 0.5, 0);
  for (const sx of [-1, 1]) for (const z of [46, -2]) shadeDisc(sx * 44, P, z, 0.95, 0.45);
  for (const sx of [-1, 1]) for (const z of [45.5, -2.2]) shadeDisc(sx * 11, P, z, 0.95, 0.45);
  // Ballsaal: Tische (Saal und Galerien), Bar, Bühne, Treppenfüße
  for (const [x, z] of tables) { shadeDisc(x, P, z, 1.45, 0.48); lightPool(x, P + 0.79, z, 0.95, warm, 0.16); }
  for (const [x, y, z] of GAL.tables) { shadeDisc(x, y, z, 1.35, 0.48); lightPool(x, y + 0.79, z, 0.9, warm, 0.16); }
  shadeQuad(-44, P + 0.05, -29, 2.4, 22.8, 0, 0.5, 0);
  shadeEdge(-15, -39, 15, -39, P + 0.05, 0, 1, 0.9, 0.5);
  shadeEdge(-5, -37.7, 5, -37.7, P + 0.05, 0, 1, 0.6, 0.4);
  for (const sx of [-1, 1]) { shadeQuad(sx * 36, P + 0.05, -26.5, 7.2, 28, 0, 0.28, 0); shadeDisc(sx * 36, P, -42, 0.95, 0.45); }
  for (const [x, z] of [[-45, -45], [45, -45], [-45, -10], [45, -10]]) shadeDisc(x, P, z, 0.95, 0.45);
  // Lichtflecken unter den Kronleuchtern und Pendelleuchten
  lightPool(0, P, 22, 9, warm, 0.26);
  for (const sx of [-1, 1]) for (const z of [6, 38]) lightPool(sx * 14, P, z, 5, warm, 0.18);
  lightPool(0, P, -28, 13, warm, 0.22); lightPool(-26, P, -28, 7, warm, 0.17); lightPool(26, P, -28, 7, warm, 0.17);
}

function buildBallroomDeco({ P, G1, G2, BALL_H, S0, tables, put, col, glow, M }) {
  const grp = new T.Group(); BALL_DECO.g = grp; scene.add(grp);
  const batch = {}, add = (k, g) => (batch[k] ||= []).push(g);
  const plane = (w, h, uvx = 1, uvy = 1) => { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvx, uv.getY(i) * uvy); return g; };
  const rugT = decoRugTex('#0d2f33', '#c9a050', '#4a0c14', 10.5, 24);
  const DM = {
    rug: stdMat({ map: rugT, roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    frieze: new T.MeshBasicMaterial({ map: friezeTex(), color: new T.Color(1.15, 1.05, 0.9) }),
    mural: new T.MeshBasicMaterial({ map: muralTex(5), color: new T.Color(0.95, 0.92, 0.88) }),
    // V65: Spiegel mit eigenem Silberschein (rein metallisch spiegelten sie nur die dunkle Umgebung und standen als schwarze Tafeln im Raum)
    mirror: stdMat({ color: 0xaab4ba, metalness: 0.65, roughness: 0.1, envI: 1.5, emissive: 0x2c3438 }),
    curtain: addSheen(stdMat({ color: 0x5a0d16, roughness: 0.85, envI: 0.15, side: T.DoubleSide }), 0.5),   // V70: Samtschein
    damask: stdMat({ map: damaskTex('#123c3e', '#1d5356'), roughness: 0.55, metalness: 0.15, envI: 0.4 }),
    bloom: stdMat({ color: 0xf2e6e0, roughness: 0.7, envI: 0.2, emissive: 0x2a1a18 }),
    rose: stdMat({ color: 0x9a1828, roughness: 0.7, envI: 0.2, emissive: 0x200408 }),
    bronze: stdMat({ color: 0x8a5a2a, metalness: 0.95, roughness: 0.32, envI: 0.9, emissive: 0x100804 }),
  };
  // Teppiche unter den Tischreihen links und rechts der Tanzfläche
  for (const sx of [-1, 1]) { const m = new T.Mesh(new T.PlaneGeometry(10.5, 24), DM.rug); m.rotation.x = -Math.PI / 2; m.position.set(sx * 24.75, P + 0.02, -28); grp.add(m); }
  // Goldfries vorn an den Galerieplatten (Seiten und Querseite), je 0,6 m hoch
  for (const y of [G1, G2]) {
    add('frieze', plane(96, 0.56, 96 / 4.8, 1).rotateY(Math.PI).translate(0, y - 0.32, -13.015));
    for (const sx of [-1, 1]) add('frieze', plane(35, 0.56, 35 / 4.8, 1).rotateY(-sx * Math.PI / 2).translate(sx * 40.985, y - 0.32, -30.5));
  }
  // Wandbild über der oberen Galerie (Trennwand, Blick nach Norden), mit Goldrahmen
  add('mural', plane(38, 9.5).rotateY(Math.PI).translate(0, 24.6, -6.04));
  for (const [w, h, x, y] of [[38.8, 0.35, 0, 29.5], [38.8, 0.35, 0, 19.7], [0.35, 10.2, -19.4, 24.6], [0.35, 10.2, 19.4, 24.6]]) put('gold', new T.BoxGeometry(w, h, 0.2).translate(x, y, -6.12));
  // Spiegel mit Goldrahmen an der Ostwand unter der Galerie, dazwischen Wandleuchten
  for (const z of [-43, -37, -31, -25, -19]) {
    add('mirror', new T.PlaneGeometry(2.3, 4.8).rotateY(-Math.PI / 2).translate(47.83, P + 3.4, z));
    for (const [h, w, dy, dz] of [[0.18, 2.66, 2.48, 0], [0.18, 2.66, -2.48, 0], [5.1, 0.18, 0, 1.24], [5.1, 0.18, 0, -1.24]]) put('gold', new T.BoxGeometry(0.12, h, w).translate(47.8, P + 3.4 + dy, z + dz));
    for (let k = 0; k < 5; k++) put('gold', new T.BoxGeometry(0.06, 0.05, 0.9 - k * 0.15).translate(47.76, P + 5.25 + k * 0.08, z));
    const zs = z + 3; put('gold', new T.CylinderGeometry(0.05, 0.12, 0.5, 8).rotateZ(Math.PI / 2).translate(47.6, P + 4.2, zs)); put('lamp', new T.ConeGeometry(0.22, 0.45, 10, 1, true).rotateX(Math.PI).translate(47.45, P + 4.55, zs));
    glow(47.4, P + 4.6, zs, [1.35, 0.95, 0.55], 1.6);
  }
  // Damast-Seidenfelder hinter den Galerien (beide Seitenwände, erste und zweite Ebene)
  for (const sx of [-1, 1]) for (const [y0, y1] of [[G1 + 0.4, G2 - 1.0], [G2 + 0.4, G2 + 4.1]]) for (let z = -43; z <= -18; z += 6) {
    add('damask', plane(4.6, y1 - y0, 4.6 / 2, (y1 - y0) / 2).rotateY(-sx * Math.PI / 2).translate(sx * 47.84, (y0 + y1) / 2, z));
    put('gold', new T.BoxGeometry(0.08, 0.08, 4.8).translate(sx * 47.8, y1 + 0.04, z)); put('gold', new T.BoxGeometry(0.08, 0.08, 4.8).translate(sx * 47.8, y0 - 0.04, z));
  }
  // Bühne: Samtvorhang in Falten links und rechts, Querbehang, Rampenlicht
  const folds = (w, h, n, amp) => { const g = new T.PlaneGeometry(w, h, n * 6, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) / w * n * Math.PI * 2) * amp); g.computeVertexNormals(); return g; };
  for (const sx of [-1, 1]) {
    const c = folds(3.4, 21, 7, 0.16); const tie = 0.75;
    const pos = c.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), t = Math.max(0, (-y + 2) / 10.5); pos.setX(i, pos.getX(i) * (1 - 0.45 * t * t) + sx * 1.0 * t * t * tie); }
    c.computeVertexNormals();
    add('curtain', c.translate(sx * 17.6, S0 + 10.5, -45.6));
    put('gold', new T.TorusGeometry(0.42, 0.06, 6, 16).rotateY(Math.PI / 2).translate(sx * 17.6 + sx * 0.6, S0 + 4.2, -45.4));
  }
  add('curtain', folds(38, 3.4, 26, 0.12).translate(0, BALL_H - 6.2, -45.2));
  for (let k = 0; k < 13; k++) { const x = -18 + k * 3; add('curtain', new T.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(1, 0.55, 0.25).translate(x + 1.5, BALL_H - 7.9, -45.05)); }
  put('gold', new T.BoxGeometry(38.4, 0.25, 0.25).translate(0, BALL_H - 4.4, -45.1));
  for (let x = -13.5; x <= 13.5; x += 1.5) { put('gold', new T.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, S0, -39.15)); glow(x, S0 + 0.12, -39.2, [1.4, 1.05, 0.6], 0.5); }
  // Tische: Blumengesteck in Kristallvase, zwei Champagnerschalen, Kerze
  const coupe = (x, y, z, s = 1) => { add('crystalD', new T.LatheGeometry([[0.035, 0], [0.035, 0.008], [0.006, 0.02], [0.006, 0.1], [0.05, 0.12], [0.06, 0.15]].map(([r, h]) => new T.Vector2(r * s, h * s)), 10).translate(x, y, z)); };
  const flowers = (x, y, z, s, n, mix) => {
    for (let k = 0; k < n; k++) { const a = k * 2.399, r = (0.04 + 0.05 * Math.sqrt(k / n)) * s * 2.2, h = (0.12 + 0.1 * (1 - k / n)) * s; add(mix && k % 3 === 0 ? 'rose' : 'bloom', new T.SphereGeometry(0.035 * s * 1.6, 7, 5).translate(x + Math.cos(a) * r, y + h, z + Math.sin(a) * r)); }
    for (let k = 0; k < 6; k++) { const a = k * 1.05; put('leaf', new T.PlaneGeometry(0.06 * s, 0.22 * s).translate(0, 0.11 * s, 0).rotateX(-0.9).rotateY(a).translate(x, y + 0.04 * s, z)); }
  };
  for (const [x, z] of tables) {
    add('crystalD', new T.LatheGeometry([[0.05, 0], [0.07, 0.04], [0.05, 0.16], [0.07, 0.2]].map(([r, h]) => new T.Vector2(r, h)), 10).translate(x - 0.25, P + 0.81, z - 0.2));
    flowers(x - 0.25, P + 0.98, z - 0.2, 1, MOBILE ? 7 : 12, true);
    coupe(x + 0.3, P + 0.81, z - 0.35); coupe(x - 0.35, P + 0.81, z + 0.35);
  }
  // Champagnerpyramide vor der Galerie
  put('linen', new T.CylinderGeometry(1.0, 1.05, 0.05, 20).translate(0, P + 0.78, -16.2)); put('gold', new T.CylinderGeometry(1.02, 1.08, 0.5, 20, 1, true).translate(0, P + 0.53, -16.2));
  col(-1.05, 0, -17.25, 1.05, 0.85, -15.15);
  for (let lv = 0, y = P + 0.81; lv < 5; lv++, y += 0.15) { const n = 5 - lv; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) coupe((i - (n - 1) / 2) * 0.13, y, -16.2 + (j - (n - 1) / 2) * 0.13, 0.95); }
  glow(0, P + 1.3, -16.2, [1.4, 1.1, 0.6], 2.4);
  // Urnen mit Blumen an den Ecken der Tanzfläche
  for (const sx of [-1, 1]) for (const z of [-38.2, -17.8]) {
    const x = sx * 19.2;
    put('dark', new T.CylinderGeometry(0.42, 0.5, 1.1, 16).translate(x, P + 0.55, z)); put('gold', new T.TorusGeometry(0.44, 0.04, 6, 20).rotateX(Math.PI / 2).translate(x, P + 1.1, z));
    put('gold', new T.LatheGeometry([[0.12, 0], [0.3, 0.1], [0.36, 0.4], [0.24, 0.62], [0.36, 0.72]].map(([r, h]) => new T.Vector2(r, h)), 16).translate(x, P + 1.12, z));
    flowers(x, P + 1.75, z, 4.2, MOBILE ? 12 : 22, true);
    col(x - 0.5, 0, z - 0.5, x + 0.5, 1.8, z + 0.5);
  }
  // Zwei Bronzetänzerinnen auf Sockeln neben der Bühnentreppe
  for (const sx of [-1, 1]) {
    const x = sx * 8, z = -38.2, y0 = P + 1.3;
    put('dark', boxW(1.1, 1.3, 1.1, x, P + 0.65, z, 2)); put('gold', new T.BoxGeometry(1.2, 0.08, 1.2).translate(x, y0, z));
    add('bronze', new T.LatheGeometry([[0.28, 0], [0.2, 0.15], [0.09, 0.9], [0.13, 1.2], [0.1, 1.45], [0.06, 1.55]].map(([r, h]) => new T.Vector2(r, h)), 14).scale(1, 1, 0.7).translate(x, y0, z));
    add('bronze', new T.SphereGeometry(0.11, 12, 8).translate(x + sx * 0.04, y0 + 1.68, z));
    add('bronze', new T.CylinderGeometry(0.03, 0.035, 0.9, 6).translate(0, 0.45, 0).rotateZ(-sx * 2.5).translate(x + sx * 0.1, y0 + 1.45, z));
    add('bronze', new T.CylinderGeometry(0.03, 0.035, 0.85, 6).translate(0, 0.42, 0).rotateZ(sx * 1.2).translate(x - sx * 0.1, y0 + 1.4, z));
    add('bronze', new T.TorusGeometry(0.75, 0.025, 5, 24, Math.PI * 1.2).rotateZ(0.4).translate(x, y0 + 1.6, z - 0.05));
    col(x - 0.55, 0, z - 0.55, x + 0.55, y0 + 2, z + 0.55);
  }
  // Deckenmedaillon um den großen Kronleuchter: drei Goldringe, Strahlen, ein Lichtkranz
  for (const r of [5.5, 7.2, 9.0]) put('gold', new T.TorusGeometry(r, 0.12, 6, 64).rotateX(Math.PI / 2).translate(0, BALL_H - 0.15, -28));
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; put('gold', new T.BoxGeometry(3.4, 0.06, 0.12).translate(7.25, 0, 0).rotateY(a).translate(0, BALL_H - 0.12, -28)); }
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; glow(Math.cos(a) * 8.1, BALL_H - 0.5, -28 + Math.sin(a) * 8.1, [1.2, 0.85, 0.45], 1.6); }
  // ---------- V65: Tische auf der ersten Galerie, VIP-Logen auf der zweiten ----------
  const fadd = (k, g) => (DM[k] ? add : put)(k, g);
  const VIP = mk => ({ up: mk, frame: 'gold', wood: 'piano', lamp: 'lamp', cloth: 'linen', leaf: 'leaf' });
  const galTable = (x, y, z, r = 0.9, chairs = 4, a0 = 0.4) => {
    put('linen', new T.CylinderGeometry(r, r + 0.05, 0.05, 20).translate(x, y + 0.78, z));
    put('linen', new T.CylinderGeometry(r + 0.02, r + 0.08, 0.5, 20, 1, true).translate(x, y + 0.53, z));
    put('gold', new T.CylinderGeometry(0.05, 0.25, 0.3, 8).translate(x, y + 0.15, z));
    put('gold', new T.CylinderGeometry(0.03, 0.08, 0.35, 6).translate(x, y + 0.98, z)); put('lamp', new T.ConeGeometry(0.16, 0.18, 10, 1, true).translate(x, y + 1.22, z));
    glow(x, y + 1.15, z, [1.35, 0.9, 0.5], 1.3);
    coupe(x + 0.3, y + 0.81, z - 0.3); coupe(x - 0.3, y + 0.81, z + 0.3);
    flowers(x - 0.25, y + 0.84, z + 0.1, 0.8, MOBILE ? 5 : 9, true);
    for (let k = 0; k < chairs; k++) {
      const a = a0 + k * Math.PI * 2 / chairs, cx = x + Math.cos(a) * (r + 0.45), cz = z + Math.sin(a) * (r + 0.45);
      placeFurn(FURN.diningChair(), VIP('velvetBlue'), fadd, cx, y, cz, -a - Math.PI / 2);
      GAL.seats.push({ x: cx, y: y + 0.52, z: cz, yaw: -a - Math.PI / 2, dining: true });
    }
    col(x - r - 0.05, y, z - r - 0.05, x + r + 0.05, y + 0.85, z + r + 0.05);
    GAL.tables.push([x, y, z]);
  };
  // Erste Galerie: Tischreihen an den Seitenwänden, je zwei an der Trennwand neben der Treppe und unter dem Podest
  for (const sx of [-1, 1]) {
    for (const z of [-44, -38, -32, -26, -20]) galTable(sx * 45, G1, z, 0.85, 4, 0.4);
    galTable(sx * 27.5, G1, -8.4, 0.85, 4, 0.4); galTable(sx * 3.8, G1, -8.6, 0.8, 3, Math.PI / 2);
  }
  // Zweite Galerie: sechs Logen je Seite. Trennwände aus schwarzem Marmor mit Goldkante, vorn ein Rahmen mit Samtvorhängen
  // und Volant, hinten ein Gang an der Wand (über ihn kommt man in jede Loge). In jeder Loge zwei Sessel an der Brüstung,
  // ein Beistelltisch mit Champagnerkübel und ein Sofa dahinter.
  const BX = 41.15, BB = 46.3, NB = 6, z0b = -48, z1b = -13.1, bl = (z1b - z0b) / NB, YP = G2 + 3.9;
  for (const sx of [-1, 1]) {
    const xa = sx * BX, xb = sx * BB, xm = (xa + xb) / 2;
    for (let k = 1; k <= NB; k++) {
      const z = z0b + k * bl;
      put('dark', boxW(BB - BX, 1.35, 0.14, xm, G2 + 0.675, z, 2)); put('gold', new T.BoxGeometry(BB - BX + 0.04, 0.07, 0.2).translate(xm, G2 + 1.38, z));
      col(Math.min(xa, xb), G2, z - 0.08, Math.max(xa, xb), G2 + 1.45, z + 0.08);
    }
    // Rahmen vorn: Pfeiler an jeder Trennwand, oben ein Goldbalken über die ganze Länge
    for (let k = 0; k <= NB; k++) { const z = z0b + k * bl + (k === 0 ? 0.2 : 0); put('dark', boxW(0.3, YP - G2, 0.3, sx * (BX + 0.05), (G2 + YP) / 2, z, 2)); put('gold', new T.BoxGeometry(0.36, 0.1, 0.36).translate(sx * (BX + 0.05), YP, z)); }
    put('gold', new T.BoxGeometry(0.2, 0.34, z1b - z0b).translate(sx * (BX + 0.05), YP + 0.2, (z0b + z1b) / 2));
    for (let k = 0; k < NB; k++) {
      const za = z0b + k * bl, zb = za + bl, zm = (za + zb) / 2;
      // Samtvorhänge links und rechts, gerafft, und ein Volant oben
      for (const e of [-1, 1]) {
        const c = folds(1.3, YP - G2 - 0.1, 4, 0.1), pos = c.attributes.position;
        for (let i = 0; i < pos.count; i++) { const yy = pos.getY(i), t = Math.max(0, (-yy + 0.6) / ((YP - G2) / 2)); pos.setX(i, pos.getX(i) * (1 - 0.5 * t * t) - e * 0.35 * t * t); }
        c.computeVertexNormals();
        add('curtain', c.rotateY(Math.PI / 2).translate(sx * (BX + 0.22), (G2 + YP) / 2 - 0.05, e < 0 ? za + 0.85 : zb - 0.85));
      }
      add('curtain', new T.SphereGeometry(bl / 2 - 0.3, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(0.25, 0.4, 1).translate(sx * (BX + 0.2), YP - 0.1, zm));
      // Teppich, Sessel, Tisch, Sofa, Leuchte
      add('rug', new T.PlaneGeometry(bl - 0.4, BB - BX - 0.3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2).translate(xm, G2 + 0.02, zm));
      for (const dz of [-1.15, 1.15]) {
        const cx = sx * (BX + 1.15), cz = zm + dz, ry = -sx * Math.PI / 2;
        placeFurn(FURN.clubChair(), VIP('curtain'), fadd, cx, G2, cz, ry);
        GAL.seats.push({ x: cx, y: G2 + 0.56, z: cz, yaw: ry, vip: true });
      }
      const tx = sx * (BX + 1.2);
      put('wood', new T.CylinderGeometry(0.32, 0.32, 0.04, 16).translate(tx, G2 + 0.62, zm)); put('gold', new T.CylinderGeometry(0.03, 0.12, 0.6, 8).translate(tx, G2 + 0.3, zm));
      put('gold', new T.CylinderGeometry(0.11, 0.08, 0.22, 10).translate(tx + sx * 0.1, G2 + 0.75, zm)); put('piano', new T.CylinderGeometry(0.035, 0.04, 0.3, 6).translate(tx + sx * 0.1, G2 + 0.9, zm));
      coupe(tx - sx * 0.12, G2 + 0.64, zm - 0.12); coupe(tx - sx * 0.12, G2 + 0.64, zm + 0.12);
      col(tx - 0.34, G2, zm - 0.34, tx + 0.34, G2 + 0.7, zm + 0.34);
      const sxp = sx * (BX + 3.3), sry = -sx * Math.PI / 2;
      placeFurn(FURN.sofa(2.4), VIP('curtain'), fadd, sxp, G2, zm, sry);
      col(Math.min(sxp - 0.5, sxp + 0.5), G2, zm - 1.3, Math.max(sxp - 0.5, sxp + 0.5), G2 + 0.9, zm + 1.3);
      for (const dz of [-0.6, 0.6]) GAL.seats.push({ x: sxp, y: G2 + 0.6, z: zm + dz, yaw: sry, vip: true, back: true });
      put('lamp', new T.SphereGeometry(0.16, 12, 8).translate(sx * (BB - 0.1), G2 + 2.0, zm)); glow(sx * (BB - 0.1), G2 + 2.0, zm, [1.4, 1.0, 0.55], 1.4);
      // Goldene Logennummer am Volant
      put('gold', new T.TorusGeometry(0.22, 0.035, 6, 20).rotateY(Math.PI / 2).translate(sx * (BX - 0.08), YP + 0.2, zm));
    }
  }
  DM.crystalD = M.crystal;
  for (const k in batch) grp.add(new T.Mesh(mergeGeos(batch[k]), DM[k]));
}
