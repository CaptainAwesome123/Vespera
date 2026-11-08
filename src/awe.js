/* =====================================================================
   V52 · STAUNEN UND RESPEKT: wie die Stadt auf Alexanders Kräfte reagiert
   Hebt er ab, fliegt er vorbei, landet er mit Wucht, schwebt ein Sofa oder
   ein Wagen vor ihm, dann halten die Leute in der Nähe inne: Gehende bleiben
   stehen und drehen sich zu ihm, Grüppchen wenden sich um, wer sitzt, schaut
   wenigstens hin. Dazu Gesten aus dem Bestand der Figuren: nach oben zeigen
   (16), staunend die Arme heben (8), Applaus (9), die Herren ziehen den Hut
   (5), und bei der Heldenlandung verbeugen sich manche (Neigung der ganzen
   Figur, kein Shader-Zusatz). Ein Lächeln legt sich auf die Gesichter
   (aLive.w). Nach ein paar Sekunden geht jeder seiner Wege.
   Niemand sonst hat solche Kräfte; die Stadt weiß, wer er ist: ab und zu
   ruft jemand etwas ("Seht nur, Alexander fliegt!").
   V55: Jeder hat eine Haltung zu Alexander (attOf): viele bewundern ihn,
   viele sind neidisch (V66 Kanon: er ist ein reicher Kapitalist, kein
   strahlender Held; manche verachten oder hassen ihn sogar), Arbeiter sind skeptisch, ängstlich oder respektvoll,
   Polizisten, Portiers, Kellner und Chauffeure stehen stramm oder verneigen
   sich. Seine Autorität erkennt jeder an: geht er zu Fuß vorbei, machen die
   Leute Platz, ziehen den Hut, winken, verneigen sich, tuscheln (Neid),
   rauchen und mustern ihn (Skepsis) oder ducken sich weg (Furcht). Auch was
   sie rufen und sagen, wenn man sie anspricht, hängt von der Haltung ab.
   ===================================================================== */
import { $, shared, U } from './core.js';
import { peds, turnHead, setAct, pedCrowd } from './serpentine.js';
import { player } from './player.js';
import { interiorCrowd } from './belmont.js';
import { VILLA } from './harbour.js';
import { DRIVE } from './eating.js';
import { BOAT } from './boat.js';

