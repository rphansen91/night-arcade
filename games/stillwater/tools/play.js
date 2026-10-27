// iPhone-sized play-through with real pointer input (down / move / up) on every pond, plus screenshots and fps.
// Needs a static server on :8817 at the repo root. CHROME=1 uses /usr/bin/google-chrome instead of WebKit.
const pw = require('playwright'), path = require('path');
const out = process.argv[2] || '/workspace/stillwater/shots2';
const BASE = process.env.BASE || 'http://127.0.0.1:8817';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = process.env.CHROME ? await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] }) : await pw.webkit.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(BASE + '/games/stillwater/?' + Date.now()); await p.waitForTimeout(1500);
  const results = [];
  for (let i = 0; i < 8; i++) {
    await p.evaluate(i => Still.startPond(i), i); await p.waitForTimeout(600);
    await p.evaluate(() => Still.play());
    const t0 = Date.now(); let shotAim = false, shotPerfect = false, throws = 0;
    while (Date.now() - t0 < 90000) {
      const plan = await p.evaluate(() => {
        const st = Still.st; if (st.won) return { won: true, t: st.t, stats: st.stats };
        if (st.rings.some(r => r.t0 > st.t)) return null;
        const t0 = st.t + SW.GLIDE_T + 0.25; let best = null;
        for (let x = 0.04; x <= 0.96; x += 0.04) for (let y = 0.04; y <= 0.96; y += 0.04) {
          const f = SW.forecast(st, x, y, t0); if (f.some(o => o.thorn)) continue;
          let sc = 0; for (const o of f) if (!o.thorn) sc += o.g === 'perfect' ? 3 : o.g === 'good' ? 1 : 0;
          if (sc >= 3 && (!best || sc > best.sc)) best = { x, y, sc };
        }
        return best ? Object.assign(best, Still.toPx(best)) : null;
      });
      if (plan && plan.won) { results.push({ i, won: true, t: plan.t.toFixed(1), throws, ...plan.stats }); break; }
      if (!plan) { await p.waitForTimeout(60); continue; }
      const flick = throws % 3 === 2; // every third throw is a flick that glides onto the spot
      if (flick) {
        const g = (1 - Math.exp(-5 * 0.38)) / 5, vx = 520; // px/s to the right
        const sx = plan.x - vx * g; await p.mouse.move(sx - 30, plan.y); await p.mouse.down();
        for (let k = 1; k <= 4; k++) { await p.mouse.move(sx - 30 + k * 7.5, plan.y); }
        await p.mouse.up();
      } else {
        await p.mouse.move(plan.x - 10, plan.y + 8); await p.mouse.down();
        await p.mouse.move(plan.x - 4, plan.y + 3, { steps: 3 }); await p.mouse.move(plan.x, plan.y, { steps: 3 });
        if (i === 5 && !shotAim) { await p.waitForTimeout(120); await p.screenshot({ path: path.join(out, '1-aim-preview.png') }); shotAim = true; }
        await p.waitForTimeout(140); await p.mouse.up();
      }
      throws++;
      if (i === 1 && !shotPerfect) { await p.waitForTimeout(1100); await p.screenshot({ path: path.join(out, '2-ripple-cancel.png') }); shotPerfect = true; }
      await p.waitForTimeout(120);
    }
    const fps = await p.evaluate(() => window.__fps);
    if (!results[i]) results.push({ i, won: false });
    results[i].fps = fps.toFixed(0);
    await p.waitForTimeout(2700);
    if (i === 2) {
      await p.evaluate(() => document.querySelector('#eRef .chip').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
      await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, '3-end-card.png') });
    }
  }
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('stillwater:v1')); s.reviews.forEach(r => r.due = 0); localStorage.setItem('stillwater:v1', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(1500); await p.screenshot({ path: path.join(out, '4-title-review.png') });
  console.log(JSON.stringify(results), 'errors:', errs);
  await b.close();
})();
