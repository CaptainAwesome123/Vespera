/* =====================================================================
   V108 · MEHR GESPRÄCHE MIT ALEXANDER
   Bisher sagte ein Bewohner einen Satz, wenn Alexander ihn ansprach (E),
   und das war es. Jetzt folgt ein kleines Gespräch mit Antworten zur Wahl:
   - Die Karte zeigt Namen, Beruf und die STIMMUNG des Gegenübers
     (bewundernd, respektvoll, neidisch, skeptisch, ängstlich, feindselig,
     dienstbeflissen) und wie gut man sich kennt.
   - ANTWORTEN: nach dem Befinden fragen (je Beruf, Arbeitsort, Schicht,
     Charakter), nach dem Stadtgespräch fragen (was man sich über ihn
     erzählt, Streik, Wetter, Kurier), fragen, was die Person wirklich von
     ihm hält (ehrlich je nach Stimmung, auch unbequem), etwas schenken
     (20 Lumen), herablassend abwimmeln, sich verabschieden. Bis zu drei
     Runden; Geste und Lächeln oder kalter Blick zu jeder Antwort.
   - BEZIEHUNG: jede Antwort verschiebt sie (pd.mem.r, gespeichert mit dem
     Gedächtnis aus V105). Ab +25 wird jemand freundlicher (Neid wird
     Respekt, Angst wird Respekt, Skepsis wird Bewunderung), ab −25
     kühler (Bewunderung wird Neid, Neid und Skepsis werden Feindschaft).
     Wechselt die Stimmung, zeigt die Karte es an.
   Während des Gesprächs bleibt die Person stehen und schaut ihn an.
   Nur HTML (die Auswahlkarte aus venues.js), keine Arbeit in jedem Bild.
   ?unterhaltung=aus = Stand V107 (ein Satz beim Ansprechen).
   ===================================================================== */
import { CIT_TALK, CLOCK } from './ragdoll.js';
import { setAct, turnHead } from './serpentine.js';
import { player } from './player.js';
import { attOf, startAwe, mobility } from './awe.js';
import { rufGet, rufAdd, rufTitle } from './ruf.js';
import { KT, ktCash, EVENTS } from './kontor.js';
import { MEM, remember } from './gedaechtnis.js';
import { WL, WL_EV } from './wetterlage.js';
import { ZEITUNG } from './zeitung.js';
import { AT } from './alltag.js';
import { STR } from './strasse.js';
import { openChoice, DINE } from './venues.js';
import { lifeSay } from './life.js';
import { shared } from './core.js';
import { toast } from './boat.js';

export const UNTERHALTUNG = typeof location === 'undefined' || new URLSearchParams(location.search).get('unterhaltung') !== 'aus';
export const UH = { ready: false, cur: null, n: 0, rounds: 0, changes: 0, max: 3 };   // V113: max = Fragen je Gespräch (plaudern.js: 4)
const pick = a => a[Math.floor(Math.random() * a.length)];
export const MOOD = { bew: 'bewundernd', resp: 'respektvoll', neid: 'neidisch', skep: 'skeptisch', furcht: 'ängstlich', hass: 'feindselig', dienst: 'dienstbeflissen' };
const memOf = pd => pd.mem || (pd.mem = {});
const grp = c => c.kind === 'worker' || c.jk === 'Fabrikarbeiter' ? 'arbeiter' : 'buerger';

