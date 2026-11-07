/* =====================================================================
   V61 · VERSTECKE DER ANARCHISTEN UNTER DER STADT
   Drei Räume tief unter dem Pflaster (24 m), jeder mit einem Einstieg oben:
   - Die Untergrund-Druckerei (Kellerluke an einem Haus): Druckerpresse,
     Flugblätter, rote Fahne, Plakate "Nieder mit Alexander".
   - Das Kanalgewölbe (offener Gully auf der Straße): Backsteingewölbe mit
     Abwasserrinne, Diebesgut, Goldbarren aus der Bank, Pritschen, Kohlenbecken.
   - Station Nordstern (stillgelegter U-Bahn-Abgang): gekachelte Station mit
     Bahnsteig, Gleisen, altem Salonwagen; das Hauptquartier des Roten
     Kasimir. Dort steht seine Höllenmaschine: eine Uhr, viel Dynamit, ein
     Kabel in den Tunnel zum Belmont. Taste E am Kasten reißt die Zündkabel heraus.
   Gefunden werden sie nacheinander: Gefasste Anarchisten reden (Druckerei),
   in der Druckerei liegt ein Plan (Gewölbe), im Gewölbe ein Brief (Station);
   flieht Kasimir von seiner Barrikade, führt seine Spur ebenfalls dorthin.
   Unten: Taste E an der Leiter (oder Treppe) führt hinauf, oben E am Einstieg
   hinunter. Unten wartet die Bande (Razzia); sind alle abgeführt, ist das
   Versteck ausgehoben. Umschalt+J: alle Verstecke zeigen und zum nächsten gehen.
   Gebaut wird ein Raum erst beim ersten Hinabsteigen (Ladezeit); sichtbar ist
   er nur, solange Alexander unten ist. Keine neuen Shader: Bausatz-Materialien
   (Backstein, Stein, Holz, Eisen), vier gemalte Leinwände; Licht über die
   vier wandernden Lampen (performance.js addLight), keine neuen Lichter.
   ===================================================================== */
import { T, MOBILE, scene, camera, canvasTex, $ } from './core.js';
import { player } from './player.js';
import { pedCrowd } from './serpentine.js';
import { addCollider, nearBoxes, stdMat, glowTex } from './people-skeleton.js';
import { kit, Bx } from './harbour.js';
import { workMats } from './workers.js';
import { lathe } from './entrances.js';
import { DOORS } from './entrances.js';
import { groundAt } from './driving.js';
import { INTERACT, travel } from './music.js';
import { addLight } from './performance.js';
import { spawnProp, LOOSE } from './physics.js';
import { fxEmit } from './particles.js';
import { toast } from './boat.js';
import { UNTER } from './unter-hook.js';
import { GEGNER, GEG, gegnerSay, gegBlastAround, gegFireball } from './gegner.js';
import { BOSS, bossSpawn, bossFree, bossDown, news } from './anfuehrer.js';
import { SND, sndTone } from './audio.js';

const KEY = 'vespera-verstecke';
const DEPTH = -24;
const HP = Math.PI / 2;
export const VERST = { list: [], placed: false, cur: null, hud: null, anarFasst: 0, stats: { razzien: 0, ausgehoben: 0, entschaerft: 0 } };

/* ---------- die drei Verstecke ---------- */
const DEFS = [
  { id: 'druckerei', name: 'Die Untergrund-Druckerei', sub: 'Flugblätter gegen Alexander', kind: 'luke', want: [152, -726], rMax: 140, door: true,
    W: 14, D: 12, ladder: [-6.6, 0], arrive: [-5.5, 0, 0], arriveYaw: -HP, crew: 5,
    clue: 'Auf dem Tisch der Druckerei liegt ein Plan: ein Kanalgewölbe am Hafen, voller Diebesgut' },
  { id: 'gewoelbe', name: 'Das Kanalgewölbe', sub: 'Diebesgut im alten Abwasserkanal', kind: 'gully', want: [40, 455], rMax: 170, road: true,
    W: 9, D: 36, ladder: [-3.4, -17.5], arrive: [-3.4, 0, -16.2], arriveYaw: Math.PI, crew: 5,
    clue: 'Unter den Pritschen ein Brief von Kasimir: "Treffen in der Station Nordstern." Die alte, stillgelegte U-Bahn-Station!' },
  { id: 'station', name: 'Station Nordstern', sub: 'Hauptquartier des Roten Kasimir', kind: 'ubahn', want: [-520, -470], rMax: 220, free: 3.4,
    W: 18, D: 44, ladder: [-5.5, 16.6], arrive: [-5.5, 0.9, 13.6], arriveYaw: 0, crew: 5 },
];

/* ---------- Speichern ---------- */
function load() {
  let S = null; try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { /* ohne Speicher */ }
  for (const H of VERST.list) { H.known = !!(S && S.known && S.known[H.id]); H.cleared = !!(S && S.cleared && S.cleared[H.id]); }
  if (S) { VERST.anarFasst = +S.anarFasst || 0; Object.assign(VERST.stats, S.stats || {}); }
  try { if (new URLSearchParams(location.search).get('verstecke') === 'alle') for (const H of VERST.list) H.known = true; } catch (e) { /* kein location */ }
}
function save() {
  const S = { known: {}, cleared: {}, anarFasst: VERST.anarFasst, stats: VERST.stats };
  for (const H of VERST.list) { if (H.known) S.known[H.id] = 1; if (H.cleared) S.cleared[H.id] = 1; }
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ohne Speicher */ }
}
const byId = id => VERST.list.find(H => H.id === id);

/* ---------- Haken: Boden und "unten?" (player.js, driving.js, performance.js) ---------- */
function inRect(H, x, z, m) { return x > H.x0 - m && x < H.x1 + m && z > H.z0 - m && z < H.z1 + m; }
export function underAt(p) {
  if (p.y > DEPTH + 9 || p.y < DEPTH - 6) return null;
  for (const H of VERST.list) if (H.ok && inRect(H, p.x, p.z, 0.5)) return H;
  return null;
}
function localFloor(H, lx, lz) {
  if (H.id === 'gewoelbe') return Math.abs(lx) < 0.9 && Math.abs(lz) > 0.6 ? -0.35 : 0;
  if (H.id === 'station') return lx < 1.2 ? 0.9 : 0;
  return 0;
}
UNTER.test = p => !!underAt(p);
UNTER.ground = (x, z, y) => {
  if (y < DEPTH - 10) return null;
  for (const H of VERST.list) if (H.ok && inRect(H, x, z, 6)) return { y: H.oy + localFloor(H, x - H.ox, z - H.oz), mu: 0.9, road: false, under: true };
  return null;
};
// Polizei (und Kasimirs Verstärkung) kommen unten über die Leiter
GEGNER.spotHook = (cx, cz) => {
  const H = underAt(player.p); if (!H || !inRect(H, cx, cz, 4)) return undefined;
  const [ax, ay, az] = H.def.arrive, j = () => (Math.random() - 0.5) * 1.2;
  return { x: H.ox + ax + j(), y: H.oy + ay, z: H.oz + az + j(), under: true };
};

