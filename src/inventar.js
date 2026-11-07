/* =====================================================================
   V62 · DAS INVENTAR: WAS ALEXANDER BEI SICH TRÄGT
   Zusätzlich zum Kontorbuch (Taste I, Geld und Besitz) zeigt das Inventar (Umschalt+I,
   oder ein Klick auf „Taschen“ unter dem Vermögen oben rechts) die Dinge selbst:
   - TASCHEN: alles, was er dabei hat (bis zu 20 Stück). Gekauftes aus den Läden (Hut, Roman,
     Taschenuhr, Rosen …) und Dinge aus der Welt: Was er trägt oder mit der Telekinese hält
     (Champagnerflasche, Whiskyglas, Goldbarren, Schellackplatte …), steckt Umschalt+E ein.
     Jedes Ding lässt sich ansehen, benutzen (trinken, lesen, rauchen, auf die Uhr sehen …),
     einem Bürger in der Nähe schenken (Ansehen), ablegen (liegt dann wieder in der Welt) oder
     von Randolf nach Hause bringen lassen.
   - SCHLÜSSEL: zu allem, was ihm gehört (aus dem Kontor). Die Schlüssel zur Suite, zur Villa,
     zum Belmont und zur Aurora Imperial bringen ihn hin.
   - SAMMLUNG: die zwölf goldenen Gründungsmedaillen, die die Stadt zum Jubiläum versteckt hat.
     Sie schweben golden an besonderen Orten; wer alle findet, bekommt die Ehrenkette.
   - ZUHAUSE: was Randolf verwahrt. Mitnehmen geht in der Villa oder in der Penthouse-Suite.
   Gespeichert wird mit dem Kontor (localStorage 'vespera.kontor': KT.s.items und KT.s.inv).
   Keine Shader: Medaillen sind ein Standardmaterial mit kleiner Leinwandtextur, das Buch ist HTML.
   ===================================================================== */
import { T, $, scene } from './core.js';
import { player } from './player.js';
import { playing, paused, isTouch, tryLock } from './input.js';
import { toast, VIEWS, goView, districtAt } from './boat.js';
import { DINE } from './venues.js';
import { citizens } from './ragdoll.js';
import { lifeSay } from './life.js';
import { inPenthouse, PH } from './penthouse.js';
import { inVillaHouse } from './villa.js';
import { LOOSE, spawnProp, dropBody } from './physics.js';
import { POWERS, tkRelease } from './powers.js';
import { DRIVE } from './eating.js';
import { KT, BIZ, GOODS, ktChanged, ktRep, ktEmit, lagerUsed, lagerCap, postPos, esc, fmM, ktOpen, titleCase } from './kontor.js';

export const INV_CAP = 20;
export const INV = { open: false, tab: 'taschen', sel: 0, read: null, ready: false, med: [], medT: 0, hudN: -1 };

/* ---------- Was es gibt ---------- */
// Ware aus den Läden (k = Ladenart, wie aufgaben.js sie erwartet)
const INV_SHOP = {
  hut: { n: 'Filzhut mit Seidenband', ic: 'hut', v: 5, prop: 'hatbox', t: 'Grauer Filz, schwarzes Seidenband, in der Hutschachtel des Ladens.', use: ['Aufsetzen', 'hut'] },
  buch: { n: 'Roman in Leder', ic: 'buch', v: 4, prop: 'book', t: 'Goldprägung auf dem Rücken, der Duft von frischem Papier.', use: ['Lesen', 'lesen'] },
  deli: { n: 'Bergkäse und Oliven', ic: 'essen', v: 3, t: 'In Wachspapier eingeschlagen, mit einem Zweig Rosmarin.', use: ['Essen', 'essen'] },
  tabak: { n: 'Zigarre', ic: 'zigarre', v: 2, prop: 'cigarbox', t: 'Handgerollt, aus der Kiste von heute Morgen.', use: ['Rauchen', 'rauchen'] },
  uhren: { n: 'Goldene Taschenuhr', ic: 'uhr', v: 180, prop: 'clock', t: 'Achtzehn Karat, Sprungdeckel mit Sonnenfächer, Kette aus Gold.', use: ['Auf die Uhr sehen', 'uhr'], keep: true },
  blumen: { n: 'Weiße Rosen', ic: 'blume', v: 3, prop: 'flowervase', t: 'Ein Strauß weißer Rosen, wie Alexander sie am Revers trägt.', use: ['Eine ans Revers', 'rose'] },
  apotheke: { n: 'Kölnisch Wasser', ic: 'flakon', v: 2, t: 'Hustenbonbons und ein Flakon Kölnisch Wasser.', use: ['Auftragen', 'parfum'] },
  mode: { n: 'Abendkleid mit Perlen', ic: 'kleid', v: 60, t: 'Champagnerfarbene Seide, Perlenstickerei, eine Schleppe. Ein Geschenk, das man nicht vergisst.' },
  platten: { n: 'Schellackplatte', ic: 'platte', v: 2.5, prop: 'record', t: 'Ein Foxtrott der Kapelle aus dem Belmont, 78 Umdrehungen.', use: ['Auflegen', 'platte'] },
  spiel: { n: 'Blechlokomotive', ic: 'lok', v: 4, t: 'Rot und gold lackiert, mit Schlüssel zum Aufziehen.', use: ['Aufziehen', 'lok'] },
  schneider: { n: 'Anzug nach Maß', ic: 'anzug', v: 120, t: 'Mitternachtsblauer Kammgarn, Revers aus Seide.' },
};
// Dinge aus der Welt (k = 'p:' + Körperart aus physics.js)
const INV_PROP = {
  champagne: { ic: 'flasche', v: 40, t: 'Champagner, Jahrgang 1911. Die Flasche ist noch kalt.', use: ['Ein Schluck', 'trinken'], u: 4 },
  coupe: { ic: 'glas', v: 2, t: 'Eine Champagnerschale aus Kristall, frisch eingeschenkt.', use: ['Austrinken', 'trinken'], u: 1, leer: 'Die leere Schale stellt Alexander beiseite.' },
  whisky: { ic: 'flasche', v: 30, t: 'Zwanzig Jahre alter Whisky aus den Highlands.', use: ['Ein Schluck', 'trinken'], u: 4 },
  tumbler: { ic: 'glas', v: 2, t: 'Ein Whiskyglas, zwei Finger breit, ohne Eis.', use: ['Austrinken', 'trinken'], u: 1, leer: 'Das leere Glas stellt Alexander beiseite.' },
  decanter: { ic: 'flasche', v: 25, t: 'Eine Karaffe aus geschliffenem Glas mit altem Cognac.', use: ['Ein Schluck', 'trinken'], u: 3 },
  apple: { ic: 'essen', v: 0.2, t: 'Ein roter Apfel, eingeflogen aus dem Süden.', use: ['Essen', 'essen'], u: 1 },
  orange: { ic: 'essen', v: 0.3, t: 'Eine Orange aus Valencia: im Polarwinter ein kleines Wunder.', use: ['Essen', 'essen'], u: 1 },
  cigarbox: { ic: 'zigarre', v: 20, t: 'Eine Kiste kubanischer Zigarren, Zedernholz.', use: ['Eine rauchen', 'rauchen'], u: 10 },
  book: { ic: 'buch', v: 6, t: 'Ein Stapel Bücher, in Leder gebunden.', use: ['Lesen', 'lesen'] },
  record: { ic: 'platte', v: 2.5, t: 'Eine Schellackplatte, Jazz aus dem Ballsaal.', use: ['Auflegen', 'platte'] },
  clock: { ic: 'uhr', v: 90, t: 'Eine Kaminuhr aus Marmor und vergoldeter Bronze.', use: ['Auf die Uhr sehen', 'uhr'], keep: true },
  goldbar: { ic: 'gold', v: 1100, t: 'Ein Barren Feingold, 12,4 Kilo, mit dem Stempel der Vespera-Bank. Für Alexander kein Gewicht.', use: ['Ins Lagerhaus bringen lassen', 'gold'] },
  statuette: { ic: 'figur', v: 150, t: 'Eine Bronzefigur: eine Tänzerin mit Fächer, signiert.' },
  flowervase: { ic: 'blume', v: 8, t: 'Eine Kristallvase mit frischen Blumen.' },
  frame: { ic: 'bild', v: 15, t: 'Ein Bilderrahmen mit einer Fotografie vom Bau des Belmont.' },
  candlestick: { ic: 'leuchter', v: 18, t: 'Ein versilberter Kerzenleuchter.' },
  ashtray: { ic: 'schale', v: 5, t: 'Ein Aschenbecher aus Messing, mit dem Sonnenfächer des Belmont.' },
  shaker: { ic: 'shaker', v: 9, t: 'Ein Cocktailshaker aus Silber. Darin: ein Rest Gin Fizz.' },
  telephone: { ic: 'telefon', v: 22, t: 'Ein Fernsprecher aus Bakelit. Die Schnur ist ab.' },
  lantern: { ic: 'leuchter', v: 4, t: 'Eine Sturmlaterne vom Hafen.' },
  radio: { ic: 'radio', v: 45, t: 'Ein Röhrenradio von Radiowerk Polaris.' },
  typewriter: { ic: 'kasten', v: 35, t: 'Eine Schreibmaschine. Jemand vermisst sie sicher.' },
  icebucket: { ic: 'kuebel', v: 14, t: 'Ein Sektkühler aus Silber, mit Eis.' },
  teatray: { ic: 'schale', v: 26, t: 'Ein Teeservice aus Porzellan auf silbernem Tablett.' },
  chessboard: { ic: 'kasten', v: 12, t: 'Ein Schachbrett mit Figuren aus Elfenbein. Weiß steht besser.' },
  hatbox: { ic: 'hut', v: 6, t: 'Eine Hutschachtel mit Seidenpapier.' },
  cushion: { ic: 'kissen', v: 7, t: 'Ein Samtkissen in Petrol.' },
  cushionC: { ic: 'kissen', v: 9, t: 'Ein Seidenkissen in Champagner.' },
  bucket: { ic: 'kuebel', v: 1, t: 'Ein Blecheimer. Nicht gerade Alexanders Stil.' },
};
const INV_POCKET = new Set(Object.keys(INV_PROP));

