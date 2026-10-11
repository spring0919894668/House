/* ===========================================================
   bg.js – ink-wash night landscape, bagua rings, brush strokes
   =========================================================== */
const BG = {};
const TINTS = [
  { t: 0,  top: [7, 12, 24],  glow: [150, 185, 240], mid: [14, 24, 44] },
  { t: 4,  top: [20, 13, 8],  glow: [255, 190, 90],  mid: [40, 24, 10] },
  { t: 8,  top: [10, 12, 22], glow: [255, 205, 130], mid: [26, 20, 18] },
  { t: 12, top: [28, 7, 7],   glow: [255, 78, 48],   mid: [48, 12, 10] },
  { t: 15, top: [7, 14, 30],  glow: [255, 210, 130], mid: [16, 28, 48] },
  { t: 20, top: [20, 13, 7],  glow: [255, 190, 80],  mid: [42, 26, 10] },
  { t: 25, top: [30, 8, 8],   glow: [255, 100, 56],  mid: [52, 14, 10] },
  { t: 28, top: [20, 11, 8],  glow: [255, 204, 110], mid: [40, 24, 10] },
];
function tintAt(t) {
  let k = 0; for (let i = 0; i < TINTS.length; i++) if (t >= TINTS[i].t) k = i;
  const a = TINTS[Math.max(0, k - 1)], b = TINTS[k], f = k === 0 ? 1 : E.inOutSine(clamp((t - b.t) / .6));
  const mix = key => b[key].map((v, i) => lerp(a[key][i], v, f));
  return { top: mix('top'), glow: mix('glow'), mid: mix('mid') };
}
const rgb = (a, al = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`;

function ridgeSprite(w, h, base, amp, seed, rough, c0, c1, blur, extras) {
  const c = mk(w, h), g = c.getContext('2d'); if (blur) g.filter = `blur(${blur}px)`;
  const yAt = x => { const s = vn(x / rough + seed) * .55 + fbm(x / (rough * .45) + seed * 3, 3) * .45; const r = 1 - Math.abs(2 * s - 1); return base - amp * (Math.pow(r, 1.6) * .85 + s * .3); };
  const gr = g.createLinearGradient(0, base - amp, 0, h); gr.addColorStop(0, c0); gr.addColorStop(.55, c1); gr.addColorStop(1, c1);
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 3) g.lineTo(x, yAt(x)); g.lineTo(w, h); g.closePath(); g.fill();
  if (extras) extras(g, yAt);
  return c;
}
function pagoda(g, x, y, s, col) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = col;
  g.fillRect(-4, -190, 8, 30);
  let yy = 0;
  for (let i = 0; i < 5; i++) {
    const w = 46 - i * 6, h = 26;
    g.fillRect(-w * .55, yy - 26 - h, w * 1.1, h);                  // body
    g.beginPath(); g.moveTo(-w - 14, yy - 26); g.quadraticCurveTo(-w * .6, yy - 24, -w * .5, yy - 36); g.lineTo(w * .5, yy - 36); g.quadraticCurveTo(w * .6, yy - 24, w + 14, yy - 26); g.lineTo(w + 6, yy - 20); g.lineTo(-w - 6, yy - 20); g.fill();
    yy -= 36;
  }
  g.restore();
}
function pine(g, x, y, s, flip, col) {
  g.save(); g.translate(x, y); g.scale(flip * s, s); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round';
  g.lineWidth = 16; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-40, -120, 60, -220, 10, -380); g.stroke();
  const clump = (cx, cy, r) => { for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(cx + (i - 3) * r * .38, cy + Math.sin(i * 1.7) * r * .12, r * .55, r * .13, Math.sin(i) * .15, 0, TAU); g.fill(); } };
  g.lineWidth = 6;
  [[-30, -150, 70, -110], [50, -200, 140, -180], [20, -270, -70, -250], [14, -340, 90, -340], [10, -380, -40, -400]].forEach(([x1, y1, x2, y2], i) => {
    g.beginPath(); g.moveTo(x1 * .4, y1 + 10); g.quadraticCurveTo((x1 + x2) / 2, y1 - 20, x2, y2); g.stroke(); clump(x2, y2 - 10, 78 - i * 6);
  });
  g.restore();
}

BG.init = function () {
  const mw = 1500;
  BG.far = ridgeSprite(mw, 900, 540, 360, 3.1, 260, '#35496e', '#101826', 1.5);
  BG.mid = ridgeSprite(mw, 800, 470, 300, 9.7, 210, '#22344f', '#0b111c', 0.6, (g, yAt) => pagoda(g, 1130, yAt(1130) + 8, 1.0, '#0b1220'));
  BG.near = ridgeSprite(mw, 700, 420, 190, 21.3, 180, '#101725', '#05070c', 0, (g, yAt) => { pine(g, 150, yAt(150) + 20, 1.05, 1, '#04060a'); pine(g, 1320, yAt(1320) + 20, 1.0, -1, '#04060a'); });
  // moon
  const m = mk(520, 520), g = m.getContext('2d'); const gr = g.createRadialGradient(240, 230, 10, 260, 260, 210);
  gr.addColorStop(0, '#fffaf0'); gr.addColorStop(.7, '#f6ead0'); gr.addColorStop(1, '#e2cfa0');
  g.fillStyle = gr; g.beginPath(); g.arc(260, 260, 210, 0, TAU); g.fill();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(150,120,70,${.05 + .08 * hash(i)})`; g.beginPath(); g.arc(150 + hash(i * 3) * 220, 130 + hash(i * 7) * 260, 20 + hash(i * 11) * 50, 0, TAU); g.fill(); }
  BG.moon = m;
  // mist
  BG.mist = [0, 1].map(k => { const c = mk(1700, 420), cg = c.getContext('2d'); cg.filter = 'blur(38px)'; for (let i = 0; i < 26; i++) { cg.fillStyle = `rgba(190,205,230,${.07 + .1 * hash(i + k * 50)})`; cg.beginPath(); cg.ellipse(hash(i * 3 + k) * 1700, 140 + hash(i * 5 + k) * 160, 120 + hash(i * 7 + k) * 220, 26 + hash(i * 9) * 40, 0, 0, TAU); cg.fill(); } return c; });
  // grain
  BG.grain = [0, 1, 2].map(k => { const c = mk(360, 640), cg = c.getContext('2d'), id = cg.createImageData(360, 640); for (let i = 0; i < id.data.length; i += 4) { const v = 96 + Math.floor(hash(i * .37 + k * 1000) * 120); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } cg.putImageData(id, 0, 0); return c; });
  // vignette
  const v = mk(W, H), vg = v.getContext('2d'); const vr = vg.createRadialGradient(W / 2, H / 2, 380, W / 2, H / 2, 1250);
  vr.addColorStop(0, 'rgba(0,0,0,0)'); vr.addColorStop(.6, 'rgba(0,0,0,.35)'); vr.addColorStop(1, 'rgba(0,0,0,.92)'); vg.fillStyle = vr; vg.fillRect(0, 0, W, H); BG.vig = v;
  // bagua rings
  const mkRing = (inner) => {
    const c = mk(1040, 1040), r = c.getContext('2d'); r.translate(520, 520); r.strokeStyle = '#f6d57e'; r.fillStyle = '#f6d57e'; r.shadowColor = 'rgba(255,190,80,.8)'; r.shadowBlur = 10;
    if (!inner) {
      [500, 488].forEach((R, i) => { r.lineWidth = i ? 1.5 : 4; r.beginPath(); r.arc(0, 0, R, 0, TAU); r.stroke(); });
      for (let i = 0; i < 96; i++) { const a = i / 96 * TAU, l = i % 4 === 0 ? 30 : 14; r.lineWidth = i % 4 === 0 ? 3 : 1.5; r.beginPath(); r.moveTo(Math.cos(a) * 486, Math.sin(a) * 486); r.lineTo(Math.cos(a) * (486 - l), Math.sin(a) * (486 - l)); r.stroke(); }
      r.lineWidth = 2; r.beginPath(); r.arc(0, 0, 440, 0, TAU); r.stroke();
    } else {
      [420, 300].forEach((R, i) => { r.lineWidth = i ? 4 : 2; r.beginPath(); r.arc(0, 0, R, 0, TAU); r.stroke(); });
      const tri = [[1, 1, 1], [0, 1, 1], [1, 0, 1], [0, 0, 1], [1, 1, 0], [0, 1, 0], [1, 0, 0], [0, 0, 0]];
      tri.forEach((lines, k) => {
        const c0 = k * TAU / 8 - Math.PI / 2;
        lines.forEach((solid, j) => {
          const R = 328 + j * 36, half = .17; r.lineWidth = 15; r.lineCap = 'butt';
          if (solid) { r.beginPath(); r.arc(0, 0, R, c0 - half, c0 + half); r.stroke(); }
          else { r.beginPath(); r.arc(0, 0, R, c0 - half, c0 - .035); r.stroke(); r.beginPath(); r.arc(0, 0, R, c0 + .035, c0 + half); r.stroke(); }
        });
      });
      for (let k = 0; k < 8; k++) { const a = (k + .5) * TAU / 8 - Math.PI / 2; r.beginPath(); r.arc(Math.cos(a) * 360, Math.sin(a) * 360, 5, 0, TAU); r.fill(); }
    }
    return c;
  };
  BG.ringA = mkRing(false); BG.ringB = mkRing(true);
  // brush strokes
  BG.brush = {
    cream: brushSprite(1100, 220, 1.3, '#efe3c8'), gold: brushSprite(1100, 220, 2.7, '#e2b350'),
    red: brushSprite(1100, 220, 4.1, '#c8321e'), ink: brushSprite(1400, 320, 5.3, '#050608'),
  };
};

