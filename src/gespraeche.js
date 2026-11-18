/* =====================================================================
   V107 · GESPRÄCHE UNTEREINANDER
   Die Gesprächsrunden auf den Gehwegen und die Begegnungen zweier Passanten
   hatten bisher nur Gesten: einer erzählt, die anderen nicken, manchmal
   lachen alle. Jetzt hört Alexander, worüber sie reden, wenn er nahe genug
   herankommt (bis 12 m): eine kleine Sprechblase über dem Kopf dessen, der
   gerade spricht, Satz für Satz, mit Gesten, Nicken und Lachen an der
   Pointe. Worüber geredet wird, hängt vom Zustand der Stadt ab:
   - ALEXANDER: je nach Haltung der Runde bewundernd, neidisch, skeptisch,
     feindselig oder ängstlich, sein Titel aus dem Ruf-Buch, und was man
     sich gerade über ihn erzählt (Stadtgespräch aus gedaechtnis.js).
     Kommt er zu nah, verstummt die Runde („Pst! Da ist er!“).
   - STREIK und ARBEIT: laufende Streiks und Kundgebungen, Schichtwechsel,
     Löhne und Mieten; im Arbeiterviertel anders als am Boulevard.
   - WETTER: Schneesturm, Nordlicht, Eisgang, Frostnebel, Sternschnuppen,
     sonst die ewige Polarnacht, Nebel und Kälte.
   - ZEITUNG: die Schlagzeile der letzten Ausgabe des Kuriers.
   - STADT: Ballsaal und Jo Lafleur, das Luftschiff, Kasimir und die
     Anarchisten, Preise; dazu ein paar Witze.
   Höchstens zwei Gespräche zugleich, nur in Alexanders Nähe; Prüfung alle
   0,5 s, Sprechblasen als HTML über dem Bild (keine Shader).
   ?gespraeche=aus = Stand V106.
   ===================================================================== */
import { T, camera, MOBILE } from './core.js';
import { peds, CHATS, setAct, turnHead } from './serpentine.js';
import { player } from './player.js';
import { attOf, AWE } from './awe.js';
import { rufGet, rufTitle } from './ruf.js';
import { KT, EVENTS } from './kontor.js';
import { MEM } from './gedaechtnis.js';
import { WL } from './wetterlage.js';
import { ZEITUNG } from './zeitung.js';
import { AT } from './alltag.js';
import { STR } from './strasse.js';
import { DRIVE } from './eating.js';
import { playing, paused } from './input.js';

export const GESPRAECHE = typeof location === 'undefined' || new URLSearchParams(location.search).get('gespraeche') !== 'aus';
export const GS = { ready: false, on: [], tickT: 0, clock: 0, recent: [], n: 0, lines: 0, hush: 0, log: [], extra: [] };   // V113: extra = weitere Themen (plaudern.js)
const pick = a => a[Math.floor(Math.random() * a.length)];
const MAX = MOBILE ? 1 : 2;

/* ---------- Gespräche ----------
   Jede Zeile: 'A: Text' (A/B/C = erster, zweiter, dritter in der Runde); ' *' am Ende = alle lachen danach.
   {titel} = Alexanders Titel, {kurier} = Schlagzeile, {wann} = vorhin/gestern … */
