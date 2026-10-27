/* Stillwater — ink & ember. Analytic wave superposition rendered as glowing crest lines.
   Core: drag a gold stone, flick or let go; it glides, settles and sends a ring that cancels a spirit's
   wave where it arrives in counter-phase. Input: pointer events only (down/move, plus up to let go). */
(function () {
  'use strict';
  const SW = window.SW, PONDS = SW.PONDS;
  const cv = document.getElementById('c'), g = cv.getContext('2d');
  const $ = id => document.getElementById(id);
  const TAU = Math.PI * 2, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
  const FONT = '"Hiragino Mincho ProN","Songti SC","Iowan Old Style",Palatino,Georgia,serif';
  let W = 0, H = 0, DPR = 1, top = 0, bot = 0;
  const CELL = 3; let GW = 0, GH = 0, fc, fx, fimg, bc, bx, bgc, vgc;
  const SAVE_KEY = 'stillwater:v1';
  let save = { unlocked: 1, plans: [], done: [], reviews: [] };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} };

  // ---------- layout
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sa = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    top = 96 + sa; bot = H - 64;
    GW = Math.ceil(W / CELL) + 1; GH = Math.ceil(H / CELL) + 1;
    fc = document.createElement('canvas'); fc.width = GW; fc.height = GH; fx = fc.getContext('2d'); fimg = fx.createImageData(GW, GH);
    bc = document.createElement('canvas'); bc.width = Math.ceil(GW / 3); bc.height = Math.ceil(GH / 3); bx = bc.getContext('2d');
    buildBg(); buildVignette();
  }
  const pondW = () => W * 0.84, pondH = () => (bot - top) * 0.88;
  const toPx = p => ({ x: W * 0.08 + p.x * pondW(), y: top + (bot - top) * 0.06 + p.y * pondH() });
  const toN = (x, y) => ({ x: (x - W * 0.08) / pondW(), y: (y - top - (bot - top) * 0.06) / pondH() });
  const aspect = () => pondH() / pondW();

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

  // ---------- game state
  let mode = 'title', st = null, pondIx = 0, rings = [], motes = [], dying = [], drag = null, stones = [], inks = [], floats = [], restT = 0, sinceGood = 0, lastThrow = 0, grewToast = 0, slow = 0, shake = 0, flash = 0;
  let clock = 0, lastCalmAt = 0, hintShown = 0, sinceHintMiss = 0, koi = [], storyT = 0, clarity = 0;
  for (let i = 0; i < 4; i++) koi.push({ a: Math.random() * TAU, r: 0.3 + Math.random() * 0.25, s: (0.03 + Math.random() * 0.03) * (i % 2 ? 1 : -1), ph: Math.random() * TAU });

  function amp(s) { return s.control ? 0.34 + 0.2 * s.stage : 0.42 * s.amp; }
  const K = TAU / 52, OMEGA_MUL = 1.3;

  function startPond(i) {
    pondIx = i; st = SW.make(i, aspect()); rings = []; motes = []; dying = []; drag = null; stones = []; inks = []; floats = []; sinceGood = 0; lastThrow = 0; grewToast = 0; setRes(0); clock = 0; lastCalmAt = 0; hintShown = 0; sinceHintMiss = 0; clarity = 0;
    $('hn').textContent = ROMAN[i] + ' · ' + PONDS[i].lens.toUpperCase(); $('ht').textContent = PONDS[i].name;
    $('iNum').textContent = 'POND ' + ROMAN[i]; $('iName').textContent = PONDS[i].name; $('iLens').textContent = PONDS[i].lens;
    $('iScene').textContent = PONDS[i].scene; $('iHint').textContent = PONDS[i].hint;
    show('intro'); mode = 'intro';
  }
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  function show(id) { ['title', 'intro', 'end', 'story'].forEach(k => $(k).classList.toggle('on', k === id)); $('hud').classList.toggle('on', id === null || id === 'intro'); $('menu').classList.toggle('on', id === null); }
  let toastT = 0; function toast(msg, dur = 3.6) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); toastT = dur; }

  // ---------- events from rules
  function handleEvents() {
    while (st.ev.length) {
      const e = st.ev.shift(), s = e.k != null ? st.sp[e.k] : null, p = s ? toPx(SW.pos(s, st.t)) : null;
      if (e.type === 'throw') { hiss(0.04, 1800, 0.3); }
      else if (e.type === 'land') {
        const q = toPx(e.r); plop(); burst(q.x, q.y, 10, 'gold');
        rings.push({ x: q.x, y: q.y, t0: clock, A: 0.55, sign: 0, life: SW.RMAX / SW.V, front: 1.25, spd: SW.V * pondW() });
      } else if (e.type === 'perfect' || e.type === 'good') {
        const pf = e.type === 'perfect';
        rings.push({ x: p.x, y: p.y, t0: clock, A: amp(s) + 0.2, sign: -1, phs: s.phase, per: s.period, life: 2.8, front: pf ? 1.4 : 1 });
        burst(p.x, p.y, pf ? 44 : 22, 'gold'); slow = pf ? 0.3 : 0.14; sub(); sinceGood = 0;
        if (pf) { flash = 0.45; bell([196, 220, 261.63, 293.66][Math.min(3, e.chain - 1)], 0.24); floats.push({ x: p.x, y: p.y - 46, t0: clock, txt: e.chain > 1 ? 'perfect · chain ×' + e.chain : 'perfect', gold: 1 }); }
        else { pluck(PENTA[pi++ % PENTA.length]); if (e.chain > 1) floats.push({ x: p.x, y: p.y - 46, t0: clock, txt: 'chain ×' + e.chain, gold: 1 }); }
        if (e.still) { dying.push({ s, x: p.x, y: p.y, t0: clock, A: amp(s) + 0.2 }); setTimeout(() => pluck(PENTA[(pi + 2) % PENTA.length] * 2, 0.12), 180); }
        const ctl = st.sp.filter(x => x.control), tot = ctl.reduce((a, x) => a + (x.stages || 1), 0), left = ctl.reduce((a, x) => a + (x.gone ? 0 : x.stage), 0); setRes(1 - left / tot);
      } else if (e.type === 'near') {
        inks.push({ x: p.x, y: p.y, t0: clock }); pluck(PENTA[0] / 2, 0.07); floats.push({ x: p.x, y: p.y - 46, t0: clock, txt: 'almost' }); sinceGood++; nudge();
      } else if (e.type === 'miss') { sinceGood++; nudge(); }
      else if (e.type === 'grow') {
        thud(); shake = 0.25; burst(p.x, p.y, 16, 'mist'); floats.push({ x: p.x, y: p.y - 40, t0: clock, txt: 'it grew' });
        if (!grewToast++) toast('Not yours. Reaching for it only makes it grow and linger. Let it drift out.', 4);
      } else if (e.type === 'pass') { burst(p.x, p.y, 10, 'mist'); hiss(0.08, 500, 1.2); floats.push({ x: p.x, y: p.y - 30, t0: clock, txt: 'drifted away' }); }
      else if (e.type === 'won') winPond();
    }
  }
  function nudge() { if (sinceGood >= 3) { sinceGood = 0; toast('Watch the arc on the spirit as you drag. Let go when it glows gold and the ring hugs the spirit.', 4.5); } }
  const DAY = 864e5;
  let chosen = -1;
  function winPond() {
    mode = 'still'; chord(); setRes(1); setTimeout(() => bell(196, 0.22), 700);
    save.done[pondIx] = 1; save.unlocked = Math.max(save.unlocked, Math.min(PONDS.length, pondIx + 2)); persist();
    const P = PONDS[pondIx];
    setTimeout(() => {
      $('eQuote').textContent = SW.lesson(st); $('eCite').textContent = P.cite;
      $('ePlan').innerHTML = ''; const sp = document.createElement('span'); sp.textContent = 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.'; $('ePlan').appendChild(sp);
      $('bKeep').textContent = 'Keep this plan'; $('bNext').textContent = pondIx === PONDS.length - 1 ? 'Rest' : 'Next pond';
      chosen = -1; const rc = $('eRef'); rc.innerHTML = '';
      P.reflect.forEach((txt, j) => { const c = document.createElement('div'); c.className = 'chip'; c.textContent = txt; c.setAttribute('role', 'button');
        c.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); audioInit(); pickReflect(j, c); }); rc.appendChild(c); });
      show('end'); mode = 'end';
    }, 2300);
  }
  function pickReflect(j, el) {
    const P = PONDS[pondIx];
    save.reviews = (save.reviews || []).filter(r => !(r.pond === pondIx && r.made === new Date().toISOString().slice(0, 10)));
    save.reviews.push({ pond: pondIx, choice: P.reflect[j], plan: 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.', made: new Date().toISOString().slice(0, 10), due: Date.now() + DAY, n: 0 }); persist();
    [...$('eRef').children].forEach(c => c.classList.toggle('on', c === el)); chosen = j; pluck(PENTA[3 + j], 0.14);
    $('eRefNote').textContent = 'I will ask you about this tomorrow.';
  }
  function dueReview() { const now = Date.now(); return (save.reviews || []).find(r => r.due <= now); }
  function showReview() {
    const r = dueReview(), el = $('review'); el.classList.toggle('on', !!r); if (!r) return;
    $('rvText').textContent = 'Pond ' + ROMAN[r.pond] + ' · ' + PONDS[r.pond].name + '. You chose “' + r.choice + '”. ' + r.plan + ' Did it come up?';
  }
  function answerReview(used) { const r = dueReview(); if (!r) return; if (used) { r.n++; r.due = Date.now() + [3, 7, 21, 60][Math.min(3, r.n - 1)] * DAY; } else r.due = Date.now() + DAY; persist(); pluck(used ? 587.33 : 392, 0.12); showReview(); }
  function burst(x, y, n, col) {
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 20 + Math.random() * 90; motes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 1 + Math.random() * 1.4, t: 0, col, r: 0.8 + Math.random() * 1.8 }); }
  }

  // ---------- input: drag the stone, flick or let go
  function pt(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function fingerVel() {
    if (!drag) return { x: 0, y: 0 }; const h = drag.hist, now = performance.now(); let a = h[0];
    for (const q of h) if (now - q.t <= 90) { a = q; break; }
    const b = h[h.length - 1], dt = Math.max(16, b.t - a.t) / 1000; if (now - b.t > 70) return { x: 0, y: 0 };
    let vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt; if (Math.hypot(vx, vy) < 140) vx = vy = 0; return { x: vx, y: vy };
  }
  cv.addEventListener('pointerdown', e => {
    e.preventDefault(); audioInit();
    if (mode === 'rest') { endRest(); return; }
    if (mode !== 'play' || drag) return;
    const p = pt(e); drag = { id: e.pointerId, fx: p.x, fy: p.y, x: p.x, y: p.y, hist: [{ x: p.x, y: p.y, t: performance.now() }] };
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    pluck(PENTA[2] / 2, 0.06);
  }, { passive: false });
  cv.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return; const p = pt(e); drag.fx = p.x; drag.fy = p.y;
    const now = performance.now(); drag.hist.push({ x: p.x, y: p.y, t: now }); while (drag.hist.length > 2 && now - drag.hist[0].t > 160) drag.hist.shift();
  });
  function letGo() {
    if (!drag) return; const d = drag; drag = null; if (mode !== 'play') return;
    const v = fingerVelOf(d), n = toN(d.x, d.y), r = SW.release(st, n.x, n.y, v.x / pondW(), v.y / pondH());
    if (r) { stones.push({ r, x0: d.x, y0: d.y, t0: clock }); lastThrow = clock; } else pluck(PENTA[0] / 2, 0.04);
  }
  function fingerVelOf(d) { const keep = drag; drag = d; const v = fingerVel(); drag = keep; return v; }
  cv.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) letGo(); });
  cv.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) letGo(); });
  const tap = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); audioInit(); fn(); });
  tap('bBegin', () => startPond(Math.min(save.unlocked - 1, PONDS.length - 1)));
  tap('bGo', () => { show(null); mode = 'play'; bell(196, 0.12); lastThrow = clock; });
  tap('bRest', () => { show(null); $('hud').classList.remove('on'); mode = 'rest'; restT = 0; chord(); });
  function endRest() { mode = 'end'; show('end'); }
  tap('rvYes', () => answerReview(true)); tap('rvNo', () => answerReview(false));
  tap('bKeep', () => { const P = PONDS[pondIx]; save.plans.push({ d: new Date().toISOString().slice(0, 10), pond: pondIx, text: 'If ' + P.plan[0] + ', then ' + P.plan[1] + '.' }); persist(); $('bKeep').textContent = 'Kept ✓'; pluck(587.33, 0.15); });
  tap('bNext', () => {
    if (pondIx === 2 && !save.bell) { save.bell = 1; persist(); return storyBeat('bell'); }
    if (pondIx === PONDS.length - 1) return storyBeat('hook');
    startPond(pondIx + 1);
  });
  tap('bStory', () => { if (storyKind === 'bell') startPond(3); else { mode = 'title'; buildPonds(); show('title'); showReview(); } });
  tap('menu', () => { drag = null; mode = 'title'; buildPonds(); show('title'); showReview(); });
  let storyKind = '';
  function storyBeat(kind) {
    storyKind = kind; mode = 'story'; storyT = 0; rings = []; dying = [];
    $('sText').textContent = kind === 'bell'
      ? 'The third pond goes clear. Far below, past the lily roots, a bronze bell hangs in the drowned monastery. As you watch, it rings once. Someone is still down there.'
      : 'The water is still. Below the bell, a second lantern has been lit. It was not lit yesterday. Come back tomorrow and see who tends it.';
    $('bStory').textContent = kind === 'bell' ? 'Continue' : 'Until tomorrow';
    show('story'); bell(130.81, 0.45); setTimeout(() => bell(130.81, 0.2), 4200);
  }
  function buildPonds() {
    const el = $('ponds'); el.innerHTML = '';
    PONDS.forEach((P, i) => { const d = document.createElement('div'); d.className = 'pd' + (i >= save.unlocked ? ' lock' : '') + (save.done[i] ? ' done' : ''); d.textContent = ROMAN[i]; d.setAttribute('role', 'button');
      if (i < save.unlocked) d.addEventListener('pointerdown', e => { e.preventDefault(); audioInit(); startPond(i); }); el.appendChild(d); });
    $('bBegin').textContent = save.unlocked > 1 ? 'Continue' : 'Begin';
  }

  // ---------- wave field
  function renderField(t) {
    const src = [];
    if (st && mode !== 'story' && mode !== 'rest' && mode !== 'title') {
      for (const s of st.sp) if (SW.active(s, st.t)) { const p = toPx(SW.pos(s, st.t)); src.push({ x: p.x, y: p.y, A: amp(s), w: TAU / s.period * OMEGA_MUL, ph: s.phase * TAU, ch: s.control ? 0 : 1 }); }
      for (const d of dying) { const u = (clock - d.t0) / 1.8; if (u < 1) src.push({ x: d.x, y: d.y, A: d.A * (1 - u) * (1 - u), w: TAU / d.s.period * OMEGA_MUL, ph: d.s.phase * TAU, ch: 0 }); }
    } 
    if (mode === 'title' || mode === 'story' || mode === 'rest') {
      src.push({ x: W * 0.5, y: H * 0.62, A: 0.5, w: 1.4, ph: 0, ch: 0 }, { x: W * 0.2, y: H * 0.3, A: 0.35, w: 1.7, ph: 1, ch: 1 });
    }
    const rs = [];
    for (const r of rings) { const age = clock - r.t0; if (age < r.life) rs.push({ x: r.x, y: r.y, R: age * (r.spd || 210), A: r.A, f: 1 - age / r.life, sign: r.sign, w: r.per ? TAU / r.per * OMEGA_MUL : 0, ph: (r.phs || 0) * TAU, front: r.front }); }
    const d = fimg.data, ns = src.length, nr = rs.length, tw = t * 7.3;
    let o = 0;
    for (let j = 0; j < GH; j++) {
      const y = j * CELL;
      for (let i = 0; i < GW; i++) {
        const x = i * CELL; let s = 0, m = 0, p = 0, Ls = 0, Lm = 0, Lp = 0, Am = 0;
        for (let q = 0; q < ns; q++) {
          const S = src[q], dx = x - S.x, dy = y - S.y, r = Math.sqrt(dx * dx + dy * dy), ph = K * r - S.w * t + S.ph, fall = S.A / (1 + r * 0.016) * (r < 14 ? r / 14 : 1);
          const v = fall * Math.sin(ph); let c = Math.sin(ph); c = c > 0 ? c : 0; c *= c; c *= c; c *= c * c;
          if (S.ch) { m += v; Lm += c * fall; } else { s += v; Ls += c * fall; } Am += fall;
        }
        for (let q = 0; q < nr; q++) {
          const Rg = rs[q], dx = x - Rg.x, dy = y - Rg.y, r = Math.sqrt(dx * dx + dy * dy), e = r - Rg.R;
          if (Rg.sign !== 0 && e < 0) { const fall = Rg.A * Rg.f / (1 + r * 0.016) * Math.min(1, -e / 30), ph = K * r - Rg.w * t + Rg.ph; p += Rg.sign * fall * Math.sin(ph); Am += fall; if (Rg.sign > 0) { let c = Math.sin(ph); c = c > 0 ? c : 0; c *= c; c *= c; Lp += c * fall; } }
          if (e > -30 && e < 30) { const f = Rg.A * Rg.f * Rg.front * Math.exp(-e * e / 40); Lp += f * 1.6; Lp += Rg.A * Rg.f * Rg.front * 0.35 * Math.exp(-(e + 16) * (e + 16) / 30); }
        }
        // interference: rings stay bright where waves add, fade where they cancel
        const h = s + m + p, keep = Am > 0.01 ? Math.min(1, 0.12 + 1.5 * Math.abs(h) / Am + 0.5 * (h * h)) : 1;
        const ls = Ls * keep * 2.2, lm = Lm * keep * 2.2, lp = Lp;
        let R = 79 * ls + 175 * lm + 242 * lp, G = 227 * ls + 168 * lm + 193 * lp, B = 193 * ls + 230 * lm + 78 * lp;
        // shimmer where ring sets cross
        const cross = ls * (lm + lp) + lm * lp;
        if (cross > 0.08) { const sp = 0.6 + 0.4 * Math.sin(x * 0.37 + y * 0.21 + tw); const k = Math.min(1.2, cross * 2.4) * sp; R += 255 * k; G += 241 * k; B += 194 * k; }
        // trough ink: very faint dark-blue lines read as wash
        d[o] = R > 255 ? 255 : R; d[o + 1] = G > 255 ? 255 : G; d[o + 2] = B > 255 ? 255 : B; d[o + 3] = 255; o += 4;
      }
    }
    fx.putImageData(fimg, 0, 0);
    bx.clearRect(0, 0, bc.width, bc.height); bx.drawImage(fc, 0, 0, bc.width, bc.height);
    g.save(); g.globalCompositeOperation = 'lighter'; g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.68; g.drawImage(fc, 0, 0, GW * CELL, GH * CELL);
    g.globalAlpha = 0.55; g.drawImage(bc, -CELL, -CELL, GW * CELL + CELL * 2, GH * CELL + CELL * 2);
    g.restore();
  }

  // ---------- spirits
  function drawSpirits(t) {
    for (const s of st.sp) {
      if (!SW.active(s, st.t)) continue;
      const p = toPx(SW.pos(s, st.t)), ph = SW.phaseOf(s, st.t), cd = SW.crestDist(s, st.t);
      const S = (s.control ? 26 + s.stage * 3.5 : 24 + s.amp * 4) * (1 + 0.07 * Math.cos(ph * TAU));
      const col = s.control ? [79, 227, 193] : s.kind === 'lotus' ? [210, 200, 240] : [159, 178, 204];
      // glow pool
      const rg = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, S * 2.4);
      rg.addColorStop(0, `rgba(${col},${s.control ? 0.22 : 0.12})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.fillRect(p.x - S * 2.4, p.y - S * 2.4, S * 4.8, S * 4.8);
      // breathing ring: hugs the glyph at each crest, so the rhythm is always readable
      if (s.control) {
        const rr = S * 1.15 + cd * 2 * S * 1.6, fc = forecastFor(s.k);
        g.lineWidth = 1.2; g.strokeStyle = `rgba(${col},${fc ? 0.18 : 0.34})`;
        g.beginPath(); for (let a = 0; a <= 64; a++) { const an = a / 64 * TAU, wob = 1 + Math.sin(an * 5 + t * 0.8 + s.k) * 0.025; const X = p.x + Math.cos(an) * rr * wob, Y = p.y + Math.sin(an) * rr * wob; a ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke();
        // meeting ring: where the spirit's wave will be when your ring arrives (perfect = hugging, gold)
        if (fc) {
          const mr = S * 1.15 + fc.off * 2 * S * 1.6, gd = fc.g, gold = gd === 'perfect' || gd === 'good';
          // the perfect window, a soft gold band on the glyph
          g.lineWidth = Math.max(2, st.P.win * 0.22 * 2 * S * 1.6 * 2); g.strokeStyle = 'rgba(242,193,78,.13)'; g.beginPath(); g.arc(p.x, p.y, S * 1.15, 0, TAU); g.stroke();
          g.lineWidth = gd === 'perfect' ? 3.2 : 2; g.strokeStyle = gd === 'perfect' ? `rgba(255,236,170,${0.85 + 0.15 * Math.sin(t * 14)})` : gold ? 'rgba(242,193,78,.85)' : gd === 'near' ? 'rgba(159,178,204,.55)' : 'rgba(159,178,204,.28)';
          g.beginPath(); g.arc(p.x, p.y, mr, 0, TAU); g.stroke();
          if (gd === 'perfect') { const hg = g.createRadialGradient(p.x, p.y, S * 0.6, p.x, p.y, S * 2.2); hg.addColorStop(0, 'rgba(242,193,78,.22)'); hg.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = hg; g.fillRect(p.x - S * 2.2, p.y - S * 2.2, S * 4.4, S * 4.4); }
        }
        for (let q = 0; q < s.stage; q++) { const an = -Math.PI / 2 + (q - (s.stage - 1) / 2) * 0.32; g.fillStyle = 'rgba(242,193,78,.85)'; g.beginPath(); g.arc(p.x + Math.cos(an) * (S * 1.15 + 9), p.y + Math.sin(an) * (S * 1.15 + 9), 2.2, 0, TAU); g.fill(); }
      } else if (forecastFor(s.k)) {
        g.setLineDash([3, 5]); g.lineWidth = 1.5; g.strokeStyle = `rgba(255,140,110,${0.5 + 0.3 * Math.sin(t * 8)})`; g.beginPath(); g.arc(p.x, p.y, S * 1.5, 0, TAU); g.stroke(); g.setLineDash([]);
      }
      // brush glyph: wide soft pass then ink core then bright edge
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(${col},.16)`; for (const k of GLYPH[s.kind]) drawStroke(k, p.x, p.y, S * 1.08, 1, 0);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = s.control ? 'rgba(4,10,16,.9)' : 'rgba(2,3,6,.95)'; for (const k of GLYPH[s.kind]) drawStroke(k, p.x + 1.2, p.y + 1.6, S, 1, s.k + 1);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(${col},${s.control ? 0.9 : 0.55})`; for (const k of GLYPH[s.kind]) drawStroke(k, p.x, p.y, S * 0.96, 1, s.k + 3);
      if (!s.control && s.amp > 1) { g.fillStyle = `rgba(255,120,90,${0.12 * s.amp})`; for (const k of GLYPH[s.kind]) drawStroke(k, p.x, p.y, S * 1.2, 1, s.k); }
      g.globalCompositeOperation = 'source-over';
      // label
      g.font = 'italic 14px ' + FONT; g.textAlign = 'center';
      g.fillStyle = s.control ? 'rgba(230,255,248,.85)' : 'rgba(190,200,220,.75)';
      const lx = clamp(p.x, 80, W - 80);
      g.fillText(s.label, lx, p.y + S * 1.15 + (s.control ? 30 : 24));
      g.font = '10px ' + FONT; g.fillStyle = s.control ? 'rgba(242,193,78,.7)' : 'rgba(159,178,204,.6)';
      const sub = s.control ? s.concept : (forecastFor(s.k) ? 'NOT YOURS · IT WILL GROW' : 'NOT YOURS' + (s.concept ? ' · ' + s.concept : ''));
      g.fillText(sub.toUpperCase().split('').join('\u200a'), lx, p.y + S * 1.15 + (s.control ? 45 : 38));
    }
    // unravelling spirits
    for (const d of dying) {
      const u = (clock - d.t0) / 1.4; if (u >= 1) continue;
      const S = 26; g.globalCompositeOperation = 'lighter';
      g.fillStyle = `rgba(${lerp(79, 242, u) | 0},${lerp(227, 193, u) | 0},${lerp(193, 78, u) | 0},${0.9 * (1 - u)})`;
      for (const k of GLYPH[d.s.kind]) drawStroke(k, d.x, d.y - u * 14, S, 1 - u, 2);
      const gp = glyphPoint(d.s.kind, 1 - u);
      if (gp) for (let q = 0; q < 3; q++) motes.push({ x: d.x + gp[0] * S, y: d.y - u * 14 + gp[1] * S, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 40, life: 1.4, t: 0, col: 'gold', r: 1 + Math.random() * 1.4 });
      g.globalCompositeOperation = 'source-over';
    }
  }
  // ---------- aim preview, gliding stones, ink fades, floating words
  let fcast = null;
  function forecastFor(k) { return fcast && fcast.find(o => o.k === k); }
  function updateForecast() {
    fcast = null; if (!drag || mode !== 'play') return;
    const v = fingerVel(), n = toN(drag.x, drag.y), sp = SW.settle(n.x, n.y, v.x / pondW(), v.y / pondH());
    drag.settle = sp; fcast = SW.forecast(st, sp.x, sp.y, st.t + SW.GLIDE_T);
  }
  function drawStone(x, y, r, a) {
    g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(x, y, 0, x, y, r * 3.2); rg.addColorStop(0, `rgba(242,193,78,${0.5 * a})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    g.fillStyle = `rgba(255,236,180,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  function drawPreview(t) {
    if (!drag || mode !== 'play') return;
    const sp = drag.settle ? toPx(drag.settle) : { x: drag.x, y: drag.y }, pw = pondW(), busy = st.rings.some(r => r.t0 > st.t);
    // reach
    g.setLineDash([2, 7]); g.lineWidth = 1; g.strokeStyle = 'rgba(242,193,78,.12)'; g.beginPath(); g.arc(sp.x, sp.y, SW.RMAX * pw, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,140,110,.10)'; g.beginPath(); g.arc(sp.x, sp.y, SW.RTHORN * pw, 0, TAU); g.stroke(); g.setLineDash([]);
    // glide path
    if (Math.hypot(sp.x - drag.x, sp.y - drag.y) > 4) { g.setLineDash([3, 6]); g.strokeStyle = 'rgba(255,236,180,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(drag.x, drag.y); g.lineTo(sp.x, sp.y); g.stroke(); g.setLineDash([]); g.strokeStyle = 'rgba(255,236,180,.45)'; g.beginPath(); g.arc(sp.x, sp.y, 6, 0, TAU); g.stroke(); }
    // preview arcs toward each spirit at the radius your ring will have when it meets it
    for (const o of fcast || []) {
      const s = st.sp[o.k], q = toPx(SW.pos(s, o.ta)), an = Math.atan2(q.y - sp.y, q.x - sp.x), R = Math.hypot(q.x - sp.x, q.y - sp.y), span = Math.min(0.9, 34 / Math.max(20, R));
      if (o.thorn) { g.strokeStyle = 'rgba(255,140,110,.55)'; g.lineWidth = 1.5; g.setLineDash([4, 4]); }
      else { const gd = o.g; g.strokeStyle = gd === 'perfect' ? `rgba(255,236,170,${0.8 + 0.2 * Math.sin(t * 14)})` : gd === 'good' ? 'rgba(242,193,78,.8)' : gd === 'near' ? 'rgba(159,178,204,.45)' : 'rgba(159,178,204,.2)'; g.lineWidth = gd === 'perfect' ? 3.5 : gd === 'good' ? 2.4 : 1.4; }
      g.beginPath(); g.arc(sp.x, sp.y, R, an - span, an + span); g.stroke(); g.setLineDash([]);
    }
    drawStone(drag.x, drag.y, 6 + Math.sin(t * 3) * 0.6, busy ? 0.4 : 1);
  }
  function drawStones() {
    for (let i = stones.length - 1; i >= 0; i--) {
      const sn = stones[i], tau = (clock - sn.t0), u = Math.min(1, (1 - Math.exp(-SW.GLIDE_K * tau)) / (1 - Math.exp(-SW.GLIDE_K * SW.GLIDE_T))), end = toPx(sn.r);
      if (tau >= SW.GLIDE_T) { stones.splice(i, 1); continue; }
      const x = lerp(sn.x0, end.x, u), y = lerp(sn.y0, end.y, u); drawStone(x, y, 6 - 2 * (tau / SW.GLIDE_T), 1);
      if (Math.random() < 0.6) motes.push({ x, y, vx: 0, vy: 0, life: 0.5, t: 0, col: 'gold', r: 1 });
    }
  }
  function drawInks() {
    for (let i = inks.length - 1; i >= 0; i--) {
      const k = inks[i], u = (clock - k.t0) / 1.8; if (u >= 1) { inks.splice(i, 1); continue; }
      const r = 20 + u * 60, rg = g.createRadialGradient(k.x, k.y, r * 0.3, k.x, k.y, r); rg.addColorStop(0, `rgba(3,6,12,${0.5 * (1 - u)})`); rg.addColorStop(0.7, `rgba(20,32,60,${0.25 * (1 - u)})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(k.x - r, k.y - r, r * 2, r * 2);
    }
  }
  function drawFloats() {
    g.textAlign = 'center';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], u = (clock - f.t0) / 1.6; if (u >= 1) { floats.splice(i, 1); continue; }
      g.font = (f.gold ? 'italic 16px ' : 'italic 13px ') + FONT; g.fillStyle = f.gold ? `rgba(255,236,170,${1 - u})` : `rgba(190,200,220,${0.8 * (1 - u)})`; g.fillText(f.txt, f.x, f.y - u * 22);
    }
  }
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
  function drawEnso() {
    if (!st) return; const ctl = st.sp.filter(s => s.control), tot = ctl.reduce((a, s) => a + (s.stages || 1), 0), left = ctl.reduce((a, s) => a + (s.gone ? 0 : s.stage), 0);
    const f = clamp(1 - left / tot, 0, 1), cx = W - 32, hb = $('hn').getBoundingClientRect(), cy = hb.top + 14, r = 13;
    g.lineCap = 'round'; g.strokeStyle = 'rgba(159,178,204,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(242,193,78,.95)'; g.lineWidth = 3.2; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2 + 0.3, -Math.PI / 2 + 0.3 + f * (TAU - 0.5)); g.stroke(); g.lineCap = 'butt';
  }

  // ---------- loop
  let last = performance.now(), fpsAcc = 0, fpsN = 0; window.__fps = 60;
  function frame(now) {
    let rdt = Math.min(0.05, (now - last) / 1000); last = now;
    fpsAcc += rdt; fpsN++; if (fpsAcc > 1) { window.__fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    const scale = slow > 0 ? 0.3 : 1; slow -= rdt; const dt = rdt * scale;
    clock += dt;
    if (mode === 'play' && st) {
      SW.step(st, dt);
      for (const d of [drag]) if (d) { d.x = lerp(d.x, d.fx, Math.min(1, rdt * 22)); d.y = lerp(d.y, d.fy, Math.min(1, rdt * 22)); }
      updateForecast();
      handleEvents();
      if (!hintShown && clock - lastThrow > 12 && !drag) { hintShown = 1; toast(PONDS[pondIx].hint, 5); }
    } else if ((mode === 'still' || mode === 'end') && st) { st.t += dt; handleEvents(); }
    if (mode === 'rest') { restT += rdt; if (restT > 16) endRest(); }
    if (ac && st) { const c = SW.unrest(st); au.unrest.gain.setTargetAtTime(mode === 'play' ? 0.004 * c : 0, ac.currentTime, 0.4); au.u1.frequency.setTargetAtTime(146.83 * (1 + 0.006 * c), ac.currentTime, 0.4); au.u2.frequency.setTargetAtTime(220 * (1 - 0.005 * c), ac.currentTime, 0.4); }
    if (toastT > 0) { toastT -= rdt; if (toastT <= 0) $('toast').classList.remove('on'); }
    for (let i = rings.length - 1; i >= 0; i--) if (clock - rings[i].t0 > rings[i].life) rings.splice(i, 1);
    for (let i = dying.length - 1; i >= 0; i--) if (clock - dying[i].t0 > 2) dying.splice(i, 1);

    g.setTransform(DPR, 0, 0, DPR, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    let sx = 0, sy = 0; if (shake > 0) { shake -= rdt; sx = (Math.random() - 0.5) * 6 * shake; sy = (Math.random() - 0.5) * 6 * shake; }
    g.drawImage(bgc, 0, 0, W, H);
    g.translate(sx, sy);
    drawKoi(clock);
    renderField(clock);
    if (mode === 'story') { storyT += rdt; drawBell(clock, storyT / 2.2); }
    else if (st && mode !== 'title' && mode !== 'rest') { drawInks(); drawSpirits(clock); drawStones(); drawPreview(clock); }
    drawMotes(rdt); drawFloats();
    if (flash > 0) { flash -= rdt; g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,241,194,${flash * 0.25})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.drawImage(vgc, 0, 0, W, H);
    if (mode === 'play' || mode === 'still') drawEnso();
    requestAnimationFrame(frame);
  }
  addEventListener('resize', resize);
  resize(); buildPonds(); showReview(); requestAnimationFrame(frame);
  window.Still = { get stones() { return stones; }, startPond, play: () => { show(null); mode = 'play'; }, get st() { return st; }, storyBeat, get mode() { return mode; }, toPx, aspect };
})();