function brushSprite(w, h, seed, col) {
  const c = mk(w, h), g = c.getContext('2d'), cy = h / 2; g.fillStyle = col;
  const top = [], bot = [];
  for (let x = 0; x <= w; x += 4) {
    const s = x / w, prof = Math.min(1, s * 14) * (1 - Math.pow(s, 7)) * (.62 + .38 * fbm(s * 7 + seed));
    const wob = (fbm(s * 2.5 + seed * 2) - .5) * h * .22, th = h * .43 * prof;
    top.push([x, cy + wob - th]); bot.push([x, cy + wob + th * (.85 + .15 * hash(x + seed))]);
  }
  g.beginPath(); top.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); bot.reverse().forEach(([x, y]) => g.lineTo(x, y)); g.closePath(); g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 34; i++) {
    const y = cy + (hash(i * 3 + seed) - .5) * h * .9, s0 = .25 + .7 * hash(i * 7 + seed), lw = 1 + hash(i * 5) * 4;
    g.globalAlpha = .5 + .5 * hash(i * 9); g.lineWidth = lw; g.beginPath(); g.moveTo(w * s0, y); g.lineTo(w * 1.02, y + (hash(i) - .5) * 14); g.stroke();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = col;
  for (let i = 0; i < 40; i++) { const x = w * (.9 + .12 * hash(i * 2 + seed)), y = cy + (hash(i * 3.3) - .5) * h * .8; g.globalAlpha = .3 + .5 * hash(i); g.beginPath(); g.arc(Math.min(w - 2, x), y, 1 + hash(i * 6) * 3, 0, TAU); g.fill(); }
  g.globalAlpha = 1; return { c, w, h, cx: 0, cy: h / 2 };
}
function drawBrush(g, sp, x, y, p, o = {}) { // reveal left->right
  if (p <= 0) return; g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot); g.scale(o.sx ?? 1, o.sy ?? 1); g.globalAlpha *= o.a ?? 1;
  g.beginPath(); g.rect(0, -sp.h, sp.w * p, sp.h * 2); g.clip(); g.drawImage(sp.c, 0, -sp.cy); g.restore();
}

