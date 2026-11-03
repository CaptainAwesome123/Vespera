/* =====================================================================
   V60 · GEGNER: ANARCHISTEN UND RÄUBER
   Nicht alle in Vespera lieben den Herrn der Stadt. Eine Untergrund-Bande
   von Anarchisten will Alexander stürzen ("Nieder mit Alexander! Vespera
   gehört dem Volk!"), und wie in jeder Großstadt gibt es Räuber und
   Taschendiebe. Ab und zu passiert in Alexanders Nähe etwas:
   - Überfall: ein Räuber bedroht einen Passanten (Hände hoch). Kommt
     Alexander, flieht er und schießt im Notfall: die Kugeln prallen ab.
   - Taschendieb: rempelt jemanden an und rennt mit der Geldbörse davon.
   - Bombe: Anarchisten legen vor einem Haus eine Bombe mit brennender
     Zündschnur und verschwinden. Alexander packt sie mit Telekinese (oder
     trägt sie) und wirft sie hoch in den Himmel oder ins Wasser.
   - Angriff: eine Gruppe Anarchisten stellt Alexander auf der Straße und
     wirft Steine und Flaschen, einer schießt mit dem Revolver. Alles prallt
     ab; Alexander wirft sie mit Energieschub, Telekinese, Heldenlandung,
     Wucht im Flug oder einfach im Vorbeigehen um.
   Wer am Boden liegt, ist besiegt: die Polizei kommt angelaufen, liest ihn
   auf und führt ihn ab. Die Leute klatschen, das Opfer bedankt sich.
   Oben in der Mitte zeigt ein Hinweis, wo etwas los ist (Richtung, Abstand,
   Zündschnur). Taste J: sofort das nächste Ereignis (zum Ausprobieren);
   ?gegner=aus schaltet die Gegner ab.
   Schonend für die Grafikkarte: die Figuren sind normale Passanten aus dem
   vorhandenen Bestand (keine neuen Shader, keine neuen Lichter), die Würfe
   nutzen das Material der losen Dinge, die Bombe ist ein loser Körper.
   Für den Energieschub und andere Kräfte: gegnerTreffer(x, y, z, r, k, dx, dz)
   wirft alle Gegner im Umkreis um; jeder Fußgänger, den knockDown oder ein
   geworfenes Ding umwirft, zählt ohnehin als getroffen.
   ===================================================================== */
import { T, MOBILE, scene, camera, shared, $, canvasTex } from './core.js';
import { player } from './player.js';
import { peds, pedCrowd, setAct, turnHead, COATS, WORKWEAR } from './serpentine.js';
import { knockDown, ragFree } from './ragdoll.js';
import { groundAt } from './driving.js';
import { nearBoxes, mergeColored } from './people-skeleton.js';
import { DOORS } from './entrances.js';
import { LOOSE, GEOS, KINDS_OF, spawnProp, dropBody, propMaterial } from './physics.js';
import { fxEmit } from './particles.js';
import { POWERS } from './powers.js';
import { aweBurst, whoOf } from './awe.js';
import { toast, BOAT } from './boat.js';
import { DRIVE } from './eating.js';
import { DINE } from './venues.js';
import { WATER_Y } from './dance.js';
import { SND, sndBurst, sndTone, sndClip } from './audio.js';
import { UNTER } from './unter-hook.js';   // V61: Verstecke unter der Stadt

export const GEGNER = { list: [], ev: null, nextT: 75, on: true, cycle: 0, proj: [], fires: [], arrests: [], bombs: [], scorch: [], hud: null, sayT: 0, hitT: 0, heroSeen: null,
  stats: { gefasst: 0, entkommen: 0, entschaerft: 0, explodiert: 0, ereignisse: 0 },
  hooks: [], spotHook: null, block: false };   // V61: hooks = weitere Abläufe je Bild (anfuehrer.js, verstecke.js); spotHook = Auftauchorte unter der Stadt
const GST = 11;   // Zustand in peds: wird von gegner.js bewegt (updatePedestrians lässt ihn aus)
const HALF_PI = Math.PI / 2;
const gegWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const gegPick = a => a[Math.floor(Math.random() * a.length)];
const _gd = new T.Vector3();

/* ---------- Sätze ---------- */
const GSAY = {
  raubDroh: ['Geld her, aber flott!', 'Brieftasche, Uhr, alles! Und keinen Mucks!', 'Hände hoch, feiner Herr!', 'Ganz ruhig … ich will nur dein Geld.', 'Schmuck her, oder es knallt!', 'Keine Polizei, verstanden?'],
  opferRuf: ['Hilfe! Ein Überfall!', 'Polizei! Hilfe!', 'Bitte, nehmen Sie alles, nur tun Sie mir nichts!', 'Hilfe! So hilft mir doch jemand!'],
  raubSieht: ['Verdammt, das ist Alexander! Nichts wie weg!', 'Der fliegende Kerl! Weg hier!', 'Mist! Der Herr von Vespera persönlich!', 'Alexander! Lauf!'],
  raubSchiess: ['Bleib mir vom Leib!', 'Noch einen Schritt und ich schieße!', 'Stirb endlich!', 'Was bist du … ein Gespenst?!', 'Die Kugeln … die prallen ab!'],
  opferHinterher: ['Haltet den Dieb! Er hat meine Brieftasche!', 'Mein Geld! Er läuft da lang!', 'Herr Alexander! Er entkommt!'],
  dieb: ['Meine Geldbörse! Haltet den Dieb!', 'Hey! Meine Uhr ist weg!', 'Ein Taschendieb! Dort, der Kerl mit der Mütze!', 'Meine Handtasche! Haltet ihn!'],
  diebRuf: ['Schönen Abend noch, die Herrschaften!', 'Danke für die Spende!', 'Wer zu langsam ist, zahlt.'],
  besiegt: ['Au! Schon gut, schon gut, ich ergebe mich!', 'Uff … was war das denn?', 'Ich geb auf! Ich geb auf!', 'Mein Kopf … die Sterne …', 'Nicht noch mal, bitte!', 'Das … das ist nicht fair!'],
  besiegtAnar: ['Ihr könnt uns nicht alle aufhalten!', 'Die Revolution vergisst nicht!', 'Verflucht seist du, Alexander!', 'Das war erst der Anfang!'],
  anarParole: ['Nieder mit Alexander!', 'Vespera gehört dem Volk!', 'Keine Götter, keine Herren!', 'Brecht die goldenen Türme!', 'Der Kristall macht ihn nicht zum König!', 'Freiheit statt Champagner!', 'Wir sind die Stadt, nicht er!', 'Für die Arbeiter! Gegen das Belmont!'],
  anarBombe: ['Die Zündschnur brennt. Und jetzt weg!', 'Ein Gruß an den Herrn von Vespera!', 'Lauft, Genossen! Lauft!', 'Wenn das knallt, hört es das ganze Belmont!'],
  anarAngriff: ['Da ist er! Auf ihn!', 'Zeigt ihm, wem die Stadt gehört!', 'Steine! Werft, was ihr habt!', 'Er ist auch nur ein Mensch!', 'Heute fällt der Herr von Vespera!'],
  anarAbprall: ['Es prallt einfach ab!', 'Er ist unverwundbar … ein Teufel!', 'Nichts hält ihn auf!', 'Rückzug! Rückzug!'],
  anarFlucht: ['Weg hier! Er ist zu stark!', 'Auseinander! Jeder für sich!', 'Wir kommen wieder, Alexander!'],
  polizei: ['Im Namen des Gesetzes, Sie sind verhaftet!', 'Mitkommen, Freundchen!', 'Das reicht jetzt. Hände auf den Rücken!', 'Ab aufs Revier mit dir!', 'Den nehmen wir mit.'],
  polizeiDank: ['Danke, Herr Alexander! Wir übernehmen.', 'Saubere Arbeit, Herr Alexander!', 'Ohne Sie wären wir aufgeschmissen, Herr Alexander.', 'Wir kümmern uns um den Rest, Herr Alexander.'],
  opferDank: ['Danke, Herr Alexander! Sie haben mich gerettet!', 'Mein Held! Das vergesse ich Ihnen nie!', 'Herr Alexander … ich weiß gar nicht, wie ich Ihnen danken soll!', 'Gott segne Sie, Herr Alexander!', 'Meine Brieftasche! Danke, danke, danke!'],
  opferVerloren: ['Weg ist er … und mein Geld auch.', 'Na wunderbar. Und jetzt?', 'So ein Schuft! Das ganze Wochengeld!'],
  zuschauerJubel: ['Bravo, Herr Alexander!', 'Der Halunke hat’s verdient!', 'Haben Sie das gesehen? Mit einer Hand!', 'Hoch lebe Alexander!', 'So geht man mit Gesindel um!', 'Drei Hurras für Herrn Alexander!'],
  zuschauerAngst: ['Eine Bombe! Alle weg hier!', 'Runter! Runter mit euch!', 'Holt die Polizei!', 'Mein Gott, sie schießen!', 'Weg von der Straße!'],
  bombeWeg: ['Er hat die Bombe weggeworfen! Wir sind gerettet!', 'Hoch in den Himmel! Was für ein Mann!', 'Ins Wasser damit! Bravo!', 'Puh … das war knapp.'],
  bombeKnall: ['Mein Gott! Ist jemand verletzt?', 'Die Fenster! Alles voller Scherben!', 'Diese verdammten Anarchisten!'],
};
const GWHO = { raeuber: 'Ein Räuber', dieb: 'Ein Taschendieb', anarchist: 'Ein Anarchist', anfuehrer: 'Der Anführer', polizei: 'Ein Polizist', boss: 'Der Rote Kasimir' };

// Sprechblase (dieselbe wie bei allen anderen Leuten). Ein Ereignis 'vespera-say' geht mit, damit eine Sprachausgabe mitlesen kann.
export function gegnerSay(who, text, prio = 1, x, z) {
  const el = $('say'); if (!el) return false;
  if (prio < 2 && shared.sayTimer > 0.6) return false;
  if (x !== undefined && prio < 3 && (x - player.p.x) ** 2 + (z - player.p.z) ** 2 > 48 * 48) return false;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + text + '“';
  el.style.opacity = 1; shared.sayTimer = 2.6 + text.length * 0.035;
  try { window.dispatchEvent(new CustomEvent('vespera-say', { detail: { who, text, x, z, src: 'gegner' } })); } catch (e) { /* ältere Browser */ }
  return true;
}
const gegLine = k => gegPick(GSAY[k]);
// V61: Bescheid an andere Teile des Spiels (Zeitung, Belohnungen, Verstecke): window-Ereignis 'vespera-gegner' { was, role, boss, x, z }
// was: 'besiegt' (liegt am Boden), 'gefasst' (Polizei führt ab), 'versteck' (ausgehoben), 'boss' (Anführer gefasst), 'entschaerft', 'knall'
export function gegFire(was, pd, x, z, extra) {
  const d = { was, role: pd && pd.gg ? pd.gg.role : null, boss: !!(pd && pd.gg && pd.gg.boss), x, z, ...(extra || {}) };
  for (const f of GEGNER.listen || []) { try { f(d); } catch (e) { /* weiter */ } }
  try { window.dispatchEvent(new CustomEvent('vespera-gegner', { detail: d })); } catch (e) { /* ältere Browser */ }
}

