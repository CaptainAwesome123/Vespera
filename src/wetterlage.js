/* =====================================================================
   V63 · WETTEREREIGNISSE
   Ab und zu kündigt die Wetterwarte ein besonderes Wetter an (Hinweis, Banner,
   Kasten im Vespera-Kurier); eine gute Minute später ist es da und bleibt vier bis
   sechs Minuten. Immer Polarnacht (Kanon): es wechselt nur die Nacht.
   - SCHNEESTURM: dichtes Treiben (V54), Leute eilen nach drinnen, wer draußen
     steht, friert; weniger und langsamere Wagen, Bahnen und Boote fahren
     vorsichtig. Kohle wird teuer (Kontor). Gestrandete und eine im Schnee
     steckende Straßenbahn brauchen Alexander.
   - NORDLICHTNACHT: großes Polarlicht, die Leute bleiben stehen und zeigen
     hinauf, auf dem Belmont-Platz sammelt sich eine Menge. Fliegt Alexander
     über sie hinweg, gibt es Beifall (Ruf).
   - EISGANG: Eisschollen treiben auf dem See und im Hafen (eine Instanzliste,
     Standard-Material), Eisglitzern, knackendes Eis, Boote fahren langsam.
     Ein Fischer treibt auf einer Scholle: hinfliegen und ihn holen.
   - FROSTNEBEL: sehr dichter türkiser Nebel, Eisblumen, wenig Verkehr;
     jemand hat sich im Nebel verirrt.
   - METEORITENSCHAUER über dem Krater: Sternschnuppen (ein winziger
     Shader, 28 Striche), die Leute zeigen hinauf, der Kristall im Penthouse
     glimmt bei jeder hellen Schnuppe auf. Ein glühender Splitter schlägt in
     der Stadt ein: aufheben und dem Museum schenken (Ruf).
   Bei Kälte (Sturm, Eisgang, Frostnebel) stehen Punschwagen an den Cafés:
   E spendiert eine Runde für alle.
   Die Stadt reagiert auch, wenn das Wetter von selbst so wird (Taste N oder
   Wetterwechsel), nur Ankündigung, Aufgaben, Preise und Menge gibt es allein
   beim Ereignis. Pausenmenü, Gruppe „Wetter“: jedes Ereignis von Hand auslösen.
   URL ?ereignis=sturm|nordlicht|eisgang|frostnebel|meteore startet sofort.
   Leute werden nicht neu erzeugt: wer gerade in einem Laden sitzt (unsichtbar),
   wird für Menge, Händler und Aufgaben ausgeliehen und danach zurückgegeben.
   ===================================================================== */
import { T, U, scene, camera, MOBILE, LOW, renderer, $, shared } from './core.js';
import { player } from './player.js';
import { playing, paused } from './input.js';
import { toast } from './boat.js';
import { ATMO, WEATHERS, roofAt } from './atmosphere.js';
import { peds, pedCrowd, setAct, CHATS, loopRound } from './serpentine.js';
import { DOORS } from './entrances.js';
import { TRF, trams, tramMesh } from './traffic.js';
import { PLAZA, landDist } from './island.js';
import { terrainHeight } from './harbour.js';
import { WATER_Y } from './dance.js';
import { waterH } from './water.js';
import { WIND } from './wind.js';
import { fxEmit } from './particles.js';
import { makeGlowPoints, FIRST_M, FIRST_F, LAST } from './ragdoll.js';
import { CRY } from './crystal.js';
import { lifeSay } from './life.js';
import { INTERACT } from './music.js';
import { SND, audioCtx, audioBus } from './audio.js';
import { zeitungMeldung, zeitungKasten } from './zeitung.js';
import { KT, EVENTS, ktCash, ktChanged } from './kontor.js';
import { RUF, rufAdd } from './ruf.js';
import { addTasten } from './pausemenu.js';
import { KARTE } from './karte.js';

/* ---------- Die Ereignisse ---------- */
// w: Wetterlage (atmosphere.js), after: Wetter danach, kt: Anfang eines Kontor-Ereignisses (Preise), car/tram/boat: Tempo,
// hide: Anteil ausgeblendeter Wagen, inside: Anteil der Passanten, die nach drinnen gehen, hurry: Schritttempo draußen
export const WL_EV = {
  sturm: {
    gen: 'des Schneesturms', hero: 'Der Retter in der Sturmnacht', n: 'Schneesturm', w: 'sturm', after: 'schnee', dur: [270, 350], cold: 1, kt: 'Kältewelle', car: 0.55, hide: 0.4, tram: 0.5, boat: 0.5, inside: 0.6, hurry: 1.5, wgt: 3,
    warn: 'Wetterwarte Vespera: Ein Schneesturm zieht über die Berge heran. In einer Minute ist er in der Stadt.',
    sub: 'Gestrandete und eine Straßenbahn stecken im Schnee fest', tasks: ['leute', 'leute', 'bahn'],
    news: ['Schneesturm über Vespera', 'Ein Schneesturm fegt über den Krater. Die Wetterwarte rät: Mantel zu, Hut fest und nach Hause. Kohlenhändler melden Rekordumsätze.'],
  },
  nordlicht: {
    gen: 'der Nordlichtnacht', hero: 'Ein Held unter dem Nordlicht', n: 'Nordlichtnacht', w: 'nordlicht', after: 'polarlicht', dur: [230, 300], look: 1, gather: 1, kt: 'Nordlicht über dem Krater', wgt: 3,
    warn: 'Wetterwarte Vespera: Sonnensturm gemeldet! Heute Nacht wird das Nordlicht so hell wie seit Jahren nicht.',
    sub: 'Die Stadt versammelt sich auf dem Belmont-Platz', tasks: [],
    news: ['Nordlichtnacht: ganz Vespera schaut hinauf', 'Grüne und rosa Vorhänge über dem Krater: Tausende versammelten sich auf dem Belmont-Platz und auf den Straßen, um das Schauspiel zu sehen.'],
  },
  eisgang: {
    gen: 'des Eisgangs', hero: 'Rettung auf dem Kratersee', n: 'Eisgang', w: 'eisgang', after: 'frost', dur: [270, 340], cold: 1, floes: 1, kt: 'Eisgang im Hafen', car: 0.85, boat: 0.4, inside: 0.25, hurry: 1.2, wgt: 2,
    warn: 'Wetterwarte Vespera: Das Eis auf dem Kratersee bricht auf. Bootsführer, Vorsicht im Hafen!',
    sub: 'Schollen treiben auf dem See, ein Fischer sitzt fest', tasks: ['scholle'],
    news: ['Eisgang auf dem Kratersee', 'Das Eis bricht: Schollen treiben durch den Hafen, die Wassertaxis fahren im Schritttempo. Die Hafenmeisterei bittet um Vorsicht.'],
  },
  frostnebel: {
    gen: 'des Frostnebels', hero: 'Ein Lichtblick im Frostnebel', n: 'Frostnebel', w: 'frostnebel', after: 'dunst', dur: [230, 300], cold: 1, car: 0.65, hide: 0.25, tram: 0.7, boat: 0.6, inside: 0.35, hurry: 1.25, wgt: 2,
    warn: 'Wetterwarte Vespera: Eisiger Nebel steigt aus dem See. Die Sicht wird sehr schlecht.',
    sub: 'Jemand hat sich im Nebel verirrt', tasks: ['verirrt'],
    news: ['Frostnebel legt sich über die Stadt', 'Türkiser Eisnebel kroch aus dem Kratersee bis zum Belmont hinauf. Die Fenster der Stadt trugen Eisblumen wie selten.'],
  },
  meteore: {
    gen: 'des Meteoritenschauers', hero: 'Ein Stern für das Museum', n: 'Meteoritenschauer', w: 'meteore', after: 'klar', dur: [200, 260], look: 1, gather: 1, meteors: 1, wgt: 2,
    warn: 'Wetterwarte Vespera: Klare Luft und ein Meteoritenschauer über dem Krater! Die Sternwarte rät: hinaufschauen.',
    sub: 'Sternschnuppen über dem Krater', tasks: ['splitter'],
    news: ['Sternschnuppen über dem Krater', 'Ein Meteoritenschauer zog über Vespera, genau über dem Krater, in dem einst alles begann. Viele Bürger wünschten sich etwas.'],
  },
};
const WL_WX = { sturm: 'sturm', nordlicht: 'nordlicht', eisgang: 'eisgang', frostnebel: 'frostnebel', meteore: 'meteore' };   // Wetter -> Ereignis (Reaktion der Stadt)

