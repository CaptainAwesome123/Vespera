import { T, camera, canvasTex, MOBILE } from './core.js';
import { player } from './player.js';
import { fxEmit } from './particles.js';
import { POWERS } from './powers.js';
import { toast } from './boat.js';
import { playing, paused } from './input.js';
import { INTERACT } from './music.js';
import { addLight, LIGHTS } from './performance.js';
import { SND, sndGain, sndChain, sndLoop, sndFilter, sndSet, sndTone, sndBurst, crystalChime } from './audio.js';

/* =====================================================================
   V57 · DER METEORITENKRISTALL IM PENTHOUSE
   Der Kristall aus dem Kern des Meteoriten steht in der Vitrine auf der Salonachse von Alexanders Suite (Kanon: er bleibt dort,
   nur Alexander hat ihn als Erster berührt, nur er hat die Kräfte). Hier bekommt er Leben:
   - Er schwebt ein paar Zentimeter über seinem Gesteinsbett und dreht sich langsam; sein Leuchten pulsiert wie ein ruhiger Herzschlag.
   - Ein türkiser Lichthof um ihn, feine Strahlen in der Glasglocke, ein Lichtspiel an der Decke über dem Salon und ein Schein auf dem Boden.
   - Ein eigenes Licht (aus dem Pool der vier Punktlichter) färbt den Salon um die Vitrine leicht türkis.
   - Klang: in der Nähe ein tiefes, schwebendes Summen mit feinem Glitzern; ab und zu klingt er hell an, dann blitzt er kurz auf.
   - E an der Vitrine: »Den Kristall berühren«. Die Glasglocke hebt sich, Alexander streckt die Hand aus, bei der Berührung
     erkennt ihn der Kristall wieder und flammt auf (nur ein Effekt, die Kräfte hat Alexander seit der ersten Berührung): Lichtblitz, eine Welle läuft über den Boden, die Kamera bebt, Energie strömt in Alexander,
     ein mächtiger Akkord. Danach umgibt ihn eine Weile ein türkiser Schimmer, die Glocke senkt sich wieder.
   Alles mit fertigen Materialien (Sprite, MeshBasic additiv, die vorhandene Kristall-Partikelart), kein neuer Shader.
   ===================================================================== */
