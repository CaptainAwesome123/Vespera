import { shared, mulberry32, canvasTex, T, R, scene, U } from './core.js';
import { stdMat, MAT } from './people-skeleton.js';
import { shafts } from './facade-shader.js';
import { BEL } from './belmont.js';
import { texSet } from './serpentine.js';
import { makeGlowPoints } from './ragdoll.js';

/* =====================================================================
   LUFTSCHIFFE
   ===================================================================== */
// Hülle: Stoffbahnen zwischen Längsträgern und Ringspanten, leicht gewölbt, mit Nähten, Nieten, Flicken und Regenspuren
export const HULL = texSet(512, (g, gr, gh, W) => {
  const rr = mulberry32(9090), NG = 24, NR = 18, gw = W / NG, rh = W / NR;
  g.fillStyle = '#8f8a84'; g.fillRect(0, 0, W, W); gr.fillStyle = '#9a9a9a'; gr.fillRect(0, 0, W, W); gh.fillStyle = '#000'; gh.fillRect(0, 0, W, W);
  for (let i = 0; i < NG; i++) for (let j = 0; j < NR; j++) {
    const x = i * gw, y = j * rh, v = 0.93 + rr() * 0.1, warm = rr() * 6;
    g.fillStyle = `rgb(${Math.round((150 + warm) * v)},${Math.round(144 * v)},${Math.round((136 - warm) * v)})`; g.fillRect(x, y, gw, rh);
    // Stoff wölbt sich zwischen den Trägern nach außen
    const hg = gh.createRadialGradient(x + gw / 2, y + rh / 2, 1, x + gw / 2, y + rh / 2, Math.max(gw, rh) * 0.7);
    hg.addColorStop(0, 'rgb(210,0,0)'); hg.addColorStop(1, 'rgb(60,0,0)'); gh.fillStyle = hg; gh.fillRect(x, y, gw, rh);
    if (rr() < 0.06) { g.fillStyle = 'rgba(120,112,100,0.5)'; const pw = gw * (0.3 + rr() * 0.4), ph = rh * (0.3 + rr() * 0.4), px = x + rr() * (gw - pw), py = y + rr() * (rh - ph); g.fillRect(px, py, pw, ph); g.strokeStyle = 'rgba(60,55,50,0.5)'; g.lineWidth = 0.6; g.setLineDash([1.5, 1.5]); g.strokeRect(px, py, pw, ph); g.setLineDash([]); }
  }
  // Längsnähte innerhalb der Bahnen
  g.strokeStyle = 'rgba(70,64,58,0.35)'; g.lineWidth = 0.6; g.setLineDash([2, 1.5]);
  for (let i = 0; i < NG; i++) { g.beginPath(); g.moveTo(i * gw + gw / 2, 0); g.lineTo(i * gw + gw / 2, W); g.stroke(); }
  g.setLineDash([]);
  // Träger und Spanten mit Nieten
  for (let i = 0; i <= NG; i++) {
    g.fillStyle = 'rgba(60,54,48,0.5)'; g.fillRect(i * gw - 1.0, 0, 2.0, W); g.fillStyle = 'rgba(200,190,170,0.35)'; g.fillRect(i * gw - 1.2, 0, 0.8, W);
    gh.fillStyle = 'rgb(40,0,0)'; gh.fillRect(i * gw - 1.5, 0, 3, W); gr.fillStyle = 'rgb(70,70,70)'; gr.fillRect(i * gw - 1.5, 0, 3, W);
    g.fillStyle = 'rgba(210,190,150,0.55)'; for (let y = 2; y < W; y += 5) g.fillRect(i * gw - 0.4, y, 0.8, 0.8);
  }
  for (let j = 0; j <= NR; j++) { g.fillStyle = 'rgba(70,62,54,0.35)'; g.fillRect(0, j * rh - 0.7, W, 1.4); gh.fillStyle = 'rgb(50,0,0)'; gh.fillRect(0, j * rh - 1, W, 2); }
  // Regenspuren laufen um den Rumpf nach unten, oben dunkler Ruß, Wasserflecken
  for (let k = 0; k < 260; k++) { const x = rr() * W, y = rr() * W, l = 10 + rr() * 50; const lg = g.createLinearGradient(x, y, x + l, y); lg.addColorStop(0, `rgba(55,50,45,${0.08 + rr() * 0.12})`); lg.addColorStop(1, 'rgba(55,50,45,0)'); g.fillStyle = lg; g.fillRect(x, y, l, 0.8 + rr() * 1.4); }
  for (let k = 0; k < 40; k++) { const rg = g.createRadialGradient(0, 0, 0, 0, 0, 1); rg.addColorStop(0, 'rgba(60,54,46,0.14)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(rr() * W, rr() * W); g.scale(8 + rr() * 30, 6 + rr() * 24); g.fillStyle = rg; g.fillRect(-1, -1, 2, 2); g.restore(); }
}, 2.4);
HULL.map.repeat.set(1, 1);
export const SHIP_NAMES = ['AURORA', 'CELESTE', 'MERIDIAN', 'ORPHEA', 'SOLSTICE', 'ASTRAEA', 'LUMINA', 'VESPERTINE'];
export let shipNo = 0;
export const nameTex = n => canvasTex(1024, 128, (g, W, H) => { g.fillStyle = '#f0cf86'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 4; g.font = '84px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`V-${12 + n * 3}  ${SHIP_NAMES[n % SHIP_NAMES.length]}`, W / 2, H / 2 + 4); });
// Gondel: Kabinenfenster mit Rahmen, beleuchtet, dazwischen genietete Bleche
export const GOND = (() => {
  const draw = glow => (g, W, H) => {
    g.fillStyle = glow ? '#000' : '#2c2a2e'; g.fillRect(0, 0, W, H);
    if (!glow) { g.strokeStyle = 'rgba(120,110,100,0.35)'; g.lineWidth = 1; for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = 0; x < W; x += 32) for (let y = 4; y < H; y += 8) { g.fillStyle = 'rgba(190,170,130,0.35)'; g.fillRect(x, y, 1, 1); } }
    for (const c of [0, 0.5, 1]) for (let y = 6; y < H - 10; y += 18) {
      const x = c * W - 22;
      if (glow) { g.fillStyle = '#ffcf8a'; g.fillRect(x + 3, y + 3, 38, 10); g.fillStyle = 'rgba(80,40,10,0.6)'; g.fillRect(x + 21, y + 3, 2, 10); }
      else { g.fillStyle = '#b08a4a'; g.fillRect(x, y, 44, 16); g.fillStyle = '#100c08'; g.fillRect(x + 3, y + 3, 38, 10); }
    }
    if (!glow) { g.fillStyle = '#b08a4a'; for (const c of [0.25, 0.75]) g.fillRect(c * W - 1.5, 0, 3, H); }
  };
  const m = canvasTex(256, 512, draw(false)), e = canvasTex(256, 512, draw(true));
  for (const t of [m, e]) t.wrapS = t.wrapT = T.RepeatWrapping;
  return { m, e };
})();
export const SHIP_MAT = {};
export const adTex = [
  canvasTex(1024, 140, (g, W, H) => { g.fillStyle = '#0f2a2e'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f2c46d'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16); g.fillStyle = '#ffe2a6'; g.shadowColor = '#f2b55a'; g.shadowBlur = 16; g.font = '86px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('VESPERA', W / 2, H / 2 + 6); }),
  canvasTex(1024, 140, (g, W, H) => { g.fillStyle = '#2a1030'; g.fillRect(0, 0, W, H); g.strokeStyle = '#f2c46d'; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16); g.fillStyle = '#ffe2a6'; g.shadowColor = '#f2b55a'; g.shadowBlur = 16; g.font = '58px Limelight, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('GRAND BALL · THE BELMONT', W / 2, H / 2 + 4); }),
];
export function buildAirship(L, R0, adIndex, beam, opts = {}) {
  const grp = new T.Group();
  if (!SHIP_MAT.hull) {
    SHIP_MAT.hull = stdMat({ map: HULL.map, roughnessMap: HULL.rough, normalMap: HULL.normal, normalScale: new T.Vector2(1, 1), color: 0xb8aea4, roughness: 1, metalness: 0.15, emissive: 0x1c140c, emissiveMap: HULL.map, envI: 0.5 });
    SHIP_MAT.gond = stdMat({ map: GOND.m, emissiveMap: GOND.e, emissive: new T.Color(1.2, 0.85, 0.5), roughness: 0.45, metalness: 0.5, envI: 0.6 });
    SHIP_MAT.fin = stdMat({ map: HULL.map, normalMap: HULL.normal, color: 0x9a8f84, roughness: 0.8, metalness: 0.2, emissive: 0x140e08, side: T.DoubleSide });
  }
  // Stromlinienrumpf: stumpfer Bug, langes spitz zulaufendes Heck (größter Durchmesser bei 40 % vom Bug)
  const fu = u => Math.pow(u, 0.9) * Math.pow(1 - u, 0.6), FMAX = fu(0.6);
  const hr = x => R0 * fu(Math.min(1, Math.max(0, x / L + 0.5))) / FMAX;
  const prof = []; for (let k = 0; k <= 40; k++) { const u = k / 40, x = (u - 0.5) * L; prof.push(new T.Vector2(Math.max(0.05, hr(x)), x)); }
  const hullGeo = new T.LatheGeometry(prof, 48); hullGeo.rotateZ(-Math.PI / 2); grp.userData.hr = hr;
  grp.add(new T.Mesh(hullGeo, SHIP_MAT.hull));
  const gold = MAT.gold, dark = new T.MeshStandardMaterial({ color: 0x3a3238, metalness: 0.6, roughness: 0.4 });
  // Gondel als abgerundete Kabine mit Fensterreihen und Goldkiel
  const gl = L * 0.16;
  if (!opts.passenger) {
    const gond = new T.Mesh(new T.CapsuleGeometry(1.8, gl - 3.6, 6, 24).rotateZ(Math.PI / 2).scale(1, 1, 1.35), SHIP_MAT.gond);
    gond.position.set(L * 0.08, -hr(L * 0.08) - 1.1, 0); grp.add(gond);
    const keel = new T.Mesh(new T.BoxGeometry(gl * 0.9, 0.16, 0.3), gold); keel.position.set(L * 0.08, -hr(L * 0.08) - 2.95, 0); grp.add(keel);
  }
  // Leitwerk: vier gepfeilte Flossen mit Ruderblatt und Goldkante
  const fx = -L * 0.45, RT = hr(fx + L * 0.06) + R0 * 0.5, root = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8 * L * 0.15; root.push(new T.Vector2(t, hr(fx + t) * 0.85)); }
  const fs = new T.Shape([new T.Vector2(-L * 0.01, RT), ...root, new T.Vector2(L * 0.06, RT)]);
  const finGeo = new T.ExtrudeGeometry(fs, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 2 }).translate(0, 0, -0.18);
  const rud = new T.BoxGeometry(L * 0.035, RT - hr(fx) - 0.4, 0.3).translate(-L * 0.0175, (RT + hr(fx)) / 2, 0);
  const tipGeo = new T.BoxGeometry(L * 0.075, 0.22, 0.5).translate(L * 0.025, RT, 0);
  for (let k = 0; k < 4; k++) {
    const f = new T.Group();
    f.add(new T.Mesh(finGeo, SHIP_MAT.fin), new T.Mesh(rud, dark), new T.Mesh(tipGeo, gold));
    f.position.set(fx, 0, 0); f.rotation.x = k * Math.PI / 2; grp.add(f);
  }
  // Motorgondeln: tropfenförmig, mit Kühlerring, Abgasrohr und dreiflügeligem Propeller
  const nac = new T.LatheGeometry([[0.05, -3.6], [0.7, -3.2], [1.15, -2.2], [1.35, -0.6], [1.3, 0.8], [1.0, 2.2], [0.5, 3.0], [0.05, 3.3]].map(([r, y]) => new T.Vector2(r, y)), 18).rotateZ(-Math.PI / 2);
  const blade = new T.BoxGeometry(0.12, 2.3, 0.42).translate(0, 1.15, 0);
  for (const s of [-1, 1]) for (const ex of [-L * 0.1, L * 0.22]) {
    const ez = s * (hr(ex) * 0.95 + 1.2), ey = -hr(ex) * 0.55;
    const e = new T.Mesh(nac, dark); e.position.set(ex, ey, ez); grp.add(e);
    const ring = new T.Mesh(new T.TorusGeometry(1.36, 0.1, 6, 20).rotateY(Math.PI / 2), gold); ring.position.set(ex + 1.4, ey, ez); grp.add(ring);
    const hub = new T.Mesh(new T.ConeGeometry(0.4, 0.9, 10).rotateZ(Math.PI / 2), gold); hub.position.set(ex - 3.9, ey, ez); grp.add(hub);
    for (let b = 0; b < 3; b++) { const bl = new T.Mesh(blade, dark); bl.position.set(ex - 3.7, ey, ez); bl.rotation.x = b * Math.PI * 2 / 3 + s; grp.add(bl); }
    const prop = new T.Mesh(new T.CylinderGeometry(2.4, 2.4, 0.06, 20).rotateZ(Math.PI / 2), new T.MeshBasicMaterial({ color: 0x8a8070, transparent: true, opacity: 0.18, depthWrite: false })); prop.position.set(ex - 3.75, ey, ez); grp.add(prop);
    const strut = new T.Mesh(new T.BoxGeometry(0.5, 0.25, Math.abs(ez) - hr(ex) * 0.75).translate(0, 0, s * ((Math.abs(ez) + hr(ex) * 0.75) / 2)), gold); strut.position.set(ex, ey + 0.2, 0); grp.add(strut);
  }
  // Bugkappe mit Ankerkegel, goldene Zierringe, Takelage zur Gondel
  const nose = new T.Mesh(new T.SphereGeometry(R0 * 0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2), gold); nose.position.set(L / 2 - R0 * 0.06, 0, 0); grp.add(nose);
  for (const k of [-3, -1, 1, 3]) { const x = k * L * 0.11, ring = new T.Mesh(new T.TorusGeometry(hr(x) + 0.06, 0.12, 6, 48).rotateY(Math.PI / 2), gold); ring.position.set(x, 0, 0); grp.add(ring); }
  const rigPts = [];
  for (let k = 0; k < 6; k++) { const ax = L * 0.08 + (k - 2.5) * L * 0.025; for (const sz of [-2.3, 2.3]) rigPts.push(ax, -hr(L * 0.08) - 0.2, sz, ax + (k - 2.5) * 2, -hr(ax) * 0.75, sz * 2.4); }
  if (!opts.passenger) { const rig = new T.LineSegments(new T.BufferGeometry().setAttribute('position', new T.Float32BufferAttribute(rigPts, 3)), new T.LineBasicMaterial({ color: 0x9a8a6a })); grp.add(rig); }
  // Fensterreihe der Passagierdecks im Rumpf
  const winRow = [];
  for (let k = -5; k <= 5; k++) for (const sz of [-1, 1]) { const x = k * L * 0.045 + L * 0.06, r = hr(x) + 0.05; winRow.push({ p: [x, -r * 0.73, sz * r * 0.69], c: [1.1, 0.75, 0.4], s: 0.75, ph: 0, bl: 0 }); }
  grp.add(makeGlowPoints(winRow));
  // Werbebanner und Schiffsname folgen der Rumpfkrümmung
  const wrap = (w, h, x0, a0, map, col) => {
    for (const side of [1, -1]) {
      const pg = new T.PlaneGeometry(w, h, 30, 6), p = pg.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i), r = hr(x0 + side * x) + 0.2, a = a0 + yy / R0; p.setXYZ(i, x0 + side * x, r * Math.sin(a), side * r * Math.cos(a)); }
      pg.computeVertexNormals();
      grp.add(new T.Mesh(pg, new T.MeshBasicMaterial({ map, color: col, transparent: true })));
    }
  };
  wrap(L * 0.42, R0 * 0.48, 0, 0, adTex[adIndex], new T.Color(1.25, 1.25, 1.25));
  wrap(L * 0.2, R0 * 0.18, L * 0.3, 0.42, nameTex(shipNo++), new T.Color(1.7, 1.6, 1.4));
  const lights = makeGlowPoints([
    { p: [L * 0.08, -R0 - (opts.passenger ? 5.5 : 3.2), 0], c: [1.4, 1.3, 1.1], s: 2.5, ph: R(), bl: 1 },
    { p: [-L * 0.47, 0, 0], c: [1.4, 1.35, 1.2], s: 2.6, ph: 0, bl: 0 },
    { p: [-L * 0.4, 0, R0 * 0.98], c: [0.2, 1.4, 0.4], s: 2.4, ph: 0, bl: 0 },
    { p: [-L * 0.4, 0, -R0 * 0.98], c: [1.5, 0.15, 0.1], s: 2.4, ph: 0, bl: 0 },
    { p: [L * 0.5, 0, 0], c: [1.3, 1, 0.6], s: 3.2, ph: 0, bl: 0 },
    ...(opts.passenger ? [] : [{ p: [L * 0.08, -R0 - 1.0, 0], c: [1.2, 0.75, 0.35], s: L * 0.12, ph: 0, bl: 0 }]),
  ]);
  grp.add(lights);
  if (beam) {
    const b = makeBeam(420, 28, 0.06);
    b.position.set(L * 0.1, -R0 - 3.4, 0); b.rotation.x = Math.PI; grp.add(b);
    grp.userData.beam = b;
  }
  scene.add(grp);
  return grp;
}

/* ---------- Lichtsäulen: Lichtkegel, die aus den Kronen in den Himmel steigen ---------- */
export function buildShafts() {
  const n = shafts.length; if (!n) return;
  const geo = new T.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const g2 = geo.clone().rotateY(Math.PI / 2);
  const col = new Float32Array(n * 3);
  for (const g of [geo, g2]) {
    const im = new T.InstancedMesh(g, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: `attribute vec3 aCol; varying vec2 vUv; varying vec3 vC; varying float vD;
        void main(){ vUv = uv; vC = aCol; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.0); vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; uniform float uFogDensity; varying vec2 vUv; varying vec3 vC; varying float vD;
        void main(){ float x = abs(vUv.x - 0.5)*2.0; float a = pow(1.0 - x, 2.2) * pow(1.0 - vUv.y, 1.7) * (0.85 + 0.15*sin(uTime*0.7 + vUv.y*9.0));
          a *= exp(-uFogDensity*uFogDensity*vD*vD*0.6); gl_FragColor = vec4(vC * a * 0.22, 1.0); }`,
    }), n);
    const m = new T.Matrix4();
    shafts.forEach((s, i) => { m.makeScale(s.w, s.h, s.w).setPosition(s.x, s.y, s.z); im.setMatrixAt(i, m); col.set(s.c, i * 3); });
    g.setAttribute('aCol', new T.InstancedBufferAttribute(col, 3));
    im.frustumCulled = false; im.renderOrder = 2; scene.add(im);
  }
}
export function buildGroundFog() {
  const mat = new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    vertexShader: `varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix*w; vD = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uTeal; uniform vec3 uCam; uniform float uInside; varying vec3 vW; varying float vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec2 p = vW.xz*0.012 + vec2(uTime*0.008, -uTime*0.005);
        float n = noise(p)*0.6 + noise(p*2.3 + 7.0)*0.3 + noise(p*5.1 - 3.0)*0.1;
        float a = smoothstep(0.3, 0.8, n) * 0.11;
        a *= smoothstep(6.0, 40.0, abs(uCam.y - vW.y)) * smoothstep(1500.0, 300.0, vD) * smoothstep(0.0, 60.0, vD);
        a *= 1.0 - uInside;
        gl_FragColor = vec4(uTeal * a, 1.0); }`,
  });
  for (const y of [4, 11, 20, 32, -0.4]) {
    const m = new T.Mesh(new T.PlaneGeometry(y < 0 ? 3600 : 2600, y < 0 ? 3600 : 2400), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(0, y, 100); m.renderOrder = 1; m.frustumCulled = false; scene.add(m);
  }
}