export const WL = {
  ready: false, ev: null, E: null, t: 0, end: 0, next: 0, warn: null, warnT: 0, last: null, mine: false,
  mode: null, modeT: 0, tick: 0, scan: 0, mods: new Map(), chats: new Map(), cars: new Map(), hid: new Set(), chk: new Set(), pchk: new Set(), trams: new Map(),
  tasks: [], done: 0, flyCheer: false, carts: [], vendT: 0, crackT: 3, banT: 0, met: 0, fl: null, box: null, pile: null, glow: null,
  boat: 1, count: {}, endT: 0, lastTime: 0, mk: null, items: [],
};
const wlR = (a, b) => a + Math.random() * (b - a);
const wlPick = L => L[Math.floor(Math.random() * L.length)];
const wlD2 = (x, z) => (x - player.p.x) ** 2 + (z - player.p.z) ** 2;
const wlCam2 = (x, z) => (x - camera.position.x) ** 2 + (z - camera.position.z) ** 2;

/* ---------- Neue Wetterlagen (nur über Ereignisse oder Taste N, nie vom Zufall) ---------- */
function wlWeathers() {
  const add = w => { if (!WEATHERS.some(x => x.id === w.id)) WEATHERS.push(w); };
  add({ id: 'eisgang', name: 'Eisgang', fog: 1.0, cloud: 0.12, aurora: 0.55, rain: 0, snow: 0, frost: 1, tint: [0.034, 0.13, 0.152], w: 0 });
  add({ id: 'frostnebel', name: 'Frostnebel', fog: 3.1, cloud: 0.45, aurora: 0.08, rain: 0, snow: 0, frost: 1, tint: [0.04, 0.155, 0.168], w: 0 });
  add({ id: 'meteore', name: 'Meteoritenschauer', fog: 0.6, cloud: 0.0, aurora: 0.3, rain: 0, snow: 0, frost: 0.35, tint: [0.028, 0.122, 0.138], w: 0 });
}
wlWeathers();
const wlWeather = id => WEATHERS.find(w => w.id === id);

/* =====================================================================
   1) TEILE IN DER WELT: Schollen, Schneewehen, Punschwagen (ein Material, Instanzen), Sternschnuppen, Lichter
   ===================================================================== */
const WL_FLOES = LOW ? 70 : 150, WL_BOX = 80, WL_PILE = 30, WL_GLOW = 8, WL_MET = MOBILE ? 16 : 28;
function wlFloeGeo() {
  const g = new T.CylinderGeometry(1, 1, 0.42, 8, 1), p = g.attributes.position, rr = [];
  for (let k = 0; k < 9; k++) rr.push(0.7 + Math.random() * 0.45);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); if (r < 1e-3) continue;
    const a = Math.atan2(z, x), k = Math.round(((a + Math.PI) / (Math.PI * 2)) * 8) % 8, f = rr[k] * (p.getY(i) > 0 ? 1 : 0.92);
    p.setXYZ(i, x * f, p.getY(i), z * f);
  }
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
}
function wlBuildWorld() {
  const mat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0.05 });
  const mk = (geo, n) => {
    const m = new T.InstancedMesh(geo, mat, n); m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.frustumCulled = false; m.count = 0;
    m.setColorAt(0, new T.Color(1, 1, 1)); scene.add(m); return m;
  };
  WL.fl = { m: mk(wlFloeGeo(), WL_FLOES), x: new Float32Array(WL_FLOES), z: new Float32Array(WL_FLOES), r: new Float32Array(WL_FLOES), s: new Float32Array(WL_FLOES),
    e: new Float32Array(WL_FLOES), vx: new Float32Array(WL_FLOES), vz: new Float32Array(WL_FLOES), wr: new Float32Array(WL_FLOES), ok: new Uint8Array(WL_FLOES), k: 0, sink: 1, y: new Float32Array(WL_FLOES) };
  const c = new T.Color();
  for (let i = 0; i < WL_FLOES; i++) WL.fl.m.setColorAt(i, c.setRGB(0.78 + Math.random() * 0.12, 0.88 + Math.random() * 0.08, 0.95));
  WL.box = mk(new T.BoxGeometry(1, 1, 1), WL_BOX);
  WL.pile = mk(new T.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), WL_PILE);
  for (let i = 0; i < WL_PILE; i++) WL.pile.setColorAt(i, c.setRGB(0.9, 0.94, 0.98));
  const gl = []; for (let i = 0; i < WL_GLOW; i++) gl.push({ p: [0, -1000, 0], c: [2.0, 1.25, 0.55], s: 1.1, ph: Math.random(), bl: 0 });
  WL.glow = makeGlowPoints(gl, true); scene.add(WL.glow);
  WL.met = wlMeteors();
}
// Sternschnuppen: kurze Striche hoch am Himmel, ganz im Vertex-Shader (kein Branching im Fragment, keine Texturen)
function wlMeteors() {
  const g = new T.InstancedBufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0]), 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  const s = new Float32Array(WL_MET * 4); for (let i = 0; i < s.length; i++) s[i] = Math.random();
  g.setAttribute('aSeed', new T.InstancedBufferAttribute(s, 4)); g.instanceCount = WL_MET;
  const uni = { uTime: U.uTime, uCam: U.uCam, uInside: U.uInside, uMeteor: { value: 0 } };
  const m = new T.Mesh(g, new T.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform vec3 uCam; uniform float uInside; uniform float uMeteor; varying float vA; varying vec2 vQ;
      void main(){
        float per = 5.0 + aSeed.w * 11.0, c = uTime / per + aSeed.x, cyc = floor(c), life = 0.5 + aSeed.y * 0.9, k = fract(c) * per / life;
        if (k > 1.0 || aSeed.z > uMeteor || uInside > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        float h1 = fract(sin(cyc * 12.99 + aSeed.y * 78.23) * 43758.5), h2 = fract(sin(cyc * 4.13 + aSeed.w * 19.7) * 9631.7);
        float a = h1 * 6.2832, e = 0.42 + 0.62 * h2;
        vec3 s = vec3(cos(a) * cos(e), sin(e), sin(a) * cos(e));
        vec3 up = normalize(vec3(0.0, 1.0, 0.0) - s * s.y), side = normalize(cross(s, up));
        vec3 dir = normalize(-up + side * (h1 - 0.5) * 1.2);
        float R = 2400.0, big = step(0.9, h2);
        vec3 head = s + dir * 0.22 * k, tail = head - dir * (0.05 + 0.06 * big) * min(1.0, k * 3.0);
        vec3 wp = uCam + mix(head, tail, position.y) * R + side * position.x * R * (0.0014 + 0.0016 * big);
        vQ = position.xy; vA = sin(k * 3.1416) * (0.8 + 1.6 * big);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `varying float vA; varying vec2 vQ;
      void main(){ float t = 1.0 - vQ.y, a = t * t * (1.0 - abs(vQ.x) * 2.0) * vA;
        gl_FragColor = vec4(mix(vec3(0.45, 1.0, 0.9), vec3(1.0, 0.96, 0.86), t) * a * 1.6, 1.0); }`,
  }));
  m.frustumCulled = false; m.renderOrder = 4; m.userData.noRefl = true; scene.add(m);
  return m;
}
// Teile des Punschwagens und des Meteoritensplitters als Kästen: [x, y, z, sx, sy, sz, r, g, b]
const WL_CART = [
  [0, 0.75, 0, 1.7, 0.8, 0.8, 0.32, 0.07, 0.07], [0, 1.18, 0, 1.82, 0.06, 0.92, 0.75, 0.55, 0.26], [0, 0.32, 0, 1.6, 0.08, 0.76, 0.06, 0.05, 0.05],
  [0.4, 0.3, 0.45, 0.62, 0.62, 0.06, 0.08, 0.07, 0.06], [0.4, 0.3, -0.45, 0.62, 0.62, 0.06, 0.08, 0.07, 0.06],
  [-0.84, 1.62, 0.4, 0.05, 0.9, 0.05, 0.75, 0.55, 0.26], [0.84, 1.62, 0.4, 0.05, 0.9, 0.05, 0.75, 0.55, 0.26], [-0.84, 1.62, -0.4, 0.05, 0.9, 0.05, 0.75, 0.55, 0.26], [0.84, 1.62, -0.4, 0.05, 0.9, 0.05, 0.75, 0.55, 0.26],
  [0, 2.1, 0, 2.05, 0.08, 1.12, 0.86, 0.8, 0.66], [0, 1.99, 0.56, 2.05, 0.16, 0.02, 0.05, 0.32, 0.31], [0, 1.99, -0.56, 2.05, 0.16, 0.02, 0.05, 0.32, 0.31],
  [-0.45, 1.4, 0, 0.38, 0.4, 0.38, 0.62, 0.3, 0.14], [0.3, 1.24, 0.2, 0.08, 0.1, 0.08, 0.9, 0.88, 0.8], [0.45, 1.24, 0.15, 0.08, 0.1, 0.08, 0.9, 0.88, 0.8],
];
const _wm = new T.Matrix4(), _wlq = new T.Quaternion(), _wp = new T.Vector3(), _ws = new T.Vector3(), _we = new T.Euler(), _wc = new T.Color(), _wv = new T.Vector3();
// alle Kästen neu setzen (Wagen und Splitter); selten, nur wenn sich etwas ändert
function wlBoxes() {
  const B = WL.box; let n = 0;
  const put = (x, y, z, yaw, P, k = 1) => {
    if (n >= WL_BOX) return;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    _wp.set(x + P[0] * c + P[2] * s, y + P[1] * k, z - P[0] * s + P[2] * c); _wlq.setFromAxisAngle(_ws.set(0, 1, 0), yaw); _ws.set(P[3] * k, P[4] * k, P[5] * k);
    B.setMatrixAt(n, _wm.compose(_wp, _wlq, _ws)); B.setColorAt(n, _wc.setRGB(P[6], P[7], P[8])); n++;
  };
  for (const C of WL.carts) for (const P of WL_CART) put(C.x, C.y, C.z, C.yaw, P);
  for (const tk of WL.tasks) if (tk.k === 'splitter' && tk.landed && !tk.done) { put(tk.x, tk.y, tk.z, 0.7, [0, 0.18, 0, 0.42, 0.36, 0.38, 0.12, 0.08, 0.07]); put(tk.x, tk.y, tk.z, 0.1, [0.05, 0.25, 0.04, 0.3, 0.3, 0.3, 0.55, 0.18, 0.05]); }
  B.count = n; B.instanceMatrix.needsUpdate = true; if (B.instanceColor) B.instanceColor.needsUpdate = true;
}
// Schneewehen: an Gestrandeten und vor der Bahn
function wlPiles() {
  const P = WL.pile; let n = 0;
  for (const tk of WL.tasks) {
    if (tk.done || !tk.piles) continue;
    for (const q of tk.piles) { if (n >= WL_PILE) break; _wp.set(q[0], q[1], q[2]); _wlq.setFromAxisAngle(_ws.set(0, 1, 0), q[6]); _ws.set(q[3], q[4], q[5]); P.setMatrixAt(n++, _wm.compose(_wp, _wlq, _ws)); }
  }
  P.count = n; P.instanceMatrix.needsUpdate = true;
}
function wlGlows() {
  const a = WL.glow.geometry.attributes.position, col = WL.glow.geometry.attributes.color; let n = 0;
  const put = (x, y, z, c) => { if (n >= WL_GLOW) return; a.setXYZ(n, x, y, z); col.setXYZ(n, c[0], c[1], c[2]); n++; };
  for (const C of WL.carts) { const c = Math.cos(C.yaw), s = Math.sin(C.yaw); put(C.x + 0.75 * c + 0.45 * s, C.y + 1.86, C.z - 0.75 * s + 0.45 * c, [2.0, 1.2, 0.5]); }
  for (const tk of WL.tasks) if (tk.k === 'splitter' && !tk.done && (tk.landed || tk.fall)) put(tk.gx ?? tk.x, (tk.gy ?? tk.y) + 0.35, tk.gz ?? tk.z, [2.4, 0.9, 0.25]);
  for (; n < WL_GLOW; n++) a.setXYZ(n, 0, -1000, 0);
  a.needsUpdate = true; col.needsUpdate = true;
}

