/* =====================================================================
   V61 · AUFGABEN: BÜRGER, RANDOLF, BÜRGERMEISTER, BANKDIREKTOR
   - BÜRGER: In Alexanders Nähe hat ab und zu jemand ein Anliegen (goldener Kreis
     über dem Kopf, E: „Anliegen“). Je nach Beruf: ein Geschenk aus einem Laden
     besorgen, einen Brief abgeben, Kohle fürs Arbeiterviertel liefern, einen
     Taschendieb fassen, Champagner für eine Soirée liefern, einen Koffer vom
     Güterkai holen, bei einer Aktie einsteigen.
   - RANDOLF: In der Villa spricht er Alexander an, wenn er etwas auf dem Herzen
     hat (Weinkeller, Rosen, Livreen, eine Kiste vom Hafenamt, ein Rat …).
   - BÜRGERMEISTER HOLLISTER: schickt Telegramme (Kohle, Ruhe auf den Straßen,
     Bomben, Ehrengast im Varieté, Begrüßung am Ankermast, Bauprojekte).
   - BANKDIREKTOR VARGA: in der Schalterhalle (E), Anlageberatung.
   Angebote nimmt man im Kontorbuch an (Reiter Aufgaben) oder direkt im Gespräch.
   Eine Aufgabe wird verfolgt: oben rechts mit Richtung und Entfernung, in der
   Welt mit einer Raute über dem Ziel. Belohnung: Ansehen, Wohlstand, manchmal Geld.
   Gespeichert mit dem Kontor (KT.s.q). Nur HTML, keine 3D-Teile außer der Kiste
   oder dem Koffer zum Tragen (physics.spawnProp, vorhandenes Material).
   ===================================================================== */
import { T, camera, $ } from './core.js';
import { player } from './player.js';
import { playing, paused } from './input.js';
import { toast } from './boat.js';
import { openChoice } from './venues.js';
import { INTERACT } from './music.js';
import { SHOPS, SHOP_KINDS } from './shops.js';
import { ORTE } from './orte.js';
import { VILLA } from './harbour.js';
import { citizens } from './ragdoll.js';
import { lifeSay } from './life.js';
import { HS } from './haushalt.js';
import { inPenthouse } from './penthouse.js';
import { LOOSE, spawnProp, dropBody, drop } from './physics.js';
import { tkRelease } from './powers.js';
import { invOpen } from './inventar.js';
import { GEGNER } from './gegner.js';
import { KT, GOODS, POSTS, BIZ, COS, PROJECTS, ktOpen, ktRep, ktCash, ktTake, ktOwns, ktEmit, ktChanged, ktPostHere, postPos, fmM, esc, fmN, titleCase, WARE_PRICE, clamp, ktPrice, netWorth } from './kontor.js';

const AQ = { givers: [], marks: [], scanT: 3, randT: 0, rt: {}, el: null, tickT: 0 };
const GROUP = { elite: 'Elite', buerger: 'Bürger', arbeiter: 'Arbeiter' };
const pickA = a => a[Math.floor(Math.random() * a.length)];
const _pv = new T.Vector3();

/* ---------- Orte ---------- */
const BELMONT_FRONT = { x: 0, y: 0.26, z: 66, r: 10, ort: 'vor dem Belmont' };
function placeOf(key) {
  if (key === 'villa') return { x: VILLA.x, y: VILLA.y, z: VILLA.z, r: 45, ry: 30, ort: 'in der Bergvilla' };
  if (key === 'belmont') return BELMONT_FRONT;
  if (key === 'metropol') { const V = ORTE.theater; return V ? { x: V.x, y: V.F || 0.3, z: V.z, r: 16, ort: 'im Varieté Metropol' } : BELMONT_FRONT; }
  if (key === 'mast') return { x: 150, y: 405, z: 180, r: 30, ry: 40, ort: 'am Ankermast über der Stadt' };
  const P = postPos(key); if (P) return { x: P.x, y: P.y, z: P.z, r: Math.max(P.r, 5), ort: POSTS[key] ? 'am ' + POSTS[key].n : key };
  return null;
}
const inside = (p, Q) => Q && (p.x - Q.x) ** 2 + (p.z - Q.z) ** 2 < Q.r * Q.r && Math.abs(p.y - Q.y) < (Q.ry || 4);

