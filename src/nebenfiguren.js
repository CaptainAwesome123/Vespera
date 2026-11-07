/* =====================================================================
   V63 · NEBENFIGUREN MIT EIGENER GESCHICHTE
   Sechs feste Menschen von Vespera, jeder mit Gesicht, Ort, Tagesablauf,
   Gesprächen und einer kleinen Geschichte aus vier Aufgaben:
     - Josephine „Jo“ Lafleur, Jazzsängerin im Grand Ballroom des Belmont
     - Polizeipräsident Konstantin Brenner (Polizeipräsidium)
     - Viktor von Hallstein, Reeder und Industrieller, Alexanders Rivale
     - Margot Wendt, Reporterin des Vespera-Kurier
     - Hannes Kröger, Vorarbeiter im Stahlwerk, Stammgast im Brass Lantern
     - Kapitän Leopold Ahrens, Kapitän der Aurora Imperial
   Vier von ihnen sind Bewohner aus dem Tagesablauf (ragdoll.js), die beim Aufbau
   Name, Kleidung, Arbeitsort und Plan bekommen (CIT_HOOKS). Während der Arbeit
   stehen sie vor ihrer Tür (Stammplatz); ist jemand drinnen, klopft Alexander an.
   Jo steht auf der Bühne im Ballsaal, Ahrens ist über das Kapitänsmenü zu sprechen.
   GESPRÄCH: E öffnet ein Art-Deco-Feld mit Auswahl (Zahl oder Klick). Was sie sagen,
   hängt vom Ruf ab (Ö), von der Beziehung und von früheren Antworten. Die Sätze
   laufen über die Sprechblase (#say), also sprechen die Stimmen aus voice.js mit.
   AUFGABEN laufen über aufgaben.js (Kontor, Verfolgen, Rauten), neue Zielarten
   kommen über AQ.prog/AQ.check dazu. Belohnungen: Lumen, Ruf, Andenken im
   Inventar, Zeitungsmeldungen, Freischaltungen.
   BEZIEHUNG je Figur (−100 Feindschaft … +100 Freundschaft) liegt in KT.s.nf und
   wird mit dem Kontor gespeichert. Ruf-Buch (Ö): Abschnitt „Bekanntschaften“.
   Stadtkarte (Y): Ebene „Bekanntschaften“ mit allen Figuren.
   Keine neuen Shader, keine neuen Modelle: nur HTML und vorhandene Figuren.
   ===================================================================== */
import { $, shared, T, camera } from './core.js';
import { player } from './player.js';
import { playing, paused, isTouch, tryLock } from './input.js';
import { toast } from './boat.js';
import { DINE, VENUES } from './venues.js';
import { INTERACT } from './music.js';
import { citizens, CIT_HOOKS, citizenGoal, citizenDoing } from './ragdoll.js';
import { setAct } from './serpentine.js';
import { SHOPS, SHOP_KINDS } from './shops.js';
import { ORTE } from './orte.js';
import { GALA } from './gala.js';
import { IMP, IMP_CAPT_HOOK } from './imperial.js';
import { PH } from './penthouse.js';
import { BOSS } from './anfuehrer.js';
import { VERST, reveal } from './verstecke.js';
import { INV_SHOP } from './inventar.js';
import { RUF, rufAdd, rufGet, rufWesen, rufTitle } from './ruf.js';
import { KARTE } from './karte.js';
import { AQ, addQuest, finishQuest, progress, placeOf } from './aufgaben.js';
import { KT, BIZ, PROJECTS, ktCash, ktChanged, ktOwns, fmM, esc, titleCase, clamp } from './kontor.js';

export const NF = { _v: new T.Vector3(), ready: false, open: false, cur: null, node: null, el: null, marks: [], tickT: 0, galaN: 0, helmT: 0, hint: false };
const nfPick = a => a[Math.floor(Math.random() * a.length)];

/* =====================================================================
   1) DIE FIGUREN
   ===================================================================== */
// cit: Bewohner aus dem Tagesablauf. near = Arbeitsort nahe diesem Punkt, plan = [Spielminute, Ort]
export const NF_FIG = {
  jo: { n: 'Josephine „Jo“ Lafleur', kurz: 'Josephine Lafleur', ini: 'J', rolle: 'Jazzsängerin im Grand Ballroom', ax: 'bew', fem: true, home: 'belmont',
    wo: 'Auf der Bühne im Ballsaal des Belmont', lab: ['Unbekannt', 'Kühl', 'Bekannt', 'Vertraut', 'Gute Freundin', 'Engste Vertraute'] },
  brenner: { n: 'Konstantin Brenner', kurz: 'Polizeipräsident Brenner', ini: 'B', rolle: 'Polizeipräsident von Vespera', ax: 'buerger', home: 'cit',
    look: { kind: 'police', col: [0.1, 0.12, 0.22], sc: 1.06, fem: false }, near: [-160, 160], work: 'Polizeipräsidium', act: 0.2,
    plan: [[0, 'work'], [180, 'bar'], [260, 'home'], [600, 'work'], [1290, 'eat'], [1350, 'work']], lab: ['Unbekannt', 'Misstrauisch', 'Sachlich', 'Verbündeter', 'Vertrauter', 'Waffenbruder'] },
  hallstein: { n: 'Viktor von Hallstein', kurz: 'Viktor von Hallstein', ini: 'H', rolle: 'Reeder und Industrieller · Ihr Rivale', ax: 'elite', home: 'cit', rel0: -20,
    look: { kind: 'dbl', col: [0.17, 0.16, 0.19], sc: 1.04, fem: false }, near: [300, -120], work: 'Kontor Hallstein & Söhne', act: 5.3,
    plan: [[0, 'bar'], [120, 'home'], [660, 'work'], [1200, 'eat'], [1290, 'bar']], lab: ['Unbekannt', 'Erzfeind', 'Rivale', 'Kühler Respekt', 'Achtung', 'Verbündeter'], rival: true },
  margot: { n: 'Margot Wendt', kurz: 'Margot Wendt', ini: 'M', rolle: 'Reporterin des Vespera-Kurier', ax: 'presse', fem: true, home: 'cit',
    look: { kind: 'lady', col: [0.1, 0.3, 0.32], sc: 0.97, fem: true }, near: [160, 230], work: 'Redaktion des Vespera-Kurier', act: 28.4,
    plan: [[0, 'work'], [150, 'bar'], [240, 'home'], [690, 'eat'], [750, 'work']], lab: ['Unbekannt', 'Gegnerin', 'Kritisch', 'Neugierig', 'Verbündete', 'Freundin'] },
  kroeger: { n: 'Hannes Kröger', kurz: 'Hannes Kröger', ini: 'K', rolle: 'Vorarbeiter im Stahlwerk', ax: 'arbeiter', home: 'cit',
    look: { kind: 'braces', col: [0.32, 0.27, 0.21], sc: 1.08, fem: false }, factory: true, work: null, act: 38.3,
    plan: [[0, 'bar'], [150, 'home'], [600, 'work'], [1200, 'eat'], [1260, 'bar']], lab: ['Unbekannt', 'Feindselig', 'Misstrauisch', 'Bekannt', 'Kumpel', 'Einer von uns'] },
  ahrens: { n: 'Kapitän Leopold Ahrens', kurz: 'Kapitän Ahrens', ini: 'A', rolle: 'Kapitän der Aurora Imperial', ax: 'personal', home: 'imperial',
    wo: 'An Bord der Aurora Imperial (Kapitän ansprechen)', lab: ['Unbekannt', 'Verstimmt', 'Pflichtbewusst', 'Ergeben', 'Treuer Kapitän', 'Freund an Bord'] },
};
const NF_IDS = Object.keys(NF_FIG);
// welcher Bewohner (fester Index) die Rolle bekommt
const NF_CIT = { brenner: 7, hallstein: 29, margot: 53, kroeger: 81 };

/* ---------- Andenken (Inventar) ---------- */
const NF_ITEMS = {
  'nf:partitur': { n: 'Partitur „Polarnacht-Blues“', ic: 'buch', v: 0, t: 'Handgeschriebene Noten in einer abgegriffenen Mappe. Gehört Jo Lafleur.' },
  'nf:platte': { n: 'Schellackplatte „Alexanders Nacht“', ic: 'platte', v: 40, t: 'Jo Lafleurs Lied, aufgenommen im Belmont. Auf dem Etikett: „Für A., der zugehört hat. Jo.“', keep: true },
  'nf:marke': { n: 'Goldene Ehrenmarke der Polizei', ic: 'gold', v: 120, t: 'Verliehen von Polizeipräsident Brenner nach der Festnahme des Roten Kasimir. Nummer 001.', keep: true },
  'nf:titel': { n: 'Gerahmte Titelseite des Kuriers', ic: 'buch', v: 30, t: '„Der Mann, der Vespera baute“, von Margot Wendt. Hinter Glas, mit Goldrahmen.', keep: true },
  'nf:schicht': { n: 'Messingmarke der Schicht', ic: 'gold', v: 5, t: 'Die Stempelmarke von Hannes Kröger. „Ehrenmitglied der Nachtschicht“, eingeritzt mit dem Taschenmesser.', keep: true },
  'nf:muetze': { n: 'Kapitänsmütze der Aurora Imperial', ic: 'hut', v: 60, t: 'Weißer Bezug, goldene Kordel, das Sonnenfächer-Abzeichen der Aurora. Von Kapitän Ahrens.', keep: true },
  'nf:zigarre': { n: 'Hallsteins Zigarre', ic: 'zigarre', v: 8, t: 'Eine Havanna aus Viktor von Hallsteins Etui. Ein Friedensangebot, oder eine Herausforderung.', use: ['Rauchen', 'rauchen'] },
  'nf:brief': { n: 'Brief an Lotte Ahrens', ic: 'buch', v: 0, t: 'Versiegelt, in der sauberen Schrift eines Kapitäns. „An meine Tochter“.' },
};
try { Object.assign(INV_SHOP, NF_ITEMS); } catch (e) { /* ältere Fassung */ }

/* =====================================================================
   2) DIE GESCHICHTEN (je vier Aufgaben)
   need: Beziehung, ab der die Bitte kommt. g: Ziel (oder Funktion, die es baut).
   rw: Belohnung über aufgaben.js (Ruf-Gruppen, Lumen). nf: was danach geschieht.
   ===================================================================== */