export const CRY = { g: null, at: new T.Vector3(), base: 0, scene: null, aura: 0, hum: null, chimeT: 3, flare: 0, light: null, near: false, t: 0 };
const TEAL = new T.Color(0.35, 1.15, 1.05);
const _v = new T.Vector3(), _h = new T.Vector3();
const sst = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// weicher runder Lichthof
function haloTex() {
  return canvasTex(128, 128, (g, w) => {
    const c = w / 2, r = g.createRadialGradient(c, c, 0, c, c, c);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.55)'); r.addColorStop(0.45, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}
// Strahl: unten hell, nach oben und zu den Rändern auslaufend
function rayTex() {
  return canvasTex(64, 128, (g, w, h) => {
    h = h || 128; g.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const a = Math.pow(y / h, 1.6);
      const r = g.createLinearGradient(0, 0, w, 0); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, `rgba(255,255,255,${a})`); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect(0, y, w, 1);
    }
  });
}
// Lichtspiel an der Decke: Ringe und gebrochene Wellen wie durch Kristall und Wasser
function causticTex() {
  return canvasTex(256, 256, (g, w) => {
    const c = w / 2; g.clearRect(0, 0, w, w); g.globalCompositeOperation = 'lighter';
    let s = 11; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 9; k++) {   // Ringe
      const rr = c * (0.15 + k * 0.095), a = 0.22 * (1 - k / 10);
      g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2 + rnd() * 3; g.beginPath();
      for (let i = 0; i <= 96; i++) { const t = i / 96 * Math.PI * 2, q = rr * (1 + 0.06 * Math.sin(t * (5 + k) + k) + 0.03 * Math.sin(t * 13)); i ? g.lineTo(c + Math.cos(t) * q, c + Math.sin(t) * q) : g.moveTo(c + Math.cos(t) * q, c + Math.sin(t) * q); }
      g.stroke();
    }
    for (let k = 0; k < 14; k++) {   // Lichtzungen
      const a0 = rnd() * Math.PI * 2, L = c * (0.5 + rnd() * 0.45);
      const gr = g.createLinearGradient(c, c, c + Math.cos(a0) * L, c + Math.sin(a0) * L); gr.addColorStop(0, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = gr; g.lineWidth = 3 + rnd() * 6; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a0) * L, c + Math.sin(a0) * L); g.stroke();
    }
    const r = g.createRadialGradient(c, c, 0, c, c, c); r.addColorStop(0, 'rgba(255,255,255,0.5)'); r.addColorStop(0.3, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
    // Rand weich ausblenden
    g.globalCompositeOperation = 'destination-in'; const m = g.createRadialGradient(c, c, c * 0.6, c, c, c); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, w);
  });
}
// Ring für Bodenschein und Druckwelle
function ringTex() {
  return canvasTex(256, 256, (g, w) => {
    const c = w / 2, r = g.createRadialGradient(c, c, 0, c, c, c);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.62, 'rgba(255,255,255,0.05)'); r.addColorStop(0.86, 'rgba(255,255,255,0.9)'); r.addColorStop(0.93, 'rgba(255,255,255,0.35)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.clearRect(0, 0, w, w); g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
}
const addMat = (map, col, op) => new T.MeshBasicMaterial({ map, color: col.clone(), transparent: true, opacity: op, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });

/* Aufbau: aus buildPenthouse, in die Innen-Gruppe der Suite (wird mit ihr ein- und ausgeblendet).
   x, y, z: Mitte der Glasplatte, auf der das Gesteinsbett liegt; ceil: Höhe der Decke darüber; floor: Fußboden */
export function buildCrystal(group, mats, x, y, z, floor, ceil) {
  const g = new T.Group(); g.position.set(x, y, z); group.add(g); CRY.g = g; CRY.at.set(x, y + 0.42, z); CRY.base = y; CRY.floor = floor;
  CRY.meteor = mats.meteor; CRY.e0 = mats.meteor.emissiveIntensity;
  // Kristallgruppe (vorher fest in der Suite verschmolzen): schwebt und dreht sich
  const geos = [];
  for (const [dx, dz, h, a] of [[0, 0, 0.62, 0], [0.12, -0.08, 0.42, 0.4], [-0.1, 0.1, 0.34, -0.5], [0.05, 0.14, 0.26, 0.9], [-0.09, -0.1, 0.22, 2.1], [0.15, 0.08, 0.18, -1.4]])
    geos.push(new T.OctahedronGeometry(0.11, 0).scale(1, h / 0.11, 1).rotateZ(a * 0.3).rotateY(a).translate(dx, h * 0.55, dz));
  const sg = new T.BufferGeometry(), n = geos.reduce((s, q) => s + q.attributes.position.count, 0), P = new Float32Array(n * 3); let o = 0;
  for (const q of geos) { P.set(q.attributes.position.array, o); o += q.attributes.position.array.length; }
  sg.setAttribute('position', new T.BufferAttribute(P, 3)); sg.computeVertexNormals();
  CRY.shards = new T.Mesh(sg, mats.meteor); g.add(CRY.shards);
  // Glasglocke: hebt sich, wenn Alexander den Kristall berührt
  CRY.dome = new T.Mesh(new T.LatheGeometry([[0.45, 0], [0.45, 0.45], [0.38, 0.75], [0.2, 0.88], [0, 0.9]].map(([r, h]) => new T.Vector2(r, h)), 24), mats.glass);
  CRY.dome.renderOrder = 2; g.add(CRY.dome);
  // Lichthof (Sprite, immer zur Kamera)
  CRY.halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex(), color: TEAL.clone(), transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  CRY.halo.position.set(0, 0.36, 0); CRY.halo.scale.setScalar(1.5); CRY.halo.renderOrder = 3; g.add(CRY.halo);
  // feine Strahlen in der Glocke: drei gekreuzte Flächen, die sich langsam gegeneinander drehen
  const rt = rayTex(); CRY.rays = new T.Group(); CRY.rays.position.y = 0.05; g.add(CRY.rays);
  for (let k = 0; k < 3; k++) { const m = new T.Mesh(new T.PlaneGeometry(0.5, 0.85).translate(0, 0.42, 0), addMat(rt, TEAL, 0.22)); m.material.polygonOffset = false; m.rotation.y = k * Math.PI / 3; m.renderOrder = 3; CRY.rays.add(m); }
  // Lichtspiel an der Decke und Schein auf dem Boden
  CRY.caustic = new T.Mesh(new T.PlaneGeometry(9, 9).rotateX(Math.PI / 2), addMat(causticTex(), TEAL, 0.45)); CRY.caustic.position.set(x, ceil - 0.02, z); group.add(CRY.caustic);
  const rgt = ringTex();
  CRY.pool = new T.Mesh(new T.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), addMat(rgt, TEAL, 0.32)); CRY.pool.position.set(x, floor + 0.05, z); group.add(CRY.pool);
  CRY.wave = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), addMat(rgt, TEAL, 0)); CRY.wave.position.set(x, floor + 0.06, z); CRY.wave.visible = false; group.add(CRY.wave);
  // eigenes Licht in der Suite (türkis, der Pool nimmt es, wenn es zu den vier nächsten gehört)
  addLight(0x2fd6c6, 0.9, 9, 1.6, x, y + 0.6, z, true); CRY.light = LIGHTS[LIGHTS.length - 1]; CRY.l0 = CRY.light.i;
  // Berühren
  INTERACT.push({ test: p => !CRY.scene && Math.hypot(p.x - x, p.z - z) < 1.75 && Math.abs(p.y - floor) < 1, label: 'Den Kristall berühren', act: touchCrystal });
  CRY.g.updateMatrixWorld(true);
}

