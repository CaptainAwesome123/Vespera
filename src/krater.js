/* =====================================================================
   V78 · DER KRATER AUSSERHALB DER STADT
   Draußen am Kraterrand, hinter der Felswand über dem See, liegt, was von
   Alexanders Expedition 1919 geblieben ist:
   - Das alte Expeditionslager (Lager Nordstern) auf dem Rand: Zelte, Schlitten,
     ein offener Vorratsschuppen mit Kartentisch, der Fahnenmast, ein Steinmann
     mit der Gedenktafel des Polarclubs (und dem, was jemand darunter geritzt hat),
     am Felsrand der Claim-Pflock mit Blick auf die Stadt.
   - Zwei Gletscherhöhlen in den Gletschertälern im Westen (landscape.js):
     die Blaue Grotte (Eisdom mit gefrorenem Wasserfall) und die Kristallspalte
     (enger Riss, dahinter die Kammer, in der die ersten Splitter lagen).
     Taste E am Eistor: hinein (Abblende wie bei den Verstecken), E am Ausgang: hinaus.
     Die Höhlen liegen unsichtbar 60 m unter dem Tor und werden erst beim
     ersten Betreten gebaut; sichtbar nur, solange Alexander drinnen ist.
   - Zwölf Fundstücke: Tagebuchseiten, Ausrüstung der fünf Expeditionsmitglieder,
     drei Meteoritensplitter. Die Splitter glimmen, geben aber keine Kraft
     (Kanon: nur der Kern, nur Alexander, und der Kristall bleibt im Penthouse).
     Die Texte erzählen die Expedition nicht als Heldensage: Alexander bezahlte,
     drängte, schwieg und behielt am Ende den Krater.
   - Sind alle zwölf gefunden, entscheidet Alexander am Steinmann, wem sie
     gehören: dem Stadtmuseum, seiner Vitrine im Penthouse oder dem Polarclub.
   Anbindung: Stadtkarte (Lager und Höhlen als Orte mit Schnellreise),
   Inventar (Umschalt+I, Reiter "Krater"), Ruf, Kurier, Pausenmenü.
   Leistung: keine neuen Lichter (Lampen-Pool), ein neues Material (Eis),
   alles über kit() zusammengefasst; Lager nur bis 900 m, Funde bis 160 m sichtbar.
   ===================================================================== */
import { T, scene, camera } from './core.js';
import { terrainHeight, VILLA, kit, Bx, LAND_HOOK } from './harbour.js';
import { WATER_Y } from './dance.js';
import { SERP, sstep } from './serpentine.js';
import { LAND, landRay, shoreAt, landAvoid } from './landscape.js';
import { stdMat, addCollider, glowTex } from './people-skeleton.js';
import { INTERACT, travel } from './music.js';
import { openChoice } from './venues.js';
import { addLight } from './performance.js';
import { player } from './player.js';
import { toast } from './boat.js';
import { UNTER } from './unter-hook.js';
import { KT } from './kontor.js';
import { KARTE } from './karte.js';
import { INV_EXTRA } from './inventar.js';
import { rufAdd } from './ruf.js';
import { zeitungMeldung } from './zeitung.js';
import { SND, sndTone } from './audio.js';

const KEY = 'vespera-krater', CAVE_Y = -60, HP = Math.PI / 2;
export const KR = { placed: false, lab: false, camp: null, caves: [], finds: [], s: { f: {}, seen: {}, wahl: null }, card: null, cardT: 0, hintT: 0, stats: {} };

/* ---------- Die zwölf Fundstücke ---------- */
// wo: 'lager' (Ortskoordinaten im Lager), 'blau'/'spalte' (in der Höhle), 'pflock'/'glocke' (draußen, eigener Platz)
export const FUNDE = [
  { id: 'tagebuch', wo: 'lager', at: [-6.2, 1.0, -0.6], n: 'Alexanders Tagebuch, 3. März 1919', h: 'Im Vorratsschuppen des alten Lagers, auf dem Kartentisch.', m: 'buch',
    t: '„Brekke sagt, wir müssen umkehren, die Hunde sind am Ende. Ich habe ihm den doppelten Lohn geboten, wenn wir noch zwei Tage gehen. Er hat angenommen. Jeder nimmt an, wenn man genug bietet.“' },
  { id: 'wimpel', wo: 'lager', at: [0.8, 0.02, -7.4], n: 'Der Wimpel der Nordstern-Expedition', h: 'Am Fahnenmast des alten Lagers.', m: 'wimpel',
    t: 'Blau mit einem goldenen Stern, von der Eisluft zerfranst. Fünf Namen sind auf die Rückseite gestickt. Auf der neuen Fahne, die ein Jahr später über der Baustelle wehte, stand nur noch ein V.' },
  { id: 'sextant', wo: 'lager', at: [7.6, 0.5, -4.4], n: 'Kapitän Brekkes Sextant', h: 'Auf einem der Schlitten im alten Lager.', m: 'sextant',
    t: 'Nils Brekke führte die Schlitten über das Eis. Später kaufte Alexander ihm seinen Anteil am Fund ab, für eine Summe, von der Brekke nie wieder arbeiten musste. Im Polarclub reden die beiden bis heute nur über das Wetter.' },
  { id: 'fotoplatte', wo: 'lager', at: [4.2, 0.03, 6.7], n: 'Wendts Fotoplatte', h: 'Vor einem der Zelte des alten Lagers.', m: 'platte',
    t: 'Paul Wendt fotografierte alles. Auf dieser Glasplatte stehen alle fünf am Kraterrand, Arm in Arm. Auf den Abzügen, die später im Kurier erschienen, stand Alexander allein.' },
  { id: 'pflock', wo: 'pflock', n: 'Der Claim-Pflock', h: 'Draußen am Felsrand, unterhalb des alten Lagers, mit Blick auf die Stadt.', m: 'pflock',
    t: 'Ein Eisenpflock mit Messingschild: „Claim A. · 1919“. Damit steckte Alexander seinen Anspruch ab, als hier nichts war als Eis. Heute leuchtet unten eine Stadt, die ihm gehört, und viele, die darin wohnen, fragen sich, ob ein Pflock dafür genügt.' },
  { id: 'glocke', wo: 'glocke', n: 'Die Schlittenglocke', h: 'Oben auf dem großen Gletscher im Westen, wo die Schlitten über das Eis kamen.', m: 'glocke',
    t: 'Die Messingglocke vom Leitschlitten. Sie läutete, damit im Schneesturm keiner verloren ging. Einmal, sagt Brekke, ging trotzdem einer verloren: der Hund Tor, Wendts Liebling. Alexander ließ nicht anhalten.' },
  { id: 'pickel', wo: 'blau', at: [5.6, 1.4, 18.5], n: 'Halvorsens Eispickel', h: 'In der Blauen Grotte, in der Eiswand des Doms.', m: 'pickel',
    t: 'Eingraviert: „I. H., Bergen 1912“. Dr. Ingrid Halvorsen war die Geologin der Expedition und die Erste, die verstand, dass dieser Krater kein Vulkan war.' },
  { id: 'feldbuch', wo: 'blau', at: [-2.1, 0.61, 9.6], n: 'Halvorsens Feldbuch', h: 'In der Blauen Grotte, auf einer Kiste am Eingang.', m: 'buch',
    t: '„Die Splitter geben Wärme ab, ohne zu schmelzen. Ich muss die Akademie in Oslo unterrichten. A. sagt: noch nicht. A. sagt immer: noch nicht.“ Die Akademie erfuhr es aus der Zeitung, sechs Jahre später.' },
  { id: 'splitterBlau', wo: 'blau', at: [0.6, 0.7, 29.2], n: 'Ein blauer Meteoritensplitter', h: 'Ganz hinten in der Blauen Grotte, wo das Eis leuchtet.', m: 'splitter',
    t: 'Ein Splitter vom Rand des Einschlags. Er glimmt kalt und blau, aber er gibt keine Kraft. Die gab nur der Kern, und nur dem, der ihn als Erster berührte.' },
  { id: 'funk', wo: 'spalte', at: [3.0, 0.51, 33.6], n: 'Saalfelds Funkgerät', h: 'In der Kristallspalte, in der Kammer am Ende.', m: 'funk',
    t: 'Der Funker Emil Saalfeld hatte die letzte Meldung schon getippt: „Fund gemacht. Erbitten Anweisung.“ Sie wurde nie gesendet. Alexander ließ das Gerät abschalten. Die Batterien, sagte er, brauche man für die Lampen.' },
  { id: 'kompass', wo: 'spalte', at: [-1.6, 0.06, 36.4], n: 'Alexanders Taschenkompass', h: 'In der Kristallspalte, vor den großen Splittern.', m: 'kompass',
    t: 'Die Nadel zeigt nicht nach Norden. Seit 1919 zeigt sie zur Mitte des Kraters, dorthin, wo der Kern lag und heute das Belmont steht. Alexander hat ihn hier liegen lassen. Er brauchte keinen Kompass mehr.' },
  { id: 'splitterViolett', wo: 'spalte', at: [2.6, 1.1, 39.6], n: 'Der violette Splitter', h: 'In der Kristallspalte, im Eis über der Splitterkammer.', m: 'splitter2',
    t: 'Hier lagen die ersten Splitter, und ihr Leuchten wies der Expedition den Weg zur Mitte des Kraters. Dieser ist größer als die anderen und schimmert violett. Kraft gibt auch er keine. Ein Sammler in Paris würde trotzdem ein Vermögen bieten.' },
];
const TAFEL = 'An dieser Stelle erblickte ALEXANDER, Gründer der Stadt Vespera, am 4. März 1919 den Krater. · Gestiftet vom Polarclub.';
const GERITZT = 'Darunter, mit einem Messer ins Messing geritzt: „Und Brekke. Und Halvorsen. Und Wendt. Und Saalfeld. Wir waren auch da.“';

