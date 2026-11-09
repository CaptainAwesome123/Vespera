/* =====================================================================
   V76 · ALEXANDERS IMPERIUM
   Baut das Kontor (kontor.js, Taste I) zu einer echten Wirtschaft aus; kein
   zweites System daneben. Neuer Reiter „Imperium“ im Kontorbuch.
   - SPARTEN: Hotel (The Belmont), Werke, Verkehr (Bahn, Fähre, Rundflug),
     Läden, Lokale und Bühnen, Wohnungen (Vespera Wohnungsbau gehört Alexander
     von Anfang an). Jede Sparte hat eine Rechnung: Umsatz, Löhne, Material,
     Unterhalt, Gewinn. Bei üblichen Einstellungen kommt genau der alte Ertrag
     heraus (kontor.js bizIncome ruft KT.incFn).
   - HEBEL je Sparte: Preise (drei Stufen; hohe Preise bringen sofort mehr, dann
     bleibt Kundschaft weg), Arbeitszeit (8, 10, 12 Stunden), Löhne für alle
     Betriebe der Sparte (die Löhne je Betrieb im Reiter Besitz gelten weiter).
   - BELEGSCHAFT: Zufriedenheit je Sparte aus Lohn, Arbeitszeit, Lebenshaltung
     (Preise für Kohle, Bier, Fisch und Kaffee am Kneipenplatz, Mieten,
     Fahrpreise), Stiftungen und Beschlüssen. Zufriedene Leute leisten mehr.
   - FORDERUNGEN UND STREIKS: Unzufriedene Belegschaften stellen eine Forderung
     mit Frist. Annehmen, verhandeln oder ablehnen; abgelehnt wird gestreikt:
     die Sparte bringt nichts, Werke liefern nichts, bei einem Bahnerstreik
     bleiben die Wagen an den Haltestellen stehen, am Kneipenplatz steht die
     Kundgebung (strasse.js). Erfüllen, aussitzen, Streikbrecher oder Polizei.
     Ein Versprechen an der Kundgebung wird nachgehalten (Wort halten oder
     Wortbruch).
   - VORLAGEN: Die Direktoren legen Entscheidungen vor (Schutzgitter, Fließband,
     Betriebsräte, Nachtwagen, Kartell mit Hallstein, Achtstundentag …), die
     dauerhaft wirken.
   - KONJUNKTUR UND BÖRSE: ein Konjunkturverlauf treibt Nachfrage und Kurse, der
     Vespera-Index fasst die acht Gesellschaften zusammen, Streiks drücken die
     Kurse der Branche, selten gibt es einen Kurssturz. Kredit bei der
     Vespera-Bank; wer die Mehrheit einer Gesellschaft hält, bekommt Bezüge.
   - Alles meldet an Ruf (ruf.js) und Zeitung (vespera-news). Alexander ist kein
     strahlender Held: Der Kurier schreibt je nach Entscheidung anerkennend
     oder bissig, und Widerstand ist verständlich.
   Nur HTML im Kontorbuch, keine 3D-Teile, keine Shader, nichts je Bild außer
   einem Zähler. Gespeichert in KT.s.imp (localStorage 'vespera.kontor').
   ===================================================================== */
import { $ } from './core.js';
import { playing, paused } from './input.js';
import { toast } from './boat.js';
import { DINE } from './venues.js';
import { KT, BIZ, COS, GOODS, POSTS, ktCash, ktChanged, ktPrice, ktOpen, ktRenderNow, netWorth, bizIncome, fmM, fmN, esc, clamp } from './kontor.js';
import { RUF, RUF_LINES, rufAdd, rufGet } from './ruf.js';
import { WL } from './wetterlage.js';
import { STR } from './strasse.js';

/* ---------- Sparten ---------- */
// d: Nachfrage je Preisstufe, m: Preis je Stufe, ruf: Wirkung am Tag je Stufe, h: Erklärung je Stufe
export const SPARTEN = {
  hotel: { n: 'Hotel', secs: ['hotel'], leute: 'das Personal des Belmont', kurz: 'Hotelpersonal', spr: 'Etagenkellner Lorenz Brandt', kund: 'elite', axis: 'personal', cos: [],
    preis: { t: 'Zimmerpreise', n: ['gesenkt', 'üblich', 'exklusiv'], d: [1.1, 1, 0.93], m: [0.85, 1, 1.2], ruf: [{ buerger: 0.3, elite: -0.3 }, null, { elite: 0.15, buerger: -0.25 }],
      h: ['Auch Bürger leisten sich eine Nacht im Belmont. In den Salons rümpft man die Nase.', 'Die Preise, die man vom ersten Haus der Stadt erwartet.', 'Nur das Feinste für die Feinsten. Die Elite schätzt es, die Bürger bleiben draußen.'] } },
  industrie: { n: 'Werke', secs: ['industrie'], leute: 'die Arbeiter der Werke', kurz: 'Werksarbeiter', spr: 'Werkmeister Hannes Kröger', kund: 'buerger', axis: 'arbeiter', cos: ['stahl', 'glas', 'radio', 'krist'],
    preis: { t: 'Abgabepreise', n: ['Kampfpreise', 'Marktpreis', 'Höchstpreise'], d: [1.12, 1, 0.84], m: [0.86, 1, 1.2], ruf: [{ elite: -0.25, buerger: 0.15 }, null, { buerger: -0.2, presse: -0.1 }],
      h: ['Billiger als jeder andere. Die übrigen Fabrikherren schäumen, die Bürger freut es.', 'Was der Markt hergibt.', 'Wer Stahl und Glas braucht, zahlt, was Alexander verlangt. Der Kurier rechnet nach.'] } },
  verkehr: { n: 'Verkehr', secs: ['verkehr'], leute: 'die Bahner, Fährleute und Luftschiffer', kurz: 'Verkehrspersonal', spr: 'Wagenführer Emil Rautenberg', kund: 'buerger', axis: 'arbeiter', cos: ['tram', 'luft', 'nord'],
    preis: { t: 'Fahrpreise', n: ['halber Preis', 'üblich', 'doppelt'], d: [1.14, 1, 0.82], m: [0.82, 1, 1.25], ruf: [{ arbeiter: 0.3, buerger: 0.25 }, null, { arbeiter: -0.4, buerger: -0.3 }],
      h: ['Die halbe Stadt fährt für fünfzig Funken zur Arbeit. Das vergisst das Viertel nicht.', 'Ein Lumen die Fahrt.', 'Zwei Lumen die Fahrt. Wer im Arbeiterviertel wohnt, geht wieder zu Fuß durch den Schnee.'] } },
  handel: { n: 'Läden', secs: ['handel', 'luxus'], leute: 'die Ladenangestellten', kurz: 'Ladenpersonal', spr: 'Verkäuferin Ilse Marold', kund: 'buerger', axis: 'arbeiter', cos: [],
    preis: { t: 'Ladenpreise', n: ['Rabatt', 'üblich', 'gesalzen'], d: [1.12, 1, 0.85], m: [0.87, 1, 1.18], ruf: [{ buerger: 0.25 }, null, { buerger: -0.25 }],
      h: ['Volle Läden, schmale Spannen.', 'Die üblichen Preise.', 'Die Kundschaft murrt und kauft nur noch das Nötige.'] } },
  gastro: { n: 'Lokale und Bühnen', secs: ['gastro', 'kultur'], leute: 'Kellner, Köche und Musiker', kurz: 'Lokalpersonal', spr: 'Oberkellner Paul Senft', kund: 'buerger', axis: 'arbeiter', cos: [],
    preis: { t: 'Zeche und Eintritt', n: ['billig', 'üblich', 'teuer'], d: [1.13, 1, 0.86], m: [0.86, 1, 1.18], ruf: [{ buerger: 0.2, arbeiter: 0.15 }, null, { buerger: -0.2, arbeiter: -0.15 }],
      h: ['Jeden Abend volle Tische.', 'Die üblichen Preise.', 'Ein Bier für das Doppelte. Die Stammgäste bleiben weg.'] } },
  wohnen: { n: 'Wohnungen', secs: ['wohnen'], leute: 'die Mieter', kurz: 'Mieter', spr: 'Mieterrat, Sprecherin Frieda Kolbe', kund: 'buerger', axis: 'arbeiter', mieter: true, cos: [],
    preis: { t: 'Mieten', n: ['gesenkt', 'üblich', 'erhöht'], d: [1.02, 1, 0.97], m: [0.84, 1, 1.22], ruf: [{ arbeiter: 0.45, buerger: 0.3, elite: -0.1 }, null, { arbeiter: -0.5, buerger: -0.35 }],
      h: ['Wohnen in Vespera ist billig. Den Familien bleibt Geld für Kohle und Brot.', 'Die Mieten, die seit der Gründung gelten.', 'Die Miete frisst den halben Lohn. Die Häuser gehören Alexander, also zahlt man.'] } },
};
const SEC2SP = {}; for (const k in SPARTEN) for (const s of SPARTEN[k].secs) SEC2SP[s] = k;
const ZEIT = [{ n: '8 Stunden', um: 0.9, l: 1, z: 9 }, { n: '10 Stunden', um: 1, l: 1, z: 0 }, { n: '12 Stunden', um: 1.12, l: 1.08, z: -13 }];
const LOHN_F = [0.8, 1, 1.2], LOHN_N = ['knapp', 'gerecht', 'großzügig'];
const KONJ = [[-0.35, 'Flaute'], [-0.1, 'Abschwung'], [0.15, 'ruhige Lage'], [0.4, 'Aufschwung'], [9, 'Hochkonjunktur']];
const ZUF_N = [[25, 'aufgebracht'], [40, 'unzufrieden'], [60, 'ruhig'], [78, 'zufrieden'], [999, 'stolz auf ihr Haus']];
const zufN = v => ZUF_N.find(a => v < a[0])[1];
export const konjN = v => KONJ.find(a => v < a[0])[1];

/* ---------- Vorlagen der Direktoren ----------
   need: wann die Vorlage kommt; opts: [Beschriftung, Ruf, Ergebnis, { cost, fx: [[Sparte|'*', um|lohn|unt|z, Wert]], fn, news: [Titel, Text, Rang] }] */
