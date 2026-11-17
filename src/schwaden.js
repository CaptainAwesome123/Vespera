/* =====================================================================
   V93 · NEBELSCHWADEN IN DEN STRASSEN
   Zum Bodennebel (core.js) und den flachen Nebelschichten (atmosphere.js) kommen stehende Schwaden: weiche, langsam ziehende
   Nebelwände in den Straßen rund um die Kamera. Sie leuchten türkis und nehmen in der Nähe einer Laterne deren Gold an,
   so wird das Laternenlicht im Nebel sichtbar. Je dichter das Wetter, desto kräftiger.
   Ein Draw Call (InstancedMesh, kleiner Shader: zwei Texturabfragen, keine Schleifen). ?schwaden=aus schaltet sie ab.
   ===================================================================== */
import { T, scene, camera, U, MOBILE, LOW, FOG_COLOR, FOG_DENSITY } from './core.js';
import { onIsland, blockAt } from './island.js';

export const SCHW = { on: new URLSearchParams(location.search).get('schwaden') !== 'aus', mesh: null, n: MOBILE || LOW ? 10 : 26, list: [], t: 0, lampT: 0, k: 0 };

function fogTex() {
  // weiche Wolkenflecken, waagrecht gestreckt; nahtlos wiederholbar (jeder Fleck auch um eine Kachel versetzt gemalt)
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  let s = 7; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 90; i++) {
    const x = R() * W, y = R() * H, r = 10 + R() * 34, a = 0.05 + R() * 0.12;
    for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.save(); g.translate(x + ox, y + oy); g.scale(1.8, 1); g.translate(-(x + ox), -(y + oy));
      g.beginPath(); g.arc(x + ox, y + oy, r, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}

export function buildSchwaden() {
  if (!SCHW.on || SCHW.mesh) return;
  const n = SCHW.n, g = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1));
  const aP = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4), aC = new T.InstancedBufferAttribute(new Float32Array(n * 4), 4);
  aP.setUsage(T.DynamicDrawUsage); aC.setUsage(T.DynamicDrawUsage);
  g.setAttribute('aP', aP); g.setAttribute('aC', aC); g.instanceCount = n;
  const uni = { tFog: { value: fogTex() }, uTime: U.uTime, uCam: U.uCam, uK: { value: 0 } };
  SCHW.mesh = new T.Mesh(g, new T.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: `attribute vec4 aP; attribute vec4 aC; uniform vec3 uCam; varying vec2 vUv; varying vec4 vC; varying float vA; varying float vS;
      void main(){
        vec2 toC = uCam.xz - aP.xz; float d = length(toC); vec2 dir = toC / max(d, 0.001), rt = vec2(dir.y, -dir.x);
        vA = smoothstep(5.0, 14.0, d) * smoothstep(85.0, 55.0, d);
        if (vA < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float w = aP.w, h = aP.w * 0.38;
        vec3 wp = vec3(aP.x + rt.x * position.x * w, aP.y + (position.y + 0.32) * h, aP.z + rt.y * position.x * w);
        vUv = position.xy + 0.5; vC = aC; vS = aP.w;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform sampler2D tFog; uniform float uTime; uniform float uK; varying vec2 vUv; varying vec4 vC; varying float vA; varying float vS;
      void main(){
        // zwei gegeneinander ziehende Lagen; Ränder weich, unten dichter als oben
        vec2 q = vUv * vec2(1.0, 0.5) + vec2(vS * 0.37, vS * 0.11);
        float a = texture2D(tFog, q + vec2(uTime * 0.012, 0.0)).r * 1.6 + texture2D(tFog, q * 1.7 - vec2(uTime * 0.02, uTime * 0.004)).r;
        float e = smoothstep(0.0, 0.32, vUv.x) * smoothstep(1.0, 0.68, vUv.x) * smoothstep(1.0, 0.25, vUv.y) * smoothstep(0.0, 0.1, vUv.y);
        a = clamp(a * e * vA * vC.a * uK, 0.0, 0.6);
        gl_FragColor = vec4(vC.rgb, a);
      }`,
  }));
  SCHW.mesh.frustumCulled = false; SCHW.mesh.renderOrder = 4; SCHW.mesh.userData.noRefl = true; scene.add(SCHW.mesh);
  SCHW.uK = uni.uK; SCHW.aP = aP; SCHW.aC = aC;
  for (let i = 0; i < n; i++) SCHW.list.push({ x: 0, y: -1000, z: 0, w: 14, ok: false, c: [0, 0, 0], ph: Math.random() * 6.28 });
}

