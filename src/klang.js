import { MOBILE, camera, shared, $ } from './core.js';
import { playing, paused, locked, pause } from './input.js';
import { SND, SND_VOL, setSndVol, sndGain, sndLoop, sndFilter, sndChain, sndSet, sndTone, sndBurst, sndClip, sndPan, sndPanAt, toggleSound, startAudio } from './audio.js';
import { ATMO } from './atmosphere.js';
import { WIND } from './wind.js';
import { BAHN } from './bahn-hook.js';
import { FOUNT } from './fountain.js';
import { addTasten } from './pausemenu.js';

/* =====================================================================
   V73 · MUSIK UND STADTKLANG
   Ergänzt den Klang aus V38 (src/audio.js) um das, was Vespera noch fehlte. Alles wird
   live erzeugt (keine neue Datei, keine Ladezeit), auf dem Handy mit weniger Stimmen.
   - SCHNEESTURM: tiefes Heulen in zwei wandernden Tönen, Böen, klappernde Läden und
     knarrendes Holz; im Haus kommt es dumpf durch die Fenster. Schnee und Frostnebel
     schlucken die Höhen der Stadt (Dämpfer im Mischpult).
   - NORDLICHT: ein leiser, gläserner Klang am Himmel, je heller das Polarlicht.
   - METEORE: feines Zischen, wenn Sternschnuppen fallen.
   - HAFEN: Glockenboje, knarrende Taue, im Nebel das Nebelhorn vom Leuchtfeuer.
   - STADT: Hochbahn und Straßenbahn rattern über die Schienenstöße, Lachen in der
     Menge, der Brunnen auf dem Belmont-Platz, Fabrikpfeife im Arbeiterviertel, die
     Turmuhr des Belmont schlägt zur vollen und zur Viertelstunde (echte Uhrzeit).
   - ORTE: Rezeptionsglocke und Fahrstuhlgong in der Lobby, Standuhr in der stillen
     Villa, Wind am Glas im Penthouse, Beifall im Ballsaal nach jedem Stück der Band.
   - MISCHPULT: Pausenmenü „Klang“ (auch Shift+M): Gesamt, Musik, Stadt und Wetter,
     Effekte, Stimmen; bleibt gespeichert.
   - Browser und Handy: Ton erst nach dem ersten Klick (wie bisher), im Hintergrund-Tab
     angehalten, nach einer Unterbrechung (Anruf, Tab-Wechsel) beim nächsten Tippen wieder an.
   ===================================================================== */
export const KL = { L: null, slow: 0, ev: 0, tick: 0, tock: false, clack: 0, horn: 20, buoy: 4, whistle: 60, desk: 20, chimeKey: '', hid: false, panel: null, open: false, st: 0 };
const kR = (a, b) => a + Math.random() * (b - a);
const BELL_AT = { x: 0, z: 0 }, HARBOUR = { x: 60, z: 560 }, LIGHT = { x: 140, z: 700 };

/* ---------- Dauerschichten ---------- */
function klBuild() {
  const ctx = SND.ctx, B = SND.bus, L = KL.L = {};
  // Sturmheulen: zwei schmale Rauschbänder, deren Töne wandern, dazu ein tiefes Grollen
  L.howl = sndGain(); L.hf = [];
  for (const [f, q] of [[360, 8], [610, 5]]) { const fl = sndFilter('bandpass', f, q); sndChain(sndLoop(SND.noise, 0.8), fl, L.howl); L.hf.push(fl); }
  sndChain(L.howl, B.out);
  L.rumble = sndGain(); sndChain(sndLoop(SND.brown, 0.6), sndFilter('lowpass', 140), L.rumble, B.out);
  // Nordlicht: vier leise Sinustöne, jeder schwillt langsam für sich an und ab
  L.aur = sndGain(); sndChain(L.aur, sndFilter('lowpass', 3000), B.out);
  for (const [f, r] of [[1046.5, 0.07], [1568, 0.05], [1318.5, 0.11], [2093, 0.031]]) {
    const o = ctx.createOscillator(), g = sndGain(0.5), lfo = ctx.createOscillator(), lg = sndGain(0.5);
    o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.003); lfo.frequency.value = r; lfo.connect(lg); lg.connect(g.gain);
    o.connect(g); g.connect(L.aur); o.start(); lfo.start();
  }
  // Brunnen auf dem Belmont-Platz
  L.font = sndGain(); L.fontP = sndPan();
  sndChain(sndLoop(SND.noise, 0.9), sndFilter('highpass', 700), sndFilter('lowpass', 5200), L.font, L.fontP, B.out);
  L.fontLo = sndGain(); sndChain(sndLoop(SND.brown, 1.8), sndFilter('lowpass', 500), L.fontLo, L.fontP);
  // Penthouse: Wind streicht am Glas
  L.glass = sndGain(); L.glassF = sndFilter('bandpass', 280, 2.2); sndChain(sndLoop(SND.noise, 0.6), L.glassF, L.glass, B.near);
}

