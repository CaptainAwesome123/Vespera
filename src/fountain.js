import { T, U, MOBILE, scene, mulberry32 } from './core.js';
import { addCollider } from './people-skeleton.js';
import { WATER_COMMON, poolWaterMat, fountainJet } from './water.js';

/* =====================================================================
   V27 · DER BRUNNEN AUF DEM BELMONT-PLATZ
   Art-Déco-Brunnen mit drei Schalen auf gestuftem Pfeiler, 16 Bogenstrahlen vom Beckenrand,
   einer hohen Mittelfontäne und Wasserschleiern, die über die Schalenränder fallen.
   - Wasserfläche: feines Polarnetz, Ringwellen vom Schleier und von jedem Aufschlagpunkt der
     Bogenstrahlen (gleiche Höhenformel im Vertex- und Fragment-Shader), Schaum und weißes Wasser
     an den Aufschlägen, Kaustik am Grund, Unterwasserlicht, Spiegelung von Himmel und Mond
   - Strahlen: Bänder entlang der echten Wurfparabel mit laufenden Schlieren
   - Tropfen, Spritzer und Gischt: Teilchen, deren Flug ganz im Shader aus der Zeit gerechnet wird
     (keine Rechenarbeit je Bild auf der CPU, auch nicht für hunderte Tropfen)
   - Sprühnebel: große weiche Schleier, die mit dem Wind treiben
   ===================================================================== */
export const FOUNT = { x: 0, z: 95, P: 0.26, R: 15, n: MOBILE ? 12 : 16, nozR: 14.15, landR: 6.2, ring: 4.25 };
const G = 9.81;
export const FOUNT_H = `
  uniform vec4 uFS[16]; uniform float uFRing; uniform float uFN;
  float fwH(vec2 q, float t){
    float d = abs(length(q) - uFRing);
    float h = 0.03 * sin(d * 8.0 - t * 5.2) * exp(-d * 0.32) + 0.012 * sin(length(q) * 3.1 - t * 2.3);
    for (int i = 0; i < 16; i++) {
      if (float(i) >= uFN) break;
      float di = length(q - uFS[i].xy);
      h += 0.028 * sin(di * 13.0 - t * 7.5 + uFS[i].z) * exp(-di * 0.55);
    }
    return h * smoothstep(${FOUNT.R.toFixed(1)}, ${(FOUNT.R - 1.5).toFixed(1)}, length(q));
  }`;
