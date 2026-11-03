/* =====================================================================
   V59 · WEITERE KRÄFTE ALEXANDERS
   Der Kristall im Penthouse hat Alexander mehr gegeben als Flug, Telekinese
   und Unverwundbarkeit. Alles leuchtet im Türkis des Kristalls.
   - X  Schockwelle: am Boden schlägt er die Faust aufs Pflaster (Heldenlandung),
        in der Luft stürzt er senkrecht hinab und schlägt mit voller Wucht auf.
        Eine Druckwelle läuft über den Platz: lose Dinge, Bänke, Laternen und
        Wagen fliegen davon, Leute in der Nähe fallen um (und stehen wieder auf).
   - H  Schutzschild: eine schimmernde Kugel um ihn. Was hineinfliegt oder
        hineinfährt, prallt ab, die Kugel blitzt an der Stelle auf.
        Für Gegner und Geschosse: KRAEFTE.shield und shieldHit(x, y, z).
   - L  Levitation: alles ringsum (Kisten, Fässer, Bänke, Laternen, Möbel, Wagen)
        hebt sich langsam vom Boden und kreist um ihn, auch wenn er geht oder
        fliegt. L noch einmal: alles fällt. X während des Schwebens: alles wird
        nach außen geschleudert.
   - Z  Zeit verlangsamen: die Stadt läuft in Zeitlupe (Wagen, Leute, Dinge,
        Funken, Wasser, Fahnen), Alexander bewegt sich in seinem Tempo.
   Eigene Datei, damit die Telekinese und der Energieschub (powers.js) unberührt bleiben.
   ===================================================================== */
import { T, scene, MOBILE } from './core.js';
import { player } from './player.js';
import { LOOSE, bumpSound, streetNear, streetBody, streetCenter, movNear, movWorld, furnInfo, furnBody } from './physics.js';
import { BODIES, looseFromTraffic, looseFromParked } from './driving.js';
import { TRF } from './traffic.js';
import { parked, peds } from './serpentine.js';
import { fxEmit } from './particles.js';
import { toast, BOAT } from './boat.js';
import { DRIVE } from './eating.js';
import { DINE } from './venues.js';
import { PM } from './player-model.js';
import { knockDown } from './ragdoll.js';
import { aweBurst } from './awe.js';
import { POWERS, superLanding } from './powers.js';
import { IMP } from './imperial.js';

export const KRAEFTE = {
  timeK: 1, slow: false,          // Zeitlupe: Faktor für die Welt (1 = normal)
  shield: false, shieldA: 0,      // Schutzschild
  lev: [], levOn: false,          // Levitation: kreisende Dinge
  dive: false, cd: 0,             // Schockwelle: Sturzflug läuft, Abklingzeit
  ring: null, mesh: null, mat: null, ov: null, ovS: null, hitT: 0,
};
const KR_SLOW = 0.22, KR_SHIELD_R = 1.75, KR_LEV_R = 26, KR_LEV_MAX = MOBILE ? 12 : 26, KR_LEV_CARS = MOBILE ? 2 : 6;
const _kv = new T.Vector3(), _kd = new T.Vector3();
const krBusy = () => DRIVE.on || BOAT.on || DINE.seat || IMP.st === 'helm';

/* ---------- Bildschirmränder (kein Nachbearbeitungs-Shader, nur ein Verlauf im HTML) ---------- */
function krOverlay(id, css) {
  const d = document.createElement('div'); d.id = id;
  d.style.cssText = 'position:fixed;inset:0;pointer-events:none;opacity:0;z-index:5;transition:none;' + css;
  document.body.appendChild(d); return d;
}
function krOverlays() {
  if (KRAEFTE.ov) return;
  // Zeitlupe: kühler türkiser Rand, die Mitte bleibt klar
  KRAEFTE.ov = krOverlay('krSlow', 'background:radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(20,120,120,0.28) 80%, rgba(8,50,60,0.6) 100%);');
  // Schild in der Ich-Ansicht: ein feiner leuchtender Rand
  KRAEFTE.ovS = krOverlay('krShield', 'box-shadow:inset 0 0 90px 18px rgba(95,232,220,0.45);');
}

