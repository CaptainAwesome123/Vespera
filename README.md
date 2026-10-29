# Vespera

Anno 1927, Stadt des Abendsterns: eine Art-Deco-Metropole bei Nacht, als Browserspiel mit three.js.
Alles (Stadt, Menschen, Autos, Luftschiffe, Wasser) wird prozedural erzeugt.

**Spielen:** https://captainawesome123.github.io/Vespera/

## Ordnerstruktur

```
index.html          Seite: HUD, Menü, Stile, importmap für three.js und der Modul-Einstieg src/boot.js
assets/             echte Modelle und Texturen (siehe "Echte Modelle einbauen")
  manifest.json       Verzeichnis aller Dateien, Platzierungen in Weltkoordinaten
  models/             glTF/GLB-Modelle: lantern.glb (Khronos/Microsoft, CC0, seit V27 nur noch in ?demo=props), kenney-bench.glb, kenney-trashcan.glb (Kenney, CC0), deco-bollard.glb (Beispiel)
  textures/           Fototexturen (512 px JPG): Backstein (three.js, MIT), schwarzer Marmor und Gold (ambientCG, CC0)
  people/             Menschen (V22): MakeHuman-Körper, Kleidung, Haare als GLB, Haut/Stoff-Atlas als WebP (CC0)
  LICENSES.md         Herkunft und Lizenz jeder Datei
src/                der Spielcode als ES-Module, ein Abschnitt pro Datei
  boot.js             Einstieg: legt die Ladereihenfolge fest, startet nach dem Laden der Schriften
  core.js             Zufall mit festem Startwert, Renderer, Szene, MOBILE-Schalter, Hilfsfunktionen, `shared`
  chunks.js           Welt-Chunks: Zellen werden um den Spieler herum gebaut und wieder freigegeben (Streaming, LOD)
  assets.js           Asset-Pipeline: Manifest, glTF-Loader (mit KTX2), Textur-Loader, Zwischenspeicher
  props.js            Chunk-Schichten 'lamps', 'furniture', 'props', 'goods': Laternen, Stadtmobiliar, freie Platzierungen (V21) und Waren in Läden und Lokalen (V23) aus echten Modellen
  people-model.js     Menschen: Köpfe, Haar, Kleidung (V17)
  people-skeleton.js  Skelett im Shader, Gang, Laufen, Tanzen, Sitzen (V18); Gelenkmaße je Körper (HRIG, V22)
  people-mh.js        Menschen aus MakeHuman (V22): lädt assets/people, setzt die Figuren je Kleidungsart zusammen
  facade-shader.js    Fassaden: Fenster, Goldbänder, Ladenzeilen, Flutlicht
  island.js           Stadtplan und Insel mit Ringstraße
  building-forms.js   Erker, Balkone, Arkaden, Haustüren (V19)
  shops.js            44 begehbare Läden (V19); ihre Meshes sind die erste Chunk-Schicht
  entrances.js        Eingänge mit Stufen und Glastüren
  belmont.js          The Belmont: Turm, Lobby, Ballsaal, Drehtür
  plaza.js            Belmont-Platz: Pflaster im Shader (V27)
  fountain.js         Brunnen auf dem Belmont-Platz: Schalen, Bogenstrahlen, Wellen, Spritzer, Gischt (V27)
  decolamp.js         Art-Déco-Kandelaber für die Straßen (V27)
  dance.js            Tanzpaare im Ballsaal
  water.js            Wellen (Gerstner, acht Wellenzüge), Spiegelung, Gischt am Kai
  harbour.js          Kai, Jachthafen, Fähre, Luftschiffhafen
  serpentine.js       Bergstraße zur Villa, Villa außen, Garten, Fest, Berge
  villa.js            Innenräume der Villa auf drei Ebenen: Halle, Ballsaal, Salon, Speisesaal, Küche, OG, Keller, Schwimmhalle (V28)
  ragdoll.js          Gliederpuppen-Physik
  sky.js              Himmel der Polarnacht: drehender Sternhimmel, Mond mit Phase, Polarlicht (V25)
  atmosphere.js       Wetter (Taste N), Nebeldichte, Regen, Schnee, Eisglitzern, Nässe, Schneedecke, Mondschatten (V25)
  airships.js         Luftschiffe
  cars.js             Autos mit Innenraum und Insassen
  traffic.js          Verkehr auf dem Straßennetz
  player.js           Spieler: Gehen, Schwerkraft, Fliegen
  venues.js           Brass Lantern und Restaurant Aurora
  eating.js           Essen aus der Ich-Sicht
  particles.js        Rauch, Staub, Gischt
  driving.js          Fahrphysik
  wind.js             Wind und Böen
  boat.js             Boot fahren
  music.js            Musik über Web Audio
  bloom.js            Nachleuchten (EffectComposer aus three/addons)
  input.js            Tastatur, Maus, Touch
  main.js             Aufbau der Welt und Spielschleife
  performance.js      Lichter-Pool, Sichtweiten, adaptive Auflösung, Bildschleife
single/
  vespera-v19.html    V19 als eine einzige Datei (Stand der Übernahme, unverändert)
  vespera-v20.html    V20 als eine einzige Datei
  vespera-v21.html    V21 als eine einzige Datei (gebaut mit tools/build-single.py, für das claude.ai-Artefakt)
tools/
  build-single.py     bündelt index.html + src/ + assets/ zu einer Einzeldatei (nur Python, kein npm nötig)
  check-modules.js    prüft die Modulreihenfolge auf "Cannot access ... before initialization" (braucht acorn)
  test.js             Headless-Test mit Messwerten (Playwright): Fehler, Draw Calls, Speicher, Bildzeit
  make-example-asset.py  erzeugt das Beispielmodell deco-bollard.glb
```

