/* =====================================================================
   V59 · STIMMEN: Randolf, das Personal und die Leute der Stadt sprechen
   ihre Sätze hörbar.
   Womit: mit der Sprachausgabe des Browsers (Web Speech API,
   window.speechSynthesis). Sie kostet keinen einzigen Download, braucht keine
   Lizenz und läuft offline mit den Stimmen, die Windows mitbringt
   (Chrome unter Windows: Microsoft Hedda, Katja, Stefan, dazu „Google
   Deutsch“; Edge hat sehr natürliche Online-Stimmen wie Conrad, Katja,
   Amala, Killian). Vorgefertigte Sprachaufnahmen hätten pro Satz Daten
   gekostet (bei mehreren hundert Sätzen einige Megabyte) und Sätze mit
   Namen ({bar}) gar nicht abdecken können.
   Wie: Alle Sprechblasen (#say) und Zitat-Hinweise („Randolf: „…““ im
   #toast) werden beobachtet (MutationObserver). Damit spricht jeder Satz,
   auch künftige aus anderen Dateien, ohne dass dort etwas geändert werden
   muss. Wer spricht, bestimmt die Stimme: Männer- oder Frauenstimme nach
   Vorname oder Bezeichnung („Eine Dame“, „Ein Arbeiter“), jede benannte
   Person behält ihre Stimme (Tonhöhe und Tempo aus dem Namen), Randolf
   spricht tief und gemessen, Kinder hoch, Ängstliche schnell, Rufe lauter.
   O schaltet die Stimmen an und aus (gespeichert); M (ganzer Ton) und die
   Pause schalten sie mit stumm.
   ===================================================================== */
import { $ } from './core.js';
import { SND, SND_VOL } from './audio.js';
import { paused } from './input.js';
import { FIRST_F, FIRST_M } from './ragdoll.js';
import { toast } from './boat.js';

const VOICE_KEY = 'vespera-stimmen';
export const VOICE = { ok: typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined',
  on: true, all: [], male: [], female: [], hint: null, said: 0, last: '', lastT: 0, cur: null, speaking: false, endT: 0 };
try { VOICE.on = localStorage.getItem(VOICE_KEY) !== 'aus'; } catch (e) { /* privat */ }

/* ---------- Stimmen des Systems ---------- */
const MALE_RE = /stefan|conrad|killian|florian|ralf|jonas|hans|markus|klaus|kasper|bernd|christoph|georg|male\b|männlich|\bmann\b/i;
const FEMALE_RE = /hedda|katja|amala|louisa|seraphina|elke|gisela|klarissa|maja|tanja|vicki|anna|petra|marlene|helena|yvonne|ingrid|ka?tharina|female|weiblich|google deutsch/i;
function loadVoices() {
  if (!VOICE.ok) return;
  const vs = window.speechSynthesis.getVoices().filter(v => /^de([-_]|$)/i.test(v.lang));
  // natürliche (neuronale) Stimmen zuerst, dann die lokalen, Deutschland vor Österreich und Schweiz
  const score = v => (/natural|neural|online/i.test(v.name) ? 4 : 0) + (v.localService ? 1 : 0) + (/de[-_]DE/i.test(v.lang) ? 2 : 0);
  vs.sort((a, b) => score(b) - score(a));
  VOICE.all = vs;
  VOICE.male = vs.filter(v => MALE_RE.test(v.name) && !FEMALE_RE.test(v.name));
  VOICE.female = vs.filter(v => FEMALE_RE.test(v.name) && !MALE_RE.test(v.name));
}
if (VOICE.ok) { loadVoices(); try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { window.speechSynthesis.onvoiceschanged = loadVoices; } }