const own = id => !!(KT.s && KT.s.own[id]);
const ownSec = sec => Object.keys(KT.s.own).some(id => BIZ[id] && BIZ[id].sec === sec && BIZ[id].inc > 0);
export const VORLAGEN = {
  gitter: { sp: 'industrie', von: 'Werkmeister Hannes Kröger', t: 'Schutzgitter an den Walzen', need: () => ownSec('industrie'),
    x: 'Letzte Woche hat die Walze einem Lehrling fast die Hand genommen. Gitter und Notschalter für alle Werke kosten 60.000 Lumen. Die Direktion hält das für Luxus.',
    opts: [['Einbauen lassen · 60.000 Lumen', { arbeiter: 3, bew: 0.5 }, 'Die Gitter kommen. Kröger nickt nur, aber im Werk spricht es sich herum.', { cost: 60000, fx: [['industrie', 'z', 6]] }],
      ['Ablehnen: Wer aufpasst, dem passiert nichts', { arbeiter: -2 }, 'Die Vorlage wandert in die Schublade. Die Walzen laufen weiter ohne Gitter.', { fx: [['industrie', 'z', -3]] }]] },
  fliessband: { sp: 'industrie', von: 'Direktor Thalberg, Werksleitung', t: 'Das Fließband', need: () => ownSec('industrie'),
    x: 'In Detroit baut man Automobile am laufenden Band. Mit 150.000 Lumen ließen sich unsere Werke umstellen: ein Sechstel mehr Ausstoß, und jeder zehnte Mann wird überflüssig.',
    opts: [['Umstellen und entlassen · 150.000 Lumen', { arbeiter: -4, elite: 2 }, 'Das Band läuft. Vor dem Werkstor stehen die Entlassenen mit ihren Papieren.', { cost: 150000, fx: [['industrie', 'um', 0.15], ['industrie', 'lohn', -0.08], ['industrie', 'z', -8]], kurs: { stahl: 0.06 }, news: ['Das Fließband kommt nach Vespera', 'Alexanders Werke stellen auf Fließarbeit um. Die Direktion spricht von Fortschritt, die Gewerkschaft von zweihundert Familien ohne Lohn. Recht haben wohl beide.', 6] }],
      ['Umstellen, aber niemand wird entlassen · 150.000 Lumen', { arbeiter: 1.5, elite: -0.5 }, 'Das Band läuft, die Leute bleiben. Thalberg rechnet nach und schweigt.', { cost: 150000, fx: [['industrie', 'um', 0.12], ['industrie', 'z', -2]] }],
      ['Alles bleibt, wie es ist', {}, 'Thalberg legt die Pläne zurück in die Mappe.']] },
  betriebsrat: { sp: '*', von: 'Gewerkschaft der Kesselschmiede', t: 'Betriebsräte in allen Häusern', need: () => impStaffAll() > 300,
    x: 'Die Gewerkschaft verlangt gewählte Vertreter der Belegschaft in jedem Betrieb, mit Sitz bei der Direktion. „Wir bauen Ihre Stadt, Herr Alexander. Wir wollen mitreden, wie.“',
    opts: [['Anerkennen', { arbeiter: 6, elite: -4, presse: 2, unter: -3 }, 'Zum ersten Mal sitzen Arbeiter am Tisch der Direktion. In den Salons nennt man Sie einen Träumer.', { fx: [['*', 'z', 8], ['*', 'lohn', 0.04]], fn: () => { IMP.s.flag.rat = 1; }, news: ['Alexander erkennt die Betriebsräte an', 'In allen Betrieben Alexanders wählt die Belegschaft künftig Vertreter. Der Fabrikantenverein nennt den Schritt „gefährlich“, die Gewerkschaft „überfällig“.', 7] }],
      ['Eigene Werksvereine gründen · 30.000 Lumen', { arbeiter: -2, presse: -1 }, 'Die Werksvereine bekommen Fahnen und ein Sommerfest. Zu sagen haben sie nichts, und jeder weiß es.', { cost: 30000, fx: [['*', 'z', 2]] }],
      ['Ablehnen', { arbeiter: -3, elite: 1, unter: 3 }, 'Die Antwort der Gewerkschaft ist kurz: „Dann eben anders.“']] },
  nachtbahn: { sp: 'verkehr', von: 'Betriebsleiter der Verkehrsbetriebe', t: 'Nachtwagen für die Schichtarbeiter', need: () => own('bahn'),
    x: 'Nach der Spätschicht fährt keine Bahn mehr. Die Leute laufen eine Stunde durch die Kälte nach Hause. Nachtwagen auf Linie 2 rechnen sich nicht, schreibt der Betriebsleiter, aber sie würden gebraucht.',
    opts: [['Einführen, zum üblichen Fahrpreis', { arbeiter: 4, buerger: 1 }, 'Um Mitternacht rollt der erste Nachtwagen ins Arbeiterviertel. Er ist voll.', { fx: [['verkehr', 'unt', 0.2], ['industrie', 'z', 3], ['verkehr', 'z', -1]] }],
      ['Einführen, mit Nachtzuschlag', { arbeiter: -1.5 }, 'Der Nachtwagen fährt. Die meisten laufen weiter.', { fx: [['verkehr', 'um', 0.03]] }],
      ['Nein', { arbeiter: -1 }, 'Es bleibt beim letzten Wagen um zehn.']] },
  kantine: { sp: 'hotel', von: 'Direktor Hartmann, The Belmont', t: 'Die Kammern unter dem Belmont', need: () => own('belmont'),
    x: 'Die Zimmermädchen und Pagen schlafen zu sechst in fensterlosen Kammern im zweiten Keller, direkt neben den Kesseln. Hartmann schlägt Schlafsäle mit Fenstern zum Lichthof und eine Personalkantine vor.',
    opts: [['Umbauen · 80.000 Lumen', { personal: 5, arbeiter: 1 }, 'Die Kammern werden hell. Am ersten Abend in der Kantine wird gesungen.', { cost: 80000, fx: [['hotel', 'z', 8]] }],
      ['Nur das Nötigste · 15.000 Lumen', { personal: 1 }, 'Neue Matratzen und ein Lüfter. Besser als nichts.', { cost: 15000, fx: [['hotel', 'z', 2]] }],
      ['Die Gäste sehen den Keller nicht', { personal: -3 }, 'Hartmann verbeugt sich und sagt nichts.', { fx: [['hotel', 'z', -3]] }]] },
  kartell: { sp: 'industrie', von: 'Viktor von Hallstein', t: 'Ein Angebot unter Herren', need: () => ownSec('industrie') && KT.s.day > 4,
    x: '„Warum sollten wir uns die Preise verderben, Alexander? Ihr Stahl, mein Stahl, ein Preis. Niemand muss davon erfahren.“ Hallstein lässt den Brief persönlich abgeben.',
    opts: [['Einschlagen', { elite: 2 }, 'Ein Händedruck im Polarclub. Der Stahlpreis steigt, und niemand weiß, warum.', { fx: [['industrie', 'um', 0.12]], fn: () => { IMP.s.flag.kartell = 1; } }],
      ['Ablehnen', { elite: -1 }, 'Hallstein lächelt dünn: „Wie Sie meinen.“'],
      ['Den Brief dem Kurier geben', { presse: 4, buerger: 3, elite: -5 }, 'Margot Wendt druckt den Brief auf Seite eins. Hallstein tobt, die Salons sind entsetzt über Ihre Indiskretion.', { kurs: { stahl: -0.04 }, news: ['Preisabsprache beim Stahl? Alexander legt Brief vor', 'Dem Kurier liegt ein Brief Viktor von Hallsteins vor, der Alexander ein Stahlkartell anträgt. Alexander hat abgelehnt und den Brief der Redaktion übergeben. Von Margot Wendt.', 8] }]] },
  charter: { sp: '*', von: 'Kapitän Leopold Ahrens', t: 'Die Aurora Imperial verchartern', need: () => own('imperial'),
    x: 'Eine Reederei aus Oslo möchte die Aurora Imperial für Nordlichtfahrten mieten, wann immer Sie sie nicht brauchen. Kapitän Ahrens meldet es pflichtgemäß; begeistert ist er nicht.',
    opts: [['Verchartern · 4.000 Lumen am Tag', { elite: -1.5, personal: -1 }, 'Fremde Gäste im Salon der Aurora Imperial. In den Clubs fragt man, ob Alexander es nötig hat.', { fn: () => { IMP.s.flag.charter = 4000; } }],
      ['Einmal im Monat fliegen die Waisenkinder mit', { buerger: 3, presse: 2, bew: 1.5 }, 'Vierzig Kinder kleben an den Scheiben der Aurora Imperial. Ahrens lässt sie ans Steuerrad.', { fn: () => { IMP.s.flag.charter = -500; } }],
      ['Das Schiff bleibt privat', {}, 'Ahrens salutiert, sichtlich erleichtert.']] },
  heizung: { sp: 'wohnen', von: 'Verwalter der Vespera Wohnungsbau', t: 'Zentralheizung für die Mietshäuser', need: () => own('wohnbau'),
    x: 'In den Mietshäusern heizt jede Familie mit einem Ofen, wenn sie Kohle hat. Dampfheizung aus den Kesseln der Kristallwerke würde 200.000 Lumen kosten.',
    opts: [['Einbauen · 200.000 Lumen', { arbeiter: 4, buerger: 2 }, 'Es wird warm in den Mietshäusern. Zum ersten Mal kein Eis an den Fenstern.', { cost: 200000, fx: [['wohnen', 'z', 10]], fn: () => { KT.s.wohl = clamp(KT.s.wohl + 2, 0, 100); } }],
      ['Einbauen und auf die Miete umlegen · 200.000 Lumen', { arbeiter: -1 }, 'Es wird warm, und die Miete steigt. Manche drehen die Heizkörper lieber wieder zu.', { cost: 200000, fx: [['wohnen', 'um', 0.08], ['wohnen', 'z', -2]] }],
      ['Öfen haben immer gereicht', { arbeiter: -1.5 }, 'Der Verwalter trägt den Winter in sein Buch ein.']] },
  acht: { sp: '*', von: 'Bürgermeister Hollister', t: 'Der Achtstundentag', need: () => impStaffAll() > 300 && KT.s.day > 6 && !IMP.s.flag.acht,
    x: 'DER STADTRAT BERAET EIN GESETZ ZUM ACHTSTUNDENTAG STOP OHNE IHR WORT GESCHIEHT IN VESPERA NICHTS STOP WIE STEHEN SIE DAZU STOP',
    opts: [['Dafür: acht Stunden für alle', { arbeiter: 8, elite: -5, presse: 3, bew: 2, unter: -4 }, 'Der Stadtrat stimmt zu. In allen Betrieben der Stadt endet die Schicht nach acht Stunden.', { fn: () => { IMP.s.flag.acht = 1; for (const k in IMP.s.sp) IMP.s.sp[k].zeit = 0; }, news: ['Achtstundentag in Vespera!', 'Mit Alexanders Fürsprache hat der Stadtrat den Achtstundentag beschlossen. Vor den Werkstoren wurde gefeiert. Der Fabrikantenverein spricht von einem „schwarzen Tag“ und meint damit seinen eigenen.', 9] }],
      ['Verhindern · 50.000 Lumen für Überzeugungsarbeit', { elite: 3, arbeiter: -5, presse: -2, unter: 3 }, 'Das Gesetz verschwindet im Ausschuss. Wer das bezahlt hat, ahnt die halbe Stadt.', { cost: 50000 }],
      ['Sich heraushalten', { arbeiter: -1 }, 'Der Stadtrat vertagt sich. Ohne Ihr Wort geschieht in Vespera nichts.']] },
  kette: { sp: 'handel', von: 'Prokurist Wenzel', t: 'Einheitspreise und Zentraleinkauf', need: () => Object.keys(KT.s.own).filter(id => id.startsWith('laden:')).length >= 3,
    x: 'Ihre Läden kaufen jeder für sich ein. Ein gemeinsamer Einkauf und feste Preise brächten ein Zehntel mehr. Die Geschäftsführer wären dann nur noch Filialleiter.',
    opts: [['Einführen', { buerger: -2 }, 'Über jeder Ladentür hängt jetzt dasselbe goldene A. Die Bücher stimmen, das Plaudern an der Theke wird kürzer.', { fx: [['handel', 'um', 0.1], ['handel', 'z', -4]] }],
      ['Jeder Laden bleibt sein eigener Herr', { buerger: 1 }, 'Wenzel seufzt. Die Ladenstraße bleibt bunt.', { fx: [['handel', 'z', 3]] }]] },
  pension: { sp: '*', von: 'Bankdirektor Varga', t: 'Eine Pensionskasse', need: () => impStaffAll() > 300 && KT.s.day > 3,
    x: 'Wer in Ihren Betrieben alt wird, hat nichts. Varga schlägt eine Pensionskasse vor: 100.000 Lumen Grundstock und ein kleiner Zuschlag auf jede Lohnsumme. „Es bindet die Leute an Sie“, sagt er trocken.',
    opts: [['Gründen · 100.000 Lumen', { arbeiter: 4, personal: 3, bew: 2 }, 'Die Pensionskasse Alexander nimmt die ersten Einzahlungen an. Ein alter Heizer weint am Schalter.', { cost: 100000, fx: [['*', 'z', 6], ['*', 'lohn', 0.03]] }],
      ['Nicht jetzt', {}, 'Varga klappt die Mappe zu.']] },
};

