import * as THREE from 'three';

/* =====================================================================
   VESPERA
   Die Stadt wird prozedural erzeugt. Jeder Baustein hat eine eigene
   Funktion (buildCity, buildBelmont, buildAirship …). Wer eigene Modelle
   hat (glTF), ersetzt die jeweilige Funktion und registriert die
   Kollisionsquader über addCollider().
   ===================================================================== */

export const T = THREE;

/* ---------- V29: Matrizen nur neu rechnen, wenn sich etwas bewegt hat ----------
   three.js setzt jede Matrix in jedem Bild neu zusammen (rund 3000 Objekte) und multipliziert sie mit der Matrix der
   Eltern, auch wenn sich nichts bewegt. Hier merkt sich jedes Objekt Lage, Drehung und Größe der letzten Rechnung;
   sind sie gleich, bleibt die Matrix stehen und die Kinder müssen nicht nachgezogen werden. Neu eingehängte Objekte
   rechnen einmal neu (die Eltern könnten andere sein). Das Ergebnis ist bitgleich, nur die Arbeit fällt weg. */
{
  const P = THREE.Object3D.prototype, upd = P.updateMatrix, add = P.add;
  P.updateMatrix = function () {
    const p = this.position, q = this.quaternion, s = this.scale, c = this._mc || (this._mc = new Float64Array(10).fill(NaN));
    if (c[0] === p.x && c[1] === p.y && c[2] === p.z && c[3] === q._x && c[4] === q._y && c[5] === q._z && c[6] === q._w && c[7] === s.x && c[8] === s.y && c[9] === s.z) return;
    c[0] = p.x; c[1] = p.y; c[2] = p.z; c[3] = q._x; c[4] = q._y; c[5] = q._z; c[6] = q._w; c[7] = s.x; c[8] = s.y; c[9] = s.z;
    upd.call(this);
  };
  P.add = function (...objs) { for (const o of objs) if (o && o._mc) o._mc[0] = NaN; return add.apply(this, objs); };
}
// Zustand, den mehrere Dateien schreiben (frühere gemeinsame Variablen der einen großen Datei)
export const shared = { SINK: undefined, carBodyGeo: undefined, carMesh: undefined, carMeshHi: undefined, carCmp: undefined, carLights: undefined, parkedTimer: undefined, bloomOn: undefined, lastDistrict: undefined, districtTimer: undefined, toastTimer: undefined, sayTimer: undefined, last: undefined };
export const $ = id => document.getElementById(id);

/* ---------- Zufall mit festem Startwert: jede Sitzung dieselbe Stadt ---------- */
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const R = mulberry32(19271927);
export const rand = (a = 0, b = 1) => a + (b - a) * R();
export const pick = arr => arr[Math.floor(R() * arr.length)];

/* ---------- Renderer, Szene, Kamera ---------- */
export const canvas = $('c');
// Handys und Tablets (vor allem iPhone/iPad) haben wenig Grafikspeicher: dort kleinere Texturen, weniger Figuren, niedrigere Auflösung
export const MOBILE = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
// V29: Kantenglättung macht der Composer in seinem eigenen Ziel (4x MSAA). Auf der Leinwand landet nur noch ein bildfüllendes
// Rechteck, dort wäre Antialiasing ein zweiter, unsichtbarer Mehrfach-Puffer in voller Größe. Nur die Testbühne (?lab) zeichnet direkt.
export const renderer = new T.WebGLRenderer({ canvas, antialias: !MOBILE && /[?&]lab=/.test(location.search), powerPreference: 'high-performance' });
export const ANISO = Math.min(16, renderer.capabilities.getMaxAnisotropy());
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
export const scene = new T.Scene();
export const FOG_COLOR = new T.Color(0.03, 0.125, 0.142);   // V25: etwas türkiser
export const FOG_DENSITY = 0.00085;
export const TEAL = new T.Color(0.18, 0.62, 0.66);
scene.fog = new T.FogExp2(FOG_COLOR, FOG_DENSITY);
scene.background = FOG_COLOR.clone();
export const camera = new T.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.2, 20000);
camera.rotation.order = 'YXZ';

