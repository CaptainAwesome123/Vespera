import { U, T, MOBILE, renderer, scene, camera, FOG_GLSL } from './core.js';
import { addCollider } from './people-skeleton.js';
import { lamps, addSeg, addGlow, NEON } from './facade-shader.js';
import { ISL, landDist, QX, QUAY } from './island.js';
import { neonFrame } from './entrances.js';
import { interiorCrowd } from './belmont.js';
import { WATER_Y } from './dance.js';
import { VILLA } from './harbour.js';
import { pedCrowd, STREET } from './serpentine.js';
import { fxEmit } from './particles.js';
import { WIND } from './wind.js';

/* =====================================================================
   V16 · WASSER: echte Wellen (Gerstner) statt nur gemalter Normalen. Die Wellen
   hängen vom Wind ab, ein feines Netz folgt der Kamera, Schaumkronen bei Böen;
   dieselben Wellen auf der CPU für Auftrieb: Boote heben, nicken und rollen
   ===================================================================== */
// V27: acht Wellenzüge statt sechs, dazu eine lange Dünung aus dem Fjord und kurzes Gekräusel; insgesamt etwa 50 % höher
export const GW = { n: 8, L: [58, 34, 21, 13.5, 8.6, 5.4, 3.3, 2.1], A0: [0.3, 0.26, 0.17, 0.1, 0.06, 0.035, 0.02, 0.01], da: [0.2, 0, 0.55, -0.45, 0.95, -0.8, 0.3, -1.2], m: 1, list: [] };
U.uGW = { value: [0, 1, 2, 3, 4, 5, 6, 7].map(() => new T.Vector4()) };
U.uGWQ = { value: 0.55 };
export function updateWaves(dt) {
  // Wellenhöhe folgt dem Wind (träge: das Meer braucht Zeit)
  const tgt = Math.min(1.4, 0.45 + WIND.s / 7 + WIND.gust * 0.25);
  GW.m += (tgt - GW.m) * Math.min(1, dt * 0.15);
  GW.list.length = 0;
  for (let i = 0; i < GW.n; i++) {
    const a = WIND.a + GW.da[i], k = 2 * Math.PI / GW.L[i], A = GW.A0[i] * GW.m * (i < 3 ? 1 : 0.8 + 0.4 * Math.min(1, WIND.s / 6));
    U.uGW.value[i].set(Math.cos(a), Math.sin(a), A, k);
    GW.list.push([Math.cos(a), Math.sin(a), A, k, Math.sqrt(9.81 * k), i * 1.7]);
  }
  shoreSpray(dt);
}
// V27: Wellen schlagen an Kai und Ufermauern hoch: in Kameranähe Gischt, wo ein Wellenkamm die Mauer trifft
export const SPRAY = { t: 0 };
export function shoreSpray(dt) {
  if ((SPRAY.t -= dt) > 0) return;
  SPRAY.t = MOBILE ? 0.35 : 0.18;
  const cp = camera.position; if (cp.y > 80) return;
  for (let k = 0; k < 3; k++) {
    const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 70, x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r;
    const d = landDist(x, z); if (d > 0 || d < -2.5) continue;
    const h = waterH(x, z);
    if (h < 0.18 * GW.m) continue;
    const s = Math.min(1.6, h / 0.3);
    fxEmit('spray', x, WATER_Y + 0.2 + h, z, 0, 2.2 * s, 0, Math.round(6 + 10 * s), 1.1 * s, 0.8 + 0.4 * s);
  }
}
// Wasserhöhe über WATER_Y an einem Punkt (mit einem Rückrechnungsschritt für die waagrechte Verschiebung)
export function waterH(x, z, t = U.uTime.value) {
  const Q = U.uGWQ.value;
  let px = x, pz = z;
  for (let it = 0; it < 2; it++) {
    let ox = 0, oz = 0;
    for (const [dx, dz, A, k, w, ph] of GW.list) { const c = Math.cos(k * (dx * px + dz * pz) - w * t + ph) * Q * A; ox += dx * c; oz += dz * c; }
    px = x - ox; pz = z - oz;
  }
  let h = 0;
  for (const [dx, dz, A, k, w, ph] of GW.list) h += A * Math.sin(k * (dx * px + dz * pz) - w * t + ph);
  return h;
}
// Netz: Ringe um die Kamera, innen fein, außen grob (bis zum Horizont)
export function waterGridGeo() {
  const NR = MOBILE ? 100 : 150, NS = MOBILE ? 96 : 176, b = MOBILE ? 0.055 : 0.038, a = 4600 / (Math.exp(b * NR) - 1);
  const pos = new Float32Array(((NR + 1) * NS + 1) * 3), idx = [];
  let o = 3;
  for (let r = 1; r <= NR; r++) {
    const rad = a * (Math.exp(b * r) - 1);
    for (let s = 0; s < NS; s++) { const t = s / NS * Math.PI * 2; pos[o++] = Math.cos(t) * rad; pos[o++] = 0; pos[o++] = Math.sin(t) * rad; }
  }
  const V = (r, s) => r === 0 ? 0 : 1 + (r - 1) * NS + (s % NS);
  for (let s = 0; s < NS; s++) idx.push(0, V(1, s + 1), V(1, s));
  for (let r = 1; r < NR; r++) for (let s = 0; s < NS; s++) { const a0 = V(r, s), a1 = V(r, s + 1), b0 = V(r + 1, s), b1 = V(r + 1, s + 1); idx.push(a0, a1, b1, a0, b1, b0); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos.subarray(0, o), 3)); g.setIndex(idx);
  return g;
}
export const WATER_VERT = `uniform float uTime; uniform vec4 uGW[8]; uniform float uGWQ; uniform vec3 uCam;
  varying vec3 vW; varying float vD; varying vec2 vGG; varying float vJ; varying float vH;
  void main(){
    vec4 w = modelMatrix * vec4(position, 1.0);
    float fade = 1.0 - smoothstep(260.0, 900.0, length(w.xz - uCam.xz));
    vec3 off = vec3(0.0); vec2 gg = vec2(0.0); float jac = 0.0;
    for (int i = 0; i < 8; i++) {
      vec4 G = uGW[i]; vec2 d = G.xy; float A = G.z * fade, k = G.w, om = sqrt(9.81 * k);
      float th = k * dot(d, w.xz) - om * uTime + float(i) * 1.7, c = cos(th), s = sin(th);
      off.xz += d * (uGWQ * A * c); off.y += A * s;
      gg += d * (k * A * c); jac += uGWQ * k * A * s;
    }
    w.xyz += off; vW = w.xyz; vGG = gg; vJ = jac; vH = off.y;
    vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv;
  }`;