/* ---------- Eisschollen ---------- */
function wlFloeSpawn(i, near) {
  const F = WL.fl, cp = camera.position;
  for (let t = 0; t < 8; t++) {
    const a = Math.random() * 6.2832, r = near ? wlR(30, LOW ? 240 : 360) : wlR(LOW ? 200 : 300, LOW ? 260 : 380);
    const x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r;
    if (landDist(x, z) > -7 || terrainHeight(x, z) > WATER_Y - 0.9) continue;
    F.x[i] = x; F.z[i] = z; F.r[i] = Math.random() * 6.28; F.s[i] = wlR(1.2, 4.2) * (Math.random() < 0.12 ? 2 : 1); F.e[i] = wlR(0.6, 1.25);
    F.wr[i] = wlR(-0.04, 0.04); F.vx[i] = wlR(-0.12, 0.12); F.vz[i] = wlR(-0.12, 0.12); F.ok[i] = 1; F.y[i] = 0;
    return true;
  }
  F.ok[i] = 0; return false;
}
function wlFloes(dt, on) {
  const F = WL.fl; if (!F) return;
  F.sink += ((on ? 0 : 1) - F.sink) * Math.min(1, dt * (on ? 0.25 : 0.12));
  if (F.sink > 0.98 && !on) { if (F.m.count) { F.m.count = 0; F.ok.fill(0); } return; }
  const cp = camera.position, tm = U.uTime.value, wx = WIND.dx * 0.32, wz = WIND.dz * 0.32, far2 = (LOW ? 280 : 400) ** 2;
  if (!F.m.count) { for (let i = 0; i < WL_FLOES; i++) wlFloeSpawn(i, true); F.m.count = WL_FLOES; }
  F.k = (F.k + 1) % 4;
  for (let i = 0; i < WL_FLOES; i++) {
    if (!F.ok[i]) { if (on && Math.random() < dt * 0.5) wlFloeSpawn(i, false); _ws.set(0, 0, 0); F.m.setMatrixAt(i, _wm.makeScale(0, 0, 0)); continue; }
    F.x[i] += (wx + F.vx[i]) * dt; F.z[i] += (wz + F.vz[i]) * dt; F.r[i] += F.wr[i] * dt;
    if ((i & 3) === F.k) {
      const dx = F.x[i] - cp.x, dz = F.z[i] - cp.z;
      if (i !== WL.flLock && (dx * dx + dz * dz > far2 || landDist(F.x[i], F.z[i]) > -2.5 - F.s[i])) { if (!(on && wlFloeSpawn(i, false))) F.ok[i] = 0; continue; }
      F.y[i] = waterH(F.x[i], F.z[i], tm);
    }
    const s = F.s[i], y = WATER_Y + F.y[i] + 0.06 - F.sink * 0.9;
    _wlq.setFromEuler(_we.set(Math.sin(tm * 0.7 + i) * 0.03, F.r[i], Math.cos(tm * 0.6 + i * 1.7) * 0.03));
    F.m.setMatrixAt(i, _wm.compose(_wp.set(F.x[i], y, F.z[i]), _wlq, _ws.set(s, 0.55 + 0.25 * F.e[i], s * F.e[i])));
  }
  F.m.instanceMatrix.needsUpdate = true;
  // Knacken und Knirschen, wenn man nah am Eis ist
  if (on && (WL.crackT -= dt) <= 0) {
    WL.crackT = wlR(1.6, 5);
    for (let i = 0; i < WL_FLOES; i += 3) if (F.ok[i] && (F.x[i] - cp.x) ** 2 + (F.z[i] - cp.z) ** 2 + (cp.y - WATER_Y) ** 2 < 70 * 70) { wlCrack(); break; }
  }
}
// eine nahe Scholle (für den Fischer)
function wlFloeNear(r0, r1) {
  const F = WL.fl, p = player.p; let best = -1;
  for (let i = 0; i < WL_FLOES; i++) { if (!F.ok[i] || F.s[i] < 2.2) continue; const d = Math.hypot(F.x[i] - p.x, F.z[i] - p.z); if (d > r0 && d < r1 && landDist(F.x[i], F.z[i]) < -20) { best = i; if (Math.random() < 0.4) break; } }
  return best;
}

/* ---------- Klänge: Eis knackt, Einschlag ---------- */
function wlNoise(f, q, dur, vol, type = 'bandpass', brown = false) {
  const ctx = audioCtx(); if (!ctx || !SND.noise || !SND.on) return;
  const bus = audioBus('out'); if (!bus) return;
  const src = ctx.createBufferSource(); src.buffer = brown ? SND.brown : SND.noise; src.playbackRate.value = 0.7 + Math.random() * 0.6;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(), t = ctx.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
  src.connect(fl); fl.connect(g); g.connect(bus); src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
}
function wlCrack() { wlNoise(1400 + Math.random() * 1600, 2.5, 0.22, 0.12); setTimeout(() => wlNoise(260, 1.2, 0.6, 0.08, 'lowpass', true), 60); }
function wlBoom() { wlNoise(110, 0.8, 1.6, 0.5, 'lowpass', true); wlNoise(2200, 0.6, 0.35, 0.06); }

