/* =====================================================================
   V109 · KLÜGERE ABLÄUFE
   Die Passanten gingen bisher ihre Runde um den Block, blieben für ein
   Gespräch stehen oder verschwanden in einer Tür. Jetzt handeln sie, was
   um sie herum passiert, mit kleinen eigenen Abläufen (nur in Alexanders
   Nähe, wo man es sieht):
   - UNTERSTELLEN: bei Regen oder dichtem Schneefall laufen Leute unter das
     Dach der nächsten Haltestelle oder in einen Hauseingang, verschränken
     die Arme oder frieren und gehen weiter, wenn es nachlässt.
   - SCHAUFENSTER, LÄDEN, KNEIPEN: jemand bleibt vor einem Laden stehen,
     schaut hinein und geht manchmal hinein (kommt später durch dieselbe Tür
     wieder heraus); abends zieht es die Leute eher in Bars und Kneipen.
   - HALTESTELLEN: Leute gehen zum Wartehäuschen, warten mit Blick die
     Gleise entlang und steigen ein, wenn die Straßenbahn hält.
   - UNFÄLLE: wird jemand umgerannt oder umgeworfen (ragdoll.js knockDown),
     eilen ein, zwei Leute herbei, beugen sich zu ihm, helfen auf und
     fragen nach („Geht es wieder?“). War es Alexander, schauen sie ihn
     danach scharf an.
   Alles über die Abläufe aus reaktionen.js (pd.aw mit eigener Funktion),
   Prüfung alle 0,5 s, Suche nur über Figuren in der Nähe. Keine Shader.
   ?ablaeufe=aus = Stand V108.
   ===================================================================== */
import { U, MOBILE } from './core.js';
import { peds, turnHead } from './serpentine.js';
import { player } from './player.js';
import { attOf } from './awe.js';
import { RAG, CLOCK } from './ragdoll.js';
import { KT } from './kontor.js';
import { BAHN } from './bahn-hook.js';
import { WL } from './wetterlage.js';
import { lifeSay } from './life.js';
import { walk, stand, clear, pos, begin, goHome, freePd } from './reaktionen.js';
import { aweEnd } from './awe.js';
import { playing, paused } from './input.js';
import { DRIVE } from './eating.js';
import { shared } from './core.js';

export const ABLAEUFE = typeof location === 'undefined' || new URLSearchParams(location.search).get('ablaeufe') !== 'aus';
export const AB = { ready: false, tickT: 0, shelter: [], shop: [], stop: [], help: [], n: { shelter: 0, shop: 0, enter: 0, stop: 0, board: 0, help: 0 }, shopT: 3, stopT: 5 };
const pick = a => a[Math.floor(Math.random() * a.length)];
const near2 = (pd, x, z) => { const e = pd.a.m.elements; return (e[12] - x) ** 2 + (e[14] - z) ** 2; };
const loopPd = pd => pd.st === 9 && pd.aw && pd.aw.st0 === 0 && pd.lp && !pd.cit;   // nur Passanten auf ihrer Runde verschwinden in Türen
// in eine Tür gehen: die Figur wird unsichtbar und kommt später durch dieselbe Tür heraus (serpentine.js st 2 → 3)
function hideIn(pd, A, wait) {
  const L = pd.lp; let best = null, bd = 1e9;
  if (L && L.doors) for (const g of L.doors) { const d = (g.x - A.cx) ** 2 + (g.z - A.cz) ** 2; if (d < bd) { bd = d; best = g; } }
  aweEnd(pd);
  if (!best) return;
  pd.st = 2; pd.go = best; pd.t = best.t; pd.wait = wait; pd.a.on = false;
}
const wet = () => U.uRain.value > 0.35 || U.uSnow.value > 0.65 || (WL && WL.ev === 'sturm');
const hour = () => (CLOCK.min % 1440) / 60;

