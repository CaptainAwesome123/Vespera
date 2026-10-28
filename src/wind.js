'use strict';
/* =====================================================================
   V16 · WIND: eine Wetterlage für alles. Richtung wandert langsam, Böen ziehen
   als Wellen über die Stadt; Bäume, Gras, Fahnen, Rauch, Wasser, Luftschiffe,
   Boote, der Wagen auf dem Viadukt und fliegendes Laub folgen ihr
   ===================================================================== */
const WIND = { a: 0.6, s: 4.5, gust: 0, gT: 6, gA: 0, gDur: 3, t: 0, dx: 0.8, dz: 0.6 };
function updateWind(dt) {
  const W = WIND; W.t += dt;
  // Grundwind: dreht langsam, Stärke schwankt zwischen etwa 2 und 8 m/s
  W.a = 0.6 + Math.sin(W.t * 0.011) * 0.5 + Math.sin(W.t * 0.037) * 0.15;
  W.s = 4.6 + Math.sin(W.t * 0.021) * 1.8 + Math.sin(W.t * 0.067 + 1.3) * 0.9;
  // Böen: kommen alle paar Sekunden, schwellen an und klingen ab
  if ((W.gT -= dt) <= 0) { W.gT = 5 + Math.random() * 12; W.gA = 0.35 + Math.random() * 0.65; W.gDur = 2 + Math.random() * 3; W.g0 = W.t; }
  const k = W.g0 !== undefined ? (W.t - W.g0) / W.gDur : 2;
  W.gust = k < 1 ? Math.sin(Math.PI * k) ** 2 * W.gA : 0;
  W.dx = Math.cos(W.a); W.dz = Math.sin(W.a);
  U.uWind.value.set(W.dx, W.dz, W.s, W.gust);
}
// Wind an einem Ort (m/s, Vektor): Böenwelle zieht mit dem Wind, oben weht es stärker
function windAt(x, z, y = 0) {
  const W = WIND, ph = (x * W.dx + z * W.dz) * 0.012 - W.t * 0.5;
  const s = (W.s * (1 + 0.25 * Math.sin(ph)) + W.gust * 6) * (1 + Math.max(0, y) / 160);
  return [W.dx * s, W.dz * s];
}
const windName = a => ['O', 'SO', 'S', 'SW', 'W', 'NW', 'N', 'NO'][((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];

/* ---------- Bäume und Gras: Krone biegt sich in Windrichtung, Böen laufen als Welle durch ---------- */
function windPatch(mat, strength = 1, flutter = 0, grass = false) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uTime; uniform vec4 uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
          mat3 im3 = mat3(instanceMatrix);
        #else
          vec2 ip = vec2(0.0);
          mat3 im3 = mat3(1.0);
        #endif
        // Wind im Objektraum der Pflanze (Instanzen sind gedreht)
        vec3 wl = normalize(transpose(im3) * vec3(uWind.x, 0.0, uWind.y) + 1e-5);
        float ph = dot(ip, vec2(0.13, 0.071));
        float wave = 0.5 + 0.5 * sin(dot(ip, uWind.xy) * 0.012 - uTime * 0.5);
        float str = uWind.z / 5.0 * (0.7 + 0.6 * wave) + uWind.w * 1.4;
        float h = ${grass ? 'max(position.y, 0.0) * 1.6' : 'max(position.y - 1.5, 0.0) / 6.0'};
        float bend = pow(h, 1.6) * ${strength.toFixed(2)} * str;
        float sw = sin(uTime * (0.9 + str * 0.6) + ph) * 0.6 + sin(uTime * 1.73 + ph * 1.3) * 0.3 + sin(uTime * 3.1 + ph * 2.1) * 0.1;
        // Grundbiegung mit dem Wind, darauf Pendeln und quer ein wenig Schlingern
        vec3 side = vec3(-wl.z, 0.0, wl.x);
        transformed += wl * bend * (${grass ? '0.25' : '0.16'} + sw * 0.07) + side * bend * sw * 0.035;
        transformed.y -= bend * bend * 0.02;
        ${flutter ? `transformed += normal * sin(uTime * (6.0 + str * 3.0) + dot(position, vec3(3.1, 2.3, 1.7)) + ph) * ${flutter.toFixed(3)} * (0.5 + str) * step(1.0, position.y);` : ''}
      }`);
  };
  return mat;
}

/* ---------- Fahnen auf Dächern, am Belmont-Platz, an der Promenade und im Hafen ---------- */
const FLAGS = [];
function flagTex() {
  return canvasTex(256, 128, (g, W, H) => {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, W, H);
    // Art-Déco-Fächer und Goldstreifen am Liek
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 18, H); g.fillRect(0, 10, W, 6); g.fillRect(0, H - 16, W, 6);
    g.save(); g.translate(W * 0.42, H * 0.86); g.fillStyle = 'rgba(255,255,255,0.95)';
    for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) / 9 * Math.PI; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, H * 0.62, a - 0.07, a + 0.07); g.closePath(); g.fill(); }
    g.beginPath(); g.arc(0, 0, H * 0.14, Math.PI, 0); g.fill(); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }, 2);
}
function addFlag(x, y, z, size = 1, col = null, pole = 8) { FLAGS.push({ x, y, z, s: size, c: col || pick([[0.05, 0.42, 0.44], [0.85, 0.62, 0.25], [0.55, 0.06, 0.09], [0.86, 0.82, 0.72], [0.04, 0.2, 0.28]]), pole }); }
function placeFlags() {
  // Dächer der hohen Häuser: an einer Ecke der obersten Stufe
  for (const b of blocks) {
    if (!b.tier || b.factory || R() > (b.tier === 'landmark' ? 0.8 : 0.35)) continue;
    let top = null;
    for (const q of nearBoxes((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, 30)) if (q.x0 >= b.x0 - 1 && q.x1 <= b.x1 + 1 && q.z0 >= b.z0 - 1 && q.z1 <= b.z1 + 1 && (!top || q.y1 > top.y1)) top = q;
    if (!top || top.y1 < 25 || top.x1 - top.x0 < 6) continue;
    const cx = R() < 0.5 ? top.x0 + 1.2 : top.x1 - 1.2, cz = R() < 0.5 ? top.z0 + 1.2 : top.z1 - 1.2;
    addFlag(cx, top.y1, cz, 1.4 + R() * 0.6, null, 7);
  }
  // Belmont-Platz: Reihe großer Fahnen in Gold und Petrol
  for (let k = 0; k < 6; k++) { const x = PLAZA.x0 + 8 + k * (PLAZA.x1 - PLAZA.x0 - 16) / 5; addFlag(x, 0.26, PLAZA.z1 - 4, 1.8, k % 2 ? [0.85, 0.62, 0.25] : [0.05, 0.42, 0.44], 14); }
  // Hafenkante
  for (let x = -700; x <= 760; x += 90) if (onIsland(x, ISL.quay - 4, 0.5)) addFlag(x, 0.26, ISL.quay - 3.5, 1.3, null, 10);
  // Ringstraße: an jeder sechsten Laterne eine Fahne
  OUTER.paths.forEach((P, i) => { if (i % 3) return; for (let k = 10; k < P.length; k += 40) addFlag(P[k][0], 0.02, P[k][1], 1.0, null, 7); });
}
function buildFlags() {
  placeFlags();
  if (!FLAGS.length) return;
  const n = FLAGS.length;
  // Tuch: 12 x 6 Felder, hängt vom Mastkopf aus nach +x
  const cloth = new T.PlaneGeometry(2.6, 1.6, 14, 6).translate(1.3, -0.8, 0);
  const tex = flagTex();
  const mat = stdMat({ map: tex, side: T.DoubleSide, roughness: 0.85, metalness: 0, envI: 0.25, emissive: 0x070707 });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind;
    sh.vertexShader = 'uniform float uTime; uniform vec4 uWind;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec2 ip = instanceMatrix[3].xz;
        float fph = dot(ip, vec2(0.37, 0.21));
        float fstr = clamp(uWind.z / 7.0 + uWind.w * 0.8, 0.12, 1.4);
        float fx = position.x / 2.6;
        float fsp = 5.0 + uWind.z * 0.9 + uWind.w * 4.0;
        float fw = sin(position.x * 2.4 - uTime * fsp + fph) * (0.06 + 0.32 * fx) * (0.5 + fstr * 0.6) + sin(position.x * 4.7 - uTime * fsp * 1.6 + position.y * 2.0 + fph) * 0.05 * fx;
        float fdw = cos(position.x * 2.4 - uTime * fsp + fph) * 2.4 * (0.06 + 0.32 * fx);
        vec2 fwd = normalize(uWind.xy + 1e-5); vec2 fpd = vec2(-fwd.y, fwd.x);
        objectNormal = normalize(vec3(fpd.x - fwd.x * fdw * 0.4, 0.0, fpd.y - fwd.y * fdw * 0.4));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // bei Flaute hängt das Tuch am Mast, bei Wind steht es aus
          float hang = 1.0 - clamp(fstr, 0.0, 1.0);
          float lx = position.x * mix(1.0, 0.25, hang);
          float ly = position.y - position.x * hang * 0.95 - fx * fx * 0.25 * (1.0 - hang);
          transformed = vec3(fwd.x * lx + fpd.x * fw, ly, fwd.y * lx + fpd.y * fw);
        }`);
  };
  const im = new T.InstancedMesh(cloth, mat, n), c = new T.Color();
  const poleG = mergeColored([[new T.CylinderGeometry(0.05, 0.08, 1, 8).translate(0, 0.5, 0), [0.75, 0.7, 0.62]], [new T.SphereGeometry(0.11, 10, 8).translate(0, 1.0, 0), COL.gold]]);
  const pm = new T.InstancedMesh(poleG, paintMat({ color: 0xffffff, metalness: 0.6, roughness: 0.35, envI: 0.8 }), n);
  FLAGS.forEach((f, i) => {
    im.setMatrixAt(i, _m.compose(_p.set(f.x, f.y + f.pole - 0.15, f.z), _q.identity(), _s.setScalar(f.s)));
    im.setColorAt(i, c.setRGB(...f.c));
    pm.setMatrixAt(i, _m.compose(_p.set(f.x, f.y, f.z), _q.identity(), _s.set(1, f.pole, 1)));
    if (f.y < 1) addCollider(f.x - 0.1, f.y, f.z - 0.1, f.x + 0.1, f.y + f.pole, f.z + 0.1);
  });
  im.frustumCulled = pm.frustumCulled = false; scene.add(im, pm);
}

