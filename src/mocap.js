/* =====================================================================
   V26 · MOTION CAPTURE: echte Bewegungen aus der CMU-Datenbank
   (mocap.cs.cmu.edu, BVH-Fassung von cgspeed, frei ohne Einschränkung).
   tools/make-mocap.mjs rechnet Gang (Herr, Dame), Laufen, drei Charleston-
   Aufnahmen, Sitzen und Warten in die Gelenkkanäle des Figuren-Shaders um
   (Becken, Oberkörper, Kopf, Fußziele, Arme); hier werden sie als Textur
   geladen (je Bild eine Spalte, 8 Texel zu je 4 Kanälen) und im Shader
   zwischen zwei Bildern gemischt. Die Füße gehen über die Bein-IK des
   Shaders, so passt die Aufnahme auf jede Körpergröße; beim Gehen wird die
   Schrittlänge so gestreckt, dass kein Fuß rutscht.
   Ohne die Daten (Ladefehler) bleiben die gebauten Bewegungen.
   ===================================================================== */
import { T } from './core.js';
import { resolveAsset, assetStats } from './assets.js';

export const MOCAP = { ready: false, clips: {}, w: 1, err: null, uTex: { value: null }, uOn: { value: 0 } };

export async function loadMocap() {
  try {
    const [meta, bin] = await Promise.all([
      fetch(resolveAsset('people/mocap.json')).then(r => { if (!r.ok) throw new Error('mocap.json HTTP ' + r.status); return r.json(); }),
      fetch(resolveAsset('people/mocap.bin')).then(r => { if (!r.ok) throw new Error('mocap.bin HTTP ' + r.status); return r.arrayBuffer(); }),
    ]);
    const src = new Int16Array(bin), W = meta.frames, C = meta.channels, s = 1 / meta.scale;
    if (src.length !== W * C) throw new Error('mocap.bin passt nicht zu mocap.json');
    // Spalte = Bild, Zeile k = Kanäle 4k..4k+3
    const data = new Uint16Array(W * 8 * 4);
    for (let f = 0; f < W; f++) for (let c = 0; c < 32; c++) data[((c >> 2) * W + f) * 4 + (c & 3)] = T.DataUtils.toHalfFloat(src[f * C + c] * s);
    const tex = new T.DataTexture(data, W, 8, T.RGBAFormat, T.HalfFloatType);
    tex.minFilter = tex.magFilter = T.LinearFilter; tex.wrapS = tex.wrapT = T.ClampToEdgeWrapping; tex.generateMipmaps = false; tex.needsUpdate = true;
    MOCAP.clips = meta.clips; MOCAP.w = W; MOCAP.ready = true;
    MOCAP.uTex.value = tex; MOCAP.uOn.value = 1;
    assetStats.textures++;
  } catch (e) { MOCAP.err = String(e && e.message || e); assetStats.errors.push('Mocap: ' + MOCAP.err); console.warn('Motion Capture nicht geladen, es bleiben die gebauten Bewegungen:', e); }
  return MOCAP.ready;
}

