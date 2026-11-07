/* =====================================================================
   V62 · RUF UND ANSEHEN
   Alexander ist der Gründer von Vespera, der reichste Mann der Stadt, und
   jeder kennt ihn. Sein Ruf beginnt also hoch und bewegt sich mit dem, was
   er tut. Taste Ö (US-Tastatur: ;) oder ein Klick auf den Titel oben rechts öffnet das
   goldene Buch „Ruf und Ansehen“.
   - ACHSEN: Hohe Gesellschaft, Bürger, Arbeiter (dieselben Werte wie im
     Kontor, KT.s.rep), Presse (der Vespera-Kurier), Personal (Belmont, Villa,
     Aurora Imperial), dazu Furcht und Bewunderung als eigenes Paar, und als
     Gegenspieler der Untergrund: der Rote Kasimir und seine Anarchisten.
   - EREIGNISSE: Gegner besiegen, Bomben entschärfen, Verstecke ausheben,
     Kasimir fassen; Stiftungen, Aufgaben und Löhne aus dem Kontor; die Gala
     im Belmont und die gewählte Rede; Bürger mit Telekinese heben oder
     werfen, Energiestöße in die Menge, Schäden in der Stadt, Druckwellen,
     Flüge über der Stadt und Heldenlandungen. Wiederholt man dasselbe kurz
     hintereinander, zählt es jedes Mal weniger.
   - WIRKUNGEN: Die Haltung der Leute (awe.js attOf: bewundernd, neidisch,
     skeptisch, ängstlich, respektvoll) richtet sich nach dem Ruf bei ihrer
     Gruppe und nach Furcht und Bewunderung, ebenso neue Sätze (je Rang, je
     Stiftung, nach Kasimirs Festnahme). Kontor: Vorrechte geben bis zu 3 %
     mehr Rabatt. Zeitung: Stimmungskasten, Umfragen bei neuem Titel,
     Leitartikel im Ton der Presse, kritische Meldungen bei Übergriffen.
     Post und Einladungen (Soirée, Varieté, Polarclub, Gala, Gewerkschaft,
     Interview, Drohbrief …) mit Entscheidungen. Arbeiterviertel: bei
     schlechtem Ruf kühle Blicke, Streiks, mehr Zulauf für die Anarchisten.
     Der Untergrund wächst, wenn die Arbeiter unzufrieden sind, und schrumpft
     mit jeder Razzia; danach richtet sich, wie oft Anarchisten auftauchen.
   Gespeichert im Browser (localStorage 'vespera.ruf'); Gesellschaft, Bürger
   und Arbeiter liegen im Spielstand des Kontors.
   Keine 3D-Teile, keine Shader: nur HTML über dem Bild.
   ===================================================================== */
import { $ } from './core.js';
import { player } from './player.js';
import { playing, paused, isTouch, tryLock } from './input.js';
import { toast, districtAt } from './boat.js';
import { DINE } from './venues.js';
import { KT, ktRep, ktCash, ktChanged, ktRepDisc, EVENTS, POSTS, fmM, esc, clamp } from './kontor.js';
import { GEGNER } from './gegner.js';
import { BOSS } from './anfuehrer.js';
import { POWERS } from './powers.js';
import { KRAEFTE } from './kraefte.js';
import { BLAST } from './energy.js';
import { AWE, SAY_NEAR, SAY_POW, TALK } from './awe.js';
import { peds } from './serpentine.js';
import { GALA, startGala } from './gala.js';

const RUF_SAVE = 'vespera.ruf';
export const RUF = { s: null, ready: false, open: false, dirty: false, saveT: 8, tickT: 0, slowT: 0, snap: {}, q: [], qT: 0, fat: {}, lastTat: null, w: {}, stamp: null, lines: new Map(), newsT: {}, distT: 0, dist: '' };

/* ---------- Achsen und Ränge ---------- */
export const RUF_AX = {
  elite: { n: 'Hohe Gesellschaft', s: 'Salons, Bälle, Belmont-Gäste', kt: true, r: ['Gemieden in den Salons', 'Belächelt in den Salons', 'Gern gesehener Gast', 'Gefeierter Gastgeber', 'Erster der Gesellschaft'] },
  buerger: { n: 'Bürger', s: 'Boulevards, Läden, Cafés', kt: true, r: ['Misstrauisch beäugt', 'Mit Vorsicht gegrüßt', 'Geachteter Mitbürger', 'Beliebter Stadtvater', 'Held der Bürger'] },
  arbeiter: { n: 'Arbeiter', s: 'Arbeiterviertel, Fabriken, The Brass Lantern', kt: true, r: ['Der Herr von oben', 'Kühl empfangen', 'Ein fairer Patron', 'Respektierter Chef', 'Einer von uns'] },
  presse: { n: 'Presse', s: 'Der Vespera-Kurier', r: ['Zielscheibe des Kuriers', 'Kritisch beäugt', 'Gern zitiert', 'Liebling der Presse', 'Held der Titelseite'] },
  personal: { n: 'Personal', s: 'Belmont, Villa, Aurora Imperial', r: ['Gefürchteter Dienstherr', 'Strenger Herr', 'Guter Herr', 'Geschätzter Dienstherr', 'Verehrter Dienstherr'] },
  bew: { n: 'Bewunderung', s: 'Staunen über den Mann mit dem Kristall', r: ['Gleichgültig', 'Neugierig bestaunt', 'Bewundert', 'Gefeiert', 'Vergöttert'] },
  furcht: { n: 'Furcht', s: 'Scheu vor seinen Kräften', r: ['Niemand fürchtet ihn', 'Ehrfurcht', 'Respekt und Scheu', 'Furcht', 'Schrecken'] },
  unter: { n: 'Der Untergrund', s: 'Der Rote Kasimir und die Anarchisten', r: ['Zerschlagen', 'Versprengt', 'Im Untergrund', 'Wachsend', 'Im Aufruhr'] },
};
const RUF_SHORT = { elite: 'Gesellschaft', buerger: 'Bürger', arbeiter: 'Arbeiter', presse: 'Presse', personal: 'Personal', bew: 'Bewunderung', furcht: 'Furcht', unter: 'Untergrund' };
export const rufRank = v => v < 20 ? 0 : v < 40 ? 1 : v < 60 ? 2 : v < 80 ? 3 : 4;
export function rufGet(k) { if (!RUF.s) return 50; return RUF_AX[k].kt ? (KT.s && typeof KT.s.rep[k] === 'number' ? KT.s.rep[k] : 50) : RUF.s[k]; }
export function rufAnsehen() {
  const g = rufGet;
  const a = 0.28 * g('elite') + 0.3 * g('buerger') + 0.2 * g('arbeiter') + 0.13 * g('presse') + 0.09 * g('personal') + (g('bew') - 60) * 0.12 - Math.max(0, g('furcht') - 45) * 0.14;
  return clamp(a, 0, 100);
}
// Wesen: gefürchtet / geachtet / bewundert
export function rufWesen() { const F = rufGet('furcht'), B = rufGet('bew'); return F >= 50 && F >= B - 10 ? 'gef' : B >= 70 && F < 40 ? 'bew' : 'gea'; }
const RUF_TITLES = {
  gef: ['Der gefürchtete Herr im Turm', 'Gefürchteter Patron', 'Strenger Herr von Vespera', 'Gefürchteter Wohltäter', 'Eiserner Vater der Stadt'],
  gea: ['Umstrittener Magnat', 'Der Mann im Turm', 'Herr von Vespera', 'Wohltäter von Vespera', 'Vater der Stadt'],
  bew: ['Bewunderter Exzentriker', 'Gefeierter Sonderling', 'Gefeierter Herr von Vespera', 'Liebling von Vespera', 'Legende des Kraters'],
};
const RUF_WESEN = { gef: 'gefürchtet', gea: 'geachtet', bew: 'bewundert' };
const rufTier = a => a < 25 ? 0 : a < 45 ? 1 : a < 65 ? 2 : a < 82 ? 3 : 4;
export function rufTitle() { return RUF_TITLES[rufWesen()][rufTier(rufAnsehen())]; }

function rufFresh() { return { v: 1, presse: 68, personal: 80, furcht: 28, bew: 74, unter: 45, log: [], post: [], deeds: {}, cd: {}, ranks: {}, title: null, nid: 1, day: 0, hint: false }; }
function rufLoad() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(RUF_SAVE) || 'null'); } catch (e) { s = null; }
  const f = rufFresh();
  if (!s || s.v !== 1) return f;
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  for (const k of ['presse', 'personal', 'furcht', 'bew', 'unter']) if (typeof s[k] !== 'number' || !isFinite(s[k])) s[k] = f[k];
  return s;
}
export function rufSave() { try { localStorage.setItem(RUF_SAVE, JSON.stringify(RUF.s)); } catch (e) { /* privat oder voll */ } RUF.dirty = false; }

/* ---------- Ruf ändern ---------- */
const fmD = d => (d > 0 ? '+' : '−') + (Math.abs(d) < 2 ? Math.abs(d).toFixed(1).replace('.', ',').replace(',0', '') : Math.round(Math.abs(d)));
// ch: { achse: Änderung }, why: Grund (Chronik, Toast), o: { key (für die Abnutzung), quiet, faint (Abnutzung je Wiederholung) }
export function rufAdd(ch, why, o = {}) {
  if (!RUF.ready) return null;
  const s = RUF.s, key = o.key || why, now = performance.now() / 1000;
  // Abnutzung: dasselbe kurz hintereinander zählt weniger (90 s Gedächtnis)
  const F = RUF.fat[key]; let m = 1;
  if (F && now - F.t < 90) { F.n++; m = Math.max(0.2, Math.pow(o.faint ?? 0.65, F.n)); } else RUF.fat[key] = { n: 0, t: now };
  RUF.fat[key].t = now;
  const done = {};
  for (const k in ch) {
    let d = ch[k] * m; if (!d || !RUF_AX[k]) continue;
    if (k === 'presse' && d < 0 && rufHas('presse')) d *= 0.5;   // Vorrecht: Liebling der Presse
    const v0 = rufGet(k);
    if (RUF_AX[k].kt) { ktRep(k, d); RUF.snap[k] = KT.s.rep[k]; }
    else s[k] = clamp(s[k] + d, 0, 100);
    const dd = rufGet(k) - v0; if (Math.abs(dd) > 0.001) done[k] = dd;
  }
  if (!Object.keys(done).length) return done;
  RUF.dirty = true;
  if (Object.keys(done).some(k => RUF_AX[k].kt)) { try { ktChanged('ruf'); } catch (e) { /* Kontor noch nicht bereit */ } }
  if (!o.quiet) { rufQueue(done, why); rufLog(done, why); }
  return done;
}
function rufLog(done, why) {
  const L = RUF.s.log, top = L[0], day = KT.s ? KT.s.day : 0;
  if (top && top.t === why && top.d === day) { for (const k in done) top.c[k] = (top.c[k] || 0) + done[k]; top.n = (top.n || 1) + 1; }
  else { L.unshift({ d: day, t: why, c: { ...done } }); if (L.length > 30) L.length = 30; }
}
function rufQueue(done, why) {
  const q = RUF.q.find(x => x.why === why);
  if (q) for (const k in done) q.c[k] = (q.c[k] || 0) + done[k];
  else RUF.q.push({ why, c: { ...done } });
  if (RUF.qT <= 0) RUF.qT = 1.1;
}

