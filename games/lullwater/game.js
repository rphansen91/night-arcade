/* Lullwater — a moonlit piano-tile rhythm game for Night Arcade.
   Zero dependencies. Canvas 2D + Web Audio. Input: pointer events only. */
(function () {
'use strict';
var SONGS = LW.SONGS, stageMul = LW.stageMul;
var $ = function (id) { return document.getElementById(id); };
var cv = $('c'), g = cv.getContext('2d');
var W = 390, H = 844, DPR = 1, FX = 0, FW = 390, LANEW = 97, HITY = 660, ROWH = 190, TOPSAFE = 60;
var PASS_GAP = 2;          // empty rows between passes (the checkpoint breath)
var MAXP = 420;

// ---------- palettes per stage (★1–3, ♛1–3, endless) ----------
var PALS = [
  { top: '#050817', mid: '#0d1636', hor: '#24346a', water: '#071023', acc: '#9cc0ff', acc2: '#d9e6ff', fog: '#3a4f8f', name: 'Moonrise' },
  { top: '#08051a', mid: '#1b1040', hor: '#43307a', water: '#0d0822', acc: '#c7a4ff', acc2: '#efe2ff', fog: '#5d4699', name: 'Violet hour' },
  { top: '#03100f', mid: '#082a30', hor: '#1a5c62', water: '#041719', acc: '#7ae8d6', acc2: '#d6fff8', fog: '#2d7f80', name: 'Tide glass' },
  { top: '#10050f', mid: '#2c0f2b', hor: '#6b2a55', water: '#140612', acc: '#ffa3cf', acc2: '#ffe3f1', fog: '#8b3f71', name: 'Rose water' },
  { top: '#0d0805', mid: '#2a1a0c', hor: '#6b4720', water: '#120b04', acc: '#ffd27a', acc2: '#fff1cf', fog: '#8a6230', name: 'Ember shore' },
  { top: '#030d0a', mid: '#0a2a20', hor: '#1d5e45', water: '#03140e', acc: '#93ffbf', acc2: '#e2fff0', fog: '#2e8a63', name: 'Aurora' },
  { top: '#04060f', mid: '#101a33', hor: '#2f4f80', water: '#050a17', acc: '#d8f0ff', acc2: '#ffffff', fog: '#4e74a8', name: 'White night' }
];
function hex(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255]; }
PALS.forEach(function (p) { ['top', 'mid', 'hor', 'water', 'acc', 'acc2', 'fog'].forEach(function (k) { p['_' + k] = hex(p[k]); }); });
var pal = {}; ['top', 'mid', 'hor', 'water', 'acc', 'acc2', 'fog'].forEach(function (k) { pal[k] = PALS[0]['_' + k].slice(); });
var palTarget = 0;
function rgb(a, al) { return al == null ? 'rgb(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ')' : 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + al + ')'; }
function stepPal(dt) { var P = PALS[palTarget], k = 1 - Math.exp(-dt * 1.6); for (var key in pal) for (var i = 0; i < 3; i++) pal[key][i] += (P['_' + key][i] - pal[key][i]) * k; }

// ---------- save ----------
var SAVE_KEY = 'lullwater-v1';
var save = (function () { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })();
save.sound = save.sound !== false; save.haptics = save.haptics !== false; save.songs = save.songs || {};
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
function songRec(id) { return save.songs[id] || (save.songs[id] = { best: 0, stage: 0 }); }
function unlocked(i) { if (i < 2 || save.unlockAll) return true; return songRec(SONGS[i - 1].id).stage >= 1; }
function hap(ms) { if (save.haptics && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

// ---------- audio ----------
var AC = null, master = null, dry = null, wet = null, comp = null, amb = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended' && save.sound) AC.resume(); return; }
  var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC = new C();
  comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
  master = AC.createGain(); master.gain.value = save.sound ? 0.9 : 0; master.connect(comp); comp.connect(AC.destination);
  dry = AC.createGain(); dry.gain.value = 0.82; dry.connect(master);
  var conv = AC.createConvolver(), len = Math.floor(AC.sampleRate * 3), ir = AC.createBuffer(2, len, AC.sampleRate);
  for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var i = 0; i < len; i++) { var t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < 600 ? i / 600 : 1); } }
  conv.buffer = ir; wet = AC.createGain(); wet.gain.value = 0.34; wet.connect(conv); conv.connect(master);
  startAmbience();
}
function out(node) { node.connect(dry); node.connect(wet); }
var noiseBuf = null;
function noise() { if (noiseBuf) return noiseBuf; var n = AC.sampleRate * 2, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0), last = 0; for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; } return (noiseBuf = b); }
function mf(m) { return 440 * Math.pow(2, (m - 69) / 12); }
var voices = 0;
function piano(m, vel, opt) {
  if (!AC || !save.sound) return null; opt = opt || {};
  if (voices > 26) return null; voices++;
  var t = AC.currentTime + 0.003, f = mf(m), dec = opt.decay || Math.max(0.9, 3.4 - (m - 48) * 0.05);
  var vg = AC.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(vel, t + 0.005);
  vg.gain.setTargetAtTime(vel * 0.38, t + 0.006, 0.09); vg.gain.setTargetAtTime(0.0001, t + 0.25, dec / 4.5);
  var lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
  lp.frequency.setValueAtTime(Math.min(14000, f * (opt.bright || 12)), t); lp.frequency.setTargetAtTime(Math.min(9000, f * 3.2), t + 0.01, 0.35);
  lp.connect(vg); out(vg);
  var parts = [[1, 'triangle', 0.55, 0], [1, 'sine', 0.6, 5], [2, 'sine', 0.24, -3], [3, 'sine', 0.09, 2], [4.02, 'sine', 0.035, 0]], oscs = [];
  parts.forEach(function (p) { var o = AC.createOscillator(), og = AC.createGain(); o.type = p[1]; o.frequency.value = f * p[0]; o.detune.value = p[3]; og.gain.value = p[2]; o.connect(og); og.connect(lp); o.start(t); oscs.push(o); });
  // felt-hammer knock
  var ns = AC.createBufferSource(), bp = AC.createBiquadFilter(), ng = AC.createGain(); ns.buffer = noise(); bp.type = 'bandpass'; bp.frequency.value = Math.min(6000, f * 3); bp.Q.value = 1.4;
  ng.gain.setValueAtTime(vel * 0.16, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); ns.connect(bp); bp.connect(ng); out(ng); ns.start(t, Math.random()); ns.stop(t + 0.05);
  var end = t + dec * 1.4, stopped = false;
  oscs.forEach(function (o) { o.stop(end); }); oscs[0].onended = function () { voices--; };
  return { release: function (r) { if (stopped) return; stopped = true; var n = AC.currentTime; vg.gain.cancelScheduledValues(n); vg.gain.setValueAtTime(vg.gain.value, n); vg.gain.setTargetAtTime(0.0001, n, r || 0.12); } };
}
function pad(m) { // sustained glassy shimmer while a long key is held
  if (!AC || !save.sound) return null;
  var t = AC.currentTime, f = mf(m) * 2, g1 = AC.createGain(), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  g1.gain.setValueAtTime(0, t); g1.gain.linearRampToValueAtTime(0.06, t + 0.25); lp.connect(g1); out(g1);
  var os = [0, 7, -6].map(function (d, i) { var o = AC.createOscillator(); o.type = i ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = d; var og = AC.createGain(); og.gain.value = i ? 0.5 : 0.35; o.connect(og); og.connect(lp); o.start(t); return o; });
  var lfo = AC.createOscillator(), lg = AC.createGain(); lfo.frequency.value = 5.2; lg.gain.value = 0.015; lfo.connect(lg); lg.connect(g1.gain); lfo.start(t);
  return { stop: function () { var n = AC.currentTime; g1.gain.cancelScheduledValues(n); g1.gain.setValueAtTime(g1.gain.value, n); g1.gain.setTargetAtTime(0, n, 0.12); os.concat([lfo]).forEach(function (o) { o.stop(n + 0.8); }); } };
}
function bell(m, vel, when) {
  if (!AC || !save.sound) return; var t = AC.currentTime + (when || 0), f = mf(m);
  [[1, 1], [2.76, 0.4], [5.4, 0.18], [8.93, 0.07]].forEach(function (p) {
    var o = AC.createOscillator(), og = AC.createGain(); o.frequency.value = f * p[0];
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(vel * p[1], t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 / p[0] + 0.4);
    o.connect(og); out(og); o.start(t); o.stop(t + 3.2);
  });
}
function whoosh(dur, f0, f1, vel) {
  if (!AC || !save.sound) return; var t = AC.currentTime, s = AC.createBufferSource(), bp = AC.createBiquadFilter(), gg = AC.createGain();
  s.buffer = noise(); bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
  gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(vel, t + dur * 0.4); gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp); bp.connect(gg); out(gg); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function thud(f0, vel) {
  if (!AC || !save.sound) return; var t = AC.currentTime, o = AC.createOscillator(), gg = AC.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.35);
  gg.gain.setValueAtTime(vel, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(gg); gg.connect(master); o.start(t); o.stop(t + 0.55);
}
var SFX = {
  ui: function () { if (!AC || !save.sound) return; piano(84, 0.08, { decay: 0.5, bright: 6 }); },
  fail: function () { piano(40, 0.5, { decay: 2.5 }); piano(41, 0.45, { decay: 2.5 }); piano(46, 0.35, { decay: 2.2 }); thud(90, 0.5); bell(97, 0.05); },
  stage: function (k) { var base = [72, 74, 76, 77, 79, 81, 84][Math.min(6, k)]; [0, 4, 7, 12, 16].forEach(function (d, i) { bell(base + d, 0.11, i * 0.085); }); whoosh(0.9, 400, 4200, 0.12); thud(60, 0.25); },
  hold: function () { bell(96, 0.05); },
  count: function (n) { bell(n ? 79 : 91, 0.08); }
};
function startAmbience() {
  if (amb || !AC) return;
  var s = AC.createBufferSource(), lp = AC.createBiquadFilter(), gg = AC.createGain(), lfo = AC.createOscillator(), lg = AC.createGain();
  s.buffer = noise(); s.loop = true; lp.type = 'lowpass'; lp.frequency.value = 420; gg.gain.value = 0.03; lfo.frequency.value = 0.13; lg.gain.value = 0.018;
  lfo.connect(lg); lg.connect(gg.gain); s.connect(lp); lp.connect(gg); gg.connect(master); s.start(); lfo.start(); amb = { g: gg };
  (function cricket() {
    setTimeout(function () {
      if (AC && save.sound && !document.hidden) {
        var t = AC.currentTime, f = 4100 + Math.random() * 600, pan = AC.createStereoPanner ? AC.createStereoPanner() : null;
        for (var i = 0; i < 3; i++) { var o = AC.createOscillator(), og = AC.createGain(); o.frequency.value = f; og.gain.setValueAtTime(0, t + i * 0.07); og.gain.linearRampToValueAtTime(0.006, t + i * 0.07 + 0.01); og.gain.linearRampToValueAtTime(0, t + i * 0.07 + 0.045); o.connect(og); if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; og.connect(pan); } else og.connect(master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.06); }
        if (pan) pan.connect(master);
      }
      cricket();
    }, 1400 + Math.random() * 3200);
  })();
}