/* ---------- Speichern ---------- */
function load() { try { const S = JSON.parse(localStorage.getItem(KEY) || 'null'); if (S) { KR.s.f = S.f || {}; KR.s.seen = S.seen || {}; KR.s.wahl = S.wahl || null; } } catch (e) { /* ohne Speicher */ } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(KR.s)); } catch (e) { /* ohne Speicher */ } }
export const kraterFound = id => !!KR.s.f[id];
export const kraterCount = () => FUNDE.filter(F => KR.s.f[F.id]).length;
const day = () => (KT.s && KT.s.day) || 1;

/* ---------- Kleine Rauschfunktion für Eis ---------- */
const hsh = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hsh(ix, iy), b = hsh(ix + 1, iy), c = hsh(ix, iy + 1), d = hsh(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }

/* ---------- Material: Eis (eins für Höhlen und Tore) ---------- */
let ICE = null;
export function iceMat() { return ICE ||= stdMat({ vertexColors: true, roughness: 0.16, metalness: 0, flatShading: true, emissive: 0x08303a, envI: 1.3 }); }
function colorize(g, fn) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3); g.setAttribute('color', new T.BufferAttribute(c, 3)); return g; }
const iceCol = (x, y, z, k = 1) => { const n = vnoise(x * 0.45 + z * 0.2, y * 0.6 + z * 0.31); const t = Math.min(1, Math.max(0, n * 1.2 - 0.1)); return [(0.05 + 0.3 * t) * k, (0.24 + 0.55 * t) * k, (0.36 + 0.5 * t) * k]; };