export const AWE = { sayT: 0, flyT: 0, tkT: 0, n: 0, lines: 0 };
export const SAY = {
  takeoff: ['Seht nur, er hebt ab!', 'Da fliegt er! Alexander!', 'Meine Güte, er fliegt wirklich!', 'Hut ab, Herr Alexander!'],
  fly: ['Seht nur, Alexander fliegt!', 'Da oben! Das ist Alexander!', 'Guten Abend, Herr Alexander!', 'Unglaublich … er fliegt.'],
  land: ['Meine Güte!', 'Das war Alexander!', 'Haben Sie das gesehen?', 'Der Herr von Vespera persönlich.'],
  tk: ['Es schwebt! Es schwebt einfach!', 'Haben Sie das gesehen? Ganz ohne Hände!', 'Das kann nur Alexander.', 'Mein Gott, der Wagen fliegt!', 'Unglaublich, Herr Alexander!'],
  throw: ['Bravo!', 'Haben Sie das gesehen?', 'Was für eine Kraft!', 'Bravo, Herr Alexander!'],
  blast: ['Meine Güte, was für eine Kraft!', 'Haben Sie das gesehen? Einfach weggestoßen!', 'Vorsicht! Alexander!', 'Das Licht … wie der Kristall!', 'Gott bewahre, wer ihm im Weg steht.'],   // V59: Energieschub
};
/* ---------- V55: Haltung zu Alexander ---------- */
// bew = bewundert ihn, neid = neidisch, skep = skeptisch, furcht = fürchtet ihn, resp = Respekt, dienst = Personal und Polizei
// V72: hass = feindselig (nur bei schlechtem Ruf über ruf.js: wendet sich ab, mustert ihn kalt, ruft ihm etwas nach)
export function attOf(pd) {
  if (pd.att) return pd.att;
  const k = pd.a ? pd.a.kind : pd.kind, r = Math.random(), tr = pd.cit && pd.cit.trait.k;
  if (AWE.attHook) { const h = AWE.attHook(k, tr, r); if (h) return pd.att = h; }   // V62: Ruf und Ansehen (ruf.js) verschiebt die Haltungen
  let att;
  if (k === 'police' || k === 'livery' || k === 'waiter' || k === 'chauffeur' || k === 'sailor') att = 'dienst';
  else if (k === 'kid') att = 'bew';
  else if (k === 'worker') att = tr === 'mürrisch' ? (r < 0.7 ? 'skep' : 'furcht') : tr === 'schüchtern' ? (r < 0.6 ? 'furcht' : 'resp') : r < 0.36 ? 'skep' : r < 0.64 ? 'furcht' : 'resp';
  else att = tr === 'mürrisch' || tr === 'ehrgeizig' ? (r < 0.5 ? 'neid' : r < 0.7 ? 'skep' : 'bew') : r < 0.25 ? 'neid' : r < 0.37 ? 'skep' : r < 0.45 ? 'furcht' : 'bew';
  return pd.att = att;
}
const WHO = { worker: 'Ein Arbeiter', police: 'Ein Polizist', kid: 'Ein Junge', waiter: 'Ein Kellner', livery: 'Ein Portier', chauffeur: 'Ein Chauffeur', sailor: 'Ein Matrose' };
export const whoOf = pd => pd.cit ? pd.cit.name : WHO[pd.a && pd.a.kind] || (pd.fem ? 'Eine Dame' : 'Ein Herr');
// was man ruft, wenn er zu Fuß vorbeikommt
export const SAY_NEAR = {
  bew: ['Guten Abend, Herr Alexander!', 'Da ist er! Herr Alexander!', 'Herr Alexander! Was für eine Ehre!', 'Schön, Sie zu sehen, Herr Alexander!', 'Sehen Sie nur, er geht zu Fuß wie unsereins!'],
  kid: ['Mama, schau! Das ist Alexander!', 'Herr Alexander! Können Sie fliegen? Zeigen Sie’s mir!', 'Wenn ich groß bin, werd’ ich wie Alexander!'],
  neid: ['Na, wenn das nicht der Herr von Vespera ist …', 'Dem gehört die halbe Stadt.', 'Manche haben eben alles.', 'Penthouse, Villa, Luftschiff … und ich zahle Miete.'],
  skep: ['Da kommt der Herr von oben.', 'Was will der denn hier unten?', 'Schaut euch den an. Keinen Tag geschuftet wie wir.', '’n Abend … Herr Alexander.'],
  furcht: ['Pst! Das ist er. Kopf runter.', 'Nicht hinsehen … der hebt Autos hoch.', 'Verzeihung, Herr Alexander, ich geh’ schon aus dem Weg.'],
  resp: ['’n Abend, Herr Alexander.', 'Respekt, Herr Alexander.', 'Abend, Herr Alexander. Gute Schicht heute.'],
  police: ['Guten Abend, Herr Alexander! Alles ruhig im Revier.', 'Zu Befehl, Herr Alexander!', 'Machen Sie Platz für Herrn Alexander!'],
  dienst: ['Zu Diensten, Herr Alexander!', 'Sehr wohl, Herr Alexander.', 'Guten Abend, Herr Alexander. Beehren Sie uns?'],
  hass: ['Da ist er ja, der Herr der Türme. Schämen Sie sich!', 'Alles von unseren Löhnen gebaut.', 'Gehen Sie zurück in Ihr Penthouse, Alexander.', 'Kein Gruß für Sie.', 'Eines Tages gehört die Stadt uns allen.'],   // V72
};
// was die Nicht-Bewunderer rufen, wenn er seine Kräfte zeigt
export const SAY_POW = {
  neid: ['Natürlich kann er das auch noch.', 'Fliegen … als ob das Penthouse nicht reicht.', 'Angeben kann er, das muss man ihm lassen.'],
  skep: ['Und wer räumt das wieder auf? Wir.', 'Angeber.', 'Hoffentlich fällt das nicht auf uns.'],
  furcht: ['Um Himmels willen!', 'Weg hier, schnell!', 'Der ist kein Mensch …', 'Bitte nicht auf uns!'],
  resp: ['Alle Achtung.', 'Respekt, Herr Alexander.', 'So eine Kraft … Hut ab.'],
  dienst: ['Sehr wohl, Herr Alexander!', 'Bravo, Herr Alexander!'],
  hass: ['Zeigen Sie nur, was Sie können. Die Stadt gehört Ihnen trotzdem nicht.', 'Angeber! Mit unserem Geld!', 'Fliegen kann er. Zuhören nicht.'],   // V72
};
// was sie sagen, wenn er sie anspricht (ragdoll.js citizenSay)
export const TALK = {
  bew: ['Herr Alexander! Darf ich Ihnen die Hand schütteln? Das glaubt mir zu Hause keiner.', 'Ohne Sie gäbe es Vespera nicht. Das sage ich jedem, der über Sie schimpft.', 'Ich habe Sie über dem Belmont fliegen sehen. Ich werde es nie vergessen.', 'Guten Abend, Herr Alexander! Es ist mir eine Ehre.'],
  neid: ['Guten Abend, Herr Alexander. Penthouse, Villa, Luftschiff … manche haben eben alles.', 'Natürlich, Herr Alexander. Wie Sie wünschen. Wie immer.', 'Eines Tages habe ich auch eine Suite im Belmont. Ganz bestimmt.', 'Schön für Sie. Unsereins arbeitet für so einen Abend ein ganzes Jahr.'],
  skep: ['Herr Alexander. Was führt Sie zu uns hier unten?', 'Schöne Schuhe. Die kosten mehr, als ich im Jahr verdiene.', 'Wir bauen Ihre Türme, Herr Alexander. Vergessen Sie das nicht.', 'Hm. ’n Abend. Sie sind der Chef, das weiß hier jeder.'],
  furcht: ['V… verzeihen Sie, Herr Alexander. Ich hab nichts getan!', 'Bitte, Herr Alexander, ich will keinen Ärger.', 'J… ja, Herr Alexander. Natürlich, Herr Alexander.'],
  resp: ['’n Abend, Herr Alexander. Sie haben uns Arbeit gegeben, das vergessen wir nicht.', 'Alle Achtung, Herr Alexander. Sie sind sich nicht zu fein für unser Viertel.', 'Wenn Sie was brauchen, Herr Alexander: Wir packen an.'],
  dienst: ['Zu Diensten, Herr Alexander!', 'Sehr wohl, Herr Alexander. Kann ich etwas für Sie tun?', 'Guten Abend, Herr Alexander. Ist alles zu Ihrer Zufriedenheit?'],
  hass: ['Mit Ihnen rede ich nicht.', 'Sie wollen reden? Zahlen Sie erst anständige Löhne.', 'Meine Schwester hat sich in Ihrer Gießerei die Hände verbrannt. Und Sie fliegen spazieren.', 'Lassen Sie mich in Ruhe, Herr Alexander. Bitte.'],   // V72
};
export function talkLine(pd) { const L = TALK[attOf(pd)] || TALK.bew; return L[Math.floor(Math.random() * L.length)]; }
function showSay(who, s) {
  const el = $('say'); if (!el) return;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + s + '“'; el.style.opacity = 1; shared.sayTimer = 4;
}
// Geste bei den Kräften je nach Haltung (bew: wie in V52)
function pickActAtt(kind, pd) {
  const att = attOf(pd), r = Math.random(), man = !pd.fem;
  if (att === 'furcht') return r < 0.55 ? 13.2 : 1.3;
  if (att === 'hass') return r < 0.5 ? 15.3 : 12.2;   // V72
  if (att === 'skep') return r < 0.4 ? 15.3 : r < 0.65 ? 12.2 : 1.3;
  if (att === 'neid') return (kind === 'land' || kind === 'throw') && r < 0.3 ? 8.2 : r < 0.3 ? 12.2 : 1.3;
  if (att === 'resp') return man && r < 0.5 ? 5.3 : r < 0.7 ? 8.2 : 1.3;
  if (att === 'dienst') return man && r < 0.6 ? 5.3 : 1.3;
  return pickAct(kind, pd.fem);
}
// Geste je Anlass: [Handlung, Wahrscheinlichkeit] (Herren tragen Hut: 5; nach oben zeigen: 16; staunen: 8; Applaus: 9; einfach hinsehen: 1)
function pickAct(kind, fem) {
  const r = Math.random();
  if (kind === 'fly' || kind === 'takeoff') return fem ? (r < 0.2 ? 8.2 : 1.3) : (r < 0.35 ? 16.3 : r < 0.5 ? 8.2 : r < 0.62 ? 5.3 : 1.3);
  if (kind === 'land') return r < 0.4 ? 8.2 : r < 0.6 ? 9.3 : (!fem && r < 0.75 ? 5.3 : 1.3);
  if (kind === 'throw') return r < 0.5 ? 9.3 : r < 0.8 ? 8.2 : 1.3;
  if (kind === 'blast') return r < 0.5 ? 8.2 : r < 0.62 ? 9.3 : 1.3;   // V59: Energieschub: staunen, wenige klatschen
  return fem ? (r < 0.3 ? 8.2 : r < 0.45 ? 9.3 : 1.3) : (r < 0.25 ? 8.2 : r < 0.45 ? 9.3 : r < 0.6 ? 5.3 : 1.3);   // tk
}
const wrapA = a => Math.atan2(Math.sin(a), Math.cos(a));
// Hut ziehen (5) und nach oben zeigen (16) sind im Shader Zyklen von 7 bzw. 12 s; die Zeitverschiebung der Figur (gait[0]) wird
// so gewählt, dass die Geste jetzt beginnt (tt = uTime·(0,9 + 0,2·fract(g·3,7)) + 7·g, siehe people-skeleton.js)
function phaseFor(act, g0) {
  const P = act < 6 ? 7 : 12, s0 = act < 6 ? 0.0 : 0.05, t = U.uTime.value, fr = x => x - Math.floor(x);
  for (let n = 0; n < 240; n++) { const g = g0 + n * 0.0417, tt = t * (0.9 + 0.2 * fr(g * 3.7)) + g * 7, f = fr(tt / P); if (f >= s0 && f < s0 + 0.025) return g; }
  return g0;
}
/* Eine Figur hält inne und reagiert: zu Alexander drehen, Geste, Verbeugung, ausweichen, ducken, wegschauen.
   o: { act, dur, bow, duck, shift, away, keep } */
