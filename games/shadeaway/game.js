/* Shadeaway — game shell: 3D render, input, audio, flow. Rules live in logic.js. */
'use strict';
var SA = window.SA, LEVELS = window.SA_LEVELS;
var $ = function (id) { return document.getElementById(id); };
var cv = $('c'), ctx = cv.getContext('2d');
var W = 0, H = 0, DPR = 1;

var PAL = [
  ['#a8c4ff', '#3a5a9e', '#e8f0ff'],
  ['#7ad4ff', '#1d6a8c', '#d8f6ff'],
  ['#b89bff', '#4f3594', '#ece4ff'],
  ['#ffb454', '#8a5313', '#fff0d2'],
  ['#5fe0a8', '#1b7552', '#d6fff0'],
  ['#ff8a9a', '#8f2440', '#ffe0e6'],
  ['#d4f06a', '#5f7414', '#f6ffd6'],
  ['#9fe8ff', '#2d7187', '#ecfbff']
];

// ---------------- save
var SAVE_KEY = 'shadeaway-v1';
var save = (function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })();
save.unlocked = save.unlocked || 1; save.best = save.best || {}; save.stars = save.stars || {};
if (save.sound == null) save.sound = true; if (save.haptics == null) save.haptics = true;
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// ---------------- audio
var AC = null, master = null, verb = null, noiseBuf = null;
function audio() {
  if (AC) { if (AC.state === 'suspended' && save.sound) AC.resume(); return AC; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; }
  master = AC.createGain(); master.gain.value = save.sound ? 0.9 : 0; master.connect(AC.destination);
  var d = AC.createDelay(); d.delayTime.value = 0.18; var fb = AC.createGain(); fb.gain.value = 0.28;
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  verb = AC.createGain(); verb.gain.value = 0.32; verb.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(master);
  return AC;
}
function out(node, wet) { node.connect(master); if (wet) { var g = AC.createGain(); g.gain.value = wet; node.connect(g); g.connect(verb); } }
function tone(f, t0, dur, type, vol, wet, f2) {
  if (!AC) return; var o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); out(g, wet); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(t0, dur, fType, f, q, vol, f2, wet) {
  if (!AC) return;
  if (!noiseBuf) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 1.2, AC.sampleRate); var a = noiseBuf.getChannelData(0); for (var i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  var s = AC.createBufferSource(); s.buffer = noiseBuf; var bq = AC.createBiquadFilter(); bq.type = fType; bq.frequency.setValueAtTime(f, t0); bq.Q.value = q;
  if (f2) bq.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t0 + dur);
  var g = AC.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(bq); bq.connect(g); out(g, wet); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
