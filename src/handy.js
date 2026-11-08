/* =====================================================================
   V61 · HANDY: TOUCH-STEUERUNG UND LEISTUNG
   Auf Touch-Geräten (oder am PC mit ?handy) ersetzt diese Datei die alte
   Knopfleiste durch ein Bedienfeld für den Daumen, ganz im Art-déco-Gold:
   - rechts unten: großer Knopf STOSS (tippen = Handstoß, halten = aufladen,
     der Ring füllt sich), KRAFT (Telekinese greifen / loslassen), ▲ springen
     bzw. im Flug steigen, FLIEGEN / LANDEN, im Flug ▼ sinken und TEMPO.
   - hält Alexander etwas mit der Telekinese: STOSS wird WERFEN, dazu
     NÄHER / WEITER (halten). Trägt er etwas in der Hand: WERFEN, ABLEGEN, DREHEN.
   - Kräfte-Leiste: WELLE (X), SCHILD (H), SCHWEBEN (L), ZEIT (Z); was an ist, leuchtet.
   - BENUTZEN erscheint, wenn es etwas zu benutzen oder anzusprechen gibt.
   - oben links: Pause und ein Menü mit Ansicht, Wetter, Tanz, Musik, Leistung, Qualität.
   - am Steuer, Ruder oder im Luftschiff nur, was dort gebraucht wird.
   Die PC-Steuerung bleibt unverändert; links ziehen = gehen, rechts ziehen =
   umsehen kommt weiter aus input.js.

   Leistung (nur Handy, am PC nur mit ?handy): ein Wächter senkt in Stufen
   Laderadius der Zellen, Sichtweite der Menge und das Nachleuchten, wenn das
   Bild schon bei kleinster Auflösung zu langsam ist, und hebt sie wieder,
   wenn Luft ist. Auf dem Handy startet die Stadt eine Stufe sparsamer.
   ===================================================================== */
import { $, MOBILE, shared } from './core.js';
import { player, keys, touch } from './player.js';
import { isTouch, playing, paused, pause, toggleQuality } from './input.js';
import { POWERS, toggleFlight, startFlight, tkToggle, tkRelease, tkDistance } from './powers.js';
import { BLAST, blastDown, blastUp } from './energy.js';
import { KRAEFTE, shockwave, toggleShield, toggleLevitation, toggleSlowTime } from './kraefte.js';
import { LOOSE, drop, rotateHeld } from './physics.js';
import { activeUse, toggleMusic } from './music.js';
import { DRIVE } from './eating.js';
import { BOAT, toast } from './boat.js';
import { DINE } from './venues.js';
import { IMP, impToggleCam } from './imperial.js';
import { PM, toggleView, toggleDance } from './player-model.js';
import { cycleWeather } from './atmosphere.js';
import { ftAvg, prIdx, PR_LEVELS, togglePerf } from './performance.js';
import { layers } from './chunks.js';
import { pedCrowd } from './serpentine.js';
import { HQ } from './people-model.js';
import { composer } from './bloom.js';

const HD_Q = new URLSearchParams(location.search);
export const HANDY = {
  ui: false, gov: false, el: {}, last: {}, hold: { near: 0, far: 0 }, holdT: 0, menu: false,
  // Leistungsstufen: Anteil am Laderadius, Sichtweite der Menge, Nachleuchten
  lvl: 0, base: 0, bad: 0, good: 0, since: 0, bloomOff: false, range: 1,
};
export const HD_LEVELS = [
  // V71: hi = Abstand, bis zu dem Menschen als feines Modell gezeichnet werden (people-model.js HQ.hi2)
  { range: 1, crowd: 420, bloom: true, hi: 45 },
  { range: 0.85, crowd: 320, bloom: true, hi: 25 },
  { range: 0.72, crowd: 240, bloom: false, hi: 19 },
  { range: 0.6, crowd: 170, bloom: false, hi: 15 },
];