/* ---------- Vorrechte und Warnungen ---------- */
const RUF_PRIV = [
  { id: 'salon', t: 'Ehrengast der Salons', need: 'Gesellschaft ab 75', ok: () => rufGet('elite') >= 75, d: '+2 % Rabatt am Luftschiffhafen, im Einkauf des Belmont und an der Bank.' },
  { id: 'polarclub', t: 'Ehrenmitglied im Polarclub', need: 'Einladung annehmen (Gesellschaft ab 85)', ok: () => !!RUF.s.deeds.polarclub, d: 'Noch +1 % bei der feinen Kundschaft; die Elite grüßt zuerst.' },
  { id: 'haendler', t: 'Freund der Händler', need: 'Bürger ab 75', ok: () => rufGet('buerger') >= 75, d: '+2 % Rabatt am Güterkai.' },
  { id: 'arbeiter', t: 'Einer von uns', need: 'Arbeiter ab 70', ok: () => rufGet('arbeiter') >= 70, d: '+2 % am Industriedepot und am Kneipenplatz; Streiks dauern nur einen Tag; die Anarchisten finden kaum Zulauf.' },
  { id: 'presse', t: 'Liebling der Presse', need: 'Presse ab 75', ok: () => rufGet('presse') >= 75, d: 'Schlechte Nachrichten kosten bei der Presse nur halb so viel; freundliche Leitartikel.' },
  { id: 'personal', t: 'Verehrter Dienstherr', need: 'Personal ab 80', ok: () => rufGet('personal') >= 80, d: 'Das Personal erzählt nur Gutes: jeden Tag etwas Ansehen in der Gesellschaft und bei der Presse.' },
  { id: 'gala', t: 'Einladungen zur Gala', need: 'Ansehen ab 65', ok: () => rufAnsehen() >= 65, d: 'Direktor Hartmann schickt Einladungen zur Gala im Belmont.' },
  { id: 'schluessel', t: 'Goldener Schlüssel der Stadt', need: 'Vom Bürgermeister (Ansehen ab 85)', ok: () => !!RUF.s.deeds.schluessel, d: '+1 % Rabatt überall; der Stadtrat steht hinter Ihnen.' },
  { id: 'furcht', t: 'Gefürchtet', need: 'Furcht ab 70', ok: () => rufGet('furcht') >= 70, d: 'Verbrecher wagen sich seltener auf die Straße, doch viele Bürger ducken sich weg.' },
  { id: 'ruhe', t: 'Ruhe im Untergrund', need: 'Untergrund unter 15', ok: () => rufGet('unter') < 15, d: 'Die Anarchisten sind zerschlagen: kaum noch Bomben und Angriffe.' },
];
const RUF_WARN = [
  { id: 'unruhe', t: 'Unruhe im Arbeiterviertel', ok: () => rufGet('arbeiter') < 30, d: 'Kühle Blicke, Streikgefahr in Ihren Firmen, Zulauf für die Anarchisten. Bessere Löhne, Stiftungen und Hilfe im Viertel helfen.' },
  { id: 'gegenwind', t: 'Gegenwind im Kurier', ok: () => rufGet('presse') < 30, d: 'Kritische Leitartikel; die Zeitung schreibt über jeden Fehltritt.' },
  { id: 'angst', t: 'Die Stadt hat Angst', ok: () => rufGet('furcht') > 75 && rufGet('bew') < 55, d: 'Die Bürger verlieren jeden Tag etwas Vertrauen. Weniger Gewalt in der Öffentlichkeit hilft.' },
  { id: 'aufruhr', t: 'Der Untergrund rüstet auf', ok: () => rufGet('unter') >= 70, d: 'Anarchisten tauchen viel öfter auf; Kasimir schickt Drohbriefe.' },
];
export const rufHas = id => { const P = RUF_PRIV.find(p => p.id === id); return !!(P && RUF.s && P.ok()); };
// Rabatt-Zuschlag für das Kontor je Gruppe des Handelsplatzes
function rufBonus(g) {
  if (!RUF.ready) return 0;
  let b = rufHas('schluessel') ? 0.01 : 0;
  if (g === 'elite') b += (rufHas('salon') ? 0.02 : 0) + (rufHas('polarclub') ? 0.01 : 0);
  else if (g === 'buerger') b += rufHas('haendler') ? 0.02 : 0;
  else if (g === 'arbeiter') b += rufHas('arbeiter') ? 0.02 : 0;
  return b;
}

/* ---------- Haltung der Leute (awe.js) ---------- */
const RUF_ELITE = new Set(['tux', 'gown', 'furcoat']), RUF_STAFF = new Set(['livery', 'waiter', 'chauffeur', 'sailor']);
const rufGroupOf = kind => kind === 'worker' ? 'arbeiter' : RUF_ELITE.has(kind) ? 'elite' : RUF_STAFF.has(kind) ? 'personal' : 'buerger';
// Wahrscheinlichkeiten je Gruppe: [bew, resp, furcht, neid, skep]
export function rufAttP(group, tr) {
  const F = rufGet('furcht'), A = rufGet('bew'), R = rufGet(group);
  const pf = clamp(0.03 + (F - 20) / 80 * 0.45, 0.02, 0.5);
  if (group === 'arbeiter') {
    let resp = 0.08 + 0.55 * R / 100, bew = Math.max(0, (R - 60) / 100) * 0.8, fu = pf + (R < 30 ? 0.08 : 0);
    if (tr === 'mürrisch') { resp *= 0.6; bew *= 0.5; }
    if (tr === 'schüchtern') fu += 0.1;
    const sk = Math.max(0, 1 - resp - bew - fu);
    return { bew, resp, furcht: fu, neid: 0, skep: sk };
  }
  let bew = (0.2 + 0.65 * R / 100) * (0.6 + 0.4 * A / 100), fu = group === 'elite' ? pf * 0.7 : pf;
  if (tr === 'mürrisch' || tr === 'ehrgeizig') bew *= 0.7;
  const rest = Math.max(0, 1 - bew - fu), sk = group === 'buerger' && R < 40 ? rest * 0.6 : 0;
  return { bew, resp: 0, furcht: fu, neid: rest - sk, skep: sk };
}
function rufAttHook(k, tr) {
  if (!RUF.ready) return null;
  if (k === 'police') return null;
  if (k === 'kid') return rufGet('furcht') > 65 && Math.random() < 0.3 ? 'furcht' : 'bew';
  if (RUF_STAFF.has(k)) { const P = rufGet('personal'); return P < 35 && Math.random() < 0.3 ? 'furcht' : null; }
  const P = rufAttP(rufGroupOf(k), tr);
  let r = Math.random();
  for (const a of ['furcht', 'bew', 'resp', 'skep', 'neid']) { if ((r -= P[a]) < 0) return a; }
  return k === 'worker' ? 'skep' : 'neid';
}
// nach großen Änderungen bilden sich die Leute ihre Meinung neu
function rufRefreshAtt(force) {
  const cur = { elite: rufGet('elite'), buerger: rufGet('buerger'), arbeiter: rufGet('arbeiter'), furcht: rufGet('furcht'), bew: rufGet('bew'), personal: rufGet('personal') };
  const S = RUF.stamp;
  if (!force && S && Object.keys(cur).every(k => Math.abs(cur[k] - S[k]) < 5)) return;
  RUF.stamp = cur;
  for (const pd of peds) if (pd && !pd.aw && pd.att) pd.att = null;
}

