import { updateChunks, layers } from './chunks.js';
import { shared, T, scene, camera, MOBILE, LOW, renderer, U, FOG_DENSITY, hemi, moonLight, $, FOGVIS, fogHideDist, REVZ } from './core.js';
import { skipDepthResolve } from './depth.js';
import { updateIndustry, updateShops } from './shops.js';
import { inBelmont, interiorCrowd, updateBelmontDoor } from './belmont.js';
import { inPenthouse, updatePenthouse } from './penthouse.js';
import { WATER_Y, updateInterior } from './dance.js';
import { REFL, updateWaves, harborWater, renderReflection } from './water.js';
import { updatePort, carryPlayer, VILLA, terrainHeight } from './harbour.js';
import { updateVilla, updateParked, updateLampLod, updateTreeLod, updateFireworks } from './serpentine.js';
import { inVillaHouse, updateVillaZones } from './villa.js';
import { inImperial } from './imperial.js';
import { updatePedestrians, CLOCK, citizenNear, citizenDoing } from './ragdoll.js';
import { searchlights, updateBeamSpots } from './airships.js';
import { updateCarLights } from './carlight.js';
import { updateCars, updateTrucks, updateTrams } from './traffic.js';
import { player, updatePlayer, EYE } from './player.js';
import { updateVenues } from './venues.js';
import { DRIVE, updateCarScenes, updateCarReturns } from './eating.js';
import { updateDrive, updateVehicleWorld, driveCamera } from './driving.js';
import { updateWind, WIND, windName } from './wind.js';
import { BOAT, updateBoatInput, updateBoat, boatCamera, districtAt, showDistrict, drawMap } from './boat.js';
import { updateInteract, updateAudio } from './music.js';
import { composer, resize, bloomPass } from './bloom.js';
import { playing, paused } from './input.js';
import { updateShips, skyline, shipDefs } from './main.js';
import { DINE } from './venues.js';
import { PM, updatePlayerModel, thirdPersonCamera } from './player-model.js';
import { ATMO, updateAtmosphere } from './atmosphere.js';
import { updateLoose, updateSpawns } from './physics.js';
import { updatePowers, powersCamera } from './powers.js';

/* =====================================================================
   LEISTUNG: Lichter-Pool, Sichtweiten für Details, adaptive Auflösung
   ===================================================================== */
