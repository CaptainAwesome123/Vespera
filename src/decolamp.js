import { T, MOBILE, snowy } from './core.js';
import { mergeColored, stdMat } from './people-skeleton.js';

/* =====================================================================
   V27 · ART-DÉCO-STRASSENLATERNEN (statt der mittelalterlich wirkenden Khronos-Laterne)
   Vorbild: Kandelaber der späten 1920er in New York und Paris. Von unten nach oben:
   gestufter achteckiger Sockel, kannelierte Trommel mit Goldband, schlanker kannelierter
   Schaft mit zwei Messingmanschetten, ausgestelltes Kapitell, achteckige Laterne aus
   Milchglas mit Bronzerippen und Querbändern, darüber eine Zikkurat-Haube mit Goldfinnen,
   kannelierte Spitze und Kugel. Die Mitte des Glases liegt dort, wo der Lichtpunkt
   (addGlow in serpentine.js, h - 0,38 m) seit jeher sitzt.
   Zwei Stufen: lod 0 fein (Kanneluren, Finnen), lod 1 schlicht für die Ferne.
   ===================================================================== */
export const LAMP_IRON = [0.055, 0.06, 0.058], LAMP_GOLD = [0.78, 0.56, 0.26], LAMP_BRONZE = [0.32, 0.22, 0.12];
// Zylinder mit Kanneluren: der Halbmesser sinkt in den Rillen um depth (Anteil)
export function flutedCyl(rt, rb, h, flutes, depth, y0) {
  const g = new T.CylinderGeometry(rt, rb, h, flutes * 4, 1, false), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 - depth * 0.5 * (1 + Math.cos(flutes * a));
    p.setXYZ(i, x * k, p.getY(i), z * k);
  }
  g.computeVertexNormals();
  return g.translate(0, y0 + h / 2, 0);
}
const oct = (rt, rb, h, y0) => new T.CylinderGeometry(rt, rb, h, 8).rotateY(Math.PI / 8).translate(0, y0 + h / 2, 0);
const _cache = new Map();
export function decoLampGeo(h, lod = 0) {
  const key = h.toFixed(2) + ':' + lod; if (_cache.has(key)) return _cache.get(key);
  const P = [], G = [];
  const fine = lod === 0, F = fine ? (MOBILE ? 8 : 12) : 0;
  const gy0 = h - 0.76, gy1 = h - 0.04, shaftTop = gy0 - 0.3;
  // Sockel
  P.push([oct(0.36, 0.38, 0.1, 0), LAMP_IRON]);
  P.push([oct(0.31, 0.33, 0.13, 0.1), LAMP_IRON]);
  P.push([fine ? flutedCyl(0.2, 0.24, 0.55, F, 0.12, 0.23) : new T.CylinderGeometry(0.2, 0.24, 0.55, 8).translate(0, 0.505, 0), LAMP_IRON]);
  P.push([new T.CylinderGeometry(0.22, 0.22, 0.045, fine ? 24 : 8).translate(0, 0.8, 0), LAMP_GOLD]);
  P.push([new T.CylinderGeometry(0.12, 0.2, 0.2, fine ? 20 : 8).translate(0, 0.92, 0), LAMP_IRON]);
  // Schaft mit Manschetten
  const sh = shaftTop - 1.02;
  P.push([fine ? flutedCyl(0.072, 0.105, sh, F, 0.16, 1.02) : new T.CylinderGeometry(0.072, 0.105, sh, 6).translate(0, 1.02 + sh / 2, 0), LAMP_IRON]);
  for (const f of fine ? [0.38, 0.97] : [0.97]) { const y = 1.02 + sh * f, r = 0.105 - 0.033 * f; P.push([new T.CylinderGeometry(r + 0.025, r + 0.025, 0.07, fine ? 16 : 6).translate(0, y, 0), LAMP_GOLD]); if (fine) P.push([new T.CylinderGeometry(r + 0.04, r + 0.012, 0.035, 16).translate(0, y + 0.05, 0), LAMP_GOLD]); }
  // Kapitell: ausgestellter Kelch, Teller unter der Laterne
  P.push([new T.CylinderGeometry(0.2, 0.08, 0.24, fine ? 16 : 8).translate(0, shaftTop + 0.12, 0), LAMP_IRON]);
  P.push([oct(0.25, 0.25, 0.05, gy0 - 0.06), LAMP_GOLD]);
  // Laterne: Milchglas (eigenes Netz), Bronzerippen an den Ecken, zwei Querbänder
  const gl = gy1 - gy0;
  G.push(new T.CylinderGeometry(0.235, 0.195, gl, 8, 1, false).rotateY(Math.PI / 8).translate(0, gy0 + gl / 2, 0));
  if (fine) {
    // Rippen genau auf den Ecken des gedrehten Achtecks
    const c8 = Math.cos(Math.PI / 8), s8 = Math.sin(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const x = Math.sin(k * Math.PI / 4) * 0.218, z = Math.cos(k * Math.PI / 4) * 0.218;
      P.push([new T.BoxGeometry(0.028, gl + 0.02, 0.028).translate(x * c8 + z * s8, gy0 + gl / 2, -x * s8 + z * c8), LAMP_BRONZE]);
    }
    for (const f of [0.3, 0.72]) { const r = 0.197 + 0.04 * f + 0.008; P.push([oct(r + 0.004, r, 0.025, gy0 + gl * f), LAMP_BRONZE]); }
  }
  // Haube: Zikkurat in vier Stufen, Goldfinnen, kannelierte Spitze, Kugel
  let y = gy1;
  for (const [r, hh, c] of [[0.31, 0.055, LAMP_GOLD], [0.26, 0.08, LAMP_IRON], [0.2, 0.09, LAMP_IRON], [0.135, 0.11, LAMP_GOLD]]) { P.push([oct(r, r + (fine ? 0.01 : 0), hh, y), c]); y += hh; }
  if (fine) for (let k = 0; k < 8; k++) {
    const a = (k + 0.5) / 8 * Math.PI * 2;
    const fin = new T.BoxGeometry(0.11, 0.2, 0.012).translate(0.055, 0.1, 0).rotateY(-a).translate(Math.cos(a) * 0.14, gy1 + 0.13, Math.sin(a) * 0.14);
    P.push([fin, LAMP_GOLD]);
  }
  P.push([fine ? flutedCyl(0.025, 0.075, 0.32, 8, 0.25, y) : new T.ConeGeometry(0.075, 0.32, 6).translate(0, y + 0.16, 0), LAMP_IRON]);
  P.push([new T.SphereGeometry(0.05, fine ? 12 : 6, fine ? 8 : 4).translate(0, y + 0.36, 0), LAMP_GOLD]);
  const out = { metal: mergeColored(P), glass: mergeColored(G.map(g => [g, [1, 1, 1]])) };
  // Milchglas: unten etwas dunkler, oben am hellsten (die Glühbirne sitzt oben)
  { const p = out.glass.attributes.position, c = out.glass.attributes.color; for (let i = 0; i < p.count; i++) { const v = 0.7 + 0.3 * (p.getY(i) - gy0) / gl; c.setXYZ(i, v, v, v); } }
  _cache.set(key, out);
  return out;
}
export let LAMP_MATS = null;
export function decoLampMats() {
  if (LAMP_MATS) return LAMP_MATS;
  return LAMP_MATS = {
    metal: snowy(stdMat({ color: 0xffffff, vertexColors: true, metalness: 0.7, roughness: 0.38, envI: 0.6, emissive: 0x060403 }), 0.9),   // V30: Schneehauben
    glass: new T.MeshBasicMaterial({ color: new T.Color(1.7, 1.18, 0.66), vertexColors: true }),
  };
}
