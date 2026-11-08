/* =====================================================================
   REQUISITEN AUS ECHTEN MODELLEN (V20/V21)
   Drei Chunk-Schichten, alle aus den Platzierungen, die beim Aufbau geplant wurden:
     'lamps'      Straßenlaternen (serpentine.js plant sie in STREET.lamps). V27: Art-Déco-Kandelaber aus
                  src/decolamp.js (nah fein mit Kanneluren und Goldfinnen, fern schlicht).
     'furniture'  Stadtmobiliar (STREET.furniture): Bank und Papierkorb aus Kenney-Modellen (CC0),
                  Hydrant, Briefkasten, Litfaßsäule, Uhr, Pflanzkübel, Kiosk aus den gezeichneten Formen.
     'props'      freie Platzierungen aus assets/manifest.json (placements) und ?demo=props.
   Solange die Modelle noch laden (oder fehlen), stehen die gezeichneten Formen; sind die Modelle da,
   werden die Zellen einmal neu gebaut (invalidateLayer). Fototexturen: applyTextures() hängt sie an
   die Materialien, die sich mit wantTexture() gemeldet haben (Belmont-Marmor, Gold, Fassaden-Backstein).
   ===================================================================== */
import { T, U, MOBILE, LOW } from './core.js';
import { registerLayer, invalidateLayer } from './chunks.js';
import { manifest, loadManifest, prepareModels, instanceModel, bakeModel, applyTextures, loadTexture, GOODS_AT } from './assets.js';
import { STREET } from './serpentine.js';
import { paintMat, ENV } from './people-skeleton.js';
import { decoLampGeo, decoLampMats } from './decolamp.js';
import { REFL } from './water.js';

export const PROPS_CELL = 250, PROPS_RADIUS = 700, PROPS_LOD_FAR = 260;
export const STREET_CELL = 250, STREET_LOD = 330, LAMP_LOD = 130, LAMP_LOD_M = 35, LAMP_LOD_M2 = 150;              // Zellgröße und Entfernung, ab der nur noch die einfache Form steht (V75: _M = Handy/iPad)
// V75: am Handy/iPad Laternenzellen von 125 m: dann stehen nur die Laternen der nächsten Viertelzellen fein da (am Belmont vorher 284 feine Kandelaber)
export const LAMP_CELL = MOBILE ? 125 : STREET_CELL;
export const props = { placements: [], ready: false, baked: {}, mat: null };

// Modelle je Verwendung: Name im Manifest, Farben je Materialname, Zielhöhe in Metern
export const MODEL_USE = {
  bench: { model: 'kenney-bench', height: 0.92, center: true, colors: { wood: [0.3, 0.17, 0.09], stone: [0.06, 0.06, 0.065] } },
  bin: { model: 'kenney-trashcan', height: 0.95, center: true, colors: { metal: [0.07, 0.07, 0.075], metalDark: [0.5, 0.38, 0.18] } },
};

export function propsMat() { return props.mat || (props.mat = paintMat({ color: 0xffffff, metalness: 0.35, roughness: 0.55, envI: 0.5, emissive: 0x080604 })); }

