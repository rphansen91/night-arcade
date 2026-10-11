# Shadeaway

Peel glowing shade-cubes from a midnight lattice. Tap only when the path is clear, or the lattice remembers.

Play: https://rphansen91.github.io/night-arcade/games/shadeaway/

## Rules (logic.js)
- Each cell is a shade-cube with an axis-aligned arrow (`+X/-X/+Y/-Y/+Z/-Z`).
- Tap launches a cube along its arrow **iff** the entire ray ahead is empty of other live cubes.
- A blocked tap costs a life. Soft-fail when lives hit 0 (Retry / Hint / Undo — never paywalled).
- Optional **frost**: a cube with frost N cannot launch until N other cubes have been cleared on that board.
- Clear every cube to win. Drag rotates the 3D camera.

## Files
- `index.html` shell + overlays, `game.js` 3D render/input/audio, `logic.js` rules (UMD), `levels.js` 24 handcrafted lattices.
- `tools/solve.js` BFS verifier — every board must be clearable without boosters.
- `tools/icons.js` headless Chrome icon + cover render.

Own name, fiction, procedural canvas art, and WebAudio. No CubeAway / GOODROID / Arrow Cube names or assets.
