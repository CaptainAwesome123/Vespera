#!/usr/bin/env python3
"""V115: Verwitterungs-Textur (kachelbar) für Risse, Schmutz und Abnutzung, rein rechnerisch erzeugt (keine Fotos, frei von Rechten).

  python3 tools/make-verwitterung.py [Ausgabeordner]   (braucht numpy und Pillow)

Kanäle von assets/textures/verwitterung.jpg (2048 px für PC unter hd/, 1024 px für Handy):
  R  Risse: 1 = heil, dunkel = Riss (Hauptrisse mit Verästelungen, feine Haarrisse, Craquelé-Nester)
  G  Schmutz: Mittelwert etwa 0,5; Wolken und senkrechte Laufspuren (Regen, Ruß, Staub)
  B  Feinstruktur: Poren, Sandkorn, Kelle; Werte über 0,8 sind Abplatzer und Roststellen
Gelesen wird sie von src/texturen.js (Abnutzung auf Wagen, Stadtmöbeln, Villa, Kuppeln) und vom Fassaden-Shader (Risse aus der Nähe).
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 2048
rng = np.random.default_rng(1151927)

def spectral(n, beta, aniso=(1.0, 1.0), seed=0):
    """Kachelbare Rauschfläche mit Leistungsspektrum 1/f^beta (FFT, darum nahtlos)."""
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy); f[0, 0] = 1.0
    amp = f ** (-beta / 2.0); amp[0, 0] = 0.0
    ph = r.random((n, n)) * 2 * np.pi
    z = np.real(np.fft.ifft2(amp * np.exp(1j * ph)))
    z -= z.mean(); z /= (z.std() + 1e-9)
    return z

def blur(a, s):
    n = a.shape[0]
    fx = np.fft.fftfreq(n)[None, :]; fy = np.fft.fftfreq(n)[:, None]
    g = np.exp(-2 * (np.pi * s) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))

# ---------- R: Risse ----------
crack = Image.new('L', (N, N), 0)
d = ImageDraw.Draw(crack)
def seg(p, q, w, v):
    # nahtlos: jedes Stück auch um eine Kachel versetzt zeichnen
    for ox in (-N, 0, N):
        for oy in (-N, 0, N):
            d.line([(p[0] + ox, p[1] + oy), (q[0] + ox, q[1] + oy)], fill=v, width=max(1, int(round(w))))

def walk(x, y, ang, steps, w0, v, depth=0):
    for i in range(steps):
        t = i / max(1, steps - 1)
        w = w0 * (1.0 - 0.75 * t)
        ang += rng.normal(0, 0.35)
        L = rng.uniform(5, 13)
        nx, ny = x + math.cos(ang) * L, y + math.sin(ang) * L
        seg((x, y), (nx, ny), w, v)
        if depth < 2 and rng.random() < 0.07:
            walk(nx, ny, ang + rng.choice([-1, 1]) * rng.uniform(0.5, 1.2), int(steps * rng.uniform(0.2, 0.5)), w * 0.7, int(v * 0.85), depth + 1)
        x, y = nx, ny

# Hauptrisse (wenige, lang, gezackt, oft schräg nach unten wie Setzrisse)
for k in range(9):
    walk(rng.uniform(0, N), rng.uniform(0, N), rng.uniform(0, 2 * math.pi) if k % 3 else math.pi / 2 + rng.normal(0, 0.5), int(rng.uniform(30, 90)), rng.uniform(2.5, 4.0), 255)
# Haarrisse (kurz, fein)
for k in range(140):
    walk(rng.uniform(0, N), rng.uniform(0, N), rng.uniform(0, 2 * math.pi), int(rng.uniform(4, 16)), 1.2, int(rng.uniform(110, 190)), 2)
# Craquelé-Nester: kleine Netze aus kurzen Rissen (abgeplatzter Putz, gealterter Lack)
for k in range(10):
    cx, cy, rad = rng.uniform(0, N), rng.uniform(0, N), rng.uniform(40, 110)
    for j in range(int(rad * 0.6)):
        a = rng.uniform(0, 2 * math.pi); r = rad * math.sqrt(rng.random())
        walk(cx + math.cos(a) * r, cy + math.sin(a) * r, rng.uniform(0, 2 * math.pi), int(rng.uniform(2, 5)), 1.0, int(rng.uniform(90, 160)), 2)
c = np.asarray(crack, dtype=np.float32) / 255.0
c = np.clip(0.75 * c + 0.45 * blur(c, 1.6), 0, 1)        # weicher Rand, dunkler Kern
R = 1.0 - 0.92 * c

# ---------- G: Schmutz ----------
cloud = spectral(N, 2.0, seed=11)
streak = spectral(N, 2.2, aniso=(1.0, 7.0), seed=12)        # senkrecht gestreckt: Laufspuren
fine = spectral(N, 1.2, seed=13)
G = 0.5 + 0.13 * cloud + 0.11 * streak + 0.04 * fine
G += 0.06 * blur(c, 6.0) * 2.0                           # in Rissen sammelt sich Schmutz

# ---------- B: Feinstruktur und Abplatzer ----------
grain = rng.random((N, N)).astype(np.float32)
grain = blur(grain - 0.5, 0.7)
grain /= grain.std() + 1e-9
pores = spectral(N, 1.0, seed=21)
trowel = spectral(N, 2.4, aniso=(0.35, 1.0), seed=22)      # breite Kellenstriche
B = 0.5 + 0.08 * grain + 0.05 * pores + 0.07 * trowel
spots = spectral(N, 2.6, seed=31) + 0.35 * spectral(N, 1.6, seed=32)
spot = np.clip((spots - 2.0) / 0.6, 0, 1)                 # seltene Flecken
B = np.where(spot > 0, 0.82 + 0.18 * spot, np.clip(B, 0.0, 0.78))

img = np.stack([R, np.clip(G, 0, 1), np.clip(B, 0, 1)], axis=-1)
img = (img * 255 + 0.5).astype(np.uint8)
out = sys.argv[1] if len(sys.argv) > 1 else 'assets/textures'
os.makedirs(os.path.join(out, 'hd'), exist_ok=True)
im = Image.fromarray(img, 'RGB')
im.save(os.path.join(out, 'hd', 'verwitterung.jpg'), quality=74, optimize=True, subsampling=0)
im.resize((1024, 1024), Image.LANCZOS).save(os.path.join(out, 'verwitterung.jpg'), quality=74, optimize=True, subsampling=0)
print('Rissanteil', float((c > 0.3).mean()), 'G', float(G.mean()), 'B Flecken', float((spot > 0).mean()))
