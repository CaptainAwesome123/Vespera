/* =====================================================================
   WELT-CHUNKS (Streaming)
   Die Welt wird in Zellen (Chunks) eingeteilt. Jede Inhaltsschicht ("Layer")
   baut ihren Teil einer Zelle erst, wenn der Spieler nahe genug kommt, und
   gibt ihn wieder frei, wenn er sich entfernt. So kann die Stadt später sehr
   viel mehr Inhalt und echte Modelle tragen, ohne alles beim Start zu laden.

   Eine Schicht meldet sich mit registerLayer({ name, size, radius, lods, build, dispose }):
     name     Kennung, z. B. 'shops'
     size     Kantenlänge einer Zelle in Metern (jede Schicht darf ihr eigenes Raster haben)
     radius   Laderadius in Metern vom Zellmittelpunkt zur Kamera (Zahl oder Funktion (camera) => Zahl)
     lods     optional: Entfernungen, ab denen die Detailstufe sinkt, z. B. [120, 400] -> LOD 0/1/2
     build(cx, cz, lod, ctx)  liefert ein Object3D (oder null, wenn die Zelle leer ist). ctx.rng ist ein
              Zufall mit festem Startwert je Zelle und Schicht: dieselbe Zelle sieht immer gleich aus.
     dispose(obj, cx, cz)     optional; sonst werden nur die Geometrien vom Grafikspeicher gelöst
              (die Daten bleiben im Hauptspeicher und werden beim nächsten Laden wieder hochgeladen).
   Entladen wird mit Hysterese (radius + UNLOAD_MARGIN), gebaut wird mit Budget je Bild, nächste zuerst.
   ===================================================================== */
import { scene, camera, MOBILE, mulberry32 } from './core.js';

export const WORLD_SEED = 19271927;
export const UNLOAD_MARGIN = 60;          // Meter über dem Laderadius, bevor eine Zelle wieder abgebaut wird
export const BUILD_BUDGET_MS = MOBILE ? 4 : 7; // wie viel Zeit je Bild in neue Zellen fließen darf
export const layers = [];
export const chunkStats = { loaded: 0, built: 0, disposed: 0, empty: 0, pending: 0 };

function hash32(a, b, c) { let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
// fester Zufall je (Schicht, Zelle): unabhängig von der Reihenfolge, in der Zellen entstehen
export function chunkRng(layerName, cx, cz) {
  let s = WORLD_SEED;
  for (let i = 0; i < layerName.length; i++) s = (s * 31 + layerName.charCodeAt(i)) >>> 0;
  return mulberry32(hash32(s, cx + 0x8000, cz + 0x8000));
}
export const chunkKey = (cx, cz) => cx + ',' + cz;

export function registerLayer(L) {
  if (!L.name || !L.size || !L.build) throw new Error('Layer braucht name, size und build');
  L.chunks = new Map();      // key -> { cx, cz, obj, lod }  (obj null = Zelle ist in dieser Stufe leer)
  L.radiusAt = typeof L.radius === 'function' ? L.radius : () => L.radius;
  L.lods = L.lods || [];
  L.center = (cx, cz) => [(cx + 0.5) * L.size, (cz + 0.5) * L.size];
  layers.push(L);
  return L;
}
export const layerByName = name => layers.find(l => l.name === name);

function lodFor(L, dist) { let lod = 0; for (const d of L.lods) if (dist > d) lod++; return lod; }
function buildChunk(L, cx, cz, lod) {
  const key = chunkKey(cx, cz);
  const rec = L.chunks.get(key) || { cx, cz, obj: null, lod: -1 };
  if (rec.obj) disposeChunk(L, rec);
  const obj = L.build(cx, cz, lod, { rng: chunkRng(L.name, cx, cz), key, size: L.size, center: L.center(cx, cz) });
  rec.lod = lod; rec.obj = obj || null;
  if (obj) { obj.userData.chunk = { layer: L.name, cx, cz, lod }; scene.add(obj); chunkStats.built++; } else chunkStats.empty++;
  L.chunks.set(key, rec);
  return rec;
}
function disposeChunk(L, rec) {
  const obj = rec.obj; if (!obj) return;
  scene.remove(obj);
  if (L.dispose) L.dispose(obj, rec.cx, rec.cz);
  else obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  rec.obj = null; rec.lod = -1; chunkStats.disposed++;
}
// Zellen im Umkreis aufzählen (Rechteck aus dem größten Laderadius, dann exakt nach Abstand gefiltert)
function wanted(L, cp) {
  const r = L.radiusAt(camera), out = [];
  const x0 = Math.floor((cp.x - r) / L.size), x1 = Math.floor((cp.x + r) / L.size), z0 = Math.floor((cp.z - r) / L.size), z1 = Math.floor((cp.z + r) / L.size);
  for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
    const [mx, mz] = L.center(cx, cz), d = Math.hypot(cp.x - mx, cp.z - mz);
    if (d < r) out.push({ cx, cz, d, lod: lodFor(L, d) });
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}
let timer = 0;
export function updateChunks(dt, { budgetMs = BUILD_BUDGET_MS, all = false } = {}) {
  if (!all && (timer -= dt) > 0) return;
  timer = 0.25;
  const cp = camera.position, t0 = performance.now();
  let pending = 0, loaded = 0;
  for (const L of layers) {
    const r = L.radiusAt(camera), want = wanted(L, cp), keep = new Set();
    for (const w of want) {
      const key = chunkKey(w.cx, w.cz); keep.add(key);
      const rec = L.chunks.get(key);
      if (rec && rec.lod === w.lod) continue;
      if (rec && rec.obj && L.setLod) { L.setLod(rec.obj, w.lod, rec.lod); rec.lod = w.lod; continue; }
      if (!all && performance.now() - t0 > budgetMs) { pending++; continue; }
      buildChunk(L, w.cx, w.cz, w.lod);
    }
    for (const [key, rec] of L.chunks) {
      if (keep.has(key)) { if (rec.obj) loaded++; continue; }
      const [mx, mz] = L.center(rec.cx, rec.cz);
      if (Math.hypot(cp.x - mx, cp.z - mz) > r + UNLOAD_MARGIN) { if (rec.obj) disposeChunk(L, rec); L.chunks.delete(key); } else if (rec.obj) loaded++;
    }
  }
  chunkStats.loaded = loaded; chunkStats.pending = pending;
  if (pending) timer = 0;   // nächstes Bild weiterbauen
}
// Schicht neu bauen lassen (z. B. wenn echte Modelle nachgeladen wurden): alle Zellen abbauen, der nächste Durchlauf baut sie wieder
export function invalidateLayer(name) {
  const L = layerByName(name); if (!L) return;
  for (const [key, rec] of L.chunks) { if (rec.obj) disposeChunk(L, rec); L.chunks.delete(key); }
  timer = 0;
}
// Vor dem ersten Bild: alles im Umkreis sofort bauen, damit nichts aufpoppt
export function primeChunks() { updateChunks(0, { all: true }); }
