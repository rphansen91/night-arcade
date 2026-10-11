// Shadeaway level verifier. Uses live rules (../logic.js) and campaign (../levels.js).
// For every board: structural validation, BFS proof it can be cleared, route replay.
// node tools/solve.js [--json]
const SA = require('../logic.js'), LEVELS = require('../levels.js');

const rows = []; let bad = 0;
LEVELS.forEach((def, i) => {
  const L = SA.prep(def);
  const errs = SA.validate(L);
  const sol = SA.solve(L, SA.init(L), 2e6);
  let replay = 'n/a';
  if (sol.path) {
    const S = SA.init(L);
    let ok = true;
    for (const idx of sol.path) {
      const r = SA.launch(L, S, idx);
      if (!r.ok) { ok = false; break; }
    }
    replay = ok && SA.won(L, S) ? 'won' : 'FAILED';
  }
  const firsts = SA.launchable(L, SA.init(L));
  // friendliness: how many first launches leave a still-solvable board?
  let deadFirst = 0;
  for (const fi of firsts) {
    const S = SA.init(L);
    SA.launch(L, S, fi);
    if (!SA.won(L, S) && !SA.solve(L, S, 2e5).path) deadFirst++;
  }
  const frostN = def.cells.filter(c => c.frost).length;
  const ok = !errs.length && sol.path && replay === 'won';
  if (!ok) bad++;
  rows.push({
    level: i + 1, name: def.name, cubes: L.N, frost: frostN, lives: L.lives,
    firstMoves: firsts.length, deadFirst, par: sol.path ? sol.path.length : null,
    nodes: sol.nodes, replay, errors: errs, ok, path: sol.path
  });
});

if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log('lvl name              cubes frost lives first dead  par  nodes  replay  ok');
  rows.forEach(r => {
    console.log(
      String(r.level).padStart(3),
      r.name.padEnd(16),
      String(r.cubes).padStart(5),
      String(r.frost).padStart(5),
      String(r.lives).padStart(5),
      String(r.firstMoves).padStart(5),
      String(r.deadFirst).padStart(4),
      String(r.par).padStart(5),
      String(r.nodes).padStart(6),
      String(r.replay).padStart(6),
      r.ok ? '  ✓' : '  ✗ ' + r.errors.join(';') + (r.par == null ? ' UNSOLVABLE' : '')
    );
  });
  console.log(bad
    ? `\n${bad} board(s) FAILED`
    : `\nAll ${rows.length} boards verified clearable (BFS clearing order, route replayed).`);
}
process.exitCode = bad ? 1 : 0;