// Gründungsmedaillen: Ort, Rätsel (die Lage wird beim Start bestimmt)
const INV_MEDS = [
  { id: 'platz', n: 'Medaille des Platzes', h: 'Wo die ganze Stadt zum Belmont aufschaut.', at: () => [VIEWS.Digit1.p[0] + 7, VIEWS.Digit1.p[1], VIEWS.Digit1.p[2] - 4] },
  { id: 'lobby', n: 'Medaille der Lobby', h: 'Unter dem Kronleuchter, wo die Gäste ankommen.', at: () => [-4, 0.26, 47] },
  { id: 'ball', n: 'Medaille des Ballsaals', h: 'Wo die Kapelle spielt und getanzt wird.', at: () => [VIEWS.Digit8.p[0] - 2, VIEWS.Digit8.p[1], VIEWS.Digit8.p[2] + 2] },
  { id: 'terrasse', n: 'Medaille der Dachterrasse', h: 'Hoch über allen, vor Alexanders eigenen Fenstern.', at: () => [0, PH.F1, 27] },
  { id: 'mast', n: 'Medaille des Ankermasts', h: 'Wo die Luftschiffe festmachen, über den Dächern.', at: () => [VIEWS.Digit4.p[0] + 2, VIEWS.Digit4.p[1], VIEWS.Digit4.p[2] + 2] },
  { id: 'promenade', n: 'Medaille der Promenade', h: 'Am Wasser, wo man abends spazieren geht.', at: () => [VIEWS.Digit3.p[0] - 6, VIEWS.Digit3.p[1], VIEWS.Digit3.p[2] + 3] },
  { id: 'villa', n: 'Medaille der Bergvilla', h: 'Vor dem eigenen Haus, hoch am Kraterrand.', at: () => VIEWS.Digit5.p },
  { id: 'tunnel', n: 'Medaille des Tunnels', h: 'Am Tor, durch das jeder nach Vespera kommt.', at: () => VIEWS.Digit6.p },
  { id: 'kai', n: 'Medaille des Güterkais', h: 'Wo Kaffee, Tee und Pelze an Land gehen.', at: () => inPost('kai', 4) },
  { id: 'luft', n: 'Medaille des Luftschiffhafens', h: 'Vor der Halle, in der die Reisenden aus Paris ankommen.', at: () => inPost('luft', 5) },
  { id: 'kneipe', n: 'Medaille des Kneipenplatzes', h: 'Mitten unter den Arbeitern, wo die Messinglaterne hängt.', at: () => inPost('kneipe', 4) },
  { id: 'depot', n: 'Medaille der Fabriken', h: 'Wo der Stahl gewalzt wird und die Schlote rauchen.', at: () => inPost('depot', 4) },
];
function inPost(pid, d) { const P = postPos(pid); return P ? [P.x + d, P.y, P.z + d * 0.5] : null; }