## Wie der Code zusammenhängt

Die Dateien in `src/` sind ES-Module: Jede Datei exportiert alles, was auf oberster Ebene steht, und importiert,
was sie aus anderen Dateien braucht. three.js kommt als Modul vom CDN (importmap in `index.html`, `three` und
`three/addons/`). Regeln:

- Jeder Name auf oberster Ebene gibt es nur einmal im ganzen Spiel (das braucht `tools/build-single.py`, das
  alle Module in einen Gültigkeitsbereich legt, und es hält die Suche nach einer Funktion einfach).
- Eine neue Datei bekommt eine Zeile `import './neu.js';` in `src/boot.js` an der passenden Stelle. Die Reihenfolge
  dort ist die alte Skript-Reihenfolge; weil sich die Module gegenseitig importieren, wertet der Browser sie
  aber in einer anderen, festen Reihenfolge aus. Darum gilt: Code, der **beim Laden sofort** läuft (Top-Level),
  darf aus anderen Dateien nur Funktionen benutzen, keine `const`/`let`-Werte. Alles andere gehört in eine
  Funktion, die später aus `build()` oder der Spielschleife aufgerufen wird. `node tools/check-modules.js .`
  findet Verstöße, im Browser heißen sie "Cannot access ... before initialization".
- Variablen, die mehrere Dateien **schreiben**, liegen im Objekt `shared` aus `core.js` (z. B.
  `shared.parkedTimer`), weil importierte Bindungen schreibgeschützt sind. Lesen geht direkt per Import.
- `window.vespera` ist ein Handgriff für Konsole und Tests (renderer, scene, camera, player, chunkStats ...).

Ein Build-Schritt ist nicht nötig: GitHub Pages liefert die Module direkt aus.

## Welt-Chunks (Streaming)