// Punktlichter kosten auf jedem beleuchteten Material. Deshalb gibt es nur vier echte
// Lichter, die jeweils zu den nächstgelegenen Lichtquellen wandern und weich einblenden.
export const LIGHTS = [], lightPool = [];
export function addLight(color, i, d, decay, x, y, z, inside = false) { LIGHTS.push({ p: new T.Vector3(x, y, z), c: color, i, d, decay, inside }); }
export function buildLightPool() {
  for (let k = 0; k < 4; k++) { const l = new T.PointLight(0xffc27a, 0, 50, 1.6); l.userData = { a: null, w: 0 }; scene.add(l); lightPool.push(l); }
}
export let lightTimer = 0;
const _ranked = [], _rankK = [];
export function updateLights(dt) {
  if ((lightTimer -= dt) <= 0) {
    lightTimer = 0.2;
    const cp = camera.position, ins = playing && (inBelmont(player.p.x, player.p.z, player.p.y) || inPenthouse(player.p));
    // die nächsten (Abstand im Verhältnis zur Reichweite) ohne Zwischenlisten: Einfügen in eine kurze sortierte Liste
    const ranked = _ranked, rk = _rankK, N = lightPool.length; ranked.length = 0;
    for (const a of LIGHTS) {
      if (a.inside !== ins) continue;
      const k = cp.distanceTo(a.p) / a.d; if (k >= 1.5) continue;
      let i = ranked.length; if (i === N && k >= rk[N - 1]) continue;
      if (i === N) i--;
      while (i > 0 && rk[i - 1] > k) { ranked[i] = ranked[i - 1]; rk[i] = rk[i - 1]; i--; }
      ranked[i] = a; rk[i] = k;
    }
    for (const l of lightPool) if (l.userData.a && !ranked.includes(l.userData.a)) l.userData.a = null;
    for (const a of ranked) if (!lightPool.some(l => l.userData.a === a)) {
      const l = lightPool.find(l => !l.userData.a); if (!l) break;
      l.userData.a = a; l.userData.w = 0; l.position.copy(a.p); l.color.set(a.c); l.distance = a.d; l.decay = a.decay;
    }
  }
  for (const l of lightPool) { const u = l.userData; u.w = u.a ? Math.min(1, u.w + dt * 2.5) : 0; l.intensity = u.a ? u.a.i * u.w : 0; }
}
// Kleine Einzelteile (Schilder, Leuchten, Zierrat) werden in großer Entfernung ausgeblendet
export const detailCull = [];
export function collectDetails() {
  const sp = new T.Sphere();
  for (const o of scene.children) {
    if (!o.isMesh || o.isInstancedMesh || o.frustumCulled === false) continue;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.updateMatrixWorld(); sp.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
    if (sp.radius > 30) continue;
    detailCull.push({ o, p: sp.center.clone(), d2: (320 + sp.radius * 30) ** 2 });
  }
}
export let cullTimer = 0;
export function updateDetails(dt) {
  if ((cullTimer -= dt) > 0) return;
  cullTimer = 0.3;
  const cp = camera.position, k = 1 + Math.max(0, cp.y - 60) / 200;
  for (const d of detailCull) d.o.visible = d.p.distanceToSquared(cp) < d.d2 * k * k;
}
/* ---------- V27: was im Bodennebel verschwindet, wird nicht mehr gezeichnet ----------
   Dichter Nebel allein spart keine Rechenzeit: die Grafikkarte zeichnet alles und färbt es dann türkis.
   Erst wenn man weiß, ab welchem Abstand etwas vollständig im Nebel liegt, kann man es weglassen.
   fogHideDist (core.js) rechnet das mit derselben Formel wie die Shader, getrennt nach Höhe der Dinge:
   Menschen und Autos (2 m), Möbel und Läden (5 m), Laternen und Bäume (10 m). Türme und Silhouette
   ragen aus dem Bodennebel heraus und bleiben immer stehen. Von oben (Flug, Villa) ist der Nebel dünn,
   dann greift nichts davon. */
export const FOGCULL = { t: 0, low: new Set(['furniture', 'goods', 'shops', 'props', 'deco']), tall: new Set(['lamps', 'decoFar']), hidden: 0 };
export function updateFogCull(dt) {
  if ((FOGCULL.t -= dt) > 0) return;
  FOGCULL.t = 0.3;
  const cp = camera.position, dens = U.uFogDensity.value;
  FOGVIS.ped = fogHideDist(2, cp.y, dens) + 4; FOGVIS.low = fogHideDist(5, cp.y, dens) + 6; FOGVIS.tall = fogHideDist(10, cp.y, dens) + 8;
  let hid = 0;
  for (const L of layers) {
    const lim = FOGCULL.tall.has(L.name) ? FOGVIS.tall : FOGCULL.low.has(L.name) ? FOGVIS.low : 0; if (!lim) continue;
    for (const rec of L.chunks.values()) if (rec.obj) {
      const x0 = rec.cx * L.size, z0 = rec.cz * L.size, dx = Math.max(x0 - cp.x, 0, cp.x - x0 - L.size), dz = Math.max(z0 - cp.z, 0, cp.z - z0 - L.size);
      rec.obj.visible = dx * dx + dz * dz < lim * lim; if (!rec.obj.visible) hid++;
    }
  }
  FOGCULL.hidden = hid;
}
// Auflösung passt sich der Bildrate an: unter etwa 42 Bildern pro Sekunde eine Stufe tiefer,
// bei ruhigem Lauf langsam wieder höher, aber nie über eine Stufe, die schon zu langsam war.
export const PR_DEV = window.devicePixelRatio || 1, PR_MAX = MOBILE ? Math.min(1.5, PR_DEV) : Math.min(2, Math.max(PR_DEV, 1) * 1.6);
export const PR_LEVELS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2].filter(v => v <= PR_MAX + 1e-6);
export const PR_START = MOBILE ? Math.min(PR_MAX, 0.9) : LOW ? Math.min(PR_MAX, 1) : Math.min(PR_MAX, Math.max(PR_DEV, 1) * 1.3);   // V38: niedrige Stufe startet mit 1,0
export let prIdx = PR_LEVELS.reduce((b, v, i) => Math.abs(v - PR_START) < Math.abs(PR_LEVELS[b] - PR_START) ? i : b, 0);
export let prCeil = PR_LEVELS.length - 1, ftAvg = 16.7, prTimer = 0, goodTime = 0, lastUp = -1e9, adaptOn = true;
export function setPR(v) { renderer.setPixelRatio(v); if (composer) composer.setPixelRatio(v); resize(); }
export function adaptResolution(raw, now) {
  if (!adaptOn || raw > 0.25 || document.hidden) return;
  ftAvg += (raw * 1000 - ftAvg) * 0.06;
  if ((prTimer += raw) < 1.0) return;
  // ganz unten und immer noch zu langsam: die echte Wasserspiegelung abschalten
  if (ftAvg > 30 && prIdx === 0 && REFL.rt && !REFL.off) { REFL.off = true; ftAvg = 20; }
  if (ftAvg > 24 && prIdx > 0) {
    if (now - lastUp < 5000) prCeil = prIdx - 1;
    prIdx--; setPR(PR_LEVELS[prIdx]); goodTime = 0; ftAvg = 18;
  } else if (ftAvg < 18.5) {
    goodTime += prTimer;
    if (goodTime > 4 && prIdx < prCeil) { prIdx++; setPR(PR_LEVELS[prIdx]); lastUp = now; goodTime = 0; }
  } else goodTime = 0;
  prTimer = 0;
}

