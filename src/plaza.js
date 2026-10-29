import { T, U, MOBILE } from './core.js';
import { streetDetail } from './serpentine.js';
import { PLAZA } from './island.js';

/* =====================================================================
   V27 · BELMONT-PLATZ: Boden ganz im Shader statt einer 2048er-Leinwand
   Vorher: eine Leinwand über 198 × 266 m, also etwa 10 Pixel je Meter, aus der Nähe verschwommen.
   Jetzt rechnet der Shader das Pflaster aus der Weltlage aus, damit ist es in jeder Nähe scharf:
   - Strahlenkranz um das Belmont: 72 Sektoren aus zwei Graniten, radial verlegte Platten
     (je Ring versetzt, nach außen feiner geteilt), polierte Oberfläche mit Glimmer und Körnung
   - Messingeinlagen: drei Ringe, zwölf Strahlen zwischen den Ringen, doppelte Randlinie
   - um den Brunnen ein Fächermuster (Art-Déco-Muschel) mit zwei Messingringen
   - am Platzrand ein Band aus rechteckigen Platten im Läuferverband
   - Fugen als echtes Relief (Bump aus der Fugenhöhe), Kanten leicht abgerundet, Schmutz in den Fugen
   - Feinstruktur aus dem Gesteinsfoto (uStone), in der Ferne weich zum Mittelwert
   Darüber liegen Nässe, Pfützen, Spiegelung und Schnee aus streetDetail (Modus 'plaza').
   ===================================================================== */
