/* =====================================================================
   V61 · DER VESPERA-KURIER (die Zeitung der Stadt)
   Die Zeitung berichtet über Alexanders Taten, gefasste Räuber, entschärfte
   Bomben und das Leben in der Stadt. Sie erscheint regelmäßig als
   Abendausgabe; nach einer großen Tat druckt sie ein Extrablatt. Die
   Zeitungsjungen (life.js) rufen die Schlagzeilen der neuesten Ausgabe aus,
   die Stimmen (voice.js) sprechen sie mit. Beim Zeitungsjungen: E = Zeitung
   nehmen; überall: Taste U = Zeitung lesen (Pfeile blättern in älteren
   Ausgaben, U oder Esc schließt).

   Woher die Meldungen kommen (ohne Eingriff in die anderen Dateien, nur
   durch Beobachten ihres Zustands viermal pro Sekunde):
   - gegner.js: Überfall, Taschendieb, Bombe, Angriff der Anarchisten, mit
     Ort, Festnahmen, Entkommenen, Entschärfung oder Knall.
   - powers.js / kraefte.js / energy.js: Automobil oder Passant mit
     Telekinese gehoben, etwas ausgerissen, Heldenlandung, Flug über der
     Stadt, Schockwelle, Levitation, Energieschub.
   - gala.js (Ereignis 'vespera-gala'): nach der Gala ein Extrablatt mit
     der gewählten Rede und dem Foto vom Goldenen Stern oder Feuerwerk.
   - atmosphere.js: Wetter und Mondphase; dazu Stadtnachrichten, Klatsch
     und Anzeigen.
   V66 Kanon: Der Kurier ist kein Hofblatt. Alexander ist ein reicher
   Kapitalist, kein strahlender Held: neben Bewunderung stehen kritische
   Stimmen (Zeugen, Leserbriefe, Kommentare, Arbeiter mit echten Sorgen).
   Zur Tat gehört ein Foto: ein kleines Graustufenbild aus dem Spielbild
   (einmal pro Meldung, kein Shader, kein Licht).

   SCHNITTSTELLE für andere Systeme (Wirtschaft, Gala, Aufgaben ...):
     import { zeitungMeldung, zeitungKasten } from './zeitung.js';
     zeitungMeldung({ titel, text, rubrik, prio, ort, ruf, extra, foto });
       titel  Schlagzeile (Pflicht)          text  Artikel (ein paar Sätze)
       rubrik 'Alexander' | 'Polizei' | 'Stadt' | 'Wirtschaft' | 'Gesellschaft' | ...
       prio   1 (Randnotiz) … 10 (Titelseite); ab 8 gibt es ein Extrablatt
       ort    Ortsname (sonst der Stadtteil, in dem Alexander gerade ist)
       ruf    was die Zeitungsjungen rufen (sonst aus der Schlagzeile)
       extra  true = sofort ein Extrablatt   foto  true = Foto vom Spielbild
     zeitungKasten(id, titel, zeilen)   Kasten am Rand jeder neuen Ausgabe
       (z. B. Börsenkurse): zeilen = ['Text', ...] oder [['Name', 'Wert'], ...];
       zeilen = null entfernt den Kasten.
   Ohne Import geht es auch über Ereignisse:
     window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, ... } }))
     window.dispatchEvent(new CustomEvent('vespera-news-box', { detail: { id, titel, zeilen } }))
   und in der Konsole über window.vespera.zeitung (open, close, meldung,
   kasten, drucken, extrablatt, Z).
   ===================================================================== */
import { $, renderer, shared } from './core.js';
import { player } from './player.js';
import { playing, paused, isTouch, tryLock } from './input.js';
import { toast, districtAt } from './boat.js';
import { LIFE, HEAD, HEAD_HIM } from './life.js';
import { INTERACT } from './music.js';
import { DINE } from './venues.js';
import { GEGNER } from './gegner.js';
import { POWERS } from './powers.js';
import { KRAEFTE } from './kraefte.js';
import { BLAST } from './energy.js';
import { ATMO, moonName } from './atmosphere.js';
import { IMP } from './imperial.js';

export const ZEITUNG = {
  nr: 1, archive: [], pending: [], boxes: new Map(), open: false, view: 0, el: null, btn: null,
  t: 0, nextEd: 25, extraT: -1, lastExtra: -999, started: false,
  // Fall aus gegner.js, der gerade läuft oder nachbereitet wird
  fall: null, gStats: null,
  // Taten seit der letzten Ausgabe (je Art höchstens eine Meldung) und Bilanz des Abends
  done: new Set(), bilanz: { flugM: 0, wagen: 0, leute: 0, ausgerissen: 0, landungen: 0, wellen: 0, stoesse: 0, gefasst: 0, bomben: 0 },
  watch: { tk: null, hero: null, cd: 0, lev: false, shield: false, shots: 0, fly: false, flyHigh: false, lastP: null, imp: null },
};
const ZT_KEY = 'vespera.zeitung', ZT_PERIOD = 360, ZT_ARCH = 12;
const ztPick = a => a[Math.floor(Math.random() * a.length)];
const ztEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ztCap = s => s.charAt(0).toUpperCase() + s.slice(1);
const ztFill = (s, o) => s.replace(/\{(\w+)\}/g, (m, k) => o[k] ?? m);
function ztOrt(x, z, y) {
  if (x === undefined) { x = player.p.x; z = player.p.z; y = player.p.y; }
  try { return districtAt(x, z, y ?? 0)[0]; } catch (e) { return 'Vespera'; }
}

/* ---------- Gespeicherte Ausgaben (nur Text, ohne Fotos) ---------- */
try {
  const s = JSON.parse(localStorage.getItem(ZT_KEY) || 'null');
  if (s && Array.isArray(s.archive)) { ZEITUNG.nr = s.nr | 0 || 1; ZEITUNG.archive = s.archive.slice(-ZT_ARCH); }
} catch (e) { /* privat oder kaputt: frisch anfangen */ }
function ztSave() {
  try { localStorage.setItem(ZT_KEY, JSON.stringify({ nr: ZEITUNG.nr, archive: ZEITUNG.archive.slice(-ZT_ARCH).map(e => ({ ...e, lead: { ...e.lead, foto: null }, items: e.items.map(i => ({ ...i, foto: null })) })) })); } catch (e) { /* voll oder privat */ }
}

/* ---------- Schnittstelle ---------- */
export function zeitungMeldung(m) {
  if (!m || !m.titel) return null;
  const it = {
    titel: String(m.titel), text: String(m.text || ''), rubrik: m.rubrik || 'Stadt', prio: Math.max(1, Math.min(10, +m.prio || 5)),
    ort: m.ort || (m.x !== undefined ? ztOrt(m.x, m.z, m.y) : ''), ruf: m.ruf || null, foto: null, zeit: Date.now(), quelle: m.quelle || 'extern',
  };
  ZEITUNG.pending.push(it);
  if (m.foto) ztSnap(it);
  if (m.extra || it.prio >= 8) ztExtraSoon(m.extra ? 3 : 8);
  return it;
}
export function zeitungKasten(id, titel, zeilen) {
  if (!id) return;
  if (!zeilen) ZEITUNG.boxes.delete(id); else ZEITUNG.boxes.set(id, { titel: titel || id, zeilen: zeilen.slice(0, 14) });
}
if (typeof window !== 'undefined') {
  window.addEventListener('vespera-news', e => { try { zeitungMeldung(e.detail); } catch (er) { console.warn('Zeitung:', er); } });
  window.addEventListener('vespera-news-box', e => { const d = e.detail || {}; zeitungKasten(d.id, d.titel, d.zeilen); });
}
function ztExtraSoon(s) { if (ZEITUNG.extraT < 0 || ZEITUNG.extraT > s) ZEITUNG.extraT = s; }