/* ---------- Neue Sätze je Rang und Tat ---------- */
const RUF_LINES = [
  { on: () => RUF.s.deeds.kasimir, L: { 'SAY_NEAR.bew': ['Sie haben den Roten Kasimir geschnappt! Endlich kann man wieder ruhig schlafen.', 'Herr Alexander! Das mit Kasimir, das war großartig!'], 'SAY_NEAR.resp': ['Kasimir hinter Gittern … das hat er sich selbst eingebrockt.'], 'TALK.bew': ['Seit Kasimir hinter Gittern sitzt, gehe ich wieder abends spazieren. Danke, Herr Alexander!'] } },
  { on: () => RUF.s.deeds.gala, L: { 'SAY_NEAR.bew': ['Der Goldene Stern steht Ihnen, Herr Alexander!', 'Ich habe das Feuerwerk über dem Belmont gesehen. Herrlich!'], 'TALK.dienst': ['Die Gala war ein Triumph, Herr Alexander. Das ganze Haus spricht davon.'] } },
  { on: () => KT.s && KT.s.proj.spital, L: { 'SAY_NEAR.bew': ['Das Hospital am Kraterrand hat meiner Mutter das Leben gerettet, Herr Alexander!'], 'TALK.resp': ['Im neuen Hospital haben sie meinen Jungen wieder zusammengeflickt. Das vergess’ ich Ihnen nicht.'] } },
  { on: () => KT.s && KT.s.proj.oefen, L: { 'SAY_NEAR.resp': ['Die neuen Öfen halten warm, Herr Alexander. Danke.', 'Zum ersten Mal kein Eis an den Fenstern. Dank Ihnen.'], 'TALK.skep': ['Die Öfen sind gut, das muss man Ihnen lassen. Jetzt noch die Löhne …'] } },
  { on: () => KT.s && KT.s.proj.tram, L: { 'SAY_NEAR.bew': ['Mit der neuen Straßenbahn bin ich in zwölf Minuten bei der Arbeit!'], 'SAY_NEAR.resp': ['Die Linie Nord, Herr Alexander. Gute Sache.'] } },
  { on: () => KT.s && KT.s.proj.schule, L: { 'SAY_NEAR.resp': ['Mein Junge geht jetzt auf Ihre Gewerkschule. Er wird Luftschiffbauer!'] } },
  { on: () => KT.s && KT.s.proj.waisen, L: { 'SAY_NEAR.bew': ['Die Kinder im Waisenhaus haben Ihnen ein Bild gemalt, Herr Alexander.'] } },
  { on: () => KT.s && KT.s.proj.oper, L: { 'SAY_NEAR.bew': ['Ein Opernhaus aus Marmor und Gold! Ganz Vespera freut sich darauf.'], 'SAY_NEAR.neid': ['Eine Oper. Für die, die sich die Logen leisten können.'] } },
  { on: () => rufGet('arbeiter') >= 70, L: { 'SAY_NEAR.resp': ['Einer von uns, Herr Alexander! Kommen Sie auf ein Bier in die Brass Lantern?', 'Jungs, der Chef! Mützen ab!', 'Mit Ihnen als Patron schuften wir gern.'], 'SAY_NEAR.bew': ['Ein Herr, der seine Arbeiter nicht vergisst. Das gibt’s nur in Vespera.'] } },
  { on: () => rufGet('arbeiter') < 30, L: { 'SAY_NEAR.skep': ['Die Löhne reichen nicht mal für Kohle, Herr Alexander.', 'Passen Sie auf, im Viertel brodelt’s.', 'Hier unten mögen Sie nicht viele, Herr Alexander.', 'Streik liegt in der Luft. Nur damit Sie’s wissen.'], 'TALK.skep': ['Ihre Türme werden immer höher und unsere Löhne immer kleiner. Wie passt das zusammen?', 'Sie sollten mal eine Schicht in der Gießerei machen, Herr Alexander.'], 'SAY_NEAR.furcht': ['Kopf runter … der Herr aus dem Turm.'] } },
  { on: () => rufGet('elite') >= 80, L: { 'SAY_NEAR.neid': ['Herr Alexander! Sie kommen doch zu meiner Soirée am Donnerstag?', 'Darf ich Ihnen meine Tochter vorstellen, Herr Alexander?'], 'SAY_NEAR.bew': ['Herr Alexander, ganz Vespera spricht von Ihrem letzten Empfang!'] } },
  { on: () => rufGet('elite') < 35, L: { 'SAY_NEAR.neid': ['Man sieht ihn kaum noch in den Salons.', 'Haben Sie gehört? Sogar Varga lädt ihn nicht mehr ein.'] } },
  { on: () => rufGet('buerger') >= 80, L: { 'SAY_NEAR.bew': ['Herr Alexander! Unser Held!', 'Drei Hurras für den besten Mann der Stadt!', 'Meine Kinder sagen, Sie sind besser als jeder Filmstar.'] } },
  { on: () => rufGet('buerger') < 35, L: { 'SAY_NEAR.skep': ['Da kommt er. Hoffentlich wirft er heute niemanden.', 'Früher hat man ihn gefeiert. Heute geht man lieber aus dem Weg.'] } },
  { on: () => rufGet('furcht') >= 65, L: { 'SAY_NEAR.furcht': ['Bitte … werfen Sie mich nicht, Herr Alexander!', 'Ich hab’ gesehen, was Sie mit dem Wagen gemacht haben …', 'Kinder, rein ins Haus! Schnell!'], 'SAY_POW.furcht': ['Er hat wieder schlechte Laune!', 'Wer ist diesmal dran?'], 'TALK.furcht': ['Ich … ich hab’ nichts gesehen, Herr Alexander. Gar nichts.'] } },
  { on: () => rufGet('bew') >= 85, L: { 'SAY_NEAR.bew': ['Ein Autogramm, Herr Alexander! Bitte!', 'Ich habe ein Foto von Ihnen über dem Bett hängen!', 'Sie sind das Beste, was Vespera je passiert ist!'], 'SAY_NEAR.kid': ['Ich will auch einen Kristall! Wo gibt’s die?'] } },
  { on: () => rufGet('presse') >= 80, L: { 'SAY_NEAR.bew': ['Ich lese jeden Abend im Kurier über Sie, Herr Alexander!'] } },
  { on: () => rufGet('presse') < 30, L: { 'SAY_NEAR.skep': ['Haben Sie gelesen, was der Kurier über ihn schreibt?'], 'SAY_NEAR.neid': ['Der Kurier lässt kein gutes Haar an ihm. Zu Recht?'] } },
  { on: () => rufGet('personal') >= 85, L: { 'SAY_NEAR.dienst': ['Für Sie arbeitet man gern, Herr Alexander.', 'Das ganze Haus ist stolz, Ihnen zu dienen, Herr Alexander.'] } },
  { on: () => rufGet('personal') < 40, L: { 'SAY_NEAR.dienst': ['S… sehr wohl, Herr Alexander. Sofort, Herr Alexander.', 'Jawohl, Herr Alexander. Bitte keine Umstände.'] } },
];
const RUF_ARR = { SAY_NEAR, SAY_POW, TALK };
function rufArr(path) { const [a, k] = path.split('.'); const O = RUF_ARR[a]; if (!O) return null; return O[k] || (O[k] = []); }
function rufLinesStep() {
  for (const S of RUF_LINES) {
    let on = false; try { on = !!S.on(); } catch (e) { on = false; }
    const had = RUF.lines.get(S);
    if (on === !!had) continue;
    RUF.lines.set(S, on);
    for (const p in S.L) {
      const A = rufArr(p); if (!A) continue;
      for (const x of S.L[p]) { const i = A.indexOf(x); if (on && i < 0) A.push(x); else if (!on && i >= 0) A.splice(i, 1); }
    }
  }
}

/* ---------- Zeitung ---------- */
function rufNews(titel, text, o = {}) {
  if (o.key) { const t = performance.now() / 1000; if (RUF.newsT[o.key] && t - RUF.newsT[o.key] < (o.every || 300)) return; RUF.newsT[o.key] = t; }
  try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik: o.rubrik || 'Alexander', prio: o.prio || 4, ort: o.ort, ruf: o.ruf, quelle: 'ruf' } })); } catch (e) { /* ohne Zeitung */ }
}
function rufNewsBox() {
  const z = ['elite', 'buerger', 'arbeiter', 'presse'].map(k => [RUF_SHORT[k], RUF_AX[k].r[rufRank(rufGet(k))]]);
  z.unshift(['Alexander', rufTitle()]);
  z.push(['Untergrund', RUF_AX.unter.r[rufRank(rufGet('unter'))]]);
  try { window.dispatchEvent(new CustomEvent('vespera-news-box', { detail: { id: 'ruf', titel: 'Stimmung in Vespera', zeilen: z } })); } catch (e) { /* ohne Zeitung */ }
}
const RUF_KOMM = [
  [['Kommentar: Wer schützt Vespera vor seinem Beschützer?', 'Kommentar: Die Stadt ist kein Spielzeug'], 'Der Kurier fragt, ob ein einzelner Mann so viel Macht haben darf. {last} Vespera verdankt Herrn Alexander viel, aber Dankbarkeit ist kein Freibrief.'],
  [['Kommentar: Glanz und Schatten im Turm', 'Kommentar: Ein Gründer auf dem Prüfstand'], 'Die Stimmung in der Stadt ist gemischt. {last} Die Redaktion meint: Wer eine Stadt baut, muss sie auch pflegen.'],
  [['Kommentar: Der Herr von Vespera', 'Kommentar: Ein Abend wie jeder andere in Vespera'], 'Herr Alexander bleibt, was er ist: der Mann, ohne den es diese Stadt nicht gäbe. {last} Man darf gespannt sein, was er als Nächstes vorhat.'],
  [['Kommentar: Ein Glücksfall für Vespera', 'Kommentar: Was diese Stadt an ihm hat'], 'Wer abends über die Grande Promenade geht, sieht, was Herr Alexander geschaffen hat. {best} Die Redaktion zieht den Hut.'],
  [['Kommentar: Der beste Mann der Stadt', 'Kommentar: Vespera und sein Held'], 'Keine Stadt der Welt hat einen Gründer wie ihn. {best} Der Kurier verneigt sich, und ganz Vespera mit ihm.'],
];
function rufKommentar() {
  const r = rufRank(rufGet('presse')), K = RUF_KOMM[r], L = RUF.s.log.slice(0, 12);
  const sum = e => Object.entries(e.c).reduce((a, [k, v]) => a + (k === 'unter' || k === 'furcht' ? -v : v), 0);
  const best = L.slice().sort((a, b) => sum(b) - sum(a))[0], worst = L.slice().sort((a, b) => sum(a) - sum(b))[0];
  const best_ = best && sum(best) > 0 ? `Zuletzt: ${best.t}.` : '', last_ = worst && sum(worst) < 0 ? `Zuletzt: ${worst.t}.` : best_;
  const t = K[0][Math.floor(Math.random() * K[0].length)];
  rufNews(t, K[1].replace('{last}', last_).replace('{best}', best_).replace(/\s+/g, ' ').trim(), { rubrik: 'Meinung', prio: 3 });
}