// Höhle als Röhre entlang z mit "Perlen" [z, rx, ry]: Querschnitt halbe Ellipse (etwas unter den Boden gezogen), Rauschen nach innen/außen,
// Dreiecke zeigen nach innen; am Anfang und Ende ein Deckel
function tubeGeo(beads, seed) {
  const z0 = beads[0][0], z1 = beads[beads.length - 1][0], NA = 30, pos = [], col = [], idx = [];
  const rad = z => { let i = 0; while (i < beads.length - 2 && beads[i + 1][0] < z) i++; const A = beads[i], B = beads[i + 1]; let t = (z - A[0]) / (B[0] - A[0] || 1); t = Math.max(0, Math.min(1, t)); t = t * t * (3 - 2 * t); return [A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
  const NZ = Math.ceil((z1 - z0) / 0.6);
  for (let i = 0; i <= NZ; i++) {
    const z = z0 + (z1 - z0) * i / NZ, [rx, ry] = rad(z);
    for (let j = 0; j <= NA; j++) {
      const th = -0.2 * Math.PI + j / NA * 1.4 * Math.PI, n = 1 + 0.16 * (vnoise(th * 2.3 + seed, z * 0.35) - 0.5) + 0.07 * (vnoise(th * 7 + seed, z * 1.1) - 0.5);
      const x = rx * Math.cos(th) * n, y = ry * Math.sin(th) * n;
      pos.push(x, y, z); col.push(...(y < 0.5 ? [0.36, 0.52, 0.6] : iceCol(x, y, z, 0.8 + 0.4 * Math.min(1, y / ry))));
    }
  }
  const W = NA + 1;
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  // Deckel vorn (Blick nach +z: nach innen heißt Normale +z) und hinten
  for (const [i, s] of [[0, 1], [NZ, -1]]) {
    const z = z0 + (z1 - z0) * i / NZ, base = pos.length / 3; pos.push(0, 0.6, z + s * 0.2); col.push(0.1, 0.3, 0.42);
    for (let j = 0; j < NA; j++) { const a = i * W + j; if (s > 0) idx.push(base, a + 1, a); else idx.push(base, a, a + 1); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); g.userData.rad = rad; return g;
}
// Eiszapfen und Säulen: Kegel mit Rauschfarbe
function cone(r, h, x, y, z) { const g = new T.ConeGeometry(r, h, 6, 1, false).rotateX(Math.PI).translate(x, y - h / 2, z); return colorize(g, (a, b, c) => iceCol(a, b, c, 1.1)); }
// Eis-Formen mit eigenen Farben zusammenfassen (kit() würde die Farben überschreiben)
function iceMesh(list) {
  const geos = list.map(g => g.index ? g.toNonIndexed() : g), n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('color', new T.BufferAttribute(col, 3));
  return new T.Mesh(m, iceMat());
}
function shard(K, x, y, z, s, col, rx = 0, rz = 0) { K.add('lit', new T.OctahedronGeometry(s, 0).scale(0.45, 1.6, 0.45).rotateX(rx).rotateZ(rz).translate(x, y, z), col); }

/* ---------- Fundstück-Formen (klein, über kit) ---------- */
function findShape(K, m) {
  const br = [0.5, 0.36, 0.2], wood = [0.42, 0.3, 0.2], ir = [0.15, 0.15, 0.16];
  if (m === 'buch') { K.add('leather', Bx(0.24, 0.05, 0.32, 0, 0.025, 0, 1), [0.32, 0.12, 0.08]); K.add('cloth', Bx(0.22, 0.04, 0.3, 0.012, 0.025, 0, 1), [0.86, 0.8, 0.66]); }
  else if (m === 'wimpel') { K.add('cloth', new T.PlaneGeometry(0.9, 0.5).rotateX(-HP).translate(0, 0.02, 0), [0.1, 0.22, 0.42]); K.add('gold', new T.CircleGeometry(0.12, 5).rotateX(-HP).translate(-0.15, 0.03, 0)); K.add('plank', Bx(1.2, 0.05, 0.05, 0.1, 0.03, 0.27, 1), wood); }
  else if (m === 'sextant') { K.add('gold', new T.TorusGeometry(0.16, 0.012, 4, 12, Math.PI / 3).rotateZ(Math.PI * 1.33).translate(0, 0.2, 0)); K.add('gold', Bx(0.02, 0.2, 0.02, 0, 0.1, 0, 1)); K.add('gold', Bx(0.02, 0.18, 0.02, 0.08, 0.1, 0, 1).rotateZ(0.5)); K.add('varnish', Bx(0.28, 0.04, 0.2, 0, 0.02, 0, 1), [0.35, 0.18, 0.1]); }
  else if (m === 'platte') { K.add('glass', Bx(0.24, 0.01, 0.18, 0, 0.012, 0, 1)); K.add('varnish', Bx(0.28, 0.08, 0.22, 0.32, 0.04, 0, 1), [0.3, 0.16, 0.08]); }
  else if (m === 'pflock') { K.add('iron', new T.CylinderGeometry(0.05, 0.02, 1.2, 6).translate(0, 0.45, 0), ir); K.add('gold', Bx(0.22, 0.14, 0.02, 0, 0.75, 0.05, 1)); }
  else if (m === 'glocke') { K.add('gold', new T.CylinderGeometry(0.06, 0.13, 0.18, 10, 1, true).translate(0, 0.12, 0)); K.add('leather', Bx(0.5, 0.02, 0.05, 0.25, 0.02, 0, 1), [0.3, 0.16, 0.08]); }
  else if (m === 'pickel') { K.add('plank', new T.CylinderGeometry(0.025, 0.025, 0.85, 6).rotateZ(HP).translate(-0.42, 0, 0), wood); K.add('iron', Bx(0.05, 0.36, 0.04, 0.02, 0, 0, 1), ir); }
  else if (m === 'funk') { K.add('varnish', Bx(0.5, 0.36, 0.3, 0, 0.18, 0, 1), [0.24, 0.14, 0.08]); K.add('iron', Bx(0.42, 0.22, 0.02, 0, 0.2, 0.16, 1), [0.08, 0.08, 0.08]); for (const x of [-0.12, 0, 0.12]) K.add('gold', new T.CylinderGeometry(0.025, 0.025, 0.03, 8).rotateX(HP).translate(x, 0.2, 0.18)); K.add('iron', new T.CylinderGeometry(0.008, 0.008, 0.7, 4).translate(0.2, 0.7, -0.1), ir); }
  else if (m === 'kompass') { K.add('gold', new T.CylinderGeometry(0.06, 0.06, 0.025, 14).translate(0, 0.013, 0)); K.add('cloth', new T.CircleGeometry(0.05, 14).rotateX(-HP).translate(0, 0.027, 0), [0.9, 0.86, 0.74]); K.add('lit', Bx(0.008, 0.004, 0.08, 0, 0.03, 0, 1).rotateY(0.8), [0.8, 0.1, 0.08]); }
  else if (m === 'splitter') shard(K, 0, 0.2, 0, 0.16, [0.4, 1.4, 1.6], 0.3, 0.2);
  else if (m === 'splitter2') { shard(K, 0, 0.3, 0, 0.24, [1.1, 0.55, 1.7], -0.2, 0.25); shard(K, 0.12, 0.2, 0.05, 0.12, [0.9, 0.5, 1.5], 0.5, -0.6); }
}

/* ---------- Platz suchen ---------- */
const inSerp = (x, z, m = 80) => { const P = SERP.patch; return !!P && x > P.x0 - m && x < P.x1 + m && z > P.z0 - m && z < P.z1 + m; };
function flatness(x, z, r) { let lo = 1e9, hi = -1e9; for (let k = 0; k < 9; k++) { const a = k / 8 * 6.283, rr = k === 8 ? 0 : r; const h = terrainHeight(x + Math.cos(a) * rr, z + Math.sin(a) * rr); lo = Math.min(lo, h); hi = Math.max(hi, h); } return [hi - lo, lo, hi]; }
function okSpot(x, z) {
  if (landAvoid(x, z) || inSerp(x, z) || (Math.abs(x) < 120 && z < -900)) return false;
  if (VILLA.y && Math.hypot(x - VILLA.x, z - VILLA.z) < VILLA.r + 300) return false;
  return true;
}
function findCamp() {
  let best = null;
  for (const a of [-0.84, -0.74, -0.95, -0.65, -1.05, 0.62, 0.8, -1.6, -1.9, 2.4, -2.4]) {
    const mS = shoreAt(a);
    for (let m = mS + 70; m < mS + 330; m += 12) {
      const [x, z] = landRay(a, m); if (!okSpot(x, z)) continue;
      const [rg, lo] = flatness(x, z, 13); if (lo < WATER_Y + 18) continue;
      const sc = rg + (m - mS) * 0.004;
      if (!best || sc < best.sc) best = { a, m, x, z, sc, rg };
    }
    if (best && best.rg < 2.5) break;
  }
  return best;
}

// Beim Planen der Landschaft (vor Gelände und Bäumen): Platz fürs Lager suchen, dort das Gelände sanft ebnen, keine Bäume
function kraterPlan() {
  const S = findCamp(); if (!S) return;
  let h0 = 0; for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; h0 += terrainHeight(S.x + Math.cos(a) * 9, S.z + Math.sin(a) * 9) / 8; }
  KR.site = S; S.h0 = h0;
  const C0 = LAND_HOOK.carve, A0 = LAND_HOOK.avoid;
  LAND_HOOK.carve = (x, z, h) => { if (C0) h = C0(x, z, h); const d2 = (x - S.x) ** 2 + (z - S.z) ** 2; if (d2 > 900) return h; return h0 + (h - h0) * sstep(13, 30, Math.sqrt(d2)); };
  LAND_HOOK.avoid = (x, z) => (A0 && A0(x, z)) || (x - S.x) ** 2 + (z - S.z) ** 2 < 34 * 34;
}
LAND.planHooks.push(kraterPlan);

/* ---------- Das alte Lager ---------- */
function buildCamp(S) {
  // Lager achsparallel (Kollision als Quader); vorn (+z örtlich) = zum Krater hin, auf 90° gerundet
  const fx = -Math.sin(S.a), fz = Math.cos(S.a), yaw = Math.round(Math.atan2(fx, fz) / HP) * HP;
  const C = KR.camp = { x: S.x, z: S.z, y: terrainHeight(S.x, S.z), yaw, a: S.a, cs: Math.cos(yaw), sn: Math.sin(yaw) };
  C.w = (lx, lz) => [C.x + lx * C.cs + lz * C.sn, C.z - lx * C.sn + lz * C.cs];
  C.gy = (lx, lz) => { const [x, z] = C.w(lx, lz); return terrainHeight(x, z) - C.y; };
  const K = kit(), cloth = [0.62, 0.56, 0.44], wood = [0.42, 0.3, 0.2], snow = [0.82, 0.86, 0.92], ir = [0.14, 0.14, 0.15], boxes = [], lights = [];
  const box = (lx0, y0, lz0, lx1, y1, lz1) => boxes.push([lx0, y0, lz0, lx1, y1, lz1]);
  // Vorratsschuppen: drei Wände aus Brettern, Pultdach, offen zur Lagermitte (+x), Kartentisch, Kisten, Laterne
  { const X = -6.5, Z = 0, g = C.gy(X, Z);
    K.add('plank', Bx(0.14, 2.6, 4.6, X - 2.1, g + 1.2, Z, 2), wood); box(X - 2.25, g - 1, Z - 2.3, X - 1.95, g + 2.6, Z + 2.3);
    for (const s of [-1, 1]) { K.add('plank', Bx(4.2, 2.4, 0.14, X, g + 1.1, Z + s * 2.3, 2), wood); box(X - 2.2, g - 1, Z + s * 2.3 - 0.12, X + 2.0, g + 2.5, Z + s * 2.3 + 0.12); }
    K.add('plank', Bx(4.8, 0.12, 5.2, X - 0.1, g + 2.55, Z, 2).rotateZ(-0.12), [0.34, 0.24, 0.16]);
    K.add('cloth', Bx(4.9, 0.18, 5.3, X - 0.1, g + 2.7, Z, 2).rotateZ(-0.12), snow);
    K.add('plank', Bx(1.6, 0.06, 0.9, X + 0.3, g + 0.95, Z - 0.6, 1), [0.48, 0.34, 0.22]);   // Kartentisch
    for (const [dx, dz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) K.add('plank', Bx(0.06, 0.92, 0.06, X + 0.3 + dx * 1.2, g + 0.46, Z - 0.6 + dz, 1), wood);
    K.add('cloth', new T.PlaneGeometry(1.0, 0.7).rotateX(-HP).rotateY(0.15).translate(X + 0.1, g + 0.99, Z - 0.55), [0.84, 0.78, 0.6]);   // Karte
    box(X - 0.5, g - 1, Z - 1.05, X + 1.1, g + 1.0, Z - 0.15);
    for (const [dx, dz, h] of [[-1.4, 1.6, 0.6], [-1.4, 0.9, 0.6], [-1.45, 1.25, 1.2], [-0.6, 1.7, 0.5]]) K.add('plank', Bx(0.7, 0.55, 0.6, X + dx, g + h - 0.27, Z + dz, 1), [0.5, 0.38, 0.24]);
    box(X - 1.8, g - 1, Z + 0.55, X - 0.25, g + 1.3, Z + 2.0);
    K.add('iron', new T.CylinderGeometry(0.1, 0.12, 0.28, 8).translate(X + 0.9, g + 1.12, Z - 0.8), ir); K.add('lit', new T.SphereGeometry(0.07, 8, 6).translate(X + 0.9, g + 1.14, Z - 0.8), [1.6, 1.05, 0.5]);
    lights.push([X + 0.9, g + 1.6, Z - 0.8]);
  }
  // Zelte: Firstzelte aus Segeltuch mit Schneehaube
  for (const [X, Z, r] of [[3.8, 4.6, 0], [7.4, 1.2, 0.4], [2.6, -4.2, -0.3]]) {
    const g = C.gy(X, Z), L = 3.2, W = 2.4, H = 1.8, sh = new T.BufferGeometry();
    const P = [-W / 2, 0, -L / 2, 0, H, -L / 2, W / 2, 0, -L / 2, -W / 2, 0, L / 2, 0, H, L / 2, W / 2, 0, L / 2];
    sh.setAttribute('position', new T.Float32BufferAttribute(P, 3)); sh.setIndex([0, 1, 4, 0, 4, 3, 2, 5, 4, 2, 4, 1, 0, 2, 1, 3, 4, 5]); sh.computeVertexNormals();
    K.add('cloth', sh.rotateY(r).translate(X, g, Z), cloth);
    K.add('cloth', new T.BoxGeometry(0.5, 0.08, L * 0.9).rotateY(r).translate(X, g + H + 0.02, Z), snow);
    K.add('lit', new T.PlaneGeometry(0.7, 1.1).translate(0, 0.55, L / 2 + 0.01).rotateY(r).translate(X, g, Z), [0.03, 0.025, 0.02]);
    K.add('plank', Bx(0.06, H + 0.3, 0.06, 0, H / 2, L / 2 + 0.05, 1).rotateY(r).translate(X, g, Z), wood);
    box(X - 1.3, g - 1, Z - 1.7, X + 1.3, g + H, Z + 1.7);
  }
  // Schlitten mit Kisten, Fässer
  for (const [X, Z, r] of [[7.6, -4.4, 0.2], [-1.6, 6.2, -0.9]]) {
    const g = C.gy(X, Z);
    for (const sd of [-0.42, 0.42]) K.add('plank', Bx(0.06, 0.06, 2.6, sd, 0.08, 0, 1).rotateY(r).translate(X, g, Z), wood);
    for (let k = -1; k <= 1; k += 0.25) K.add('plank', Bx(0.95, 0.04, 0.12, 0, 0.45, k, 1).rotateY(r).translate(X, g, Z), [0.5, 0.36, 0.22]);
    for (const k of [-1, 0, 1]) for (const sd of [-0.42, 0.42]) K.add('plank', Bx(0.05, 0.38, 0.05, sd, 0.26, k, 1).rotateY(r).translate(X, g, Z), wood);
    K.add('plank', Bx(0.7, 0.4, 0.6, 0, 0.67, -0.6, 1).rotateY(r).translate(X, g, Z), [0.52, 0.4, 0.26]);
    K.add('cloth', Bx(0.75, 0.06, 0.65, 0, 0.9, -0.6, 1).rotateY(r).translate(X, g, Z), snow);
    box(X - 0.9, g - 1, Z - 1.4, X + 0.9, g + 0.9, Z + 1.4);
  }
  for (const [X, Z] of [[-3.2, -3.4], [-2.6, -3.9], [-3.6, -4.2]]) { const g = C.gy(X, Z); K.add('iron', new T.CylinderGeometry(0.3, 0.3, 0.85, 10).translate(X, g + 0.42, Z), [0.24, 0.18, 0.12]); K.add('cloth', new T.CylinderGeometry(0.31, 0.31, 0.06, 10).translate(X, g + 0.87, Z), snow); }
  box(-4.0, C.gy(-3.2, -3.8) - 1, -4.6, -2.2, C.gy(-3.2, -3.8) + 0.9, -3.0);
  // Fahnenmast mit zerfetztem Wimpel, Theodolit am Rand, Steinmann mit Gedenktafel und zwei Sturmlaternen
  { const X = 0, Z = -7, g = C.gy(X, Z); K.add('plank', new T.CylinderGeometry(0.07, 0.1, 7.5, 8).translate(X, g + 3.75, Z), [0.38, 0.28, 0.18]); K.add('gold', new T.SphereGeometry(0.12, 8, 6).translate(X, g + 7.55, Z));
    const f = new T.PlaneGeometry(1.6, 0.7, 6, 2), p = f.attributes.position; for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + 0.8) / 1.6; p.setZ(i, Math.sin(u * 5) * 0.12 * u); if (u > 0.7) p.setY(i, p.getY(i) * (1 - (u - 0.7) * 1.2)); }
    K.add('cloth', f.translate(X + 0.82, g + 6.9, Z), [0.1, 0.2, 0.38]); box(X - 0.15, g - 1, Z - 0.15, X + 0.15, g + 7.5, Z + 0.15); }
  { const X = 3.5, Z = 9.5, g = C.gy(X, Z); for (const a of [0, 2.1, 4.2]) K.add('plank', new T.CylinderGeometry(0.02, 0.03, 1.5, 4).rotateZ(0.25).rotateY(a).translate(X + Math.sin(a) * 0.18, g + 0.7, Z + Math.cos(a) * 0.18), wood);
    K.add('gold', new T.CylinderGeometry(0.06, 0.06, 0.3, 10).rotateZ(HP).translate(X, g + 1.48, Z)); }
  { const X = 0, Z = 7.5, g = C.gy(X, Z), rnd = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(91);
    for (let i = 0; i < 16; i++) { const lv = Math.floor(i / 6), r = 0.45 - lv * 0.12; K.add('stone', new T.DodecahedronGeometry(0.42 - lv * 0.08, 0).translate(Math.cos(i * 1.1) * r, g + 0.3 + lv * 0.48, Z + Math.sin(i * 1.1) * r).translate(X, 0, 0), [0.5 + rnd() * 0.1, 0.5 + rnd() * 0.1, 0.52]); }
    K.add('gold', Bx(0.7, 0.45, 0.04, X, g + 0.75, Z - 0.62, 1));
    for (const s of [-1, 1]) { K.add('iron', Bx(0.04, 1.2, 0.04, X + s * 0.95, g + 0.6, Z - 0.6, 1), ir); K.add('iron', new T.CylinderGeometry(0.09, 0.11, 0.26, 8).translate(X + s * 0.95, g + 1.32, Z - 0.6), ir); K.add('lit', new T.SphereGeometry(0.065, 8, 6).translate(X + s * 0.95, g + 1.33, Z - 0.6), [1.7, 1.1, 0.5]); }
    lights.push([X, g + 1.8, Z - 1.2]);
    box(X - 0.75, g - 1, Z - 0.7, X + 0.75, g + 1.6, Z + 0.7);
    C.denk = C.w(X, Z - 1.4); C.denkY = C.y + g; }
  // Schneewehen
  for (const [X, Z, s] of [[-9.8, 3.4, 2.2], [9.6, -2, 1.8], [-4, 8.8, 1.6], [6, 7.8, 2.4], [-8.6, -4.6, 1.9]]) K.add('cloth', new T.SphereGeometry(s, 9, 5, 0, 6.283, 0, HP).scale(1, 0.32, 0.7).translate(X, C.gy(X, Z) - 0.05, Z), snow);
  const g = new T.Group(); g.position.set(C.x, C.y, C.z); g.rotation.y = yaw; K.build(g); scene.add(g); C.group = g;
  // Kollision und Lichter in Welt (Quader örtlich -> Welt, achsparallel, weil yaw ein Vielfaches von 90° ist)
  if (!KR.lab) {
    for (const [a, y0, b, c, y1, d] of boxes) { const [x0, z0] = C.w(a, b), [x1, z1] = C.w(c, d); addCollider(Math.min(x0, x1), C.y + y0, Math.min(z0, z1), Math.max(x0, x1), C.y + y1, Math.max(z0, z1)); }
    for (const [lx, y, lz] of lights) { const [x, z] = C.w(lx, lz); addLight(0xffb35c, 1.7, 14, 1.6, x, C.y + y, z); }
  }
  C.lights = lights;
  // Claim-Pflock: am Felsrand vor dem Lager, wo das Gelände zum See abbricht
  { const mS = shoreAt(S.a); let best = null; for (let d = 6; d <= 70; d += 2) { const [x, z] = landRay(S.a, mS + d), h = terrainHeight(x, z); if (!best || h > best.h + 0.5) best = { x, z, h, d }; }
    const [x, z] = landRay(S.a, mS + Math.min(S.m - mS - 20, best.d + 6)); C.pflock = [x, terrainHeight(x, z), z]; }
}

/* ---------- Gletscherhöhlen ---------- */
const CAVES = [
  { id: 'blau', name: 'Die Blaue Grotte', sub: 'Eisdom im großen Gletscher', g: 0, up: 170, seed: 3.1,
    beads: [[0, 1.8, 2.8], [1.2, 2.4, 3.3], [5, 2.7, 3.5], [9, 4.2, 5], [14, 8.5, 8], [20, 9.5, 9.2], [26, 7.2, 7.4], [30, 4.2, 4.8], [33, 2.2, 2.8], [34, 1.2, 1.6]] },
  { id: 'spalte', name: 'Die Kristallspalte', sub: 'Wo die ersten Splitter lagen', g: 1, up: 150, seed: 7.7,
    beads: [[0, 1.6, 2.8], [2, 1.9, 4.2], [8, 1.7, 6.2], [14, 2.3, 7], [20, 1.8, 6.6], [26, 2.4, 5.2], [30, 5, 6], [36, 7.6, 7.6], [41, 5.2, 5.2], [44, 1.2, 1.6]] },
];
function placeCave(D) {
  const G = LAND.glaciers[D.g]; if (!G) return null;
  // flachste Stelle im Gletschertal nahe der Wunschhöhe (die Talflanken sind steil)
  let best = null;
  for (let du = -60; du <= 60; du += 10) for (let lat = -24; lat <= 24; lat += 8) {
    const m = G.mShore + D.up + du, [px, pz] = landRay(G.ang + lat / m, m), sc = flatness(px, pz, 5)[0] + Math.abs(du) * 0.01 + Math.abs(lat) * 0.02;
    if (!best || sc < best.sc) best = { sc, px, pz };
  }
  const x = best.px, z = best.pz, y = terrainHeight(x, z);
  const dx = -Math.sin(G.ang), dz = Math.cos(G.ang);   // talwärts (zum Krater)
  const H = { id: D.id, name: D.name, D, ex: x, ey: y, ez: z, dx, dz, eyaw: Math.atan2(dx, dz), ox: x, oy: CAVE_Y, oz: z - 20, ok: true };
  const maxR = Math.max(...D.beads.map(b => b[1]));
  H.x0 = H.ox - maxR - 1; H.x1 = H.ox + maxR + 1; H.z0 = H.oz - 1; H.z1 = H.oz + D.beads[D.beads.length - 1][0] + 1;
  return H;
}
// Eistor am Gletscher: Bogen aus Eisblöcken, dunkle Öffnung, Schimmer
function buildPortal(H) {
  const K = kit(), IC = [], g = new T.Group(), rnd = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(H.D.seed * 1000 | 0);
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * Math.PI, r = 3.3 + rnd() * 0.4, s = 0.55 + rnd() * 0.45;
    IC.push(colorize(new T.DodecahedronGeometry(s, 0).scale(1, 1.2, 1.4).rotateY(rnd() * 3).translate(Math.cos(a) * r, Math.sin(a) * r * 1.2 + 0.1, -0.5 - rnd() * 0.6), (x, y, z) => iceCol(x + H.ex, y, z, 1.25)));
  }
  for (let i = 0; i < 6; i++) IC.push(cone(0.1 + rnd() * 0.08, 0.5 + rnd() * 0.9, -1.6 + i * 0.64, 3.7 - Math.abs(i - 2.5) * 0.2, -0.3));
  K.add('lit', new T.CircleGeometry(3.0, 18, 0, Math.PI).scale(1, 1.2, 1).translate(0, 0.05, -1.0), [0.01, 0.04, 0.06]);
  K.add('lit', new T.PlaneGeometry(6, 0.9).translate(0, -0.45, -1.0), [0.01, 0.04, 0.06]);
  // Expeditionsseil mit Eisenhaken am Tor
  K.add('rope', new T.CylinderGeometry(0.02, 0.02, 3.4, 4).rotateZ(1.2).translate(2.2, 1.1, 0.2), [0.6, 0.5, 0.34]);
  // Markierungsstange des Polarclubs mit Sturmlaterne: von weitem sieht man das warme Licht am Gletscher
  K.add('plank', new T.CylinderGeometry(0.06, 0.08, 4.2, 6).translate(4.6, 2.1, 1.2), [0.42, 0.3, 0.2]);
  K.add('plank', Bx(0.7, 0.06, 0.06, 4.35, 4.0, 1.2, 1), [0.42, 0.3, 0.2]);
  K.add('iron', new T.CylinderGeometry(0.1, 0.12, 0.3, 8).translate(4.05, 3.75, 1.2), [0.15, 0.15, 0.16]); K.add('lit', new T.SphereGeometry(0.075, 8, 6).translate(4.05, 3.76, 1.2), [1.7, 1.1, 0.5]);
  K.add('cloth', new T.PlaneGeometry(0.5, 0.3).translate(4.85, 3.7, 1.2), [0.1, 0.2, 0.38]);
  K.build(g); g.add(iceMesh(IC));
  const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0x4fd6e0, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending })); sp.position.set(0, 1.6, -0.8); sp.scale.setScalar(5); g.add(sp);
  const lg = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffb35c, transparent: true, opacity: 0.7, depthWrite: false, blending: T.AdditiveBlending })); lg.position.set(4.05, 3.76, 1.2); lg.scale.setScalar(2.2); g.add(lg);
  g.position.set(H.ex, Math.max(H.ey, terrainHeight(H.ex - H.dx * 1.2, H.ez - H.dz * 1.2)) - 0.25, H.ez); g.rotation.y = H.eyaw; scene.add(g); H.portal = g;
  if (!KR.lab) {
    // Wangen des Tors als Quader (gedreht: Hülle über die vier Ecken)
    const cs = Math.cos(H.eyaw), sn = Math.sin(H.eyaw);
    addLight(0xffb35c, 1.4, 12, 1.6, H.ex + 4.05 * cs + 1.2 * sn, g.position.y + 3.6, H.ez - 4.05 * sn + 1.2 * cs);
    for (const s of [-1, 1]) { const pts = [[s * 2.9, -1.6], [s * 4.1, -1.6], [s * 2.9, 0.1], [s * 4.1, 0.1]].map(([x, z]) => [H.ex + x * cs + z * sn, H.ez - x * sn + z * cs]); addCollider(Math.min(...pts.map(p => p[0])), H.ey - 1, Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), H.ey + 3.4, Math.max(...pts.map(p => p[1]))); }
  }
}
export function buildCave(H, parent = scene) {
  if (H.group) return H.group;
  const D = H.D, K = kit(), IC = [], g = new T.Group(), tube = tubeGeo(D.beads, D.seed), rad = tube.userData.rad, L = D.beads[D.beads.length - 1][0], boxes = [], lights = [], glows = [];
  IC.push(tube);
  const maxR = Math.max(...D.beads.map(b => b[1]));
  IC.push(colorize(new T.BoxGeometry(maxR * 2 + 2, 0.2, L + 1).translate(0, -0.1, L / 2), (x, y, z) => { const n = vnoise(x * 0.3, z * 0.3); return [0.3 + 0.14 * n, 0.46 + 0.12 * n, 0.56 + 0.1 * n]; }));
  const rnd = (k => () => (k = (k * 16807) % 2147483647) / 2147483647)(D.seed * 977 | 0);
  // Eiszapfen an der Decke (nur wo sie hoch genug ist), Eisbuckel am Boden
  for (let z = 3; z < L - 2; z += 1.4) { const [rx, ry] = rad(z); if (ry < 3.2) continue; for (let k = 0; k < 2; k++) { const x = (rnd() - 0.5) * rx * 1.1, top = ry * Math.sqrt(Math.max(0.05, 1 - (x / rx) ** 2)) * 0.92; IC.push(cone(0.1 + rnd() * 0.22, 0.6 + rnd() * Math.min(2.2, top * 0.35), x, top, z)); } }
  for (let z = 4; z < L - 3; z += 2.3) { const [rx] = rad(z), s = rnd() < 0.5 ? -1 : 1; IC.push(colorize(new T.SphereGeometry(0.5 + rnd() * 0.6, 7, 4, 0, 6.283, 0, HP).scale(1, 0.5, 1).translate(s * rx * 0.72, 0, z), (x, y, zz) => iceCol(x, y + 3, zz, 1.3))); }
  // Inhalt je Höhle
  const ir = [0.15, 0.15, 0.16], wood = [0.45, 0.33, 0.22];
  if (D.id === 'blau') {
    // gefrorener Wasserfall an der linken Domwand, zwei Eissäulen, gefrorener Teich, Splitter hinten, Kiste mit Feldbuch, Laterne
    for (let i = 0; i < 9; i++) IC.push(colorize(new T.CylinderGeometry(0.9 - i * 0.04, 1.1 - i * 0.04, 1.0, 8).scale(1, 1, 0.55).translate(-7.6 + i * 0.05, 0.5 + i * 0.95, 21.5), (x, y, z) => iceCol(x, y, z, 1.5)));
    for (const [x, z, r] of [[3.5, 16.5, 0.55], [-3.2, 24.2, 0.7]]) { const [, ry] = rad(z); IC.push(colorize(new T.CylinderGeometry(r * 0.6, r, ry * 0.95, 7).translate(x, ry * 0.47, z), (a, b, c) => iceCol(a, b, c, 1.3))); boxes.push([x - r, -1, z - r, x + r, ry, z + r]); }
    K.add('lit', new T.CircleGeometry(2.8, 20).rotateX(-HP).translate(0.6, 0.02, 19.6), [0.08, 0.32, 0.4]);
    for (let i = 0; i < 7; i++) shard(K, (rnd() - 0.5) * 2.6, 0.3 + rnd() * 0.9, 29.6 + rnd() * 1.6, 0.12 + rnd() * 0.1, [0.4, 1.3, 1.5], rnd() - 0.5, rnd() - 0.5);
    glows.push([0, 1, 30, 4.5, 0x4fd6e0], [0.6, 0.3, 19.6, 6, 0x3fb6c8]);
    K.add('plank', Bx(0.8, 0.6, 0.6, -2.1, 0.3, 9.6, 1), [0.52, 0.4, 0.26]); boxes.push([-2.55, -1, 9.25, -1.65, 0.6, 9.95]);
    K.add('rope', new T.CylinderGeometry(0.02, 0.02, 12, 4).rotateX(HP).translate(2.4, 1.6, 7), [0.6, 0.5, 0.34]);
    for (const z of [2, 6, 10]) K.add('iron', Bx(0.05, 0.05, 0.2, 2.45, 1.6, z, 1), ir);
    K.add('iron', new T.CylinderGeometry(0.1, 0.12, 0.28, 8).translate(-1.8, 0.74, 9.4), ir); K.add('lit', new T.SphereGeometry(0.07, 8, 6).translate(-1.8, 0.76, 9.4), [1.6, 1.05, 0.5]);
    lights.push([-1.6, 2.0, 9.4, 0xffb35c, 1.6, 12], [0, 3.5, 19, 0x5fd6e0, 1.8, 22], [0, 1.6, 29, 0x6fe6f0, 1.4, 10]);
  } else {
    // Splitterkammer: großer Splitterhaufen hinter einem Expeditionsseil, Splitter im Eis entlang der Spalte, Leiter, Kiste mit Funkgerät
    for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, r = rnd() * 1.1; shard(K, Math.cos(a) * r, 0.4 + rnd() * 1.2, 38 + Math.sin(a) * r, 0.18 + rnd() * 0.24, rnd() < 0.4 ? [1.0, 0.55, 1.6] : [0.45, 1.3, 1.6], (rnd() - 0.5) * 0.9, (rnd() - 0.5) * 0.9); }
    for (let z = 4; z < 28; z += 2.6) { const [rx, ry] = rad(z), s = rnd() < 0.5 ? -1 : 1; shard(K, s * rx * 0.86, 1 + rnd() * ry * 0.6, z, 0.06 + rnd() * 0.05, [0.4, 1.2, 1.5], 0, s * 0.8); }
    for (const [x, z] of [[-2.4, 35.5], [2.4, 35.5], [-2.8, 39.5], [2.8, 39.5]]) K.add('iron', new T.CylinderGeometry(0.035, 0.035, 1.0, 5).translate(x, 0.5, z), ir);
    K.add('rope', new T.CylinderGeometry(0.018, 0.018, 4.8, 4).rotateZ(HP).translate(0, 0.9, 35.5), [0.6, 0.5, 0.34]);
    for (const s of [-1, 1]) K.add('rope', new T.CylinderGeometry(0.018, 0.018, 4.0, 4).rotateX(HP).translate(s * 2.6, 0.9, 37.5), [0.6, 0.5, 0.34]);
    boxes.push([-2.5, -1, 35.6, 2.5, 2.6, 40.2]);
    K.add('plank', Bx(0.8, 0.5, 0.6, 3.0, 0.25, 33.6, 1), [0.52, 0.4, 0.26]); boxes.push([2.55, -1, 33.25, 3.45, 0.5, 33.95]);
    for (let y = 0; y < 4.5; y += 0.4) K.add('plank', Bx(0.6, 0.04, 0.05, -1.2, 0.2 + y, 1.4 - y * 0.04, 1), wood);
    for (const s of [-0.3, 0.3]) K.add('plank', Bx(0.05, 4.8, 0.06, -1.2 + s, 2.4, 1.3, 1), wood);
    K.add('iron', new T.CylinderGeometry(0.1, 0.12, 0.28, 8).translate(3.0, 0.64, 33.2), ir); K.add('lit', new T.SphereGeometry(0.07, 8, 6).translate(3.0, 0.66, 33.2), [1.6, 1.05, 0.5]);
    glows.push([0, 1.2, 38, 6.5, 0x8a7cf0], [0, 1.4, 38, 4, 0x4fd6e0]);
    lights.push([0, 3.2, 12, 0x5fc6e0, 1.2, 14], [2.6, 1.8, 33.4, 0xffb35c, 1.5, 10], [0, 3.0, 38, 0x9a8cff, 2.0, 16]);
  }
  // Kollision: Boden, Enden, Wände und Decke in 2-m-Streifen (begehbar ist das innere Rechteck der Ellipse)
  boxes.push([-maxR - 2, -2, -1, maxR + 2, 0, L + 1], [-maxR - 2, -1, -2, maxR + 2, 12, 0.8], [-maxR - 2, -1, L - 1.2, maxR + 2, 12, L + 2]);
  for (let z = 0; z < L; z += 2) {
    let rx = 1e9, ry = 1e9; for (let k = 0; k <= 4; k++) { const r = rad(z + k * 0.5); rx = Math.min(rx, r[0]); ry = Math.min(ry, r[1]); }
    const hw = Math.max(0.7, rx * 0.74), top = Math.max(2.4, ry * 0.82);
    boxes.push([-maxR - 2, -1, z, -hw, top + 1, z + 2], [hw, -1, z, maxR + 2, top + 1, z + 2], [-maxR - 2, top, z, maxR + 2, top + 3, z + 2]);
  }
  K.build(g); g.add(iceMesh(IC));
  for (const [x, y, z, s, c] of glows) { const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: 0.6, depthWrite: false, blending: T.AdditiveBlending })); sp.position.set(x, y, z); sp.scale.setScalar(s); g.add(sp); }
  g.position.set(H.ox, H.oy, H.oz); parent.add(g); H.group = g; H.lights = lights;
  if (!KR.lab) {
    for (const b of boxes) addCollider(H.ox + b[0], H.oy + b[1], H.oz + b[2], H.ox + b[3], H.oy + b[4], H.oz + b[5]);
    for (const [x, y, z, c, i, d] of lights) addLight(c, i, d, 1.6, H.ox + x, H.oy + y, H.oz + z);
  }
  return g;
}