/* ---------- Zustand ---------- */
export const IMP = { s: null, ready: false, modC: null, lohnSnap: {}, hud: null, hudKey: '', hudT: 0 };
function impFresh() {
  const s = { v: 1, sp: {}, konj: 0.1, idx: [], kredit: 0, ford: null, vor: [], ent: {}, vorCd: {}, flag: {}, bil: [], wort: null, crash: 0, day: KT.s.day };
  for (const k in SPARTEN) s.sp[k] = { preis: 1, zeit: 1, zuf: 55, ausl: 1, streik: null, ruhe: 0, vertrag: 0 };
  return s;
}
function impLoad() {
  let s = KT.s.imp; const f = impFresh();
  if (!s || s.v !== 1) { s = f; if (!KT.s.own.wohnbau && BIZ.wohnbau) KT.s.own.wohnbau = { lvl: 1, lohn: 1 }; }   // alter Spielstand: die Mietshäuser gehören ihm seit der Gründung
  for (const k in f) if (s[k] === undefined) s[k] = f[k];
  for (const k in f.sp) s.sp[k] = { ...f.sp[k], ...(s.sp[k] || {}) };
  KT.s.imp = s; IMP.s = s; IMP.modC = null;
  if (!s.idx.length) { s.idx.push(impIndex()); for (const k in s.sp) { s.sp[k].zuf = impZiel(k); s.sp[k].ausl = 1; } }
}

/* ---------- Rechnung ---------- */
export const impIds = k => Object.keys(KT.s.own).filter(id => BIZ[id] && BIZ[id].inc > 0 && SEC2SP[BIZ[id].sec] === k);
export const impStaff = k => impIds(k).reduce((a, id) => a + BIZ[id].staff * (1 + 0.25 * (KT.s.own[id].lvl - 1)), 0);
function impStaffAll() { let n = 0; for (const k in SPARTEN) if (!SPARTEN[k].mieter) n += impStaff(k); return n; }
const avgLohn = k => { const ids = impIds(k); let a = 0, w = 0; for (const id of ids) { a += (KT.s.own[id].lohn ?? 1) * BIZ[id].staff; w += BIZ[id].staff; } return w ? a / w : 1; };
// Beschlüsse wirken dauerhaft auf Umsatz, Lohnsumme, Unterhalt und Zufriedenheit
function impMods(k) {
  if (!IMP.modC) {
    const M = {}; for (const q in SPARTEN) M[q] = { um: 0, lohn: 0, unt: 0, z: 0 };
    for (const id in IMP.s.ent) {
      const V = VORLAGEN[id], o = V && V.opts[IMP.s.ent[id]], fx = o && o[3] && o[3].fx; if (!fx) continue;
      for (const [sp, key, val] of fx) for (const q in M) if (sp === '*' || sp === q) M[q][key] += val;
    }
    IMP.modC = M;
  }
  return IMP.modC[k];
}
// Umsatz, Löhne, Material, Unterhalt und Gewinn eines Betriebs am Tag (base = alter Ertrag ohne Lohnstufe)
export function impRech(id, base, o) {
  const B = BIZ[id], k = SEC2SP[B.sec], L = LOHN_F[o.lohn ?? 1], S = IMP.s;
  if (!k || !S) return { um: 2.5 * base, lohn: 0.75 * base * L, mat: 0.45 * base, unt: 0.3 * base, gew: base * (1.75 - 0.75 * L) };
  const sp = S.sp[k], P = SPARTEN[k].preis, M = impMods(k), Z = ZEIT[SPARTEN[k].mieter ? 1 : sp.zeit];
  let um, lohn, mat; const unt = 0.3 * base * (1 + M.unt);
  if (sp.streik) {   // nichts läuft; Streikbrecher schaffen gut die Hälfte und kosten mehr
    const br = sp.streik.brecher ? 0.55 : 0;
    um = 2.5 * base * br * P.m[sp.preis]; lohn = 0.75 * base * br * 1.3; mat = 0.45 * base * br;
  } else {
    const moral = SPARTEN[k].mieter ? 1 : 0.85 + 0.3 * sp.zuf / 100;
    um = 2.5 * base * P.m[sp.preis] * sp.ausl * Z.um * moral * (1 + M.um);
    lohn = 0.75 * base * L * Z.l * (1 + M.lohn);
    mat = 0.45 * base * sp.ausl * Z.um;
  }
  return { um, lohn, mat, unt, gew: um - lohn - mat - unt };
}
function impBase(id) {   // alter Ertrag ohne Lohnstufe: aus bizIncome zurückgerechnet wäre ungenau, also wie in kontor.js
  const save = KT.incFn; let b = 0; KT.incFn = (i, base) => { b = base; return base; }; bizIncome(id); KT.incFn = save; return b;
}
export function impSum(k) {
  const T = { um: 0, lohn: 0, mat: 0, unt: 0, gew: 0, n: 0 };
  for (const id of (k ? impIds(k) : Object.keys(SPARTEN).flatMap(impIds))) { const R = impRech(id, impBase(id), KT.s.own[id]); for (const q in R) T[q] += R[q]; T.n++; }
  return T;
}

/* ---------- Lebenshaltung, Zufriedenheit, Nachfrage ---------- */
const KORB = ['kohle', 'bier', 'fisch', 'kaffee'];
export function impKorb() { let a = 0; for (const g of KORB) a += ktPrice('kneipe', g) / (GOODS[g].p * POSTS.kneipe.f[g]); return a / KORB.length; }
export function impLeben() {
  const S = IMP.s, miete = own('wohnbau') ? [0.85, 1, 1.2][S.sp.wohnen.preis] : 1, fahr = own('bahn') ? [0.7, 1, 1.6][S.sp.verkehr.preis] : 1;
  return 0.5 * impKorb() + 0.35 * miete + 0.15 * fahr;
}
function impZiel(k) {
  const S = IMP.s, sp = S.sp[k], P = KT.s.proj, M = impMods(k);
  if (SPARTEN[k].mieter) return clamp(55 + [14, 0, -18][sp.preis] - (impKorb() - 1) * 20 + (P.oefen ? 6 : 0) + ((KT.s.own.wohnbau ? KT.s.own.wohnbau.lvl : 1) - 1) * 4 + M.z, 3, 97);
  const ruf = RUF.ready ? rufGet(SPARTEN[k].axis) : 50;
  return clamp(52 + (avgLohn(k) - 1) * 24 + ZEIT[sp.zeit].z - (impLeben() - 1) * 45 + M.z + (P.oefen ? 3 : 0) + (P.spital ? 3 : 0) + (P.schule ? 2 : 0) + (ruf - 50) * 0.12, 3, 97);
}
function impNachfrage(k) {
  const S = IMP.s, sp = S.sp[k], rep = KT.s.rep[SPARTEN[k].kund] ?? 50;
  let w = 1; const ev = WL.ev;
  if (ev === 'sturm') w = k === 'verkehr' ? 0.7 : k === 'hotel' ? 1.06 : k === 'gastro' ? 0.85 : 1;
  else if (ev === 'nordlicht') w = k === 'verkehr' || k === 'hotel' ? 1.1 : k === 'gastro' ? 1.05 : 1;
  else if (ev === 'frostnebel') w = k === 'verkehr' ? 0.9 : 1;
  const kj = SPARTEN[k].mieter ? 0 : S.konj;
  return clamp(SPARTEN[k].preis.d[sp.preis] * (1 + 0.14 * kj) * (0.9 + 0.2 * rep / 100) * w, 0.45, 1.15);
}

/* ---------- Meldungen ---------- */
function impNews(titel, text, prio = 5, ruf, rubrik = 'Wirtschaft') {
  try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik, prio, ruf, quelle: 'imperium' } })); } catch (e) { /* ohne Zeitung */ }
}
function impLog(t, a) { const L = KT.s.log; L.unshift({ d: KT.s.day, t, a: Math.round(a) }); if (L.length > 40) L.length = 40; }
function impKurs(ch) { for (const c in ch) if (KT.s.cp[c]) { KT.s.cp[c] = clamp(KT.s.cp[c] * (1 + ch[c]), COS[c].p * 0.2, COS[c].p * 8); const h = KT.s.hist[c]; if (h && h.length) h[h.length - 1] = +KT.s.cp[c].toFixed(2); } }
export function impIndex() { let a = 0, n = 0; for (const c in COS) { a += KT.s.cp[c] / COS[c].p; n++; } return Math.round(a / n * 1000) / 10; }
const Leute = k => { const s = SPARTEN[k].leute; return s[0].toUpperCase() + s.slice(1); };
const mitBetrieb = k => impIds(k).length > 0;