/* ---------- Post und Einladungen ---------- */
// opts: [Knopf, Änderungen, Antwortsatz, { cost, fn, deed }]
const RUF_POST = {
  soiree: { ok: () => rufGet('elite') >= 55, cd: 3, from: 'Bankdirektor Varga', t: 'Soirée in der Villa Varga', x: 'Der Bankdirektor bittet Herrn Alexander zu einem kleinen Abend mit Streichquartett, Austern und den wichtigsten Familien der Stadt.',
    opts: [['Zusagen', { elite: 3, presse: 1 }, 'Ein glänzender Abend. Varga hat eine Rede auf Sie gehalten.'], ['Absagen', { elite: -1 }, 'Varga lässt ausrichten, er bedaure es sehr.']] },
  variete: { ok: () => rufGet('buerger') >= 45, cd: 3, from: 'Varieté Metropol', t: 'Premiere der neuen Revue', x: 'Das Metropol bittet in die Ehrenloge. Das ganze Lichterviertel wird da sein, und der Kurier schickt einen Fotografen.',
    opts: [['Hingehen', { buerger: 2, bew: 2, presse: 1 }, 'Stehende Ovationen, als Sie die Loge betreten.'], ['Absagen', {}, 'Die Loge bleibt leer, die Revue ist trotzdem ausverkauft.']] },
  sportfest: { ok: () => rufGet('arbeiter') >= 45, cd: 4, from: 'Turnverein Kesselschmiede', t: 'Arbeiter-Sportfest am Kneipenplatz', x: 'Tauziehen, Eisschießen und Bier aus der Brass Lantern. Der Verein sucht einen Schirmherrn für die Pokale.',
    opts: [['Schirmherr werden (8.000 Lm)', { arbeiter: 5, buerger: 1 }, 'Die Mannschaften tragen Ihren Namen auf den Trikots.', { cost: 8000 }], ['Absagen', { arbeiter: -1 }, 'Na ja. Dann eben ohne Pokale.']] },
  runde: { ok: () => rufGet('arbeiter') >= 25, cd: 3, from: 'Wirt der Brass Lantern', t: 'Eine Runde für das ganze Viertel?', x: 'Der Wirt schreibt: Die Frühschicht hat einen Rohrbruch in der Gießerei geflickt. Eine Runde aufs Haus des Herrn Alexander würde Wunder wirken.',
    opts: [['Eine Runde ausgeben (2.000 Lm)', { arbeiter: 3, personal: 0 }, 'In der Brass Lantern wird auf Sie angestoßen.', { cost: 2000 }], ['Nein', { arbeiter: -0.5 }, 'Der Wirt zuckt die Schultern.']] },
  interview: { ok: () => true, cd: 3, from: 'Redaktion des Vespera-Kurier', t: 'Bitte um ein Interview', x: 'Der Chefredakteur möchte mit Herrn Alexander über die Stadt, den Kristall und die Zukunft sprechen. Die Leser warten darauf.',
    opts: [['Offen und charmant', { presse: 4, bew: 1 }, 'Das Interview erscheint morgen auf der ersten Seite.', { fn: () => rufNews('Alexander im Gespräch: „Vespera gehört allen, die hier leben“', 'Im großen Interview mit dem Kurier spricht Herr Alexander über seine Stadt, den Kristall im Belmont und seine Pläne. Er wirkt nahbar und guter Laune.', { prio: 6 }) }],
      ['Kurz angebunden', { presse: -1.5, furcht: 1, elite: 0.5 }, 'Der Reporter notiert: „Herr Alexander hatte keine Zeit.“'],
      ['Spende an die Druckerei-Lehrlinge (5.000 Lm)', { presse: 6 }, 'Die Redaktion bedankt sich überschwänglich.', { cost: 5000 }]] },
  personalball: { ok: () => rufGet('personal') < 92, cd: 4, from: 'Oberkellner des Belmont', t: 'Ball für das Personal', x: 'Die Pagen, Zimmermädchen, Köche und Chauffeure fragen, ob sie nach Mitternacht im kleinen Saal tanzen dürfen. Mit einem Orchester wäre es ein Fest.',
    opts: [['Ausrichten, mit Orchester (15.000 Lm)', { personal: 8 }, 'Das Personal tanzt bis in die Polarnacht. Randolf hat angeblich auch getanzt.', { cost: 15000 }], ['Erlauben, ohne Kosten', { personal: 2 }, 'Das Personal bedankt sich.'], ['Ablehnen', { personal: -3 }, 'Enttäuschte Gesichter in der Küche.']] },
  polarclub: { ok: () => rufGet('elite') >= 85 && !RUF.s.deeds.polarclub, cd: 2, from: 'Der Polarclub', t: 'Ehrenmitgliedschaft im Polarclub', x: 'Der vornehmste Club Vespeas, gegründet von den Männern Ihrer Expedition, bietet Ihnen die Ehrenmitgliedschaft an: Kamin, Kartenzimmer und die besten Zigarren nördlich von Oslo.',
    opts: [['Annehmen', { elite: 4, presse: 1 }, 'Ihr Porträt hängt jetzt über dem Kamin des Clubs.', { deed: 'polarclub' }], ['Ablehnen', { elite: -2 }, 'Im Club ist man verstimmt.']] },
  schluessel: { ok: () => rufAnsehen() >= 85 && !RUF.s.deeds.schluessel, cd: 2, from: 'Bürgermeister Hollister', t: 'Der Goldene Schlüssel der Stadt', x: 'DER STADTRAT VON VESPERA MÖCHTE SEINEM GRÜNDER DEN GOLDENEN SCHLÜSSEL DER STADT ÜBERREICHEN STOP FEIERSTUNDE IM RATHAUS STOP',
    opts: [['Mit Dank annehmen', { buerger: 2, elite: 2, arbeiter: 1, presse: 3 }, 'Der Schlüssel liegt jetzt in der Vitrine des Penthouse.', { deed: 'schluessel', fn: () => rufNews('Goldener Schlüssel für Herrn Alexander', 'In einer Feierstunde überreichte Bürgermeister Hollister dem Gründer von Vespera den Goldenen Schlüssel der Stadt. Der Stadtrat erhob sich zum Applaus.', { prio: 8, rubrik: 'Stadt', ruf: 'Extrablatt! Der Goldene Schlüssel für Alexander!' }) }], ['Bescheiden ablehnen', { bew: 2, elite: -1 }, 'Der Bürgermeister ist gerührt von so viel Bescheidenheit.']] },
  gala: { ok: () => rufHas('gala') && GALA.dir && GALA.st !== 'laeuft', cd: 3, from: 'Direktor Hartmann, The Belmont', t: 'Gala zu Ihren Ehren', x: 'Der Grand Ballroom ist geschmückt, die Kapelle probt, der Stadtrat hat zugesagt. Wann immer Herr Alexander wünscht, beginnt die Gala.',
    opts: [['Heute Abend, bitte', { elite: 1 }, 'Direktor Hartmann erwartet Sie im Grand Ballroom des Belmont.', { fn: () => { try { startGala(); } catch (e) { console.warn('Ruf/Gala:', e); } } }], ['Ein andermal', {}, 'Hartmann: „Selbstverständlich, Herr Alexander.“']] },
  gewerkschaft: { ok: () => rufGet('arbeiter') < 35, cd: 2, from: 'Gewerkschaft der Kesselschmiede', t: 'Eine Bittschrift aus dem Arbeiterviertel', x: 'Die Arbeiter bitten um bessere Löhne und Kohle für den Winter. Sie schreiben höflich, aber die Stimmung ist gereizt.',
    opts: [['Alle knappen Löhne auf gerecht anheben', { arbeiter: 6, elite: -1 }, 'Im Viertel wird gejubelt.', { fn: () => { let n = 0; for (const id in KT.s.own) if ((KT.s.own[id].lohn ?? 1) === 0) { KT.s.own[id].lohn = 1; n++; } if (n) toast(`${n} ${n === 1 ? 'Firma zahlt' : 'Firmen zahlen'} jetzt gerechte Löhne`); } }],
      ['Kohle spenden (20.000 Lm)', { arbeiter: 4 }, 'Die Kohlenwagen rollen ins Viertel.', { cost: 20000 }], ['Ablehnen', { arbeiter: -3, unter: 4 }, 'Die Bittschrift landet bei den Anarchisten.']] },
  drohbrief: { ok: () => rufGet('unter') >= 60, cd: 3, from: 'Der Rote Kasimir', t: 'Ein Brief ohne Absender', x: '„Deine goldenen Türme stehen auf unseren Rücken, Alexander. Bald holen wir uns die Stadt zurück.“ Mit rotem Stern unterschrieben.',
    opts: [['Der Polizei übergeben', { presse: 1, unter: -2, buerger: 1 }, 'Die Polizei verdoppelt die Streifen.'], ['Zerreißen', { furcht: 1 }, 'Ein Stück Papier, mehr nicht.']] },
};
function rufPostAdd(k) {
  const s = RUF.s; if (s.post.some(p => p.k === k) || s.post.length >= 4) return false;
  s.post.unshift({ id: s.nid++, k, day: KT.s.day }); s.cd[k] = KT.s.day + (RUF_POST[k].cd || 3);
  RUF.dirty = true; return true;
}
function rufPostDay() {
  const s = RUF.s, day = KT.s.day;
  // alte Post verfällt nach drei Tagen
  s.post = s.post.filter(p => { if (day - p.day < 3) return true; if (p.k === 'soiree' || p.k === 'polarclub') rufAdd({ elite: -0.5 }, 'Einladung unbeantwortet', { quiet: true }); return false; });
  const can = Object.keys(RUF_POST).filter(k => { try { return RUF_POST[k].ok() && !(s.cd[k] > day) && !s.post.some(p => p.k === k); } catch (e) { return false; } });
  // Wichtiges zuerst: Schlüssel, Polarclub, Gewerkschaft, Drohbrief
  const prio = ['gewerkschaft', 'drohbrief', 'schluessel', 'polarclub'].filter(k => can.includes(k));
  const pickK = prio.length ? prio[0] : can.length && Math.random() < 0.6 ? can[Math.floor(Math.random() * can.length)] : null;
  if (pickK && rufPostAdd(pickK)) { const P = RUF_POST[pickK]; setTimeout(() => toast(`Post für Alexander: ${P.t} · Ö öffnet`), 5200); rufHud(true); }
}
function rufAnswer(id, i) {
  const s = RUF.s, p = s.post.find(x => x.id === id); if (!p) return;
  const P = RUF_POST[p.k], O = P && P.opts[i]; if (!O) return;
  const [label, ch, line, ex = {}] = O;
  if (ex.cost) { if (KT.s.cash < ex.cost) { toast('Dafür reicht das Bargeld nicht'); return; } ktCash(-ex.cost, P.t); }
  s.post = s.post.filter(x => x !== p);
  if (ex.deed) s.deeds[ex.deed] = KT.s.day;
  rufAdd(ch, P.t + ': ' + label.replace(/ \(.*\)$/, ''), { key: 'post' + p.id });
  if (ex.fn) try { ex.fn(); } catch (e) { console.warn('Ruf:', e); }
  if (line) toast(line);
  RUF.dirty = true; rufLinesStep(); rufHud(true); rufRender();
}