const ALEX = {
  bew: [
    ['A: Hast du ihn vorhin über dem Belmont fliegen sehen?', 'B: Die halbe Stadt stand auf der Straße und hat hinaufgeschaut.', 'A: Ohne ihn gäb’s hier nur Eis und Felsen.'],
    ['A: Meine Tante hat ihm mal die Hand geschüttelt.', 'B: Und?', 'A: Seitdem wäscht sie sie nur noch sonntags. *'],
    ['A: Sag, was du willst: Er hat aus einem Krater eine Stadt gemacht.', 'B: Mit unserem Geld, aber ja. Das muss man ihm lassen.'],
  ],
  bewA: [
    ['A: Ohne Alexander hätten wir keine Arbeit.', 'B: Arbeit schon. Ob’s zum Leben reicht, steht auf einem anderen Blatt.', 'A: Immer noch besser als früher in der Grube.'],
  ],
  neid: [
    ['A: Weißt du, was eine Nacht in seiner Suite kostet?', 'B: Mehr als ich im Jahr verdiene, schätze ich.', 'A: Und er wohnt da. Jeden Tag.', 'B: Manche haben eben alles. *'],
    ['A: Ein Penthouse, eine Villa, ein Luftschiff …', 'B: … und fliegen kann er auch noch.', 'A: Ungerecht ist das. Ich kann nicht mal schwimmen. *'],
  ],
  skep: [
    ['A: Er baut noch einen Turm, hab ich gehört.', 'B: Und wer schleppt die Träger? Wir.', 'A: Und wer zieht oben ein? Er.'],
    ['A: Der Kurier nennt ihn jetzt „{titel}“.', 'B: Der Kurier gehört ihm doch halb.', 'A: Eben drum. *'],
    ['A: Er spaziert neuerdings durch die Viertel.', 'B: Will sehen, ob sein Eigentum noch steht. *'],
  ],
  hass: [
    ['A: Der fliegt über unsere Köpfe, und wir zahlen Miete für Löcher.', 'B: Leise. Man weiß nie, wer zuhört.', 'A: Soll er doch zuhören.'],
    ['A: Eines Tages gehört die Stadt allen, die sie gebaut haben.', 'B: Sag das nicht zu laut. Brenners Leute sind überall.'],
  ],
  furcht: [
    ['A: Hast du gesehen, wie er den Wagen hochgehoben hat? Ohne Hände!', 'B: Ich will gar nicht wissen, was er mit Menschen machen kann.', 'A: Pst. Nicht so laut.'],
    ['A: Man sagt, er schläft nie. Er steht nur oben im Turm und schaut herunter.', 'B: Hör auf, mir wird ganz anders.'],
  ],
};
// Stadtgespräch (gedaechtnis.js): Auftakt und Antwort je nach Haltung der Runde
const GOSSIP = {
  wurf: ['Hast du gehört? Alexander hat {wann} einen Mann durch die Luft geworfen.', 'Bestimmt hatte der es verdient.', 'Und keiner sagt was. Natürlich nicht.'],
  heben: ['Er hat {wann} jemanden einfach schweben lassen. Mitten auf der Straße.', 'Das muss ein Anblick gewesen sein!', 'Wie eine Puppe. Ich sag’s dir, das ist nicht normal.'],
  stoss: ['Sein Licht hat {wann} Passanten von den Füßen gerissen.', 'Die standen ihm sicher im Weg.', 'Heute die, morgen wir.'],
  welle: ['Drüben hat’s {wann} geknallt, und alle lagen am Boden. Das war er.', 'Was für eine Kraft …', 'Und die Scheiben bezahlt wieder keiner.'],
  wagen: ['Ein ganzes Automobil ist {wann} durch die Luft geflogen.', 'Ich hätte zu gern zugesehen!', 'Hoffentlich war’s seins.'],
  held: ['Er hat {wann} einen von Kasimirs Leuten gestellt.', 'Gut so. Endlich Ruhe.', 'Für die Zeitung macht sich so was immer gut.'],
  runde: ['Alexander hat {wann} eine Runde ausgegeben!', 'Ein feiner Zug.', 'Eine Runde. Und morgen wieder die alten Löhne.'],
  droh: ['Er hat den Streikposten {wann} mit Entlassung gedroht.', 'Na ja, Ordnung muss sein.', 'Das vergessen sie ihm nicht.'],
  lohn: ['Er hat am Kneipenplatz höhere Löhne versprochen.', 'Endlich!', 'Versprochen hat er schon viel.'],
  spende: ['Er hat für die Streikkasse gespendet, stell dir vor.', 'Er hat eben doch ein Herz.', 'Damit sie still sind. So einfach ist das.'],
  raeum: ['Die Polizei hat {wann} den Platz geräumt. Auf seinen Befehl.', 'Die haben übertrieben, die Streikenden.', 'Das ist der wahre Alexander.'],
  gala: ['Die Gala im Belmont {wann}! Champagner bis zum Morgen.', 'Ich hätte so gern das Kleid von Jo Lafleur gesehen.', 'Und wir stehen draußen in der Kälte.'],
  stiftung: ['Er hat eine Stiftung gegründet: {t}.', 'Das ist anständig von ihm.', 'Fürs Gewissen. Und für den Kurier.'],
  schneeball: ['Jemand hat Alexander {wann} mit einem Schneeball beworfen!', 'Unerhört!', 'Treffer, versenkt. *'],
  hilfe: null, gabe: null,
};
const STREIK = {
  a: [
    ['A: Morgen früh stehen wir wieder am Tor.', 'B: Und wenn er die Polizei schickt?', 'A: Dann stehen wir eben vor der Polizei.'],
    ['A: Die Gießerei streikt immer noch.', 'B: Recht haben sie. Zwölf Stunden am Ofen.', 'C: Und dann reicht’s nicht mal für Kohlen.'],
    ['A: Gehst du heute zur Kundgebung?', 'B: Meine Frau sagt, ich soll nicht.', 'A: Deine Frau steht in der ersten Reihe. *'],
  ],
  b: [
    ['A: Schon wieder Streik. Die Straßenbahn fährt nur halb.', 'B: Bei den Löhnen kann man es ihnen kaum verdenken.', 'A: Ich schon. Ich musste laufen. *'],
    ['A: Im Arbeiterviertel brodelt es, sagt mein Mann.', 'B: Hoffentlich bleibt es dort.'],
  ],
};
const ARBEIT = {
  a: [
    ['A: Noch eine Stunde bis zur Schicht.', 'B: Dann trink aus. Der Vorarbeiter zählt jede Minute.'],
    ['A: Die Miete ist wieder gestiegen.', 'B: Und der Lohn?', 'A: Der Lohn steht stramm wie ein Wachmann. Bewegt sich nicht. *'],
    ['A: Mein Rücken bringt mich noch um.', 'B: Dein Rücken? Mein Kreuz ist schon seit Jahren tot.', 'A: Dann sind wir zwei Gespenster. *'],
    ['A: Hast du gehört, im Hafen suchen sie Leute?', 'B: Bei der Kälte? Da frieren dir die Finger an den Tauen fest.'],
  ],
  b: [
    ['A: Die Geschäfte laufen gut dieses Jahr.', 'B: Für dich vielleicht. Mein Laden ist leer wie eine Kirche am Montag.'],
    ['A: Hast du die neuen Hüte im Schaufenster gesehen?', 'B: Zu dem Preis trage ich lieber meinen alten.'],
    ['A: An der Börse ging’s heute rauf und runter.', 'B: Wie immer. Nur mein Geld geht nur runter. *'],
  ],
};
const WETTER = {
  sturm: [['A: Hörst du den Wind? Der Sturm kommt über die Berge.', 'B: Dann nichts wie heim. Ich hab keine Lust, im Schnee zu schlafen.']],
  nordlicht: [['A: Schau nur hinauf! So hell war es seit Jahren nicht.', 'B: Meine Großmutter sagte, wenn das Nordlicht tanzt, wird jemand reich.', 'A: Dann weiß ich ja, wer. *']],
  eisgang: [['A: Das Eis bricht im Hafen. Man hört es bis hierher krachen.', 'B: Mein Schwager fährt Wassertaxi. Der kommt heute nicht heim.']],
  frostnebel: [['A: Ich seh meine eigene Hand nicht in diesem Nebel.', 'B: Gut so. Dann siehst du auch nicht, wie ich aussehe. *']],
  meteore: [['A: Hast du eine Sternschnuppe gesehen?', 'B: Drei. Ich hab mir jedes Mal dasselbe gewünscht.', 'A: Eine Lohnerhöhung?', 'B: Woher weißt du das? *']],
  sonst: [
    ['A: Kalt heute.', 'B: Es ist immer kalt. Wir wohnen am Nordpol.', 'A: Ich mein ja nur. *'],
    ['A: Manchmal vergesse ich, dass es irgendwo einen Tag gibt.', 'B: Hier nicht. Nur Laternen und Polarlicht.', 'A: Und den Belmont. Der leuchtet für zwei.'],
    ['A: Der Nebel ist heute ganz türkis.', 'B: Das ist das Licht vom Hafen. Oder der Krater atmet. Sagt man jedenfalls.'],
    ['A: Mein Cousin schreibt, draußen hinter den Bergen scheint jetzt die Sonne.', 'B: Die Sonne? Was soll das sein? *'],
  ],
};
const KURIER = [
  ['A: Hast du den Kurier gelesen? „{kurier}“', 'B: Ich lese nur noch den Sportteil.', 'A: Der Kurier hat gar keinen Sportteil.', 'B: Eben. *'],
  ['A: Steht heute im Kurier: „{kurier}“', 'B: Und das glaubst du?', 'A: Ich glaube alles, was gedruckt ist. Das ist bequemer.'],
  ['A: „{kurier}“ … so steht’s auf der ersten Seite.', 'B: Margot Wendt hat das geschrieben, wetten? Die traut sich was.'],
];
const STADT = {
  a: [
    ['A: Man sagt, Kasimirs Leute hängen wieder Flugblätter in der Bahnstation auf.', 'B: Lass dich bloß nicht mit denen ein.', 'A: Ich sag ja nur, was man sagt.'],
    ['A: Im Brass Lantern spielt heute wieder der Alte am Klavier.', 'B: Dann bin ich da. Der spielt besser, als er aussieht. *'],
    ['A: Das Luftschiff ist wieder über uns weggezogen.', 'B: Die Aurora Imperial. Allein der Name. Da passen fünf von unseren Häusern rein.'],
  ],
  b: [
    ['A: Heute Abend singt Jo Lafleur im Ballsaal des Belmont.', 'B: Diese Stimme! Ich hab einmal an der Tür zugehört.', 'A: An der Tür ist immer noch der beste Platz für unsereins. *'],
    ['A: Viktor von Hallstein soll Alexander wieder ein Geschäft weggeschnappt haben.', 'B: Die zwei sind wie Hund und Katze.', 'A: Nur dass beide Krallen aus Gold haben.'],
    ['A: Das Brot kostet wieder zwei Funken mehr.', 'B: Dafür kostet die Aussicht nichts. *'],
    ['A: Hast du das Luftschiff gesehen? Mit Kronleuchtern drin!', 'B: Kronleuchter in der Luft. Was kommt als Nächstes? Ein Ballsaal auf dem Mond?'],
  ],
};
const WITZ = [
  ['A: Warum gehen in Vespera die Uhren nie falsch?', 'B: Warum?', 'A: Weil die Sonne nie aufgeht. Merkt doch keiner. *'],
  ['A: Mein Hund hat heute das Nordlicht angebellt.', 'B: Und?', 'A: Es hat nicht zurückgebellt. Er ist schwer gekränkt. *'],
  ['A: Was ist der Unterschied zwischen einem Eisbären und meinem Vermieter?', 'B: Sag.', 'A: Der Eisbär lässt dich manchmal in Ruhe. *'],
  ['A: Ich hab mir einen Hut wie Alexander gekauft.', 'B: Und? Kannst du jetzt fliegen?', 'A: Nein. Aber der Wind hat ihn mir weggeweht. Der Hut kann fliegen. *'],
];

