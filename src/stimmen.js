/* =====================================================================
   V59 · MEHR SÄTZE, WORTE UND REAKTIONEN
   1. Viel mehr Sätze für alles, was schon spricht: Zurufe beim Vorbeigehen,
      Rufe bei Alexanders Kräften, Antworten beim Ansprechen, Alltagssätze
      der Bürger, Zeitungsjungen, Musikanten, Randolf, Konrad, der Pianist,
      der Kapitän und die Stewards der Aurora Imperial. Dazu kurze Ausrufe
      („Donnerwetter!“, „Potztausend!“).
   2. Neue Reaktionen (alle hörbar über voice.js):
      · Belauschte Wechselreden: Geht Alexander an einer Runde vorbei, redet
        sie über ihn, die Stadt oder das Wetter, zwei Stimmen nacheinander.
      · Wer von ihm in die Luft gehoben wird, sagt etwas (je nach Haltung),
        bei langem Schweben noch einmal, und wieder auf den Füßen auch.
      · Wer umgestoßen wurde, rappelt sich auf und versichert, es sei nichts
        passiert.
      · Fährt er im Wagen vorbei, ruft man ihm nach.
      · Bleibt er neben jemandem stehen, spricht man ihn an.
      · Randolf und Konrad sagen von sich aus ab und zu etwas, wenn er bei
        ihnen ist.
   Alles in dieser Datei; die anderen Dateien geben nur ihre Satzlisten frei
   (export). Läuft viermal pro Sekunde, nur mit Leuten in der Nähe.
   ===================================================================== */
import { shared, $ } from './core.js';
import { SAY, SAY_NEAR, SAY_POW, TALK, attOf, whoOf, AWE } from './awe.js';
import { HEAD, HEAD_HIM, MUSIC_HIM, lifeSay } from './life.js';
import { HS, R_GREET, R_ROOM, R_BYE, R_TK, K_GREET, K_SAYS, PIANO_HIM } from './haushalt.js';
import { RANDOLF_SAYS } from './villa.js';
import { TRAITS } from './ragdoll.js';
import { IMP_CAPTAIN, IMP_CAPT_OK } from './imperial.js';
import { LINES_UP, LINES_LOW, GREET } from './bordservice.js';
import { peds, CHATS, turnHead } from './serpentine.js';
import { player } from './player.js';
import { POWERS } from './powers.js';
import { DRIVE } from './eating.js';
import { BOAT } from './boat.js';
import { ATMO } from './atmosphere.js';
import { playing, paused } from './input.js';
import { speak, estimate, VOICE } from './voice.js';

const add = (L, ...s) => { for (const x of s) if (!L.includes(x)) L.push(x); };
const pick = L => L[Math.floor(Math.random() * L.length)];