/* ---------- Figuren: werden in buildPedestrians vor dem Crowd-Aufbau angelegt ---------- */
export function gegnerPeds() {
  const DARK = [COATS[0], COATS[1], COATS[3], [0.07, 0.06, 0.06], [0.12, 0.1, 0.09]];
  try { if (new URLSearchParams(location.search).get('gegner') === 'aus') GEGNER.on = false; } catch (e) { /* kein location */ }
  const F = MOBILE ? 0.5 : 1, out = [];
  const mk = (role, kind, col) => {
    const pd = { st: GST, v: 0, sc: 0.95 + Math.random() * 0.1, kind, att: role === 'polizei' ? 'dienst' : 'feind', busy: true,
      gg: { role, s: 'off', x: 0, y: 0.22, z: 0, yaw: 0, t: 0, act: 0 } };
    if (col) pd.col = col;
    out.push(pd); GEGNER.list.push(pd); return pd;
  };
  // V61: mehr Leute für Razzien, Aufstand und Bankraub; dazu der Anführer der Bande (Der Rote Kasimir, anfuehrer.js)
  for (let i = 0; i < Math.round(6 * F); i++) mk('raeuber', i % 2 ? 'dbl' : 'coat', DARK[i % DARK.length]);
  const AK = ['worker', 'coat', 'jacket', 'worker', 'braces', 'coat', 'worker', 'jacket', 'braces', 'worker', 'coat'];
  for (let i = 0; i < Math.round(11 * F); i++) mk('anarchist', AK[i], AK[i] === 'coat' ? DARK[(i + 2) % DARK.length] : WORKWEAR[i % WORKWEAR.length]);
  for (let i = 0; i < Math.round(6 * F); i++) mk('polizei', 'police');
  const boss = mk('boss', 'dbl', [0.3, 0.045, 0.04]); boss.sc = 1.09;   // langer ochsenblutroter Zweireiher, einen halben Kopf größer
  return out;
}

/* ---------- Bewegung ---------- */
// steht da eine Wand (Quader zwischen Knie und Kopf) im Kreis r?
function gegBlocked(x, z, y, r) {
  for (const b of nearBoxes(x, z, r + 0.5)) {
    if (b.y1 < y + 0.45 || b.y0 > y + 1.7) continue;
    if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
  }
  return false;
}
function gegGround(x, z, y) { const g = groundAt(x, z, y + 0.6); return g ? g.y : null; }
// Gang: Gehen (Schrittfrequenz wie die Passanten) oder Rennen (Amplitude > 0,7 schaltet im Shader auf Laufen)
function gegGait(pd, mode, v) {
  const g = pd.a.gait, G = pd.gg;
  if (G.gm === mode && Math.abs((G.gv || 0) - v) < 0.3) return;
  G.gm = mode; G.gv = v;
  if (mode === 'run') { g[1] = v * 2.3 * (pd.fem ? 3.14 : 2.73) / pd.sc; g[2] = 0.8; }
  else if (mode === 'walk') { g[1] = v * (pd.fem ? 5.4 : 4.6) / pd.sc; g[2] = 0.4; }
  else { g[1] = G.act || 0; g[2] = 0; }
  pd.a.gv = (pd.a.gv | 0) + 1;
}
function gegAct(pd, act) { const G = pd.gg; G.act = act; G.gm = 'stand'; setAct(pd, act); }
// einen Schritt auf (tx, tz) zu; weicht Wänden aus. Gibt den Restabstand zurück
function gegStep(pd, tx, tz, v, dt) {
  const G = pd.gg, dx = tx - G.x, dz = tz - G.z, d = Math.hypot(dx, dz);
  if (d < 0.08) return d;
  let want = Math.atan2(dx, dz);
  const probe = a => gegBlocked(G.x + Math.sin(a) * 0.75, G.z + Math.cos(a) * 0.75, G.y, 0.28);
  if (probe(want)) {
    const side = G.side || (G.side = Math.random() < 0.5 ? 1 : -1);
    let ok = false;
    for (const o of [0.6, 1.2, 1.8, 2.4]) {
      if (!probe(want + side * o)) { want += side * o; ok = true; break; }
      if (!probe(want - side * o)) { want -= side * o; G.side = -side; ok = true; break; }
    }
    if (!ok) { G.stuck = (G.stuck || 0) + dt; return d; }
  }
  G.yaw += gegWrap(want - G.yaw) * Math.min(1, dt * 9);
  const s = Math.min(d, v * dt), nx = G.x + Math.sin(G.yaw) * s, nz = G.z + Math.cos(G.yaw) * s;
  const gy = gegGround(nx, nz, G.y);
  if (gy === null || gy - G.y > 0.5) { G.stuck = (G.stuck || 0) + dt; return d; }   // Wasser oder Stufe: nicht weiter
  G.x = nx; G.z = nz; G.y += (gy - G.y) * Math.min(1, dt * 12);
  G.stuck = Math.max(0, (G.stuck || 0) - dt * 0.5);
  return Math.max(0, d - s);
}
const gegPlace = pd => { const G = pd.gg; pedCrowd.set(pd.a, G.x, G.y, G.z, G.yaw, pd.sc, G.tilt || 0); };
const gegFace = (pd, x, z, dt, k = 8) => { const G = pd.gg; G.yaw += gegWrap(Math.atan2(x - G.x, z - G.z) - G.yaw) * Math.min(1, dt * k); };
// Mitte einer Figur (liegend: halbe Körperlänge vom Fuß Richtung Kopf)
function gegPos(pd) {
  const G = pd.gg;
  if (pd.rag) { const c = pd.rag.p[0]; return [c[0], c[2], pd.rag.gy]; }
  if (G.s === 'down' && G.lie) { const L = G.lie; return [L.x - Math.sin(L.yaw) * 0.9, L.z - Math.cos(L.yaw) * 0.9, L.y]; }
  return [G.x, G.z, G.y];
}
const gegDist = (pd, x, z) => { const [a, b] = gegPos(pd); return Math.hypot(a - x, b - z); };
const gegFree = role => GEGNER.list.filter(pd => pd.gg.role === role && pd.gg.s === 'off' && pd.a && !pd.rag && !pd.back);

function gegSpawn(pd, x, y, z, yaw) {
  const G = pd.gg;
  Object.assign(G, { s: 'hold', x, y, z, yaw, t: 0, tilt: 0, lie: null, held: false, ev: null, arrest: null, stuck: 0, cd: 1 + Math.random() * 2, gm: null, fall: null, follow: null, said: 0, shots: 0,
    ai: null, anchor: null, tough: false, hp: 0, recover: 0, onUp: null, lead: false, gun: false, noShoot: false, spd: 0, limp: false, want: 0, boss: false, fl: null });   // V61: nichts vom letzten Einsatz mitnehmen
  pd.st = GST; pd.back = null; gegAct(pd, 0.6); gegPlace(pd);
}
function gegOff(pd) { const G = pd.gg; G.s = 'off'; G.ev = null; G.arrest = null; G.follow = null; if (pd.rag) ragFree(pd.rag); pd.back = null; pd.st = GST; if (pd.a) pd.a.on = false; }

// Ort zum Auftauchen: Gehweg oder Straße auf Bodenhöhe, frei, möglichst nicht mitten im Blickfeld
function gegSpot(cx, cz, rMin, rMax, hide) {
  if (GEGNER.spotHook) { const s = GEGNER.spotHook(cx, cz, rMin, rMax); if (s !== undefined) return s; }   // V61: unter der Stadt: am Einstieg des Verstecks
  const f = camera.getWorldDirection(_gd), cp = camera.position;
  for (let i = 0; i < 40; i++) {
    const an = Math.random() * 6.2832, r = rMin + Math.random() * (rMax - rMin), x = cx + Math.sin(an) * r, z = cz + Math.cos(an) * r;
    const g = groundAt(x, z, 1.2); if (!g || g.y > 0.6 || g.y < -0.3 || g.via || g.elev || g.ice) continue;
    if (gegBlocked(x, z, g.y, 0.45)) continue;
    if (hide && i < 28) { const dx = x - cp.x, dz = z - cp.z, d = Math.hypot(dx, dz) || 1; if ((dx * f.x + dz * f.z) / d > 0.45 && d < 60) continue; }
    return { x, y: g.y, z };
  }
  return null;
}

/* ---------- Treffer ---------- */
// Für den Energieschub und andere Kräfte: wirft alle Gegner im Umkreis r um (k 0..1 Wucht, Richtung optional)
export function gegnerTreffer(x, y, z, r, k = 0.6, dx, dz) {
  let n = 0;
  for (const pd of GEGNER.list) {
    const G = pd.gg; if (G.s === 'off' || G.role === 'polizei' || G.s === 'down' || pd.rag) continue;
    if (Math.hypot(G.x - x, G.z - z) > r || Math.abs(G.y - y) > Math.max(3, r * 0.5)) continue;
    let ux = dx, uz = dz; if (ux === undefined) { ux = G.x - x; uz = G.z - z; }
    if (Math.hypot(ux, uz) < 0.05) { ux = G.x - player.p.x; uz = G.z - player.p.z; }   // genau auf ihn: weg von Alexander
    if (Math.hypot(ux, uz) < 0.05) { ux = Math.sin(G.yaw + Math.PI); uz = Math.cos(G.yaw + Math.PI); }
    const L = Math.hypot(ux, uz); ux /= L; uz /= L;
    gegKnock(pd, ux * (4 + 10 * k), uz * (4 + 10 * k), x, z); n++;
  }
  return n;
}
function gegKnock(pd, vx, vz, fx, fz) {
  const G = pd.gg;
  if (!(Math.hypot(vx, vz) > 0.5)) { vx = -Math.sin(G.yaw) * 4; vz = -Math.cos(G.yaw) * 4; }   // ohne Richtung (knockDown teilt durch die Geschwindigkeit): nach hinten
  if (knockDown(pd, vx, vz, fx, fz)) return true;   // Puppe fliegt (ragdoll.js); gegnerStep sieht pd.rag und zählt ihn als besiegt
  // keine Puppe frei: umkippen ohne Puppe (nach hinten, weg vom Stoß)
  G.fall = { t: 0, yaw: Math.atan2(-vx, -vz) }; gegDefeat(pd, 'hit');
  return true;
}
function gegDefeat(pd, how) {
  const G = pd.gg; if (G.s === 'down') return;
  const was = G.s; G.s = 'down'; G.t = 0; G.follow = null;
  if (!G.fall && !pd.rag) G.fall = { t: 0, yaw: G.yaw };
  const [x, z] = gegPos(pd);
  if (G.hp > 1) {   // V61: der Anführer ist zäh: er rappelt sich wieder auf, bis seine Kraft verbraucht ist
    G.hp--; G.recover = 2.4 + Math.random() * 0.8; G.was = was === 'getup' || was === 'down' ? 'fight' : was;
    const E = G.ev; if (E && E.onDown) E.onDown(pd, how, was);
    GEGNER.cheerT = 0.6; GEGNER.cheerX = x; GEGNER.cheerZ = z;
    return;
  }
  G.hp = 0; G.recover = 0;
  gegFire('besiegt', pd, x, z);
  if (!G.boss && Math.random() < 0.7) gegnerSay(GWHO[G.lead ? 'anfuehrer' : G.role] || 'Ein Gauner', gegLine(G.role === 'anarchist' && Math.random() < 0.5 ? 'besiegtAnar' : 'besiegt'), 1, x, z);
  const E = G.ev; if (E && E.onDown) E.onDown(pd, how, was);
  if (G.arrest) { G.arrest.ph = 'wait'; G.arrest.t = 0.6; }
  else { const A = { crook: pd, ph: 'wait', t: 0, cops: [] }; G.arrest = A; GEGNER.arrests.push(A); }
  GEGNER.cheerT = 0.6; GEGNER.cheerX = x; GEGNER.cheerZ = z;
}
// Puppe gelandet: Figur liegt auf dem Rücken (eigene Matrix, Puppe wird frei für andere)
function gegLayFromRag(pd, s) {
  const G = pd.gg, P = s.p, fx = (P[13][0] + P[14][0]) / 2, fz = (P[13][2] + P[14][2]) / 2, hx = P[2][0], hz = P[2][2];
  let yaw = Math.atan2(-(hx - fx), -(hz - fz)); if (!isFinite(yaw)) yaw = G.yaw;
  G.lie = { x: fx, y: s.gy, z: fz, yaw }; G.x = fx; G.z = fz; G.y = s.gy; G.yaw = yaw; G.tilt = -HALF_PI; G.fall = null;
  ragFree(s); pd.st = GST; gegAct(pd, 0.3);
  pedCrowd.set(pd.a, fx, s.gy + 0.13, fz, yaw, pd.sc, -HALF_PI);
}
// Telekinese hält einen Gegner: eigener Hinweis
function gegHeld(pd) {
  const G = pd.gg; if (G.held) return; G.held = true;
  const r = G.role;
  toast(r === 'polizei' ? 'Ein Polizist schwebt (er salutiert trotzdem)' : (r === 'anarchist' ? 'Ein Anarchist' : r === 'dieb' ? 'Der Taschendieb' : 'Der Räuber') + ' zappelt in der Luft · loslassen oder wegschleudern');
  if (r !== 'polizei') { const [x, z] = gegPos(pd); gegnerSay(GWHO[r] || 'Ein Gauner', gegPick(['Lass mich runter! Lass mich sofort runter!', 'Hilfe! Ich fliege!', 'Das ist Hexerei!', 'Bitte nicht fallen lassen … bitte!']), 2, x, z); }
}