/* ---------- Haken: Boden und "drinnen?" (wie die Verstecke) ---------- */
export function caveAt(p) {
  if (p.y > CAVE_Y + 14 || p.y < CAVE_Y - 6) return null;
  for (const H of KR.caves) if (H.group && p.x > H.x0 && p.x < H.x1 && p.z > H.z0 && p.z < H.z1) return H;
  return null;
}
{ const t0 = UNTER.test, g0 = UNTER.ground;
  UNTER.test = p => !!(t0 && t0(p)) || !!caveAt(p);
  UNTER.ground = (x, z, y) => {
    const u = g0 ? g0(x, z, y) : null; if (u) return u;
    if (y > CAVE_Y + 20 || y < CAVE_Y - 10) return null;
    for (const H of KR.caves) if (H.group && x > H.x0 - 4 && x < H.x1 + 4 && z > H.z0 - 4 && z < H.z1 + 4) return { y: H.oy, mu: 0.25, road: false, under: true, ice: true };
    return null;
  };
}

/* ---------- Fundstücke ---------- */
function findPos(F) {
  const C = KR.camp;
  if (F.wo === 'lager') { if (!C) return null; const [x, z] = C.w(F.at[0], F.at[2]); return [x, C.y + C.gy(F.at[0], F.at[2]) + F.at[1], z]; }
  if (F.wo === 'pflock') return C && C.pflock ? [C.pflock[0], C.pflock[1], C.pflock[2]] : null;
  if (F.wo === 'glocke') { const G = LAND.glaciers[1] || LAND.glaciers[0]; if (!G) return null; const [x, z] = landRay(G.ang + 0.03, G.mShore + 330); return [x, terrainHeight(x, z) + 0.05, z]; }
  const H = KR.caves.find(c => c.id === F.wo); if (!H) return null;
  return [H.ox + F.at[0], H.oy + F.at[1], H.oz + F.at[2]];
}
export function kraterBuildFind(F) { buildFind(F); }
function buildFind(F) {
  const P = findPos(F); if (!P) return;
  F.p = P;
  const K = kit(), g = new T.Group(); findShape(K, F.m); K.build(g);
  if (F.id === 'pickel') g.rotation.set(0, -HP, -0.5);
  else if (F.m === 'pflock' || F.m === 'funk') g.rotation.y = KR.camp ? KR.camp.yaw : 0;
  else g.rotation.y = (F.id.length * 0.7) % 6.28;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: F.m.startsWith('splitter') ? 0x8fdcff : 0xffd38a, transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending }));
  sp.scale.setScalar(F.m === 'funk' ? 1.6 : 1.1); sp.position.y = 0.25; g.add(sp); F.sp = sp;
  g.position.set(...P); scene.add(g); F.g = g; g.visible = false;
  if (!KR.lab) INTERACT.push({ test: p => !KR.s.f[F.id] && F.g && Math.abs(p.y - F.p[1]) < 2.6 && (p.x - F.p[0]) ** 2 + (p.z - F.p[2]) ** 2 < 2.3 * 2.3, get label() { return 'Aufheben: ' + F.n; }, act: () => collect(F) });
}
function chime() { try { if (!SND.ctx) return; const t = SND.ctx.currentTime; [784, 1046, 1318].forEach((f, i) => sndTone(f, t + i * 0.09, 1.2, 0.05, 'sine', 'sfx', 0, 0.4)); } catch (e) { /* ohne Klang */ } }
function collect(F) {
  if (KR.s.f[F.id]) return;
  KR.s.f[F.id] = day(); save();
  if (F.g) F.g.visible = false;
  chime();
  const n = kraterCount();
  showCard(F.n, `Fundstück ${n} von ${FUNDE.length} · Umschalt+I, Reiter Krater`, F.t);
  try { rufAdd(F.m.startsWith('splitter') ? { bew: 0.6, furcht: 0.2 } : { bew: 0.4, presse: 0.2 }, 'Fundstücke am Krater', { key: 'krater', quiet: n < FUNDE.length }); } catch (e) { /* Ruf noch nicht bereit */ }
  if (n === FUNDE.length) setTimeout(() => toast('Alle zwölf Fundstücke! Am Steinmann im alten Lager entscheiden Sie, wem sie gehören.'), 9000);
}

