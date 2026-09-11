'use strict';

/* ============================================================
   Gallery wall  ·  probador de cuadros sobre foto real
   Coordenadas del mundo: X = cm desde la esquina izquierda de la pared
                          Y = cm desde el piso hacia arriba
   La capa #wall usa unidades internas de 1 cm = S px para no pixelar.
   ============================================================ */

const S = 10;                       // unidades por cm dentro de #wall
const STORE_KEY = 'gallerywall.v1';

/* Punto de partida de una pared nueva: un rectángulo cómodo de agarrar en el
   medio de la foto. Orden: abajo-izq, abajo-der, arriba-der, arriba-izq */
const START_CORNERS = [[0.15, 0.85], [0.85, 0.85], [0.85, 0.20], [0.15, 0.20]];
const DEFAULT_WALL = { w: 300, h: 260 };

const FRAMES = [
  { id: 'black',  label: 'Negro',         color: '#17171a', edge: '#000000' },
  { id: 'white',  label: 'Blanco',        color: '#f1eee9', edge: '#cfc9c0' },
  { id: 'oak',    label: 'Roble claro',   color: '#c69b62', edge: '#9c7444' },
  { id: 'walnut', label: 'Nogal',         color: '#6b4429', edge: '#4a2d19' },
  { id: 'natural',label: 'Madera natural',color: '#a9814f', edge: '#7d5c34' },
  { id: 'gold',   label: 'Dorado',        color: '#b8933f', edge: '#8a6c26' },
  { id: 'none',   label: 'Sin marco',     color: null,      edge: null }
];

const PRESETS = [
  [10,15],[13,18],[15,21],[20,25],[21,30],[24,30],
  [30,40],[40,50],[50,70],[60,80],
  [20,20],[30,30],[40,40],[50,50]
];

/* ---------- álgebra ---------- */

function solve(A, b) {                       // Gauss con pivoteo parcial
  const n = b.length, M = A.map((r, i) => r.concat([b[i]]));
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const pv = M[c][c];
    if (Math.abs(pv) < 1e-12) return null;
    for (let k = c; k <= n; k++) M[c][k] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (!f) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map(r => r[n]);
}

/* homografía que lleva src[i] -> dst[i] (4 puntos) */
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  if (!h) return null;
  return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
}

function applyH(h, x, y) {
  const w = h[2][0] * x + h[2][1] * y + h[2][2];
  return [(h[0][0] * x + h[0][1] * y + h[0][2]) / w,
          (h[1][0] * x + h[1][1] * y + h[1][2]) / w];
}

function invert3(m) {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, hh, i] = m[2];
  const det = a * (e * i - f * hh) - b * (d * i - f * g) + c * (d * hh - e * g);
  if (!det) return null;
  return [
    [(e * i - f * hh) / det, (c * hh - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * hh - e * g) / det, (b * g - a * hh) / det, (a * e - b * d) / det]
  ];
}

const uid = () => Math.random().toString(36).slice(2, 9);
const round = (v, n = 1) => Math.round(v * Math.pow(10, n)) / Math.pow(10, n);

/* ---------- estado ----------

   Cada pared guarda su foto, su calibración, sus cuadros y sus versiones.
   La biblioteca de imágenes es común a todas, así una misma lámina se puede
   probar en cualquier pared sin volver a subirla.

   No hay pared por defecto: la app arranca vacía y la primera foto la sube el
   usuario.

   state.cal / state.items / state.versions son el buffer de edición de la
   pared activa; se vuelcan a state.walls[current] en cada guardado.        */

const clone = o => JSON.parse(JSON.stringify(o));

function newWallObj(o) {
  const w = Object.assign({
    id: uid(), name: 'Pared',
    src: null, imgW: 1500, imgH: 2000,
    cal: { corners: clone(START_CORNERS), wallW: DEFAULT_WALL.w, wallH: DEFAULT_WALL.h },
    items: [], versions: {}, light: null
  }, o);
  // a esto vuelve "calibración original": el estado con el que nació la pared
  if (!w.calBase) w.calBase = clone(w.cal);
  return w;
}

let state = {
  walls: {},            // id -> pared
  order: [],            // orden de las paredes en el select
  current: null,
  library: {},          // imgId -> { src, ar }
  view: { guides: true, museum: true, grid: false, light: 85 },
  // buffer de la pared activa
  cal: null, items: [], versions: {}
};

const curWall = () => state.walls[state.current];

let selected = null;
let H = null, Hinv = null;   // wall-units <-> px de la foto
let stageScale = 1;
let undoStack = [], redoStack = [];

/* ---------- DOM ---------- */

const $ = id => document.getElementById(id);
const viewport = $('viewport'), stage = $('stage'), photo = $('photo');
const wall = $('wall'), layer = $('cuadros'), guidesEl = $('guides'), refsEl = $('refs');
const calLayer = $('calLayer');

/* ---------- iluminación ----------

   Un cuadro pegado sin más encima de la foto se nota: la pared real tiene su
   propia luz. Se muestrea el brillo de la pared sobre una grilla en el plano
   calibrado, se normaliza contra el punto más claro y después cada cuadro se
   oscurece según dónde caiga. Así se ajusta solo a cualquier foto. */

const LG_W = 9, LG_H = 11;

