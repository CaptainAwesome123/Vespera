/* =====================================================================
   V61 · DER ROTE KASIMIR UND DIE GROSSEN ANGRIFFE
   Kasimir Roth, genannt der Rote Kasimir, führt die Anarchisten von Vespera.
   Ochsenblutroter Zweireiher, einen halben Kopf größer als seine Leute.
   Er ist zäh (vier Treffer, dazwischen rappelt er sich auf), weicht dem
   aufgeladenen Energieschub zur Seite aus, schießt Doppelschüsse und wirft
   Dynamitbündel mit kurzer Zündschnur. Alexander kann das Dynamit mit
   Telekinese packen und zurückwerfen (die Druckwelle wirft auch Kasimir um).
   Ist er halb besiegt, ruft er Genossen zu Hilfe.
   Größere Angriffe (Taste J geht sie mit durch):
   - Aufstand: Barrikade aus Fässern, Kisten und Tonnen quer über die
     Straße, brennende Flaschen, sechs bis acht Anarchisten, dahinter
     Kasimir mit erhobener Faust. Bei einem letzten Rest Kraft flieht er
     in den Untergrund (das verrät sein Hauptquartier, verstecke.js).
   - Bombenserie: drei Bomben zugleich vor Häusern in der Nähe.
   - Bankraub: drei Räuber stürmen aus der Vespera-Bank, mit Geldsäcken.
   Gefasst sitzt Kasimir im Gefängnis, bricht aber nach 25 Minuten Spielzeit
   aus. Der Stand bleibt im Browser gespeichert (localStorage).
   Keine neuen Shader, keine neuen Lichter: Figuren aus dem Gegner-Bestand,
   Dynamit und Geldsack als lose Körper mit dem Material der losen Dinge.
   ===================================================================== */
import { T, MOBILE, $ } from './core.js';
import { player } from './player.js';
import { pedCrowd } from './serpentine.js';
import { GEGNER, GEG, EV_EXTRA, EV_TYPES, gegnerSay, gegBlastAround, gegFireball } from './gegner.js';
import { LOOSE, GEOS, KINDS_OF, spawnProp, dropBody } from './physics.js';
import { mergeColored } from './people-skeleton.js';
import { fxEmit } from './particles.js';
import { BLAST } from './energy.js';
import { toast } from './boat.js';
import { DOORS } from './entrances.js';
import { ORTE } from './orte.js';
import { aweBurst } from './awe.js';
import { groundAt } from './driving.js';
import { SND, sndTone } from './audio.js';
import { UNTER } from './unter-hook.js';

const KEY = 'vespera-kasimir';
export const BOSS = { pd: null, st: 'frei', maxHp: 4, jailT: 0, dyn: [], bags: [], hud: null, onEscape: null, onCaught: null, inHQ: false,
  stats: { gestellt: 0, gefasst: 0, entkommen: 0, dynamit: 0, zurueck: 0 } };
const JAIL = 25 * 60;   // so lange sitzt er (Spielzeit), dann bricht er aus
(function load() { try { const S = JSON.parse(localStorage.getItem(KEY) || 'null'); if (S) { BOSS.st = S.st === 'gefasst' ? 'gefasst' : 'frei'; BOSS.jailT = +S.jailT || 0; Object.assign(BOSS.stats, S.stats || {}); } } catch (e) { /* ohne Speicher */ } })();
export function bossSave() { try { localStorage.setItem(KEY, JSON.stringify({ st: BOSS.st, jailT: Math.round(BOSS.jailT), stats: BOSS.stats })); } catch (e) { /* ohne Speicher */ } }

