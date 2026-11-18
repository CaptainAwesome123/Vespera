/* =====================================================================
   V115 TEXTUREN: Risse, Struktur, Schmutz und Abnutzung
   Eine einzige kachelbare Textur (assets/textures/verwitterung.jpg, gerechnet von tools/make-verwitterung.py)
   liefert in drei Kanälen Risse (R), Schmutz und Laufspuren (G) und Feinstruktur mit Abplatzern (B).
   Sie hängt global an U.uWear (wie U.uStone): die Shader werden einmal mit einem 1x1-Platzhalter übersetzt,
   die Datei kommt später nach, ohne dass etwas neu übersetzt wird.

   verwittert(mat, 'putz' | 'stein' | 'marmor' | 'eisen' | 'holz', { ground })
     legt die Textur ohne UV-Koordinaten auf jede Fläche (Projektion nach der Hauptachse der Normalen),
     dunkelt Risse ein, prägt die Feinstruktur als Relief (nur aus der Nähe), lässt Schmutz und an Metall Rost
     aufblühen und schwärzt den Fuß der Dinge, wo sie auf dem Boden stehen (Bodenkontakt).
     local: Koordinaten im Modell (Stadtmöbel, Laternen als InstancedMesh: Fuß bei y = 0), sonst Welt.
   patina(mat, { ribs })   Grünspan auf Kupferkuppeln und -dächern: türkisgrün, dunkle Laufspuren unter der Laterne,
     blankes Kupfer an Kanten, Stehfalze, auf Wunsch goldene Rippen.
   Aus mit ?texturen=aus.
   ===================================================================== */
import { T, U } from './core.js';

export const TEXTUREN = new URLSearchParams(location.search).get('texturen') !== 'aus';

// Einstellungen je Werkstoff: Maßstab (m je Kachel), Risse, Schmutz, Relief, Rost, Bodenkontakt (Höhe in m), Schmutzfarbe
const ART = {
  putz:   { sc: 1.8, crack: 0.6,  grime: 0.4, bump: 0.9, rust: 0.0, foot: 0.0, dirt: [0.33, 0.29, 0.24] },
  stein:  { sc: 2.4, crack: 0.85, grime: 0.7, bump: 1.4, rust: 0.0, foot: 0.0, dirt: [0.22, 0.22, 0.2] },
  marmor: { sc: 2.6, crack: 0.35, grime: 0.22, bump: 0.35, rust: 0.0, foot: 0.0, dirt: [0.4, 0.36, 0.3] },
  eisen:  { sc: 1.1, crack: 0.0,  grime: 0.75, bump: 0.8, rust: 0.85, foot: 0.55, dirt: [0.12, 0.11, 0.1], local: true },
  holz:   { sc: 1.2, crack: 0.25, grime: 0.55, bump: 0.6, rust: 0.0, foot: 0.4, dirt: [0.16, 0.13, 0.1], local: true },
};
const f = v => (+v).toFixed(3);

// Gemeinsamer Teil für den Vertex-Shader: Lage und Normale in Modell- oder Weltkoordinaten
function vertexPart(local) {
  return local ? `vVwP = transformed; vVwN = objectNormal;` : `
    #ifdef USE_INSTANCING
      vVwP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vVwN = mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal;
    #else
      vVwP = (modelMatrix * vec4(transformed, 1.0)).xyz; vVwN = mat3(modelMatrix) * objectNormal;
    #endif`;
}
// Relief aus einer Höhe über Bildschirmableitungen (wie three.js bumpmap, ohne eigene Textur-UV); nur WebGL2
const BUMP_FN = `
#if __VERSION__ >= 300
vec3 vwBump(vec3 p, vec3 n, float h, float k) {
  vec3 sx = dFdx(p), sy = dFdy(p), r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 grad = sign(det) * (dFdx(h) * k * r1 + dFdy(h) * k * r2);
  return normalize(abs(det) * n - grad);
}
#endif
`;

function hook(mat, key, vtx, frag, pre = '') {
  if (!TEXTUREN || !mat || mat.userData.v115) return mat;   // jedes Material nur einmal
  mat.userData.v115 = key;
  const prev = mat.onBeforeCompile, pk = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev.call(mat, sh, r);
    sh.uniforms.uWear = U.uWear; sh.uniforms.uWearOn = U.uWearOn;
    sh.vertexShader = 'varying vec3 vVwP, vVwN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vtx);
    sh.fragmentShader = 'uniform sampler2D uWear; uniform float uWearOn; varying vec3 vVwP, vVwN;\n' + pre + BUMP_FN + sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + frag);
  };
  mat.customProgramCacheKey = () => pk + '|v115' + key;
  return mat;
}