/* ---------- 1. mehr Sätze in die bestehenden Listen ---------- */
// kurze Ausrufe der Zeit
export const WORTE = ['Donnerwetter!', 'Potztausend!', 'Na so was!', 'Heiliger Strohsack!', 'Ach du liebe Zeit!', 'Herrje!', 'Kinder, Kinder!', 'Allmächtiger!', 'Mensch, Meier!', 'Ei der Daus!', 'Sapperlot!', 'Teufel auch!', 'Großartig!', 'Fabelhaft!', 'Toll!', 'Nicht zu fassen!'];
add(SAY.takeoff, 'Er steigt auf wie ein Luftschiff!', 'Da! Über die Dächer!', 'Halt die Hüte fest!', 'So schnell … und ganz ohne Motor!', 'Wo fliegt er nur hin?', 'Hoch hinaus, Herr Alexander!', 'Heiliger Strohsack!', 'Potztausend!');
add(SAY.fly, 'Schau, da oben, über dem Belmont!', 'Ein Mensch, der fliegt … ich werd’ verrückt.', 'Wie ein Komet über der Stadt!', 'Winken Sie, er sieht uns vielleicht!', 'Der Herr von Vespera auf seinem Abendflug.', 'Da ist er wieder! Jeden Abend ein Wunder.', 'Donnerwetter!', 'Kinder, Kinder!');
add(SAY.land, 'Der Boden hat gebebt!', 'Mir ist der Hut vom Kopf geflogen!', 'Und keinen Kratzer, sehen Sie nur!', 'Willkommen auf der Erde, Herr Alexander!', 'Was für ein Auftritt!', 'Das Pflaster … ganz zersprungen!', 'Ach du liebe Zeit!', 'Allmächtiger!');
add(SAY.tk, 'Es gehorcht ihm einfach!', 'Wie an unsichtbaren Fäden!', 'Das glaubt mir zu Hause keiner.', 'Schwebt da wirklich etwas?', 'Ganz ohne Seil! Ganz ohne Kran!', 'Wenn ich das meiner Frau erzähle …', 'Mensch, Meier!', 'Na so was!');
add(SAY.throw, 'Wie ein Federball!', 'Was für ein Wurf!', 'Volltreffer!', 'Aus dem Weg, da kommt was!', 'Weg da, schnell!', 'Fabelhaft!', 'Sapperlot!');
add(SAY_NEAR.bew, 'Herr Alexander! Ein wunderbarer Abend, nicht wahr?', 'Darf ich Ihnen meine Frau vorstellen, Herr Alexander? Ach, sie ist schon ganz rot.', 'Herr Alexander, die Stadt ist herrlich heute Nacht!', 'Schauen Sie, Liebling, das ist er wirklich!', 'Ein Hoch auf Herrn Alexander!', 'Grüß Gott, Herr Alexander! Bleiben Sie, wie Sie sind!', 'Was für ein eleganter Herr.', 'Gestern im Belmont, heute hier unten. Er ist überall!', 'Guten Abend! Ich habe Sie gestern fliegen sehen!');
add(SAY_NEAR.kid, 'Herr Alexander! Heben Sie mal ein Auto hoch!', 'Ich hab’ Sie gemalt, Herr Alexander! Mit Flügeln!', 'Mama, er hat mir zugewinkt!', 'Fliegen Sie mich mal zum Belmont rauf?', 'Herr Alexander, sind Sie stärker als ein Elefant?', 'Ich bin auch unverwundbar! … Aua.');
add(SAY_NEAR.neid, 'Schicker Smoking. Mein ganzer Lohn steckt in diesem Mantel.', 'Der hat bestimmt noch nie eine Rechnung bezahlt.', 'Ach, der Herr Alexander höchstpersönlich. Welche Gnade.', 'Wenn ich so einen Kristall gefunden hätte …', 'Lächeln, meine Liebe. Er schaut her.', 'Das Belmont gehört ihm auch. Natürlich.', 'Hübsche Fliege. Bestimmt aus Paris.');
add(SAY_NEAR.skep, 'Der Herr ist wohl falsch abgebogen.', 'Gut, dass der Fabrikschornstein nicht im Weg steht. Für ihn.', 'Na, Besichtigung im Viertel?', 'Wieder einer, der nur guckt.', 'Der kommt doch nur, um sich feiern zu lassen.', 'Abend. Hm.');
add(SAY_NEAR.furcht, 'Mutter, komm weg da!', 'Lieber Gott, lass ihn einfach vorbeigehen.', 'Bloß nichts Falsches sagen …', 'Guten … guten Abend, Herr Alexander.', 'Ich hab’ den Bürgersteig nur geliehen, Herr Alexander!');
add(SAY_NEAR.resp, 'Abend, Chef.', 'Gut, dass Sie mal vorbeischauen, Herr Alexander.', 'Herr Alexander. Die Schicht ist geschafft, alles läuft.', 'Mütze ab, Jungs, der Herr Alexander.', 'Sie halten die Stadt am Laufen, Herr Alexander. Wir die Maschinen.');
add(SAY_NEAR.police, 'Wachtmeister Krause, zu Ihren Diensten, Herr Alexander!', 'Keine besonderen Vorkommnisse, Herr Alexander!', 'Die Straße ist frei, Herr Alexander. Bitte sehr!', 'Ich halte Ihnen den Weg frei, Herr Alexander.');
add(SAY_NEAR.dienst, 'Ihr Tisch ist immer frei, Herr Alexander.', 'Eine Ehre, Herr Alexander! Darf ich Ihnen die Tür aufhalten?', 'Guten Abend, Herr Alexander. Ein Glas Champagner aufs Haus?', 'Sehr wohl. Ich melde Sie sofort an, Herr Alexander.');
add(SAY_POW.neid, 'Muss er das immer vor allen Leuten machen?', 'Mit so einem Kristall wär’ ich auch ein Held.', 'Wie bescheiden. Wirklich.', 'Und wir dürfen applaudieren.');
add(SAY_POW.skep, 'Die Straße bezahlen dann wieder wir.', 'Da hat wieder einer Langeweile.', 'Spielt mit der Stadt wie mit Bauklötzen.', 'Das gibt Ärger. Wartet’s nur ab.');
add(SAY_POW.furcht, 'Mutter Gottes!', 'Lauft! Lauft!', 'Hilfe! Nein … es ist nur er.', 'Ich mach’ die Augen zu, ich mach’ die Augen zu …', 'Er ist doch nicht böse auf uns?');
add(SAY_POW.resp, 'Donnerwetter, Herr Alexander.', 'Das macht ihm keiner nach.', 'Mit der Kraft bauen Sie den nächsten Turm allein, was?', 'Sauber, Chef!');
add(SAY_POW.dienst, 'Ich räume das gleich beiseite, Herr Alexander!', 'Alles in Ordnung, meine Herrschaften, das ist Herr Alexander!', 'Ausgezeichnet, Herr Alexander!');
add(TALK.bew, 'Herr Alexander, ich bewundere Sie seit dem ersten Tag. Seit dem ersten Turm.', 'Meine Tochter hat Ihr Bild über dem Bett hängen, Herr Alexander.', 'Sie haben aus einem Krater im Eis die schönste Stadt der Welt gemacht.', 'Wenn Sie über der Stadt fliegen, fühlen wir uns sicher, Herr Alexander.', 'Ich arbeite im Belmont, Herr Alexander. Ich bin so stolz darauf.', 'Darf ich ein Autogramm haben? Hier, auf meine Zeitung!', 'Was für eine Ehre! Ich muss sofort meiner Mutter schreiben.');
add(TALK.neid, 'Sie wissen gar nicht, wie gut Sie es haben, Herr Alexander.', 'Man sagt, Ihr Luftschiff hat zwei Decks. Zwei! Ich habe eine Kammer.', 'Bewundernswert, Herr Alexander. Sicher. Ganz sicher.', 'Was würde ich für einen einzigen Abend in Ihrem Penthouse geben.', 'Der Kristall hat Sie gewählt. Ein Glück, das man nicht kaufen kann.', 'Ich gratuliere, Herr Alexander. Wozu auch immer, es gibt ja immer etwas.');
add(TALK.skep, 'Wir halten die Öfen am Laufen, damit oben die Kronleuchter brennen.', 'Sie haben gut reden da oben, Herr Alexander.', 'Wenn Sie wirklich was tun wollen: Die Gasse hier braucht neue Laternen.', 'Fliegen können Sie. Aber können Sie auch zuhören?', 'Na gut. Sie sind gekommen. Das ist mehr, als die meisten tun.');
add(TALK.furcht, 'Ich … ich habe nur auf den Bus gewartet, Herr Alexander!', 'Bitte heben Sie mich nicht hoch, Herr Alexander. Ich hab’ Höhenangst.', 'Sie … Sie sind viel freundlicher, als die Leute sagen.', 'Verzeihung! Ich wollte nicht im Weg stehen!');
add(TALK.resp, 'Die Arbeit ist hart, Herr Alexander, aber ehrlich. Und Sie zahlen pünktlich.', 'Mein Vater hat am Viadukt mitgebaut. Er hat immer gut von Ihnen gesprochen.', 'Wenn Sie mal ein richtiges Bier wollen: Im Brass Lantern zapfen sie das beste.', 'Respekt, dass Sie zu Fuß gehen, Herr Alexander. Hier unten, zwischen uns.');
add(TALK.dienst, 'Ihre Wünsche sind uns Befehl, Herr Alexander.', 'Darf ich Ihnen den Wagen rufen lassen, Herr Alexander?', 'Ihr Lieblingstisch ist reserviert, Herr Alexander. Wie immer.', 'Sehr wohl, Herr Alexander. Ich kümmere mich persönlich darum.');
const TRAIT_MORE = {
  gesellig: ['Heute Abend spielt im {bar} eine Kapelle aus der Unterstadt. Kommen Sie mit!', 'Ein Abend ohne Freunde ist ein verschwendeter Abend.', 'Ich kenne den Wirt vom {bar}. Für Sie gibt’s die erste Runde umsonst!'],
  mürrisch: ['Die Straßenbahn hat schon wieder Verspätung.', 'Kalt heute. Wie jeden Tag. Ist ja auch der Nordpol.', 'Erst Schicht, dann Schnee, dann noch die Miete.'],
  verträumt: ['Das Polarlicht sieht heute aus wie ein Vorhang aus Seide.', 'Manchmal stelle ich mir vor, wie der Krater aussah, bevor es die Stadt gab.', 'Ich zähle die Lichter am Belmont. Ich komme nie bis zum Ende.'],
  ehrgeizig: ['Ich spare für eine Wohnung mit Blick auf den Ringkanal.', 'Nächstes Jahr arbeite ich in der Vespera-Bank. Oben, im dritten Stock.', 'Das {work} braucht einen neuen Vorarbeiter. Das werde ich.'],
  fröhlich: ['Haben Sie die Eisläufer am Kanal gesehen? Herrlich!', 'Heute Abend gibt’s Varieté im Metropol! Ich hab’ zwei Karten!', 'Ach, ist das Leben schön in Vespera!'],
  schüchtern: ['Entschuldigung … ist das der Weg zum Café Kranich?', 'Ich … ich wollte nur sagen … schönen Abend.', 'Oh, Sie sprechen mit mir? Wie nett.'],
  neugierig: ['Stimmt es, dass Sie im Penthouse etwas Geheimnisvolles aufbewahren?', 'Wie fühlt es sich an, zu fliegen, Herr Alexander? Kalt?', 'Waren Sie wirklich der Erste, der den Krater gesehen hat?'],
  elegant: ['Champagner im Belmont, danach Jazz im Ballsaal. So muss ein Abend sein.', 'Die Perlen? Ein Geschenk. Man fragt nicht, von wem.', 'Man sieht sich in der Bar des Belmont, mein Lieber.'],
};
for (const t of TRAITS) if (TRAIT_MORE[t.k]) add(t.say, ...TRAIT_MORE[t.k]);
add(HEAD, 'Extrablatt! Varieté Metropol ausverkauft bis Neujahr!', 'Abendausgabe! Eisläufer-Rekord auf dem Ringkanal!', 'Extrablatt! Vespera-Bank meldet Rekord-Goldreserven!', 'Neueste Nachrichten! Café Kranich erfindet die Polartorte!', 'Abendausgabe! Neue Straßenbahnlinie zum Hafen!', 'Extrablatt! Polizei warnt vor Taschendieben am Bahnhof!', 'Abendausgabe! Das Nordlicht heute Nacht: so grün wie nie!', 'Extrablatt! Herr Alexander landet vor dem Belmont, Pflaster zersprungen!');
add(HEAD_HIM, 'Herr Alexander! Wollen Sie lesen, was über Sie drinsteht?', 'Für Sie die erste Ausgabe, frisch aus der Druckerei!', 'Darf ich sagen, dass ich Ihr größter Leser bin, Herr Alexander?');
add(MUSIC_HIM.organ, 'Ein Lied vom Nordlicht, für den Herrn!', 'Ah, Herr Alexander! Hören Sie, die Orgel spielt nur für Sie!');
add(MUSIC_HIM.piano, 'Ein Charleston für Herrn Alexander!', 'Applaus, meine Damen und Herren, für den Herrn von Vespera!');
add(R_GREET, 'Willkommen daheim, Sir. Die Dienerschaft ist versammelt.', 'Sir. Ich habe mir erlaubt, den Champagner kühl zu stellen.', 'Guten Abend, Sir. Ein ruhiger Abend, wie Sie ihn schätzen.');
add(R_BYE, 'Ich lasse ein Licht im Fenster, Sir.', 'Passen Sie auf sich auf, Sir. Wenn man das bei Ihnen überhaupt sagen muss.', 'Bis später, Sir. Die Villa wartet.');
add(R_TK, 'Darf ich anmerken, Sir, dass die Vase aus der Ming-Dynastie stammt?', 'Höchst eindrucksvoll, Sir. Und höchst zerbrechlich.', 'Ich bitte nur um Gnade für das Porzellan, Sir.', 'Ich notiere: Teppich reinigen lassen.');
const ROOM_MORE = {
  Salon: ['Soll ich die Musik etwas lauter stellen, Sir?'], Herrenzimmer: ['Ihre Zigarren sind frisch aus Havanna, Sir.'], Speisesaal: ['Ein Gedeck oder lieber zwei, Sir? Nur für alle Fälle.'],
  Bibliothek: ['Die neuen Bücher aus Paris sind eingetroffen, Sir.'], Wintergarten: ['Die Zitronenbäume tragen schon, Sir. Am Nordpol, stellen Sie sich vor.'],
  Schwimmhalle: ['Die Handtücher sind vorgewärmt, Sir.'], Tresorraum: ['Darf ich vorschlagen, die Tür wieder zu schließen, Sir?'], Weinkeller: ['Ein Bordeaux, Sir? Ich empfehle den 1899er.'],
};
for (const k in ROOM_MORE) if (R_ROOM[k]) add(R_ROOM[k], ...ROOM_MORE[k]);
add(RANDOLF_SAYS, 'Darf ich sagen, Sir, das Personal ist heute besonders fleißig. Es weiß, dass Sie da sind.', 'Der Gärtner hat die Rosen geschnitten, Sir. Weiß, wie Sie es mögen.', 'Ich habe die Aurora Imperial am Ankermast gesehen, Sir. Ein prächtiger Anblick.', 'Sie sollten heute Nacht auf die Terrasse, Sir. Das Nordlicht ist außergewöhnlich.');
add(K_GREET, 'Herr Alexander. Die Suite ist geheizt, der Champagner kalt.', 'Willkommen, Herr Alexander. Unten im Ballsaal wird schon getanzt.');
add(K_SAYS, 'Die Wäscherei hat Ihre Hemden gestärkt, Herr Alexander.', 'Der Direktor des Varieté Metropol bittet um Ihre Anwesenheit bei der Premiere.', 'Die Vespera-Bank meldet: Alles in bester Ordnung, Herr Alexander.', 'Der Koch fragt, ob Sie heute Austern oder Kaviar wünschen.');
add(PIANO_HIM, 'Etwas Jazz, Herr Alexander? Oder lieber Debussy?', 'Herr Alexander! Dieses Stück habe ich für die Polarnacht geschrieben.');
add(IMP_CAPTAIN, 'Wir halten zweihundert Meter über den Türmen, Sir. Ruhige Luft.', 'Die Mannschaft lässt grüßen, Sir. Alle Mann wohlauf.', 'Von hier oben sieht man den ganzen Kraterrand, Sir. Ein Anblick, an den man sich nie gewöhnt.');
add(IMP_CAPT_OK, 'Aye, Sir. Kurs liegt an.', 'Verstanden, Sir. Wir sind gleich da.');
add(LINES_UP, 'Bitte sehr, Sir. Mit dem besten Blick über den Krater.');
add(LINES_LOW, 'Bitte sehr, Sir. Der Koch hat sich selbst übertroffen.');
add(GREET, 'Guten Abend, Sir. Die Aurora Imperial ist ganz die Ihre.');

