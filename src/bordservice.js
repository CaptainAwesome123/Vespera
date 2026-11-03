/* =====================================================================
   V58 · BORDSERVICE DER AURORA IMPERIAL
   Zwei Stewards in Weiß bedienen Alexander wie Randolf in der Villa: einer hinter der Bar des
   großen Salons (Sitzgruppen und Barhocker), einer an der Anrichte des Speisesalons (Tafel und
   die Bistrotische auf dem Achterdeck). Platz nehmen (E), bestellen (E, Karte), der Steward holt
   es, bringt es auf dem Tablett, stellt es auf den Tisch und geht zurück auf seinen Posten.
   Alles in Schiffskoordinaten: Figuren, Wege und Plätze fahren mit dem Schiff, auch während es
   fliegt oder Alexander selbst steuert. Keine neuen Shader, vorhandene Figuren und Gangarten.
   ===================================================================== */
import { MOBILE } from './core.js';
import { Crowd, turnHead } from './serpentine.js';
import { IMP, impLocal } from './imperial.js';
import { player } from './player.js';
import { INTERACT } from './music.js';
import { DINE, MENU, sitDown, serveOrder } from './venues.js';
import { lifeSay } from './life.js';
import { sndClip } from './audio.js';
import { trayMesh } from './haushalt.js';
import { toast } from './boat.js';

export const BS = { C: null, ag: [], venues: [], pick: null, aboard: false, greetT: 0, sayT: 0 };
const WHITE = [0.9, 0.88, 0.82];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = L => L[Math.floor(Math.random() * L.length)];

/* ---------- Schiff -> Welt ---------- */
function toW(lx, ly, lz) { const pf = IMP.pf, c = Math.cos(pf.ry), s = Math.sin(pf.ry); return [pf.x + lx * c + lz * s, pf.y + ly, pf.z - lx * s + lz * c]; }
// Platz: Weltfelder (x, y, z, yaw, tx, ty, tz, up) aus den Schiffsfeldern; jedes Bild, solange Alexander dort sitzt
export function seatWorld(s) {
  const pf = IMP.pf; if (!pf) return s;
  [s.x, s.y, s.z] = toW(s.lx, s.ly, s.lz); s.yaw = pf.ry + s.lyaw;
  [s.tx, s.ty, s.tz] = toW(s.tlx, s.tly, s.tlz);
  const u = toW(s.ulx, s.V.F, s.ulz); s.up = [u[0], u[1], u[2]];
  return s;
}

/* ---------- Figuren (Schiffskoordinaten) ---------- */
function gaitW(ag, sp) { const g = ag.a.gait, c = sp * 4.6, s = 0.4; if (g[1] !== c || g[2] !== s) { g[1] = c; g[2] = s; ag.a.gv = (ag.a.gv | 0) + 1; } }
function actA(ag, v) { const g = ag.a.gait; if (g[1] !== v || g[2] !== 0) { g[1] = v; g[2] = 0; ag.a.gv = (ag.a.gv | 0) + 1; } }
function faceTo(ag, lx, lz, dt, k = 6) { ag.yaw += wrap(Math.atan2(lx - ag.lx, lz - ag.lz) - ag.yaw) * Math.min(1, dt * k); }
function walk(ag, dt) {
  let step = ag.sp * dt, want = null;
  while (step > 0 && ag.path.length) {
    const P = ag.path[0], dx = P[0] - ag.lx, dz = P[1] - ag.lz, d = Math.hypot(dx, dz);
    if (d > 0.02) want = Math.atan2(dx, dz);
    if (d <= step) { ag.lx = P[0]; ag.lz = P[1]; ag.path.shift(); step -= d; }
    else { const k = step / d; ag.lx += dx * k; ag.lz += dz * k; step = 0; }
  }
  if (want != null) ag.yaw += wrap(want - ag.yaw) * Math.min(1, dt * 8);
  if (ag.path.length) { gaitW(ag, ag.sp); return false; }
  return true;
}
function put(ag) {
  const [x, y, z] = toW(ag.lx, ag.ly, ag.lz);
  BS.C.set(ag.a, x, y, z, IMP.pf.ry + ag.yaw, 1, ag.tilt);
  const m = ag.tray; if (!m) return;
  m.visible = !!ag.carry && BS.C.vis;
  if (m.visible) { const yaw = IMP.pf.ry + ag.yaw, s = Math.sin(yaw), c = Math.cos(yaw); m.position.set(x + s * 0.42, y + 1.06, z + c * 0.42); m.rotation.y = yaw; }
}