/* ---------- Foto aus dem Spielbild ----------
   Im nächsten Bild nach dem Zeichnen (der Aufruf kommt nicht aus der Bildschleife, also läuft dieser
   Rückruf nach ihr), verkleinert auf 480 px und in Graustufen: ein kurzes Auslesen, nur bei einer Meldung. */
function ztSnap(it) {
  if (typeof requestAnimationFrame === 'undefined' || !renderer || !renderer.domElement) return;
  requestAnimationFrame(() => {
    try {
      const c = renderer.domElement; if (!c.width || !c.height) return;
      const w = 480, h = Math.round(w * c.height / c.width), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.filter = 'grayscale(1) brightness(1.7) contrast(1.3)'; g.drawImage(c, 0, 0, w, h);
      // ganz schwarz (Bild schon geleert, Software-Renderer): kein Foto
      const d = g.getImageData(0, 0, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4 * 97) s += d[i];
      if (s / (d.length / (4 * 97)) < 6) return;
      it.foto = cv.toDataURL('image/jpeg', 0.62);
    } catch (e) { /* kein Zugriff aufs Bild: dann ohne Foto */ }
  });
}

/* ---------- Texte ---------- */
const ZT_ZEUGE = ['eine Dame im Pelzmantel', 'ein Kellner', 'ein Straßenbahnschaffner', 'ein Zeitungsjunge', 'ein Hafenarbeiter', 'eine Garderobiere', 'ein älterer Herr mit Monokel', 'ein Taxifahrer', 'eine Verkäuferin', 'ein Schuhputzer'];
const ZT_STAUNEN = ['„Mit einer Hand!“', '„So etwas habe ich noch nie gesehen!“', '„Ich dachte, ich träume“', '„Einfach so, als wäre es nichts“', '„Da bleibt einem die Luft weg!“', '„Der Herr von Vespera, leibhaftig!“'];
// V66: nicht jeder Zeuge staunt; manche ärgern sich, fürchten sich oder fragen nach
const ZT_ZWEIFEL = ['„Schön und gut, aber wer bezahlt den Schaden?“', '„Mir ist das unheimlich. Ein Mann, dem niemand etwas kann“', '„Die Polizei kann das auch, nur langsamer“', '„Er tut so etwas, weil er es kann. Fragen muss er keinen“', '„Beeindruckend. Ein Lohn, von dem man leben kann, wäre beeindruckender“'];
// "im Arbeiterviertel", "auf dem Belmont-Platz", "an der Hafenpromenade" ...
export function ztIn(ort) {
  const o = String(ort || 'Vespera');
  if (/^Penthouse|Penthouse-Suite$/.test(o)) return 'in der Penthouse-Suite';
  if (/^Dachterrasse/.test(o)) return 'auf der Dachterrasse des Belmont';
  if (/Lobby/.test(o)) return 'in der Lobby des Belmont';
  if (/^Turm des/.test(o)) return 'am Turm des Belmont';
  if (/^Der große Viadukt/.test(o)) return 'auf dem großen Viadukt';
  if (/^Der große /.test(o)) return 'im großen ' + o.slice(10);
  if (/^Der /.test(o)) return 'im ' + o.slice(4);
  if (/^Die Berge/.test(o)) return 'in den Bergen';
  if (/Platz$/.test(o)) return 'auf dem ' + o;
  if (/(Promenade|villa|Bank|Bar)$/.test(o)) return 'an der ' + o;
  if (/^Vespera$/.test(o)) return 'in Vespera';
  return 'im ' + o;
}
const ztZeuge = () => (Math.random() < 0.3 ? ztPick(ZT_ZWEIFEL) : ztPick(ZT_STAUNEN)) + ', sagt ' + ztPick(ZT_ZEUGE) + '.';
const ZT_FALL = {
  raub: {
    gefasst: { prio: 8, rubrik: 'Polizei', t: ['Alexander stellt Räuber {in}', 'Überfall {in} vereitelt!', 'Räuber trifft auf den Herrn von Vespera'],
      x: ['Ein bewaffneter Räuber bedrohte {in} einen Passanten. Herr Alexander griff ein, die Kugeln des Täters prallten wirkungslos ab. Die Polizei nahm den Mann fest. {zeuge}', 'Am Abend wollte ein Räuber {in} einen Spaziergänger ausnehmen. Er hatte nicht mit Herrn Alexander gerechnet. Der Täter sitzt nun auf dem Revier, das Opfer ist wohlauf. {zeuge}'] },
    entkommen: { prio: 4, rubrik: 'Polizei', t: ['Räuber entkommt {in}', 'Überfall {in}: Täter flüchtig'],
      x: ['Ein Räuber überfiel {in} einen Passanten und entkam in die Gassen. Die Polizei bittet um Hinweise: dunkler Mantel, Schiebermütze.'] },
    sonst: { prio: 3, rubrik: 'Polizei', t: ['Räuber {in} in die Flucht geschlagen'], x: ['Ein Überfall {in} endete, bevor er richtig begann: Der Täter ergriff die Flucht. Das Opfer kam mit dem Schrecken davon.'] },
  },
  dieb: {
    gefasst: { prio: 7, rubrik: 'Polizei', t: ['Taschendieb {in} gefasst', 'Langfinger hat Pech: Alexander war in der Nähe'],
      x: ['Ein Taschendieb rempelte {in} eine Passantin an und rannte mit ihrer Geldbörse davon, aber nicht weit. Herr Alexander holte ihn ein, die Polizei übernahm. {zeuge}'] },
    entkommen: { prio: 3, rubrik: 'Polizei', t: ['Taschendieb {in} unterwegs', 'Vorsicht, Langfinger {in}!'],
      x: ['{In} hat ein Taschendieb erneut zugeschlagen und ist entkommen. Die Polizei rät: Brieftasche in die Innentasche!'] },
    sonst: { prio: 2, rubrik: 'Polizei', t: ['Taschendiebstahl {in}'], x: ['{In} wurde eine Geldbörse gestohlen. Von dem Täter fehlt jede Spur.'] },
  },
  bombe: {
    wasser: { prio: 9, rubrik: 'Alexander', t: ['Bombe der Anarchisten im Wasser versenkt!', 'Alexander rettet die Stadt: Bombe zischt im Wasser aus'],
      x: ['Anarchisten legten {in} einen Sprengsatz mit brennender Zündschnur ab. Herr Alexander packte die Bombe und schleuderte sie ins Wasser, wo sie harmlos verzischte. {zeuge}'] },
    himmel: { prio: 9, rubrik: 'Alexander', t: ['Anarchisten-Bombe zerplatzt hoch über der Stadt!', 'Bombe {in}: Alexander wirft sie in den Himmel'],
      x: ['Eine Bombe der Anarchisten brannte schon {in}, als Herr Alexander sie in den Nachthimmel schleuderte. Hoch über den Dächern zerplatzte sie, niemand wurde verletzt. {zeuge}'] },
    knall: { prio: 8, rubrik: 'Polizei', t: ['Explosion {in}!', 'Anschlag der Anarchisten {in}'],
      x: ['{In} explodierte am Abend eine Bombe der Anarchisten. Fenster gingen zu Bruch, Passanten stürzten. Die Polizei sperrte die Straße. Die Bewohner fragen: Wer steckt hinter der Bande?'] },
    sonst: { prio: 5, rubrik: 'Polizei', t: ['Bombenalarm {in}'], x: ['{In} herrschte am Abend Bombenalarm. Die Polizei rät zur Wachsamkeit.'] },
  },
  angriff: {
    gefasst: { prio: 10, rubrik: 'Alexander', t: ['Anarchisten greifen Alexander an und verlieren!', '{n} Anarchisten {in} festgenommen', 'Steine, Flaschen, Kugeln: nichts hält Alexander auf'],
      x: ['Eine Bande von Anarchisten stellte Herrn Alexander {in}. Sie warfen Steine und Flaschen, einer schoss mit dem Revolver. Alles prallte ab. Am Ende lagen die Angreifer auf dem Pflaster, die Polizei nahm {n} von ihnen fest. {zeuge}', 'Mit Steinen, Flaschen und Flugblättern („Brot und Kohle statt Kronleuchter“) gingen Anarchisten {in} auf Herrn Alexander los. Gegen seine Kräfte hatten sie keine Aussicht, die Polizei nahm {n} von ihnen fest. Die Festgenommenen sind Arbeiter aus der Gießerei und dem Hafen. Die Gewerkschaft distanziert sich von der Gewalt, nicht aber von den Forderungen.'] },
    sonst: { prio: 6, rubrik: 'Polizei', t: ['Anarchisten-Krawall {in}', 'Anarchisten fliehen vor Alexander'],
      x: ['{In} griffen Anarchisten den Herrn von Vespera an, flohen aber, als ihre Würfe abprallten. Die Polizei sucht nach dem Versteck der Bande.'] },
  },
};
const ZT_TAT = {
  wagen: { prio: 6, t: ['Automobil schwebt {in}', 'Herr Alexander hebt Automobil mit bloßem Blick'], x: ['Passanten {in} trauten ihren Augen nicht: Ein Automobil stieg wie eine Feder in die Luft. Herr Alexander hielt es mit seinen Kräften. {zeuge}'] },
  mensch: { prio: 5, t: ['Passant schwebt {in}', '„Ich bin geflogen!“', 'Gefragt wurde er nicht'], x: ['Ein Bürger {in} schwebte am Abend einige Meter über dem Pflaster, gehalten von Herrn Alexander. Er nahm es mit Humor: „Ein Erlebnis! Das erzähle ich meinen Enkeln.“', 'Ein Bürger {in} wurde am Abend von Herrn Alexander in die Luft gehoben. Wieder auf den Füßen, war ihm eher nach Schimpfen zumute: „Ich bin doch kein Spielzeug.“ Die Redaktion fragt: Wo endet der Spaß, wenn einer alles darf?'] },
  riss: { prio: 5, t: ['{ding} {in} herausgerissen', 'Alexander räumt {in} auf'], x: ['Mit einem Ruck löste sich {in} {dinga} aus dem Boden und schwebte davon. Die Stadtwerke reagieren säuerlich: „Der Herr von Vespera hat die Stadt gebaut. Reparieren dürfen sie unsere Leute.“'] },
  landung: { prio: 4, t: ['Landung mit Donnerhall {in}', 'Alexander landet {in}'], x: ['Mit einem Schlag, der die Schaufenster zittern ließ, setzte Herr Alexander {in} auf, ein Knie am Boden, Schnee und Staub stoben auf. {zeuge}'] },
  flug: { prio: 4, t: ['Alexander kreist über den Türmen', 'Ein Mann am Himmel über Vespera'], x: ['Wieder wurde Herr Alexander hoch über der Stadt gesehen, schwarz vor dem Polarlicht, mit wehendem Frack. Die Gäste auf den Dachterrassen hoben die Gläser. {zeuge}'] },
  welle: { prio: 5, t: ['Druckwelle erschüttert die Straße {in}', 'Rätselhafter Stoß {in}'], x: ['{In} stürzte Herr Alexander aus dem Himmel und schlug einen Ring aus Luft, der Hüte, Zeitungen und Laub davonwirbelte. Verletzt wurde niemand.'] },
  schweben: { prio: 4, t: ['Dinge kreisen um Herrn Alexander', 'Schwebende Kisten {in}'], x: ['{In} kreisten Fässer, Kisten und Stühle wie Planeten um Herrn Alexander. Ein Kind wollte mitfliegen.'] },
  stoss: { prio: 4, t: ['Unsichtbarer Stoß {in}', 'Alexander schlägt mit Energie zu'], x: ['Ein Stoß aus purer Kraft ging {in} von Herrn Alexanders Hand aus. Wer im Weg stand, landete unsanft auf dem Hosenboden.'] },
  imperial: { prio: 3, t: ['Aurora Imperial über der Stadt', 'Das Luftschiff des Herrn legt ab'], x: ['Die Aurora Imperial, Herrn Alexanders privates Luftschiff, zog mit hellen Fenstern über die Dächer. Von der Grande Promenade aus winkten die Leute.'] },
};
// Stadtnachrichten, Klatsch und Kultur (Füllstoff, wenn wenig los ist); w = nur bei diesem Wetter
const ZT_STADT = [
  { r: 'Wetter', w: ['polarlicht', 'nordlicht'], t: 'Polarlicht so hell wie nie', x: 'Grüne und türkise Schleier stehen über dem Krater. Auf den Dachterrassen des Belmont drängen sich die Gäste, die Sternwarten im Observatoriumsviertel melden Rekordwerte.' },
  { r: 'Wetter', w: ['sturm'], t: 'Schneesturm fegt durch die Straßen', x: 'Die Straßenbahn fährt im Schritt, die Portiers halten die Türen fest. Die Stadtwerke bitten: Laternen nicht zum Festhalten benutzen.' },
  { r: 'Wetter', w: ['schnee'], t: 'Neuschnee auf den Dächern', x: 'Die Räumkolonnen sind seit dem frühen Abend unterwegs. Auf dem Eiskanal ist die Bahn frisch gefegt.' },
  { r: 'Wetter', w: ['nebel', 'dunst'], t: 'Türkiser Nebel hüllt die Türme ein', x: 'Nur die goldenen Kronen der höchsten Häuser ragen heraus. Kapitäne der kleinen Luftschiffe fliegen nach Gehör.' },
  { r: 'Wetter', w: ['regen'], t: 'Regen glänzt auf dem Pflaster', x: 'Das Licht der Laternen liegt in Pfützen, die Kinos melden volle Säle.' },
  { r: 'Wetter', w: ['frost'], t: 'Eisnebel: Die Stadt glitzert', x: 'Feine Eiskristalle schweben in der Luft, die Scheiben tragen Eisblumen. Ärzte raten zum Schal.' },
  { r: 'Stadt', t: 'Eiskanal: Rekordbetrieb', x: 'Auf dem gefrorenen Kanal drehen Hunderte ihre Runden. Ein Eisläufer zeigte gestern einen dreifachen Sprung, die Zuschauer jubelten.' },
  { r: 'Stadt', t: 'Neue Straßenbahn-Wagen bestellt', x: 'Die Verkehrsbetriebe wollen die Linien über die Grande Promenade dichter fahren. Die Wagen sollen türkis und gold lackiert werden.' },
  { r: 'Stadt', t: 'Zöllner am Viadukt melden Ansturm', x: 'Auf der einzigen Straße nach Vespera stauten sich die Automobile bis in den Tunnel. Alle wollen die Stadt im Krater sehen.' },
  { r: 'Stadt', t: 'Güterkai: Kran hebt Rekordlast', x: 'Am Hafen wurde eine Turbine für die Kraftwerke an Land gehoben. Die Hafenarbeiter feierten danach in der Brass Lantern.' },
  { r: 'Stadt', t: 'Vespera baut weiter', x: 'Im Börsenviertel wachsen zwei neue Türme in die Höhe. Die Bauherren versprechen: Keiner wird höher als das Belmont.' },
  { r: 'Kultur', t: 'Varieté Metropol: ausverkauft', x: 'Die neue Revue mit Tänzerinnen, Jongleuren und einem Zauberer aus Wien ist bis Monatsende ausverkauft. Kritiker loben das Bühnenbild in Gold.' },
  { r: 'Kultur', t: 'Jazz im Belmont bis zum Morgengrauen', x: 'Die Band im großen Ballsaal spielte gestern drei Zugaben. Morgengrauen gibt es in Vespera bekanntlich nicht, also spielten sie einfach weiter.' },
  { r: 'Kultur', t: 'Leierkasten-Streit beigelegt', x: 'Die Leierkastenmänner haben sich auf feste Ecken geeinigt. Am Belmont-Platz darf nur noch gespielt werden, wer einen Walzer kann.' },
  { r: 'Gesellschaft', t: 'Wer ist die geheimnisvolle Dame im Belmont?', x: 'Seit Tagen wird im Ballsaal eine Dame in silbernem Kleid gesehen, die mit niemandem tanzt. Die Garderobiere schweigt.' },
  { r: 'Gesellschaft', t: 'Randolf kauft Champagner', x: 'Der Butler des Herrn Alexander wurde im Salonviertel beim Einkauf gesehen: sechs Kisten, beste Lage. Auf die Frage nach dem Anlass sagte er nur: „Der Herr hat Durst.“' },
  { r: 'Gesellschaft', t: 'Café Kranich: neue Torte', x: 'Die Konditoren haben eine Torte in Form des Belmont gebacken, mit goldener Krone aus Zuckerwerk. Sie ist jeden Abend nach einer Stunde verkauft.' },
  { r: 'Wirtschaft', t: 'Vespera-Bank: Tresor voller denn je', x: 'Die Direktion meldet einen neuen Höchststand an eingelagertem Gold. Der Tresor liegt tief unter dem Börsenviertel und gilt als der sicherste der Welt.' },
  { r: 'Stadt', t: 'Brass Lantern: Klavier wieder gestimmt', x: 'Die Arbeiterkneipe am Kneipenplatz hat ihr altes Klavier stimmen lassen. Die Stammgäste sagen, es klinge jetzt fast zu gut.' },
  { r: 'Stadt', t: 'Die Polizei verstärkt ihre Streifen', x: 'Nach den Umtrieben der Anarchisten gehen die Schutzleute nun zu zweit. Der Polizeipräsident dankt Herrn Alexander für seine Hilfe.' },
  // V66: die andere Seite der Stadt
  { r: 'Stadt', t: 'Mieten im Arbeiterviertel steigen erneut', x: 'Zum dritten Mal in diesem Jahr erhöhen die Hausverwaltungen am Kneipenplatz die Mieten. Viele Häuser gehören Gesellschaften, an denen Herr Alexander beteiligt ist. Seine Verwaltung verweist auf die gestiegenen Kohlepreise.' },
  { r: 'Wirtschaft', t: 'Gewerkschaft fordert mehr Lohn', x: 'Die Gewerkschaft der Kesselschmiede verlangt zehn Prozent mehr Lohn in den Werken am Hafen. „Wir bauen die reichste Stadt der Welt und können uns keine Kohle leisten“, sagt ihr Sprecher. Die Werksleitungen schweigen.' },
  { r: 'Meinung', t: 'Leitartikel: Wem gehört Vespera?', x: 'Das Hotel, die Bank, die Bahn, die halbe Avenue: Fragt man in Vespera, wem etwas gehört, lautet die Antwort meist „Herrn Alexander“. Niemand bestreitet, dass er Großes geschaffen hat. Aber eine Stadt, in der so vieles in einer Hand liegt, muss sich fragen, wer ihr widerspricht, wenn diese Hand irrt.' },
  { r: 'Meinung', t: 'Der Mann mit dem Kristall: Segen oder Gefahr?', x: 'Ein Leser aus dem Theaterviertel schreibt: „Ich bewundere Herrn Alexander. Aber ich schlafe schlecht, seit ich weiß, dass ihn keine Kugel und kein Gesetz aufhalten kann.“ Eine Antwort aus dem Belmont steht aus.' },
  { r: 'Stadt', t: 'Unfall in der Gießerei', x: 'Ein Dampfventil platzte in der Nachtschicht, zwei Arbeiter wurden verbrüht. Die Kollegen fordern neue Kessel und kürzere Schichten. Die Werksleitung spricht von einem bedauerlichen Einzelfall, im Viertel spricht man vom dritten in diesem Winter.' },
  { r: 'Gesellschaft', t: 'Salongeflüster: Ist er zu mächtig geworden?', x: 'In den Salons der Avenue bewundert man Herrn Alexander, und man beneidet ihn. Reeder von Hallstein soll beim Diner gesagt haben: „Eine Stadt braucht einen Baumeister. Einen König braucht sie nicht.“ Gelacht haben alle, widersprochen hat keiner.' },
  { r: 'Stadt', t: 'Schweigemarsch vor dem Belmont', x: 'Rund zweihundert Arbeiter zogen am Abend mit Laternen vor das Grand Hotel. Sie trugen Schilder mit „Brot, Kohle, Lohn“. Der Marsch blieb friedlich; oben im Ballsaal spielte die Kapelle weiter.' },
  { r: 'Kultur', t: 'Kabarett im Metropol spottet über den Herrn im Turm', x: 'Die neue Nummer im Varieté heißt „Der Mann, der alles hebt, außer den Löhnen“. Das Publikum lacht, auch in den Logen, wenn auch etwas leiser.' },
];
// V66: Leserbriefe in jeder Ausgabe, mal bewundernd, mal neidisch, mal wütend
const ZT_LESER = [
  ['A. K., Hafenpromenade', 'Ohne Herrn Alexander stünde hier nur Eis. Wer schimpft, möge bitte zurück nach Hamburg ziehen.'],
  ['Familie Brandt, Kneipenplatz', 'Unser Ofen bleibt drei Tage die Woche kalt. Die Kronleuchter im Belmont brennen jede Nacht.'],
  ['Ein Kesselschmied', 'Ich habe am Viadukt gebaut. Auf der Gedenktafel steht nur ein Name, und es ist nicht meiner.'],
  ['M. v. S., Salonviertel', 'Herr Alexander ist ein Genie. Man muss ihn nicht lieben, um das zu sehen.'],
  ['Eine Verkäuferin', 'Ich habe ihn fliegen sehen und mich gefreut wie ein Kind. Dann kam die Mieterhöhung.'],
  ['Dr. Heinemann, Observatoriumsviertel', 'Bewunderung ist gut, Kontrolle ist besser. Wer kontrolliert einen Unverwundbaren?'],
  ['Ein Straßenbahnschaffner', 'Er grüßt immer freundlich. Das muss man ihm lassen. Er kann es sich ja auch leisten.'],
  ['Witwe Ostermann', 'Das neue Hospital hat meinem Enkel das Leben gerettet. Ich bete für Herrn Alexander, auch wenn mein Sohn ihn verflucht.'],
  ['Ein Student', 'Die Anarchisten sind Verbrecher. Aber ihre Flugblätter rechnen besser als der Stadtrat.'],
  ['Frau Direktor Pohl', 'Neid ist eine hässliche Sache. Ich sehe sie jeden Tag vor dem Belmont.'],
];
function ztLeserKasten() {
  const L = ZT_LESER.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  return { titel: 'Leserbriefe', zeilen: L.map(([w, t]) => '„' + t + '“ · ' + w) };
}
const ZT_ANZEIGEN = [
  ['CAFÉ KRANICH', 'Torten · Mokka · Musik', 'Salonviertel'], ['VARIETÉ METROPOL', 'Die große Revue · täglich', 'Lichterviertel'], ['VESPERA-BANK', 'Ihr Gold in sicheren Händen', 'Börsenviertel'],
  ['THE BELMONT', 'Ballsaal · Jazz · Champagner', 'Grand Hotel seit 1912'], ['THE BRASS LANTERN', 'Bier, Klavier und ehrliche Leute', 'Kneipenplatz'], ['PELZHAUS NORDSTERN', 'Wärme mit Stil', 'Grande Promenade'],
  ['PIERCE-ARROW', 'Das Automobil der Herrschaften', 'Ausstellung am Belmont-Platz'], ['GRAMMOPHON-SALON', 'Die neuesten Platten aus Übersee', 'Theaterviertel'], ['STERNWARTE NORD', 'Führungen unter dem Polarlicht', 'Observatoriumsviertel'],
];
const ZT_TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], ZT_MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/* ---------- Beobachten: gegner.js ---------- */
function ztGegner(dt) {
  const S = GEGNER.stats, F = ZEITUNG;
  if (!F.gStats) { F.gStats = { ...S }; return; }
  const d = {}; for (const k in S) { d[k] = S[k] - (F.gStats[k] || 0); }
  F.gStats = { ...S };
  const E = GEGNER.ev;
  if (E && (!F.fall || F.fall.E !== E)) {
    if (F.fall) ztFallSchluss();
    let x = player.p.x, z = player.p.z; try { [x, z] = E.where(); } catch (e) { }
    F.fall = { E, typ: E.type, label: E.label, ort: ztOrt(x, z, 0), x, z, gefasst: 0, entkommen: 0, entschaerft: 0, explodiert: 0, wasser: false, ende: -1, foto: null, item: null, down: false };
  }
  const C = F.fall; if (!C) return;
  C.gefasst += d.gefasst || 0; C.entkommen += d.entkommen || 0; C.explodiert += d.explodiert || 0;
  if (d.entschaerft) { C.entschaerft += d.entschaerft; const tt = $('toast'); if (tt && /Wasser/.test(tt.textContent || '')) C.wasser = true; }
  // das Foto: wenn der erste Gegner am Boden liegt oder die Bombe weg ist, und Alexander nah dran ist
  const near = Math.hypot(C.x - player.p.x, C.z - player.p.z) < 80;
  if (!C.down && C.E && C.E.crooks && C.E.crooks.some(pd => pd.rag || (pd.gg && /down|arrest|led|lie/.test(pd.gg.s || '')))) { C.down = true; if (near && !C.item) { C.item = { foto: null }; ztSnap(C.item); } }
  if ((d.entschaerft || d.explodiert) && near && !C.item) { C.item = { foto: null }; ztSnap(C.item); }
  if (GEGNER.ev !== C.E && C.ende < 0) C.ende = 0;
  if (C.ende >= 0) {
    C.ende += dt;
    // Schluss, wenn die Polizei fertig ist (oder nach einer Minute)
    if ((!GEGNER.arrests.length && C.ende > 3) || C.ende > 60) ztFallSchluss();
  }
}
function ztFallSchluss() {
  const C = ZEITUNG.fall; ZEITUNG.fall = null; if (!C) return;
  const T = ZT_FALL[C.typ]; if (!T) return;
  let k = 'sonst';
  if (C.typ === 'bombe') k = C.entschaerft ? (C.wasser ? 'wasser' : 'himmel') : C.explodiert ? 'knall' : 'sonst';
  else if (C.gefasst) k = 'gefasst'; else if (C.entkommen) k = 'entkommen';
  const V = T[k] || T.sonst, o = { ort: C.ort, in: ztIn(C.ort), In: ztCap(ztIn(C.ort)), n: Math.max(1, C.gefasst), zeuge: ztZeuge() };
  ZEITUNG.bilanz.gefasst += C.gefasst; if (C.entschaerft) ZEITUNG.bilanz.bomben++;
  let text = ztFill(ztPick(V.x), o);
  if (C.typ === 'bombe' && C.gefasst) text += ' ' + (C.gefasst > 1 ? C.gefasst + ' Bombenleger wurden' : 'Einer der Bombenleger wurde') + ' festgenommen.';
  const it = zeitungMeldung({ titel: ztFill(ztPick(V.t), o), text, rubrik: V.rubrik, prio: V.prio, ort: C.ort, quelle: 'gegner' });
  if (it && C.item) { if (C.item.foto) it.foto = C.item.foto; else setTimeout(() => { if (C.item.foto) it.foto = C.item.foto; }, 400); }
}

