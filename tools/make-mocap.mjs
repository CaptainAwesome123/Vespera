// V26 · Motion Capture aus der CMU-Datenbank (BVH von cgspeed, frei nutzbar ohne Einschränkung) in die
// Gelenkkanäle des Figuren-Shaders umrechnen (src/people-skeleton.js, src/mocap.js).
// Aufruf: node tools/make-mocap.mjs <bvh-ordner> assets/people [three-ordner]
//   BVH-Dateien: git clone https://github.com/Shriinivas/cmubvh (Sequence-*/NN/Data/NN_MM.zip entpacken)
// Ausgabe: mocap.bin (Int16, Wert * 1000, 32 Kanäle je Bild, 30 Bilder/s) + mocap.json (Clips, Längen, Herkunft)
//
// Kanäle je Bild (alles im Körperraum des Spiels: +x links, +y oben, +z vorn):
//  0-2  Becken-Mitte x, y, z  (x/z durch Beinlänge, bei Gang und Lauf z durch Schrittlänge; y: Höhe über Standknöchel / Beinlänge)
//  3-5  Becken pvP, pvR, pvY     6-8  Oberkörper spP, spR, spY     9-11 Kopf nkP, nkR, nkY
//  12-15 rechter Fuß x, y, z, Neigung phi   16-19 linker Fuß
//  20-23 rechter Arm uaP, uaA, uaT, elF     24-27 linker Arm      28-29 Handgelenk rechts, links   30-31 frei
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const [,, bvhDir, outDir, threeDir] = process.argv;
const require = createRequire(import.meta.url);
const THREE = await import(path.resolve(threeDir || 'node_modules/three', 'build/three.module.js'));
const { Vector3: V3, Quaternion: Q, Euler: E, Matrix4: M4 } = THREE;

/* ---------- BVH lesen und vorwärts rechnen ---------- */
function parseBVH(txt) {
  const tok = txt.split(/\s+/).filter(Boolean); let i = 0;
  const joints = [], stack = [];
  while (tok[i] !== 'MOTION') {
    const t = tok[i++];
    if (t === 'ROOT' || t === 'JOINT' || t === 'End') {
      const name = t === 'End' ? stack[stack.length - 1].name + '_end' : tok[i++]; if (t === 'End') i++;
      const j = { name, parent: stack.length ? stack[stack.length - 1] : null, offset: null, ch: [], end: t === 'End' };
      joints.push(j); stack.push(j);
    } else if (t === 'OFFSET') { stack[stack.length - 1].offset = [+tok[i++], +tok[i++], +tok[i++]]; }
    else if (t === 'CHANNELS') { const n = +tok[i++], j = stack[stack.length - 1]; for (let k = 0; k < n; k++) j.ch.push(tok[i++]); }
    else if (t === '}') stack.pop();
  }
  i++; i++; const nF = +tok[i++]; i += 2; const dt = +tok[i++];
  const nCh = joints.reduce((s, j) => s + j.ch.length, 0), data = new Float32Array(nF * nCh);
  for (let k = 0; k < nF * nCh; k++) data[k] = +tok[i++];
  return { joints, nF, dt, nCh, data, byName: Object.fromEntries(joints.map(j => [j.name, j])) };
}
const D2R = Math.PI / 180;
function fk(b, f) {
  // Welt-Lage jedes Gelenks: Position und Drehung
  let c = f * b.nCh; const out = new Map();
  for (const j of b.joints) {
    const p = new V3(...j.offset), q = new Q();
    for (const ch of j.ch) {
      const v = b.data[c++];
      if (ch === 'Xposition') p.x = v; else if (ch === 'Yposition') p.y = v; else if (ch === 'Zposition') p.z = v;
      else { const ax = ch[0] === 'X' ? new V3(1, 0, 0) : ch[0] === 'Y' ? new V3(0, 1, 0) : new V3(0, 0, 1); q.multiply(new Q().setFromAxisAngle(ax, v * D2R)); }
    }
    if (j.parent) { const P = out.get(j.parent); p.applyQuaternion(P.q).add(P.p); q.premultiply(P.q); }
    out.set(j, { p, q });
  }
  const r = {}; for (const [j, v] of out) r[j.name] = v; return r;
}