/* ---------- Beobachten ---------- */
function rufKindGroup(pd) { const k = pd && pd.a ? pd.a.kind : pd && pd.kind; return rufGroupOf(k); }
const rufFoe = pd => !!(pd && pd.gg);
function rufOnGegner(d) {
  if (!d || !RUF.ready) return;
  if (d.was === 'besiegt') rufAdd({ buerger: 0.6, bew: 0.5, presse: 0.3, unter: d.role === 'anarchist' || d.role === 'anfuehrer' ? -0.8 : 0 }, d.role === 'anarchist' ? 'Anarchisten besiegt' : 'Einen Verbrecher besiegt', { key: 'besiegt', faint: 0.8 });
  else if (d.was === 'gefasst') rufAdd({ buerger: 0.8, presse: 0.4 }, 'Der Polizei übergeben', { key: 'gefasst', faint: 0.8 });
  else if (d.was === 'versteck') rufAdd({ buerger: 2, elite: 1, presse: 2, unter: -7 }, 'Versteck ausgehoben' + (d.name ? ': ' + d.name : ''));
  else if (d.was === 'boss') { RUF.s.deeds.kasimir = KT.s.day; rufAdd({ buerger: 5, elite: 3, arbeiter: 2, presse: 4, bew: 4, furcht: 1, unter: -18 }, 'Den Roten Kasimir gefasst'); rufLinesStep(); }
}
function rufOnGala(d) {
  if (!d || !RUF.ready) return;
  const ph = d.phase;
  if (ph === 'stern') rufAdd({ elite: 2, presse: 1 }, 'Goldener Stern von Vespera');
  else if (ph === 'rede') {
    const R = [[{ buerger: 2, arbeiter: 1, bew: 1 }, 'Dankesrede auf der Gala'], [{ elite: 2, buerger: 1 }, 'Rede über die Vision für Vespera'], [{ bew: 1, presse: 0.5 }, 'Kurze Rede auf der Gala'], [{ buerger: 2, arbeiter: 2, elite: -0.5 }, 'Großzügige Rede: Geschenke für die Stadt']][d.rede];
    if (R) rufAdd(R[0], R[1]);
  } else if (ph === 'champagner') rufAdd({ elite: 1, personal: 1 }, 'Champagner für alle im Belmont');
  else if (ph === 'ende') { RUF.s.deeds.gala = (RUF.s.deeds.gala | 0) + 1; rufAdd({ elite: 3, presse: 3, bew: 2 }, 'Gala im Belmont'); rufLinesStep(); }
}
function rufOnTat(d) {
  if (!d || !RUF.ready) return;
  RUF.lastTat = { t: performance.now() / 1000, why: d.art === 'stiftung' ? 'Stiftung: ' + d.titel : d.art === 'aufgabe' ? 'Aufgabe: ' + d.titel : d.art === 'kauf' ? 'Gekauft: ' + d.titel : d.titel };
  if (d.art === 'stiftung') rufAdd({ presse: 2, bew: 1.5, unter: -2 }, 'Stiftung: ' + d.titel);
  else if (d.art === 'aufgabe') rufAdd({ presse: 0.4, bew: 0.4 }, 'Aufgabe: ' + d.titel, { key: 'aufgabe' });
}
// Energiestoß (energy.js): wen hat er getroffen?
function rufOnHits(hits) {
  if (!RUF.ready || !hits || !hits.length) return;
  let civ = 0, foe = 0, dmg = 0; const grp = {};
  for (const h of hits) {
    if (h.kind === 'ped') { if (rufFoe(h.ref)) foe++; else { civ++; const g = rufKindGroup(h.ref); grp[g] = (grp[g] || 0) + 1; } }
    else if (h.kind === 'torn' || h.kind === 'car') dmg++;
  }
  if (civ) {
    const ch = { furcht: Math.min(4, civ), presse: -0.6 };
    for (const g in grp) ch[g] = (ch[g] || 0) - Math.min(3, 0.8 * grp[g]);
    rufAdd(ch, civ > 1 ? 'Energiestoß in die Menge' : 'Einen Passanten umgestoßen', { key: 'stossciv' });
    if (civ >= 3) rufNews(rufGet('presse') >= 60 ? 'Ein stürmischer Abend in der Stadt' : 'Passanten von Alexanders Kräften umgeworfen', rufGet('presse') >= 60 ? 'Ein Energiestoß von Herrn Alexander warf mehrere Passanten von den Füßen. Verletzt wurde niemand; man nahm es mit Humor.' : 'Mehrere Bürger wurden von einem Energiestoß zu Boden geworfen. Der Kurier fragt: Muss das sein, mitten in der Stadt?', { key: 'stoss', prio: 5, rubrik: 'Stadt' });
  }
  if (foe) rufAdd({ bew: Math.min(1.5, 0.4 * foe) }, 'Gegner mit Energie zurückgeworfen', { key: 'stossfoe', quiet: true });
  if (dmg && !GEGNER.ev) rufAdd({ buerger: -Math.min(1.5, 0.25 * dmg), presse: -0.2 }, 'Schäden in der Stadt', { key: 'schaden' });
}
// Telekinese losgelassen (powers.js)
function rufOnLetGo(H, throwIt) {
  if (!RUF.ready || !H || !throwIt) return;
  if (H.kind === 'ped') {
    const pd = H.pd;
    if (rufFoe(pd)) { rufAdd({ furcht: 0.6, bew: 0.6 }, 'Einen Gegner durch die Luft geschleudert', { key: 'wurffoe' }); return; }
    const g = rufKindGroup(pd), ch = { furcht: 2.5, presse: -1, buerger: -1 }; ch[g] = (ch[g] || 0) - 1.5;
    rufAdd(ch, g === 'personal' ? 'Einen Angestellten geworfen' : 'Einen Bürger durch die Luft geworfen', { key: 'wurfciv' });
    rufNews(rufGet('presse') >= 60 ? 'Unfreiwilliger Flug über dem Pflaster' : 'Bürger von Alexander durch die Luft geworfen', rufGet('presse') >= 60 ? 'Ein Passant erlebte heute einen kurzen Flug, mit freundlicher Unterstützung von Herrn Alexander. Er landete wohlbehalten und wollte es seiner Frau sofort erzählen.' : 'Augenzeugen berichten, Herr Alexander habe einen Bürger mit seinen Kräften gepackt und durch die Luft geschleudert. Die Redaktion fragt: Wo endet der Spaß?', { key: 'wurf', prio: 5, rubrik: 'Stadt' });
  } else if (H.kind === 'car') {
    if (GEGNER.ev) rufAdd({ bew: 0.3, furcht: 0.4 }, 'Einen Wagen geschleudert', { key: 'wagenwurf' });
    else rufAdd({ buerger: -0.8, furcht: 0.8, presse: -0.4 }, 'Einen Wagen durch die Stadt geschleudert', { key: 'wagenwurf' });
  } else if (H.kind === 'loose' && H.B && /Laterne|Poller|Bank|Kiosk|Säule|Uhr|Mast|Fahne|Litfa|Brunnen/i.test(String(H.B.name || ''))) rufAdd({ buerger: -0.4 }, 'Stadtmöbel durch die Luft geworfen', { key: 'moebel' });
}
// regelmäßig: Telekinese, Flug, Landung, Druckwelle, Zahlen aus gegner.js und anfuehrer.js, Arbeiterviertel
function rufWatch(dt) {
  const W = RUF.w, p = player.p;
  const tk = POWERS.tk;
  if (tk && tk !== W.tk) {
    if (tk.kind === 'ped' && !rufFoe(tk.pd)) { const g = rufKindGroup(tk.pd), ch = { furcht: 1.2, bew: 0.4 }; ch[g] = -0.4; rufAdd(ch, g === 'personal' ? 'Einen Angestellten schweben lassen' : 'Einen Bürger schweben lassen', { key: 'heben' }); }
    else if (tk.kind === 'car') rufAdd({ bew: 0.3, furcht: 0.4 }, 'Ein Automobil gehoben', { key: 'wagen', quiet: true });
  }
  W.tk = tk || null;
  // Flug über der Stadt: alle 30 s etwas Bewunderung (still)
  if (player.fly && p.y < 160 && Math.hypot(p.x, p.z) < 900) { if ((W.flyT = (W.flyT || 0) + dt) > 30) { W.flyT = 0; rufAdd({ bew: 0.5, furcht: 0.15 }, 'Flug über der Stadt', { key: 'flug', quiet: true }); } }
  if (POWERS.hero && POWERS.hero !== W.hero) { W.hero = POWERS.hero; if (p.y < 60) rufAdd(GEGNER.ev ? { bew: 0.5, furcht: 0.5 } : { bew: 0.4, furcht: 0.6, buerger: -0.15 }, 'Heldenlandung', { key: 'landung', quiet: !!GEGNER.ev }); }
  // Druckwelle: wer stand in der Nähe?
  if ((KRAEFTE.cd || 0) > (W.cd || 0) + 0.5) {
    let n = 0; for (const pd of peds) { const a = pd.a; if (!a || !a.on || rufFoe(pd)) continue; const e = a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < 144 && Math.abs(e[13] - p.y) < 4) n++; }
    if (n) rufAdd({ furcht: Math.min(3, 0.3 * n + 0.3), buerger: -Math.min(2, 0.25 * n) }, 'Druckwelle zwischen Passanten', { key: 'welle' });
  }
  W.cd = KRAEFTE.cd || 0;
  // gegner.js: Bomben, entkommene Täter; anfuehrer.js: Kasimir entkommen
  const S = GEGNER.stats;
  if (!W.g) W.g = { ...S };
  else {
    const d = k => (S[k] || 0) - (W.g[k] || 0);
    if (d('entschaerft') > 0) rufAdd({ buerger: 2, bew: 1.5, presse: 1, unter: -2 }, 'Bombe entschärft');
    if (d('explodiert') > 0) rufAdd({ buerger: -1.5, presse: -1.2, unter: 3 }, 'Eine Bombe ist explodiert');
    if (d('entkommen') > 0) rufAdd({ buerger: -0.6, unter: 0.5 }, 'Ein Täter ist entkommen', { key: 'entkommen' });
    W.g = { ...S };
  }
  const be = BOSS.stats ? BOSS.stats.entkommen || 0 : 0;
  if (W.be != null && be > W.be) rufAdd({ presse: -1, unter: 4 }, 'Kasimir ist entkommen');
  W.be = be;
  // Arbeiterviertel: wie man ihn empfängt
  RUF.distT -= dt;
  if (RUF.distT <= 0) {
    RUF.distT = 1;
    let dn = ''; try { dn = districtAt(p.x, p.z, p.y)[0]; } catch (e) { dn = ''; }
    const work = dn === 'Arbeiterviertel' || dn === 'Industriegebiet Ost';
    RUF.inWork = work;
    if (work && RUF.dist !== 'work' && !player.fly && (W.workT || 0) <= 0) {
      const A = rufGet('arbeiter');
      if (A < 30) { toast('Im Arbeiterviertel wird es still, wenn Sie kommen. Die Leute sind unzufrieden.'); W.workT = 180; }
      else if (A >= 75) { toast('Das Arbeiterviertel grüßt seinen Patron'); W.workT = 180; }
    }
    RUF.dist = work ? 'work' : 'city';
    W.workT = (W.workT || 0) - 1;
  }
}
// Kontor: Änderungen von außen (Stiftungen, Aufgaben, Löhne) erkennen, damit der Toast sie zeigt
function rufSnap() {
  for (const k of ['elite', 'buerger', 'arbeiter']) {
    const v = KT.s.rep[k]; if (typeof v !== 'number') continue;
    const d = v - (RUF.snap[k] ?? v); RUF.snap[k] = v;
    if (Math.abs(d) > 0.05) {
      const L = RUF.lastTat, why = L && performance.now() / 1000 - L.t < 4 ? L.why : 'Kontor';
      const done = { [k]: d }; rufQueue(done, why); rufLog(done, why); RUF.dirty = true;
    }
  }
}
// langsames Zurückschwingen, Untergrund und Takt der Gegner (alle 10 s)
function rufSlow() {
  const s = RUF.s;
  s.furcht += (25 - s.furcht) * 0.015;
  s.bew += (65 - s.bew) * 0.005;
  s.presse += (50 + (rufAnsehen() - 50) * 0.4 - s.presse) * 0.006;
  const tgt = clamp(75 - 0.7 * rufGet('arbeiter') + 0.2 * (s.furcht - 30) - (s.deeds.kasimir ? 10 : 0) + (rufHas('arbeiter') ? -8 : 0), 5, 95);
  s.unter += (tgt - s.unter) * 0.012;
  RUF.dirty = true;
  rufPace();
}
function rufPace() {
  const U = rufGet('unter');
  let an = clamp(0.1 + 1.6 * U / 100, 0.1, 1.7);
  if (U < 15) an = 0.1;
  if (RUF.inWork && rufGet('arbeiter') < 30) an *= 1.4;
  GEGNER.rufAnar = an;
  GEGNER.rufPace = (rufHas('furcht') ? 1.25 : 1) * (rufAnsehen() >= 82 ? 1.1 : 1) * (U >= 70 ? 0.8 : 1);
}
// neuer Geschäftstag (Kontor): Personal nach Löhnen, Streik, Vorrechte, Post, Zeitung
function rufDay() {
  const s = RUF.s;
  if (s.day === KT.s.day) return; s.day = KT.s.day;
  const L = ['belmont', 'villa', 'imperial'].filter(id => KT.s.own[id]).map(id => KT.s.own[id].lohn ?? 1);
  if (L.length) { const avg = L.reduce((a, b) => a + b, 0) / L.length, tgt = 52 + 20 * avg, d = (tgt - s.personal) * 0.25; if (Math.abs(d) > 0.3) rufAdd({ personal: d }, d > 0 ? 'Gute Löhne im Belmont und in der Villa' : 'Knappe Löhne im Belmont und in der Villa', { key: 'lohnP' }); }
  if (rufHas('personal')) rufAdd({ elite: 0.5, presse: 0.3 }, 'Das Personal erzählt nur Gutes', { key: 'tratsch', quiet: true });
  if (rufGet('furcht') > 75 && rufGet('bew') < 55) rufAdd({ buerger: -0.8 }, 'Die Stadt hat Angst vor Alexander', { key: 'angst' });
  // Streik bei schlechtem Ruf unter Arbeitern
  if (rufGet('arbeiter') < 30 && Math.random() < 0.35) {
    const i = EVENTS.findIndex(E => E.streik);
    if (i >= 0 && !KT.s.ev.some(e => e.i === i)) {
      KT.s.ev.push({ i, d: 2 }); toast('Streik! Die Arbeiter der Gießerei legen die Arbeit nieder');
      rufNews('Streik in der Gießerei', 'Die Arbeiter legen die Arbeit nieder. Sie fordern bessere Löhne und Kohle für den Winter. Die Gewerkschaft der Kesselschmiede spricht von einem „letzten Warnschuss“.', { prio: 6, rubrik: 'Wirtschaft' });
      rufAdd({ elite: -0.5, unter: 2 }, 'Streik im Arbeiterviertel');
    }
  }
  rufPostDay();
  rufNewsBox();
  if (KT.s.day % 2 === 0) rufKommentar();
}
// Titel und Ränge: Zeitung und Toast bei Wechsel
function rufRanks(init) {
  const s = RUF.s, t = rufTitle();
  if (!init && s.title && t !== s.title) {
    const up = RUF_ORDER(t) > RUF_ORDER(s.title);
    setTimeout(() => toast(`Neuer Titel: ${t}`), 600);
    rufNews(`Umfrage des Kuriers: Vespera nennt Alexander „${t}“`, up ? 'Die Leser des Kuriers sind sich einig: Der Gründer der Stadt steht so gut da wie lange nicht. In den Cafés der Grande Promenade spricht man von nichts anderem.' : 'Eine Umfrage des Kuriers zeigt: Die Stimmung gegenüber dem Gründer der Stadt hat sich gewandelt. In den Cafés wird lebhaft gestritten.', { prio: 6, key: 'titel', every: 120 });
  }
  s.title = t;
  for (const k of ['elite', 'buerger', 'arbeiter', 'presse', 'personal', 'unter']) {
    const r = rufRank(rufGet(k)), r0 = s.ranks[k];
    if (!init && r0 != null && r !== r0 && k !== 'unter') {
      const up = r > r0;
      rufNews(up ? `${RUF_SHORT[k]}: Alexander ist „${RUF_AX[k].r[r]}“` : `${RUF_SHORT[k]}: Die Stimmung kippt`, up ? `Der Kurier hat sich umgehört: Bei ${k === 'elite' ? 'der feinen Gesellschaft' : k === 'presse' ? 'den Zeitungsleuten' : k === 'personal' ? 'seinem Personal' : 'den ' + RUF_SHORT[k] + 'n'} steht Herr Alexander höher im Kurs denn je.` : `Bei ${k === 'elite' ? 'der feinen Gesellschaft' : k === 'presse' ? 'den Zeitungsleuten' : k === 'personal' ? 'seinem Personal' : 'den ' + RUF_SHORT[k] + 'n'} hat Herr Alexander an Ansehen verloren. Man nennt ihn dort „${RUF_AX[k].r[r]}“.`, { prio: 4, key: 'rang' + k, every: 180, rubrik: k === 'arbeiter' ? 'Stadt' : 'Alexander' });
    }
    if (!init && k === 'unter' && r0 != null && r !== r0 && r >= 3 && r > r0) rufNews('Der Untergrund wird stärker', 'Die Polizei warnt: Der Rote Kasimir findet neue Anhänger. Flugblätter tauchen in den Gassen des Arbeiterviertels auf.', { prio: 5, rubrik: 'Polizei', key: 'unter', every: 300 });
    s.ranks[k] = r;
  }
}
const RUF_ORDER = t => { for (const w in RUF_TITLES) { const i = RUF_TITLES[w].indexOf(t); if (i >= 0) return i * 3 + (w === 'bew' ? 2 : w === 'gea' ? 1 : 0); } return 0; };