/* ---------- kleine Klänge ---------- */
// Glocke mit unharmonischen Teiltönen (Turmuhr, Boje)
function klBell(f, t, vol, dur = 3, bus = 'out') {
  for (const [h, a, d] of [[1, 1, 1], [2.0, 0.5, 0.7], [2.4, 0.35, 0.55], [3.0, 0.22, 0.4], [4.2, 0.12, 0.3]]) sndTone(f * h, t, dur * d, vol * a, 'sine', bus, 0, 0.3);
}
// kurzes Lachen: gestimmte Stöße durch einen Formanten
function klLaugh(k) {
  const ctx = SND.ctx, t0 = ctx.currentTime + Math.random() * 0.2, f0 = kR(170, 300), n = 3 + Math.floor(Math.random() * 3);
  const fl = sndFilter('bandpass', kR(800, 1200), 2.2), out = sndGain(1); sndChain(fl, out, SND.bus.near);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * kR(0.15, 0.2), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0 * (1 - i * 0.04), t); o.frequency.linearRampToValueAtTime(f0 * (0.9 - i * 0.04), t + 0.11);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.02 * k, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g); g.connect(fl); o.start(t); o.stop(t + 0.15);
  }
}
// Beifall: viele einzelne Klatscher, erst dichter, dann verebbend (Ballsaal nach jedem Stück, auch im Varieté)
export function klApplaus(k = 1, at = 0) {
  if (!SND.ctx || !SND.on || !SND.noise) return;
  const t0 = Math.max(SND.ctx.currentTime, at || 0), dur = kR(4, 6), n = Math.round(dur * (MOBILE ? 16 : 34) * k);
  for (let i = 0; i < n; i++) {
    const u = Math.pow(Math.random(), 1.6), t = t0 + u * dur, env = Math.min(1, u * 6) * (1 - u * 0.75);
    sndBurst(t, 0.045, kR(1000, 2600), 1.4, 0.06 * k * env, 'near');
  }
  if (Math.random() < 0.6) setTimeout(() => SND.on && klLaugh(0.6 * k), 900);
}
// Schienenstoß: zwei Achsen kurz nacheinander
function klClack(k, hoch) {
  const t = SND.ctx.currentTime, v = 0.11 * k;
  for (const dt of [0, hoch ? 0.11 : 0.14]) { sndBurst(t + dt, 0.09, 170, 0.8, v, 'out', 'lowpass', true); sndBurst(t + dt, 0.03, 2600, 3, v * 0.25, 'out'); }
}
function klFogHorn(k) {
  const t = SND.ctx.currentTime + 0.1;
  sndTone(124, t, 3.0, 0.1 * k, 'sawtooth', 'out', 118, 0.4); sndTone(186, t, 2.9, 0.04 * k, 'sawtooth', 'out', 178, 0.4);
  sndTone(88, t + 2.7, 1.3, 0.09 * k, 'sawtooth', 'out', 80, 0.4);   // das tiefe „Oh“ am Ende
}
function klFactory(k) {
  const t = SND.ctx.currentTime;
  for (const f of [523, 659, 784]) sndTone(f * 0.985, t, 2.6, 0.016 * k, 'triangle', 'out', f, 0.5);
  sndBurst(t, 2.8, 3800, 0.7, 0.02 * k, 'out', 'bandpass');
}
function klCreak(k, bus = 'out') {
  const ctx = SND.ctx, t = ctx.currentTime, o = ctx.createOscillator(), fl = sndFilter('bandpass', kR(500, 900), 6), g = ctx.createGain(), d = kR(0.5, 1.1);
  o.type = 'sawtooth'; o.frequency.setValueAtTime(kR(70, 110), t); o.frequency.linearRampToValueAtTime(kR(40, 70), t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03 * k, t + 0.1); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(fl); fl.connect(g); g.connect(SND.bus[bus]); o.start(t); o.stop(t + d + 0.05);
}
// Turmuhr des Belmont: eigenes Viertelstunden-Motiv, zur vollen Stunde danach die Stundenschläge
const CHIME = [[76, 79, 74, 67], [67, 74, 76, 79], [76, 74, 79, 67], [72, 76, 74, 67]];
function klTowerClock(quarter, hour, k, delay) {
  const t0 = SND.ctx.currentTime + delay, mt = m => 440 * Math.pow(2, (m - 69) / 12);
  let t = t0; const q = quarter === 0 ? 4 : quarter;
  for (let i = 0; i < q; i++) { CHIME[i].forEach((m, j) => klBell(mt(m), t + j * 0.62, 0.05 * k, 2.6)); t += 2.9; }
  if (quarter === 0) for (let i = 0; i < hour; i++) klBell(mt(48), t + 1 + i * 2.1, 0.09 * k, 4.5);
}

