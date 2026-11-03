/* =====================================================================
   V61 · DAS KONTOR: WIRTSCHAFT UND HANDEL
   Alexander ist der reichste Mann von Vespera. Das Kontorbuch (Taste I oder ein
   Klick auf das Vermögen oben rechts) führt sein Geld, seinen Besitz, sein Lager,
   seine Aktien, seine Stiftungen und seine Aufgaben (aufgaben.js).
   - GELD: Bargeld, jeden Geschäftstag (4 Minuten) die Abrechnung: Erträge der
     Häuser und Firmen, Unterhalt (Villa, Aurora Imperial), Dividenden.
   - BESITZ: The Belmont, die Villa, das Luftschiff und das Lagerhaus gehören ihm.
     Kaufen kann er jeden der begehbaren Läden (auch an der Ladentheke), die
     Fabriken, Lokale, das Varieté, Wassertaxis und mehr; ausbauen (Stufe 1 bis 5)
     und Löhne festlegen (knapp, gerecht, großzügig: das merken die Arbeiter).
     Fabriken liefern ihre Erzeugnisse ins Lager.
   - HANDEL: 16 Waren an 6 Handelsplätzen (Güterkai, Luftschiffhafen, Industriedepot,
     Kneipenplatz, Einkauf des Belmont, Vespera-Bank). Jeder Platz hat Vorräte; wer
     kauft, macht die Ware dort knapp und teuer, wer verkauft, macht sie billig. Über
     Nacht füllen sich die Vorräte wieder auf, Weltmarktpreise schwanken, Ereignisse
     (Eisgang im Hafen, Streik, Kältewelle, Ball im Belmont …) treiben Preise.
     Kaufen und verkaufen nur vor Ort (E am Handelsplatz), das Buch zeigt die Preise
     überall. Ansehen bei Elite, Bürgern und Arbeitern gibt bis zu 6 % Rabatt.
   - BÖRSE: acht Aktiengesellschaften, Kurse mit Zufall, Branche und Ereignissen,
     große Käufe bewegen den Kurs; Dividende täglich. Per Telefon von überall.
   - STIFTUNGEN: öffentliche Bauten und Spenden heben Ansehen und Wohlstand der
     Stadt; der Wohlstand hebt Erträge und Nachfrage.
   Alles wird im Browser gespeichert (localStorage 'vespera.kontor').
   Keine 3D-Teile, keine Shader: nur HTML über dem Bild.
   ===================================================================== */
import { $, shared } from './core.js';
import { player } from './player.js';
import { playing, paused, isTouch, tryLock } from './input.js';
import { toast } from './boat.js';
import { DINE, openChoice } from './venues.js';
import { INTERACT } from './music.js';
import { SHOPS, SHOP_KINDS, DEPOTS } from './shops.js';
import { ORTE } from './orte.js';
import { WORK } from './workers.js';
import { AP } from './harbour.js';
import { QUAY } from './island.js';
import { lifeSay } from './life.js';

export const KT_DAY = 240;   // Sekunden je Geschäftstag
const KT_SAVE = 'vespera.kontor';

/* ---------- Waren ---------- */
export const GOODS = {
  kaffee: { n: 'Kaffee', u: 'Sack', p: 42, vol: 0.06 },
  tee: { n: 'Tee', u: 'Kiste', p: 30, vol: 0.05 },
  tabak: { n: 'Tabak', u: 'Ballen', p: 55, vol: 0.05 },
  seide: { n: 'Seide', u: 'Ballen', p: 140, vol: 0.07 },
  pelze: { n: 'Pelze', u: 'Bündel', p: 320, vol: 0.06 },
  fisch: { n: 'Fisch', u: 'Fass', p: 14, vol: 0.08 },
  champagner: { n: 'Champagner', u: 'Kiste', p: 95, vol: 0.05 },
  kaviar: { n: 'Kaviar', u: 'Dose', p: 210, vol: 0.07 },
  parfum: { n: 'Parfum', u: 'Kiste', p: 75, vol: 0.05 },
  uhren: { n: 'Taschenuhren', u: 'Kiste', p: 420, vol: 0.04 },
  kohle: { n: 'Kohle', u: 'Sack', p: 8, vol: 0.07 },
  stahl: { n: 'Stahl', u: 'Träger', p: 26, vol: 0.05 },
  glas: { n: 'Kristallglas', u: 'Kiste', p: 64, vol: 0.05 },
  maschinen: { n: 'Maschinen', u: 'Stück', p: 520, vol: 0.04 },
  bier: { n: 'Bier', u: 'Fass', p: 9, vol: 0.04 },
  gold: { n: 'Gold', u: 'Barren', p: 1100, vol: 0.03 },
};
const ktTgt = g => Math.max(12, Math.min(300, Math.round(4000 / GOODS[g].p)));   // Grundvorrat je Platz

/* ---------- Handelsplätze (Lage wird beim Start bestimmt) ---------- */
export const POSTS = {
  kai: { n: 'Güterkai · Hafenamt', rep: 'buerger', note: 'Kaffee, Tee, Tabak, Seide, Pelze und Fisch kommen hier an.',
    f: { kaffee: 0.78, tee: 0.8, tabak: 0.82, seide: 0.85, pelze: 0.82, fisch: 0.7, kohle: 1.0, stahl: 1.12, maschinen: 1.15, bier: 1.0, glas: 1.15 } },
  luft: { n: 'Luftschiffhafen · Frachtbüro', rep: 'elite', note: 'Luxus aus Paris und New York; hier zahlt man gut für Seide, Pelze und Kristallglas.',
    f: { champagner: 0.82, kaviar: 0.85, parfum: 0.8, uhren: 0.9, seide: 1.2, pelze: 1.25, glas: 1.3, kaffee: 1.12, tee: 1.15, tabak: 1.1, maschinen: 1.05 } },
  depot: { n: 'Industriedepot', rep: 'arbeiter', note: 'Kohle, Stahl, Glas und Maschinen ab Werk.',
    f: { kohle: 0.75, stahl: 0.78, glas: 0.8, maschinen: 0.8, bier: 0.85, fisch: 1.2, kaffee: 1.18, tabak: 1.2 } },
  kneipe: { n: 'Kneipenplatz · Kohlenhandlung Krause', rep: 'arbeiter', note: 'Das Arbeiterviertel braucht Kohle, Bier, Fisch und Kaffee.',
    f: { bier: 1.25, kohle: 1.35, fisch: 1.3, kaffee: 1.2, tabak: 1.25, tee: 1.15 } },
  belmont: { n: 'The Belmont · Hoteleinkauf', rep: 'elite', note: 'Die Küche und die Bars des Belmont kaufen das Feinste.',
    f: { champagner: 1.3, kaviar: 1.35, parfum: 1.25, uhren: 1.2, pelze: 1.15, seide: 1.2, glas: 1.15, kaffee: 1.3, tee: 1.25, fisch: 1.4 } },
  bank: { n: 'Vespera-Bank · Kasse 2', rep: 'elite', note: 'Goldbarren für den Tresor, Taschenuhren als Pfand.',
    f: { gold: 1.0, uhren: 1.05 } },
};
const POST_POS = {};   // id -> { x, y, z, r }

