/* =====================================================================
   V105 · GEDÄCHTNIS: die Leute merken sich, was Alexander getan hat
   Bisher vergaß Vespera alles sofort: wen er eben durch die Luft geworfen
   hatte, der grüßte ihn eine Minute später wie jeden anderen. Jetzt merken
   sich die Leute, was sie mit ihm erlebt oder gesehen haben, und sprechen
   ihn später darauf an, im Vorbeigehen und wenn er sie anspricht (E).
   - SELBST ERLEBT (Opfer und Beschenkte): geworfen, schweben gelassen, vom
     Energiestoß oder der Druckwelle umgeworfen, am Werkstor bedroht, bei der
     Räumung vom Platz getrieben; aber auch: eine Runde spendiert, Trinkgeld,
     Stammkunde am Stand, Löhne versprochen, für die Streikkasse gespendet,
     ein Anliegen erfüllt oder abgewiesen. Daraus wird eine Haltung zu ihm
     (pd.memAtt, awe.js attOf): wer geworfen wurde, fürchtet oder hasst ihn,
     wem er geholfen hat, der bewundert oder respektiert ihn. Lange hält das
     nur, wenn es etwas Großes war; Kleinigkeiten verblassen nach ein, zwei
     Tagen, Großes nach etwa einer Woche.
   - GESEHEN (Zeugen im Umkreis): wer dabei war, erzählt es ihm, manche
     werden ängstlicher, andere freundlicher.
   - STADTGESPRÄCH: die letzten großen Taten (auch Gala und Stiftungen)
     kennen nach einer Weile alle: „Man erzählt sich, Sie hätten …“
   - BEKANNTE GESICHTER: Bewohner wissen, wie oft er schon mit ihnen geredet
     hat („Sie schon wieder, zweimal an einem Abend!“).
   Benannte Bewohner (citizens) behalten ihr Gedächtnis über das Neuladen
   hinaus (localStorage 'vespera.gedaechtnis'), zufällige Passanten nur für
   diesen Abend. Im Ruf-Buch (Ö) steht ein Abschnitt „Was man sich erzählt“.
   Keine Arbeit in jedem Bild: Gedächtnis entsteht nur bei einer Tat (ein
   Durchlauf über die Figuren) und wird beim Grüßen und Ansprechen gelesen.
   ?gedaechtnis=aus = Stand V104 (niemand erinnert sich).
   ===================================================================== */
import { player } from './player.js';
import { peds } from './serpentine.js';
import { citizens, CIT_SAY } from './ragdoll.js';
import { AWE, attOf } from './awe.js';
import { RUF, rufGet } from './ruf.js';
import { KT, esc } from './kontor.js';
import { POWERS } from './powers.js';
import { BLAST } from './energy.js';
import { AQ } from './aufgaben.js';
import { districtAt } from './boat.js';

export const GEDAECHTNIS = typeof location === 'undefined' || new URLSearchParams(location.search).get('gedaechtnis') !== 'aus';
const SAVE = 'vespera.gedaechtnis';
export const MEM = { ready: false, s: null, ctx: null, dirty: false, saveT: 10, applied: false, n: { p: 0, w: 0 } };

/* ---------- Taten: was man sich merkt ----------
   ton: +1 gut, -1 schlimm, 0 nur Staunen; r: Umkreis der Zeugen; opfR: Umkreis der selbst Betroffenen (ohne ctx);
   tage: wie lange es selbst Erlebte behalten; ger: kommt ins Stadtgespräch */
