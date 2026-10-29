import { T, U, FOG_GLSL } from './core.js';
import { addCollider } from './people-skeleton.js';

/* =====================================================================
   FASSADEN-SHADER: Fenster, Goldbänder, Ladenzeilen, Flutlicht
   Ein Quader pro Gebäudeabschnitt (InstancedMesh). Fenster entstehen
   im Shader aus den echten Maßen, daher bleiben sie immer gleich groß.
   ===================================================================== */
export const facadeVS = `
attribute vec3 aTint; attribute vec4 aParams; attribute vec3 aRib; attribute float aFlag;
varying vec3 vWorld; varying vec4 vEdge; varying vec3 vN; varying vec3 vLN; varying vec3 vT; varying vec3 vTint; varying vec4 vParams; varying vec3 vRib; varying vec3 vLocal; varying vec3 vScale; varying float vFogDepth;
void main(){
  vLN = normal;
  vT = normalize(mat3(modelMatrix * instanceMatrix) * (abs(normal.x) > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0)));
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vLocal = position; vTint = aTint; vParams = aParams; vRib = aRib;
  vec4 mv = viewMatrix * wp; vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
  // V23: Bits aus aFlag (siehe FL): 1 kein Dach, 2 keine Unterseite (Fläche fällt aus dem Bild), 4/8/16/32 Kante -x/+x/-z/+z liegt innen (keine Brüstung)
  float fb = aFlag;
  if ((normal.y > 0.5 && mod(fb, 2.0) > 0.5) || (normal.y < -0.5 && mod(floor(fb / 2.0), 2.0) > 0.5)) gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
  vEdge = vec4(mod(floor(fb / 4.0), 2.0), mod(floor(fb / 8.0), 2.0), mod(floor(fb / 16.0), 2.0), mod(floor(fb / 32.0), 2.0)) * 1e4;
}`;
export const facadeFS = `
#define BRICK_MEAN vec3(0.519, 0.287, 0.184)
uniform float uTime; uniform vec3 uFogColor; uniform float uFogDensity; uniform vec3 uMoonDir; uniform vec3 uTeal; uniform vec3 uCam; uniform sampler2D uBrick; uniform float uBrickOn; uniform sampler2D uStone; uniform float uStoneOn; uniform float uWet; uniform float uSnowCover;
varying vec3 vWorld; varying vec3 vN; varying vec3 vLN; varying vec3 vT; varying vec3 vTint; varying vec4 vParams; varying vec3 vRib; varying vec3 vLocal; varying vec3 vScale; varying float vFogDepth; varying vec4 vEdge;
${FOG_GLSL}
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0 - 2.0*f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main(){
  vec3 n = normalize(vN); vec3 ln = vLN;
  float seed = mod(floor(vParams.x + 0.5), 89.0), style = floor(vParams.y + 0.5), dens = vParams.z, flood = vParams.w;
  float hy = (vLocal.y + 0.5) * vScale.y;
  float topDist = (0.5 - vLocal.y) * vScale.y;
  float baseY = vWorld.y - hy;
  float moon = max(dot(n, uMoonDir), 0.0);
  float sky = 0.5 + 0.5*n.y;
  float brick = step(vTint.g*1.35, vTint.r);
  // Mauerwerk: Steinquader mit Fugen und Kantenschliff, bei Backstein einzelne Ziegel mit Mörtel
  float uW = abs(vLN.x) > 0.5 ? (vLocal.z + 0.5)*vScale.z : (vLocal.x + 0.5)*vScale.x;
  float wpx = length(fwidth(vWorld));
  float fineFade = 1.0 - smoothstep(0.05, 0.3, wpx);
  float midFade = 1.0 - smoothstep(0.25, 1.2, wpx);
  float row = floor(vWorld.y / 0.6), jy = fract(vWorld.y / 0.6);
  float blkL = 1.2 + 0.6*hash(vec2(row, seed));
  float bx = (uW + hash(vec2(row, seed + 3.0))*blkL) / blkL, jx = fract(bx);
  float dJ = min(min(jy, 1.0 - jy)*0.6, min(jx, 1.0 - jx)*blkL);
  float ashJoint = 1.0 - smoothstep(0.008, 0.03, dJ);
  float ashTone = 0.86 + 0.24*hash(vec2(floor(bx), row + seed*1.7));
  float ashBevel = mix(0.82, 1.0, smoothstep(0.0, 0.07, dJ)) * (1.0 + 0.1*smoothstep(0.9, 1.0, jy)*step(0.03, dJ));
  float brow = floor(vWorld.y * 13.0), bry = fract(vWorld.y * 13.0);
  float bbx = uW / 0.24 + 0.5*mod(brow, 2.0), brx = fract(bbx);
  float bId = hash(vec2(floor(bbx), brow + seed));
  float brMortar = max(1.0 - smoothstep(0.1, 0.22, min(bry, 1.0 - bry)), 1.0 - smoothstep(0.035, 0.08, min(brx, 1.0 - brx)));
  vec3 brickC = vTint * (0.78 + 0.42*bId) * mix(vec3(1.0), vec3(0.75, 0.68, 0.62), step(0.86, bId));
  vec3 masonry = mix(vTint * ashTone * ashBevel, vTint * vec3(0.72, 0.7, 0.68), ashJoint * fineFade);
  vec3 brickWall = mix(brickC, vec3(0.62, 0.6, 0.56) * 0.55, brMortar * 0.85);
  brickWall = mix(vTint, brickWall, fineFade);
  // V21: Foto-Backstein (assets/textures/brick-color.jpg) in der Hausfarbe; je Haus leicht versetzt, in der Ferne weich zur Grundfarbe
  vec3 ph = texture2D(uBrick, vec2(uW + seed*0.37, vWorld.y) / 1.25).rgb; ph = ph*ph / BRICK_MEAN;
  vec3 photoBrick = vTint * mix(vec3(1.0), ph, 0.3 + 0.7*midFade) * (0.92 + 0.16*hash(vec2(floor(uW/1.6 + seed*0.23), floor(vWorld.y/1.6)) + seed));
  brickWall = mix(brickWall, photoBrick, uBrickOn * (0.25 + 0.75*midFade));
  // Jedes Haus bekommt sein eigenes Material: Quader, Kalkstein mit Rustika, glasierte Fliesen, Terrakotta-Relief, polierter Granit
  float matT = floor(hash(vec2(seed, 5.3)) * 8.0), gloss = 0.0;
  vec2 wq = vec2(uW, vWorld.y);
  vec3 surf = masonry;
  if (matT > 1.5 && matT < 2.5) {
    float ly = vWorld.y / 0.9, lj = fract(ly), lx = fract(uW / 1.5 + 0.5*mod(floor(ly), 2.0));
    float jj = 1.0 - smoothstep(0.004, 0.016, min(min(lj, 1.0 - lj)*0.9, min(lx, 1.0 - lx)*1.5));
    float groove = step(hy, 10.0) * (1.0 - smoothstep(0.015, 0.05, min(lj, 1.0 - lj)*0.9));
    float speck = hash(floor(wq*70.0)), cloud = vnoise(wq*2.5 + seed) * 0.6 + vnoise(wq*9.0) * 0.4;
    surf = vTint * vec3(1.04, 1.0, 0.92) * (0.9 + 0.14*cloud + 0.08*(speck - 0.5)*fineFade) * (0.94 + 0.12*hash(vec2(floor(uW/1.5 + 0.5*mod(floor(ly), 2.0)), floor(ly)) + seed));
    surf = mix(surf, vTint*0.55, clamp(jj*0.5*fineFade + groove*0.85*midFade, 0.0, 1.0));
    surf *= 1.0 + 0.12*groove*step(0.5, lj)*midFade;
  } else if (matT < 3.5) {
    vec2 tq = wq / 0.15, tf = fract(tq), ti = floor(tq);
    float tj = 1.0 - smoothstep(0.03, 0.09, min(min(tf.x, 1.0 - tf.x), min(tf.y, 1.0 - tf.y)));
    float gp = hash(vec2(seed, 8.0));
    vec3 glaze = gp < 0.25 ? vec3(0.32, 0.6, 0.55) : gp < 0.5 ? vec3(0.86, 0.8, 0.66) : gp < 0.75 ? vec3(0.42, 0.55, 0.38) : vec3(0.8, 0.6, 0.32);
    glaze *= dot(vTint, vec3(0.333)) * 1.4 * (0.88 + 0.22*hash(ti + seed)) * (0.95 + 0.1*vnoise(tf*3.0 + ti));
    surf = mix(glaze, glaze*0.62 + vTint*0.15, tj*fineFade*0.7); gloss = (1.0 - tj*fineFade) * 0.9;
  } else if (matT < 4.5) {
    vec2 pq = wq / 0.6, pf = fract(pq); float pid = hash(floor(pq) + seed);
    float motif = step(0.5, fract(seed*0.37));
    float chev = fract((abs(pf.x - 0.5) + pf.y)*3.0), sun = fract(atan(pf.y + 0.15, pf.x - 0.5) * 2.5);
    float rel = motif > 0.5 ? chev : sun;
    float shade = 0.8 + 0.32*smoothstep(0.0, 0.2, rel)*smoothstep(1.0, 0.7, rel);
    float pj = 1.0 - smoothstep(0.01, 0.035, min(min(pf.x, 1.0 - pf.x), min(pf.y, 1.0 - pf.y)));
    vec3 terra = mix(vTint, vec3(0.78, 0.44, 0.27) * dot(vTint, vec3(0.5)) * 1.3, 0.65) * (0.9 + 0.18*pid);
    surf = terra * mix(1.0, shade, fineFade); surf = mix(surf, terra*0.55, pj*fineFade);
  } else if (matT < 5.5) {
    vec2 gq = wq / vec2(1.8, 1.2), gf = fract(gq); float gid = hash(floor(gq) + seed);
    float gj = 1.0 - smoothstep(0.003, 0.012, min(min(gf.x, 1.0 - gf.x)*1.8, min(gf.y, 1.0 - gf.y)*1.2));
    float sp1 = hash(floor(wq*90.0)), sp2 = hash(floor(wq*35.0) + 7.0);
    vec3 gran = vTint * 0.75 * (0.85 + 0.25*gid);
    gran *= 1.0 + fineFade*(0.35*step(0.88, sp1) - 0.3*step(sp1, 0.12) + 0.15*(sp2 - 0.5));
    surf = mix(gran, gran*0.4, gj*fineFade); gloss = 0.55;
  } else if (matT < 6.5) {
    // Sandstein in Schichten: jede zweite Lage dunkler, grobe Körnung, Kanten leicht ausgebrochen
    float ly = vWorld.y / 0.75, lj = fract(ly), lrow = floor(ly), lx = fract(uW / 1.9 + 0.37*mod(lrow, 3.0));
    float jj = 1.0 - smoothstep(0.006, 0.024, min(min(lj, 1.0 - lj)*0.75, min(lx, 1.0 - lx)*1.9));
    float grain = vnoise(wq*18.0 + seed)*0.5 + hash(floor(wq*120.0))*0.5;
    vec3 sand = vTint * mix(vec3(1.05, 0.98, 0.86), vec3(0.78, 0.7, 0.62), step(0.5, mod(lrow, 2.0))) * (0.9 + 0.16*grain) * (0.94 + 0.12*hash(vec2(floor(uW / 1.9 + 0.37*mod(lrow, 3.0)), lrow) + seed));
    surf = mix(sand, sand*0.5, jj*fineFade);
  } else {
    // Weiß glasierter Klinker, unten dunkler Granitsockel
    vec2 kq = vec2(uW / 0.3 + 0.5*mod(floor(vWorld.y / 0.085), 2.0), vWorld.y / 0.085), kf = fract(kq), ki = floor(kq);
    float kj = 1.0 - smoothstep(0.03, 0.09, min(min(kf.x, 1.0 - kf.x)*0.3, min(kf.y, 1.0 - kf.y)*0.085) / 0.085);
    vec3 glz = vTint * vec3(1.25, 1.22, 1.15) * (0.9 + 0.16*hash(ki + seed));
    surf = mix(glz, glz*0.6, kj*fineFade*0.8); gloss = 0.5 * (1.0 - kj*fineFade);
    float plinth = step(hy, 1.1) * step(baseY, 0.6);
    surf = mix(surf, vTint*0.42*(0.9 + 0.2*hash(floor(wq*60.0))), plinth); gloss = mix(gloss, 0.6, plinth);
  }
  // V23: Foto-Gestein als Feinstruktur auf Naturstein (nicht auf Fliesen, Terrakotta, Klinker); je Haus versetzt, in der Ferne weg
  float stoneMat = 1.0 - step(2.5, matT) * step(matT, 4.5) - step(6.5, matT);
  float psl = dot(texture2D(uStone, wq / 2.2 + vec2(seed*0.131, seed*0.071)).rgb, vec3(0.333)); psl = psl*psl / 0.094;
  surf *= mix(1.0, 0.55 + 0.45*psl, uStoneOn * stoneMat * midFade * 0.8);
  vec3 tex = mix(mix(vTint, surf, midFade), brickWall, brick);
  gloss *= 1.0 - brick;
  // Verwitterung: Regenspuren nach unten, Ruß am Boden, große Farbflecken
  float streak = vnoise(vec2(uW * 1.7 + seed, vWorld.y * 0.045)) * vnoise(vec2(uW * 0.6, vWorld.y * 0.02 + seed));
  float blotch = vnoise(vec2(uW * 0.07 + vWorld.x * 0.01, vWorld.y * 0.05 + vWorld.z * 0.01));
  float weather = (1.0 - 0.32*streak) * (0.84 + 0.3*blotch) * (1.0 - 0.3*exp(-max(vWorld.y, 0.0)/5.0));
  vec3 stone = tex * weather * (0.02 + 0.03*sky + 0.07*moon);
  stone += tex * vec3(1.0, 0.6, 0.3) * 0.12 * exp(-vWorld.y/14.0);
  stone += tex * uTeal * 0.3 * exp(-vWorld.y/70.0);
  stone += tex * vec3(0.1, 0.2, 0.3) * 0.08;
  // Glanz auf Fliesen und Granit: Spiegelung von Mond und Himmel
  vec3 vd0 = normalize(vWorld - uCam); vec3 vdir = vd0;
  float spec = pow(max(dot(reflect(vd0, n), uMoonDir), 0.0), 40.0);
  stone += gloss * (spec * vec3(0.5, 0.55, 0.6) * 0.35 + uFogColor * 1.6 * pow(1.0 - abs(dot(n, -vd0)), 3.0) * 0.4 + vec3(1.0, 0.6, 0.3) * 0.05 * exp(-vWorld.y/10.0));

  bool xFace = abs(ln.x) > 0.5;
  float faceW = xFace ? vScale.z : vScale.x;
  float um = xFace ? (vLocal.z + 0.5)*vScale.z : (vLocal.x + 0.5)*vScale.x;
  float cw = style < 0.5 ? 3.2 : (style < 1.5 ? 2.4 : 5.2);
  float ch = style < 1.5 ? 3.6 : 7.2;
  float margin = style < 1.5 ? 1.0 : 1.6;
  float usable = max(faceW - 2.0*margin, 1.0);
  float ncell = max(1.0, floor(usable / cw));
  float ux = (um - margin) / (usable / ncell);
  float vy = vWorld.y / ch;
  vec2 cell = floor(vec2(ux, vy));
  vec2 f = fract(vec2(ux, vy));
  vec2 fw = fwidth(vec2(ux, vy));

  float wx = style < 0.5 ? 0.58 : (style < 1.5 ? 0.5 : 0.74);
  float wy = style < 0.5 ? 0.52 : (style < 1.5 ? 0.72 : 0.84);
  float px = max(fw.x, fw.y);
  float inX = 1.0 - smoothstep(wx*0.5 - fw.x*0.7, wx*0.5 + fw.x*0.7, abs(f.x - 0.5));
  float inWin = inX * (1.0 - smoothstep(wy*0.5 - fw.y*0.7, wy*0.5 + fw.y*0.7, abs(f.y - 0.5)));
  if (style > 1.5) {
    vec2 q = vec2((f.x - 0.5)/(wx*0.5), max(f.y - 0.62, 0.0)/0.3);
    inWin = inX * step(abs(f.y - 0.5), wy*0.5) * step(dot(q,q), 1.0);
  }
  inWin *= step(0.0, ux) * step(ux, ncell);
  inWin *= step(1.6, topDist) * step(style, 2.5);
  float ground = step(baseY, 0.6) * step(hy, 4.6) * step(style, 2.5);
  inWin *= 1.0 - ground;
  float ribOn = step(0.01, dot(vRib, vec3(1.0)));
  float pier = (style > 0.5 && style < 1.5 && ncell > 5.0) ? step(mod(cell.x, 4.0), 0.5) : 0.0;
  float ribStrip = ribOn * step(min(f.x, 1.0 - f.x), 0.07) * step(1.0, cell.x) * step(cell.x, ncell - 1.0) * (1.0 - ground);
  inWin *= 1.0 - pier;
  // V19: Fenster sitzen hinter der Fassadenebene. Der Blick trifft die Glasebene versetzt (Parallaxe); verlässt er die Öffnung, sieht man die steinerne Laibung
  vec3 rvW = vec3(dot(vdir, normalize(vT)), vdir.y, max(dot(vdir, -n), 0.06));
  float REC = style > 1.5 ? 0.45 : 0.3;
  vec2 cellSz = vec2(usable / ncell, ch);
  float nearF = 1.0 - smoothstep(0.08, 0.28, px);
  vec2 g = f + (rvW.xy / rvW.z) * REC / cellSz * nearF;
  float inXg = step(abs(g.x - 0.5), wx*0.5);
  float inWinG = inXg * step(abs(g.y - 0.5), wy*0.5);
  if (style > 1.5) { vec2 q2 = vec2((g.x - 0.5)/(wx*0.5), max(g.y - 0.62, 0.0)/0.3); inWinG = inXg * step(abs(g.y - 0.5), wy*0.5) * step(dot(q2,q2), 1.0); }
  float reveal = step(0.5, inWin) * (1.0 - inWinG) * nearF;

  float faceId = xFace ? (ln.x > 0.0 ? 1.0 : 2.0) : (ln.z > 0.0 ? 3.0 : 4.0);
  float h = hash(cell + vec2(seed*3.17 + faceId*7.1, seed*1.31 + faceId));
  float lit = step(1.0 - dens, h);
  float t2 = hash(cell.yx*1.31 + vec2(seed, faceId));
  vec3 warm = mix(vec3(1.0, 0.52, 0.2), vec3(1.0, 0.78, 0.5), t2);
  if (t2 > 0.96) warm = vec3(0.75, 0.9, 1.0);
  if (t2 < 0.05) warm = vec3(1.0, 0.95, 0.85);
  if (style > 1.5) warm = vec3(1.0, 0.8, 0.5);
  float bright = (0.38 + 0.45*h) * (0.72 + 0.4*g.y);
  if (style > 1.5) bright = 1.15 + 0.4*exp(-pow((g.x-0.5)*5.0,2.0)) * step(0.6, g.y);
  vec3 glass = vec3(0.012, 0.015, 0.032) + vec3(0.05, 0.04, 0.09)*moon + vec3(0.07, 0.04, 0.02)*exp(-vWorld.y/20.0);
  // Jalousien und Vorhänge: halb heruntergelassen, seitlich gerafft
  float blind = step(0.55, hash(cell + vec2(17.0, seed)));
  float bl = blind * step(1.0 - 0.55*hash(cell + vec2(3.0, 9.0)), g.y);
  float curtain = (1.0 - blind) * step(0.6, t2) * (step(g.x, 0.28) + step(0.72, g.x));
  bright *= 1.0 - 0.55*bl - 0.45*curtain;
  if (bl > 0.5) bright *= mix(0.875, 0.75 + 0.25*step(0.5, fract(g.y*18.0)), 1.0 - smoothstep(0.012, 0.035, px));
  float fres = pow(1.0 - abs(dot(n, -vdir)), 4.0);
  glass += mix(uFogColor*2.4, vec3(0.5, 0.42, 0.3), step(0.5, hash(cell + 31.0))*0.3) * fres * 0.5 + uTeal*0.03*(0.5 + 0.5*n.y);
  vec3 winCol = mix(glass, warm*bright, lit);
  // Räume hinter dem Glas (Interior Mapping): Rückwand, Decke mit Lampe, Boden, Seitenwände, ein paar Möbel
  float aaW = smoothstep(0.08, 0.28, px);
  if (inWin > 0.5 && aaW < 0.95 && style < 1.5) {
    float cellW = usable / ncell;
    vec3 rv = vec3(dot(vdir, normalize(vT)), vdir.y, max(dot(vdir, -n), 0.04));
    vec2 hs = vec2(cellW, ch) * 0.5;
    vec2 r0 = vec2((g.x - 0.5) * cellW, (g.y - 0.5) * ch);
    float D = 3.0 + 2.5*hash(cell + vec2(41.0, seed));
    vec2 sg = vec2(rv.x < 0.0 ? -1.0 : 1.0, rv.y < 0.0 ? -1.0 : 1.0);
    vec2 rxy = sg * max(abs(rv.xy), 1e-3);
    vec2 tw = (sg * hs - r0) / rxy;
    float tz = D / rv.z;
    float tm = min(min(tw.x, tw.y), tz);
    vec3 hp = vec3(r0 + rxy * tm, rv.z * tm);
    float dz = hp.z / D;
    float roomH = hash(cell + vec2(seed, 77.0));
    vec3 wallC = mix(vec3(0.8, 0.64, 0.45), mix(vec3(0.38, 0.6, 0.55), vec3(0.75, 0.48, 0.36), step(0.5, fract(roomH*7.0))), step(0.62, roomH));
    vec3 lightC = warm * (0.45 + 0.6*h);
    if (style > 1.5) lightC = warm * 1.1;
    vec3 rc;
    // Raumtyp: Wohnzimmer, Büro, Schlafzimmer, Speisezimmer, Atelier, Salon mit Flügel, Bibliothek, Clubraum mit farbigem Licht; Tapete je nach Raum
    float rType = floor(fract(roomH*13.7)*8.0);
    if (rType > 6.5) lightC = mix(lightC, vec3(0.25, 0.75, 0.8) * (0.5 + 0.5*h), 0.55 * step(0.5, fract(roomH*19.0))) + vec3(0.25, 0.05, 0.12) * step(fract(roomH*19.0), 0.5);
    float wallU = tz <= tw.x && tz <= tw.y ? hp.x : hp.z;
    float paper = rType < 0.5 ? 0.9 + 0.1*step(0.5, fract(wallU*3.0)) : rType < 1.5 ? 1.0 : rType < 2.5 ? 0.92 + 0.08*step(0.6, fract(wallU*5.0 + 0.5*step(0.5, fract(hp.y*5.0)))) : rType < 3.5 ? 0.9 + 0.1*smoothstep(0.3, 0.0, length(fract(vec2(wallU, hp.y)*2.5) - 0.5)) : 0.95;
    float wainscot = step(hp.y, -hs.y + 1.0) * step(0.5, fract(roomH*3.1));
    vec3 wallP = mix(wallC * paper, vec3(0.32, 0.19, 0.1), wainscot);
    float floorY = -hs.y;
    if (tz <= tw.x && tz <= tw.y) {
      rc = wallP * lightC * (0.62 + 0.3*smoothstep(-hs.y, hs.y, hp.y));
      float ox = (roomH - 0.5)*cellW*0.4;
      // Bilderrahmen
      float pic = step(abs(hp.x - ox), cellW*0.13) * step(abs(hp.y - hs.y*0.2), ch*0.09);
      float picIn = step(abs(hp.x - ox), cellW*0.11) * step(abs(hp.y - hs.y*0.2), ch*0.07);
      rc = mix(rc, lightC*vec3(0.5, 0.36, 0.14), pic); rc = mix(rc, lightC*mix(vec3(0.2, 0.28, 0.32), vec3(0.42, 0.22, 0.14), fract(roomH*31.0)), picIn);
      float y0 = hp.y - floorY;
      if (rType < 0.5) {            // Sofa und Stehlampe
        float sofa = step(y0, 0.8) * step(abs(hp.x + ox*0.8), cellW*0.3) * step(0.2, y0 + step(y0, 0.45)*0.2) + step(y0, 0.45) * step(abs(hp.x + ox*0.8), cellW*0.34);
        rc = mix(rc, lightC*vec3(0.18, 0.09, 0.07), clamp(sofa, 0.0, 1.0));
        float lampX = hp.x - cellW*0.38; rc = mix(rc, lightC*vec3(0.12), step(abs(lampX), 0.03)*step(y0, 1.5)); rc += lightC*0.7*smoothstep(0.25, 0.0, length(vec2(lampX, y0 - 1.6)));
      } else if (rType < 1.5) {     // Büro: Regal mit Akten, Schreibtisch, grüne Leselampe
        float shelf = step(abs(hp.x + cellW*0.25), cellW*0.2) * step(y0, 2.0);
        float books = shelf * step(0.15, fract(y0*2.5)) * step(0.3, hash(vec2(floor(hp.x*14.0), floor(y0*2.5))));
        rc = mix(rc, lightC*vec3(0.24, 0.14, 0.08), shelf); rc = mix(rc, lightC*mix(vec3(0.35, 0.12, 0.1), vec3(0.15, 0.25, 0.3), hash(vec2(floor(hp.x*14.0), 3.0))), books);
        float desk = step(abs(hp.x - cellW*0.22), cellW*0.22) * step(abs(y0 - 0.75), 0.04); rc = mix(rc, lightC*vec3(0.2, 0.11, 0.06), desk);
        rc += vec3(0.25, 0.8, 0.35)*0.5*smoothstep(0.2, 0.0, length(vec2(hp.x - cellW*0.3, y0 - 0.95)));
      } else if (rType < 2.5) {     // Bett mit Kopfteil, Schrank
        float bed = step(y0, 0.55) * step(abs(hp.x - ox*0.5), cellW*0.3); float head = step(y0, 1.1) * step(abs(hp.x - ox*0.5), cellW*0.3) * step(0.55, y0);
        rc = mix(rc, lightC*vec3(0.62, 0.58, 0.52), bed); rc = mix(rc, lightC*vec3(0.25, 0.14, 0.08), head);
        float ward = step(abs(hp.x + cellW*0.36), cellW*0.12) * step(y0, 2.1); rc = mix(rc, lightC*vec3(0.22, 0.13, 0.08)*(0.85 + 0.15*step(abs(hp.x + cellW*0.36), 0.01)), ward);
      } else if (rType < 3.5) {     // Speisezimmer: Tisch, Stuhllehnen, Anrichte
        float table = step(abs(y0 - 0.78), 0.05) * step(abs(hp.x), cellW*0.3) + step(abs(abs(hp.x) - cellW*0.25), 0.03) * step(y0, 0.78);
        float chairs = step(abs(fract(hp.x/(cellW*0.2)) - 0.5), 0.12) * step(abs(y0 - 0.75), 0.3) * step(abs(hp.x), cellW*0.32);
        rc = mix(rc, lightC*vec3(0.26, 0.14, 0.07), clamp(table + chairs*0.8, 0.0, 1.0));
      } else if (rType < 4.5) {     // Atelier: Staffelei und Pflanze
        float easel = step(abs(hp.x - ox), 0.3) * step(abs(y0 - 1.3), 0.4); float leg = step(abs(abs(hp.x - ox) - 0.2), 0.025) * step(y0, 1.3);
        rc = mix(rc, lightC*vec3(0.75, 0.68, 0.55), easel); rc = mix(rc, lightC*vec3(0.2, 0.12, 0.06), leg);
        float plant = smoothstep(0.32, 0.25, length(vec2(hp.x + cellW*0.35, y0 - 1.0) * vec2(1.0, 0.8))) + step(abs(hp.x + cellW*0.35), 0.15)*step(y0, 0.45);
        rc = mix(rc, lightC*vec3(0.08, 0.18, 0.08), clamp(plant, 0.0, 1.0));
      } else if (rType < 5.5) {     // Salon: Flügel, Kronleuchter, hohe Spiegel
        float lid = step(abs(hp.x - ox*0.6), cellW*0.28) * step(abs(y0 - 0.95 - (hp.x - ox*0.6)*0.35), 0.05);
        float body = step(abs(hp.x - ox*0.6), cellW*0.3) * step(abs(y0 - 0.8), 0.14);
        float legs = step(abs(abs(hp.x - ox*0.6) - cellW*0.24), 0.025) * step(y0, 0.7);
        rc = mix(rc, lightC*vec3(0.03), clamp(lid + body + legs, 0.0, 1.0));
        float mirror = step(abs(hp.x + cellW*0.36), cellW*0.08) * step(abs(y0 - 1.5), 0.9);
        rc = mix(rc, lightC*vec3(0.55, 0.6, 0.62)*(0.7 + 0.3*fract(y0*1.7 + hp.x)), mirror);
        vec2 cl = vec2(hp.x, y0 - (hs.y*2.0 - 0.7)); rc += lightC*vec3(1.2, 0.9, 0.5)*(smoothstep(0.35, 0.0, length(cl*vec2(1.0, 2.2))) + 0.5*step(abs(cl.y), 0.03)*step(abs(cl.x), 0.4));
      } else if (rType < 6.5) {     // Bibliothek: Bücherwand bis unter die Decke, Leiter, grüne Lampe
        float row = floor(y0*2.8), bk = hash(vec2(floor(hp.x*16.0), row));
        float shelfB = step(0.12, fract(y0*2.8)) * step(0.15, bk);
        rc = mix(lightC*vec3(0.2, 0.11, 0.06), lightC*mix(mix(vec3(0.42, 0.1, 0.08), vec3(0.1, 0.22, 0.14), step(0.4, bk)), vec3(0.12, 0.14, 0.3), step(0.75, bk)), shelfB) * step(y0, hs.y*2.0 - 0.2) + rc * step(hs.y*2.0 - 0.2, y0);
        float ladder = step(abs(abs(hp.x - ox) - 0.18), 0.02) * step(y0, 2.4) + step(abs(hp.x - ox), 0.18) * step(abs(fract(y0*3.0) - 0.5), 0.04) * step(y0, 2.4);
        rc = mix(rc, lightC*vec3(0.3, 0.18, 0.08), clamp(ladder, 0.0, 1.0));
        rc += vec3(0.25, 0.8, 0.35)*0.4*smoothstep(0.22, 0.0, length(vec2(hp.x + cellW*0.3, y0 - 0.95)));
      } else {                      // Clubraum: Theke mit Flaschen, Barhocker, farbiges Licht
        float bar = step(y0, 1.05) * step(abs(hp.x), cellW*0.42) * step(0.0, y0);
        float bottles = step(abs(y0 - 1.55), 0.16) * step(0.5, fract(hp.x*9.0)) * step(abs(hp.x), cellW*0.4);
        rc = mix(rc, lightC*vec3(0.22, 0.1, 0.06), bar);
        rc = mix(rc, mix(vec3(0.9, 0.6, 0.2), vec3(0.3, 0.9, 0.8), hash(vec2(floor(hp.x*9.0), 7.0)))*0.9, bottles);
        rc = mix(rc, lightC*vec3(0.8, 0.6, 0.3), step(abs(y0 - 1.06), 0.02) * step(abs(hp.x), cellW*0.42));
      }
    } else if (tw.y < tw.x) {
      vec2 lc = hp.xz - vec2(0.0, D*0.5);
      if (sg.y > 0.0) rc = lightC * (0.45 + 1.1*exp(-dot(lc, lc)*0.45)) * (0.92 + 0.08*step(0.5, fract(hp.x*1.2)) * step(0.5, fract(hp.z*1.2)));
      else {
        // Parkett mit Teppich
        float plank = fract(hp.x*3.0 + floor(hp.z*1.3)*0.37), pl = 0.88 + 0.12*hash(vec2(floor(hp.x*3.0), floor(hp.z*1.3))) - 0.1*step(plank, 0.06);
        vec3 fl = mix(vec3(0.3, 0.19, 0.11)*pl, mix(vec3(0.34, 0.08, 0.08), vec3(0.12, 0.16, 0.24), step(0.5, roomH)), step(abs(hp.x), hs.x*0.6)*step(abs(hp.z - D*0.5), D*0.3));
        rc = lightC * fl * (1.1 - 0.5*dz);
      }
    } else {
      rc = wallP * lightC * (0.5 - 0.15*dz);
    }
    // Menschen im Raum: Umriss vor der Rückwand, gegen das Licht
    float tP = D*(0.35 + 0.3*fract(roomH*7.3)) / rv.z;
    if (fract(roomH*5.1) < 0.4 && tP < tm) {
      vec2 pp = r0 + rxy*tP; float px0 = (fract(roomH*17.0) - 0.5)*cellW*0.5, y0 = pp.y - floorY;
      float body = step(abs(pp.x - px0), 0.2 - 0.05*step(y0, 0.9)) * step(y0, 1.45) + step(length(vec2(pp.x - px0, y0 - 1.6)), 0.12);
      rc = mix(rc, lightC*vec3(0.06, 0.045, 0.04), clamp(body, 0.0, 1.0));
    }
    rc *= 1.05 - 0.35*dz;
    vec3 dark = vec3(0.004, 0.006, 0.011) + uTeal*0.012*(1.0 - dz) + vec3(0.02, 0.012, 0.006)*exp(-vWorld.y/25.0);
    vec3 room = mix(dark, rc, lit);
    float slat = mix(0.85, 0.7 + 0.3*step(0.5, fract(g.y*18.0)), 1.0 - smoothstep(0.012, 0.035, px));
    room = mix(room, warm*(0.3 + 0.35*h)*slat*lit + glass*(1.0 - lit), bl);
    room = mix(room, lightC*vec3(0.55, 0.32, 0.22)*(0.75 + 0.25*sin(g.x*60.0))*lit, curtain);
    winCol = mix(room + glass*0.7, winCol, aaW);
  }
  // Laibung: Schatten oben und an einer Seite, die Fenster wirken eingetieft
  float ex = (f.x - (0.5 - wx*0.5)) / wx, ey = (f.y - (0.5 - wy*0.5)) / wy;
  // Sprossen und Rahmen (auf der Glasebene)
  float mullV = step(abs(g.x - 0.5), 0.035);
  float mullH = step(abs(g.y - (style > 0.5 && style < 1.5 ? 0.64 : 0.5)), 0.03);
  float edgeF = step(wx*0.5 - 0.055, abs(g.x - 0.5)) + step(wy*0.5 - 0.045, abs(g.y - 0.5));
  float frame = clamp(mullV + mullH + edgeF, 0.0, 1.0) * (1.0 - smoothstep(0.06, 0.16, px));
  vec3 frameC = mix(vec3(0.05, 0.04, 0.035), vec3(0.16, 0.14, 0.12), step(0.5, hash(vec2(seed, 44.0)))) * (0.4 + 0.6*moon) + warm*bright*lit*0.06;
  winCol = mix(winCol, frameC, frame);
  // Laibung: der Blick trifft die Seitenwand der Öffnung. Oben der Sturz im Schatten, unten die Bank im Mondlicht, seitlich halbhell; etwas Licht aus dem Raum fällt hinein
  float revTop = step(0.5 + wy*0.5, g.y), revBot = step(g.y, 0.5 - wy*0.5);
  float revSide = (1.0 - revTop) * (1.0 - revBot);
  float revDepth = clamp(length((g - f) * cellSz) / REC, 0.0, 1.0);
  vec3 revealC = stone * (0.42 + 0.6*revBot - 0.22*revTop + 0.12*revSide*step(0.5, g.x)) * (1.1 - 0.35*revDepth) + warm*bright*lit*0.07*(1.0 - revDepth);
  winCol = mix(winCol, revealC, reveal);
  // Ruß und Regenspuren unter den Fensterbänken
  float soot = inX * step(f.y, 0.5 - wy*0.5 - 0.02) * step(0.5 - wy*0.5 - 0.3, f.y) * (0.35 + 0.4*vnoise(vec2(ux*9.0, vy*4.0 + seed))) * step(0.0, ux) * step(ux, ncell) * (1.0 - ground);
  stone *= 1.0 - 0.3*soot*fineFade;
  // Fensterbank
  float sill = inX * step(abs(f.y - (0.5 - wy*0.5) + 0.05), 0.035) * (1.0 - step(abs(f.y - 0.5), wy*0.5));

  vec3 wall = stone;
  wall = mix(wall, stone*1.5, sill * (1.0 - brick));
  // Art-Déco-Brüstungsfelder unter den Fenstern: Zickzack- oder Strahlenrelief in Bronze oder dunklem Stein
  float spOn = step(0.45, hash(vec2(seed, 21.0))) * step(style, 1.5) * (1.0 - ground) * (1.0 - pier);
  float spY = (f.y - 0.06) / max(0.5 - wy*0.5 - 0.12, 0.01);
  float span = spOn * inX * step(0.0, spY) * step(spY, 1.0) * step(0.0, ux) * step(ux, ncell);
  if (span > 0.5) {
    float zz = hash(vec2(seed, 22.0)) < 0.5 ? fract(spY*3.0 + abs(ex - 0.5)*2.0) : fract(atan(spY, ex - 0.5) * 3.0 / 3.14159);
    float sh2 = mix(1.0, 0.72 + 0.5*step(0.5, zz), 1.0 - smoothstep(0.05, 0.2, px));
    vec3 bronze = vec3(0.5, 0.34, 0.16) * (0.05 + 0.28*moon + 0.35*flood*exp(-hy/60.0) + 0.1*exp(-vWorld.y/25.0));
    wall = mix(stone*0.55, bronze, step(0.5, hash(vec2(seed, 23.0)))) * sh2;
  }
  // Gesimsbänder alle zehn Geschosse
  float cornice = step(9.0, mod(cell.y, 10.0)) * step(0.82, f.y) * (1.0 - brick) * step(3.0, topDist);
  wall = mix(wall, stone*1.6, cornice);
  wall = mix(wall, stone*0.5, step(9.0, mod(cell.y, 10.0)) * step(0.76, f.y) * step(f.y, 0.82) * (1.0 - brick) * step(3.0, topDist));
  // Feuerleitern an Backsteinhäusern
  float escCol = step(abs(cell.x - floor(ncell*0.5)), 0.5) * brick * step(1.0, cell.y) * (1.0 - ground);
  float esc = escCol * clamp(step(f.y, 0.07) + step(abs(f.y - f.x), 0.05) + step(abs(f.x - 0.06), 0.02) + step(abs(f.x - 0.94), 0.02), 0.0, 1.0);
  if (style > 0.5 && style < 1.5 && pier < 0.5 && inX > 0.5) wall = stone*0.5 + vec3(0.012, 0.01, 0.008);
  float edge = min(um, faceW - um);
  wall = mix(wall, stone*1.55, step(edge, 0.7) * step(-0.5, dens));
  vec3 det = mix(wall, winCol, inWin);
  det = mix(det, vec3(0.03, 0.028, 0.03), esc);
  // beleuchtete Kanneluren (vertikale Lichtrippen)
  float ribGlow = ribStrip * (0.55 + 0.45*smoothstep(0.0, 0.5, hy/max(vScale.y,1.0))) * (0.85 + 0.3*sin(hy*0.9));
  det = mix(det, vRib * (0.42 + 0.2*step(0.0, -sin(hy*2.0))), ribGlow);
  float narrow = step(faceW, 2.5);
  det = mix(det, vRib * mix(0.62, 0.32 + 0.2*step(0.0, -sin(hy*1.6)), narrow), ribOn * step(edge, 0.7) * (1.0 - ground));

  if (ground > 0.5) {
    float sx = um / 6.0; vec2 sc = vec2(floor(sx), faceId + seed*2.3); float sf = fract(sx);
    float shopLit = step(0.22, hash(sc));
    float win = step(abs(sf - 0.5), 0.4) * step(0.45, hy) * step(hy, 3.5) * step(1.0, um) * step(um, faceW - 1.0);
    vec3 shopC = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.85, 0.62), hash(sc + 2.0));
    vec3 shop = shopC * (0.3 + 0.2*hy/3.5);
    if (aaW < 0.9) {
      // Ladenraum hinter der Scheibe: Regale mit Waren an der Rückwand, Deckenlampe, Marmorboden
      vec3 rv = vec3(dot(vdir, normalize(vT)), vdir.y, max(dot(vdir, -n), 0.04));
      float sfg = sf + rv.x / rv.z * 0.45 / 6.0, hyg = hy + rv.y / rv.z * 0.45;
      vec2 hs = vec2(2.4, 1.525), r0 = vec2((sfg - 0.5) * 6.0, hyg - 0.45 - 1.525);
      float D = 4.0 + 2.0*hash(sc + 9.0);
      vec2 sg = vec2(rv.x < 0.0 ? -1.0 : 1.0, rv.y < 0.0 ? -1.0 : 1.0);
      vec2 rxy = sg * max(abs(rv.xy), 1e-3);
      vec2 tw = (sg * hs - r0) / rxy; float tz = D / rv.z; float tm = min(min(tw.x, tw.y), tz);
      vec3 hp = vec3(r0 + rxy * tm, rv.z * tm); float dz = hp.z / D;
      vec3 rc;
      if (tz <= tw.x && tz <= tw.y) {
        float shelf = step(0.82, fract(hp.y * 1.6 + 0.3));
        vec3 goods = mix(vec3(0.75, 0.5, 0.3), mix(vec3(0.3, 0.6, 0.6), vec3(0.8, 0.25, 0.25), step(0.5, hash(floor(hp.xy*vec2(3.0, 1.6)) + sc))), step(0.45, hash(floor(hp.xy*vec2(3.0, 1.6)) + sc + 3.0)));
        float item = step(0.25, fract(hp.x * 3.0)) * step(fract(hp.y * 1.6 + 0.3), 0.7) * step(-1.0, hp.y);
        rc = shopC * (0.32 + 0.4*mix(0.0, 1.0, item)*dot(goods, vec3(0.4))) * mix(vec3(1.0), goods*1.6, item*0.6);
        rc = mix(rc, shopC*0.85, shelf);
      } else if (tw.y < tw.x) {
        vec2 lc = hp.xz - vec2(0.0, D*0.45);
        if (sg.y > 0.0) rc = shopC * (0.35 + 1.4*exp(-dot(lc, lc)*0.5));
        else rc = shopC * (0.22 + 0.08*step(0.5, fract(floor(hp.x*1.5) * 0.5 + floor(hp.z*1.5) * 0.5))) * (1.1 - 0.4*dz);
      } else rc = shopC * (0.38 - 0.1*dz);
      rc *= 1.0 - 0.3*dz;
      shop = mix(shop, rc, 0.85);
      // Rahmen: Mittelsprosse, Oberlicht, Messingkanten
      float fr = step(abs(sfg - 0.5), 0.012) + step(abs(hyg - 2.75), 0.04) + step(abs(abs(sfg - 0.5) - 0.395), 0.012) + step(abs(hyg - 0.52), 0.04) + step(abs(hyg - 3.44), 0.04);
      shop = mix(shop, vec3(0.5, 0.36, 0.16)*(0.25 + 0.4*moon) + shopC*0.05*shopLit, clamp(fr, 0.0, 1.0));
      // Laibung des Schaufensters
      float sRev = 1.0 - step(abs(sfg - 0.5), 0.4) * step(0.45, hyg) * step(hyg, 3.5);
      float sTop = step(3.5, hyg), sBot = step(hyg, 0.45);
      shop = mix(shop, stone*(0.5 + 0.7*sBot - 0.25*sTop) + shopC*0.08*shopLit, sRev);
    }
    det = mix(wall*0.8, mix(glass + shop*0.18, shop + glass*0.5, shopLit), win);
    det = mix(det, vec3(0.05, 0.05, 0.06) + stone*0.6, step(abs(sf - 0.5), 0.4) * step(hy, 0.45) * step(0.0, hy) * step(1.0, um) * step(um, faceW - 1.0));
    det = mix(det, vec3(0.6, 0.42, 0.18)*(0.35 + 0.5*moon) + vec3(0.2, 0.12, 0.04), step(3.85, hy)*step(hy, 4.35));
  }

  float aa = smoothstep(0.08, 0.28, px) * (1.0 - ground);
  vec3 avgWin = mix(glass, vec3(1.0, 0.62, 0.3)*0.75, dens);
  vec3 avg = mix(wall, avgWin, wx*wy*(1.0 - pier*0.25));
  vec3 col = mix(det, avg, aa);

  float band = clamp(step(topDist, 0.9) + step(1.25, topDist)*step(topDist, 1.45), 0.0, 1.0) * step(-0.5, dens);
  vec3 gold = vec3(0.95, 0.7, 0.32);
  vec3 goldLit = gold*(0.1 + 0.28*moon + 0.55*flood*exp(-hy/60.0) + 0.12*exp(-vWorld.y/30.0));
  col = mix(col, goldLit, band);
  col += flood * vec3(1.0, 0.66, 0.3) * 0.2 * exp(-hy/38.0) * (1.0 - inWin*0.6);

  if (ln.y > 0.5) {
    // Flachdach: Teerpappe in Bahnen oder Kies, Oberlichter, Lüftungshauben, Pfützen; Brüstung am Rand
    vec2 rq = vWorld.xz; float rk = hash(vec2(seed, 31.0));
    float lane = step(0.97, fract((rk < 0.5 ? rq.x : rq.y) / 1.0));
    float grav = hash(floor(rq * 25.0)) * 0.25 + vnoise(rq * 0.4) * 0.3;
    vec3 roofC = mix(vec3(0.05, 0.05, 0.055), vTint * 0.5, 0.35) * (0.75 + grav) * (1.0 - 0.3 * lane * fineFade);
    vec2 sk = fract(rq / 7.0), ski = floor(rq / 7.0);
    float sky1 = step(0.6, hash(ski + seed)) * step(abs(sk.x - 0.5), 0.18) * step(abs(sk.y - 0.5), 0.12);
    roofC = mix(roofC, mix(vec3(0.03, 0.04, 0.06), vec3(0.9, 0.6, 0.3) * 0.5, step(0.5, hash(ski + 2.0))) * (0.6 + 0.4 * step(0.5, fract(sk.x * 12.0))), sky1);
    float pud = smoothstep(0.62, 0.7, vnoise(rq * 0.15 + seed));
    roofC = mix(roofC, uFogColor * 1.5 + vec3(0.02), pud * 0.6);
    float edgeR = min(min((vLocal.x + 0.5) * vScale.x + vEdge.x, (0.5 - vLocal.x) * vScale.x + vEdge.y), min((vLocal.z + 0.5) * vScale.z + vEdge.z, (0.5 - vLocal.z) * vScale.z + vEdge.w));
    roofC = mix(roofC, vTint * 0.35, step(edgeR, 0.6));
    col = roofC * (0.35 + 0.6 * moon) + vec3(0.012, 0.009, 0.022) + flood * vec3(0.08, 0.05, 0.02);
    // V25: Schnee auf den Dächern, an der Brüstung vom Wind freigeweht
    float sn = uSnowCover * smoothstep(0.25, 0.6, vnoise(rq * 0.3 + seed) * 0.6 + 0.4 - step(edgeR, 0.6) * 0.5);
    col = mix(col, vec3(0.13, 0.17, 0.22) + vec3(0.45, 0.5, 0.62) * moon + uTeal * 0.05 + flood * vec3(0.12, 0.08, 0.04), sn);
  }
  if (ln.y < -0.5) { float low = 1.0 - smoothstep(4.0, 12.0, vWorld.y); col = vTint * mix(0.03, 0.3, low) + vec3(0.14, 0.09, 0.04) * low * (0.5 + 0.5*flood); }

  // V25: nasse Wände dunkeln unten nach (Spritzwasser), Schnee legt sich auf Gesimse
  col *= 1.0 - 0.18 * uWet * smoothstep(5.0, 0.4, vWorld.y) * step(ln.y, 0.5);
  float fogF = vespFog(vFogDepth, vWorld.y, uCam.y, uFogDensity, 1.0);
  vec3 fogCol = mix(uFogColor*2.2, uFogColor, smoothstep(0.0, 140.0, vWorld.y));
  gl_FragColor = vec4(mix(col, fogCol, clamp(fogF, 0.0, 1.0)), 1.0);
}`;
export const facadeMat = new T.ShaderMaterial({ uniforms: U, vertexShader: facadeVS, fragmentShader: facadeFS });
facadeMat.extensions.derivatives = true;