// Schlüssel: Besitz aus dem Kontor; die wichtigsten bringen Alexander hin
const INV_KEYS = {
  belmont: { n: 'Generalschlüssel des Belmont', t: 'Öffnet jede Tür im Hotel, vom Weinkeller bis zum Ballsaal.', go: 'Digit7', d: 'Zur Lobby' },
  villa: { n: 'Schlüssel der Bergvilla', t: 'Schwer, aus Messing, mit dem Monogramm A. Randolf hat den zweiten.', go: 'Digit5', d: 'Zur Villa' },
  imperial: { n: 'Bordschlüssel der Aurora Imperial', t: 'Für die Brücke und den Salon. Die Besatzung erwartet Sie.', go: 'Digit4', d: 'Zum Ankermast' },
};
const INV_SUITE = { n: 'Schlüssel der Penthouse-Suite', t: 'Golden, mit dem Sonnenfächer. Er öffnet die Suite ganz oben im Belmont, wo der Kristall ruht.', go: 'Digit2', d: 'Zur Suite' };

/* ---------- Zustand ---------- */
function invState() {
  const s = KT.s; if (!s) return null;
  if (!Array.isArray(s.items)) s.items = [];
  if (!s.inv || typeof s.inv !== 'object') s.inv = {};
  const v = s.inv;
  if (!Array.isArray(v.home)) v.home = [];
  if (!v.med || typeof v.med !== 'object') v.med = {};
  if (!v.gift) v.gift = { d: 0, n: 0 };
  return v;
}
export function invDef(it) {
  if (!it) return null;
  if (it.k && it.k.startsWith('p:')) { const D = INV_PROP[it.prop || it.k.slice(2)] || {}; return { ic: 'kasten', v: 5, t: '', ...D, prop: it.prop || it.k.slice(2) }; }
  return INV_SHOP[it.k] || { ic: 'kasten', v: 3, t: '' };
}
const invName = it => it.n ? it.n.charAt(0).toUpperCase() + it.n.slice(1) : 'Etwas';
export const invItems = () => (KT.s && KT.s.items) || [];
export const invFull = () => invItems().length >= INV_CAP;

/* ---------- Einstecken (Umschalt+E, oder im Inventar) ---------- */
export function invCanPocket(B) {
  return !!(B && INV_POCKET.has(B.key) && !B.quest && !B.furn && !B.src && LOOSE.bodies.includes(B));
}
export function invHeld() { const B = LOOSE.held || LOOSE.tk; return invCanPocket(B) ? B : null; }
export function invPocket(B = invHeld()) {
  if (!KT.ready || !invCanPocket(B)) return false;
  if (invFull()) { toast(`Die Taschen sind voll (${INV_CAP}) · Umschalt+I: Inventar, etwas nach Hause schicken`); return false; }
  if (LOOSE.tk === B && POWERS.tk) { try { tkRelease(false); } catch (e) { /* egal */ } }
  const D = INV_PROP[B.key], where = districtAt(B.x.x, B.x.z, B.x.y);
  const it = { k: 'p:' + B.key, prop: B.key, n: B.name, from: where ? where[0] : 'Vespera', d: KT.s.day };
  if (D && D.u) it.u = D.u;
  dropBody(B);
  KT.s.items.push(it);
  toast(`${B.name} eingesteckt · ${isTouch ? 'Taschen oben rechts' : 'Umschalt+I: Inventar'}`);
  ktChanged('inv');
  return true;
}

