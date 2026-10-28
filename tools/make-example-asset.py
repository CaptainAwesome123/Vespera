#!/usr/bin/env python3
"""Erzeugt das kleine Beispielmodell assets/models/deco-bollard.glb (Art-Deco-Poller aus Bronze),
ganz ohne Zusatzpakete. Zeigt, wie ein glTF-Binary aufgebaut ist; echte Modelle kommen aus Blender o. ä."""
import json, math, struct, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Profil (Radius, Höhe) eines achteckigen Pollers mit Stufenfuß, Schaft und abgesetzter Kappe
profile = [(0.0, 0.0), (0.26, 0.0), (0.26, 0.06), (0.2, 0.06), (0.2, 0.14), (0.15, 0.14), (0.15, 0.78), (0.19, 0.82), (0.19, 0.9), (0.13, 0.94), (0.13, 1.0), (0.0, 1.0)]
N = 8
pos, nor, idx = [], [], []
def ring(r, y, k):
    a = (k + 0.5) * 2 * math.pi / N
    return (r * math.cos(a), y, r * math.sin(a))
for i in range(len(profile) - 1):
    (r0, y0), (r1, y1) = profile[i], profile[i + 1]
    for k in range(N):
        a, b = ring(r0, y0, k), ring(r0, y0, k + 1)
        c, d = ring(r1, y1, k + 1), ring(r1, y1, k)
        quad = [a, b, c, d]
        # Flächennormale (flat shading, passend zu den kantigen Deco-Formen)
        u = tuple(c[j] - a[j] for j in range(3)); v = tuple(b[j] - a[j] for j in range(3))
        n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
        l = math.sqrt(sum(x * x for x in n)) or 1.0; n = tuple(x / l for x in n)
        if r0 == 0 and r1 == 0: continue
        base = len(pos)
        for q in quad: pos.append(q); nor.append(n)
        if r0 > 0: idx += [base, base + 2, base + 1]
        if r1 > 0: idx += [base, base + 3, base + 2]
pb = b''.join(struct.pack('<3f', *p) for p in pos)
nb = b''.join(struct.pack('<3f', *n) for n in nor)
ib = b''.join(struct.pack('<H', i) for i in idx)
while len(ib) % 4: ib += b'\0'
mn = [min(p[j] for p in pos) for j in range(3)]; mx = [max(p[j] for p in pos) for j in range(3)]
gltf = {
    "asset": {"version": "2.0", "generator": "vespera tools/make-example-asset.py"},
    "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": "DecoBollard"}],
    "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "NORMAL": 1}, "indices": 2, "material": 0}]}],
    "materials": [{"name": "Bronze", "pbrMetallicRoughness": {"baseColorFactor": [0.72, 0.5, 0.24, 1.0], "metallicFactor": 0.9, "roughnessFactor": 0.35}, "emissiveFactor": [0.05, 0.03, 0.01]}],
    "accessors": [
        {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mn, "max": mx},
        {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"},
        {"bufferView": 2, "componentType": 5123, "count": len(idx), "type": "SCALAR"}],
    "bufferViews": [
        {"buffer": 0, "byteOffset": 0, "byteLength": len(pb), "target": 34962},
        {"buffer": 0, "byteOffset": len(pb), "byteLength": len(nb), "target": 34962},
        {"buffer": 0, "byteOffset": len(pb) + len(nb), "byteLength": len(ib), "target": 34963}],
    "buffers": [{"byteLength": len(pb) + len(nb) + len(ib)}],
}
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
binc = pb + nb + ib
out = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(binc)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(binc), b'BIN\0') + binc
dst = os.path.join(ROOT, 'assets', 'models', 'deco-bollard.glb')
open(dst, 'wb').write(out)
print('geschrieben:', dst, len(out), 'Bytes,', len(pos), 'Eckpunkte,', len(idx) // 3, 'Dreiecke')
