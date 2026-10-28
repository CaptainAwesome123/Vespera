import { T, scene, pick, R, camera, $ } from './core.js';
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

/* =====================================================================
   LOKALE ZUM HINEINGEHEN: Bar „The Brass Lantern“ und „Restaurant Aurora“ an der Seepromenade.
   Man setzt sich, bestellt beim Kellner, er bringt es an den Tisch, dann essen und trinken.
   Die Gäste essen, trinken, reden; Barkeeper mixt, Pianist spielt, Kellner gehen zwischen den Tischen.
   ===================================================================== */
export const VENUES = [], VENUE_PEDS = [];
export const MENU = {
  bar: { title: 'The Brass Lantern', items: [
    ['Martini', 'drink', 'martini'], ['Whisky Sour', 'drink', 'tumbler'], ['Champagner', 'drink', 'coupe'], ['Gin Fizz', 'drink', 'highball'],
    ['Kaffee', 'drink', 'cup'], ['Austern', 'food', 'oysters'], ['Erdnüsse', 'food', 'nuts'], ['Club-Sandwich', 'food', 'sandwich']] },
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
  const K = kit(), V = { ...o, x0, x1, z0, z1, F, seats: [], tables: [], waiters: [], station: null, staff: [], peds: [] };
  VENUES.push(V);
  // Boden: Parkett in der Bar, Teppich im Restaurant; vor der Tür eine Stufe
  K.add(bar ? 'parquet' : 'carpet', Bx(w, F, d, x, F / 2, z, bar ? 2.2 : 3), bar ? [0.82, 0.62, 0.48] : [0.75, 0.45, 0.45]);
  addCollider(x0, 0, z0, x1, F, z1);
  // Wände mit hohen Fenstern; Eingang mittig zur Stadt, zum See hin fast ganz verglast
  const cols = [];
  const outC = bar ? [0.42, 0.24, 0.16] : [0.88, 0.84, 0.74], inK = bar ? 'inWood' : 'paint', inC = bar ? [0.85, 0.7, 0.55] : [0.32, 0.5, 0.5];
  const wo = { outK: 'stone', outC, inK, inC, th: 0.36, sill: bar ? 1.0 : 0.6, head: H - 0.9, win: bar ? 1.6 : 2.2, post: 0.6 };
  wallRun(K, cols, x0, z1, x1, z1, F, H, { ...wo, doors: [[w / 2 - 1.3, w / 2 + 1.3]] });
  wallRun(K, cols, x1, z1, x1, z0, F, H, wo);
  wallRun(K, cols, x1, z0, x0, z0, F, H, { ...wo, sill: bar ? 1.0 : 0.45, win: bar ? 1.6 : 3.0, post: 0.45 });
  wallRun(K, cols, x0, z0, x0, z1, F, H, wo);
  for (const b of cols) addCollider(b.x0, b.y0, b.z0, b.x1, b.y1, b.z1);
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
  // Innen: Wandleuchten, Kronleuchter, warmes Licht
  for (let u = x0 + 3; u < x1 - 2; u += 5) for (const zz of [z0 + 0.28, z1 - 0.28]) { K.add('lit', new T.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(zz < z ? Math.PI / 2 : -Math.PI / 2).translate(u, F + 2.6, zz), [1.6, 1.05, 0.6]); addGlow(u, F + 2.6, zz + (zz < z ? 0.2 : -0.2), [1.3, 0.8, 0.4], 0.8); }
  for (const u of [x - w / 4, x + w / 4]) {
    K.add('gold', new T.CylinderGeometry(0.02, 0.02, 1.0, 6).translate(u, F + H - 0.7, z));
    for (let k = 0; k < 3; k++) K.add('gold', new T.TorusGeometry(0.55 - k * 0.15, 0.02, 6, 28).rotateX(Math.PI / 2).translate(u, F + H - 1.3 + k * 0.18, z));
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28; K.add('lit', new T.CylinderGeometry(0.025, 0.025, 0.14, 6).translate(u + Math.cos(a) * 0.55, F + H - 1.2, z + Math.sin(a) * 0.55), [1.8, 1.25, 0.7]); }
    addGlow(u, F + H - 1.25, z, [1.4, 0.95, 0.5], 1.3); addLight(0xffb070, 2.2, 16, 1.6, u, F + H - 1.6, z);
  }
  const FMk = bar ? { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth' } : { up: 'leather', frame: 'gold', wood: 'varnish', lamp: 'lit', cloth: 'cloth' };
  const upC = bar ? [0.45, 0.12, 0.08] : [0.1, 0.3, 0.32];
  const fadd = (k, g) => K.add(k, g, k === 'leather' ? upC : k === 'lit' ? [1.6, 1.05, 0.55] : k === 'cloth' ? [0.94, 0.92, 0.86] : [1, 1, 1]);
  // Theke an der Westwand: Mahagoni, Messinglauf, Spiegel, Flaschenregal, Hocker
  const cx = x0 + 2.4, cz0 = z0 + 2.2, cz1 = z1 - 3.4;
  K.add('varnish', Bx(0.8, 1.05, cz1 - cz0, cx, F + 0.53, (cz0 + cz1) / 2, 1), [0.6, 0.3, 0.18]);
  K.add('stone', Bx(1.0, 0.07, cz1 - cz0 + 0.1, cx, F + 1.09, (cz0 + cz1) / 2, 1), bar ? [0.12, 0.1, 0.1] : [0.9, 0.88, 0.84]);
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
  for (let u = cz0 + 0.5; u < cz1 - 0.4; u += 0.7 + R() * 0.6) ware(pick(bar ? ['cocktail', 'glass-wine', 'cocktail', 'bottle'] : ['glass-wine', 'wine-white', 'cake', 'pie']), cx - 0.12 + R() * 0.2, F + 1.125, u, R);
  if (!bar) for (let i = 0; i < 5; i++) ware(pick(['apple', 'orange', 'pear']), cx + (R() - 0.5) * 0.18, F + 1.125, cz1 - 0.6 + (R() - 0.5) * 0.18, R);
  for (let u = cz0 + 0.6; u < cz1 - 0.3; u += 1.1) { placeFurn(FURN.barStool(), FMk, fadd, cx + 1.05, F, u); if (bar && R() < 0.5) V.seats.push({ x: cx + 1.05, z: u, y: F + 0.89, yaw: -Math.PI / 2, tx: cx + 0.3, tz: u, ty: F + 1.12, stool: true }); }
  V.station = { x: cx + 1.4, z: cz1 + 0.9 };
  // Barkeeper hinter der Theke
  V.staff.push({ st: 4, x: cx - 0.95, y: F, z: (cz0 + cz1) / 2, yaw: Math.PI / 2, sc: 1, v: 0, kind: 'waiter', col: bar ? [0.42, 0.08, 0.08] : [0.92, 0.9, 0.85], act: 13.3, bartender: true, z0: cz0 + 0.6, z1: cz1 - 0.6 });
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
  if (bar) {
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
    const r0 = R(), kind = bar ? pick(['suit', 'coat', 'lady', 'dress', 'suit', 'gown', 'tux']) : pick(['tux', 'gown', 'suit', 'lady', 'gown', 'dress']);
    const eat = !s.stool && !bar ? r0 < 0.6 : r0 < 0.25;
    const pd = { st: 4, x: s.x, y: s.y, z: s.z, yaw: s.yaw, sc: 0.94 + R() * 0.12, v: 0, sit: true, kind, act: eat ? 10 + 0.3 + R() * 0.4 : (R() < 0.5 ? 11.4 : 7.8), seat: s, dineT: R() * 20 };
    s.taken = pd; V.peds.push(pd); VENUE_PEDS.push(pd); 
    const dm = dishModel(eat ? pick(bar ? ['oysters', 'nuts', 'sandwich'] : ['steak', 'soup', 'lobster', 'cake', 'oysters']) : pick(bar ? ['martini', 'tumbler', 'coupe', 'highball'] : ['coupe', 'wine']));
    dm.position.set(s.tx, s.ty, s.tz); dm.rotation.y = s.yaw; dishes.push(dm); pd.dish = dm;
    if (eat && !bar) { const gl = dishModel(pick(['wine', 'coupe'])); gl.position.set(s.tx + Math.cos(s.yaw) * 0.18, s.ty, s.tz - Math.sin(s.yaw) * 0.18); dishes.push(gl); }
  }
  // Geschirr nur in der Nähe zeigen (viele kleine Teile)
  V.dishes = new T.Group(); for (const dm of dishes) V.dishes.add(dm); scene.add(V.dishes); V.dishes.visible = false;
  for (const p of V.staff) VENUE_PEDS.push(p);
  // Kellner: weiße Jacke, gehen zwischen Station und Tischen
  for (let k = 0; k < (bar ? 1 : 2); k++) {
    const wt = { st: 4, x: V.station.x, y: F, z: V.station.z, yaw: 0, sc: 1, v: 0, kind: 'waiter', col: [0.94, 0.92, 0.87], act: 12.5, waiter: true, path: [], wait: 2 + k * 4, carry: null, target: null };
    V.waiters.push(wt); VENUE_PEDS.push(wt);
  }
  return V;
}
export function buildVenues() {
  venue({ name: 'THE BRASS LANTERN', kind: 'bar', x: -170, z: -1014, w: 24, d: 15 });
  venue({ name: 'RESTAURANT AURORA', kind: 'restaurant', x: 170, z: -1012, w: 28, d: 16 });
  VIEWS.Digit9 = { name: 'The Brass Lantern', p: [-170, 0.26, -1000], yaw: 0, pitch: 0.05, fly: false };
  VIEWS.Digit0 = { name: 'Restaurant Aurora', p: [170, 0.26, -997], yaw: 0, pitch: 0.05, fly: false };
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