/* ---------- Feste Aufgaben ---------- */
const RANDOLF = [
  { title: 'Der Weinkeller', text: 'Verzeihen Sie, Sir: der Champagner im Keller geht zur Neige. Zwölf Kisten sollten bis zum Frühjahr reichen. Am Luftschiffhafen kommen die besten Lieferungen an.', g: { k: 'ware', g: 'champagner', n: 12, to: 'villa' }, rw: { rep: { elite: 2 } }, say: 'Sir, darf ich Sie einen Augenblick sprechen? Es geht um den Weinkeller.' },
  { title: 'Weiße Rosen für die Halle', text: 'Die Rosen in der Halle lassen die Köpfe hängen, Sir. Ein frischer Strauß weißer Rosen aus einem Blumenladen in der Stadt, und das Haus atmet wieder.', g: { k: 'ding', kind: 'blumen', to: 'randolf' }, rw: { rep: { buerger: 2 } }, say: 'Sir, die Rosen in der Halle … verzeihen Sie, das fällt mir eben auf.' },
  { title: 'Neue Livreen', text: 'Die Livreen des Personals sind abgetragen, Sir. Wenn Sie beim Schneider einen Anzug nach Maß als Muster mitbrächten, ließe ich danach für alle nähen.', g: { k: 'ding', kind: 'schneider', to: 'randolf' }, rw: { rep: { buerger: 3 } }, say: 'Sir, die Livreen … man sieht es an den Ellbogen.' },
  { title: 'Eine Kiste vom Hafenamt', text: 'Am Güterkai wartet eine Kiste für Sie, Sir: Kristallgläser aus Böhmen. Das Hafenamt liefert erst nächste Woche. Vielleicht … mit Ihren besonderen Fähigkeiten?', g: { k: 'kiste', kind: 'crate', from: 'kai', to: 'villa' }, rw: { rep: { buerger: 2 } }, say: 'Sir, eine Kiste aus Böhmen ist angekommen. Leider am falschen Ende der Stadt.' },
  { title: 'Ein Rat, Sir', text: 'Wenn ich so frei sein darf: Das Café Kranich an der Promenade soll verkauft werden. Ein Mann Ihres Standes sollte dort seinen Mokka trinken, ohne zu bezahlen.', g: { k: 'besitz', id: 'kranich' }, rw: { rep: { elite: 2, buerger: 2 } }, say: 'Sir, ich habe etwas gehört, das Sie interessieren könnte.' },
  { title: 'Zigarren für den Rauchsalon', text: 'Die Zigarrenkiste im Herrenzimmer ist leer, Sir. Aus einem Tabakladen, wenn es Ihnen keine Umstände macht.', g: { k: 'ding', kind: 'tabak', to: 'randolf' }, rw: { rep: { buerger: 1 } }, say: 'Sir, das Herrenzimmer … die Zigarrenkiste.' },
];
const RANDOLF_MORE = [
  { title: 'Musik für den Salon', text: 'Eine neue Schellackplatte für das Grammophon im Salon, Sir? Etwas zum Tanzen vielleicht.', g: { k: 'ding', kind: 'platten', to: 'randolf' }, rw: { rep: { buerger: 1 } }, say: 'Sir, das Grammophon spielt seit Wochen dieselbe Platte.' },
  { title: 'Lesestoff für die Bibliothek', text: 'Für die Bibliothek fehlt ein neuer Roman, Sir. In Leder gebunden, versteht sich.', g: { k: 'ding', kind: 'buch', to: 'randolf' }, rw: { rep: { buerger: 1 } }, say: 'Sir, die Bibliothek wünscht sich Gesellschaft.' },
  { title: 'Rosen, wieder', text: 'Die Rosen, Sir. Sie wissen schon.', g: { k: 'ding', kind: 'blumen', to: 'randolf' }, rw: { rep: { buerger: 1 } }, say: 'Sir … die Rosen.' },
  { title: 'Kohlen für die Villa', text: 'Der Heizkeller braucht zwanzig Sack Kohle, Sir. Die Nächte sind lang am Kraterrand.', g: { k: 'ware', g: 'kohle', n: 20, to: 'villa' }, rw: { rep: { arbeiter: 1 } }, say: 'Sir, der Heizer lässt fragen, wegen der Kohlen.' },
];
const MAYOR = [
  { title: 'Kohle für das Arbeiterviertel', text: 'Die Kältewelle trifft das Arbeiterviertel hart. Vierzig Sack Kohle am Kneipenplatz würden hundert Familien durch den Monat bringen. Die Stadt dankt Ihnen.', g: { k: 'ware', g: 'kohle', n: 40, to: 'kneipe' }, rw: { rep: { arbeiter: 10, buerger: 2 }, wohl: 4 } },
  { title: 'Ruhe auf den Straßen', text: 'Räuber und Taschendiebe machen die Avenue unsicher. Wenn Sie zwei von ihnen der Polizei übergeben, schläft Vespera ruhiger.', g: { k: 'gauner', stat: 'gefasst', n: 2, start: 'raub' }, rw: { rep: { buerger: 8 } } },
  { title: 'Ehrengast im Metropol', text: 'Das Varieté Metropol feiert seine hundertste Vorstellung. Ihr Erscheinen wäre die Krönung des Abends.', g: { k: 'gehen', at: 'metropol' }, rw: { rep: { elite: 5, buerger: 2 } } },
  { title: 'Die Straßenbahn-Linie Nord', text: 'Der Stadtrat hat die Pläne für die Straßenbahn-Linie Nord beschlossen, nur das Geld fehlt. Eine Stiftung von Ihnen, und wir legen morgen die Schienen.', g: { k: 'stift', id: 'tram' }, rw: { rep: { buerger: 4 } } },
  { title: 'Anarchisten mit Bomben', text: 'Die Polizei fürchtet einen Bombenanschlag der Anarchisten. Sollte es dazu kommen: werfen Sie das Ding hoch in den Himmel oder ins Wasser.', g: { k: 'gauner', stat: 'entschaerft', n: 1, start: 'bombe' }, rw: { rep: { buerger: 10, elite: 3 } } },
  { title: 'Begrüßung am Ankermast', text: 'Morgen legt das Luftschiff aus New York an. Die Gäste wären entzückt, wenn der Gründer der Stadt sie hoch oben am Ankermast begrüßte.', g: { k: 'gehen', at: 'mast' }, rw: { rep: { elite: 3, buerger: 3 } } },
  { title: 'Der Hafenkran', text: 'Der alte Kran am Güterkai schafft die Fracht nicht mehr. Ein neuer Kran hieße mehr Handel für alle.', g: { k: 'stift', id: 'kran' }, rw: { rep: { arbeiter: 3 } } },
  { title: 'Fisch für jeden Tisch', text: 'Zum Fest der Fischer soll jede Familie im Arbeiterviertel einen Fisch auf dem Tisch haben: dreißig Fass am Kneipenplatz.', g: { k: 'ware', g: 'fisch', n: 30, to: 'kneipe' }, rw: { rep: { arbeiter: 6 }, wohl: 2 } },
  { title: 'Ein Hospital', text: 'Das alte Krankenhaus ist zu klein für eine wachsende Stadt. Ein Hospital am Kraterrand trüge Ihren Namen für immer.', g: { k: 'stift', id: 'spital' }, rw: { rep: { buerger: 3 } } },
];
const MAYOR_MORE = [
  { title: 'Taschendiebe am Hafen', text: 'Wieder Taschendiebe. Die Polizei ist dankbar für jede Hilfe.', g: { k: 'gauner', stat: 'gefasst', n: 1, start: 'dieb' }, rw: { rep: { buerger: 4 } } },
  { title: 'Bier zum Feierabend', text: 'Die Brauerei streikt, und das Arbeiterviertel sitzt auf dem Trockenen. Zwanzig Fass Bier am Kneipenplatz, bitte.', g: { k: 'ware', g: 'bier', n: 20, to: 'kneipe' }, rw: { rep: { arbeiter: 5 } } },
  { title: 'Kohle, schon wieder', text: 'Die Kälte lässt nicht nach. Dreißig Sack Kohle am Kneipenplatz.', g: { k: 'ware', g: 'kohle', n: 30, to: 'kneipe' }, rw: { rep: { arbeiter: 6 }, wohl: 2 } },
  { title: 'Kaffee für die Nachtschicht', text: 'Die Nachtschicht im Stahlwerk braucht Kaffee: fünfzehn Sack am Kneipenplatz.', g: { k: 'ware', g: 'kaffee', n: 15, to: 'kneipe' }, rw: { rep: { arbeiter: 4 } } },
];
const BANK = [
  { title: 'Rettung der Reederei', text: 'Die Nordlicht-Reederei wankt, ein Spekulant aus Chicago will sie billig schlucken. Wenn Sie 5.000 Aktien halten, ist sie in guten Händen, und die Anleger fassen wieder Mut.', g: { k: 'aktie', c: 'nord', n: 5000 }, rw: { rep: { elite: 4, buerger: 4 }, kurs: { nord: 0.15 } } },
  { title: 'Die Goldreserve', text: 'Eine Bank ist nur so stark wie ihr Tresor. Zehn Goldbarren in Ihrem Lager, als Sicherheit für die Stadt, beruhigen jeden Sparer.', g: { k: 'lager', g: 'gold', n: 10 }, rw: { rep: { elite: 5 }, kurs: { bank: 0.08 } } },
  { title: 'Die Luftschiffwerft', text: 'Die Luftschiffwerft sucht einen Eigentümer mit Weitblick. Unter Ihnen würde sie die schönsten Schiffe der Welt bauen.', g: { k: 'besitz', id: 'fabrik:LUFTSCHIFFWERFT', alt: 'rundflug' }, rw: { rep: { elite: 3, arbeiter: 4 }, kurs: { luft: 0.1 } } },
  { title: 'Ein Stiftungsfonds', text: 'Gönnen Sie der Stadt eine Gewerbeschule: Wer heute Turbinen lernt, baut morgen Ihre Werke.', g: { k: 'stift', id: 'schule' }, rw: { rep: { elite: 2 } } },
  { title: 'Polarstahl stützen', text: 'Polarstahl schwächelt seit dem Streik. 3.000 Aktien in Ihrer Hand, und der Kurs fängt sich.', g: { k: 'aktie', c: 'stahl', n: 3000 }, rw: { rep: { arbeiter: 3, elite: 2 }, kurs: { stahl: 0.12 } } },
];