export function buildFountain(P = FOUNT.P) {
  const F = FOUNT, cx = F.x, cz = F.z, wy = P + 0.8, rnd = mulberry32(2727);
  F.P = P; F.wy = wy;
  const stone = new T.MeshStandardMaterial({ color: 0x6b5f62, roughness: 0.42, metalness: 0.15, side: T.DoubleSide });
  const dark = new T.MeshStandardMaterial({ color: 0x2b2a33, roughness: 0.3, metalness: 0.3 });
  const gold = new T.MeshStandardMaterial({ color: 0xc9a25a, metalness: 0.92, roughness: 0.28, emissive: 0x281805, side: T.DoubleSide });
  const at = (m, y = 0) => { m.position.set(cx, P + y, cz); scene.add(m); return m; };
  const lathe = (pts, seg = 64) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), seg);
  // Becken: gestufte Außenwand mit Profil, Goldkante, innen dunkler Fliesengrund
  at(new T.Mesh(lathe([[15.9, 0], [15.9, 0.18], [15.55, 0.22], [15.55, 0.85], [15.75, 0.9], [15.75, 1.08], [15.1, 1.12], [15.0, 0.6], [14.9, 0.3]], 96), stone));
  const rim = at(new T.Mesh(new T.TorusGeometry(15.42, 0.12, 8, 96), gold), 1.12); rim.rotation.x = Math.PI / 2;
  const floor = at(new T.Mesh(new T.CircleGeometry(15, 48), dark), 0.3); floor.rotation.x = -Math.PI / 2;
  // Pfeiler mit Stufen und drei Schalen (Profil von unten nach oben)
  at(new T.Mesh(lathe([[1.5, 0.3], [1.5, 0.9], [1.25, 1.0], [1.05, 1.1], [0.95, 2.1], [1.2, 2.25], [0.0, 2.3]], 48), stone));
  const bowls = [[4.0, 2.6, 0.55], [2.6, 4.4, 0.45], [1.5, 6.0, 0.35]];
  let lastTop = 2.3;
  for (const [r, y, d] of bowls) {
    // Stiel bis unter die Schale, dann die Schale mit dicker Lippe und Goldkante
    at(new T.Mesh(lathe([[0.62, lastTop], [0.48, lastTop + 0.25], [0.4, y - d - 0.3], [0.55, y - d - 0.12], [0.0, y - d - 0.1]], 32), stone));
    at(new T.Mesh(lathe([[0.0, y - d - 0.12], [0.6, y - d - 0.12], [r * 0.7, y - d * 0.45], [r - 0.05, y - 0.06], [r + 0.08, y + 0.02], [r + 0.08, y + 0.1], [r - 0.12, y + 0.1], [r - 0.2, y - 0.05], [r * 0.6, y - d * 0.55], [0.0, y - d * 0.6]], 64), stone));
    const t = at(new T.Mesh(new T.TorusGeometry(r + 0.06, 0.05, 6, 64), gold), y + 0.1); t.rotation.x = Math.PI / 2;
    const w = at(new T.Mesh(new T.CircleGeometry(r - 0.16, 40), poolWaterMat([0.05, 0.36, 0.4])), y + 0.04); w.rotation.x = -Math.PI / 2;
    lastTop = y;
  }
  // Spitze: kannelierte Düse mit Goldkugel
  at(new T.Mesh(lathe([[0.3, 6.04], [0.22, 6.2], [0.12, 6.36], [0.07, 6.42], [0.0, 6.42]], 24), gold));
  // Düsen am Rand: goldene Wasserspeier, zur Mitte geneigt
  const nozGeo = new T.ConeGeometry(0.12, 0.42, 10).rotateZ(Math.PI / 2 - 0.6);   // Spitze nach -x und schräg nach oben
  const noz = new T.InstancedMesh(nozGeo, gold, F.n), mm = new T.Matrix4(), q = new T.Quaternion(), up = new T.Vector3(0, 1, 0);
  const jets = [];
  for (let i = 0; i < F.n; i++) {
    const a = (i + 0.5) / F.n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    q.setFromAxisAngle(up, -a); mm.compose(new T.Vector3(cx + ca * F.nozR, P + 1.2, cz + sa * F.nozR), q, new T.Vector3(1, 1, 1)); noz.setMatrixAt(i, mm);
    jets.push({ a, x0: ca * F.nozR, z0: sa * F.nozR, x1: ca * F.landR, z1: sa * F.landR });
  }
  scene.add(noz);
  // V33: Kollision als runde Scheibe aus schmalen Streifen statt eines Quadrats von 32 x 32 m:
  // vorher standen in den vier Ecken neben dem runden Becken unsichtbare Wände
  for (let z0 = -15.9; z0 < 15.9 - 1e-6; z0 += 0.8) {
    const z1 = Math.min(15.9, z0 + 0.8), zm = Math.max(Math.abs(z0), Math.abs(z1)), hw = Math.sqrt(Math.max(0, 15.9 * 15.9 - zm * zm));
    if (hw > 0.05) addCollider(cx - hw, 0, cz + z0, cx + hw, P + 1.12, cz + z1);
  }
  // Wasserfläche
  U.uFS = { value: Array.from({ length: 16 }, () => new T.Vector4()) }; U.uFRing = { value: F.ring }; U.uFN = { value: F.n };
  jets.forEach((j, i) => U.uFS.value[i].set(j.x1, j.z1, rnd() * 6.28, 0));
  const wgeo = new T.RingGeometry(0.9, F.R, MOBILE ? 72 : 120, MOBILE ? 28 : 46).rotateX(-Math.PI / 2);
  const water = at(new T.Mesh(wgeo, fountainWaterMat()), 0.8);
  water.userData.noRefl = true;
  // Bogenstrahlen: Düse -> Aufschlag in T Sekunden (Wurfparabel), dazu Bänder mit laufenden Schlieren
  const Tf = 1.15, y0 = 1.2, y1 = 0.8;
  const jetMat = jetStreakMat();
  const arcs = [];
  for (const j of jets) {
    const vx = (j.x1 - j.x0) / Tf, vz = (j.z1 - j.z0) / Tf, vy = (y1 - y0 + 0.5 * G * Tf * Tf) / Tf;
    j.v = [vx, vy, vz];
    const pts = []; for (let k = 0; k <= 16; k++) { const t = k / 16 * Tf; pts.push(new T.Vector3(cx + j.x0 + vx * t, P + y0 + vy * t - 0.5 * G * t * t, cz + j.z0 + vz * t)); }
    arcs.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 32, 0.05, 6, false));
  }
  const arcMesh = new T.Mesh(mergeArcs(arcs), jetMat); arcMesh.renderOrder = 3; scene.add(arcMesh);
  // Mittelfontäne und Schleier über die Schalenränder
  fountainJet(cx, P + 6.42, cz, 5.4, 0.55);
  const curtains = [];
  bowls.forEach(([r, y], i) => {
    // jede Schale läuft in die nächst untere über, die unterste ins Becken
    const fall = y - (i === 0 ? 0.8 : bowls[i - 1][1] + 0.04);
    const pts = []; for (let k = 0; k <= 10; k++) { const d = fall * k / 10; pts.push(new T.Vector2(r + 0.1 + 0.55 * Math.sqrt(2 * d / G), y + 0.1 - d)); }
    curtains.push(new T.LatheGeometry(pts.reverse(), 64).translate(cx, P, cz));
  });
  const cm = new T.Mesh(mergeArcs(curtains), curtainMat()); cm.renderOrder = 3; scene.add(cm);
  // Tropfen und Spritzer
  const drops = [];
  const D = (p, v, period, floorY, size, c = 0) => drops.push([p, v, period, rnd(), floorY, size, c]);
  const nArc = MOBILE ? 18 : 34;
  for (const j of jets) for (let k = 0; k < nArc; k++) {
    const s = 1 + (rnd() - 0.5) * 0.06, lat = (rnd() - 0.5) * 0.25;
    D([j.x0, y0, j.z0], [j.v[0] * s - Math.sin(j.a) * lat, j.v[1] * (1 + (rnd() - 0.5) * 0.05), j.v[2] * s + Math.cos(j.a) * lat], Tf * 1.25, y1, 0.05 + rnd() * 0.04);
  }
  const nUp = MOBILE ? 120 : 260;
  for (let k = 0; k < nUp; k++) {
    const a = rnd() * 6.283, vh = 0.15 + rnd() * 0.85, vy = 9.6 + rnd() * 1.2, tFall = (vy + Math.sqrt(vy * vy + 2 * G * 0.4)) / G;
    const r = vh * tFall, floorY = r < 1.4 ? 6.04 : r < 2.5 ? 4.44 : 2.64;
    D([0, 6.42, 0], [Math.cos(a) * vh, vy, Math.sin(a) * vh], 2.6, floorY, 0.05 + rnd() * 0.05, 1);
  }
  // Spritzer an den Aufschlägen, am Fallring und in den Schalen: kurze, niedrige Sprünge
  const splash = (x, y, z, n, h) => { for (let k = 0; k < n; k++) { const a = rnd() * 6.283, s = 0.4 + rnd() * 1.2; D([x + (rnd() - 0.5) * 0.3, y, z + (rnd() - 0.5) * 0.3], [Math.cos(a) * s, h * (0.6 + rnd() * 0.6), Math.sin(a) * s], 0.45 + rnd() * 0.4, y - 0.02, 0.035 + rnd() * 0.035, 2); } };
  for (const j of jets) splash(j.x1, y1, j.z1, MOBILE ? 8 : 16, 2.4);
  for (let k = 0; k < (MOBILE ? 40 : 90); k++) { const a = rnd() * 6.283; splash(Math.cos(a) * (F.ring + 0.1), y1, Math.sin(a) * (F.ring + 0.1), 1, 1.8); }
  for (const [r, y] of bowls.slice(1)) for (let k = 0; k < (MOBILE ? 12 : 26); k++) { const a = rnd() * 6.283, rr = rnd() * (r - 0.3); splash(Math.cos(a) * rr, y + 0.05, Math.sin(a) * rr, 1, 1.4); }
  scene.add(dropPoints(drops, cx, P, cz));
  // Sprühnebel
  const mist = [];
  for (let k = 0; k < (MOBILE ? 22 : 48); k++) {
    const a = rnd() * 6.283, ring = rnd() < 0.6 ? F.landR + (rnd() - 0.5) * 1.5 : rnd() * 4.5;
    mist.push([Math.cos(a) * ring, y1 + 0.2 + rnd() * 0.6, Math.sin(a) * ring, rnd(), 1.6 + rnd() * 2.2]);
  }
  scene.add(mistPoints(mist, cx, P, cz));
  return F;
}
function mergeArcs(list) {
  let n = 0, ni = 0; for (const g of list) { n += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); const I = g.index.array; for (let i = 0; i < I.length; i++) idx[oi + i] = I[i] + o; o += g.attributes.position.count; oi += I.length; }
  const m = new T.BufferGeometry(); m.setAttribute('position', new T.BufferAttribute(pos, 3)); m.setAttribute('normal', new T.BufferAttribute(nor, 3)); m.setAttribute('uv', new T.BufferAttribute(uv, 2)); m.setIndex(new T.BufferAttribute(idx, 1));
  return m;
}
export function fountainWaterMat() {
  return new T.ShaderMaterial({
    uniforms: U,
    vertexShader: `uniform float uTime; ${FOUNT_H}
      varying vec3 vW; varying vec2 vQ; varying float vD;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vQ = w.xz - vec2(${FOUNT.x.toFixed(1)}, ${FOUNT.z.toFixed(1)});
        w.y += fwH(vQ, uTime);
        vW = w.xyz; vec4 mv = viewMatrix * w; vD = length(mv.xyz); gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir; uniform vec3 uCam; uniform vec3 uTeal;
      varying vec3 vW; varying vec2 vQ; varying float vD;
      ${WATER_COMMON}
      ${FOUNT_H}
      void main(){
        vec2 q = vQ; float t = uTime, e = 0.04;
        float h0 = fwH(q, t);
        vec2 g = vec2(fwH(q + vec2(e, 0.0), t) - h0, fwH(q + vec2(0.0, e), t) - h0) / e;
        g += waveGrad(q * 4.0, t * 1.6, 1.0) * 0.05;
        // weißes Wasser und Schaum an den Aufschlägen und am Fallring
        float foam = 0.0, r = length(q);
        for (int i = 0; i < 16; i++) { if (float(i) >= uFN) break; float di = length(q - uFS[i].xy); foam += exp(-di * di * 3.0) * (0.6 + 0.4 * wN(q * 7.0 + t * 3.0 + float(i))); g += (q - uFS[i].xy) / max(di, 0.05) * exp(-di * 2.0) * 0.25 * sin(t * 13.0 + float(i) * 2.1); }
        float dr = abs(r - uFRing);
        foam += exp(-dr * dr * 6.0) * (0.55 + 0.45 * wN(vec2(atan(q.y, q.x) * 9.0, r * 3.0 - t * 2.0)));
        foam += smoothstep(0.45, 0.85, wN(q * 2.5 + vec2(t * 0.3, -t * 0.2))) * exp(-dr * 0.6) * 0.35;
        foam = clamp(foam, 0.0, 1.0) * (0.75 + 0.25 * wN(q * 18.0 - t));
        vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(uCam - vW);
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // Grund mit Kaustik und Unterwasserlicht (türkis am Rand, warm unter der Mitte)
        vec2 cq = q * 1.4 + g * 0.8;
        float c1 = abs(wN(cq + t * 0.5) - 0.5), c2 = abs(wN(cq * 1.7 - t * 0.37 + 3.0) - 0.5);
        float caus = pow(1.0 - min(c1, c2) * 2.0, 7.0);
        vec3 under = mix(vec3(0.02, 0.2, 0.24), vec3(0.32, 0.22, 0.1), exp(-r * 0.25)) * (0.55 + 0.55 * caus);
        under += uTeal * 0.25 * smoothstep(11.0, 14.5, r) * (0.6 + 0.4 * caus);
        vec3 col = mix(under, skyRefl(reflect(-V, N), uFogColor, uMoonDir) * 1.6, clamp(fres * 1.1, 0.0, 0.95));
        col += vec3(1.0, 0.75, 0.45) * pow(max(dot(reflect(-V, N), normalize(vec3(0.0, 0.35, 1.0))), 0.0), 60.0) * 0.25;   // Platzlaternen glänzen
        col = mix(col, vec3(0.55, 0.68, 0.7) + uTeal * 0.12, foam * 0.75);
        float fogF = vespFog(vD, vW.y, uCam.y, uFogDensity, 0.8);
        gl_FragColor = vec4(mix(col, uFogColor, fogF), 1.0);
      }`,
  });
}
// Strahl als Band: Schlieren laufen die Parabel entlang, zum Ende hin zerfällt er in Tropfen
export function jetStreakMat() {
  return new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCam: U.uCam }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCam; varying vec2 vUv; varying vec3 vN, vW;
      float h1(float x){ return fract(sin(x * 91.3) * 437.5); }
      void main(){
        float s = vUv.x, ang = vUv.y * 6.0;
        float lane = floor(ang * 2.0), flow = fract(s * 7.0 - uTime * 3.2 + h1(lane) * 3.0);
        float streak = 0.45 + 0.55 * smoothstep(0.0, 0.3, flow) * smoothstep(1.0, 0.55, flow);
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(uCam - vW))), 1.5);
        float breakup = 1.0 - smoothstep(0.55, 1.0, s) * step(0.5, fract(s * 23.0 - uTime * 4.0 + h1(lane)));
        float a = (0.18 + 0.5 * rim) * streak * breakup * (1.0 - smoothstep(0.92, 1.0, s));
        gl_FragColor = vec4(vec3(0.6, 0.85, 0.9) * a, 1.0);
      }`,
  });
}
// Schleier über den Schalenrand: dünner, nach unten laufender Wasservorhang
export function curtainMat() {
  return new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCam: U.uCam }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec2 vUv; varying vec3 vN, vW; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCam; varying vec2 vUv; varying vec3 vN, vW;
      float h1(float x){ return fract(sin(x * 91.3) * 437.5); }
      void main(){
        float col = floor(vUv.x * 160.0), s = fract(vUv.y * 2.5 + uTime * (1.8 + 0.6 * h1(col)) + h1(col + 3.0));
        float streak = 0.35 + 0.65 * smoothstep(0.0, 0.25, s) * smoothstep(1.0, 0.5, s) * (0.5 + 0.5 * h1(col + 7.0));
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(uCam - vW))), 2.0);
        float a = streak * (0.1 + 0.35 * rim) * smoothstep(0.0, 0.15, vUv.y) * (0.7 + 0.3 * vUv.y);
        gl_FragColor = vec4(vec3(0.55, 0.82, 0.88) * a, 1.0);
      }`,
  });
}
// Teilchen mit fester Flugbahn: p(t) = p0 + v t - g t²/2, wiederholt mit eigener Periode; unter dem Boden unsichtbar
function dropPoints(list, cx, P, cz) {
  const n = list.length, p0 = new Float32Array(n * 3), v = new Float32Array(n * 3), tp = new Float32Array(n * 4);
  list.forEach(([p, vel, per, ph, fl, size, kind], i) => { p0.set([p[0], p[1], p[2]], i * 3); v.set(vel, i * 3); tp.set([per, ph, fl, size + kind * 0.0001], i * 4); });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(p0, 3)); g.setAttribute('aV', new T.BufferAttribute(v, 3)); g.setAttribute('aT', new T.BufferAttribute(tp, 4));
  const pts = new T.Points(g, new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: U.uScale, uWind: U.uWind }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec3 aV; attribute vec4 aT; uniform float uTime; uniform float uScale; uniform vec4 uWind; varying float vA;
      void main(){
        float age = mod(uTime + aT.y * aT.x, aT.x);
        vec3 p = position + aV * age + vec3(0.0, -4.905 * age * age, 0.0);
        p.xz += uWind.xy * uWind.z * 0.012 * age * age;
        vA = step(aT.z, p.y) * smoothstep(0.0, 0.05, age);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        vA *= smoothstep(140.0, 30.0, d);
        gl_PointSize = clamp(aT.w * uScale / max(d, 0.1), 1.0, 22.0) * vA;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; if (r > 1.0) discard;
        float hl = smoothstep(0.5, 0.0, length(c - vec2(-0.12, -0.12)) * 2.0);
        gl_FragColor = vec4((vec3(0.45, 0.7, 0.75) * (1.0 - r) + vec3(0.9, 0.85, 0.7) * hl * 0.6) * vA * 0.9, 1.0); }`,
  }));
  pts.position.set(cx, P, cz); pts.frustumCulled = false; pts.renderOrder = 4;
  return pts;
}
function mistPoints(list, cx, P, cz) {
  const n = list.length, pos = new Float32Array(n * 3), ph = new Float32Array(n * 2);
  list.forEach(([x, y, z, p, s], i) => { pos.set([x, y, z], i * 3); ph.set([p, s], i * 2); });
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aP', new T.BufferAttribute(ph, 2));
  const pts = new T.Points(g, new T.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: U.uScale, uWind: U.uWind, uTeal: U.uTeal }, transparent: true, depthWrite: false,
    vertexShader: `attribute vec2 aP; uniform float uTime; uniform float uScale; uniform vec4 uWind; varying float vA;
      void main(){
        float life = fract(uTime * 0.12 + aP.x);
        vec3 p = position + vec3(uWind.x, 0.0, uWind.y) * uWind.z * 0.35 * life + vec3(sin(aP.x * 40.0 + uTime * 0.4), life * 1.6, cos(aP.x * 30.0 + uTime * 0.3)) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        vA = sin(life * 3.14159) * smoothstep(90.0, 20.0, d) * smoothstep(0.5, 3.0, d);
        gl_PointSize = clamp(aP.y * (0.7 + life * 0.8) * uScale / max(d, 0.1), 2.0, 260.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uTeal; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; if (r > 1.0) discard; gl_FragColor = vec4(mix(vec3(0.6, 0.75, 0.78), uTeal, 0.3), (1.0 - r) * (1.0 - r) * vA * 0.13); }`,
  }));
  pts.position.set(cx, P, cz); pts.frustumCulled = false; pts.renderOrder = 5;
  return pts;
}