const NF_BRASS = () => { const V = VENUES.find(v => /BRASS/.test(v.name || '')); if (V) return { x: V.x, y: V.F || 0.3, z: V.z, r: 9, ry: 4, ort: 'im Brass Lantern' }; return placeOf('kneipe'); };
const NF_CAFE = () => { const V = ORTE.cafe; return V ? { x: V.x, y: V.F || 0.3, z: V.z, r: 10, ry: 4, ort: 'im Café Kranich' } : placeOf('belmont'); };
const NF_ARC = {
  jo: [
    { title: 'Weiße Rosen für die Garderobe', need: -100,
      offer: 'Jeden Abend schickt mir jemand Nelken. Ich hasse Nelken. Weiße Rosen, Herr Alexander, so wie die an Ihrem Revers … dann singe ich heute nur für Sie.',
      g: { k: 'nfding', kind: 'blumen' }, rw: { rep: { elite: 1 } }, nf: { rel: 15, ruf: { bew: 1 } },
      done: 'Weiße Rosen! Sie haben zugehört. Das nächste Lied gehört Ihnen, Herr Alexander.' },
    { title: 'Die verlorene Partitur', need: 10,
      offer: 'Mein Arrangeur, der gute Sam, hat die Noten für mein neues Lied im Brass Lantern liegen lassen. Im Arbeiterviertel! In diesem Kleid komme ich da nicht hin. Aber Sie …',
      g: () => ({ k: 'nfhol', pt: NF_BRASS(), item: 'nf:partitur', pick: 'Der Wirt hatte die Mappe hinter der Theke. Partitur eingesteckt.' }), rw: { rep: { arbeiter: 1 } }, nf: { rel: 15 },
      done: 'Mein Blues! Wissen Sie was? Ich nenne ihn um. Er heißt ab heute „Alexanders Nacht“.' },
    { title: 'Ein Abend im Metropol', need: 25,
      offer: 'Sie kennen doch den Direktor vom Varieté Metropol. Ein Wort von Ihnen, und ich singe dort einmal vor vollem Haus. Nur ein einziges Mal, Herr Alexander.',
      g: { k: 'gehen', at: 'metropol' }, rw: { rep: { buerger: 2 } }, nf: { rel: 15, news: ['Jo Lafleur singt im Metropol', 'Auf Fürsprache von Herrn Alexander bekommt die Sängerin aus dem Grand Ballroom einen eigenen Abend im Varieté Metropol. Die Karten waren in einer Stunde vergriffen.'] },
      done: 'Er hat Ja gesagt? Ein ganzer Abend im Metropol! Ich weiß gar nicht, wie ich Ihnen danken soll.' },
    { title: 'Die große Gala', need: 40,
      offer: 'Wenn Sie wieder eine Gala im Ballsaal geben, Herr Alexander, dann singe ich zum Ehrenwalzer. Versprochen. Direktor Hartmann steht links vor der Bühne.',
      g: { k: 'gala' }, rw: { rep: { elite: 3 } }, nf: { rel: 20, item: 'nf:platte', ruf: { bew: 2 }, news: ['Jo Lafleur verzaubert die Gala', 'Zum Ehrenwalzer sang Josephine Lafleur „Alexanders Nacht“. Der Ballsaal tanzte bis in die Morgenstunden, die es am Pol nicht gibt.'] },
      done: 'Haben Sie gesehen, wie der Saal getanzt hat? Das war die schönste Nacht meines Lebens. Die Platte ist für Sie.' },
  ],
  brenner: [
    { title: 'Taschendiebe am Belmont-Platz', need: -100,
      offer: 'Meine Leute sind gut, Herr Alexander, aber nicht so schnell wie Sie. Ein Taschendieb treibt sich herum. Wenn Sie ihn erwischen, übergebe ich ihn persönlich dem Richter.',
      g: { k: 'gauner', stat: 'gefasst', n: 1, start: 'dieb' }, rw: { rep: { buerger: 2 } }, nf: { rel: 12 },
      done: 'Sauber gemacht. Der Bursche wird so bald keine Brieftasche mehr anfassen.' },
    { title: 'Die Bombe der Anarchisten', need: 10,
      offer: 'Ein Spitzel sagt, die Anarchisten wollen eine Bombe legen. Ich habe tapfere Männer, aber keinen, der eine Bombe in den Himmel werfen kann.',
      g: { k: 'gauner', stat: 'entschaerft', n: 1, start: 'bombe' }, rw: { rep: { buerger: 4 } }, nf: { rel: 15 },
      done: 'Ohne Sie hätten wir heute Abend Tote gezählt. Die Stadt steht in Ihrer Schuld. Ich auch.' },
    { title: 'Ein Versteck unter der Stadt', need: 25,
      offer: 'Wir haben einen Hinweis. Unter der Stadt treffen sich Kasimirs Leute. Sehen Sie sich das an, aber seien Sie vorsichtig. … Na gut. Sie müssen nicht vorsichtig sein.',
      g: () => nfVerstGoal(null), rw: { rep: { buerger: 3 } }, nf: { rel: 12, ruf: { unter: -3 } },
      done: 'Also stimmt der Hinweis. Ich schicke eine Streife hin. Gute Arbeit, Herr Alexander.' },
    { title: 'Der Rote Kasimir', need: 40,
      offer: 'Kasimir Roth. Der Rote Kasimir. Solange er frei herumläuft, schläft Vespera nicht ruhig. Bringen Sie ihn mir, Herr Alexander.',
      g: { k: 'boss' }, rw: { rep: { buerger: 5 } }, nf: { rel: 20, item: 'nf:marke', news: ['Polizeipräsident ehrt Alexander', 'Nach der Festnahme des Roten Kasimir verlieh Polizeipräsident Konstantin Brenner dem Gründer der Stadt die erste Goldene Ehrenmarke der Polizei von Vespera.'] },
      done: 'Kasimir sitzt. Ich habe dreißig Jahre Dienst hinter mir, aber das hier vergesse ich nie. Nehmen Sie diese Marke. Es gibt nur eine.' },
  ],
  hallstein: [
    { title: 'Eine Wette unter Herren', need: -100,
      offer: 'Ich wette 2.500 Lumen, dass Sie nicht wagen, zweitausend Aktien der Nordlicht-Reederei zu kaufen. Diese Reederei, mein Lieber, wird bald meine sein.',
      g: () => ({ k: 'aktie', c: 'nord', n: ((KT.s.shares && KT.s.shares.nord) || 0) + 2000 }), rw: { cash: 2500 }, nf: { rel: 12 },
      done: 'Hm. Sie haben Nerven, Alexander. Hier sind Ihre 2.500 Lumen. Genießen Sie sie, solange es noch geht.' },
    { title: 'Wettlauf um ein Geschäft', need: -15,
      offer: 'Nur damit Sie es wissen: Morgen kaufe ich {biz}. Man soll in Vespera auch mal bei einem anderen Herrn einkehren als bei Ihnen.',
      g: () => ({ k: 'besitz', id: nfFreeBiz() }), rw: { rep: { elite: 2 } }, nf: { rel: 10 },
      done: 'Sie haben es mir vor der Nase weggeschnappt. Gut gespielt, Alexander. Ich gebe zu, das hat mir Spaß gemacht.' },
    { title: 'Der Empfang im Metropol', need: -5,
      offer: 'Ich gebe einen Empfang im Varieté Metropol. Die halbe Gesellschaft kommt. Wenn Sie den Mut haben, erscheinen Sie. Die Leute sollen sehen, wer der bessere Gastgeber ist.',
      g: { k: 'gehen', at: 'metropol' }, rw: { rep: { elite: 3 } }, nf: { rel: 8, item: 'nf:zigarre' },
      done: 'Sie sind gekommen. Und alle haben nur auf Sie geschaut, nicht auf mich. Das verzeihe ich Ihnen nie. Eine Zigarre?' },
    { title: 'Die große Stiftung', need: 5,
      offer: 'Ich habe dem Waisenhaus gerade dreißigtausend Lumen gestiftet. Die Zeitungen nennen mich großzügig. Ich bin gespannt, was der Gründer der Stadt dagegen setzt: {proj}?',
      g: () => ({ k: 'stift', id: nfFreeProj() }), rw: { rep: { buerger: 3 } }, nf: { rel: 10, final: true, news: ['Wettstreit der Wohltäter', 'Erst Hallstein, dann Alexander: Die beiden reichsten Männer der Stadt überbieten sich mit Stiftungen. Die Stadt freut sich.'] },
      done: 'Das also ist Ihre Antwort. Ich muss zugeben … Sie spielen in einer anderen Liga. Wir sollten reden, Alexander. Unter vier Augen.' },
  ],
  margot: [
    { title: 'Das große Interview', need: -100, interview: true,
      offer: 'Herr Alexander! Margot Wendt, Vespera-Kurier. Drei Fragen, nur drei. Die ganze Stadt will wissen, wer der Mann hinter dem Belmont ist.',
      g: { k: 'nftalk' }, rw: {}, nf: { rel: 12, ruf: { presse: 3 } },
      done: 'Danke, Herr Alexander. Das wird morgen auf Seite eins stehen. Ich verspreche: kein Wort verdreht.' },
    { title: 'Ein Foto über der Krone', need: 10,
      offer: 'Mein Fotograf steht auf dem Dach vom Hotel Astoria. Wenn Sie hoch über der Krone des Belmont fliegen, haben wir das Bild des Jahres. Bitte, Herr Alexander!',
      g: { k: 'flug' }, rw: {}, nf: { rel: 12, ruf: { presse: 4, bew: 2 }, news: ['Der fliegende Gründer', 'Unser Fotograf hielt den Augenblick fest: Herr Alexander schwebt hoch über der goldenen Krone des Belmont. Vespera hält den Atem an.', true] },
      done: 'Wir haben es! Ein Bild, von dem die Welt reden wird. Morgen auf der Titelseite.' },
    { title: 'Die Spur der Druckerei', need: 25,
      offer: 'Die Flugblätter der Anarchisten riechen nach frischer Druckerschwärze. Ich weiß, wo sie gedruckt werden, ich traue mich nur nicht allein hin. Sehen Sie es sich an, und ich schreibe darüber.',
      g: () => nfVerstGoal('druckerei'), rw: { rep: { buerger: 2 } }, nf: { rel: 12, ruf: { presse: 3, unter: -2 } },
      done: 'Sie waren da! Die Polizei hat mir nie geglaubt. Das wird eine Geschichte, Herr Alexander.' },
    { title: 'Die Titelseite', need: 40,
      offer: 'Mein Chefredakteur will eine große Titelgeschichte über Sie. Aber nur, wenn die Stadt gut über Sie spricht. Zeigen Sie es ihnen: Stiftungen, gute Taten, ehrliche Worte.',
      g: { k: 'ruf', ax: 'presse', n: 65 }, rw: {}, nf: { rel: 20, item: 'nf:titel', ruf: { bew: 2 }, news: ['Der Mann, der Vespera baute', 'Ein Porträt von Margot Wendt: Wie ein Mann einen Krater im ewigen Eis fand und darin eine Stadt aus Licht, Jazz und Gold baute. Und warum ganz Vespera ihm vertraut.'] },
      done: 'Die Titelseite gehört Ihnen. Ich habe Ihnen einen Abzug rahmen lassen. Und Herr Alexander … danke für das Vertrauen.' },
  ],
  kroeger: [
    { title: 'Kohle für die Nachtschicht', need: -100,
      offer: 'Herr Alexander. Die Öfen in den Wohnungen am Kneipenplatz sind kalt. Zehn Sack Kohle, abzuliefern am Kneipenplatz, und die Nachtschicht kann ruhig schlafen.',
      g: { k: 'ware', g: 'kohle', n: 10, to: 'kneipe' }, rw: { rep: { arbeiter: 3 } }, nf: { rel: 12 },
      done: 'Warme Öfen. Das hat noch keiner von da oben für uns gemacht. Danke, Herr Alexander.' },
    { title: 'Das Ersatzteil', need: 5,
      offer: 'Die Dampfmaschine der Werkstatt am Kneipenplatz steht still. Das Ersatzteil liegt in einer Kiste am Güterkai, die wiegt so viel wie ein Ochse. Für Sie ist das nichts, oder?',
      g: { k: 'kiste', kind: 'crate', from: 'kai', to: 'kneipe' }, rw: { rep: { arbeiter: 2 } }, nf: { rel: 12 },
      done: 'Da ist sie! Durch die Luft geflogen, die Jungs haben die Mützen fallen lassen. Die Maschine läuft heute Abend wieder.' },
    { title: 'Gerechter Lohn', need: 20,
      offer: 'Ich sag es ehrlich: Die Löhne reichen kaum für Brot und Kohle. Wenn Sie in einem Ihrer Betriebe großzügig zahlen, sehen die anderen Herren, dass es geht.',
      g: { k: 'lohn' }, rw: { rep: { arbeiter: 5 } }, nf: { rel: 15, ruf: { unter: -3 } },
      done: 'Großzügige Löhne! Das spricht sich herum bis ins letzte Hinterhaus. Kasimirs Leute haben heute Abend weniger Zuhörer.' },
    { title: 'Ein Fest am Kneipenplatz', need: 35,
      offer: 'Am Samstag ist Schichtfest. Fünfzehn Fass Bier am Kneipenplatz, und das ganze Viertel stößt auf Sie an. So einen Abend hat es hier noch nie gegeben.',
      g: { k: 'ware', g: 'bier', n: 15, to: 'kneipe' }, rw: { rep: { arbeiter: 6 } }, nf: { rel: 20, item: 'nf:schicht', ruf: { unter: -4 }, news: ['Schichtfest am Kneipenplatz', 'Fünfzehn Fass Bier, ein Klavier auf dem Pflaster und ein Ehrengast: Herr Alexander feierte mit der Nachtschicht des Stahlwerks bis in die frühen Stunden.'] },
      done: 'Prost, Herr Alexander! Hier, meine Stempelmarke. Ab heute gehören Sie zur Nachtschicht.' },
  ],
  ahrens: [
    { title: 'Ersatzteile für die Motoren', need: -100,
      offer: 'Sir, die Steuerbordmotoren klingen nicht gut. Vier Kisten Maschinenteile, abzugeben am Frachtbüro des Luftschiffhafens, und sie schnurren wieder wie am ersten Tag.',
      g: { k: 'ware', g: 'maschinen', n: 4, to: 'luft' }, rw: {}, nf: { rel: 12, ruf: { personal: 2 } },
      done: 'Die Mechaniker sind schon dabei, Sir. Hören Sie? Wie ein Kätzchen.' },
    { title: 'Ein Brief für Lotte', need: 10,
      offer: 'Sir, darf ich um einen persönlichen Gefallen bitten? Meine Tochter Lotte bedient im Café Kranich. Ich komme nie vom Schiff. Würden Sie ihr diesen Brief bringen?',
      g: () => ({ k: 'nfhol', pt: { ...NF_CAFE(), ort: 'Lotte im Café Kranich' }, item: 'nf:brief', give: true, who: 'Lotte Ahrens', pick: 'Ein Brief von Papa? Oh, danke, Herr Alexander! Sagen Sie ihm, ich schreibe zurück.' }), rw: {}, nf: { rel: 15, ruf: { personal: 2 } },
      done: 'Sie hat sich gefreut? … Danke, Sir. Das bedeutet mir mehr, als ich sagen kann.' },
    { title: 'Selbst am Steuer', need: 25,
      offer: 'Sir, wenn ich so frei sein darf: Sie sollten Ihr Schiff einmal richtig steuern. Nicht nur einen Augenblick. Eine Minute am Ruder, dann kennen Sie sie.',
      g: { k: 'helm', t: 60 }, rw: {}, nf: { rel: 12 },
      done: 'Eine ruhige Hand, Sir. Die Aurora mag Sie.' },
    { title: 'Die Ehrenrunde', need: 40,
      offer: 'Eine Tradition der alten Luftschiffer, Sir: Ein Eigner fährt einmal eine Ehrenrunde über seinen Heimathafen. Steuern Sie die Aurora selbst über den Belmont.',
      g: { k: 'helm', t: 5, near: true }, rw: {}, nf: { rel: 20, item: 'nf:muetze', ruf: { personal: 4, bew: 2 }, news: ['Ehrenrunde über dem Belmont', 'Mit Herrn Alexander am Ruder zog die Aurora Imperial in der Nacht eine Ehrenrunde über die goldene Krone des Belmont. Die Gäste im Ballsaal traten an die Fenster.', true] },
      done: 'Willkommen in der Bruderschaft der Luftschiffer, Sir. Diese Mütze hat mein Lehrmeister getragen. Jetzt gehört sie Ihnen.' },
  ],
};

