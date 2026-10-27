// Proves every pond is winnable by simulated play with real input rules, and that sloppy play
// (random timing) fails sometimes so timing is a skill. node tools/solve.js
const SW = require('../logic.js');
const ASPECT = 1.62, DT = 1 / 60;
function play(i, mode, seed = 1) {
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const st = SW.make(i); let hold = null, guard = 0;
  while (!st.won && !st.lost && st.t < 240) {
    if (hold) {
      if (st.t >= hold.until) { SW.release(st, hold.k, st.t - hold.t0); hold = null; }
    } else {
      for (const s of st.sp) {
        if (!s.control || !SW.active(s, st.t) || s.cool > 0) continue;
        const p = SW.pos(s, st.t);
        if (SW.targetAt(st, p.x, p.y, ASPECT) !== s.k) continue; // a thorn is closer: wait
        const h = s.hold + 0.1;
        if (mode === 'skill') {
          // start now only if release (t+h) lands on a crest
          if (SW.crestDist(s, st.t + h) < st.P.win * 0.25) { hold = { k: s.k, t0: st.t, until: st.t + h }; break; }
        } else if (rnd() < 0.02) { hold = { k: s.k, t0: st.t, until: st.t + h + rnd() * 1.5 }; break; }
      }
    }
    SW.step(st, DT);
    if (++guard > 1e6) break;
  }
  return st;
}
let ok = true;
SW.PONDS.forEach((P, i) => {
  const s = play(i, 'skill');
  let sloppyWins = 0; for (let k = 1; k <= 40; k++) if (play(i, 'sloppy', k * 7919).won) sloppyWins++;
  const thorns = P.spirits.filter(x => !x.control).length;
  console.log(`${i + 1}. ${P.name.padEnd(18)} skill:${s.won ? 'WIN' : 'FAIL'} in ${s.t.toFixed(1)}s grasps:${s.grasps} misses:${s.misses} | random-timing wins ${sloppyWins}/40 | thorns ${thorns}`);
  if (!s.won || s.grasps || s.misses) ok = false;
});
console.log(ok ? 'ALL PONDS PROVEN WINNABLE' : 'SOME POND FAILED'); process.exit(ok ? 0 : 1);
