/* =====================================================================
   V54 · WETTER-LABOR (index.html?lab=wetter[&wetter=sturm][&composer=1][&view=strasse][&t=12.5])
   Eine kleine Straße ohne die Stadt: Pflaster mit dem echten Straßenshader (Nässe, Pfützen, Schnee, Spiegelung),
   zwei Häuserreihen mit dem Fassadenshader (Eisblumen), Laternen, Himmel mit Polarlicht und Niederschlag.
   window.labPose(wetter) stellt eine Wetterlage sofort ein (ohne Übergang), tools/lab-shot.js: ansicht#wetter.
   ===================================================================== */
import { T, scene, camera, renderer, U, $, hemi, moonLight, mergeGeos, FOG_DENSITY } from './core.js';
import { buildEnv, getMats, stdMat } from './people-skeleton.js';
import { cobbleTextures, streetDetail, STREET } from './serpentine.js';
import { buildSky } from './sky.js';
import { buildPrecip, ATMO, WEATHERS, SNOW_BASE, updateAtmosphere } from './atmosphere.js';
import { updateWind } from './wind.js';
import { setupReflection, renderReflection, REFL } from './water.js';
import { labFacadeMesh } from './deco.js';
import { player } from './player.js';
import { VILLA } from './harbour.js';
import { landDist } from './island.js';

