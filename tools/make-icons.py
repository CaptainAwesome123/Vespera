#!/usr/bin/env python3
"""Erzeugt das App-Logo (SVG) für Vespera: Belmont-Turm vor Fächer-Sonnenrad, Gold auf Petrol.
Ausgabe: assets/icons/icon.svg (mit Rahmen) und icon-maskable.svg (ohne Rahmen, kleiner, für
Android-Masken). PNGs macht tools/make-icons.js daraus."""
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

DEFS = '''<defs>
  <radialGradient id="bg" cx="50%" cy="58%" r="70%">
    <stop offset="0" stop-color="#0f5058"/><stop offset=".55" stop-color="#072a33"/><stop offset="1" stop-color="#03131a"/>
  </radialGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbe7ad"/><stop offset=".45" stop-color="#e2bd72"/><stop offset="1" stop-color="#a77d3a"/>
  </linearGradient>
  <linearGradient id="goldH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a77d3a"/><stop offset=".5" stop-color="#f6dc9a"/><stop offset="1" stop-color="#a77d3a"/>
  </linearGradient>
  <linearGradient id="tower" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#06222a"/><stop offset=".5" stop-color="#0b3640"/><stop offset="1" stop-color="#041820"/>
  </linearGradient>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#f6dc9a" stop-opacity=".55"/><stop offset="1" stop-color="#f6dc9a" stop-opacity="0"/>
  </radialGradient>
</defs>'''

def sunburst(cx, cy, r0, r1, n=15):
    """Fächer nach oben: abwechselnd breite und schmale Goldstrahlen."""
    out = []
    for i in range(n):
        a0 = math.pi + (i + 0.5) / n * math.pi
        w = (0.30 if i % 2 == 0 else 0.16) * math.pi / n
        rr = r1 if i % 2 == 0 else r1 * 0.86
        pts = []
        for a, r in ((a0 - w, r0), (a0 - w * 0.55, rr), (a0 + w * 0.55, rr), (a0 + w, r0)):
            pts.append(f'{cx + r * math.cos(a):.1f},{cy + r * math.sin(a):.1f}')
        out.append(f'<polygon points="{" ".join(pts)}" fill="url(#gold)" opacity="{0.9 if i % 2 == 0 else 0.55}"/>')
    # zwei Bögen als Fächerkante
    for r, sw in ((r1 + 12, 5), (r1 + 26, 2.5)):
        out.append(f'<path d="M{cx - r},{cy} A{r},{r} 0 0 1 {cx + r},{cy}" fill="none" stroke="url(#goldH)" stroke-width="{sw}"/>')
    return '\n'.join(out)

def tower(cx, base, scale=1.0, main=True):
    s = scale
    # Stufen (halbe Breite, obere Kante) von unten nach oben
    steps = [(54, 262), (42, 214), (31, 176), (20, 146)]
    def X(dx): return f'{cx + dx * s:.1f}'
    def Y(y): return f'{base - (430 - y) * s:.1f}'
    pts = [(-steps[0][0], 430)]
    for i, (hw, top) in enumerate(steps):
        pts.append((-hw, top))
        nxt = steps[i + 1][0] if i + 1 < len(steps) else None
        if nxt is not None:
            pts.append((-nxt, top))
    pts.append((0, 70))  # Spitze
    for i, (hw, top) in reversed(list(enumerate(steps))):
        nxt = steps[i + 1][0] if i + 1 < len(steps) else None
        if nxt is not None:
            pts.append((nxt, top))
        pts.append((hw, top))
    pts.append((steps[0][0], 430))
    poly = ' '.join(f'{X(x)},{Y(y)}' for x, y in pts)
    g = [f'<polygon points="{poly}" fill="url(#tower)" stroke="url(#gold)" stroke-width="{4 * s:.1f}" stroke-linejoin="miter"/>']
    if main:
        # goldene Lisenen
        for dx, top in ((-30, 268), (-12, 268), (12, 268), (30, 268), (-18, 220), (18, 220), (0, 182)):
            g.append(f'<line x1="{X(dx)}" y1="{Y(top)}" x2="{X(dx)}" y2="{Y(424)}" stroke="#d9b26a" stroke-width="{3 * s:.1f}" opacity=".85"/>')
        # Stufenbänder
        for hw, top in steps[:3]:
            g.append(f'<line x1="{X(-hw)}" y1="{Y(top + 7)}" x2="{X(hw)}" y2="{Y(top + 7)}" stroke="#e8c780" stroke-width="{3 * s:.1f}"/>')
        # Krone: kleines Fächerfenster
        g.append(f'<path d="M{X(-13)},{Y(146)} A{13 * s:.1f},{13 * s:.1f} 0 0 1 {X(13)},{Y(146)} Z" fill="url(#gold)"/>')
        g.append(f'<line x1="{X(0)}" y1="{Y(70)}" x2="{X(0)}" y2="{Y(30)}" stroke="#f6dc9a" stroke-width="{3 * s:.1f}" stroke-linecap="round"/>')
    return '\n'.join(g)

def body(frame):
    p = []
    p.append(f'<circle cx="256" cy="140" r="120" fill="url(#glow)"/>')
    p.append(sunburst(256, 330, 70, 168))
    # Nachbartürme (niedriger)
    p.append(tower(150, 430, 0.62, main=False))
    p.append(tower(362, 430, 0.62, main=False))
    p.append(tower(256, 430, 1.0, main=True))
    # Boden: Wasserlinien
    p.append('<rect x="96" y="428" width="320" height="6" fill="url(#goldH)"/>')
    p.append('<rect x="136" y="444" width="240" height="3" fill="url(#goldH)" opacity=".7"/>')
    p.append('<rect x="186" y="456" width="140" height="2" fill="url(#goldH)" opacity=".45"/>')
    if frame:
        # gestufter Art-Déco-Rahmen
        p.append('<path d="M60,96 L96,96 L96,60 L416,60 L416,96 L452,96 L452,416 L416,416 L416,452 L96,452 L96,416 L60,416 Z" fill="none" stroke="url(#goldH)" stroke-width="5"/>')
        p.append('<path d="M74,108 L108,108 L108,74 L404,74 L404,108 L438,108 L438,404 L404,404 L404,438 L108,438 L108,404 L74,404 Z" fill="none" stroke="url(#goldH)" stroke-width="2" opacity=".6"/>')
    return '\n'.join(p)

def svg(frame, rounded, scale=1.0):
    bg = '<rect width="512" height="512" rx="96" fill="url(#bg)"/>' if rounded else '<rect width="512" height="512" fill="url(#bg)"/>'
    inner = body(frame)
    if scale != 1.0:
        o = 256 * (1 - scale)
        inner = f'<g transform="translate({o:.1f} {o + 12:.1f}) scale({scale})">{inner}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">\n<title>Vespera</title>\n{DEFS}\n{bg}\n{inner}\n</svg>\n'

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'icon.svg'), 'w').write(svg(True, False))            # Quadrat, für Homescreen-PNGs
open(os.path.join(OUT, 'favicon.svg'), 'w').write(svg(False, True, 1.12))   # Browser-Tab: abgerundet, ohne Rahmen, größer
open(os.path.join(OUT, 'icon-maskable.svg'), 'w').write(svg(False, False, 0.78))  # Android-Maske: Sicherheitszone
print('ok')