export const MOON_DIR = new T.Vector3(-0.42, 0.42, -0.8).normalize();
export const U = {
  uTime: { value: 0 },
  uFogColor: { value: FOG_COLOR },
  uFogDensity: { value: FOG_DENSITY },
  uMoonDir: { value: MOON_DIR },
  uScale: { value: 600 },
  uCam: { value: new T.Vector3() },
  uTeal: { value: TEAL },
  uVilla: { value: new T.Vector3(0, -1000, 0) },
  uVillaRot: { value: new T.Vector3(1, 0, 0) },   // V33: cos/sin der Villendrehung, z = 1 wenn gebaut (Gelände im Haus wird verworfen)
  uInside: { value: 0 },
  uWind: { value: new T.Vector4(0.8, 0.6, 4, 0) },   // Windrichtung (x, z), Stärke in m/s, Böe
  uBrick: { value: new T.DataTexture(new Uint8Array([120, 70, 55, 255]), 1, 1) }, // V21: Foto-Backstein für die Fassaden (assets/textures), kommt per applyTextures
  uBrickOn: { value: 0 },
  uStone: { value: new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }, // V23: Foto-Gestein (ambientCG Rock020) als Feinstruktur für Quader, Kalk- und Sandstein, Granit
  uStoneOn: { value: 0 },
  // V25 · Polarnacht und Wetter (atmosphere.js): Regen, Schnee, Eisglitzern, Nässe und Schneedecke am Boden, Polarlicht, Bewölkung, Mondphase
  uRain: { value: 0 }, uSnow: { value: 0 }, uFrost: { value: 0 }, uWet: { value: 0.3 }, uSnowCover: { value: 0.4 },
  uAurora: { value: 0.4 }, uCloud: { value: 0.3 }, uMoonPhase: { value: 0.5 }, uMoonLit: { value: 1 }, uMist: { value: 1 },
  uStreetRefl: { value: 0 },
  // V30: die nächsten Straßenlaternen (xyz = Leuchtkopf, w = Stärke) für warmes Licht und Glanz auf dem Pflaster (streetDetail)
  uLamps: { value: Array.from({ length: 16 }, () => new T.Vector4(0, -1000, 0, 0)) },
  uRoofMap: { value: new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1) }, uRoofBox: { value: new T.Vector4(-1200, -1200, 2400, 255) },
};
U.uRoofMap.value.needsUpdate = true;
U.uBrick.value.needsUpdate = true; U.uStone.value.needsUpdate = true;

/* ---------- V25: Bodennebel ----------
   Zum gewohnten Dunst (FogExp2) kommt ein Nebel, der am Boden dicht ist und nach oben ausdünnt (Skalenhöhe 16 m):
   die Straßen liegen im türkisen Schleier, die Türme ragen heraus. Integral der Dichte entlang des Sehstrahls.
   Gilt für alle eingebauten Materialien (Fog-Chunks unten) und die eigenen Shader (FOG_GLSL). */
