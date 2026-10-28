# Vespera

Anno 1927, Stadt des Abendsterns: eine Art-Deco-Metropole bei Nacht, als Browserspiel mit three.js.
Alles (Stadt, Menschen, Autos, Luftschiffe, Wasser) wird prozedural erzeugt.

**Spielen:** https://captainawesome123.github.io/Vespera/

## Ordnerstruktur

```
index.html          Seite: HUD, Menü, Stile, importmap für three.js und der Modul-Einstieg src/boot.js
assets/             echte Modelle und Texturen (siehe "Echte Modelle einbauen")
  manifest.json       Verzeichnis aller Dateien, Platzierungen in Weltkoordinaten
  models/             glTF/GLB-Modelle: lantern.glb (Khronos/Microsoft, CC0), kenney-bench.glb, kenney-trashcan.glb (Kenney, CC0), deco-bollard.glb (Beispiel)
  textures/           Fototexturen (512 px JPG): Backstein (three.js, MIT), schwarzer Marmor und Gold (ambientCG, CC0)
  LICENSES.md         Herkunft und Lizenz jeder Datei
src/                der Spielcode als ES-Module, ein Abschnitt pro Datei
  boot.js             Einstieg: legt die Ladereihenfolge fest, startet nach dem Laden der Schriften
  core.js             Zufall mit festem Startwert, Renderer, Szene, MOBILE-Schalter, Hilfsfunktionen, `shared`
  chunks.js           Welt-Chunks: Zellen werden um den Spieler herum gebaut und wieder freigegeben (Streaming, LOD)
  assets.js           Asset-Pipeline: Manifest, glTF-Loader (mit KTX2), Textur-Loader, Zwischenspeicher
  props.js            Chunk-Schichten 'lamps', 'furniture', 'props': Laternen, Stadtmobiliar und freie Platzierungen aus echten Modellen (V21)
  people-model.js     Menschen: Köpfe, Haar, Kleidung (V17)
  people-skeleton.js  Skelett im Shader, Gang, Laufen, Tanzen, Sitzen (V18)
  facade-shader.js    Fassaden: Fenster, Goldbänder, Ladenzeilen, Flutlicht
  island.js           Stadtplan und Insel mit Ringstraße
  building-forms.js   Erker, Balkone, Arkaden, Haustüren (V19)
  shops.js            44 begehbare Läden (V19); ihre Meshes sind die erste Chunk-Schicht
  entrances.js        Eingänge mit Stufen und Glastüren
  belmont.js          The Belmont: Turm, Lobby, Ballsaal, Drehtür
  dance.js            Tanzpaare im Ballsaal
  water.js            Wellen (Gerstner)
  harbour.js          Kai, Jachthafen, Fähre, Luftschiffhafen
  serpentine.js       Bergstraße zur Villa und Umgebung
  ragdoll.js          Gliederpuppen-Physik
  sky.js              Himmel, Sterne, Mond
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

Große Modelle: Draco/Meshopt sind noch nicht eingebunden; KTX2 braucht die Transcoder-Dateien vom CDN
(`THREE_CDN` in `assets.js`). Die Einzeldatei bettet `assets/` als Daten-URLs ein; ab einigen MB lohnt sich das
nicht mehr, dann bleibt das Artefakt ohne die großen Dateien und nur GitHub Pages zeigt sie.

## Prüfen und bauen

```
python3 -m http.server 8765                      # dann http://localhost:8765/
node tools/test.js http://localhost:8765/ out/desk          # Desktop; Messwerte in out/desk.json
node tools/test.js http://localhost:8765/ out/mobil mobile  # iPhone-Modus (MOBILE-Schalter)
node tools/check-modules.js .                    # Modulreihenfolge prüfen
python3 tools/build-single.py single/vespera-v21.html       # Einzeldatei für das Artefakt
```

`tools/test.js` braucht Playwright mit Chromium; `THREE_DIR=/pfad/zu/node_modules/three` bedient das CDN lokal.
