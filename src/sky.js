'use strict';
/* =====================================================================
   HIMMEL: Nachtverlauf, Sterne, Mond, Schein der Stadt am Horizont
   ===================================================================== */
function buildSky() {
  const sky = new T.Mesh(new T.SphereGeometry(9000, 48, 24), new T.ShaderMaterial({
    uniforms: U, side: T.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uMoonDir; uniform vec3 uFogColor; uniform float uTime; varying vec3 vD;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main(){
        vec3 d = normalize(vD); float y = d.y;
        vec3 top = vec3(0.004, 0.012, 0.03), mid = vec3(0.02, 0.07, 0.1);
        vec3 col = mix(uFogColor*1.6, mid, smoothstep(0.0, 0.2, y));
        col = mix(col, top, smoothstep(0.15, 0.8, y));
        col += vec3(0.1, 0.4, 0.45) * exp(-abs(y)*8.0) * 0.5;
        col += vec3(0.25, 0.16, 0.06) * exp(-abs(y)*30.0) * 0.5;
        // Lichtsäulen am Horizont
        float ang = atan(d.z, d.x);
        float shaft = pow(hash(vec2(floor(ang*28.0), 1.0)), 3.0) * smoothstep(0.5, 0.0, abs(fract(ang*28.0) - 0.5)*2.0);
        col += vec3(0.2, 0.55, 0.6) * shaft * exp(-max(y, 0.0)*4.5) * 0.6;
        // dünne Wolkenbänder
        vec2 cp = d.xz / (abs(y) + 0.15) * 2.2 + vec2(uTime*0.004, 0.0);
        float cl = vnoise(cp)*0.55 + vnoise(cp*2.3 + 5.0)*0.3 + vnoise(cp*5.0 + 9.0)*0.15;
        float cloud = smoothstep(0.52, 0.78, cl) * smoothstep(0.04, 0.25, y) * (1.0 - smoothstep(0.6, 0.95, y));
        col = mix(col, vec3(0.05, 0.1, 0.13) + vec3(0.25, 0.25, 0.3)*pow(max(dot(d, normalize(uMoonDir)), 0.0), 6.0), cloud*0.75);
        // zarte Lichtschleier
        float veil = sin(d.x*3.0 + d.z*2.0 + uTime*0.01)*0.5 + 0.5;
        col += vec3(0.05, 0.09, 0.12) * smoothstep(0.2, 0.5, y) * (1.0 - smoothstep(0.5, 0.9, y)) * veil * 0.35;
        // Sterne
        vec2 sp = vec2(atan(d.z, d.x), asin(clamp(y, -1.0, 1.0))) * 260.0;
        vec2 cell = floor(sp); vec2 f = fract(sp) - 0.5;
        float h = hash(cell);
        float star = step(0.992, h) * smoothstep(0.32, 0.0, length(f)) * smoothstep(0.06, 0.3, y);
        star *= 0.6 + 0.4*sin(uTime*(1.0 + h*3.0) + h*40.0);
        col += vec3(1.0, 0.95, 0.85) * star * (0.6 + 2.0*fract(h*91.0));
        // Mond
        float md = dot(d, normalize(uMoonDir));
        col += vec3(1.0, 0.94, 0.8) * smoothstep(0.99972, 0.9998, md) * 1.4;
        col += vec3(0.5, 0.45, 0.6) * pow(max(md, 0.0), 400.0) * 0.6 + vec3(0.18, 0.16, 0.3) * pow(max(md, 0.0), 24.0) * 0.4;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  sky.renderOrder = -10;
  scene.add(sky);
  return sky;
}
