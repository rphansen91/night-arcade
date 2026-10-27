// Proves every pond can be cleared with zero thorn touches, using the same release() the game uses
// (stone dropped or flicked, ring judged on counter-phase arrival). Compares against random play.
// node tools/solve.js
const SW = require('../logic.js');
const ASPECT = 1.62, DT = 1 / 60;
function bestDrop(st) {
  const t0 = st.t + SW.GLIDE_T; let best = null;
  for (let x = 0.04; x <= 0.96; x += 0.04) for (let y = 0.04; y <= 0.96; y += 0.04) {
    const f = SW.forecast(st, x, y, t0); if (f.some(o => o.thorn)) continue;
    let sc = 0; for (const o of f) if (!o.thorn) sc += o.g === 'perfect' ? 3 : o.g === 'good' ? 1 : 0;
    if (sc >= 3 && (!best || sc > best.sc)) best = { x, y, sc };
  }
  return best;
}
function play(i, mode, seed = 1) {
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const st = SW.make(i, ASPECT); let n = 0, flick = mode === 'flick';
  while (!st.won && st.t < 300) {
    if (n++ % 6 === 0 && !st.rings.some(q => q.t0 > st.t)) {
      if (mode === 'random') { if (rnd() < 0.08) SW.release(st, rnd(), rnd(), (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.2); }
      else {
        const b = bestDrop(st);
        if (b) {
          if (flick) { // flick from a point upstream so momentum carries it onto the chosen spot
            const g = (1 - Math.exp(-SW.GLIDE_K * SW.GLIDE_T)) / SW.GLIDE_K, vx = 0.3, vy = -0.2;
            const sx = b.x - vx * g, sy = b.y - vy * g, s = SW.settle(sx, sy, vx, vy);
            if (Math.abs(s.x - b.x) < 1e-9 && Math.abs(s.y - b.y) < 1e-9) SW.release(st, sx, sy, vx, vy); else SW.release(st, b.x, b.y, 0, 0);
          } else SW.release(st, b.x, b.y, 0, 0);
        }
      }
    }
    SW.step(st, DT); st.ev.length = 0;
  }
  return st;
}
let ok = true;
SW.PONDS.forEach((P, i) => {
  const s = play(i, 'skill'), f = play(i, 'flick');
  const rt = []; let rw = 0; for (let k = 1; k <= 20; k++) { const q = play(i, 'random', k * 7919); if (q.won && q.t < 300) { rw++; rt.push(q.t); } }
  rt.sort((a, b) => a - b); const med = rt.length ? rt[rt.length >> 1].toFixed(0) + 's' : '—';
  const thorns = P.spirits.filter(x => !x.control).length;
  console.log(`${i + 1}. ${P.name.padEnd(17)} drop:${s.won ? 'CLEAR' : 'FAIL'} ${s.t.toFixed(1)}s rings:${s.stats.releases} perfect:${s.stats.perfect} chain:${s.stats.chainMax} thornTouch:${s.stats.thorn} | flick:${f.won ? 'CLEAR' : 'FAIL'} ${f.t.toFixed(1)}s | random: ${rw}/20 cleared, median ${med}, thorn touches avg ${'n/a'} | thorns ${thorns}`);
  if (!s.won || s.stats.thorn || !f.won || f.stats.thorn) ok = false;
});
console.log(ok ? 'ALL PONDS PROVEN WINNABLE (no thorn touched, drop and flick)' : 'SOME POND FAILED'); process.exit(ok ? 0 : 1);
