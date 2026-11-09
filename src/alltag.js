/* =====================================================================
   V76 · LEBENDE STADT: Tagesabläufe, Schichten, Feierabend
   Vespera liegt in der Polarnacht, also gibt die STADTUHR den Takt
   (ragdoll.js CLOCK: eine echte Sekunde ist eine Spielminute, ein Tag
   dauert 24 Minuten). Diese Datei hängt vier Dinge an die Uhr:

   1) SCHICHTARBEITER. Jede Fabrik im Industriegebiet hat drei Schichten
      (Früh 6 bis 14, Spät 14 bis 22, Nacht 22 bis 6 Uhr). Die Arbeiter
      sind Bewohner mit Namen (ragdoll.js citizens): sie wohnen hinter
      einer echten Haustür in der Nähe, gehen so los, dass sie kurz vor
      der Sirene durchs Werkstor kommen, verschwinden durch die Hallentür,
      machen im Hof Pause, und gehen nach der Schicht in ihre Stammkneipe
      oder nach Hause. Zum Schichtwechsel heult die Sirene, die eine
      Schicht strömt hinaus, die nächste hinein. Dazu ein paar Leute vom
      Kneipenplatz, die tagsüber in den Werkstätten arbeiten und abends
      in der Brass Lantern sitzen.
   2) STADTPULS. Passanten, Grüppchen vor Lokalen und Terrassengäste
      sind je nach Uhrzeit und Viertel da oder nicht: nachts um vier ist
      es still, zum Feierabend ist die Stadt voll, vor den Kneipen stehen
      abends Raucher. Gewechselt wird nur außer Sichtweite. Um 19:30 Uhr
      (Spielstart) ist alles so voll wie bisher.
   3) LOKALE. Brass Lantern, Restaurant Aurora und Café Kranich füllen
      und leeren sich nach der Uhr (eating.js updateGuestFlow bekommt
      eine Zielbelegung); die Kneipe ist nach Schichtende am vollsten.
   4) RUF UND STREIK. Bei Streik (Kontor-Ereignis oder Ruf bei den
      Arbeitern unter 30) stehen Streikposten mit Transparent vor den
      Werkstoren, die Höfe sind leer, die Kneipen voll. E am Werkstor:
      zum Schichtwechsel mit den Arbeitern reden, bei Streik mit den
      Posten verhandeln. Wie sie Alexander am Tor und in der Kneipe
      empfangen, hängt vom Ruf ab; fürchtet ihn die Stadt, sind die
      Straßen nachts leerer.
   Kanon (V66): Alexander ist ein reicher Kapitalist, kein Held. Die
   Arbeiter sind keine Karikaturen, ihr Unmut ist verständlich.
   Kein neuer Shader-Code: nur vorhandene Figuren und Handlungen, die
   Hallentüren sind ein Netz, die Transparente teilen sich eine Leinwand.
   Test: ?uhr=13:50 stellt die Uhr, ?streik=1 erzwingt den Streik;
   Konsole window.vespera.alltag. Prüfung: tools/alltag-test.js.
   ===================================================================== */
import { T, MOBILE, mulberry32, scene, shared, camera, canvasTex, mergeGeos } from './core.js';
import { blocks } from './island.js';
import { DOORS } from './entrances.js';
import { FACTORIES, FACTORY_NAMES, FACTORY_LOOPS, FACTORY_IDLERS } from './shops.js';
import { addGlow, trees, lamps } from './facade-shader.js';
import { nearBoxes } from './people-skeleton.js';
import { peds, setAct, turnHead, CHATS, SHIRTS, WORKWEAR, COATS } from './serpentine.js';
import { CLOCK, CIT_HOOKS, CIT_SAY, CIT_TASKS, citizenPath, citizenGoal, citGait, perimT, perimP, TRAITS, FIRST_M, FIRST_F, LAST } from './ragdoll.js';
import { player } from './player.js';
import { LIFE, lifeMesh, lifeSay } from './life.js';
import { INTERACT } from './music.js';
import { VENUES, DINE, openChoice } from './venues.js';
import { setSit, DRIVE } from './eating.js';
import { KT, ktCash, EVENTS } from './kontor.js';
import { rufGet, rufAdd } from './ruf.js';
import { WORK } from './workers.js';
import { KARTE } from './karte.js';
import { toast } from './boat.js';
import { playing, paused } from './input.js';
import { PORT_LOOPS } from './harbour.js';
import { WL } from './wetterlage.js';
import { SND, audioCtx, audioBus } from './audio.js';
import { addTasten } from './pausemenu.js';

export const SCHICHT = [{ n: 'Frühschicht', s: 360 }, { n: 'Spätschicht', s: 840 }, { n: 'Nachtschicht', s: 1320 }];
export const AT = { ready: false, res: [], fac: [], lokal: null, puls: [], pi: 0, d: {}, dT: 0, struck: new Set(), hafen: false, strikeT: 0, force: null, calmT: 0,
  lastMin: -1, wave: -1, gateSaid: '', talkT: 0, pubT: 0, bierT: 0, occT: 0, chantT: 5, door: null, pick: null, extra: [], stats: { parked: 0 } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const free = () => shared.sayTimer <= 0.3 && LIFE.sayT <= 0;
function say(who, s, dur) { if (!lifeSay(who, s, dur ?? Math.max(3, s.length / 14 + 1))) return false; LIFE.sayT = Math.max(LIFE.sayT, 4); return true; }
function news(titel, text, prio, ruf, ort = 'Industriegebiet Ost') { try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik: 'Stadt', prio, ruf, ort } })); } catch (e) { /* ohne Zeitung */ } }
const onFoot = () => !player.fly && !DRIVE.on && player.p.y < 4;
const arbTier = () => { const a = rufGet('arbeiter'); return a >= 65 ? 'hoch' : a < 40 ? 'tief' : 'mittel'; };

/* =====================================================================
   1) DIE UHR
   ===================================================================== */
export const hourNow = () => (CLOCK.min % 1440) / 60;
export function tagesabschnitt(h = hourNow()) { return h < 5 ? 'Nacht' : h < 9 ? 'Morgen' : h < 12 ? 'Vormittag' : h < 14 ? 'Mittag' : h < 18 ? 'Nachmittag' : h < 23 ? 'Abend' : 'Nacht'; }
export function schichtNow(m = CLOCK.min % 1440) { return m < 360 ? 2 : m < 840 ? 0 : m < 1320 ? 1 : 2; }
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// Anzeige oben rechts (performance.js): Uhrzeit und Tagesabschnitt, denn am Himmel sieht man die Stunde nicht
shared.clockText = () => hhmm(Math.floor(CLOCK.min)) + ' Uhr · ' + tagesabschnitt();
// Minuten bis zum nächsten Schichtwechsel und dessen Nummer
export function naechsterWechsel(m = CLOCK.min % 1440) {
  let best = 0, bd = 1e9;
  SCHICHT.forEach((S, i) => { const d = (S.s - m + 1440) % 1440; if (d < bd) { bd = d; best = i; } });
  return [best, bd];
}
// im Fenster um den Schichtwechsel (14 Minuten davor bis 12 danach)? liefert die neue Schicht oder -1
function wechselFenster(m = CLOCK.min % 1440) {
  for (let i = 0; i < 3; i++) { const d = (m - SCHICHT[i].s + 1440) % 1440; if (d < 12 || d > 1440 - 14) return i; }
  return -1;
}

/* =====================================================================
   2) ORTE: Haustüren, Kneipen, Werkstätten, Werkstore
   ===================================================================== */