/* =====================================================================
   3) GESPRÄCHSTHEMEN (verzweigt, je nach Ruf, Beziehung und Antworten)
   when(S): ob das Thema da ist. say: Satz oder Funktion. opts: Antworten mit Wirkung
   (rel, ruf, cash, flag) und Antwortsatz; jede Wirkung zählt nur einmal je Thema.
   ===================================================================== */
const NF_TOPICS = {
  jo: [
    { id: 'herkunft', t: 'Wie sind Sie nach Vespera gekommen?', say: 'Mit einem Koffer, einem Kleid und dem letzten Luftschiff aus Chicago. Man hat mir gesagt, am Nordpol gibt es eine Stadt aus Gold. Man hat nicht gelogen.',
      opts: [{ t: 'Willkommen in Vespera, Jo.', rel: 4, say: 'Jo. So nennen mich nur Freunde. Na gut: Sie dürfen.' }, { t: 'Und? Bereut?', rel: 2, say: 'Keine Sekunde. Hier hört man mir zu. In Chicago hat man nur geredet.' }] },
    { id: 'lied', t: 'Singen Sie etwas für mich?', when: S => S.rel >= 15, say: '♪ Und die Nacht hört niemals auf, und das Gold in deinen Augen … ♪ Das war für Sie, Herr Alexander.', opts: [{ t: 'Wunderschön.', rel: 3, ruf: { bew: 1 }, say: 'Psst. Nicht so laut, sonst wollen es alle hören.' }, { t: 'Noch eines!', rel: 1, say: 'Später. Eine Dame muss sich rarmachen.' }] },
    { id: 'furcht', t: 'Was erzählt man sich im Ballsaal über mich?', say: S => rufWesen() === 'gef' ? 'Man flüstert, man solle Ihnen besser nicht widersprechen. Ich finde, Sie haben ein freundliches Gesicht. Zeigen Sie es öfter.' : rufGet('elite') >= 60 ? `Man nennt Sie „${rufTitle()}“. Die Damen fragen mich, ob Sie tanzen.` : 'Man rätselt. Ein Mann, der fliegen kann und trotzdem allein an der Bar steht.',
      opts: [{ t: 'Und? Tanze ich?', rel: 3, say: 'Das finden wir heraus, wenn die Band den nächsten Walzer spielt.' }, { t: 'Das Gerede interessiert mich nicht.', rel: -1, say: 'Natürlich nicht. Deshalb fragen Sie ja.' }] },
  ],
  brenner: [
    { id: 'lage', t: 'Wie steht es um die Stadt?', say: () => rufGet('unter') >= 55 ? 'Schlecht, ehrlich gesagt. Flugblätter in jeder Gasse, der Untergrund wächst. Kasimir findet jeden Tag neue Leute.' : BOSS.st === 'gefasst' ? 'Kasimir sitzt, die Gassen sind ruhig. So ruhig war es lange nicht.' : 'Ruhig, bis auf Taschendiebe und die üblichen Hitzköpfe. Aber Kasimir ist noch da draußen.' },
    { id: 'wagen', t: 'Was brauchen Ihre Männer?', when: S => S.rel >= 0, say: 'Mit Verlaub: neue Wagen. Unsere alten Streifenwagen springen bei der Kälte nicht an, die Gauner fahren uns davon.',
      opts: [{ t: 'Ich stifte neue Wagen. (5.000 Lumen)', rel: 8, cash: -5000, ruf: { buerger: 2 }, say: 'Fünf neue Wagen! Das spricht sich bei den Männern herum, Herr Alexander.' }, { t: 'Das muss die Stadt bezahlen.', rel: -3, say: 'Natürlich. Der Stadtrat tagt ja nur alle drei Monate.' }] },
    { id: 'kraefte', t: 'Stören Sie meine Kräfte bei Ihrer Arbeit?', say: () => rufGet('furcht') >= 55 ? 'Offen gesagt: ja. Die Leute auf der Straße haben inzwischen mehr Angst vor Ihnen als vor Kasimir. Das macht mir Sorgen.' : 'Ganz im Gegenteil. Wenn ein Räuber Sie sieht, ergibt er sich meistens von selbst.',
      opts: [{ t: 'Ich werde behutsamer sein.', rel: 4, ruf: { furcht: -2 }, say: 'Mehr verlange ich nicht. Danke.' }, { t: 'Furcht hält die Gauner fern.', rel: -3, ruf: { furcht: 1 }, say: 'Und die anständigen Leute auch, Herr Alexander.' }] },
  ],
  hallstein: [
    { id: 'stadt', t: 'Was halten Sie von Vespera?', say: 'Eine Stadt, die einem einzigen Mann gehört. Bewundernswert. Und gefährlich.',
      opts: [{ t: 'Sie gehört allen, die hier leben.', rel: 4, ruf: { buerger: 1 }, say: 'Das sagen Sie so schön. Aber die Grundbücher sagen etwas anderes.' }, { t: 'Sie gehört mir. Gewöhnen Sie sich daran.', rel: -4, ruf: { furcht: 1 }, say: 'Ich gewöhne mich an nichts, Alexander. Das ist mein Geheimnis.' }] },
    { id: 'glas', t: 'Trinken wir ein Glas zusammen?', say: 'Nur, wenn Sie bezahlen. Sie haben ja genug.',
      opts: [{ t: 'Selbstverständlich. (50 Lumen)', rel: 3, cash: -50, say: 'Champagner, 1911er. Sie haben Geschmack, das muss man Ihnen lassen.' }, { t: 'Diesmal zahlen Sie, Viktor.', rel: 1, say: 'Ha! Der Erste, der mich je eingeladen hat, auf meine Kosten. Gut.' }] },
    { id: 'elite', t: 'Wie steht die Gesellschaft zu uns beiden?', say: () => rufGet('elite') >= 65 ? 'Man liegt Ihnen zu Füßen. Ich gebe zu, das ärgert mich.' : rufGet('elite') < 35 ? 'Man meidet Sie in den Salons. Ich dagegen bin zu jedem Diner eingeladen. Wer hätte das gedacht.' : 'Halb hier, halb da. Die Salons warten ab, wer von uns beiden zuerst stolpert.' },
  ],
  margot: [
    { id: 'neu', t: 'Was gibt es Neues in der Stadt?', say: () => nfPick(['Im Hafen wird gemunkelt, ein Luftschiff aus Paris bringt einen Grafen mit drei Koffern voller Kaviar.', 'Die Straßenbahner wollen streiken, wenn die Kohle nicht billiger wird. Das wissen Sie aber nicht von mir.', 'Man sagt, im Belmont hat ein Gast seine Zimmerrechnung mit einem Diamanten bezahlt.', BOSS.st === 'gefasst' ? 'Kasimir sitzt, aber seine Leute drucken weiter. Irgendwer gibt ihnen Papier.' : 'Kasimir soll wieder in der Stadt sein. Die Polizei schweigt, also stimmt es.']) },
    { id: 'gut', t: 'Schreiben Sie nichts Schlechtes über mich.', say: () => rufGet('presse') < 35 ? 'Meine Kollegen schreiben nicht freundlich über Sie, Herr Alexander. Ich schreibe nur, was stimmt.' : 'Ich schreibe, was stimmt. Zurzeit stimmt meistens Gutes.',
      opts: [{ t: 'Mehr verlange ich nicht.', rel: 4, ruf: { presse: 1 }, say: 'Sehen Sie. Wir verstehen uns.' }, { t: 'Ich könnte den Kurier auch kaufen.', rel: -6, ruf: { presse: -2, furcht: 1 }, say: 'Könnten Sie. Dann schreibe ich eben für ein anderes Blatt. Über Sie.' }] },
    { id: 'kristall', t: 'Fragen Sie nie nach dem Kristall?', when: S => S.rel >= 20, say: 'Jeden Tag. Aber ich weiß, dass Sie nicht antworten. Also frage ich nur: Ist er gefährlich?',
      opts: [{ t: 'Nur für den, der ihn zuerst berührt hat.', rel: 3, say: 'Und das waren Sie. Gut. Dann schlafe ich heute ruhiger.' }, { t: 'Kein Kommentar, Fräulein Wendt.', rel: 1, say: 'Natürlich nicht. Aber ich frage morgen wieder.' }] },
  ],
  kroeger: [
    { id: 'viertel', t: 'Wie ist die Stimmung im Viertel?', say: () => rufGet('unter') >= 55 ? 'Kasimirs Leute verteilen Flugblätter vor dem Werkstor. Manche Jungs hören zu. Ich nicht. Noch nicht.' : rufGet('arbeiter') >= 65 ? 'Gut. Die Leute reden gut über Sie. Das ist neu, ehrlich gesagt.' : 'Müde. Die Schichten sind lang, und das Bier ist teuer.' },
    { id: 'kasimir', t: 'Was halten Sie vom Roten Kasimir?', say: 'Ein Großmaul mit Dynamit. Redet von Gerechtigkeit und sprengt unsere eigenen Straßen.',
      opts: [{ t: 'Ich hole ihn mir.', rel: 2, ruf: { bew: 1 }, say: 'Tun Sie das. Aber vergessen Sie nicht, warum ihm die Leute zuhören.' }, { t: 'Vielleicht hat er in manchem recht.', rel: 5, ruf: { arbeiter: 1 }, say: 'Na sieh mal einer an. Das hätte ich von Ihnen nicht erwartet.' }] },
    { id: 'bier', t: 'Ein Bier mit Ihnen, Hannes?', when: S => S.rel >= 15, say: 'Mit Ihnen? Im Brass Lantern? Na gut. Aber Sie trinken aus dem Krug wie alle.',
      opts: [{ t: 'Prost, Hannes.', rel: 4, ruf: { arbeiter: 1 }, say: 'Prost, Alexander. Hätt ich nie gedacht, dass ich das mal sage.' }] },
  ],
  ahrens: [
    { id: 'frueher', t: 'Erzählen Sie von früher, Kapitän.', say: 'Zwanzig Jahre auf Zeppelinen, Sir. Über die Anden, über die Sahara, einmal bis Tokio. Aber nie habe ich ein Licht gesehen wie das Nordlicht über Vespera.',
      opts: [{ t: 'Bleiben Sie bei mir, Kapitän.', rel: 4, ruf: { personal: 1 }, say: 'Solange die Aurora fliegt, Sir. Und darüber hinaus.' }, { t: 'Erzählen Sie mehr.', rel: 2, say: 'Über der Sahara hat uns einmal ein Sandsturm drei Tage festgehalten. Wir haben Karten gespielt und Champagner getrunken. Es war die schönste Panne meines Lebens.' }] },
    { id: 'crew', t: 'Ist die Mannschaft zufrieden?', say: () => rufGet('personal') >= 60 ? 'Sehr, Sir. Man reißt sich um einen Platz auf der Aurora.' : rufGet('personal') < 35 ? 'Ehrlich gesagt, Sir: Die Leute murren. Die Heuer ist knapp, und man hört Geschichten von Ihrer Strenge.' : 'Man ist zufrieden, Sir. Ein paar Worte von Ihnen täten trotzdem gut.',
      opts: [{ t: 'Doppelte Heuer diesen Monat. (3.000 Lumen)', rel: 6, cash: -3000, ruf: { personal: 3 }, say: 'Das werden die Leute nicht vergessen, Sir.' }, { t: 'Sie sollen ihre Arbeit tun.', rel: -2, ruf: { personal: -1 }, say: 'Sehr wohl, Sir.' }] },
  ],
};
const NF_INTRO = {
  jo: 'Oh! Herr Alexander höchstpersönlich. Josephine Lafleur, aber alle sagen Jo. Gefällt Ihnen die Musik?',
  brenner: 'Herr Alexander. Konstantin Brenner, Polizeipräsident. Wir sind uns nie richtig vorgestellt worden, obwohl Sie mir die halbe Arbeit abnehmen.',
  hallstein: 'Ah. Der berühmte Gründer. Viktor von Hallstein, Reederei, Stahl, Glas. Man sagt, wir seien die beiden reichsten Männer der Stadt. Man irrt sich nur in der Reihenfolge.',
  margot: 'Herr Alexander! Margot Wendt, Vespera-Kurier. Nein, ich will keine Unterschrift. Ich will eine Geschichte.',
  kroeger: 'Hannes Kröger. Vorarbeiter im Stahlwerk. Sie sind also der Herr von oben. Hier unten sieht man Sie selten.',
  ahrens: 'Kapitän Leopold Ahrens, Sir, zu Ihren Diensten. Ich führe Ihr Schiff seit dem ersten Tag. Wir hatten nur nie Zeit für ein Gespräch.',
};
function nfGreet(F, S) {
  const r = S.rel, wes = rufWesen(), v = rufGet(F.ax);
  const L = {
    jo: r < 10 ? 'Herr Alexander! Bleiben Sie für das nächste Lied?' : r < 40 ? 'Da ist ja mein Lieblingszuhörer. Die Band hat eben nach Ihnen gefragt.' : 'Alexander. Ich habe gehofft, dass Sie heute kommen.',
    brenner: wes === 'gef' && r < 30 ? 'Herr Alexander. Ruhig Blut, bitte. Meine Männer werden nervös, wenn Sie so nah sind.' : r < 20 ? 'Herr Alexander. Was kann die Polizei für Sie tun?' : 'Alexander! Gut, dass Sie da sind. Ich wollte Sie ohnehin sprechen.',
    hallstein: r < -25 ? 'Ah, der Gründer. Kommen Sie, um mir noch etwas wegzukaufen?' : r < 10 ? 'Alexander. Ein schöner Abend für Geschäfte, finden Sie nicht?' : r < 50 ? 'Alexander, mein liebster Rivale. Was führt Sie zu mir?' : 'Alexander, mein Freund. Und immer noch mein liebster Rivale.',
    margot: v < 35 && r < 30 ? 'Herr Alexander. Die Stadt redet nicht gut über Sie. Wollen Sie etwas klarstellen?' : r < 25 ? 'Herr Alexander! Haben Sie fünf Minuten für die Presse?' : 'Alexander! Sie kommen genau richtig, ich habe eine Spur.',
    kroeger: v < 35 && r < 30 ? 'Herr Alexander. Hier unten sind Sie nicht gerade beliebt. Und die Löhne sieht man auch selten.' : r < 25 ? 'Herr Alexander. Was führt Sie ins Viertel?' : 'Alexander! Komm, setz dich zu uns. Na gut, Sie. Setzen Sie sich zu uns.',
    ahrens: v < 35 ? 'Sir. Die Mannschaft ist auf ihren Posten. Wie befohlen.' : r < 30 ? 'Sir! Die Aurora ist bereit, wie immer.' : 'Sir. Schön, Sie an Bord zu haben. Eine Tasse Tee auf der Brücke?',
  };
  return L[F.id];
}
const NF_LATER = { jo: 'Ich bin hier. Jeden Abend, bis die Band nach Hause geht.', brenner: 'Natürlich. Die Gauner warten nicht, aber ich schon.', hallstein: 'Feigheit steht Ihnen nicht, Alexander. Aber bitte.', margot: 'Ich laufe Ihnen nicht weg. Leider laufen mir die Geschichten weg.', kroeger: 'Schon recht. Wir sind es gewohnt zu warten.', ahrens: 'Selbstverständlich, Sir.' };
const NF_BYE = { jo: ['Bis später, Herr Alexander.', 'Kommen Sie wieder, wenn die Band spielt.'], brenner: ['Herr Alexander.', 'Passen Sie auf sich auf. Na ja, Sie wissen schon.'], hallstein: ['Bis zum nächsten Geschäft, Alexander.', 'Wir sehen uns. Sicher früher, als Ihnen lieb ist.'], margot: ['Bis bald, Herr Alexander!', 'Und lesen Sie morgen den Kurier!'], kroeger: ['Glück auf, Herr Alexander.', 'Bis dann.'], ahrens: ['Sir.', 'Gute Nacht, Sir.'] };
const NF_WAIT = { jo: 'Ich zähle auf Sie, Herr Alexander.', brenner: 'Ich warte auf Ihre Meldung.', hallstein: 'Nun? Ich warte, Alexander.', margot: 'Ich halte die Seite frei.', kroeger: 'Die Jungs warten.', ahrens: 'Ganz wie Sie meinen, Sir.' };
const NF_NOTYET = {
  jo: 'Eine Bitte hätte ich schon … aber dafür kennen wir uns noch nicht gut genug. Kommen Sie öfter in den Ballsaal.',
  brenner: 'Es gäbe da etwas. Aber erst muss ich wissen, dass ich mich auf Sie verlassen kann.',
  hallstein: 'Mit Ihnen mache ich vorerst keine Geschäfte, Alexander. Erst müssen Sie meinen Respekt verdienen.',
  margot: 'Ich habe eine Geschichte … aber die erzähle ich nur Leuten, denen ich traue.',
  kroeger: 'Erst wenn ich weiß, dass Sie es ernst meinen mit dem Viertel.',
  ahrens: 'Später vielleicht, Sir. Zuerst die Pflicht.',
};
const NF_DONE_ALL = { jo: 'Sie haben mir mehr geschenkt, als ich je erwartet habe. Ab jetzt singe ich jeden Abend ein Lied nur für Sie.', brenner: 'Diese Stadt war nie sicherer. Und das ist auch Ihr Verdienst, Alexander.', hallstein: 'Wir haben unser Duell ausgefochten. Was jetzt kommt, wird sich zeigen.', margot: 'Sie sind meine beste Geschichte, Alexander. Und ich schreibe weiter über Sie.', kroeger: 'Du gehörst jetzt zu uns, Alexander. Die ganze Nachtschicht weiß das.', ahrens: 'Die Aurora und ich, Sir: Wir fliegen, wohin Sie wollen.' };