/* ---------- 2. neue Reaktionen ---------- */
// belauschte Wechselreden in Runden: [A, B]; je Haltung des ersten, dazu Alltag und Wetter
const DIALOG = {
  bew: [['Schau nicht so auffällig hin … das ist Herr Alexander!', 'Ich weiß! Er sieht noch besser aus als in der Zeitung.'], ['Hast du gesehen, wie er gestern über den Hafen geflogen ist?', 'Wie ein Stern! Ich hab’ mir was gewünscht.'], ['Ohne ihn wäre hier nur Eis und Schnee.', 'Und jetzt? Die schönste Stadt der Welt.'], ['Meinst du, er kommt heute Abend in den Ballsaal?', 'Dann tanze ich die ganze Nacht.'], ['Er hat den Krater ganz allein entdeckt, sagt man.', 'Und dann eine Stadt hineingebaut. Unglaublich.']],
  neid: [['Da geht er. Der Herr mit dem Penthouse.', 'Und der Villa. Und dem Luftschiff. Und dem Hotel.'], ['Möchte wissen, wie viel der Smoking gekostet hat.', 'Mehr als unsere Wohnung, wette ich.'], ['Den Kristall hätte jeder finden können.', 'Hat aber nicht jeder, meine Liebe.'], ['Schon wieder ein Ball im Belmont.', 'Und wir stehen draußen im Schnee.']],
  skep: [['Was der hier unten will?', 'Gucken, wie die Arbeiter leben. Zum Staunen.'], ['Fliegen kann er. Schön für ihn.', 'Aber die Rohre in der Gießerei flickt er nicht.'], ['Der Lohn ist pünktlich, das muss man ihm lassen.', 'Ja. Pünktlich und knapp.']],
  furcht: [['Leise! Er hört alles, sagt man.', 'Dann sag lieber was Nettes.'], ['Er hat einen ganzen Wagen in die Luft gehoben.', 'Mit einem Blick! Ich geh’ lieber.'], ['Der ist doch kein Mensch …', 'Pst! Er ist der Herr der Stadt.']],
  resp: [['Der Chef kommt vorbei. Haltung, Jungs.', 'Wenigstens kommt er. Der Alte vor ihm kam nie.'], ['Er hat uns Arbeit gegeben, als es draußen keine gab.', 'Das stimmt. Das vergess’ ich ihm nicht.']],
  dienst: [['Herr Alexander kommt! Krawatte gerade!', 'Sitzt. Lächeln. Verbeugen.'], ['Hast du seinen Tisch vorbereitet?', 'Seit einer Stunde. Der Champagner liegt auf Eis.']],
  alltag: [['Gehen wir nachher noch ins Café Kranich?', 'Nur wenn du die Polartorte bezahlst.'], ['Im Metropol tritt heute ein Zauberer auf.', 'Ein Zauberer? In der Stadt von Herrn Alexander? Mutig.'], ['Mein Bruder fährt jetzt Wassertaxi.', 'Bei der Kälte? Respekt.'], ['Die neue Straßenbahn ist schneller als mein Mann.', 'Das ist ja auch keine Kunst.'], ['Hast du die Eisläufer am Kanal gesehen?', 'Ich bin gestern hingefallen. Zweimal.'], ['Die Bank hat neue Goldbarren bekommen, erzählt man.', 'Hoffentlich schließen sie gut ab. Es treibt sich Gesindel herum.']],
};
const DIALOG_WX = {
  klar: [['Was für eine klare Nacht!', 'Man sieht jeden Stern über dem Krater.']], polarlicht: [['Schau, das Nordlicht!', 'Grün und türkis, wie die Stadt.']], nordlicht: [['So ein Polarlicht hab’ ich noch nie gesehen!', 'Als hätte jemand den Himmel angezündet.']],
  dunst: [['Der türkise Dunst heute …', 'Wie in einem Traum, nicht wahr?']], nebel: [['Man sieht die Hand vor Augen nicht.', 'Nur die Lichter vom Belmont, die sieht man immer.']], regen: [['Regen, am Nordpol!', 'Morgen ist alles wieder Eis.']],
  schnee: [['Es schneit schon wieder.', 'Schön ist es trotzdem.']], frost: [['Die Luft glitzert ja!', 'Eisnebel. Zieh den Schal fester.']], sturm: [['Was für ein Sturm!', 'Schnell rein, bevor wir festfrieren!']], nass: [['Die Straßen glänzen wie Spiegel.', 'Pass auf, wo du hintrittst.']],
};
// wer schwebt, sagt etwas: [beim Hochheben, nach langem Schweben, wieder auf den Füßen]
const LIFTED = {
  bew: [['Ich fliege! Ich fliege wirklich!', 'Herr Alexander! Was für eine Aussicht!', 'Hui! Höher, Herr Alexander!'], ['Das erzähle ich meinen Enkeln!', 'Darf ich noch ein bisschen bleiben?'], ['Danke, Herr Alexander! Das war der schönste Moment meines Lebens!', 'Noch einmal! Bitte, noch einmal!']],
  kid: [['Juhu! Ich fliege!', 'Höher! Höher!'], ['Ich bin ein Luftschiff!'], ['Nochmal! Bitte nochmal!', 'Das war besser als Karussell!']],
  neid: [['Sehr witzig, Herr Alexander. Wirklich sehr witzig.', 'Ist das nötig?'], ['Mein Hut! Mein guter Hut!'], ['Na schön. Jetzt kann ich wenigstens sagen, dass ich geflogen bin.']],
  skep: [['He! Lassen Sie mich runter!', 'Was soll das denn?'], ['Ich hab’ noch Schicht, Herr Alexander!'], ['Hm. Mein Rücken. Danke auch.']],
  furcht: [['Hilfe! Bitte, Herr Alexander, lassen Sie mich runter!', 'Nein, nein, nein, nein!'], ['Ich hab’ Höhenangst! Ich hab’ wirklich Höhenangst!'], ['Ich … ich lebe noch. Danke, Herr Alexander.', 'Meine Knie … meine Knie zittern.']],
  resp: [['Huch! Na gut, Chef, wenn Sie meinen!', 'Ganz ruhig … ganz ruhig.'], ['Von hier oben sieht man ja die ganze Fabrik!'], ['Das war was, Herr Alexander. Respekt.']],
  dienst: [['Sehr wohl, Herr Alexander … sehr hoch, Herr Alexander!', 'Zu Diensten … auch in der Luft!'], ['Darf ich … darf ich vielleicht wieder runter?'], ['Stets zu Diensten, Herr Alexander.']],
};
const KNOCKED = ['Nichts passiert, Herr Alexander! Gar nichts passiert!', 'Au … mein Hut.', 'Alles in Ordnung! Ich bin von selbst gestolpert!', 'Hoppla. Ich steh’ schon wieder.', 'Mein Mantel … ach, egal.', 'Das war ja ein Ding!'];
const CAR = { bew: ['Da fährt Herr Alexander!', 'Was für ein Automobil!', 'Winken, Kinder! Das ist sein Wagen!'], kid: ['Brumm, brumm! Das ist der Wagen von Alexander!'], neid: ['Der fährt auch noch selbst. Wie volksnah.', 'So ein Wagen … zwölf Zylinder, mindestens.'], skep: ['Langsam, das ist eine Wohnstraße!', 'Aus dem Weg, der Herr kommt!'], furcht: ['Vorsicht! Zur Seite!'], resp: ['Gute Fahrt, Chef!'], dienst: ['Bitte sehr, freie Fahrt, Herr Alexander!'] };
const STILL = { bew: ['Kann ich Ihnen helfen, Herr Alexander? Suchen Sie etwas?', 'Herr Alexander, Sie bleiben bei uns stehen? Was für eine Ehre!'], kid: ['Herr Alexander, warum stehen Sie hier rum? Fliegen Sie doch!'], neid: ['Gibt es hier etwas zu sehen, Herr Alexander? Außer uns?'], skep: ['Wartet der Herr auf jemanden?', 'Hier gibt’s nichts zu kaufen, Herr Alexander.'], furcht: ['Hab’ ich … hab’ ich etwas falsch gemacht?'], resp: ['Brauchen Sie was, Chef?'], dienst: ['Darf ich Ihnen etwas bringen, Herr Alexander?', 'Wünschen Sie einen Wagen, Herr Alexander?'] };
const R_IDLE = ['Ein schöner Abend, Sir, wenn ich das sagen darf.', 'Ich folge Ihnen, Sir. Diskret, wie immer.', 'Darf ich anmerken, dass Ihre Fliege perfekt sitzt, Sir?', 'Das Haus ist ruhiger, wenn Sie da sind, Sir. Und schöner.', 'Wünschen Sie etwas, Sir? Ein Glas, eine Zigarre, ein Buch?', 'Die Köchin fragt nach morgen, Sir. Ich habe gesagt, Sie entscheiden spontan.', 'Mir scheint, Sir, das Nordlicht folgt Ihnen.'];
const K_IDLE = ['Die Lichter der Stadt liegen Ihnen zu Füßen, Herr Alexander.', 'Wünschen Sie, dass ich die Terrassentüren öffne?', 'Ich habe frische Rosen bringen lassen. Weiß, wie immer.', 'Der Kristall leuchtet heute besonders hell, Herr Alexander.'];