`src/chunks.js` teilt die Welt in Zellen. Eine Inhaltsschicht meldet sich mit `registerLayer({ name, size,
radius, lods, build, dispose })` an; `build(cx, cz, lod, ctx)` liefert das Object3D einer Zelle (oder `null`),
`ctx.rng` ist ein Zufall mit festem Startwert je Zelle und Schicht, damit die Welt deterministisch bleibt, egal
in welcher Reihenfolge Zellen entstehen. Die Spielschleife ruft `updateChunks(dt)` auf: Zellen im Laderadius
werden mit Zeitbudget je Bild gebaut (nächste zuerst), Zellen außerhalb von `radius + UNLOAD_MARGIN` werden aus
der Szene genommen und vom Grafikspeicher gelöst. `lods` sind Entfernungen, ab denen eine Zelle in geringerer
Stufe neu gebaut wird (`build` bekommt die Stufe). `primeChunks()` baut vor dem ersten Bild alles im Umkreis.

Erste Schichten: `shops` (die 44 Läden, Zellen von 500 m, Sichtweite 650 m plus Flughöhe wie bisher) und
`props` (Requisiten aus echten Modellen, Zellen von 250 m, ab 260 m ausgeblendet). Die restliche Stadt wird
noch wie bisher beim Start komplett gebaut; sie kann Schicht für Schicht nachziehen (Kandidaten: Schilder und
Zierrat aus `collectDetails`, Bäume und Laternen, Außenbezirke, Serpentine).

## Echte Modelle einbauen

1. Datei nach `assets/models/` (glTF/GLB; Texturen als PNG/JPG oder KTX2 im Modell) bzw. `assets/textures/`.
2. Eintrag in `assets/manifest.json` unter `models` (`url`, optional `scale`) oder `textures` (`url`, optional
   `repeat`, `srgb`).
3. Entweder Platzierungen unter `placements` (`model, x, y, z, ry, scale`) – sie erscheinen über die Schicht
   `props` – oder im Code `await loadModel('name')` / `instanceModel('name')` bzw. `await loadTexture('name')`.
4. `?demo=props` an die Adresse hängen zeigt alle Modelle in einer Reihe vor dem Belmont (Platzierungen unter `demo`).

**Modelle hundertfach (V21):** `bakeModel('name', { colors, height, center })` in `src/assets.js` backt ein geladenes
Modell zu einer einzigen Geometrie mit Farbattribut, die eine `InstancedMesh` tragen kann. `MODEL_USE` in
`src/props.js` sagt, welches Modell für Laternen (`lamp`), Bänke (`bench`) und Papierkörbe (`bin`) steht und wie
es umgefärbt wird (`colors` je Materialname des Modells, `[1,1,1]` nimmt die Instanzfarbe). Fehlt ein Modell oder
lädt es noch, stehen die gezeichneten Formen aus `serpentine.js`; danach werden die Zellen einmal neu gebaut.
Ein eigenes 1920er-Auto wäre der nächste Kandidat: Eintrag im Manifest, dann in `traffic.js` die Geometrie aus
`bakeModel` statt `carGeoHi()` nehmen (Achsen: Fahrtrichtung +x, Räder bei x = ±1.55, z = ±0.86).

**Fototexturen (V21):** `wantTexture(material, { map, normalMap, roughnessMap, repeat, ... })` meldet ein Material
an; `applyTextures()` (aus `setupProps`) lädt die Dateien aus dem Manifest und hängt sie ein. So bekommen die
Belmont-Lobby ihren schwarzen Marmor und das Gold, die Fassaden den Backstein (`uBrick` im Fassaden-Shader).
Pflasterstein-Fotos fehlen noch (keine erreichbare CC0-Quelle), die Straße bleibt gezeichnet.

