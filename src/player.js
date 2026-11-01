import { T } from './core.js';
import { nearBoxes } from './people-skeleton.js';
import { onIsland, QUAY, ISL } from './island.js';
import { WATER_Y } from './dance.js';
import { PLATFORMS, VILLA, roadHeightAt, terrainHeight } from './harbour.js';
import { villaRoadAt } from './serpentine.js';
import { inVillaCellar } from './villa.js';
import { DINE, standUp } from './venues.js';
import { travel } from './music.js';
import { LOOSE } from './physics.js';
import { peds, turnHead } from './serpentine.js';
import { knockDown } from './ragdoll.js';
import { toast } from './boat.js';
import { superLanding, flightBump } from './powers.js';

/* =====================================================================
   SPIELER: Gehen mit Schwerkraft, Fliegen frei im Raum
   ===================================================================== */
export const player = { p: new T.Vector3(0, 0.26, 120), v: new T.Vector3(), yaw: 0, pitch: 0.12, fly: false, onGround: false };
export const keys = {};
export const EYE = 1.7, RADIUS = 0.45, STEP = 0.55;
export const touch = { mx: 0, my: 0, up: 0, down: 0 };

export const _lp = { x: 0, y: 0, z: 0 };
export let collideOn = null;
export function collide(p, flying) {
  // An Bord eines fliegenden Luftschiffs zählen nur die Wände der Gondel
  let near = player.on && player.on.air ? [] : nearBoxes(p.x, p.z, 3);
  let pg = -1e9; collideOn = null;
  for (const pf of PLATFORMS) {
    if (!pf.boxes.length) continue;
    const dx = p.x - pf.x, dz = p.z - pf.z;
    if (dx * dx + dz * dz > (pf.r + 3) * (pf.r + 3) || p.y < pf.y + (pf.ylo ?? -5) - 3 || p.y > pf.y + (pf.yhi ?? 20) + 3) continue;
    const cs = Math.cos(pf.ry), sn = Math.sin(pf.ry);
    _lp.x = dx * cs - dz * sn; _lp.z = dx * sn + dz * cs; _lp.y = p.y - pf.y;
    const ox = _lp.x, oz = _lp.z, g = resolveBoxes(_lp, pf.boxes, flying), ddx = _lp.x - ox, ddz = _lp.z - oz;
    p.x += ddx * cs + ddz * sn; p.z += -ddx * sn + ddz * cs; p.y = _lp.y + pf.y;
    if (g > -1e8 && g + pf.y > pg) { pg = g + pf.y; collideOn = pf; }
  }
  // Villa: Quader im gedrehten Hausraster prüfen
  let vg = -1e9;
  if (VILLA.boxes && Math.abs(p.x - VILLA.x) < 260 && Math.abs(p.z - VILLA.z) < 260) {
    const cs = Math.cos(VILLA.ry), sn = Math.sin(VILLA.ry), dx = p.x - VILLA.x, dz = p.z - VILLA.z;
    _lp.x = dx * cs - dz * sn; _lp.z = dx * sn + dz * cs; _lp.y = p.y;
    const ox = _lp.x, oz = _lp.z;
    vg = resolveBoxes(_lp, VILLA.boxes, flying);
    const ddx = _lp.x - ox, ddz = _lp.z - oz;
    p.x += ddx * cs + ddz * sn; p.z += -ddx * sn + ddz * cs; p.y = _lp.y;
  }
  const g0 = resolveBoxes(p, near, flying);
  const onLand = onIsland(p.x, p.z, -0.3);
  let ground = onLand ? 0 : WATER_Y + 0.2;
  const rd = roadHeightAt(p.x, p.z, p.y);
  if (rd.tunnel) ground = rd.y;
  else if (!onLand) { const sr = villaRoadAt(p.x, p.z, p.y); ground = Math.max(ground, inVillaCellar(p) ? -1e9 : terrainHeight(p.x, p.z) + 0.3, rd.y, sr ? sr.y : -1e9); }   // V28: im Keller der Villa zählt der Hang nicht
  else ground = Math.max(ground, rd.y);
  const gr = Math.max(ground, g0, vg);
  if (pg < gr - 0.001) collideOn = null;
  return Math.max(gr, pg);
}
export function resolveBoxes(p, near, flying) {
  const r = flying ? 1.0 : RADIUS, height = flying ? 2.0 : 1.8;
  for (const b of near) {
    if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.z + r <= b.z0 || p.z - r >= b.z1) continue;
    const feet = p.y, head = p.y + height;
    if (head <= b.y0 || feet >= b.y1) continue;
    if (!flying && b.y1 - feet <= STEP) continue;
    const pen = [p.x + r - b.x0, b.x1 - (p.x - r), p.z + r - b.z0, b.z1 - (p.z - r)];
    if (flying) pen.push(head - b.y0, b.y1 - feet);
    let k = 0; for (let i = 1; i < pen.length; i++) if (pen[i] < pen[k]) k = i;
    if (k === 0) p.x -= pen[0]; else if (k === 1) p.x += pen[1];
    else if (k === 2) p.z -= pen[2]; else if (k === 3) p.z += pen[3];
    else if (k === 4) { p.y -= pen[4]; player.v.y = Math.min(player.v.y, 0); }
    else { p.y += pen[5]; player.v.y = Math.max(player.v.y, 0); }
  }
  let ground = -1e9;
  for (const b of near) if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1 && b.y1 <= p.y + STEP + 0.01) ground = Math.max(ground, b.y1);
  return ground;
}

