// Startpunkt des Spiels. Die Ladereihenfolge entspricht der früheren Reihenfolge der <script>-Zeilen:
// was eine Datei beim Laden sofort ausführt, darf nur Dinge aus Dateien weiter oben benutzen.
import './core.js';
import './chunks.js';
import './assets.js';
import './props.js';
import './decolamp.js';
import './mocap.js';
import './people-model.js';
import './people-skeleton.js';
import './facade-shader.js';
import './deco.js';
import './island.js';
import './building-forms.js';
import './shops.js';
import './entrances.js';
import './belmont.js';
import './plaza.js';
import './fountain.js';
import './deco-tex.js';
import './penthouse.js';
import './dance.js';
import './water.js';
import './harbour.js';
import './serpentine.js';
import './villa.js';
import './ragdoll.js';
import './sky.js';
import './airships.js';
import './imperial.js';
import './cars.js';
import './traffic.js';
import './player.js';
import './venues.js';
import './eating.js';
import './particles.js';
import './driving.js';
import './wind.js';
import './boat.js';
import './music.js';
import './bloom.js';
import './input.js';
import './main.js';
import './performance.js';
import './physics.js';
import './powers.js';
import './audio.js';

import { shared, $, renderer, scene, camera } from './core.js';
import { layers, chunkStats } from './chunks.js';
import { assetStats, manifest } from './assets.js';
import { setupProps } from './props.js';
import { loadPeople, MHP } from './people-mh.js';
import { loadCarModel, CARM } from './carmodel.js';
import { loadMocap, MOCAP } from './mocap.js';
import { player } from './player.js';
import { isTouch } from './input.js';
import { build } from './main.js';
import { frame } from './performance.js';
import { STREET, parked } from './serpentine.js';
import { driveEnter, driveExit } from './driving.js';
import { DRIVE } from './eating.js';
import { TRF } from './traffic.js';
import { props } from './props.js';
import { PM } from './player-model.js';
import { LOOSE } from './physics.js';
import { POWERS } from './powers.js';
import { composer } from './bloom.js';
import { SND } from './audio.js';