const TAT = {
  wurf: { ton: -1, r: 40, tage: 7, ger: 1 },
  heben: { ton: -1, r: 30, tage: 4, ger: 1 },
  stoss: { ton: -1, r: 35, tage: 5, ger: 1 },
  welle: { ton: -1, r: 30, opfR: 12, tage: 4, ger: 1 },
  wagen: { ton: -0.5, r: 45, tage: 2, ger: 1 },
  moebel: { ton: -0.3, r: 30, tage: 2 },
  landung: { ton: 0, r: 30, tage: 1 },
  held: { ton: 1, r: 50, tage: 3, ger: 1 },
  runde: { ton: 1, r: 25, opfR: 9, tage: 4, ger: 1 },
  kauf: { ton: 0.3, r: 0, opfR: 3, tage: 3 },
  tip: { ton: 0.6, r: 0, opfR: 3, tage: 5 },
  droh: { ton: -1, r: 30, opfR: 14, tage: 8, ger: 1 },
  lohn: { ton: 0.8, r: 0, opfR: 45, tage: 8, ger: 1 },
  spende: { ton: 1, r: 0, opfR: 45, tage: 6, ger: 1 },
  rede: { ton: 0.5, r: 0, opfR: 45, tage: 3 },
  buh: { ton: -0.2, r: 0, opfR: 45, tage: 3 },
  raeum: { ton: -1, r: 80, opfR: 60, tage: 10, ger: 1 },
  gala: { ton: 0.5, r: 0, tage: 0, ger: 1 },
  stiftung: { ton: 1, r: 0, tage: 0, ger: 1 },
  hilfe: { ton: 1, r: 0, tage: 10 },
  abgewiesen: { ton: -0.4, r: 0, tage: 3 },
};
// Ruf-Schlüssel (rufAdd key oder Grund) → Tat
function tatOf(key, why) {
  switch (key) {
    case 'wurfciv': return 'wurf';
    case 'heben': return 'heben';
    case 'stossciv': return 'stoss';
    case 'welle': return 'welle';
    case 'wagenwurf': return 'wagen';
    case 'moebel': return 'moebel';
    case 'landung': return 'landung';
    case 'besiegt': case 'gefasst': return 'held';
    case 'str:runde': case 'tor:bier': case 'posten:tee': return 'runde';
    case 'str:kauf': return 'kauf';
    case 'str:tip': return 'tip';
    case 'posten:droh': return 'droh';
    case 'demo:lohn': return 'lohn';
    case 'demo:spende': return 'spende';
    case 'demo:rede': return 'rede';
    case 'demo:buh': return 'buh';
    case 'demo:raeumen': return 'raeum';
  }
  const w = String(why || '');
  if (/^(Bombe entschärft|Versteck ausgehoben|Den Roten Kasimir gefasst)/.test(w)) return 'held';
  if (w === 'Gala im Belmont') return 'gala';
  if (/^Stiftung: /.test(w)) return 'stiftung';
  return null;
}

/* ---------- Sätze ----------
   opf: selbst erlebt, nach Haltung (warm = bew/resp/dienst, sonst die Haltung selbst); zeu: gesehen; ger: Stadtgespräch.
   {wann}/{Wann}: vorhin, heute Abend, gestern, neulich; {t}: Titel (Stiftung) */
