/* =====================================================================
   V117 · UMGEBUNGSVERDECKUNG (draußen)
   Wo eine Hauswand auf das Pflaster trifft, kommt weniger Himmelslicht
   hin: ein weicher dunkler Saum läuft rund um jedes Gebäude am Boden
   (breiter bei hohen Häusern, schmal an Pfeilern und Laternenmasten aus
   Stein). Beim Laden einmal aus der Gebäudeliste (segs) gebaut, ein
   Netz, ein Zeichenaufruf, Shader mit drei Zeilen: dunkelt nur ab
   (wie spuren.js und lichtschatten.js) und blendet in der Ferne aus,
   damit im Nebel keine dunklen Umrisse stehen.
   Gegenstücke: Wandfuß und Dachbrüstung im Fassaden-Shader (#define
   VERDECKUNG), Kontaktschatten unter Leuten und Wagen in
   lichtschatten.js, Innenräume schon seit V67 (raumlicht.js).
   ?verdeckung=aus schaltet alles ab. Kein Import außer core.js.
   ===================================================================== */
import { T, scene, MOBILE, LOW } from './core.js';

export const VERDECKUNG = new URLSearchParams(location.search).get('verdeckung') !== 'aus';
export const VD = { mesh: null, n: 0 };

// s: Gebäudeabschnitte aus facade-shader.js (x, z, w, d, y0, y1, ry)
export function buildGroundAO(segs) {
  if (!VERDECKUNG || VD.mesh) return;
  const pos = [], al = [], idx = [];
  for (const s of segs) {
    if (s.dead || s.blockOnly || s.y0 > 0.7 || s.y0 < -1) continue;
    const h = s.y1 - s.y0, m = Math.min(s.w, s.d); if (h < 2 || m < 0.25) continue;
    // Saumbreite: hohe Häuser verdecken mehr Himmel; Pfeiler und schmale Teile nur einen kleinen Kranz
    const W = Math.min(0.45 + 0.1 * Math.min(h, 9), 0.55 + m * 0.9), A = m < 2 ? 0.32 : 0.46;
    const c = Math.cos(s.ry || 0), sn = Math.sin(s.ry || 0), y = s.y0 + 0.035;
    const hw = s.w / 2, hd = s.d / 2;
    // innen 4 Ecken am Wandfuß, außen 4 Ecken um W hinausgeschoben (Gehrung an den Ecken)
    const P = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]], O = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const b = pos.length / 3;
    for (let k = 0; k < 4; k++) for (const o of [0, W]) {
      const lx = P[k][0] + O[k][0] * o, lz = P[k][1] + O[k][1] * o;
      pos.push(s.x + lx * c + lz * sn, y, s.z - lx * sn + lz * c); al.push(o ? 0 : A);
    }
    for (let k = 0; k < 4; k++) { const i0 = b + k * 2, i1 = b + ((k + 1) % 4) * 2; idx.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1); }
  }
  if (!idx.length) return;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('aA', new T.Float32BufferAttribute(al, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  const far = MOBILE || LOW ? '55.0, 130.0' : '90.0, 230.0';
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.ZeroFactor, blendDst: T.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: `attribute float aA; varying float vA;
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vA = aA * (1.0 - smoothstep(${far}, distance(wp.xyz, cameraPosition)));
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    // Verlauf zum Wandfuß hin quadratisch: an der Wand dunkel, nach außen weich auslaufend
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, vA * vA * 2.0); }`,
  });
  const mesh = new T.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.userData.noRefl = true;
  scene.add(mesh); VD.mesh = mesh; VD.n = idx.length / 6;
}