const isWorkerBlock = b => !!b && !b.factory && !b.park && (b.worker || ((b.tier || 'fabric') === 'fabric' && b.d > 650));
function blockOf(x, z) { for (const b of blocks) if (x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5) return b; return null; }
const PUBS = ['Zum Kessel', 'Schlote-Stube', 'Zur Laterne', 'Der Rote Hahn', 'Zum Anker', 'Zur Schicht', 'Zum Hammer', 'Kohlenkeller', 'Zur Stechuhr', 'Zum Schwungrad', 'Polarstern', 'Zur Esse', 'Nordlicht-Stube', 'Zum Nietenkopf', 'Drei Schlote', 'Zur Sirene'];
const SHOPS = ['Schlosserei Keller', 'Werkstatt Bauer', 'Schmiede Brandt', 'Tischlerei Novak', 'Klempnerei Roth', 'Sattlerei Lang', 'Wagnerei Vogel', 'Kesselflickerei Stein'];
let pubN = 0, shopN = 0;
// Ort aus einer Tür: Punkt auf dem Gehweg davor, Punkt hinter der Tür, Block
function doorPlace(d) {
  if (d.atPlace !== undefined) return d.atPlace;
  const b = blockOf(d.x - d.nx * 1.5, d.z - d.nz * 1.5);
  if (!b || b.factory) return d.atPlace = null;
  const [x, z] = perimP(b, perimT(b, d.x, d.z));
  if (Math.hypot(x - d.x, z - d.z) > 5.5) return d.atPlace = null;   // Tür im Hof oder in einer Gasse: kein Weg vom Gehweg
  const pub = d.kind === 'pub' || d.kind === 'bar';
  if (!d.name && pub) d.name = PUBS[pubN++ % PUBS.length]; else if (!d.name && d.kind === 'workshop') d.name = SHOPS[shopN++ % SHOPS.length];
  return d.atPlace = { x, z, ix: d.x - d.nx * 1.5, iz: d.z - d.nz * 1.5, b, name: d.kind === 'house' ? 'Zuhause' : d.name, kind: d.kind === 'house' ? 'home' : d.kind, door: d };
}
// die K nächsten Türen einer Art um einen Punkt (nur solche mit Gehweg davor)
function nearDoors(kinds, x, z, K, ok) {
  const L = [];
  for (const d of DOORS) { if (!kinds.includes(d.kind)) continue; const dd = (d.x - x) ** 2 + (d.z - z) ** 2; if (dd < 420 * 420) L.push([dd, d]); }
  L.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [, d] of L) { const p = doorPlace(d); if (p && (!ok || ok(p))) { out.push(p); if (out.length >= K) break; } }
  return out;
}
const WERK = {
  STAHLWERK: ['im Stahlwerk', 'dem Stahlwerk', 'Stahlwerker', 'Stahlwerkerin'], GIESSEREI: ['in der Gießerei', 'der Gießerei', 'Gießer', 'Gießerin'],
  TURBINENBAU: ['im Turbinenbau', 'dem Turbinenbau', 'Turbinenbauer', 'Turbinenbauerin'], LUFTSCHIFFWERFT: ['in der Luftschiffwerft', 'der Luftschiffwerft', 'Werftarbeiter', 'Werftarbeiterin'],
  MASCHINENFABRIK: ['in der Maschinenfabrik', 'der Maschinenfabrik', 'Maschinenschlosser', 'Maschinenschlosserin'], BRAUEREI: ['in der Brauerei', 'der Brauerei', 'Brauer', 'Brauerin'],
  DRUCKEREI: ['in der Druckerei', 'der Druckerei', 'Drucker', 'Setzerin'], KABELWERK: ['im Kabelwerk', 'dem Kabelwerk', 'Kabelwerker', 'Kabelwerkerin'],
  'GLASHÜTTE': ['in der Glashütte', 'der Glashütte', 'Glasbläser', 'Glasbläserin'], RADIOWERK: ['im Radiowerk', 'dem Radiowerk', 'Radiomonteur', 'Radiomonteurin'],
  LOKOMOTIVBAU: ['im Lokomotivbau', 'dem Lokomotivbau', 'Lokomotivbauer', 'Lokomotivbauerin'], 'MÜHLE': ['in der Mühle', 'der Mühle', 'Müller', 'Müllerin'],
};
const werkOf = name => WERK[name] || ['in der Fabrik', 'der Fabrik', 'Fabrikarbeiter', 'Fabrikarbeiterin'];
const nice = name => name.charAt(0) + name.slice(1).toLowerCase();

/* ---------- Wege: Orte mit "via" liegen abseits des Gehwegs (Hallentür im Fabrikhof, Kneipe am Platz) ---------- */
function route(A, B) {
  const a = A.street || A, b = B.street || B, P = [[A.x, A.z]];
  if (A.via) for (let i = A.via.length - 1; i >= 0; i--) P.push(A.via[i]);
  for (const q of citizenPath(a, b)) P.push(q);
  if (B.via) for (const q of B.via) P.push(q);
  P.push([B.x, B.z]);
  return P;
}
const pathLen = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
const mins = (A, B, c) => pathLen(route(A, B)) / c.v + 5;   // eine Spielminute ist eine Sekunde

/* =====================================================================
   3) BEWOHNER ANLEGEN (Haken in ragdoll.js buildCitizens)
   ===================================================================== */
const DARK_DRESS = [[0.3, 0.26, 0.22], [0.22, 0.2, 0.24], [0.32, 0.22, 0.16], [0.2, 0.24, 0.28], [0.36, 0.14, 0.14]];
function mkCit(rc, o) {
  const pickR = a => a[Math.floor(rc() * a.length)], female = o.female ?? rc() < 0.3, trait = pickR(TRAITS);
  const kind = female ? 'dress' : 'worker', col = female ? pickR(DARK_DRESS) : pickR(rc() < 0.5 ? SHIRTS : WORKWEAR);
  const c = { name: (female ? pickR(FIRST_F) : pickR(FIRST_M)) + ' ' + pickR(LAST), age: 18 + Math.floor(rc() * 42), female, trait, jk: o.jk, job: '', plan: [],
    at: null, v: (1.15 + rc() * 0.35) * trait.v, st: 'in', wait: rc() * 30, path: null, cur: null, kind, col };
  c.ped = { st: 6, kind, col, v: c.v, sc: 0.94 + rc() * 0.12, cit: c };
  return c;
}
const wrapPlan = P => P.map(([m, a]) => [((Math.round(m) % 1440) + 1440) % 1440, a]).sort((x, y) => x[0] - y[0]);
function settle(c) { c.goal = citizenGoal(c); c.place = c.at[c.goal]; c.st = 'in'; c.path = null; c.pos = null; c.tk = null; c.errand = null; }
// Schichtarbeiter: Wohnung und Stammkneipe nah am Werk, Aufbruch so, dass er kurz vor der Sirene am Tor ist
function makeShift(c, F, s, rc) {
  const pickR = a => a[Math.floor(rc() * a.length)], W = werkOf(F.name);
  const home = pickR(F.homes), bar = pickR(F.pubs);
  c.at = { work: F.place, home, bar, eat: bar };
  c.jk = 'Fabrikarbeiter'; c.job = (c.female ? W[3] : W[2]) + ' · ' + SCHICHT[s].n;
  c.res = { type: 'schicht', fi: F.i, s, pathOk: null };
  const S = SCHICHT[s].s, E = S + 480, Thw = mins(home, F.place, c), Twb = mins(F.place, bar, c), goBar = rc() < (s === 2 ? 0.4 : 0.62);
  const plan = [[S - Thw - 4 - rc() * 9, 'work']];
  if (goBar) plan.push([E + 1 + rc() * 5, 'bar'], [E + Twb + 45 + rc() * 75, 'home']); else plan.push([E + 1 + rc() * 5, 'home']);
  c.plan = wrapPlan(plan); c.res.thw = Thw; c.doingFn = doing;
  settle(c);
}
function buildFactories() {
  const parts = [], tex = canvasTex(1024, 96, (g, w, h) => {
    g.fillStyle = '#7c1a1a'; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.12; for (let k = 0; k < 60; k++) { g.fillStyle = k % 2 ? '#000' : '#fff'; g.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 40, 1 + Math.random() * 2); } g.globalAlpha = 1;
    g.strokeStyle = '#f1e6cf'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#f3e9d2'; g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STREIK · DIESES WERK STEHT STILL', w / 2, h / 2 + 2);
  });
  const bGeo = mergeGeos([new T.PlaneGeometry(9.6, 0.9), new T.PlaneGeometry(9.6, 0.9).rotateY(Math.PI)]);
  const bMat = new T.MeshBasicMaterial({ map: tex, color: new T.Color(0.62, 0.6, 0.56) });
  FACTORIES.forEach((f, i) => {
    const b = f.b; if (!b) return;
    const iz0 = b.z0 + 4.5, dz = iz0 + 5.9, name = FACTORY_NAMES[i % FACTORY_NAMES.length];
    const street = { x: f.gx, z: b.z0 + 2.2, b };
    const place = { x: f.wallX + f.dir * 1.1, z: dz, ix: f.wallX - f.dir * 0.5, iz: dz, b, name, kind: 'factory', fi: i, street, via: [[f.gx, iz0 + 0.3], [f.gx, dz]] };
    // Hallentür zum Hof: dunkle Öffnung mit Sturz, Lampe darüber
    const dx = f.wallX + f.dir * 0.1;
    parts.push([new T.BoxGeometry(0.3, 2.5, 1.6).translate(dx, 0.22 + 1.25, dz), [0.03, 0.028, 0.026]], [new T.BoxGeometry(0.4, 0.22, 2.1).translate(dx, 0.22 + 2.62, dz), [0.32, 0.23, 0.12]]);
    for (const s of [-1, 1]) parts.push([new T.BoxGeometry(0.4, 2.5, 0.2).translate(dx, 0.22 + 1.25, dz + s * 0.9), [0.32, 0.23, 0.12]]);
    parts.push([new T.BoxGeometry(0.16, 0.2, 0.16).translate(f.wallX + f.dir * 0.35, 3.25, dz), [1.9, 1.35, 0.7]]);
    addGlow(f.wallX + f.dir * 0.5, 3.25, dz, [1.3, 0.85, 0.45], 1.3, Math.random(), 0);
    // Streikposten: Plätze auf dem Gehweg vor dem Tor, Transparent zwischen den Torpfeilern
    const slots = []; for (let k = 0; k < 14; k++) slots.push({ x: f.gx + (k - 6.5) * 1.05 + (Math.random() - 0.5) * 0.3, z: b.z0 + 1.35 + (k % 2) * 0.95, yaw: Math.PI + (Math.random() - 0.5) * 0.7, by: null });
    const ban = new T.Mesh(bGeo, bMat); ban.position.set(f.gx, 3.05, b.z0 + 4.2); ban.updateMatrix(); ban.matrixAutoUpdate = false; ban.visible = false; scene.add(ban);
    AT.fac.push({ i, f, b, name, place, street, slots, ban, homes: [], pubs: [], n: [0, 0, 0] });
  });
  if (parts.length) { AT.door = lifeMesh(parts); scene.add(AT.door); }
}
function buildResidents(citizens, places) {
  const rc = mulberry32(7676);
  buildFactories();
  for (const F of AT.fac) {
    // die Wohnungen und Kneipen mit dem kürzesten Fußweg zum Werk (Luftlinie täuscht: der Weg führt um die Blöcke)
    const byWalk = (L, n) => L.map(p => [pathLen(route(p, F.place)), p]).sort((a, b) => a[0] - b[0]).slice(0, n).map(o => o[1]);
    F.homes = byWalk(nearDoors(['house'], F.street.x, F.street.z, 36), 10);
    F.pubs = byWalk(nearDoors(['pub', 'bar'], F.street.x, F.street.z, 10), 3);
  }
  const FAC = AT.fac.filter(F => F.homes.length && F.pubs.length);
  // die Fabrikarbeiter, die es schon gibt, bekommen eine Schicht
  for (const c of citizens) {
    if (c.jk !== 'Fabrikarbeiter') continue;
    const F = AT.fac[places.factory.indexOf(c.at.work)]; if (!F || !FAC.includes(F)) continue;
    const s = F.n.indexOf(Math.min(...F.n)); F.n[s]++;
    c.ped.kind = c.kind = c.female ? 'dress' : 'worker'; if (c.female) c.ped.col = c.col = DARK_DRESS[Math.floor(rc() * DARK_DRESS.length)];
    makeShift(c, F, s, rc); AT.res.push(c);
  }
  const PER = MOBILE ? 2 : 5;
  for (const F of FAC) for (let s = 0; s < 3; s++) while (F.n[s] < PER) {
    const c = mkCit(rc, { jk: 'Fabrikarbeiter' }); F.n[s]++;
    makeShift(c, F, s, rc); citizens.push(c); AT.res.push(c);
  }
  // Kneipenplatz: Leute aus den Mietshäusern, tagsüber in den Werkstätten, abends in der Brass Lantern
  const S = WORK.square, V = VENUES.find(v => v.kind === 'bar' && v.pub);
  if (S && V) {
    const b = S.b, sx = V.x + 4.5, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const lokal = AT.lokal = { x: V.x, z: V.z1 + 3.3, ix: V.x, iz: V.z1 + 0.2, b, name: 'The Brass Lantern', kind: 'pub', street: { x: sx, z: b.z1 - 2.2, b }, via: [[sx, V.z1 + 3.6]], V };
    const homes = nearDoors(['house'], cx, cz, 18), shops = nearDoors(['workshop', 'shop'], cx, cz, 8);
    const N = homes.length && shops.length ? (MOBILE ? 9 : 24) : 0;
    for (let k = 0; k < N; k++) {
      const c = mkCit(rc, { jk: 'Handwerker', female: rc() < 0.35 }), home = homes[Math.floor(rc() * homes.length)], work = shops[Math.floor(rc() * shops.length)];
      c.at = { work, home, bar: lokal, eat: lokal };
      c.job = c.female ? ['Näherin', 'Wäscherin', 'Plätterin', 'Verkäuferin'][Math.floor(rc() * 4)] : ['Schlosser', 'Mechaniker', 'Tischler', 'Klempner', 'Kutscher'][Math.floor(rc() * 5)];
      c.res = { type: 'viertel', pathOk: null };
      const Thw = mins(home, work, c), Twb = mins(work, lokal, c), Thb = mins(home, lokal, c);
      c.plan = wrapPlan(rc() < 0.6 ? [[420 - Thw + rc() * 20, 'work'], [960 + rc() * 25, 'bar'], [960 + Twb + 80 + rc() * 110, 'home']]
        : [[420 - Thw + rc() * 20, 'work'], [950 + rc() * 25, 'home'], [1125 + rc() * 70 - Thb, 'bar'], [1300 + rc() * 80, 'home']]);
      c.doingFn = doing; settle(c); citizens.push(c); AT.res.push(c);
    }
  }
  CIT_TASKS.Handwerker = [24, 27, 38, 25];
}
CIT_HOOKS.push(buildResidents);

