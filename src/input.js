import { shared, canvas, $ } from './core.js';
import { player, keys, touch } from './player.js';
import { DINE, placeOrder, closeMenu } from './venues.js';
import { DRIVE } from './eating.js';
import { initWindAudio } from './wind.js';
import { toast, VIEWS, goView, showDistrict, districtAt } from './boat.js';
import { toggleMusic, activeUse } from './music.js';
import { composer } from './bloom.js';
import { PM, toggleView, toggleDance, zoomView } from './player-model.js';
import { cycleWeather } from './atmosphere.js';

/* =====================================================================
   EINGABE
   ===================================================================== */
export let playing = false, paused = true, locked = false, dragging = false;
export const isTouch = matchMedia('(pointer: coarse)').matches;
export function look(dx, dy, k = 0.0022) {
  player.yaw -= dx * k; player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - dy * k));
  if (DRIVE.on) DRIVE.lookT = 1.5;
}
document.addEventListener('mousemove', e => {
  if (!playing || paused) return;
  if (locked) look(e.movementX, e.movementY);
  else if (dragging) look(e.movementX, e.movementY, 0.004);
});
canvas.addEventListener('mousedown', () => {
  if (!playing) return;
  if (!locked && !isTouch) tryLock();
  dragging = true;
});
window.addEventListener('mouseup', () => dragging = false);
export function tryLock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} }
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === canvas;
  if (was && !locked && playing && !DINE.menuOpen) pause();
});
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!playing) return;
  if (DINE.menuOpen) {
    const n = e.code.startsWith('Digit') ? +e.code.slice(5) : -1;
    if (n >= 0) placeOrder((n + 9) % 10); else if (e.code === 'Escape') { closeMenu(); if (!isTouch) tryLock(); }
    return;
  }
  if (e.code === 'Escape' && !locked) { paused ? resume() : pause(); return; }
  if (paused) return;
  if (e.code === 'KeyF') { player.fly = !player.fly; player.v.y = 0; toast(player.fly ? 'Flugmodus' : 'Zu Fuß'); }
  if (e.code === 'KeyM') toggleMusic();
  if (e.code === 'KeyE' && activeUse) activeUse.act();
  if (e.code === 'KeyB') { shared.bloomOn = !shared.bloomOn && !!composer; toast(shared.bloomOn ? 'Leuchteffekt an' : 'Leuchteffekt aus'); }
  if (e.code === 'KeyN') cycleWeather();
  if (e.code === 'KeyV') toast(toggleView() === 'third' ? 'Ansicht von hinten' : 'Ich-Ansicht');
  if (e.code === 'KeyG') { if (PM.view !== 'third') toggleView(); const d = toggleDance(); toast(d === 1 ? 'Charleston' : d === 2 ? 'Langsamer Tanz' : 'Tanz aus'); }
  if (VIEWS[e.code]) goView(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

export function pause() {
  paused = true;
  $('enter').textContent = 'Weiter';
  $('lede').textContent = 'Pause. Vespera wartet auf dich.';
  $('overlay').hidden = false;
}
export function resume() {
  paused = false; $('overlay').hidden = true;
  if (!isTouch) tryLock();
}
$('enter').addEventListener('click', () => {
  initWindAudio();
  if (!playing) { playing = true; player.fly = false; showDistrict(districtAt(player.p.x, player.p.z, player.p.y)); }
  resume();
  if (isTouch) { $('touchUI').hidden = false; }
});

// Touch: linke Hälfte Joystick, rechte Hälfte Umsehen
export const touches = new Map();
canvas.addEventListener('touchstart', e => {
  if (!playing || paused) return;
  for (const t of e.changedTouches) {
    const left = t.clientX < window.innerWidth * 0.45;
    touches.set(t.identifier, { left, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY });
    if (left) { const s = $('stick'); s.hidden = false; s.style.left = t.clientX + 'px'; s.style.top = t.clientY + 'px'; }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.left) {
      const dx = t.clientX - s.x0, dy = t.clientY - s.y0, L = Math.min(1, Math.hypot(dx, dy) / 50), a = Math.atan2(dy, dx);
      touch.mx = Math.cos(a) * L; touch.my = -Math.sin(a) * L;
      $('stick').firstElementChild.style.transform = `translate(${Math.cos(a) * L * 34}px, ${Math.sin(a) * L * 34}px)`;
    } else { look(t.clientX - s.x, t.clientY - s.y, 0.005); }
    s.x = t.clientX; s.y = t.clientY;
  }
  e.preventDefault();
}, { passive: false });
export const endTouch = e => {
  for (const t of e.changedTouches) {
    const s = touches.get(t.identifier); if (!s) continue;
    if (s.left) { touch.mx = touch.my = 0; $('stick').hidden = true; $('stick').firstElementChild.style.transform = ''; }
    touches.delete(t.identifier);
  }
};
canvas.addEventListener('touchend', endTouch); canvas.addEventListener('touchcancel', endTouch);
$('tWx').addEventListener('click', cycleWeather);
$('tUse').addEventListener('click', () => { if (activeUse) activeUse.act(); });
$('tView').addEventListener('click', () => toast(toggleView() === 'third' ? 'Ansicht von hinten' : 'Ich-Ansicht'));
window.addEventListener('wheel', e => { if (playing && PM.view === 'third') zoomView(e.deltaY); }, { passive: true });
$('tFly').addEventListener('click', () => { player.fly = !player.fly; toast(player.fly ? 'Flugmodus' : 'Zu Fuß'); });
for (const [id, k] of [['tUp', 'up'], ['tDown', 'down']]) {
  const b = $(id);
  b.addEventListener('pointerdown', () => { touch[k] = 1; if (k === 'up' && !player.fly && player.onGround) player.v.y = 7.2; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => touch[k] = 0);
}
