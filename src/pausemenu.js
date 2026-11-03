import { $, shared, QUALITY } from './core.js';
import { player } from './player.js';
import { playing, paused, locked, pause, resume, toggleQuality, isTouch } from './input.js';
import { POWERS, toggleFlight } from './powers.js';
import { KRAEFTE } from './kraefte.js';
import { SND, toggleSound } from './audio.js';
import { VOICE, toggleVoices } from './voice.js';
import { ATMO, cycleWeather } from './atmosphere.js';
import { VIEWS, goView, toast } from './boat.js';
import { PM } from './player-model.js';
import { composer } from './bloom.js';

/* =====================================================================
   V61: PAUSENMENÜ MIT TASTENÜBERSICHT (Art déco)
   Esc pausiert wie bisher; im Pausenbild öffnet „Tasten & Kräfte“ (oder Tab / F1 im Spiel)
   eine Übersicht in Gruppen. Leicht erweiterbar, ohne diese Datei anzufassen:
     import { addTasten } from './pausemenu.js';
     addTasten('kraefte', [{ k: ['Q'], t: 'Neue Kraft', d: 'Was sie tut', an: () => STATE.on }]);
   oder ohne Import (z. B. aus einem Modul, das früher geladen wird):
     window.dispatchEvent(new CustomEvent('vespera-tasten', { detail: { gruppe: 'stadt', tasten: [...] } }));
   Eine neue Gruppe: addTasten('handel', [...], { titel: 'Handel', nach: 'stadt' }).
   Auch eine neue Zeile in der alten Liste <div class="keys"> in index.html erscheint automatisch
   (unter „Weiteres“), solange ihr Tastenname noch nicht bekannt ist.
   Eintrag: k = Tasten (Strings; 'LM' linke Maus, 'RM' rechte Maus, 'RAD' Mausrad, '+' oder '/' als Trenner),
            t = Titel, d = Beschreibung, an = () => true/false/Text (Zustand, optional),
            act = Funktion (Zeile wird anklickbar; true zurückgeben = danach weiterspielen)
   ===================================================================== */

// feste Reihenfolge der Gruppen, auch wenn ein anderes Modul früher etwas einträgt
export const TASTEN = { gruppen: [['bewegung', 'Bewegung'], ['kraefte', 'Kräfte'], ['stadt', 'Stadt und Leute'], ['imperial', 'Aurora Imperial'],
  ['reisen', 'Aussichtspunkte'], ['einstellungen', 'Einstellungen']].map(([id, titel]) => ({ id, titel, e: [] })), offen: false, tab: 0, el: null };

function gruppe(id, titel, nach) {
  let g = TASTEN.gruppen.find(x => x.id === id);
  if (g) { if (titel) g.titel = titel; return g; }
  g = { id, titel: titel || id, e: [] };
  const i = nach ? TASTEN.gruppen.findIndex(x => x.id === nach) : -1;
  if (i >= 0) TASTEN.gruppen.splice(i + 1, 0, g); else TASTEN.gruppen.push(g);
  return g;
}
export function addTasten(id, eintraege, opt = {}) {
  const g = gruppe(id, opt.titel, opt.nach);
  let n = 0;
  for (const e of eintraege) {
    const j = e.id ? g.e.findIndex(x => x.id === e.id) : -1;
    if (j >= 0) g.e[j] = e; else if (opt.vorne) g.e.splice(n++, 0, e); else g.e.push(e);
  }
  if (TASTEN.offen) renderTasten();
}
if (typeof window !== 'undefined') {
  window.addEventListener('vespera-tasten', ev => { const d = ev.detail || {}; if (d.gruppe && d.tasten) addTasten(d.gruppe, d.tasten, d); });
  window.vesperaTasten = addTasten;
}

