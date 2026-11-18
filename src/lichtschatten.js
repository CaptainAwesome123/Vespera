/* =====================================================================
   V102 · WEICHE SCHATTEN VON LATERNEN UND SCHEINWERFERN
   Leute, Alexander und Wagen in der Nähe werfen weiche Schatten auf das
   Pflaster: von den nächsten zwei Straßenlaternen strahlenförmig weg (je
   näher die Laterne, desto kürzer und dunkler), und im Scheinwerferkegel
   eines Wagens lang nach vorn. Ein Draw Call: flache Vierecke, die nur
   abdunkeln (wie die Spuren in spuren.js), Form und Weichheit im Shader;
   die Schatten werden zum Ende hin breiter und blasser.
   Mondschatten (atmosphere.js) bleiben wie sie sind. ?lichtschatten=aus
   ===================================================================== */
import { T, scene, U, camera, MOBILE, LOW } from './core.js';
import { pedsNear } from './ragdoll.js';
import { STREET } from './serpentine.js';
import { CARL } from './carlight.js';
import { player } from './player.js';
import { DRIVE } from './eating.js';
import { parked } from './serpentine.js';
import { VERDECKUNG } from './verdeckung.js';

export const LS = { on: new URLSearchParams(location.search).get('lichtschatten') !== 'aus', mesh: null, aA: null, grid: null, gridN: -1, n: 0 };
const N = MOBILE || LOW ? 40 : 96, CELL = 16, R = 13, R2 = R * R;
const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _Y = new T.Vector3(0, 1, 0);