/* ---------- Raucher vor den Kneipen (nur abends da) und mehr Gäste für die Brass Lantern (Haken in life.js) ---------- */
function clear(x, z, r) {
  if (LIFE.spots.some(s => Math.hypot(s.x - x, s.z - z) < 2.6)) return false;
  if (trees.some(t => Math.abs(t.x - x) < r + 1.2 && Math.abs(t.z - z) < r + 1.2)) return false;
  if (lamps.some(l => Math.abs(l.x - x) < r + 0.7 && Math.abs(l.z - z) < r + 0.7)) return false;
  for (const b of nearBoxes(x, z, r + 1)) {
    if (b.y1 < 0.6 || b.y0 > 2.2) continue;
    const dx = Math.max(b.x0 - x, 0, x - b.x1), dz = Math.max(b.z0 - z, 0, z - b.z1);
    if (dx * dx + dz * dz < r * r) return false;
  }
  return true;
}
function alltagPeds() {
  const rr = mulberry32(7677), out = [], F = MOBILE ? 0.35 : 1, pk = a => a[Math.floor(rr() * a.length)];
  for (const d of DOORS) {
    if (d.kind !== 'pub' && d.kind !== 'bar') continue;
    if (Math.hypot(d.x, d.z) > 980 || rr() > 0.6 * F) continue;
    const side = rr() < 0.5 ? -1 : 1, tx = d.nz * side, tz = -d.nx * side, n = rr() < 0.6 ? 2 : 1, u = 0.5 + rr() * 0.45;
    const b = blockOf(d.x - d.nx * 1.5, d.z - d.nz * 1.5), worker = d.kind === 'pub' && isWorkerBlock(b);
    const cx = d.x + d.nx * 0.8 + tx * 3.5, cz = d.z + d.nz * 0.8 + tz * 3.5;
    for (let k = 0; k < n; k++) {
      const s = n === 2 ? (k ? 1 : -1) : 0, x = cx + tx * 0.48 * s, z = cz + tz * 0.48 * s;
      if (!clear(x, z, 0.3)) continue;
      const kind = worker ? pk(['worker', 'worker', 'braces', 'jacket']) : pk(['coat', 'suit', 'dbl', 'coat', 'flapper', 'lady']);
      const pd = { st: 4, x, y: 0.22, z, yaw: n === 2 ? Math.atan2(-tx * s, -tz * s) + (rr() - 0.5) * 0.3 : Math.atan2(d.nx, d.nz) + (rr() - 0.5) * 0.7, sc: 0.93 + rr() * 0.12, v: 0, kind, act: pk([15.3, 15.5, 0.7, 0.9, 17.4, 1.5]), pulsPre: { k: 'kneipe', u } };
      if (kind === 'worker') pd.col = pk(rr() < 0.5 ? SHIRTS : WORKWEAR); else if (kind === 'coat') pd.col = pk(COATS);
      out.push(pd); AT.extra.push(pd);
    }
  }
  // Brass Lantern: zusätzliche Gäste, die erst am Abend hereinkommen (Platz und Weg über eating.js updateGuestFlow)
  const V = VENUES.find(v => v.kind === 'bar' && v.seats && v.seats.length);
  if (V) for (let k = 0; k < (MOBILE ? 5 : 12); k++) {
    const kind = pk(['worker', 'worker', 'braces', 'jacket', 'worker', 'coat', 'dress', 'sailor']);
    const pd = { st: 6, x: V.x, y: V.F, z: V.z1 + 3.5, yaw: 0, sc: 0.94 + rr() * 0.12, v: 0, kind, act: 7.8, seat: null, g: 'gone', dineT: rr() * 20, late: true };
    if (kind === 'worker') pd.col = pk(rr() < 0.5 ? SHIRTS : WORKWEAR); else if (kind === 'dress') pd.col = pk(DARK_DRESS);
    V.peds.push(pd); out.push(pd);
  }
  return out;
}
LIFE.extraPeds.push(alltagPeds);

/* =====================================================================
   4) STADTPULS: wer zu welcher Stunde draußen ist
   ===================================================================== */
