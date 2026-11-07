/* =====================================================================
   V61 · GALA IM BELMONT ZU EHREN VON ALEXANDER
   Ein ganzer Abend im Grand Ballroom, ausgelöst bei Direktor Hartmann
   (steht links vor der Bühne, E: „Mit Direktor Hartmann sprechen“):
     1. Einzug: Tusch, Fanfare, ein Scheinwerfer folgt Alexander, der ganze
        Saal erhebt sich, dreht sich zu ihm und applaudiert.
     2. Reden: Direktor Hartmann und Bürgermeister von Arnim gehen auf die
        Bühne ans Mikrofon (die Sängerin tritt zur Seite) und reden;
        der Stadtrat verleiht den Goldenen Stern von Vespera.
     3. Alexanders Rede: vier Reden zur Wahl (Dank, Vision, kurz, großzügig).
     4. Toast: alle heben die Gläser, Gläserklingen, „Auf Alexander!“.
     5. Ehrenwalzer: die Paare treten an den Rand und klatschen, ein Paar tanzt
        allein im Scheinwerfer, dann alle aufs Parkett (acht Paare mehr) und
        Goldregen aus Konfetti fällt von der Decke.
     6. Feuerwerk über dem Belmont in Türkis, Petrol, Gold und Champagner:
        Päonien, Ringe, Goldweiden, Sonnenfächer (immer zur Kamera gedreht),
        Glitzer, Kreuzsterne, großes Finale. Am schönsten von der Terrasse der
        Penthouse-Suite oder im Flug.
   Kommt Alexander sonst in den Ballsaal, applaudieren die Gäste (alle zwei Minuten).
   Beim ersten Besuch der Lobby bringt ein Page die Einladung.
   Technik: keine neuen Shader. Funken und Konfetti sind EIN Punktesatz mit dem
   vorhandenen Leuchtpunkt-Material (ragdoll.glowMat), nur während der Gala
   sichtbar; der Scheinwerfer ist der Strahl aus airships.makeBeam. Töne werden
   mit dem gemeinsamen AudioContext erzeugt (kein Download). Figuren nur über
   Gangarten (Handlungscodes), keine Shaderänderung.
   Für die Zeitung und andere Systeme: GALA (Zustand, Zahl der Galas, gewählte
   Rede) und das Ereignis window 'vespera-gala' ({ phase, rede }).
   ===================================================================== */
import { T, scene, shared, MOBILE, camera, $ } from './core.js';
import { glowMat } from './ragdoll.js';
import { makeBeam } from './airships.js';
import { player } from './player.js';
import { BI, inBelmont, dancers, interiorCrowd, BEL } from './belmont.js';
import { setDance } from './dance.js';
import { GOWNS, turnHead } from './serpentine.js';
import { INTERACT } from './music.js';
import { openChoice, DINE } from './venues.js';
import { SND, sndTone, sndBurst } from './audio.js';
import { VOICE, estimate } from './voice.js';
import { toast } from './boat.js';
import { playing, paused } from './input.js';

export const GALA = {
  st: 'bereit',      // bereit | laeuft | feuerwerk (nur Feuerwerk) | aus (vorbei, Fest geht weiter)
  done: 0, rede: null, step: 0, wait: 0, t: 0,
  dir: null, bm: null, singer: null, extras: [], guests: [], movers: [],
  beam: null, beamOn: 0, beamTo: null, solo: null, invited: false, enterT: 0, inBall: false, hush: 0, rain: 0,
};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const HOST = { x: -6.8, z: -36.4 }, MAYOR = { x: 6.8, z: -36.4 };

/* ---------- Figuren (aus buildBelmontInterior, vor C.finish) ---------- */
export function galaPeople(C, { P, S0, tux, gown, singer }) {
  const G = GALA; G.P = P; G.S0 = S0;
  G.dir = tux(HOST.x, P, HOST.z, 0.35); G.dir.color = [0.92, 0.9, 0.86];
  G.bm = tux(MAYOR.x, P, MAYOR.z, -0.35); G.bm.color = [0.55, 0.5, 0.42];   // Bürgermeister: Frack mit goldener Schärpe (Tönung)
  G.singer = singer;
  for (const a of [G.dir, G.bm]) a.gait[1] = 0.6;
  // acht Paare mehr, erst zum Ehrenwalzer auf dem Parkett (bis dahin unsichtbar)
  const n = MOBILE ? 4 : 8;
  for (let k = 0; k < n; k++) {
    const ang = (k + 0.5) / n * Math.PI * 2;
    const c = { ang, rho0: 0.7, cx: 0, cz: -28, h0: Math.random() * 6.28, extra: true };
    c.m = C.add('tux', [1, 1, 1]); c.w = C.add('gown', pick(GOWNS));
    G.extras.push(c);
  }
  // Gäste im Ballsaal (sitzend, stehend, auf den Galerien) mit ihrer Handlung merken
  const skip = new Set([G.dir, G.bm, singer]);
  for (const a of C.list) {
    if (skip.has(a) || a.x === undefined || a.kind === 'livery') continue;
    if (a.z < -12.6 && a.z > -48 && Math.abs(a.x) < 47 && !(a.z < -39 && a.y > P + 0.5 && a.y < S0 + 0.1)) {
      const act = a.gait[1]; G.guests.push({ a, act, sit: act > 7.5 && act < 7.9 || act > 11 && act < 11.6 });
    }
  }
  INTERACT.push({
    test: p => { const d = G.dir; if (!d || !d.k6 || p.y > 4 || G.walking) return false; return (p.x - d.k6[0]) ** 2 + (p.z - d.k6[2]) ** 2 < 2.3 * 2.3 && Math.abs(p.y - d.k6[1]) < 2.2; },
    get label() { return G.st === 'laeuft' ? 'Direktor Hartmann · die Gala' : 'Mit Direktor Hartmann sprechen · Gala zu Ihren Ehren'; },
    act: galaMenu,
  });
}