/* ---------- Aufbau: Plätze, Lokale, Stewards ---------- */
export const LINES_UP = ['Bitte sehr, Sir. Mit Blick auf Vespera.', 'Zum Wohl, Sir. Der Kapitän lässt grüßen.', 'Bitte sehr, Sir. Die Bar ist ganz zu Ihren Diensten.'];
export const LINES_LOW = ['Bitte sehr, Sir. Die Bordküche empfiehlt sich.', 'Wohl bekomm’s, Sir.', 'Bitte sehr, Sir. Frisch aus der Bordküche.'];
export const GREET = ['Willkommen an Bord, Sir. Die Bar im Salon ist geöffnet.', 'Guten Abend, Sir. Nehmen Sie Platz, wo Sie mögen, wir bringen alles.', 'Willkommen zurück an Bord, Sir. Der Speisesalon ist gedeckt.'];
export function buildBordservice() {
  const I = IMP, D = I.D; if (!D) return;
  const fyA = D.fyA, fyB = D.fyB;
  MENU.imperial = { title: 'Aurora Imperial · Bordservice', items: [['Champagner', 'drink', 'coupe'], ['Whisky, 20 Jahre', 'drink', 'tumbler'], ['Martini', 'drink', 'wine'], ['Mokka', 'drink', 'cup'], ['Austern', 'food', 'oysters'], ['Hummer', 'food', 'lobster'], ['Petits Fours', 'food', 'cake']] };
  const C = BS.C = new Crowd(['waiter'], 2);
  const mk = (lx, ly, lz, yaw, o) => { const a = C.add('waiter', WHITE); const ag = { a, lx, ly, lz, yaw, home: [lx, lz, yaw], path: [], sp: 1.5, st: 'post', serve: null, carry: false, tilt: 0, tray: trayMesh(), t: rnd(2, 6), ...o }; BS.ag.push(ag); return ag; };
  // Steward im Salon hinter der Bar (mixt dort), Steward im Speisesalon an der Anrichte
  const up = mk(29.2, fyA, 5.6, Math.PI, { who: 'Der Steward', lines: LINES_UP, mix: [29.2, 5.6], mixF: [29.2, 4.4], idle: [13.3, 29, 0.6] });
  const low = mk(-13.1, fyB, 2.4, -Math.PI / 2, { who: 'Der Steward', lines: LINES_LOW, mix: [-10.8, 4.1], mixF: [-11.6, 4.1], idle: [12.3, 29, 0.6] });
  C.finish();
  // Platz: (lx, Sitzhöhe, lz, Blickrichtung) Tisch (lx, Höhe, lz) Aufstehpunkt (lx, lz) Standplatz des Stewards (lx, lz) und sein Weg dorthin (Schiffskoordinaten)
  const V = (name, F, server) => { const v = { priv: true, kind: 'imperial', name, seats: [], F, server, ship: true }; BS.venues.push(v); return v; };
  const seat = (v, lx, ly, lz, lyaw, tlx, tly, tlz, ulx, ulz, stand, route) => { const s = { V: v, lx, ly, lz, lyaw, tlx, tly, tlz, ulx, ulz, stand, route, x: 0, y: 0, z: 0, yaw: 0, tx: 0, ty: 0, tz: 0, up: null }; v.seats.push(s); return s; };
  // ---- Großer Salon: drei Sitzgruppen (Sofa mit drei Plätzen, zwei Sessel), Bar mit fünf Hockern ----
  const sal = V('Großer Salon', fyA, up);
  const group = (x, z, a, far) => {
    const sa = Math.sin(a), ca = Math.cos(a), px = ca, pz = -sa;   // Blick (sa, ca), quer dazu (ca, −sa)
    const sx = x - sa * 1.3, sz = z - ca * 1.3;
    for (const k of [-1, 0, 1]) seat(sal, sx + px * k, 0.56, sz + pz * k, a, x + px * k * 0.4 - sa * 0.3, 0.48, z + pz * k * 0.4 - ca * 0.3, sx + px * k + sa * 0.62, sz + pz * k + ca * 0.62, far.stand, far.route);
    for (const s of [-1, 1]) { const cx = x + ca * s * 1.8, cz = z - sa * s * 1.8, yaw = Math.atan2(-s * ca, s * sa); seat(sal, cx, 0.5, cz, yaw, x + ca * s * 0.42, 0.48, z - sa * s * 0.42, cx + Math.sin(yaw) * 0.62, cz + Math.cos(yaw) * 0.62, far.stand, far.route); }
  };
  group(31, -2.6, 0, { stand: [31, -1.45], route: [[33.3, 3.2], [33.3, -0.6], [31, -1.45]] });
  group(39, 1.2, Math.PI, { stand: [39, 0.1], route: [[33.3, 3.2], [33.3, -0.6], [39, 0.1]] });
  group(45.6, 0, Math.PI / 2, { stand: [46.85, 0], route: [[33.3, 3.2], [33.3, -0.6], [43, -0.6], [43.2, -3.0], [47.4, -3.0], [46.85, 0]] });
  for (let k = 0; k < 5; k++) { const x = 26.8 + k * 1.2; seat(sal, x, 0.78, 3.85, 0, x, 1.14, 4.35, x, 2.9, [x, 5.6], [[x, 5.6]]); }
  for (const s of sal.seats) { s.tly += fyA; s.ly += fyA; }
  // ---- Speisesalon: Tafel mit sieben Stühlen je Seite und zwei Kopfenden ----
  const din = V('Speisesalon', fyB, low);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) { const x = -7.6 + i * 1.2; seat(din, x, fyB + 0.48, s * 1.08, s > 0 ? Math.PI : 0, x, fyB + 0.8, s * 0.5, x, s * 2.05, [x, s * 1.95], [[-10.8, s * 1.95], [x, s * 1.95]]); }
  seat(din, 1.4, fyB + 0.48, 0, -Math.PI / 2, 0.6, fyB + 0.8, 0, 2.4, 0, [2.3, 0.9], [[-10.8, 1.95], [2.3, 1.95], [2.3, 0.9]]);
  seat(din, -9.4, fyB + 0.48, 0, Math.PI / 2, -8.6, fyB + 0.8, 0, -10.4, 0, [-10.3, 0.9], [[-10.8, 1.95], [-10.3, 0.9]]);
  // ---- Achterdeck: zwei Bistrotische mit je vier Stühlen ----
  const aft = V('Achterdeck', fyB, low);
  for (const [x, z] of [[-18.5, 3.6], [-14.6, 4.2]]) for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const cx = x + Math.sin(a) * 0.75, cz = z + Math.cos(a) * 0.75, yaw = a + Math.PI, b = a + Math.PI / 4;
    seat(aft, cx, fyB + 0.47, cz, yaw, x + Math.sin(a) * 0.28, fyB + 0.76, z + Math.cos(a) * 0.28, cx + Math.sin(a) * 0.7, cz + Math.cos(a) * 0.7, [x + Math.sin(b) * 1.05, z + Math.cos(b) * 1.05], [[-11, 0], [-13.6, 0], [-13.6, 2.6], [x + Math.sin(b) * 1.05, z + Math.cos(b) * 1.05]]);
  }
  // Platz nehmen: der nächste freie Platz an Bord (Deckhöhe passt)
  INTERACT.push({
    test: p => { if (DINE.seat || !IMP.pf || player.on !== IMP.pf) return false; const q = impLocal(p); let bd = 1.3 * 1.3; BS.pick = null;
      for (const v of BS.venues) { if (Math.abs(q.ly - v.F) > 2.2) continue; for (const s of v.seats) { const d = (s.lx - q.lx) ** 2 + (s.lz - q.lz) ** 2; if (d < bd) { bd = d; BS.pick = s; } } }
      return !!BS.pick; },
    label: 'Platz nehmen', act: () => { const s = BS.pick; if (!s) return; seatWorld(s); sitDown(s.V, s); toast('Platz genommen · E bestellen · W aufstehen'); },
  });
}