// Anteil je Stunde (0 bis 23 Uhr), dazwischen wird gemittelt. 19 bis 21 Uhr ist überall 1: so voll wie die Stadt bisher immer war
const CURVE = {
  zentrum: [0.8, 0.55, 0.35, 0.22, 0.2, 0.28, 0.42, 0.6, 0.7, 0.72, 0.75, 0.82, 0.92, 0.9, 0.8, 0.8, 0.85, 0.95, 1, 1, 1, 1, 0.97, 0.9],
  buerger: [0.45, 0.3, 0.2, 0.15, 0.15, 0.25, 0.5, 0.85, 0.9, 0.7, 0.65, 0.7, 0.85, 0.8, 0.7, 0.7, 0.8, 1, 1, 1, 1, 0.85, 0.7, 0.55],
  hafen: [0.5, 0.4, 0.35, 0.3, 0.35, 0.5, 0.8, 0.9, 0.9, 0.9, 0.9, 0.85, 0.8, 0.9, 0.9, 0.9, 0.9, 0.9, 1, 1, 1, 0.8, 0.65, 0.55],
  kneipe: [0.9, 0.7, 0.4, 0.15, 0.1, 0.1, 0.3, 0.25, 0.15, 0.15, 0.15, 0.2, 0.35, 0.3, 0.45, 0.6, 0.7, 0.85, 1, 1, 1, 1, 1, 0.95],
  cafe: [0.15, 0.05, 0, 0, 0, 0.1, 0.4, 0.8, 0.95, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.85, 0.6, 0.3],
  restaurant: [0.3, 0.1, 0, 0, 0, 0, 0.1, 0.2, 0.2, 0.2, 0.3, 0.7, 1, 0.95, 0.5, 0.3, 0.4, 0.7, 1, 1, 1, 1, 0.9, 0.6],
};
// Belegung der begehbaren Lokale (Anteil der Gäste, die es dort gibt)
const OCC = {
  bar: [0.7, 0.5, 0.3, 0.15, 0.1, 0.12, 0.4, 0.5, 0.3, 0.22, 0.22, 0.28, 0.4, 0.4, 0.65, 0.75, 0.75, 0.85, 0.95, 1, 1, 1, 0.95, 0.85],
  restaurant: [0.35, 0.15, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.35, 0.35, 0.35, 0.55, 0.9, 0.85, 0.45, 0.35, 0.4, 0.65, 0.95, 1, 1, 0.95, 0.8, 0.55],
  cafe: [0.2, 0.1, 0.05, 0.05, 0.05, 0.1, 0.35, 0.7, 0.85, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.95, 1, 1, 1, 1, 0.9, 0.75, 0.55, 0.35],
};
const curve = (C, h) => { const i = Math.floor(h) % 24, f = h - Math.floor(h); return C[i] + (C[(i + 1) % 24] - C[i]) * f; };
function density() {
  const h = hourNow(), D = AT.d, night = h >= 22 || h < 5, fear = rufGet('furcht') > 70 && night ? 0.8 : 1;   // fürchtet ihn die Stadt, bleibt man nachts lieber daheim
  const wohl = KT.s && typeof KT.s.wohl === 'number' ? clamp(0.85 + 0.3 * KT.s.wohl / 100, 0.8, 1.1) : 1;
  D.zentrum = curve(CURVE.zentrum, h) * fear; D.buerger = curve(CURVE.buerger, h) * fear; D.hafen = curve(CURVE.hafen, h) * (AT.hafen ? 0.3 : 1);
  D.kneipe = Math.min(1, curve(CURVE.kneipe, h) * fear * wohl); if (AT.struck.size) D.kneipe = Math.max(D.kneipe, 0.6); if (AT.bierT > 0) D.kneipe = 1;
  D.cafe = curve(CURVE.cafe, h); D.restaurant = Math.min(1, curve(CURVE.restaurant, h) * wohl);
  D.occ = { bar: curve(OCC.bar, h), restaurant: Math.min(1, curve(OCC.restaurant, h) * wohl), cafe: curve(OCC.cafe, h) };
  if (AT.struck.size) D.occ.bar = Math.max(D.occ.bar, 0.8); if (AT.bierT > 0) D.occ.bar = 1;
}
const zoneOfBlock = b => b.tier === 'landmark' || b.d < 300 ? 'zentrum' : 'buerger';
function zoneOfLoop(lp) {
  if (lp.worker) return 'werk';
  if (lp.block) return zoneOfBlock(lp.block);
  if (PORT_LOOPS.includes(lp)) return 'hafen';
  const p = lp.pts && lp.pts[0];
  return p && Math.abs(p[0]) < 100 && Math.abs(p[1]) < 480 ? 'zentrum' : 'buerger';
}
function buildPuls() {
  const L = AT.puls, rr = mulberry32(8181);
  const plain = pd => pd.a && !pd.puls && !pd.cit && !pd.life && !pd.gg && !pd.carActor && !pd.patrol && !pd.busy && !pd.vendor && !pd.cust && !pd.listen && !pd.music && !pd.demo && !pd.waiter && !pd.seat && !pd.late && pd.a.kind !== 'police';
  // Gehende auf den Rundwegen (Paare und Dreiergruppen gemeinsam)
  for (const pd of peds) {
    const lp = pd.lp; if (!lp || !lp.segs || !plain(pd) || !(pd.st >= 0 && pd.st <= 3)) continue;
    const k = lp.zone || (lp.zone = zoneOfLoop(lp)), u = rr(), fi = k === 'werk' ? FACTORY_LOOPS.indexOf(lp) : -1;
    for (const g of pd.pair ? [pd, ...pd.pair] : [pd]) if (plain(g)) { g.puls = { k, u, fi, st: null }; L.push(g); }
  }
  // Grüppchen vor Lokalen und an Ecken, Gäste auf den Terrassen
  const grid = new Map(), key = (x, z) => Math.floor(x / 16) + ':' + Math.floor(z / 16);
  for (const d of DOORS) { const k = key(d.x, d.z); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(d); }
  const doorNear = (x, z, r) => { let best = null, bd = r * r; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const d of grid.get((Math.floor(x / 16) + i) + ':' + (Math.floor(z / 16) + j)) || []) { const dd = (d.x - x) ** 2 + (d.z - z) ** 2; if (dd < bd) { bd = dd; best = d; } } return best; };
  for (const c of CHATS) {
    let k;
    if (c.sit) k = 'cafe';
    else { const d = doorNear(c.x, c.z, 7); k = !d ? null : d.kind === 'bar' || d.kind === 'pub' ? 'kneipe' : d.kind === 'cafe' ? 'cafe' : d.kind === 'restaurant' ? 'restaurant' : d.kind === 'hotel' ? 'fest' : null; if (!k) { const b = blockOf(c.x, c.z); k = b ? zoneOfBlock(b) : 'buerger'; } }
    if (k === 'fest') continue;   // vor den Hotels ist immer Betrieb
    const u = rr();
    for (const pd of c.m) if (plain(pd) && pd.st === 4) { pd.puls = { k, u, fi: -1, st: null }; L.push(pd); }
  }
  // Arbeiter an den Maschinen im Fabrikhof (bei Streik steht der Hof leer)
  const idle = new Map(); FACTORY_IDLERS.forEach((w, i) => idle.set(w.x + ':' + w.z, Math.floor(i / 3)));
  for (const pd of peds) { if (pd.st !== 4 || pd.puls || !pd.a || pd.x === undefined) continue; const fi = idle.get(pd.x + ':' + pd.z); if (fi !== undefined && plain(pd)) { pd.puls = { k: 'werk', u: 0, fi, st: null }; L.push(pd); } }
  // Raucher vor den Kneipen
  for (const pd of AT.extra) if (pd.a && !pd.puls) { pd.puls = { ...pd.pulsPre, fi: -1, st: null }; L.push(pd); }
}
const _f = new T.Vector3();
function pulsTick(force) {
  const L = AT.puls; if (!L.length) return;
  const n = force ? L.length : Math.max(1, Math.ceil(L.length / 50)), cp = camera.position, D = AT.d;
  camera.getWorldDirection(_f);
  for (let i = 0; i < n; i++) {
    const pd = L[AT.pi = (AT.pi + 1) % L.length], P = pd.puls, parked = P.st != null;
    const want = P.k === 'werk' ? !AT.struck.has(P.fi) : P.u < D[P.k];
    if (want === !parked) continue;
    if (pd.rag || pd.aw || pd.back || pd.gg || pd.ggSave || WL.mods.has(pd)) continue;
    if (!parked && !(pd.st === 0 || pd.st === 4 || pd.st === 2)) continue;   // im Gespräch, an einer Tür, staunend: später
    if (!force && pd.a.k6) {   // nur wechseln, wo es niemand sieht: weit weg oder im Rücken
      const e = pd.a.m.elements, dx = e[12] - cp.x, dz = e[14] - cp.z, d2 = dx * dx + dz * dz;
      if (d2 < 30 * 30 || (d2 < 95 * 95 && dx * _f.x + dz * _f.z > 0)) continue;
    }
    if (parked) { pd.st = P.st; P.st = null; AT.stats.parked--; }
    else { P.st = pd.st; pd.st = 6; pd.a.on = false; AT.stats.parked++; }
  }
}

/* =====================================================================
   5) LOKALE: Belegung nach der Uhr
   ===================================================================== */