/* =====================================================================
   2) DIE STADT REAGIERT
   ===================================================================== */
const wlFree = pd => pd.a && !pd.rag && !pd.aw && !pd.gg && !pd.cit && !pd.life && !pd.pair && !pd.lat && !pd.carActor && !pd.back && !pd.busy && !WL.mods.has(pd);
// jemand, der gerade unsichtbar in einem Laden sitzt, wird für eine Weile ausgeliehen
function wlBorrow(test) {
  const list = [];
  for (const pd of peds) if (pd.st === 2 && pd.go && pd.lp && wlFree(pd) && pd.wait < 1e8 && (!test || test(pd))) list.push(pd);
  if (!list.length) return null;
  const pd = wlPick(list);
  WL.mods.set(pd, { k: 'borrow', wait: pd.wait, g1: pd.a.gait[1], g2: pd.a.gait[2] });
  pd.st = 4; pd.y = pd.lp.y ?? 0.22; pd.tilt = 0;
  return pd;
}
function wlGive(pd, quick) {
  const M = WL.mods.get(pd); if (!M) return;
  WL.mods.delete(pd);
  const g = pd.a.gait;
  if (M.k === 'hurry') { pd.v = M.v; if (pd.st === 0) { g[1] = M.g1; pd.a.gv = (pd.a.gv | 0) + 1; } pd.mcool = wlR(10, 40); }
  else if (M.k === 'in') { if (pd.st === 2) pd.wait = quick ? wlR(1, 6) : wlR(4, 40); }
  else if (M.k === 'stand') { if (pd.st === 4) { pd.st = 0; g[1] = M.g1; g[2] = M.g2; pd.a.gv = (pd.a.gv | 0) + 1; } }
  else if (M.k === 'borrow') { pd.st = 2; pd.wait = wlR(3, 30); pd.tilt = 0; g[1] = M.g1; g[2] = M.g2; pd.a.gv = (pd.a.gv | 0) + 1; pd.a.on = false; }
}
// Leute auf dem Gehweg: eilen, gehen hinein, bleiben stehen und schauen hinauf
function wlPeds(E, big) {
  const cp = camera.position, n = peds.length, step = Math.min(n, 700);
  for (let j = 0; j < step; j++) {
    const pd = peds[WL.scan = (WL.scan + 1) % n];
    if (pd.st !== 0 || !pd.lp || !wlFree(pd)) continue;
    const [x, z, dx, dz] = loopRound(pd.lp, pd.t, Math.sign(pd.v)), d2 = wlCam2(x, z);
    if (E.cold) {
      if (d2 > 75 * 75 && pd.lp.doors && pd.lp.doors.length && Math.random() < (E.inside || 0) * (big ? 1 : 0.6)) {
        let best = null, bd = 1e9; for (const g of pd.lp.doors) { let d = Math.abs(g.t - pd.t); d = Math.min(d, pd.lp.total - d); if (d < bd) { bd = d; best = g; } }
        if (best) { WL.mods.set(pd, { k: 'in' }); pd.st = 2; pd.go = best; pd.t = best.t; pd.wait = 1e9; pd.a.on = false; continue; }
      }
      if (E.hurry) { WL.mods.set(pd, { k: 'hurry', v: pd.v, g1: pd.a.gait[1] }); pd.v *= E.hurry; pd.a.gait[1] *= E.hurry; pd.a.gv = (pd.a.gv | 0) + 1; pd.mcool = 1e9; }
    } else if (E.look && d2 < 130 * 130 && !WL.pchk.has(pd) && (WL.pchk.add(pd), Math.random() < 0.4)) {   // jeder nur einmal ausgelost
      WL.mods.set(pd, { k: 'stand', g1: pd.a.gait[1], g2: pd.a.gait[2], until: WL.clock + wlR(14, 45) });
      const lat = pd.lat || 0; pd.st = 4; pd.x = x + dz * lat; pd.z = z - dx * lat; pd.y = pd.lp.y ?? 0.22; pd.yaw = Math.atan2(dx, dz) + wlR(-1.2, 1.2); pd.tilt = 0;
      setAct(pd, Math.random() < 0.7 ? 16 : 1);
    }
  }
}
// Gesprächsrunden: frieren (Arme um sich, Hände reiben) oder zeigen hinauf
function wlChats(E) {
  const cp = camera.position;
  for (const c of CHATS) {
    if (c.share || c.sit || WL.chats.has(c) || (c.x - cp.x) ** 2 + (c.z - cp.z) ** 2 > 220 * 220) continue;
    if (c.m.some(pd => pd.aw || pd.rag || !pd.a)) continue;
    WL.chats.set(c, c.t); c.t = 1e9;
    for (const pd of c.m) setAct(pd, E.cold ? 13 : Math.random() < 0.75 ? 16 : 1);
  }
}
function wlChatsBack() { for (const [c] of WL.chats) c.t = Math.random() * 2; WL.chats.clear(); }
// die Menge auf dem Belmont-Platz
function wlGather(n) {
  for (let k = 0; k < n * 3 && WL.items.filter(i => i.k === 'gather').length < n; k++) {
    const a = Math.random() * 6.2832, r = wlR(48, 88), x = Math.max(PLAZA.x0 + 6, Math.min(PLAZA.x1 - 6, Math.cos(a) * r)), z = Math.max(PLAZA.z0 + 6, Math.min(PLAZA.z1 - 6, Math.sin(a) * r * 1.3));
    if (roofAt(x, z) > 1 || (Math.abs(x) < 34 && z > 55 && z < 130)) continue;   // nicht unter Dächern, nicht im Brunnen
    const pd = wlBorrow(); if (!pd) return;
    pd.x = x; pd.z = z; pd.y = 0.26; pd.yaw = Math.atan2(-x, -z) + Math.PI + wlR(-0.8, 0.8);
    setAct(pd, Math.random() < 0.65 ? 16 : Math.random() < 0.5 ? 1 : 0.6);
    WL.items.push({ k: 'gather', pd });
  }
}
// Verkehr: langsamer, im Sturm weniger Wagen (nur weit weg aus- und wieder eingeblendet)
function wlTraffic(E) {
  const car = E.car || 1, hide = E.hide || 0, cp = camera.position;
  for (const c of TRF.cars) {
    if (c.dyn) continue;
    if (car < 1 && !WL.cars.has(c) && c.v0 > 0) { WL.cars.set(c, c.v0); c.v0 *= car; }
    if (!hide || WL.chk.has(c) || c.gone || c.wx === undefined || (c.wx - cp.x) ** 2 + (c.wz - cp.z) ** 2 < 170 * 170) continue;
    WL.chk.add(c);   // jeder Wagen wird einmal ausgelost, und nur, wenn er weit weg ist
    if (Math.random() < hide) { c.gone = true; WL.hid.add(c); }
  }
}
function wlTrafficBack(force) {
  for (const [c, v0] of WL.cars) c.v0 = v0; WL.cars.clear(); WL.chk.clear();
  const cp = camera.position;
  for (const c of WL.hid) if (force || c.wx === undefined || (c.wx - cp.x) ** 2 + (c.wz - cp.z) ** 2 > 170 * 170) { c.gone = false; WL.hid.delete(c); }
}
function wlTrams(mul) {
  for (const tr of trams) {
    if (!WL.trams.has(tr)) WL.trams.set(tr, tr.v);
    if (!tr.wlStuck) tr.v = WL.trams.get(tr) * mul;
  }
}
function wlTramsBack() { for (const [tr, v] of WL.trams) { tr.v = v; tr.wlStuck = false; } WL.trams.clear(); }