var SFX = {
  tap: function () { if (!audio()) return; tone(920, AC.currentTime, 0.05, 'triangle', 0.05); },
  whoosh: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.42, 'bandpass', 280, 1.4, 0.32, 3400, 0.35); tone(180, t, 0.28, 'sine', 0.07, 0, 640); },
  chime: function (n) { if (!audio()) return; var t = AC.currentTime, base = 523.25;
    tone(base * Math.pow(2, (n % 5) / 12), t, 0.55, 'sine', 0.1, 0.55);
    tone(base * 1.5 * Math.pow(2, (n % 5) / 12), t + 0.04, 0.4, 'triangle', 0.04, 0.5); },
  thud: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.14, 'lowpass', 180, 1, 0.45); tone(70, t, 0.18, 'sine', 0.28, 0, 40); },
  frost: function () { if (!audio()) return; var t = AC.currentTime; noise(t, 0.1, 'highpass', 5000, 1, 0.12); tone(1400, t, 0.12, 'sine', 0.04); },
  win: function () { if (!audio()) return; var t = AC.currentTime;
    [0, 4, 7, 12, 16, 19, 24].forEach(function (s, i) { tone(392 * Math.pow(2, s / 12), t + i * 0.08, 1.3 - i * 0.08, 'sine', 0.09, 0.65); }); },
  undo: function () { if (!audio()) return; tone(660, AC.currentTime, 0.1, 'triangle', 0.06, 0, 420); },
  hint: function () { if (!audio()) return; var t = AC.currentTime; tone(988, t, 0.22, 'sine', 0.06, 0.55); tone(1319, t + 0.08, 0.28, 'sine', 0.05, 0.55); }
};
function hap(ms) { if (save.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

// ---------------- game state
var LV = 0, L = null, S = null, hist = [], mode = 'title', levelDone = false;
var cam = { yaw: 0.55, pitch: 0.42, vy: 0, vp: 0, scale: 1 };
var press = null, drag = null, hover = -1, hintId = -1, hintT = 0;
var flyers = [], parts = [], motes = [], shake = 0, squash = {}, now = 0, lastT = 0;
var starsBg = [];
var SAFE = { t: 0, b: 0 };

function startLevel(i) {
  LV = i; L = SA.prep(LEVELS[i]); S = SA.init(L); hist = []; levelDone = false;
  cam.yaw = 0.55; cam.pitch = 0.42; cam.vy = 0; cam.vp = 0;
  flyers = []; parts = []; squash = {}; hintId = -1; hover = -1; shake = 0;
  layout(); syncHud(); setMode('play');
  if (LEVELS[i].tip) setTimeout(function () { if (LV === i && mode === 'play') toast(LEVELS[i].tip, 4200); }, 600);
}

function heartsStr(n) {
  var s = '';
  for (var i = 0; i < L.lives; i++) s += i < n ? '♥' : '♡';
  return s;
}
function syncHud() {
  if (!L || !S) return;
  $('lvNum').textContent = (LV + 1) + ' ·';
  $('lvName').textContent = LEVELS[LV].name;
  $('lifePill').textContent = heartsStr(S.lives);
  $('bUndo').disabled = !hist.length;
}

function measureSafe() {
  var d = document.createElement('div');
  d.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top,0px);width:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(d); var r = d.getBoundingClientRect(); SAFE.t = r.height || 0; SAFE.b = r.width || 0; d.remove();
}
function layout() {
  var r = cv.getBoundingClientRect(); W = r.width || innerWidth; H = r.height || innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  measureSafe();
  if (!L) return;
  var maxR = 0;
  L.cells.forEach(function (c) {
    maxR = Math.max(maxR, Math.abs(c.x), Math.abs(c.y), Math.abs(c.z));
  });
  var top = 58 + SAFE.t, bot = 80 + SAFE.b;
  var ah = H - top - bot;
  cam.scale = Math.min(W, ah) / (maxR * 2 + 3.2) * 0.92;
}

// ---------------- 3D math
function rotY(p, a) {
  var c = Math.cos(a), s = Math.sin(a);
  return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
}
function rotX(p, a) {
  var c = Math.cos(a), s = Math.sin(a);
  return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
}
function project(p) {
  var q = rotY(p, cam.yaw);
  q = rotX(q, cam.pitch);
  var fov = 6.5, z = q[2] + fov;
  var s = cam.scale * (fov / Math.max(0.5, z));
  return { x: W * 0.5 + q[0] * s, y: (SAFE.t + 58 + (H - SAFE.t - SAFE.b - 58 - 80) * 0.5) + q[1] * s, z: q[2], s: s };
}

var FACE_N = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
var FACE_LABEL = ['x','-x','y','-y','z','-z'];

function cubeWorld(c, half) {
  half = half || 0.42;
  var cx = c.x, cy = c.y, cz = c.z;
  // 8 corners
  var corners = [];
  for (var i = 0; i < 8; i++) {
    corners.push([
      cx + ((i & 1) ? half : -half),
      cy + ((i & 2) ? half : -half),
      cz + ((i & 4) ? half : -half)
    ]);
  }
  // 6 faces as corner index quads (outward)
  var faces = [
    [1,3,7,5], // +x
    [0,4,6,2], // -x
    [2,3,7,6], // +y
    [0,1,5,4], // -y
    [4,5,7,6], // +z
    [0,2,3,1]  // -z
  ];
  return { corners: corners, faces: faces };
}

function lightFace(n) {
  // soft key + fill after camera rotation of normal
  var n2 = rotY(n, cam.yaw); n2 = rotX(n2, cam.pitch);
  var key = Math.max(0, n2[0] * 0.35 + n2[1] * 0.55 + n2[2] * 0.25);
  var fill = 0.28;
  return Math.min(1, fill + key * 0.85);
}

function hexLerp(a, b, t) {
  function p(h) { return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
  var A = p(a), B = p(b);
  var r = (A[0] + (B[0]-A[0])*t)|0, g = (A[1] + (B[1]-A[1])*t)|0, bl = (A[2] + (B[2]-A[2])*t)|0;
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

function shadeCol(base, lit) {
  return hexLerp('#0a1020', base, 0.35 + lit * 0.65);
}

// ---------------- draw
function seedBg() {
  starsBg = [];
  for (var i = 0; i < 60; i++) starsBg.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, a: Math.random() * 0.5 + 0.15 });
}
function drawBg() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c1230'); g.addColorStop(0.55, '#070a14'); g.addColorStop(1, '#05070f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  var rg = ctx.createRadialGradient(W * 0.5, H * 0.28, 0, W * 0.5, H * 0.28, Math.max(W, H) * 0.55);
  rg.addColorStop(0, 'rgba(168,196,255,0.12)'); rg.addColorStop(1, 'transparent');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < starsBg.length; i++) {
    var s = starsBg[i];
    ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(now * 1.5 + i));
    ctx.fillStyle = '#e8f0ff';
    ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawArrow2d(px, py, dx, dy, size, col) {
  var len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  var ax = px + dx * size * 0.15, ay = py + dy * size * 0.15;
  var bx = px + dx * size * 0.55, by = py + dy * size * 0.55;
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, size * 0.08); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - dx * size * 0.28 - dy * size * 0.18, by - dy * size * 0.28 + dx * size * 0.18);
  ctx.lineTo(bx - dx * size * 0.28 + dy * size * 0.18, by - dy * size * 0.28 - dx * size * 0.18);
  ctx.closePath(); ctx.fill();
}

