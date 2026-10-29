import * as THREE from 'three';

/* =====================================================================
   VESPERA
   Die Stadt wird prozedural erzeugt. Jeder Baustein hat eine eigene
   Funktion (buildCity, buildBelmont, buildAirship …). Wer eigene Modelle
   hat (glTF), ersetzt die jeweilige Funktion und registriert die
   Kollisionsquader über addCollider().
   ===================================================================== */

export const T = THREE;
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
export const renderer = new T.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
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
  uInside: { value: 0 },
  uWind: { value: new T.Vector4(0.8, 0.6, 4, 0) },   // Windrichtung (x, z), Stärke in m/s, Böe
  uBrick: { value: new T.DataTexture(new Uint8Array([120, 70, 55, 255]), 1, 1) }, // V21: Foto-Backstein für die Fassaden (assets/textures), kommt per applyTextures
  uBrickOn: { value: 0 },
  uStone: { value: new T.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1) }, // V23: Foto-Gestein (ambientCG Rock020) als Feinstruktur für Quader, Kalk- und Sandstein, Granit
  uStoneOn: { value: 0 },
  // V25 · Polarnacht und Wetter (atmosphere.js): Regen, Schnee, Eisglitzern, Nässe und Schneedecke am Boden, Polarlicht, Bewölkung, Mondphase
  uRain: { value: 0 }, uSnow: { value: 0 }, uFrost: { value: 0 }, uWet: { value: 0.3 }, uSnowCover: { value: 0 },
  uAurora: { value: 0.4 }, uCloud: { value: 0.3 }, uMoonPhase: { value: 0.5 }, uMoonLit: { value: 1 }, uMist: { value: 1 },
  uStreetRefl: { value: 0 },
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
export const FOG_K = 12.0, FOG_SH = 14.0, FOG_E2 = 0.75;
export const FOG_GLSL = `
float vespHF(float d, float y, float cy, float dens){
  float a = max(cy + 2.0, 0.0), b = max(y + 2.0, 0.0), ea = exp(-a / ${FOG_SH.toFixed(1)}), eb = exp(-b / ${FOG_SH.toFixed(1)}), dy = b - a;
  float avg = abs(dy) < 0.05 ? ea : ${FOG_SH.toFixed(1)} * (ea - eb) / dy;
  return dens * ${FOG_K.toFixed(2)} * d * avg;
}
float vespFog(float d, float y, float cy, float dens, float k){ return clamp(1.0 - exp(-dens*dens*d*d*k*${FOG_E2.toFixed(2)} - vespHF(d, y, cy, dens)), 0.0, 1.0); }
`;
// optische Tiefe des Nebels zwischen Kamera (Höhe cy) und einem Punkt in Abstand d und Höhe y (wie vespFog mit k = 1)
export function fogOptical(d, y, cy, dens) {
  const a = Math.max(cy + 2, 0), b = Math.max(y + 2, 0), ea = Math.exp(-a / FOG_SH), eb = Math.exp(-b / FOG_SH), dy = b - a;
  const avg = Math.abs(dy) < 0.05 ? ea : FOG_SH * (ea - eb) / dy;
  return dens * dens * d * d * FOG_E2 + dens * FOG_K * d * avg;
}
// Abstand, ab dem ein Punkt in Höhe y zu mehr als 98,5 % im Nebel liegt (optische Tiefe 4,2); quadratische Gleichung in d
export function fogHideDist(y, cy, dens) {
  const a = dens * dens * FOG_E2, b = fogOptical(1, y, cy, dens) - a;
  return a > 1e-12 ? (-b + Math.sqrt(b * b + 4 * a * 4.2)) / (2 * a) : 4.2 / Math.max(b, 1e-9);
}
export const FOGVIS = { ped: 1e9, low: 1e9, tall: 1e9 };
T.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth; varying float vFogWY;
#endif`;
T.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = length(mvPosition.xyz);   // V27: echter Abstand statt Bildtiefe (Nebel dreht nicht mehr mit dem Blick, Ausblenden im Nebel wird exakt)
  vFogWY = ((mvPosition.xyz - viewMatrix[3].xyz) * mat3(viewMatrix)).y;
#endif`;
T.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth; varying float vFogWY;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  ${FOG_GLSL}
#endif`;
// Leuchtende (additive) Flächen verblassen im Nebel, statt die Nebelfarbe aufzuaddieren (FOG_ADD setzt atmosphere.js)
T.ShaderChunk.fog_fragment = `#ifdef USE_FOG
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

export const hemi = new T.HemisphereLight(new T.Color(0.1, 0.18, 0.3), new T.Color(0.12, 0.42, 0.44), 0.9);
scene.add(hemi);
export const moonLight = new T.DirectionalLight(new T.Color(0.55, 0.6, 0.9), 0.45);
moonLight.position.copy(MOON_DIR).multiplyScalar(1000);
scene.add(moonLight);

/* ---------- Kleine Helfer ---------- */
export function mergeGeos(geos) {
  const parts = geos.map(g => g.index ? g.toNonIndexed() : g);
  let n = 0; parts.forEach(g => n += g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const m = new T.BufferGeometry();
  m.setAttribute('position', new T.BufferAttribute(pos, 3));
  m.setAttribute('normal', new T.BufferAttribute(nor, 3));
  m.setAttribute('uv', new T.BufferAttribute(uv, 2));
  return m;
}
// Texturen werden mit doppelter Auflösung gezeichnet, solange sie nicht zu groß werden (scharfe Schrift und Böden)
export function canvasTex(w, h, draw) {
  const S = MOBILE ? (w * h > 1000000 ? 0.5 : 1) : w * h <= 300000 && Math.max(w, h) * 3 <= renderer.capabilities.maxTextureSize ? 3 : w * h <= 2400000 && Math.max(w, h) * 2 <= renderer.capabilities.maxTextureSize ? 2 : 1;
  const c = document.createElement('canvas'); c.width = w * S; c.height = h * S;
  const g = c.getContext('2d'); g.scale(S, S);
  draw(g, w, h);
  const t = new T.CanvasTexture(c);
  t.anisotropy = ANISO;
  return t;
}
