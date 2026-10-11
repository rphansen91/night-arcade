// Fairness + playability check for every Lullwater song, using the real chart builder (songs.js).
// node tools/check.js   → exits 1 on any failure.
const LW = require('../songs.js');
const VIS_ROWS = 0.79 / 0.225;            // rows of look-ahead above the waterline (HITY / ROWH in game.js)
let bad = 0; const fail = (s, m) => { bad++; console.log('  ✗', s, m); };
const rows = [];
for (const [si, song] of LW.SONGS.entries()) {
  const { rows: R, len } = LW.buildPass(song);
  // structure
  let prev = null;
  for (const [i, r] of R.entries()) {
    for (const n of r.notes.concat(r.bass)) if (n < 33 || n > 96) fail(song.id, `note ${n} out of piano range at ${i}`);
    if (r.lanes.some(l => l < 0 || l > 3)) fail(song.id, `bad lane at ${i}`);
    if (r.lanes.length > 1 && (new Set(r.lanes)).size !== r.lanes.length) fail(song.id, `double shares a lane at ${i}`);
    if (r.lanes.length > 1 && r.long) fail(song.id, `long double at ${i}`);
    if (prev && r.lanes.some(l => prev.lanes.includes(l)) && r.r - prev.r < 1.01) fail(song.id, `back-to-back same lane at ${i}`);
    if (r.h < 0.5) fail(song.id, `tile thinner than half a row at ${i}`);
    prev = r;
  }
  // fingers: count tiles needing contact at once (a held long + taps that start before it ends)
  let maxFingers = 0;
  for (const a of R) { const t0 = a.r; let f = a.lanes.length; for (const b of R) if (b !== a && b.long && b.r < t0 - 1e-9 && b.r + b.h > t0 + 0.25) f++; maxFingers = Math.max(maxFingers, f); }
  if (maxFingers > 2) fail(song.id, `needs ${maxFingers} fingers at once`);
  // tempo per stage
  const starts = [...new Set(R.map(r => r.r))].sort((a, b) => a - b);
  let minGapRows = Infinity; for (let i = 1; i < starts.length; i++) minGapRows = Math.min(minGapRows, starts[i] - starts[i - 1]);
  const peakPerRow = (() => { let m = 0; for (let i = 0; i < starts.length; i++) { let c = 0; for (let j = i; j < starts.length && starts[j] - starts[i] < 2; j++) c++; m = Math.max(m, c / 2); } return m; })();
  const muls = [0, 1, 2, 3, 4, 5, 6, 20].map(p => [p, LW.stageMul(p, song.rps)]);
  for (const [p, m] of muls) {
    const rps = song.rps * m, minGap = minGapRows / rps, peak = peakPerRow * rps, look = VIS_ROWS / rps, passSec = len / rps;
    rows.push({ song: song.id, stage: p >= 20 ? 'cap' : p, 'rows/s': rps.toFixed(2), 'peak taps/s': peak.toFixed(1), 'min gap ms': Math.round(minGap * 1000), 'look-ahead s': look.toFixed(2), 'pass s': passSec.toFixed(0) });
    if (p === 0 && minGap < 0.17) fail(song.id, `stage 1 min gap ${Math.round(minGap * 1000)}ms is too tight`);
    if (minGap < 0.085) fail(song.id, `stage ${p} min gap ${Math.round(minGap * 1000)}ms is inhuman`);
    if (look < 0.6) fail(song.id, `stage ${p} look-ahead ${look.toFixed(2)}s too short`);
  }
  if (si === 0) { const rps = song.rps; if (peakPerRow * rps > 2.6 || minGapRows / rps < 0.5) fail(song.id, 'first song is not welcoming enough'); }
  console.log(`✓ ${song.id.padEnd(16)} ${R.length} keys/pass (${R.filter(r => r.long).length} long, ${R.filter(r => r.lanes.length > 1).length} twin) · ${len} rows · fingers≤${maxFingers}`);
}
// ramp: each song's stage-1 tempo is never faster than the next song's
for (let i = 1; i < LW.SONGS.length; i++) if (LW.SONGS[i].tier < LW.SONGS[i - 1].tier) fail(LW.SONGS[i].id, 'tier goes down');
console.table(rows.filter(r => r.stage === 0 || r.stage === 5 || r.stage === 'cap'));
console.log(bad ? `${bad} problem(s)` : 'All songs fair: playable at every stage, two fingers max, gentle first song.');
process.exit(bad ? 1 : 0);