/* ---------- Würfe und Schüsse ---------- */
let GEOS_P = null;
function gegProjGeos() {
  if (GEOS_P) return GEOS_P;
  const stone = mergeColored([[new T.IcosahedronGeometry(0.08, 0).scale(1, 0.8, 1.1), [0.35, 0.33, 0.31]]]);
  const bottle = mergeColored([[new T.CylinderGeometry(0.035, 0.04, 0.2, 8), [0.06, 0.2, 0.1]], [new T.CylinderGeometry(0.014, 0.018, 0.08, 6).translate(0, 0.14, 0), [0.06, 0.2, 0.1]], [new T.BoxGeometry(0.05, 0.06, 0.02).translate(0, 0.2, 0), [0.85, 0.7, 0.45]]]);
  return (GEOS_P = { stone, bottle });
}
function gegThrow(pd, kind) {
  const G = pd.gg, p = player.p, sx = G.x + Math.sin(G.yaw) * 0.35, sy = G.y + 1.75, sz = G.z + Math.cos(G.yaw) * 0.35;
  const tx = p.x + (Math.random() - 0.5) * 1.4, ty = p.y + 1.1 + (Math.random() - 0.5) * 0.8, tz = p.z + (Math.random() - 0.5) * 1.4;
  const d = Math.hypot(tx - sx, tz - sz), Tt = Math.max(0.55, Math.min(1.9, d / 15));
  let pr = GEGNER.proj.find(q => !q.on);
  if (!pr) { if (GEGNER.proj.length >= 10) return; pr = { m: new T.Mesh(gegProjGeos().stone, propMaterial()), on: false }; pr.m.frustumCulled = false; pr.m.castShadow = false; scene.add(pr.m); GEGNER.proj.push(pr); }
  pr.on = true; pr.kind = kind; pr.m.geometry = gegProjGeos()[kind]; pr.m.visible = true; pr.t = 0;
  pr.x = new T.Vector3(sx, sy, sz); pr.v = new T.Vector3((tx - sx) / Tt, (ty - sy) / Tt + 4.9 * Tt, (tz - sz) / Tt); pr.w = new T.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9);
  pr.m.position.copy(pr.x);
  gegSnd('woosh', sx, sz, 0.5);
}
function gegShot(pd) {
  const G = pd.gg, p = player.p, mx = G.x + Math.sin(G.yaw) * 0.55, my = G.y + 1.42, mz = G.z + Math.cos(G.yaw) * 0.55;
  fxEmit('spark', mx, my, mz, Math.sin(G.yaw) * 4, 0.5, Math.cos(G.yaw) * 4, 6, 0.05, 1.4);
  fxEmit('smoke', mx, my, mz, 0, 0.3, 0, 1, 0.1, 0.3);
  gegSnd('shot', mx, mz, 1);
  const d = Math.hypot(p.x - mx, p.z - mz);
  if (Math.random() < (d < 12 ? 0.85 : 0.5)) {
    // Treffer: prallt an Alexander ab (Funken und der Schimmer des Kristalls)
    const hx = p.x + (mx - p.x) / (d || 1) * 0.3, hy = p.y + 1.0 + Math.random() * 0.6, hz = p.z + (mz - p.z) / (d || 1) * 0.3;
    fxEmit('spark', hx, hy, hz, (Math.random() - 0.5) * 6, 2, (Math.random() - 0.5) * 6, 8, 0.05, 1.2);
    fxEmit('crystal', hx, hy, hz, 0, 0.5, 0, 6, 0.15, 0.7);
    gegSnd('ping', hx, hz, 0.8); gegHitAlex(0.12, 'Kugeln');
  } else fxEmit('dust', p.x + (Math.random() - 0.5) * 3, p.y + 0.05, p.z + (Math.random() - 0.5) * 3, 0, 0.6, 0, 3, 0.2, 0.4);
}
function gegHitAlex(shake, what) {
  GEGNER.abprall = 6;   // ein paar Sekunden lang rufen die Anarchisten "es prallt ab"
  POWERS.shake = Math.min(1, (POWERS.shake || 0) + shake);
  if (GEGNER.hitT <= 0) { GEGNER.hitT = 25; toast(what + ' prallen an Alexander ab · unverwundbar'); }
}
function gegUpdateProj(dt) {
  const p = player.p;
  for (const pr of GEGNER.proj) {
    if (!pr.on) continue;
    pr.t += dt; pr.v.y -= 9.81 * dt; pr.x.addScaledVector(pr.v, dt);
    pr.m.position.copy(pr.x); pr.m.rotation.x += pr.w.x * dt; pr.m.rotation.y += pr.w.y * dt; pr.m.rotation.z += pr.w.z * dt;
    const ax = pr.x.x - p.x, ay = pr.x.y - (p.y + 1.0), az = pr.x.z - p.z;
    if (!pr.bounced && ax * ax + az * az < 0.42 && Math.abs(ay) < 1.0 && !DRIVE.on) {
      // trifft Alexander: prallt ab, Flaschen zerspringen
      pr.bounced = true;
      fxEmit('crystal', pr.x.x, pr.x.y, pr.x.z, 0, 0.6, 0, 8, 0.2, 0.8);
      if (pr.kind === 'bottle') { gegShatter(pr.x.x, pr.x.y, pr.x.z, true); pr.on = false; pr.m.visible = false; gegHitAlex(0.08, 'Flaschen'); continue; }
      const L = Math.hypot(ax, az) || 1; pr.v.set(ax / L * 4, 2.5, az / L * 4); gegSnd('stone', pr.x.x, pr.x.z, 0.7); gegHitAlex(0.06, 'Steine');
    }
    const gy = gegGround(pr.x.x, pr.x.z, pr.x.y);
    const wall = gegBlocked(pr.x.x, pr.x.z, pr.x.y - 1.0, 0.05);
    if ((gy !== null && pr.x.y <= gy + 0.06) || (pr.x.y < WATER_Y && gy === null) || wall || pr.t > 5) {   // V61: unter der Stadt liegt der Boden tiefer als das Wasser
      if (pr.kind === 'bottle') gegShatter(pr.x.x, Math.max(gy ?? WATER_Y, pr.x.y), pr.x.z, gy !== null && !wall);
      else { fxEmit('dust', pr.x.x, (gy ?? pr.x.y) + 0.05, pr.x.z, 0, 0.5, 0, 3, 0.15, 0.5); gegSnd('stone', pr.x.x, pr.x.z, 0.5); }
      pr.on = false; pr.bounced = false; pr.m.visible = false;
    }
  }
}
// zerbrochene Brandflasche: Glas, kurzes Feuer am Boden (nur Funken und Rauch, kein Licht)
function gegShatter(x, y, z, fire) {
  fxEmit('glass', x, y, z, 0, 1.5, 0, 10, 0.25, 1);
  gegSnd('glass', x, z, 0.8);
  if (fire && GEGNER.fires.length < 6) GEGNER.fires.push({ x, y, z, t: 0, life: 3.5 + Math.random() * 2 });
}
function gegUpdateFires(dt) {
  for (let i = GEGNER.fires.length - 1; i >= 0; i--) {
    const F = GEGNER.fires[i]; F.t += dt; F.acc = (F.acc || 0) + dt * 22;
    const k = 1 - F.t / F.life;
    while (F.acc > 1) { F.acc -= 1; fxEmit('ember', F.x + (Math.random() - 0.5) * 0.7, F.y + 0.05, F.z + (Math.random() - 0.5) * 0.7, 0, 1.5 + k * 1.5, 0, 1, 0.1, 0.8 + k); if (Math.random() < 0.25) fxEmit('black', F.x, F.y + 0.4, F.z, 0, 0.8, 0, 1, 0.2, 0.35); }
    if (F.t > F.life) GEGNER.fires.splice(i, 1);
  }
}