// ---------- sprites ----------
function mk(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
var SPR = {};
function radial(size, stops) { var c = mk(size, size), x = c.getContext('2d'), gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2); stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); x.fillStyle = gr; x.fillRect(0, 0, size, size); return c; }
function buildSprites() {
  SPR.glowW = radial(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,.45)'], [0.6, 'rgba(255,255,255,.09)'], [1, 'rgba(255,255,255,0)']]);
  SPR.glowAcc = PALS.map(function (p) { var a = p._acc; return radial(128, [[0, rgb(a, 0.9)], [0.3, rgb(a, 0.35)], [0.65, rgb(a, 0.07)], [1, rgb(a, 0)]]); });
  SPR.shadow = radial(64, [[0, 'rgba(0,0,0,.75)'], [0.55, 'rgba(0,0,0,.35)'], [1, 'rgba(0,0,0,0)']]);
  SPR.star = (function () { var c = mk(64, 64), x = c.getContext('2d'); x.translate(32, 32); x.globalCompositeOperation = 'lighter';
    var gr = x.createRadialGradient(0, 0, 0, 0, 0, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.2, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(-32, -32, 64, 64);
    x.fillStyle = '#fff'; x.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? 2.4 : 28, a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.globalAlpha = 0.85; x.fill(); return c; })();
  SPR.streak = PALS.map(function (p) { var c = mk(8, 256), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, rgb(p._acc, 0)); gr.addColorStop(0.55, rgb(p._acc, 0.5)); gr.addColorStop(0.8, rgb(p._acc2, 0.35)); gr.addColorStop(1, rgb(p._acc, 0)); x.fillStyle = gr; x.fillRect(0, 0, 8, 256); return c; });
  SPR.warm = radial(64, [[0, 'rgba(255,220,160,1)'], [0.25, 'rgba(255,180,100,.45)'], [1, 'rgba(255,150,80,0)']]);
  SPR.crescent = (function () { var c = mk(64, 64), x = c.getContext('2d'); x.fillStyle = '#0c1230'; x.beginPath(); x.arc(32, 32, 26, 0, 7); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(44, 24, 23, 0, 7); x.fill(); return c; })();
  SPR.grain = (function () { var c = mk(160, 160), x = c.getContext('2d'), im = x.createImageData(160, 160); for (var i = 0; i < im.data.length; i += 4) { var v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; })();
}
var BG = {};
function buildBackdrop() {
  // ridge silhouettes (two layers) + pines, drawn in near-black; palette fog tints them live
  var w = Math.ceil(W), h = Math.ceil(H * 0.2);
  function ridge(seed, base, amp, trees, col) {
    var c = mk(w * DPR, h * DPR), x = c.getContext('2d'); x.scale(DPR, DPR); var R = seedRng(seed);
    x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
    var pts = [], y = base, i;
    for (i = 0; i <= w; i += 6) { y += (R() - 0.5) * amp; y = Math.max(base - amp * 3, Math.min(base + amp * 2, y)); pts.push([i, y]); x.lineTo(i, y); }
    x.lineTo(w, h); x.closePath(); x.fill();
    for (i = 0; i < trees; i++) { var p = pts[Math.floor(R() * pts.length)], th = 8 + R() * h * 0.35, tw = th * 0.32; x.beginPath(); x.moveTo(p[0], p[1] - th); x.lineTo(p[0] - tw, p[1] + 2); x.lineTo(p[0] + tw, p[1] + 2); x.fill(); }
    return c;
  }
  BG.far = ridge(5, h * 0.55, 3.2, 26, '#0b0f1e'); BG.near = ridge(9, h * 0.8, 2.4, 44, '#03050b'); BG.h = h;
  // vignette
  var v = mk(Math.ceil(W * DPR / 2), Math.ceil(H * DPR / 2)), vx = v.getContext('2d'), gr = vx.createRadialGradient(v.width / 2, v.height * 0.45, v.width * 0.25, v.width / 2, v.height * 0.5, v.height * 0.75);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.62)'); vx.fillStyle = gr; vx.fillRect(0, 0, v.width, v.height); BG.vig = v;
  var RL = seedRng(31); BG.lamps = []; for (var li = 0; li < 5; li++) BG.lamps.push({ x: W * (0.06 + RL() * 0.88), dy: 6 + RL() * h * 0.22, f: 1.5 + RL() * 3, ph: RL() * 7 });
  BG.reeds = []; [[0, 1], [W, -1]].forEach(function (side) { for (var i = 0; i < 9; i++) BG.reeds.push({ x: side[0] + side[1] * (2 + RL() * 46), h: 34 + RL() * 70, w: 1.5 + RL() * 1.8, ph: RL() * 7, cat: RL() < 0.35 }); });
  // stars
  var R = seedRng(77); BG.stars = [];
  for (var i = 0; i < 140; i++) BG.stars.push({ x: R() * W, y: R() * HITY * 0.95, r: R() < 0.12 ? 1.4 + R() : 0.4 + R() * 0.8, ph: R() * 7, sp: 0.6 + R() * 2, warm: R() < 0.2 });
}
function seedRng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- layout ----------
function layout() {
  var vw = window.innerWidth, vh = window.innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1); W = vw; H = vh;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  FW = Math.min(W, 520); FX = (W - FW) / 2; LANEW = FW / 4;
  HITY = Math.round(H * 0.79); ROWH = Math.max(110, Math.min(230, H * 0.225));
  var pr = document.getElementById('satProbe'); if (!pr) { pr = document.createElement('div'); pr.id = 'satProbe'; pr.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none'; document.body.appendChild(pr); } var sat = pr.getBoundingClientRect().height || 0; TOPSAFE = 56 + sat;
  buildBackdrop();
}

