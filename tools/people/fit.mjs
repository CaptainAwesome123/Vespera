// MakeHuman-Körper in die Ruhehaltung des Spiels bringen: Arme hängen, Beine stehen gerade,
// Damen auf Absätzen. Lineares Skinning mit den MakeHuman-Gewichten; Ergebnis in Metern,
// Füße auf dem Boden. Dazu die Gelenkpunkte (RIG) für den Shader und die Glied-Zuordnung.
import { jointPos } from './mh.mjs';

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const nrm = a => mul(a, 1 / (len(a) || 1));
// Drehmatrix (Zeilen) als Liste von 9 Zahlen
const mat = (c0, c1, c2) => [c0[0], c1[0], c2[0], c0[1], c1[1], c2[1], c0[2], c1[2], c2[2]];
const mT = m => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const mm = (a, b) => { const r = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j]; return r; };
export const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
function frame(axis, ref) { const e1 = nrm(axis); const e2 = nrm(sub(ref, mul(e1, dot(ref, e1)))); return mat(e1, e2, cross(e1, e2)); }
// Drehung, die (a1, r1) auf (a2, r2) legt
const align = (a1, r1, a2, r2) => mm(frame(a2, r2), mT(frame(a1, r1)));
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
// Quaternion-Slerp zwischen zwei Drehmatrizen
function toQ(m) { const t = m[0] + m[4] + m[8]; let w, x, y, z;
  if (t > 0) { const s = Math.sqrt(t + 1) * 2; w = s / 4; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s; }
  else if (m[0] > m[4] && m[0] > m[8]) { const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / s; x = s / 4; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s; }
  else if (m[4] > m[8]) { const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = s / 4; z = (m[5] + m[7]) / s; }
  else { const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = s / 4; }
  return [x, y, z, w]; }
function fromQ([x, y, z, w]) { return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; }
function slerpM(a, b, t) { const qa = toQ(a); let qb = toQ(b); let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3]; if (d < 0) { qb = qb.map(v => -v); d = -d; }
  let r; if (d > 0.9995) r = qa.map((v, i) => v + (qb[i] - v) * t); else { const th = Math.acos(d), s = Math.sin(th); r = qa.map((v, i) => (v * Math.sin((1 - t) * th) + qb[i] * Math.sin(t * th)) / s); }
  const L = Math.hypot(...r); return fromQ(r.map(v => v / L)); }

// Knochen -> Glied im Spiel (0 Rumpf, 1/2 Oberschenkel r/l, 3/4 Oberarm, 5/6 Unterschenkel, 7/8 Unterarm mit Hand)
export function limbOfBone(b) {
  const R = b.endsWith('.R'), L = b.endsWith('.L'); if (!R && !L) return 0;
  const s = R ? 0 : 1;
  if (/^upperleg/.test(b)) return 1 + s;
  if (/^(lowerleg|foot|toe)/.test(b)) return 5 + s;
  if (/^upperarm/.test(b)) return 3 + s;
  if (/^(lowerarm|wrist|metacarpal|finger)/.test(b)) return 7 + s;
  return 0;
}
const chainOf = b => { const l = limbOfBone(b); return l === 0 ? 0 : l === 1 || l === 5 ? 'legR' : l === 2 || l === 6 ? 'legL' : l === 3 || l === 7 ? 'armR' : 'armL'; };

/* Ruhehaltung des Spiels berechnen.
   v: verformtes Grundnetz (MakeHuman-Einheiten), skel, W: Gewichte je Ecke.
   o.female: Absatz (Fußspitze gesenkt), o.abd: Abspreizen der Arme (rad) */
