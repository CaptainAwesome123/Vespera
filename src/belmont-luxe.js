/* =====================================================================
   V51 · BELMONT-LOBBY UND GRAND BALLROOM AUFGEWERTET
   Mehr Licht ohne mehr Lampen im Shader: Wandleuchten mit Lichtfächern (additive Flächen mit Verlauf),
   Lichtvouten unter den Gesimsen, beleuchtete Galeriekanten; Sockel aus schwarzem Marmor, Gemälde,
   Teppiche unter den Sitzgruppen, Stehlampen, Beistelltische, Gepäckwagen mit Koffern, Concierge-Pult,
   Etagenanzeiger über den Fahrstühlen, Blumen am Empfang. Nur MeshStandard/MeshBasic wie bisher,
   keine neuen Shader; alles wird mit den übrigen Netzen der Lobby zusammengefasst (BEL_IN).
   ===================================================================== */
import { T, canvasTex, mergeGeos, MOBILE } from './core.js';
import { stdMat } from './people-skeleton.js';
import { decoRugTex, paintingTex } from './deco-tex.js';
import { FURN, placeFurn, lathe, tube } from './entrances.js';
import { addLight } from './performance.js';

// Lichtfächer an der Wand: hell an der Leuchte, nach oben und unten weich auslaufend
let FAN_WASH = null, COVE_WASH = null;
function fanWashTex() {
  return FAN_WASH ||= canvasTex(128, 256, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const y0 = H * 0.62;
    const up = g.createRadialGradient(W / 2, y0, 2, W / 2, y0, H * 0.62);
    up.addColorStop(0, 'rgba(255,214,150,0.95)'); up.addColorStop(0.18, 'rgba(255,190,110,0.5)'); up.addColorStop(0.55, 'rgba(255,170,90,0.14)'); up.addColorStop(1, 'rgba(255,160,80,0)');
    g.save(); g.scale(1, 1); g.fillStyle = up; g.beginPath(); g.moveTo(W / 2, y0); g.lineTo(-W * 0.2, 0); g.lineTo(W * 1.2, 0); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(W / 2, y0); g.lineTo(W * 0.05, H); g.lineTo(W * 0.95, H); g.closePath(); g.globalAlpha = 0.55; g.fill(); g.restore();
    const core = g.createRadialGradient(W / 2, y0, 1, W / 2, y0, W * 0.4); core.addColorStop(0, 'rgba(255,225,170,0.9)'); core.addColorStop(1, 'rgba(255,200,120,0)');
    g.globalAlpha = 1; g.fillStyle = core; g.fillRect(0, 0, W, H);
  });
}
// Vouten: unter dem Gesims hell, nach unten auslaufend
function coveWashTex() {
  return COVE_WASH ||= canvasTex(8, 128, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,205,140,0.85)'); gr.addColorStop(0.25, 'rgba(255,185,110,0.3)'); gr.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  });
}