/* ---------- Gala im Belmont (gala.js feuert window 'vespera-gala' mit { phase, rede, n }) ---------- */
const ZT_REDE = [
  'In seiner Rede dankte Herr Alexander den Bürgern: „Diese Stadt gehört allen, die sie jeden Abend zum Leuchten bringen.“',
  'Herr Alexander sprach von seiner Vision: neue Türme, neue Linien, ein Vespera, von dem die ganze Welt spricht. Der Saal hing an seinen Lippen.',
  'Herr Alexander fasste sich kurz: „Danke. Und jetzt: tanzen!“ Der Saal lachte und applaudierte stehend.',
  'Herr Alexander zeigte sich großzügig und versprach der Stadt Geschenke. Die Kapelle spielte einen Tusch, die Gäste jubelten.',
];
// V66: was der Kurier außerdem bemerkt
const ZT_GALA_DRAUSSEN = ['Vor den Türen des Belmont standen derweil Arbeiter mit Laternen und Schildern: „Ein Glas Champagner kostet so viel wie eine Woche Kohle.“ Die Portiers ließen sie gewähren.', 'Nicht alle Gäste applaudierten gleich laut. Reeder von Hallstein hob sein Glas, trank aber nicht.', 'Im Arbeiterviertel blieb es an diesem Abend still. Man feierte dort nicht, man arbeitete.', ''];
const ZT_GALA = { rede: -1, foto: null, champ: false };
function ztGala(d) {
  const ph = d && d.phase, G = ZT_GALA;
  if (ph === 'einzug') { G.rede = -1; G.foto = null; G.champ = false; }
  else if (ph === 'rede') G.rede = d.rede;
  else if (ph === 'stern' || ph === 'feuerwerk') { const it = { foto: null }; ztSnap(it); setTimeout(() => { if (it.foto) G.foto = it.foto; }, 400); }
  else if (ph === 'champagner' && !G.champ) {
    G.champ = true;
    zeitungMeldung({ titel: 'Champagner für alle im Belmont', text: 'Auf Kosten von Herrn Alexander ließ der Oberkellner im großen Ballsaal für jeden Gast ein Glas einschenken. Die Kapelle spielte dazu einen Tusch.', rubrik: 'Gesellschaft', prio: 4, ort: 'The Belmont', quelle: 'gala' });
  } else if (ph === 'ende') {
    const r = d.rede != null && d.rede >= 0 ? d.rede : G.rede, n = d.n | 0;
    const text = 'Glanzvoller Abend im großen Ballsaal des Belmont: Direktor Hartmann und Bürgermeister von Arnim ehrten Herrn Alexander, der Stadtrat verlieh ihm den Goldenen Stern von Vespera. ' +
      (ZT_REDE[r] || 'Herr Alexander hörte die Reden mit einem stillen Lächeln an und hob nur das Glas.') +
      ' Nach dem Toast eröffnete ein Paar den Ehrenwalzer, Goldregen fiel von der Decke, und über dem Belmont stiegen Feuerwerk in Türkis und Gold in den Polarhimmel.' + (n > 1 ? ' Es war bereits die ' + n + '. Gala zu seinen Ehren, ausgerichtet in seinem eigenen Hotel.' : '') + (' ' + ztPick(ZT_GALA_DRAUSSEN)).replace(/ $/, '');
    const it = zeitungMeldung({ titel: ztPick(['Gala im Belmont: Vespera feiert Alexander', 'Goldener Stern für den Herrn von Vespera', 'Feuerwerk über dem Belmont: die Gala des Jahres']), text, rubrik: 'Gesellschaft', prio: 9, ort: 'The Belmont', extra: true, ruf: 'Extrablatt! Gala im Belmont! Goldener Stern für Alexander!', quelle: 'gala' });
    if (it && G.foto) it.foto = G.foto;
  }
}
if (typeof window !== 'undefined') window.addEventListener('vespera-gala', e => { try { ztGala(e.detail); } catch (er) { console.warn('Zeitung/Gala:', er); } });

