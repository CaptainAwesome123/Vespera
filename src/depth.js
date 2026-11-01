/* =====================================================================
   V40 · UMGEKEHRTE GLEITKOMMA-TIEFE (Reverse-Z)
   Warum: der Tiefenpuffer verteilt seine Genauigkeit nach 1/z. Mit der Nahebene 0,2 m (Hände, Teller, Wände) und
   24 Bit sind zwei Flächen in 400 m Abstand erst ab rund 5 cm sicher getrennt, in 800 m ab 20 cm. Die oberen
   Stufen des Belmont stehen auch vom Platz aus 200–400 m weit weg: Kanneluren, Leuchtleisten, Fächer und
   Schmuckschichten vor der Fassade flackerten dort gegeneinander, egal wie oft einzelne Flächen verschoben wurden.
   Lösung (Stand der Technik seit D3D-Zeiten): Tiefe als 32-Bit-Gleitkommazahl, Nahebene auf 1, Ferne auf 0.
   Die Gleitkommazahl ist nahe 0 am dichtesten, genau dort liegt jetzt die Ferne: die Auflösung wird in jeder
   Entfernung praktisch gleich (unter 1 mm bei 1 km). Dafür braucht WebGL 2 die Erweiterung EXT_clip_control
   (Chrome ab 126, Firefox ab 128), damit der Clip-Raum wie in D3D von 0 bis 1 geht; ohne sie bleibt alles wie bisher.
   Was sich ändert (alles an einer Stelle, kein Shader außer dem Himmel):
   - Projektionsmatrix der Kamera: dritte Zeile wird 0,5·(w − z) (aus [-1,1] wird [1,0]).
   - Tiefenvergleich Less/LessEqual wird Greater/GreaterEqual, Löschen mit 0 statt 1, polygonOffset mit umgekehrtem Vorzeichen.
   - Sortierung: three sortiert nach dem NDC-z, das jetzt umgekehrt läuft (eigene Vergleichsfunktionen).
   - Schattenpass: läuft kurz wieder im alten Modus (Schattenkamera und -vergleich bleiben unverändert).
   - Zwischenbilder (Composer, Spiegelung) bekommen eine DEPTH_COMPONENT32F-Tiefe statt 24 Bit (DepthTexture FloatType).
   - Himmel: gl_Position.z = 0 statt w (ganz hinten).
   Schalter: ?tiefe=alt schaltet auf das alte Verfahren (Vergleichstest am PC).
   ===================================================================== */
export const REVZ = { on: false, active: false, ext: null, glProj: null, T: null, negOffset: false, setActive: () => {} };
// Bildfüllende Rechtecke der Nachbearbeitung (Pass.js: Orthokamera near 0, Ebene bei z 0 -> Clip-z = -1) lägen im 0..1-Clip-Raum
// außerhalb und würden weggeschnitten (schwarzes Bild). Solche Pässe laufen deshalb im alten Modus.
export function passWithoutReverse(pass) {
  if (!REVZ.on) return pass;
  const o = pass.render;
  pass.render = function (...a) { REVZ.setActive(false); try { o.apply(this, a); } finally { REVZ.setActive(true); } };
  return pass;
}