/* ---------- HUD: Titel oben rechts und kleiner Toast ---------- */
function rufCss() {
  const st = document.createElement('style');
  st.textContent = `
#ktHud .ruf{pointer-events:auto;cursor:pointer;font:400 13px/1.1 var(--display);letter-spacing:.12em;color:var(--gold-hi,#f6dc9a);background:var(--panel,rgba(5,16,24,.72));border:1px solid rgba(217,178,106,.55);padding:6px 10px 4px;text-align:right;white-space:nowrap}
#ktHud .ruf em{font-style:normal;color:var(--gold,#d9b26a);margin-right:7px}
#ktHud .ruf small{font:600 10px/1 var(--body);letter-spacing:.3em;color:var(--muted,#b9ab8f);margin-left:8px}
#ktHud .ruf i{font-style:normal;margin-left:7px;color:#7fe3d6}
#ktHud .rufT{font:400 12px/1.45 var(--body);letter-spacing:.06em;color:var(--ink,#efe6d2);background:var(--panel,rgba(5,16,24,.8));border:1px solid rgba(217,178,106,.4);border-right:3px solid var(--gold,#d9b26a);padding:6px 10px 4px;text-align:right;opacity:0;transform:translateX(12px);transition:opacity .35s,transform .35s;max-width:min(320px,60vw)}
#ktHud .rufT.on{opacity:1;transform:none}
#ktHud .rufT b{font-weight:600;color:var(--gold-hi,#f6dc9a)}
#ktHud .rufT .up{color:#7fe3d6}#ktHud .rufT .dn{color:#f0a070}
#ruf{position:fixed;z-index:17;left:50%;top:50%;transform:translate(-50%,-50%);width:min(960px,calc(100% - 24px));height:min(680px,calc(100% - 24px));display:grid;grid-template-rows:auto 1fr auto;background:linear-gradient(180deg,rgba(6,20,28,.96),rgba(4,12,18,.97));border:1px solid rgba(217,178,106,.7);outline:1px solid rgba(217,178,106,.22);outline-offset:4px;color:var(--ink,#efe6d2);font:400 14px/1.45 var(--body);box-shadow:0 20px 60px rgba(0,0,0,.6)}
#ruf header{display:flex;gap:18px;align-items:center;padding:16px 22px 12px;border-bottom:1px solid rgba(217,178,106,.35);background:linear-gradient(90deg,rgba(217,178,106,.08),transparent 60%)}
#ruf header .med{flex:none;width:74px;height:74px}
#ruf header small{display:block;font:600 11px/1 var(--body);letter-spacing:.36em;text-transform:uppercase;color:var(--gold,#d9b26a)}
#ruf header h2{margin:6px 0 4px;font:400 28px/1.05 var(--display);letter-spacing:.08em;color:var(--gold-hi,#f6dc9a);text-shadow:0 0 16px rgba(246,220,154,.3)}
#ruf header p{margin:0;font-size:13px;letter-spacing:.08em;color:var(--muted,#b9ab8f)}
#ruf header p b{color:var(--gold-hi,#f6dc9a);font-weight:600}
#ruf main{overflow:auto;padding:14px 22px 18px;display:grid;grid-template-columns:1.15fr 1fr;gap:16px;align-content:start}
#ruf section{border:1px solid rgba(217,178,106,.28);padding:10px 14px 12px;background:rgba(255,255,255,.02)}
#ruf section.wide{grid-column:1/-1}
#ruf h3{margin:0 0 8px;font:400 15px/1.2 var(--display);letter-spacing:.16em;color:var(--gold-hi,#f6dc9a);text-transform:uppercase}
#ruf h3::after{content:'';display:block;height:1px;margin-top:6px;background:linear-gradient(90deg,rgba(217,178,106,.7),transparent)}
#ruf .ax{display:grid;grid-template-columns:1fr auto;gap:2px 10px;margin:8px 0 10px}
#ruf .ax b{font-weight:600;letter-spacing:.08em}
#ruf .ax span{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted,#b9ab8f)}
#ruf .ax em{font-style:normal;color:var(--gold-hi,#f6dc9a);text-align:right;font:400 14px/1.2 var(--display);letter-spacing:.06em}
#ruf .ax .v{font-variant-numeric:tabular-nums;text-align:right;color:var(--muted,#b9ab8f);font-size:12px}
#ruf .bar{grid-column:1/-1;position:relative;height:7px;background:rgba(255,255,255,.07);border:1px solid rgba(217,178,106,.25)}
#ruf .bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8a6a32,#d9b26a 60%,#f6dc9a)}
#ruf .bar.t i{background:linear-gradient(90deg,#1f5f5a,#4fb8ae,#9ff0e6)}
#ruf .bar.c i{background:linear-gradient(90deg,#6b3a22,#c46f44,#f0a070)}
#ruf .bar u{position:absolute;top:-3px;bottom:-3px;width:1px;background:rgba(246,220,154,.35)}
#ruf .duo{display:grid;grid-template-columns:auto 1fr 1fr auto;align-items:center;gap:8px;margin:6px 0}
#ruf .duo .bar{grid-column:auto}
#ruf .duo .l .bar i{left:auto;right:0}
#ruf .s{color:var(--muted,#b9ab8f);font-size:12px}
#ruf ul{margin:0;padding:0;list-style:none}
#ruf li{padding:5px 0;border-bottom:1px solid rgba(217,178,106,.12)}
#ruf li:last-child{border-bottom:0}
#ruf li.off{opacity:.45}
#ruf li .k{color:var(--gold,#d9b26a);margin-right:6px}
#ruf li.warn b{color:#f0a070}
#ruf .log li{display:flex;justify-content:space-between;gap:12px;font-size:13px}
#ruf .log .c{white-space:nowrap;font-variant-numeric:tabular-nums}
#ruf .up{color:#7fe3d6}#ruf .dn{color:#f0a070}
#ruf .post{border:1px solid rgba(217,178,106,.45);background:linear-gradient(180deg,rgba(217,178,106,.07),rgba(217,178,106,.02));padding:10px 12px;margin-bottom:10px}
#ruf .post small{font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold,#d9b26a)}
#ruf .post b{display:block;margin:3px 0 4px;font:400 17px/1.2 var(--display);letter-spacing:.06em;color:var(--gold-hi,#f6dc9a)}
#ruf .post p{margin:0 0 8px;font-size:13px}
#ruf .btns{display:flex;flex-wrap:wrap;gap:6px}
#ruf button{font:600 12px/1 var(--body);letter-spacing:.12em;color:var(--gold-hi,#f6dc9a);background:rgba(217,178,106,.08);border:1px solid rgba(217,178,106,.55);padding:8px 12px 6px;cursor:pointer}
#ruf button:hover{background:rgba(217,178,106,.2)}
#ruf table{width:100%;border-collapse:collapse;font-size:13px}
#ruf td{padding:3px 4px;border-bottom:1px solid rgba(217,178,106,.1)}
#ruf td:last-child{text-align:right;font-variant-numeric:tabular-nums}
#ruf footer{display:flex;justify-content:space-between;align-items:center;padding:10px 22px;border-top:1px solid rgba(217,178,106,.35);font-size:12px;letter-spacing:.12em;color:var(--muted,#b9ab8f)}
@media (max-width:720px){#ruf main{grid-template-columns:1fr;padding:10px 12px}#ruf header{padding:12px 14px 10px;gap:12px}#ruf header .med{width:54px;height:54px}#ruf header h2{font-size:21px}}
`;
  document.head.append(st);
}
const RUF_MED = `<svg class="med" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="rufG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc9a"/><stop offset="1" stop-color="#9c7a3c"/></linearGradient></defs>
<g stroke="url(#rufG)" fill="none">${Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (1 + i / 12); return `<line x1="${50 + Math.cos(a) * 20}" y1="${62 + Math.sin(a) * 20}" x2="${50 + Math.cos(a) * 44}" y2="${62 + Math.sin(a) * 44}" stroke-width="${i % 2 ? 1 : 2}"/>`; }).join('')}
<path d="M10 62 H90" stroke-width="2"/><circle cx="50" cy="62" r="16" stroke-width="2"/><circle cx="50" cy="62" r="11" stroke-width="1"/><path d="M50 52 L56 62 L50 72 L44 62 Z" fill="url(#rufG)" stroke="none"/><path d="M30 80 H70 M36 86 H64" stroke-width="1.5"/></g></svg>`;
function rufDom() {
  rufCss();
  const hud = $('ktHud');
  if (hud && !hud.querySelector('.ruf')) {
    const b = document.createElement('div'); b.className = 'ruf'; b.title = 'Ruf und Ansehen (Taste Ö)';
    b.addEventListener('click', () => { if (playing && !RUF.open && !DINE.menuOpen) rufOpen(); });
    const t = document.createElement('div'); t.className = 'rufT';
    const cash = hud.querySelector('.cash'); if (cash && cash.nextSibling) hud.insertBefore(b, cash.nextSibling); else hud.append(b);
    hud.insertBefore(t, b.nextSibling);
  }
  const el = document.createElement('div'); el.id = 'ruf'; el.hidden = true;
  el.innerHTML = `<header>${RUF_MED}<div style="flex:1"><small>Ruf und Ansehen</small><h2></h2><p></p></div><button type="button" data-act="close">Schließen</button></header><main></main><footer><span>Ö oder Esc schließt</span><span class="s">Gesellschaft, Bürger und Arbeiter zählen auch im Kontor (I)</span></footer>`;
  el.addEventListener('click', rufClick);
  el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  el.addEventListener('mousedown', e => e.stopPropagation());
  document.body.append(el);
}
export function rufHud(force) {
  const h = $('ktHud'); if (!h || !RUF.ready) return;
  const b = h.querySelector('.ruf'); if (!b) return;
  const t = rufTitle(), n = RUF.s.post.length, key = t + '|' + n;
  if (!force && b.dataset.k === key) return;
  b.dataset.k = key;
  b.innerHTML = `<em>✦</em>${esc(t)}${n ? `<i>✉ ${n}</i>` : ''}<small>${isTouch ? 'RUF' : 'Ö · RUF'}</small>`;
}
function rufToastStep(dt) {
  const h = $('ktHud'), T = h && h.querySelector('.rufT'); if (!T) return;
  if (RUF.toastT > 0 && (RUF.toastT -= dt) <= 0) T.classList.remove('on');
  if (RUF.qT > 0 && (RUF.qT -= dt) <= 0 && RUF.q.length) {
    const items = RUF.q.splice(0, 3), rows = [];
    for (const q of items) {
      const parts = Object.entries(q.c).filter(([, d]) => Math.abs(d) >= 0.35).map(([k, d]) => { const good = k === 'unter' || k === 'furcht' ? d < 0 : d > 0; return `<span class="${good ? 'up' : 'dn'}">${RUF_SHORT[k]} ${fmD(d)}</span>`; });
      if (parts.length) rows.push(`<b>${esc(q.why)}</b><br>${parts.join(' · ')}`);
    }
    RUF.q.length = 0;
    if (rows.length) { T.innerHTML = rows.join('<br>'); T.classList.add('on'); RUF.toastT = 4.2; }
  }
}