/* Sammler für alle Bauteile, später in InstancedMeshes gegossen */
export const segs = [];    // Gebäudeabschnitte {x,z,w,d,y0,y1,tint,seed,style,dens,flood,rib}
export const towers = [];  // Hochhäuser für Brücken und Lichtsäulen {x,z,w,d,H}
export const shafts = [];  // Lichtsäulen {x,z,y,h,w,c}
export const neons = [];   // Leuchtleisten {x,y,z,sx,sy,sz,c}
export const spires = [];  // Turmspitzen {x,z,y0,h,b}
export const glowPts = []; // Lichtpunkte {p,c,s,ph,bl}
export const lamps = [];   // Laternen {x,z,h}
export const trees = [];
export const steamPts = []; // Dampfquellen in den Gassen {x,z}
export const roofs = [];    // Dachflächen {x,z,w,d,H,worker,dist}
export const curbs = [];    // Bordsteinkanten für parkende Autos {ax,az,bx,bz}

// V23: Schalter je Gebäudeabschnitt (Attribut aFlag): Dach/Unterseite weglassen, innere Kanten ohne Brüstung
export const FL = { noTop: 1, noBot: 2, xN: 4, xP: 8, zN: 16, zP: 32, all: 60 };
export function addSeg(s, collide = true) {
  segs.push(s);
  if (collide) addCollider(s.x - s.w / 2, s.y0, s.z - s.d / 2, s.x + s.w / 2, s.y1, s.z + s.d / 2);
}
// V23: exakt doppelte Quader (z. B. Eckpfeiler einer Arkade, die von zwei Seiten gesetzt werden) flackern gegeneinander: nur den ersten behalten
export function dedupeSegs() {
  const seen = new Set(), q = v => Math.round(v * 50);
  let k = 0;
  for (const s of segs) {
    if (s.dead) continue;
    const key = [s.x, s.z, s.w, s.d, s.y0, s.y1, s.ry || 0].map(q).join(',');
    if (seen.has(key)) continue;
    seen.add(key); segs[k++] = s;
  }
  segs.length = k;
  k = 0; for (const n of neons) if (!n.dead) neons[k++] = n; neons.length = k;
}
export function addNeon(x, y, z, sx, sy, sz, c, ry = 0) { neons.push({ x, y, z, sx, sy, sz, c, ry }); }
export function addGlow(x, y, z, c, s, ph = 0, bl = 0) { glowPts.push({ p: [x, y, z], c, s, ph, bl }); }

export const NEON = {
  gold: [1.25, 0.88, 0.42], amber: [1.3, 0.6, 0.22], teal: [0.35, 1.15, 1.05], ice: [0.62, 1.25, 1.3],
  rose: [1.25, 0.42, 0.68], violet: [0.78, 0.52, 1.3], pearl: [1.25, 1.12, 0.92],
};
export const neonPool = ['gold', 'gold', 'amber', 'pearl', 'teal', 'teal', 'ice', 'ice'];
export const RIBS = [[0.2, 0.75, 0.8], [0.2, 0.75, 0.8], [0.3, 0.9, 0.95], [0.85, 0.62, 0.28], [0.7, 0.8, 0.9]];
export const STONES = [
  [0.86, 0.8, 0.68], [0.8, 0.7, 0.52], [0.5, 0.54, 0.64], [0.72, 0.5, 0.4],
  [0.24, 0.23, 0.29], [0.4, 0.58, 0.54], [0.9, 0.86, 0.8], [0.58, 0.46, 0.62],
  [0.3, 0.46, 0.48], [0.84, 0.76, 0.6], [0.66, 0.44, 0.34],   // V23: Petrol, Champagner, Terrakotta
];