/* ---------- Leinwände: Fahne, Plakat, Flugblatt, Stadtplan, Kacheln, Schilder, Uhr ---------- */
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const deco = '"Futura","Century Gothic","Trebuchet MS",sans-serif';
  const flag = canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#8e1712'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,120,90'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    g.fillStyle = '#140707'; g.fillRect(0, h * 0.62, w, h * 0.12);
    g.fillStyle = '#f1e2c4'; g.textAlign = 'center'; g.font = `bold 30px ${deco}`; g.fillText('VESPERA', w / 2, h * 0.36); g.font = `bold 20px ${deco}`; g.fillText('DEM VOLK!', w / 2, h * 0.55);
    g.font = `13px ${deco}`; g.fillStyle = '#e0b6a0'; g.fillText('KEINE GÖTTER · KEINE HERREN', w / 2, h * 0.9);
  });
  const poster = canvasTex(180, 256, (g, w, h) => {
    g.fillStyle = '#d9cfb4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1612'; g.textAlign = 'center'; g.font = `bold 24px ${deco}`; g.fillText('NIEDER', w / 2, 34); g.font = `bold 15px ${deco}`; g.fillText('MIT', w / 2, 52); g.font = `bold 21px ${deco}`; g.fillText('ALEXANDER!', w / 2, 76);
    // Karikatur: Frack, Krone, goldener Kristall in der Hand, rot durchgestrichen
    g.fillStyle = '#16120f'; g.beginPath(); g.moveTo(w / 2 - 34, 230); g.lineTo(w / 2 - 22, 130); g.lineTo(w / 2 + 22, 130); g.lineTo(w / 2 + 34, 230); g.fill();
    g.fillStyle = '#efe6d6'; g.beginPath(); g.moveTo(w / 2 - 8, 130); g.lineTo(w / 2, 168); g.lineTo(w / 2 + 8, 130); g.fill();
    g.fillStyle = '#e9cfae'; g.beginPath(); g.arc(w / 2, 114, 15, 0, 6.28); g.fill();
    g.fillStyle = '#c9a258'; g.beginPath(); g.moveTo(w / 2 - 14, 100); for (let i = 0; i <= 4; i++) { g.lineTo(w / 2 - 14 + i * 7, i % 2 ? 92 : 84); } g.lineTo(w / 2 + 14, 100); g.fill();
    g.fillStyle = '#3fd6c6'; g.beginPath(); g.moveTo(w / 2 + 40, 150); g.lineTo(w / 2 + 48, 162); g.lineTo(w / 2 + 40, 176); g.lineTo(w / 2 + 32, 162); g.fill();
    g.strokeStyle = 'rgba(170,20,15,0.85)'; g.lineWidth = 9; g.beginPath(); g.moveTo(26, 96); g.lineTo(w - 26, 238); g.moveTo(w - 26, 96); g.lineTo(26, 238); g.stroke();
    g.fillStyle = '#7a1a12'; g.font = `11px ${deco}`; g.fillText('DER KRISTALL GEHÖRT ALLEN', w / 2, h - 6);
  });
  const flyer = canvasTex(96, 128, (g, w, h) => {
    g.fillStyle = '#e6dcc4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9a1c14'; g.font = `bold 15px ${deco}`; g.textAlign = 'center'; g.fillText('BÜRGER!', w / 2, 20);
    g.fillStyle = '#2a221c'; for (let y = 30; y < h - 10; y += 7) g.fillRect(10, y, w - 20 - (y % 3) * 6, 2.4);
  });
  const map = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d6c9a6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,45,30,0.55)'; g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(0, 12 + i * 18 + (i % 3) * 3); g.lineTo(w, 8 + i * 18); g.stroke(); g.beginPath(); g.moveTo(10 + i * 18, 0); g.lineTo(14 + i * 18 - (i % 2) * 4, h); g.stroke(); }
    g.strokeStyle = 'rgba(40,90,110,0.7)'; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, h / 2, 118, 0, 6.28); g.stroke();
    g.fillStyle = '#3a2c1e'; g.fillRect(w / 2 - 6, h / 2 - 6, 12, 12);
    g.strokeStyle = '#b5221a'; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, 22, 0, 6.28); g.stroke();
    for (const [x, y] of [[70, 190], [188, 70], [60, 64]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(w / 2 + (x - w / 2) * 0.25, h / 2 + (y - h / 2) * 0.25); g.stroke(); g.fillStyle = '#b5221a'; g.beginPath(); g.arc(x, y, 6, 0, 6.28); g.fill(); }
    g.fillStyle = '#2a1e14'; g.font = `bold 12px ${deco}`; g.textAlign = 'center'; g.fillText('BELMONT', w / 2, h / 2 + 38);
  });
  const tile = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#b8b2a2'; g.fillRect(0, 0, w, h);
    const n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 222 + Math.random() * 18; g.fillStyle = `rgb(${v},${v - 6},${v - 22})`; g.fillRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(i * s + 3, j * s + 3, s - 10, 3); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(70,55,40,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
  });
  const band = canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = '#0f4a4c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9a258'; g.fillRect(0, 2, w, 3); g.fillRect(0, h - 5, w, 3);
    g.beginPath(); for (let x = 0; x <= w; x += 16) { g.lineTo(x, 8); g.lineTo(x + 8, h - 8); } g.lineTo(w, h - 8); g.lineTo(w, 8); g.closePath(); g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
  });
  const sign = canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#0c3537'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a258'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.lineWidth = 1.5; g.strokeRect(13, 13, w - 26, h - 26);
    g.fillStyle = '#f0d58c'; g.textAlign = 'center'; g.font = `bold 50px ${deco}`;
    try { g.letterSpacing = '10px'; } catch (e) { /* ältere Browser */ }
    g.fillText('NORDSTERN', w / 2, 66);
    g.beginPath(); for (const sx of [40, w - 40]) { g.moveTo(sx, 30); g.lineTo(sx + 9, 48); g.lineTo(sx, 66); g.lineTo(sx - 9, 48); g.closePath(); } g.fill();
  });
  const ubahn = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#0c3537'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a258'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#c9a258'; g.beginPath(); g.arc(58, h / 2, 34, 0, 6.28); g.fill(); g.fillStyle = '#0c3537'; g.font = `bold 44px ${deco}`; g.textAlign = 'center'; g.fillText('U', 58, h / 2 + 16);
    g.fillStyle = '#f0d58c'; g.font = `bold 34px ${deco}`; g.textAlign = 'left'; g.fillText('STATION NORDSTERN', 108, 58);
    g.fillStyle = '#b8402e'; g.font = `bold 22px ${deco}`; g.fillText('GESCHLOSSEN SEIT 1919', 110, 96);
  });
  const clock = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#2a2016'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8dcc0'; g.beginPath(); g.arc(w / 2, h / 2, 56, 0, 6.28); g.fill();
    g.strokeStyle = '#2a2016'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g.beginPath(); g.moveTo(w / 2 + Math.sin(a) * 44, h / 2 - Math.cos(a) * 44); g.lineTo(w / 2 + Math.sin(a) * 52, h / 2 - Math.cos(a) * 52); g.stroke(); }
    g.fillStyle = '#9a1c14'; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, 40, -HP, -HP + 1.2); g.closePath(); g.globalAlpha = 0.5; g.fill(); g.globalAlpha = 1;
  });
  for (const t of [tile, band]) { t.wrapS = t.wrapT = T.RepeatWrapping; }
  const M = (map, e = 0.25, o = {}) => stdMat({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: e, roughness: 0.75, envI: 0.25, ...o });
  return TEX = {
    flag: M(flag, 0.22, { side: T.DoubleSide }), poster: M(poster, 0.2), flyer: M(flyer, 0.25, { side: T.DoubleSide }), map: M(map, 0.3), sign: M(sign, 0.55, { roughness: 0.4, envI: 0.6 }), ubahn: M(ubahn, 0.6, { roughness: 0.4, envI: 0.6 }), clock: M(clock, 0.5),
    tiles: stdMat({ vertexColors: true, map: tile, roughness: 0.28, envI: 0.75, emissive: 0xffffff, emissiveMap: tile, emissiveIntensity: 0.05 }),
    band: stdMat({ map: band, roughness: 0.35, envI: 0.7, emissive: 0xffffff, emissiveMap: band, emissiveIntensity: 0.3 }),
    water: stdMat({ color: 0x0b1714, roughness: 0.06, metalness: 0.35, envI: 1.2 }),
    glow: new T.SpriteMaterial({ map: glowTex, color: 0xffb870, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }),
  };
}

/* ---------- Bausteine ---------- */
// Tonnengewölbe: Bögen quer zu x (Breite W), Länge L in z, Kämpfer bei y = 0, Scheitel bei rise; Vorderseite nach unten
function vault(L, W, rise, n = 18) {
  const pos = [], uv = [], idx = [];
  let arc = 0, px = -W / 2, py = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n, x = -W / 2 + u * W, y = rise * Math.sin(Math.PI * u);
    arc += Math.hypot(x - px, y - py); px = x; py = y;
    pos.push(x, y, -L / 2, x, y, L / 2); uv.push(arc / 2, -L / 4, arc / 2, L / 4);
  }
  for (let i = 0; i < n; i++) { const a = i * 2, b = a + 2, c = a + 1, d = a + 3; idx.push(a, b, c, b, d, c); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
const plane = (w, h) => new T.PlaneGeometry(w, h);
// Glühbirne an einer Schnur mit Emailschirm; Lichtschein als Punktsprite, Licht über den Lampenpool
function bulb(K, C, x, yTop, y, z, shade = true) {
  K.add('iron', new T.CylinderGeometry(0.008, 0.008, yTop - y, 4).translate(x, (yTop + y) / 2, z));
  if (shade) K.add('paint', new T.ConeGeometry(0.2, 0.14, 12, 1, true).translate(x, y + 0.08, z), [0.12, 0.26, 0.22]);
  K.add('lit', new T.SphereGeometry(0.06, 8, 6).translate(x, y, z), [1.8, 1.35, 0.8]);
  C.glows.push([x, y - 0.02, z, 0.9]); C.lights.push([x, y - 0.1, z]);
}
function globe(K, C, x, yTop, y, z) {
  K.add('gold', new T.CylinderGeometry(0.012, 0.012, yTop - y, 4).translate(x, (yTop + y) / 2, z));
  K.add('gold', new T.CylinderGeometry(0.09, 0.05, 0.1, 10).translate(x, y + 0.24, z));
  K.add('lit', new T.SphereGeometry(0.22, 14, 10).translate(x, y, z), [1.45, 1.22, 0.86]);
  C.glows.push([x, y, z, 1.6]); C.lights.push([x, y - 0.1, z]);
}
function ladder(K, x, z, nx, nz, y0, y1) {
  const tx = -nz, tz = nx;
  for (const s of [-0.22, 0.22]) K.add('iron', new T.CylinderGeometry(0.025, 0.025, y1 - y0, 6).translate(x + tx * s, (y0 + y1) / 2, z + tz * s));
  for (let y = y0 + 0.3; y < y1; y += 0.3) K.add('iron', new T.CylinderGeometry(0.016, 0.016, 0.44, 5).rotateZ(HP).rotateY(Math.atan2(tx, tz) + HP).translate(x, y, z));
}
function crate(K, C, x, y, z, w = 0.8, h = 0.6, d = 0.6, col = [0.62, 0.48, 0.32]) {
  K.add('plank', Bx(w, h, d, x, y + h / 2, z, 1), col);
  K.add('plank', Bx(w + 0.02, 0.06, d + 0.02, x, y + h * 0.8, z, 1), [col[0] * 0.7, col[1] * 0.7, col[2] * 0.7]);
  C.boxes.push([x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2]);
}
function barrel(K, C, x, y, z, r = 0.32, h = 0.85) {
  K.add('varnish', lathe([[r * 0.85, 0], [r, h * 0.5], [r * 0.85, h]], 12).translate(x, y, z), [0.55, 0.36, 0.22]);
  K.add('iron', new T.CylinderGeometry(r * 0.87, r * 0.87, h, 12, 1, true).scale(1, 0.05, 1).translate(x, y + h * 0.15, z));
  K.add('iron', new T.CylinderGeometry(r * 0.87, r * 0.87, h, 12, 1, true).scale(1, 0.05, 1).translate(x, y + h * 0.85, z));
  C.boxes.push([x - r, y, z - r, x + r, y + h, z + r]);
}
function table(K, C, x, y, z, w, d, h = 0.78, col = [0.42, 0.26, 0.15]) {
  K.add('varnish', Bx(w, 0.06, d, x, y + h, z, 1), col);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add('varnish', Bx(0.06, h, 0.06, x + sx * (w / 2 - 0.08), y + h / 2, z + sz * (d / 2 - 0.08), 1), col);
  C.boxes.push([x - w / 2, y, z - d / 2, x + w / 2, y + h + 0.03, z + d / 2]);
}
function cot(K, C, x, y, z, along = true) {
  const w = along ? 0.8 : 1.9, d = along ? 1.9 : 0.8;
  K.add('iron', Bx(w, 0.05, d, x, y + 0.42, z, 1));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) K.add('iron', Bx(0.04, 0.42, 0.04, x + sx * (w / 2 - 0.03), y + 0.21, z + sz * (d / 2 - 0.03), 1));
  K.add('cloth', Bx(w - 0.08, 0.1, d - 0.08, x, y + 0.5, z, 1), [0.48, 0.44, 0.36]);
  K.add('cloth', Bx(w - 0.04, 0.05, d * 0.55, x, y + 0.57, z + (along ? 0.3 : 0), 1), [0.32, 0.12, 0.1]);
  C.boxes.push([x - w / 2, y, z - d / 2, x + w / 2, y + 0.6, z + d / 2]);
}
// Kasten des Raums: Boden, Wände (lange Seiten bis zum Kämpfer, Stirnseiten bis zum Scheitel), Gewölbe, Rippen
function shell(K, C, o) {
  const { W, D, h, rise, wallK, wallC, floorK, floorC, ribs, ribK, ribC } = o, x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  if (floorK) K.add(floorK, Bx(W, 0.1, D, 0, -0.05, 0, 2), floorC);
  for (const s of [-1, 1]) K.add(wallK, Bx(0.3, h + 0.2, D, s * (W / 2 + 0.15), h / 2 - 0.1, 0, 2), wallC);
  for (const s of [-1, 1]) K.add(wallK, Bx(W + 0.6, h + rise + 0.3, 0.3, 0, (h + rise) / 2 - 0.1, s * (D / 2 + 0.15), 2), wallC);
  K.add(wallK, vault(D, W, rise).translate(0, h, 0), wallC);
  if (ribs) for (let z = z0 + ribs; z < z1 - 0.5; z += ribs) { K.add(ribK, vault(0.36, W - 0.02, rise - 0.02).translate(0, h - 0.06, z), ribC); for (const s of [-1, 1]) K.add(ribK, Bx(0.18, h, 0.42, s * (W / 2 - 0.09), h / 2, z, 1), ribC); }
  // Kollision: Wände, Decke im Scheitel, Schultern (damit die Kamera nicht durch das Gewölbe schaut)
  C.boxes.push([x0 - 1, -0.6, z0 - 1, x0, h + rise + 1, z1 + 1], [x1, -0.6, z0 - 1, x1 + 1, h + rise + 1, z1 + 1], [x0 - 1, -0.6, z0 - 1, x1 + 1, h + rise + 1, z0], [x0 - 1, -0.6, z1, x1 + 1, h + rise + 1, z1 + 1]);
  C.boxes.push([x0 - 1, h + rise - 0.05, z0 - 1, x1 + 1, h + rise + 1, z1 + 1]);
  for (const s of [-1, 1]) C.boxes.push(s < 0 ? [x0 - 0.5, h + rise * 0.55, z0, x0 + W * 0.2, h + rise + 1, z1] : [x1 - W * 0.2, h + rise * 0.55, z0, x1 + 0.5, h + rise + 1, z1]);
}