function startAwe(pd, o) {
  const a = pd.a, e = a.m.elements, g = a.gait, p = player.p;
  const yaw0 = Math.atan2(e[8], e[10]);
  let sx = 0, sz = 0;
  if (o.shift && !o.keep) { const dx = e[12] - p.x, dz = e[14] - p.z, L = Math.hypot(dx, dz) || 1; sx = dx / L * o.shift; sz = dz / L * o.shift; }
  const A = pd.aw = { t: 0, dur: o.dur, x: e[12], y: e[13], z: e[14], yaw: yaw0, yaw0, act: o.act, act0: g[1], g2: g[2], g0: g[0], st0: pd.st, keep: o.keep, lookT: 0,
    bow: o.bow || 0, duck: o.duck || 0, sx, sz, away: o.away || 0, lean: o.lean || 0 };
  if (!o.keep && pd.st === 0) pd.st = 9;   // Gehende auf ihrer Runde (Bewohner laufen über updateCitizens)
  if (A.act > 4.5 && A.act < 5.5) { g[0] = phaseFor(5, g[0]); A.dur = Math.max(A.dur, 3.4); }
  else if (A.act > 15.5 && A.act < 16.5) { g[0] = phaseFor(16, g[0]); A.dur = Math.max(A.dur, 6.5); }
  setAct(pd, A.act); a.gv = (a.gv | 0) + 1;
  return A;
}
const smileOn = (pd, a) => { if (a.live && pd.sm0 == null) { pd.sm0 = a.live[3]; a.live[3] = 1.55; a.gv = (a.gv | 0) + 1; } };
const happy = att => att === 'bew' || att === 'dienst' || (att === 'resp' && Math.random() < 0.5);
// wer kann stehen bleiben und sich umdrehen (gehen, in der Runde stehen, Bewohner unterwegs); Musiker, Sitzende und Kellner nur schauen
function mobility(pd) {
  const walking = pd.st === 0 && pd.lp, group = pd.st === 4 && !pd.sit && !pd.busy, cit = pd.cit && (pd.cit.st === 'walk' || pd.cit.st === 'task' || pd.cit.st === 'loop');
  return walking || cit ? 'walk' : group ? 'keep' : null;
}
/* Alle in der Nähe reagieren. kind: 'takeoff' | 'fly' | 'land' | 'tk' | 'throw'; R: Umkreis; k: Anteil derer, die stehen bleiben */
export function aweBurst(kind, R, k = 0.9) {
  if (!pedCrowd) return;
  const p = player.p, R2 = R * R, dy = kind === 'fly' || kind === 'takeoff' ? 70 : 9;
  let nearest = null, nd = 1e9, n = 0;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.rag || pd.back) continue;
    const e = a.m.elements, d2 = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d2 > R2 || Math.abs(e[13] - p.y) > dy) continue;
    if (pd.aw) { pd.aw.dur = Math.max(pd.aw.dur, pd.aw.t + 2.5 + Math.random() * 2); turnHead(a, p.x, p.z); continue; }
    if (pd.awCool > 0 && kind === 'fly') continue;
    turnHead(a, p.x, p.z);
    const att = attOf(pd), mob = mobility(pd);
    if (happy(att)) smileOn(pd, a);
    if (!mob || Math.random() > k) { pd.awCool = 3; AWE.smiles.push(pd); continue; }
    const act = pickActAtt(kind, pd), man = !pd.fem, fear = att === 'furcht';
    const bow = act > 1.2 && act < 1.4 && man && (att === 'bew' || att === 'resp' || att === 'dienst') ? (kind === 'land' && Math.random() < 0.5 ? 0.3 + Math.random() * 0.3 : kind !== 'fly' && Math.random() < 0.15 ? 0.6 : 0) : 0;
    startAwe(pd, { act: bow ? 1.3 : act, dur: 3.2 + Math.random() * 3, bow, keep: mob === 'keep', duck: fear || (kind === 'blast' && Math.random() < 0.3) ? 0.14 : 0, shift: (fear || kind === 'blast') && kind !== 'fly' && kind !== 'takeoff' ? 1.0 : 0, away: att === 'neid' && Math.random() < 0.5 ? 1.6 : 0, lean: att === 'skep' ? 0.05 : 0 });
    n++;
    if (d2 < nd) { nd = d2; nearest = pd; }
  }
  AWE.n = n;
  // Gäste und Personal im Belmont und in der Villa (eigene Figurenlisten): Kopf drehen und lächeln
  for (const C of [interiorCrowd, VILLA.crowd]) {
    if (!C || !C.list) continue;
    for (const a of C.list) {
      if (!a.on || !a.live) continue;
      const e = a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 > R2 || Math.abs(e[13] - p.y) > dy) continue;
      turnHead(a, p.x, p.z);
      if (a.sm0 == null) { a.sm0 = a.live[3]; a.live[3] = 1.55; a.gv = (a.gv | 0) + 1; AWE.smiles.push({ a, awCool: 5, ext: true }); }
    }
  }
  // ab und zu ruft jemand etwas (nur in Hörweite); was, hängt von seiner Haltung ab
  if (nearest && nd < 16 * 16 && AWE.sayT <= 0 && Math.random() < 0.6) {
    const att = attOf(nearest), L = att === 'bew' ? SAY[kind] || SAY.tk : SAY_POW[att] || SAY.tk;
    showSay(whoOf(nearest), L[Math.floor(Math.random() * L.length)]);
    AWE.sayT = 7 + Math.random() * 6; AWE.lines++;
  }
}
AWE.smiles = [];
AWE.clock = 0; AWE.nearT = 0;
/* V55: Alexander geht zu Fuß vorbei. Wer ihn bemerkt (bis 8,5 m), reagiert einmal (dann eine gute halbe Minute nicht
   wieder), je nach Haltung. Gehende machen ihm Platz. Alle 0,3 s, höchstens fünf neue auf einmal. */
