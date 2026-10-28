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
| `deco-bollard.glb` | eigenes Beispielmodell (`tools/make-example-asset.py`) | Vespera | wie das Projekt |

Die Kenney-Dateien stammen aus dem GitHub-Spiegel `ETdoFresh/kenney.nl` (Inhalt unverändert zu kenney.nl).

## Texturen (`assets/textures/`)

| Dateien | Original | Urheber | Lizenz |
|---|---|---|---|
| `brick-color.jpg`, `brick-bump.jpg`, `brick-rough.jpg` | three.js `examples/textures/brick_*.jpg` (r147) | three.js-Autoren | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| `marble-color.jpg`, `marble-normal.jpg`, `marble-rough.jpg` | [ambientCG Marble006](https://ambientcg.com/view?id=Marble006) (1K) | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `gold-color.jpg`, `gold-normal.jpg`, `gold-rough.jpg` | [ambientCG Metal007](https://ambientcg.com/view?id=Metal007) (1K) | ambientCG | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

Die ambientCG-Dateien wurden über den Spiegel `pmndrs/market-assets` (GitHub) bezogen.

## Nicht enthalten (Stand V21)

Für 1920er-Automobile, Hydranten, Litfaßsäulen und Pflasterstein-Fotos wurde keine frei lizenzierte Quelle
gefunden, die aus der Build-Umgebung erreichbar war (Poly Haven, Sketchfab, kenney.nl, ambientcg.com, Quaternius
sind dort gesperrt). Diese Dinge bleiben vorerst aus handgebauten Formen. Ein eigenes Modell kommt so hinein:
Datei nach `assets/models/`, Eintrag in `assets/manifest.json`, Verwendung in `MODEL_USE` (`src/props.js`).