/* ---------- Wer spricht wie ---------- */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
// feste Figuren: [weiblich, Tonhöhe, Tempo, Lautstärke]
const CAST = {
  Randolf: [false, 0.78, 0.88, 0.95], Konrad: [false, 0.9, 0.94, 0.9], 'Der Pianist': [false, 1.0, 0.96, 0.85],
  'Der Kapitän': [false, 0.72, 0.9, 1], 'Der Steward': [false, 1.02, 1.0, 0.85], 'Der Conférencier': [false, 1.08, 1.08, 1],
  'Der Kellner': [false, 1.0, 1.02, 0.85], 'Der Barkeeper': [false, 0.84, 0.98, 0.9], 'Der Wirt': [false, 0.8, 0.98, 0.95],
  'Die Wirtin': [true, 1.0, 1.02, 0.95], 'Die Sängerin': [true, 1.1, 1.0, 0.9], 'Der Portier': [false, 0.9, 0.96, 0.9],
  // V63: Nebenfiguren
  'Josephine Lafleur': [true, 1.12, 0.96, 0.95], 'Polizeipräsident Brenner': [false, 0.74, 0.92, 1], 'Viktor von Hallstein': [false, 0.86, 0.9, 0.95],
  'Margot Wendt': [true, 1.04, 1.1, 1], 'Hannes Kröger': [false, 0.7, 0.98, 1], 'Kapitän Ahrens': [false, 0.72, 0.9, 1],
  'Ein Zeitungsjunge': [false, 1.55, 1.12, 1], 'Der Leierkastenmann': [false, 0.82, 0.95, 0.95], 'Der Bankdirektor': [false, 0.86, 0.92, 0.9],
};
const FEM_WORD = /\b(eine|die)\b|dame|frau|fräulein|mädchen|zimmermädchen|wirtin|sängerin|tänzerin|köchin|mama|großmutter|witwe|gattin|serviererin|verkäuferin/i;
const KID_WORD = /junge|mädchen\b|kind|bub|knirps|zeitungsjunge|schuhputzer/i;
const firstNames = { f: null, m: null };
function femaleOf(who) {
  if (!firstNames.f) { firstNames.f = new Set(FIRST_F); firstNames.m = new Set(FIRST_M); }
  const first = who.split(' ')[0];
  if (firstNames.f.has(first)) return true;
  if (firstNames.m.has(first)) return false;
  if (/zimmermädchen/i.test(who)) return true;
  return FEM_WORD.test(who) && !/^(der|ein)\b/i.test(who);
}
const generic = who => /^(ein|eine|der|die|jemand)\b/i.test(who) && !CAST[who];
function profile(who, text, hint) {
  const c = CAST[who], seed = hint && hint.seed != null ? hint.seed : generic(who) ? (Math.random() * 1e9) >>> 0 : hash(who);
  const fem = hint && hint.fem != null ? hint.fem : c ? c[0] : femaleOf(who), kid = hint && hint.kid || KID_WORD.test(who) && !c;
  let pitch = c ? c[1] : (fem ? 1.06 : 0.9) + ((seed % 17) / 16 - 0.5) * 0.24, rate = c ? c[2] : 1 + (((seed >> 5) % 13) / 12 - 0.5) * 0.14, vol = c ? c[3] : 0.85;
  if (kid) { pitch = 1.28 + ((seed % 7) / 6) * 0.14; rate = 1.1; }
  if (/arbeiter|matrose|schlepper|fischer|kranführer|heizer|docker/i.test(who)) { pitch -= 0.07; rate += 0.03; }
  // Stimmung aus dem Satz: Stottern = Angst, Ausruf = lauter und schneller, viele Pausen = gedehnt
  const mood = hint && hint.mood;
  if (mood === 'furcht' || /^[A-ZÄÖÜ]…|\b[A-Za-zÄÖÜäöü]… [a-zäöü]/.test(text)) { rate += 0.12; pitch += 0.06; vol *= 0.85; }
  else if (mood === 'skep' || mood === 'neid') { rate -= 0.05; pitch -= 0.04; }
  if (/!\s*$/.test(text) || /Extrablatt|Hilfe|Achtung/.test(text)) { vol = Math.min(1, vol + 0.15); rate += 0.05; }
  else if ((text.match(/…/g) || []).length >= 2) rate -= 0.06;
  return { fem: kid ? true : fem, kid, seed, pitch, rate, vol };
}
function voiceFor(P) {
  const want = P.fem ? VOICE.female : VOICE.male, other = P.fem ? VOICE.male : VOICE.female;
  if (want.length) return { v: want[P.seed % want.length], shift: 1 };
  // keine passende Stimme installiert: die andere tiefer oder höher sprechen lassen
  const pool = VOICE.all.filter(v => !other.includes(v));
  if (pool.length) return { v: pool[P.seed % pool.length], shift: 1 };
  if (other.length) return { v: other[P.seed % other.length], shift: P.fem ? 1.3 : 0.7 };
  return { v: null, shift: 1 };
}