/* ---------- Antworten je Frage und Stimmung ---------- */
// {job} Beruf, {work} Arbeitsort, {bar} Stammlokal, {titel} Alexanders Titel
const BEFINDEN = {
  bew: ['Mir geht es wunderbar, seit Sie mich angesprochen haben! Ich bin {job} im {work}, wissen Sie.', 'Gut, Herr Alexander, danke! Viel Arbeit im {work}, aber man lebt in Vespera. Wo sonst?', 'Ach, bestens! Nach der Arbeit geh ich ins {bar}. Kommen Sie doch mal mit! … Nein, natürlich nicht. Verzeihung.'],
  resp: ['Man kommt zurecht, Herr Alexander. Die Arbeit im {work} ist hart, aber ehrlich.', 'Danke der Nachfrage. Es geht. Es geht immer irgendwie.', 'Gut genug. Ich bin {job}. Man hat sein Auskommen, wenn man nicht krank wird.'],
  neid: ['Wie soll’s mir gehen? Ich bin {job}, nicht Herr über die halbe Stadt.', 'Danke, gut. Für jemanden ohne Penthouse.', 'Es geht. Im {work} zahlen sie pünktlich. Nicht viel, aber pünktlich.'],
  skep: ['Seit wann interessiert Sie, wie es unsereinem geht?', 'Die Miete steigt, der Lohn nicht. Sonst alles bestens.', 'Ich bin {job}. Fragen Sie mich in einem Jahr noch mal, ob ich’s noch bin.'],
  furcht: ['G… gut, Herr Alexander! Sehr gut! Ich beschwere mich nicht!', 'Mir geht es gut, wirklich. Ich arbeite fleißig im {work}, fragen Sie ruhig nach.'],
  hass: ['Schlecht. Und Sie wissen genau, warum.', 'Wollen Sie das wirklich wissen? Zwölf Stunden im {work}, und am Ende reicht es nicht für Kohlen.', 'Mir ging’s besser, bevor Sie mich angesprochen haben.'],
  dienst: ['Bestens, Herr Alexander, danke der gütigen Nachfrage!', 'Sehr wohl, alles in Ordnung. Darf ich etwas für Sie tun?'],
};
const BEF_TRAIT = { fröhlich: 'Übrigens: heute ist ein guter Tag. Ich hab’s im Gefühl!', mürrisch: 'Und der Nebel geht mir auf die Nerven.', verträumt: 'Manchmal schaue ich stundenlang aufs Nordlicht. Ist das albern?', ehrgeizig: 'Aber ich will mehr. In fünf Jahren habe ich mein eigenes Geschäft.', gesellig: 'Heute Abend sind wir im {bar}, die ganze Bande.', schüchtern: '… Verzeihung, ich rede sonst nicht so viel.', neugierig: 'Darf ich etwas fragen? Wie fühlt sich das an, das Fliegen?', elegant: 'Und meine neuen Handschuhe sind endlich gekommen. Aus Paris!' };
const MEINUNG = {
  bew: ['Ehrlich? Ich bewundere Sie. Sie haben aus einem Krater eine Stadt gemacht.', 'Die Leute reden viel, Herr Alexander. Ich sage: Ohne Sie gäbe es uns alle hier nicht.'],
  resp: ['Sie sind ein harter Chef, aber ein fairer. Meistens.', 'Ich halte Sie für einen klugen Mann. Ob Sie auch ein guter Mann sind, das wird sich zeigen.'],
  neid: ['Was ich halte? Dass Sie Glück hatten. Viel Glück. Und einen Kristall.', 'Sie haben alles, Herr Alexander. Schwer, so jemanden zu mögen. Nehmen Sie’s nicht persönlich.'],
  skep: ['Sie bauen schöne Türme. Wer darin wohnt und wer sie baut, das sind zwei verschiedene Leute.', 'Ich halte Sie für einen Geschäftsmann. Nicht mehr, nicht weniger. Und Geschäftsleute rechnen.'],
  furcht: ['Ich … ich halte gar nichts, Herr Alexander! Nur Gutes! Wirklich!', 'Ehrlich gesagt habe ich Angst vor Ihnen. Verzeihen Sie.'],
  hass: ['Wollen Sie es wirklich hören? Sie sind der Grund, warum mein Vater hustet. Ihre Gießerei.', 'Ich halte Sie für den Mann, dem die Stadt gehört. Und das ist das Problem.'],
  dienst: ['Es ist mir eine Ehre, Ihnen zu dienen, Herr Alexander.', 'Ein Herr wie Sie fragt so etwas nicht, Herr Alexander. Aber danke.'],
};
const GABE = {
  warm: ['Für mich? Danke, Herr Alexander! Davon kauf ich meiner Mutter Blumen.', 'Das ist zu gütig. Danke!'],
  cool: ['Zwanzig Lumen. Danke. Ich nehm’s, ich bin ja nicht dumm.', 'Wollen Sie sich freikaufen? Na gut. Danke.'],
  hass: ['Ihr Geld will ich nicht. … Na gut. Aber das ändert nichts.'],
  furcht: ['D… danke, Herr Alexander! Muss ich dafür etwas tun?'],
};
const HERAB = {
  bew: ['Oh. Natürlich. Verzeihung, dass ich Sie aufgehalten habe.', 'Ich … verstehe. Sie haben viel zu tun.'],
  resp: ['Wie Sie meinen, Herr Alexander.', 'Schon gut. Ich weiß, wo mein Platz ist.'],
  neid: ['Natürlich. Der Herr hat zu tun. Wie immer.', 'Platz da für den Herrn von Vespera! Klar doch.'],
  skep: ['Na bitte. Da zeigt er sein wahres Gesicht.', 'So redet man also mit den Leuten, die Ihre Türme bauen.'],
  furcht: ['Ja! Sofort! Verzeihung!', 'Ich gehe ja schon!'],
  hass: ['Eines Tages reden Sie nicht mehr so mit uns.', 'Sie können mich mal, Herr Alexander.'],
  dienst: ['Sehr wohl, Herr Alexander. Verzeihen Sie die Störung.'],
};
const ABSCHIED = { bew: ['Auf Wiedersehen, Herr Alexander! Das erzähl ich allen!'], resp: ['Gute Nacht, Herr Alexander.'], neid: ['Gute Nacht. Schlafen Sie gut, da oben.'], skep: ['Na dann. Gute Nacht.'], furcht: ['Gute Nacht, Herr Alexander! Gute Nacht!'], hass: ['Endlich.', 'Gehen Sie nur.'], dienst: ['Einen angenehmen Abend, Herr Alexander!'] };
// Stadtgespräch: was man sich erzählt
const GER = { wurf: 'dass Sie {wann} jemanden durch die Luft geworfen haben', heben: 'dass Sie {wann} jemanden schweben ließen', stoss: 'dass Ihr Licht {wann} Leute umgeworfen hat', welle: 'dass es {wann} um Sie herum geknallt hat und alle am Boden lagen', wagen: 'dass {wann} ein Automobil durch die Luft geflogen ist', held: 'dass Sie {wann} einen Verbrecher gestellt haben', runde: 'dass Sie {wann} eine Runde ausgegeben haben', droh: 'dass Sie den Streikposten gedroht haben', lohn: 'dass Sie höhere Löhne versprochen haben', spende: 'dass Sie für die Streikkasse gespendet haben', raeum: 'dass Sie den Kneipenplatz haben räumen lassen', gala: 'dass die Gala im Belmont ein Vermögen gekostet hat', stiftung: 'dass Sie eine Stiftung gegründet haben: {t}', schneeball: 'dass Sie jemand mit einem Schneeball getroffen hat' };
const GER_ANS = { warm: ['Man erzählt sich, {g}. Ich finde, das spricht für Sie.', 'Alle reden davon, {g}. Ich hab’s meinen Nachbarn erzählt!'], cool: ['Man erzählt sich, {g}. Und man erzählt es nicht freundlich.', 'Na, was wohl? {G}. Das ganze Viertel redet davon.'] };
function gerueht(att) {
  const warm = att === 'bew' || att === 'resp' || att === 'dienst', L = [];
  const day = KT.s ? KT.s.day | 0 : 0;
  const G = MEM && MEM.s && MEM.s.g ? MEM.s.g.filter(g => GER[g.k] && day - g.d <= 2) : [];
  if (G.length) {
    const g = G[0], d = day - (g.d | 0), wann = d <= 0 ? 'heute' : d === 1 ? 'gestern' : 'neulich', txt = GER[g.k].replace('{wann}', wann).replace('{t}', g.t || '');
    L.push(pick(GER_ANS[warm ? 'warm' : 'cool']).replace('{g}', txt).replace('{G}', 'Dass' + txt.slice(4)));
  }
  if ((AT && AT.struck && AT.struck.size) || (STR && STR.level >= 2) || (KT.s && KT.s.ev && KT.s.ev.some(e => EVENTS[e.i] && EVENTS[e.i].streik))) L.push(warm ? 'Im Arbeiterviertel wird gestreikt. Man sagt, Sie könnten das mit einem Wort beenden.' : 'Die Fabriken stehen still. Und alle warten, was Sie tun, Herr Alexander.');
  if (WL && WL.ev && WL_EV[WL.ev]) L.push('Alle reden nur vom Wetter: ' + WL_EV[WL.ev].n + '. Meine Tante hat schon die Fenster zugenagelt.');
  const Z = ZEITUNG && ZEITUNG.archive && ZEITUNG.archive[ZEITUNG.archive.length - 1];
  if (Z && Z.lead && Z.lead.titel) L.push('Haben Sie den Kurier gelesen? „' + Z.lead.titel + '“. Ob’s stimmt, weiß keiner.');
  if (rufGet('unter') > 55) L.push('Man flüstert, Kasimirs Leute werden mehr. Nicht jeder hier findet das schlecht.');
  L.push(warm ? 'Man sagt, der Kurier nennt Sie jetzt „' + titel() + '“. Passt doch!' : 'Der Kurier nennt Sie „' + titel() + '“. Bei uns nennt man Sie anders.');
  return pick(L.slice(0, 3));
}
function titel() { try { return rufTitle(); } catch (e) { return 'Herr von Vespera'; } }

