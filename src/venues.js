import { T, scene, pick, R, camera, $, canvasTex } from './core.js';
import { stdMat, ENV, MAT, addCollider } from './people-skeleton.js';
import { addNeon, NEON, lamps, addGlow } from './facade-shader.js';
import { lathe, roundBox, placeFurn, FURN } from './entrances.js';
import { kit, Bx, wallRun, nameplate } from './harbour.js';
import { COL, setAct } from './serpentine.js';
import { player, EYE } from './player.js';
import { updateGuestFlow, updateDine } from './eating.js';
import { VIEWS, toast } from './boat.js';
import { isTouch, tryLock, locked } from './input.js';
import { addLight } from './performance.js';
import { ware } from './shops.js';
import { buildWorkersQuarter, workMats } from './workers.js';
import { SHIRTS, WORKWEAR, COATS } from './serpentine.js';

/* =====================================================================
   LOKALE ZUM HINEINGEHEN: Bar „The Brass Lantern“ und „Restaurant Aurora“ an der Seepromenade.
   Man setzt sich, bestellt beim Kellner, er bringt es an den Tisch, dann essen und trinken.
   Die Gäste essen, trinken, reden; Barkeeper mixt, Pianist spielt, Kellner gehen zwischen den Tischen.
   ===================================================================== */
export const VENUES = [], VENUE_PEDS = [];
export const MENU = {
  // V44: The Brass Lantern ist eine Arbeiterkneipe (Kanon): Bier vom Fass, Schnaps, Eintopf, Brote
  bar: { title: 'The Brass Lantern', items: [
    ['Bier vom Fass', 'drink', 'beer'], ['Dunkles', 'drink', 'beerDark'], ['Korn', 'drink', 'schnaps'], ['Whisky', 'drink', 'tumbler'],
    ['Kaffee mit Schuss', 'drink', 'cup'], ['Linseneintopf', 'food', 'soup'], ['Erdnüsse', 'food', 'nuts'], ['Schinkenbrot', 'food', 'sandwich']] },
  restaurant: { title: 'Restaurant Aurora', items: [
    ['Champagner', 'drink', 'coupe'], ['Rotwein', 'drink', 'wine'], ['Kaffee', 'drink', 'cup'], ['Consommé', 'food', 'soup'],
    ['Austern', 'food', 'oysters'], ['Filet mit Gemüse', 'food', 'steak'], ['Hummer', 'food', 'lobster'], ['Schokoladentorte', 'food', 'cake']] },
};
export const DINE = { seat: null, venue: null, order: null, item: null, sips: 0, anim: 0, menuOpen: false, waitT: 0 };

// Geschirr und Gläser: kleine Modelle, je eines pro Bestellung
export let dishMats = null;
export function dishMat() {
  return dishMats ||= {
    china: stdMat({ color: 0xf2eee4, roughness: 0.25, envI: 0.8, emissive: 0x2a2620 }),
    glass: new T.MeshStandardMaterial({ color: 0xcfe6ea, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, envMap: ENV, envMapIntensity: 1.5, depthWrite: false }),
    gold: MAT.gold,
    amber: stdMat({ color: 0xb8701c, roughness: 0.1, emissive: 0x3a1c04, transparent: true, opacity: 0.85 }),
    champ: stdMat({ color: 0xe8d47a, roughness: 0.1, emissive: 0x3a3008, transparent: true, opacity: 0.8 }),
    clear: stdMat({ color: 0xd8e8e0, roughness: 0.05, emissive: 0x202826, transparent: true, opacity: 0.55 }),
    red: stdMat({ color: 0x5a0a14, roughness: 0.15, emissive: 0x140204, transparent: true, opacity: 0.9 }),
    coffee: stdMat({ color: 0x2a160a, roughness: 0.2 }),
    olive: stdMat({ color: 0x5a7a2a, roughness: 0.5 }),
    meat: stdMat({ color: 0x5a2a16, roughness: 0.7, emissive: 0x100402 }),
    green: stdMat({ color: 0x3a6a2a, roughness: 0.7 }),
    shell: stdMat({ color: 0x9a948a, roughness: 0.6, emissive: 0x141210 }),
    lobster: stdMat({ color: 0xc23a1a, roughness: 0.45, emissive: 0x2a0802 }),
    cake: stdMat({ color: 0x3a1c10, roughness: 0.6, emissive: 0x0a0402 }),
    bread: stdMat({ color: 0xd8b070, roughness: 0.8, emissive: 0x1a1006 }),
    soup: stdMat({ color: 0xc08a3a, roughness: 0.15, emissive: 0x2a1806 }),
    beer: stdMat({ color: 0xd08a1c, roughness: 0.1, emissive: 0x4a2604, transparent: true, opacity: 0.88 }),
    dark: stdMat({ color: 0x3a1a08, roughness: 0.1, emissive: 0x120602, transparent: true, opacity: 0.94 }),
    foam: stdMat({ color: 0xf4eedc, roughness: 0.8, emissive: 0x2a2620 }),
  };
}
// Modell eines Gerichts oder Getränks; .fill ist der Teil, der beim Essen und Trinken weniger wird
export function dishModel(type) {
  const M = dishMat(), g = new T.Group(), add = (geo, m) => { const o = new T.Mesh(geo, m); g.add(o); return o; };
  const plate = () => add(lathe([[0, 0], [0.13, 0], [0.15, 0.012], [0.16, 0.02], [0, 0.01]], 24), M.china);
  let fill = null;
  switch (type) {
    case 'martini': add(lathe([[0.035, 0], [0.004, 0.005], [0.004, 0.09], [0.06, 0.15], [0.058, 0.152], [0.002, 0.096]], 18), M.glass); fill = add(new T.ConeGeometry(0.052, 0.05, 18).rotateX(Math.PI).translate(0, 0.122, 0), M.clear); add(new T.SphereGeometry(0.009, 8, 6).translate(0.01, 0.13, 0), M.olive); break;
    case 'tumbler': add(lathe([[0.035, 0], [0.04, 0.09], [0.038, 0.09], [0.032, 0.008], [0, 0.008]], 18), M.glass); fill = add(new T.CylinderGeometry(0.034, 0.031, 0.05, 16).translate(0, 0.034, 0), M.amber); break;
    case 'coupe': add(lathe([[0.03, 0], [0.004, 0.005], [0.004, 0.1], [0.055, 0.125], [0.058, 0.14], [0.054, 0.14], [0.002, 0.108]], 18), M.glass); fill = add(new T.CylinderGeometry(0.05, 0.02, 0.022, 16).translate(0, 0.125, 0), M.champ); break;
    case 'highball': add(lathe([[0.03, 0], [0.032, 0.15], [0.03, 0.15], [0.028, 0.008], [0, 0.008]], 18), M.glass); fill = add(new T.CylinderGeometry(0.027, 0.027, 0.11, 16).translate(0, 0.064, 0), M.clear); break;
    case 'wine': add(lathe([[0.032, 0], [0.004, 0.005], [0.004, 0.08], [0.04, 0.12], [0.036, 0.19], [0.033, 0.19], [0.002, 0.086]], 18), M.glass); fill = add(new T.SphereGeometry(0.034, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.118, 0), M.red); break;
    case 'beer': case 'beerDark': {   // V44: Bierkrug mit Henkel und Schaumkrone
      add(lathe([[0.042, 0], [0.046, 0.15], [0.043, 0.15], [0.039, 0.012], [0, 0.012]], 18), M.glass);
      add(new T.TorusGeometry(0.035, 0.008, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(0.046, 0.08, 0), M.glass);
      fill = add(new T.CylinderGeometry(0.04, 0.037, 0.11, 16).translate(0, 0.067, 0), type === 'beer' ? M.beer : M.dark);
      add(new T.CylinderGeometry(0.043, 0.041, 0.025, 16).translate(0, 0.135, 0), M.foam); break; }
    case 'schnaps': add(lathe([[0.022, 0], [0.026, 0.07], [0.024, 0.07], [0.02, 0.01], [0, 0.01]], 14), M.glass); fill = add(new T.CylinderGeometry(0.021, 0.019, 0.04, 12).translate(0, 0.033, 0), M.clear); break;
    case 'cup': add(lathe([[0, 0], [0.07, 0], [0.075, 0.01], [0, 0.006]], 20), M.china); add(lathe([[0.025, 0.01], [0.042, 0.07], [0.04, 0.07], [0.022, 0.016], [0, 0.016]], 18), M.china); add(new T.TorusGeometry(0.018, 0.005, 6, 12).translate(0.048, 0.045, 0), M.china); fill = add(new T.CylinderGeometry(0.038, 0.038, 0.004, 16).translate(0, 0.062, 0), M.coffee); break;
    case 'soup': plate(); add(lathe([[0, 0.012], [0.06, 0.012], [0.1, 0.05], [0.096, 0.052], [0.055, 0.018], [0, 0.018]], 22), M.china); fill = add(new T.CylinderGeometry(0.085, 0.06, 0.012, 20).translate(0, 0.04, 0), M.soup); break;
    case 'oysters': plate(); fill = new T.Group(); g.add(fill); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28; const o = new T.Mesh(new T.SphereGeometry(0.035, 10, 6).scale(1, 0.35, 0.75), M.shell); o.position.set(Math.cos(a) * 0.085, 0.022, Math.sin(a) * 0.085); o.rotation.y = -a; fill.add(o); } break;
    case 'steak': plate(); fill = new T.Group(); g.add(fill); fill.add(new T.Mesh(roundBox(0.11, 0.03, 0.08, 0.012).translate(-0.02, 0.03, 0), M.meat)); for (let k = 0; k < 5; k++) fill.add(new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.06, 6).rotateZ(Math.PI / 2).translate(0.07, 0.022, -0.03 + k * 0.015), M.green)); break;
    case 'lobster': plate(); fill = new T.Group(); g.add(fill); fill.add(new T.Mesh(new T.CapsuleGeometry(0.025, 0.14, 4, 10).rotateZ(Math.PI / 2).translate(0, 0.035, 0), M.lobster)); for (const s of [-1, 1]) fill.add(new T.Mesh(new T.SphereGeometry(0.022, 8, 6).scale(1.4, 0.7, 1).translate(0.1, 0.03, s * 0.045), M.lobster)); break;
    case 'cake': plate(); fill = add(new T.CylinderGeometry(0.07, 0.07, 0.06, 16, 1, false, 0, 1.0).translate(0, 0.045, 0), M.cake); break;
    case 'nuts': fill = add(lathe([[0, 0], [0.04, 0], [0.07, 0.035], [0.068, 0.037], [0, 0.006]], 18), M.gold); add(new T.SphereGeometry(0.055, 12, 6, 0, Math.PI * 2, 0, 1.1).scale(1, 0.35, 1).translate(0, 0.012, 0), M.bread); break;
    default: plate(); fill = new T.Group(); g.add(fill); for (const s of [-1, 1]) fill.add(new T.Mesh(new T.BoxGeometry(0.08, 0.05, 0.08).rotateY(0.785).translate(s * 0.045, 0.04, 0), M.bread));
  }
  g.userData.fill = fill;
  return g;
}