/* ---------- Klänge (aus dem Rauschen und den Tönen von audio.js) ---------- */
function gegSnd(kind, x, z, k = 1) {
  if (!SND.on || !SND.ctx || !SND.noise || !SND.bus || !SND.bus.sfx) return;
  const d = Math.hypot(x - player.p.x, z - player.p.z), v = k * Math.max(0, 1 - d / (kind === 'boom' ? 400 : kind === 'shot' ? 220 : 70)); if (v < 0.02) return;
  const t = SND.ctx.currentTime;
  try {
    if (kind === 'shot') { sndBurst(t, 0.09, 2400, 0.6, 0.35 * v); sndBurst(t, 0.45, 420, 0.7, 0.3 * v, 'sfx', 'lowpass', true); }
    else if (kind === 'ping') { sndTone(2600 + Math.random() * 900, t, 0.35, 0.05 * v, 'sine', 'sfx', 1400); sndBurst(t, 0.05, 3500, 1.2, 0.12 * v); }
    else if (kind === 'boom') { sndTone(58, t, 1.6, 0.55 * v, 'sine', 'sfx', 24); sndBurst(t, 1.8, 260, 0.6, 0.5 * v, 'sfx', 'lowpass', true); sndBurst(t, 0.3, 1600, 0.5, 0.2 * v); sndClip('debris', 0.5 * v, 0.8); }
    else if (kind === 'fuse') sndBurst(t, 0.25, 5200, 2.5, 0.025 * v);
    else if (kind === 'fizz') sndBurst(t, 1.2, 4200, 0.8, 0.12 * v);
    else if (kind === 'glass') sndClip('glass', 0.6 * v, 0.9 + Math.random() * 0.2);
    else if (kind === 'stone') sndClip('thud', 0.4 * v, 1.3 + Math.random() * 0.3);
    else if (kind === 'woosh') sndClip('woosh', 0.25 * v, 1.4);
    else if (kind === 'whistle') { for (let i = 0; i < 3; i++) sndTone(2900, t + i * 0.22, 0.16, 0.05 * v, 'square', 'sfx', 2700); }
  } catch (e) { /* Ton ist Beiwerk */ }
}

/* ---------- Bombe (ein loser Körper: Telekinese, Tragen, Werfen funktionieren wie bei allem anderen) ---------- */
function gegBombKind() {
  const K = KINDS_OF(); if (K.anarchobomb) return;
  GEOS.anarchobomb = () => mergeColored([
    [new T.SphereGeometry(0.16, 16, 12), [0.05, 0.05, 0.055]],
    [new T.CylinderGeometry(0.045, 0.05, 0.05, 10).translate(0, 0.17, 0), [0.45, 0.34, 0.16]],
    [new T.CylinderGeometry(0.008, 0.008, 0.12, 5).rotateZ(0.35).translate(0.02, 0.24, 0), [0.75, 0.68, 0.5]],
  ]);
  K.anarchobomb = { name: 'Bombe', kind: 'ball', he: [0.16, 0.16, 0.16], m: 7, stuff: 'metal', small: true };
}
// für das Labor
export function gegnerBombGeo() { gegBombKind(); return GEOS.anarchobomb(); }
export function gegnerProjGeos() { return gegProjGeos(); }
function gegPlantBomb(x, y, z, fuse) {
  gegBombKind();
  const B = spawnProp('anarchobomb', x, y, z, Math.random() * 6.28); if (!B) return null;
  const bomb = { B, t: fuse, fuse, x, z, done: false, sndT: 0, tkSeen: false };
  GEGNER.bombs.push(bomb); return bomb;
}
function gegUpdateBombs(dt) {
  for (const bm of GEGNER.bombs) {
    if (bm.done) continue;
    const B = bm.B;
    if (LOOSE.bodies.indexOf(B) < 0) { bm.done = true; bm.result = 'weg'; continue; }   // (z. B. aufgeräumt): einfach fort
    bm.t -= dt; bm.x = B.x.x; bm.z = B.x.z;
    // Zündschnur sprüht Funken
    const up = _gd.set(0, 1, 0).applyQuaternion(B.q);
    if (Math.random() < dt * 30) fxEmit('spark', B.x.x + up.x * 0.27, B.x.y + up.y * 0.27, B.x.z + up.z * 0.27, 0, 1.2, 0, 1, 0.03, 0.8);
    if ((bm.sndT -= dt) <= 0) { bm.sndT = 0.3; gegSnd('fuse', B.x.x, B.x.z, 1); }
    if (LOOSE.tk === B && !bm.tkSeen) { bm.tkSeen = true; toast('Die Zündschnur brennt! Hoch in den Himmel oder ins Wasser damit · Linksklick schleudert'); }
    // ins Wasser: zischt aus
    const gy = gegGround(B.x.x, B.x.z, B.x.y);
    if (B.x.y < WATER_Y + 0.4 && gy === null) { gegBombEnd(bm, 'wasser'); continue; }
    if (bm.t <= 0) gegBombEnd(bm, 'knall');
  }
  GEGNER.bombs = GEGNER.bombs.filter(b => !b.done || b.keep > 0);
}
function gegBombEnd(bm, how) {
  const B = bm.B, x = B.x.x, y = B.x.y, z = B.x.z;
  bm.done = true;
  if (LOOSE.tk === B) LOOSE.tk = null;
  if (LOOSE.held === B) LOOSE.held = null;
  dropBody(B);
  if (how === 'wasser') {
    fxEmit('steam', x, WATER_Y + 0.2, z, 0, 1.5, 0, 14, 0.5, 1.2); fxEmit('spray', x, WATER_Y + 0.1, z, 0, 3, 0, 10, 0.4, 0.8);
    gegSnd('fizz', x, z, 1); bm.result = 'entschaerft'; GEGNER.stats.entschaerft++;
    toast('Die Bombe zischt im Wasser aus · entschärft'); gegnerSay('Ein Passant', gegPick(['Ins Wasser damit! Bravo!', 'Puh … das war knapp.', 'Er hat die Bombe ins Wasser geworfen! Wir sind gerettet!']), 2);
    return;
  }
  // Explosion: Feuerball, Funken, Rauch; nahe Leute fallen um, lose Dinge fliegen. Keine neuen Lichter (Grafikkarte)
  const gy = gegGround(x, z, y), above = gy === null ? 99 : y - gy;
  let near = 0; for (const pd of peds) { if (!pd.a || !pd.a.on) continue; const e = pd.a.m.elements; if ((e[12] - x) ** 2 + (e[14] - z) ** 2 < 100 && Math.abs(e[13] - y) < 6) near++; }
  const harmless = above > 12 || (near === 0 && Math.hypot(x - bm.x0, z - bm.z0) > 25);
  const k = harmless ? 1.2 : 1;
  fxEmit('ember', x, y, z, 0, 2, 0, Math.round(40 * k), 1.2, 1.6);
  fxEmit('spark', x, y, z, 0, 3, 0, Math.round(40 * k), 0.6, 1.5);
  fxEmit('black', x, y + 0.5, z, 0, 1.2, 0, 10, 1.2, 1.4);
  fxEmit('smoke', x, y + 0.3, z, 0, 0.8, 0, 8, 1.5, 1.2);
  if (!harmless) fxEmit('dust', x, (gy ?? y) + 0.2, z, 0, 1, 0, 12, 2, 1.3);
  gegSnd('boom', x, z, 1);
  const dP = Math.hypot(x - player.p.x, y - player.p.y, z - player.p.z);
  POWERS.shake = Math.min(1.6, (POWERS.shake || 0) + Math.max(0, 1 - dP / 70) * 1.1);
  if (harmless) {
    bm.result = 'entschaerft'; GEGNER.stats.entschaerft++;
    toast('Die Bombe zerplatzt hoch über der Stadt · niemand verletzt');
    gegnerSay('Ein Passant', gegLine('bombeWeg'), 2); aweBurst('throw', 40);
    return;
  }
  bm.result = 'knall'; GEGNER.stats.explodiert++; gegFire('knall', null, x, z);
  gegScorch(x, gy ?? y, z);
  gegBlastAround(x, y, z, 9, 1);
  toast(dP < 6 ? 'Die Bombe explodiert in Alexanders Händen · er steht da, ohne einen Kratzer' : 'Die Bombe ist explodiert · zum Glück nur Schrecken und Scherben');
  gegnerSay('Ein Passant', gegLine('bombeKnall'), 2, x, z);
}
// Druckwelle: Leute im Umkreis R fallen um (Gegner zählen als getroffen), lose Dinge fliegen. k = Wucht
export function gegBlastAround(x, y, z, R = 9, k = 1, skip = null) {
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.rag || pd.sit || pd === skip) continue;
    const e = pd.a.m.elements, dx = e[12] - x, dz = e[14] - z, d = Math.hypot(dx, dz);
    if (d > R || Math.abs(e[13] - y) > 4) continue;
    const f = ((1 - d / R) * 9 + 2) * k; if (pd.gg && pd.gg.role !== 'polizei') { if (pd.gg.s !== 'off' && pd.gg.s !== 'down') gegKnock(pd, dx / (d || 1) * f, dz / (d || 1) * f, x, z); } else knockDown(pd, dx / (d || 1) * f || 0.01, dz / (d || 1) * f || 0.01, x, z);
  }
  for (const Bd of LOOSE.bodies) {
    if (Bd === LOOSE.tk || Bd === LOOSE.held) continue;
    const dx = Bd.x.x - x, dz = Bd.x.z - z, d = Math.hypot(dx, dz); if (d > R + 1 || Math.abs(Bd.x.y - y) > 4) continue;
    const f = (1 - d / (R + 1)) * 12 * k / Math.sqrt(Math.max(0.5, Bd.m) / 2);
    Bd.awake = true; Bd.still = 0; Bd.v.x += dx / (d || 1) * f; Bd.v.z += dz / (d || 1) * f; Bd.v.y += f * 0.6;
  }
}
// Feuerball, Funken, Rauch, Knall und Wackeln (ohne Licht); für Bomben, Dynamit, Höllenmaschine
export function gegFireball(x, y, z, k = 1, dust = true) {
  fxEmit('ember', x, y, z, 0, 2, 0, Math.round(40 * k), 1.2 * k, 1.6);
  fxEmit('spark', x, y, z, 0, 3, 0, Math.round(40 * k), 0.6 * k, 1.5);
  fxEmit('black', x, y + 0.5, z, 0, 1.2, 0, Math.round(10 * k), 1.2 * k, 1.4);
  fxEmit('smoke', x, y + 0.3, z, 0, 0.8, 0, Math.round(8 * k), 1.5 * k, 1.2);
  if (dust) fxEmit('dust', x, y + 0.2, z, 0, 1, 0, Math.round(12 * k), 2 * k, 1.3);
  gegSnd('boom', x, z, Math.min(1.2, 0.5 + 0.5 * k));
  const dP = Math.hypot(x - player.p.x, y - player.p.y, z - player.p.z);
  POWERS.shake = Math.min(1.6, (POWERS.shake || 0) + Math.max(0, 1 - dP / 70) * 1.1 * Math.min(1.3, k));
  return dP;
}
// Rußfleck am Boden (verblasst nach einer Weile)
let SCORCH_TEX = null;
function gegScorch(x, y, z) {
  if (!SCORCH_TEX) SCORCH_TEX = canvasTex(128, 128, (g, w) => {
    const c = w / 2, rg = g.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, 'rgba(0,0,0,0.95)'); rg.addColorStop(0.45, 'rgba(0,0,0,0.75)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.clearRect(0, 0, w, w); g.fillStyle = rg; g.beginPath(); g.arc(c, c, c, 0, 6.2832); g.fill();
  });
  let S = GEGNER.scorch.length >= 3 ? GEGNER.scorch.shift() : null;
  if (!S) { S = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-HALF_PI), new T.MeshBasicMaterial({ map: SCORCH_TEX, color: 0x0a0807, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); S.renderOrder = 2; scene.add(S); }
  S.position.set(x, y + 0.03, z); S.scale.setScalar(4.5 + Math.random()); S.rotation.y = Math.random() * 6.28; S.visible = true; S.t = 0;
  S.material.opacity = 0.9; GEGNER.scorch.push(S);
}

