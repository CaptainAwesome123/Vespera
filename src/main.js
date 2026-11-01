import { primeChunks } from './chunks.js';
import { setupStreetLayers } from './props.js';
import { initDriveState } from './driving.js';
import { R } from './core.js';
import { buildEnv, getMats } from './people-skeleton.js';
import { segs } from './facade-shader.js';
import { buildCity, buildNetwork, NET, buildOuter, buildShoreV16, buildBridges, buildElevated } from './island.js';
import { finishShops, buildIndustry } from './shops.js';
import { buildTerraces, buildSigns } from './entrances.js';
import { buildBelmont, buildBelmontInterior, buildBelmontDoor, BEL } from './belmont.js';
import { buildPenthouse } from './penthouse.js';
import { buildHarbor, setupReflection } from './water.js';
import { planAccess, buildPort, portInteractions, VILLA } from './harbour.js';
import { buildGround, buildVilla, planSerpentine, buildAccessRoad, buildSerpentine, flushInstances, buildMountains } from './serpentine.js';
import { buildSky } from './sky.js';
import { buildShafts, buildGroundFog, buildSearchlights, buildAirship } from './airships.js';
import { TRAM_LINES, buildCars, buildTrucks, buildTrams, buildParticles } from './traffic.js';
import { buildVenues } from './venues.js';
import { driveInteractions, venueInteractions } from './eating.js';
import { buildMap, boatInteractions } from './boat.js';
import { buildInteractions } from './music.js';
import { setupComposer, resize } from './bloom.js';
import { buildLightPool, collectDetails, setPR, PR_LEVELS, prIdx } from './performance.js';
import { buildPlayerModel } from './player-model.js';
import { buildAtmosphere } from './atmosphere.js';
import { setupLoose } from './physics.js';
import { buildImperial, IMP } from './imperial.js';

/* =====================================================================
   AUFBAU UND SPIELSCHLEIFE
   ===================================================================== */
export let shipDefs = [];
export function build() {
  initDriveState();
  buildEnv(); getMats(); planAccess();
  buildSky();
  buildCity();
  finishShops();
  buildNetwork();
  // Straßenbahn und Hochstraßen enden am Rand des Rasters
  for (const L of TRAM_LINES) { const on = NET.nodes.filter(n => n.kind === 'grid' && Math.abs((L.axis === 'x' ? n.z : n.x) - L.at) < 30); if (on.length) { const v = on.map(n => L.axis === 'x' ? n.x : n.z); L.from = Math.max(L.from, Math.min(...v) - 5); L.to = Math.min(L.to, Math.max(...v) + 5); } }
  buildOuter();
  buildIndustry();
  buildTerraces();
  buildBelmont();
  buildBelmontInterior();
  buildPenthouse();   // V33: Alexanders Suite und die größere Terrasse auf 250 m
  buildBelmontDoor();
  buildHarbor();
  buildPort();
  buildImperial();   // V33: Alexanders Aurora Imperial (vor buildSerpentine, damit die Besatzung in die Menge kommt)
  buildShoreV16();
  buildVenues();
  buildGround();
  buildSigns();
  buildBridges();
  buildElevated();
  buildVilla();
  planSerpentine();
  // V33: kein Feuerwerk mehr über der Villa (dort wird nicht mehr gefeiert)
  buildAccessRoad();
  buildSerpentine();
  buildCars();
  buildTrucks();
  buildTrams();
  flushInstances();
  buildMountains();
  buildShafts();
  buildGroundFog();
  buildSearchlights();
  buildParticles();
  buildMap();
  buildInteractions();
  portInteractions();
  driveInteractions();
  boatInteractions();
  venueInteractions();
  setupLoose();   // V26: zuletzt, damit 'Ablegen' vor allen anderen Handlungen geprüft wird
  // Luftschiffe: V33 Alexanders Aurora Imperial (eigener Flug, src/imperial.js) statt des Schiffs am Belmont-Mast,
  // dazu der Zubringer an der Villa und nur noch drei kleinere Schiffe auf Rundkursen (vorher sechs)
  shipDefs.push({ g: IMP.g, imperial: true, L: IMP.L });
  shipDefs.push({ g: buildAirship(64, 7.5, 0, false), villa: true, L: 64 });
  const routes = [
    { r: [520, 380], c: [0, 0], h: 230, w: 0.022, L: 130, ad: 0, beam: true },
    { r: [900, 700], c: [0, -200], h: 260, w: 0.012, L: 140, ad: 1, beam: false },
    { r: [450, 650], c: [350, -300], h: 200, w: 0.017, L: 120, ad: 1, beam: false },
  ];
  for (const rt of routes) {
    const sd = { ...rt, g: buildAirship(rt.L, rt.L * 0.115, rt.ad, rt.beam), t0: R() * 100 };
    sd.lift = liftProfile(u => { const tt = u * Math.PI * 2; return [sd.c[0] + Math.cos(tt) * sd.r[0], sd.h, sd.c[1] + Math.sin(tt) * sd.r[1]]; }, sd.L / 2 + 25, sd.L * 0.115 * 1.6 + 30);
    shipDefs.push(sd);
  }
  setupComposer();
  buildLightPool();
  collectDetails();
  setupReflection();
  setPR(PR_LEVELS[prIdx]);
  resize();
  setupStreetLayers();   // V21: Laternen und Stadtmobiliar als Chunk-Schichten
  primeChunks();
  buildPlayerModel();    // V24: der Spieler als Figur (Third-Person-Ansicht, Taste V)
  buildAtmosphere();     // V25: Polarnacht, Wetter, Niederschlag, Mondschatten
}