const pick = a => a[Math.floor(Math.random() * a.length)];
// Meldung an die Zeitung von Vespera (eigener Teil des Spiels, hört auf 'vespera-news'; prio ab 8 = Extrablatt)
export function news(titel, text, prio = 5, ort) { try { window.dispatchEvent(new CustomEvent('vespera-news', { detail: { titel, text, rubrik: 'Polizei', prio, ort } })); } catch (e) { /* ohne Zeitung */ } }
const KSAY = {
  intro: ['Bürger von Vespera! Seht ihn euch an, euren goldenen Gott!', 'Alexander! Du hast diese Stadt aus dem Eis geholt, und heute holen wir sie uns zurück!', 'Der Kristall gehört dem Volk, nicht einem Mann im Frack!', 'Genossen! Heute brennt das Gold!', 'Hört mich an! Kein Mann soll über Vespera herrschen!'],
  kampf: ['Unverwundbar? Das werden wir ja sehen!', 'Nimm das, Herr von Vespera!', 'Dynamit kennt keine Götter!', 'Du kannst nicht überall sein, Alexander!', 'Für jede Kugel, die abprallt, kommen zehn Genossen!', 'Ihr da oben im Belmont, hört ihr das?', 'Komm doch her, du goldener Teufel!'],
  dynamit: ['Fang, Alexander!', 'Ein Geschenk aus dem Untergrund!', 'Mal sehen, ob du auch das hier wegsteckst!', 'Für das Belmont!'],
  getroffen: ['Ha! Ist das alles?', 'Ich … stehe … wieder auf!', 'Ein Kasimir bleibt nicht liegen!', 'Das war nur ein Kratzer!', 'Mehr hast du nicht?'],
  ausweichen: ['Daneben!', 'Zu langsam, Herr Alexander!', 'Den Trick kenne ich schon!'],
  rufen: ['Genossen! Zu mir!', 'Alle Mann an die Barrikade!', 'Aus den Kellern, Brüder! Jetzt!'],
  flucht: ['Rückzug! In den Untergrund!', 'Das ist nicht das Ende, Alexander! Wir sehen uns unter der Stadt!', 'Zur Station Nordstern, Genossen!'],
  besiegt: ['Ihr könnt einen Mann einsperren … aber keine Idee!', 'Das … war nicht … das letzte Wort …', 'Verflucht seist du und dein Kristall!'],
  polizei: ['Den Roten Kasimir! Herr Alexander, das kommt morgen in alle Zeitungen!', 'Endlich! Seit Monaten jagen wir ihn. Danke, Herr Alexander!', 'Der Rote Kasimir in Handschellen … das glaubt mir auf dem Revier keiner.'],
  jubel: ['Sie haben den Roten Kasimir gefasst!', 'Hoch lebe Alexander! Die Bande ist erledigt!', 'Vespera ist wieder sicher!'],
};
const ksay = (k, prio = 2) => { const pd = BOSS.pd, G = pd && pd.gg; return gegnerSay('Der Rote Kasimir', pick(KSAY[k]), prio, G ? G.x : undefined, G ? G.z : undefined); };

/* ---------- Dynamitbündel und Geldsack (lose Körper) ---------- */
function kinds() {
  const K = KINDS_OF(); if (K.dynamit) return;
  GEOS.dynamit = () => {
    const P = [];
    for (const [dx, dz] of [[-0.03, 0], [0.03, 0], [0, 0.05]]) P.push([new T.CylinderGeometry(0.026, 0.026, 0.21, 8).translate(dx, 0, dz - 0.016), [0.62, 0.1, 0.07]]);
    P.push([new T.CylinderGeometry(0.058, 0.058, 0.03, 10).scale(1, 1, 0.85).translate(0, 0.05, 0), [0.25, 0.2, 0.14]], [new T.CylinderGeometry(0.058, 0.058, 0.03, 10).scale(1, 1, 0.85).translate(0, -0.05, 0), [0.25, 0.2, 0.14]]);
    P.push([new T.CylinderGeometry(0.006, 0.006, 0.12, 4).rotateZ(0.4).translate(0.02, 0.15, 0), [0.75, 0.68, 0.5]]);
    return mergeColored(P);
  };
  K.dynamit = { name: 'Dynamit', kind: 'box', he: [0.06, 0.105, 0.05], m: 1.4, stuff: 'paper', small: true };
  GEOS.geldsack = () => mergeColored([
    [new T.SphereGeometry(0.2, 12, 9).scale(1, 1.15, 0.9), [0.58, 0.5, 0.36]],
    [new T.CylinderGeometry(0.05, 0.08, 0.08, 8).translate(0, 0.24, 0), [0.5, 0.43, 0.3]],
    [new T.TorusGeometry(0.055, 0.012, 6, 10).rotateX(Math.PI / 2).translate(0, 0.21, 0), [0.75, 0.6, 0.3]],
    [new T.CylinderGeometry(0.202, 0.202, 0.05, 12).scale(1, 1, 0.9).translate(0, 0.02, 0), [0.72, 0.56, 0.24]],
  ]);
  K.geldsack = { name: 'Geldsack', kind: 'ball', he: [0.2, 0.22, 0.2], m: 9, stuff: 'leather', small: false };
}
export function dynamitGeo() { kinds(); return GEOS.dynamit(); }
export function geldsackGeo() { kinds(); return GEOS.geldsack(); }