export async function start(data) {
  if (data && data.p) { player.p.set(...data.p); player.yaw = data.yaw; player.pitch = data.pitch; player.fly = data.fly; }
  // V22: MakeHuman-Figuren vor dem Aufbau laden (die Menge baut ihre Netze daraus); ohne sie bleiben die gebauten
  $('loading').textContent = 'Menschen der Stadt werden eingekleidet …';
  await Promise.race([Promise.all([loadPeople(), loadMocap(), loadCarModel()]), new Promise(r => setTimeout(r, 20000))]);
  if (!MHP.ready) MHP.late = true;
  const lab = new URLSearchParams(location.search);
  if (lab.get('lab')) { const { startLab } = await import('./lab.js'); startLab(lab); return; }
  await build();
  setupProps().catch(e => console.warn('Requisiten:', e));
  await precompile();
  $('enter').disabled = false;
  $('loading').textContent = isTouch ? 'Links ziehen zum Gehen, rechts zum Umsehen.' : 'Klicke, um die Maus zu fangen. Esc gibt sie frei.';
  requestAnimationFrame(t => { shared.last = t; frame(t); });
}
// V36: alle Shader der Szene (auch die verborgene Spielerfigur für die Ansicht von hinten, Innenräume usw.) schon hinter dem
// Startbild übersetzen. Danach Fehler selbst melden (checkShaderErrors ist aus).
// V37: wirklich parallel. three.js (r147) fragt in renderer.compile gleich nach jedem Programm dessen Uniforms ab
// (getProgramParameter ACTIVE_UNIFORMS); das wartet, bis der Treiber genau dieses Programm fertig hat. So wurden alle
// rund 115 Programme nacheinander übersetzt, die Seite stand dabei still ("Seite reagiert nicht"). Jetzt meldet die
// Abfrage während compile für noch nicht fertige Programme 0 Uniforms; der Treiber übersetzt alle zugleich im Hintergrund
// (KHR_parallel_shader_compile), die Anzeige zählt mit, und erst danach werden die Uniforms richtig gelesen und eingetragen.
async function precompile() {
  const gl = renderer.getContext(), ext = gl.getExtension('KHR_parallel_shader_compile'), t0 = performance.now();
  const rt = renderer.getRenderTarget(), faked = new Set();
  if (ext && !new URLSearchParams(location.search).has('serialcompile')) {
    const gpp = Object.getPrototypeOf(gl).getProgramParameter.bind(gl);
    gl.getProgramParameter = (p, n) => {
      if (n === 35718 && !gpp(p, ext.COMPLETION_STATUS_KHR)) { faked.add(p); return 0; }
      return gpp(p, n);
    };
  }
  // die Szene wird im Spiel in Zwischenbilder gezeichnet (Composer, Spiegelung): gleiche Shader-Variante wie dort übersetzen
  try { renderer.setRenderTarget(composer ? composer.renderTarget1 : null); renderer.compile(scene, camera); }
  catch (e) { console.warn('Shader vorbereiten:', e); }
  finally { delete gl.getProgramParameter; renderer.setRenderTarget(rt); }
  const tC = performance.now(), mats = [];
  const collect = o => { if (Array.isArray(o.material)) mats.push(...o.material); else mats.push(o.material); mats.push(o.customDepthMaterial, o.customDistanceMaterial); };
  if (faked.size) scene.traverse(collect);
  const progs = renderer.info.programs.slice();
  if (ext) {
    const label = $('loading');
    for (;;) {
      const done = progs.filter(p => gl.getProgramParameter(p.program, ext.COMPLETION_STATUS_KHR)).length;
      if (done >= progs.length || gl.isContextLost() || performance.now() - t0 > 180000) break;
      label.textContent = `Lichter und Stoffe werden vorbereitet … ${Math.round(100 * done / progs.length)} %`;
      await new Promise(r => setTimeout(r, 100));
    }
  }
  if (gl.isContextLost()) return;
  // V37: die vorhin übergangenen Uniforms jetzt lesen (die Programme sind fertig, das wartet nicht mehr) und überall eintragen
  if (faked.size) {
    let WU = null;
    for (const p of progs) {
      if (!faked.has(p.program) || !gl.getProgramParameter(p.program, gl.LINK_STATUS)) continue;
      const u = p.getUniforms(), fresh = new u.constructor(gl, p.program);
      u.seq = fresh.seq; u.map = fresh.map; WU = u.constructor;
    }
    const seen = new Set();
    const fix = m => {
      if (!m || seen.has(m)) return; seen.add(m);
      const mp = renderer.properties.get(m), cp = mp.currentProgram;
      if (cp && faked.has(cp.program) && mp.uniforms) mp.uniformsList = WU.seqWithValue(cp.getUniforms().seq, mp.uniforms);
    };
    if (WU) { scene.traverse(collect); mats.forEach(fix); }
  }
  for (const p of progs) {
    if (gl.getProgramParameter(p.program, gl.LINK_STATUS)) continue;
    console.error('Shader-Fehler', p.name, p.cacheKey?.slice(0, 80), gl.getProgramInfoLog(p.program),
      p.vertexShader ? gl.getShaderInfoLog(p.vertexShader) : '', p.fragmentShader ? gl.getShaderInfoLog(p.fragmentShader) : '');
  }
  console.info(`Shader vorbereitet: ${progs.length} in ${Math.round(performance.now() - t0)} ms (Auftrag ${Math.round(tC - t0)} ms)` + (ext ? (faked.size ? ' (parallel)' : ' (nacheinander)') : ''));
}
// V36: stürzt die Grafik ab (Treiber, Grafikspeicher), sagen wir es, statt still stehenzubleiben
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  console.error('WebGL: Grafik verloren (webglcontextlost)');
  const l = $('loading'); if (l) l.textContent = 'Die Grafik ist abgestürzt. Bitte die Seite neu laden (F5).';
  try { document.exitPointerLock?.(); } catch {}
  $('lede').textContent = 'Die Grafik ist abgestürzt (Treiber oder Grafikspeicher). Bitte die Seite neu laden (F5).';
  $('enter').disabled = true; $('overlay').hidden = false;
}, false);
// Handgriff für Werkzeuge und Tests (Konsole: vespera.player.p, vespera.renderer.info, vespera.chunkStats ...)
window.vespera = { loose: LOOSE, mocap: MOCAP, renderer, scene, camera, player, shared, layers, chunkStats, assetStats, manifest, people: MHP, street: STREET, props, playerModel: PM, powers: POWERS, cars: { model: CARM, parked, traffic: TRF, enter: driveEnter, exit: driveExit, drive: DRIVE }, sound: SND };
window.claude?.hot?.snapshot?.(() => ({ p: player.p.toArray(), yaw: player.yaw, pitch: player.pitch, fly: player.fly }));

export const fontsReady = (document.fonts && document.fonts.load)
  ? Promise.race([Promise.all([document.fonts.load('84px Limelight'), document.fonts.load('18px "Josefin Sans"')]), new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve();
fontsReady.catch(() => {}).then(() => {
  const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
  setTimeout(go, 30);
});
