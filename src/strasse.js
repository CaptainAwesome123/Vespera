/* =====================================================================
   V72 · LEBENDIGERE STADT: Straßenhändler und Arbeiterkundgebung
   STRASSENHÄNDLER an Hauswänden und am Belmont-Platz, jeder hinter seinem
   Stand: Maronenröster (Glut, Rauch), Würstchenwagen mit gestreiftem Dach,
   Punschstand mit Samowar (türkis-cremefarbenes Dach), Suppenwagen im
   Arbeiterviertel, Blumenfrau mit Eimern voller Rosen, Schuhputzerjunge,
   Zigarettenmädchen mit Bauchladen. Sie rufen ihre Ware aus, Kunden stehen
   davor und essen oder trinken. E am Stand: kaufen, eine Runde für alle
   spendieren oder großzügig zahlen. Wie sie Alexander begrüßen und was sie
   zum Trinkgeld sagen, hängt von ihrer Haltung ab (awe.js attOf, Ruf Ö).
   KUNDGEBUNG am Kneipenplatz im Arbeiterviertel: ein Redner auf einer Kiste
   vor einem Transparent, Arbeiter mit Schildern, zwei Polizisten am Rand.
   Wie groß sie ist, hängt vom Ruf bei den Arbeitern ab und davon, ob gerade
   ein Streik läuft (Kontor-Ereignis): ab 62 bleibt der Platz ruhig, darunter
   eine kleine Kundgebung, unter 35 oder bei Streik eine große, dazu ein
   Demonstrationszug mit Transparent, der um den Platz zieht. Kommt Alexander,
   drehen sich die Köpfe, und je nach Ruf rufen sie ihm etwas zu. E beim
   Redner: Löhne versprechen, für die Streikkasse spenden, eine Rede halten
   oder die Polizei räumen lassen, mit Folgen für Ruf und Zeitung.
   Kanon (V66): Alexander ist ein reicher Kapitalist, kein Held; der Protest
   ist friedlich und verständlich, keine Karikatur.
   Nur vorhandene Figuren und Handlungen. Stände und Kiste sind ein einziges
   Netz (paintMat, wie die Instrumente in life.js), Schilder und Transparente
   ein Netz mit einer kleinen Leinwand (MeshBasicMaterial, kein Shader-Code),
   die Schilder der Gehenden rechnet die CPU nur in der Nähe nach.
   Test: ?kundgebung=0|1|2 erzwingt die Stufe; Konsole window.vespera.strasse.
   ===================================================================== */
import { T, MOBILE, mulberry32, scene, shared, camera, canvasTex } from './core.js';
import { blocks, PLAZA, inRect } from './island.js';
import { curbs, addGlow, steamPts } from './facade-shader.js';
import { addCollider, nearBoxes } from './people-skeleton.js';
import { setAct, turnHead, pedCrowd, SHIRTS, WORKWEAR, COATS, DRESSES } from './serpentine.js';
import { player } from './player.js';
import { LIFE, lifeMesh, lifeSay, freeSpot, placeParts } from './life.js';
import { INTERACT } from './music.js';
import { openChoice } from './venues.js';
import { KT, ktCash, EVENTS } from './kontor.js';
import { RUF, rufGet, rufAdd } from './ruf.js';
import { attOf } from './awe.js';
import { WORK } from './workers.js';
import { KARTE } from './karte.js';
import { toast } from './boat.js';
import { DRIVE } from './eating.js';
import { playing, paused } from './input.js';

export const STR = { vend: [], rally: null, march: null, signs: [], level: -1, lvlT: 0, callT: 6, greetT: 0, talkT: 0, calmT: 0, clearT: 0, chantT: 4, newsLvl: 0, ready: false, force: null, mesh: null, sign: null, pick: null };
const pick = a => a[Math.floor(Math.random() * a.length)];
const near2 = (x, z, r) => (x - camera.position.x) ** 2 + (z - camera.position.z) ** 2 < r * r;
const fmP = p => p < 1 ? Math.round(p * 100) + ' Funken' : p.toLocaleString('de-DE') + ' Lumen';
const free = () => shared.sayTimer <= 0.3 && LIFE.sayT <= 0;
function say(who, s, dur) { if (!lifeSay(who, s, dur ?? Math.max(3, s.length / 14 + 1))) return false; LIFE.sayT = Math.max(LIFE.sayT, 4); return true; }

/* =====================================================================
   1) STÄNDE (lokal: +z zeigt zur Kundschaft, der Händler steht bei −z)
   ===================================================================== */
const BX = (w, h, d, x, y, z) => new T.BoxGeometry(w, h, d).translate(x, y, z);
const CY = (rt, rb, h, n, x, y, z) => new T.CylinderGeometry(rt, rb, h, n).translate(x, y, z);
const IRON = [0.08, 0.085, 0.09], GREEN = [0.1, 0.24, 0.18], RED = [0.5, 0.08, 0.08], CREAM = [0.85, 0.8, 0.68], WOOD = [0.36, 0.24, 0.15], DARK = [0.18, 0.11, 0.07],
  BRASS = [0.78, 0.58, 0.28], STEEL = [0.62, 0.64, 0.66], EMBER = [2.4, 0.9, 0.25], LAMP = [1.9, 1.4, 0.75], WHITE = [0.92, 0.9, 0.86], TEAL = [0.05, 0.3, 0.32];
