// WebKit iPhone play-through: real pointer input on every pond, screenshots, fps. Needs server on :8817.
const pw = require('playwright'), path = require('path');
const out = process.argv[2] || '/workspace/stillwater/shots';
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const b = process.env.CHROME ? await pw.chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] }) : await pw.webkit.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://127.0.0.1:8817/games/stillwater/'); await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, '1-title.png') });
  const results = [];
  for (let i = 0; i < 8; i++) {
    await p.evaluate(i => { Still.startPond(i); }, i); await p.waitForTimeout(700);
    if (i === 2) await p.screenshot({ path: path.join(out, 'intro-3.png') });
    await p.evaluate(() => Still.play());
    let shot = false; const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const s = await p.evaluate(() => { const st = Still.st; return { won: st.won, lost: st.lost, t: st.t, win: st.P.win, sp: st.sp.map(s => ({ k: s.k, c: s.control, a: SW.active(s, st.t), cool: s.cool, hold: s.hold, per: s.period, ph: s.phase, px: Still.toPx(SW.pos(s, st.t)), n: SW.pos(s, st.t) })), asp: Still.aspect() }; });
      if (s.won || s.lost) { results.push({ i, won: s.won, t: s.t.toFixed(1) }); break; }
      const tgt = s.sp.find(x => x.c && x.a && x.cool <= 0);
      if (!tgt) { await p.waitForTimeout(100); continue; }
      // choose release time: next crest at least hold+0.15s away
      const h = tgt.hold + 0.15; const phNow = (((s.t / tgt.per + tgt.ph) % 1) + 1) % 1;
      let wait = (1 - phNow) * tgt.per - h; while (wait < 0.05) wait += tgt.per;
      // thorn proximity check is done by game; just aim at spirit
      await p.waitForTimeout(wait * 1000 - 40);
      // re-aim: is a thorn closer now?
      const ok = await p.evaluate(k => { const st = Still.st, s = st.sp[k], q = SW.pos(s, st.t); return SW.targetAt(st, q.x, q.y, Still.aspect()) === k; }, tgt.k);
      if (!ok) { await p.waitForTimeout(300); continue; }
      await p.mouse.move(tgt.px.x, tgt.px.y); await p.mouse.down();
      if (!shot && i === 5) { await p.waitForTimeout(h * 700); await p.screenshot({ path: path.join(out, '2-pond6-hold.png') }); await p.waitForTimeout(h * 300); shot = true; }
      else await p.waitForTimeout(h * 1000);
      // fine-correct to crest using game clock
      for (let g = 0; g < 10; g++) { const d = await p.evaluate(k => SW.crestDist(Still.st.sp[k], Still.st.t), tgt.k); if (d < s.win * 0.3) break; await p.waitForTimeout(30); }
      await p.mouse.up();
      if (i === 2) { await p.waitForTimeout(350); await p.screenshot({ path: path.join(out, '3-pond3-calm.png') }); }
      await p.waitForTimeout(200);
    }
    const fps = await p.evaluate(() => window.__fps);
    results[results.length - 1].fps = fps.toFixed(0);
    await p.waitForTimeout(2600);
    if (i === 0) await p.screenshot({ path: path.join(out, '4-end-card.png') });
  }
  await p.evaluate(() => Still.storyBeat('bell')); await p.waitForTimeout(2600); await p.screenshot({ path: path.join(out, '5-bell.png') });
  console.log(JSON.stringify(results), 'errors:', errs);
  await b.close();
})();
