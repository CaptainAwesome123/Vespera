'use strict';
/* =====================================================================
   V17 · RAGDOLL: wer vom Wagen erfasst wird, fliegt als Gliederpuppe.
   15 Punkte (Verlet) mit festen Abständen, Boden und Wagen als Hindernis;
   jedes Körperteil ist ein eigenes Netz aus dem feinen Modell und folgt
   seinen zwei Punkten. Danach steht die Figur auf, schimpft und geht weiter.
   ===================================================================== */
const RAG = { pool: [], max: MOBILE ? 2 : 4, sub: {}, live: [] };
// Gelenke im Modell (Mann / Frau), passend zur Geometrie aus personBuild
function ragJoints(fem) {
  const hip = fem ? 0.88 : 0.95, hx = fem ? 0.085 : 0.1, knee = hip * 0.52, ank = fem ? 0.1 : 0.09;
  const top = fem ? 1.31 : 1.34, sx = fem ? 0.178 : 0.215, ex = sx + 0.022, wx = sx + 0.008, len = fem ? 0.54 : 0.56;
  const headC = fem ? 1.58 : 1.62;
  return [[0, hip, 0], [0, headC - 0.15, 0], [0, headC + 0.1, 0.01],
    [-sx, top, 0], [sx, top, 0], [-ex, top - len * 0.5, -0.025], [ex, top - len * 0.5, -0.025], [-wx, top - len, 0.05], [wx, top - len, 0.05],
    [-hx, hip, 0], [hx, hip, 0], [-hx, knee, 0], [hx, knee, 0], [-hx, ank, 0], [hx, ank, 0]];
}
// Körperteile: Glied-Nummer im Modell -> [Gelenkpunkt, Endpunkt]
const RAG_PARTS = [[0, 0, 1], [1, 9, 11], [2, 10, 12], [3, 3, 5], [4, 4, 6], [5, 11, 13], [6, 12, 14], [7, 5, 7], [8, 6, 8]];
const RAG_LINKS = (() => {
  const L = [], torso = [0, 1, 3, 4, 9, 10];
  for (let i = 0; i < torso.length; i++) for (let j = i + 1; j < torso.length; j++) L.push([torso[i], torso[j]]);
  for (const k of [1, 3, 4, 0]) L.push([2, k]);
  for (const [a, b] of [[3, 5], [5, 7], [4, 6], [6, 8], [9, 11], [11, 13], [10, 12], [12, 14]]) L.push([a, b]);
  // weiche Grenzen: Knie und Ellbogen knicken nicht ganz zusammen
  for (const [a, b] of [[9, 13], [10, 14], [3, 7], [4, 8], [0, 11], [0, 12]]) L.push([a, b, 1]);
  return L;
})();
// Teilnetze je Art (aus dem mittleren Modell), Glied für Glied
function ragSub(kind) {
  if (RAG.sub[kind]) return RAG.sub[kind];
  const g = personShare(kind, 1), lb = g.attributes.aLimb.array, I = g.index.array, out = [];
  for (const [limb] of RAG_PARTS) {
    const idx = [];
    for (let i = 0; i < I.length; i += 3) { const a = I[i], b = I[i + 1], c = I[i + 2]; if (Math.round(lb[a * 2]) === limb && Math.round(lb[b * 2]) === limb && Math.round(lb[c * 2]) === limb) idx.push(a, b, c); }
    out.push(idx.length ? (g.attributes.position.count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)) : null);
  }
  return (RAG.sub[kind] = { g, idx: out });
}
function ragSlot() {
  let s = RAG.pool.find(s => !s.busy);
  if (!s && RAG.pool.length < RAG.max) {
    s = { parts: [], busy: false };
    for (let i = 0; i < RAG_PARTS.length; i++) {
      const geo = new T.BufferGeometry(); geo.setAttribute('aGait', new T.InstancedBufferAttribute(new Float32Array(4), 4));
      const im = new T.InstancedMesh(geo, MAT.cloth, 1); im.frustumCulled = false; im.matrixAutoUpdate = false; im.visible = false;
      im.setMatrixAt(0, new T.Matrix4()); im.setColorAt(0, new T.Color(1, 1, 1)); scene.add(im); s.parts.push(im);
    }
    RAG.pool.push(s);
  }
  return s;
}
const _gq = new T.Quaternion(), _gq2 = new T.Quaternion(), _gm = new T.Matrix4(), _gv = new T.Vector3(), _gv2 = new T.Vector3(), _gS = new T.Vector3(), _gP = new T.Vector3(), _gQ = new T.Quaternion();
// Anfahren: Figur wird zur Puppe; Wagengeschwindigkeit geht vor allem in die Beine
function ragStart(pd, B) {
  const s = ragSlot(); if (!s) return false;
  const a = pd.a, fem = a.kind === 'lady' || a.kind === 'gown' || a.kind === 'dress', J = ragJoints(fem), sub = ragSub(a.kind);
  if (pd.st === 7) { const P = pd.mp; endMeet(pd); if (P) endMeet(P); }
  a.m.decompose(_gP, _gQ, _gS);
  const sp = Math.hypot(B.vx, B.vz), ux = B.vx / sp, uz = B.vz / sp;
  const p = [], q = [], rest = [];
  for (let i = 0; i < J.length; i++) {
    _gv.set(J[i][0], J[i][1], J[i][2]).multiply(_gS).applyQuaternion(_gQ).add(_gP); p.push([_gv.x, _gv.y, _gv.z]); rest.push([J[i][0], J[i][1], J[i][2]]);
    const h = J[i][1], k = 1.0 - 0.32 * Math.min(1, h / 1.7), up = 2.0 + sp * 0.12;
    const dt = 1 / 60, jit = () => (Math.random() - 0.5) * 0.4;
    q.push([_gv.x - (ux * sp * k + jit()) * dt, _gv.y - up * dt, _gv.z - (uz * sp * k + jit()) * dt]);
  }
  const L = RAG_LINKS.map(([i, j, soft]) => [i, j, Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]), soft]);
  for (let k = 0; k < RAG_PARTS.length; k++) {
    const im = s.parts[k], geo = im.geometry, ix = sub.idx[k];
    for (const n of ['position', 'normal', 'uv', 'color', 'aLimb', 'aOpt', 'aSoft']) if (sub.g.attributes[n]) geo.setAttribute(n, sub.g.attributes[n]);
    if (ix) { geo.setIndex(new T.BufferAttribute(ix, 1)); im.visible = true; } else im.visible = false;
    geo.attributes.aGait.setXYZW(0, a.gait[0], 99, 0, a.gait[3] || 0); geo.attributes.aGait.needsUpdate = true;
    geo.boundingSphere = sub.g.boundingSphere;
    im.setColorAt(0, _cc.setRGB(a.color[0], a.color[1], a.color[2])); im.instanceColor.needsUpdate = true;
  }
  s.busy = true; s.pd = pd; s.p = p; s.q = q; s.L = L; s.rest = rest; s.S = _gS.clone(); s.t = 0; s.ph = 'fly'; s.B = B; s.fem = fem;
  pd.rag = s; a.on = false; RAG.live.push(s);
  B.vx *= 0.93; B.vz *= 0.93;
  if (typeof sfx === 'function') try { sfx('thud'); } catch (e) { }
  return true;
}
// Punkte bewegen, Abstände halten, Boden und Wagen
function ragStep(s, dt) {
  const p = s.p, q = s.q, g = -9.81 * dt * dt;
  for (let i = 0; i < p.length; i++) {
    const P = p[i], Q = q[i], vx = (P[0] - Q[0]) * 0.995, vy = (P[1] - Q[1]) * 0.995, vz = (P[2] - Q[2]) * 0.995;
    Q[0] = P[0]; Q[1] = P[1]; Q[2] = P[2]; P[0] += vx; P[1] += vy + g; P[2] += vz;
  }
  const B = s.B, live = B && BODIES.has(B);
  for (let it = 0; it < 10; it++) {
    for (const [i, j, d, soft] of s.L) {
      const A = p[i], C = p[j], dx = C[0] - A[0], dy = C[1] - A[1], dz = C[2] - A[2], l = Math.hypot(dx, dy, dz) || 1e-6;
      if (soft && l > d * 0.55) continue;
      const k = (soft ? (l - d * 0.55) : (l - d)) / l * 0.5;
      A[0] += dx * k; A[1] += dy * k; A[2] += dz * k; C[0] -= dx * k; C[1] -= dy * k; C[2] -= dz * k;
    }
    for (let i = 0; i < p.length; i++) {
      const P = p[i], Q = q[i], r = i === 2 ? 0.1 : 0.06;
      if (live) {
        // Wagen als Kasten: Motorhaube vorn niedrig, Dach in der Mitte
        const fx = Math.cos(B.h), fz = -Math.sin(B.h), dx = P[0] - B.x, dz = P[2] - B.z;
        const lf = dx * fx + dz * fz, ls = -dx * fz + dz * fx, hl = B.hl + 0.1, hw = B.hw + 0.06;
        const top = B.y + (Math.abs(lf) > 1.0 ? 1.02 : 1.55);
        if (Math.abs(lf) < hl && Math.abs(ls) < hw && P[1] < top + r) {
          const pu = top + r - P[1], pf = hl - Math.abs(lf), ps = hw - Math.abs(ls);
          // aus dem Wagen schieben; die Geschwindigkeit nimmt der Punkt vom Wagen, nicht vom Schub
          if (pu < Math.min(pf, ps) + 0.25) { P[1] = top + r; Q[1] = Math.min(Q[1], P[1]) ; Q[1] = Math.max(Q[1], P[1] - 1.2 * dt); }
          else if (pf < ps) { const sg = Math.sign(lf) || 1; P[0] += fx * sg * pf; P[2] += fz * sg * pf; }
          else { const sg = Math.sign(ls) || 1; P[0] += -fz * sg * ps; P[2] += fx * sg * ps; }
          Q[0] = P[0] - B.vx * dt * 0.85; Q[2] = P[2] - B.vz * dt * 0.85;
        }
      }
      if (P[1] < s.gy + r) { const vy = P[1] - Q[1]; P[1] = s.gy + r; Q[1] = P[1] + Math.min(0, vy) * 0.15; const f = 0.55; Q[0] = P[0] - (P[0] - Q[0]) * f; Q[2] = P[2] - (P[2] - Q[2]) * f; }
    }
  }
}
// Körperteile an ihre Punkte hängen: Rumpf zuerst, dann Glied für Glied am Gelenk des Elternteils
const _gM = [], _gQs = [];
function ragPose(s) {
  const p = s.p, R = s.rest, S = s.S;
  const up = new T.Vector3(p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]).normalize();
  const ax = new T.Vector3(p[4][0] - p[3][0] + p[10][0] - p[9][0], p[4][1] - p[3][1] + p[10][1] - p[9][1], p[4][2] - p[3][2] + p[10][2] - p[9][2]);
  ax.addScaledVector(up, -ax.dot(up));
  if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0).addScaledVector(up, -up.x);
  ax.normalize(); const fw = new T.Vector3().crossVectors(ax, up).normalize();
  const qT = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(ax, up, fw));
  const mat = (pivW, q, pivR) => new T.Matrix4().compose(pivW, q, S).multiply(new T.Matrix4().makeTranslation(-pivR[0], -pivR[1], -pivR[2]));
  const M = [], Q = [];
  M[0] = mat(new T.Vector3(...p[0]), qT, R[0]); Q[0] = qT;
  // Eltern: Oberschenkel/Oberarm hängen am Rumpf, Schienbein/Unterarm am Oberschenkel/Oberarm
  const parent = [0, 0, 0, 0, 0, 1, 2, 3, 4];
  for (let k = 1; k < RAG_PARTS.length; k++) {
    const [, a, b] = RAG_PARTS[k], pk = parent[k];
    const piv = new T.Vector3(...R[a]).applyMatrix4(M[pk]);
    const r0 = new T.Vector3(R[b][0] - R[a][0], R[b][1] - R[a][1], R[b][2] - R[a][2]).normalize().applyQuaternion(Q[pk]);
    const r1 = new T.Vector3(p[b][0] - piv.x, p[b][1] - piv.y, p[b][2] - piv.z); if (r1.lengthSq() < 1e-8) r1.copy(r0); r1.normalize();
    Q[k] = new T.Quaternion().setFromUnitVectors(r0, r1).multiply(Q[pk]);
    M[k] = mat(piv, Q[k], R[a]);
  }
  for (let k = 0; k < RAG_PARTS.length; k++) { const im = s.parts[k]; im.matrix.copy(M[k]); im.matrixWorld.copy(M[k]); }
}
function ragFree(s) { s.busy = false; for (const im of s.parts) im.visible = false; RAG.live.splice(RAG.live.indexOf(s), 1); s.pd.rag = null; }
// Anfahrten erkennen (nur schnelle Wagen in der Nähe), Puppen rechnen, Aufstehen und Weitergehen
function updateRagdolls(dt) {
  dt = Math.min(dt, 1 / 30);
  for (const B of BODIES) {
    const sp = Math.hypot(B.vx, B.vz); if (sp < 3.2 || B.air) continue;
    const fx = Math.cos(B.h), fz = -Math.sin(B.h);
    for (const pd of peds) {
      if (pd.rag || pd.sit || !(pd.st === 0 || pd.st === 4 || pd.st === 7) || !pd.a.on) continue;
      const e = pd.a.m.elements, dx = e[12] - B.x, dz = e[14] - B.z; if (dx * dx + dz * dz > 12 || Math.abs(e[13] - B.y) > 1.6) continue;
      const lf = dx * fx + dz * fz, ls = -dx * fz + dz * fx;
      if (Math.abs(lf) < B.hl + 0.25 && Math.abs(ls) < B.hw + 0.2) { const g = groundAt(e[12], e[14], e[13] + 0.3); pd.ragGy = g ? g.y : e[13]; if (ragStart(pd, B)) pd.rag.gy = pd.ragGy; }
    }
  }
  for (const s of RAG.live.slice()) {
    const pd = s.pd; s.t += dt;
    if (s.ph === 'fly') {
      ragStep(s, dt);
      const c = s.p[0], g = groundAt(c[0], c[2], c[1] + 0.5); if (g && Math.abs(g.y - s.gy) < 0.6) s.gy += (g.y - s.gy) * Math.min(1, dt * 8);
      let mv = 0; for (let i = 0; i < s.p.length; i++) mv += Math.abs(s.p[i][0] - s.q[i][0]) + Math.abs(s.p[i][1] - s.q[i][1]) + Math.abs(s.p[i][2] - s.q[i][2]);
      if ((s.t > 3.2 && mv < 0.02) || s.t > 7) { s.ph = 'lie'; s.t = 0; }
      ragPose(s);
    } else if (s.ph === 'lie') {
      if (s.t > 1.4) {
        // aufstehen: Punkte gleiten in die Standhaltung über dem Becken, Blick zum Wagen
        const c = s.p[0], B = s.B, yaw = B ? Math.atan2(B.x - c[0], B.z - c[2]) : 0, cs = Math.cos(yaw), sn = Math.sin(yaw);
        s.from = s.p.map(P => P.slice()); s.to = s.rest.map(R => { const x = R[0] * s.S.x, z = R[2] * s.S.z; return [c[0] + x * cs + z * sn, s.gy + R[1] * s.S.y, c[2] - x * sn + z * cs]; });
        s.yaw = yaw; s.ph = 'up'; s.t = 0;
      }
    } else if (s.ph === 'up') {
      const k = Math.min(1, s.t / 1.3);
      for (let i = 0; i < s.p.length; i++) {
        // erst der Rumpf hoch, dann die Beine darunter
        const kk = i >= 9 ? Math.min(1, Math.max(0, (k - 0.15) / 0.85)) : Math.min(1, k / 0.8), e = kk * kk * (3 - 2 * kk);
        for (let j = 0; j < 3; j++) s.p[i][j] = s.from[i][j] + (s.to[i][j] - s.from[i][j]) * e;
        s.p[i][1] += Math.sin(Math.PI * kk) * (i >= 11 ? 0.05 : 0.15);
      }
      ragPose(s);
      if (k >= 1) {
        // als Figur weiter: kurz schimpfen, dann zurück auf den Weg
        const c = s.to[0], a = pd.a; ragFree(s);
        pd.back = { x: c[0], y: s.gy, z: c[2], yaw: s.yaw, t: 0 }; a.on = true; setAct(pd, 13);
      }
    }
  }
  // zurück zum Weg oder Platz
  for (const pd of peds) {
    const bk = pd.back; if (!bk) continue;
    bk.t += dt;
    if (bk.t < 2.6) { pedCrowd.set(pd.a, bk.x, bk.y, bk.z, bk.yaw, pd.sc); continue; }
    let tx, tz, ty;
    if (pd.st === 4) { tx = pd.x; tz = pd.z; ty = pd.y - (pd.yo || 0); }
    else { const P = loopPos(pd.lp, pd.t); tx = P[0]; tz = P[1]; ty = pd.lp.y; }
    const dx = tx - bk.x, dz = tz - bk.z, d = Math.hypot(dx, dz);
    if (!bk.walk) { bk.walk = true; const g = pd.a.gait; g[1] = pd.gw ? pd.gw[0] : 5; g[2] = pd.gw ? pd.gw[1] || 0.36 : 0.36; pd.a.gv = (pd.a.gv | 0) + 1; }
    const st = Math.min(d, 1.25 * dt);
    if (d < 0.05) { pd.back = null; if (pd.st === 4) setAct(pd, pd.act0 ?? 0); continue; }
    bk.x += dx / d * st; bk.z += dz / d * st; bk.y += (ty - bk.y) * Math.min(1, dt * 3);
    pedCrowd.set(pd.a, bk.x, bk.y, bk.z, Math.atan2(dx, dz), pd.sc);
  }
}

