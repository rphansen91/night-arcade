/* Lullwater — song data + chart builder (shared by the game and tools/check.js).
   All melodies are public-domain compositions, arranged by hand for four lanes.
   Token grammar: NOTE[+NOTE][:dur][/BASS[+BASS]]   e.g.  E5  G5:2/C3  C5+E5/C3  r:1 (rest)
   dur is in song units; rows = dur * rpu. A single tile of >= 2 rows is a long (hold) tile. */
(function (root) {
  var SONGS = [
    { id: 'little-star', title: 'Little Star', by: 'Traditional', tier: 1, rps: 1.7, rpu: 1, seed: 11,
      lede: 'A first lullaby. Slow, kind, and very forgiving.',
      score: 'C5/C3 C5 G5/E3 G5 A5/F3 A5 G5:2/C3 F5/F3 F5 E5/C3 E5 D5/G2 D5 C5:2/C3 ' +
             'G5/C3 G5 F5/G2 F5 E5/C3 E5 D5:2/G2 G5/C3 G5 F5/G2 F5 E5/C3 E5 D5:2/G2 ' +
             'C5/C3 C5 G5/E3 G5 A5/F3 A5 G5:2/C3 F5/F3 F5 E5/C3 E5 D5/G2 D5 C5:2/C3' },
    { id: 'joy-at-midnight', title: 'Joy at Midnight', by: 'Beethoven', tier: 1, rps: 1.9, rpu: 1, seed: 23,
      lede: 'The old hymn, hummed quietly across the water.',
      score: 'E5/C3 E5 F5 G5 G5/G2 F5 E5 D5 C5/C3 C5 D5 E5 E5:1.5/G2 D5:.5 D5:2 ' +
             'E5/C3 E5 F5 G5 G5/G2 F5 E5 D5 C5/C3 C5 D5 E5 D5:1.5/G2 C5:.5 C5:2/C3 ' +
             'D5/G2 D5 E5 C5/C3 D5/G2 E5:.5 F5:.5 E5/C3 C5 D5/G2 E5:.5 F5:.5 E5/C3 D5 C5/A2 D5 G4:2/G2 ' +
             'E5/C3 E5 F5 G5 G5/G2 F5 E5 D5 C5/C3 C5 D5 E5 D5:1.5/G2 C5:.5 C5+E5/C3 r:1' },
    { id: 'still-night', title: 'Still Night', by: 'Gruber', tier: 2, rps: 1.9, rpu: 0.5, seed: 37,
      lede: 'Long, held notes. Keep your finger down and let them ring.',
      score: 'G4:3/C3 A4:1 G4:2 E4:6 G4:3/C3 A4:1 G4:2 E4:6 D5:4/G2 D5:2 B4:6 C5:4/C3 C5:2 G4:6 ' +
             'A4:4/F2 A4:2 C5:3 B4:1 A4:2 G4:3/C3 A4:1 G4:2 E4:6 A4:4/F2 A4:2 C5:3 B4:1 A4:2 G4:3/C3 A4:1 G4:2 E4:6 ' +
             'D5:4/G2 D5:2 F5:3 D5:1 B4:2 C5:6/C3 E5:6/C3 C5:3/C3 G4:1 E4:2 G4:3/G2 F4:1 D4:2 C4:8/C3' },
    { id: 'green-sleeves', title: 'Green Sleeves at Dusk', by: 'Traditional', tier: 2, rps: 2.2, rpu: 1, seed: 41,
      lede: 'A minor-key ballad with lilting dotted steps.',
      score: 'A4/A2 C5:2/A2 D5 E5:1.5/C3 F5:.5 E5 D5:2/G2 B4 G4:1.5/E2 A4:.5 B4 C5:2/A2 A4 A4:1.5/F2 G#4:.5 A4 B4:2/E2 G#4 E4:2/E2 ' +
             'A4 C5:2/A2 D5 E5:1.5/C3 F5:.5 E5 D5:2/G2 B4 G4:1.5/E2 A4:.5 B4 C5:1.5/A2 B4:.5 A4 G#4:1.5/E2 F#4:.5 G#4 A4:3/A2 ' +
             'G5:3/C3 G5:1.5/C3 F#5:.5 E5 D5:2/G2 B4 G4:1.5/E2 A4:.5 B4 C5:2/A2 A4 A4:1.5/F2 G#4:.5 A4 B4:2/E2 G#4 E4:2/E2 r:1 ' +
             'G5:3/C3 G5:1.5/C3 F#5:.5 E5 D5:2/G2 B4 G4:1.5/E2 A4:.5 B4 C5:1.5/A2 B4:.5 A4 G#4:1.5/E2 F#4:.5 G#4 A4+E5/A2 r:1' },
    { id: 'letter-unsent', title: 'A Letter, Unsent', by: 'Beethoven', tier: 3, rps: 2.7, rpu: 1, seed: 53,
      lede: 'Quick turning figures. Watch the lanes, not your fingers.',
      score: 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2/A2 C4 E4 A4 B4:2/E2 E4 G#4 B4 C5:2/A2 E4 ' +
             'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2/A2 C4 E4 A4 B4:2/E2 E4 C5 B4 A4:2/A2 B4 ' +
             'C5/C3 D5 E5:2 G4/G2 F5 E5 D5:2 F4/A2 E5 D5 C5:2 E4/E2 D5 C5 B4:2 E4 E5 E5+E4 E5 D#5 ' +
             'E5 D#5 E5 D#5 E5 B4 D5 C5 A4:2/A2 C4 E4 A4 B4:2/E2 E4 C5 B4 A4:3/A2' },
    { id: 'moonlit-adagio', title: 'Moonlit Adagio', by: 'Beethoven', tier: 3, rps: 2.8, rpu: 1, seed: 67,
      lede: 'Endless rolling triplets under a full moon. Find the pulse.',
      score: 'G#4/C#3 C#5 E5 G#4 C#5 E5 G#4 C#5 E5 G#4 C#5 E5 G#4/B2 C#5 E5 G#4 C#5 E5 G#4 C#5 E5 G#4 C#5 E5 ' +
             'A4/A2 C#5 E5 A4 C#5 E5 A4/F#2 D5 F#5 A4 D5 F#5 G#4/G#2 C5 F#5 G#4 C#5 E5 G#4/G#2 C#5 D#5 F#4 C5 D#5 ' +
             'E4/C#3 G#4 C#5 E4 G#4 C#5 G#4/C#3 C#5 E5 G#4 C#5 E5 G#4/B2 C#5 E5 G#4 C#5 E5 ' +
             'A4/A2 C#5 E5 A4 C#5 E5 A4/F#2 D5 F#5 A4 D5 F#5 G#4/G#2 C5 F#5 G#4 C#5 E5 G#4/G#2 C#5 D#5 F#4 C5 D#5 ' +
             'E4/C#3 G#4 C#5 G#4 C#5 E5 C#5+G#5/C#3 r:1' },
    { id: 'canon-hours', title: 'Canon of the Small Hours', by: 'Pachelbel', tier: 4, rps: 2.4, rpu: 1, seed: 79,
      lede: 'Slow and stately, then it runs. The last song on the lake.',
      score: 'F#5:2/D3 E5:2/A2 D5:2/B2 C#5:2/F#2 B4:2/G2 A4:2/D3 B4:2/G2 C#5:2/A2 ' +
             'D5/D3 C#5 B4/A2 A4 G4/B2 F#4 G4/F#2 E4 D4/G2 F#4 A4/D3 G4 F#4/G2 D4 F#4/A2 E4 ' +
             'D5+F#4/D3 r:1 C#5+E4/A2 r:1 D5+F#4/B2 r:1 A4+C#4/F#2 r:1 ' +
             'D4:.5/D3 F#4:.5 A4:.5 G4:.5 F#4:.5/A2 D4:.5 F#4:.5 E4:.5 D4:.5/B2 B3:.5 D4:.5 A4:.5 G4:.5/F#2 B4:.5 A4:.5 G4:.5 ' +
             'F#4:.5/G2 D4:.5 E4:.5 C#5:.5 D5:.5/D3 F#5:.5 A5:.5 A4:.5 B4:.5/G2 G4:.5 A4:.5 F#4:.5 D4:1/A2 D5:1 D5+F#5/D3 r:1' }
  ];
  // stage multipliers: pass 0 → ★1 at end, … ★3, then ♛1–♛3, then endless (+5% per loop, capped)
  var STAGE_MUL = [1, 1.14, 1.28, 1.42, 1.56, 1.7];
  var ENDLESS_STEP = 0.05, MUL_CAP = 2.1, MAX_RPS = 5.6; // scroll never exceeds 5.6 rows/s, so a key is always on screen for 0.6s+
  function stageMul(pass, rps) { var m = pass < STAGE_MUL.length ? STAGE_MUL[pass] : Math.min(MUL_CAP, STAGE_MUL[STAGE_MUL.length - 1] + ENDLESS_STEP * (pass - STAGE_MUL.length + 1)); return rps ? Math.min(m, MAX_RPS / rps) : m; }

  var NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) {
    var m = /^([A-G])(#|b)?(-?\d)$/.exec(n); if (!m) throw new Error('bad note ' + n);
    return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function parse(score) {
    return score.trim().split(/\s+/).map(function (tok) {
      var bass = [], dur = 1, s = tok;
      var bi = s.indexOf('/'); if (bi >= 0) { bass = s.slice(bi + 1).split('+').map(midi); s = s.slice(0, bi); }
      var di = s.indexOf(':'); if (di >= 0) { dur = parseFloat(s.slice(di + 1)); s = s.slice(0, di); }
      if (s === 'r') return { rest: true, dur: dur, notes: [], bass: bass };
      return { rest: false, dur: dur, notes: s.split('+').map(midi), bass: bass };
    });
  }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // One pass of a song → rows. Lanes follow the melody's contour (up → right, down → left), never repeating a lane back to back.
  function buildPass(song) {
    var ev = parse(song.score), R = rng(song.seed), rows = [], y = 0, prevLane = -1, prevPitch = null;
    ev.forEach(function (e) {
      var h = e.dur * song.rpu;
      if (e.rest) { y += h; return; }
      if (e.notes.length >= 2) {
        var pairs = [[0, 2], [1, 3], [0, 3]].filter(function (p) { return p.indexOf(prevLane) < 0; });
        if (!pairs.length) pairs = [[0, 2], [1, 3]];
        var pr = pairs[Math.floor(R() * pairs.length)];
        rows.push({ r: y, h: Math.min(h, 1), lanes: pr.slice(), notes: e.notes, bass: e.bass, long: false });
        prevLane = pr[1]; prevPitch = e.notes[0];
      } else {
        var p = e.notes[0], cand = [0, 1, 2, 3].filter(function (l) { return l !== prevLane; }), lane;
        if (prevLane >= 0 && prevPitch != null && p !== prevPitch) {
          var dir = p > prevPitch ? 1 : -1, pref = cand.filter(function (l) { return (l - prevLane) * dir > 0; });
          if (pref.length) cand = pref;
          // prefer small steps for small intervals, big jumps for leaps
          var leap = Math.abs(p - prevPitch) > 4;
          cand.sort(function (a, b) { return leap ? Math.abs(b - prevLane) - Math.abs(a - prevLane) : Math.abs(a - prevLane) - Math.abs(b - prevLane); });
          lane = R() < 0.7 ? cand[0] : cand[Math.floor(R() * cand.length)];
        } else lane = cand[Math.floor(R() * cand.length)];
        var long = h >= 2;
        rows.push({ r: y, h: long ? h : h, lanes: [lane], notes: e.notes, bass: e.bass, long: long });
        prevLane = lane; prevPitch = p;
      }
      y += h;
    });
    return { rows: rows, len: y };
  }
  var api = { SONGS: SONGS, STAGE_MUL: STAGE_MUL, MUL_CAP: MUL_CAP, stageMul: stageMul, parse: parse, midi: midi, buildPass: buildPass };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LW = api;
})(this);
