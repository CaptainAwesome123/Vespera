/* =====================================================================
   V38 · ECHTES 1920er-AUTO: „1920'S Pierce Arrow“ von Dkerr (Sketchfab), CC BY 4.0
   https://sketchfab.com/3d-models/1920s-pierce-arrow-ab9e5dfffd474d3b9d8c76f46da1a499
   Aufbereitet mit tools/make-car.mjs zu assets/models/pierce-arrow.glb (Knoten body, wheel, lo).
   Ein zusätzlicher Wagentyp neben den eigenen Limousinen (die bleiben): ein Teil des Verkehrs und der
   Parker fährt als Pierce Arrow; wer einen geparkten Pierce Arrow nimmt, fährt ihn selbst.
   Material: Standard-PBR mit Atlas (Farbe, Metall/Rauheit, Normalen); im Alpha der Farbe steckt die
   Lackmaske, dort nimmt der Lack die Farbe des Wagens an (eine Zeile im Shader). Schnee wie bei den Autos.
   Fehlt die Datei, bleibt alles bei den eigenen Autos.
   ===================================================================== */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { T, scene, mergeGeos, snowy, ANISO } from './core.js';
import { ENV } from './people-skeleton.js';
import { resolveAsset } from './assets.js';

export const CARM = {
  ready: false, share: 0.4,                  // Anteil der Pierce Arrows in Verkehr und Parkreihen
  geoHi: null, geoBody: null, geoWheel: null, geoLo: null, mat: null,
  // Maße aus der Datei (extras.car); Werte hier nur, bis sie geladen ist
  dim: { len: 5.1, front: 1.85, rear: -1.85, track: 0.89, r: 0.52, axle: 0.52, lamp: [2.3, 1.22, 0.9], tail: [-2.45, 1.0, 0.72] },
  credit: "„1920'S Pierce Arrow“ von Dkerr (Sketchfab), CC BY 4.0"
};
// Lackfarben für Pierce Arrows (linear): Originalhellblau, Schwarz, Bordeaux, Flaschengrün, Creme, Marine
export const CARM_PAINT = [[0.27, 0.45, 0.6], [0.035, 0.035, 0.04], [0.25, 0.035, 0.05], [0.04, 0.13, 0.08], [0.62, 0.55, 0.4], [0.06, 0.08, 0.2]];
// Stabile Zuordnung: ob ein Wagen ein Pierce Arrow ist, hängt nur von seiner Nummer ab
export const isModelCar = i => { const v = Math.sin(i * 91.7 + 3.1) * 43758.5453; return v - Math.floor(v) < CARM.share; };

export function carModelMat(map, mr, nrm) {
  const m = new T.MeshStandardMaterial({ map, metalnessMap: mr, roughnessMap: mr, normalMap: nrm, metalness: 1, roughness: 1, side: T.DoubleSide });
  if (ENV) { m.envMap = ENV; m.envMapIntensity = 0.85; }
  m.onBeforeCompile = sh => {
    // Lackmaske im Alpha der Farbe: 0 = Lack (Wagenfarbe), 1 = alles andere bleibt wie im Modell
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#ifdef USE_COLOR
        diffuseColor.rgb *= mix(vColor, vec3(1.0), diffuseColor.a);
      #endif
      diffuseColor.a = 1.0;`);
  };
  m.customProgramCacheKey = () => 'carmodel';
  return snowy(m, 0.75, false);
}

let loading = null;
export function loadCarModel() {
  if (loading) return loading;
  loading = new Promise(resolve => {
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(resolveAsset('models/pierce-arrow.glb'), gltf => {
      try {
        const nodes = {}; gltf.scene.traverse(o => { if (o.isMesh) nodes[o.name] = o; });
        if (!nodes.body || !nodes.wheel || !nodes.lo) throw new Error('Knoten fehlen');
        const ex = (gltf.scene.userData && gltf.scene.userData.car) || (gltf.parser.json.scenes[0].extras || {}).car;
        if (ex) Object.assign(CARM.dim, ex);
        const src = nodes.body.material;
        for (const t of [src.map, src.metalnessMap, src.normalMap]) if (t) t.anisotropy = ANISO;
        CARM.tex = [src.map, src.metalnessMap, src.normalMap];
        const plain = o => { const g = new T.BufferGeometry(); for (const k of ['position', 'normal', 'uv']) g.setAttribute(k, o.geometry.attributes[k]); g.setIndex(o.geometry.index); return g; };
        CARM.geoBody = plain(nodes.body); CARM.geoWheel = plain(nodes.wheel); CARM.geoLo = plain(nodes.lo);
        // nahe Fassung: Karosserie mit vier Rädern (rechts die Vorlage, links um 180° gedreht)
        const D = CARM.dim, parts = [CARM.geoBody];
        for (const x of [D.front, D.rear]) for (const s of [1, -1]) {
          const g = CARM.geoWheel.clone(); if (s < 0) g.rotateY(Math.PI); g.translate(x, D.axle, s * D.track); parts.push(g);
        }
        CARM.geoHi = mergeGeos(parts);
        for (const g of [CARM.geoHi, CARM.geoLo, CARM.geoWheel, CARM.geoBody]) { g.computeBoundingSphere(); g.userData.carModel = true; }
        CARM.ready = true;
      } catch (e) { console.warn('Pierce Arrow:', e); }
      resolve(CARM.ready);
    }, undefined, e => { console.warn('Pierce Arrow nicht geladen:', e && e.message || e); resolve(false); });
  });
  return loading;
}
// Instanzen für einen Satz Wagen: nah (mit Rädern), fern (vereinfacht); gleiche Instanzfarben wie die eigenen Autos
export function modelCarMeshes(n, wheels = true) {
  if (!CARM.mat) CARM.mat = carModelMat(...CARM.tex);   // erst beim Aufbau: dann gibt es die Umgebungskarte ENV
  const hi = new T.InstancedMesh(wheels ? CARM.geoHi : CARM.geoBody, CARM.mat, n), lo = new T.InstancedMesh(CARM.geoLo, CARM.mat, n), c = new T.Color(1, 1, 1);
  for (const im of [hi, lo]) { im.setColorAt(0, c); im.count = 0; im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; im.castShadow = true; scene.add(im); }
  return { hi, lo };
}
