# Lullwater

A mobile-first piano-tile rhythm game for Night Arcade. Moon-glass keys drift down four lanes onto a black mountain lake; tap each one as it meets the waterline and it plays the next note of the song.

- **Tap** a key as it reaches the water. **Hold** long keys until their thread of light runs out. **Twin** keys come side by side.
- Tapping the empty lake, or letting a key sink past the bottom, stops the music (the missed key scrolls back and flashes red).
- Finish a song for ★, it restarts faster for ★★ and ★★★, then three ♛ crowns, then an endless run that keeps speeding up (capped at 5.6 rows/s so every key is on screen for at least 0.6 s).
- One free **Second wind** per run. A brand-new player's first slip on the first song is forgiven once.
- Seven public-domain songs (`songs.js`), unlocked by earning ★ on the previous one.

Files: `index.html` (UI), `songs.js` (song data + chart builder, shared with tools), `game.js` (renderer, input, Web Audio piano), `sw.js` (network-first offline cache).

Tools:
- `node tools/check.js` — fairness check over every song and stage using the real chart builder: lanes, twin keys, max two fingers, minimum gap between taps, peak taps/s, look-ahead time, and a gentle first song.
- `tools/cover.js` — renders `screenshots/cover.png` and the PWA icons in WebKit (needs a local server on :8817 and `NODE_PATH` pointing at playwright).
