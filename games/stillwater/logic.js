/* Stillwater — pure pond rules (no DOM). Shared by game.js and tools/solve.js.
   Coordinates are normalised: x in [0,1] across the pond, y in [0,1] down it; distances are in pond widths.
   Each spirit pulses with a period (crest = phase 0). You drag a gold stone, then flick or let go: it glides,
   settles, and sends one ring outward at speed V. Where the ring reaches a spirit at its crest it meets the
   wave in counter-phase and cancels one knot (a "perfect" inside the tighter window). One ring can calm
   several spirits in a chain. Thorns are not yours: a ring that reaches one makes it grow and linger.
   There is no fail state. The pond clears when every spirit is calm and every thorn has drifted away. */
(function (root) {
  'use strict';
  const C = (o) => Object.assign({ control: true, kind: 'serpent', stages: 1, period: 4, phase: 0 }, o);
  const T = (o) => Object.assign({ control: false, kind: 'thorn', enter: 0, dur: 12, period: 5, phase: 0 }, o);
  // after: the teaching line is picked from what actually happened in the pond
  const PONDS = [
    { name: 'First breath', lens: 'Stoic', win: 0.2,
      scene: 'Morning. Your breath is quick and shallow. It is the first thing that is yours.',
      hint: 'Drag the gold stone. Let go when the arc on the spirit glows.',
      spirits: [C({ label: 'Hurry', concept: 'what is up to us', x: 0.5, y: 0.42, period: 4.4 })],
      after: { clean: 'You could not stop the wave. You could only meet it. That is all control ever was: your response, placed well.' },
      cite: 'Epictetus, Enchiridion 1',
      plan: ['I feel rushed', 'I will take one slow breath before I answer'],
      reflect: ['Before my first meeting', 'When a message makes me hurry', 'Before I reply to anyone today'] },
    { name: 'The kettle', lens: 'Stoic', win: 0.18,
      scene: 'A deadline hisses on the stove. Two things are yours: your next step, and your pace.',
      hint: 'One ring can still two spirits if it reaches both at their crests.',
      spirits: [C({ label: 'Dread', concept: 'one next step', x: 0.3, y: 0.36, period: 4.0, phase: 0.3 }),
        C({ label: 'Rushing', concept: 'festina lente', kind: 'mask', x: 0.68, y: 0.62, stages: 2, period: 4.6, phase: 0.7 })],
      after: { chain: 'One well-placed ring calmed two spirits. Slow is smooth: a single right next step settles more than speed does.',
        clean: 'Each knot came undone with one unhurried ring. Make haste slowly: pace is a choice you place, not a feeling you obey.' },
      cite: 'Augustus, via Suetonius: festina lente',
      plan: ['the deadline feels loud', 'I will write the single next step and do only that'],
      reflect: ['Write my next step on paper', 'Set one 25-minute block', 'Say no to one extra task'] },
    { name: 'Criticism', lens: 'Stoic', win: 0.17,
      scene: 'A sharp review arrives. Its tone drifts across the water. Your reply is yours.',
      hint: 'The silver thorn is not yours. If your ring reaches it, it grows. Drop the stone away from it.',
      spirits: [C({ label: 'Criticism', concept: 'dichotomy of control', kind: 'mask', x: 0.5, y: 0.72, stages: 2, period: 4.2, phase: 0.5 }),
        T({ label: 'their tone', x: 0.12, y: 0.2, x1: 0.88, y1: 0.26, enter: 0, dur: 12 })],
      after: { thorn: 'Your ring touched their tone and it only grew. You can answer the words. The tone was never yours to fix.',
        clean: 'You answered the criticism and left their tone alone, and it drifted out by itself. Take the useful part. Let the rest pass.' },
      cite: 'Epictetus, Enchiridion 5',
      plan: ['someone criticises me sharply', 'I will find the one useful sentence and answer only that'],
      reflect: ['Feedback at work', 'A comment from family', 'Something online'] },
    { name: 'The second arrow', lens: 'Buddhist', win: 0.16,
      scene: 'A setback stings. The sting is the first arrow. The story you tell about it is the second.',
      hint: 'Leave the sting. Calm the story, knot by knot.',
      spirits: [T({ label: 'the sting', concept: 'first arrow', x: 0.4, y: 0.18, x1: 0.62, y1: 0.24, enter: 0, dur: 14 }),
        C({ label: 'Rumination', concept: 'the second arrow', x: 0.5, y: 0.72, stages: 3, period: 3.8, phase: 0.2 })],
      after: { thorn: 'Pushing at the sting made it last longer. Pain arrives on its own; only the story needs your hand.',
        clean: 'The sting faded by itself while you unwound the story. The first arrow hurts. The second one is optional.' },
      cite: 'Sallatha Sutta, SN 36.6',
      plan: ['a setback stings', 'I will name the sting once, then drop the story'],
      reflect: ['A mistake I keep replaying', 'A loss I keep explaining', 'A slight I keep rehearsing'] },
    { name: 'Craving', lens: 'Buddhist', win: 0.16,
      scene: 'A lovely evening is ending. Wanting it to stay drifts by. Attention and thanks are yours.',
      hint: 'Grasping is a thorn too, even when it is pale and beautiful. Let it drift.',
      spirits: [T({ kind: 'lotus', label: 'wanting more', concept: 'grasping', x: 0.12, y: 0.48, x1: 0.88, y1: 0.44, enter: 0, dur: 15 }),
        C({ label: 'Craving', concept: 'non-grasping', x: 0.27, y: 0.8, period: 4.0, phase: 0.1 }),
        C({ label: 'Savoring', concept: 'gratitude', kind: 'mask', x: 0.73, y: 0.16, stages: 2, period: 4.4, phase: 0.6 })],
      after: { thorn: 'Reaching for the lotus only made it linger and cloud the pond. What you clutch, you stop seeing.',
        chain: 'One ring calmed craving and opened savoring. Letting go and appreciating turn out to be the same movement.',
        clean: 'You let the lotus pass and the evening stayed beautiful. Hold good things the way water holds the moon.' },
      cite: 'Dhammapada 277, paraphrased',
      plan: ['a good moment is ending', 'I will name one thing I am grateful for instead of chasing more'],
      reflect: ['Scrolling one more time', 'Wanting a trip to never end', 'Reaching for another snack'] },
    { name: 'Sunk cost', lens: 'Strategy', win: 0.15,
      scene: 'A project has eaten a year. A rival moves. What you already spent drifts by. The next decision is yours.',
      hint: 'Past spending is a thorn. Decide only from where you stand now.',
      spirits: [T({ label: 'what we already spent', concept: 'sunk cost', x: 0.1, y: 0.18, x1: 0.9, y1: 0.28, enter: 0, dur: 13 }),
        T({ label: "a rival's move", x: 0.9, y: 0.9, x1: 0.14, y1: 0.86, enter: 5, dur: 12 }),
        C({ label: 'Sunk cost', concept: 'decide forward', kind: 'mask', x: 0.3, y: 0.56, stages: 2, period: 4.0, phase: 0.4 }),
        C({ label: 'Pride in the plan', concept: 'ego is the enemy', x: 0.72, y: 0.62, stages: 2, period: 3.6, phase: 0.85 })],
      after: { thorn: 'Touching what was already spent made it bigger. Money gone is gone; it can only distort the next choice.',
        chain: 'A single ring stilled sunk cost and pride together. They are one knot: not wanting to have been wrong.',
        clean: 'You decided from where you stand, and the past cost drifted off the water. Only future costs and benefits belong in the choice.' },
      cite: 'Arkes & Blumer, 1985',
      plan: ['I want to continue because of what I have spent', 'I will ask: knowing what I know now, would I start this today?'],
      reflect: ['A project at work', 'A subscription or purchase', 'A habit I keep for history'] },
    { name: 'The reorg', lens: 'Stoic', win: 0.14,
      scene: 'The org chart is redrawn overnight. Three things drift past you. Two are yours.',
      hint: 'Thorns come in waves. Wait for a clear stretch of water, then drop the stone.',
      spirits: [T({ label: 'the new chart', x: 0.08, y: 0.3, x1: 0.92, y1: 0.36, enter: 0, dur: 11 }),
        T({ label: 'what they think', x: 0.92, y: 0.1, x1: 0.1, y1: 0.16, enter: 4, dur: 12 }),
        T({ label: 'the rumour mill', x: 0.1, y: 0.92, x1: 0.9, y1: 0.88, enter: 8, dur: 11 }),
        C({ label: 'Uncertainty', concept: 'the present task', x: 0.3, y: 0.62, stages: 2, period: 3.4, phase: 0.2 }),
        C({ label: 'Assuming', concept: 'ask, then act', kind: 'mask', x: 0.72, y: 0.58, stages: 2, period: 3.8, phase: 0.65 })],
      after: { thorn: 'Every thorn you touched stayed longer. Rumours feed on attention; the work in front of you starves them.',
        chain: 'One ring reached uncertainty and assumption at once. A single honest question settles both.',
        clean: 'You waited for clear water and the reorg drifted past you. Confine yourself to the present.' },
      cite: 'Marcus Aurelius, Meditations 7.29',
      plan: ['things change above me', 'I will ask my manager one honest question about what matters now'],
      reflect: ['A change at work', 'A change at home', 'News I cannot control'] },
    { name: 'Still water', lens: 'All', win: 0.13,
      scene: 'Everything at once. Hurry, story, the next move. Two thorns. The pond asks only that you sort clearly.',
      hint: 'Sort first: which of these are yours? Then still them, one ring at a time.',
      spirits: [C({ label: 'Hurry', concept: 'the breath', x: 0.22, y: 0.42, period: 4.4, phase: 0.0 }),
        C({ label: 'The story', concept: 'second arrow', kind: 'mask', x: 0.78, y: 0.42, stages: 2, period: 3.6, phase: 0.5 }),
        C({ label: 'Next move', concept: 'decide forward', x: 0.5, y: 0.76, stages: 2, period: 3.9, phase: 0.25 }),
        T({ label: 'the weather', x: 0.08, y: 0.16, x1: 0.92, y1: 0.18, enter: 0, dur: 13 }),
        T({ kind: 'lotus', label: 'praise', x: 0.92, y: 0.6, x1: 0.08, y1: 0.58, enter: 6, dur: 13 })],
      after: { thorn: 'Even praise grew when you reached for it. Muddy water clears when you stop stirring it.',
        chain: 'Your rings found several spirits at once. Clarity compounds: sort once, and many things settle.',
        clean: 'You sorted the pond, calmed what was yours and let the rest pass. Muddy water, let stand, becomes clear.' },
      cite: 'Tao Te Ching 15',
      plan: ['everything happens at once', 'I will sort it into mine and not mine before I act'],
      reflect: ['A busy Monday', 'A hard conversation', 'A big decision'] },
  ];
  const V = 0.42, RMAX = 0.62, RTHORN = 0.27, GLIDE_T = 0.38, GLIDE_K = 5, VMAX = 0.7, MAX_STAGE = 4;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function make(i, aspect) {
    const P = PONDS[i];
    return { i, P, aspect: aspect || 1.62, t: 0, won: false, ev: [], rings: [], stats: { releases: 0, perfect: 0, good: 0, near: 0, thorn: 0, chainMax: 0 },
      sp: P.spirits.map((s, k) => Object.assign({}, s, { k, stage: s.stages || 1, amp: 1, gone: false, extra: 0 })) };
  }
  const phaseOf = (s, t) => (((t / s.period + s.phase) % 1) + 1) % 1;
  const crestDist = (s, t) => { const p = phaseOf(s, t); return Math.min(p, 1 - p); };
  function pos(s, t) {
    if (s.control) return { x: s.x, y: s.y + Math.sin(t * 0.5 + s.k) * 0.004 };
    const u = clamp((t - s.enter) / (s.dur + s.extra), 0, 1), e = u * u * (3 - 2 * u) * 0.3 + u * 0.7;
    return { x: s.x + (s.x1 - s.x) * e, y: s.y + (s.y1 - s.y) * e + Math.sin(u * 6.28) * 0.02 };
  }
  const active = (s, t) => s.control ? (!s.gone && s.stage > 0) : (t >= s.enter && t < s.enter + s.dur + s.extra);
  const passed = (s, t) => !s.control && t >= s.enter + s.dur + s.extra;
  const unrest = st => { let c = 0; for (const s of st.sp) if (active(s, st.t)) c += s.control ? s.stage : s.amp; return c; };
  const dist = (st, a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * st.aspect);
  // where a released stone comes to rest (flick momentum with exponential friction)
  function settle(x, y, vx, vy) {
    const m = Math.hypot(vx, vy); if (m > VMAX) { vx *= VMAX / m; vy *= VMAX / m; }
    const g = (1 - Math.exp(-GLIDE_K * GLIDE_T)) / GLIDE_K;
    return { x: clamp(x + vx * g, 0.02, 0.98), y: clamp(y + vy * g, 0.02, 0.98) };
  }
  function grade(P, off) { return off <= P.win * 0.22 ? 'perfect' : off <= P.win * 0.5 ? 'good' : off <= P.win * 1.15 ? 'near' : 'none'; }
  // what a ring born at (x,y) at time t0 would do: per-spirit grade and which thorns it would touch
  function forecast(st, x, y, t0) {
    const o = { x, y }, out = [];
    for (const s of st.sp) {
      if (s.control) {
        if (!active(s, st.t)) continue;
        const d = dist(st, o, pos(s, t0)); if (d > RMAX) continue;
        const ta = t0 + d / V, off = crestDist(s, ta);
        out.push({ k: s.k, d, off, g: grade(st.P, off), ta });
      } else {
        for (let R = 0; R <= RTHORN; R += 0.01) {
          const ta = t0 + R / V; if (!active(s, ta) && !(ta < s.enter)) break; if (ta < s.enter) continue;
          if (dist(st, o, pos(s, ta)) <= R) { out.push({ k: s.k, thorn: true, d: R, ta }); break; }
        }
      }
    }
    return out;
  }
  // release a stone at (x,y) with flick velocity (pond widths / s). Returns the ring, or null if one is still gliding.
  function release(st, x, y, vx, vy) {
    if (st.won || st.rings.some(r => r.t0 > st.t)) return null;
    const p = settle(x, y, vx || 0, vy || 0), r = { x: p.x, y: p.y, t0: st.t + GLIDE_T, sx: x, sy: y, hit: {}, good: 0, id: st.stats.releases };
    st.rings.push(r); st.stats.releases++; st.ev.push({ type: 'throw', r });
    return r;
  }
  function step(st, dt) {
    if (st.won) return;
    const t1 = st.t + dt;
    for (let i = st.rings.length - 1; i >= 0; i--) {
      const r = st.rings[i]; if (t1 < r.t0) continue;
      if (!r.landed) { r.landed = true; st.ev.push({ type: 'land', r }); }
      const R = (t1 - r.t0) * V;
      for (const s of st.sp) {
        if (r.hit[s.k] || !active(s, t1)) continue;
        if (s.control) {
          const d = dist(st, r, pos(s, t1)); if (d > RMAX || d > R) continue;
          r.hit[s.k] = 1; const off = crestDist(s, r.t0 + d / V), g = grade(st.P, off);
          if (g === 'perfect' || g === 'good') {
            s.stage--; r.good++; st.stats[g]++;
            if (r.good > st.stats.chainMax) st.stats.chainMax = r.good;
            if (s.stage <= 0) s.gone = true;
            st.ev.push({ type: g, k: s.k, r, still: s.gone, chain: r.good });
          } else if (g === 'near') { st.stats.near++; st.ev.push({ type: 'near', k: s.k, r }); }
          else st.ev.push({ type: 'miss', k: s.k, r });
        } else if (R <= RTHORN) {
          const d = dist(st, r, pos(s, t1)); if (d > R) continue;
          r.hit[s.k] = 1; s.amp = Math.min(MAX_STAGE, s.amp * 2); s.extra += 3; st.stats.thorn++;
          st.ev.push({ type: 'grow', k: s.k, r });
        }
      }
      if (R > RMAX) st.rings.splice(i, 1);
    }
    st.t = t1;
    for (const s of st.sp) if (!s.control && !s.passedEv && passed(s, st.t)) { s.passedEv = true; st.ev.push({ type: 'pass', k: s.k }); }
    if (st.sp.every(s => s.control ? s.gone : passed(s, st.t)) && !st.rings.some(r => r.t0 > st.t)) { st.won = true; st.ev.push({ type: 'won' }); }
  }
  // the teaching line tied to what just happened
  function lesson(st) {
    const a = st.P.after, s = st.stats;
    if (s.thorn > 0 && a.thorn) return a.thorn;
    if (s.chainMax >= 2 && a.chain) return a.chain;
    return a.clean;
  }
  const api = { PONDS, make, step, release, settle, forecast, grade, lesson, pos, active, passed, phaseOf, crestDist, unrest, dist, V, RMAX, RTHORN, GLIDE_T, GLIDE_K, VMAX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SW = api;
})(this);
