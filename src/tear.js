/* =====================================================================
   V54 · AUSREISSEN: Verzeichnis der festen Dinge, die Alexander mit
   Telekinese aus der Stadt reißen kann (Poller, Masten, Fahnen, Tische,
   Hocker, Klavier, Fässer, Kisten, Bänke, Pumpe ...). Die Bäume laufen
   getrennt (serpentine.js TREE_SETS, physics.js treeBody).
   Zwei Arten von Stücken:
   - zusammengefasste Netze (Bausatz kit() in harbour.js): tearBegin(key,
     info) setzt TEAR.cur; jede Form, die der Bausatz dann bekommt, wird
     markiert (userData.mov), und mergeGeos (core.js) merkt sich ihren
     Ecken- und Indexbereich im fertigen Netz. Gepackt fallen diese Ecken
     in sich zusammen (physics.js furnHide) und ein Körper mit einer Kopie
     der Ecken (mit Farben und Materialien des Netzes) schwebt davon.
     Stücke aus Chunk-Zellen (layer) melden sich bei jedem Aufbau neu unter
     demselben Schlüssel; ist das Stück gerade herausgerissen (taken), baut
     die Zelle es nicht mit (tearBegin gibt null zurück).
   - Instanzen (tearInst): Straßenbahnmasten, Fahnenmasten. Gepackt wird
     die Instanz auf Größe 0 gesetzt, der Körper bekommt ein eigenes Netz.
   Kein Import außer core.js, damit die Modulreihenfolge frei bleibt.
   ===================================================================== */
import { T } from './core.js';

export const TEAR = { list: [], map: new Map(), cur: null, seq: 0 };
const _b = new T.Box3(), _v = new T.Vector3();

// Ein Stück beginnen: key eindeutig (z. B. 'poller:123,45'), info { name, m, stuff, kind, layer?, seat? }
// Gibt null zurück, wenn das Stück gerade herausgerissen ist (Zelle baut es dann nicht)
export function tearBegin(key, info) {
  let e = TEAR.map.get(key);
  if (!e) { e = { id: TEAR.seq++, key, ranges: [], taken: false, saved: null, info: null, inst: false, ...info }; TEAR.map.set(key, e); TEAR.list.push(e); }
  else { e.ranges = []; e.info = null; }
  if (e.taken) { TEAR.cur = null; return null; }
  TEAR.cur = e; return e;
}
export function tearEnd() { TEAR.cur = null; }
// bequem: fn baut das Stück (wird übersprungen, solange es herausgerissen ist)
export function tearWrap(key, info, fn) { const e = tearBegin(key, info); if (!e) return null; try { fn(e); } finally { TEAR.cur = null; } return e; }
// Form markieren (der Bausatz ruft das für jede Form, solange ein Stück begonnen ist). Eigenes userData-Objekt, weil
// clone() das userData teilt und eine Vorlage sonst mit markiert würde.
export function tearTag(g, role = 'tear') { if (TEAR.cur) g.userData = { ...g.userData, mov: { e: TEAR.cur, role, key: role } }; return g; }

// Instanz-Stück: o = { x, y, z, he: [hx, hy, hz], cy, ims: [[InstancedMesh, i], ...], m0: Matrix4, mesh: () => Object3D (Mitte = Schwerpunkt) }
export function tearInst(key, info, o) {
  let e = TEAR.map.get(key);
  if (!e) { e = { id: TEAR.seq++, key, ranges: [], taken: false, saved: null, inst: true, ...info }; TEAR.map.set(key, e); TEAR.list.push(e); }
  e._ims = o.ims; e.m0 = o.m0; e.mesh = o.mesh;
  e.info = { c: { x: o.x, y: o.y + o.cy, z: o.z }, he: new T.Vector3(...o.he) };
  return e;
}

// Mitte und Halbmaße eines Stücks (Weltkoordinaten), aus den Eckenbereichen einmal berechnet
export function tearInfo(e) {
  if (e.info) return e.info;
  if (!e.ranges.length) return null;
  _b.makeEmpty();
  for (const r of e.ranges) { const a = r.geo.attributes.position.array; for (let i = r.o * 3, n = (r.o + r.c) * 3; i < n; i += 3) _b.expandByPoint(_v.set(a[i], a[i + 1], a[i + 2])); }
  const c = _b.getCenter(new T.Vector3()), he = _b.getSize(new T.Vector3()).multiplyScalar(0.5);
  he.x = Math.max(0.08, he.x); he.y = Math.max(0.08, he.y); he.z = Math.max(0.08, he.z);
  return (e.info = { c: { x: c.x, y: c.y, z: c.z }, he });
}
// Nahe Stücke, die noch fest sitzen
export function tearNear(x, z, r) {
  const out = [];
  for (const e of TEAR.list) { if (e.taken) continue; const I = tearInfo(e); if (!I) continue; if ((I.c.x - x) ** 2 + (I.c.z - z) ** 2 < r * r) out.push(e); }
  return out;
}
export const tearStats = () => ({ pieces: TEAR.list.length, taken: TEAR.list.filter(e => e.taken).length, inst: TEAR.list.filter(e => e.inst).length });