/* ---------- Firmen, Häuser, Läden ---------- */
const SHOP_PRICE = { uhren: 60000, mode: 45000, schneider: 35000, deli: 30000, hut: 22000, buch: 18000, blumen: 15000, apotheke: 25000, platten: 16000, spiel: 14000, friseur: 12000, cafe: 28000, bar: 32000, tabak: 15000 };
const SHOP_SECTOR = { cafe: 'gastro', bar: 'gastro', uhren: 'luxus', mode: 'luxus', schneider: 'luxus', hut: 'luxus' };
export const WARE_PRICE = { hut: 5, buch: 4, deli: 3, tabak: 2, uhren: 180, blumen: 3, apotheke: 2, mode: 60, platten: 2.5, spiel: 4, schneider: 120, friseur: 1, cafe: 1.5, bar: 2 };
const FACTORY = {
  'STAHLWERK': [900000, 'stahl', 14], 'GIESSEREI': [600000, 'stahl', 8], 'TURBINENBAU': [750000, 'maschinen', 1], 'LUFTSCHIFFWERFT': [1200000, null, 0],
  'MASCHINENFABRIK': [680000, 'maschinen', 1], 'BRAUEREI': [300000, 'bier', 24], 'DRUCKEREI': [220000, null, 0], 'KABELWERK': [400000, null, 0],
  'GLASHÜTTE': [380000, 'glas', 6], 'RADIOWERK': [520000, null, 0], 'LOKOMOTIVBAU': [800000, 'maschinen', 1], 'MÜHLE': [180000, null, 0],
};
export const SECTORS = { luxus: 'Luxus', gastro: 'Gastronomie', handel: 'Handel', industrie: 'Industrie', verkehr: 'Verkehr', kultur: 'Kultur', hotel: 'Hotel', privat: 'Privat' };
export const BIZ = {};   // id -> { n, sec, price, inc, ort, prod, start, max, staff }
function ktBiz(id, o) { BIZ[id] = { max: 5, staff: 6, ...o }; }
const TC_SMALL = new Set(['de', 'du', 'la', 'le', 'und', 'zum', 'zur', 'der', 'des', 'am', 'im', 'an']);
const titleCase = s => s.toLowerCase().split(' ').map((w, i) => i && TC_SMALL.has(w) ? w : w.replace(/(^|[-’'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase())).join(' ');
function ktBuildBiz() {
  ktBiz('belmont', { n: 'The Belmont', sec: 'hotel', price: 25000000, inc: 42000, ort: 'Belmont-Platz', start: 3, staff: 220, upK: 0.05, note: 'Das höchste Haus der Stadt. Ihr Hotel, Ihr Ballsaal, Ihre Penthouse-Suite.' });
  ktBiz('villa', { n: 'Bergvilla', sec: 'privat', price: 8000000, inc: -3500, ort: 'Am Kraterrand', start: 1, max: 1, staff: 14, note: 'Randolf und das Personal. Kostet nur, bringt nichts als Ruhe.' });
  ktBiz('imperial', { n: 'Aurora Imperial', sec: 'privat', price: 12000000, inc: -6200, ort: 'Ankermast', start: 1, max: 1, staff: 26, note: 'Ihr Luftschiff mit Besatzung und Bordservice.' });
  ktBiz('lager', { n: 'Lagerhaus am Güterkai', sec: 'handel', price: 60000, inc: -300, ort: 'Güterkai', start: 1, staff: 4, note: 'Fasst 200 Einheiten je Ausbaustufe.' });
  SHOPS.forEach(S => {
    const id = 'laden:' + S.name; if (BIZ[id]) return;
    const kd = SHOP_KINDS.find(k => k.k === S.kind), price = SHOP_PRICE[S.kind] || 20000;
    ktBiz(id, { n: titleCase(S.name), sec: SHOP_SECTOR[S.kind] || 'handel', price, inc: Math.round(price * 0.016), ort: 'Ladenstraße', shop: S, staff: 2, note: kd ? 'Verkauft ' + kd.ware + '.' : '' });
  });
  const facs = [...new Set(DEPOTS.map(d => d.name))];
  for (const nm of (facs.length ? facs : Object.keys(FACTORY).slice(0, 6))) {
    const F = FACTORY[nm] || [400000, null, 0];
    ktBiz('fabrik:' + nm, { n: titleCase(nm), sec: 'industrie', price: F[0], inc: Math.round(F[0] * (F[1] ? 0.007 : 0.012)), ort: 'Industriegebiet', prod: F[1] ? { g: F[1], n: F[2] } : null, staff: Math.round(F[0] / 4000), note: F[1] ? `Liefert täglich ${F[2]} ${GOODS[F[1]].u === 'Stück' ? 'Stück' : GOODS[F[1]].u} ${GOODS[F[1]].n} ins Lager.` : '' });
  }
  ktBiz('brass', { n: 'The Brass Lantern', sec: 'gastro', price: 65000, inc: 1100, ort: 'Kneipenplatz', staff: 6, note: 'Die Arbeiterkneipe. Die Leute dort sehen genau hin, wer sie kauft.' });
  ktBiz('kranich', { n: 'Café Kranich', sec: 'gastro', price: 48000, inc: 800, ort: 'Hafenpromenade', staff: 7 });
  ktBiz('aurora', { n: 'Restaurant Aurora', sec: 'gastro', price: 180000, inc: 2900, ort: 'Belmont-Viertel', staff: 18 });
  ktBiz('metropol', { n: 'Varieté Metropol', sec: 'kultur', price: 450000, inc: 6800, ort: 'Avenue', staff: 40, note: 'Tänzerinnen, Kapelle, Conférencier: jeden Abend ausverkauft.' });
  ktBiz('eisbahn', { n: 'Eisbahn am Kanal', sec: 'kultur', price: 35000, inc: 600, ort: 'Eiskanal', staff: 3 });
  ktBiz('taxi', { n: 'Wassertaxi-Gesellschaft', sec: 'verkehr', price: 90000, inc: 1500, ort: 'Hafen', staff: 12 });
  ktBiz('faehre', { n: 'Fährlinie Vespera', sec: 'verkehr', price: 140000, inc: 2200, ort: 'Hafen', staff: 10 });
  ktBiz('rundflug', { n: 'Rundflug-Gesellschaft', sec: 'verkehr', price: 1400000, inc: 19000, ort: 'Luftschiffhafen', staff: 60, note: 'Das Passagierluftschiff am Landeturm.' });
  ktBiz('kohlen', { n: 'Kohlenhandlung Krause', sec: 'handel', price: 40000, inc: 650, ort: 'Kneipenplatz', staff: 4, note: 'Wer sie besitzt, verkauft Kohle am Kneipenplatz ohne Aufschlag.' });
}

/* ---------- Aktiengesellschaften ---------- */
export const COS = {
  luft: { n: 'Vespera Luftschiff AG', sec: 'verkehr', p: 120 },
  nord: { n: 'Nordlicht-Reederei', sec: 'handel', p: 64 },
  krist: { n: 'Kristall-Elektrizitätswerke', sec: 'industrie', p: 210 },
  stahl: { n: 'Polarstahl AG', sec: 'industrie', p: 88 },
  bank: { n: 'Vespera-Bank AG', sec: 'handel', p: 340 },
  tram: { n: 'Straßenbahn Vespera', sec: 'verkehr', p: 45 },
  glas: { n: 'Aurora-Kristallglas', sec: 'luxus', p: 72 },
  radio: { n: 'Radiowerk Polaris', sec: 'industrie', p: 150 },
};
const CO_SHARES = 100000;   // ausgegebene Aktien je Gesellschaft

/* ---------- Stiftungen und Bauprojekte ---------- */
export const PROJECTS = {
  oefen: { n: 'Kohlenöfen für das Arbeiterviertel', c: 120000, rep: { arbeiter: 10 }, wohl: 5, t: 'Jede Wohnung im Arbeiterviertel bekommt einen gusseisernen Ofen.' },
  waisen: { n: 'Waisenhaus Sankt Nikolaus', c: 60000, rep: { buerger: 8, arbeiter: 3 }, wohl: 2, t: 'Neue Betten, ein Speisesaal und ein Lehrer.' },
  eislicht: { n: 'Lichterketten über der Eisbahn', c: 40000, rep: { buerger: 5 }, wohl: 1, sec: { kultur: 0.03 }, t: 'Goldene Glühbirnen über dem Eiskanal.' },
  kran: { n: 'Neuer Hafenkran am Güterkai', c: 250000, rep: { buerger: 4, arbeiter: 4 }, wohl: 3, sec: { handel: 0.06 }, t: 'Mehr Fracht, schneller gelöscht: der Handel blüht.' },
  tram: { n: 'Straßenbahn-Linie Nord', c: 500000, rep: { buerger: 8, arbeiter: 6 }, wohl: 8, sec: { verkehr: 0.08 }, t: 'Vom Arbeiterviertel bis zur Avenue in zwölf Minuten.' },
  oper: { n: 'Opernhaus-Fonds', c: 800000, rep: { elite: 12 }, wohl: 2, sec: { kultur: 0.08, luxus: 0.03 }, t: 'Für ein Opernhaus aus Marmor und Gold.' },
  spital: { n: 'Hospital am Kraterrand', c: 350000, rep: { buerger: 8, arbeiter: 8 }, wohl: 6, t: 'Ärzte, Schwestern und ein Operationssaal.' },
  schule: { n: 'Gewerbeschule für Lehrlinge', c: 180000, rep: { arbeiter: 9 }, wohl: 4, sec: { industrie: 0.05 }, t: 'Junge Arbeiter lernen Turbinen, Funk und Luftschiffbau.' },
};

/* ---------- Ereignisse ---------- */
const EVENTS = [
  { t: 'Eisgang im Hafen: zwei Frachter sitzen im Packeis fest', g: { kaffee: 1.35, tee: 1.3, tabak: 1.3 }, d: 3 },
  { t: 'Großer Ball im Belmont: die Stadt will Champagner und Kaviar', g: { champagner: 1.3, kaviar: 1.3 }, s: { luxus: 1.15, hotel: 1.2 }, d: 2 },
  { t: 'Streik in der Gießerei: Stahl wird knapp', g: { stahl: 1.4 }, s: { industrie: 0.8 }, sh: { stahl: -0.08 }, d: 3, streik: true },
  { t: 'Kältewelle über dem Krater: Kohle ist gefragt wie nie', g: { kohle: 1.6 }, d: 3 },
  { t: 'Heringsschwärme unter dem Eis: Fisch im Überfluss', g: { fisch: 0.6 }, d: 2 },
  { t: 'Das neue Pariser Modeheft ist da: Seide und Pelze gefragt', g: { seide: 1.25, pelze: 1.25 }, s: { luxus: 1.1 }, d: 3 },
  { t: 'Goldfund am Kraterrand: der Goldpreis gibt nach', g: { gold: 0.82 }, d: 4 },
  { t: 'Luftschiff aus New York gelandet: Champagner, Parfum und Uhren im Überfluss', g: { champagner: 0.8, parfum: 0.8, uhren: 0.85 }, d: 2 },
  { t: 'Gerüchte an der Börse: Anleger werden nervös', sh: { bank: -0.1, nord: -0.06, luft: -0.05 }, d: 1 },
  { t: 'Radiowerk Polaris stellt den Volksempfänger vor', sh: { radio: 0.18 }, s: { industrie: 1.05 }, d: 1 },
  { t: 'Rekordabend im Varieté: ganz Vespera will ausgehen', s: { kultur: 1.25, gastro: 1.15 }, d: 2 },
  { t: 'Die Glashütte liefert Kristallleuchter nach Paris', g: { glas: 1.3 }, sh: { glas: 0.12 }, d: 3 },
  { t: 'Neue Turbinen im Kraftwerk: Strom wird billiger', sh: { krist: 0.1 }, s: { industrie: 1.1 }, d: 2 },
  { t: 'Nordlicht über dem Krater: Touristen buchen Rundflüge', s: { verkehr: 1.2, hotel: 1.1 }, sh: { luft: 0.08 }, d: 2 },
  { t: 'Bierschwemme: die Brauerei hat zu viel gebraut', g: { bier: 0.7 }, d: 2 },
  { t: 'Maschinenbedarf für die neue Luftschiffwerft', g: { maschinen: 1.3, stahl: 1.15 }, d: 3 },
];

/* ---------- Zustand ---------- */
export const KT = {
  s: null,          // gespeicherter Zustand (siehe ktFresh)
  open: false, tab: 'uebersicht', post: null, ready: false, dirty: false, saveT: 0, hudT: 0, near: null, lastCash: 0,
  tabs: {},         // weitere Reiter (aufgaben.js)
  hooks: [],        // Rückrufe bei Änderungen (aufgaben.js prüft Ziele)
};
function ktFresh() {
  const s = {
    v: 1, cash: 3200000, day: 1, t: 0,
    own: { belmont: { lvl: 3, lohn: 1 }, villa: { lvl: 1, lohn: 2 }, imperial: { lvl: 1, lohn: 2 }, lager: { lvl: 1, lohn: 1 } },
    lager: {}, items: [], shares: { bank: 12000 }, cost: { bank: 300 },
    rep: { elite: 80, buerger: 60, arbeiter: 38 }, wohl: 45, proj: {},
    mk: {}, gp: {}, cp: {}, hist: {}, sec: {}, ev: [], log: [], q: null,
    stat: { handel: 0, gewinn: 0, kaeufe: 0, gestiftet: 0 },
  };
  for (const pid in POSTS) { s.mk[pid] = {}; for (const g in POSTS[pid].f) s.mk[pid][g] = ktTgt(g); }
  for (const g in GOODS) s.gp[g] = 1;
  for (const c in COS) { s.cp[c] = COS[c].p; s.hist[c] = [COS[c].p]; }
  for (const k in SECTORS) s.sec[k] = 1;
  return s;
}
function ktLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KT_SAVE) || 'null'); } catch (e) { s = null; }
  const f = ktFresh();
  if (!s || s.v !== 1) return f;
  // fehlende Teile (neue Waren, Plätze, Firmen) aus dem frischen Stand ergänzen
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  for (const pid in f.mk) { s.mk[pid] ||= {}; for (const g in f.mk[pid]) if (!(s.mk[pid][g] > 0)) s.mk[pid][g] = f.mk[pid][g]; }
  for (const g in f.gp) if (!(s.gp[g] > 0)) s.gp[g] = 1;
  for (const c in f.cp) { if (!(s.cp[c] > 0)) s.cp[c] = f.cp[c]; s.hist[c] ||= [s.cp[c]]; }
  for (const k in f.sec) if (!(s.sec[k] > 0)) s.sec[k] = 1;
  for (const k in f.rep) if (typeof s.rep[k] !== 'number') s.rep[k] = f.rep[k];
  return s;
}
export function ktSave() { try { localStorage.setItem(KT_SAVE, JSON.stringify(KT.s)); } catch (e) { /* privat oder voll */ } KT.dirty = false; }
export function ktReset() { KT.s = ktFresh(); for (const f of KT.hooks) try { f('reset'); } catch (e) { console.warn(e); } ktSave(); ktRender(); ktHud(true); }
export function ktDirty() { KT.dirty = true; }
// Meldungen für andere Teile (Zeitung: 'vespera-news', sonst 'vespera-tat')
export function ktEmit(art, titel, text) {
  try {
    window.dispatchEvent(new CustomEvent('vespera-tat', { detail: { art, titel, text, tag: KT.s ? KT.s.day : 0 } }));
    window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik: art === 'aufgabe' || art === 'stiftung' ? 'Stadt' : 'Wirtschaft', prio: art === 'stiftung' ? 7 : art === 'kauf' ? 5 : 4, ruf: art === 'stiftung' ? 'Extrablatt! ' + titel + '!' : undefined } }));
  } catch (e) { /* alt */ }
}
function ktNewsBox() {
  try { window.dispatchEvent(new CustomEvent('vespera-news-box', { detail: { id: 'boerse', titel: 'Börse', zeilen: Object.keys(COS).map(c => { const h = KT.s.hist[c], p = KT.s.cp[c], ch = h.length > 1 ? (p / h[h.length - 2] - 1) * 100 : 0; return [COS[c].n, fmP(p) + ' (' + (ch >= 0 ? '+' : '') + ch.toFixed(1).replace('.', ',') + ' %)']; }) } })); } catch (e) { /* alt */ }
}
function ktChanged(why) { KT.dirty = true; for (const f of KT.hooks) try { f(why); } catch (e) { console.warn('Kontor:', e); } if (KT.open) ktRender(); ktHud(true); }