/* ---------- Benutzen, Schenken, Ablegen, nach Hause ---------- */
const INV_BOOKS = [
  ['Das Licht über dem Krater', 'Als die Expedition den Kraterrand erreichte, lag unter ihnen ein Tal aus Eis, und in seiner Mitte glomm etwas, das kein Stern war …'],
  ['Die Gäste des Grand Hotels', 'Im Belmont schläft niemand vor drei Uhr morgens. Die Kapelle spielt, solange einer tanzt, und es tanzt immer einer.'],
  ['Nordlicht und Champagner', 'Sie trug Perlen und lachte über seine Witze, obwohl sie wusste, dass er der reichste Mann der Stadt war. Vielleicht gerade deshalb.'],
  ['Der Ingenieur von Vespera', 'Die Viadukte, sagte er, seien das Rückgrat der Stadt. Der Kristall aber sei ihr Herz. Niemand außer ihm verstand, was er damit meinte.'],
  ['Sechs Monate Nacht', 'In der Polarnacht vergisst man die Sonne nicht. Man lernt nur, dass Gold auch im Lampenlicht glänzt.'],
];
const INV_THANKS = {
  arbeiter: ['Für mich? Herr Alexander … das ist zu viel.', 'Das zeig ich meiner Frau! Danke, Herr Alexander!', 'Sie sind ein feiner Herr, Herr Alexander.'],
  buerger: ['Wie aufmerksam, Herr Alexander! Vielen Dank!', 'Ein Geschenk von Ihnen? Das hebe ich auf!', 'Herr Alexander, Sie überraschen mich immer wieder.'],
  elite: ['Ganz entzückend, Alexander. Sie haben Geschmack.', 'Das wird man im Belmont bewundern. Danke!', 'Mon dieu, Alexander … Sie verwöhnen mich.'],
};
const pickI = a => a[Math.floor(Math.random() * a.length)];
function invRemove(it) { const a = KT.s.items, i = a.indexOf(it); if (i >= 0) a.splice(i, 1); INV.sel = Math.min(INV.sel, Math.max(0, a.length - 1)); }
export function invUse(it) {
  const D = invDef(it); if (!D || !D.use) return false;
  const how = D.use[1], s = KT.s;
  let used = !D.keep;
  if (how === 'trinken') toast(D.u === 1 ? `${invName(it)}: auf Vespera! ${D.leer || ''}` : `Ein Schluck aus der ${invName(it)}. Zum Wohl, Herr Alexander.`);
  else if (how === 'essen') toast(`${invName(it)}: köstlich.`);
  else if (how === 'rauchen') toast('Alexander zündet sich eine Zigarre an. Der Rauch steigt in den Nebel.');
  else if (how === 'parfum') toast('Ein Hauch Kölnisch Wasser. Bergamotte und Zitrone.');
  else if (how === 'rose') { toast('Eine weiße Rose am Revers. So kennt ihn die Stadt.'); }
  else if (how === 'hut') { toast('Der Hut steht Ihnen, Herr Alexander. Aber zum Frack trägt man ihn nicht.'); used = false; }
  else if (how === 'lok') { toast('Die Blechlokomotive rattert im Kreis. Ein Kind würde sich freuen.'); used = false; }
  else if (how === 'platte') { toast(inPenthouse(player.p) || inVillaHouse(player.p) ? 'Das Grammophon spielt einen Foxtrott. Bitte nicht stören.' : 'Ein Grammophon fehlt. In der Villa oder in der Suite gibt es eins.'); used = false; }
  else if (how === 'uhr') { const n = Math.max(0, Math.ceil(240 - s.t)); toast(`Geschäftstag ${s.day} · Abrechnung in ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} min · draußen ist Polarnacht`); used = false; }
  else if (how === 'lesen') { INV.read = (s.day * 7 + s.items.indexOf(it)) % INV_BOOKS.length; used = false; }
  else if (how === 'gold') {
    if (lagerUsed() + 1 > lagerCap()) { toast('Das Lagerhaus ist voll'); return false; }
    s.lager.gold = (s.lager.gold || 0) + 1; toast('Ein Bote bringt den Goldbarren ins Lagerhaus am Güterkai · Kontor (I) · Handel');
  }
  if (used) { if (it.u > 1) it.u--; else invRemove(it); }
  ktChanged('inv');
  return true;
}
export function invNearCitizen(r = 4) {
  const p = player.p; let best = null, bd = r * r;
  for (const c of citizens) {
    const a = c.ped && c.ped.a; if (!a || !a.on) continue;
    const e = a.m.elements, d = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d < bd && Math.abs(e[13] - p.y) < 2.5) { bd = d; best = c; }
  }
  return best;
}
export function invGift(it) {
  const c = invNearCitizen(); if (!c) { toast('Niemand in der Nähe, dem man es schenken könnte'); return false; }
  // wartet die Person genau darauf (Aufgabe)? dann die Aufgabe abschließen lassen
  if (c.use && /^Übergeben/.test(c.use.label || '')) { c.use.act(); ktChanged('inv'); return true; }
  const D = invDef(it), g = INV.giftGroup(c), v = invState();
  invRemove(it);
  lifeSay(c.name, pickI(INV_THANKS[g]), 4);
  if (v.gift.d !== KT.s.day) v.gift = { d: KT.s.day, n: 0 };
  if (v.gift.n < 3) { v.gift.n++; ktRep(g, D.v >= 50 ? 2 : 1); toast(`${invName(it)} an ${c.name} verschenkt · Ansehen ${g === 'arbeiter' ? 'Arbeiter' : g === 'elite' ? 'Elite' : 'Bürger'} +${D.v >= 50 ? 2 : 1}`); }
  else toast(`${invName(it)} an ${c.name} verschenkt`);
  if (D.v >= 100) ktEmit('aufgabe', 'Großzügiger Gründer', `${c.name} erhielt von Alexander persönlich ein Geschenk: ${invName(it)}.`);
  ktChanged('inv');
  return true;
}
INV.giftGroup = c => c.kind === 'worker' ? 'arbeiter' : (c.kind === 'lady' && Math.random() < 0.3) ? 'elite' : 'buerger';
export function invDrop(it) {
  const D = invDef(it);
  if (!D.prop) { toast('Das legt man nicht einfach auf die Straße · verschenken oder nach Hause schicken'); return false; }
  if (DRIVE.on) { toast('Erst aussteigen'); return false; }
  const p = player.p, yaw = player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const B = spawnProp(D.prop, p.x + fx * 0.9, p.y + 0.9, p.z + fz * 0.9, yaw);
  if (!B) { toast('Hier ist kein Platz mehr dafür'); return false; }
  B.awake = true; invRemove(it);
  toast(`${invName(it)} abgelegt`);
  ktChanged('inv');
  return true;
}
export const invAtHome = () => inPenthouse(player.p) || inVillaHouse(player.p);
export function invSendHome(it) {
  const v = invState(); invRemove(it); v.home.push(it);
  toast(`Randolf lässt ${invName(it)} abholen und verwahrt es zu Hause`);
  ktChanged('inv');
}
export function invTakeHome(i) {
  const v = invState(), it = v.home[i]; if (!it) return false;
  if (!invAtHome()) { toast('Das liegt zu Hause: in der Villa oder in der Suite holen'); return false; }
  if (invFull()) { toast('Die Taschen sind voll'); return false; }
  v.home.splice(i, 1); KT.s.items.push(it); toast(`${invName(it)} mitgenommen`); ktChanged('inv');
  return true;
}
function invKeys() {
  const s = KT.s, out = [INV_SUITE];
  for (const id in s.own) {
    const B = BIZ[id]; if (!B) continue;
    out.push(INV_KEYS[id] || { n: 'Schlüssel: ' + B.n, t: `${B.ort}. ${B.sec === 'industrie' ? 'Zum Tor und zum Kontor der Fabrik.' : 'Zur Tür und zur Ladenkasse.'}` });
  }
  return out;
}

/* ---------- Gründungsmedaillen in der Welt ---------- */
let invMedGeo = null, invMedMat = null, invHaloMat = null;
function invMedTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c9a258'; g.fillRect(0, 0, 128, 128);
  g.translate(64, 64); g.strokeStyle = '#f6dc9a'; g.lineWidth = 3;
  for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 54); g.stroke(); }
  g.fillStyle = '#7a5a20'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#f6dc9a'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f6dc9a'; g.font = 'bold 18px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('V', 0, 1);
  const t = new T.CanvasTexture(c); t.anisotropy = 2; return t;
}
function invHaloTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,226,150,0.9)'); r.addColorStop(0.35, 'rgba(240,190,90,0.35)'); r.addColorStop(1, 'rgba(240,190,90,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new T.CanvasTexture(c);
}
function invBuildMeds() {
  const v = invState();
  invMedGeo = new T.CylinderGeometry(0.24, 0.24, 0.035, 28); invMedGeo.rotateX(Math.PI / 2);
  invMedMat = new T.MeshStandardMaterial({ color: 0xd9b26a, metalness: 0.85, roughness: 0.3, map: invMedTex(), emissive: 0x6a4a12, emissiveIntensity: 0.9 });
  invHaloMat = new T.SpriteMaterial({ map: invHaloTex(), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false });
  for (const M of INV_MEDS) {
    let at = null; try { at = M.at(); } catch (e) { at = null; }
    if (!at || !isFinite(at[0])) continue;
    const g = new T.Group(); g.position.set(at[0], at[1] + 1.3, at[2]);
    const m = new T.Mesh(invMedGeo, invMedMat); g.add(m);
    const h = new T.Sprite(invHaloMat); h.scale.set(1.5, 1.5, 1); g.add(h);
    g.name = 'medaille:' + M.id; g.visible = !v.med[M.id];
    scene.add(g);
    INV.med.push({ M, g, m, ph: Math.random() * 6 });
  }
}
function invMedStep(dt, t) {
  const v = invState(), p = player.p;
  for (const o of INV.med) {
    if (!o.g.visible) continue;
    const dx = o.g.position.x - p.x, dz = o.g.position.z - p.z;
    if (dx * dx + dz * dz > 160 * 160) continue;
    o.m.rotation.y = t * 1.6 + o.ph;
    o.g.position.y += Math.sin(t * 2 + o.ph) * 0.002;
    if (dx * dx + dz * dz < 1.6 * 1.6 && Math.abs(o.g.position.y - 1.0 - p.y) < 2) invCollect(o, v);
  }
}
function invCollect(o, v) {
  v.med[o.M.id] = KT.s.day; o.g.visible = false;
  const n = Object.keys(v.med).length;
  toast(`${o.M.n} gefunden · ${n} von ${INV_MEDS.length}`);
  if (n === INV_MEDS.length && !v.kette) {
    v.kette = KT.s.day; ktRep('elite', 5); ktRep('buerger', 5);
    ktEmit('aufgabe', 'Die Ehrenkette', 'Alexander hat alle zwölf Gründungsmedaillen gefunden. Der Bürgermeister überreicht ihm die goldene Ehrenkette der Stadt Vespera.');
    setTimeout(() => toast('Alle zwölf Medaillen! Die Stadt verleiht Ihnen die goldene Ehrenkette · Ansehen +5'), 2600);
  }
  ktChanged('inv');
}
function invMedReset() { const v = invState(); for (const o of INV.med) o.g.visible = !v.med[o.M.id]; }

