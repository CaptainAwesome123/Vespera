#!/usr/bin/env python3
"""Baut aus index.html + src/*.js (ES-Module) + assets/ wieder eine einzige HTML-Datei, z. B. für das claude.ai-Artefakt.
Aufruf: python3 tools/build-single.py [ausgabe.html]   (Standard: single/vespera.html)

Vorgehen: Der Modulgraph wird ab src/boot.js in derselben Reihenfolge durchlaufen, in der der Browser die Module
auswertet (Tiefensuche entlang der import-Zeilen). Die import-/export-Zeilen der eigenen Module fallen weg, die
Importe von three.js werden einmal oben gesammelt; alle obersten Namen sind im ganzen Spiel eindeutig, darum kann
der Code einfach hintereinander in ein <script type="module"> fließen. three.js kommt weiter per importmap vom CDN.
Die Dateien aus assets/ werden als Daten-URLs eingebettet (window.VESPERA_INLINE_ASSETS), damit die Einzeldatei
ohne Nachbarordner auskommt."""
import base64, mimetypes, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
IMPORT_RE = re.compile(r'^import\s+(?:(?P<what>[^\'"]*?)\s+from\s+)?[\'"](?P<spec>[^\'"]+)[\'"];?[ \t]*\n', re.M | re.S)
EXPORT_RE = re.compile(r'^export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)', re.M)
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
entry_m = re.search(r'<script type="module" src="(src/[^"]+\.js)"></script>\n?', html)
assert entry_m, 'index.html braucht <script type="module" src="src/boot.js">'
entry = entry_m.group(1)

mods, order, external = {}, [], []   # external: three.js-Importzeilen in Reihenfolge ihres ersten Auftretens
def load(rel):
    if rel in mods: return
    code = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    deps, body = [], code
    def strip(m):
        spec = m.group('spec')
        if spec.startswith('.'):
            deps.append(os.path.normpath(os.path.join(os.path.dirname(rel), spec)).replace(os.sep, '/'))
            return ''
        line = m.group(0).strip()
        if line not in external: external.append(line)
        return ''
    body = IMPORT_RE.sub(strip, body)
    body = EXPORT_RE.sub('', body)
    assert not re.search(r'^export\b', body, re.M), rel + ': unbekannte export-Form (nur export function/class/const/let werden unterstützt)'
    mods[rel] = {'deps': deps, 'body': body.strip('\n')}
    for d in deps: load(d)
    order.append(rel)   # nach den Abhängigkeiten: Reihenfolge wie die Modulauswertung im Browser
load(entry)

# oberste Namen müssen eindeutig sein, sonst würden sie sich im gemeinsamen Gültigkeitsbereich überschreiben
seen = {}
for rel in order:
    for m in re.finditer(r'^(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)', mods[rel]['body'], re.M):
        n = m.group(1)
        assert n not in seen, f'Name {n} kommt in {seen[n]} und {rel} vor'
        seen[n] = rel

parts = []
for rel in order:
    parts.append(f'/* ===== {rel} ===== */\n' + mods[rel]['body'])
bundle = '\n'.join(external) + '\n\n' + '\n\n'.join(parts) + '\n'

# assets/ einbetten
inline, total = {}, 0
adir = os.path.join(ROOT, 'assets')
for dp, _, fns in os.walk(adir):
    for fn in sorted(fns):
        fp = os.path.join(dp, fn); rel = os.path.relpath(fp, adir).replace(os.sep, '/')
        data = open(fp, 'rb').read(); total += len(data)
        mt = mimetypes.guess_type(fn)[0] or ('model/gltf-binary' if fn.endswith('.glb') else 'application/octet-stream')
        inline[rel] = f'data:{mt};base64,' + base64.b64encode(data).decode()
if total > 4_000_000: print('WARNUNG: assets/ ist', total // 1024, 'KB groß; die Einzeldatei wird sehr groß', file=sys.stderr)
assets_js = '<script>window.VESPERA_INLINE_ASSETS = {' + ','.join(f'\n  {rel!r}: {url!r}' for rel, url in inline.items()) + '\n};</script>\n'

out = html.replace(entry_m.group(0), assets_js + '<script type="module">\n' + bundle + '</script>\n')
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'single', 'vespera.html')
open(dst, 'w', encoding='utf-8').write(out)
print('gebaut:', dst, len(out.encode('utf-8')), 'Bytes aus', len(order), 'Modulen und', len(inline), 'Asset-Dateien')