/* =====================================================================
   4) ZUSTAND (gespeichert mit dem Kontor in KT.s.nf)
   ===================================================================== */
function nfS(id) {
  const s = KT.s; if (!s.nf || typeof s.nf !== 'object') s.nf = {};
  if (!s.nf[id]) s.nf[id] = { rel: NF_FIG[id].rel0 || 0, st: 0, act: null, met: false, f: {}, talks: 0 };
  return s.nf[id];
}
export function nfRelLabel(id) {
  const F = NF_FIG[id], S = nfS(id); if (!S.met) return F.lab[0];
  const r = S.rel, i = r <= -55 ? 1 : r <= -15 ? 2 : r < 20 ? 3 : r < 55 ? 4 : 5;
  return F.lab[i];
}
function nfRel(id, d, why) {
  if (!d) return;
  const S = nfS(id), r0 = S.rel; S.rel = clamp(S.rel + d, -100, 100);
  const l0 = NF.lastLab && NF.lastLab[id], l1 = nfRelLabel(id);
  if (NF.open && NF.cur === NF_FIG[id]) nfRenderHead();
  if (Math.round(S.rel) !== Math.round(r0)) nfFloat(`${NF_FIG[id].kurz}: ${d > 0 ? '+' : '−'}${Math.abs(d)} ${NF_FIG[id].rival && d > 0 ? 'Respekt' : d > 0 ? 'Zuneigung' : 'Abneigung'}${why ? ' · ' + why : ''}`, d > 0);
  if (l0 && l0 !== l1) toast(`${NF_FIG[id].kurz} · Beziehung jetzt: ${l1}`);
  (NF.lastLab ||= {})[id] = l1;
  ktChanged('nf');
}
function nfEffects(id, o, once) {
  const S = nfS(id);
  if (once) { if (S.f[once]) { return false; } S.f[once] = 1; }
  if (o.cash) { if (o.cash < 0 && KT.s.cash < -o.cash) { toast('Dafür reicht das Geld nicht'); return false; } ktCash(o.cash, (o.cash < 0 ? 'Ausgabe: ' : '') + NF_FIG[id].kurz); }
  if (o.rel) nfRel(id, o.rel);
  if (o.ruf) { try { rufAdd(o.ruf, 'Gespräch mit ' + NF_FIG[id].kurz, { key: 'nf:' + id + ':' + (once || '') }); } catch (e) { /* Ruf noch nicht bereit */ } }
  if (o.item) nfGiveItem(o.item);
  return true;
}
function nfGiveItem(k) {
  const D = NF_ITEMS[k]; if (!D) return;
  KT.s.items.push({ k, n: D.n, from: 'Geschenk', d: KT.s.day });
  toast(`${D.n} · ins Inventar (Umschalt+I)`); ktChanged('inv');
}
const nfHas = k => KT.s.items.findIndex(i => i.k === k);
function nfNews(n, fig) {
  if (!n) return;
  try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel: n[0], text: n[1], rubrik: 'Gesellschaft', prio: 7, foto: !!n[2], quelle: 'nebenfiguren' } })); } catch (e) { /* alt */ }
}

