import { MOBILE, camera, shared, U } from './core.js';
import { player } from './player.js';
import { playing, paused } from './input.js';
import { inBelmont } from './belmont.js';
import { inPenthouse, onPentTerrace } from './penthouse.js';
import { inVillaHouse } from './villa.js';
import { VILLA } from './harbour.js';
import { IMP, inImperial } from './imperial.js';
import { ATMO } from './atmosphere.js';
import { POWERS } from './powers.js';
import { trams, TRF } from './traffic.js';
import { peds } from './serpentine.js';
import { onIsland } from './island.js';
import { WIND } from './wind.js';
import { BOAT, toast } from './boat.js';
import { DRIVE } from './eating.js';
import { DINE } from './venues.js';

/* =====================================================================
   V38 · KLANG VON VESPERA
   Ein gemeinsamer AudioContext für alles (Jazz, Wind, Motor, Stadt, Wetter, Schritte, Kräfte).
   Mischpult: master (Taste M, Pause leiser) ← music · out (draußen: Stadt, Wetter, Wind, gedämpft im Haus) · near · sfx.
   Fast alles wird live erzeugt (Rauschen, Oszillatoren). Nur Schritte, Landung, Wusch, Gläser, Metall und Geröll
   kommen als freie Kenney-Klänge (CC0) aus einer kleinen Datei (assets/audio/vespera-sfx.mp3, 164 KB),
   die erst nach dem Klick auf „Eintreten“ geladen wird. Herkunft: assets/LICENSES.md.
   ===================================================================== */
export const SND = {
  ctx: null, master: null, bus: {}, on: true, started: false, sprite: null, noise: null, brown: null, rev: null,
  L: {}, t: 0, slow: 0, ev: {}, step: 0, surf: 'stone', zone: '', last: {}, prev: {}, tramBell: new WeakSet(),
};
// Lage im Clip-Bogen (Sekunden): [Anfang, Dauer] je Variante
export const SND_SPRITE = {"step_concrete":[[0.12,0.103],[0.343,0.1047],[0.5678,0.1099],[0.7976,0.1076],[1.0252,0.1115]],"step_snow":[[1.2567,0.1865],[1.5632,0.1866],[1.8698,0.371],[2.3607,0.3713],[2.8521,0.3711]],"step_wood":[[3.3432,0.2526],[3.7158,0.2487],[4.0845,0.2485],[4.4529,0.2486],[4.8215,0.245]],"step_carpet":[[5.1865,0.1461],[5.4527,0.1419],[5.7146,0.1419],[5.9764,0.1419],[6.2383,0.1419]],"step_grass":[[6.5002,0.168],[6.7882,0.6707],[7.5789,0.1664],[7.8653,0.1897],[8.1749,0.5873]],"land":[[8.8822,0.5361],[9.5383,0.4486]],"thud":[[10.1069,0.5079],[10.7348,0.5691],[11.4239,0.5694]],"glass":[[12.1133,0.1698],[12.4031,0.2067],[12.7298,0.2067],[13.0565,0.2067],[13.3832,0.1782]],"metal":[[13.6814,0.3006],[14.102,0.2489],[14.471,0.2329]],"debris":[[14.8239,0.7615],[15.7053,0.717],[16.5423,0.6599],[17.3222,0.7016]],"woosh":[[18.1437,0.3515],[18.6152,0.1902],[18.9254,0.5759],[19.6212,0.3477],[20.0889,0.2124]]};
export const SND_KEY = 'vespera-ton';

/* ---------- gemeinsamer Context und Busse ---------- */
export function audioCtx() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended' && SND.on) SND.ctx.resume(); return SND.ctx; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { SND.ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return null; }
  const ctx = SND.ctx;
  try { SND.on = localStorage.getItem(SND_KEY) !== 'aus'; } catch (e) { SND.on = true; }
  // sanfter Begrenzer am Ende, damit sich viele Quellen nie übersteuern
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.25;
  lim.connect(ctx.destination);
  const master = SND.master = ctx.createGain(); master.gain.value = 0; master.connect(lim);
  const B = SND.bus;
  for (const k of ['music', 'near', 'sfx']) { B[k] = ctx.createGain(); B[k].connect(master); }
  // draußen: alles, was im Haus nur gedämpft durch Wände und Fenster kommt
  B.outF = ctx.createBiquadFilter(); B.outF.type = 'lowpass'; B.outF.frequency.value = 16000; B.outF.Q.value = 0.4; B.outF.connect(master);
  B.out = ctx.createGain(); B.out.connect(B.outF);
  // Nachhall für Marmorhallen (Lobby, Ballsaal, Villa): kurzer erzeugter Raum, auf dem Handy aus
  if (!MOBILE) {
    const n = Math.floor(ctx.sampleRate * 1.6), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    SND.rev = ctx.createConvolver(); SND.rev.buffer = ir;
    B.rev = ctx.createGain(); B.rev.gain.value = 0; B.rev.connect(SND.rev); SND.rev.connect(master);
  }
  // gemeinsame Rauschpuffer: weiß und braun (tief, weich)
  const len = ctx.sampleRate * 3;
  SND.noise = ctx.createBuffer(1, len, ctx.sampleRate); const w = SND.noise.getChannelData(0); for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
  SND.brown = ctx.createBuffer(1, len, ctx.sampleRate); const b = SND.brown.getChannelData(0); let l = 0;
  for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
  return ctx;
}
export function audioBus(name) { return audioCtx() ? SND.bus[name] || SND.master : null; }
export function soundMuted() { return !SND.on; }

