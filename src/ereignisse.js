/* =====================================================================
   V110 · REAKTION AUF EREIGNISSE
   Bisher reagierte jede Figur für sich. Jetzt reagiert die Menge auf das,
   was in der Stadt passiert, und aufeinander:
   - GAFFER: kracht es (Autounfall, driving.js CRASH) oder wird jemand
     umgerannt (ragdoll.js RAG.onDown), bleiben Leute in der Nähe stehen,
     kommen heran und bilden einen lockeren Ring: zeigen hin, schlagen die
     Hände vor den Mund, tuscheln („Haben Sie das gesehen?“). War Alexander
     daran schuld, sagen sie das auch.
   - POLIZEI: bei einem schweren Unfall oder mehreren Gestürzten kommt die
     nächste Streife (die Polizisten, die zu zweit durch die Straßen gehen)
     im Laufschritt, schickt die Gaffer weiter, schaut sich alles an und
     schreibt es auf. Bei Alexander bleibt sie höflich, aber sie schreibt.
   - KUNDGEBUNG: der Sprechchor springt vom Redner aus durch die Menge
     (strasse.js STR.later), statt dass alle zugleich rufen. Passanten
     bleiben am Rand stehen und reagieren nach ihrer Haltung: Faust und
     Beifall oder verschränkte Arme. Treffen ein Befürworter und ein
     Gegner aufeinander, streiten sie kurz.
   - GALA: Applaus und Anstoßen laufen als Welle durch den Ballsaal
     (gala.js GALA.wave), von Alexander aus nach hinten; ein paar Gäste
     klatschen nicht mit und tuscheln stattdessen mit dem Nachbarn.
   Alles nur, wenn etwas passiert (Ereignis), Kundgebung einmal je Sekunde.
   Keine Shader. ?ereignisse=aus = Stand V109.
   ===================================================================== */
import { MOBILE, shared } from './core.js';
import { peds, turnHead, setAct } from './serpentine.js';
import { player } from './player.js';
import { attOf, whoOf, mobility } from './awe.js';
import { RAG } from './ragdoll.js';
import { KT } from './kontor.js';
import { CRASH } from './driving.js';
import { STR } from './strasse.js';
import { GALA } from './gala.js';
import { lifeSay } from './life.js';
import { walk, stand, clear, pos, begin, goHome, freePd } from './reaktionen.js';
import { canHelp } from './ablaeufe.js';
import { playing, paused } from './input.js';

export const EREIGNISSE = typeof location === 'undefined' || new URLSearchParams(location.search).get('ereignisse') !== 'aus';
export const EV = { ready: false, list: [], gaff: [], cops: [], watch: [], q: [], clock: 0, tickT: 0.29, galaTok: 0, n: { ev: 0, gaff: 0, cop: 0, demo: 0, streit: 0, welle: 0 }, demoT: 4, streitT: 20 };
const pick = a => a[Math.floor(Math.random() * a.length)];
const near2 = (pd, x, z) => { const e = pd.a.m.elements; return (e[12] - x) ** 2 + (e[14] - z) ** 2; };
const isCop = pd => (pd.kind || (pd.a && pd.a.kind)) === 'police';
function say(who, s, dur = 3.4, force) { if (force) shared.sayTimer = Math.min(shared.sayTimer, 0.4); return lifeSay(who, s, dur); }
// später ausführen (Wellen durch die Menge)
const later = (dt, fn) => EV.q.push({ t: EV.clock + dt, fn });

