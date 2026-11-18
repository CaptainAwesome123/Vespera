/* =====================================================================
   V113 · MEHR GESPRÄCHE, KLÜGERE MENSCHEN
   Die Sprechblasen (V107, V111) kamen gut an. Jetzt reden die Leute viel
   mehr, länger und vor allem über das, was gerade wirklich los ist:
   - VIEL MEHR TEXT: neue, längere Gespräche (bis zu sechs Zeilen) für die
     Runden auf der Straße, für Paare, Freunde und Familien.
   - AUS DER LAGE (klüger): die Leute reden über das, was sie selbst erlebt
     haben (Gedächtnis: „Er hat mir gestern zwanzig Lumen geschenkt“), über
     den Unfall vorhin um die Ecke (V110), darüber, dass Alexander eben
     vorbeigegangen ist, über den Schichtwechsel, die späte Stunde und die
     Gala im Belmont.
   - DRINNEN: im Belmont (Lobby, Ballsaal, Galerien) tuscheln die Gäste
     in Sprechblasen über Geld, Hallstein, Jo Lafleur und Alexander; in der
     Brass Lantern reden die Arbeiter am Tisch, im Café und im Restaurant die
     Bürger, im Theater das Publikum.
   - MIT ALEXANDER: drei neue Fragen im Gespräch (Arbeit, Sorgen, Erlebtes),
     die Antworten kennen den Beruf, den Arbeitsort und die Erinnerungen der
     Person; vier statt drei Fragen je Gespräch.
   - AUFMERKSAM: wer merkt, dass Alexander ihm hinterhergeht, dreht sich um
     und sagt etwas (oder geht schneller).
   Kosten: Prüfungen alle 0,5 bis 1,5 s, nur in Alexanders Nähe; keine Shader.
   ?plaudern=aus = Stand V112.
   ===================================================================== */
import { T, MOBILE, camera, shared } from './core.js';
import { peds, turnHead } from './serpentine.js';
import { player } from './player.js';
import { attOf } from './awe.js';
import { CLOCK } from './ragdoll.js';
import { KT } from './kontor.js';
import './gedaechtnis.js';
import { GS, ALEX, STREIK, ARBEIT, WETTER, STADT, WITZ } from './gespraeche.js';
import { GR, PAAR, FREUNDE, FAMILIE, UEBER } from './gruppen.js';
import { UH, OPTS, fillC } from './unterhaltung.js';
import { EV } from './ereignisse.js';
import { GALA } from './gala.js';
import { interiorCrowd, inBelmont } from './belmont.js';
import { VENUES } from './venues.js';
import { lifeSay } from './life.js';
import { playing, paused } from './input.js';
import { DRIVE } from './eating.js';
import { STR } from './strasse.js';
import { LIFE } from './life.js';
import { walk, stand, pos, begin, goHome, clear } from './reaktionen.js';
import { ZEITUNG } from './zeitung.js';
import { canHelp } from './ablaeufe.js';

export const PLAUDERN = typeof location === 'undefined' || new URLSearchParams(location.search).get('plaudern') !== 'aus';
export const PL = { ready: false, talks: [], seen: [], clock: 0, tickT: 0.45, inT: 0, seenT: 0, folT: 0, fol: null, folS: 0, n: { inside: 0, venue: 0, ctx: 0, follow: 0, frage: 0, kauf: 0, zeitung: 0 }, errT: 6, added: 0 };
const pick = a => a[Math.floor(Math.random() * a.length)];

/* =====================================================================
   1) MEHR TEXT für die Straße (gespraeche.js) und die Gruppen (gruppen.js)
   Zeilen: 'A: …' (A/B/C = erster, zweiter, dritter); ' *' am Ende = Lachen
   ===================================================================== */
