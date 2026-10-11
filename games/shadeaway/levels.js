/* Shadeaway campaign — 24 handcrafted lattices. Verified by tools/solve.js.
   Each cell: {x,y,z, d:'x'|'-x'|'y'|'-y'|'z'|'-z', frost?:N, c?:palette}. */
(function (root) {
  'use strict';
  var LEVELS = [
    /* 1 — single cube, one tap */
    { name: 'First Drift', lives: 3, tip: 'Tap a shade-cube when its arrow path is clear. Drag to turn the lattice.',
      cells: [{ x: 0, y: 0, z: 0, d: 'x', c: 0 }] },

    /* 2 — two side-by-side, both free */
    { name: 'Twin Motes', lives: 3, tip: 'Either cube can drift — both paths are open.',
      cells: [
        { x: 0, y: 0, z: 0, d: 'y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'y', c: 1 }
      ] },

    /* 3 — outer blocks inner; peel outer first */
    { name: 'Peel Out', lives: 3, tip: 'The back cube is blocked. Clear the one in front of its arrow first.',
      cells: [
        { x: 0, y: 0, z: 0, d: 'x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 2 }
      ] },

    /* 4 — tiny L: three cubes */
    { name: 'Corner Glow', lives: 3, tip: 'Rotate the lattice — a clear path may hide on another face.',
      cells: [
        { x: 0, y: 0, z: 0, d: '-y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 1, z: 0, d: 'y', c: 3 }
      ] },

    /* 5 — 2×2 flat, outward arrows */
    { name: 'Flat Quartet', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 1, z: 0, d: '-x', c: 2 },
        { x: 1, y: 1, z: 0, d: 'x', c: 3 }
      ] },

    /* 6 — column of 3, peel top/bottom */
    { name: 'Stack Drift', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-z', c: 0 },
        { x: 0, y: 0, z: 1, d: 'y', c: 4 },
        { x: 0, y: 0, z: 2, d: 'z', c: 1 }
      ] },

    /* 7 — cross: center blocked until arms clear? Actually center points up free if arms don't block */
    { name: 'Crossroads', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: 'z', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: -1, y: 0, z: 0, d: '-x', c: 2 },
        { x: 0, y: 1, z: 0, d: 'y', c: 3 },
        { x: 0, y: -1, z: 0, d: '-y', c: 5 }
      ] },

    /* 8 — 2×2×1 with inward then need order: outer free */
    { name: 'Night Square', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-y', c: 0 },
        { x: 1, y: 0, z: 0, d: '-y', c: 1 },
        { x: 0, y: 1, z: 0, d: 'x', c: 2 },
        { x: 1, y: 1, z: 0, d: 'x', c: 3 }
      ] },

    /* 9 — small 3D: 2 layers */
    { name: 'Two Moons', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-z', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 0, z: 1, d: 'z', c: 2 },
        { x: 1, y: 0, z: 1, d: 'y', c: 4 }
      ] },

    /* 10 — zigzag chain */
    { name: 'Zigzag', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: 'x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'y', c: 1 },
        { x: 1, y: 1, z: 0, d: 'x', c: 2 },
        { x: 2, y: 1, z: 0, d: 'y', c: 3 },
        { x: 2, y: 2, z: 0, d: 'x', c: 5 }
      ] },

    /* 11 — 2×2×2 cubelet, outward faces */
    { name: 'Cubelet', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 1, z: 0, d: '-x', c: 2 },
        { x: 1, y: 1, z: 0, d: 'x', c: 3 },
        { x: 0, y: 0, z: 1, d: '-x', c: 4 },
        { x: 1, y: 0, z: 1, d: 'x', c: 5 },
        { x: 0, y: 1, z: 1, d: 'z', c: 6 },
        { x: 1, y: 1, z: 1, d: 'z', c: 7 }
      ] },

    /* 12 — bottleneck: one cube blocks two */
    { name: 'Bottleneck', lives: 3, tip: 'Clear the cube that frees the most paths.',
      cells: [
        { x: 2, y: 0, z: 0, d: 'x', c: 0 },
        { x: 0, y: 0, z: 0, d: 'x', c: 1 },
        { x: 1, y: 0, z: 0, d: 'y', c: 2 },
        { x: 1, y: 1, z: 0, d: 'y', c: 3 },
        { x: 0, y: 1, z: 0, d: '-x', c: 4 }
      ] },

    /* 13 — first frost (unlock after 1 clear) */
    { name: 'Rime Soft', lives: 3, tip: 'Frosted cubes thaw after other cubes drift away.',
      cells: [
        { x: 0, y: 0, z: 0, d: 'y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1, frost: 1 },
        { x: 1, y: 1, z: 0, d: 'y', c: 2 }
      ] },

    /* 14 — plus with depth */
    { name: 'Deep Cross', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-z', c: 0 },
        { x: 0, y: 0, z: 1, d: 'x', c: 1 },
        { x: 1, y: 0, z: 1, d: 'x', c: 2 },
        { x: -1, y: 0, z: 1, d: '-x', c: 3 },
        { x: 0, y: 1, z: 1, d: 'y', c: 4 },
        { x: 0, y: -1, z: 1, d: '-y', c: 5 },
        { x: 0, y: 0, z: 2, d: 'z', c: 6 }
      ] },

    /* 15 — spiral peel */
    { name: 'Spiral Peel', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 1, y: 1, z: 0, d: 'y', c: 2 },
        { x: 0, y: 1, z: 0, d: '-x', c: 3 },
        { x: 0, y: 0, z: 1, d: 'z', c: 4 },
        { x: 1, y: 1, z: 1, d: 'x', c: 5 }
      ] },

    /* 16 — denser 3×3 face with mixed dirs */
    { name: 'Face Nine', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-y', c: 0 },
        { x: 1, y: 0, z: 0, d: '-y', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 0, y: 1, z: 0, d: '-x', c: 3 },
        { x: 1, y: 1, z: 0, d: 'z', c: 4 },
        { x: 2, y: 1, z: 0, d: 'x', c: 5 },
        { x: 0, y: 2, z: 0, d: 'y', c: 6 },
        { x: 1, y: 2, z: 0, d: 'y', c: 7 },
        { x: 2, y: 2, z: 0, d: 'x', c: 0 }
      ] },

    /* 17 — frost 2 */
    { name: 'Hard Rime', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: 'y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 1, y: 1, z: 0, d: 'y', c: 3, frost: 2 },
        { x: 0, y: 1, z: 0, d: '-x', c: 4 }
      ] },

    /* 18 — 3D corridor */
    { name: 'Corridor', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'y', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 1, y: 0, z: 1, d: 'z', c: 3 },
        { x: 1, y: 1, z: 0, d: 'y', c: 4 },
        { x: 0, y: 0, z: 1, d: '-z', c: 5 },
        { x: 2, y: 0, z: 1, d: 'x', c: 6 }
      ] },

    /* 19 — cage shell */
    { name: 'Cage Shell', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-x', c: 0 },
        { x: 2, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 2, z: 0, d: '-x', c: 2 },
        { x: 2, y: 2, z: 0, d: 'x', c: 3 },
        { x: 0, y: 0, z: 2, d: '-x', c: 4 },
        { x: 2, y: 0, z: 2, d: 'x', c: 5 },
        { x: 0, y: 2, z: 2, d: 'y', c: 6 },
        { x: 2, y: 2, z: 2, d: 'z', c: 7 },
        { x: 1, y: 1, z: 1, d: 'y', c: 0 },
        { x: 1, y: 0, z: 1, d: '-y', c: 1 }
      ] },

    /* 20 — denser multi-layer */
    { name: 'Lattice Bloom', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-z', c: 0 },
        { x: 1, y: 0, z: 0, d: '-z', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 0, y: 1, z: 0, d: '-x', c: 3 },
        { x: 1, y: 1, z: 0, d: 'y', c: 4 },
        { x: 2, y: 1, z: 0, d: 'x', c: 5 },
        { x: 0, y: 0, z: 1, d: '-x', c: 6 },
        { x: 1, y: 0, z: 1, d: 'z', c: 7 },
        { x: 2, y: 0, z: 1, d: 'x', c: 0 },
        { x: 1, y: 1, z: 1, d: 'y', c: 1 },
        { x: 0, y: 1, z: 1, d: 'z', c: 2 }
      ] },

    /* 21 — frost mid-campaign */
    { name: 'Frost Gate', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: 'y', c: 0 },
        { x: 1, y: 0, z: 0, d: 'x', c: 1 },
        { x: 0, y: 1, z: 0, d: 'y', c: 2, frost: 1 },
        { x: 1, y: 1, z: 0, d: 'x', c: 3, frost: 2 },
        { x: 0, y: 0, z: 1, d: 'z', c: 4 },
        { x: 1, y: 0, z: 1, d: 'z', c: 5 },
        { x: 0, y: 1, z: 1, d: '-x', c: 6 },
        { x: 1, y: 1, z: 1, d: 'y', c: 7 }
      ] },

    /* 22 — tight knot */
    { name: 'Tight Knot', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-x', c: 0 },
        { x: 1, y: 0, z: 0, d: 'y', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 1, y: 0, z: 1, d: 'z', c: 3 },
        { x: 1, y: 1, z: 0, d: 'y', c: 4 },
        { x: 0, y: 1, z: 0, d: '-x', c: 5 },
        { x: 2, y: 1, z: 0, d: 'x', c: 6 },
        { x: 0, y: 0, z: 1, d: '-z', c: 7 },
        { x: 2, y: 0, z: 1, d: 'x', c: 0 }
      ] },

    /* 23 — large shell */
    { name: 'Shade Shell', lives: 3,
      cells: [
        { x: 0, y: 0, z: 0, d: '-y', c: 0 },
        { x: 1, y: 0, z: 0, d: '-y', c: 1 },
        { x: 2, y: 0, z: 0, d: '-y', c: 2 },
        { x: 0, y: 2, z: 0, d: 'y', c: 3 },
        { x: 1, y: 2, z: 0, d: 'y', c: 4 },
        { x: 2, y: 2, z: 0, d: 'y', c: 5 },
        { x: 0, y: 1, z: 0, d: '-x', c: 6 },
        { x: 2, y: 1, z: 0, d: 'x', c: 7 },
        { x: 1, y: 1, z: 0, d: 'z', c: 0 },
        { x: 0, y: 0, z: 1, d: '-z', c: 1 },
        { x: 2, y: 0, z: 1, d: 'x', c: 2 },
        { x: 0, y: 2, z: 1, d: '-x', c: 3 },
        { x: 2, y: 2, z: 1, d: 'z', c: 4 },
        { x: 1, y: 1, z: 1, d: 'y', c: 5 }
      ] },

    /* 24 — finale denser lattice with frost */
    { name: 'Midnight Core', lives: 4,
      cells: [
        { x: 0, y: 0, z: 0, d: '-z', c: 0 },
        { x: 1, y: 0, z: 0, d: '-z', c: 1 },
        { x: 2, y: 0, z: 0, d: 'x', c: 2 },
        { x: 0, y: 1, z: 0, d: '-x', c: 3 },
        { x: 1, y: 1, z: 0, d: 'y', c: 4, frost: 2 },
        { x: 2, y: 1, z: 0, d: 'x', c: 5 },
        { x: 0, y: 2, z: 0, d: 'y', c: 6 },
        { x: 1, y: 2, z: 0, d: 'y', c: 7 },
        { x: 2, y: 2, z: 0, d: 'x', c: 0 },
        { x: 0, y: 0, z: 1, d: '-x', c: 1 },
        { x: 1, y: 0, z: 1, d: 'z', c: 2 },
        { x: 2, y: 0, z: 1, d: 'x', c: 3 },
        { x: 0, y: 1, z: 1, d: 'z', c: 4 },
        { x: 1, y: 1, z: 1, d: 'y', c: 5, frost: 3 },
        { x: 2, y: 1, z: 1, d: 'z', c: 6 },
        { x: 1, y: 2, z: 1, d: 'y', c: 7 }
      ] }
  ];


  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
  root.SA_LEVELS = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