function greet(pd, d2) {
  const a = pd.a, p = player.p, att = attOf(pd), kind = a.kind, man = !pd.fem, r = Math.random();
  turnHead(a, p.x, p.z);
  if (happy(att)) smileOn(pd, a);
  const mob = mobility(pd);
  if (!mob) { pd.awCool = 4; AWE.smiles.push(pd); return false; }
  const keep = mob === 'keep', o = { keep, dur: 2.6 + Math.random() * 1.6, shift: keep ? 0 : 0.45 };
  if (kind === 'kid') { o.act = r < 0.7 ? 3.6 : 8.2; }
  else if (att === 'bew' && AWE.bewHi && AWE.bewHi() && r < 0.25) o.act = 9.3;   // V72: gefeiert: manche klatschen, wenn er vorbeigeht
  else if (att === 'bew') { if (man) { if (r < 0.5) o.act = 5.3; else if (r < 0.7) o.act = 3.6; else { o.act = 1.3; o.bow = 0.25; } } else if (r < 0.45) o.act = 3.6; else { o.act = 1.3; o.bow = 0.15; } }
  else if (att === 'neid') { o.act = r < 0.35 ? 12.2 : 1.3; o.away = 1.0 + Math.random() * 0.8; }
  else if (att === 'skep') { o.act = kind === 'worker' && r < 0.4 ? 15.3 : r < 0.7 ? 12.2 : 1.3; o.lean = 0.05; o.away = r < 0.5 ? 2.2 : 0; }
  else if (att === 'furcht') { o.act = d2 < 2.5 * 2.5 && r < 0.5 ? 13.2 : 1.3; o.duck = 0.13; o.shift = keep ? 0 : 0.75; o.dur = 2.2 + Math.random() * 1.2; }
  else if (att === 'hass') { o.act = r < 0.5 ? 15.3 : 12.2; o.lean = 0.06; o.away = 0.5 + Math.random() * 0.6; o.shift = 0; }   // V72: kalter Blick, dann abwenden
  else if (att === 'resp') { if (man) { o.act = r < 0.6 ? 5.3 : 1.3; o.bow = o.act < 2 ? 0.25 : 0; } else { o.act = 1.3; o.bow = 0.15; } }
  else { if (kind === 'police' || kind === 'sailor') o.act = 5.3; else { o.act = 1.3; o.bow = 0.6; } }   // dienst
  startAwe(pd, o);
  return true;
}
function aweNear(dt) {
  if ((AWE.nearT -= dt) > 0) return; AWE.nearT = 0.3;
  if (!pedCrowd || player.fly || DRIVE.on || BOAT.on) return;
  const p = player.p, clock = AWE.clock;
  let fresh = 0, nearest = null, nd = 1e9;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || pd.aw || pd.rag || pd.back) continue;
    const e = a.m.elements, dx = e[12] - p.x; if (dx > 8.5 || dx < -8.5) continue;
    const dz = e[14] - p.z; if (dz > 8.5 || dz < -8.5) continue;
    const d2 = dx * dx + dz * dz; if (d2 > 72 || Math.abs(e[13] - p.y) > 3) continue;
    if ((pd.metT || 0) > clock) continue;
    pd.metT = clock + 30 + Math.random() * 30;
    if (Math.random() > 0.88) continue;
    if (greet(pd, d2) && d2 < nd) { nd = d2; nearest = pd; }
    if (++fresh >= 5) break;
  }
  // Belmont und Villa: Köpfe drehen sich, man lächelt
  for (const C of [interiorCrowd, VILLA.crowd]) {
    if (!C || !C.list || !C.vis) continue;
    for (const a of C.list) {
      if (!a.on || !a.live || (a.metT || 0) > clock) continue;
      const e = a.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 > 49 || Math.abs(e[13] - p.y) > 3) continue;
      a.metT = clock + 25 + Math.random() * 20; turnHead(a, p.x, p.z);
      if (a.sm0 == null) { a.sm0 = a.live[3]; a.live[3] = 1.55; a.gv = (a.gv | 0) + 1; AWE.smiles.push({ a, awCool: 4, ext: true }); }
    }
  }
  if (nearest && AWE.sayT <= 0 && shared.sayTimer <= 0 && Math.random() < 0.5) {
    const att = attOf(nearest), key = nearest.a.kind === 'kid' ? 'kid' : nearest.a.kind === 'police' ? 'police' : att, L = SAY_NEAR[key] || SAY_NEAR.bew;
    showSay(whoOf(nearest), L[Math.floor(Math.random() * L.length)]);
    AWE.sayT = 6 + Math.random() * 6;
  }
}
// Wird jemand angesprochen, grüßt er auch mit der Geste seiner Haltung
export function greetNow(pd) { if (pd && pd.a && pd.a.on && !pd.aw && !pd.rag) { pd.metT = AWE.clock + 30; greet(pd, 4); } }
// Jedes Bild für eine staunende Figur: zu Alexander drehen, Geste halten, Verbeugung, dann weiter wie vorher
export function aweStep(pd, dt) {
  const A = pd.aw, a = pd.a; if (!A) return;
  if (pd.rag || !a || !a.on) { aweEnd(pd); return; }
  A.t += dt;
  const p = player.p, want = A.away && A.t > A.away ? A.wy ?? (A.wy = Math.atan2(p.x - A.x, p.z - A.z) + (Math.random() < 0.5 ? 1.3 : -1.3)) : Math.atan2(p.x - A.x, p.z - A.z);
  A.yaw += wrapA(want - A.yaw) * Math.min(1, dt * 4);
  let tilt = 0;
  if (A.bow) { const u = A.t; tilt = A.bow * (u < 0.5 ? u / 0.5 : u < 1.6 ? 1 : Math.max(0, 1 - (u - 1.6) / 0.7)); tilt = -0.38 * tilt; }   // negativ = nach vorn
  const ease = Math.min(1, A.t / 0.5) * Math.min(1, Math.max(0, (A.dur - A.t) / 0.6));
  if (A.duck) tilt -= A.duck * ease;   // V55: Furcht: Kopf eingezogen, leicht geduckt
  if (A.lean) tilt += A.lean * ease;   // Skepsis: etwas zurückgelehnt
  if (A.keep) { pd.yaw = A.yaw; pd.tilt = tilt; }
  else pedCrowd.set(a, A.x + A.sx * ease, A.y, A.z + A.sz * ease, A.yaw, pd.sc, tilt);   // V55: Platz machen
  if (A.t - A.lookT > 0.35) {
    A.lookT = A.t;
    if (A.away && A.t > A.away) {
      // V55: Neid und Skepsis: wegschauen, in der Runde zum Nachbarn tuscheln
      const c = pd.chat, o = c && c.m[Math.floor(Math.random() * c.m.length)];
      if (o && o !== pd && o.a && o.a.on && !A.wh) { const f = o.a.m.elements; turnHead(a, f[12], f[14]); A.wh = true; setAct(pd, 0.9); }
    } else turnHead(a, p.x, p.z);
  }
  if (A.t > A.dur) aweEnd(pd);
}