// V27: Bodennebel dichter (FOG_K 7 -> 12) und flacher (Skalenhöhe 16 -> 14 m), der gleichmäßige Dunst schwächer (FOG_E2 0,75):
// die Straßen versinken früher im Türkis, die Türme und die ferne Silhouette bleiben so sichtbar wie vorher.
// fogOptical() rechnet dasselbe auf der CPU (performance.js blendet damit aus, was im Nebel ohnehin verschwindet).
// V30: Bodennebel setzt erst nach einigen Metern voll ein (wirksamer Weg d - FOG_NEAR·(1 - e^(-d/FOG_NEAR))): der Boden zu Füßen
// bleibt lesbar, in der Ferne fehlen nur FOG_NEAR Meter Nebel, die Stimmung bleibt.
export const FOG_K = 12.0, FOG_SH = 14.0, FOG_E2 = 0.75, FOG_NEAR = 14.0;
export const FOG_GLSL = `
float vespHF(float d, float y, float cy, float dens){
  float a = max(cy + 2.0, 0.0), b = max(y + 2.0, 0.0), ea = exp(-a / ${FOG_SH.toFixed(1)}), eb = exp(-b / ${FOG_SH.toFixed(1)}), dy = b - a;
  float avg = abs(dy) < 0.05 ? ea : ${FOG_SH.toFixed(1)} * (ea - eb) / dy;
  float dn = d - ${FOG_NEAR.toFixed(1)} * (1.0 - exp(-d / ${FOG_NEAR.toFixed(1)}));   // V30: die ersten Meter fast klar
  return dens * ${FOG_K.toFixed(2)} * dn * avg;
}
float vespFog(float d, float y, float cy, float dens, float k){ return clamp(1.0 - exp(-dens*dens*d*d*k*${FOG_E2.toFixed(2)} - vespHF(d, y, cy, dens)), 0.0, 1.0); }
`;
// optische Tiefe des Nebels zwischen Kamera (Höhe cy) und einem Punkt in Abstand d und Höhe y (wie vespFog mit k = 1)
export function fogOptical(d, y, cy, dens) {
  const a = Math.max(cy + 2, 0), b = Math.max(y + 2, 0), ea = Math.exp(-a / FOG_SH), eb = Math.exp(-b / FOG_SH), dy = b - a;
  const avg = Math.abs(dy) < 0.05 ? ea : FOG_SH * (ea - eb) / dy;
  const dn = d - FOG_NEAR * (1 - Math.exp(-d / FOG_NEAR));
  return dens * dens * d * d * FOG_E2 + dens * FOG_K * dn * avg;
}
// Abstand, ab dem ein Punkt in Höhe y zu mehr als 98,5 % im Nebel liegt (optische Tiefe 4,2); quadratische Gleichung in d
export function fogHideDist(y, cy, dens) {
  // V30: Bodennebel wirkt auf d - FOG_NEAR (der e-Rest ist in dieser Entfernung vernachlässigbar, er blendet höchstens etwas später aus)
  const a = dens * dens * FOG_E2, b = (fogOptical(1, y, cy, dens) - a) / (1 - FOG_NEAR * (1 - Math.exp(-1 / FOG_NEAR))), c = 4.2 + b * FOG_NEAR;
  return a > 1e-12 ? (-b + Math.sqrt(b * b + 4 * a * c)) / (2 * a) : c / Math.max(b, 1e-9);
}
export const FOGVIS = { ped: 1e9, low: 1e9, tall: 1e9, cap: 1e9 };   // V34: cap = Sichtweite aus geschlossenen Innenräumen (Belmont-Sockel)
// V31: der Abstand wird je Bildpunkt aus der (linear interpolierbaren) Blickraum-Lage gerechnet. Vorher kam length() je Ecke und wurde
// über das Dreieck gemittelt: auf dem Straßenboden (wenige riesige Dreiecke bis an die Küste) lag so überall der Abstand der fernen
// Ecken an, die Fahrbahn versank bis vor die Füße in flachem Türkis.
T.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying vec3 vFogP; varying float vFogWY;
#endif`;
T.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogP = mvPosition.xyz;   // V27: echter Abstand statt Bildtiefe (Nebel dreht nicht mehr mit dem Blick, Ausblenden im Nebel wird exakt)
  vFogWY = ((mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix)).y;
#endif`;
T.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying vec3 vFogP; varying float vFogWY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  ${FOG_GLSL}
#endif`;
// Leuchtende (additive) Flächen verblassen im Nebel, statt die Nebelfarbe aufzuaddieren (FOG_ADD setzt atmosphere.js)
T.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  float vFogDepth = length(vFogP);
  #ifdef FOG_EXP2
    float fogFactor = vespFog(vFogDepth, vFogWY, cameraPosition.y, fogDensity, 1.0);
  #else
    float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
  #endif
  #ifdef FOG_ADD
    gl_FragColor.rgb *= 1.0 - fogFactor;
  #else
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
  #endif