/* ---------- Leseblatt (nicht blockierend) ---------- */
function showCard(title, sub, text) {
  let el = KR.card;
  if (!el) {
    const st = document.createElement('style');
    st.textContent = '#kraterBlatt{position:fixed;z-index:12;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(520px,calc(100% - 32px));padding:14px 18px 13px;background:rgba(5,18,24,.9);border:1px solid rgba(214,174,96,.7);outline:1px solid rgba(214,174,96,.25);outline-offset:3px;color:#efe6d2;font-size:14px;line-height:1.5;pointer-events:none;opacity:0;transition:opacity .5s}'
      + '#kraterBlatt h4{margin:0 0 2px;font:400 18px/1.2 var(--display,Georgia,serif);letter-spacing:.06em;color:#f6dc9a}#kraterBlatt small{display:block;margin-bottom:8px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8fd6cf}#kraterBlatt p{margin:0}';
    document.head.appendChild(st);
    el = KR.card = document.createElement('div'); el.id = 'kraterBlatt'; el.className = 'hud'; el.innerHTML = '<h4></h4><small></small><p></p>'; document.body.appendChild(el);
  }
  el.children[0].textContent = title; el.children[1].textContent = sub; el.children[2].textContent = text;
  el.style.opacity = 1; KR.cardT = 9 + text.length / 28; KR.cardP = player.p.clone();
}

