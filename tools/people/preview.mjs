// Schnelle Vorschau ohne Browser: orthografische Ansichten (vorn, Seite) mit Tiefenpuffer und
// einfacher Schattierung, als PNG. Nur zur Kontrolle beim Bauen der Figuren.
import sharp from 'sharp';

// meshes: [{ pos: Float32Array, idx: Uint32Array, col: [r,g,b] | Float32Array (je Ecke), tex?: fn(i)->[r,g,b] }]
export async function preview(file, meshes, o = {}) {
  const W = o.w ?? 360, H = o.h ?? 640, views = o.views ?? [[0, 0], [Math.PI / 2, 0]];
  const y0 = o.y0 ?? -0.02, y1 = o.y1 ?? 1.82, cx = o.cx ?? 0, cy = (y0 + y1) / 2, sc = H / (y1 - y0);
  const out = Buffer.alloc(W * views.length * H * 3, 40);
  for (let vi = 0; vi < views.length; vi++) {
    const [yaw, pitch] = views[vi], c = Math.cos(yaw), s = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const Z = new Float32Array(W * H).fill(-1e9);
    const proj = (x, y, z) => { const X = x * c + z * s, Zz = -x * s + z * c; const Y = y * cp - Zz * sp, Z2 = y * sp + Zz * cp; return [W / 2 + (X - cx) * sc, H / 2 - (Y - cy) * sc, Z2]; };
    const L = [0.35, 0.55, 0.75]; const ll = Math.hypot(...L);
    for (const m of meshes) {
      const P = m.pos, I = m.idx;
      const pp = new Float32Array(P.length);
      for (let i = 0; i < P.length / 3; i++) { const r = proj(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); pp[i * 3] = r[0]; pp[i * 3 + 1] = r[1]; pp[i * 3 + 2] = r[2]; }
      for (let t = 0; t < I.length; t += 3) {
        const a = I[t], b = I[t + 1], d = I[t + 2];
        // Normale in Weltraum für Licht
        const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
        const vx = P[d * 3] - P[a * 3], vy = P[d * 3 + 1] - P[a * 3 + 1], vz = P[d * 3 + 2] - P[a * 3 + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        // Blickrichtung (zur Kamera): gedreht
        const vzv = [s * cp, -sp, c * cp];
        const facing = nx * vzv[0] + ny * vzv[1] + nz * vzv[2];
        let sh = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]) / ll * 0.75 + 0.25;
        if (facing < 0 && !m.double) sh *= 0.45;   // Rückseite dunkel: zeigt falsch herum liegende Flächen
        const x0 = pp[a * 3], y0_ = pp[a * 3 + 1], z0 = pp[a * 3 + 2], x1 = pp[b * 3], y1_ = pp[b * 3 + 1], z1 = pp[b * 3 + 2], x2 = pp[d * 3], y2_ = pp[d * 3 + 1], z2 = pp[d * 3 + 2];
        const minx = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
        const miny = Math.max(0, Math.floor(Math.min(y0_, y1_, y2_))), maxy = Math.min(H - 1, Math.ceil(Math.max(y0_, y1_, y2_)));
        const den = (y1_ - y2_) * (x0 - x2) + (x2 - x1) * (y0_ - y2_); if (Math.abs(den) < 1e-9) continue;
        for (let py = miny; py <= maxy; py++) for (let px = minx; px <= maxx; px++) {
          const qx = px + 0.5, qy = py + 0.5;
          const w0 = ((y1_ - y2_) * (qx - x2) + (x2 - x1) * (qy - y2_)) / den, w1 = ((y2_ - y0_) * (qx - x2) + (x0 - x2) * (qy - y2_)) / den, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * z0 + w1 * z1 + w2 * z2, k = py * W + px; if (z <= Z[k]) continue; Z[k] = z;
          let col;
          if (m.tex) col = m.tex(a, b, d, w0, w1, w2);
          else if (m.col && m.col.length > 3) col = [0, 1, 2].map(j => m.col[a * 3 + j] * w0 + m.col[b * 3 + j] * w1 + m.col[d * 3 + j] * w2);
          else col = m.col || [0.8, 0.8, 0.8];
          if (!col) { Z[k] = -1e9; continue; }
          const o3 = (py * W * views.length + vi * W + px) * 3;
          out[o3] = Math.min(255, col[0] * sh * 255); out[o3 + 1] = Math.min(255, col[1] * sh * 255); out[o3 + 2] = Math.min(255, col[2] * sh * 255);
        }
      }
    }
    // Hilfslinien: Gelenkhöhen
    for (const yy of o.lines || []) { const py = Math.round(H / 2 - (yy - cy) * sc); if (py >= 0 && py < H) for (let px = 0; px < W; px += 3) { const o3 = (py * W * views.length + vi * W + px) * 3; out[o3] = 255; out[o3 + 1] = 60; out[o3 + 2] = 60; } }
  }
  await sharp(out, { raw: { width: W * views.length, height: H, channels: 3 } }).png().toFile(file);
}