#endif`;

/* ---------- V30: Schnee auf allem, was im Freien nach oben zeigt ----------
   Polarnacht: eine leichte Schneedecke liegt immer (uSnowCover hat in atmosphere.js eine Untergrenze), bei Schneefall wird sie dicker.
   snowy(mat, k, still) legt sie auf ein Standardmaterial: auf Flächen mit Normale nach oben, fleckig nach Weltlage (still = false:
   ohne Flecken, für Dinge, die sich bewegen wie Autos). Nur für Außenmaterialien verwenden, sonst schneit es in die Räume. */
export function snowy(mat, k = 1, still = true) {
  const prev = mat.onBeforeCompile, pk = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uSnowCover = U.uSnowCover;
    sh.fragmentShader = 'uniform float uSnowCover;\n' + sh.fragmentShader.replace('#include <lights_physical_fragment>', `{
      vec3 snN = (vec4(normal, 0.0) * viewMatrix).xyz;
      vec3 snP = (vec4(-vViewPosition - viewMatrix[3].xyz, 0.0) * viewMatrix).xyz;
      float snA = clamp(0.3 + 0.75 * uSnowCover, 0.0, 1.0) * ${k.toFixed(2)};
      ${still ? `vec2 snQ = snP.xz * 1.7; vec2 snI = floor(snQ), snF = fract(snQ); snF = snF * snF * (3.0 - 2.0 * snF);
      #define SNH(v) fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453)
      float snNo = mix(mix(SNH(snI), SNH(snI + vec2(1.0, 0.0)), snF.x), mix(SNH(snI + vec2(0.0, 1.0)), SNH(snI + vec2(1.0, 1.0)), snF.x), snF.y);
      #undef SNH` : 'float snNo = 0.6;'}
      float snK = smoothstep(0.5 - 0.25 * snA, 0.85 - 0.2 * snA, snN.y) * smoothstep(0.15, 0.45, snA + snNo * 0.5 - 0.25);
      snK *= snA;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.78, 0.88), snK);
      roughnessFactor = mix(roughnessFactor, 0.7, snK); metalnessFactor = mix(metalnessFactor, 0.0, snK);
    }
    #include <lights_physical_fragment>`);
  };
  mat.customProgramCacheKey = () => pk + '|snow' + k + still;
  return mat;
}

export const hemi = new T.HemisphereLight(new T.Color(0.1, 0.18, 0.3), new T.Color(0.12, 0.42, 0.44), 0.9);
scene.add(hemi);
export const moonLight = new T.DirectionalLight(new T.Color(0.55, 0.6, 0.9), 0.45);
moonLight.position.copy(MOON_DIR).multiplyScalar(1000);
scene.add(moonLight);