/* ---------- Was es heute gibt ---------- */
const onOff = v => v ? 'an' : 'aus';
function views() {
  return Object.keys(VIEWS).sort().map(code => {
    const n = code.slice(5);
    return { id: 'view' + n, k: [n], t: VIEWS[code].name, d: 'Hinfliegen: klicken', act: () => { resume(); goView(code); return false; } };
  });
}
function basis() {
  addTasten('bewegung', [
    { k: ['W', 'A', 'S', 'D'], t: 'Bewegen', d: 'Auch die Pfeiltasten. Im Flug: in Blickrichtung' },
    { k: ['Maus'], t: 'Umsehen', d: 'Klick ins Bild fängt die Maus ein' },
    { k: ['Shift'], t: 'Laufen', d: 'Im Flug: schneller fliegen' },
    { k: ['Leertaste'], t: 'Springen', d: 'Im Sprung noch einmal: abheben. Im Flug: steigen' },
    { k: ['F'], t: 'Fliegen und landen', d: 'Alexanders Kraft aus dem Kristall', an: () => onOff(player.fly), act: () => { toggleFlight(); return true; } },
    { k: ['C', '/', 'Q', '/', 'Strg'], t: 'Sinken', d: 'Im Flug sinken, am Boden landen' },
    { k: ['V'], t: 'Ansicht', d: 'Ich-Ansicht oder von hinten. Mausrad: Abstand', an: () => PM.view === 'third' ? 'von hinten' : 'Ich' },
    { k: ['G'], t: 'Tanzen', d: 'Charleston, langsamer Tanz, aus' },
  ], { titel: 'Bewegung', vorne: true });
  addTasten('kraefte', [
    { k: ['LM'], t: 'Energieschub', d: 'Klick stößt weg, was vor Alexander ist (rechts, links, beide Hände). Halten lädt auf, loslassen entlädt einen gewaltigen Stoß' },
    { k: ['RM'], t: 'Telekinese', d: 'Gedrückt halten: schwebt, worauf du schaust (Dinge, Möbel, Wagen, Leute, Laternen, Bäume). Loslassen lässt fallen', an: () => onOff(POWERS.tk) },
    { k: ['T'], t: 'Telekinese umschalten', d: 'Wie die rechte Maustaste, aber bleibt an' },
    { k: ['RAD'], t: 'Näher und weiter', d: 'Gehaltenes heranziehen oder wegschieben' },
    { k: ['LM'], id: 'schleudern', t: 'Schleudern', d: 'Während der Telekinese: alles Gehaltene wegschleudern' },
    { k: ['X'], t: 'Schockwelle', d: 'Am Boden Faust aufs Pflaster, in der Luft Sturz mit Aufschlag. Dinge und Wagen fliegen davon, Leute fallen um' },
    { k: ['H'], t: 'Schutzschild', d: 'Alles, was heranfliegt oder heranfährt, prallt ab', an: () => onOff(KRAEFTE.shield) },
    { k: ['L'], t: 'Levitation', d: 'Alles ringsum schwebt und kreist um Alexander. L lässt fallen, X schleudert alles nach außen', an: () => onOff(KRAEFTE.levOn) },
    { k: ['Z'], t: 'Zeitlupe', d: 'Die Stadt wird langsam, Alexander bewegt sich frei', an: () => onOff(KRAEFTE.slow) },
  ], { titel: 'Kräfte', vorne: true });
  addTasten('stadt', [
    { k: ['E'], t: 'Benutzen', d: 'Fahrstühle, Türen, Leute ansprechen, Platz nehmen, in Wagen einsteigen und aussteigen' },
    { k: ['E'], id: 'tragen', t: 'Aufheben und ablegen', d: 'Dinge in die Hand nehmen' },
    { k: ['Klick'], t: 'Werfen', d: 'Was Alexander in der Hand trägt' },
    { k: ['R'], t: 'Drehen', d: 'Getragenes drehen. Im Wagen: wieder auf die Räder stellen' },
    { k: ['1', '–', '0'], t: 'Bestellen', d: 'Bei offener Karte im Café, Restaurant oder an der Bar. Esc schließt die Karte' },
    { k: ['U'], t: 'Zeitung lesen', d: 'Der Vespera-Kurier: deine Taten, gefasste Räuber, Stadtereignisse. A D oder Pfeile blättern, U oder Esc schließt' },
    { k: ['E'], id: 'gala', t: 'Gala im Belmont', d: 'Bei Direktor Hartmann im Ballsaal: der Gala-Abend zu deinen Ehren beginnt' },
    { k: ['J'], t: 'Ärger in der Nähe', d: 'Sofort das nächste Ereignis: Überfall, Taschendieb, Bombe, Anarchisten' },
  ], { titel: 'Stadt und Leute', vorne: true });
  addTasten('imperial', [
    { k: ['E'], t: 'An Bord gehen', d: 'An der Rufsäule auf der Belmont-Terrasse oder der untersten Villa-Terrasse' },
    { k: ['E'], id: 'kapitaen', t: 'Kapitän auf der Brücke', d: 'Kurs Belmont, Kurs Villa, kreuzen, Position halten oder selbst ans Steuer' },
    { k: ['W', 'S'], t: 'Fahrt', d: 'Am Steuer: vorwärts und zurück' },
    { k: ['A', 'D'], t: 'Ruder', d: 'Am Steuer: nach Backbord und Steuerbord' },
    { k: ['Leertaste', '/', 'C'], t: 'Höhe', d: 'Am Steuer: steigen und sinken' },
    { k: ['Shift'], t: 'Volle Kraft', d: 'Am Steuer' },
    { k: ['V'], id: 'aussen', t: 'Außenansicht', d: 'Am Steuer: das ganze Schiff von außen' },
    { k: ['E'], id: 'platz', t: 'Platz nehmen', d: 'Im Salon, Speisesalon und auf dem Achterdeck; der Steward bringt die Bestellung' },
  ], { titel: 'Aurora Imperial', vorne: true });
  addTasten('reisen', views(), { titel: 'Aussichtspunkte' });
  addTasten('einstellungen', [
    { k: ['M'], t: 'Ton', d: 'Musik, Stadt, Wetter, Schritte (bleibt gespeichert)', an: () => onOff(SND.on), act: () => { toggleSound(); } },
    { k: ['O'], t: 'Stimmen', d: 'Randolf, Personal und Leute sprechen hörbar (in Edge am natürlichsten)', an: () => VOICE.ok ? onOff(VOICE.on) : 'fehlt', act: () => { toggleVoices(); } },
    { k: ['N'], t: 'Wetter', d: 'Klar, Polarlicht, Dunst, Nebel, Regen, Schnee, Eisnebel, automatisch', an: () => ATMO.w ? (ATMO.pinned ? ATMO.w.name : 'automatisch') : '', act: () => { cycleWeather(); } },
    { k: ['B'], t: 'Leuchteffekt', d: 'Abschalten spart Leistung', an: () => onOff(shared.bloomOn), act: () => { shared.bloomOn = !shared.bloomOn && !!composer; toast(shared.bloomOn ? 'Leuchteffekt an' : 'Leuchteffekt aus'); } },
    { k: ['K'], t: 'Qualität', d: 'Hoch oder niedrig (für schwächere Grafikkarten; lädt neu)', an: () => QUALITY === 'hoch' ? 'hoch' : 'niedrig', act: () => { toggleQuality(); } },
    { k: ['P'], t: 'Leistungsanzeige', d: 'Bilder pro Sekunde, Zeichenaufrufe, Dreiecke' },
    { k: ['Tab', '/', 'F1'], t: 'Tasten und Kräfte', d: 'Diese Übersicht' },
    { k: ['Esc'], t: 'Pause', d: 'Noch einmal: weiterspielen' },
  ], { titel: 'Einstellungen', vorne: true });
}