function computeLightGrid() {
  const w = curWall();
  if (!w || !photo.complete || !photo.naturalWidth) return;
  const c = document.createElement('canvas');
  c.width = IMG_W; c.height = IMG_H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(photo, 0, 0, IMG_W, IMG_H);

  const { wallW, wallH } = state.cal;
  const vals = [], r = Math.max(4, Math.round(Math.min(IMG_W, IMG_H) / 90));
  const INSET = 0.03;   // los bordes del plano rozan piso, techo y muebles
  for (let gy = 0; gy < LG_H; gy++) {
    for (let gx = 0; gx < LG_W; gx++) {
      const fx = INSET + (1 - 2 * INSET) * (gx / (LG_W - 1));
      const fy = INSET + (1 - 2 * INSET) * (gy / (LG_H - 1));
      const p = applyH(H, ...toUnits(wallW * fx, wallH * (1 - fy)));
      const px = Math.round(p[0]), py = Math.round(p[1]);
      const sx = Math.max(0, px - r), sy = Math.max(0, py - r);
      const sw = Math.min(IMG_W - sx, r * 2), sh = Math.min(IMG_H - sy, r * 2);
      if (sw <= 0 || sh <= 0) { vals.push(0.8); continue; }
      const d = ctx.getImageData(sx, sy, sw, sh).data;
      const lum = [];
      for (let i = 0; i < d.length; i += 4) lum.push((d[i] + d[i + 1] + d[i + 2]) / 3);
      // percentil 75 en vez de promedio: si el parche pesca un mueble, una
      // sombra o el zócalo, el promedio se hunde y el percentil sigue la pared
      lum.sort((a, b) => a - b);
      vals.push(lum[Math.floor(lum.length * 0.75)] / 255);
    }
  }
  const max = Math.max(...vals) || 1;
  w.light = vals.map(v => Math.min(1, Math.max(0.45, v / max)));
}

