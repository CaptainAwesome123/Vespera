// Rocketbox-Test: ein paar Figuren aus Microsoft Rocketbox (MIT) als GLB für das Labor ?lab=rocketbox.
// Aufruf: node tools/make-rocketbox.mjs <Microsoft-Rocketbox-Ordner> <FBX2glTF-Programm>
//   Rocketbox: git clone --depth 1 --filter=blob:none --no-checkout https://github.com/microsoft/Microsoft-Rocketbox
//              und nur die gebrauchten Ordner auschecken (git checkout HEAD -- Assets/Avatars/Professions/Business_Male_02 ...)
//   FBX2glTF:  npm i fbx2gltf  (node_modules/fbx2gltf/bin/Linux/FBX2glTF)
// Ergebnis: assets/rocketbox/<name>.glb (Netz + Skelett + Texturen als WebP) und assets/rocketbox/anim-<name>.glb (nur Bewegung).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { KHRMeshQuantization, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, quantize, resample } from '@gltf-transform/functions';

const [,, RB, FBX2GLTF] = process.argv;
if (!RB || !FBX2GLTF) { console.error('Aufruf: node tools/make-rocketbox.mjs <Microsoft-Rocketbox> <FBX2glTF>'); process.exit(1); }
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'assets', 'rocketbox');
fs.mkdirSync(OUT, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-'));

// [Ordner unter Assets/Avatars, Name im Spiel]
const FIGS = [
  ['Professions/Business_Male_02', 'herr-anzug'],
  ['Professions/Business_Male_04', 'herr-weste'],
  ['Professions/Business_Female_03', 'dame-kostuem'],
  ['Professions/Gardener_Male_01', 'arbeiter'],
  ['Professions/Pilot_Male_01', 'uniform'],
  ['Professions/Business_Male_01', 'alexander-probe', { blond: true, noTie: true }],   // Probe: so könnte Alexander aussehen (blond, Fliege statt Krawatte)
];
// [Datei unter Assets/Animations, Name im Spiel, Wurzel waagerecht festhalten]
const ANIMS = [
  ['all_animations_max_motextr_xy/m_walk_neutral_01', 'm-gehen'],
  ['all_animations_max_motextr_xy/f_walk_neutral_01', 'f-gehen'],
  ['all_animations_max_motextr_static/m_idle_neutral_01', 'm-stehen'],
  ['all_animations_max_motextr_static/f_idle_neutral_02', 'f-stehen'],
];
// Texturgrößen: Gesicht scharf, Körper mittel, Normalen und Haare kleiner (Ladezeit, Grafikspeicher)
const SIZE = { head_color: 1024, body_color: 1024, head_normal: 512, body_normal: 512, opacity_color: 512 };

function readTGA(file) {   // unkomprimiertes TGA, 24/32 Bit (so liegen alle Rocketbox-Bilder vor)
  const b = fs.readFileSync(file), idLen = b[0], type = b[2], w = b.readUInt16LE(12), h = b.readUInt16LE(14), bpp = b[16], top = b[17] & 0x20;
  if (type !== 2 || (bpp !== 24 && bpp !== 32)) throw new Error('TGA-Art nicht unterstützt: ' + file);
  const n = bpp / 8, src = 18 + idLen, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = src + ((top ? y : h - 1 - y) * w + x) * n, d = (y * w + x) * 4;
    out[d] = b[s + 2]; out[d + 1] = b[s + 1]; out[d + 2] = b[s]; out[d + 3] = n === 4 ? b[s + 3] : 255;
  }
  return { data: out, w, h };
}
// Umfärben für die Alexander-Probe: Haare blond (Kopfbild oben und Haarkarten), rote Krawatte weiß wie das Hemd (die Fliege setzt das Labor darauf)
const lum = (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;
function blondPx(d, i) {
  const l = Math.min(1, lum(d[i], d[i + 1], d[i + 2]) * 3.2), a = [0.6, 0.45, 0.22], b = [0.98, 0.9, 0.66];
  for (let k = 0; k < 3; k++) d[i + k] = 255 * (a[k] + (b[k] - a[k]) * l);
}
function recolor(t, part, kind, opt) {
  if (!opt || kind !== 'color') return;
  const d = t.data;
  for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
    const i = (y * t.w + x) * 4, r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    if (opt.blond && part === 'opacity') blondPx(d, i);
    else if (opt.blond && part === 'head' && y < t.h * 0.56 && lum(d[i], d[i + 1], d[i + 2]) < 0.36 && r - b < 0.16 && r + g + b > 0.03) blondPx(d, i);
    else if (opt.noTie && part === 'body' && r > 0.25 && r > g * 2.2 && r > b * 2.2 && y > t.h * 0.8) { const v = 200 + 40 * lum(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = v; d[i + 2] = v + 6; }
  }
}
async function webp(file, size, alpha, part, kind, opt) {
  const t = readTGA(file);
  recolor(t, part, kind, opt);
  return sharp(t.data, { raw: { width: t.w, height: t.h, channels: 4 } }).resize(size, size)
    .webp(alpha ? { quality: 82, alphaQuality: 90 } : { quality: 84 }).toBuffer();
}

const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTTextureWebP]);
for (const [dir, name, opt] of FIGS) {
  const base = path.join(RB, 'Assets', 'Avatars', dir), id = path.basename(dir), tmp = path.join(TMP, name);
  execFileSync(FBX2GLTF, ['--binary', '-i', path.join(base, 'Export', id + '.fbx'), '-o', tmp], { stdio: 'pipe' });
  const doc = await io.read(tmp + '.glb'), root = doc.getRoot();
  for (const a of root.listAnimations()) a.dispose();
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const m of root.listMaterials()) {
    const part = m.getName().replace(/^[mf]\d+_/, '');          // body | head | opacity
    const set = async (slot, kind) => {
      const f = path.join(base, 'Textures', m.getName().replace(/_(body|head|opacity)$/, '') + '_' + part + '_' + kind + '.tga');
      const old = slot === 'n' ? m.getNormalTexture() : m.getBaseColorTexture();
      if (!fs.existsSync(f)) { if (old) { slot === 'n' ? m.setNormalTexture(null) : m.setBaseColorTexture(null); } return; }
      const tex = doc.createTexture(part + '-' + kind).setMimeType('image/webp').setImage(await webp(f, SIZE[part + '_' + kind] || 512, part === 'opacity', part, kind, opt));
      slot === 'n' ? m.setNormalTexture(tex) : m.setBaseColorTexture(tex);
    };
    await set('c', 'color');
    if (part !== 'opacity') await set('n', 'normal'); else m.setNormalTexture(null);
    m.setMetallicFactor(0).setRoughnessFactor(part === 'head' ? 0.62 : 0.85).setBaseColorFactor([1, 1, 1, 1]);
    if (part === 'opacity') m.setAlphaMode('MASK').setAlphaCutoff(0.4).setDoubleSided(true);
  }
  await doc.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }));
  // FBX2glTF dreht den Netz-Knoten um -90° (Z oben); für Haut-Netze gilt laut glTF nur das Skelett, three.js würde doppelt drehen
  for (const n of root.listNodes()) if (n.getSkin()) n.setRotation([0, 0, 0, 1]).setTranslation([0, 0, 0]).setScale([1, 1, 1]);
  await io.write(path.join(OUT, name + '.glb'), doc);
  let tris = 0; for (const me of root.listMeshes()) for (const p of me.listPrimitives()) tris += p.getIndices().getCount() / 3;
  console.log(name, (fs.statSync(path.join(OUT, name + '.glb')).size / 1024).toFixed(0) + ' KB', tris + ' Dreiecke', root.listSkins()[0]?.listJoints().length + ' Knochen');
}
for (const [file, name] of ANIMS) {
  const tmp = path.join(TMP, 'anim-' + name);
  execFileSync(FBX2GLTF, ['--binary', '-i', path.join(RB, 'Assets', 'Animations', file + '.max.fbx'), '-o', tmp], { stdio: 'pipe' });
  const doc = await io.read(tmp + '.glb'), root = doc.getRoot();
  for (const n of root.listNodes()) n.setMesh(null).setSkin(null);
  for (const m of root.listMeshes()) m.dispose();
  for (const a of root.listAnimations()) {
    a.setName(name);
    // Größe bleibt fest; „Bip01 Footsteps“ fehlt in den Figuren (three.js würde die Spur sonst auf die Szene selbst legen und die Figur umkippen)
    for (const ch of a.listChannels()) if (ch.getTargetPath() === 'scale' || /Footsteps/.test(ch.getTargetNode().getName())) { ch.getSampler().dispose(); ch.dispose(); }
  }
  await doc.transform(resample({ tolerance: 2e-4 }), prune());
  await io.write(path.join(OUT, 'anim-' + name + '.glb'), doc);
  console.log('anim-' + name, (fs.statSync(path.join(OUT, 'anim-' + name + '.glb')).size / 1024).toFixed(0) + ' KB', root.listAnimations()[0].listChannels().length + ' Kanäle');
}
fs.rmSync(TMP, { recursive: true, force: true });