// ---------- run state ----------
var rings = [];
var mode = 'title', T = 0, run = null, parts = [], texts = [], ripples = [], beams = [], motes = [], shooting = [];
var shake = 0, flash = 0, flashCol = [255, 255, 255], energy = 0, banner = null, redPulse = 0, slowmo = 1;
var pointers = {};
function newRun(si, demo) {
  var song = SONGS[si], pass = LW.buildPass(song);
  run = { si: si, song: song, pass: pass, period: pass.len + PASS_GAP, tiles: [], built: -1, s: 0, speed: 0, score: 0, combo: 0, maxCombo: 0,
    stage: 0, revived: false, shield: (!save.played && si === 0 && !demo) ? 1 : 0, demo: !!demo, perfect: 0, hits: 0, started: false, failInfo: null, failT: 0,
    countT: 0, lastHitT: -9, firstLong: !save.seenHold };
  ensurePasses(0); ensurePasses(1);
  var first = run.tiles[0]; first.start = true;
  run.s = first.r - 0.2; palTarget = 0;
  return run;
}
function ensurePasses(k) {
  while (run.built < k) {
    var p = ++run.built, base = p * run.period;
    run.pass.rows.forEach(function (row, ri) {
      var pair = row.lanes.length > 1 ? [] : null;
      row.lanes.forEach(function (lane, li) {
        var t = { r: base + row.r, h: row.h, lane: lane, note: row.notes[Math.min(li, row.notes.length - 1)], bass: li === 0 ? row.bass : [], long: row.long,
          pass: p, st: 0, hitT: 0, hold: 0, ptr: null, voice: null, padv: null, judge: '', ri: ri, pair: pair };
        if (pair) pair.push(t);
        run.tiles.push(t);
      });
    });
  }
}
function passAt(s) { return Math.max(0, Math.floor((s + PASS_GAP * 0.5) / run.period)); }
function yB(t) { return HITY - (t.r - run.s) * ROWH; }
function tileRect(t) { var b = yB(t), h = t.h * ROWH; return { x: FX + t.lane * LANEW + 2, y: b - h + 2, w: LANEW - 4, h: h - 4, b: b }; }

// ---------- particles & juice ----------
function burst(x, y, n, col, opt) {
  opt = opt || {};
  for (var i = 0; i < n && parts.length < MAXP; i++) {
    var a = opt.up ? -Math.PI / 2 + (Math.random() - 0.5) * (opt.spread || 2.2) : Math.random() * Math.PI * 2, sp = (opt.sp || 220) * (0.35 + Math.random() * 0.9);
    parts.push({ x: x + (Math.random() - 0.5) * (opt.w || 0), y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: (opt.life || 0.7) * (0.6 + Math.random() * 0.7),
      r: (opt.r || 2.2) * (0.5 + Math.random()), col: col, g: opt.g == null ? 220 : opt.g, kind: opt.kind || 'spark', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
  }
}
function ripple(x, y, col, big) { ripples.push({ x: x, y: y, t: 0, max: big ? 1.6 : 1.1, r0: big ? 30 : 14, col: col, big: big }); }
function floatText(x, y, s, col, size) { texts.push({ x: x, y: y, s: s, col: col, size: size || 22, t: 0 }); }

// ---------- gameplay ----------
function startTileHit(t) { run.started = true; save.played = true; writeSave(); mode = 'play'; setHud(); hitTile(t, null, true); }
function judgeOf(t) { var d = (yB(t) - HITY) / ROWH; if (d > -0.35 && d < 0.6) return 'Perfect'; if (d > -0.9 && d < 0.95) return 'Great'; return 'Good'; }
function hitTile(t, ptrId, isStart) {
  var R = tileRect(t), cx = R.x + R.w / 2, acc = pal.acc, j = isStart ? 'Perfect' : judgeOf(t);
  t.judge = j; t.hitT = T; run.combo++; run.hits++; run.maxCombo = Math.max(run.maxCombo, run.combo); if (j === 'Perfect') run.perfect++;
  run.score += 1 + (j === 'Perfect' ? 1 : 0); run.lastHitT = T;
  var vel = 0.36 + (j === 'Perfect' ? 0.08 : 0) + Math.random() * 0.04;
  if (!run.demo) {
    t.voice = piano(t.note, vel, t.long ? { decay: 4.5 } : null);
    t.bass.forEach(function (b) { piano(b, 0.22, { bright: 5 }); });
  }
  energy = Math.min(1.4, energy + 0.35);
  var py = Math.min(Math.max(R.b, TOPSAFE), H - 6), impactY = Math.min(py, HITY + ROWH * 0.4);
  if (t.long) { t.st = 2; t.ptr = ptrId; if (!run.demo) t.padv = pad(t.note); t.holdStartS = run.s; burst(cx, Math.min(py, HITY), 10, acc, { up: true, sp: 160, life: 0.5 }); }
  else { t.st = 1; }
  // juice: shards up, droplets into the water, ring, lane beam, judgement
  burst(cx, impactY - Math.min(R.h, ROWH) * 0.4, j === 'Perfect' ? 26 : 16, pal.acc2, { up: true, sp: 300, w: R.w * 0.8, life: 0.7, r: 2.8 });
  burst(cx, impactY - R.h * 0.4, 7, acc, { kind: 'shard', sp: 240, w: R.w * 0.6, life: 0.8, r: 5, g: 520 });
  burst(cx, HITY + 2, 9, pal.acc2, { kind: 'drop', up: true, spread: 1.2, sp: 230, w: LANEW * 0.5, g: 900, life: 0.7, r: 1.8 });
  ripple(cx, HITY + 10 + Math.random() * 18, acc, j === 'Perfect');
  rings.push({ x: cx, y: Math.min(impactY, HITY) - Math.min(R.h, ROWH) * 0.5, t: 0, col: pal.acc2.slice(), big: j === 'Perfect' });
  beams.push({ lane: t.lane, t: 0, col: acc.slice(), strong: j === 'Perfect' });
  if (j === 'Perfect' && run.combo > 1 && !run.demo) shake = Math.max(shake, 1.6);
  if (!run.demo) { floatText(cx, impactY - R.h - 10, j, j === 'Perfect' ? pal.acc2 : j === 'Great' ? pal.acc : [190, 200, 220], j === 'Perfect' ? 20 : 17); hap(8); }
  if (t.long && run.firstLong && !run.demo) { run.firstLong = false; save.seenHold = true; writeSave(); }
  updateHud(true);
}
function finishHold(t, full) {
  if (t.st !== 2) return;
  t.st = full ? 4 : 3; t.ptr = null; if (full) run.holdsFull = (run.holdsFull || 0) + 1; else run.holdsPartial = (run.holdsPartial || 0) + 1;
  if (t.padv) { t.padv.stop(); t.padv = null; }
  var R = tileRect(t), cx = R.x + R.w / 2;
  if (full) {
    var bonus = Math.max(1, Math.round(t.h)); run.score += bonus; SFX.hold();
    burst(cx, HITY - 6, 22, pal.acc2, { up: true, sp: 320, life: 0.8, w: R.w * 0.5 }); burst(cx, HITY - 6, 8, pal.acc, { kind: 'shard', sp: 260, life: 0.9, r: 5, g: 520 });
    ripple(cx, HITY + 16, pal.acc, true); floatText(cx, HITY - ROWH * 0.9, '+' + bonus + ' held', pal.acc2, 17); hap(14); shake = Math.max(shake, 2.5);
  } else if (t.voice) t.voice.release(0.18);
  updateHud(true);
}
function wrongTap(x, y) {
  var lane = Math.max(0, Math.min(3, Math.floor((x - FX) / LANEW)));
  var ghost = { lane: lane, y: y, t: 0 };
  if (run.shield > 0) {
    run.shield--; toast('Only the glowing keys. That slip was free — the lake forgives your first song once.');
    shake = 8; redPulse = 0.6; SFX.fail(); run.combo = 0; run.ghost = ghost; hap([20, 40, 20]); return;
  }
  fail({ kind: 'wrong', lane: lane, y: y, ghost: ghost });
}
function fail(info) {
  if (mode !== 'play') return;
  if (run.demo) return;
  mode = 'dying'; run.failInfo = info; run.failT = 0; run.ghost = info.ghost || null; run.combo = 0;
  shake = 16; redPulse = 1; flash = 0.35; flashCol = [255, 70, 90]; SFX.fail(); hap([40, 60, 80]);
  for (var id in pointers) releasePointer(id);
  run.failS = run.s;
  if (info.kind === 'miss') run.backTo = info.tile.r - 0.45 - info.tile.h * 0.0; else run.backTo = run.s;
  var r = songRec(run.song.id); if (run.score > r.best) { r.best = run.score; run.newBest = true; } writeSave();
}
function stageUp(k) {
  run.stage = k; var r = songRec(run.song.id), prev = r.stage; if (k > r.stage) { r.stage = k; writeSave(); }
  palTarget = Math.min(PALS.length - 1, k);
  var label = k <= 3 ? ['', 'First star', 'Second star', 'Third star'][k] : k <= 6 ? ['', '', '', '', 'First crown', 'Second crown', 'Third crown'][k] : 'Deeper still · ' + (k - 6);
  banner = { t: 0, k: k, text: label, sub: k < 6 ? 'faster now' : k === 6 ? 'the lake runs endless' : 'faster still' };
  SFX.stage(k); shake = 9; flash = 0.32; flashCol = PALS[Math.min(6, k)]._acc2.slice(); hap([20, 30, 60]);
  var mx = FX + FW * 0.74, my = H * 0.17;
  burst(mx, my, 46, PALS[Math.min(6, k)]._acc2, { sp: 380, life: 1.3, g: 60, r: 1.6 }); burst(mx, my, 24, PALS[Math.min(6, k)]._acc, { kind: 'shard', sp: 300, life: 1.4, g: 200, r: 6 });
  for (var i = 0; i < 3; i++) shooting.push({ x: Math.random() * W, y: Math.random() * H * 0.3, t: -i * 0.18, a: 2.6 + Math.random() * 0.3 });
  run.flyStar = { t: 0, k: k };
  if (k === 1 && prev < 1 && run.si + 1 < SONGS.length) setTimeout(function () { toast('“' + SONGS[run.si + 1].title + '” woke on the lake.'); }, 1500);
  updateHud(true);
}
function revive() {
  if (!run || run.revived) return;
  run.revived = true; $('over').classList.add('hidden');
  var info = run.failInfo;
  if (info && info.kind === 'miss') { run.s = info.tile.r - 1.6; }
  run.ghost = null; redPulse = 0; mode = 'count'; run.countT = 0; run.speed = 0; setHud(); SFX.count(1);
}

// ---------- input ----------
function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (W / r.width), y: (e.clientY - r.top) * (H / r.height) }; }
function findTile(x, y, states) {
  var best = null, bestB = -1e9, padX = 16, padBelow = ROWH * 0.55, padAbove = ROWH * 0.3;
  for (var i = 0; i < run.tiles.length; i++) {
    var t = run.tiles[i]; if (states.indexOf(t.st) < 0) continue;
    var R = tileRect(t); if (R.b < -ROWH) continue; if (R.y > H + ROWH) continue;
    var px = t.long ? padX : padX, inX = x >= R.x - px && x <= R.x + R.w + px, inY = y >= R.y - padAbove && y <= R.b + padBelow;
    if (!inX || !inY) continue;
    // prefer the tile actually under the finger's lane, then the lowest one
    var laneHit = x >= R.x && x <= R.x + R.w ? 1e6 : 0, score = laneHit + R.b;
    if (score > bestB) { bestB = score; best = t; }
  }
  return best;
}
function onDown(e) {
  e.preventDefault(); ensureAudio();
  var p = pt(e); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (mode === 'ready') {
    var t0 = run.tiles[0], hitT = findTile(p.x, p.y, [0]);
    if (hitT === t0 || (Math.abs(p.y - yB(t0)) < ROWH * 1.4 && Math.floor((p.x - FX) / LANEW) === t0.lane)) { pointers[e.pointerId] = { t: t0 }; startTileHit(t0); }
    else { run.nudge = T; }
    return;
  }
  if (mode !== 'play') return;
  if (p.y < TOPSAFE) return; // HUD band never fails you
  var t = findTile(p.x, p.y, [0]);
  if (t) { pointers[e.pointerId] = { t: t }; hitTile(t, e.pointerId); return; }
  if (findTile(p.x, p.y, [1, 2, 3, 4])) return; // re-tapping a played key is harmless
  wrongTap(p.x, p.y);
}
function releasePointer(id) {
  var pr = pointers[id]; delete pointers[id];
  if (pr && pr.t && pr.t.st === 2) { var t = pr.t, need = t.h - 0.2, got = run.s - t.holdStartS; finishHold(t, got >= need * 0.72 || run.s >= t.r + t.h - 0.45); }
}
function onUp(e) { e.preventDefault(); releasePointer(e.pointerId); }
cv.addEventListener('pointerdown', onDown, { passive: false });
cv.addEventListener('pointerup', onUp, { passive: false });
cv.addEventListener('pointercancel', onUp, { passive: false });
cv.addEventListener('pointermove', function (e) { e.preventDefault(); }, { passive: false });
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

