/* Stillwater — ink & ember. Sort the stream: thoughts drift down as ink stones.
   Swipe right to keep what is yours (it becomes a lantern in your garden), left to let what isn't float
   downstream, up to split a stone that is part yours. Input: pointer events only (down / move / up). */
(function () {
  'use strict';
  const SW = window.SW, PONDS = SW.PONDS;
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const FONT = '"Hiragino Mincho ProN","Songti SC","Iowan Old Style",Palatino,Georgia,serif';
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  let W = 0, H = 0, DPR = 1, bgc, vgc;
  const SAVE_KEY = 'stillwater:v1';
  let save = { unlocked: 1, plans: [], done: [], reviews: [], garden: [] };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  if (!Array.isArray(save.garden)) save.garden = [];
  if (!Array.isArray(save.reviews)) save.reviews = [];
  if (save.v !== 3) { save.v = 3; save.unlocked = 1; save.done = []; } // new game: content changed
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };
  let koi = [], motes = [], storyKind = '';
  for (let i = 0; i < 4; i++) koi.push({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.25, s: (0.03 + Math.random() * 0.03) * (i % 2 ? 1 : -1), ph: Math.random() * TAU });
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildBg(); buildVignette(); flow = []; for (let i = 0; i < 70; i++) flow.push({ x: Math.random() * W, y: Math.random() * H, len: 20 + Math.random() * 50, spd: 24 + Math.random() * 40, ph: Math.random() * TAU, a: 0.05 + Math.random() * 0.12 });
    if (card) { card.hx = W / 2; card.hy = homeY(); }
  }
  let flow = [];
  // ---------- seeded noise
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---------- painted background: ink-blue water, paper grain, lotus pads, moon
  let pads = [];
  function buildBg() {
    bgc = document.createElement('canvas'); bgc.width = cv.width; bgc.height = cv.height;
    const b = bgc.getContext('2d'); b.scale(DPR, DPR);
    const gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1830'); gr.addColorStop(0.5, '#0b1426'); gr.addColorStop(1, '#070c18');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    // ink wash blooms
    seed = 11;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * W, y = rnd() * H, r = 60 + rnd() * 180, rg = b.createRadialGradient(x, y, 0, x, y, r);
      const dark = rnd() < 0.6; rg.addColorStop(0, dark ? 'rgba(3,6,12,.32)' : 'rgba(32,52,92,.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = rg; b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // moon reflection
    const mx = W * 0.72, my = H * 0.13, mr = b.createRadialGradient(mx, my, 0, mx, my, 140);
    mr.addColorStop(0, 'rgba(255,241,194,.10)'); mr.addColorStop(1, 'rgba(255,241,194,0)'); b.fillStyle = mr; b.fillRect(mx - 140, my - 140, 280, 280);
    // lotus pads along edges (sumi ink)
    pads = [];
    for (let i = 0; i < 9; i++) {
      const side = i % 3, x = side === 0 ? rnd() * W * 0.16 : side === 1 ? W - rnd() * W * 0.16 : rnd() * W, y = side === 2 ? (rnd() < 0.5 ? H - 20 - rnd() * 40 : 70 + rnd() * 30) : 120 + rnd() * (H - 220);
      pads.push({ x, y, r: 14 + rnd() * 20, a: rnd() * TAU });
    }
    for (const p of pads) {
      b.save(); b.translate(p.x, p.y); b.rotate(p.a); b.scale(1, 0.62);
      b.fillStyle = 'rgba(16,46,48,.85)'; b.beginPath(); b.moveTo(0, 0); b.arc(0, 0, p.r, 0.35, TAU - 0.05); b.closePath(); b.fill();
      b.strokeStyle = 'rgba(79,227,193,.16)'; b.lineWidth = 1.2; b.stroke();
      b.strokeStyle = 'rgba(5,8,12,.5)'; b.lineWidth = 0.8;
      for (let k = 0; k < 6; k++) { const a = 0.6 + k * 0.95; b.beginPath(); b.moveTo(0, 0); b.lineTo(Math.cos(a) * p.r * 0.85, Math.sin(a) * p.r * 0.85); b.stroke(); }
      b.restore();
    }
    // paper grain
    const gn = b.getImageData(0, 0, bgc.width, bgc.height), d = gn.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.2; }
    b.putImageData(gn, 0, 0);
  }
  function buildVignette() {
    vgc = document.createElement('canvas'); vgc.width = cv.width; vgc.height = cv.height;
    const v = vgc.getContext('2d'); v.scale(DPR, DPR);
    const rg = v.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(2,3,8,.82)'); v.fillStyle = rg; v.fillRect(0, 0, W, H);
  }

  // ---------- brush glyphs (normalised strokes; each point [x,y,w])
  function strokeFrom(fn, n, wmax) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n; const [x, y] = fn(t); out.push([x, y, wmax * (0.18 + 0.82 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.7))]); } return out; }
  const GLYPH = {
    serpent: [strokeFrom(t => [Math.sin(t * Math.PI * 2.3 + 0.4) * 0.55 * (1 - t * 0.35), -0.95 + t * 1.9], 46, 0.24),
      strokeFrom(t => [0.22 + t * 0.18, -0.98 + Math.sin(t * 3) * 0.08], 8, 0.08)],
    mask: [strokeFrom(t => [Math.sin(t * TAU) * 0.6, -Math.cos(t * TAU) * 0.86], 50, 0.16),
      strokeFrom(t => [-0.38 + t * 0.26, -0.12 + Math.sin(t * Math.PI) * -0.1], 10, 0.13),
      strokeFrom(t => [0.12 + t * 0.26, -0.12 + Math.sin(t * Math.PI) * -0.1], 10, 0.13),
      strokeFrom(t => [0, -0.62 + t * 1.2], 16, 0.07)],
    thorn: [strokeFrom(t => [Math.sin(t * 5) * 0.05, -1 + t * 2], 30, 0.15),
      strokeFrom(t => [-t * 0.6, -0.5 - t * 0.35], 8, 0.09), strokeFrom(t => [t * 0.55, -0.15 - t * 0.38], 8, 0.09),
      strokeFrom(t => [-t * 0.5, 0.2 - t * 0.3], 8, 0.08), strokeFrom(t => [t * 0.45, 0.5 - t * 0.28], 8, 0.08),
      strokeFrom(t => [-t * 0.3, -0.8 - t * 0.12], 6, 0.06)],
    lotus: [0, 1, 2, 3, 4].map(k => strokeFrom(t => { const a = -Math.PI / 2 + (k - 2) * 0.55, r = Math.sin(t * Math.PI) * 0.95; const side = (t - 0.5) * 0.5; return [Math.cos(a) * r + Math.cos(a + 1.57) * side * Math.sin(t * Math.PI), Math.sin(a) * r * 0.9 + 0.45 + Math.sin(a + 1.57) * side * Math.sin(t * Math.PI)]; }, 18, 0.12))
  };
  function drawStroke(pts, cx, cy, S, frac, jit) {
    const n = Math.max(2, Math.floor(pts.length * frac)); if (n < 2) return;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], p = pts[i];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = p[2] * S * (1 + (jit ? Math.sin(i * 2.7 + jit) * 0.18 : 0));
      L.push([cx + p[0] * S - dy * w, cy + p[1] * S + dx * w]); R.push([cx + p[0] * S + dy * w, cy + p[1] * S - dx * w]);
    }
    g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) g.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); g.fill();
  }
  function glyphPoint(kind, frac) { const s = GLYPH[kind][0]; return s[Math.min(s.length - 1, Math.floor(s.length * frac))]; }

  // ---------- audio: breath drone that beats with unrest, pentatonic plucks, temple bell
  let ac = null, au = {};
  function audioInit() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    ac = new A();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.connect(ac.destination);
    au.master = ac.createGain(); au.master.gain.value = 0.9; au.master.connect(comp);
    const rev = ac.createConvolver(); const len = ac.sampleRate * 3.2, ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    rev.buffer = ib; au.rev = ac.createGain(); au.rev.gain.value = 0.5; au.rev.connect(rev); rev.connect(au.master);
    au.bus = ac.createGain(); au.bus.connect(au.master); au.bus.connect(au.rev);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
    au.drone = ac.createGain(); au.drone.gain.value = 0; lp.connect(au.drone); au.drone.connect(au.master); au.drone.connect(au.rev);
    [[73.42, 'sine', 0.5], [110, 'sine', 0.22], [146.83, 'triangle', 0.12], [73.6, 'sine', 0.3]].forEach(([f, t, v]) => { const o = ac.createOscillator(), gg = ac.createGain(); o.type = t; o.frequency.value = f; gg.gain.value = v; o.connect(gg); gg.connect(lp); o.start(); });
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 180; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    // unrest: two voices detuned against the drone; detune and level follow pond chaos
    const ulp = ac.createBiquadFilter(); ulp.type = 'lowpass'; ulp.frequency.value = 900;
    au.unrest = ac.createGain(); au.unrest.gain.value = 0; ulp.connect(au.unrest); au.unrest.connect(au.master);
    au.u1 = ac.createOscillator(); au.u1.type = 'sawtooth'; au.u1.frequency.value = 146.83; au.u1.connect(ulp); au.u1.start();
    au.u2 = ac.createOscillator(); au.u2.type = 'triangle'; au.u2.frequency.value = 220; au.u2.connect(ulp); au.u2.start();
    // breath noise rises while you hold
    const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
    au.bp = ac.createBiquadFilter(); au.bp.type = 'bandpass'; au.bp.frequency.value = 600; au.bp.Q.value = 0.9;
    au.breath = ac.createGain(); au.breath.gain.value = 0; ns.connect(au.bp); au.bp.connect(au.breath); au.breath.connect(au.master); ns.start();
    au.noise = nb;
    au.drone.gain.setTargetAtTime(0.16, ac.currentTime, 2.5);
    // harmony that fills in as the pond resolves (D major add9 over the D drone)
    au.res = [293.66, 369.99, 440, 659.25].map(f => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = f; gn.gain.value = 0; o.connect(gn); gn.connect(au.bus); o.start(); return gn; });
  }
  const PENTA = [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46];
  let pi = 0;
  function env(gn, t, a, peak, d) { gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(peak, t + a); gn.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function pluck(f, v = 0.22) {
    if (!ac) return; const t = ac.currentTime;
    [[f, 'triangle', v], [f * 2, 'sine', v * 0.35], [f * 3.01, 'sine', v * 0.08]].forEach(([fr, ty, vv]) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = ty; o.frequency.value = fr; o.connect(gn); gn.connect(au.bus); env(gn, t, 0.005, vv, 1.6); o.start(t); o.stop(t + 1.8); });
  }
  function bell(f = 196, v = 0.3) {
    if (!ac) return; const t = ac.currentTime;
    [[0.5, 0.5, 7], [1, 1, 5.5], [1.19, 0.45, 4], [1.56, 0.35, 3.4], [2, 0.3, 3], [2.66, 0.18, 2.2], [3.01, 0.12, 1.8], [4.07, 0.06, 1.2]].forEach(([m, a, d]) => {
      const o = ac.createOscillator(), gn = ac.createGain(); o.frequency.value = f * m; o.connect(gn); gn.connect(au.bus); env(gn, t, 0.004, v * a, d); o.start(t); o.stop(t + d + 0.1); });
  }
  function chord() {
    if (!ac) return; const t = ac.currentTime;
    [146.83, 220, 293.66, 329.63, 440].forEach((f, i) => { const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = f; o.connect(gn); gn.connect(au.bus);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.07, t + 0.9 + i * 0.12); gn.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.start(t); o.stop(t + 6.2); });
  }
  function thud() {
    if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.45); o.connect(gn); gn.connect(au.master); env(gn, t, 0.005, 0.55, 0.5); o.start(t); o.stop(t + 0.6);
  }
  function hiss(v = 0.25, f = 1400, d = 0.6) {
    if (!ac) return; const t = ac.currentTime, s = ac.createBufferSource(), bp = ac.createBiquadFilter(), gn = ac.createGain();
    s.buffer = au.noise; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2; s.connect(bp); bp.connect(gn); gn.connect(au.bus); env(gn, t, 0.01, v, d); s.start(t); s.stop(t + d + 0.1);
  }
  function setRes(f) { if (!ac) return; au.res.forEach((gn, i) => gn.gain.setTargetAtTime(f > i / 4 + 0.01 ? 0.03 - i * 0.004 : 0, ac.currentTime, 1.2)); }
  function plop() { if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.12); o.connect(gn); gn.connect(au.bus); env(gn, t, 0.003, 0.22, 0.25); o.start(t); o.stop(t + 0.3); hiss(0.05, 2400, 0.25); }
  function sub() { if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), gn = ac.createGain(); o.frequency.setValueAtTime(58, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); o.connect(gn); gn.connect(au.master); env(gn, t, 0.004, 0.5, 0.28); o.start(t); o.stop(t + 0.35); }

  function drawMotes(dt) {
    g.globalCompositeOperation = 'lighter';
    for (let i = motes.length - 1; i >= 0; i--) {
      const m = motes[i]; m.t += dt; if (m.t >= m.life) { motes.splice(i, 1); continue; }
      m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= 0.96; m.vy = m.vy * 0.96 - 6 * dt;
      const a = 1 - m.t / m.life, c = m.col === 'gold' ? '255,214,120' : m.col === 'teal' ? '79,227,193' : '190,200,225';
      g.fillStyle = `rgba(${c},${a * 0.9})`; g.beginPath(); g.arc(m.x, m.y, m.r * (0.6 + a), 0, TAU); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    if (motes.length > 500) motes.splice(0, motes.length - 500);
  }
  function drawKoi(t) {
    for (const k of koi) {
      const a = k.a + t * k.s, cx = W / 2 + Math.cos(a) * W * k.r, cy = H * 0.52 + Math.sin(a) * H * k.r * 0.7, dir = a + (k.s > 0 ? Math.PI / 2 : -Math.PI / 2);
      g.save(); g.translate(cx, cy); g.rotate(dir); g.globalAlpha = 0.32;
      g.fillStyle = '#05080e'; g.beginPath(); g.ellipse(0, 0, 13, 4.5, 0, 0, TAU); g.fill();
      const wag = Math.sin(t * 4 + k.ph) * 4; g.beginPath(); g.moveTo(-11, 0); g.lineTo(-21, -5 + wag); g.lineTo(-21, 5 + wag); g.closePath(); g.fill();
      g.globalAlpha = 0.18; g.fillStyle = '#f2c14e'; g.beginPath(); g.ellipse(4, -1, 4, 2, 0, 0, TAU); g.fill();
      g.restore();
    }
  }
  function drawBell(t, u) {
    // drowned monastery glimpse: caustics, pagoda eave, bronze bell with teal glyphs
    const cx = W / 2, cy = H * 0.42, a = clamp(u, 0, 1);
    g.save(); g.globalAlpha = a;
    g.fillStyle = 'rgba(3,10,14,.55)'; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(79,227,193,${0.05 + 0.03 * Math.sin(t + i)})`; g.lineWidth = 1.2; g.beginPath();
      for (let x = 0; x <= W; x += 12) { const y = i * H / 14 + Math.sin(x * 0.03 + t * 0.9 + i) * 14 + Math.sin(x * 0.011 - t * 0.6) * 22; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    // eave silhouette
    g.fillStyle = 'rgba(2,6,10,.85)'; g.beginPath(); g.moveTo(cx - W * 0.48, cy - 130); g.quadraticCurveTo(cx, cy - 175, cx + W * 0.48, cy - 130); g.lineTo(cx + W * 0.34, cy - 118); g.quadraticCurveTo(cx, cy - 150, cx - W * 0.34, cy - 118); g.closePath(); g.fill();
    g.fillRect(cx - 2, cy - 140, 4, 40);
    // bell
    const sw = Math.sin(t * 1.3) * 0.04; g.translate(cx, cy - 100); g.rotate(sw);
    const bg = g.createLinearGradient(-60, 0, 60, 0); bg.addColorStop(0, '#0d1a17'); bg.addColorStop(0.45, '#3c4a3a'); bg.addColorStop(0.6, '#56614a'); bg.addColorStop(1, '#0b1412');
    g.fillStyle = bg; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.bezierCurveTo(46, 10, 50, 90, 62, 150); g.lineTo(-62, 150); g.bezierCurveTo(-50, 90, -46, 10, -14, 0); g.fill();
    g.fillStyle = '#1b2622'; g.fillRect(-66, 146, 132, 9);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(79,227,193,${0.5 + 0.3 * Math.sin(t * 2)})`;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { g.beginPath(); g.arc(-27 + c * 18, 50 + r * 26, 2.6, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(79,227,193,.6)'; drawStroke(GLYPH.serpent[0], 0, 110, 12, 1, 1);
    g.restore();
    // lit lantern on the hook beat
    if (storyKind === 'hook') { const lx = cx + 92, ly = cy + 40, lg = g.createRadialGradient(lx, ly, 0, lx, ly, 70); lg.addColorStop(0, `rgba(242,193,78,${0.6 * a})`); lg.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = lg; g.fillRect(lx - 70, ly - 70, 140, 140); g.fillStyle = `rgba(255,241,194,${a})`; g.fillRect(lx - 4, ly - 7, 8, 14); g.globalCompositeOperation = 'source-over'; }
    if (Math.random() < 0.3) motes.push({ x: Math.random() * W, y: H, vx: 0, vy: -30 - Math.random() * 30, life: 4, t: 0, col: 'teal', r: 1 });
  }
  function burst(x, y, n, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 90; motes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1 + Math.random() * 1.4, t: 0, col, r: 0.8 + Math.random() * 1.8 }); }
  }

  // ---------- layout
  const shoreY = () => H - 150;
  const homeY = () => Math.min(H * 0.43, shoreY() - 170);
  const cardW = () => Math.min(300, W - 70);

  // ---------- state
  let mode = 'title', pondIx = 0, st = null, card = null, flying = [], floats = [], drag = null, clock = 0, flash = 0, shake = 0, toastT = 0, storyT = 0, nextAt = -1, endAt = -1;
  let tut = null, hintFor = null, idleT = 0, nudged = false, lit = {};
  function show(id) { ['title', 'intro', 'end', 'story'].forEach(k => $(k).classList.toggle('on', k === id)); $('hud').classList.toggle('on', id === null || id === 'intro'); $('menu').classList.toggle('on', id === null); }
  function toast(msg, dur = 3.6) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); toastT = dur; }

  // ---------- garden: every stone you kept, persisted across days
  function slot(i, n) {
    const rows = 3, per = Math.max(8, Math.ceil(n / rows)), r = Math.floor(i / per), j = i % per, h = (i * 2654435761 >>> 0) / 4294967296;
    const sc = clamp(8 / per * 1.05, 0.42, 1);
    return { x: 18 + (j + 0.5 + (h - 0.5) * 0.5) * (W - 36) / per, y: shoreY() + 54 + r * 30 + (h - 0.5) * 10 + (r % 2) * 4, s: sc };
  }
  function addToGarden(text) {
    let i = save.garden.findIndex(x => x.t === text);
    if (i < 0) { save.garden.push({ t: text, p: pondIx, d: new Date().toISOString().slice(0, 10) }); i = save.garden.length - 1; persist(); }
    lit[i] = clock; return i;
  }
  function gardenTarget(text) { let i = save.garden.findIndex(x => x.t === text); const n = save.garden.length + (i < 0 ? 1 : 0); if (i < 0) i = n - 1; return slot(i, n); }
  function drawLantern(x, y, s, glow, t, k) {
    const fl = 0.85 + 0.15 * Math.sin(t * 3.1 + k * 1.7) * Math.sin(t * 1.3 + k);
    g.globalCompositeOperation = 'lighter';
    const R = 26 * s * (1 + glow * 0.8), rg = g.createRadialGradient(x, y - 8 * s, 0, x, y - 8 * s, R);
    rg.addColorStop(0, `rgba(242,193,78,${(0.32 + glow * 0.5) * fl})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - R, y - 8 * s - R, R * 2, R * 2);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(4,8,14,.9)'; g.beginPath(); g.ellipse(x, y + 2 * s, 9 * s, 3.2 * s, 0, 0, TAU); g.fill();
    const bg = g.createLinearGradient(x, y - 17 * s, x, y); bg.addColorStop(0, `rgba(255,232,170,${0.95 * fl})`); bg.addColorStop(1, `rgba(214,140,48,${0.9 * fl})`);
    g.fillStyle = bg; g.beginPath(); g.ellipse(x, y - 8 * s, 5.2 * s, 7.5 * s, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(30,18,6,.8)'; g.fillRect(x - 3.6 * s, y - 16.5 * s, 7.2 * s, 1.8 * s); g.fillRect(x - 3.6 * s, y - 1.6 * s, 7.2 * s, 1.6 * s);
  }
  function drawShore(t) {
    const y0 = shoreY();
    const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, 'rgba(3,6,10,0)'); gr.addColorStop(0.25, 'rgba(3,6,10,.72)'); gr.addColorStop(1, 'rgba(2,3,6,.95)');
    g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
    // ink grass along the bank
    g.strokeStyle = 'rgba(79,227,193,.14)'; g.lineWidth = 1;
    for (let i = 0; i < 46; i++) { const x = (i * 97 % W), h = 8 + (i * 37 % 14), sw = Math.sin(t * 0.8 + i) * 2.5; g.beginPath(); g.moveTo(x, y0 + 38); g.quadraticCurveTo(x + sw, y0 + 38 - h * 0.6, x + sw * 2, y0 + 38 - h); g.stroke(); }
    const n = save.garden.length;
    for (let i = 0; i < n; i++) { const p = slot(i, n), gl = lit[i] != null ? clamp(1 - (clock - lit[i]) / 1.6, 0, 1) : 0; drawLantern(p.x, p.y, p.s, gl, t, i); }
    if (!n && mode !== 'title') { g.font = 'italic 13px ' + FONT; g.textAlign = 'center'; g.fillStyle = 'rgba(159,178,204,.45)'; g.fillText('your lantern garden grows here', W / 2, y0 + 78); }
  }

  // ---------- stream
  function drawStream(dt, t) {
    const sp = st ? 1 + (1.7 - st.P.drift) * 0.6 : 0.8;
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    for (const f of flow) {
      f.y += f.spd * sp * dt; if (f.y - f.len > shoreY() + 20) { f.y = -10; f.x = Math.random() * W; }
      const x = f.x + Math.sin(f.y * 0.012 + f.ph + t * 0.2) * 16, x2 = f.x + Math.sin((f.y - f.len) * 0.012 + f.ph + t * 0.2) * 16;
      g.strokeStyle = `rgba(79,227,193,${f.a})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, f.y); g.lineTo(x2, f.y - f.len); g.stroke();
    }
    // moon path on the water
    for (let i = 0; i < 12; i++) { const y = 120 + i * 26, w = 30 + Math.sin(t * 0.9 + i * 1.7) * 14 + i * 3; g.strokeStyle = `rgba(255,241,194,${0.05 + 0.03 * Math.sin(t * 1.4 + i)})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(W * 0.68 - w / 2 + Math.sin(t + i) * 6, y); g.lineTo(W * 0.68 + w / 2 + Math.sin(t + i) * 6, y); g.stroke(); }
    g.globalCompositeOperation = 'source-over'; g.lineCap = 'butt';
  }

  // ---------- stones
  function wrap(text, maxW, px) {
    g.font = px + 'px ' + FONT; const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tr = cur ? cur + ' ' + w : w; if (g.measureText(tr).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tr; }
    if (cur) lines.push(cur); return lines;
  }
  function mkCard(d, x, y, scale) {
    const w = cardW() * (scale || 1), px = Math.round(25 * (scale || 1)), lines = wrap(d.t, w - 56 * (scale || 1), px);
    const h = Math.max(118 * (scale || 1), (lines.length * px * 1.28 + 70 * (scale || 1)));
    return { d, x, y, hx: W / 2, hy: homeY(), vx: 0, vy: 0, r: 0, vr: 0, w, h, px, lines, st: 'arrive', t0: clock, alpha: 1, scale: 1, seed: Math.random() * 10, glow: 0 };
  }
  function stonePath(c) {
    const w = c.w / 2, h = c.h / 2, n = 28; g.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * TAU, j = 1 + Math.sin(a * 3 + c.seed) * 0.025 + Math.sin(a * 5 + c.seed * 2) * 0.015;
      const cx = Math.cos(a), sy = Math.sin(a), ex = Math.sign(cx) * Math.pow(Math.abs(cx), 0.55), ey = Math.sign(sy) * Math.pow(Math.abs(sy), 0.7);
      const X = ex * w * j, Y = ey * h * j; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
    g.closePath();
  }
  function drawCard(c, t) {
    const dx = c.x - c.hx, dy = c.y - c.hy, k = c === card ? clamp(dx / (W * 0.28), -1, 1) : 0, up = c === card ? clamp(-dy / 110, 0, 1) * (Math.abs(dx) < 60 ? 1 : 0) : 0;
    g.save(); g.globalAlpha = c.alpha; g.translate(c.x, c.y); g.rotate(c.r); g.scale(c.scale, c.scale);
    // glow halo
    g.globalCompositeOperation = 'lighter';
    const hc = k > 0 ? `242,193,78` : k < 0 ? `159,178,204` : `79,227,193`, ha = 0.16 + Math.abs(k) * 0.28 + c.glow * 0.5 + up * 0.2;
    const rg = g.createRadialGradient(0, 0, c.h * 0.3, 0, 0, c.w * 0.75); rg.addColorStop(0, `rgba(${up > 0.2 ? '79,227,193' : hc},${ha})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(-c.w, -c.w, c.w * 2, c.w * 2);
    g.globalCompositeOperation = 'source-over';
    // shadow, then ink stone
    g.save(); g.translate(4, 9); stonePath(c); g.fillStyle = 'rgba(0,0,0,.45)'; g.fill(); g.restore();
    stonePath(c);
    const fg = g.createLinearGradient(0, -c.h / 2, 0, c.h / 2); fg.addColorStop(0, '#16253c'); fg.addColorStop(0.55, '#0c1628'); fg.addColorStop(1, '#070d18');
    g.fillStyle = fg; g.fill();
    // ink wash texture
    g.save(); stonePath(c); g.clip();
    for (let i = 0; i < 5; i++) { const ix = Math.sin(c.seed * 3 + i * 2.1) * c.w * 0.35, iy = Math.cos(c.seed * 2 + i * 1.3) * c.h * 0.3, ir = c.h * (0.4 + 0.2 * Math.sin(i + c.seed)); const ig = g.createRadialGradient(ix, iy, 0, ix, iy, ir); ig.addColorStop(0, 'rgba(40,70,110,.22)'); ig.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = ig; g.fillRect(-c.w, -c.h, c.w * 2, c.h * 2); }
    if (k > 0) { g.fillStyle = `rgba(242,193,78,${k * 0.16})`; g.fillRect(-c.w, -c.h, c.w * 2, c.h * 2); }
    if (k < 0) { g.fillStyle = `rgba(159,178,204,${-k * 0.12})`; g.fillRect(-c.w, -c.h, c.w * 2, c.h * 2); }
    g.restore();
    // rim
    stonePath(c); g.lineWidth = 1.6; g.strokeStyle = k > 0.05 ? `rgba(242,193,78,${0.4 + k * 0.6})` : k < -0.05 ? `rgba(190,205,230,${0.35 - k * 0.5})` : 'rgba(79,227,193,.45)'; g.stroke();
    if (c.d.a === 's' && c === card) { g.setLineDash([4, 6]); g.strokeStyle = `rgba(79,227,193,${0.35 + up * 0.6})`; g.beginPath(); g.moveTo(0, -c.h / 2 + 10); g.lineTo(0, c.h / 2 - 10); g.stroke(); g.setLineDash([]); }
    // text
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = c.px + 'px ' + FONT;
    const lh = c.px * 1.28, y0 = -(c.lines.length - 1) * lh / 2;
    g.shadowColor = 'rgba(79,227,193,.35)'; g.shadowBlur = 10; g.fillStyle = '#f3f7ff';
    c.lines.forEach((l, i) => g.fillText(l, 0, y0 + i * lh)); g.shadowBlur = 0;
    // stamps
    if (c === card) {
      const stamp = (txt, x, y, a, col, rot) => { if (a <= 0.02) return; g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = c.alpha * clamp(a, 0, 1); g.font = '600 15px ' + FONT; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6;
        const tw = g.measureText(txt).width + 18; g.strokeRect(-tw / 2, -13, tw, 26); g.fillText(txt, 0, 1); g.restore(); };
      stamp('KEEP · MINE', -c.w / 2 + 70, -c.h / 2 + 4, k * 1.6, '#f2c14e', -0.16);
      stamp('LET IT GO', c.w / 2 - 62, -c.h / 2 + 4, -k * 1.6, '#c9d6ec', 0.16);
      stamp('SPLIT', 0, -c.h / 2 - 2, up * 1.5, '#4fe3c1', 0);
    }
    g.restore(); g.textBaseline = 'alphabetic';
  }

  // ---------- pond flow
  function startPond(i) {
    pondIx = i; const P = PONDS[i];
    st = { i, P, ix: 0, n: P.stones.length, first: 0, streak: 0, best: 0, kept: 0, wrongs: 0, missed: {} };
    card = null; flying = []; floats = []; drag = null; hintFor = null; tut = null; nextAt = -1; endAt = -1; setRes(0);
    $('hn').textContent = ROMAN[i] + ' · ' + P.lens.toUpperCase(); $('ht').textContent = P.name;
    $('iNum').textContent = 'POND ' + ROMAN[i]; $('iName').textContent = P.name; $('iLens').textContent = P.lens; $('iScene').textContent = P.scene;
    $('iHint').textContent = i === 0 ? 'Swipe right to keep what is yours. Swipe left to let the rest float away.' : P.stones.some(s => s.a === 's') ? 'Right: mine · Left: not mine · Up: split it' : 'Right: mine · Left: not mine';
    show('intro'); mode = 'intro';
  }
  function play() { show(null); mode = 'play'; bell(196, 0.1); nextAt = clock + 0.3; }
  function spawn() {
    const d = st.P.stones[st.ix]; card = mkCard(d, W / 2, -120); card.arrive = st.P.drift; idleT = 0; nudged = false; hintFor = null;
    tut = null;
    if (pondIx === 0 && st.ix === 0) { tut = 'r'; toast('Not in your hands? Swipe it left. Let it float downstream.', 99); }
    else if (pondIx === 0 && st.ix === 1) { tut = 'k'; toast('In your hands? Swipe it right. Keep it in your garden.', 99); }
    else if (pondIx === 0 && st.ix === 2) toast('Your turn.', 2.2);
    else if (d.a === 's' && !save.splitSeen) { tut = 's'; toast('Some stones are both. Swipe up to split off the part that is yours.', 99); }
  }
  function finish() {
    mode = 'still'; chord(); setTimeout(() => bell(196, 0.2), 600);
    save.done[pondIx] = 1; save.unlocked = Math.max(save.unlocked, Math.min(PONDS.length, pondIx + 2)); persist();
    const P = st.P;
    setTimeout(() => {
      $('eQuote').textContent = P.lesson; $('eCite').textContent = P.cite;
      $('eScore').textContent = (st.first === st.n ? 'All ' + st.n + ' sorted at first sight' : st.first + ' of ' + st.n + ' sorted at first sight') + ' · ' + st.kept + ' lantern' + (st.kept === 1 ? '' : 's') + ' lit' + (st.best >= 3 ? ' · flow ×' + st.best : '');
      $('ePlan').textContent = 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.';
      $('bKeep').textContent = 'Keep this plan'; $('bNext').textContent = pondIx === PONDS.length - 1 ? 'Rest' : 'Next pond';
      const rc = $('eRef'); rc.innerHTML = ''; $('eRefNote').textContent = '';
      P.reflect.forEach((txt, j) => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = txt; c.setAttribute('role', 'button');
        c.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); audioInit(); pickReflect(j, c); }); rc.appendChild(c); });
      show('end'); mode = 'end';
    }, 1500);
  }

  // ---------- judging a swipe
  function decide(v) {
    const c = card, dx = c.x - c.hx, dy = c.y - c.hy;
    let dir = null;
    if ((dy < -85 || (v.y < -750 && dy < -25)) && -dy > Math.abs(dx) * 0.9) dir = 's';
    else if (dx > W * 0.22 || (v.x > 650 && dx > 24)) dir = 'k';
    else if (dx < -W * 0.22 || (v.x < -650 && dx < -24)) dir = 'r';
    if (!dir) { c.st = 'back'; c.vx = v.x * 0.25; c.vy = v.y * 0.25; pluck(PENTA[0], 0.035); return; }
    if (SW.judge(c.d, dir)) right(c, dir, v); else wrong(c, dir, v);
  }
  function right(c, dir, v) {
    if (!c.missed) { st.first++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
    if (tut) { $('toast').classList.remove('on'); toastT = 0; if (tut === 's') { save.splitSeen = 1; persist(); } tut = null; }
    const combo = st.streak >= 3;
    act(c, dir, v, combo);
    st.ix++; card = null; nextAt = clock + 0.55; setRes(st.ix / st.n);
    if (combo) { floats.push({ x: W / 2, y: homeY() - 110, t0: clock, txt: 'flow ×' + st.streak, gold: 1 }); for (let i = 0; i < 30; i++) { const a = Math.random() * TAU; motes.push({ x: W / 2 + Math.cos(a) * 150, y: homeY() + Math.sin(a) * 70, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 20, life: 1.2, t: 0, col: 'gold', r: 1.4 }); } }
    if (st.ix >= st.n) endAt = clock + 1.4;
  }
  function act(c, dir, v, combo) {
    const note = PENTA[Math.min(6, st.streak)] || PENTA[0];
    if (dir === 'r') {
      c.st = 'release'; c.t0 = clock; c.vx = Math.min(v.x, -380); c.vy = Math.max(-60, Math.min(v.y, 120)); c.vr = -0.6;
      pluck(note * 0.5, 0.15); setTimeout(() => pluck(note * 0.375, 0.07), 160); hiss(0.07, 700, 1.1);
      flying.push(c);
    } else if (dir === 'k') {
      const tg = gardenTarget(c.d.k || c.d.t); c.st = 'keep'; c.t0 = clock; c.sx = c.x; c.sy = c.y; c.sr = c.r; c.tg = tg; c.vx0 = Math.max(v.x, 300);
      pluck(note, 0.13); flying.push(c);
    } else {
      // split: two halves, the part you keep goes to the garden and the rest floats away
      const kc = mkCard({ t: c.d.k, a: 'k' }, c.x + 8, c.y, 0.72), rc = mkCard({ t: c.d.r, a: 'r' }, c.x - 8, c.y, 0.72);
      kc.st = rc.st = 'split'; kc.t0 = rc.t0 = clock; kc.side = 1; rc.side = -1; kc.r = rc.r = 0;
      flying.push(kc, rc); bell(293.66, 0.1); hiss(0.08, 2200, 0.4); burst(c.x, c.y, 24, 'teal'); flash = 0.15;
    }
  }
  function wrong(c, dir, v) {
    c.missed = true; st.wrongs++; st.streak = 0; c.st = 'wobble'; c.t0 = clock; c.vx = v.x * 0.15; c.vy = v.y * 0.1; c.vr = (dir === 'k' ? -1 : 1) * 4;
    pluck(PENTA[0] / 2, 0.12); hiss(0.05, 400, 0.4); shake = 0.12;
    const pre = c.d.a === 's' ? 'Part of this is yours. Swipe up to split it. ' : dir === 's' ? 'This one doesn\'t split. ' : '';
    toast(pre + c.d.w, 5); hintFor = c.d.a;
    floats.push({ x: Math.max(110, Math.min(W - 110, c.x)), y: c.y - c.h / 2 - 20, t0: clock, txt: c.d.a === 'k' ? 'this one is yours' : c.d.a === 'r' ? 'this one is not yours' : 'this one is both' });
  }

  // ---------- review (spaced) and reflection
  const DAY = 864e5;
  function pickReflect(j, el) {
    const P = PONDS[pondIx], today = new Date().toISOString().slice(0, 10);
    save.reviews = save.reviews.filter(r => !(r.pond === pondIx && r.made === today));
    save.reviews.push({ pond: pondIx, choice: P.reflect[j], plan: 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.', made: today, due: Date.now() + DAY, n: 0 }); persist();
    [...$('eRef').children].forEach(c => c.classList.toggle('on', c === el)); pluck(PENTA[3 + j], 0.14);
    $('eRefNote').textContent = 'I\'ll ask you about this tomorrow.';
  }
  const dueReview = () => save.reviews.find(r => r.due <= Date.now() && PONDS[r.pond]);
  function showReview() {
    const r = dueReview(); $('review').classList.toggle('on', !!r); if (!r) return;
    $('rvText').textContent = 'Pond ' + ROMAN[r.pond] + ' · ' + PONDS[r.pond].name + '. You chose “' + r.choice + '”. ' + r.plan + ' Did it come up?';
  }
  function answerReview(used) { const r = dueReview(); if (!r) return; if (used) { r.n++; r.due = Date.now() + [3, 7, 21, 60][Math.min(3, r.n - 1)] * DAY; } else r.due = Date.now() + DAY; persist(); pluck(used ? 587.33 : 392, 0.12); showReview(); }

  // ---------- input: pointer events only
  function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function vel(d) {
    const h = d.hist, now = performance.now(), b = h[h.length - 1]; let a = h[0];
    for (const q of h) if (now - q.t <= 100) { a = q; break; }
    if (now - b.t > 90) return { x: 0, y: 0 };
    const dt = Math.max(16, b.t - a.t) / 1000; return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); audioInit();
    if (mode !== 'play' || drag || !card || !['arrive', 'idle', 'back', 'wobble'].includes(card.st)) return;
    const p = pt(e); if (p.y > shoreY() + 20) return;
    if (card.st === 'arrive') { card.y = Math.max(card.y, card.hy - 40); }
    drag = { id: e.pointerId, ox: card.x - p.x, oy: card.y - p.y, sy: p.y, hist: [{ x: p.x, y: p.y, t: performance.now() }] };
    card.st = 'drag'; card.vr = 0; try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    hiss(0.025, 2600, 0.12);
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id || !card) return; const p = pt(e), now = performance.now();
    drag.hist.push({ x: p.x, y: p.y, t: now }); while (drag.hist.length > 2 && now - drag.hist[0].t > 180) drag.hist.shift();
    card.x = p.x + drag.ox; const ry = p.y + drag.oy - card.hy; card.y = card.hy + (ry < 0 ? ry : ry * 0.35);
  });
  function letGo(e) { if (!drag || e.pointerId !== drag.id) return; const v = vel(drag); drag = null; if (card && card.st === 'drag') decide(v); }
  cv.addEventListener('pointerup', letGo); cv.addEventListener('pointercancel', letGo);
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(); });
  tap('bBegin', () => startPond(Math.min(save.unlocked - 1, PONDS.length - 1)));
  tap('bGo', play);
  tap('bKeep', () => { const P = PONDS[pondIx]; save.plans.push({ d: new Date().toISOString().slice(0, 10), pond: pondIx, text: 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.' }); persist(); $('bKeep').textContent = 'Kept ✓'; pluck(587.33, 0.15); });
  tap('bNext', () => {
    if (pondIx === 2 && !save.bell) { save.bell = 1; persist(); return storyBeat('bell'); }
    if (pondIx === PONDS.length - 1) return storyBeat('hook');
    startPond(pondIx + 1);
  });
  tap('bStory', () => { if (storyKind === 'bell') startPond(3); else toTitle(); });
  tap('menu', toTitle);
  tap('rvYes', () => answerReview(true)); tap('rvNo', () => answerReview(false));
  function toTitle() { drag = null; card = null; mode = 'title'; buildPonds(); show('title'); showReview(); }
  function storyBeat(kind) {
    storyKind = kind; mode = 'story'; storyT = 0;
    $('sText').textContent = kind === 'bell'
      ? 'The third pond runs clear. Far below, past the lily roots, a bronze bell hangs in a drowned monastery. As you watch, it rings once. Someone is still down there.'
      : 'The stream is quiet. On the far shore, beside your garden, a second lantern has been lit. It wasn\'t lit yesterday. Come back tomorrow and see who tends it.';
    $('bStory').textContent = kind === 'bell' ? 'Continue' : 'Until tomorrow';
    show('story'); bell(130.81, 0.45); setTimeout(() => bell(130.81, 0.2), 4200);
  }
  function buildPonds() {
    const el = $('ponds'); el.innerHTML = '';
    PONDS.forEach((P, i) => { const d = document.createElement('div'); d.className = 'pd' + (i >= save.unlocked ? ' lock' : '') + (save.done[i] ? ' done' : ''); d.textContent = ROMAN[i]; d.setAttribute('role', 'button');
      if (i < save.unlocked) d.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); startPond(i); }); el.appendChild(d); });
    $('bBegin').textContent = save.unlocked > 1 ? 'Continue' : 'Begin';
    const n = save.garden.length; $('gCount').textContent = n ? 'Your garden: ' + n + ' lantern' + (n === 1 ? '' : 's') : '';
  }

  // ---------- card physics
  function stepCard(c, dt) {
    if (c.st === 'arrive') {
      const u = clamp((clock - c.t0) / c.arrive, 0, 1), e = 1 - Math.pow(1 - u, 3);
      c.y = lerp(-120, c.hy, e); c.x = c.hx + Math.sin(u * 3.2) * 18 * (1 - u); c.r = Math.sin(u * 2.4) * 0.05 * (1 - u);
      if (u >= 1) { c.st = 'idle'; c.t0 = clock; plop(); burst(c.x, c.y + c.h / 2, 8, 'teal'); }
    } else if (c.st === 'idle') {
      c.x = lerp(c.x, c.hx, Math.min(1, dt * 8)); c.y = lerp(c.y, c.hy + Math.sin(clock * 1.3) * 4, Math.min(1, dt * 8)); c.r = lerp(c.r, Math.sin(clock * 0.9) * 0.012, Math.min(1, dt * 8));
    } else if (c.st === 'drag') {
      c.r = (c.x - c.hx) / W * 0.5;
    } else if (c.st === 'back' || c.st === 'wobble') {
      const k = 200, dmp = c.st === 'wobble' ? 9 : 19;
      c.vx += (-k * (c.x - c.hx) - dmp * c.vx) * dt; c.vy += (-k * (c.y - c.hy) - dmp * c.vy) * dt; c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.st === 'wobble') { c.vr += (-160 * c.r - 7 * c.vr) * dt; c.r += c.vr * dt; c.r = c.r + ((c.x - c.hx) / W * 0.5 - c.r) * 0; }
      else c.r = (c.x - c.hx) / W * 0.5;
      if (Math.abs(c.x - c.hx) < 1 && Math.abs(c.vx) < 8 && Math.abs(c.r) < 0.01 && clock - c.t0 > 0.3) { c.st = 'idle'; }
    } else if (c.st === 'release') {
      const u = clock - c.t0; c.vx *= Math.exp(-1.4 * dt); c.vy += 90 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt * 0.4;
      c.alpha = clamp(1 - u / 1.25, 0, 1); c.scale = 1 - u * 0.18;
      if (Math.random() < 0.9) { const a = Math.random() * TAU; motes.push({ x: c.x + Math.cos(a) * c.w * 0.45, y: c.y + Math.sin(a) * c.h * 0.4, vx: c.vx * 0.2, vy: 30 + Math.random() * 30, life: 1.1, t: 0, col: 'mist', r: 1 + Math.random() * 1.6 }); }
      if (u > 1.3) c.dead = true;
    } else if (c.st === 'keep') {
      const u = clamp((clock - c.t0) / 0.8, 0, 1), e = u * u * (3 - 2 * u), mx = (c.sx + c.tg.x) / 2 + 60, my = Math.min(c.sy, c.tg.y) - 60;
      c.x = (1 - e) * (1 - e) * c.sx + 2 * (1 - e) * e * mx + e * e * c.tg.x; c.y = (1 - e) * (1 - e) * c.sy + 2 * (1 - e) * e * my + e * e * c.tg.y;
      c.scale = lerp(1, 0.06, e); c.r = lerp(c.sr, 0, e); c.glow = e; c.alpha = u > 0.85 ? (1 - u) / 0.15 : 1;
      if (Math.random() < 0.7) motes.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.7, t: 0, col: 'gold', r: 1.2 });
      if (u >= 1 && !c.landed) { c.landed = true; c.dead = true; addToGarden(c.d.t); st.kept++; burst(c.tg.x, c.tg.y - 8, 22, 'gold'); bell(PENTA[Math.min(6, st.streak)] / 2 || 196, 0.12); pluck((PENTA[Math.min(6, st.streak)] || 440) * 2, 0.06); }
    } else if (c.st === 'split') {
      const u = clock - c.t0;
      if (u < 0.55) { c.x += c.side * 160 * dt * (1 - u / 0.55); c.r = c.side * 0.08 * (u / 0.55); }
      else { if (c.side > 0) { c.st = 'keep'; c.t0 = clock; c.sx = c.x; c.sy = c.y; c.sr = c.r; c.tg = gardenTarget(c.d.t); pluck(PENTA[4], 0.12); } else { c.st = 'release'; c.t0 = clock; c.vx = -300; c.vy = 30; c.vr = -0.5; pluck(PENTA[1] * 0.5, 0.12); hiss(0.06, 700, 1); } }
    }
  }
  function drawHand(t) {
    const dir = tut || hintFor; if (!dir || !card || card.st !== 'idle' || drag) return;
    const u = (t % 1.8) / 1.8, e = u < 0.75 ? Math.sin(u / 0.75 * Math.PI / 2) : 1, a = u < 0.1 ? u / 0.1 : u > 0.75 ? 1 - (u - 0.75) / 0.25 : 1;
    const dx = dir === 'k' ? 1 : dir === 'r' ? -1 : 0, dy = dir === 's' ? -1 : 0, x = card.x + dx * e * W * 0.3, y = card.y + 24 + dy * e * 110;
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = `rgba(255,241,194,${0.35 * a})`; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(card.x, card.y + 24); g.lineTo(x, y); g.stroke(); g.lineCap = 'butt';
    const rg = g.createRadialGradient(x, y, 0, x, y, 30); rg.addColorStop(0, `rgba(255,241,194,${0.55 * a})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - 30, y - 30, 60, 60);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(255,250,235,${0.85 * a})`; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.fill();
    g.strokeStyle = `rgba(20,30,50,${0.5 * a})`; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 11, 0, TAU); g.stroke();
  }
  function drawGuides() {
    if (mode !== 'play' || !card) return;
    const k = card.st === 'drag' ? clamp((card.x - card.hx) / (W * 0.22), -1, 1) : 0, y = card.hy + card.h / 2 + 34;
    g.font = 'italic 15px ' + FONT; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillStyle = `rgba(201,214,236,${0.3 + Math.max(0, -k) * 0.7})`; g.fillText('← not mine', 18, y);
    g.textAlign = 'right'; g.fillStyle = `rgba(242,193,78,${0.35 + Math.max(0, k) * 0.65})`; g.fillText('mine →', W - 18, y);
    if (st.P.stones.some(s => s.a === 's')) { g.textAlign = 'center'; g.fillStyle = 'rgba(79,227,193,.3)'; g.fillText('↑ both', W / 2, card.hy - card.h / 2 - 34); }
    g.textBaseline = 'alphabetic';
  }
  function drawHud() {
    if (!st || (mode !== 'play' && mode !== 'still')) return;
    const n = st.n, y = $('ht').getBoundingClientRect().bottom + 12, w = Math.min(W - 80, n * 18);
    for (let i = 0; i < n; i++) { const x = W / 2 - w / 2 + (i + 0.5) * w / n; g.fillStyle = i < st.ix ? 'rgba(242,193,78,.9)' : 'rgba(159,178,204,.25)'; g.beginPath(); g.arc(x, y, i < st.ix ? 3 : 2.2, 0, TAU); g.fill(); }
    if (st.streak >= 3 && mode === 'play') { g.font = 'italic 13px ' + FONT; g.textAlign = 'center'; g.fillStyle = `rgba(255,236,170,${0.6 + 0.3 * Math.sin(clock * 5)})`; g.fillText('flow ×' + st.streak, W / 2, y + 20); }
  }
  function shimmer(t) {
    if (!card || st.streak < 3 || mode !== 'play') return;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const a = t * 1.6 + i * TAU / 3, x = card.x + Math.cos(a) * card.w * 0.52, y = card.y + Math.sin(a) * card.h * 0.56; const rg = g.createRadialGradient(x, y, 0, x, y, 14); rg.addColorStop(0, 'rgba(255,236,170,.7)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - 14, y - 14, 28, 28); }
    g.globalCompositeOperation = 'source-over';
  }
  function drawFloats() {
    g.textAlign = 'center';
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i], u = (clock - f.t0) / 1.8; if (u >= 1) { floats.splice(i, 1); continue; }
      g.font = (f.gold ? 'italic 18px ' : 'italic 14px ') + FONT; g.fillStyle = f.gold ? `rgba(255,236,170,${1 - u})` : `rgba(201,214,236,${0.85 * (1 - u)})`; g.fillText(f.txt, f.x, f.y - u * 20); }
  }

  // ---------- loop
  let last = performance.now(), fpsAcc = 0, fpsN = 0; window.__fps = 60;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 1) { window.__fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (mode === 'play') {
      if (!card && nextAt > 0 && clock >= nextAt && st.ix < st.n) { nextAt = -1; spawn(); }
      if (endAt > 0 && clock >= endAt && !flying.length) { endAt = -1; finish(); }
      if (card && card.st === 'idle' && !tut) { idleT += dt; if (idleT > 7 && !nudged) { nudged = true; toast('Can you act on it? Keep it →. If not, let it float ←.' + (card.d.a === 's' || st.P.stones.some(s => s.a === 's') ? ' Part of both? Split it ↑.' : ''), 4.5); } }
    }
    if (card) stepCard(card, dt);
    for (const c of flying) stepCard(c, dt); flying = flying.filter(c => !c.dead);
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    let sx = 0, sy = 0; if (shake > 0) { shake -= dt; sx = (Math.random() - 0.5) * 8 * shake; }
    g.drawImage(bgc, 0, 0, W, H);
    drawKoi(clock); drawStream(dt, clock);
    g.drawImage(vgc, 0, 0, W, H);
    if (mode === 'story') { storyT += dt; drawBell(clock, storyT / 2.2); }
    drawShore(clock);
    g.translate(sx, sy);
    if (mode === 'play' || mode === 'still') { drawGuides(); for (const c of flying) drawCard(c, clock); shimmer(clock); if (card) drawCard(card, clock); drawHand(clock); }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawMotes(dt); drawFloats(); drawHud();
    if (flash > 0) { flash -= dt; g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,241,194,${flash * 0.3})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  let card_ = null;
  resize(); buildPonds(); showReview(); requestAnimationFrame(frame);
  window.Still = { startPond, play, storyBeat, get st() { return st; }, get mode() { return mode; }, get garden() { return save.garden; },
    get card() { return card && { x: card.x, y: card.y, hx: card.hx, hy: card.hy, st: card.st, a: card.d.a, t: card.d.t }; } };
})();