const L = {
  wurf: {
    opf: {
      furcht: ['Sie … Sie haben mich {wann} durch die Luft geworfen. Bitte nicht noch einmal, Herr Alexander.', 'Mir zittern immer noch die Knie. Ich bin geflogen, Herr Alexander. Geflogen!', 'Bleiben Sie mir vom Leib! Einmal fliegen reicht mir für dieses Leben.'],
      hass: ['Sie haben mich {wann} wie einen Sack Kohlen durch die Luft geworfen. Das vergesse ich Ihnen nicht.', 'Mein Rücken tut immer noch weh. Ihretwegen.', 'Für Sie ein Spaß. Für mich ein Arzt, den mir keiner bezahlt.'],
      warm: ['Ich bin {wann} geflogen, Herr Alexander! Wegen Ihnen! Das glaubt mir zu Hause keiner.'],
    },
    zeu: {
      def: ['Ich hab gesehen, wie Sie {wann} den armen Menschen durch die Luft geworfen haben.', 'Werfen Sie heute noch jemanden, Herr Alexander? Dann geh ich lieber auf die andere Straßenseite.', '{Wann} hat einer von uns einen Flug gemacht, den er sich nicht ausgesucht hat. Ich war dabei.'],
      bew: ['Das {wann} mit dem Werfen … war das ein Kunststück? Der Arme sah nicht so aus, als hätte er gelacht.'],
    },
    ger: ['Man erzählt sich, Sie hätten {wann} einen Bürger durch die Luft geworfen. Stimmt das?', 'Das ganze Viertel redet davon, wie Sie {wann} einen Menschen durch die Luft geschleudert haben.'],
  },
  heben: {
    opf: {
      furcht: ['Sie haben mich {wann} einfach schweben lassen. Ich träume heute Nacht davon.', 'Bitte … meine Füße bleiben diesmal am Boden, ja?'],
      hass: ['Ich bin kein Spielzeug, Herr Alexander.', 'Sie haben mich {wann} hochgehoben wie eine Puppe. Vor allen Leuten.'],
      warm: ['Ich bin {wann} geschwebt! Wegen Ihnen! Das glaubt mir keiner.', 'Können Sie das nochmal machen? Nein, lieber doch nicht. Aber es war unglaublich.'],
    },
    zeu: { def: ['Ich hab gesehen, wie Sie {wann} jemanden schweben ließen. Unheimlich, ehrlich gesagt.', 'Wie der {wann} in der Luft hing und gestrampelt hat … für Sie ein Spiel, was?'] },
    ger: ['Es heißt, Sie lassen Leute einfach schweben, wenn Ihnen danach ist.'],
  },
  stoss: {
    opf: {
      furcht: ['Ihr Licht hat mich {wann} von den Füßen gerissen. Ich hab immer noch blaue Flecken.', 'Bitte nicht wieder dieses Licht, Herr Alexander.'],
      hass: ['Sie haben mich {wann} umgestoßen und sind einfach weiter. Nicht mal eine Entschuldigung.', 'Ein Energiestoß mitten auf der Straße. Und unsereins liegt im Dreck.'],
    },
    zeu: { def: ['Ich hab gesehen, wie Ihr Licht {wann} die Leute umgeworfen hat. Die lagen da wie Kegel.', 'Passen Sie doch auf, wo Sie hinzielen, Herr Alexander. {Wann} hat es Unbeteiligte getroffen.'] },
    ger: ['Man sagt, Sie hätten {wann} mit Ihrem Licht Passanten umgeworfen. Mitten in der Stadt.'],
  },
  welle: {
    opf: {
      furcht: ['Ihre Druckwelle hat mich {wann} glatt umgehauen. Mir klingeln noch die Ohren.', 'Bitte nicht wieder so ein Knall, Herr Alexander. Mein Herz verträgt das nicht.'],
      hass: ['Ihre Druckwelle {wann}: mein Hut ist weg, mein Knie kaputt. Danke auch.', 'Wir sind keine Kegel, Herr Alexander.'],
    },
    zeu: { def: ['Die Druckwelle {wann}! Bei uns sind die Scheiben im Rahmen gesprungen.', 'Ich hab {wann} gesehen, wie alle um Sie herum zu Boden gingen. Was war das bloß?'] },
    ger: ['Man erzählt sich von einem Knall, der {wann} die Leute umgeworfen hat. Das waren doch Sie?'],
  },
  wagen: {
    zeu: { def: ['Ich hab gesehen, wie Sie {wann} einen Wagen durch die Luft geworfen haben. Wem gehörte der eigentlich?', 'Ein ganzes Automobil, {wann}, einfach so. Hoffentlich saß keiner drin.'], bew: ['Ein Automobil, {wann}, durch die Luft! So etwas sieht man nur in Vespera.'] },
    ger: ['Man erzählt sich von einem fliegenden Automobil. Das waren doch Sie?'],
  },
  moebel: { zeu: { def: ['Die Laterne {wann}: bezahlt die die Stadt oder Sie?', 'Ich hab gesehen, was Sie {wann} mit der Bank gemacht haben. Da saß gestern noch meine Mutter drauf.'] } },
  landung: { zeu: { def: ['Ihre Landung {wann}! Das Pflaster hat gebebt.', 'Ich hab Sie {wann} landen sehen. Mir ist die Tasse aus der Hand gefallen.'], skep: ['Ihre Landung {wann} hat ein Loch ins Pflaster gemacht. Wer flickt das? Wir.'] } },
  held: {
    zeu: {
      def: ['Ich hab gesehen, wie Sie {wann} mit den Kerlen fertig geworden sind. Alle Achtung.', 'Das {wann}, mit dem Verbrecher … gut, dass Sie da waren, Herr Alexander.'],
      hass: ['Sie haben {wann} einen von Kasimirs Leuten fertiggemacht. Den Hunger im Viertel machen Sie nicht so leicht fertig.'],
      skep: ['Schön, {wann} haben Sie aufgeräumt. Fragt sich nur, warum die Kerle überhaupt so wütend sind.'],
    },
    ger: ['Man erzählt sich, Sie hätten {wann} einen Verbrecher gestellt. Mit bloßen Händen!', 'Im Viertel sagen sie, ohne Sie wäre das {wann} schlimm ausgegangen.'],
    gerSkep: ['Sie haben {wann} wieder aufgeräumt, heißt es. Für die Zeitung macht sich das gut.'],
  },
  runde: {
    opf: {
      warm: ['Danke nochmal für die Runde {wann}, Herr Alexander! Hat geschmeckt.', 'Die Runde {wann} war nobel. Das erzähl ich weiter.', 'Herr Alexander! Wegen {wann}: Sie sind jederzeit eingeladen. Na ja, Sie zahlen ja eh.'],
      skep: ['Danke für {wann}. Eine Runde ist aber noch kein Lohn.', 'Die Runde {wann} war nett. Morgen haben wir trotzdem wieder Durst.'],
      hass: ['Ich hab {wann} Ihr Bier getrunken. Deshalb mag ich Sie noch lange nicht.'],
    },
    zeu: { def: ['Sie haben {wann} eine Runde ausgegeben, hab ich gesehen. Ich war leider zu spät dran.'] },
    ger: ['Es heißt, Sie geben neuerdings Runden aus. Ist heute auch so ein Abend?'],
  },
  kauf: { opf: { warm: ['Sie schon wieder, Herr Alexander! Das Gleiche wie {wann}?', 'Mein bester Kunde! Na ja, mein reichster.'], skep: ['Wieder da? Das Gleiche wie {wann}, nehme ich an.'] } },
  tip: { opf: { warm: ['Das Trinkgeld {wann} … davon hab ich meiner Tochter Schuhe gekauft. Danke, Herr Alexander.', 'Der großzügige Herr von {wann}! Für Sie immer das Beste vom Rost.'], skep: ['Das Trinkgeld {wann} war anständig. Das muss man Ihnen lassen.'] } },
  droh: {
    opf: {
      hass: ['Sie haben uns {wann} mit Entlassung gedroht. Wir haben es nicht vergessen.', 'Drohen Sie ruhig wieder. Wir stehen trotzdem hier.'],
      furcht: ['Ich hab Familie, Herr Alexander. Wegen {wann} … bitte, ich will nur meine Arbeit behalten.', 'Seit {wann} schlafe ich schlecht. Fliege ich jetzt raus?'],
    },
    zeu: { def: ['Ich hab gehört, wie Sie {wann} den Leuten am Tor gedroht haben. Hart, Herr Alexander.'] },
    ger: ['Man sagt, Sie hätten Streikenden mit Entlassung gedroht.'],
  },
  lohn: {
    opf: {
      warm: ['Sie haben uns {wann} höhere Löhne versprochen. Wir zählen die Tage, Herr Alexander.', 'Ich hab’s zu Hause erzählt, das mit den Löhnen. Enttäuschen Sie uns nicht.'],
      hass: ['Versprochen ist versprochen, Herr Alexander. Wir sind gespannt.', 'Höhere Löhne, haben Sie {wann} gesagt. Ich hab’s mir aufgeschrieben.'],
      skep: ['Höhere Löhne, {wann} am Platz. Schöne Worte. Wann kommen die Zahlen?'],
    },
    ger: ['Am Kneipenplatz haben Sie höhere Löhne versprochen, heißt es. Mal sehen.'],
  },
  spende: {
    opf: {
      warm: ['Ihre Spende für die Streikkasse {wann} … das hätte ich Ihnen nicht zugetraut.', 'Mit Ihrem Geld haben wir {wann} drei Familien satt bekommen. Danke.'],
      hass: ['Spenden, damit wir still sind? Wir haben das Geld trotzdem genommen.'],
      skep: ['Die Spende {wann} war anständig. Ändert nur nichts an den Löhnen.'],
    },
    ger: ['Man erzählt sich, Sie hätten für die Streikkasse gespendet. Ausgerechnet Sie.'],
  },
  rede: { opf: { warm: ['Ihre Rede {wann} am Platz war gar nicht übel.', 'Sie haben {wann} zu uns gesprochen wie zu Menschen. Das merkt man sich.'], hass: ['Ihre Rede {wann}? Schöne Worte. Mehr nicht.'] } },
  buh: { opf: { warm: ['Die Leute haben Sie {wann} ausgebuht. Ich nicht, Herr Alexander.'], def: ['Ihre Rede {wann}? Schöne Worte. Mehr nicht.', 'Wir haben Sie {wann} ausgebuht. Nehmen Sie’s nicht persönlich. Doch, eigentlich schon.'] } },
  raeum: {
    opf: {
      hass: ['Sie haben uns {wann} von der Polizei vom Platz treiben lassen.', 'Mein Kollege sitzt noch in der Zelle. Wegen {wann}.', 'Wir wollten nur reden. Sie haben die Polizei geschickt.'],
      furcht: ['Nach dem, was {wann} am Platz passiert ist, geh ich auf keine Kundgebung mehr.', 'Ich war {wann} nicht dabei, Herr Alexander! Ehrlich nicht!'],
    },
    zeu: { def: ['Die Räumung {wann} am Kneipenplatz … das war hart, Herr Alexander.'] },
    ger: ['Die Räumung am Kneipenplatz. Darüber redet das ganze Viertel.'],
  },
  gala: { ger: ['Wie war die Gala {wann}? Man sagt, der Champagner floss in Strömen.'], gerSkep: ['Die Gala {wann} hat mehr gekostet, als unser ganzes Haus im Jahr verdient, heißt es.'] },
  stiftung: { ger: ['Man liest von Ihrer Stiftung: {t}. Das ist anständig.'], gerSkep: ['{t}. Schön. Sieht gut aus in der Zeitung, nicht wahr?'] },
  hilfe: { opf: { warm: ['Herr Alexander! Was Sie {wann} für mich getan haben, vergesse ich nicht.', 'Da ist ja mein Retter! Na gut, Retter ist übertrieben. Aber danke für {wann}.', 'Ich hab allen erzählt, dass Sie mir {wann} geholfen haben. Manche glauben es nicht.'], skep: ['Sie haben mir {wann} geholfen. Ich weiß noch nicht, was ich davon halten soll. Aber danke.'] } },
  abgewiesen: { opf: { def: ['Sie hatten {wann} keine Zeit für mich. Schon gut. Ein Herr wie Sie hat viel zu tun.', 'Ich hab Sie {wann} um etwas gebeten. Ich frag nicht nochmal.'] } },
};
// Bekannte Gesichter: wie oft er schon mit jemandem geredet hat
const KENNT = {
  heute2: ['Sie schon wieder, Herr Alexander? Zweimal an einem Abend!', 'Ach, Herr Alexander, wir haben uns doch eben erst unterhalten.'],
  oft: ['Langsam glaube ich, Sie kommen meinetwegen in diese Gegend.', 'Herr Alexander! Mein Stammgast unter den reichen Leuten.', 'Wir sollten uns duzen. Nein, Verzeihung, das war ein Scherz.'],
  wieder: ['Herr Alexander! Wir haben uns {wann} unterhalten, wissen Sie noch? {name}.', 'Sie erinnern sich an mich? {name}. Wir haben {wann} geredet.'],
  hass: ['Schon wieder Sie. Ich hab {wann} schon alles gesagt.', 'Sie wieder. Was wollen Sie diesmal?'],
  furcht: ['Sie … erinnern sich an mich? Hab ich {wann} etwas Falsches gesagt?'],
};

