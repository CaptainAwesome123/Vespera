import { T, mergeGeos, scene } from './core.js';
import { ENV } from './people-skeleton.js';
import { roundBox } from './entrances.js';
import { COL } from './serpentine.js';

/* =====================================================================
   V16 · AUTOS: Innenraum (Sitzbänke, Armaturenbrett, Lenkrad), Fahrer und Fahrgäste,
   Scheiben als eigenes, durchsichtiges Netz, Schadensverformung im Shader
   ===================================================================== */
// Innenraum und Insassen; add(geometrie, farbe, variante)
export function carCabin(add, opts = {}) {
  const leather = [0.22, 0.07, 0.05], wood = [0.28, 0.15, 0.07], dark = [0.03, 0.03, 0.035];
  const B = (w, h, d, x, y, z, c, o = 0) => add(new T.BoxGeometry(w, h, d).translate(x, y, z), c, o);
  // Vorder- und Rückbank mit Lehnen, gepolstert
  for (const [x, w] of [[-0.25, 0.62], [-1.3, 0.66]]) { add(roundBox(w, 0.2, 1.42, 0.07).translate(x, 1.0, 0), leather); add(roundBox(0.16, 0.56, 1.42, 0.07).rotateZ(0.12).translate(x - w / 2 + 0.02, 1.32, 0), leather); }
  // Armaturenbrett aus Wurzelholz mit Messinginstrumenten, Lenksäule und Lenkrad (rechts)
  B(0.12, 0.26, 1.52, 0.36, 1.33, 0, wood);
  for (const z of [0.25, 0.45]) add(new T.CylinderGeometry(0.045, 0.045, 0.02, 12).rotateZ(Math.PI / 2).translate(0.29, 1.38, z), [0.85, 0.66, 0.32]);
  add(new T.CylinderGeometry(0.022, 0.022, opts.driver ? 0.4 : 0.55, 6).rotateZ(Math.PI / 2 - 0.55).translate(opts.driver ? 0.24 : 0.18, opts.driver ? 1.29 : 1.32, 0.38), dark);
  if (!opts.driver) {
    add(new T.TorusGeometry(0.18, 0.018, 6, 20).rotateY(Math.PI / 2).rotateZ(0.5).translate(0.04, 1.42, 0.38), dark);
    for (let k = 0; k < 3; k++) add(new T.BoxGeometry(0.01, 0.32, 0.012).rotateX(k * Math.PI / 3).rotateZ(0.5).translate(0.04, 1.42, 0.38), [0.7, 0.6, 0.4]);
  }
  // V18: Fahrer und Fahrgäste sind Figuren der Menge (DRV), nicht mehr ins Auto gebaut
  return;
  // Fahrer: sitzt rechts, Hände am Lenkrad; Hut je Variante (Chauffeursmütze, Hut, ohne), dazu manchmal ein Fahrgast hinten
  const person = (x, z, o, role) => {
    const skin = COL.skin, suit = role === 'chauffeur' ? [0.05, 0.07, 0.1] : role === 'lady' ? [0.45, 0.1, 0.14] : [0.07, 0.07, 0.08];
    add(new T.CylinderGeometry(0.085, 0.09, 0.5, 8).rotateZ(Math.PI / 2 - 0.08).translate(x + 0.22, 1.13, z - 0.1), suit, o);       // Oberschenkel
    add(new T.CylinderGeometry(0.085, 0.09, 0.5, 8).rotateZ(Math.PI / 2 - 0.08).translate(x + 0.22, 1.13, z + 0.1), suit, o);
    add(new T.LatheGeometry([[0, 0], [0.19, 0], [0.2, 0.12], [0.18, 0.3], [0.21, 0.45], [0.17, 0.55], [0.07, 0.6], [0, 0.6]].map(([r, y]) => new T.Vector2(r, y)), 14).scale(1, 1, 0.7).rotateZ(0.12).translate(x - 0.05, 1.08, z), suit, o);
    if (role !== 'lady') add(new T.BoxGeometry(0.02, 0.24, 0.1).rotateZ(0.12).translate(x + 0.105, 1.48, z), COL.shirt, o);
    add(new T.CylinderGeometry(0.045, 0.05, 0.08, 8).translate(x - 0.1, 1.68, z), skin, o);
    add(new T.SphereGeometry(0.095, 14, 10).scale(1.05, 1.15, 0.95).translate(x - 0.1, 1.78, z), skin, o);
    add(new T.SphereGeometry(0.02, 6, 4).scale(1, 1.3, 1).translate(x - 0.005, 1.77, z), skin, o);                                  // Nase
    // Arme zum Lenkrad oder auf den Schoß
    for (const sd of [-1, 1]) {
      const sh = [x - 0.08, 1.55, z + sd * 0.19], hand = role === 'driver' || role === 'chauffeur' ? [0.06, 1.47, 0.38 + sd * 0.15] : [x + 0.3, 1.2, z + sd * 0.1];
      const el = [(sh[0] + hand[0]) / 2 - 0.02, Math.min(sh[1], hand[1]) - 0.1, (sh[2] + hand[2]) / 2 + sd * 0.04];
      for (const [a, b, r] of [[sh, el, 0.055], [el, hand, 0.045]]) {
        const A = new T.Vector3(...a), Bv = new T.Vector3(...b), L = A.distanceTo(Bv);
        add(new T.CylinderGeometry(r * 0.9, r, L, 7).translate(0, L / 2, 0).applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), Bv.clone().sub(A).normalize())).translate(...a), suit, o);
      }
      add(new T.SphereGeometry(0.04, 7, 5).translate(...hand), role === 'chauffeur' ? dark : skin, o);
    }
    return o;
  };
  // Varianten 10..12: Fahrer im Anzug mit Hut, Chauffeur mit Mütze, Fahrer ohne Hut
  const hx = -0.4, hz = 0.38;
  for (const [o, role] of [[10, 'driver'], [11, 'chauffeur'], [12, 'driver']]) {
    person(-0.3, hz, o, role);
    if (o === 10) { add(new T.CylinderGeometry(0.17, 0.17, 0.012, 16).translate(hx, 1.84, hz), [0.12, 0.1, 0.09], o); add(new T.CylinderGeometry(0.09, 0.1, 0.1, 14).translate(hx, 1.9, hz), [0.12, 0.1, 0.09], o); add(new T.CylinderGeometry(0.101, 0.101, 0.025, 14).translate(hx, 1.86, hz), [0.05, 0.03, 0.02], o); }
    else if (o === 11) { add(new T.CylinderGeometry(0.1, 0.1, 0.07, 14).translate(hx, 1.86, hz), [0.05, 0.07, 0.1], o); add(new T.CylinderGeometry(0.115, 0.105, 0.025, 14).translate(hx, 1.905, hz), [0.05, 0.07, 0.1], o); add(new T.BoxGeometry(0.08, 0.01, 0.15).rotateZ(-0.25).translate(hx + 0.12, 1.84, hz), dark, o); }
    else add(new T.SphereGeometry(0.1, 12, 8).scale(1.03, 0.8, 1.05).translate(hx - 0.015, 1.83, hz), COL.hair, o);
  }
  // Variante 20: Fahrgast hinten links (Dame mit Glockenhut)
  person(-1.35, -0.35, 20, 'lady');
  add(new T.SphereGeometry(0.115, 12, 8).scale(1.05, 0.9, 1.08).translate(-1.45, 1.82, -0.35), [0.25, 0.08, 0.1], 20);
}
// Scheiben: Frontscheibe, Seitenfenster, Heckfenster (Variante 4: nicht beim Cabriolet)
export function carGlassGeo() {
  const parts = [];
  const pane = (w, h, x, y, z, rz = 0, ry = 0) => parts.push(new T.BoxGeometry(0.012, h, w).rotateZ(rz).rotateY(ry).translate(x, y, z));
  pane(1.56, 0.66, 0.33, 1.615, 0, 0.28);
  for (const sz of [-1, 1]) { parts.push(new T.BoxGeometry(0.98, 0.56, 0.012).translate(-0.24, 1.63, sz * 0.795)); parts.push(new T.BoxGeometry(0.98, 0.52, 0.012).translate(-1.33, 1.62, sz * 0.795)); }
  pane(1.3, 0.5, -1.97, 1.6, 0, -0.5);
  const g = mergeGeos(parts.map(p => p.index ? p.toNonIndexed() : p));
  g.setAttribute('aOpt', new T.BufferAttribute(new Float32Array(g.attributes.position.count).fill(4), 1));
  return g;
}
export let GLASS_MAT = null;
export function carGlassMat() {
  if (GLASS_MAT) return GLASS_MAT;
  const m = new T.MeshPhysicalMaterial({ color: 0x9fb8c0, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.22, envMapIntensity: 1.6, depthWrite: false, side: T.DoubleSide });
  if (ENV) m.envMap = ENV;
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aOpt; attribute vec4 aDmg; varying vec3 vGp; varying float vCrack;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vGp = position; vCrack = 0.0;
      #ifdef USE_INSTANCING_COLOR
        float cv = floor(fract(sin(dot(instanceColor, vec3(127.1, 311.7, 74.7))) * 43758.5453) * 3.0);
        if (cv == 1.0) transformed = vec3(0.0);
        vCrack = aDmg.x * step(0.2, position.x) + aDmg.y * step(position.x, -1.8) + aDmg.z * step(position.z, -0.7) + (1.0 - aDmg.w) * step(0.7, position.z);
      #endif`);
    sh.fragmentShader = 'varying vec3 vGp; varying float vCrack;\nfloat ckH(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // gesprungene Scheibe: Netz aus Rissen um einen Einschlag
      if (vCrack > 0.35) {
        vec2 q = vGp.zy * 14.0; vec2 c = floor(q), f = fract(q);
        float d = 1.0; for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) { vec2 o = vec2(float(i), float(j)); vec2 r = o + vec2(ckH(c + o), ckH(c + o + 7.3)) - f; d = min(d, abs(r.x) + abs(r.y)); }
        float crack = smoothstep(0.12, 0.0, d) * smoothstep(0.35, 0.7, vCrack);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9), crack); diffuseColor.a = mix(diffuseColor.a, 0.75, crack);
      }`);
  };
  return GLASS_MAT = m;
}
// Scheiben-Netz zu einem Karosserie-Netz: gleiche Instanzmatrizen, Farben und Schäden
export function glassFor(bodyIM) {
  const g = carGlassGeo();
  if (bodyIM.geometry.attributes.aDmg) g.setAttribute('aDmg', bodyIM.geometry.attributes.aDmg);
  const im = new T.InstancedMesh(g, carGlassMat(), bodyIM.instanceMatrix.count);
  im.instanceMatrix = bodyIM.instanceMatrix; im.instanceColor = bodyIM.instanceColor;
  im.count = 0; im.frustumCulled = false; im.renderOrder = 3; im.userData.noRefl = true; scene.add(im);
  return im;
}
// Schaden je Wagen: vorn, hinten, links, rechts (w gespeichert als 1 - rechts, damit fehlende Werte "heil" bedeuten)
export function carDamageAttr(im) {
  const n = im.instanceMatrix.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a[i * 4 + 3] = 1;
  im.geometry.setAttribute('aDmg', new T.InstancedBufferAttribute(a, 4));
}

/* =====================================================================
   V27 · KAROSSERIE MIT RUNDUNGEN statt quer extrudierter Seitenprofile
   carLoft: Körper aus Querschnitten entlang der Wagenachse (x). Jeder Schnitt ist eine Superellipse
   (halbe Breite w, Unterkante yb, Oberkante yt, Rundung n: 2 = Ellipse, 6 = fast eckig);
   so entstehen gewölbte Hauben, eingezogene Flanken und ein abfallendes Heck.
   carFender: Kotflügel als gewölbtes Blech, das einem Pfad um das Rad folgt (Querschnitt mit Bombierung),
   vorn bis ins Trittbrett gezogen, hinten als Tropfen.
   ===================================================================== */
export function carLoft(st, M = 22) {
  const pos = [], idx = [], ring = st.length;
  for (const s of st) {
    const n = s.n ?? 4, yc = (s.yb + s.yt) / 2, hh = (s.yt - s.yb) / 2;
    for (let j = 0; j < M; j++) {
      const a = j / M * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      pos.push(s.x, yc + hh * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n), s.w * Math.sign(c) * Math.pow(Math.abs(c), 2 / n));
    }
  }
  for (let i = 0; i < ring - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = a + M, d = b + M;
    if (st[i].x < st[i + 1].x) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  // Enden zu
  for (const [i, flip] of [[0, true], [ring - 1, false]]) {
    const ci = pos.length / 3, s = st[i]; pos.push(s.x, (s.yb + s.yt) / 2, 0);
    const back = (st[0].x > st[ring - 1].x) !== flip;
    for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M; if (back) idx.push(ci, a, b); else idx.push(ci, b, a); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Pfad in der Seitenansicht (x, y), Querschnitt: Bombierung über die Breite W, Blechstärke T; z = Mitte des Kotflügels
export function carSweep(path, z, W, Tk) {
  const prof = [];
  for (let k = 0; k <= 8; k++) { const u = -1 + 2 * k / 8; prof.push([Tk * Math.pow(Math.max(0, 1 - Math.abs(u) ** 3), 1 / 3) + 0.012, u * W / 2]); }
  prof.push([0, W / 2], [0, -W / 2]);
  const M = prof.length, pos = [], idx = [];
  path.forEach(([x, y], i) => {
    const p0 = path[Math.max(0, i - 1)], p1 = path[Math.min(path.length - 1, i + 1)];
    let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
    const nx = ty, ny = -tx;
    for (const [o, w] of prof) pos.push(x + nx * o, y + ny * o, z + w);
  });
  for (let i = 0; i < path.length - 1; i++) for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M, c = a + M, d = b + M; idx.push(a, c, b, b, c, d); }
  for (const [i, f] of [[0, 1], [path.length - 1, 0]]) { const ci = pos.length / 3, [x, y] = path[i]; pos.push(x, y, z); for (let j = 0; j < M; j++) { const a = i * M + j, b = i * M + (j + 1) % M; if (f) idx.push(ci, a, b); else idx.push(ci, b, a); } }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Kotflügelpfad: Bogen um das Rad (Mitte cx, Achshöhe 0.44, Halbmesser r) von Winkel a0 bis a1, danach optional ein Schweif
export function fenderPath(cx, r, a0, a1, tail) {
  const pts = [];
  for (let k = 0; k <= 14; k++) { const a = a0 + (a1 - a0) * k / 14; pts.push([cx + Math.cos(a) * r, 0.44 + Math.sin(a) * r]); }
  if (tail) for (const p of tail) pts.push(p);
  return pts;
}
// Drahtspeichenrad mit Weißwandreifen, Felgenring, Nabenkappe; Achse entlang z
export function carWheel(push, sx, z, sz, c) {
  push(new T.TorusGeometry(0.34, 0.1, 10, 24).translate(sx, 0.44, z), c.tyre);
  push(new T.CylinderGeometry(0.31, 0.31, 0.02, 24, 1, true).rotateX(Math.PI / 2).translate(sx, 0.44, z + sz * 0.1), c.wall);
  push(new T.TorusGeometry(0.245, 0.022, 6, 24).translate(sx, 0.44, z + sz * 0.035), c.chrome);
  for (let k = 0; k < 16; k++) { const g = new T.BoxGeometry(0.01, 0.48, 0.01); g.rotateZ(k * Math.PI / 16 + (k % 2) * 0.06); g.translate(sx, 0.44, z + sz * ((k % 2) ? 0.05 : -0.01)); push(g, c.chrome); }
  push(new T.SphereGeometry(0.1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(sz * Math.PI / 2).scale(1, 1, 0.7).translate(sx, 0.44, z + sz * 0.06), c.chrome);
  push(new T.CylinderGeometry(0.03, 0.03, 0.06, 8).rotateX(Math.PI / 2).translate(sx, 0.44, z + sz * 0.14), c.gold);
}