/* ---------- Punschwagen vor Cafés, Restaurants und Bars ---------- */
const WL_VEND = ['Heißer Punsch! Kakao mit Sahne! Wärmt bis in die Zehen!', 'Glühwein, frisch vom Kessel! Zwanzig Funken der Becher!', 'Heiße Maronen und Punsch, meine Damen und Herren!', 'Herr Alexander! Ein Becher Punsch gegen die Kälte?'];
function wlCarts() {
  if (WL.carts.length) return;
  const cand = DOORS.filter(d => (d.kind === 'cafe' || d.kind === 'restaurant' || d.kind === 'bar' || d.kind === 'pub') && wlD2(d.x, d.z) > 30 * 30 && wlD2(d.x, d.z) < 320 * 320);
  cand.sort((a, b) => wlD2(a.x, a.z) - wlD2(b.x, b.z));
  for (const d of cand) {
    if (WL.carts.length >= (MOBILE ? 3 : 5)) break;
    const x = d.x + d.nx * 3.4 + d.nz * 2.2, z = d.z + d.nz * 3.4 - d.nx * 2.2;
    if (WL.carts.some(C => (C.x - x) ** 2 + (C.z - z) ** 2 < 60 * 60) || roofAt(x, z) > 1.5) continue;
    const yaw = Math.atan2(d.nx, d.nz) - Math.PI / 2, C = { x, z, y: 0.22, yaw, d, cool: 0 };
    C.pd = wlBorrow(); if (C.pd) { const c = Math.cos(yaw), s = Math.sin(yaw); C.pd.x = x - 0.0 * c + 1.0 * s; C.pd.z = z + 0.0 * s + 1.0 * c; C.pd.y = 0.22; C.pd.yaw = yaw + Math.PI; setAct(C.pd, 12); }
    C.use = { test: p => !C.gone && (p.x - x) ** 2 + (p.z - z) ** 2 < 3.4 * 3.4 && p.y < 3, label: 'Punsch für alle spendieren · 40 Lumen', act: () => wlPunsch(C) };
    INTERACT.push(C.use); WL.carts.push(C);
  }
  wlBoxes(); wlGlows();
}
function wlCartsBack() {
  for (const C of WL.carts) { C.gone = true; const i = INTERACT.indexOf(C.use); if (i >= 0) INTERACT.splice(i, 1); if (C.pd) wlGive(C.pd); }
  WL.carts.length = 0; wlBoxes(); wlGlows();
}
function wlPunsch(C) {
  if (C.cool > WL.clock) { toast('Der Kessel wird gerade nachgefüllt'); return; }
  C.cool = WL.clock + 45;
  if (KT.ready && KT.s) ktCash(-40, 'Punsch für alle (' + (WL.E ? WL.E.n : 'Kälte') + ')');
  if (RUF.ready) rufAdd({ arbeiter: 1, buerger: 0.8, bew: 0.4 }, 'Punsch für alle spendiert', { key: 'punsch' });
  lifeSay('Der Punschverkäufer', wlPick(['Punsch für alle, spendiert von Herrn Alexander! Wohl bekomm’s!', 'Hört, hört! Die Runde geht auf Herrn Alexander!', 'Der Kessel ist offen, Leute, Herr Alexander zahlt!']), 4.5);
  fxEmit('steam', C.x, C.y + 1.7, C.z, 0, 1.2, 0, 10, 0.5, 1);
  WL.count.punsch = (WL.count.punsch || 0) + 1;
}

/* =====================================================================
   3) AUFGABEN WÄHREND DES EREIGNISSES (Ruf)
   ===================================================================== */