const MEHR_ALEX = {
  bew: [
    ['A: Ich hab ihn neulich vor dem Belmont gesehen. Ganz ohne Leibwache.', 'B: Der braucht keine Leibwache. Der kann ja fliegen.', 'A: Er hat mir zugenickt. Mir!', 'B: Dir oder dem Mann hinter dir?', 'A: … Mir. Glaub ich. *'],
    ['A: Als ich herkam, war hier nur Eis und ein Loch im Boden.', 'B: Und jetzt? Straßenbahnen, Theater, ein Hafen.', 'A: Man kann über ihn sagen, was man will. Gebaut hat er.'],
    ['A: Mein Junge will später auch Türme bauen. Wie Alexander.', 'B: Dann soll er erst mal einen Krater finden. *'],
  ],
  neid: [
    ['A: Er hat sich wieder ein Gemälde gekauft. Für sein Penthouse.', 'B: Was kostet so was?', 'A: Mehr als dieser ganze Block.', 'B: Und wir hängen Kalender auf. *'],
    ['A: Stell dir vor, du wachst auf und gehörst dir selbst. Und der halben Stadt dazu.', 'B: Ich wach auf und gehöre meinem Vermieter.', 'A: Siehst du. Kleiner Unterschied. *'],
    ['A: Der Kristall hat ihn reich gemacht, nicht seine Arbeit.', 'B: Erzähl das nicht ihm.', 'A: Erzähl ich auch nicht. Ich erzähl’s dir.'],
  ],
  skep: [
    ['A: Er hat eine neue Stiftung gegründet, heißt es.', 'B: Für wen?', 'A: Für die Armen.', 'B: Und wer hat die Armen gemacht?', 'A: Frag nicht so laut.'],
    ['A: Er sagt, Vespera gehört allen, die hier leben.', 'B: Dann soll er mir meinen Anteil auszahlen. *'],
    ['A: Ich trau keinem, der so viel lächelt.', 'B: Er lächelt doch gar nicht so viel.', 'A: Eben. Dann trau ich ihm noch weniger. *'],
  ],
  hass: [
    ['A: Mein Bruder hat drei Jahre in seiner Gießerei gearbeitet.', 'B: Und?', 'A: Jetzt hustet er. Und Alexander baut einen neuen Turm.', 'B: Irgendwann kommt die Rechnung. Für ihn auch.'],
    ['A: Sie haben wieder Leute entlassen. Ohne Grund.', 'B: Der Grund heißt Gewinn.', 'A: Den Gewinn sollte man mal entlassen.'],
  ],
  furcht: [
    ['A: Ich hab gehört, er hört alles, was in der Stadt gesagt wird.', 'B: Unsinn.', 'A: Dann sag doch mal laut, was du von ihm hältst.', 'B: … Lass uns lieber übers Wetter reden.'],
    ['A: Wenn er über die Dächer fliegt, ziehen die Kinder die Köpfe ein.', 'B: Nicht nur die Kinder.'],
  ],
};
const MEHR_ARBEIT = {
  a: [
    ['A: Der neue Vorarbeiter zählt sogar die Pinkelpausen.', 'B: Bei uns schreibt er sie auf.', 'C: Bei uns gibt’s keine.', 'A: Dann seid ihr wenigstens schnell fertig. *'],
    ['A: Im Kesselhaus ist gestern einer umgekippt. Hitze.', 'B: Und?', 'A: Haben ihn rausgetragen und weitergearbeitet.', 'B: So ist das hier. Die Maschinen stehen nie still.'],
    ['A: Ich spar für eine Fahrkarte nach Süden.', 'B: Wie lange schon?', 'A: Sieben Jahre.', 'B: Und wie weit bist du?', 'A: Bis zur Haltestelle am Hafen. *'],
    ['A: Weißt du, wer die Krone vom Belmont vergoldet hat?', 'B: Wer?', 'A: Mein Vater. Mit eigenen Händen. Und er war nie drin.'],
  ],
  b: [
    ['A: Mein Laden läuft, seit die Hochbahn bei uns hält.', 'B: Dann danke Alexander.', 'A: Ich danke der Hochbahn. Die hat nicht so viele Häuser. *'],
    ['A: Die Bank hat mir den Kredit gegeben.', 'B: Gratuliere!', 'A: Zu zwölf Prozent.', 'B: … Ich nehm’s zurück.'],
    ['A: Ich verkaufe jetzt Pelzmützen an die Leute aus den Türmen.', 'B: Läuft’s?', 'A: Wie geschmiert. Da oben friert man vornehmer. *'],
    ['A: Hast du die Aktien von der Kristallwerft gekauft?', 'B: Eine.', 'A: Eine?', 'B: Zum Einrahmen. Mehr war nicht drin.'],
  ],
};
const MEHR_STADT = {
  a: [
    ['A: Am Hafen soll ein Eisbär gesehen worden sein.', 'B: Ein Eisbär? In der Stadt?', 'A: Sagt der alte Pieter.', 'B: Der alte Pieter sieht auch Meerjungfrauen. *'],
    ['A: Im Brass Lantern gibt’s ab heute dunkles Bier vom Fass.', 'B: Dann weiß ich, wo ich nach der Schicht bin.', 'A: Wie jeden Tag.', 'B: Aber diesmal mit gutem Grund. *'],
    ['A: Die Straßenbahn Linie 2 ist schon wieder stehen geblieben.', 'B: Eis auf den Schienen?', 'A: Der Fahrer hat Kaffee getrunken. *'],
  ],
  b: [
    ['A: Im Theater geben sie heute ein neues Stück.', 'B: Worum geht’s?', 'A: Um einen reichen Mann, der eine Stadt baut.', 'B: Wie originell.', 'A: Am Ende fällt der Turm um. Mal sehen, ob es zugelassen wird.'],
    ['A: Hast du das neue Café Kranich probiert?', 'B: Der Kuchen ist gut, die Preise sind eine Frechheit.', 'A: Also typisch Vespera. *'],
    ['A: Man sagt, Hallstein will ein eigenes Luftschiff bauen. Größer als Alexanders.', 'B: Die zwei spielen wie Kinder mit Spielzeug.', 'A: Nur dass ihr Spielzeug ganze Viertel kostet.'],
    ['A: Margot Wendt vom Kurier hat wieder Ärger.', 'B: Weswegen?', 'A: Sie hat geschrieben, was alle denken.', 'B: Das ist in Vespera das Gefährlichste überhaupt.'],
  ],
};
const MEHR_WETTER = [
  ['A: Mir sind heute früh die Wimpern zusammengefroren.', 'B: Früh? Hier ist immer früh. Oder immer spät.', 'A: Dann eben heute spät. *'],
  ['A: Siehst du die Sterne über dem Kraterrand?', 'B: So klar sieht man sie nur hier.', 'A: Das ist das Gute an der ewigen Nacht.', 'B: Das Einzige. *'],
  ['A: Der Wind pfeift durch jede Ritze in meiner Wohnung.', 'B: Stopf Zeitung rein.', 'A: Den Kurier? Dafür ist er wirklich gut. *'],
];
const MEHR_WITZ = [
  ['A: Wie viele Arbeiter braucht man, um eine Glühbirne im Belmont zu wechseln?', 'B: Wie viele?', 'A: Einen. Und drei Aufseher, die aufpassen, dass er nichts mitnimmt. *'],
  ['A: Mein Arzt sagt, ich brauche mehr Sonne.', 'B: Und?', 'A: Hab ihm gesagt, er soll Alexander fragen. Der kauft doch sonst auch alles. *'],
  ['A: Ich hab heute einen Lumen auf der Straße gefunden.', 'B: Glückspilz!', 'A: Dann kam der Mann, dem er gehörte. Und der Mann, dem der Mann gehört. *'],
  ['A: Warum tragen die Damen in den Türmen so große Hüte?', 'B: Warum?', 'A: Damit sie nicht sehen müssen, was unten los ist. *'],
];
const MEHR_STREIK = {
  a: [['A: Die Streikkasse ist fast leer.', 'B: Dann sammeln wir am Hafen.', 'C: Die Seeleute geben immer was.', 'A: Und wenn das nicht reicht?', 'B: Dann reicht unser Mut. Der kostet nichts.']],
  b: [['A: Die Arbeiter streiken, und mein Kohlenhändler hat keine Kohle mehr.', 'B: Dann frierst du wenigstens solidarisch. *']],
};
const MEHR_PAAR = [
  ['B: Du hast mir nie gesagt, dass du tanzen kannst.', 'A: Kann ich auch nicht.', 'B: Auf der Gala hast du getanzt!', 'A: Da hab ich nur nicht aufgehört. *'],
  ['A: Wenn wir genug gespart haben, ziehen wir in den Turm am Park.', 'B: In welchen Stock?', 'A: In den Keller. Aber es ist ein vornehmer Keller. *'],
  ['B: Du schaust schon wieder zu den Luftschiffen hinauf.', 'A: Eines Tages fliegen wir mit.', 'B: Eines Tages zahlst du erst mal die Miete.'],
  ['A: Hast du gesehen, wie die Dame da drüben dich angesehen hat?', 'B: Welche Dame?', 'A: Na, die im Pelz.', 'B: Die hat meinen Mantel angesehen. Der ist von ihr. Aus zweiter Hand. *'],
  ['B: Erzähl mir was Schönes.', 'A: Morgen ist Zahltag.', 'B: Das ist nicht schön, das ist nur pünktlich.'],
  ['A: Sollen wir am Sonntag zum Kraterrand fahren?', 'B: Bei der Kälte?', 'A: Da sieht man das Nordlicht über der ganzen Stadt.', 'B: Na gut. Aber du trägst den Korb.'],
];
const MEHR_FREUNDE = [
  ['A: Ich hab mich beim Hafenamt beworben.', 'B: Als was?', 'A: Als Schreiber.', 'C: Du kannst doch kaum lesen.', 'A: Schreiben kann ich ja. Lesen müssen die anderen. *'],
  ['A: Gestern im Brass Lantern hat einer auf dem Tisch getanzt.', 'B: Wer?', 'A: Rate mal.', 'B: … Ich war das, oder?', 'A: Und wie. *'],
  ['A: Was würdest du machen, wenn du Alexanders Geld hättest?', 'B: Ich würde die Bahn kaufen. Und dann umsonst fahren.', 'A: Und dann?', 'B: Dann würde ich die Bahn wieder verkaufen. An ihn. *'],
  ['A: Mein Vermieter hat schon wieder geklopft.', 'B: Hast du aufgemacht?', 'A: Bin ich verrückt? Ich hab so getan, als wär ich eine Katze.', 'B: Und?', 'A: Er hat mich gefüttert. *'],
  ['A: Hast du von dem Mann gehört, der in den Krater gestiegen ist?', 'B: Wegen des Kristalls?', 'A: Sie haben ihn nie wieder gesehen.', 'C: Erzähl doch nicht solche Geschichten im Dunkeln.'],
];
const MEHR_FAMILIE = [
  ['K: Mama, warum hat der Mann da keine Schuhe?', 'A: Weil er sie sich nicht leisten kann, Schatz.', 'K: Kann ich ihm meine geben?', 'A: … Lass uns morgen mal nachsehen, was wir übrig haben.'],
  ['K: Ich will auch fliegen können!', 'A: Dafür musst du deinen Teller aufessen.', 'K: Hat Alexander auch immer seinen Teller aufgegessen?', 'A: Bestimmt. Jeden Krümel. *'],
  ['K: Papa, warum riecht es hier nach Rauch?', 'A: Das sind die Fabriken, mein Junge.', 'K: Arbeitest du auch in einer Fabrik?', 'A: Jeden Tag. Damit du es mal besser hast.'],
  ['K: Darf ich heute länger aufbleiben?', 'A: Es ist doch immer Nacht. Woher willst du wissen, wann länger ist?', 'K: Die Uhr sagt es mir.', 'A: Die Uhr sagt: Bett. *'],
  ['K: Ist das Belmont aus Gold?', 'A: Nur die Spitze.', 'K: Wenn ich groß bin, kaufe ich mir die Spitze.', 'A: Dann vergiss deine alte Mutter nicht. *'],
];
const MEHR_UEBER = {
  gut: [['A: Er hat die Bahn bis ins Arbeiterviertel bauen lassen.', 'B: Damit wir pünktlich zur Schicht kommen.', 'A: Trotzdem. Früher sind wir eine Stunde gelaufen.']],
  mittel: [['A: Weißt du, was ich glaube? Er ist einsam da oben.', 'B: Mit all dem Geld?', 'A: Gerade deshalb.']],
  schlecht: [['A: Er hat die Polizei auf die Streikenden gehetzt, sagen sie.', 'B: Sagen sie oder war es so?', 'A: In Vespera ist das dasselbe.']],
};
function addContent() {
  const push = (arr, more) => { for (const L of more) { arr.push(L); PL.added++; } };
  for (const k of Object.keys(MEHR_ALEX)) if (ALEX[k]) push(ALEX[k], MEHR_ALEX[k]);
  for (const k of ['a', 'b']) { push(ARBEIT[k], MEHR_ARBEIT[k]); push(STADT[k], MEHR_STADT[k]); push(STREIK[k], MEHR_STREIK[k]); }
  push(WETTER.sonst, MEHR_WETTER); push(WITZ, MEHR_WITZ);
  push(PAAR, MEHR_PAAR); push(FREUNDE, MEHR_FREUNDE); push(FAMILIE, MEHR_FAMILIE);
  for (const k of Object.keys(MEHR_UEBER)) push(UEBER[k], MEHR_UEBER[k]);
}