const wheels = (P, x, r) => { for (const s of [-1, 1]) P.push([CY(r, r, 0.06, 14, 0, 0, 0).rotateZ(Math.PI / 2).translate(s * x, r, 0), IRON], [CY(0.05, 0.05, 0.08, 8, 0, 0, 0).rotateZ(Math.PI / 2).translate(s * x, r, 0), BRASS]); };
const canopy = (P, w, c1, c2, h = 2.15) => {
  for (const s of [-1, 1]) P.push([CY(0.02, 0.02, h - 0.95, 6, s * (w / 2 - 0.08), (h + 0.95) / 2, -0.22), IRON]);
  const n = 6; for (let k = 0; k < n; k++) P.push([BX(w / n, 0.04, 0.85, -w / 2 + w / n * (k + 0.5), h, -0.02), k % 2 ? c2 : c1]);
  for (let k = 0; k < n; k++) P.push([BX(w / n, 0.12, 0.02, -w / 2 + w / n * (k + 0.5), h - 0.07, 0.42), k % 2 ? c2 : c1]);   // Volant vorn
};
const lantern = (P, x, y, z) => P.push([BX(0.12, 0.18, 0.12, x, y, z), LAMP], [BX(0.15, 0.03, 0.15, x, y + 0.1, z), IRON]);
const PARTS = {
  maroni() {
    const P = [[BX(1.0, 0.5, 0.55, 0, 0.62, 0), GREEN], [BX(0.82, 0.16, 0.02, 0, 0.64, 0.285), CREAM], [BX(1.04, 0.04, 0.59, 0, 0.88, 0), IRON]];
    wheels(P, 0.55, 0.32);
    P.push([CY(0.26, 0.3, 0.42, 14, 0.15, 1.1, 0), IRON], [CY(0.23, 0.23, 0.02, 14, 0.15, 1.32, 0), EMBER], [CY(0.3, 0.3, 0.03, 14, 0.15, 1.34, 0), [0.14, 0.14, 0.15]]);
    P.push([CY(0.04, 0.04, 0.75, 8, -0.28, 1.27, -0.12), IRON], [CY(0.09, 0.02, 0.07, 8, -0.28, 1.68, -0.12), IRON]);
    for (let k = 0; k < 4; k++) P.push([BX(0.08, 0.12, 0.06, -0.38 + k * 0.1, 0.96, 0.16), CREAM]);
    P.push([BX(0.04, 0.04, 0.6, 0, 0.75, -0.55), WOOD]);
    return P;
  },
  wurst() {
    const P = [[BX(1.2, 0.6, 0.6, 0, 0.66, 0), CREAM], [BX(1.22, 0.08, 0.62, 0, 0.86, 0), RED], [BX(1.24, 0.04, 0.64, 0, 0.98, 0), STEEL]];
    wheels(P, 0.62, 0.3);
    P.push([CY(0.22, 0.22, 0.35, 14, 0.25, 1.18, 0), STEEL], [CY(0.23, 0.2, 0.04, 14, 0.25, 1.37, 0), STEEL], [CY(0.03, 0.03, 0.05, 6, 0.25, 1.41, 0), BRASS]);
    P.push([CY(0.06, 0.06, 0.12, 8, -0.3, 1.06, 0.12), [0.85, 0.65, 0.15]], [BX(0.3, 0.06, 0.2, -0.3, 1.03, -0.1), [0.75, 0.55, 0.32]]);
    canopy(P, 1.45, RED, WHITE); lantern(P, 0.52, 1.92, 0.3);
    return P;
  },
  punsch() {
    const P = [[BX(1.1, 0.06, 0.6, 0, 0.92, 0), WOOD], [BX(1.12, 0.62, 0.62, 0, 0.58, 0), [0.35, 0.06, 0.07]], [BX(1.0, 0.05, 0.02, 0, 0.72, 0.315), [0.75, 0.58, 0.3]]];
    P.push([CY(0.16, 0.2, 0.4, 14, -0.2, 1.15, -0.05), BRASS], [CY(0.08, 0.16, 0.12, 12, -0.2, 1.41, -0.05), BRASS], [CY(0.04, 0.06, 0.06, 8, -0.2, 1.5, -0.05), BRASS], [BX(0.03, 0.03, 0.14, -0.2, 1.05, 0.14), BRASS]);
    for (let k = 0; k < 4; k++) P.push([CY(0.035, 0.03, 0.08, 8, 0.12 + 0.09 * k, 0.99, 0.12), WHITE]);
    canopy(P, 1.35, TEAL, CREAM); lantern(P, -0.5, 1.9, 0.3);
    return P;
  },
  suppe() {
    const P = [[BX(1.1, 0.55, 0.6, 0, 0.6, 0), WOOD], [BX(1.12, 0.04, 0.62, 0, 0.9, 0), DARK]];
    wheels(P, 0.58, 0.3);
    P.push([CY(0.3, 0.26, 0.4, 14, 0.12, 1.12, 0), IRON], [CY(0.31, 0.31, 0.03, 14, 0.12, 1.33, 0), [0.2, 0.2, 0.2]], [CY(0.015, 0.015, 0.5, 6, 0.3, 1.45, 0.05).rotateZ(0.3), STEEL]);
    P.push([CY(0.1, 0.07, 0.14, 10, -0.36, 0.99, 0.08), CREAM], [BX(0.04, 1.3, 0.04, -0.5, 1.5, -0.25), IRON], [BX(0.4, 0.04, 0.04, -0.32, 2.12, -0.25), IRON]); lantern(P, -0.16, 1.98, -0.25);
    return P;
  },
  blumen() {
    const P = [];
    for (let k = 0; k < 3; k++) P.push([BX(1.1, 0.05, 0.26, 0, 0.42 + 0.22 * k, 0.16 - 0.15 * k), WOOD]);
    for (const x of [-0.52, 0.52]) P.push([BX(0.05, 0.9, 0.05, x, 0.45, 0.2), DARK], [BX(0.05, 0.95, 0.05, x, 0.48, -0.16), DARK]);
    const FL = [[0.9, 0.1, 0.15], [0.95, 0.93, 0.9], [0.95, 0.78, 0.2], [0.92, 0.5, 0.62], [0.95, 0.93, 0.9], [0.7, 0.05, 0.12]];
    let i = 0;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
      const x = -0.39 + j * 0.26, y = 0.45 + 0.22 * k, z = 0.16 - 0.15 * k, c = FL[(i++ * 5 + k) % FL.length];
      P.push([CY(0.09, 0.07, 0.2, 8, x, y + 0.1, z), [0.45, 0.47, 0.5]], [CY(0.1, 0.06, 0.12, 7, x, y + 0.24, z), [0.12, 0.32, 0.14]]);
      for (let f = 0; f < 4; f++) P.push([new T.SphereGeometry(0.055, 6, 4).translate(x + Math.cos(f * 1.7) * 0.05, y + 0.32 + (f % 2) * 0.04, z + Math.sin(f * 1.7) * 0.05), c]);
    }
    return P;
  },
  schuh() {
    const P = [[BX(0.36, 0.3, 0.32, 0, 0.15, -0.05), WOOD], [BX(0.32, 0.25, 0.3, 0, 0.125, 0.55), WOOD], [BX(0.12, 0.05, 0.26, 0, 0.3, 0.55).rotateX(0), IRON]];
    P.push([BX(0.16, 0.05, 0.06, 0.28, 0.03, 0.3), DARK], [BX(0.14, 0.05, 0.06, -0.26, 0.03, 0.34), DARK], [CY(0.04, 0.04, 0.025, 8, 0.24, 0.013, 0.5), [0.12, 0.1, 0.08]], [CY(0.04, 0.04, 0.025, 8, -0.22, 0.013, 0.2), [0.6, 0.4, 0.2]]);
    return P;
  },
  zigar() {
    const P = [[BX(0.5, 0.05, 0.3, 0, 1.08, 0.3), DARK], [BX(0.52, 0.06, 0.02, 0, 1.12, 0.45), BRASS]];
    for (const s of [-1, 1]) P.push([BX(0.02, 0.42, 0.02, s * 0.18, 1.3, 0.18), [0.08, 0.08, 0.08]]);
    const C = [[0.85, 0.82, 0.75], [0.55, 0.1, 0.12], [0.8, 0.62, 0.25], [0.1, 0.25, 0.3], [0.3, 0.2, 0.12]];
    for (let k = 0; k < 8; k++) P.push([BX(0.09, 0.04, 0.06, -0.18 + (k % 4) * 0.12, 1.125, 0.24 + Math.floor(k / 4) * 0.12), C[k % C.length]]);
    return P;
  },
};
/* Waren, Rufe, Begrüßung je Haltung. price in Lumen (1 Lumen = 100 Funken) */
const VEND = {
  maroni: { who: 'Der Maronenmann', ware: 'Heiße Maronen', buy: 'eine Tüte Maronen', price: 0.5, act: [4.3, 0.9], cust: 17.2, steam: true, glow: [EMBER, 1.0, 1.35],
    calls: ['Heiße Maronen! Frisch geröstet!', 'Maronen, heiß und süß! Gut gegen die Polarnacht!', 'Wer friert, kauft Maronen! Warme Hände für fünfzig Funken!'],
    eat: 'Die Maronen sind heiß und süß. Die Finger tauen auf.' },
  wurst: { who: 'Der Würstchenmann', ware: 'Wiener mit Senf', buy: 'ein Paar Wiener', price: 0.8, act: [4.3, 0.9], cust: 17.2, steam: true, glow: [LAMP, 0.9, 1.92],
    calls: ['Heiße Wiener! Mit Senf und Brötchen!', 'Würstchen, Würstchen, frisch aus dem Kessel!', 'Ein Paar Wiener für achtzig Funken!'],
    eat: 'Knackig, heiß, mit scharfem Senf. Einfach und gut.' },
  punsch: { who: 'Die Punschfrau', ware: 'Heißer Punsch', buy: 'einen Becher Punsch', price: 0.6, act: [4.3, 0.9], cust: 17.2, steam: true, glow: [LAMP, 0.9, 1.9], fem: true,
    calls: ['Heißer Punsch! Mit Zimt und Nelken!', 'Tee und Punsch, heiß wie der Kristall!', 'Ein Becher Wärme, meine Herrschaften!'],
    eat: 'Zimt, Nelken, ein Schuss Rum. Die Kälte weicht für einen Moment.' },
  suppe: { who: 'Die Suppenfrau', ware: 'Erbsensuppe', buy: 'einen Teller Suppe', price: 0.2, act: [4.3, 0.9], cust: 17.2, steam: true, glow: [LAMP, 0.9, 1.98], fem: true, worker: true,
    calls: ['Erbsensuppe! Heiß und satt für zwanzig Funken!', 'Nach der Schicht ein Teller Suppe!', 'Suppe mit Speck! Kommt her, solange sie heiß ist!'],
    eat: 'Dick, heiß und salzig. Hier unten schmeckt sie besser als jedes Menü im Belmont.' },
  blumen: { who: 'Die Blumenfrau', ware: 'Rosen', buy: 'eine weiße Rose', price: 0.3, act: [37.3, 37.6], cust: 0.9, fem: true,
    calls: ['Rosen! Rosen aus dem Gewächshaus!', 'Blumen für die Dame! Mitten in der Polarnacht!', 'Weiße Rosen, rote Rosen, frisch geschnitten!'],
    him: 'Eine weiße Rose fürs Revers, Herr Alexander? Wie immer?', eat: 'Eine weiße Rose. Sie steckt sie Ihnen selbst ans Revers.' },
  schuh: { who: 'Der Schuhputzer', ware: 'Schuhe putzen', buy: 'einmal Schuhe putzen', price: 0.2, act: [7.6, 7.3], kid: true,
    calls: ['Schuhe putzen! Glänzend wie das Belmont!', 'Schnee und Salz runter, Glanz drauf! Zwanzig Funken!'],
    him: 'Schuhe putzen, Herr Alexander? Für Sie mach’ ich sie wie Gold!', eat: 'Zwei Minuten Bürste und Tuch. Die Schuhe glänzen wie neu.' },
  zigar: { who: 'Das Zigarettenmädchen', ware: 'Zigarren und Pralinen', buy: 'eine Havanna', price: 2, act: [8.05, 0.9], fem: true, elite: true,
    calls: ['Zigaretten! Zigarren! Pralinen!', 'Havanna, der Herr? Echte aus Kuba!', 'Pralinen für die Dame? Belgische!'],
    him: 'Eine Havanna für Herrn Alexander? Die besten habe ich für Sie zurückgelegt.', eat: 'Eine echte Havanna. Der Rauch steigt in die Polarnacht.' },
};
const GREET = {
  bew: ['Guten Abend, Herr Alexander! Für Sie das Beste vom Stand!', 'Herr Alexander! An meinem Stand! Das erzähl’ ich meinen Enkeln.'],
  resp: ['’n Abend, Herr Alexander. Was darf’s sein?', 'Abend, Chef. Heute frisch, wie immer.'],
  neid: ['Für Sie zum gleichen Preis wie für alle, Herr Alexander. Wenigstens hier.', 'Na, schmeckt Ihnen der Kaviar nicht mehr?'],
  skep: ['Was darf’s sein? Bezahlt wird vorher. Auch von Ihnen.', 'Hm. ’n Abend. Kaufen Sie was oder schauen Sie nur?'],
  furcht: ['G… guten Abend, Herr Alexander! Bitte, nehmen Sie, was Sie wollen!', 'Oh! Herr Alexander … ich … was darf es sein?'],
  hass: ['Ihr Geld ist hier so viel wert wie jedes andere. Mehr nicht.', 'Gehen Sie ruhig weiter, Herr Alexander. Hier gibt’s nichts für Ihresgleichen.'],
  dienst: ['Zu Diensten, Herr Alexander!'],
};
const THANKS = { bew: 'Vielen Dank, Herr Alexander! Beehren Sie mich wieder!', resp: 'Danke, Chef. Lassen Sie’s sich schmecken.', neid: 'Danke. Das bezahlt meine Miete für … zehn Minuten.', skep: 'Na also. Danke.', furcht: 'D… danke, Herr Alexander!', hass: 'Stimmt so. Und jetzt gehen Sie.', dienst: 'Sehr wohl!' };
const TIPS = { bew: 'Herr Alexander! Das ist viel zu viel! Gott segne Sie!', resp: 'Das … danke, Chef. Das hilft wirklich.', neid: 'Na so was. Das ist mehr als mein Wochenlohn. … Danke.', skep: 'Ein Trinkgeld macht noch keinen gerechten Lohn. Aber danke.', furcht: 'So viel? D… danke, Herr Alexander!', hass: 'Ihr Geld nehm’ ich. Ihre Gnade nicht.', dienst: 'Herzlichen Dank, Herr Alexander!' };
const ROUND = ['Ein Hoch auf Herrn Alexander!', 'Danke, Herr Alexander! Auf Ihr Wohl!', 'Na, das lässt man sich gefallen!'];
const ROUND_COOL = ['Danke. Auch wenn’s Ihnen nicht wehtut.', 'Na gut. Eine Runde vom Herrn von oben.'];