export function venue(o) {
  const { x, z, w, d, kind } = o, x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, F = 0.3, H = 5.2, bar = kind === 'bar';
  const K = kit(bar ? workMats() : null), V = { ...o, x0, x1, z0, z1, F, seats: [], tables: [], waiters: [], station: null, staff: [], peds: [] };
  VENUES.push(V);
  // Boden: Parkett in der Bar, Teppich im Restaurant; vor der Tür eine Stufe
  // V44: Kneipe mit Dielenboden aus dunklem Holz
  K.add(bar ? 'plank' : 'carpet', Bx(w, F, d, x, F / 2, z, bar ? 2.2 : 3), bar ? [0.5, 0.36, 0.26] : [0.75, 0.45, 0.45]);
  addCollider(x0, 0, z0, x1, F, z1);
  // Wände mit hohen Fenstern; Eingang mittig zur Stadt, zum See hin fast ganz verglast
  const cols = [];
  const outC = bar ? [0.95, 0.88, 0.84] : [0.88, 0.84, 0.74], inK = bar ? 'inWood' : 'paint', inC = bar ? [0.62, 0.42, 0.28] : [0.32, 0.5, 0.5];
  const wo = { outK: bar ? 'brick' : 'stone', outC, inK, inC, th: 0.36, sill: bar ? 1.0 : 0.6, head: H - 0.9, win: bar ? 1.6 : 2.2, post: 0.6 };
  wallRun(K, cols, x0, z1, x1, z1, F, H, { ...wo, doors: [[w / 2 - 1.3, w / 2 + 1.3]] });
  wallRun(K, cols, x1, z1, x1, z0, F, H, wo);
  wallRun(K, cols, x1, z0, x0, z0, F, H, { ...wo, sill: bar ? 1.0 : 0.45, win: bar ? 1.6 : 3.0, post: 0.45, windows: bar && o.pub ? false : undefined });   // V44: Kneipe: Rückwand ohne Fenster (Dartscheibe, Tafel, Bilder)
  wallRun(K, cols, x0, z0, x0, z1, F, H, { ...wo, windows: bar && o.pub ? false : undefined });   // V44: hinter der Theke keine Fenster
  for (const b of cols) addCollider(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
  if (bar) pubShell(K, o, V, H, outC);
  else {
  // Decke mit Stuckband, Dach mit Goldgesims, gestufter Aufsatz über dem Eingang mit Leuchtschrift
  K.add('ceil', Bx(w - 0.3, 0.2, d - 0.3, x, F + H - 0.1, z), [1, 1, 1]);
  for (const k of [0, 1, 2]) K.add('gold', Bx(w - 0.4 - k * 1.6, 0.06, d - 0.4 - k * 1.6, x, F + H - 0.24 - k * 0.04, z, 1));
  K.add('stone', Bx(w + 0.7, 0.6, d + 0.7, x, F + H + 0.3, z, 3), outC.map(v => v * 1.08));
  K.add('gold', Bx(w + 0.8, 0.12, d + 0.8, x, F + H + 0.02, z, 1));
  for (const [ww, hh] of [[10, 1.4], [6, 2.6], [2.6, 3.6]]) K.add('stone', Bx(ww, hh, 0.7, x, F + H + 0.6 + hh / 2, z1 - 0.2, 2), outC);
  K.add('gold', Bx(10.1, 0.1, 0.75, x, F + H + 2.0, z1 - 0.2, 1)); K.add('gold', Bx(6.1, 0.1, 0.75, x, F + H + 3.2, z1 - 0.2, 1));
  const sign = nameplate(o.name, 9.2, 1.3, bar ? '#f2b45a' : '#f6dc9a');
  sign.position.set(x, F + H + 1.25, z1 + 0.16); scene.add(sign);
  addNeon(x, F + H + 1.25, z1 + 0.12, 9.6, 0.04, 0.04, NEON.gold); addNeon(x, F + H + 0.56, z1 + 0.12, 9.6, 0.04, 0.04, bar ? NEON.amber : NEON.teal);
  // Vordach über der Tür, Pilaster, Laternen
  K.add('gold', Bx(4.2, 0.14, 2.2, x, F + 2.95, z1 + 1.1, 1)); K.add('iron', Bx(4.0, 0.06, 2.0, x, F + 2.86, z1 + 1.1, 1));
  for (const s of [-1, 1]) { K.add('stone', Bx(0.6, H, 0.5, x + s * 1.75, F + H / 2, z1 + 0.1, 1), outC.map(v => v * 0.9)); lamps.push({ x: x + s * 3.4, z: z1 + 1.6, h: 3.6 }); }
  }
  // Innen: Wandleuchten, Kronleuchter, warmes Licht
  for (let u = x0 + 3; u < x1 - 2; u += 5) for (const zz of [z0 + 0.28, z1 - 0.28]) { K.add('lit', new T.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(zz < z ? Math.PI / 2 : -Math.PI / 2).translate(u, F + 2.6, zz), [1.6, 1.05, 0.6]); addGlow(u, F + 2.6, zz + (zz < z ? 0.2 : -0.2), [1.3, 0.8, 0.4], 0.8); }
  for (const u of [x - w / 4, x + w / 4]) {
    if (bar) { addLight(0xffa860, 2.0, 14, 1.6, u, F + H - 1.6, z); continue; }   // V44: in der Kneipe Messing-Hängelampen über jedem Tisch (pubShell)
    K.add('gold', new T.CylinderGeometry(0.02, 0.02, 1.0, 6).translate(u, F + H - 0.7, z));
    for (let k = 0; k < 3; k++) K.add('gold', new T.TorusGeometry(0.55 - k * 0.15, 0.02, 6, 28).rotateX(Math.PI / 2).translate(u, F + H - 1.3 + k * 0.18, z));
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; K.add('lit', new T.CylinderGeometry(0.025, 0.025, 0.14, 6).translate(u + Math.cos(a) * 0.55, F + H - 1.2, z + Math.sin(a) * 0.55), [1.8, 1.25, 0.7]); }
    addGlow(u, F + H - 1.25, z, [1.4, 0.95, 0.5], 1.3); addLight(0xffb070, 2.2, 16, 1.6, u, F + H - 1.6, z);
  }
  const FMk = bar ? { up: 'leather', frame: 'iron', wood: 'varnish', lamp: 'lit', cloth: 'cloth' } : { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth' };
  const upC = bar ? [0.2, 0.26, 0.17] : [0.1, 0.3, 0.32];
  const fadd = (k, g) => K.add(k, g, k === 'leather' ? upC : k === 'lit' ? [1.6, 1.05, 0.55] : k === 'cloth' ? [0.94, 0.92, 0.86] : [1, 1, 1]);
  // Theke an der Westwand: Mahagoni, Messinglauf, Spiegel, Flaschenregal, Hocker
  const cx = x0 + 2.4, cz0 = z0 + 2.2, cz1 = z1 - 3.4;
  K.add('varnish', Bx(0.8, 1.05, cz1 - cz0, cx, F + 0.53, (cz0 + cz1) / 2, 1), bar ? [0.42, 0.22, 0.13] : [0.6, 0.3, 0.18]);
  K.add(bar ? 'gold' : 'stone', Bx(1.0, 0.07, cz1 - cz0 + 0.1, cx, F + 1.09, (cz0 + cz1) / 2, 1), bar ? [0.9, 0.78, 0.6] : [0.9, 0.88, 0.84]);   // V44: Messingplatte auf der Kneipentheke
  K.add('gold', new T.CylinderGeometry(0.025, 0.025, cz1 - cz0, 8).rotateX(Math.PI / 2).translate(cx + 0.48, F + 0.22, (cz0 + cz1) / 2));
  addNeon(cx + 0.41, F + 1.0, (cz0 + cz1) / 2, 0.02, 0.02, cz1 - cz0, bar ? NEON.amber : NEON.gold);
  addCollider(cx - 0.45, F, cz0, cx + 0.45, F + 1.1, cz1);
  K.add('glass', new T.PlaneGeometry(cz1 - cz0, 1.6).rotateY(Math.PI / 2).translate(x0 + 0.2, F + 2.2, (cz0 + cz1) / 2));
  for (const sy of [1.55, 2.05, 2.55]) {
    K.add('varnish', Bx(0.35, 0.04, cz1 - cz0, x0 + 0.38, F + sy - 0.05, (cz0 + cz1) / 2, 1), [0.5, 0.26, 0.14]);
    for (let u = cz0 + 0.15; u < cz1 - 0.1; u += 0.13) {
      // V23: echte Flaschen (Kenney, CC0) zwischen den gezeichneten
      if (R() < 0.55) { ware(pick(bar ? ['wine-red', 'wine-white', 'bottle', 'bottle-large', 'soda-bottle'] : ['wine-red', 'wine-white', 'wine-red']), x0 + 0.38, F + sy - 0.03, u, R); continue; }
      const c = pick([[0.5, 1.0, 0.4], [1.4, 0.8, 0.3], [0.4, 0.8, 1.2], [1.2, 0.3, 0.3], [1.3, 1.2, 0.8], [0.9, 0.5, 0.2]]), hh = 0.2 + R() * 0.12;
      K.add('lit', lathe([[0.03, 0], [0.032, hh * 0.65], [0.012, hh * 0.85], [0.011, hh]], 8).translate(x0 + 0.38, F + sy - 0.03, u), c.map(v => v * 0.6));
    }
  }
  addLight(0xffa860, 1.6, 9, 1.8, x0 + 1.2, F + 2.6, (cz0 + cz1) / 2);
  // auf der Theke: Gläser, Flaschen, im Restaurant Brotkorb und Obstschale
  for (let u = cz0 + 0.5; u < cz1 - 0.4; u += 0.7 + R() * 0.6) ware(pick(bar ? ['bottle', 'bottle-large', 'soda-bottle', 'bottle'] : ['glass-wine', 'wine-white', 'cake', 'pie']), cx - 0.12 + R() * 0.2, F + 1.125, u, R);
  if (!bar) for (let i = 0; i < 5; i++) ware(pick(['apple', 'orange', 'pear']), cx + (R() - 0.5) * 0.18, F + 1.125, cz1 - 0.6 + (R() - 0.5) * 0.18, R);
  for (let u = cz0 + 0.6; u < cz1 - 0.3; u += 1.1) { placeFurn(FURN.barStool(), FMk, fadd, cx + 1.05, F, u); if (bar && R() < 0.5) V.seats.push({ x: cx + 1.05, z: u, y: F + 0.89, yaw: -Math.PI / 2, tx: cx + 0.3, tz: u, ty: F + 1.12, stool: true }); }
  V.station = { x: cx + 1.4, z: cz1 + 0.9 };
  // Barkeeper hinter der Theke
  V.staff.push({ st: 4, x: cx - 0.95, y: F, z: (cz0 + cz1) / 2, yaw: Math.PI / 2, sc: 1, v: 0, kind: 'waiter', col: bar ? [0.82, 0.8, 0.74] : [0.92, 0.9, 0.85], act: 13.3, bartender: true, z0: cz0 + 0.6, z1: cz1 - 0.6 });
  if (bar && o.pub) pubBar(K, V, cx, cz0, cz1);
  // Tische: in Reihen mit Gängen dazwischen; im Restaurant weiß gedeckt
  const tx0 = cx + 2.8, tx1 = x1 - 1.8, rows = bar ? [z0 + 2.4, z0 + 5.6, z1 - 3.4] : [z0 + 2.2, z0 + 5.4, z0 + 8.6, z1 - 2.6];
  const stepX = bar ? 3.4 : 3.7;
  for (const rz of rows) for (let tx = tx0 + 0.8; tx < tx1; tx += stepX) {
    if (bar && rz === rows[2] && tx > x1 - 7) continue;
    const tr = bar ? 0.42 : 0.55;
    placeFurn(FURN.roundTable(tr, 0.74, !bar), FMk, fadd, tx, F, rz);
    addCollider(tx - 0.3, F, rz - 0.3, tx + 0.3, F + 0.76, rz + 0.3);
    // Kerze mit Lichtpunkt
    K.add('cloth', new T.CylinderGeometry(0.018, 0.018, 0.1, 8).translate(tx, F + 0.82, rz), [0.95, 0.92, 0.85]);
    K.add('lit', new T.SphereGeometry(0.012, 6, 4).scale(1, 1.8, 1).translate(tx, F + 0.89, rz), [1.8, 1.2, 0.5]); addGlow(tx, F + 0.9, rz, [1.3, 0.75, 0.35], 0.35, Math.random(), 0);
    if (!bar) { K.add('gold', lathe([[0.03, 0], [0.012, 0.03], [0.008, 0.16], [0.02, 0.2]], 8).translate(tx + 0.18, F + 0.76, rz + 0.1)); ware(pick(['wine-red', 'wine-white']), tx - 0.16, F + 0.76, rz - 0.12, R); if (R() < 0.6) ware(pick(['bread', 'loaf']), tx + 0.05, F + 0.76, rz - 0.22, R, 0); }
    else if (R() < 0.45) ware('bottle', tx - 0.14, F + 0.76, rz + 0.1, R);
    const n = bar ? 3 : 4, seatsHere = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + (bar ? 0.5 : Math.PI / 4), sx = tx + Math.sin(a) * (tr + 0.32), sz = rz + Math.cos(a) * (tr + 0.32);
      const yaw = a + Math.PI;
      placeFurn(FURN.bistroChair(), FMk, fadd, sx, F, sz, yaw);
      const s = { x: sx, z: sz, y: F + 0.5, yaw, tx: tx + Math.sin(a) * (tr - 0.16), tz: rz + Math.cos(a) * (tr - 0.16), ty: F + 0.76 };
      V.seats.push(s); seatsHere.push(s);
    }
    V.tables.push({ x: tx, z: rz, seats: seatsHere });
  }
  // Bühne mit Flügel (Bar) oder Palmen und Kamin (Restaurant) an der Ostwand
  if (bar && o.pub) pubStage(K, V, FMk, fadd);
  else if (bar) {
    const px = x1 - 3.2, pz = z1 - 2.6;
    K.add('varnish', Bx(4.6, 0.3, 3.6, px, F + 0.15, pz, 1), [0.35, 0.16, 0.1]);
    K.add('varnish', roundBox(1.5, 0.32, 1.9, 0.12).translate(px, F + 1.12, pz), [0.04, 0.035, 0.04]);
    K.add('varnish', Bx(1.5, 0.05, 1.85, px, F + 1.6, pz - 0.15, 1).rotateX(-0.45), [0.04, 0.035, 0.04]);
    K.add('cloth', Bx(1.3, 0.04, 0.2, px, F + 0.97, pz + 0.95, 1), [0.95, 0.94, 0.9]);
    for (const [lx, lz] of [[-0.6, -0.8], [0.6, -0.8], [0, 0.7]]) K.add('gold', new T.CylinderGeometry(0.04, 0.03, 0.66, 8).translate(px + lx, F + 0.63, pz + lz));
    placeFurn(FURN.barStool(), FMk, fadd, px, F + 0.3 - 0.35, pz + 1.45);
    addCollider(px - 2.3, F, pz - 1.8, px + 2.3, F + 0.3, pz + 1.8); addCollider(px - 0.8, F + 0.3, pz - 1.0, px + 0.8, F + 1.3, pz + 0.95);
    V.staff.push({ st: 4, x: px, y: F + 0.84, z: pz + 1.45, yaw: Math.PI, sc: 1, v: 0, kind: 'tux', col: COL.tux, sit: true, act: 14.5 });
    addLight(0xff9a50, 1.4, 8, 1.8, px, F + 3.2, pz);
  } else {
    for (const zz of [z0 + 0.9, z1 - 0.9]) placeFurn(FURN.vasePlant(1.8), { up: 'cloth', frame: 'gold', leaf: 'cloth' }, (k, g) => K.add(k, g, k === 'cloth' ? [0.15, 0.4, 0.2] : [1, 1, 1]), x1 - 0.9, F, zz);
    K.add('stone', Bx(0.5, 1.6, 2.4, x1 - 0.45, F + 0.8, z, 1), [0.9, 0.88, 0.84]); K.add('lit', new T.PlaneGeometry(1.4, 0.7).rotateY(-Math.PI / 2).translate(x1 - 0.71, F + 0.55, z), [1.8, 0.7, 0.2]); addGlow(x1 - 0.9, F + 0.6, z, [1.4, 0.6, 0.2], 1.6);
  }
  // Außen am See: Terrasse mit Brüstung (nur Restaurant), dazu Tische
  if (!bar) {
    K.add('stone', Bx(w, 0.25, 5, x, 0.125, z0 - 2.5, 3), [0.82, 0.8, 0.76]); addCollider(x0, 0, z0 - 5, x1, 0.25, z0);
    for (let tx = x0 + 2.5; tx < x1 - 1; tx += 4.2) { placeFurn(FURN.roundTable(0.42, 0.74, true), FMk, fadd, tx, 0.25, z0 - 2.4); for (const s of [-1, 1]) placeFurn(FURN.bistroChair(), FMk, fadd, tx + s * 0.75, 0.25, z0 - 2.4, s > 0 ? -Math.PI / 2 : Math.PI / 2); addCollider(tx - 0.3, 0, z0 - 2.7, tx + 0.3, 1.0, z0 - 2.1); addGlow(tx, 0.98, z0 - 2.4, [1.3, 0.75, 0.35], 0.4, Math.random(), 0);
      for (const s of [-1, 1]) if (R() < 0.6) VENUE_PEDS.push({ st: 4, x: tx + s * 0.75, y: 0.75, z: z0 - 2.4, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2, sc: 0.94 + R() * 0.12, v: 0, sit: true, act: pick([10.4, 11.4, 7.8]) }); }
  }
  K.build(scene);
  // Gäste: etwa zwei Drittel der Plätze besetzt, mit Teller oder Glas vor sich
  const dishes = [];
  for (const s of V.seats) {
    if (R() > (s.stool ? 0.55 : 0.68)) continue;
    const r0 = R(), kind = bar ? pick(['worker', 'worker', 'coat', 'suit', 'chauffeur', 'worker', 'sailor', 'coat', 'lady', 'dress']) : pick(['tux', 'gown', 'suit', 'lady', 'gown', 'dress']);
    const eat = !s.stool && !bar ? r0 < 0.6 : r0 < 0.25;
    const pd = { st: 4, x: s.x, y: s.y, z: s.z, yaw: s.yaw, sc: 0.94 + R() * 0.12, v: 0, sit: true, kind, act: eat ? 10 + 0.3 + R() * 0.4 : (R() < 0.5 ? 11.4 : 7.8), seat: s, dineT: R() * 20 };
    if (bar && kind === 'worker') pd.col = pick(R() < 0.5 ? SHIRTS : WORKWEAR);
    s.taken = pd; V.peds.push(pd); VENUE_PEDS.push(pd); 
    const dm = dishModel(eat ? pick(bar ? ['soup', 'nuts', 'sandwich'] : ['steak', 'soup', 'lobster', 'cake', 'oysters']) : pick(bar ? ['beer', 'beer', 'beerDark', 'tumbler', 'schnaps'] : ['coupe', 'wine']));
    dm.position.set(s.tx, s.ty, s.tz); dm.rotation.y = s.yaw; dishes.push(dm); pd.dish = dm;
    if (eat && !bar) { const gl = dishModel(pick(['wine', 'coupe'])); gl.position.set(s.tx + Math.cos(s.yaw) * 0.18, s.ty, s.tz - Math.sin(s.yaw) * 0.18); dishes.push(gl); }
  }
  // Geschirr nur in der Nähe zeigen (viele kleine Teile)
  V.dishes = new T.Group(); for (const dm of dishes) V.dishes.add(dm); scene.add(V.dishes); V.dishes.visible = false;
  for (const p of V.staff) VENUE_PEDS.push(p);
  // Kellner: weiße Jacke, gehen zwischen Station und Tischen
  for (let k = 0; k < (bar ? 1 : 2); k++) {
    const wt = { st: 4, x: V.station.x, y: F, z: V.station.z, yaw: 0, sc: 1, v: 0, kind: 'waiter', col: bar ? [0.86, 0.82, 0.74] : [0.94, 0.92, 0.87], act: 12.5, waiter: true, path: [], wait: 2 + k * 4, carry: null, target: null };
    V.waiters.push(wt); VENUE_PEDS.push(wt);
  }
  return V;
}
export function buildVenues() {
  // V44: The Brass Lantern steht jetzt im Arbeiterviertel am Kneipenplatz (src/workers.js); fehlt der Platz, bleibt sie am Nordufer
  const pub = buildWorkersQuarter();
  venue({ name: 'THE BRASS LANTERN', kind: 'bar', ...(pub || { x: -170, z: -1014, w: 24, d: 15 }), pub: !!pub });
  venue({ name: 'RESTAURANT AURORA', kind: 'restaurant', x: 170, z: -1012, w: 28, d: 16 });
  VIEWS.Digit9 = pub ? { name: 'The Brass Lantern · Arbeiterviertel', p: [pub.x, 0.26, pub.z + pub.d / 2 + 11], yaw: 0, pitch: 0.05, fly: false } : { name: 'The Brass Lantern', p: [-170, 0.26, -1000], yaw: 0, pitch: 0.05, fly: false };
  VIEWS.Digit0 = { name: 'Restaurant Aurora', p: [170, 0.26, -997], yaw: 0, pitch: 0.05, fly: false };
}
// V44: Schriftschild im richtigen Seitenverhältnis (nameplate ist 512 x 96 und schneidet lange Namen ab)
export function signBoard(text, w, h, color, bg) {
  const cw = 1024, ch = Math.max(48, Math.round(cw * h / w));
  const t = canvasTex(cw, ch, (g, W, Hh) => { g.fillStyle = bg; g.fillRect(0, 0, W, Hh); g.strokeStyle = color; g.lineWidth = Math.max(2, Hh * 0.04); g.strokeRect(Hh * 0.08, Hh * 0.08, W - Hh * 0.16, Hh * 0.84);
    let fs = Hh * 0.62; g.font = fs + 'px Limelight, Georgia, serif'; const m = g.measureText(text).width; if (m > W * 0.9) { fs *= W * 0.9 / m; g.font = fs + 'px Limelight, Georgia, serif'; }
    g.fillStyle = color; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 4; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, Hh / 2 + fs * 0.06); });
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: t, color: new T.Color(1.15, 1.15, 1.15) }));
}
/* ---------- V44 · The Brass Lantern als Arbeiterkneipe: Backstein, grüne Holzfront, Messinglaternen, Dielen, Balkendecke ---------- */
export function pubShell(K, o, V, H, outC) {
  const { x, z, w, d } = o, { x0, x1, z0, z1, F } = V, green = [0.11, 0.22, 0.15];
  K.add('ceil', Bx(w - 0.3, 0.2, d - 0.3, x, F + H - 0.1, z), [0.6, 0.47, 0.36]);
  for (let u = x0 + 1.6; u < x1 - 1; u += 2.6) K.add('varnish', Bx(0.24, 0.3, d - 0.4, u, F + H - 0.35, z, 1), [0.3, 0.16, 0.09]);
  K.add('stone', Bx(w + 0.5, 0.6, d + 0.5, x, F + H + 0.3, z, 3), [0.5, 0.33, 0.27]);
  // Front: grüne Holzverkleidung unter den Fenstern, Pfosten an der Tür, Schildband mit Messingkanten
  const door = [x - 1.3, x + 1.3];
  for (const [a, b] of [[x0, door[0]], [door[1], x1]]) K.add('varnish', Bx(b - a - 0.1, 1.0, 0.1, (a + b) / 2, F + 0.5, z1 + 0.24, 1), green);
  for (const s of [-1, 1]) K.add('varnish', Bx(0.32, H - 0.85, 0.2, x + s * 1.48, F + (H - 0.85) / 2, z1 + 0.22, 1), green);
  K.add('varnish', Bx(w + 0.2, 0.8, 0.14, x, F + H - 0.43, z1 + 0.25, 1), green);
  for (const yy of [F + H - 0.04, F + H - 0.83]) K.add('gold', Bx(w + 0.24, 0.05, 0.18, x, yy, z1 + 0.27, 1));
  const sign = signBoard(o.name, 8.8, 0.66, '#f0c062', '#132219'); sign.position.set(x, F + H - 0.43, z1 + 0.33); scene.add(sign);
  // Oberlicht über der Tür, offene Tür (nach innen), Stufe
  K.add('lit', new T.PlaneGeometry(2.3, 0.42).translate(x, F + 2.42, z1 + 0.19), [0.95, 0.62, 0.3]);
  for (let k = -2; k <= 2; k++) K.add('varnish', Bx(0.05, 0.44, 0.04, x + k * 0.46, F + 2.42, z1 + 0.21, 1), green);
  K.add('varnish', Bx(0.06, 2.1, 1.2, door[0] + 0.05, F + 1.05, z1 - 0.62, 1), green);
  K.add('glass', new T.PlaneGeometry(0.8, 0.9).rotateY(Math.PI / 2).translate(door[0] + 0.09, F + 1.5, z1 - 0.62));
  K.add('stone', Bx(3.0, F, 1.0, x, F / 2 - 0.05, z1 + 0.6, 1), [0.5, 0.48, 0.45]);
  // Messinglaternen neben der Tür und die große Laterne am Ausleger: der Name der Kneipe
  const lantern = (lx, ly, lz, s) => {
    K.add('gold', new T.CylinderGeometry(0.16 * s, 0.2 * s, 0.08 * s, 6).translate(lx, ly + 0.36 * s, lz));
    K.add('gold', new T.ConeGeometry(0.2 * s, 0.22 * s, 6).translate(lx, ly + 0.5 * s, lz));
    K.add('gold', new T.SphereGeometry(0.05 * s, 6, 4).translate(lx, ly + 0.64 * s, lz));
    K.add('lit', new T.CylinderGeometry(0.17 * s, 0.13 * s, 0.6 * s, 6).translate(lx, ly, lz), [1.9, 1.3, 0.6]);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28 + 0.52; K.add('gold', new T.BoxGeometry(0.025 * s, 0.62 * s, 0.025 * s).translate(lx + Math.cos(a) * 0.16 * s, ly, lz + Math.sin(a) * 0.16 * s)); }
    K.add('gold', new T.CylinderGeometry(0.14 * s, 0.1 * s, 0.07 * s, 6).translate(lx, ly - 0.33 * s, lz));
    addGlow(lx, ly, lz, [1.6, 1.0, 0.45], 1.3 * s);
  };
  for (const s of [-1, 1]) { const lx = x + s * 2.1; K.add('gold', Bx(0.05, 0.05, 0.5, lx, F + 3.45, z1 + 0.45, 1)); K.add('gold', Bx(0.05, 0.4, 0.05, lx, F + 3.3, z1 + 0.22, 1)); lantern(lx, F + 3.05, z1 + 0.68, 0.75); }
  { const ax = x1 - 1.4, ay = F + H + 0.15;
    K.add('iron', Bx(0.08, 0.08, 1.7, ax, ay, z1 + 0.95, 1)); K.add('iron', new T.BoxGeometry(0.05, 0.05, 1.3).rotateX(0.62).translate(ax, ay - 0.42, z1 + 0.62));
    for (let k = 0; k < 3; k++) K.add('iron', new T.TorusGeometry(0.14, 0.015, 4, 10).translate(ax, ay - 0.2, z1 + 0.5 + k * 0.3));
    K.add('iron', Bx(0.02, 0.35, 0.02, ax, ay - 0.2, z1 + 1.6, 1)); lantern(ax, ay - 1.0, z1 + 1.6, 1.35);
    addLight(0xffb45a, 1.3, 9, 1.8, ax, ay - 1.0, z1 + 2.2); }
  // innen: Paneele mit Zierleiste, Bilder, Dartscheibe, Tafel, Ofen
  for (const [ax, az, bx, bz] of [[x0 + 0.2, z0 + 0.2, x1 - 0.2, z0 + 0.2], [x1 - 0.2, z0 + 0.2, x1 - 0.2, z1 - 0.2], [x0 + 0.2, z1 - 0.2, x1 - 0.2, z1 - 0.2]]) {
    const L = Math.hypot(bx - ax, bz - az), along = Math.abs(bx - ax) > 0.1;
    K.add('varnish', Bx(along ? L : 0.06, 0.07, along ? 0.06 : L, (ax + bx) / 2, F + 1.0, (az + bz) / 2, 1), [0.3, 0.16, 0.09]);
  }
  const pics = canvasTex(512, 128, (g, W, Hh) => {
    const tone = ['#c8b58e', '#bba67c', '#d0c19c', '#b49f78'];
    for (let i = 0; i < 4; i++) { const ox = i * 128; g.fillStyle = tone[i]; g.fillRect(ox + 8, 8, 112, 112); g.fillStyle = 'rgba(40,28,16,0.75)'; g.strokeStyle = 'rgba(40,28,16,0.8)'; g.lineWidth = 3;
      if (i === 0) { g.beginPath(); g.moveTo(ox + 20, 90); g.lineTo(ox + 108, 90); g.lineTo(ox + 96, 104); g.lineTo(ox + 30, 104); g.fill(); g.fillRect(ox + 50, 40, 6, 50); g.fillRect(ox + 72, 50, 6, 40); g.fillRect(ox + 40, 70, 50, 12); }   // Dampfer
      else if (i === 1) { for (let k = 0; k < 4; k++) g.fillRect(ox + 20 + k * 22, 50 - k * 6, 14, 60 + k * 6); g.fillRect(ox + 16, 104, 96, 8); }   // Fabrik mit Schloten
      else if (i === 2) { g.beginPath(); g.arc(ox + 64, 52, 20, 0, 7); g.fill(); g.fillRect(ox + 38, 74, 52, 40); }   // Bildnis
      else { g.beginPath(); g.moveTo(ox + 14, 108); g.lineTo(ox + 48, 40); g.lineTo(ox + 70, 76); g.lineTo(ox + 86, 56); g.lineTo(ox + 114, 108); g.fill(); }   // Berge am Kraterrand
    }
  });
  const picMat = new T.MeshBasicMaterial({ map: pics, color: 0x8a7a66 });
  const wallPic = (i, px, py, pz) => { const gg = new T.PlaneGeometry(0.62, 0.62), uv = gg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 4); const m = new T.Mesh(gg, picMat); m.position.set(px, py, pz); scene.add(m); K.add('varnish', Bx(0.76, 0.76, 0.04, px, py, pz - 0.03, 1), [0.18, 0.1, 0.06]); };
  [x0 + 6.2, x0 + 8.4, x0 + 15.2, x0 + 17.4].forEach((px, i) => wallPic(i, px, F + 2.5, z0 + 0.26));
  // Dartscheibe und Tafel
  const dart = canvasTex(128, 128, (g, W, Hh) => { g.fillStyle = '#1a1410'; g.fillRect(0, 0, W, Hh); for (let r = 60, k = 0; r > 4; r -= 8, k++) { g.fillStyle = k % 2 ? '#2a5a2a' : '#c8b88a'; g.beginPath(); g.arc(64, 64, r, 0, 7); g.fill(); } g.fillStyle = '#a01a14'; g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill(); });
  { const m = new T.Mesh(new T.CircleGeometry(0.24, 24), new T.MeshBasicMaterial({ map: dart, color: 0x9a9080 })); m.position.set(x0 + 11.1, F + 1.73, z0 + 0.26); scene.add(m); K.add('varnish', Bx(0.7, 0.7, 0.04, x0 + 11.1, F + 1.73, z0 + 0.23, 1), [0.2, 0.12, 0.07]); }
  const chalk = canvasTex(256, 192, (g, W, Hh) => { g.fillStyle = '#1c2220'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#e8e4d8'; g.font = 'bold 26px Georgia, serif'; g.textAlign = 'center'; g.fillText('HEUTE', W / 2, 36); g.font = '20px Georgia, serif'; g.textAlign = 'left';
    [['Bier vom Fass', '15 Pf.'], ['Dunkles', '18 Pf.'], ['Korn', '10 Pf.'], ['Linseneintopf', '40 Pf.'], ['Schinkenbrot', '25 Pf.']].forEach(([a, b], i) => { g.fillText(a, 16, 72 + i * 24); g.fillText(b, 186, 72 + i * 24); }); });
  { const m = new T.Mesh(new T.PlaneGeometry(1.3, 0.98), new T.MeshBasicMaterial({ map: chalk, color: 0x9a968c })); m.position.set(x0 + 3.2, F + 2.3, z0 + 0.26); scene.add(m); K.add('varnish', Bx(1.42, 1.1, 0.04, x0 + 3.2, F + 2.3, z0 + 0.23, 1), [0.3, 0.16, 0.08]); }
  // Kanonenofen in der Ecke mit Rohr durch die Decke, Glut im Fenster, Kohleneimer
  { const sx = x1 - 0.8, sz = z0 + 0.8;
    K.add('iron', lathe([[0.3, 0], [0.32, 0.1], [0.3, 0.3], [0.26, 0.9], [0.3, 1.0], [0.18, 1.1], [0.09, 1.15], [0, 1.15]], 14).translate(sx, F, sz), [0.5, 0.5, 0.52]);
    K.add('iron', new T.CylinderGeometry(0.08, 0.08, H - 1.15, 8).translate(sx, F + 1.15 + (H - 1.15) / 2, sz), [0.5, 0.5, 0.52]);
    K.add('lit', new T.CircleGeometry(0.09, 10).rotateY(-Math.PI / 4 - Math.PI / 2).translate(sx - 0.22, F + 0.45, sz + 0.22), [1.9, 0.7, 0.18]);
    addGlow(sx - 0.35, F + 0.45, sz + 0.35, [1.5, 0.55, 0.15], 0.8, 0.5, 0);
    K.add('iron', new T.CylinderGeometry(0.16, 0.13, 0.35, 10).translate(sx - 0.65, F + 0.18, sz - 0.2), [0.3, 0.3, 0.3]);
    addCollider(sx - 0.35, F, sz - 0.35, sx + 0.35, F + 2, sz + 0.35); }
}
// Zapfhähne, Fässer, Gäste an der Theke, Dartspieler
export function pubBar(K, V, cx, cz0, cz1) {
  const { x0, z0, F } = V, zm = (cz0 + cz1) / 2;
  for (const dz of [-1.8, -0.6, 0.6, 1.8]) {
    K.add('gold', lathe([[0.05, 0], [0.04, 0.05], [0.035, 0.3], [0.045, 0.34], [0, 0.36]], 10).translate(cx - 0.12, F + 1.125, zm + dz));
    K.add('gold', new T.CylinderGeometry(0.015, 0.012, 0.16, 6).rotateZ(Math.PI / 2).translate(cx + 0.0, F + 1.4, zm + dz));
    K.add('varnish', new T.CylinderGeometry(0.022, 0.016, 0.2, 8).translate(cx - 0.12, F + 1.56, zm + dz), [0.08, 0.05, 0.04]);
  }
  K.add('gold', Bx(0.18, 0.02, 4.4, cx + 0.05, F + 1.135, zm, 1));   // Tropfrinne
  // Fässer hinter der Theke (stehend) und eins liegend auf dem Bock
  for (const [bx, bz] of [[x0 + 0.55, z0 + 0.6], [x0 + 1.25, z0 + 0.6]]) { K.add('plank', lathe([[0.27, 0], [0.32, 0.25], [0.34, 0.45], [0.32, 0.65], [0.27, 0.9], [0, 0.9]], 14).translate(bx, F, bz), [0.55, 0.38, 0.24]); for (const h of [0.12, 0.78]) K.add('iron', new T.CylinderGeometry(0.31, 0.31, 0.05, 14, 1, true).translate(bx, F + h, bz)); }
  K.add('plank', lathe([[0.22, 0], [0.26, 0.2], [0.27, 0.35], [0.26, 0.5], [0.22, 0.7], [0, 0.7]], 14).rotateZ(Math.PI / 2).translate(x0 + 1.25, F + 1.2, z0 + 0.6), [0.55, 0.38, 0.24]);
  addCollider(x0 + 0.2, F, z0 + 0.2, x0 + 1.6, F + 1.5, z0 + 1.0);
  // Gäste stehen an der Theke mit Bier (zwischen den Hockern), zwei am Dartbrett
  for (const [k, dz] of [[0, -2.45], [1, -0.25], [2, 1.95]]) VENUE_PEDS.push({ st: 4, x: cx + 1.3, y: F, z: zm + dz, yaw: -Math.PI / 2, sc: 0.96 + k * 0.04, v: 0, kind: k === 1 ? 'coat' : 'worker', col: k === 1 ? COATS[2] : pick(SHIRTS), act: 15.3 + k * 0.2 });
  VENUE_PEDS.push({ st: 4, x: x0 + 11.1, y: F, z: z0 + 2.95, yaw: Math.PI, sc: 1, v: 0, kind: 'worker', col: WORKWEAR[0], act: 3.3 });
  VENUE_PEDS.push({ st: 4, x: x0 + 10.6, y: F, z: z0 + 4.0, yaw: Math.PI + 0.7, sc: 0.98, v: 0, kind: 'worker', col: SHIRTS[3], act: 15.6 });
}
// Klavier an der Ostwand (aufrecht, mit Kerzenleuchtern), Pianist, Messing-Hängelampen über den Tischen
export function pubStage(K, V, FMk, fadd) {
  const { x1, z1, F } = V, px = x1 - 0.45, pz = z1 - 3.0, H = 5.2;
  K.add('varnish', Bx(0.6, 1.32, 1.55, px, F + 0.66, pz, 1), [0.14, 0.08, 0.05]);
  K.add('varnish', Bx(0.36, 0.08, 1.45, px - 0.45, F + 0.74, pz, 1), [0.14, 0.08, 0.05]);
  K.add('cloth', Bx(0.16, 0.02, 1.3, px - 0.52, F + 0.79, pz, 1), [0.95, 0.93, 0.86]);
  for (let k = 0; k < 18; k++) K.add('varnish', Bx(0.09, 0.025, 0.035, px - 0.49, F + 0.805, pz - 0.6 + k * 0.071, 1), [0.03, 0.03, 0.03]);
  K.add('cloth', Bx(0.02, 0.3, 0.5, px - 0.31, F + 1.05, pz, 1), [0.9, 0.86, 0.74]);   // Notenblatt
  for (const s of [-1, 1]) { K.add('gold', lathe([[0.04, 0], [0.015, 0.04], [0.01, 0.16], [0.03, 0.18]], 8).translate(px - 0.1, F + 1.32, pz + s * 0.6)); K.add('cloth', new T.CylinderGeometry(0.012, 0.012, 0.08, 6).translate(px - 0.1, F + 1.54, pz + s * 0.6), [0.95, 0.92, 0.85]); K.add('lit', new T.SphereGeometry(0.01, 6, 4).scale(1, 1.8, 1).translate(px - 0.1, F + 1.6, pz + s * 0.6), [1.8, 1.2, 0.5]); addGlow(px - 0.1, F + 1.61, pz + s * 0.6, [1.3, 0.75, 0.35], 0.3, Math.random(), 0); }
  addCollider(px - 0.6, F, pz - 0.8, px + 0.35, F + 1.35, pz + 0.8);
  placeFurn(FURN.barStool(), FMk, fadd, px - 1.05, F - 0.05, pz);
  V.staff.push({ st: 4, x: px - 1.05, y: F + 0.82, z: pz, yaw: Math.PI / 2, sc: 1, v: 0, kind: 'suit', col: [0.22, 0.2, 0.18], sit: true, act: 14.5 });
  // Zuhörer am Klavier
  VENUE_PEDS.push({ st: 4, x: px - 1.4, y: F, z: pz - 1.25, yaw: Math.PI * 0.35, sc: 0.95, v: 0, kind: 'lady', col: [0.42, 0.3, 0.24], act: 15.4 });
  VENUE_PEDS.push({ st: 4, x: px - 2.0, y: F, z: pz + 1.2, yaw: Math.PI * 0.62, sc: 1.0, v: 0, kind: 'sailor', act: 15.7 });
  addLight(0xff9a50, 1.4, 8, 1.8, px - 1.2, F + 3.0, pz);
  for (const t of V.tables) {
    K.add('gold', new T.CylinderGeometry(0.008, 0.008, H - 2.5, 4).translate(t.x, F + 2.25 + (H - 2.5) / 2, t.z));
    K.add('gold', lathe([[0.03, 0], [0.06, -0.05], [0.2, -0.2], [0.21, -0.22]], 14).translate(t.x, F + 2.3, t.z));
    K.add('lit', new T.SphereGeometry(0.06, 8, 6).translate(t.x, F + 2.12, t.z), [1.9, 1.3, 0.62]);
    K.add('lit', new T.CircleGeometry(0.2, 14).rotateX(Math.PI / 2).translate(t.x, F + 2.085, t.z), [1.2, 0.8, 0.38]);
    addGlow(t.x, F + 2.05, t.z, [1.4, 0.9, 0.42], 0.9, Math.random(), 0);
  }
}
// Weg eines Kellners durch die Gänge: erst in den Gang zwischen den Tischreihen, dann zum Tisch
export function waiterPath(V, from, to) {
  const lane = to.z + (to.z < (V.z0 + V.z1) / 2 ? 1.6 : -1.6), cx = V.x0 + 4.6;
  const pts = [[from.x, from.z]];
  if (Math.abs(from.x - cx) > 0.5) pts.push([cx, from.z]);
  pts.push([cx, lane], [to.x, lane], [to.x, to.z]);
  return pts;
}
export function seatStandPoint(s) { const a = Math.atan2(s.x - s.tx, s.z - s.tz) + 0.9; return { x: s.x + Math.sin(a) * 0.55, z: s.z + Math.cos(a) * 0.55 }; }
export function walkGait(pd, on) {
  const g = pd.a.gait, f = on ? (pd.fem ? 5.4 : 4.6) * 1.3 / pd.sc : pd.act, amp = on ? 0.36 : 0;
  if (g[1] !== f || g[2] !== amp) { g[1] = f; g[2] = amp; pd.a.gv = (pd.a.gv | 0) + 1; }
}
export function updateVenues(dt) {
  const cp = camera.position;
  for (const V of VENUES) {
    const near = (cp.x - (V.x0 + V.x1) / 2) ** 2 + (cp.z - (V.z0 + V.z1) / 2) ** 2 < 90 * 90;
    V.dishes.visible = near;
    if (!near && DINE.venue !== V) continue;
    // Gäste wechseln zwischen essen, trinken und reden
    updateGuestFlow(V, dt);
    for (const pd of V.peds) {
      if (pd.g || !pd.seat || (pd.dineT -= dt) > 0 || !pd.a) continue;
      pd.dineT = 6 + Math.random() * 14;
      const r = Math.random(), eats = pd.act >= 10 && pd.act < 11;
      setAct(pd, pd.act = eats ? (r < 0.6 ? 10.5 : r < 0.85 ? 11.4 : 7.8) : (r < 0.5 ? 11.4 : r < 0.8 ? 7.8 : 7.3));
    }
    // Barkeeper: schüttelt, poliert, geht an der Theke entlang
    for (const b of V.staff) if (b.bartender && b.a) {
      b.bt = (b.bt || 0) - dt;
      if (b.bt <= 0) { b.bt = 4 + Math.random() * 6; b.tz = b.z0 + Math.random() * (b.z1 - b.z0); b.act = Math.random() < 0.6 ? 13.3 : 5.5; }
      const dz = (b.tz ?? b.z) - b.z;
      if (Math.abs(dz) > 0.05) { b.z += Math.sign(dz) * Math.min(Math.abs(dz), 1.1 * dt); b.yaw = dz > 0 ? 0 : Math.PI; walkGait(b, true); }
      else { b.yaw = Math.PI / 2; walkGait(b, false); setAct(b, b.act); }
    }
    // Kellner: zur Station, zum Tisch, servieren, zurück
    for (const wt of V.waiters) {
      if (!wt.a) continue;
      if (wt.path.length) {
        const [px, pz] = wt.path[0], dx = px - wt.x, dz = pz - wt.z, d = Math.hypot(dx, dz), sp = 1.25 * dt;
        if (d <= sp) { wt.x = px; wt.z = pz; wt.path.shift(); }
        else { wt.x += dx / d * sp; wt.z += dz / d * sp; wt.yaw = Math.atan2(dx, dz); }
        walkGait(wt, true);
        if (!wt.path.length) { wt.wait = wt.target ? 2.4 : 3 + Math.random() * 5; if (wt.target) wt.yaw = Math.atan2(wt.target.tx - wt.x, wt.target.tz - wt.z); }
        continue;
      }
      wt.act = wt.target ? 12.5 : 1.3; walkGait(wt, false); setAct(wt, wt.act);
      if ((wt.wait -= dt) > 0) continue;
      if (wt.target) {
        // angekommen: Bestellung des Spielers abstellen
        if (wt.target === DINE.seat && DINE.order && !DINE.item) serveOrder();
        wt.target = null; wt.path = waiterPath(V, V.station, { x: wt.x, z: wt.z }).reverse();
        continue;
      }
      // neue Aufgabe: zuerst der Spieler, sonst ein Gast
      let s = null;
      if (DINE.venue === V && DINE.order && !DINE.item && !V.waiters.some(o => o.target === DINE.seat)) s = DINE.seat;
      else if (Math.random() < 0.6) { const busy = V.peds.filter(p => p.seat && !p.seat.stool); if (busy.length) s = pick(busy).seat; }
      if (s) { wt.target = s; wt.from = s; wt.path = waiterPath(V, wt, seatStandPoint(s)); }
      else wt.wait = 3 + Math.random() * 4;
    }
  }
  updateDine(dt);
}
// Spieler am Tisch
export function freeSeatNear(p) {
  for (const V of VENUES) {
    if (p.x < V.x0 - 6 || p.x > V.x1 + 6 || p.z < V.z0 - 6 || p.z > V.z1 + 6) continue;
    let best = null, bd = 1.4 * 1.4;
    for (const s of V.seats) { if (s.taken) continue; const d = (s.x - p.x) ** 2 + (s.z - p.z) ** 2; if (d < bd) { bd = d; best = s; } }
    if (best) return [V, best];
  }
  return null;
}
export function sitDown(V, s) {
  DINE.seat = s; DINE.venue = V; s.taken = 'player'; DINE.order = null; DINE.item = null;
  player.p.set(s.x, s.y + 0.75 - EYE, s.z); player.v.set(0, 0, 0); player.yaw = s.yaw + Math.PI; player.pitch = -0.32;
  toast('Platz genommen · E bestellen · W aufstehen');
}
export function standUp() {
  const s = DINE.seat; if (!s) return;
  s.taken = null; DINE.seat = null;
  if (DINE.menuOpen) { closeMenu(); if (!isTouch) tryLock(); }
  if (DINE.item) { DINE.item.removeFromParent(); DINE.item = null; }
  DINE.order = null; DINE.venue = null;
  player.p.set(s.x + Math.sin(s.yaw) * -0.7, s.y - 0.5, s.z + Math.cos(s.yaw) * -0.7); player.pitch = 0;
}
export function openMenu() {
  const V = DINE.venue, M = MENU[V.kind], el = $('menuCard');
  el.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = M.title; el.append(h);
  const grid = document.createElement('div'); grid.className = 'items';
  for (const [k, sec] of [['drink', 'Getränke'], ['food', 'Speisen']]) {
    const s = document.createElement('b'); s.textContent = sec; grid.append(s);
    M.items.forEach((it, i) => { if (it[1] !== k) return; const bt = document.createElement('button'); bt.type = 'button'; bt.innerHTML = '<kbd>' + ((i + 1) % 10) + '</kbd>'; bt.append(it[0]); bt.onclick = () => placeOrder(i); grid.append(bt); });
  }
  el.append(grid);
  const p = document.createElement('p'); p.textContent = 'Zahl drücken oder antippen · Esc schließt'; el.append(p);
  const cl = document.createElement('button'); cl.type = 'button'; cl.className = 'close'; cl.textContent = 'Schließen'; cl.onclick = () => { closeMenu(); if (!isTouch) tryLock(); }; el.append(cl);
  el.hidden = false; DINE.menuOpen = true;
  if (locked) { DINE.keepLock = true; document.exitPointerLock(); }
}
export function closeMenu() { $('menuCard').hidden = true; DINE.menuOpen = false; }
export function placeOrder(i) {
  const it = MENU[DINE.venue.kind].items[i]; if (!it) return;
  DINE.order = it; closeMenu();
  toast(`Bestellt: ${it[0]} · der Kellner kommt gleich`);
  if (!isTouch) tryLock();
}
export function serveOrder() {
  const s = DINE.seat, it = DINE.order, dm = dishModel(it[2]);
  dm.position.set(s.tx, s.ty, s.tz); dm.rotation.y = s.yaw; scene.add(dm);
  DINE.item = dm; DINE.sips = it[1] === 'drink' ? 5 : 6; DINE.anim = 0;
  toast(`Bitte sehr: ${it[0]}`);
}
// Essen und Trinken: Glas oder Gabel kommt zum Mund, danach ist etwas weniger da
export const _dv = new T.Vector3(), _dw = new T.Vector3();