/* ---------- jedes Bild (aus music.js updateAudio) ---------- */
export function updateKlang(dt) {
  if (!SND.started || !SND.ctx || !SND.L.city) return;
  if (!KL.L) klBuild();
  if (!SND.on || SND.ctx.state !== 'running') return;
  const L = KL.L, cp = camera.position, z = SND.zone, outside = z === 'out' || z === 'terrace' || z === 'deck';
  const W = ATMO.cur || {}, wid = ATMO.w ? ATMO.w.id : '', storm = W.storm || 0, t = SND.ctx.currentTime;

  // Villa: Standuhr (jedes Bild, damit der Takt gleichmäßig bleibt)
  if (z === 'villa' && !paused) {
    if ((KL.tick -= dt) <= 0) { KL.tick += 1; KL.tock = !KL.tock; sndBurst(t, 0.035, KL.tock ? 2300 : 3100, 7, 0.016, 'near'); sndBurst(t, 0.05, 700, 3, 0.01, 'near', 'bandpass', true); }
  } else KL.tick = 0;
  // Straßenbahn und Hochbahn über die Schienenstöße
  let bd = 1e9, bv = 0, bh = false;
  for (const c of BAHN.cars) { const v = c.veh && c.veh.v || 0; if (v < 2) continue; const d = Math.hypot(c.x - cp.x, (c.y || 0) - cp.y, c.z - cp.z); if (d < bd) { bd = d; bv = v; bh = c.kind === 'hoch'; } }
  if (bd < 130 && !paused) { if ((KL.clack -= dt) <= 0) { KL.clack = 14 / bv; klClack(Math.pow(1 - bd / 130, 2) * (z === 'out' ? 1 : 0.5), bh); } } else KL.clack = 0.3;

  if ((KL.slow -= dt) > 0) return;
  KL.slow = 0.25;
  // Schnee und Nebel schlucken die Höhen der Stadt
  const fogK = wid === 'frostnebel' ? 1 : Math.min(1, Math.max(0, ((W.fog || 0) - 1.6) / 1.4));
  sndSet(SND.mix.fog.frequency, Math.min(20000, 20000 * Math.pow(0.16, fogK) * Math.pow(0.25, storm) * (1 - 0.35 * (W.snow || 0))), 1.5);
  // Sturm
  const gust = WIND.gust || 0;
  sndSet(L.howl.gain, storm * (0.05 + 0.07 * gust), 0.5); sndSet(L.rumble.gain, storm * 0.12, 1);
  if (storm > 0.02) L.hf.forEach((f, i) => sndSet(f.frequency, (i ? 560 : 330) + gust * (i ? 520 : 300) + Math.sin(t * (0.21 + i * 0.13) + i) * (i ? 140 : 90), 0.7));
  // Nordlicht (nur unter freiem Himmel)
  const aur = Math.min(1, Math.max(0, ((W.aurora || 0) - 0.45) / 0.55)) * (outside ? 1 : 0) * (1 - storm);
  sndSet(L.aur.gain, 0.008 * aur * (wid === 'nordlicht' ? 1.6 : 1), 2);
  // Brunnen
  const fd = Math.hypot(cp.x - FOUNT.x, cp.z - FOUNT.z, Math.max(0, cp.y - 3)), fk = fd < 80 ? Math.pow(1 - fd / 80, 2) : 0;
  sndSet(L.font.gain, 0.09 * fk, 0.6); sndSet(L.fontLo.gain, 0.12 * fk, 0.6); sndPanAt(L.fontP, FOUNT.x, FOUNT.z);
  // Penthouse: Wind am Glas, im Sturm lauter
  sndSet(L.glass.gain, z === 'pent' ? 0.012 + 0.04 * storm + 0.012 * gust : 0, 1);
  sndSet(L.glassF.frequency, 240 + gust * 260 + Math.sin(t * 0.3) * 50, 0.8);

  // seltene Ereignisse
  const now = t, dist = shared.lastDistrict || '', st = 0.25;
  if (paused || !playing) return;
  if (storm > 0.35) {
    if (Math.random() < 0.05 * storm) sndClip('metal', kR(0.02, 0.05) * storm, kR(0.45, 0.75), 'out', 0.2);   // Fensterläden
    if (Math.random() < 0.025 * storm) klCreak(storm);
    if (Math.random() < 0.03 * storm) sndBurst(now, kR(1.8, 3), kR(350, 700), 1.2, 0.05 * storm, 'out');   // Bö
  }
  if (wid === 'meteore' && outside && Math.random() < 0.035) { sndTone(kR(4200, 6200), now, kR(0.8, 1.4), 0.004, 'sine', 'out', kR(1800, 2600)); sndBurst(now, 0.9, 5200, 2, 0.008, 'out', 'highpass'); }
  // Hafen: Boje, Taue, Nebelhorn
  const hd = Math.hypot(cp.x - HARBOUR.x, cp.z - HARBOUR.z);
  if (hd < 300 && cp.y < 60 && (KL.buoy -= st) <= 0) { KL.buoy = kR(5, 11); klBell(kR(560, 640), now, 0.022 * (1 - hd / 300), 2.4); }
  if (hd < 180 && z === 'out' && Math.random() < 0.02) klCreak(0.6 * (1 - hd / 180));
  if (fogK >= 0.5 && (KL.horn -= st) <= 0) { KL.horn = kR(32, 55); const d = Math.hypot(cp.x - LIGHT.x, cp.z - LIGHT.z); klFogHorn(Math.max(0.15, 1 / (1 + (d / 450) ** 2))); }
  // Arbeiterviertel: Fabrikpfeife
  if ((dist === 'Arbeiterviertel' || dist === 'Industriegebiet Ost') && outside && (KL.whistle -= st) <= 0) { KL.whistle = kR(90, 200); klFactory(0.7); }
  // Lachen in der Menge, im Ballsaal, in der Lobby und in der Kneipe
  if ((SND.vK || 0) > 0.25 && Math.random() < 0.035 * SND.vK) klLaugh(Math.min(1, SND.vK * 1.4));
  // Lobby: Glocke an der Rezeption, Gong der Fahrstühle
  if (z === 'lobby' && (KL.desk -= st) <= 0) {
    KL.desk = kR(18, 45);
    if (Math.random() < 0.6) klBell(1975.5, now, 0.02, 1.4, 'near');
    else { sndTone(659.3, now, 1.4, 0.03, 'sine', 'near', 0, 0.5); sndTone(523.3, now + 0.45, 1.8, 0.03, 'sine', 'near', 0, 0.5); }
  }
  // Turmuhr: zur vollen Stunde und zu jeder Viertelstunde (Uhr des Rechners)
  const d = new Date(), m = d.getMinutes(), key = d.getHours() + ':' + m;
  if (m % 15 === 0 && d.getSeconds() < 3 && KL.chimeKey !== key) {
    KL.chimeKey = key;
    const bd2 = Math.hypot(cp.x - BELL_AT.x, cp.z - BELL_AT.z), k = z === 'villa' ? 0.25 : z === 'pent' || z === 'terrace' ? 1 : Math.max(0.12, 1 / (1 + (bd2 / 600) ** 2));
    klTowerClock(m / 15, d.getHours() % 12 || 12, k, Math.min(3, bd2 / 343));
  }
}