// Alte Liste in index.html: was hier noch fehlt (Zeile eines anderen Updates), unter „Weiteres“ zeigen
const BEKANNT = new Set(['W A S D', 'Maus', 'Shift', 'Leertaste', 'F', 'C', 'linke Maus', 'rechte Maus', 'X', 'H', 'L', 'Z', 'V', 'G', 'N', 'K', 'P',
  '1 – 8', 'E', 'Aurora Imperial', 'Klick', 'M', 'O', 'B', 'Esc', 'T', 'J', 'R', 'U', 'Tab', 'F1']);
function ausHtml() {
  const list = document.querySelector('#overlay .keys'); if (!list) return;
  const neu = [];
  for (const row of list.children) {
    const kb = row.querySelector('kbd'), sp = row.querySelector('span'); if (!kb || !sp) continue;
    const k = kb.textContent.trim(); if (BEKANNT.has(k) || known(k)) continue;
    const txt = sp.textContent.trim(), m = txt.match(/^([^:.]{2,40})[:.]\s*(.+)$/);
    neu.push({ id: 'html:' + k, k: [k], t: m ? m[1] : txt, d: m ? m[2] : '' });
  }
  if (neu.length) addTasten('weiteres', neu, { titel: 'Weiteres' });
}
function known(k) { for (const g of TASTEN.gruppen) for (const e of g.e) if (e.k.join(' ') === k) return true; return false; }