/* ---------- Ereignisse ---------- */
export const EV_TYPES = ['raub', 'dieb', 'bombe', 'angriff'];   // V61: anfuehrer.js hängt seine Ereignisse an
function gegCanStart() {
  const p = player.p;
  if (DRIVE.on || BOAT.on || DINE.seat || p.y > 45 || Math.hypot(p.x, p.z) > 980) return false;
  if (GEGNER.block || (UNTER.test && UNTER.test(p))) return false;   // V61: unter der Stadt (Versteck) passiert oben nichts Neues
  return !!pedCrowd;
}
// Opfer: ein gehender Passant in 18 bis 50 m (nicht in Begleitung, kein Bewohner, kein Kind, kein Polizist)
function gegVictim(rMin, rMax) {
  const p = player.p, L = [];
  for (const pd of peds) {
    if (pd.st !== 0 || !pd.lp || pd.pair || pd.cit || pd.gg || pd.aw || pd.rag || pd.back || !pd.a || !pd.a.on) continue;
    const k = pd.a.kind; if (k === 'police' || k === 'kid' || k === 'worker' && Math.random() < 0.5) continue;
    const e = pd.a.m.elements, d = Math.hypot(e[12] - p.x, e[14] - p.z);
    if (d < rMin || d > rMax || Math.abs(e[13] - p.y) > (player.fly ? 30 : 3)) continue;
    L.push(pd);
  }
  return L.length ? gegPick(L) : null;
}
function gegFreeze(v) {
  const e = v.a.m.elements, g = v.a.gait;
  v.ggSave = { st: v.st, g1: g[1], g2: g[2], busy: v.busy, x: v.x, y: v.y, z: v.z, yaw: v.yaw, act0: v.act0 };
  v.st = 4; v.x = e[12]; v.y = e[13]; v.z = e[14]; v.yaw = Math.atan2(e[8], e[10]); v.busy = true; v.act0 = 0.6;
}
function gegUnfreeze(v) {
  const S = v.ggSave; if (!S) return true;
  if (v.rag || v.back || v.aw) return false;
  v.st = S.st; v.busy = S.busy; v.act0 = S.act0; v.x = S.x; v.y = S.y; v.z = S.z; v.yaw = S.yaw;
  const g = v.a.gait; g[1] = S.g1; g[2] = S.g2; v.a.gv = (v.a.gv | 0) + 1; v.tilt = 0;
  v.ggSave = null; return true;
}
// V61: weitere Ereignisse (anfuehrer.js: Aufstand mit Barrikade, Bombenserie, Bankraub): { make() -> E, w Gewicht, ok() möglich? }
export const EV_EXTRA = {};
function gegPickType() {
  const L = [['raub', 2], ['dieb', 1], ['bombe', 1], ['angriff', 2]];
  for (const k in EV_EXTRA) { const X = EV_EXTRA[k]; if (!X.ok || X.ok()) L.push([k, typeof X.w === 'function' ? X.w() : X.w]); }
  let S = 0; for (const [, w] of L) S += w; let r = Math.random() * S;
  for (const [k, w] of L) if ((r -= w) <= 0) return k;
  return 'raub';
}
export function gegnerStart(type) {
  if (GEGNER.ev || !gegCanStart()) return false;
  type = type || gegPickType();
  const X = EV_EXTRA[type];
  const E = X ? (X.ok && !X.ok() ? null : X.make()) : type === 'raub' ? evRaub() : type === 'dieb' ? evDieb() : type === 'bombe' ? evBombe() : evAngriff();
  if (!E) return false;
  E.type = type; E.t = 0; GEGNER.ev = E; GEGNER.stats.ereignisse++;
  return true;
}
function gegEnd(E, pause = 1) {
  if (GEGNER.ev === E) GEGNER.ev = null;
  if (E.v && E.v.ggSave && !gegUnfreeze(E.v)) GEGNER.thaw.push(E.v);   // Opfer steht noch (umgeworfen, staunt): später weiter
  E.over = true;
  GEGNER.nextT = (90 + Math.random() * 100) * pause;
}