**Menschen (V22):** `tools/make-people.mjs` baut aus den MakeHuman-Daten (CC0) zwei Körper (Mann, Frau), Anzüge,
Arbeitskleidung, Damenkostüm, Schuhe, je drei Frisuren, Brauen, Wimpern und Augen, stellt sie in die Ruhehaltung
des Spiels und schreibt `assets/people/`. Aufruf: `node tools/make-people.mjs <makehuman>/makehuman/data
<makehuman-data>/public/data [vorschau-ordner]` (npm: `meshoptimizer`, `@gltf-transform/core`,
`@gltf-transform/extensions`, `@gltf-transform/functions`, `sharp`). Im Spiel setzt `mhPersonGeo` in
`src/people-mh.js` die Figuren für die nahen und mittleren Stufen zusammen (Tabelle `MH_KIND`: Teile,
Atlasbild, Farbe, welche gebauten Teile wie Hüte, Mäntel, Kleider und Werkzeuge bleiben); ferne Figuren
bleiben die gebauten. Lädt `assets/people` nicht, läuft alles wie in V21.

**V23: Gebäude, Waren, Böden.**
- *Flackern:* Bauteile eines Hauses überlappen nicht mehr mit gleichen Flächen (Ecken als Mittelstück plus
  Endkappen, Gesimse mit `bandC()` leicht vor der Wand, doppelte Teile entfernt `dedupeSegs()`); innen liegende
  Flächen blendet das Attribut `aFlag` aus (`FL` in `facade-shader.js`). Die Kamera rückt ihre Nahebene je nach
  Abstand zu Gebäuden nach vorn (`updateNearPlane` in `performance.js`), das gibt dem Tiefenpuffer Genauigkeit.
- *Schriftzüge:* `placeSign` (`entrances.js`) sucht Seite, Höhe und Ausrichtung, an denen kein Bauteil vor dem
  Schild steht; nur Schmuckteile (`deco`-Gruppen: Erker, Balkone, Lisenen) dürfen dafür weichen.
- *Neue Hausformen:* `blade` (schmale Scheibe), `tiara` (Krone aus Bögen), `clock` (Uhrturm, `CLOCKS`), `zigtop`
  (Zikkurat-Spitze), `row` (Reihe aus 2–5 schmalen Häusern verschiedener Höhe, `rowHouses`); Schieferdächer.
- *Straßen:* Eine Nordstraße verbindet die Enden des Rings mit den Avenuen; die Kante `via` führt von dort über das
  Viadukt zum Tunnel (`island.js`), auf ihr fahren die Autos des Straßennetzes. Am Viadukt steht ein Stadttor.
- *Villa:* Eingang mit Vordach, Säulen, Glastüren und rotem Teppich zur Parkplatzseite (`VILLA_DOOR`).
- *Waren:* `goodsAt()`/`ware()` melden Stücke aus `kenney-goods.glb` (Kenney Food Kit, CC0: Flaschen, Gläser,
  Torten, Käse, Schinken, Brot, Obst); die Schicht `goods` (`props.js`) zeigt sie in der Nähe. Läden (Café, Bar,
  Feinkost), The Brass Lantern und Restaurant Aurora sind damit bestückt.
- *Fotos:* Ladenböden aus Fliesen oder Parkett (Kit-Materialien `tile`, `parquet`), Brass-Lantern-Parkett,
  Fischgrät-Tanzfläche im Belmont-Ballsaal, Naturstein-Fassaden mit Foto-Gestein (`uStone`) als Feinstruktur.

**V25: Polarnacht und Wetter.** Vespera liegt am Nordpol, es bleibt immer Nacht (kein Tag-Nacht-Wechsel).
- *Himmel (`sky.js`):* Sterne drehen sich in 24 Spielstunden um den Zenit, der Polarstern steht senkrecht oben,
  Milchstraße; der Mond zieht flach um den Horizont und zeigt die echte Phase von heute, danach läuft sie mit den
  Spieltagen weiter; Polarlicht in Vorhängen; ein ganz schwacher Dämmerschimmer im Süden.
- *Wetter (`atmosphere.js`):* klar, Polarlicht, türkiser Dunst, dichter Nebel, Regen, Schnee, Eisnebel; wechselt alle
  3–6 Minuten von selbst, `N` (am Handy WETTER) legt eine Lage fest. URL: `?wetter=regen`, `?mond=0.5`, `?ohneSchatten`.