export function verwittert(mat, art = 'stein', o = {}) {
  const A = { ...ART[art] || ART.stein, ...o };
  const local = !!A.local, ground = A.ground ?? 0;
  const foot = A.foot > 0 && (local || A.ground !== undefined);
  return hook(mat, art + (local ? 'L' : 'W') + (foot ? ground : ''), vertexPart(local), `{
    vec3 vwA = abs(vVwN);
    vec2 vwUV = (vwA.y > max(vwA.x, vwA.z) ? vVwP.xz : vwA.x > vwA.z ? vVwP.zy : vVwP.xy) / ${f(A.sc)};
    vec3 vw = texture2D(uWear, vwUV).rgb;
    float vwD = length(vViewPosition);
    float vwNear = (1.0 - smoothstep(14.0, 38.0, vwD)) * uWearOn;
    #if __VERSION__ >= 300
      ${A.bump > 0 ? `normal = mix(normal, vwBump(-vViewPosition, normal, vw.b * 0.6 + vw.r * 0.4, ${f(A.bump * 0.012)}), vwNear);` : ''}
    #endif
    // zweite, dreimal gröbere Abfrage: breite Setzrisse und große Schmutzwolken, sichtbar bis etwa 70 m
    vec3 vwL = texture2D(uWear, vwUV * 0.34 + vec2(0.37, 0.61)).rgb;
    float vwMid = (1.0 - smoothstep(30.0, 70.0, vwD)) * uWearOn;
    ${A.crack > 0 ? `diffuseColor.rgb *= 1.0 - ${f(A.crack)} * max((1.0 - vw.r) * vwNear, (1.0 - vwL.r) * vwMid);` : ''}
    float vwG = clamp((vwL.g - 0.4) * 2.4 + (vw.g - 0.5) * 0.6, 0.0, 1.0) * ${f(A.grime)} * uWearOn;
    ${foot ? `vwG = max(vwG, (1.0 - smoothstep(0.0, ${f(A.foot)}, vVwP.y - ${f(ground)})) * (0.55 + 0.45 * vw.g) * uWearOn);` : ''}
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(${A.dirt.map(f).join(', ')}) * 1.6, vwG);
    roughnessFactor = mix(roughnessFactor, 0.92, vwG * 0.7);
    ${A.rust > 0 ? `float vwR = smoothstep(0.84, 0.93, vw.b) * ${f(A.rust)} * uWearOn;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.14, 0.06) * (0.7 + 0.6 * vw.g), vwR);
    metalnessFactor *= 1.0 - vwR; roughnessFactor = mix(roughnessFactor, 0.95, vwR);` : ''}
  }`);
}

// Grünspan: Farbe kommt ganz aus dem Shader (Materialfarbe weiß lassen oder hell); Koordinaten im Modell (Einheitskuppel/-dach)
export function patina(mat, o = {}) {
  if (!TEXTUREN || mat.userData.v115) return mat;
  mat.color.set(0xffffff); mat.metalness = 0.3; mat.roughness = 0.55;
  return hook(mat, 'patina' + (o.ribs ? 'R' : ''), vertexPart(true), `{
    float pa = atan(vVwP.z, vVwP.x);
    vec3 pw = texture2D(uWear, vec2((vVwP.x + vVwP.z) * 0.55 + 0.37, vVwP.y * 0.45)).rgb;
    vec3 pw2 = texture2D(uWear, vec2(pa * 0.9, vVwP.y * 0.3) + 0.5).rgb;
    float seam = smoothstep(0.988, 1.0, abs(cos(pa * 18.0))) * step(0.04, vVwP.y);
    float drip = smoothstep(0.47, 0.72, pw2.g);
    vec3 verd = mix(vec3(0.3, 0.6, 0.52), vec3(0.55, 0.85, 0.72), smoothstep(0.3, 0.75, pw.b + 0.25 * vVwP.y));
    vec3 col = mix(verd, vec3(0.1, 0.17, 0.16), drip * 0.75);
    float bare = smoothstep(0.86, 0.95, pw.b) * uWearOn;
    col = mix(col, vec3(0.42, 0.22, 0.1), bare);
    col *= 1.0 - 0.35 * seam;
    ${o.ribs ? `float rib = smoothstep(0.996, 1.0, abs(cos(pa * 4.0))) + smoothstep(0.012, 0.0, abs(vVwP.y - 0.55)) + smoothstep(0.015, 0.0, vVwP.y);
    rib = clamp(rib, 0.0, 1.0);
    col = mix(col, vec3(0.9, 0.66, 0.3), rib);
    totalEmissiveRadiance += vec3(0.1, 0.065, 0.025) * rib * uWearOn;` : 'float rib = 0.0;'}
    diffuseColor.rgb *= mix(vec3(0.24, 0.5, 0.45), col, uWearOn);
    metalnessFactor = mix(0.08, 0.85, max(bare, rib)); roughnessFactor = mix(0.62 + 0.2 * drip, 0.3, max(bare, rib));
    #if __VERSION__ >= 300
      normal = vwBump(-vViewPosition, normal, pw.b * 0.5 + seam * 0.5, 0.01);
    #endif
  }`);
}

// Textur laden und einhängen (aus assets.applyTextures, nach dem Manifest; einmal)
let geladen = false;
export function ladeVerwitterung(loadTexture) {
  if (!TEXTUREN || geladen) return; geladen = true;
  loadTexture('verwitterung').then(t => {
    t.encoding = T.LinearEncoding; t.wrapS = t.wrapT = T.RepeatWrapping;
    U.uWear.value = t; U.uWearOn.value = 1;
  }).catch(() => {});
}
