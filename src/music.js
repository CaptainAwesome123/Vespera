import { rand, R, $ } from './core.js';
import { inBelmont, BEL, BI } from './belmont.js';
import { VILLA } from './harbour.js';
import { citizenNear, citizenSay } from './ragdoll.js';
import { player } from './player.js';
import { driveExit } from './driving.js';
import { toast } from './boat.js';
import { playing, paused, isTouch } from './input.js';

/* =====================================================================
   MUSIK: sanfte Akkorde über Web Audio (nur nach Klick)
   ===================================================================== */
export let audio = null;
export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  const ctx = new AC(), master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const amb = ctx.createGain(); amb.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(amb); amb.connect(master);
  const dl = ctx.createDelay(); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.35; dl.connect(fb); fb.connect(dl); dl.connect(lp);
  const jazz = ctx.createGain(); jazz.gain.value = 0;
  const jlp = ctx.createBiquadFilter(); jlp.type = 'lowpass'; jlp.frequency.value = 8000; jazz.connect(jlp); jlp.connect(master);
  const room = ctx.createDelay(); room.delayTime.value = 0.09; const rfb = ctx.createGain(); rfb.gain.value = 0.28; room.connect(rfb); rfb.connect(room); room.connect(jlp);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const a = { ctx, master, amb, jazz, jlp, room, noise, lp, dl, on: true, next: 0, beat: 0, mel: 72, rest: 0 };
  // Klangteppich der Stadt
  const chords = [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [50, 57, 60, 65, 69], [43, 50, 53, 59, 64], [41, 48, 52, 57, 64], [40, 47, 50, 55, 62]];
  let i = 0;
  const pad = () => {
    const t = ctx.currentTime, ch = chords[i++ % chords.length];
    ch.forEach((n, k) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = k === 0 ? 'sine' : 'triangle'; o.frequency.value = mtof(n); o.detune.value = rand(-6, 6);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(k === 0 ? 0.5 : 0.22, t + 1.6); g.gain.linearRampToValueAtTime(0, t + 7.5);
      o.connect(g); g.connect(lp); g.connect(dl); o.start(t); o.stop(t + 7.6);
    });
  };
  pad(); a.iv = setInterval(() => { if (a.amb.gain.value > 0.005) pad(); }, 6000);
  a.jiv = setInterval(() => scheduleJazz(a), 60);
  return a;
}
// Kleine Jazzband: Walking Bass, Becken, Besen, Klavier-Comping, gedämpfte Trompete
export const PROG = [[53, 'M7'], [50, '7'], [55, 'm7'], [48, '7'], [57, 'm7'], [50, '7'], [55, 'm7'], [48, '7']];
export const CHORD = { M7: [0, 4, 7, 11, 14], '7': [0, 4, 7, 10, 14], m7: [0, 3, 7, 10, 14] };
export function scheduleJazz(a) {
  const ctx = a.ctx;
  if (a.jazz.gain.value < 0.002 && a.jazzTarget < 0.002) { a.next = 0; return; }
  const spb = 60 / 138;
  if (!a.next || a.next < ctx.currentTime) a.next = ctx.currentTime + 0.05;
  while (a.next < ctx.currentTime + 0.25) {
    const t = a.next, b = a.beat, bar = Math.floor(b / 4) % 8, bi = b % 4;
    const [root, q] = PROG[bar], tones = CHORD[q];
    const nextRoot = PROG[(bar + 1) % 8][0];
    // Bass
    const bn = bi === 0 ? root : bi === 3 ? nextRoot + (R() < 0.5 ? 1 : -1) : root + tones[1 + Math.floor(R() * 2)] - (R() < 0.3 ? 12 : 0);
    jzTone(a, mtof(bn - 24), t, 0.42, 'triangle', 0.5, 700);
    // Ride mit Swing, Hi-Hat auf 2 und 4
    jzNoise(a, t, 0.22, 7000, 0.12);
    if (bi === 1 || bi === 3) { jzNoise(a, t + spb * 0.66, 0.15, 7000, 0.08); jzNoise(a, t, 0.05, 9000, 0.1); jzNoise(a, t, 0.14, 2500, 0.05); }
    // Klavier: Charleston-Rhythmus, Terz-Septime-None
    if (bi === 0 || (bi === 1 && R() < 0.7) || (bi === 2 && R() < 0.25)) {
      const tt = bi === 1 ? t + spb * 0.66 : t;
      for (const iv of [tones[1], tones[3], tones[4]]) jzTone(a, mtof(root + iv + 12), tt, 0.5, 'triangle', 0.07, 2600);
    }
    // Trompete mit Phrasen und Pausen
    if (a.rest > 0) a.rest--;
    else for (const sub of [0, 0.66]) {
      if (R() < 0.62) {
        const pool = tones.map(v => root + 12 + v).concat(tones.map(v => root + 24 + v));
        let best = pool[0]; for (const n of pool) if (Math.abs(n - a.mel - (R() - 0.5) * 6) < Math.abs(best - a.mel)) best = n;
        a.mel = Math.max(64, Math.min(86, best));
        jzLead(a, mtof(a.mel), t + spb * sub, spb * (sub ? 0.34 : 0.66) * (R() < 0.3 ? 2 : 1));
      }
      if (R() < 0.05) a.rest = 4 + Math.floor(R() * 4);
    }
    a.next += spb; a.beat++;
  }
}
export function jzTone(a, f, t, dur, type, vol, cut) {
  const o = a.ctx.createOscillator(), g = a.ctx.createGain(), fl = a.ctx.createBiquadFilter();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(fl); fl.connect(g); g.connect(a.jazz); g.connect(a.room); o.start(t); o.stop(t + dur + 0.05);
}
export function jzNoise(a, t, dur, f, vol) {
  const s = a.ctx.createBufferSource(), g = a.ctx.createGain(), fl = a.ctx.createBiquadFilter();
  s.buffer = a.noise; fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(fl); fl.connect(g); g.connect(a.jazz); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
export function jzLead(a, f, t, dur) {
  const o = a.ctx.createOscillator(), g = a.ctx.createGain(), fl = a.ctx.createBiquadFilter(), lfo = a.ctx.createOscillator(), lg = a.ctx.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; lfo.frequency.value = 5.5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency);
  fl.type = 'bandpass'; fl.frequency.value = 1300; fl.Q.value = 1.6;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.04); g.gain.setValueAtTime(0.08, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(fl); fl.connect(g); g.connect(a.jazz); g.connect(a.room); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}