/* ---------- Hilfen ---------- */
export const fmM = n => (n < 0 ? '−' : '') + Math.round(Math.abs(n)).toLocaleString('de-DE') + ' Mark';
const fmN = n => Math.round(n).toLocaleString('de-DE');
const fmP = n => (n >= 100 ? Math.round(n).toLocaleString('de-DE') : n.toFixed(n < 10 ? 2 : 1).replace('.', ','));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function ktRep(group, d) { const r = KT.s.rep; r[group] = clamp((r[group] || 50) + d, 0, 100); }
export function ktCash(d, why) {
  KT.s.cash += d;
  if (why) { KT.s.log.unshift({ d: KT.s.day, t: why, a: Math.round(d) }); if (KT.s.log.length > 40) KT.s.log.length = 40; }
  ktChanged('cash');
}
export const ktOwns = id => !!KT.s.own[id];
export const lagerUsed = () => Object.values(KT.s.lager).reduce((a, n) => a + n, 0);
export const lagerCap = () => 200 * ((KT.s.own.lager && KT.s.own.lager.lvl) || 1);
function evMult(kind, key) { let m = 1; for (const e of KT.s.ev) { const E = EVENTS[e.i]; const t = E && E[kind]; if (t && t[key]) m *= t[key]; } return m; }
// Preis einer Ware an einem Platz (Mitte zwischen Kauf und Verkauf)
export function ktPrice(pid, g) {
  const P = POSTS[pid], f = P.f[g]; if (!f) return 0;
  const st = Math.max(1, KT.s.mk[pid][g]), tg = ktTgt(g);
  return GOODS[g].p * KT.s.gp[g] * f * Math.pow(tg / st, 0.5) * evMult('g', g);
}
function repDisc(pid) { const r = KT.s.rep[POSTS[pid].rep] ?? 50; return clamp((r - 50) / 50 * 0.06, -0.03, 0.06); }
export const ktBuyP = (pid, g) => ktPrice(pid, g) * 1.05 * (1 - repDisc(pid)) * (pid === 'kneipe' && g === 'kohle' && ktOwns('kohlen') ? 0.88 : 1);
export const ktSellP = (pid, g) => ktPrice(pid, g) * 0.95 * (1 + repDisc(pid));
// Wert des Besitzes (für das Vermögen und den Wiederverkauf)
const bizValue = id => { const B = BIZ[id], o = KT.s.own[id]; if (!B || !o) return 0; let v = B.price; for (let l = (B.start || 1); l < o.lvl; l++) v += upCost(id, l); return v; };
const upCost = (id, lvl) => Math.round(BIZ[id].price * (BIZ[id].upK || 0.3) * lvl / 1000) * 1000;
const LOHN = [{ n: 'knapp', m: 1.15, rep: -1.2 }, { n: 'gerecht', m: 1.0, rep: 0 }, { n: 'großzügig', m: 0.85, rep: 1.0 }];
export function bizIncome(id) {
  const B = BIZ[id], o = KT.s.own[id]; if (!B || !o) return 0;
  if (B.inc < 0) return B.inc;
  const lv = 1 + 0.3 * (o.lvl - 1), sec = (KT.s.sec[B.sec] || 1) * evMult('s', B.sec), wohl = 0.8 + 0.4 * KT.s.wohl / 100;
  return B.inc * lv * sec * wohl * LOHN[o.lohn ?? 1].m;
}
export function netWorth() {
  const s = KT.s; let v = s.cash;
  for (const id in s.own) v += bizValue(id);
  for (const c in s.shares) v += s.shares[c] * s.cp[c];
  for (const g in s.lager) v += s.lager[g] * GOODS[g].p * s.gp[g];
  return v;
}