/* ---------- Hebel ---------- */
// Verschlechterungen während eines laufenden Vertrags sind Vertragsbruch: die Belegschaft legt sofort die Arbeit nieder
function impBruch(k, was, art) {
  const S = IMP.s, sp = S.sp[k]; sp.vertrag = 0;
  rufAdd({ arbeiter: -5, presse: -2, unter: 2 }, 'Vertragsbruch: ' + was);
  impNews('Alexander bricht die Abmachung', `Kaum unterschrieben, schon gebrochen: ${was}. ${Leute(k)} antworten mit Streik. „Sein Wort ist so viel wert wie das Eis im Hafen im Mai“, sagt ${SPARTEN[k].spr}.`, 7);
  impStreikStart(k, art, true);
}
export function impSet(k, was, v) {
  const S = IMP.s, sp = S.sp[k]; if (!sp || !mitBetrieb(k)) return false;
  const day = KT.s.day, bind = sp.vertrag > day;
  if (was === 'preis') {
    v = clamp(v | 0, 0, 2); if (v === sp.preis) return false;
    const up = v > sp.preis; sp.preis = v;
    if (SPARTEN[k].mieter && up && bind) impBruch(k, 'die Mieten steigen wieder', 'miete');
    else if (k === 'verkehr' || SPARTEN[k].mieter) {   // Fahrpreise und Mieten sind Stadtgespräch
      const P = SPARTEN[k].preis;
      if (v === 2) impNews(k === 'verkehr' ? 'Bahnfahren kostet jetzt das Doppelte' : 'Alexander erhöht die Mieten', k === 'verkehr' ? 'Die Vespera-Verkehrsbetriebe verdoppeln den Fahrpreis. Wem die Bahn gehört, weiß jedes Kind. Im Arbeiterviertel rechnet man aus, was der Weg zur Schicht nun im Monat kostet.' : 'Die Vespera Wohnungsbau hebt die Mieten in der ganzen Stadt an. Die Häuser hat Alexander gebaut, die Mieten bestimmt er. Im Viertel fragt man, wovon man jetzt die Kohle bezahlen soll.', 6);
      else if (v === 0) impNews(k === 'verkehr' ? 'Halber Fahrpreis auf allen Linien' : 'Mieten in Vespera sinken', k === 'verkehr' ? 'Ab sofort kostet die Fahrt mit Straßenbahn und Hochbahn nur noch fünfzig Funken. Großzügig, sagen die einen. Die anderen erinnern daran, dass volle Bahnen pünktliche Arbeiter bringen.' : 'Die Vespera Wohnungsbau senkt die Mieten. In den Treppenhäusern des Arbeiterviertels wurde am Abend angestoßen.', 6);
      toast(`${P.t}: ${P.n[v]}`);
    } else toast(`${SPARTEN[k].n} · ${SPARTEN[k].preis.t}: ${SPARTEN[k].preis.n[v]}`);
  } else if (was === 'zeit') {
    v = clamp(v | 0, 0, 2); if (S.flag.acht && v > 0) { toast('In Vespera gilt der Achtstundentag'); return false; }
    if (SPARTEN[k].mieter || v === sp.zeit) return false;
    const up = v > sp.zeit; sp.zeit = v; toast(`${SPARTEN[k].n}: ${ZEIT[v].n} am Tag`);
    if (up && bind) impBruch(k, 'die Schicht wird wieder länger', 'zeit');
    else if (v === 2) rufAdd({ arbeiter: -1.5 }, 'Zwölfstundentag: ' + SPARTEN[k].n, { key: 'imp:zeit' });
    else if (v === 0) rufAdd({ arbeiter: 2, elite: -0.5 }, 'Achtstundentag: ' + SPARTEN[k].n, { key: 'imp:zeit' });
  } else if (was === 'lohn') {
    v = clamp(v | 0, 0, 2); let n = 0, down = false;
    for (const id of impIds(k)) { const o = KT.s.own[id], a = o.lohn ?? 1; if (a !== v) { if (v < a) down = true; o.lohn = v; n++; } }
    if (!n) return false;
    toast(`${SPARTEN[k].n}: Löhne ${LOHN_N[v]} in ${n} ${n === 1 ? 'Betrieb' : 'Betrieben'}`);
    if (down && bind) { impLohnSnap(); impBruch(k, 'die Löhne sinken wieder', 'lohn'); }
  } else return false;
  impNach(k);
  return true;
}
// nach jeder Änderung: Forderung vielleicht schon erfüllt, Wort gehalten, Buch neu zeichnen
function impNach() {
  const S = IMP.s, F = S.ford;
  if (F && impErfuellt(F)) impFordAntwort(0, true);
  for (const k in S.sp) { const st = S.sp[k].streik; if (st && impErfuellt({ sp: k, k: st.k, snap: st.snap })) impStreikEnde(k, 'erfuellt', true); }
  if (S.wort && !S.wort.ok && impLohnSum() > S.wort.sum) S.wort.ok = 1;
  impLohnSnap(); ktChanged('imperium');
}
const impLohnSum = () => Object.keys(KT.s.own).reduce((a, id) => a + (BIZ[id] && BIZ[id].inc > 0 ? (KT.s.own[id].lohn ?? 1) : 0), 0);
function impLohnSnap() { IMP.lohnSnap = {}; for (const id in KT.s.own) IMP.lohnSnap[id] = KT.s.own[id].lohn ?? 1; }
const impSnap = k => ({ lohn: avgLohn(k), zeit: IMP.s.sp[k].zeit, preis: IMP.s.sp[k].preis });
function impErfuellt(F) {
  const now = impSnap(F.sp), a = F.snap; if (!a) return false;
  return F.k === 'lohn' ? now.lohn > a.lohn + 0.3 || (now.lohn >= 2 && a.lohn < 2) : F.k === 'zeit' ? now.zeit < a.zeit : F.k === 'miete' ? now.preis < a.preis : false;
}

/* ---------- Forderungen ---------- */
const FORD = {
  lohn: { t: 'höhere Löhne', x: k => `${Leute(k)} verlangen höhere Löhne: eine Stufe mehr in allen Betrieben der Sparte.`, ja: 'Löhne anheben' },
  zeit: { t: 'kürzere Schichten', x: k => `${Leute(k)} verlangen kürzere Schichten: ${ZEIT[Math.max(0, IMP.s.sp[k].zeit - 1)].n} statt ${ZEIT[IMP.s.sp[k].zeit].n}.`, ja: 'Schicht verkürzen' },
  zulage: { t: 'eine Teuerungszulage', x: k => `Alles wird teurer, nur der Lohn nicht. ${Leute(k)} verlangen eine einmalige Teuerungszulage von ${fmM(impZulage(k))}.`, ja: 'Zulage zahlen' },
  miete: { t: 'niedrigere Mieten', x: () => 'Die Mieter verlangen, dass die Mieten wieder sinken. Sonst zahlt ab dem Ersten niemand mehr.', ja: 'Mieten senken' },
  kohle: { t: 'Reparaturen und Kohle', x: k => `In den Mietshäusern tropft es durch die Dächer, und die Keller sind leer. Die Mieter verlangen Reparaturen und Kohle für ${fmM(impZulage(k))}.`, ja: 'Bezahlen' },
};
const impZulage = k => SPARTEN[k].mieter ? 60000 * ((KT.s.own.wohnbau && KT.s.own.wohnbau.lvl) || 1) : Math.max(5000, Math.round(impSum(k).lohn * 2 / 1000) * 1000);
function impFordArt(k) {
  const sp = IMP.s.sp[k], L = avgLohn(k);
  if (SPARTEN[k].mieter) return sp.preis > 0 ? 'miete' : 'kohle';
  if (sp.zeit === 2) return 'zeit';
  if (L < 0.5) return 'lohn';
  if (sp.zeit === 1 && Math.random() < 0.3) return 'zeit';
  return L < 1.5 ? 'lohn' : 'zulage';
}
export function impFordNeu(k, art) {
  const S = IMP.s; if (S.ford || S.sp[k].streik || !mitBetrieb(k)) return false;
  art = art || impFordArt(k);
  S.ford = { sp: k, k: art, day: KT.s.day, frist: 2, snap: impSnap(k) };
  const A = SPARTEN[k];
  toast(`Forderung: ${A.leute} verlangen ${FORD[art].t} (Kontor · Imperium)`);
  impNews(`${Leute(k)} fordern ${FORD[art].t}`, `${A.spr} hat der Direktion die Forderung der Belegschaft überbracht: ${FORD[art].t}. Alexander hat zwei Tage Zeit für eine Antwort. „Wir drohen nicht“, heißt es, „wir rechnen nur vor.“`, 6);
  ktChanged('imperium');
  return true;
}
function impErfuelle(k, art) {   // was die Forderung verlangt, wird umgesetzt
  const sp = IMP.s.sp[k];
  if (art === 'lohn') { for (const id of impIds(k)) { const o = KT.s.own[id]; o.lohn = Math.min(2, (o.lohn ?? 1) + 1); } }
  else if (art === 'zeit') sp.zeit = Math.max(0, sp.zeit - 1);
  else if (art === 'miete') sp.preis = Math.max(0, sp.preis - 1);
  else { const c = impZulage(k); KT.s.cash -= c; impLog(art === 'kohle' ? 'Reparaturen und Kohle für die Mietshäuser' : 'Teuerungszulage: ' + SPARTEN[k].n, -c); }
  sp.vertrag = KT.s.day + 4; impLohnSnap();
  if (IMP.s.wort && art === 'lohn') IMP.s.wort.ok = 1;
}
// i: 0 annehmen, 1 verhandeln, 2 ablehnen; schon = der Spieler hat es von selbst erfüllt
export function impFordAntwort(i, schon) {
  const S = IMP.s, F = S.ford; if (!F) return false;
  const k = F.sp, sp = S.sp[k], A = SPARTEN[k]; S.ford = null;
  if (i === 0) {
    if (!schon) impErfuelle(k, F.k); else sp.vertrag = KT.s.day + 4;
    sp.zuf = clamp(sp.zuf + 12, 0, 100); sp.ruhe = 5;
    rufAdd({ arbeiter: 3, elite: -1, presse: 0.5 }, 'Forderung erfüllt: ' + FORD[F.k].t);
    impKurs(Object.fromEntries(A.cos.map(c => [c, -0.02])));
    toast(`${A.spr}: „Das werden wir Ihnen nicht vergessen, Herr Alexander.“`);
    impNews(`Alexander gibt nach: ${FORD[F.k].t} für ${A.leute}`, `Ohne einen Tag Streik hat Alexander die Forderung der Belegschaft erfüllt. Die Börse nimmt es kühl, das Viertel mit Erleichterung. ${A.spr}: „So geht es auch.“`, 5);
  } else if (i === 1) {
    const ok = Math.random() < 0.4 + rufGet('arbeiter') / 250 + (S.flag.rat ? 0.15 : 0);
    if (ok) {
      const c = Math.round(impZulage(k) * 0.5 / 500) * 500; KT.s.cash -= c; impLog('Einigung mit der Belegschaft: ' + A.n, -c);
      sp.zuf = clamp(sp.zuf + 7, 0, 100); sp.ruhe = 4;
      rufAdd({ arbeiter: 1.5, presse: 0.5 }, 'Mit der Belegschaft geeinigt');
      toast(`Einigung: einmalig ${fmM(c)} für ${A.leute}`);
      impNews('Einigung am Verhandlungstisch', `Nach langer Nacht haben sich Alexander und ${A.leute} geeinigt: eine einmalige Zahlung, kein Streik. Beide Seiten sprechen von einem Kompromiss, keine von einem Sieg.`, 4);
    } else { toast('Die Verhandlung ist gescheitert'); rufAdd({ arbeiter: -1 }, 'Verhandlung gescheitert', { quiet: true }); impStreikStart(k, F.k, false, F.snap); }
  } else {
    sp.zuf = clamp(sp.zuf - 6, 0, 100);
    const angst = rufGet('furcht') > 70;   // vor einem Mann, der Autos wirft, streikt man nicht leichtfertig
    if (Math.random() < (angst ? 0.35 : 0.75)) impStreikStart(k, F.k, false, F.snap);
    else {
      sp.ruhe = 3; rufAdd({ arbeiter: -2.5, elite: 0.5, unter: 1.5 }, 'Forderung abgelehnt: ' + FORD[F.k].t);
      toast(angst ? `${Leute(k)} wagen den Streik nicht. Noch nicht.` : `${Leute(k)} murren, aber sie arbeiten weiter.`);
      impNews(`Alexander lehnt ab: nichts für ${A.leute}`, angst ? `Die Forderung der Belegschaft ist abgelehnt. Gestreikt wird nicht: „Mit einem, der Automobile durch die Luft wirft, legt man sich nicht an“, sagt einer am Werkstor und sieht sich dabei um.` : `Die Forderung der Belegschaft ist abgelehnt. Die Leute arbeiten weiter, mit Fäusten in den Taschen.`, 5);
    }
  }
  ktChanged('imperium');
  return true;
}

