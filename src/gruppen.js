/* =====================================================================
   V111 · GRUPPEN UND BEZIEHUNGEN
   Bisher ging jeder Passant allein seine Runde. Jetzt sind viele zu zweit
   oder zu dritt unterwegs und gehören zusammen:
   - PAARE (Herr und Dame), FREUNDE (zwei, drei Leute) und FAMILIEN (ein
     Kind mit Mutter und/oder Vater) gehen nebeneinander im selben Schritt,
     gehen gemeinsam in Läden und Lokale und warten aufeinander: wer
     zurückbleibt (stehen geblieben, gestaunt), holt im schnelleren Schritt
     wieder auf.
   - IM GESPRÄCH: unterwegs reden sie miteinander (Sprechblase über dem
     Sprecher, die anderen schauen zu ihm), je nach Gruppe über Alltag,
     Stadt und Alexander, je nach ihrer Haltung zu ihm. Ab und zu bleiben
     sie zusammen stehen, reden mit Gesten, lachen, und gehen weiter.
   - KINDER zeigen auf Alexander und fragen; die Eltern antworten je nach
     Haltung („Ihm gehört die ganze Stadt.“ oder „Komm weiter. Starr ihn
     nicht an.“).
   - BEZIEHUNGEN: wer zusammen geht, teilt die Meinung über Alexander
     (gedaechtnis.js memAtt), und stürzt einer, ruft der andere nach ihm
     und eilt zu ihm.
   Kosten: einmal Gruppen bilden (beim Start), danach Prüfung alle 0,5 s
   nur für Gruppen in Alexanders Nähe. Keine Shader. ?gruppen=aus = V110.
   ===================================================================== */
import { T, MOBILE, camera } from './core.js';
import { peds, turnHead, setAct } from './serpentine.js';
import { player } from './player.js';
import { attOf } from './awe.js';
import { RAG } from './ragdoll.js';
import { KT } from './kontor.js';
import { walk, stand, pos, begin, freePd } from './reaktionen.js';
import { playing, paused } from './input.js';

