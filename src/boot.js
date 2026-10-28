// Startpunkt des Spiels. Die Ladereihenfolge entspricht der früheren Reihenfolge der <script>-Zeilen:
// was eine Datei beim Laden sofort ausführt, darf nur Dinge aus Dateien weiter oben benutzen.
import './core.js';
import './chunks.js';
import './assets.js';
import './props.js';
import './people-model.js';
import './people-skeleton.js';
import './facade-shader.js';
import './island.js';
import './building-forms.js';
import './shops.js';
import './entrances.js';
import './belmont.js';
import './dance.js';
import './water.js';
import './harbour.js';
import './serpentine.js';
import './ragdoll.js';
import './sky.js';
import './airships.js';
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

import { shared, $, renderer, scene, camera } from './core.js';
import { layers, chunkStats } from './chunks.js';
import { assetStats, manifest } from './assets.js';
import { setupProps } from './props.js';
import { player } from './player.js';
import { isTouch } from './input.js';
import { build } from './main.js';
import { frame } from './performance.js';
import { STREET } from './serpentine.js';
import { props } from './props.js';

export function start(data) {
  if (data && data.p) { player.p.set(...data.p); player.yaw = data.yaw; player.pitch = data.pitch; player.fly = data.fly; }
  build();
  setupProps().catch(e => console.warn('Requisiten:', e));
  $('enter').disabled = false;
  $('loading').textContent = isTouch ? 'Links ziehen zum Gehen, rechts zum Umsehen.' : 'Klicke, um die Maus zu fangen. Esc gibt sie frei.';
  requestAnimationFrame(t => { shared.last = t; frame(t); });
}
// Handgriff für Werkzeuge und Tests (Konsole: vespera.player.p, vespera.renderer.info, vespera.chunkStats ...)
window.vespera = { renderer, scene, camera, player, shared, layers, chunkStats, assetStats, manifest, street: STREET, props };
window.claude?.hot?.snapshot?.(() => ({ p: player.p.toArray(), yaw: player.yaw, pitch: player.pitch, fly: player.fly }));

export const fontsReady = (document.fonts && document.fonts.load)
  ? Promise.race([Promise.all([document.fonts.load('84px Limelight'), document.fonts.load('18px "Josefin Sans"')]), new Promise(r => setTimeout(r, 2500))])
  : Promise.resolve();
fontsReady.catch(() => {}).then(() => {
  const go = () => window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
  setTimeout(go, 30);
});