/* ---------- Beobachten: Alexanders Kräfte ---------- */
function ztTat(art, o = {}, snap = true) {
  const F = ZEITUNG; if (F.done.has(art)) return;
  F.done.add(art);
  const ort = ztOrt(), V = ZT_TAT[art], oo = { ort, in: ztIn(ort), In: ztCap(ztIn(ort)), zeuge: ztZeuge(), ...o };
  zeitungMeldung({ titel: ztFill(ztPick(V.t), oo), text: ztFill(ztPick(V.x), oo), rubrik: art === 'imperial' ? 'Stadt' : 'Alexander', prio: V.prio, ort: oo.ort, foto: snap, quelle: 'kraefte' });
}
function ztKraefte(dt) {
  const W = ZEITUNG.watch, B = ZEITUNG.bilanz, p = player.p;
  // Telekinese: was hat er gepackt?
  const tk = POWERS.tk;
  if (tk && tk !== W.tk) {
    W.tk = tk; W.tkT = 0;
    if (tk.kind === 'car') B.wagen++; else if (tk.kind === 'ped') B.leute++;
    const nm = tk.B && tk.B.name ? String(tk.B.name) : '';
    if (tk.kind === 'loose' && /Laterne|Baum|Poller|Bank|Kiosk|Säule|Uhr|Mast|Fahne|Klavier|Litfa|Brunnen/i.test(nm)) { B.ausgerissen++; W.riss = nm; }
  }
  if (!tk) W.tk = null;
  // erst nach einer guten Sekunde berichten (dann ist auf dem Foto etwas zu sehen)
  if (tk && (W.tkT += dt) > 1.2 && !W.tkDone) {
    W.tkDone = true;
    if (tk.kind === 'car') ztTat('wagen'); else if (tk.kind === 'ped') ztTat('mensch');
    else if (W.riss) { const nm = W.riss; W.riss = null; ztTat('riss', { ding: nm, dinga: 'ein' + (/e$/.test(nm) ? 'e ' : ' ') + nm }); }
  }
  if (!tk) W.tkDone = false;
  // Heldenlandung
  if (POWERS.hero && POWERS.hero !== W.hero) { W.hero = POWERS.hero; B.landungen++; if ((POWERS.hero.k || 0.5) > 0.45 && p.y < 60) ztTat('landung'); }
  // Flug: Strecke und hoch über der Stadt
  if (player.fly && W.lastP) B.flugM += Math.min(200, Math.hypot(p.x - W.lastP.x, p.y - W.lastP.y, p.z - W.lastP.z));
  W.lastP = { x: p.x, y: p.y, z: p.z };
  if (player.fly && p.y > 140 && Math.hypot(p.x, p.z) < 900) { W.highT = (W.highT || 0) + dt; if (W.highT > 6) ztTat('flug', {}, false); } else W.highT = 0;
  // Schockwelle (Abklingzeit springt hoch), Levitation, Energieschub
  if (KRAEFTE.cd > W.cd + 0.5) { B.wellen++; ztTat('welle'); }
  W.cd = KRAEFTE.cd || 0;
  if (KRAEFTE.levOn && !W.lev && KRAEFTE.lev && KRAEFTE.lev.length > 3) ztTat('schweben');
  W.lev = !!KRAEFTE.levOn;
  const sh = BLAST.stats ? BLAST.stats.shots : 0;
  if (sh > W.shots) { B.stoesse += sh - W.shots; if (BLAST.stats.hits > (W.hits || 0)) ztTat('stoss'); }
  W.shots = sh; W.hits = BLAST.stats ? BLAST.stats.hits : 0;
  // Aurora Imperial: Alexander am Steuer
  if (IMP.st === 'helm' && W.imp !== 'helm') ztTat('imperial', {}, false);
  W.imp = IMP.st;
}