/* ---------- Bürgeranliegen (aus Beruf und Laune gebaut) ---------- */
const GIFT_FOR = ['meine Mutter', 'meine Verlobte', 'meinen Vater', 'meine Schwester', 'meinen Chef', 'meine Frau', 'meinen alten Lehrer'];
const LETTER_FOR = ['Fräulein Elsa', 'Herrn Brandt', 'meine Cousine Ida', 'den Kapellmeister', 'Madame Durand', 'meinen Bruder Kurt'];
function groupOf(c) { return c.jk === 'Fabrikarbeiter' ? 'arbeiter' : c.jk === 'Bankier' ? 'elite' : 'buerger'; }
function shopKindsAvail() { return [...new Set(SHOPS.filter(S => S.host).map(S => S.kind))]; }
function wareName(kind) { const k = SHOP_KINDS.find(q => q.k === kind); return k ? k.ware.replace(/^(ein|eine|einen) /, '') : kind; }
function wareAkk(kind) { const k = SHOP_KINDS.find(q => q.k === kind); return k ? k.ware : kind; }
function citizenQuest(c, ci) {
  const grp = groupOf(c), avail = shopKindsAvail(), types = ['geschenk', 'brief'];
  if (grp === 'arbeiter') types.push('kohle', 'kohle', 'dieb');
  if (grp === 'elite') types.push('soiree', 'aktie', 'koffer');
  if (grp === 'buerger') types.push('dieb', 'koffer');
  const ty = pickA(types), wk = c.at.work, bar = c.at.bar;
  const base = { src: 'buerger', who: c.name + ' · ' + c.job, ci, grp };
  if (ty === 'geschenk') {
    const want = (grp === 'arbeiter' ? ['blumen', 'spiel', 'tabak', 'buch'] : ['blumen', 'buch', 'hut', 'platten', 'uhren', 'spiel', 'tabak', 'deli']).filter(k => avail.includes(k));
    if (!want.length) return null;
    const kind = pickA(want), who = pickA(c.female ? GIFT_FOR.filter(w => w !== 'meine Frau' && w !== 'meine Verlobte') : GIFT_FOR);
    return { ...base, title: 'Ein Geschenk für ' + who, text: `Herr Alexander! Verzeihen Sie, dass ich Sie anspreche. ${who[0].toUpperCase() + who.slice(1)} hat morgen Geburtstag, und ich komme nicht aus ${wk && wk.kind === 'factory' ? 'der Fabrik' : 'der Arbeit'}. Könnten Sie mir ${wareAkk(kind)} besorgen? Ich zahle es Ihnen zurück, bei meiner Ehre.`, g: { k: 'ding', kind, to: 'buerger' }, rw: { rep: { [grp]: 4 }, cash: WARE_PRICE[kind] || 3 } };
  }
  if (ty === 'brief') {
    const pl = pickA([bar, c.at.eat, wk].filter(p => p && p.name && p.kind !== 'home'));
    if (!pl) return null;
    const who = pickA(LETTER_FOR), nm = pl.kind === 'factory' ? 'der ' + titleCase(pl.name) : titleCase(pl.name);
    return { ...base, title: 'Ein Brief für ' + who, text: `Würden Sie diesen Brief für ${who} abgeben? In ${nm}. Persönlich, bitte, es ist … wichtig. Von Ihnen überbracht, wird man ihn bestimmt lesen.`, g: { k: 'gehen', pt: { x: pl.x, y: 0.26, z: pl.z, r: 7, ort: 'in ' + nm } }, rw: { rep: { [grp]: 3 } } };
  }
  if (ty === 'kohle') return { ...base, title: 'Kohlen bis zum Monatsende', text: 'Herr Alexander … die Kohlen reichen nicht bis zum Monatsende, und die Kinder frieren. Sechs Sack am Kneipenplatz, mehr bräuchten wir nicht. Ich weiß, das ist viel verlangt.', g: { k: 'ware', g: 'kohle', n: 6, to: 'kneipe' }, rw: { rep: { arbeiter: 6 }, wohl: 1 } };
  if (ty === 'dieb') return { ...base, title: 'Der Wochenlohn ist weg', text: 'Ein Taschendieb hat mir den Wochenlohn aus der Jacke gezogen! Die Polizei zuckt mit den Schultern. Wenn Sie einen von diesen Halunken erwischen …', g: { k: 'gauner', stat: 'gefasst', n: 1, start: 'dieb' }, rw: { rep: { [grp]: 5, buerger: 2 } } };
  if (ty === 'soiree') return { ...base, title: 'Champagner für eine Soirée', text: 'Alexander, mein Lieber! Ich gebe heute Abend eine Soirée in meiner Suite im Belmont, und der Hoteleinkauf hat keinen Champagner mehr. Vier Kisten? Sie sind ein Engel.', g: { k: 'ware', g: 'champagner', n: 4, to: 'belmont' }, rw: { rep: { elite: 4 }, cash: 4 * GOODS.champagner.p * 1.6 } };
  if (ty === 'aktie') { const c2 = pickA(Object.keys(COS)); return { ...base, title: 'Ein Wink unter Freunden', text: `Ich höre, die ${COS[c2].n} steht vor großen Dingen. Wenn Sie einsteigen, steigen alle ein. Fünfhundert Aktien, nur so als Zeichen?`, g: { k: 'aktie', c: c2, n: (KT.s.shares[c2] || 0) + 500 }, rw: { rep: { elite: 3 }, kurs: { [c2]: 0.1 } } }; }
  if (ty === 'koffer') return { ...base, title: 'Der vergessene Koffer', text: 'Der Gepäckträger hat meinen Koffer am Güterkai vergessen, beim Hafenamt! Mein Abendkleid ist darin. Würden Sie ihn vors Belmont bringen? Ich warte dort.', g: { k: 'kiste', kind: 'suitcase', from: 'kai', to: 'belmont' }, rw: { rep: { [grp]: 4 } } };
  return null;
}