/* ---------- Schutzschild ---------- */
function krShieldMesh() {
  if (KRAEFTE.mesh) return KRAEFTE.mesh;
  // klein gehalten: Rand-Leuchten (Fresnel), langsame Bänder, ein Aufblitzen an der Trefferstelle
  const mat = new T.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uA: { value: 0 }, uHit: { value: 0 }, uHitDir: { value: new T.Vector3(0, 0, 1) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uT; uniform float uA; uniform float uHit; uniform vec3 uHitDir; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = 1.0 - abs(dot(vN, normalize(vV)));
        f = f * f * f;
        float b = 0.55 + 0.45 * sin(vP.y * 16.0 - uT * 2.4 + sin(vP.x * 5.0 + uT) * 1.5);
        float h = uHit * max(0.0, 1.0 - distance(normalize(vP), uHitDir) * 1.4);
        vec3 c = vec3(0.37, 0.91, 0.86) * (f * (0.7 + 0.5 * b) + 0.06 * b) + vec3(0.85, 1.0, 0.97) * h;
        gl_FragColor = vec4(c * uA, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  });
  const m = new T.Mesh(new T.SphereGeometry(1, 40, 24), mat);
  m.frustumCulled = false; m.renderOrder = 5; m.visible = false; m.userData.noRefl = true;
  scene.add(m); KRAEFTE.mesh = m; KRAEFTE.mat = mat;
  return m;
}
export function toggleShield() {
  KRAEFTE.shield = !KRAEFTE.shield;
  krShieldMesh(); krOverlays();
  const p = player.p;
  fxEmit('crystal', p.x, p.y + 1, p.z, 0, 0.6, 0, KRAEFTE.shield ? 40 : 16, 1.2, 1);
  bumpSound('metal', KRAEFTE.shield ? 0.35 : 0.2, KRAEFTE.shield ? 420 : 260);
  if (KRAEFTE.shield) aweBurst('tk', 18, 0.5);
  toast(KRAEFTE.shield ? 'Schutzschild · nichts kommt hindurch · H aus' : 'Schutzschild aus');
}
// für Gegner und Geschosse: trifft etwas den Schild, blitzt er dort auf und hält es ab. true = abgewehrt
export function shieldHit(x, y, z) {
  if (!KRAEFTE.shield) return false;
  const c = krCenter(), M = KRAEFTE.mat;
  _kd.set(x - c.x, y - c.y, z - c.z); if (_kd.lengthSq() < 1e-6) _kd.set(0, 0, 1);
  _kd.normalize();
  if (M) { M.uniforms.uHitDir.value.copy(_kd); M.uniforms.uHit.value = 1; }
  fxEmit('crystal', c.x + _kd.x * KR_SHIELD_R, c.y + _kd.y * KR_SHIELD_R, c.z + _kd.z * KR_SHIELD_R, _kd.x * 3, _kd.y * 3, _kd.z * 3, 10, 0.3, 0.9);
  if (KRAEFTE.hitT <= 0) { bumpSound('metal', 0.3, 520); KRAEFTE.hitT = 0.15; }
  return true;
}
function krCenter() { return _kv.set(player.p.x, player.p.y + (player.fly ? 0.6 : 0.95), player.p.z); }
function updateShield(dt, t) {
  const S = KRAEFTE, want = S.shield && !krBusy() ? 1 : 0;
  S.shieldA += (want - S.shieldA) * Math.min(1, dt * 6);
  S.hitT -= dt;
  if (!S.mesh) return;
  const vis = S.shieldA > 0.01;
  const third = PM.view === 'third' && PM.mesh && PM.show;
  S.mesh.visible = vis && third;
  if (S.ovS) { const o = vis && !third ? (0.55 + 0.15 * Math.sin(t * 2.2)) * S.shieldA + S.mat.uniforms.uHit.value * 0.5 : 0; S.ovS.style.opacity = o.toFixed(2); }
  if (!vis) return;
  const c = krCenter(), M = S.mat.uniforms;
  S.mesh.position.copy(c); S.mesh.scale.setScalar(KR_SHIELD_R * (0.92 + 0.08 * S.shieldA) * (1 + 0.012 * Math.sin(t * 3.1)));
  M.uT.value = t; M.uA.value = S.shieldA * (0.75 + 0.1 * Math.sin(t * 1.7)); M.uHit.value *= Math.exp(-dt * 5);
  if (!S.shield) return;
  // lose Dinge: aus der Kugel gedrückt, Schwung zurückgeworfen
  const R = KR_SHIELD_R;
  for (const B of LOOSE.bodies) {
    if (B === LOOSE.held || B === LOOSE.tk || B.lev) continue;
    const dx = B.x.x - c.x, dy = B.x.y - c.y, dz = B.x.z - c.z, rr = R + Math.max(0.1, B.r * B.sc) * 0.6;
    const d2 = dx * dx + dy * dy + dz * dz; if (d2 > rr * rr) continue;
    const d = Math.sqrt(d2) || 1, nx = dx / d, ny = dy / d, nz = dz / d, vn = B.v.x * nx + B.v.y * ny + B.v.z * nz;
    B.x.x = c.x + nx * rr; B.x.y = Math.max(B.x.y, c.y + ny * rr); B.x.z = c.z + nz * rr;
    if (vn < 0) { B.v.x -= 1.6 * vn * nx; B.v.y -= 1.6 * vn * ny; B.v.z -= 1.6 * vn * nz; }
    B.awake = true; B.still = 0;
    if (vn < -2) shieldHit(B.x.x, B.x.y, B.x.z);
  }
  // Wagen prallen schon an der Kugel ab, bevor sie ihn berühren
  const p = player.p;
  for (const c2 of TRF.cars) {
    if (c2.dyn || c2.gone || c2.wx === undefined || c2.v < 2) continue;
    const dx = c2.wx - p.x, dz = c2.wz - p.z; if (dx * dx + dz * dz > 16 || Math.abs((c2.wy || 0) - p.y) > 2) continue;
    if (-(Math.cos(c2.yaw) * dx - Math.sin(c2.yaw) * dz) * c2.v < 1) continue;   // fährt nicht auf ihn zu
    krBounceCar(looseFromTraffic(c2));
  }
  for (const B of BODIES) {
    if (B.tk || B.player || B.sunk || B.lev) continue;
    const dx = B.x - p.x, dz = B.z - p.z; if (dx * dx + dz * dz > 14 || Math.abs(B.y - p.y) > 2) continue;
    krBounceCar(B);
  }
}
function krBounceCar(B) {
  const p = player.p, dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
  const vn = B.vx * nx + B.vz * nz; if (vn > -1) return;
  B.vx -= 1.5 * vn * nx; B.vz -= 1.5 * vn * nz; B.w += (Math.random() - 0.5) * 1.5; B.still = 0;
  const pen = 3.6 - d; if (pen > 0) { B.x += nx * pen; B.z += nz * pen; }
  shieldHit(p.x + nx * 2, p.y + 0.9, p.z + nz * 2);
  POWERS.shake = Math.min(1, POWERS.shake + Math.min(0.3, -vn * 0.02));
}