// V23: Nahebene mit dem Abstand zur nächsten Fläche: zu Fuß 0,2 m (Wände, Teller), im Flug über den Dächern bis 4 m.
// Der Tiefenpuffer wird damit in der Ferne bis zu zwanzigmal genauer, Gesimse und Leuchtleisten flackern nicht mehr.
export const NEARP = { t: 0, v: 0.2 };
export function nearTarget() {
  const cp = camera.position;
  if (!playing) return 1.0;
  if (DRIVE.on || BOAT.on || !player.fly) return 0.2;
  let ground = Math.max(skyline(cp.x, cp.z, 30), 0);
  if (Math.hypot(cp.x, cp.z) > 1000) ground = Math.max(ground, terrainHeight(cp.x, cp.z));
  if (Math.hypot(cp.x - VILLA.x, cp.z - VILLA.z) < 160) ground = Math.max(ground, VILLA.y + 56);
  for (const s of shipDefs) if (s.g && s.g.position.distanceToSquared(cp) < (s.L + 30) ** 2) return 0.5;
  const clear = cp.y - ground;
  // V33: im Flug von hinten steht die eigene Figur wenige Meter vor der Kamera
  const cap = PM.view === 'third' && PM.mesh ? Math.max(0.5, Math.min(4, PM.dist - 1.6)) : 4;
  return clear < 6 ? 0.5 : Math.min(cap, 0.5 + (clear - 6) * 0.12);
}
export function updateNearPlane(dt) {
  // V40: mit Reverse-Z ist die Tiefe in jeder Entfernung genau, die Nahebene bleibt bei 0,2 m (nichts wird mehr vorn abgeschnitten)
  if (REVZ.on) { if (camera.near !== 0.2) { camera.near = 0.2; camera.updateProjectionMatrix(); } return; }
  if ((NEARP.t -= dt) > 0) return;
  NEARP.t = 0.25;
  const n = nearTarget();
  if (Math.abs(n - camera.near) / camera.near > 0.12) { camera.near = n; camera.updateProjectionMatrix(); }
}
// V29: Anzeigen nur anfassen, wenn sich der Text ändert (jede Änderung kostet den Browser Stil- und Layoutarbeit)
const HUD_LAST = {};
export function hudSet(id, v, html = false) { if (HUD_LAST[id] === v) return; HUD_LAST[id] = v; const el = $(id); if (html) el.innerHTML = v; else el.textContent = v; }
export let hudTimer = 0, elapsed = 0; shared.last = performance.now();
export function frame(now) {
  const raw = (now - shared.last) / 1000, dt = Math.min(0.05, raw); shared.last = now; elapsed += dt;
  adaptResolution(raw, now);
  const t = elapsed;
  U.uTime.value = t;
  updateWind(dt);
  updateWaves(dt);
  if (harborWater) harborWater.position.set(Math.round(camera.position.x / 4) * 4, WATER_Y, Math.round(camera.position.z / 4) * 4);
  { // Sichtweite: in der Stadt dichter Dunst, von oben und vom Hang aus (Villa) klare Sicht auf die Lichter
    const cp = camera.position, ss = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const k = Math.max(ss(60, 260, cp.y), ss(800, 1400, Math.hypot(cp.x, cp.z)));
    scene.fog.density = U.uFogDensity.value = FOG_DENSITY * (0.85 - 0.56 * k) * ATMO.fogMul;   // V25: Wetter und Innenräume
  }
  updatePort(dt, t);
  if (playing) carryPlayer();
  if (playing && !paused) { if (DRIVE.on) updateDrive(dt); else if (BOAT.on) updateBoatInput(dt); else updatePlayer(dt); updatePowers(dt, t); }   // V33: Alexanders Kräfte
  if (playing) updateVehicleWorld(dt);
  if (playing) { updateSpawns(); updateLoose(dt); }   // V26: lose Dinge
  if (playing && !paused) updateBoat(dt);
  if (playing && DRIVE.on) driveCamera();
  else if (playing && BOAT.on) boatCamera();
  else if (playing && PM.mesh && PM.view === 'third' && !DINE.seat) thirdPersonCamera(dt);   // V33: auch im Flug von hinten
  else if (playing) {
    camera.position.set(player.p.x, player.p.y + (player.fly ? 0.8 : EYE), player.p.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    const a = t * 0.04 + 0.4;
    camera.position.set(Math.sin(a) * 430, 150 + Math.sin(t * 0.07) * 30, Math.cos(a) * 430);
    camera.lookAt(0, 210, 0);
  }
  updatePlayerModel(dt, playing && !DRIVE.on && !BOAT.on && !DINE.seat);
  if (playing && !paused) powersCamera(dt);
  U.uCam.value.copy(camera.position);
  updateAtmosphere(dt);   // V25: Wetter, Mond, Nebel, Mondschatten
  updateNearPlane(dt);
  updateCars(dt);
  updateCarLights();   // V38
  updateTrucks(dt);
  updateTrams(dt);
  const inside = playing && (inBelmont(player.p.x, player.p.z, player.p.y) || inVillaHouse(player.p) || inImperial(player.p) || inPenthouse(player.p)) ? 1 : 0;   // V28: auch in der Villa kein Regen, kein Bodennebel; V33: Luftschiff und Penthouse
  U.uInside.value += (inside - U.uInside.value) * Math.min(1, dt * 4);
  // V34: aus Lobby und Ballsaal sieht man nur durchs Portal hinaus: Figuren, Bäume und Autos draußen nur bis 180 m (vorher die halbe Stadt, 12 Mio. Dreiecke)
  FOGVIS.cap = playing && inBelmont(player.p.x, player.p.z, player.p.y) ? 180 : 1e9;
  hemi.intensity = (0.9 + 0.12 * U.uSnowCover.value) * (1 - 0.72 * U.uInside.value); moonLight.intensity = ATMO.moonI * (1 - U.uInside.value);
  const nearBel = !playing || (Math.abs(camera.position.x) < 70 && Math.abs(camera.position.z) < 75 && camera.position.y < 45);
  if (interiorCrowd) interiorCrowd.show(nearBel);
  updateInterior(t, nearBel);
  updateBelmontDoor(dt);
  updatePenthouse(dt);
  const nearVilla = Math.hypot(camera.position.x - VILLA.x, camera.position.z - VILLA.z) < 650;
  if (VILLA.crowd) VILLA.crowd.show(nearVilla);
  if (nearVilla) updateVilla(t); else updateVillaZones(false);
  updateLights(dt);
  updateDetails(dt);
  updateChunks(dt);
  updateFogCull(dt);
  updateParked(dt);
  updateLampLod(dt); updateTreeLod(dt);
  updateInteract();
  updateAudio(dt);
  updatePedestrians(dt, t);
  updateIndustry(t);
  updateShips(t);
  updateVenues(dt);
  updateShops(dt);
  updateCarScenes(dt); updateCarReturns(dt);
  updateFireworks(dt);
  for (const s of searchlights) s.piv.rotation.set(Math.sin(t * 0.21 + s.ph) * s.tilt, t * 0.12 + s.ph, Math.cos(t * 0.17 + s.ph) * s.tilt);
  updateBeamSpots();   // V38: Lichtfleck des Luftschiff-Scheinwerfers
  // V38: im Dunst und bei Niederschlag leuchten die Lichter weicher und weiter (Nachleuchten etwas stärker, Schwelle tiefer)
  if (bloomPass) { const mist = Math.min(U.uMist.value, 2.3), wet = U.uRain.value + U.uSnow.value; bloomPass.strength = 0.66 + 0.1 * mist + 0.12 * wet; bloomPass.threshold = 0.72 - 0.06 * mist * 0.5; }

  if (playing) {
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.25;
      const d = districtAt(player.p.x, player.p.z, player.p.y);
      if (d[0] !== shared.lastDistrict) { shared.lastDistrict = d[0]; showDistrict(d); }
      hudSet('mode', '<b>' + (BOAT.on ? 'Am Ruder' : DRIVE.on ? 'Am Steuer' : player.fly ? 'Im Flug' : 'Zu Fuß') + '</b>', true);
      hudSet('alt', BOAT.on ? Math.round(Math.abs(BOAT.u) * 1.944) + ' Knoten · Gas ' + Math.round(BOAT.thr * 100) + ' %' : DRIVE.on ? Math.round(Math.abs(DRIVE.v) * 3.6) + ' km/h · ' + (DRIVE.revMode ? 'R' : (DRIVE.gear + 1) + '. Gang') + (DRIVE.body && DRIVE.body.dmg.some(v => v > 0.05) ? ' · Zustand ' + Math.round(100 - (DRIVE.body.dmg[0] + DRIVE.body.dmg[1] + DRIVE.body.dmg[2] + DRIVE.body.dmg[3]) * 25) + ' %' : '') : 'Höhe ' + Math.max(0, Math.round(player.p.y)) + ' m');
      const deg = ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360;
      hudSet('head', 'Kurs ' + ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8] + ' · Wind ' + Math.round(WIND.s + WIND.gust * 6) + ' m/s aus ' + windName(WIND.a + Math.PI));
      drawMap();
      const hh = Math.floor(CLOCK.min / 60), mm = Math.floor(CLOCK.min % 60);
      hudSet('clock', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' Uhr');
      const c = player.fly ? null : citizenNear(player.p, 8), card = $('npc');
      if (c) {
        const a = c.name + ', ' + c.age, b = c.job + ' · ' + c.trait.k, d = citizenDoing(c), key = a + '|' + b + '|' + d;
        if (HUD_LAST.npc !== key) { HUD_LAST.npc = key; card.innerHTML = '<b></b><span></span><i></i>'; card.querySelector('b').textContent = a; card.querySelector('span').textContent = b; card.querySelector('i').textContent = d; }
        if (HUD_LAST.npcOp !== 1) { HUD_LAST.npcOp = 1; card.style.opacity = 1; }
      } else if (HUD_LAST.npcOp !== 0) { HUD_LAST.npcOp = 0; card.style.opacity = 0; }
    }
    if (shared.districtTimer > 0 && (shared.districtTimer -= dt) <= 0) $('district').style.opacity = 0;
  }
  if (shared.toastTimer > 0 && (shared.toastTimer -= dt) <= 0) $('toast').style.opacity = 0;
  if (shared.sayTimer > 0 && (shared.sayTimer -= dt) <= 0) $('say').style.opacity = 0;

  renderReflection();
  if (composer) { bloomPass.enabled = shared.bloomOn; skipDepthResolve(renderer, composer.renderTarget1); skipDepthResolve(renderer, composer.renderTarget2); composer.render(); } else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