/* ---------- Zustand ---------- */
function qs() {
  const s = KT.s;
  if (!s.q || !Array.isArray(s.q.list)) s.q = { list: [], nr: 0, ri: 0, mi: 0, bi: 0, mayorT: 140, track: null, done: 0 };
  return s.q;
}
function addQuest(def, st = 'angebot') {
  const Q = qs(), q = JSON.parse(JSON.stringify(def)); q.id = 'q' + (++Q.nr); q.st = st; q.day = KT.s.day;
  if (q.src !== 'buerger') q.who ||= { randolf: 'Randolf · Ihr Butler', mayor: 'Bürgermeister Theodor Hollister', bank: 'Bankdirektor Edmund Varga' }[q.src];
  Q.list.push(q);
  if (st === 'aktiv') startQuest(q);
  ktChanged('quest');
  return q;
}
function startQuest(q) {
  q.st = 'aktiv'; const Q = qs(); Q.track = q.id;
  const g = q.g;
  if (g.k === 'gauner') { g.base = (GEGNER.stats && GEGNER.stats[g.stat]) || 0; if (g.start && GEGNER.start && !GEGNER.ev) setTimeout(() => { try { if (!GEGNER.ev) GEGNER.start(g.start); } catch (e) { /* kein Ort frei */ } }, 9000); }
  if (g.k === 'besitz' && !BIZ[g.id] && g.alt) g.id = g.alt;
  if (g.k === 'kiste') { const P = placeOf(g.from); if (P && !g.at) g.at = [P.x - 1.5, P.y + 0.3, P.z - 1.5]; }
  toast('Aufgabe angenommen: ' + q.title);
  if (q.ci != null) setGiverUse(q);
}
function dropQuest(q, why) {
  const Q = qs(); q.st = 'weg';
  const B = AQ.rt[q.id]; if (B) { releaseBody(B); dropBody(B); delete AQ.rt[q.id]; }
  if (q.ci != null) { const c = citizens[q.ci]; if (c) c.use = null; AQ.givers = AQ.givers.filter(i => i !== q.ci); }
  Q.list = Q.list.filter(x => x !== q); if (Q.track === q.id) Q.track = (Q.list.find(x => x.st === 'aktiv') || {}).id || null;
  if (why) toast(why);
  ktChanged('quest');
}
function finishQuest(q, line) {
  const Q = qs(), rw = q.rw || {};
  q.st = 'fertig'; q.doneDay = KT.s.day; Q.done++;
  const parts = [];
  if (rw.rep) for (const g in rw.rep) { ktRep(g, rw.rep[g]); parts.push(`${GROUP[g]} +${rw.rep[g]}`); }
  if (rw.wohl) { KT.s.wohl = clamp(KT.s.wohl + rw.wohl, 0, 100); parts.push('Wohlstand +' + rw.wohl); }
  if (rw.kurs) for (const c in rw.kurs) KT.s.cp[c] *= 1 + rw.kurs[c];
  if (rw.cash) { ktCash(Math.round(rw.cash), 'Erstattet: ' + q.title); parts.push('+' + fmM(rw.cash)); }
  const B = AQ.rt[q.id]; if (B) { releaseBody(B); dropBody(B); delete AQ.rt[q.id]; }
  if (q.ci != null) { const c = citizens[q.ci]; if (c) c.use = null; AQ.givers = AQ.givers.filter(i => i !== q.ci); }
  const who = q.src === 'buerger' ? q.who.split(' · ')[0] : q.src === 'randolf' ? 'Randolf' : q.src === 'mayor' ? 'Telegramm des Bürgermeisters' : 'Direktor Varga';
  lifeSay(who, line || pickA(THANKS[q.src]), 5);
  toast('Aufgabe erledigt: ' + q.title + (parts.length ? ' · ' + parts.join(' · ') : ''));
  ktEmit('aufgabe', q.title, `${q.who.split(' · ')[0]} dankt Alexander: ${q.title}.`);
  // erledigte nur kurz merken
  const done = Q.list.filter(x => x.st === 'fertig'); if (done.length > 25) Q.list = Q.list.filter(x => x !== done[0]);
  if (Q.track === q.id) Q.track = (Q.list.find(x => x.st === 'aktiv') || {}).id || null;
  ktChanged('quest');
}
const THANKS = {
  buerger: ['Das vergesse ich Ihnen nie, Herr Alexander!', 'Sie sind ein Ehrenmann, Herr Alexander. Wirklich.', 'Ich werde es allen erzählen, Herr Alexander!', 'Danke … ich weiß gar nicht, was ich sagen soll.'],
  randolf: ['Sehr gütig, Sir. Das Haus dankt es Ihnen.', 'Vortrefflich, Sir. Ich kümmere mich um den Rest.', 'Danke, Sir. Wie immer tadellos.'],
  mayor: ['DIE STADT VESPERA DANKT IHREM GRÜNDER STOP HOLLISTER', 'IM NAMEN DES STADTRATS UNSEREN TIEFSTEN DANK STOP', 'VESPERA IST STOLZ AUF SIE STOP HOLLISTER'],
  bank: ['Eine kluge Entscheidung, Herr Alexander. Die Börse wird es Ihnen danken.', 'Die Bank verneigt sich, Herr Alexander.'],
};