/* ---------- Die Druckerei ---------- */
function buildDruckerei(K, C, X) {
  const W = 14, D = 12, h = 2.6, rise = 1.1, brick = [0.78, 0.66, 0.6];
  // Gewölbe quer: Bögen über die 12 m (z), Achse in x
  K.add('plank', Bx(W, 0.1, D, 0, -0.05, 0, 2), [0.5, 0.38, 0.28]);
  C.boxes.push([-W / 2 - 1, -1, -D / 2 - 1, W / 2 + 1, 0, D / 2 + 1]);
  for (const s of [-1, 1]) K.add('brick', Bx(W, h + 0.2, 0.3, 0, h / 2 - 0.1, s * (D / 2 + 0.15), 2), brick);
  for (const s of [-1, 1]) K.add('brick', Bx(0.3, h + rise + 0.3, D + 0.6, s * (W / 2 + 0.15), (h + rise) / 2 - 0.1, 0, 2), brick);
  K.add('brick', vault(W, D, rise).rotateY(HP).translate(0, h, 0), brick);
  for (let x = -5; x <= 5; x += 2.5) { K.add('varnish', vault(0.22, D - 0.02, rise - 0.03).rotateY(HP).translate(x, h - 0.08, 0), [0.3, 0.2, 0.13]); for (const s of [-1, 1]) K.add('varnish', Bx(0.22, h, 0.16, x, h / 2, s * (D / 2 - 0.08), 1), [0.3, 0.2, 0.13]); }
  C.boxes.push([-W / 2 - 1, -0.6, -D / 2 - 1, -W / 2, h + rise + 1, D / 2 + 1], [W / 2, -0.6, -D / 2 - 1, W / 2 + 1, h + rise + 1, D / 2 + 1], [-W / 2 - 1, -0.6, -D / 2 - 1, W / 2 + 1, h + rise + 1, -D / 2], [-W / 2 - 1, -0.6, D / 2, W / 2 + 1, h + rise + 1, D / 2 + 1]);
  C.boxes.push([-W / 2 - 1, h + rise - 0.05, -D / 2 - 1, W / 2 + 1, h + rise + 1, D / 2 + 1]);
  for (const s of [-1, 1]) C.boxes.push([-W / 2, h + rise * 0.55, s < 0 ? -D / 2 - 0.5 : D / 2 - D * 0.2, W / 2, h + rise + 1, s < 0 ? -D / 2 + D * 0.2 : D / 2 + 0.5]);
  // Leiter an der Westwand hinauf in den Schacht
  ladder(K, -6.82, 0, 1, 0, 0, h + rise);
  K.add('lit', plane(0.9, 0.9).rotateX(HP).translate(-6.55, h + rise - 0.06, 0), [0, 0, 0]);
  // Druckerpresse
  { const px = 2.5, pz = -3.9, ir = [0.16, 0.17, 0.18];
    K.add('iron', Bx(2.2, 0.5, 1.2, px, 0.25, pz, 1), ir);
    for (const s of [-1, 1]) K.add('iron', Bx(0.16, 1.7, 1.1, px + s * 0.95, 1.1, pz, 1), ir);
    K.add('iron', Bx(2.06, 0.22, 0.5, px, 1.85, pz, 1), ir);
    K.add('paint', Bx(1.6, 0.18, 0.9, px, 0.95, pz, 1), [0.12, 0.24, 0.2]);
    K.add('cloth', Bx(1.2, 0.04, 0.7, px, 0.6, pz + 0.05, 1), [0.86, 0.82, 0.72]);
    K.add('iron', new T.TorusGeometry(0.55, 0.05, 6, 22).rotateY(HP).translate(px + 1.18, 1.0, pz), ir);
    for (let a = 0; a < 6; a++) K.add('iron', Bx(0.03, 1.08, 0.04, px + 1.18, 1.0, pz, 1).rotateX(0).applyMatrix4(new T.Matrix4().makeTranslation(-(px + 1.18), -1.0, -pz)).applyMatrix4(new T.Matrix4().makeRotationX(a * Math.PI / 6)).applyMatrix4(new T.Matrix4().makeTranslation(px + 1.18, 1.0, pz)), ir);
    K.add('gold', new T.CylinderGeometry(0.06, 0.06, 0.1, 8).rotateZ(HP).translate(px + 1.25, 1.0, pz));
    C.boxes.push([px - 1.15, 0, pz - 0.65, px + 1.3, 1.95, pz + 0.65]); }
  // Tische mit Flugblattstapeln, Kartentisch mit dem Plan
  table(K, C, -1.5, 0, 2.8, 2.2, 0.9);
  for (let i = 0; i < 4; i++) K.add('cloth', Bx(0.24, 0.06 + i * 0.03, 0.32, -2.3 + i * 0.5, 0.84 + (0.06 + i * 0.03) / 2, 2.8 + (i % 2) * 0.1, 1), [0.86, 0.82, 0.7]);
  K.add('iron', new T.CylinderGeometry(0.05, 0.05, 0.08, 8).translate(-0.6, 0.85, 3.0), [0.05, 0.05, 0.06]);
  table(K, C, 3.6, 0, 2.6, 1.8, 1.1, 0.8);
  C.planes.push(['map', 1.5, 0.95, 3.6, 0.835, 2.6, 0, -HP, 0]);
  for (const [x, z] of [[2.5, 2.4], [4.7, 2.8]]) { K.add('varnish', Bx(0.42, 0.05, 0.42, x, 0.46, z, 1)); K.add('varnish', Bx(0.42, 0.45, 0.04, x, 0.7, z + (x < 3 ? -0.2 : 0.2), 1)); }
  // Papierballen, Regal mit Druckfarbe, Kisten, Fässer, Pritsche
  for (let i = 0; i < 5; i++) { const x = 5.9 - (i % 2) * 0.1, z = -1.4 + Math.floor(i / 2) * 0.75, y = (i % 2) * 0.62; K.add('cloth', Bx(0.9, 0.6, 0.7, x, y + 0.3, z, 1), [0.8, 0.76, 0.66]); K.add('rope', Bx(0.92, 0.62, 0.04, x, y + 0.3, z, 1), [0.4, 0.3, 0.2]); }
  C.boxes.push([5.4, 0, -1.8, 6.4, 1.25, 0.5]);
  for (let s = 0; s < 3; s++) K.add('varnish', Bx(3, 0.05, 0.4, -2.5, 0.5 + s * 0.6, 5.75, 1), [0.36, 0.22, 0.13]);
  for (let i = 0; i < 9; i++) K.add('paint', new T.CylinderGeometry(0.1, 0.1, 0.22, 10).translate(-3.8 + i * 0.33, 0.64 + (i % 3) * 0.6, 5.72), i % 2 ? [0.5, 0.06, 0.05] : [0.05, 0.05, 0.06]);
  C.boxes.push([-4.1, 0, 5.5, -0.9, 1.9, 6]);
  crate(K, C, -5.6, 0, 4.9); crate(K, C, -5.5, 0.6, 4.95, 0.6, 0.45, 0.5); crate(K, C, 6.1, 0, 4.6, 0.9, 0.7, 0.7);
  barrel(K, C, 6.2, 0, -5.2); barrel(K, C, 5.5, 0, -5.4);
  cot(K, C, -4.2, 0, -4.9, false);
  // Fahne an der Nordwand, Plakate an der Südwand, Flugblätter am Boden
  C.planes.push(['flag', 2.4, 1.5, 0.5, 1.75, D / 2 - 0.02, Math.PI, 0, 0], ['poster', 0.8, 1.14, -2.4, 1.55, -D / 2 + 0.02, 0, 0, 0], ['poster', 0.8, 1.14, 5.0, 1.55, -D / 2 + 0.02, 0, 0, 0], ['poster', 0.8, 1.14, W / 2 - 0.02, 1.55, -3, -HP, 0, 0]);
  for (let i = 0; i < 16; i++) C.planes.push(['flyer', 0.21, 0.29, -4 + Math.random() * 9, 0.006 + i * 0.0004, -3 + Math.random() * 7, Math.random() * 6.28, -HP, 0]);
  // Licht
  bulb(K, C, -2.2, h + rise, h + 0.2, 0); bulb(K, C, 2.8, h + rise, h + 0.2, -1.2); bulb(K, C, 4.2, h + rise, h + 0.3, 2.6);
  X.loose = [['papers', -1.9, 0.84, 2.8], ['papers', -1.1, 0.84, 2.75], ['lantern', -0.3, 0.84, 2.9], ['crate', 4.8, 0, -1.6], ['crate', -6.0, 0, -2.6], ['barrel', 6.2, 0, -4.2], ['bucket', 1.2, 0, -5.2], ['papers', 4.2, 0.84, 2.5]];
  X.spots = [[-1.5, 2.1, 5.3, 0], [2.5, -2.9, 15.3, Math.PI], [5.0, -0.6, 1.2, -HP], [3.6, 1.7, 15.3, 0], [-4.6, 1.6, 12.3, -HP]];
  X.clueAt = [3.6, 2.6];
}