/* Platz an einer Hauswand (wie der Leierkasten in life.js): Händler mit dem Rücken zur Wand, Stand davor, Kunden auf der Straßenseite */
function wallSpots(rr, max) {
  const out = [], blockAt = (x, z) => blocks.find(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1);
  const order = curbs.map((c, i) => [rr(), i]).sort((a, b) => a[0] - b[0]).map(o => curbs[o[1]]);
  for (const c of order) {
    if (out.length >= max) break;
    const b = blockAt(c.cx, c.cz); if (!b || b.park || b.square || Math.hypot(c.cx, c.cz) > 900) continue;
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az); if (L < 20) continue;
    const dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L;
    let nx = -dz, nz = dx; if ((c.cx - c.ax) * nx + (c.cz - c.az) * nz < 0) { nx = -nx; nz = -nz; }
    const t = 7 + rr() * (L - 14), x = c.ax + dx * t + nx * 3.45, z = c.az + dz * t + nz * 3.45;
    if (inRect(x, z, PLAZA, 4)) continue;
    let wall = false; for (const q of nearBoxes(x + nx * 0.6, z + nz * 0.6, 0.5)) if (q.y1 > 2.5 && x + nx * 0.6 > q.x0 - 0.3 && x + nx * 0.6 < q.x1 + 0.3 && z + nz * 0.6 > q.z0 - 0.3 && z + nz * 0.6 < q.z1 + 0.3) { wall = true; break; }
    if (!wall || !freeSpot(x - nx * 0.75, z - nz * 0.75, 0.75, null)) continue;
    const worker = (b.tier || 'fabric') === 'fabric' && b.d > 650, elite = b.tier === 'landmark' || b.d < 300;
    out.push({ x, z, fx: -nx, fz: -nz, y: 0.22, worker, elite });
  }
  return out;
}
// Am Rand des Belmont-Platzes (Granit zwischen Gehweg-Runde und Platzkante), Blick zur Platzmitte
function plazaSpots(rr, loops, max) {
  const out = [];
  for (let k = 0; k < 40 && out.length < max; k++) {
    const side = rr() < 0.5 ? -1 : 1, alongX = rr() < 0.5;
    const x = alongX ? -70 + rr() * 140 : side * (90.5 + rr() * 2), z = alongX ? side * (124.5 + rr() * 2) : -100 + rr() * 200;
    const fx = alongX ? 0 : -side, fz = alongX ? -side : 0;
    if (!freeSpot(x + fx * 0.75, z + fz * 0.75, 0.8, loops)) continue;
    out.push({ x, z, fx, fz, y: inRect(x, z, PLAZA) ? 0.26 : 0.22, plaza: true, elite: true });
  }
  return out;
}
const CUST_W = ['worker', 'worker', 'braces', 'jacket', 'dress'], CUST_C = ['coat', 'suit', 'dbl', 'lady', 'dress', 'furcoat', 'flapper'];
function buildVendors(rr, loops, parts, out) {
  const F = MOBILE ? 0.45 : 1;
  const spots = [...plazaSpots(rr, loops, Math.round(3 * F + 0.3)), ...wallSpots(rr, Math.round(13 * F))];
  const pools = { worker: ['suppe', 'maroni', 'punsch', 'schuh', 'suppe'], elite: ['blumen', 'zigar', 'punsch', 'schuh', 'maroni', 'wurst'], mid: ['maroni', 'wurst', 'punsch', 'blumen', 'schuh', 'wurst'] };
  const nxt = { worker: 0, elite: Math.floor(rr() * 6), mid: Math.floor(rr() * 6) };
  for (const s of spots) {
    const pool = s.worker ? 'worker' : s.elite ? 'elite' : 'mid', type = pools[pool][nxt[pool]++ % pools[pool].length], V = VEND[type];
    const yaw = Math.atan2(s.fx, s.fz), dx = s.fz, dz = -s.fx;   // dx,dz: an der Wand entlang
    const sp = { vend: true, type, V, x: s.x, z: s.z, yaw, worker: !!s.worker, peds: [], actT: rr() * 4, metT: 0 };
    LIFE.spots.push(sp); STR.vend.push(sp);   // LIFE.spots: clutter.js lässt den Platz frei, der Abstand gilt für alle
    // Stand vor dem Händler (Schuhputzer und Bauchladen: am Händler selbst)
    const atSelf = type === 'schuh' || type === 'zigar', cx = atSelf ? s.x : s.x + s.fx * 0.75, cz = atSelf ? s.z : s.z + s.fz * 0.75;
    parts.push(...placeParts(PARTS[type](), cx, cz, yaw, s.y));
    if (type !== 'zigar') addCollider(cx - 0.6, 0, cz - 0.6, cx + 0.6, 1.2, cz + 0.6);
    if (V.steam) steamPts.push({ x: cx + s.fx * 0.05, z: cz + s.fz * 0.05 });
    if (V.glow) addGlow(cx, s.y + V.glow[2], cz, V.glow[0], V.glow[1], rr(), 0);
    // Händler
    const kind = V.kid ? 'kid' : type === 'zigar' ? 'flapper' : V.fem ? (s.worker ? 'dress' : pick(['dress', 'lady'])) : s.worker ? pick(['worker', 'braces', 'jacket']) : pick(['coat', 'coat', 'jacket']);
    const man = { st: 4, x: s.x, y: s.y + (V.kid ? 0.3 : 0), z: s.z, yaw, sc: V.kid ? 0.64 : 0.94 + rr() * 0.1, v: 0, kind, act: V.act[0], busy: true, vendor: sp };
    if (V.kid) man.sit = true;
    if (kind === 'dress') man.col = s.worker ? pick([[0.3, 0.26, 0.22], [0.22, 0.2, 0.24], [0.32, 0.22, 0.16]]) : pick(DRESSES);
    else if (kind === 'worker') man.col = pick(WORKWEAR);
    else if (kind === 'flapper') man.col = [0.42, 0.06, 0.1];
    sp.seller = man; sp.peds.push(man); out.push(man);
    // Kundschaft: 0 bis 2 stehen davor und essen, trinken oder plaudern
    const nc = atSelf ? 0 : type === 'blumen' ? (rr() < 0.5 ? 1 : 0) : 1 + (rr() < 0.55 ? 1 : 0);
    for (let k = 0; k < nc; k++) {
      const u = (k - (nc - 1) / 2) * 1.1 + (rr() - 0.5) * 0.2, x = s.x + s.fx * 1.95 + dx * u, z = s.z + s.fz * 1.95 + dz * u;
      if (!freeSpot(x, z, 0.3, null, false)) continue;
      const ck = pick(s.worker ? CUST_W : CUST_C);
      const c = { st: 4, x, y: s.y, z, yaw: Math.atan2(-s.fx, -s.fz) + (rr() - 0.5) * 0.5, sc: 0.92 + rr() * 0.14, v: 0, kind: ck, act: V.cust + rr() * 0.3, cust: sp };
      if (ck === 'worker') c.col = pick(rr() < 0.5 ? SHIRTS : WORKWEAR); else if (ck === 'dress') c.col = pick(DRESSES);
      sp.peds.push(c); out.push(c);
    }
  }
}