/* ---------- Handel ---------- */
export function ktTrade(pid, g, n) {   // n > 0 kaufen, n < 0 verkaufen
  const s = KT.s, mk = s.mk[pid]; if (!POSTS[pid].f[g]) return false;
  if (n > 0) {
    const room = lagerCap() - lagerUsed(); if (room <= 0) { toast('Das Lager ist voll (Kontor · Besitz: Lagerhaus ausbauen)'); return false; }
    n = Math.min(n, room, Math.max(0, Math.floor(mk[g] - 1)));
    if (n <= 0) { toast('Hier ist nichts mehr davon zu haben'); return false; }
    let cost = 0; for (let k = 0; k < n; k++) { cost += ktBuyP(pid, g); mk[g] -= 1; }
    s.lager[g] = (s.lager[g] || 0) + n; s.cash -= cost; s.stat.handel += cost;
    s.log.unshift({ d: s.day, t: `${n} ${GOODS[g].u === 'Stück' ? 'Stück' : GOODS[g].u} ${GOODS[g].n} gekauft (${POSTS[pid].n.split(' · ')[0]})`, a: -Math.round(cost) });
  } else {
    n = Math.min(-n, s.lager[g] || 0); if (n <= 0) { toast('Davon ist nichts im Lager'); return false; }
    let gain = 0; for (let k = 0; k < n; k++) { gain += ktSellP(pid, g); mk[g] += 1; }
    s.lager[g] -= n; if (!s.lager[g]) delete s.lager[g]; s.cash += gain; s.stat.handel += gain;
    s.log.unshift({ d: s.day, t: `${n} ${GOODS[g].u === 'Stück' ? 'Stück' : GOODS[g].u} ${GOODS[g].n} verkauft (${POSTS[pid].n.split(' · ')[0]})`, a: Math.round(gain) });
  }
  if (s.log.length > 40) s.log.length = 40;
  ktChanged('trade');
  return true;
}
// Ware aus dem Lager abgeben (Aufgaben: Lieferungen), ohne Erlös
export function ktTake(g, n) { const s = KT.s; if ((s.lager[g] || 0) < n) return false; s.lager[g] -= n; if (!s.lager[g]) delete s.lager[g]; ktChanged('take'); return true; }

/* ---------- Besitz ---------- */
export function ktBuyBiz(id) {
  const B = BIZ[id]; if (!B || KT.s.own[id]) return false;
  if (KT.s.cash < B.price) { toast('Dafür reicht das Bargeld nicht (Aktien oder Waren verkaufen)'); return false; }
  KT.s.own[id] = { lvl: B.start || 1, lohn: 1 }; KT.s.stat.kaeufe++;
  ktCash(-B.price, B.n + ' gekauft');
  toast(`${B.n} gehört jetzt Ihnen`);
  if (id === 'brass') ktRep('arbeiter', -3);   // die Arbeiter trauen dem neuen Besitzer erst einmal nicht
  ktEmit('kauf', B.n + ' gehört jetzt Alexander', `Alexander hat ${B.n} für ${fmM(B.price)} gekauft.`);
  return true;
}
export function ktSellBiz(id) {
  const B = BIZ[id]; if (!B || !KT.s.own[id] || B.sec === 'privat' || id === 'belmont' || id === 'lager') return false;
  const v = Math.round(bizValue(id) * 0.85);
  delete KT.s.own[id]; ktCash(v, B.n + ' verkauft'); toast(`${B.n} verkauft: ${fmM(v)}`);
  return true;
}
export function ktUpgrade(id) {
  const B = BIZ[id], o = KT.s.own[id]; if (!B || !o || o.lvl >= B.max) return false;
  const c = upCost(id, o.lvl); if (KT.s.cash < c) { toast('Dafür reicht das Bargeld nicht'); return false; }
  o.lvl++; ktCash(-c, `${B.n} ausgebaut (Stufe ${o.lvl})`); toast(`${B.n}: Stufe ${o.lvl}`);
  return true;
}
export function ktLohn(id) { const o = KT.s.own[id]; if (!o) return; o.lohn = ((o.lohn ?? 1) + 1) % 3; toast(`${BIZ[id].n}: Löhne ${LOHN[o.lohn].n}`); ktChanged('lohn'); }

/* ---------- Börse ---------- */
export function ktShares(c, n) {
  const s = KT.s, C = COS[c]; if (!C) return false;
  if (n > 0) {
    const p = s.cp[c] * (1 + n / CO_SHARES * 2.5), cost = p * n * 1.01;
    if (s.cash < cost) { toast('Dafür reicht das Bargeld nicht'); return false; }
    const have = s.shares[c] || 0; if (have + n > CO_SHARES * 0.9) { toast('Mehr Aktien sind nicht zu haben'); return false; }
    s.cost[c] = ((s.cost[c] || 0) * have + p * n) / (have + n);
    s.shares[c] = have + n; s.cp[c] = s.cp[c] * (1 + n / CO_SHARES * 5);
    ktCash(-cost, `${fmN(n)} Aktien ${C.n} gekauft`);
  } else {
    n = Math.min(-n, s.shares[c] || 0); if (n <= 0) return false;
    const p = s.cp[c] * (1 - n / CO_SHARES * 2.5), gain = p * n * 0.99;
    s.shares[c] -= n; if (!s.shares[c]) { delete s.shares[c]; delete s.cost[c]; }
    s.cp[c] = s.cp[c] * (1 - n / CO_SHARES * 5);
    ktCash(gain, `${fmN(n)} Aktien ${C.n} verkauft`);
  }
  return true;
}

/* ---------- Stiftungen ---------- */
export function ktFund(id) {
  const P = PROJECTS[id], s = KT.s; if (!P || s.proj[id]) return false;
  if (s.cash < P.c) { toast('Dafür reicht das Bargeld nicht'); return false; }
  s.proj[id] = s.day; s.stat.gestiftet += P.c;
  for (const g in P.rep) ktRep(g, P.rep[g]);
  s.wohl = clamp(s.wohl + (P.wohl || 0), 0, 100);
  if (P.sec) for (const k in P.sec) s.sec[k] = (s.sec[k] || 1) + P.sec[k];
  ktCash(-P.c, 'Gestiftet: ' + P.n);
  toast('Gestiftet: ' + P.n);
  lifeSay('Vespera', 'Alexander stiftet: ' + P.n + '. ' + P.t, 5);
  ktEmit('stiftung', 'Alexander stiftet: ' + P.n, P.t);
  return true;
}

