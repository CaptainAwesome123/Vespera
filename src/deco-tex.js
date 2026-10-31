import { T, canvasTex, mulberry32, MOBILE } from './core.js';

/* =====================================================================
   V33 · ART-DÉCO-TEXTUREN für Ballsaal und Penthouse (alles gezeichnet, keine Downloads):
   Treppenläufer, Teppich, Goldfries, Wandbild, Intarsienboden, Travertin, Damast, Makassar-Furnier, Onyx
   ===================================================================== */
const rep = t => { t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
const fibers = (g, W, H, n, a, seed) => {
  const rr = mulberry32(seed);
  for (let k = 0; k < n; k++) { g.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,235,210'},${rr() * a})`; g.fillRect(rr() * W, rr() * H, 1, 1 + rr() * 2); }
};
// Treppenläufer: tiefes Bordeaux, goldene Doppelborte, kleine Rauten
export function RUNNER_TEX() {
  return rep(canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#4a0c14'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9a050'; g.fillRect(14, 0, 8, H); g.fillRect(W - 22, 0, 8, H); g.fillRect(28, 0, 3, H); g.fillRect(W - 31, 0, 3, H);
    g.fillStyle = '#6e1a22';
    for (let y = 0; y < H; y += 32) for (let x = 48; x < W - 48; x += 32) { g.beginPath(); g.moveTo(x + 16, y + 4); g.lineTo(x + 28, y + 16); g.lineTo(x + 16, y + 28); g.lineTo(x + 4, y + 16); g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(201,160,80,0.55)'; g.lineWidth = 1.5;
    for (let y = 0; y < H; y += 32) for (let x = 48; x < W - 48; x += 32) { g.beginPath(); g.moveTo(x + 16, y + 9); g.lineTo(x + 23, y + 16); g.lineTo(x + 16, y + 23); g.lineTo(x + 9, y + 16); g.closePath(); g.stroke(); }
    fibers(g, W, H, 5000, 0.1, 71);
  }));
}
// Großer Teppich mit Fächern und Stufenrahmen (ein ganzes Stück, Seitenverhältnis w:d)
export function decoRugTex(base = '#0d2f33', gold = '#c9a050', accent = '#5a1420', w = 2, d = 1) {
  const W = d > w ? Math.round(1024 * w / d) : 1024, H = d > w ? 1024 : Math.round(1024 * d / w);
  return canvasTex(W, H, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    const fr = (i, c, lw) => { g.strokeStyle = c; g.lineWidth = lw; g.strokeRect(i, i, W - 2 * i, H - 2 * i); };
    fr(18, gold, 10); fr(36, accent, 14); fr(52, gold, 3);
    // Stufenecken
    g.fillStyle = gold;
    for (const [cx, cy, sx, sy] of [[60, 60, 1, 1], [W - 60, 60, -1, 1], [60, H - 60, 1, -1], [W - 60, H - 60, -1, -1]]) for (let k = 0; k < 4; k++) { const w = 18, h = 18 * (4 - k); g.fillRect(sx > 0 ? cx + k * w : cx - (k + 1) * w, sy > 0 ? cy : cy - h, w, h); }
    // Mittelfeld: Fächer in Reihen
    g.save(); g.beginPath(); g.rect(70, 70, W - 140, H - 140); g.clip();
    const s = 90;
    for (let y = 70; y < H; y += s * 0.55) for (let x = 70 + ((Math.round(y / (s * 0.55)) % 2) * s / 2); x < W + s; x += s) {
      for (let r = s * 0.5; r > 4; r -= s * 0.12) { g.fillStyle = (Math.round(r / (s * 0.12)) % 2) ? gold : base; g.beginPath(); g.moveTo(x, y); g.arc(x, y, r, Math.PI, 0); g.closePath(); g.fill(); }
      g.fillStyle = accent; g.beginPath(); g.arc(x, y, s * 0.08, Math.PI, 0); g.fill();
    }
    g.restore();
    g.globalAlpha = 0.85; g.fillStyle = base; g.fillRect(70, 70, W - 140, H - 140); g.globalAlpha = 1;
    // nur ein Hauch der Fächer bleibt (Flor), dazu ein großes Medaillon
    g.save(); g.beginPath(); g.rect(70, 70, W - 140, H - 140); g.clip(); g.globalAlpha = 0.28;
    for (let y = 70; y < H; y += s * 0.55) for (let x = 70 + ((Math.round(y / (s * 0.55)) % 2) * s / 2); x < W + s; x += s) { g.strokeStyle = gold; g.lineWidth = 3; for (let r = s * 0.5; r > 8; r -= s * 0.12) { g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.stroke(); } }
    g.restore(); g.globalAlpha = 1;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.28;
    for (let i = 0; i < 32; i++) { g.fillStyle = i % 2 ? gold : accent; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, i / 32 * Math.PI * 2, (i + 1) / 32 * Math.PI * 2); g.closePath(); g.fill(); }
    g.fillStyle = base; g.beginPath(); g.arc(cx, cy, R * 0.55, 0, 7); g.fill();
    g.strokeStyle = gold; g.lineWidth = 6; for (const k of [0.55, 1, 1.08]) { g.beginPath(); g.arc(cx, cy, R * k, 0, 7); g.stroke(); }
    fibers(g, W, H, MOBILE ? 8000 : 26000, 0.07, 72);
  });
}
// Goldfries für Galeriebrüstungen: Zickzack, Fächer und Stufen auf Schwarz
export function friezeTex() {
  return rep(canvasTex(512, 64, (g, W, H) => {
    g.fillStyle = '#0b0a0c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d6ac5c'; g.fillRect(0, 2, W, 4); g.fillRect(0, H - 6, W, 4);
    g.strokeStyle = '#d6ac5c'; g.lineWidth = 3; g.beginPath();
    for (let x = 0; x <= W; x += 16) g.lineTo(x, x % 32 ? 16 : 48); g.stroke();
    for (let x = 64; x < W; x += 128) {
      g.fillStyle = '#0b0a0c'; g.fillRect(x - 26, 10, 52, 44);
      for (let r = 22; r > 3; r -= 6) { g.fillStyle = (r / 6 | 0) % 2 ? '#d6ac5c' : '#3a2810'; g.beginPath(); g.moveTo(x, 52); g.arc(x, 52, r * 1.6, Math.PI, 0); g.closePath(); g.fill(); }
    }
  }));
}
// Wandbild: die Sternenstadt im Krater, Polarlicht, Sonnenstrahl, Luftschiffe (Gold, Petrol, Champagner)
export function muralTex(seed = 5) {
  return canvasTex(1536, 384, (g, W, H) => {
    const rr = mulberry32(seed);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#06161c'); sky.addColorStop(0.6, '#0e3a40'); sky.addColorStop(1, '#1b2a2a');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Polarlicht in Bändern
    for (let k = 0; k < 5; k++) { g.strokeStyle = `rgba(${90 + k * 20},${220 - k * 10},${190},0.16)`; g.lineWidth = 26 - k * 3; g.beginPath(); for (let x = 0; x <= W; x += 24) g.lineTo(x, 60 + k * 18 + Math.sin(x / 140 + k) * 22); g.stroke(); }
    // Sonnenstrahl hinter dem Turm
    const cx = W / 2, cy = H * 0.86;
    for (let i = 0; i < 36; i++) { const a0 = Math.PI + i / 36 * Math.PI, a1 = Math.PI + (i + 0.5) / 36 * Math.PI; g.fillStyle = 'rgba(214,172,92,0.32)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, H * 0.95, a0, a1); g.closePath(); g.fill(); }
    // Berge (Kraterrand) mit Schnee
    g.fillStyle = '#16262a'; g.beginPath(); g.moveTo(0, H * 0.7);
    for (let x = 0; x <= W; x += 60) g.lineTo(x, H * (0.5 + 0.18 * Math.abs(Math.sin(x / 210 + 1.3)) + rr() * 0.05)); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fill();
    // Türme: gestufte Silhouetten in Gold
    const tower = (x, w, h, c) => { g.fillStyle = c; let y = H; for (let s = 0; s < 4; s++) { const ww = w * (1 - s * 0.2), hh = h * [0.5, 0.25, 0.15, 0.1][s]; g.fillRect(x - ww / 2, y - hh, ww, hh); y -= hh; } g.fillRect(x - 1.5, y - h * 0.18, 3, h * 0.18); };
    for (let k = 0; k < 22; k++) { const x = rr() * W; if (Math.abs(x - cx) < 90) continue; tower(x, 30 + rr() * 40, 120 + rr() * 140, rr() < 0.5 ? '#1f4448' : '#2b3b38'); }
    tower(cx, 90, H * 0.8, '#c9a050');
    g.fillStyle = '#0b0a0c'; for (let y = H * 0.3; y < H; y += 12) for (let x = cx - 30; x < cx + 30; x += 10) if (rr() < 0.5) g.fillRect(x, y, 4, 6);
    // Luftschiffe
    for (const [x, y, s] of [[260, 120, 1], [1220, 90, 0.8], [980, 150, 0.6]]) { g.fillStyle = '#d8c8a0'; g.beginPath(); g.ellipse(x, y, 80 * s, 20 * s, 0, 0, 7); g.fill(); g.fillStyle = '#7a6030'; g.fillRect(x - 18 * s, y + 18 * s, 36 * s, 8 * s); }
    // Goldrahmen mit Stufenecken
    g.strokeStyle = '#d6ac5c'; g.lineWidth = 12; g.strokeRect(6, 6, W - 12, H - 12); g.lineWidth = 3; g.strokeRect(22, 22, W - 44, H - 44);
  });
}
// Intarsienboden: weißer Calacatta mit schwarzen Marmorbändern, Messingadern, Sternrosette (Fläche w x d Meter)
export function inlayFloorTex(w, d, opts = {}) {
  const W = opts.res || 2048, H = Math.round(W * d / w), S = W / w;
  return canvasTex(W, H, (g) => {
    const rr = mulberry32(opts.seed || 33);
    g.fillStyle = '#e9e4da'; g.fillRect(0, 0, W, H);
    // Platten 1,2 m mit leichter Tönung und Adern
    const tile = 1.2 * S;
    for (let y = 0; y < H; y += tile) for (let x = 0; x < W; x += tile) { g.fillStyle = `rgba(${rr() < 0.5 ? '255,250,240' : '200,190,175'},${0.15 + rr() * 0.2})`; g.fillRect(x, y, tile, tile); }
    g.lineCap = 'round';
    for (let k = 0; k < 180; k++) { g.strokeStyle = `rgba(110,100,90,${0.08 + rr() * 0.22})`; g.lineWidth = 0.6 + rr() * 2.2; let x = rr() * W, y = rr() * H; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 9; j++) { x += (rr() - 0.4) * 90; y += (rr() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(80,70,60,0.35)'; g.lineWidth = 1.2;
    for (let y = 0; y <= H; y += tile) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let x = 0; x <= W; x += tile) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    // Bänder aus schwarzem Marmor mit Messingadern rundum und in Feldern
    const band = (x0, y0, x1, y1, bw) => { g.fillStyle = '#121014'; g.fillRect(x0 * S, y0 * S, (x1 - x0) * S, bw * S); g.fillRect(x0 * S, (y1 - bw) * S, (x1 - x0) * S, bw * S); g.fillRect(x0 * S, y0 * S, bw * S, (y1 - y0) * S); g.fillRect((x1 - bw) * S, y0 * S, bw * S, (y1 - y0) * S); g.strokeStyle = '#c9a050'; g.lineWidth = 0.04 * S; g.strokeRect((x0 + bw + 0.08) * S, (y0 + bw + 0.08) * S, (x1 - x0 - 2 * bw - 0.16) * S, (y1 - y0 - 2 * bw - 0.16) * S); };
    band(0.3, 0.3, w - 0.3, d - 0.3, 0.4);
    for (const f of opts.fields || []) band(...f, 0.25);
    // Sternrosetten
    for (const [cx, cy, r] of opts.stars || []) {
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr2 = i % 2 ? r * 0.45 : r; g.fillStyle = i % 4 < 2 ? '#121014' : '#c9a050'; g.beginPath(); g.moveTo(cx * S, cy * S); g.lineTo((cx + Math.cos(a - 0.2) * r * 0.3) * S, (cy + Math.sin(a - 0.2) * r * 0.3) * S); g.lineTo((cx + Math.cos(a) * rr2) * S, (cy + Math.sin(a) * rr2) * S); g.lineTo((cx + Math.cos(a + 0.2) * r * 0.3) * S, (cy + Math.sin(a + 0.2) * r * 0.3) * S); g.closePath(); g.fill(); }
      g.strokeStyle = '#c9a050'; g.lineWidth = 0.05 * S; g.beginPath(); g.arc(cx * S, cy * S, r * 1.08 * S, 0, 7); g.stroke();
    }
    // Fischgrät-Parkett (Schlafzimmer): Räuchereiche in Streifen, je Streifen um ±45° gedreht
    for (const [x0, y0, x1, y1] of opts.wood || []) {
      g.save(); g.beginPath(); g.rect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S); g.clip();
      g.fillStyle = '#3a2416'; g.fillRect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S);
      const pw = 0.09 * S, pl = 0.55 * S;
      for (let col = 0; x0 + col * 0.78 < x1; col++) {
        const cx = (x0 + col * 0.78) * S;
        for (let r = 0; (y0 + r * 0.09 * 1.414 - 1) * S < y1 * S; r++) {
          const y = (y0 - 1) * S + r * pw * 1.414, v = 0.75 + rr() * 0.45;
          g.save(); g.translate(cx + (col % 2 ? 0.78 * S : 0), y); g.rotate(col % 2 ? -Math.PI / 4 : Math.PI / 4);
          g.fillStyle = `rgb(${92 * v | 0},${58 * v | 0},${34 * v | 0})`; g.fillRect(0, 0, pl, pw - 1.5);
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, pw - 1.5, pl, 1.5); g.restore();
        }
      }
      g.restore();
      g.strokeStyle = '#c9a050'; g.lineWidth = 0.05 * S; g.strokeRect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S);
    }
    // Schachbrett (Küche)
    for (const [x0, y0, x1, y1] of opts.checker || []) {
      const q = 0.5;
      for (let y = y0; y < y1 - 1e-6; y += q) for (let x = x0; x < x1 - 1e-6; x += q) { g.fillStyle = (Math.round((x - x0) / q) + Math.round((y - y0) / q)) % 2 ? '#141216' : '#ece6da'; g.fillRect(x * S, y * S, q * S + 0.5, q * S + 0.5); }
      g.strokeStyle = '#c9a050'; g.lineWidth = 0.05 * S; g.strokeRect(x0 * S, y0 * S, (x1 - x0) * S, (y1 - y0) * S);
    }
  });
}
// Travertin für die Terrasse: warme Platten 0,9 x 0,6 m mit Poren
export function travertineTex() {
  return rep(canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(44);
    g.fillStyle = '#b9ab92'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 128) for (let x = -((y / 128) % 2) * 96; x < W; x += 192) { g.fillStyle = `rgb(${175 + rr() * 30 | 0},${162 + rr() * 26 | 0},${136 + rr() * 22 | 0})`; g.fillRect(x + 2, y + 2, 188, 124); }
    for (let k = 0; k < 2200; k++) { g.fillStyle = `rgba(90,75,55,${0.1 + rr() * 0.3})`; g.fillRect(rr() * W, rr() * H, 1 + rr() * 5, 1); }
    for (let k = 0; k < 60; k++) { g.strokeStyle = 'rgba(120,100,75,0.18)'; g.lineWidth = 1; const y = rr() * H; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W / 3, y + rr() * 20 - 10, W * 2 / 3, y + rr() * 20 - 10, W, y); g.stroke(); }
  }));
}
// Damast-Tapete (Seidenglanz) in einer Grundfarbe
export function damaskTex(base = '#123c3e', motif = '#1d5356') {
  return rep(canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    g.fillStyle = motif;
    for (const [cx, cy] of [[64, 64], [192, 192], [192, -64], [-64, 192], [192, 64 + 128], [64, 192]]) {
      g.save(); g.translate(cx, cy);
      for (let k = 0; k < 8; k++) { g.rotate(Math.PI / 4); g.beginPath(); g.ellipse(0, 26, 9, 26, 0, 0, 7); g.fill(); }
      g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); g.restore();
    }
    g.strokeStyle = 'rgba(214,172,92,0.35)'; g.lineWidth = 2; for (let x = 0; x <= W; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  }));
}
// Makassar-Ebenholzfurnier (schwarz-braun gestreift, hochglänzend)
export function veneerTex() {
  return rep(canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(55);
    g.fillStyle = '#1d110a'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 2) { const v = Math.sin(x * 0.05 + Math.sin(x * 0.013) * 3) * 0.5 + 0.5; g.fillStyle = `rgba(${90 + v * 70 | 0},${50 + v * 35 | 0},${22 + v * 12 | 0},${0.25 + 0.5 * v * rr()})`; g.fillRect(x, 0, 2, H); }
    for (let k = 0; k < 40; k++) { g.strokeStyle = 'rgba(10,6,3,0.4)'; g.lineWidth = 1 + rr() * 3; const x = rr() * W; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rr() * 30 - 15, H / 3, x + rr() * 30 - 15, H * 2 / 3, x, H); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 1.5, H);
  }));
}
// Leuchtender Onyx für die Bar (von hinten beleuchtet)
export function onyxTex() {
  return rep(canvasTex(512, 512, (g, W, H) => {
    const rr = mulberry32(66);
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#f0c27a'); gr.addColorStop(0.5, '#d88a3a'); gr.addColorStop(1, '#f6d8a0');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(${rr() < 0.5 ? '255,240,210' : '140,70,20'},${0.15 + rr() * 0.3})`; g.lineWidth = 2 + rr() * 14; const y = rr() * H; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 32) g.lineTo(x, y + Math.sin(x / 50 + k) * 18 + (rr() - 0.5) * 8); g.stroke(); }
  }));
}