/* ---------- Suchscheinwerfer ---------- */
export const beamMat = (alpha) => new T.ShaderMaterial({
  uniforms: { uA: { value: alpha }, uLen: { value: 1 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV; uniform float uLen; void main(){ vT = position.y/uLen; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform float uA; varying float vT; varying vec3 vN; varying vec3 vV; void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 1.5); float a = uA*pow(1.0 - vT, 1.6)*e; gl_FragColor = vec4(vec3(1.0, 0.86, 0.62)*a, 1.0); }`,
});
export function makeBeam(len, radius, alpha) {
  const g = new T.ConeGeometry(radius, len, 32, 1, true); g.translate(0, -len / 2, 0); g.rotateX(Math.PI);
  const mt = beamMat(alpha); mt.uniforms.uLen.value = len;
  const m = new T.Mesh(g, mt); m.frustumCulled = false; m.renderOrder = 3;
  return m;
}
export const searchlights = [];
export function buildSearchlights() {
  for (let i = 0; i < 4; i++) {
    const piv = new T.Group(); piv.position.set((i % 2 ? 1 : -1) * 8, BEL.s5 + 1, (i < 2 ? 1 : -1) * 8);
    const b = makeBeam(1100, 46, 0.055); piv.add(b);
    scene.add(piv); searchlights.push({ piv, ph: i * Math.PI / 2, tilt: 0.35 + 0.08 * i });
  }
}

/* ---------- Automobile ---------- */
export const cars = [];
shared.carMesh = undefined; shared.carMeshHi = undefined; shared.carLights = undefined; shared.carCmp = undefined;