// Dynamit von (x, y, z) zum Ziel (tx, ty, tz) werfen; Zündschnur fuse Sekunden
export function throwDynamit(x, y, z, tx, ty, tz, fuse = 3.2) {
  kinds();
  const B = spawnProp('dynamit', x, y - 0.1, z, Math.random() * 6.28); if (!B) return null;
  const d = Math.hypot(tx - x, tz - z), Tt = Math.max(0.6, Math.min(1.6, d / 13));
  B.v.set((tx - x) / Tt, (ty - y) / Tt + 4.9 * Tt, (tz - z) / Tt); B.awake = true;
  if (B.w) B.w.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
  const D = { B, t: fuse, tk: false };
  BOSS.dyn.push(D); BOSS.stats.dynamit++;
  GEG.snd('woosh', x, z, 0.6);
  return D;
}
function updateDynamit(dt) {
  for (let i = BOSS.dyn.length - 1; i >= 0; i--) {
    const D = BOSS.dyn[i], B = D.B;
    if (LOOSE.bodies.indexOf(B) < 0) { BOSS.dyn.splice(i, 1); continue; }
    D.t -= dt;
    if (Math.random() < dt * 40) fxEmit('spark', B.x.x, B.x.y + 0.16, B.x.z, 0, 1.4, 0, 1, 0.03, 0.7);
    if ((D.snd = (D.snd || 0) - dt) <= 0) { D.snd = 0.25; GEG.snd('fuse', B.x.x, B.x.z, 1.2); }
    if (LOOSE.tk === B && !D.tk) { D.tk = true; BOSS.stats.zurueck++; toast('Dynamit! Zurück zu Kasimir damit · Linksklick schleudert'); }
    const gy = groundAt(B.x.x, B.x.z, B.x.y);
    if (gy === null && B.x.y < -1.2 && !(UNTER.test && UNTER.test(B.x))) { fxEmit('steam', B.x.x, -1.4, B.x.z, 0, 1.2, 0, 8, 0.4, 1); GEG.snd('fizz', B.x.x, B.x.z, 1); end(); continue; }   // ins Wasser: aus
    if (D.t <= 0) {
      const x = B.x.x, y = B.x.y, z = B.x.z;
      end();
      const dP = gegFireball(x, y, z, 0.7, gy !== null);
      gegBlastAround(x, y, z, 5.5, 0.9);
      if (gy !== null && y - gy.y < 1) GEG.scorch(x, gy.y, z);
      if (dP < 3) toast('Das Dynamit zerplatzt an Alexander · nicht ein Kratzer');
    }
    function end() { if (LOOSE.tk === B) LOOSE.tk = null; if (LOOSE.held === B) LOOSE.held = null; dropBody(B); BOSS.dyn.splice(i, 1); }
  }
}

