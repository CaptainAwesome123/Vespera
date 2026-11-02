#!/usr/bin/env python3
"""V54 · Eingangs-Atlas: Türen, Oberlichter, Reliefs und Steinflächen für alle Hauseingänge in einer Textur.

Erzeugt (in assets/textures/):
  portal-color.webp  2048 x 2048, RGBA (Alpha 0 = Glas: dahinter liegt die beleuchtete Halle)
  portal-normal.jpg  1024 x 1024, Normalen (OpenGL) aus den gezeichneten Höhen
  portal-orm.jpg     1024 x 1024, G = Rauheit, B = Metall (wie three.js roughnessMap/metalnessMap)

Gezeichnet wird je Kachel in doppelter Auflösung und dann verkleinert (glatte Kanten).
Fotos als Grundlage (alle CC0 bzw. MIT, siehe assets/LICENSES.md):
  Rock020_1K_Color.jpg (ambientCG, Kalkstein), Marble006_1K_Color.jpg (ambientCG, schwarzer Marmor),
  Metal007_1K_Color.jpg (ambientCG, Bronze/Messing gebürstet), brick_diffuse.jpg (three.js examples, Backstein)

Aufruf: python3 tools/make-portal-atlas.py <ordner-mit-den-fotos> [ausgabe-ordner]
Die Kachel-Lage (TILES) steht gleich in src/portal-kit.js (ATLAS).
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = sys.argv[1] if len(sys.argv) > 1 else '.'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'assets', 'textures')
N = 2048
SS = 2   # Überabtastung
rng = np.random.default_rng(54)

# x, y, w, h in Pixeln des 2048er Atlas (y von oben); Meter je Kachel stehen in portal-kit.js
TILES = {
    'doorBronze': (0, 0, 768, 1024),      # Bronze-Glas-Doppeltür 2,4 x 3,2 m
    'doorWood':   (768, 0, 640, 1024),    # Nussbaum-Doppeltür mit Messing 1,875 x 3,0 m
    'doorWork':   (1408, 0, 512, 1024),   # Arbeitertür aus Planken 1,35 x 2,7 m
    'glow':       (1920, 0, 128, 1024),   # beleuchtete Halle hinter dem Glas
    'fan':        (0, 1024, 1024, 512),   # halbrundes Fächer-Oberlicht 2,4 x 1,2 m
    'transom':    (1024, 1024, 1024, 256),  # gerades Oberlicht 2,0 x 0,5 m
    'relief':     (1024, 1280, 1024, 256),  # Sturz-Relief 3,45 x 0,86 m
    'lime':       (0, 1536, 512, 512),    # Kalkstein 1,6 m
    'marble':     (512, 1536, 512, 512),  # schwarzer Marmor 1,2 m
    'bronze':     (1024, 1536, 256, 512), # Bronzeblech 0,5 x 1,0 m
    'flute':      (1280, 1536, 256, 512), # kannelierter Stein 0,5 x 1,0 m
    'chevron':    (1536, 1536, 256, 512), # Winkelrelief 0,5 x 1,0 m
    'brick':      (1792, 1536, 256, 512), # Backstein 1,0 x 2,0 m
}


def photo(name, size=None):
    im = Image.open(os.path.join(SRC, name)).convert('RGB')
    if size: im = im.resize(size, Image.LANCZOS)
    return np.asarray(im, dtype=np.float32) / 255.0


def lum(a): return a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11


def noise2(h, w, scale, seed=0, oct=4):
    """Wertrauschen über mehrere Oktaven (kachelbar)"""
    r = np.random.default_rng(seed)
    out = np.zeros((h, w), np.float32); amp = 1.0; tot = 0
    for o in range(oct):
        gh, gw = max(2, int(h / scale * 2 ** o)), max(2, int(w / scale * 2 ** o))
        g = r.random((gh, gw)).astype(np.float32)
        z = ndimage.zoom(g, (h / gh, w / gw), order=3, mode='grid-wrap', grid_mode=True)
        zz = np.zeros((h, w), np.float32); zz[:min(h, z.shape[0]), :min(w, z.shape[1])] = z[:h, :w]
        out += zz * amp; tot += amp; amp *= 0.5
    return out / tot


class Tile:
    """Ebenen einer Kachel in doppelter Auflösung; Zeichnen in Metern (ppm Pixel je Meter)"""
    def __init__(self, w, h, ppm):
        self.W, self.H, self.ppm = w * SS, h * SS, ppm * SS
        self.col = np.zeros((self.H, self.W, 3), np.float32)
        self.hgt = np.zeros((self.H, self.W), np.float32)
        self.alpha = np.ones((self.H, self.W), np.float32)
        self.rough = np.full((self.H, self.W), 0.8, np.float32)
        self.metal = np.zeros((self.H, self.W), np.float32)

    def mask(self, fn):
        im = Image.new('L', (self.W, self.H), 0); d = ImageDraw.Draw(im); fn(d, self.ppm)
        return np.asarray(im, dtype=np.float32) / 255.0

    def rect(self, x0, y0, x1, y1):
        p = self.ppm
        return self.mask(lambda d, _: d.rectangle([x0 * p, y0 * p, x1 * p - 1, y1 * p - 1], fill=255))

    def poly(self, pts):
        p = self.ppm
        return self.mask(lambda d, _: d.polygon([(x * p, y * p) for x, y in pts], fill=255))

    def line(self, pts, w):
        p = self.ppm
        return self.mask(lambda d, _: d.line([(x * p, y * p) for x, y in pts], fill=255, width=max(1, int(round(w * p))), joint='curve'))

    def ellipse(self, cx, cy, rx, ry, width=None):
        p = self.ppm
        box = [(cx - rx) * p, (cy - ry) * p, (cx + rx) * p, (cy + ry) * p]
        if width: return self.mask(lambda d, _: d.ellipse(box, outline=255, width=max(1, int(round(width * p)))))
        return self.mask(lambda d, _: d.ellipse(box, fill=255))

    def paint(self, m, col, h=None, rough=None, metal=None, alpha=None, hmode='set'):
        m = m[..., None] if m.ndim == 2 else m
        c = np.broadcast_to(np.asarray(col, np.float32), self.col.shape) if np.ndim(col) <= 1 else col
        self.col = self.col * (1 - m) + c * m
        mm = m[..., 0]
        if h is not None:
            hv = np.broadcast_to(np.asarray(h, np.float32), mm.shape)
            self.hgt = self.hgt + hv * mm if hmode == 'add' else self.hgt * (1 - mm) + hv * mm
        if rough is not None: self.rough = self.rough * (1 - mm) + np.asarray(rough, np.float32) * mm
        if metal is not None: self.metal = self.metal * (1 - mm) + np.asarray(metal, np.float32) * mm
        if alpha is not None: self.alpha = self.alpha * (1 - mm) + np.asarray(alpha, np.float32) * mm

    def bevel(self, m, h, soft=0.012):
        """erhabene Fläche mit weicher Kante (Höhe h in Metern)"""
        s = soft * self.ppm
        mb = ndimage.gaussian_filter(m, s) if s > 0.5 else m
        self.hgt += mb * h


# ---------- Grundstoffe ----------
def bronze_tex(H, W, seed=1, tone=(0.46, 0.33, 0.17)):
    met = photo('Metal007_1K_Color.jpg', (W, H))
    l = lum(met); l = (l - l.mean()) * 1.2
    brush = noise2(H, W, 40, seed, 3)
    streak = np.repeat(np.random.default_rng(seed).random((1, W)).astype(np.float32), H, 0)
    streak = ndimage.gaussian_filter(streak, (0, 1.2))
    v = 0.85 + 0.35 * l + 0.12 * (brush - 0.5) + 0.08 * (streak - 0.5)
    return np.asarray(tone, np.float32) * v[..., None]


def brass_col(): return (0.78, 0.6, 0.3)


def walnut_tex(H, W, ppm, seed=3, vertical=True):
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    n = noise2(H, W, 220, seed, 4)
    n2 = noise2(H, W, 30, seed + 1, 2)
    a = (x if vertical else y) / ppm
    rings = np.sin(a * 140 + n * 3.5 + n2 * 0.8)
    fine = noise2(H, W, 3, seed + 2, 1)
    t = 0.5 + 0.5 * rings
    c0, c1 = np.array([0.12, 0.065, 0.035], np.float32), np.array([0.25, 0.14, 0.07], np.float32)
    col = c0 + (c1 - c0) * (0.35 + 0.65 * t ** 2)[..., None]
    col *= (0.9 + 0.2 * fine)[..., None]
    return col


def lime_tex(H, W):
    r = photo('Rock020_1K_Color.jpg', (W, H))
    l = lum(r); l = (l - l.mean()) / (l.std() + 1e-5)
    base = np.array([0.80, 0.75, 0.64], np.float32)
    return base * (1.0 + 0.09 * l)[..., None], l


def marble_tex(H, W):
    return photo('Marble006_1K_Color.jpg', (W, H)) * 0.95


def iron_col(): return (0.075, 0.072, 0.07)


# ---------- Kacheln ----------
def t_door_bronze():
    T = Tile(768, 1024, 320)   # 2,4 x 3,2 m
    W, H = 2.4, 3.2
    bz = bronze_tex(T.H, T.W, 2)
    T.paint(np.ones((T.H, T.W)), bz, h=0.0, rough=0.34, metal=1.0)
    for L in (0, 1):
        x0 = L * 1.2
        # Glasfeld mit Bronzegitter
        gx0, gx1, gy0, gy1 = x0 + 0.13, x0 + 1.2 - 0.13, 0.17, H - 0.55
        T.paint(T.rect(gx0, gy0, gx1, gy1), (0.05, 0.05, 0.05), h=-0.02, alpha=0.0)
        # Rahmenkante (erhaben)
        T.bevel(T.rect(x0 + 0.02, 0.02, x0 + 1.18, H - 0.02) - T.rect(gx0 - 0.02, gy0 - 0.02, gx1 + 0.02, gy1 + 0.02).clip(0, 1), 0.012)
        cx = (gx0 + gx1) / 2
        bars = []
        # senkrechte Stäbe, in der Mitte ein gestufter Rhombus (gefrorener Springbrunnen)
        for dx in (-0.28, 0.0, 0.28):
            bars.append(T.line([(cx + dx, gy0), (cx + dx, gy1)], 0.022))
        for yy in (gy0 + (gy1 - gy0) * 0.62,):
            bars.append(T.line([(gx0, yy), (gx1, yy)], 0.022))
        dy = gy0 + 0.75
        for s in (0.42, 0.3, 0.18):
            bars.append(T.line([(cx, dy - s * 1.4), (cx + s, dy), (cx, dy + s * 1.4), (cx - s, dy), (cx, dy - s * 1.4)], 0.02))
        # Fächerstrahlen über dem Querstab
        yb = gy0 + (gy1 - gy0) * 0.62
        for k in range(-3, 4):
            a = k * 0.33
            bars.append(T.line([(cx, yb), (cx + math.sin(a) * 0.6, yb - math.cos(a) * 0.6)], 0.016))
        bm = np.clip(sum(bars), 0, 1) * T.rect(gx0, gy0, gx1, gy1)
        T.paint(bm, bz * 1.15, h=0.0, alpha=1.0, rough=0.3, metal=1.0)
        T.bevel(bm, 0.008, 0.004)
        # Stoßstange quer, auf 1,05 m
        yp = H - 1.05
        pb = T.rect(x0 + 0.08, yp - 0.025, x0 + 1.12, yp + 0.025)
        T.paint(pb, np.asarray(brass_col()) * 1.05, h=0.03, alpha=1.0, rough=0.22, metal=1.0)
        T.bevel(pb, 0.02, 0.01)
        for px in (x0 + 0.14, x0 + 1.06):
            pm = T.rect(px - 0.03, yp - 0.06, px + 0.03, yp + 0.06)
            T.paint(pm, np.asarray(brass_col()) * 0.9, h=0.035, rough=0.25, metal=1.0); T.bevel(pm, 0.01, 0.006)
        # Trittblech mit Winkelgravur
        kp = T.rect(x0 + 0.06, H - 0.5, x0 + 1.14, H - 0.06)
        T.paint(kp, bz * 1.25, h=0.004, rough=0.28, metal=1.0)
        chev = []
        for k in range(4):
            yy = H - 0.42 + k * 0.08
            chev.append(T.line([(x0 + 0.12, yy + 0.05), (x0 + 0.6, yy - 0.03), (x0 + 1.08, yy + 0.05)], 0.012))
        T.bevel(np.clip(sum(chev), 0, 1) * kp, -0.004, 0.003)
    # Mittelstoß
    T.bevel(T.rect(1.17, 0, 1.23, H), 0.01, 0.004)
    return T


def t_door_wood():
    T = Tile(640, 1024, 1024 / 3.0)   # 1,875 x 3,0 m
    W, H = 1.875, 3.0
    wood = walnut_tex(T.H, T.W, T.ppm)
    T.paint(np.ones((T.H, T.W)), wood, h=0.0, rough=0.38, metal=0.0)
    br = np.asarray(brass_col(), np.float32)
    for L in (0, 1):
        x0 = L * W / 2; w = W / 2
        # Rahmen: Füllungen liegen tiefer, Profilkante dazwischen
        def panel(y0, y1, inset=0.12):
            m = T.rect(x0 + inset, y0, x0 + w - inset, y1)
            T.bevel(m, -0.012, 0.006)
            edge = T.rect(x0 + inset - 0.025, y0 - 0.025, x0 + w - inset + 0.025, y1 + 0.025) - m
            T.bevel(np.clip(edge, 0, 1), 0.006, 0.004)
            return m
        # oberes Glasfeld mit Messing-Sonnenfächer
        gy0, gy1 = 0.3, 1.2
        g = T.rect(x0 + 0.13, gy0, x0 + w - 0.13, gy1)
        T.paint(g, (0.04, 0.04, 0.04), h=-0.02, alpha=0.0)
        cx, cy = x0 + w / 2, gy1
        bars = [T.line([(x0 + 0.13, gy1 - 0.01), (x0 + w - 0.13, gy1 - 0.01)], 0.02)]
        for k in range(9):
            a = -math.pi / 2 + (k - 4) * 0.33
            bars.append(T.line([(cx, cy), (cx + math.cos(a) * 1.0, cy + math.sin(a) * 1.0)], 0.014))
        for r in (0.22, 0.52):
            bars.append(T.ellipse(cx, cy, r, r, width=0.016))
        bars.append(T.ellipse(cx, cy, 0.1, 0.1))
        bm = np.clip(sum(bars), 0, 1) * g
        T.paint(bm, br, h=0.0, alpha=1.0, rough=0.3, metal=1.0); T.bevel(bm, 0.006, 0.003)
        T.bevel(np.clip(T.rect(x0 + 0.1, gy0 - 0.03, x0 + w - 0.1, gy1 + 0.03) - g, 0, 1), 0.008, 0.004)
        # mittlere Füllung mit Messing-Stufenlinie (Zikkurat)
        m2 = panel(1.38, 2.18)
        lines = []
        for s in range(3):
            d = 0.06 + s * 0.07
            px0, px1, py0, py1 = x0 + 0.12 + d, x0 + w - 0.12 - d, 1.38 + d, 2.18 - d
            q = 0.07
            lines.append(T.line([(px0, py1), (px0, py0 + 2 * q), (cx - 0.16 + s * 0.02, py0 + 2 * q), (cx - 0.16 + s * 0.02, py0 + q), (cx - 0.07 + s * 0.02, py0 + q), (cx - 0.07 + s * 0.02, py0), (cx + 0.07 - s * 0.02, py0), (cx + 0.07 - s * 0.02, py0 + q), (cx + 0.16 - s * 0.02, py0 + q), (cx + 0.16 - s * 0.02, py0 + 2 * q), (px1, py0 + 2 * q), (px1, py1), (px0, py1)], 0.01))
        lm = np.clip(sum(lines), 0, 1) * m2
        T.paint(lm, br, rough=0.3, metal=1.0); T.bevel(lm, 0.003, 0.002)
        # untere Füllung mit Winkeln
        m3 = panel(2.32, 2.78)
        ch = [T.line([(x0 + 0.2, 2.62 - k * 0.07), (cx, 2.52 - k * 0.07), (x0 + w - 0.2, 2.62 - k * 0.07)], 0.01) for k in range(3)]
        cm = np.clip(sum(ch), 0, 1) * m3
        T.paint(cm, br, rough=0.3, metal=1.0); T.bevel(cm, 0.003, 0.002)
        # Griffstange und Trittblech
        gx = x0 + (w - 0.09 if L == 0 else 0.09)
        gm = T.rect(gx - 0.018, 1.3, gx + 0.018, 1.95)
        T.paint(gm, br * 1.1, rough=0.2, metal=1.0); T.bevel(gm, 0.03, 0.01)
        kp = T.rect(x0 + 0.04, H - 0.17, x0 + w - 0.04, H - 0.03)
        T.paint(kp, br * 0.95, rough=0.3, metal=1.0); T.bevel(kp, 0.004, 0.003)
    T.bevel(T.rect(W / 2 - 0.012, 0, W / 2 + 0.012, H), -0.01, 0.003)
    return T


def t_door_work():
    T = Tile(512, 1024, 1024 / 2.7)   # 1,35 x 2,7 m
    W, H = 1.35, 2.7
    wood = walnut_tex(T.H, T.W, T.ppm, seed=9) * 0.6 + 0.12
    paint = np.array([0.1, 0.19, 0.15], np.float32)
    chip = noise2(T.H, T.W, 9, 11, 4)
    grime = np.clip((np.mgrid[0:T.H, 0:T.W][0] / T.H - 0.65) * 2.2, 0, 1)
    nP = 6
    col = np.broadcast_to(paint, (T.H, T.W, 3)).copy()
    col *= (0.85 + 0.3 * noise2(T.H, T.W, 6, 12, 2))[..., None]
    chipped = (chip > 0.68).astype(np.float32) * (0.4 + 0.6 * (np.mgrid[0:T.H, 0:T.W][0] / T.H > 0.55))
    chipped = ndimage.gaussian_filter(chipped, 0.8)
    col = col * (1 - chipped[..., None]) + wood * chipped[..., None]
    col *= (1 - 0.45 * grime * (0.6 + 0.4 * noise2(T.H, T.W, 8, 13, 2)))[..., None]
    T.paint(np.ones((T.H, T.W)), col, h=0.0, rough=0.75, metal=0.0)
    T.hgt -= chipped * 0.002
    for k in range(1, nP):
        x = W * k / nP
        T.bevel(T.rect(x - 0.006, 0, x + 0.006, H), -0.008, 0.003)
    # kleines Fenster mit Gitter
    wx0, wx1, wy0, wy1 = 0.38, 0.97, 0.32, 0.78
    g = T.rect(wx0, wy0, wx1, wy1)
    T.paint(g, (0.03, 0.03, 0.03), alpha=0.0, h=-0.02)
    fr = np.clip(T.rect(wx0 - 0.05, wy0 - 0.05, wx1 + 0.05, wy1 + 0.05) - g, 0, 1)
    T.paint(fr, paint * 0.8, rough=0.7); T.bevel(fr, 0.012, 0.005)
    bars = np.clip(sum(T.line([(wx0 + (wx1 - wx0) * k / 4, wy0), (wx0 + (wx1 - wx0) * k / 4, wy1)], 0.02) for k in (1, 2, 3)), 0, 1) * g
    T.paint(bars, iron_col(), alpha=1.0, rough=0.5, metal=0.8); T.bevel(bars, 0.01, 0.004)
    # Eisenbänder mit Nieten
    ic = np.asarray(iron_col(), np.float32)
    for yy in (0.55 - 0.3, 1.3, 2.3):
        if yy < 0.3: yy = 1.0
        band = T.poly([(0.02, yy - 0.045), (0.8, yy - 0.03), (0.86, yy), (0.8, yy + 0.03), (0.02, yy + 0.045)])
        T.paint(band, ic * (1 + 0.4 * noise2(T.H, T.W, 10, 14, 2))[..., None], rough=0.55, metal=0.7); T.bevel(band, 0.008, 0.004)
        for rx in (0.1, 0.3, 0.5, 0.7):
            r = T.ellipse(rx, yy, 0.016, 0.016)
            T.paint(r, ic * 1.6, rough=0.45, metal=0.8); T.bevel(r, 0.008, 0.004)
    # Klinke mit Schild
    sh = T.rect(1.12, 1.35, 1.2, 1.6)
    T.paint(sh, ic * 1.3, rough=0.5, metal=0.8); T.bevel(sh, 0.006, 0.003)
    kl = T.rect(1.0, 1.4, 1.19, 1.44)
    T.paint(kl, ic * 1.8, rough=0.4, metal=0.9); T.bevel(kl, 0.02, 0.006)
    # Briefschlitz
    bs = T.rect(0.45, 1.7, 0.9, 1.74)
    T.paint(bs, (0.5, 0.38, 0.2), rough=0.35, metal=1.0); T.bevel(bs, 0.004, 0.002)
    return T


def t_glow():
    T = Tile(128, 1024, 128 / 0.8)
    y = np.linspace(0, 1, T.H)[:, None] * np.ones((1, T.W))
    x = np.linspace(-1, 1, T.W)[None, :] * np.ones((T.H, 1))
    v = 0.5 + 0.5 * np.exp(-((y - 0.22) / 0.2) ** 2) + 0.25 * np.exp(-((y - 0.9) / 0.08) ** 2) - 0.12 * np.exp(-((y - 0.6) / 0.1) ** 2)
    v *= 0.9 + 0.1 * np.cos(x * 2.0)
    col = np.stack([v * 1.0, v * 0.74, v * 0.42], -1) * 0.9
    # Kronleuchter-Glanzpunkte
    for cy in (0.18, 0.24):
        col += (np.exp(-(((y - cy) / 0.012) ** 2 + (x / 0.25) ** 2)) * 0.5)[..., None] * np.array([1, 0.9, 0.7])
    T.paint(np.ones((T.H, T.W)), np.clip(col, 0, 1), h=0.0, rough=1.0, metal=0.0)
    return T


def t_fan():
    T = Tile(1024, 512, 1024 / 2.4)   # 2,4 x 1,2 m, Mittelpunkt unten Mitte
    W, H = 2.4, 1.2
    bz = bronze_tex(T.H, T.W, 4)
    cx, cy, R = 1.2, 1.2, 1.2
    T.paint(np.ones((T.H, T.W)), bz, alpha=0.0, h=0.0, rough=0.32, metal=1.0)
    disc = T.ellipse(cx, cy, R - 0.004, R - 0.004)
    parts = [T.ellipse(cx, cy, R - 0.035, R - 0.035, width=0.07), T.rect(0, H - 0.06, W, H), T.ellipse(cx, cy, 0.78, 0.78, width=0.03), T.ellipse(cx, cy, 0.5, 0.5, width=0.022)]
    for k in range(1, 16):
        a = math.pi + k * math.pi / 16
        parts.append(T.line([(cx + math.cos(a) * 0.3, cy + math.sin(a) * 0.3), (cx + math.cos(a) * R, cy + math.sin(a) * R)], 0.026 if k % 2 == 0 else 0.016))
    # Tropfen zwischen den Strahlen im Außenring
    for k in range(16):
        a = math.pi + (k + 0.5) * math.pi / 16
        px, py = cx + math.cos(a) * 0.98, cy + math.sin(a) * 0.98
        parts.append(T.ellipse(px, py, 0.035, 0.035))
    hub = T.ellipse(cx, cy, 0.3, 0.3)
    parts.append(hub)
    fr = np.clip(sum(parts), 0, 1) * disc
    T.paint(fr, bz * 1.12, alpha=1.0)
    T.bevel(fr, 0.01, 0.005)
    # gestufte Nabe: drei Ringe, dazwischen Fächerrillen
    for r, h in ((0.3, 0.012), (0.22, 0.012), (0.13, 0.014)):
        T.bevel(T.ellipse(cx, cy, r, r), h, 0.004)
    rays = np.clip(sum(T.line([(cx, cy), (cx + math.cos(math.pi + k * math.pi / 10) * 0.29, cy + math.sin(math.pi + k * math.pi / 10) * 0.29)], 0.008) for k in range(1, 10)), 0, 1) * hub
    T.bevel(rays, -0.004, 0.002)
    T.paint(T.ellipse(cx, cy, 0.13, 0.13), np.asarray(brass_col()) * 1.1, rough=0.22, metal=1.0)
    return T


def t_transom():
    T = Tile(1024, 256, 512)   # 2,0 x 0,5 m
    W, H = 2.0, 0.5
    bz = bronze_tex(T.H, T.W, 5)
    T.paint(np.ones((T.H, T.W)), bz, alpha=0.0, rough=0.32, metal=1.0)
    parts = [T.rect(0, 0, W, 0.05), T.rect(0, H - 0.05, W, H), T.rect(0, 0, 0.05, H), T.rect(W - 0.05, 0, W, H)]
    # Zickzack und gestufte Mitte
    pts = []
    n = 10
    for k in range(n + 1):
        x = 0.05 + (W - 0.1) * k / n
        pts.append((x, 0.08 if k % 2 == 0 else H - 0.08))
    parts.append(T.line(pts, 0.022))
    for k in range(1, 5):
        parts.append(T.rect(W * k / 5 - 0.012, 0.05, W * k / 5 + 0.012, H - 0.05))
    cm = T.poly([(0.75, H - 0.05), (0.75, 0.3), (0.85, 0.3), (0.85, 0.18), (0.95, 0.18), (0.95, 0.08), (1.05, 0.08), (1.05, 0.18), (1.15, 0.18), (1.15, 0.3), (1.25, 0.3), (1.25, H - 0.05)])
    inner = T.poly([(0.8, H - 0.05), (0.8, 0.34), (0.9, 0.34), (0.9, 0.22), (1.1, 0.22), (1.1, 0.34), (1.2, 0.34), (1.2, H - 0.05)])
    parts.append(np.clip(cm - inner, 0, 1))
    fr = np.clip(sum(parts), 0, 1)
    T.paint(fr, bz * 1.12, alpha=1.0); T.bevel(fr, 0.01, 0.004)
    return T


def t_relief():
    T = Tile(1024, 256, 1024 / 3.45)   # 3,45 x 0,86 m
    W, H = 3.45, 256 / (1024 / 3.45)
    base, l = lime_tex(T.H, T.W)
    T.paint(np.ones((T.H, T.W)), base, h=0.0, rough=0.85, metal=0.0)
    T.hgt += l * 0.0012
    # oberes Zickzackband, unten Zahnschnitt
    zz = []
    for k in range(int(W / 0.12) + 1):
        x = k * 0.12
        zz.append(T.poly([(x, 0.17), (x + 0.06, 0.05), (x + 0.12, 0.17)]))
    zm = np.clip(sum(zz), 0, 1)
    T.bevel(zm, 0.018, 0.006)
    T.bevel(T.rect(0, 0.0, W, 0.035), 0.02, 0.006)
    T.bevel(T.rect(0, 0.185, W, 0.205), -0.008, 0.003)
    for k in range(int(W / 0.1)):
        T.bevel(T.rect(k * 0.1 + 0.015, H - 0.085, k * 0.1 + 0.075, H - 0.02), 0.014, 0.004)
    T.bevel(T.rect(0, H - 0.11, W, H - 0.095), -0.006, 0.003)
    # Mitte: gestufte Kartusche mit Springbrunnen-Fächer
    cx, cy = W / 2, (0.22 + H - 0.11) / 2
    ct = T.poly([(cx - 0.55, cy - 0.12), (cx - 0.45, cy - 0.12), (cx - 0.45, cy - 0.22), (cx + 0.45, cy - 0.22), (cx + 0.45, cy - 0.12), (cx + 0.55, cy - 0.12), (cx + 0.55, cy + 0.2), (cx - 0.55, cy + 0.2)])
    T.bevel(ct, 0.012, 0.005)
    fan = [T.line([(cx, cy + 0.18), (cx + math.sin(a) * 0.42, cy + 0.18 - math.cos(a) * 0.36)], 0.016) for a in np.linspace(-1.2, 1.2, 11)]
    fm = np.clip(sum(fan), 0, 1) * ct
    T.bevel(fm, 0.01, 0.003)
    T.bevel(T.ellipse(cx, cy + 0.18, 0.06, 0.06), 0.015, 0.004)
    # Seiten: drei waagrechte Rillen, Rosetten
    for s in (-1, 1):
        for k in range(3):
            yy = cy - 0.08 + k * 0.08
            x0, x1 = (cx + 0.6, W - 0.1) if s > 0 else (0.1, cx - 0.6)
            T.bevel(T.rect(x0, yy - 0.012, x1, yy + 0.012), -0.008, 0.004)
        rx = cx + s * 1.05
        T.bevel(T.ellipse(rx, cy, 0.14, 0.14), 0.01, 0.006)
        pet = [T.ellipse(rx + math.cos(a) * 0.08, cy + math.sin(a) * 0.08, 0.035, 0.035) for a in np.linspace(0, 2 * math.pi, 9)[:-1]]
        T.bevel(np.clip(sum(pet), 0, 1), 0.008, 0.003)
        T.bevel(T.ellipse(rx, cy, 0.035, 0.035), 0.01, 0.003)
    # Gold in den Fächerstrahlen und der Rosettenmitte
    gold = np.clip(fm + sum(T.ellipse(cx + s * 1.05, cy, 0.035, 0.035) for s in (-1, 1)), 0, 1)
    T.paint(gold, np.asarray(brass_col()) * 1.1, rough=0.3, metal=1.0)
    # Schmutz in den Vertiefungen
    cav = np.clip(-ndimage.gaussian_filter(T.hgt, 3) + T.hgt, -1, 1)
    T.col *= (1 + np.clip(cav, -0.02, 0.02)[..., None] * 8)
    return T


def t_lime():
    T = Tile(512, 512, 320)
    base, l = lime_tex(T.H, T.W)
    T.paint(np.ones((T.H, T.W)), base, h=0.0, rough=0.85, metal=0.0)
    T.hgt += l * 0.0015
    return T


def t_marble():
    T = Tile(512, 512, 512 / 1.2)
    m = marble_tex(T.H, T.W)
    T.paint(np.ones((T.H, T.W)), m, h=0.0, rough=0.16, metal=0.0)
    return T


def t_bronze():
    T = Tile(256, 512, 512)
    T.paint(np.ones((T.H, T.W)), bronze_tex(T.H, T.W, 7), h=0.0, rough=0.36, metal=1.0)
    return T


def t_flute():
    T = Tile(256, 512, 512)   # 0,5 x 1,0 m
    base, l = lime_tex(T.H, T.W)
    T.paint(np.ones((T.H, T.W)), base, h=0.0, rough=0.82, metal=0.0)
    x = np.linspace(0, 1, T.W, endpoint=False)[None, :] * np.ones((T.H, 1))
    n = 5
    f = np.abs(np.sin(x * n * math.pi))
    g = np.clip((f - 0.12) / 0.88, 0, 1)
    T.hgt += -0.012 * np.sqrt(g) + l * 0.001
    T.col *= (0.88 + 0.12 * (1 - g))[..., None]
    return T


def t_chevron():
    T = Tile(256, 512, 512)
    base, l = lime_tex(T.H, T.W)
    T.paint(np.ones((T.H, T.W)), base, h=0.0, rough=0.82, metal=0.0)
    ch = []
    for k in range(-1, 6):
        y = k * 0.2
        ch.append(T.poly([(0.04, y + 0.1), (0.25, y + 0.0), (0.46, y + 0.1), (0.46, y + 0.16), (0.25, y + 0.06), (0.04, y + 0.16)]))
    m = np.clip(sum(ch), 0, 1)
    T.bevel(m, 0.012, 0.005)
    for s in (0.02, 0.48):
        T.bevel(T.rect(s - 0.015, 0, s + 0.015, 1.0), 0.01, 0.004)
    T.col *= (0.95 + 0.08 * m)[..., None]
    T.hgt += l * 0.001
    return T


def t_brick():
    T = Tile(256, 512, 256)   # 1,0 x 2,0 m
    b = photo('brick_diffuse.jpg')   # 1024 = etwa 2 m
    crop = b[:, :512]
    im = Image.fromarray((crop * 255).astype(np.uint8)).resize((T.W, T.H), Image.LANCZOS)
    c = np.asarray(im, np.float32) / 255.0
    T.paint(np.ones((T.H, T.W)), c * 0.9, h=0.0, rough=0.9, metal=0.0)
    try:
        bb = np.asarray(Image.open(os.path.join(SRC, 'brick_bump.jpg')).convert('L'), np.float32)[:, :512] / 255.0
        bb = np.asarray(Image.fromarray((bb * 255).astype(np.uint8)).resize((T.W, T.H), Image.LANCZOS), np.float32) / 255.0
        T.hgt += (bb - bb.mean()) * 0.012
    except FileNotFoundError:
        T.hgt += (lum(c) - lum(c).mean()) * 0.01
    return T


MAKERS = {'doorBronze': t_door_bronze, 'doorWood': t_door_wood, 'doorWork': t_door_work, 'glow': t_glow, 'fan': t_fan, 'transom': t_transom,
          'relief': t_relief, 'lime': t_lime, 'marble': t_marble, 'bronze': t_bronze, 'flute': t_flute, 'chevron': t_chevron, 'brick': t_brick}


def main():
    col = np.zeros((N, N, 4), np.float32); col[..., 3] = 1
    hgtN = np.zeros((N, N), np.float32)   # Normalen schon je Kachel (Kanten zwischen Kacheln bleiben flach)
    nrm = np.zeros((N, N, 3), np.float32); nrm[..., 2] = 1
    orm = np.zeros((N, N, 3), np.float32); orm[..., 0] = 1
    for name, (x, y, w, h) in TILES.items():
        T = MAKERS[name]()
        assert (T.W, T.H) == (w * SS, h * SS), (name, T.W, T.H, w, h)
        def down(a): return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), Image.BOX), np.float32)
        c = np.stack([down(T.col[..., i]) for i in range(3)] + [down(T.alpha)], -1)
        col[y:y + h, x:x + w] = np.clip(c, 0, 1)
        # Normale aus der Höhe (Meter) bei doppelter Auflösung, dann verkleinert
        hh = T.hgt
        gy, gx = np.gradient(hh, 1.0 / T.ppm)
        k = 1.0
        nn = np.stack([-gx * k, gy * k, np.ones_like(hh)], -1)   # OpenGL: grün nach oben (Bild-y nach unten)
        nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
        nd = np.stack([down(nn[..., i]) for i in range(3)], -1)
        nd /= np.linalg.norm(nd, axis=-1, keepdims=True)
        nrm[y:y + h, x:x + w] = nd
        orm[y:y + h, x:x + w, 1] = np.clip(down(T.rough), 0.05, 1)
        orm[y:y + h, x:x + w, 2] = np.clip(down(T.metal), 0, 1)
        print(name, w, h)
    # Farbe in sRGB speichern: gezeichnet wurde linear-ähnlich, für Kalkstein/Holz gilt der Wert direkt als Bildwert
    rgba = (np.clip(col, 0, 1) * 255 + 0.5).astype(np.uint8)
    # unter durchsichtigen Stellen die Farbe der Nachbarn ausbreiten (sonst dunkle Säume beim Filtern)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'portal-color.webp'), quality=88, method=6)
    nimg = ((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8)
    Image.fromarray(nimg).resize((N // 2, N // 2), Image.BOX).save(os.path.join(OUT, 'portal-normal.jpg'), quality=90)
    Image.fromarray((orm * 255 + 0.5).astype(np.uint8)).resize((N // 2, N // 2), Image.BOX).save(os.path.join(OUT, 'portal-orm.jpg'), quality=88)


if __name__ == '__main__':
    main()
