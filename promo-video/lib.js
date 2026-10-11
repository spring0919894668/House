/* ===========================================================
   lib.js – motion-design toolkit (deterministic: everything is f(t))
   =========================================================== */
const W = 1080, H = 1920, FPS = 30;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const E = {
  lin: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inCubic: t => t * t * t,
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutCubic: t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.9) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; },
  outElastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1),
};
const prog = (t, t0, d, e = E.outCubic) => e(clamp((t - t0) / d));
const decay = (t, t0, tau) => (t < t0 ? 0 : Math.exp(-(t - t0) / tau));
const spring = (u, k = 9, w = 22) => (u < 0 ? 1 : Math.exp(-k * u) * Math.cos(w * u)); // 1 -> 0 with ring
function hash(n) { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
function vn(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); }
function fbm(x, oct = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * vn(x * f + i * 17.3); a *= .5; f *= 2; } return s; }
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- data (cues.json from the synthesizer) ---------- */
let DATA, C, DONS = [], ACC = [];
function initData(d) {
  DATA = d; C = d.cues;
  DONS = d.hits.filter(h => h[2] === 'don').map(h => ({ t: h[0], v: h[1] }));
  const BIG = ['hook1', 'title', 'speaker', 'card1', 'offer', 'final', 'lockup'];
  const MED = ['hook3', 'sub', 'name', 'quote1', 'shi1', 'shi2', 'shi3', 'card2', 'card3', 'card4', 'date', 'place', 'button'];
  BIG.forEach(k => ACC.push({ t: C[k], a: 1 }));
  MED.forEach(k => ACC.push({ t: C[k], a: .55 }));
  for (let i = 0; i < 6; i++) ACC.push({ t: C.char0 + .25 * i, a: .35 });
  ACC.push({ t: C.hook2, a: .45 }, { t: C.quote2, a: .5 }, { t: C.line, a: .4 });
}
function kickPulse(t) { let p = 0; for (const h of DONS) { const u = t - h.t; if (u >= 0 && u < .5) p = Math.max(p, Math.min(1.3, h.v) * Math.exp(-u / .11)); } return p; }
function accent(t, tau) { let p = 0; for (const a of ACC) { const u = t - a.t; if (u >= 0 && u < 1) p += a.a * Math.exp(-u / tau); } return p; }