/* factor de brillo 0..1 en un punto del plano, interpolado en la grilla */
function lightAt(X, Y) {
  const g = curWall() && curWall().light;
  if (!g) return 1;
  const { wallW, wallH } = state.cal;
  const fx = Math.min(1, Math.max(0, X / wallW)) * (LG_W - 1);
  const fy = Math.min(1, Math.max(0, 1 - Y / wallH)) * (LG_H - 1);
  const x0 = Math.min(LG_W - 2, Math.floor(fx)), y0 = Math.min(LG_H - 2, Math.floor(fy));
  const tx = fx - x0, ty = fy - y0;
  const at = (a, b) => g[b * LG_W + a];
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
         (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}
function lightFilter(X, Y) {
  const k = state.view.light / 100;
  if (k <= 0) return 'none';
  const b = 1 - k * (1 - lightAt(X, Y));
  return `brightness(${round(b, 3)}) sepia(${round(0.14 * k, 3)})`;
}

/* tamaño de la foto activa; lo fija openWall al cargarla */
let IMG_W = 1500, IMG_H = 2000;

/* ============================================================
   Geometría
   ============================================================ */

function rebuildTransform() {
  const { wallW, wallH, corners } = state.cal;
  const dst = corners.map(([fx, fy]) => [fx * IMG_W, fy * IMG_H]);
  // src en unidades internas, origen arriba-izquierda, Y hacia abajo
  const src = [[0, wallH * S], [wallW * S, wallH * S], [wallW * S, 0], [0, 0]];
  H = homography(src, dst);
  if (!H) return;
  Hinv = invert3(H);

  wall.style.width = (wallW * S) + 'px';
  wall.style.height = (wallH * S) + 'px';
  const m = H;
  wall.style.transform =
    `matrix3d(${m[0][0]},${m[1][0]},0,${m[2][0]},` +
    `${m[0][1]},${m[1][1]},0,${m[2][1]},` +
    `0,0,1,0,` +
    `${m[0][2]},${m[1][2]},0,${m[2][2]})`;

  $('wallInfo').textContent = `pared ${wallW} × ${wallH} cm`;
  $('inWallW').value = wallW;
  $('inWallH').value = wallH;
}

/* cm de mundo (X der, Y arriba desde el piso) -> unidades internas de #wall */
const toUnits = (X, Y) => [X * S, (state.cal.wallH - Y) * S];
const toWorld = (ux, uy) => [ux / S, state.cal.wallH - uy / S];

/* punto de pantalla -> cm de mundo */
function screenToWorld(clientX, clientY) {
  const r = stage.getBoundingClientRect();
  const px = (clientX - r.left) / stageScale;
  const py = (clientY - r.top) / stageScale;
  const [ux, uy] = applyH(Hinv, px, py);
  return toWorld(ux, uy);
}

function fitStage() {
  const pad = 24;
  const vw = viewport.clientWidth - pad * 2, vh = viewport.clientHeight - pad * 2;
  stageScale = Math.min(vw / IMG_W, vh / IMG_H);
  stage.style.width = IMG_W + 'px';
  stage.style.height = IMG_H + 'px';
  const tx = pad + (vw - IMG_W * stageScale) / 2;
  const ty = pad + (vh - IMG_H * stageScale) / 2;
  stage.style.transform = `translate(${tx}px,${ty}px) scale(${stageScale})`;

  // tamaño de los adornos de UI: constante en pantalla, variable en unidades
  const midU = applyH(H, state.cal.wallW * S / 2, state.cal.wallH * S / 2);
  const offU = applyH(H, state.cal.wallW * S / 2 + 100, state.cal.wallH * S / 2);
  const pxPerUnit = Math.abs(offU[0] - midU[0]) / 100 * stageScale;
  document.documentElement.style.setProperty('--u', (1 / Math.max(pxPerUnit, 1e-4)) + 'px');
  calLayer.setAttribute('viewBox', `0 0 ${IMG_W} ${IMG_H}`);
}

/* ============================================================
   Cuadros
   ============================================================ */

const frameById = id => FRAMES.find(f => f.id === id) || FRAMES[0];

function outerSize(it) {
  const pad = (it.frameW + it.mat) * 2;
  return [it.iw + pad, it.ih + pad];
}

function makeItem(imgId, ar) {
  const long = 40;
  let iw, ih;
  if (ar >= 1) { iw = long; ih = long / ar; } else { ih = long; iw = long * ar; }
  const n = state.items.length;
  return {
    id: uid(), imgId,
    iw: round(iw, 1), ih: round(ih, 1), ar, lock: true,
    x: round(state.cal.wallW / 2 + (n % 5 - 2) * 8, 1),
    y: round(150 + (Math.floor(n / 5) % 3 - 1) * 10, 1),
    frame: 'black', frameW: 2, mat: 4, matColor: '#f3efe6'
  };
}

function renderItems() {
  layer.querySelectorAll('.cuadro').forEach(n => n.remove());
  state.items.forEach(it => layer.appendChild(buildEl(it)));
  renderHandles();
}

function buildEl(it) {
  const [ow, oh] = outerSize(it);
  const [ux, uy] = toUnits(it.x, it.y);
  const f = frameById(it.frame);
  const el = document.createElement('div');
  el.className = 'cuadro' + (selected === it.id ? ' sel' : '');
  el.dataset.id = it.id;
  el.style.width = ow * S + 'px';
  el.style.height = oh * S + 'px';
  el.style.left = (ux - ow * S / 2) + 'px';
  el.style.top = (uy - oh * S / 2) + 'px';
  el.style.padding = it.mat * S + 'px';
  el.style.background = it.mat > 0 ? it.matColor : '#111';
  if (f.color) {
    el.style.border = `${it.frameW * S}px solid ${f.color}`;
    el.style.boxShadow = `${0.35 * S}px ${0.5 * S}px ${0.9 * S}px rgba(0,0,0,.40), inset 0 0 0 ${0.12 * S}px ${f.edge}`;
  } else {
    el.style.border = 'none';
    el.style.boxShadow = `${0.25 * S}px ${0.4 * S}px ${0.7 * S}px rgba(0,0,0,.32)`;
  }
  el.style.filter = lightFilter(it.x, it.y);
  const img = document.createElement('img');
  img.className = 'art';
  img.src = state.library[it.imgId] ? state.library[it.imgId].src : '';
  img.draggable = false;
  el.appendChild(img);
  return el;
}

function renderHandles() {
  layer.querySelectorAll('.handle').forEach(n => n.remove());
  const it = state.items.find(i => i.id === selected);
  if (!it) return;
  const [ow, oh] = outerSize(it);
  const [ux, uy] = toUnits(it.x, it.y);
  const L = ux - ow * S / 2, T = uy - oh * S / 2, W = ow * S, Hh = oh * S;
  const spots = {
    nw: [L, T], n: [L + W / 2, T], ne: [L + W, T],
    w: [L, T + Hh / 2], e: [L + W, T + Hh / 2],
    sw: [L, T + Hh], s: [L + W / 2, T + Hh], se: [L + W, T + Hh]
  };
  for (const k in spots) {
    const h = document.createElement('div');
    h.className = 'handle ' + k;
    h.dataset.dir = k;
    h.style.width = h.style.height = 'calc(var(--u) * 11)';
    h.style.left = `calc(${spots[k][0]}px - var(--u) * 5.5)`;
    h.style.top = `calc(${spots[k][1]}px - var(--u) * 5.5)`;
    h.style.borderWidth = 'calc(var(--u) * 1.5)';
    layer.appendChild(h);
  }
}

function renderRefs() {
  refsEl.innerHTML = '';
  const { wallW, wallH } = state.cal;
  if (state.view.grid) {
    for (let x = 0; x <= wallW; x += 10) {
      const d = document.createElement('div');
      d.className = 'gridline v' + (x % 50 === 0 ? ' major' : '');
      d.style.left = x * S + 'px';
      d.style.width = 'calc(var(--u) * ' + (x % 50 === 0 ? 1.2 : 0.8) + ')';
      refsEl.appendChild(d);
    }
    for (let y = 0; y <= wallH; y += 10) {
      const d = document.createElement('div');
      d.className = 'gridline h' + (y % 50 === 0 ? ' major' : '');
      d.style.top = (wallH - y) * S + 'px';
      d.style.height = 'calc(var(--u) * ' + (y % 50 === 0 ? 1.2 : 0.8) + ')';
      refsEl.appendChild(d);
    }
  }
  if (state.view.museum) {
    const d = document.createElement('div');
    d.className = 'refline';
    d.style.top = (wallH - 150) * S + 'px';
    d.style.height = 'calc(var(--u) * 1.5)';
    const s = document.createElement('span');
    s.textContent = '150 cm';
    s.style.fontSize = 'calc(var(--u) * 13)';
    s.style.top = 'calc(var(--u) * -16)';
    s.style.left = 'calc(var(--u) * 4)';
    d.appendChild(s);
    refsEl.appendChild(d);
  }
}

function applyLight() { renderItems(); }

/* ============================================================
   Snap y guías
   ============================================================ */

function snapDrag(it, cx, cy) {
  guidesEl.innerHTML = '';
  if (!state.view.guides || noSnap) return [cx, cy];
  const [ow, oh] = outerSize(it);
  const tol = 1.2;
  const mine = { x: [cx - ow / 2, cx, cx + ow / 2], y: [cy - oh / 2, cy, cy + oh / 2] };

  const targX = [0, state.cal.wallW / 2, state.cal.wallW];
  const targY = [150];
  state.items.forEach(o => {
    if (o.id === it.id) return;
    const [w2, h2] = outerSize(o);
    targX.push(o.x - w2 / 2, o.x, o.x + w2 / 2);
    targY.push(o.y - h2 / 2, o.y, o.y + h2 / 2);
  });

  let bx = null, by = null;
  ['x', 'y'].forEach(ax => {
    const targets = ax === 'x' ? targX : targY;
    let best = null;
    mine[ax].forEach((m, i) => {
      targets.forEach(t => {
        const d = Math.abs(m - t);
        if (d <= tol && (!best || d < best.d)) best = { d, t, i };
      });
    });
    if (!best) return;
    const shift = best.t - mine[ax][best.i];
    if (ax === 'x') { cx += shift; bx = best.t; } else { cy += shift; by = best.t; }
  });

  if (bx !== null) drawGuide('v', bx);
  if (by !== null) drawGuide('h', by);
  return [cx, cy];
}

function drawGuide(kind, v) {
  const d = document.createElement('div');
  d.className = 'guide ' + kind;
  if (kind === 'v') { d.style.left = v * S + 'px'; d.style.width = 'calc(var(--u) * 1.5)'; }
  else { d.style.top = (state.cal.wallH - v) * S + 'px'; d.style.height = 'calc(var(--u) * 1.5)'; }
  guidesEl.appendChild(d);
}

/* ============================================================
   Interacción
   ============================================================ */

let drag = null, noSnap = false;

layer.addEventListener('pointerdown', e => {
  const h = e.target.closest('.handle');
  const c = e.target.closest('.cuadro');
  if (h) {
    const it = state.items.find(i => i.id === selected);
    if (!it) return;
    pushUndo();
    const [ow, oh] = outerSize(it);
    drag = { mode: 'resize', dir: h.dataset.dir, it, ow0: ow, oh0: oh, x0: it.x, y0: it.y };
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  if (c) {
    const it = state.items.find(i => i.id === c.dataset.id);
    if (!it) return;
    select(it.id);
    pushUndo();
    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    drag = { mode: 'move', it, gx: it.x - wx, gy: it.y - wy, moved: false };
    c.classList.add('dragging');
    layer.setPointerCapture(e.pointerId);
    e.preventDefault();
  } else {
    select(null);
  }
});

layer.addEventListener('pointermove', e => {
  if (!drag) return;
  const [wx, wy] = screenToWorld(e.clientX, e.clientY);
  const it = drag.it;

  if (drag.mode === 'move') {
    let cx = wx + drag.gx, cy = wy + drag.gy;
    [cx, cy] = snapDrag(it, cx, cy);
    it.x = round(cx, 1); it.y = round(cy, 1);
    drag.moved = true;
  } else {
    const d = drag.dir;
    const half = [drag.ow0 / 2, drag.oh0 / 2];
    // borde fijo = el opuesto al que arrastro
    const fixedR = drag.x0 + half[0], fixedL = drag.x0 - half[0];
    const fixedT = drag.y0 + half[1], fixedB = drag.y0 - half[1];
    const pad = (it.frameW + it.mat) * 2;
    let nw = drag.ow0, nh = drag.oh0, ax = drag.x0, ay = drag.y0;

    if (d.includes('e')) { nw = Math.max(pad + 2, wx - fixedL); ax = fixedL + nw / 2; }
    if (d.includes('w')) { nw = Math.max(pad + 2, fixedR - wx); ax = fixedR - nw / 2; }
    if (d.includes('n')) { nh = Math.max(pad + 2, wy - fixedB); ay = fixedB + nh / 2; }
    if (d.includes('s')) { nh = Math.max(pad + 2, fixedT - wy); ay = fixedT - nh / 2; }

    let niw = nw - pad, nih = nh - pad;
    if (it.lock) {
      if (d === 'n' || d === 's') niw = nih * it.ar;
      else if (d === 'e' || d === 'w') nih = niw / it.ar;
      else if (niw / it.ar > nih) nih = niw / it.ar; else niw = nih * it.ar;
      nw = niw + pad; nh = nih + pad;
      if (d.includes('e')) ax = fixedL + nw / 2;
      if (d.includes('w')) ax = fixedR - nw / 2;
      if (d.includes('n')) ay = fixedB + nh / 2;
      if (d.includes('s')) ay = fixedT - nh / 2;
    }
    it.iw = round(Math.max(1, niw), 1);
    it.ih = round(Math.max(1, nih), 1);
    it.x = round(ax, 1); it.y = round(ay, 1);
  }
  renderItems();
  syncItemPanel();
});

layer.addEventListener('pointerup', () => {
  if (drag) { guidesEl.innerHTML = ''; drag = null; renderItems(); save(); }
});
layer.addEventListener('pointercancel', () => { drag = null; guidesEl.innerHTML = ''; });

function select(id) {
  selected = id;
  renderItems();
  syncItemPanel();
}

/* ============================================================
   Panel
   ============================================================ */

function syncItemPanel() {
  const it = state.items.find(i => i.id === selected);
  const sec = $('itemSection');
  sec.classList.toggle('disabled', !it);
  if (!it) { $('outerReadout').textContent = 'exterior — × — cm'; return; }
  $('inIw').value = it.iw; $('inIh').value = it.ih;
  $('inFrameW').value = it.frameW; $('inMat').value = it.mat;
  $('inX').value = it.x; $('inY').value = it.y;
  $('inFrameStyle').value = it.frame;
  $('btnLock').classList.toggle('on', it.lock);
  const [ow, oh] = outerSize(it);
  $('outerReadout').textContent =
    `exterior ${round(ow, 1)} × ${round(oh, 1)} cm  ·  ocupa del piso ${round(it.y - oh / 2, 1)} a ${round(it.y + oh / 2, 1)} cm`;
}

function edit(fn) {
  const it = state.items.find(i => i.id === selected);
  if (!it) return;
  pushUndo();
  fn(it);
  renderItems(); syncItemPanel(); save();
}

function bindNum(id, apply) {
  $(id).addEventListener('change', () => edit(it => apply(it, parseFloat($(id).value))));
}

bindNum('inIw', (it, v) => { if (v > 0) { it.iw = v; if (it.lock) it.ih = round(v / it.ar, 1); } });
bindNum('inIh', (it, v) => { if (v > 0) { it.ih = v; if (it.lock) it.iw = round(v * it.ar, 1); } });
bindNum('inFrameW', (it, v) => { if (v >= 0) it.frameW = v; });
bindNum('inMat', (it, v) => { if (v >= 0) it.mat = v; });
bindNum('inX', (it, v) => { it.x = v; });
bindNum('inY', (it, v) => { it.y = v; });

$('inFrameStyle').addEventListener('change', () => edit(it => { it.frame = $('inFrameStyle').value; }));
$('btnLock').addEventListener('click', () => edit(it => {
  it.lock = !it.lock;
  if (it.lock) it.ih = round(it.iw / it.ar, 1);
}));

$('btnDup').addEventListener('click', () => edit(it => {
  const c = Object.assign({}, it, { id: uid(), x: round(it.x + 8, 1), y: round(it.y - 8, 1) });
  state.items.push(c); selected = c.id;
}));
$('btnDel').addEventListener('click', () => {
  if (!selected) return;
  pushUndo();
  state.items = state.items.filter(i => i.id !== selected);
  selected = null; renderItems(); syncItemPanel(); save();
});
$('btnFront').addEventListener('click', () => edit(it => {
  state.items = state.items.filter(i => i.id !== it.id).concat([it]);
}));
$('btnBack').addEventListener('click', () => edit(it => {
  state.items = [it].concat(state.items.filter(i => i.id !== it.id));
}));

/* selects y presets */
FRAMES.forEach(f => {
  const o = document.createElement('option');
  o.value = f.id; o.textContent = f.label;
  $('inFrameStyle').appendChild(o);
});
PRESETS.forEach(([a, b]) => {
  const btn = document.createElement('button');
  btn.textContent = `${a}×${b}`;
  btn.addEventListener('click', () => edit(it => {
    const land = it.iw >= it.ih;
    it.iw = land ? b : a; it.ih = land ? a : b;
    it.ar = it.iw / it.ih; it.lock = false;
  }));
  $('presets').appendChild(btn);
});

/* vista */
$('chkGuides').addEventListener('change', e => { state.view.guides = e.target.checked; save(); });
$('chkMuseum').addEventListener('change', e => { state.view.museum = e.target.checked; renderRefs(); save(); });
$('chkGrid').addEventListener('change', e => { state.view.grid = e.target.checked; renderRefs(); save(); });
$('inLight').addEventListener('input', e => { state.view.light = +e.target.value; applyLight(); save(); });

/* calibración */
$('inWallW').addEventListener('change', e => {
  const v = parseFloat(e.target.value);
  if (v > 20) { pushUndo(); state.cal.wallW = v; rebuildTransform(); fitStage(); renderItems(); renderRefs(); drawCal(); save(); }
});
$('inWallH').addEventListener('change', e => {
  const v = parseFloat(e.target.value);
  if (v > 20) { pushUndo(); state.cal.wallH = v; rebuildTransform(); fitStage(); renderItems(); renderRefs(); drawCal(); save(); }
});
$('chkCal').addEventListener('change', e => { calLayer.classList.toggle('on', e.target.checked); drawCal(); });
$('btnCalReset').addEventListener('click', () => {
  const w = curWall();
  if (!w) return;
  pushUndo();
  const base = w.calBase || newWallObj().cal;
  state.cal.corners = clone(base.corners);
  state.cal.wallW = base.wallW; state.cal.wallH = base.wallH;
  rebuildTransform(); fitStage(); computeLightGrid();
  renderItems(); renderRefs(); drawCal(); save();
});

function drawCal() {
  if (!state.cal || !calLayer.classList.contains('on')) { calLayer.innerHTML = ''; return; }
  const pts = state.cal.corners.map(([fx, fy]) => [fx * IMG_W, fy * IMG_H]);
  calLayer.innerHTML =
    `<polygon points="${pts.map(p => p.join(',')).join(' ')}"/>` +
    pts.map((p, i) => `<circle data-i="${i}" cx="${p[0]}" cy="${p[1]}" r="${16 / stageScale}"/>`).join('');
}

let calDrag = null;
calLayer.addEventListener('pointerdown', e => {
  const c = e.target.closest('circle');
  if (!c) return;
  pushUndo();
  calDrag = +c.dataset.i;
  calLayer.setPointerCapture(e.pointerId);
});
calLayer.addEventListener('pointermove', e => {
  if (calDrag === null) return;
  const r = stage.getBoundingClientRect();
  state.cal.corners[calDrag] = [
    (e.clientX - r.left) / stageScale / IMG_W,
    (e.clientY - r.top) / stageScale / IMG_H
  ];
  rebuildTransform(); fitStage(); renderItems(); renderRefs(); drawCal();
});
calLayer.addEventListener('pointerup', () => {
  if (calDrag === null) return;
  calDrag = null;
  computeLightGrid();     // la luz se vuelve a muestrear sobre el plano nuevo
  renderItems(); save();
});

/* ============================================================
   Imágenes
   ============================================================ */

$('btnAdd').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => { addFiles(e.target.files); e.target.value = ''; });

['dragenter', 'dragover'].forEach(t => viewport.addEventListener(t, e => {
  e.preventDefault(); $('dropHint').classList.add('on');
}));
['dragleave', 'drop'].forEach(t => viewport.addEventListener(t, e => {
  e.preventDefault();
  if (t === 'dragleave' && e.relatedTarget && viewport.contains(e.relatedTarget)) return;
  $('dropHint').classList.remove('on');
}));
viewport.addEventListener('drop', e => { if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

function addFiles(files) {
  if (!curWall()) { flash('primero subí la foto de una pared'); return; }
  const list = [...files].filter(f => f.type.startsWith('image/'));
  if (!list.length) return;
  let pending = list.length;
  pushUndo();
  list.forEach(file => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const src = downscale(img, file.type);
        const imgId = uid();
        state.library[imgId] = { src, ar: img.width / img.height };
        const it = makeItem(imgId, img.width / img.height);
        state.items.push(it);
        selected = it.id;
        if (--pending === 0) { renderItems(); syncItemPanel(); save(); }
      };
      img.onerror = () => {
        flash(`no se pudo leer ${file.name}`);
        if (--pending === 0) { renderItems(); syncItemPanel(); save(); }
      };
      img.src = fr.result;
    };
    fr.onerror = () => { if (--pending === 0) { renderItems(); save(); } };
    fr.readAsDataURL(file);
  });
}