// Höhenkarte der Dächer (20-m-Raster), damit Luftschiffe über die Türme steigen statt hindurchzufahren
export const SKY = { cell: 20, n: 120, h: null };
export function skyline(x, z, rad) {
  if (!SKY.h) {
    const { cell, n } = SKY, h = SKY.h = new Float32Array(n * n), o = n / 2;
    const put = (x0, z0, x1, z1, y) => {
      for (let i = Math.max(0, Math.floor(x0 / cell) + o); i <= Math.min(n - 1, Math.floor(x1 / cell) + o); i++)
        for (let j = Math.max(0, Math.floor(z0 / cell) + o); j <= Math.min(n - 1, Math.floor(z1 / cell) + o); j++) h[j * n + i] = Math.max(h[j * n + i], y);
    };
    for (const g of segs) put(g.x - g.w / 2, g.z - g.d / 2, g.x + g.w / 2, g.z + g.d / 2, g.y1);
    put(-45, -45, 45, 45, BEL.mast + 12);
  }
  const { cell, n, h } = SKY, o = n / 2, r = Math.ceil(rad / cell);
  const ci = Math.floor(x / cell) + o, cj = Math.floor(z / cell) + o;
  let m = 0;
  for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) if (i >= 0 && j >= 0 && i < n && j < n) m = Math.max(m, h[j * n + i]);
  return m;
}
// Steigprofil für einen Kurs: 256 Stützstellen, Höchstwert im Fenster und weich geglättet
export function liftProfile(posAt, rad, clear) {
  const N = 256, need = new Float32Array(N), out = new Float32Array(N);
  for (let i = 0; i < N; i++) { const [x, y, z] = posAt(i / N); need[i] = Math.max(0, skyline(x, z, rad) + clear - y); }
  const tmp = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let k = -10; k <= 10; k++) m = Math.max(m, need[(i + k + N) % N]); tmp[i] = m; }
  for (let i = 0; i < N; i++) { let a = 0; for (let k = -6; k <= 6; k++) a += tmp[(i + k + N) % N]; out[i] = Math.max(a / 13, need[i]); }
  return u => { const f = ((u % 1) + 1) % 1 * N, i = Math.floor(f), t = f - i; return out[i % N] * (1 - t) + out[(i + 1) % N] * t; };
}
export function updateShips(t) {
  for (const s of shipDefs) {
    if (s.imperial) continue;   // fliegt in updateImperial (zwischen den Plattform-Schritten im Hafen)
    if (s.villa) {
      const m = VILLA.mast, a = Math.sin(t * 0.02) * 0.5 + VILLA.ry + Math.PI / 2, d = s.L / 2 + 2;
      s.g.position.set(m.x + Math.cos(a) * d, m.y - 1 + Math.sin(t * 0.35) * 0.4, m.z - Math.sin(a) * d);
      s.g.rotation.set(0, a + Math.PI, Math.sin(t * 0.3) * 0.015);
      continue;
    }
    const tt = s.t0 + t * s.w;
    const x = s.c[0] + Math.cos(tt) * s.r[0], z = s.c[1] + Math.sin(tt) * s.r[1];
    const dx = -Math.sin(tt) * s.r[0] * Math.sign(s.w), dz = Math.cos(tt) * s.r[1] * Math.sign(s.w);
    s.g.position.set(x, s.h + s.lift(tt / (Math.PI * 2)) + Math.sin(t * 0.2 + s.t0) * 4, z);
    s.g.rotation.set(Math.sin(t * 0.25 + s.t0) * 0.02, Math.atan2(-dz, dx), Math.sin(t * 0.18 + s.t0) * 0.03);
    if (s.g.userData.beam) { s.g.userData.beam.rotation.set(Math.PI + Math.sin(t * 0.3 + s.t0) * 0.35, 0, Math.cos(t * 0.23) * 0.3); }
  }
}