/* ---------- Bausteine ---------- */
export function sndLoop(buf, rate = 1) { const s = SND.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.start(0, Math.random() * 2); return s; }
export function sndFilter(type, f, q = 0.7) { const n = SND.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; }
export function sndGain(v = 0) { const g = SND.ctx.createGain(); g.gain.value = v; return g; }
export function sndChain(...n) { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; }
export function sndPan() { return SND.ctx.createStereoPanner ? SND.ctx.createStereoPanner() : sndGain(1); }
export function sndSet(param, v, tc = 0.3) { param.setTargetAtTime(v, SND.ctx.currentTime, tc); }
// links/rechts für eine Quelle an (x, z) aus Sicht der Kamera
export function sndPanAt(pan, x, z) {
  if (!pan.pan) return;
  const cp = camera.position, dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz) || 1;
  const yaw = camera.rotation.y, rx = Math.cos(yaw), rz = -Math.sin(yaw);
  sndSet(pan.pan, Math.max(-0.85, Math.min(0.85, (dx * rx + dz * rz) / d)), 0.15);
}
// ein Stück aus dem Clip-Bogen spielen
export function sndClip(name, vol = 1, rate = 1, bus = 'sfx', rev = 0) {
  const S = SND.sprite, set = SND_SPRITE[name]; if (!S || !set || !SND.on) return;
  const [o, d] = set[Math.floor(Math.random() * set.length)], ctx = SND.ctx, t = ctx.currentTime;
  const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = S; s.playbackRate.value = rate; g.gain.value = vol;
  s.connect(g); g.connect(SND.bus[bus]); if (rev && SND.bus.rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(SND.bus.rev); }
  s.start(t, Math.max(0, o - 0.01), d / rate + 0.05);
}
export function sndTone(f, t, dur, vol, type = 'sine', bus = 'sfx', f2 = 0, rev = 0) {
  const ctx = SND.ctx, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(SND.bus[bus]); if (rev && SND.bus.rev) { const r = ctx.createGain(); r.gain.value = rev; g.connect(r); r.connect(SND.bus.rev); }
  o.start(t); o.stop(t + dur + 0.05);
}
export function sndBurst(t, dur, f, q, vol, bus = 'sfx', type = 'bandpass', brown = false) {
  const ctx = SND.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = brown ? SND.brown : SND.noise; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.015, dur * 0.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(SND.bus[bus]); s.start(t, Math.random() * 2, dur + 0.05);
}

