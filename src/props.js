/* =====================================================================
   REQUISITEN AUS ECHTEN MODELLEN
   Platzierungen aus assets/manifest.json (placements) werden als eigene
   Chunk-Schicht gebaut: nah als volles Modell, ab PROPS_LOD_FAR Metern ausgeblendet.
   Beispiel: ?demo=props stellt die Demo-Poller aus dem Manifest vor das Belmont.
   ===================================================================== */
import { T } from './core.js';
import { registerLayer } from './chunks.js';
import { manifest, loadManifest, prepareModels, instanceModel } from './assets.js';

export const PROPS_CELL = 250, PROPS_RADIUS = 700, PROPS_LOD_FAR = 260;
export const props = { placements: [], ready: false };

export async function setupProps() {
  await loadManifest();
  const demo = new URLSearchParams(location.search).get('demo') === 'props' && manifest.demo;
  props.placements = [...(manifest.placements || []), ...(demo ? manifest.demo.placements || [] : [])];
  if (!props.placements.length) return;
  await prepareModels(props.placements.map(p => p.model));
  props.ready = true;
  // Schicht erst anmelden, wenn die Modelle da sind: das Chunk-System baut die Zellen beim nächsten Durchlauf
  registerLayer({
    name: 'props', size: PROPS_CELL, radius: PROPS_RADIUS, lods: [PROPS_LOD_FAR],
    build(cx, cz, lod) {
      if (lod > 0) return null;   // in der Ferne nichts (später: Billboards oder einfache Formen)
      const x0 = cx * PROPS_CELL, z0 = cz * PROPS_CELL;
      const here = props.placements.filter(p => p.x >= x0 && p.x < x0 + PROPS_CELL && p.z >= z0 && p.z < z0 + PROPS_CELL);
      if (!here.length) return null;
      const g = new T.Group();
      for (const p of here) {
        const m = instanceModel(p.model); if (!m) continue;
        m.position.set(p.x, p.y || 0, p.z); m.rotation.y = p.ry || 0; if (p.scale) m.scale.multiplyScalar(p.scale);
        g.add(m);
      }
      return g.children.length ? g : null;
    },
    dispose(obj) { /* Geometrie und Material gehören den Vorlagen: nur aus der Szene nehmen */ },
  });
}