/* ---------- Geschäftstag ---------- */
function ktNewDay() {
  const s = KT.s; s.day++;
  let sum = 0; const parts = [];
  // Erträge und Unterhalt, Löhne wirken aufs Ansehen der Arbeiter
  let lohnRep = 0, staff = 0;
  for (const id in s.own) {
    const B = BIZ[id]; if (!B) continue;
    const v = bizIncome(id); sum += v; if (Math.abs(v) > 2000) parts.push(`${B.n} ${v > 0 ? '+' : ''}${fmN(v)}`);
    if (B.inc > 0) { lohnRep += LOHN[s.own[id].lohn ?? 1].rep * B.staff; staff += B.staff; }
    if (B.prod) {   // Fabriken liefern ins Lager, was nicht passt, geht ab Werk weg
      const room = lagerCap() - lagerUsed(), n = Math.round(B.prod.n * (1 + 0.3 * (s.own[id].lvl - 1)));
      const put = Math.min(room, n); if (put > 0) s.lager[B.prod.g] = (s.lager[B.prod.g] || 0) + put;
      if (n > put) sum += (n - put) * GOODS[B.prod.g].p * s.gp[B.prod.g] * 0.85;
    }
  }
  if (staff) { ktRep('arbeiter', clamp(lohnRep / staff * 2, -2, 2)); s.wohl = clamp(s.wohl + lohnRep / Math.max(400, staff) * 0.5, 0, 100); }
  // Dividenden (0,4 % des Kurses am Tag)
  let div = 0; for (const c in s.shares) div += s.shares[c] * s.cp[c] * 0.004;
  if (div) parts.push(`Dividenden +${fmN(div)}`);
  sum += div;
  s.cash += sum; s.stat.gewinn += sum;
  s.log.unshift({ d: s.day - 1, t: 'Tagesabrechnung', a: Math.round(sum) }); if (s.log.length > 40) s.log.length = 40;
  // Märkte: Vorräte füllen sich auf, Weltmarkt schwankt (kehrt zur Mitte zurück)
  for (const pid in s.mk) for (const g in s.mk[pid]) { const tg = ktTgt(g); s.mk[pid][g] += (tg - s.mk[pid][g]) * 0.3 + gauss() * tg * 0.03; s.mk[pid][g] = clamp(s.mk[pid][g], 2, tg * 3); }
  const wohlD = (s.wohl - 50) / 50 * 0.01;
  for (const g in s.gp) s.gp[g] = clamp(Math.pow(s.gp[g], 0.85) * Math.exp(gauss() * GOODS[g].vol + wohlD), 0.55, 1.8);
  for (const k in s.sec) s.sec[k] = clamp(1 + (s.sec[k] - 1) * 0.92 + gauss() * 0.03, 0.75, 1.4);
  // Kurse: Zufall, leichtes Wachstum, Branche, Ereignisse
  for (const c in s.cp) {
    const C = COS[c], drift = 0.002 + ((s.sec[C.sec] || 1) - 1) * 0.04 + wohlD;
    s.cp[c] = clamp(s.cp[c] * Math.exp(gauss() * 0.035 + drift), C.p * 0.2, C.p * 8);
    const h = s.hist[c]; h.push(+s.cp[c].toFixed(2)); if (h.length > 24) h.shift();
  }
  // Ereignisse laufen ab, neue kommen (etwa jeden zweiten Tag)
  for (const e of s.ev) e.d--;
  s.ev = s.ev.filter(e => e.d > 0);
  if (Math.random() < 0.5 && s.ev.length < 3) {
    let i = Math.floor(Math.random() * EVENTS.length); for (let k = 0; k < 5 && s.ev.some(e => e.i === i); k++) i = Math.floor(Math.random() * EVENTS.length);
    if (!s.ev.some(e => e.i === i)) {
      const E = EVENTS[i]; s.ev.push({ i, d: E.d });
      if (E.sh) for (const c in E.sh) s.cp[c] *= 1 + E.sh[c];
      if (E.streik && s.rep.arbeiter > 70) { s.ev[s.ev.length - 1].d = 1; }   // Arbeiter, die Alexander schätzen, streiken nicht lange
      setTimeout(() => toast('Börsentelegramm: ' + E.t), 3200);
      ktEmit('ereignis', E.t, E.t);
    }
  }
  ktNewsBox();
  toast(`Tagesabrechnung, Tag ${s.day - 1}: ${sum >= 0 ? '+' : ''}${fmM(sum)}`);
  ktChanged('day');
}