/* =====================================================================
   2) AUS DER LAGE: Themen, die nur jetzt passen
   ===================================================================== */
const today = () => (KT.s ? KT.s.day | 0 : 0);
const wann = m => { const d = today() - (m.d | 0); return d <= 0 ? (Date.now() - (m.ts || 0) < 12 * 60000 ? 'vorhin' : 'heute') : d === 1 ? 'gestern' : 'neulich'; };
// was einer selbst mit Alexander erlebt hat: Auftakt (der Betroffene) und Antwort nach Haltung
const ERLEBT = {
  gabe: ['Stell dir vor, Alexander hat mir {wann} zwanzig Lumen geschenkt. Einfach so.', 'Na, das ist doch was!', 'Zwanzig Lumen. Das ist für ihn wie für uns ein Funken.'],
  abgewiesen: ['Ich hab ihn {wann} angesprochen, und er hat mich abgewimmelt wie einen Hund.', 'Er hat eben viel zu tun.', 'So sind sie da oben. Merk dir das.'],
  hilfe: ['Er hat mir {wann} geholfen, als ich nicht mehr weiterwusste.', 'Siehst du, er hat ein Herz.', 'Und was will er dafür?'],
  nein: ['Ich hab ihn {wann} um Hilfe gebeten. Er hat nein gesagt.', 'Vielleicht hatte er seine Gründe.', 'Natürlich hat er das.'],
  autogramm: ['Ich hab ein Autogramm von Alexander! Von {wann}!', 'Zeig her! Das häng ich mir auch an die Wand.', 'Und was machst du damit? Davon wird keiner satt.'],
  wurf: ['Er hat mich {wann} durch die Luft geworfen. Mich!', 'Du lebst ja noch.', 'Und keiner hat was gesagt. Keiner!'],
  heben: ['Ich hab {wann} geschwebt. Er hat mich einfach hochgehoben, ohne mich anzufassen.', 'Wie war das?', 'Ich hab heute noch Angst, wenn ich ihn sehe.'],
  stoss: ['Sein Licht hat mich {wann} umgeworfen. Mein Knie ist immer noch blau.', 'Pass halt besser auf, wo du stehst.', 'Der fragt nicht mal, ob einer im Weg ist.'],
  welle: ['Ich war {wann} dabei, als es geknallt hat. Ich lag einfach auf der Straße.', 'Hauptsache, dir ist nichts passiert.', 'Und morgen knallt es wieder. Bei ihm weiß man nie.'],
  runde: ['Er hat uns {wann} eine Runde ausgegeben, im Lokal!', 'Ein feiner Zug.', 'Eine Runde. Der Lohn bleibt trotzdem, wie er ist.'],
  tip: ['Er hat mir {wann} ein Trinkgeld gegeben. Ein richtiges!', 'Na also!', 'Er kann es sich ja leisten.'],
  kauf: ['Er hat {wann} bei mir eingekauft. Persönlich!', 'Das erzählst du noch deinen Enkeln.', 'Und gehandelt hat er bestimmt auch.'],
  schneeball: ['Ich hab gesehen, wie {wann} einer Alexander mit einem Schneeball getroffen hat!', 'Unerhört!', 'Das war der beste Wurf des Jahres. *'],
};
function erlebtLines(m, letterOf) {
  const out = [];
  for (const pd of m) {
    const p = pd.mem && pd.mem.p; if (!p || !ERLEBT[p.k] || today() - (p.d | 0) > 3) continue;
    const L = ERLEBT[p.k], o = m.find(q => q !== pd); if (!o) continue;
    const warm = ['bew', 'resp', 'dienst'].includes(attOf(o)), s = letterOf(pd), t = letterOf(o);
    out.push({ id: 'pe:' + p.k + p.d + p.ts, lines: [s + ': ' + L[0].replace('{wann}', wann(p)), t + ': ' + (warm ? L[1] : L[2])] });
  }
  return out;
}
// der Unfall vorhin, die Polizei (ereignisse.js)
function ereignisLines(x, z) {
  const out = [];
  for (const E of EV.list || []) {
    if (EV.clock - E.t > 240 || (E.x - x) ** 2 + (E.z - z) ** 2 > 140 * 140) continue;
    const L = E.kind === 'crash'
      ? (E.byHim ? ['A: Hast du den Unfall vorhin gesehen? Das war sein Wagen!', 'B: Und? Kriegt er eine Strafe?', 'A: Der Polizist hat sich bei ihm entschuldigt. *'] : ['A: Da vorn hat es eben gekracht. Zwei Automobile.', 'B: Bei dem Glatteis kein Wunder.', 'A: Die Leute fahren hier, als gehörte ihnen die Straße.'])
      : (E.byHim ? ['A: Er hat vorhin jemanden umgerannt. Einfach so.', 'B: Hat er sich entschuldigt?', 'A: Er? Wofür denn?'] : ['A: Da ist vorhin einer gestürzt, gleich da drüben.', 'B: Hat ihm jemand geholfen?', 'A: Zum Glück, ja. Es gibt noch anständige Leute.']);
    if (E.cop) L.push('B: Und die Polizei war auch gleich da.');
    out.push({ id: 'ev:' + E.t.toFixed(0), lines: L });
  }
  return out;
}
// Alexander ist eben vorbeigekommen (Spur seiner Wege der letzten drei Minuten)
function gesehenLines(x, z, st) {
  const p = player.p; if ((p.x - x) ** 2 + (p.z - z) ** 2 < 18 * 18) return [];
  const s = PL.seen.find(q => PL.clock - q.t < 180 && (q.x - x) ** 2 + (q.z - z) ** 2 < 14 * 14);
  if (!s) return [];
  const L = st === 'bew' || st === 'resp' ? ['A: Hast du ihn gesehen? Alexander ist eben hier vorbeigegangen!', 'B: Wirklich? Zu Fuß?', 'A: Wie du und ich. Na ja, nicht ganz wie du und ich. *']
    : st === 'furcht' ? ['A: Er war eben hier. Direkt neben uns.', 'B: Ich hab die Luft angehalten.', 'A: Ich auch. Ich atme immer noch nicht richtig.']
    : ['A: Hast du gesehen, wer da eben vorbei ist?', 'B: Der Herr höchstpersönlich. Schaut sich wohl sein Eigentum an.', 'A: Wir sind ja auch sein Eigentum. Irgendwie.'];
  return [{ id: 'se:' + Math.floor(s.t / 60), lines: L }];
}
// Uhrzeit: Schichtwechsel und späte Stunde
function zeitLines(reg) {
  const m = CLOCK.min % 1440, h = m / 60, out = [];
  for (const s of [6, 14, 22]) { const d = s * 60 - m; if (d > 0 && d < 50 && reg === 'a') out.push({ id: 'zs:' + s, lines: ['A: Noch eine halbe Stunde bis zum Schichtwechsel.', 'B: Dann geh ich gleich los. Wer zu spät kommt, dem ziehen sie eine Stunde ab.', 'A: Für fünf Minuten eine Stunde. Das ist die Mathematik vom Vorarbeiter.'] }); }
  if (h >= 0 && h < 4) out.push({ id: 'zn', lines: reg === 'a' ? ['A: Schon nach Mitternacht. Ich muss in fünf Stunden wieder ran.', 'B: Dann geh schlafen.', 'A: Schlafen? Bei dem Lärm aus dem Brass Lantern? *'] : ['A: Schon nach Mitternacht, und die Stadt schläft nicht.', 'B: Woran merkt man das hier überhaupt?', 'A: Am Brass Lantern. Wenn der leise wird, ist es spät. *'] });
  return out;
}
function galaLines(reg) {
  if (!GALA || !(GALA.done > 0)) return [];
  return [{ id: 'ga:' + GALA.done, lines: reg === 'b' ? ['A: Warst du bei der Gala im Belmont?', 'B: Ich? Ich stand draußen und hab das Feuerwerk gesehen.', 'A: Das war das Beste daran, sagen alle, die drin waren.', 'B: Siehst du, ich hab das Beste umsonst bekommen. *'] : ['A: Hast du das Feuerwerk über dem Belmont gesehen?', 'B: Ich hab mitgezählt, was jede Rakete kostet.', 'A: Und?', 'B: Bei der dritten hab ich aufgehört. Mir wurde schlecht.'] }];
}
// alles, was gerade passt (für die Straße: gespraeche.js)
function streetExtra(add, m, reg, st) {
  const e = m[0] && m[0].a && m[0].a.m.elements; if (!e) return;
  const letter = pd => 'ABC'[m.indexOf(pd)] || 'A';
  for (const t of erlebtLines(m, letter)) add(6, t.id, t.lines);
  for (const t of ereignisLines(e[12], e[14])) add(5, t.id, t.lines);
  for (const t of gesehenLines(e[12], e[14], st)) add(4, t.id, t.lines);
  for (const t of zeitLines(reg)) add(2.5, t.id, t.lines);
  for (const t of galaLines(reg)) add(1.5, t.id, t.lines);
}
// für Paare, Freunde und Familien (gruppen.js): ein Thema aus der Lage oder nichts
function groupCtx(G) {
  const e = G.L.a && G.L.a.m.elements; if (!e) return null;
  const adults = G.m.filter(pd => (pd.kind || pd.a.kind) !== 'kid');
  const letter = pd => pd === adults[0] ? 'A' : pd === (adults[1] || G.m[1]) ? 'B' : 'C';
  const reg = G.m.some(pd => pd.a.kind === 'worker' || pd.a.kind === 'braces' || pd.a.kind === 'jacket') ? 'a' : 'b';
  const st = attOf(G.L);
  const L = [...erlebtLines(adults, letter), ...ereignisLines(e[12], e[14]), ...gesehenLines(e[12], e[14], st), ...zeitLines(reg), ...galaLines(reg)].filter(t => !G.used || !G.used.has(t.id));
  if (!L.length) return null;
  const t = L[0]; (G.used || (G.used = new Set())).add(t.id); PL.n.ctx++;
  return t.lines;
}