// ---------- update ----------
function update(dt) {
  T += dt; energy *= Math.exp(-dt * 2.2); shake *= Math.exp(-dt * 9); flash *= Math.exp(-dt * 5); redPulse *= Math.exp(-dt * 2.5);
  stepPal(dt);
  if (run) {
    if (mode === 'play' || (mode === 'title' && run.demo) || mode === 'count') {
      var countGate = mode === 'count';
      if (countGate) { run.countT += dt; var prevN = Math.ceil(2.4 - (run.countT - dt)), n = Math.ceil(2.4 - run.countT); if (n !== prevN && n > 0) SFX.count(1); if (run.countT >= 2.4) { mode = 'play'; SFX.count(0); setHud(); } }
      var p = passAt(run.s), target = countGate ? 0 : run.song.rps * stageMul(p, run.song.rps);
      run.speed += (target - run.speed) * (1 - Math.exp(-dt * (run.speed < target * 0.5 ? 2.5 : 1.6)));
      if (run.demo || run.started) run.s += run.speed * dt;
      ensurePasses(passAt(run.s) + 1);
      // stage checkpoints: crossing the gap after each pass
      if (!run.demo) { var reached = Math.floor((run.s - run.pass.len - PASS_GAP * 0.3) / run.period) + 1; if (reached > run.stage && mode === 'play') stageUp(reached); }
      // holds
      for (var i = 0; i < run.tiles.length; i++) {
        var t = run.tiles[i];
        if (t.st === 2) {
          t.hold = Math.min(1, (run.s - t.holdStartS) / Math.max(0.3, t.h - 0.2));
          if (run.s >= t.r + t.h - 0.1) finishHold(t, true);
          else if (Math.random() < dt * 30) { var R = tileRect(t); burst(R.x + R.w / 2, HITY - 4, 1, pal.acc2, { up: true, sp: 140, life: 0.5, r: 1.6 }); }
        } else if (t.st === 0 && (mode === 'play' || run.demo)) {
          if (run.demo) { if (yB(t) >= HITY + ROWH * 0.15) hitTile(t, null); }
          else if (yB(t) > H + ROWH * 0.3) {
            if (run.shield > 0) { run.shield--; t.st = 3; shake = 8; redPulse = 0.6; SFX.fail(); run.combo = 0; toast('Keys can’t reach the water untouched. That miss was free — once.'); }
            else { fail({ kind: 'miss', tile: t }); break; }
          }
        }
      }
      if (run.demo) { for (var d = 0; d < run.tiles.length; d++) { var td = run.tiles[d]; if (td.st === 2 && run.s >= td.r + td.h - 0.1) finishHold(td, true); } }
      // trim
      while (run.tiles.length && yB(run.tiles[0]) - run.tiles[0].h * ROWH > H + ROWH * 2) run.tiles.shift();
    } else if (mode === 'dying') {
      run.failT += dt;
      if (run.backTo != null) run.s += (run.backTo - run.s) * (1 - Math.exp(-dt * 6));
      if (run.failT > 1.25 && $('over').classList.contains('hidden')) showOver();
    }
    if (banner) { banner.t += dt; if (banner.t > 2.4) banner = null; }
    if (run.flyStar) { run.flyStar.t += dt; if (run.flyStar.t > 1.1) run.flyStar = null; }
  }
  // particles
  for (var k = parts.length - 1; k >= 0; k--) {
    var q = parts[k]; q.life += dt; if (q.life >= q.max) { parts.splice(k, 1); continue; }
    q.vx *= Math.exp(-dt * (q.kind === 'drop' ? 0.5 : 2.2)); q.vy = q.vy * Math.exp(-dt * (q.kind === 'drop' ? 0.2 : 2)) + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    if (q.kind === 'drop' && q.y > HITY + 4 && q.vy > 0) { if (Math.random() < 0.35) ripples.push({ x: q.x, y: HITY + 6 + Math.random() * 30, t: 0, max: 0.7, r0: 4, col: pal.acc2.slice(), big: false }); parts.splice(k, 1); }
  }
  for (k = texts.length - 1; k >= 0; k--) { texts[k].t += dt; if (texts[k].t > 0.9) texts.splice(k, 1); }
  for (k = ripples.length - 1; k >= 0; k--) { ripples[k].t += dt; if (ripples[k].t > ripples[k].max) ripples.splice(k, 1); }
  for (k = rings.length - 1; k >= 0; k--) { rings[k].t += dt; if (rings[k].t > 0.4) rings.splice(k, 1); }
  for (k = beams.length - 1; k >= 0; k--) { beams[k].t += dt; if (beams[k].t > 0.45) beams.splice(k, 1); }
  for (k = shooting.length - 1; k >= 0; k--) { shooting[k].t += dt; if (shooting[k].t > 1) shooting.splice(k, 1); }
  if (Math.random() < dt * 0.06) shooting.push({ x: Math.random() * W, y: Math.random() * H * 0.25, t: 0, a: 2.5 + Math.random() * 0.4 });
  while (motes.length < 26) motes.push({ x: Math.random() * W, y: HITY - Math.random() * H * 0.45, ph: Math.random() * 7, sp: 8 + Math.random() * 14, r: 1 + Math.random() * 1.6 });
  motes.forEach(function (m) { m.ph += dt; m.x += Math.sin(m.ph * 0.7) * m.sp * dt; m.y += Math.cos(m.ph * 0.5) * m.sp * 0.6 * dt; if (m.x < -10) m.x = W + 10; if (m.x > W + 10) m.x = -10; });
}