/* ---------- Eine Ausgabe zusammenstellen ---------- */
function ztWetter() {
  const w = ATMO.w || {}; let mond = '';
  try { mond = moonName(ATMO.phase); } catch (e) { }
  return { name: w.name || 'Polarnacht', id: w.id || '', mond };
}
function ztFueller(n, wid, used) {
  const pool = ZT_STADT.filter(s => (!s.w || s.w.includes(wid)) && !used.has(s.t));
  const wet = pool.filter(s => s.w), rest = pool.filter(s => !s.w), out = [];
  if (wet.length) out.push(ztPick(wet));
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  return out.map(s => ({ titel: s.t, text: s.x, rubrik: s.r, prio: 2, ort: '', foto: null, zeit: Date.now(), quelle: 'stadt' }));
}
export function zeitungDrucken(extra = false, still = false) {
  const F = ZEITUNG;
  if (F.fall && F.fall.ende >= 0) ztFallSchluss();
  const news = F.pending.splice(0).sort((a, b) => b.prio - a.prio || b.zeit - a.zeit);
  const used = new Set(F.archive.slice(-3).flatMap(e => [e.lead, ...e.items].map(i => i.titel)));
  const W = ztWetter();
  let items = news.slice(0, 7);
  if (items.length < 6) items = items.concat(ztFueller(6 - items.length, W.id, used));
  const lead = items.shift();
  const now = new Date(), B = F.bilanz;
  const kolumne = [];
  if (B.flugM > 50) kolumne.push(['Geflogen', (B.flugM / 1000).toFixed(1).replace('.', ',') + ' km']);
  if (B.wagen) kolumne.push(['Automobile gehoben', B.wagen]);
  if (B.leute) kolumne.push(['Bürger schweben lassen', B.leute]);
  if (B.ausgerissen) kolumne.push(['Ausgerissen', B.ausgerissen]);
  if (B.landungen) kolumne.push(['Heldenlandungen', B.landungen]);
  if (B.stoesse) kolumne.push(['Energiestöße', B.stoesse]);
  if (B.wellen) kolumne.push(['Druckwellen', B.wellen]);
  const S = GEGNER.stats;
  const ed = {
    nr: F.nr++, extra, zeit: now.getTime(),
    datum: ZT_TAGE[now.getDay()] + ', ' + now.getDate() + '. ' + ZT_MON[now.getMonth()],
    uhr: String(now.getHours()).padStart(2, '0') + '.' + String(now.getMinutes()).padStart(2, '0') + ' Uhr',
    lead, items, wetter: W, kolumne,
    polizei: [['Gefasst', S.gefasst || 0], ['Entkommen', S.entkommen || 0], ['Bomben entschärft', S.entschaerft || 0], ['Explosionen', S.explodiert || 0]],
    kaesten: [...F.boxes.values()].map(b => ({ titel: b.titel, zeilen: b.zeilen })).concat([ztLeserKasten()]),
    anzeigen: ZT_ANZEIGEN.slice().sort(() => Math.random() - 0.5).slice(0, 3),
  };
  F.archive.push(ed); if (F.archive.length > ZT_ARCH) F.archive.shift();
  F.done.clear();
  ztSave();
  ztRufe(ed, still);
  if (F.open) { F.view = F.archive.length - 1; ztRender(); }
  return ed;
}
// Die Zeitungsjungen rufen ab jetzt die Schlagzeilen dieser Ausgabe aus (HEAD aus life.js wird ersetzt)
function ztRufe(ed, still) {
  const pre = ed.extra ? ['Extrablatt! Extrablatt! ', 'Extrablatt! '] : ['Abendausgabe! ', 'Neueste Nachrichten! ', 'Der Vespera-Kurier! '];
  const rufe = [ed.lead, ...ed.items].slice(0, 5).map((it, i) => it.ruf || (i === 0 ? pre[0] : ztPick(pre)) + it.titel.replace(/[.!]+$/, '') + '!');
  HEAD.splice(0, HEAD.length, ...rufe, rufe[0]);
  const him = /Alexander/.test(ed.lead.titel + ed.lead.rubrik);
  HEAD_HIM.splice(0, HEAD_HIM.length, 'Eine Zeitung für Herrn Alexander? Geht aufs Haus!', 'Der Vespera-Kurier, Herr Alexander! Taste U zum Lesen!',
    him ? 'Herr Alexander! Sie sind auf der Titelseite!' : 'Extrablatt! … oh! Guten Abend, Herr Alexander!');
  if (still) return;
  if (ed.extra) { LIFE.sayT = Math.min(LIFE.sayT, 0.5); toast('Extrablatt des Vespera-Kuriers: ' + ed.lead.titel + ' · Taste U: lesen'); }
  else if (ed.nr > 1) toast('Neue Abendausgabe des Vespera-Kuriers · Taste U: lesen');
}