function drawCube(cell, alive, opts) {
  opts = opts || {};
  var half = 0.42 * (opts.squash || 1);
  var geo = cubeWorld(cell, half);
  var projC = [];
  for (var i = 0; i < 8; i++) projC.push(project(geo.corners[i]));
  var center = project([cell.x, cell.y, cell.z]);
  var faces = [];
  for (var f = 0; f < 6; f++) {
    var idx = geo.faces[f];
    var pts = idx.map(function (k) { return projC[k]; });
    var z = (pts[0].z + pts[1].z + pts[2].z + pts[3].z) / 4;
    var lit = lightFace(FACE_N[f]);
    faces.push({ f: f, pts: pts, z: z, lit: lit, isArrow: FACE_LABEL[f] === cell.d });
  }
  faces.sort(function (a, b) { return a.z - b.z; });
  var pal = PAL[cell.c % PAL.length];
  var alpha = opts.alpha == null ? 1 : opts.alpha;
  ctx.save();
  if (opts.glow) {
    ctx.shadowColor = pal[0]; ctx.shadowBlur = 18 * opts.glow;
  }
  for (var j = 0; j < faces.length; j++) {
    var face = faces[j];
    if (face.lit < 0.05 && face.z > center.z) continue;
    var col = shadeCol(pal[0], face.lit);
    if (opts.frost) col = hexLerp(col, '#cfe8ff', 0.45);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(face.pts[0].x, face.pts[0].y);
    for (var k = 1; k < 4; k++) ctx.lineTo(face.pts[k].x, face.pts[k].y);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,12,28,' + (0.55 * alpha) + ')';
    ctx.lineWidth = Math.max(1, center.s * 0.015);
    ctx.stroke();
    // rim light on lit faces
    if (face.lit > 0.55) {
      ctx.globalAlpha = alpha * (face.lit - 0.5) * 0.5;
      ctx.strokeStyle = pal[2];
      ctx.lineWidth = Math.max(1, center.s * 0.02);
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    if (face.isArrow && alive) {
      // arrow on face center
      var fx = 0, fy = 0;
      for (k = 0; k < 4; k++) { fx += face.pts[k].x; fy += face.pts[k].y; }
      fx /= 4; fy /= 4;
      // project a tip along face normal in world then screen for direction
      var tipW = [cell.x + FACE_N[face.f][0] * 0.35, cell.y + FACE_N[face.f][1] * 0.35, cell.z + FACE_N[face.f][2] * 0.35];
      var tip = project(tipW);
      var size = center.s * 0.55;
      drawArrow2d(fx, fy, tip.x - fx, tip.y - fy, size, face.lit > 0.4 ? pal[2] : pal[0]);
    }
  }
  // frost badge
  if (opts.frost > 0) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(200,230,255,0.92)';
    ctx.font = '700 ' + Math.max(10, center.s * 0.28) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(opts.frost), center.x, center.y);
  }
  ctx.restore();
  return center;
}