/* ---------- Klang ---------- */
function buildHum() {
  const ctx = SND.ctx, H = CRY.hum = { g: sndGain(0) };
  // langsames Atmen der Lautstärke, dann in den Effekt-Bus und etwas in den Nachhall
  const am = sndGain(0.7), lfo = ctx.createOscillator(), lg = sndGain(0.3); lfo.frequency.value = 0.23; lfo.connect(lg); lg.connect(am.gain); lfo.start();
  sndChain(H.g, am, SND.bus.sfx);
  if (SND.bus.rev) { const r = sndGain(0.35); am.connect(r); r.connect(SND.bus.rev); }
  // tiefer Grundton mit Quinte und leiser Oktave, minimal verstimmt: es schwebt
  H.osc = [[98, 0.5, 'sine'], [98.7, 0.4, 'sine'], [147, 0.28, 'sine'], [196.4, 0.12, 'triangle'], [293.7, 0.05, 'sine']].map(([f, v, ty]) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = f; const gg = sndGain(v); o.connect(gg); gg.connect(H.g); o.start(); return o; });
  // feines Glitzern darüber
  H.sh = sndGain(0); sndChain(sndLoop(SND.noise, 1), sndFilter('bandpass', 6400, 8), H.sh, am);
}
function updateHum(d, dt) {
  if (!SND.started || !SND.ctx || !SND.on || SND.ctx.state !== 'running' || !SND.bus.sfx) return;
  if (!CRY.hum) { if (d > 30) return; buildHum(); }
  const k = d < 16 ? Math.pow(1 - d / 16, 1.6) : 0, S = CRY.scene;
  const boost = S ? (S.t < 1 ? 1 + 2.5 * sst(S.t) : 3.5 * Math.exp(-(S.t - 1) * 0.6) + 1) : 1 + CRY.flare * 0.8;
  sndSet(CRY.hum.g.gain, 0.05 * k * boost, 0.25); sndSet(CRY.hum.sh.gain, 0.04 * k * boost, 0.3);
  // ab und zu klingt er an (und blitzt auf)
  if (k > 0.3 && !S && (CRY.chimeT -= dt) <= 0) { CRY.chimeT = 5 + Math.random() * 7; crystalChime(SND.ctx.currentTime, 0.012 + 0.012 * k); CRY.flare = 1; }
}
function touchSound(kind) {
  if (!SND.started || !SND.ctx || !SND.on || SND.ctx.state !== 'running') return;
  const ctx = SND.ctx, t = ctx.currentTime;
  if (kind === 'lift') {
    // die Glocke gleitet auf: gläsernes Streichen, ein Ton steigt an
    sndBurst(t, 0.9, 3800, 6, 0.03); sndTone(147, t, 1.2, 0.08, 'sine', 'sfx', 294, 0.3); crystalChime(t + 0.2, 0.02);
    return;
  }
  // Berührung: dumpfer Schlag, Druckwelle, heller Kristallklang und ein großer Akkord, der lange nachklingt
  sndTone(62, t, 2.2, 0.55, 'sine', 'sfx', 31, 0.4); sndBurst(t, 1.4, 420, 0.7, 0.3, 'sfx', 'lowpass', true);
  crystalChime(t, 0.09); crystalChime(t + 0.45, 0.05); crystalChime(t + 1.1, 0.03);
  for (const [f, v] of [[155.6, 0.07], [233.1, 0.06], [311.1, 0.05], [392, 0.04], [466.2, 0.035], [622.3, 0.025], [932.3, 0.015]]) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    o.connect(g); g.connect(SND.bus.sfx); if (SND.bus.rev) { const r = ctx.createGain(); r.gain.value = 0.6; g.connect(r); r.connect(SND.bus.rev); }
    o.start(t); o.stop(t + 5.6);
  }
}