/* ---------- Das Kanalgewölbe ---------- */
function buildGewoelbe(K, C, X) {
  const W = 9, D = 36, h = 2.0, rise = 2.2, brick = [0.62, 0.5, 0.44], stoneC = [0.5, 0.48, 0.44];
  shell(K, C, { W, D, h, rise, wallK: 'brick', wallC: brick, ribs: 4, ribK: 'stone', ribC: stoneC });
  // Gehwege, Rinne mit dunklem Wasser, Bordsteine, Steg
  for (const s of [-1, 1]) { K.add('stone', Bx(3.6, 0.1, D, s * 2.7, -0.05, 0, 2), [0.42, 0.4, 0.37]); K.add('stone', Bx(0.22, 0.38, D, s * 0.98, -0.17, 0, 1), stoneC); }
  K.add('stone', Bx(1.8, 0.1, D, 0, -0.4, 0, 2), [0.2, 0.2, 0.18]);
  C.water = [0, -0.22, 0, 1.76, D - 0.2];
  K.add('plank', Bx(1.0, 0.08, 2.2, 0, 0.0, 0, 1), [0.45, 0.33, 0.22]); for (const s of [-1, 1]) K.add('iron', Bx(0.04, 0.9, 2.2, s * 0.5, 0.45, 0, 1));
  C.boxes.push([-5.6, -1, -D / 2 - 1, -0.9, 0, D / 2 + 1], [0.9, -1, -D / 2 - 1, 5.6, 0, D / 2 + 1], [-0.9, -1, -D / 2 - 1, 0.9, -0.35, D / 2 + 1], [-0.5, -0.35, -0.6, 0.5, 0.0, 0.6]);
  // Leiter am Südende hinauf zum Gully
  ladder(K, -3.4, -D / 2 + 0.18, 0, 1, 0, h + rise * 0.4);
  K.add('lit', plane(1.0, 0.9).rotateX(HP).translate(-3.4, h + rise * 0.36, -D / 2 + 0.45), [0, 0, 0]);
  // Rohre unter dem Gewölbe
  for (const s of [-1, 1]) K.add('iron', new T.CylinderGeometry(0.11, 0.11, D, 8).rotateX(HP).translate(s * 3.9, h + 0.25, 0), [0.22, 0.2, 0.18]);
  // Diebesgut: Kisten mit Stempel, Goldbarren der Bank, Säcke
  for (let i = 0; i < 6; i++) crate(K, C, 3.6 - (i % 2) * 0.1, (i >= 3 ? 0.6 : 0), -5.6 + (i % 3) * 0.8, 0.8, 0.6, 0.7, [0.55, 0.42, 0.28]);
  for (let L = 0; L < 4; L++) for (let i = 0; i < 4 - L; i++) for (let j = 0; j < 3 - (L > 1 ? 1 : 0); j++) K.add('gold', Bx(0.26, 0.08, 0.11, 3.0 + i * 0.28 + L * 0.14, 0.42 + L * 0.085, 3.6 + j * 0.13, 1));
  K.add('plank', Bx(1.3, 0.38, 0.6, 3.4, 0.19, 3.75, 1), [0.42, 0.32, 0.22]); C.boxes.push([2.7, 0, 3.4, 4.1, 0.75, 4.1]);
  for (let i = 0; i < 4; i++) K.add('cloth', new T.SphereGeometry(0.25, 10, 8).scale(1, 1.1, 0.9).translate(3.9, 0.27, 6.0 + i * 0.6), [0.58, 0.5, 0.36]);
  // Lager der Bande: Pritschen, Kartentisch mit Flaschen, Kohlenbecken
  cot(K, C, -3.6, 0, 6.5); cot(K, C, -3.6, 0, 9.4); cot(K, C, 3.6, 0, 11.0);
  table(K, C, -3.2, 0, -6, 1.2, 0.9);
  for (let i = 0; i < 3; i++) K.add('glass', new T.CylinderGeometry(0.04, 0.045, 0.28, 8).translate(-3.5 + i * 0.25, 0.92, -5.85));
  for (let i = 0; i < 5; i++) K.add('cloth', Bx(0.07, 0.004, 0.1, -3.1 + i * 0.09, 0.815, -6.15, 1), [0.9, 0.88, 0.84]);
  K.add('iron', new T.CylinderGeometry(0.3, 0.26, 0.7, 12, 1, true).translate(-2.4, 0.35, 1.5), [0.14, 0.12, 0.1]); K.add('lit', new T.CircleGeometry(0.27, 12).rotateX(-HP).translate(-2.4, 0.6, 1.5), [1.6, 0.6, 0.15]);
  C.boxes.push([-2.72, 0, 1.18, -2.08, 0.72, 1.82]); X.brazier = [-2.4, 0.62, 1.5];
  barrel(K, C, -4.0, 0, -1.0); barrel(K, C, 4.0, 0, -9.5); crate(K, C, -3.8, 0, 13.5);
  // Lampen: Sturmlaternen über der Rinne
  for (const z of [-11, -1, 9]) bulb(K, C, 0, h + rise, h + 1.1, z, false);
  X.loose = [['crate', 3.2, 0, -1.2], ['winecrate', -3.4, 0, -4.4], ['barrel', 3.6, 0, 8.6], ['lantern', -3.1, 0.84, -6.2], ['bucket', -2.0, 0, 3.2], ['crate', -3.8, 0, 3.6]];
  X.spots = [[-3.2, -5.0, 1.2, Math.PI], [-2.6, -7.0, 15.3, 0.4], [3.1, -0.4, 12.3, Math.PI], [3.0, 2.8, 15.3, 0], [-3.4, 8.0, 1.2, Math.PI]];
  X.clueAt = [-3.6, 6.5];
}