function drawScene() {
  drawBg();
  if (!L || mode === 'title') {
    // idle demo lattice on title
    if (mode === 'title') drawTitleLattice();
    return;
  }
  ctx.save();
  if (shake > 0) {
    ctx.translate((Math.random() - 0.5) * shake * 8, (Math.random() - 0.5) * shake * 8);
  }

  // gather drawables: live cells + flyers
  var items = [];
  for (var i = 0; i < L.N; i++) {
    if (!S.alive[i]) continue;
    var c = L.cells[i];
    var p = project([c.x, c.y, c.z]);
    items.push({ type: 'cell', i: i, z: p.z, cell: c });
  }
  for (var f = 0; f < flyers.length; f++) {
    var fl = flyers[f];
    var fp = project([fl.x, fl.y, fl.z]);
    items.push({ type: 'flyer', fl: fl, z: fp.z });
  }
  items.sort(function (a, b) { return a.z - b.z; });

  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    if (it.type === 'cell') {
      var frost = SA.frostLeft(L, S, it.i);
      var sq = squash[it.i] || 1;
      var glow = (hintId === it.i) ? (0.6 + 0.4 * Math.sin(now * 8)) : (hover === it.i ? 0.35 : 0);
      drawCube(it.cell, true, { frost: frost, squash: sq, glow: glow });
    } else {
      drawCube({ x: it.fl.x, y: it.fl.y, z: it.fl.z, d: it.fl.d, c: it.fl.c }, false, { alpha: it.fl.a, squash: 0.85 });
    }
  }

  // particles / motes
  for (var p = 0; p < parts.length; p++) {
    var pt = parts[p];
    var pp = project([pt.x, pt.y, pt.z]);
    ctx.globalAlpha = pt.a;
    ctx.fillStyle = pt.col;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1, pt.r * pp.s * 0.04), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawTitleLattice() {
  var demo = [
    { x: 0, y: 0, z: 0, d: 'x', c: 0 },
    { x: 1, y: 0, z: 0, d: 'y', c: 1 },
    { x: 0, y: 1, z: 0, d: '-x', c: 2 },
    { x: 1, y: 1, z: 0, d: 'z', c: 3 },
    { x: 0, y: 0, z: 1, d: 'z', c: 4 },
    { x: 1, y: 1, z: 1, d: 'x', c: 5 }
  ];
  cam.yaw = 0.7 + Math.sin(now * 0.25) * 0.35;
  cam.pitch = 0.4 + Math.cos(now * 0.2) * 0.12;
  cam.scale = Math.min(W, H) * 0.11;
  var items = demo.map(function (c) { return { cell: c, z: project([c.x, c.y, c.z]).z }; });
  items.sort(function (a, b) { return a.z - b.z; });
  items.forEach(function (it) { drawCube(it.cell, true, { glow: 0.2 }); });
}