/* ---------- Symbole (kleine Art-déco-Linien, SVG) ---------- */
const INV_IC = {
  flasche: '<path d="M10 2h4v5l2 3v12H8V10l2-3z"/><path d="M8 14h8"/>',
  glas: '<path d="M5 4h14l-7 8zM12 12v8M8 21h8"/>',
  buch: '<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2z"/><path d="M5 19a2 2 0 0 1 2-2h12M9 7h6"/>',
  hut: '<path d="M3 17c3 2 15 2 18 0M7 16V9c0-2 2-3 5-3s5 1 5 3v7M7 12h10"/>',
  uhr: '<circle cx="12" cy="14" r="7"/><path d="M12 14V10M12 14l3 2M12 7V4M10 3h4"/>',
  blume: '<circle cx="12" cy="8" r="3"/><path d="M12 11v10M12 16c-2-1-4-1-5 0M12 18c2-1 4-1 5 0M9 6c-2-2 0-4 3-3 3-1 5 1 3 3"/>',
  zigarre: '<path d="M3 13h15v3H3zM18 13h3v3h-3M6 13v3M20 10c0-2-2-2-2-4"/>',
  flakon: '<path d="M8 9h8v12H8zM10 9V6h4v3M11 3h2v3h-2M8 14h8"/>',
  kleid: '<path d="M9 3l3 3 3-3M9 3 8 9h8l-1-6M8 9l-3 12h14L16 9M8 14h8"/>',
  platte: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 5a7 7 0 0 1 7 7"/>',
  lok: '<path d="M3 17h18M5 17V9h6v8M11 12h8v5M7 9V6M15 12V9h3"/><circle cx="7" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/>',
  anzug: '<path d="M8 3l4 5 4-5M8 3 4 6v15h16V6l-4-3M12 8v13M10 12h.01M10 15h.01"/>',
  essen: '<circle cx="12" cy="13" r="7"/><path d="M12 6c0-2 1-3 3-3"/>',
  gold: '<path d="M6 9h12l3 8H3zM6 9l2 3h8l2-3M8 12l-1 5M16 12l1 5"/>',
  figur: '<circle cx="12" cy="5" r="2"/><path d="M12 7v7l-3 7M12 14l3 7M12 9l-5-3M12 9l5 2M8 21h8"/>',
  bild: '<path d="M4 4h16v16H4zM7 7h10v10H7zM7 15l3-4 3 3 2-2 2 3"/>',
  leuchter: '<path d="M12 3v3M10 6h4v10h-4zM7 21h10M12 16v5"/>',
  schale: '<path d="M3 12h18c0 4-4 7-9 7s-9-3-9-7zM8 9c0-2 1-3 2-3M14 9c0-2 1-3 2-3"/>',
  shaker: '<path d="M8 8h8l-1 13H9zM9 8V6h6v2M11 3h2v3h-2"/>',
  telefon: '<path d="M5 9c0-3 3-5 7-5s7 2 7 5l-3 1-1-2H9l-1 2zM8 12h8l2 9H6z"/>',
  radio: '<path d="M4 8h16v12H4zM8 8l6-5"/><circle cx="9" cy="14" r="3"/><path d="M15 12h3M15 15h3"/>',
  kasten: '<path d="M4 7h16v13H4zM4 7l2-3h12l2 3M10 11h4"/>',
  kuebel: '<path d="M5 6h14l-2 15H7zM7 10h10"/>',
  kissen: '<path d="M4 6c4 1 12 1 16 0-1 4-1 8 0 12-4-1-12-1-16 0 1-4 1-8 0-12z"/>',
  schluessel: '<circle cx="7" cy="12" r="4"/><path d="M11 12h10M17 12v3M20 12v2"/>',
  medaille: '<path d="M8 2l3 7M16 2l-3 7"/><circle cx="12" cy="15" r="6"/><circle cx="12" cy="15" r="2.5"/>',
};
const invSvg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${INV_IC[k] || INV_IC.kasten}</svg>`;

/* ---------- Oberfläche (HTML) ---------- */
const INV_TABS = [['taschen', 'Taschen'], ['schluessel', 'Schlüssel'], ['sammlung', 'Sammlung'], ['zuhause', 'Zuhause']];
function invCss() {
  const st = document.createElement('style');
  st.textContent = `