/* ---------- 1 · Unterstellen ---------- */
function shelterStep(pd, A, dt) {
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, wet() ? 2.6 : 1.4, dt)) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt; stand(pd, A, A.act, A.fx, A.fz, dt);
    if (!wet()) A.dry = (A.dry || 0) + dt; else A.dry = 0;
    if (A.dry > A.patience || A.pt > 150) { A.ph = 2; A.homeV = 1.3; }
    return true;
  }
  return goHome(pd, A, dt);
}
function spotsNear(x, z) {
  const out = [];
  for (const st of BAHN.stations || []) for (const sd of st.sides || []) {
    if (sd.hoch) continue;
    const cx = sd.x + sd.nx * (sd.lc + 1.55), cz = sd.z + sd.nz * (sd.lc + 1.55);
    if ((cx - x) ** 2 + (cz - z) ** 2 > 28 * 28) continue;
    const used = AB.shelter.filter(p => p.aw && p.aw.sd === sd).length; if (used >= 4) continue;
    const al = (used - 1.5) * 1.2 + (Math.random() - 0.5) * 0.4;
    out.push({ x: cx + sd.tx * al, z: cz + sd.tz * al, fx: cx - sd.nx * 5, fz: cz - sd.nz * 5, sd });
  }
  return out;
}
function shelterTry() {
  if (!wet()) return;
  AB.shelter = AB.shelter.filter(pd => pd.aw && pd.aw.fn === shelterStep);
  const max = MOBILE ? 6 : 14; if (AB.shelter.length >= max) return;
  const p = player.p, tag = WL.ev + ':' + (KT.s ? KT.s.day : 0); let n = 0;
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.sh === tag) continue;
    if (near2(pd, p.x, p.z) > 70 * 70 || !freePd(pd)) continue;
    pd.sh = tag;   // jeder entscheidet nur einmal je Wetterlage
    if (Math.random() < 0.55) continue;
    const [x, y, z] = pos(pd);
    // Haltestelle in der Nähe, sonst ein Hauseingang an der eigenen Runde
    let S = spotsNear(x, z).filter(s => clear(x, z, s.x, s.z, y))[0];
    if (!S && pd.lp && pd.lp.doors) {
      const g = pd.lp.doors.filter(g => (g.x - x) ** 2 + (g.z - z) ** 2 < 22 * 22 && !AB.shelter.some(o => o.aw && o.aw.door === g))[0];
      if (g && g.d) { const ox = g.x + (g.d.nx || 0) * 0.7, oz = g.z + (g.d.nz || 0) * 0.7; if (clear(x, z, ox, oz, y)) S = { x: ox, z: oz, fx: ox + (g.d.nx || 0) * 5, fz: oz + (g.d.nz || 0) * 5, door: g }; }
    }
    if (!S) continue;
    const r = Math.random(), A = begin(pd, shelterStep, { tx: S.x, tz: S.z, fx: S.fx, fz: S.fz, sd: S.sd, door: S.door, act: r < 0.45 ? 12.2 : r < 0.75 ? 13.2 : 1.3, patience: 4 + Math.random() * 12 });
    if (!A) continue;
    AB.shelter.push(pd); AB.n.shelter++;
    if (++n >= 3 || AB.shelter.length >= max) break;
  }
}

/* ---------- 2 · Schaufenster, Läden, Kneipen ---------- */
const BAR = k => k === 'bar' || k === 'pub';
function shopStep(pd, A, dt) {
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, 1.25, dt)) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt; stand(pd, A, A.act, A.fx, A.fz, dt);
    if (A.pt > A.look) {
      if (A.enter && loopPd(pd)) { AB.n.enter++; hideIn(pd, A, 20 + Math.random() * (A.bar ? 160 : 70)); return false; }
      A.ph = 2;
    }
    return true;
  }
  return goHome(pd, A, dt);
}
function shopTry(dt) {
  if ((AB.shopT -= dt) > 0) return;
  AB.shopT = 2 + Math.random() * 2;
  AB.shop = AB.shop.filter(pd => pd.aw && pd.aw.fn === shopStep);
  if (AB.shop.length >= (MOBILE ? 2 : 4) || wet()) return;
  const p = player.p, h = hour(), evening = h >= 18 || h < 2;
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || !pd.lp || !pd.lp.doors || !pd.lp.doors.length || (pd.shT || 0) > AB.clock) continue;
    if (near2(pd, p.x, p.z) > 55 * 55 || !freePd(pd)) continue;
    pd.shT = AB.clock + 90;
    if (Math.random() < 0.6) continue;
    const [x, y, z] = pos(pd);
    const g = pd.lp.doors.filter(g => g.d && g.d.kind !== 'hotel' && (g.x - x) ** 2 + (g.z - z) ** 2 < 16 * 16 && (g.x - x) ** 2 + (g.z - z) ** 2 > 2)[0]; if (!g) continue;
    const nx = g.d.nx || 0, nz = g.d.nz || 0, side = (Math.random() - 0.5) * 2.2, tx = g.x + nx * 1.1 + nz * side, tz = g.z + nz * 1.1 - nx * side;
    if (!clear(x, z, tx, tz, y)) continue;
    const bar = BAR(g.d.kind), enter = Math.random() < (bar ? (evening ? 0.75 : 0.35) : 0.4);
    const A = begin(pd, shopStep, { tx, tz, fx: g.x - nx * 3, fz: g.z - nz * 3, act: Math.random() < 0.25 ? 16.3 : 1.3, look: bar ? 1.5 + Math.random() * 2 : 4 + Math.random() * 7, enter, bar });
    if (!A) continue;
    AB.shop.push(pd); AB.n.shop++;
    return;
  }
}