function downscale(img, type) {
  const max = 800;   // suficiente para la vista y para el PNG; el localStorage es chico
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
}

/* ============================================================
   Undo / teclado
   ============================================================ */

const snapshot = () => JSON.stringify({ items: state.items, cal: state.cal });
function pushUndo() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack = []; }
function restore(json) {
  const d = JSON.parse(json);
  state.items = d.items; state.cal = d.cal;
  if (!state.items.some(i => i.id === selected)) selected = null;
  rebuildTransform(); fitStage(); computeLightGrid();
  renderItems(); renderRefs(); drawCal(); syncItemPanel(); save();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Alt') noSnap = true;
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (typing) return;

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) { if (redoStack.length) { undoStack.push(snapshot()); restore(redoStack.pop()); } }
    else { if (undoStack.length) { redoStack.push(snapshot()); restore(undoStack.pop()); } }
    return;
  }
  const it = state.items.find(i => i.id === selected);
  if (!it) return;
  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault(); pushUndo();
    state.items = state.items.filter(i => i.id !== selected);
    selected = null; renderItems(); syncItemPanel(); save(); return;
  }
  const step = e.shiftKey ? 5 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (moves[e.key]) {
    e.preventDefault(); pushUndo();
    it.x = round(it.x + moves[e.key][0], 1);
    it.y = round(it.y + moves[e.key][1], 1);
    renderItems(); syncItemPanel(); save();
  }
});
document.addEventListener('keyup', e => { if (e.key === 'Alt') noSnap = false; });