/* ---------- Sprechen (Sprechblase #say; die Stimmen aus voice.js sprechen sie von selbst) ---------- */
function say(who, s) {
  const el = $('say'); if (!el) return 3;
  el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = who; el.querySelector('span').textContent = '„' + s + '“'; el.style.opacity = 1;
  const d = Math.max(3.2, (VOICE.ok && VOICE.on ? estimate(s) : s.length / 15) + 1.0);
  shared.sayTimer = d + 0.6; GALA.lastLine = who + ': ' + s; return d;
}
function fire(phase) { try { window.dispatchEvent(new CustomEvent('vespera-gala', { detail: { phase, rede: GALA.rede, n: GALA.done } })); } catch (e) { /* alt */ } }

/* ---------- Gangarten ---------- */
function setAct(a, act, sp = 0) { if (!a) return; const g = a.gait; if (g[1] !== act || g[2] !== sp) { g[1] = act; g[2] = sp; a.gv = (a.gv | 0) + 1; } }
function walkTo(a, path, then) { GALA.movers = GALA.movers.filter(m => m.a !== a); GALA.movers.push({ a, path, i: 0, then }); setAct(a, 0, 0.36); }
function guestsDo(kind) {
  const p = player.p;
  for (const g of GALA.guests) {
    const a = g.a;
    if (kind === 'reset') { setAct(a, g.act); continue; }
    if (Math.random() < (kind === 'drink' ? 0.9 : 0.85)) {
      if (kind === 'clap') setAct(a, g.sit ? 9.8 : 9.3);
      else if (kind === 'drink') setAct(a, g.sit ? 11.4 : 5.3);
      else if (kind === 'listen') setAct(a, g.sit ? 7.2 : 0.2);
    }
    if (kind !== 'listen') turnHead(a, p.x, p.z);
  }
}

/* ---------- Ablauf ---------- */
const SPEECH = [
  ['Ein Dank an Vespera', [
    'Meine Freunde, eine Stadt ist mehr als Stahl und Marmor.',
    'Vespera, das sind Sie alle: jeder Kellner, jeder Heizer an den Kesseln, jede Dame in diesem Saal.',
    'Ich danke Ihnen. Und nun: Die Nacht ist jung!']],
  ['Die große Vision', [
    'Als ich diesen Krater fand, sah ich keine Eiswüste. Ich sah das hier.',
    'Und ich sage Ihnen: Wir sind noch lange nicht fertig. Höhere Türme, hellere Lichter, ein Vespera, von dem die ganze Welt spricht!',
    'Auf das Vespera von morgen!']],
  ['Kurz und charmant', [
    'Ich halte es kurz, meine Damen und Herren: Ich liebe diese Stadt.',
    'Maestro, die Musik!']],
  ['Großzügig: Champagner für alle', [
    'Heute Abend zahle ich. Für jeden Gast in diesem Saal und für jede Kneipe der Stadt.',
    'Champagner für alle, und gleich ein Feuerwerk, das man bis nach Europa sieht!']],
];
// V66 Kanon: viel Beifall, aber nicht jeder im Saal meint ihn so
const CHEERS = ['Bravo!', 'Hoch soll er leben!', 'Was für ein Mann!', 'Auf Alexander!', 'Wunderbar gesagt!', 'Bravo, bravissimo!', 'Das war eine Rede!', 'Hübsch gesagt. Wer den Saal besitzt, bekommt auch den Beifall.', 'Klatschen Sie, Liebling. Er schaut herüber.'];
const CHEER_WHO = ['Eine Dame', 'Ein Herr', 'Eine Dame auf der Galerie', 'Ein Herr an der Bar', 'Eine junge Dame', 'Ein alter Herr'];
const ENTER = ['Alexander! Er ist da!', 'Seht nur, Alexander kommt!', 'Applaus für den Herrn von Vespera!', 'Guten Abend, Alexander!', 'Der Gründer persönlich!'];

const MIC = () => [0, GALA.S0, -40.7];
// Weg vom Platz vor der Bühne über die Stufen (Mitte, z -37.4 bis -39) ans Mikrofon
const toMic = (x) => { const P = GALA.P, S0 = GALA.S0; return [[x * 2.6, P, -36.9], [x > 0 ? 1.6 : -1.6, P, -37.2], [x > 0 ? 1.3 : -1.3, S0, -39.2], [x > 0 ? 0.5 : -0.5, S0, -40.4], MIC()]; };
const beside = (s) => [s * 1.9, GALA.S0, -40.6];