export const PLAZA_GLSL = `
  float pzH(vec2 p){ p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
  float pzN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(pzH(i), pzH(i + vec2(1.0, 0.0)), f.x), mix(pzH(i + vec2(0.0, 1.0)), pzH(i + vec2(1.0, 1.0)), f.x), f.y); }
  // Linie der Breite w (Meter) um den Abstand d, weich über ein Pixel
  float pzLine(float d, float w, float px){ return 1.0 - smoothstep(w * 0.5 - px * 0.5, w * 0.5 + px * 0.5, abs(d)); }
`;
export function plazaMaterial() {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05 });
  streetDetail(mat, 'plaza');
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    prev(sh);
    sh.uniforms.uStone = U.uStone; sh.uniforms.uStoneOn = U.uStoneOn;
    const X1 = PLAZA.x1.toFixed(1), Z1 = PLAZA.z1.toFixed(1);
    sh.fragmentShader = 'uniform sampler2D uStone; uniform float uStoneOn;\n' + PLAZA_GLSL + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float pzBrass = 0.0, pzGroove = 0.0, pzPolish = 1.0;
        {
          vec2 p = vSdW.xz;
          float px = max(length(fwidth(p)), 1e-4), fine = 1.0 - smoothstep(0.015, 0.09, px), mid = 1.0 - smoothstep(0.08, 0.5, px);
          float r = length(p), th = atan(p.y, p.x), TAU = 6.2831853;
          vec3 cA = vec3(0.165, 0.135, 0.19), cB = vec3(0.105, 0.095, 0.12);   // pflaumengrauer und anthrazitfarbener Granit
          vec3 c; float dJ = 1.0; float id;
          vec2 fq = p - vec2(0.0, 95.0); float fr = length(fq), fth = atan(fq.y, fq.x);
          float edgeD = min(${X1} - abs(p.x), ${Z1} - abs(p.y));
          if (edgeD < 4.0) {
            // Randband: Läuferverband 1,2 × 0,6 m parallel zum Rand
            vec2 q = abs(p.x) / ${X1} > abs(p.y) / ${Z1} ? p.yx : p.xy;
            float row = floor(q.y / 0.6), u = q.x / 1.2 + 0.5 * mod(row, 2.0);
            dJ = min(min(fract(u), 1.0 - fract(u)) * 1.2, min(fract(q.y / 0.6), 1.0 - fract(q.y / 0.6)) * 0.6);
            id = pzH(vec2(floor(u), row) + 0.3);
            c = vec3(0.085, 0.08, 0.095) * (0.85 + 0.3 * id);
            pzBrass = max(pzLine(edgeD - 4.0, 0.14, px), pzLine(edgeD - 3.55, 0.06, px));
          } else if (fr < 26.4) {
            // um den Brunnen: Fächer (Muschel) aus hellerem Granit, dazwischen dunkle Keile
            float ring = floor(fr / 1.1), nS = max(8.0, exp2(floor(log2(max(fr, 1.0) * TAU / 1.25)))) ;
            float u = fth / TAU * nS + 0.5 * mod(ring, 2.0);
            dJ = min(min(fract(fr / 1.1), 1.0 - fract(fr / 1.1)) * 1.1, min(fract(u), 1.0 - fract(u)) * fr * TAU / nS);
            id = pzH(vec2(floor(u), ring) + 5.1);
            float fan = fract(fth / TAU * 24.0), scal = abs(fan - 0.5) * 2.0;
            float shell = step(fr, 22.0) * step(15.6, fr) * smoothstep(0.0, 0.08, (22.0 - fr) / 6.4 - scal * scal * 0.9);
            c = mix(vec3(0.2, 0.18, 0.2), vec3(0.3, 0.26, 0.24), shell) * (0.88 + 0.24 * id);
            pzBrass = max(max(pzLine(fr - 22.0, 0.14, px), pzLine(fr - 26.0, 0.14, px)), pzLine(fr - 15.9, 0.08, px));
            pzBrass = max(pzBrass, shell * pzLine((22.0 - fr) / 6.4 - scal * scal * 0.9, 0.012, px / 6.4) * step(15.6, fr));
          } else {
            // Strahlenkranz: 72 Sektoren, Platten radial verlegt
            float sec = floor(th / TAU * 72.0 + 72.0), even = mod(sec, 2.0);
            float ring = floor(r / 1.05);
            float nS = exp2(floor(log2(max(r, 1.0) * TAU / 72.0 / 0.95)));
            float u = (th / TAU * 72.0 + 72.0) * max(nS, 1.0) + 0.5 * mod(ring, 2.0) * step(1.5, nS);
            float dR = min(fract(r / 1.05), 1.0 - fract(r / 1.05)) * 1.05;
            float dT = min(fract(u), 1.0 - fract(u)) * r * TAU / 72.0 / max(nS, 1.0);
            dJ = min(dR, dT);
            id = pzH(vec2(floor(u), ring));
            c = mix(cA, cB, even) * (0.86 + 0.26 * id);
            // Messing: drei Ringe, zwölf Strahlen zwischen dem inneren und äußeren Ring
            pzBrass = max(max(pzLine(r - 62.0, 0.16, px), pzLine(r - 70.0, 0.1, px)), pzLine(r - 84.0, 0.16, px));
            float ray = abs(fract(th / TAU * 12.0 + 0.5) - 0.5) * r * TAU / 12.0;
            pzBrass = max(pzBrass, pzLine(ray, 0.08, px) * step(62.0, r) * step(r, 84.0));
            // zwischen den Ringen ein Band aus hellem Kalkstein
            c = mix(c, vec3(0.26, 0.23, 0.22) * (0.9 + 0.2 * id), step(70.0, r) * step(r, 84.0) * (1.0 - even) * 0.85);
          }
          // Körnung des Granits: Glimmer, helle und dunkle Kristalle, Wolken; dazu das Gesteinsfoto
          float g1 = pzH(floor(p * 140.0)), g2 = pzH(floor(p * 55.0) + 3.0), cloud = pzN(p * 0.8 + id * 9.0) * 0.6 + pzN(p * 3.1) * 0.4;
          vec3 grain = vec3(1.0) + fine * (0.42 * step(0.93, g1) - 0.25 * step(g1, 0.12) + 0.1 * (g2 - 0.5));
          float ps = dot(texture2D(uStone, p / 1.7 + id * 3.7).rgb, vec3(0.333)); ps = ps * ps / 0.094;
          c *= grain * (0.9 + 0.2 * cloud) * mix(1.0, 0.65 + 0.35 * ps, uStoneOn * mid * 0.7);
          // Fugen: 7 mm, Kanten gefast, Schmutz darin; über die Ferne gemittelt
          float joint = 1.0 - smoothstep(0.0035, 0.0035 + px * 0.8, dJ);
          float bevel = 1.0 - smoothstep(0.0, 0.025, dJ);
          c *= mix(1.0, 0.94, mid * (1.0 - fine) * 0.6);
          c = mix(c * (1.0 - 0.25 * bevel * fine), vec3(0.03, 0.028, 0.03), joint * fine);
          pzGroove = (1.0 - smoothstep(0.0, 0.03, dJ)) * fine;
          // Gebrauchsspuren: matte Laufwege, dunkle Flecken
          pzPolish = 0.75 + 0.5 * pzN(p * 0.15 + 4.0) - 0.4 * joint;
          c *= 1.0 - 0.15 * smoothstep(0.7, 0.85, pzN(p * 0.4 + 11.0));
          vec3 brass = vec3(0.78, 0.56, 0.26) * (0.85 + 0.25 * pzN(p * 2.0));
          c = mix(c, brass, pzBrass);
          diffuseColor.rgb = c * 1.35;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(clamp(roughnessFactor / pzPolish, 0.18, 0.9), 0.28, pzBrass);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.85, pzBrass);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // Relief der Fugen: Höhe fällt zur Fuge ab; Normale aus den Bildschirm-Ableitungen der Höhe
          float hgt = -pzGroove * 0.006;
          vec3 sp = -vViewPosition, sx = dFdx(sp), sy = dFdy(sp);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
          vec3 grad = sign(det) * (dFdx(hgt) * r1 + dFdy(hgt) * r2);
          normal = normalize(abs(det) * normal - grad * ${MOBILE ? '0.6' : '1.0'});
        }`);
  };
  return mat;
}
