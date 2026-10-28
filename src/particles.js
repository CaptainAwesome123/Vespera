'use strict';
/* =====================================================================
   V16 · PARTIKEL: Rauch, Reifenqualm, Staub, Gischt (weich, normal gemischt)
   und Funken, Glut, Spritzer (leuchtend, additiv); Reifenspuren auf dem Pflaster
   ===================================================================== */
const FX = { sets: {}, skid: null, t: 0 };
function fxSet(name, max, additive) {
  const g = new T.BufferGeometry();
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 4), sz = new Float32Array(max);
  g.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
  g.setAttribute('aCol', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
  g.setAttribute('aSize', new T.BufferAttribute(sz, 1).setUsage(T.DynamicDrawUsage));
  const mat = new T.ShaderMaterial({
    uniforms: { uScale: { value: 600 }, uTime: U.uTime },
    vertexShader: `attribute vec4 aCol; attribute float aSize; uniform float uScale; varying vec4 vC; varying float vR;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; vC = aCol;
        vR = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
        gl_PointSize = clamp(aSize * uScale / max(0.5, -mv.z), 0.0, 380.0); }`,
    fragmentShader: additive
      ? `varying vec4 vC; varying float vR; void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC.rgb * (a * a * 2.2), vC.a * a); }`
      : `varying vec4 vC; varying float vR; void main(){ vec2 p = gl_PointCoord - 0.5; float r = length(p);
          // weiche, ballige Wolke mit etwas Struktur
          float n = sin((p.x + vR) * 13.0) * sin((p.y - vR) * 11.0) * 0.12;
          float a = smoothstep(0.5, 0.08, r + n); if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending,
  });
  const pts = new T.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 4; pts.userData.noRefl = true; scene.add(pts);
  const P = { pts, max, n: 0, life: new Float32Array(max), age: new Float32Array(max), vel: new Float32Array(max * 3), c0: new Float32Array(max * 4), s0: new Float32Array(max * 2), grav: new Float32Array(max), drag: new Float32Array(max), next: 0 };
  FX.sets[name] = P;
  return P;
}
// kind: smoke (grau, wächst), steam (weiß), dust (braun), spray (Gischt), spark (Funken), ember
const FX_KIND = {
  smoke: { set: 'soft', col: [0.16, 0.16, 0.17, 0.55], s: [0.7, 4.2], life: [2.5, 4.2], grav: -0.6, drag: 0.6 },
  black: { set: 'soft', col: [0.04, 0.04, 0.045, 0.75], s: [0.9, 5.0], life: [3.0, 5.0], grav: -1.0, drag: 0.5 },
  tire: { set: 'soft', col: [0.55, 0.56, 0.58, 0.32], s: [0.6, 3.6], life: [1.4, 2.4], grav: -0.25, drag: 1.4 },
  dust: { set: 'soft', col: [0.32, 0.27, 0.2, 0.35], s: [0.5, 3.0], life: [1.2, 2.2], grav: -0.15, drag: 1.6 },
  steam: { set: 'soft', col: [0.75, 0.76, 0.78, 0.3], s: [0.5, 2.6], life: [1.5, 2.6], grav: -0.9, drag: 0.8 },
  spray: { set: 'soft', col: [0.78, 0.86, 0.9, 0.55], s: [0.25, 1.3], life: [0.7, 1.3], grav: 9.0, drag: 0.4 },
  foam: { set: 'soft', col: [0.82, 0.88, 0.92, 0.4], s: [0.5, 1.6], life: [1.2, 2.2], grav: 0, drag: 2.5 },
  spark: { set: 'glow', col: [2.4, 1.3, 0.4, 1], s: [0.09, 0.03], life: [0.35, 0.8], grav: 9.8, drag: 0.3 },
  ember: { set: 'glow', col: [2.0, 0.7, 0.15, 1], s: [0.12, 0.05], life: [0.8, 1.6], grav: -0.8, drag: 0.8 },
  glass: { set: 'glow', col: [0.6, 0.75, 0.8, 0.8], s: [0.06, 0.05], life: [0.5, 0.9], grav: 9.8, drag: 0.2 },
};
function buildFX() {
  fxSet('soft', MOBILE ? 500 : 1400, false);
  fxSet('glow', MOBILE ? 250 : 600, true);
  buildSkids();
}
function fxEmit(kind, x, y, z, vx = 0, vy = 0, vz = 0, n = 1, spread = 0.5, sizeK = 1) {
  const K = FX_KIND[kind], P = FX.sets[K.set]; if (!P) return;
  for (let k = 0; k < n; k++) {
    const i = P.next; P.next = (P.next + 1) % P.max; if (P.n < P.max) P.n++;
    const L = K.life[0] + Math.random() * (K.life[1] - K.life[0]);
    P.life[i] = L; P.age[i] = 0;
    const a = P.pts.geometry.attributes.position.array;
    a[i * 3] = x + (Math.random() - 0.5) * spread * 0.4; a[i * 3 + 1] = y; a[i * 3 + 2] = z + (Math.random() - 0.5) * spread * 0.4;
    P.vel[i * 3] = vx + (Math.random() - 0.5) * spread * 2; P.vel[i * 3 + 1] = vy + Math.random() * spread; P.vel[i * 3 + 2] = vz + (Math.random() - 0.5) * spread * 2;
    P.c0.set(K.col, i * 4); P.s0[i * 2] = K.s[0] * sizeK; P.s0[i * 2 + 1] = K.s[1] * sizeK; P.grav[i] = K.grav; P.drag[i] = K.drag;
  }
}
function updateFX(dt) {
  const wind = U.uWind ? U.uWind.value : null, wx = wind ? wind.x * wind.z * 0.5 : 0, wz = wind ? wind.y * wind.z * 0.5 : 0;
  const scale = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  for (const name in FX.sets) {
    const P = FX.sets[name], g = P.pts.geometry, a = g.attributes.position.array, c = g.attributes.aCol.array, s = g.attributes.aSize.array;
    P.pts.material.uniforms.uScale.value = scale;
    let live = 0;
    for (let i = 0; i < P.max; i++) {
      if (P.life[i] <= 0) { c[i * 4 + 3] = 0; s[i] = 0; continue; }
      const t = (P.age[i] += dt) / P.life[i];
      if (t >= 1) { P.life[i] = 0; c[i * 4 + 3] = 0; s[i] = 0; continue; }
      live++;
      const d = Math.exp(-P.drag[i] * dt), soft = name === 'soft';
      P.vel[i * 3] = P.vel[i * 3] * d + (soft ? wx * (1 - d) : 0); P.vel[i * 3 + 2] = P.vel[i * 3 + 2] * d + (soft ? wz * (1 - d) : 0);
      P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * d - P.grav[i] * dt;
      a[i * 3] += P.vel[i * 3] * dt; a[i * 3 + 1] += P.vel[i * 3 + 1] * dt; a[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      // Funken springen vom Boden ab
      if (!soft && a[i * 3 + 1] < 0.03 && P.vel[i * 3 + 1] < 0) { a[i * 3 + 1] = 0.03; P.vel[i * 3 + 1] *= -0.35; }
      const fade = soft ? Math.min(1, t * 6) * (1 - t) * (1 - t) : 1 - t * t;
      c[i * 4] = P.c0[i * 4] * (soft ? 1 : 1 - t * 0.5); c[i * 4 + 1] = P.c0[i * 4 + 1] * (soft ? 1 : 1 - t * 0.8); c[i * 4 + 2] = P.c0[i * 4 + 2] * (soft ? 1 : 1 - t); c[i * 4 + 3] = P.c0[i * 4 + 3] * fade;
      s[i] = P.s0[i * 2] + (P.s0[i * 2 + 1] - P.s0[i * 2]) * Math.sqrt(t);
    }
    P.pts.visible = live > 0;
    if (live || P.wasLive) { g.attributes.position.needsUpdate = g.attributes.aCol.needsUpdate = g.attributes.aSize.needsUpdate = true; }
    P.wasLive = live > 0;
  }
  updateSkids(dt);
}
/* ---------- Reifenspuren: schmale dunkle Streifen, Ringpuffer ---------- */
function buildSkids() {
  const N = MOBILE ? 400 : 1200;
  const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new T.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const im = new T.InstancedMesh(g, m, N); im.count = 0; im.frustumCulled = false; im.userData.noRefl = true; im.renderOrder = 1;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(im);
  FX.skid = { im, N, next: 0, dirty: false };
}
const _sk = new T.Matrix4(), _skq = new T.Quaternion(), _skp = new T.Vector3(), _sks = new T.Vector3(), _skY = new T.Vector3(0, 1, 0);
// eine Spur von (x0,z0) nach (x1,z1) in Höhe y, Breite w
function skidMark(x0, z0, x1, z1, y, w = 0.2) {
  const S = FX.skid; if (!S) return;
  const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05 || L > 3) return;
  _skq.setFromAxisAngle(_skY, Math.atan2(-dz, dx));
  _sk.compose(_skp.set((x0 + x1) / 2, y + 0.015, (z0 + z1) / 2), _skq, _sks.set(L + 0.04, 1, w));
  S.im.setMatrixAt(S.next, _sk); S.next = (S.next + 1) % S.N; S.im.count = Math.max(S.im.count, S.next === 0 ? S.N : S.next); S.dirty = true;
}
function updateSkids() { const S = FX.skid; if (S && S.dirty) { S.im.instanceMatrix.needsUpdate = true; S.dirty = false; } }
