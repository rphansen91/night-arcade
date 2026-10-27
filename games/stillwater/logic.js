/* Stillwater — pure pond rules (no DOM). Shared by game.js and tools/solve.js.
   Coordinates are normalised: x in [0,1] across the pond, y in [0,1] down it.
   A spirit "breathes" with a period; its crest is phase 0. Release a held counter-ripple
   while its timing ring hugs the glyph (phase near crest) to cancel one stage.
   Thorns are not yours: touching one doubles its wave and lengthens its stay. Let them pass. */
(function (root) {
  'use strict';
  const C = (o) => Object.assign({ control: true, kind: 'serpent', stages: 1, period: 4, phase: 0, hold: 1.0 }, o);
  const T = (o) => Object.assign({ control: false, kind: 'thorn', enter: 0, dur: 12, period: 5, phase: 0 }, o);
  const PONDS = [
    { name: 'First breath', lens: 'Stoic', win: 0.2, limit: 5,
      scene: 'Morning. Your breath is quick and shallow. It is yours to slow.',
      hint: 'Touch and hold the spirit as you breathe in. Let go as the ink ring closes on it.',
      spirits: [C({ label: 'my breath', x: 0.5, y: 0.5, period: 4.4, hold: 1.0 })],
      teach: 'Some things are within our power, and some are not. Begin with the breath.', cite: 'Epictetus, Enchiridion 1',
      plan: ['I feel rushed today', 'I will take one slow breath before I answer'] },
    { name: 'The kettle', lens: 'Stoic', win: 0.18, limit: 6,
      scene: 'A deadline hisses on the stove. Two things are yours: your next step, and your pace.',
      hint: 'Each knot in a spirit is one calm release. Breathe in, let go as the ring closes.',
      spirits: [C({ label: 'my next step', x: 0.3, y: 0.38, period: 4.0, phase: 0.3 }), C({ label: 'my pace', kind: 'mask', x: 0.68, y: 0.64, stages: 2, period: 4.6, phase: 0.7, hold: 1.2 })],
      teach: 'Do every act of your life as if it were your last, without hurry.', cite: 'Marcus Aurelius, Meditations 2.5',
      plan: ['the deadline feels loud', 'I will write the single next step and do only that'] },
    { name: 'Their tone', lens: 'Stoic', win: 0.17, limit: 5,
      scene: 'A sharp message arrives. Its tone drifts across the water. Your reply is yours.',
      hint: 'The black thorn is not yours. Touching it doubles it. Calm your reply and let the thorn pass.',
      spirits: [C({ label: 'my reply', kind: 'mask', x: 0.5, y: 0.7, stages: 2, period: 4.2, phase: 0.5, hold: 1.1 }),
        T({ label: 'their tone', x: 0.12, y: 0.24, x1: 0.88, y1: 0.3, enter: 0, dur: 13 })],
      teach: 'You have power over your mind, not outside events. Realise this, and you will find strength.', cite: 'Marcus Aurelius, Meditations',
      plan: ['someone writes to me sharply', 'I will answer the words, not the tone'] },
    { name: 'The second arrow', lens: 'Buddhist', win: 0.16, limit: 6,
      scene: 'A setback stings. The sting is the first arrow. The story you tell about it is the second.',
      hint: 'Leave the pain. Calm the story, knot by knot.',
      spirits: [T({ label: 'the sting', x: 0.42, y: 0.22, x1: 0.6, y1: 0.28, enter: 0, dur: 15 }),
        C({ label: 'the story I tell', x: 0.5, y: 0.7, stages: 3, period: 3.8, phase: 0.2, hold: 1.1 })],
      teach: 'Struck by one arrow, the untaught one shoots a second into himself. The wise feel only the first.', cite: 'Sallatha Sutta, SN 36.6',
      plan: ['a setback stings', 'I will name the sting once and drop the story'] },
    { name: 'The lotus closes', lens: 'Buddhist', win: 0.16, limit: 6,
      scene: 'A lovely evening is ending. Wanting it to stay drifts by. Attention and thanks are yours.',
      hint: 'Grasping is a thorn too, even when it is pale and beautiful. Let it drift.',
      spirits: [T({ kind: 'lotus', label: 'wanting it to stay', x: 0.15, y: 0.5, x1: 0.85, y1: 0.46, enter: 0, dur: 16 }),
        C({ label: 'my attention', x: 0.27, y: 0.8, period: 4.0, phase: 0.1, hold: 1.2 }),
        C({ label: 'my thanks', kind: 'mask', x: 0.73, y: 0.18, stages: 2, period: 4.4, phase: 0.6, hold: 1.2 })],
      teach: 'All conditioned things are impermanent. Hold them the way water holds the moon.', cite: 'Dhammapada 277, paraphrased',
      plan: ['a good moment ends', 'I will name one thing I am grateful for instead of chasing it'] },
    { name: 'The price war', lens: 'Strategy', win: 0.15, limit: 7,
      scene: 'A rival slashes prices and rumours churn. Your value and your customer are yours.',
      hint: 'Do not chase the rival. Two thorns will pass; deepen what only you can give.',
      spirits: [T({ label: "rival's price cut", x: 0.1, y: 0.2, x1: 0.9, y1: 0.3, enter: 0, dur: 14 }),
        T({ label: 'market rumour', x: 0.9, y: 0.88, x1: 0.15, y1: 0.86, enter: 5, dur: 13 }),
        C({ label: 'our value', kind: 'mask', x: 0.3, y: 0.56, stages: 2, period: 4.0, phase: 0.4, hold: 1.2 }),
        C({ label: "a customer's question", x: 0.72, y: 0.62, stages: 2, period: 3.6, phase: 0.85, hold: 1.0 })],
      teach: 'A price war is fought on the rival\'s ground. A moat is built on yours: the value they cannot copy.', cite: 'after Porter, Competitive Strategy',
      plan: ['a competitor undercuts us', 'I will ask one customer what they would miss most about us'] },
    { name: 'The reorg', lens: 'Stoic', win: 0.14, limit: 7,
      scene: 'The org chart is redrawn overnight. Three things drift past you. Two are yours.',
      hint: 'Thorns come in waves. Wait for a clear line to your spirit, then breathe.',
      spirits: [T({ label: 'the new chart', x: 0.08, y: 0.3, x1: 0.92, y1: 0.36, enter: 0, dur: 12 }),
        T({ label: 'what they think', x: 0.92, y: 0.12, x1: 0.1, y1: 0.18, enter: 4, dur: 13 }),
        T({ label: 'the rumour mill', x: 0.1, y: 0.92, x1: 0.9, y1: 0.88, enter: 8, dur: 12 }),
        C({ label: 'my work today', x: 0.3, y: 0.62, stages: 2, period: 3.4, phase: 0.2, hold: 1.0 }),
        C({ label: 'one honest question', kind: 'mask', x: 0.72, y: 0.6, stages: 2, period: 3.8, phase: 0.65, hold: 1.2 })],
      teach: 'Confine yourself to the present.', cite: 'Marcus Aurelius, Meditations 7.29',
      plan: ['things change above me', 'I will ask my manager one honest question about what matters now'] },
    { name: 'Still water', lens: 'All', win: 0.13, limit: 8,
      scene: 'Everything at once. Breath, story, value. Two thorns. The pond asks only that you see clearly.',
      hint: 'Sort first: which of these are yours? Then breathe them still, one by one.',
      spirits: [C({ label: 'my breath', x: 0.22, y: 0.42, period: 4.4, phase: 0.0, hold: 1.0 }),
        C({ label: 'the story', kind: 'mask', x: 0.78, y: 0.42, stages: 2, period: 3.6, phase: 0.5, hold: 1.1 }),
        C({ label: 'my next move', x: 0.5, y: 0.76, stages: 2, period: 3.9, phase: 0.25, hold: 1.2 }),
        T({ label: 'the weather', x: 0.08, y: 0.18, x1: 0.92, y1: 0.2, enter: 0, dur: 14 }),
        T({ kind: 'lotus', label: 'praise', x: 0.92, y: 0.6, x1: 0.08, y1: 0.58, enter: 6, dur: 14 })],
      teach: 'Muddy water, let stand, becomes clear.', cite: 'Tao Te Ching 15',
      plan: ['everything happens at once', 'I will sort it into mine and not mine before I act'] },
  ];
  const TARGET_R = 0.15, MAX_HOLD = 4.0, MAX_STAGE = 4;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function make(i) {
    const P = PONDS[i];
    return { i, P, t: 0, misses: 0, grasps: 0, won: false, lost: false, ev: [],
      sp: P.spirits.map((s, k) => Object.assign({}, s, { k, stage: s.stages || 1, amp: 1, gone: false, cool: 0, extra: 0 })) };
  }
  const phaseOf = (s, t) => (((t / s.period + s.phase) % 1) + 1) % 1;
  const crestDist = (s, t) => { const p = phaseOf(s, t); return Math.min(p, 1 - p); };
  function pos(s, t) {
    if (s.control) return { x: s.x, y: s.y };
    const u = clamp((t - s.enter) / (s.dur + s.extra), 0, 1), e = u * u * (3 - 2 * u) * 0.3 + u * 0.7;
    return { x: s.x + (s.x1 - s.x) * e, y: s.y + (s.y1 - s.y) * e + Math.sin(u * 6.28) * 0.02 };
  }
  const active = (s, t) => s.control ? (!s.gone && s.stage > 0) : (t >= s.enter && t < s.enter + s.dur + s.extra);
  const passed = (s, t) => !s.control && t >= s.enter + s.dur + s.extra;
  function chaos(st) { let c = 0; for (const s of st.sp) if (active(s, st.t)) c += s.control ? s.stage : s.amp; return c; }
  // aspect = pond height / width, so distance is measured in pond widths
  function targetAt(st, x, y, aspect) {
    let best = -1, bd = TARGET_R;
    for (const s of st.sp) { if (!active(s, st.t)) continue; const p = pos(s, st.t), d = Math.hypot(p.x - x, (p.y - y) * aspect); if (d < bd) { bd = d; best = s.k; } }
    return best;
  }
  function press(st, k) {
    const s = st.sp[k]; if (!s || s.control) return null;
    s.amp = Math.min(4, s.amp * 2); s.extra += 3; st.grasps++;
    st.ev.push({ type: 'grasp', k });
    if (chaos(st) > st.P.limit) { st.lost = true; st.ev.push({ type: 'lost' }); }
    return 'grasp';
  }
  function release(st, k, hold) {
    const s = st.sp[k]; if (!s || !s.control || !active(s, st.t) || s.cool > 0) return null;
    if (hold < s.hold) { st.ev.push({ type: 'weak', k }); return 'weak'; }
    if (crestDist(s, st.t) <= st.P.win * 0.5) {
      s.stage--; s.cool = 0.5;
      if (s.stage <= 0) { s.gone = true; st.ev.push({ type: 'still', k }); } else st.ev.push({ type: 'calm', k });
      return 'calm';
    }
    s.stage = Math.min(MAX_STAGE, s.stage + 1); st.misses++; s.cool = 0.5;
    st.ev.push({ type: 'splash', k });
    if (chaos(st) > st.P.limit) { st.lost = true; st.ev.push({ type: 'lost' }); }
    return 'splash';
  }
  function step(st, dt) {
    if (st.won || st.lost) return;
    st.t += dt;
    for (const s of st.sp) { if (s.cool > 0) s.cool -= dt; if (!s.control && !s.passedEv && passed(s, st.t)) { s.passedEv = true; st.ev.push({ type: 'pass', k: s.k }); } }
    if (st.sp.every(s => s.control ? s.gone : passed(s, st.t))) { st.won = true; st.ev.push({ type: 'won' }); }
  }
  const api = { PONDS, make, step, press, release, targetAt, pos, active, passed, phaseOf, crestDist, chaos, TARGET_R, MAX_HOLD };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SW = api;
})(this);