function drawRing(g, t, x, y, s, a, o = {}) {
  const step = 1.0, k = Math.floor(t / step), fr = (t - k * step), ang = (k + E.outExpo(clamp(fr / .4))) * 15 * Math.PI / 180;
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= a; g.globalCompositeOperation = 'lighter';
  const pulse = 1 + .018 * kickPulse(t);
  g.save(); g.rotate(ang * .5); g.scale(pulse, pulse); g.drawImage(BG.ringA, -520, -520); g.restore();
  g.save(); g.rotate(-ang); g.scale(pulse, pulse); g.drawImage(BG.ringB, -520, -520); g.restore();
  g.restore();
}

function drawBG(g, t, o = {}) {
  const tn = tintAt(t), pulse = kickPulse(t), my = o.moonY ?? 520;
  // sky
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, rgb(tn.top)); sky.addColorStop(.55, rgb(tn.mid)); sky.addColorStop(1, '#030407');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // moon glow + disc
  const ms = (o.moonS ?? 1) * (1 + .03 * pulse) * (1 + .02 * Math.sin(t * .8));
  const mg = g.createRadialGradient(540, my, 40, 540, my, 820); mg.addColorStop(0, rgb(tn.glow, .5 + .22 * pulse)); mg.addColorStop(.4, rgb(tn.glow, .12)); mg.addColorStop(1, rgb(tn.glow, 0));
  g.fillStyle = mg; g.fillRect(0, 0, W, H);
  g.save(); g.globalAlpha = o.moonA ?? .92; g.translate(540, my); g.scale(ms, ms); g.drawImage(BG.moon, -260, -260); g.restore();
  // stars
  g.save(); g.fillStyle = '#fff'; for (let i = 0; i < 46; i++) { const x = hash(i * 3.1) * W, y = hash(i * 5.3) * 760, tw = .35 + .65 * Math.abs(Math.sin(t * (.8 + hash(i)) + i)); g.globalAlpha = .55 * tw * (1 - y / 900); g.fillRect(x, y, 2, 2); } g.restore();
  // mountains (parallax drift)
  const dr = (k, sp) => -210 + Math.sin(t * .05 + k) * 40 - t * sp;
  g.drawImage(BG.far, dr(0, 2.5), 760);
  g.save(); g.globalAlpha = .38 + .12 * Math.sin(t * .4); g.drawImage(BG.mist[0], -300 + (t * 14) % 600, 1090); g.restore();
  g.drawImage(BG.mid, dr(1, 4.5), 1060);
  g.save(); g.globalAlpha = .3; g.drawImage(BG.mist[1], -500 - (t * 18) % 600 + 300, 1380); g.restore();
  g.drawImage(BG.near, dr(2, 7), 1290);
  // warm glow rising from horizon on beats
  const hg = g.createLinearGradient(0, 1500, 0, H); hg.addColorStop(0, rgb(tn.glow, 0)); hg.addColorStop(1, rgb(tn.glow, .12 + .16 * pulse));
  g.fillStyle = hg; g.fillRect(0, 1500, W, H - 1500);
  drawDust(g, t);
}
function drawDust(g, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 64; i++) {
    const sp = 10 + 26 * hash(i * 2.2), x = (hash(i * 3.3) * W + Math.sin(t * .6 + i) * 34 + 2 * t * hash(i)) % W, y = ((hash(i * 5.5) * H - t * sp) % H + H) % H;
    const tw = .45 + .55 * Math.abs(Math.sin(t * (1 + hash(i)) + i * 2)), r = 1 + 2.4 * hash(i * 7);
    g.fillStyle = `rgba(255,214,140,${.55 * tw})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  g.restore();
}
function drawPetals(g, t, a = 1) {
  g.save();
  for (let i = 0; i < 24; i++) {
    const sp = 60 + 70 * hash(i), x = (((hash(i * 3.7) * (W + 300) + t * (50 + 40 * hash(i * 2))) % (W + 300)) - 150), y = (((hash(i * 5.1) * (H + 200) + t * sp) % (H + 200)) - 100) + Math.sin(t * 1.4 + i) * 30;
    const rot = t * (1 + hash(i)) + i, flip = Math.abs(Math.cos(t * 2 + i)), sz = 11 + 12 * hash(i * 9);
    g.globalAlpha = a * (.45 + .4 * hash(i * 4)); g.fillStyle = hash(i * 8) > .5 ? '#d9452f' : '#f2a28f';
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, .35 + .65 * flip); g.beginPath(); g.moveTo(0, -sz); g.quadraticCurveTo(sz * .9, -sz * .2, 0, sz); g.quadraticCurveTo(-sz * .9, -sz * .2, 0, -sz); g.fill(); g.restore();
  }
  g.restore();
}
function drawGrain(g, t, a = .11) {
  const f = Math.floor(t * FPS); g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = a;
  const tile = BG.grain[f % 3], ox = (hash(f * 1.3) * 70) | 0, oy = (hash(f * 2.9) * 120) | 0;
  g.translate(-ox, -oy); g.scale(3.2, 3.2); g.drawImage(tile, 0, 0); g.restore();
}