/* ---------- 1 · Gaffer ---------- */
const GAFF_SAY = ['Haben Sie das gesehen?', 'Um Gottes willen …', 'Da ist was passiert!', 'Hat jemand einen Arzt gerufen?', 'Ich hab es genau gesehen, das ging so schnell!', 'Geht doch mal zur Seite, man sieht ja nichts!'];
const GAFF_HIM = ['Das war Alexander, ich schwöre es.', 'Dem gehört die halbe Stadt, da darf man wohl so fahren.', 'Typisch. Und morgen steht nichts davon im Kurier.', 'Der zahlt das aus der Westentasche.'];
const GAFF_CRASH = ['Die Blechkiste ist hin!', 'Das hat gekracht! Ist jemand verletzt?', 'Wer fährt denn so?'];
function gaffStep(pd, A, dt) {
  const E = A.ev;
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, A.v, dt)) { A.ph = 1; A.pt = 0; } if (A.t > 18) A.ph = 1; return true; }
  if (A.ph === 1) {
    A.pt += dt;
    if (A.pt > A.nextAct) { A.nextAct = A.pt + 2.5 + Math.random() * 4; A.act = pick(A.acts); }
    stand(pd, A, A.act, E.x, E.z, dt);
    if (A.pt > A.stay || E.gone) { A.ph = 2; A.homeV = E.gone ? 1.6 : 1.3; }
    return true;
  }
  return goHome(pd, A, dt);
}
function gather(E) {
  EV.gaff = EV.gaff.filter(pd => pd.aw && pd.aw.fn === gaffStep);
  const max = MOBILE ? 3 : 7, list = [];
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || isCop(pd)) continue;
    const d2 = near2(pd, E.x, E.z); if (d2 > 32 * 32 || d2 < 2.5 * 2.5 || Math.abs(pd.a.m.elements[13] - E.y) > 2.5 || !canHelp(pd)) continue;
    list.push([d2, pd]);
  }
  list.sort((a, b) => a[0] - b[0]);
  let n = 0;
  for (const [d2, pd] of list) {
    if (EV.gaff.length >= max) break;
    const att = attOf(pd);
    if (att === 'furcht' && E.byHim) continue;   // die Ängstlichen gehen lieber schnell weiter
    const [x, y, z] = pos(pd), d = Math.sqrt(d2), r = 4.2 + Math.random() * 2.6;
    // auf der eigenen Seite des Unfalls bleiben, leicht seitlich versetzt
    const ang = Math.atan2(x - E.x, z - E.z) + (Math.random() - 0.5) * 0.9;
    let tx = E.x + Math.sin(ang) * r, tz = E.z + Math.cos(ang) * r;
    if (d < r + 0.5 || !clear(x, z, tx, tz, y)) { tx = x; tz = z; }   // schon nah genug oder kein Weg: stehen bleiben und hinschauen
    const acts = E.kind === 'crash' ? [8.2, 16.3, 13.2, 1.3, 12.2] : [13.2, 8.2, 1.3, 16.3];
    const A = begin(pd, gaffStep, { ev: E, tx, tz, v: d > 14 ? 2.4 : 1.4, acts, act: acts[0], nextAct: 1 + Math.random() * 2, stay: 14 + Math.random() * 16 });
    if (!A) continue;
    EV.gaff.push(pd); E.gaff.push(pd); EV.n.gaff++; n++;
  }
  // einer sagt etwas, ein zweiter antwortet etwas später
  if (E.gaff.length) {
    const L = E.byHim && Math.random() < 0.7 ? GAFF_HIM : E.kind === 'crash' && Math.random() < 0.6 ? GAFF_CRASH : GAFF_SAY;
    later(2.5 + Math.random() * 1.5, () => { const g = E.gaff[0]; if (g && g.aw && g.aw.ev === E) say(whoOf(g), pick(L)); });
    if (E.gaff[1]) later(7 + Math.random() * 3, () => { const g = E.gaff[1]; if (g && g.aw && g.aw.ev === E) say(whoOf(g), pick(GAFF_SAY)); });
  }
  return n;
}