export const GRUPPEN = typeof location === 'undefined' || new URLSearchParams(location.search).get('gruppen') !== 'aus';
export const GR = { ready: false, built: false, groups: [], talks: [], clock: 0, tickT: 0, n: { paar: 0, freunde: 0, familie: 0, talk: 0, stop: 0, catchup: 0, kid: 0, ruf: 0 } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const cad = pd => { const g = pd.a.gait; g[1] = Math.abs(pd.v) * (pd.fem ? 5.4 : 4.6) / pd.sc; pd.a.gv = (pd.a.gv | 0) + 1; };
const isKid = pd => (pd.kind || pd.a.kind) === 'kid';
const usable = pd => pd.a && pd.st === 0 && pd.lp && pd.lp.segs && !pd.cit && !pd.patrol && !pd.life && !pd.grp && (pd.kind || pd.a.kind) !== 'police' && !pd.demo;

/* ---------- Gruppen bilden (einmal) ---------- */
function build() {
  GR.built = true;
  const byLp = new Map();
  for (const pd of peds) if (usable(pd)) { let L = byLp.get(pd.lp); if (!L) byLp.set(pd.lp, L = []); L.push(pd); }
  const R = MOBILE ? 0.7 : 1;
  const near = (L, a, ok) => { let best = null, bd = 1e9; for (const b of L) { if (b === a || b.grp || !ok(b)) continue; let d = Math.abs(b.t - a.t); d = Math.min(d, a.lp.total - d); if (d < bd && d < 60) { bd = d; best = b; } } return best; };
  for (const [lp, L] of byLp) for (const a of L) {
    if (a.grp) continue;
    const r = Math.random();
    if (isKid(a)) {   // ein Kind geht fast nie allein
      if (r > 0.85) continue;
      const m = near(L, a, b => !isKid(b) && b.fem), f = near(L, a, b => !isKid(b) && !b.fem);
      const ad = [m, f].filter(Boolean); if (!ad.length) continue;
      if (ad.length === 2 && Math.random() < 0.4) ad.pop();   // manchmal nur Mutter oder nur Vater
      join('familie', [ad[0], a, ad[1]].filter(Boolean));
      continue;
    }
    if (r < 0.13 * R) { const b = near(L, a, b => !isKid(b) && b.fem !== a.fem); if (b) join('paar', a.fem ? [b, a] : [a, b]); }
    else if (r < 0.22 * R) {
      const b = near(L, a, b => !isKid(b)); if (!b) continue;
      const m = [a, b]; if (Math.random() < 0.35) { b.grp = 1; const c = near(L, a, c => !isKid(c)); b.grp = null; if (c) m.push(c); }
      join('freunde', m);
    }
  }
}
function join(type, m) {
  const L = m[0], lat = type === 'paar' ? [-0.27, 0.27] : m.length === 3 ? [-0.62, 0, 0.62] : [-0.4, 0.4];
  if (type === 'familie') { if (m.length === 2) { lat[0] = -0.3; lat[1] = 0.3; } else { lat[0] = -0.55; lat[1] = 0; lat[2] = 0.55; } }
  const G = { type, m, L, talkT: 8 + Math.random() * 30, stopT: 40 + Math.random() * 80, alexT: 0, sync: true };
  // die Meinung über Alexander teilen sie (wer keine eigene hat, übernimmt die des anderen)
  const att = m.map(pd => pd.memAtt).find(Boolean);
  m.forEach((pd, i) => {
    pd.grp = G; pd.lat = lat[i]; pd.mcool = 1e9;   // keine zufälligen Begegnungen mehr allein
    if (pd !== L) { pd.cool = 1e9; pd.t = L.t; pd.v = L.v; if (pd.a) cad(pd); }   // in Läden geht man zusammen (der Erste entscheidet)
    if (att && !pd.memAtt && Math.random() < 0.7) pd.memAtt = att;
  });
  GR.groups.push(G); GR.n[type]++;
}

/* ---------- zusammenbleiben ---------- */
function syncGroup(G, dt) {
  const L = G.L, cp = camera.position;
  for (const pd of G.m) {
    if (pd === L || !pd.a) continue;
    // in Läden folgen
    if (L.st === 1 && pd.st === 0 && L.go && !pd.aw) { pd.st = 1; pd.k = Math.max(0, L.k - 0.15); pd.go = L.go; pd.t = L.go.t; continue; }
    if (L.st === 2 && pd.st === 2) pd.wait = L.wait + 0.6;
    if (L.st === 3 && pd.st === 2 && pd.go === L.go) { pd.st = 3; pd.k = Math.max(0, L.k - 0.2); continue; }
    if (L.st !== 0 || pd.st !== 0 || pd.aw) { if (pd.vf) { pd.v = pd.vf; pd.vf = 0; cad(pd); } continue; }
    // gleicher Schritt: wer zurückliegt, geht schneller, wer vorausgeht, wartet langsamer
    let d = L.t - pd.t; const tot = L.lp.total; if (d > tot / 2) d -= tot; else if (d < -tot / 2) d += tot;
    d *= Math.sign(L.v);   // > 0: der Erste ist voraus
    const e = pd.a.m.elements, far = (e[12] - cp.x) ** 2 + (e[14] - cp.z) ** 2 > 70 * 70;
    if (Math.abs(d) < 0.35 || (far && Math.abs(d) < 400)) { pd.t = L.t; if (pd.vf || pd.v !== L.v) { pd.v = L.v; pd.vf = 0; cad(pd); } continue; }
    const want = L.v * (d > 0 ? 1.45 : 0.55);
    if (!pd.vf) { GR.n.catchup++; pd.vf = L.v; }
    if (Math.abs(pd.v - want) > 0.01) { pd.v = want; cad(pd); }
  }
}

/* ---------- Sprechblasen ---------- */
const V3 = new T.Vector3();
function bubble() {
  const el = document.createElement('div');
  el.className = 'grBub';
  el.style.cssText = 'position:fixed;z-index:9;left:0;top:0;max-width:230px;padding:5px 10px;border-radius:9px;background:rgba(5,16,24,.78);border:1px solid rgba(214,180,110,.4);color:#f3ecdf;font:13px/1.35 var(--body,Georgia,serif);font-style:italic;pointer-events:none;opacity:0;transition:opacity .25s;transform:translate(-50%,-100%);text-align:center';
  document.body.append(el); return el;
}
function placeTalk(K) {
  const el = K.el, pd = K.spk; if (!el || !pd || !pd.a) return;
  const e = pd.a.m.elements; V3.set(e[12], e[13] + 2.05 * (pd.sc || 1), e[14]);
  const d = Math.hypot(e[12] - camera.position.x, e[14] - camera.position.z);
  V3.project(camera);
  if (V3.z > 1 || Math.abs(V3.x) > 1.1 || Math.abs(V3.y) > 1.1 || d > 24 || !K.txt || !pd.a.on) { el.style.opacity = 0; return; }
  el.style.left = ((V3.x + 1) / 2 * innerWidth).toFixed(0) + 'px'; el.style.top = ((1 - V3.y) / 2 * innerHeight).toFixed(0) + 'px';
  el.style.opacity = Math.max(0.25, Math.min(1, 1.4 - d / 16)).toFixed(2);
}

/* ---------- Gespräche (A, B, C = die Mitglieder in Reihenfolge; K = das Kind) ---------- */
const PAAR = [
  ['A: Gehen wir noch ins Brass Lantern?', 'B: Nur, wenn du nicht wieder von der Arbeit redest.', 'A: Versprochen. Fast. *'],
  ['B: Hast du die Hüte im Schaufenster gesehen?', 'A: Gesehen ja. Bezahlt nein.', 'B: Du bist unmöglich. *'],
  ['A: Kalt heute.', 'B: Dann halt mich fester.'],
  ['B: Meine Mutter kommt am Sonntag.', 'A: … Ich arbeite am Sonntag.', 'B: Seit wann?', 'A: Seit eben.'],
  ['A: Weißt du noch, unser erster Abend hier? Alles voller Lichter.', 'B: Und du hast dich im Nebel verlaufen. *'],
  ['B: Ich will einmal in den Ballsaal vom Belmont.', 'A: Dafür müsste ich drei Jahre sparen.', 'B: Dann fang an. *'],
];
const FREUNDE = [
  ['A: Die Bahn war wieder voll bis an die Tür.', 'B: Weil alle zur gleichen Schicht müssen.', 'A: Irgendwann bau ich mir ein Luftschiff.', 'B: Na klar. *'],
  ['A: Kommst du heute Abend zum Kartenspielen?', 'B: Wenn ich gewinne, ja.', 'A: Dann bleibst du zu Hause. *'],
  ['A: Mein Vorarbeiter hat mich wieder angebrüllt.', 'B: Der brüllt jeden an. Auch seine Frau.', 'A: Arme Frau.'],
  ['A: Hast du den Kurier gelesen?', 'B: Nur die Seite mit den Pferdewetten.', 'A: Und?', 'B: Verloren. Wie immer.'],
  ['A: Ich sag dir, der Nebel kommt vom Kraterrand.', 'B: Der Nebel kommt vom Meer, du Schlaumeier.', 'C: Der Nebel kommt, und gut ist.'],
];
const FAMILIE = [
  ['K: Mama, wann sind wir zu Hause?', 'A: Gleich, Schatz. Noch zwei Straßen.', 'K: Das hast du vorhin auch gesagt.'],
  ['K: Darf ich ein Zuckerkringel?', 'A: Wenn du brav bist.', 'K: Ich bin immer brav!', 'A: Na ja … *'],
  ['K: Warum ist es hier immer Nacht?', 'A: Weil wir ganz oben auf der Welt wohnen, Schatz.', 'K: Und wann wird es Tag?', 'A: Wenn du groß bist.'],
  ['K: Papa, wie hoch ist das Belmont?', 'A: Höher als alle anderen Türme.', 'K: Höher als der Himmel?', 'A: Fast. *'],
];
// über Alexander, nach der Haltung der Gruppe
const UEBER = {
  gut: [['A: Ohne ihn gäbe es hier nur Eis.', 'B: Das sagt meine Mutter auch. Jeden Tag.'], ['A: Er soll heute im Belmont gewesen sein.', 'B: Da ist er doch immer. Es gehört ihm ja.']],
  mittel: [['A: Er hat schon wieder einen Turm gekauft.', 'B: Was macht man nur mit so viel Geld?', 'A: Noch mehr Türme. *'], ['A: Man sagt, er kann fliegen.', 'B: Man sagt viel.', 'A: Ich hab es gesehen!', 'B: Du hast auch schon Gespenster gesehen.']],
  schlecht: [['A: Er baut Türme, und wir zahlen die Miete dafür.', 'B: Leiser. Man weiß nie, wer zuhört.'], ['A: Mein Lohn reicht kaum für Kohle.', 'B: Und er fliegt über uns hinweg und sieht es nicht.']],
};
const KID_HIM = ['Mama, schau! Ist das Alexander?', 'Papa, kann der wirklich fliegen?', 'Ist das der Mann, dem die Stadt gehört?'];
const PARENT_HIM = {
  gut: ['Ja, Schatz. Ihm verdanken wir die ganze Stadt.', 'Ja. Und jetzt sag schön „Guten Abend“.'],
  mittel: ['Ja, das ist er. Jetzt komm, wir müssen weiter.', 'Psst. Ja, das ist er.'],
  schlecht: ['Komm weiter. Starr ihn nicht an.', 'Das ist der Mann, für den dein Vater arbeitet. Komm jetzt.'],
};
const PAAR_HIM = { gut: [['B: Schau, da ist er!', 'A: Tatsächlich. Größer, als ich dachte.']], mittel: [['B: Ist er das?', 'A: Nicht hinschauen. Doch, er ist es.']], schlecht: [['A: Da ist er. Geh einfach weiter.', 'B: Ich hab doch gar nichts gesagt.']] };
const RUF_DOWN = { paar: ['Liebling! Um Himmels willen!', 'Schatz! Hast du dir wehgetan?'], freunde: ['He! Alles in Ordnung?', 'Bleib liegen, ich komme!'], familie: ['Mein Kind! Komm her!', 'Mama!'] };
const stance = G => { const a = attOf(G.L); return a === 'bew' || a === 'dienst' || a === 'resp' ? 'gut' : a === 'hass' || a === 'neid' ? 'schlecht' : 'mittel'; };

function talk(G, lines) {
  if (GR.talks.some(K => K.G === G)) return;
  const kid = G.m.find(isKid), adults = G.m.filter(pd => !isKid(pd));
  const who = L => L[0] === 'K' ? kid : L[0] === 'C' ? G.m[2] || adults[0] : L[0] === 'B' ? adults[1] || G.m[1] : adults[0];
  const K = { G, lines: lines.map(L => ({ spk: who(L), txt: L.slice(3).replace(/ \*$/, ''), laugh: / \*$/.test(L) })).filter(l => l.spk), i: 0, t: 0, el: bubble() };
  GR.talks.push(K); GR.n.talk++;
  next(K);
}
function next(K) {
  const L = K.lines[K.i++];
  if (!L) return false;
  K.spk = L.spk; K.txt = L.txt; K.el.textContent = L.txt; K.t = 1.9 + L.txt.length * 0.055;
  const e = L.spk.a.m.elements;
  for (const pd of K.G.m) {
    if (pd === L.spk || !pd.a || !pd.a.on) continue;
    turnHead(pd.a, e[12], e[14]);
    if (pd.aw && pd.aw.fn === stopStep) pd.aw.act = L.laugh ? 2.6 : Math.random() < 0.5 ? 1.6 : 1.3;
  }
  if (L.spk.aw && L.spk.aw.fn === stopStep) L.spk.aw.act = L.laugh ? 2.6 : 0.9;
  else { const o = K.G.m.find(pd => pd !== L.spk); if (o && o.a) { const f = o.a.m.elements; turnHead(L.spk.a, f[12], f[14]); } }
  return true;
}
function endTalk(K) { const el = K.el; el.style.opacity = 0; setTimeout(() => el.remove(), 400); GR.talks.splice(GR.talks.indexOf(K), 1); }

/* ---------- zusammen stehen bleiben ---------- */
function stopStep(pd, A, dt) {
  const G = A.G;
  if (A.ph === 0) { if (walk(pd, A, A.tx, A.tz, 1.1, dt) || A.t > 4) { A.ph = 1; A.pt = 0; } return true; }
  if (A.ph === 1) {
    A.pt += dt; stand(pd, A, A.act, A.fx, A.fz, dt);
    return A.pt < A.dur && !G.m.some(o => o.rag);
  }
  return false;
}
function stopTogether(G) {
  if (!G.m.every(pd => pd.st === 0 && freePd(pd))) return false;
  // im Kreis zueinander: jeder tritt einen halben Schritt zur Mitte und schaut zu ihr
  let cx = 0, cz = 0; const P = G.m.map(pos); for (const p of P) { cx += p[0]; cz += p[2]; } cx /= P.length; cz /= P.length;
  const dur = 9 + Math.random() * 7;
  G.m.forEach((pd, i) => {
    const [x, , z] = P[i], dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1, r = isKid(pd) ? 0.45 : 0.5;
    begin(pd, stopStep, { G, tx: cx + dx / d * r, tz: cz + dz / d * r, fx: cx, fz: cz, act: 1.3, dur });
  });
  GR.n.stop++;
  return true;
}

/* ---------- Sturz: der andere ruft und eilt herbei ---------- */
function rushStep(pd, A, dt) {
  const V = A.victim, rag = V.rag, ve = V.a && V.a.m.elements;
  const vx = rag ? rag.p[0][0] : ve[12], vz = rag ? rag.p[0][2] : ve[14];
  if (A.ph === 0) { const dx = A.cx - vx, dz = A.cz - vz, d = Math.hypot(dx, dz) || 1; if (walk(pd, A, vx + dx / d * 0.8, vz + dz / d * 0.8, 3.4, dt) || A.t > 10) { A.ph = 1; A.pt = 0; } return true; }
  A.pt += dt; A.tilt = rag ? -0.36 : 0; stand(pd, A, rag ? 4.2 : 1.3, vx, vz, dt);
  return rag ? A.pt < 15 : A.pt < (A.pt0 = A.pt0 ?? A.pt) + 1.5;
}
function onDown(V) {
  const G = V.grp; if (!G) return;
  const p = player.p, e = V.a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 > 60 * 60) return;
  for (const pd of G.m) {
    if (pd === V || !pd.a || !pd.a.on) continue;
    if (!(pd.aw && pd.aw.fn)) begin(pd, rushStep, { victim: V });
    if (!GR.rufT || GR.clock > GR.rufT) {
      GR.rufT = GR.clock + 3; GR.n.ruf++;
      const L = isKid(V) ? RUF_DOWN.familie[0] : isKid(pd) ? RUF_DOWN.familie[1] : pick(RUF_DOWN[G.type]);
      for (const K of GR.talks.filter(K => K.G === G)) endTalk(K);   // das laufende Gespräch bricht ab
      talk(G, ['A: ' + L]); const K = GR.talks.find(K => K.G === G); if (K) { K.lines[0].spk = pd; K.i = 0; next(K); }
    }
  }
}