const pick = a => a[Math.floor(Math.random() * a.length)];
const today = () => (KT.s ? KT.s.day | 0 : 0);
function wann(m) {
  const dd = today() - (m.d | 0);
  if (dd <= 0) return Date.now() - (m.ts || 0) < 12 * 60 * 1000 ? 'vorhin' : 'heute Abend';
  return dd === 1 ? 'gestern' : 'neulich';
}
function fill(s, m, c) {
  const w = wann(m);
  return s.replace(/\{wann\}/g, w).replace(/\{Wann\}/g, w[0].toUpperCase() + w.slice(1)).replace(/\{t\}/g, m.t || 'die neue Stiftung').replace(/\{name\}/g, c ? c.name : '');
}
const coolAtt = a => a === 'hass' || a === 'skep' || a === 'neid';
// Satzliste je Haltung aus einem Block {furcht, hass, warm, skep, def, bew}
function byAtt(B, att) {
  if (!B) return null;
  const any = () => B.def || B.warm || B.skep || B.furcht || B.hass;
  if (B[att]) return B[att];
  if (att === 'hass') return B.skep || B.def || B.furcht || any();
  if (att === 'neid' || att === 'skep') return B.skep || B.def || B.hass || any();
  if (att === 'furcht') return B.def || B.hass || any();
  return B.warm || B.def || B.furcht || any();   // bew, resp, dienst
}

