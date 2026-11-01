import { T, U, scene, camera, LOW } from './core.js';
import { cars } from './airships.js';
import { DRIVE } from './eating.js';

/* =====================================================================
   V38 · SCHEINWERFERKEGEL DER AUTOMOBILE
   Bisher leuchteten die Wagen nur als Lichtpunkte. Jetzt werfen die nächsten Wagen zwei Lichtkegel in die feuchte Nachtluft
   (sichtbar, je dichter Dunst, Regen oder Schnee) und einen warmen Lichtteppich auf die Fahrbahn vor sich. Alles in zwei
   Draw Calls: je ein InstancedMesh für Kegel und Bodenlicht, die Lage der Wagen (x, y, z, Kurs) kommt je Bild als Attribut.
   Die Shader sind klein (keine Schleifen, keine Texturen).
   ===================================================================== */
export const CARL = { n: LOW ? 8 : 24, cones: null, pools: null, attr: null, t: 0 };
const _d = new Float32Array(64), _c = [];
export function buildCarLights() {
  const n = CARL.n, attr = CARL.attr = new T.InstancedBufferAttribute(new Float32Array(n * 4).fill(-1000), 4); attr.setUsage(T.DynamicDrawUsage);
  // Kegel: offener Konus, Spitze am Scheinwerfer, 16 m lang; zwei je Wagen (links/rechts als Spiegelung im Shader über aS)
  const cg = new T.InstancedBufferGeometry().copy(new T.ConeGeometry(1, 1, 14, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2));
  // zwei Instanzen je Wagen: Index gerade = links, ungerade = rechts, Attribut aSide
  const side = new Float32Array(n * 2); for (let i = 0; i < n * 2; i++) side[i] = i % 2 ? 1 : -1;
  const carAttr = new T.InstancedBufferAttribute(new Float32Array(n * 2 * 4), 4); carAttr.setUsage(T.DynamicDrawUsage); CARL.attr2 = carAttr;
  cg.instanceCount = n * 2; cg.setAttribute('aCar', carAttr); cg.setAttribute('aSide', new T.InstancedBufferAttribute(side, 1));
  CARL.cones = new T.Mesh(cg, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `attribute vec4 aCar; attribute float aSide; uniform vec3 uCam; varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
      void main(){
        float c = cos(aCar.w), s = sin(aCar.w);
        // Fahrtrichtung wie in traffic.js: (cos yaw, -sin yaw); Scheinwerfer 2,6 m vor der Mitte, 0,62 m seitlich, 1,07 m hoch
        vec3 fw = vec3(c, 0.0, -s), sd = vec3(s, 0.0, c);
        vec3 lamp = aCar.xyz + fw * 2.62 + sd * (0.62 * aSide) + vec3(0.0, 0.85, 0.0);
        float d = distance(uCam, lamp);
        vA = smoothstep(90.0, 15.0, d) * smoothstep(1.0, 4.0, d) * step(-500.0, aCar.y);
        if (vA < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float L = 16.0, r = 0.8 + position.z * L * 0.15;   // der Kegel öffnet sich nach vorn
        vec3 wp = lamp + fw * (position.z * L) + sd * (position.x * r) + vec3(0.0, position.y * r * 0.7 - position.z * L * 0.05, 0.0);
        vT = position.z; vN = normalize(sd * normal.x + vec3(0.0, normal.y, 0.0) + fw * normal.z * 0.3); vV = normalize(uCam - wp);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform float uMist; uniform float uRain; uniform float uSnow; uniform float uFrost; varying float vT; varying float vA; varying vec3 vN; varying vec3 vV;
      void main(){
        float e = pow(abs(dot(vN, vV)), 1.5);
        float a = e * pow(1.0 - vT, 1.8) * smoothstep(0.0, 0.08, vT) * vA;
        float vol = 0.35 + 0.45 * min(uMist, 2.0) + 0.8 * uRain + 0.7 * uSnow + 0.3 * uFrost;
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.6) * a * 0.09 * vol, 1.0);
      }`,
  }));
  CARL.cones.frustumCulled = false; CARL.cones.renderOrder = 3; CARL.cones.userData.noRefl = true; scene.add(CARL.cones);
  // Lichtteppich: ein Rechteck flach auf der Fahrbahn vor dem Wagen (1,5 m vor der Stoßstange bis 11 m voraus, 5 m breit)
  const pg = new T.InstancedBufferGeometry().copy(new T.PlaneGeometry(1, 1, 1, 6).rotateX(-Math.PI / 2));
  pg.instanceCount = n; pg.setAttribute('aCar', attr);
  CARL.pools = new T.Mesh(pg, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec4 aCar; uniform vec3 uCam; varying vec2 vQ; varying float vA;
      void main(){
        float c = cos(aCar.w), s = sin(aCar.w);
        vec3 fw = vec3(c, 0.0, -s), sd = vec3(s, 0.0, c);
        float d = distance(uCam, aCar.xyz);
        vA = smoothstep(160.0, 30.0, d) * step(-500.0, aCar.y);
        if (vA < 0.002) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        // position.x: Breite (-0,5..0,5), position.z: -0,5 = vorn, 0,5 = hinten (nach rotateX zeigt die Ebene in x/z)
        float along = (0.5 - position.z) * 12.0 + 1.6, w = 2.0 + along * 0.32;
        vec3 wp = aCar.xyz + fw * along + sd * (position.x * w) + vec3(0.0, -0.22 + 0.04, 0.0);
        vQ = vec2(position.x * 2.0, (along - 1.6) / 12.0);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `uniform float uWet; uniform float uSnowCover; varying vec2 vQ; varying float vA;
      void main(){
        // zwei Lichtflecken (linker und rechter Scheinwerfer), die nach vorn zu einem verschmelzen und ausdünnen
        float x = abs(vQ.x), two = exp(-pow((x - 0.35 * (1.0 - vQ.y)) * 3.2, 2.0));
        float a = two * pow(1.0 - vQ.y, 1.6) * smoothstep(0.0, 0.08, vQ.y) * vA;
        a *= 0.5 + 0.5 * uWet + 0.3 * uSnowCover;   // nasser Stein und Schnee tragen das Licht weiter
        gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * a * 0.42, 1.0);
      }`,
  }));
  CARL.pools.frustumCulled = false; CARL.pools.renderOrder = 2; CARL.pools.userData.noRefl = true; scene.add(CARL.pools);
}
// je Bild: die n nächsten sichtbaren Wagen (traffic.js schreibt car._x/_y/_z/_yaw/_hid), dazu der eigene Wagen am Steuer
export function updateCarLights() {
  if (!CARL.pools) return;
  const cp = camera.position, N = CARL.n, A = CARL.attr.array, A2 = CARL.attr2.array, list = _c, dd = _d;
  let n = 0;
  const off = cp.y > 90 || U.uInside.value > 0.5;
  if (!off) {
    for (const car of cars) {
      if (car._hid || car._x === undefined) continue;
      const d = (car._x - cp.x) ** 2 + (car._z - cp.z) ** 2; if (d > 160 * 160) continue;
      let i; if (n < N) i = n++; else if (d < dd[N - 1]) i = N - 1; else continue;
      while (i > 0 && dd[i - 1] > d) { dd[i] = dd[i - 1]; list[i] = list[i - 1]; i--; }
      dd[i] = d; list[i] = car;
    }
    if (DRIVE.on && DRIVE.body && n < N) { list[n++] = { _x: DRIVE.body.x, _y: (DRIVE.body.gy !== undefined && !DRIVE.body.air ? DRIVE.body.gy : DRIVE.body.y) + 0.22, _z: DRIVE.body.z, _yaw: DRIVE.body.h }; }
  }
  for (let i = 0; i < N; i++) {
    const c = i < n ? list[i] : null, o = i * 4;
    if (c) { A[o] = c._x; A[o + 1] = c._y; A[o + 2] = c._z; A[o + 3] = c._yaw; } else { A[o] = 0; A[o + 1] = -1000; A[o + 2] = 0; A[o + 3] = 0; }
    for (let k = 0; k < 2; k++) { const p = (i * 2 + k) * 4; A2[p] = A[o]; A2[p + 1] = A[o + 1]; A2[p + 2] = A[o + 2]; A2[p + 3] = A[o + 3]; }
  }
  CARL.attr.needsUpdate = true; CARL.attr2.needsUpdate = true;
}
