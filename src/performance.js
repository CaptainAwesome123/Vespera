import { updateChunks, layers } from './chunks.js';
import { UNTER } from './unter-hook.js';
import { shared, T, scene, camera, MOBILE, LOW, renderer, U, FOG_DENSITY, hemi, moonLight, $, FOGVIS, fogHideDist, REVZ } from './core.js';
import { skipDepthResolve } from './depth.js';
import { updateIndustry, updateShops } from './shops.js';
import { inBelmont, interiorCrowd, updateBelmontDoor } from './belmont.js';
import { inPenthouse, updatePenthouse } from './penthouse.js';
import { updatePentStaff } from './haushalt.js';
import { updateCrystal, crystalAura } from './crystal.js';
import { WATER_Y, updateInterior } from './dance.js';
import { REFL, updateWaves, harborWater, renderReflection } from './water.js';
import { updatePort, carryPlayer, VILLA, terrainHeight } from './harbour.js';
import { updateVilla, updateParked, updateLampLod, updateTreeLod } from './serpentine.js';
import { inVillaHouse, updateVillaZones } from './villa.js';
import { inImperial, IMP, HELM, impHelmInput, impHelmCamera } from './imperial.js';
import { updatePedestrians, CLOCK, citizenNear, citizenDoing } from './ragdoll.js';
import { updateBeamSpots } from './airships.js';
import { updateCarLights } from './carlight.js';
import { updateCars, updateTrucks, updateTrams } from './traffic.js';
import { player, updatePlayer, EYE } from './player.js';
import { updateVenues } from './venues.js';
import { updateOrte } from './orte.js';
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
import { KRAEFTE, updateKraefte } from './kraefte.js';
import { updateEnergy } from './energy.js';
import { updateAwe } from './awe.js';

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
// V57: auch der Kleinkram (V53) und die Gassen im Arbeiterviertel (V46, Wäscheleinen und Rohre an den Wänden: hoch)
export const FOGCULL = { t: 0, low: new Set(['furniture', 'goods', 'shops', 'props', 'deco', 'clutter']), tall: new Set(['lamps', 'decoFar', 'arbeiter']), hidden: 0 };
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
// V57: am PC startet die hohe Stufe mit der echten Bildschirmauflösung (vorher 1,3-fach: 70 % mehr Bildpunkte schon beim ersten Bild)
// und steigt nur, wenn Luft ist; nach unten geht es schon unter 49 Bildern pro Sekunde (vorher erst unter 42, dann blieb das Bild
// bei 45 Bildern mit Überabtastung stehen statt bei flüssigen 60)
export const PR_START = MOBILE ? Math.min(PR_MAX, 0.9) : Math.min(PR_MAX, Math.max(PR_DEV, 1));   // V38: niedrige Stufe startet mit 1,0
export let prIdx = PR_LEVELS.reduce((b, v, i) => Math.abs(v - PR_START) < Math.abs(PR_LEVELS[b] - PR_START) ? i : b, 0);
export let prCeil = PR_LEVELS.length - 1, ftAvg = 16.7, prTimer = 0, goodTime = 0, lastUp = -1e9, adaptOn = true;
export function setPR(v) { renderer.setPixelRatio(v); if (composer) composer.setPixelRatio(v); resize(); }
export function adaptResolution(raw, now) {
  if (!adaptOn || raw > 0.25 || document.hidden) return;
  ftAvg += (raw * 1000 - ftAvg) * 0.06;
  if ((prTimer += raw) < 1.0) return;
  // ganz unten und immer noch zu langsam: die echte Wasserspiegelung abschalten
  if (ftAvg > 30 && prIdx === 0 && REFL.rt && !REFL.off) { REFL.off = true; ftAvg = 20; }
  // V57: wird es knapp, entsteht das Spiegelbild (Hafen, nasses Pflaster) nur noch jedes zweite Bild; man sieht es kaum, es spart
  // aber fast ein ganzes zusätzliches Zeichnen der Stadt in halber Auflösung
  if (ftAvg > 19) REFL.half = true; else if (ftAvg < 15.5) REFL.half = false;
  if (ftAvg > 20.5 && prIdx > 0) {
    if (now - lastUp < 5000) prCeil = prIdx - 1;
    prIdx--; setPR(PR_LEVELS[prIdx]); goodTime = 0; ftAvg = 18;
  } else if (ftAvg < 18.5) {
    goodTime += prTimer;
    if (goodTime > 4 && prIdx < prCeil) { prIdx++; setPR(PR_LEVELS[prIdx]); lastUp = now; goodTime = 0; }
  } else goodTime = 0;
  prTimer = 0;
}

