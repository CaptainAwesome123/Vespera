'use strict';
/* =====================================================================
   V18 · SKELETT IM SHADER: weiche Gelenke (Schulter, Ellbogen, Handgelenk,
   Finger, Hüfte, Knie), Gang mit Fußzielen (die Füße bleiben am Boden
   stehen), Laufen, Arme mit Zielpunkten (Lenkrad, Besen, Schaufel, Kiste),
   Blick zur Kamera, Kopfformen und Statur je Person, Arbeitsbewegungen,
   Gesten, Tänze. Haare, Röcke, Fransen und Ketten schwingen nach
   ===================================================================== */
const DANCE = { fox: 2.0, charl: 2.6, sway: 2.0 };   // Schläge pro Sekunde
// Lenkräder und Steuerräder: Mitte (Körperraum), Radius, Neigung der Achse nach oben
const WHEEL = { car: [0, 1.19, 0.47, 0.18, 0.5], boat: [0, 1.08, 0.42, 0.17, 0.5], ship: [0, 1.15, 0.52, 0.36, 0.0] };
const HUM_VS_HEAD = `
attribute vec2 aLimb; attribute vec4 aGait; attribute float aOpt; attribute vec3 aSoft;
uniform float uTime; uniform vec4 uWind;
varying vec2 vFaceUV; varying float vFaceId; varying vec3 vClP; varying float vPnt; varying vec3 vSoft; varying float vBlink; varying vec2 vGaze; varying vec4 vLook;
vec2 thP, thA, thY, knF, anF, uaP, uaA, uaT, elF, wrF, fgC;
float spP, spR, spY, nkP, nkY, nkR, pvP, pvR, pvY, sitK, chew, jawO, danceK, flareK, bounceV, walkC, walkA, hAct, runK, carryK, toolOn, legIKon;
vec3 pvO, toolO, toolX, toolY, toolZ, camB;
float lookK, lookY, lookP, hHip, hHx, hFem;
float hh(float n) { return fract(sin(n * 12.9898 + 4.1) * 43758.5453); }
float cb(float c, float m, float w) { float d = c - m; d -= floor(d + 0.5); d /= w; return exp(-d * d); }
float s01(float x) { return clamp(x, 0.0, 1.0); }
float sst(float x) { x = s01(x); return x * x * x * (x * (6.0 * x - 15.0) + 10.0); }
vec3 rX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); }
vec3 rY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); }
vec3 rZ(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x * c - p.y * s, p.x * s + p.y * c, p.z); }
// Zwei Knochen: Hüfte H, Fußziel F -> Beugung nach vorn, seitliches Abspreizen, Kniewinkel
void legIK(vec3 H, vec3 F, float L1, float L2, out float p, out float a, out float k) {
  vec3 d = F - H; float D = clamp(length(d), 0.35 * (L1 + L2), 0.999 * (L1 + L2));
  k = 3.14159 - acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2.0 * L1 * L2), -1.0, 1.0));
  float al = acos(clamp((L1 * L1 + D * D - L2 * L2) / (2.0 * L1 * D), -1.0, 1.0));
  p = atan(d.z + 1e-5, -d.y) + al; a = atan(d.x + 1e-5, -d.y);   // +1e-5: atan(-0.0, x) liefert auf manchen GPUs -pi
}
// Fußziele im Körperraum -> Becken-Raum (das Becken dreht, kippt und verschiebt sich), dann Hüft- und Kniewinkel
vec3 toPelvis(vec3 F) { vec3 v = F - pvO - vec3(0.0, hHip, 0.0); v = rY(v, -pvY); v = rX(v, -pvP); v = rZ(v, -pvR); return v + vec3(0.0, hHip, 0.0); }
void legsTo(vec3 fR, vec3 fL) {
  float kY = hHip * 0.52, L1 = hHip - kY, L2 = kY - 0.09, p, a, k;
  legIK(vec3(-hHx, hHip, 0.0), toPelvis(fR), L1, L2, p, a, k); thP.x = p; thA.x = -a; knF.x = k;
  legIK(vec3(hHx, hHip, 0.0), toPelvis(fL), L1, L2, p, a, k); thP.y = p; thA.y = a; knF.y = k;
  legIKon = 1.0;
}
// Arm zum Zielpunkt H (Faustmitte, Körperraum vor der Drehung des Oberkörpers). tw: Drehung im Oberarm (Ellbogen nach außen).
// Rechnet mit den wirklichen Ruhelagen von Schulter, Ellbogen und Faust, damit die Hand genau am Griff liegt
float wrapA(float x) { return mod(x + 3.14159265, 6.2831853) - 3.14159265; }
void armIK(float sd, vec3 H, float tw, out float ap, out float aa, out float e, out float at) {
  float top = mix(1.34, 1.31, hFem);
  vec3 S = vec3(sd * mix(0.215, 0.178, hFem), top, 0.0), E = vec3(sd * mix(0.237, 0.2, hFem), top - mix(0.28, 0.27, hFem), -0.025), G = vec3(sd * (mix(0.223, 0.186, hFem) - 0.012), top - mix(0.56, 0.54, hFem) - 0.088, 0.058);
  vec3 u = E - S, f = G - E; float L1 = length(u), L2 = length(f);
  vec3 d = H - S; float D = clamp(length(d), 0.15, 0.995 * (L1 + L2)); d = normalize(d) * D;
  float uyz = length(u.yz), fyz = length(f.yz), tu = atan(u.z, u.y), tf = atan(f.z, f.y);
  float k = clamp((D * D - L1 * L1 - L2 * L2 - 2.0 * u.x * f.x) / (2.0 * uyz * fyz), -1.0, 1.0);
  float e1 = wrapA(-(tu - tf - acos(k))), e2 = wrapA(-(tu - tf + acos(k)));
  e = (e1 > -0.3 && e1 < 2.9) ? e1 : e2;
  if (e2 > -0.3 && e2 < 2.9 && abs(e2 - 1.0) < abs(e - 1.0)) e = e2;
  vec3 w = u + rX(f, -e);
  at = tw; w = rY(w, -sd * at);
  float R = length(w.xy), ph0 = atan(w.y, w.x), ac = acos(clamp(d.x / max(R, 1e-4), -1.0, 1.0));
  float b = wrapA(ac - ph0), b2 = wrapA(-ac - ph0);
  if (abs(b2) < abs(b)) b = b2;
  vec3 v = rZ(w, b);
  ap = -wrapA(atan(d.z, d.y) - atan(v.z, v.y)); aa = sd * b;
}
void armTo(float sd, vec3 H, float tw) {
  float ap, aa, e, at; armIK(sd, H, tw, ap, aa, e, at);
  if (sd < 0.0) { uaP.x = ap; uaA.x = aa; elF.x = e; uaT.x = at; } else { uaP.y = ap; uaA.y = aa; elF.y = e; uaT.y = at; }
}
// Werkzeug im Körperraum: Ursprung, Stiel entlang -Y; side zeigt grob in Richtung der lokalen Z-Achse
void toolFrame(vec3 o, vec3 up, vec3 side) { toolO = o; toolY = normalize(up); toolX = normalize(cross(toolY, side)); toolZ = cross(toolX, toolY); toolOn = 1.0; }
vec3 toolPt(vec3 l) { return toolO + toolX * l.x + toolY * l.y + toolZ * l.z; }
// Werkzeug so legen, dass sein Punkt la (lokal) bei W liegt
void toolAt(vec3 W, vec3 la, vec3 up, vec3 side) { toolFrame(vec3(0.0), up, side); toolO = W - (toolX * la.x + toolY * la.y + toolZ * la.z); }
// ---------- Gehen: Fußziele wie gemessen (Ferse auf, abrollen, Zehen ab), Becken senkt, verschiebt und dreht sich; der Kopf bleibt ruhig ----------
void footWalk(float c, float L, float ank, float x, out vec3 F, out float phi) {
  float b = 0.6, zA = 0.44 * b * L, zB = -0.56 * b * L;
  if (c < b) {
    float u = c / b, z = mix(zA, zB, u);
    phi = 0.24 * (1.0 - smoothstep(0.0, 0.16, u)) - 0.85 * pow(smoothstep(0.5, 1.0, u), 1.5);
    F = vec3(x, ank + 0.13 * sin(max(0.0, -phi)) + 0.02 * max(0.0, phi), z);
  } else {
    float s = (c - b) / (1.0 - b), z = mix(zB, zA, sst(s * 1.04));
    phi = mix(-0.85, 0.0, smoothstep(0.0, 0.45, s)) + 0.24 * smoothstep(0.6, 1.0, s);
    F = vec3(x * (1.0 - 0.08 * sin(3.14159 * s)), ank + 0.098 * (1.0 - s) * (1.0 - s) + 0.085 * sin(3.14159 * pow(s, 0.85)), z);
  }
}
// ---------- Laufen: kurze Standphase, Flugphase, Ferse hoch zum Gesäß, Knie nach vorn ----------
void footRun(float c, float L, float ank, float x, out vec3 F, out float phi) {
  float b = 0.32, zA = 0.36 * b * L, zB = -0.64 * b * L;
  if (c < b) {
    float u = c / b, z = mix(zA, zB, u);
    phi = 0.05 - 0.9 * smoothstep(0.45, 1.0, u);
    F = vec3(x, ank + 0.12 * sin(max(0.0, -phi)), z);
  } else {
    float s = (c - b) / (1.0 - b);
    // Weg des Knöchels: hinten hoch, unter dem Gesäß nach vorn, Unterschenkel schwingt aus, setzt auf
    vec3 P0 = vec3(x, ank + 0.11, zB), P1 = vec3(x, 0.52, -0.32), P2 = vec3(x, 0.5, 0.18), P3 = vec3(x, 0.3, zA + 0.12), P4 = vec3(x, ank, zA);
    float t = s * 4.0;
    if (t < 1.0) F = mix(P0, P1, sst(t)); else if (t < 2.0) F = mix(P1, P2, sst(t - 1.0)); else if (t < 3.0) F = mix(P2, P3, sst(t - 2.0)); else F = mix(P3, P4, sst(t - 3.0));
    phi = mix(-0.9, 0.1, smoothstep(0.0, 0.5, s)) + 0.1 * smoothstep(0.7, 1.0, s);
  }
}
void poseWalk(float ph, float amp, float fem, float gs) {
  float c = fract(ph / 6.2832), cL = fract(c + 0.5);
  runK = smoothstep(0.66, 0.74, amp); carryK = step(0.495, amp) * (1.0 - step(0.6, amp));
  float A = clamp(amp / 0.4, 0.75, 1.25) * (1.0 - runK) + runK, ank = mix(0.09, 0.1, fem), hx = hHx * 0.92;
  walkC = c; walkA = A;
  vec3 FR, FL; float pR, pL;
  if (runK < 0.5) {
    float L = mix(1.366, 1.164, fem);
    footWalk(c, L, ank, -hx, FR, pR); footWalk(cL, L, ank, hx, FL, pL);
    pvO.y = -0.02 * A * (0.5 + 0.5 * cos(12.566 * (c - 0.04))) + 0.003;
    pvO.x = -(0.016 - 0.004 * fem) * A * sin(6.2832 * (c - 0.06));
    pvR = -(0.035 + 0.025 * fem) * A * sin(6.2832 * c);
    pvY = (0.06 + 0.02 * fem) * A * cos(6.2832 * c);
    spR = 0.9 * pvR; spY = -1.55 * pvY; spP = 0.035 + 0.012 * A + 0.008 * cos(12.566 * c);
    float aS = (0.3 - 0.08 * fem) * A;
    uaP = vec2(-aS, aS) * cos(6.2832 * (c - 0.05)) + 0.04;
    elF = vec2(0.2) + 0.55 * max(uaP, vec2(0.0)) + 0.1 * vec2(sin(6.2832 * (c - 0.15)), -sin(6.2832 * (c - 0.15))) * A;
    uaA = vec2(0.07 - 0.02 * fem); uaT = vec2(0.14); thY = vec2(0.06 - 0.03 * fem);
    bounceV = sin(12.566 * c - 1.3) * A;
    fgC = vec2(0.35);
  } else {
    float L = mix(2.3, 2.0, fem);
    footRun(c, L, ank, -hx * 0.8, FR, pR); footRun(cL, L, ank, hx * 0.8, FL, pL);
    pvO.y = 0.015 - 0.055 * (cb(c, 0.16, 0.12) + cb(c, 0.66, 0.12)) - 0.02;
    pvO.x = -0.012 * sin(6.2832 * (c - 0.08));
    pvR = -0.04 * sin(6.2832 * c); pvY = 0.11 * cos(6.2832 * c); pvP = 0.1;
    spR = 0.8 * pvR; spY = -1.7 * pvY; spP = 0.2 + 0.03 * cos(12.566 * c);
    uaP = vec2(-0.75, 0.75) * cos(6.2832 * (c - 0.04)) + 0.2;
    elF = vec2(1.45) + 0.3 * vec2(cos(6.2832 * (c - 0.04)), -cos(6.2832 * (c - 0.04)));
    uaA = vec2(0.14); uaT = vec2(0.35); thY = vec2(0.03);
    bounceV = sin(12.566 * c - 0.6) * 1.8;
    fgC = vec2(0.9);
  }
  legsTo(FR, FL);
  anF = vec2(pR + knF.x - thP.x + pvP, pL + knF.y - thP.y + pvP);
  // Kopf ruhig halten: Drehung und Neigung des Beckens und Oberkörpers ausgleichen
  nkY = -(pvY + spY); nkR = pvR - spR; nkP = -0.55 * (spP + pvP) + 0.04;
  // Kiste vor dem Bauch tragen
  if (carryK > 0.5) {
    toolFrame(vec3(0.0, 1.02 + 0.012 * sin(12.566 * c), 0.33), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, 1.0));
    armTo(-1.0, toolPt(vec3(-0.25, -0.02, 0.0)), 0.6); armTo(1.0, toolPt(vec3(0.25, -0.02, 0.0)), 0.6);
    wrF = vec2(0.2); fgC = vec2(1.1); spP -= 0.06; nkP += 0.05;
  }
}
// ---------- Stehen: Gewicht wandert langsam von einem Bein aufs andere ----------
void poseStand(float fem, float gs) {
  float w = clamp(sin(uTime * 0.11 + aGait.x * 3.0) * 1.6, -1.0, 1.0);
  pvO.x = 0.024 * w; pvR = 0.04 * w; spR = 0.6 * pvR; nkR = 0.3 * (pvR - spR) + 0.04 * sin(uTime * 0.07 + aGait.x);
  knF = vec2(0.03) + 0.16 * vec2(max(0.0, w), max(0.0, -w));
  thP = vec2(0.02) + 0.06 * vec2(max(0.0, w), max(0.0, -w));
  thA = 0.03 * vec2(max(0.0, -w), max(0.0, w)); thY = vec2(0.12 - 0.05 * fem);
  anF = -0.05 * vec2(max(0.0, w), max(0.0, -w));
  elF = vec2(0.2); uaA = vec2(0.05); uaT = vec2(0.15); fgC = vec2(0.4);
  nkY = 0.45 * sin(uTime * 0.17 + aGait.x * 5.0) * sin(uTime * 0.05 + aGait.x);
  nkP = 0.04 * sin(uTime * 0.23 + aGait.x * 2.0);
}
// ---------- Kleine Handlungen im Stand, je Figur in eigener Folge ----------
void poseIdle(float wgt, float fem) {
  float gc = uTime / 15.0 + hh(aGait.x * 7.1) * 15.0, gi = floor(gc), gu = fract(gc);
  float env = wgt * smoothstep(0.04, 0.12, gu) * (1.0 - smoothstep(0.55, 0.66, gu));
  if (env < 0.001) return;
  float g = floor(hh(gi * 3.7 + aGait.x * 1.3) * 15.0);
  vec2 P = uaP, Aa = uaA, Tw = uaT, E = elF, F = fgC; float np = nkP, ny = nkY, nr = nkR, sp = spP, jw = jawO;
  float osc = sin(uTime * 9.0);
  if (g < 0.5) { P.y = 0.6; E.y = 1.95; Tw.y = 1.0; Aa.y = 0.12; np = 0.38; ny = 0.28; }                         // auf die Armbanduhr schauen
  else if (g < 1.5) { P.x = 0.95; E.x = 2.35; Tw.x = 0.7; Aa.x = 0.05 + 0.03 * osc; np = -0.12; F.x = 1.0; }     // Kragen und Krawatte richten
  else if (g < 2.5) { P = vec2(-0.12); Aa = vec2(0.6); E = vec2(1.65); Tw = vec2(1.5); sp = -0.02; }                 // Hände in die Hüften
  else if (g < 3.5) { P = vec2(0.62); Aa = vec2(0.14); Tw = vec2(1.45); E = vec2(1.95, 1.85); sp = -0.04; np = -0.04; F = vec2(0.8); }  // Arme verschränkt
  else if (g < 4.5) { P.x = 1.65; Aa.x = 0.55; E.x = 2.5 + 0.08 * osc; Tw.x = 0.6; np = 0.18; nr = 0.14; F.x = 0.7; }       // am Hinterkopf kratzen
  else if (g < 5.5) { P = vec2(-0.3); Aa = vec2(0.1); Tw = vec2(1.5); E = vec2(1.45); sp = -0.05; }                // Hände auf dem Rücken
  else if (g < 6.5) { np = -0.55; sp = -0.07; ny = 0.35 * sin(uTime * 0.3 + aGait.x); P.x = 1.25; E.x = 2.25; Tw.x = 0.95; }   // hinaufschauen zu den Türmen
  else if (g < 7.5) { nr = 0.32 * sin(uTime * 1.3); np = 0.12 + 0.1 * cos(uTime * 1.3); }                         // Nacken dehnen
  else if (g < 8.5) { P = vec2(0.55); E = vec2(1.6); Tw = vec2(0.82 + 0.08 * osc); Aa = vec2(0.05); np = 0.12; F = vec2(0.6); }    // Hände reiben
  else if (g < 9.5) { P.x = 2.25; Aa.x = 0.3; E.x = 2.0; Tw.x = 0.4; np = 0.1; }                                    // Hut oder Haar richten
  else if (g < 10.5) { if (fem > 0.5) { P = vec2(0.32); E = vec2(1.4); Tw = vec2(0.95); } else { P = vec2(-0.06); Aa = vec2(0.13); E = vec2(0.4); Tw = vec2(-0.3); F = vec2(1.2); } }   // Hände gefaltet / in den Taschen
  else if (g < 11.5) { sp = 0.1; np = 0.2; P = vec2(0.25); E = vec2(0.3); }                                          // sich vorbeugen und umsehen
  else if (g < 12.5) { float y = smoothstep(0.1, 0.25, gu) * (1.0 - smoothstep(0.4, 0.55, gu)); P = mix(P, vec2(2.9), y); Aa = mix(Aa, vec2(0.35), y); E = mix(E, vec2(0.5), y); sp = -0.12 * y; np = -0.35 * y; jw = 1.6 * y; F = vec2(1.0 - 0.8 * y); }   // gähnen und strecken
  else if (g < 13.5) { if (fem > 0.5) { P.x = 1.05; E.x = 2.45; Tw.x = 0.55; Aa.x = 0.18; np = 0.05; nr = -0.1; P.y = 0.5; E.y = 1.7; Tw.y = 0.9; F = vec2(0.9); }   // Ohrring zurechtrücken, Handtasche halten
                       else { P.y = 0.42; E.y = 1.75; Tw.y = 1.05; Aa.y = 0.1; np = 0.42; ny = 0.18; P.x = 0.3; E.x = 1.6; Tw.x = 0.9; F = vec2(1.0); } }  // Taschenuhr aus der Weste ziehen
  else { P.x = 0.75; E.x = 2.1; Tw.x = 0.8; Aa.x = 0.12; np = 0.08; F.x = 1.2; jw = 0.15; }                           // nachdenklich am Kinn
  uaP = mix(uaP, P, env); uaA = mix(uaA, Aa, env); uaT = mix(uaT, Tw, env); elF = mix(elF, E, env); fgC = mix(fgC, F, env);
  nkP = mix(nkP, np, env); nkY = mix(nkY, ny, env); nkR = mix(nkR, nr, env); spP = mix(spP, sp, env); jawO = mix(jawO, jw, env);
}
// ---------- Reden mit den Händen ----------
void poseTalk(float talk) {
  float tc = uTime / 3.3 + aGait.x, ti = floor(tc), tu = fract(tc), g = floor(hh(ti + aGait.x * 3.0) * 5.0);
  float env = talk * smoothstep(0.0, 0.18, tu) * (1.0 - smoothstep(0.8, 1.0, tu)), b = 0.5 + 0.5 * sin(uTime * 5.5 + aGait.x * 4.0);
  vec2 P = uaP, E = elF, Aa = uaA, Tw = uaT, F = fgC; float nr = nkR, np = nkP;
  if (g < 0.5) { P.y = 0.5 + 0.12 * b; E.y = 1.25; Tw.y = -0.2; F.y = 0.1; }
  else if (g < 1.5) { P = vec2(0.42 + 0.1 * b); E = vec2(1.3); Aa = vec2(0.22); Tw = vec2(-0.35); F = vec2(0.15); }
  else if (g < 2.5) { P.x = 0.62 + 0.1 * b; E.x = 1.55 - 0.15 * b; Tw.x = 0.3; np += 0.05 * b; F.x = 1.0; }
  else if (g < 3.5) { P.x = 0.55; E.x = 2.15; Tw.x = 1.0; P.y = 0.3 * b; E.y = 0.9; }
  else { Aa = vec2(0.28 + 0.08 * b); E = vec2(1.45); Tw = vec2(-0.7); P = vec2(0.2); nr = 0.14; F = vec2(0.1); }
  uaP = mix(uaP, P, env); elF = mix(elF, E, env); uaA = mix(uaA, Aa, env); uaT = mix(uaT, Tw, env); nkR = mix(nkR, nr, env); nkP = mix(nkP, np, env); fgC = mix(fgC, F, env);
  jawO = talk * 0.5 * (0.5 + 0.5 * sin(uTime * 11.0 + aGait.x * 9.0)) * step(0.5, b + 0.3);
}
// ---------- Foxtrott ----------
vec2 foxBody(float u) {
  float s0 = s01(u / 2.0), s1 = s01((u - 2.0) / 2.0), s2 = s01(u - 4.0), s3 = s01(u - 5.0);
  return vec2(0.15 * smoothstep(0.1, 1.0, s2) + 0.15 * smoothstep(0.1, 1.0, s3), 0.5 * smoothstep(0.1, 1.0, s0) + 0.5 * smoothstep(0.1, 1.0, s1));
}
void poseFox(float follow, float fem) {
  float b = uTime * ${DANCE.fox.toFixed(2)} + floor(aGait.x * 3.0) * 6.0, u = mod(b, 6.0);
  float s0 = s01(u / 2.0), s1 = s01((u - 2.0) / 2.0), s2 = s01(u - 4.0), s3 = s01(u - 5.0);
  float f0 = smoothstep(0.0, 0.7, s0), f1 = smoothstep(0.0, 0.7, s1), f2 = smoothstep(0.0, 0.7, s2), f3 = smoothstep(0.0, 0.7, s3);
  vec2 L = vec2(0.09, 0.0) + vec2(0.0, 0.5) * f0 + vec2(0.3, 0.5) * f2, Rf = vec2(-0.09, 0.0) + vec2(0.0, 1.0) * f1 + vec2(0.3, 0.0) * f3;
  float lL = sin(3.14159 * f0) + sin(3.14159 * f2), lR = sin(3.14159 * f1) + sin(3.14159 * f3);
  vec2 B = foxBody(u); L -= B; Rf -= B;
  float quick = step(4.0, u), slow = 1.0 - quick;
  pvO.y = slow * (-0.028 + 0.02 * sin(3.14159 * fract(u / 2.0))) + quick * 0.012;
  float ank = mix(0.09, 0.1, fem);
  vec3 FR, FL;
  if (follow > 0.5) { FR = vec3(-L.x, ank + 0.035 * lL, -L.y); FL = vec3(-Rf.x, ank + 0.035 * lR, -Rf.y); }
  else { FR = vec3(Rf.x, ank + 0.035 * lR, Rf.y); FL = vec3(L.x, ank + 0.035 * lL, L.y); }
  pvY = 0.07 * sin(3.14159 * u / 2.0) * slow; spY = -pvY * 1.3;
  spR = 0.06 * sin(3.14159 * u / 3.0 + 1.0);
  legsTo(FR, FL);
  anF = vec2(-0.3 * quick) + 0.25 * vec2(follow > 0.5 ? -lL : lR, follow > 0.5 ? -lR : lL) + vec2(knF.x - thP.x, knF.y - thP.y);
  thY = vec2(0.05);
  if (follow > 0.5) { uaP = vec2(0.11, 0.81); uaA = vec2(0.92, 0.56); uaT = vec2(-0.98, 0.49); elF = vec2(1.53, 1.68); spP = -0.08; nkY = 0.55; nkP = -0.12; nkR = -0.08; fgC = vec2(0.5, 0.3); }
  else { uaP = vec2(0.94, 0.18); uaA = vec2(0.42, 0.74); uaT = vec2(1.05, -0.63); elF = vec2(1.04, 1.83); spP = -0.04; nkY = 0.18; nkP = -0.05; fgC = vec2(0.3, 0.8); }
  danceK = 1.0; flareK = 0.35 + 0.65 * quick; bounceV = quick * sin(6.2832 * b);
}
// ---------- Charleston ----------
void poseCharleston(float fem, float gs) {
  float b = uTime * ${DANCE.charl.toFixed(2)} + floor(aGait.x * 4.0), bt = mod(b, 4.0), ph = floor(b / 8.0);
  float v = floor(hh(ph * 1.7 + aGait.x * 9.0) * 4.0);
  float hx = hHx, ank = mix(0.09, 0.1, fem);
  float fwd = bt < 2.0 ? sin(3.14159 * bt / 2.0) : 0.0, kick = bt >= 2.0 ? sin(3.14159 * (bt - 2.0) / 2.0) : 0.0;
  float sw = cos(6.2832 * b);
  pvO.y = -0.03 - 0.025 * (0.5 + 0.5 * sw);
  vec3 FR = vec3(-hx - 0.02, ank + 0.06 * fwd * fwd, 0.3 * fwd), FL = vec3(hx + 0.02, ank + 0.24 * kick, -0.26 * kick);
  if (v > 2.5) { FR = vec3(-hx - 0.06 - 0.05 * sw, ank, 0.0); FL = vec3(hx + 0.06 + 0.05 * sw, ank, 0.0); pvO.y = -0.12 - 0.03 * sw; }
  legsTo(FR, FL);
  thY = vec2(0.42 * sw);
  anF = vec2(-0.35 * fwd - 0.15, -0.6 * kick - 0.15);
  uaP = vec2(0.85 * cos(3.14159 * b), -0.85 * cos(3.14159 * b)) + 0.2; uaA = vec2(0.42); elF = vec2(0.55) + 0.35 * abs(vec2(sin(3.14159 * b), cos(3.14159 * b))); uaT = vec2(-0.2); fgC = vec2(0.1);
  spP = 0.16 * kick - 0.1 * fwd; spY = 0.12 * sin(3.14159 * b); nkP = 0.08 * sw; nkY = -0.5 * spY;
  if (v > 0.5 && v < 1.5) { uaP = vec2(2.5 + 0.15 * sin(uTime * 14.0)); uaA = vec2(0.65); elF = vec2(0.35); uaT = vec2(-0.6); fgC = vec2(0.05 + 0.3 * abs(sin(uTime * 14.0))); }
  else if (v > 1.5 && v < 2.5) { spR = 0.14 * sin(uTime * 18.0); uaA = vec2(0.85); uaP = vec2(0.35); elF = vec2(0.6); }
  else if (v > 2.5) { thA = vec2(0.32 * (0.5 + 0.5 * sw)); uaP = vec2(0.55); elF = vec2(0.25); uaA = vec2(0.12 + 0.25 * (0.5 - 0.5 * sw)); spP = 0.42; nkP = -0.35; }
  danceK = 1.0; flareK = 0.8; bounceV = sw;
}
// ---------- Wippen zur Musik ----------
void poseSway(float fem) {
  float b = uTime * ${DANCE.sway.toFixed(2)} + aGait.x * 0.1, sw = cos(6.2832 * b), v = floor(hh(floor(uTime / 12.0) + aGait.x * 5.0) * 3.0);
  pvO.y = -0.012 * (0.5 + 0.5 * sw); knF += 0.08 * (0.5 + 0.5 * sw); nkP = 0.07 * sw; spY = 0.06 * sin(3.14159 * b); pvO.x += 0.02 * sin(3.14159 * b);
  if (v < 0.5) { uaP.x = 0.45; elF.x = 1.6 + 0.12 * sw; uaT.x = 0.4; fgC.x = 0.2; }
  else if (v < 1.5) { float c = abs(sin(3.14159 * b * 2.0)); uaP = vec2(0.8); elF = vec2(1.25); uaT = vec2(1.2 - 0.25 * c); fgC = vec2(0.1); }
  danceK = 0.4; bounceV = sw;
}
// ---------- Sitzen: Oberschenkel waagrecht, Unterschenkel hängen ----------
void poseSit() { sitK = 1.0; thP = vec2(1.5); knF = vec2(1.5); thA = vec2(0.04); thY = vec2(0.06); anF = vec2(0.1); pvO = vec3(0.0); pvR = 0.0; spR = 0.0; }
// ---------- Am Steuer: Hände am Kranz, das Rad dreht mit, der Kopf schaut in die Kurve ----------
void poseWheel(vec4 W, float tilt, float ang, float tt, float seated, float tool) {
  // W: Mitte xyz (Körperraum), Radius; Achse zeigt nach vorn und ist um tilt nach oben geneigt
  vec3 ax = normalize(vec3(0.0, sin(tilt), cos(tilt))), up = normalize(vec3(0.0, cos(tilt), -sin(tilt)));
  toolO = W.xyz; toolZ = ax; toolY = rY(up, 0.0); toolX = cross(toolY, toolZ);
  // Drehung um die Achse
  vec3 X2 = toolX * cos(ang) + toolY * sin(ang), Y2 = -toolX * sin(ang) + toolY * cos(ang); toolX = X2; toolY = Y2;
  toolOn = tool;
  float a0 = 0.95, r = W.w;
  // Hand über Hand: bei großem Einschlag greift eine Hand um
  vec3 hR = toolPt(vec3(-r * sin(a0), r * cos(a0), -0.015)), hL = toolPt(vec3(r * sin(a0), r * cos(a0), -0.015));
  armTo(-1.0, hR, 0.45); armTo(1.0, hL, 0.45);
  wrF = vec2(-0.3); fgC = vec2(1.25);
  nkY = clamp(ang * 0.55, -0.7, 0.7) + 0.6 * smoothstep(0.75, 0.95, sin(tt * 0.27)) * sign(sin(tt * 0.13)) ; nkP = 0.05;
  spR = -ang * 0.04; spP = seated > 0.5 ? -0.08 : 0.02;
}
void humanPose(float fem, float gs, float elder) {
  thP = thA = thY = knF = anF = uaP = uaA = uaT = elF = wrF = fgC = vec2(0.0);
  spP = spR = spY = nkP = nkY = nkR = pvP = pvR = pvY = sitK = chew = jawO = danceK = flareK = bounceV = walkC = walkA = runK = carryK = toolOn = legIKon = 0.0;
  pvO = vec3(0.0); toolO = toolX = toolY = toolZ = vec3(0.0);
  float walking = step(0.01, aGait.z), amp = aGait.z;
  float act = (1.0 - walking) * floor(aGait.y + 0.001), actI = fract(aGait.y); hAct = act;
  if (act > 98.5) return;
  float tt = uTime * (0.9 + 0.2 * fract(aGait.x * 3.7)) + aGait.x * 7.0;
  if (walking > 0.5) { poseWalk(uTime * aGait.y + aGait.x, amp, fem, gs); }
  else if (act > 19.5 && act < 23.5) {
    if (act < 21.5) poseFox(act - 20.0, fem);
    else if (act < 22.5) poseCharleston(fem, gs);
    else { poseStand(fem, gs); poseSway(fem); }
  } else if (act > 23.5 && act < 40.5) {
    // ---------- Arbeit und Steuer ----------
    poseStand(fem, gs); nkY *= 0.3;
    if (act < 24.5) {
      // Fegen: Besen schräg vor dem Körper, Kopf schwingt über den Boden
      float s = sin(tt * 1.9), s2 = cos(tt * 1.9);
      vec3 H = vec3(-0.06 + 0.3 * s, 0.02 + 0.03 * max(0.0, s2), 0.6 + 0.05 * s2), Tp = vec3(0.1, 1.12, 0.16 + 0.03 * s);
      toolAt(H, vec3(0.0, -1.31, 0.0), Tp - H, vec3(1.0, 0.0, 0.0));
      armTo(1.0, toolPt(vec3(0.0, -0.02, 0.0)), 0.3); armTo(-1.0, toolPt(vec3(0.0, -0.5, 0.0)), 0.5);
      spP = 0.16; spY = 0.12 * s; nkP = 0.32; nkY = 0.15 * s; knF += 0.12; fgC = vec2(1.2);
    } else if (act < 25.5) {
      // Hämmern: links festhalten, rechts ausholen und schlagen
      float cy = fract(tt * 1.1), up = smoothstep(0.05, 0.55, cy) * (1.0 - smoothstep(0.78, 0.86, cy));
      spP = 0.3; nkP = 0.28; knF += 0.08;
      uaP.y = 0.75; elF.y = 1.05; uaT.y = 0.6; uaA.y = 0.05; fgC.y = 1.0;
      uaP.x = mix(0.55, 1.45, up); elF.x = mix(0.7, 2.0, up); uaA.x = 0.18 + 0.3 * up; uaT.x = 0.35 - 0.5 * up; wrF.x = mix(0.2, 0.7, up); fgC.x = 1.3;
      spY = -0.06 * up; jawO = 0.15 * (1.0 - up);
    } else if (act < 26.5) {
      // Schaufeln: einstechen, heben, mit Schwung nach links werfen
      float cy = fract(tt / 3.2), dig = smoothstep(0.0, 0.25, cy) * (1.0 - smoothstep(0.3, 0.45, cy)), lift = smoothstep(0.3, 0.5, cy) * (1.0 - smoothstep(0.75, 0.95, cy)), thr = smoothstep(0.55, 0.72, cy) * (1.0 - smoothstep(0.78, 0.98, cy));
      vec3 B = mix(vec3(0.22, 0.12, 0.85), vec3(0.18, 0.08, 0.95), dig);
      B = mix(B, vec3(0.05, 0.75, 0.62), lift); B = mix(B, vec3(-0.55, 1.05, 0.5), thr);
      vec3 Tp = mix(vec3(-0.12, 0.88, 0.12), vec3(-0.08, 1.05, 0.1), lift); Tp = mix(Tp, vec3(0.2, 1.05, 0.12), thr);
      toolAt(B, vec3(0.0, -1.1, 0.0), Tp - B, mix(vec3(0.0, 1.0, 0.3), vec3(-0.6, 0.6, 0.2), thr));
      armTo(1.0, toolPt(vec3(0.0, 0.0, 0.0)), 0.4); armTo(-1.0, toolPt(vec3(0.0, -0.42, 0.0)), 0.6);
      spP = 0.42 * (1.0 - lift * 0.6) + 0.1 * dig; spY = 0.15 - 0.6 * thr; knF += 0.35 * (1.0 - lift * 0.5); pvO.y = -0.06 * (1.0 - lift); nkP = 0.25; fgC = vec2(1.25);
    } else if (act < 27.5) {
      // Kisten stapeln: bücken, heben, tragen, absetzen, zurück
      float cy = fract(tt / 6.0), pick = smoothstep(0.0, 0.12, cy) * (1.0 - smoothstep(0.18, 0.3, cy)), hold = smoothstep(0.16, 0.22, cy) * (1.0 - smoothstep(0.62, 0.66, cy)), put = smoothstep(0.45, 0.6, cy) * (1.0 - smoothstep(0.7, 0.85, cy));
      vec3 C = mix(vec3(-0.25, 0.2, 0.55), vec3(0.0, 1.0, 0.36), smoothstep(0.18, 0.35, cy));
      C = mix(C, vec3(0.42, 0.95, 0.42), smoothstep(0.42, 0.6, cy));
      float bend = max(pick, 1.0 - smoothstep(0.0, 0.3, cy)) * (1.0 - smoothstep(0.3, 0.4, cy)) + smoothstep(0.8, 0.95, cy) * 0.0;
      toolFrame(C, vec3(0.0, 1.0, 0.0), vec3(sin(0.6 * put), 0.0, cos(0.6 * put)));
      toolOn = hold;
      vec3 gR = toolPt(vec3(-0.25, -0.03, 0.0)), gL = toolPt(vec3(0.25, -0.03, 0.0));
      vec3 rR = vec3(-0.25, 0.8, 0.3), rL = vec3(0.25, 0.8, 0.3);
      float reach = smoothstep(0.0, 0.12, cy) * (1.0 - smoothstep(0.66, 0.75, cy));
      armTo(-1.0, mix(rR, gR, reach), 0.55); armTo(1.0, mix(rL, gL, reach), 0.55);
      spP = 0.75 * bend + 0.12 * put; knF += 0.6 * bend; pvO.y = -0.18 * bend; spY = 0.45 * put - 0.3 * pick; nkP = 0.2 + 0.2 * bend; fgC = vec2(1.0);
    } else if (act < 28.5) {
      // Notizen: Block in der Linken, Bleistift in der Rechten; ab und zu aufschauen
      float up = smoothstep(0.6, 0.75, fract(tt / 7.0)) * (1.0 - smoothstep(0.85, 0.98, fract(tt / 7.0))), wr = sin(tt * 9.0) * (1.0 - up);
      armTo(1.0, vec3(0.04, 1.12, 0.33), 0.9); armTo(-1.0, vec3(-0.02 + 0.03 * wr, 1.16 + 0.01 * sin(tt * 13.0), 0.35), 0.7);
      wrF = vec2(0.2 - 0.4 * up, 0.5); fgC = vec2(1.1, 0.9);
      nkP = 0.42 * (1.0 - up) - 0.05 * up; nkY = 0.2 * up * sin(tt * 0.3); spP = 0.05;
    } else if (act < 29.5) {
      // Fenster putzen: kreisend, mal hoch, mal tief
      float hgt = 1.25 + 0.3 * sin(tt * 0.31);
      vec3 Hd = vec3(-0.05 + 0.16 * cos(tt * 3.4), hgt + 0.13 * sin(tt * 3.4), 0.5);
      armTo(-1.0, Hd, 0.2); uaP.y = -0.12; uaA.y = 0.55; elF.y = 1.65; uaT.y = 1.5;
      nkP = 0.2 - 0.35 * (hgt - 1.25); nkY = -0.1 + 0.15 * cos(tt * 3.4); spY = 0.06 * cos(tt * 3.4); fgC = vec2(0.7, 0.3);
    } else if (act < 30.5) {
      // Schild malen: Pinselstriche auf und ab, die Linke hält den Farbtopf
      float st = sin(tt * 2.6);
      armTo(-1.0, vec3(-0.05 + 0.03 * sin(tt * 0.5), 1.55 + 0.22 * st, 0.48), 0.2);
      armTo(1.0, vec3(0.2, 0.98, 0.26), 0.4); wrF.x = 0.3 * st; fgC = vec2(1.2, 1.3);
      nkP = -0.25 - 0.2 * st; spP = -0.04;
    } else if (act < 31.5) {
      // Zeitung lesen: aufgeschlagen in beiden Händen, ab und zu umblättern
      float turn = smoothstep(0.86, 0.92, fract(tt / 14.0)) * (1.0 - smoothstep(0.94, 0.99, fract(tt / 14.0)));
      toolFrame(vec3(0.0, 1.24, 0.38), vec3(0.0, 1.0, -0.45), vec3(0.0, -0.3, 1.0));
      armTo(-1.0, toolPt(vec3(-0.27, -0.05, 0.0)), 0.8); armTo(1.0, toolPt(vec3(0.27 - 0.3 * turn, -0.05 + 0.1 * turn, 0.02)), 0.8);
      nkP = 0.32; nkY = 0.12 * sin(tt * 0.35); wrF = vec2(0.3); fgC = vec2(0.9);
      if (actI > 0.5) { poseSit(); spP += 0.05; }
    } else if (act < 32.5) {
      // Auto: sitzt, Füße an den Pedalen, Hände am Lenkrad
      poseSit(); thP = vec2(1.15); knF = vec2(0.9); anF = vec2(-0.1);
      poseWheel(vec4(${WHEEL.car.slice(0, 4).join(', ')}), ${WHEEL.car[4].toFixed(3)}, (actI * 2.0 - 1.0) * 1.7, tt, 1.0, 1.0);
      spP = -0.12;
    } else if (act < 33.5) {
      poseWheel(vec4(${WHEEL.ship.slice(0, 4).join(', ')}), ${WHEEL.ship[4].toFixed(3)}, (actI * 2.0 - 1.0) * 1.2, tt, 0.0, 0.0);
    } else if (act < 34.5) {
      poseSit(); thP = vec2(1.3); knF = vec2(1.2);
      poseWheel(vec4(${WHEEL.boat.slice(0, 4).join(', ')}), ${WHEEL.boat[4].toFixed(3)}, (actI * 2.0 - 1.0) * 1.5, tt, 1.0, 0.0);
    } else if (act < 35.5) {
      // Verkehrspolizist: ein Arm hält an, der andere winkt durch; alle paar Sekunden Seitenwechsel
      float ph2 = fract(tt / 9.0), sdw = step(0.5, ph2), wv = sin(tt * 4.5);
      float a = smoothstep(0.02, 0.1, fract(ph2 * 2.0)) * (1.0 - smoothstep(0.9, 0.98, fract(ph2 * 2.0)));
      if (sdw < 0.5) { uaA.x = 1.45 * a; uaP.x = 0.1; elF.x = 0.05; uaT.x = -1.2 * a; wrF.x = -1.0 * a; uaP.y = 1.2 * a; elF.y = (0.9 + 0.6 * wv) * a; uaA.y = 0.2; uaT.y = 0.6; nkY = -0.8 * a; }
      else { uaA.y = 1.45 * a; uaP.y = 0.1; elF.y = 0.05; uaT.y = -1.2 * a; wrF.y = -1.0 * a; uaP.x = 1.2 * a; elF.x = (0.9 + 0.6 * wv) * a; uaA.x = 0.2; uaT.x = 0.6; nkY = 0.8 * a; }
      fgC = vec2(0.05);
    } else if (act < 36.5) {
      // Portier: Hände auf dem Rücken, verbeugt sich und weist mit der Rechten zur Tür
      float cy = fract(tt / 11.0), bow = smoothstep(0.0, 0.08, cy) * (1.0 - smoothstep(0.18, 0.28, cy)), sh = smoothstep(0.2, 0.3, cy) * (1.0 - smoothstep(0.5, 0.6, cy));
      uaP = vec2(-0.3); uaA = vec2(0.1); uaT = vec2(1.5); elF = vec2(1.45);
      uaP.x = mix(uaP.x, 0.75, sh); uaA.x = mix(uaA.x, 0.9, sh); elF.x = mix(elF.x, 0.35, sh); uaT.x = mix(uaT.x, -0.6, sh); fgC.x = 0.1 * sh;
      spP = 0.35 * bow - 0.03; nkP = 0.2 * bow; nkY = -0.5 * sh;
    } else if (act < 37.5) {
      // Blumen anbieten: Korb am linken Arm, rechte Hand streckt einen Strauß hin
      float cy = fract(tt / 6.0), off = smoothstep(0.1, 0.25, cy) * (1.0 - smoothstep(0.6, 0.75, cy));
      uaP.y = 0.35; elF.y = 1.55; uaT.y = 0.9; fgC.y = 1.2;
      armTo(-1.0, mix(vec3(-0.18, 1.05, 0.3), vec3(-0.1, 1.25, 0.58), off), 0.3); fgC.x = 1.1;
      nkP = 0.05; spP = 0.05 * off;
    } else {
      // Schuhputzer, Schaufenster, Pause: an die Wand gelehnt, rauchend
      float cy = fract(tt / 8.0), k = smoothstep(0.0, 0.1, cy) * (1.0 - smoothstep(0.26, 0.38, cy));
      uaP.x = 0.3 + 0.6 * k; elF.x = 1.15 + 1.2 * k; uaA.x = 0.12; uaT.x = 0.5; fgC.x = 0.5; uaP.y = -0.2; uaT.y = 1.5; elF.y = 1.3;
      spP = -0.08; nkP = -0.08 * k; pvO.z = -0.05;
    }
  } else {
    poseStand(fem, gs);
    float talk = act < 0.5 ? actI : (act > 6.5 && act < 7.5 ? step(0.5, actI) * 0.8 : 0.0);
    if (act < 1.5) {
      poseIdle(act < 0.5 ? 1.0 - smoothstep(0.02, 0.25, actI) : 0.55, fem);
      if (act > 0.5) nkP += 0.17 * pow(max(0.0, sin(tt * 1.6)), 3.0);
      poseTalk(talk);
      elF += 0.04;
    } else {
      // die Handlungen von früher (u: Oberarm, f: Ellbogen, a: Abspreizen, hp: Kopf)
      float uR = 0.04, uL = 0.04, fR = -0.2, fL = -0.2, aR = 0.0, aL = 0.0, hp = 0.0;
      if (act < 2.5) { float lg = max(0.0, sin(tt * 0.9)); hp = -0.08 - 0.16 * lg - 0.05 * abs(sin(tt * 12.0)) * lg; uR = -0.25; fR = -1.5; fL = -0.35; jawO = 0.6 * lg; spP = -0.05 * lg; }
      else if (act < 3.5) { float w = sin(tt * 7.5), on = actI > 0.5 ? 1.0 : smoothstep(0.0, 0.15, fract(tt / 6.0)) * (1.0 - smoothstep(0.45, 0.6, fract(tt / 6.0))); aR = (2.55 + 0.25 * w) * on; fR = -0.25 - 0.35 * on - 0.2 * w * on; fgC.x = 0.05; }
      else if (act < 4.5) { uR = -0.72; fR = -0.75 + 0.16 * sin(tt * 11.0); hp = 0.06; spP = 0.05; fgC.x = 1.0; }
      else if (act < 5.5) { float cy = fract(tt / 7.0), k = smoothstep(0.0, 0.12, cy) * (1.0 - smoothstep(0.32, 0.46, cy)); uR = -0.3 - 0.5 * k; fR = -1.0 - 1.3 * k; fL = -0.3; hp = -0.15 * k; fgC.x = 0.9; }
      else if (act < 6.5) { float cy = fract(tt / 9.0), k = smoothstep(0.15, 0.3, cy) * (1.0 - smoothstep(0.7, 0.85, cy)); uL = -1.45 * k; fL = -0.08; aL = 0.3 * k; nkY = 0.3 * k; fgC.y = 0.9; }
      else if (act < 7.5) { sitK = 1.0; uR = -0.42; uL = -0.42; fR = -0.95; fL = -0.95; }
      else if (act < 8.5) { uR = -1.0; uL = -1.0; fR = -0.8; fL = -0.8; aR = -0.1; aL = -0.1; hp = 0.15; spP = 0.12; }
      else if (act < 9.5) { float c = abs(sin(tt * 8.5)); uR = -0.8; uL = -0.8; fR = -1.2; fL = -1.2; aR = -0.32 + 0.16 * c; aL = aR; fgC = vec2(0.0); }
      else if (act < 10.5) { float cy = fract(tt / 5.5), k = smoothstep(0.05, 0.2, cy) * (1.0 - smoothstep(0.32, 0.48, cy)); sitK = 1.0; uR = -0.62 - 0.3 * k; fR = -0.85 - 1.25 * k; uL = -0.6; fL = -0.9 + 0.08 * sin(tt * 5.0) * (1.0 - k); hp = 0.12 - 0.22 * k; spP = 0.08 * k; fgC = vec2(1.0); }
      else if (act < 11.5) { float cy = fract(tt / 8.0), k = smoothstep(0.0, 0.14, cy) * (1.0 - smoothstep(0.3, 0.44, cy)); sitK = 1.0; uR = -0.5 - 0.42 * k; fR = -0.9 - 1.3 * k; uL = -0.45; fL = -0.95; hp = -0.12 * k; fgC.x = 0.9; }
      else if (act < 12.5) { uR = -0.38; fR = -1.45; aR = 0.12; fL = -0.25; fgC.x = 0.2; }
      else if (act < 13.5) { float sh = sin(tt * 15.0); uR = -0.95 - 0.18 * sh; uL = -0.95 - 0.18 * sh; fR = -1.35 + 0.15 * sh; fL = -1.35 + 0.15 * sh; aR = -0.25; aL = -0.25; spR = 0.03 * sh; fgC = vec2(1.1); }
      else if (act < 14.5) { float pr = sin(tt * 9.0), pl = sin(tt * 7.3 + 1.0); sitK = 1.0; uR = -0.78; uL = -0.78; fR = -0.72 + 0.1 * pr; fL = -0.72 + 0.1 * pl; aR = -0.08 + 0.12 * sin(tt * 0.8); aL = -0.08 - 0.12 * sin(tt * 0.8); hp = 0.08 + 0.05 * sin(tt * 1.7); spY = 0.05 * sin(tt * 0.8); fgC = vec2(0.3 + 0.3 * abs(pr), 0.3 + 0.3 * abs(pl)); }
      else if (act < 15.5) { float cy = fract(tt / 9.0), k = smoothstep(0.0, 0.1, cy) * (1.0 - smoothstep(0.26, 0.38, cy)); uR = -0.3 - 0.6 * k; fR = -1.15 - 1.2 * k; aR = 0.12; uL = 0.08; fL = -0.35; aL = 0.06; hp = -0.08 * k; fgC.x = 0.5; }
      else if ((act > 16.5 && act < 17.5) || (act > 18.5 && act < 19.5)) { float cy = fract(tt / 9.0), up = smoothstep(0.02, 0.12, cy) * (1.0 - smoothstep(0.2, 0.32, cy)), bite = smoothstep(0.12, 0.15, cy) * (1.0 - smoothstep(0.17, 0.21, cy));
        sitK = step(18.5, act); uR = mix(-0.38, -0.82, up); fR = mix(-1.28, -2.3, up); aR = 0.06 + 0.1 * up; uL = sitK > 0.5 ? -0.55 : 0.04; fL = sitK > 0.5 ? -0.95 : -0.32; hp = 0.08 * up + 0.12 * bite; chew = step(0.17, cy) * (1.0 - smoothstep(0.52, 0.58, cy)); jawO = bite; fgC.x = 1.0; }
      else if (act > 17.5 && act < 18.5) { float cyc = floor(tt / 10.0), u = fract(tt / 10.0), giver = abs(step(0.5, actI) - step(0.5, mod(cyc, 2.0)));
        float reach = giver > 0.5 ? smoothstep(0.02, 0.16, u) * (1.0 - smoothstep(0.3, 0.42, u)) : smoothstep(0.1, 0.24, u) * (1.0 - smoothstep(0.3, 0.42, u));
        float eat = (1.0 - giver) * smoothstep(0.5, 0.58, u) * (1.0 - smoothstep(0.64, 0.74, u)), holdK = giver > 0.5 ? 1.0 - smoothstep(0.3, 0.4, u) : smoothstep(0.3, 0.4, u);
        uR = mix(mix(-0.05, -0.38, holdK), -1.2, reach); fR = mix(mix(-0.25, -1.28, holdK), -0.12, reach);
        uR = mix(uR, -0.82, eat); fR = mix(fR, -2.3, eat); aR = 0.04 + 0.1 * eat - 0.06 * reach;
        hp = 0.06 * reach + 0.12 * eat; uL = 0.04; fL = -0.3; chew = (1.0 - giver) * step(0.62, u) * (1.0 - smoothstep(0.88, 0.95, u)); spP = 0.06 * reach; fgC.x = 0.9 - 0.6 * reach; }
      else if (act < 16.5) { float cy = fract(tt / 12.0), k = smoothstep(0.05, 0.15, cy) * (1.0 - smoothstep(0.45, 0.55, cy)); uL = -0.1 - 0.5 * k; fL = -0.3 - 1.2 * k; aL = -0.18 * k; hp = 0.32 * k; }
      if (talk > 0.0) { float tk = talk * (0.5 + 0.5 * sin(uTime * 1.3 + aGait.x * 5.0)), tf = talk * (0.5 + 0.5 * sin(uTime * 1.9 + aGait.x * 3.0)); uL -= tk * 0.35; uR -= tk * 0.08; fL -= tf * 1.1; fR -= tf * 0.4; jawO = talk * 0.5 * (0.5 + 0.5 * sin(uTime * 11.0 + aGait.x * 9.0)); }
      uaP = -vec2(uR, uL); elF = -vec2(fR, fL); uaA = vec2(aR, aL); uaT = vec2(0.1 + 0.4 * sitK); nkP += hp;
      if (sitK > 0.5) { poseSit(); spP += 0.06; }
    }
  }
  // Blick: wer die Kamera bemerkt, dreht den Kopf (und ein wenig die Schultern) zu ihr; manche grüßen im Vorbeigehen
  {
    vec3 hd = camB - vec3(0.0, mix(1.62, 1.58, fem), 0.03); float dist = length(hd);
    float yaw = atan(hd.x, hd.z), pit = atan(hd.y, length(hd.xz));
    float want = step(hh(aGait.x * 3.3), 0.78) * smoothstep(0.15, 0.45, 0.5 + 0.5 * sin(uTime * (0.23 + 0.1 * hh(aGait.x)) + aGait.x * 9.0));
    float busy = max(danceK, step(23.5, act) * (1.0 - step(31.5, act)) * 0.7) + step(31.5, act) * step(act, 34.5) * 0.6;
    lookK = want * smoothstep(8.0, 4.0, dist) * smoothstep(2.2, 1.5, abs(yaw)) * (1.0 - busy) * (1.0 - step(98.5, act));
    float hy = clamp(yaw, -1.15, 1.15);
    spY += 0.22 * hy * lookK; nkY = mix(nkY, hy * 0.97 - (pvY + spY), lookK); nkP = mix(nkP, -pit * 0.8 - (spP + pvP) + 0.03, lookK * 0.85);
    lookY = clamp(yaw - hy * 0.97, -0.6, 0.6) * lookK; lookP = clamp(pit - pit * 0.8, -0.4, 0.4) * lookK;
    // Gruß im Vorbeigehen: Hand an die Hutkrempe (Männer) oder ein Nicken
    float greet = walking * (1.0 - runK) * (1.0 - carryK) * lookK * smoothstep(3.4, 2.2, dist) * step(hh(aGait.x * 9.1), 0.4);
    if (greet > 0.001) {
      if (fem < 0.5) { uaP.x = mix(uaP.x, 2.45, greet); elF.x = mix(elF.x, 2.3, greet); uaA.x = mix(uaA.x, 0.35, greet); uaT.x = mix(uaT.x, 0.5, greet); fgC.x = mix(fgC.x, 0.2, greet); }
      nkP += 0.14 * greet * (0.5 + 0.5 * sin(uTime * 3.0));
    }
  }
  // Ältere: gebeugt; gemächliche Leute lassen den Kopf etwas hängen
  spP += elder * (0.1 + 0.05 * walking); nkP += elder * 0.08 + step(0.33, gs) * (1.0 - step(0.66, gs)) * 0.06 * walking;
}
// Drehung eines Arms (Oberarm-Winkel gewichtet)
vec3 armRot(vec3 v, float sd, float ap, float aa, float at, float w) { return rX(rZ(rY(v, -sd * at * w), sd * aa * w), -ap * w); }
// Pose auf einen Punkt (und seine Normale) anwenden; L Glied, piv Drehpunkthöhe, sk Schwungart, sw Gewicht, op Variante
void humanRig(inout vec3 p, inout vec3 n, float L, float piv, float fem, float sk, float sw, float op) {
  float hipY = hHip, hx = hHx, kneeY = hipY * 0.52, waistY = mix(1.02, 1.0, fem);
  float headC = mix(1.62, 1.58, fem), neckY = headC - 0.15;
  bool tool = L > 8.5, leg = (L > 0.5 && L < 2.5) || (L > 4.5 && L < 6.5), arm = !tool && ((L > 2.5 && L < 4.5) || L > 6.5);
  float rgt = (L < 1.5 || (L > 2.5 && L < 3.5) || (L > 4.5 && L < 5.5) || (L > 6.5 && L < 7.5)) ? 1.0 : 0.0;
  float sd = rgt > 0.5 ? -1.0 : 1.0;
  bool rigid = op > 30.5;   // Requisiten bleiben starr an ihrem Glied
  if (tool) {
    // Werkzeug mit zwei Händen: liegt im Körperraum, folgt dem Oberkörper
    p = toolO + toolX * p.x + toolY * p.y + toolZ * p.z; n = toolX * n.x + toolY * n.y + toolZ * n.z;
  } else if (leg) {
    float pivY = piv > 0.1 ? piv : hipY, kY = pivY * 0.52, ank = mix(0.09, 0.1, fem);
    vec3 hj = vec3(sd * hx, pivY, 0.0);
    float k = rgt > 0.5 ? knF.x : knF.y;
    if (L > 4.5 && p.y < ank + 0.05) { vec3 aj = vec3(sd * hx, ank, 0.0); float a = rgt > 0.5 ? anF.x : anF.y; float wA = smoothstep(ank + 0.05, ank - 0.01, p.y); p = mix(p, aj + rX(p - aj, -a), wA); n = mix(n, rX(n, -a), wA); }
    // Knie weich: Ober- und Unterschenkel teilen sich die Beugung am Gelenk
    float wk = rigid ? (L > 4.5 ? 1.0 : 0.0) : smoothstep(kY + 0.045, kY - 0.045, p.y);
    if (wk > 0.0) { vec3 kj = vec3(sd * hx, kY, 0.006); p = kj + rX(p - kj, k * wk); n = rX(n, k * wk); }
    float tp = rgt > 0.5 ? thP.x : thP.y, ta = rgt > 0.5 ? thA.x : thA.y, ty = rgt > 0.5 ? thY.x : thY.y;
    // oben an der Hüfte folgt der Stoff halb dem Becken
    float wh = rigid ? 1.0 : 1.0 - 0.35 * smoothstep(hipY - 0.08, hipY + 0.03, p.y) * (1.0 - sitK);
    p = hj + rX(rZ(rY(p - hj, sd * ty * wh), sd * ta * wh), -tp * wh); n = rX(rZ(rY(n, sd * ty * wh), sd * ta * wh), -tp * wh);
  } else if (arm) {
    float shX = sd * mix(0.215, 0.178, fem), top = piv, elY = top - mix(0.28, 0.27, fem), wrY = top - mix(0.56, 0.54, fem);
    vec3 wj = vec3(sd * mix(0.223, 0.186, fem), wrY, 0.05);
    float isHand = (!rigid && p.y < wrY + 0.004 && aSoft.x < 6.5 && (aSoft.x < 1.5 || aSoft.x > 5.5)) ? 1.0 : 0.0;
    // Finger krümmen sich zur Handfläche (Daumen bleibt), Handgelenk beugt
    if (isHand > 0.5 && p.y < wrY - 0.072 && p.z < wj.z + 0.036) {
      float c = rgt > 0.5 ? fgC.x : fgC.y, xk = sd * mix(0.222, 0.185, fem);
      // Mittelglieder, dann Grundgelenke
      vec2 k2 = vec2(xk - sd * 0.006, wrY - 0.12);
      float w2 = smoothstep(k2.y + 0.004, k2.y - 0.006, p.y);
      vec3 q = vec3(p.x - k2.x, p.y - k2.y, 0.0); q = rZ(q, -sd * c * 0.9 * w2); p = vec3(k2.x + q.x, k2.y + q.y, p.z); n = rZ(n, -sd * c * 0.9 * w2);
      vec2 k1 = vec2(xk, wrY - 0.086);
      float w1 = smoothstep(wrY - 0.075, wrY - 0.09, position.y);
      q = vec3(p.x - k1.x, p.y - k1.y, 0.0); q = rZ(q, -sd * c * w1); p = vec3(k1.x + q.x, k1.y + q.y, p.z); n = rZ(n, -sd * c * w1);
    }
    float wfx = rgt > 0.5 ? wrF.x : wrF.y;
    if ((isHand > 0.5 || (rigid && L > 6.5 && op > 50.5)) && abs(wfx) > 0.001) { float ww = rigid ? 1.0 : smoothstep(wrY + 0.004, wrY - 0.02, p.y); p = wj + rX(p - wj, -wfx * ww); n = rX(n, -wfx * ww); }
    // Ellbogen weich
    float e = rgt > 0.5 ? elF.x : elF.y;
    float we = rigid ? (L > 6.5 ? 1.0 : 0.0) : smoothstep(elY + 0.05, elY - 0.04, p.y);
    if (we > 0.0) { vec3 ej = vec3(sd * mix(0.237, 0.2, fem), elY, -0.025); p = ej + rX(p - ej, -e * we); n = rX(n, -e * we); }
    // Schulter: oben am Arm nur zum Teil mitgedreht, damit die Schulter rund bleibt
    vec3 sj = vec3(shX, top, 0.0);
    float ap = rgt > 0.5 ? uaP.x : uaP.y, aa = rgt > 0.5 ? uaA.x : uaA.y, at = rgt > 0.5 ? uaT.x : uaT.y;
    float nearTop = 1.0 - smoothstep(top + 0.01, top - 0.13, p.y), inner = 1.0 - smoothstep(abs(shX) - 0.07, abs(shX) - 0.01, abs(p.x));
    float ws = rigid ? 1.0 : 1.0 - 0.45 * nearTop * (0.45 + 0.55 * inner);
    p = sj + armRot(p - sj, sd, ap, aa, at, ws); n = armRot(n, sd, ap, aa, at, ws);
  } else {
    // Rumpf an der Schulter: Achsel und Schulterkappe gehen ein Stück mit dem Arm
    float ax = abs(p.x), sdT = sign(p.x + 1e-4), top = mix(1.34, 1.31, fem), shXa = mix(0.215, 0.178, fem);
    float wt = 0.3 * smoothstep(shXa - 0.085, shXa - 0.01, ax) * smoothstep(top - 0.16, top - 0.06, p.y) * (1.0 - smoothstep(top + 0.05, top + 0.1, p.y)) * (1.0 - step(30.5, op));
    if (wt > 0.001 && (sk < 1.5 || sk > 4.5)) {
      float ap = sdT < 0.0 ? uaP.x : uaP.y, aa = sdT < 0.0 ? uaA.x : uaA.y, at = sdT < 0.0 ? uaT.x : uaT.y;
      ap = clamp(ap, -0.8, 1.6); aa = clamp(aa, -0.4, 1.2); at = clamp(at, -0.8, 0.8);
      vec3 sj = vec3(sdT * shXa, top, 0.0); p = sj + armRot(p - sj, sdT, ap, aa, at, wt); n = armRot(n, sdT, ap, aa, at, wt);
    }
    if ((sk > 1.5 && sk < 4.5) && p.y < hipY + 0.04) {
      // Rock, Fransen und Mantelschoß gehen mit den Beinen; im Sitzen knicken sie an Hüfte und Knie ab
      float f = sitK > 0.5 ? smoothstep(hipY + 0.04, hipY - 0.1, p.y) : sw * (sk > 3.5 ? 0.45 : 0.6);
      if (f > 0.001) {
        vec3 q[2]; vec3 qn[2];
        for (int i = 0; i < 2; i++) {
          float r = float(i), s2 = r > 0.5 ? 1.0 : -1.0, tp = r > 0.5 ? thP.y : thP.x, ta = r > 0.5 ? thA.y : thA.x, k = r > 0.5 ? knF.y : knF.x;
          vec3 hj = vec3(s2 * hx, hipY, 0.0), kj = vec3(s2 * hx, kneeY, 0.0), a = p, an = n;
          if (a.y < kneeY + 0.03) { float kw = smoothstep(kneeY + 0.03, kneeY - 0.05, a.y); a = mix(a, kj + rX(a - kj, k), kw); an = mix(an, rX(an, k), kw); }
          q[i] = hj + rX(rZ(a - hj, s2 * ta * 0.7), -tp); qn[i] = rX(an, -tp);
        }
        float wl = smoothstep(-0.12, 0.12, p.x); vec3 pq = mix(q[0], q[1], wl), nq = mix(qn[0], qn[1], wl);
        p = mix(p, pq, f); n = normalize(mix(n, nq, f));
        // Mantel vorne: der Schoß legt sich über das vordere Bein statt es durchstoßen zu lassen
        if (sk > 3.5 && sitK < 0.5) p.z = mix(p.z, max(p.z, max(q[0].z, q[1].z) + 0.01), smoothstep(-0.02, 0.06, p.z) * min(1.0, sw * 1.6));
      }
    }
    // Kopf am Hals
    if (p.y > neckY - 0.04) {
      vec3 nj = vec3(0.0, neckY, 0.0); float w = smoothstep(neckY - 0.04, neckY + 0.05, p.y);
      vec3 hp = nj + rY(rX(rZ(p - nj, -nkR), nkP), nkY);
      p = mix(p, hp, w); n = mix(n, rY(rX(rZ(n, -nkR), nkP), nkY), w);
    }
  }
  // Oberkörper an der Taille; Arme und Werkzeuge hängen am Oberkörper
  {
    float w = (arm || tool) ? 1.0 : (leg || sk > 1.5 && sk < 4.5 && p.y < hipY ? 0.0 : smoothstep(waistY - 0.12, waistY + 0.14, p.y));
    if (w > 0.0) { vec3 wj = vec3(0.0, waistY, 0.0); p = mix(p, wj + rY(rX(rZ(p - wj, -spR), spP), spY), w); n = mix(n, rY(rX(rZ(n, -spR), spP), spY), w); }
  }
  // Becken: alles
  { vec3 pj = vec3(0.0, hipY, 0.0); p = pj + rY(rX(rZ(p - pj, pvR), pvP), pvY) + pvO; n = rY(rX(rZ(n, pvR), pvP), pvY); }
}
// Kopfform je Person: Nase, Kinn, Kiefer, Wangen, Stirn, Ohren, Lippen; dazu Statur (Bauch, Brust, Hüfte)
void humanShape(inout vec3 p, float L, float fem, float fid, float op) {
  float seed = aGait.x * 1.37 + fid * 0.173;
  float beauty = clamp(mix(hh(seed * 5.1) * 2.0 - 1.0, fract(fid * 0.618034) * 2.0 - 1.0, 0.7) * 1.15, -1.0, 1.0);   // >0 ebenmäßig, <0 markant bis hässlich; passt zum gemalten Gesicht
  float ext = mix(1.35, 0.45, s01(beauty * 0.5 + 0.5));
  float nS = (hh(seed + 1.1) * 2.0 - 1.0) * ext, nL = (hh(seed + 2.3) * 2.0 - 1.0) * ext, nW = (hh(seed + 3.7) * 2.0 - 1.0) * ext, nH = max(0.0, hh(seed + 4.9) * 2.0 - 1.0 - 0.2 * beauty) * ext * 1.3;
  float jw = (hh(seed + 6.1) * 2.0 - 1.0) * ext, ch = (hh(seed + 7.3) * 2.0 - 1.0) * ext, chL = (hh(seed + 8.9) * 2.0 - 1.0) * ext;
  float fat = (hh(seed + 10.7) * 2.0 - 1.0) * ext, brw = (hh(seed + 11.3) * 2.0 - 1.0) * ext * (1.0 - 0.6 * fem), lip = (hh(seed + 12.9) * 2.0 - 1.0) * ext + 0.4 * fem;
  float ear = max(0.0, hh(seed + 14.1) * 2.0 - 1.0 - 0.3 * beauty) * ext, fh = (hh(seed + 15.7) * 2.0 - 1.0) * ext, asy = (hh(seed + 16.3) * 2.0 - 1.0) * (1.0 - s01(beauty)) * 0.6;
  float hw = (hh(seed + 17.9) * 2.0 - 1.0) * 0.6 * ext, hl = (hh(seed + 19.1) * 2.0 - 1.0) * 0.6 * ext, eyS = (hh(seed + 20.3) * 2.0 - 1.0) * ext;
  float headC = mix(1.62, 1.58, fem), neckY = headC - 0.15;
  bool torsoish = L < 0.5;
  if (torsoish && p.y > neckY + 0.02) {
    // ganzer Kopf samt Haar und Hut: Breite und Länge
    vec3 q = p - vec3(0.0, headC, 0.004);
    float wHead = smoothstep(neckY + 0.02, neckY + 0.07, p.y);
    q.x *= 1.0 + 0.045 * hw * wHead; q.y *= 1.0 + 0.04 * hl * wHead * step(q.y, 0.0) + 0.02 * hl * wHead * step(0.0, q.y);
    float skin = step(abs(aSoft.x - 1.0), 0.1) * (1.0 - step(0.5, op));
    if (skin > 0.5) {
      float ax = abs(q.x), fr = smoothstep(0.0, 0.05, q.z);
      float noseY = ${HL.noseY.toFixed(4)}, mouthY = ${HL.mouthY.toFixed(4)}, chinY = ${HL.chinY.toFixed(4)}, eyeY = ${HL.eyeY.toFixed(4)};
      float gN = exp(-pow(q.x / 0.013, 2.0) - pow((q.y - noseY + 0.004) / 0.019, 2.0)) * fr;
      q.z += (0.0045 * nS + 0.0015 * nL) * gN;                                                  // Nasengröße
      q.y -= 0.0045 * nL * exp(-pow(q.x / 0.012, 2.0) - pow((q.y - noseY + 0.01) / 0.01, 2.0)) * fr;          // Nasenspitze tiefer
      q.x *= 1.0 + 0.22 * nW * exp(-pow((ax - 0.012) / 0.008, 2.0) - pow((q.y - noseY + 0.006) / 0.008, 2.0)) * fr;   // Nasenflügel
      q.z += 0.0035 * nH * exp(-pow(q.x / 0.006, 2.0) - pow((q.y - eyeY + 0.022) / 0.009, 2.0)) * fr;       // Höcker
      q.x += 0.0025 * asy * gN;                                                                  // schiefe Nase
      float low = smoothstep(-0.03, -0.095, q.y);
      q.x *= 1.0 + 0.075 * jw * low * smoothstep(0.02, 0.06, ax);                                // Kiefer breit oder schmal
      q.z += 0.008 * ch * exp(-pow(q.x / 0.022, 2.0) - pow((q.y - chinY - 0.006) / 0.016, 2.0)) * fr;   // Kinn vor oder fliehend
      q.y -= 0.007 * chL * smoothstep(mouthY - 0.012, chinY - 0.01, q.y) * fr;                   // Kinn lang oder kurz
      q.x *= 1.0 + 0.07 * fat * exp(-pow((ax - 0.05) / 0.025, 2.0) - pow((q.y - mouthY - 0.008) / 0.03, 2.0)); // Wangen voll oder hohl
      q.z += 0.004 * fat * exp(-pow((ax - 0.04) / 0.02, 2.0) - pow((q.y - mouthY - 0.012) / 0.022, 2.0)) * fr;
      q.z += 0.003 * brw * exp(-pow((ax - 0.03) / 0.02, 2.0) - pow((q.y - eyeY - 0.022) / 0.008, 2.0)) * fr;   // Brauenwulst
      q.z += 0.0022 * lip * exp(-pow(q.x / 0.02, 2.0) - pow((q.y - mouthY) / 0.008, 2.0)) * fr;              // Lippen voll oder schmal
      q.z -= 0.006 * fh * smoothstep(eyeY + 0.03, 0.09, q.y) * fr;                                // fliehende Stirn
      q.x += sign(q.x) * 0.0025 * eyS * exp(-pow((ax - 0.031) / 0.014, 2.0) - pow((q.y - eyeY) / 0.012, 2.0)) * fr;   // Augenabstand
      q.y += 0.002 * asy * sign(q.x) * exp(-pow((ax - 0.031) / 0.014, 2.0) - pow((q.y - eyeY) / 0.012, 2.0));         // ungleiche Augen
      // Ohren stehen ab
      float earW = smoothstep(0.066, 0.08, ax) * exp(-pow((q.z + 0.012) / 0.025, 2.0) - pow(q.y / 0.03, 2.0));
      q.x += sign(q.x) * 0.012 * ear * earW * smoothstep(0.07, 0.085, ax); q.z += 0.006 * ear * earW;
      // Doppelkinn bei Fülligen
      q.z += 0.008 * max(0.0, fat) * exp(-pow(q.x / 0.035, 2.0) - pow((q.y - chinY + 0.012) / 0.014, 2.0)) * step(0.0, q.z);
    }
    p = q + vec3(0.0, headC, 0.004);
  }
  // Statur: Bauch bei Männern, schmalere Taille bei Damen
  if (torsoish && op < 0.5 && p.y > 0.75 && p.y < neckY) {
    float belly = (1.0 - fem) * max(0.0, hh(seed + 21.7) * 2.6 - 1.4) * (0.6 + 0.4 * (1.0 - s01(beauty)));
    float front = smoothstep(-0.02, 0.1, p.z);
    p.z += 0.075 * belly * exp(-pow((p.y - 1.02) / 0.13, 2.0)) * front * smoothstep(0.2, 0.0, abs(p.x));
    p.x *= 1.0 + 0.08 * belly * exp(-pow((p.y - 1.0) / 0.16, 2.0));
  }
}
`;
const HUM_VS_RIG = `
  float hFemV = step(32.0, mod(aGait.w, 64.0)), hGs = fract(sin(aGait.x * 91.7) * 437.5);
  hFem = hFemV; hHip = mix(0.95, 0.88, hFemV); hHx = mix(0.1, 0.085, hFemV);
  float hHairI = mod(floor(aGait.w / 320.0), 6.0), hElder = step(3.5, hHairI) * step(hHairI, 4.5);
  // Kamera im Körperraum der Figur
  {
    #ifdef USE_INSTANCING
      mat4 hIM = modelMatrix * instanceMatrix;
    #else
      mat4 hIM = modelMatrix;
    #endif
    vec3 dC = cameraPosition - hIM[3].xyz;
    camB = vec3(dot(dC, hIM[0].xyz) / dot(hIM[0].xyz, hIM[0].xyz), dot(dC, hIM[1].xyz) / dot(hIM[1].xyz, hIM[1].xyz), dot(dC, hIM[2].xyz) / dot(hIM[2].xyz, hIM[2].xyz));
  }
  humanPose(hFemV, hGs, hElder);
  float hSk = mod(aSoft.z, 16.0), hSw = aSoft.y;
  vec3 hP = position, hN = objectNormal;
  // Breite der Figur gilt nicht für den Kopf: Kopf und Hals behalten ihre Form
  #ifdef USE_INSTANCING
  {
    float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz), sz = length(instanceMatrix[2].xyz);
    float hc = mix(1.62, 1.58, hFemV), wq = smoothstep(hc - 0.2, hc - 0.13, hP.y) * step(aLimb.x, 0.5);
    hP.x = mix(hP.x, hP.x * sy / max(sx, 1e-3), wq); hP.z = mix(hP.z, (hP.z - 0.004) * sy / max(sz, 1e-3) + 0.004, wq);
  }
  #endif
  humanShape(hP, aLimb.x, hFemV, mod(aGait.w, 64.0), aOpt);
  // Atmen: Brustkorb hebt sich
  if (aLimb.x < 0.5 && aOpt < 0.5) hP.xz *= 1.0 + 0.014 * sin(uTime * (1.4 + 0.4 * hGs + 1.2 * runK) + aGait.x) * smoothstep(1.0, 1.25, hP.y) * (1.0 - smoothstep(1.38, 1.46, hP.y)) * (1.0 - step(98.5, hAct)) * (1.0 + runK);
  // Kiefer: kauen, reden, lachen, gähnen
  { float hc = mix(1.62, 1.58, hFemV), yh = hP.y - hc; float jw = smoothstep(-0.135, -0.1, yh) * (1.0 - smoothstep(-0.064, -0.054, yh)) * step(0.015, hP.z) * step(aLimb.x, 0.5) * (1.0 - step(0.5, aOpt));
    hP.y -= jw * (chew * 0.006 * (0.5 + 0.5 * sin(uTime * 13.0)) + jawO * 0.005); }
  // Haar unter dem Hut zusammendrücken; Glatze oben bei manchen älteren Herren
  if (hSk > 0.5 && hSk < 1.5) {
    float hm = floor(aSoft.z / 16.0), want = mod(floor(aGait.w / 7680.0), 3.0), hc = mix(1.62, 1.58, hFemV);
    float on = step(7.5, hm) + mod(floor(hm / pow(2.0, want)), 2.0);
    if (on > 0.5) { vec3 c = vec3(0.0, hc, 0.0); vec3 d = hP - c; float up = smoothstep(0.0, 0.06, d.y); hP = c + d * mix(1.0, 0.9, up); hSw *= 0.3; }
    else {
      float bald = (1.0 - hFemV) * step(0.55, hh(aGait.x * 4.4 + 0.3) + hElder * 0.35);
      vec3 d = hP - vec3(0.0, hc, 0.0);
      float crown = smoothstep(0.03, 0.07, d.y + d.z * 0.4) * bald;
      hP = vec3(0.0, hc, 0.0) + d * mix(1.0, 0.86, crown);
    }
  }
  humanRig(hP, hN, aLimb.x, aLimb.y, hFemV, hSk, hSw, aOpt);
  // Nachschwingen: Haare, Röcke, Fransen, Ketten. Wind kommt aus der Welt in den Körper
  if (hSk > 0.5 && hSw > 0.001 && hAct < 98.5) {
    vec3 wW = vec3(uWind.x, 0.0, uWind.y) * uWind.z;
    #ifdef USE_INSTANCING
      mat3 im = mat3(instanceMatrix); wW = transpose(im) * wW / max(0.01, dot(im[0], im[0]));
    #endif
    float gust = 0.6 + 0.4 * sin(uTime * 2.3 + position.x * 30.0 + position.y * 17.0 + aGait.x) + uWind.w * 0.5;
    float wv = hSw * hSw;
    vec3 o = wW * 0.0045 * gust * wv * (1.0 + runK);
    float ph = uTime * aGait.y + aGait.x;
    float wk = step(0.01, aGait.z) * (1.0 + 1.5 * runK);
    if (hSk < 1.5) {
      o += vec3(-pvO.x * 0.9 - nkY * 0.012, -0.007 * bounceV * (wk * walkA + danceK * 1.5), -0.006 * wk * walkA - 0.004 * spP) * hSw;
      vec2 rd = normalize(hP.xz + vec2(0.0001)); o.xz += rd * 0.022 * flareK * hSw * (0.6 + 0.4 * sin(uTime * 3.1 + aGait.x));
    } else if (hSk < 2.5) {
      o.x += wv * 0.03 * sin(ph - 1.2) * wk * walkA + wv * 0.015 * sin(uTime * 3.0 + aGait.x) * danceK;
      o.y += -0.01 * bounceV * danceK * wv;
      vec2 rd = normalize(hP.xz + vec2(0.0001)); o.xz += rd * wv * 0.07 * flareK * (0.7 + 0.3 * sin(uTime * 2.0 + aGait.x));
    } else if (hSk < 3.5) {
      float e = wk * walkA + danceK * 2.2;
      o += vec3(0.035 * sin(ph * 2.0 - 1.4 + position.y * 9.0) * e + 0.02 * sin(uTime * 4.0 * danceK + position.x * 20.0) * danceK, -0.02 * bounceV * danceK, 0.02 * sin(ph - 1.0) * wk * walkA) * hSw;
      vec2 rd = normalize(hP.xz + vec2(0.0001)); o.xz += rd * 0.06 * flareK * hSw;
    } else if (hSk < 4.5) {
      o.x += wv * 0.012 * sin(ph - 1.2) * wk * walkA; o.z -= wv * (0.012 + 0.03 * runK) * wk * walkA;
    } else {
      o.z += hSw * (0.012 * sin(ph * 2.0 - 1.0) * wk * walkA + 0.02 * bounceV * danceK + 0.02 * max(0.0, spP));
      o.y += hSw * 0.006 * bounceV * danceK;
    }
    hP += o;
  }
  objectNormal = normalize(hN);
  vBlink = step(fract(uTime * 0.21 + hh(aGait.x) * 7.0), 0.022) + step(abs(fract(uTime * 0.21 + hh(aGait.x) * 7.0) - 0.06), 0.012);
  // Augen: zur Kamera, sonst kleine Sprünge
  { float sac = floor(uTime * 0.7 + hh(aGait.x * 2.0) * 5.0); vec2 idle = (vec2(hh(sac + aGait.x), hh(sac * 1.3 + aGait.x * 2.0)) - 0.5) * vec2(0.5, 0.25);
    vGaze = mix(idle, vec2(lookY, lookP), lookK); }
  vLook = vec4(hh(aGait.x * 1.37 + mod(aGait.w, 64.0) * 0.173), 0.0, 0.0, 0.0);
`;
const HUM_VS_POS = `
        transformed = hP;
        // Varianten (Hut, Frisur, Krawatte) einer Figur: die übrigen fallen in einen Punkt zusammen
        float act = hAct, walking = step(0.01, aGait.z), actI = fract(aGait.y), tt = uTime * (0.9 + 0.2 * fract(aGait.x * 3.7)) + aGait.x * 7.0;
        if (aOpt > 40.5 && aOpt < 46.5) {
          float pv = aOpt - 40.0, show = 0.0;
          if (pv < 1.5) show = (abs(act - 5.0) < 0.5 || abs(act - 11.0) < 0.5) ? 1.0 : 0.0;
          else if (pv < 4.5) {
            float seg = pv - 1.0, bites = 0.0, holds = 0.0;
            if ((act > 16.5 && act < 17.5) || (act > 18.5 && act < 19.5)) { bites = mod(floor(tt / 9.0), 4.0) + step(0.165, fract(tt / 9.0)); holds = 1.0; }
            else if (act > 17.5 && act < 18.5) { float cyc = floor(tt / 10.0), u = fract(tt / 10.0), giver = abs(step(0.5, actI) - step(0.5, mod(cyc, 2.0))); bites = mod(cyc, 4.0) + step(0.6, u); holds = giver > 0.5 ? 1.0 - step(0.31, u) : step(0.31, u); }
            show = holds * (1.0 - step(seg - 0.5, bites));
          }
          else show = abs(act - 10.0) < 0.5 ? 1.0 : 0.0;
          if (show < 0.5 || walking > 0.5) transformed = vec3(0.0);
        }
        else if (aOpt > 50.5) {
          // Werkzeuge und Dinge der Arbeit
          float pv = aOpt - 50.0, show = 0.0;
          if (pv < 1.5) show = step(abs(act - 24.0), 0.1);
          else if (pv < 2.5) show = step(abs(act - 26.0), 0.1);
          else if (pv < 3.5) show = max(step(abs(act - 27.0), 0.1) * step(0.5, toolOn), carryK);
          else if (pv < 4.5) show = step(abs(act - 32.0), 0.1);
          else if (pv < 5.5) show = step(abs(act - 31.0), 0.1);
          else if (pv < 6.5) show = step(abs(act - 25.0), 0.1);
          else if (pv < 8.5) show = step(abs(act - 28.0), 0.1);
          else if (pv < 9.5) show = step(abs(act - 29.0), 0.1);
          else if (pv < 10.5) show = step(abs(act - 30.0), 0.1);
          else if (pv < 11.5) show = max(step(abs(act - 15.0), 0.1), step(abs(act - 38.0), 0.1));
          else if (pv < 12.5) show = step(abs(act - 37.0), 0.1);
          if (show < 0.5) transformed = vec3(0.0);
        }
        else if (aOpt > 0.5) {
          float grp = floor((aOpt - 1.0) / 10.0), vari = aOpt - 1.0 - grp * 10.0;
          float want = mod(floor(aGait.w / (grp < 0.5 ? 7680.0 : grp < 1.5 ? 23040.0 : grp < 2.5 ? 69120.0 : 207360.0)), grp > 2.5 ? 4.0 : 3.0);
          if (abs(vari - want) > 0.1 || (grp > 2.5 && (act > 1.5 || carryK > 0.5 || runK > 0.5))) transformed = vec3(0.0);
        }
        vFaceUV = uv; vFaceId = mod(aGait.w, 7680.0); vClP = position; vPnt = step(2.97, color.r + color.g + color.b); vSoft = aSoft;`;