/* ---------- Das Buch ---------- */
export function rufOpen() {
  if (!RUF.ready) return;
  RUF.open = true; DINE.menuOpen = true; DINE.onPick = null;
  $('ruf').hidden = false; rufRender();
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* egal */ }
}
export function rufClose() {
  if (!RUF.open) return;
  RUF.open = false; DINE.menuOpen = false; $('ruf').hidden = true;
  if (!isTouch && playing && !paused) tryLock();
}
function rufClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'close') rufClose();
  else if (a === 'post') rufAnswer(+b.dataset.id, +b.dataset.i);
}
const rufBar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${v.toFixed(1)}%"></i>${[20, 40, 60, 80].map(x => `<u style="left:${x}%"></u>`).join('')}</div>`;
function rufTrend(k) { let d = 0; for (const e of RUF.s.log.slice(0, 10)) d += e.c[k] || 0; return Math.abs(d) < 0.5 ? '' : ` <span class="${(k === 'unter' || k === 'furcht' ? d < 0 : d > 0) ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}</span>`; }
function rufAxis(k, cls) { const v = rufGet(k), A = RUF_AX[k]; return `<div class="ax"><b>${A.n}${rufTrend(k)}</b><em>${A.r[rufRank(v)]}</em><span>${A.s}</span><span class="v">${Math.round(v)} / 100</span>${rufBar(v, cls)}</div>`; }
function rufRender() {
  const el = $('ruf'); if (!el || el.hidden || !RUF.ready) return;
  const s = RUF.s, A = rufAnsehen();
  el.querySelector('header h2').textContent = rufTitle();
  el.querySelector('header p').innerHTML = `Ansehen <b>${Math.round(A)}</b> / 100 · ${RUF_WESEN[rufWesen()]} · Tag ${KT.s.day}`;
  const pc = rufAttP('buerger'), pa = rufAttP('arbeiter'), pe = rufAttP('elite'), pct = x => Math.round(x * 100) + ' %';
  const posts = s.post.map(p => { const P = RUF_POST[p.k]; return `<div class="post"><small>${esc(P.from)} · Tag ${p.day}</small><b>${esc(P.t)}</b><p>${esc(P.x)}</p><div class="btns">${P.opts.map((o, i) => `<button type="button" data-act="post" data-id="${p.id}" data-i="${i}">${esc(o[0])}</button>`).join('')}</div></div>`; }).join('') || '<p class="s">Keine Post. Briefe und Einladungen kommen mit den Geschäftstagen, je nach Ruf.</p>';
  const warn = RUF_WARN.filter(w => w.ok());
  const unter = rufGet('unter'), an = GEGNER.rufAnar ?? 1, kas = BOSS.st === 'gefasst' ? 'sitzt hinter Gittern' : 'ist auf freiem Fuß';
  const disc = Object.keys(POSTS).map(pid => { let d = 0; try { d = ktRepDisc(pid); } catch (e) { d = 0; } return `<tr><td>${esc(POSTS[pid].n)}</td><td class="${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '−' : '+'}${Math.abs(d * 100).toFixed(1).replace('.', ',')} %</td></tr>`; }).join('');
  const log = s.log.slice(0, 14).map(e => { const c = Object.entries(e.c).filter(([, d]) => Math.abs(d) >= 0.2).map(([k, d]) => `<span class="${(k === 'unter' || k === 'furcht' ? d < 0 : d > 0) ? 'up' : 'dn'}">${RUF_SHORT[k]} ${fmD(d)}</span>`).join(' · '); return c ? `<li><span>${esc(e.t)}${e.n > 1 ? ` <span class="s">×${e.n}</span>` : ''} <span class="s">· Tag ${e.d}</span></span><span class="c">${c}</span></li>` : ''; }).join('') || '<li class="s">Noch nichts geschehen.</li>';
  const m = el.querySelector('main'), sc = m.scrollTop;
  m.innerHTML = `
  <section><h3>Die Gruppen</h3>${['elite', 'buerger', 'arbeiter', 'presse', 'personal'].map(k => rufAxis(k)).join('')}</section>
  <section><h3>Furcht und Bewunderung</h3>
    <div class="duo"><b>Furcht</b><div class="l">${rufBar(rufGet('furcht'), 'c')}</div>${rufBar(rufGet('bew'), 't')}<b>Bewunderung</b></div>
    <div class="duo s"><span>${Math.round(rufGet('furcht'))}</span><span>${RUF_AX.furcht.r[rufRank(rufGet('furcht'))]}</span><span style="text-align:right">${RUF_AX.bew.r[rufRank(rufGet('bew'))]}</span><span>${Math.round(rufGet('bew'))}</span></div>
    <p class="s">Wer seine Kräfte für die Stadt einsetzt, wird bewundert. Wer Bürger herumwirft oder Energie in die Menge stößt, wird gefürchtet. Die Furcht legt sich mit der Zeit.</p>
    <h3 style="margin-top:12px">So begegnet man Ihnen</h3>
    <table><tr><td>Bürger</td><td>${pct(pc.bew)} bewundernd · ${pct(pc.neid + pc.skep)} neidisch oder skeptisch · ${pct(pc.furcht)} ängstlich</td></tr>
    <tr><td>Gesellschaft</td><td>${pct(pe.bew)} bewundernd · ${pct(pe.neid)} neidisch · ${pct(pe.furcht)} ängstlich</td></tr>
    <tr><td>Arbeiter</td><td>${pct(pa.resp + pa.bew)} respektvoll · ${pct(pa.skep)} skeptisch · ${pct(pa.furcht)} ängstlich</td></tr></table>
    <h3 style="margin-top:12px">Der Untergrund</h3>${rufAxis('unter', 'c')}
    <p class="s">Der Rote Kasimir ${kas}. Anarchisten tauchen ${an < 0.3 ? 'kaum noch' : an < 0.8 ? 'selten' : an < 1.2 ? 'ab und zu' : 'häufig'} auf. Unzufriedene Arbeiter stärken den Untergrund, Razzien und Kasimirs Festnahme schwächen ihn.</p>
  </section>
  <section><h3>Post und Einladungen</h3>${posts}</section>
  <section><h3>Vorrechte</h3><ul>${RUF_PRIV.map(P => { const on = P.ok(); return `<li class="${on ? '' : 'off'}"><span class="k">${on ? '✦' : '◇'}</span><b>${esc(P.t)}</b> <span class="s">· ${on ? 'erreicht' : esc(P.need)}</span><br><span class="s">${esc(P.d)}</span></li>`; }).join('')}${warn.map(w => `<li class="warn"><span class="k">⚠</span><b>${esc(w.t)}</b><br><span class="s">${esc(w.d)}</span></li>`).join('')}</ul>
    <h3 style="margin-top:12px">Rabatt im Handel</h3><table>${disc}</table></section>
  <section class="wide log"><h3>Chronik</h3><ul>${log}</ul></section>`;
  m.scrollTop = sc;
}