/* ---------- Streik ---------- */
export const impStreik = () => { if (!IMP.s) return false; for (const k in IMP.s.sp) if (IMP.s.sp[k].streik && !IMP.s.sp[k].streik.brecher) return true; return false; };
function impStreikStart(k, art, wild, snap) {
  const S = IMP.s, sp = S.sp[k], A = SPARTEN[k]; if (sp.streik || !mitBetrieb(k)) return;
  if (S.ford && S.ford.sp === k) S.ford = null;
  sp.streik = { k: art, d: 0, kasse: 3 + Math.round((RUF.ready ? rufGet('unter') : 30) / 40) + (S.flag.rat ? 1 : 0), brecher: 0, snap: snap || impSnap(k) };
  rufAdd({ elite: -1, presse: -0.5, unter: 2 }, (A.mieter ? 'Mietstreik' : 'Streik') + ': ' + A.n);
  impKurs(Object.fromEntries(A.cos.map(c => [c, -0.05])));
  if (STR) STR.clearT = 0;
  const bahn = k === 'verkehr' && own('bahn');
  toast(A.mieter ? 'Mietstreik! Die Mieter zahlen nicht mehr' : `Streik! ${Leute(k)} legen die Arbeit nieder`);
  impNews(A.mieter ? 'Mietstreik in Vespera!' : `Streik! ${Leute(k)} legen die Arbeit nieder`,
    A.mieter ? 'In den Mietshäusern der Vespera Wohnungsbau zahlt seit heute niemand mehr Miete. Aus den Fenstern hängen Bettlaken mit einer einzigen Zahl: der alten Miete. „Er hat die Häuser gebaut“, sagt Frieda Kolbe vom Mieterrat, „aber wir wohnen darin.“'
      : `${wild ? 'Ohne Vorwarnung' : 'Nach der Absage der Direktion'} ruht die Arbeit. ${bahn ? 'Straßenbahn und Hochbahn stehen an den Haltestellen, die Stadt geht zu Fuß. ' : ''}Die Belegschaft verlangt ${FORD[art].t}. ${A.spr}: „Wir bauen seine Stadt, wir heizen seine Türme. Jetzt soll er merken, wie still sie ohne uns ist.“ Am Kneipenplatz sammelt sich die Kundgebung.`,
    8, A.mieter ? 'Extrablatt! Mietstreik in Vespera!' : 'Extrablatt! Streik bei Alexander!');
  impFlags(); ktChanged('imperium');
}
// wie: erfuellt, brecher, polizei, zusammen
export function impStreikEnde(k, wie, schon) {
  const S = IMP.s, sp = S.sp[k], st = sp.streik, A = SPARTEN[k]; if (!st) return false;
  if (wie === 'brecher') {
    if (st.brecher || A.mieter) return false;
    const c = Math.max(8000, Math.round(impStaff(k) * 60 / 1000) * 1000);
    if (KT.s.cash < c) { toast('Dafür reicht das Bargeld nicht'); return false; }
    KT.s.cash -= c; impLog('Streikbrecher angeworben: ' + A.n, -c); st.brecher = 1; st.kasse = Math.min(st.kasse, 2);
    rufAdd({ arbeiter: -6, unter: 4, furcht: 1.5, elite: 1 }, 'Streikbrecher angeworben');
    toast('Die Streikbrecher sind da. Vor den Toren fliegen Schneebälle und Schlimmeres.');
    impNews('Alexander holt Streikbrecher', `Mit dem Morgenzug kamen Fremde durch den Tunnel, angeworben für den doppelten Lohn. Unter Polizeischutz gingen sie durch die Tore. ${A.spr}: „Für die hat er Geld.“`, 7, 'Extrablatt! Streikbrecher in Vespera!');
    impFlags(); ktChanged('imperium'); return true;
  }
  sp.streik = null; sp.ruhe = 5;
  if (wie === 'erfuellt') {
    if (!schon) impErfuelle(k, st.k); else sp.vertrag = KT.s.day + 4;
    sp.zuf = clamp(sp.zuf + 8, 0, 100);
    rufAdd({ arbeiter: 4, elite: -2, presse: 1, unter: -2 }, (A.mieter ? 'Mietstreik' : 'Streik') + ' beendet: Forderung erfüllt');
    toast(A.mieter ? 'Die Mieter zahlen wieder' : `${Leute(k)} gehen zurück an die Arbeit`);
    impNews(A.mieter ? 'Mietstreik beendet: Alexander lenkt ein' : `Streik beendet: ${A.leute} haben gewonnen`, `Nach ${st.d || 1} ${st.d > 1 ? 'Tagen' : 'Tag'} hat Alexander die Forderung erfüllt: ${FORD[st.k].t}. Im Viertel wird gefeiert. In den Salons heißt es, er habe sich erpressen lassen; am Kneipenplatz, er habe endlich zugehört.`, 7);
  } else if (wie === 'polizei') {
    sp.zuf = clamp(sp.zuf - 15, 0, 100); sp.ruhe = 3;
    if (!schon) { rufAdd({ arbeiter: -10, buerger: -3, furcht: 6, presse: -4, elite: 1, unter: 8 }, A.mieter ? 'Mieter aus den Häusern geräumt' : 'Streik von der Polizei aufgelöst'); if (STR) STR.clearT = 600; }
    else rufAdd({ buerger: -2, furcht: 2, unter: 5 }, 'Streik mit der Polizei gebrochen', { quiet: true });
    toast(A.mieter ? 'Die Polizei räumt die Wohnungen der Wortführer' : 'Die Polizei löst die Streikposten auf');
    impNews(A.mieter ? 'Polizei räumt Wohnungen: Familien im Schnee' : `Polizei bricht den Streik: ${A.leute} zurück an die Arbeit`, A.mieter ? 'Auf Alexanders Wunsch hat Polizeipräsident Brenner die Wohnungen der Wortführer räumen lassen. Betten und Kochtöpfe standen am Abend im Schnee. Die übrigen Mieter zahlen wieder, und schweigen.' : 'Auf Alexanders Wunsch hat Polizeipräsident Brenner die Streikposten auflösen lassen. Die Arbeit läuft wieder. „Er hat gewonnen“, sagt ein Arbeiter dem Kurier, „und er wird sich wundern, was er dabei verloren hat.“', 8, 'Extrablatt! Polizei bricht den Streik!');
  } else {   // die Streikkasse ist leer
    sp.zuf = clamp(sp.zuf + 2, 0, 38); sp.ruhe = 4;
    rufAdd({ arbeiter: -2, elite: 1, unter: 3 }, (A.mieter ? 'Mietstreik' : 'Streik') + ' zusammengebrochen', { quiet: true });
    toast(A.mieter ? 'Der Mietstreik bricht zusammen: Die Mieter zahlen wieder' : `Die Streikkasse ist leer: ${A.leute} kehren zurück`);
    impNews(A.mieter ? 'Mietstreik bricht zusammen' : 'Streik bricht zusammen', `Nach ${st.d} Tagen ist die Streikkasse leer. ${Leute(k)} ${A.mieter ? 'zahlen wieder' : 'kehren an die Arbeit zurück'}, ohne etwas erreicht zu haben. Alexander hat den längeren Atem gehabt. Vergessen ist damit nichts.`, 6);
  }
  impFlags(); ktChanged('imperium');
  return true;
}
function impFlags() { KT.bahnStill = !!(IMP.s && IMP.s.sp.verkehr.streik && !IMP.s.sp.verkehr.streik.brecher && own('bahn')); }

/* ---------- Vorlagen ---------- */
export function impVorNeu(id) {
  const S = IMP.s;
  if (!id) {
    const frei = Object.keys(VORLAGEN).filter(v => S.ent[v] === undefined && !S.vor.some(p => p.id === v) && !(S.vorCd[v] > KT.s.day) && (() => { try { return VORLAGEN[v].need(); } catch (e) { return false; } })());
    if (!frei.length) return false; id = frei[Math.floor(Math.random() * frei.length)];
  }
  const V = VORLAGEN[id]; if (!V || S.vor.some(p => p.id === id)) return false;
  S.vor.push({ id, day: KT.s.day }); toast(`Vorlage von ${V.von}: ${V.t} (Kontor · Imperium)`);
  ktChanged('imperium'); return true;
}
export function impVorWahl(id, i) {
  const S = IMP.s, V = VORLAGEN[id], o = V && V.opts[i]; if (!o || !S.vor.some(p => p.id === id)) return false;
  const ex = o[3] || {};
  if (ex.cost) { if (KT.s.cash < ex.cost) { toast('Dafür reicht das Bargeld nicht'); return false; } KT.s.cash -= ex.cost; impLog(V.t, -ex.cost); }
  S.vor = S.vor.filter(p => p.id !== id); S.ent[id] = i; IMP.modC = null;
  if (ex.fn) try { ex.fn(); } catch (e) { console.warn('Imperium:', e); }
  if (ex.kurs) impKurs(ex.kurs);
  if (o[1] && Object.keys(o[1]).length) rufAdd(o[1], V.t + ': ' + o[0].replace(/ · .*$/, ''));
  if (ex.news) impNews(ex.news[0], ex.news[1], ex.news[2], ex.news[2] >= 8 ? 'Extrablatt! ' + ex.news[0] : undefined);
  toast(o[2]); impNach();
  return true;
}

/* ---------- Kredit ---------- */
const bankMehr = () => (KT.s.shares.bank || 0) >= 50000;
export const impKreditMax = () => Math.max(0, Math.round((netWorth() + IMP.s.kredit) * (bankMehr() ? 0.4 : 0.25) / 10000) * 10000);
export const impZins = () => bankMehr() ? 0.0025 : 0.005;
export function impKredit(n) {
  const S = IMP.s;
  if (n > 0) { n = Math.min(n, impKreditMax() - S.kredit); if (n <= 0) { toast('Die Vespera-Bank gibt Ihnen keinen weiteren Kredit'); return false; } S.kredit += n; ktCash(n, 'Kredit der Vespera-Bank'); }
  else { n = Math.min(-n, S.kredit, Math.max(0, KT.s.cash)); if (n <= 0) return false; S.kredit -= n; ktCash(-n, 'Kredit getilgt'); }
  return true;
}