/* =====================================================================
   2) SCHILDER UND TRANSPARENTE (eine Leinwand, ein Netz)
   ===================================================================== */
const SLOGANS = ['GERECHTER LOHN!', 'ACHT STUNDEN SIND GENUG', 'WIR BAUEN VESPERA – WIR WOLLEN LEBEN', 'BROT · KOHLE · WÄRME', 'MIETEN RUNTER!', 'DIE STADT GEHÖRT ALLEN', 'SOLIDARITÄT!', 'STREIK!'];
const BANNER = 'GERECHTER LOHN FÜR DIE ERBAUER VESPERAS', BANNER2 = 'ARBEITER VON VESPERA';
// Leinwand 1024 × 512: zwei Reihen Schilder (je 256 × 128), Transparent (1024 × 128), Zug-Transparent (512 × 128), Holz
const cellUV = i => { const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 128; return [cx / 1024, 1 - (cy + 128) / 512, (cx + 256) / 1024, 1 - cy / 512]; };
const UV_BANNER = [0, 1 - 384 / 512, 1, 1 - 256 / 512], UV_BANNER2 = [0, 0, 0.5, 1 - 384 / 512], UV_WOOD = [0.62, 0.12], UV_DARK = [0.87, 0.12];
function drawAtlas(g) {
  const fit = (txt, x, y, w, h, fg, maxF) => {
    const words = txt.split(' '); let lines = [txt], fs = maxF;
    g.font = `bold ${fs}px Georgia, serif`;
    if (g.measureText(txt).width > w * 0.88 && words.length > 1) { const m = Math.ceil(words.length / 2); lines = [words.slice(0, m).join(' '), words.slice(m).join(' ')]; }
    const wid = () => Math.max(...lines.map(l => g.measureText(l).width));
    fs = Math.min(maxF, h * 0.8 / lines.length); g.font = `bold ${fs}px Georgia, serif`;
    if (wid() > w * 0.88) { fs *= w * 0.88 / wid(); g.font = `bold ${fs}px Georgia, serif`; }
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * fs * 1.05));
  };
  const cloth = (x, y, w, h, bg, fg, txt, maxF) => {
    g.fillStyle = bg; g.fillRect(x, y, w, h);
    g.globalAlpha = 0.12; for (let k = 0; k < 40; k++) { g.fillStyle = k % 2 ? '#000' : '#fff'; g.fillRect(x + Math.random() * w, y + Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 2); } g.globalAlpha = 1;
    g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(x + 7, y + 7, w - 14, h - 14);
    fit(txt, x + 8, y + 8, w - 16, h - 16, fg, maxF);
  };
  SLOGANS.forEach((s, i) => { const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 128, red = i % 3 === 1 || i === 7; cloth(cx + 2, cy + 2, 252, 124, red ? '#7c1a1a' : '#e3d6b8', red ? '#f1e6cf' : '#2a1a12', s, 46); });
  cloth(2, 258, 1020, 124, '#7c1a1a', '#f3e9d2', BANNER, 70);
  cloth(2, 386, 508, 124, '#e3d6b8', '#6e1414', BANNER2, 56);
  g.fillStyle = '#6b4a2e'; g.fillRect(512, 384, 256, 128); g.fillStyle = '#3a2618'; g.fillRect(768, 384, 256, 128);
}
// Vorlage: Liste nicht indizierter Dreiecke [pos, nor, uv] im Körperraum der Figur (+z vorn, rechte Hand bei −x)
function geoArrays(g, uv) {
  g = g.toNonIndexed(); const P = g.attributes.position.array, N = g.attributes.normal.array, n = P.length / 3, Uv = new Float32Array(n * 2), src = g.attributes.uv.array;
  for (let i = 0; i < n; i++) {
    if (uv.length === 2) { Uv[i * 2] = uv[0]; Uv[i * 2 + 1] = uv[1]; }
    else { Uv[i * 2] = uv[0] + src[i * 2] * (uv[2] - uv[0]); Uv[i * 2 + 1] = uv[1] + src[i * 2 + 1] * (uv[3] - uv[1]); }
  }
  return { P: Array.from(P), N: Array.from(N), U: Uv };
}
function joinTpl(list) { const o = { P: [], N: [], U: [] }; for (const t of list) { o.P.push(...t.P); o.N.push(...t.N); o.U.push(...t.U); } o.n = o.P.length / 3; o.U = Float32Array.from(o.U); return o; }
function tplSign(i) {
  const uv = cellUV(i), px = -0.21, pz = 0.24;
  return joinTpl([geoArrays(new T.PlaneGeometry(0.8, 0.4).translate(px, 2.16, pz + 0.012), uv), geoArrays(new T.PlaneGeometry(0.8, 0.4).rotateY(Math.PI).translate(px, 2.16, pz - 0.012), uv),
    geoArrays(new T.BoxGeometry(0.035, 1.25, 0.035).translate(px, 1.5, pz - 0.03), UV_WOOD)]);
}
function tplBanner2() {   // vom ersten Paar des Zuges getragen (Mitte zwischen beiden)
  const L = [geoArrays(new T.PlaneGeometry(1.5, 0.42).translate(0, 2.0, 0.3), UV_BANNER2), geoArrays(new T.PlaneGeometry(1.5, 0.42).rotateY(Math.PI).translate(0, 2.0, 0.28), UV_BANNER2)];
  for (const s of [-1, 1]) L.push(geoArrays(new T.BoxGeometry(0.035, 1.5, 0.035).translate(s * 0.76, 1.48, 0.29), UV_WOOD));
  return joinTpl(L);
}
function signMesh(statics) {
  const tex = canvasTex(1024, 512, drawAtlas);
  let n = statics.n; for (const s of STR.signs) n += s.tpl.n;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  pos.set(statics.P); nor.set(statics.N); uv.set(statics.U);
  let o = statics.n; for (const s of STR.signs) { s.o = o; uv.set(s.tpl.U, o * 2); o += s.tpl.n; }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  g.boundingSphere = new T.Sphere(new T.Vector3(STR.rally.cx, 2, STR.rally.cz), 220);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, color: new T.Color(0.62, 0.6, 0.56), side: T.FrontSide }));
  m.matrixAutoUpdate = false; m.frustumCulled = true; m.statN = statics.n; m.renderOrder = 1;
  return m;
}
// Schilder an die Figuren hängen: Gierwinkel und Ort aus pd.life (L.x, L.y, L.z, L.yaw), bob = auf und ab beim Sprechchor
function updateSigns(force) {
  const m = STR.sign; if (!m) return;
  const P = m.geometry.attributes.position, A = P.array, t = performance.now() / 1000;
  let any = false;
  for (const s of STR.signs) {
    const pd = s.pd, L = pd.life, on = pd.a && pd.a.on && !pd.rag && L.vis;
    if (!on) { if (s.drawn) { A.fill(0, s.o * 3, (s.o + s.tpl.n) * 3); s.drawn = false; any = true; } continue; }
    if (!force && !L.moving && s.drawn && !(STR.chanting && s.bob)) continue;
    const c = Math.cos(L.yaw), sn = Math.sin(L.yaw), T0 = s.tpl.P, bob = STR.chanting && s.bob ? 0.12 * Math.max(0, Math.sin(t * 5 + s.ph)) : 0, y0 = L.y + bob;
    for (let i = 0, k = s.o * 3; i < T0.length; i += 3, k += 3) { const x = T0[i], y = T0[i + 1], z = T0[i + 2]; A[k] = L.x + c * x + sn * z; A[k + 1] = y0 + y; A[k + 2] = L.z - sn * x + c * z; }
    if (!s.nr) { const N = m.geometry.attributes.normal; for (let i = 0, k = s.o * 3; i < T0.length; i += 3, k += 3) { const x = s.tpl.N[i], z = s.tpl.N[i + 2]; N.array[k] = c * x + sn * z; N.array[k + 1] = s.tpl.N[i + 1]; N.array[k + 2] = -sn * x + c * z; } N.needsUpdate = true; s.nr = !L.moving; }
    s.drawn = true; any = true;
  }
  if (any) P.needsUpdate = true;
}