/* ---------- Ziele prüfen ---------- */
function hasItem(kind) { return KT.s.items.findIndex(i => i.k === kind); }
function progress(q) {
  const g = q.g, s = KT.s;
  if (g.k === 'ware') { const have = s.lager[g.g] || 0, P = placeOf(g.to); return { ok: false, txt: `${Math.min(have, g.n)}/${g.n} ${GOODS[g.g].n} im Lager · liefern ${P ? P.ort : ''}`, pt: have >= g.n ? P : bestBuyPost(g.g) }; }
  if (g.k === 'ding') {
    const i = hasItem(g.kind);
    if (i < 0) { const S = nearestShop(g.kind); return { txt: `${wareName(g.kind)} kaufen${S ? ' · ' + titleCase(S.name) : ''}`, pt: S ? { x: S.x, y: 0.3, z: S.z, ort: titleCase(S.name) } : null }; }
    return { txt: `${wareName(g.kind)} übergeben an ${g.to === 'randolf' ? 'Randolf' : q.who.split(' · ')[0]}`, pt: giverPos(q) };
  }
  if (g.k === 'gehen') { const P = g.pt || placeOf(g.at); return { txt: 'Gehen Sie ' + (P ? P.ort : ''), pt: P }; }
  if (g.k === 'besitz') { const B = BIZ[g.id]; return { ok: ktOwns(g.id), txt: B ? `${B.n} kaufen (Kontor · Besitz, ${fmM(B.price)})` : 'kaufen' }; }
  if (g.k === 'stift') { const P = PROJECTS[g.id]; return { ok: !!s.proj[g.id], txt: `Stiften: ${P.n} (Kontor · Stiftungen, ${fmM(P.c)})` }; }
  if (g.k === 'aktie') { const have = s.shares[g.c] || 0; return { ok: have >= g.n, txt: `${fmN(have)}/${fmN(g.n)} Aktien ${COS[g.c].n} (Kontor · Börse)` }; }
  if (g.k === 'lager') { const have = s.lager[g.g] || 0; return { ok: have >= g.n, txt: `${have}/${g.n} ${GOODS[g.g].n} im Lager`, pt: have < g.n ? placeOf('bank') : null }; }
  if (g.k === 'gauner') { const n = ((GEGNER.stats && GEGNER.stats[g.stat]) || 0) - (g.base || 0); return { ok: n >= g.n, txt: `${Math.min(n, g.n)}/${g.n} ${g.stat === 'entschaerft' ? 'Bomben entschärft' : 'Gauner gefasst'}` + (GEGNER.ev ? ' · ' + GEGNER.ev.label : ' · bald ist irgendwo Ärger'), pt: gegPt() }; }
  if (g.k === 'kiste') {
    const B = AQ.rt[q.id], to = placeOf(g.to), carried = B && (LOOSE.tk === B || LOOSE.held === B);
    const name = g.kind === 'suitcase' ? 'Koffer' : 'Kiste';
    if (!B) return { txt: `${name} am Güterkai abholen`, pt: placeOf(g.from) };
    const d = Math.hypot(B.x.x - player.p.x, B.x.z - player.p.z);
    return { txt: carried ? `${name} bringen: ${to.ort}` : `${name} holen (rechte Maus: Telekinese)`, pt: carried || d < 6 ? to : { x: B.x.x, y: B.x.y, z: B.x.z, ort: name } };
  }
  return { txt: '' };
}
function gegPt() { const E = GEGNER.ev; if (!E) return null; const pd = E.R || E.dieb || (E.list && E.list[0]); if (pd && pd.gg) return { x: pd.gg.x, y: pd.gg.y || 0.3, z: pd.gg.z, ort: E.label }; return null; }
function bestBuyPost(g) { let best = null, bp = 1e18; for (const pid in POSTS) if (POSTS[pid].f[g]) { const P = placeOf(pid); if (!P) continue; const pr = KT.s.mk[pid][g] > 1 ? ktPrice(pid, g) : 1e17; if (pr < bp) { bp = pr; best = P; } } return best; }
function nearestShop(kind) { let b = null, bd = 1e18; for (const S of SHOPS) if (S.kind === kind && S.host) { const d = (S.x - player.p.x) ** 2 + (S.z - player.p.z) ** 2; if (d < bd) { bd = d; b = S; } } return b; }
function giverPos(q) {
  if (q.g.to === 'randolf') { const R = HS.R; return R ? { x: R.x, y: R.y, z: R.z, ort: 'Randolf' } : { ...placeOf('villa'), ort: 'Randolf in der Villa' }; }
  const c = citizens[q.ci]; if (!c) return null;
  if (c.ped.a && c.ped.a.on) { const e = c.ped.a.m.elements; return { x: e[12], y: e[13], z: e[14], ort: c.name }; }
  const p = c.place || c.at.home; return p ? { x: p.x, y: 0.26, z: p.z, ort: c.name + ' (' + (p.kind === 'home' ? 'zu Hause' : titleCase(p.name)) + ')' } : null;
}
// einmal je Takt: erfüllte Aufgaben abschließen
function checkQuests() {
  const p = player.p;
  for (const q of qs().list.slice()) {
    if (q.st !== 'aktiv') continue;
    const g = q.g;
    if (g.k === 'gehen') { const P = g.pt || placeOf(g.at); if (inside(p, P)) finishQuest(q); }
    else if (g.k === 'besitz' || g.k === 'stift' || g.k === 'aktie' || g.k === 'lager' || g.k === 'gauner') { if (progress(q).ok) finishQuest(q); }
    else if (g.k === 'ding' && g.to === 'randolf') {
      const R = HS.R, i = hasItem(g.kind);
      if (R && i >= 0 && (p.x - R.x) ** 2 + (p.z - R.z) ** 2 < 9 && Math.abs(p.y - R.y) < 2) { KT.s.items.splice(i, 1); finishQuest(q); }
    } else if (g.k === 'ding' && q.ci != null) {
      const c = citizens[q.ci];
      if (c && !(c.ped.a && c.ped.a.on) && hasItem(g.kind) >= 0) {   // drinnen: an der Tür abgeben
        const P = giverPos(q); if (P && (p.x - P.x) ** 2 + (p.z - P.z) ** 2 < 36) { KT.s.items.splice(hasItem(g.kind), 1); finishQuest(q, 'An der Tür abgegeben. Man wird sich erinnern.'); }
      }
    } else if (g.k === 'kiste') kisteStep(q);
  }
}
// Kiste / Koffer: entsteht am Abholort, sobald Alexander näher als 150 m ist; am Ziel nimmt man sie ab
function kisteStep(q) {
  const g = q.g; let B = AQ.rt[q.id];
  if (B && !LOOSE.bodies.includes(B)) B = AQ.rt[q.id] = null;
  if (!B) {
    if (!g.at) return;
    if ((player.p.x - g.at[0]) ** 2 + (player.p.z - g.at[2]) ** 2 > 150 * 150) return;
    B = spawnProp(g.kind, g.at[0], g.at[1], g.at[2], 0.4); if (!B) return;
    B.quest = q.id; AQ.rt[q.id] = B;
  }
  g.at = [B.x.x, B.x.y - B.he.y, B.x.z];
  const to = placeOf(g.to);
  if (to && (B.x.x - to.x) ** 2 + (B.x.z - to.z) ** 2 < to.r * to.r && Math.abs(B.x.y - to.y) < (to.ry || 6)) {
    finishQuest(q, g.to === 'villa' ? 'Vortrefflich, Sir. Ich lasse die Kiste in den Keller tragen.' : 'Mein Koffer! Herr Alexander, Sie sind ein Held!');
  }
}
function releaseBody(B) { try { if (LOOSE.tk === B) tkRelease(false); if (LOOSE.held === B) drop(false); } catch (e) { /* egal */ } }