// Schwimmlage eines Bootes aus vier Messpunkten: Hub, Stampfen, Rollen
export function floatPose(x, z, h, L, B, t) {
  const fx = Math.cos(h), fz = -Math.sin(h), lx = -Math.sin(h), lz = -Math.cos(h), hl = L * 0.36, hb = B * 0.4;
  const f = waterH(x + fx * hl, z + fz * hl, t), r = waterH(x - fx * hl, z - fz * hl, t), p = waterH(x + lx * hb, z + lz * hb, t), s = waterH(x - lx * hb, z - lz * hb, t);
  return { y: (f + r + p + s) / 4, pitch: Math.atan2(f - r, hl * 2), roll: Math.atan2(s - p, hb * 2) };
}
// verankerte Boote schaukeln auf den echten Wellen (große Schiffe träger)
export function bobVessel(v, t) {
  const g = v.g, P = floatPose(g.position.x, g.position.z, g.rotation.y, v.L, v.B, t);
  const k = v.L > 20 ? 0.35 : v.L > 11 ? 0.7 : 1;
  v.fy = (v.fy ?? P.y) + (P.y - (v.fy ?? P.y)) * 0.25;
  g.position.y = WATER_Y + v.fy * k;
  v.body.rotation.z = (v.body.rotation.z * 0.8 + P.pitch * k * 0.2);
  v.body.rotation.x = (v.body.rotation.x * 0.8 + P.roll * k * 0.2);
}
// Spritzer, wenn etwas ins Wasser fällt (Wagen, Anker ...)
export function waterSplash(x, z, s = 1) { fxEmit('spray', x, WATER_Y + 0.2, z, 0, 3 * s, 0, Math.round(20 * s), 1.5 * s, s); }
// Uferabstand im Shader (gleiche Form wie coastR/landDist)
export const LAND_GLSL = () => `
  float coastRG(float th){
    float c = sin(th), s = -cos(th), b = s < 0.0 ? ${ISL.bn.toFixed(1)} : ${ISL.bs.toFixed(1)};
    float r = 1.0 / pow(pow(abs(c) / ${ISL.a.toFixed(1)}, ${ISL.n.toFixed(2)}) + pow(abs(s) / b, ${ISL.n.toFixed(2)}), ${(1 / ISL.n).toFixed(5)});
    float k = 1.0 - exp(-pow(th / 0.55, 2.0));
    float nz = 0.034 * sin(3.0 * th + 0.7) + 0.024 * sin(5.0 * th + 2.1) + 0.017 * sin(8.0 * th + 4.0) + 0.009 * sin(13.0 * th + 1.3);
    return r * (1.0 + nz * k);
  }
  float landDistG(vec2 p){ vec2 d = p - vec2(${ISL.cx.toFixed(1)}, ${ISL.cz.toFixed(1)}); float th = atan(d.x, -d.y); return min(coastRG(th) - length(d), ${ISL.quay.toFixed(1)} - p.y); }`;