/* ---------- Kasimir ---------- */
export function bossPd() { return BOSS.pd || (BOSS.pd = GEGNER.list.find(pd => pd.gg.role === 'boss') || null); }
export function bossFree() { const pd = bossPd(); return BOSS.st === 'frei' && pd && pd.gg.s === 'off' && pd.a && !pd.rag; }
// erscheint bei (x, y, z); E = Ereignis (onDown, label …); o.anchor: bleibt in der Nähe; o.intro: erst eine Rede
export function bossSpawn(x, y, z, yaw, E, o = {}) {
  const pd = bossPd(); if (!pd || !pd.a) return null;
  GEG.spawn(pd, x, y, z, yaw);
  const G = pd.gg;
  Object.assign(G, { ev: E, boss: true, tough: true, hp: BOSS.maxHp, lead: true, gun: true, want: o.want || 12, anchor: o.anchor || null,
    cd: 2.5, dcd: 4 + Math.random() * 2, dodge: 0, said: 3, orb: Math.random() < 0.5 ? 1 : -1, hold: 0, shotN: 0, ai: bossAI, onUp: bossUp, called: false, fled: false });
  G.s = o.intro ? 'script' : 'fight';
  if (o.intro) { GEG.act(pd, 3.7); G.introT = o.intro; }
  BOSS.stats.gestellt++;
  return pd;
}
function bossUp(pd) {
  const G = pd.gg;
  ksay('getroffen');
  const E = G.ev;
  if (E && E.bossUp) E.bossUp(pd);
}
function bossAI(pd, dt, dAlex) {
  const G = pd.gg, p = player.p;
  G.cd -= dt; G.dcd -= dt; G.dodge -= dt;
  if (G.dash) {   // zur Seite springen
    G.dash.t -= dt; GEG.gait(pd, 'run', 8); GEG.step(pd, G.dash.x, G.dash.z, 8.5, dt);
    if (G.dash.t <= 0 || G.stuck > 0.4) G.dash = null;
    return;
  }
  // dem aufgeladenen Energieschub ausweichen (nicht jedes Mal)
  if (BLAST.st === 'charge' && dAlex < 26 && G.dodge <= 0) {
    G.dodge = 5 + Math.random() * 3;
    if (Math.random() < 0.7) {
      const ax = G.x - p.x, az = G.z - p.z, L = Math.hypot(ax, az) || 1, sd = Math.random() < 0.5 ? 1 : -1;
      G.dash = { x: G.x + (-az / L) * 3.8 * sd, z: G.z + (ax / L) * 3.8 * sd, t: 0.55 };
      if (Math.random() < 0.6) ksay('ausweichen', 1);
      return;
    }
  }
  if (G.hold > 0) {
    G.hold -= dt; GEG.face(pd, p.x, p.z, dt, 12);
    if (G.throwIn > 0 && (G.throwIn -= dt) <= 0) {
      const hx = G.x + Math.sin(G.yaw) * 0.4 + Math.cos(G.yaw) * 0.25, hz = G.z + Math.cos(G.yaw) * 0.4 - Math.sin(G.yaw) * 0.25;
      throwDynamit(hx, G.y + 1.9, hz, p.x + (Math.random() - 0.5) * 2.4, p.y + 0.2, p.z + (Math.random() - 0.5) * 2.4, 2.6 + Math.random() * 0.8);
    }
    if (G.shotN > 0 && (G.shotT -= dt) <= 0) { G.shotN--; G.shotT = 0.3; GEG.shot(pd); }
    if (G.hold <= 0) GEG.act(pd, 13.1);
    return;
  }
  // Abstand halten, um Alexander kreisen; an der Barrikade bleiben, solange er nicht zu nahe kommt
  const An = G.anchor, dA = An ? Math.hypot(G.x - An.x, G.z - An.z) : 0, want = G.want;
  if (An && dA > An.r && dAlex > 8) { GEG.gait(pd, 'run', 3.8); GEG.step(pd, An.x, An.z, 3.8, dt); }
  else if (dAlex > want + 5 && !An) { GEG.gait(pd, 'run', 4); GEG.step(pd, p.x, p.z, 4, dt); }
  else if (dAlex < want - 5) { const ax = G.x - p.x, az = G.z - p.z, L = Math.hypot(ax, az) || 1; GEG.gait(pd, 'run', 3.4); GEG.step(pd, G.x + ax / L * 3, G.z + az / L * 3, 3.4, dt); if (G.stuck > 0.8) { G.orb = -G.orb; G.stuck = 0; } }
  else if (!An) {
    if (Math.random() < dt * 0.15) G.orb = -G.orb;
    const a = Math.atan2(G.x - p.x, G.z - p.z) + G.orb * 0.45;
    GEG.gait(pd, 'walk', 1.7); GEG.step(pd, p.x + Math.sin(a) * want, p.z + Math.cos(a) * want, 1.7, dt);
    if (G.stuck > 0.8) { G.orb = -G.orb; G.stuck = 0; }
  } else { GEG.face(pd, p.x, p.z, dt); if (G.gm !== 'stand') GEG.act(pd, 13.1); }
  // Angriffe: Dynamit auf mittlere Entfernung, sonst zwei Schüsse
  if (p.y - G.y < 30) {
    if (G.dcd <= 0 && dAlex > 6 && dAlex < 28) { G.dcd = 6 + Math.random() * 3.5; G.cd = Math.max(G.cd, 1.2); GEG.act(pd, 6.6); G.throwIn = 0.4; G.hold = 0.9; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); if (Math.random() < 0.7) ksay('dynamit', 1); return; }
    if (G.cd <= 0 && dAlex < 36) { G.cd = 2 + Math.random() * 1.6; GEG.act(pd, 4.3); G.shotN = 2; G.shotT = 0.12; G.hold = 0.8; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); return; }
  }
  if ((G.said -= dt) <= 0) { G.said = 7 + Math.random() * 4; ksay(GEGNER.abprall > 0 && Math.random() < 0.3 ? 'getroffen' : 'kampf', 0); }
}
// halb besiegt: Genossen zu Hilfe rufen (bis zu drei, aus 18 bis 28 m)
function bossCall(E, n = 3) {
  const pd = BOSS.pd, G = pd.gg; if (G.called) return; G.called = true;
  ksay('rufen');
  const A = GEG.free('anarchist').slice(0, n);
  for (const a of A) {
    const s = GEG.spot(G.x, G.z, 14, 26, true); if (!s) continue;
    GEG.spawn(a, s.x, s.y, s.z, Math.atan2(player.p.x - s.x, player.p.z - s.z));
    Object.assign(a.gg, { ev: E, s: 'fight', gun: Math.random() < 0.3, cd: 1 + Math.random() * 2, want: 9 + Math.random() * 5 });
    E.crooks.push(a);
  }
}
// Kasimir ist endgültig besiegt: Polizei holt ihn (gegner.js), hier nur Worte und Jubel
function bossDown(pd, E) {
  const G = pd.gg;
  if (G.hp > 0) {   // nur umgeworfen: steht gleich wieder auf
    if (G.hp === 2 && E && E.crooks) bossCall(E, MOBILE ? 2 : 3);
    return false;
  }
  ksay('besiegt', 3);
  return true;
}
// Festnahme fertig (gegner.js meldet 'gefasst')
function onGefasst(d) {
  if (!d.boss) return;
  BOSS.st = 'gefasst'; BOSS.jailT = 0; BOSS.stats.gefasst++; bossSave();
  setTimeout(() => { toast('Der Rote Kasimir ist gefasst! Die Bande hat keinen Anführer mehr'); gegnerSay('Ein Polizist', pick(KSAY.polizei), 3); }, 400);
  setTimeout(() => { aweBurst('throw', 50, 1); gegnerSay('Ein Passant', pick(KSAY.jubel), 1); }, 3600);
  GEG.fire('boss', BOSS.pd, d.x, d.z);
  news('Der Rote Kasimir gefasst!', 'Alexander stellt den Anführer der Anarchisten. Die Polizei führt Kasimir Roth in Handschellen ab; die Bande ist führerlos.', 9);
  if (BOSS.onCaught) BOSS.onCaught();
}