/* ============================================================
   Persistencia y versiones
   ============================================================ */

/* vuelca el buffer de edición a la pared activa */
function syncToWall() {
  const w = curWall();
  if (!w) return;
  w.cal = state.cal; w.items = state.items; w.versions = state.versions;
}

/* saca de la biblioteca las imágenes que ya no usa ninguna pared ni versión */
function gcLibrary() {
  const used = new Set();
  const mark = items => (items || []).forEach(i => used.add(i.imgId));
  Object.values(state.walls).forEach(w => {
    mark(w.items);
    Object.values(w.versions || {}).forEach(v => mark(v.items));
  });
  Object.keys(state.library).forEach(id => { if (!used.has(id)) delete state.library[id]; });
}

let saveTimer = null;
function save() {
  syncToWall();
  refreshCache();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    gcLibrary();
    const { cal, items, versions, ...persist } = state;
    let json;
    try {
      json = JSON.stringify(persist);
      localStorage.setItem(STORE_KEY, json);
      flash('guardado');
    } catch (err) {
      flash('no entra en el navegador: borrá alguna pared o algún cuadro');
    }
    showStorage(json ? json.length : 0);
  }, 250);
}

function showStorage(bytes) {
  const kb = Math.round(bytes / 1024);
  const pct = Math.min(100, Math.round(bytes / (5 * 1024 * 1024) * 100));
  $('storageInfo').textContent = `${kb} KB guardados (${pct}% del espacio del navegador)`;
}