/* ---------- Text für die Aussprache ---------- */
const SPOKEN = [
  [/\b[A-Za-zÄÖÜäöü]… (?=[A-Za-zÄÖÜäöü])/g, ''],
  [/[„“"]/g, ''], [/…/g, ', '], [/ ,/g, ','], [/,\s*([.!?])/g, '$1'], [/^\s*,\s*/, ''],
  [/\bSir\b/g, 'Sör'], [/1911er/g, 'neunzehnhundertelfer'], [/’n /g, 'n '], [/’s\b/g, 's'], [/’/g, ''],
  [/\bV(\d+)\b/g, 'Version $1'], [/·/g, ','], [/\s{2,}/g, ' '],
];
export function spokenText(s) { let t = s; for (const [a, b] of SPOKEN) t = t.replace(a, b); return t.trim(); }

/* ---------- Sprechen ---------- */
export function voiceReady() { return VOICE.ok && VOICE.on && SND.on !== false && (!paused || VOICE.force); }
// hint: { seed, fem, kid, mood, vol } für den nächsten Satz dieser Person (aus stimmen.js)
export function voiceHint(who, h) { VOICE.hint = { who, t: performance.now(), ...h }; }
export function speak(who, text, hint) {
  if (!voiceReady() || !text) return false;
  const now = performance.now();
  if (text === VOICE.last && now - VOICE.lastT < 1500) return false;   // dieselbe Blase zweimal gemeldet
  VOICE.last = text; VOICE.lastT = now;
  if (!hint && VOICE.hint && VOICE.hint.who === who && now - VOICE.hint.t < 400) hint = VOICE.hint;
  VOICE.hint = null;
  const P = profile(who, text, hint), V = voiceFor(P), u = new window.SpeechSynthesisUtterance(spokenText(text));
  u.lang = V.v ? V.v.lang : 'de-DE'; if (V.v) u.voice = V.v;
  u.pitch = Math.max(0.1, Math.min(2, P.pitch * V.shift)); u.rate = Math.max(0.6, Math.min(1.5, P.rate));
  u.volume = Math.max(SND_VOL.voice > 0 ? 0.02 : 0, Math.min(1, P.vol * (hint && hint.vol != null ? hint.vol : 1) * (SND_VOL.voice * SND_VOL.all * 1.1)));   // V73: Regler Stimmen
  u.onend = u.onerror = () => { if (VOICE.cur === u) { VOICE.cur = null; VOICE.speaking = false; } };
  // ein neuer Satz löst den alten ab (die Blase zeigt auch nur den neuesten)
  const go = () => { if (!voiceReady()) return; VOICE.cur = u; VOICE.speaking = true; try { window.speechSynthesis.speak(u); VOICE.said++; } catch (e) { /* ohne Stimme weiter */ } };
  if (window.speechSynthesis.speaking || window.speechSynthesis.pending) { window.speechSynthesis.cancel(); setTimeout(go, 40); } else go();
  VOICE.endT = now + estimate(text, u.rate) * 1000;
  return true;
}
// geschätzte Sprechdauer in Sekunden (für Wechselreden)
export function estimate(text, rate = 1) { return (spokenText(text).length / 14.5 + 0.45) / rate; }
export function hush() { if (VOICE.ok && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) window.speechSynthesis.cancel(); VOICE.cur = null; VOICE.speaking = false; }
export function toggleVoices() {
  VOICE.on = !VOICE.on;
  try { localStorage.setItem(VOICE_KEY, VOICE.on ? 'an' : 'aus'); } catch (e) { /* privat */ }
  if (!VOICE.on) hush();
  toast(!VOICE.ok ? 'Dieser Browser hat keine Sprachausgabe' : VOICE.on ? (VOICE.all.length ? 'Stimmen an' : 'Stimmen an (keine deutsche Stimme installiert)') : 'Stimmen aus');
}

/* ---------- Sprechblasen beobachten ---------- */
function readSay() {
  const el = $('say'); if (!el || el.style.opacity === '0') return;
  const b = el.querySelector('b'), s = el.querySelector('span'); if (!b || !s) return;
  const line = s.textContent.replace(/^„|“$/g, '');
  speak(b.textContent.trim(), line);
}
const TOAST_QUOTE = /^([A-ZÄÖÜ][\wÄÖÜäöüß. ]{1,30}):\s*„(.+)“\s*$/;
function readToast() {
  const el = $('toast'); if (!el) return;
  const m = TOAST_QUOTE.exec(el.textContent.trim()); if (m) speak(m[1], m[2]);
}
function watch() {
  if (!VOICE.ok || typeof MutationObserver === 'undefined') return;
  const say = $('say'), tst = $('toast');
  if (say) new MutationObserver(readSay).observe(say, { childList: true, subtree: true, characterData: true });
  if (tst) new MutationObserver(readToast).observe(tst, { childList: true, subtree: true, characterData: true });
  // Pause, Ton aus, Blase verschwunden: verstummen
  setInterval(() => { if (VOICE.speaking && !voiceReady()) hush(); }, 300);
  window.addEventListener('keydown', e => { if (e.code === 'KeyO' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && document.activeElement?.tagName !== 'INPUT') toggleVoices(); });
  window.addEventListener('pagehide', hush);
}
watch();
if (typeof window !== 'undefined') window.vesperaVoice = VOICE;