/* ---------- Darstellung ---------- */
const MOUSE = { LM: 'l', RM: 'r', RAD: 'w' };
function keycap(k) {
  if (k === '/' || k === '–' || k === '+') return `<i class="tsep">${k === '/' ? 'oder' : k === '–' ? 'bis' : '+'}</i>`;
  if (MOUSE[k]) {
    const s = MOUSE[k], g = '#f6dc9a';
    return `<span class="tcap tmouse" title="${s === 'l' ? 'linke Maustaste' : s === 'r' ? 'rechte Maustaste' : 'Mausrad'}"><svg viewBox="0 0 20 28" aria-hidden="true">`
      + `<rect x="1.5" y="1.5" width="17" height="25" rx="8.5" fill="none" stroke="${g}" stroke-width="1.2"/><path d="M10 1.5V11M1.5 11h17" stroke="${g}" stroke-width="1"/>`
      + (s === 'l' ? `<path d="M2.2 10.4V9.5A8 8 0 0 1 9.4 2.3V10.4z" fill="${g}"/>` : s === 'r' ? `<path d="M17.8 10.4V9.5A8 8 0 0 0 10.6 2.3V10.4z" fill="${g}"/>` : `<rect x="8.6" y="4" width="2.8" height="5.4" rx="1.4" fill="${g}"/>`)
      + `</svg><span class="sr">${s === 'l' ? 'linke Maus' : s === 'r' ? 'rechte Maus' : 'Mausrad'}</span></span>`;
  }
  return `<kbd class="tcap${k.length > 2 ? ' wide' : ''}">${esc(k)}</kbd>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function zustand(e) { try { const v = e.an(); return v === true ? 'an' : v === false ? 'aus' : v == null ? '' : String(v); } catch { return ''; } }

const CSS = `
#tasten { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center;
  padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  background: radial-gradient(ellipse at 50% 30%, rgba(8,40,48,0.55), rgba(3,10,16,0.9) 70%); }
#tasten .tpanel { position: relative; width: min(980px, 100%); max-height: 100%; display: grid; grid-template-rows: auto auto 1fr auto; min-height: 0;
  background: linear-gradient(180deg, rgba(6,22,30,0.96), rgba(4,14,20,0.96)); border: 1px solid rgba(217,178,106,0.7);
  outline: 1px solid rgba(217,178,106,0.25); outline-offset: 6px; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
#tasten .tpanel::before, #tasten .tpanel::after { content: ''; position: absolute; width: 38px; height: 38px; pointer-events: none;
  border: 1px solid rgba(246,220,154,0.75); }