/* ---------- Station Nordstern ---------- */
function buildStation(K, C, X) {
  const W = 18, D = 44, h = 4.4, rise = 2.4, PF = 0.9, tileC = [0.8, 0.78, 0.72], dark = [0.25, 0.27, 0.27];
  // Wände gekachelt (eigenes Material), Gewölbe hell verputzt mit Rippen, Bahnsteig, Gleisbett
  for (const s of [-1, 1]) K.add('tiles', Bx(0.3, h + 0.2, D, s * (W / 2 + 0.15), h / 2 - 0.1, 0, 0.6), tileC);
  for (const s of [-1, 1]) K.add('tiles', Bx(W + 0.6, h + rise + 0.3, 0.3, 0, (h + rise) / 2 - 0.1, s * (D / 2 + 0.15), 0.6), tileC);
  K.add('ceil', vault(D, W, rise).translate(0, h, 0), [0.36, 0.34, 0.31]);   // verrußt: seit 1919 geschlossen
  for (let z = -D / 2 + 5.5; z < D / 2 - 1; z += 5.5) K.add('gold', vault(0.14, W - 0.04, rise - 0.03).translate(0, h - 0.04, z));
  C.boxes.push([-W / 2 - 1, -0.6, -D / 2 - 1, -W / 2, h + rise + 1, D / 2 + 1], [W / 2, -0.6, -D / 2 - 1, W / 2 + 1, h + rise + 1, D / 2 + 1], [-W / 2 - 1, -0.6, -D / 2 - 1, W / 2 + 1, h + rise + 1, -D / 2], [-W / 2 - 1, -0.6, D / 2, W / 2 + 1, h + rise + 1, D / 2 + 1]);
  C.boxes.push([-W / 2 - 1, h + rise - 0.05, -D / 2 - 1, W / 2 + 1, h + rise + 1, D / 2 + 1]);
  for (const s of [-1, 1]) C.boxes.push(s < 0 ? [-W / 2 - 0.5, h + rise * 0.55, -D / 2, -W / 2 + W * 0.2, h + rise + 1, D / 2] : [W / 2 - W * 0.2, h + rise * 0.55, -D / 2, W / 2 + 0.5, h + rise + 1, D / 2]);
  C.bands = [[-W / 2 + 0.01, 2.7, 0, D, HP], [W / 2 - 0.01, 2.7, 0, D, -HP]];
  // Bahnsteig (0,9 m hoch) mit Kante, Gleisbett mit Schwellen und Schienen
  K.add('tile', Bx(10.2, PF, D, -3.9, PF / 2, 0, 1.2), [0.8, 0.76, 0.7]);
  K.add('stone', Bx(0.42, 0.05, D, 1.0, PF + 0.025, 0, 1), [0.86, 0.72, 0.36]);
  K.add('stone', Bx(7.8, 0.12, D, 5.1, 0.06, 0, 2), [0.26, 0.25, 0.23]);
  for (let z = -D / 2 + 0.6; z < D / 2; z += 0.75) K.add('plank', Bx(2.4, 0.1, 0.22, 4.9, 0.17, z, 1), [0.3, 0.22, 0.16]);
  for (const x of [4.18, 5.62]) K.add('iron', Bx(0.08, 0.12, D, x, 0.28, 0, 1), [0.42, 0.4, 0.38]);
  C.boxes.push([-W / 2 - 1, -1, -D / 2 - 1, 1.2, PF, D / 2 + 1], [1.2, -1, -D / 2 - 1, W / 2 + 1, 0.12, D / 2 + 1]);
  // Tunnelmünder an beiden Enden, Steinbogen
  for (const s of [-1, 1]) { K.add('lit', plane(6.2, 4.6).rotateY(s < 0 ? 0 : Math.PI).translate(5.1, 2.3, s * (D / 2 - 0.02)), [0, 0, 0]); K.add('stone', Bx(7.2, 0.5, 0.4, 5.1, 4.85, s * (D / 2 - 0.16), 1), [0.4, 0.38, 0.35]); for (const t of [-1, 1]) K.add('stone', Bx(0.5, 4.6, 0.4, 5.1 + t * 3.35, 2.3, s * (D / 2 - 0.16), 1), [0.4, 0.38, 0.35]); }
  // Säulen auf dem Bahnsteig
  for (const z of [-15, -5, 5]) { K.add('paint', new T.CylinderGeometry(0.3, 0.34, h - PF, 14).translate(-0.9, PF + (h - PF) / 2, z), [0.07, 0.28, 0.28]); K.add('gold', new T.CylinderGeometry(0.42, 0.3, 0.3, 14).translate(-0.9, h - 0.15, z)); K.add('gold', new T.CylinderGeometry(0.38, 0.38, 0.1, 14).translate(-0.9, PF + 0.05, z)); C.boxes.push([-1.25, PF, z - 0.35, -0.55, h, z + 0.35]); }
  // Schilder NORDSTERN
  for (const z of [-14, 0, 14]) C.planes.push(['sign', 3.2, 0.6, -W / 2 + 0.03, 2.0, z, HP, 0, 0]);
  for (const z of [-10, 10]) C.planes.push(['sign', 3.2, 0.6, W / 2 - 0.03, 3.3, z, -HP, 0, 0]);
  // Treppe am Nordende hinauf (zum Abgang an der Straße), mit Geländer, oben dunkel
  const n = 12;
  for (let i = 0; i < n; i++) { const z = 15.2 + i * 0.5, y = PF + (i + 1) * 0.29; K.add('stone', Bx(5, y - PF, 0.5, -5.5, PF + (y - PF) / 2, z + 0.25, 1), [0.6, 0.58, 0.54]); C.boxes.push([-8, PF, z, -3, y, z + 0.5]); }
  for (const x of [-8.05, -2.95]) { K.add('iron', Bx(0.05, 0.05, 6.9, 0, 0, 0, 1).rotateX(-0.525).translate(x, PF + 2.74, 18.2)); for (let i = 0; i < 12; i += 3) K.add('iron', Bx(0.035, 1.0, 0.035, x, PF + (i + 1) * 0.29 + 0.5, 15.45 + i * 0.5, 1)); }
  K.add('lit', plane(5, 2.6).rotateY(Math.PI).translate(-5.5, PF + n * 0.29 + 1.2, D / 2 - 0.03), [0, 0, 0]);
  C.boxes.push([-3.05, PF, 15, -2.85, PF + 5, 21.5], [-8.15, PF, 15, -7.95, PF + 5, 21.5]);
  // Salonwagen auf dem Gleis
  { const cx = 4.9, z0 = -15, z1 = -1, cw = 2.7, body = [0.32, 0.07, 0.05], len = z1 - z0, cz = (z0 + z1) / 2;
    K.add('paint', Bx(cw, 2.4, len, cx, 0.45 + 1.2, cz, 1), body);
    K.add('paint', vault(len, cw, 0.5).translate(cx, 2.85, cz), body);
    for (const s of [-1, 1]) { K.add('glass', Bx(0.04, 0.8, len - 1.2, cx + s * (cw / 2 + 0.01), 2.1, cz, 1)); K.add('gold', Bx(0.03, 0.05, len, cx + s * (cw / 2 + 0.02), 1.6, cz, 1)); for (let z = z0 + 1.2; z < z1 - 1; z += 1.6) K.add('paint', Bx(0.05, 0.85, 0.12, cx + s * (cw / 2 + 0.02), 2.1, z, 1), body); }
    for (const z of [z0 + 2, z1 - 2]) K.add('iron', Bx(2.2, 0.4, 1.4, cx, 0.35, z, 1), [0.1, 0.1, 0.1]);
    C.boxes.push([cx - cw / 2 - 0.05, 0, z0, cx + cw / 2 + 0.05, 3.4, z1]); }
  // Die Höllenmaschine: Kasten, Dynamit, Uhr, Kabel zum Südtunnel (Richtung Belmont)
  { const mx = -2.6, mz = -4, y = PF;
    K.add('varnish', Bx(1.0, 0.72, 0.7, mx, y + 0.36, mz, 1), [0.36, 0.24, 0.14]);
    for (let i = 0; i < 8; i++) K.add('paint', new T.CylinderGeometry(0.035, 0.035, 0.42, 8).rotateZ(HP).translate(mx, y + 0.78 + Math.floor(i / 4) * 0.07, mz - 0.22 + (i % 4) * 0.14), [0.62, 0.1, 0.07]);
    K.add('iron', Bx(0.5, 0.06, 0.62, mx, y + 0.78, mz, 1), [0.3, 0.26, 0.2]);
    K.add('gold', new T.TorusGeometry(0.2, 0.025, 6, 20).translate(mx, y + 0.4, mz + 0.36));
    C.planes.push(['clock', 0.36, 0.36, mx, y + 0.4, mz + 0.357, 0, 0, 0]);
    for (const [ax, az, bx, bz] of [[mx + 0.4, mz - 0.3, 0.7, -8], [0.7, -8, 0.7, -21.6]]) { const L = Math.hypot(bx - ax, bz - az); K.add('iron', new T.CylinderGeometry(0.018, 0.018, L, 4).rotateX(HP).rotateY(Math.atan2(bx - ax, bz - az)).translate((ax + bx) / 2, y + 0.03, (az + bz) / 2), [0.5, 0.08, 0.06]); }
    C.boxes.push([mx - 0.55, y, mz - 0.4, mx + 0.55, y + 0.95, mz + 0.4]);
    X.machine = [mx, y, mz]; }
  // Hauptquartier: Kartentisch, Fahnen, Dynamitkisten, Bänke, Ofen
  table(K, C, -6.2, PF, 2.2, 2.6, 1.5, 0.82);
  C.planes.push(['map', 2.2, 1.3, -6.2, PF + 0.855, 2.2, 0, -HP, 0]);
  for (const z of [-7, 7]) C.planes.push(['flag', 2.2, 1.4, -W / 2 + 0.05, 3.2, z, HP, 0, 0]);
  C.planes.push(['poster', 0.8, 1.14, -W / 2 + 0.03, 1.6, -3.0, HP, 0, 0], ['poster', 0.8, 1.14, -W / 2 + 0.03, 1.6, 10.0, HP, 0, 0]);
  for (let i = 0; i < 4; i++) { crate(K, C, -7.8 + (i % 2) * 0.9, PF + (i >= 2 ? 0.6 : 0), -10.5, 0.8, 0.6, 0.6, [0.6, 0.45, 0.3]); }
  for (let i = 0; i < 6; i++) K.add('paint', new T.CylinderGeometry(0.035, 0.035, 0.3, 6).rotateX(HP).translate(-8.05 + i * 0.12, PF + 1.27, -10.5), [0.62, 0.1, 0.07]);
  barrel(K, C, -8.2, PF, -13); barrel(K, C, -7.5, PF, -13.4); crate(K, C, -8.0, PF, 9.5, 0.9, 0.7, 0.7);
  for (const z of [-18, 18 - 6]) { K.add('varnish', Bx(0.5, 0.06, 2.2, -8.3, PF + 0.45, z, 1)); K.add('varnish', Bx(0.5, 0.45, 0.06, -8.3, PF + 0.22, z - 1, 1)); K.add('varnish', Bx(0.5, 0.45, 0.06, -8.3, PF + 0.22, z + 1, 1)); C.boxes.push([-8.6, PF, z - 1.1, -8.0, PF + 0.5, z + 1.1]); }
  cot(K, C, -7.6, PF, -18.5); cot(K, C, -6.2, PF, -18.5);
  // Lampen: Deco-Kugeln über dem Bahnsteig
  for (const z of [-16, -6, 4, 13]) globe(K, C, -4.2, h + rise * 0.82, h - 0.4, z);
  X.loose = [['crate', -5.0, PF, -12.5], ['crate', -1.6, PF, 9.0], ['barrel', -1.8, PF, -16.0], ['dustbin', -7.6, PF, 5.2], ['chair', -5.2, PF, 3.3], ['chair', -7.2, PF, 1.1], ['lantern', -6.6, PF + 0.83, 2.6], ['papers', -5.6, PF + 0.83, 1.9]];
  X.spots = [[-6.0, 3.6, 15.3, Math.PI], [-1.6, -3.2, 12.3, 0.4], [-6.6, -9.4, 5.3, Math.PI], [-1.4, 7.0, 1.2, Math.PI], [-6.8, 11.0, 1.2, Math.PI]];
  X.boss = [-4.2, -2.4, Math.PI * 0.05];
  X.clueAt = [-6.2, 2.2];
}
const BUILD = { druckerei: buildDruckerei, gewoelbe: buildGewoelbe, station: buildStation };
// Einstieg (lokal zum Einstieg): wo man E drückt, wo man oben wieder steht (und wohin man schaut), wohin Umschalt+J führt
const ENTRY = { luke: { use: [0, -1.05], r: 1.3, out: [0, -1.7], outYaw: 0, jump: [0, -3.5] }, gully: { use: [0, 0.8], r: 1.4, out: [0, 1.6], outYaw: Math.PI, jump: [0, 3.5] }, ubahn: { use: [0, 3.3], r: 1.8, out: [0, 4.2], outYaw: Math.PI, jump: [0, 6.5] } };
function entryAt(H, [ux, uz]) { const cs = Math.cos(H.eyaw), sn = Math.sin(H.eyaw); return [H.ex + ux * cs + uz * sn, H.ez - ux * sn + uz * cs]; }