/* ---------- Steinmann: Tafel lesen, am Ende entscheiden ---------- */
const WAHL = {
  museum: { t: 'Dem Stadtmuseum stiften, mit allen fünf Namen', ruf: { buerger: 4, presse: 4, arbeiter: 2, elite: -1 }, news: ['Die Funde vom Krater gehören der Stadt', 'Herr Alexander hat die Fundstücke seiner Expedition von 1919 dem Stadtmuseum gestiftet. Auf der Vitrine stehen fünf Namen: Alexander, Brekke, Halvorsen, Wendt, Saalfeld. Ingrid Halvorsen, inzwischen Professorin in Bergen, telegrafierte nur ein Wort: „Endlich.“'] },
  vitrine: { t: 'In die Vitrine im Penthouse, neben den Kristall', ruf: { elite: 2, bew: 2, presse: -3, buerger: -1 }, news: ['Die Expedition gehört jetzt ins Penthouse', 'Tagebuch, Splitter, Wimpel: alle Fundstücke vom Kraterrand stehen jetzt in einer Vitrine in Herrn Alexanders Penthouse. Sehen wird sie kaum jemand. Im Kurier fragt ein Leser: „Gehört einem Mann auch unsere Geschichte?“'] },
  club: { t: 'Dem Polarclub übergeben, für sein Kartenzimmer', ruf: { elite: 4, presse: 1, arbeiter: -1 }, news: ['Polarclub erhält die Expeditionsfunde', 'Im Kartenzimmer des Polarclubs hängen jetzt Brekkes Sextant und der alte Wimpel. Kapitän Brekke soll beim Anblick sein Glas gehoben haben, zum ersten Mal in Herrn Alexanders Richtung. Die Öffentlichkeit hat zum Club keinen Zutritt.'] },
};
function denkmal() {
  const n = kraterCount();
  if (n === FUNDE.length && !KR.s.wahl) {
    const keys = Object.keys(WAHL);
    openChoice('Wem gehören die Funde vom Krater?', keys.map(k => WAHL[k].t), i => {
      const k = keys[i], W = WAHL[k]; KR.s.wahl = k; save();
      try { rufAdd(W.ruf, 'Die Funde vom Krater: ' + W.t.split(',')[0]); } catch (e) { /* ohne Ruf */ }
      try { zeitungMeldung({ titel: W.news[0], text: W.news[1], rubrik: 'Stadt', prio: 7, ort: 'am Kraterrand' }); } catch (e) { /* ohne Zeitung */ }
      showCard('Entschieden', 'Die Funde vom Krater', W.news[1]);
    });
    return;
  }
  const w = KR.s.wahl ? ' · Die Fundstücke sind jetzt ' + (KR.s.wahl === 'museum' ? 'im Stadtmuseum.' : KR.s.wahl === 'vitrine' ? 'in der Vitrine im Penthouse.' : 'im Polarclub.') : '';
  showCard('Gedenktafel am Steinmann', `Fundstücke ${n} von ${FUNDE.length}${w}`, TAFEL + ' ' + GERITZT);
}

