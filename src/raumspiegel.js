/* =====================================================================
   V95 · MARMOR UND GOLD SPIEGELN DEN ECHTEN RAUM
   Bisher spiegelten alle glänzenden Flächen dieselbe gemalte Umgebung (people-skeleton buildEnv: ein Studio mit
   Lichtfeldern). Im Belmont, im Penthouse und in der Villa sieht man jetzt den Raum selbst in Marmor und Gold:
   die Kronleuchter, die warmen Wände, die Galerien. Beim ersten Betreten eines Raumbereichs wird einmal von der
   Augenhöhe aus ein Umgebungsbild aufgenommen (PMREM, gleiche Größe wie die gemalte Umgebung, daher kein neues
   Shaderprogramm) und den Materialien dieses Bereichs gegeben; draußen bekommen sie die gemalte Umgebung zurück.
   Keine Shaderänderung, kein Aufwand je Bild. ?raumspiegel=aus schaltet es ab.
   ===================================================================== */
import { T, scene, renderer } from './core.js';
import { ENV } from './people-skeleton.js';
import { REVZ } from './depth.js';
import { inBelmont } from './belmont.js';
import { inPenthouse } from './penthouse.js';
import { inVillaHouse } from './villa.js';
import { PM } from './player-model.js';
import { player } from './player.js';

export const RSP = { on: new URLSearchParams(location.search).get('raumspiegel') !== 'aus', probes: new Map(), mats: new Map(), cur: null, wait: 0, key: null };

const REGIONS = [
  { id: 'pent', test: p => inPenthouse(p) },
  { id: 'bel', test: p => inBelmont(p.x, p.z, p.y) && !inPenthouse(p) },
  { id: 'villa', test: p => inVillaHouse(p) },
];
const _v = new T.Vector3(), _P = { x: 0, y: 0, z: 0 };
function regionOf(p) { for (const R of REGIONS) if (R.test(p)) return R; return null; }
// Bereich + Stockwerk/Saal: im Belmont Lobby und Ballsaal getrennt (Trennwand bei z = -6,5), sonst je 6 m Höhe ein Bild
function keyOf(R, p) { return R.id + ':' + Math.round(p.y / 6) + (R.id === 'bel' ? (p.z < -6.5 ? 's' : 'l') : ''); }

// alle glänzenden Standardmaterialien, deren Flächen im Bereich liegen
function collect(R) {
  const set = new Set();
  scene.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    if (!ms.some(m => m && m.isMeshStandardMaterial && m.envMap === ENV)) return;
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    if (!g.boundingSphere) return;
    _v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld); _P.x = _v.x; _P.y = _v.y; _P.z = _v.z;
    if (!R.test(_P)) return;
    for (const m of ms) if (m && m.isMeshStandardMaterial && m.envMap === ENV) set.add(m);
  });
  return set;
}

function bake(p) {
  // einmal von hier aus rundum aufnehmen: die Szene wird verschoben, weil PMREMGenerator.fromScene im Ursprung aufnimmt
  const pm = new T.PMREMGenerator(renderer), rz = REVZ.on;
  const pv = PM.mesh ? PM.mesh.visible : false; if (PM.mesh) PM.mesh.visible = false;   // Alexander nicht im eigenen Spiegelbild
  const sp = scene.position.clone(), fogD = scene.fog ? scene.fog.density : 0, ac = renderer.autoClear;
  let tex = null;
  try {
    if (rz) REVZ.setActive(false);
    if (scene.fog) scene.fog.density = 0;
    scene.position.set(-p.x, -p.y, -p.z); scene.updateMatrixWorld(true);
    tex = pm.fromScene(scene, 0.0, 0.1, 400).texture;
  } catch (e) { console.warn('raumspiegel', e); }
  finally {
    scene.position.copy(sp); scene.updateMatrixWorld(true);
    if (scene.fog) scene.fog.density = fogD;
    renderer.autoClear = ac; if (PM.mesh) PM.mesh.visible = pv;
    if (rz) REVZ.setActive(true);
    pm.dispose();
  }
  return tex;
}

function apply(mats, tex) { for (const m of mats) if (m.envMap !== tex) { m.envMap = tex; } }

export function updateRaumspiegel(dt, playing) {
  if (!RSP.on || !ENV) return;
  // Augenhöhe Alexanders (nicht die Kamera hinter ihm)
  const pp = player.p, cp = { x: pp.x, y: pp.y + 1.6, z: pp.z }, R = playing ? regionOf(cp) : null;
  const key = R ? keyOf(R, cp) : null;
  if (key !== RSP.key) { RSP.key = key; RSP.wait = 0.6; }   // erst aufnehmen, wenn man kurz im Raum steht (nicht im Vorbeiflug)
  if (!key) { if (RSP.cur) { for (const s of RSP.mats.values()) apply(s, ENV); RSP.cur = null; } return; }
  if (key === RSP.cur) return;
  if ((RSP.wait -= dt) > 0) return;
  let S = RSP.mats.get(R.id); if (!S) RSP.mats.set(R.id, S = collect(R));
  // zuerst alles auf die gemalte Umgebung, damit die Aufnahme nicht sich selbst spiegelt
  for (const s of RSP.mats.values()) apply(s, ENV);
  let tex = RSP.probes.get(key);
  if (!tex) { tex = bake({ x: cp.x, y: cp.y, z: cp.z }); if (!tex) { RSP.on = false; return; } RSP.probes.set(key, tex); }
  apply(S, tex); RSP.cur = key;
}