/* ---------- Aussehen ---------- */
const HD_CSS = `
body.handy #touchUI { display: none !important; }
body.handy #hint, body.handy #head { display: none; }
body.handy #status { font-size: 11px; gap: 2px; }
body.handy #mapWrap { top: calc(66px + env(safe-area-inset-top, 0px)); bottom: auto; left: calc(16px + env(safe-area-inset-left, 0px)); right: auto; width: 104px; height: 104px; }
body.handy #npc { left: calc(136px + env(safe-area-inset-left, 0px)); max-width: min(260px, 40vw); }
.hdUI { position: fixed; inset: 0; z-index: 12; pointer-events: none; }
.hdUI button {
  position: absolute; pointer-events: auto; touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; user-select: none;
  -webkit-tap-highlight-color: transparent; border-radius: 50%; border: 1px solid rgba(217,178,106,0.6);
  background: rgba(5,16,24,0.62); color: #f6dc9a; font: 600 10px/1.05 "Josefin Sans", "Futura", "Century Gothic", system-ui, sans-serif;
  letter-spacing: 0.12em; text-transform: uppercase; display: grid; place-items: center; padding: 0; margin: 0;
  box-shadow: 0 0 0 3px rgba(5,16,24,0.35), inset 0 0 0 3px rgba(5,16,24,0.5), inset 0 0 0 4px rgba(217,178,106,0.22);
  transition: background .12s, box-shadow .12s, opacity .2s;
}
.hdUI button[hidden] { display: none; }
.hdUI button.dn { background: rgba(217,178,106,0.32); }
.hdUI button.on { color: #04121a; background: radial-gradient(circle, #9ff0e8 0%, #6fd6cf 70%); border-color: #c9fff8; box-shadow: 0 0 14px 3px rgba(111,214,207,0.55), inset 0 0 0 3px rgba(4,18,26,0.25); }
.hdUI button.cd { opacity: 0.45; }
.hdUI button b { display: block; font-size: 17px; font-weight: 400; letter-spacing: 0; line-height: 1; margin-bottom: 2px; }
.hdPad { position: absolute; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); width: 240px; height: 280px; }
.hdPad #hdMain { width: 86px; height: 86px; right: 0; bottom: 0; font-size: 12px; letter-spacing: 0.18em; border-width: 2px; }
.hdPad #hdMain i { position: absolute; inset: 6px; border-radius: 50%; background: rgba(5,16,24,0.82); display: grid; place-items: center; font-style: normal; }
.hdPad #hdGrab { width: 64px; height: 64px; right: 100px; bottom: 4px; }
.hdPad #hdUp { width: 64px; height: 64px; right: 10px; bottom: 100px; font-size: 20px; }
.hdPad #hdFly { width: 58px; height: 58px; right: 94px; bottom: 92px; }
.hdPad #hdDown { width: 56px; height: 56px; right: 178px; bottom: 8px; font-size: 18px; }
.hdPad #hdFast { width: 52px; height: 52px; right: 16px; bottom: 176px; }
.hdPad #hdNear { width: 48px; height: 48px; right: 182px; bottom: 76px; }
.hdPad #hdFar { width: 48px; height: 48px; right: 182px; bottom: 130px; }
.hdPad #hdRot { width: 48px; height: 48px; right: 182px; bottom: 76px; }
.hdPad #hdUse { right: 0; bottom: 236px; width: auto; min-width: 128px; height: 40px; border-radius: 20px; padding: 0 16px; font-size: 12px; letter-spacing: 0.2em; }
.hdPow { position: absolute; display: flex; gap: 8px; right: calc(268px + env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); }
.hdPow button { position: relative; width: 54px; height: 54px; font-size: 8.5px; letter-spacing: 0.08em; }
@media (orientation: portrait) {
  .hdPow { flex-direction: column; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(306px + env(safe-area-inset-bottom, 0px)); }
}
.hdTop { position: absolute; display: flex; gap: 8px; top: calc(14px + env(safe-area-inset-top, 0px)); left: calc(16px + env(safe-area-inset-left, 0px)); }
.hdTop button { position: relative; width: 44px; height: 44px; border-radius: 0; font-size: 15px; letter-spacing: 0; }
.hdMenu {
  position: absolute; pointer-events: auto; top: calc(66px + env(safe-area-inset-top, 0px)); left: calc(16px + env(safe-area-inset-left, 0px));
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 10px; width: 236px; background: rgba(5,16,24,0.9);
  border: 1px solid rgba(217,178,106,0.75); box-shadow: 0 0 0 4px rgba(5,16,24,0.6), 0 0 0 5px rgba(217,178,106,0.35);
}
.hdMenu[hidden] { display: none; }
.hdMenu button { position: relative; width: 100%; border-radius: 0; height: 40px; font-size: 11px; letter-spacing: 0.14em; }
`;

