/* =====================================================================
   V125 · NUR NOCH SPRECHBLASEN
   Wer spricht, spricht in einer Sprechblase über dem eigenen Kopf, nicht
   mehr im Kasten unten in der Mitte. Der alte Kasten (#say) bleibt als
   unsichtbare Quelle bestehen: alle Stellen im Spiel schreiben weiter
   hinein, die Stimmen (voice.js) lesen ihn weiter. Dieses Modul schaut
   dem Kasten zu (MutationObserver), sucht den Sprecher (Hinweis über
   sayAt() oder die nächste Person vor Alexander) und hängt die Blase an
   dessen Kopf. Steht niemand passend im Bild, schwebt die Blase oben in
   der Mitte. Gespräche mit Nebenfiguren: die Figur spricht in der Blase,
   Alexanders Antworten stehen als kleine Antwortblasen unten rechts
   (Zahlentasten bleiben), die gewählte Antwort erscheint kurz als Blase
   über Alexander. ?sprechblasen=aus = Kasten wie vorher.
   Kein Import außer core.js.
   ===================================================================== */
import { $, camera, T } from './core.js';

export const SB = { on: new URLSearchParams(location.search).get('sprechblasen') !== 'aus', near: null, me: null, hint: null, hold: false, el: null, cur: null, mine: null };
const V = new T.Vector3(), D = new T.Vector3();
const ME = /^(Alexander|Du)$/;

// Ein Schreiber kann vor dem Schreiben in #say sagen, wer spricht: eine Figur (pd mit .a.m), ein Punkt {x, y?, z} oder 'me'
export function sayAt(a) { if (SB.on && a) SB.hint = { a, t: performance.now() }; }
// solange ein Gespräch offen ist, bleibt die Blase der Figur stehen, auch wenn der Kasten-Zeitgeber abläuft
export function sbHold(on) { SB.hold = !!on; if (!on && SB.cur && !visible()) hide(SB.cur); }
// Alexanders gewählte Antwort kurz über seinem Kopf
export function sbMine(text, dur = 2.6) {
  if (!SB.on || !SB.el) return;
  const b = SB.mine || (SB.mine = make(true));
  fill(b, '', text); b.anchor = 'me'; b.until = performance.now() + dur * 1000; show(b);
}

function css() {
  const st = document.createElement('style');
  st.textContent = `
body.sb #say{opacity:0!important;pointer-events:none!important}
.sbB{position:fixed;z-index:12;left:0;top:0;max-width:min(300px,70vw);padding:7px 13px 8px;border-radius:14px;background:rgba(5,18,26,.86);border:1px solid rgba(217,178,106,.6);color:var(--ink,#efe6d2);font:400 14.5px/1.4 var(--body,Georgia,serif);text-align:center;pointer-events:none;opacity:0;transition:opacity .25s;transform:translate(-50%,calc(-100% - 12px));box-shadow:0 6px 18px rgba(0,0,0,.45)}
.sbB.on{opacity:1}
.sbB b{display:block;margin-bottom:2px;font:600 10.5px/1.2 var(--body,Georgia,serif);letter-spacing:.22em;text-transform:uppercase;color:var(--gold-hi,#f6dc9a)}
.sbB b:empty{display:none}
.sbB::after{content:'';position:absolute;left:50%;bottom:-8px;margin-left:-7px;border:7px solid transparent;border-bottom:0;border-top:8px solid rgba(217,178,106,.75)}
.sbB.free::after{display:none}
.sbB.me{background:rgba(14,30,36,.86);border-color:rgba(111,214,207,.6)}
.sbB.me::after{border-top-color:rgba(111,214,207,.75)}
body.sb #nfDlg{left:auto;right:calc(14px + env(safe-area-inset-right,0px));bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:none;width:min(420px,calc(100% - 28px));background:none;border:0;outline:0;box-shadow:none;overflow:visible}
body.sb #nfDlg::before,body.sb #nfDlg::after,body.sb #nfDlg .hd,body.sb #nfDlg .ln{display:none}
body.sb #nfDlg .op{padding:0;gap:7px;justify-items:end}
body.sb #nfDlg .op button{border-radius:14px 14px 4px 14px;background:rgba(14,30,36,.88);border-color:rgba(111,214,207,.5);box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:100%}
body.sb #nfDlg .op button:hover,body.sb #nfDlg .op button:focus-visible{background:rgba(20,48,54,.95);border-color:#7fe3d6}
body.sb #nfDlg .ft{border:0;padding:6px 4px 0;text-align:right;font-size:11px;text-shadow:0 1px 3px #000}
@media (max-width:640px){body.sb #nfDlg{right:10px;width:calc(100% - 20px)}.sbB{font-size:13.5px}}
`;
  document.head.append(st);
}
function make(me) { const e = document.createElement('div'); e.className = 'sbB' + (me ? ' me' : ''); e.innerHTML = '<b></b><span></span>'; document.body.append(e); return { e, anchor: null, x: 0, y: 0 }; }
function fill(b, who, s) { b.e.querySelector('b').textContent = who; b.e.querySelector('span').textContent = s; }
function show(b) { b.e.classList.add('on'); b.live = true; loop(); }
function hide(b) { if (b) { b.e.classList.remove('on'); b.live = false; } }
function visible() { const el = $('say'); const o = el && el.style.opacity; return !!o && o !== '0'; }