/* =====================================================================
   5) WO SIND SIE?
   ===================================================================== */
function nfCit(id) { const F = NF_FIG[id]; return F.ci != null ? citizens[F.ci] : null; }
function nfJoPos() { const a = GALA.singer; const k = a && a.k6; return k ? { x: k[0], y: k[1], z: k[2] } : { x: 0, y: (GALA.S0 || 1.3), z: -40.6 }; }
export function nfPos(id) {
  const F = NF_FIG[id];
  if (F.home === 'belmont') { const p = nfJoPos(); return { ...p, ort: 'Bühne im Ballsaal des Belmont', doing: 'singt im Ballsaal' }; }
  if (F.home === 'imperial') { const g = IMP.g; return g ? { x: g.position.x, y: g.position.y, z: g.position.z, ort: 'An Bord der Aurora Imperial', doing: 'auf der Brücke der Aurora' } : null; }
  const c = nfCit(id); if (!c) return null;
  let doing = ''; try { doing = citizenDoing(c); } catch (e) { doing = ''; }
  if (c.ped.a && c.ped.a.on) { const e = c.ped.a.m.elements; return { x: e[12], y: e[13], z: e[14], ort: c.name, doing, out: true }; }
  const p = c.place || c.at.home; return p ? { x: p.x, y: 0.26, z: p.z, ort: p.kind === 'home' ? 'zu Hause' : titleCase(p.name), doing, out: false } : null;
}

/* ---------- Beim Aufbau: Bewohner werden zu Nebenfiguren (ragdoll.buildCitizens) ---------- */
function nfCitHook(list, places) {
  const nearest = (L, x, z, skip) => { let b = null, bd = 1e18; for (const p of L) { if (skip && skip(p)) continue; const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; b = p; } } return b; };
  const used = new Set();
  for (const id in NF_CIT) {
    const F = NF_FIG[id]; let ci = NF_CIT[id] % Math.max(1, list.length);
    while (used.has(ci) && ci < list.length - 1) ci++;
    const c = list[ci]; if (!c) continue; used.add(ci);
    F.ci = ci; c.nf = id;
    c.name = F.kurz; c.job = F.rolle; c.female = !!F.look.fem;
    c.ped.kind = c.kind = F.look.kind; c.ped.col = c.col = F.look.col; c.ped.sc = F.look.sc;
    const flat = p => p && p.kind !== 'factory' && p.kind !== 'home' && p.kind !== 'hotel';
    let work = null;
    if (F.factory && places.factory.length) work = places.factory[0];
    else if (F.near) { const w = nearest(places.work, F.near[0], F.near[1], p => !flat(p) || [...used].some(j => list[j] !== c && list[j].at.work.x === p.x && list[j].at.work.z === p.z && list[j].nf)); if (w) work = { ...w, name: F.work }; }
    if (!work) work = c.at.work;
    const home = nearest(places.home, work.x, work.z) || c.at.home;
    const pub = F.id === 'kroeger' ? (places.bar.find(p => /BRASS/i.test(p.name)) || nearest(places.bar.filter(p => p.kind === 'pub'), work.x, work.z) || c.at.bar) : (nearest(places.bar, work.x, work.z) || c.at.bar);
    const eat = nearest(places.eat, work.x, work.z) || c.at.eat;
    c.at = { work, home, bar: pub, eat };
    c.plan = F.plan.map(([m, a]) => [m, a]); c.jk = 'NF';
    c.goal = citizenGoal(c); c.place = c.at[c.goal]; c.st = 'in'; c.wait = 2 + ci % 7; c.path = null;
  }
}
for (const k of ['jo', 'brenner', 'hallstein', 'margot', 'kroeger', 'ahrens']) NF_FIG[k].id = k;
CIT_HOOKS.push(nfCitHook);

/* ---------- Stammplatz: zur Arbeitszeit vor der Tür; Anklopfen holt sie heraus ---------- */
function nfOutSpot(c, act, t) {
  const p = c.place; if (!p || p.ix === undefined || p.loop) return false;
  let ux = p.x - p.ix, uz = p.z - p.iz; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
  const sd = (c.nfSide ||= Math.random() < 0.5 ? -1 : 1);
  c.tk = { x: p.x + ux * 1.3 + uz * sd * 1.4, z: p.z + uz * 1.3 - ux * sd * 1.4, yaw: Math.atan2(ux, uz), act, t };
  c.wait = 0; c.st = 'out'; c.k = 0; c.errand = null;
  return true;
}
function nfStep(dt) {
  for (const id in NF_CIT) {
    const F = NF_FIG[id], c = nfCit(id); if (!c || !c.ped.a) continue;
    if (c.hold && c.st !== 'task' && c.st !== 'walk' && c.st !== 'out') c.hold = false;
    // Fabrik (Kröger): Schicht im Hof läuft von selbst; sonst während der Arbeit draußen stehen
    if (c.st === 'in' && c.wait <= 0 && citizenGoal(c) === 'work' && c.place === c.at.work && !c.place.loop) nfOutSpot(c, F.act + Math.random() * 0.05, 120 + Math.random() * 90);
    // im Gespräch: stehen bleiben und Alexander ansehen
    if (NF.open && NF.cur === F && c.st === 'task' && c.tk) { c.tk.yaw = Math.atan2(player.p.x - c.tk.x, player.p.z - c.tk.z); c.tk.t = Math.max(c.tk.t, 20); }
  }
}
function nfKnock(id) {
  const c = nfCit(id), F = NF_FIG[id]; if (!c) return;
  if (c.st !== 'in') return;
  c.hold = true; nfOutSpot(c, 0.2, 70);
  nfSay(c.place.kind === 'home' ? 'Jemand hinter der Tür' : F.kurz, c.place.kind === 'home' ? `Einen Augenblick! … ${F.kurz} kommt sofort.` : 'Ich komme, ich komme!', 3);
}
function nfStopWalker(c) {
  if (!c || c.st !== 'walk' || !c.pos) return;
  const a = c.ped.a; if (!c.gw && a) c.gw = [a.gait[1], a.gait[2]];
  c.hurry = false;
  c.tk = { x: c.pos[0], z: c.pos[1], yaw: Math.atan2(player.p.x - c.pos[0], player.p.z - c.pos[1]), act: 0.2, t: 25 };
  c.path = [[c.pos[0], c.pos[1]], [c.pos[0], c.pos[1]]]; c.pi = 1; c.target = { task: true }; c.st = 'task'; c.hold = true; c.pos = null;
  try { setAct(c.ped, 0.2); } catch (e) { /* noch ohne Figur */ }
}

/* =====================================================================
   6) NEUE ZIELARTEN FÜR AUFGABEN (aufgaben.js: AQ.prog / AQ.check)
   ===================================================================== */
function nfFreeBiz() {
  const pref = ['kranich', 'rundflug']; for (const id of pref) if (BIZ[id] && !ktOwns(id)) return id;
  let best = null; for (const id in BIZ) { const B = BIZ[id]; if (ktOwns(id) || !B.price) continue; if (!best || B.price < BIZ[best].price) best = id; }
  return best || 'kranich';
}
function nfFreeProj() { for (const id of ['spital', 'schule', 'oper', 'tram', 'waisen', 'eislicht', 'oefen', 'kran']) if (PROJECTS[id] && !KT.s.proj[id]) return id; return 'eislicht'; }
function nfVerstGoal(want) {
  const L = VERST.list.filter(H => H.ok);
  let H = want ? L.find(h => h.id === want) : (L.find(h => !h.known && !h.cleared) || L.find(h => !h.cleared) || L[0]);
  if (!H) return { k: 'gauner', stat: 'gefasst', n: 2, start: 'raub' };
  return { k: 'verst', id: H.id, ort: H.name };
}
const nfHorz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const nfFigPt = id => { const P = nfPos(id); return P ? { x: P.x, y: P.y, z: P.z, ort: NF_FIG[id].kurz } : null; };
function nfShopNear(kind) { let b = null, bd = 1e18; for (const S of SHOPS) if (S.kind === kind && S.host) { const d = (S.x - player.p.x) ** 2 + (S.z - player.p.z) ** 2; if (d < bd) { bd = d; b = S; } } return b; }
const nfWare = kind => { const k = SHOP_KINDS.find(q => q.k === kind); return k ? k.ware.replace(/^(ein|eine|einen) /, '') : kind; };
const NF_PROG = {
  nfding(q) {
    const g = q.g;
    if (nfHas(g.kind) < 0) { const S = nfShopNear(g.kind); return { txt: `${nfWare(g.kind)} kaufen${S ? ' · ' + titleCase(S.name) : ''}`, pt: S ? { x: S.x, y: 0.3, z: S.z, ort: titleCase(S.name) } : null }; }
    return { txt: `${nfWare(g.kind)} übergeben an ${NF_FIG[q.nf].kurz} (E)`, pt: nfFigPt(q.nf) };
  },
  nfhol(q) {
    const g = q.g, D = NF_ITEMS[g.item];
    if (!g.got) return { txt: `${D ? D.n : 'Etwas'} abholen · ${g.pt ? g.pt.ort : ''}`, pt: g.pt };
    if (g.give) return { txt: `Übergeben · ${g.pt.ort}`, pt: g.pt };
    return { txt: `${D ? D.n : 'Es'} zu ${NF_FIG[q.nf].kurz} bringen (E)`, pt: nfFigPt(q.nf) };
  },
  gala: () => ({ txt: 'Eine Gala im Ballsaal geben · Direktor Hartmann links vor der Bühne', pt: { x: -6.8, y: 0.3, z: -36.4, ort: 'Ballsaal des Belmont' } }),
  boss: q => {
    const pd = BOSS.pd, gg = pd && pd.gg;
    return { txt: 'Den Roten Kasimir fassen' + (BOSS.st === 'gefasst' ? ' · er sitzt gerade, kommt aber wieder frei' : ' · Shift+J zeigt die Verstecke'), pt: gg && Number.isFinite(gg.x) ? { x: gg.x, y: gg.y || 0.3, z: gg.z, ort: 'Kasimir' } : null };
  },
  flug: () => ({ txt: 'Hoch über der Krone des Belmont fliegen (F)', pt: { x: 0, y: PH.F1 + 34, z: 0, ort: 'über der Krone' } }),
  verst: q => { const H = VERST.list.find(h => h.id === q.g.id); return { txt: `Zum Eingang: ${q.g.ort}`, pt: H && H.ex != null ? { x: H.ex, y: 0.3, z: H.ez, ort: H.name } : null }; },
  helm: q => { const t = Math.floor(q.g.done || 0); return { txt: q.g.near ? 'Am Steuer der Aurora über den Belmont fahren' : `Die Aurora selbst steuern · ${t}/${q.g.t} s`, pt: q.g.near ? { x: 0, y: 300, z: 0, ort: 'über dem Belmont' } : (IMP.g ? { x: IMP.g.position.x, y: IMP.g.position.y, z: IMP.g.position.z, ort: 'Aurora Imperial' } : null) }; },
  lohn: () => ({ txt: 'In einem Betrieb großzügige Löhne zahlen (Kontor I · Besitz · Löhne)' }),
  ruf: q => ({ txt: `Ruf bei der Presse: ${Math.round(rufGet(q.g.ax))}/${q.g.n} (Ruf-Buch Ö)` }),
  nftalk: q => ({ txt: 'Mit ' + NF_FIG[q.nf].kurz + ' sprechen', pt: nfFigPt(q.nf) }),
};
const NF_CHECK = {
  nfding: () => false,
  nfhol(q) {
    const g = q.g; if (g.got || !g.pt) return false;
    const p = player.p;
    if ((p.x - g.pt.x) ** 2 + (p.z - g.pt.z) ** 2 < g.pt.r * g.pt.r && Math.abs(p.y - g.pt.y) < (g.pt.ry || 4)) {
      g.got = true;
      if (g.give) { nfSay(g.who || '…', g.pick, 5); return true; }
      nfGiveItem(g.item); if (g.pick) toast(g.pick); ktChanged('quest');
    }
    return false;
  },
  gala: q => NF.galaN > (q.g.base || 0),
  boss: q => ((BOSS.stats && BOSS.stats.gefasst) || 0) > (q.g.base || 0),
  flug: () => player.fly && nfHorz(player.p, { x: 0, z: 0 }) < 110 && player.p.y > PH.F1 + 30,
  verst: q => { const H = VERST.list.find(h => h.id === q.g.id); return !!(H && H.ex != null && Math.hypot(player.p.x - H.ex, player.p.z - H.ez) < 9 && player.p.y < 12); },
  helm(q) {
    if (IMP.st !== 'helm') return false;
    if (q.g.near && !(IMP.g && Math.hypot(IMP.g.position.x, IMP.g.position.z) < 260)) return false;
    q.g.done = (q.g.done || 0) + 0.25;
    return q.g.done >= q.g.t;
  },
  lohn: () => Object.keys(KT.s.own).some(id => KT.s.own[id].lohn === 2 && BIZ[id] && BIZ[id].inc > 0),
  ruf: q => rufGet(q.g.ax) >= q.g.n,
  nftalk: () => false,
};
Object.assign(AQ.prog, NF_PROG);
Object.assign(AQ.check, NF_CHECK);

