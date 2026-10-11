// Cover art + PWA icons from the live renderer (WebKit). Needs a local server on :8817 serving the repo root.
// cd /tmp/pw && node /workspace/lantern/games/lullwater/tools/cover.js
const pw = require('playwright'), path = require('path'), fs = require('fs');
(async () => {
  const b = await pw.webkit.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  await p.goto('http://127.0.0.1:8817/games/lullwater/'); await p.waitForTimeout(400);
  await p.evaluate(() => { document.documentElement.classList.add('cover'); Lull.cover(3, 1); });
  await p.waitForTimeout(2600);
  await p.evaluate(() => {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:0;right:0;top:30px;text-align:center;z-index:50;font:800 40px system-ui;letter-spacing:.34em;color:#f3f7ff;text-shadow:0 0 26px rgba(199,164,255,.75),0 2px 0 rgba(0,0,0,.5)';
    t.textContent = 'LULLWATER'; document.body.appendChild(t);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(__dirname, '../screenshots/cover.png') });
  // icons
  const html = `<canvas id=c></canvas><script>
  window.render=function(S,pad){const c=document.getElementById('c');c.width=c.height=S;const g=c.getContext('2d');
    let gr=g.createLinearGradient(0,0,0,S);gr.addColorStop(0,'#0a0f2c');gr.addColorStop(.62,'#1f2d62');gr.addColorStop(.63,'#0a1230');gr.addColorStop(1,'#02040b');g.fillStyle=gr;g.fillRect(0,0,S,S);
    const k=1-2*pad,u=S*k,o=S*pad,hy=o+u*.7;
    let rg=g.createRadialGradient(o+u*.74,o+u*.2,0,o+u*.74,o+u*.2,u*.4);rg.addColorStop(0,'rgba(200,220,255,.5)');rg.addColorStop(1,'rgba(156,192,255,0)');g.fillStyle=rg;g.fillRect(0,0,S,S);
    g.fillStyle='#fffbe8';g.beginPath();g.arc(o+u*.74,o+u*.2,u*.085,0,7);g.fill();
    // key
    const kw=u*.3,kh=u*.44,kx=o+u*.5-kw/2,ky=hy-kh-u*.02;
    let gl=g.createRadialGradient(o+u*.5,hy-kh*.4,0,o+u*.5,hy-kh*.4,u*.42);gl.addColorStop(0,'rgba(156,192,255,.55)');gl.addColorStop(1,'rgba(156,192,255,0)');g.fillStyle=gl;g.fillRect(0,0,S,S);
    let kg=g.createLinearGradient(0,ky,0,ky+kh);kg.addColorStop(0,'#5d74b8');kg.addColorStop(.55,'#9cc0ff');kg.addColorStop(1,'#eef4ff');
    g.fillStyle=kg;g.beginPath();g.roundRect(kx,ky,kw,kh,u*.035);g.fill();g.strokeStyle='rgba(255,255,255,.8)';g.lineWidth=Math.max(1,u*.008);g.stroke();
    g.fillStyle='#0c1230';g.globalAlpha=.7;g.beginPath();g.arc(o+u*.5,ky+kh*.5,u*.055,0,7);g.fill();g.globalCompositeOperation='destination-over';g.globalAlpha=1;
    g.globalCompositeOperation='source-over';
    // crescent cut
    let kg2=g.createLinearGradient(0,ky,0,ky+kh);kg2.addColorStop(0,'#5d74b8');kg2.addColorStop(.55,'#9cc0ff');kg2.addColorStop(1,'#eef4ff');g.fillStyle=kg2;g.beginPath();g.arc(o+u*.5+u*.025,ky+kh*.5-u*.02,u*.048,0,7);g.fill();
    // waterline + ripples + reflection
    g.fillStyle='rgba(230,240,255,.9)';g.fillRect(o,hy,u,Math.max(1,u*.006));
    g.strokeStyle='rgba(200,220,255,.5)';g.lineWidth=Math.max(1,u*.006);for(const r of [.12,.2,.28]){g.beginPath();g.ellipse(o+u*.5,hy+u*.05,u*r,u*r*.2,0,0,7);g.stroke();}
    let rf=g.createLinearGradient(0,hy,0,hy+u*.25);rf.addColorStop(0,'rgba(156,192,255,.35)');rf.addColorStop(1,'rgba(156,192,255,0)');g.fillStyle=rf;g.fillRect(kx+u*.02,hy+2,kw-u*.04,u*.25);
    return c.toDataURL('image/png');};</script>`;
  const q = await b.newPage(); await q.setContent(html);
  const dir = path.join(__dirname, '../icons');
  for (const [name, s, pad] of [['icon-192.png', 192, .04], ['icon-512.png', 512, .04], ['icon-maskable-512.png', 512, .16], ['apple-touch-icon.png', 180, .04], ['favicon-32.png', 32, 0]]) {
    const url = await q.evaluate(([s, pad]) => window.render(s, pad), [s, pad]);
    fs.writeFileSync(path.join(dir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  await b.close(); console.log('cover + icons written');
})();