/* =====================================================================
   3) KUNDGEBUNG AM KNEIPENPLATZ UND DEMONSTRATIONSZUG
   ===================================================================== */
const SPEECH = ['Kollegen! Wir haben diese Türme gebaut, Stein für Stein!', 'Wer Vespera baut, soll auch in Vespera leben können!', 'Acht Stunden Arbeit, acht Stunden Schlaf, acht Stunden für uns!',
  'Die Mieten steigen, die Löhne nicht! Wie lange noch?', 'Wir wollen keine Almosen von oben. Wir wollen gerechten Lohn!', 'In der Gießerei ist es heiß wie in der Hölle, und draußen friert die Polarnacht!',
  'Oben tanzen sie im Belmont, unten schuften wir in der Kälte!', 'Solidarität, Kollegen! Allein sind wir nichts, zusammen sind wir Vespera!', 'Wir sind nicht gegen die Stadt. Wir sind die Stadt!'];
const CHANTS = ['Gerechter Lohn! Gerechter Lohn!', 'Acht Stunden! Acht Stunden!', 'Wir bauen Vespera! Wir wollen leben!', 'Brot und Kohle! Brot und Kohle!', 'Hoch die Solidarität!'];
const HIM = {
  hart: ['Da ist er! Der Herr der Türme!', 'Schaut her, Alexander kommt sich unser Viertel ansehen!', 'Zurück ins Penthouse, Alexander!', 'Hören Sie gut zu, Alexander: Wir sind nicht Ihre Maschinen!'],
  offen: ['Herr Alexander! Hören Sie uns an!', 'Da ist Alexander. Jetzt soll er zeigen, was er wert ist.', 'Herr Alexander, ein Wort mit uns? Wir beißen nicht.'],
  streik: ['Herr Alexander! Es geht nicht gegen Sie persönlich. Es geht um gerechten Lohn!', 'Herr Alexander, reden Sie mit uns, dann gehen wir zurück an die Arbeit!'],
  angst: ['Pst … er ist hier.', 'Ruhig, Leute. Keine Dummheiten, der hebt Autos hoch.'],
};
function strike() { try { return !!(KT.s && KT.s.ev && KT.s.ev.some(e => EVENTS[e.i] && EVENTS[e.i].streik)); } catch (e) { return false; } }
function unmut() {
  if (STR.force != null) return STR.force;
  if (STR.clearT > 0) return 0;
  const arb = rufGet('arbeiter');
  let L = strike() || arb < 35 ? 2 : arb < 62 ? 1 : 0;
  if (STR.calmT > 0) L = Math.max(0, L - 1);
  return L;
}
// Figuren der Kundgebung (st 10): eigener Schritt, unsichtbar, wenn die Stufe nicht reicht oder es zu weit ist
function rallyStep(pd) {
  const L = pd.life, a = pd.a;
  L.vis = STR.level >= L.lvl && near2(L.x, L.z, 340);
  if (!L.vis) { a.on = false; return; }
  if (!L.init) { L.init = true; setAct(pd, L.act); }
  pedCrowd.set(a, L.x, L.y - (pd.yo || 0), L.z, L.yaw, pd.sc, pd.tilt || 0);
}
function marchStep(pd) {
  const L = pd.life, a = pd.a, M = STR.march;
  L.vis = STR.level >= 2 && near2(M.cx, M.cz, 360);
  if (!L.vis) { a.on = false; L.moving = false; return; }
  if (!L.init) { L.init = true; const g = a.gait; g[1] = M.v * (pd.fem ? 5.4 : 4.6) / pd.sc; g[2] = pd.fem ? 0.36 : 0.4; a.gv = (a.gv | 0) + 1; }
  const [x, z, dx, dz] = perim(M, M.t - L.row * 1.35);
  L.x = x + dz * L.lat; L.z = z - dx * L.lat; L.y = 0.22;
  const want = Math.atan2(dx, dz); L.yaw = L.yaw == null ? want : L.yaw + Math.atan2(Math.sin(want - L.yaw), Math.cos(want - L.yaw)) * 0.15;
  L.moving = true;
  pedCrowd.set(a, L.x, L.y, L.z, L.yaw, pd.sc);
}
// Ort auf dem Rundweg um den Platz (Rechteck, gegen den Uhrzeigersinn): [x, z, Richtung x, Richtung z]
function perim(M, s) {
  s = ((s % M.total) + M.total) % M.total;
  for (const g of M.segs) { if (s <= g.L) return [g.a[0] + g.dx * s, g.a[1] + g.dz * s, g.dx, g.dz]; s -= g.L; }
  const g = M.segs[0]; return [g.a[0], g.a[1], g.dx, g.dz];
}
function buildRally(rr, parts, out) {
  const S = WORK.square; if (!S) return null;
  const F = MOBILE ? 0.6 : 1, y0 = 0.22;
  const sx = S.X + 54, sz = S.Z + 37, fx = -1, fz = 0, yawF = Math.atan2(fx, fz);   // Redner schaut nach Westen über den Platz
  const R = STR.rally = { x: sx, z: sz, cx: sx - 4.5, cz: sz, peds: [], speaker: null, said: 0, himT: 0, speechT: 3, cheer: 0 };
  const mk = (o, lvl, extra = {}) => { const pd = { st: 10, x: o.x, y: o.y ?? y0, z: o.z, yaw: o.yaw, sc: o.sc ?? 0.94 + rr() * 0.12, v: 0, kind: o.kind, act: o.act, demo: true, ...extra };
    if (o.col) pd.col = o.col;
    pd.life = { step: rallyStep, x: pd.x, y: pd.y, z: pd.z, yaw: pd.yaw, act: o.act, lvl, vis: false }; R.peds.push(pd); out.push(pd); return pd; };
  // Redner auf der Kiste, Transparent zwischen zwei Stangen hinter ihm
  parts.push([BX(0.75, 0.42, 0.55, sx, y0 + 0.21, sz), WOOD], [BX(0.77, 0.04, 0.57, sx, y0 + 0.4, sz), DARK]);
  R.speaker = mk({ x: sx, y: y0 + 0.42, z: sz, yaw: yawF, kind: 'braces', col: [0.32, 0.3, 0.28], act: 0.95, sc: 1.02 }, 1, { busy: true });
  // Zuhörer in Reihen vor ihm (die erste Reihe gehört zur kleinen Kundgebung)
  const KD = ['worker', 'worker', 'braces', 'jacket', 'worker', 'dress', 'jacket', 'coat'];
  const rows = [[2.8, 3], [3.8, 4], [4.9, 5], [6.0, 4]];
  let si = 0;
  for (let r = 0; r < rows.length; r++) {
    const [dist, cnt] = rows[r];
    for (let k = 0; k < cnt; k++) {
      if (MOBILE && r === 3) break;
      const u = (k - (cnt - 1) / 2) * 1.05 + (rr() - 0.5) * 0.3, dd = dist + (rr() - 0.5) * 0.3, x = sx + fx * dd - fz * u, zz = sz + fz * dd + fx * u;   // u: quer zur Blickrichtung
      if (!freeSpot(x, zz, 0.32, null, false)) continue;
      const kind = KD[Math.floor(rr() * KD.length)], sign = rr() < 0.45, lvl = r === 0 || (r === 1 && k < 2) ? 1 : 2;
      const col = kind === 'worker' ? pick(rr() < 0.5 ? SHIRTS : WORKWEAR) : kind === 'dress' ? pick([[0.3, 0.26, 0.22], [0.22, 0.2, 0.24], [0.4, 0.12, 0.12]]) : kind === 'coat' ? pick(COATS) : undefined;
      const pd = mk({ x, z: zz, yaw: Math.atan2(sx - x, sz - zz) + (rr() - 0.5) * 0.3, kind, col, act: sign ? 12.2 : 1.3 + rr() * 0.2 }, lvl);
      pd.life.sign = sign;
      if (sign) STR.signs.push({ pd, tpl: tplSign(si++ % 7), bob: true, ph: rr() * 6 });
    }
  }
  // zwei Polizisten am Rand, sie beobachten
  for (const [ox, oz] of [[-7.5, 7.4], [-8.6, 6.8]]) mk({ x: sx + ox, z: sz + oz, yaw: Math.atan2(R.cx - (sx + ox), R.cz - (sz + oz)), kind: 'police', act: 36.2 + rr() * 0.4, sc: 1 }, 1, { busy: true });
  // Demonstrationszug: zieht auf dem Gehweg um den Platzblock (zwei nebeneinander, erstes Paar mit Transparent)
  const b = S.b, i = 2.2, pts = [[b.x0 + i, b.z0 + i], [b.x0 + i, b.z1 - i], [b.x1 - i, b.z1 - i], [b.x1 - i, b.z0 + i]];
  const M = STR.march = { segs: [], total: 0, t: 0, v: 0.85, cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2, peds: [] };
  for (let k = 0; k < 4; k++) { const a = pts[k], c = pts[(k + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]); M.segs.push({ a, L, dx: (c[0] - a[0]) / L, dz: (c[1] - a[1]) / L }); M.total += L; }
  const NR = Math.round(5 * F);
  for (let r = 0; r < NR; r++) for (const lat of [-0.38, 0.38]) {
    const kind = KD[Math.floor(rr() * KD.length)], col = kind === 'worker' ? pick(SHIRTS) : kind === 'dress' ? [0.3, 0.26, 0.22] : kind === 'coat' ? pick(COATS) : undefined;
    const pd = { st: 10, x: pts[0][0], y: 0.22, z: pts[0][1], yaw: 0, sc: 0.94 + rr() * 0.1, v: 0.85, kind, demo: true, march: true };
    if (col) pd.col = col;
    pd.life = { step: marchStep, row: r, lat, x: pd.x, y: 0.22, z: pd.z, yaw: null, vis: false };
    M.peds.push(pd); out.push(pd);
    if (r > 0 && rr() < 0.5) STR.signs.push({ pd, tpl: tplSign(Math.floor(rr() * 8)), ph: rr() * 6 });
  }
  if (M.peds.length) STR.signs.push({ pd: M.peds[0], tpl: tplBanner2(), banner: true, mid: M.peds[1] });
  // feste Teile: Transparent mit zwei Stangen (Leinwand), Holz der Kiste kommt in den Ständen mit
  const st = [geoArrays(new T.PlaneGeometry(5.4, 0.72).rotateY(-Math.PI / 2).translate(sx + 1.1, 2.9, sz), UV_BANNER), geoArrays(new T.PlaneGeometry(5.4, 0.72).rotateY(Math.PI / 2).translate(sx + 1.12, 2.9, sz), UV_BANNER)];
  for (const s of [-1, 1]) st.push(geoArrays(new T.BoxGeometry(0.05, 3.3, 0.05).translate(sx + 1.11, 1.87, sz + s * 2.72), UV_DARK));
  R.statics = joinTpl(st);
  addCollider(sx - 0.38, 0, sz - 0.28, sx + 0.38, 0.62, sz + 0.28);
  return R;
}
function rallyTick(dt) {
  const R = STR.rally; if (!R) return;
  const p = player.p, d2 = (R.cx - p.x) ** 2 + (R.cz - p.z) ** 2, onFoot = !player.fly && !DRIVE.on && p.y < 4;
  const M = STR.march;
  if (M && STR.level >= 2) M.t += M.v * dt;
  if (STR.level <= 0 || d2 > 120 * 120) { STR.chanting = false; return; }
  // Rede und Sprechchor im Wechsel; die Gesten folgen
  R.speechT -= dt;
  if (R.speechT <= 0) {
    R.phase = R.phase === 'rede' ? 'chor' : 'rede'; R.speechT = R.phase === 'rede' ? 9 + Math.random() * 5 : 4.5;
    STR.chanting = R.phase === 'chor';
    for (const pd of R.peds) {
      if (!pd.a || pd.aw || pd.rag || pd.kind === 'police' || pd === R.speaker) continue;
      if (pd.life.sign) continue;
      setAct(pd, STR.chanting ? (Math.random() < 0.6 ? 3.7 : 9.2 + Math.random() * 0.4) : 1.3 + Math.random() * 0.3);
    }
    if (R.speaker.a) setAct(R.speaker, STR.chanting ? 3.7 : 0.95);
    if (d2 < 45 * 45 && free() && !(R.himT > 0)) {
      if (STR.chanting) say('Die Streikenden', strike() ? pick(['Streik! Streik! Streik!', ...CHANTS]) : pick(CHANTS), 3.6);
      else say('Der Redner', pick(SPEECH), 4.5);
    }
  }
  if (!STR.chanting && R.speaker.a && Math.random() < dt * 0.4) setAct(R.speaker, Math.random() < 0.4 ? 3.3 : 0.95);
  // Alexander kommt: alle schauen, einer ruft ihm etwas zu
  if (R.himT > 0) R.himT -= dt;
  if (onFoot && d2 < 14 * 14 && !(R.himT > 0)) {
    R.himT = 50;
    for (const pd of R.peds) if (pd.a && pd.a.on) turnHead(pd.a, p.x, p.z);
    const arb = rufGet('arbeiter'), key = rufGet('furcht') > 72 ? 'angst' : arb < 35 ? 'hart' : strike() && arb >= 50 ? 'streik' : 'offen';
    shared.sayTimer = 0; say('Aus der Menge', pick(HIM[key]), 3.8);
  }
  if (M && STR.level >= 2 && onFoot && free() && (STR.chantT -= dt) <= 0) {
    STR.chantT = 9 + Math.random() * 5;
    const [x, z] = perim(M, M.t - 2.5);
    if ((x - p.x) ** 2 + (z - p.z) ** 2 < 26 * 26) say('Der Demonstrationszug', pick(CHANTS), 3.4);
  }
}
// Gespräch mit den Streikenden (E beim Redner)
function rallyNear(p) { const R = STR.rally; return R && STR.level > 0 && !player.fly && !DRIVE.on && (R.x - p.x) ** 2 + (R.z - p.z) ** 2 < 4.2 * 4.2 && Math.abs(p.y - 0.3) < 2; }
function news(titel, text, prio, ruf) { try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik: 'Stadt', prio, ruf, ort: 'Kneipenplatz' } })); } catch (e) { /* ohne Zeitung */ } }
function rallyMenu() {
  if (STR.talkT > 0) { say('Der Redner', 'Sie haben gesagt, was Sie zu sagen hatten, Herr Alexander. Jetzt zählen Taten.', 4); return; }
  const big = STR.level >= 2;
  openChoice(big ? 'Streikkundgebung am Kneipenplatz' : 'Kundgebung am Kneipenplatz', [
    'Zuhören und höhere Löhne versprechen', 'Für die Streikkasse spenden · 2.000 Lumen', 'Eine Rede halten: „Vespera braucht euch alle“', 'Die Polizei räumen lassen'], i => {
    const R = STR.rally, sp = R.speaker; STR.talkT = 240; shared.sayTimer = 0;
    if (i === 0) {
      rufAdd({ arbeiter: 6, elite: -2 }, 'Den Streikenden höhere Löhne versprochen', { key: 'demo:lohn' });
      STR.calmT = 300; say('Der Redner', 'Wir nehmen Sie beim Wort, Herr Alexander. Vor allen Leuten hier.', 4.5);
      news('Alexander verspricht Streikenden höhere Löhne', 'Am Kneipenplatz trat Alexander vor die Kundgebung der Arbeiter und versprach bessere Löhne. Die Menge hörte zu, skeptisch, aber still. Ob den Worten Taten folgen, wird das Viertel genau beobachten.', 6, 'Extrablatt! Alexander verspricht höhere Löhne!');
      cheer(R, 0.5);
    } else if (i === 1) {
      if (!KT.s || KT.s.cash < 2000) { toast('Dafür reicht das Bargeld nicht'); STR.talkT = 0; return; }
      ktCash(-2000, 'Spende an die Streikkasse'); rufAdd({ arbeiter: 4, presse: 1, elite: -1 }, 'Für die Streikkasse gespendet', { key: 'demo:spende' });
      STR.calmT = 180; say('Der Redner', pick(['Das vergessen wir Ihnen nicht. Aber eine Spende ersetzt keinen gerechten Lohn.', 'Danke, Herr Alexander. Davon werden heute Abend viele Kinder satt.']), 4.5);
      news('Alexander spendet für die Streikkasse', 'Überraschung am Kneipenplatz: Alexander spendete zweitausend Lumen für die Streikkasse der Arbeiter. Die einen nennen es großzügig, die anderen Kleingeld für einen Mann, dem die halbe Stadt gehört.', 5);
      cheer(R, 0.8);
    } else if (i === 2) {
      const ok = Math.random() < 0.2 + rufGet('arbeiter') / 140 + rufGet('bew') / 400;
      if (ok) { rufAdd({ arbeiter: 3, presse: 1 }, 'Rede vor der Kundgebung', { key: 'demo:rede' }); say('Aus der Menge', pick(['Gut gesprochen! Jetzt halten Sie Wort!', 'Na, das klang ehrlich. Wir werden sehen.']), 4); cheer(R, 0.7); }
      else { rufAdd({ arbeiter: -1.5 }, 'Rede vor der Kundgebung ausgebuht', { key: 'demo:buh' }); say('Aus der Menge', pick(['Schöne Worte! Davon wird keiner satt!', 'Reden kann er. Zahlen auch?', 'Buh! Zurück ins Belmont!']), 4); }
      news(ok ? 'Alexander spricht zu den Arbeitern' : 'Pfiffe für Alexander am Kneipenplatz', ok ? 'Alexander stieg zu den Streikenden auf die Kiste und sprach von einer Stadt, die alle braucht. Viele klatschten, manche blieben stumm.' : 'Alexanders Rede vor der Kundgebung ging in Pfiffen unter. „Schöne Worte“, rief einer, „davon wird keiner satt.“', 5);
      if (sp && sp.a) turnHead(sp.a, player.p.x, player.p.z);
    } else {
      rufAdd({ arbeiter: -9, furcht: 4, presse: -3, elite: 1, unter: 3 }, 'Kundgebung von der Polizei geräumt', { key: 'demo:raeumen' });
      say('Ein Polizist', 'Zu Befehl, Herr Alexander! Auseinander, Leute, die Kundgebung ist beendet!', 4);
      STR.clearT = 600;
      news('Polizei räumt Kundgebung am Kneipenplatz', 'Auf Alexanders Wunsch löste die Polizei die Kundgebung der Arbeiter am Kneipenplatz auf. Es blieb friedlich, doch im Viertel ist die Stimmung gereizt. „So behandelt man die, die seine Türme bauen“, sagte ein Arbeiter dem Kurier.', 7, 'Extrablatt! Polizei räumt den Kneipenplatz!');
    }
  });
}
function cheer(R, k) { for (const pd of R.peds) if (pd.a && pd.a.on && pd.kind !== 'police' && pd !== R.speaker && !pd.life.sign && Math.random() < k) setAct(pd, 9.2 + Math.random() * 0.4); R.speechT = 4; R.phase = 'chor'; STR.chanting = false; }