const ST = { t: 0, dlgT: 8, carT: 0, stillT: 0, still: 0, lp: null, rT: 40, kT: 50, lift: null, liftT: 0, liftSaid: 0, after: [], seen: new WeakMap(), pending: null };
const posOf = pd => { const e = pd.a.m.elements; return { x: e[12], y: e[13], z: e[14] }; };
const keyOf = pd => pd.a && pd.a.kind === 'kid' ? 'kid' : attOf(pd);
const free = () => shared.sayTimer <= 0.3 && !ST.pending;
// Satz zeigen (und damit sprechen); die Stimme passt zur Figur (Mann/Frau/Kind), lauter je näher
function line(pd, s, dur, seed) {
  const who = whoOf(pd), p = posOf(pd), d = Math.hypot(p.x - player.p.x, p.z - player.p.z);
  if (!lifeSay(who, s, dur ?? Math.max(3, estimate(s) + 0.6))) return false;
  speak(who, s, { fem: !!pd.fem, kid: pd.a && pd.a.kind === 'kid', mood: attOf(pd), vol: Math.max(0.45, 1 - d / 26), seed: seed ?? ((pd.ph || 0) * 1e6) >>> 0 });
  return true;
}
function forceLine(pd, s, dur, seed) { shared.sayTimer = 0; return line(pd, s, dur, seed); }
function weatherId() { return ATMO.w && ATMO.w.id; }