/* ---------- Thema wählen ---------- */
function stanceOf(m) {
  const c = {}; for (const pd of m) { const a = attOf(pd); c[a] = (c[a] || 0) + 1; }
  let best = 'bew', bn = 0; for (const k in c) if (k !== 'dienst' && c[k] > bn) { bn = c[k]; best = k; }
  return best === 'resp' ? 'bew' : best;
}
const strike = () => (AT && AT.struck && AT.struck.size > 0) || (STR && STR.level >= 1) || (KT.s && KT.s.ev && KT.s.ev.some(e => EVENTS[e.i] && EVENTS[e.i].streik));
function wann(g) { const d = (KT.s ? KT.s.day | 0 : 0) - (g.d | 0); return d <= 0 ? (Date.now() - (g.ts || 0) < 12 * 60000 ? 'vorhin' : 'heute') : d === 1 ? 'gestern' : 'neulich'; }
function fill(lines, o) { return lines.map(s => s.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m)); }
function topics(m, reg, st) {
  const T = [];
  const add = (w, id, lines, o = {}) => { if (lines && !GS.recent.includes(id)) T.push({ w, id, lines: fill(lines, o) }); };
  const titel = (() => { try { return rufTitle(); } catch (e) { return 'Herr von Vespera'; } })();
  // Alexander
  const AL = st === 'bew' && reg === 'a' ? ALEX.bewA.concat(ALEX.bew) : ALEX[st] || ALEX.bew;
  AL.forEach((L, i) => add(3 / AL.length, 'al:' + st + i, L, { titel }));
  // Stadtgespräch
  const G = MEM && MEM.s && MEM.s.g ? MEM.s.g.filter(g => GOSSIP[g.k] && (KT.s ? KT.s.day - g.d : 0) <= 2).slice(0, 3) : [];
  for (const g of G) { const Q = GOSSIP[g.k], warm = st === 'bew'; add(3.5 / G.length, 'gs:' + g.k + g.d, ['A: ' + Q[0], 'B: ' + (warm ? Q[1] : Q[2])], { wann: wann(g), t: g.t || 'eine Stiftung' }); }
  // Streik und Arbeit
  if (strike()) STREIK[reg].forEach((L, i) => add((reg === 'a' ? 4 : 2) / STREIK[reg].length, 'sk:' + reg + i, L));
  ARBEIT[reg].forEach((L, i) => add(2 / ARBEIT[reg].length, 'ar:' + reg + i, L));
  // Wetter
  const ev = WL && WL.ev; if (ev && WETTER[ev]) WETTER[ev].forEach((L, i) => add(4, 'wl:' + ev + i, L));
  WETTER.sonst.forEach((L, i) => add(1.2 / WETTER.sonst.length, 'wt:' + i, L));
  // Zeitung
  const Z = ZEITUNG && ZEITUNG.archive && ZEITUNG.archive[ZEITUNG.archive.length - 1], kt = Z && Z.lead && Z.lead.titel;
  if (kt) KURIER.forEach((L, i) => add(1.6 / KURIER.length, 'zt:' + (Z.nr || 0) + i, L, { kurier: kt }));
  // Stadt und Witze
  const S = STADT[reg].filter(L => !/Kasimir/.test(L[0]) || rufGet('unter') > 40);
  S.forEach((L, i) => add(1.8 / S.length, 'st:' + reg + i, L));
  WITZ.forEach((L, i) => add(1 / WITZ.length, 'wz:' + i, L));
  for (const f of GS.extra) try { f(add, m, reg, st); } catch (e) { console.warn('Gespräch:', e); }   // V113: Themen aus der Lage (plaudern.js)
  let sum = 0; for (const t of T) sum += t.w; let r = Math.random() * sum;
  for (const t of T) if ((r -= t.w) <= 0) return t;
  return T[0] || null;
}