/* ---------- Großer Angriff: Barrikade quer über die Straße ---------- */
const BARR_KINDS = ['barrel', 'crate', 'dustbin', 'coalsack', 'trunk', 'winecrate', 'barrel', 'milkcan', 'crate'];
function evAufstand() {
  const p = player.p, A = GEG.free('anarchist'); if (A.length < (MOBILE ? 4 : 5)) return null;
  // Platz für die Barrikade: Straße 30 bis 48 m entfernt, vorn und hinten frei
  let c = null;
  for (let i = 0; i < 12 && !c; i++) {
    const s = GEG.spot(p.x, p.z, 30, 48, false); if (!s) continue;
    const g = groundAt(s.x, s.z, 1.2); if (!g || !g.road) continue;
    const ux = (p.x - s.x), uz = (p.z - s.z), L = Math.hypot(ux, uz);
    let ok = true; for (const k of [-4, -2, 2, 4]) if (GEG.blocked(s.x - uz / L * k, s.z + ux / L * k, s.y, 0.4)) { ok = false; break; }
    if (ok) c = s;
  }
  if (!c) return null;
  const ux0 = p.x - c.x, uz0 = p.z - c.z, L0 = Math.hypot(ux0, uz0), ux = ux0 / L0, uz = uz0 / L0, tx = -uz, tz = ux;
  const E = { label: 'Aufstand der Anarchisten · Barrikade', crooks: [], ph: 'build', props: [], anchor: { x: c.x - ux * 2.5, z: c.z - uz * 2.5 } };
  // Barrikade: lose Dinge (Telekinese reißt sie auseinander), zwei Feuer darauf
  for (let k = -4; k <= 4; k++) {
    const kind = BARR_KINDS[(k + 4 + Math.floor(Math.random() * 3)) % BARR_KINDS.length], x = c.x + tx * k * 0.95 + (Math.random() - 0.5) * 0.3, z = c.z + tz * k * 0.95 + (Math.random() - 0.5) * 0.3;
    const B = spawnProp(kind, x, c.y, z, Math.atan2(tx, tz) + (Math.random() - 0.5) * 0.6); if (B) E.props.push(B);
    if (Math.abs(k) < 3 && Math.random() < 0.5) { const B2 = spawnProp(Math.random() < 0.5 ? 'crate' : 'coalsack', x, c.y + 0.9, z, Math.random() * 6); if (B2) E.props.push(B2); }
  }
  for (const k of [-2.5, 1.5]) GEG.fires().push({ x: c.x + tx * k, y: c.y + 0.9, z: c.z + tz * k, t: 0, life: 45 });
  // Anarchisten hinter der Barrikade
  const n = Math.min(A.length, MOBILE ? 4 : 6 + (Math.random() < 0.5 ? 1 : 0));
  for (let i = 0; i < n; i++) {
    const side = (i - (n - 1) / 2) * 1.5, s = { x: c.x - ux * (1.6 + Math.random() * 1.5) + tx * side, z: c.z - uz * (1.6 + Math.random() * 1.5) + tz * side };
    const g = groundAt(s.x, s.z, 1.2); if (!g || GEG.blocked(s.x, s.z, g.y, 0.35)) continue;
    const pd = A[i]; GEG.spawn(pd, s.x, g.y, s.z, Math.atan2(ux, uz));
    Object.assign(pd.gg, { ev: E, s: 'fight', gun: i === 1 || i === 4, cd: 1.5 + i * 0.6, want: 14, anchor: { x: s.x, z: s.z, r: 1.6, loose: 7 }, lead: false });
    E.crooks.push(pd);
  }
  if (E.crooks.length < 3) { for (const pd of E.crooks) GEG.off(pd); for (const B of E.props) dropBody(B); return null; }
  // Kasimir (wenn er frei ist und nicht unten in seinem Hauptquartier wartet), sonst ein Unterführer mit erhobener Faust
  if (bossFree() && !BOSS.inHQ) {
    const s = { x: E.anchor.x - ux * 1.5, z: E.anchor.z - uz * 1.5 }, g = groundAt(s.x, s.z, 1.2);
    if (g) { bossSpawn(s.x, g.y, s.z, Math.atan2(ux, uz), E, { intro: 3.2, anchor: { x: s.x, z: s.z, r: 2 }, want: 14 }); E.boss = BOSS.pd; E.label = 'Aufstand · Der Rote Kasimir an der Barrikade'; }
  }
  if (!E.boss) { const L = E.crooks[0]; L.gg.lead = true; GEG.act(L, 3.7); }
  E.where = () => [c.x, c.z];
  GEG.panic(c.x, c.z, 34, false);
  toast(E.boss ? 'Aufstand! Der Rote Kasimir hat eine Barrikade errichtet' : 'Aufstand! Anarchisten haben eine Barrikade errichtet');
  E.onDown = (pd, how) => {
    if (pd === E.boss) { bossDown(pd, E); return; }
    E.downs = (E.downs || 0) + 1;
    if (!E.broken && E.downs >= Math.ceil(E.crooks.length * 0.75)) { E.broken = true; for (const q of E.crooks) if (q.gg.s === 'fight') { q.gg.s = 'flee'; q.gg.fleeT = 0; q.gg.anchor = null; } const L = E.crooks.find(q => q.gg.s === 'flee'); if (L) gegnerSay('Ein Anarchist', GEG.line('anarFlucht'), 2, L.gg.x, L.gg.z); }
  };
  E.bossUp = pd => {
    const G = pd.gg;
    if (G.hp <= 1 && !G.fled) {   // letzte Kraft: Flucht in den Untergrund
      G.fled = true; G.ai = null; G.s = 'flee'; G.fleeT = 0; G.noShoot = true; G.spd = 6.4; G.anchor = null;
      ksay('flucht', 3);
      toast('Kasimir flieht! Wirf ihn um, bevor er in den Untergrund entkommt');
    }
  };
  E.step = dt => {
    const B = E.boss;
    if (E.ph === 'build') {
      if (B && B.gg.s === 'script') { GEG.face(B, player.p.x, player.p.z, dt); GEG.place(B); if ((B.gg.introT -= dt) <= 0) { B.gg.s = 'fight'; GEG.act(B, 13.1); } }
      if (E.t > 0.4 && !E.introSaid) { E.introSaid = true; if (B) ksay('intro', 3); else gegnerSay('Der Anführer', GEG.line('anarParole'), 2, c.x, c.z); }
      if (E.t > 3.4) { E.ph = 'fight'; if (!B) GEG.act(E.crooks[0], 13.1); }
    }
    // Kasimir entkommen (flieht und verschwindet): verrät sein Hauptquartier
    if (B && B.gg.s === 'off' && !E.bossGone) {
      E.bossGone = true;
      if (B.gg.fled || B.gg.hp > 0) { BOSS.stats.entkommen++; bossSave(); toast('Kasimir ist in den Untergrund entkommen'); news('Barrikade gestürmt, Kasimir entkommen', 'Alexander zerschlägt den Aufstand der Anarchisten. Ihr Anführer, der Rote Kasimir, flieht in den Untergrund.', 6); if (BOSS.onEscape) setTimeout(() => BOSS.onEscape('aufstand'), 2500); }
    }
    const busy = E.crooks.some(pd => pd.gg.s === 'fight' || pd.gg.s === 'flee' || pd.gg.s === 'script' || pd.gg.s === 'getup') || (B && B.gg.s !== 'off' && B.gg.s !== 'rise' && B.gg.s !== 'led' && !(B.gg.s === 'down' && !(B.gg.hp > 0)));   // liegt Kasimir nur kurz, geht es weiter
    if (!busy && E.t > 5) GEG.end(E);
    if (E.t > 200) { for (const pd of E.crooks) if (pd.gg.s !== 'down' && pd.gg.s !== 'led') GEG.off(pd); if (B && (B.gg.s === 'fight' || B.gg.s === 'flee')) GEG.off(B); GEG.end(E); }
  };
  E.type = 'aufstand';
  return E;
}