function updatePedestrians(dt, t) {
  if (!pedCrowd) return;
  updateCitizens(dt);
  pedSocial(dt);
  updateRagdolls(dt);
  for (const pd of peds) {
    const lp = pd.lp;
    if (pd.st === 5 || pd.st === 6 || pd.rag || pd.back) continue;
    if (pd.st === 4) { pedCrowd.set(pd.a, pd.x, pd.y - (pd.yo || 0), pd.z, pd.yaw, pd.sc, pd.tilt || 0); continue; }
    if (pd.st === 7) {
      // Begegnung: Hand geben, reden und zuhören im Wechsel, lachen, zum Abschied winken
      if (pd.lead) {
        const B = pd.mp, T = (pd.mt += dt), D = pd.md;
        let aA, aB;
        if (T < 1.7) aA = aB = 4.5;
        else if (T > D - 1.5) { aA = 3.8; aB = 3.8; }
        else { const turn = Math.floor((T - 1.7) / 3.3 + pd.seed * 2) % 2, laugh = (T * 0.37 + pd.seed * 5) % 7 < 0.8; aA = laugh ? 2.6 : turn ? 0.9 : 1.6; aB = laugh ? 2.7 : turn ? 1.6 : 0.85; }
        setAct(pd, aA); setAct(B, aB);
        if (T >= D) { endMeet(pd); endMeet(B); }
      }
      pedCrowd.set(pd.a, pd.mx, lp.y, pd.mz, pd.myaw, pd.sc); continue;
    }
    if (pd.st === 8) {
      // An Bord: Platz auf dem Schiff, fährt mit
      const pf = pd.pf; if (!pf.g.visible) { pd.a.on = false; continue; }
      const c = Math.cos(pf.ry), sn = Math.sin(pf.ry);
      pedCrowd.set(pd.a, pf.x + pd.lx * c + pd.lz * sn, pf.y + pd.ly - (pd.yo || 0), pf.z - pd.lx * sn + pd.lz * c, pf.ry + pd.lyaw, pd.sc, pd.tilt || 0);
      continue;
    }
    if (pd.st) {
      // Ins Lokal hinein, drinnen bleiben, wieder heraus
      const g = pd.go;
      if (pd.st === 2) { pd.wait -= dt; if (pd.wait <= 0) { pd.st = 3; pd.k = 0; } pd.a.on = false; continue; }
      pd.k = Math.min(1, pd.k + dt * Math.abs(pd.v) / Math.max(g.dd, 0.5));
      const k = pd.st === 1 ? pd.k : 1 - pd.k, x = g.x + (g.d.x - g.x) * k, z = g.z + (g.d.z - g.z) * k;
      pedCrowd.set(pd.a, x, lp.y, z, Math.atan2(g.d.nx, g.d.nz) + (pd.st === 1 ? Math.PI : 0), pd.sc);
      if (pd.k >= 1) {
        if (pd.st === 1) { const s = STAY[g.d.kind] || STAY.shop; pd.st = 2; pd.wait = s[0] + Math.random() * (s[1] - s[0]); }
        else { pd.st = 0; pd.cool = 15 + Math.random() * 40; }
      }
      continue;
    }
    const t0 = pd.t;
    pd.t = (pd.t + pd.v * dt + lp.total) % lp.total;
    pd.cool -= dt;
    if (lp.doors && pd.cool <= 0) {
      for (const g of lp.doors) if (Math.abs(g.t - t0) < Math.abs(pd.v * dt) + 0.02 && Math.abs(g.t - pd.t) < Math.abs(pd.v * dt) + 0.02) {
        if (Math.random() < 0.4) { pd.st = 1; pd.k = 0; pd.go = g; pd.t = g.t; } else pd.cool = 4;
        break;
      }
      if (pd.st) continue;
    }
    const [x, z, dirx, dirz] = loopRound(lp, pd.t, Math.sign(pd.v)), lat = pd.lat || 0;
    pedCrowd.set(pd.a, x + dirz * lat, lp.y, z - dirx * lat, Math.atan2(dirx, dirz), pd.sc);
  }
  pedCrowd.flag();
}