#tasten .tpanel::before { left: 8px; top: 8px; border-right: 0; border-bottom: 0; box-shadow: inset 5px 5px 0 -4px rgba(246,220,154,0.5); }
#tasten .tpanel::after { right: 8px; bottom: 8px; border-left: 0; border-top: 0; box-shadow: inset -5px -5px 0 -4px rgba(246,220,154,0.5); }
#tasten header { display: grid; justify-items: center; gap: 6px; padding: 22px 56px 12px; text-align: center; }
#tasten header svg { width: 120px; height: 38px; }
#tasten h2 { margin: 0; font-family: var(--display); font-weight: 400; font-size: clamp(26px, 4.4vw, 40px); letter-spacing: 0.16em; padding-left: 0.16em;
  background: linear-gradient(180deg, var(--gold-hi) 15%, var(--gold) 60%, #8a6428); -webkit-background-clip: text; background-clip: text; color: transparent; }
#tasten header p { margin: 0; font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
#tasten nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; padding: 4px 20px 14px; border-bottom: 1px solid rgba(217,178,106,0.3); }
#tasten nav button { font: 600 12px/1 var(--body); letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); background: none; cursor: pointer;
  border: 1px solid rgba(217,178,106,0.25); padding: 9px 14px 7px; clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 7px 100%, 0 50%); }
#tasten nav button:hover { color: var(--ink); background: rgba(217,178,106,0.1); }
#tasten nav button[aria-selected="true"] { color: #1a1206; background: linear-gradient(180deg, var(--gold-hi), var(--gold)); border-color: transparent; }
#tasten nav button:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
#tasten .tlist { overflow-y: auto; min-height: 0; padding: 16px 24px 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 18px; align-content: start; }
#tasten .trow { display: grid; grid-template-columns: 104px minmax(0, 1fr) auto; gap: 14px; align-items: center; min-width: 0; text-align: left;
  padding: 10px 12px 9px; border: 1px solid rgba(217,178,106,0.16); background: rgba(217,178,106,0.035); color: var(--ink); font: inherit; }
#tasten button.trow { cursor: pointer; }
#tasten button.trow:hover, #tasten button.trow:focus-visible { background: rgba(111,214,207,0.09); border-color: rgba(111,214,207,0.5); outline: none; }
#tasten .tkeys { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; justify-content: center; }
#tasten .tcap { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 7px; box-sizing: border-box;
  font: 600 13px/1 var(--body); letter-spacing: 0.06em; color: var(--gold-hi); white-space: nowrap;
  border: 1px solid rgba(217,178,106,0.65); border-bottom-width: 3px; background: linear-gradient(180deg, rgba(246,220,154,0.12), rgba(246,220,154,0.02)); padding-top: 2px; }