function seatNow(V, pd) {
  const fr = V.seats.filter(s => !s.taken && s !== DINE.seat); if (!fr.length) return false;
  const s = pick(fr);
  s.taken = pd; pd.seat = s; pd.g = null; pd.st = 4; pd.x = s.x; pd.y = s.y; pd.z = s.z; pd.yaw = s.yaw; setSit(pd, true);
  pd.act = Math.random() < 0.5 ? 11.4 : 7.8; setAct(pd, pd.act); pd.dineT = 4 + Math.random() * 14; pd.path = null;
  if (pd.dish) { pd.dish.position.set(s.tx, s.ty, s.tz); pd.dish.rotation.y = s.yaw; pd.dish.visible = true; }
  return true;
}
function goneNow(pd) {
  pd.seat.taken = null; pd.seat = null; pd.g = 'gone'; pd.st = 6; pd.a.on = false; setSit(pd, false);
  if (pd.dish) pd.dish.visible = false;
}
function venueTick() {
  const cp = camera.position, O = AT.d.occ; if (!O) return;
  for (const V of VENUES) {
    if (V.still || !V.seats || !V.seats.length || !V.peds.length) continue;
    const f = V.kind === 'bar' ? O.bar : V.cafe ? O.cafe : O.restaurant;
    const want = V.occN = Math.min(V.seats.length - 2, Math.round(V.peds.length * f));
    const near = (cp.x - (V.x0 + V.x1) / 2) ** 2 + (cp.z - (V.z0 + V.z1) / 2) ** 2 < 110 * 110;
    if (near || DINE.venue === V) continue;   // in der Nähe kommen und gehen die Gäste zu Fuß (eating.js)
    const seated = V.peds.filter(p => p.seat && !p.g && p.a && !p.aw && !p.rag), gone = V.peds.filter(p => p.g === 'gone' && p.a);
    let d = want - seated.length - V.peds.filter(p => p.g === 'in' || p.g === 'sitdown').length;
    while (d > 0 && gone.length) { if (!seatNow(V, gone.splice(Math.floor(Math.random() * gone.length), 1)[0])) break; d--; }
    while (d < 0 && seated.length) { goneNow(seated.splice(Math.floor(Math.random() * seated.length), 1)[0]); d++; }
  }
}
// Alexander betritt die Brass Lantern: wie die Kneipe reagiert, hängt vom Ruf bei den Arbeitern ab
const PUB_IN = {
  hoch: ['Der Chef! Rückt zusammen, Leute, macht Platz an der Theke!', 'Herr Alexander! Das erste Bier heute geht auf uns. Das zweite auf Sie.', 'Na, wenn das nicht der Chef ist. ’n Abend!'],
  mittel: ['’n Abend, Herr Alexander. Suchen Sie jemanden?', 'Sieh an. Der Herr vom Belmont trinkt heute bei uns.'],
  tief: ['Hier trinken Leute, die für ihr Geld arbeiten.', 'Die Theke ist voll, Herr Alexander. Für Sie besonders.', 'Wirt, mach das Fenster auf. Es riecht nach Geld.'],
  streik: ['Kommen Sie zum Verhandeln oder zum Zuschauen, Herr Alexander?', 'Solange gestreikt wird, trinken wir auf Pump. Schreiben Sie es auf Ihre Rechnung?'],
};
function pubTick(dt) {
  if (AT.pubT > 0) { AT.pubT -= dt; return; }
  const V = AT.lokal && AT.lokal.V, p = player.p; if (!V || !onFoot()) return;
  if (p.x < V.x0 + 0.5 || p.x > V.x1 - 0.5 || p.z < V.z0 + 0.5 || p.z > V.z1 - 0.5 || p.y > V.F + 3) return;
  const guests = V.peds.filter(pd => pd.a && pd.a.on && pd.seat && !pd.g); if (guests.length < 4) return;
  AT.pubT = 200;
  const F = rufGet('furcht'), key = AT.struck.size ? 'streik' : arbTier();
  for (const pd of guests) if (Math.random() < 0.8) turnHead(pd.a, p.x, p.z);
  if (F > 72 && key !== 'hoch') { toast('Die Gespräche verstummen. Niemand sieht Sie an.'); return; }
  shared.sayTimer = 0;
  if (key === 'hoch') for (const pd of guests) if (!pd.aw && Math.random() < 0.45) { setAct(pd, 9.3); setTimeout(() => { if (pd.seat && !pd.g && pd.a) setAct(pd, pd.act); }, 2800); }
  say(key === 'hoch' ? 'An der Theke' : 'Vom Stammtisch', pick(PUB_IN[key]), 4.2);
  if (key === 'tief') setTimeout(() => toast('Es wird still in der Kneipe. Ein paar Gäste drehen Ihnen den Rücken zu.'), 2500);
}

/* =====================================================================
   6) STREIK: Posten vor den Werkstoren
   ===================================================================== */
function calcStruck() {
  const S = new Set(); let hafen = false;
  if (AT.force === 'alle' || AT.force === 1) AT.fac.forEach(F => S.add(F.i));
  else if (AT.force == null && !(AT.calmT > 0)) {
    if (rufGet('arbeiter') < 30) AT.fac.forEach(F => S.add(F.i));   // wilder Streik in allen Werken
    try { for (const e of (KT.s && KT.s.ev) || []) { const E = EVENTS[e.i]; if (!E || !E.streik) continue; if (/Hafen/.test(E.t)) hafen = true; else for (const F of AT.fac) if (/STAHLWERK|GIESSEREI/.test(F.name)) S.add(F.i); } } catch (e) { /* ohne Kontor */ }
  }
  AT.struck = S; AT.hafen = hafen;
  for (const F of AT.fac) F.ban.visible = S.has(F.i) && (F.street.x - camera.position.x) ** 2 + (F.street.z - camera.position.z) ** 2 < 420 * 420;
}
const POST_ACT = [1.4, 15.3, 0.7, 0.9, 1.5, 8.3, 15.5];
function takeSlot(F, c) { const fr = F.slots.filter(s => !s.by); const s = fr.length ? pick(fr) : pick(F.slots); if (!s.by) s.by = c; return s; }
function freeSlot(F, c) { for (const s of F.slots) if (s.by === c) s.by = null; }
function toPicket(c, P) {
  const F = AT.fac.find(F => F.i === c.res.fi), s = takeSlot(F, c);
  P.push([F.street.x, F.street.z], [s.x, s.z]);
  c.tk = { x: s.x, z: s.z, yaw: s.yaw, act: pick(POST_ACT), t: 1e9 }; c.hold = true; c.picket = true; c.target = { task: true }; c.doing = 'work';
  c.path = P; c.pi = 0; c.pos = null; c.st = 'walk'; c.res.pathOk = P;
}
// vom Posten weg: nach Schichtende heim oder in die Kneipe, nach Streikende an die Arbeit
function fromPicket(c, to) {
  const F = AT.fac.find(F => F.i === c.res.fi), tk = c.tk; freeSlot(F, c); citGait(c, 0);
  const P = [[tk.x, tk.z]];
  if (to === c.at.work) P.push([F.street.x, F.street.z], ...F.place.via, [F.place.x, F.place.z]);
  else P.push(...route(F.street, to));
  c.tk = null; c.hold = false; c.picket = false; c.target = to; c.path = P; c.pi = 0; c.pos = null; c.st = 'walk'; c.res.pathOk = P;
}
const POST_CALL = ['Streik! Streik! Streik!', 'Kein Rad dreht sich ohne uns!', 'Gerechter Lohn! Gerechter Lohn!', 'Acht Stunden sind genug!', 'Wir bauen Vespera! Wir wollen leben!'];
const POST_HIM = {
  hoch: ['Herr Alexander! Es geht nicht gegen Sie. Reden Sie mit uns!', 'Der Chef kommt selbst ans Tor. Das rechnen wir Ihnen an.'],
  mittel: ['Da kommt Alexander. Mal sehen, ob er redet oder nur schaut.', 'Herr Alexander! Hier steht alles still, bis jemand mit uns verhandelt.'],
  tief: ['Hier kommt keiner durch, Alexander!', 'Zurück ins Penthouse! Hier draußen ist es kalt, das sind Sie nicht gewohnt!', 'Schaut ihn euch an. Für seine Türme reicht das Geld.'],
  angst: ['Ruhig bleiben, Leute. Keiner rührt sich.', 'Pst. Er ist da. Stehen bleiben, nichts sagen.'],
};
function picketTick(dt) {
  if (!AT.struck.size) return;
  const p = player.p; AT.chantT -= dt;
  for (const F of AT.fac) {
    if (!AT.struck.has(F.i)) continue;
    const d2 = (F.street.x - p.x) ** 2 + (F.street.z - p.z) ** 2; if (d2 > 60 * 60) continue;
    const posts = F.slots.filter(s => s.by && s.by.st === 'task' && s.by.ped.a && s.by.ped.a.on).map(s => s.by); if (!posts.length) continue;
    if (Math.random() < dt * 0.5) { const c = pick(posts); if (!c.ped.aw) { c.tk.act = pick(POST_ACT); setAct(c.ped, c.tk.act); } }
    if (onFoot() && d2 < 13 * 13 && !(F.himT > performance.now())) {
      F.himT = performance.now() + 70000;
      for (const c of posts) turnHead(c.ped.a, p.x, p.z);
      shared.sayTimer = 0; say('Ein Streikposten', pick(POST_HIM[rufGet('furcht') > 72 ? 'angst' : arbTier()]), 4);
    } else if (d2 < 32 * 32 && AT.chantT <= 0 && free()) {
      AT.chantT = 10 + Math.random() * 8;
      if (say('Die Streikposten', pick(POST_CALL), 3.4)) for (const c of posts) if (!c.ped.aw && Math.random() < 0.6) { setAct(c.ped, 3.7); setTimeout(() => { if (c.st === 'task' && c.tk && c.ped.a) setAct(c.ped, c.tk.act); }, 3000); }
    }
  }
}

