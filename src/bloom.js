import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { shared, T, renderer, MOBILE, LOW, scene, camera, U, REGENGLAS, KINO } from './core.js';
import { resizeReflection } from './water.js';
import { depthOptions, passWithoutReverse } from './depth.js';

/* =====================================================================
   NACHLEUCHTEN (Bloom)
   ===================================================================== */
export let composer = null, bloomPass = null, gradePass = null; shared.bloomOn = true;
const BLOOM_DIV = LOW ? 3 : 2;   // V38: Nachleuchten auf der niedrigen Stufe in einem Drittel der Auflösung
export function setupComposer() {
  const sz = renderer.getDrawingBufferSize(new T.Vector2());
  // Tiefe: mit Reverse-Z (V40) 32-Bit-Gleitkomma, sonst erzwingt der Stencil einen 24-Bit-Puffer statt 16 Bit (nahe Flächen flimmerten)
  const rt = new T.WebGLRenderTarget(sz.x, sz.y, { type: T.HalfFloatType, samples: renderer.capabilities.isWebGL2 && !MOBILE ? (LOW ? 2 : 4) : 0, ...depthOptions(sz.x, sz.y) });   // V38: niedrige Stufe 2x statt 4x
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new T.Vector2(window.innerWidth / BLOOM_DIV, window.innerHeight / BLOOM_DIV), 0.72, KINO ? 0.82 : 0.6, 0.72);   // V99: größerer Radius = weicherer Lichthof
  composer.addPass(passWithoutReverse(bloomPass));   // V40: Quad-Pässe ohne Reverse-Z (siehe depth.js)
  // Filmischer Abschluss: weiche Lichterkappe, Türkis in den Schatten, Gold im Licht, Vignette, feines Korn
  gradePass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uIn: U.uInside, uLens: U.uLens, uMood: U.uMood, uDof: U.uDof, uRes: { value: new T.Vector2(sz.x, sz.y) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uIn; uniform float uLens; uniform vec4 uMood; uniform float uDof; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 dOff = vec2(0.0); float dRim = 0.0;
        ${REGENGLAS ? `// V98: Tropfen auf der Kamera: zwei Raster, jeder Tropfen erscheint, sitzt, rutscht ein Stück und verdunstet; er bricht das Bild dahinter
        if (uLens > 0.004) for (int k = 0; k < 2; k++) {
          vec2 sp = vUv * vec2(uRes.x / uRes.y, 1.0) * (k == 0 ? 7.0 : 12.0) + float(k) * 3.7;
          vec2 ci = floor(sp), cf = fract(sp) - 0.5;
          float h = hash(ci), h2 = hash(ci + 7.13);
          float life = fract(uTime * (0.05 + 0.05 * h2) + h * 3.1);
          float on = step(h, uLens * (k == 0 ? 0.28 : 0.38)) * smoothstep(0.0, 0.05, life) * (1.0 - smoothstep(0.8, 1.0, life));
          vec2 cc = vec2((h2 - 0.5) * 0.5, 0.22 - 0.5 * smoothstep(0.5, 0.8, life) * step(0.6, h2));
          float r = 0.13 + 0.16 * fract(h * 7.7);
          vec2 dv = (cf - cc) * vec2(1.0, 0.82) / r; float d = length(dv);
          float m = on * (1.0 - smoothstep(0.92, 1.0, d));
          dOff -= dv * sqrt(max(1.0 - d * d, 0.0)) * 0.035 * m / (k == 0 ? 7.0 : 12.0) * 7.0;
          dRim = max(dRim, m * smoothstep(0.75, 0.97, d));
        }` : ''}
        vec3 c = texture2D(tDiffuse, vUv + dOff).rgb;
        ${KINO ? `// V99: Tiefenschärfe im Gespräch: das Gegenüber in der Bildmitte bleibt scharf, der Rand wird weich (8 Proben auf einem Ring)
        vec2 qd = vUv - 0.5; qd.x *= uRes.x / uRes.y;
        float bR = uDof * smoothstep(0.18, 0.6, length(qd)) * 6.0 * uRes.y / 1080.0;
        if (bR > 0.3) {
          vec3 acc = c;
          for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398 + 0.39; acc += texture2D(tDiffuse, vUv + dOff + vec2(cos(a), sin(a)) * bR * (i < 4 ? 1.0 : 0.55) / uRes).rgb; }
          c = acc / 9.0;
        }` : ''}
        c *= 1.0 - 0.18 * dRim;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // V67: Innenräume etwas heller belichten, tiefe Schatten leicht türkis anheben (innen stärker), damit dunkle Ecken lesbar bleiben
        c *= 1.0 + 0.16 * uIn;
        c += vec3(0.008, 0.012, 0.014) * (1.0 + 1.8 * uIn) * (1.0 - smoothstep(0.0, 0.16, l));
        // weiche Schulter: helle Stellen werden sanft gekappt, nichts blendet
        c = c / (1.0 + max(c - 0.55, 0.0) * 1.3);
        c = mix(c * vec3(0.92, 1.02, 1.05), c * vec3(1.06, 1.0, 0.9), smoothstep(0.08, 0.6, l));
        c = pow(max(c, 0.0), vec3(0.96));
        ${KINO ? `// V99: Farbstimmung des Viertels (Gold im Belmont, Bernstein bei den Arbeitern, Türkis am Hafen, Eisblau in den Bergen)
        float lm = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(lm), c, uMood.w) * uMood.rgb;
        // feines Filmkorn, 24 Bilder je Sekunde, in den Schatten etwas stärker
        float gr = hash(floor(vUv * uRes) + fract(floor(uTime * 24.0) * 0.6180339) * vec2(173.0, 311.0)) - 0.5;
        c += gr * (0.014 + 0.012 * (1.0 - smoothstep(0.0, 0.35, lm)));` : ''}
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        c *= 1.0 - 0.38 * smoothstep(0.35, 1.05, length(q));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  // V98: ShaderPass kopiert die Uniforms; die Tropfen brauchen die echten (laufende Uhr, uLens aus performance.js)
  gradePass.uniforms.uLens = U.uLens; gradePass.uniforms.uTime = U.uTime; gradePass.uniforms.uMood = U.uMood; gradePass.uniforms.uDof = U.uDof;
  gradePass.uniforms.uIn = U.uInside;   // V118: die V67-Innenbelichtung hing an einer Kopie und blieb immer 0
  composer.addPass(passWithoutReverse(gradePass));
}
export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  const v = new T.Vector2(); renderer.getDrawingBufferSize(v);
  resizeReflection();
  if (composer) { composer.setSize(w, h); bloomPass.resolution.set(w / BLOOM_DIV, h / BLOOM_DIV); gradePass.uniforms.uRes.value.copy(v); }
  U.uScale.value = v.y / (2 * Math.tan(T.MathUtils.degToRad(camera.fov) / 2));
}
window.addEventListener('resize', resize);
