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
import { T, renderer, ANISO } from './core.js';

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