function script() {
  const G = GALA, S = [];
  const line = (who, s, extra = 0.35) => S.push({ fn: () => say(who, s) + extra });
  const wait = (s, cond) => S.push({ fn: () => s, cond });
  const doit = (f, d = 0) => S.push({ fn: () => { f(); return d; } });
  const hold = () => S.push({ fn: () => 0, until: () => !G.movers.length });
  // 1. Einzug
  doit(() => { G.hush = 1; G.beamOn = 1; G.beamTo = 'player'; tusch(); guestsDo('clap'); applause(7.5, 1); fire('einzug'); }, 1.6);
  line('Direktor Hartmann', 'Meine Damen und Herren, bitte erheben Sie sich: Alexander, der Gründer von Vespera!', 0.4);
  wait(2.5);
  doit(() => { fanfare(); guestsDo('listen'); setAct(G.singer, 0.6); G.singer.x = 2.6; G.singer.z = -41.4; walkTo(G.dir, toMic(-1)); }, 0.2);
  hold();
  // 2. Reden
  doit(() => { setAct(G.dir, 2.3); G.beamTo = 'mic'; fire('reden'); }, 0.4);
  line('Direktor Hartmann', 'Verehrte Gäste, heute Abend feiern wir den Mann, der diese Stadt aus dem ewigen Eis gehoben hat.');
  line('Direktor Hartmann', 'Er fand den Krater, als die Welt hier oben nur Nacht und Schnee sah. Und er baute uns Türme bis an die Polarlichter.');
  line('Direktor Hartmann', 'Er hat das Belmont gebaut, das schönste Haus der Welt. Und er ist, wie Sie wissen, mein Arbeitgeber, ich lobe ihn also mit Vorsicht.', 0.2);
  doit(() => { setAct(G.dir, 0.6); G.bow = { a: G.dir, t: 1.6 }; applause(4, 0.7); guestsDo('clap'); }, 2.2);
  doit(() => { guestsDo('listen'); walkTo(G.dir, [beside(-1)]); walkTo(G.bm, toMic(1)); }, 0.2);
  hold();
  doit(() => { setAct(G.bm, 2.3); setAct(G.dir, 0.2); }, 0.4);
  line('Bürgermeister von Arnim', 'Ich spreche für ganz Vespera: für die Herrschaften in den Türmen und für die Männer an den Kesseln.');
  line('Bürgermeister von Arnim', 'Ohne Alexander gäbe es keine Stadt, keine Lichter, keinen Hafen und keine einzige Straße durch diese Berge.');
  line('Bürgermeister von Arnim', 'Nicht jeder in Vespera feiert heute mit, das wissen wir alle. Auch das gehört zu einer Stadt.');
  line('Bürgermeister von Arnim', 'Darum verleiht Ihnen der Stadtrat heute den Goldenen Stern von Vespera.', 0.2);
  doit(() => { tusch(); guestsDo('clap'); applause(5, 1); toast('Auszeichnung: der Goldene Stern von Vespera'); G.stars = (G.stars | 0) + 1; G.beamTo = 'player'; fire('stern'); }, 3.2);
  line('Bürgermeister von Arnim', 'Alexander, bitte: ein Wort an Ihre Stadt!', 0.2);
  // 3. Alexanders Rede (Wahl), wird erst beim Ablauf eingesetzt
  doit(() => { setAct(G.bm, 0.6); guestsDo('listen'); speechMenu(); }, 0);
  S.push({ fn: () => 0, until: () => G.rede != null });
  S.push({ fn: () => { G.beamTo = 'player'; return 0.2; } });
  S.push({ speech: true });
  doit(() => { guestsDo('clap'); applause(7, 1.1); cheers(3); fire('rede'); }, 6.5);
  // 4. Toast
  doit(() => { setAct(G.bm, 5.3); guestsDo('listen'); }, 0.2);
  line('Bürgermeister von Arnim', 'Meine Damen und Herren, die Gläser hoch: Auf Alexander und auf Vespera!', 0.1);
  doit(() => { guestsDo('drink'); clinks(5); G.rain = 1; fire('toast'); }, 0.8);
  line('Die Gäste', 'Auf Alexander!', 2.5);
  // 5. Ehrenwalzer
  doit(() => { G.rain = 0; setAct(G.bm, 0.6); walkTo(G.bm, [[1.6, G.S0, -40.0], [1.3, G.S0, -39.2], [1.6, G.P, -37.2], [MAYOR.x, G.P, MAYOR.z]]); }, 0.3);
  line('Direktor Hartmann', 'Und nun der Ehrenwalzer! Maestro, bitte!', 0.2);
  doit(() => { G.hush = 0; soloStart(); G.beamTo = 'solo'; walkTo(G.dir, [[-1.3, G.S0, -39.2], [-1.6, G.P, -37.2], [HOST.x, G.P, HOST.z]]); setAct(G.singer, 23); G.singer.x = 0; G.singer.z = -40.6; fire('walzer'); }, 22);
  doit(() => { soloEnd(); G.rain = 1; G.beamTo = 'player'; applause(4, 0.8); }, 0.3);
  line('Direktor Hartmann', 'Und jetzt alle Paare aufs Parkett!', 18);
  // 6. Feuerwerk
  doit(() => { G.rain = 0; }, 0.2);
  line('Direktor Hartmann', 'Und nun, meine Herrschaften: der Himmel über Vespera! Das Feuerwerk zu Ehren von Alexander!', 0.2);
  doit(() => { startFireworks(G.rede === 3 ? 110 : 80); G.beamOn = 0; toast('Feuerwerk über dem Belmont · am schönsten von der Penthouse-Terrasse oder im Flug (F)'); fire('feuerwerk'); }, 4);
  doit(() => endGala(), 0);
  return S;
}
function speechMenu() {
  const G = GALA; G.menuT = 0;
  openChoice('Ihre Rede, Alexander', SPEECH.map(s => s[0]), i => { G.rede = i; });
}
function endGala() {
  const G = GALA; G.st = 'aus'; G.done++; G.hush = 0; G.beamOn = 0; G.rain = 0; G.script = null;
  guestsDo('reset'); fire('ende');
}

