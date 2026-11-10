/* =====================================================================
   V44 · LANDSCHAFT UM DEN KRATER
   Die Stadt liegt im Meteoritenkrater; ringsum der See, dann die Felswand und die Berge der Polarnacht. Hier:
   - planLandscape(): Uferlinie je Richtung, zwei Gletschertäler, die Wasserfälle mit ihren Bachbetten; gräbt Bach und
     Täler über LAND_HOOK ins Gelände (harbour.js terrainHeightRaw), damit Netz, Physik und Bootsufer dasselbe sehen.
   - buildLandscape(): feines Klippennetz (Ring um den See, 3 m in der Wand statt 30 m), Ausschnitt dafür im groben
     Geländenetz, Wasserfälle (Bahn an der Felswand, Bach oben, Gischt, Schaum, Eiszapfen, gefrorene Gischt), Eissaum
     am Felsfuß, Packeis vor den Gletschern, Eisschollen, Schären, Treibeis. Shader klein (ein Rauschen, Nebel).
   Der Meteoritenkristall bleibt im Penthouse (Kanon), hier draußen gibt es ihn nicht.
   ===================================================================== */
import { T, scene, U, MOBILE, LOW, mergeGeos, mulberry32, snowy, FOG_GLSL } from './core.js';
import { TER, terrainInfo, terrainHeight, terrainHeightRaw, VILLA, LAND_HOOK, VIA } from './harbour.js';
import { WATER_Y } from './dance.js';
import { SERP, serpSink, MOUNT, sstep } from './serpentine.js';
import { stdMat } from './people-skeleton.js';
import { landDist } from './island.js';

export const LAND = { NA: MOBILE ? 540 : 1080, shore: null, falls: [], glaciers: [], ready: false, mats: {}, stats: {}, planHooks: [] };   // V78: planHooks laufen am Ende von planLandscape (krater.js ebnet sein Lager)
const Z0 = 100;   // der Krater ist um 100 m nach Norden versetzt (terrainInfo: z + 100)
// Punkt in Richtung ang (0 = Norden, wie terrainInfo) im Quadrat-Abstand m (met = max(|x|, |z+100|))
export function landRay(ang, m) { const dx = Math.sin(ang), dz = -Math.cos(ang), k = m / Math.max(Math.abs(dx), Math.abs(dz)); return [dx * k, dz * k - Z0]; }
export const landAng = (x, z) => Math.atan2(x, -(z + Z0));
export const landMet = (x, z) => Math.max(Math.abs(x), Math.abs(z + Z0));
const wrap = a => a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;
// Uferabstand (met) in Richtung ang, linear zwischen den Stützwinkeln
export function shoreAt(ang) {
  const S = LAND.shore, n = LAND.NA, f = ((ang / (2 * Math.PI)) % 1 + 1) % 1 * n, i = Math.floor(f), t = f - i;
  return S[i % n] * (1 - t) + S[(i + 1) % n] * t;
}
function inSerp(x, z, m = 60) { const P = SERP.patch; return !!P && x > P.x0 - m && x < P.x1 + m && z > P.z0 - m && z < P.z1 + m; }
const nearViaduct = (x, z, m = 40) => Math.abs(x) < m && z < -940;