/* ---------- Merken ---------- */
const isFoe = pd => !!(pd && pd.gg);   // Gegner (wie ruf.js rufFoe)
function memOf(pd) { return pd.mem || (pd.mem = {}); }
// Haltung nach einer selbst erlebten Tat
function attAfter(pd, k) {
  const T = TAT[k], kind = pd.a ? pd.a.kind : pd.kind, tr = pd.cit && pd.cit.trait.k, cur = pd.memAtt || attOf(pd), r = Math.random();
  if (kind === 'kid') return T.ton < 0 ? (k === 'heben' && r < 0.6 ? 'bew' : 'furcht') : 'bew';
  const staff = cur === 'dienst' || kind === 'police' || kind === 'livery' || kind === 'waiter' || kind === 'chauffeur' || kind === 'sailor';
  if (T.ton <= -0.9) {
    if (k === 'heben' && cur === 'bew' && r < 0.35) return 'bew';   // manche finden es wunderbar
    if (staff) return 'furcht';
    const hot = kind === 'worker' || tr === 'mürrisch' || tr === 'ehrgeizig' || cur === 'hass' || cur === 'skep' || k === 'raeum' || k === 'droh';
    return hot && r < 0.65 ? 'hass' : 'furcht';
  }
  if (T.ton >= 0.5) {
    if (staff) return cur;
    if (cur === 'hass') return k === 'hilfe' || r < 0.3 ? 'skep' : 'hass';   // Hass legt sich nicht so leicht
    if (cur === 'furcht') return k === 'hilfe' || r < 0.5 ? 'resp' : 'furcht';
    return kind === 'worker' ? (r < 0.75 ? 'resp' : 'skep') : r < 0.7 ? 'bew' : cur;
  }
  if (k === 'abgewiesen') return cur === 'bew' && r < 0.5 ? 'neid' : cur === 'resp' ? 'skep' : cur;
  if (k === 'buh') return cur === 'bew' || cur === 'resp' ? cur : 'skep';
  return null;
}
function remember(pd, k, own, extra) {
  if (!pd || pd.rag && !own || isFoe(pd)) return;
  const M = memOf(pd), m = { k, d: today(), ts: Date.now(), ...(extra || {}) };
  if (own) {
    // eine schlimme, frische Erinnerung wird nicht von einer Kleinigkeit verdrängt
    const o = M.p; if (o && TAT[o.k].ton <= -0.9 && TAT[k].ton > -0.9 && today() - o.d < 2 && k !== 'hilfe') return;
    M.p = m; const a = attAfter(pd, k); if (a) pd.memAtt = a;
    MEM.n.p++;
  } else {
    if (M.p && M.p.d === m.d && M.p.k === k) return;   // schon selbst betroffen
    M.w = m; MEM.n.w++;
    // Zeugen: manche werden ängstlicher oder kühler, andere freundlicher
    const T = TAT[k], cur = pd.memAtt || attOf(pd), r = Math.random();
    if (cur !== 'dienst') {
      if (T.ton <= -0.9 && r < 0.4) pd.memAtt = cur === 'skep' || cur === 'neid' ? (r < 0.15 ? 'hass' : 'furcht') : cur === 'hass' ? 'hass' : 'furcht';
      else if (T.ton >= 1 && r < 0.3 && cur !== 'hass') pd.memAtt = (pd.a && pd.a.kind === 'worker') ? 'resp' : 'bew';
    }
  }
  if (pd.cit) MEM.dirty = true;
}
// der Nächste (Händler am Stand)
function nearestPed(p, r) {
  let best = null, bd = r * r;
  for (const pd of peds) { const a = pd.a; if (!a || !a.on) continue; const e = a.m.elements, d = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2; if (d < bd && Math.abs(e[13] - p.y) < 2.5) { bd = d; best = pd; } }
  return best;
}
// Zeugen im Umkreis (ein Durchlauf über die sichtbaren Figuren)
function witnesses(k, x, y, z, skip) {
  const T = TAT[k], R = T.r, R2 = R * R, O2 = (T.opfR || 0) ** 2; if (!R && !O2) return 0;
  let n = 0;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.back || skip.has(pd)) continue;
    const e = a.m.elements, dx = Math.abs(e[12] - x); if (dx > R && dx > (T.opfR || 0)) continue;
    const d2 = dx * dx + (e[14] - z) ** 2; if (Math.abs(e[13] - y) > 25) continue;
    if (O2 && d2 < O2) { remember(pd, k, true); n++; }
    else if (d2 < R2 && Math.random() < 0.85) { remember(pd, k, false); n++; }
  }
  return n;
}
function gossip(k, why) {
  const p = player.p, G = MEM.s.g;
  let ort = ''; try { ort = districtAt(p.x, p.z, p.y)[0]; } catch (e) { ort = ''; }
  const t = k === 'stiftung' ? String(why).replace(/^Stiftung: /, '') : undefined;
  const top = G[0];
  if (top && top.k === k && top.d === today()) { top.n = (top.n || 1) + 1; top.ts = Date.now(); if (ort) top.o = ort; return; }
  G.unshift({ k, d: today(), ts: Date.now(), o: ort, t, n: 1 }); if (G.length > 14) G.length = 14;
  MEM.dirty = true;
}
// rufAdd meldet jede Tat (ruf.js RUF.onAdd)
function onTat(key, why) {
  if (!MEM.ready) return;
  const k = tatOf(key, why); if (!k) return;
  const T = TAT[k], p = player.p, skip = new Set();
  // selbst Betroffene, die der Auslöser kennt (Telekinese, Energiestoß)
  const C = MEM.ctx;
  if (k === 'wurf' && C && C.pd) { remember(C.pd, 'wurf', true); skip.add(C.pd); }
  else if (k === 'stoss' && C && C.hits) { for (const h of C.hits) if (h.kind === 'ped' && h.ref) { remember(h.ref, 'stoss', true); skip.add(h.ref); } }
  else if (k === 'heben' && POWERS.tk && POWERS.tk.pd) { remember(POWERS.tk.pd, 'heben', true); skip.add(POWERS.tk.pd); }
  else if (k === 'kauf' || k === 'tip') { const v = nearestPed(p, 3.2); if (v) { remember(v, k, true); skip.add(v); } return; }
  if (T.r || T.opfR) witnesses(k, p.x, p.y, p.z, skip);
  if (T.ger) gossip(k, why);
}
// Anliegen erfüllt oder abgewiesen (aufgaben.js)
function onQuest(q, ok) {
  if (!MEM.ready || q.ci == null || (q.src && q.src !== 'buerger')) return;
  const c = citizens[q.ci]; if (!c || c.nf) return;
  if (ok) remember(c.ped, 'hilfe', true, { t: q.title });
  else remember(c.ped, 'abgewiesen', true);   // abgelehnt, aufgegeben oder einfach weitergegangen
}