/* ---------- Sprechblasen ---------- */
const V = new T.Vector3();
function bubble() {
  const el = document.createElement('div');
  el.className = 'gsBub';
  el.style.cssText = 'position:fixed;z-index:9;left:0;top:0;max-width:240px;padding:5px 10px;border-radius:9px;background:rgba(5,16,24,.78);border:1px solid rgba(127,227,214,.35);color:#e9f3ef;font:13px/1.35 var(--body,Georgia,serif);font-style:italic;pointer-events:none;opacity:0;transition:opacity .25s;transform:translate(-50%,-100%);white-space:normal;text-align:center';
  document.body.append(el); return el;
}
function place(G) {
  const el = G.el, pd = G.spk; if (!el || !pd || !pd.a) return;
  const e = pd.a.m.elements; V.set(e[12], e[13] + 2.05 * (pd.sc || 1), e[14]);
  const d = Math.hypot(e[12] - camera.position.x, e[14] - camera.position.z);
  V.project(camera);
  if (V.z > 1 || Math.abs(V.x) > 1.1 || Math.abs(V.y) > 1.1 || d > 22 || !G.txt) { el.style.opacity = 0; return; }
  el.style.left = ((V.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; el.style.top = ((1 - V.y) / 2 * innerHeight).toFixed(0) + 'px';
  el.style.opacity = Math.max(0.25, Math.min(1, 1.4 - d / 16)).toFixed(2);
}

/* ---------- Ablauf ---------- */
function members(G) { return G.c ? G.c.m : [G.A, G.A.mp]; }
function lineStep(G) {
  const L = G.lines[G.i]; if (!L) return false;
  const who = 'ABC'.indexOf(L[0]), m = members(G), spk = m[Math.max(0, who) % m.length], laugh = / \*$/.test(L), txt = L.slice(3).replace(/ \*$/, '');
  G.spk = spk; G.txt = txt; G.el.textContent = txt; G.laugh = laugh;
  G.t = 1.9 + txt.length * 0.055; G.i++;
  GS.lines++; GS.log.unshift(txt); if (GS.log.length > 12) GS.log.length = 12;
  if (G.c) {   // Runde: Sprecher erzählt, die anderen hören zu und schauen zu ihm
    const base = G.c.sit ? 7 : 0, f = spk.a && spk.a.m.elements;
    m.forEach(pd => { if (!pd.a || pd.aw || pd.eat) return; if (pd === spk) setAct(pd, base + 0.9); else { const r = Math.random(); setAct(pd, G.c.sit ? (r < 0.4 ? 11.4 : 7.2) : r < 0.55 ? 1.6 : r < 0.75 ? 5.6 : 0.3); if (f && pd.a.on) turnHead(pd.a, f[12], f[14]); } });
  }
  return true;
}
function laughAll(G) {
  if (!G.c) return;
  G.c.m.forEach((pd, i) => { if (pd.a && !pd.aw && !pd.eat) setAct(pd, G.c.sit ? 7.3 : 2.6 + i * 0.05); });
}
function end(G, hush) {
  if (G.el) { G.el.style.opacity = 0; const el = G.el; setTimeout(() => el.remove(), 400); }
  if (G.c) { G.c.t = hush ? 0.3 : 1.5; G.c.gsT = GS.clock + 60 + Math.random() * 60; }
  else if (G.A) { G.A.gsT = GS.clock + 120; if (G.A.mp) G.A.mp.gsT = GS.clock + 120; }
  GS.on.splice(GS.on.indexOf(G), 1);
}
function step(G, dt) {
  const p = player.p, m = members(G);
  if (G.c) G.c.t = 99;   // pedSocial (serpentine.js) wartet, solange das Gespräch läuft
  else if (G.A.st !== 7 || !G.A.lead) { end(G); return; }
  else G.A.md = Math.max(G.A.md, G.A.mt + 3);   // Begegnung: so lange stehen bleiben, bis das Gespräch fertig ist
  if (!m.every(pd => pd && pd.a && pd.a.on && !pd.rag)) { end(G); return; }
  const f = G.spk && G.spk.a.m.elements;
  const d2 = f ? (f[12] - p.x) ** 2 + (f[14] - p.z) ** 2 : 0;
  if (d2 > 26 * 26) { end(G); return; }
  // zu nah beim Thema Alexander: Pst!
  if (G.al && d2 < 3.6 * 3.6 && !G.hushed) {
    G.hushed = true; G.lines = [pick(['B: Pst! Da ist er!', 'B: Psst … dreh dich nicht um.', 'B: Guten Abend, Herr Alexander! Wir haben gerade … vom Wetter gesprochen.']) ]; G.i = 0; G.t = 0; GS.hush++;
    for (const pd of m) if (pd.a && pd.a.on) turnHead(pd.a, p.x, p.z);
  }
  if ((G.t -= dt) <= 0) {
    if (G.laugh && !G.lt) { G.lt = true; G.t = 1.8; laughAll(G); G.txt = ''; return; }
    G.lt = false;
    if (!lineStep(G)) { end(G, G.hushed); return; }
  }
}
function start(c, A) {
  const m = c ? c.m : [A, A.mp], reg = m.some(pd => pd.a && pd.a.kind === 'worker') ? 'a' : 'b', st = stanceOf(m);
  const tp = topics(m, reg, st); if (!tp) return null;
  GS.recent.unshift(tp.id); if (GS.recent.length > 10) GS.recent.length = 10;
  const G = { c, A, lines: tp.lines, i: 0, t: 0, el: bubble(), al: /^(al|gs):/.test(tp.id), id: tp.id };
  if (c) c.t = 99;
  GS.on.push(G); GS.n++;
  return G;
}
function scan() {
  if (GS.on.length >= MAX || player.fly || DRIVE.on) return;
  const p = player.p; let best = null, bd = 12 * 12, meet = null;
  for (const c of CHATS) {
    if (c.share || c.m.length < 2 || (c.gsT || 0) > GS.clock || GS.on.some(G => G.c === c)) continue;
    const d2 = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (d2 > bd || d2 < 2.5 * 2.5) continue;
    if (!c.m.every(pd => pd.a && pd.a.on && !pd.aw && Math.abs(pd.a.m.elements[13] - p.y) < 3)) continue;
    bd = d2; best = c;
  }
  if (!best) for (const pd of peds) {   // Begegnungen auf dem Gehweg
    if (pd.st !== 7 || !pd.lead || !pd.mp || (pd.gsT || 0) > GS.clock || !pd.a || !pd.a.on || pd.mt > 3) continue;
    const d2 = (pd.mx - p.x) ** 2 + (pd.mz - p.z) ** 2; if (d2 > 10 * 10 || d2 < 4) continue;
    if (GS.on.some(G => G.A === pd)) continue;
    meet = pd; break;
  }
  if (best) start(best, null);
  else if (meet) start(null, meet);
}
function init() {
  if (GS.ready || !GESPRAECHE) return;
  GS.ready = true;
  if (window.vespera) window.vespera.gespraeche = { GS, scan, start, topics, stanceOf, ALEX, GOSSIP, STREIK, ARBEIT, WETTER, KURIER, STADT, WITZ };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!GS.ready || why !== 'frame') return;
  GS.clock += dt;
  const run = playing && !paused;
  for (let i = GS.on.length - 1; i >= 0; i--) { const G = GS.on[i]; if (run) step(G, dt); if (GS.on.includes(G)) place(G); }
  if ((GS.tickT -= dt) > 0) return;
  GS.tickT = 0.5;
  if (run) scan();
});
// V113: Vorlagen für plaudern.js (mehr Gespräche)
export { ALEX, GOSSIP, STREIK, ARBEIT, WETTER, KURIER, STADT, WITZ, topics, stanceOf };