/* ---------- Geschäftstag ---------- */
export function impDay() {
  const S = IMP.s, s = KT.s; if (S.day === s.day) return; S.day = s.day;
  const T = impSum(); S.bil.push(Math.round(T.gew)); if (S.bil.length > 14) S.bil.shift();
  // Zinsen, Charter, Bezüge aus Mehrheiten
  if (S.kredit > 0) { const z = S.kredit * impZins(); s.cash -= z; impLog('Zinsen Vespera-Bank', -z); }
  if (S.flag.charter && own('imperial')) { s.cash += S.flag.charter; impLog(S.flag.charter > 0 ? 'Charter Aurora Imperial' : 'Rundflüge für die Waisenkinder', S.flag.charter); }
  let bez = 0; for (const c in s.shares) if (s.shares[c] >= 50000) bez += s.shares[c] * s.cp[c] * 0.0015;
  if (bez) { s.cash += bez; impLog('Bezüge aus dem Aufsichtsrat', bez); }
  // Konjunktur: zieht zur Mitte, schwankt, Wohlstand hilft
  S.konj = clamp(S.konj * 0.86 + (Math.random() + Math.random() + Math.random() - 1.5) * 0.2 + (s.wohl - 50) / 50 * 0.03, -0.8, 0.8);
  const idx0 = impIndex();
  if (s.day > 6 && s.day - S.crash > 18 && (S.konj > 0.3 || idx0 > 135) && Math.random() < 0.06) {
    S.crash = s.day; S.konj = -0.55;
    for (const c in COS) impKurs({ [c]: -(0.14 + Math.random() * 0.14) });
    toast('Kurssturz an der Börse von Vespera!');
    impNews('Kurssturz an der Börse von Vespera', 'In einer einzigen Stunde verloren die Papiere der Stadt ein Fünftel ihres Wertes. Vor der Vespera-Bank stehen Sparer Schlange, in der Börsenhalle liegen Zettel wie Schnee. Wer jetzt Bargeld hat, kauft die Stadt zum halben Preis. Einer hat es.', 9, 'Extrablatt! Kurssturz an der Börse!');
  } else for (const c in COS) impKurs({ [c]: 0.012 * S.konj });
  // Sparten
  let zA = 0, zW = 0;
  for (const k in S.sp) {
    const sp = S.sp[k], A = SPARTEN[k]; if (!mitBetrieb(k)) { sp.streik = null; if (S.ford && S.ford.sp === k) S.ford = null; continue; }
    const st = sp.streik, w = A.mieter || k === 'hotel' ? 1 : clamp(impStaff(k) / 150, 0.15, 1);
    if (st) {
      st.d++; st.kasse--;
      impKurs(Object.fromEntries(A.cos.map(c => [c, -0.03])));
      rufAdd({ elite: -0.5 * w, unter: 0.8 * w }, 'Der Streik dauert an', { quiet: true, key: 'imp:streik' + k });
      if (st.kasse <= 0) impStreikEnde(k, 'zusammen');
      else if (st.d === 2) impNews(A.mieter ? 'Mietstreik, zweiter Tag' : `Streik, zweiter Tag: ${A.n} steht still`, `${Leute(k)} halten durch. Die Streikkasse reicht noch für ${st.kasse} ${st.kasse === 1 ? 'Tag' : 'Tage'}, heißt es am Kneipenplatz. Alexander verliert mit jedem Tag Geld und in den Salons Ansehen: „Er hat seine Leute nicht im Griff.“`, 5);
      continue;
    }
    sp.zuf += (impZiel(k) - sp.zuf) * 0.3; sp.ausl += (impNachfrage(k) - sp.ausl) * 0.35;
    if (!A.mieter) { const n = impStaff(k); zA += sp.zuf * n; zW += n; }
    // Preise und Arbeitszeit sprechen sich herum
    const R = A.preis.ruf[sp.preis], ch = {};
    if (R) for (const g in R) { const v = rufGet(g); if (R[g] > 0 ? v < 78 : v > 32) ch[g] = R[g] * w; }
    if (!A.mieter && sp.zeit === 2 && rufGet('arbeiter') > 30) ch.arbeiter = (ch.arbeiter || 0) - 0.3 * w;
    if (!A.mieter && sp.zeit === 0 && !S.flag.acht) { if (rufGet('arbeiter') < 80) ch.arbeiter = (ch.arbeiter || 0) + 0.3 * w; if (rufGet('elite') > 45) ch.elite = (ch.elite || 0) - 0.1 * w; }
    if (Object.keys(ch).length) rufAdd(ch, A.preis.t + ' und Arbeitszeit: ' + A.n, { quiet: true, key: 'imp:tag' + k });
    // Forderung
    if (sp.ruhe > 0) sp.ruhe--;
    else if (!S.ford) { const thr = S.flag.rat ? 34 : 40; if (sp.zuf < thr && Math.random() < 0.3 + (thr - sp.zuf) / 40) impFordNeu(k); }
  }
  if (zW) {   // die Stimmung in den Betrieben färbt auf das Viertel ab
    const z = zA / zW, d = clamp((z - 55) / 45, -1, 1) * 0.5 * clamp(zW / 400, 0.2, 1), v = rufGet('arbeiter');
    if (d > 0 ? v < 82 : v > 25) rufAdd({ arbeiter: d }, d > 0 ? 'Zufriedene Belegschaft' : 'Unmut in den Betrieben', { quiet: true, key: 'imp:zuf' });
    s.wohl = clamp(s.wohl + (z > 70 ? 0.2 : z < 35 ? -0.2 : 0), 0, 100);
  }
  if (own('wohnbau')) s.wohl = clamp(s.wohl + [0.15, 0, -0.2][S.sp.wohnen.preis], 0, 100);
  // Frist der Forderung
  if (S.ford && s.day - S.ford.day >= S.ford.frist) { toast('Die Frist ist abgelaufen'); impFordAntwort(2); }
  // Folgen früherer Beschlüsse
  if (S.ent.gitter === 1 && ownSec('industrie') && Math.random() < 0.1) {
    delete S.ent.gitter; S.vorCd.gitter = s.day + 1; IMP.modC = null; s.cash -= 15000; impLog('Unfall im Walzwerk: Arzt und Abfindung', -15000);
    S.sp.industrie.zuf = clamp(S.sp.industrie.zuf - 10, 0, 100);
    rufAdd({ arbeiter: -5, presse: -3, buerger: -1.5, unter: 2 }, 'Unfall im Walzwerk');
    toast('Unfall im Walzwerk: Die Walze hat einen Arbeiter erfasst');
    impNews('Schwerer Unfall im Walzwerk', 'Die Walze hat einen Arbeiter erfasst; er wird den Arm verlieren. Schutzgitter waren beantragt und abgelehnt worden, wie Werkmeister Kröger dem Kurier bestätigt. Sechzigtausend Lumen hätten sie gekostet. Alexanders Belmont nimmt das an einem Abend ein.', 8, 'Extrablatt! Unfall im Walzwerk!');
  }
  if (S.flag.kartell && Math.random() < 0.09) {
    delete S.flag.kartell; S.ent.kartell = 1; IMP.modC = null; s.cash -= 120000; impLog('Strafe des Stadtrats: Preisabsprache', -120000);
    rufAdd({ presse: -6, buerger: -5, arbeiter: -3, elite: -1 }, 'Stahlkartell aufgeflogen'); impKurs({ stahl: -0.08 });
    toast('Der Kurier hat das Stahlkartell aufgedeckt');
    impNews('Enthüllt: das Stahlkartell von Alexander und Hallstein', 'Ein Händedruck im Polarclub, und der Stahl wurde teurer für jeden, der in dieser Stadt baut. Dem Kurier liegen die Abrechnungen vor. Der Stadtrat verhängt 120.000 Lumen Strafe; für die beiden Herren ein Trinkgeld. Von Margot Wendt.', 9, 'Extrablatt! Stahlkartell aufgeflogen!');
  }
  // das Wort vom Kneipenplatz
  if (S.wort && s.day - S.wort.day >= 2) {
    if (S.wort.ok || impLohnSum() > S.wort.sum) { rufAdd({ arbeiter: 4, presse: 1.5, bew: 1 }, 'Wort gehalten: Die Löhne sind gestiegen'); impNews('Alexander hält Wort', 'Am Kneipenplatz hatte er höhere Löhne versprochen, und die Lohntüten dieser Woche sind schwerer. „Hätt’ ich nicht gedacht“, sagt der Redner der Kundgebung. Es klingt fast enttäuscht.', 6); }
    else { rufAdd({ arbeiter: -7, presse: -2.5, unter: 3 }, 'Wortbruch: Die versprochenen Löhne blieben aus'); toast('Die versprochenen Löhne sind ausgeblieben. Das Viertel hat es gemerkt.'); impNews('Leere Worte am Kneipenplatz', 'Vor allen Leuten hat Alexander höhere Löhne versprochen. Die Lohntüten dieser Woche sind so leicht wie zuvor. Am Kneipenplatz hängt ein neues Schild: „Sein Wort wiegt weniger als sein Hut.“', 7); }
    S.wort = null;
  }
  // Vorlagen: alte verfallen, neue kommen
  S.vor = S.vor.filter(p => { if (s.day - p.day < 4) return true; S.vorCd[p.id] = s.day + 5; return false; });
  if (S.vor.length < 2 && s.day > 1 && Math.random() < 0.45) impVorNeu();
  // Index, Zeitung
  S.idx.push(impIndex()); if (S.idx.length > 24) S.idx.shift();
  impBox();
  if (s.day % 5 === 0 && T.n > 1) {
    const sum = S.bil.slice(-5).reduce((a, b) => a + b, 0), z = zW ? zA / zW : 55;
    impNews(`Alexanders Imperium: ${fmM(sum)} in fünf Tagen`, `${T.n} Häuser und Betriebe, ${fmN(impStaffAll())} Beschäftigte, ${fmM(sum)} ${sum >= 0 ? 'Gewinn' : 'Verlust'} seit der letzten Bilanz. ${z >= 68 ? 'Die Belegschaften gelten als die zufriedensten nördlich von Oslo; man kann also reich sein und anständig zahlen.' : z < 42 ? 'Verdient wird das Geld von Leuten, die sich die Stadt, die sie am Laufen halten, kaum leisten können.' : 'Ob das viel ist oder zu viel, darüber streitet man in den Salons anders als am Kneipenplatz.'}`, 4);
  }
  impFlags(); impLohnSnap();
}
function impBox() {
  const S = IMP.s, i = S.idx, ch = i.length > 1 ? i[i.length - 1] - i[i.length - 2] : 0, z = [];
  z.push(['Vespera-Index', String(i[i.length - 1]).replace('.', ',') + ' (' + (ch >= 0 ? '+' : '−') + Math.abs(ch).toFixed(1).replace('.', ',') + ')']);
  z.push(['Konjunktur', konjN(S.konj)]);
  z.push(['Lebenshaltung im Viertel', String(Math.round(impLeben() * 100))]);
  for (const k in S.sp) if (S.sp[k].streik) z.push([SPARTEN[k].n, SPARTEN[k].mieter ? 'Mietstreik' : 'Streik, Tag ' + (S.sp[k].streik.d + 1)]);
  try { window.dispatchEvent(new CustomEvent('vespera-news-box', { detail: { id: 'imperium', titel: 'Wirtschaft', zeilen: z } })); } catch (e) { /* ohne Zeitung */ }
}