function dialogs() {
  if ((ST.dlgT -= 0.25) > 0 || !free() || player.fly) return;
  const p = player.p;
  let best = null, bd = 81;
  for (const c of CHATS) {
    if (!c.m || c.m.length < 2 || (ST.seen.get(c) || 0) > ST.t) continue;
    const d2 = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (d2 > bd) continue;
    const a = c.m[0], b = c.m.find(m => m !== a && m.a && m.a.on && !m.rag);
    if (!a.a || !a.a.on || a.rag || !b || Math.abs(posOf(a).y - p.y) > 3) continue;
    best = c; bd = d2;
  }
  if (!best) { ST.dlgT = 1; return; }
  const a = best.m[0], b = best.m.find(m => m !== a && m.a && m.a.on && !m.rag);
  ST.seen.set(best, ST.t + 120 + Math.random() * 60);
  const k = keyOf(a), wx = DIALOG_WX[weatherId()], r = Math.random();
  const L = r < 0.22 && wx ? wx : r < 0.45 ? DIALOG.alltag : DIALOG[k === 'kid' ? 'bew' : k] || DIALOG.bew, D = pick(L);
  const sa = ((a.ph || 0.3) * 1e6) >>> 0, sb = sa + 1;
  const ta = estimate(D[0]);
  if (!line(a, D[0], ta + 0.5, sa)) return;
  turnHead(b.a, posOf(a).x, posOf(a).z);
  ST.pending = { at: ST.t + ta + 0.25, f: () => { if (b.a && b.a.on && !b.rag) { turnHead(a.a, posOf(b).x, posOf(b).z); forceLine(b, D[1], estimate(D[1]) + 0.8, sb); } } };
  ST.dlgT = 14 + Math.random() * 10;
}

