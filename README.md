# Vespera

Anno 1927, Stadt des Abendsterns: eine Art-Deco-Metropole bei Nacht, als Browserspiel mit three.js.
Alles (Stadt, Menschen, Autos, Luftschiffe, Wasser) wird prozedural erzeugt.

**Spielen:** https://captainawesome123.github.io/Vespera/

## Ordnerstruktur

```
index.html          Seite: HUD, Menü, Stile und die Liste der Skripte in fester Reihenfolge
src/                der Spielcode, ein Abschnitt pro Datei
  core.js             Zufall mit festem Startwert, Grundeinstellungen, MOBILE-Schalter, Hilfsfunktionen
  people-model.js     Menschen: Köpfe, Haar, Kleidung (V17)
  people-skeleton.js  Skelett im Shader, Gang, Laufen, Tanzen, Sitzen (V18)
  facade-shader.js    Fassaden: Fenster, Goldbänder, Ladenzeilen, Flutlicht
  island.js           Stadtplan und Insel mit Ringstraße
  building-forms.js   Erker, Balkone, Arkaden, Haustüren (V19)
  shops.js            44 begehbare Läden (V19)
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
  bloom.js            Nachleuchten
  input.js            Tastatur, Maus, Touch
  main.js             Aufbau der Welt und Spielschleife
  performance.js      Lichter-Pool, Sichtweiten, adaptive Auflösung
  boot.js             Start nach dem Laden der Schriften
single/
  vespera-v19.html    V19 als eine einzige Datei (Stand der Übernahme, unverändert)
tools/
  build-single.py     baut aus index.html + src/ wieder eine Einzeldatei (für das claude.ai-Artefakt)
  test.js             Rauchtest im Headless-Chromium (Playwright)
```

## Wie der Code zusammenhängt

Die Dateien in `src/` sind normale Skripte (keine ES-Module) und teilen sich einen gemeinsamen
Gültigkeitsbereich, genau wie früher in der einen großen Datei. Deshalb gilt:

- Die Reihenfolge der `<script>`-Zeilen in `index.html` ist wichtig. Was eine Datei beim Laden sofort
  ausführt, darf nur Dinge aus Dateien weiter oben benutzen. Funktionen, die erst im Spiel aufgerufen
  werden, dürfen überall stehen.
- Jeder Name auf oberster Ebene gibt es nur einmal im ganzen Spiel.
- Eine neue Datei kommt nach `src/` und bekommt eine eigene `<script>`-Zeile an der passenden Stelle.

Ein Build-Schritt ist nicht nötig: GitHub Pages liefert die Dateien direkt aus. three.js 0.147 kommt vom
CDN jsdelivr. Der Umbau zu echten ES-Modulen mit `import`/`export` kann später Datei für Datei passieren.

## Lokal starten

```
python3 -m http.server 8765
```

und dann http://localhost:8765/ im Browser öffnen (direkt per Doppelklick auf `index.html` geht auch).