export async function startWeatherLab(params) {
  const FS = await import('./facade-shader.js');
  buildEnv(); getMats();
  VILLA.x = VILLA.z = 1e5;   // keine Villa in der Nähe, sonst hält renderReflection das hier für den Blick aufs Hafenbecken
  // Pflaster wie im Spiel (Kleinpflaster + streetDetail)
  const cob = cobbleTextures(); cob.map.repeat.set(80, 80); cob.rough.repeat.copy(cob.map.repeat); cob.normal.repeat.copy(cob.map.repeat);
  const roadMat = stdMat({ map: cob.map, roughnessMap: cob.rough, normalMap: cob.normal, normalScale: new T.Vector2(0.9, 0.9), color: 0xc4ccd0, roughness: 0.85, metalness: 0.08, envI: 0.45 });
  streetDetail(roadMat, false);
  const ground = new T.Mesh(new T.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), roadMat); ground.receiveShadow = true; scene.add(ground);
  STREET.ground = ground;
  // zwei Häuserreihen beiderseits einer 24 m breiten Straße, dahinter ein Turm
  const ST = FS.STONES || [[0.62, 0.58, 0.52]];
  let seed = 300;
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const w = 18 + (i % 3) * 4, h = 14 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 9, x = -75 + i * 28;
    FS.addSeg({ x, z: side * 22, w, d: 16, y0: 0, y1: h, tint: ST[(i + (side > 0 ? 1 : 0)) % ST.length], seed: seed++, style: (i + (side > 0 ? 1 : 0)) % 3 === 2 ? 1 : 0, dens: 0.45, flood: 0.2, rib: [0, 0, 0] }, false);
  }
  FS.addSeg({ x: 0, z: -160, w: 40, d: 40, y0: 0, y1: 160, tint: [0.92, 0.84, 0.66], seed: 504, style: 1, dens: 0.6, flood: 1, rib: [1.0, 0.78, 0.4] }, false);
  scene.add(labFacadeMesh(FS));
  // Laternen alle 16 m auf beiden Gehwegen; die 16 nächsten leuchten über uLamps aufs Pflaster
  const lampPts = [];
  for (const side of [-1, 1]) for (let x = -72; x <= 72; x += 16) lampPts.push([x + (side > 0 ? 8 : 0), side * 12.5]);
  { const g = [], h = []; for (const [x, z] of lampPts) { g.push(new T.CylinderGeometry(0.08, 0.12, 4.6, 6).translate(x, 2.3, z)); h.push(new T.SphereGeometry(0.3, 10, 8).translate(x, 4.9, z)); }
    scene.add(new T.Mesh(mergeGeos(g), stdMat({ color: 0x2a2a2f, roughness: 0.5, metalness: 0.4 })));
    scene.add(new T.Mesh(mergeGeos(h), new T.MeshBasicMaterial({ color: 0xffd9a0 }))); }
  const lampsNear = () => {
    const cp = camera.position, L = lampPts.map(p => [p, (p[0] - cp.x) ** 2 + (p[1] - cp.z) ** 2]).sort((a, b) => a[1] - b[1]);
    U.uLamps.value.forEach((v, i) => { const q = L[i]; if (q && q[1] < 3600) v.set(q[0][0], 5.2, q[0][1], 1); else v.set(0, -1000, 0, 0); });
  };
  buildSky();
  buildPrecip();
  setupReflection();
  // Ansichten
  const V = {
    strasse: [[-40, 1.7, 3], [40, 4, -2]],
    pfuetze: [[-30, 0.9, -4], [30, 2.5, 6]],
    fenster: [[-50, 6, 4], [-53, 9, 22]],
    fensternah: [[-47, 5.5, 11], [-49, 6.5, 22]],
    himmel: [[0, 1.7, 0], [10, 60, -60]],
    zenit: [[0, 1.7, 0], [3, 80, -10]],
    turm: [[0, 2, 40], [0, 70, -160]],
    uebersicht: [[90, 40, 60], [-10, 5, -10]],
  };
  window.labView = name => { const v = V[name] || V.strasse; camera.position.set(...v[0]); camera.lookAt(new T.Vector3(...v[1])); player.p.copy(camera.position); player.p.y -= 1.6; U.uInside.value = 0; lampsNear(); };
  // Wetterlage sofort einstellen (ohne die 14-s-Übergänge), Nässe, Schneedecke und Eisblumen gleich mit
  window.labPose = id => {
    const w = WEATHERS.find(x => x.id === id); if (!w) return;
    ATMO.w = w; ATMO.pinned = true;
    for (const k in ATMO.cur) ATMO.cur[k] = w[k] || 0;
    ATMO.tint.setRGB(...w.tint);
    U.uWet.value = Math.max(0.3, w.rain || 0, w.wet || 0) > 0.5 ? 0.95 : 0.3;
    U.uSnowCover.value = w.snow ? 1 : SNOW_BASE;
    U.uStorm.value = w.storm || 0;
    U.uIce.value = Math.min(1, 0.18 + Math.max((w.frost || 0) * 0.75, (w.snow || 0) * 0.45, (w.storm || 0) * 0.85) + (w.aurora || 0) * 0.05 - (w.rain || 0) * 0.15 - (w.wet || 0) * 0.1);
    updateAtmosphere(0.0001);
  };
  const LABV = { t: params.get('t') != null ? +params.get('t') : null };
  window.labTime = t => { LABV.t = t; };
  window.labView(params.get('view') || 'strasse');
  if (params.get('wetter')) window.labPose(params.get('wetter'));
  window.labStats = () => ({ weather: ATMO.w.id, ...ATMO.cur, wet: U.uWet.value, snowCover: U.uSnowCover.value, ice: U.uIce.value, storm: U.uStorm.value, streetRefl: U.uStreetRefl.value, refl: !!REFL.rt, land: Math.round(landDist(camera.position.x, camera.position.z)), drawCalls: renderer.info.render.calls });
  $('overlay').hidden = true;
  for (const h of document.querySelectorAll('.hud, .touch')) h.style.display = 'none';
  let comp = null, D = null; if (params.get('composer')) { const B = await import('./bloom.js'); D = await import('./depth.js'); B.setupComposer(); comp = B.composer; }
  const t0 = performance.now(); let last = t0;
  const loop = now => {
    const t = LABV.t != null ? LABV.t : (now - t0) / 1000, dt = LABV.t != null ? 0 : Math.min(0.1, (now - last) / 1000); last = now;
    U.uTime.value = t; U.uCam.value.copy(camera.position);
    if (dt > 0) { updateWind(dt); updateAtmosphere(dt); }
    scene.fog.density = U.uFogDensity.value = FOG_DENSITY * 0.8 * ATMO.fogMul;
    hemi.intensity = 0.9 + 0.12 * U.uSnowCover.value; moonLight.intensity = ATMO.moonI;
    renderReflection();
    if (comp) { D.skipDepthResolve(renderer, comp.renderTarget1); D.skipDepthResolve(renderer, comp.renderTarget2); comp.render(); } else renderer.render(scene, camera);
    window.labFrames = (window.labFrames || 0) + 1; requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