// --- Überfall ---
function evRaub() {
  const v = gegVictim(16, 48), R = gegFree('raeuber')[0]; if (!v || !R) return null;
  const e = v.a.m.elements, vx = e[12], vz = e[14], p = player.p;
  let ax = vx - p.x, az = vz - p.z; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
  let sp = null;
  for (let i = 0; i < 12 && !sp; i++) { const an = Math.atan2(ax, az) + (Math.random() - 0.5) * 2.2, r = 7 + Math.random() * 5, x = vx + Math.sin(an) * r, z = vz + Math.cos(an) * r, g = groundAt(x, z, 1.2); if (g && g.y < 0.6 && g.y > -0.3 && !g.via && !g.elev && !gegBlocked(x, z, g.y, 0.45)) sp = { x, y: g.y, z }; }
  if (!sp) return null;
  gegFreeze(v);
  gegSpawn(R, sp.x, sp.y, sp.z, Math.atan2(vx - sp.x, vz - sp.z));
  const E = { label: 'Überfall', v, R, ph: 'come', crooks: [R], where: () => [v.x, v.z] };
  R.gg.ev = E; R.gg.s = 'script';
  E.onDown = () => { E.caught = true; };
  E.step = dt => {
    const G = R.gg, p = player.p;
    const dAlex = Math.hypot(G.x - p.x, G.z - p.z) + (player.fly ? Math.max(0, p.y - G.y - 4) : 0);
    if (E.caught) {
      // Opfer bedankt sich, sobald es wieder steht und Alexander nah genug ist
      if (!E.thanks && gegUnfreeze(v)) { E.thanks = true; E.thankT = 2.5; }
      if (E.thanks && (E.thankT -= dt) <= 0 && !E.said) {
        E.said = true; const e2 = v.a.m.elements;
        if (v.a.on) turnHead(v.a, p.x, p.z);
        gegnerSay(whoOf(v), gegLine('opferDank'), 2, e2[12], e2[14]);
      }
      if (E.said || E.t > 40) gegEnd(E);
      return;
    }
    if (E.ph === 'come') {
      gegGait(R, 'run', 4.2);
      const tx = v.x + Math.sin(Math.atan2(G.x - v.x, G.z - v.z)) * 1.05, tz = v.z + Math.cos(Math.atan2(G.x - v.x, G.z - v.z)) * 1.05;
      if (gegStep(R, tx, tz, 4.2, dt) < 0.15 || G.stuck > 2.5) {
        E.ph = 'threat'; E.pt = 0; gegAct(R, 4.3);
        v.yaw = Math.atan2(G.x - v.x, G.z - v.z); setAct(v, 8.2);
        gegnerSay(whoOf(v), gegLine('opferRuf'), 2, v.x, v.z);
        gegPanic(v.x, v.z, 14, false);
      }
      gegPlace(R); return;
    }
    if (E.ph === 'threat') {
      E.pt += dt; gegFace(R, v.x, v.z, dt); gegPlace(R);
      if (E.pt > 3 && E.pt - (E.lastSay || 0) > 6) { E.lastSay = E.pt; gegnerSay(GWHO.raeuber, gegLine('raubDroh'), 1, G.x, G.z); }
      if (dAlex < 9 || E.pt > 22) {
        E.ph = 'flee'; G.s = 'flee'; G.fleeT = 0; G.cd = 0.4;
        gegnerSay(GWHO.raeuber, gegLine(dAlex < 9 ? 'raubSieht' : 'diebRuf'), 2, G.x, G.z);
        E.victimT = 1.2;
      }
      return;
    }
    if (E.ph === 'flee') {
      if (E.victimT > 0 && (E.victimT -= dt) <= 0) { setAct(v, 13.1); gegnerSay(whoOf(v), gegLine('opferHinterher'), 1, v.x, v.z); }
      if (G.s === 'off') {
        if (!E.lost) { E.lost = true; GEGNER.stats.entkommen++; toast('Der Räuber ist entkommen'); E.lostT = 1.5; }
        if ((E.lostT -= dt) <= 0 && gegUnfreeze(v)) { if (Math.random() < 0.6) gegnerSay(whoOf(v), gegLine('opferVerloren'), 1, v.x, v.z); gegEnd(E); }
      }
    }
  };
  return E;
}
// --- Taschendieb ---
function evDieb() {
  const v = gegVictim(14, 40), R = gegFree('raeuber')[0]; if (!v || !R) return null;
  const e = v.a.m.elements, yaw = Math.atan2(e[8], e[10]);
  const x = e[12] - Math.sin(yaw) * 2.2 + Math.cos(yaw) * 0.5, z = e[14] - Math.cos(yaw) * 2.2 - Math.sin(yaw) * 0.5, g = groundAt(x, z, 1.2);
  if (!g || g.y > 0.6 || gegBlocked(x, z, g.y, 0.4)) return null;
  gegSpawn(R, x, g.y, z, yaw);
  R.gg.role = 'dieb'; R.gg.ev = null;
  const E = { label: 'Taschendieb', v, R, ph: 'sneak', crooks: [R], where: () => { const P = gegPos(R); return [P[0], P[1]]; } };
  R.gg.ev = E; R.gg.s = 'script';
  E.onDown = () => { E.caught = true; };
  const done = () => { R.gg.role = 'raeuber'; };
  E.step = dt => {
    const G = R.gg, p = player.p;
    if (E.caught) {
      if (!E.thanks && gegUnfreeze(v)) { E.thanks = true; E.thankT = 2.2; }
      if (E.thanks && (E.thankT -= dt) <= 0 && !E.said) { E.said = true; if (v.a.on) turnHead(v.a, p.x, p.z); const e2 = v.a.m.elements; gegnerSay(whoOf(v), gegLine('opferDank'), 2, e2[12], e2[14]); }
      if ((E.said && G.s !== 'down') || E.t > 40) { if (G.s === 'off') done(); else G.after = done; gegEnd(E); }
      return;
    }
    if (E.ph === 'sneak') {
      // dicht hinter dem Opfer her, dann ein Griff in die Tasche
      if (!v.a.on || v.st !== 0) { E.ph = 'grab'; }
      const f = v.a.m.elements;
      gegGait(R, 'walk', 1.6);
      if (gegStep(R, f[12] - Math.sin(Math.atan2(f[8], f[10])) * 0.55, f[14] - Math.cos(Math.atan2(f[8], f[10])) * 0.55, 1.7, dt) < 0.25 || E.t > 6) E.ph = 'grab';
      gegPlace(R); return;
    }
    if (E.ph === 'grab') {
      E.ph = 'flee'; if (!v.ggSave && v.st === 0 && !v.rag) gegFreeze(v);
      setAct(v, 13.1); gegnerSay(whoOf(v), gegLine('dieb'), 2, v.x, v.z);
      G.s = 'flee'; G.fleeT = 0; G.noShoot = true; G.spd = 6.2;
      gegPanic(v.x, v.z, 10, false);
      return;
    }
    if (E.ph === 'flee' && G.s === 'off') {
      if (!E.lost) { E.lost = true; GEGNER.stats.entkommen++; toast('Der Taschendieb ist entkommen'); E.lostT = 1.2; }
      if ((E.lostT -= dt) <= 0 && gegUnfreeze(v)) { if (Math.random() < 0.6) gegnerSay(whoOf(v), gegLine('opferVerloren'), 1, v.x, v.z); done(); gegEnd(E); }
    }
  };
  return E;
}
// --- Bombe der Anarchisten vor einem Haus ---
const DOOR_NAME = { hotel: 'vor dem Hotel', cafe: 'vor dem Café', restaurant: 'vor dem Restaurant', bar: 'vor der Bar', pub: 'vor der Kneipe', shop: 'vor einem Laden', theater: 'vor dem Theater', house: 'vor einem Wohnhaus', workshop: 'vor einer Werkstatt' };
function evBombe() {
  const p = player.p, A = gegFree('anarchist'); if (A.length < 3) return null;
  const cands = DOORS.filter(d => { const dd = Math.hypot(d.x - p.x, d.z - p.z); return dd > 30 && dd < 95 && d.kind !== 'house'; });
  let D = null, spot = null;
  for (let i = 0; i < 10 && cands.length; i++) {
    const d = gegPick(cands), bx = d.x + d.nx * 1.4, bz = d.z + d.nz * 1.4, g = groundAt(bx, bz, 1.2);
    if (!g || g.y > 0.6 || g.y < -0.3 || gegBlocked(bx, bz, g.y, 0.3)) continue;
    D = d; spot = { x: bx, y: g.y, z: bz }; break;
  }
  if (!D) return null;
  const n = Math.min(A.length, 3 + (Math.random() < 0.5 ? 1 : 0)), crew = A.slice(0, n);
  const E = { label: 'Bombe ' + (DOOR_NAME[D.kind] || 'vor einem Haus'), D, spot, crooks: crew, ph: 'come', where: () => E.bomb && !E.bomb.done ? [E.bomb.x, E.bomb.z] : [spot.x, spot.z] };
  let k = 0;
  for (const pd of crew) {
    const s = gegSpot(spot.x + D.nx * 10, spot.z + D.nz * 10, 2, 8, true) || gegSpot(spot.x, spot.z, 8, 16, false); if (!s) continue;
    gegSpawn(pd, s.x, s.y, s.z, Math.atan2(spot.x - s.x, spot.z - s.z));
    const G = pd.gg; G.ev = E; G.s = 'script'; G.lead = k === 0;
    // Plätze im Halbkreis vor der Tür (der Anführer an der Bombe)
    const tx = -D.nz, tz = D.nx, side = k === 0 ? 0 : (k % 2 ? 1 : -1) * (1.2 + Math.floor(k / 2) * 1.1);
    G.tx = spot.x + D.nx * (k === 0 ? 0.6 : 1.8) + tx * side; G.tz = spot.z + D.nz * (k === 0 ? 0.6 : 1.8) + tz * side; k++;
  }
  E.crooks = crew.filter(pd => pd.gg.ev === E);
  if (E.crooks.length < 2) { for (const pd of E.crooks) gegOff(pd); return null; }
  E.onDown = () => { E.downs = (E.downs || 0) + 1; };
  E.step = dt => {
    const p = player.p, lead = E.crooks[0];
    if (E.ph === 'come') {
      let all = true;
      for (const pd of E.crooks) {
        const G = pd.gg; if (G.s !== 'script') continue;
        gegGait(pd, 'walk', 1.7);
        if (gegStep(pd, G.tx, G.tz, 1.7, dt) > 0.2 && G.stuck < 3) all = false; else { gegFace(pd, D.x, D.z, dt); if (G.gm !== 'stand') gegAct(pd, pd === lead ? 12.3 : 0.6); }
        gegPlace(pd);
      }
      if (all || E.t > 25) {
        E.ph = 'plant'; E.pt = 0;
        for (const pd of E.crooks) if (pd.gg.s === 'script') { if (pd !== lead) gegAct(pd, Math.random() < 0.5 ? 15.3 : 13.2); }
        if (lead.gg.s === 'script') gegnerSay(GWHO.anfuehrer, gegLine('anarParole'), 1, lead.gg.x, lead.gg.z);
      }
      return;
    }
    if (E.ph === 'plant') {
      E.pt += dt;
      for (const pd of E.crooks) if (pd.gg.s === 'script') { gegFace(pd, pd === lead ? spot.x : p.x, pd === lead ? spot.z : p.z, dt, 3); gegPlace(pd); }
      if (E.pt > 2.2 && !E.bomb) {
        E.bomb = gegPlantBomb(spot.x, spot.y, spot.z, MOBILE ? 50 : 42); if (!E.bomb) { gegEnd(E); for (const pd of E.crooks) if (pd.gg.s === 'script') { pd.gg.s = 'flee'; pd.gg.noShoot = true; } return; }
        E.bomb.x0 = spot.x; E.bomb.z0 = spot.z;
        gegnerSay(GWHO.anfuehrer, gegLine('anarBombe'), 2, spot.x, spot.z);
        toast('Anarchisten haben eine Bombe gelegt! Packe sie mit Telekinese (rechte Maustaste)');
        gegPanic(spot.x, spot.z, 18, true);
      }
      if (E.pt > 3.4) {
        // alle laufen auseinander; ist Alexander nah, bleiben ein oder zwei und kämpfen
        E.ph = 'wait';
        const close = Math.hypot(p.x - spot.x, p.z - spot.z) < 30;
        E.crooks.forEach((pd, i) => { const G = pd.gg; if (G.s !== 'script') return; if (close && i > 0 && i < 3) { G.s = 'fight'; G.cd = 1 + Math.random(); } else { G.s = 'flee'; G.noShoot = true; G.fleeT = 0; } });
      }
      return;
    }
    if (E.ph === 'wait') {
      const B = E.bomb;
      if (B && B.done && !E.result) {
        E.result = B.result; E.resT = 0;
      }
      // Kämpfer geben auf, wenn die Bombe weg ist
      if (E.result) { E.resT += dt; if (E.resT > 1.5) for (const pd of E.crooks) if (pd.gg.s === 'fight') { pd.gg.s = 'flee'; pd.gg.noShoot = true; } }
      const busy = E.crooks.some(pd => pd.gg.s === 'fight' || pd.gg.s === 'flee' || pd.gg.s === 'script');
      if (E.result && !busy && E.resT > 3) gegEnd(E);
      if (E.t > 120) { for (const pd of E.crooks) if (pd.gg.s !== 'down') gegOff(pd); gegEnd(E); }
    }
  };
  return E;
}
// --- Anarchisten stellen Alexander ---
function evAngriff() {
  const p = player.p, A = gegFree('anarchist'); if (A.length < 3) return null;
  const n = Math.min(A.length, 4 + (Math.random() < 0.4 ? 1 : 0)), crew = [];
  const c = gegSpot(p.x, p.z, 26, 36, true); if (!c) return null;
  for (let i = 0; i < n; i++) {
    const s = gegSpot(c.x, c.z, 0.5, 5, false); if (!s) continue;
    const pd = A[i]; gegSpawn(pd, s.x, s.y, s.z, Math.atan2(p.x - s.x, p.z - s.z)); crew.push(pd);
  }
  if (crew.length < 3) { for (const pd of crew) gegOff(pd); return null; }
  const E = { label: 'Anarchisten greifen an', crooks: crew, ph: 'fight', where: () => { let x = 0, z = 0, m = 0; for (const pd of crew) if (pd.gg.s !== 'off') { const P = gegPos(pd); x += P[0]; z += P[1]; m++; } return m ? [x / m, z / m] : [c.x, c.z]; } };
  crew.forEach((pd, i) => { const G = pd.gg; G.ev = E; G.s = 'fight'; G.lead = i === 0; G.gun = i === 1; G.cd = 1.2 + i * 0.7; G.want = 10 + Math.random() * 5; });
  gegnerSay(GWHO.anfuehrer, gegLine('anarAngriff'), 2, crew[0].gg.x, crew[0].gg.z);
  E.onDown = () => { E.downs = (E.downs || 0) + 1; if (E.downs >= Math.ceil(crew.length * 0.6) && !E.broken) { E.broken = true; const L = crew.find(pd => pd.gg.s === 'fight'); if (L) gegnerSay(GWHO.anarchist, gegLine('anarFlucht'), 2, L.gg.x, L.gg.z); for (const pd of crew) if (pd.gg.s === 'fight') { pd.gg.s = 'flee'; pd.gg.fleeT = 0; } } };
  E.step = dt => {
    const busy = crew.some(pd => pd.gg.s === 'fight' || pd.gg.s === 'flee');
    if (!busy || E.t > 150) { if (busy) for (const pd of crew) if (pd.gg.s !== 'down') gegOff(pd); gegEnd(E); }
    if (E.t > 70 && !E.broken) { E.broken = true; for (const pd of crew) if (pd.gg.s === 'fight') { pd.gg.s = 'flee'; pd.gg.fleeT = 0; } }
  };
  gegPanic(c.x, c.z, 20, false);
  return E;
}

// Leute in der Nähe erschrecken: Stehende ducken sich oder halten die Hände hoch, alle schauen hin; einer ruft
function gegPanic(x, z, R, bomb) {
  let said = false;
  for (const pd of peds) {
    if (pd.gg || !pd.a || !pd.a.on || pd.rag || pd.back || pd.ggSave) continue;
    const e = pd.a.m.elements, d2 = (e[12] - x) ** 2 + (e[14] - z) ** 2; if (d2 > R * R) continue;
    turnHead(pd.a, x, z);
    if (pd.st === 4 && !pd.sit && !pd.busy && !pd.aw && pd.ggPanic == null) { pd.ggPanic = { t: 4 + Math.random() * 4, act: pd.a.gait[1] }; setAct(pd, Math.random() < 0.6 ? 13.2 : 8.2); GEGNER.panicked.push(pd); }
    if (!said && d2 > 9 && Math.random() < 0.5) { said = true; if (GEGNER.sayT <= 0) { GEGNER.sayT = 4; gegnerSay(whoOf(pd), bomb ? 'Eine Bombe! Alle weg hier!' : gegLine('zuschauerAngst'), 1, e[12], e[14]); } }
  }
}
GEGNER.panicked = []; GEGNER.thaw = [];
function gegUpdatePanic(dt) {
  for (let i = GEGNER.panicked.length - 1; i >= 0; i--) {
    const pd = GEGNER.panicked[i], P = pd.ggPanic;
    if (!P || (P.t -= dt) <= 0 || pd.aw || pd.rag) { if (P && !pd.rag && pd.a && !pd.aw) setAct(pd, P.act); pd.ggPanic = null; GEGNER.panicked.splice(i, 1); }
  }
}