/* ---------- Szene: Alexander berührt den Kristall ---------- */
const S_LIFT = 0.9, S_TOUCH = 1.25, S_LET = 3.6, S_DOWN = 4.3, S_END = 5.6;
export function touchCrystal() {
  if (CRY.scene) return;
  CRY.scene = { t: 0, touched: false, yaw0: player.yaw, pitch0: player.pitch };
  touchSound('lift');
}
function scenePose(S) {
  // Blick wandert zum Kristall, Hand greift durch die offene Glocke
  const a = CRY.at, dx = a.x - camera.position.x, dz = a.z - camera.position.z, dy = a.y - camera.position.y;
  const wy = Math.atan2(-dx, -dz), wp = Math.atan2(dy, Math.hypot(dx, dz)), k = S.t < S_LET ? sst(S.t / 0.7) * 0.12 : 0;
  if (k > 0) { let d = wy - player.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); player.yaw += d * k; player.pitch += (wp - player.pitch) * k; }
  const near = Math.hypot(player.p.x - a.x, player.p.z - a.z) < 2.4;
  POWERS.reach = near && S.t > 0.35 && S.t < S_LET ? (POWERS.reach || new T.Vector3()).copy(a) : null;
}
function updateScene(S, dt) {
  if (!S.hold && (!playing || paused) && !CRY.lab) return;
  if (!S.hold) S.t += dt;
  const t = S.t;
  // Glocke hebt sich und schwebt, dann senkt sie sich wieder
  const up = t < S_DOWN ? sst(t / S_LIFT) : 1 - sst((t - S_DOWN) / (S_END - S_DOWN - 0.2));
  CRY.dome.position.y = up * 0.75; CRY.dome.rotation.y = up * 0.6;
  if (!S.hold && !CRY.lab) scenePose(S);
  if (t >= S_TOUCH && !S.touched) {
    S.touched = true;
    touchSound('touch');
    POWERS.shake = Math.min(1, POWERS.shake + 0.75);
    const a = CRY.at; fxEmit('crystal', a.x, a.y, a.z, 0, 2, 0, MOBILE ? 40 : 90, 1.6, 1.4);
    CRY.wave.visible = true;
    toast('Der Kristall erkennt Alexander wieder und leuchtet auf');
    CRY.aura = 40;
  }
  // Energie strömt vom Kristall in Alexander
  if (S.touched && t < S_LET + 0.4 && !S.hold) {
    const a = CRY.at, p = player.p; _h.set(p.x, p.y + 1.2, p.z).sub(a);
    for (let i = 0; i < (MOBILE ? 2 : 5); i++) { const u = Math.random() * 0.3; fxEmit('crystal', a.x + _h.x * u, a.y + _h.y * u, a.z + _h.z * u, _h.x * 1.6, _h.y * 1.6 + 0.5, _h.z * 1.6, 1, 0.12, 0.8); }
    fxEmit('crystal', p.x + (Math.random() - 0.5) * 0.9, p.y + Math.random() * 1.9, p.z + (Math.random() - 0.5) * 0.9, 0, 1.6, 0, 1, 0.1, 0.9);
  }
  // Druckwelle über den Boden
  const wt = t - S_TOUCH;
  if (CRY.wave.visible) { const r = 0.8 + wt * 9; CRY.wave.scale.set(r, 1, r); CRY.wave.material.opacity = Math.max(0, 0.85 * (1 - wt / 1.6)); if (wt > 1.6) CRY.wave.visible = false; }
  if (t > S_END && !S.hold) { CRY.scene = null; POWERS.reach = null; }
}