/* =====================================================================
   7) BEWOHNER IM TAKT: Wege richten, Streikposten beziehen und verlassen
   ===================================================================== */
function resTick() {
  for (const c of AT.res) {
    const R = c.res;
    if (c.st === 'walk' && c.path !== R.pathOk) {
      // ragdoll.js hat gerade einen Weg gelegt; Orte abseits des Gehwegs brauchen den Weg durchs Tor oder über den Platz
      const to = c.target;
      if (to && !to.task && to !== c.place) {
        if (to === c.at.work && R.fi != null && AT.struck.has(R.fi)) { const P = route(c.place, AT.fac.find(F => F.i === R.fi).street); P.pop(); toPicket(c, P); continue; }
        c.path = route(c.place, to); c.pi = 0; c.pos = null;
        if (c.hurry && R.type === 'schicht' && c.doing === 'work') { c.hurry = false; citGait(c, 0); }   // der Plan ist auf Schrittempo gerechnet: alle kommen kurz vor der Sirene
      }
      R.pathOk = c.path;
    }
    if (R.fi == null) continue;
    const struck = AT.struck.has(R.fi);
    if (c.picket) {
      if (c.st === 'walk' && !struck && c.tk) {   // Streik vorbei, noch auf dem Weg zum Posten: gleich weiter durchs Tor
        const F = AT.fac.find(F => F.i === R.fi), P = c.path.slice(0, -1); P.push(...F.place.via, [F.place.x, F.place.z]); freeSlot(F, c);
        c.path = P; R.pathOk = P; c.tk = null; c.hold = false; c.picket = false; c.target = c.at.work; continue;
      }
      if (c.st !== 'task' || c.ped.aw) continue;
      const g = citizenGoal(c);
      if (g !== 'work') { c.goal = g; c.doing = g; fromPicket(c, c.at[g]); }
      else if (!struck) { c.doing = 'work'; fromPicket(c, c.at.work); }
    } else if (struck && c.st === 'in' && c.place === c.at.work && !c.ped.aw && citizenGoal(c) === 'work') {
      const pl = c.place, P = [[pl.x, pl.z]]; for (let i = pl.via.length - 1; i >= 0; i--) P.push(pl.via[i]);
      toPicket(c, P);
    }
  }
}
// Namenskarte (ragdoll.js citizenDoing): was der Bewohner gerade tut
function doing(c) {
  const R = c.res, w = c.at.work;
  if (R.type === 'schicht') {
    const W = werkOf(w.name), S = SCHICHT[R.s], end = hhmm(S.s + 480);
    if (c.picket) return c.st === 'task' ? 'steht Streikposten vor ' + W[1] : 'geht zum Streikposten vor ' + W[1];
    if (c.st === 'walk' && c.doing === 'work') return 'auf dem Weg zur ' + S.n + ' ' + W[0];
    if (c.st === 'walk' && c.place === w) return c.doing === 'bar' ? 'Feierabend: auf dem Weg in die Kneipe „' + c.at.bar.name + '“' : 'Feierabend: geht nach der Schicht nach Hause';
    if (c.st === 'task') return 'Pause im Hof, ' + S.n + ' bis ' + end + ' Uhr';
    if (c.place === w && c.st !== 'walk') return 'arbeitet ' + W[0] + ', ' + S.n + ' bis ' + end + ' Uhr';
    if (c.place === c.at.bar && c.st !== 'walk') return 'sitzt nach der Schicht in der Kneipe „' + c.at.bar.name + '“';
    return null;
  }
  if (c.st === 'walk' && c.doing === 'bar') return 'Feierabend: auf dem Weg in die Brass Lantern';
  if (c.place === c.at.bar && c.st !== 'walk') return 'sitzt in der Brass Lantern am Kneipenplatz';
  return null;
}

/* ---------- Gespräche (ragdoll.js citizenSay): der Tagesablauf kommt zur Sprache ---------- */
const TALK = {
  hin: { hoch: ['{schicht} {im}. Seit die Löhne stimmen, geht man fast gern hin, Herr Alexander.', 'Auf zur {schicht}! Die Sirene wartet nicht. Auch nicht auf den Chef.'],
    mittel: ['{schicht} {im}. Acht Stunden, dann ein Bier. So geht das jeden Tag.', 'Ich muss weiter, Herr Alexander. Wer nach der Sirene kommt, dem fehlt eine Stunde Lohn.', 'Draußen ist es immer dunkel, drinnen immer heiß. Man gewöhnt sich daran.'],
    tief: ['{schicht}. Acht Stunden für Ihre Türme, Herr Alexander. Und was bleibt für uns?', 'Zur Arbeit, wohin sonst. Von schönen Reden wird der Ofen nicht warm.'] },
  feier: { hoch: ['Feierabend! Ein Dunkles in der Kneipe „{bar}“, und das erste trinke ich auf Sie, Chef.', 'Gute Schicht heute. Wenn es so bleibt, hört man von uns keine Klagen.'],
    mittel: ['Feierabend. Die Hände tun weh, aber das Bier schmeckt. „{bar}“, falls Sie mich suchen.', 'Acht Stunden vorbei. Jetzt nach Hause, die Kinder schlafen sicher schon.', 'Wenn die Sirene heult, weiß man wenigstens, wie spät es ist. Der Himmel sagt es einem hier ja nicht.'],
    tief: ['Feierabend. Und morgen dasselbe, für denselben Lohn.', 'Wissen Sie, was ein Bier kostet, Herr Alexander? Für mich eine halbe Stunde am Ofen.'] },
  posten: { hoch: ['Es geht nicht gegen Sie, Herr Alexander. Aber ohne Druck bewegt sich nichts.', 'Reden Sie mit uns, dann stehen morgen alle wieder an den Maschinen.'],
    mittel: ['Wir stehen hier, bis jemand mit uns redet. Sie zum Beispiel.', 'Kein Rad dreht sich, wenn wir es nicht wollen. Das sollten Sie wissen.'],
    tief: ['Hier kommt keiner durch, Herr Alexander. Auch Sie nicht, solange Sie zu Fuß gehen.', 'Reden Sie nicht mit mir. Reden Sie mit dem Streikkomitee.'] },
  frei: { hoch: ['Meine Schicht ist die {schicht}. Bis dahin gehört die Zeit mir. Schöner Gedanke, oder?', 'Heute Abend in der Kneipe „{bar}“? Da sitzt die halbe Belegschaft.'],
    mittel: ['Meine Schicht ist die {schicht}. Bis dahin gehört die Zeit mir.', 'Schlafen, arbeiten, ein Bier. Viel mehr passt in einen Tag nicht hinein.'],
    tief: ['Meine freie Zeit gehört mir, Herr Alexander. Die haben Sie noch nicht gekauft.', 'Fragen Sie in der Kneipe „{bar}“, was man von Ihnen hält. Aber fragen Sie leise.'] },
  viertel: ['Tagsüber in der Werkstatt, abends in der Brass Lantern. So lebt man am Kneipenplatz.', 'Kommen Sie nach Feierabend in die Brass Lantern, Herr Alexander. Da hören Sie, was das Viertel wirklich denkt.', 'Ab sechs ist am Kneipenplatz kein Stuhl mehr frei.'],
};
const TALK_ZEIT = {
  nacht: ['So spät noch unterwegs, Herr Alexander? Um diese Zeit schläft sogar Vespera. Fast.', 'Ich komme gerade aus dem Lokal. Fragen Sie nicht, wie spät es ist.', 'Nachts gehören die Straßen der Nachtschicht und den Verliebten.'],
  morgen: ['Guten Morgen, Herr Alexander. Auch wenn es draußen nie hell wird: Der Kaffee ruft.', 'Um diese Zeit sieht man nur Bäcker, Zeitungsjungen und die Frühschicht.'],
  mittag: ['Mittagspause! Die Cafés sind voll, haben Sie es gesehen?', 'Um zwei heult die Sirene im Osten. Dann ist bei den Fabriken Schichtwechsel.'],
  abend: ['Feierabend! Heute ist die halbe Stadt auf den Beinen.', 'Um diese Zeit bekommt man in keiner Bar mehr einen Platz.', 'Abends ist Vespera am schönsten. Die Lichter, die Musik, die vielen Leute.'],
  streik: ['Haben Sie gehört? Vor den Werkstoren stehen Streikposten.', 'Die einen sagen, die Arbeiter haben recht. Die anderen fürchten um ihre Aktien.', 'Streik im Osten. Mein Schwager steht auch am Tor. Ich sage dazu lieber nichts, Herr Alexander.'],
};
function talk(c) {
  const R = c.res;
  if (!R) {
    if (Math.random() > 0.25) return null;
    const h = hourNow();
    return pick(AT.struck.size && Math.random() < 0.5 ? TALK_ZEIT.streik : h >= 23 || h < 5 ? TALK_ZEIT.nacht : h < 9 ? TALK_ZEIT.morgen : h >= 11.5 && h < 14.5 ? TALK_ZEIT.mittag : h >= 17 ? TALK_ZEIT.abend : TALK_ZEIT.mittag.slice(1));
  }
  if (Math.random() > 0.6) return null;
  if (R.type === 'viertel') return pick(TALK.viertel);
  const key = c.picket ? 'posten' : c.st === 'walk' && c.doing === 'work' ? 'hin' : c.st === 'walk' && c.place === c.at.work ? 'feier' : 'frei';
  return pick(TALK[key][arbTier()]).replace('{schicht}', SCHICHT[R.s].n).replace('{im}', werkOf(c.at.work.name)[0]).replace('{bar}', c.at.bar.name);
}
CIT_SAY.push(talk);