/* ---------- Knöpfe ---------- */
function hdBtn(parent, id, html, down, up) {
  const b = document.createElement('button'); b.type = 'button'; b.id = id; b.innerHTML = html;
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); b.classList.add('dn');
    try { b.setPointerCapture(e.pointerId); } catch {}
    if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
    if (playing && !paused) down && down(e);
  });
  const end = () => { if (!b.classList.contains('dn')) return; b.classList.remove('dn'); up && up(); };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, end);
  b.addEventListener('contextmenu', e => e.preventDefault());
  parent.appendChild(b); HANDY.el[id] = b; return b;
}
const hdLab = (glyph, txt) => (glyph ? '<span><b>' + glyph + '</b>' : '<span>') + txt + '</span>';

function hdBuild() {
  const st = document.createElement('style'); st.textContent = HD_CSS; document.head.appendChild(st);
  document.body.classList.add('handy');
  const ui = document.createElement('div'); ui.className = 'hdUI touch'; ui.id = 'hdUI'; ui.hidden = true; document.body.appendChild(ui);
  HANDY.root = ui;
  const pad = document.createElement('div'); pad.className = 'hdPad'; ui.appendChild(pad);
  const pow = document.createElement('div'); pow.className = 'hdPow'; ui.appendChild(pow);
  const top = document.createElement('div'); top.className = 'hdTop'; ui.appendChild(top);

  // Hauptknopf: Energieschub (halten lädt auf) oder werfen
  hdBtn(pad, 'hdMain', '<i>STOSS</i>', () => {
    if (POWERS.tk) { tkRelease(true); HANDY.mainThrow = true; return; }
    if (LOOSE.held) { drop(true); HANDY.mainThrow = true; return; }
    HANDY.mainThrow = false; blastDown();
  }, () => { if (!HANDY.mainThrow) blastUp(); HANDY.mainThrow = false; });
  hdBtn(pad, 'hdGrab', hdLab('✋', 'Kraft'), () => { if (LOOSE.held) drop(false); else tkToggle(); });
  hdBtn(pad, 'hdUp', '▲', () => {
    touch.up = 1;
    if (DRIVE.on || BOAT.on || IMP.st === 'helm') return;
    if (!player.fly) { if (player.onGround) player.v.y = 7.2; else startFlight(); }
  }, () => { touch.up = 0; });
  hdBtn(pad, 'hdFly', hdLab('', 'Fliegen'), () => toggleFlight());
  hdBtn(pad, 'hdDown', '▼', () => { touch.down = 1; }, () => { touch.down = 0; });
  hdBtn(pad, 'hdFast', hdLab('»', 'Tempo'), () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
  hdBtn(pad, 'hdNear', hdLab('−', 'Näher'), () => { HANDY.hold.near = 1; HANDY.holdT = 0; tkDistance(-1); }, () => { HANDY.hold.near = 0; });
  hdBtn(pad, 'hdFar', hdLab('+', 'Weiter'), () => { HANDY.hold.far = 1; HANDY.holdT = 0; tkDistance(1); }, () => { HANDY.hold.far = 0; });
  hdBtn(pad, 'hdRot', hdLab('⟳', 'Drehen'), () => rotateHeld());
  hdBtn(pad, 'hdUse', 'Benutzen', () => { if (activeUse) activeUse.act(); });

  // Kräfte
  hdBtn(pow, 'hdX', hdLab('◎', 'Welle'), () => shockwave());
  hdBtn(pow, 'hdH', hdLab('◯', 'Schild'), () => toggleShield());
  hdBtn(pow, 'hdL', hdLab('✦', 'Schweben'), () => toggleLevitation());
  hdBtn(pow, 'hdZ', hdLab('⧗', 'Zeit'), () => toggleSlowTime());

  // oben: Pause und Menü (Pause auch, wenn das Spiel schon angehalten ist: nichts tun)
  hdBtn(top, 'hdPause', '❚❚', () => { HANDY.menu = false; pause(); });
  hdBtn(top, 'hdMore', '⋯', () => { HANDY.menu = !HANDY.menu; });
  const menu = document.createElement('div'); menu.className = 'hdMenu'; menu.hidden = true; ui.appendChild(menu); HANDY.menuEl = menu;
  const item = (id, txt, fn) => hdBtn(menu, id, txt, () => { HANDY.menu = false; fn(); });
  item('hdView', 'Ansicht', () => toast(IMP.st === 'helm' ? impToggleCam() : toggleView() === 'third' ? 'Ansicht von hinten' : 'Ich-Ansicht'));
  item('hdWx', 'Wetter', () => cycleWeather());
  item('hdDance', 'Tanzen', () => { if (PM.view !== 'third') toggleView(); const d = toggleDance(); toast(d === 1 ? 'Charleston' : d === 2 ? 'Langsamer Tanz' : 'Tanz aus'); });
  item('hdMusic', 'Musik', () => toggleMusic());
  item('hdPerf', 'Leistung', () => toast(togglePerf() ? 'Leistungsanzeige an' : 'Leistungsanzeige aus'));
  item('hdQual', 'Qualität', () => toggleQuality());
  // V61 Pausenmenü (pausemenu.js, falls vorhanden): Übersicht „Tasten & Kräfte“ auch per Fingertipp
  item('hdKeys', 'Übersicht', () => { pause(); const b = document.getElementById('tastenBtn'); if (b) b.click(); });
  item('hdLevel', 'Sparstufe', () => { if (HANDY.gov) { hdApply(HANDY.lvl < HD_LEVELS.length - 1 ? HANDY.lvl + 1 : HANDY.base, false); toast(HANDY.lvl > HANDY.base ? 'Sparmodus fürs Handy · Stufe ' + (HANDY.lvl - HANDY.base) : 'Sparmodus aus'); HANDY.manual = true; } });
}
// Einträge für die Tastenübersicht im Pausenmenü (ohne Import: läuft auch, wenn es das Menü nicht gibt)
function hdTasten() {
  const T = [
    { id: 'hdGehen', k: ['Links wischen'], t: 'Gehen', d: 'Daumen links aufsetzen und ziehen; rechts wischen zum Umsehen' },
    { id: 'hdStoss', k: ['Stoß'], t: 'Energieschub', d: 'Tippen: Handstoß rechts, links, beidhändig. Halten: aufladen, der Ring füllt sich, loslassen feuert' },
    { id: 'hdKraft', k: ['Kraft'], t: 'Telekinese', d: 'Packt, was im Fadenkreuz liegt. Dann wird Stoß zu Werfen, dazu Näher und Weiter' },
    { id: 'hdFlug', k: ['Fliegen', '▲', '▼'], t: 'Fliegen', d: '▲ springen oder steigen, ▼ sinken, Tempo halten für schnellen Flug, Landen setzt auf' },
    { id: 'hdKr', k: ['Welle', 'Schild', 'Schweben', 'Zeit'], t: 'Weitere Kräfte', d: 'Schockwelle, Schutzschild, Levitation und Zeitlupe; was an ist, leuchtet türkis' },
    { id: 'hdMehr', k: ['⋯'], t: 'Menü oben links', d: 'Ansicht, Wetter, Tanzen, Musik, Leistung, Qualität, Sparstufe; ❚❚ pausiert' },
  ];
  window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'handy', titel: 'Auf dem Handy', nach: 'bewegung', tasten: T } }));
  window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'einstellungen', tasten: [{ id: 'touch', k: ['Knöpfe'], t: 'Auf dem Handy', d: 'Siehe Gruppe „Auf dem Handy“: Stoß, Kraft, Fliegen und die Kräfte-Leiste' }] } }));
}