/* ---------- Bombenserie: drei Bomben zugleich ---------- */
function evBombenserie() {
  const p = player.p, A = GEG.free('anarchist'); if (A.length < 3) return null;
  const cands = DOORS.filter(d => { const dd = Math.hypot(d.x - p.x, d.z - p.z); return dd > 35 && dd < 120 && d.kind !== 'house'; });
  const spots = [];
  for (let i = 0; i < 40 && spots.length < 3 && cands.length; i++) {
    const d = cands[Math.floor(Math.random() * cands.length)], bx = d.x + d.nx * 1.4, bz = d.z + d.nz * 1.4, g = groundAt(bx, bz, 1.2);
    if (!g || g.y > 0.6 || g.y < -0.3 || GEG.blocked(bx, bz, g.y, 0.3)) continue;
    if (spots.some(s => Math.hypot(s.x - bx, s.z - bz) < 25)) continue;
    spots.push({ x: bx, y: g.y, z: bz, d });
  }
  if (spots.length < 3) return null;
  const E = { label: 'Bombenserie · 3 Bomben', crooks: [], bombs: [], ph: 'tick' };
  spots.forEach((s, i) => {
    const bm = GEG.plantBomb(s.x, s.y, s.z, (MOBILE ? 75 : 62) + i * 6); if (!bm) return;
    bm.x0 = s.x; bm.z0 = s.z; E.bombs.push(bm);
    const a = A[i], g = GEG.spot(s.x, s.z, 3, 6, false); if (!a || !g) return;
    GEG.spawn(a, g.x, g.y, g.z, Math.atan2(g.x - s.x, g.z - s.z)); Object.assign(a.gg, { ev: E, s: 'flee', fleeT: 0, noShoot: true }); E.crooks.push(a);
  });
  if (E.bombs.length < 2) return null;
  E.where = () => { const b = E.bomb; return b ? [b.x, b.z] : [p.x, p.z]; };
  toast(E.bombs.length + ' Bomben in der Stadt! Findet sie, bevor die Zündschnüre abgebrannt sind');
  gegnerSay('Ein Passant', 'Bomben! Überall Bomben! Die Anarchisten!', 2);
  E.onDown = () => {};
  E.step = () => {
    const P = player.p, left = E.bombs.filter(b => !b.done);
    E.bomb = left.sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0] || null;
    E.label = left.length ? 'Bombenserie · noch ' + left.length + (left.length === 1 ? ' Bombe' : ' Bomben') : 'Bombenserie vorbei';
    if (!left.length && !E.doneT) {
      E.doneT = E.t; const ok = E.bombs.filter(b => b.result !== 'knall').length;
      toast(ok === E.bombs.length ? 'Alle Bomben entschärft! Vespera ist gerettet' : ok + ' von ' + E.bombs.length + ' Bomben entschärft');
      if (ok === E.bombs.length) aweBurst('throw', 60, 0.8);
      news(ok === E.bombs.length ? 'Bombenserie vereitelt' : 'Bomben erschüttern die Stadt', ok + ' von ' + E.bombs.length + ' Bomben der Anarchisten wurden rechtzeitig unschädlich gemacht.', ok === E.bombs.length ? 7 : 6);
    }
    if (E.doneT && E.t - E.doneT > 3 && !E.crooks.some(pd => pd.gg.s === 'flee')) GEG.end(E);
    if (E.t > 160) GEG.end(E);
  };
  E.type = 'bombenserie';
  return E;
}