function wlName(pd) { return (pd.fem ? wlPick(FIRST_F) : wlPick(FIRST_M)) + ' ' + wlPick(LAST); }
function wlTaskNear(r0, r1) { return pd => { const g = pd.go; const d = Math.sqrt(wlD2(g.x, g.z)); return d > r0 && d < r1 && roofAt(g.x, g.z) < 1.5; }; }
function wlMakeTask(k) {
  const tk = { k, done: false, t0: WL.clock };
  if (k === 'leute' || k === 'verirrt') {
    const pd = wlBorrow(wlTaskNear(60, 260)) || wlBorrow(wlTaskNear(30, 420)); if (!pd) return null;
    const g = pd.go, side = Math.random() < 0.5 ? -1 : 1;
    tk.pd = pd; tk.who = wlName(pd); tk.x = pd.x = g.x + g.d.nz * side * 1.2; tk.z = pd.z = g.z - g.d.nx * side * 1.2; tk.y = pd.y = pd.lp.y ?? 0.22;
    pd.yaw = Math.random() * 6.28; setAct(pd, k === 'leute' ? 13 : 1);
    if (k === 'leute') tk.piles = [[tk.x + 0.4, tk.y - 0.05, tk.z + 0.2, 1.3, 0.55, 0.9, 0.4], [tk.x - 0.6, tk.y - 0.05, tk.z - 0.3, 0.9, 0.42, 0.8, 1.3], [tk.x + 0.1, tk.y - 0.05, tk.z - 0.9, 0.8, 0.35, 0.6, 2.2]];
    tk.n = k === 'leute' ? 'Gestrandet im Schnee: ' + tk.who : 'Im Nebel verirrt: ' + tk.who;
    tk.use = { test: p => !tk.done && !tk.walk && (p.x - pd.x) ** 2 + (p.z - pd.z) ** 2 < 2.8 * 2.8 && Math.abs(p.y - tk.y) < 2.5, label: (k === 'leute' ? 'In Sicherheit bringen: ' : 'Den Weg zeigen: ') + tk.who, act: () => wlRescuePerson(tk) };
    INTERACT.push(tk.use);
  } else if (k === 'bahn') {
    if (!tramMesh || !trams.length) return null;
    let best = -1, bd = 1e9;
    trams.forEach((tr, i) => { tramMesh.getMatrixAt(i, _wm); _wp.setFromMatrixPosition(_wm); const d = Math.sqrt(wlD2(_wp.x, _wp.z)); const s = Math.abs(d - 180); if (d > 70 && d < 520 && s < bd) { bd = s; best = i; } });
    if (best < 0) return null;
    const tr = trams[best]; tramMesh.getMatrixAt(best, _wm); _wp.setFromMatrixPosition(_wm); _wlq.setFromRotationMatrix(_wm); _wv.set(1, 0, 0).applyQuaternion(_wlq);
    if (!WL.trams.has(tr)) WL.trams.set(tr, tr.v);
    tr.wlStuck = true; tr.v = 0;
    tk.tr = tr; tk.ti = best; tk.x = _wp.x; tk.z = _wp.z; tk.y = 0.1; tk.n = 'Straßenbahn im Schnee stecken geblieben';
    const fx = _wv.x, fz = _wv.z, ex = tk.x + fx * 8.5, ez = tk.z + fz * 8.5, yaw = Math.atan2(fx, fz);
    tk.piles = [[ex, 0, ez, 2.2, 0.9, 1.6, yaw], [ex + fz * 1.2, 0, ez - fx * 1.2, 1.4, 0.6, 1.2, yaw + 1], [tk.x - fx * 8.2, 0, tk.z - fz * 8.2, 1.6, 0.6, 1.2, yaw]];
    tk.use = { test: p => !tk.done && (p.x - tk.x) ** 2 + (p.z - tk.z) ** 2 < 10 * 10 && p.y < 4, label: 'Die Straßenbahn freischaufeln und anschieben', act: () => wlRescueTram(tk) };
    INTERACT.push(tk.use);
  } else if (k === 'scholle') {
    const i = wlFloeNear(70, 320); if (i < 0) return null;
    const pd = wlBorrow(); if (!pd) return null;
    WL.flLock = i; tk.pd = pd; tk.fi = i; tk.who = wlName(pd); WL.fl.s[i] = Math.max(WL.fl.s[i], 3); WL.fl.vx[i] *= 0.3; WL.fl.vz[i] *= 0.3;
    tk.x = WL.fl.x[i]; tk.z = WL.fl.z[i]; tk.y = WATER_Y + 0.3; tk.n = 'Fischer auf einer Eisscholle: ' + tk.who;
    setAct(pd, 3.75); pd.yaw = Math.random() * 6.28;   // winkt mit beiden Händen
  } else if (k === 'splitter') {
    const ok = d => { const x = d.x + d.nx * 4, z = d.z + d.nz * 4, r = Math.sqrt(wlD2(x, z)); return r > 60 && r < 240 && roofAt(x, z) < 1; };
    const cand = DOORS.filter(ok); if (!cand.length) return null;
    const d = wlPick(cand); tk.x = d.x + d.nx * 4.5; tk.z = d.z + d.nz * 4.5; tk.y = 0.22; tk.landed = false; tk.fall = 0;
    tk.n = 'Ein glühender Meteoritensplitter'; tk.wait = wlR(14, 28);
    tk.use = { test: p => tk.landed && !tk.done && (p.x - tk.x) ** 2 + (p.z - tk.z) ** 2 < 2.6 * 2.6 && p.y < 3, label: 'Den Meteoritensplitter aufheben (fürs Museum)', act: () => wlRescueSplitter(tk) };
    INTERACT.push(tk.use);
  }
  return tk;
}
function wlTaskDone(tk, why, ch, line) {
  tk.done = true; WL.done++; WL.count[tk.k] = (WL.count[tk.k] || 0) + 1;
  const i = INTERACT.indexOf(tk.use); if (i >= 0) INTERACT.splice(i, 1);
  if (RUF.ready) rufAdd(ch, why, { key: 'wetter_' + tk.k, faint: 0.85 });
  if (line) lifeSay(tk.who || 'Ein Bürger', line, 5);
  wlPiles(); wlBoxes(); wlGlows();
  const open = WL.tasks.filter(t => !t.done).length;
  toast(open ? why + ' · noch ' + open + ' ' + (open === 1 ? 'Aufgabe' : 'Aufgaben') : why + ' · alle gerettet');
}
function wlRescuePerson(tk) {
  const pd = tk.pd, lost = tk.k === 'verirrt';
  wlTaskDone(tk, lost ? 'Einem Verirrten im Nebel den Weg gezeigt' : 'Gestrandete in Sicherheit gebracht', lost ? { buerger: 1.5, presse: 0.6, bew: 0.6 } : { buerger: 2, arbeiter: 0.8, presse: 1, bew: 1 },
    lost ? wlPick(['Danke! In diesem Nebel sieht man ja die eigene Hand nicht.', 'Ach, dort entlang! Herr Alexander, Sie sind ein Engel.']) : wlPick(['Herr Alexander! Ich dachte schon, ich erfriere hier.', 'Danke, danke! Meine Füße spüre ich nicht mehr.', 'Der Herr von Vespera persönlich! Das glaubt mir keiner.']));
  fxEmit('snowburst', tk.x, tk.y + 0.3, tk.z, 0, 1.2, 0, 14, 1.2, 1.1);
  // zur nächsten Tür gehen, dann hinein
  let d = null, bd = 1e9; for (const g of DOORS) { const q = (g.x - pd.x) ** 2 + (g.z - pd.z) ** 2; if (q < bd) { bd = q; d = g; } }
  tk.walk = d && bd < 30 * 30 ? { x: d.x + d.nx * 0.6, z: d.z + d.nz * 0.6, t: 0 } : { x: pd.x, z: pd.z, t: 0 };
  const g = pd.a.gait; g[1] = 1.3 * (pd.fem ? 5.4 : 4.6) / pd.sc; g[2] = pd.fem ? 0.36 : 0.4; pd.a.gv = (pd.a.gv | 0) + 1;
}
function wlRescueTram(tk) {
  wlTaskDone(tk, 'Die Straßenbahn aus dem Schnee befreit', { buerger: 2.5, arbeiter: 1.5, presse: 1, bew: 1.2 }, null);
  lifeSay('Der Schaffner', wlPick(['Alles einsteigen! Herr Alexander hat uns freigeschoben!', 'Mit bloßen Händen! Danke, Herr Alexander, wir fahren weiter!']), 5);
  for (const q of tk.piles) fxEmit('snowburst', q[0], 0.6, q[2], 0, 2.5, 0, 22, 2.4, 1.6);
  wlNoise(180, 0.8, 0.9, 0.3, 'lowpass', true);
  tk.tr.wlStuck = false; tk.tr.v = (WL.trams.get(tk.tr) || 9) * (WL.E && WL.E.tram || 1);
}
function wlRescueFloe(tk) {
  wlTaskDone(tk, 'Einen Fischer von der Eisscholle geholt', { arbeiter: 2, presse: 1.4, bew: 1.6, buerger: 0.6 }, wlPick(['Herr Alexander! Gott sei Dank, die Scholle wurde immer kleiner!', 'Ich sag’s meiner Frau: der Herr von Vespera kam durch die Luft!']));
  fxEmit('spray', tk.x, WATER_Y + 0.4, tk.z, 0, 3, 0, 18, 1.4, 1);
  wlGive(tk.pd); tk.pd = null; WL.flLock = -1;
}
function wlRescueSplitter(tk) {
  wlTaskDone(tk, 'Meteoritensplitter dem Museum geschenkt', { presse: 1.5, buerger: 1, bew: 1, elite: 0.6 }, null);
  lifeSay('Ein Professor der Sternwarte', 'Ein echter Meteorit aus dem Schauer! Das Museum wird ihn mit Ihrem Namen ausstellen, Herr Alexander.', 5.5);
  fxEmit('ember', tk.x, 0.6, tk.z, 0, 1.5, 0, 12, 0.6, 1);
  if (window.vespera && window.vespera.zeitung) { /* Meldung kommt am Ende gesammelt */ }
}
function wlTasksStep(dt) {
  for (const tk of WL.tasks) {
    if (tk.k === 'bahn' && !tk.done && tramMesh) { tramMesh.getMatrixAt(tk.ti, _wm); _wp.setFromMatrixPosition(_wm); tk.x = _wp.x; tk.z = _wp.z; }
    if (tk.k === 'scholle' && !tk.done) {
      const F = WL.fl, i = tk.fi; if (!F.ok[i]) { F.ok[i] = 1; }
      tk.x = F.x[i]; tk.z = F.z[i]; tk.y = WATER_Y + F.y[i] + 0.06 - F.sink * 0.9 + 0.21 * (0.55 + 0.25 * F.e[i]);
      tk.pd.x = tk.x; tk.pd.z = tk.z; tk.pd.y = tk.y;
      const p = player.p; if ((p.x - tk.x) ** 2 + (p.z - tk.z) ** 2 < 5 * 5 && Math.abs(p.y - tk.y) < 4) wlRescueFloe(tk);
    }
    if (tk.walk && tk.pd) {
      const W = tk.walk, pd = tk.pd, dx = W.x - pd.x, dz = W.z - pd.z, L = Math.hypot(dx, dz); W.t += dt;
      if (L < 0.3 || W.t > 9) { wlGive(pd); tk.walk = null; tk.pd = null; }
      else { const v = Math.min(L, 1.7 * dt); pd.x += dx / L * v; pd.z += dz / L * v; pd.yaw = Math.atan2(dx, dz); }
    }
    if (tk.k === 'splitter' && !tk.landed) {
      if ((tk.wait -= dt) > 0) continue;
      // fällt als Feuerkugel schräg herab, mit Funkenschweif, dann ein dumpfer Schlag
      tk.fall += dt / 2.6; const k = Math.min(1, tk.fall), h = (1 - k) * 420;
      tk.gx = tk.x + (1 - k) * 260; tk.gy = tk.y + h; tk.gz = tk.z - (1 - k) * 120;
      fxEmit('ember', tk.gx, tk.gy, tk.gz, 0, 0, 0, 3, 2, 3);
      if (k >= 1) { tk.landed = true; tk.gx = tk.gy = tk.gz = undefined; wlBoom(); fxEmit('dust', tk.x, 0.4, tk.z, 0, 2, 0, 20, 2.5, 1.5); fxEmit('spark', tk.x, 0.4, tk.z, 0, 4, 0, 24, 2, 1); wlBoxes(); toast('Ein Meteoritensplitter ist in der Stadt eingeschlagen!'); }
      wlGlows();
    } else if (tk.k === 'splitter' && !tk.done && Math.random() < dt * 3) fxEmit('ember', tk.x, 0.5, tk.z, 0, 0.8, 0, 1, 0.3, 0.8);
  }
}