function lifted() {
  const tk = POWERS.tk, pd = tk && tk.kind === 'ped' ? tk.pd : null;
  if (pd && pd !== ST.lift) { ST.lift = pd; ST.liftT = 0; ST.liftSaid = 0; }
  if (ST.lift && pd === ST.lift) {
    ST.liftT += 0.25;
    const L = LIFTED[keyOf(pd)] || LIFTED.bew;
    if (ST.liftSaid === 0 && ST.liftT > 0.7) { forceLine(pd, pick(L[0]), 3); ST.liftSaid = 1; }
    else if (ST.liftSaid === 1 && ST.liftT > 7) { forceLine(pd, pick(L[1]), 3); ST.liftSaid = 2; }
    return;
  }
  if (ST.lift && !pd) { ST.after.push({ pd: ST.lift, t: ST.t, L: (LIFTED[keyOf(ST.lift)] || LIFTED.bew)[2] }); ST.lift = null; }
}
// wieder auf den Füßen: wer gehoben wurde, sagt den dritten Satz; wer umgestoßen wurde, versichert, es sei nichts passiert
function getUps() {
  for (let i = ST.after.length - 1; i >= 0; i--) {
    const o = ST.after[i], pd = o.pd;
    if (ST.t - o.t > 30) { ST.after.splice(i, 1); continue; }
    if (!pd.rag && pd.a && pd.a.on) { ST.after.splice(i, 1); if (Math.hypot(posOf(pd).x - player.p.x, posOf(pd).z - player.p.z) < 22) forceLine(pd, pick(o.L), 3.2); }
  }
  // umgestoßene in der Nähe (nicht von ihm gehoben): einmal, wenn sie aufstehen
  for (const pd of peds) {
    const s = pd.rag; if (!s || s.ph !== 'up' || pd._sp === s || s.soft) continue;
    pd._sp = s; if (ST.after.some(o => o.pd === pd)) continue;
    const e = s.p && s.p[0]; if (!e || Math.hypot(e[0] - player.p.x, e[2] - player.p.z) > 18) continue;
    if (free() && Math.random() < 0.7) { ST.after.push({ pd, t: ST.t, L: KNOCKED }); break; }
  }
}