function build() {
  const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);   // Ursprung am Fuß, Länge nach +z
  const aA = new T.InstancedBufferAttribute(new Float32Array(N), 1); aA.setUsage(T.DynamicDrawUsage); g.setAttribute('aA', aA);
  const m = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.ZeroFactor, blendDst: T.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute float aA; varying vec2 vQ; varying float vA;
      void main(){ vQ = vec2(position.x, position.z); vA = aA; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying float vA;
      void main(){
        float y = clamp(vQ.y, 0.0, 1.0), w = mix(0.32, 0.5, y);
        float a = (1.0 - smoothstep(w * 0.35, w, abs(vQ.x))) * smoothstep(0.0, 0.07, y) * (1.0 - smoothstep(0.35, 1.0, y));
        gl_FragColor = vec4(0.0, 0.0, 0.0, a * vA); }`,
  });
  const im = new T.InstancedMesh(g, m, N); im.count = 0; im.frustumCulled = false; im.userData.noRefl = true; im.renderOrder = 1;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(im);
  LS.mesh = im; LS.aA = aA;
}
// Laternen in ein Raster (neu, wenn sich die Liste ändert: gebaut, zerbrochen)
function lampGrid() {
  const L = STREET.lamps; if (LS.gridN === L.length && LS.grid) return LS.grid;
  const G = new Map(); for (const l of L) { const k = cellKey(Math.floor(l.x / CELL), Math.floor(l.z / CELL)); let a = G.get(k); if (!a) G.set(k, a = []); a.push(l); }
  LS.grid = G; LS.gridN = L.length; return G;
}
// V114: Zahl statt Text als Schlüssel (vorher neun neue Zeichenketten je Werfer und Bild)
const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const near = [null, null], nd = [0, 0];
function nearestLamps(G, x, z) {
  near[0] = near[1] = null; nd[0] = nd[1] = R2;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = G.get(cellKey(cx + i, cz + j)); if (!a) continue;
    for (const l of a) { const d = (l.x - x) ** 2 + (l.z - z) ** 2; if (d < 0.04) continue; if (d < nd[0]) { nd[1] = nd[0]; near[1] = near[0]; nd[0] = d; near[0] = l; } else if (d < nd[1]) { nd[1] = d; near[1] = l; } }
  }
}
function put(x, y, z, dx, dz, len, wid, a) {
  if (LS.n >= N || a < 0.02) return;
  _q.setFromAxisAngle(_Y, Math.atan2(dx, dz));
  LS.mesh.setMatrixAt(LS.n, _m.compose(_p.set(x, y + 0.015, z), _q, _s.set(wid, 1, len)));
  LS.aA.array[LS.n++] = Math.min(0.7, a);
}
// Ein Werfer (Fußpunkt x,y,z, Höhe h, Breite w): Schatten von den nächsten Laternen und von Scheinwerfern davor
function caster(G, x, y, z, h, w, cars, cn, self) {
  nearestLamps(G, x, z);
  for (let k = 0; k < 2; k++) {
    const l = near[k]; if (!l) continue;
    const d = Math.sqrt(nd[k]), lh = (l.y ?? 0.2) + (l.hs || 4.5) - y; if (lh < h + 0.3 || Math.abs((l.y ?? y) - y) > 1.5) continue;
    const len = Math.min(9, h * d / (lh - h) + w * 0.4), f = 1 - d / R;
    put(x, y, z, (x - l.x) / d, (z - l.z) / d, len, w * (1 + d * 0.06), 0.68 * f * f * (k ? 0.7 : 1));
  }
  for (let i = 0; i < cn; i++) {
    const c = cars[i]; if (c === self) continue;
    const fx = Math.cos(c._yaw), fz = -Math.sin(c._yaw), hx = c._x + fx * 2.4, hz = c._z + fz * 2.4;
    const ox = x - hx, oz = z - hz, d2 = ox * ox + oz * oz; if (d2 > 400 || d2 < 0.5) continue;
    const d = Math.sqrt(d2), cs = (ox * fx + oz * fz) / d; if (cs < 0.8) continue;
    put(x, y, z, ox / d, oz / d, Math.min(8, 1.5 + d * 0.45), w * 1.15, 0.5 * (1 - d / 20) * (cs - 0.8) * 5);
  }
}
/* ---------- V117: Kontaktschatten (Umgebungsverdeckung) unter Leuten und Wagen ----------
   Ein weicher, runder Fleck direkt unter den Füßen und ein länglicher unter jedem Wagen, unabhängig von Laternen:
   so stehen Figuren und Autos auch am Handy (ohne Mondschatten) fest auf dem Boden. Auch in Innenräumen. Ein Draw Call. */
const KN = MOBILE || LOW ? 36 : 80;
const KS = { mesh: null, aA: null, n: 0 };
function buildKontakt() {
  const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const aA = new T.InstancedBufferAttribute(new Float32Array(KN), 1); aA.setUsage(T.DynamicDrawUsage); g.setAttribute('aA', aA);
  const m = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.ZeroFactor, blendDst: T.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute float aA; varying vec2 vQ; varying float vA;
      void main(){ vQ = position.xz * 2.0; vA = aA; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vQ; varying float vA;
      void main(){ float r = length(vQ); float a = 1.0 - smoothstep(0.2, 1.0, r); gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * vA); }`,
  });
  const im = new T.InstancedMesh(g, m, KN); im.count = 0; im.frustumCulled = false; im.userData.noRefl = true; im.renderOrder = 1;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(im);
  KS.mesh = im; KS.aA = aA;
}
// Fleck: Mitte x,y,z, Richtung (dx,dz), Länge und Breite in Metern, Stärke a
function blob(x, y, z, dx, dz, len, wid, a) {
  if (KS.n >= KN) return;
  _q.setFromAxisAngle(_Y, Math.atan2(dx, dz));
  KS.mesh.setMatrixAt(KS.n, _m.compose(_p.set(x, y + 0.012, z), _q, _s.set(wid, 1, len)));
  KS.aA.array[KS.n++] = a;
}
function updateKontakt() {
  if (!KS.mesh) buildKontakt();
  KS.n = 0;
  const cp = camera.position;
  if (cp.y < 120) {
    if (!player.fly && !DRIVE.on && player.onGround !== false) blob(player.p.x, player.p.y, player.p.z, 0, 1, 0.95, 0.85, 0.55);
    let n = 0;
    for (const pd of pedsNear()) {
      const a = pd.a; if (!a || !a.on || !a.m || pd.rag) continue;
      const e = a.m.elements, x = e[12], y = e[13], z = e[14];
      if ((x - cp.x) ** 2 + (z - cp.z) ** 2 > 900) continue;
      if (++n > 48 || KS.n >= KN - 12) break;
      blob(x, y, z, 0, 1, 0.9, 0.8, 0.5);
    }
    // fahrende Wagen (Liste aus carlight.js, schon nach Nähe sortiert) und der eigene Wagen
    const cars = CARL.list || [], cn = CARL.cnt || 0;
    for (let i = 0; i < cn && KS.n < KN - 6; i++) {
      const c = cars[i]; if ((c._x - cp.x) ** 2 + (c._z - cp.z) ** 2 > 3600) continue;
      blob(c._x, c._y - 0.22, c._z, Math.cos(c._yaw), -Math.sin(c._yaw), 6.0, 2.6, 0.62);
    }
    // parkende Wagen in der Nähe (Länge entlang der lokalen x-Achse der Matrix)
    for (const c of parked) {
      if (KS.n >= KN || c.hidden) continue;
      if ((c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 3600) continue;
      const e = c.m.elements; blob(e[12], e[13] - 0.22, e[14], e[0], e[2], 6.0, 2.6, 0.62);
    }
  }
  KS.mesh.count = KS.n; KS.mesh.visible = KS.n > 0;
  if (KS.n) { KS.mesh.instanceMatrix.needsUpdate = true; KS.aA.needsUpdate = true; }
}
export function updateLichtschatten() {
  if (VERDECKUNG) updateKontakt();
  if (!LS.on) return;
  if (!LS.mesh) { if (!STREET.lamps.length) return; build(); }
  LS.n = 0;
  const cp = camera.position, off = cp.y > 80 || U.uInside.value > 0.5;
  if (!off) {
    const G = lampGrid(), cars = CARL.list || [], cn = CARL.cnt || 0;
    // Alexander zu Fuß
    if (!player.fly && !DRIVE.on && player.p.y < 40) caster(G, player.p.x, player.p.y, player.p.z, 1.85, 0.6, cars, cn, null);
    // Leute in der Nähe (höchstens 30)
    let n = 0;
    for (const pd of pedsNear()) {
      const a = pd.a; if (!a || !a.on || !a.m) continue;
      const e = a.m.elements, x = e[12], y = e[13], z = e[14];
      if ((x - cp.x) ** 2 + (z - cp.z) ** 2 > 1600 || y > 40) continue;
      if (++n > 30 || LS.n >= N - 3) break;
      caster(G, x, y, z, 1.75, 0.55, cars, cn, null);
    }
    // Wagen: Schatten von Laternen (breit, flach)
    for (let i = 0; i < cn && LS.n < N - 2; i++) {
      const c = cars[i]; if ((c._x - cp.x) ** 2 + (c._z - cp.z) ** 2 > 2500) continue;
      caster(G, c._x, c._y - 0.22, c._z, 1.55, 1.9, cars, 0, c);
    }
  }
  LS.mesh.count = LS.n; LS.mesh.visible = LS.n > 0;
  if (LS.n) { LS.mesh.instanceMatrix.needsUpdate = true; LS.aA.needsUpdate = true; }
}