/* ---------- Kontorbuch: Reiter Imperium ---------- */
function impCss() {
  const st = document.createElement('style');
  st.textContent = `
#kt .seg{display:inline-flex;gap:0;margin:2px 0}
#kt .seg button{border-right-width:0}#kt .seg button:last-child{border-right-width:1px}
#kt main button.on{color:#1a1206;background:linear-gradient(#f6dc9a,#c9a258);border-color:#f6dc9a;cursor:default}
#kt .sp{border:1px solid rgba(217,178,106,.3);padding:10px 12px;margin-bottom:10px;background:rgba(217,178,106,.03)}
#kt .sp.streik{border-color:#f0a070;background:rgba(240,160,112,.07)}
#kt .sp h4{font:400 17px/1.2 var(--display);letter-spacing:.12em;color:var(--gold-hi,#f6dc9a);margin:0 0 2px}
#kt .sp h4 small{font:600 10px/1 var(--body);letter-spacing:.22em;text-transform:uppercase;color:var(--gold,#d9b26a);margin-left:10px}
#kt .sp .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px 14px;margin:6px 0;font-size:12px;color:var(--muted,#b9ab8f)}
#kt .sp .row b{display:block;font-size:14px;color:var(--ink,#efe6d2);font-weight:600;font-variant-numeric:tabular-nums}
#kt .sp .ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:6px 14px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold,#d9b26a)}
#kt .sp .hint{font-size:12px;margin:6px 0 0}
#kt .q.warn{border-color:#f0a070;background:rgba(240,160,112,.07)}
#kt .bar.z i{background:linear-gradient(90deg,#b0603c,#d9b26a 45%,#7fe3d6)}
#ktHud .imp{pointer-events:auto;cursor:pointer;font:600 11px/1.2 var(--body);letter-spacing:.2em;text-transform:uppercase;color:#f6dc9a;background:var(--panel,rgba(5,16,24,.8));border:1px solid rgba(217,178,106,.55);border-right:3px solid #d9b26a;padding:6px 10px 4px;white-space:nowrap}
#ktHud .imp.rot{color:#ffd0b0;border-color:#f0a070;border-right-color:#f0a070}
`;
  document.head.append(st);
}
const seg = (act, k, cur, names, dis) => `<span class="seg">${names.map((n, i) => `<button type="button" data-act="imp" data-id="${act}:${k}:${i}" class="${i === cur ? 'on' : ''}" ${dis && i !== cur ? 'disabled' : ''}>${esc(n)}</button>`).join('')}</span>`;
const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(v, 0, 100).toFixed(0)}%"></i></div>`;
const sgn = v => (v >= 0 ? '+' : '') + fmN(v);
function spark(h, w = 110, hh = 26) {
  if (!h || h.length < 2) return '';
  const lo = Math.min(...h), hi = Math.max(...h), d = hi - lo || 1;
  return `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" aria-hidden="true"><polyline points="${h.map((v, i) => `${(i / (h.length - 1) * w).toFixed(1)},${(hh - 2 - (v - lo) / d * (hh - 4)).toFixed(1)}`).join(' ')}" fill="none" stroke="${h[h.length - 1] >= h[0] ? '#7fe3d6' : '#f0a070'}" stroke-width="1.5"/></svg>`;
}
function impLage() {   // was gerade eine Antwort braucht
  const S = IMP.s; let h = '';
  for (const k in S.sp) {
    const st = S.sp[k].streik, A = SPARTEN[k]; if (!st) continue;
    const c = Math.max(8000, Math.round(impStaff(k) * 60 / 1000) * 1000);
    h += `<div class="q warn"><b>${A.mieter ? 'Mietstreik' : 'Streik: ' + esc(A.n)}</b><span class="who">Tag ${st.d + 1} · Streikkasse reicht noch ${st.kasse} ${st.kasse === 1 ? 'Tag' : 'Tage'}</span>
      <p>${esc(Leute(k))} verlangen ${esc(FORD[st.k].t)}. ${A.mieter ? 'Solange zahlt niemand Miete.' : st.brecher ? 'Streikbrecher halten den Betrieb notdürftig am Laufen.' : 'Solange steht alles still; der Unterhalt läuft weiter.'}${k === 'verkehr' && KT.bahnStill ? ' Straßenbahn und Hochbahn stehen an den Haltestellen.' : ''} Am Kneipenplatz steht die Kundgebung; Sie können auch dort mit den Leuten reden.</p>
      <div class="btns"><button type="button" class="gold" data-act="imp" data-id="streik:${k}:erfuellt">${esc(FORD[st.k].ja)}: Forderung erfüllen</button>${A.mieter || st.brecher ? '' : `<button type="button" data-act="imp" data-id="streik:${k}:brecher">Streikbrecher anwerben · ${fmM(c)}</button>`}<button type="button" data-act="imp" data-id="streik:${k}:polizei">${A.mieter ? 'Wortführer räumen lassen' : 'Polizei rufen'}</button></div>
      <p>Aussitzen geht auch: Ist die Streikkasse leer, ${A.mieter ? 'zahlen die Mieter wieder' : 'kommen die Leute zurück'}. Zufriedener sind sie dann nicht.</p></div>`;
  }
  const F = S.ford;
  if (F) {
    const A = SPARTEN[F.sp], left = Math.max(0, F.frist - (KT.s.day - F.day));
    h += `<div class="q aktiv"><b>Forderung: ${esc(FORD[F.k].t)}</b><span class="who">${esc(A.spr)} · Antwort in ${left} ${left === 1 ? 'Tag' : 'Tagen'}</span><p>${esc(FORD[F.k].x(F.sp))} Zufriedenheit ${Math.round(S.sp[F.sp].zuf)} von 100.</p>
      <div class="btns"><button type="button" class="gold" data-act="imp" data-id="ford:0">${esc(FORD[F.k].ja)}</button><button type="button" data-act="imp" data-id="ford:1">Verhandeln</button><button type="button" data-act="imp" data-id="ford:2">Ablehnen</button></div>
      <p>Annehmen bindet Sie vier Tage. Verhandeln kann mit einer kleineren Zahlung enden oder im Streik. Wer ablehnt, riskiert den Streik.</p></div>`;
  }
  for (const p of S.vor) {
    const V = VORLAGEN[p.id], left = Math.max(1, 4 - (KT.s.day - p.day));
    h += `<div class="q"><b>${esc(V.t)}</b><span class="who">${esc(V.von)} · noch ${left} ${left === 1 ? 'Tag' : 'Tage'}</span><p>${esc(V.x)}</p><div class="btns">${V.opts.map((o, i) => `<button type="button" data-act="imp" data-id="vor:${p.id}:${i}" ${o[3] && o[3].cost > KT.s.cash ? 'disabled' : ''}>${esc(o[0])}</button>`).join('')}</div></div>`;
  }
  return h;
}
function impRender() {
  const S = IMP.s, T = impSum(), leb = impLeben(), n = impStaffAll();
  let zA = 0; for (const k in S.sp) if (!SPARTEN[k].mieter) zA += S.sp[k].zuf * impStaff(k);
  const z = n ? zA / n : 0, i = S.idx, lage = impLage();
  let h = `<div class="grid">
    <div class="tile"><small>Umsatz am Tag</small><b>${fmM(T.um)}</b><p>Löhne ${fmM(T.lohn)} · Material ${fmM(T.mat)} · Unterhalt ${fmM(T.unt)}</p></div>
    <div class="tile"><small>Gewinn der Betriebe</small><b class="${T.gew >= 0 ? 'up' : 'dn'}">${sgn(T.gew)} Lumen</b><p>${spark(S.bil)} ${S.bil.length > 1 ? 'letzte ' + S.bil.length + ' Tage' : 'Verlauf ab morgen'}</p></div>
    <div class="tile"><small>Belegschaft</small><b>${fmN(n)} Köpfe</b><p>${n ? 'im Schnitt ' + zufN(z) + ' (' + Math.round(z) + ')' : 'noch keine Betriebe'}${S.flag.rat ? ' · Betriebsräte' : ''}${S.flag.acht ? ' · Achtstundentag' : ''}</p>${n ? bar(z, 'z') : ''}</div>
    <div class="tile"><small>Konjunktur</small><b>${esc(konjN(S.konj))}</b><p>Vespera-Index ${String(i[i.length - 1]).replace('.', ',')} ${spark(i, 70, 18)}</p></div>
    <div class="tile"><small>Lebenshaltung im Viertel</small><b class="${leb > 1.08 ? 'dn' : leb < 0.95 ? 'up' : ''}">${Math.round(leb * 100)}</b><p>100 ist üblich. Kohle, Bier, Fisch und Kaffee am Kneipenplatz, dazu Mieten und Fahrpreise.</p></div>
  </div>`;
  h += lage ? `<h3>Auf Ihrem Schreibtisch</h3>${lage}` : '<h3>Auf Ihrem Schreibtisch</h3><p>Keine Forderungen, keine Vorlagen. Die Direktoren melden sich, wenn etwas zu entscheiden ist.</p>';
  h += '<h3>Sparten</h3><p>Hohe Preise bringen sofort mehr Geld, dann bleibt Kundschaft weg. Längere Schichten bringen mehr Ausstoß und weniger Zufriedenheit. Zufriedene Leute leisten bis zu 15 % mehr, unzufriedene stellen Forderungen und streiken.</p>';
  for (const k in SPARTEN) {
    const A = SPARTEN[k], sp = S.sp[k], ids = impIds(k);
    if (!ids.length) { h += `<div class="sp"><h4>${esc(A.n)}<small>kein Betrieb</small></h4><p class="hint">Im Reiter <button type="button" data-tab="besitz">Besitz</button> kaufen Sie ${k === 'industrie' ? 'Fabriken' : k === 'verkehr' ? 'die Verkehrsbetriebe, Fähre, Wassertaxis oder die Rundflug-Gesellschaft' : k === 'handel' ? 'Läden' : k === 'gastro' ? 'Lokale, das Varieté oder die Eisbahn' : 'Betriebe'}.</p></div>`; continue; }
    const R = impSum(k), L = avgLohn(k), lv = Math.round(L), mix = ids.some(id => (KT.s.own[id].lohn ?? 1) !== lv), st = sp.streik;
    h += `<div class="sp ${st ? 'streik' : ''}"><h4>${esc(A.n)}<small>${ids.length === 1 ? esc(BIZ[ids[0]].n) : ids.length + ' Betriebe'}${st ? (A.mieter ? ' · Mietstreik' : ' · Streik') : ''}${sp.vertrag > KT.s.day ? ' · Abmachung gilt noch ' + (sp.vertrag - KT.s.day) + (sp.vertrag - KT.s.day === 1 ? ' Tag' : ' Tage') : ''}</small></h4>
      <div class="row">
        <div>Umsatz<b>${fmN(R.um)}</b></div><div>${A.mieter ? 'Verwaltung' : 'Löhne'}<b>${fmN(R.lohn)}</b></div><div>Gewinn am Tag<b class="${R.gew >= 0 ? 'up' : 'dn'}">${sgn(R.gew)}</b></div>
        <div>${A.mieter ? 'Vermietet' : 'Auslastung'} ${Math.round(sp.ausl * 100)} %${bar(sp.ausl / 1.15 * 100)}</div>
        <div>${A.mieter ? 'Mieter' : fmN(impStaff(k)) + ' Beschäftigte'}: ${esc(zufN(sp.zuf))} (${Math.round(sp.zuf)})${bar(sp.zuf, 'z')}</div>
      </div>
      <div class="ctl">
        <div>${esc(A.preis.t)}<br>${seg('preis', k, sp.preis, A.preis.n)}</div>
        ${A.mieter ? '' : `<div>Arbeitszeit<br>${seg('zeit', k, sp.zeit, ZEIT.map(Z => Z.n), !!S.flag.acht)}</div>`}
        <div>${A.mieter ? 'Hausmeister und Verwaltung' : 'Löhne'}${mix ? ' (gemischt)' : ''}<br>${seg('lohn', k, mix ? -1 : lv, LOHN_N)}</div>
      </div>
      <p class="hint">${esc(A.preis.h[sp.preis])}${!A.mieter && sp.zeit === 2 ? ' Zwölf Stunden am Tag: Die Leute sind abends zu müde zum Schimpfen. Noch.' : ''}${!A.mieter && sp.zeit === 0 && !S.flag.acht ? ' Acht Stunden: Die anderen Fabrikherren halten Sie für verrückt.' : ''}</p></div>`;
  }
  const max = impKreditMax(), zi = (impZins() * 100).toFixed(2).replace('.', ',');
  h += `<h3>Vespera-Bank</h3><p>Kredit bis ${fmM(max)} (${bankMehr() ? '40 % Ihres Vermögens, weil Ihnen die Bank mehrheitlich gehört' : 'ein Viertel Ihres Vermögens'}), Zinsen ${zi} % am Tag. Schulden: <b style="color:var(--gold-hi)">${fmM(S.kredit)}</b>${S.kredit ? ' · Zinsen ' + fmM(S.kredit * impZins()) + ' am Tag' : ''}</p>
    <p><button type="button" data-act="imp" data-id="kredit:100000" ${S.kredit >= max ? 'disabled' : ''}>+100.000 leihen</button> <button type="button" data-act="imp" data-id="kredit:1000000" ${S.kredit >= max ? 'disabled' : ''}>+1.000.000 leihen</button> <button type="button" data-act="imp" data-id="kredit:-100000" ${S.kredit ? '' : 'disabled'}>100.000 tilgen</button> <button type="button" data-act="imp" data-id="kredit:-999999999" ${S.kredit ? '' : 'disabled'}>alles tilgen</button></p>`;
  const done = Object.keys(S.ent).filter(id => VORLAGEN[id]);
  if (done.length) h += `<h3>Beschlüsse</h3><table>${done.map(id => `<tr><td>${esc(VORLAGEN[id].t)}<span class="s">${esc(VORLAGEN[id].von)}</span></td><td>${esc(VORLAGEN[id].opts[S.ent[id]][0].replace(/ · .*$/, ''))}</td></tr>`).join('')}</table>`;
  return h;
}
function impAct(id) {
  const [a, b, c] = String(id).split(':');
  if (a === 'preis' || a === 'zeit' || a === 'lohn') impSet(b, a, +c);
  else if (a === 'ford') impFordAntwort(+b);
  else if (a === 'streik') impStreikEnde(b, c);
  else if (a === 'vor') impVorWahl(b, +c);
  else if (a === 'kredit') impKredit(+b);
  ktRenderNow();
}
function impUeb() {
  const S = IMP.s, n = S.vor.length + (S.ford ? 1 : 0) + Object.values(S.sp).filter(sp => sp.streik).length;
  return `<p style="margin-top:10px">Konjunktur: <b style="color:var(--gold-hi)">${esc(konjN(S.konj))}</b> · Vespera-Index ${String(S.idx[S.idx.length - 1]).replace('.', ',')} · Lebenshaltung im Viertel ${Math.round(impLeben() * 100)}${S.kredit ? ' · Schulden ' + fmM(S.kredit) : ''} · <button type="button" data-tab="imperium">${n ? n + (n === 1 ? ' Sache wartet' : ' Sachen warten') + ' im Imperium' : 'Zum Imperium'}</button></p>`;
}
function impBoerse() {
  const S = IMP.s, i = S.idx, ch = i.length > 1 ? i[i.length - 1] - i[i.length - 2] : 0;
  return `<div class="grid" style="margin-bottom:10px"><div class="tile"><small>Vespera-Index</small><b>${String(i[i.length - 1]).replace('.', ',')} <span class="${ch >= 0 ? 'up' : 'dn'}" style="font-size:13px">${ch >= 0 ? '+' : '−'}${Math.abs(ch).toFixed(1).replace('.', ',')}</span></b><p>${spark(i)}</p></div>
    <div class="tile"><small>Konjunktur</small><b>${esc(konjN(S.konj))}</b><p>Treibt Nachfrage und Kurse. Streiks drücken die Papiere der Branche. Ab der Hälfte der Aktien einer Gesellschaft gibt es Bezüge aus dem Aufsichtsrat.</p></div></div>`;
}