/* ---------- Festnahme: Polizisten laufen herbei, stellen ihn auf die Füße, führen ihn ab ---------- */
function gegUpdateArrests(dt) {
  for (let i = GEGNER.arrests.length - 1; i >= 0; i--) {
    const A = GEGNER.arrests[i], C = A.crook, G = C.gg;
    A.t += dt;
    if (G.s === 'off') { for (const c of A.cops) if (c.gg.s !== 'off') gegOff(c); GEGNER.arrests.splice(i, 1); continue; }
    const [cx, cz] = gegPos(C);
    // wieder hochgehoben (Telekinese): die Polizisten warten, bis er unten liegt
    if (C.rag && (A.ph === 'cuff' || A.ph === 'rise' || A.ph === 'lead')) { A.ph = A.cops.length ? 'come' : 'wait'; A.t = 0; }
    if (A.ph === 'wait') {
      if (G.s !== 'down' || C.rag || A.t < 1.4) continue;
      if (A.cops.some(c => c.gg.s === 'cop')) { A.ph = 'come'; A.t = 0; continue; }   // die Polizisten sind schon da
      const free = gegFree('polizei');
      if (free.length) {
        const want = Math.min(free.length, Math.random() < 0.6 ? 2 : 1), s0 = gegSpot(cx, cz, 22, 32, true) || gegSpot(cx, cz, 6, 45, false);   // V61: eng bebaut (Bank, Gassen): auch näher
        if (s0) {
          A.cops = free.slice(0, want); A.from = s0; A.under = !!s0.under;
          A.cops.forEach((c, j) => { gegSpawn(c, s0.x + j * 0.9, s0.y, s0.z + j * 0.4, Math.atan2(cx - s0.x, cz - s0.z)); c.gg.s = 'cop'; c.gg.arrest = A; c.gg.side = j ? -1 : 1; });
          A.ph = 'come'; A.t = 0; gegSnd('whistle', s0.x, s0.z, 1);
          continue;
        }
      }
      if (A.t > 30) { A.ph = 'rise'; A.t = 0; A.solo = true; }   // keine Polizei frei: rappelt sich auf und humpelt davon
      continue;
    }
    if (A.ph === 'come') {
      let all = true;
      A.cops.forEach((c, j) => {
        const K = c.gg; if (K.s !== 'cop' || c.rag || c.back) { all = false; return; }
        const yaw = G.lie ? G.lie.yaw : 0, ox = Math.cos(yaw) * (j ? -0.9 : 0.9), oz = -Math.sin(yaw) * (j ? -0.9 : 0.9);
        const d = Math.hypot(cx + ox - K.x, cz + oz - K.z), run = d > 3.5;
        gegGait(c, run ? 'run' : 'walk', run ? 4.6 : 1.4);
        if (gegStep(c, cx + ox, cz + oz, run ? 4.6 : 1.4, dt) > 0.25) all = false;
        if (K.stuck > 3) { const s = gegSpot(cx, cz, 2, 4, true); if (s) { K.x = s.x; K.z = s.z; K.y = s.y; K.stuck = 0; } }
        gegPlace(c);
      });
      if (all || A.t > 30) {
        A.ph = 'cuff'; A.t = 0;
        for (const c of A.cops) { if (c.gg.s === 'cop') gegAct(c, 4.3); }
        const c0 = A.cops[0];
        if (c0 && c0.gg.s === 'cop') {
          const near = Math.hypot(player.p.x - cx, player.p.z - cz) < 14;
          gegnerSay(GWHO.polizei, gegLine(near && Math.random() < 0.6 ? 'polizeiDank' : 'polizei'), 1, cx, cz);
          if (near && c0.a.on) turnHead(c0.a, player.p.x, player.p.z);
        }
      } else continue;
    }
    if (A.ph === 'cuff') {
      for (const c of A.cops) if (c.gg.s === 'cop' && !c.rag && !c.back) { gegFace(c, cx, cz, dt); gegPlace(c); }
      if (A.t > 1.6) { A.ph = 'rise'; A.t = 0; }
      continue;
    }
    if (A.ph === 'rise') {
      // vom Rücken auf die Füße (um die Füße hochgeklappt), dann Hände hoch
      if (G.s === 'down') { G.s = 'rise'; G.t = 0; gegAct(C, 8.2); }
      if (G.s !== 'rise') continue;
      G.t += dt; const k = Math.min(1, G.t / 1.0), e = k * k * (3 - 2 * k);
      G.tilt = -HALF_PI * (1 - e);
      if (G.lie) { G.x = G.lie.x; G.z = G.lie.z; G.y = G.lie.y; G.yaw = G.lie.yaw; }   // klappt um die Füße hoch und schaut dann dorthin, wo seine Füße lagen
      pedCrowd.set(C.a, G.x, G.y + 0.13 * (1 - e), G.z, G.yaw, C.sc, G.tilt);
      for (const c of A.cops) if (c.gg.s === 'cop' && !c.rag && !c.back) { gegFace(c, G.x, G.z, dt); gegPlace(c); }
      if (k >= 1) {
        G.tilt = 0; G.lie = null; A.ph = 'lead'; A.t = 0; G.s = 'led';
        // abführen: weg von Alexander (oder zurück, woher die Polizei kam)
        const from = A.from || { x: G.x + (G.x - player.p.x), z: G.z + (G.z - player.p.z) };
        const dx = from.x - G.x, dz = from.z - G.z, L = Math.hypot(dx, dz) || 1;
        A.go = A.under ? { x: from.x, z: from.z } : { x: G.x + dx / L * 40, z: G.z + dz / L * 40 };   // V61: im Versteck zur Leiter
        if (A.solo) { G.s = 'flee'; G.spd = 1.6; G.noShoot = true; G.limp = true; GEGNER.arrests.splice(i, 1); G.arrest = null; }
        else { GEGNER.stats.gefasst++; gegFire('gefasst', C, G.x, G.z); }
      }
      continue;
    }
    if (A.ph === 'lead') {
      if (G.s !== 'led') continue;
      gegGait(C, 'walk', 1.25); gegStep(C, A.go.x, A.go.z, 1.25, dt); gegPlace(C);
      A.cops.forEach((c, j) => {
        const K = c.gg; if (K.s !== 'cop' || c.rag || c.back) return;
        const tx = G.x + Math.cos(G.yaw) * (j ? -0.75 : 0.75) - Math.sin(G.yaw) * 0.3, tz = G.z - Math.sin(G.yaw) * (j ? -0.75 : 0.75) - Math.cos(G.yaw) * 0.3;
        const d = Math.hypot(tx - K.x, tz - K.z); gegGait(c, d > 2 ? 'run' : 'walk', d > 2 ? 3.5 : 1.3); gegStep(c, tx, tz, d > 2 ? 3.5 : 1.35, dt); gegPlace(c);
      });
      const cp = camera.position;
      if (A.t > 20 || Math.hypot(G.x - A.go.x, G.z - A.go.z) < 1 || (A.t > 6 && Math.hypot(G.x - cp.x, G.z - cp.z) > 110)) {
        gegOff(C); for (const c of A.cops) gegOff(c);
        if (G.after) { G.after(); G.after = null; }
        GEGNER.arrests.splice(i, 1);
      }
    }
  }
}

