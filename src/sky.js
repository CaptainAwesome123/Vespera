import { T, U, scene, LOW } from './core.js';

/* =====================================================================
   HIMMEL DER POLARNACHT (V25): Vespera liegt am Nordpol, die Sonne geht nie auf.
   Der Sternhimmel dreht sich um den Zenit (der Polarstern steht senkrecht oben),
   der Mond zieht flach um den Horizont und zeigt seine Phase, darüber das Polarlicht.
   Bewölkung, Nebel und Niederschlag aus atmosphere.js (uCloud, uMist, uRain, uSnow).
   ===================================================================== */
export function buildSky() {
  const sky = new T.Mesh(new T.SphereGeometry(9000, 48, 24), new T.ShaderMaterial({
    uniforms: U, side: T.BackSide, depthWrite: false, fog: false,
    defines: LOW ? { SKY_LITE: 1 } : {},
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uMoonDir; uniform vec3 uFogColor; uniform float uTime; uniform float uAurora; uniform float uCloud; uniform float uMoonPhase; uniform float uMoonLit; uniform float uMist; uniform float uRain; uniform float uSnow;
      varying vec3 vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float hash3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      // Polarlicht: Vorhänge, deren Unterkante über den Himmel wogt; unten grün, darüber türkis, oben ein Hauch Violett
      vec3 curtain(vec2 ring, float elev, float k, float t){
        float base = 0.1 + 0.16 * vnoise(ring * 1.6 + vec2(k * 5.0, t * 0.012)) + 0.05 * vnoise(ring * 5.0 - t * 0.02);
        float s = (elev - base) / (0.26 + 0.1 * vnoise(ring * 2.0 + k));
        if (s < -0.05 || s > 1.2) return vec3(0.0);
        float body = smoothstep(-0.05, 0.03, s) * exp(-s * 2.6);
        float rays = 0.45 + 0.55 * pow(vnoise(ring * 46.0 + vec2(k * 9.0, t * 0.25)), 2.0);
        float fold = smoothstep(0.25, 0.75, vnoise(ring * 2.6 + vec2(t * 0.02, k * 3.0)));
        vec3 c = mix(vec3(0.12, 1.0, 0.45), vec3(0.08, 0.75, 0.85), smoothstep(0.1, 0.5, s));
        c = mix(c, vec3(0.5, 0.2, 0.75), smoothstep(0.55, 1.0, s) * 0.7);
        return c * body * rays * fold;
      }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 top = vec3(0.003, 0.009, 0.024), mid = vec3(0.016, 0.06, 0.085);
        vec3 col = mix(uFogColor*1.6, mid, smoothstep(0.0, 0.2, y));
        col = mix(col, top, smoothstep(0.15, 0.8, y));
        col += vec3(0.1, 0.42, 0.44) * exp(-abs(y)*8.0) * 0.5;
        col += vec3(0.25, 0.16, 0.06) * exp(-abs(y)*30.0) * 0.5;
        // ein ganz schwacher Dämmerschimmer tief im Süden: die Sonne bleibt weit unter dem Horizont
        vec2 hz = normalize(d.xz + 1e-5);
        col += vec3(0.02, 0.05, 0.09) * exp(-max(y, 0.0) * 7.0) * pow(max(dot(hz, vec2(0.0, 1.0)), 0.0), 3.0) * 0.55;
        // Lichtsäulen am Horizont
        float ang = atan(d.z, d.x);
        float shaft = pow(hash(vec2(floor(ang*28.0), 1.0)), 3.0) * smoothstep(0.5, 0.0, abs(fract(ang*28.0) - 0.5)*2.0);
        col += vec3(0.2, 0.55, 0.6) * shaft * exp(-max(y, 0.0)*4.5) * 0.6 * (1.0 + uMist * 0.4);
        float clear = 1.0 - uCloud;
        // Sterne: dreidimensionales Raster (keine Naht, kein Zusammenlaufen am Zenit); der Himmel dreht sich in 24 Spielstunden um den Pol
        float rot = uTime * 6.2831853 / 1436.0, cr = cos(rot), sr = sin(rot);
        vec3 sd = vec3(cr * d.x - sr * d.z, d.y, sr * d.x + cr * d.z);
        vec3 sp = sd * 230.0, cell = floor(sp), f = fract(sp) - 0.5;
        float h = hash3(cell);
        float star = step(0.985, h) * smoothstep(0.3, 0.0, length(f)) * smoothstep(0.03, 0.25, y);
        star *= 0.65 + 0.35 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
        vec3 starC = mix(vec3(1.0, 0.85, 0.7), vec3(0.75, 0.85, 1.0), fract(h * 57.0));
        // Milchstraße: ein schwaches Band mit Sternwolken
        float mw = exp(-pow(dot(sd, normalize(vec3(0.35, 0.45, 0.82))), 2.0) * 22.0);
        float mwn = vnoise(sd.xz * 9.0 / (abs(sd.y) + 0.6)) * 0.6 + vnoise(sd.xy * 23.0) * 0.4;
        vec3 stars = starC * star * (0.6 + 2.2 * fract(h * 91.0)) + vec3(0.05, 0.07, 0.1) * mw * mwn * smoothstep(0.05, 0.4, y);
        stars += vec3(1.0, 0.95, 0.88) * smoothstep(0.99995, 0.999995, y) * 3.0;   // Polarstern im Zenit
        col += stars * clear * clear * (1.0 - 0.6 * min(uMist, 1.0)) * (1.0 - 0.5 * uMoonLit * pow(max(dot(d, uMoonDir), 0.0), 8.0));
        // Polarlicht
        if (uAurora > 0.01 && y > 0.02) {
          float elev = asin(clamp(y, 0.0, 1.0)), t = uTime;
          vec2 ring = vec2(cos(ang), sin(ang));
          vec3 au = curtain(ring, elev, 0.0, t);
          #ifndef SKY_LITE
          au += curtain(ring * 1.3 + 4.0, elev - 0.1, 1.0, t) * 0.7;
          #endif
          // V38: Helligkeitswellen laufen langsam durch den Vorhang (das Polarlicht atmet)
          au *= 0.7 + 0.3 * sin(ang * 3.0 + t * 0.09) * sin(elev * 7.0 - t * 0.05) + 0.15 * sin(t * 0.21);
          col += au * uAurora * clear * 0.42 * (1.0 - 0.7 * min(uMist, 1.0) * smoothstep(0.5, 0.1, y));
          col += vec3(0.02, 0.09, 0.06) * uAurora * clear * exp(-y * 3.0) * 0.4;   // grüner Widerschein am Horizont
        }
        // Wolken: bei Regen und Schnee eine geschlossene Decke, die das Stadtlicht von unten anstrahlt
        vec2 cp = d.xz / (abs(y) + 0.15) * 2.2 + vec2(uTime*0.004, 0.0);
        float cl = vnoise(cp)*0.55 + vnoise(cp*2.3 + 5.0)*0.3 + vnoise(cp*5.0 + 9.0)*0.15;
        float cloud = smoothstep(0.62 - 0.45 * uCloud, 0.85 - 0.4 * uCloud, cl) * smoothstep(0.02, 0.25, y);
        float md = dot(d, normalize(uMoonDir));
        vec3 cloudC = vec3(0.04, 0.085, 0.11) + uFogColor * (0.6 + 0.8 * exp(-y * 4.0)) + vec3(0.25, 0.25, 0.3) * pow(max(md, 0.0), 6.0) * uMoonLit * (1.0 - uCloud * 0.6);
        col = mix(col, cloudC, cloud * (0.55 + 0.4 * uCloud));
        // zarte Lichtschleier
        float veil = sin(d.x*3.0 + d.z*2.0 + uTime*0.01)*0.5 + 0.5;
        col += vec3(0.05, 0.09, 0.12) * smoothstep(0.2, 0.5, y) * (1.0 - smoothstep(0.5, 0.9, y)) * veil * 0.35;
        // Mond mit Phase: Kugel, von der Sonne (unter dem Horizont) seitlich beleuchtet; Meere als dunklere Flecken, Erdschein im Dunkelteil
        vec3 M = normalize(uMoonDir), mr = normalize(cross(M, vec3(0.0, 1.0, 0.0))), mu = cross(mr, M);
        float rad = 0.022;
        vec2 mq = vec2(dot(d, mr), dot(d, mu)) / rad;
        float mlen = length(mq);
        float hide = cloud * (0.5 + 0.5 * uCloud);
        if (md > 0.0 && mlen < 1.0) {
          vec3 n = vec3(mq, sqrt(1.0 - mlen * mlen));
          float th = uMoonPhase * 6.2831853;
          vec3 L = vec3(sin(th), 0.0, -cos(th));
          float lit = smoothstep(-0.04, 0.12, dot(n, L));
          float alb = 0.78 + 0.22 * smoothstep(0.35, 0.65, vnoise(mq * 2.6 + 3.0)) - 0.18 * smoothstep(0.5, 0.75, vnoise(mq * 1.4 + 9.0));
          vec3 disc = vec3(1.0, 0.95, 0.84) * alb * (lit * 1.5 + 0.035) * smoothstep(1.0, 0.92, mlen);
          col = mix(col, disc + col * 0.2, smoothstep(1.0, 0.94, mlen) * (1.0 - hide));
        }
        col += (vec3(0.5, 0.45, 0.6) * pow(max(md, 0.0), 400.0) * 0.6 + vec3(0.18, 0.16, 0.3) * pow(max(md, 0.0), 24.0) * 0.4) * uMoonLit * (1.0 - hide * 0.7);
        // dichter Nebel und Niederschlag schlucken den Horizont
        col = mix(col, uFogColor * 1.7, clamp(uMist * 0.35 + (uRain + uSnow) * 0.25, 0.0, 0.8) * smoothstep(0.55, 0.0, y));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}