/* ---------- Planung ---------- */
export function planLandscape() {
  if (LAND.ready) return;
  const rnd = mulberry32(4444), NA = LAND.NA;
  // 1) Uferlinie: je Richtung der erste Punkt, an dem das Gelände aus dem See steigt
  const S = LAND.shore = new Float32Array(NA);
  for (let i = 0; i < NA; i++) {
    const ang = i / NA * Math.PI * 2;
    let m = 980;
    for (; m < 3200; m += 6) { const [x, z] = landRay(ang, m); if (terrainHeightRaw(x, z) > WATER_Y + 1.0) break; }
    for (let k = 0; k < 6; k++) { const [x, z] = landRay(ang, m - 1); if (terrainHeightRaw(x, z) > WATER_Y + 1.0) m -= 1; else break; }
    S[i] = m;
  }
  // 2) Gletscher: zwei Täler im Westen und Nordwesten (im Osten liegen Villa und Serpentine)
  for (const [ang, wk] of [[-0.46, 1.0], [-1.22, 1.35]]) {
    const mS = shoreAt(ang); LAND.glaciers.push({ ang, wk, mShore: mS });
  }
  LAND.glaciers.forEach((G, k) => U.uGlacier.value[k].set(G.ang, G.wk, G.mShore, 1));
  // 3) Wasserfälle: Lippe = höchster Punkt der Wand bis 90 m hinter dem Ufer; nicht am Viadukt, nicht an Gletschern, Villa, Serpentine
  const N = 14;
  for (let k = 0; k < N; k++) {
    const ang = -Math.PI * 0.74 + (k + 0.5) / N * Math.PI * 1.48 + (rnd() - 0.5) * 0.1;
    if (Math.abs(ang) < 0.15) continue;
    if (LAND.glaciers.some(G => Math.abs(wrap(ang - G.ang)) < 0.1 * G.wk + 0.04)) continue;
    const mS = shoreAt(ang);
    // Lippe = Oberkante der Felswand: höchster Punkt in den ersten 60 m hinter dem Ufer (die Wand ist 38-52 m breit)
    let top = -1e9, mLip = mS;
    for (let d = 6; d <= 60; d += 2) { const [x, z] = landRay(ang, mS + d); const h = terrainHeightRaw(x, z); if (h > top && h < 200) { top = h; mLip = mS + d; } }
    if (top < 38) continue;
    const [lx, lz] = landRay(ang, mLip);
    if (VILLA.y && Math.hypot(lx - VILLA.x, lz - VILLA.z) < VILLA.r + 160) continue;
    if (inSerp(lx, lz, 90) || nearViaduct(lx, lz, 90)) continue;
    const dx = Math.sin(ang), dz = -Math.cos(ang);   // bergwärts (vom Krater weg)
    const big = k === 4 || k === 10;
    const w = big ? 22 + rnd() * 8 : 8 + rnd() * 11, ph = rnd() * 6.28, ph2 = rnd() * 6.28, amp = 8 + rnd() * 8;
    const F = { ang, mShore: mS, mLip, lipX: lx, lipZ: lz, top, w, big, dx, dz, px: dz, pz: -dx, wig: u => amp * Math.sin(u * 0.022 + ph) + 5 * Math.sin(u * 0.057 + ph2), B: null };
    // Bettsohle B(u) alle 5 m bergauf: das niedrigste Gelände quer zur Rinne (±1,25 Rinnenbreite), dann mit den Nachbarn
    // erodiert (Minimum): so liegt das ungegrabene Ufer überall höher als der Wasserspiegel B − 1 und der Bach bleibt im Bett
    const NB = 56, raw = new Float32Array(NB);
    for (let i = 0; i < NB; i++) {
      const u = i * 5, off = F.wig(u), cx = lx + dx * u + F.px * off, cz = lz + dz * u + F.pz * off, wc = w * 0.9 + 0.03 * u;
      let mn = 1e9; for (let v = -1.25; v <= 1.25; v += 0.25) mn = Math.min(mn, terrainHeightRaw(cx + F.px * v * wc, cz + F.pz * v * wc)); raw[i] = mn;
    }
    F.B = new Float32Array(NB); for (let i = 0; i < NB; i++) F.B[i] = Math.min(raw[i], raw[Math.max(0, i - 1)], raw[Math.min(NB - 1, i + 1)]);
    for (let i = 1; i < NB; i++) F.B[i] = Math.max(F.B[i], F.B[i - 1] + 0.3);   // Wasser fließt nur abwärts: Sohle bergauf nie tiefer (mind. 6 % Gefälle); wo das Ufer dann zu tief läge, hebt landCarve es an
    LAND.falls.push(F);
  }
  LAND.ready = true;
  LAND_HOOK.carve = landCarve;
  LAND_HOOK.avoid = landAvoid;
  for (const f of LAND.planHooks) try { f(); } catch (e) { console.warn('Landschaft:', e); }
}
// Bachbett (Parabelrinne, bis 270 m bergauf, mäandernd) und Gletschertal (breite Mulde) ins Gelände graben
export function landCarve(wx, wz, h) {
  const ang = landAng(wx, wz);
  for (const G of LAND.glaciers) {
    const da = Math.abs(wrap(ang - G.ang)); if (da > 0.32) continue;
    const up = landMet(wx, wz) - G.mShore; if (up < 30 || up > 1000) continue;   // die Felswand am Ufer bleibt: dort hängt die Gletscherfront als Eiswand
    const lat = da * Math.hypot(wx, wz + Z0), W = (45 + Math.max(0, up - 30) * 0.12) * G.wk + 28;
    if (lat > W) continue;
    const prof = 1 - (lat / W) ** 2, depth = 30 * sstep(30, 110, up) * (1 - sstep(680, 1000, up));
    h -= depth * prof * prof;
  }
  for (const F of LAND.falls) {
    if (Math.abs(wrap(ang - F.ang)) > 0.25) continue;
    const dx = wx - F.lipX, dz = wz - F.lipZ, u = dx * F.dx + dz * F.dz; if (u < -10 || u > 275) continue;
    const v = dx * F.px + dz * F.pz - F.wig(Math.max(0, u)), wc = F.w * 0.9 + 0.03 * Math.max(0, u), q = Math.abs(v) / wc; if (q > 1.6) continue;
    // Rinne: Parabel von der Sohle B − 3 bis B + 5 am Rand; vor der Lippe (u < 0) und am oberen Ende schließt sie sich
    const B = fallBed(F, u), end = (u < 0 ? -u * 0.7 : 0) + Math.max(0, u - 215) * 0.35;
    const bed = B - 3 + 5 * q * q + end;
    if (bed < h) h = bed;
    // Ufer: mindestens einen halben Meter über dem Wasserspiegel B − 1, nach außen weich ins Gelände
    if (q > 0.63 && u >= 0) { const bank = B - 0.5 + 3 * ((q - 0.63) / 0.67) ** 2 + end, k = 1 - sstep(1.3, 1.6, q); if (h < bank) h += (bank - h) * k; }
  }
  return h;
}
// Bettsohle an der Stelle u (Meter bergauf von der Lippe), linear zwischen den 5-m-Stützen
export function fallBed(F, u) { const f = Math.max(0, Math.min(F.B.length - 1.001, u / 5)), i = Math.floor(f), t = f - i; return F.B[i] * (1 - t) + F.B[i + 1] * t; }
// Wo nichts wachsen soll: im Bach, auf dem Gletscher
export function landAvoid(x, z) {
  const ang = landAng(x, z);
  for (const G of LAND.glaciers) { const da = Math.abs(wrap(ang - G.ang)); if (da > 0.32) continue; const up = landMet(x, z) - G.mShore; if (up < 0 || up > 1000) continue; if (da * Math.hypot(x, z + Z0) < (45 + Math.max(0, up - 30) * 0.12) * G.wk + 34) return true; }
  for (const F of LAND.falls) { if (Math.abs(wrap(ang - F.ang)) > 0.25) continue; const dx = x - F.lipX, dz = z - F.lipZ, u = dx * F.dx + dz * F.dz; if (u < -30 || u > 280) continue; if (Math.abs(dx * F.px + dz * F.pz - F.wig(Math.max(0, u))) < (F.w * 0.9 + 0.03 * Math.max(0, u)) * 1.3 + 6) return true; }
  return false;
}
const glacierNear = (x, z) => { const ang = landAng(x, z); let g = 0; for (const G of LAND.glaciers) g = Math.max(g, 1 - Math.min(1, Math.abs(wrap(ang - G.ang)) / (0.14 * G.wk))); return g; };
const fallNear = (x, z, k = 1.6) => LAND.falls.some(F => { const dx = x - F.lipX, dz = z - F.lipZ; return Math.abs(dx * F.px + dz * F.pz) < F.w * k && dx * F.dx + dz * F.dz < 10; });