// GLSL: Clips als Konstanten (erstes Bild, Anzahl Abschnitte, Dauer in s), Abtasten, Spiegeln, auf die Figur legen
export function mocapGLSL() {
  const c = n => { const k = MOCAP.clips[n]; return k ? `vec3(${k.row.toFixed(1)}, ${(k.frames - 1).toFixed(1)}, ${k.sec.toFixed(3)})` : 'vec3(0.0, 1.0, 1.0)'; };
  return `
uniform sampler2D uMocap; uniform float uMocapOn;
const float MC_W = ${MOCAP.w.toFixed(1)};
const vec3 MC_WALKM = ${c('walkM')}, MC_WALKF = ${c('walkF')}, MC_RUN = ${c('run')}, MC_CH1 = ${c('charl1')}, MC_CH2 = ${c('charl2')}, MC_CH3 = ${c('charl3')}, MC_SIT = ${c('sit')}, MC_IDLE = ${c('idle')};
vec4 mcC0, mcC1, mcC2, mcC3, mcC4, mcC5, mcC6, mcC7;
// t: Anteil am Clip (0..1, wiederholt); mir: links und rechts tauschen
void mcSample(vec3 clip, float t, float mir) {
  float u = (clip.x + fract(t) * clip.y + 0.5) / MC_W;
  mcC0 = texture2D(uMocap, vec2(u, 0.0625)); mcC1 = texture2D(uMocap, vec2(u, 0.1875)); mcC2 = texture2D(uMocap, vec2(u, 0.3125)); mcC3 = texture2D(uMocap, vec2(u, 0.4375));
  mcC4 = texture2D(uMocap, vec2(u, 0.5625)); mcC5 = texture2D(uMocap, vec2(u, 0.6875)); mcC6 = texture2D(uMocap, vec2(u, 0.8125)); mcC7 = texture2D(uMocap, vec2(u, 0.9375));
  if (mir > 0.5) {
    vec4 r = mcC3; mcC3 = vec4(-mcC4.x, mcC4.yzw); mcC4 = vec4(-r.x, r.yzw);
    r = mcC5; mcC5 = mcC6; mcC6 = r; mcC7.xy = mcC7.yx;
    mcC0.x = -mcC0.x; mcC1 *= vec4(-1.0, -1.0, 1.0, -1.0); mcC2 *= vec4(-1.0, 1.0, -1.0, -1.0);
  }
}
#ifdef HUM_PLAYER
// V37: Alexanders Übergang Gehen <-> Stehen <-> Laufen. Statt die ganze Haltung zweimal zu rechnen (zu groß für den
// Windows-Treiber) wird nur die vorige Aufnahme ein zweites Mal gelesen (mcPrev, einmal je Bild) und hier in den
// Kanälen überblendet, bevor Becken, Beine und Arme daraus gesetzt werden. pLz: Länge für z der vorigen (< 0 = Beinlänge)
vec4 pC0, pC1, pC2, pC3, pC4, pC5, pC6, pC7; float pW, pLz;
void mcPrev(vec3 clip, float t, float mir, float lz) {
  mcSample(clip, t, mir); pC0 = mcC0; pC1 = mcC1; pC2 = mcC2; pC3 = mcC3; pC4 = mcC4; pC5 = mcC5; pC6 = mcC6; pC7 = mcC7; pLz = lz;
}
#endif
// ganze Aufnahme auf die Figur: Lz = Länge für z (Schrittlänge beim Gehen, sonst Beinlänge)
void mcApply(float Lz, float fem, float useZ) {
  float ank = mix(mix(0.09, 0.1, fem), rAnk, hMH), Lg = hHip - ank; Lz = useZ > 0.5 ? Lz : Lg;
#ifdef HUM_PLAYER
  if (pW > 0.001) {
    float r = (pLz < 0.0 ? Lg : pLz) / Lz;
    mcC0 = mix(mcC0, vec4(pC0.xy, pC0.z * r, pC0.w), pW); mcC1 = mix(mcC1, pC1, pW); mcC2 = mix(mcC2, pC2, pW);
    mcC3 = mix(mcC3, vec4(pC3.xy, pC3.z * r, pC3.w), pW); mcC4 = mix(mcC4, vec4(pC4.xy, pC4.z * r, pC4.w), pW);
    mcC5 = mix(mcC5, pC5, pW); mcC6 = mix(mcC6, pC6, pW); mcC7 = mix(mcC7, pC7, pW); pW = 0.0;
  }
#endif
  pvO = vec3(mcC0.x * Lg, mcC0.y * Lg + ank - hHip, mcC0.z * Lz); pvP = mcC0.w; pvR = mcC1.x; pvY = mcC1.y;
  spP = mcC1.z; spR = mcC1.w; spY = mcC2.x; nkP = mcC2.y; nkR = mcC2.z; nkY = mcC2.w;
  vec3 FR = vec3(mcC3.x * Lg, ank + mcC3.y * Lg, mcC3.z * Lz), FL = vec3(mcC4.x * Lg, ank + mcC4.y * Lg, mcC4.z * Lz);
  legsTo(FR, FL);
  anF = vec2(mcC3.w + knF.x - thP.x + pvP, mcC4.w + knF.y - thP.y + pvP);
  uaP = vec2(mcC5.x, mcC6.x); uaA = vec2(mcC5.y, mcC6.y); uaT = vec2(mcC5.z, mcC6.z); elF = vec2(mcC5.w, mcC6.w); wrF = clamp(mcC7.xy, -0.6, 0.6);
}
`;
}