/* ---------- 2 · Polizei ---------- */
const COP_SAY = ['Weitergehen, Herrschaften! Hier gibt es nichts zu sehen!', 'Bitte Platz machen! Polizei!', 'Zurücktreten, bitte! Gehen Sie weiter!'];
const COP_HIM = ['Herr Alexander … ich muss das aufschreiben. Rein für die Akten, versteht sich.', 'Verzeihung, Herr Alexander. Der Bericht geht an den Polizeipräsidenten. Er wird ihn wohl … verstehen.', 'Sie waren das, Herr Alexander? Dann ist es sicher halb so schlimm.'];
const COP_DONE = ['So. Alles notiert.', 'Erledigt. Weiter geht es.', 'Das hätten wir.'];
function copStep(pd, A, dt) {
  const E = A.ev;
  if (A.ph === 0) {
    if (walk(pd, A, A.tx, A.tz, A.t < 30 ? 3.3 : 1.6, dt) || A.t > 45) {
      A.ph = 1; A.pt = 0;
      if (A.lead) {   // Gaffer wegschicken
        E.cop = true; for (const g of E.gaff) if (g.aw && g.aw.ev === E) g.aw.ph = Math.max(g.aw.ph, 1), g.aw.stay = Math.min(g.aw.stay, g.aw.pt + 1.5 + Math.random() * 2);
        say('Ein Polizist', pick(COP_SAY), 3.4, true);
      }
    }
    return true;
  }
  if (A.ph === 1) {   // weiterwinken, dann hinsehen und aufschreiben
    A.pt += dt; const p = player.p, toHim = E.byHim && A.lead && A.pt > 4.5 && A.pt < 9;
    stand(pd, A, A.pt < 3 ? 3.6 : A.pt % 6 < 3 ? 6.2 : 1.3, toHim ? p.x : E.x, toHim ? p.z : E.z, dt);
    if (toHim && !A.said && (p.x - A.cx) ** 2 + (p.z - A.cz) ** 2 < 40 * 40) { A.said = true; turnHead(pd.a, p.x, p.z); say('Ein Polizist', pick(COP_HIM), 4.2, true); }
    if (A.pt > 14) { A.ph = 2; E.gone = true; if (A.lead) say('Ein Polizist', pick(COP_DONE), 2.4); }
    return true;
  }
  return goHome(pd, A, dt);
}
function callCops(E) {
  EV.cops = EV.cops.filter(pd => pd.aw && pd.aw.fn === copStep);
  if (EV.cops.length) return 0;
  // die nächste Streife (zu zweit unterwegs) in Reichweite
  let best = null, bd = 140 * 140;
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || !isCop(pd) || !pd.patrol) continue;
    const d2 = near2(pd, E.x, E.z); if (d2 < bd && canHelp(pd)) { bd = d2; best = pd; }
  }
  if (!best) return 0;
  const team = [best];
  const mate = best.pair && best.pair[0]; if (mate && mate.a && mate.a.on && canHelp(mate)) team.push(mate);   // der Kollege der Streife (life.js)
  let n = 0;
  for (const pd of team) {
    const [x, , z] = pos(pd), d = Math.hypot(x - E.x, z - E.z) || 1, r = n ? 3.2 : 2.2;
    const A = begin(pd, copStep, { ev: E, lead: n === 0, tx: E.x + (x - E.x) / d * r + (n ? 1.2 : 0), tz: E.z + (z - E.z) / d * r });
    if (!A) continue;
    EV.cops.push(pd); EV.n.cop++; n++;
  }
  return n;
}

/* ---------- Ereignisse sammeln ---------- */
export function event(kind, x, y, z, sev, byHim) {
  if (!EV.ready) return null;
  const p = player.p;
  if ((x - p.x) ** 2 + (z - p.z) ** 2 > 110 * 110) return null;   // nur, wo Alexander es sieht
  EV.list = EV.list.filter(E => EV.clock - E.t < 40 && !E.gone);
  // ein Ereignis in der Nähe, das gerade läuft: nur schwerer machen
  let E = EV.list.find(E => (E.x - x) ** 2 + (E.z - z) ** 2 < 12 * 12);
  if (E) { E.sev += sev; E.byHim = E.byHim || byHim; }
  else { E = { kind, x, y, z, sev, byHim, t: EV.clock, gaff: [], cop: false, gone: false }; EV.list.push(E); EV.n.ev++; later(0.8 + Math.random() * 0.8, () => gather(E)); }
  if (E.sev >= 2 && !E.copCalled) { E.copCalled = true; later(3 + Math.random() * 3, () => { if (!E.gone) callCops(E); }); }
  return E;
}
function onDown(pd) {
  if (pd.gg) return;   // Kämpfe mit Gegnern haben eigene Abläufe
  const e = pd.a.m.elements, p = player.p, byHim = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < 14 * 14;
  event('sturz', e[12], e[13], e[14], 1, byHim);
}
function onCrash(B, px, pz, dv) {
  if (dv < 2.4 || (B.evT || 0) > EV.clock) return;
  B.evT = EV.clock + 4;
  const p = player.p, byHim = !!B.player || (B.x - p.x) ** 2 + (B.z - p.z) ** 2 < 16 * 16;
  event('crash', px, B.y || 0.2, pz, dv > 5 ? 2 : 1, byHim);
}

