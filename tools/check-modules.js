// Prüft die Modulreihenfolge: liest src/*.js als ES-Module, spielt die Auswertungsreihenfolge des Browsers
// ab src/boot.js nach und meldet Code auf oberster Ebene, der const/let/class aus einem Modul benutzt,
// das erst später ausgewertet wird (im Browser: "Cannot access ... before initialization").
// Aufruf: npm install acorn && node tools/check-modules.js . [src/boot.js]
const acorn = require('acorn'), fs = require('fs'), path = require('path');
const ROOT = process.argv[2], ENTRY = process.argv[3] || 'src/boot.js';
const mods = {};
function load(f) {
  if (mods[f]) return mods[f];
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const m = mods[f] = { f, ast, deps: [], imported: Object.create(null), exports: Object.create(null) };
  for (const n of ast.body) {
    if (n.type === 'ImportDeclaration') {
      const s = n.source.value;
      if (!s.startsWith('.')) { for (const sp of n.specifiers) m.external = (m.external || new Set()).add(sp.local.name); continue; }
      const d = path.posix.normalize(path.posix.join(path.posix.dirname(f), s)); m.deps.push(d);
      for (const sp of n.specifiers) m.imported[sp.local.name] = { from: d, name: sp.imported ? sp.imported.name : 'default' };
    } else if (n.type === 'ExportNamedDeclaration' && n.declaration) {
      const d = n.declaration;
      if (d.type === 'FunctionDeclaration') m.exports[d.id.name] = 'function';
      else if (d.type === 'ClassDeclaration') m.exports[d.id.name] = 'class';
      else for (const dc of d.declarations) (function pat(p) { if (p.type === 'Identifier') m.exports[p.name] = d.kind; else if (p.type === 'ObjectPattern') p.properties.forEach(pr => pat(pr.value || pr.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(e => e && pat(e)); else if (p.type === 'AssignmentPattern') pat(p.left); })(dc.id);
    }
  }
  for (const d of m.deps) load(d);
  return m;
}
load(ENTRY);
const order = [], st = {};
(function visit(f) { if (st[f]) return; st[f] = 1; for (const d of mods[f].deps) visit(d); order.push(f); })(ENTRY);
console.log('eval order:', order.map(f => path.basename(f, '.js')).join(' '));
const done = new Set(); let bad = 0;
for (const f of order) {
  const m = mods[f];
  (function walk(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ImportDeclaration') return;
    if (node.type === 'CallExpression' && (node.callee.type === 'FunctionExpression' || node.callee.type === 'ArrowFunctionExpression')) { node.arguments.forEach(walk); walk(node.callee.body); return; }
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') return;
    if (node.type === 'Identifier') { const im = m.imported[node.name]; if (im && !mods[im.from]) { console.log('??', f, node.name, im); return; } if (im && !done.has(im.from) && mods[im.from].exports[im.name] !== 'function') { console.log('TDZ RISK', f, 'line', node.loc.start.line, node.name, 'from', im.from); bad++; } return; }
    if (node.type === 'MemberExpression') { walk(node.object); if (node.computed) walk(node.property); return; }
    if (node.type === 'Property' && !node.computed && !node.shorthand) { walk(node.value); return; }
    for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && walk(x)); else if (v && typeof v.type === 'string') walk(v); }
  })(m.ast);
  done.add(f);
}
console.log('TDZ risks:', bad);