/* ---------- Spielskelett in Ruhe (Herren-Rig aus people.json) ---------- */
const RIG = JSON.parse(fs.readFileSync(path.join(outDir, 'people.json'), 'utf8')).rig.m;
const ARM_REST = sd => {
  const S = new V3(sd * RIG.shX, RIG.top, RIG.shZ), El = new V3(sd * RIG.el[0], RIG.el[1], RIG.el[2]), W = new V3(sd * RIG.wr[0], RIG.wr[1], RIG.wr[2]);
  return { u: El.clone().sub(S), f: W.clone().sub(El) };
};
const rX = (v, a) => v.clone().applyAxisAngle(new V3(1, 0, 0), a);
const angle = (a, b) => a.angleTo(b);
// Basis aus zwei Richtungen
function basis(a, b) { const x = a.clone().normalize(), z = new V3().crossVectors(x, b).normalize(), y = new V3().crossVectors(z, x); return new M4().makeBasis(x, y, z); }
const wrap = x => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));
const near = (a, b) => b + wrap(a - b);

/* ---------- Kanäle eines Bildes ---------- */
function frameChannels(J, body, prev) {
  // body: { o: Ursprung (Welt), yaw: Blickrichtung (rad, um +y; 0 = +z) }
  const qB = new Q().setFromAxisAngle(new V3(0, 1, 0), body.yaw), qBi = qB.clone().invert();
  const loc = p => p.clone().sub(body.o).applyQuaternion(qBi);
  const lq = q => qBi.clone().multiply(q);
  const hips = lq(J.Hips.q), chest = lq(J.Spine1.q), head = lq(J.Head.q);
  const pel = loc(J.LeftUpLeg.p).add(loc(J.RightUpLeg.p)).multiplyScalar(0.5);
  const ch = new Array(32).fill(0);
  ch[0] = pel.x; ch[1] = pel.y; ch[2] = pel.z;
  let e = new E().setFromQuaternion(hips, 'YXZ'); ch[3] = e.x; ch[4] = e.z; ch[5] = e.y;
  e = new E().setFromQuaternion(hips.clone().invert().multiply(chest), 'YXZ'); ch[6] = e.x; ch[7] = -e.z; ch[8] = e.y;
  e = new E().setFromQuaternion(chest.clone().invert().multiply(head), 'YXZ'); ch[9] = e.x; ch[10] = -e.z; ch[11] = e.y;
  // Füße: Knöchel und Neigung (Zehen hoch = positiv), Ruhe-Neigung abgezogen
  for (const [k, sd] of [[12, 'Right'], [16, 'Left']]) {
    const a = loc(J[sd + 'Foot'].p), t = loc(J[sd + 'ToeBase'].p), d = t.clone().sub(a);
    ch[k] = a.x; ch[k + 1] = a.y; ch[k + 2] = a.z; ch[k + 3] = Math.atan2(d.y, Math.hypot(d.x, d.z)) - body.toeRest;
  }
  // Arme im Brustraum
  const cw = J.Spine1.q.clone().invert();
  for (const [k, sdN, sd, wk] of [[20, 'Right', -1, 28], [24, 'Left', 1, 29]]) {
    const S = J[sdN + 'Arm'].p, El = J[sdN + 'ForeArm'].p, W = J[sdN + 'Hand'].p, H = J[sdN + 'HandIndex1'].p;
    const um = El.clone().sub(S).applyQuaternion(cw), fm = W.clone().sub(El).applyQuaternion(cw), hm = H.clone().sub(W).applyQuaternion(cw);
    const R0 = ARM_REST(sd), want = angle(um, fm);
    // Ellbogen: Beugung so, dass der Winkel zwischen Ober- und Unterarm stimmt
    let lo = -0.2, hi = 2.95; for (let it = 0; it < 40; it++) { const m = (lo + hi) / 2; if (angle(R0.u, rX(R0.f, -m)) < want) lo = m; else hi = m; }
    const el = (lo + hi) / 2, fb = rX(R0.f, -el);
    // Drehung aus der Lage des Oberarm-Knochens (enthält die Verdrehung), bei gebeugtem Arm aus Ober- und Unterarm
    const C = new Q().setFromAxisAngle(new V3(0, 0, 1), sd * Math.PI / 2);   // Spiel-Ruhe (Arm hängt) -> CMU-Ruhe (T-Pose)
    const Rq = cw.clone().multiply(J[sdN + 'Arm'].q).multiply(C);
    const fq = fb.clone().applyQuaternion(Rq);
    const w = Math.min(1, Math.max(0, (want - 0.25) / 0.35));
    const second = fq.clone().normalize().multiplyScalar(1 - w).add(fm.clone().normalize().multiplyScalar(w));
    const Rm = basis(um, second).multiply(basis(R0.u, fb).invert());
    const ea = new E().setFromRotationMatrix(Rm, 'XZY');
    // zwei gleichwertige Lösungen: die nähere zum letzten Bild
    let x = ea.x, y = ea.y, z = ea.z;
    const alt = [x + Math.PI, y + Math.PI, Math.PI - z];
    const p = prev ? [-prev[k] , -sd * prev[k + 2], sd * prev[k + 1]] : [0, 0, 0];
    const dist = (a, b, c) => Math.abs(wrap(a - p[0])) + Math.abs(wrap(b - p[1])) + Math.abs(wrap(c - p[2]));
    if (dist(...alt) < dist(x, y, z)) [x, y, z] = alt;
    x = near(x, p[0]); y = near(y, p[1]); z = near(z, p[2]);
    ch[k] = -x; ch[k + 1] = sd * z; ch[k + 2] = -sd * y; ch[k + 3] = el;
    // Handgelenk: Hand gegen den Unterarm im Armraum
    const toArm = new Q().setFromRotationMatrix(Rm).invert(), hl = hm.clone().applyQuaternion(toArm).applyAxisAngle(new V3(1, 0, 0), el);
    ch[wk] = Math.atan2(hl.z, -hl.y) - Math.atan2(R0.f.z, -R0.f.y);
    // Probe mit den Formeln des Shaders (armRot, Ellbogen rX(-e)): Richtungen von Ober- und Unterarm
    const ap = ch[k], aa = ch[k + 1], at = ch[k + 2];
    const armRot = v => rX(v.clone().applyAxisAngle(new V3(0, 1, 0), -sd * at).applyAxisAngle(new V3(0, 0, 1), sd * aa), -ap);
    const eu = armRot(R0.u).normalize().distanceTo(um.clone().normalize()), ef = armRot(fb).normalize().distanceTo(fm.clone().normalize());
    body.err = Math.max(body.err || 0, eu, ef);
  }
  // Probe Rumpf: Brust-Hochachse aus Becken * Oberkörper (Shader-Reihenfolge) gegen die Aufnahme
  const g = v => v.clone().applyAxisAngle(new V3(0, 0, 1), -ch[7]).applyAxisAngle(new V3(1, 0, 0), ch[6]).applyAxisAngle(new V3(0, 1, 0), ch[8]);
  const pv = v => v.clone().applyAxisAngle(new V3(0, 0, 1), ch[4]).applyAxisAngle(new V3(1, 0, 0), ch[3]).applyAxisAngle(new V3(0, 1, 0), ch[5]);
  for (const ax of [new V3(0, 1, 0), new V3(0, 0, 1)]) body.err2 = Math.max(body.err2 || 0, pv(g(ax)).distanceTo(ax.clone().applyQuaternion(chest)));
  return ch;
}