/* ---------- Hinein, hinaus ---------- */
function enterCave(H) {
  buildCave(H); for (const F of FUNDE) if (F.wo === H.id && !F.g) buildFind(F);
  travel([H.ox, H.oy + 0.05, H.oz + 2.2], Math.PI, -0.04, H.name + ' · ' + H.D.sub);
  if (!KR.s.seen[H.id]) {
    KR.s.seen[H.id] = 1; save();
    if (!KR.s.seen.hoehleNews) { KR.s.seen.hoehleNews = 1; save(); try { zeitungMeldung({ titel: 'Herr Alexander in den Gletscherhöhlen', text: 'Bergführer berichten, Herr Alexander sei allein in die Eishöhlen am westlichen Kraterrand gestiegen, in denen seine Expedition 1919 die ersten Meteoritensplitter fand. Was er dort sucht, wollte das Belmont nicht sagen.', rubrik: 'Stadt', prio: 4, ort: 'am Kraterrand' }); } catch (e) { /* ohne Zeitung */ } }
  }
}
function leaveCave(H) { travel([H.ex + H.dx * 5, H.ey + 0.4, H.ez + H.dz * 5], Math.atan2(-H.dx, -H.dz), 0.02, 'Draußen am Gletscher · ' + H.name); }

/* ---------- Aufbau (einmal, wenn die Welt steht) ---------- */
export function kraterPlace() {
  if (KR.placed || !LAND.ready || !LAND.shore) return false;
  KR.placed = true;
  const t0 = performance.now();
  const S = KR.site || findCamp();
  if (S) buildCamp(S);
  for (const D of CAVES) { const H = placeCave(D); if (H) { KR.caves.push(H); buildPortal(H); } }
  for (const F of FUNDE) if (F.wo === 'lager' || F.wo === 'pflock' || F.wo === 'glocke') buildFind(F);
  if (!KR.lab) {
    const C = KR.camp;
    if (C) INTERACT.push({ test: p => Math.abs(p.y - C.denkY) < 3 && (p.x - C.denk[0]) ** 2 + (p.z - C.denk[1]) ** 2 < 2.4 * 2.4, get label() { return kraterCount() === FUNDE.length && !KR.s.wahl ? 'Entscheiden: wem gehören die Funde vom Krater?' : 'Die Gedenktafel lesen'; }, act: denkmal });
    for (const H of KR.caves) {
      INTERACT.push({ test: p => !caveAt(p) && Math.abs(p.y - H.ey) < 4 && (p.x - H.ex - H.dx * 1.2) ** 2 + (p.z - H.ez - H.dz * 1.2) ** 2 < 3.2 * 3.2, label: 'Hinein: ' + H.name, act: () => enterCave(H) });
      INTERACT.push({ test: p => caveAt(p) === H && p.z - H.oz < 4, label: 'Hinaus aufs Gletschereis', act: () => leaveCave(H) });
    }
    tasten();
  }
  KR.stats = { ms: Math.round(performance.now() - t0), camp: S ? { a: +S.a.toFixed(2), x: Math.round(S.x), z: Math.round(S.z), y: Math.round(KR.camp.y), flat: +S.rg.toFixed(1) } : null, caves: KR.caves.map(H => ({ id: H.id, x: Math.round(H.ex), y: Math.round(H.ey), z: Math.round(H.ez) })) };
  return true;
}