#ktHud .inv{pointer-events:auto;cursor:pointer;font:600 11px/1 var(--body);letter-spacing:.24em;color:var(--muted,#b9ab8f);background:var(--panel,rgba(5,16,24,.72));border:1px solid rgba(217,178,106,.35);padding:5px 10px 4px;white-space:nowrap}
#ktHud .inv b{color:var(--gold-hi,#f6dc9a);font-weight:600;margin-left:6px}
#inv{position:fixed;z-index:17;left:50%;top:50%;transform:translate(-50%,-50%);width:min(860px,calc(100% - 24px));height:min(600px,calc(100% - 24px));display:grid;grid-template-rows:auto auto 1fr auto;
 background:linear-gradient(180deg,rgba(6,26,30,.97),rgba(4,16,22,.97));border:1px solid rgba(217,178,106,.8);box-shadow:0 0 0 5px rgba(4,14,20,.7),0 0 0 6px rgba(217,178,106,.35),0 20px 60px rgba(0,0,0,.6);color:var(--ink,#efe6d2);font-family:var(--body)}
#inv header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 20px 6px;border-bottom:1px solid rgba(217,178,106,.3)}
#inv h2{font:400 26px/1 var(--display);letter-spacing:.16em;color:var(--gold-hi,#f6dc9a);margin:0}
#inv header .w{font-size:13px;letter-spacing:.1em;color:var(--muted,#b9ab8f);text-align:right}
#inv header .w b{color:var(--gold-hi,#f6dc9a)}
#inv nav{display:flex;flex-wrap:wrap;gap:4px;padding:8px 16px 0}
#inv nav button{font:600 12px/1 var(--body);letter-spacing:.2em;text-transform:uppercase;color:var(--muted,#b9ab8f);background:none;border:1px solid transparent;border-bottom:none;padding:8px 10px 6px;cursor:pointer}
#inv nav button.on{color:var(--gold-hi,#f6dc9a);border-color:rgba(217,178,106,.5);background:rgba(217,178,106,.08)}
#inv nav kbd{font-size:10px;padding:1px 4px 0;margin-right:6px;opacity:.7}
#inv main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);min-height:0;border-top:1px solid rgba(217,178,106,.5)}
#inv .slots{overflow:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));grid-auto-rows:min-content;gap:8px;align-content:start;scrollbar-color:rgba(217,178,106,.5) transparent}
#inv .slot{position:relative;aspect-ratio:1;display:grid;place-items:center;align-content:center;gap:6px;padding:8px 4px 6px;border:1px solid rgba(217,178,106,.3);background:rgba(217,178,106,.04);color:var(--ink,#efe6d2);font:600 10px/1.2 var(--body);letter-spacing:.06em;text-align:center;cursor:pointer;clip-path:polygon(8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px),0 8px)}
#inv .slot:hover{background:rgba(217,178,106,.12)}
#inv .slot.on{border-color:#f6dc9a;background:rgba(217,178,106,.18);box-shadow:inset 0 0 0 1px rgba(246,220,154,.4)}
#inv .slot.leer{cursor:default;opacity:.35;background:none}
#inv .slot.zu{opacity:.4}
#inv .slot svg{width:34px;height:34px;fill:none;stroke:var(--gold-hi,#f6dc9a);stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round}
#inv .slot.zu svg{stroke:var(--muted,#b9ab8f)}
#inv .slot i{position:absolute;right:6px;top:4px;font-style:normal;font-size:10px;color:#7fe3d6}
#inv .info{overflow:auto;padding:16px 18px;border-left:1px solid rgba(217,178,106,.3)}
#inv .info h3{font:400 20px/1.2 var(--display);letter-spacing:.1em;color:var(--gold-hi,#f6dc9a);margin:0 0 4px}
#inv .info small{display:block;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold,#d9b26a);margin-bottom:10px}
#inv .info p{margin:6px 0;font-size:13px;line-height:1.55;color:var(--muted,#b9ab8f)}
#inv .info blockquote{margin:10px 0;padding:8px 12px;border-left:2px solid rgba(217,178,106,.6);font:italic 14px/1.6 var(--body);color:var(--ink,#efe6d2)}
#inv .info .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
#inv button.b,#inv footer button{font:600 12px/1 var(--body);letter-spacing:.08em;color:var(--ink,#efe6d2);background:rgba(217,178,106,.1);border:1px solid rgba(217,178,106,.45);padding:7px 10px 5px;cursor:pointer;white-space:nowrap}
#inv button.b:hover,#inv footer button:hover{background:rgba(217,178,106,.25)}
#inv button.b:disabled{opacity:.35;cursor:default;background:none}
#inv button.gold{color:#1a1206;background:linear-gradient(#f6dc9a,#c9a258);border-color:#f6dc9a}
#inv .here{grid-column:1/-1;border:1px solid rgba(64,200,190,.6);background:rgba(64,200,190,.08);padding:8px 12px;font-size:13px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#inv .here b{color:var(--gold-hi,#f6dc9a)}
#inv footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 20px 10px;border-top:1px solid rgba(217,178,106,.3);font-size:12px;color:var(--muted,#b9ab8f);letter-spacing:.06em}
@media (max-width:640px){#inv main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}#inv .info{border-left:none;border-top:1px solid rgba(217,178,106,.3)}#inv h2{font-size:20px}#inv .slots{grid-template-columns:repeat(auto-fill,minmax(74px,1fr))}}
`;
  document.head.append(st);
}
function invDom() {
  invCss();
  const el = document.createElement('div'); el.id = 'inv'; el.hidden = true;
  el.innerHTML = `<header><h2>Inventar</h2><div class="w"></div></header><nav>${INV_TABS.map(([k, n], i) => `<button type="button" data-tab="${k}"><kbd>${i + 1}</kbd>${n}</button>`).join('')}</nav><main><div class="slots"></div><div class="info"></div></main><footer><span>${isTouch ? '' : 'Umschalt+I oder Esc schließt · Pfeile wählen · E benutzen · Zahlen wechseln die Seite · '}Geld und Besitz: Kontor (I)</span><button type="button" data-act="close">Schließen</button></footer>`;
  el.addEventListener('click', invClick);
  document.body.append(el);
  const hud = $('ktHud');
  if (hud) {
    const c = document.createElement('div'); c.className = 'inv'; c.title = 'Inventar (Umschalt+I)';
    c.addEventListener('click', () => { if (playing && !INV.open && !DINE.menuOpen) invOpen(); });
    hud.querySelector('.cash') ? hud.querySelector('.cash').after(c) : hud.append(c);
  }
}
export function invOpen(tab) {
  if (!KT.ready || INV.open) return;
  if (KT.open) { KT.open = false; $('kt').hidden = true; }   // aus dem Kontor herüber
  if (tab) INV.tab = tab; else if (invHeld()) INV.tab = 'taschen';
  INV.open = true; INV.read = null; DINE.menuOpen = true; DINE.onPick = null;
  $('inv').hidden = false; invRender();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* egal */ }
}
export function invClose() {
  if (!INV.open) return;
  INV.open = false; DINE.menuOpen = false; $('inv').hidden = true;
  if (!isTouch && playing && !paused) tryLock();
}
// die Liste der aktuellen Seite (für Auswahl und Pfeiltasten)
function invList() {
  const v = invState();
  if (INV.tab === 'taschen') return KT.s.items;
  if (INV.tab === 'zuhause') return v.home;
  if (INV.tab === 'schluessel') return invKeys();
  return INV_MEDS;
}
function invClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { INV.tab = b.dataset.tab; INV.sel = 0; INV.read = null; invRender(); return; }
  if (b.dataset.sel != null) { INV.sel = +b.dataset.sel; INV.read = null; invRender(); return; }
  invAct(b.dataset.act);
}
function invAct(a) {
  const list = invList(), it = list[INV.sel];
  if (a === 'close') { invClose(); return; }
  if (a === 'pocket') invPocket();
  else if (a === 'kontor') { invClose(); ktOpen(); return; }
  else if (!it) return;
  else if (a === 'use') invUse(it);
  else if (a === 'gift') invGift(it);
  else if (a === 'drop') invDrop(it);
  else if (a === 'home') invSendHome(it);
  else if (a === 'take') invTakeHome(INV.sel);
  else if (a === 'go' && it.go) { invClose(); goView(it.go); return; }
  invRender();
}
function invRender() {
  const el = $('inv'); if (!el || el.hidden) return;
  const s = KT.s, v = invState(), list = invList();
  if (INV.sel >= list.length) INV.sel = Math.max(0, list.length - 1);
  el.querySelector('header .w').innerHTML = `Taschen <b>${s.items.length} / ${INV_CAP}</b> · Medaillen <b>${Object.keys(v.med).length} / ${INV_MEDS.length}</b><br>Bargeld ${fmM(s.cash)}`;
  el.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === INV.tab));
  const slots = el.querySelector('.slots'), info = el.querySelector('.info'), sc = slots.scrollTop;
  let h = '', d = '';
  const slot = (i, ic, n, extra = '', cls = '') => `<button type="button" class="slot${i === INV.sel ? ' on' : ''}${cls}" data-sel="${i}">${invSvg(ic)}<span>${esc(n)}</span>${extra}</button>`;
  if (INV.tab === 'taschen') {
    const H = invHeld();
    if (H) h += `<div class="here"><span>Sie halten <b>${esc(H.name)}</b>.</span><button type="button" class="b gold" data-act="pocket" ${invFull() ? 'disabled' : ''}>Einstecken${isTouch ? '' : ' · Umschalt+E'}</button></div>`;
    s.items.forEach((it, i) => { const D = invDef(it); h += slot(i, D.ic, invName(it), it.u > 1 ? `<i>×${it.u}</i>` : ''); });
    for (let i = s.items.length; i < Math.min(INV_CAP, Math.max(8, s.items.length + 4)); i++) h += '<div class="slot leer"></div>';
    const it = s.items[INV.sel];
    if (it) {
      const D = invDef(it), near = invNearCitizen();
      d = `<h3>${esc(invName(it))}</h3><small>${it.k.startsWith('p:') ? 'Gefunden' : 'Gekauft'}${it.from ? ' · ' + esc(it.from === it.from.toUpperCase() ? titleCase(it.from) : it.from) : ''}${it.d ? ' · Tag ' + it.d : ''}</small><p>${esc(D.t || '')}</p>`;
      if (it.u > 1) d += `<p>Reicht noch für ${it.u}-mal.</p>`;
      d += `<p>Wert etwa ${fmM(D.v || 1)}.</p>`;
      if (INV.read != null) { const B = INV_BOOKS[INV.read]; d += `<blockquote><b style="font-style:normal;color:var(--gold-hi)">${esc(B[0])}</b><br>${esc(B[1])}</blockquote>`; }
      d += `<div class="btns">${D.use ? `<button type="button" class="b gold" data-act="use">${esc(D.use[0])}</button>` : ''}
        <button type="button" class="b" data-act="gift" ${near ? '' : 'disabled title="Niemand in der Nähe"'}>${near ? 'Schenken: ' + esc(near.name) : 'Schenken'}</button>
        ${D.prop ? '<button type="button" class="b" data-act="drop">Ablegen</button>' : ''}
        <button type="button" class="b" data-act="home">Nach Hause schicken</button></div>`;
      if (!near) d += '<p style="font-size:11px">Schenken: einem Bürger auf ein paar Schritte nahe kommen. Bis zu drei Geschenke am Tag heben das Ansehen.</p>';
    } else d = `<h3>Leere Taschen</h3><p>In den Läden kaufen (E an der Theke), oder etwas aufheben (E) oder mit der Telekinese halten (rechte Maus) und mit ${isTouch ? 'dem Knopf oben' : 'Umschalt+E'} einstecken: Champagner, Whisky, Bücher, Platten, Goldbarren aus dem Tresor …</p><p>Waren in großen Mengen (Kaffee, Kohle, Champagner in Kisten) liegen im Lagerhaus: Kontor (I) · Handel.</p>`;
    const lg = Object.keys(s.lager).filter(g => s.lager[g] > 0);
    d += `<p style="margin-top:14px;font-size:12px">Im Lagerhaus: ${lg.length ? lg.map(g => `${s.lager[g]} ${esc(GOODS[g] ? GOODS[g].n : g)}`).join(', ') : 'nichts'} <button type="button" class="b" data-act="kontor" style="margin-left:6px">Kontor</button></p>`;
  } else if (INV.tab === 'schluessel') {
    list.forEach((K, i) => { h += slot(i, 'schluessel', K.n.replace(/^Schlüssel:? ?(der |des |zum )?/, '').replace(/^(Generalschlüssel|Bordschlüssel) (des|der) /, '')); });
    const K = list[INV.sel];
    if (K) d = `<h3>${esc(K.n)}</h3><small>Schlüsselbund</small><p>${esc(K.t)}</p>${K.go ? `<div class="btns"><button type="button" class="b gold" data-act="go">${esc(K.d)}</button></div>` : ''}<p style="font-size:11px;margin-top:14px">Was Alexander kauft (Kontor · Besitz), kommt an diesen Bund.</p>`;
  } else if (INV.tab === 'sammlung') {
    INV_MEDS.forEach((M, i) => { const got = v.med[M.id]; h += slot(i, 'medaille', got ? M.n.replace('Medaille des ', '').replace('Medaille der ', '') : '?', '', got ? '' : ' zu'); });
    const M = INV_MEDS[INV.sel], got = M && v.med[M.id], n = Object.keys(v.med).length;
    d = `<h3>${M ? (got ? esc(M.n) : 'Noch nicht gefunden') : ''}</h3><small>Gründungsmedaillen · ${n} von ${INV_MEDS.length}</small>`;
    if (M) d += got ? `<p>Gefunden am Tag ${got}. Gold mit dem Sonnenfächer und dem V von Vespera.</p>` : `<p>Ein Hinweis aus dem Stadtanzeiger:</p><blockquote>${esc(M.h)}</blockquote>`;
    d += `<p>Zum Jubiläum der Stadt ließ der Bürgermeister zwölf goldene Medaillen an Orten verstecken, die Vespera ausmachen. Sie schweben golden im Nebel; im Vorbeigehen oder Vorbeifliegen nimmt Alexander sie mit.</p>`;
    d += v.kette ? `<p style="color:var(--gold-hi)">Die goldene Ehrenkette der Stadt Vespera: verliehen am Tag ${v.kette}.</p>` : '<p>Wer alle zwölf findet, bekommt die goldene Ehrenkette der Stadt.</p>';
  } else {
    const home = invAtHome();
    h += `<div class="here"><span>${home ? '<b>Sie sind zu Hause.</b> Randolf bringt, was Sie brauchen.' : 'Randolf verwahrt diese Dinge in der Villa. Mitnehmen: in der Villa oder in der Penthouse-Suite.'}</span></div>`;
    v.home.forEach((it, i) => { const D = invDef(it); h += slot(i, D.ic, invName(it), it.u > 1 ? `<i>×${it.u}</i>` : ''); });
    if (!v.home.length) h += '<div class="slot leer"></div>';
    const it = v.home[INV.sel];
    d = it ? `<h3>${esc(invName(it))}</h3><small>Zu Hause verwahrt</small><p>${esc(invDef(it).t || '')}</p><div class="btns"><button type="button" class="b gold" data-act="take" ${home && !invFull() ? '' : 'disabled'}>Mitnehmen</button></div>`
      : '<h3>Nichts verwahrt</h3><p>In den Taschen: „Nach Hause schicken“. Randolf lässt es abholen, wo immer Sie sind.</p>';
  }
  slots.innerHTML = h; info.innerHTML = d; slots.scrollTop = sc;
}
function invHud() {
  const c = document.querySelector('#ktHud .inv'); if (!c || !KT.s) return;
  const n = KT.s.items.length; if (n === INV.hudN) return; INV.hudN = n;
  c.innerHTML = `${isTouch ? 'TASCHEN' : '⇧I · TASCHEN'}<b>${n}</b>`;
}

/* ---------- Start und Schleife (über die Rückrufe des Kontors) ---------- */
function invInit() {
  invState(); invDom(); invBuildMeds(); INV.ready = true; invHud();
  try {
    window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'handel', titel: 'Kontor und Aufgaben', nach: 'stadt', tasten: [
      { id: 'inventar', k: ['Umschalt', 'I'], t: 'Inventar', d: 'Taschen, Schlüssel, Gründungsmedaillen, was Randolf zu Hause verwahrt', act: () => { setTimeout(() => invOpen(), 0); return true; } },
      { id: 'einstecken', k: ['Umschalt', 'E'], t: 'Einstecken', d: 'Was Alexander trägt oder mit der Telekinese hält (Flaschen, Gläser, Bücher, Goldbarren …), wandert in die Taschen' },
    ] } }));
  } catch (e) { /* alt */ }
  if (window.vespera) window.vespera.inventar = { INV, open: invOpen, close: invClose, pocket: invPocket, use: invUse, gift: invGift, drop: invDrop, sendHome: invSendHome, takeHome: invTakeHome, canPocket: invCanPocket, meds: INV_MEDS, def: invDef, collect: id => { const o = INV.med.find(x => x.M.id === id); if (o && o.g.visible) invCollect(o, invState()); } };
  LOOSE.canPocket = invCanPocket;
  document.addEventListener('pointerlockchange', () => { if (INV.open && document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* egal */ } });   // Maus bleibt frei, solange das Inventar offen ist
}
let invT = 0, invRT = 0;
KT.hooks.push((why, dt) => {
  if (why === 'init') { invInit(); return; }
  if (!INV.ready) return;
  if (why === 'reset') { invState(); invMedReset(); invHud(); if (INV.open) invRender(); return; }
  if (why === 'frame') {
    invT += dt || 0;
    if (playing && !paused) invMedStep(dt, invT);
    invHud();
    if (INV.open && (invRT -= dt) <= 0) { invRT = 0.6; const el = document.activeElement; if (!el || !el.closest || !el.closest('#inv button')) invRender(); }   // „Sie halten …“ und Nähe zu Bürgern frisch halten
    return;
  }
  if (INV.open) invRender();
});

// Tasten: Umschalt+I öffnet (Y gehört der Stadtkarte); Umschalt+E steckt ein. Fangphase, vor input.js und kontor.js.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (!INV.ready) return;
    if (INV.open) {
      const list = invList(), cols = Math.max(1, Math.round(($('inv').querySelector('.slots').clientWidth - 32) / 100));
      if (e.code === 'Escape' || (e.code === 'KeyI' && e.shiftKey)) invClose();
      else if (e.code === 'KeyI') { invClose(); ktOpen(); }
      else if (/^Digit[1-4]$/.test(e.code)) { INV.tab = INV_TABS[+e.code.slice(5) - 1][0]; INV.sel = 0; INV.read = null; invRender(); }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { INV.sel = Math.min(list.length - 1, INV.sel + 1); INV.read = null; invRender(); }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { INV.sel = Math.max(0, INV.sel - 1); INV.read = null; invRender(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { INV.sel = Math.min(list.length - 1, INV.sel + cols); INV.read = null; invRender(); }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { INV.sel = Math.max(0, INV.sel - cols); INV.read = null; invRender(); }
      else if (e.code === 'KeyE' && e.shiftKey) invAct('pocket');
      else if (e.code === 'KeyE' || e.code === 'Enter') invAct(INV.tab === 'zuhause' ? 'take' : INV.tab === 'schluessel' ? 'go' : 'use');
      e.stopImmediatePropagation(); if (e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
      return;
    }
    if (!playing || paused || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (KT.open) { if ((e.code === 'KeyI' && e.shiftKey)) { invOpen(); e.stopImmediatePropagation(); e.preventDefault(); } return; }
    if (DINE.menuOpen) return;
    if ((e.code === 'KeyI' && e.shiftKey)) { invOpen(); e.stopImmediatePropagation(); e.preventDefault(); return; }
    if (e.code === 'KeyE' && e.shiftKey && invHeld()) { invPocket(); e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
}