// Raum H an (ox, oy, oz) bauen: Netze, Leinwände, Lichtschein, Kollision (Welt), Lichter
export function buildRoom(H, parent = scene) {
  if (H.group) return H.group;
  const T0 = textures(), K = kit({ brick: workMats().brick, tiles: T0.tiles }), C = { boxes: [], planes: [], glows: [], lights: [], bands: null, water: null }, X = {};
  BUILD[H.id](K, C, X);
  const g = new T.Group(); g.position.set(H.ox, H.oy, H.oz);
  K.build(g);
  // Leinwände (je Art ein Netz)
  const by = {};
  for (const [k, w, hh, x, y, z, ry, rx, rz] of C.planes) (by[k] ||= []).push(plane(w, hh).rotateX(rx || 0).rotateZ(rz || 0).rotateY(ry || 0).translate(x, y, z));
  for (const k in by) { const geo = by[k].length > 1 ? mergeList(by[k]) : by[k][0]; g.add(new T.Mesh(geo, T0[k])); }
  if (C.bands) for (const [x, y, z, len, ry] of C.bands) { const p = plane(len, 0.32); const uv = p.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 2.2); g.add(new T.Mesh(p.rotateY(ry).translate(x, y, z), T0.band)); }
  if (C.water) { const [x, y, z, w, d] = C.water; g.add(new T.Mesh(plane(w, d).rotateX(-HP).translate(x, y, z), T0.water)); }
  for (const [x, y, z, s] of C.glows) { const sp = new T.Sprite(T0.glow); sp.position.set(x, y, z); sp.scale.setScalar(s); g.add(sp); }
  parent.add(g); H.group = g;
  if (!H.lab) {
    for (const b of C.boxes) addCollider(H.ox + b[0], H.oy + b[1], H.oz + b[2], H.ox + b[3], H.oy + b[4], H.oz + b[5]);
    for (const [x, y, z] of C.lights) addLight(H.id === 'station' ? 0xffd7a0 : 0xffb35c, H.id === 'station' ? 1.9 : 1.9, H.id === 'station' ? 16 : 12, 1.6, H.ox + x, H.oy + y, H.oz + z);
  }
  H.X = X; H.C = C;
  return g;
}
function mergeList(list) {
  const geos = list.map(q => q.index ? q.toNonIndexed() : q);
  const n = geos.reduce((s, q) => s + q.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0; for (const q of geos) { pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); uv.set(q.attributes.uv.array, o * 2); o += q.attributes.position.count; }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); return m;
}

/* ---------- Einstiege oben: Kellerluke, Gully, U-Bahn-Abgang ---------- */
export function buildEntry(H, parent = scene) {
  const K = kit(), T0 = textures(), g = new T.Group(), ir = [0.12, 0.12, 0.13], C = [];
  g.position.set(H.ex, H.ey, H.ez); g.rotation.y = H.eyaw || 0;
  if (H.kind === 'luke') {
    K.add('iron', Bx(1.4, 0.08, 1.4, 0, 0.04, 0, 1), ir);
    K.add('lit', plane(1.12, 1.12).rotateX(-HP).translate(0, 0.085, 0), [0, 0, 0]);
    // zwei Flügel stehen offen an der Hauswand (lokal +z), Leiterholme ragen aus dem Schacht, ein roter Lappen als Zeichen
    K.add('iron', Bx(0.56, 1.12, 0.05, -0.28, 0.64, 0.6, 1), ir); K.add('iron', Bx(0.56, 1.12, 0.05, 0.28, 0.64, 0.6, 1), ir);
    for (const s of [-0.22, 0.22]) K.add('iron', new T.CylinderGeometry(0.025, 0.025, 0.7, 6).translate(s, 0.4, -0.42), ir);
    K.add('iron', new T.CylinderGeometry(0.02, 0.02, 0.44, 5).rotateZ(HP).translate(0, 0.72, -0.42), ir);
    K.add('cloth', plane(0.22, 0.32).rotateY(Math.PI).translate(0.45, 0.95, 0.57), [0.62, 0.06, 0.05]);
    C.push([-0.6, 0, 0.52, 0.6, 1.2, 0.68]);
  } else if (H.kind === 'gully') {
    K.add('iron', new T.TorusGeometry(0.42, 0.06, 6, 20).rotateX(HP).scale(1, 0.6, 1).translate(0, 0.03, 0), ir);
    K.add('lit', new T.CircleGeometry(0.4, 18).rotateX(-HP).translate(0, 0.045, 0), [0, 0, 0]);
    K.add('iron', new T.CylinderGeometry(0.42, 0.42, 0.05, 18).rotateX(0.18).translate(0.85, 0.06, 0.25), [0.2, 0.2, 0.21]);
    for (const s of [-0.18, 0.18]) K.add('iron', new T.CylinderGeometry(0.022, 0.022, 0.6, 6).translate(s, 0.3, -0.3), ir);
    K.add('iron', new T.CylinderGeometry(0.06, 0.07, 0.24, 8).translate(-0.7, 0.12, 0.3), [0.18, 0.16, 0.12]); K.add('lit', new T.SphereGeometry(0.05, 8, 6).translate(-0.7, 0.2, 0.3), [1.6, 1.0, 0.45]);
    K.add('cloth', plane(0.18, 0.26).translate(0.18, 0.5, -0.3), [0.62, 0.06, 0.05]);
  } else {
    // U-Bahn-Abgang: dunkle Öffnung 2,4 x 5 m, Geländer an drei Seiten, Schildbogen über dem offenen Ende, Bretter
    K.add('stone', Bx(3.0, 0.14, 5.6, 0, 0.07, 0, 1), [0.42, 0.4, 0.38]);
    K.add('lit', plane(2.4, 5.0).rotateX(-HP).translate(0, 0.145, 0), [0, 0, 0]);
    for (let i = 0; i < 3; i++) K.add('stone', Bx(2.4, 0.04, 0.32, 0, 0.13 - i * 0.002, 2.34 - i * 0.34, 1), [0.3 - i * 0.08, 0.29 - i * 0.08, 0.27 - i * 0.08]);
    for (const s of [-1, 1]) { K.add('iron', Bx(0.06, 0.06, 5.0, s * 1.25, 1.05, -0.05, 1), ir); for (let z = -2.4; z <= 2.4; z += 0.4) K.add('iron', Bx(0.035, 0.95, 0.035, s * 1.25, 0.6, z, 1), ir); C.push([s * 1.25 - 0.08, 0, -2.6, s * 1.25 + 0.08, 1.1, 2.5]); }
    K.add('iron', Bx(2.56, 0.06, 0.06, 0, 1.05, -2.5, 1), ir); for (let x = -1.2; x <= 1.2; x += 0.4) K.add('iron', Bx(0.035, 0.95, 0.035, x, 0.6, -2.5, 1), ir); C.push([-1.3, 0, -2.58, 1.3, 1.1, -2.42]);
    for (const s of [-1, 1]) { K.add('paint', Bx(0.14, 2.7, 0.14, s * 1.3, 1.35, 2.55, 1), [0.06, 0.24, 0.24]); K.add('gold', new T.SphereGeometry(0.11, 10, 8).translate(s * 1.3, 2.78, 2.55)); C.push([s * 1.3 - 0.1, 0, 2.45, s * 1.3 + 0.1, 2.8, 2.65]); }
    C.planes = [['ubahn', 2.5, 0.62, 0, 2.3, 2.62, 0, 0, 0], ['ubahn', 2.5, 0.62, 0, 2.3, 2.48, Math.PI, 0, 0]];
    // Bretter: eins hängt nur noch an einem Nagel
    K.add('plank', Bx(2.7, 0.18, 0.04, 0, 0.9, 2.58, 1).rotateZ(0), [0.42, 0.3, 0.2]);
    { const b = Bx(1.5, 0.18, 0.04, 0, 0, 0, 1); b.rotateZ(-1.1).translate(-0.8, 0.95, 2.6); K.add('plank', b, [0.4, 0.28, 0.18]); }
    K.add('cloth', plane(0.3, 0.45).translate(1.05, 1.6, 2.64), [0.62, 0.06, 0.05]);
    K.add('lit', new T.SphereGeometry(0.09, 8, 6).translate(0, 2.0, 2.6), [1.5, 1.2, 0.7]);
  }
  K.build(g);
  if (C.planes) for (const [k, w, hh, x, y, z, ry] of C.planes) g.add(new T.Mesh(plane(w, hh).rotateY(ry).translate(x, y, z), T0[k]));
  if (!H.lab) {
    const cs = Math.cos(H.eyaw || 0), sn = Math.sin(H.eyaw || 0);
    for (const b of C) { if (!b.length) continue; const pts = [[b[0], b[2]], [b[3], b[2]], [b[0], b[5]], [b[3], b[5]]].map(([x, z]) => [H.ex + x * cs + z * sn, H.ez - x * sn + z * cs]); addCollider(Math.min(...pts.map(q => q[0])), H.ey + b[1], Math.min(...pts.map(q => q[1])), Math.max(...pts.map(q => q[0])), H.ey + b[4], Math.max(...pts.map(q => q[1]))); }
  }
  parent.add(g); H.entry = g; g.visible = !!H.known || !!H.lab;
  return g;
}