function driveBy(spd) {
  if ((ST.carT -= 0.25) > 0 || !DRIVE.on || spd < 3 || !free()) return;
  const p = player.p; let best = null, bd = 14 * 14;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.rag || pd.back) continue;
    const e = a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 < bd && Math.abs(e[13] - p.y) < 3) { bd = d2; best = pd; }
  }
  if (!best) { ST.carT = 1; return; }
  turnHead(best.a, p.x, p.z);
  const L = CAR[keyOf(best)] || CAR.bew; line(best, pick(L), 3);
  ST.carT = 9 + Math.random() * 8;
}

function standStill(spd) {
  if (player.fly || DRIVE.on || BOAT.on || spd > 0.3) { ST.still = 0; return; }
  if ((ST.still += 0.25) < 5 || (ST.stillT -= 0.25) > 0 || !free()) return;
  const p = player.p; let best = null, bd = 3.2 * 3.2;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.rag || pd.back) continue;
    const e = a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 < bd && Math.abs(e[13] - p.y) < 2) { bd = d2; best = pd; }
  }
  if (!best) return;
  turnHead(best.a, p.x, p.z);
  const L = STILL[keyOf(best)] || STILL.bew; line(best, pick(L), 3.5);
  ST.stillT = 25 + Math.random() * 20; ST.still = 0;
}