// Kassettendecke: dunkles Feld, Goldrahmen, kleiner Fächer (wird gekachelt)
export function cofferTex2() {
  return rep(canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#e8dcc8'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H / 2, 8, W / 2, H / 2, W * 0.45); gr.addColorStop(0, '#f6eedc'); gr.addColorStop(1, '#cbbd9e');
    g.fillStyle = gr; g.fillRect(22, 22, W - 44, H - 44);
    g.strokeStyle = '#b8903e'; g.lineWidth = 7; g.strokeRect(10, 10, W - 20, H - 20); g.lineWidth = 2; g.strokeRect(28, 28, W - 56, H - 56);
    g.save(); g.translate(W / 2, H / 2); for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.fillStyle = i % 2 ? 'rgba(184,144,62,0.75)' : 'rgba(184,144,62,0.25)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-7, 46); g.lineTo(7, 46); g.closePath(); g.fill(); } g.restore();
  }));
}
// Buchrücken für Regale (Leder in Bordeaux, Grün, Blau, Braun, Goldprägung)
export function booksTex() {
  return rep(canvasTex(512, 128, (g, W, H) => {
    const rr = mulberry32(88), C = ['#5a1420', '#163c2c', '#14243e', '#4a2c14', '#2a1c10', '#6a4a1a'];
    g.fillStyle = '#140c06'; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W;) { const w = 6 + rr() * 12, h = H * (0.7 + rr() * 0.28); g.fillStyle = C[Math.floor(rr() * C.length)]; g.fillRect(x, H - h, w - 1, h); g.fillStyle = 'rgba(214,172,92,0.8)'; g.fillRect(x + 1, H - h + 8, w - 3, 2); g.fillRect(x + 1, H - h + 14 + rr() * 20, w - 3, 1.5); x += w; }
  }));
}
// Weiße Fliesen mit Goldfuge für Küche und Bad
export function tileTex(c1 = '#f1ece2', c2 = '#e4ddcf', joint = '#b89a5a') {
  return rep(canvasTex(256, 256, (g, W, H) => {
    const rr = mulberry32(99);
    g.fillStyle = joint; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 32) for (let x = -((y / 32) % 2) * 32; x < W; x += 64) { g.fillStyle = rr() < 0.5 ? c1 : c2; g.fillRect(x + 1.5, y + 1.5, 61, 29); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 3, y + 3, 40, 3); }
  }));
}
// Mosaik für das Becken: Türkis mit goldenen Sternen
export function mosaicTex() {
  return rep(canvasTex(256, 256, (g, W, H) => {
    const rr = mulberry32(111);
    for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) { const v = rr(); g.fillStyle = v < 0.08 ? '#c9a050' : `rgb(${20 + v * 30 | 0},${120 + v * 60 | 0},${130 + v * 50 | 0})`; g.fillRect(x + 0.5, y + 0.5, 7, 7); }
  }));
}
// Innenleben für die Ferne: warmes Licht hinter Glas mit dunklen Möbelschatten
export function glowRoomTex() {
  return canvasTex(512, 160, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#a87838'); gr.addColorStop(0.5, '#e0a050'); gr.addColorStop(1, '#5a3a18');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const rr = mulberry32(122);
    g.fillStyle = 'rgba(30,18,8,0.55)';
    for (let k = 0; k < 14; k++) { const x = rr() * W, w = 10 + rr() * 40, h = 10 + rr() * 30; g.fillRect(x, H - h - 4, w, h); }
    g.fillStyle = 'rgba(40,24,10,0.6)'; g.fillRect(0, H * 0.5, W, 6);
    for (let k = 0; k < 6; k++) { const x = 40 + k * 85; g.fillStyle = 'rgba(255,240,200,0.8)'; g.beginPath(); g.arc(x, H * 0.18, 6, 0, 7); g.fill(); }
  });
}