/* ---------- Lieferung (E am Ziel) ---------- */
function deliverable(p) {
  for (const q of qs().list) {
    if (q.st !== 'aktiv' || q.g.k !== 'ware') continue;
    const P = placeOf(q.g.to); if (!P) continue;
    const big = { ...P, r: Math.max(P.r * 1.6, 6), ry: P.ry || 4 };
    if (inside(p, big) && (KT.s.lager[q.g.g] || 0) >= q.g.n) return q;
  }
  return null;
}
function deliver(q) {
  if (!ktTake(q.g.g, q.g.n)) { toast('Davon ist nicht genug im Lager'); return; }
  finishQuest(q);
}

/* ---------- Bürger mit Anliegen ---------- */
function setGiverUse(q) {
  const c = citizens[q.ci]; if (!c) return;
  if (q.st === 'angebot') c.use = { label: 'Anliegen: ' + c.name, act: () => offerTalk(q) };
  else if (q.st === 'aktiv') c.use = { get label() { return q.g.k === 'ding' && hasItem(q.g.kind) >= 0 ? `Übergeben: ${wareName(q.g.kind)} an ${c.name}` : 'Mit ' + c.name + ' sprechen'; }, act: () => giverActive(q) };
}
function offerTalk(q) {
  lifeSay(q.who.split(' · ')[0], q.text, 9);
  openChoice(q.who, ['Ich kümmere mich darum', 'Jetzt nicht'], i => {
    if (i === 0) { startQuest(q); ktChanged('quest'); }
    else { lifeSay(q.who.split(' · ')[0], 'Natürlich, Herr Alexander. Verzeihen Sie die Störung.', 3); dropQuest(q); }
  });
}
function giverActive(q) {
  const g = q.g, c = citizens[q.ci];
  if (g.k === 'ding') { const i = hasItem(g.kind); if (i >= 0) { KT.s.items.splice(i, 1); finishQuest(q); return; } }
  lifeSay(c ? c.name : '…', pickA(['Haben Sie schon …? Ach, ich will nicht drängen.', 'Ich zähle auf Sie, Herr Alexander.', 'Danke, dass Sie daran denken!']), 3.5);
}
function scanGivers() {
  const Q = qs(), p = player.p;
  // abgelaufene Angebote (zu weit weg) vergessen
  for (const q of Q.list.slice()) if (q.st === 'angebot' && q.ci != null) {
    const c = citizens[q.ci], a = c && c.ped.a;
    const far = !a || !a.on || (a.m.elements[12] - p.x) ** 2 + (a.m.elements[14] - p.z) ** 2 > 220 * 220;
    if (far) dropQuest(q);
  }
  const offers = Q.list.filter(q => q.st === 'angebot' && q.ci != null).length;
  const activeCit = Q.list.filter(q => q.st === 'aktiv' && q.src === 'buerger').length;
  if (offers >= 2 || activeCit >= 3 || p.y > 60 || inPenthouse(p)) return;
  if (Math.random() > 0.55) return;
  const busy = new Set(Q.list.filter(q => q.ci != null && q.st !== 'fertig').map(q => q.ci));
  const cand = [];
  citizens.forEach((c, i) => {
    const a = c.ped.a; if (!a || !a.on || busy.has(i) || c.ped.aw || c.ped.gg) return;
    const e = a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 > 14 * 14 && d2 < 80 * 80 && Math.abs(e[13] - p.y) < 3) cand.push(i);
  });
  if (!cand.length) return;
  const ci = pickA(cand), def = citizenQuest(citizens[ci], ci); if (!def) return;
  const q = addQuest(def, 'angebot'); setGiverUse(q);
}