// ---------- render ----------
function rr(x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawSky() {
  var gr = g.createLinearGradient(0, 0, 0, HITY); gr.addColorStop(0, rgb(pal.top)); gr.addColorStop(0.55, rgb(pal.mid)); gr.addColorStop(1, rgb(pal.hor));
  g.fillStyle = gr; g.fillRect(0, 0, W, HITY + 1);
  // stars, with a whisper of parallax from the scroll
  var drift = run ? (run.s * ROWH * 0.025) % HITY : 0;
  for (var i = 0; i < BG.stars.length; i++) {
    var s = BG.stars[i], y = (s.y + drift) % (HITY * 0.95), a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(T * s.sp + s.ph));
    a *= Math.min(1, (HITY - y) / (HITY * 0.35));
    g.fillStyle = s.warm ? 'rgba(255,230,200,' + a + ')' : 'rgba(220,232,255,' + a + ')';
    if (s.r > 1.3) { g.globalAlpha = a * 0.6; g.drawImage(SPR.star, s.x - 7, y - 7, 14, 14); g.globalAlpha = 1; } else g.fillRect(s.x, y, s.r, s.r);
  }
  // shooting stars
  g.globalCompositeOperation = 'lighter';
  shooting.forEach(function (sh) { if (sh.t < 0) return; var L = 140, x = sh.x + Math.cos(sh.a) * sh.t * 700, y = sh.y + Math.sin(sh.a) * sh.t * 700, al = Math.sin(Math.PI * Math.min(1, sh.t));
    var gr2 = g.createLinearGradient(x, y, x - Math.cos(sh.a) * L, y - Math.sin(sh.a) * L); gr2.addColorStop(0, 'rgba(255,255,255,' + al + ')'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = gr2; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(sh.a) * L, y - Math.sin(sh.a) * L); g.stroke(); });
  // aurora from the third star on
  var au = Math.min(1, Math.max(0, (palTarget - 2) / 3));
  if (au > 0) {
    for (var b = 0; b < 3; b++) {
      var spr = SPR.streak[(palTarget + b) % PALS.length], base = H * (0.1 + b * 0.07);
      g.globalAlpha = au * (0.32 - b * 0.07);
      for (var x = -8; x < W + 8; x += 7) { var yy = base + Math.sin(x * 0.012 + T * 0.35 + b * 2) * 26 + Math.sin(x * 0.031 - T * 0.5 + b) * 10, hh = 120 + 60 * Math.sin(x * 0.02 + T * 0.6 + b); g.drawImage(spr, x, yy, 9, hh); }
    }
    g.globalAlpha = 1;
  }
  // moon: halo breathes with the music
  var mx = FX + FW * 0.74, my = H * 0.17, mr = Math.min(W, 520) * 0.085, e = energy;
  g.globalAlpha = 0.55 + e * 0.25; g.drawImage(SPR.glowAcc[palTarget], mx - mr * (5 + e), my - mr * (5 + e), mr * (10 + 2 * e), mr * (10 + 2 * e));
  g.globalAlpha = 0.5; g.drawImage(SPR.glowW, mx - mr * 2.2, my - mr * 2.2, mr * 4.4, mr * 4.4); g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  var mg = g.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr); mg.addColorStop(0, '#fffdf3'); mg.addColorStop(0.7, rgb(pal.acc2)); mg.addColorStop(1, rgb(pal.acc, 0.95));
  g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = 'rgba(40,50,90,.12)'; [[-.3, -.1, .22], [.25, .2, .16], [.05, -.4, .1], [.35, -.25, .08]].forEach(function (c) { g.beginPath(); g.arc(mx + c[0] * mr, my + c[1] * mr, c[2] * mr, 0, 7); g.fill(); });
  // ridges + drifting fog
  var bh = BG.h, by = HITY - bh;
  g.drawImage(BG.far, 0, by - bh * 0.18, W, bh);
  var fg = g.createLinearGradient(0, by, 0, HITY); fg.addColorStop(0, rgb(pal.fog, 0)); fg.addColorStop(0.7, rgb(pal.fog, 0.28)); fg.addColorStop(1, rgb(pal.fog, 0.08));
  g.fillStyle = fg; g.fillRect(0, by, W, bh);
  g.drawImage(BG.near, 0, by + bh * 0.02, W, bh);
  g.globalCompositeOperation = 'lighter';
  for (var f = 0; f < 3; f++) { var fx = ((T * (6 + f * 4) + f * 170) % (W + 300)) - 150; g.globalAlpha = 0.07; g.drawImage(SPR.glowAcc[palTarget], fx - 160, HITY - 50 - f * 12, 320, 80); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function drawWater() {
  var wg = g.createLinearGradient(0, HITY, 0, H); wg.addColorStop(0, rgb(pal.water)); wg.addColorStop(1, '#010206');
  g.fillStyle = wg; g.fillRect(0, HITY, W, H - HITY);
  // moon path on the water
  var mx = FX + FW * 0.74; g.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 22; i++) {
    var y = HITY + 4 + i * (H - HITY) / 22, w = (14 + i * 3.2) * (0.6 + 0.4 * Math.sin(T * 1.7 + i * 1.3)) * (1 + energy * 0.4), a = (0.22 - i * 0.008) * (0.6 + 0.4 * Math.sin(T * 2.3 + i));
    g.fillStyle = rgb(pal.acc2, Math.max(0, a)); g.fillRect(mx - w / 2 + Math.sin(T + i) * 6, y, w, 1.6);
  }
  // glints
  for (var k = 0; k < 18; k++) { var gx = (k * 97.3 + T * (10 + k % 5 * 6)) % W, gy = HITY + 8 + ((k * 53.7) % (H - HITY - 12)), ga = 0.12 * (0.5 + 0.5 * Math.sin(T * 3 + k)); g.fillStyle = rgb(pal.acc, ga); g.fillRect(gx, gy, 10 + k % 4 * 6, 1); }
  // ripples
  ripples.forEach(function (r) { var p = r.t / r.max, rad = r.r0 + p * (r.big ? 110 : 70); g.strokeStyle = rgb(r.col, (1 - p) * (r.big ? 0.6 : 0.4)); g.lineWidth = 1.4 * (1 - p) + 0.4;
    g.beginPath(); g.ellipse(r.x, r.y, rad, rad * 0.22, 0, 0, 7); g.stroke(); if (r.big) { g.beginPath(); g.ellipse(r.x, r.y, rad * 0.6, rad * 0.13, 0, 0, 7); g.stroke(); } });
  g.globalCompositeOperation = 'source-over';
}
function drawShore() {
  // warm cabin lanterns on the far shore, each with a trembling reflection
  var R0 = BG.lamps; g.globalCompositeOperation = 'lighter';
  R0.forEach(function (l) { var fl = 0.75 + 0.25 * Math.sin(T * l.f + l.ph) * Math.sin(T * 2.3 + l.ph), x = l.x, y = HITY - l.dy;
    g.globalAlpha = 0.5 * fl; g.drawImage(SPR.warm, x - 14, y - 14, 28, 28); g.globalAlpha = 1; g.fillStyle = 'rgba(255,214,150,' + 0.9 * fl + ')'; g.fillRect(x - 1, y - 1, 2, 2);
    for (var i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,190,120,' + (0.22 - i * 0.03) * fl + ')'; g.fillRect(x - 3 + Math.sin(T * 3 + i + l.ph) * 2.5, HITY + 5 + i * 7 + l.dy * 0.4, 6 - i * 0.5, 1.4); } });
  // mist rolling over the water
  for (var f = 0; f < 4; f++) { var fx = ((T * (9 + f * 5) + f * 260) % (W + 400)) - 200, fy = HITY + 6 + f * 26; g.globalAlpha = 0.06 + 0.02 * Math.sin(T + f); g.drawImage(SPR.glowAcc[palTarget], fx - 200, fy - 30, 400, 60); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function drawReeds() {
  // foreground reeds framing the lake corners (parallax: they sway, the world doesn't)
  g.fillStyle = '#010207'; g.strokeStyle = '#010207';
  BG.reeds.forEach(function (r) { var sway = Math.sin(T * 0.9 + r.ph) * r.h * 0.06 + energy * 2, bx = r.x, by = H + 4;
    g.lineWidth = r.w; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sway * 0.3, by - r.h * 0.5, bx + sway, by - r.h); g.stroke();
    if (r.cat) { g.save(); g.translate(bx + sway, by - r.h); g.rotate(sway * 0.01); rr(-3.2, -2, 6.4, 22, 3); g.fill(); g.restore(); } });
}
function drawLanes() {
  g.globalCompositeOperation = 'lighter';
  for (var l = 1; l < 4; l++) { var x = FX + l * LANEW, lg = g.createLinearGradient(0, 0, 0, HITY); lg.addColorStop(0, rgb(pal.acc, 0)); lg.addColorStop(0.7, rgb(pal.acc, 0.07)); lg.addColorStop(1, rgb(pal.acc, 0.16)); g.fillStyle = lg; g.fillRect(x - 0.5, 0, 1, HITY); }
  beams.forEach(function (b) { var p = b.t / 0.45, x = FX + b.lane * LANEW, bg = g.createLinearGradient(0, HITY, 0, HITY - H * 0.7);
    bg.addColorStop(0, rgb(b.col, (b.strong ? 0.42 : 0.28) * (1 - p))); bg.addColorStop(1, rgb(b.col, 0)); g.fillStyle = bg; g.fillRect(x + LANEW * 0.08 * p, HITY - H * 0.7, LANEW * (1 - 0.16 * p), H * 0.7); });
  // waterline: a thin bright seam with bloom
  g.globalAlpha = 0.5 + energy * 0.3; g.drawImage(SPR.glowAcc[palTarget], FX - 40, HITY - 22, FW + 80, 44); g.globalAlpha = 1;
  g.fillStyle = rgb(pal.acc2, 0.55 + energy * 0.3); g.fillRect(FX, HITY - 0.75, FW, 1.5);
  for (var i = 0; i < 4; i++) { var cx = FX + (i + 0.5) * LANEW; g.globalAlpha = 0.5; g.drawImage(SPR.star, cx - 9, HITY - 9, 18, 18); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
function drawTile(t, next) {
  var R = tileRect(t); if (R.b < -10 || R.y > H + 10) return;
  var acc = pal.acc, acc2 = pal.acc2, prox = Math.max(0, 1 - Math.abs(R.b - HITY) / (ROWH * 2.2)), age = T - t.hitT;
  var x = R.x, y = R.y, w = R.w, h = R.h, sx = 1, sy = 1;
  if (t.st === 1 || t.st === 3 || t.st === 4) {
    // squash on impact, then sink into a ghost of glass
    var k = Math.min(1, age / 0.22); sx = 1 + 0.07 * Math.sin(k * Math.PI) ; sy = 1 - 0.1 * Math.sin(k * Math.PI);
    var cx = x + w / 2, cy = y + h; g.save(); g.translate(cx, cy); g.scale(sx, sy); g.translate(-cx, -cy);
    var ga = t.st === 4 ? 0.3 : 0.16;
    rr(x, y, w, h, 11); var gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, 'rgba(2,4,12,.35)'); gg.addColorStop(1, rgb(acc, ga)); g.fillStyle = gg; g.fill();
    g.strokeStyle = rgb(acc2, 0.22); g.lineWidth = 1; g.stroke();
    if (age < 0.3) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,' + (1 - age / 0.3) * 0.75 + ')'; g.fill(); g.globalAlpha = (1 - age / 0.3); g.drawImage(SPR.glowAcc[palTarget], x - w * 0.6, y - h * 0.3, w * 2.2, h * 1.6); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (t.judge === 'Perfect' && age < 0.5) { var p = age / 0.5; g.strokeStyle = rgb(acc2, 1 - p); g.lineWidth = 2; rr(x - p * 14, y - p * 14, w + p * 28, h + p * 28, 12 + p * 8); g.stroke(); }
    g.restore();
    return;
  }
  // drop shadow (onto the mist)
  g.globalAlpha = 0.7; g.drawImage(SPR.shadow, x - 12, y + 10, w + 24, h + 22); g.globalAlpha = 1;
  // bloom grows as the key nears the water; the very next key breathes
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, 0.3 + prox * 0.5 + (next ? 0.18 * (0.5 + 0.5 * Math.sin(T * 7)) : 0));
  g.drawImage(SPR.glowAcc[palTarget], x - w * 0.95, y - ROWH * 0.45, w * 2.9, h + ROWH * 0.9); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // moon-glass body: deep at the top, lit from the water below
  var dim = 1, mixk = t.long ? 0.68 : 0.5, dark = [pal.mid[0] * mixk + acc[0] * (1 - mixk), pal.mid[1] * mixk + acc[1] * (1 - mixk), pal.mid[2] * mixk + acc[2] * (1 - mixk)];
  rr(x, y, w, h, 11);
  var bg = g.createLinearGradient(0, y, 0, y + h); bg.addColorStop(0, rgb(dark, dim)); bg.addColorStop(Math.max(0.05, 1 - ROWH * 0.75 / h), rgb(acc, 0.92 * dim)); bg.addColorStop(1, rgb(acc2, dim)); g.fillStyle = bg; g.fill();
  g.save(); g.clip();
  // bevel: inner shade along the edges
  g.strokeStyle = 'rgba(10,14,40,.28)'; g.lineWidth = 10; rr(x, y, w, h, 11); g.stroke();
  // glossy top-left sheen + a slow glint that sweeps across every key
  var gl = g.createLinearGradient(x, y, x + w * 0.8, y + Math.min(h, ROWH) * 0.55); gl.addColorStop(0, 'rgba(255,255,255,.42)'); gl.addColorStop(0.45, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.fillRect(x, y, w, Math.min(h, ROWH * 0.7));
  var gx = x - w + ((T * 0.45 + t.lane * 0.23) % 1.6) * w * 2.2; g.globalCompositeOperation = 'lighter';
  var sg = g.createLinearGradient(gx, 0, gx + w * 0.5, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.16)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sg; g.fillRect(x, y, w, h); g.globalCompositeOperation = 'source-over';
  // bright lip at the bottom edge
  var lip = g.createLinearGradient(0, y + h - 14, 0, y + h); lip.addColorStop(0, 'rgba(255,255,255,0)'); lip.addColorStop(1, 'rgba(255,255,255,' + (0.45 + prox * 0.4) + ')'); g.fillStyle = lip; g.fillRect(x, y + h - 14, w, 14);
  if (t.long) {
    var cx2 = x + w / 2; g.globalCompositeOperation = 'lighter';
    var th = g.createLinearGradient(0, y, 0, y + h); th.addColorStop(0, 'rgba(255,236,190,.05)'); th.addColorStop(1, 'rgba(255,236,190,.7)');
    g.fillStyle = th; g.fillRect(cx2 - 2, y + 16, 4, h - 34); g.globalAlpha = 0.35; g.drawImage(SPR.glowW, cx2 - 16, y + 10, 32, h - 20); g.globalAlpha = 1;
    for (var d = y + h - 40, q = 0; d > y + 18; d -= 26, q++) { var tw = 0.5 + 0.5 * Math.sin(T * 6 - q * 0.9); g.fillStyle = 'rgba(255,240,205,' + (0.25 + tw * 0.5) * (1 - (y + h - d) / h * 0.7) + ')'; g.beginPath(); g.arc(cx2, d, 2.6, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    if (t.st === 2) {
      var top = Math.max(y, HITY - 2);
      g.globalCompositeOperation = 'lighter'; var fill = g.createLinearGradient(0, y + h, 0, top); fill.addColorStop(0, 'rgba(255,255,255,.75)'); fill.addColorStop(1, rgb(acc2, 0.35));
      g.fillStyle = fill; g.fillRect(x, top, w, y + h - top); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(cx2 - 3, top, 6, y + h - top); g.globalCompositeOperation = 'source-over';
    }
  }
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,' + (0.35 + prox * 0.45) + ')'; g.lineWidth = 1.5; rr(x + 0.75, y + 0.75, w - 1.5, h - 1.5, 10.5); g.stroke();
  // crescent emblem (it's a moonkey); held keys show a white bead riding the waterline
  var emY = t.long ? (t.st === 2 ? Math.max(y, HITY - 2) : y + h - 30) : y + h / 2, es = (t.long ? 24 : 28) * (1 + (next ? 0.12 * Math.sin(T * 7) : 0));
  if (t.st === 2) { g.globalCompositeOperation = 'lighter'; g.drawImage(SPR.star, x + w / 2 - 22, emY - 22, 44, 44); g.globalCompositeOperation = 'source-over'; }
  else { g.globalAlpha = 0.62; g.drawImage(SPR.crescent, x + w / 2 - es / 2, emY - es / 2, es, es); g.globalAlpha = 1; }
  if (t.start || (t.long && run.firstLong && !run.demo && t.st === 0)) {
    g.fillStyle = 'rgba(10,16,44,.82)'; g.font = '800 13px system-ui,-apple-system,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t.start ? 'START' : 'HOLD', x + w / 2, t.start ? y + h * 0.24 : y + h - 58);
    if (t.start) { var hy = y + h * 0.76; g.beginPath(); g.arc(x + w / 2, hy, 10 + 5 * (0.5 + 0.5 * Math.sin(T * 5)), 0, 7); g.strokeStyle = 'rgba(10,16,44,.55)'; g.lineWidth = 2; g.stroke(); }
  }
  // reflection on the lake
  if (R.b > HITY - ROWH * 1.4) {
    var near = Math.max(0, 1 - Math.max(0, HITY - R.b) / (ROWH * 1.4)), rh = Math.min(h, (H - HITY)) * 0.8, rg = g.createLinearGradient(0, HITY, 0, HITY + rh);
    rg.addColorStop(0, rgb(acc, 0.28 * near)); rg.addColorStop(1, rgb(acc, 0));
    g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.fillRect(x + 6 + Math.sin(T * 3) * 2, HITY + 2, w - 12, rh); g.globalCompositeOperation = 'source-over';
  }
}
function drawGhost() {
  var gh = run && run.ghost; if (!gh) return; gh.t += 1 / 60;
  var x = FX + gh.lane * LANEW + 2, h = ROWH - 4, y = gh.y - h / 2, a = 0.55 + 0.35 * Math.sin(T * 14);
  rr(x, y, LANEW - 4, h, 10); g.fillStyle = 'rgba(255,60,90,' + a * 0.55 + ')'; g.fill(); g.strokeStyle = 'rgba(255,140,160,' + a + ')'; g.lineWidth = 2; g.stroke();
  if (mode === 'play' && gh.t > 0.8) run.ghost = null;
}
function drawParticles() {
  g.globalCompositeOperation = 'lighter';
  motes.forEach(function (m) { var a = 0.25 + 0.35 * Math.sin(m.ph * 2.3); g.globalAlpha = Math.max(0, a); g.drawImage(SPR.glowAcc[palTarget], m.x - 7, m.y - 7, 14, 14); g.fillStyle = rgb(pal.acc2, Math.max(0, a)); g.fillRect(m.x - 0.7, m.y - 0.7, 1.4, 1.4); });
  g.globalAlpha = 1;
  parts.forEach(function (q) {
    var p = q.life / q.max, a = 1 - p;
    if (q.kind === 'shard') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.fillStyle = rgb(q.col, a * 0.85); g.beginPath(); g.moveTo(0, -q.r); g.lineTo(q.r * 0.5, 0); g.lineTo(0, q.r); g.lineTo(-q.r * 0.5, 0); g.closePath(); g.fill(); g.restore(); }
    else { var s = q.r * (q.kind === 'drop' ? 1 : 3.2) * (1 - p * 0.5); g.globalAlpha = a; if (q.kind !== 'drop') g.drawImage(SPR.glowW, q.x - s * 2, q.y - s * 2, s * 4, s * 4); g.fillStyle = rgb(q.col, a); g.fillRect(q.x - q.r * 0.5, q.y - q.r * 0.5, q.r, q.r); g.globalAlpha = 1; }
  });
  g.globalCompositeOperation = 'source-over';
}
function drawRings() {
  g.globalCompositeOperation = 'lighter';
  rings.forEach(function (r) { var p = r.t / 0.4, e = 1 - Math.pow(1 - p, 3), rad = 12 + e * (r.big ? 78 : 56); g.strokeStyle = rgb(r.col, (1 - p) * 0.85); g.lineWidth = (r.big ? 4 : 3) * (1 - p) + 0.5; g.beginPath(); g.arc(r.x, r.y, rad, 0, 7); g.stroke();
    g.globalAlpha = (1 - p) * 0.6; g.drawImage(SPR.glowAcc[palTarget], r.x - rad, r.y - rad, rad * 2, rad * 2); g.globalAlpha = 1; });
  g.globalCompositeOperation = 'source-over';
}
function drawTexts() {
  g.textAlign = 'center'; g.textBaseline = 'middle';
  texts.forEach(function (tx) { var p = tx.t / 0.9, sc = p < 0.15 ? 1.5 - p / 0.15 * 0.5 : 1, a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    g.save(); g.translate(tx.x, tx.y - p * 34); g.scale(sc, sc); g.font = '800 ' + tx.size + 'px system-ui,-apple-system,sans-serif';
    g.lineWidth = 4; g.strokeStyle = 'rgba(3,5,14,' + a * 0.7 + ')'; g.strokeText(tx.s, 0, 0); g.fillStyle = rgb(tx.col, a); g.fillText(tx.s, 0, 0); g.restore(); });
  if (run && !run.demo && run.combo >= 5 && (mode === 'play')) {
    var since = T - run.lastHitT, pop = since < 0.12 ? 1 + (0.12 - since) * 2.2 : 1;
    g.save(); g.translate(W / 2, TOPSAFE + 84); g.scale(pop, pop); g.font = '700 14px system-ui,-apple-system,sans-serif'; g.fillStyle = rgb(pal.acc2, 0.85); g.fillText(run.combo + ' in a row', 0, 0); g.restore();
  }
}
function drawBanner() {
  if (!banner) return; var p = banner.t / 2.4, a = p < 0.1 ? p / 0.1 : p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1, sc = p < 0.12 ? 0.6 + p / 0.12 * 0.55 : p < 0.2 ? 1.15 - (p - 0.12) / 0.08 * 0.15 : 1;
  var k = banner.k, icon = k <= 3 ? '★' : k <= 6 ? '♛' : '∞', cy = H * 0.34;
  g.save(); g.globalAlpha = a;
  var sb = g.createLinearGradient(0, cy - 110, 0, cy + 90); sb.addColorStop(0, 'rgba(3,5,14,0)'); sb.addColorStop(0.3, 'rgba(3,5,14,.72)'); sb.addColorStop(0.75, 'rgba(3,5,14,.72)'); sb.addColorStop(1, 'rgba(3,5,14,0)');
  g.fillStyle = sb; g.fillRect(0, cy - 110, W, 200);
  g.globalCompositeOperation = 'lighter'; g.drawImage(SPR.glowAcc[Math.min(6, k)], W / 2 - 200, cy - 130, 400, 220); g.globalCompositeOperation = 'source-over';
  g.translate(W / 2, cy); g.scale(sc, sc); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 64px system-ui,-apple-system,sans-serif'; g.fillStyle = rgb(PALS[Math.min(6, k)]._acc2); g.fillText(icon, 0, -34);
  g.font = '800 26px system-ui,-apple-system,sans-serif'; g.lineWidth = 4; g.strokeStyle = 'rgba(3,5,14,.8)'; g.strokeText(banner.text.toUpperCase(), 0, 22); g.fillStyle = '#fff'; g.fillText(banner.text.toUpperCase(), 0, 22);
  g.font = '600 13px system-ui,-apple-system,sans-serif'; g.fillStyle = rgb(PALS[Math.min(6, k)]._acc2, 0.85); g.fillText(banner.sub, 0, 50); g.restore();
}
function drawCount() {
  if (mode !== 'count') return; var n = Math.ceil(2.4 - run.countT), f = (2.4 - run.countT) % 0.8 / 0.8;
  g.save(); g.translate(W / 2, H * 0.4); g.scale(1 + f * 0.4, 1 + f * 0.4); g.globalAlpha = f; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 72px system-ui,-apple-system,sans-serif'; g.fillStyle = rgb(pal.acc2); g.fillText(Math.max(1, Math.ceil(n * 3 / 3)), 0, 0); g.restore();
}
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  var sx = 0, sy = 0; if (shake > 0.2) { sx = (Math.random() - 0.5) * shake; sy = (Math.random() - 0.5) * shake; }
  g.save(); g.translate(sx, sy);
  drawSky(); drawWater(); drawShore(); drawReeds(); drawLanes();
  if (run) {
    var next = null; for (var i = 0; i < run.tiles.length; i++) if (run.tiles[i].st === 0) { next = run.tiles[i]; break; }
    for (i = run.tiles.length - 1; i >= 0; i--) drawTile(run.tiles[i], run.tiles[i] === next && mode !== 'title');
    drawGhost();
    if (mode === 'dying' && run.failInfo && run.failInfo.kind === 'miss') { var R = tileRect(run.failInfo.tile), a = 0.5 + 0.4 * Math.sin(T * 16); rr(R.x, R.y, R.w, R.h, 10); g.fillStyle = 'rgba(255,60,90,' + a * 0.5 + ')'; g.fill(); g.strokeStyle = 'rgba(255,150,170,' + a + ')'; g.lineWidth = 2.5; g.stroke(); }
  }
  drawRings(); drawParticles(); drawTexts(); drawBanner(); drawCount();
  g.restore();
  // fly a star into the HUD
  if (run && run.flyStar) { var fs = run.flyStar, p = Math.min(1, fs.t / 1.1), e2 = p * p * (3 - 2 * p), slot = hudSlot(fs.k), x0 = W / 2, y0 = H * 0.36 - 34, x1 = slot.x, y1 = slot.y;
    var x = x0 + (x1 - x0) * e2, y = y0 + (y1 - y0) * e2 - Math.sin(p * Math.PI) * 60, s = 46 * (1 - p * 0.6); g.globalCompositeOperation = 'lighter'; g.drawImage(SPR.star, x - s, y - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; }
  // red pulse / flash / vignette / grain
  if (redPulse > 0.02) { var rg = g.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75); rg.addColorStop(0, 'rgba(255,40,70,0)'); rg.addColorStop(1, 'rgba(255,40,70,' + redPulse * 0.45 + ')'); g.fillStyle = rg; g.fillRect(0, 0, W, H); }
  if (flash > 0.02) { g.fillStyle = rgb(flashCol, flash * 0.5); g.fillRect(0, 0, W, H); }
  g.drawImage(BG.vig, 0, 0, W, H);
  g.globalAlpha = 0.045; g.globalCompositeOperation = 'overlay'; var ox = (Math.random() * 160) | 0, oy = (Math.random() * 160) | 0;
  for (var gx = -ox; gx < W; gx += 160) for (var gy = -oy; gy < H; gy += 160) g.drawImage(SPR.grain, gx, gy);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}

// ---------- HUD / overlays ----------
function hudSlot(k) { var el = document.querySelectorAll('#stages i')[Math.min(5, k - 1)]; if (!el) return { x: W / 2, y: 40 }; var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function setHud() { document.body.dataset.mode = mode === 'count' || mode === 'dying' || mode === 'ready' ? 'play' : mode; }
var lastScoreShown = -1;
function updateHud(bump) {
  if (!run) return;
  var sc = $('score'); if (run.score !== lastScoreShown) { sc.textContent = run.score; lastScoreShown = run.score; if (bump) { sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop'); } }
  var is = document.querySelectorAll('#stages i'); for (var i = 0; i < is.length; i++) is[i].classList.toggle('on', run.stage > i);
  $('endless').textContent = run.stage > 6 ? '∞' + (run.stage - 6) : '';
}
function progress() {
  if (!run || run.demo) return; var inPass = ((run.s % run.period) + run.period) % run.period / run.pass.len; $('progFill').style.transform = 'scaleX(' + Math.max(0, Math.min(1, inPass)).toFixed(3) + ')';
}
var toastT = 0;
function toast(s) { var el = $('toast'); el.textContent = s; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 3200); }
function overlay(id) { ['title', 'songs', 'how', 'over', 'pause'].forEach(function (o) { $(o).classList.toggle('hidden', o !== id); }); }
function showOver() {
  var r = songRec(run.song.id);
  $('overTitle').textContent = run.stage >= 7 ? 'Lost in the deep water' : run.stage >= 4 ? 'The crown slipped' : run.stage >= 1 ? 'The ripples settle' : 'The water stilled';
  $('overEyebrow').textContent = run.song.title;
  $('overScore').textContent = run.score;
  $('overStages').innerHTML = stageIcons(run.stage);
  $('overStat').textContent = (run.newBest ? 'New best! ' : 'Best ' + r.best + ' · ') + run.hits + (run.hits === 1 ? ' key' : ' keys') + ' · longest run ' + run.maxCombo + ' · ' + Math.round(100 * run.perfect / Math.max(1, run.hits)) + '% perfect';
  var rv = $('bRevive'); rv.style.display = run.revived ? 'none' : ''; 
  overlay('over'); mode = 'over'; setHud();
}
function stageIcons(n) { var s = ''; for (var i = 1; i <= 6; i++) s += '<span class="' + (n >= i ? 'on' : '') + '">' + (i <= 3 ? '★' : '♛') + '</span>'; if (n > 6) s += '<span class="on">∞' + (n - 6) + '</span>'; return s; }
function buildSongs() {
  var list = $('songList'); list.innerHTML = '';
  SONGS.forEach(function (s, i) {
    var r = songRec(s.id), open = unlocked(i), b = document.createElement('button'); b.className = 'song' + (open ? '' : ' locked');
    b.innerHTML = '<span class="sl"><b>' + s.title + '</b><small>' + s.by + ' · ' + '●●●●'.slice(0, s.tier) + '<span class="off">' + '●●●●'.slice(s.tier) + '</span></small>' +
      '<em>' + (open ? s.lede : 'Earn a ★ on “' + SONGS[i - 1].title + '” to wake this song.') + '</em></span>' +
      '<span class="sr"><span class="st">' + stageIcons(r.stage) + '</span><span class="best">' + (r.best ? 'best ' + r.best : open ? 'new' : '🔒') + '</span></span>';
    b.disabled = !open; b.addEventListener('click', function () { SFX.ui(); startSong(i); });
    list.appendChild(b);
  });
}
function startSong(i) {
  ensureAudio(); parts.length = 0; texts.length = 0; beams.length = 0; rings.length = 0; banner = null; lastScoreShown = -1;
  newRun(i, false); run.newBest = false; mode = 'ready'; overlay(null); setHud(); updateHud(false);
  $('songName').textContent = SONGS[i].title; $('progFill').style.transform = 'scaleX(0)';
  if (!save.played) toast('Tap the glowing keys as they reach the water. Never tap the empty lake.');
}
function demo() { newRun(0, true); run.started = true; run.speed = 1.4; run.s = run.tiles[0].r - 3.2; palTarget = 0; }
function pauseGame() { if (mode === 'play' || mode === 'ready' || mode === 'count') { run.pausedFrom = mode === 'ready' ? 'ready' : 'play'; for (var id in pointers) releasePointer(id); mode = 'paused'; overlay('pause'); setHud(); } }
function resume() { overlay(null); if (run.pausedFrom === 'ready') { mode = 'ready'; } else { mode = 'count'; run.countT = 0; SFX.count(1); } setHud(); }
function on(id, f) { $(id).addEventListener('click', f); }
function bind() {
  on('bPlay', function () { ensureAudio(); SFX.ui(); buildSongs(); overlay('songs'); });
  on('bHow', function () { SFX.ui(); overlay('how'); $('how').dataset.back = 'title'; });
  on('bHowOk', function () { SFX.ui(); var b = $('how').dataset.back; if (b === 'pause') overlay('pause'); else overlay('title'); });
  on('bSongsBack', function () { SFX.ui(); overlay('title'); if (!run || !run.demo) demo(); mode = 'title'; setHud(); });
  on('bRevive', function () { SFX.ui(); revive(); });
  on('bAgain', function () { SFX.ui(); startSong(run.si); });
  on('bOverSongs', function () { SFX.ui(); buildSongs(); overlay('songs'); demo(); mode = 'title'; setHud(); });
  on('bPause', function () { SFX.ui(); pauseGame(); });
  on('bResume', function () { SFX.ui(); resume(); });
  on('bQuit', function () { SFX.ui(); buildSongs(); overlay('songs'); demo(); mode = 'title'; setHud(); });
  on('bPauseHow', function () { SFX.ui(); overlay('how'); $('how').dataset.back = 'pause'; });
  on('tSound', function () { save.sound = !save.sound; writeSave(); if (master) master.gain.value = save.sound ? 0.9 : 0; syncToggles(); SFX.ui(); });
  on('tHaptic', function () { save.haptics = !save.haptics; writeSave(); syncToggles(); hap(10); });
}
function syncToggles() { $('tSound').textContent = save.sound ? 'On' : 'Off'; $('tHaptic').textContent = save.haptics ? 'On' : 'Off'; }
function arcadeChip() {
  if (!/\bfrom=arcade\b/.test(location.search || '')) return;
  document.documentElement.classList.add('arcade');
  var a = document.createElement('a'); a.href = '../../?from=game'; a.id = 'arcadeBack';
  a.innerHTML = '<span aria-hidden="true">←</span><span class="lbl">&nbsp;Library</span>';
  a.setAttribute('aria-label', 'Back to Night Arcade library');
  document.body.appendChild(a);
}

// ---------- loop ----------
var last = 0, frameTimes = [];
function frame(ts) {
  var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016; last = ts;
  frameTimes.push(dt); if (frameTimes.length > 120) frameTimes.shift();
  update(dt); render(); progress();
  requestAnimationFrame(frame);
}
if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
window.addEventListener('resize', layout);
document.addEventListener('visibilitychange', function () { if (document.hidden) { pauseGame(); if (AC) AC.suspend(); } else if (AC && save.sound) AC.resume(); });
buildSprites(); layout(); bind(); syncToggles(); arcadeChip(); demo(); mode = 'title'; overlay('title'); setHud(); requestAnimationFrame(frame);

// exposed for tools/tests
window.Lull = { SONGS: SONGS, save: save, startSong: startSong, frameTimes: frameTimes, tileRect: tileRect, yB: yB,
  get run() { return run; }, get mode() { return mode; }, get HITY() { return HITY; }, get ROWH() { return ROWH; }, get H() { return H; },
  next: function () { if (!run) return null; for (var i = 0; i < run.tiles.length; i++) if (run.tiles[i].st === 0) { var t = run.tiles[i], R = tileRect(t); return { lane: t.lane, long: t.long, h: t.h, cx: R.x + R.w / 2, y: R.y, b: R.b, r: t.r, pair: !!t.pair, idx: i }; } return null; },
  pending: function () { var o = []; if (!run) return o; run.tiles.forEach(function (t) { if (t.st === 0) { var R = tileRect(t); if (R.b > 0) o.push({ cx: R.x + R.w / 2, b: R.b, y: R.y, long: t.long, h: t.h }); } }); return o; },
  unlockAll: function () { save.unlockAll = true; writeSave(); buildSongs(); },
  cover: function (si, k) { newRun(si, true); run.started = true; run.speed = 1.6; run.s = run.tiles[0].r + 6; palTarget = k; for (var key in pal) pal[key] = PALS[k]['_' + key].slice(); overlay(null); mode = 'title'; setHud(); },
  stageUp: function (k) { stageUp(k); }, setPal: function (k) { palTarget = k; for (var key in pal) pal[key] = PALS[k]['_' + key].slice(); } };
})();