/* ---------- Anzeige oben rechts ---------- */
function impHud() {
  const el = IMP.hud; if (!el) return;
  const S = IMP.s; let t = '', rot = false;
  const st = Object.keys(S.sp).find(k => S.sp[k].streik);
  if (st) { t = (SPARTEN[st].mieter ? 'Mietstreik' : 'Streik · ' + SPARTEN[st].n); rot = true; }
  else if (S.ford) { const l = Math.max(0, S.ford.frist - (KT.s.day - S.ford.day)); t = 'Forderung · ' + (l > 1 ? l + ' Tage' : 'letzter Tag'); rot = l <= 1; }
  else if (S.vor.length) t = S.vor.length === 1 ? 'Vorlage wartet' : S.vor.length + ' Vorlagen warten';
  const key = t + rot; if (key === IMP.hudKey) return; IMP.hudKey = key;
  el.hidden = !t; el.textContent = t; el.classList.toggle('rot', rot);
}

/* ---------- Sätze der Leute ---------- */
RUF_LINES.push(
  { on: () => impStreik(), L: { 'SAY_NEAR.skep': ['Solange gestreikt wird, steht hier alles still, Herr Alexander.', 'Reden Sie mit den Leuten am Kneipenplatz. Die warten auf Sie.'], 'SAY_NEAR.neid': ['Er hat seine Leute nicht im Griff, sagt man im Club.'], 'SAY_NEAR.hass': ['Ohne uns sind Ihre Türme dunkel, Alexander!'] } },
  { on: () => IMP.s && own('wohnbau') && IMP.s.sp.wohnen.preis === 2, L: { 'SAY_NEAR.skep': ['Die Miete frisst den halben Lohn, Herr Alexander.', 'Erst baut er die Häuser, dann zieht er uns das Fell ab.'], 'TALK.skep': ['Seit die Mieten gestiegen sind, heizen wir nur noch die Küche.'] } },
  { on: () => IMP.s && own('wohnbau') && IMP.s.sp.wohnen.preis === 0, L: { 'SAY_NEAR.resp': ['Seit die Miete gesunken ist, bleibt am Monatsende etwas übrig. Danke, Herr Alexander.'], 'SAY_NEAR.neid': ['Billige Mieten. Er kauft sich seine Stadt eben zweimal.'] } },
  { on: () => IMP.s && own('bahn') && IMP.s.sp.verkehr.preis === 2, L: { 'SAY_NEAR.skep': ['Zwei Lumen für die Bahn! Da gehe ich lieber zu Fuß.', 'Die Bahn gehört ihm. Der Preis auch.'] } },
  { on: () => IMP.s && own('bahn') && IMP.s.sp.verkehr.preis === 0, L: { 'SAY_NEAR.resp': ['Fünfzig Funken bis zur Schicht. So lässt sich’s fahren, Herr Alexander.'] } },
  { on: () => IMP.s && IMP.s.flag.acht, L: { 'SAY_NEAR.resp': ['Seit dem Achtstundentag sehe ich meine Kinder wach, Herr Alexander.'], 'SAY_NEAR.neid': ['Acht Stunden! Er verdirbt uns die Arbeiter.'] } },
  { on: () => IMP.s && IMP.s.flag.rat, L: { 'SAY_NEAR.resp': ['Unser Betriebsrat sitzt jetzt bei der Direktion am Tisch. Das hätte ich nie geglaubt.'] } },
  { on: () => IMP.s && Object.keys(IMP.s.sp).some(k => !SPARTEN[k].mieter && IMP.s.sp[k].zeit === 2 && impIds(k).length), L: { 'SAY_NEAR.skep': ['Zwölf Stunden Schicht, Herr Alexander. Zählen Sie mal nach, was da vom Tag bleibt.'], 'SAY_NEAR.hass': ['Zwölf Stunden für dich, Alexander, und der Rest zum Schlafen!'] } },
);

/* ---------- Anschluss ans Kontor ---------- */
function impInit() {
  impLoad(); impCss();
  KT.incFn = (id, base, o) => impRech(id, base, o).gew;
  KT.stillFn = id => { const k = SEC2SP[BIZ[id].sec], st = k && IMP.s.sp[k].streik; return !!(st && !st.brecher); };
  KT.streikFn = impStreik;
  KT.onVersprechen = () => { const sum = impLohnSum(), n = Object.keys(KT.s.own).filter(id => BIZ[id] && BIZ[id].inc > 0).length; IMP.s.wort = { day: KT.s.day, sum, ok: sum >= n * 2 ? 1 : 0 }; toast('Ihr Wort gilt: Binnen zwei Tagen müssen irgendwo die Löhne steigen (Kontor · Imperium)'); };
  KT.onRaeumung = () => { for (const k in IMP.s.sp) if (IMP.s.sp[k].streik) impStreikEnde(k, 'polizei', true); };
  KT.tabs.imperium = { render: impRender };
  KT.acts.imp = impAct; KT.uebTop = impUeb; KT.boerseTop = impBoerse;
  const hud = $('ktHud');
  if (hud) { const c = document.createElement('div'); c.className = 'imp'; c.hidden = true; c.title = 'Kontor · Imperium (Taste I)'; c.addEventListener('click', () => { if (playing && !paused && !KT.open && !DINE.menuOpen) ktOpen('imperium'); }); hud.append(c); IMP.hud = c; }
  IMP.ready = true; impFlags(); impLohnSnap(); impHud(); impBox();
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'handel', tasten: [{ k: ['I'], t: 'Imperium', d: 'Im Kontorbuch, Reiter 2: Preise, Löhne und Arbeitszeit je Sparte, Forderungen, Streiks, Vorlagen der Direktoren, Kredit' }] } })); } catch (e) { /* alt */ }
  if (window.vespera) window.vespera.imperium = { IMP, SPARTEN, VORLAGEN, set: impSet, day: impDay, sum: impSum, fordNeu: impFordNeu, fordAntwort: impFordAntwort, streikEnde: impStreikEnde, vorNeu: impVorNeu, vorWahl: impVorWahl, kredit: impKredit, leben: impLeben, index: impIndex, streik: impStreik };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { try { impInit(); } catch (e) { console.warn('Imperium:', e); } return; }
  if (!IMP.ready) return;
  if (why === 'frame') { if (IMP.hud && (IMP.hudT -= dt) <= 0) { IMP.hudT = 0.5; impHud(); } return; }
  impHud();
  if (why === 'reset') { KT.s.imp = null; impLoad(); impFlags(); impLohnSnap(); return; }
  if (why === 'day') { try { impDay(); } catch (e) { console.warn('Imperium:', e); } return; }
  if (why === 'lohn') {   // Löhne je Betrieb im Reiter Besitz: Abmachungen und Forderungen gelten auch dort
    const S = IMP.s;
    for (const id in KT.s.own) {
      const a = IMP.lohnSnap[id], b = KT.s.own[id].lohn ?? 1, k = BIZ[id] && SEC2SP[BIZ[id].sec];
      if (a !== undefined && b < a && k && BIZ[id].inc > 0 && S.sp[k].vertrag > KT.s.day) { impLohnSnap(); impBruch(k, 'die Löhne sinken wieder', 'lohn'); return; }
    }
    impNach();
  }
});