export function startGala() {
  const G = GALA;
  if (G.st === 'laeuft') return;
  G.st = 'laeuft'; G.rede = null; G.step = 0; G.wait = 0; G.script = script(); G.menuT = null;
  // Bühnenleute an den Ausgangspunkt
  G.movers = [];
  G.dir.x = HOST.x; G.dir.z = HOST.z; G.bm.x = MAYOR.x; G.bm.z = MAYOR.z;
}
function galaMenu() {
  const G = GALA;
  if (G.st === 'laeuft') {
    openChoice('Direktor Hartmann · die Gala', ['Weiter so, Hartmann', 'Gleich zum Feuerwerk', 'Die Gala beenden'], i => {
      if (i === 1) { G.script = G.script.slice(-3); G.step = 0; G.wait = 0; G.rede ??= -1; soloEnd(); G.hush = 0; }
      else if (i === 2) { soloEnd(); endGala(); say('Direktor Hartmann', 'Sehr wohl, Herr Alexander. Die Kapelle spielt weiter.'); }
    });
    return;
  }
  say('Direktor Hartmann', G.done ? 'Herr Alexander! Die Gäste sprechen noch immer von Ihrer Rede. Noch eine Runde?' : 'Herr Alexander, der ganze Saal wartet auf Sie. Heute Abend feiert Vespera nur einen Mann.');
  openChoice('Direktor Hartmann', ['Die Gala zu meinen Ehren beginnen', 'Nur das Feuerwerk zünden', 'Champagner für alle!', 'Später, Hartmann'], i => {
    if (i === 0) startGala();
    else if (i === 1) { say('Direktor Hartmann', 'Sofort, Herr Alexander. Das Feuerwerk über dem Belmont!'); startFireworks(60); toast('Feuerwerk über dem Belmont · am schönsten von der Penthouse-Terrasse oder im Flug (F)'); fire('feuerwerk'); }
    else if (i === 2) { say('Der Oberkellner', 'Champagner für alle, auf Kosten von Herrn Alexander!'); G.champ = 6; guestsDo('drink'); clinks(4); applause(4, 0.7); cheers(1); fire('champagner'); }
  });
}

/* ---------- Ehrenwalzer: ein Paar allein, die anderen am Rand ---------- */
function soloStart() {
  const G = GALA; if (!dancers.length) return;
  G.solo = dancers[0];
  const rest = dancers.slice(1), n = rest.length;
  rest.forEach((c, k) => {
    c.off = true;
    const a = (k + 0.5) / n * Math.PI * 2, ex = Math.cos(a) * 15.8, ez = -28 + Math.sin(a) * 9.4;
    const yaw = Math.atan2(-ex, -28 - ez);
    c.edge = [ex, ez, yaw];
    setAct(c.m, 9.3); setAct(c.w, 9.3);
  });
}
function soloEnd() {
  const G = GALA; if (!G.solo) return; G.solo = null;
  for (const c of dancers) if (c.off) { c.off = false; c.edge = null; setDance(c, c.mode); c.m.gv = (c.m.gv | 0) + 1; c.w.gv = (c.w.gv | 0) + 1; }
  // die zusätzlichen Paare kommen dazu (danach bleiben sie)
  for (const c of G.extras) if (!c.joined) { c.joined = true; setDance(c, Math.random() < 0.2 ? 'charl' : 'fox'); c.cx = rnd(-9, 9); c.cz = -28 + rnd(-3, 3); dancers.push(c); }
}