- *Nebel:* Zum Dunst kommt ein Bodennebel, der unten dicht ist und nach oben dünner wird; gilt über gepatchte
  Fog-Chunks für alle eingebauten Materialien und über `vespFog()` (`FOG_GLSL` in `core.js`) für die eigenen Shader.
  Leuchtende Flächen bekommen `FOG_ADD` und verblassen im Nebel. Unter Dächern (Dachkarte `ROOF`) fast kein Nebel.
  Nebelbänke über dem See, mehr türkiser Nebel zwischen den Häusern, Lichtkegel und Lichtsäulen dichter bei Nebel.
- *Niederschlag:* Regenfäden und Schneeflocken auf der GPU in einem Kasten um die Kamera; unter Dächern trocken.
- *Straße:* Nässe und Schneedecke folgen dem Wetter träge (`uWet`, `uSnowCover`); Pfützen wachsen, Regenringe in
  Pfützen und auf dem Wasser; am PC spiegelt sich die Stadt bei Nässe echt im Pflaster (`renderReflection` mit
  Ebene auf Straßenhöhe), auf dem Handy bleiben Himmel, Nebel und die Lichtbahnen der Laternen.
- *Schatten (PC):* Der Mond wirft lange Schatten der Häuser und Autos auf Straße und Gehweg.

**V27: Grafik.**
- *Belmont-Platz (`plaza.js`):* Das Pflaster ist keine Leinwand mehr (vorher etwa 10 Pixel je Meter), der Shader
  rechnet es aus der Weltlage: Strahlenkranz aus zwei Graniten mit radial verlegten Platten, Messingringe und
  -strahlen, Fächer (Muschel) um den Brunnen, Randband im Läuferverband, Fugen als Relief, Glimmer und Körnung,
  dazu Nässe, Pfützen und Spiegelung aus `streetDetail` (Modus `'plaza'`).
- *Brunnen (`fountain.js`):* drei Schalen auf gestuftem Pfeiler mit Wasserschleiern über die Ränder, 16 Bogenstrahlen
  vom Beckenrand, hohe Mittelfontäne; Ringwellen von Schleier und Aufschlägen (gleiche Formel im Vertex- und
  Fragment-Shader), weißes Wasser, Kaustik, Unterwasserlicht. Tropfen, Spritzer und Sprühnebel sind Teilchen, deren
  Flugbahn ganz im Shader aus der Zeit entsteht (keine Arbeit je Bild auf der CPU).
- *See (`water.js`):* acht statt sechs Wellenzüge, lange Dünung, etwa 50 % höher (Boote schaukeln mit, gleiche
  Formel auf der CPU); Brandungslinien und Gischt an Kai und Ufer (`shoreSpray`), Licht scheint durch die Kämme,
  Schaumstreifen in Windrichtung.
- *Laternen (`decolamp.js`):* Art-Déco-Kandelaber statt der Khronos-Laterne: gestufter Sockel, kannelierte Trommel
  und Schaft mit Messingmanschetten, Milchglaslaterne mit Bronzerippen, Zikkurat-Haube mit Goldfinnen.
- *Fassaden (`facade-shader.js`):* Fugen und Terrakotta-Ornamente als echtes Relief (Normale aus der Fugenhöhe),
  Rustika im Erdgeschoss, Fenstergewände mit Sturz und Schlussstein, Zahnschnitt unter der Traufe, Gurtgesims,
  kupferne Fallrohre mit Schellen.
- *Autos (`cars.js`, `carGeoHi` in `serpentine.js`):* Karosserie aus Querschnitten (`carLoft`) mit gewölbter Haube
  und rundem Heck, Kotflügel als bombiertes Blech entlang des Rades (`carSweep`), 16-Speichen-Räder mit Nabenkappe,
  Reserveräder in den Kotflügeln, Geschossscheinwerfer, runde Stoßstangen mit Hörnern, Türgriffe, Kühlerfigur.