/* ---------- Browser und Handy: angehalten im Hintergrund, nach Unterbrechungen wieder an ---------- */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const c = SND.ctx; if (!c) return;
    if (document.hidden) { if (c.state === 'running') { KL.hid = true; c.suspend(); } }
    else if (KL.hid && SND.on) { KL.hid = false; c.resume(); }
  });
  const wake = () => { const c = SND.ctx; if (c && SND.started && SND.on && c.state !== 'running' && c.state !== 'closed' && !document.hidden) c.resume(); };
  for (const ev of ['pointerdown', 'touchend', 'keydown']) window.addEventListener(ev, wake, { passive: true });
}

/* =====================================================================
   MISCHPULT (Pausenmenü „Klang“, Shift+M)
   ===================================================================== */
const KL_ROWS = [['all', 'Gesamt', 'Alles zusammen'], ['music', 'Musik', 'Band, Klavier, Grammophon, Leierkasten'], ['amb', 'Stadt und Wetter', 'Verkehr, Bahnen, Leute, Hafen, Wind, Sturm'],
  ['sfx', 'Effekte', 'Schritte, Kräfte, Motor, Flug'], ['voice', 'Stimmen', 'Randolf, Personal und Leute (Sprachausgabe)']];
const KL_CSS = `
#klang { position: fixed; inset: 0; z-index: 31; display: grid; place-items: center; padding: 16px;
  background: radial-gradient(ellipse at 50% 30%, rgba(8,40,48,0.5), rgba(3,10,16,0.88) 70%); }
#klang .kpanel { position: relative; width: min(520px, 100%); max-height: 100%; overflow-y: auto; box-sizing: border-box; padding: 22px 26px 18px;
  background: linear-gradient(180deg, rgba(6,22,30,0.97), rgba(4,14,20,0.97)); border: 1px solid rgba(217,178,106,0.7); outline: 1px solid rgba(217,178,106,0.25); outline-offset: 6px; }
#klang h2 { margin: 0 0 4px; text-align: center; font-family: var(--display); font-weight: 400; font-size: clamp(24px, 4vw, 34px); letter-spacing: 0.16em;
  background: linear-gradient(180deg, var(--gold-hi) 15%, var(--gold) 60%, #8a6428); -webkit-background-clip: text; background-clip: text; color: transparent; }
#klang .ksub { margin: 0 0 16px; text-align: center; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
#klang label { display: grid; grid-template-columns: minmax(0, 1fr) 46px; gap: 4px 12px; align-items: center; padding: 10px 0; border-top: 1px solid rgba(217,178,106,0.16); }
#klang label b { font-family: var(--display); font-weight: 400; font-size: 17px; letter-spacing: 0.06em; color: var(--gold-hi); }
#klang label small { grid-column: 1 / -1; font-size: 12px; color: var(--muted); font-weight: 300; }
#klang label output { text-align: right; font: 600 13px/1 var(--body); color: var(--teal); }
#klang input[type=range] { grid-column: 1 / -1; width: 100%; accent-color: var(--gold); height: 26px; margin: 0; cursor: pointer; }
#klang input[type=range]:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
#klang .kfoot { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; padding-top: 14px; border-top: 1px solid rgba(217,178,106,0.3); }
`;
function klPanel() {
  if (KL.panel) return KL.panel;
  const st = document.createElement('style'); st.textContent = KL_CSS; document.head.append(st);
  const el = document.createElement('div'); el.id = 'klang'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'klangTitel');
  el.innerHTML = `<div class="kpanel"><h2 id="klangTitel">Klang</h2><p class="ksub">Lautstärken · bleiben gespeichert</p>`
    + KL_ROWS.map(([k, t, d]) => `<label><b>${t}</b><output data-o="${k}"></output><input type="range" min="0" max="100" step="5" data-k="${k}" aria-label="${t}"><small>${d}</small></label>`).join('')
    + `<div class="kfoot"><button class="qual" type="button" data-ton></button><button class="qual" type="button" data-std>Standard</button><button class="btn" type="button" data-zu>Fertig</button></div></div>`;
  document.body.append(el);
  el.addEventListener('input', ev => { const k = ev.target.dataset && ev.target.dataset.k; if (!k) return; setSndVol(k, ev.target.value / 100); klShow(); });
  el.addEventListener('change', ev => { const k = ev.target.dataset && ev.target.dataset.k; if (k === 'sfx' && SND.sprite) sndClip('glass', 0.15, 1.2, 'sfx'); });   // Probe
  el.querySelector('[data-ton]').addEventListener('click', () => { toggleSound(); setTimeout(klShow, 60); });
  el.querySelector('[data-std]').addEventListener('click', () => { for (const [k, v] of Object.entries({ all: 0.9, music: 0.8, amb: 0.9, sfx: 0.9, voice: 1 })) setSndVol(k, v); klShow(); });
  el.querySelector('[data-zu]').addEventListener('click', closeKlang);
  el.addEventListener('click', ev => { if (ev.target === el) closeKlang(); });
  return KL.panel = el;
}
function klShow() {
  const el = KL.panel; if (!el) return;
  for (const [k] of KL_ROWS) { const v = Math.round(SND_VOL[k] * 100); el.querySelector(`[data-k="${k}"]`).value = v; el.querySelector(`[data-o="${k}"]`).textContent = v + ' %'; }
  el.querySelector('[data-ton]').textContent = 'Ton: ' + (SND.on ? 'an' : 'aus');
}
export function openKlang() {
  const el = klPanel(); klShow(); KL.open = true; el.hidden = false;
  if (!SND.started && playing) startAudio();
  el.querySelector('input').focus({ preventScroll: true });
}
export function closeKlang() { if (!KL.panel) return; KL.open = false; KL.panel.hidden = true; const b = $('klangBtn'); if (b && !$('overlay').hidden) b.focus({ preventScroll: true }); }
function klKey(e) {
  if (KL.open) {
    if (e.code === 'Escape' || (e.code === 'KeyM' && e.shiftKey)) { e.preventDefault(); closeKlang(); }
    e.stopImmediatePropagation(); return;   // Pfeiltasten bewegen die Regler, keine Spieltasten
  }
  if (e.code === 'KeyM' && e.shiftKey && !e.repeat) {
    e.preventDefault(); e.stopImmediatePropagation();
    if (playing && !paused) { if (locked && document.exitPointerLock) document.exitPointerLock(); pause(); }
    openKlang();
  }
}
function klSetup(n = 0) {
  const bar = $('pauseKeys');
  if (!bar && n < 40) { setTimeout(() => klSetup(n + 1), 50); return; }
  if (bar && !$('klangBtn')) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'qual'; b.id = 'klangBtn'; b.textContent = 'Klang';
    b.addEventListener('click', openKlang); const ton = $('pauseTon'); if (ton) ton.after(b); else bar.append(b);
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', klKey, true);
  setTimeout(() => {
    addTasten('einstellungen', [{ id: 'klang', k: ['Shift', '+', 'M'], t: 'Klang und Lautstärke', d: 'Regler für Musik, Stadt und Wetter, Effekte und Stimmen', act: () => { openKlang(); } }]);
    klSetup();
  }, 0);
}