/* ---------- Plätze für die Einstiege suchen (einmal, wenn die Stadt steht) ---------- */
function freeAt(x, z, y, hx, hz) {
  for (const b of nearBoxes(x, z, Math.max(hx, hz) + 1)) {
    if (b.x1 < x - hx || b.x0 > x + hx || b.z1 < z - hz || b.z0 > z + hz) continue;
    if (b.y1 < y + 0.12 || b.y0 > y + 14) continue;   // auch nichts darüber (Vordach, Decke, Brücke)
    return false;
  }
  return true;
}
function placeAll() {
  VERST.placed = true;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const H of VERST.list) {
    const d = H.def; let s = null;
    if (d.door) {
      // Kellerluke vor einem Wohnhaus oder einer Werkstatt, gleich neben der Tür an der Mauer
      const cands = DOORS.filter(q => (q.kind === 'house' || q.kind === 'workshop') && Math.hypot(q.x - d.want[0], q.z - d.want[1]) < d.rMax).sort((a, b) => Math.hypot(a.x - d.want[0], a.z - d.want[1]) - Math.hypot(b.x - d.want[0], b.z - d.want[1]));
      for (const q of cands) {
        if (Math.hypot(q.x - d.want[0], q.z - d.want[1]) < 18) continue;   // nicht mitten auf dem Kneipenplatz
        for (const side of [1, -1]) {
          const x = q.x + q.nx * 1.0 - q.nz * 1.9 * side, z = q.z + q.nz * 1.0 + q.nx * 1.9 * side, g = groundAt(x, z, 1.2);
          if (!g || g.y < -0.3 || g.y > 0.6 || g.via || g.ice || !freeAt(x, z, g.y, 0.75, 0.75)) continue;
          s = { x, y: g.y, z, yaw: Math.atan2(-q.nx, -q.nz) }; break;
        }
        if (s) break;
      }
    } else {
      const need = d.free || 1.0;
      for (let i = 0; i < 900 && !s; i++) {
        const r = (i / 900) * d.rMax, a = rnd() * 6.2832, x = d.want[0] + Math.sin(a) * r, z = d.want[1] + Math.cos(a) * r, g = groundAt(x, z, 1.2);
        if (!g || g.y < -0.3 || g.y > 0.6 || g.via || g.ice || g.grass && d.road) continue;
        if (d.road ? !g.road : g.road) continue;
        if (!freeAt(x, z, g.y, need, need + (H.kind === 'ubahn' ? 1.4 : 0))) continue;
        // Raum darunter: nicht unter einem anderen Versteck
        s = { x, y: g.y, z, yaw: 0 };
      }
    }
    if (!s) { H.ok = false; continue; }
    H.ok = true; H.ex = s.x; H.ey = s.y; H.ez = s.z; H.eyaw = s.yaw;
    const [lx, lz] = d.ladder;
    H.ox = s.x - lx; H.oy = DEPTH; H.oz = s.z - lz;
    H.x0 = H.ox - d.W / 2; H.x1 = H.ox + d.W / 2; H.z0 = H.oz - d.D / 2; H.z1 = H.oz + d.D / 2;
    buildEntry(H);
    // hinunter
    INTERACT.push({ test: p => H.known && p.y > -3 && p.y < H.ey + 2.5 && Math.hypot(p.x - H.useX, p.z - H.useZ) < ENTRY[H.kind].r, get label() { return (H.kind === 'ubahn' ? 'Die Treppe hinunter' : H.kind === 'gully' ? 'In den Gully hinabsteigen' : 'Durch die Kellerluke hinab') + ' · ' + H.name + (H.cleared ? ' (ausgehoben)' : ''); }, act: () => enter(H) });
    [H.useX, H.useZ] = entryAt(H, ENTRY[H.kind].use);
    // hinauf
    const [ax, az] = d.ladder;
    INTERACT.push({ test: p => underAt(p) === H && Math.hypot(p.x - (H.ox + ax), p.z - (H.oz + az)) < (H.kind === 'ubahn' ? 2.6 : 1.5), label: (H.kind === 'ubahn' ? 'Die Treppe hinauf' : 'Die Leiter hinauf') + ' · zurück auf die Straße', act: () => leave(H) });
    // Höllenmaschine
    if (H.id === 'station') INTERACT.push({ test: p => underAt(p) === H && H.X && H.mach && !H.mach.done && Math.hypot(p.x - H.mach.x, p.z - H.mach.z) < 1.9, get label() { return H.mach.t != null ? 'Zündkabel herausreißen · noch ' + Math.ceil(H.mach.t) + ' s' : 'Die Höllenmaschine entschärfen (Zündkabel herausreißen)'; }, act: () => defuse(H) });
  }
}

/* ---------- Hinunter, hinauf ---------- */
function enter(H) {
  buildRoom(H);
  // ein laufendes Ereignis oben bricht ab (die Gauner verschwinden in der Menge)
  const E = GEGNER.ev;
  if (E) { for (const pd of E.crooks || []) if (['fight', 'flee', 'script', 'hold'].includes(pd.gg.s)) GEG.off(pd); GEG.end(E, 0.4); }
  const [ax, ay, az] = H.def.arrive;
  VERST.cur = H; H.pending = 1;
  travel([H.ox + ax, H.oy + ay + 0.05, H.oz + az], H.def.arriveYaw, -0.05, H.name + ' · ' + H.def.sub);
}
function leave(H) {
  const [x, z] = entryAt(H, ENTRY[H.kind].out);
  travel([x, H.ey + 0.05, z], H.eyaw + ENTRY[H.kind].outYaw, 0.02, 'Zurück auf der Straße');
}
function spawnLoose(H) {
  if (H.looseB && H.looseB.some(B => LOOSE.bodies.indexOf(B) >= 0)) return;
  H.looseB = [];
  for (const [k, x, y, z] of H.X.loose || []) { const B = spawnProp(k, H.ox + x, H.oy + y, H.oz + z, Math.random() * 6.28); if (B) H.looseB.push(B); }
}