function flash(msg) {
  const el = $('saveState');
  el.textContent = msg;
  clearTimeout(flash.t);
  flash.t = setTimeout(() => { el.innerHTML = '&nbsp;'; }, 2400);
}

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { /* file:// sin storage */ }

  if (d && d.walls) {                       // formato con paredes
    state.walls = d.walls;
    state.order = d.order || Object.keys(d.walls);
    state.current = d.current;
    state.library = d.library || {};
  } else if (d && d.items) {                // formato viejo: una sola pared
    const w = newWallObj({ name: 'Escritorio', legacy: true, items: d.items, versions: d.versions || {} });
    if (d.cal) { w.cal = d.cal; w.calBase = clone(d.cal); }
    state.walls = { [w.id]: w };
    state.order = [w.id];
    state.current = w.id;
    state.library = d.library || {};
  }
  if (d) state.view = Object.assign(state.view, d.view || {});

  adoptWalls();
}

/* La app nacía con la foto del escritorio embebida en pared.js: esa pared vivía
   con builtin:true y src:null, leyendo la imagen del código. Ahora no hay pared
   por defecto, así que se convierte en una pared normal y su foto pasa a
   guardarse en el navegador como cualquier otra. Corrido esto una vez, pared.js
   ya no hace falta. */
let lostWalls = 0, adopted = 0;

function adoptWalls() {
  adopted = 0;
  Object.values(state.walls).forEach(w => {
    if ((w.builtin || w.legacy) && !w.src && window.PARED_IMG) {
      w.src = window.PARED_IMG;
      if (window.PARED_SIZE) { w.imgW = window.PARED_SIZE.w; w.imgH = window.PARED_SIZE.h; }
    }
    if (w.builtin || w.legacy || !w.calBase) adopted++;
    delete w.builtin; delete w.legacy;
    if (!w.calBase) w.calBase = clone(w.cal);
  });
  // una pared sin foto no se puede dibujar
  lostWalls = 0;
  Object.keys(state.walls).forEach(id => {
    if (!state.walls[id].src) { delete state.walls[id]; lostWalls++; }
  });
  state.order = state.order.filter(id => state.walls[id]);
  Object.keys(state.walls).forEach(id => { if (!state.order.includes(id)) state.order.push(id); });
  if (!state.walls[state.current]) state.current = state.order[0] || null;
}

function refreshVersions() {
  const sel = $('verSelect');
  sel.innerHTML = '';
  const names = Object.keys(state.versions);
  if (!names.length) {
    const o = document.createElement('option');
    o.textContent = '— sin versiones guardadas —'; o.value = '';
    sel.appendChild(o);
    return;
  }
  names.forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = n;
    sel.appendChild(o);
  });
}

$('btnVerSave').addEventListener('click', () => {
  const name = prompt('Nombre de la versión:', 'Versión ' + (Object.keys(state.versions).length + 1));
  if (!name) return;
  state.versions[name] = JSON.parse(snapshot());
  refreshVersions(); $('verSelect').value = name; save();
});
$('btnVerLoad').addEventListener('click', () => {
  const n = $('verSelect').value;
  if (!n || !state.versions[n]) return;
  pushUndo();
  restore(JSON.stringify(state.versions[n]));
});
$('btnVerDel').addEventListener('click', () => {
  const n = $('verSelect').value;
  if (!n || !state.versions[n]) return;
  if (!confirm(`¿Borrar la versión "${n}"?`)) return;
  delete state.versions[n];
  refreshVersions(); save();
});

$('btnClear').addEventListener('click', () => {
  if (!state.items.length) return;
  if (!confirm('¿Sacar todos los cuadros de la pared?')) return;
  pushUndo();
  state.items = []; selected = null;
  renderItems(); syncItemPanel(); save();
});

/* ============================================================
   Paredes
   ============================================================ */

/* ---------- sin ninguna pared ----------

   La app puede no tener ni una foto todavía: arranque limpio, o borraste la
   última pared. En vez de una pared falsa se muestra el placeholder, que abre
   el mismo selector de archivos que "Subir foto…". */

function showEmpty() {
  state.cal = null; state.items = []; state.versions = {};
  selected = null;
  undoStack = []; redoStack = [];
  photo.removeAttribute('src');
  stage.hidden = true;
  $('emptyState').hidden = false;
  document.body.classList.add('empty');
  $('chkCal').checked = false;
  calLayer.classList.remove('on');
  calLayer.innerHTML = '';
  layer.innerHTML = ''; guidesEl.innerHTML = ''; refsEl.innerHTML = '';
  $('wallInfo').textContent = 'ninguna pared todavía';
  refreshWalls(); refreshVersions(); syncItemPanel();
}