// Sprecher suchen: Hinweis (frisch), sonst „Alexander“, sonst die nächste Person bis 14 m vor der Kamera
function findSpeaker(who) {
  const h = SB.hint; SB.hint = null;
  if (h && performance.now() - h.t < 600) {
    const a = h.a;
    if (a === 'me' || a.a || a.anchor) return a;
    if (a.x !== undefined) { const p = nearestTo(a.x, a.z, 4); return p || { x: a.x, y: a.y, z: a.z }; }
  }
  if (ME.test(who)) return 'me';
  const me = SB.me && SB.me(); if (!me) return null;
  return nearestTo(me.x, me.z, 14, true);
}
function nearestTo(x, z, R, view) {
  const L = SB.near ? SB.near() : null; if (!L) return null;
  const cp = camera.position; if (view) camera.getWorldDirection(D);
  let best = null, bs = 1e9;
  for (const pd of L) {
    const a = pd.a; if (!a || !a.on || !a.m) continue;
    const e = a.m.elements, d = Math.hypot(e[12] - x, e[14] - z); if (d > R) continue;
    let s = d;
    if (view) { const fx = e[12] - cp.x, fz = e[14] - cp.z, f = fx * D.x + fz * D.z; if (f < 0) s += 20; }   // hinter der Kamera: nur zur Not
    if (s < bs) { bs = s; best = pd; }
  }
  return best;
}
function headOf(a) {
  if (a === 'me') { const m = SB.me && SB.me(); return m ? V.set(m.x, m.y + 2.0, m.z) : null; }
  if (a.a && a.a.m) { const e = a.a.m.elements; return V.set(e[12], e[13] + 2.05 * (a.sc || 1), e[14]); }
  if (a.x !== undefined) return V.set(a.x, (a.y ?? 0) + 2.1, a.z);
  return null;
}
function place(b) {
  const W = innerWidth, H = innerHeight;
  let free = true, x = W / 2, y = H * 0.2;
  const p = b.anchor ? headOf(b.anchor) : null;
  if (p) {
    const d = p.distanceTo(camera.position);
    if (d > 2.2 && d < 70) { p.project(camera); if (p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05) { free = false; x = (p.x + 1) / 2 * W; y = (1 - p.y) / 2 * H; } }
    else if (b.anchor === 'me' && d <= 2.2) y = H * 0.7;   // Ich-Ansicht: Alexanders Blase unten
  }
  x = Math.max(W * 0.12, Math.min(W * 0.88, x)); y = Math.max(free ? 0 : 90, Math.min(H * 0.85, y));
  if (free) y += b.e.offsetHeight + 12;
  b.e.classList.toggle('free', free);
  b.e.style.left = x.toFixed(0) + 'px'; b.e.style.top = y.toFixed(0) + 'px';
}
let raf = 0;
function loop() {
  if (raf) return;
  const f = () => {
    raf = 0; let any = false;
    for (const b of [SB.cur, SB.mine]) if (b && b.live) {
      if (b.until && performance.now() > b.until) { hide(b); b.until = 0; continue; }
      place(b); any = true;
    }
    if (any) raf = requestAnimationFrame(f);
  };
  raf = requestAnimationFrame(f);
}
let lastKey = '';
function onSay() {
  const el = $('say'); if (!el) return;
  if (!visible()) { lastKey = ''; if (!SB.hold) hide(SB.cur); return; }
  const who = (el.querySelector('b') || {}).textContent || '', s = (el.querySelector('span') || el).textContent || '';
  const key = who + '|' + s; if (!s || key === lastKey) return; lastKey = key;
  const b = SB.cur || (SB.cur = make(false));
  fill(b, who, s); b.anchor = findSpeaker(who); b.e.classList.toggle('me', b.anchor === 'me');
  show(b);
}
export function sbInit(near, me) {
  if (!SB.on || SB.el) return;
  const el = $('say'); if (!el) return;
  SB.el = el; SB.near = near; SB.me = me;
  css(); document.body.classList.add('sb');
  new MutationObserver(onSay).observe(el, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true, characterData: true });
}