/* ---------- Erinnern: was sie sagen ---------- */
function ownLine(pd, c) {
  const M = pd.mem; if (!M || !M.p) return null;
  const B = L[M.p.k]; if (!B || !B.opf) return null;
  const att = pd.memAtt || attOf(pd), S = byAtt(B.opf, att); return S ? fill(pick(S), M.p, c) : null;
}
function seenLine(pd) {
  const M = pd.mem; if (!M || !M.w) return null;
  const B = L[M.w.k]; if (!B || !B.zeu) return null;
  const att = pd.memAtt || attOf(pd), S = (att !== 'bew' && att !== 'resp' && B.zeu[att]) || (att === 'bew' && B.zeu.bew) || B.zeu.def;
  return S ? fill(pick(S), M.w) : null;
}
function gossipLine(pd) {
  const G = MEM.s && MEM.s.g; if (!G || !G.length) return null;
  const g = G.find(x => today() - x.d <= 2 && L[x.k] && L[x.k].ger); if (!g) return null;
  const B = L[g.k], cool = coolAtt(pd.memAtt || attOf(pd)), S = cool && B.gerSkep ? B.gerSkep : B.ger;
  return fill(pick(S), g);
}
// im Vorbeigehen (awe.js aweNear): nur selbst Erlebtes und Gesehenes
export function memNear(pd) {
  if (!MEM.ready || !pd.mem) return null;
  const M = pd.mem;
  if (M.p && today() - M.p.d <= TAT[M.p.k].tage && Math.random() < 0.85) { const s = ownLine(pd, pd.cit); if (s) return s; }
  if (M.w && today() - M.w.d <= 1 && Math.random() < 0.6) return seenLine(pd);
  return null;
}
// beim Ansprechen (ragdoll.js citizenSay über CIT_SAY): Erlebtes, Gesehenes, bekannte Gesichter, Stadtgespräch
function memTalk(c) {
  if (!MEM.ready || c.nf) return null;
  const pd = c.ped, M = memOf(pd), att = pd.memAtt || attOf(pd), now = Date.now();
  const last = M.lt ? { d: M.ld | 0, ts: M.lt } : null, n0 = M.n | 0;
  M.n = n0 + 1; M.ld = today(); M.lt = now; MEM.dirty = true;
  if (M.p && today() - M.p.d <= TAT[M.p.k].tage && Math.random() < 0.75) { const s = ownLine(pd, c); if (s) return s; }
  if (M.w && today() - M.w.d <= 1 && Math.random() < 0.5) { const s = seenLine(pd); if (s) return s; }
  if (last && now - last.ts > 20000) {
    const sameDay = last.d === today(), K = att === 'hass' ? KENNT.hass : att === 'furcht' ? KENNT.furcht : sameDay ? KENNT.heute2 : n0 >= 3 ? KENNT.oft : KENNT.wieder;
    if (Math.random() < (sameDay ? 0.45 : 0.6)) return fill(pick(K), last, c);
  }
  if (Math.random() < 0.3) return gossipLine(pd);
  return null;
}