/* ---------- Schleife ---------- */
function tick(dt) {
  const p = player.p;
  for (const G of GR.groups) {
    const e = G.L.a && G.L.a.m.elements; if (!e) continue;
    const d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 > 220 * 220) { if (G.m.some(pd => pd.vf)) syncGroup(G, dt); continue; }
    syncGroup(G, dt);
    if (d2 > 30 * 30 || player.fly || p.y > 6) continue;
    G.talkT -= dt; G.stopT -= dt; G.alexT -= dt;
    const busy = GR.talks.some(K => K.G === G);
    // Alexander kommt vorbei: das Kind fragt, die Eltern antworten; ein Paar tuschelt
    if (!busy && d2 < 7 * 7 && G.alexT <= 0 && G.L.a.on) {
      G.alexT = 90; const s = stance(G), kid = G.m.find(isKid);
      if (kid && G.type === 'familie') { GR.n.kid++; talk(G, ['K: ' + pick(KID_HIM), 'A: ' + pick(PARENT_HIM[s])]); if (kid.a.on) turnHead(kid.a, p.x, p.z); }
      else if (G.type === 'paar') talk(G, pick(PAAR_HIM[s]));
      continue;
    }
    if (busy || d2 > 22 * 22) continue;
    if (G.stopT <= 0) { G.stopT = 70 + Math.random() * 90; if (stopTogether(G)) { G.talkT = 0; } }
    if (G.talkT <= 0) {
      G.talkT = 25 + Math.random() * 35;
      const T = G.type === 'paar' ? PAAR : G.type === 'freunde' ? FREUNDE : FAMILIE;
      const ctx = GR.ctx && Math.random() < 0.45 ? GR.ctx(G) : null;   // V113: Themen aus der Lage (plaudern.js)
      talk(G, ctx || (G.type !== 'familie' && Math.random() < 0.35 ? pick(UEBER[stance(G)]) : pick(T)));
    }
  }
}
function init() {
  if (GR.ready || !GRUPPEN) return;
  GR.ready = true;
  RAG.onDown.push(onDown);
  if (window.vespera) window.vespera.gruppen = { GR, build, syncGroup, talk, stopTogether, tick };
}
KT.hooks.push((why, dt) => {
  if (why === 'init') { init(); return; }
  if (!GR.ready || why !== 'frame') return;
  if (!GR.built) { if (peds.length && peds[0].a && peds[peds.length - 1].a) build(); else return; }
  GR.clock += dt;
  // Sprechblasen jedes Bild nachführen, Zeilen weiterschalten
  for (let i = GR.talks.length - 1; i >= 0; i--) {
    const K = GR.talks[i];
    if ((K.t -= dt) <= 0 && !next(K)) { endTalk(K); continue; }
    if (K.G.m.some(pd => pd.rag && pd !== K.spk) && K.lines.length > 1) { endTalk(K); continue; }
    placeTalk(K);
  }
  if ((GR.tickT -= dt) > 0) return;
  const step = 0.5 - GR.tickT; GR.tickT = 0.5;
  if (playing && !paused) tick(step);
});
// V113: Vorlagen für plaudern.js (mehr Gespräche)
export { PAAR, FREUNDE, FAMILIE, UEBER, KID_HIM, PARENT_HIM, PAAR_HIM, stance };
