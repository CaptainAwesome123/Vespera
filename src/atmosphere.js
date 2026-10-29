import { T, U, scene, camera, MOBILE, renderer, MOON_DIR, moonLight, hemi, FOG_COLOR, shared, $ } from './core.js';
import { segs, facadeMat } from './facade-shader.js';
import { CLOCK } from './ragdoll.js';
import { toast } from './boat.js';
import { STREET } from './serpentine.js';
import { reflSweep, LAND_GLSL } from './water.js';
import { GROUND_FOG } from './airships.js';

/* =====================================================================
   V25 · POLARNACHT UND WETTER
   Vespera liegt am Nordpol: es bleibt immer Nacht. Abwechslung bringen Mondphase
   (wie heute am echten Himmel, dann mit den Spieltagen weiter), Polarlicht, Sterne,
   Bewölkung und Wetterlagen, die von selbst wechseln (Taste N legt eine fest):
   klar, Polarlicht, türkiser Dunst, dichter Nebel, Regen, Schnee, Eisnebel.
   Nässe und Schneedecke folgen träge (Pfützen bleiben nach dem Regen, Schnee taut langsam).
   ===================================================================== */
export const WEATHERS = [
  { id: 'klar', name: 'Klare Polarnacht', fog: 0.8, cloud: 0.12, aurora: 0.5, rain: 0, snow: 0, frost: 0.2, tint: [0.03, 0.125, 0.142], w: 2 },
  { id: 'polarlicht', name: 'Polarlicht', fog: 0.7, cloud: 0.04, aurora: 1.0, rain: 0, snow: 0, frost: 0.35, tint: [0.028, 0.13, 0.13], w: 2 },
  { id: 'dunst', name: 'Türkiser Dunst', fog: 1.4, cloud: 0.35, aurora: 0.35, rain: 0, snow: 0, frost: 0, tint: [0.03, 0.135, 0.145], w: 3 },
  { id: 'nebel', name: 'Dichter Nebel', fog: 2.3, cloud: 0.65, aurora: 0.05, rain: 0, snow: 0, frost: 0, tint: [0.035, 0.14, 0.15], w: 2 },
  { id: 'regen', name: 'Regen', fog: 1.5, cloud: 0.95, aurora: 0, rain: 1, snow: 0, frost: 0, tint: [0.028, 0.11, 0.128], w: 2 },
  { id: 'schnee', name: 'Schneefall', fog: 1.6, cloud: 0.9, aurora: 0, rain: 0, snow: 1, frost: 0, tint: [0.04, 0.12, 0.15], w: 2 },
  { id: 'frost', name: 'Eisnebel', fog: 1.3, cloud: 0.15, aurora: 0.4, rain: 0, snow: 0, frost: 1, tint: [0.036, 0.13, 0.155], w: 1 },
];
const KEYS = ['fog', 'cloud', 'aurora', 'rain', 'snow', 'frost'];
export const ATMO = {
  w: null, cur: {}, tint: new T.Color(), timer: 0, pinned: false, fogMul: 1, inside: 0,
  phase0: 0, phase: 0.5, gameMin: 0, moonI: 0.45, roof: null, hudT: 0, sweepT: 2, shadowFrame: 0, shadows: false,
};
const SYN = 29.530588853;   // synodischer Monat in Tagen
{
  const q = new URLSearchParams(location.search);
  const w = WEATHERS.find(x => x.id === q.get('wetter'));
  ATMO.w = w || WEATHERS[2];
  ATMO.pinned = !!w;
  for (const k of KEYS) ATMO.cur[k] = ATMO.w[k];
  ATMO.tint.setRGB(...ATMO.w.tint);
  ATMO.timer = 200 + Math.random() * 160;
  ATMO.phase0 = q.has('mond') ? +q.get('mond') : ((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 86400000 / SYN) % 1;
  if (ATMO.w.rain) U.uWet.value = 0.9;
  U.uSnowCover.value = ATMO.w.snow ? 0.8 : SNOW_BASE;
}
export const SNOW_BASE = 0.4;
export const MOON_NAMES = ['Neumond', 'Zunehmende Sichel', 'Erstes Viertel', 'Zunehmender Mond', 'Vollmond', 'Abnehmender Mond', 'Letztes Viertel', 'Abnehmende Sichel'];
export function moonName(ph) { return MOON_NAMES[Math.round(ph * 8) % 8]; }

function nextWeather() {
  const pool = WEATHERS.filter(w => w !== ATMO.w);
  let r = Math.random() * pool.reduce((a, w) => a + w.w, 0);
  for (const w of pool) if ((r -= w.w) <= 0) return w;
  return pool[0];
}
// Taste N: Wetter der Reihe nach festlegen, nach dem letzten wieder automatisch
export function cycleWeather() {
  const i = WEATHERS.indexOf(ATMO.w);
  if (ATMO.pinned && i === WEATHERS.length - 1) { ATMO.pinned = false; ATMO.timer = 120; toast('Wetter wechselt von selbst'); return; }
  ATMO.w = ATMO.pinned ? WEATHERS[i + 1] : WEATHERS[0];
  ATMO.pinned = true;
  toast('Wetter: ' + ATMO.w.name);
}

/* ---------- Dachkarte: 4-m-Raster der höchsten Dachkante, damit es unter Dächern nicht regnet ---------- */
export const ROOF = { cell: 4, n: 600, x0: -1200, z0: -1200, h: null };
export function buildRoofMap() {
  const { cell, n, x0, z0 } = ROOF, h = ROOF.h = new Float32Array(n * n);
  for (const s of segs) {
    if (s.dead || s.y1 < 2.5) continue;
    const c = Math.cos(s.ry || 0), sn = Math.sin(s.ry || 0), r = Math.hypot(s.w, s.d) / 2;
    const i0 = Math.max(0, Math.floor((s.x - r - x0) / cell)), i1 = Math.min(n - 1, Math.floor((s.x + r - x0) / cell));
    const j0 = Math.max(0, Math.floor((s.z - r - z0) / cell)), j1 = Math.min(n - 1, Math.floor((s.z + r - z0) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = x0 + (i + 0.5) * cell - s.x, dz = z0 + (j + 0.5) * cell - s.z;
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      if (Math.abs(lx) <= s.w / 2 && Math.abs(lz) <= s.d / 2 && s.y1 > h[j * n + i]) h[j * n + i] = s.y1;
    }
  }
  const px = new Uint8Array(n * n * 4);
  for (let k = 0; k < n * n; k++) { px[k * 4] = Math.min(255, Math.ceil(h[k] / 2)); px[k * 4 + 3] = 255; }
  const tex = new T.DataTexture(px, n, n); tex.magFilter = tex.minFilter = T.NearestFilter; tex.needsUpdate = true;
  U.uRoofMap.value = tex; U.uRoofBox.value.set(x0, z0, n * cell, 510);
}
export function roofAt(x, z) {
  const { cell, n, x0, z0, h } = ROOF; if (!h) return 0;
  const i = Math.floor((x - x0) / cell), j = Math.floor((z - z0) / cell);
  return i < 0 || j < 0 || i >= n || j >= n ? 0 : h[j * n + i];
}

/* ---------- Niederschlag: Regenfäden und Schneeflocken (dazu Eisglitzern) in einem Kasten um die Kamera, ganz auf der GPU ---------- */
const PRECIP_VS = `attribute vec4 aSeed; uniform vec3 uCam; uniform float uTime; uniform float uInside; uniform vec4 uWind; uniform sampler2D uRoofMap; uniform vec4 uRoofBox;
  bool covered(vec3 p){ vec2 q = (p.xz - uRoofBox.xy) / uRoofBox.z; if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return false; return p.y < texture2D(uRoofMap, q).r * uRoofBox.w; }
  vec3 wrapBox(vec3 p, vec3 B){ vec3 o = uCam - B * 0.5; return o + mod(p - o, B); }`;
function precipMesh(n, vs, fs) {
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const seed = new Float32Array(n * 4); for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
  g.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 4)); g.instanceCount = n;
  const m = new T.Mesh(g, new T.ShaderMaterial({ uniforms: U, vertexShader: PRECIP_VS + vs, fragmentShader: fs, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  m.frustumCulled = false; m.renderOrder = 5; m.userData.noRefl = true; scene.add(m);
  return m;
}
export const PRECIP = { rain: null, snow: null, fogBanks: null };
export function buildPrecip() {
  PRECIP.rain = precipMesh(MOBILE ? 2600 : 7000, `uniform float uRain; varying float vA; varying vec2 vQ;
    void main(){
      vec3 B = vec3(36.0, 24.0, 36.0);
      if (aSeed.w > uRain || uInside > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float sp = 8.0 + fract(aSeed.w * 7.31) * 3.0;
      vec3 vel = vec3(uWind.x * uWind.z * 0.45, -sp, uWind.y * uWind.z * 0.45);
      vec3 p = wrapBox(aSeed.xyz * B + mod(vel * uTime, B), B);
      if (covered(p)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vec3 dir = normalize(vel), toC = uCam - p; float dist = length(toC);
      vec3 side = normalize(cross(dir, toC / max(dist, 0.01)));
      float len = 0.5 + 0.3 * fract(aSeed.w * 13.7), w = 0.008 + 0.0022 * dist;
      vec3 wp = p + side * position.x * w + dir * position.y * len;
      vQ = position.xy;
      vA = smoothstep(0.6, 2.5, dist) * (1.0 - smoothstep(12.0, 18.0, dist)) / (1.0 + dist * 0.12);
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, `varying float vA; varying vec2 vQ;
    void main(){
      float a = 1.0 - abs(vQ.x) * 2.0; a *= a * smoothstep(0.0, 0.35, vQ.y) * smoothstep(1.0, 0.55, vQ.y);
      gl_FragColor = vec4(vec3(0.5, 0.66, 0.7) * a * vA * 0.5, 1.0);
    }`);
  PRECIP.snow = precipMesh(MOBILE ? 2200 : 6000, `uniform float uSnow; uniform float uFrost; varying float vA; varying vec2 vQ; varying float vK;
    void main(){
      vec3 B = vec3(40.0, 26.0, 40.0);
      float flake = step(aSeed.w, uSnow), spark = step(1.0 - uFrost * 0.6, aSeed.w) * (1.0 - flake);
      if (flake + spark < 0.5 || uInside > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float h = fract(aSeed.w * 17.3);
      vec3 vel = flake > 0.5 ? vec3(uWind.x * uWind.z * 0.35, -(0.9 + h * 0.6), uWind.y * uWind.z * 0.35) : vec3(uWind.x * 0.2, -0.08, uWind.y * 0.2);
      vec3 p = aSeed.xyz * B + mod(vel * uTime, B);
      p.x += sin(uTime * (0.7 + h) + aSeed.w * 40.0) * 0.5 * flake; p.z += cos(uTime * (0.6 + h) + aSeed.x * 30.0) * 0.5 * flake;
      p = wrapBox(p, B);
      if (covered(p)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      float dist = distance(p, uCam);
      vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), cu = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
      float s = flake > 0.5 ? (0.035 + 0.035 * h) + dist * 0.0015 : 0.012 + dist * 0.001;
      vec3 wp = p + (cr * position.x + cu * (position.y - 0.5)) * s;
      vQ = vec2(position.x, position.y - 0.5); vK = flake;
      float tw = spark * pow(0.5 + 0.5 * sin(uTime * (3.0 + h * 6.0) + aSeed.z * 50.0), 6.0) * (1.0 - smoothstep(4.0, 14.0, dist)) * 2.5;
      vA = flake * smoothstep(0.5, 2.0, dist) * (1.0 - smoothstep(14.0, 20.0, dist)) + tw;
      gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`, `varying float vA; varying vec2 vQ; varying float vK;
    void main(){
      float r = length(vQ) * 2.0; float a = vK > 0.5 ? smoothstep(1.0, 0.25, r) : smoothstep(1.0, 0.0, r) * (1.0 + 2.0 * step(abs(vQ.x), 0.05) + 2.0 * step(abs(vQ.y), 0.05));
      gl_FragColor = vec4(mix(vec3(0.75, 0.9, 1.0), vec3(0.55, 0.62, 0.7), vK) * a * vA * 0.55, 1.0);
    }`);
  // Nebelbänke über dem See: ziehende Schwaden in mehreren Lagen, über dem Wasser dichter als an Land
  const mat = new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uTeal; uniform vec3 uCam; uniform float uInside; uniform float uMist; uniform vec4 uWind; varying vec3 vW; varying float vD;
      float fH(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float fN(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(fH(i),fH(i+vec2(1,0)),f.x), mix(fH(i+vec2(0,1)),fH(i+vec2(1,1)),f.x), f.y); }
      ${LAND_GLSL()}
      void main(){
        float water = smoothstep(0.0, 60.0, -landDistG(vW.xz));
        vec2 p = vW.xz * 0.006 + uWind.xy * uTime * 0.0012 + vec2(uTime * 0.003, 0.0);
        float n = fN(p) * 0.55 + fN(p * 2.7 + 3.0) * 0.3 + fN(p * 6.3 - uTime * 0.01) * 0.15;
        float a = smoothstep(0.42 - 0.12 * min(uMist, 1.5), 0.8, n) * water * 0.13 * (0.5 + 0.5 * min(uMist, 2.0));
        a *= smoothstep(2.0, 25.0, abs(uCam.y - vW.y)) * smoothstep(3200.0, 400.0, vD) * smoothstep(0.0, 40.0, vD) * (1.0 - uInside);
        gl_FragColor = vec4(mix(uTeal, vec3(0.6, 0.75, 0.8), 0.25) * a, 1.0);
      }`,
  });
  const banks = new T.Group();
  for (const y of MOBILE ? [3.5, 12] : [0.4, 3.5, 8, 14]) { const m = new T.Mesh(new T.PlaneGeometry(6000, 6000), mat); m.rotation.x = -Math.PI / 2; m.position.set(0, y, 0); m.renderOrder = 1; m.frustumCulled = false; m.userData.noRefl = true; banks.add(m); }
  scene.add(banks); PRECIP.fogBanks = banks;
}

/* ---------- Leuchtende Flächen im Nebel verblassen lassen (siehe fog_fragment in core.js) ---------- */
// V29: läuft alle 4 s über die ganze Szene; ohne eine neue Liste je Objekt und mit einem Merkzettel geprüfter Materialien
const _fogSeen = new WeakSet();
function fogAddMat(m) {
  if (!m || _fogSeen.has(m)) return; _fogSeen.add(m);
  if (m.fog && m.blending === T.AdditiveBlending && !m.isShaderMaterial && !(m.defines && 'FOG_ADD' in m.defines)) { m.defines = { ...(m.defines || {}), FOG_ADD: '' }; m.needsUpdate = true; }
}
export function fogAddScan() {
  scene.traverse(o => { const m = o.material; if (Array.isArray(m)) for (const x of m) fogAddMat(x); else fogAddMat(m); });
}

/* ---------- Mondschatten (nur am PC): Gebäude und Autos werfen lange Schatten auf Straße und Gehweg ---------- */
export function setupShadows() {
  if (MOBILE || new URLSearchParams(location.search).has('ohneSchatten')) return;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  moonLight.castShadow = true;
  const sh = moonLight.shadow, c = sh.camera;
  sh.mapSize.set(2048, 2048); c.left = c.bottom = -150; c.right = c.top = 150; c.near = 10; c.far = 2200; c.updateProjectionMatrix();
  sh.bias = -0.0005; sh.normalBias = 0.5; sh.radius = 2;
  scene.add(moonLight.target);
  scene.traverse(o => {
    if (o.isInstancedMesh && o.material === facadeMat) o.castShadow = true;
    if (o.isMesh && o.material && o.material.userData && o.material.userData.street) o.receiveShadow = true;
  });
  for (const m of [shared.carMesh, shared.carMeshHi]) if (m) m.castShadow = true;
  if (STREET.ground) STREET.ground.receiveShadow = true;
  ATMO.shadows = true;
}
const _up = new T.Vector3(0, 1, 0), _fw = new T.Vector3(), _tg = new T.Vector3(), _ax = new T.Vector3(), _ay = new T.Vector3();
function updateShadow() {
  if (!ATMO.shadows || (++ATMO.shadowFrame % 2)) return;
  const cp = camera.position;
  camera.getWorldDirection(_fw); _fw.y = 0; if (_fw.lengthSq() < 1e-4) _fw.set(0, 0, -1); _fw.normalize();
  _tg.set(cp.x, 0, cp.z).addScaledVector(_fw, 70);
  // auf das Texelraster der Schattenkarte einrasten, sonst flimmern die Kanten beim Gehen
  _ax.crossVectors(MOON_DIR, _up).normalize(); _ay.crossVectors(_ax, MOON_DIR).normalize();
  const tx = 300 / 2048, a = Math.round(_tg.dot(_ax) / tx) * tx - _tg.dot(_ax), b = Math.round(_tg.dot(_ay) / tx) * tx - _tg.dot(_ay);
  _tg.addScaledVector(_ax, a).addScaledVector(_ay, b);
  moonLight.target.position.copy(_tg); moonLight.target.updateMatrixWorld();
  moonLight.position.copy(_tg).addScaledVector(MOON_DIR, 1100);
  renderer.shadowMap.needsUpdate = moonLight.intensity > 0.05 && cp.y < 400;
}

export function buildAtmosphere() {
  buildRoofMap();
  buildPrecip();
  setupShadows();
  fogAddScan();
}

/* ---------- je Bild ---------- */
const HEMI_SKY = new T.Color(0.1, 0.18, 0.3), HEMI_GROUND = new T.Color(0.12, 0.42, 0.44), _c = new T.Color();
export function updateAtmosphere(dt) {
  const A = ATMO, W = A.w, c = A.cur;
  if (!A.pinned && (A.timer -= dt) <= 0) { A.w = nextWeather(); A.timer = 180 + Math.random() * 200; }
  const k = 1 - Math.exp(-dt / 14);
  for (const key of KEYS) c[key] += (W[key] - c[key]) * k;
  A.tint.lerp(_c.setRGB(...W.tint), k);
  U.uRain.value = c.rain; U.uSnow.value = c.snow; U.uFrost.value = c.frost; U.uAurora.value = c.aurora; U.uCloud.value = c.cloud; U.uMist.value = c.fog;
  // Nässe kommt schnell und trocknet langsam; das Pflaster bleibt immer etwas feucht. Schnee bleibt liegen und taut langsam, im Regen schneller.
  const wet = U.uWet, sc = U.uSnowCover, wT = Math.max(0.3, c.rain);
  wet.value += (wT - wet.value) * (1 - Math.exp(-dt / (wT > wet.value ? 20 : 160)));
  // V30: Nordpol: eine leichte Schneedecke (SNOW_BASE) bleibt immer liegen, Schneefall macht sie dicker
  const sT = c.snow > 0.3 ? 1 : SNOW_BASE;
  sc.value += (sT - sc.value) * (1 - Math.exp(-dt / (sT > sc.value ? 90 : c.rain > 0.3 ? 60 : 300)));
  // Mond: zieht in 24 Spielstunden flach um den Horizont, die Phase läuft mit den Spieltagen weiter
  A.gameMin += dt;
  A.phase = (A.phase0 + A.gameMin / 1440 / SYN) % 1;
  const az = CLOCK.min / 1440 * Math.PI * 2 * 0.966 + 0.87, alt = 0.36 + 0.07 * Math.sin(A.phase * Math.PI * 2);
  MOON_DIR.set(Math.cos(alt) * Math.sin(az), Math.sin(alt), -Math.cos(alt) * Math.cos(az));
  const lit = (1 - Math.cos(A.phase * Math.PI * 2)) / 2;
  A.moonI = (0.1 + 0.45 * lit) * (1 - 0.75 * c.cloud);
  U.uMoonPhase.value = A.phase; U.uMoonLit.value = (0.12 + 0.88 * lit) * (1 - 0.6 * c.cloud);
  if (!A.shadows) moonLight.position.copy(MOON_DIR).multiplyScalar(1000);
  // Nebel: Grunddichte je Wetter; unter einem Dach (Laden, Bar) und im Belmont fast keiner
  const cp = camera.position, r0 = roofAt(cp.x, cp.z);
  const under = r0 > cp.y + 0.5 && Math.min(roofAt(cp.x + 4, cp.z), roofAt(cp.x - 4, cp.z), roofAt(cp.x, cp.z + 4), roofAt(cp.x, cp.z - 4)) > cp.y + 0.5 ? 1 : 0;
  A.inside += (Math.max(under, U.uInside.value) - A.inside) * Math.min(1, dt * 1.5);
  A.fogMul = c.fog * (1 - 0.85 * A.inside);
  FOG_COLOR.copy(A.tint); scene.fog.color.copy(FOG_COLOR); if (scene.background && scene.background.isColor) scene.background.copy(FOG_COLOR);
  // Polarlicht färbt das Himmelslicht leicht grün, Schnee hellt das Licht vom Boden auf
  hemi.color.copy(HEMI_SKY).add(_c.setRGB(0.01, 0.07, 0.035).multiplyScalar(c.aurora * (1 - c.cloud)));
  hemi.groundColor.copy(HEMI_GROUND).lerp(_c.setRGB(0.3, 0.42, 0.5), sc.value * 0.5);
  updateShadow();
  // Nebelschichten, die man von der eigenen Höhe aus ohnehin nicht sieht, gar nicht erst zeichnen (spart auf dem Handy viel Füllrate)
  if (PRECIP.fogBanks) for (const m of PRECIP.fogBanks.children) m.visible = Math.abs(cp.y - m.position.y) > 2 && A.inside < 0.9;
  for (const m of GROUND_FOG) m.visible = Math.abs(cp.y - m.position.y) > 6 && U.uInside.value < 0.9;
  if ((A.sweepT -= dt) <= 0) { A.sweepT = 4; reflSweep(); fogAddScan(); }
  if ((A.hudT -= dt) <= 0) { A.hudT = 1; const el = $('wx'); if (el) el.textContent = W.name + ' · ' + moonName(A.phase); }
}
export function atmoState() { return { weather: ATMO.w.id, pinned: ATMO.pinned, ...ATMO.cur, wet: U.uWet.value, snowCover: U.uSnowCover.value, phase: ATMO.phase, moon: moonName(ATMO.phase), shadows: ATMO.shadows, streetRefl: U.uStreetRefl.value }; }