/* ---------- Aufgabe annehmen, abschließen ---------- */
function nfQuest(id) { const L = KT.s.q && KT.s.q.list; return L ? L.find(q => q.nf === id && q.st === 'aktiv') : null; }
function nfFill(F, s) { return s.replace('{biz}', () => { const id = nfFreeBiz(); return BIZ[id] ? BIZ[id].n : 'ein Geschäft'; }).replace('{proj}', () => { const id = nfFreeProj(); return PROJECTS[id] ? PROJECTS[id].n : 'eine Stiftung'; }); }
function nfAccept(F) {
  const S = nfS(F.id), d = NF_ARC[F.id][S.st]; if (!d) return null;
  const g = typeof d.g === 'function' ? d.g() : JSON.parse(JSON.stringify(d.g));
  const q = addQuest({ title: d.title, text: nfFill(F, d.offer), src: 'nf', nf: F.id, nfi: S.st, who: F.kurz + ' · ' + F.rolle, g, rw: d.rw || {}, doneLine: d.done }, 'aktiv');
  const qg = q.g;
  if (qg.k === 'gala') qg.base = NF.galaN;
  if (qg.k === 'boss') qg.base = (BOSS.stats && BOSS.stats.gefasst) || 0;
  if (qg.k === 'verst') { const H = VERST.list.find(h => h.id === qg.id); if (H && !H.known) try { reveal(H, F.id === 'brenner' ? 'Der Polizeipräsident hat einen Hinweis.' : 'Margot Wendt hat eine Spur.'); } catch (e) { /* noch nicht platziert */ } }
  S.act = q.id;
  ktChanged('quest');
  return q;
}
// aufgaben.js ruft das nach finishQuest (auch für Aufgaben, die sich selbst erfüllen)
function nfDone(q) {
  if (!q || q.src !== 'nf' || !NF_FIG[q.nf]) return;
  const F = NF_FIG[q.nf], S = nfS(F.id), d = NF_ARC[F.id][q.nfi];
  if (q.nfi !== S.st) return;
  S.st++; S.act = null;
  if (d && d.nf) { nfEffects(F.id, { rel: d.nf.rel, ruf: d.nf.ruf, item: d.nf.item }); if (d.nf.news) nfNews(d.nf.news, F); if (d.nf.final) S.f.final = 1; }
  const n = NF_ARC[F.id].length;
  setTimeout(() => toast(S.st >= n ? `Die Geschichte von ${F.kurz} ist erzählt` : `${F.kurz} · Kapitel ${S.st} von ${n} erzählt`), 2600);
  ktChanged('nf');
}
function nfDropped(q) { if (q && q.src === 'nf' && NF_FIG[q.nf]) { const S = nfS(q.nf); S.act = null; nfRel(q.nf, -4, 'Aufgabe abgebrochen'); } }
AQ.onDone.push(nfDone);
AQ.onDrop.push(nfDropped);

/* =====================================================================
   7) DAS GESPRÄCH
   ===================================================================== */
function nfSay(who, s, dur) {
  const el = $('say'); if (!el) return;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + s + '“';
  el.style.opacity = 1; shared.sayTimer = dur || Math.max(3.5, s.length / 14);
}
function nfCss() {
  const st = document.createElement('style');
  st.textContent = `
#nfDlg{position:fixed;z-index:18;left:50%;bottom:calc(22px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(780px,calc(100% - 24px));max-height:calc(100% - 40px);overflow:auto;background:linear-gradient(180deg,rgba(6,22,30,.95),rgba(3,12,18,.97));border:1px solid rgba(217,178,106,.75);outline:1px solid rgba(217,178,106,.22);outline-offset:4px;color:var(--ink,#efe6d2);font:400 15px/1.5 var(--body);box-shadow:0 18px 50px rgba(0,0,0,.6)}
#nfDlg[hidden]{display:none}
#nfDlg::before,#nfDlg::after{content:'';position:absolute;top:-1px;width:46px;height:46px;border-top:2px solid #f6dc9a;pointer-events:none}
#nfDlg::before{left:-1px;border-left:2px solid #f6dc9a}#nfDlg::after{right:-1px;border-right:2px solid #f6dc9a}
#nfDlg .hd{display:flex;gap:14px;align-items:center;padding:14px 20px 10px;border-bottom:1px solid rgba(217,178,106,.3);background:linear-gradient(90deg,rgba(217,178,106,.09),transparent 70%)}
#nfDlg .med{flex:none;width:58px;height:58px;position:relative;display:grid;place-items:center;font:400 26px/1 var(--display);color:#f6dc9a}
#nfDlg .med svg{position:absolute;inset:0}
#nfDlg small{display:block;font:600 10.5px/1 var(--body);letter-spacing:.32em;text-transform:uppercase;color:var(--gold,#d9b26a)}
#nfDlg h3{margin:5px 0 3px;font:400 22px/1.1 var(--display);letter-spacing:.07em;color:#f6dc9a}
#nfDlg .rel{display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:.1em;color:var(--muted,#b9ab8f)}
#nfDlg .rel .bar{position:relative;width:140px;height:6px;background:rgba(255,255,255,.07);border:1px solid rgba(217,178,106,.3)}
#nfDlg .rel .bar i{position:absolute;top:0;bottom:0}
#nfDlg .rel .bar u{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:rgba(246,220,154,.5)}
#nfDlg .rel b{color:#f6dc9a;font-weight:600}
#nfDlg .ln{margin:0;padding:14px 22px 6px;font-size:16px;line-height:1.55}
#nfDlg .ln::before{content:'„';color:var(--gold,#d9b26a)}#nfDlg .ln::after{content:'“';color:var(--gold,#d9b26a)}
#nfDlg .op{display:grid;gap:6px;padding:8px 20px 12px}
#nfDlg .op button{display:flex;gap:10px;align-items:baseline;text-align:left;font:500 14.5px/1.35 var(--body);letter-spacing:.03em;color:var(--ink,#efe6d2);background:rgba(217,178,106,.06);border:1px solid rgba(217,178,106,.35);padding:9px 12px 8px;cursor:pointer}
#nfDlg .op button:hover,#nfDlg .op button:focus-visible{background:rgba(217,178,106,.18);border-color:rgba(246,220,154,.8);outline:none}
#nfDlg .op button kbd{flex:none;font:600 11px/1 var(--body);color:#06141a;background:#d9b26a;padding:3px 6px 2px}
#nfDlg .op button.q{border-color:rgba(111,214,207,.6)}#nfDlg .op button.q kbd{background:#6fd6cf}
#nfDlg .op button.bye{opacity:.75}
#nfDlg .ft{padding:6px 20px 10px;font-size:11.5px;letter-spacing:.14em;color:var(--muted,#b9ab8f);border-top:1px solid rgba(217,178,106,.18)}
body.nfTalk #say{visibility:hidden}
#nfFloat{position:fixed;z-index:19;left:50%;bottom:calc(100% - 64px);transform:translateX(-50%);font:600 12.5px/1.3 var(--body);letter-spacing:.08em;padding:6px 12px 5px;background:rgba(5,16,24,.85);border:1px solid rgba(217,178,106,.5);color:#7fe3d6;opacity:0;transition:opacity .4s;pointer-events:none;white-space:nowrap}
#nfFloat.dn{color:#f0a070}#nfFloat.on{opacity:1}
#ruf .nfB{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
#ruf .nfB .c{border:1px solid rgba(217,178,106,.3);padding:9px 11px;background:rgba(255,255,255,.02)}
#ruf .nfB .c.off{opacity:.55}
#ruf .nfB .c b{display:block;font:400 16px/1.2 var(--display);letter-spacing:.05em;color:#f6dc9a}
#ruf .nfB .c .r{display:grid;grid-template-columns:1fr auto;align-items:center;gap:4px 8px;margin:6px 0 4px}
#ruf .nfB .c .rb{grid-column:1/-1;position:relative;height:6px;background:rgba(255,255,255,.07);border:1px solid rgba(217,178,106,.25)}
#ruf .nfB .c .rb i{position:absolute;top:0;bottom:0}
#ruf .nfB .c .rb u{position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:rgba(246,220,154,.45)}
#ruf .nfB .c .k{display:flex;gap:3px;margin:4px 0}
#ruf .nfB .c .k i{width:14px;height:5px;background:rgba(217,178,106,.18);border:1px solid rgba(217,178,106,.4)}
#ruf .nfB .c .k i.on{background:#d9b26a}
@media (max-width:640px){#nfDlg .hd{padding:10px 12px 8px}#nfDlg .ln{padding:10px 14px 4px;font-size:15px}#nfDlg .op{padding:6px 12px 10px}#nfDlg .rel .bar{width:90px}}
`;
  document.head.append(st);
}
const NF_SUN = `<svg viewBox="0 0 60 60" aria-hidden="true"><g stroke="#d9b26a" fill="none">${Array.from({ length: 16 }, (_, i) => { const a = i / 16 * Math.PI * 2; return `<line x1="${30 + Math.cos(a) * 21}" y1="${30 + Math.sin(a) * 21}" x2="${30 + Math.cos(a) * (i % 2 ? 26 : 29)}" y2="${30 + Math.sin(a) * (i % 2 ? 26 : 29)}" stroke-width="${i % 2 ? 1 : 1.6}"/>`; }).join('')}<circle cx="30" cy="30" r="19" stroke-width="1.6"/><circle cx="30" cy="30" r="16" stroke-width=".8"/></g></svg>`;
function nfDom() {
  nfCss();
  const el = document.createElement('div'); el.id = 'nfDlg'; el.hidden = true;
  el.innerHTML = `<div class="hd"><div class="med">${NF_SUN}<span></span></div><div style="flex:1;min-width:0"><small></small><h3></h3><div class="rel"><span></span><div class="bar"><u></u><i></i></div></div></div></div><p class="ln"></p><div class="op"></div><div class="ft"></div>`;
  el.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) nfChoose(+b.dataset.i); });
  el.addEventListener('mousedown', e => e.stopPropagation());
  el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
  document.body.append(el); NF.el = el;
  const fl = document.createElement('div'); fl.id = 'nfFloat'; document.body.append(fl);
}
function nfFloat(s, up) { const f = $('nfFloat'); if (!f) return; f.textContent = s; f.className = up ? 'on' : 'on dn'; clearTimeout(NF.flT); NF.flT = setTimeout(() => { f.className = up ? '' : 'dn'; }, 2600); }
const nfRelBar = r => { const w = Math.abs(r) / 2; return `left:${r >= 0 ? 50 : 50 - w}%;width:${w}%;background:${r >= 0 ? 'linear-gradient(90deg,#8a6a32,#f6dc9a)' : 'linear-gradient(90deg,#f0a070,#7a3a22)'}`; };
function nfRenderHead() {
  const F = NF.cur, el = NF.el; if (!F || !el) return;
  const S = nfS(F.id);
  el.querySelector('.med span').textContent = F.ini;
  el.querySelector('small').textContent = F.rolle;
  el.querySelector('h3').textContent = F.n;
  el.querySelector('.rel span').innerHTML = `${F.rival ? 'Rivalität' : 'Beziehung'}: <b>${esc(nfRelLabel(F.id))}</b>`;
  el.querySelector('.rel .bar i').setAttribute('style', nfRelBar(S.rel));
}
function nfShow(node) {
  const F = NF.cur, el = NF.el; if (!F || !el) return;
  NF.node = node;
  nfRenderHead();
  el.querySelector('.ln').textContent = node.say;
  const op = el.querySelector('.op'); op.innerHTML = '';
  node.opts.forEach((o, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; if (o.cls) b.className = o.cls;
    const k = document.createElement('kbd'); k.textContent = (i + 1) % 10; b.append(k, document.createTextNode(o.t)); op.append(b);
  });
  el.querySelector('.ft').textContent = isTouch ? 'Antwort antippen' : 'Zahl drücken oder anklicken · Esc beendet das Gespräch';
  nfSay(node.who || F.kurz, node.say);
}
function nfChoose(i) {
  if (!NF.open || !NF.node) return;
  const o = NF.node.opts[i]; if (!o) return;
  let nx = null; try { nx = o.fn ? o.fn() : null; } catch (e) { console.warn('Nebenfiguren:', e); }
  if (nx) nfShow(nx); else nfClose();
}
export function nfOpen(id) {
  if (!NF.ready || NF.open) return;
  const F = NF_FIG[id], S = nfS(id); if (!F) return;
  if (DINE.menuOpen) return;
  NF.open = true; NF.cur = F; DINE.menuOpen = true; DINE.onPick = null;
  document.body.classList.add('nfTalk');
  nfStopWalker(nfCit(id));
  try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* egal */ }
  NF.el.hidden = false;
  let first = false;
  if (!S.met) { S.met = true; first = true; (NF.lastLab ||= {})[id] = nfRelLabel(id); }
  S.talks = (S.talks || 0) + 1;
  // gelegentliche Gespräche zählen ein wenig, aber nur einmal am Geschäftstag
  if (S.day !== KT.s.day) { S.day = KT.s.day; if (!first) nfRel(id, F.rival ? 1 : 2); }
  ktChanged('nf');
  nfShow(nfRoot(F, first));
}
export function nfClose() {
  if (!NF.open) return;
  NF.open = false; NF.el.hidden = true; DINE.menuOpen = false;
  document.body.classList.remove('nfTalk');
  const c = NF.cur && nfCit(NF.cur.id); if (c && c.tk && c.st === 'task') c.tk.t = Math.min(c.tk.t, 8);
  NF.cur = null; NF.node = null;
  if (!isTouch && playing && !paused) tryLock();
}