/* =====================================================================
   8) SCHICHTWECHSEL: Sirene, Werkstor, Gespräche
   ===================================================================== */
function siren(vol) {
  const ctx = audioCtx(); if (!ctx || !SND.on) return;
  const bus = audioBus('amb'); if (!bus) return;
  try {
    const t = ctx.currentTime + 0.05, g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 1.2); g.gain.setValueAtTime(vol, t + 4.2); g.gain.linearRampToValueAtTime(0, t + 6.5);
    for (const det of [1, 1.012, 0.5]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(150 * det, t); o.frequency.exponentialRampToValueAtTime(410 * det, t + 1.6); o.frequency.setValueAtTime(410 * det, t + 4.0); o.frequency.exponentialRampToValueAtTime(140 * det, t + 6.5);
      o.connect(lp); o.start(t); o.stop(t + 6.6);
    }
    lp.connect(g); g.connect(bus);
  } catch (e) { /* ohne Ton */ }
}
function nearestFac(p) { let best = null, bd = 1e12; for (const F of AT.fac) { const d = (F.street.x - p.x) ** 2 + (F.street.z - p.z) ** 2; if (d < bd) { bd = d; best = F; } } return [best, Math.sqrt(bd)]; }
function shiftChange(i) {
  AT.stats.last = i; AT.gateSaid = '';
  const [F, d] = nearestFac(camera.position); if (!F) return;
  if (d < 750) siren(0.16 * Math.pow(1 - d / 750, 1.3) + 0.01);
  if (d < 480 && playing) toast(AT.struck.size >= AT.fac.length ? 'Die Sirenen heulen, aber niemand geht hinein: Die Werke werden bestreikt' : `Schichtwechsel in den Fabriken: Die ${SCHICHT[(i + 2) % 3].n} geht, die ${SCHICHT[i].n} kommt`);
}
const GATE_HIM = {
  hoch: ['’n Abend, Chef! Kommen Sie mit an den Ofen?', 'Der Chef am Werkstor! Gute Schicht, Herr Alexander!', 'Sehen Sie, Herr Alexander: pünktlich wie die Sirene.'],
  mittel: ['Der Chef steht am Tor. Zählt er, ob wir alle kommen?', '’n Abend, Herr Alexander. Wir müssen rein, die Sirene wartet nicht.'],
  tief: ['Da steht er. Acht Stunden für seine Türme, und er schaut zu.', 'Wollen Sie sehen, wer Ihr Geld verdient, Herr Alexander? Bitte sehr.'],
};
function gateTick() {
  const w = wechselFenster(); AT.wave = w;
  if (w < 0 || !onFoot()) return;
  const p = player.p, [F, d] = nearestFac(p); if (!F || d > 16 || AT.struck.has(F.i)) return;
  const key = w + ':' + F.i; if (AT.gateSaid === key) return;
  const nearRes = AT.res.filter(c => c.res.fi === F.i && c.ped.a && c.ped.a.on && !c.picket && (c.ped.a.m.elements[12] - p.x) ** 2 + (c.ped.a.m.elements[14] - p.z) ** 2 < 18 * 18);
  if (!nearRes.length || !free()) return;
  AT.gateSaid = key;
  for (const c of nearRes) turnHead(c.ped.a, p.x, p.z);
  if (rufGet('furcht') > 72) { toast('Die Arbeiter senken die Köpfe und gehen schneller.'); return; }
  say(pick(nearRes).name, pick(GATE_HIM[arbTier()]), 4);
}
function gateNear(p) {
  if (!onFoot()) return null;
  for (const F of AT.fac) if ((F.street.x - p.x) ** 2 + (F.street.z - p.z) ** 2 < 7 * 7) return F;
  return null;
}
function gateMenu(F) {
  if (AT.talkT > 0) { say('Ein Arbeiter', 'Wir müssen weiter, Herr Alexander. Die Schicht wartet nicht.', 3.5); return; }
  const W = werkOf(F.name);
  openChoice('Schichtwechsel am Werkstor · ' + nice(F.name), ['Eine gute Schicht wünschen', 'Freibier nach der Schicht spendieren · 400 Lumen', 'Nach der Arbeit ' + W[0] + ' fragen'], i => {
    const t = arbTier(); shared.sayTimer = 0; AT.talkT = 150;
    if (i === 0) {
      rufAdd({ arbeiter: 0.8 }, 'Am Werkstor mit den Arbeitern gesprochen', { key: 'tor:gruss' });
      say('Ein Arbeiter', t === 'hoch' ? 'Danke, Chef! Ihnen auch einen guten Abend.' : t === 'tief' ? 'Wünschen kostet nichts. Aber gut, danke.' : 'Danke, Herr Alexander. Das hört man hier selten.', 3.8);
    } else if (i === 1) {
      if (!KT.s || KT.s.cash < 400) { toast('Dafür reicht das Bargeld nicht'); AT.talkT = 0; return; }
      ktCash(-400, 'Freibier für die Schicht ' + W[0]); rufAdd({ arbeiter: 2.5, buerger: 0.3 }, 'Freibier für die Schicht spendiert', { key: 'tor:bier' });
      AT.bierT = 360;
      say('Vom Werkstor', t === 'tief' ? 'Freibier? Das nehmen wir. Den Lohn hätten wir trotzdem lieber.' : pick(['Freibier vom Chef! Habt ihr das gehört?', 'Das lässt man sich gefallen. Auf Ihr Wohl, Herr Alexander!']), 4);
      news('Freibier am Werkstor', `Zum Schichtwechsel stand Alexander selbst am Tor und spendierte der Belegschaft ${W[0]} Freibier. Die Kneipen im Viertel waren danach voll. „Nett“, sagte ein Arbeiter dem Kurier, „aber ein Fass Bier ist keine Lohnerhöhung.“`, 3);
    } else {
      rufAdd({ arbeiter: 0.5 }, 'Am Werkstor nach der Arbeit gefragt', { key: 'tor:frage', quiet: true });
      say('Ein Arbeiter', t === 'hoch' ? 'Harte Arbeit, aber ehrlich bezahlt. Mehr verlangt hier keiner.' : t === 'tief' ? 'Zwölf Mann an einem Ofen, zwei Handschuhe für alle. Schreiben Sie das ruhig auf.' : 'Heiß, laut, lang. Der Lohn reicht für Miete und Kohle. Für mehr nicht.', 4.5);
    }
  });
}
function picketMenu(F) {
  if (AT.talkT > 0) { say('Ein Streikposten', 'Sie haben gesagt, was Sie zu sagen hatten. Jetzt warten wir auf Taten.', 4); return; }
  const posts = F.slots.filter(s => s.by && s.by.ped.a && s.by.ped.a.on).map(s => s.by);
  for (const c of posts) turnHead(c.ped.a, player.p.x, player.p.z);
  openChoice('Streikposten vor ' + werkOf(F.name)[1], ['Verhandlungen zusagen', 'Heißen Tee und Suppe bringen lassen · 150 Lumen', 'Mit Entlassung drohen'], i => {
    shared.sayTimer = 0; AT.talkT = 240;
    if (i === 0) {
      rufAdd({ arbeiter: 4, elite: -1.5 }, 'Den Streikposten Verhandlungen zugesagt', { key: 'posten:verh' });
      try { for (const e of KT.s.ev) if (EVENTS[e.i] && EVENTS[e.i].streik) e.d = Math.min(e.d, 1); } catch (e) { /* ohne Kontor */ }
      AT.calmT = 480; AT.strikeT = 0;
      say('Ein Streikposten', 'Vor allen Leuten zugesagt. Gut. Wir gehen an die Arbeit, und wir merken uns jedes Wort.', 5);
      for (const c of posts) if (!c.ped.aw && Math.random() < 0.7) setAct(c.ped, 9.3);
      news('Alexander sagt Streikenden Verhandlungen zu', `Vor ${werkOf(F.name)[1]} sprach Alexander mit den Streikposten und sagte Verhandlungen über Löhne und Schichten zu. Die Posten räumten das Tor. An der Börse sieht man das Zugeständnis mit gemischten Gefühlen.`, 6, 'Extrablatt! Alexander verhandelt mit den Streikenden!');
    } else if (i === 1) {
      if (!KT.s || KT.s.cash < 150) { toast('Dafür reicht das Bargeld nicht'); AT.talkT = 0; return; }
      ktCash(-150, 'Tee und Suppe für die Streikposten'); rufAdd({ arbeiter: 1.5, presse: 0.5 }, 'Tee und Suppe für die Streikposten', { key: 'posten:tee' });
      say('Ein Streikposten', pick(['Tee vom Chef. Das hat es auch noch nicht gegeben. Danke. Wir bleiben trotzdem stehen.', 'Danke, Herr Alexander. Die Nacht ist lang und kalt. Den Lohn wollen wir trotzdem.']), 4.5);
    } else {
      rufAdd({ arbeiter: -7, furcht: 3, elite: 1, unter: 2 }, 'Den Streikposten mit Entlassung gedroht', { key: 'posten:droh' });
      say('Ein Streikposten', pick(['Dann stehen morgen doppelt so viele hier.', 'Entlassen Sie uns alle. Und dann bauen Sie Ihre Türme selbst.']), 4.5);
      news('Alexander droht Streikenden mit Entlassung', 'Am Werkstor drohte Alexander den Streikposten, wer nicht an die Arbeit gehe, sei entlassen. Die Posten blieben stehen. Im Arbeiterviertel ist die Stimmung so gereizt wie lange nicht.', 6, 'Extrablatt! Alexander droht den Streikenden!');
    }
  });
}

