#!/usr/bin/env python3
"""Baut aus index.html + src/*.js wieder eine einzige HTML-Datei (z. B. für das claude.ai-Artefakt).
Aufruf: python3 tools/build-single.py [ausgabe.html]   (Standard: single/vespera.html)"""
import os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
tags = re.findall(r'<script src="(src/[^"]+\.js)"></script>', html)
parts = []
for t in tags:
    code = open(os.path.join(ROOT, t), encoding='utf-8').read()
    parts.append(code.removeprefix("'use strict';\n").rstrip('\n'))
bundle = "<script>\n(() => {\n'use strict';\n" + '\n\n'.join(parts) + "\n})();\n</script>"
block = re.compile(r'(?:<script src="src/[^"]+\.js"></script>\n?)+')
assert len(block.findall(html)) == 1, 'Die src-Skripte müssen in index.html in einem Block stehen'
out = block.sub(lambda m: bundle + '\n', html)
dst = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'single', 'vespera.html')
open(dst, 'w', encoding='utf-8').write(out)
print('gebaut:', dst, len(out.encode('utf-8')), 'Bytes aus', len(tags), 'Dateien')