/* ---------- Jedes Bild (vor updateInterior, damit Randpaare und Redner im selben Bild stehen) ---------- */
const _v = new T.Vector3();
export function updateGala(dt) {
  const G = GALA, C = interiorCrowd;
  updateSparks(dt);
  if (!C || !G.dir) return;
  const p = player.p;
  const inB = inBelmont(p.x, p.z, p.y), inBall = inB && p.z < -5 && p.z > -48;
  SND.galaHush = G.hush * (G.st === 'laeuft' ? 1 : 0);
  // Einladung durch den Pagen (einmal je Besuch des Spiels)
  if (playing && !G.invited && inB && p.z > 0) { G.invited = true; setTimeout(() => { if (GALA.st === 'bereit') { say('Ein Page', 'Eine Karte für Sie, Herr Alexander: Gala zu Ihren Ehren im Grand Ballroom. Direktor Hartmann erwartet Sie an der Bühne.'); } }, 2500); }
  // Applaus beim Betreten des Ballsaals (alle zwei Minuten)
  if (inBall && !G.inBall && G.st !== 'laeuft' && G.t - G.enterT > 120 && (playing || G.force)) {
    G.enterT = G.t; guestsDo('clap'); applause(4.5, 0.8); say(pick(CHEER_WHO), pick(ENTER)); G.clapT = 4.5;
  }
  G.inBall = inBall; G.t += dt;
  if (G.clapT > 0 && (G.clapT -= dt) <= 0 && G.st !== 'laeuft') guestsDo('reset');
  if (G.champ > 0 && (G.champ -= dt) <= 0 && G.st !== 'laeuft') guestsDo('reset');
  // Ablauf
  if (G.st === 'laeuft' && G.script && ((playing && !paused) || G.force)) {
    // die Reden warten, solange Alexander nicht im Saal ist (das Feuerwerk nicht)
    const away = !inBall && G.step < G.script.length - 3;
    if (away) { if (!G.awayHint) { G.awayHint = true; toast('Die Gala wartet im Grand Ballroom auf Sie, Alexander'); } }
    else {
      G.awayHint = false;
      // Rede-Wahl: Karte geschlossen ohne Wahl -> Alexander nickt nur (stille Rede)
      if (G.rede == null && G.menuT != null) { G.menuT += dt; if (!DINE.menuOpen && G.menuT > 0.5) G.rede = -1; }
      G.wait -= dt;
      while (G.wait <= 0 && G.script && G.step < G.script.length) {
        const s = G.script[G.step];
        if (s.until && !s.until()) break;
        if (s.speech) { G.script.splice(G.step, 1, ...speechSteps(G.rede)); continue; }
        G.step++; G.wait = s.fn();
        if (G.st !== 'laeuft') break;
      }
    }
  }
  // Redner gehen
  for (const m of G.movers) {
    const a = m.a, tg = m.path[m.i], dx = tg[0] - a.x, dz = tg[2] - a.z, d = Math.hypot(dx, dz), st = 1.15 * dt;
    if (d <= st) { a.x = tg[0]; a.z = tg[2]; a.y = tg[1]; m.i++; if (m.i >= m.path.length) { m.done = true; a.yaw = 0; setAct(a, 0.6); } }
    else { const y0 = a.y; a.x += dx / d * st; a.z += dz / d * st; a.y = y0 + (tg[1] - y0) * Math.min(1, st / d); a.yaw = Math.atan2(dx, dz); }
  }
  G.movers = G.movers.filter(m => !m.done);
  G.walking = G.movers.length > 0;
  // Verbeugung
  let bowTilt = 0;
  if (G.bow) { G.bow.t -= dt; const u = 1.6 - G.bow.t; bowTilt = -0.4 * Math.min(1, u / 0.4) * Math.min(1, Math.max(0, G.bow.t) / 0.4); if (G.bow.t <= 0) G.bow = null; }
  for (const a of [G.dir, G.bm]) C.set(a, a.x, a.y, a.z, a.yaw, 1, G.bow && G.bow.a === a ? bowTilt : 0);
  // Randpaare beim Ehrenwalzer
  for (const c of dancers) if (c.off && c.edge) {
    const [ex, ez, yaw] = c.edge, sx = Math.cos(yaw) * 0.4, sz = -Math.sin(yaw) * 0.4;
    C.set(c.m, ex + sx, BI.P, ez + sz, yaw); C.set(c.w, ex - sx, BI.P, ez - sz, yaw);
  }
  // Scheinwerfer
  updateBeam(dt, inBall);
  // Goldregen über dem Parkett
  if ((G.rain > 0 || G.champ > 0) && inBall) confetti(dt);
}
function speechSteps(i) {
  const G = GALA, S = [];
  if (i < 0) { S.push({ fn: () => { toast('Alexander nickt dem Saal zu. Mehr braucht es nicht.'); return 2.2; } }); return S; }
  const lines = SPEECH[i][1];
  for (const l of lines) S.push({ fn: () => say('Alexander', l) + 0.25 });
  if (i === 3) S.push({ fn: () => { clinks(4); guestsDo('drink'); return 0.5; } });
  return S;
}
function updateBeam(dt, inBall) {
  const G = GALA;
  if (!G.beam) { if (!G.beamOn) return; G.beam = makeBeam(BI.BALL_H - 1 - BI.P, 1.7, 0.1); G.beam.rotation.x = Math.PI; G.beam.visible = false; scene.add(G.beam); G.bx = 0; G.bz = -28; }
  const on = G.beamOn && inBall && G.st === 'laeuft';
  G.beam.visible = !!on;
  if (!on) return;
  let x = player.p.x, z = player.p.z;
  if (G.beamTo === 'mic') { x = G.bm.x < 3 && Math.abs(G.bm.z + 40.7) < 0.2 ? G.bm.x : G.dir.x; z = -40.6; }
  else if (G.beamTo === 'solo' && G.solo && G.solo.m.k6) { x = (G.solo.m.k6[0] + G.solo.w.k6[0]) / 2; z = (G.solo.m.k6[2] + G.solo.w.k6[2]) / 2; }
  const k = Math.min(1, dt * 4); G.bx += (x - G.bx) * k; G.bz += (z - G.bz) * k;
  G.beam.position.set(G.bx, BI.BALL_H - 1, G.bz);
}

/* =====================================================================
   FUNKEN: ein Punktesatz für Feuerwerk und Konfetti (glowMat, additiv)
   ===================================================================== */