/* ---------- Glätten, Abtasten, Schleifen ---------- */
function gauss(arr, sig) {
  if (sig <= 0) return arr.slice(); const r = Math.ceil(sig * 3), out = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) { let s = 0, w = 0; for (let k = -r; k <= r; k++) { const j = Math.min(arr.length - 1, Math.max(0, i + k)), g = Math.exp(-k * k / (2 * sig * sig)); s += arr[j] * g; w += g; } out[i] = s / w; }
  return out;
}
function unwrapList(a) { for (let i = 1; i < a.length; i++) a[i] = near(a[i], a[i - 1]); return a; }

function processClip(def) {
  const b = parseBVH(fs.readFileSync(path.join(bvhDir, def.file + '.bvh'), 'utf8'));
  const fps = def.fps || 1 / b.dt,   // manche CMU-Aufnahmen (Personen 93, 114) haben 60 Bilder/s, die BVH-Datei sagt 120
   f0 = Math.round((def.from || 0) * fps), f1 = Math.min(b.nF, def.to ? Math.round(def.to * fps) : b.nF);
  const Js = []; for (let f = f0; f < f1; f++) Js.push(fk(b, f));
  // Maße: Beinlänge (Hüfte bis Knöchel) in Ruhe, Zehenneigung in Ruhe
  const off = n => new V3(...b.byName[n].offset);
  const legL = off('LeftLeg').length() + off('LeftFoot').length(), toe = off('LeftToeBase'), toeRest = Math.atan2(toe.y, Math.hypot(toe.x, toe.z));
  // Bodenhöhe: niedrige Knöchelhöhe (Standbein)
  const ank = Js.map(J => Math.min(J.LeftFoot.p.y, J.RightFoot.p.y)).sort((a, c) => a - c), ground = ank[Math.floor(ank.length * 0.05)];
  // Körperrahmen: Ursprung und Richtung
  const n = Js.length, yawH = unwrapList(Js.map(J => { const f = new V3(0, 0, 1).applyQuaternion(J.Hips.q); return Math.atan2(f.x, f.z); }));
  let ox, oz, yaw;
  if (def.loco) {
    // Gang: gleichmäßige Bewegung entlang der mittleren Richtung über den Zyklus
    const px = Js.map(J => J.Hips.p.x), pz = Js.map(J => J.Hips.p.z), fitL = a => { const m = (n - 1) / 2; let sx = 0, sy = 0, sxy = 0, sxx = 0; a.forEach((v, i) => { sx += i; sy += v; sxy += i * v; sxx += i * i; }); const k = (n * sxy - sx * sy) / (n * sxx - sx * sx); return a.map((_, i) => sy / n + k * (i - m)); };
    ox = fitL(px); oz = fitL(pz); const dir = Math.atan2(ox[n - 1] - ox[0], oz[n - 1] - oz[0]); yaw = new Array(n).fill(dir);
  } else {
    const sig = (def.smooth || 1.2) * fps;
    ox = gauss(Js.map(J => J.Hips.p.x), sig); oz = gauss(Js.map(J => J.Hips.p.z), sig); yaw = gauss(yawH, sig);
  }
  const rows = [];
  let prev = null, err = 0, err2 = 0;
  for (let i = 0; i < n; i++) {
    const body = { o: new V3(ox[i], ground, oz[i]), yaw: yaw[i], toeRest };
    const ch = frameChannels(Js[i], body, prev); err = Math.max(err, body.err); err2 = Math.max(err2, body.err2); prev = ch; rows.push(ch);
  }
  // Gangzyklus: Länge aus der Selbstähnlichkeit des rechten Fußes (vor/zurück) suchen
  if (def.loco && Array.isArray(def.period)) {
    const z = rows.map(r => r[14]), m = z.reduce((a, c) => a + c, 0) / n; let best = -1e9, bl = 0;
    for (let L = Math.round(def.period[0] * fps); L <= Math.round(def.period[1] * fps) && L < n - 10; L++) { let s = 0; for (let i = 0; i + L < n; i++) s += (z[i] - m) * (z[i + L] - m); s /= n - L; if (s > best) { best = s; bl = L; } }
    def.period = bl / fps;
  }
  // Winkel stetig machen
  for (let c = 3; c < 32; c++) if (c < 12 || c > 19 || c === 15 || c === 19) { const col = unwrapList(rows.map(r => r[c])); rows.forEach((r, i) => r[c] = col[i]); }
  // Längen: x/y/z durch Beinlänge; Höhe über Standknöchel
  const stride = def.loco ? Math.hypot(ox[n - 1] - ox[0], oz[n - 1] - oz[0]) / ((n - 1) / fps) * def.period : 0;
  for (const r of rows) {
    for (const k of [0, 12, 16]) { r[k] /= legL; r[k + 1] /= legL; r[k + 2] /= def.loco ? stride : legL; }
  }
  // auf 30 Bilder/s abtasten (vorher glätten)
  const rate = def.rate || 30, step = fps / rate, cols = [];
  for (let c = 0; c < 32; c++) cols.push(gauss(rows.map(r => r[c]), step * 0.45));
  let out = [];
  for (let t = 0; t <= n - 1; t += step) { const i = Math.floor(t), u = t - i, j = Math.min(n - 1, i + 1); out.push(cols.map(col => col[i] * (1 - u) + col[j] * u)); }
  if (def.loop) {
    // Zyklus: Länge period (s), Beginn beim Aufsetzen der rechten Ferse (rechter Fuß am weitesten vorn)
    const P = Math.round(def.period * rate);
    let s0 = def.start != null ? Math.round(def.start * rate) : 0;
    if (def.loco) { let best = -1e9; for (let i = s0; i < s0 + P && i < out.length; i++) if (out[i][14] > best) { best = out[i][14]; s0 = i; } }
    let cyc = out.slice(s0, s0 + P + 1);
    if (cyc.length < P + 1) throw new Error(def.name + ': zu kurz für den Zyklus');
    // Sprung am Ende wegnehmen: Unterschied linear über den Zyklus verteilen
    for (let c = 0; c < 32; c++) { const d = cyc[P][c] - cyc[0][c]; cyc.forEach((r, i) => r[c] -= d * i / P); }
    out = cyc;   // letztes Bild = erstes (für weiche Übergänge beim Abtasten)
  } else if (def.blend) {
    // Endlos: Ende ins Anfangsstück überblenden
    const B = Math.round(def.blend * rate), L = out.length - B;
    const res = out.slice(0, L).map(r => r.slice());
    for (let i = 0; i < B; i++) { const w = i / B; for (let c = 0; c < 32; c++) res[i][c] = out[L + i][c] * (1 - w) + out[i][c] * w; }
    res.push(res[0].slice()); out = res;
  }
  // nur die Bewegung um die Mittellage (Sitzen: der Shader legt sie auf die eigene Sitzhaltung)
  if (def.center) for (let c = 3; c < 12; c++) { const m = out.reduce((a, r) => a + r[c], 0) / out.length; out.forEach(r => r[c] -= m); }
  const info = { name: def.name, period: def.loop ? +def.period.toFixed(3) : undefined, src: def.file, frames: out.length, rate, sec: +((out.length - 1) / rate).toFixed(3), loop: !!(def.loop || def.blend), legL: +legL.toFixed(3), stride: +stride.toFixed(3), armErr: +err.toFixed(3), torsoErr: +err2.toFixed(3) };
  return { info, out };
}