/* ---------- Laternen ---------- */
const _pm = new T.Matrix4(), _pq = new T.Quaternion(), _pp = new T.Vector3(), _ps = new T.Vector3(1, 1, 1), _pup = new T.Vector3(0, 1, 0);
function inCell(p, cx, cz, size) { return p.x >= cx * size && p.x < (cx + 1) * size && p.z >= cz * size && p.z < (cz + 1) * size; }
function instanced(geo, mat, list, place, colored) {
  const im = new T.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => { place(p, i, im); });
  im.frustumCulled = false; if (colored) im.instanceColor.needsUpdate = true;
  return im;
}
// V69: schwacher Lichtkegel unter jeder nahen Laterne (im Nebel sichtbar), ein offener Kegel je Höhe, addiert, ohne Schatten.
// Oben hell, zum Boden und zum Rand hin weich auslaufend; dicht vor der Kamera ausgeblendet. Nur in der nahen Stufe (bis LAMP_LOD).
const CONE = { mat: null, geo: new Map() };
function coneMat() {
  return CONE.mat ||= new T.ShaderMaterial({
    uniforms: { uFogDensity: U.uFogDensity },
    vertexShader: `varying float vT; varying float vE; varying float vD;
      void main(){ vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0); vT = uv.y;
        vec3 nw = normalize(mat3(modelMatrix * instanceMatrix) * normal); vec3 vd = normalize(cameraPosition - wp.xyz);
        vE = abs(dot(nw, vd)); vD = length(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform float uFogDensity; varying float vT; varying float vE; varying float vD;
      void main(){ float a = pow(vT, 1.6) * smoothstep(0.0, 0.6, vE) * smoothstep(1.5, 7.0, vD) * clamp(0.6 + uFogDensity * 500.0, 0.6, 2.0) * 0.07;
        gl_FragColor = vec4(vec3(1.0, 0.7, 0.38) * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  });
}
function coneGeo(h) {
  if (CONE.geo.has(h)) return CONE.geo.get(h);
  const top = h - 0.55, g = new T.CylinderGeometry(0.18, 3.0, top, 18, 1, true).translate(0, top / 2, 0);   // uv.y: 1 oben, 0 unten
  CONE.geo.set(h, g); return g;
}
export function setupStreetLayers() {
  const LP = STREET.lampParts; if (!LP) return;
  registerLayer({
    // V57: feine Kandelaber (1 656 Dreiecke) nur bis LAMP_LOD m, gemessen bis zum nächsten Rand der Zelle; dahinter die schlichte Form.
    // Kanneluren, Finnen und Rippen sind ab rund 100 m schmaler als ein Bildpunkt. Vorher galt die Grenze ab der Zellmitte
    // (330 m), also bis über 500 m: rund eine Million Dreiecke Laternen je Bild, im Spiegelbild noch einmal.
    // V75: am Handy und iPad nur die Zelle, in der man steht, und ganz nahe Ränder mit den feinen Kandelabern (vorher bis zu neun Zellen,
    // rund 650 000 Dreiecke Laternen je Bild auf dem iPad), ab 150 m eine ganz schlichte dritte Form; Laderadius 280 statt 400 m
    name: 'lamps', size: LAMP_CELL, radius: cam => (MOBILE ? 280 : 400) + Math.max(0, cam.position.y) * (MOBILE ? 0.8 : 1.5), lods: MOBILE ? [LAMP_LOD_M, LAMP_LOD_M2] : [LAMP_LOD], lodEdge: true, lodHyst: MOBILE ? 10 : 20,
    build(cx, cz, lod) {
      const here = STREET.lamps.filter(l => !l.taken && inCell(l, cx, cz, LAMP_CELL)); if (!here.length) return null;
      for (const l of here) l._ims = [];   // V53: Telekinese nimmt Laternen heraus (beide Netze)
      // V27: Art-Déco-Kandelaber (src/decolamp.js), je Höhe ein Netz für Eisen und Gold und eins für das Milchglas
      const g = new T.Group(), M = decoLampMats(), byH = new Map();
      for (const l of here) { if (!byH.has(l.h)) byH.set(l.h, []); byH.get(l.h).push(l); }
      for (const [h, list] of byH) {
        const G = decoLampGeo(h, lod);
        g.add(instanced(G.metal, M.metal, list, (l, i, im) => { im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y, l.z)); l._ims.push([im, i]); }));
        g.add(instanced(G.glass, M.glass, list, (l, i, im) => { im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y, l.z)); l._ims.push([im, i]); }));
        // V71: am Handy und in der niedrigen Stufe ohne Lichtkegel (addiert, bildschirmgroß, wenn man unter einer Laterne steht)
        if (lod === 0 && !MOBILE && !LOW) { const c = instanced(coneGeo(h), coneMat(), list, (l, i, im) => { im.setMatrixAt(i, _pm.makeTranslation(l.x, l.y, l.z)); l._ims.push([im, i]); }); c.renderOrder = 3; c.userData.noRefl = true; g.add(c); }
      }
      // V57: die Zelle wechselt jetzt öfter die Detailstufe; gleich ins Spiegelbild aufnehmen (sonst erst beim nächsten reflSweep nach bis zu 4 s)
      if (REFL.rt) { g.traverse(o => { if (!o.userData.noRefl) o.layers.enable(1); }); g.userData.reflSeen = true; }
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
      // V52: p._im/_i merken sich die Instanz (Telekinese nimmt das Stück heraus: p.taken, Instanz auf 0)
      // V53: p._ims = alle Netze des Stücks (Säule: Plakate + Gestell, Uhr: Gestell + Zifferblätter)
      const colored = (p, i, im) => { im.setMatrixAt(i, p.m); im.setColorAt(i, cc.setRGB(...p.c)); p._im = im; p._i = i; p._ims.push([im, i]); };
      const plain = (p, i, im) => { im.setMatrixAt(i, p.m); p._ims.push([im, i]); };
      for (const k in F.out) {
        const list = F.out[k].filter(p => !p.taken && inCell(p, cx, cz, STREET_CELL)); if (!list.length) continue;
        for (const p of list) p._ims = [];
        const bk = props.baked[k];
        if (bk) { g.add(instanced(bk.geo, bk.material || propsMat(), list, colored, true)); continue; }
        if (k === 'column') { g.add(instanced(F.colGeo, F.posterMat, list, plain)); g.add(instanced(F.colParts, F.mat, list, colored, true)); continue; }
        g.add(instanced(F.TYPES[k], F.mat, list, colored, true));
        if (k === 'clock') g.add(instanced(F.faces, F.faceMat, list, plain));
      }
      return g.children.length ? g : null;
    },
    dispose() {},
  });
}

/* ---------- V23: Waren in Läden, Bar und Restaurant (Kenney Food Kit, CC0) ----------
   GOODS_AT sammelt beim Aufbau { m, x, y, z, yaw, h }; je Ware wird der Knoten aus kenney-goods.glb
   gebacken und je Platz so skaliert, dass seine größte Ausdehnung h Meter misst. Nur in der Nähe sichtbar (kleine Teile). */
export const GOODS_CELL = 120;
const goods = { baked: {}, mat: null };
function setupGoods() {
  goods.mat = paintMat({ color: 0xffffff, metalness: 0.04, roughness: 0.62, envI: 0.35, emissive: 0x0a0806 });
  // je Ware auf 1 m größte Ausdehnung bringen: h am Platz ist dann die Größe des Stücks in Metern
  for (const m of new Set(GOODS_AT.map(g => g.m))) {
    const b = bakeModel('kenney-goods', { node: m, center: true }); if (!b) continue;
    const e = Math.max(b.box.max.x - b.box.min.x, b.box.max.y - b.box.min.y, b.box.max.z - b.box.min.z) || 1;
    b.geo.scale(1 / e, 1 / e, 1 / e); b.geo.computeBoundingSphere(); goods.baked[m] = b;
  }
  if (!Object.keys(goods.baked).length) return;
  registerLayer({
    name: 'goods', size: GOODS_CELL, radius: cam => 95 + Math.max(0, cam.position.y) * 0.3,
    build(cx, cz) {
      const here = GOODS_AT.filter(p => inCell(p, cx, cz, GOODS_CELL)); if (!here.length) return null;
      const g = new T.Group(), by = new Map();
      // V26: aufgehobene Waren (src/physics.js) bleiben weg; jede Ware merkt sich ihre Instanz, damit sie beim Aufheben verschwindet
      for (const p of here) if (goods.baked[p.m] && !p.taken) { if (!by.has(p.m)) by.set(p.m, []); by.get(p.m).push(p); }
      for (const [m, list] of by) g.add(instanced(goods.baked[m].geo, goods.mat, list, (p, i, im) => { _pq.setFromAxisAngle(_pup, p.yaw); im.setMatrixAt(i, _pm.compose(_pp.set(p.x, p.y, p.z), _pq, _ps.setScalar(p.h))); p._im = im; p._i = i; }));
      for (const im of g.children) im.userData.items = by.get([...by.keys()][g.children.indexOf(im)]);
      return g.children.length ? g : null;
    },
    dispose(obj) { for (const im of obj.children) for (const p of im.userData.items || []) if (p._im === im) p._im = null; },
  });
}
export const goodsBaked = m => goods.baked[m] || null;
export const goodsMaterial = () => goods.mat;

/* ---------- Modelle und Texturen nachladen, dann die Schichten einmal neu bauen ---------- */
export async function setupProps() {
  await loadManifest();
  const demo = new URLSearchParams(location.search).get('demo') === 'props' && manifest.demo;
  props.placements = [...(manifest.placements || []), ...(demo ? manifest.demo.placements || [] : [])];
  const uses = Object.values(MODEL_USE).filter(u => manifest.models[u.model]);
  const wantGoods = GOODS_AT.length && manifest.models['kenney-goods'];
  await prepareModels([...props.placements.map(p => p.model), ...uses.map(u => u.model), ...(wantGoods ? ['kenney-goods'] : [])]);
  if (wantGoods) setupGoods();
  for (const [use, def] of Object.entries(MODEL_USE)) {
    const b = bakeModel(def.model, { ...def, envMap: ENV });
    if (b) props.baked[use] = b;
  }
  // Instanzfarbe für Teile mit Farbe PAINT; die Kenney-Modelle bekommen feste Farben, Hydrant usw. bleiben bunt
  if (Object.keys(props.baked).length) invalidateLayer('furniture');
  props.ready = true;
  applyTextures().catch(() => {});
  // Backstein für den Fassaden-Shader
  if (manifest.textures['stone-color']) loadTexture('stone-color').then(t => { t.encoding = T.LinearEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; U.uStone.value = t; U.uStoneOn.value = 1; }).catch(() => {});
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