/* ---------- Beziehung und Stimmung ---------- */
function moodOf(c) { return attOf(c.ped); }
function shift(c, d) {
  const pd = c.ped, M = memOf(pd), before = moodOf(c);
  M.r = Math.max(-100, Math.min(100, (M.r || 0) + d)); MEM.dirty = true;
  let a = before;
  if (M.r >= 25 && d > 0) a = { neid: 'resp', furcht: 'resp', skep: grp(c) === 'arbeiter' ? 'resp' : 'bew', hass: M.r >= 45 ? 'skep' : 'hass' }[before] || before;
  if (M.r <= -25 && d < 0) a = { bew: 'neid', resp: 'skep', neid: 'hass', skep: 'hass' }[before] || before;
  if (a !== before) { pd.memAtt = a; UH.changes++; return a; }
  return null;
}
function gesture(c, att, kind) {
  const pd = c.ped; if (!pd.a || !pd.a.on) return;
  const man = !pd.fem, r = Math.random();
  const act = kind === 'herab' ? (att === 'furcht' ? 13.2 : att === 'hass' || att === 'skep' ? 15.3 : 1.3)
    : kind === 'gabe' ? (att === 'hass' ? 12.2 : att === 'furcht' ? 1.3 : man && r < 0.5 ? 5.3 : 8.2)
    : kind === 'abschied' ? (att === 'hass' ? 12.2 : 3.6)
    : att === 'bew' ? (r < 0.4 ? 2.6 : 0.9) : att === 'hass' ? 15.3 : att === 'furcht' ? 13.2 : att === 'neid' || att === 'skep' ? (r < 0.5 ? 12.2 : 0.9) : 0.9;
  const A = pd.aw; if (A && !A.fn) { A.act = act; setAct(pd, act); } else if (!A) startAwe(pd, { act, dur: 999, keep: mobility(pd) !== 'walk' });
  turnHead(pd.a, player.p.x, player.p.z);
}
function hold(c, on) {
  const pd = c.ped; if (!pd.a) return;
  if (on) { if (!pd.aw) startAwe(pd, { act: 1.3, dur: 999, keep: mobility(pd) !== 'walk' }); else if (!pd.aw.fn) pd.aw.dur = 999; }
  else if (pd.aw && !pd.aw.fn) pd.aw.dur = pd.aw.t + 1.5;
}
const fillC = (s, c) => s.replace(/\{job\}/g, c.job).replace(/\{work\}/g, c.at.work.name).replace(/\{bar\}/g, c.at.bar.name).replace(/\{titel\}/g, titel());
function say(c, s, dur = 6) { shared.sayTimer = 0; lifeSay(c.name, s, dur); }