// ---------------- interaction
function clientPos(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function pickCell(sx, sy) {
  if (!L || !S) return -1;
  var best = -1, bestD = 1e9;
  for (var i = 0; i < L.N; i++) {
    if (!S.alive[i]) continue;
    var p = project([L.cells[i].x, L.cells[i].y, L.cells[i].z]);
    var hitR = Math.max(28, p.s * 0.55); // generous
    var d = Math.hypot(sx - p.x, sy - p.y);
    if (d < hitR && d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function pushHist() {
  hist.push(SA.clone(S));
  if (hist.length > 80) hist.shift();
}

function spawnFlyer(i) {
  var c = L.cells[i];
  var dir = c.dir;
  flyers.push({
    x: c.x, y: c.y, z: c.z,
    vx: dir[0] * 4.2, vy: dir[1] * 4.2, vz: dir[2] * 4.2,
    d: c.d, c: c.c, a: 1, life: 0.55
  });
  for (var k = 0; k < 14; k++) {
    parts.push({
      x: c.x, y: c.y, z: c.z,
      vx: dir[0] * (1 + Math.random()) + (Math.random() - 0.5),
      vy: dir[1] * (1 + Math.random()) + (Math.random() - 0.5),
      vz: dir[2] * (1 + Math.random()) + (Math.random() - 0.5),
      r: 1.5 + Math.random() * 2, a: 1, life: 0.5 + Math.random() * 0.4,
      col: PAL[c.c % PAL.length][2]
    });
  }
}

function tryLaunch(i) {
  if (levelDone || mode !== 'play') return;
  audio();
  squash[i] = 0.82;
  var frost = SA.frostLeft(L, S, i);
  if (frost > 0) {
    SFX.frost(); hap(12);
    toast('Frost thaws after ' + frost + ' more clear' + (frost > 1 ? 's' : ''), 1800);
    shake = 0.35;
    return;
  }
  pushHist();
  var before = S.lives;
  var r = SA.launch(L, S, i);
  syncHud();
  if (r.ok) {
    spawnFlyer(i);
    SFX.whoosh(); SFX.chime(S.cleared);
    hap(10);
    hintId = -1;
    if (SA.won(L, S)) {
      levelDone = true;
      setTimeout(onWin, 480);
    } else if (SA.checkStuck(L, S)) {
      setTimeout(function () { if (mode === 'play' && SA.checkStuck(L, S)) setMode('stuck'); }, 400);
    }
  } else if (r.reason === 'blocked') {
    SFX.thud(); hap([20, 40, 20]);
    shake = 1;
    toast('Path blocked', 1200);
    if (S.failed) setTimeout(function () { if (S.failed) setMode('fail'); }, 350);
  }
}

function onWin() {
  SFX.win(); hap(30);
  var livesLeft = S.lives;
  var stars = livesLeft >= L.lives ? 3 : livesLeft >= Math.ceil(L.lives * 0.66) ? 2 : 1;
  save.best[LV] = Math.max(save.best[LV] || 0, livesLeft);
  save.stars[LV] = Math.max(save.stars[LV] || 0, stars);
  if (save.unlocked < LV + 2) save.unlocked = Math.min(LEVELS.length, LV + 2);
  writeSave();
  $('winStars').textContent = '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars);
  $('winStat').textContent = S.moves + ' peels · ' + livesLeft + ' life' + (livesLeft === 1 ? '' : 's') + ' left';
  $('bNext').style.display = LV + 1 < LEVELS.length ? '' : 'none';
  setMode('win');
}

function undo() {
  if (!hist.length) return;
  S = hist.pop();
  flyers = []; hintId = -1; levelDone = false;
  SFX.undo(); syncHud();
  if (mode === 'fail' || mode === 'stuck') setMode('play');
}

function doHint() {
  audio();
  // Prefer a move on a solution path
  var sol = SA.solve(L, S, 2e5);
  var id = -1;
  if (sol.path && sol.path.length) id = sol.path[0];
  else {
    var opts = SA.launchable(L, S);
    if (opts.length) id = opts[0];
  }
  if (id < 0) { toast('No clear peel right now — undo or reset', 2200); return; }
  hintId = id; hintT = now + 2.5;
  SFX.hint(); hap(8);
  toast('This cube can drift', 1600);
  if (mode === 'fail' || mode === 'stuck') setMode('play');
}

function restart() {
  SFX.tap(); startLevel(LV);
}

// ---------------- modes / UI
function setMode(m) {
  mode = m;
  document.body.setAttribute('data-mode', m === 'stuck' ? 'play' : m);
  ['title', 'how', 'levels', 'win', 'fail', 'stuck', 'pause'].forEach(function (id) {
    var el = $(id); if (!el) return;
    el.classList.toggle('hidden', id !== m);
  });
  if (m === 'play') syncHud();
}

function toast(msg, ms) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.classList.remove('show'); }, ms || 2000);
}

function buildLevelGrid() {
  var g = $('lvlGrid'); g.innerHTML = '';
  LEVELS.forEach(function (def, i) {
    var b = document.createElement('button');
    b.textContent = String(i + 1);
    var st = save.stars[i];
    if (st) { var sm = document.createElement('small'); sm.textContent = '★'.repeat(st); b.appendChild(sm); b.classList.add('done'); }
    if (i === LV) b.classList.add('cur');
    if (i >= save.unlocked) b.disabled = true;
    b.addEventListener('click', function () { SFX.tap(); startLevel(i); });
    g.appendChild(b);
  });
}

function on(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }

function bind() {
  on('bPlay', function () { SFX.tap(); audio(); startLevel(Math.min(save.unlocked - 1, LEVELS.length - 1)); });
  on('bLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bHow', function () { SFX.tap(); setMode('how'); });
  on('bHowOk', function () { SFX.tap(); setMode(mode === 'how' && document.body.dataset.prev === 'pause' ? 'pause' : 'title'); });
  on('bLevelsBack', function () { SFX.tap(); setMode('title'); });
  on('bPause', function () { SFX.tap(); setMode('pause'); });
  on('bResume', function () { SFX.tap(); setMode('play'); });
  on('bPauseHow', function () { SFX.tap(); setMode('how'); });
  on('bPauseLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bUndo', function () { undo(); });
  on('bHint', function () { doHint(); });
  on('bRestart', function () { restart(); });
  on('bNext', function () { SFX.tap(); if (LV + 1 < LEVELS.length) startLevel(LV + 1); else { buildLevelGrid(); setMode('levels'); } });
  on('bWinRetry', function () { SFX.tap(); startLevel(LV); });
  on('bWinLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bFailUndo', function () { undo(); });
  on('bFailHint', function () { doHint(); });
  on('bFailRetry', function () { SFX.tap(); startLevel(LV); });
  on('bFailLevels', function () { SFX.tap(); buildLevelGrid(); setMode('levels'); });
  on('bStuckUndo', function () { undo(); });
  on('bStuckHint', function () { doHint(); });
  on('bStuckRetry', function () { SFX.tap(); startLevel(LV); });
  on('tSound', function () { save.sound = !save.sound; writeSave(); if (master) master.gain.value = save.sound ? 0.9 : 0; syncToggles(); SFX.tap(); });
  on('tHaptic', function () { save.haptics = !save.haptics; writeSave(); syncToggles(); hap(10); });

  // pointer only (no duplicate touchstart)
  cv.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function syncToggles() {
  $('tSound').textContent = save.sound ? 'On' : 'Off';
  $('tHaptic').textContent = save.haptics ? 'On' : 'Off';
}

function onPointerDown(e) {
  if (mode !== 'play' && mode !== 'title') return;
  if (mode === 'play' && (e.target.closest && (e.target.closest('#hud') || e.target.closest('#dock') || e.target.closest('#arcadeBack')))) return;
  e.preventDefault();
  audio();
  var p = clientPos(e);
  press = { x: p.x, y: p.y, t: now, id: e.pointerId, moved: false, pick: mode === 'play' ? pickCell(p.x, p.y) : -1 };
  drag = { x: p.x, y: p.y };
  cam.vy = 0; cam.vp = 0;
  if (press.pick >= 0) squash[press.pick] = 0.88;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
}

function onPointerMove(e) {
  if (!press || e.pointerId !== press.id) return;
  var p = clientPos(e);
  var dx = p.x - drag.x, dy = p.y - drag.y;
  if (Math.hypot(p.x - press.x, p.y - press.y) > 10) press.moved = true;
  drag = { x: p.x, y: p.y };
  if (press.moved || press.pick < 0) {
    cam.yaw += dx * 0.006;
    cam.pitch = Math.max(-1.1, Math.min(1.1, cam.pitch + dy * 0.005));
    cam.vy = dx * 0.018;
    cam.vp = dy * 0.014;
  }
  if (mode === 'play') hover = pickCell(p.x, p.y);
}

function onPointerUp(e) {
  if (!press || (e.pointerId != null && e.pointerId !== press.id)) return;
  var p = clientPos(e);
  var wasTap = !press.moved && (now - press.t) < 0.45;
  var pick = press.pick;
  if (wasTap && mode === 'play') {
    if (pick < 0) pick = pickCell(p.x, p.y);
    if (pick >= 0) tryLaunch(pick);
  }
  press = null; drag = null;
}

// ---------------- frame
function frame(t) {
  now = t * 0.001;
  var dt = Math.min(0.05, now - (lastT || now)); lastT = now;

  if (!press) {
    cam.yaw += cam.vy * dt;
    cam.pitch = Math.max(-1.1, Math.min(1.1, cam.pitch + cam.vp * dt));
    cam.vy *= Math.pow(0.04, dt);
    cam.vp *= Math.pow(0.04, dt);
    if (Math.abs(cam.vy) < 0.001) cam.vy = 0;
    if (Math.abs(cam.vp) < 0.001) cam.vp = 0;
  }
  if (shake > 0) shake = Math.max(0, shake - dt * 3.5);
  if (hintId >= 0 && now > hintT) hintId = -1;

  Object.keys(squash).forEach(function (k) {
    squash[k] += (1 - squash[k]) * Math.min(1, dt * 12);
    if (Math.abs(squash[k] - 1) < 0.01) delete squash[k];
  });

  for (var i = flyers.length - 1; i >= 0; i--) {
    var fl = flyers[i];
    fl.x += fl.vx * dt; fl.y += fl.vy * dt; fl.z += fl.vz * dt;
    fl.life -= dt; fl.a = Math.max(0, fl.life / 0.55);
    if (fl.life <= 0) flyers.splice(i, 1);
  }
  for (var j = parts.length - 1; j >= 0; j--) {
    var pt = parts[j];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
    pt.life -= dt; pt.a = Math.max(0, pt.life);
    if (pt.life <= 0) parts.splice(j, 1);
  }

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScene();
  requestAnimationFrame(frame);
}

function arcadeChip() {
  if (!/\bfrom=arcade\b/.test(location.search || '')) return;
  document.documentElement.classList.add('arcade');
  var a = document.createElement('a'); a.href = '../../?from=game'; a.id = 'arcadeBack';
  a.innerHTML = '<span aria-hidden="true">←</span><span class="lbl">&nbsp;Library</span>';
  a.setAttribute('aria-label', 'Back to Night Arcade library');
  document.body.appendChild(a);
}

if ('serviceWorker' in navigator) window.addEventListener('load', function () {
  navigator.serviceWorker.register('./sw.js').catch(function () {});
});
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', function () {
  if (AC) { if (document.hidden) AC.suspend(); else if (save.sound) AC.resume(); }
});

seedBg(); layout(); bind(); syncToggles(); arcadeChip(); setMode('title'); requestAnimationFrame(frame);

window.Shade = {
  SA: SA, LEVELS: LEVELS, save: save, startLevel: startLevel, cam: cam,
  get L() { return L; }, get S() { return S; }, get mode() { return mode; },
  unlockAll: function () { save.unlocked = LEVELS.length; writeSave(); buildLevelGrid(); }
};