/* ---------- 3 · Kundgebung: der Funke springt über ---------- */
// strasse.js ruft das für jede Figur der Kundgebung beim Wechsel Rede/Chor: Welle vom Redner aus
function rallyLater(pd, act, delay) {
  const ph = STR.rally && STR.rally.phase;
  if (delay < 0.15) { setAct(pd, act); return; }
  later(delay * (0.8 + Math.random() * 0.4), () => { if (pd.a && !pd.aw && !pd.rag && STR.rally && STR.rally.phase === ph) setAct(pd, act); });
}
const PRO = ['Recht haben sie! Gerechter Lohn!', 'Bravo! Lasst euch nichts gefallen!', 'Gut so! Wird auch Zeit!'];
const CONTRA = ['Faules Pack. Die sollen arbeiten.', 'Jedes Jahr dasselbe Theater.', 'Und wer zahlt das am Ende? Wir.'];
const STREIT = [
  ['Die bauen diese Stadt, und er zahlt ihnen einen Hungerlohn!', 'Ohne ihn gäbe es hier gar keine Stadt, nur Eis!'],
  ['Acht Stunden sind doch nicht zu viel verlangt!', 'Dann sollen sie woanders arbeiten, wenn es ihnen nicht passt!'],
  ['Hören Sie doch mal zu, was der Mann da sagt!', 'Ich höre genug. Aufrührer, alle miteinander.'],
];
// pd.dmw = { pro, foe, argue (bis Uhrzeit), until, keep, yaw0, act0 }: wer am Rand der Kundgebung zuschaut
const dmAct = (W, chant, t) => W.foe && W.argue > EV.clock ? 15.3 : W.pro ? (chant ? (t % 3 < 1.5 ? 15.3 : 9.3) : 1.3) : 12.2;
function demoStep(pd, A, dt) {
  const W = pd.dmw;
  if (!W) return false;
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, 1.3, dt) || A.t > 15) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt;
    const f = W.foe && W.argue > EV.clock && W.foe.a ? W.foe.a.m.elements : null;
    stand(pd, A, dmAct(W, STR.chanting, A.pt), f ? f[12] : A.fx, f ? f[14] : A.fz, dt);
    if (EV.clock > W.until) A.ph = 2;
    return true;
  }
  if (!goHome(pd, A, dt)) { pd.dmw = null; return false; }
  return true;
}
// wer in einer Runde auf dem Platz steht, dreht sich nur zur Kundgebung (oder zum Streitpartner) um
function keepStep(pd, W, R) {
  if (pd.aw || pd.rag || !pd.a || !pd.a.on || EV.clock > W.until || !R || STR.level <= 0) {
    if (!pd.aw && pd.a) { pd.yaw = W.yaw0; setAct(pd, W.act0); }
    pd.dmw = null; return false;
  }
  const f = W.foe && W.argue > EV.clock && W.foe.a ? W.foe.a.m.elements : null, tx = f ? f[12] : R.x, tz = f ? f[14] : R.z;
  pd.yaw = Math.atan2(tx - pd.x, tz - pd.z);
  setAct(pd, dmAct(W, STR.chanting, EV.clock));
  return true;
}
function demoTick(dt) {
  const R = STR.rally;
  EV.watch = EV.watch.filter(pd => pd.dmw && (pd.dmw.keep ? keepStep(pd, pd.dmw, R) : pd.aw && pd.aw.fn === demoStep));
  if (!R || STR.level <= 0) return;
  const p = player.p; if ((R.cx - p.x) ** 2 + (R.cz - p.z) ** 2 > 90 * 90) return;
  if ((EV.demoT -= dt) > 0) return;
  EV.demoT = 2.5 + Math.random() * 2;
  if (EV.watch.length < (MOBILE ? 4 : 8)) for (const pd of peds) {
    // Passanten, die am Platz vorbeikommen, treten näher; wer dort in einer Runde steht, dreht sich um
    if (!pd.a || !pd.a.on || pd.demo || pd.dmw || isCop(pd) || (pd.dmT || 0) > EV.clock) continue;
    const d2 = near2(pd, R.cx, R.cz); if (d2 > 34 * 34 || d2 < 9 * 9) continue;
    const keep = !pd.aw && !pd.rag && !pd.gg && !pd.sit && mobility(pd) === 'keep' && pd.x !== undefined;
    if (!keep && !freePd(pd)) continue;
    pd.dmT = EV.clock + 120;
    if (Math.random() < 0.5) continue;
    const att = attOf(pd), pro = att === 'hass' || att === 'neid' || (att === 'skep' && Math.random() < 0.5) || (pd.a.kind === 'worker' && att !== 'bew' && att !== 'dienst');
    const W = { pro, foe: null, argue: 0, until: EV.clock + 12 + Math.random() * 14, keep };
    if (keep) { W.yaw0 = pd.yaw; W.act0 = pd.a.gait[1]; pd.dmw = W; keepStep(pd, W, R); }
    else {
      const [x, y, z] = pos(pd), d = Math.sqrt(d2), r = 12 + Math.random() * 4, tx = R.cx + (x - R.cx) / d * r, tz = R.cz + (z - R.cz) / d * r, go = clear(x, z, tx, tz, y);
      pd.dmw = W;
      if (!begin(pd, demoStep, { tx: go ? tx : x, tz: go ? tz : z, fx: R.x, fz: R.z })) { pd.dmw = null; continue; }
    }
    EV.watch.push(pd); EV.n.demo++;
    later(2 + Math.random() * 2, () => { if (pd.dmw === W && (pd.a.m.elements[12] - p.x) ** 2 + (pd.a.m.elements[14] - p.z) ** 2 < 40 * 40) say(whoOf(pd), pick(pro ? PRO : CONTRA)); });
    break;
  }
  // Streit: ein Befürworter und ein Gegner nah beieinander
  if ((EV.streitT -= 2.5) > 0) return;
  const all = EV.watch.filter(pd => pd.dmw && !pd.dmw.foe && (pd.dmw.keep || (pd.aw && pd.aw.ph === 1)));
  for (const a of all) if (a.dmw.pro) for (const b of all) if (!b.dmw.pro && near2(a, b.a.m.elements[12], b.a.m.elements[14]) < 9 * 9) {
    EV.streitT = 30 + Math.random() * 20; EV.n.streit++;
    const L = pick(STREIT), A = a.dmw, B = b.dmw;
    A.foe = b; B.foe = a; A.argue = B.argue = EV.clock + 9; A.until = Math.max(A.until, EV.clock + 12); B.until = Math.max(B.until, EV.clock + 12);
    say(whoOf(a), L[0], 3.2, true);
    later(3.6, () => say(whoOf(b), L[1], 3.4, true));
    return;
  }
}