const HUM_FS_HEAD = `uniform sampler2D uFaces, uFaceMat; uniform float uTime;
varying vec2 vFaceUV; varying float vFaceId; varying vec3 vClP; varying float vPnt; varying vec3 vSoft; varying float vBlink; varying vec2 vGaze; varying vec4 vLook;
float clH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vN3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(clH(i), clH(i + vec3(1,0,0)), f.x), mix(clH(i + vec3(0,1,0)), clH(i + vec3(1,1,0)), f.x), f.y), mix(mix(clH(i + vec3(0,0,1)), clH(i + vec3(1,0,1)), f.x), mix(clH(i + vec3(0,1,1)), clH(i + vec3(1,1,1)), f.x), f.y), f.z); }
vec3 hPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection) {
  vec3 vSigmaX = dFdx(surf_pos), vSigmaY = dFdy(surf_pos), R1 = cross(vSigmaY, surf_norm), R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDirection; vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;
const HUM_FS_COLOR = `
        float hRough = -1.0, hMetal = -1.0, hB = 0.0, hSpark = 0.0;
        {
          float idv = floor(vFaceId + 0.5), fid = mod(idv, 64.0), tone = mod(floor(idv / 64.0), 5.0), hairI = mod(floor(idv / 320.0), 6.0);
          vec3 T5 = tone < 0.5 ? vec3(1.06, 1.03, 1.02) : tone < 1.5 ? vec3(0.97, 0.9, 0.84) : tone < 2.5 ? vec3(0.88, 0.8, 0.66) : tone < 3.5 ? vec3(0.62, 0.48, 0.38) : vec3(0.42, 0.31, 0.25);
          vec3 HC = hairI < 0.5 ? vec3(0.05, 0.035, 0.03) : hairI < 1.5 ? vec3(0.2, 0.12, 0.06) : hairI < 2.5 ? vec3(0.62, 0.48, 0.26) : hairI < 3.5 ? vec3(0.42, 0.14, 0.06) : hairI < 4.5 ? vec3(0.55, 0.5, 0.43) : vec3(0.11, 0.07, 0.04);
          float fab = floor(vSoft.x + 0.5);
          vec3 vd = normalize(vViewPosition); float nv = abs(dot(normalize(vNormal), vd));
          float aa = clamp(1.6 - fwidth(vClP.y) * 260.0, 0.0, 1.0), aa2 = clamp(1.6 - fwidth(vClP.y) * 700.0, 0.0, 1.0);
          if (fab < 0.5) {
            // ferne Figuren und Teile ohne Stoffangabe: wie bisher nach Farbe
            if (distance(vColor, vec3(0.88, 0.58, 0.42)) < 0.02) diffuseColor.rgb *= T5;
            if (distance(vColor, vec3(0.07, 0.05, 0.04)) < 0.015 || distance(vColor, vec3(0.62, 0.5, 0.3)) < 0.015) diffuseColor.rgb = HC;
            if (vPnt > 0.5) { float pat = floor(idv / 1920.0); float weave = 0.95 + 0.07 * clH(floor(vClP * 420.0)) * aa; diffuseColor.rgb *= weave; }
          } else if (fab < 1.5) {
            // Haut: Hautton, Gesicht aus dem Atlas, feine Poren
            diffuseColor.rgb *= T5;
            hRough = 0.62; hB = (vN3(vClP * 420.0) - 0.5) * 0.06 * aa2;
            if (vFaceUV.x >= 0.0) {
              vec2 cell = vec2(mod(fid, 8.0), floor(fid / 8.0)), fuv = (cell + clamp(vFaceUV, 0.01, 0.99)) / 8.0;
              vec4 f = texture2D(uFaces, fuv); vec3 m = texture2D(uFaceMat, fuv).rgb;
              float cls = m.b;
              if (cls < 0.17) diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * f.rgb * 2.0, f.a);
              else if (cls < 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, HC * (0.65 + 0.5 * f.r), f.a);
              else if (cls < 0.83) diffuseColor.rgb = mix(diffuseColor.rgb, f.rgb, f.a);
              else {
                // Auge: Iris und Pupille wandern mit dem Blick, das Weiße bleibt
                vec2 fuv2 = (cell + clamp(vFaceUV - vec2(vGaze.x * 0.055, vGaze.y * 0.04), 0.01, 0.99)) / 8.0;
                vec4 f2 = texture2D(uFaces, fuv2); float c2 = texture2D(uFaceMat, fuv2).b;
                vec3 ec = c2 > 0.83 ? f2.rgb : vec3(0.8, 0.76, 0.72);
                vec3 lid = diffuseColor.rgb * 0.82; diffuseColor.rgb = mix(diffuseColor.rgb, mix(ec, lid, clamp(vBlink, 0.0, 1.0)), f.a); }
              hRough = mix(0.66, 0.08, m.r * (1.0 - step(0.83, cls) * vBlink * 0.8)); hB += (m.g - 0.5) * 1.3;
            }
          } else if (fab < 2.5) {
            // Haar: Farbe der Figur, Strähnen quer zur Wuchsrichtung, dunkler am Ansatz, Glanzband
            float across = -vFaceUV.x, along = vFaceUV.y;
            float ac = across * 7.0, fa = clamp(1.0 - fwidth(ac) * 1.5, 0.0, 1.0);
            float st = vN3(vec3(ac, along * 2.0, vClP.y * 6.0)), clump = vN3(vClP * 60.0);
            vec3 c = HC * (0.75 + 0.35 * mix(0.5, st, fa) + 0.25 * (clump - 0.5)) * mix(0.62, 1.0, smoothstep(0.0, 0.35, along));
            c += HC * 0.6 * pow(1.0 - nv, 3.0) + vec3(0.04) * pow(1.0 - nv, 4.0);
            diffuseColor.rgb = c; hRough = 0.42 + 0.1 * hFemF(idv); hB = st * 0.8 * fa;
          } else {
            vec3 c = diffuseColor.rgb, p = vClP;
            float u = p.x * 0.8 + p.z;
            if (fab < 3.5) {
              // Wolle: Köperbindung (schräge Grate), dazu das Muster der Figur; Fasern fangen an der Kante Licht
              float ta = (p.x + p.z + p.y * 1.3) * 300.0, fa = clamp(1.0 - fwidth(ta) * 1.2, 0.0, 1.0);
              float twill = 0.5 + 0.5 * sin(ta * 6.2832);
              hB = (twill - 0.5) * 0.5 * fa + (vN3(p * 520.0) - 0.5) * 0.4 * aa2;
              c *= 0.97 + 0.04 * twill * fa + 0.05 * (vN3(p * 90.0) - 0.5);
              if (vPnt > 0.5) {
                float pat = floor(idv / 1920.0); vec3 lite = max(c * 1.9, vec3(0.16));
                if (pat > 0.5 && pat < 1.5) c = mix(c, lite, step(0.9, fract(u * 48.0)) * aa * 0.7);
                else if (pat > 1.5 && pat < 2.5) { float n = clH(floor(p * 160.0)), n2 = clH(floor(p * 60.0) + 3.0); c *= 0.84 + 0.22 * n * aa + 0.08 * n2; c += vec3(0.05, 0.03, 0.01) * step(0.93, n) * aa; }
                else if (pat > 2.5) { float a = step(0.5, fract(u * 9.0)), b = step(0.5, fract(p.y * 9.0)); float fine = step(0.5, fract((u + p.y) * 36.0)); c *= mix(1.0, 0.84 + 0.1 * (a + b) + 0.06 * fine, aa); c = mix(c, lite * vec3(1.0, 0.75, 0.6), step(0.95, fract(u * 9.0 + 0.25)) * aa * 0.4); }
              }
              c += c * 0.45 * pow(1.0 - nv, 3.0); hRough = 0.88;
            } else if (fab < 4.5 || (fab > 12.5 && fab < 13.5)) {
              // Seide und Satin: Glanz, der über die Falten wandert; feine Kettfäden
              float wa = p.y * 900.0 + p.x * 30.0, fa = clamp(1.0 - fwidth(wa) * 1.5, 0.0, 1.0);
              hB = sin(wa * 6.2832) * 0.08 * fa + (vN3(p * vec3(40.0, 4.0, 40.0)) - 0.5) * 0.6;
              c *= 0.85 + 0.3 * pow(1.0 - nv, 1.5); c += c * 0.6 * pow(1.0 - nv, 4.0);
              hRough = fab > 12.5 ? 0.22 : 0.3; hMetal = 0.08;
            } else if (fab < 5.5) {
              // Baumwolle: Leinwandbindung
              float wa = (p.x + p.z) * 700.0, wb = p.y * 700.0, fa = clamp(1.0 - max(fwidth(wa), fwidth(wb)) * 1.5, 0.0, 1.0);
              float w = sin(wa * 6.2832) * sin(wb * 6.2832);
              hB = w * 0.25 * fa + (vN3(p * 300.0) - 0.5) * 0.3 * aa; c *= 0.97 + 0.04 * w * fa; hRough = 0.7;
            } else if (fab < 6.5) {
              // Leder: poliert, mit feinen Knitterfalten
              hB = (vN3(p * vec3(160.0, 300.0, 160.0)) - 0.5) * 0.35 * aa; c *= 0.9 + 0.2 * pow(1.0 - nv, 2.0); hRough = 0.36;
            } else if (fab < 7.5) {
              // Pelz: weich, zottelig, Licht an den Haarspitzen
              float n = vN3(p * 700.0); hB = (n - 0.5) * 2.5 * aa; c *= 0.7 + 0.5 * n; c += c * pow(1.0 - nv, 2.0) * 0.8; hRough = 1.0;
            } else if (fab < 8.5) {
              hB = (vN3(p * 800.0) - 0.5) * 0.4 * aa; hRough = 0.92; c += c * 0.3 * pow(1.0 - nv, 3.0);
            } else if (fab < 9.5) {
              // Stroh: geflochtene Bänder
              float b = sin(atan(p.x, p.z) * 90.0) * sin(p.y * 600.0 + length(p.xz) * 600.0);
              hB = b * 0.6 * aa; c *= 0.85 + 0.2 * b * aa; hRough = 0.75;
            } else if (fab < 10.5) {
              // Pailletten: jede Paillette blitzt auf, wenn sie das Licht in die Kamera wirft
              vec3 cl = floor(p * 330.0); float r = clH(cl), r2 = clH(cl + 7.0);
              float facing = fract(r * 13.0 + dot(vd, vec3(5.3, 7.1, 3.7)) * (1.0 + r2) + uTime * 0.05);
              hSpark = smoothstep(0.94, 1.0, facing) * aa * (0.5 + 0.5 * r2);
              hB = (r - 0.5) * 0.6 * aa; c *= 0.75 + 0.35 * r; hRough = 0.3; hMetal = 0.35;
            } else if (fab < 11.5) {
              float rib = sin(atan(p.x, p.z) * 120.0); hB = rib * 0.6 * aa; c *= 0.9 + 0.1 * rib; hRough = 0.95;
            } else if (fab < 12.5) {
              hMetal = 1.0; hRough = 0.3;
            } else {
              // Seidenstrümpfe: Haut schimmert durch, an den Rändern dichter
              c = mix(c, c * 0.75, 1.0 - nv); c += vec3(0.08, 0.06, 0.05) * pow(1.0 - nv, 3.0); hRough = 0.45;
            }
            diffuseColor.rgb = c;
          }
          // Verschattung in Falten und Ecken: an den Schuhen, in den Achseln, unter dem Kinn, am Kragen
          float ao = 1.0 - 0.28 * (1.0 - smoothstep(0.0, 0.12, vClP.y));
          ao *= 1.0 - 0.22 * smoothstep(0.17, 0.12, abs(abs(vClP.x) - 0.17)) * smoothstep(1.02, 1.2, vClP.y) * (1.0 - smoothstep(1.3, 1.36, vClP.y));
          ao *= 1.0 - 0.25 * smoothstep(0.04, 0.0, abs(vClP.y - 1.47)) * step(abs(vClP.x), 0.09) * (1.0 - step(0.5, abs(fab - 1.0)) * 0.6);
          ao *= 1.0 - 0.12 * smoothstep(0.92, 0.88, vClP.y) * smoothstep(0.75, 0.88, vClP.y) * step(abs(vClP.x), 0.06);
          diffuseColor.rgb *= ao;
        }`;
// Glanz, Metall und Relief nach den Stoffarten
function humanShader(sh) {
  sh.uniforms.uTime = U.uTime; sh.uniforms.uFaces = { value: FACE_ATLAS }; sh.uniforms.uFaceMat = { value: FACE_MAT }; sh.uniforms.uWind = U.uWind;
  sh.vertexShader = HUM_VS_HEAD + sh.vertexShader
    .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n' + HUM_VS_RIG)
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + HUM_VS_POS);
  sh.fragmentShader = HUM_FS_HEAD + 'float hFemF(float idv) { return step(32.0, mod(idv, 64.0)); }\n' + sh.fragmentShader
    .replace('#include <color_fragment>', '#include <color_fragment>\n' + HUM_FS_COLOR)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n if (hRough >= 0.0) roughnessFactor = hRough;')
    .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n if (hMetal >= 0.0) metalnessFactor = hMetal;')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n { vec2 dh = vec2(dFdx(hB), dFdy(hB)) * 0.0022; normal = hPerturb(-vViewPosition, normal, dh, faceDirection); }')
    .replace('totalEmissiveRadiance *= vColor * 3.0;', 'totalEmissiveRadiance *= vColor * 3.0;\n totalEmissiveRadiance += diffuseColor.rgb * hSpark * 6.0 + vec3(1.0, 0.9, 0.7) * hSpark * 0.6;');
}

// Aussehen einer Figur in einer Zahl: Gesicht (0-63), Hautton (5), Haarfarbe (6)
function personLook(kind) {
  const female = kind === 'lady' || kind === 'gown' || kind === 'dress';
  const face = Math.floor(Math.random() * 32) + (female ? 32 : 0);
  const tone = [0, 0, 1, 1, 1, 2, 2, 3, 4][Math.floor(Math.random() * 9)], hair = Math.floor(Math.random() * 6);
  // Stoffmuster: 0 glatt, 1 Nadelstreifen, 2 Tweed, 3 Glencheck; Abendgarderobe und Livree bleiben glatt
  const pat = kind === 'gown' || kind === 'tux' || kind === 'livery' || kind === 'police' || kind === 'waiter' || kind === 'sailor' || kind === 'chauffeur' ? 0 : [0, 1, 1, 2, 2, 3][Math.floor(Math.random() * 6)];
  // Hutvariante, Frisur, Krawatte: je drei Möglichkeiten; ohne Hut eher in Abendgarderobe
  const hat = Math.floor(Math.random() * 3), style = Math.floor(Math.random() * 3), tie = Math.floor(Math.random() * 3);
  const acc = Math.floor(Math.random() * 4);
  return face + 64 * tone + 320 * hair + 1920 * pat + 7680 * hat + 23040 * style + 69120 * tie + 207360 * acc;
}
const glowTex = canvasTex(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

/* ---------- Umgebungslicht für Spiegelungen (Gold, Chrom, polierter Marmor) ---------- */
let ENV = null;
function buildEnv() {
  const es = new T.Scene();
  const sphere = new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.ShaderMaterial({ side: T.BackSide,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vP; void main(){ float y = vP.y; vec3 c = mix(vec3(0.05,0.035,0.02), vec3(0.03,0.09,0.11), smoothstep(-0.2, 0.6, y));
      c += vec3(0.9,0.6,0.3) * pow(max(0.0, 1.0 - abs(y - 0.15)*3.0), 3.0) * 0.5; gl_FragColor = vec4(c, 1.0); }` }));
  es.add(sphere);
  const panel = (x, y, z, w, h, c) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: c, side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
  panel(0, 6, 0, 5, 5, new T.Color(2.2, 1.6, 0.9));
  panel(7, 2, 3, 2, 4, new T.Color(1.6, 1.1, 0.6)); panel(-7, 2, -3, 2, 4, new T.Color(1.6, 1.1, 0.6));
  panel(3, 1, -8, 4, 1.5, new T.Color(0.4, 1.0, 1.0)); panel(-4, 0.5, 8, 4, 1, new T.Color(0.3, 0.9, 0.9));
  const pm = new T.PMREMGenerator(renderer);
  ENV = pm.fromScene(es, 0.03).texture;
  pm.dispose();
}
const MAT = {};
function stdMat(o) { const { env, envI, ...rest } = o; const m = new T.MeshStandardMaterial(rest); if (ENV && env !== false) { m.envMap = ENV; m.envMapIntensity = envI ?? 1; } return m; }
function getMats() {
  MAT.gold = stdMat({ color: 0xc9a258, metalness: 1, roughness: 0.4, emissive: 0x120b03, envI: 0.7 });
  MAT.brass = stdMat({ color: 0xb08a4a, metalness: 0.9, roughness: 0.38, emissive: 0x120a02 });
  MAT.chrome = stdMat({ color: 0xd8dde2, metalness: 1, roughness: 0.18 });
  MAT.carPaint = carPaintMat();
  MAT.cloth = paintMat({ color: 0xffffff, metalness: 0, roughness: 0.85, envI: 0.25, emissive: 0x100905 });
  // V17: Skelett, Gesten, Tänze und Stoffe im Shader (humanShader)
  { const pc = MAT.cloth.onBeforeCompile; MAT.cloth.onBeforeCompile = sh => { pc(sh); humanShader(sh); }; }
  MAT.black = stdMat({ color: 0x0b0a0c, metalness: 0.2, roughness: 0.35, envI: 0.6 });
}
// Farbiges Zusammenfügen: jedes Teil bekommt eine Farbe; reines Weiß (1,1,1) wird später durch die Instanzfarbe ersetzt
const PAINT = [1, 1, 1];
function mergeColored(parts) {
  const geos = parts.map(([g]) => { const isFace = g.userData.face; g = g.index ? g.toNonIndexed() : g; if (!isFace) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(-1), 2)); return g; });
  const merged = mergeGeos(geos);
  const col = new Float32Array(merged.attributes.position.count * 3);
  let o = 0;
  geos.forEach((g, i) => { const c = parts[i][1]; for (let k = 0; k < g.attributes.position.count; k++) col.set(c, (o + k) * 3); o += g.attributes.position.count; });
  merged.setAttribute('color', new T.BufferAttribute(col, 3));
  if (parts.some(p => p.length > 2)) {
    // Gliedmaßen für die Gehbewegung: (Glied, Höhe des Drehpunkts)
    const lb = new Float32Array(merged.attributes.position.count * 2); o = 0;
    geos.forEach((g, i) => { const q = parts[i]; for (let k = 0; k < g.attributes.position.count; k++) lb.set([q[2] || 0, q[3] || 0], (o + k) * 2); o += g.attributes.position.count; });
    merged.setAttribute('aLimb', new T.BufferAttribute(lb, 2));
    const op = new Float32Array(merged.attributes.position.count); o = 0;
    geos.forEach((g, i) => { op.fill(parts[i][4] || 0, o, o + g.attributes.position.count); o += g.attributes.position.count; });
    merged.setAttribute('aOpt', new T.BufferAttribute(op, 1));
  }
  return merged;
}
function paintMat(o) {
  const m = stdMat({ ...o, vertexColors: true });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor = color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor = mix(vColor, instanceColor.xyz, step(2.97, color.r + color.g + color.b));
      #endif`);
    // Eigenleuchten folgt der Farbe: Haut bekommt warmes Laternenlicht, dunkle Mäntel kaum
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= vColor * 3.0;');
  };
  return m;
}
// Autolack: Klarlack mit Glanzschicht, Chrom spiegelt, Reifen matt; dazu Türfugen, Zierlinie, Haubenschlitze und Straßenschmutz
function carPaintMat() {
  const m = new T.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.07, vertexColors: true });
  if (ENV) { m.envMap = ENV; m.envMapIntensity = 0.95; }
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute float aOpt; attribute vec4 aDmg; varying vec3 vObjP, vObjN, vSrc; varying float vCarVar, vDent;\nfloat dnH(vec3 p){ return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' + sh.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      vDent = 0.0;
      #ifdef USE_INSTANCING
      {
        // Beulen: je nach Seite werden Bleche eingedrückt und verknittert
        float fr = aDmg.x * smoothstep(0.7, 2.7, position.x), rr = aDmg.y * smoothstep(-0.7, -2.7, position.x);
        float lf = aDmg.z * smoothstep(0.25, 0.95, -position.z), rt = (1.0 - aDmg.w) * smoothstep(0.25, 0.95, position.z);
        vDent = max(max(fr, rr), max(lf, rt));
        vec3 nn = vec3(dnH(position * 9.0), dnH(position * 9.0 + 3.1), dnH(position * 9.0 + 7.7)) - 0.5;
        objectNormal = normalize(objectNormal + nn * vDent * 1.6);
      }
      #endif`).replace('#include <color_vertex>', `
      vColor = vec3(1.0);
      #ifdef USE_COLOR
        vColor = color; vSrc = color;
      #endif
      #ifdef USE_INSTANCING_COLOR
        vColor = mix(vColor, instanceColor.xyz, step(2.97, color.r + color.g + color.b));
      #endif
      vObjP = position; vObjN = normal;
      #ifdef USE_INSTANCING_COLOR
        vCarVar = floor(fract(sin(dot(instanceColor, vec3(127.1, 311.7, 74.7))) * 43758.5453) * 3.0);
      #else
        vCarVar = 0.0;
      #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING_COLOR
          float cv = floor(fract(sin(dot(instanceColor, vec3(127.1, 311.7, 74.7))) * 43758.5453) * 3.0);
          float dv = floor(fract(sin(dot(instanceColor, vec3(12.9898, 78.233, 37.719))) * 4375.8545) * 3.0);
          float pg = fract(sin(dot(instanceColor, vec3(93.98, 18.23, 57.71))) * 1375.8545);
          bool showP = aOpt < 0.5 || (aOpt > 19.5 ? pg > 0.62 : aOpt > 9.5 ? abs(aOpt - 10.0 - dv) < 0.1 : aOpt > 3.5 ? cv != 1.0 : abs(aOpt - 1.0 - cv) < 0.1);
          if (!showP) transformed = vec3(0.0);
        #endif
        #ifdef USE_INSTANCING
        {
          float fr = aDmg.x * smoothstep(0.7, 2.7, position.x), rr = aDmg.y * smoothstep(-0.7, -2.7, position.x);
          float lf = aDmg.z * smoothstep(0.25, 0.95, -position.z), rt = (1.0 - aDmg.w) * smoothstep(0.25, 0.95, position.z);
          float n1 = dnH(position * 7.0), n2 = dnH(position * 7.0 + 4.3), hi = step(0.75, position.y);
          transformed.x += -fr * (0.18 + 0.4 * n1) + rr * (0.18 + 0.35 * n1);
          transformed.y += (fr + rr) * (n2 - 0.35) * 0.16 * hi + (lf + rt) * (n2 - 0.5) * 0.06;
          transformed.z += lf * (0.1 + 0.22 * n2) - rt * (0.1 + 0.22 * n2);
        }
        #endif`);
    sh.fragmentShader = 'varying vec3 vObjP, vObjN, vSrc; varying float vCarVar, vDent;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float isPaint = step(2.97, vSrc.r + vSrc.g + vSrc.b);
        float isChrome = (1.0 - isPaint) * step(0.6, dot(vSrc, vec3(0.333))) * step(vSrc.r, vSrc.b);
        float isRubber = step(dot(vSrc, vec3(0.333)), 0.035) * step(abs(vSrc.b - vSrc.r), 0.005);
        float side = step(0.6, abs(vObjN.z));
        // Türfugen und Zierlinie an den Flanken, Lüftungsschlitze an der Haube
        float seam = side * step(0.62, vObjP.y) * step(vObjP.y, 1.3) * (step(abs(vObjP.x - 0.56), 0.008) + step(abs(vObjP.x + 0.98), 0.008) + step(abs(vObjP.y - 0.66), 0.006) * step(vObjP.x, 0.56) * step(-0.98, vObjP.x));
        float louv = side * step(1.0, vObjP.x) * step(vObjP.x, 2.05) * step(0.84, vObjP.y) * step(vObjP.y, 1.08) * step(0.6, fract(vObjP.x * 12.0));
        float stripe = side * step(abs(vObjP.y - 1.17), 0.007);
        float dirt = smoothstep(0.78, 0.42, vObjP.y) * 0.45;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.18, isPaint * clamp(seam + louv * 0.8, 0.0, 1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.62, 0.28), isPaint * stripe * step(vCarVar, 1.5));
        // Taxi: Schachbrettband an den Flanken, Haube in Kontrastfarbe
        float taxi = step(1.5, vCarVar) * isPaint;
        float chk = side * step(abs(vObjP.y - 1.0), 0.06) * step(-2.0, vObjP.x) * step(vObjP.x, 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.02), vec3(0.9, 0.86, 0.75), step(0.5, fract(floor(vObjP.x * 16.0) * 0.5 + floor((vObjP.y - 0.94) * 16.0) * 0.5))), taxi * chk);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.75, 0.55, 0.08), taxi * step(0.62, vObjP.x) * step(0.65, vObjP.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.08, 0.07), isPaint * dirt);
        // Kratzer und abgeplatzter Lack an den Beulen: blankes Blech und Grundierung
        float scr = step(0.55, fract(sin(dot(floor(vObjP.xy * vec2(60.0, 9.0)), vec2(12.9898, 78.233))) * 43758.5453)) * smoothstep(0.15, 0.6, vDent);
        diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.42, 0.42, 0.44), vec3(0.3, 0.22, 0.18), step(0.5, fract(vObjP.y * 13.0))), isPaint * scr * 0.85);
        diffuseColor.rgb *= 1.0 - 0.35 * smoothstep(0.3, 0.9, vDent) * isPaint;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.1, isChrome); roughnessFactor = mix(roughnessFactor, 0.92, isRubber); roughnessFactor = mix(roughnessFactor, 0.7, isPaint * dirt);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 1.0, isChrome); metalnessFactor *= 1.0 - isRubber;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.clearcoat *= isPaint * (1.0 - dirt);`);
  };
  return m;
}

/* ---------- Kollision: achsenparallele Quader in einem Raster ---------- */
const CELL = 40;
const colGrid = new Map();
function addCollider(x0, y0, z0, x1, y1, z1) {
  if (SINK) return;
  const b = { x0, y0, z0, x1, y1, z1 };
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++)
    for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
      const k = ix + ',' + iz;
      let a = colGrid.get(k); if (!a) colGrid.set(k, a = []);
      a.push(b);
    }
  return b;
}
function nearBoxes(x, z, r) {
  const out = new Set();
  for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
    for (let iz = Math.floor((z - r) / CELL); iz <= Math.floor((z + r) / CELL); iz++) {
      const a = colGrid.get(ix + ',' + iz); if (a) for (const b of a) out.add(b);
    }
  return out;
}