/* ---------- Gesprächsknoten ---------- */
function nfBye(F) { return { t: 'Auf Wiedersehen.', cls: 'bye', fn: () => { nfSay(F.kurz, nfPick(NF_BYE[F.id]), 3); return null; } }; }
function nfBack(F) { return { t: 'Etwas anderes …', fn: () => nfRoot(F, false, true) }; }
function nfRoot(F, first, again) {
  const S = nfS(F.id), arc = NF_ARC[F.id], q = nfQuest(F.id), opts = [];
  let say = first ? NF_INTRO[F.id] : again ? nfPick(['Noch etwas, Herr Alexander?', 'Ja?', 'Was liegt Ihnen noch auf dem Herzen?']) : nfGreet(F, S);
  if (F.id === 'ahrens' && !first && !again) say = say.replace('Herr Alexander', 'Sir');
  // 1) laufende Bitte
  if (q) {
    const g = q.g, canGive = (g.k === 'nfding' && nfHas(g.kind) >= 0) || (g.k === 'nfhol' && !g.give && g.got && nfHas(g.item) >= 0);
    if (canGive) {
      const what = g.k === 'nfding' ? nfWare(g.kind) : (NF_ITEMS[g.item] || {}).n;
      opts.push({ t: `Übergeben: ${what}`, cls: 'q', fn: () => {
        const i = nfHas(g.k === 'nfding' ? g.kind : g.item); if (i >= 0) KT.s.items.splice(i, 1);
        const line = q.doneLine; finishQuest(q, line);
        return { say: line, opts: nfAfterDone(F) };
      } });
    } else {
      opts.push({ t: `Wegen „${q.title}“ …`, cls: 'q', fn: () => { let pr = { txt: '' }; try { pr = progress(q); } catch (e) { /* egal */ } return { say: NF_WAIT[F.id] + (pr.txt ? ' ' + pr.txt + '.' : ''), opts: [nfBack(F), nfBye(F)] }; } });
    }
  } else if (S.f.final) {
    opts.push({ t: 'Das letzte Wort unter vier Augen', cls: 'q', fn: () => nfFinal(F) });
  } else if (S.st < arc.length) {
    const d = arc[S.st];
    opts.push({ t: S.st === 0 ? 'Kann ich etwas für Sie tun?' : 'Gibt es noch etwas, das ich tun kann?', cls: 'q', fn: () => S.rel >= d.need ? nfOffer(F, d) : { say: NF_NOTYET[F.id], opts: [nfBack(F), nfBye(F)] } });
  } else if (!again) {
    say += ' ' + (S.f.foe ? 'Sie wissen, was ich von Ihnen halte.' : '');
  }
  if (S.st >= arc.length && !S.f.final) opts.push({ t: 'Wie geht es Ihnen?', fn: () => ({ say: S.f.foe ? 'Besser, seit ich weiß, wer mein Feind ist. Guten Abend, Alexander.' : NF_DONE_ALL[F.id], opts: [nfBack(F), nfBye(F)] }) });
  // 2) Themen
  for (const T0 of NF_TOPICS[F.id]) if (!T0.when || T0.when(S)) opts.push({ t: T0.t, fn: () => nfTopic(F, T0) });
  // 3) Jo singt jeden Abend für ihn (ab der Freundschaft)
  opts.push(nfBye(F));
  return { say: say.trim(), opts };
}
function nfAfterDone(F) {
  const S = nfS(F.id), arc = NF_ARC[F.id];
  const o = [];
  if (S.f.final) o.push({ t: 'Reden wir, Viktor.', cls: 'q', fn: () => nfFinal(F) });
  else if (S.st < arc.length) o.push({ t: 'Sonst noch etwas?', fn: () => nfRoot(F, false, true) });
  o.push(nfBye(F));
  return o;
}
function nfOffer(F, d) {
  const text = nfFill(F, d.offer);
  return { say: text, opts: [
    { t: d.interview ? 'Fragen Sie, Fräulein Wendt.' : 'Ich kümmere mich darum.', cls: 'q', fn: () => {
      const q = nfAccept(F); if (!q) return null;
      if (d.interview) return nfInterview(F, q, 0, []);
      toast('Aufgabe angenommen: ' + d.title + ' · Kontor (I) · Karte (Y)');
      return { say: nfPick(['Danke. Ich wusste, dass ich mich auf Sie verlassen kann.', 'Wirklich? Danke, Herr Alexander!', 'Gut. Sehr gut.']).replace('Herr Alexander', F.id === 'ahrens' ? 'Sir' : 'Herr Alexander'), opts: [nfBye(F)] };
    } },
    { t: 'Ein andermal.', fn: () => ({ say: NF_LATER[F.id], opts: [nfBack(F), nfBye(F)] }) },
  ] };
}
function nfTopic(F, T0) {
  const S = nfS(F.id), say = typeof T0.say === 'function' ? T0.say(S) : T0.say;
  if (!T0.opts) { nfEffects(F.id, { rel: 1 }, 't:' + T0.id); return { say, opts: [nfBack(F), nfBye(F)] }; }
  return { say, opts: T0.opts.map((o, i) => ({ t: o.t, fn: () => {
    if (o.cash && o.cash < 0 && KT.s.cash < -o.cash) return { say: 'Wie bitte? … Ach so. Vielleicht ein andermal.', opts: [nfBack(F), nfBye(F)] };
    const key = 't:' + T0.id;
    // einmal je Thema: erste Antwort zählt, Geld wird jedes Mal fällig
    if (!S.f[key]) { S.f[key] = i + 1; nfEffects(F.id, { rel: o.rel, ruf: o.ruf }); }
    if (o.cash) nfEffects(F.id, { cash: o.cash });
    return { say: o.say, opts: [nfBack(F), nfBye(F)] };
  } })) };
}

/* ---------- Margots Interview (drei Fragen; die Antworten landen in der Zeitung) ---------- */
const NF_IV = [
  { f: 'Erste Frage: Wie haben Sie den Krater gefunden?', a: [
    ['Auf einer Expedition. Ich sah ein Leuchten im Eis und bin ihm gefolgt.', { bew: 1 }, 'Er folgte einem Leuchten im Eis, erzählt der Gründer.'],
    ['Ich habe gesucht, was niemand sonst gesucht hat.', { elite: 1 }, 'Er habe gesucht, was niemand sonst suchte, sagt Herr Alexander.'],
    ['Das bleibt mein Geheimnis.', { presse: -1, furcht: 1 }, 'Wie er den Krater fand? Das, so der Gründer knapp, bleibe sein Geheimnis.']] },
  { f: 'Man sagt, Sie können fliegen. Und noch mehr. Ist das wahr?', a: [
    ['Sehen Sie heute Nacht zum Belmont hinauf, Fräulein Wendt.', { bew: 2 }, 'Auf die Frage nach seinen Kräften lächelt er nur: Man möge heute Nacht zum Belmont hinaufsehen.'],
    ['Die Leute sagen vieles.', { presse: 1 }, 'Zu den Gerüchten über seine Kräfte schweigt er bescheiden.'],
    ['Ja. Und nur ich. Niemand sonst wird je solche Kräfte haben.', { furcht: 2, bew: 1 }, '„Nur ich“, sagt er über seine Kräfte. „Niemand sonst.“ Es klang nicht wie eine Prahlerei, eher wie ein Versprechen.']] },
  { f: 'Letzte Frage: Was wünschen Sie sich für Vespera?', a: [
    ['Dass jeder hier ein warmes Zuhause hat.', { arbeiter: 2, buerger: 1 }, 'Sein Wunsch für die Stadt: ein warmes Zuhause für jeden, bis ins letzte Hinterhaus.'],
    ['Höhere Türme, hellere Lichter, mehr Glanz als in Paris.', { elite: 2 }, 'Er träumt von höheren Türmen und hellerem Licht: mehr Glanz als in Paris.'],
    ['Dass man hier in hundert Jahren noch tanzt.', { bew: 1, buerger: 1 }, 'Und sein Wunsch? Dass man in Vespera in hundert Jahren noch tanzt.']] },
];
function nfInterview(F, q, k, said) {
  const Q = NF_IV[k];
  return { say: Q.f, opts: Q.a.map(([t, ruf, quote]) => ({ t, fn: () => {
    try { rufAdd(ruf, 'Interview im Kurier', { key: 'nf:iv' + k }); } catch (e) { /* egal */ }
    said.push(quote);
    if (k + 1 < NF_IV.length) return nfInterview(F, q, k + 1, said);
    nfNews(['Ein Abend mit dem Gründer', 'Ein Gespräch von Margot Wendt. ' + said.join(' ')], F);
    finishQuest(q, q.doneLine);
    return { say: q.doneLine, opts: nfAfterDone(F) };
  } })) };
}