/* ---------- 3 · Haltestellen ---------- */
function stopStep(pd, A, dt) {
  const sd = A.sd;
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, 1.35, dt)) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt; stand(pd, A, A.pt % 14 < 2.5 ? 6.2 : 1.3, A.fx, A.fz, dt);   // ab und zu auf die Uhr schauen
    const v = (BAHN.veh || []).find(v => v.st === 'halt' && v.door > 0.6 && v.tr === sd.tr && v.tr.stops[v.next] === sd);
    if (v) { A.ph = 2; A.v = v; A.bx = sd.x + sd.nx * 1.2; A.bz = sd.z + sd.nz * 1.2; }
    else if (A.pt > 100) A.ph = 3;
    return true;
  }
  if (A.ph === 2) {   // einsteigen
    if (A.v.st !== 'halt') { A.ph = 3; return true; }
    if (walk(pd, A, A.bx, A.bz, 1.6, dt)) { A.v.pax = (A.v.pax || 0) + 1; AB.n.board++; if (loopPd(pd)) { hideIn(pd, A, 60 + Math.random() * 120); return false; } A.ph = 3; }
    return true;
  }
  return goHome(pd, A, dt);
}
function stopTry(dt) {
  if ((AB.stopT -= dt) > 0) return;
  AB.stopT = 3 + Math.random() * 3;
  AB.stop = AB.stop.filter(pd => pd.aw && pd.aw.fn === stopStep);
  if (AB.stop.length >= (MOBILE ? 3 : 6)) return;
  const p = player.p;
  for (const st of BAHN.stations || []) for (const sd of st.sides || []) {
    if (sd.hoch) continue;
    const cx = sd.x + sd.nx * (sd.lc + 1.55), cz = sd.z + sd.nz * (sd.lc + 1.55);
    if ((cx - p.x) ** 2 + (cz - p.z) ** 2 > 60 * 60) continue;
    if (AB.stop.filter(o => o.aw && o.aw.sd === sd).length >= 3) continue;
    for (const pd of peds) {
      if (!pd.a || !pd.a.on || !pd.lp || (pd.stT || 0) > AB.clock) continue;
      const d2 = near2(pd, cx, cz); if (d2 > 24 * 24 || d2 < 4 || !freePd(pd)) continue;
      pd.stT = AB.clock + 120;
      if (Math.random() < 0.6) continue;
      const [x, y, z] = pos(pd), al = (Math.random() - 0.5) * 4.5, tx = cx + sd.tx * al - sd.nx * 0.6, tz = cz + sd.tz * al - sd.nz * 0.6;
      if (!clear(x, z, tx, tz, y)) continue;
      // Blick die Gleise entlang, dorthin, woher die Bahn kommt
      const A = begin(pd, stopStep, { tx, tz, sd, fx: tx - sd.tx * 30, fz: tz - sd.tz * 30 });
      if (!A) continue;
      AB.stop.push(pd); AB.n.stop++;
      return;
    }
  }
}

