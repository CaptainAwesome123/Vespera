/* =====================================================================
   ASSET-PIPELINE: echte Modelle (glTF/GLB) und Texturen (PNG/JPG/KTX2)
   Das Verzeichnis assets/manifest.json benennt alle Dateien. Hier werden sie
   geladen, zwischengespeichert und als Vorlagen bereitgestellt:
     await loadManifest()              liest das Manifest (einmal beim Start)
     await loadModel('deco-bollard')   liefert die Vorlage (Object3D), zwischengespeichert
     instanceModel('deco-bollard')     liefert eine Kopie der geladenen Vorlage zum Einbauen
     await loadTexture('name')         liefert eine Textur (sRGB-Farbtexturen: colorSpace setzen)
   In der Einzeldatei (claude.ai-Artefakt) legt tools/build-single.py die Dateien als Daten-URLs
   in window.VESPERA_INLINE_ASSETS ab; resolveAsset() greift dann darauf zu statt auf assets/.
   ===================================================================== */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { T, renderer, ANISO, mergeGeos } from './core.js';

export const ASSET_BASE = new URL('../assets/', import.meta.url).href;
export const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
export const manifest = { models: {}, textures: {}, placements: [], demo: null };
export const assetStats = { models: 0, textures: 0, bytes: 0, errors: [] };
const models = new Map(), textures = new Map();

export function resolveAsset(rel) {
  const inline = globalThis.VESPERA_INLINE_ASSETS;
  if (inline && inline[rel]) return inline[rel];
  return ASSET_BASE + rel;
}
export async function loadManifest() {
  try {
    const res = await fetch(resolveAsset('manifest.json'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    Object.assign(manifest, await res.json());
  } catch (e) { assetStats.errors.push('manifest: ' + e.message); }
  return manifest;
}

let gltfLoader = null, ktx2Loader = null;
function loaders() {
  if (!gltfLoader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath(THREE_CDN + 'examples/jsm/libs/basis/').detectSupport(renderer);
    gltfLoader = new GLTFLoader().setKTX2Loader(ktx2Loader);
  }
  return { gltfLoader, ktx2Loader };
}
// Vorlage laden; Materialien bleiben wie im Modell (Standard-PBR), Farbtexturen werden als sRGB gelesen
export function loadModel(name) {
  if (models.has(name)) return models.get(name);
  const def = manifest.models[name];
  if (!def) return Promise.reject(new Error('Modell nicht im Manifest: ' + name));
  const pr = new Promise((resolve, reject) => {
    loaders().gltfLoader.load(resolveAsset(def.url), gltf => {
      const root = gltf.scene;
      if (def.scale && def.scale !== 1) root.scale.setScalar(def.scale);
      root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = o.receiveShadow = false;
        const m = o.material; if (m && m.map) { m.map.encoding = T.sRGBEncoding; m.map.anisotropy = ANISO; }
      });
      root.userData.asset = name;
      assetStats.models++;
      resolve(root);
    }, undefined, err => { assetStats.errors.push(name + ': ' + (err.message || err)); models.delete(name); reject(err); });
  });
  models.set(name, pr);
  return pr;
}
export const modelReady = name => models.has(name);
// Kopie einer geladenen Vorlage (Geometrie und Material werden geteilt, nur die Knoten sind neu)
let loadedModels = new Map();
export async function prepareModels(names) {
  const list = [...new Set(names)];
  await Promise.all(list.map(n => loadModel(n).then(root => loadedModels.set(n, root), () => {})));
}
export function instanceModel(name) {
  const root = loadedModels.get(name);
  if (!root) return null;
  return root.clone(true);
}
export function loadTexture(name) {
  if (textures.has(name)) return textures.get(name);
  const def = manifest.textures[name];
  if (!def) return Promise.reject(new Error('Textur nicht im Manifest: ' + name));
  const url = resolveAsset(def.url);
  const pr = new Promise((resolve, reject) => {
    const done = t => { if (def.srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = ANISO; if (def.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(def.repeat[0], def.repeat[1]); } assetStats.textures++; resolve(t); };
    const fail = err => { assetStats.errors.push(name + ': ' + (err.message || err)); textures.delete(name); reject(err); };
    if (/\.ktx2($|\?)/i.test(def.url)) loaders().ktx2Loader.load(url, done, undefined, fail);
    else new T.TextureLoader().load(url, done, undefined, fail);
  });
  textures.set(name, pr);
  return pr;
}

/* ---------- V21: Modelle zu einer Geometrie backen (für InstancedMesh) ----------
   bakeModel('kenney-bench', { colors: { wood: [0.3, 0.18, 0.1], stone: PAINT }, height: 0.9 })
     colors   Farbe je Materialname des Modells; fehlt sie, gilt die Materialfarbe. [1,1,1] nimmt die Instanzfarbe an (paintMat).
     height   Modell gleichmäßig auf diese Höhe (m) skalieren; scale: fester Faktor
     ground   Unterkante auf y = 0 legen (Standard an); center: x/z auf die Mitte des Umrisses legen
     envMap   Umgebungskarte für Modelle mit eigenen Texturen
     node     nur diesen Knoten (Name) backen, z. B. ein einzelnes Stück aus einem Sammelmodell
   Ergebnis { geo, material, box }: material ist das Modellmaterial (mit Texturen), sonst null -> Aufrufer nimmt paintMat. */
export function bakeModel(name, opts = {}) {
  const root = loadedModels.get(name); if (!root) return null;
  root.updateMatrixWorld(true);
  const geos = [], cols = []; let texMat = null;
  let src = root;
  if (opts.node) { let best = null, bd = 1e9; root.traverse(o => { if (o.name !== opts.node) return; let d = 0; for (let q = o; q.parent; q = q.parent) d++; if (d < bd) { bd = d; best = o; } }); if (!best) return null; src = best; }
  src.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    const c = (opts.colors && opts.colors[m.name]) || (m.color ? m.color.toArray() : [1, 1, 1]);
    if (m.map && !texMat) texMat = m;
    geos.push(g); cols.push(c);
  });
  if (!geos.length) return null;
  const geo = mergeGeos(geos), n = geo.attributes.position.count, col = new Float32Array(n * 3);
  let o = 0; geos.forEach((g, i) => { for (let k = 0; k < g.attributes.position.count; k++) col.set(cols[i], (o + k) * 3); o += g.attributes.position.count; });
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.computeBoundingBox(); let b = geo.boundingBox;
  let s = opts.scale || 1; if (opts.height) s = opts.height / Math.max(1e-6, b.max.y - b.min.y);
  if (s !== 1) { geo.scale(s, s, s); geo.computeBoundingBox(); b = geo.boundingBox; }
  const cx = opts.center ? (b.min.x + b.max.x) / 2 : 0, cz = opts.center ? (b.min.z + b.max.z) / 2 : 0;
  if (opts.ground !== false || opts.center) { geo.translate(-cx, opts.ground !== false ? -b.min.y : 0, -cz); geo.computeBoundingBox(); b = geo.boundingBox; }
  geo.computeBoundingSphere();
  let material = null;
  if (texMat) { material = texMat.clone(); material.vertexColors = false; if (opts.envMap) { material.envMap = opts.envMap; material.envMapIntensity = opts.envI ?? 0.6; } }
  return { geo, material, box: b };
}