function showStage() {
  stage.hidden = false;
  $('emptyState').hidden = true;
  document.body.classList.remove('empty');
}

$('emptyState').addEventListener('click', () => $('wallInput').click());

function refreshWalls() {
  const sel = $('wallSelect');
  const w = curWall();
  sel.innerHTML = '';
  state.order.forEach(id => {
    const o = document.createElement('option');
    o.value = id; o.textContent = state.walls[id].name;
    sel.appendChild(o);
  });
  if (!w) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = '— ninguna pared —';
    sel.appendChild(o);
  }
  sel.value = w ? state.current : '';
  $('btnWallDel').disabled = !w;
  $('btnWallRename').disabled = !w;
  $('calHint').textContent = w
    ? 'Poné las dos esquinas de abajo sobre la línea del piso y las de arriba en el techo (o a cualquier altura que sepas). Después escribí el ancho y el alto reales de ese rectángulo.'
    : '';
}

/* carga la pared activa en el buffer y redibuja todo */
function openWall(id, done) {
  state.current = id || null;
  const w = curWall();
  if (!w) { showEmpty(); if (done) done(); return; }

  state.cal = w.cal; state.items = w.items; state.versions = w.versions;
  selected = null;
  undoStack = []; redoStack = [];

  const apply = () => {
    IMG_W = photo.naturalWidth || w.imgW;
    IMG_H = photo.naturalHeight || w.imgH;
    w.imgW = IMG_W; w.imgH = IMG_H;
    rebuildTransform();
    fitStage();
    if (!w.light) computeLightGrid();
    renderItems(); renderRefs(); drawCal();
    refreshWalls(); refreshVersions(); syncItemPanel(); refreshCache();
    if (done) done();
  };

  showStage();
  if (photo.src === w.src) apply();
  else { photo.onload = apply; photo.src = w.src; }
}

$('wallSelect').addEventListener('change', e => {
  if (!e.target.value) return;
  syncToWall();
  openWall(e.target.value, save);
});

$('btnWallNew').addEventListener('click', () => $('wallInput').click());
$('wallInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !file.type.startsWith('image/')) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const name = prompt('Nombre de la pared:', file.name.replace(/\.[^.]+$/, '')) || 'Pared';
      const max = 1600;                       // más grande no entra en el navegador
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);

      syncToWall();
      const w = newWallObj({ name, src: c.toDataURL('image/jpeg', 0.82), imgW: c.width, imgH: c.height });
      state.walls[w.id] = w;
      state.order.push(w.id);
      openWall(w.id, () => {
        $('chkCal').checked = true;
        calLayer.classList.add('on');
        drawCal(); renderItems();
        flash('marcá las esquinas y poné las medidas');
        save();
      });
    };
    img.onerror = () => flash('no se pudo leer esa imagen');
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
});

$('btnWallRename').addEventListener('click', () => {
  const w = curWall();
  if (!w) return;
  const n = prompt('Nombre de la pared:', w.name);
  if (!n) return;
  w.name = n; refreshWalls(); save();
});

$('btnWallDel').addEventListener('click', () => {
  const w = curWall();
  if (!w) return;
  if (!confirm(`¿Borrar la pared "${w.name}" con sus cuadros?`)) return;
  delete state.walls[w.id];
  state.order = state.order.filter(id => id !== w.id);
  openWall(state.order[0], save);
});

/* ============================================================
   Exportar PNG  (rasterizado con la misma homografía)
   ============================================================ */

$('btnExport').addEventListener('click', exportPNG);

function exportPNG() {
  const btn = $('btnExport');
  btn.disabled = true; btn.textContent = 'Generando…';
  setTimeout(() => {
    try { doExport(); } finally { btn.disabled = false; btn.textContent = 'Exportar PNG'; }
  }, 20);
}

function doExport() {
  if (!state.cal) return;
  const { wallW, wallH } = state.cal;
  const UW = Math.round(wallW * S), UH = Math.round(wallH * S);

  // 1. capa plana de cuadros, en unidades de pared
  const flat = document.createElement('canvas');
  flat.width = UW; flat.height = UH;
  const fc = flat.getContext('2d');
  state.items.forEach(it => drawFlatItem(fc, it));

  // 2. foto de fondo
  const out = document.createElement('canvas');
  out.width = IMG_W; out.height = IMG_H;
  const oc = out.getContext('2d');
  oc.drawImage(photo, 0, 0, IMG_W, IMG_H);

  // 3. warp inverso sobre el bounding box del cuadrilátero
  const dstPts = state.cal.corners.map(([fx, fy]) => [fx * IMG_W, fy * IMG_H]);
  const xs = dstPts.map(p => p[0]), ys = dstPts.map(p => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 40);
  const x1 = Math.min(IMG_W, Math.ceil(Math.max(...xs)) + 40);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 40);
  const y1 = Math.min(IMG_H, Math.ceil(Math.max(...ys)) + 40);
  const bw = x1 - x0, bh = y1 - y0;
  if (bw <= 0 || bh <= 0) return;

  const src = fc.getImageData(0, 0, UW, UH).data;
  const dst = oc.getImageData(x0, y0, bw, bh);
  const d = dst.data;
  const hi = Hinv;

  for (let py = 0; py < bh; py++) {
    const Y = y0 + py + 0.5;
    for (let px = 0; px < bw; px++) {
      const X = x0 + px + 0.5;
      const w = hi[2][0] * X + hi[2][1] * Y + hi[2][2];
      const u = (hi[0][0] * X + hi[0][1] * Y + hi[0][2]) / w;
      const v = (hi[1][0] * X + hi[1][1] * Y + hi[1][2]) / w;
      if (u < 0 || v < 0 || u >= UW - 1 || v >= UH - 1) continue;
      const iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv;
      const i00 = (iv * UW + iu) * 4, i10 = i00 + 4, i01 = i00 + UW * 4, i11 = i01 + 4;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const a = (src[i00 + 3] * w00 + src[i10 + 3] * w10 + src[i01 + 3] * w01 + src[i11 + 3] * w11) / 255;
      if (a < 0.004) continue;
      const o = (py * bw + px) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const s = src[i00 + ch] * w00 + src[i10 + ch] * w10 + src[i01 + ch] * w01 + src[i11 + ch] * w11;
        d[o + ch] = s * a + d[o + ch] * (1 - a);
      }
    }
  }
  oc.putImageData(dst, x0, y0);

  const a = document.createElement('a');
  a.download = 'gallery-wall.png';
  a.href = out.toDataURL('image/png');
  a.click();
}