const MAXP = MOBILE ? 1600 : 3200;
const SP = { pts: null, n: 0, hi: 0, cur: 0 };
let PX, PY, PZ, VX, VY, VZ, LF, LM, CR, CG, CB, SZ, DR, GR, FL;
function sparks() {
  if (SP.pts) return SP;
  PX = new Float32Array(MAXP); PY = new Float32Array(MAXP); PZ = new Float32Array(MAXP);
  VX = new Float32Array(MAXP); VY = new Float32Array(MAXP); VZ = new Float32Array(MAXP);
  LF = new Float32Array(MAXP); LM = new Float32Array(MAXP); CR = new Float32Array(MAXP); CG = new Float32Array(MAXP); CB = new Float32Array(MAXP);
  SZ = new Float32Array(MAXP); DR = new Float32Array(MAXP); GR = new Float32Array(MAXP); FL = new Uint8Array(MAXP);
  const geo = new T.BufferGeometry();
  const pos = new T.BufferAttribute(new Float32Array(MAXP * 3), 3), col = new T.BufferAttribute(new Float32Array(MAXP * 3), 3), size = new T.BufferAttribute(new Float32Array(MAXP), 1);
  for (const a of [pos, col, size]) a.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position', pos); geo.setAttribute('color', col); geo.setAttribute('size', size);
  geo.setAttribute('phase', new T.BufferAttribute(new Float32Array(MAXP), 1)); geo.setAttribute('blink', new T.BufferAttribute(new Float32Array(MAXP), 1));
  geo.setDrawRange(0, 0);
  SP.pts = new T.Points(geo, glowMat); SP.pts.frustumCulled = false; SP.pts.renderOrder = 3; SP.pts.visible = false; scene.add(SP.pts);
  return SP;
}
// Flags: 1 Glitzern, 2 Schweif (Rakete zieht Funken), 4 Kreuzstern (zerplatzt nochmal), 8 Konfetti (flattert)
function spawn(x, y, z, vx, vy, vz, life, c, size, drag, grav, fl = 0) {
  const S = sparks();
  for (let tries = 0; tries < MAXP; tries++) {
    const i = S.cur; S.cur = (S.cur + 1) % MAXP;
    if (LF[i] > 0) continue;
    PX[i] = x; PY[i] = y; PZ[i] = z; VX[i] = vx; VY[i] = vy; VZ[i] = vz; LF[i] = life; LM[i] = life;
    CR[i] = c[0]; CG[i] = c[1]; CB[i] = c[2]; SZ[i] = size; DR[i] = drag; GR[i] = grav; FL[i] = fl;
    if (i >= S.hi) S.hi = i + 1; S.n++;
    return i;
  }
  return -1;
}
// Farben (über 1 für das Nachleuchten): Türkis, Petrol, Gold, Champagner, Weißgold
const COLS = { tuerkis: [0.35, 2.4, 2.2], petrol: [0.1, 1.4, 1.5], gold: [2.6, 1.7, 0.55], champ: [2.3, 2.0, 1.4], weiss: [2.4, 2.3, 2.0] };
const PAIRS = [['tuerkis', 'gold'], ['gold', 'gold'], ['tuerkis', 'tuerkis'], ['champ', 'petrol'], ['gold', 'tuerkis'], ['weiss', 'gold']];
function updateSparks(dt) {
  if (!SP.pts) return;
  updateShow(dt);
  if (!SP.n) { SP.pts.visible = false; return; }
  SP.pts.visible = true;
  const geo = SP.pts.geometry, pa = geo.attributes.position.array, ca = geo.attributes.color.array, sa = geo.attributes.size.array;
  let hi = 0, n = 0; const h = Math.min(dt, 0.05);
  for (let i = 0; i < SP.hi; i++) {
    if (LF[i] <= 0) { if (sa[i] !== 0) { sa[i] = 0; ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0; } continue; }
    LF[i] -= h;
    if (LF[i] <= 0) {
      if (FL[i] & 4) crossette(PX[i], PY[i], PZ[i], [CR[i], CG[i], CB[i]]);
      sa[i] = 0; ca[i * 3] = ca[i * 3 + 1] = ca[i * 3 + 2] = 0; continue;
    }
    const dg = Math.max(0, 1 - DR[i] * h);
    VX[i] *= dg; VY[i] = VY[i] * dg - GR[i] * h; VZ[i] *= dg;
    if (FL[i] & 8) { VX[i] += Math.sin(LF[i] * 5 + i) * 0.9 * h; VZ[i] += Math.cos(LF[i] * 4.3 + i) * 0.9 * h; }
    PX[i] += VX[i] * h; PY[i] += VY[i] * h; PZ[i] += VZ[i] * h;
    if (FL[i] & 2 && Math.random() < 0.8) spawn(PX[i] + rnd(-0.3, 0.3), PY[i], PZ[i] + rnd(-0.3, 0.3), rnd(-1, 1), rnd(-3, -1), rnd(-1, 1), rnd(0.35, 0.7), [2.2, 1.4, 0.6], 1.1, 1.5, 4, 1);
    const u = LF[i] / LM[i];
    let f = u < 0.35 ? u / 0.35 : 1;
    if (FL[i] & 1) f *= Math.random() < 0.45 ? 1.5 : 0.15;
    pa[i * 3] = PX[i]; pa[i * 3 + 1] = PY[i]; pa[i * 3 + 2] = PZ[i];
    ca[i * 3] = CR[i] * f; ca[i * 3 + 1] = CG[i] * f; ca[i * 3 + 2] = CB[i] * f;
    sa[i] = SZ[i] * (0.6 + 0.4 * f);
    hi = i + 1; n++;
  }
  SP.n = n; SP.hi = hi;
  geo.setDrawRange(0, hi);
  geo.attributes.position.needsUpdate = geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
}