export function toggleMusic() {
  if (!audio) { audio = initAudio(); if (!audio) return; audio.master.gain.setTargetAtTime(1, audio.ctx.currentTime, 0.6); toast('Musik an'); return; }
  audio.on = !audio.on; audio.master.gain.setTargetAtTime(audio.on ? 1 : 0, audio.ctx.currentTime, 0.5); toast(audio.on ? 'Musik an' : 'Musik aus');
}
// Lautstärken je nach Ort: Ballsaal laut, Lobby gedämpft, Villa im Freien, sonst der Klangteppich
export let bandHint = false;
export function updateAudio(dt) {
  const p = player.p;
  const inBall = inBelmont(p.x, p.z, p.y) && p.z < -5, inLobby = inBelmont(p.x, p.z, p.y) && !inBall;
  const dv = Math.hypot(p.x - VILLA.x, p.z - VILLA.z);
  let jz = 0, cut = 8000;
  if (inBall) jz = 0.9; else if (inLobby) { jz = 0.45; cut = 900; } else if (dv < 200 && Math.abs(p.y - VILLA.y) < 60) { jz = 0.8 * Math.min(1, (200 - dv) / 120); cut = 3500; }
  else if (Math.hypot(p.x, p.z) < 70 && p.y < 40) { jz = 0.15; cut = 500; }
  if (jz > 0.4 && !audio && !bandHint && playing) { bandHint = true; toast('Die Band spielt · M für Musik'); }
  if (!audio) return;
  const t = audio.ctx.currentTime;
  audio.jazzTarget = jz;
  audio.jazz.gain.setTargetAtTime(jz, t, 0.4);
  audio.jlp.frequency.setTargetAtTime(cut, t, 0.3);
  audio.amb.gain.setTargetAtTime(0.07 * (1 - Math.min(1, jz * 1.5)), t, 0.6);
}

/* ---------- Benutzen: Fahrstühle ---------- */
export const INTERACT = [];
export let activeUse = null;
let shownLabel = null;
export function travel(pos, yaw, pitch, name) {
  const f = $('fade'); f.style.opacity = 1;
  driveExit();
  setTimeout(() => { player.p.set(...pos); player.v.set(0, 0, 0); player.on = null; player.yaw = yaw; player.pitch = pitch; player.fly = false; toast(name); f.style.opacity = 0; }, 480);
}
export function buildInteractions() {
  for (const z of [12, 22, 32]) INTERACT.push({ test: p => p.x > 44.3 && Math.abs(p.z - z) < 2.2 && p.y < 3, label: 'Fahrstuhl zur Ballsaal-Terrasse · 250 m', act: () => travel([0, BEL.s2, 22], Math.PI, -0.05, 'Ballsaal-Terrasse') });
  INTERACT.push({ test: p => Math.abs(p.x) < 3 && p.z > 19.6 && p.z < 23.6 && Math.abs(p.y - BEL.s2) < 2, label: 'Fahrstuhl hinunter in die Lobby', act: () => travel([44.4, BI.P, 22], Math.PI / 2, 0, 'The Belmont · Lobby') });
}
export function updateInteract() {
  let u = null;
  if (playing && !paused && !player.fly) for (const it of INTERACT) if (it.test(player.p)) { u = it; break; }
  if (!u && playing && !paused && !player.fly) { const c = citizenNear(player.p, 3.2); if (c) u = c.use ||= { label: 'Ansprechen: ' + c.name, act: () => citizenSay(c) }; }
  if (u !== activeUse || (u && u.label !== shownLabel)) {   // V26: wechselnde Beschriftung (Aufheben: …)
    activeUse = u; shownLabel = u ? u.label : null;
    const el = $('prompt');
    if (u) { el.innerHTML = '<kbd>E</kbd>'; el.append(u.label); el.style.opacity = 1; } else el.style.opacity = 0;
    if (isTouch) $('tUse').hidden = !u;
  }
}
