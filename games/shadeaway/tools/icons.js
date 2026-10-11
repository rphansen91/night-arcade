// Renders PWA icons + cover with headless Chrome. node tools/icons.js
const puppeteer = require('puppeteer-core'), fs = require('fs'), path = require('path');
const html = `<canvas id=c></canvas><script>
function shade(g,x,y,s,cols,lit){
  const h=s*0.42;
  // isometric-ish cube
  const pts={
    t:[[x,y-h*0.7],[x+h*0.85,y-h*0.35],[x,y],[x-h*0.85,y-h*0.35]],
    r:[[x,y],[x+h*0.85,y-h*0.35],[x+h*0.85,y+h*0.55],[x,y+h*0.9]],
    l:[[x,y],[x,y+h*0.9],[x-h*0.85,y+h*0.55],[x-h*0.85,y-h*0.35]]
  };
  function face(p,c){g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fillStyle=c;g.fill();g.strokeStyle='rgba(8,12,28,.55)';g.lineWidth=Math.max(1,s*0.02);g.stroke();}
  face(pts.t,cols[2]); face(pts.r,cols[1]); face(pts.l,cols[0]);
  // arrow on top toward +x-ish
  g.fillStyle='#eef5ff'; g.strokeStyle='#eef5ff'; g.lineWidth=Math.max(1.5,s*0.045); g.lineCap='round';
  const ax=x-h*0.15, ay=y-h*0.35, bx=x+h*0.35, by=y-h*0.5;
  g.beginPath();g.moveTo(ax,ay);g.lineTo(bx,by);g.stroke();
  g.beginPath();g.moveTo(bx,by);g.lineTo(bx-s*0.08,by+s*0.02);g.lineTo(bx-s*0.02,by+s*0.08);g.closePath();g.fill();
}
window.render=function(S,pad,cover){
  const c=document.getElementById('c');
  if(cover){c.width=1024;c.height=640;} else {c.width=c.height=S;}
  const g=c.getContext('2d');
  const W=c.width,H=c.height;
  const gr=g.createLinearGradient(0,0,0,H);gr.addColorStop(0,'#0c1230');gr.addColorStop(1,'#06070f');g.fillStyle=gr;g.fillRect(0,0,W,H);
  const rg=g.createRadialGradient(W*.5,H*.4,0,W*.5,H*.4,Math.max(W,H)*.55);rg.addColorStop(0,'rgba(168,196,255,.2)');rg.addColorStop(1,'transparent');g.fillStyle=rg;g.fillRect(0,0,W,H);
  // stars
  g.fillStyle='#e8f0ff';
  for(let i=0;i<40;i++){g.globalAlpha=.15+Math.random()*.4;g.beginPath();g.arc(Math.random()*W,Math.random()*H,Math.random()*1.6+.3,0,7);g.fill();}
  g.globalAlpha=1;
  const u = cover ? Math.min(W,H)*0.22 : S*(1-2*pad);
  const cx=W/2, cy=cover?H*0.52:S/2;
  const colsA=['#6a8fd8','#3a5a9e','#c8daff'], colsB=['#5ec4e8','#1d6a8c','#d8f6ff'], colsC=['#9a7ae0','#4f3594','#ece4ff'];
  const gap=u*0.55;
  shade(g,cx-gap,cy+gap*0.15,u*0.95,colsA);
  shade(g,cx+gap*0.15,cy-gap*0.35,u,colsB);
  shade(g,cx+gap*0.95,cy+gap*0.4,u*0.85,colsC);
  if(cover){
    g.fillStyle='#f0f5ff';g.font='800 54px system-ui,sans-serif';g.textAlign='center';
    g.shadowColor='rgba(168,196,255,.55)';g.shadowBlur=24;
    g.fillText('SHADEAWAY',W/2,72);
    g.shadowBlur=0;g.font='600 18px system-ui';g.fillStyle='rgba(168,196,255,.85)';g.letterSpacing='.35em';
    g.fillText('NIGHT ARCADE',W/2,108);
  }
  return c.toDataURL('image/png');
};
</script>`;
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setContent(html);
  const idir = path.join(__dirname, '../icons'); fs.mkdirSync(idir, { recursive: true });
  for (const [name, s, pad] of [['icon-192.png', 192, .06], ['icon-512.png', 512, .06], ['icon-maskable-512.png', 512, .18], ['apple-touch-icon.png', 180, .06], ['favicon-32.png', 32, 0]]) {
    const url = await p.evaluate((s, pad) => window.render(s, pad, false), s, pad);
    fs.writeFileSync(path.join(idir, name), Buffer.from(url.split(',')[1], 'base64'));
  }
  const sdir = path.join(__dirname, '../screenshots'); fs.mkdirSync(sdir, { recursive: true });
  const cover = await p.evaluate(() => window.render(512, 0, true));
  fs.writeFileSync(path.join(sdir, 'cover.png'), Buffer.from(cover.split(',')[1], 'base64'));
  await b.close(); console.log('icons + cover written');
})();