/* ---------- Schockwelle ---------- */
export function shockwave() {
  if (krBusy() || KRAEFTE.cd > 0 || KRAEFTE.dive) return;
  KRAEFTE.cd = 1.4;
  // in der Luft: senkrechter Sturz, die Welle kommt beim Aufschlag
  if (player.fly || !player.onGround) {
    const hgt = player.p.y - (player.gy ?? player.p.y);
    if (player.fly || hgt > 2) {
      player.fly = false; POWERS.takeoff = null;
      player.v.set(player.v.x * 0.15, -70, player.v.z * 0.15); player.onGround = false;
      KRAEFTE.dive = true; KRAEFTE.diveT = 0;
      fxEmit('crystal', player.p.x, player.p.y + 0.8, player.p.z, 0, 4, 0, 24, 0.8, 1);
      toast('Sturz · Schockwelle beim Aufschlag');
      return;
    }
  }
  if (POWERS.landT <= 0) superLanding(52);   // Faust aufs Pflaster, Risse, Ring (powers.js)
  krBlast(0.75);
}
function krRing() {
  if (KRAEFTE.ring) return KRAEFTE.ring;
  const m = new T.Mesh(new T.RingGeometry(0.7, 1, 72).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0x7ff2e6, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  m.frustumCulled = false; m.renderOrder = 3; m.visible = false; m.userData.noRefl = true; scene.add(m);
  // dazu eine flache, durchsichtige Kuppel der Druckwelle
  const dome = new T.Mesh(new T.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshBasicMaterial({ color: 0x3fb8b0, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
  dome.frustumCulled = false; dome.renderOrder = 3; dome.visible = false; dome.userData.noRefl = true; scene.add(dome);
  KRAEFTE.ring = { m, dome, t: 9, R: 1, life: 1 };
  return KRAEFTE.ring;
}
function krBlast(k) {
  const p = player.p, R = 14 + 18 * k;
  const RG = krRing(); RG.t = 0; RG.R = R; RG.life = 0.9 + 0.3 * k;
  RG.m.position.set(p.x, p.y + 0.15, p.z); RG.dome.position.set(p.x, p.y, p.z); RG.m.visible = RG.dome.visible = true;
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2, s = 14 + 10 * k; fxEmit('crystal', p.x + Math.cos(a), p.y + 0.4, p.z + Math.sin(a), Math.cos(a) * s, 0.6, Math.sin(a) * s, 1, 0.2, 1.3); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, s = 9 + 6 * k; fxEmit('snowburst', p.x + Math.cos(a) * 1.5, p.y + 0.3, p.z + Math.sin(a) * 1.5, Math.cos(a) * s, 1.2, Math.sin(a) * s, 1, 0.4, 1.2); }
  POWERS.shake = Math.min(1.8, POWERS.shake + 0.5 + 0.6 * k);
  bumpSound('metal', 0.6, 90); bumpSound('wood', 1, 70);
  const push = (dx, dz, d) => (1 - d / R) * (10 + 14 * k);
  // kreisende Dinge werden nach außen geschleudert
  if (KRAEFTE.levOn) krLevRelease(true);
  // lose Dinge
  for (const B of LOOSE.bodies) {
    if (B === LOOSE.held || B === LOOSE.tk) continue;
    const dx = B.x.x - p.x, dz = B.x.z - p.z, d = Math.hypot(dx, dz);
    if (d > R || Math.abs(B.x.y - p.y) > 6) continue;
    const f = push(dx, dz, d) / Math.sqrt(Math.max(0.5, B.m) / 3);
    B.awake = true; B.still = 0; B.v.x += dx / (d || 1) * f; B.v.z += dz / (d || 1) * f; B.v.y += 2 + f * 0.4;
    B.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
  }
  // Straßenmöbel: die nächsten reißt die Welle los
  let n = 0;
  const near = streetNear(p.x, p.z, R * 0.6).map(([sp, kk]) => [sp, kk, (sp.x - p.x) ** 2 + (sp.z - p.z) ** 2]).sort((a, b) => a[2] - b[2]);
  for (const [sp, kk] of near) {
    if (n >= (MOBILE ? 3 : 7)) break;
    const c = streetCenter(sp, kk); if (Math.abs(c.y - p.y) > 4) continue;
    const B = streetBody(sp, kk); if (!B || B === 'sit') continue;
    n++;
    const dx = B.x.x - p.x, dz = B.x.z - p.z, d = Math.hypot(dx, dz) || 1, f = push(dx, dz, d) * 0.6 / Math.sqrt(Math.max(1, B.m) / 10);
    B.awake = true; B.still = 0; B.v.set(dx / d * f, 2.5 + f * 0.3, dz / d * f); B.w.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
  }
  // Wagen: fahrende und geparkte werden weggeschoben und ein Stück angehoben
  const cars = new Set();
  for (const c of TRF.cars) if (!c.dyn && !c.gone && c.wx !== undefined && (c.wx - p.x) ** 2 + (c.wz - p.z) ** 2 < R * R * 0.5 && Math.abs((c.wy || 0) - p.y) < 4) cars.add(looseFromTraffic(c));
  for (const c of parked) if (!c.hidden && !c.dyn) { const e = c.m.elements; if ((e[12] - p.x) ** 2 + (e[14] - p.z) ** 2 < R * R * 0.4 && Math.abs(e[13] - p.y) < 4) cars.add(looseFromParked(c)); }
  for (const B of BODIES) if (!B.player && !B.sunk && !B.tk && (B.x - p.x) ** 2 + (B.z - p.z) ** 2 < R * R * 0.6 && Math.abs(B.y - p.y) < 4) cars.add(B);
  for (const B of cars) {
    const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 1, f = push(dx, dz, d) * 0.8;
    B.vx += dx / d * f; B.vz += dz / d * f; B.vy = 3 + f * 0.35; B.y += 0.3; B.air = true; B.still = 0; B.w += (Math.random() - 0.5) * 2;
  }
  // Leute in der Nähe fallen um, die übrigen erschrecken und staunen (awe.js)
  let down = 0;
  for (const pd of peds) {
    if (down >= (MOBILE ? 2 : 4)) break;
    const a = pd.a; if (!a || !a.on || pd.rag || pd.sit || pd.back) continue;
    const e = a.m.elements, dx = e[12] - p.x, dz = e[14] - p.z, d = Math.hypot(dx, dz);
    if (d > R * 0.45 || Math.abs(e[13] - p.y) > 3) continue;
    const f = 3 + 5 * (1 - d / (R * 0.45));
    if (knockDown(pd, dx / (d || 1) * f, dz / (d || 1) * f, p.x, p.z)) down++;
  }
  aweBurst('land', R * 2.2 + 10);
}
function updateShock(dt) {
  KRAEFTE.cd = Math.max(0, KRAEFTE.cd - dt);
  if (KRAEFTE.dive) {
    KRAEFTE.diveT += dt;
    const p = player.p;
    if (Math.random() < 0.8) fxEmit('crystal', p.x, p.y + 1.2, p.z, 0, 8, 0, 2, 0.4, 1);
    if (player.fly || KRAEFTE.diveT > 25 || krBusy()) KRAEFTE.dive = false;
    else if (player.onGround) { KRAEFTE.dive = false; krBlast(1); }
  }
  const RG = KRAEFTE.ring;
  if (RG && RG.m.visible) {
    RG.t += dt; const u = Math.min(1, RG.t / RG.life), e = 1 - Math.pow(1 - u, 2.4);
    RG.m.scale.setScalar(0.5 + RG.R * e); RG.m.material.opacity = 0.9 * Math.pow(1 - u, 1.4);
    RG.dome.scale.set(0.5 + RG.R * e, (0.5 + RG.R * e) * 0.28, 0.5 + RG.R * e); RG.dome.material.opacity = 0.22 * Math.pow(1 - u, 2);
    if (u >= 1) RG.m.visible = RG.dome.visible = false;
  }
}

/* ---------- Levitation: alles ringsum schwebt und kreist um ihn ---------- */
export function toggleLevitation() {
  if (KRAEFTE.levOn) { krLevRelease(false); toast('Alles fällt'); return; }
  if (krBusy()) return;
  const p = player.p, R = KR_LEV_R, list = [];
  const busy = B => POWERS.tk && POWERS.tk.B === B;
  // lose Dinge
  for (const B of LOOSE.bodies) {
    if (list.length >= KR_LEV_MAX) break;
    if (B === LOOSE.held || B === LOOSE.tk || B.pf) continue;
    if ((B.x.x - p.x) ** 2 + (B.x.z - p.z) ** 2 < R * R && Math.abs(B.x.y - p.y) < 8) list.push({ kind: 'loose', B });
  }
  // Straßenmöbel und Möbel der Räume (die nächsten)
  const cand = [];
  for (const [sp, kk] of streetNear(p.x, p.z, R)) { const c = streetCenter(sp, kk); if (Math.abs(c.y - p.y) < 8) cand.push(['street', sp, kk, (sp.x - p.x) ** 2 + (sp.z - p.z) ** 2]); }
  for (const e of movNear(p.x, p.z, R * 0.6)) { const W = movWorld(e); if (Math.abs(W.y - p.y) < 4) cand.push(['furn', e, null, (W.x - p.x) ** 2 + (W.z - p.z) ** 2]); }
  cand.sort((a, b) => a[3] - b[3]);
  for (const c of cand) {
    if (list.length >= KR_LEV_MAX) break;
    let B = null;
    if (c[0] === 'street') B = streetBody(c[1], c[2]);
    else { if (furnInfo(c[1]).m > 400) continue; B = furnBody(c[1]); }
    if (B && B !== 'sit') list.push({ kind: 'loose', B });
  }
  // Wagen
  let nc = 0;
  const carNear = (x, y, z) => (x - p.x) ** 2 + (z - p.z) ** 2 < R * R && Math.abs(y - p.y) < 6;
  for (const B of BODIES) { if (nc >= KR_LEV_CARS) break; if (!B.player && !B.sunk && !busy(B) && carNear(B.x, B.y, B.z)) { list.push({ kind: 'car', B }); nc++; } }
  for (const c of parked) { if (nc >= KR_LEV_CARS) break; if (c.hidden || c.dyn) continue; const e = c.m.elements; if (carNear(e[12], e[13], e[14])) { list.push({ kind: 'car', B: looseFromParked(c) }); nc++; } }
  for (const c of TRF.cars) { if (nc >= KR_LEV_CARS) break; if (c.dyn || c.gone || c.wx === undefined) continue; if (carNear(c.wx, c.wy || 0, c.wz)) { list.push({ kind: 'car', B: looseFromTraffic(c) }); nc++; } }
  if (!list.length) { toast('Levitation: nichts in der Nähe'); return; }
  // jedem Ding seine Bahn: Abstand nach Größe, Höhe gestaffelt, Winkel von seiner jetzigen Lage aus
  for (const L of list) {
    const B = L.B, car = L.kind === 'car', bx = car ? B.x : B.x.x, bz = car ? B.z : B.x.z;
    const size = car ? 2.4 : Math.max(0.3, B.r * B.sc);
    L.a = Math.atan2(bz - p.z, bx - p.x);
    L.r = Math.min(20, Math.max(car ? 9 : 3.5 + size * 2, Math.hypot(bx - p.x, bz - p.z) * 0.7));
    L.h = (car ? 4 : 1.2) + Math.random() * (car ? 5 : 5);
    L.w = (0.55 + Math.random() * 0.25) / Math.sqrt(L.r / 6) * (Math.random() < 0.15 ? -1 : 1) * 0.6;
    L.bob = Math.random() * 6.28; L.t = 0; L.y0 = car ? B.y + 0.75 : B.x.y;
    if (car) { B.tk = true; B.air = true; B.still = 0; B.lev = true; }
    else { B.lev = new T.Vector3().copy(B.x); B.awake = true; B.still = 0; B.v.y += 1; }
  }
  KRAEFTE.lev = list; KRAEFTE.levOn = true;
  const p0 = player.p;
  fxEmit('crystal', p0.x, p0.y + 0.6, p0.z, 0, 2, 0, 40, 3, 1.2);
  bumpSound('wood', 0.4, 60);
  POWERS.shake = Math.min(1, POWERS.shake + 0.25);
  aweBurst('tk', 34);
  toast(list.length + ' Dinge schweben um Alexander · L fallen lassen · X nach außen schleudern');
}
function krLevRelease(fling) {
  const p = player.p;
  for (const L of KRAEFTE.lev) {
    const B = L.B;
    if (L.kind === 'car') {
      if (POWERS.tk && POWERS.tk.B === B) { B.lev = false; continue; }
      B.tk = false; B.lev = false; B.still = 0;
      if (fling) { const dx = B.x - p.x, dz = B.z - p.z, d = Math.hypot(dx, dz) || 1; B.vx = dx / d * 26; B.vz = dz / d * 26; B.vy = 6; B.w = (Math.random() - 0.5) * 3; }
    } else {
      B.lev = null; B.awake = true; B.still = 0;
      if (fling) { const dx = B.x.x - p.x, dz = B.x.z - p.z, d = Math.hypot(dx, dz) || 1, s = B.m > 40 ? 22 : 32; B.v.set(dx / d * s, 5, dz / d * s); B.w.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); }
    }
  }
  KRAEFTE.lev = []; KRAEFTE.levOn = false;
}
function updateLev(dt, t) {
  if (!KRAEFTE.levOn) return;
  if (krBusy()) { krLevRelease(false); return; }
  const p = player.p;
  for (let i = KRAEFTE.lev.length - 1; i >= 0; i--) {
    const L = KRAEFTE.lev[i], B = L.B, car = L.kind === 'car';
    // weg, versunken, oder Alexander hat es mit der Telekinese gepackt
    const gone = car ? !BODIES.has(B) || B.sunk : LOOSE.bodies.indexOf(B) < 0;
    if (gone || (POWERS.tk && POWERS.tk.B === B) || B === LOOSE.held || B === LOOSE.tk) {
      if (!car && !gone) B.lev = null; else if (car) B.lev = false;
      KRAEFTE.lev.splice(i, 1); continue;
    }
    L.t += dt; L.a += L.w * dt;
    const rise = Math.min(1, L.t / 2.4), e = rise * rise * (3 - 2 * rise);
    const ty = (L.y0 + (p.y + L.h - L.y0) * e) + Math.sin(t * 0.9 + L.bob) * 0.35 * e;
    const r = L.r * (0.85 + 0.15 * e);
    const tx = p.x + Math.cos(L.a) * r, tz = p.z + Math.sin(L.a) * r;
    if (car) {
      B.tk = true; B.air = true; B.still = 0;
      const k = Math.min(1, dt * 4), ex = tx - B.x, ey = ty - (B.y + 0.75), ez = tz - B.z, Ld = Math.hypot(ex, ey, ez), s = Math.min(24, Ld * 2.6) / (Ld || 1);
      B.vx += (ex * s - B.vx) * k; B.vz += (ez * s - B.vz) * k; B.vy += (ey * s - B.vy) * k;
      B.w += (0.25 - B.w) * Math.min(1, dt);
      B.pv = (0.12 * Math.sin(t * 1.1 + L.bob) - B.pitch) * 2; B.rv = (0.1 * Math.sin(t * 0.8 + L.bob) - B.roll) * 2;
    } else {
      B.lev.set(tx, ty, tz); B.awake = true; B.still = 0;
      B.w.y += (0.6 - B.w.y) * Math.min(1, dt * 0.5);
    }
    if (Math.random() < dt * 3) { const cx = car ? B.x : B.x.x, cy = car ? B.y + 0.75 : B.x.y, cz = car ? B.z : B.x.z; fxEmit('crystal', cx, cy, cz, 0, 0.4, 0, 2, car ? 1.6 : 0.5, 0.8); }
  }
  if (!KRAEFTE.lev.length) KRAEFTE.levOn = false;
}

/* ---------- Zeit verlangsamen ---------- */
export function toggleSlowTime() {
  if (!KRAEFTE.slow && krBusy()) return;
  KRAEFTE.slow = !KRAEFTE.slow; krOverlays();
  const p = player.p;
  fxEmit('crystal', p.x, p.y + 1, p.z, 0, 0, 0, 30, 2.5, 1);
  bumpSound('metal', 0.25, KRAEFTE.slow ? 55 : 140);
  toast(KRAEFTE.slow ? 'Die Zeit verlangsamt sich · nur Alexander bewegt sich frei · Z normal' : 'Die Zeit läuft wieder');
}
function updateSlow(dt) {
  const S = KRAEFTE;
  if (S.slow && krBusy()) S.slow = false;
  const want = S.slow ? KR_SLOW : 1;
  S.timeK += (want - S.timeK) * Math.min(1, dt * (S.slow ? 3 : 4));
  if (Math.abs(S.timeK - want) < 0.002) S.timeK = want;
  if (S.ov) { const o = (1 - S.timeK) / (1 - KR_SLOW); S.ov.style.opacity = o < 0.01 ? '0' : o.toFixed(2); }
}

/* ---------- Tasten (layoutrichtig: e.key, damit Z auf deutscher und englischer Tastatur das Z ist) ---------- */
export function kraefteKey(e) {
  if (e.repeat) return false;
  const k = (e.key || '').toLowerCase();
  if (k === 'x') { shockwave(); return true; }
  if (k === 'h') { toggleShield(); return true; }
  if (k === 'l') { toggleLevitation(); return true; }
  if (k === 'z') { toggleSlowTime(); return true; }
  return false;
}

/* ---------- Jedes Bild (mit echter Zeit: Alexander ist nicht verlangsamt) ---------- */
export function updateKraefte(dt, t) {
  updateSlow(dt);
  updateShock(dt);
  updateLev(dt, t);
  updateShield(dt, t);
}
// für Konsole und Tests
Object.assign(KRAEFTE, { shockwave, toggleShield, toggleLevitation, toggleSlowTime, shieldHit });