/* ---------- Ansicht ---------- */
const ZT_CSS = `
#ztPaper{position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(4,14,16,.72);backdrop-filter:blur(2px)}
#ztPaper.on{display:flex}
#ztPaper .zs{position:relative;width:min(1000px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;padding:22px 30px 18px;box-sizing:border-box;
 background:radial-gradient(ellipse at 30% 20%,rgba(255,250,235,.55),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(120,95,50,.16),transparent 55%),#ece2c9;
 color:#1b1712;font-family:'Bodoni MT','Didot','Libre Bodoni','Book Antiqua',Georgia,'Times New Roman',serif;box-shadow:0 18px 60px rgba(0,0,0,.6),inset 0 0 70px rgba(110,80,30,.18);transform:rotate(-.4deg)}
#ztPaper .zm{text-align:center;border-bottom:3px double #1b1712;padding-bottom:6px}
#ztPaper .zm svg{display:block;margin:0 auto -4px;width:120px;height:30px}
#ztPaper .zt{font-size:clamp(34px,7.4vw,74px);letter-spacing:.1em;font-weight:700;line-height:1;margin:2px 0 4px;text-transform:uppercase}
#ztPaper .zt span{color:#0d5c5a}
#ztPaper .zl{display:flex;justify-content:space-between;gap:10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;border-top:1px solid #1b1712;padding-top:4px;flex-wrap:wrap}
#ztPaper .zx{display:inline-block;background:#8a1c12;color:#f4ead2;padding:1px 10px;letter-spacing:.3em;font-weight:700}
#ztPaper .zgrid{display:grid;grid-template-columns:1fr 210px;gap:22px;margin-top:12px}
#ztPaper .zh1{font-size:clamp(26px,4.4vw,44px);line-height:1.04;margin:4px 0 8px;font-weight:800;text-transform:uppercase;letter-spacing:.01em}
#ztPaper .zr{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#6b4e12;border-bottom:1px solid rgba(27,23,18,.4);padding-bottom:2px;margin-bottom:4px}
#ztPaper .zf{width:100%;display:block;filter:sepia(.35) contrast(1.05);border:1px solid #1b1712;margin:4px 0 2px}
#ztPaper .zfc{font-size:11px;font-style:italic;margin-bottom:8px}
#ztPaper .zb{columns:2 220px;column-gap:20px;column-rule:1px solid rgba(27,23,18,.3);font-size:15px;line-height:1.42;text-align:justify;hyphens:auto}
#ztPaper .zb::first-letter{float:left;font-size:3.1em;line-height:.82;padding:4px 6px 0 0;font-weight:800}
#ztPaper .zitems{display:grid;grid-template-columns:repeat(3,1fr);gap:0 18px;border-top:3px double #1b1712;margin-top:14px;padding-top:8px}
#ztPaper .zi{padding:0 0 10px;font-size:13.5px;line-height:1.38;text-align:justify;hyphens:auto}
#ztPaper .zr,#ztPaper .zi h3{text-align:left}
#ztPaper .zi h3{font-size:17px;line-height:1.12;margin:2px 0 4px;font-weight:800}
#ztPaper .zi .zf{margin-top:0}
#ztPaper .zside{border-left:1px solid #1b1712;padding-left:16px;font-size:13px}
#ztPaper .zbox{border:1px solid #1b1712;padding:7px 9px 8px;margin-bottom:12px;background:rgba(255,250,235,.25)}
#ztPaper .zbox h4{margin:0 0 5px;font-size:12px;letter-spacing:.24em;text-transform:uppercase;text-align:center;border-bottom:1px solid #1b1712;padding-bottom:3px}
#ztPaper .zbox table{width:100%;border-collapse:collapse}#ztPaper .zbox td{padding:1px 0}#ztPaper .zbox td+td{text-align:right;font-variant-numeric:tabular-nums}
#ztPaper .zad{border:2px solid #1b1712;outline:1px solid #1b1712;outline-offset:2px;text-align:center;padding:8px 6px;margin:0 3px 14px}
#ztPaper .zad b{display:block;font-size:15px;letter-spacing:.18em}#ztPaper .zad i{display:block;font-size:12.5px;margin:2px 0}#ztPaper .zad small{font-size:10px;letter-spacing:.2em;text-transform:uppercase}
#ztPaper .zfoot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:6px;border-top:1px solid #1b1712;padding-top:6px;font-size:12px;letter-spacing:.08em}
#ztPaper button{font:inherit;font-size:12px;letter-spacing:.14em;text-transform:uppercase;background:#1b1712;color:#ece2c9;border:0;padding:6px 12px;cursor:pointer}
#ztPaper button:disabled{opacity:.3;cursor:default}
#ztBtn{position:fixed;left:12px;bottom:150px;z-index:12;width:46px;height:46px;border-radius:50%;border:1px solid rgba(230,200,120,.7);background:rgba(6,30,32,.7);color:#e9cf8a;font-size:22px}
@media (max-width:720px){#ztPaper .zs{padding:14px 16px;transform:none}#ztPaper .zgrid{grid-template-columns:1fr}#ztPaper .zside{border-left:0;padding-left:0;border-top:3px double #1b1712;padding-top:10px}#ztPaper .zitems{grid-template-columns:1fr}#ztPaper .zb{columns:1}}
`;
const ZT_FAN = '<svg viewBox="0 0 120 30" aria-hidden="true"><g fill="none" stroke="#1b1712" stroke-width="1.1">' +
  Array.from({ length: 11 }, (_, i) => { const a = Math.PI * (0.08 + 0.84 * i / 10); return `<line x1="60" y1="29" x2="${(60 - Math.cos(a) * 28).toFixed(1)}" y2="${(29 - Math.sin(a) * 26).toFixed(1)}"/>`; }).join('') +
  '<path d="M30 29 A30 27 0 0 1 90 29"/><path d="M4 26 H40 M80 26 H116" stroke="#0d5c5a" stroke-width="1.6"/><path d="M10 22 H36 M84 22 H110" stroke="#9a7a2c"/></g></svg>';