// 2. Freie Namen: Bezeichner, die weder lokal, noch importiert, noch Browser-Globale sind (Tippfehler, vergessene Importe)
const BUILTIN = new Set(Object.getOwnPropertyNames(globalThis).concat(['window', 'document', 'navigator', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'localStorage', 'location', 'AudioContext', 'webkitAudioContext', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'Image', 'ImageData', 'OffscreenCanvas', 'fetch', 'Blob', 'URL', 'URLSearchParams', 'screen', 'matchMedia', 'getComputedStyle', 'alert', 'DeviceOrientationEvent', 'DeviceMotionEvent', 'Audio', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'TouchEvent', 'CustomEvent', 'history', 'HTMLElement', 'HTMLCanvasElement', 'CanvasRenderingContext2D', 'Path2D', 'WebGLRenderingContext', 'WebGL2RenderingContext', 'ResizeObserver', 'IntersectionObserver', 'MutationObserver', 'AbortController', 'Request', 'Response', 'Headers', 'FormData', 'Worker', 'MessageChannel', 'crypto', 'visualViewport', 'scrollTo', 'open', 'close', 'focus', 'blur', 'undefined', 'arguments']));
function pat(p, cb) {
  if (!p) return;
  if (p.type === 'Identifier') cb(p.name);
  else if (p.type === 'ObjectPattern') for (const pr of p.properties) pat(pr.type === 'RestElement' ? pr.argument : pr.value, cb);
  else if (p.type === 'ArrayPattern') { for (const e of p.elements) if (e) pat(e, cb); }
  else if (p.type === 'AssignmentPattern') pat(p.left, cb);
  else if (p.type === 'RestElement') pat(p.argument, cb);
}
let free = 0;
for (const f of order) {
  const m = mods[f], top = new Set([...Object.keys(m.imported), ...(m.external || [])]);
  for (const n of m.ast.body) {
    const d = n.type === 'ExportNamedDeclaration' ? n.declaration : n;
    if (!d) continue;
    if (d.type === 'FunctionDeclaration' || d.type === 'ClassDeclaration') top.add(d.id.name);
    else if (d.type === 'VariableDeclaration') for (const dc of d.declarations) pat(dc.id, nm => top.add(nm));
  }
  const stack = [top];
  const has = nm => stack.some(s => s.has(nm));
  function hoist(body, set) { for (const n of body) { if (n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration') set.add(n.id.name); else if (n.type === 'VariableDeclaration') for (const d of n.declarations) pat(d.id, nm => set.add(nm)); } }
  function vars(node, set) { // var-Deklarationen bis zur nächsten Funktion
    if (!node || typeof node.type !== 'string') return;
    if (/Function/.test(node.type)) return;
    if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const d of node.declarations) pat(d.id, nm => set.add(nm));
    for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && vars(x, set)); else if (v && typeof v.type === 'string') vars(v, set); }
  }
  function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'ImportDeclaration': case 'ExportAllDeclaration': return;
      case 'ExportNamedDeclaration': if (node.declaration) visit(node.declaration); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': {
        const s = new Set(); if (node.id) s.add(node.id.name);
        for (const p of node.params) pat(p, nm => s.add(nm));
        if (node.body.type === 'BlockStatement') { hoist(node.body.body, s); vars(node.body, s); }
        stack.push(s); for (const p of node.params) defaults(p); if (node.body.type === 'BlockStatement') node.body.body.forEach(visit); else visit(node.body); stack.pop(); return;
      }
      case 'ClassDeclaration': case 'ClassExpression': if (node.superClass) visit(node.superClass); for (const mm of node.body.body) { if (mm.computed) visit(mm.key); if (mm.value) visit(mm.value); } return;
      case 'BlockStatement': { const s = new Set(); hoist(node.body, s); stack.push(s); node.body.forEach(visit); stack.pop(); return; }
      case 'ForStatement': case 'ForInStatement': case 'ForOfStatement': {
        const s = new Set(), init = node.init || node.left;
        if (init && init.type === 'VariableDeclaration') for (const d of init.declarations) pat(d.id, nm => s.add(nm));
        stack.push(s); if (node.type === 'ForStatement') { visit(node.init); visit(node.test); visit(node.update); } else { if (node.left.type !== 'VariableDeclaration') visit(node.left); else visit(node.left); visit(node.right); }
        visit(node.body); stack.pop(); return;
      }
      case 'CatchClause': { const s = new Set(); pat(node.param, nm => s.add(nm)); stack.push(s); visit(node.body); stack.pop(); return; }
      case 'SwitchStatement': { visit(node.discriminant); const s = new Set(); for (const c of node.cases) hoist(c.consequent, s); stack.push(s); for (const c of node.cases) { visit(c.test); c.consequent.forEach(visit); } stack.pop(); return; }
      case 'VariableDeclaration': for (const d of node.declarations) { defaults(d.id); visit(d.init); } return;
      case 'Identifier': if (!has(node.name) && !BUILTIN.has(node.name)) { console.log('FREE NAME', f, 'line', node.loc.start.line, node.name); free++; } return;
      case 'MemberExpression': visit(node.object); if (node.computed) visit(node.property); return;
      case 'Property': if (node.computed) visit(node.key); visit(node.value); return;
      case 'MethodDefinition': case 'PropertyDefinition': if (node.computed) visit(node.key); visit(node.value); return;
      case 'LabeledStatement': visit(node.body); return;
      case 'BreakStatement': case 'ContinueStatement': case 'MetaProperty': return;
      case 'UnaryExpression': if (node.operator === 'typeof' && node.argument.type === 'Identifier') return; visit(node.argument); return;
      default: for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(x => x && typeof x.type === 'string' && visit(x)); else if (v && typeof v.type === 'string') visit(v); }
    }
  }
  function defaults(p) {
    if (!p) return;
    if (p.type === 'AssignmentPattern') { defaults(p.left); visit(p.right); }
    else if (p.type === 'ObjectPattern') for (const pr of p.properties) { if (pr.computed) visit(pr.key); defaults(pr.type === 'RestElement' ? pr.argument : pr.value); }
    else if (p.type === 'ArrayPattern') p.elements.forEach(defaults);
    else if (p.type === 'RestElement') defaults(p.argument);
  }
  visit(m.ast);
}
console.log('free names:', free);
if (bad || free) process.exit(1);