/* ---------- Bankraub: drei Räuber stürmen aus der Vespera-Bank ---------- */
function bankDoor() { const Bk = ORTE.bank; if (!Bk) return null; return { x: Bk.x1 + 4.2, z: Bk.cz, nx: 1, nz: 0 }; }
function evBankraub() {
  const D = bankDoor(), p = player.p; if (!D) return null;
  const R = GEG.free('raeuber'); if (R.length < 3) return null;
  const dd = Math.hypot(D.x - p.x, D.z - p.z); if (dd < 15 || dd > 230) return null;
  const E = { label: 'Bankraub bei der Vespera-Bank', crooks: [], ph: 'run', got: 0 };
  for (let i = 0; i < 3; i++) {
    const x = D.x + 1 + Math.random() * 2, z = D.z + (i - 1) * 1.6, g = groundAt(x, z, 1.2); if (!g) continue;
    const r = R[i]; GEG.spawn(r, x, g.y, z, Math.PI / 2 + (i - 1) * 0.5);
    // jeder läuft in eine andere Richtung davon, schießt, wenn Alexander ihn stellt; umgeworfen verliert er den Geldsack
    Object.assign(r.gg, { ev: E, s: 'flee', fleeT: 0, spd: 5.8, bag: true });
    r.gg.fl = [x + Math.cos((i - 1) * 0.9) * 10, z + Math.sin((i - 1) * 0.9) * 10]; r.gg.flT = 1.2;
    E.crooks.push(r);
  }
  if (E.crooks.length < 2) { for (const r of E.crooks) GEG.off(r); return null; }
  E.where = () => { let x = 0, z = 0, m = 0; for (const r of E.crooks) if (r.gg.s === 'flee') { const P = GEG.pos(r); x += P[0]; z += P[1]; m++; } return m ? [x / m, z / m] : [D.x, D.z]; };
  E.bellT = 6;
  gegnerSay('Der Wachmann', pick(['Überfall! Die Bank wird ausgeraubt!', 'Haltet sie! Sie haben die Kasse!', 'Alarm! Alarm! Räuber!']), 3, D.x, D.z);
  toast('Bankraub! Drei Räuber fliehen mit Geldsäcken aus der Vespera-Bank');
  GEG.panic(D.x, D.z, 26, false);
  E.onDown = pd => {
    const G = pd.gg; if (!G.bag) return;
    G.bag = false; kinds();
    const [x, z] = GEG.pos(pd), g = groundAt(x, z, G.y + 1);
    const B = spawnProp('geldsack', x + 0.5, (g ? g.y : G.y) + 0.3, z, Math.random() * 6); if (B) { B.v.set((Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2); B.awake = true; BOSS.bags.push({ B, t: 0 }); }
    fxEmit('crystal', x, (g ? g.y : G.y) + 0.6, z, 0, 1.2, 0, 10, 0.4, 0.8);
    E.got++;
  };
  E.step = dt => {
    if ((E.bellT -= dt) > 0 && SND.on && SND.ctx && (E.ring = (E.ring || 0) - dt) <= 0) { E.ring = 0.5; try { const t = SND.ctx.currentTime, k = Math.max(0, 1 - Math.hypot(D.x - player.p.x, D.z - player.p.z) / 160); for (let i = 0; i < 4; i++) sndTone(1650, t + i * 0.09, 0.08, 0.05 * k, 'square', 'sfx', 1500); } catch (e) { /* Ton ist Beiwerk */ } }
    const busy = E.crooks.some(r => r.gg.s === 'flee' || r.gg.s === 'fight');
    if (!busy && E.t > 3 && !E.over) {
      const lost = E.crooks.filter(r => r.gg.s === 'off' && r.gg.bag).length;
      news(E.got ? 'Bankraub vereitelt' : 'Bankräuber entkommen', E.got ? E.got + ' Geldsäcke der Vespera-Bank sind dank Alexander wieder da.' : 'Drei Räuber flohen mit der Beute aus der Vespera-Bank.', E.got ? 6 : 5);
      toast(E.got ? (E.got === E.crooks.length ? 'Alle Geldsäcke zurück! Die Vespera-Bank dankt Herrn Alexander' : E.got + ' von ' + E.crooks.length + ' Geldsäcken gerettet') : 'Die Bankräuber sind mit der Beute entkommen');
      GEG.end(E);
    }
  };
  E.type = 'bankraub';
  return E;
}
// Geldsäcke: nach einer Weile (weit weg) wieder fort
function updateBags(dt) {
  for (let i = BOSS.bags.length - 1; i >= 0; i--) {
    const S = BOSS.bags[i]; S.t += dt;
    if (LOOSE.bodies.indexOf(S.B) < 0) { BOSS.bags.splice(i, 1); continue; }
    if (S.t > 90 && Math.hypot(S.B.x.x - player.p.x, S.B.x.z - player.p.z) > 60 && LOOSE.tk !== S.B && LOOSE.held !== S.B) { dropBody(S.B); BOSS.bags.splice(i, 1); }
  }
}

/* ---------- Anzeige oben: Kasimirs Kraft ---------- */
function bossHud() {
  const pd = BOSS.pd, G = pd && pd.gg;
  const on = G && G.s !== 'off' && G.boss && G.hp > 0 && Math.hypot(G.x - player.p.x, G.z - player.p.z) < 90 && Math.abs(G.y - player.p.y) < 40;
  let el = BOSS.hud;
  if (!on) { if (el && el.style.opacity !== '0') el.style.opacity = 0; return; }
  if (!el) {
    const st = document.createElement('style');
    st.textContent = '#bossbar{position:fixed;z-index:9;left:50%;top:calc(96px + env(safe-area-inset-top,0px));transform:translateX(-50%);padding:5px 16px 7px;background:var(--panel,rgba(5,16,24,.82));border:1px solid rgba(200,60,45,.75);color:var(--ink,#efe6d2);font-size:12px;letter-spacing:.22em;text-align:center;pointer-events:none;opacity:0;transition:opacity .4s;min-width:220px}#bossbar b{display:block;color:#f2a27e;font-weight:600;margin-bottom:4px}#bossbar i{display:inline-block;width:38px;height:6px;margin:0 3px;background:rgba(240,200,140,.15);border:1px solid rgba(214,174,96,.55);transform:skewX(-20deg)}#bossbar i.on{background:linear-gradient(90deg,#b8322a,#e8704a)}';
    document.head.appendChild(st);
    el = BOSS.hud = document.createElement('div'); el.id = 'bossbar'; el.className = 'hud'; document.body.appendChild(el);
    el.innerHTML = '<b>DER ROTE KASIMIR</b>' + '<i></i>'.repeat(BOSS.maxHp);
  }
  const bars = el.querySelectorAll('i');
  bars.forEach((b, i) => { const want = i < G.hp; if (b.classList.contains('on') !== want) b.classList.toggle('on', want); });
  el.style.opacity = 1;
}

/* ---------- Jedes Bild (über GEGNER.hooks aus updateGegner) ---------- */
function update(dt) {
  if (!pedCrowd) return;
  bossPd();
  updateDynamit(dt); updateBags(dt);
  // Gefängnis: nach 25 Minuten Spielzeit bricht er aus
  if (BOSS.st === 'gefasst' && (BOSS.jailT += dt) > JAIL) {
    BOSS.st = 'frei'; BOSS.jailT = 0; bossSave();
    toast('Der Rote Kasimir ist aus dem Gefängnis ausgebrochen! Die Bande sammelt sich wieder');
    news('Ausbruch! Kasimir wieder frei', 'Der Anführer der Anarchisten ist aus dem Gefängnis entkommen. Die Polizei warnt vor neuen Anschlägen.', 8);
    if (BOSS.onBreakout) BOSS.onBreakout();
  }
  if ((BOSS.saveT = (BOSS.saveT || 0) - dt) <= 0) { BOSS.saveT = 20; if (BOSS.st === 'gefasst') bossSave(); }
  bossHud();
}
GEGNER.hooks.push(update);
GEGNER.listen.push(d => { if (d.was === 'gefasst') onGefasst(d); });
Object.assign(EV_EXTRA, {
  aufstand: { make: evAufstand, w: () => bossFree() && !BOSS.inHQ ? 1.2 : 0.7, ok: () => GEG.free('anarchist').length >= (MOBILE ? 4 : 5) },
  bombenserie: { make: evBombenserie, w: 0.7, ok: () => GEG.free('anarchist').length >= 3 },
  bankraub: { make: evBankraub, w: 1.4, ok: () => { const D = bankDoor(); if (!D) return false; const d = Math.hypot(D.x - player.p.x, D.z - player.p.z); return d > 15 && d < 230 && GEG.free('raeuber').length >= 3; } },
});
EV_TYPES.push('aufstand', 'bombenserie', 'bankraub');
export { bossDown, bossCall, ksay };