/* =====================================================================
   4) HÄNDLER IM TAKT: Gesten, Rufe, Begrüßung, Kaufen (E)
   ===================================================================== */
function vendTick(dt) {
  const p = player.p, onFoot = !player.fly && !DRIVE.on;
  STR.callT -= dt; STR.greetT -= dt;
  let best = null, bd = 1e9;
  for (const v of STR.vend) {
    const d2 = (v.x - p.x) ** 2 + (v.z - p.z) ** 2;
    if (d2 > 110 * 110) continue;
    if ((v.actT -= dt) <= 0) {
      v.actT = 3 + Math.random() * 4;
      const s = v.seller; if (s.a && !s.aw && !s.rag) setAct(s, Math.random() < 0.65 ? v.V.act[0] : v.V.act[1]);
      for (const c of v.peds) if (c !== s && c.a && !c.aw && !c.rag && Math.random() < 0.3) setAct(c, Math.random() < 0.7 ? v.V.cust + Math.random() * 0.3 : 0.9);
    }
    if (d2 < bd) { bd = d2; best = v; }
  }
  if (!best || !onFoot || Math.abs(p.y - 0.3) > 3) return;
  const s = best.seller;
  if (bd < 4.5 * 4.5 && (best.metT || 0) < performance.now() / 1000 && free()) {
    best.metT = performance.now() / 1000 + 60;
    const att = attOf(s), L = att === 'bew' && best.V.him ? [best.V.him] : GREET[att] || GREET.resp;
    if (s.a) turnHead(s.a, p.x, p.z);
    say(best.V.who, pick(L), 3.6); STR.callT = Math.max(STR.callT, 8);
  } else if (bd < 18 * 18 && STR.callT <= 0 && free()) {
    STR.callT = 12 + Math.random() * 9;
    if (say(best.V.who, pick(best.V.calls), 3.2) && s.a && !s.aw) setAct(s, best.V.act[1]);
  }
}
function vendNear(p) {
  if (player.fly || DRIVE.on) return null;
  for (const v of STR.vend) { const ax = v.type === 'schuh' || v.type === 'zigar' ? v.x + Math.sin(v.yaw) * 0.6 : v.x + Math.sin(v.yaw) * 1.3, az = v.type === 'schuh' || v.type === 'zigar' ? v.z + Math.cos(v.yaw) * 0.6 : v.z + Math.cos(v.yaw) * 1.3;
    if ((ax - p.x) ** 2 + (az - p.z) ** 2 < 2.0 * 2.0 && Math.abs(p.y - 0.3) < 2) return v; }
  return null;
}
function vendMenu(v) {
  const V = v.V, s = v.seller, grp = v.worker ? 'arbeiter' : 'buerger', att = attOf(s), round = Math.max(8, V.price * 12), tip = 50;
  if (s.a) turnHead(s.a, player.p.x, player.p.z);
  openChoice(`${V.who.replace(/^(Der|Die|Das) /, '')} · ${V.ware}`, [`${V.buy[0].toUpperCase() + V.buy.slice(1)} · ${fmP(V.price)}`, `Eine Runde für alle hier · ${fmP(round)}`, `Großzügig zahlen: ${tip} Lumen, Rest behalten`], i => {
    if (!KT.s) return;
    shared.sayTimer = 0;
    if (i === 0) {
      ktCash(-V.price, `${V.ware} am Straßenstand`); rufAdd({ [grp]: 0.2 }, 'Am Straßenstand gekauft', { key: 'str:kauf', quiet: true });
      say(V.who, THANKS[att] || THANKS.resp, 3.4); setTimeout(() => toast(V.eat), 2600);
    } else if (i === 1) {
      ktCash(-round, 'Eine Runde am Straßenstand'); rufAdd({ [grp]: 1.2 }, 'Eine Runde am Straßenstand spendiert', { key: 'str:runde' });
      for (const c of v.peds) if (c !== s && c.a && !c.aw) { setAct(c, 9.3); turnHead(c.a, player.p.x, player.p.z); }
      const cool = ['hass', 'skep', 'neid'].includes(att);
      say(v.peds.length > 1 ? 'Die Kundschaft' : V.who, pick(cool ? ROUND_COOL : ROUND), 3.4);
      setTimeout(() => { for (const c of v.peds) if (c !== s && c.a && !c.aw) setAct(c, V.cust); }, 3500);
    } else {
      ktCash(-tip, 'Trinkgeld am Straßenstand'); rufAdd({ [grp]: 0.8 }, 'Großzügiges Trinkgeld am Straßenstand', { key: 'str:tip' });
      say(V.who, TIPS[att] || TIPS.resp, 4);
      if ((att === 'neid' || att === 'skep' || att === 'furcht') && Math.random() < 0.6) s.att = v.worker ? 'resp' : 'bew';   // das Bild von ihm wird freundlicher, nicht bei Hass
      setTimeout(() => toast(V.eat), 3000);
    }
  });
}