/* ---------- Randolf, Bürgermeister, Bankdirektor ---------- */
function randolfStep(dt) {
  const R = HS.R, Q = qs(); if (!R) return;
  if ((AQ.randT -= dt) > 0) return;
  AQ.randT = 2;
  const p = player.p; if ((p.x - R.x) ** 2 + (p.z - R.z) ** 2 > 36 || Math.abs(p.y - R.y) > 2.5) return;
  if (Q.list.some(q => q.src === 'randolf' && (q.st === 'angebot' || q.st === 'aktiv'))) return;
  if (Q.rDay === KT.s.day && Q.ri >= RANDOLF.length) return;   // danach höchstens eine Besorgung am Tag
  const def = Q.ri < RANDOLF.length ? RANDOLF[Q.ri] : pickA(RANDOLF_MORE);
  Q.ri++; Q.rDay = KT.s.day;
  const q = addQuest({ ...def, src: 'randolf' }, 'angebot');
  lifeSay('Randolf', def.say, 6); AQ.randT = 30;
  setTimeout(() => offerMenu(q), 1800);
}
function offerMenu(q) {
  if (q.st !== 'angebot') return;
  lifeSay(q.who.split(' · ')[0], q.text, 9);
  openChoice(q.who.split(' · ')[0] + ' · ' + q.title, ['Wird erledigt', 'Später (im Kontor)', 'Nein danke'], i => {
    if (i === 0) { startQuest(q); ktChanged('quest'); }
    else if (i === 2) dropQuest(q, 'Abgelehnt: ' + q.title);
    else toast('Im Kontor unter Aufgaben (Taste I)');
  });
}
function mayorStep(dt) {
  const Q = qs();
  if (Q.list.some(q => q.src === 'mayor' && (q.st === 'angebot' || q.st === 'aktiv'))) return;
  if ((Q.mayorT -= dt) > 0) return;
  Q.mayorT = 360 + Math.random() * 180;
  let def = null;
  for (let k = 0; k < MAYOR.length && Q.mi < MAYOR.length && !def; k++) { const d = MAYOR[Q.mi++]; if (!(d.g.k === 'stift' && KT.s.proj[d.g.id])) def = d; }
  if (!def) def = pickA(MAYOR_MORE);
  const q = addQuest({ ...def, src: 'mayor' }, 'angebot');
  toast('Telegramm von Bürgermeister Hollister: ' + q.title + ' (I: Kontor)');
  lifeSay('Telegramm', 'AN ALEXANDER STOP ' + q.title.toUpperCase() + ' STOP BITTE UM IHRE HILFE STOP HOLLISTER', 6);
}
function bankDirector() {
  const Q = qs();
  openChoice('Bankdirektor Edmund Varga', ['Haben Sie eine Empfehlung?', 'Wie steht die Börse?', 'Das Kontorbuch öffnen', 'Auf Wiedersehen'], i => {
    if (i === 0) {
      if (Q.list.some(q => q.src === 'bank' && (q.st === 'angebot' || q.st === 'aktiv'))) { lifeSay('Direktor Varga', 'Erst das eine, dann das nächste, Herr Alexander. Geduld ist die Mutter des Zinses.', 4); return; }
      let def = null; while (Q.bi < BANK.length && !def) { const d = BANK[Q.bi++]; if (d.g.k === 'stift' && KT.s.proj[d.g.id]) continue; if (d.g.k === 'besitz' && ktOwns(d.g.id)) continue; def = d; }
      if (!def) { lifeSay('Direktor Varga', 'Sie haben alles richtig gemacht, Herr Alexander. Ich habe Ihnen nichts mehr beizubringen.', 4); return; }
      const q = addQuest({ ...def, src: 'bank' }, 'angebot'); setTimeout(() => offerMenu(q), 300);
    } else if (i === 1) {
      const best = Object.keys(COS).map(c => { const h = KT.s.hist[c]; return [c, h.length > 1 ? KT.s.cp[c] / h[h.length - 2] - 1 : 0]; }).sort((a, b) => b[1] - a[1]);
      lifeSay('Direktor Varga', `${COS[best[0][0]].n} steigt, ${COS[best[best.length - 1][0]].n} fällt. Ihr Vermögen, Herr Alexander: ${fmM(netWorth())}.`, 6);
    } else if (i === 2) setTimeout(() => ktOpen('boerse'), 50);
  });
}

