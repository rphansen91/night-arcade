/* Shadeaway — rules engine. Shared by the game (window.SA) and tools (require).
   Grid of shade-cubes, each with an axis-aligned arrow (+X/-X/+Y/-Y/+Z/-Z).
   Tap launches a cube along its arrow IFF the entire ray ahead is empty of
   other live cubes (and its frost has thawed). Wrong taps cost a life.
   Clear every cube to win. Optional frost: a cube with frost N cannot launch
   until N other cubes have been cleared on this board. */
(function (root) {
  'use strict';

  var DIRS = {
    x:  [1, 0, 0], '-x': [-1, 0, 0],
    y:  [0, 1, 0], '-y': [0, -1, 0],
    z:  [0, 0, 1], '-z': [0, 0, -1]
  };
  var DIR_KEYS = Object.keys(DIRS);

  function key(x, y, z) { return x + ',' + y + ',' + z; }

  function prep(def) {
    var cells = (def.cells || []).map(function (c, i) {
      var d = c.d;
      if (!DIRS[d]) throw new Error('bad dir ' + d + ' on cell ' + i);
      return {
        i: i,
        x: c.x | 0, y: c.y | 0, z: c.z | 0,
        d: d,
        dir: DIRS[d].slice(),
        frost: c.frost | 0,
        c: c.c == null ? (i % 8) : c.c
      };
    });
    var L = {
      def: def,
      name: def.name || '',
      cells: cells,
      N: cells.length,
      lives: def.lives == null ? 3 : def.lives | 0,
      tip: def.tip || null
    };
    return L;
  }

  function init(L) {
    var alive = [];
    for (var i = 0; i < L.N; i++) alive.push(true);
    return {
      alive: alive,
      cleared: 0,
      lives: L.lives,
      moves: 0,
      failed: false,
      stuck: false
    };
  }

  function clone(S) {
    return {
      alive: S.alive.slice(),
      cleared: S.cleared,
      lives: S.lives,
      moves: S.moves,
      failed: S.failed,
      stuck: S.stuck
    };
  }

  function frostLeft(L, S, i) {
    var f = L.cells[i].frost | 0;
    if (f <= 0) return 0;
    return Math.max(0, f - S.cleared);
  }

  // Is the infinite ray ahead of cell i empty of other live cubes?
  function rayClear(L, S, i) {
    var c = L.cells[i], dx = c.dir[0], dy = c.dir[1], dz = c.dir[2];
    for (var j = 0; j < L.N; j++) {
      if (j === i || !S.alive[j]) continue;
      var o = L.cells[j];
      var ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
      // Must lie strictly ahead on the axis of travel, and share the other two axes.
      if (dx !== 0) {
        if (oy !== 0 || oz !== 0) continue;
        if (ox * dx <= 0) continue;
        return false;
      }
      if (dy !== 0) {
        if (ox !== 0 || oz !== 0) continue;
        if (oy * dy <= 0) continue;
        return false;
      }
      if (dz !== 0) {
        if (ox !== 0 || oy !== 0) continue;
        if (oz * dz <= 0) continue;
        return false;
      }
    }
    return true;
  }

  function canLaunch(L, S, i) {
    if (!S.alive[i] || S.failed) return false;
    if (frostLeft(L, S, i) > 0) return false;
    return rayClear(L, S, i);
  }

  // Attempt a launch. Returns {ok, reason, launched} — mutates S.
  function launch(L, S, i) {
    if (!S.alive[i] || S.failed) return { ok: false, reason: 'gone' };
    if (frostLeft(L, S, i) > 0) {
      return { ok: false, reason: 'frost', frost: frostLeft(L, S, i) };
    }
    if (!rayClear(L, S, i)) {
      S.lives -= 1;
      S.moves += 1;
      if (S.lives <= 0) S.failed = true;
      return { ok: false, reason: 'blocked' };
    }
    S.alive[i] = false;
    S.cleared += 1;
    S.moves += 1;
    return { ok: true, reason: 'launched', launched: i };
  }

  function won(L, S) {
    for (var i = 0; i < L.N; i++) if (S.alive[i]) return false;
    return true;
  }

  function launchable(L, S) {
    var out = [];
    for (var i = 0; i < L.N; i++) if (canLaunch(L, S, i)) out.push(i);
    return out;
  }

  // Successors for search: only successful launches (wrong taps aren't useful for solving).
  function successors(L, S) {
    var out = [], opts = launchable(L, S);
    for (var k = 0; k < opts.length; k++) {
      var i = opts[k];
      var n = clone(S);
      launch(L, n, i);
      out.push({ i: i, S: n });
    }
    return out;
  }

  function stateKey(S) {
    var s = '';
    for (var i = 0; i < S.alive.length; i++) s += S.alive[i] ? '1' : '0';
    return s;
  }

  // BFS for a clearing order. Returns {path:[cellIdx...], nodes} or {path:null}.
  function solve(L, S0, limit) {
    limit = limit || 5e5;
    var start = S0 || init(L);
    if (won(L, start)) return { path: [], nodes: 0 };
    var q = [{ S: clone(start), path: [] }];
    var seen = Object.create(null);
    seen[stateKey(start)] = 1;
    var nodes = 0;
    while (q.length) {
      var cur = q.shift();
      nodes++;
      if (nodes > limit) return { path: null, nodes: nodes, truncated: true };
      var succ = successors(L, cur.S);
      for (var k = 0; k < succ.length; k++) {
        var s = succ[k];
        var sk = stateKey(s.S);
        if (seen[sk]) continue;
        seen[sk] = 1;
        var path = cur.path.concat([s.i]);
        if (won(L, s.S)) return { path: path, nodes: nodes };
        q.push({ S: s.S, path: path });
      }
    }
    return { path: null, nodes: nodes };
  }

  function validate(L) {
    var errs = [], seen = Object.create(null);
    if (!L.N) errs.push('empty level');
    for (var i = 0; i < L.N; i++) {
      var c = L.cells[i];
      if (!DIRS[c.d]) errs.push('cell ' + i + ' bad dir');
      var k = key(c.x, c.y, c.z);
      if (seen[k]) errs.push('overlap at ' + k);
      seen[k] = 1;
      if (c.frost < 0) errs.push('cell ' + i + ' negative frost');
    }
    return errs;
  }

  // Soft-fail check: no launchable cubes left while some remain → stuck (not lives).
  function checkStuck(L, S) {
    if (S.failed || won(L, S)) return false;
    return launchable(L, S).length === 0;
  }

  var api = {
    DIRS: DIRS, DIR_KEYS: DIR_KEYS,
    prep: prep, init: init, clone: clone,
    frostLeft: frostLeft, rayClear: rayClear, canLaunch: canLaunch,
    launch: launch, won: won, launchable: launchable, successors: successors,
    solve: solve, validate: validate, checkStuck: checkStuck, stateKey: stateKey
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SA = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