/* ---------- styles & text sprites ---------- */
const STY = {
  gold: { stops: [[0, '#fff8dc'], [.3, '#f7d982'], [.55, '#dca642'], [.78, '#9a6416'], [1, '#f3c868']], stroke: '#2b1804', glow: 'rgba(255,190,80,.65)' },
  cream: { stops: [[0, '#ffffff'], [.55, '#f4ecd8'], [1, '#c7bca1']], stroke: '#07080b', glow: 'rgba(255,238,200,.35)' },
  white: { stops: [[0, '#ffffff'], [1, '#e9e4d6']], stroke: '#07080b', glow: 'rgba(255,255,255,.25)' },
  red: { stops: [[0, '#ffc2a8'], [.4, '#f0603f'], [1, '#a81c0b']], stroke: '#230401', glow: 'rgba(255,84,40,.7)' },
  ice: { stops: [[0, '#eef7ff'], [.5, '#a5c2de'], [1, '#5e7896']], stroke: '#05080c', glow: 'rgba(150,200,255,.5)' },
  ink: { stops: [[0, '#2b2b2b'], [1, '#050505']], stroke: null, glow: null },
  fire: { stops: [[0, '#fff6c8'], [.3, '#ffc65a'], [.6, '#f0652f'], [1, '#8f1608']], stroke: '#240603', glow: 'rgba(255,92,40,.8)' },
  dim: { stops: [[0, '#bfc6d2'], [1, '#7c8696']], stroke: '#05070a', glow: null },
};
const FONTS = { serif: 'NSerif9', serif6: 'NSerif6', sans: 'NSans', brush: 'Boku' };
const _sc = {};
function textSprite(str, size, style = 'gold', font = 'serif', o = {}) {
  const key = [str, size, style, font, o.sw || '', o.glowB || ''].join('|');
  if (_sc[key]) return _sc[key];
  const g0 = mk(8, 8).getContext('2d'); g0.font = `${size}px ${FONTS[font]}`;
  const tw = g0.measureText(str).width;
  const pad = Math.ceil(size * .6), w = Math.ceil(tw + pad * 2), h = Math.ceil(size * 1.5 + pad * 2);
  const c = mk(w, h), g = c.getContext('2d'); const st = STY[style];
  g.font = `${size}px ${FONTS[font]}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const cx = w / 2, cy = h / 2 + size * .04;
  const gr = g.createLinearGradient(0, cy - size * .55, 0, cy + size * .55);
  st.stops.forEach(s => gr.addColorStop(s[0], s[1]));
  if (st.glow) { g.save(); g.shadowColor = st.glow; g.shadowBlur = o.glowB ?? size * .22; g.fillStyle = st.stops[2] ? st.stops[2][1] : '#fff'; g.fillText(str, cx, cy); g.restore(); }
  if (st.stroke) { g.lineWidth = o.sw ?? Math.max(2, size * .06); g.strokeStyle = st.stroke; g.strokeText(str, cx, cy); }
  g.fillStyle = gr; g.fillText(str, cx, cy);
  if (style === 'gold') { // thin inner highlight
    g.save(); g.globalCompositeOperation = 'source-atop'; g.lineWidth = Math.max(1, size * .012); g.strokeStyle = 'rgba(255,250,220,.55)'; g.strokeText(str, cx, cy - size * .006); g.restore();
  }
  return (_sc[key] = { c, w, h, cx, cy, tw, size });
}
function lineSprites(str, size, style, font, spacing = 0, o = {}) {
  const items = []; let total = 0; const chars = [...str];
  const sps = chars.map(ch => textSprite(ch, size, style, font, o));
  const adv = sps.map(s => s.tw + spacing);
  total = adv.reduce((a, b) => a + b, 0) - spacing;
  let x = -total / 2;
  chars.forEach((ch, i) => { items.push({ ch, sp: sps[i], x: x + sps[i].tw / 2 }); x += adv[i]; });
  return { items, width: total, size };
}
function drawSprite(g, sp, x, y, sx = 1, sy = sx, rot = 0, alpha = 1) {
  if (alpha <= 0) return; g.save(); g.globalAlpha *= alpha; g.translate(x, y); if (rot) g.rotate(rot); g.scale(sx, sy);
  g.drawImage(sp.c, -sp.cx, -sp.cy); g.restore();
}

/* slam one glyph with punchy overshoot (scale/rotation/drop spring + smear + hot flash) */
function slamItem(g, it, x, y, t, t0, o = {}) {
  const u = t - t0; if (u < 0) return;
  const s0 = o.s0 ?? 2.3, rot0 = o.rot ?? .22, dy0 = o.dy ?? -110, i = o.i ?? 0;
  const sp = spring(u, o.k ?? 9.5, o.w ?? 21);
  const sc = 1 + (s0 - 1) * sp;
  const rot = (hash(i * 3.3 + t0 * 7) - .5) * 2 * rot0 * sp;
  const yy = y + dy0 * sp + (o.sink ? o.sink(u, i) : 0), xx = x + (o.dx ? o.dx(u, i) : 0);
  const a = clamp(u / .04) * (o.alpha ?? 1);
  if (u < .1) for (let k = 1; k <= 3; k++) drawSprite(g, it.sp, xx, yy - dy0 * .15 * k * (1 - u / .1), sc * (1 + .1 * k), sc * (1 + .18 * k), rot, a * .18 * (1 - u / .1));
  drawSprite(g, it.sp, xx, yy, sc, sc, rot, a);
  const f = Math.exp(-u / .09) * .9;
  if (f > .02) { g.save(); g.globalCompositeOperation = 'lighter'; drawSprite(g, it.sp, xx, yy, sc, sc, rot, f * .7 * a); g.restore(); }
}
function slamLine(g, line, cx, cy, t, t0, o = {}) {
  const st = o.stagger ?? .05;
  line.items.forEach((it, i) => slamItem(g, it, cx + it.x, cy, t, t0 + i * st, { ...o, i }));
}
/* soft glint sweep across a sprite */
const _gt = mk(10, 10);
function glint(g, sp, x, y, ph, sc = 1, rot = 0, strength = .9, bandW = .28) {
  if (ph <= 0 || ph >= 1) return;
  if (_gt.width !== sp.w || _gt.height !== sp.h) { _gt.width = sp.w; _gt.height = sp.h; }
  const t = _gt.getContext('2d'); t.clearRect(0, 0, sp.w, sp.h);
  const pos = lerp(-bandW, 1 + bandW, ph) * (sp.w + sp.h);
  const gr = t.createLinearGradient(pos - sp.h * .5, 0, pos + sp.h * .5 - sp.h * .5, sp.h);
  const p = (pos / (sp.w + sp.h));
  t.save(); t.translate(0, 0);
  const g2 = t.createLinearGradient(pos - sp.h, sp.h, pos, 0);
  g2.addColorStop(0, 'rgba(255,255,255,0)'); g2.addColorStop(.5, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
  t.fillStyle = g2; t.fillRect(0, 0, sp.w, sp.h); t.restore();
  t.globalCompositeOperation = 'destination-in'; t.drawImage(sp.c, 0, 0);
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); if (rot) g.rotate(rot); g.scale(sc, sc); g.globalAlpha *= strength;
  g.drawImage(_gt, -sp.cx, -sp.cy); g.restore();
}

/* ---------- FX ---------- */
function ring(g, x, y, t, t0, o = {}) {
  const dur = o.dur ?? .55, u = (t - t0) / dur; if (u < 0 || u > 1) return;
  const R = (o.R ?? 480) * E.outExpo(u);
  g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = o.color ?? 'rgba(255,214,130,1)';
  g.globalAlpha = (1 - u) * (o.a ?? .85); g.lineWidth = (o.w ?? 16) * (1 - u) + 1;
  if (o.sy) { g.save(); g.translate(x, y); g.scale(1, o.sy); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.restore(); } else { g.beginPath(); g.arc(x, y, R, 0, TAU); }
  g.stroke(); g.restore();
}
function sparks(g, x, y, t, t0, o = {}) {
  const life = o.life ?? .8, u = t - t0; if (u < 0 || u > life) return;
  const n = o.n ?? 26, spd = o.speed ?? 760, col = o.color ?? '255,214,130', seed = o.seed ?? 1;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(seed * 13 + i * 3.17) * TAU + (o.ang ?? 0), sp = spd * (.35 + .65 * hash(seed * 7 + i * 7.7));
    const pos = k => sp * (1 - Math.exp(-k * 4.5)) / 4.5;
    const d = pos(u), d2 = pos(Math.max(0, u - .05));
    const gy = (o.grav ?? 500) * u * u * .5;
    const al = (1 - u / life) * (.5 + .5 * hash(i + seed));
    g.strokeStyle = `rgba(${col},${al})`; g.lineWidth = (o.size ?? 5) * (1 - u / life) * (.5 + hash(i * 5 + seed));
    g.beginPath(); g.moveTo(x + Math.cos(a) * d2, y + Math.sin(a) * d2 + gy * .8); g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d + gy); g.stroke();
  }
  g.restore();
}
function splat(g, x, y, t, t0, o = {}) { // ink blobs
  const u = t - t0; if (u < 0 || u > 1.2) return;
  const n = o.n ?? 16, seed = o.seed ?? 3, R = o.R ?? 260;
  g.save(); g.fillStyle = o.color ?? 'rgba(235,225,200,0.9)';
  for (let i = 0; i < n; i++) {
    const a = hash(seed * 5 + i * 2.7) * TAU, r = R * (.25 + .75 * hash(seed + i * 9.1)) * E.outExpo(clamp(u / .25));
    const s = (4 + 14 * hash(i * 1.7 + seed)) * (1 - clamp((u - .3) / .9)) * (o.s ?? 1);
    g.globalAlpha = (1 - clamp((u - .25) / .95)) * (o.a ?? .8);
    g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * .8, s, 0, TAU); g.fill();
  }
  g.restore();
}
function slashLine(g, x1, y1, x2, y2, t, t0, o = {}) {
  const dur = o.dur ?? .32, u = t - t0; if (u < 0 || u > dur * 2) return;
  const p = E.outExpo(clamp(u / (dur * .45))), tail = clamp((u - dur * .3) / (dur * 1.5));
  const ax = lerp(x1, x2, tail * .85), ay = lerp(y1, y2, tail * .85), bx = lerp(x1, x2, p), by = lerp(y1, y2, p);
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const w = (o.w ?? 22) * (1 - tail * .7);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - tail) * (o.a ?? 1);
  for (const [k, al, col] of [[1, .25, o.glow ?? '255,200,110'], [.45, .55, o.glow ?? '255,230,170'], [.12, 1, '255,255,255']]) {
    g.fillStyle = `rgba(${col},${al})`; g.beginPath(); g.moveTo(ax, ay);
    g.quadraticCurveTo((ax + bx) / 2 + nx * w * k, (ay + by) / 2 + ny * w * k, bx, by);
    g.quadraticCurveTo((ax + bx) / 2 - nx * w * k, (ay + by) / 2 - ny * w * k, ax, ay); g.fill();
  }
  g.restore();
}
function flash(g, t, t0, a = .6, tau = .07, col = '255,246,226') {
  const f = decay(t, t0, tau) * a; if (f < .01) return;
  g.save(); g.fillStyle = `rgba(${col},${f})`; g.fillRect(-60, -60, W + 120, H + 120); g.restore();
}
function speedLines(g, cx, cy, t, t0, dur, o = {}) {
  const u = (t - t0) / dur; if (u < 0 || u > 1) return;
  const n = o.n ?? 40; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = hash(i * 4.1 + (o.seed ?? 1)) * TAU, r0 = 300 + hash(i * 9.3) * 500 + u * 400, len = 180 + hash(i * 2.3) * 400;
    g.strokeStyle = `rgba(${o.col ?? '255,226,160'},${(o.a ?? .5) * (1 - u) * (.3 + hash(i))})`; g.lineWidth = 1.5 + hash(i * 7) * 3;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 1.2); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 1.2); g.stroke();
  }
  g.restore();
}

/* ---------- svg-path icons (viewBox 100) with stroke-draw animation ---------- */
const _svgNS = 'http://www.w3.org/2000/svg';
const ICONS = {
  mountain: ['M8 84 L38 36 L52 58 L64 42 L92 84 Z', 'M38 36 L38 12 L58 21 L38 29'],
  bulb: ['M50 10 C30 10 19 27 19 40 C19 53 28 58 34 67 L34 75 L66 75 L66 67 C72 58 81 53 81 40 C81 27 70 10 50 10 Z', 'M38 84 L62 84', 'M43 93 L57 93', 'M42 58 L42 44 L50 52 L58 44 L58 58'],
  person: ['M50 12 a17 17 0 1 0 0.01 0', 'M16 90 C16 62 33 54 50 54 C67 54 84 62 84 90'],
  doc: ['M24 8 H62 L80 26 V92 H24 Z', 'M62 8 V26 H80', 'M36 46 H68', 'M36 60 H68', 'M36 74 H56'],
  people: ['M36 30 a12 12 0 1 0 0.01 0', 'M12 84 C12 62 26 54 36 54 C46 54 60 62 60 84', 'M68 36 a10 10 0 1 0 0.01 0', 'M64 56 C78 54 90 62 90 84'],
  magnifier: ['M42 12 a29 29 0 1 0 0.01 0', 'M63 63 L90 90', 'M30 42 a12 12 0 0 1 12 -12'],
  chart: ['M12 88 H90', 'M22 88 V62 H38 V88', 'M44 88 V42 H60 V88', 'M66 88 V20 H82 V88'],
  clock: ['M50 8 a42 42 0 1 0 0.01 0', 'M50 24 V50 L68 62', 'M20 14 L8 26', 'M80 14 L92 26'],
  pin: ['M50 94 C28 66 20 54 20 40 a30 30 0 1 1 60 0 C80 54 72 66 50 94 Z', 'M50 30 a11 11 0 1 0 0.01 0'],
  star: ['M50 8 L61 38 L93 40 L68 60 L77 92 L50 74 L23 92 L32 60 L7 40 L39 38 Z'],
};
const _len = {};
function pathLen(d) { if (_len[d] != null) return _len[d]; const p = document.createElementNS(_svgNS, 'path'); p.setAttribute('d', d); return (_len[d] = p.getTotalLength()); }
const _p2d = {};
function drawIcon(g, name, x, y, size, p, o = {}) {
  if (p <= 0) return; const paths = ICONS[name]; const ls = paths.map(pathLen); const tot = ls.reduce((a, b) => a + b, 0);
  g.save(); g.translate(x - size / 2, y - size / 2); g.scale(size / 100, size / 100);
  g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = o.lw ?? 5;
  let acc = 0; const col = o.color ?? '#f6d57e';
  paths.forEach((d, i) => {
    const frac = clamp((p * tot - acc) / ls[i]); acc += ls[i]; if (frac <= 0) return;
    const P = _p2d[d] || (_p2d[d] = new Path2D(d));
    g.setLineDash([ls[i], ls[i] + 4]); g.lineDashOffset = ls[i] * (1 - frac);
    if (o.glow) { g.save(); g.strokeStyle = o.glow; g.lineWidth = (o.lw ?? 5) * 2.6; g.globalAlpha *= .35; g.stroke(P); g.restore(); }
    g.strokeStyle = col; g.stroke(P);
    if (o.fill && frac >= 1) { g.save(); g.fillStyle = o.fill; g.globalAlpha *= .22; g.fill(P); g.restore(); }
  });
  g.restore();
}

/* ---------- seal (vermilion stamp) ---------- */
const _seal = {};
function sealSprite(str, size, vertical = false) {
  const key = str + size; if (_seal[key]) return _seal[key];
  const w = size, c = mk(w + 40, w + 40), g = c.getContext('2d'); g.translate(20, 20);
  g.fillStyle = '#c9331f'; g.beginPath(); g.roundRect(0, 0, w, w, w * .06); g.fill();
  g.strokeStyle = '#ffd9c8'; g.lineWidth = Math.max(2, w * .035); g.globalAlpha = .9; g.beginPath(); g.roundRect(w * .07, w * .07, w * .86, w * .86, w * .03); g.stroke(); g.globalAlpha = 1;
  g.fillStyle = '#fff1e4'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const chars = [...str];
  if (chars.length === 1) { g.font = `${w * .62}px ${FONTS.brush}`; g.fillText(chars[0], w / 2, w / 2 + w * .03); }
  else if (chars.length === 2 && !vertical) { g.font = `${w * .36}px ${FONTS.brush}`; g.fillText(chars[0], w / 2, w * .32); g.fillText(chars[1], w / 2, w * .68); }
  else { g.font = `${w * .30}px ${FONTS.brush}`; chars.slice(0, 4).forEach((ch, i) => g.fillText(ch, w * (i % 2 ? .3 : .7), w * (i < 2 ? .3 : .7))); }
  g.globalCompositeOperation = 'destination-out';           // worn edges / ink dropout
  for (let i = 0; i < 260; i++) { const x = hash(i * 2.1) * w, y = hash(i * 3.7 + 5) * w, r = 1 + hash(i * 9.1) * 3.2; g.globalAlpha = .55 + .4 * hash(i); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  return (_seal[key] = { c, w: w + 40, h: w + 40, cx: (w + 40) / 2, cy: (w + 40) / 2 });
}