/* ---------- Kleine Helfer ---------- */
// Hülle um dieselben Puffer: Attribute ergänzen, ohne das (vielleicht mehrfach benutzte) Original zu verändern
export function geoView(g) { const h = new T.BufferGeometry(); for (const k in g.attributes) h.setAttribute(k, g.attributes[k]); h.setIndex(g.index); h.userData = g.userData; return h; }
// V29: Teile behalten ihren Index (vorher wurde jedes Teil erst in lose Dreiecke zerlegt). Gleiche Dreiecke in
// gleicher Reihenfolge, aber jede Ecke nur einmal gespeichert. Teile ohne Index bekommen einen fortlaufenden.
// Wer nach dem Zusammenfügen Werte je Teil setzt, zählt mit g.attributes.position.count des Teils (wie bisher).
// Attribut an Stelle o (in Ecken) kopieren; verschränkte oder längere Puffer (glTF) Wert für Wert
const _getC = ['getX', 'getY', 'getZ', 'getW'];
function putAttr(dst, a, o, s) {
  if (!a.isInterleavedBufferAttribute && a.array.length === a.count * s) { dst.set(a.array, o * s); return; }
  for (let i = 0; i < a.count; i++) for (let c = 0; c < s; c++) dst[(o + i) * s + c] = a[_getC[c]](i);
}
export function mergeGeos(geos) {
  let n = 0, ni = 0;
  for (const g of geos) { const c = g.attributes.position.count; n += c; ni += g.index ? g.index.count : c; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = n > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let o = 0, oi = 0;
  for (const g of geos) {
    const c = g.attributes.position.count;
    putAttr(pos, g.attributes.position, o, 3);
    putAttr(nor, g.attributes.normal, o, 3);
    if (g.attributes.uv) putAttr(uv, g.attributes.uv, o, 2);
    if (g.index) { const I = g.index.array; for (let k = 0; k < I.length; k++) idx[oi + k] = I[k] + o; oi += I.length; }
    else { for (let k = 0; k < c; k++) idx[oi + k] = o + k; oi += c; }
    o += c;
  }
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.BufferAttribute(pos, 3));
  m.setAttribute('normal', new T.BufferAttribute(nor, 3));
  m.setAttribute('uv', new T.BufferAttribute(uv, 2));
  // V30: eigene Attribute, die alle Teile tragen (z. B. aRect der Bürgersteige), mitnehmen; vorher gingen sie verloren
  for (const k in geos[0].attributes) {
    if (!/^a[A-Z]/.test(k)) continue;   // nur eigene Shader-Attribute; color/tangent/uv2 aus Modellen bleiben wie bisher weg
    const s = geos[0].attributes[k].itemSize;
    if (geos.some(g => !g.attributes[k] || g.attributes[k].itemSize !== s)) continue;
    const arr = new Float32Array(n * s); o = 0;
    for (const g of geos) { putAttr(arr, g.attributes[k], o, s); o += g.attributes.position.count; }
    m.setAttribute(k, new T.BufferAttribute(arr, s));
  }
  m.setIndex(new T.BufferAttribute(idx, 1));
  return m;
}
// V29: feste Einzelteile einer Gruppe je Material zu einem Netz verschmelzen (ein Draw Call statt Dutzender).
// Nur undurchsichtige Teile ohne eigene Bewegung; die Lage jedes Teils relativ zur Gruppe wird in die Geometrie gerechnet.
export function bakeGroup(grp) {
  grp.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(grp.matrixWorld).invert(), by = new Map(), rm = [];
  grp.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.material.transparent || Array.isArray(o.material) || !o.geometry.attributes.normal) return;
    const g = o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    (by.get(o.material) || by.set(o.material, []).get(o.material)).push(g); rm.push(o);
  });
  for (const o of rm) o.parent.remove(o);
  grp.traverse(o => { if (o.isGroup && o !== grp && !o.children.length) rm.push(o); });
  for (const o of rm) if (o.parent) o.parent.remove(o);
  for (const [mat, list] of by) grp.add(new T.Mesh(mergeGeos(list), mat));
}
// Texturen werden mit doppelter Auflösung gezeichnet, solange sie nicht zu groß werden (scharfe Schrift und Böden)
export function canvasTex(w, h, draw) {
  // V34: höchstens doppelte Auflösung und nur für kleine Leinwände. Vorher bis dreifach (512² wurde 1536²) und große Böden doppelt
  // (4096 x 2220): zusammen rund 1,7 GB Grafikspeicher plus 1,3 GB Leinwände, daran stürzte der Browser im Belmont ab.
  const S = MOBILE ? (w * h > 1000000 ? 0.5 : 1) : w * h <= 300000 && Math.max(w, h) * 2 <= renderer.capabilities.maxTextureSize ? 2 : 1;
  const c = document.createElement('canvas'); c.width = w * S; c.height = h * S;
  const g = c.getContext('2d'); g.scale(S, S);
  draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.anisotropy = ANISO;
  return t;
}