/* ---------- Marken über den Aufgaben (wie die Aufgaben-Rauten) ---------- */
function wlMarkers() {
  if (!WL.mk) {
    const s = document.createElement('style'); s.textContent = `
#wlMk{position:fixed;inset:0;pointer-events:none;z-index:6}
#wlMk .m{position:absolute;transform:translate(-50%,-100%);text-align:center;color:#f6dc9a;font:600 11px/1.2 var(--body,"Josefin Sans",sans-serif);letter-spacing:.12em;text-shadow:0 0 6px #000;white-space:nowrap}
#wlMk .m i{display:block;margin:0 auto 3px;width:13px;height:13px;transform:rotate(45deg);border:2px solid #f6dc9a;background:rgba(111,214,207,.55);box-shadow:0 0 10px rgba(111,214,207,.8)}
#wlBan{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:7;padding:10px 38px 11px;text-align:center;background:linear-gradient(#0a2128,#071a20);border:1px solid #d9b26a;outline:1px solid rgba(217,178,106,.35);outline-offset:3px;color:#f3e6c8;pointer-events:none;opacity:0;transition:opacity 1.2s;
  clip-path:polygon(16px 0,calc(100% - 16px) 0,100% 50%,calc(100% - 16px) 100%,16px 100%,0 50%)}
#wlBan b{display:block;font:400 24px/1.05 "Limelight","Didot",Georgia,serif;letter-spacing:.22em;color:#f6dc9a}
#wlBan small{display:block;margin-top:5px;font:600 11px/1.3 var(--body,"Josefin Sans",sans-serif);letter-spacing:.24em;text-transform:uppercase;color:#9fd8d1}
#wlBan em{display:block;font-style:normal;font-size:10px;letter-spacing:.4em;color:#b9a98a;margin-bottom:4px}
@media (max-width:760px){#wlBan b{font-size:17px}#wlBan{top:64px;padding:8px 26px}}`;
    document.head.append(s);
    WL.mk = document.createElement('div'); WL.mk.id = 'wlMk'; document.body.append(WL.mk);
    const b = document.createElement('div'); b.id = 'wlBan'; document.body.append(b); WL.ban = b;
  }
  const open = WL.tasks.filter(t => !t.done && (t.k !== 'splitter' || t.landed));
  while (WL.mk.children.length < open.length) { const d = document.createElement('div'); d.className = 'm'; d.innerHTML = '<i></i><span></span>'; WL.mk.append(d); }
  const W = innerWidth, H = innerHeight;
  [...WL.mk.children].forEach((el, i) => {
    const tk = open[i]; if (!tk) { el.style.display = 'none'; return; }
    _wv.set(tk.x, tk.y + 2.6, tk.z).project(camera);
    if (_wv.z > 1 || Math.abs(_wv.x) > 1.1 || Math.abs(_wv.y) > 1.1) { el.style.display = 'none'; return; }
    el.style.display = ''; el.style.left = ((_wv.x + 1) / 2 * W) + 'px'; el.style.top = ((1 - _wv.y) / 2 * H) + 'px';
    const d = Math.hypot(tk.x - player.p.x, tk.z - player.p.z);
    el.lastChild.textContent = d < 12 ? '' : Math.round(d) + ' m';
  });
}
function wlBanner(title, sub, top = 'Wetterwarte Vespera') {
  wlMarkers(); const b = WL.ban;
  b.innerHTML = `<em></em><b></b><small></small>`; b.children[0].textContent = top; b.children[1].textContent = title; b.children[2].textContent = sub || '';
  b.style.opacity = 1; WL.banT = 7;
}

/* =====================================================================
   4) ABLAUF: Vorhersage, Beginn, Ende
   ===================================================================== */
WL.clock = 0;
function wlForecast(id) {
  const E = WL_EV[id]; WL.warn = id; WL.warnT = 55;
  toast(E.warn);
  wlBanner(E.n + ' in Sicht', 'In etwa einer Minute', 'Wetterwarte Vespera · Vorhersage');
  zeitungKasten('wetter', 'Wetterwarte Vespera', ['Vorhersage: ' + E.n, E.warn.replace(/^Wetterwarte Vespera: /, '')]);
}
export function wlStart(id, now = false) {
  const E = WL_EV[id]; if (!E || !WL.ready) return false;
  if (WL.ev) wlEnd(false);
  WL.warn = null; WL.ev = id; WL.E = E; WL.t = 0; WL.end = wlR(E.dur[0], E.dur[1]); WL.done = 0; WL.count = {}; WL.flyCheer = false;
  WL.pin0 = ATMO.pinned; ATMO.w = wlWeather(E.w); ATMO.pinned = true; WL.mine = true;
  if (now) { for (const k in ATMO.cur) ATMO.cur[k] += ((ATMO.w[k] || 0) - ATMO.cur[k]) * 0.6; }
  wlBanner(E.n, E.sub);
  toast('Wetterereignis: ' + E.n);
  zeitungMeldung({ titel: E.news[0], text: E.news[1], rubrik: 'Wetter', prio: id === 'sturm' || id === 'nordlicht' ? 8 : 7, ruf: 'Extrablatt! ' + E.n + ' über Vespera!', quelle: 'wetter' });
  zeitungKasten('wetter', 'Wetterwarte Vespera', ['Jetzt: ' + E.n, E.sub]);
  // Kontor: passendes Börsenereignis für einen Tag (Kohle, Kolonialwaren, Rundflüge)
  if (E.kt && KT.ready && KT.s) {
    const i = EVENTS.findIndex(e => e.t.startsWith(E.kt));
    if (i >= 0 && !KT.s.ev.some(e => e.i === i)) { KT.s.ev.push({ i, d: 1 }); setTimeout(() => toast('Börsentelegramm: ' + EVENTS[i].t), 4200); try { ktChanged('wetter'); } catch (e) { /* egal */ } }
  }
  // Aufgaben kommen nach ein paar Sekunden, wenn das Wetter da ist
  WL.taskT = 14; WL.retry = null; WL.toldTasks = false;
  return true;
}
export function wlEnd(natural = true) {
  const id = WL.ev, E = WL.E; if (!id) return;
  WL.ev = null; WL.E = null; WL.next = wlR(840, 1380);
  for (const tk of WL.tasks) {
    const i = INTERACT.indexOf(tk.use); if (i >= 0) INTERACT.splice(i, 1);
    if (tk.pd) wlGive(tk.pd, true);
    if (tk.tr) tk.tr.wlStuck = false;
  }
  WL.tasks.length = 0; WL.flLock = -1; wlPiles(); wlBoxes(); wlGlows();
  if (WL.mine && ATMO.pinned && ATMO.w && ATMO.w.id === E.w) { ATMO.w = wlWeather(E.after) || ATMO.w; ATMO.pinned = false; ATMO.timer = 150; }
  WL.mine = false;
  if (natural) {
    const n = WL.done, c = WL.count;
    const bits = [];
    if (c.leute) bits.push(c.leute === 1 ? 'eine gestrandete Person in Sicherheit gebracht' : c.leute + ' Gestrandete in Sicherheit gebracht');
    if (c.bahn) bits.push('eine eingeschneite Straßenbahn mit bloßen Händen freigeschoben');
    if (c.scholle) bits.push('einen Fischer von einer treibenden Eisscholle geholt');
    if (c.verirrt) bits.push('einer im Nebel verirrten Person den Weg gezeigt');
    if (c.splitter) bits.push('einen Meteoritensplitter dem Städtischen Museum geschenkt');
    if (c.punsch) bits.push(c.punsch === 1 ? 'eine Runde Punsch für alle spendiert' : c.punsch + ' Runden Punsch spendiert');
    if (n || c.punsch || WL.flyCheer) {
      const t = bits.length ? 'Während ' + E.gen + ' hat Herr Alexander ' + bits.join(', ').replace(/, ([^,]*)$/, ' und $1') + '.' : 'Herr Alexander flog unter dem Nordlicht über die Menge auf dem Belmont-Platz; der Beifall wollte nicht enden.';
      WL.report = zeitungMeldung({ titel: n >= 2 ? E.hero : id === 'nordlicht' && !n ? 'Applaus unter dem Nordlicht' : 'Herr Alexander packt mit an', text: t + (id === 'sturm' ? ' Die Stadt atmet auf.' : ''), rubrik: 'Stadt', prio: n >= 2 ? 8 : 6, ruf: n >= 2 ? 'Extrablatt! Alexander rettet Bürger im ' + E.n + '!' : null, foto: false, quelle: 'wetter' });
    }
    toast(E.n + ' ist vorüber');
  }
  zeitungKasten('wetter', 'Wetterwarte Vespera', ['Ruhige Polarnacht', 'Nächste Meldung, sobald sich etwas zusammenbraut']);
}