/* ---------- Jede Figur, jedes Bild ---------- */
function gegStepOne(pd, dt) {
  const G = pd.gg, a = pd.a; if (!a || G.s === 'off') return;
  const p = player.p;
  // Puppe (umgeworfen, gehalten, geworfen)
  const s = pd.rag;
  if (s) {
    pd.st = 4; pd.x = s.p[0][0]; pd.z = s.p[0][2]; pd.y = s.gy; pd.yaw = G.yaw; G.x = pd.x; G.z = pd.z; G.y = s.gy;
    if (s.ph === 'tk') { gegHeld(pd); return; }
    if (G.role === 'polizei') { G.held = false; return; }   // Polizisten stehen von selbst wieder auf
    if (s.ph === 'drop') { s.ph = 'fly'; s.t = 0; }   // losgelassen: fällt wie ein Stein
    if (s.ph === 'up') { s.ph = 'lie'; s.t = 0; }
    if (G.s !== 'down') { G.fall = null; gegDefeat(pd, G.held ? 'tk' : 'hit'); }
    G.held = false;
    if (s.ph === 'lie') gegLayFromRag(pd, s);
    return;
  }
  if (pd.back) return;   // Polizist nach dem Aufstehen (ragdoll.js führt ihn zurück)
  if (pd.st !== GST) { pd.st = GST; G.gm = null; }
  if (G.s === 'getup') {   // V61: der Anführer steht wieder auf (um die Füße hochgeklappt) und kämpft weiter
    G.t += dt; const k = Math.min(1, G.t / 0.8), e = k * k * (3 - 2 * k);
    G.tilt = -HALF_PI * (1 - e);
    if (G.lie) { G.x = G.lie.x; G.z = G.lie.z; G.y = G.lie.y; G.yaw = G.lie.yaw; }
    pedCrowd.set(a, G.x, G.y + 0.13 * (1 - e), G.z, G.yaw, pd.sc, G.tilt);
    if (k >= 1) { G.tilt = 0; G.lie = null; G.s = G.was || 'fight'; G.cd = 0.5; G.gm = null; if (G.onUp) G.onUp(pd); }
    return;
  }
  if (G.s === 'down') {
    if (G.recover > 0 && G.lie && !G.fall && (G.recover -= dt) <= 0) { G.s = 'getup'; G.t = 0; gegAct(pd, 13.1); return; }
    // ohne Puppe umgefallen: kippt nach hinten um, liegt dann
    if (G.fall) {
      const F = G.fall; F.t += dt; const k = Math.min(1, F.t / 0.45);
      G.tilt = -HALF_PI * k * k; G.yaw = F.yaw;
      pedCrowd.set(a, G.x, G.y + 0.13 * k, G.z, G.yaw, pd.sc, G.tilt);
      if (k >= 1) { G.lie = { x: G.x, y: G.y, z: G.z, yaw: G.yaw }; G.fall = null; }
    } else if (G.lie) pedCrowd.set(a, G.lie.x, G.lie.y + 0.13, G.lie.z, G.lie.yaw, pd.sc, -HALF_PI);
    // Wucht im Flug oder Heldenlandung neben einem Liegenden: nichts weiter
    return;
  }
  if (G.s === 'rise' || G.s === 'led' || G.s === 'cop' || G.s === 'script') {
    gegContact(pd, dt);
    if (pd.rag || G.s === 'down') return;
    if (G.s === 'script') return;   // das Ereignis bewegt ihn
    return;   // Festnahme bewegt ihn
  }
  // Wer Alexander zu nahe kommt, fliegt um
  gegContact(pd, dt);
  if (pd.rag || G.s === 'down') return;
  const dAlex = Math.hypot(G.x - p.x, G.z - p.z);
  if (G.ai && G.s === 'fight') { G.ai(pd, dt, dAlex); gegPlace(pd); return; }   // V61: eigener Kampf (der Anführer, anfuehrer.js)
  if (G.s === 'flee') {
    G.fleeT = (G.fleeT || 0) + dt;
    // weg von Alexander, alle halbe Sekunde ein neues Ziel; festgefahren: andere Richtung
    if (!G.fl || (G.flT = (G.flT || 0) - dt) <= 0 || G.stuck > 1.2) {
      let ax = G.x - p.x, az = G.z - p.z; const L = Math.hypot(ax, az) || 1; ax /= L; az /= L;
      const an = Math.atan2(ax, az) + (G.stuck > 1.2 ? (Math.random() < 0.5 ? 1.6 : -1.6) : (Math.random() - 0.5) * 0.9);
      G.fl = [G.x + Math.sin(an) * 10, G.z + Math.cos(an) * 10]; G.flT = 0.6; G.stuck = 0;
    }
    const v = G.limp ? 1.4 : G.spd || 5.4;
    gegGait(pd, G.limp ? 'walk' : 'run', v); gegStep(pd, G.fl[0], G.fl[1], v, dt);
    // in die Enge getrieben: der Räuber schießt
    if (G.role === 'raeuber' && !G.noShoot && dAlex < 7 && (G.cd -= dt) <= 0 && G.shots < 6) {
      G.cd = 1.4 + Math.random() * 1.6; G.shots++; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); gegAct(pd, 4.3); gegShot(pd);
      if (Math.random() < 0.5) gegnerSay(GWHO.raeuber, gegLine('raubSchiess'), 1, G.x, G.z);
      G.aim = 0.45;
    }
    if (G.aim > 0) { G.aim -= dt; G.yaw = Math.atan2(p.x - G.x, p.z - G.z); }
    gegPlace(pd);
    const cp = camera.position, dc = Math.hypot(G.x - cp.x, G.z - cp.z);
    if ((dAlex > (G.role === 'dieb' ? 65 : 75) && dc > 60) || G.fleeT > 70 || (G.limp && (G.fleeT > 25 || (dAlex > 35 && dc > 35)))) { gegOff(pd); if (G.after) { G.after(); G.after = null; } }
    return;
  }
  if (G.s === 'fight') {
    const up = p.y - G.y, far = dAlex > (G.want || 12) + 3, close = dAlex < 6;
    if (dAlex > 90) { gegOff(pd); return; }
    const An = G.anchor, dA = An ? Math.hypot(G.x - An.x, G.z - An.z) : 0;   // V61: hinter der Barrikade bleiben (Aufstand), im Versteck beim Platz
    if (An && dA > An.r && !(An.loose && dAlex < An.loose)) { gegGait(pd, 'run', 3.6); gegStep(pd, An.x, An.z, 3.6, dt); }
    else if (An && !close) { gegFace(pd, p.x, p.z, dt); if (G.gm !== 'stand') gegAct(pd, G.gun ? 12.3 : 13.1); }
    else if (far) { gegGait(pd, 'run', 3.8); gegStep(pd, p.x, p.z, 3.8, dt); }
    else if (close) { const ax = G.x - p.x, az = G.z - p.z, L = Math.hypot(ax, az) || 1; gegGait(pd, 'walk', 1.6); gegStep(pd, G.x + ax / L * 3, G.z + az / L * 3, 1.6, dt); gegFace(pd, p.x, p.z, dt); }
    else { gegFace(pd, p.x, p.z, dt); if (G.gm !== 'stand') gegAct(pd, G.gun ? 12.3 : 13.1); }
    G.cd -= dt;
    if (G.cd <= 0 && dAlex < 34 && up < 25) {
      if (G.gun) { G.cd = 0.9 + Math.random() * 1.6; gegAct(pd, 4.3); G.yaw = Math.atan2(p.x - G.x, p.z - G.z); gegShot(pd); }
      else { G.cd = 2.2 + Math.random() * 2.4; gegAct(pd, 6.6); G.yaw = Math.atan2(p.x - G.x, p.z - G.z); G.throwIn = 0.35; }
      G.hold = 0.8;
    }
    if (G.throwIn > 0 && (G.throwIn -= dt) <= 0) gegThrow(pd, Math.random() < 0.35 ? 'bottle' : 'stone');
    if (G.hold > 0 && (G.hold -= dt) <= 0) gegAct(pd, G.gun ? 12.3 : 13.1);
    if ((G.said -= dt) <= 0 && Math.random() < dt * 0.6) { G.said = 6; gegnerSay(G.lead ? GWHO.anfuehrer : GWHO.anarchist, gegLine(GEGNER.abprall > 0 ? 'anarAbprall' : 'anarParole'), 0, G.x, G.z); }
    gegPlace(pd);
  }
}
// Berührung: Alexander läuft oder fliegt in einen Gegner hinein, und der fliegt um
function gegContact(pd, dt) {
  const G = pd.gg, p = player.p; if (G.role === 'polizei' || DRIVE.on) return;
  if (G.s === 'led' || G.s === 'rise') return;
  const dx = G.x - p.x, dz = G.z - p.z, dy = G.y - p.y, d = Math.hypot(dx, dz);
  const sp = Math.hypot(player.v.x, player.v.z, player.fly ? player.v.y : 0);
  if (d > (player.fly ? 1.3 : 0.9) || Math.abs(dy) > 1.8) return;
  if (sp < (player.fly ? 5 : 2.2)) return;
  if (G.tough && sp < 15) return;   // V61: den Anführer wirft man nicht im Vorbeigehen um
  const k = Math.min(1, sp / 20), ux = player.v.x / (sp || 1), uz = player.v.z / (sp || 1);
  gegKnock(pd, ux * (5 + 10 * k), uz * (5 + 10 * k), p.x, p.z);
  POWERS.shake = Math.min(1, (POWERS.shake || 0) + 0.15);
  fxEmit('crystal', G.x, G.y + 1.1, G.z, ux * 2, 1, uz * 2, 8, 0.3, 0.8);
  gegSnd('stone', G.x, G.z, 0.8);
}

/* ---------- Hinweis oben: was, wo, wie weit, Zündschnur ---------- */
function gegHud() {
  const E = GEGNER.ev;
  let el = GEGNER.hud;
  if (!E) { if (el) el.style.opacity = 0; return; }
  if (!el) {
    const st = document.createElement('style');
    st.textContent = '#gegner{position:fixed;z-index:9;left:50%;top:calc(62px + env(safe-area-inset-top,0px));transform:translateX(-50%);padding:6px 16px 5px;background:var(--panel,rgba(5,16,24,.8));border:1px solid rgba(190,70,55,.7);color:var(--ink,#efe6d2);font-size:13px;letter-spacing:.12em;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .4s}#gegner i{display:inline-block;font-style:normal;color:#f0a070;margin-right:8px}#gegner b{color:var(--gold-hi,#f6dc9a);font-weight:600}';
    document.head.appendChild(st);
    el = GEGNER.hud = document.createElement('div'); el.id = 'gegner'; el.className = 'hud'; document.body.appendChild(el);
    el.innerHTML = '<i>▲</i><b></b><span></span>';
  }
  const [x, z] = E.where(), p = player.p, d = Math.hypot(x - p.x, z - p.z), f = camera.getWorldDirection(_gd);
  const rel = Math.atan2((x - p.x) * -f.z + (z - p.z) * f.x, (x - p.x) * f.x + (z - p.z) * f.z);
  el.children[0].style.transform = 'rotate(' + (rel * 57.3).toFixed(0) + 'deg)';
  el.children[1].textContent = E.label;
  const bm = E.bomb && !E.bomb.done ? E.bomb : null;
  el.children[2].textContent = ' · ' + Math.round(d) + ' m' + (bm ? ' · Zündschnur ' + Math.max(0, Math.ceil(bm.t)) + ' s' : '');
  el.style.opacity = 1;
}

/* ---------- Jedes Bild (aus updatePedestrians, vor pedCrowd.flag) ---------- */
export function updateGegner(dt) {
  if (!pedCrowd || !GEGNER.list.length) return;
  dt = Math.min(dt, 0.1);
  GEGNER.sayT -= dt; GEGNER.hitT -= dt; GEGNER.abprall = (GEGNER.abprall || 0) - dt;
  // Heldenlandung neben Gegnern: alle im Umkreis fliegen um (powers.js setzt POWERS.hero bei jeder großen Landung neu)
  const H = POWERS.hero;
  if (H && H !== GEGNER.heroSeen) { GEGNER.heroSeen = H; gegnerTreffer(player.p.x, player.p.y, player.p.z, 6 + 8 * (H.k || 0.5), 0.5 + 0.5 * (H.k || 0.5)); }
  gegUpdateProj(dt); gegUpdateBombs(dt); gegUpdateFires(dt); gegUpdatePanic(dt);
  if (GEGNER.thaw.length) GEGNER.thaw = GEGNER.thaw.filter(v => !gegUnfreeze(v));
  for (const S of GEGNER.scorch) if (S.visible) { S.t += dt; if (S.t > 40) S.material.opacity = Math.max(0, 0.9 * (1 - (S.t - 40) / 15)); if (S.t > 55) S.visible = false; }
  for (const f of GEGNER.hooks) f(dt);   // V61: Anführer, Verstecke
  const E = GEGNER.ev;
  if (E) { E.t += dt; E.step(dt); }
  for (const pd of GEGNER.list) gegStepOne(pd, dt);
  gegUpdateArrests(dt);
  // Jubel, wenn einer am Boden liegt
  if (GEGNER.cheerT > 0 && (GEGNER.cheerT -= dt) <= 0) {
    const d = Math.hypot(GEGNER.cheerX - player.p.x, GEGNER.cheerZ - player.p.z);
    if (d < 40) { aweBurst('throw', 34, 0.6); if (Math.random() < 0.5 && GEGNER.sayT <= 0) { GEGNER.sayT = 6; gegnerSay('Ein Passant', gegLine('zuschauerJubel'), 0); } }
  }
  if (!E && GEGNER.on && (GEGNER.nextT -= dt) <= 0) { if (!gegnerStart()) GEGNER.nextT = 10; }
  gegHud();
}

// Taste J: sofort das nächste Ereignis (zum Ausprobieren), der Reihe nach Überfall, Taschendieb, Bombe, Angriff
if (typeof window !== 'undefined') window.addEventListener('keydown', e => {
  if (e.code !== 'KeyJ' || e.repeat || !pedCrowd || e.shiftKey) return;   // V61: Umschalt+J gehört den Verstecken
  if (GEGNER.ev) { toast('Es ist schon etwas los: ' + GEGNER.ev.label); return; }
  if (UNTER.test && UNTER.test(player.p)) { toast('Unter der Stadt: erst wieder hinaufsteigen'); return; }
  for (let i = 0; i < EV_TYPES.length; i++) { const t = EV_TYPES[GEGNER.cycle++ % EV_TYPES.length]; if (gegnerStart(t)) { toast('Ärger in der Nähe: ' + GEGNER.ev.label); return; } }
  toast('Hier ist gerade niemand für einen Überfall (auf die Straße gehen)');
});
Object.assign(GEGNER, { start: gegnerStart, treffer: gegnerTreffer, say: gegnerSay });
GEGNER.listen = [];
// V61: Werkzeug für anfuehrer.js und verstecke.js (dieselben Bewegungen, Würfe, Festnahmen wie oben)
export const GEG = { GST, HALF_PI, pick: gegPick, wrap: gegWrap, line: gegLine, GSAY, GWHO, spawn: gegSpawn, off: gegOff, step: gegStep, gait: gegGait, act: gegAct,
  place: gegPlace, face: gegFace, pos: gegPos, dist: gegDist, free: gegFree, spot: gegSpot, blocked: gegBlocked, ground: gegGround, knock: gegKnock,
  throwAt: gegThrow, shot: gegShot, snd: gegSnd, panic: gegPanic, hitAlex: gegHitAlex, plantBomb: gegPlantBomb, scorch: gegScorch, end: gegEnd, fire: gegFire,
  fires: () => GEGNER.fires, shatter: gegShatter };