/* ---------- Dauerschichten (einmal gebaut, nur Lautstärken ändern sich) ---------- */
export function sndBuildLayers() {
  const ctx = SND.ctx, L = SND.L, B = SND.bus;
  // Stadtrauschen: fernes Brummen der Stadt (Verkehr, Fabriken, Belüftung)
  L.city = sndGain(); sndChain(sndLoop(SND.brown, 0.8), sndFilter('lowpass', 260), L.city, B.out);
  L.cityHi = sndGain(); sndChain(sndLoop(SND.noise), sndFilter('bandpass', 900, 0.5), sndFilter('lowpass', 2200), L.cityHi, B.out);
  // Autos in der Nähe: ein Motor-Grummeln, das zum nächsten Wagen schwenkt
  L.carO = ctx.createOscillator(); L.carO.type = 'sawtooth'; L.carO.frequency.value = 46; L.carO.start();
  L.carF = sndFilter('lowpass', 220, 2); L.car = sndGain(); L.carP = sndPan(); sndChain(L.carO, L.carF, L.car, L.carP, B.out);
  L.tyre = sndGain(); sndChain(sndLoop(SND.noise, 0.7), sndFilter('bandpass', 520, 0.6), L.tyre, L.carP);
  // Straßenbahn: Rumpeln, Schienenkreischen in Kurven
  L.tram = sndGain(); L.tramP = sndPan(); sndChain(sndLoop(SND.brown, 1.3), sndFilter('lowpass', 200, 1.2), L.tram, L.tramP, B.out);
  L.rail = sndGain(); sndChain(sndLoop(SND.noise), sndFilter('bandpass', 3300, 14), L.rail, L.tramP);
  // Stimmen: drei Murmelstimmen (Rauschen durch wandernde Formanten, im Silbentakt moduliert)
  L.voices = sndGain(); sndChain(L.voices, sndFilter('lowpass', 2600), B.near);
  L.vf = [];
  for (let i = 0; i < (MOBILE ? 1 : 3); i++) {
    const f = sndFilter('bandpass', 500 + i * 260, 5), am = sndGain(0.5), lfo = ctx.createOscillator(), lg = sndGain(0.5);
    lfo.frequency.value = 3.6 + i * 1.3; lfo.connect(lg); lg.connect(am.gain); lfo.start();
    sndChain(sndLoop(SND.noise, 0.9 + i * 0.07), f, am, L.voices); L.vf.push(f);
  }
  // Wasser am Kai: weiches Plätschern
  L.water = sndGain(); const wl = ctx.createOscillator(), wg = sndGain(0.4); wl.frequency.value = 0.17; wl.connect(wg); const wa = sndGain(0.6); wg.connect(wa.gain); wl.start();
  sndChain(sndLoop(SND.brown, 2.2), sndFilter('lowpass', 650), wa, L.water, B.out);
  // Regen: helles Rauschen; im Haus kommt es dumpf durch die Fenster (out-Filter)
  L.rain = sndGain(); sndChain(sndLoop(SND.noise), sndFilter('highpass', 700), sndFilter('lowpass', 7500), L.rain, B.out);
  L.rainLo = sndGain(); sndChain(sndLoop(SND.brown, 1.6), sndFilter('lowpass', 900), L.rainLo, B.out);
  // Schneefall: fast still, nur ein weiches Wehen
  L.snow = sndGain(); sndChain(sndLoop(SND.noise, 0.5), sndFilter('bandpass', 1500, 0.4), sndFilter('lowpass', 2500), L.snow, B.out);
  // Pfeifen an Dachkanten und auf der Terrasse
  L.whistle = sndGain(); L.whF = sndFilter('bandpass', 1100, 9); sndChain(sndLoop(SND.noise), L.whF, L.whistle, B.out);
  // Flugwind: Rauschen, das mit der Geschwindigkeit höher und lauter wird, im Schnellflug flattert es
  L.fly = sndGain(); L.flyF = sndFilter('bandpass', 400, 0.6); L.flyAm = sndGain(1);
  L.flyLfo = ctx.createOscillator(); L.flyLfo.frequency.value = 9; L.flyLg = sndGain(0); L.flyLfo.connect(L.flyLg); L.flyLg.connect(L.flyAm.gain); L.flyLfo.start();
  sndChain(sndLoop(SND.noise), L.flyF, L.flyAm, L.fly, B.sfx);
  L.flyLo = sndGain(); sndChain(sndLoop(SND.brown, 1.4), sndFilter('lowpass', 300), L.flyLo, B.sfx);
  // Telekinese: tiefes Summen des Kristalls und ein feines Glitzern darüber
  L.tk = sndGain(); sndChain(L.tk, B.sfx);
  L.tkO = [110, 110.6, 165.2].map((f, i) => { const o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sine'; o.frequency.value = f; const g = sndGain(i === 2 ? 0.25 : 0.5); o.connect(g); g.connect(L.tk); o.start(); return o; });
  const sh = sndGain(0), shl = ctx.createOscillator(), shg = sndGain(0.12); shl.frequency.value = 7; shl.connect(shg); shg.connect(sh.gain); shl.start();
  L.tkSh = sndFilter('bandpass', 5200, 6); sndChain(sndLoop(SND.noise), L.tkSh, sh, L.tk);
  // Luftschiff Aurora Imperial: vier Motoren, Propellerschlag
  L.ship = sndGain(); L.shipP = sndPan(); L.shipF = sndFilter('lowpass', 240, 1.5);
  const sam = sndGain(0.7), pl = ctx.createOscillator(), plg = sndGain(0.3); pl.frequency.value = 11.5; pl.connect(plg); plg.connect(sam.gain); pl.start();
  for (const [f, v] of [[41, 0.5], [61.7, 0.35], [82.3, 0.25], [123, 0.1]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const g = sndGain(v); o.connect(g); g.connect(L.shipF); o.start(); }
  sndChain(L.shipF, sam, L.ship, L.shipP, B.near);
  // Knistern: Grammophon und Kamin (Villa, Penthouse, Salon des Luftschiffs)
  const cn = Math.floor(ctx.sampleRate * 2.5), cb = ctx.createBuffer(1, cn, ctx.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cn; i++) cd[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * (0.4 + Math.random()) : (Math.random() * 2 - 1) * 0.012;
  L.crackle = sndGain(); sndChain(sndLoop(cb), sndFilter('bandpass', 2400, 0.5), L.crackle, B.music);
}

/* ---------- Ruhige Salonmusik (Villa, Penthouse, Luftschiff): Klavier-Ballade und leise Streicher, wie vom Grammophon ---------- */
export const SALON_PROG = [[51, [0, 4, 7, 11]], [48, [0, 3, 7, 10]], [53, [0, 3, 7, 10]], [46, [0, 4, 7, 10]], [51, [0, 4, 7, 14]], [44, [0, 4, 7, 11]], [41, [0, 3, 7, 10]], [46, [0, 4, 7, 10]]];
export function sndMtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
export function salonInit() {
  const ctx = SND.ctx, M = SND.salon = { g: sndGain(0), next: 0, beat: 0, mel: 75 };
  // Grammophon-Klang: Bandpass, etwas Raum
  sndChain(M.g, sndFilter('highpass', 180), sndFilter('lowpass', 4200), SND.bus.music);
  if (SND.bus.rev) { const r = sndGain(0.18); M.g.connect(r); r.connect(SND.bus.rev); }
  M.iv = setInterval(salonSchedule, 120);
}
export function salonPiano(f, t, dur, vol) {
  const ctx = SND.ctx, g = ctx.createGain(), M = SND.salon;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(vol * 0.3, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(M.g);
  for (const [h, a] of [[1, 1], [2, 0.32], [3, 0.12]]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = f * h * (1 + (h - 1) * 0.0008); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); }
}
export function salonStrings(fs, t, dur, vol) {
  const ctx = SND.ctx, g = ctx.createGain(), fl = sndFilter('lowpass', 1100, 0.5);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  fl.connect(g); g.connect(SND.salon.g);
  for (const f of fs) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 14; o.connect(fl); o.start(t); o.stop(t + dur + 0.05); }
}
export function salonSchedule() {
  const M = SND.salon, ctx = SND.ctx; if (!M) return;
  if (M.g.gain.value < 0.003 && !(M.want > 0.003)) { M.next = 0; return; }
  const spb = 60 / 66;
  if (!M.next || M.next < ctx.currentTime) M.next = ctx.currentTime + 0.1;
  while (M.next < ctx.currentTime + 0.4) {
    const t = M.next, b = M.beat, bar = Math.floor(b / 3) % 8, bi = b % 3, [root, iv] = SALON_PROG[bar];
    // Walzertakt: Bass auf 1, Akkord auf 2 und 3
    if (bi === 0) { salonPiano(sndMtof(root - 12), t, 2.4, 0.16); salonStrings(iv.slice(0, 3).map(v => sndMtof(root + 12 + v)), t, spb * 3.1, 0.02); }
    else for (const v of iv.slice(1)) salonPiano(sndMtof(root + 12 + v), t, 1.0, 0.045);
    // Melodie: ruhige Töne aus dem Akkord, mit Pausen
    if ((bi === 0 && Math.random() < 0.85) || (bi === 2 && Math.random() < 0.35)) {
      const pool = iv.map(v => root + 24 + v).concat(iv.map(v => root + 36 + v)).filter(n => n > 66 && n < 86);
      let best = pool[0]; for (const n of pool) if (Math.abs(n - M.mel - (Math.random() - 0.5) * 5) < Math.abs(best - M.mel)) best = n;
      M.mel = best; salonPiano(sndMtof(best), t + (bi === 2 ? spb * 0.5 : 0), 2.2, 0.075);
    }
    M.next += spb; M.beat++;
  }
}

/* ---------- Start, Taste M, Pause ---------- */
export function startAudio() {
  if (SND.started) { audioCtx(); return; }
  const ctx = audioCtx(); if (!ctx) return;
  SND.started = true;
  sndBuildLayers(); salonInit();
  sndSet(SND.master.gain, SND.on ? 1 : 0, 0.8);
  if (!SND.on) { ctx.suspend(); setTimeout(() => toast('Ton aus · M schaltet ihn ein'), 1500); }
  // die Klangdatei erst jetzt laden (nach dem Start, nicht in der Ladezeit)
  fetch('assets/audio/vespera-sfx.mp3').then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(b => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
    .then(buf => { SND.sprite = buf; }).catch(e => console.warn('Klänge nicht geladen:', e));
}
export function toggleSound() {
  if (!SND.started) startAudio();
  if (!SND.ctx) return;
  SND.on = !SND.on;
  try { localStorage.setItem(SND_KEY, SND.on ? 'an' : 'aus'); } catch (e) { /* privat: nur für diese Sitzung */ }
  if (SND.on) SND.ctx.resume();
  sndSet(SND.master.gain, SND.on ? (paused ? 0.35 : 1) : 0, 0.25);
  if (!SND.on) setTimeout(() => { if (!SND.on && SND.ctx.state === 'running') SND.ctx.suspend(); }, 900);   // stumm: auch keine Rechenzeit
  toast(SND.on ? 'Ton an' : 'Ton aus');
}
{ const b = document.getElementById('enter'); if (b) b.addEventListener('click', () => startAudio()); }

/* ---------- Ort bestimmen (4-mal je Sekunde) ---------- */
export function sndZone() {
  const p = player.p;
  if (IMP.pf && player.on === IMP.pf) return inImperial(p) ? 'ship' : 'deck';
  if (inBelmont(p.x, p.z, p.y)) return p.z < -5 ? 'ball' : 'lobby';
  if (inPenthouse(p)) return 'pent';
  if (onPentTerrace(p)) return 'terrace';
  if (Math.hypot(p.x - VILLA.x, p.z - VILLA.z) < 160 && inVillaHouse(p)) return 'villa';
  if (ATMO.inside > 0.6) return 'room';   // Laden, Bar, Restaurant
  return 'out';
}
export function sndSurface(z) {
  const p = player.p;
  if (z === 'ball' || z === 'lobby' || z === 'villa' || z === 'pent') return 'marble';
  if (z === 'ship') return 'carpet';
  if (z === 'deck' || z === 'room') return 'wood';
  if (z === 'terrace') return 'stone';
  if (!onIsland(p.x, p.z, 0)) return p.y < 2.5 && p.z > 480 ? 'wood' : 'snow';   // Stege am Hafen; sonst Berge, Villengarten
  if (p.y > 3.5) return 'stone';   // Dächer, Brücken
  return U.uSnowCover.value > 0.62 ? 'snowstone' : 'stone';
}

/* ---------- jedes Bild ---------- */
export function updateSound(dt) {
  if (!SND.started || !SND.ctx || !SND.L.city) return;
  const ctx = SND.ctx, L = SND.L, B = SND.bus, t = ctx.currentTime, p = player.p, cp = camera.position;
  // Pause: leiser, aber nicht ganz still
  if (SND.on) { const m = paused || !playing ? 0.35 : 1; if (SND.last.m !== m) { SND.last.m = m; sndSet(SND.master.gain, m, 0.4); } }
  if (!SND.on || ctx.state !== 'running') return;
  sndEvents(dt, t);
  SND.slow -= dt; if (SND.slow > 0) return; SND.slow = 0.25;

  const z = SND.zone = sndZone(); SND.surf = sndSurface(z);
  const inside = z === 'out' || z === 'terrace' || z === 'deck' ? Math.min(0.5, ATMO.inside) : 1;
  const W = ATMO.cur, alt = Math.max(0, cp.y), hi = Math.min(1, alt / 220);
  // draußen gedämpft, je nachdem wie tief man im Haus ist
  sndSet(B.outF.frequency, 16000 * Math.pow(0.03, inside), 0.5);
  sndSet(B.out.gain, 1 - 0.55 * inside, 0.6);
  if (B.rev) sndSet(B.rev.gain, z === 'ball' || z === 'lobby' ? 0.55 : z === 'villa' || z === 'pent' ? 0.35 : z === 'room' || z === 'ship' ? 0.12 : 0.04, 0.6);

  // Stadt: im Zentrum am lautesten, in den Bergen und hoch oben leise; Schnee dämpft
  const dC = Math.hypot(cp.x, cp.z + 250), dist = shared.lastDistrict || '';
  const remote = dist === 'Die Berge' || dist === 'Bergvilla' || dist === 'Der große Viadukt' || dist === 'Der Tunnel';
  const cityK = (remote ? 0.25 : 1) * Math.max(0.15, 1 - dC / 1500) * (1 - 0.6 * hi) * (1 - 0.35 * W.snow);
  sndSet(L.city.gain, 0.09 * cityK + 0.015, 1.2);
  sndSet(L.cityHi.gain, 0.022 * cityK * (1 - hi), 1.2);

  // nächster Wagen und nächste Straßenbahn
  let cd = 1e9, cx = 0, cz = 0, near = 0;
  for (const c of TRF.cars) {
    if (c.gone || c.dyn || c.wx === undefined) continue;
    const d = (c.wx - cp.x) ** 2 + (c.wz - cp.z) ** 2 + (cp.y - (c.wy || 0)) ** 2;
    if (d < 3600) near += 1 - Math.sqrt(d) / 60;
    if (d < cd) { cd = d; cx = c.wx; cz = c.wz; }
  }
  cd = Math.sqrt(cd);
  const carK = Math.min(1, near * 0.6) * (cd < 60 ? 1 : 0);
  sndSet(L.car.gain, 0.05 * carK, 0.35); sndSet(L.tyre.gain, 0.05 * carK, 0.35);
  sndSet(L.carO.frequency, 40 + Math.random() * 14, 0.6); sndSet(L.carF.frequency, 160 + carK * 200, 0.4);
  sndPanAt(L.carP, cx, cz);
  SND.carNear = cd;
  let td = 1e9, tx = 0, tz = 0, tr0 = null;
  for (const tr of trams) {
    const Ln = tr.L, ax = Ln.axis === 'x', along = tr.dir > 0 ? Ln.from + tr.s : Ln.to - tr.s, side = ax ? tr.dir : -tr.dir;
    const x = ax ? along : Ln.at + side * Ln.off, zz = ax ? Ln.at + side * Ln.off : along, d = Math.hypot(x - cp.x, zz - cp.z, cp.y);
    if (d < td) { td = d; tx = x; tz = zz; tr0 = tr; }
  }
  const tramK = td < 160 ? Math.pow(1 - td / 160, 2) : 0;
  sndSet(L.tram.gain, 0.4 * tramK, 0.3); sndSet(L.rail.gain, 0.012 * tramK * (0.5 + 0.5 * Math.sin(t * 0.7)), 0.3);
  sndPanAt(L.tramP, tx, tz);
  // Glocke, wenn eine Straßenbahn heranfährt (einmal je Begegnung)
  if (tr0 && td < 45 && !SND.tramBell.has(tr0) && z === 'out') { SND.tramBell.add(tr0); tramBell(Math.min(1, 1.3 - td / 45)); setTimeout(() => SND.tramBell.delete(tr0), 40000); }

  // Stimmen: Passanten in der Nähe, im Ballsaal und in der Lobby die Gäste
  let pc = 0;
  if (z === 'out' && cp.y < 30) for (let i = SND.step & 3; i < peds.length; i += 4) { const a = peds[i].a; if (!a || !a.on) continue; const e = a.m.elements; if ((e[12] - cp.x) ** 2 + (e[14] - cp.z) ** 2 < 400) pc += 4; }
  const vK = z === 'ball' ? 0.75 : z === 'lobby' ? 0.4 : z === 'room' ? 0.35 : z === 'out' ? Math.min(0.5, pc * 0.05) : 0;
  sndSet(L.voices.gain, 0.05 * vK, 0.8);
  for (const f of L.vf) sndSet(f.frequency, 380 + Math.random() * 900, 0.08);
  SND.vK = vK;

  // Wasser nah am Ufer oder im Boot
  const shore = BOAT.on || (onIsland(cp.x, cp.z, -40) && !onIsland(cp.x, cp.z, 30) && cp.y < 15);
  sndSet(L.water.gain, shore ? 0.16 : 0, 1.5);

  // Wetter
  sndSet(L.rain.gain, 0.07 * W.rain, 1.5); sndSet(L.rainLo.gain, 0.08 * W.rain, 1.5);
  sndSet(L.snow.gain, 0.02 * W.snow * (1 - inside), 2);
  SND.rain = W.rain; SND.frost = W.frost * (1 - inside);

  // Dachkanten, Terrasse, Luftschiff-Deck: pfeifender Wind
  const exposed = (z === 'terrace' || z === 'deck' ? 1 : z === 'out' && player.onGround && alt > 30 ? Math.min(1, alt / 120) : 0) * (1 - inside);
  sndSet(L.whistle.gain, exposed * (0.008 + WIND.gust * 0.02 + WIND.s * 0.0015), 0.6);
  sndSet(L.whF.frequency, 900 + WIND.gust * 900 + Math.sin(t * 0.37) * 200, 0.8);

  // Luftschiff: draußen hört man es von weitem kommen, an Bord ein ruhiges Brummen
  if (IMP.g) {
    const q = IMP.g.position, d = Math.hypot(q.x - cp.x, q.y - cp.y, q.z - cp.z), on = z === 'ship' || z === 'deck';
    const k = on ? (z === 'ship' ? 0.09 : 0.16) : 0.35 / (1 + (d / 70) ** 2);
    sndSet(L.ship.gain, d > 900 ? 0 : k, 0.6); sndSet(L.shipF.frequency, on ? (z === 'ship' ? 160 : 260) : 240 - Math.min(120, d * 0.2), 0.6);
    if (on) { if (L.shipP.pan) sndSet(L.shipP.pan, 0, 0.3); } else sndPanAt(L.shipP, q.x, q.z);
  }

  // Salonmusik und Knistern: Villa, Penthouse, Salon des Luftschiffs
  const sal = z === 'villa' ? 0.5 : z === 'pent' ? 0.45 : z === 'ship' ? 0.32 : z === 'terrace' ? 0.12 : 0;
  SND.salon.want = sal; sndSet(SND.salon.g.gain, sal, sal > SND.salon.g.gain.value ? 1.2 : 0.8);
  sndSet(L.crackle.gain, sal ? 0.25 + sal * 0.4 : 0, 1);
  SND.salonOn = sal;
}

/* ---------- Ereignisse: Schritte, Landung, Kräfte, Glocken, Gläser ---------- */
export function sndEvents(dt, t) {
  const L = SND.L, pv = SND.prev, p = player.p;
  SND.step++;
  // Schritte: Takt wie die Figur (Gehen bis 2,8 m/s, darüber Laufen)
  const sp = Math.hypot(player.v.x, player.v.z);
  const walking = playing && !paused && player.onGround && !player.fly && !DRIVE.on && !BOAT.on && !DINE.seat && sp > 0.4;
  if (walking) {
    const run = sp > 2.8, cad = run ? Math.min(1.6, sp / 2.3) : sp / 1.366;
    SND.stepPh = (SND.stepPh || 0) + dt * cad * 2;
    if (SND.stepPh >= 1) { SND.stepPh -= 1; footstep(run); }
  } else SND.stepPh = 0.6;
  // Landung: kleine Landung federt, Heldenlandung kracht
  if (POWERS.hero && POWERS.hero !== pv.hero) heroBoom(POWERS.hero.k || 0.5);
  else if (POWERS.dip && POWERS.dip !== pv.dip) { const k = POWERS.dip.k || 0.3; sndClip(SND.surf === 'snow' ? 'step_snow' : 'thud', 0.25 + 0.5 * k, 0.9); footstep(false, 0.6); }
  pv.hero = POWERS.hero; pv.dip = POWERS.dip;
  // Abheben
  const T0 = POWERS.takeoff, launched = !!(T0 && T0.launched);
  if (launched && !pv.launched) takeoffSound(p.y - (player.gy ?? -1e9) < 0.8);
  pv.launched = launched;
  // Flugwind
  const fly = player.fly, fs = fly ? player.v.length() : 0;
  if (SND.slowFly === undefined || (SND.slowFly -= dt) <= 0) {
    SND.slowFly = 0.1;
    sndSet(L.fly.gain, fly ? Math.min(0.32, 0.03 + fs / 150 * 0.3) : 0, fly ? 0.25 : 0.5);
    sndSet(L.flyF.frequency, 300 + Math.min(150, fs) * 14, 0.2);
    sndSet(L.flyLg.gain, fly && fs > 60 ? Math.min(0.35, (fs - 60) / 200) : 0, 0.3);
    sndSet(L.flyLo.gain, fly ? Math.min(0.25, fs / 150 * 0.25) : 0, 0.3);
    // Telekinese: Summen, beim Heranziehen höher
    const H = POWERS.tk;
    sndSet(L.tk.gain, H ? 0.045 : 0, H ? 0.15 : 0.3);
    if (H) { const k = 1 + Math.max(0, 1 - H.dist / 40) * 0.25 + POWERS.tkWind * 2; L.tkO.forEach((o, i) => sndSet(o.frequency, [110, 110.6, 165.2][i] * k, 0.2)); sndSet(L.tkSh.frequency, 4200 + Math.random() * 2400, 0.1); }
  }
  if (fly && fs > 70 && !(pv.fs > 70)) sndClip('woosh', 0.5, 0.8);
  pv.fs = fs;
  // Telekinese greifen, absetzen, schleudern
  const H = POWERS.tk;
  if (H && !pv.tk) tkSound('grab');
  else if (!H && pv.tk) tkSound(pv.tkWind > 0 ? 'throw' : 'drop');
  pv.tk = H; pv.tkWind = POWERS.tkWind;

  // zufällige Ereignisse (nicht jedes Bild prüfen)
  if ((SND.ev.t = (SND.ev.t || 0) - dt) > 0) return;
  SND.ev.t = 0.2;
  const z = SND.zone, ctx = SND.ctx, now = ctx.currentTime;
  // Gläserklirren im Ballsaal und in der Bar
  if ((z === 'ball' && Math.random() < 0.18) || ((z === 'lobby' || z === 'room') && Math.random() < 0.05)) sndClip('glass', 0.05 + Math.random() * 0.06, 1.1 + Math.random() * 0.5, 'near', 0.4);
  // Hupen 1920er Art (Klaxon), selten, wenn Autos nah sind
  if (z === 'out' && SND.carNear < 70 && Math.random() < 0.012) klaxon(Math.max(0.15, 1 - SND.carNear / 70));
  // Regentropfen auf Blech und Schirmen
  if (SND.rain > 0.2 && z === 'out') for (let i = 0; i < (MOBILE ? 1 : 3); i++) if (Math.random() < SND.rain * 0.8) sndBurst(now + Math.random() * 0.2, 0.03, 2500 + Math.random() * 4000, 4, 0.03 * SND.rain, 'out');
  // Eisnebel: feines Klirren der Eiskristalle
  if (SND.frost > 0.4 && Math.random() < SND.frost * 0.15) sndTone(3000 + Math.random() * 3500, now, 0.6, 0.006, 'sine', 'out', 0, 0.3);
  // Arbeiterviertel und Industrie: Hämmern und Dampf in der Ferne
  const dist = shared.lastDistrict || '';
  if (z === 'out' && (dist === 'Arbeiterviertel' || dist === 'Industriegebiet Ost')) {
    if (Math.random() < 0.05) sndClip('metal', 0.04 + Math.random() * 0.05, 0.6 + Math.random() * 0.5, 'out', 0.6);
    if (Math.random() < 0.02) sndBurst(now, 1.2 + Math.random(), 4500, 0.6, 0.02, 'out', 'highpass');
  }
  // Hafen: ein Schiffshorn, ganz selten
  if (z === 'out' && dist === 'Hafenpromenade' && Math.random() < 0.004) { sndTone(98, now, 2.6, 0.08, 'sawtooth', 'out', 96); sndTone(147, now, 2.6, 0.04, 'sawtooth', 'out', 145); }
}

export function footstep(run, k = 1) {
  const s = SND.surf, z = SND.zone, rate = (0.94 + Math.random() * 0.12) * (run ? 1.05 : 1);
  const v = (run ? 0.5 : 0.32) * k;
  const rev = z === 'ball' || z === 'lobby' ? 0.5 : z === 'villa' || z === 'pent' ? 0.35 : 0;
  if (s === 'marble') sndClip('step_concrete', v * 1.1, rate * 1.18, 'sfx', rev);   // harter Absatz auf Marmor, mit Hall
  else if (s === 'stone') sndClip('step_concrete', v, rate * 0.92);
  else if (s === 'snowstone') { sndClip('step_concrete', v * 0.6, rate * 0.9); sndClip('step_snow', v * 0.5, rate); }
  else if (s === 'snow') sndClip('step_snow', v * 0.9, rate);
  else if (s === 'wood') sndClip('step_wood', v * 0.8, rate);
  else if (s === 'carpet') sndClip('step_carpet', v * 0.9, rate);
}
export function tramBell(k) {
  const t = SND.ctx.currentTime;
  for (const dt of [0, 0.32]) { sndTone(1180, t + dt, 1.1, 0.06 * k, 'sine', 'out', 0, 0.2); sndTone(2950, t + dt, 0.6, 0.025 * k, 'sine', 'out'); sndTone(1770, t + dt, 0.8, 0.02 * k, 'triangle', 'out'); }
}
export function klaxon(k) {
  const ctx = SND.ctx, t = ctx.currentTime, o = ctx.createOscillator(), f = sndFilter('bandpass', 950, 2.5), g = ctx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(480, t + 0.25); o.frequency.linearRampToValueAtTime(430, t + 0.6);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05 * k, t + 0.05); g.gain.setValueAtTime(0.05 * k, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(f); f.connect(g); g.connect(SND.L.carP); o.start(t); o.stop(t + 0.75);
}
export function heroBoom(k) {
  const t = SND.ctx.currentTime;
  sndClip('land', 0.6 + 0.4 * k, 0.8, 'sfx', 0.3); sndClip('debris', 0.25 + 0.35 * k, 0.9 + Math.random() * 0.2, 'sfx', 0.3);
  sndTone(70, t, 0.9 + k, 0.5 * (0.5 + k), 'sine', 'sfx', 28);
  sndBurst(t, 0.6 + k * 0.8, 380, 0.7, 0.25 + 0.3 * k, 'sfx', 'lowpass', true);
  crystalChime(t + 0.05, 0.03 + 0.03 * k);
}
export function takeoffSound(ground) {
  const t = SND.ctx.currentTime;
  sndClip('woosh', 0.7, 0.7); if (ground) { sndClip('thud', 0.5, 0.8); sndTone(90, t, 0.6, 0.25, 'sine', 'sfx', 40); }
  crystalChime(t, 0.035);
}
// Klang des Meteoritenkristalls: hell, gläsern, leicht schwebend (Türkis)
export function crystalChime(t, v) {
  [1318.5, 1975.5, 2637, 3951].forEach((f, i) => sndTone(f * (1 + (Math.random() - 0.5) * 0.004), t + i * 0.035, 1.6 - i * 0.2, v / (1 + i * 0.6), 'sine', 'sfx', 0, 0.4));
}
export function tkSound(kind) {
  const t = SND.ctx.currentTime;
  if (kind === 'grab') { sndTone(160, t, 0.55, 0.12, 'sine', 'sfx', 480); sndTone(320, t, 0.5, 0.04, 'triangle', 'sfx', 960); crystalChime(t + 0.1, 0.02); }
  else if (kind === 'throw') { sndClip('woosh', 0.8, 0.85); sndTone(300, t, 0.4, 0.1, 'sine', 'sfx', 70); crystalChime(t, 0.025); }
  else sndTone(420, t, 0.6, 0.08, 'sine', 'sfx', 140);
}