/* ---------- Bau ---------- */
export function buildLandscape() {
  if (!LAND.ready) planLandscape();
  const t0 = performance.now();
  LAND.mats.ice = snowy(stdMat({ color: 0x9cc3d6, roughness: 0.32, metalness: 0.05, emissive: 0x061419, envI: 0.6 }), 0.7);
  LAND.mats.clearIce = stdMat({ color: 0xcfe6f2, roughness: 0.14, metalness: 0.1, emissive: 0x0a1c24, envI: 0.9 });
  LAND.mats.rock = snowy(stdMat({ color: 0x3a3d42, roughness: 0.95, metalness: 0, envI: 0.15 }), 0.9);
  if (!new URLSearchParams(location.search).has('ohnering')) buildCliffRing();   // ?ohnering = Vergleich mit dem groben Netz
  buildFalls();
  buildIce();
  for (const k in LAND.mats) LAND.mats[k].name = 'land.' + k;   // für labPick
  LAND.stats.ms = Math.round(performance.now() - t0);
}

// Feines Netz um den See: dicht an der Felswand (3 m), bis 500 m hinter dem Ufer (10 m), außen 50 m. Das grobe Geländenetz
// verliert dort seine Dreiecke (gleicher Shader, Überlappung an den Rändern bleibt unsichtbar).
const RING_OFF = (() => { const o = [-60, -45, -33, -23, -15, -9, -5, -2]; for (let d = 0; d <= 60; d += 3) o.push(d); for (let d = 66; d <= 120; d += 6) o.push(d); for (let d = 130; d <= 300; d += 10) o.push(d); o.push(320, 345, 375, 410, 450, 500); return o; })();
function buildCliffRing() {
  if (!MOUNT.geo || !MOUNT.mat) return;
  const NA = LAND.NA, OFF = MOBILE ? RING_OFF.filter((_, i) => i % 2 === 0) : RING_OFF, NJ = OFF.length;
  const pos = new Float32Array(NA * NJ * 3), idx = [];
  for (let i = 0; i < NA; i++) {
    const ang = i / NA * Math.PI * 2, mS = LAND.shore[i];
    for (let j = 0; j < NJ; j++) {
      const [x, z] = landRay(ang, mS + OFF[j]);
      const o = (i * NJ + j) * 3; pos[o] = x; pos[o + 1] = terrainHeight(x, z) - serpSink(x, z); pos[o + 2] = z;
    }
  }
  const near = (x, z) => VILLA.y && Math.hypot(x - VILLA.x, z - VILLA.z) < VILLA.r + 50;
  for (let i = 0; i < NA; i++) {
    const i1 = (i + 1) % NA;
    for (let j = 0; j < NJ - 1; j++) {
      const a = i * NJ + j, b = i1 * NJ + j, c = i * NJ + j + 1, d = i1 * NJ + j + 1;
      const cx = (pos[a * 3] + pos[d * 3]) / 2, cz = (pos[a * 3 + 2] + pos[d * 3 + 2]) / 2;
      if (near(cx, cz)) continue;
      idx.push(a, b, c, b, d, c);   // gegen den Uhrzeigersinn von oben gesehen (Winkel wächst im Uhrzeigersinn, j nach außen)
    }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const m = new T.Mesh(g, MOUNT.mat); m.frustumCulled = false; m.renderOrder = 20; scene.add(m);   // V77: nach der Stadt zeichnen, siehe buildMountains
  // Ausschnitt im groben Netz: Dreiecke, deren Mitte im Band [Ufer − 30, Ufer + 470] liegt (nicht an der Villa)
  const G = MOUNT.geo, ix = G.index.array, P = G.attributes.position.array, keep = [];
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3, x = (P[a] + P[b] + P[c]) / 3, z = (P[a + 2] + P[b + 2] + P[c + 2]) / 3 - Z0;
    const mS = shoreAt(landAng(x, z)), d = landMet(x, z) - mS;
    if (d > -30 && d < OFF[NJ - 1] - 30 && !near(x, z)) continue;
    keep.push(ix[t], ix[t + 1], ix[t + 2]);
  }
  LAND.stats.ringTris = idx.length / 3; LAND.stats.cutTris = (ix.length - keep.length) / 3;
  G.setIndex(keep);
}