export const _f = new T.Vector3(), _r = new T.Vector3(), _w = new T.Vector3();
export function updatePlayer(dt) {
  const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touch.my;
  const side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + touch.mx;
  // am Tisch sitzen: jede Bewegung steht auf
  if (DINE.seat) { if ((Math.abs(fwd) + Math.abs(side) > 0.3 || player.fly)) standUp(); else return; }
  const fast = keys.ShiftLeft || keys.ShiftRight;
  if (player.fly) {
    // V33: Alexander fliegt (Kraft des Meteoritenkristalls): schweben ohne Eingabe, Leertaste steigt, C/Q/Strg sinkt, Shift ist schnell
    _f.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
    _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const down = keys.KeyC || keys.KeyQ || keys.ControlLeft ? 1 : 0;
    const up = (keys.Space ? 1 : 0) - down + touch.up - touch.down;
    _w.copy(_f).multiplyScalar(fwd).addScaledVector(_r, side); _w.y += up;
    if (_w.lengthSq() > 1) _w.normalize();
    const sp = fast ? 150 : 34, moving = _w.lengthSq() > 0.01;
    // anfahren kräftig, ausschweben weich, im Schnellflug träger
    player.v.lerp(_w.multiplyScalar(sp), 1 - Math.exp(-dt * (moving ? (fast ? 1.6 : 3) : 2.2)));
    const vy0 = player.v.y, sp0 = player.v.length();
    player.p.addScaledVector(player.v, dt);
    const px = player.p.x, pz = player.p.z;
    const g = collide(player.p, true);
    if (player.p.y < g + 0.3) player.p.y = g + 0.3;
    player.p.y = Math.min(player.p.y, 2600);
    // gegen eine Wand geflogen: er bleibt heil, die Wand hält ihn auf
    const hit = Math.hypot(player.p.x - px, player.p.z - pz);
    if (hit > 0.05 && sp0 > 30) { player.v.multiplyScalar(0.3); flightBump(sp0); }
    // Landung: nahe am Boden und sinkend (C oder Sinkflug), nicht im schnellen Vorwärtsflug
    const hsp = Math.hypot(player.v.x, player.v.z);
    if (player.p.y - g < 0.45 && (down || touch.down || vy0 < -3) && hsp < 14 && g > WATER_Y + 0.4) {
      player.p.y = g; player.fly = false; player.onGround = true; player.v.y = 0;
      if (-vy0 > 14) superLanding(-vy0);
    }
  } else {
    _f.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    _r.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    _w.copy(_f).multiplyScalar(fwd).addScaledVector(_r, side);
    if (_w.lengthSq() > 1) _w.normalize();
    // V26: mit großen, schweren Dingen in den Armen langsamer
    const H = LOOSE.held, heavy = H && !H.small ? Math.min(1, H.m / 14) : 0;
    const sp = H && !H.small ? (fast ? 4.2 : 3.4) - heavy * 1.2 : fast ? 13 : 5.2;
    const k = 1 - Math.exp(-dt * (player.onGround ? 10 : 2));
    player.v.x += (_w.x * sp - player.v.x) * k;
    player.v.z += (_w.z * sp - player.v.z) * k;
    player.v.y = Math.max(player.v.y - 22 * dt, -70);
    if ((keys.Space) && player.onGround) { player.v.y = 7.2; player.onGround = false; }
    player.p.addScaledVector(player.v, dt);
    bumpPeople(dt);
    const g = collide(player.p, false);
    // V33: unverwundbar: ein Sturz aus jeder Höhe endet in einer Landung, die den Schnee aufwirbelt
    if (player.p.y <= g) { if (player.v.y < -14 && !player.onGround) superLanding(-player.v.y); player.p.y = g; player.v.y = 0; player.onGround = true; }
    else player.onGround = player.p.y - g < 0.05;
    if (player.onGround) player.on = collideOn;
    // Ins Wasser gefallen: nach kurzer Zeit die nächste Leiter hinauf ans Ufer der Stadtinsel
    const pp = player.p, offLand = !onIsland(pp.x, pp.z, -0.3);
    if (offLand && pp.y < WATER_Y + 0.5) {
      player.wet = (player.wet || 0) + dt;
      if (player.wet > 1.2) {
        player.wet = 0; player.on = null;
        let cx = pp.x, cz = Math.min(QUAY.z1 - 2, pp.z);
        for (let k = 0; k < 400 && !onIsland(cx, cz, 3); k++) { const dx = ISL.cx - cx, dz = ISL.cz - cz, L = Math.hypot(dx, dz) || 1; cx += dx / L * 2; cz += dz / L * 2; }
        travel([cx, 0.25, cz], player.yaw, 0, 'Aus dem Wasser geklettert');
      }
    } else player.wet = 0;
  }
  if (player.fly) player.on = null;
  const lim = 6000;
  player.p.x = Math.max(-lim, Math.min(lim, player.p.x));
  player.p.z = Math.max(-lim, Math.min(3000, player.p.z));
}