/* ---------- Bewohner: Namen, Berufe, Charaktere und ein Tagesablauf ---------- */
const CLOCK = { min: 19 * 60 + 30 };   // Spielzeit in Minuten; eine echte Sekunde ist eine Spielminute
const citizens = [];
const FIRST_M = ['Anton', 'Bruno', 'Carl', 'Emil', 'Felix', 'Franz', 'Georg', 'Hans', 'Karl', 'Ludwig', 'Max', 'Otto', 'Paul', 'Richard', 'Theo', 'Walter', 'Wilhelm', 'Oskar', 'Fritz', 'Konrad', 'Leo', 'Victor', 'Henri', 'Jules', 'Arthur', 'Edgar', 'Josef', 'Rudolf'];
const FIRST_F = ['Anna', 'Berta', 'Clara', 'Dora', 'Elsa', 'Frieda', 'Greta', 'Hedwig', 'Ida', 'Käthe', 'Lotte', 'Marlene', 'Martha', 'Paula', 'Rosa', 'Ruth', 'Trude', 'Vera', 'Lilli', 'Edith', 'Mila', 'Irene', 'Josephine', 'Louise', 'Nora', 'Hilde', 'Ella', 'Margot'];
const LAST = ['Adler', 'Bauer', 'Brandt', 'Falk', 'Fischer', 'Graf', 'Hartmann', 'Keller', 'König', 'Lang', 'Lorenz', 'Mayer', 'Neumann', 'Roth', 'Schmidt', 'Seidel', 'Sommer', 'Stein', 'Vogel', 'Wagner', 'Weiß', 'Winter', 'Ziegler', 'Hoffmann', 'Marchetti', 'Dubois', 'Novak', 'Kowalski', 'Lindqvist', 'O’Hara', 'Petrov', 'Moreau'];
const TRAITS = [
  { k: 'gesellig', v: 1.0, say: ['Kommen Sie doch später ins {bar}! Da ist immer was los.', 'Ich kenne hier jeden zweiten. Den Rest lerne ich heute Abend kennen.', 'Allein trinken? Niemals. Setzen Sie sich zu uns!'] },
  { k: 'mürrisch', v: 1.2, say: ['Was gibt’s? Ich hab’s eilig.', 'Schon wieder Nebel. Und die Bahn ist auch zu spät.', 'Lassen Sie mich in Ruhe, ich hatte eine lange Schicht.'] },
  { k: 'verträumt', v: 0.8, say: ['Haben Sie die Lichter am Belmont gesehen? Jede Nacht ein bisschen anders.', 'Irgendwann fliege ich mit einem der Luftschiffe weg. Irgendwann.', 'Hören Sie das? Irgendwo spielt jemand Klavier.'] },
  { k: 'ehrgeizig', v: 1.15, say: ['In fünf Jahren habe ich mein eigenes Geschäft.', 'Zeit ist Geld, mein Herr. Besonders in Vespera.', 'Ich arbeite heute länger. Der Chef soll sehen, was ich kann.'] },
  { k: 'fröhlich', v: 1.05, say: ['Was für ein Abend! Hören Sie die Musik?', 'Heute ist Zahltag, heute wird getanzt!', 'Lächeln kostet nichts, sagt meine Mutter immer.'] },
  { k: 'schüchtern', v: 0.9, say: ['Oh … guten Abend.', 'Ich … ich muss weiter, entschuldigen Sie.', 'Sie sind sehr freundlich. Danke.'] },
  { k: 'neugierig', v: 1.0, say: ['Sie sind nicht von hier, oder? Wie ist es hinter den Bergen?', 'Man sagt, oben in der Villa feiern sie bis zum Morgen. Stimmt das?', 'Haben Sie schon gehört? Im {work} gibt es Neuigkeiten.'] },
  { k: 'elegant', v: 0.95, say: ['Ein Abend ohne Champagner ist ein verlorener Abend.', 'Man trifft sich später im Ballsaal des Belmont, nicht wahr?', 'Achten Sie auf die Schuhe, mein Lieber. Die Schuhe verraten alles.'] },
];
const PLACE_NAMES = {
  cafe: ['Café Aurora', 'Café Lumière', 'Café Central', 'Café Mondschein', 'Café Iris'], restaurant: ['Restaurant Étoile', 'Speisesaal Odeon', 'Restaurant Palais', 'Trattoria Vesuvio', 'Brasserie Nord'],
  bar: ['Bar Nocturne', 'Blue Note', 'Bar Orphée', 'Cocktailbar Saphir', 'Bar Gatsby'], pub: ['The Brass Lantern', 'Zum Kessel', 'Schlote-Stube', 'Zur Laterne', 'Der Rote Hahn'],
  shop: ['Modehaus Adler', 'Hutsalon Vera', 'Uhren Lindqvist', 'Delikatessen Roth', 'Buchhandlung Stein', 'Radiohaus Falk', 'Parfümerie Iris', 'Schneiderei Novak'],
  hotel: ['Hotel Imperial', 'Hotel Astoria', 'Grand Hotel Riviera'], workshop: ['Werkstatt Bauer', 'Schlosserei Keller', 'Druckerei Lang'],
};
const placeName = (kind, i) => { const L = PLACE_NAMES[kind] || PLACE_NAMES.shop; return L[i % L.length]; };
// Gehweg einer Blockkante (2,2 m eingerückt)
const blkC = b => [b.x0 + 2.2, b.z0 + 2.2, b.x1 - 2.2, b.z1 - 2.2];
function perimT(b, x, z) {
  const [a0, c0, a1, c1] = blkC(b), W = a1 - a0, D = c1 - c0;
  const cx = Math.min(a1, Math.max(a0, x)), cz = Math.min(c1, Math.max(c0, z));
  const dn = Math.abs(cz - c0), de = Math.abs(cx - a1), ds = Math.abs(cz - c1), dw = Math.abs(cx - a0), m = Math.min(dn, de, ds, dw);
  if (m === dn) return cx - a0; if (m === de) return W + cz - c0; if (m === ds) return W + D + a1 - cx; return 2 * W + D + c1 - cz;
}
function perimP(b, t) {
  const [a0, c0, a1, c1] = blkC(b), W = a1 - a0, D = c1 - c0, P = 2 * (W + D); t = ((t % P) + P) % P;
  if (t < W) return [a0 + t, c0]; if (t < W + D) return [a1, c0 + t - W]; if (t < 2 * W + D) return [a1 - (t - W - D), c1]; return [a0, c1 - (t - 2 * W - D)];
}
// Auf dem Gehweg um den Block von einem Punkt zum anderen, den kürzeren Weg herum
function loopWalk(b, A, B, out) {
  const [a0, c0, a1, c1] = blkC(b), W = a1 - a0, D = c1 - c0, P = 2 * (W + D);
  const t0 = perimT(b, A[0], A[1]), t1 = perimT(b, B[0], B[1]);
  let d = t1 - t0; if (d > P / 2) d -= P; if (d < -P / 2) d += P;
  const corners = [0, W, W + D, 2 * W + D];
  const pass = [];
  for (const c of corners) for (const cc of [c, c + P, c - P]) { const k = (cc - t0) / d; if (d !== 0 && k > 0.001 && k < 0.999) pass.push([k, cc]); }
  pass.sort((x, y) => x[0] - y[0]);
  for (const [, cc] of pass) out.push(perimP(b, cc));
  out.push(perimP(b, t1));
}
function cornerNear(b, x, z) { const [a0, c0, a1, c1] = blkC(b); return [Math.abs(x - a0) < Math.abs(x - a1) ? a0 : a1, Math.abs(z - c0) < Math.abs(z - c1) ? c0 : c1]; }
function citizenPath(from, to) {
  const out = [[from.x, from.z]];
  if (from.b === to.b) { loopWalk(from.b, [from.x, from.z], [to.x, to.z], out); return out; }
  const cA = cornerNear(from.b, to.x, to.z), cB = cornerNear(to.b, from.x, from.z);
  loopWalk(from.b, [from.x, from.z], cA, out);
  const plaza = (z, x0, x1) => Math.abs(z) < 136 && Math.min(x0, x1) < 100 && Math.max(x0, x1) > -100;
  if (plaza(cA[1], cA[0], cB[0])) { const zd = cA[1] < 0 ? -139 : 139; out.push([cA[0], zd], [cB[0], zd]); }
  else out.push([cB[0], cA[1]]);
  out.push(cB);
  loopWalk(to.b, cB, [to.x, to.z], out);
  return out;
}
function buildCitizens(loopsAll) {
  const rc = mulberry32(2718);
  const pickR = a => a[Math.floor(rc() * a.length)];
  // Orte: Lokale und Läden an den Gehwegen, Fabriktore, Wohnhäuser
  const places = { work: [], bar: [], eat: [], home: [], factory: [] };
  let ni = 0;
  for (const lp of loopsAll) if (lp.doors) for (const g of lp.doors) {
    const d = g.d; if (!d.name) d.name = placeName(d.kind, ni++);
    const p = { x: g.x, z: g.z, ix: d.x - d.nx * 1.5, iz: d.z - d.nz * 1.5, b: lp.block, name: d.name, kind: d.kind };
    if (d.kind === 'bar' || d.kind === 'pub') places.bar.push(p);
    if (d.kind === 'restaurant' || d.kind === 'cafe') places.eat.push(p);
    if (d.kind !== 'hotel') places.work.push(p);
  }
  for (const lp of loopsAll) if (lp.block && rc() < 0.8) for (let k = 0; k < 3; k++) {
    const b = lp.block, t = rc() * 2 * ((b.x1 - b.x0 - 4.4) + (b.z1 - b.z0 - 4.4)), [x, z] = perimP(b, t), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, L = Math.hypot(cx - x, cz - z);
    places.home.push({ x, z, ix: x + (cx - x) / L * 3, iz: z + (cz - z) / L * 3, b, name: 'Zuhause', kind: 'home' });
  }
  FACTORIES.forEach((f, i) => {
    const b = f.b; if (!b) return;
    places.factory.push({ x: f.gx, z: b.z0 + 2.2, ix: f.gx, iz: b.z0 + 6, b, name: FACTORY_NAMES[i % FACTORY_NAMES.length], kind: 'factory', loop: FACTORY_LOOPS[i] });
  });
  const near = (list, x, z, r) => { const c = list.filter(p => Math.hypot(p.x - x, p.z - z) < r); return c.length ? pickR(c) : list.reduce((a, p) => Math.hypot(p.x - x, p.z - z) < Math.hypot(a.x - x, a.z - z) ? p : a); };
  const JOBS = [
    { m: 'Fabrikarbeiter', f: 'Fabrikarbeiterin', at: 'factory', w: 3, plan: [[0, 'work'], [240, 'bar'], [330, 'home'], [1170, 'eat'], [1230, 'work']] },
    { m: 'Kellner', f: 'Kellnerin', at: 'eat', w: 2, plan: [[0, 'bar'], [90, 'home'], [1050, 'work']] },
    { m: 'Barmann', f: 'Barfrau', at: 'bar', w: 1, plan: [[0, 'work'], [180, 'home'], [1200, 'work']] },
    { m: 'Verkäufer', f: 'Verkäuferin', at: 'work', w: 2, plan: [[0, 'home'], [1020, 'work'], [1260, 'eat'], [1350, 'bar']] },
    { m: 'Schneider', f: 'Schneiderin', at: 'work', w: 1, plan: [[0, 'bar'], [60, 'home'], [1080, 'work'], [1290, 'eat']] },
    { m: 'Journalist', f: 'Journalistin', at: 'work', w: 1, plan: [[0, 'bar'], [150, 'home'], [1110, 'eat'], [1170, 'work'], [1380, 'bar']] },
    { m: 'Musiker', f: 'Sängerin', at: 'bar', w: 1, plan: [[0, 'work'], [210, 'home'], [1140, 'eat'], [1230, 'work']] },
    { m: 'Bankier', f: 'Bankierin', at: 'work', w: 1, plan: [[0, 'home'], [1110, 'eat'], [1230, 'bar']] },
    { m: 'Uhrmacher', f: 'Hutmacherin', at: 'work', w: 1, plan: [[0, 'home'], [1050, 'work'], [1230, 'eat'], [1320, 'home']] },
  ];
  const jobPool = []; JOBS.forEach(j => { for (let k = 0; k < j.w; k++) jobPool.push(j); });
  const N = MOBILE ? 110 : 300;
  for (let i = 0; i < N; i++) {
    const job = pickR(jobPool), female = rc() < 0.5;
    if (job.at === 'factory' && !places.factory.length) continue;
    const workList = places[job.at]; if (!workList.length) continue;
    const work = pickR(workList);
    const home = near(places.home, work.x, work.z, 420), bar = near(places.bar, home.x, home.z, 400), eat = near(places.eat, work.x, work.z, 380);
    const trait = pickR(TRAITS), kr = rc(), kind = female ? (kr < 0.55 ? 'lady' : 'dress') : job.at === 'factory' ? 'worker' : (kr < 0.45 ? 'coat' : 'suit');
    const c = {
      name: (female ? pickR(FIRST_F) : pickR(FIRST_M)) + ' ' + pickR(LAST), age: 19 + Math.floor(rc() * 45), female, trait,
      jk: job.m, job: female ? job.f : job.m, plan: job.plan.map(([m, a]) => [(m + Math.floor(rc() * 40) - 20 + 1440) % 1440, a]).sort((x, y) => x[0] - y[0]),
      at: { work, home, bar, eat }, v: (1.15 + rc() * 0.35) * trait.v, st: 'in', wait: rc() * 30, path: null, cur: null, kind,
      col: job.at === 'factory' ? pickR(SHIRTS) : kind === 'dress' ? pickR(DRESSES) : pickR(COATS),
    };
    c.goal = citizenGoal(c); c.place = c.at[c.goal];
    // ein Teil ist gerade unterwegs: kommt noch vom letzten Ort
    if (rc() < 0.45) { const other = ['work', 'bar', 'eat', 'home'].filter(k => k !== c.goal); c.place = c.at[other[Math.floor(rc() * 3)]]; c.wait = rc() * 25; }
    c.ped = { st: 6, kind, col: c.col, v: c.v, sc: 0.94 + rc() * 0.12, cit: c };
    citizens.push(c);
  }
  return citizens.map(c => c.ped);
}
// Was die Berufe draußen tun (Aktionscodes der Figuren)
const CIT_TASKS = { Kellner: [24, 29, 38], Barmann: [24, 38], 'Verkäufer': [24, 29, 30, 28], Schneider: [38, 31], Journalist: [28, 31, 38], Musiker: [38, 31], Bankier: [31, 28], Uhrmacher: [38, 29, 31], Fabrikarbeiter: [27, 25] };
// Gangart: 0 gehen, 1 Kiste tragen, 2 rennen (Schrittlänge passt zum Tempo)
function citGait(c, mode) {
  const a = c.ped.a; if (!a) return; const g = a.gait, fem = c.female, sc = c.ped.sc;
  if (!c.gw) c.gw = [g[1], g[2]];
  if (mode === 2) { g[1] = c.v * 2.3 * (fem ? 3.14 : 2.73) / sc; g[2] = 0.8; }
  else if (mode === 1) { g[1] = c.gw[0] * 0.8; g[2] = 0.55; }
  else { g[1] = c.gw[0]; g[2] = c.gw[1]; }
  a.gv = (a.gv | 0) + 1;
}
function citizenGoal(c) {
  const m = CLOCK.min % 1440; let a = c.plan[c.plan.length - 1][1];
  for (const [t, act] of c.plan) if (m >= t) a = act;
  return a;
}
const ACT_TEXT = { work: ['arbeitet in', 'auf dem Weg zur Arbeit in'], bar: ['trinkt etwas in', 'auf dem Weg in'], eat: ['isst in', 'auf dem Weg zum Essen in'], home: ['ist zu Hause', 'geht nach Hause'] };
function citizenDoing(c) {
  const key = c.st === 'walk' && c.doing ? c.doing : (c.place === c.at[c.goal] ? c.goal : (Object.keys(c.at).find(k => c.at[k] === c.place) || c.goal));
  const p = c.at[key], A = ACT_TEXT[key];
  if (key === 'home') return c.st === 'walk' ? A[1] : A[0];
  return (c.st === 'walk' ? A[1] : A[0]) + ' ' + (p.kind === 'factory' ? 'der ' + p.name.charAt(0) + p.name.slice(1).toLowerCase() : p.name);
}
function updateCitizens(dt) {
  CLOCK.min = (CLOCK.min + dt) % 1440;
  for (const c of citizens) {
    const a = c.ped.a; if (!a) continue;
    if (c.st === 'in') {
      a.on = false;
      c.wait -= dt;
      const g = citizenGoal(c);
      if (c.wait <= 0 && g !== c.goal) { c.goal = g; c.st = 'out'; c.k = 0; }
      else if (c.wait <= 0 && c.place !== c.at[g]) { c.st = 'out'; c.k = 0; }
      else if (c.wait <= 0 && g === 'work' && c.place === c.at.work && !c.place.loop && c.place.ix !== undefined && Math.random() < dt * 0.02) {
        // Tätigkeit vor der Tür: fegen, Fenster putzen, Notizen, Zeitung, Rauchpause
        const L = CIT_TASKS[c.jk] || [38], act = L[Math.floor(Math.random() * L.length)], p = c.place;
        let ux = p.x - p.ix, uz = p.z - p.iz; const n = Math.hypot(ux, uz) || 1; ux /= n; uz /= n;
        const sd = Math.random() < 0.5 ? -1 : 1, tx = uz * sd, tz = -ux * sd, fx = p.ix + ux * 1.5, fz = p.iz + uz * 1.5;
        const o = act === 29 || act === 30 ? [0.55, 1.9, Math.atan2(-ux, -uz)] : act === 24 ? [1.3, 2.2, Math.atan2(tx, tz)] : act === 27 ? [1.1, 1.6, Math.atan2(tx, tz)] : [0.45, 1.3, Math.atan2(ux, uz) + sd * 0.3];
        c.tk = { x: fx + ux * o[0] + tx * o[1], z: fz + uz * o[0] + tz * o[1], yaw: o[2], act: act + 0.1 + Math.random() * 0.35, t: 40 + Math.random() * 70 };
        c.st = 'out'; c.k = 0;
      }
      else if (c.wait <= 0 && !c.place.loop && Math.random() < dt * 0.003) {
        // kleine Besorgung zwischendurch, danach zurück
        const ks = ['bar', 'eat', 'work'].filter(k => c.at[k] !== c.place); c.errand = ks[Math.floor(Math.random() * ks.length)]; c.st = 'out'; c.k = 0;
      }
      else if (c.wait <= 0 && c.place.loop && g === 'work') { c.st = 'loop'; c.lt = Math.random() * 100; c.carry = Math.random() < 0.5; citGait(c, c.carry ? 1 : 0); }
      continue;
    }
    if (c.st === 'loop') {
      // Fabrikschicht: im Hof unterwegs, bis die Schicht vorbei ist
      const lp = c.place.loop, segs = lp.segs; if (!segs) { c.st = 'in'; c.wait = 5; continue; }
      c.lt = (c.lt + c.v * dt * (c.carry ? 0.8 : 1)) % lp.total;
      let u = c.lt, sg = segs[0]; for (const s of segs) { if (u <= s.L) { sg = s; break; } u -= s.L; }
      const k = u / sg.L, x = sg.a[0] + (sg.b[0] - sg.a[0]) * k, z = sg.a[1] + (sg.b[1] - sg.a[1]) * k;
      pedCrowd.set(a, x, lp.y, z, Math.atan2(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]), c.ped.sc);
      if (citizenGoal(c) !== 'work') { c.goal = citizenGoal(c); c.st = 'out'; c.k = 0; c.carry = false; citGait(c, 0); }
      continue;
    }
    if (c.st === 'out' || c.st === 'enter') {
      // durch die Tür: zwischen Innenpunkt und Gehweg
      const p = c.place; c.k = Math.min(1, c.k + dt * c.v / 2.5);
      const k = c.st === 'out' ? c.k : 1 - c.k, x = p.ix + (p.x - p.ix) * k, z = p.iz + (p.z - p.iz) * k;
      const yaw = Math.atan2(p.x - p.ix, p.z - p.iz) + (c.st === 'out' ? 0 : Math.PI);
      pedCrowd.set(a, x, 0.22, z, yaw, c.ped.sc);
      if (c.k >= 1) {
        if (c.st === 'enter') { c.st = 'in'; c.wait = 20 + Math.random() * 40; }
        else if (c.tk) { c.path = [[p.x, p.z], [c.tk.x, c.tk.z]]; c.pi = 0; c.target = { task: true }; c.doing = 'work'; c.st = 'walk'; }
        else {
          const to = c.at[c.errand || c.goal]; c.doing = c.errand || c.goal; c.errand = null; c.path = citizenPath(p, to); c.pi = 0; c.target = to; c.st = 'walk';
          // spät dran: ein Teil läuft, Ehrgeizige öfter
          c.hurry = Math.random() < (c.doing === 'work' ? (c.trait.k === 'ehrgeizig' ? 0.5 : 0.22) : 0.05);
          citGait(c, c.hurry ? 2 : 0);
        }
      }
      continue;
    }
    if (c.st === 'task') {
      // draußen bei der Arbeit, danach zurück durch die Tür
      const tk = c.tk; pedCrowd.set(a, tk.x, 0.22, tk.z, tk.yaw, c.ped.sc);
      if ((tk.t -= dt) <= 0 || citizenGoal(c) !== 'work') { citGait(c, 0); const p = c.place; c.path = [[tk.x, tk.z], [p.x, p.z]]; c.pi = 0; c.target = p; c.tk = null; c.st = 'walk'; }
      continue;
    }
    if (c.st === 'walk') {
      const P = c.path; let step = c.v * dt * (c.hurry ? 2.3 : 1);
      let [x, z] = c.pos || P[0];
      while (step > 0 && c.pi < P.length - 1) {
        const [tx, tz] = P[c.pi + 1], d = Math.hypot(tx - x, tz - z);
        if (d <= step) { x = tx; z = tz; step -= d; c.pi++; } else { x += (tx - x) / d * step; z += (tz - z) / d * step; step = 0; }
      }
      c.pos = [x, z];
      const nx = P[Math.min(c.pi + 1, P.length - 1)];
      const yaw = Math.atan2(nx[0] - x, nx[1] - z);
      c.yaw = c.yaw === undefined ? yaw : c.yaw + Math.atan2(Math.sin(yaw - c.yaw), Math.cos(yaw - c.yaw)) * Math.min(1, dt * 6);
      pedCrowd.set(a, x, 0.22, z, c.yaw, c.ped.sc);
      if (c.pi >= P.length - 1) {
        c.pos = null; if (c.hurry) { c.hurry = false; citGait(c, 0); }
        if (c.target.task) { if (!c.gw) c.gw = [c.ped.a.gait[1], c.ped.a.gait[2]]; c.st = 'task'; setAct(c.ped, c.tk.act); c.yaw = undefined; }
        else { c.place = c.target; c.st = 'enter'; c.k = 0; }
      }
    }
  }
}
// Nächster Bewohner vor dem Spieler (für Ansprechen und die Namenskarte)
function citizenNear(p, r = 4) {
  let best = null, bd = r * r;
  for (const c of citizens) {
    if (!c.ped.a || !c.ped.a.on) continue;
    const e = c.ped.a.m.elements, d = (e[12] - p.x) ** 2 + (e[14] - p.z) ** 2;
    if (d < bd && Math.abs(e[13] - p.y) < 2) { bd = d; best = c; }
  }
  return best;
}
function citizenSay(c) {
  const lines = c.trait.say, s = lines[Math.floor(Math.random() * lines.length)].replace('{bar}', c.at.bar.name).replace('{work}', c.at.work.name);
  const el = $('say'); el.innerHTML = '<b></b><span></span>'; el.querySelector('b').textContent = c.name; el.querySelector('span').textContent = '„' + s + '“';
  el.style.opacity = 1; sayTimer = 5;
}
let sayTimer = 0;