/* ---------- Kontorbuch (HTML) ---------- */
const TABS = [['uebersicht', 'Übersicht'], ['besitz', 'Besitz'], ['handel', 'Handel'], ['boerse', 'Börse'], ['stiftungen', 'Stiftungen'], ['aufgaben', 'Aufgaben']];
function ktCss() {
  const st = document.createElement('style');
  st.textContent = `
#ktHud{position:fixed;z-index:9;right:calc(16px + env(safe-area-inset-right,0px));top:calc(150px + env(safe-area-inset-top,0px));display:grid;gap:5px;justify-items:end;pointer-events:none;opacity:0;transition:opacity .4s;max-width:min(320px,60vw)}
#ktHud .cash{pointer-events:auto;cursor:pointer;font:600 14px/1 var(--body);letter-spacing:.12em;color:var(--gold-hi,#f6dc9a);background:var(--panel,rgba(5,16,24,.72));border:1px solid rgba(217,178,106,.55);padding:7px 12px 5px;font-variant-numeric:tabular-nums;white-space:nowrap}
#ktHud .cash small{font-size:10px;letter-spacing:.3em;color:var(--muted,#b9ab8f);margin-left:8px}
#ktHud .cash i{font-style:normal;margin-left:8px;transition:opacity .6s}
#ktHud .q{font-size:12px;letter-spacing:.08em;color:var(--ink,#efe6d2);background:var(--panel,rgba(5,16,24,.72));border:1px solid rgba(64,200,190,.45);padding:6px 10px 4px;text-align:right;line-height:1.35}
#ktHud .q b{color:var(--gold-hi,#f6dc9a);font-weight:600}
#ktHud .q em{display:inline-block;font-style:normal;color:#7fe3d6;margin-left:6px;transition:transform .2s}
.ktMk{position:fixed;z-index:8;pointer-events:none;transform:translate(-50%,-100%);font:600 12px/1 var(--body);letter-spacing:.1em;color:#f6dc9a;text-align:center;text-shadow:0 0 6px #000,0 0 2px #000;white-space:nowrap}
.ktMk span{display:block;margin:0 auto 3px;width:14px;height:14px;border:2px solid #f6dc9a;transform:rotate(45deg);background:rgba(64,200,190,.35)}
.ktMk.giver span{border-radius:50%;transform:none;background:rgba(246,220,154,.35);width:16px;height:16px;line-height:16px;font-size:12px}
#kt{position:fixed;z-index:17;left:50%;top:50%;transform:translate(-50%,-50%);width:min(900px,calc(100% - 24px));height:min(640px,calc(100% - 24px));display:grid;grid-template-rows:auto auto 1fr auto;
 background:linear-gradient(180deg,rgba(6,26,30,.97),rgba(4,16,22,.97));border:1px solid rgba(217,178,106,.8);box-shadow:0 0 0 5px rgba(4,14,20,.7),0 0 0 6px rgba(217,178,106,.35),0 20px 60px rgba(0,0,0,.6);color:var(--ink,#efe6d2);font-family:var(--body);user-select:text}
#kt header{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:14px 20px 6px;border-bottom:1px solid rgba(217,178,106,.3)}
#kt h2{font:400 26px/1 var(--display);letter-spacing:.16em;color:var(--gold-hi,#f6dc9a);margin:0}
#kt header .w{font-size:13px;letter-spacing:.1em;color:var(--muted,#b9ab8f);text-align:right;font-variant-numeric:tabular-nums}
#kt header .w b{color:var(--gold-hi,#f6dc9a);font-size:16px;font-weight:600}
#kt nav{display:flex;flex-wrap:wrap;gap:4px;padding:8px 16px 0}
#kt nav button{font:600 12px/1 var(--body);letter-spacing:.2em;text-transform:uppercase;color:var(--muted,#b9ab8f);background:none;border:1px solid transparent;border-bottom:none;padding:8px 10px 6px;cursor:pointer}
#kt nav button.on{color:var(--gold-hi,#f6dc9a);border-color:rgba(217,178,106,.5);background:rgba(217,178,106,.08)}
#kt nav kbd{font-size:10px;padding:1px 4px 0;margin-right:6px;opacity:.7}
#kt main{overflow:auto;padding:12px 20px;border-top:1px solid rgba(217,178,106,.5);scrollbar-color:rgba(217,178,106,.5) transparent}
#kt footer{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 20px 10px;border-top:1px solid rgba(217,178,106,.3);font-size:12px;color:var(--muted,#b9ab8f);letter-spacing:.06em}
#kt footer button,#kt main button{font:600 12px/1 var(--body);letter-spacing:.08em;color:var(--ink,#efe6d2);background:rgba(217,178,106,.1);border:1px solid rgba(217,178,106,.45);padding:6px 8px 4px;cursor:pointer;white-space:nowrap}
#kt main button:hover,#kt footer button:hover{background:rgba(217,178,106,.25)}
#kt main button:disabled{opacity:.35;cursor:default;background:none}
#kt main button.gold{color:#1a1206;background:linear-gradient(#f6dc9a,#c9a258);border-color:#f6dc9a}
#kt h3{font:400 17px/1.2 var(--display);letter-spacing:.14em;color:var(--gold-hi,#f6dc9a);margin:14px 0 6px}
#kt h3:first-child{margin-top:0}
#kt p{margin:4px 0;font-size:13px;line-height:1.5;color:var(--muted,#b9ab8f)}
#kt table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
#kt th{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold,#d9b26a);font-weight:600;text-align:left;padding:4px 6px;border-bottom:1px solid rgba(217,178,106,.35)}
#kt td{padding:5px 6px;border-bottom:1px solid rgba(217,178,106,.12);vertical-align:middle}
#kt td.r,#kt th.r{text-align:right}
#kt td .s{display:block;font-size:11px;color:var(--muted,#b9ab8f)}
#kt .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
#kt .tile{border:1px solid rgba(217,178,106,.3);padding:10px 12px;background:rgba(217,178,106,.04)}
#kt .tile b{display:block;font:400 20px/1.2 var(--display);color:var(--gold-hi,#f6dc9a);letter-spacing:.06em;font-variant-numeric:tabular-nums}
#kt .tile small{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold,#d9b26a)}
#kt .bar{height:6px;background:rgba(255,255,255,.08);margin-top:6px}#kt .bar i{display:block;height:100%;background:linear-gradient(90deg,#2f8f88,#7fe3d6)}
#kt .up{color:#7fe3d6}#kt .dn{color:#f0a070}
#kt .here{border:1px solid rgba(64,200,190,.6);background:rgba(64,200,190,.08);padding:8px 12px;margin-bottom:10px}
#kt .q{border:1px solid rgba(217,178,106,.3);padding:10px 12px;margin-bottom:8px}
#kt .q.aktiv{border-color:rgba(64,200,190,.6)}
#kt .q b{font:400 16px/1.2 var(--display);letter-spacing:.08em;color:var(--gold-hi,#f6dc9a)}
#kt .q .who{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold,#d9b26a);margin-left:8px}
#kt .q .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
#kt svg{vertical-align:middle}
@media (max-width:600px){#kt h2{font-size:20px}#kt main{padding:10px 12px}#kt td,#kt th{padding:4px 3px}#kt .hide-s{display:none}}
`;
  document.head.append(st);
}
function ktDom() {
  ktCss();
  const hud = document.createElement('div'); hud.id = 'ktHud'; hud.className = 'hud';
  hud.innerHTML = '<div class="cash" title="Kontor (Taste I)"></div><div class="q" hidden></div>';
  hud.querySelector('.cash').addEventListener('click', () => { if (playing && !KT.open && !DINE.menuOpen) ktOpen(); });
  document.body.append(hud);
  const el = document.createElement('div'); el.id = 'kt'; el.hidden = true;
  el.innerHTML = `<header><h2>Das Kontor</h2><div class="w"></div></header><nav>${TABS.map(([k, n], i) => `<button type="button" data-tab="${k}"><kbd>${i + 1}</kbd>${n}</button>`).join('')}</nav><main></main><footer><span>I oder Esc schließt · Zahlen wechseln die Seite</span><button type="button" data-act="close">Schließen</button></footer>`;
  el.addEventListener('click', ktClick);
  document.body.append(el);
}
export function ktOpen(tab) {
  if (!KT.ready) return;
  KT.post = ktPostHere();
  if (tab) KT.tab = tab; else if (KT.post) KT.tab = 'handel';
  KT.open = true; DINE.menuOpen = true; DINE.onPick = null;
  $('kt').hidden = false; ktRender();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* egal */ }
}
export function ktClose() {
  if (!KT.open) return;
  KT.open = false; DINE.menuOpen = false; $('kt').hidden = true;
  if (!isTouch && playing && !paused) tryLock();
}
function ktClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) { KT.tab = b.dataset.tab; ktRender(); return; }
  const a = b.dataset.act, id = b.dataset.id, n = +b.dataset.n || 0;
  if (a === 'close') ktClose();
  else if (a === 'trade') ktTrade(KT.post, id, n);
  else if (a === 'buybiz') ktBuyBiz(id);
  else if (a === 'sellbiz') { if (b.dataset.sure) ktSellBiz(id); else { b.dataset.sure = 1; b.textContent = 'Wirklich?'; } }
  else if (a === 'up') ktUpgrade(id);
  else if (a === 'lohn') ktLohn(id);
  else if (a === 'shares') ktShares(id, n);
  else if (a === 'fund') ktFund(id);
  else if (a === 'reset') { if (b.dataset.sure) ktReset(); else { b.dataset.sure = 1; b.textContent = 'Wirklich alles zurücksetzen?'; } }
  else if (KT.tabs[KT.tab] && KT.tabs[KT.tab].click) KT.tabs[KT.tab].click(a, id, b);
}
function spark(h, w = 90, hh = 22) {
  if (!h || h.length < 2) return '';
  const lo = Math.min(...h), hi = Math.max(...h), d = hi - lo || 1;
  const pts = h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${(hh - 2 - (v - lo) / d * (hh - 4)).toFixed(1)}`).join(' ');
  const up = h[h.length - 1] >= h[0];
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? '#7fe3d6' : '#f0a070'}" stroke-width="1.5"/></svg>`;
}
const repBar = (n, v) => `<div class="tile"><small>${n}</small><b>${Math.round(v)}</b><div class="bar"><i style="width:${v}%"></i></div></div>`;
function ktRender() {
  const el = $('kt'); if (!el || el.hidden) return;
  const s = KT.s;
  el.querySelector('header .w').innerHTML = `Bargeld <b>${fmM(s.cash)}</b><br>Vermögen ${fmM(netWorth())} · Tag ${s.day}`;
  el.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === KT.tab));
  const m = el.querySelector('main'), sc = m.scrollTop;
  m.innerHTML = (KT.tabs[KT.tab] ? KT.tabs[KT.tab].render() : RENDER[KT.tab]());
  m.scrollTop = sc;
}
const RENDER = {
  uebersicht() {
    const s = KT.s; let inc = 0; for (const id in s.own) inc += bizIncome(id);
    let div = 0; for (const c in s.shares) div += s.shares[c] * s.cp[c] * 0.004;
    const nOwn = Object.keys(s.own).length, ev = s.ev.map(e => `<li>${esc(EVENTS[e.i].t)} <span class="s">(noch ${e.d} ${e.d === 1 ? 'Tag' : 'Tage'})</span></li>`).join('');
    const next = Math.max(0, Math.ceil(KT_DAY - s.t));
    return `<div class="grid">
      <div class="tile"><small>Bargeld</small><b>${fmM(s.cash)}</b></div>
      <div class="tile"><small>Vermögen</small><b>${fmM(netWorth())}</b></div>
      <div class="tile"><small>Ertrag am Tag</small><b class="${inc + div >= 0 ? 'up' : 'dn'}">${inc + div >= 0 ? '+' : ''}${fmM(inc + div)}</b><p>nächste Abrechnung in ${Math.floor(next / 60)}:${String(next % 60).padStart(2, '0')} min</p></div>
      <div class="tile"><small>Besitz</small><b>${nOwn} Häuser und Firmen</b><p>Lager ${fmN(lagerUsed())} / ${fmN(lagerCap())}</p></div>
    </div>
    <h3>Ansehen in Vespera</h3>
    <div class="grid">${repBar('Elite', s.rep.elite)}${repBar('Bürger', s.rep.buerger)}${repBar('Arbeiter', s.rep.arbeiter)}${repBar('Wohlstand der Stadt', s.wohl)}</div>
    <p>Ansehen gibt bis zu 6 % bessere Preise an den Handelsplätzen der jeweiligen Leute. Wohlstand hebt die Erträge aller Firmen. Großzügige Löhne, Stiftungen und erledigte Aufgaben heben beides.</p>
    <h3>Börsentelegramme</h3>${ev ? `<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6">${ev}</ul>` : '<p>Ruhige Tage an den Märkten.</p>'}
    <h3>Kassenbuch</h3><table><tr><th>Tag</th><th>Vorgang</th><th class="r">Betrag</th></tr>${s.log.slice(0, 14).map(l => `<tr><td>${l.d}</td><td>${esc(l.t)}</td><td class="r ${l.a >= 0 ? 'up' : 'dn'}">${l.a >= 0 ? '+' : ''}${fmM(l.a)}</td></tr>`).join('') || '<tr><td colspan="3">Noch keine Einträge.</td></tr>'}</table>
    <p style="margin-top:14px"><button type="button" data-act="reset">Kontor zurücksetzen</button></p>`;
  },
  besitz() {
    const s = KT.s, ids = Object.keys(BIZ);
    const row = id => {
      const B = BIZ[id], o = s.own[id];
      if (o) {
        const inc = bizIncome(id), up = o.lvl < B.max ? `<button type="button" data-act="up" data-id="${esc(id)}">Ausbauen · ${fmM(upCost(id, o.lvl))}</button>` : '';
        const lohn = B.inc > 0 ? `<button type="button" data-act="lohn" data-id="${esc(id)}" title="knapp: mehr Gewinn, Arbeiter verärgert · großzügig: weniger Gewinn, mehr Ansehen und Wohlstand">Löhne: ${LOHN[o.lohn ?? 1].n}</button>` : '';
        const sell = B.sec !== 'privat' && id !== 'belmont' && id !== 'lager' ? `<button type="button" data-act="sellbiz" data-id="${esc(id)}">Verkaufen</button>` : '';
        return `<tr><td><b style="color:var(--gold-hi)">${esc(B.n)}</b><span class="s">${esc(SECTORS[B.sec])} · ${esc(B.ort)}${B.max > 1 ? ' · Stufe ' + o.lvl + '/' + B.max : ''}${B.note ? ' · ' + esc(B.note) : ''}</span></td><td class="r ${inc >= 0 ? 'up' : 'dn'}">${inc >= 0 ? '+' : ''}${fmN(inc)}<span class="s">am Tag</span></td><td class="r" style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">${up}${lohn}${sell}</td></tr>`;
      }
      return `<tr><td>${esc(B.n)}<span class="s">${esc(SECTORS[B.sec])} · ${esc(B.ort)}${B.note ? ' · ' + esc(B.note) : ''}</span></td><td class="r">~${fmN(B.inc * (KT.s.sec[B.sec] || 1))}<span class="s">am Tag</span></td><td class="r"><button type="button" data-act="buybiz" data-id="${esc(id)}" ${s.cash < B.price ? 'disabled' : ''}>Kaufen · ${fmM(B.price)}</button></td></tr>`;
    };
    const mine = ids.filter(id => s.own[id]), rest = ids.filter(id => !s.own[id]).sort((a, b) => BIZ[a].price - BIZ[b].price);
    return `<h3>Ihr Besitz</h3><table><tr><th>Haus · Firma</th><th class="r">Ertrag</th><th></th></tr>${mine.map(row).join('')}</table>
      <h3>Zu kaufen</h3><p>Ihr Notar erledigt jeden Kauf sofort. Läden lassen sich auch an der Ladentheke übernehmen.</p>
      <table><tr><th>Haus · Firma</th><th class="r">Ertrag</th><th></th></tr>${rest.map(row).join('')}</table>`;
  },
  handel() {
    const s = KT.s, here = KT.post, gs = Object.keys(GOODS);
    let h = '';
    if (here) {
      const P = POSTS[here];
      h += `<div class="here"><b style="color:var(--gold-hi)">Sie sind am ${esc(P.n)}.</b> ${esc(P.note)} Lager ${fmN(lagerUsed())} / ${fmN(lagerCap())}.</div>
      <table><tr><th>Ware</th><th class="r">Kauf</th><th class="r">Verkauf</th><th class="r">Vorrat</th><th class="r">Im Lager</th><th></th></tr>${Object.keys(P.f).map(g => {
        const G = GOODS[g], bp = ktBuyP(here, g), sp = ktSellP(here, g), have = s.lager[g] || 0, st = s.mk[here][g], tg = ktTgt(g);
        const best = Object.keys(POSTS).filter(q => POSTS[q].f[g]).reduce((a, q) => ktSellP(q, g) > ktSellP(a, g) ? q : a, here);
        return `<tr><td>${esc(G.n)}<span class="s">je ${esc(G.u)}${best !== here ? ' · am besten verkauft: ' + esc(POSTS[best].n.split(' · ')[0]) + ' ' + fmP(ktSellP(best, g)) : ''}</span></td><td class="r">${fmP(bp)}</td><td class="r">${fmP(sp)}</td><td class="r ${st < tg * 0.6 ? 'dn' : st > tg * 1.4 ? 'up' : ''}">${fmN(st)}</td><td class="r">${fmN(have)}</td>
        <td class="r" style="white-space:nowrap"><button type="button" data-act="trade" data-id="${g}" data-n="1">+1</button> <button type="button" data-act="trade" data-id="${g}" data-n="10">+10</button> <button type="button" data-act="trade" data-id="${g}" data-n="-1" ${have ? '' : 'disabled'}>−1</button> <button type="button" data-act="trade" data-id="${g}" data-n="-10" ${have ? '' : 'disabled'}>−10</button> <button type="button" data-act="trade" data-id="${g}" data-n="-99999" ${have ? '' : 'disabled'}>alles</button></td></tr>`;
      }).join('')}</table>`;
    } else h += `<div class="here">Kaufen und verkaufen können Sie nur vor Ort: <b style="color:var(--gold-hi)">Güterkai</b> (Hafenamt), <b style="color:var(--gold-hi)">Luftschiffhafen</b> (vor der Halle), <b style="color:var(--gold-hi)">Industriedepot</b> (Fabriken im Osten), <b style="color:var(--gold-hi)">Kneipenplatz</b> (Arbeiterviertel), <b style="color:var(--gold-hi)">The Belmont</b> (Lobby) und die <b style="color:var(--gold-hi)">Vespera-Bank</b> (Kasse 2). Dort E drücken.</div>`;
    const ps = Object.keys(POSTS);
    h += `<h3>Preise in der Stadt</h3><p>Mittlere Preise je Einheit. Kaufen Sie, wo es billig ist, verkaufen Sie, wo es gebraucht wird. Große Mengen verderben den Preis; über Nacht füllen sich die Vorräte wieder.</p>
    <div style="overflow-x:auto"><table><tr><th>Ware</th>${ps.map(q => `<th class="r">${esc(POSTS[q].n.split(' · ')[0].replace('The ', ''))}</th>`).join('')}<th class="r">Lager</th></tr>${gs.map(g => {
      const pr = ps.map(q => POSTS[q].f[g] ? ktPrice(q, g) : 0), lo = Math.min(...pr.filter(Boolean)), hi = Math.max(...pr);
      return `<tr><td>${esc(GOODS[g].n)}</td>${pr.map(v => `<td class="r ${v && v === lo && lo !== hi ? 'up' : v && v === hi && lo !== hi ? 'dn' : ''}">${v ? fmP(v) : '·'}</td>`).join('')}<td class="r">${fmN(s.lager[g] || 0)}</td></tr>`;
    }).join('')}</table></div><p><span class="up">Türkis</span> = am billigsten, <span class="dn">Kupfer</span> = am teuersten.</p>`;
    return h;
  },
  boerse() {
    const s = KT.s;
    return `<h3>Börse von Vespera</h3><p>Per Telefon von überall. Große Orders bewegen den Kurs. Dividende: 0,4 % des Kurses am Tag. Gebühr 1 %.</p>
    <table><tr><th>Gesellschaft</th><th class="r">Kurs</th><th class="hide-s">Verlauf</th><th class="r">Ihre Aktien</th><th></th></tr>${Object.keys(COS).map(c => {
      const C = COS[c], h = s.hist[c], p = s.cp[c], ch = h.length > 1 ? (p / h[h.length - 2] - 1) * 100 : 0, have = s.shares[c] || 0, pct = have / CO_SHARES * 100;
      const pl = have && s.cost[c] ? (p / s.cost[c] - 1) * 100 : 0;
      return `<tr><td>${esc(C.n)}<span class="s">${esc(SECTORS[C.sec])}${pct >= 50 ? ' · Sie haben die Mehrheit' : ''}</span></td><td class="r">${fmP(p)}<span class="s ${ch >= 0 ? 'up' : 'dn'}">${ch >= 0 ? '+' : ''}${ch.toFixed(1).replace('.', ',')} %</span></td><td class="hide-s">${spark(h)}</td>
      <td class="r">${fmN(have)}<span class="s">${have ? pct.toFixed(1).replace('.', ',') + ' % · ' + (pl >= 0 ? '+' : '') + pl.toFixed(0) + ' %' : ''}</span></td>
      <td class="r" style="white-space:nowrap"><button type="button" data-act="shares" data-id="${c}" data-n="100">+100</button> <button type="button" data-act="shares" data-id="${c}" data-n="1000">+1000</button> <button type="button" data-act="shares" data-id="${c}" data-n="-100" ${have ? '' : 'disabled'}>−100</button> <button type="button" data-act="shares" data-id="${c}" data-n="-1000" ${have ? '' : 'disabled'}>−1000</button></td></tr>`;
    }).join('')}</table>`;
  },
  stiftungen() {
    const s = KT.s;
    return `<h3>Stiftungen und Bauprojekte</h3><p>Was Alexander der Stadt schenkt, bleibt: mehr Ansehen, mehr Wohlstand, und manche Branche blüht auf.</p>
    <table><tr><th>Projekt</th><th class="r">Kosten</th><th></th></tr>${Object.keys(PROJECTS).map(id => {
      const P = PROJECTS[id], done = s.proj[id];
      const eff = Object.keys(P.rep).map(g => `${{ elite: 'Elite', buerger: 'Bürger', arbeiter: 'Arbeiter' }[g]} +${P.rep[g]}`).concat(P.wohl ? ['Wohlstand +' + P.wohl] : []).join(', ');
      return `<tr><td>${esc(P.n)}<span class="s">${esc(P.t)} ${esc(eff)}</span></td><td class="r">${fmM(P.c)}</td><td class="r">${done ? `<span class="up">gestiftet (Tag ${done})</span>` : `<button type="button" data-act="fund" data-id="${id}" ${s.cash < P.c ? 'disabled' : ''}>Stiften</button>`}</td></tr>`;
    }).join('')}</table>`;
  },
  aufgaben() { return '<p>Die Aufgaben werden geladen …</p>'; },
};