/* ---------- Gespräch ---------- */
const OPTS = [
  { id: 'befinden', t: c => 'Wie geht es Ihnen?', d: 3 },
  { id: 'stadt', t: () => 'Was erzählt man sich in der Stadt?', d: 2 },
  { id: 'meinung', t: () => 'Was halten Sie eigentlich von mir?', d: 1 },
  { id: 'gabe', t: () => 'Hier, für Sie · 20 Lumen', d: 9 },
  { id: 'herab', t: () => 'Machen Sie Platz, ich habe zu tun.', d: -12 },
  { id: 'abschied', t: () => 'Auf Wiedersehen.', d: 1 },
];
function title(c) {
  const att = moodOf(c), M = c.ped.mem || {}, n = M.n | 0, r = M.r || 0;
  const bek = n <= 1 ? 'erstes Gespräch' : n < 4 ? 'flüchtig bekannt' : r >= 25 ? 'gut bekannt' : r <= -25 ? 'kein gutes Verhältnis' : 'bekannt';
  return `${c.name} · ${c.job} · Stimmung: ${MOOD[att] || att} · ${bek}`;
}
function menu(c) {
  const S = UH.cur; if (!S || S.c !== c) return;
  S.pending = false;
  const opts = OPTS.filter(o => !S.used.has(o.id) && !(o.id === 'gabe' && KT.s && KT.s.cash < 20));
  openChoice(title(c), opts.map(o => o.t(c)), i => answer(c, opts[i]));
}
function answer(c, o) {
  const S = UH.cur; if (!S || !o) return;
  S.used.add(o.id); UH.rounds++;
  const att = moodOf(c), L = k => (k[att] || k.resp);
  let line = '';
  if (o.id === 'befinden') { line = fillC(pick(L(BEFINDEN)), c); const tr = BEF_TRAIT[c.trait && c.trait.k]; if (tr && att !== 'hass' && att !== 'furcht' && Math.random() < 0.6) line += ' ' + fillC(tr, c); }
  else if (o.id === 'stadt') line = gerueht(att);
  else if (o.id === 'meinung') line = pick(L(MEINUNG));
  else if (o.id === 'gabe') { ktCash(-20, 'Geschenk an ' + c.name); rufAdd({ [grp(c)]: 0.3 }, 'Einem Bürger etwas geschenkt', { key: 'talk:gabe' }); if (MEM.ready) remember(c.ped, 'gabe', true); line = pick(GABE[att === 'hass' ? 'hass' : att === 'furcht' ? 'furcht' : att === 'neid' || att === 'skep' ? 'cool' : 'warm']); }
  else if (o.id === 'herab') { rufAdd({ [grp(c)]: -0.5 }, 'Einen Bürger herablassend abgewimmelt', { key: 'talk:herab' }); if (MEM.ready) remember(c.ped, 'abgewiesen', true); line = pick(L(HERAB)); }
  else if (o.fn) line = o.fn(c, att);   // V113: weitere Fragen (plaudern.js)
  else line = pick(L(ABSCHIED));
  // Ehrlichkeit wird belohnt, wenn er zuhört: wer ihm die Meinung sagen durfte, ist danach etwas milder
  const d = o.id === 'meinung' && (att === 'hass' || att === 'skep' || att === 'neid') ? 4 : o.d;
  const now = shift(c, d);
  gesture(c, now || att, o.id);
  say(c, line, Math.min(9, 3 + line.length * 0.05));
  if (now) setTimeout(() => toast(`${c.name} ist jetzt ${MOOD[now]}`), 1800);
  const end = o.id === 'abschied' || o.id === 'herab' || S.used.size >= UH.max + (o.id === 'gabe' ? 1 : 0);
  if (end) { close(); return; }
  S.pending = true;
  S.wait = setTimeout(() => { if (UH.cur === S && !DINE.menuOpen) menu(c); }, 900 + Math.min(2600, line.length * 25));
}
function close() {
  const S = UH.cur; if (!S) return;
  clearTimeout(S.wait); hold(S.c, false); UH.cur = null;
}
function talk(c) {
  if (!UH.ready || c.nf || player.fly) return;
  if (UH.cur) close();
  UH.cur = { c, used: new Set(), t0: CLOCK.min, pending: true };
  UH.n++;
  hold(c, true);
  // der erste Satz steht schon da (citizenSay); kurz danach die Antworten
  UH.cur.wait = setTimeout(() => { if (UH.cur && UH.cur.c === c && !DINE.menuOpen) menu(c); }, 700);
}
function init() {
  if (UH.ready || !UNTERHALTUNG) return;
  UH.ready = true;
  CIT_TALK.fn = talk;
  // wer weggeht, beendet das Gespräch
  setInterval(() => {
    const S = UH.cur; if (!S) return;
    const a = S.c.ped.a, e = a && a.m.elements, p = player.p;
    if (!e || !a.on || (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 > 7 * 7 || player.fly) close();
    else if (!DINE.menuOpen && !S.pending) close();   // Karte mit Esc geschlossen
  }, 1000);
  if (window.vespera) window.vespera.unterhaltung = { UH, talk, answer, menu, close, OPTS, shift, moodOf, title, gerueht, BEFINDEN, MEINUNG, GABE, HERAB, ABSCHIED, BEF_TRAIT };
}
KT.hooks.push(why => { if (why === 'init') init(); });
// V113: für plaudern.js
export { OPTS, fillC };