/* ---------- Leuchtpunkte (Laternen, Positionslichter, Reklameschein) ---------- */
const glowMat = new T.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
  vertexShader: `attribute vec3 color; attribute float size; attribute float phase; attribute float blink;
    uniform float uTime; uniform float uScale; uniform float uFogDensity; varying vec3 vC; varying float vA;
    void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); float d = -mv.z;
      float b = blink > 0.5 ? (0.12 + 0.88*smoothstep(0.55, 0.6, fract(uTime*0.55 + phase))*(1.0 - smoothstep(0.85, 0.9, fract(uTime*0.55 + phase)))) : 1.0;
      vC = color; vA = b*exp(-uFogDensity*uFogDensity*d*d*0.5)*(0.25 + 0.75*smoothstep(2.0, 14.0, d));
      float ps = size*uScale/max(d, 0.1); vA *= max(0.12, min(1.0, ps*ps*0.25));
      gl_PointSize = clamp(ps, 2.0, 120.0); gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c)*2.0; if (r > 1.0) discard;
      float a = pow(1.0 - r, 2.2)*0.55 + exp(-r*r*28.0); gl_FragColor = vec4(vC*a*vA, 1.0); }`,
});
function makeGlowPoints(list, dynamic = false) {
  const n = list.length, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n), bl = new Float32Array(n);
  list.forEach((g, i) => { pos.set(g.p, i * 3); col.set(g.c, i * 3); size[i] = g.s; ph[i] = g.ph; bl[i] = g.bl; });
  const geo = new T.BufferGeometry();
  const pa = new T.BufferAttribute(pos, 3); if (dynamic) pa.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position', pa); geo.setAttribute('color', new T.BufferAttribute(col, 3));
  geo.setAttribute('size', new T.BufferAttribute(size, 1)); geo.setAttribute('phase', new T.BufferAttribute(ph, 1)); geo.setAttribute('blink', new T.BufferAttribute(bl, 1));
  const p = new T.Points(geo, glowMat); p.frustumCulled = false; p.renderOrder = 2;
  return p;
}