/* ---------- Auswahl der Clips ---------- */
const CLIPS = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'mocap-clips.json'), 'utf8'));
const all = [], meta = { comment: 'V26 Motion Capture: CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu), BVH-Fassung von cgspeed (Bruce Hahne); CMU und cgspeed geben die Daten ohne Einschränkung frei. Umgerechnet von tools/make-mocap.mjs.', channels: 32, scale: 1000, clips: {} };
let row = 0;
for (const def of CLIPS) {
  const { info, out } = processClip(def);
  info.row = row; row += out.length; all.push(...out); meta.clips[def.name] = info;
  const rng = c => { const v = out.map(r => r[c]); return [Math.min(...v).toFixed(2), Math.max(...v).toFixed(2)]; };
  console.log(def.name, JSON.stringify(info), 'pel y', rng(1), 'pvP', rng(3), 'spP', rng(6), 'uaP R', rng(20), 'el R', rng(23), 'foot z', rng(14), 'phi', rng(15));
}
meta.frames = row;
const buf = new Int16Array(row * 32);
all.forEach((r, i) => r.forEach((v, c) => { buf[i * 32 + c] = Math.max(-32767, Math.min(32767, Math.round(v * 1000))); }));
fs.writeFileSync(path.join(outDir, 'mocap.bin'), Buffer.from(buf.buffer));
fs.writeFileSync(path.join(outDir, 'mocap.json'), JSON.stringify(meta, null, 1));
console.log('Bilder', row, 'Bytes', buf.byteLength);