/* =====================================================================
   3) DRINNEN: Belmont, Brass Lantern, Café, Restaurant, Theater
   ===================================================================== */
const ELITE = [
  ['A: Haben Sie gehört? Hallstein hat seine Anteile an der Werft verkauft.', 'B: An wen?', 'A: An Alexander. Natürlich an Alexander.', 'B: Irgendwann gehört ihm auch die Luft, die wir atmen.', 'A: Dann zahle ich gern. Solange der Champagner kalt ist. *'],
  ['A: Jo Lafleur singt heute wieder göttlich.', 'B: Man sagt, Alexander zahlt ihr mehr als dem Bürgermeister.', 'A: Der Bürgermeister singt ja auch nicht. *'],
  ['A: Mein Mann will in die Kristallwerke investieren.', 'B: Riskant, meine Liebe.', 'A: Nichts ist riskant, solange Alexander dabei ist.', 'B: Das hat man vom Krater auch gesagt, bevor die ersten Arbeiter erfroren sind.'],
  ['A: Die Arbeiter streiken schon wieder, höre ich.', 'B: Man sollte ihnen mehr zahlen.', 'A: Sagen Sie das laut, und Sie bekommen keine Einladung mehr.', 'B: Dann sage ich es leise. Und trinke weiter. *'],
  ['A: Waren Sie schon oben im Penthouse?', 'B: Nur einmal. Er hat mir den Kristall gezeigt.', 'A: Und?', 'B: Er leuchtet. Und Alexander schaut ihn an wie andere Leute ihre Kinder.'],
  ['A: Dieses Kleid! Ist das aus Paris?', 'B: Aus Paris über Oslo über das Eis. Es hat länger gebraucht als ich. *'],
  ['A: Ich frage mich manchmal, ob er uns überhaupt mag.', 'B: Wen? Uns?', 'A: Die feinen Leute. Er lädt uns ein, aber er tanzt nie.', 'B: Er zählt. Wer tanzt, kann nicht zählen.'],
  ['A: Die Hochbahn soll bis zur Villa verlängert werden.', 'B: Damit er nicht mehr fliegen muss?', 'A: Damit seine Dienerschaft pünktlich ist. *'],
  ['A: Der Bürgermeister hat schon wieder eine Rede vorbereitet.', 'B: Wie lang?', 'A: Drei Gläser lang, mindestens.', 'B: Dann hole ich uns schon mal drei. *'],
  ['A: Man munkelt, Kasimir hat Leute im Belmont.', 'B: Hier? Unter uns?', 'A: Vielleicht serviert er gerade die Austern.', 'B: … Ich hatte ohnehin keinen Appetit.'],
];
const PERSONAL = [
  ['A: Die Gäste heute sind wieder unmöglich.', 'B: Der Herr an Tisch neun wollte Eis im Champagner.', 'A: Im Champagner!', 'B: Ich hab ihm Eis vom Kraterrand gebracht. Er war begeistert. *'],
  ['A: Herr Alexander war heute schon zweimal in der Lobby.', 'B: Dann reiß dich zusammen. Krawatte gerade.', 'A: Die ist gerade.', 'B: Gerader!'],
];
const KNEIPE = [
  ['A: Noch eins?', 'B: Noch eins. Morgen ist auch noch Schicht.', 'A: Morgen ist immer Schicht.', 'B: Eben. Deshalb noch eins. *'],
  ['A: Weißt du, was Alexander für ein Glas Champagner im Belmont bezahlt?', 'B: Nein.', 'A: Ich auch nicht. Aber dafür kriegst du hier ein ganzes Fass. *'],
  ['A: Der Wirt schreibt schon wieder an.', 'B: Bei mir hat er aufgehört.', 'A: Weil du bezahlt hast?', 'B: Weil die Tafel voll ist. *'],
  ['A: Mein Sohn will nicht in die Gießerei. Er will Musiker werden.', 'B: Musiker? Hier?', 'A: Er spielt Trompete.', 'B: Dann kann er den Streik ankündigen. *'],
  ['A: Wenn der Streik durchkommt, kriegen wir zwei Lumen mehr die Woche.', 'B: Zwei Lumen.', 'A: Das sind zwei Bier mehr.', 'B: Na dann. Dafür lohnt sich jeder Streik. *'],
  ['A: Hast du gehört, Alexander war neulich hier drin?', 'B: Hier? Im Brass Lantern?', 'A: Er hat sich umgesehen, eine Runde ausgegeben und ist wieder gegangen.', 'B: Und? Wie war er?', 'A: Wie ein Mann, der sich verlaufen hat. *'],
  ['A: Der Alte am Klavier spielt heute traurig.', 'B: Seine Frau ist weg.', 'A: Gestorben?', 'B: Nein. In den Süden. Mit dem Klavierstimmer.'],
];
const CAFE = [
  ['A: Der Kuchen hier ist der beste der Stadt.', 'B: Und der teuerste.', 'A: Das gehört zusammen. Wie Alexander und das Belmont. *'],
  ['A: Mein Mann sagt, die Aktien steigen.', 'B: Welche?', 'A: Alle, die Alexander gehören.', 'B: Also alle. *'],
  ['A: Haben Sie den Artikel von Margot Wendt gelesen?', 'B: Über die Löhne in der Gießerei?', 'A: Mutig, das muss man ihr lassen.', 'B: Mutig oder lebensmüde. In Vespera kommt das aufs Gleiche raus.'],
  ['A: Ich gehe nicht mehr ins Arbeiterviertel. Zu viele Plakate.', 'B: Die Leute haben Hunger, meine Liebe.', 'A: Dann sollen sie Kuchen … ach, lassen wir das.'],
  ['A: Ob er je heiratet?', 'B: Wer? Alexander?', 'A: Wer sonst? Die halbe Stadt wartet.', 'B: Er ist doch mit Vespera verheiratet. *'],
];
const THEATER = [
  ['A: Das Stück ist eine Anspielung, ganz klar.', 'B: Auf wen?', 'A: Auf den Mann in der Loge da oben.', 'B: … Psst. Der Mann in der Loge ist er.'],
  ['A: Die Hauptdarstellerin war früher Wäscherin.', 'B: Man sieht es ihr nicht an.', 'A: Doch. Sie spielt die Königin, als wüsste sie, was Arbeit ist. *'],
];
const insideSpeaker = (a, sit) => ({ a, pos: () => [a.x, a.y + (sit ? 1.32 : 1.95), a.z] });
const pedSpeaker = pd => ({ a: pd.a, pd, pos: () => { const e = pd.a.m.elements; return [e[12], e[13] + (pd.sit ? 1.35 : 2.0) * (pd.sc || 1), e[14]]; } });
const V3 = new T.Vector3();
function bubble() {
  const el = document.createElement('div');
  el.className = 'plBub';
  el.style.cssText = 'position:fixed;z-index:9;left:0;top:0;max-width:240px;padding:5px 10px;border-radius:9px;background:rgba(5,16,24,.8);border:1px solid rgba(214,180,110,.42);color:#f3ecdf;font:13px/1.35 var(--body,Georgia,serif);font-style:italic;pointer-events:none;opacity:0;transition:opacity .25s;transform:translate(-50%,-100%);text-align:center';
  document.body.append(el); return el;
}
function place(K) {
  const s = K.spk, el = K.el; if (!s || !el) return;
  const [x, y, z] = s.pos(); V3.set(x, y, z);
  const d = Math.hypot(x - camera.position.x, z - camera.position.z, y - camera.position.y);
  V3.project(camera);
  if (V3.z > 1 || Math.abs(V3.x) > 1.1 || Math.abs(V3.y) > 1.1 || d > 20 || !K.txt || (s.a && s.a.on === false)) { el.style.opacity = 0; return; }
  el.style.left = ((V3.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; el.style.top = ((1 - V3.y) / 2 * innerHeight).toFixed(0) + 'px';
  el.style.opacity = Math.max(0.3, Math.min(1, 1.4 - d / 15)).toFixed(2);
}
function startInside(sp, lines, kind) {
  const K = { sp, lines: lines.map(L => ({ s: sp['ABC'.indexOf(L[0])] || sp[0], txt: L.slice(3).replace(/ \*$/, '') })), i: 0, t: 0, el: bubble(), kind };
  PL.talks.push(K); if (kind === 'venue' || kind === 'inside') PL.n[kind]++;
  for (const s of sp) if (s.a) s.a.plT = PL.clock + 50 + Math.random() * 40;
  nextLine(K); return K;
}
function nextLine(K) {
  const L = K.lines[K.i++]; if (!L) return false;
  K.spk = L.s; K.txt = L.txt; K.el.textContent = L.txt; K.t = 2 + L.txt.length * 0.055;
  const [x, , z] = L.s.pos();
  for (const s of K.sp) if (s !== L.s && s.a && s.a.live) turnHead(s.a, x, z);
  const o = K.sp.find(s => s !== L.s); if (o && L.s.a && L.s.a.live) { const q = o.pos(); turnHead(L.s.a, q[0], q[2]); }
  return true;
}
function endInside(K) { const el = K.el; el.style.opacity = 0; setTimeout(() => el.remove(), 400); PL.talks.splice(PL.talks.indexOf(K), 1); }
const recentIn = [];
function pickLines(T, key) { const free = T.filter((L, i) => !recentIn.includes(key + i)); const L = pick(free.length ? free : T), i = T.indexOf(L); recentIn.unshift(key + i); if (recentIn.length > 12) recentIn.length = 12; return L; }
// Belmont: zwei Gäste nebeneinander, die gerade nicht tanzen und nicht klatschen
function belmontScan() {
  const C = interiorCrowd, p = player.p; if (!C || !C.list) return false;
  if (GALA && GALA.st === 'laeuft' && GALA.step < 12) return false;   // während der Reden schweigt der Saal
  let best = null, bd = 1e9;
  for (const a of C.list) {
    if (!a.on || a.x === undefined || (a.plT || 0) > PL.clock || (a.kind && a.kind !== 'tux' && a.kind !== 'gown' && a.kind !== 'dress')) continue;
    const dy = a.y - p.y; if (dy < -1 || dy > 3) continue;
    const d2 = (a.x - p.x) ** 2 + (a.z - p.z) ** 2; if (d2 > 14 * 14 || d2 < 2.5 * 2.5 || d2 > bd) continue;
    bd = d2; best = a;
  }
  if (!best) return false;
  let mate = null, md = 2.6 * 2.6;
  for (const b of C.list) {
    if (b === best || !b.on || b.x === undefined || Math.abs(b.y - best.y) > 0.4 || (b.plT || 0) > PL.clock) continue;
    const d2 = (b.x - best.x) ** 2 + (b.z - best.z) ** 2; if (d2 < md) { md = d2; mate = b; }
  }
  if (!mate) return false;
  const sit = a => { const g = a.gait[1]; return (g > 7 && g < 8) || (g > 11 && g < 12); };
  const staff = best.kind === 'livery' || mate.kind === 'livery';
  startInside([insideSpeaker(best, sit(best)), insideSpeaker(mate, sit(mate))], staff ? pickLines(PERSONAL, 'pe') : pickLines(ELITE, 'el'), 'inside');
  return true;
}
// Lokale: zwei sitzende oder stehende Gäste am selben Tisch
function venueScan() {
  const p = player.p;
  const V = VENUES.find(V => p.x > V.x0 && p.x < V.x1 && p.z > V.z0 && p.z < V.z1 && Math.abs(p.y - (V.y0 || 0.3)) < 4); if (!V) return false;
  const T = V.kind === 'bar' ? KNEIPE : V.kind === 'theater' || V === undefined ? THEATER : CAFE;
  const list = (V.peds && V.peds.length ? V.peds : peds).filter(pd => pd.a && pd.a.on && pd.st === 4 && !pd.aw && (pd.a.plT || 0) <= PL.clock);
  let best = null, bd = 13 * 13;
  for (const pd of list) { const e = pd.a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2; if (d2 < bd && d2 > 2 * 2 && e[12] > V.x0 - 2 && e[12] < V.x1 + 2 && e[14] > V.z0 - 2 && e[14] < V.z1 + 2) { bd = d2; best = pd; } }
  if (!best) return false;
  const f = best.a.m.elements; let mate = null, md = 2.2 * 2.2;
  for (const pd of list) { if (pd === best) continue; const e = pd.a.m.elements, d2 = (e[12] - f[12]) ** 2 + (e[14] - f[14]) ** 2; if (d2 < md && Math.abs(e[13] - f[13]) < 0.6) { md = d2; mate = pd; } }
  if (!mate) return false;
  startInside([pedSpeaker(best), pedSpeaker(mate)], pickLines(T, V.kind || 'v'), 'venue');
  return true;
}

/* =====================================================================
   4) MIT ALEXANDER: drei neue Fragen (unterhaltung.js)
   ===================================================================== */
const ARBEIT_ANT = {
  bew: ['Gut, Herr Alexander! Im {work} geht es voran. Wir sind stolz, für Sie zu arbeiten.', 'Viel zu tun im {work}, aber das ist gut so. Wer arbeitet, friert nicht.'],
  resp: ['Die Arbeit im {work} ist hart, aber ich mache sie gern. Meistens.', 'Ich bin {job}, seit ich hier bin. Man lernt, mit wenig Schlaf auszukommen.'],
  neid: ['Die Arbeit läuft. Für Sie läuft sie besser, schätze ich.', 'Im {work} verdient einer gut: der, dem es gehört. Also Sie.'],
  skep: ['Zwölf Stunden, Herr Alexander. Fragen Sie mal Ihren Vorarbeiter, wie viele davon bezahlt werden.', 'Die Arbeit ist da. Der Lohn kommt hinterher, ganz langsam, wie ein müder Hund.'],
  furcht: ['G… gut! Ich arbeite fleißig, wirklich! Fragen Sie ruhig im {work} nach!', 'Ich beschwere mich nicht, Herr Alexander. Nie.'],
  hass: ['Sie wollen wissen, wie die Arbeit ist? Kommen Sie mal eine Schicht mit in den {work}. Ohne Mantel.', 'Die Arbeit frisst uns auf, und Sie fragen, wie es läuft.'],
  dienst: ['Alles bestens, Herr Alexander. Ich gebe mir jeden Tag Mühe.'],
};
const SORGEN = {
  bew: ['Ach, Sorgen … meine Mutter ist krank. Aber die Ärzte in Vespera sind gut, sagt man.', 'Ehrlich? Ich hab Angst, dass ich hier irgendwann nicht mehr hingehöre. Es wird alles so teuer.'],
  resp: ['Die Miete, Herr Alexander. Immer die Miete.', 'Mein Junge hustet seit Wochen. Der Rauch aus den Schloten, glaube ich.'],
  neid: ['Sorgen? Dass ich nie da oben ankomme, wo Sie sind. Aber das ist wohl keine Sorge, das ist Mathematik.', 'Dass mein Leben an mir vorbeifliegt. Wie Sie über die Dächer.'],
  skep: ['Dass die Stadt immer schöner wird und wir uns immer weniger davon leisten können.', 'Dass Leute wie Sie Versprechen machen und Leute wie ich daran glauben.'],
  furcht: ['Ich … ich habe Angst, dass ich etwas Falsches sage. Jetzt gerade zum Beispiel.', 'Dass der Kristall eines Tages … nein, nichts. Verzeihung.'],
  hass: ['Meine Sorge sind Sie, Herr Alexander.', 'Dass meine Kinder einmal genauso für Sie schuften wie ich.'],
  dienst: ['Keine, Herr Alexander. Solange ich meine Arbeit gut mache.'],
};
const ERLEBT_ANT = {
  gabe: 'Sie haben mir {wann} zwanzig Lumen geschenkt, wissen Sie das noch? Ich habe sie noch nicht ausgegeben.',
  abgewiesen: 'Ehrlich? Sie haben mich {wann} abgewimmelt. Das hab ich nicht vergessen.',
  hilfe: 'Sie haben mir {wann} geholfen. Das werde ich Ihnen nie vergessen.',
  nein: 'Ich hab Sie {wann} um Hilfe gebeten. Sie haben nein gesagt. Sie erinnern sich nicht, oder?',
  wurf: 'Sie haben mich {wann} durch die Luft geworfen. Wissen Sie, wie sich das anfühlt?',
  heben: 'Ich habe {wann} geschwebt. Ihretwegen. Ich träume noch davon. Keine schönen Träume.',
  stoss: 'Ihr Licht hat mich {wann} umgeworfen. Mein Knie erinnert sich jeden Morgen.',
  runde: 'Sie haben {wann} eine Runde ausgegeben! Der ganze Tisch hat auf Sie getrunken.',
  tip: 'Ihr Trinkgeld {wann} … davon habe ich meiner Tochter Schuhe gekauft.',
  autogramm: 'Ich habe Ihr Autogramm von {wann} zu Hause an der Wand!',
};
function erlebtAnswer(c, att) {
  const M = c.ped.mem || {}, p = M.p, w = M.w;
  if (p && ERLEBT_ANT[p.k]) return ERLEBT_ANT[p.k].replace('{wann}', wann(p));
  const e = c.ped.a && c.ped.a.m.elements, E = e && ereignisLines(e[12], e[14])[0];
  if (E) return 'Vorhin hat es hier geknallt. ' + E.lines[0].slice(3).replace(/^Hast du/, 'Haben Sie').replace(/^Da vorn hat/, 'Da vorn hat');
  if (w && GOSSIP_W[w.k]) return GOSSIP_W[w.k].replace('{wann}', wann(w));
  const h = (CLOCK.min % 1440) / 60;
  return att === 'hass' || att === 'skep' ? 'Was soll ich erlebt haben? Arbeit, Kälte, Arbeit. Wie jeden Tag.'
    : h < 5 ? 'Nicht viel. Es ist spät, Herr Alexander. Ich bin auf dem Heimweg vom {bar}.'
    : 'Ein ganz gewöhnlicher Tag. Bis jetzt. Jetzt rede ich mit Ihnen!';
}
const GOSSIP_W = {
  wurf: 'Ich habe {wann} gesehen, wie Sie jemanden durch die Luft geworfen haben. Ich kann es nicht vergessen.',
  heben: 'Ich habe {wann} gesehen, wie Sie jemanden schweben ließen. Wie eine Puppe.',
  welle: 'Ich war {wann} dabei, als es um Sie herum geknallt hat. Mir zittern heute noch die Hände.',
  gabe: 'Ich habe {wann} gesehen, wie Sie jemandem Geld geschenkt haben. Das sieht man nicht oft.',
  runde: 'Ich war {wann} dabei, als Sie eine Runde ausgegeben haben!',
  held: 'Ich habe {wann} gesehen, wie Sie einen von Kasimirs Leuten gestellt haben. Mutig.',
};
function addOptions() {
  const i = OPTS.findIndex(o => o.id === 'abschied');
  OPTS.splice(i < 0 ? OPTS.length : i, 0,
    { id: 'arbeit', t: c => 'Wie läuft die Arbeit im ' + (c.at && c.at.work ? c.at.work.name : 'Betrieb') + '?', d: 2, fn: (c, att) => { PL.n.frage++; return fillC(pick(ARBEIT_ANT[att] || ARBEIT_ANT.resp), c); } },
    { id: 'sorgen', t: () => 'Was bedrückt Sie?', d: 4, fn: (c, att) => { PL.n.frage++; return pick(SORGEN[att] || SORGEN.resp); } },
    { id: 'erlebt', t: () => 'Was haben Sie heute erlebt?', d: 2, fn: (c, att) => { PL.n.frage++; return fillC(erlebtAnswer(c, att), c); } },
  );
  UH.max = 4;
}

/* =====================================================================
   5) AUFMERKSAM: wer merkt, dass Alexander ihm hinterhergeht
   ===================================================================== */
const FOLGT = {
  bew: ['Herr Alexander? Suchen Sie etwas? Kann ich Ihnen helfen?', 'Oh! Sie gehen in dieselbe Richtung? Was für ein Zufall!'],
  resp: ['Verzeihung, Herr Alexander, wollen Sie vorbei?', 'Kann ich Ihnen den Weg zeigen?'],
  neid: ['Gehört Ihnen jetzt auch der Gehweg?', 'Wollen Sie mir auch noch den Weg abkaufen?'],
  skep: ['Sie folgen mir doch nicht etwa, Herr Alexander?', 'Ist was? Sie gehen mir schon die ganze Zeit hinterher.'],
  furcht: ['B… bitte, ich hab nichts getan!', 'Ich geh ja schon, ich geh ja schon!'],
  hass: ['Lassen Sie mich in Ruhe.', 'Was wollen Sie? Mich auch noch kontrollieren?'],
  dienst: ['Herr Alexander! Kann ich etwas für Sie tun?'],
};
function followTick(dt) {
  const p = player.p; if (player.fly || DRIVE.on || p.y > 4) { PL.fol = null; return; }
  // nächster Gehender direkt vor Alexander
  let best = null, bd = 3.2 * 3.2;
  const fx = Math.sin(player.yaw || 0), fz = Math.cos(player.yaw || 0);
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.st !== 0 || pd.aw || pd.rag || (pd.folT || 0) > PL.clock) continue;
    const e = pd.a.m.elements, dx = e[12] - p.x; if (dx > 3.2 || dx < -3.2) continue;
    const dz = e[14] - p.z; if (dz > 3.2 || dz < -3.2) continue;
    const d2 = dx * dx + dz * dz; if (d2 < bd) { bd = d2; best = pd; }
  }
  if (!best || best !== PL.fol) { PL.fol = best; PL.folS = 0; return; }
  PL.folS += dt;
  if (PL.folS < 5) return;
  // er geht ihm schon fünf Sekunden hinterher: umdrehen, etwas sagen; die Ängstlichen gehen schneller
  best.folT = PL.clock + 90; PL.fol = null; PL.folS = 0; PL.n.follow++;
  const att = attOf(best);
  turnHead(best.a, p.x, p.z);
  shared.sayTimer = Math.min(shared.sayTimer, 0.4);
  lifeSay(best.cit ? best.cit.name : best.fem ? 'Eine Dame' : 'Ein Herr', pick(FOLGT[att] || FOLGT.resp), 3.4);
  if ((att === 'furcht' || att === 'hass') && !best.grp) { const v0 = best.v; best.v *= 1.55; best.a.gait[1] *= 1.55; best.a.gv = (best.a.gv | 0) + 1; setTimeout(() => { if (best.st === 0 && best.v === v0 * 1.55) { best.v = v0; best.a.gait[1] /= 1.55; best.a.gv = (best.a.gv | 0) + 1; } }, 6000); }
}