- *Nebel und Leistung:* Bodennebel dichter (`FOG_K` 12, Skalenhöhe 14 m), gleichmäßiger Dunst schwächer (`FOG_E2`),
  dadurch bleiben Türme und Silhouette so sichtbar wie vorher. Der Nebel rechnet jetzt mit dem echten Abstand statt
  der Bildtiefe. `fogHideDist()` (`core.js`) sagt, ab wo etwas einer bestimmten Höhe ganz im Nebel liegt;
  `updateFogCull` (`performance.js`) blendet dort Laternen-, Möbel-, Waren- und Laden-Zellen aus, Menschen, Autos
  und Bäume zeichnen nur bis dahin (`FOGVIS`). Dichter Nebel spart nur so Arbeit, nicht von allein.

**V28: Die Luxusvilla.** Die Bergvilla gehört dem Spieler, dem reichsten Mann von Vespera. `villa.js` baut alle
Innenräume im lokalen Hausraster der Villa (lx quer, +lz zur Stadt, y über `VILLA.y`), `serpentine.js` behält
Außenhaut, Garten, Terrassen und das Fest.
- *Erdgeschoss:* Eingangshalle über zwei Geschosse mit Imperialtreppe (Mittellauf zum Podest, zwei Seitenläufe zur
  Galerie), Säulen, Kronleuchter, Randolf am Fuß der Treppe (E: ansprechen); Salon mit Kamin, Flügel und Sofas;
  Herrenzimmer mit Bar, Spiegelwand, Billard und Clubsesseln; Speisesaal mit 14-m-Tafel, 22 Stühlen, Kandelabern
  und Speisen; Küche mit Herdblock, Kupfertöpfen und Vorräten; Ballsaal (9,6 m hoch) mit Parkett, Spiegeln, Säulen,
  Bühne und Band, acht Tanzpaaren, Buffet und Gartentüren.
- *Obergeschoss:* Galerie um die Halle mit Balustraden, Seitengalerien mit Türen zur Loggia-Terrasse, Flure;
  Arbeitszimmer mit Schreibtisch, Globus und Kamin, Bibliothek mit Leiter; Wintergarten mit Glasdach, Palmen und
  Brunnen; Schlafzimmer mit Himmelbett und Balkon; Badezimmer mit freistehender Wanne; Ankleide mit Schränken,
  Insel und Smoking; drei Gästezimmer und Gästebad.
- *Keller:* Gewölbeflur, Dienstbotenküche, Gesindestube, vier Zimmer der Bediensteten, Randolfs Zimmer (Bett,
  Schreibtisch, Bücher, Livree, Bild des Hausherrn), Silberkammer, Tresorraum mit runder Stahltür und Goldbarren,
  Waschküche, Vorratskammer, Kesselraum, Weinkeller, Schwimmhalle mit türkisem Becken, Säulen, Liegen und Dampf.
  Zwei Dienstbotentreppen (aus der Halle und aus der Küche) führen hinunter.
- *Technik:* Räume sind Zonen (`eg`, `og`, `kel`), je Zone und Material ein Netz; `updateVillaZones` blendet ein,
  was vom Standort aus sichtbar sein kann (Keller nur unten, OG nur oben oder von der Halle aus, alles nur in der
  Nähe; Handy: 120 m). Türen sind eigene Netze und schwingen auf, wenn der Spieler nahe kommt. Kollision über die
  Villa-Quader (`VILLA.boxes`); im Keller zählt der Hang nicht als Boden (`inVillaCellar`). In der Villa kein
  Regen und kein Bodennebel (`inVillaHouse`). Raumnamen erscheinen beim Betreten als Hinweis.

