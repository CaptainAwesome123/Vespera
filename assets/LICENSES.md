# Herkunft und Lizenzen der Assets

Alle Dateien in `assets/` sind frei nutzbar (CC0 oder MIT). Die Originale wurden für das Spiel verkleinert
(Texturen auf 512/256 px, Modelltexturen als JPEG), sonst nicht verändert. Umfärbungen passieren erst im Spiel
(`MODEL_USE` in `src/props.js`).

## Modelle (`assets/models/`)

| Datei | Original | Urheber | Lizenz |
|---|---|---|---|
| `lantern.glb` | [Khronos glTF-Sample-Assets: Lantern](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern) | Microsoft (2017), Draco-Variante Frank Galligan | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `kenney-bench.glb` | Kenney „Graveyard Kit“ (`bench.glb`) | [Kenney](https://kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `kenney-trashcan.glb` | Kenney „Furniture Kit“ 2.0 (`trashcan.glb`) | [Kenney](https://kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `kenney-goods.glb` | Kenney „Food Kit“: 21 Stücke (`apple`, `bottle`, `bottle-large`, `bread`, `cake`, `cheese`, `cocktail`, `croissant`, `cup-saucer`, `cupcake`, `glass-wine`, `loaf`, `loaf-baguette`, `muffin`, `orange`, `pear`, `pie`, `soda-bottle`, `whole-ham`, `wine-red`, `wine-white`) aus dem Spiegel [`pmndrs/market-assets`](https://github.com/pmndrs/market-assets), mit gltf-transform zu einer Datei zusammengelegt (ein Knoten je Stück, Draco-Kompression entfernt) | [Kenney](https://kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `deco-bollard.glb` | eigenes Beispielmodell (`tools/make-example-asset.py`) | Vespera | wie das Projekt |

Die Kenney-Dateien stammen aus dem GitHub-Spiegel `ETdoFresh/kenney.nl` (Inhalt unverändert zu kenney.nl).

## Texturen (`assets/textures/`)

| Dateien | Original | Urheber | Lizenz |
|---|---|---|---|
| `brick-color.jpg`, `brick-bump.jpg`, `brick-rough.jpg` | three.js `examples/textures/brick_*.jpg` (r147) | three.js-Autoren | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| `marble-color.jpg`, `marble-normal.jpg`, `marble-rough.jpg` | [ambientCG Marble006](https://ambientcg.com/view?id=Marble006) (1K) | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `gold-color.jpg`, `gold-normal.jpg`, `gold-rough.jpg` | [ambientCG Metal007](https://ambientcg.com/view?id=Metal007) (1K) | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `tiles-color.jpg`, `tiles-normal.jpg`, `tiles-rough.jpg` (V23) | [ambientCG Tiles036](https://ambientcg.com/view?id=Tiles036), 512 px | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `stone-color.jpg`, `stone-normal.jpg` (V23) | [ambientCG Rock020](https://ambientcg.com/view?id=Rock020), 512 px | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `parquet-color.jpg`, `parquet-normal.jpg`, `parquet-rough.jpg` (V23) | [ambientCG WoodFloor043](https://ambientcg.com/view?id=WoodFloor043), 512 px | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Die ambientCG-Dateien wurden über den Spiegel `pmndrs/market-assets` (GitHub, dort als CC0 geführt) bezogen.

## Menschen (`assets/people/`, V22)

| Dateien | Original | Urheber | Lizenz |
|---|---|---|---|
| `people.glb`, `people.json` | MakeHuman-Grundnetz `hm08`, Makro-Ziele (Geschlecht, Alter, Muskel, Gewicht, Herkunft), Skelett `default` mit Gewichten, Augen `low-poly` (`brown_eye`) aus [makehumancommunity/makehuman](https://github.com/makehumancommunity/makehuman) (Stand a8bc2d5); Kleidung `male_elegantsuit01`, `male_worksuit01`, `female_elegantsuit01`, `shoes01`, `shoes03`, Haare `short01`, `short02`, `short04`, `bob01`, `bob02`, `ponytail01`, Brauen `eyebrow001`, `eyebrow010`, Wimpern `Eyelashes01` und Hauttexturen (jung, mittel, alt, dunkel) aus dem npm-Paket [`makehuman-data`](https://www.npmjs.com/package/makehuman-data) 0.0.2 (MakeHuman-Systemdaten als JSON) | MakeHuman-Team und -Gemeinschaft | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (`LICENSE.ASSETS.md` im MakeHuman-Repo) |
| `people-atlas.webp`, `people-atlas-m.webp` | Haut-, Kleider-, Haar-, Augen-, Brauen- und Wimpertexturen derselben MakeHuman-Teile, verkleinert und zu einem Atlas zusammengesetzt; Frack, Uniform und Kellnerjacke sind daraus umgemalt | MakeHuman-Team, Umarbeitung Vespera | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Bearbeitung (`tools/make-people.mjs`): Körper in die Ruhehaltung des Spiels gestellt (Arme hängend, Damen auf
Absätzen, Absatzschuhe aus dem Fuß gebaut), Kleidung und Haare angepasst (Pony über der Stirn gekürzt),
Netze vereinfacht (zweite Stufe für mittlere Entfernung) und mit meshoptimizer gepackt. Der MakeHuman-Programmcode
(AGPL) ist nicht Teil des Spiels; verwendet sind nur die CC0-Daten. Das npm-Paket verweist für die Lizenz auf
makehuman.org, wo die mitgelieferten Assets als CC0 freigegeben sind.

## Bewegungen (V26)

| Datei | Quelle | Urheber | Lizenz |
|---|---|---|---|
| `people/mocap.bin`, `people/mocap.json` | CMU Graphics Lab Motion Capture Database, Aufnahmen 35_01 und 35_17 (Gehen, Laufen), 93_03, 93_05, 93_07, 93_08 (Charleston, Gang einer Dame), 114_05 (Sitzen), 137_28 (Warten); BVH-Fassung von cgspeed über [Shriinivas/cmubvh](https://github.com/Shriinivas/cmubvh) | Carnegie Mellon University, [mocap.cs.cmu.edu](http://mocap.cs.cmu.edu) | frei, ohne Einschränkung („free for all uses“); Bitte um Nennung: *The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.* |

Bearbeitung (`tools/make-mocap.mjs`, Auswahl in `tools/mocap-clips.json`): Gelenkwinkel in die Kanäle des
Figuren-Shaders umgerechnet (Becken, Oberkörper, Kopf, Fußziele für die Bein-IK, Arme), auf Beinlänge und
Schrittlänge normiert, zu nahtlosen Schleifen geschnitten und auf 30 bzw. 15 Bilder je Sekunde verkleinert.

## Nicht enthalten (Stand V21)

Für 1920er-Automobile, Hydranten, Litfaßsäulen und Pflasterstein-Fotos wurde keine frei lizenzierte Quelle
gefunden, die aus der Build-Umgebung erreichbar war (Poly Haven, Sketchfab, kenney.nl, ambientcg.com, Quaternius
sind dort gesperrt). Diese Dinge bleiben vorerst aus handgebauten Formen. Ein eigenes Modell kommt so hinein:
Datei nach `assets/models/`, Eintrag in `assets/manifest.json`, Verwendung in `MODEL_USE` (`src/props.js`).