/* =====================================================================
   6) BESORGUNGEN: am Stand kaufen, beim Zeitungsjungen den Kurier holen
   ===================================================================== */
const KAUF_SAY = { maroni: ['Eine Tüte Maronen, bitte.', 'Fünfzig Funken? Na gut, es ist kalt.'], wurst: ['Eine Wurst mit Senf, bitte.', 'Die beste Wurst diesseits des Kraterrands!'], punsch: ['Einen Punsch, aber heiß!', 'Heißer geht nicht, der Herr!'], blumen: ['Die roten da. Für meine Frau.', 'Eine gute Wahl. Die hält drei Tage, auch bei Frost.'], zigar: ['Eine Havanna, bitte.', 'Echte Havanna, über das Eis gebracht!'], suppe: ['Eine Suppe, bitte. Mit Brot.', 'Hier, Kumpel. Heiß und dick.'], schuh: ['Einmal die Schuhe, bitte. Ich hab Kundschaft nachher.', 'Glänzen sollen sie? Wie der Belmont!'] };
function errandStep(pd, A, dt) {
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, 1.3, dt) || A.t > 20) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt; stand(pd, A, A.pt < 2.6 ? 4.2 : A.after, A.fx, A.fz, dt);
    if (!A.said && A.pt > 0.4) { A.said = true; A.talk && A.talk(); }
    if (A.pt > A.dur) A.ph = 2;
    return true;
  }
  return goHome(pd, A, dt);
}
function errandTick() {
  const p = player.p; if (player.fly || DRIVE.on || p.y > 6) return;
  const busy = peds.filter(pd => pd.aw && pd.aw.fn === errandStep).length; if (busy >= (MOBILE ? 1 : 3)) return;
  // ein Stand oder ein Zeitungsjunge in Alexanders Nähe
  const opts = [];
  for (const sp of STR.vend || []) {
    if ((sp.x - p.x) ** 2 + (sp.z - p.z) ** 2 > 40 * 40) continue;
    // ein freier Platz vor dem Stand (dort stehen oft schon Kunden)
    const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);
    for (const [d, l] of [[1.7, 0.9], [1.7, -0.9], [2.2, 0], [2.4, 1.3], [2.4, -1.3]]) {
      const x = sp.x + fx * d + fz * l, z = sp.z + fz * d - fx * l;
      if (clear(x, z, x, z, 0.22) && !peds.some(q => q.aw && q.aw.fn === errandStep && (q.aw.tx - x) ** 2 + (q.aw.tz - z) ** 2 < 0.8)) { opts.push({ x, z, fx: sp.x, fz: sp.z, sp, vy: 0.22 }); break; }
    }
  }
  for (const nb of LIFE.news || []) if (nb.a && nb.a.on) { const e = nb.a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < 35 * 35) opts.push({ nb, x: e[12] + 0.9, z: e[14] + 0.9, fx: e[12], fz: e[14], vy: e[13] }); }
  if (!opts.length) return;
  const o = pick(opts);
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.grp || pd.cit || (pd.erT || 0) > PL.clock) continue;
    const e = pd.a.m.elements, d2 = (e[12] - o.x) ** 2 + (e[14] - o.z) ** 2; if (d2 > 22 * 22 || d2 < 4 || Math.abs(e[13] - o.vy) > 1.5 || !canHelp(pd)) continue;   // auch wer gerade zu Alexander schaut
    pd.erT = PL.clock + 300;
    if (Math.random() < 0.5) continue;
    const [x, y, z] = pos(pd); if (!clear(x, z, o.x, o.z, y)) continue;
    let talk, after = 1.3, dur = 5 + Math.random() * 3;
    if (o.sp) {
      const L = KAUF_SAY[o.sp.type] || ['Einmal, bitte.', 'Bitte sehr!'], V = o.sp.V || {};
      after = V.cust || 1.3; dur = 6 + Math.random() * 4;
      talk = () => { if (PL.talks.length < 3) startInside([pedSpeaker(pd), { pos: () => [o.sp.x, 1.95, o.sp.z] }], ['A: ' + L[0], 'B: ' + L[1]], 'errand'); };
    } else {
      const Z = ZEITUNG && ZEITUNG.archive && ZEITUNG.archive[ZEITUNG.archive.length - 1], tt = Z && Z.lead && Z.lead.titel;
      after = 6.2; dur = 7 + Math.random() * 4;   // in die Zeitung schauen
      talk = () => { if (PL.talks.length < 3) startInside([pedSpeaker(pd), pedSpeaker(o.nb)], tt ? ['B: Extrablatt! Der Kurier!', 'A: Einen Kurier, bitte. Mal sehen … „' + tt + '“.', 'A: Na so was.'] : ['B: Der Kurier! Frisch aus der Presse!', 'A: Einen, bitte. Was steht denn drin?', 'B: Lesen Sie selbst, Herr! Ich verkauf sie nur. *'], 'errand'); };
    }
    if (begin(pd, errandStep, { tx: o.x, tz: o.z, fx: o.fx, fz: o.fz, talk, after, dur })) { PL.n[o.sp ? 'kauf' : 'zeitung']++; return; }
  }
}