export function makePose(v, skel, o = {}) {
  const S = 0.1;
  const J = n => mul(jointPos(skel, v, n), S);
  const head = b => J(skel.bones[b].head), tail = b => J(skel.bones[b].tail);
  const pose = {}, fingers = {};   // Knochen -> { R, P (Drehpunkt MH), T (Ziel) }
  const set = (bones, R, P, Tp) => { for (const b of bones) pose[b] = { R, P, T: Tp }; };
  const side = (s) => {
    const X = s === 'R' ? -1 : 1, sx = b => b + '.' + s;
    /* Arm: Schulter bleibt; Oberarm hängt (leicht abgespreizt, Ellbogen etwas hinten), Unterarm leicht vorn, Handfläche zum Bein, Daumen vorn */
    const Sh = head(sx('upperarm01')), El = head(sx('lowerarm01')), Wr = head(sx('wrist'));
    const Lu = len(sub(El, Sh)), Lf = len(sub(Wr, El));
    const abd = o.abd ?? 0.07;
    const dU = nrm([X * Math.sin(abd), -1, -0.07]), Et = add(Sh, mul(dU, Lu));
    const dF = nrm([X * Math.sin(abd * 0.4), -1, 0.27]), Wt = add(Et, mul(dF, Lf));
    const Rua = align(sub(El, Sh), sub(Wr, El), dU, dF);
    const Rfa = align(sub(Wr, El), sub(Sh, El), dF, mul(dU, -1));
    // Hand: Achse Handgelenk -> Mittelfingerknöchel, quer vom kleinen Finger zum Zeigefinger
    const K3 = head(sx('finger3-1')), K2 = head(sx('finger2-1')), K5 = head(sx('finger5-1'));
    const hAx = sub(K3, Wr), hAcr = sub(K2, K5);
    const tAx = nrm(add(dF, [0, -0.15, -0.05])), tAcr = [X * 0.12, 0, 1];
    const Rh = align(hAx, hAcr, tAx, tAcr);
    set([sx('upperarm01'), sx('upperarm02')], Rua, Sh, Sh);
    set([sx('lowerarm01')], slerpM(Rfa, Rh, 0.25), El, Et);
    set([sx('lowerarm02')], slerpM(Rfa, Rh, 0.7), El, Et);
    const hand = Object.keys(skel.bones).filter(b => b.endsWith('.' + s) && /^(wrist|metacarpal|finger)/.test(b));
    // Hand dreht um das Handgelenk; das Handgelenk liegt am Ende des Unterarms
    set(hand, Rh, Wr, Wt);
    // V32: Finger in entspannter Haltung (leicht gebeugt, aneinander, Daumen locker zur Handfläche) statt flach gespreizt;
    // dazu je Fingergelenk Lage und Beugeachse in der Ruhehaltung des Spiels (für das Greifen im Shader)
    fingers[s] = fingerPose(skel, head, tail, pose, sx, Rh, Wr, Wt, o.curl ?? 1);
    /* Bein: Hüfte bleibt, Knie und Knöchel senkrecht darunter (Füße etwa hüftbreit) */
    const H = head(sx('upperleg01')), K = head(sx('lowerleg01')), A = head(sx('foot'));
    const Lt = len(sub(K, H)), Ls = len(sub(A, K));
    const fx = o.footX ?? 0.92;
    const Kt = [H[0] * (1 + (fx - 1) * 0.5), H[1] - Lt * 0.999, H[2] + 0.004], At = [H[0] * fx, Kt[1] - Ls * 0.999, H[2] - 0.006];
    const Rth = align(sub(K, H), [0, 0, 1], sub(Kt, H), [0, 0, 1]);
    const Rsh = align(sub(A, K), [0, 0, 1], sub(At, Kt), [0, 0, 1]);
    let Rft = Rsh;
    // Fußspitze leicht nach außen wie im Stand
    if (o.heel) Rft = mm(rotX(o.heel), Rsh);
    set([sx('upperleg01'), sx('upperleg02')], Rth, H, H);
    set([sx('lowerleg01'), sx('lowerleg02')], Rsh, K, Kt);
    const foot = Object.keys(skel.bones).filter(b => b.endsWith('.' + s) && /^(foot|toe)/.test(b));
    set(foot, Rft, A, At);
    return { Sh, Et, Wt, Lu, Lf, H, Kt, At };
  };
  const r = side('R'), l = side('L');
  return { pose, R: r, L: l, fingers };
}