/* ---------- Laub und Zeitungsblätter, die durch die Straßen wirbeln ---------- */
const LEAVES = { n: MOBILE ? 50 : 140, list: [], im: null };
function buildLeaves() {
  const g = new T.PlaneGeometry(0.16, 0.11).rotateX(-Math.PI / 2);
  const m = stdMat({ color: 0xffffff, side: T.DoubleSide, roughness: 0.9, envI: 0.2, emissive: 0x0a0806 });
  const im = new T.InstancedMesh(g, m, LEAVES.n), c = new T.Color();
  for (let i = 0; i < LEAVES.n; i++) {
    const paper = i % 9 === 0;
    LEAVES.list.push({ x: 0, y: -50, z: 0, vx: 0, vy: 0, vz: 0, r: Math.random() * 6, rs: 2 + Math.random() * 5, s: paper ? 2.6 : 0.8 + Math.random() * 0.6, paper });
    im.setColorAt(i, paper ? c.setRGB(0.78, 0.75, 0.66) : c.setRGB(...pick([[0.42, 0.24, 0.08], [0.55, 0.36, 0.1], [0.3, 0.2, 0.08], [0.48, 0.15, 0.06]])));
  }
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false; im.userData.noRefl = true; scene.add(im);
  LEAVES.im = im;
}
const _le = new T.Euler();
function updateLeaves(dt) {
  if (!LEAVES.im) return;
  const cp = camera.position, far = cp.y > 40;
  LEAVES.im.visible = !far;
  if (far) return;
  LEAVES.list.forEach((L, i) => {
    // weit weg oder liegen geblieben: neu in der Nähe, gegen den Wind versetzt
    if ((L.x - cp.x) ** 2 + (L.z - cp.z) ** 2 > 3600 || L.y < -5) {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 40;
      L.x = cp.x + Math.cos(a) * r - WIND.dx * 20; L.z = cp.z + Math.sin(a) * r - WIND.dz * 20; L.y = 0.05 + Math.random() * 3; L.vx = L.vz = L.vy = 0;
      if (!onIsland(L.x, L.z, 1) || blockAt(L.x, L.z, -6)) { L.y = -50; return; }
    }
    const [wx, wz] = windAt(L.x, L.z, L.y);
    const gnd = (typeof curbHeight === 'function' ? curbHeight(L.x, L.z) : 0) + 0.02;
    const lift = WIND.gust * 3.5 + Math.max(0, WIND.s - 5) * 0.3;
    const onG = L.y <= gnd + 0.01;
    const k = onG ? (lift > 1.4 || Math.hypot(wx, wz) > 6.5 ? 0.6 : 0.05) : (L.paper ? 1.1 : 1.6);
    L.vx += (wx * 0.8 - L.vx) * Math.min(1, dt * k); L.vz += (wz * 0.8 - L.vz) * Math.min(1, dt * k);
    L.vy += (-1.2 + lift * (onG ? 0.6 : 0.35) + Math.sin(L.r * 1.7) * 0.6) * dt;
    L.vy *= Math.max(0, 1 - dt * (L.paper ? 1.8 : 2.6));
    L.x += L.vx * dt; L.z += L.vz * dt; L.y += L.vy * dt;
    if (L.y < gnd) { L.y = gnd; L.vy = 0; }
    if (blockAt(L.x, L.z, -1)) { L.vx *= -0.3; L.vz *= -0.3; L.x += L.vx * dt * 2; L.z += L.vz * dt * 2; }
    L.r += (onG ? Math.hypot(L.vx, L.vz) * 0.6 : L.rs) * dt;
    _le.set(onG ? 0 : Math.sin(L.r) * 1.2, L.r * 0.7, onG ? 0 : Math.cos(L.r * 1.3) * 0.9);
    LEAVES.im.setMatrixAt(i, _m.compose(_p.set(L.x, L.y, L.z), _q.setFromEuler(_le), _s.setScalar(L.s)));
  });
  LEAVES.im.instanceMatrix.needsUpdate = true;
}

/* ---------- Windgeräusch: Rauschen, bei Böen und in der Höhe lauter ---------- */
let WAU = null;
function initWindAudio() {
  if (WAU) { if (WAU.ctx.state === 'suspended') WAU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    const ctx = new AC(), nb = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = nb.getChannelData(0);
    // braunes Rauschen: tiefer, weicher
    let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start();
    WAU = { ctx, bp, g };
  } catch (e) { WAU = null; }
}
function updateWindAudio() {
  if (!WAU) return;
  const t = WAU.ctx.currentTime, cp = camera.position;
  const inside = typeof inBelmont === 'function' && inBelmont(cp.x, cp.z, cp.y);
  const alt = Math.min(1, Math.max(0, cp.y) / 200), sp = DRIVE.on && DRIVE.body ? Math.hypot(DRIVE.body.vx, DRIVE.body.vz) : 0;
  const v = inside || paused ? 0 : Math.min(0.5, 0.03 + WIND.s * 0.006 + WIND.gust * 0.1 + alt * 0.12 + sp * 0.003);
  WAU.g.gain.setTargetAtTime(v, t, 0.4);
  WAU.bp.frequency.setTargetAtTime(260 + WIND.gust * 500 + alt * 300 + sp * 8, t, 0.5);
}