/* ---------- Anzeige: Verfolgte Aufgabe und Rauten ---------- */
function markEl(i) {
  if (!AQ.marks[i]) { const d = document.createElement('div'); d.className = 'ktMk'; d.innerHTML = '<span></span><b></b>'; d.hidden = true; document.body.append(d); AQ.marks[i] = d; }
  return AQ.marks[i];
}
function showMark(i, pt, text, giver) {
  const el = markEl(i);
  _pv.set(pt.x, pt.y, pt.z).project(camera);
  if (_pv.z > 1 || _pv.z < -1 || Math.abs(_pv.x) > 1.05 || Math.abs(_pv.y) > 1.05) { el.hidden = true; return; }
  el.hidden = false; el.classList.toggle('giver', !!giver);
  el.style.left = ((_pv.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; el.style.top = ((1 - _pv.y) / 2 * innerHeight).toFixed(0) + 'px';
  if (el._t !== text) { el._t = text; el.querySelector('b').textContent = text; el.querySelector('span').textContent = giver ? '!' : ''; }
}
function hudStep() {
  const Q = qs(), hud = $('ktHud'), qel = hud && hud.querySelector('.q');
  let mi = 0;
  const show = playing && !paused && !KT.open;
  if (show) {
    // Bürger mit Anliegen: goldener Kreis über dem Kopf (bis 70 m)
    for (const q of Q.list) if (q.st === 'angebot' && q.ci != null) {
      const c = citizens[q.ci], a = c && c.ped.a; if (!a || !a.on) continue;
      const e = a.m.elements, d = Math.hypot(e[12] - player.p.x, e[14] - player.p.z); if (d > 70) continue;
      showMark(mi++, { x: e[12], y: e[13] + 2.2 * (c.ped.sc || 1), z: e[14] }, d > 12 ? Math.round(d) + ' m' : '', true);
    }
  }
  const tq = Q.list.find(q => q.id === Q.track && q.st === 'aktiv');
  if (qel) {
    if (tq && playing) {
      const pr = progress(tq), pt = pr.pt;
      let dist = '', arrow = '';
      if (pt) {
        const dx = pt.x - player.p.x, dz = pt.z - player.p.z, d = Math.hypot(dx, dz);
        const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
        const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
        dist = d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1).replace('.', ',') + ' km';
        arrow = `<em style="transform:rotate(${ang.toFixed(2)}rad)">▲</em>`;
        if (show) showMark(mi++, { x: pt.x, y: (pt.y || 0) + 2.6, z: pt.z }, (pt.ort ? pt.ort + ' · ' : '') + dist, false);
      }
      const html = `<b>${esc(tq.title)}</b>${arrow}<br>${esc(pr.txt)}${dist ? ' · ' + dist : ''}`;
      if (qel._h !== html) { qel._h = html; qel.innerHTML = html; }
      qel.hidden = false;
    } else qel.hidden = true;
  }
  for (let i = mi; i < AQ.marks.length; i++) AQ.marks[i].hidden = true;
}

/* ---------- Reiter im Kontorbuch ---------- */
const SRC_N = { buerger: 'Bürger', randolf: 'Randolf', mayor: 'Bürgermeister', bank: 'Bank' };
function questCard(q) {
  const pr = q.st === 'aktiv' ? progress(q) : null, Q = qs();
  let btn = '';
  if (q.st === 'angebot') btn = `<button type="button" class="gold" data-act="qok" data-id="${q.id}">Annehmen</button> <button type="button" data-act="qno" data-id="${q.id}">Ablehnen</button>`;
  else if (q.st === 'aktiv') {
    btn = (Q.track === q.id ? '<span class="up" style="font-size:12px">wird verfolgt</span>' : `<button type="button" data-act="qtrack" data-id="${q.id}">Verfolgen</button>`) + ` <button type="button" data-act="qno" data-id="${q.id}">Aufgeben</button>`;
    if (q.g.k === 'kiste' && !AQ.rt[q.id]) btn += ` <button type="button" data-act="qnew" data-id="${q.id}">Neu am Abholort bereitstellen</button>`;
  }
  return `<div class="q ${q.st}"><b>${esc(q.title)}</b><span class="who">${esc(q.who)}</span><p>${esc(q.text)}</p>${pr ? `<p class="up">${esc(pr.txt)}</p>` : ''}${rwText(q)}<div class="btns">${btn}</div></div>`;
}
function rwText(q) {
  const rw = q.rw || {}, parts = [];
  if (rw.rep) for (const g in rw.rep) parts.push(`${GROUP[g]} +${rw.rep[g]}`);
  if (rw.wohl) parts.push('Wohlstand +' + rw.wohl);
  if (rw.cash) parts.push(fmM(rw.cash));
  if (rw.kurs) for (const c in rw.kurs) parts.push(`Kurs ${COS[c].n} +${Math.round(rw.kurs[c] * 100)} %`);
  return parts.length ? `<p style="font-size:12px">Belohnung: ${esc(parts.join(' · '))}</p>` : '';
}
const AUF_TAB = {
  render() {
    const Q = qs(), act = Q.list.filter(q => q.st === 'aktiv'), off = Q.list.filter(q => q.st === 'angebot' && q.ci == null), done = Q.list.filter(q => q.st === 'fertig').slice().reverse();
    const items = KT.s.items.length ? KT.s.items.map(i => esc(i.n)).join(', ') : 'nichts';
    return `<h3>Laufende Aufgaben</h3>${act.map(questCard).join('') || '<p>Keine. Bürger mit einem goldenen Kreis über dem Kopf haben ein Anliegen (E). Randolf spricht Sie in der Villa an, der Bürgermeister telegrafiert, Direktor Varga berät in der Bank.</p>'}
      ${off.length ? '<h3>Angebote</h3>' + off.map(questCard).join('') : ''}
      <h3>In der Tasche</h3><p>${items} <button type="button" data-act="inv" style="margin-left:6px">Inventar · Umschalt+I</button></p>
      <h3>Erledigt (${Q.done})</h3>${done.length ? '<p>' + done.map(q => `${esc(q.title)} <span style="opacity:.6">(${esc(SRC_N[q.src])})</span>`).join(' · ') + '</p>' : '<p>Noch nichts.</p>'}`;
  },
  click(a, id) {
    if (a === 'inv') { invOpen('taschen'); return; }   // V62
    const Q = qs(), q = Q.list.find(x => x.id === id); if (!q) return;
    if (a === 'qok') { startQuest(q); ktChanged('quest'); }
    else if (a === 'qno') dropQuest(q, (q.st === 'aktiv' ? 'Aufgegeben: ' : 'Abgelehnt: ') + q.title);
    else if (a === 'qtrack') { Q.track = q.id; ktChanged('quest'); }
    else if (a === 'qnew') { const P = placeOf(q.g.from); if (P) q.g.at = [P.x - 1.5, P.y + 0.3, P.z - 1.5]; toast('Liegt wieder am Abholort bereit'); ktChanged('quest'); }
  },
};

/* ---------- Anschluss ans Kontor ---------- */
function aufInit() {
  const Q = qs();
  // Bürger-Angebote überleben keinen Neustart; laufende Bürgeraufgaben behalten ihren Menschen
  Q.list = Q.list.filter(q => !(q.st === 'angebot' && q.ci != null));
  for (const q of Q.list) if (q.st === 'aktiv' && q.ci != null) { if (citizens[q.ci]) setGiverUse(q); else q.ci = null; }
  if (AQ.inited) return; AQ.inited = true;
  KT.tabs.aufgaben = AUF_TAB;
  INTERACT.unshift({ test: p => !KT.open && !!(AQ.dq = deliverable(p)), get label() { const q = AQ.dq; return q ? `Liefern: ${q.g.n} ${GOODS[q.g.g].n} · ${q.title}` : ''; }, act: () => AQ.dq && deliver(AQ.dq) });
  const Bk = ORTE.bank;
  if (Bk && Bk.hx != null) { const dx = Bk.hx + 8.5, dz = Bk.cz - 5.5; INTERACT.push({ test: p => (p.x - dx) ** 2 + (p.z - dz) ** 2 < 2.4 * 2.4 && Math.abs(p.y - Bk.F) < 2 && !KT.open, label: 'Mit Bankdirektor Varga sprechen', act: bankDirector }); }
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { aufInit(); return; }
  if (why === 'reset') { AQ.givers = []; for (const id in AQ.rt) { releaseBody(AQ.rt[id]); dropBody(AQ.rt[id]); } AQ.rt = {}; citizens.forEach(c => { if (c.use && /^(Anliegen|Mit |Übergeben)/.test(c.use.label)) c.use = null; }); qs(); return; }
  if (why !== 'frame' || !KT.ready) return;
  if (playing && !paused) {
    if ((AQ.tickT -= dt) <= 0) { AQ.tickT = 0.25; checkQuests(); }
    if ((AQ.scanT -= dt) <= 0) { AQ.scanT = 7; scanGivers(); }
    randolfStep(dt); mayorStep(dt);
  }
  hudStep();
});
export { AQ, addQuest, finishQuest, progress, placeOf, citizenQuest };