// V57: Leistungsanzeige (Taste P oder ?leistung): Bilder pro Sekunde, Bildzeit, Auflösung, Zeichenaufrufe und Dreiecke je Durchgang
// (Bild, Spiegelbild, Mondschatten). So lassen sich Messwerte vom eigenen PC als Bildschirmfoto schicken.
export const PERF = { on: new URLSearchParams(location.search).has('leistung'), el: null, t: 0, n: 0, acc: 0, worst: 0, refl: [0, 0], shad: [0, 0], main: [0, 0], wrapped: false };
export function togglePerf() { PERF.on = !PERF.on; if (!PERF.on && PERF.el) { PERF.el.style.display = 'none'; renderer.info.autoReset = true; } return PERF.on; }
function perfSetup() {
  if (!PERF.el) {
    const e = PERF.el = document.createElement('div');
    e.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;padding:6px 9px;background:rgba(4,14,16,.72);color:#d8f0ea;font:12px/1.45 ui-monospace,Consolas,monospace;white-space:pre;pointer-events:none;border:1px solid rgba(200,160,90,.4);border-radius:4px';
    document.body.appendChild(e);
  }
  if (!PERF.wrapped) {
    PERF.wrapped = true;
    const sm = renderer.shadowMap, oR = sm.render, I = renderer.info.render;
    sm.render = function (...a) { const c = I.calls, t = I.triangles; oR.apply(this, a); PERF.shad[0] += I.calls - c; PERF.shad[1] += I.triangles - t; };
  }
  PERF.el.style.display = 'block';
}
const fmtK = v => v >= 1e6 ? (v / 1e6).toFixed(1) + ' Mio.' : Math.round(v / 1000) + ' k';
function perfFrame(raw) {
  if (!PERF.on) return;
  if (!PERF.el || PERF.el.style.display !== 'block') perfSetup();
  PERF.n++; PERF.acc += raw; PERF.worst = Math.max(PERF.worst, raw);
  if ((PERF.t += raw) < 0.5) return;
  const f = PERF.n, I = renderer.info, mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '?';
  const loaded = layers.reduce((s, L) => s + L.chunks.size, 0);
  PERF.el.textContent = `${Math.round(f / PERF.t)} Bilder/s · ${(PERF.acc / f * 1000).toFixed(1)} ms (schlechtestes ${(PERF.worst * 1000).toFixed(0)} ms)\n`
    + `Auflösung ${PR_LEVELS[prIdx].toFixed(2)} · Qualität ${LOW ? 'niedrig' : 'hoch'} · Spiegelbild ${REFL.off ? 'aus' : REFL.half ? 'halb' : 'voll'}\n`
    + `Bild:       ${Math.round(PERF.main[0] / f)} Aufrufe · ${fmtK(PERF.main[1] / f)} Dreiecke\n`
    + `Spiegelung: ${Math.round(PERF.refl[0] / f)} Aufrufe · ${fmtK(PERF.refl[1] / f)} Dreiecke\n`
    + `Schatten:   ${Math.round(PERF.shad[0] / f)} Aufrufe · ${fmtK(PERF.shad[1] / f)} Dreiecke\n`
    + `Programme ${I.programs.length} · Geometrien ${I.memory.geometries} · Texturen ${I.memory.textures} · Zellen ${loaded} · JS ${mem}`;
  PERF.t = PERF.n = PERF.acc = PERF.worst = 0; PERF.refl[0] = PERF.refl[1] = PERF.shad[0] = PERF.shad[1] = PERF.main[0] = PERF.main[1] = 0;
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
  const raw = (now - shared.last) / 1000, rdt = Math.min(0.05, raw); shared.last = now;
  // V60: Zeitlupe (Taste Z): die Welt läuft mit dt, Alexander selbst (Bewegung, Kräfte, Kamera) mit der echten Zeit rdt
  const dt = rdt * KRAEFTE.timeK; elapsed += dt;
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
  if (playing && !paused) { if (DRIVE.on) updateDrive(rdt); else if (BOAT.on) updateBoatInput(rdt); else if (IMP.st === 'helm') impHelmInput(rdt); else updatePlayer(rdt); updatePowers(rdt, t); updateEnergy(rdt); }   // V33: Alexanders Kräfte; V58: am Steuer der Aurora Imperial; V59: Energieschub
  if (playing && !paused) updateKraefte(rdt, t);   // V60: Schockwelle, Schild, Levitation, Zeitlupe
  if (playing) updateVehicleWorld(dt);
  if (playing) { updateSpawns(); updateLoose(dt); }   // V26: lose Dinge
  if (playing && !paused) updateBoat(dt);
  if (playing && DRIVE.on) driveCamera();
  else if (playing && BOAT.on) boatCamera();
  else if (playing && IMP.st === 'helm' && HELM.cam === 'aussen') impHelmCamera(dt);   // V58: Außenansicht des Schiffs vom Steuer aus
  else if (playing && PM.mesh && PM.view === 'third' && !DINE.seat) thirdPersonCamera(dt);   // V33: auch im Flug von hinten
  else if (playing) {
    camera.position.set(player.p.x, player.p.y + (player.fly ? 0.8 : EYE), player.p.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  } else {
    const a = t * 0.04 + 0.4;
    camera.position.set(Math.sin(a) * 430, 150 + Math.sin(t * 0.07) * 30, Math.cos(a) * 430);
    camera.lookAt(0, 210, 0);
  }
  updatePlayerModel(rdt, playing && !DRIVE.on && !BOAT.on && !DINE.seat);
  if (playing && !paused) powersCamera(rdt);
  U.uCam.value.copy(camera.position);
  updateAtmosphere(dt);   // V25: Wetter, Mond, Nebel, Mondschatten
  updateNearPlane(rdt);
  updateCars(dt);
  updateCarLights();   // V38
  updateTrucks(dt);
  updateTrams(dt);
  const inside = playing && (inBelmont(player.p.x, player.p.z, player.p.y) || inVillaHouse(player.p) || inImperial(player.p) || inPenthouse(player.p) || (UNTER.test && UNTER.test(player.p))) ? 1 : 0;   // V61: auch in den Verstecken unter der Stadt   // V28: auch in der Villa kein Regen, kein Bodennebel; V33: Luftschiff und Penthouse
  U.uInside.value += (inside - U.uInside.value) * Math.min(1, dt * 4);
  // V34: aus Lobby und Ballsaal sieht man nur durchs Portal hinaus: Figuren, Bäume und Autos draußen nur bis 180 m (vorher die halbe Stadt, 12 Mio. Dreiecke)
  FOGVIS.cap = playing && inBelmont(player.p.x, player.p.z, player.p.y) ? 180 : playing && UNTER.test && UNTER.test(player.p) ? 70 : 1e9;   // V61: unter der Stadt sieht man nichts von oben
  hemi.intensity = (0.9 + 0.12 * U.uSnowCover.value) * (1 - 0.72 * U.uInside.value); moonLight.intensity = ATMO.moonI * (1 - U.uInside.value);
  const nearBel = !playing || (Math.abs(camera.position.x) < 70 && Math.abs(camera.position.z) < 75 && camera.position.y < 45);
  if (interiorCrowd) interiorCrowd.show(nearBel);
  updateInterior(t, nearBel);
  updateBelmontDoor(dt);
  updatePenthouse(dt); updateCrystal(dt); crystalAura(dt);   // V57: der Meteoritenkristall lebt
  updatePentStaff(dt);   // V57: Personal im Penthouse
  const nearVilla = Math.hypot(camera.position.x - VILLA.x, camera.position.z - VILLA.z) < 650;
  if (VILLA.crowd) VILLA.crowd.show(nearVilla);
  if (nearVilla) updateVilla(t); else updateVillaZones(false);
  updateLights(dt);
  updateDetails(dt);
  updateChunks(rdt);
  updateFogCull(rdt);
  updateParked(dt);
  updateLampLod(dt); updateTreeLod(dt);
  updateInteract();
  updateAudio(dt);
  updatePedestrians(dt, t);
  updateAwe(dt);   // V52
  updateIndustry(t);
  updateShips(t);
  updateVenues(dt);
  updateOrte(dt);   // V58: Revue im Metropol, Applaus, Platzanweiserin
  updateShops(dt);
  updateCarScenes(dt); updateCarReturns(dt);
  updateBeamSpots();   // V38: Lichtfleck des Luftschiff-Scheinwerfers
  // V38: im Dunst und bei Niederschlag leuchten die Lichter weicher und weiter (Nachleuchten etwas stärker, Schwelle tiefer)
  if (bloomPass) { const mist = Math.min(U.uMist.value, 2.3), wet = U.uRain.value + U.uSnow.value; bloomPass.strength = 0.66 + 0.1 * mist + 0.12 * wet; bloomPass.threshold = 0.72 - 0.06 * mist * 0.5; }

  if (playing) {
    hudTimer -= rdt;
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
    if (shared.districtTimer > 0 && (shared.districtTimer -= rdt) <= 0) $('district').style.opacity = 0;
  }
  if (shared.toastTimer > 0 && (shared.toastTimer -= rdt) <= 0) $('toast').style.opacity = 0;
  if (shared.sayTimer > 0 && (shared.sayTimer -= rdt) <= 0) $('say').style.opacity = 0;

  const PI = PERF.on ? renderer.info : null;
  // Die Schattenkarte entsteht im ersten Zeichnen des Bildes (oft im Spiegelbild); ihre Aufrufe zählen nur unter Schatten
  let s0 = 0, s1 = 0;
  if (PI) { PI.autoReset = false; PI.reset(); s0 = PERF.shad[0]; s1 = PERF.shad[1]; }
  renderReflection();
  if (PI) { PERF.refl[0] += PI.render.calls - (PERF.shad[0] - s0); PERF.refl[1] += PI.render.triangles - (PERF.shad[1] - s1); PI.reset(); s0 = PERF.shad[0]; s1 = PERF.shad[1]; }
  if (composer) { bloomPass.enabled = shared.bloomOn; skipDepthResolve(renderer, composer.renderTarget1); skipDepthResolve(renderer, composer.renderTarget2); composer.render(); } else renderer.render(scene, camera);
  if (PI) { PERF.main[0] += PI.render.calls - (PERF.shad[0] - s0); PERF.main[1] += PI.render.triangles - (PERF.shad[1] - s1); }
  perfFrame(raw);
  requestAnimationFrame(frame);
}
