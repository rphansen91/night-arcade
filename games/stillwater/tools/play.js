// iPhone-sized play-through with REAL TOUCH (CDP touch events -> pointerType "touch") on every pond.
// Needs a static server on :8817 at the repo root (or BASE=...). Uses /usr/bin/google-chrome.
const pw = require('playwright'), path = require('path');
const out = process.argv[2] || '/workspace/stillwater/shots3', BASE = process.env.BASE || 'http://127.0.0.1:8817';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(p);
  await p.goto(BASE + '/games/stillwater/?' + Date.now()); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => addEventListener('pointerdown', e => (window.__ptypes = window.__ptypes || {})[e.pointerType] = 1, true));
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  async function swipe(c, dir, opts = {}) {
    const dx = dir === 'k' ? 1 : dir === 'r' ? -1 : 0, dy = dir === 's' ? -1 : 0, L = opts.short ? 40 : 170;
    await touch('touchStart', c.x, c.y);
    for (let i = 1; i <= 8; i++) { await touch('touchMove', c.x + dx * L * i / 8, c.y + dy * L * 0.8 * i / 8); await p.waitForTimeout(14); }
    if (opts.hold) { await p.waitForTimeout(80); await p.screenshot({ path: opts.hold }); }
    await touch('touchEnd');
  }
  const waitIdle = async () => { for (let k = 0; k < 200; k++) { const c = await p.evaluate(() => Still.card); if (c && c.st === 'idle') return c; if (await p.evaluate(() => Still.mode) !== 'play') return null; await p.waitForTimeout(50); } return null; };
  const results = [];
  for (let i = 0; i < 8; i++) {
    await p.evaluate(i => Still.startPond(i), i); await p.waitForTimeout(500);
    if (i === 0) await p.screenshot({ path: path.join(out, '0-intro.png') });
    await p.evaluate(() => Still.play());
    let n = 0, wrongTried = false, snapTried = false;
    while (true) {
      const c = await waitIdle(); if (!c) break;
      if (i === 0 && n === 0) { await p.waitForTimeout(900); await p.screenshot({ path: path.join(out, '1-guided-ghost-hand.png') }); }
      if (i === 2 && !snapTried) { snapTried = true; await swipe(c, 'k', { short: true }); await p.waitForTimeout(700); continue; } // too short: must snap back
      if (i === 2 && !wrongTried && c.a === 'r') { wrongTried = true; await swipe(c, 'k'); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, '3-wrong-why.png') }); await waitIdle(); continue; }
      const shot = i === 4 && n === 1 ? path.join(out, '2-swipe-keep-tilt.png') : i === 4 && n === 4 ? path.join(out, '4-split-swipe.png') : null;
      await swipe(c, c.a, { hold: shot }); n++;
      await p.waitForTimeout(250);
    }
    await p.waitForTimeout(1900);
    const r = await p.evaluate(() => ({ mode: Still.mode, ...(({ ix, n, first, kept, best, wrongs }) => ({ ix, n, first, kept, best, wrongs }))(Still.st), fps: Math.round(__fps) }));
    results.push({ i, ...r });
    if (i === 7) await p.screenshot({ path: path.join(out, '5-end-card.png') });
  }
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('stillwater:v1')); (s.reviews || []).forEach(r => r.due = 0); localStorage.setItem('stillwater:v1', JSON.stringify(s)); });
  const pt = await p.evaluate(() => window.__ptypes);
  await p.reload(); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(out, '6-title-garden.png') });
  const gardenAfterReload = await p.evaluate(() => Still.garden.length);
  console.log(JSON.stringify(results, null, 0), '\npointerTypes:', JSON.stringify(pt), 'garden after reload:', gardenAfterReload, '\nerrors:', errs);
  await b.close();
})();