const _d = new T.Vector3();
function place(S, cp, first) {
  // bevorzugt vor der Kamera; nur auf freien Flächen (nicht in Häuserblöcken), damit die Wände den Schwaden nicht hart schneiden
  camera.getWorldDirection(_d);
  for (let k = 0; k < 8; k++) {
    const a = Math.atan2(_d.x, _d.z) + (Math.random() - 0.5) * (first ? 6.28 : 2.2), r = first ? 12 + Math.random() * 60 : 50 + Math.random() * 25;
    const x = cp.x + Math.sin(a) * r, z = cp.z + Math.cos(a) * r, w = 12 + Math.random() * 12;
    if (!onIsland(x, z, -2) || blockAt(x, z, 2)) continue;
    Object.assign(S, { x, y: 0, z, w, ok: true }); return;
  }
  S.ok = false;
}

export function updateSchwaden(dt) {
  if (!SCHW.on) return;
  if (!SCHW.mesh) buildSchwaden();
  const cp = camera.position, dens = U.uFogDensity ? U.uFogDensity.value / FOG_DENSITY : 1;
  // nur unten in der Stadt, draußen, und nicht bei klarer Luft
  const kT = cp.y < 45 && U.uInside.value < 0.5 && onIsland(cp.x, cp.z, 20) ? Math.min(1.4, Math.max(0, dens - 0.35) * 1.15) : 0;
  SCHW.k += (kT - SCHW.k) * Math.min(1, dt * 0.8);
  SCHW.uK.value = SCHW.k; SCHW.mesh.visible = SCHW.k > 0.01;
  if (!SCHW.mesh.visible) { for (const S of SCHW.list) S.ok = false; return; }
  const wd = U.uWind.value, ws = Math.min(wd.z, 9) * 0.12 + 0.15, P = SCHW.aP.array, C = SCHW.aC.array, L = U.uLamps.value;
  const lampNow = (SCHW.lampT -= dt) <= 0; if (lampNow) SCHW.lampT = 0.25;
  const fc = FOG_COLOR;
  SCHW.list.forEach((S, i) => {
    if (!S.ok) place(S, cp, true);
    else {
      S.x += wd.x * ws * dt; S.z += wd.y * ws * dt;
      const d2 = (S.x - cp.x) ** 2 + (S.z - cp.z) ** 2;
      if (d2 > 85 * 85 || blockAt(S.x, S.z, 1)) place(S, cp, false);
    }
    if (lampNow || !S.c[3]) {
      // Gold der nahen Laternen (uLamps: die nächsten 8/16 Laternen); Grundfarbe: angeleuchteter türkiser Nebel
      let g = 0; for (const l of L) { if (l.w <= 0) continue; const q = (l.x - S.x) ** 2 + (l.z - S.z) ** 2; g += l.w * 30 / (30 + q); }
      g = Math.min(g, 1.6); S.c = [fc.r * 2.6 + 0.2 * g, fc.g * 2.2 + 0.12 * g, fc.b * 2.1 + 0.05 * g, 1];
    }
    const o = i * 4;
    if (S.ok) { P[o] = S.x; P[o + 1] = S.y; P[o + 2] = S.z; P[o + 3] = S.w; } else { P[o] = cp.x; P[o + 1] = -1000; P[o + 2] = cp.z + 1e4; P[o + 3] = 1; }
    C[o] = S.c[0]; C[o + 1] = S.c[1]; C[o + 2] = S.c[2]; C[o + 3] = 0.65;
  });
  SCHW.aP.needsUpdate = true; SCHW.aC.needsUpdate = true;
}