/* ---------- Anzeige oben rechts ---------- */
export function ktHud(force) {
  const h = $('ktHud'); if (!h || !KT.s) return;
  const show = playing && !paused;
  h.style.opacity = show ? 1 : 0;
  if (!force && KT.lastCash === Math.round(KT.s.cash)) return;
  const c = h.querySelector('.cash'), d = Math.round(KT.s.cash) - KT.lastCash;
  c.innerHTML = `${fmM(KT.s.cash)}<small>${isTouch ? 'KONTOR' : 'I · KONTOR'}</small>`;
  if (KT.lastCash && Math.abs(d) >= 1 && force !== 'quiet') { const i = document.createElement('i'); i.className = d > 0 ? 'up' : 'dn'; i.style.color = d > 0 ? '#7fe3d6' : '#f0a070'; i.textContent = (d > 0 ? '+' : '−') + fmN(Math.abs(d)); c.append(i); setTimeout(() => { i.style.opacity = 0; }, 2200); }
  KT.lastCash = Math.round(KT.s.cash);
}

/* ---------- Handelsplätze in der Welt ---------- */
function ktPlacePosts() {
  POST_POS.kai = { x: -600.6, y: 0.25, z: QUAY.z1 + 5.4, r: 3.6 };                                     // vor der Tür des Hafenamts
  POST_POS.luft = { x: 552, y: 0.25, z: 647.5, r: 6 };                                                  // vor der Abfertigungshalle
  { const d = DEPOTS.find(q => q.name === 'STAHLWERK') || DEPOTS[0]; if (d) POST_POS.depot = { x: d.x, y: 0.22, z: d.z - 3, r: 6, label: titleCase(d.name) }; }
  { const S = WORK.square; POST_POS.kneipe = S ? { x: (S.X + S.X1) / 2, y: 0.22, z: (S.Z + S.Z1) / 2, r: 7 } : { x: 152, y: 0.26, z: -726, r: 7 }; }
  POST_POS.belmont = { x: 0, y: 0.26, z: 40, r: 5 };                                                     // Lobby
  { const B = ORTE.bank; if (B && B.win) POST_POS.bank = { x: B.sx + 1.1, y: B.F, z: B.win[1], r: 1.7 }; }
  for (const pid in POST_POS) {
    const Q = POST_POS[pid];
    INTERACT.push({ test: p => (p.x - Q.x) ** 2 + (p.z - Q.z) ** 2 < Q.r * Q.r && Math.abs(p.y - Q.y) < 2.5 && !KT.open,
      label: 'Handeln: ' + POSTS[pid].n + (Q.label ? ' (' + Q.label + ')' : ''), act: () => ktOpen('handel') });
  }
}
export function ktPostHere() {
  const p = player.p;
  for (const pid in POST_POS) { const Q = POST_POS[pid]; if ((p.x - Q.x) ** 2 + (p.z - Q.z) ** 2 < (Q.r * 2) ** 2 && Math.abs(p.y - Q.y) < 3) return pid; }
  return null;
}
export const postPos = pid => POST_POS[pid];