**V29: Leistung.** Gleiche Bilder, gleiche Funktionen, weniger Arbeit für Grafikkarte, Prozessor und Speicher.
- *Netze mit Index:* `mergeGeos` (`core.js`) zerlegt die Teile nicht mehr in lose Dreiecke, sondern behält ihren
  Index; Bausätze (`kit`), `mergeColored`, Villa, Autoscheiben und gebackene Modelle ebenso. Jede Ecke wird nur
  einmal gespeichert und im Vertex-Shader nur einmal gerechnet. Wer nach dem Zusammenfügen Werte je Teil setzt,
  zählt wie bisher mit `position.count` des Teils. `geoView(g)` ist eine Hülle um dieselben Puffer, damit beim
  Ergänzen von Attributen das (vielleicht mehrfach benutzte) Original unverändert bleibt.
- *Weniger Draw Calls:* `bakeGroup(grp)` (`core.js`) verschmilzt feste, undurchsichtige Teile einer Gruppe je
  Material; die Luftschiffe nutzen es (rund 50 Teile je Schiff werden zu etwa fünf Netzen). Boote im Hafen werden
  wie Laternen und Bäume ab der Nebelgrenze ihrer Masthöhe nicht mehr gezeichnet (`updatePort`).
- *Prozessor:* Passanten setzen ihre Matrix direkt aus Gierwinkel und Neigung (`Crowd.set`), wer still steht,
  rechnet gar nicht; Rundwege ganz außerhalb der Sichtweite laufen nur in `t` weiter (`loopDist2`); die Türsuche
  prüft nur Türen im Fenster des Schritts (`doorNear`). Der Lichter-Pool sucht die nächsten vier ohne Zwischenlisten.
  `Object3D.updateMatrix` rechnet nur, wenn sich Lage, Drehung oder Größe geändert haben (`core.js`, bitgleich).
  HUD-Texte werden nur bei Änderung geschrieben (`hudSet`), die Nebel-Prüfung für Leuchtmaterialien merkt sich
  geprüfte Materialien.
- *Speicher:* Chunk-Zellen geben ihre Instanzpuffer beim Abbau sofort frei (`disposeChunk`). Die Leinwand hat kein
  eigenes Antialiasing mehr (der Composer glättet schon in seinem Ziel). Normalenkarten aus Höhenbildern werden
  ohne Modulo je Pixel gerechnet (`texSet`). Toter Code (alte V15-Fahrphysik, alte Ufer- und Autobauten) ist entfernt.
- *Messen:* `tools/profile.js` misst ohne Zeichnen Ladezeit, JS-Zeit je Bild mit den teuersten Funktionen,
  Objekte im Blickfeld mit Dreiecken und JS-Speicher an festen Aussichtspunkten.

Große Modelle: Draco/Meshopt sind noch nicht eingebunden; KTX2 braucht die Transcoder-Dateien vom CDN
(`THREE_CDN` in `assets.js`). Die Einzeldatei bettet `assets/` als Daten-URLs ein; ab einigen MB lohnt sich das
nicht mehr, dann bleibt das Artefakt ohne die großen Dateien und nur GitHub Pages zeigt sie.

## Prüfen und bauen

```
python3 -m http.server 8765                      # dann http://localhost:8765/
node tools/test.js http://localhost:8765/ out/desk          # Desktop; Messwerte in out/desk.json
node tools/test.js http://localhost:8765/ out/mobil mobile  # iPhone-Modus (MOBILE-Schalter)
node tools/check-modules.js .                    # Modulreihenfolge prüfen
node tools/profile.js http://localhost:8765/ out/prof.json  # V29: JS-Zeit je Bild, Draw Calls, Ladeprofil (ohne Zeichnen)
python3 tools/build-single.py single/vespera-v21.html       # Einzeldatei (seit V22 nicht mehr gepflegt, nur GitHub Pages)
```

`tools/test.js` braucht Playwright mit Chromium; `THREE_DIR=/pfad/zu/node_modules/three` bedient das CDN lokal.