function ztSetup() {
  if (ZEITUNG.el || typeof document === 'undefined') return;
  const st = document.createElement('style'); st.textContent = ZT_CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'ztPaper'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Vespera-Kurier');
  el.innerHTML = '<div class="zs"></div>';
  el.addEventListener('mousedown', e => { if (e.target === el) zeitungClose(); e.stopPropagation(); });
  el.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if (!b) return;
    if (b.dataset.z === 'zu') zeitungClose(); else if (b.dataset.z === 'alt') ztBlatt(-1); else if (b.dataset.z === 'neu') ztBlatt(1);
  });
  el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  document.body.appendChild(el); ZEITUNG.el = el;
  if (isTouch) {
    const b = document.createElement('button'); b.id = 'ztBtn'; b.textContent = '📰'; b.title = 'Vespera-Kurier lesen'; b.setAttribute('aria-label', 'Zeitung lesen');
    b.addEventListener('click', () => (ZEITUNG.open ? zeitungClose() : zeitungOpen())); document.body.appendChild(b); ZEITUNG.btn = b;
  }
}
function ztItemHtml(it, big) {
  const foto = it.foto ? `<img class="zf" src="${it.foto}" alt="">${big ? `<div class="zfc">Aufnahme des Vespera-Kuriers${it.ort ? ': ' + ztEsc(it.ort) : ''}</div>` : ''}` : '';
  const r = `<div class="zr">${ztEsc(it.rubrik)}${it.ort ? ' · ' + ztEsc(it.ort) : ''}</div>`;
  if (big) return `${r}<div class="zh1">${ztEsc(it.titel)}</div>${foto}<div class="zb">${ztEsc(it.text)}</div>`;
  return `<div class="zi">${r}<h3>${ztEsc(it.titel)}</h3>${foto}${ztEsc(it.text)}</div>`;
}
const ztTable = rows => '<table>' + rows.map(r => Array.isArray(r) ? `<tr><td>${ztEsc(r[0])}</td><td>${ztEsc(r[1])}</td></tr>` : `<tr><td colspan="2">${ztEsc(r)}</td></tr>`).join('') + '</table>';
function ztRender() {
  const F = ZEITUNG, ed = F.archive[F.view]; if (!F.el || !ed) return;
  const n = F.archive.length;
  const side = [
    `<div class="zbox"><h4>Wetter</h4>${ztTable([ed.wetter.name, ...(ed.wetter.mond ? [['Mond', ed.wetter.mond]] : []), ['Sonne', 'Polarnacht']])}</div>`,
    `<div class="zbox"><h4>Polizeibericht</h4>${ztTable(ed.polizei)}</div>`,
    ...(ed.kolumne.length ? [`<div class="zbox"><h4>Der Herr von Vespera</h4>${ztTable(ed.kolumne)}</div>`] : []),
    ...ed.kaesten.map(k => `<div class="zbox"><h4>${ztEsc(k.titel)}</h4>${ztTable(k.zeilen)}</div>`),
    ...ed.anzeigen.map(a => `<div class="zad"><b>${ztEsc(a[0])}</b><i>${ztEsc(a[1])}</i><small>${ztEsc(a[2])}</small></div>`),
  ].join('');
  F.el.firstChild.innerHTML = `
    <div class="zm">${ZT_FAN}<div class="zt">Vespera <span>·</span> Kurier</div>
      <div class="zl"><span>Jahrgang XVI · Nr. ${ed.nr}</span>${ed.extra ? '<span class="zx">Extrablatt</span>' : '<span>Abendausgabe</span>'}<span>${ztEsc(ed.datum)} · ${ztEsc(ed.uhr)}</span><span>10 Funken</span></div></div>
    <div class="zgrid"><div>${ztItemHtml(ed.lead, true)}<div class="zitems">${ed.items.map(i => ztItemHtml(i, false)).join('')}</div></div><aside class="zside">${side}</aside></div>
    <div class="zfoot"><button data-z="alt" ${F.view <= 0 ? 'disabled' : ''}>◂ Ältere</button><span>Ausgabe ${F.view + 1} von ${n} · U oder Esc schließt · Pfeile blättern</span><button data-z="neu" ${F.view >= n - 1 ? 'disabled' : ''}>Neuere ▸</button><button data-z="zu">Schließen</button></div>`;
  F.el.firstChild.scrollTop = 0;
}
function ztBlatt(d) { const F = ZEITUNG; const v = Math.max(0, Math.min(F.archive.length - 1, F.view + d)); if (v !== F.view) { F.view = v; ztRender(); } }
export function zeitungOpen() {
  const F = ZEITUNG; ztSetup();
  if (F.open || DINE.menuOpen) return false;
  if (!F.archive.length) zeitungDrucken(false);
  F.view = F.archive.length - 1; ztRender();
  F.open = true; F.el.classList.add('on');
  // wie die Speisekarte: Maus frei, das Spiel geht nicht in die Pause
  DINE.menuOpen = true;
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
  return true;
}
export function zeitungClose() {
  const F = ZEITUNG; if (!F.open) return;
  F.open = false; F.el.classList.remove('on'); DINE.menuOpen = false;
  if (!isTouch) tryLock();
}
// Tasten: U öffnet; bei offener Zeitung fängt sie alles ab (vor input.js), damit Alexander nicht losläuft
if (typeof window !== 'undefined') window.addEventListener('keydown', e => {
  const F = ZEITUNG;
  if (F.open) {
    e.stopImmediatePropagation(); e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyU') zeitungClose();
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') ztBlatt(-1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') ztBlatt(1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') F.el.firstChild.scrollTop += 120;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') F.el.firstChild.scrollTop -= 120;
    return;
  }
  if (e.code === 'KeyU' && !e.repeat && playing && !paused && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement?.tagName !== 'INPUT') zeitungOpen();
}, true);