/* ---------- Bedienung ---------- */
function dispatch() {
  const V = DINE.venue; if (!V || !V.ship || !DINE.order || DINE.item) return;
  const s = DINE.seat, ag = V.server; if (!ag || ag.serve) return;
  ag.serve = { ph: 'go', seat: s, t: 0 }; ag.st = 'serve'; ag.carry = false; ag.sp = 1.5;
  ag.path = Math.hypot(ag.lx - ag.mix[0], ag.lz - ag.mix[1]) < 0.3 ? [] : [[ag.mix[0], ag.mix[1]]];
}
function serveStep(ag, dt) {
  const S = ag.serve, s = S.seat;
  if (S.ph === 'go') { if (walk(ag, dt)) { S.ph = 'mix'; S.t = 3.0; } return; }
  if (S.ph === 'mix') {
    actA(ag, 13.3); faceTo(ag, ag.mixF[0], ag.mixF[1], dt, 4);
    if ((S.t -= dt) > 0) return;
    ag.carry = true; sndClip('glass', 0.25); S.ph = 'back'; ag.path = s.route.map(q => q.slice()); ag.sp = 1.6; return;
  }
  if (S.ph === 'back') { if (!walk(ag, dt)) return; S.ph = 'offer'; S.t = 1.4; actA(ag, 8.3); return; }
  if (S.ph === 'offer') {
    faceTo(ag, s.lx, s.lz, dt, 5); ag.tilt = -0.12;
    if ((S.t -= dt) > 0) return;
    ag.carry = false; ag.tilt = 0;
    if (DINE.seat === s && DINE.order && !DINE.item) { seatWorld(s); serveOrder(); sndClip('glass', 0.35); lifeSay(ag.who, pick(ag.lines), 3.5); }
    S.ph = 'ret'; ag.path = s.route.slice(0, -1).reverse().map(q => q.slice()); ag.path.push([ag.home[0], ag.home[1]]); ag.sp = 1.4; return;
  }
  if (S.ph === 'ret') { if (!walk(ag, dt)) return; ag.serve = null; ag.st = 'post'; ag.t = 1; }
}
// auf dem Posten: Gläser polieren, Besteck richten, dastehen; dreht sich zu Alexander, wenn er nah vorbeikommt
function postStep(ag, dt, q) {
  ag.yaw += wrap(ag.home[2] - ag.yaw) * Math.min(1, dt * 2);
  if ((ag.t -= dt) <= 0) { ag.t = rnd(5, 11); ag.act = pick(ag.idle); actA(ag, ag.act); }
  if (q && Math.abs(q.ly - ag.ly) < 2 && (q.lx - ag.lx) ** 2 + (q.lz - ag.lz) ** 2 < 16) { const [x, , z] = toW(q.lx, 0, q.lz); turnHead(ag.a, x, z); }
}
export function updateBordservice(dt) {
  const I = IMP, C = BS.C; if (!C || !I.pf) return;
  const vis = !!(I.inner && I.inner.visible);
  if (vis !== C.vis) C.show(vis);
  const aboard = player.on === I.pf, q = aboard ? impLocal(player.p) : null;
  if (aboard && !BS.aboard) BS.greetT = 1.6;
  if (BS.greetT > 0 && (BS.greetT -= dt) <= 0 && aboard) lifeSay('Der Steward', pick(GREET), 4.5);
  BS.aboard = aboard;
  if (DINE.seat && DINE.seat.V && DINE.seat.V.ship) {
    // Platz, Tisch und das Glas darauf fahren mit (eating.js bewegt es nur, während er trinkt oder isst)
    const s = seatWorld(DINE.seat);
    if (DINE.item && DINE.anim <= 0) DINE.item.position.set(s.tx, s.ty, s.tz);
    if (DINE.done) DINE.done.position.set(s.tx, s.ty, s.tz);
  }
  if (!vis) { for (const ag of BS.ag) if (ag.tray) ag.tray.visible = false; return; }
  dispatch();
  for (const ag of BS.ag) {
    if (ag.serve) serveStep(ag, dt); else postStep(ag, dt, q);
    if (!ag.serve && ag.tilt) ag.tilt += (0 - ag.tilt) * Math.min(1, dt * 4);
    put(ag);
  }
  C.flag();
}
