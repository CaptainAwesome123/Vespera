import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { shared, T, renderer, MOBILE, LOW, scene, camera, U } from './core.js';
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
  bloomPass = new UnrealBloomPass(new T.Vector2(window.innerWidth / BLOOM_DIV, window.innerHeight / BLOOM_DIV), 0.72, 0.6, 0.72);
  composer.addPass(passWithoutReverse(bloomPass));   // V40: Quad-Pässe ohne Reverse-Z (siehe depth.js)
  // Filmischer Abschluss: weiche Lichterkappe, Türkis in den Schatten, Gold im Licht, Vignette, feines Korn
  gradePass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: U.uTime, uRes: { value: new T.Vector2(sz.x, sz.y) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        // weiche Schulter: helle Stellen werden sanft gekappt, nichts blendet
        c = c / (1.0 + max(c - 0.55, 0.0) * 1.3);
        c = mix(c * vec3(0.92, 1.02, 1.05), c * vec3(1.06, 1.0, 0.9), smoothstep(0.08, 0.6, l));
        c = pow(max(c, 0.0), vec3(0.96));
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        c *= 1.0 - 0.38 * smoothstep(0.35, 1.05, length(q));
        gl_FragColor = vec4(c, 1.0); }`,
  });
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