/* ---------- Ladentheken: Ware kaufen, den Laden übernehmen ---------- */
function ktWrapShops() {
  for (const S of SHOPS) {
    const kd = SHOP_KINDS.find(k => k.k === S.kind); if (!kd || !S.host) continue;
    const it = INTERACT.find(u => !u.kt && typeof u.label === 'string' && u.label.endsWith(kd.ware + ' · ' + S.host));
    if (!it) continue;
    const talk = it.act, id = 'laden:' + S.name; it.kt = true;
    it.act = () => {
      const mine = ktOwns(id), pr = WARE_PRICE[S.kind] || 3, B = BIZ[id];
      const opts = [S.kind === 'friseur' ? `Rasur und Haarschnitt · ${mine ? 'aufs Haus' : fmM(pr)}` : `${kd.ware.replace(/^(ein|eine|einen) /, '')} kaufen · ${mine ? 'aufs Haus' : fmM(pr)}`,
        mine ? 'Wie laufen die Geschäfte?' : `Den Laden übernehmen · ${fmM(B ? B.price : 0)}`, 'Plaudern', 'Auf Wiedersehen'];
      openChoice(titleCase(S.name), opts, i => {
        if (i === 0) {
          if (!mine) KT.s.cash -= pr;
          if (S.kind !== 'friseur' && S.kind !== 'cafe' && S.kind !== 'bar') KT.s.items.push({ k: S.kind, n: kd.ware.replace(/^(ein|eine|einen) /, ''), from: S.name });
          ktChanged('item');
          toast(`${S.host}: „${mine ? 'Für Sie natürlich aufs Haus, Herr Alexander.' : 'Sehr gern, Herr Alexander. Bitte sehr.'}“`);
        } else if (i === 1) {
          if (mine) { const v = bizIncome(id); toast(`${S.host}: „Bestens, Herr Alexander: ${fmM(v)} am Tag. Die Kundschaft kommt Ihretwegen.“`); }
          else if (B && ktBuyBiz(id)) toast(`${S.host}: „Ihnen? Mit dem größten Vergnügen, Herr Alexander. Ich bleibe gern als Geschäftsführer.“`);
        } else if (i === 2) talk();
      });
    };
  }
}

/* ---------- Schleife ---------- */
let ktLast = 0;
function ktLoop(t) {
  requestAnimationFrame(ktLoop);
  const dt = Math.min(0.25, ktLast ? (t - ktLast) / 1000 : 0); ktLast = t;
  if (!KT.ready) { if (playing && SHOPS.length !== undefined) ktInit(); return; }
  if (playing && !paused) {
    KT.s.t += dt;
    if (KT.s.t >= KT_DAY) { KT.s.t -= KT_DAY; ktNewDay(); }
  }
  if ((KT.hudT -= dt) <= 0) { KT.hudT = 0.5; ktHud(); if (KT.open && KT.tab === 'uebersicht') { /* Uhr der Abrechnung */ const m = $('kt').querySelector('main .tile p'); if (m) { const n = Math.max(0, Math.ceil(KT_DAY - KT.s.t)); m.textContent = `nächste Abrechnung in ${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')} min`; } } }
  for (const f of KT.hooks) try { f('frame', dt); } catch (e) { console.warn('Kontor:', e); }
  if ((KT.saveT -= dt) <= 0) { KT.saveT = 8; if (KT.dirty) ktSave(); }
}
function ktInit() {
  KT.s = ktLoad(); ktBuildBiz();
  for (const id in KT.s.own) if (!BIZ[id]) delete KT.s.own[id];   // Laden gibt es nicht mehr (andere Qualitätsstufe)
  ktDom(); ktPlacePosts(); ktWrapShops();
  KT.ready = true; KT.lastCash = Math.round(KT.s.cash); ktHud(true);
  for (const f of KT.hooks) try { f('init'); } catch (e) { console.warn('Kontor:', e); }
  if (window.vespera) window.vespera.kontor = { KT, BIZ, POSTS, GOODS, COS, PROJECTS, open: ktOpen, trade: ktTrade, price: ktPrice, newDay: ktNewDay, save: ktSave, reset: ktReset, postHere: ktPostHere, postPos };
  document.addEventListener('pointerlockchange', () => { if (KT.open && document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* egal */ } });   // Maus bleibt frei, solange das Buch offen ist
  ktNewsBox();
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'Kontor und Aufgaben', tasten: [{ k: ['I'], t: 'Kontorbuch', d: 'Geld, Besitz, Handel, Börse, Stiftungen, Aufgaben (auch Klick aufs Vermögen oben rechts)' }, { k: ['E'], t: 'Handeln, Anliegen', d: 'an Handelsplätzen handeln, Bürgern mit goldenem Kreis helfen, Waren liefern' }] } })); } catch (e) { /* alt */ }
  window.addEventListener('beforeunload', () => { if (KT.dirty) ktSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && KT.dirty) ktSave(); });
}
// Taste I: Kontorbuch; solange es offen ist, gehören Tasten dem Buch (vor input.js, Fangphase)
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', e => {
    if (KT.open) {
      if (e.code === 'Escape' || e.code === 'KeyI') ktClose();
      else if (/^Digit[1-9]$/.test(e.code)) { const t = TABS[+e.code.slice(5) - 1]; if (t) { KT.tab = t[0]; ktRender(); } }
      e.stopImmediatePropagation(); if (e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
      return;
    }
    if (e.code === 'KeyI' && !e.repeat && KT.ready && playing && !paused && !DINE.menuOpen && !e.ctrlKey && !e.metaKey) { ktOpen(); e.stopImmediatePropagation(); }
  }, true);
  requestAnimationFrame(ktLoop);
}
export const ktRenderNow = () => ktRender();
export { ktNewDay, ktChanged, titleCase, esc, fmN, fmP, clamp };