export function aweEnd(pd) {
  const A = pd.aw; if (!A) return;
  pd.aw = null; pd.awCool = 4; AWE.smiles.push(pd);   // das Lächeln verblasst erst nach der Abkühlzeit
  const a = pd.a;
  if (A.keep) { pd.yaw = A.yaw0; pd.tilt = 0; if (a) setAct(pd, A.act0); }
  else { if (pd.st === 9) pd.st = A.st0; if (a) { const g = a.gait; g[0] = A.g0; g[1] = A.act0; g[2] = A.g2; a.gv = (a.gv | 0) + 1; } }
  if (A.keep && a) { a.gait[0] = A.g0; a.gv = (a.gv | 0) + 1; }
}
// Zeiten: Lächeln der Zuschauer verblasst, Rufe und Abkühlzeiten laufen ab
export function updateAwe(dt) {
  AWE.sayT -= dt; AWE.clock += dt;
  aweNear(dt);   // V55
  for (let i = AWE.smiles.length - 1; i >= 0; i--) {
    const pd = AWE.smiles[i]; pd.awCool -= dt;
    if (pd.awCool > 0) continue;
    AWE.smiles.splice(i, 1);
    if (pd.ext) { const a = pd.a; if (a.sm0 != null) { a.live[3] = a.sm0; a.sm0 = null; a.gv = (a.gv | 0) + 1; } continue; }
    const a = pd.a; if (a && a.live && pd.sm0 != null && !pd.aw) { a.live[3] = pd.sm0; pd.sm0 = null; a.gv = (a.gv | 0) + 1; }
  }
}