/* ---------- Schleife ---------- */
function init() {
  if (PL.ready || !PLAUDERN) return;
  PL.ready = true;
  addContent();
  GS.extra.push(streetExtra);
  GR.ctx = groupCtx;
  addOptions();
  if (window.vespera) window.vespera.plaudern = { PL, streetExtra, groupCtx, erlebtLines, ereignisLines, gesehenLines, zeitLines, belmontScan, venueScan, startInside, erlebtAnswer, followTick, errandTick, errandStep };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!PL.ready || why !== 'frame') return;
  PL.clock += dt;
  for (let i = PL.talks.length - 1; i >= 0; i--) {
    const K = PL.talks[i];
    if ((K.t -= dt) <= 0 && !nextLine(K)) { endInside(K); continue; }
    place(K);
  }
  if ((PL.tickT -= dt) > 0) return;
  const step = 0.5 - PL.tickT; PL.tickT = 0.5;
  if (!playing || paused) return;
  const p = player.p;
  // Spur: wo Alexander in den letzten drei Minuten zu Fuß war
  if ((PL.seenT -= step) <= 0 && !player.fly && p.y < 6) { PL.seenT = 5; PL.seen.unshift({ x: p.x, z: p.z, t: PL.clock }); if (PL.seen.length > 40) PL.seen.length = 40; }
  followTick(step);
  if ((PL.errT -= step) <= 0) { PL.errT = 4 + Math.random() * 3; errandTick(); }
  // drinnen: alle 1,5 s ein neues Gespräch, höchstens zwei zugleich
  if ((PL.inT -= step) <= 0) {
    PL.inT = 1.5;
    if (PL.talks.length < (MOBILE ? 1 : 2)) { if (inBelmont(p.x, p.z, p.y)) belmontScan(); else venueScan(); }
  }
});