// V26: Menschen sind kein Nebel mehr: man rempelt sie an und muss um sie herum; wer im vollen Lauf hineinrennt, wirft sie um
export function bumpPeople(dt) {
  const p = player.p, sp = Math.hypot(player.v.x, player.v.z);
  for (const pd of peds) {
    if (!pd.a || !pd.a.on || pd.rag) continue;
    const e = pd.a.m.elements, dx = p.x - e[12], dz = p.z - e[14];
    if (dx * dx + dz * dz > 0.36 || Math.abs(p.y - e[13]) > 1.2) continue;
    const d = Math.hypot(dx, dz) || 1e-3, R = 0.58;
    if (d >= R) continue;
    const nx = dx / d, nz = dz / d, vn = player.v.x * -nx + player.v.z * -nz;
    if (sp > 8 && vn > 6 && !pd.sit && knockDown(pd, player.v.x * 0.55, player.v.z * 0.55, p.x, p.z)) { player.v.multiplyScalar(0.45); toast('Verzeihung!'); continue; }
    // Spieler wird zurückgeschoben, verliert Schwung gegen die Person
    p.x += nx * (R - d); p.z += nz * (R - d);
    if (vn > 0) { player.v.x += nx * vn * 0.8; player.v.z += nz * vn * 0.8; }
    turnHead(pd.a, p.x, p.z);
  }
}
