/* =====================================================================
   REQUISITEN AUS ECHTEN MODELLEN (V20/V21)
   Drei Chunk-Schichten, alle aus den Platzierungen, die beim Aufbau geplant wurden:
     'lamps'      Straßenlaternen (serpentine.js plant sie in STREET.lamps). Nah: echtes Modell
                  (assets/models/lantern.glb, Microsoft CC0) mit Arm zur Straße; fern: schlanker
                  Kandelaber aus einfachen Formen; die leuchtende Laterne immer.
     'furniture'  Stadtmobiliar (STREET.furniture): Bank und Papierkorb aus Kenney-Modellen (CC0),
                  Hydrant, Briefkasten, Litfaßsäule, Uhr, Pflanzkübel, Kiosk aus den gezeichneten Formen.
     'props'      freie Platzierungen aus assets/manifest.json (placements) und ?demo=props.
   Solange die Modelle noch laden (oder fehlen), stehen die gezeichneten Formen; sind die Modelle da,
   werden die Zellen einmal neu gebaut (invalidateLayer). Fototexturen: applyTextures() hängt sie an
   die Materialien, die sich mit wantTexture() gemeldet haben (Belmont-Marmor, Gold, Fassaden-Backstein).
   ===================================================================== */
import { T, U } from './core.js';
import { registerLayer, invalidateLayer } from './chunks.js';
import { manifest, loadManifest, prepareModels, instanceModel, bakeModel, applyTextures, loadTexture } from './assets.js';
import { STREET } from './serpentine.js';
import { curbs } from './facade-shader.js';
import { paintMat, ENV } from './people-skeleton.js';

export const PROPS_CELL = 250, PROPS_RADIUS = 700, PROPS_LOD_FAR = 260;
export const STREET_CELL = 250, STREET_LOD = 330;              // Zellgröße und Entfernung, ab der nur noch die einfache Form steht
export const props = { placements: [], ready: false, baked: {}, mat: null };

// Modelle je Verwendung: Name im Manifest, Farben je Materialname, Zielhöhe in Metern
export const MODEL_USE = {
  lamp: { model: 'lantern', center: false, envI: 0.5 },
  bench: { model: 'kenney-bench', height: 0.92, center: true, colors: { wood: [0.3, 0.17, 0.09], stone: [0.06, 0.06, 0.065] } },
  bin: { model: 'kenney-trashcan', height: 0.95, center: true, colors: { metal: [0.07, 0.07, 0.075], metalDark: [0.5, 0.38, 0.18] } },
};

export function propsMat() { return props.mat || (props.mat = paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.55, envI: 0.5, emissive: 0x080604 })); }