function drawFlatItem(ctx, it) {
  const [ow, oh] = outerSize(it);
  const [ux, uy] = toUnits(it.x, it.y);
  const L = ux - ow * S / 2, T = uy - oh * S / 2, W = ow * S, Hh = oh * S;
  const f = frameById(it.frame);
  const fw = it.frameW * S, mt = it.mat * S;

  // el cuadro se dibuja plano en un canvas propio y después se pega
  // con el filtro de luz, así el brillo alcanza marco, passepartout e imagen
  const pad = Math.ceil(3 * S);
  const tmp = document.createElement('canvas');
  tmp.width = Math.ceil(W) + pad * 2; tmp.height = Math.ceil(Hh) + pad * 2;
  const tc = tmp.getContext('2d');
  const l = pad, t = pad;

  tc.save();
  tc.shadowColor = 'rgba(0,0,0,.40)';
  tc.shadowOffsetX = 0.35 * S; tc.shadowOffsetY = 0.5 * S; tc.shadowBlur = 0.9 * S;
  tc.fillStyle = f.color || (it.mat > 0 ? it.matColor : '#111');
  tc.fillRect(l, t, W, Hh);
  tc.restore();

  if (f.color && fw > 0) {
    tc.strokeStyle = f.edge; tc.lineWidth = Math.max(1, 0.12 * S);
    tc.strokeRect(l + tc.lineWidth / 2, t + tc.lineWidth / 2, W - tc.lineWidth, Hh - tc.lineWidth);
  }
  if (it.mat > 0) {
    tc.fillStyle = it.matColor;
    tc.fillRect(l + fw, t + fw, W - fw * 2, Hh - fw * 2);
  }
  const im = imgCache[it.imgId];
  if (im && im.complete && im.naturalWidth) {
    const ix = l + fw + mt, iy = t + fw + mt;
    const iwp = W - (fw + mt) * 2, ihp = Hh - (fw + mt) * 2;
    const sa = im.naturalWidth / im.naturalHeight, da = iwp / ihp;   // object-fit: cover
    let sw = im.naturalWidth, sh = im.naturalHeight, sx = 0, sy = 0;
    if (sa > da) { sw = im.naturalHeight * da; sx = (im.naturalWidth - sw) / 2; }
    else { sh = im.naturalWidth / da; sy = (im.naturalHeight - sh) / 2; }
    tc.drawImage(im, sx, sy, sw, sh, ix, iy, iwp, ihp);
  }

  ctx.save();
  if ('filter' in ctx) ctx.filter = lightFilter(it.x, it.y);
  ctx.drawImage(tmp, L - pad, T - pad);
  ctx.restore();
}

/* caché de <img> para el exportador */
const imgCache = {};
function refreshCache() {
  Object.keys(state.library).forEach(id => {
    if (imgCache[id]) return;
    const im = new Image();
    im.src = state.library[id].src;
    imgCache[id] = im;
  });
}

/* ============================================================
   Copia de seguridad

   Todo vive en el localStorage de este navegador, que no se sincroniza con
   nada y se va con los datos del sitio. El .json es la única copia real, y
   además es el puente entre file:// y la URL publicada: son dos orígenes
   distintos y no comparten nada.
   ============================================================ */

function backupJSON() {
  syncToWall();
  const { cal, items, versions, ...persist } = state;
  return JSON.stringify({ app: 'gallerywall', v: 1, saved: new Date().toISOString(), state: persist });
}

$('btnBackupExport').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([backupJSON()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `gallery-wall-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  flash('copia descargada');
});

$('btnBackupImport').addEventListener('click', () => $('backupInput').click());
$('backupInput').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    let d = null;
    try { d = JSON.parse(fr.result); } catch (err) { /* abajo */ }
    // acepta la copia nueva y también un volcado crudo del localStorage
    const inc = d && d.state && d.state.walls ? d.state : (d && d.walls ? d : null);
    if (!inc) { flash('ese archivo no es una copia de Gallery wall'); return; }
    const paredes = Object.keys(inc.walls).length;
    if (!confirm(`La copia trae ${paredes} pared(es). Reemplaza todo lo que tenés guardado ` +
                 `en este navegador ahora mismo. ¿Seguir?`)) return;

    state.walls = inc.walls;
    state.order = inc.order || Object.keys(inc.walls);
    state.current = inc.current;
    state.library = inc.library || {};
    state.view = Object.assign(state.view, inc.view || {});
    state.cal = null; state.items = []; state.versions = {};
    adoptWalls();
    syncViewControls();
    // save() avisa "guardado" con su propio retardo; el aviso de la copia va después
    openWall(state.current, () => { save(); setTimeout(() => flash(`copia importada · ${paredes} pared(es)`), 400); });
  };
  fr.onerror = () => flash('no se pudo leer el archivo');
  fr.readAsText(file);
});

/* ============================================================
   Arranque
   ============================================================ */

function syncViewControls() {
  $('chkGuides').checked = state.view.guides;
  $('chkMuseum').checked = state.view.museum;
  $('chkGrid').checked = state.view.grid;
  $('inLight').value = state.view.light;
}

function boot() {
  load();
  syncViewControls();
  openWall(state.current, () => {
    // la conversión de la pared vieja hay que bajarla a disco en el arranque:
    // si no, vive solo en memoria y se pierde al cerrar la pestaña
    if (adopted) save();
    showStorage(JSON.stringify(state.walls).length);
    if (lostWalls) flash(`${lostWalls} pared(es) sin foto quedaron afuera`);
  });
}

boot();
window.addEventListener('resize', () => { if (!curWall()) return; fitStage(); drawCal(); });