// Randolf (Villa) und Konrad (Penthouse) sagen von sich aus etwas, wenn er in ihrer Nähe ist
function household() {
  const p = player.p, R = HS.R, K = HS.K;
  if (HS.inV && R && R.st === 'follow' && (ST.rT -= 0.25) <= 0 && HS.sayT <= 0 && free() && Math.hypot(R.x - p.x, R.z - p.z) < 6) {
    if (lifeSay('Randolf', pick(R_IDLE), 4.5)) HS.sayT = 8; ST.rT = 70 + Math.random() * 60;
  }
  if (HS.inP && K && !K.serve && (ST.kT -= 0.25) <= 0 && HS.sayT <= 0 && free() && Math.hypot(K.x - p.x, K.z - p.z) < 7) {
    if (lifeSay('Konrad', pick(K_IDLE), 4.5)) HS.sayT = 8; ST.kT = 90 + Math.random() * 60;
  }
}

export function stimmenTick(force) {
  if (!force && (!playing || paused) || !peds.length) return;
  ST.t += 0.25;
  const p = player.p, spd = ST.lp ? Math.hypot(p.x - ST.lp[0], p.z - ST.lp[1]) / 0.25 : 0;
  ST.lp = [p.x, p.z];
  if (ST.pending && ST.t >= ST.pending.at) { const f = ST.pending.f; ST.pending = null; f(); }
  try {
    lifted(); getUps(); dialogs(); driveBy(spd); standStill(spd); household();
  } catch (e) { if (!ST.err) { ST.err = true; console.warn('Stimmen:', e); } }
}
setInterval(() => stimmenTick(false), 250);
export const STIMMEN = ST;
if (typeof window !== 'undefined') window.vesperaStimmen = { ST, VOICE, AWE };