/* ---------- jedes Bild ---------- */
export function updateCrystal(dt, time) {
  if (!CRY.g) return;
  const d = camera.position.distanceTo(CRY.at), S = CRY.scene;
  updateHum(d, dt);
  if (!S && (d > 70 || !CRY.g.parent.visible)) { if (CRY.light) CRY.light.i = CRY.l0; return; }
  CRY.t += dt; const t = CRY.t;
  if (S) updateScene(S, dt);
  // Herzschlag: zwei kurze Schläge, dann Ruhe
  const ph = (t * 0.75) % 1, beat = Math.exp(-((ph - 0.08) ** 2) / 0.002) + 0.6 * Math.exp(-((ph - 0.24) ** 2) / 0.002);
  CRY.flare = Math.max(0, CRY.flare - dt * 1.5);
  const wt = S && S.touched ? S.t - S_TOUCH : -1, flash = wt >= 0 ? Math.exp(-wt * 1.4) : 0, pre = S && !S.touched ? sst(S.t / S_TOUCH) : 0;
  const glow = 1 + 0.35 * beat + 0.8 * CRY.flare + 1.2 * pre + 6 * flash + (S && S.touched ? 0.8 : 0);
  CRY.meteor.emissiveIntensity = CRY.e0 * Math.min(2.2, 0.85 + 0.4 * (glow - 1));   // gedeckelt: sonst wird er im Glühen weiß statt türkis
  // schweben und drehen, bei der Berührung kurz höher
  CRY.shards.position.y = 0.05 + 0.025 * Math.sin(t * 0.9) + 0.12 * (pre + (S && S.touched ? Math.max(0, 1 - wt / 3) : 0));
  CRY.shards.rotation.y += dt * (0.18 + 1.6 * pre + 3 * flash);
  CRY.halo.position.y = CRY.shards.position.y + 0.32;
  CRY.halo.material.opacity = Math.min(1, 0.42 + 0.15 * beat + 0.3 * CRY.flare + 0.3 * pre + 0.6 * flash);
  CRY.halo.scale.setScalar(1.3 + 0.15 * beat + 0.5 * pre + 5 * flash);
  CRY.rays.rotation.y -= dt * 0.25; CRY.rays.children.forEach((m, i) => { m.rotation.z = Math.sin(t * 0.4 + i * 2) * 0.12; m.material.opacity = 0.16 + 0.06 * Math.sin(t * 1.3 + i) + 0.12 * beat + 0.4 * flash; });
  CRY.caustic.rotation.y += dt * 0.05; CRY.caustic.material.opacity = 0.38 + 0.06 * Math.sin(t * 0.7) + 0.06 * beat + 0.15 * CRY.flare + 0.7 * flash;
  CRY.pool.material.opacity = 0.24 + 0.1 * beat + 0.15 * CRY.flare + 0.5 * flash; CRY.pool.scale.setScalar(1 + 0.04 * Math.sin(t * 0.6) + 0.6 * flash);
  if (CRY.light) CRY.light.i = CRY.l0 * Math.min(3, 0.75 + 0.35 * glow);
  // aufsteigende Funken in der Glocke
  if (d < 25 && Math.random() < dt * (3 + 20 * pre)) { const a = CRY.at; fxEmit('crystal', a.x + (Math.random() - 0.5) * 0.4, CRY.base + 0.15, a.z + (Math.random() - 0.5) * 0.4, 0, 0.4, 0, 1, 0.05, 0.5); }
  updateAura(dt);
}
// nach der Berührung: ein türkiser Schimmer um Alexander, der langsam vergeht
function updateAura(dt) {
  if (CRY.aura <= 0) return;
  CRY.aura -= dt; const k = Math.min(1, CRY.aura / 10), p = player.p;
  if (Math.random() < dt * 14 * k) { const a = Math.random() * Math.PI * 2, r = 0.35 + Math.random() * 0.25; fxEmit('crystal', p.x + Math.cos(a) * r, p.y + 0.2 + Math.random() * 1.6, p.z + Math.sin(a) * r, 0, 0.5, 0, 1, 0.05, 0.6); }
}
// außerhalb der Suite läuft der Schimmer weiter (die Suite-Gruppe ist dann unsichtbar und updateCrystal kehrt früh zurück)
export function crystalAura(dt) { if (CRY.aura > 0 && CRY.g && (!CRY.g.parent.visible || camera.position.distanceTo(CRY.at) > 70)) updateAura(dt); }