export function buildBelmontLuxe({ IG, P, G1, G2, LOBBY_H, BALL_H, put, col, glow, M }) {
  const washM = new T.MeshBasicMaterial({ map: fanWashTex(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: new T.Color(0.75, 0.6, 0.42), fog: false });
  const coveM = new T.MeshBasicMaterial({ map: coveWashTex(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, color: new T.Color(0.6, 0.48, 0.32), fog: false });
  const wash = [], cove = [];
  // Fläche an einer Wand: Normale (nx, nz) zeigt in den Raum
  const onWall = (arr, w, h, x, y, z, nx, nz) => arr.push(new T.PlaneGeometry(w, h).rotateY(Math.atan2(nx, nz)).translate(x + nx * 0.06, y, z + nz * 0.06));
  // Wandleuchte: Fächerschale aus Gold mit Milchglas, darüber der Lichtfächer
  const sconce = (x, y, z, nx, nz, s = 1) => {
    const ry = Math.atan2(nx, nz);
    put('gold', new T.CylinderGeometry(0.34 * s, 0.05 * s, 0.5 * s, 12, 1, true, -Math.PI / 2, Math.PI).rotateY(ry).translate(x + nx * 0.02, y, z + nz * 0.02));
    put('lamp', new T.CylinderGeometry(0.28 * s, 0.04 * s, 0.42 * s, 12, 1, false, -Math.PI / 2, Math.PI).rotateY(ry).translate(x + nx * 0.04, y + 0.03, z + nz * 0.04));
    for (let k = -2; k <= 2; k++) put('gold', new T.BoxGeometry(0.025, 0.55 * s, 0.025).rotateZ(k * 0.32).rotateY(ry).translate(x + nx * 0.2 * s, y + 0.05, z + nz * 0.2 * s));
    onWall(wash, 2.6 * s, 5.2 * s, x, y + 0.7 * s, z, nx, nz);
    glow(x + nx * 0.35, y + 0.1, z + nz * 0.35, [1.4, 1.0, 0.55], 1.1 * s);
  };
  // Gemälde mit Goldrahmen und Bilderleuchte
  const artM = [0, 1, 2, 3, 4].map(k => new T.MeshBasicMaterial({ map: paintingTex(k), color: new T.Color(0.62, 0.58, 0.54) }));
  const art = [[], [], [], [], []];
  const painting = (kind, x, y, z, w, h, nx, nz) => {
    const ry = Math.atan2(nx, nz);
    put('gold', new T.BoxGeometry(w + 0.5, h + 0.5, 0.14).rotateY(ry).translate(x + nx * 0.07, y, z + nz * 0.07));
    put('dark', new T.BoxGeometry(w + 0.16, h + 0.16, 0.06).rotateY(ry).translate(x + nx * 0.15, y, z + nz * 0.15));
    art[kind].push(new T.PlaneGeometry(w, h).rotateY(ry).translate(x + nx * 0.19, y, z + nz * 0.19));
    put('brass', new T.CylinderGeometry(0.06, 0.06, w * 0.5, 8).rotateZ(Math.PI / 2).rotateY(ry).translate(x + nx * 0.45, y + h / 2 + 0.35, z + nz * 0.45));
    put('lamp', new T.BoxGeometry(w * 0.48, 0.04, 0.08).rotateY(ry).translate(x + nx * 0.45, y + h / 2 + 0.3, z + nz * 0.45));
    onWall(wash, w * 1.15, h * 0.9, x, y + h * 0.18, z, nx, nz);
  };

  // ================= LOBBY =================
  // Sockel aus schwarzem Marmor (1,3 m) mit Goldband rundum, Lücken für Portal, Ballsaaltor und Fahrstühle
  const dado = (x0, x1, z0, z1) => { put('dark', new T.BoxGeometry(Math.max(0.12, x1 - x0), 1.3, Math.max(0.12, z1 - z0)).translate((x0 + x1) / 2, P + 0.65, (z0 + z1) / 2)); put('gold', new T.BoxGeometry(Math.max(0.16, x1 - x0), 0.08, Math.max(0.16, z1 - z0)).translate((x0 + x1) / 2, P + 1.32, (z0 + z1) / 2)); };
  dado(-47.9, -47.78, -4, 48);
  for (const [z0, z1] of [[-4, 9.8], [14.2, 19.8], [24.2, 29.8], [34.2, 48]]) dado(47.78, 47.9, z0, z1);
  dado(-48, -8.3, 47.78, 47.9); dado(8.3, 48, 47.78, 47.9);
  dado(-48, -9.6, -3.9, -3.78); dado(9.6, 48, -3.9, -3.78);
  // Wandleuchten: Seitenwände zwischen den Pilastern, Südwand neben dem Portal, Nordwand neben dem Ballsaaltor
  // an den Seitenwänden sitzen schon Fächerreliefs mit Lichtpunkt (alle 8 m): dort nur der Lichtfächer
  for (const sx of [-1, 1]) for (let z = 4; z <= 44; z += 8) onWall(wash, 3.0, 6.4, sx * 47.85, 6.6, z, -sx, 0);
  for (const x of [-38, -30, -22, -14, 14, 22, 30, 38]) sconce(x, 6.4, 47.85, 0, -1);
  for (const x of [-42, -16, 16, 42]) sconce(x, 6.4, -3.82, 0, 1);
  // zwei große Gemälde an der Nordwand (Sonnenaufgang über Vespera, Luftschiff über den Bergen), zwei an der Südwand
  painting(0, -35, 8.2, -3.8, 7.2, 9.0, 0, 1); painting(2, 35, 8.2, -3.8, 7.2, 9.0, 0, 1);
  painting(1, -26, 7.6, 47.8, 4.0, 5.0, 0, -1); painting(3, 26, 7.6, 47.8, 4.0, 5.0, 0, -1);
  // Lichtvouten unter den Gesimsen: Leuchtband und Lichtschleier nach unten
  const coveRun = (x0, z0, x1, z1, yTop, nx, nz, drop) => {
    const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ax = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    put('lamp', new T.BoxGeometry(ax ? L : 0.1, 0.08, ax ? 0.1 : L).translate(cx + nx * 0.25, yTop - 0.52, cz + nz * 0.25));
    onWall(cove, L, drop, cx, yTop - 0.5 - drop / 2, cz, nx, nz);
  };
  coveRun(-48, -3.9, 48, -3.9, LOBBY_H, 0, 1, 7); coveRun(-48, 47.9, 48, 47.9, LOBBY_H, 0, -1, 7);
  coveRun(-47.9, -4, -47.9, 48, LOBBY_H, 1, 0, 7); coveRun(47.9, -4, 47.9, 48, LOBBY_H, -1, 0, 7);

  // Teppiche unter den Sitzgruppen
  const rugGeo = [];
  for (const sx of [-1, 1]) for (const z0 of [10, 34]) rugGeo.push(new T.PlaneGeometry(9.5, 7.6).rotateX(-Math.PI / 2).translate(sx * 16, P + 0.02, z0));
  const rugM = stdMat({ map: decoRugTex('#3a0d16', '#c9a050', '#0d2f33', 9.5, 7.6), roughness: 1, envI: 0.1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  IG.add(new T.Mesh(mergeGeos(rugGeo), rugM));
  // Stehlampen und Beistelltische an den Sitzgruppen
  const LM = { up: 'velvet', frame: 'gold', wood: 'piano', lamp: 'lamp', cloth: 'linen', leaf: 'leaf' };
  for (const sx of [-1, 1]) for (const z0 of [10, 34]) {
    const x0 = sx * 16;
    for (const dx of [-2.4, 2.4]) { placeFurn(FURN.floorLamp(1.9), LM, put, x0 + dx, P, z0 - 3.0, 0); glow(x0 + dx, P + 1.75, z0 - 3.0, [1.4, 1.0, 0.55], 1.3); }
    for (const dx of [-2.4, 2.4]) { placeFurn(FURN.roundTable(0.32, 0.6), LM, put, x0 + dx, P, z0 + 2.9, 0); placeFurn(FURN.tableLamp(0.55), LM, put, x0 + dx, P + 0.6, z0 + 2.9, 0); glow(x0 + dx, P + 1.05, z0 + 2.9, [1.35, 0.95, 0.5], 0.8); }
    // Blumenschale auf dem Couchtisch
    put('crystal', lathe([[0.18, 0], [0.26, 0.08], [0.3, 0.16]], 14).translate(x0, P + 0.46, z0));
    for (let k = 0; k < (MOBILE ? 6 : 11); k++) { const a = k * 2.4, r = 0.06 + 0.2 * Math.sqrt(k / 11); put(k % 3 ? 'bloomL' : 'roseL', new T.SphereGeometry(0.075, 7, 5).translate(x0 + Math.cos(a) * r, P + 0.66 + 0.06 * (1 - k / 11), z0 + Math.sin(a) * r)); }
  }
  // Empfang: Blumengesteck auf dem Tresen, Tischglocke, Gästebuch
  for (const z of [17.5, 27]) {
    put('crystal', lathe([[0.1, 0], [0.16, 0.1], [0.12, 0.4], [0.18, 0.5]], 12).translate(-39, P + 1.24, z));
    for (let k = 0; k < (MOBILE ? 8 : 16); k++) { const a = k * 2.4, r = 0.05 + 0.32 * Math.sqrt(k / 16); put(k % 3 ? 'bloomL' : 'roseL', new T.SphereGeometry(0.09, 7, 5).translate(-39 + Math.cos(a) * r * 0.8, P + 1.85 + 0.2 * (1 - k / 16) + 0.1 * Math.sin(k), z + Math.sin(a) * r)); }
    for (let k = 0; k < 7; k++) put('leaf', new T.PlaneGeometry(0.16, 0.6).translate(0, 0.3, 0).rotateX(-0.8).rotateY(k * 0.9).translate(-39, P + 1.7, z));
  }
  put('brass', new T.SphereGeometry(0.09, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(-38.2, P + 1.24, 22.6));
  put('leather', new T.BoxGeometry(0.42, 0.06, 0.6).translate(-38.4, P + 1.27, 20.8)); put('linen', new T.BoxGeometry(0.4, 0.02, 0.56).rotateZ(0.02).translate(-38.4, P + 1.31, 20.8));
  // Concierge-Pult vor den Fahrstühlen
  put('wood', new T.BoxGeometry(1.6, 1.15, 0.8).translate(40, P + 0.58, 5)); put('gold', new T.BoxGeometry(1.75, 0.07, 0.95).translate(40, P + 1.19, 5));
  placeFurn(FURN.tableLamp(0.5), LM, put, 40.5, P + 1.22, 5, 0); glow(40.5, P + 1.6, 5, [1.35, 0.95, 0.5], 0.9);
  col(39.2, 0, 4.6, 40.8, 1.2, 5.4);
  // Etagenanzeiger über den Fahrstühlen: Halbkreis mit Zeiger
  for (const z of [12, 22, 32]) {
    put('lamp', new T.CircleGeometry(0.8, 20, 0, Math.PI).rotateY(-Math.PI / 2).translate(47.68, P + 9.6, z));
    put('gold', new T.TorusGeometry(0.82, 0.06, 6, 20, Math.PI).rotateY(-Math.PI / 2).translate(47.66, P + 9.6, z));
    put('dark', new T.BoxGeometry(0.03, 0.7, 0.05).translate(0, 0.35, 0).rotateX((z - 22) * 0.06).translate(47.62, P + 9.6, z));
  }
  // Gepäckwagen aus Messing mit Koffern und Hutschachteln
  const trolley = (x, z, ry) => {
    const add = (k, geo) => put(k, geo.rotateY(ry).translate(x, P, z));
    add('dark', new T.BoxGeometry(1.0, 0.06, 1.6).translate(0, 0.3, 0));
    add('brass', new T.BoxGeometry(1.06, 0.04, 1.66).translate(0, 0.34, 0));
    for (const sx of [-0.48, 0.48]) for (const sz of [-0.75, 0.75]) add('brass', new T.CylinderGeometry(0.02, 0.02, 1.7, 6).translate(sx, 1.2, sz));
    for (const sx of [-0.48, 0.48]) add('brass', new T.TorusGeometry(0.75, 0.025, 5, 16, Math.PI).translate(0, 2.05, 0).rotateY(Math.PI / 2).translate(sx, 0, 0));
    add('brass', new T.CylinderGeometry(0.025, 0.025, 1.0, 6).rotateZ(Math.PI / 2).translate(0, 1.2, 0.8));
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.65, 0.65]) add('dark', new T.CylinderGeometry(0.12, 0.12, 0.06, 10).rotateZ(Math.PI / 2).translate(sx, 0.12, sz));
    add('leather', new T.BoxGeometry(0.85, 0.32, 0.6).translate(0, 0.53, -0.35)); add('leather2', new T.BoxGeometry(0.8, 0.28, 0.55).translate(0, 0.53, 0.35));
    add('leather2', new T.BoxGeometry(0.62, 0.42, 0.24).translate(0, 0.9, -0.3)); add('brass', new T.BoxGeometry(0.64, 0.03, 0.26).translate(0, 0.9, -0.3));
    add('roseL', new T.CylinderGeometry(0.22, 0.22, 0.3, 14).translate(0.1, 0.84, 0.35)); add('gold', new T.CylinderGeometry(0.225, 0.225, 0.04, 14).translate(0.1, 0.99, 0.35));
    col(x - 0.85, 0, z - 0.85, x + 0.85, 1.2, z + 0.85);
  };
  trolley(-6.2, 41, 0.15); trolley(7, 40.5, -0.4); trolley(43.5, 17, Math.PI / 2);

  // ================= GRAND BALLROOM =================
  // Leuchtbänder unter den Galeriekanten und Lichtschleier darunter
  for (const y of [G1, G2]) {
    put('lamp', new T.BoxGeometry(82, 0.06, 0.08).translate(0, y - 0.72, -13.1));
    for (const sx of [-1, 1]) put('lamp', new T.BoxGeometry(0.08, 0.06, 35).translate(sx * 41.05, y - 0.72, -30.5));
  }
  // Wandleuchten unter den Galerien: an der Westwand über der Bar, an der Ostwand zwischen den Spiegeln, an der Trennwand
  for (const z of [-44, -38, -32, -26, -20]) onWall(wash, 2.4, 4.8, 47.8, P + 5.0, z + 3, -1, 0);   // die V33-Wandleuchten zwischen den Spiegeln
  for (const z of [-15.5, -10]) { sconce(-47.85, P + 5.2, z, 1, 0, 0.9); sconce(47.85, P + 5.2, z, -1, 0, 0.9); }
  for (const x of [-30, -20, 20, 30]) sconce(x, P + 5.0, -6.1, 0, -1, 0.9);
  // auf den Galerien
  for (const y of [G1, G2]) for (const sx of [-1, 1]) for (const z of [-40, -34, -28, -22, -16]) sconce(sx * 47.85, y + 2.4, z, -sx, 0, 0.95);   // V67: größer, hellerer Fächer (Galerien waren fast schwarz)
  // Lichtvouten unter der Decke des Ballsaals
  coveRun(-48, -47.9, 48, -47.9, BALL_H, 0, 1, 8); coveRun(-47.9, -48, -47.9, -6, BALL_H, 1, 0, 8); coveRun(47.9, -48, 47.9, -6, BALL_H, -1, 0, 8); coveRun(-48, -6.1, 48, -6.1, BALL_H, 0, -1, 4);
  // Bühne: warmer Schein auf dem Vorhang (Rampenlicht) und Lichtfächer neben der Musikmuschel
  onWall(wash, 26, 11, 0, P + 7, -47.72, 0, 1);
  for (const sx of [-1, 1]) sconce(sx * 21, P + 6.5, -47.85, 0, 1, 1.3);
  // Bar: Barhocker, Lichtkante am Tresen
  for (let z = -38.5; z <= -19.5; z += 1.5) placeFurn(FURN.barStool(), { up: 'velvet', frame: 'gold' }, put, -42.9, P, z, 0);
  put('lamp', new T.BoxGeometry(0.05, 0.05, 21.6).translate(-43.18, P + 1.12, -29));

  // Lichter für den Lichtpool (die vier nächsten): Empfang, Fahrstühle, Sitzgruppen, Gemälde, Bar, Tischreihen, Bühne
  for (const [x, y, z, i, d] of [[-40, 4, 22, 0.55, 22], [42, 5, 22, 0.5, 22], [-16, 3.5, 34, 0.45, 16], [16, 3.5, 34, 0.45, 16], [-16, 3.5, 10, 0.45, 16], [16, 3.5, 10, 0.45, 16],
    [-29, 9, 1, 0.5, 16], [29, 9, 1, 0.5, 16], [-42, 4, -29, 0.55, 18], [-25, 4, -28, 0.5, 20], [25, 4, -28, 0.5, 20], [0, 5, -38, 0.6, 18], [40, 4, -30, 0.45, 18]]) addLight(0xffc27a, i * 0.72, d, 1.6, x, y, z, true);

  // Stoffe und Blumen für die neuen Netze
  M.leather = stdMat({ color: 0x5a2e16, roughness: 0.55, envI: 0.4 });
  M.leather2 = stdMat({ color: 0x23302a, roughness: 0.6, envI: 0.35 });
  M.bloomL = stdMat({ color: 0xf2e6e0, roughness: 0.7, envI: 0.2, emissive: 0x2a1a18 });
  M.roseL = stdMat({ color: 0x9a1828, roughness: 0.7, envI: 0.2, emissive: 0x200408 });
  const W = new T.Mesh(mergeGeos(wash), washM); W.renderOrder = 2; IG.add(W);
  const Cv = new T.Mesh(mergeGeos(cove), coveM); Cv.renderOrder = 2; IG.add(Cv);
  art.forEach((g, k) => { if (g.length) IG.add(new T.Mesh(mergeGeos(g), artM[k])); });
}
