/* =====================================================================
   V91 · SPUREN UND SPRITZER
   Fußspuren im Schnee (Alexander und die Leute in der Nähe), Reifenspuren
   im Schnee (Spielerwagen und freie Wagen), Spritzer, wenn ein Fuß oder ein
   Rad in eine Pfütze tritt, Sprühnebel hinter schnellen Rädern auf nasser
   Straße. Die Pfützen liegen dort, wo der Straßenshader sie malt (gleiches
   Rauschen, hier in 32-Bit-Rechnung nachgebaut). Alles in zwei Ringpuffern
   (InstancedMesh), keine neuen Shader. Spuren erscheinen erst, wenn wirklich
   Schnee liegt (uSnowCover > 0,6), und verblassen, wenn er taut.
   ?spuren=aus schaltet alles ab.
   ===================================================================== */
import { T, scene, U, MOBILE, camera } from './core.js';
import { fxEmit } from './particles.js';
import { player } from './player.js';

export const SPUR = { on: new URLSearchParams(location.search).get('spuren') !== 'aus', prints: null, tracks: null, pl: null, peds: new Map(), wheels: null, sprayT: 0 };
const _m = new T.Matrix4(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3(), _Y = new T.Vector3(0, 1, 0);

// ---------- Pfützen wie im Straßenshader (serpentine.js streetDetail: sdH/sdN, pudN) ----------
const f = Math.fround, fr = x => f(x - Math.floor(x));
function sdH(x, y) {
  let px = fr(f(x * f(123.34))), py = fr(f(y * f(456.21)));
  const d = f(f(px * f(px + f(45.32))) + f(py * f(py + f(45.32))));
  px = f(px + d); py = f(py + d);
  return fr(f(px * py));
}
function sdN(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = f(x - ix), fy = f(y - iy);
  fx = f(fx * fx * (3 - 2 * fx)); fy = f(fy * fy * (3 - 2 * fy));
  const a = sdH(ix, iy), b = sdH(ix + 1, iy), c = sdH(ix, iy + 1), d = sdH(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
const sst = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 0..1: wie tief die Stelle in einer Pfütze liegt (0 = trocken)
export function puddleAt(x, z) {
  const w = U.uWet.value; if (w < 0.25) return 0;
  const n = sdN(f(x * 0.09 + 5), f(z * 0.09 + 5)) * 0.75 + sdN(f(x * 0.4), f(z * 0.4)) * 0.25;
  return sst(0.71 - 0.17 * w, 0.75 - 0.17 * w, n);
}

// ---------- Ringpuffer für Abdrücke ----------
function texPrint() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.ellipse(16, 20, 10, 17, 0, 0, Math.PI * 2); g.fill();   // Sohle
  g.beginPath(); g.ellipse(16, 51, 8, 9, 0, 0, Math.PI * 2); g.fill();     // Absatz
  const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
}
function texTread() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#fff'; for (let y = 0; y < 32; y += 8) { g.fillRect(3, y, 11, 5); g.fillRect(18, y + 4, 11, 5); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
}
function ring(N, map, color, op) {
  const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  // nur abdunkeln (Ziel * (1 - Alpha)): passt auf hellen wie auf nächtlich dunklen Schnee
  const m = new T.MeshBasicMaterial({ map, color, transparent: true, opacity: op, depthWrite: false, blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.ZeroFactor, blendDst: T.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, fog: true });
  const im = new T.InstancedMesh(g, m, N); im.count = 0; im.frustumCulled = false; im.userData.noRefl = true; im.renderOrder = 1;
  im.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(im);
  return { im, N, next: 0, dirty: false, op };
}
function put(R, x, y, z, yaw, w, l) {
  _q.setFromAxisAngle(_Y, yaw);
  R.im.setMatrixAt(R.next, _m.compose(_p.set(x, y + 0.012, z), _q, _s.set(w, 1, l)));
  R.next = (R.next + 1) % R.N; R.im.count = Math.max(R.im.count, R.next === 0 ? R.N : R.next); R.dirty = true;
}
export function buildSpuren() {
  if (!SPUR.on || SPUR.prints) return;
  SPUR.prints = ring(MOBILE ? 240 : 700, texPrint(), 0x000000, 0.55);
  const tr = texTread(); tr.repeat.set(1, 1);
  SPUR.tracks = ring(MOBILE ? 300 : 900, tr, 0x000000, 0.3);
}
const snowK = () => sst(0.6, 0.75, U.uSnowCover.value);

// ---------- Schritte ----------
// Je Läufer die letzte Stelle und den nächsten Fuß merken; alle ~0,72 m ein Abdruck, links und rechts versetzt
function stepper(S, x, y, z, stride) {
  if (!S.ok) { S.x = x; S.z = z; S.ok = true; S.side = 1; return false; }
  const dx = x - S.x, dz = z - S.z, d2 = dx * dx + dz * dz;
  if (d2 > 25) { S.x = x; S.z = z; return false; }   // Sprung (Schnellreise, Einsteigen)
  if (d2 < stride * stride) return false;
  S.yaw = Math.atan2(dx, dz); S.x = x; S.z = z; S.side = -S.side;
  return true;
}
function footfall(S, x, y, z, snow, splashK) {
  const c = Math.cos(S.yaw), s = Math.sin(S.yaw), ox = c * 0.1 * S.side, oz = -s * 0.1 * S.side, fx = x + ox, fz = z + oz;
  if (snow > 0.01) put(SPUR.prints, fx, y, fz, S.yaw, 0.11, 0.27);
  const pd = puddleAt(fx, fz);
  if (pd > 0.25 && splashK > 0) fxEmit('spray', fx, y + 0.05, fz, Math.sin(S.yaw) * 0.6, 1.1, Math.cos(S.yaw) * 0.6, Math.round(3 + 5 * pd * splashK), 0.25, 0.32);
}

export function updateSpuren(dt, groundAt, bodies, drive) {
  if (!SPUR.on) return;
  if (!SPUR.prints) buildSpuren();
  const snow = snowK(), wet = U.uWet.value;
  // Abdrücke verblassen mit dem Schnee
  const op = snow;
  for (const R of [SPUR.prints, SPUR.tracks]) { R.im.material.opacity = R.op * op; R.im.visible = op > 0.01 && R.im.count > 0; if (R.dirty) { R.im.instanceMatrix.needsUpdate = true; R.dirty = false; } }
  if (snow < 0.01 && wet < 0.25) { SPUR.pl = null; SPUR.peds.clear(); SPUR.wheels = null; return; }
  // Alexander zu Fuß
  if (!player.fly && !(drive && drive.on) && player.onGround !== false) {
    const S = SPUR.pl || (SPUR.pl = {}), g = groundAt(player.p.x, player.p.z, player.p.y + 0.5);
    if (g && Math.abs(g.y - player.p.y) < 0.4 && !g.ice) { if (stepper(S, player.p.x, g.y, player.p.z, 0.72)) footfall(S, player.p.x, g.y, player.p.z, snow, 1); }
    else S.ok = false;
  } else if (SPUR.pl) SPUR.pl.ok = false;
  return { snow, wet };
}

// Leute in der Nähe (höchstens 14 je Bild): gehen sie, hinterlassen sie Abdrücke und treten in Pfützen
export function pedSpuren(peds, groundAt) {
  if (!SPUR.on || !SPUR.prints) return;
  const snow = snowK(); if (snow < 0.01 && U.uWet.value < 0.25) return;
  const cp = camera.position; let n = 0;
  for (const pd of peds) {
    const a = pd.a; if (!a || !a.on || a.gait[2] < 0.05) continue;
    const e = a.m.elements, x = e[12], y = e[13], z = e[14];
    if ((x - cp.x) ** 2 + (z - cp.z) ** 2 > 900) { SPUR.peds.delete(pd); continue; }
    if (++n > 14) break;
    let S = SPUR.peds.get(pd); if (!S) SPUR.peds.set(pd, S = {});
    if (stepper(S, x, y, z, pd.fem ? 0.6 : 0.7)) footfall(S, x, y, z, snow, 0.6);
  }
  if (SPUR.peds.size > 60) SPUR.peds.clear();
}

// Räder: Spuren im Schnee, Spritzer in Pfützen, Sprühnebel auf nasser Straße
const WH = [[1.55, 0.86], [1.55, -0.86], [-1.55, 0.86], [-1.55, -0.86]];
export function wheelSpuren(dt, bodies, groundAt) {
  if (!SPUR.on || !SPUR.prints) return;
  const snow = snowK(), wet = U.uWet.value; if (snow < 0.01 && wet < 0.25) return;
  const cp = camera.position;
  for (const B of bodies) {
    if (B.air || B.sunk || B.tk || (B.x - cp.x) ** 2 + (B.z - cp.z) ** 2 > 6400) { B.trk = null; continue; }
    const sp = Math.hypot(B.vx, B.vz); if (sp < 0.4) continue;
    const fx = Math.cos(B.h), fz = -Math.sin(B.h), lx = -Math.sin(B.h), lz = -Math.cos(B.h), y = B.gy !== undefined ? B.gy : B.y;
    const last = B.trk || (B.trk = WH.map(() => null));
    for (let i = 0; i < 4; i++) {
      const wx = B.x + fx * WH[i][0] + lx * WH[i][1], wz = B.z + fz * WH[i][0] + lz * WH[i][1], L = last[i];
      if (L) {
        const dx = wx - L[0], dz = wz - L[1], d = Math.hypot(dx, dz);
        if (d > 0.45 && d < 4) {
          if (snow > 0.01 && i >= 2) put(SPUR.tracks, (wx + L[0]) / 2, y, (wz + L[1]) / 2, Math.atan2(dx, dz), 0.2, d + 0.03);   // die Hinterräder laufen in der Spur der vorderen
          last[i] = [wx, wz];
          const pd = wet > 0.25 ? puddleAt(wx, wz) : 0;
          if (pd > 0.25 && sp > 2.5) fxEmit('spray', wx + lx * Math.sign(WH[i][1]) * 0.3, y + 0.15, wz + lz * Math.sign(WH[i][1]) * 0.3, lx * Math.sign(WH[i][1]) * sp * 0.25 + B.vx * 0.25, 0.8 + sp * 0.12, lz * Math.sign(WH[i][1]) * sp * 0.25 + B.vz * 0.25, Math.min(14, Math.round(sp * 0.7 * pd)), 0.5, 0.6 + sp * 0.02);
          else if (wet > 0.7 && sp > 9 && i >= 2 && Math.random() < 0.35) fxEmit('spray', wx - fx * 0.4, y + 0.25, wz - fz * 0.4, B.vx * 0.3, 0.5, B.vz * 0.3, 1, 0.4, 0.8);
        } else if (d >= 4) last[i] = [wx, wz];
      } else last[i] = [wx, wz];
    }
  }
}