// Drehmatrix um eine Achse (Rodrigues)
export function rotAxis(a, t) {
  const [x, y, z] = nrm(a), c = Math.cos(t), s = Math.sin(t), C = 1 - c;
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
// Entspannte Hand: Grund-, Mittel- und Endgelenke je Finger leicht gebeugt (kleiner Finger mehr), Finger zum Mittelfinger hin
// geschlossen, Daumen zur Handfläche. Vorwärtskinematik über die Fingerknochen; je Gelenk: Lage und Beugeachse nach dem Stellen
export const RELAX = {
  bend: [[0.55, 0.22, 0.25], [0.26, 0.36, 0.2], [0.32, 0.44, 0.24], [0.4, 0.5, 0.28], [0.48, 0.56, 0.32]],   // Daumen, Zeige-, Mittel-, Ring-, kleiner Finger
  close: [0, 0.7, 0, 0.6, 0.55],                                                                    // Anteil des Spreizwinkels, der geschlossen wird
};
function fingerPose(skel, head, tail, pose, sx, Rh, Wr, Wt, k) {
  const K2 = head(sx('finger2-1')), K3 = head(sx('finger3-1')), K5 = head(sx('finger5-1'));
  // Handflächennormale: senkrecht zu Knöchelreihe und Handachse, zur Seite des Daumens (Handfläche)
  let n = nrm(cross(sub(K2, K5), sub(K3, Wr)));
  const tTip = tail(sx('finger1-3'));
  if (dot(sub(tTip, K3), n) < 0) n = mul(n, -1);
  const Xp = p => add(Wt, mv(Rh, sub(p, Wr)));
  const dir3 = nrm(sub(tail(sx('finger3-1')), K3));
  const palmC = add(mul(add(Wr, K3), 0.5), mul(n, 0.02));   // Mitte der Handfläche, etwas davor: dorthin greift der Daumen
  const out = [];
  for (let f = 1; f <= 5; f++) {
    let Rp = Rh, Tp = p => Xp(p);
    const joints = [];
    for (let j = 1; j <= 3; j++) {
      const b = sx(`finger${f}-${j}`), h = head(b), d = nrm(sub(tail(b), h));
      let Q = [1, 0, 0, 0, 1, 0, 0, 0, 1], ax;
      if (f === 1 && j === 1) {
        // Daumen: liegt locker neben dem Zeigefinger, etwas vor der Handfläche (statt weit abgespreizt)
        const to = nrm(add(nrm(sub(tail(sx('metacarpal1')), head(sx('metacarpal1')))), mul(n, 0.7)));
        ax = nrm(cross(d, to));
      } else if (f === 1) ax = nrm(cross(d, nrm(sub(palmC, h))));
      else {
        let dd = d;
        if (j === 1 && RELAX.close[f - 1]) {
          // Finger zum Mittelfinger hin schließen (in der Ebene der Handfläche)
          const pr = v => nrm(sub(v, mul(n, dot(v, n))));
          const a = pr(d), b3 = pr(dir3), ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b3)))) * RELAX.close[f - 1];
          if (ang > 1e-4) { Q = rotAxis(cross(a, b3), ang); dd = mv(Q, d); }
        }
        ax = nrm(cross(dd, n));
      }
      const th = RELAX.bend[f - 1][j - 1] * k;
      Q = mm(rotAxis(ax, th), Q);
      const T = Tp(h), R = mm(Rp, Q);
      pose[b] = { R, P: h, T };
      // Greifachse: für den Daumen zur Mitte der Handfläche (nach dem Stellen des Grundgelenks)
      const gax = f === 1 && j === 1 ? nrm(cross(mv(Q, d), nrm(sub(palmC, h)))) : ax;
      joints.push({ J: T, A: nrm(mv(Rp, gax)) });
      Rp = R; Tp = p => add(T, mv(R, sub(p, h)));
    }
    out.push(joints);
  }
  return out;
}

// Punkte verformen: w = Liste [knochen, gewicht]
export function skinPoint(p, n, w, pose) {
  let x = [0, 0, 0], y = [0, 0, 0], tw = 0;
  for (const [b, g] of w) {
    const P = pose[b]; tw += g;
    if (!P) { x = add(x, mul(p, g)); if (n) y = add(y, mul(n, g)); continue; }
    x = add(x, mul(add(P.T, mv(P.R, sub(p, P.P))), g));
    if (n) y = add(y, mul(mv(P.R, n), g));
  }
  if (tw < 1e-6) return [p, n];
  return [mul(x, 1 / tw), n ? nrm(y) : null];
}

// Gewichte zusammenfassen: Glied (Kette) mit Anteil; Rumpf hat Glied 0
export function limbBlend(w) {
  const by = {}; let tw = 0;
  for (const [b, g] of w) { const l = limbOfBone(b); by[l] = (by[l] || 0) + g; tw += g; }
  // stärkstes Glied außerhalb des Rumpfs
  let best = 0, bw = 0;
  for (const k in by) if (+k && by[k] > bw) { bw = by[k]; best = +k; }
  if (!best || tw < 1e-6) return { limb: 0, w: 0 };
  // Kette: Ober- und Unterteil desselben Arms/Beins zählen zusammen
  const pair = { 1: 5, 5: 1, 2: 6, 6: 2, 3: 7, 7: 3, 4: 8, 8: 4 }[best];
  const chainW = (bw + (by[pair] || 0)) / tw;
  return { limb: best, w: Math.min(1, chainW) };
}