/* ---------- Wasser: Hafenbecken mit Wellen, Mondglitzern, Spiegelungen der Lichter; Pools und Brunnen ---------- */
export const WATER_COMMON = `${FOG_GLSL}
  uniform float uAurora; uniform float uMoonLit; uniform float uRain; uniform float uMist;
  float wH(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float wN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(wH(i), wH(i + vec2(1, 0)), f.x), mix(wH(i + vec2(0, 1)), wH(i + vec2(1, 1)), f.x), f.y); }
  // Wellen: mehrere Richtungen und Längen, dazu feines Gekräusel aus Rauschen
  vec2 waveGrad(vec2 p, float t, float scale){
    vec2 g = vec2(0.0);
    for (int i = 0; i < 6; i++) {
      float fi = float(i), a = fi * 2.399 + 0.3, f = (0.08 + fi * fi * 0.06) * scale, sp = sqrt(9.81 * f) * 0.9, amp = 0.55 / (1.0 + fi * 1.4);
      vec2 d = vec2(cos(a), sin(a));
      g += d * f * amp * cos(dot(d, p) * f + t * sp + fi * 1.7);
    }
    vec2 q = p * 0.9 * scale + vec2(t * 0.4, t * 0.25);
    float e = 0.15, n0 = wN(q);
    g += vec2(wN(q + vec2(e, 0.0)) - n0, wN(q + vec2(0.0, e)) - n0) / e * 0.18;
    return g;
  }
  vec3 skyRefl(vec3 R, vec3 fogC, vec3 moonD){
    vec3 c = mix(fogC * 1.8, vec3(0.012, 0.03, 0.06), smoothstep(0.0, 0.45, R.y));
    float md = max(dot(R, moonD), 0.0);
    c += (vec3(1.2, 1.15, 1.0) * pow(md, 900.0) * 6.0 + vec3(0.5, 0.55, 0.6) * pow(md, 40.0) * 0.25) * uMoonLit;
    // V25: das Polarlicht spiegelt sich als grün-türkiser Schimmer
    c += vec3(0.05, 0.42, 0.26) * uAurora * smoothstep(0.08, 0.35, R.y) * (1.0 - smoothstep(0.5, 0.9, R.y)) * 0.35;
    return c;
  }`;