/* ---------- Jedes Bild (über das Kontor) ---------- */
function update(dt) {
  if (!KR.placed) { kraterPlace(); return; }
  const cam = camera.position, p = player.p, inC = caveAt(p);
  const C = KR.camp;
  if (C) { C.group.visible = !inC && (cam.x - C.x) ** 2 + (cam.z - C.z) ** 2 < 900 * 900;
    if (!KR.s.seen.lager && (p.x - C.x) ** 2 + (p.z - C.z) ** 2 < 30 * 30 && Math.abs(p.y - C.y) < 20) {
      KR.s.seen.lager = 1; save();
      showCard('Das alte Expeditionslager', 'Lager Nordstern · März 1919', 'Hier schlug die Expedition ihr letztes Lager auf, bevor sie in den Krater hinabstieg. Der Polarclub hält die Laternen am Steinmann am Brennen. Zwölf Dinge von damals liegen noch am Krater: im Lager, am Felsrand, auf dem Gletscher und in den beiden Eishöhlen im Westen.');
      try { zeitungMeldung({ titel: 'Der Gründer am alten Lager', text: 'Herr Alexander wurde am Kraterrand gesehen, am Lager der Expedition von 1919. Einige sagen, er suche Erinnerungen. Andere sagen, er prüfe nur, ob dort oben noch etwas liegt, das ihm nicht gehört.', rubrik: 'Stadt', prio: 4, ort: 'am Kraterrand' }); } catch (e) { /* ohne Zeitung */ }
    } }
  for (const H of KR.caves) {
    if (H.portal) H.portal.visible = !inC && (cam.x - H.ex) ** 2 + (cam.z - H.ez) ** 2 < 800 * 800;
    if (H.group) H.group.visible = inC === H || (cam.y < CAVE_Y + 14 && cam.x > H.x0 && cam.x < H.x1 && cam.z > H.z0 && cam.z < H.z1);
  }
  const tm = performance.now() / 1000;
  for (const F of FUNDE) if (F.g) {
    const vis = !KR.s.f[F.id] && (cam.x - F.p[0]) ** 2 + (cam.z - F.p[2]) ** 2 < 160 * 160 && (F.wo === 'blau' || F.wo === 'spalte' ? inC && inC.id === F.wo : !inC);
    F.g.visible = vis; if (vis) F.sp.material.opacity = 0.32 + 0.18 * Math.sin(tm * 2.2 + F.p[0]);
  }
  if (KR.card && KR.cardT > 0) { KR.cardT -= dt; if (KR.cardT <= 0 || (KR.cardP && p.distanceTo(KR.cardP) > 9)) { KR.cardT = 0; KR.card.style.opacity = 0; } }
}

/* ---------- Karte, Inventar, Pausenmenü ---------- */
if (KARTE) (KARTE.placeHooks ||= []).push(add => {
  const C = KR.camp;
  if (C) add({ id: 'krater:lager', cat: 'orte', icon: 'ort', n: 'Das alte Expeditionslager', sub: 'Lager Nordstern, 1919 · Gedenktafel, Zelte, Claim-Pflock · ' + kraterCount() + ' von ' + FUNDE.length + ' Fundstücken', x: C.x, z: C.z, prio: 6,
    ziele: [{ t: 'Hinfliegen', a: { x: C.denk[0] + (C.denk[0] - C.x) * 0.6, y: C.denkY + 0.4, z: C.denk[1] + (C.denk[1] - C.z) * 0.6 } }] });
  for (const H of KR.caves) add({ id: 'krater:' + H.id, cat: 'orte', icon: 'ort', n: H.name, sub: 'Gletscherhöhle · ' + H.D.sub + ' · Eingang am Eistor (E)', x: H.ex, z: H.ez, prio: 5,
    ziele: [{ t: 'Vor das Eistor', a: { x: H.ex + H.dx * 6, y: H.ey + 0.4, z: H.ez + H.dz * 6 } }] });
});
export function kraterInvTab(slot, sel) {
  let h = '', d = '';
  FUNDE.forEach((F, i) => { const got = KR.s.f[F.id]; h += slot(i, F.m.startsWith('splitter') ? 'gold' : F.m === 'buch' ? 'buch' : F.m === 'funk' ? 'radio' : F.m === 'kompass' ? 'uhr' : F.m === 'platte' ? 'bild' : 'kasten', got ? F.n.replace(/^(Ein |Der |Die |Das )/, '') : '?', '', got ? '' : ' zu'); });
  const F = FUNDE[sel], got = F && KR.s.f[F.id], n = kraterCount();
  d = `<h3>${F ? (got ? F.n : 'Noch nicht gefunden') : ''}</h3><small>Funde vom Krater · ${n} von ${FUNDE.length}</small>`;
  if (F) d += got ? `<p>${F.t}</p><p style="font-size:11px">Gefunden am Tag ${got}.</p>` : `<p>Wo suchen:</p><blockquote>${F.h}</blockquote>`;
  d += KR.s.wahl ? `<p style="color:var(--gold-hi)">${WAHL[KR.s.wahl].t.split(',')[0]}: so hat Alexander entschieden.</p>` : '<p>Die Expedition von 1919 hat am Kraterrand Spuren hinterlassen: im alten Lager, am Felsrand, auf dem Gletscher und in zwei Eishöhlen. Lager und Höhlen stehen auf der Stadtkarte (Y).</p>';
  return [h, d];
}
function tasten() {
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'Krater', tasten: [
    { k: ['Y'], t: 'Lager und Höhlen', d: 'Auf der Stadtkarte: das alte Expeditionslager und die zwei Gletscherhöhlen am westlichen Kraterrand' },
    { k: ['E'], t: 'Erkunden', d: 'Fundstücke aufheben, am Eistor hinein und am Ausgang hinaus, die Gedenktafel am Steinmann lesen' },
    { k: ['Umschalt', 'I'], t: 'Funde vom Krater', d: 'Im Inventar, Reiter Krater: alle zwölf Fundstücke mit ihren Geschichten und Hinweisen' },
  ] } })); } catch (e) { /* ohne Menü */ }
}

INV_EXTRA.krater = { list: () => FUNDE, render: kraterInvTab };
load();
KT.hooks.push((why, dt) => { if (why === 'init') kraterDebug(); if (why === 'frame') { kraterDebug(); try { update(dt || 0.016); } catch (e) { if (!KR.err) { KR.err = 1; console.warn('Krater:', e); } } } });
// Testzugang (tools/krater-test.js): erst nach boot.js, das window.vespera anlegt
function kraterDebug() { if (typeof window !== 'undefined' && window.vespera && !window.vespera.krater) window.vespera.krater = { KR, FUNDE, place: kraterPlace, found: id => { const F = FUNDE.find(f => f.id === id); if (F) collect(F); }, enter: id => { const H = KR.caves.find(c => c.id === id); if (H) enterCave(H); } }; }