#tasten .tcap.wide { font-size: 11px; letter-spacing: 0.1em; }
#tasten .tmouse { padding: 0 4px; } #tasten .tmouse svg { width: 16px; height: 22px; display: block; }
#tasten .tsep { font-style: normal; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
#tasten .ttext { display: grid; gap: 3px; min-width: 0; }
#tasten .ttext b { font-family: var(--display); font-weight: 400; font-size: 17px; letter-spacing: 0.06em; color: var(--gold-hi); }
#tasten .ttext span { font-size: 13px; line-height: 1.4; color: var(--muted); font-weight: 300; }
#tasten .tstate { font: 600 10px/1 var(--body); letter-spacing: 0.2em; text-transform: uppercase; padding: 5px 8px 4px; border: 1px solid rgba(217,178,106,0.35); color: var(--muted); white-space: nowrap; }
#tasten .tstate.on { color: #04121a; background: var(--teal); border-color: var(--teal); }
#tasten footer { display: flex; flex-wrap: wrap; gap: 10px 18px; justify-content: center; align-items: center; padding: 14px 20px 18px; border-top: 1px solid rgba(217,178,106,0.3); }
#tasten footer small { font-size: 12px; letter-spacing: 0.08em; color: var(--muted); }
#tasten .sr, #pauseKeys .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
#overlay.tasten-neu .keys { display: none; }
.pausebar { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
@media (max-width: 760px) { #tasten .tlist { grid-template-columns: 1fr; padding: 12px 14px; } #tasten header { padding: 18px 44px 8px; } }
@media (max-width: 420px) { #tasten .trow { grid-template-columns: 1fr auto; } #tasten .tkeys { grid-column: 1 / -1; justify-content: flex-start; } #tasten nav button { padding: 8px 10px 6px; letter-spacing: 0.12em; } }
`;
const FAN = `<svg viewBox="0 0 120 38" aria-hidden="true"><g fill="none" stroke="#d9b26a" stroke-width="1"><path d="M24 36 A36 36 0 0 1 96 36"/><path d="M38 36 A22 22 0 0 1 82 36"/>
<path d="M60 36V2M60 36L36 10M60 36L84 10M60 36L26 24M60 36L94 24"/><path d="M2 36H22M98 36H118M8 31H20M100 31H112"/></g><circle cx="60" cy="36" r="3.5" fill="#f6dc9a"/></svg>`;

function stil() { if (TASTEN.css) return; TASTEN.css = true; const st = document.createElement('style'); st.textContent = CSS; document.head.append(st); }
function bauen() {
  if (TASTEN.el) return TASTEN.el;
  stil();
  const el = document.createElement('div');
  el.id = 'tasten'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'tastenTitel');
  el.innerHTML = `<div class="tpanel"><header>${FAN}<h2 id="tastenTitel">Tasten &amp; Kräfte</h2><p>Was Alexander alles kann</p></header>
    <nav role="tablist" aria-label="Gruppen"></nav><div class="tlist" role="tabpanel"></div>
    <footer><button class="btn" type="button" data-weiter>Weiterspielen</button><button class="qual" type="button" data-zurueck>Zurück</button>
    <small><kbd>←</kbd> <kbd>→</kbd> Gruppe · <kbd>Esc</kbd> zurück</small></footer></div>`;
  document.body.append(el);
  el.querySelector('[data-weiter]').addEventListener('click', () => { closeTasten(); if (playing) resume(); else if (!$('enter').disabled) $('enter').click(); });
  el.querySelector('[data-zurueck]').addEventListener('click', () => closeTasten());
  el.addEventListener('click', ev => { if (ev.target === el) closeTasten(); });
  TASTEN.el = el;
  return el;
}

export function renderTasten() {
  const el = bauen(), nav = el.querySelector('nav'), list = el.querySelector('.tlist');
  const gs = TASTEN.gruppen.filter(g => g.e.length);
  TASTEN.tab = Math.max(0, Math.min(gs.length - 1, TASTEN.tab));
  nav.innerHTML = '';
  gs.forEach((g, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = g.titel;
    b.setAttribute('aria-selected', i === TASTEN.tab ? 'true' : 'false');
    b.addEventListener('click', () => { TASTEN.tab = i; renderTasten(); });
    nav.append(b);
  });
  list.innerHTML = '';
  const g = gs[TASTEN.tab]; if (!g) return;
  for (const e of g.e) {
    const row = document.createElement(e.act ? 'button' : 'div'); row.className = 'trow'; if (e.act) row.type = 'button';
    const z = e.an ? zustand(e) : '';
    row.innerHTML = `<span class="tkeys">${e.k.map(keycap).join('')}</span><span class="ttext"><b>${esc(e.t)}</b>${e.d ? `<span>${esc(e.d)}</span>` : ''}</span>`
      + (z ? `<span class="tstate${z === 'an' ? ' on' : ''}">${esc(z)}</span>` : '<span></span>');
    if (e.act) row.addEventListener('click', () => {
      let weiter; try { weiter = e.act(); } catch (err) { console.warn('Tasten', err); }
      if (weiter === true) { closeTasten(); if (playing) resume(); } else if (TASTEN.offen) setTimeout(renderTasten, 60);
    });
    list.append(row);
  }
}

export function openTasten(gid) {
  bauen();
  if (gid) { const i = TASTEN.gruppen.filter(g => g.e.length).findIndex(g => g.id === gid); if (i >= 0) TASTEN.tab = i; }
  TASTEN.offen = true; TASTEN.el.hidden = false; renderTasten();
  const w = TASTEN.el.querySelector('[data-weiter]'); w.textContent = playing ? 'Weiterspielen' : 'Stadt betreten'; w.disabled = !playing && $('enter').disabled;
  const b = TASTEN.el.querySelector('nav [aria-selected="true"]'); if (b) b.focus({ preventScroll: true });
}
export function closeTasten() {
  if (!TASTEN.el) return;
  TASTEN.offen = false; TASTEN.el.hidden = true;
  const b = $('tastenBtn'); if (b && !$('overlay').hidden) b.focus({ preventScroll: true });
}

/* ---------- Pausenbild: Knopf „Tasten & Kräfte“, Ton/Stimmen schnell umschalten ---------- */
function pauseLeiste() {
  const ov = $('overlay'); if (!ov) return;
  stil(); ov.classList.add('tasten-neu');
  const qual = $('qual'), bar = document.createElement('div'); bar.className = 'pausebar'; bar.id = 'pauseKeys';
  const mk = (id, txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'qual'; b.id = id; b.textContent = txt; b.addEventListener('click', fn); bar.append(b); return b; };
  mk('tastenBtn', 'Tasten & Kräfte', () => openTasten());
  const ton = mk('pauseTon', '', () => { toggleSound(); setTimeout(lies, 50); });
  const stimme = mk('pauseStimmen', '', () => { toggleVoices(); setTimeout(lies, 50); });
  function lies() { ton.textContent = 'Ton: ' + (SND.on ? 'an' : 'aus'); stimme.textContent = 'Stimmen: ' + (VOICE.ok ? (VOICE.on ? 'an' : 'aus') : 'fehlt'); }
  lies();
  if (qual) { qual.after(bar); bar.prepend(qual); } else ov.querySelector('.card')?.append(bar);
  new MutationObserver(() => { if (!ov.hidden) lies(); else closeTasten(); }).observe(ov, { attributes: true, attributeFilter: ['hidden'] });
  // Hinweiszeile unten links: Tab für die Übersicht
  const hint = $('hint'); if (hint && !hint.textContent.includes('Tab')) hint.insertAdjacentHTML('beforeend', ' · <kbd>Tab</kbd> Tasten &amp; Kräfte');
}

/* ---------- Tasten: Tab / F1 öffnet, Esc und Pfeile in der Übersicht (vor input.js, deshalb capture) ---------- */
function onKey(e) {
  if (TASTEN.offen) {
    if (e.code === 'Escape' || e.code === 'Tab' && !e.shiftKey && document.activeElement === document.body || e.code === 'F1') { e.preventDefault(); e.stopImmediatePropagation(); closeTasten(); return; }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      const n = TASTEN.gruppen.filter(g => g.e.length).length;
      TASTEN.tab = (TASTEN.tab + (e.code === 'ArrowRight' ? 1 : n - 1)) % n; renderTasten();
      TASTEN.el.querySelector('nav [aria-selected="true"]')?.focus({ preventScroll: true });
      e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    e.stopImmediatePropagation();   // keine Spieltasten, solange die Übersicht offen ist
    return;
  }
  if (!playing || paused || e.repeat) return;
  if (e.code === 'Tab' || e.code === 'F1') {
    e.preventDefault(); e.stopImmediatePropagation();
    if (locked && document.exitPointerLock) document.exitPointerLock();   // pointerlockchange pausiert
    if (!paused) pause();
    openTasten();
  }
}

export function setupPausemenu() {
  if (typeof document === 'undefined' || TASTEN.ready) return;
  TASTEN.ready = true;
  basis(); ausHtml(); pauseLeiste();
  window.addEventListener('keydown', onKey, true);
  if (isTouch) addTasten('einstellungen', [{ id: 'touch', k: ['Knöpfe'], t: 'Auf dem Handy', d: 'Links wischen: gehen. Rechts wischen: umsehen. Knöpfe rechts: Fliegen, Kraft, Ansicht, Wetter, Stoß' }]);
}
// erst wenn alle Module ausgewertet sind (Aussichtspunkte, Zustände, Einträge anderer Updates)
if (typeof window !== 'undefined') setTimeout(setupPausemenu, 0);