/* =====================================================================
   9) AUFBAU UND TAKT
   ===================================================================== */
// Zeitsprung (Pausenmenü, ?uhr=, Test): die Bewohner stehen danach dort, wo sie um diese Zeit wären; wer zur Schicht unterwegs
// wäre, ist schon auf dem Weg, damit zur Sirene wirklich alle am Tor ankommen
function resettle(c) {
  const R = c.res; if (c.ped.aw || c.ped.rag) return;
  if (c.picket) { const F = AT.fac.find(F => F.i === R.fi); if (F) freeSlot(F, c); c.picket = false; c.hold = false; }
  if (c.gw && c.ped.a) citGait(c, 0);
  c.hurry = false; c.carry = false; settle(c); c.wait = Math.random() * 4; if (c.ped.a) c.ped.a.on = false;
  if (R.type !== 'schicht' || c.goal !== 'work' || AT.struck.has(R.fi)) return;
  const left = (SCHICHT[R.s].s - 9 - CLOCK.min % 1440 + 1440) % 1440, T0 = Math.max(1, R.thw - 5);
  if (left >= T0) return;   // die Schicht läuft schon (oder er wäre noch gar nicht los)
  const P = route(c.at.home, c.at.work); let d = pathLen(P) * (1 - left / T0), i = 0, x = P[0][0], z = P[0][1];
  for (; i < P.length - 1; i++) { const L = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (d <= L) { const k = L ? d / L : 0; x = P[i][0] + (P[i + 1][0] - P[i][0]) * k; z = P[i][1] + (P[i + 1][1] - P[i][1]) * k; break; } d -= L; }
  if (i >= P.length - 1) return;
  c.place = c.at.home; c.doing = 'work'; c.target = c.at.work; c.path = P; c.pi = i; c.pos = [x, z]; c.yaw = undefined; c.st = 'walk'; R.pathOk = P;
}
export function alltagUhr(h, m = 0) {
  CLOCK.min = ((h * 60 + m) % 1440 + 1440) % 1440; AT.lastMin = -1; AT.dT = 0; AT.occT = 0; AT.gateSaid = '';
  if (!AT.ready) return;
  calcStruck(); for (const c of AT.res) { try { resettle(c); } catch (e) { console.warn('Alltag (Zeitsprung):', e); } }
  density(); pulsTick(true); venueTick();
  HUDCLOCK();
}
const HUDCLOCK = () => { try { const el = document.getElementById('clock'); if (el) el.textContent = shared.clockText(); } catch (e) { /* ohne Anzeige */ } };
function setup() {
  AT.ready = true;
  try { buildPuls(); } catch (e) { console.warn('Alltag:', e); }
  try {
    const q = new URLSearchParams(location.search), u = q.get('uhr'), s = q.get('streik');
    if (s != null && s !== '') AT.force = s === '0' ? 0 : 'alle';
    if (u) { const [h, m] = u.split(/[:.]/).map(Number); if (h >= 0 && h < 24) CLOCK.min = h * 60 + (m || 0); }
  } catch (e) { /* ohne Adresse */ }
  alltagUhr(Math.floor(CLOCK.min / 60), CLOCK.min % 60);
  INTERACT.push({ test: p => { const F = gateNear(p); AT.pick = F && AT.struck.has(F.i) && F.slots.some(s => s.by && s.by.st === 'task') ? F : null; return !!AT.pick; }, label: 'Mit den Streikposten sprechen', act: () => AT.pick && picketMenu(AT.pick) });
  INTERACT.push({ test: p => { const F = AT.wave >= 0 ? gateNear(p) : null; AT.pick2 = F && !AT.struck.has(F.i) ? F : null; return !!AT.pick2; }, label: 'Mit den Arbeitern am Werkstor sprechen', act: () => AT.pick2 && gateMenu(AT.pick2) });
  KARTE.liveHooks.push((L, lay) => {
    if (!lay.orte) return;
    const [ni, nd] = naechsterWechsel();
    for (const F of AT.fac) {
      if (AT.struck.has(F.i)) L.push({ cat: 'orte', icon: 'ort', n: 'Streikposten', sub: nice(F.name) + ' · das Werk wird bestreikt', x: F.street.x, z: F.street.z });
      else if (AT.wave >= 0) L.push({ cat: 'orte', icon: 'ort', n: 'Schichtwechsel', sub: nice(F.name) + ' · ' + SCHICHT[AT.wave].n + ' ab ' + hhmm(SCHICHT[AT.wave].s) + ' Uhr', x: F.street.x, z: F.street.z });
    }
    if (AT.wave < 0 && !AT.struck.size && AT.fac.length) { const F = AT.fac[Math.floor(AT.fac.length / 2)]; L.push({ cat: 'orte', icon: 'ort', n: 'Werkstore', sub: `Nächster Schichtwechsel ${hhmm(SCHICHT[ni].s)} Uhr (in ${Math.round(nd)} Minuten)`, x: F.street.x, z: F.street.z }); }
  });
  setTimeout(() => { try { addTasten('stadt', [
    { id: 'alltagE', k: ['E'], t: 'Werkstor und Streikposten', d: 'Schichtwechsel um 6, 14 und 22 Uhr: am Werkstor mit den Arbeitern sprechen · bei Streik mit den Posten verhandeln' },
    { id: 'alltagUhr', k: [], t: 'Stadtuhr: eine Stunde warten', d: 'Anklicken stellt die Uhr eine Stunde vor: morgens, mittags und tief in der Nacht sieht die Stadt anders aus', an: () => shared.clockText(), act: () => { alltagUhr(Math.floor(CLOCK.min / 60) + 1, CLOCK.min % 60); return false; } },
    { id: 'alltagWechsel', k: [], t: 'Bis zum Schichtwechsel warten', d: 'Anklicken springt auf zehn Minuten vor der nächsten Sirene: dann zum Industriegebiet Ost fliegen', an: () => 'um ' + hhmm(SCHICHT[naechsterWechsel()[0]].s) + ' Uhr', act: () => { const s = SCHICHT[naechsterWechsel((CLOCK.min + 11) % 1440)[0]].s - 10; alltagUhr(Math.floor(s / 60), s % 60); toast('Zehn Minuten bis zum Schichtwechsel in den Fabriken'); return true; } },
  ]); } catch (e) { /* Pausenmenü fehlt */ } }, 0);
  if (window.vespera && !window.vespera.alltag) window.vespera.alltag = { AT, SCHICHT, uhr: alltagUhr, streik: v => { AT.force = v == null ? null : v ? 'alle' : 0; AT.strikeT = 0; }, schicht: schichtNow, abschnitt: tagesabschnitt };
}
export function alltagTick(dt) {
  if (!AT.ready) { if (!playing) return; setup(); }
  if (paused) return;
  const m = CLOCK.min % 1440;
  if (AT.lastMin >= 0) for (let i = 0; i < 3; i++) { const s = SCHICHT[i].s, a = AT.lastMin; if ((a < s && m >= s) || (m < a && (s > a || s <= m))) shiftChange(i); }
  AT.lastMin = m;
  if (AT.talkT > 0) AT.talkT -= dt; if (AT.calmT > 0) AT.calmT -= dt; if (AT.bierT > 0) AT.bierT -= dt;
  if ((AT.strikeT -= dt) <= 0) { AT.strikeT = 2; calcStruck(); }
  if ((AT.dT -= dt) <= 0) { AT.dT = 1; density(); }
  try { resTick(); } catch (e) { console.warn('Alltag (Bewohner):', e); }
  pulsTick(false);
  if ((AT.occT -= dt) <= 0) { AT.occT = 1.5; try { venueTick(); } catch (e) { console.warn('Alltag (Lokale):', e); } }
  try { picketTick(dt); gateTick(); pubTick(dt); } catch (e) { console.warn('Alltag:', e); }
}
LIFE.ticks.push(alltagTick);