/* ---------- Speichern (nur benannte Bewohner und das Stadtgespräch) ---------- */
function fresh() { return { v: 1, c: {}, g: [] }; }
function load() {
  let s = null; try { s = JSON.parse(localStorage.getItem(SAVE) || 'null'); } catch (e) { s = null; }
  if (!s || s.v !== 1 || typeof s.c !== 'object' || !Array.isArray(s.g)) return fresh();
  return s;
}
function pack() {
  const out = {};
  citizens.forEach((c, i) => { const M = c.ped.mem; if (!M || (!M.p && !M.w && !M.n)) return; out[i] = { nm: c.name, p: M.p, w: M.w, n: M.n, ld: M.ld, lt: M.lt, at: c.ped.memAtt || null }; });
  MEM.s.c = out;
}
export function memSave() { if (!MEM.s) return; pack(); try { localStorage.setItem(SAVE, JSON.stringify(MEM.s)); } catch (e) { /* privat oder voll */ } MEM.dirty = false; }
function apply() {
  if (MEM.applied || !citizens.length) return;
  MEM.applied = true;
  for (const i in MEM.s.c) {
    const c = citizens[i], r = MEM.s.c[i]; if (!c || !r || c.name !== r.nm || c.nf) continue;
    const M = memOf(c.ped); if (r.p) M.p = r.p; if (r.w) M.w = r.w; M.n = r.n | 0; M.ld = r.ld; M.lt = r.lt;
    if (r.at) c.ped.memAtt = r.at;
  }
  fade();
}
// verblassen: am neuen Tag (und beim Laden)
function fade() {
  const d = today(), drop = pd => {
    const M = pd.mem; if (!M) return;
    if (M.p && d - M.p.d > TAT[M.p.k].tage) { M.p = null; pd.memAtt = null; }
    if (M.w && d - M.w.d > 2) M.w = null;
    if (!M.p && pd.memAtt && !M.w) pd.memAtt = null;
  };
  for (const pd of peds) if (pd && pd.mem) drop(pd);
  for (const c of citizens) if (c.ped.mem) drop(c.ped);
  if (MEM.s) MEM.s.g = MEM.s.g.filter(g => d - g.d <= 3);
  MEM.dirty = true;
}