/* ---------- Zustand der Knöpfe (nur ändern, was sich ändert) ---------- */
function hdSet(id, hidden, label, on, cd) {
  const b = HANDY.el[id], L = HANDY.last[id] || (HANDY.last[id] = {});
  if (L.h !== hidden) { L.h = hidden; b.hidden = hidden; }
  if (label != null && L.l !== label) { L.l = label; if (id === 'hdMain') b.firstChild.textContent = label; else b.innerHTML = label; }
  if (L.on !== !!on) { L.on = !!on; b.classList.toggle('on', !!on); }
  if (L.cd !== !!cd) { L.cd = !!cd; b.classList.toggle('cd', !!cd); }
}
function hdUpdateUI(dt) {
  const show = playing && !paused;
  if (show && !HANDY.tasten) { HANDY.tasten = true; hdTasten(); }
  if (HANDY.lastShow !== show) { HANDY.lastShow = show; HANDY.root.hidden = !show; if (!show) { HANDY.menu = false; touch.up = touch.down = 0; keys.ShiftLeft = false; } }
  if (!show) return;
  const helm = IMP.st === 'helm', veh = DRIVE.on || BOAT.on || helm, seat = !!DINE.seat, tk = !!POWERS.tk, held = !!LOOSE.held, fly = player.fly;
  const free = !veh && !seat;
  // Hauptknopf: werfen / aufladen / stoßen
  let main = tk || held ? 'Werfen' : 'Stoß';
  const B = BLAST, M = HANDY.el.hdMain;
  if (B.st === 'charge') {
    const c = Math.min(1, (B.ct || 0) / 1.4); main = c >= 1 ? 'Voll' : 'Laden';
    const deg = Math.round(c * 360);
    if (HANDY.last.ring !== deg) { HANDY.last.ring = deg; M.style.background = `conic-gradient(rgba(111,214,207,0.95) ${deg}deg, rgba(5,16,24,0.62) 0)`; }
    if (c >= 1 && !HANDY.buzzed) { HANDY.buzzed = true; if (navigator.vibrate) try { navigator.vibrate(30); } catch {} }
  } else if (HANDY.last.ring !== -1) { HANDY.last.ring = -1; M.style.background = ''; HANDY.buzzed = false; }
  hdSet('hdMain', !free, main, B.st === 'charge');
  hdSet('hdGrab', !free, held ? hdLab('⤓', 'Ablegen') : tk ? hdLab('✋', 'Loslassen') : hdLab('✋', 'Kraft'), tk);
  hdSet('hdUp', seat || DRIVE.on || BOAT.on);
  hdSet('hdFly', !free, fly ? hdLab('', 'Landen') : hdLab('', 'Fliegen'), fly);
  hdSet('hdDown', !(fly && free) && !DRIVE.on && !helm, DRIVE.on ? hdLab('', 'Bremse') : '▼');
  hdSet('hdFast', !(fly && free));
  hdSet('hdNear', !(tk && free)); hdSet('hdFar', !(tk && free));
  hdSet('hdRot', !(held && free && !tk));
  hdSet('hdUse', !activeUse);
  hdSet('hdX', !free, null, KRAEFTE.dive, KRAEFTE.cd > 0 && !KRAEFTE.dive);
  hdSet('hdH', !free, null, KRAEFTE.shield);
  hdSet('hdL', !free, null, KRAEFTE.levOn);
  hdSet('hdZ', !free, null, KRAEFTE.slow);
  if (HANDY.menuEl.hidden === HANDY.menu) HANDY.menuEl.hidden = !HANDY.menu;
  hdSet('hdMore', false, null, HANDY.menu);
  // Telekinese näher / weiter: gedrückt halten wiederholt
  if (tk && (HANDY.hold.near || HANDY.hold.far) && (HANDY.holdT += dt) > 0.12) { HANDY.holdT = 0; tkDistance(HANDY.hold.near ? -1 : 1); }
}