export function setupReverseZ(renderer, camera, T) {
  REVZ.T = T;
  const q = new URLSearchParams(location.search);
  if (!renderer.capabilities.isWebGL2 || q.get('tiefe') === 'alt') return REVZ;
  const gl = renderer.getContext();
  const ext = gl.getExtension('EXT_clip_control');
  if (!ext) return REVZ;
  REVZ.on = REVZ.active = true; REVZ.ext = ext;
  const clip = rev => ext.clipControlEXT(ext.LOWER_LEFT_EXT, rev ? ext.ZERO_TO_ONE_EXT : ext.NEGATIVE_ONE_TO_ONE_EXT);
  clip(true);
  // Tiefenvergleich und Löschwert: three ruft setFunc je Material, setClear nur beim Start (Cache dahinter)
  const D = renderer.state.buffers.depth, oF = D.setFunc, oC = D.setClear;
  const flip = { [T.LessDepth]: T.GreaterDepth, [T.LessEqualDepth]: T.GreaterEqualDepth, [T.GreaterDepth]: T.LessDepth, [T.GreaterEqualDepth]: T.LessEqualDepth };
  let want = T.LessEqualDepth;
  const map = f => { if (f === undefined || f === null) f = T.LessEqualDepth; return REVZ.active && f in flip ? flip[f] : f; };
  D.setFunc = f => { want = f; oF(map(f)); };
  D.setClear = d => oC(REVZ.active ? 1 - d : d);
  // polygonOffset ist ein Zuschlag auf die Fenstertiefe; bei umgekehrter Tiefe zieht also ein positiver Wert nach vorn
  // (gemessen: Faktor -1 schob die Vordach-Glühbirnen hinter die Platte). Weil Treiber das unterschiedlich auslegen könnten,
  // misst calibrateOffset() nach dem Start, welches Vorzeichen auf dieser Grafikkarte nach vorn zieht (REVZ.negOffset).
  // Achtung: state.setMaterial ruft intern sein eigenes setPolygonOffset (Closure), die Eigenschaft am state-Objekt greift
  // dort nicht. Deshalb wird setMaterial umhüllt und das Material kurz mit gekipptem Vorzeichen übergeben.
  REVZ.negOffset = false;
  const oM = renderer.state.setMaterial;
  renderer.state.setMaterial = (m, cw) => {
    if (REVZ.active && REVZ.negOffset && m.polygonOffset) {
      const f = m.polygonOffsetFactor, u = m.polygonOffsetUnits; m.polygonOffsetFactor = -f; m.polygonOffsetUnits = -u;
      try { oM(m, cw); } finally { m.polygonOffsetFactor = f; m.polygonOffsetUnits = u; }
    } else oM(m, cw);
  };
  const apply = () => { oC(REVZ.active ? 0 : 1); oF(T.NeverDepth); oF(map(want)); };   // Cache ungültig machen, dann neu setzen
  apply();
  const setActive = REVZ.setActive = a => { if (REVZ.active === a) return; REVZ.active = a; clip(a); apply(); };
  // Schatten: Schattenkamera und Vergleich im Shader rechnen mit dem alten Clip-Raum, also für diesen Pass zurückschalten
  const sm = renderer.shadowMap, oR = sm.render;
  sm.render = function (lights, scene, cam) { const prev = REVZ.active; setActive(false); try { oR.call(this, lights, scene, cam); } finally { setActive(prev); } };
  // Sortierung nach NDC-z (bei three: undurchsichtig von vorn nach hinten, durchsichtig von hinten nach vorn)
  const cmp = (a, b) => a.groupOrder !== b.groupOrder ? a.groupOrder - b.groupOrder : a.renderOrder !== b.renderOrder ? a.renderOrder - b.renderOrder : 0;
  renderer.setOpaqueSort((a, b) => cmp(a, b) || (a.material.id !== b.material.id ? a.material.id - b.material.id : a.z !== b.z ? b.z - a.z : a.id - b.id));
  renderer.setTransparentSort((a, b) => cmp(a, b) || (a.z !== b.z ? a.z - b.z : a.id - b.id));
  // Kamera: Matrix wie gewohnt bauen, die alte Fassung merken (Spiegelung braucht sie), dann umrechnen
  REVZ.glProj = new T.Matrix4();
  camera.updateProjectionMatrix = function () {
    T.PerspectiveCamera.prototype.updateProjectionMatrix.call(this);
    REVZ.glProj.copy(this.projectionMatrix);
    toReverse(this.projectionMatrix);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  };
  camera.updateProjectionMatrix();
  calibrateOffset(renderer, T);
  return REVZ;
}
// Zwei deckungsgleiche Scheiben in ein 4x4-Bild: rot ohne, grün mit polygonOffset(-1, -4). Gewinnt Grün, zieht ein
// negativer Offset auch mit Reverse-Z nach vorn (nichts kippen); gewinnt Rot, muss das Vorzeichen gekippt werden.
function calibrateOffset(renderer, T) {
  try {
    const rt = new T.WebGLRenderTarget(4, 4, { depthBuffer: true, ...depthOptions(4, 4) });
    const sc = new T.Scene(), cam = new T.PerspectiveCamera(60, 1, 0.2, 100); cam.position.set(0, 0, 5); cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix(); toReverse(cam.projectionMatrix); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const a = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshBasicMaterial({ color: 0xff0000 })); a.renderOrder = 0;
    const b = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshBasicMaterial({ color: 0x00ff00, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 })); b.renderOrder = 1;
    sc.add(a, b);
    const prev = renderer.getRenderTarget(), ac = renderer.autoClear;
    renderer.setRenderTarget(rt); renderer.autoClear = true; renderer.render(sc, cam);
    const px = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 2, 2, 1, 1, px);
    renderer.setRenderTarget(prev); renderer.autoClear = ac; rt.dispose(); a.geometry.dispose(); a.material.dispose(); b.material.dispose();
    REVZ.negOffset = px[0] > px[1];   // Rot gewann: negativer Offset schob nach hinten
    REVZ.calib = Array.from(px);
  } catch (e) { console.warn('Reverse-Z: polygonOffset-Messung fehlgeschlagen', e); }
}
// dritte Zeile z' = 0,5·(w − z): aus NDC-z in [-1 (nah), 1 (fern)] wird [1 (nah), 0 (fern)]
export function toReverse(m) { const e = m.elements; for (let k = 0; k < 16; k += 4) e[k + 2] = 0.5 * (e[k + 3] - e[k + 2]); return m; }
// Zwischenbild mit 32-Bit-Gleitkomma-Tiefe (ohne Reverse-Z bleibt der Stencil-Trick aus V34 für 24 Bit)
export function depthOptions(w, h) {
  const T = REVZ.T;
  return REVZ.on ? { stencilBuffer: false, depthTexture: new T.DepthTexture(w, h, T.FloatType) } : { stencilBuffer: true };
}
// Mehrfach-Puffer (MSAA): three kopiert beim Auflösen auch die Tiefe in die DepthTexture; die liest niemand, also weglassen
export function skipDepthResolve(renderer, rt) { if (rt) renderer.properties.get(rt).__ignoreDepthValues = true; }