/* ---------- Wasserfälle ---------- */
const NOISE_GLSL = `float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }`;
const VERT_W = `attribute vec2 aQ; varying vec2 vUv; varying vec2 vQ; varying vec3 vW; varying float vD;
  void main(){ vUv = uv; vQ = aQ; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vD = length(mv.xyz); gl_Position = projectionMatrix*mv; }`;
function fallMats() {
  const M = LAND.mats;
  // Wasserschleier: Strähnen laufen abwärts, unten weißer (Schaum), an den Rändern dünn; additiv, im Nebel verblassend
  M.sheet = new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, vertexShader: VERT_W,
    fragmentShader: `uniform float uTime; uniform float uFogDensity; uniform vec3 uCam; uniform float uMoonLit; uniform vec3 uTeal; varying vec2 vUv; varying vec2 vQ; varying vec3 vW; varying float vD;
      ${FOG_GLSL} ${NOISE_GLSL}
      void main(){
        float s1 = noise(vec2(vUv.x*14.0, vUv.y - uTime*2.4)), s2 = noise(vec2(vUv.x*33.0 + 5.0, vUv.y*2.4 - uTime*4.0));
        float streak = s1*0.6 + s2*0.4;
        float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float foam = smoothstep(0.15, 1.0, vQ.x);
        float a = (0.3 + 1.2*streak*streak) * edge * (0.45 + 0.55*foam) * (0.55 + 0.45*uMoonLit);
        a *= 1.0 - vespFog(vD, vW.y, uCam.y, uFogDensity, 0.9);
        vec3 c = mix(vec3(0.45, 0.78, 0.86), vec3(0.86, 0.92, 0.96), foam) + uTeal*0.08;
        gl_FragColor = vec4(c * a * 0.62, 1.0); }` });
  // Gischtwolke am Fuß: weiche Wolke, nach oben dünner, wabernd
  M.mist = new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, vertexShader: VERT_W,
    fragmentShader: `uniform float uTime; uniform float uFogDensity; uniform vec3 uCam; uniform float uMoonLit; uniform vec3 uTeal; varying vec2 vUv; varying vec2 vQ; varying vec3 vW; varying float vD;
      ${FOG_GLSL} ${NOISE_GLSL}
      void main(){
        float r = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float n = noise(vec2(vUv.x*3.0 + vQ.y, vUv.y*2.5 - uTime*0.35)) * 0.6 + noise(vec2(vUv.x*7.0, vUv.y*5.0 - uTime*0.7 + vQ.y))*0.4;
        float a = r*r * pow(1.0 - vUv.y, 1.6) * (0.3 + 0.9*n) * 0.42 * (0.6 + 0.4*uMoonLit);
        a *= 1.0 - vespFog(vD, vW.y, uCam.y, uFogDensity, 0.9);
        gl_FragColor = vec4((vec3(0.6, 0.8, 0.86) + uTeal*0.1) * a, 1.0); }` });
  // Schaumring auf dem Wasser: Ringe laufen nach außen
  M.foam = new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexShader: VERT_W,
    fragmentShader: `uniform float uTime; uniform float uFogDensity; uniform vec3 uCam; uniform float uMoonLit; varying vec2 vUv; varying vec2 vQ; varying vec3 vW; varying float vD;
      ${FOG_GLSL} ${NOISE_GLSL}
      void main(){
        float r = length(vUv - 0.5) * 2.0;
        float rings = 0.5 + 0.5*sin(r*16.0 - uTime*3.0 + vQ.y);
        float n = noise(vUv*9.0 + vec2(uTime*0.2, vQ.y));
        float a = (1.0 - r) * (1.0 - r) * (0.35 + 0.65*rings*n) * 0.9 * (0.6 + 0.4*uMoonLit) * step(r, 1.0);
        a *= 1.0 - vespFog(vD, vW.y, uCam.y, uFogDensity, 0.9);
        gl_FragColor = vec4(vec3(0.7, 0.82, 0.88) * a, 1.0); }` });
  // Bach: dunkles Wasser, Riffel laufen zur Lippe, Mondglanz
  M.stream = new T.ShaderMaterial({ uniforms: U, vertexShader: VERT_W,
    fragmentShader: `uniform float uTime; uniform float uFogDensity; uniform vec3 uFogColor; uniform vec3 uCam; uniform float uMoonLit; uniform vec3 uTeal; varying vec2 vUv; varying vec2 vQ; varying vec3 vW; varying float vD;
      ${FOG_GLSL} ${NOISE_GLSL}
      void main(){
        float f = noise(vec2(vUv.x*2.5, vUv.y*3.0 + uTime*1.5))*0.6 + noise(vec2(vUv.x*6.0 + 2.0, vUv.y*7.0 + uTime*2.6))*0.4;   // längs gestreckte Riffel
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
        vec3 c = vec3(0.05, 0.095, 0.115) + uTeal*0.08 + uFogColor*0.25 + vec3(0.3, 0.36, 0.4) * smoothstep(0.45, 0.85, f) * (0.5 + 0.5*(1.0 - edge));
        c += vec3(0.5, 0.55, 0.6) * pow(smoothstep(0.4, 0.92, f), 3.0) * (0.4 + 0.6*uMoonLit) * 0.6;
        float fog = vespFog(vD, vW.y, uCam.y, uFogDensity, 0.5);
        gl_FragColor = vec4(mix(c, uFogColor*1.2, fog), 1.0); }` });
}
// Band aus Punktpaaren (links/rechts) zu einer Geometrie mit uv (x quer 0..1, y längs in Metern/8) und aQ (Anteil, Zufall)
function ribbon(L, R, qa, qb) {
  const n = L.length, pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), q = new Float32Array(n * 4), idx = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    if (i) s += Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1], L[i][2] - L[i - 1][2]);
    pos.set(L[i], i * 6); pos.set(R[i], i * 6 + 3);
    uv.set([0, s / 8, 1, s / 8], i * 4); q.set([qa(i / (n - 1)), qb, qa(i / (n - 1)), qb], i * 4);
    if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setAttribute('aQ', new T.BufferAttribute(q, 2)); g.setIndex(idx);
  g.computeVertexNormals();   // mergeGeos verlangt Normalen
  return g;
}
function quadGeo(cx, cy, cz, ax, az, w, h, qb) {
  // senkrechtes Rechteck um (cx,cy,cz), Breite entlang (ax, az), Höhe h nach oben; uv.y 0 unten .. 1 oben
  const g = new T.PlaneGeometry(w, h); g.rotateY(Math.atan2(ax, az)); g.translate(cx, cy + h / 2, cz);
  const n = g.attributes.position.count, q = new Float32Array(n * 2); for (let i = 0; i < n; i++) { q[i * 2] = 0; q[i * 2 + 1] = qb; }
  g.setAttribute('aQ', new T.BufferAttribute(q, 2)); return g;
}
function buildFalls() {
  fallMats();
  const rnd = mulberry32(777), sheets = [], mists = [], foams = [], streams = [], icicles = [], mounds = [];
  const mm = new T.Matrix4(), qq = new T.Quaternion(), ee = new T.Euler(), vv = new T.Vector3(), ss = new T.Vector3();
  for (const F of LAND.falls) {
    const { dx, dz, px, pz, w } = F, top = fallBed(F, 0) - 1;   // Wasserspiegel an der Lippe
    // Bahn an der Felswand: von der Lippe seewärts, der Wand folgend, 1 m davor; endet im Wasser
    // Wasser fließt nur abwärts: die Bahn folgt dem laufenden Minimum des Felsprofils (über Buckel hinweg, in Mulden frei fallend)
    const L = [], R = [];
    let s = 0, hFall = Math.max(1, top - WATER_Y), yRun = top;
    for (; s < 150; s += 1.5) {
      const cx = F.lipX - dx * s, cz = F.lipZ - dz * s;
      let h = -1e9; for (const f of [-0.5, 0, 0.5]) h = Math.max(h, terrainHeight(cx + px * w * f, cz + pz * w * f));
      yRun = Math.min(yRun, Math.max(h, WATER_Y - 0.6));
      const wk = w * (1 + 0.25 * s / 60), ox = cx - dx * 1.6, oz = cz - dz * 1.6;
      L.push([ox + px * wk / 2, yRun + 0.5, oz + pz * wk / 2]); R.push([ox - px * wk / 2, yRun + 0.5, oz - pz * wk / 2]);
      if (yRun < WATER_Y - 0.3) break;
    }
    if (L.length < 3) continue;
    F.baseX = (L[L.length - 1][0] + R[L.length - 1][0]) / 2; F.baseZ = (L[L.length - 1][2] + R[L.length - 1][2]) / 2; F.hFall = hFall; F.run = s;
    sheets.push(ribbon(L, R, t => t, rnd() * 6.28));
    // Gischt: drei gekreuzte Flächen am Fuß, Schaumring auf dem Wasser
    const bx = F.baseX - dx * 3, bz = F.baseZ - dz * 3, Hm = Math.min(30, Math.max(9, hFall * 0.22)), Wm = w * 2.2 + 8;
    mists.push(quadGeo(bx, WATER_Y - 1, bz, px, pz, Wm, Hm, rnd() * 6.28));
    for (const r of [0.8, -0.8]) { const ax = px * Math.cos(r) + dx * Math.sin(r), az = pz * Math.cos(r) + dz * Math.sin(r); mists.push(quadGeo(bx, WATER_Y - 1, bz, ax, az, Wm * 0.8, Hm * 0.85, rnd() * 6.28)); }
    { const g = new T.CircleGeometry(w * 1.5 + 4, 28); g.rotateX(-Math.PI / 2); g.translate(F.baseX - dx * 4, WATER_Y + 0.14, F.baseZ - dz * 4);
      const n = g.attributes.position.count, q = new Float32Array(n * 2); for (let i = 0; i < n; i++) { q[i * 2] = 0; q[i * 2 + 1] = rnd() * 6.28; } g.setAttribute('aQ', new T.BufferAttribute(q, 2)); foams.push(g); }
    // Bach oben im Bett (das Bett hat landCarve gegraben): Wasserspiegel halbe Rinnentiefe, Band 0,68 der Rinnenbreite
    const SL = [], SR = [];
    for (let u = -2; u <= 230; u += 3) {
      const off = F.wig(Math.max(0, u)), cx = F.lipX + dx * u + px * off, cz = F.lipZ + dz * u + pz * off, wc = w * 0.9 + 0.03 * Math.max(0, u);
      const y = fallBed(F, u) - 1, hw = wc * 0.6 * (1 - 0.6 * sstep(200, 230, u));   // Spiegel B − 1: dort schneidet die Parabel bei 0,63 wc
      SL.push([cx + px * hw, y, cz + pz * hw]); SR.push([cx - px * hw, y, cz - pz * hw]);
    }
    streams.push(ribbon(SL, SR, t => t, 0));
    // Eis: Eiszapfen an den Rändern der Lippe (gefrorener Sprühnebel), gefrorene Gischthügel am Fuß neben dem Schaum
    if (!LOW) for (const sd of [-1, 1]) for (let k = 0; k < 7; k++) {
      const lat = sd * (w / 2 + 1 + k * 1.3 + rnd()), cx = F.lipX - dx * 2 + px * lat, cz = F.lipZ - dz * 2 + pz * lat, y = terrainHeight(cx, cz) - 0.2, h = 1.2 + rnd() * 2.2;
      mm.compose(vv.set(cx, y - h / 2, cz), qq.setFromEuler(ee.set(Math.PI + (rnd() - 0.5) * 0.2, 0, (rnd() - 0.5) * 0.2)), ss.set(0.18 + rnd() * 0.2, h, 0.18 + rnd() * 0.2)); icicles.push(mm.clone());
    }
    for (const sd of [-1, 1]) for (let k = 0; k < 2; k++) {
      const lat = sd * (w * 0.9 + 3 + k * 5 + rnd() * 3), cx = F.baseX + dx * (1 + k * 2) + px * lat, cz = F.baseZ + dz * (1 + k * 2) + pz * lat, r = 2.5 + rnd() * 3;
      mm.compose(vv.set(cx, WATER_Y - 0.4, cz), qq.setFromEuler(ee.set(0, rnd() * 6.28, 0)), ss.set(r, r * (0.45 + rnd() * 0.3), r * (0.7 + rnd() * 0.5))); mounds.push(mm.clone());
    }
  }
  const add = (geos, mat, ro) => { if (!geos.length) return; const m = new T.Mesh(mergeGeos(geos), mat); m.frustumCulled = false; m.renderOrder = ro; scene.add(m); return m; };
  add(streams, LAND.mats.stream, 0);
  add(sheets, LAND.mats.sheet, 2);
  add(foams, LAND.mats.foam, 2);
  add(mists, LAND.mats.mist, 3);
  if (icicles.length) { const im = new T.InstancedMesh(new T.ConeGeometry(1, 1, 6), LAND.mats.clearIce, icicles.length); icicles.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im); }
  if (mounds.length) { const im = new T.InstancedMesh(new T.SphereGeometry(1, 10, 7), LAND.mats.ice, mounds.length); mounds.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im); }
  LAND.stats.falls = sheets.length;
}