/* ---------- Konfetti im Ballsaal ---------- */
function confetti(dt) {
  const k = dt * (MOBILE ? 35 : 70);
  for (let j = 0; j < k + (Math.random() < k % 1 ? 1 : 0); j++) {
    const c = Math.random() < 0.6 ? [1.6, 1.15, 0.45] : Math.random() < 0.5 ? [0.3, 1.5, 1.4] : [1.5, 1.4, 1.2];
    spawn(rnd(-17, 17), BI.BALL_H - 2, rnd(-42, -15), rnd(-0.3, 0.3), rnd(-1.2, -0.6), rnd(-0.3, 0.3), rnd(9, 13), c, 0.09, 0.4, 0.02, 8 | (Math.random() < 0.3 ? 1 : 0));
  }
}

/* ---------- Feuerwerk über dem Belmont ---------- */
const FW = { on: false, t: 0, len: 0, next: 0, rockets: [], finale: false };
export const FEUERWERK = FW;
export function startFireworks(len = 80) { sparks(); FW.on = true; FW.t = 0; FW.len = len; FW.next = 0.5; FW.finale = false; }
const LAUNCH = [[-44, 0, -44], [44, 0, -44], [-44, 0, 44], [44, 0, 44], [-70, -33.7, 75], [70, -33.7, 75], [0, -33.7, 100]];
function updateShow(dt) {
  if (FW.on) {
    FW.t += dt; FW.next -= dt;
    const fin = FW.t > FW.len - 14;
    if (fin && !FW.finale) { FW.finale = true; }
    if (FW.next <= 0) {
      const k = fin ? (MOBILE ? 2 : 3) : 1;
      for (let j = 0; j < k; j++) launch(fin);
      FW.next = fin ? rnd(0.35, 0.6) : rnd(1.0, 2.4);
    }
    if (FW.t > FW.len) FW.on = false;
  }
  // Raketen steigen (auf einer leicht gebogenen Bahn) und platzen oben
  for (const r of FW.rockets) {
    r.t += dt; const u = Math.min(1, r.t / r.T), e = 1 - (1 - u) * (1 - u);
    const x = r.a[0] + (r.b[0] - r.a[0]) * e, y = r.a[1] + (r.b[1] - r.a[1]) * e, z = r.a[2] + (r.b[2] - r.a[2]) * e;
    if (Math.random() < (MOBILE ? 0.6 : 1)) spawn(x, y, z, rnd(-1.5, 1.5), rnd(-6, -2), rnd(-1.5, 1.5), rnd(0.4, 0.9), [2.4, 1.6, 0.7], 1.3, 1.2, 6, 0);
    if (u >= 1) { r.done = true; burst(r); }
  }
  FW.rockets = FW.rockets.filter(r => !r.done);
}
function launch(big) {
  const L = LAUNCH[Math.floor(Math.random() * LAUNCH.length)], y0 = BEL.podium + L[1];
  const ang = Math.random() * Math.PI * 2, rad = rnd(85, 175), h = rnd(140, big ? 330 : 290);
  const r = { a: [L[0], y0, L[2]], b: [Math.cos(ang) * rad, h, Math.sin(ang) * rad], t: 0, T: rnd(2.0, 3.0), big };
  r.kind = pick(big ? ['peony', 'peony', 'willow', 'fan', 'ring', 'glitter', 'cross'] : ['peony', 'peony', 'ring', 'willow', 'fan', 'glitter', 'cross']);
  r.pair = pick(PAIRS);
  FW.rockets.push(r);
  boomAt(r.a, 'pfeif');
}
function burst(r) {
  const [x, y, z] = r.b, c1 = COLS[r.pair[0]], c2 = COLS[r.pair[1]], m = MOBILE ? 0.55 : 1, big = r.big ? 1.25 : 1;
  const sph = (n, sp, life, size, drag, grav, col, fl = 0) => {
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), v = sp * rnd(0.85, 1.05);
      spawn(x, y, z, s * Math.cos(a) * v, u * v, s * Math.sin(a) * v, life * rnd(0.8, 1.15), typeof col === 'function' ? col(i) : col, size, drag, grav, fl);
    }
  };
  // Ebene zur Kamera: Ringe und Fächer sieht man immer von vorn
  _v.set(camera.position.x - x, camera.position.y - y, camera.position.z - z).normalize();
  const ax = new T.Vector3(-_v.z, 0, _v.x).normalize(), ay = new T.Vector3().crossVectors(_v, ax).normalize();
  if (r.kind === 'peony') { sph(Math.round(190 * m * big), 55 * big, 2.4, 3.4, 1.1, 5, i => i % 3 ? c1 : c2); sph(Math.round(36 * m), 22, 1.7, 2.8, 1.2, 4, COLS.weiss, 1); }
  else if (r.kind === 'willow') sph(Math.round(150 * m * big), 42 * big, 4.4, 2.8, 0.9, 7, COLS.gold, Math.random() < 0.5 ? 1 : 0);
  else if (r.kind === 'glitter') sph(Math.round(170 * m * big), 48 * big, 2.9, 2.6, 1.1, 5, i => i % 2 ? COLS.weiss : c1, 1);
  else if (r.kind === 'cross') sph(Math.round(30 * m), 40, 1.3, 3.4, 0.8, 4, c1, 4);
  else if (r.kind === 'ring') {
    const n = Math.round(90 * m * big);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, v = 58 * big; spawn(x, y, z, (ax.x * Math.cos(a) + ay.x * Math.sin(a)) * v, (ax.y * Math.cos(a) + ay.y * Math.sin(a)) * v, (ax.z * Math.cos(a) + ay.z * Math.sin(a)) * v, 2.4, c1, 3.4, 1.2, 3); }
    sph(Math.round(50 * m), 20, 1.8, 2.8, 1.0, 4, c2, 1);
  } else {
    // Sonnenfächer wie das Zeichen des Belmont: Strahlen im Halbkreis nach oben, abwechselnd Gold und Türkis
    const rays = 13, per = Math.round(9 * m * big);
    for (let k = 0; k < rays; k++) {
      const a = k / (rays - 1) * Math.PI, col = k % 2 ? COLS.tuerkis : COLS.gold;
      const dx = ax.x * Math.cos(a) + ay.x * Math.sin(a), dy = ax.y * Math.cos(a) + ay.y * Math.sin(a), dz = ax.z * Math.cos(a) + ay.z * Math.sin(a);
      for (let j = 0; j < per; j++) { const v = 62 * big * (0.35 + 0.65 * (j + 1) / per); spawn(x, y, z, dx * v, dy * v, dz * v, 2.5, col, 3.4, 1.1, 2.5); }
    }
    sph(Math.round(30 * m), 12, 1.6, 3.0, 1, 3, COLS.weiss, 1);
  }
  boomAt(r.b, r.kind === 'glitter' || r.kind === 'willow' ? 'knister' : 'knall');
}
function crossette(x, y, z, c) {
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + rnd(-0.2, 0.2), v = 24; for (let j = 0; j < 3; j++) spawn(x, y, z, Math.cos(a) * v * (0.7 + j * 0.15), rnd(-3, 3), Math.sin(a) * v * (0.7 + j * 0.15), 1.1, c, 2.8, 1.1, 4); }
}