// Echte Spiegelung (am PC): die Szene wird an der Wasserfläche gespiegelt in ein halb so großes Bild gerendert;
// das Wasser verzerrt es mit seinen Wellen. Auf Handys bleibt die gemalte Spiegelung.
export const REFL = { rt: null, cam: new T.PerspectiveCamera(), on: !MOBILE };
U.uRefl = { value: null }; U.uReflMat = { value: new T.Matrix4() }; U.uReflOn = { value: 0 };
U.uWakeL = { value: [27, 8.4, 8.4, 8.4] };
export const _rv = { n: new T.Vector3(0, 1, 0), rp: new T.Vector3(), cp: new T.Vector3(), view: new T.Vector3(), look: new T.Vector3(), tgt: new T.Vector3(), rot: new T.Matrix4(), plane: new T.Plane(), clip: new T.Vector4(), q: new T.Vector4() };
export function setupReflection() {
  if (!REFL.on) return;
  const sz = renderer.getDrawingBufferSize(new T.Vector2());
  REFL.rt = new T.WebGLRenderTarget(Math.max(2, Math.round(sz.x * 0.5)), Math.max(2, Math.round(sz.y * 0.5)), { type: T.HalfFloatType });
  REFL.rt.texture.generateMipmaps = false;
  U.uRefl.value = REFL.rt.texture;
  REFL.dummy = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); REFL.dummy.needsUpdate = true;
  REFL.cam.layers.set(1);
  // Was sich spiegeln soll: alles außer Kleinkram (Figuren, Autos, Möbel, Partikel); Wasser selbst nie
  const skip = REFL.skip = new Set();
  for (const c of [pedCrowd, interiorCrowd, VILLA.crowd]) if (c) for (const k in c.hi) { skip.add(c.hi[k].im); skip.add(c.lo[k].im); }
  scene.traverse(o => { if (!skip.has(o) && o !== harborWater && !o.userData.noRefl) o.layers.enable(1); });
}
// V25: Laternen und Stadtmobiliar kommen später als Chunks dazu: alle paar Sekunden ins Spiegelbild aufnehmen (Ladeneinrichtung nicht, die sieht man draußen kaum)
export const REFL_LAYERS = new Set(['lamps', 'furniture', 'props']);
export function reflSweep() {
  if (!REFL.rt) return;
  for (const o of scene.children) if (o.isGroup && !o.userData.reflSeen && REFL_LAYERS.has(o.userData.chunk?.layer)) {
    let n = 0; o.traverse(c => { n++; if (!REFL.skip.has(c) && !c.userData.noRefl) c.layers.enable(1); });
    if (n > 1) o.userData.reflSeen = true;
  }
}
export function resizeReflection() {
  if (!REFL.rt) return;
  const sz = renderer.getDrawingBufferSize(new T.Vector2());
  REFL.rt.setSize(Math.max(2, Math.round(sz.x * 0.5)), Math.max(2, Math.round(sz.y * 0.5)));
}
export function renderReflection() {
  if (!REFL.rt || REFL.off) { U.uReflOn.value = 0; U.uStreetRefl.value = 0; return; }
  const cam = camera, vc = REFL.cam, V = _rv, cp = cam.position;
  // nur wenn das Hafenbecken überhaupt zu sehen sein kann
  const see = cp.y > WATER_Y + 0.2 && (cp.z > 300 || cp.y > 90 || landDist(cp.x, cp.z) < 170 || Math.hypot(cp.x - VILLA.x, cp.z - VILLA.z) < 400) && U.uInside.value < 0.5;
  // V25: sonst, wenn die Straßen nass sind und man unten in der Stadt steht, spiegelt sich die Stadt im Pflaster (Ebene auf Straßenhöhe)
  const street = !see && U.uWet.value > 0.2 && U.uSnowCover.value < 0.8 && cp.y > 0.3 && cp.y < 60 && U.uInside.value < 0.5 && landDist(cp.x, cp.z) > 0;
  U.uReflOn.value = see ? 1 : 0; U.uStreetRefl.value = street ? 1 : 0;
  if (!see && !street) return;
  const PY = see ? WATER_Y : 0;
  cam.updateMatrixWorld();
  V.rp.set(cp.x, PY, cp.z); V.cp.copy(cp);
  V.view.subVectors(V.rp, V.cp).reflect(V.n).negate().add(V.rp);
  V.rot.extractRotation(cam.matrixWorld);
  V.look.set(0, 0, -1).applyMatrix4(V.rot).add(V.cp);
  V.tgt.subVectors(V.rp, V.look).reflect(V.n).negate().add(V.rp);
  vc.position.copy(V.view); vc.up.set(0, 1, 0).applyMatrix4(V.rot).reflect(V.n); vc.lookAt(V.tgt);
  vc.far = cam.far; vc.near = cam.near; vc.updateMatrixWorld(); vc.projectionMatrix.copy(cam.projectionMatrix);
  U.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
  // schräge Nahebene: nichts unter der Wasserlinie darf ins Spiegelbild
  V.plane.setFromNormalAndCoplanarPoint(V.n, V.rp).applyMatrix4(vc.matrixWorldInverse);
  V.clip.set(V.plane.normal.x, V.plane.normal.y, V.plane.normal.z, V.plane.constant);
  const e = vc.projectionMatrix.elements;
  V.q.set((Math.sign(V.clip.x) + e[8]) / e[0], (Math.sign(V.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
  V.clip.multiplyScalar(2 / V.clip.dot(V.q));
  e[2] = V.clip.x; e[6] = V.clip.y; e[10] = V.clip.z + 1 - 0.003; e[14] = V.clip.w;
  vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();
  harborWater.visible = false; if (street && STREET.ground) STREET.ground.visible = false;
  const prev = renderer.getRenderTarget();
  // das Spiegelbild darf sich beim Zeichnen nicht selbst lesen (Gehwege und Pfützen tasten uRefl ab)
  U.uRefl.value = REFL.dummy;
  renderer.setRenderTarget(REFL.rt); renderer.clear(); renderer.render(scene, vc);
  renderer.setRenderTarget(prev);
  U.uRefl.value = REFL.rt.texture;
  harborWater.visible = true; if (STREET.ground) STREET.ground.visible = true;
}
export let harborWater = null;
export function buildHarborWaterMat() {
  return new T.ShaderMaterial({
    uniforms: U,
    vertexShader: WATER_VERT,
    fragmentShader: `uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir; uniform vec3 uCam; uniform vec3 uTeal;
      uniform sampler2D uRefl; uniform mat4 uReflMat; uniform float uReflOn; uniform vec4 uWake[4]; uniform float uWakeL[4]; uniform vec4 uWind;
      varying vec3 vW; varying float vD; varying vec2 vGG; varying float vJ; varying float vH;
      ${WATER_COMMON}
      ${LAND_GLSL()}
      // Feines Gekräusel: zwei Lagen Rauschen, die gegeneinander laufen
      vec2 ripple(vec2 p, float t){
        float e = 0.08;
        vec2 q1 = p * 2.3 + vec2(t * 0.55, t * 0.31), q2 = p * 3.7 - vec2(t * 0.42, -t * 0.5);
        float a = wN(q1), b = wN(q2);
        return vec2(wN(q1 + vec2(e, 0.0)) - a + wN(q2 + vec2(e, 0.0)) - b, wN(q1 + vec2(0.0, e)) - a + wN(q2 + vec2(0.0, e)) - b) / e;
      }
      void main(){
        vec2 p = vW.xz;
        float far = smoothstep(120.0, 1400.0, vD), aa = clamp(1.0 - fwidth(p.x) * 0.9, 0.0, 1.0);
        vec2 g = waveGrad(p, uTime, 1.0) * mix(0.5 + uWind.z * 0.05, 0.35, far) + vGG / 0.35;
        g += ripple(p, uTime) * 0.05 * aa;
        // V25: Regentropfen ziehen kleine Ringe
        if (uRain > 0.01 && vD < 90.0) for (int k = 0; k < 2; k++) {
          vec2 rp = p * (k == 0 ? 1.3 : 2.1) + float(k) * 17.0, rc = floor(rp), rf = fract(rp) - 0.5;
          float h0 = fract(sin(dot(rc, vec2(12.9898, 78.233))) * 43758.5453), age = fract(uTime * 1.3 + h0 * 7.0);
          vec2 ro = rf - (vec2(fract(h0 * 13.0), fract(h0 * 29.0)) - 0.5) * 0.5; float rr = length(ro);
          float ring = sin((rr - age * 0.45) * 60.0) * smoothstep(0.06, 0.0, abs(rr - age * 0.45)) * (1.0 - age) * step(h0, uRain);
          g += ro / max(rr, 0.01) * ring * 0.9 * (1.0 - smoothstep(30.0, 90.0, vD));
        }
        // Bugwellen und Kielwasser: V-förmige Kelvin-Wellen, verquirltes Wasser hinter der Schraube, Schaum am Rumpf
        float foamW = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 w = uWake[i]; float sp = w.w; if (sp < 0.3) continue;
          vec2 dir = vec2(cos(w.z), sin(w.z)), d = p - w.xy; float along = dot(d, dir), lat = dot(d, vec2(-dir.y, dir.x));
          float Lh = uWakeL[i] * 0.5, B = uWakeL[i] * 0.14, behind = -along - Lh * 0.8;
          float k = clamp(sp / 7.0, 0.0, 1.0);
          if (behind > 0.0 && behind < 400.0) {
            float edge = abs(abs(lat) - (B + behind * 0.354)), fade = exp(-behind / (90.0 + uWakeL[i] * 4.0)) * k;
            float arm = exp(-edge * edge / (0.6 + behind * 0.06)) * fade;
            float wash = exp(-lat * lat / (B * B * 0.6 + behind * 0.25)) * exp(-behind / (25.0 + uWakeL[i] * 2.0)) * k;
            float cross = sin(behind * 1.1 - uTime * 2.4) * step(abs(lat), B + behind * 0.354) * fade;
            g += vec2(-dir.y, dir.x) * sign(lat) * arm * 1.2 + dir * cross * 0.35;
            foamW += arm * 0.8 * smoothstep(0.35, 0.75, wN(p * 0.9 + uTime * 0.3)) + wash * (0.55 + 0.45 * wN(p * 1.7 - dir * uTime * 2.0));
          }
          float hull = (abs(along) < Lh + 2.0) ? exp(-pow(max(abs(lat) - B * (1.0 - pow(max(along, 0.0) / Lh, 2.0) * 0.8), 0.0), 2.0) / 1.2) * smoothstep(Lh + 2.0, Lh * 0.5, abs(along)) : 0.0;
          foamW += hull * k * (0.5 + 0.5 * wN(p * 2.0 + uTime));
        }
        vec3 N = normalize(vec3(-g.x * 0.35, 1.0, -g.y * 0.35));
        vec3 V = normalize(uCam - vW);
        float ndv = max(dot(N, V), 0.0), fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 Rv = reflect(-V, N);
        // Tiefe: dunkles Petrol, an Wellenkämmen schimmert das türkise Licht der Stadt hindurch
        vec3 deep = vec3(0.004, 0.018, 0.026) * (1.0 + 0.4 * wN(p * 0.04));
        float crest = clamp(dot(g, normalize(uCam.xz - p + 0.001)) * 0.6, 0.0, 1.0);
        deep += uTeal * 0.035 * crest * (1.0 - far);
        vec3 sky = skyRefl(Rv, uFogColor, uMoonDir);
        vec3 refl = sky;
        if (uReflOn > 0.5) {
          vec4 rc = uReflMat * vec4(vW.x, ${WATER_Y.toFixed(2)}, vW.z, 1.0);
          vec2 ruv = rc.xy / rc.w + N.xz * mix(0.05, 0.012, far) * vec2(1.0, 1.6);
          vec3 sc = texture2D(uRefl, clamp(ruv, 0.002, 0.998)).rgb;
          // Lichter im Spiegelbild ziehen sich zu Lichtsäulen und zittern
          vec3 sc2 = texture2D(uRefl, clamp(ruv + vec2(0.0, 0.012 + 0.01 * g.y), 0.002, 0.998)).rgb, sc3 = texture2D(uRefl, clamp(ruv - vec2(0.0, 0.01), 0.002, 0.998)).rgb;
          sc = (sc * 2.0 + sc2 + sc3) * 0.25;
          refl = mix(sky, sc, 0.92) + sky * pow(max(dot(Rv, uMoonDir), 0.0), 900.0) * 2.0;
        }
        vec3 col = mix(deep, refl, clamp(fres * 1.15, 0.0, 1.0));
        // Abstand zum Ufer der Stadtinsel (Kai im Süden, Ufermauern ringsum)
        float dz = max(0.0, -landDistG(vW.xz));
        if (uReflOn < 0.5) {
          // gemalte Spiegelungen, wenn keine echte da ist: Laternen am Kai, das Belmont, Neon
          float LZ = 533.5, cz = min(uCam.z, LZ - 1.0);
          float t0 = (LZ - cz) / max(vW.z - cz, 0.01);
          float xs = uCam.x + (vW.x - uCam.x) * t0 + g.x * 1.5;
          float cell = floor(xs / 18.0 + 0.5) * 18.0, lat = (xs - cell) / max(t0, 0.02);
          float beyond = max(vW.z - LZ, 0.0);
          float wob = 0.55 + 0.45 * wN(vec2(vW.x * 0.4, vW.z * 1.2 - uTime * 2.2));
          col += vec3(1.0, 0.66, 0.3) * exp(-lat * lat / (0.12 + beyond * 0.012)) * exp(-beyond / 28.0) * wob * smoothstep(533.0, 520.0, uCam.z) * 0.7;
          float bel = exp(-pow(vW.x + g.x * 10.0, 2.0) / (180.0 + dz * 0.4)) * exp(-dz / 900.0);
          col += vec3(1.0, 0.72, 0.35) * bel * 0.6 * (0.1 + 0.9 * smoothstep(0.45, 0.8, wN(vec2(vW.x * 0.2, vW.z * 0.6 - uTime * 1.5))));
          col += uTeal * 0.25 * smoothstep(0.55, 0.85, wN(vec2(vW.x * 0.05 + g.x, vW.z * 0.4 - uTime * 0.6))) * exp(-dz / 250.0) * (0.5 + 0.5 * sin(vW.x * 0.06));
        }
        // V27: Licht scheint durch die dünnen Wellenkämme (türkis von der Stadt, warm am Kai)
        float crestH = smoothstep(0.12, 0.6, vH) * (1.0 - far);
        col += (uTeal * 0.07 + vec3(0.05, 0.035, 0.015) * exp(-dz / 60.0)) * crestH * (0.4 + 0.6 * pow(1.0 - ndv, 2.0));
        // Brandung: Schaumlinien laufen auf Kai und Ufer zu und brechen dort
        float surf = smoothstep(14.0, 0.0, dz) * smoothstep(0.55, 0.95, sin(dz * 0.9 + uTime * 1.6 + wN(p * 0.15) * 4.0)) * smoothstep(0.4, 0.75, wN(p * vec2(0.35, 0.9) + uTime * 0.2));
        // Schaumstreifen in Windrichtung, bei Wind deutlicher
        vec2 wd = normalize(uWind.xy + 1e-4);
        float streaks = smoothstep(0.62, 0.9, wN(vec2(dot(p, wd) * 0.05, dot(p, vec2(-wd.y, wd.x)) * 0.6) + uTime * 0.03)) * smoothstep(4.0, 9.0, uWind.z + uWind.w * 5.0) * (1.0 - far) * 0.35;
        // Mondglanz auf den Wellen
        col += vec3(0.9, 0.95, 1.0) * pow(max(dot(Rv, uMoonDir), 0.0), 260.0) * 0.8 * (1.0 - far);
        // Schaum an der Kaimauer und im Kielwasser
        float foam = smoothstep(3.5, 0.0, dz) * smoothstep(0.45, 0.8, wN(p * vec2(0.6, 2.0) + vec2(uTime * 0.3, 0.0)) + 0.3 * sin(uTime * 1.3 + vW.x * 0.2));
        foam += clamp(foamW, 0.0, 1.0) * (0.6 + 0.4 * wN(p * 6.0 + uTime * 0.5)) * aa;
        // Schaumkronen auf den Wellenkämmen, wenn der Wind auffrischt
        foam += smoothstep(0.05, 0.13, vJ) * smoothstep(3.5, 8.0, uWind.z + uWind.w * 5.0) * smoothstep(0.5, 0.8, wN(p * 1.3 + uTime * 0.2)) * (1.0 - far) * 0.8;
        foam += surf * 0.7 * aa + streaks;
        col = mix(col, vec3(0.32, 0.38, 0.4), clamp(foam, 0.0, 1.0) * 0.55);
        float fogF = vespFog(vD, vW.y, uCam.y, uFogDensity * (1.0 + 0.5 * uMist), 0.8);
        gl_FragColor = vec4(mix(col, uFogColor * 1.25, fogF), 1.0);
      }`,
  });
}
// Pool- und Brunnenwasser: von unten beleuchtet, Lichtnetz (Kaustik) am Grund, kleine Wellen und Spiegelung
export function poolWaterMat(tint = [0.05, 0.42, 0.45]) {
  return new T.ShaderMaterial({
    uniforms: { ...U, uTint: { value: new T.Vector3(...tint) } },
    vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz; vec4 mv=viewMatrix*w; vD=length(mv.xyz); gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir; uniform vec3 uCam; uniform vec3 uTint; varying vec3 vW; varying float vD;
      ${WATER_COMMON}
      void main(){
        vec2 p = vW.xz;
        vec2 g = waveGrad(p * 3.0, uTime * 1.3, 1.0) * 0.4;
        vec3 N = normalize(vec3(-g.x * 0.25, 1.0, -g.y * 0.25));
        vec3 V = normalize(uCam - vW);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // Kaustik: zwei verschobene Rauschschichten, deren Kanten hell aufleuchten
        vec2 q = p * 1.6 + g * 0.6;
        float c1 = abs(wN(q + uTime * 0.35) - 0.5), c2 = abs(wN(q * 1.7 - uTime * 0.27 + 3.0) - 0.5);
        float caus = pow(1.0 - min(c1, c2) * 2.0, 8.0);
        vec3 col = uTint * (0.55 + 0.6 * caus) + vec3(0.6, 0.9, 0.9) * caus * 0.25;
        col = mix(col, skyRefl(reflect(-V, N), uFogColor, uMoonDir) * 1.5, fres * 0.8);
        float fogF = vespFog(vD, vW.y, uCam.y, uFogDensity, 0.8);
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`,
  });
}
// Wasserfontäne: aufsteigende Säule und fallender Schirm, durchscheinend und laufend
export function fountainJet(x, y, z, h, r, tint = [0.6, 0.85, 0.9]) {
  const mat = new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uTint: { value: new T.Vector3(...tint) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; uniform vec3 uTint; varying vec2 vUv;
      float h1(float x){ return fract(sin(x * 91.3) * 437.5); }
      void main(){
        float col = floor(vUv.x * 40.0), s = fract(vUv.y * 3.0 - uTime * (1.6 + h1(col)) + h1(col + 7.0));
        float streak = smoothstep(0.0, 0.2, s) * smoothstep(1.0, 0.6, s) * (0.4 + 0.6 * h1(col + 3.0));
        float a = streak * (0.35 + 0.4 * (1.0 - vUv.y));
        gl_FragColor = vec4(uTint * a * 0.6, 1.0);
      }`,
  });
  const g = new T.Group();
  const col = new T.Mesh(new T.CylinderGeometry(r * 0.25, r * 0.4, h, 12, 1, true).translate(0, h / 2, 0), mat); g.add(col);
  // Schirm: Parabel von der Spitze nach außen und unten
  const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new T.Vector2(r * 0.3 + t * r * 2.6, h - t * t * h * 0.85)); }
  const um = new T.Mesh(new T.LatheGeometry(pts, 24), mat); g.add(um);
  g.position.set(x, y, z); scene.add(g);
  return g;
}

export let waterMat;
export function buildHarbor() {
  addCollider(QX[0], 0, QUAY.z0, QX[1], 0.25, QUAY.z1);
  const quay = new T.Mesh(new T.BoxGeometry(QX[1] - QX[0], 3.88, QUAY.z1 - QUAY.z0), new T.MeshStandardMaterial({ color: 0x1f2a30, roughness: 0.9 }));
  quay.position.set((QX[0] + QX[1]) / 2, -1.81, (QUAY.z0 + QUAY.z1) / 2); scene.add(quay);
  for (let x = QX[0] + 8; x <= QX[1] - 8; x += 18) lamps.push({ x, z: QUAY.z1 - 1.5, h: 5 });
  for (let x = QX[0] + 12; x <= QX[1] - 12; x += 24) lamps.push({ x, z: QUAY.z0 + 1, h: 4.8 });
  waterMat = buildHarborWaterMat();
  // ein einziger See rund um die Stadtinsel bis an die Berge
  const water = harborWater = new T.Mesh(waterGridGeo(), waterMat);
  water.position.set(0, WATER_Y, 0); water.frustumCulled = false; scene.add(water);
  // Leuchtturm auf der Mole
  addSeg({ x: 340, z: 720, w: 9, d: 9, y0: WATER_Y, y1: 46, tint: [0.88, 0.8, 0.7], seed: 900, style: 1, dens: 0.4, flood: 0.8 });
  addSeg({ x: 340, z: 720, w: 26, d: 26, y0: WATER_Y - 1, y1: 1, tint: [0.3, 0.27, 0.3], seed: 901, style: 0, dens: 0, flood: 0.4 });
  addGlow(340, 49, 720, NEON.pearl, 16);
  neonFrame(340, 46, 720, 9, 9, NEON.gold);
}