/* ---------- 4 · Gala: Applaus als Welle ---------- */
function galaWave(kind) {
  EV.galaTok++;
  if (kind !== 'clap' && kind !== 'drink') return false;
  const tok = EV.galaTok, p = player.p;
  for (const g of GALA.guests) {
    const a = g.a; if (!a) continue;
    if (g.sour == null) g.sour = Math.random() < 0.09;   // ein paar Gäste klatschen nie mit
    const d = Math.hypot(a.x - p.x, a.z - p.z), delay = d / 9 + Math.random() * 0.35;
    later(delay, () => {
      if (EV.galaTok !== tok) return;
      const gg = a.gait; let act;
      if (g.sour && kind === 'clap') {   // tuscheln mit dem Nachbarn statt klatschen
        act = g.sit ? 7.2 : 0.9;
        let nb = null, nd = 9; for (const o of GALA.guests) if (o !== g) { const dd = (o.a.x - a.x) ** 2 + (o.a.z - a.z) ** 2; if (dd < nd) { nd = dd; nb = o.a; } }
        if (nb) turnHead(a, nb.x, nb.z);
      } else {
        if (Math.random() > (kind === 'drink' ? 0.9 : 0.88)) return;
        act = kind === 'clap' ? (g.sit ? 9.8 : 9.3) : (g.sit ? 44.8 : 44.3);
        turnHead(a, p.x, p.z);
      }
      if (gg[1] !== act || gg[2] !== 0) { gg[1] = act; gg[2] = 0; a.gv = (a.gv | 0) + 1; }
    });
  }
  EV.n.welle++;
  return true;
}

/* ---------- Schleife ---------- */
function init() {
  if (EV.ready || !EREIGNISSE) return;
  EV.ready = true;
  RAG.onDown.push(onDown);
  CRASH.on.push(onCrash);
  STR.later = rallyLater;
  GALA.wave = galaWave;
  if (window.vespera) window.vespera.ereignisse = { EV, event, gather, callCops, galaWave, rallyLater, demoTick };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!EV.ready || why !== 'frame') return;
  EV.clock += dt;
  if (EV.q.length) { const now = EV.clock, due = EV.q.filter(j => j.t <= now); if (due.length) { EV.q = EV.q.filter(j => j.t > now); for (const j of due) try { j.fn(); } catch (e) { console.warn('Ereignis:', e); } } }
  if ((EV.tickT -= dt) > 0) return;
  const step = 1 - EV.tickT; EV.tickT = 1;
  if (playing && !paused) demoTick(step);
});