/* ---------- 4 · Hilfe bei Unfällen ---------- */
const HELP_SAY = ['Geht es wieder? Kommen Sie, ich helfe Ihnen hoch.', 'Haben Sie sich wehgetan? Langsam, langsam.', 'Um Himmels willen! Alles in Ordnung?', 'Hier, nehmen Sie meine Hand.'];
const THANK_SAY = ['Danke … geht schon wieder.', 'Danke. Nur der Hut ist hin.', 'Geht schon. Danke, sehr freundlich.'];
const GLARE_SAY = ['Das war er! Haben Sie das gesehen?', 'Passen Sie doch auf, Herr Alexander!', 'Einfach umgerannt. Typisch.'];
function helpStep(pd, A, dt) {
  const V = A.victim, ve = V.a && V.a.m.elements, rag = V.rag;
  const vx = rag ? rag.p[0][0] : ve ? ve[12] : A.cx, vz = rag ? rag.p[0][2] : ve ? ve[14] : A.cz;
  if (A.ph === 0) {
    const dx = A.cx - vx, dz = A.cz - vz, d = Math.hypot(dx, dz) || 1;
    if (walk(pd, A, vx + dx / d * 0.95, vz + dz / d * 0.95, d > 4 ? 3.2 : 1.6, dt)) { A.ph = 1; A.pt = 0; if (A.lead && Math.random() < 0.8) { shared.sayTimer = Math.min(shared.sayTimer, 0.4); lifeSay(A.who, pick(HELP_SAY), 3); } }
    if (A.t > 15) A.ph = 3;
    return true;
  }
  if (A.ph === 1) {   // vorbeugen, die Hand reichen, bis er wieder steht
    A.pt += dt; A.tilt = -0.34 * Math.min(1, A.pt / 0.6); stand(pd, A, 4.2, vx, vz, dt);
    if (!rag || A.pt > 14) { A.ph = 2; A.pt = 0; A.tilt = 0; if (A.lead && !rag && V.a) { setTimeout(() => { shared.sayTimer = Math.min(shared.sayTimer, 0.4); lifeSay(A.vname, pick(THANK_SAY), 3); }, 600); } }
    return true;
  }
  if (A.ph === 2) {
    A.pt += dt; const p = player.p, glare = A.byHim && A.pt > 1.2;
    stand(pd, A, glare ? ((A.fist ??= Math.random() < 0.35) ? 15.3 : 12.2) : 1.3, glare ? p.x : vx, glare ? p.z : vz, dt);
    if (glare && !A.said && A.lead) { A.said = true; turnHead(pd.a, p.x, p.z); if (Math.random() < 0.6) { shared.sayTimer = Math.min(shared.sayTimer, 0.4); lifeSay(A.who, pick(GLARE_SAY), 3); } }
    if (A.pt > (A.byHim ? 3.5 : 2)) A.ph = 3;
    return true;
  }
  return goHome(pd, A, dt);
}
// wer gerade nur zu Alexander schaut (einfaches Staunen auf der Runde), lässt das für einen Gestürzten sein
const canHelp = pd => freePd(pd) || (pd.aw && !pd.aw.fn && !pd.aw.keep && pd.aw.st0 === 0 && pd.lp && !pd.rag && !pd.back && !pd.gg && !(pd.cit && pd.cit.nf));
function onDown(victim) {
  if (!AB.ready || victim.gg) return;
  const p = player.p, e = victim.a.m.elements, vx = e[12], vz = e[14];
  if ((vx - p.x) ** 2 + (vz - p.z) ** 2 > 90 * 90) return;
  const byHim = (vx - p.x) ** 2 + (vz - p.z) ** 2 < 12 * 12;   // Alexander war in der Nähe: wahrscheinlich seine Schuld
  const list = [];
  for (const pd of peds) {
    if (pd === victim || !pd.a || !pd.a.on) continue;
    const d2 = near2(pd, vx, vz); if (d2 > 20 * 20 || Math.abs(pd.a.m.elements[13] - e[13]) > 2 || !canHelp(pd)) continue;
    const att = attOf(pd); if (att === 'furcht' && byHim) continue;
    list.push([d2, pd]);
  }
  list.sort((a, b) => a[0] - b[0]);
  AB.last = { near: list.length, byHim, blocked: 0 };
  let n = 0;
  const who = pd => pd.cit ? pd.cit.name : pd.fem ? 'Eine Passantin' : 'Ein Passant';
  for (const [, pd] of list) {
    const [x, y, z] = pos(pd), dd = Math.hypot(x - vx, z - vz) || 1;   // bis neben den Gestürzten (er selbst liegt evtl. an einer Laterne)
    if (!clear(x, z, vx + (x - vx) / dd * 0.95, vz + (z - vz) / dd * 0.95, y)) { AB.last.blocked++; continue; }
    const A = begin(pd, helpStep, { victim, lead: n === 0, byHim, who: who(pd), vname: victim.cit ? victim.cit.name : victim.fem ? 'Die Gestürzte' : 'Der Gestürzte' });
    if (!A) continue;
    AB.help.push(pd); AB.n.help++;
    if (++n >= (Math.random() < 0.5 ? 1 : 2)) break;
  }
}

/* ---------- Schleife ---------- */
AB.clock = 0;
function tick(dt) {
  if (DRIVE.on && player.p.y > 3) return;
  shelterTry();
  shopTry(dt);
  stopTry(dt);
}
function init() {
  if (AB.ready || !ABLAEUFE) return;
  AB.ready = true;
  RAG.onDown.push(onDown);
  if (window.vespera) window.vespera.ablaeufe = { AB, shelterTry, shopTry, stopTry, onDown, wet, spotsNear };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!AB.ready || why !== 'frame') return;
  AB.clock += dt;
  if ((AB.tickT -= dt) > 0) return;
  const step = 0.5 - AB.tickT; AB.tickT = 0.5;
  if (playing && !paused) tick(step);
});