/* ---------- Zeitungsjunge: E = Zeitung nehmen ---------- */
function ztNewsboyNear(p) {
  for (const pd of LIFE.news) {
    const a = pd.a; if (!a || !a.on || pd.rag || pd.aw) continue;
    const e = a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < 2.6 * 2.6 && Math.abs(e[13] - p.y) < 2.5) return pd;
  }
  return null;
}

/* ---------- Takt: viermal pro Sekunde ---------- */
export function zeitungTick(dt = 0.25) {
  const F = ZEITUNG;
  if (!F.started) {
    if (!playing) return;
    F.started = true; ztSetup();
    INTERACT.push({ test: p => !player.fly && !!ztNewsboyNear(p), label: 'Zeitung nehmen: der Vespera-Kurier (Taste U liest sie überall)', act: () => zeitungOpen() });
    if (typeof window !== 'undefined' && window.vespera && !window.vespera.zeitung) window.vespera.zeitung = { Z: ZEITUNG, open: zeitungOpen, close: zeitungClose, meldung: zeitungMeldung, kasten: zeitungKasten, drucken: zeitungDrucken, extrablatt: () => zeitungDrucken(true) };
    // erste Ausgabe des Abends gleich zum Start (aus Stadtnachrichten), damit die Jungen etwas zu rufen haben
    zeitungDrucken(false, true); F.nextEd = ZT_PERIOD;
  }
  if (!playing || paused) return;
  F.t += dt;
  try { ztGegner(dt); } catch (e) { console.warn('Zeitung/Gegner:', e); }
  try { ztKraefte(dt); } catch (e) { console.warn('Zeitung/Kräfte:', e); }
  if (F.open) return;   // beim Lesen wird nicht gedruckt
  if (F.extraT >= 0 && (F.extraT -= dt) <= 0) {
    F.extraT = -1;
    if (F.t - F.lastExtra > 50 && F.pending.some(i => i.prio >= 8)) { F.lastExtra = F.t; zeitungDrucken(true); F.nextEd = Math.max(F.nextEd, 120); }
    else if (F.pending.some(i => i.prio >= 8)) F.extraT = 50 - (F.t - F.lastExtra) + 1;
  }
  if ((F.nextEd -= dt) <= 0) {
    // Abendausgabe alle sechs Minuten, wenn es Neues gibt (sonst alle zwölf mit Stadtnachrichten)
    if (F.pending.length || F.idle) { zeitungDrucken(false); F.nextEd = ZT_PERIOD; F.idle = false; }
    else { F.nextEd = ZT_PERIOD; F.idle = true; }
  }
}
if (typeof window !== 'undefined') setInterval(() => zeitungTick(0.25), 250);