/* ---------- Ruf-Buch (Ö): Was man sich erzählt ---------- */
const GER_T = { wurf: 'Einen Bürger durch die Luft geworfen', heben: 'Jemanden schweben lassen', stoss: 'Passanten mit dem Energiestoß umgeworfen', welle: 'Druckwelle zwischen Passanten', wagen: 'Ein fliegendes Automobil', held: 'Einen Verbrecher gestellt', runde: 'Eine Runde spendiert', droh: 'Streikenden mit Entlassung gedroht', lohn: 'Höhere Löhne versprochen', spende: 'Für die Streikkasse gespendet', raeum: 'Die Kundgebung räumen lassen', gala: 'Die Gala im Belmont', stiftung: 'Stiftung' };
const WANN_T = m => { const w = wann(m); return w === 'heute Abend' ? 'heute' : w; };
function section() {
  if (!MEM.ready) return '';
  const G = MEM.s.g.slice(0, 6), cnt = { gut: 0, angst: 0, groll: 0, kennt: 0 };
  for (const c of citizens) {
    const pd = c.ped, M = pd.mem; if (!M) continue;
    if (M.n) cnt.kennt++;
    if (M.p) { const t = TAT[M.p.k].ton; if (t >= 0.5) cnt.gut++; else if (t <= -0.9) (pd.memAtt === 'hass' ? cnt.groll++ : cnt.angst++); }
  }
  const rows = G.map(g => `<li><span>${esc(g.k === 'stiftung' ? 'Stiftung: ' + (g.t || '') : GER_T[g.k] || g.k)}${g.n > 1 ? ` <span class="s">×${g.n}</span>` : ''}</span><span class="c">${esc(WANN_T(g))}${g.o ? ' · ' + esc(g.o) : ''}</span></li>`).join('') || '<li class="s">Im Moment redet niemand über Sie.</li>';
  const sum = [cnt.kennt && `${cnt.kennt} Bewohner kennen Sie aus einem Gespräch`, cnt.gut && `${cnt.gut} erinnern sich dankbar an Sie`, cnt.angst && `${cnt.angst} haben seitdem Angst vor Ihnen`, cnt.groll && `${cnt.groll} tragen Ihnen etwas nach`].filter(Boolean);
  return `<section class="wide log"><h3>Was man sich erzählt</h3><p class="s" style="margin:0 0 8px">${sum.length ? esc(sum.join(' · ')) + '.' : 'Noch erinnert sich niemand an etwas Besonderes.'}</p><ul>${rows}</ul></section>`;
}

/* ---------- Start (über das Kontor, nach ruf.js) ---------- */
function init() {
  if (MEM.ready || !GEDAECHTNIS) return;
  MEM.s = load();
  RUF.onAdd.push(onTat);
  // Auslöser merken, damit onTat die Betroffenen kennt
  const letGo = POWERS.onLetGo; POWERS.onLetGo = (H, th) => { MEM.ctx = H && H.kind === 'ped' ? { pd: H.pd } : null; try { if (letGo) letGo(H, th); } finally { MEM.ctx = null; } };
  const hits = BLAST.onHits; BLAST.onHits = (h, k, pw) => { MEM.ctx = { hits: h }; try { if (hits) hits(h, k, pw); } finally { MEM.ctx = null; } };
  AQ.onDone.push(q => onQuest(q, true)); AQ.onDrop.push(q => onQuest(q, false));
  CIT_SAY.unshift(memTalk);
  AWE.memSay = memNear;
  RUF.extra.push(section);
  MEM.ready = true;
  apply();
  window.addEventListener('beforeunload', () => { if (MEM.dirty) memSave(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && MEM.dirty) memSave(); });
  if (window.vespera) window.vespera.gedaechtnis = { MEM, TAT, L, KENNT, onTat, remember, memNear, memTalk, save: memSave, fade, apply: () => { MEM.applied = false; apply(); }, section, tatOf, fill };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!MEM.ready) return;
  if (why === 'reset') { MEM.s = fresh(); for (const pd of peds) if (pd) { pd.mem = null; pd.memAtt = null; } for (const c of citizens) { c.ped.mem = null; c.ped.memAtt = null; } memSave(); return; }
  if (why === 'day') { fade(); return; }
  if (why !== 'frame') return;
  if (!MEM.applied) apply();
  if ((MEM.saveT -= dt) <= 0) { MEM.saveT = 10; if (MEM.dirty) memSave(); }
});