/* ---------- Schleife (über das Kontor) ---------- */
function rufInit() {
  if (RUF.ready) return;
  RUF.s = rufLoad();
  for (const k of ['elite', 'buerger', 'arbeiter']) RUF.snap[k] = KT.s.rep[k];
  RUF.s.day = RUF.s.day || KT.s.day;
  rufDom();
  RUF.ready = true;
  AWE.attHook = rufAttHook;
  KT.rufBonus = rufBonus;
  BLAST.onHits = rufOnHits;
  POWERS.onLetGo = rufOnLetGo;
  rufRefreshAtt(true); rufLinesStep(); rufRanks(true); rufPace(); rufHud(true); rufNewsBox();
  if (!RUF.s.post.length && !RUF.s.hint) rufPostAdd('interview');
  if (!RUF.s.hint) { RUF.s.hint = true; setTimeout(() => toast('Neu: Ruf und Ansehen · Taste Ö oder Klick auf den Titel oben rechts'), 9000); }
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'handel', titel: 'Kontor und Aufgaben', nach: 'stadt', tasten: [{ id: 'ruf', k: ['Ö'], t: 'Ruf und Ansehen', d: 'Titel, Ansehen bei Gesellschaft, Bürgern, Arbeitern, Presse und Personal, Furcht und Bewunderung, Post und Einladungen (auch Klick auf den Titel oben rechts)', act: () => { setTimeout(rufOpen, 80); return true; } }] } })); } catch (e) { /* alt */ }
  window.addEventListener('beforeunload', () => { if (RUF.dirty) rufSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && RUF.dirty) rufSave(); });
  document.addEventListener('pointerlockchange', () => { if (RUF.open && document.pointerLockElement) try { document.exitPointerLock(); } catch (e) { /* egal */ } });
  if (window.vespera) window.vespera.ruf = { RUF, add: rufAdd, get: rufGet, title: rufTitle, ansehen: rufAnsehen, open: rufOpen, close: rufClose, attP: rufAttP, post: rufPostAdd, answer: rufAnswer, day: rufDay, save: rufSave, has: rufHas };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { rufInit(); return; }
  if (!RUF.ready) return;
  if (why === 'reset') { RUF.s = rufFresh(); RUF.s.day = KT.s.day; for (const k of ['elite', 'buerger', 'arbeiter']) RUF.snap[k] = KT.s.rep[k]; rufSave(); rufRanks(true); rufHud(true); rufRender(); return; }
  if (why === 'day') { rufDay(); return; }
  if (why !== 'frame') return;
  if ((RUF.tickT -= dt) <= 0) {
    const step = 0.25 - RUF.tickT; RUF.tickT = 0.25;
    rufSnap();
    if (playing && !paused) rufWatch(step);
    if ((RUF.slowT -= step) <= 0) { RUF.slowT = 10; rufSlow(); rufLinesStep(); rufRefreshAtt(false); }
    rufRanks(false); rufHud(false);
    if (RUF.open && (RUF.renderT = (RUF.renderT || 0) - step) <= 0) { RUF.renderT = 1; rufRender(); }
  }
  rufToastStep(dt);
  if ((RUF.saveT -= dt) <= 0) { RUF.saveT = 8; if (RUF.dirty) rufSave(); }
});
if (typeof window !== 'undefined') {
  window.addEventListener('vespera-gegner', e => { try { rufOnGegner(e.detail); } catch (er) { console.warn('Ruf:', er); } });
  window.addEventListener('vespera-gala', e => { try { rufOnGala(e.detail); } catch (er) { console.warn('Ruf:', er); } });
  window.addEventListener('vespera-tat', e => { try { rufOnTat(e.detail); } catch (er) { console.warn('Ruf:', er); } });
  // Taste Ö (e.code 'Semicolon': auf der deutschen Tastatur das Ö, auf der US-Tastatur ;). Y gehört der Stadtkarte.
  window.addEventListener('keydown', e => {
    const k = e.code === 'Semicolon' || (e.key || '').toLowerCase() === 'ö' ? 'oe' : '';
    if (RUF.open) {
      if (e.code === 'Escape' || k === 'oe') rufClose();
      e.stopImmediatePropagation(); if (e.code !== 'F5' && e.code !== 'F12') e.preventDefault();
      return;
    }
    if (k === 'oe' && !e.repeat && RUF.ready && playing && !paused && !DINE.menuOpen && !e.ctrlKey && !e.metaKey && !e.altKey) { rufOpen(); e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
}