/* ---------- V23: Waren aus echten Modellen (Läden, Bar, Restaurant) ----------
   Beim Aufbau melden Läden und Lokale hier, wo ein Stück stehen soll: { m: 'cake', x, y, z, yaw, h }
   (h = größte Ausdehnung in Metern, y = Unterkante).
   Die Schicht 'goods' (props.js) zeigt sie in der Nähe als InstancedMesh aus kenney-goods.glb. */
export const GOODS_AT = [];
export const goodsAt = (m, x, y, z, yaw = 0, h = 0.2) => { GOODS_AT.push({ m, x, y, z, yaw, h }); };

/* ---------- V21: Fototexturen für bestehende Materialien ----------
   wantTexture(mat, { map: 'marble-color', normalMap: 'marble-normal', roughnessMap: 'marble-rough', repeat: [0.5, 0.5] })
   merkt sich den Wunsch; applyTextures() (nach dem Manifest) lädt die Dateien und hängt sie ein.
   Bis dahin behält das Material seine gezeichnete Textur oder Farbe. Fehlt eine Datei, bleibt alles wie es war. */
export const textureWishes = [];
export function wantTexture(mat, wish) { textureWishes.push({ mat, wish }); return mat; }
export async function applyTextures() {
  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'bumpMap', 'emissiveMap', 'aoMap'];
  await Promise.all(textureWishes.map(async ({ mat, wish }) => {
    const got = {};
    for (const k of slots) if (wish[k]) { if (!manifest.textures[wish[k]]) return; try { got[k] = await loadTexture(wish[k]); } catch (e) { return; } }
    for (const k in got) {
      const t = got[k];
      if (k !== 'map' && k !== 'emissiveMap') t.encoding = T.LinearEncoding;
      if (wish.repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(wish.repeat[0], wish.repeat[1]); }
      mat[k] = t;
    }
    if (got.normalMap && wish.normalScale !== undefined) mat.normalScale = new T.Vector2(wish.normalScale, wish.normalScale);
    if (got.bumpMap && wish.bumpScale !== undefined) mat.bumpScale = wish.bumpScale;
    if (got.roughnessMap && mat.roughness !== undefined) mat.roughness = wish.roughness ?? 1;
    if (got.metalnessMap && mat.metalness !== undefined) mat.metalness = wish.metalness ?? 1;
    if (wish.color !== undefined) mat.color.set(wish.color);
    if (wish.then) wish.then(mat, got);
    mat.needsUpdate = true;
  }));
}