/* ---------- Leistungswächter ---------- */
function hdWrapLayers() {
  for (const L of layers) {
    if (L._hd || !L.radiusAt) continue;
    const f = L.radiusAt; L._hd = true;
    // nie unter 120 m (oder den eigenen kleineren Radius), damit nahe Dinge nicht verschwinden
    L.radiusAt = cam => { const r = f(cam); return Math.max(Math.min(r, 120), r * HANDY.range); };
  }
}
function hdApply(i, say) {
  const S = HD_LEVELS[i]; HANDY.lvl = i; HANDY.range = S.range; HANDY.since = 0;
  if (pedCrowd) pedCrowd.far = S.crowd;
  HQ.hi2 = Math.min(S.hi, MOBILE ? 25 : 45) ** 2;
  if (!S.bloom && shared.bloomOn && composer) { shared.bloomOn = false; HANDY.bloomOff = true; }
  if (S.bloom && HANDY.bloomOff) { shared.bloomOn = true; HANDY.bloomOff = false; }
  if (say) toast(i > HANDY.base ? 'Sparmodus fürs Handy · Stufe ' + (i - HANDY.base) : 'Volle Sichtweite');
}
function hdGovern(dt) {
  if (!HANDY.started) { HANDY.started = true; hdWrapLayers(); hdApply(HANDY.base, false); }
  if (layers.some(L => !L._hd)) hdWrapLayers();
  HANDY.since += dt;
  if (paused || document.hidden || dt > 0.25 || HANDY.manual) return;
  // erst sparen, wenn die Auflösung schon ganz unten ist und es trotzdem ruckelt
  if (prIdx === 0 && ftAvg > 26) HANDY.bad += dt; else HANDY.bad = Math.max(0, HANDY.bad - dt * 0.5);
  const okPR = PR_LEVELS[prIdx] >= Math.min(0.9, PR_LEVELS[PR_LEVELS.length - 1]);
  if (ftAvg < 17 && okPR) HANDY.good += dt; else HANDY.good = 0;
  if (HANDY.bad > 3 && HANDY.since > 8 && HANDY.lvl < HD_LEVELS.length - 1) { HANDY.bad = 0; hdApply(HANDY.lvl + 1, true); }
  else if (HANDY.good > 12 && HANDY.since > 8 && HANDY.lvl > HANDY.base) { HANDY.good = 0; hdApply(HANDY.lvl - 1, true); }
}

/* ---------- Start ---------- */
let hdT = 0;
function hdLoop(now) {
  const dt = Math.min(0.5, (now - hdT) / 1000 || 0); hdT = now;
  if (HANDY.ui) hdUpdateUI(dt);
  if (HANDY.gov && playing) hdGovern(dt);
  requestAnimationFrame(hdLoop);
}
export function startHandy() {
  if (HD_Q.get('lab')) return;
  HANDY.ui = isTouch || HD_Q.has('handy');
  HANDY.gov = MOBILE || HD_Q.has('handy');
  HANDY.base = MOBILE ? 1 : 0;
  if (HANDY.ui) hdBuild();
  if (HANDY.ui || HANDY.gov) requestAnimationFrame(hdLoop);
  window.vesperaHandy = HANDY;
}
setTimeout(startHandy, 0);