/* ---------- je Sekunde: Reaktion der Stadt auf den Zustand ---------- */
function wlCity() {
  const id = WL.ev || WL_WX[ATMO.w && ATMO.w.id] || null, E = id ? WL_EV[id] : null, big = !!WL.ev;
  if (id !== WL.mode) {
    // Wechsel: alles Alte zurückgeben (Leute, die man gerade sieht, erst, wenn sie weiter weg sind)
    WL.mode = id; WL.modeT = 0;
    wlChatsBack(); wlTramsBack(); for (const [c, v0] of WL.cars) c.v0 = v0; WL.cars.clear(); WL.chk.clear(); WL.pchk.clear();
    WL.fade = WL.clock;
  }
  WL.modeT++;
  // Rückgabe: ausgeliehene und veränderte Leute, die nicht mehr gebraucht werden
  for (const [pd, M] of WL.mods) {
    const keepTask = WL.tasks.some(t => t.pd === pd), keepCart = WL.carts.some(C => C.pd === pd), keepG = WL.items.some(i => i.pd === pd);
    if (keepTask || keepCart || keepG) continue;
    const want = E && ((M.k === 'hurry' && E.hurry) || (M.k === 'in' && E.cold) || (M.k === 'stand' && E.look && WL.clock < M.until));
    if (want) continue;
    if (M.k !== 'borrow' || wlCam2(pd.x, pd.z) > 70 * 70 || WL.clock - (WL.fade || 0) > 50) wlGive(pd);
  }
  // Menge auf dem Platz: auflösen, wenn kein großes Polarlicht oder Schauer mehr
  if (!(big && E.gather)) { WL.items = WL.items.filter(i => { if (i.k !== 'gather') return true; const far = wlCam2(i.pd.x, i.pd.z) > 70 * 70; if (far || WL.clock - (WL.fade || 0) > 50) { wlGive(i.pd); return false; } return true; }); }
  if (!(big && E.cold) && WL.carts.length && (WL.carts.every(C => wlCam2(C.x, C.z) > 80 * 80) || WL.clock - (WL.fade || 0) > 60)) wlCartsBack();
  if (!E || !(E.car || E.hide)) wlTrafficBack(false);
  shared.wxBoat = E && E.boat ? E.boat : 1;
  if (!E) return;
  wlPeds(E, big);
  if (E.cold || E.look) wlChats(E);
  if (E.car || E.hide) wlTraffic(E);
  if (E.tram) wlTrams(E.tram);
  if (big && E.gather && WL.modeT % 3 === 1) wlGather(MOBILE ? 14 : 32);
  if (big && E.cold && WL.t > 8) wlCarts();
}

/* ---------- je Bild ---------- */
function wlFrame(dt) {
  WL.clock += dt;
  // Ablauf: Vorhersage -> Ereignis -> Ende
  if (WL.ev) {
    WL.t += dt;
    if (ATMO.w && ATMO.w.id !== WL.E.w) { WL.mine = false; wlEnd(false); }   // Taste N: der Spieler hat das Wetter selbst gewählt
    else if (WL.t >= WL.end) wlEnd(true);
    else if (WL.taskT > 0 && (WL.taskT -= dt) <= 0) {
      // Aufgaben anlegen; was gerade nicht geht (kein Wasser, keine Bahn in der Nähe), wird alle 10 s noch einmal versucht
      const want = WL.retry || WL.E.tasks; WL.retry = [];
      for (const k of want) { const tk = wlMakeTask(k); if (tk) WL.tasks.push(tk); else WL.retry.push(k); }
      wlPiles(); wlBoxes();
      if (!WL.toldTasks && WL.tasks.length) { WL.toldTasks = true; toast(WL.E.sub + ' · goldene Rauten zeigen den Weg'); }
      if (WL.retry.length && WL.t < WL.end - 60) WL.taskT = 10; else WL.retry = null;
    }
  } else if (WL.warn) { if ((WL.warnT -= dt) <= 0) wlStart(WL.warn); }
  else if ((WL.next -= dt) <= 0) {
    if (ATMO.pinned) WL.next = 60;   // der Spieler hat ein Wetter festgelegt: warten
    else { const ids = Object.keys(WL_EV).filter(k => k !== WL.last); let r = Math.random() * ids.reduce((a, k) => a + WL_EV[k].wgt, 0), id = ids[0]; for (const k of ids) if ((r -= WL_EV[k].wgt) <= 0) { id = k; break; } WL.last = id; wlForecast(id); }
  }
  if ((WL.tick -= dt) <= 0) { WL.tick = 1; wlCity(); }
  const mode = WL.mode, E = mode ? WL_EV[mode] : null;
  // Schollen, Sternschnuppen, Kristall
  wlFloes(dt, !!(E && E.floes));
  const mT = E && E.meteors ? (WL.ev ? 1 : 0.6) : 0, mu = WL.met.material.uniforms.uMeteor;
  mu.value += (mT - mu.value) * Math.min(1, dt * 0.3);
  WL.met.visible = mu.value > 0.01;
  if (mu.value > 0.3 && CRY.g && Math.random() < dt * 0.25) CRY.flare = Math.max(CRY.flare || 0, 0.7);   // der Kristall im Penthouse antwortet den Schnuppen
  // Rufe der Punschhändler
  if (WL.carts.length && (WL.vendT -= dt) <= 0) { WL.vendT = 3; for (const C of WL.carts) if (C.pd && wlD2(C.x, C.z) < 14 * 14) { if (lifeSay('Der Punschverkäufer', wlPick(WL_VEND), 3.5)) WL.vendT = 14; fxEmit('steam', C.x - 0.45 * Math.cos(C.yaw), C.y + 1.75, C.z + 0.45 * Math.sin(C.yaw), 0, 0.6, 0, 3, 0.2, 0.8); break; } }
  // Beifall, wenn Alexander unter dem Nordlicht über die Menge fliegt
  if (WL.ev === 'nordlicht' && !WL.flyCheer && player.fly && player.p.y > 12 && player.p.y < 220 && Math.hypot(player.p.x, player.p.z) < 110) {
    WL.flyCheer = true;
    for (const i of WL.items) if (i.k === 'gather') setAct(i.pd, 9);
    setTimeout(() => { for (const i of WL.items) if (i.k === 'gather') setAct(i.pd, 16); }, 7000);
    if (RUF.ready) rufAdd({ bew: 2, presse: 1, buerger: 1 }, 'Flug unter dem Nordlicht über die Menge');
    lifeSay('Die Menge auf dem Platz', wlPick(['Bravo! Bravo, Herr Alexander!', 'Seht doch, er fliegt durchs Nordlicht!', 'Hoch soll er leben, der Herr von Vespera!']), 4.5);
  }
  wlTasksStep(dt);
  if (WL.tasks.length || (WL.mk && WL.mk.children.length)) wlMarkers();
  if (WL.banT > 0 && (WL.banT -= dt) <= 0 && WL.ban) WL.ban.style.opacity = 0;
}
function wlLoop(now) {
  requestAnimationFrame(wlLoop);
  const dt = Math.min(0.1, Math.max(0, (now - (WL.lastTime || now)) / 1000)); WL.lastTime = now;
  if (!playing || paused || !pedCrowd) return;
  if (!WL.ready) wlInit();
  try { wlFrame(dt); } catch (e) { console.warn('Wetterlage:', e); }
}
function wlInit() {
  WL.ready = true;
  wlBuildWorld();
  WL.next = wlR(420, 660);
  const q = new URLSearchParams(location.search).get('ereignis');
  if (q && WL_EV[q]) setTimeout(() => wlStart(q, true), 1500);
  zeitungKasten('wetter', 'Wetterwarte Vespera', ['Ruhige Polarnacht', 'Nächste Meldung, sobald sich etwas zusammenbraut']);
  // Stadtkarte: offene Aufgaben als Punkte
  if (KARTE) (KARTE.live ||= []).push(() => WL.tasks.filter(t => !t.done && (t.k !== 'splitter' || t.landed)).map(t => ({ cat: 'aufgaben', icon: 'aufgabe', n: t.n, sub: WL.E ? WL.E.n : 'Wetter', x: t.x, z: t.z })));
  wlTasten();
  if (window.vespera) window.vespera.wetter = { WL, WL_EV, start: wlStart, end: wlEnd, forecast: wlForecast };
}
function wlTasten() {
  const rows = Object.keys(WL_EV).map(id => ({ id: 'wl_' + id, k: [], t: WL_EV[id].n, d: WL_EV[id].sub, an: () => WL.ev === id ? 'jetzt' : WL.warn === id ? 'naht' : '', act: () => { wlStart(id, true); return true; } }));
  rows.push({ id: 'wl_aus', k: [], t: 'Ereignis beenden', d: 'Das Wetter beruhigt sich wieder', act: () => { if (WL.ev) wlEnd(true); else toast('Gerade gibt es kein Wetterereignis'); return true; } });
  rows.unshift({ id: 'wl_info', k: ['N'], t: 'Wetter wählen', d: 'Ereignisse kündigt die Wetterwarte etwa alle 15 bis 25 Minuten an (Hinweis, Banner, Zeitung). Hier lassen sie sich sofort auslösen' });
  addTasten('wetter', rows, { titel: 'Wetter', nach: 'stadt' });
}
if (typeof window !== 'undefined' && !new URLSearchParams(location.search).get('lab')) requestAnimationFrame(wlLoop);