/* ---------- Laternen ---------- */
const _pm = new T.Matrix4(), _pq = new T.Quaternion(), _pp = new T.Vector3(), _ps = new T.Vector3(1, 1, 1), _pup = new T.Vector3(0, 1, 0);
// Arm der Laterne zeigt zur Straße: zur nächsten Bordsteinkante hin (deren Straßenseite ist +o), sonst nach Süden
export function lampYaw(l) {
  let best = 1e9, yaw = 0;
  for (const c of curbs) {
    const L = Math.hypot(c.bx - c.ax, c.bz - c.az); if (!L) continue;
    const dx = (c.bx - c.ax) / L, dz = (c.bz - c.az) / L, t = Math.max(0, Math.min(L, (l.x - c.ax) * dx + (l.z - c.az) * dz));
    const px = c.ax + dx * t, pz = c.az + dz * t, d = Math.hypot(l.x - px, l.z - pz);
    if (d < best) { best = d; const ox = -dz, oz = dx; yaw = Math.atan2(-oz, ox); }
  }
  return best < 12 ? yaw : Math.PI / 2;
}
function inCell(p, cx, cz, size) { return p.x >= cx * size && p.x < (cx + 1) * size && p.z >= cz * size && p.z < (cz + 1) * size; }
function instanced(geo, mat, list, place, colored) {
  const im = new T.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => { place(p, i, im); });
  im.frustumCulled = false; if (colored) im.instanceColor.needsUpdate = true;
  return im;
}
export function setupStreetLayers() {
  const LP = STREET.lampParts; if (!LP) return;
  registerLayer({
    name: 'lamps', size: STREET_CELL, radius: cam => 400 + Math.max(0, cam.position.y) * 1.5, lods: [STREET_LOD],
    build(cx, cz, lod) {
      const here = STREET.lamps.filter(l => inCell(l, cx, cz, STREET_CELL)); if (!here.length) return null;
      const g = new T.Group(), real = lod === 0 && props.baked.lamp;
      if (real) {
        const { geo, material, box } = props.baked.lamp, H = box.max.y - box.min.y;
        g.add(instanced(geo, material, here, (l, i, im) => { const s = l.h / H; _pq.setFromAxisAngle(_pup, l.yaw ??= lampYaw(l)); im.setMatrixAt(i, _pm.compose(_pp.set(l.x, l.y, l.z), _pq, _ps.setScalar(s))); }));
      } else {
        const byGeo = new Map(); for (const l of here) { if (!byGeo.has(l.geo)) byGeo.set(l.geo, []); byGeo.get(l.geo).push(l); }
        for (const [geo, list] of byGeo) g.add(instanced(geo, LP.poleMat, list, (l, i, im) => im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y, l.z))));
        g.add(instanced(LP.capGeo, LP.poleMat, here, (l, i, im) => im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y + l.hs, l.z))));
      }
      // die leuchtende Laterne: beim echten Modell kleiner und in der Lampe, sonst auf dem Kandelaber
      g.add(instanced(LP.lanternGeo, new T.MeshBasicMaterial({ color: new T.Color(1.6, 1.12, 0.62) }), here, (l, i, im) => {
        if (real) { const a = l.yaw ?? 0, r = l.h * 0.33; im.setMatrixAt(i, _pm.makeScale(0.55, 0.55, 0.55).setPosition(l.x + Math.cos(a) * r, l.y + l.h * 0.74, l.z - Math.sin(a) * r)); }
        else im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y + l.hs, l.z));
      }));
      return g;
    },
    dispose() { /* Geometrien gehören den Vorlagen */ },
  });
  const F = STREET.furniture; if (!F) return;
  registerLayer({
    name: 'furniture', size: STREET_CELL, radius: cam => 330 + Math.max(0, cam.position.y), lods: [STREET_LOD],
    build(cx, cz, lod) {
      if (lod > 0) return null;
      const g = new T.Group(), cc = new T.Color();
      const colored = (p, i, im) => { im.setMatrixAt(i, p.m); im.setColorAt(i, cc.setRGB(...p.c)); };
      for (const k in F.out) {
        const list = F.out[k].filter(p => inCell(p, cx, cz, STREET_CELL)); if (!list.length) continue;
        const bk = props.baked[k];
        if (bk) { g.add(instanced(bk.geo, bk.material || propsMat(), list, (p, i, im) => { im.setMatrixAt(i, p.m); im.setColorAt(i, cc.setRGB(...p.c)); }, true)); continue; }
        if (k === 'column') { g.add(instanced(F.colGeo, F.posterMat, list, (p, i, im) => im.setMatrixAt(i, p.m))); g.add(instanced(F.colParts, F.mat, list, colored, true)); continue; }
        g.add(instanced(F.TYPES[k], F.mat, list, colored, true));
        if (k === 'clock') g.add(instanced(F.faces, F.faceMat, list, (p, i, im) => im.setMatrixAt(i, p.m)));
      }
      return g.children.length ? g : null;
    },
    dispose() {},
  });
}

/* ---------- Modelle und Texturen nachladen, dann die Schichten einmal neu bauen ---------- */
export async function setupProps() {
  await loadManifest();
  const demo = new URLSearchParams(location.search).get('demo') === 'props' && manifest.demo;
  props.placements = [...(manifest.placements || []), ...(demo ? manifest.demo.placements || [] : [])];
  const uses = Object.values(MODEL_USE).filter(u => manifest.models[u.model]);
  await prepareModels([...props.placements.map(p => p.model), ...uses.map(u => u.model)]);
  for (const [use, def] of Object.entries(MODEL_USE)) {
    const b = bakeModel(def.model, { ...def, envMap: ENV });
    if (b) props.baked[use] = b;
  }
  // Instanzfarbe für Teile mit Farbe PAINT; die Kenney-Modelle bekommen feste Farben, Hydrant usw. bleiben bunt
  if (Object.keys(props.baked).length) { invalidateLayer('lamps'); invalidateLayer('furniture'); }
  props.ready = true;
  applyTextures().catch(() => {});
  // Backstein für den Fassaden-Shader
  if (manifest.textures['brick-color']) loadTexture('brick-color').then(t => { t.wrapS = t.wrapT = T.RepeatWrapping; U.uBrick.value = t; U.uBrickOn.value = 1; }).catch(() => {});
  if (!props.placements.length) return;
  registerLayer({
    name: 'props', size: PROPS_CELL, radius: PROPS_RADIUS, lods: [PROPS_LOD_FAR],
    build(cx, cz, lod) {
      if (lod > 0) return null;   // in der Ferne nichts (später: Billboards oder einfache Formen)
      const here = props.placements.filter(p => inCell(p, cx, cz, PROPS_CELL));
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