/* ---------- Klänge (erzeugt; draußen-Bus, im Haus gedämpft) ---------- */
const sndOk = () => SND.ctx && SND.on && SND.started !== false && SND.ctx.state !== 'closed';
function boomAt(pt, kind) {
  if (!sndOk()) return;
  const cp = camera.position, d = Math.hypot(pt[0] - cp.x, pt[1] - cp.y, pt[2] - cp.z), v = Math.min(1, 160 / (d + 20));
  if (v < 0.03) return;
  const t = SND.ctx.currentTime + d / 343;
  try {
    if (kind === 'pfeif') sndTone(rnd(600, 900), t, 1.6, 0.025 * v, 'sine', 'out', rnd(1800, 2600));
    else if (kind === 'knall') { sndBurst(t, 1.4, 90, 0.7, 0.9 * v, 'out', 'lowpass', true); sndBurst(t, 0.25, 900, 0.8, 0.35 * v, 'out'); }
    else { sndBurst(t, 0.9, 110, 0.7, 0.5 * v, 'out', 'lowpass', true); for (let k = 0; k < 18; k++) sndBurst(t + 0.3 + Math.random() * 2.2, 0.03, rnd(2500, 6000), 1.5, 0.12 * v, 'out'); }
  } catch (e) { /* Ton ist Zugabe */ }
}
function applause(dur, vol) {
  if (!sndOk()) return;
  const t0 = SND.ctx.currentTime, n = Math.round(dur * (MOBILE ? 22 : 40) * vol);
  try { for (let k = 0; k < n; k++) { const u = Math.random(), env = Math.min(1, u * 5) * Math.min(1, (1 - u) * 2.5); sndBurst(t0 + u * dur, 0.035, rnd(1200, 3800), 1.1, 0.16 * env * vol, 'sfx'); } } catch (e) { /* */ }
}
function tusch() {
  if (!sndOk()) return;
  const t0 = SND.ctx.currentTime;
  try {
    for (let k = 0; k < 30; k++) sndBurst(t0 + k * 0.045, 0.06, 1900, 0.8, 0.04 + 0.006 * k, 'sfx');
    sndBurst(t0 + 1.4, 1.6, 7000, 0.5, 0.25, 'sfx', 'highpass');
    for (const f of [261.6, 329.6, 392, 523.3]) { sndTone(f, t0 + 1.4, 1.3, 0.05, 'sawtooth', 'sfx'); sndTone(f, t0 + 1.4, 1.5, 0.06, 'triangle', 'sfx'); }
  } catch (e) { /* */ }
}
function fanfare() {
  if (!sndOk()) return;
  const t0 = SND.ctx.currentTime, N = [[392, 0, 0.18], [392, 0.2, 0.18], [392, 0.4, 0.18], [523.3, 0.62, 0.55], [659.3, 1.2, 0.3], [587.3, 1.52, 0.3], [784, 1.85, 1.2]];
  try { for (const [f, d, l] of N) { sndTone(f, t0 + d, l, 0.05, 'sawtooth', 'sfx'); sndTone(f / 2, t0 + d, l, 0.05, 'triangle', 'sfx'); } } catch (e) { /* */ }
}
function clinks(n) {
  if (!sndOk()) return;
  const t0 = SND.ctx.currentTime;
  try { for (let k = 0; k < n * 4; k++) { const t = t0 + Math.random() * 1.6, f = rnd(2300, 3400); sndTone(f, t, 0.5, 0.03, 'sine', 'sfx'); sndTone(f * 1.51, t, 0.35, 0.015, 'sine', 'sfx'); } } catch (e) { /* */ }
}
function cheers(n) {
  let d = 0.8;
  for (let k = 0; k < n; k++) { const who = pick(CHEER_WHO), s = pick(CHEERS); setTimeout(() => say(who, s), d * 1000); d += 2.4; }
}