/* ---------- Razzia (und Showdown mit Kasimir in der Station) ---------- */
function startRaid(H) {
  spawnLoose(H);
  if (H.cleared || GEGNER.ev) return null;
  const A = GEG.free('anarchist'), withBoss = H.id === 'station' && bossFree();
  const E = { label: (withBoss ? 'Showdown · ' : 'Razzia · ') + H.name, crooks: [], H, ph: 'calm', type: withBoss ? 'showdown' : 'razzia' };
  const n = Math.min(A.length, MOBILE ? 4 : H.def.crew);
  for (let i = 0; i < n; i++) {
    const [lx, lz, act, yaw] = H.X.spots[i % H.X.spots.length], pd = A[i], x = H.ox + lx, z = H.oz + lz, y = H.oy + localFloor(H, lx, lz);
    GEG.spawn(pd, x, y, z, yaw); GEG.act(pd, act);
    Object.assign(pd.gg, { ev: E, s: 'script', gun: i === 1 || i === 4, want: 6 + Math.random() * 4, cd: 1.2 + i * 0.5 });
    E.crooks.push(pd);
  }
  if (withBoss) {
    const [bx, bz, byaw] = H.X.boss, y = H.oy + localFloor(H, bx, bz);
    bossSpawn(H.ox + bx, y, H.oz + bz, byaw, E, { intro: 3.4, want: 9 }); E.boss = BOSS.pd;
    H.mach = { x: H.ox + H.X.machine[0], y: H.oy + H.X.machine[1], z: H.oz + H.X.machine[2], t: null, done: false };
  } else if (H.id === 'station') H.mach = null;
  if (!E.crooks.length && !E.boss) return null;
  E.where = () => { let x = 0, z = 0, m = 0; for (const pd of [...E.crooks, ...(E.boss ? [E.boss] : [])]) if (pd.gg.s !== 'off') { const P = GEG.pos(pd); x += P[0]; z += P[1]; m++; } return m ? [x / m, z / m] : [H.ox, H.oz]; };
  E.onDown = (pd, how) => { if (pd === E.boss) { bossDown(pd, E); if (pd.gg.hp <= 2 && H.mach && H.mach.t == null && !H.mach.done) armMachine(H); } };
  E.step = dt => raidStep(E, H, dt);
  E.t = 0; GEGNER.ev = E; GEGNER.stats.ereignisse++; VERST.stats.razzien++;
  return E;
}
function alarm(E, H) {
  if (E.ph !== 'calm') return;
  E.ph = 'fight';
  const S = E.crooks.find(pd => pd.gg.s === 'script');
  if (S) gegnerSay('Ein Anarchist', pick(['Alarm! Alexander ist hier unten!', 'Verdammt, er hat uns gefunden!', 'Genossen, zu den Waffen! Der Herr von Vespera!', 'Wie kommt der hier runter?!', 'Hier unten bezahlt er keine Miete, Genossen! Aber wir!']), 3, S.gg.x, S.gg.z);
  for (const pd of E.crooks) if (pd.gg.s === 'script') { pd.gg.s = 'fight'; pd.gg.gm = null; }
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function raidStep(E, H, dt) {
  const p = player.p, B = E.boss;
  // Alexander geht wieder hinauf, bevor alle gefasst sind: die übrigen bleiben unten (nächstes Mal wieder da)
  if (underAt(p) !== H) {
    if ((E.away = (E.away || 0) + dt) > 1.0) {
      for (const pd of E.crooks) if (['fight', 'script', 'flee', 'getup'].includes(pd.gg.s)) GEG.off(pd);
      if (B && ['fight', 'script', 'flee', 'getup'].includes(B.gg.s)) GEG.off(B);
      if (H.mach && H.mach.t != null && !H.mach.done) H.mach.t = null;   // Kasimir hält die Uhr an: er will Alexander dabeihaben
      GEG.end(E, 0.5); VERST.cur = null;
    }
    return;
  }
  E.away = 0;
  if (E.ph === 'calm') {
    for (const pd of E.crooks) if (pd.gg.s === 'script') GEG.place(pd);
    const near = E.crooks.some(pd => Math.hypot(pd.gg.x - p.x, pd.gg.z - p.z) < 8);
    if (E.t > 2.2 || near || E.crooks.some(pd => pd.gg.s === 'down' || pd.rag)) alarm(E, H);
  }
  if (B && B.gg.s === 'script') {
    GEG.face(B, p.x, p.z, dt); GEG.place(B);
    if (!E.introSaid && E.t > 0.6) { E.introSaid = true; gegnerSay('Der Rote Kasimir', pick(['Willkommen in der Station Nordstern, Alexander. Hier unten bist du nur ein Mann im Frack.', 'Siehst du den Kasten dort? Die Ladung reicht für das ganze Belmont!', 'Du kommst spät, Herr von Vespera. Aber nicht zu spät für die Vorstellung.', 'Hier unten, Alexander, wohnen die, die du vergessen hast. Sieh dich gut um.']), 3, B.gg.x, B.gg.z); }
    if ((B.gg.introT -= dt) <= 0) { B.gg.s = 'fight'; GEG.act(B, 13.1); alarm(E, H); }
  }
  // Höllenmaschine: tickt, sobald Kasimir halb besiegt ist (oder nach 50 s Kampf)
  const M = H.mach;
  if (M && !M.done) {
    if (M.t == null && B && E.t > 50 && B.gg.s !== 'off') armMachine(H);
    if (M.t != null) {
      M.t -= dt;
      E.label = 'Höllenmaschine · ' + Math.max(0, Math.ceil(M.t)) + ' s · Taste E am Kasten';
      if ((M.tick = (M.tick || 0) - dt) <= 0) { M.tick = M.t < 10 ? 0.5 : 1; tick(M); }
      if (M.t <= 0) machineBoom(H);
    }
  } else if (E.type === 'showdown') E.label = 'Showdown · ' + H.name;
  if (H.X.brazier && Math.random() < dt * 14) { const [bx, by, bz] = H.X.brazier; fxEmit('ember', H.ox + bx + (Math.random() - 0.5) * 0.4, H.oy + by, H.oz + bz + (Math.random() - 0.5) * 0.4, 0, 1.2, 0, 1, 0.08, 0.9); }
  // alle abgeführt: ausgehoben
  const all = [...E.crooks, ...(B ? [B] : [])];
  if (all.every(pd => pd.gg.s === 'off') && E.t > 3) {
    if (all.some(pd => pd.gg.hp > 0 && pd === B)) { GEG.end(E); return; }   // (Kasimir weg, ohne gefasst zu sein: nicht ausgehoben)
    H.cleared = true; VERST.stats.ausgehoben++; save();
    toast('Versteck ausgehoben: ' + H.name);
    news('Versteck ausgehoben: ' + H.name, H.def.sub + ': Alexander und die Polizei heben ein Versteck der Anarchisten unter der Stadt aus.', H.id === 'station' ? 8 : 7);
    GEG.fire('versteck', null, H.ex, H.ez, { id: H.id, name: H.name });
    if (H.def.clue) setTimeout(() => clue(H), 3500);
    GEG.end(E, 0.6);
  }
}
function clue(H) {
  const i = VERST.list.indexOf(H), N = VERST.list.slice(i + 1).find(q => q.ok && !q.known);
  if (!N) return;
  toast(H.def.clue);
  setTimeout(() => reveal(N, null), 3200);
}
export function reveal(H, why) {
  if (!H || !H.ok || H.known) return false;
  H.known = true; save();
  if (H.entry) H.entry.visible = true;
  if (why) gegnerSay('Ein Polizist', why, 3);
  toast('Neues Versteck entdeckt: ' + H.name + ' · der Pfeil oben zeigt den Weg');
  return true;
}
function tick(M) {
  if (!SND.on || !SND.ctx) return;
  try { const t = SND.ctx.currentTime, k = Math.max(0, 1 - Math.hypot(M.x - player.p.x, M.z - player.p.z) / 40); sndTone(M.t < 10 ? 1900 : 1300, t, 0.05, 0.06 * k, 'square', 'sfx', 1200); } catch (e) { /* Ton ist Beiwerk */ }
}
function armMachine(H) {
  const M = H.mach; if (!M || M.t != null || M.done) return;
  M.t = MOBILE ? 95 : 80;
  gegnerSay('Der Rote Kasimir', pick(['Die Uhr läuft! Gleich fliegt dein Belmont in die Luft!', 'Wenn ich falle, fällt dein Hotel mit mir!', 'Achtzig Sekunden, Alexander! Tick, tack!']), 3);
  toast('Die Höllenmaschine tickt! Taste E am Kasten reißt die Zündkabel heraus');
}
function defuse(H) {
  const M = H.mach; if (!M || M.done) return;
  M.done = 'entschaerft'; M.t = null; VERST.stats.entschaerft++; GEGNER.stats.entschaerft++; save();
  fxEmit('spark', M.x, M.y + 0.8, M.z, 0, 2, 0, 24, 0.3, 1.2); fxEmit('crystal', M.x, M.y + 0.9, M.z, 0, 1.5, 0, 14, 0.4, 1);
  GEG.snd('fizz', M.x, M.z, 1);
  toast('Alexander reißt die Zündkabel heraus. Die Uhr steht still, das Belmont ist sicher');
  news('Anschlag auf das Belmont vereitelt', 'Unter der Stadt entschärft Alexander eine Höllenmaschine, die das Grand Hotel sprengen sollte.', 9);
  const B = BOSS.pd; if (B && B.gg.s === 'fight') gegnerSay('Der Rote Kasimir', pick(['Nein! Mein Meisterstück!', 'Das … das kann nicht sein!', 'Dann eben mit bloßen Händen!']), 3, B.gg.x, B.gg.z);
  GEG.fire('entschaerft', null, M.x, M.z, { what: 'hoellenmaschine' });
}
function machineBoom(H) {
  const M = H.mach; M.done = 'knall'; M.t = null; GEGNER.stats.explodiert++;
  gegFireball(M.x, M.y + 0.6, M.z, 2.2, true);
  gegBlastAround(M.x, M.y, M.z, 16, 1.3);
  for (let i = 0; i < 4; i++) fxEmit('dust', H.ox + (Math.random() - 0.5) * 14, H.oy + 5, H.oz + (Math.random() - 0.5) * 30, 0, -1, 0, 10, 2, 1.6);
  toast('Die Höllenmaschine explodiert! Alexander steht im Staub, ohne Kratzer. Der Tunnel zum Belmont ist eingestürzt, das Hotel blieb heil');
  GEG.fire('knall', null, M.x, M.z, { what: 'hoellenmaschine' });
}

/* ---------- Hinweis oben: nächstes bekanntes Versteck ---------- */
const _f = new T.Vector3();
function hud() {
  let el = VERST.hud;
  const p = player.p, under = underAt(p);
  let best = null, bd = 1e9;
  if (!GEGNER.ev && !under) for (const H of VERST.list) if (H.ok && H.known && !H.cleared) { const d = Math.hypot(H.ex - p.x, H.ez - p.z); if (d < bd) { bd = d; best = H; } }
  if (!best) { if (el && el.style.opacity !== '0') el.style.opacity = 0; return; }
  if (!el) {
    const st = document.createElement('style');
    st.textContent = '#versteck{position:fixed;z-index:9;left:50%;top:calc(62px + env(safe-area-inset-top,0px));transform:translateX(-50%);padding:5px 14px 4px;background:var(--panel,rgba(5,16,24,.72));border:1px solid rgba(214,174,96,.45);color:var(--ink,#efe6d2);font-size:12px;letter-spacing:.12em;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .4s}#versteck i{display:inline-block;font-style:normal;color:#e8b070;margin-right:8px}#versteck b{color:var(--gold-hi,#f6dc9a);font-weight:600}';
    document.head.appendChild(st);
    el = VERST.hud = document.createElement('div'); el.id = 'versteck'; el.className = 'hud'; document.body.appendChild(el);
    el.innerHTML = '<i>▲</i>Versteck · <b></b><span></span>';
  }
  const f = camera.getWorldDirection(_f), dx = best.ex - p.x, dz = best.ez - p.z;
  const rel = Math.atan2(dx * -f.z + dz * f.x, dx * f.x + dz * f.z);
  el.children[0].style.transform = 'rotate(' + (rel * 57.3).toFixed(0) + 'deg)';
  el.children[1].textContent = best.name; el.children[2].textContent = ' · ' + Math.round(bd) + ' m';
  el.style.opacity = 1;
}

/* ---------- Jedes Bild ---------- */
function update(dt) {
  if (!pedCrowd) return;
  if (!VERST.placed) { tasten(); placeAll(); if (BOSS.st === 'gefasst' && byId('station')) { /* im Gefängnis: die Station bleibt, wie sie ist */ } }
  const p = player.p, under = underAt(p), cam = camera.position;
  BOSS.inHQ = !!(byId('station') && byId('station').known && !byId('station').cleared && BOSS.st === 'frei');
  for (const H of VERST.list) {
    if (H.group) H.group.visible = !!under && under === H || (cam.y < DEPTH + 9 && inRect(H, cam.x, cam.z, 2));
    if (H.entry) H.entry.visible = H.known && Math.hypot(H.ex - cam.x, H.ez - cam.z) < 420;
  }
  // gerade hinuntergestiegen: Razzia beginnt, sobald Alexander unten steht
  const C = VERST.cur;
  if (C && C.pending && under === C) { C.pending = 0; startRaid(C); }
  if (C && C.pending && !under && (C.pending += dt) > 3) C.pending = 0;   // (Abstieg abgebrochen)
  if (!under && VERST.cur && !GEGNER.ev && !VERST.cur.pending) VERST.cur = null;
  hud();
}
function onGegner(d) {
  if (d.was === 'gefasst' && d.role === 'anarchist' && !underAt(player.p)) {
    VERST.anarFasst++; save();
    const H = byId('druckerei');
    if (H && !H.known && VERST.anarFasst >= 2) setTimeout(() => reveal(H, pick(['Er hat geredet, Herr Alexander! Die Bande druckt ihre Flugblätter in einem Keller im Arbeiterviertel.', 'Der Kerl hat ausgepackt: eine geheime Druckerei, unter einem Haus im Arbeiterviertel!'])), 2600);
  }
}
BOSS.onEscape = () => { const H = byId('station'); if (H && !H.known) reveal(H, 'Wir sind seiner Spur gefolgt: Kasimir ist in den alten U-Bahn-Abgang zur Station Nordstern gestiegen!'); };
BOSS.onBreakout = () => { const H = byId('station'); if (H && H.cleared) { H.cleared = false; H.mach = null; save(); } };
BOSS.onCaught = () => { /* Station bleibt besetzt, bis die Razzia sie aushebt */ };

// Tastenübersicht im Pausenmenü (eigener Teil des Spiels, hört auf 'vespera-tasten')
function tasten() {
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'Gegner', tasten: [
    { k: ['J'], t: 'Ärger in der Nähe', d: 'Sofort das nächste Ereignis: Überfall, Taschendieb, Bombe, Angriff, Aufstand, Bombenserie, Bankraub' },
    { k: ['Umschalt', 'J'], t: 'Verstecke', d: 'Alle Verstecke der Anarchisten zeigen und zum nächsten gehen' },
    { k: ['E'], t: 'Hinab und hinauf', d: 'Am Einstieg hinunter ins Versteck, an Leiter oder Treppe wieder hinauf; an der Höllenmaschine die Zündkabel herausreißen' },
  ] } })); } catch (e) { /* ohne Menü */ }
}
/* ---------- Umschalt+J: alle Verstecke zeigen und zum nächsten gehen ---------- */
if (typeof window !== 'undefined') window.addEventListener('keydown', e => {
  if (e.code !== 'KeyJ' || !e.shiftKey || e.repeat || !pedCrowd || !VERST.placed) return;
  if (underAt(player.p)) { toast('Erst wieder hinaufsteigen (Taste E an der Leiter)'); return; }
  for (const H of VERST.list) if (H.ok) { H.known = true; if (H.entry) H.entry.visible = true; }
  save();
  const p = player.p, L = VERST.list.filter(H => H.ok).sort((a, b) => (a.cleared - b.cleared) || (Math.hypot(a.ex - p.x, a.ez - p.z) - Math.hypot(b.ex - p.x, b.ez - p.z)));
  const H = L[0]; if (!H) { toast('Keine Verstecke gefunden'); return; }
  const [x, z] = entryAt(H, ENTRY[H.kind].jump);
  travel([x, H.ey + 0.05, z], H.eyaw + ENTRY[H.kind].outYaw + Math.PI, 0.05, 'Vor dem Versteck: ' + H.name + ' · Taste E steigt hinab');
});

for (const d of DEFS) VERST.list.push({ id: d.id, name: d.name, kind: d.kind, def: d, ok: false, known: false, cleared: false });
load();
GEGNER.hooks.push(update);
GEGNER.listen.push(onGegner);
export { DEFS, startRaid, DEPTH };