/* =====================================================================
   5) AUFBAU UND TAKT
   ===================================================================== */
export function strassePeds(loops) {
  const rr = mulberry32(7272), parts = [], out = [];
  buildVendors(rr, loops, parts, out);
  try { buildRally(rr, parts, out); } catch (e) { console.warn('Kundgebung:', e); STR.rally = null; }
  if (parts.length) { STR.mesh = lifeMesh(parts); scene.add(STR.mesh); }
  if (STR.rally) { STR.sign = signMesh(STR.rally.statics); scene.add(STR.sign); }
  try { const q = new URLSearchParams(location.search).get('kundgebung'); if (q != null && q !== '') STR.force = Math.max(0, Math.min(2, +q || 0)); } catch (e) { /* ohne Adresse */ }
  return out;
}
function setup() {
  STR.ready = true;
  INTERACT.push({ test: p => !!(STR.pick = vendNear(p)), get label() { const v = STR.pick; return v ? `Am Stand: ${v.V.ware} · ${v.V.who.replace(/^(Der|Die|Das) /, '')}` : ''; }, act: () => STR.pick && vendMenu(STR.pick) });
  INTERACT.push({ test: p => rallyNear(p), get label() { return STR.level >= 2 ? 'Mit den Streikenden sprechen' : 'Mit dem Redner der Kundgebung sprechen'; }, act: rallyMenu });
  KARTE.liveHooks.push((L, lay) => { const R = STR.rally; if (R && lay.orte && STR.level > 0) L.push({ cat: 'orte', icon: 'ort', n: STR.level >= 2 ? 'Streikkundgebung' : 'Kundgebung der Arbeiter', sub: STR.level >= 2 ? 'Kneipenplatz · große Kundgebung und Demonstrationszug' : 'Kneipenplatz · ein Redner und ein paar Dutzend Zuhörer', x: R.x, z: R.z }); });
  if (window.vespera && !window.vespera.strasse) window.vespera.strasse = { STR, level: v => { STR.force = v == null ? null : v; STR.lvlT = 0; } };
}
export function strasseTick(dt) {
  if (!STR.ready) { if (!playing) return; setup(); }
  if (paused) return;
  if (STR.calmT > 0) STR.calmT -= dt; if (STR.clearT > 0) STR.clearT -= dt; if (STR.talkT > 0) STR.talkT -= dt;
  if ((STR.lvlT -= dt) <= 0) {
    STR.lvlT = 2;
    const L = unmut();
    if (L !== STR.level) {
      if (L >= 2 && STR.newsLvl < 2 && STR.level >= 0 && STR.force == null) news(strike() ? 'Streik! Arbeiter ziehen durch das Viertel' : 'Großkundgebung am Kneipenplatz', strike() ? 'Seit heute Abend ruht die Arbeit. Die Streikenden versammeln sich am Kneipenplatz und ziehen mit Transparenten um den Block. Sie fordern gerechten Lohn und kürzere Schichten.' : 'Im Arbeiterviertel wächst der Unmut. Hunderte versammelten sich am Kneipenplatz und forderten bessere Löhne. Der Protest blieb friedlich.', 6, 'Extrablatt! Kundgebung am Kneipenplatz!');
      if (L >= 2) STR.newsLvl = 2;
      STR.level = L;
      updateSigns(true);
    }
  }
  try { vendTick(dt); } catch (e) { console.warn('Händler:', e); }
  if (STR.rally) {
    try { rallyTick(dt); } catch (e) { console.warn('Kundgebung:', e); }
    const vis = STR.level > 0 && near2(STR.rally.cx, STR.rally.cz, 380);   // die Figuren verschwinden ab 340 bis 360 m
    if (STR.sign) STR.sign.visible = vis;
    if (vis) { syncBanner(); updateSigns(false); }
  }
}
// Transparent des Zuges: zwischen dem ersten Paar (Mitte, Blickrichtung des Ersten)
function syncBanner() {
  for (const s of STR.signs) {
    if (!s.banner) continue;
    const A = s.pd.life, B = s.mid.life;
    if (!s.box) { s.box = { vis: false, moving: true }; s.real = s.pd; s.pd = { a: s.real.a, life: s.box }; }
    const X = s.box; X.vis = A.vis && B.vis; X.x = (A.x + B.x) / 2; X.z = (A.z + B.z) / 2; X.y = 0.22; X.yaw = A.yaw ?? 0; X.moving = true;
    s.pd.a = s.real.a;
  }
}
LIFE.extraPeds.push(strassePeds);
LIFE.ticks.push(strasseTick);