/* ---------- Eis und Schären ---------- */
// flache, unregelmäßige Scholle (Vieleck, oben leicht gewölbt), Radius 1, Dicke 2 (Oberkante bei y 0,8)
function floeGeo(rnd) {
  const n = 7 + Math.floor(rnd() * 4), sh = new T.Shape();
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + (rnd() - 0.5) * 0.3, r = 0.7 + rnd() * 0.3; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  sh.closePath();
  const g = new T.ExtrudeGeometry(sh, { depth: 2.0, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.8, 0);   // Extrusion lief in +z, nach dem Drehen nach +y: Oberkante bei 2 + Fase → nach unten
  g.translate(0, -2.0, 0);
  return g;
}
function buildIce() {
  const rnd = mulberry32(9191), NA = LAND.NA, ice = LAND.mats.ice;
  // Eissaum am Felsfuß: Streifen vom Ufer (2 m in den Fels) nach außen, vor den Gletschern breites Packeis; Lücken an Wasserfällen, Viadukt, Serpentine, Süden
  const pos = [], tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const edge = i => { const ang = i / NA * Math.PI * 2, mS = LAND.shore[i], [sx, sz] = landRay(ang, mS), info = terrainInfo(sx, sz);
    const g = glacierNear(sx, sz), wOut = 5 + 9 * TER.noise(ang * 40, 3) + 36 * g * g + (g > 0.6 ? 10 : 0);
    const ok = info.south < 0.42 && !nearViaduct(sx, sz, 46) && !inSerp(sx, sz, 30) && !fallNear(sx, sz, 1.5) && landDist(sx, sz) < -40;
    const [ix, iz] = landRay(ang, mS + 2.5), [ox, oz] = landRay(ang, mS - wOut);
    return { ok, i: [ix, WATER_Y + 0.55, iz], o: [ox, WATER_Y + 0.55 - 0.15 * TER.noise(ang * 60, 9), oz], b: [ox, WATER_Y - 0.9, oz] }; };
  let E0 = edge(0), nSeg = 0;
  for (let i = 0; i < NA; i++) {
    const E1 = edge((i + 1) % NA);
    if (E0.ok && E1.ok) { tri(E0.i, E1.o, E1.i); tri(E0.i, E0.o, E1.o); tri(E0.o, E0.b, E1.o); tri(E1.o, E0.b, E1.b); nSeg++; }
    E0 = E1;
  }
  if (pos.length) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); const m = new T.InstancedMesh(g, ice, 1); m.setMatrixAt(0, new T.Matrix4()); m.frustumCulled = false; scene.add(m); }   // V77: als Instanz, wie die anderen Eisteile mit diesem Material (sonst suchte three in jedem Bild zweimal ein anderes Shader-Programm heraus)
  // Eisschollen: drei Formen, verteilt im Seering, dichter vor den Gletschern, nicht im Süden (Hafen, Boote), nicht nah an der Insel
  const shapes = [floeGeo(rnd), floeGeo(rnd), floeGeo(rnd)], lists = [[], [], []], N = MOBILE || LOW ? 150 : 420;
  const mm = new T.Matrix4(), qq = new T.Quaternion(), ee = new T.Euler(), vv = new T.Vector3(), ss = new T.Vector3();
  let nF = 0;
  for (let tries = 0; tries < N * 14 && nF < N; tries++) {
    const ang = rnd() * Math.PI * 2, mS = shoreAt(ang), m = mS - 8 - rnd() * rnd() * 170, [x, z] = landRay(ang, m);
    const info = terrainInfo(x, z); if (info.south > 0.38) continue;
    if (landDist(x, z) > -55 || nearViaduct(x, z, 40) || inSerp(x, z, 20) || fallNear(x, z, 1.8)) continue;
    if (terrainHeightRaw(x, z) > WATER_Y - 1.5) continue;
    const g = glacierNear(x, z); if (rnd() > 0.22 + 0.78 * g) continue;
    const r = (3 + rnd() * rnd() * 11) * (1 + g * 0.8) * (rnd() < 0.06 ? 1.8 : 1);
    mm.compose(vv.set(x, WATER_Y, z), qq.setFromEuler(ee.set((rnd() - 0.5) * 0.06, rnd() * 6.28, (rnd() - 0.5) * 0.06)), ss.set(r, 0.7 + rnd() * 0.5, r * (0.7 + rnd() * 0.5)));
    lists[Math.floor(rnd() * 3)].push(mm.clone()); nF++;
  }
  lists.forEach((l, k) => { if (!l.length) return; const im = new T.InstancedMesh(shapes[k], ice, l.length); l.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im); });
  // Schären: dunkle Felsen im Wasser vor der Wand, verschneit
  const rock = new T.IcosahedronGeometry(1, 1), rp = rock.attributes.position; for (let i = 0; i < rp.count; i++) rp.setXYZ(i, rp.getX(i) * (0.8 + rnd() * 0.4), rp.getY(i) * (0.6 + rnd() * 0.5), rp.getZ(i) * (0.8 + rnd() * 0.4)); rock.computeVertexNormals();
  const rocks = [], NR = MOBILE || LOW ? 36 : 90;
  for (let tries = 0; tries < NR * 12 && rocks.length < NR; tries++) {
    const ang = rnd() * Math.PI * 2, mS = shoreAt(ang), [x, z] = landRay(ang, mS - 4 - rnd() * 45);
    const info = terrainInfo(x, z); if (info.south > 0.45 || landDist(x, z) > -50 || nearViaduct(x, z, 30) || inSerp(x, z, 20) || fallNear(x, z, 1.4)) continue;
    if (terrainHeightRaw(x, z) > WATER_Y - 0.5) continue;
    const r = 2 + rnd() * rnd() * 7;
    mm.compose(vv.set(x, WATER_Y - 0.6 + r * 0.15, z), qq.setFromEuler(ee.set(rnd() * 0.4, rnd() * 6.28, rnd() * 0.4)), ss.set(r, r * (0.5 + rnd() * 0.6), r)); rocks.push(mm.clone());
  }
  if (rocks.length) { const im = new T.InstancedMesh(rock, LAND.mats.rock, rocks.length); rocks.forEach((m, i) => im.setMatrixAt(i, m)); im.frustumCulled = false; scene.add(im); }
  LAND.stats.fringeSegs = nSeg; LAND.stats.floes = nF; LAND.stats.rocks = rocks.length;
}
