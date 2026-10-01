// usage: node render.js <startFrame> <endFrame> [outDir]   (exclusive end)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, [s, e, out = path.join(root, 'frames')] = [+process.argv[2], +process.argv[3], process.argv[4]];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (er, d) => { if (er) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', er => console.error('PAGEERR', er.message)); p.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await p.goto(`http://localhost:${port}/index.html`); await p.waitForFunction('window.ready===true', null, { timeout: 120000 });
  const t0 = Date.now();
  const list = process.env.FRAMES ? process.env.FRAMES.split(',').map(Number) : null;
  for (let n = s; n < e; n++) { if (list && !list.includes(n)) continue;
    await p.evaluate(n => window.renderFrame(n), n);
    const buf = await p.locator('#c').screenshot({ type: 'png' });   // exact canvas pixels
    fs.writeFileSync(path.join(out, 'f' + String(n).padStart(4, '0') + '.png'), buf);
    if ((n - s) % 20 === 0) console.log(n, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  }
  await b.close(); srv.close();
})();