/* ---------- Hallsteins letztes Wort: Partner oder Feind ---------- */
function nfFinal(F) {
  const S = nfS(F.id);
  return { say: 'Wir beide haben diese Stadt groß gemacht, Alexander, jeder auf seine Art. Ich schlage Ihnen etwas vor: Ein Handschlag. Ihre Stadt, meine Schiffe. Partner. Oder wir bleiben, was wir sind.', opts: [
    { t: 'Partner. Hier ist meine Hand.', cls: 'q', fn: () => {
      S.f.final = 0; S.f.ally = 1; nfEffects(F.id, { rel: 30, ruf: { elite: 3 } });
      if (KT.s.cp && KT.s.cp.nord) KT.s.cp.nord *= 1.08;
      nfNews(['Alexander und Hallstein reichen sich die Hand', 'Die einstigen Rivalen werden Partner: Die Nordlicht-Reederei steigt an der Börse, die Salons feiern die Versöhnung des Jahres.'], F);
      return { say: 'Ein Handschlag unter Herren. Die Nordlicht-Reederei wird es Ihnen danken. Und ich auch, Alexander.', opts: [nfBye(F)] };
    } },
    { t: 'Nein, Viktor. In Vespera gibt es nur einen Herrn.', fn: () => {
      S.f.final = 0; S.f.foe = 1; nfEffects(F.id, { rel: -40, ruf: { furcht: 2, elite: 1 } });
      return { say: 'So sei es. Dann bleiben wir Rivalen bis zum Ende. Ich freue mich darauf, Alexander. Wirklich.', opts: [nfBye(F)] };
    } },
  ] };
}

/* =====================================================================
   8) ANSPRECHEN, MARKIERUNGEN, KARTE, RUF-BUCH
   ===================================================================== */
function nfOfferReady(id) { const S = nfS(id), d = NF_ARC[id][S.st]; return !nfQuest(id) && ((d && S.rel >= d.need) || S.f.final); }
function nfMarkStep() {
  const show = playing && !paused && !NF.open && !KT.open && !DINE.menuOpen;
  let mi = 0;
  if (show) for (const id of NF_IDS) {
    const P = nfPos(id); if (!P || (NF_FIG[id].home === 'cit' && !P.out)) continue;
    const d = Math.hypot(P.x - player.p.x, P.z - player.p.z); if (d > 55 || Math.abs(P.y - player.p.y) > 12) continue;
    const ready = nfOfferReady(id), S = nfS(id);
    const el = NF.marks[mi] || (NF.marks[mi] = (() => { const e = document.createElement('div'); e.className = 'ktMk giver'; e.innerHTML = '<span></span><b></b>'; e.hidden = true; document.body.append(e); return e; })());
    mi++;
    NF._v.set(P.x, P.y + (NF_FIG[id].home === 'belmont' ? 2.3 : 2.2), P.z).project(nfCam());
    if (NF._v.z > 1 || Math.abs(NF._v.x) > 1.05 || Math.abs(NF._v.y) > 1.05) { el.hidden = true; continue; }
    el.hidden = false;
    el.style.left = ((NF._v.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; el.style.top = ((1 - NF._v.y) / 2 * innerHeight).toFixed(0) + 'px';
    const txt = (S.met ? NF_FIG[id].kurz : '?') + (d > 10 ? ' · ' + Math.round(d) + ' m' : ''), sym = ready ? '!' : '✦';
    if (el._t !== txt + sym) { el._t = txt + sym; el.querySelector('b').textContent = txt; el.querySelector('span').textContent = sym; }
    el.style.opacity = ready ? 1 : 0.7;
  }
  for (let i = mi; i < NF.marks.length; i++) NF.marks[i].hidden = true;
}
const nfCam = () => camera;
function nfKarte(L, lay) {
  if (!lay.figuren || !NF.ready) return;
  for (const id of NF_IDS) {
    const P = nfPos(id); if (!P || !Number.isFinite(P.x)) continue;
    const F = NF_FIG[id], S = nfS(id), q = nfQuest(id);
    L.push({ cat: 'figuren', icon: 'figur', ch: F.ini, n: S.met ? F.kurz : F.kurz + ' (unbekannt)', sub: `${F.rolle} · ${P.doing || P.ort}${q ? ' · Aufgabe: ' + q.title : nfOfferReady(id) ? ' · hat eine Bitte' : ''}`, x: P.x, z: P.z, ready: nfOfferReady(id) });
  }
}
function nfRufSection() {
  if (!NF.ready) return '';
  const cards = NF_IDS.map(id => {
    const F = NF_FIG[id], S = nfS(id), P = nfPos(id), q = nfQuest(id), n = NF_ARC[id].length;
    const where = P ? (P.doing || P.ort) : F.wo || '';
    const ks = Array.from({ length: n }, (_, i) => `<i class="${i < S.st ? 'on' : ''}"></i>`).join('');
    const st = q ? `Aufgabe: <b style="display:inline;font:inherit;color:#7fe3d6">${esc(q.title)}</b>` : S.f.final ? 'Wartet auf Ihr letztes Wort' : S.st >= n ? (S.f.ally ? 'Partner' : S.f.foe ? 'Erklärter Rivale' : 'Geschichte erzählt') : nfOfferReady(id) ? 'Hat eine Bitte an Sie' : 'Noch keine Bitte';
    return `<div class="c ${S.met ? '' : 'off'}"><b>${esc(F.n)}</b><span class="s">${esc(F.rolle)}</span>
      <div class="r"><span>${F.rival ? 'Rivalität' : 'Beziehung'}: <b style="display:inline;font:600 13px var(--body);letter-spacing:.06em">${esc(nfRelLabel(id))}</b></span><span class="s">${S.met ? (S.rel > 0 ? '+' : '') + Math.round(S.rel) : '–'}</span><div class="rb"><u></u><i style="${nfRelBar(S.rel)}"></i></div></div>
      <div class="k" title="Kapitel ${S.st} von ${n}">${ks}</div>
      <span class="s">${S.met ? esc(where) : 'Noch nicht kennengelernt · ' + esc(F.wo || where)}</span><br><span class="s">${st}</span>
      <div class="btns" style="margin-top:6px"><button type="button" data-act="nfwp" data-id="${id}">Auf der Karte markieren</button></div></div>`;
  }).join('');
  return `<section class="wide"><h3>Bekanntschaften</h3><p class="s" style="margin:0 0 8px">Feste Menschen von Vespera. Wer etwas auf dem Herzen hat, trägt ein goldenes Ausrufezeichen. Was sie sagen, hängt von Ihrem Ruf und Ihren Antworten ab.</p><div class="nfB">${cards}</div></section>`;
}
function nfRufClick(a, b) {
  if (a !== 'nfwp') return false;
  const id = b.dataset.id, P = nfPos(id); if (!P) return true;
  try { KARTE.s.wp = { x: P.x, z: P.z, n: NF_FIG[id].kurz }; localStorage.setItem('vespera-karte', JSON.stringify({ v: KARTE.s.v, wp: KARTE.s.wp, ring: KARTE.s.ring, lay: KARTE.s.lay })); KARTE.dirty = true; } catch (e) { /* ohne Karte */ }
  toast(`Wegpunkt: ${NF_FIG[id].kurz} · Karte mit Y`);
  return true;
}

/* ---------- Ansprechen (E) ---------- */
function nfInteract() {
  // Bewohner-Figuren: eigener Gesprächseintrag (music.js nimmt c.use)
  for (const id in NF_CIT) {
    const c = nfCit(id); if (!c) continue;
    c.use = { label: 'Gespräch: ' + NF_FIG[id].kurz, act: () => nfOpen(id) };
    // drinnen: an der Tür klopfen
    INTERACT.push({ test: p => !NF.open && c.st === 'in' && c.place && !c.place.loop && (p.x - c.place.x) ** 2 + (p.z - c.place.z) ** 2 < 3.2 * 3.2 && p.y < 3,
      get label() { return `Anklopfen: ${NF_FIG[id].kurz} ist ${c.place.kind === 'home' ? 'zu Hause' : 'drinnen'}`; }, act: () => nfKnock(id) });
  }
  // Jo auf der Bühne
  INTERACT.push({ test: p => { if (NF.open || p.y > 5 || p.z > -30 || p.z < -44 || Math.abs(p.x) > 6) return false; const J = nfJoPos(); return (p.x - J.x) ** 2 + (p.z - J.z) ** 2 < 4.4 * 4.4; }, label: 'Gespräch: Josephine Lafleur', act: () => nfOpen('jo') });
  // Ahrens: im Kapitänsmenü
  IMP_CAPT_HOOK.push(add => add(nfS('ahrens').met ? 'Persönlich: Kapitän Ahrens' : 'Kapitän, wir sollten uns kennenlernen.', () => setTimeout(() => nfOpen('ahrens'), 60)));
}

/* =====================================================================
   9) START UND TAKT (über das Kontor)
   ===================================================================== */
function nfInit() {
  if (NF.ready) return;
  for (const id of NF_IDS) nfS(id);
  // offene Aufgaben wiederfinden
  for (const id of NF_IDS) { const S = nfS(id); S.act = (nfQuest(id) || {}).id || null; (NF.lastLab ||= {})[id] = nfRelLabel(id); }
  nfDom(); nfInteract();
  RUF.extra.push(nfRufSection); RUF.onAct.push(nfRufClick);
  KARTE.liveHooks.push(nfKarte);
  NF.ready = true;
  try { window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'stadt', tasten: [{ id: 'nebenfiguren', k: ['E'], t: 'Mit Bekanntschaften sprechen', d: 'Jo Lafleur (Ballsaal), Polizeipräsident Brenner, Viktor von Hallstein, Margot Wendt, Hannes Kröger, Kapitän Ahrens (Kapitänsmenü). Goldenes ! = hat eine Bitte. Übersicht im Ruf-Buch (Ö), Orte auf der Karte (Y).' }] } })); } catch (e) { /* alt */ }
  if (!KT.s.nfHint) { KT.s.nfHint = 1; setTimeout(() => toast('Neu: Bekanntschaften · sechs Menschen mit eigener Geschichte · Ruf-Buch (Ö) und Karte (Y)'), 16000); }
  if (window.vespera) window.vespera.nf = { NF, FIG: NF_FIG, ARC: NF_ARC, open: nfOpen, close: nfClose, choose: nfChoose, s: nfS, pos: nfPos, accept: nfAccept, rel: nfRel, label: nfRelLabel };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { nfInit(); return; }
  if (!NF.ready) return;
  if (why === 'reset') { if (NF.open) nfClose(); for (const id of NF_IDS) { nfS(id); NF.lastLab[id] = nfRelLabel(id); } return; }
  if (why !== 'frame') return;
  if ((NF.tickT -= dt) <= 0) { NF.tickT = 0.5; if (playing && !paused) nfStep(0.5); }
  nfMarkStep();
});
if (typeof window !== 'undefined') {
  window.addEventListener('vespera-gala', e => { if (e.detail && e.detail.phase === 'ende') NF.galaN++; });
  // Tasten im Gespräch: Zahlen wählen, Esc schließt (vor allen anderen Tasten)
  window.addEventListener('keydown', e => {
    if (!NF.open) return;
    const n = e.code.startsWith('Digit') ? +e.code.slice(5) : e.code.startsWith('Numpad') ? +e.code.slice(6) : -1;
    if (n >= 0 && n <= 9 && !e.repeat) nfChoose((n + 9) % 10);
    else if (e.code === 'Escape' || (e.code === 'KeyE' && !e.repeat && NF.node && NF.node.opts.length === 1)) nfClose();
    if (e.code !== 'F5' && e.code !== 'F12') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
}
