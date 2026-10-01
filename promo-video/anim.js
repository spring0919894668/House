/* ===========================================================
   anim.js – scenes, transitions, camera, compositing
   renderFrame(n) is a pure function of time -> frame-exact export
   =========================================================== */
const SC = [0, 4, 8, 12, 15, 20, 25, 30], TD = .42;
const TRANS_ANG = [0, -24, 98, -9, 33, -62, 14];           // sword-cut angle per transition (deg)
const BGP = [                                              // per-scene backdrop parameters
  { moonY: 560 }, { moonY: 800, moonS: 1.15 }, { moonY: 560, moonS: .95 }, { moonY: 820, moonS: 1.1 },
  { moonY: 980, moonS: 1.2, moonA: .75 }, { moonY: 700, moonS: 1.2 }, { moonY: 700, moonS: 1.35 },
];
const L = {};
const gold2 = ['#fff0b8', '#d9a441', '#8a5a14'];

function goldGrad(g, x0, y0, x1, y1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, gold2[0]); gr.addColorStop(.45, gold2[1]); gr.addColorStop(.75, gold2[2]); gr.addColorStop(1, gold2[1]); return gr; }
const wipeIn = (u, d = .2) => clamp(u / d);

/* ---------- reusable components ---------- */
function plate(g, x, y, w, h, p, o = {}) {
  g.save(); g.translate(x - w / 2, y - h / 2); const r = o.r ?? 16;
  g.globalAlpha *= clamp(p * 2.5) * (o.a ?? 1);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, o.c0 ?? 'rgba(24,28,42,.86)'); gr.addColorStop(1, o.c1 ?? 'rgba(8,10,16,.9)');
  g.fillStyle = gr; g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill();
  const per = 2 * (w + h); g.setLineDash([per * clamp(p), per * 2]); g.lineWidth = o.lw ?? 3.5; g.strokeStyle = goldGrad(g, 0, 0, w, h);
  g.shadowColor = 'rgba(255,190,80,.6)'; g.shadowBlur = 10; g.beginPath(); g.roundRect(0, 0, w, h, r); g.stroke();
  g.shadowBlur = 0; g.setLineDash([]);
  if (p >= 1) { g.strokeStyle = 'rgba(246,213,126,.8)'; g.lineWidth = 2; const k = 16, m = 10; // inner corner brackets
    [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]].forEach(([cx, cy, sx, sy]) => { g.beginPath(); g.moveTo(cx, cy + sy * k); g.lineTo(cx, cy); g.lineTo(cx + sx * k, cy); g.stroke(); }); }
  g.restore();
}
function halfPoly(g, cx, cy, ang, side, L2 = 3200) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy * side, ny = dx * side;
  g.beginPath(); g.moveTo(cx - dx * L2, cy - dy * L2); g.lineTo(cx + dx * L2, cy + dy * L2); g.lineTo(cx + dx * L2 + nx * L2, cy + dy * L2 + ny * L2); g.lineTo(cx - dx * L2 + nx * L2, cy - dy * L2 + ny * L2); g.closePath();
}
function sword(g, x, y, ang, len, a = 1) {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha *= a; const w = len * .034;
  const bg = g.createLinearGradient(0, -w, 0, w); bg.addColorStop(0, '#ffffff'); bg.addColorStop(.5, '#9fb3d0'); bg.addColorStop(1, '#eef4ff');
  g.shadowColor = 'rgba(180,220,255,.9)'; g.shadowBlur = 24; g.fillStyle = bg;
  g.beginPath(); g.moveTo(0, -w); g.lineTo(len * .93, -w * .7); g.lineTo(len, 0); g.lineTo(len * .93, w * .7); g.lineTo(0, w); g.closePath(); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, 0); g.lineTo(len * .96, 0); g.stroke();
  const gg = goldGrad(g, 0, -w * 3, 0, w * 3); g.fillStyle = gg; g.beginPath(); g.roundRect(-16, -w * 3.4, 20, w * 6.8, 7); g.fill();
  g.fillStyle = '#1a120e'; g.fillRect(-len * .2, -w * .65, len * .2 - 16, w * 1.3);
  g.strokeStyle = gold2[1]; g.lineWidth = 3; for (let i = 0; i < 7; i++) { const xx = -len * .2 + 8 + i * (len * .2 - 28) / 6; g.beginPath(); g.moveTo(xx, -w * .65); g.lineTo(xx + 8, w * .65); g.stroke(); }
  g.fillStyle = gg; g.beginPath(); g.arc(-len * .2 - 8, 0, w * 1.0, 0, TAU); g.fill();
  g.fillStyle = '#c9331f'; g.beginPath(); g.moveTo(-len * .2 - 14, 0); g.quadraticCurveTo(-len * .3, w * 3, -len * .38, w * 7); g.lineTo(-len * .4, w * 6); g.quadraticCurveTo(-len * .32, w * 2, -len * .2 - 14, 0); g.fill();
  g.restore();
}
function wipeLine(g, line, cx, cy, t, t0, o = {}) {
  const per = o.per ?? .035, rise = o.rise ?? 18;
  line.items.forEach((it, i) => {
    const u = t - (t0 + i * per); if (u < 0) return; const a = clamp(u / .1) * (o.alpha ?? 1);
    drawSprite(g, it.sp, cx + it.x, cy + rise * (1 - E.outCubic(clamp(u / .22))), 1, 1, 0, a);
  });
}
function clockIcon(g, x, y, s, p, t) {
  drawIcon(g, 'clock', x, y, s, clamp(p * 1.6), { lw: 5, glow: 'rgba(255,190,80,1)', color: '#f6d57e' });
  if (p < .6) return; const q = E.outElastic(clamp((p - .6) / .4)), c = s / 100;
  g.save(); g.translate(x - s / 2 + 50 * c, y - s / 2 + 50 * c); g.strokeStyle = '#fff3cf'; g.lineCap = 'round';
  g.lineWidth = 5.5 * c; g.save(); g.rotate(lerp(-2, (9.5 / 12) * TAU - Math.PI / 2 + Math.PI * .0, q)); g.beginPath(); g.moveTo(0, 0); g.lineTo(26 * c, 0); g.stroke(); g.restore();
  g.lineWidth = 4 * c; g.save(); g.rotate(lerp(1, (30 / 60) * TAU - Math.PI / 2, q)); g.beginPath(); g.moveTo(0, 0); g.lineTo(36 * c, 0); g.stroke(); g.restore();
  g.fillStyle = '#fff3cf'; g.beginPath(); g.arc(0, 0, 4 * c, 0, TAU); g.fill(); g.restore();
}

/* ---------- build sprites once ---------- */
function build() {
  L.h1 = lineSprites('同一個市場，', 112, 'cream', 'serif', 8);
  L.h2 = lineSprites('為什麼有人停滯，', 100, 'dim', 'serif', 6);
  [5, 6].forEach(i => L.h2.items[i].sp = textSprite(L.h2.items[i].ch, 100, 'ice', 'serif'));
  L.h3a = lineSprites('有人卻', 118, 'cream', 'serif', 10);
  L.h3b = lineSprites('逆勢突破？', 184, 'fire', 'brush', -6);
  L.y = lineSprites('2026', 340, 'gold', 'serif', -8);
  L.ttl = lineSprites('房仲逆風成交', 150, 'white', 'serif', 10, { sw: 7 });
  L.sub = textSprite('升級實戰診斷會', 112, 'gold', 'serif', { glowB: 28 });
  L.tag1 = lineSprites('馬先右 × 相信學苑', 50, 'gold', 'serif6', 8);
  L.tag2 = lineSprites('相信地產加盟主專場', 54, 'cream', 'serif6', 10);
  L.hook_tag = lineSprites('馬先右 × 相信學苑　|　相信地產加盟主專場', 33, 'gold', 'serif6', 3);
  L.name = lineSprites('馬先右', 176, 'gold', 'brush', 14);
  L.role = lineSprites('房仲金牌教練', 58, 'cream', 'serif6', 16);
  L.q1 = lineSprites('我不只告訴你別人怎麼成交，', 56, 'cream', 'serif6', 5);
  L.q2a = lineSprites('我要陪你看懂：', 56, 'cream', 'serif6', 5);
  L.q2b = lineSprites('你自己卡在哪裡。', 110, 'gold', 'serif', 2);
  L.qm1 = textSprite('「', 150, 'gold', 'brush'); L.qm2 = textSprite('」', 150, 'gold', 'brush');
  L.shi = ['態度', '方法', '自己'].map(s => lineSprites(s, 210, 'gold', 'brush', 18));
  L.shiH = lineSprites('三大關鍵', 46, 'cream', 'serif6', 18);
  L.times = textSprite('×', 100, 'gold', 'serif');
  L.tg1 = lineSprites('改變一個關鍵，', 64, 'cream', 'serif6', 6);
  L.tg2a = lineSprites('成交就可能開始', 64, 'cream', 'serif6', 6);
  L.tg2b = lineSprites('鬆動', 92, 'fire', 'serif', 6);
  L.cardH = lineSprites('四大實戰招式', 92, 'gold', 'serif', 16);
  L.cards = [
    ['壹', 'doc', '真實成交案例', '看別人怎麼從卡關走到突破'],
    ['貳', 'people', '成交現場拆解', '還原問題、對話與決策'],
    ['參', 'magnifier', '個人成交健檢', '找出你現在最卡的一關'],
    ['肆', 'chart', '30天行動方向', '知道回去第一步要做什麼'],
  ].map(([n, ic, ti, su]) => ({ n, ic, ti: textSprite(ti, 74, 'cream', 'serif'), tiG: textSprite(ti, 74, 'gold', 'serif'), su: textSprite(su, 40, 'dim', 'sans', { sw: 0, glowB: 0 }), seal: sealSprite(n, 92) }));
  L.close = lineSprites('從卡關走到突破', 112, 'fire', 'brush', -2);
  L.of1 = lineSprites('現場將公開', 76, 'cream', 'serif6', 12);
  L.of2 = lineSprites('加盟主獨家優惠', 132, 'gold', 'serif', 0, { glowB: 30 });
  L.of3 = lineSprites('敬請務必參與！', 90, 'fire', 'serif', 8);
  L.date = lineSprites('10/8', 310, 'gold', 'serif', -4);
  L.time = lineSprites('上午 09:30–12:00', 92, 'cream', 'serif', 2);
  L.tagTime = lineSprites('時間', 44, 'gold', 'serif6', 16); L.tagPlace = lineSprites('地點', 44, 'gold', 'serif6', 16);
  L.place = lineSprites('相信學苑', 138, 'gold', 'serif', 8);
  L.addr = textSprite('台中市西屯區河南路二段1號2樓', 46, 'cream', 'sans', { sw: 0, glowB: 0 });
  L.sealWeek = sealSprite('週四', 150); L.sealLimit = sealSprite('金牌', 120); L.sealBrand = sealSprite('相信', 120); L.sealWind = sealSprite('逆風', 112);
  L.fin1 = lineSprites('名額有限', 236, 'gold', 'serif', 4, { glowB: 40 });
  L.btn = lineSprites('立即報名，掌握先機！', 68, 'ink', 'serif', 4);
  L.fl1 = lineSprites('帶著你的問題來，', 66, 'cream', 'serif6', 6);
  L.fl2a = lineSprites('不要只帶著', 66, 'cream', 'serif6', 6);
  L.fl2b = lineSprites('筆記本', 66, 'gold', 'serif', 6);
  L.fl2c = lineSprites('回去。', 66, 'cream', 'serif6', 6);
  L.brand = lineSprites('馬先右 × 相信學苑', 78, 'gold', 'serif', 10);
  L.brand2 = lineSprites('相信地產加盟主專場', 48, 'cream', 'serif6', 14);
  L.info1 = textSprite('10/8（四）上午 09:30–12:00', 38, 'cream', 'sans', { sw: 0, glowB: 0 });
  L.info2 = textSprite('相信學苑｜台中市西屯區河南路二段1號2樓', 34, 'dim', 'sans', { sw: 0, glowB: 0 });
}

/* ================= SCENES ================= */
function S0(g, t) { // hook
  const T = C;
  const bu = clamp((t - 3) / 1); const grow = 1 + .07 * E.inCubic(bu);
  // converging speed lines (build)
  if (t > 3) { g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; for (let i = 0; i < 46; i++) { const a = hash(i * 4.1) * TAU, r = 1000 - 620 * E.inCubic(bu) * (.6 + .4 * hash(i)), len = 120 + 260 * bu; g.strokeStyle = `rgba(255,214,150,${.5 * bu * (.2 + hash(i * 3))})`; g.lineWidth = 1.5 + 3 * hash(i * 7); g.beginPath(); g.moveTo(540 + Math.cos(a) * r, 960 + Math.sin(a) * r * 1.3); g.lineTo(540 + Math.cos(a) * (r + len), 960 + Math.sin(a) * (r + len) * 1.3); g.stroke(); } g.restore(); }
  // brand strip at top
  const ta = prog(t, .45, .5);
  if (ta > 0) { g.save(); g.globalAlpha = ta; wipeLine(g, L.hook_tag, 540, 150, t, .45, { per: .018, rise: 8 }); g.strokeStyle = 'rgba(246,213,126,.6)'; g.lineWidth = 2; const lw = 480 * ta; g.beginPath(); g.moveTo(540 - lw, 196); g.lineTo(540 + lw, 196); g.stroke(); g.restore(); }
  g.save(); g.translate(540, 960); g.scale(grow, grow); g.translate(-540, -960);
  // line 1
  ring(g, 540, 700, t, T.hook1, { R: 650, w: 18 }); sparks(g, 540, 700, t, T.hook1, { n: 30, seed: 2 }); splat(g, 540, 700, t, T.hook1, { seed: 4, n: 18 });
  slamLine(g, L.h1, 540, 700, t, T.hook1, { s0: 2.6, stagger: .05 });
  // line 2 – stagnant, cold, sinking
  ring(g, 540, 880, t, T.hook2, { R: 560, w: 12, color: 'rgba(170,210,255,1)' }); sparks(g, 540, 880, t, T.hook2, { n: 18, seed: 5, color: '170,210,255', speed: 520 });
  slamLine(g, L.h2, 540, 880, t, T.hook2, { s0: 2.1, stagger: .045, sink: (u, i) => Math.min(16, u * 6), dx: (u, i) => (i >= 5 && i <= 6 ? Math.sin(u * 62) * 2.6 * Math.exp(-u * 1.2) : 0) });
  // line 3 – the breakthrough
  const u3 = t - T.hook3;
  slamLine(g, L.h3a, 540, 1075, t, T.hook3, { s0: 2.2, stagger: .06 });
  const cutOff = 16 * decay(t, T.hook3 + .1, .35), sang = Math.atan2(380, -1400);
  g.save();
  for (const side of [-1, 1]) {
    g.save(); halfPoly(g, 640, 1250, sang, side); g.clip(); g.translate(Math.cos(sang + Math.PI / 2) * side * cutOff, Math.sin(sang + Math.PI / 2) * side * cutOff);
    slamLine(g, L.h3b, 540, 1270, t, T.hook3 + .06, { s0: 2.8, stagger: .055, rot: .3 }); g.restore();
  }
  g.restore();
  ring(g, 540, 1200, t, T.hook3, { R: 760, w: 26, color: 'rgba(255,120,70,1)' }); sparks(g, 540, 1250, t, T.hook3, { n: 44, seed: 9, color: '255,160,80', speed: 1000, size: 7 });
  g.restore();
  // sword + slash (hook3)
  if (u3 > -.02 && u3 < .5) {
    const sx = 1260, sy = 1010, ex = -160, ey = 1400, p = E.outCubic(clamp(u3 / .2)), px = lerp(sx, ex, p), py = lerp(sy, ey, p);
    const ang = Math.atan2(ey - sy, ex - sx);
    slashLine(g, sx, sy, ex, ey, t, T.hook3, { w: 44, dur: .4 });
    if (u3 < .3) sword(g, px - Math.cos(ang) * 470, py - Math.sin(ang) * 470, ang, 470, 1 - clamp((u3 - .18) / .12));
  }
  flash(g, t, T.hook1, .7, .12, '230,240,255'); flash(g, t, T.hook3, .5, .08);
}

function S1(g, t) { // title
  const T = C, u0 = t - T.title;
  drawRing(g, t, 540, 800, 1.05 * (.6 + .4 * prog(t, T.title, .7, E.outBack)), .5 * prog(t, T.title, .5));
  ring(g, 540, 470, t, T.title, { R: 900, w: 30 }); ring(g, 540, 470, t, T.title + .08, { R: 620, w: 12, color: 'rgba(255,255,255,1)' });
  sparks(g, 540, 470, t, T.title, { n: 60, seed: 11, speed: 1300, size: 7 }); speedLines(g, 540, 470, t, T.title, .5, { n: 46 });
  slamLine(g, L.y, 540, 470, t, T.title, { s0: 3.3, stagger: .06, rot: .14, dy: -160 });
  if (t > T.title + .6) { const ph = (t - T.title - .6) % 2.4 / 1.1; for (const it of L.y.items) glint(g, it.sp, 540 + it.x, 470, ph, 1, 0, .8); }
  // 房仲逆風成交 – one glyph per 8th note
  L.ttl.items.forEach((it, i) => {
    const t0 = T.char0 + .25 * i;
    ring(g, 540 + it.x, 805, t, t0, { R: 260, w: 10, dur: .4 }); sparks(g, 540 + it.x, 805, t, t0, { n: 12, seed: 20 + i, speed: 520, life: .5, size: 4 });
    slamItem(g, it, 540 + it.x, 805, t, t0, { s0: 2.5, rot: .3, dy: -120, i });
  });
  // 升級實戰診斷會 – sword-cut reveal
  const us = t - T.sub;
  if (us >= 0) {
    const off = 760 * (1 - E.outExpo(clamp(us / .3))), y = 1005, a = clamp(us / .03);
    for (const side of [-1, 1]) { g.save(); g.beginPath(); g.rect(-100, side < 0 ? y - 140 : y, W + 200, 140); g.clip(); drawSprite(g, L.sub, 540 + side * off, y, 1, 1, 0, a); g.restore(); }
    slashLine(g, -120, y, 1200, y, t, T.sub, { w: 34, dur: .45 }); sparks(g, 540, y, t, T.sub, { n: 30, seed: 31, speed: 1000, ang: 0, grav: 100 });
    if (us > .6) glint(g, L.sub, 540, y, ((us - .6) % 2.2) / 1.0, 1, 0, .9);
    const st = prog(t, T.sub + .1, .3, E.outBack); // seal stamp
    if (st > 0) { const k = 1 + (1 - st) * 1.8; drawSprite(g, L.sealWind, 918, 1130, k * .8, k * .8, .09, clamp(st * 2)); ring(g, 918, 1130, t, T.sub + .22, { R: 150, w: 8, dur: .35, color: 'rgba(255,100,70,1)' }); }
  }
  // tag ribbon (4 beats of ka)
  const tp = prog(t, T.tag, .35);
  if (tp > 0) {
    plate(g, 540, 1260, 900, 190, tp);
    const lw = 360 * prog(t, T.tag + .1, .4, E.outCubic);
    g.save(); g.strokeStyle = 'rgba(246,213,126,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(540 - lw, 1260); g.lineTo(540 + lw, 1260); g.stroke(); g.restore();
    wipeLine(g, L.tag1, 540, 1214, t, T.tag + .25, { per: .03, rise: 14 });
    wipeLine(g, L.tag2, 540, 1307, t, T.tag + .5, { per: .03, rise: 14 });
    if (t > T.tag + .75) glint(g, textSprite('相信地產加盟主專場', 54, 'cream', 'serif6'), 540, 1307, clamp((t - T.tag - .75) / .8), 1, 0, .7);
    ring(g, 540, 1260, t, T.tag + .75, { R: 560, w: 6, dur: .5, sy: .25 });
  }
  flash(g, t, T.title, .8, .1); flash(g, t, T.sub, .35, .06);
}

function S2(g, t) { // speaker
  const T = C, u0 = t - T.speaker, cx = 540, top = 175, aw = 270, ah = 800, hy = top + aw;
  drawRing(g, t, 540, 575, 1.0, .5 * prog(t, T.speaker, .6));
  const open = prog(t, T.speaker + .05, .65, E.outExpo);
  const archPath = () => { g.beginPath(); g.moveTo(cx - aw, top + ah); g.lineTo(cx - aw, hy); g.arc(cx, hy, aw, Math.PI, 0); g.lineTo(cx + aw, top + ah); g.closePath(); };
  if (u0 >= 0) {
    // glow behind arch
    g.save(); const gl = g.createRadialGradient(540, 575, 100, 540, 575, 520); gl.addColorStop(0, `rgba(255,205,120,${.35 + .2 * kickPulse(t)})`); gl.addColorStop(1, 'rgba(255,205,120,0)'); g.fillStyle = gl; g.fillRect(0, 0, W, 1200); g.restore();
    g.save(); archPath(); g.clip();
    g.fillStyle = '#0a0d14'; g.fillRect(0, 0, W, H);
    const kb = 1.0 + .06 * clamp(u0 / 4) + .02 * kickPulse(t) * 0, ps = .62 * kb, iw = 948 * ps, ih = 1704 * ps;
    g.drawImage(portrait, 540 - 430 * ps, 205 - 0 * ps, iw, ih);
    const iv = g.createLinearGradient(0, top, 0, top + ah); iv.addColorStop(0, 'rgba(8,10,16,.0)'); iv.addColorStop(.72, 'rgba(8,10,16,0)'); iv.addColorStop(1, 'rgba(8,10,16,.9)'); g.fillStyle = iv; g.fillRect(0, 0, W, H);
    // doors
    const dx = aw * open; g.fillStyle = '#10141e';
    g.fillRect(cx - aw - 2 - dx, top - 4, aw + 2, ah + 8); g.fillRect(cx + dx, top - 4, aw + 2, ah + 8);
    g.strokeStyle = goldGrad(g, 0, 0, 0, 800); g.lineWidth = 6; g.strokeRect(cx - aw - dx + 14, top + 24, aw - 28, ah - 48); g.strokeRect(cx + dx + 14, top + 24, aw - 28, ah - 48);
    g.restore();
    // light slit
    if (u0 < .9) { g.save(); archPath(); g.clip(); g.globalCompositeOperation = 'lighter'; const sw = 30 + 260 * open; const lg = g.createLinearGradient(cx - sw, 0, cx + sw, 0); lg.addColorStop(0, 'rgba(255,230,170,0)'); lg.addColorStop(.5, `rgba(255,236,190,${.85 * (1 - clamp(u0 / .9))})`); lg.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = lg; g.fillRect(cx - sw, top, sw * 2, ah); g.restore(); }
  }
  // frame
  const fp = prog(t, T.speaker, .5);
  g.save(); g.translate(0, 0); const per = (ah - aw) * 2 + Math.PI * aw; g.setLineDash([per * fp, per]); g.lineDashOffset = 0;
  g.lineWidth = 9; g.strokeStyle = goldGrad(g, 200, top, 880, top + ah); g.shadowColor = 'rgba(255,190,80,.8)'; g.shadowBlur = 18; g.save(); g.translate(cx, top + ah); g.beginPath(); g.moveTo(-aw, 0); g.lineTo(-aw, -(ah - aw)); g.arc(0, -(ah - aw), aw, Math.PI, 0); g.lineTo(aw, 0); g.stroke(); g.restore();
  g.setLineDash([]); g.shadowBlur = 0; g.lineWidth = 2.5; g.globalAlpha = .7 * fp; g.save(); g.translate(cx, top + ah + 22); g.beginPath(); g.moveTo(-aw - 22, 0); g.lineTo(-aw - 22, -(ah - aw) - 22); g.arc(0, -(ah - aw) - 22, aw + 22, Math.PI, 0); g.lineTo(aw + 22, 0); g.stroke(); g.restore(); g.restore();
  ring(g, 540, 575, t, T.speaker, { R: 760, w: 28 }); sparks(g, 540, 575, t, T.speaker, { n: 56, seed: 41, speed: 1200, size: 6 }); speedLines(g, 540, 575, t, T.speaker, .5, { n: 40, seed: 3 });
  // name (brush) + seal stamp
  L.name.items.forEach((it, i) => { ring(g, 540 + it.x, 1090, t, T.name + i * .06, { R: 240, w: 9, dur: .35 }); });
  slamLine(g, L.name, 540 - 40, 1095, t, T.name, { s0: 2.6, stagger: .07, rot: .2 });
  if (t > T.name + .6) glint(g, textSprite('馬先右', 176, 'gold', 'brush'), 500, 1095, ((t - T.name - .6) % 2.6) / 1.1, 1, 0, .8);
  const ss = t - (T.name + .2);
  if (ss >= 0) { const k = 1 + 1.9 * Math.max(0, spring(ss, 10, 20)), sh = prog(t, T.name + .2, .12); drawSprite(g, L.sealLimit, 880, 1085, k * .75, k * .75, -.08 + .2 * spring(ss, 8, 18), clamp(ss * 20)); ring(g, 880, 1085, t, T.name + .3, { R: 170, w: 8, dur: .4, color: 'rgba(255,100,70,1)' }); splat(g, 880, 1085, t, T.name + .25, { n: 12, seed: 5, R: 160, color: 'rgba(210,60,40,.9)' }); }
  const rp = prog(t, T.role, .5);
  if (rp > 0) { wipeLine(g, L.role, 540, 1207, t, T.role, { per: .04, rise: 16 }); const uw = 330 * E.outCubic(clamp((t - T.role - .15) / .45)); g.save(); g.strokeStyle = goldGrad(g, 200, 0, 880, 0); g.lineWidth = 3; g.beginPath(); g.moveTo(540 - uw, 1252); g.lineTo(540 + uw, 1252); g.stroke(); g.restore(); }
  // quote
  const qa = prog(t, T.quote1, .3);
  drawSprite(g, L.qm1, 96, 1330, 1 + (1 - qa) * .6, 1 + (1 - qa) * .6, 0, qa * .9);
  wipeLine(g, L.q1, 540, 1340, t, T.quote1, { per: .045, rise: 20 });
  wipeLine(g, L.q2a, 540, 1440, t, T.quote1 + .5, { per: .045, rise: 20 });
  L.q2a._x = 0;
  ring(g, 540, 1585, t, T.quote2, { R: 700, w: 20, color: 'rgba(255,200,110,1)', sy: .35 });
  const bu = prog(t, T.quote2 - .02, .5, E.outCubic); drawBrush(g, BG.brush.red, 80, 1625, bu, { sx: .95, sy: .5, a: .75 });
  slamLine(g, L.q2b, 540, 1585, t, T.quote2, { s0: 2.0, stagger: .05, rot: .15, dy: -80 });
  if (t > T.quote2 + .7) glint(g, textSprite('你自己卡在哪裡。', 110, 'gold', 'serif'), 540, 1585, ((t - T.quote2 - .7) % 2.2) / 1.0, 1, 0, .8);
  const qb = prog(t, T.quote2 + .3, .3); drawSprite(g, L.qm2, 990, 1640, 1 + (1 - qb) * .6, 1 + (1 - qb) * .6, 0, qb * .9);
  flash(g, t, T.speaker, .8, .12); flash(g, t, T.name, .25, .06); flash(g, t, T.quote2, .35, .07);
}

function S3(g, t) { // 態度 × 方法 × 自己
  const T = C, rows = [T.shi1, T.shi2, T.shi3], ys = [560, 840, 1120], icons = ['mountain', 'bulb', 'person'];
  drawRing(g, t, 540, 840, 1.15, .42);
  const hp = prog(t, T.shi1 - .05, .4);
  if (hp > 0) { wipeLine(g, L.shiH, 540, 300, t, T.shi1 - .05, { per: .05, rise: 14 }); g.save(); g.strokeStyle = 'rgba(246,213,126,.7)'; g.lineWidth = 2; const hw = 300 * E.outCubic(hp); g.beginPath(); g.moveTo(540 - hw - 140, 340); g.lineTo(540 + hw + 140 - 280 + 280, 340); g.stroke(); g.restore(); }
  rows.forEach((t0, i) => {
    const u = t - t0; if (u < 0) return; const dir = i % 2 ? 1 : -1;
    const p = E.outExpo(clamp(u / .35)), pb = E.outBack(clamp(u / .45), 1.4), xo = dir * (1 - p) * 900;
    g.save(); g.translate(xo, 0); plate(g, 540, ys[i], 920, 230, clamp(u / .4)); g.restore();
    if (xo > -1 && u < .6) slashLine(g, dir < 0 ? -80 : 1160, ys[i] + 100, dir < 0 ? 1160 : -80, ys[i] - 100, t, t0, { w: 26, dur: .3 });
    // icon in gold ring
    const ip = clamp((u - .05) / .5), ix = 235;
    g.save(); g.translate(xo, 0); g.strokeStyle = 'rgba(246,213,126,.8)'; g.lineWidth = 3; g.beginPath(); g.arc(ix, ys[i], 82 * clamp(u / .2), 0, TAU); g.stroke(); g.restore();
    g.save(); g.translate(xo, 0); drawIcon(g, icons[i], ix, ys[i], 112, ip, { lw: 5, glow: 'rgba(255,190,80,1)', fill: '#f6d57e' }); g.restore();
    slamLine(g, L.shi[i], 640 + xo * .0, ys[i] + 4, t, t0 + .02, { s0: 2.4, stagger: .07, rot: .2, dy: -70 });
    ring(g, 640, ys[i], t, t0, { R: 520, w: 16, sy: .4 }); sparks(g, 640, ys[i], t, t0, { n: 22, seed: 60 + i, speed: 800 });
    if (u > .5) glint(g, textSprite(['態度', '方法', '自己'][i], 210, 'gold', 'brush'), 640 + (i === 0 ? 0 : 0) + 0, ys[i] + 4, ((u - .5) % 2.4) / 1.0, 1, 0, .7);
    flash(g, t, t0, .3, .06);
  });
  [T.shi2 - .25, T.shi3 - .25].forEach((t0, i) => { const k = prog(t, t0, .35, E.outBack); if (k > 0) drawSprite(g, L.times, 540, [700, 980][i], k * 1.1, k * 1.1, (1 - k) * 1.5, k); });
  // tagline
  const u = t - T.tagline;
  if (u > -.05) {
    plate(g, 540, 1470, 900, 250, prog(t, T.tagline - .05, .4), { c0: 'rgba(40,10,10,.78)', c1: 'rgba(12,6,8,.86)' });
    wipeLine(g, L.tg1, 540, 1420, t, T.tagline + .05, { per: .045, rise: 20 });
    wipeLine(g, L.tg2a, 540 - 120, 1520, t, T.tagline + .45, { per: .04, rise: 20 });
    slamLine(g, L.tg2b, 540 + 332, 1516, t, T.tagline + .95, { s0: 2, stagger: .08, rot: .2, dy: -50 });
    ring(g, 540, 1470, t, T.tagline + .95, { R: 560, w: 12, sy: .3, color: 'rgba(255,100,60,1)' }); sparks(g, 870, 1516, t, T.tagline + .95, { n: 24, seed: 71, color: '255,130,70' });
  }
  flash(g, t, T.tagline + .95, .3, .06);
}

function S4(g, t) { // 四式 cards
  const T = C, cues = [T.card1, T.card2, T.card3, T.card4], ys = [590, 850, 1110, 1370];
  drawRing(g, t, 540, 960, 1.25, .35);
  const hp = t - T.card1;
  ring(g, 540, 300, t, T.card1, { R: 900, w: 24 }); sparks(g, 540, 300, t, T.card1, { n: 40, seed: 80, speed: 1100 });
  slamLine(g, L.cardH, 540, 300, t, T.card1, { s0: 2.4, stagger: .05, dy: -90 });
  if (hp > .7) glint(g, textSprite('四大實戰招式', 92, 'gold', 'serif'), 540, 300, ((hp - .7) % 2.4) / 1.0, 1, 0, .8);
  const lp = prog(t, T.card1 + .2, .5); g.save(); g.strokeStyle = 'rgba(246,213,126,.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(540 - 440 * lp, 385); g.lineTo(540 + 440 * lp, 385); g.stroke(); g.restore();
  cues.forEach((t0, i) => {
    const u = t - t0; if (u < 0) return; const dir = i % 2 ? 1 : -1, c = L.cards[i];
    const p = E.outExpo(clamp(u / .4)), xo = dir * (1 - p) * 1200, rot = dir * (1 - p) * .12, py = ys[i];
    const sq = 1 + .035 * kickPulse(t) * 0;
    g.save(); g.translate(540 + xo, py); g.rotate(rot); g.translate(-540, -py);
    plate(g, 540, py, 940, 224, clamp(u / .45), { c0: i % 2 ? 'rgba(30,24,16,.88)' : 'rgba(18,24,40,.88)' });
    // glowing edge flash on landing
    drawIcon(g, c.ic, 250, py, 108, clamp((u - .1) / .55), { lw: 5, glow: 'rgba(255,190,80,1)', fill: '#f6d57e' });
    g.strokeStyle = 'rgba(246,213,126,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(250, py, 78 * clamp(u / .3), 0, TAU); g.stroke();
    const tw = c.ti.tw, sx = 345;
    if (u > .12) { const a = clamp((u - .12) / .18), sl = prog(t, t0 + .12, .3); drawSprite(g, c.ti, sx + tw / 2 + (1 - sl) * 60, py - 36, 1, 1, 0, a); }
    if (u > .28) drawSprite(g, c.su, sx + c.su.tw / 2 + (1 - prog(t, t0 + .28, .35)) * 40, py + 48, 1, 1, 0, clamp((u - .28) / .25));
    if (u > .35) { const sk = prog(t, t0 + .1, .3, E.outBack); drawSprite(g, c.seal, 108, py - 70, .64 * sk, .64 * sk, -.1, sk); }
    g.restore();
    ring(g, 120, py, t, t0, { R: 380, w: 12, sy: .5 }); sparks(g, 540 + (dir < 0 ? -420 : 420), py, t, t0 + .05, { n: 20, seed: 90 + i, speed: 700 });
    flash(g, t, t0, .3, .06);
    // glint sweep over finished cards
    const gs = T.card4 + 1.0 + .15 * i; if (t > gs && t < gs + .5) { const ph = (t - gs) / .5; g.save(); g.beginPath(); g.roundRect(70, py - 112, 940, 224, 16); g.clip(); g.globalCompositeOperation = 'lighter'; const gx = lerp(-200, 1280, ph); const gr = g.createLinearGradient(gx - 120, py - 112, gx + 40, py + 112); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(.5, 'rgba(255,240,200,.42)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, py - 112, W, 224); g.restore(); }
  });
  // closing line at 19.0
  const uc = t - (T.card4 + 1.0);
  if (uc > -.01) { slamLine(g, L.close, 540, 1640, t, T.card4 + 1.0, { s0: 2.6, stagger: .06, rot: .3, dy: -80 }); ring(g, 540, 1640, t, T.card4 + 1.0, { R: 800, w: 22, sy: .4, color: 'rgba(255,120,70,1)' }); sparks(g, 540, 1640, t, T.card4 + 1.0, { n: 44, seed: 99, color: '255,150,80', speed: 1000, size: 6 }); flash(g, t, T.card4 + 1.0, .45, .08); }
}

function S5(g, t) { // offer + date + place
  const T = C, bu = clamp((t - T.build) / 1), pul = 1 + .018 * Math.sin(t * Math.PI * 4) * bu;
  drawRing(g, t, 540, 960, 1.35, .32);
  g.save(); g.translate(540, 960); g.scale(pul, pul); g.translate(-540, -960);
  // offer
  ring(g, 540, 480, t, T.offer, { R: 900, w: 26 }); sparks(g, 540, 480, t, T.offer, { n: 50, seed: 120, speed: 1200, size: 7 }); speedLines(g, 540, 460, t, T.offer, .5, { n: 40, seed: 5 });
  wipeLine(g, L.of1, 540, 330, t, T.offer, { per: .05, rise: 16 });
  slamLine(g, L.of2, 540, 490, t, T.offer + .02, { s0: 2.6, stagger: .045, rot: .25, dy: -90 });
  if (t > T.offer + .8) glint(g, textSprite('加盟主獨家優惠', 132, 'gold', 'serif', { glowB: 30 }), 540, 490, ((t - T.offer - .8) % 2.4) / 1.1, 1, 0, .85);
  const u1 = t - 21.0; // 敬請務必參與！
  if (u1 > -.01) { slashLine(g, 80, 700, 1000, 640, t, 21.0, { w: 20, dur: .3, glow: '255,110,70' }); slamLine(g, L.of3, 540, 660, t, 21.0, { s0: 2.2, stagger: .045, rot: .2, dy: -60 }); sparks(g, 540, 660, t, 21.0, { n: 24, seed: 131, color: '255,120,70' }); flash(g, t, 21.0, .3, .06); }
  // date
  const ud = t - T.date;
  if (ud > -.02) {
    const tp = prog(t, T.date, .3); wipeLine(g, L.tagTime, 150, 800, t, T.date + .1, { per: .06, rise: 10 });
    g.save(); g.strokeStyle = 'rgba(246,213,126,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(215, 800); g.lineTo(215 + 760 * E.outCubic(clamp(ud / .5)), 800); g.stroke(); g.restore();
    ring(g, 440, 960, t, T.date, { R: 820, w: 24 }); sparks(g, 440, 960, t, T.date, { n: 46, seed: 140, speed: 1100, size: 6 });
    slamLine(g, L.date, 440, 960, t, T.date, { s0: 2.8, stagger: .06, rot: .2, dy: -110 });
    if (ud > .7) glint(g, textSprite('10/8', 310, 'gold', 'serif'), 440 - 0, 960, ((ud - .7) % 2.4) / 1.0, 1, 0, .85);
    const ss = t - (T.date + .22);
    if (ss >= 0) { const k = 1 + 1.8 * Math.max(0, spring(ss, 10, 20)); drawSprite(g, L.sealWeek, 890, 940, k * .85, k * .85, .08 + .2 * spring(ss, 8, 18), clamp(ss * 20)); ring(g, 890, 940, t, T.date + .3, { R: 190, w: 8, dur: .4, color: 'rgba(255,100,70,1)' }); }
    const cp = prog(t, T.date + .3, .8, E.lin); clockIcon(g, 118, 1150, 96, cp, t);
    wipeLine(g, L.time, 600, 1150, t, T.date + .35, { per: .03, rise: 18 });
  }
  // place
  const up = t - T.place;
  if (up > -.02) {
    wipeLine(g, L.tagPlace, 150, 1325, t, T.place + .05, { per: .06, rise: 10 });
    g.save(); g.strokeStyle = 'rgba(246,213,126,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(215, 1325); g.lineTo(215 + 760 * E.outCubic(clamp(up / .5)), 1325); g.stroke(); g.restore();
    const drop = up < 0 ? 0 : Math.abs(Math.cos(Math.min(up, .6) / .6 * Math.PI * 1.5)) * Math.exp(-up * 5) * 200, k = prog(t, T.place, .15);
    g.save(); g.globalAlpha = k; drawIcon(g, 'pin', 160, 1480 - drop, 130, clamp(up / .35 + .2), { lw: 6, glow: 'rgba(255,190,80,1)', fill: '#f6d57e' }); g.restore();
    if (up > .2) ring(g, 160, 1520, t, T.place + .2, { R: 140, w: 6, dur: .5, sy: .35 });
    ring(g, 580, 1450, t, T.place, { R: 760, w: 22 }); sparks(g, 580, 1450, t, T.place, { n: 40, seed: 150, speed: 1000, size: 6 });
    slamLine(g, L.place, 590, 1450, t, T.place, { s0: 2.6, stagger: .06, rot: .22 });
    wipeLine(g, { items: [{ sp: L.addr, x: 0 }] }, 590, 1580, t, T.place + .4, { per: 0, rise: 16 });
  }
  g.restore();
  // build-up: edge vignette in red + shake handled by camera accent
  if (bu > 0) { g.save(); const rg = g.createRadialGradient(540, 960, 500, 540, 960, 1200); rg.addColorStop(0, 'rgba(255,60,30,0)'); rg.addColorStop(1, `rgba(255,60,30,${.28 * bu})`); g.fillStyle = rg; g.fillRect(0, 0, W, H); g.restore(); }
  flash(g, t, T.offer, .7, .1); flash(g, t, T.date, .3, .06); flash(g, t, T.place, .3, .06);
}

function S6(g, t) { // finale
  const T = C, pu = kickPulse(t);
  drawRing(g, t, 540, 700, 1.2, .5);
  // 名額有限
  ring(g, 540, 520, t, T.final, { R: 1000, w: 30 }); ring(g, 540, 520, t, T.final + .07, { R: 700, w: 14, color: 'rgba(255,255,255,1)' });
  sparks(g, 540, 520, t, T.final, { n: 70, seed: 160, speed: 1400, size: 8 }); speedLines(g, 540, 520, t, T.final, .55, { n: 50, seed: 8 });
  slamLine(g, L.fin1, 540, 520, t, T.final, { s0: 3.2, stagger: .06, rot: .18, dy: -160 });
  if (t > T.final + .7) glint(g, textSprite('名額有限', 236, 'gold', 'serif', { glowB: 40 }), 540, 520, ((t - T.final - .7) % 2.0) / 1.0, 1, 0, .9);
  slashLine(g, -100, 700, 1180, 640, t, T.final + .1, { w: 30, dur: .4 });
  // button
  const ub = t - T.button;
  if (ub >= 0) {
    const k = ub < 0 ? 0 : 1 + (-0.9) * Math.max(-.2, spring(ub, 8.5, 20)), sc = (1 - .9 * (1 - 1) + 0) * 0 + (1 - spring(ub, 8.5, 19)) , bs = Math.max(.001, sc) * (1 + .018 * pu);
    const bw = 900, bh = 168, by = 860;
    g.save(); g.translate(540, by); g.scale(bs, bs);
    g.shadowColor = 'rgba(255,190,80,.7)'; g.shadowBlur = 40 + 30 * pu; g.fillStyle = goldGrad(g, -bw / 2, -bh / 2, bw / 2, bh / 2);
    g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.fill(); g.shadowBlur = 0;
    g.lineWidth = 4; g.strokeStyle = 'rgba(255,248,220,.85)'; g.beginPath(); g.roundRect(-bw / 2 + 8, -bh / 2 + 8, bw - 16, bh - 16, (bh - 16) / 2); g.stroke();
    // shine sweep every two beats
    const sh = ((t - T.button - .4) % 2.0) / .6; if (t > T.button + .4 && sh < 1) { g.save(); g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.clip(); const gx = lerp(-bw / 2 - 150, bw / 2 + 150, sh); const gr = g.createLinearGradient(gx - 100, bh / 2, gx + 60, -bh / 2); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(-bw / 2, -bh / 2, bw, bh); g.restore(); }
    // label
    L.btn.items.forEach(it => drawSprite(g, it.sp, it.x - 28, 4, 1, 1, 0, 1));
    // chevron
    const ch = Math.sin(t * Math.PI * 4) * 6; g.strokeStyle = '#1a0f05'; g.lineWidth = 12; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(bw / 2 - 98 + ch, -26); g.lineTo(bw / 2 - 66 + ch, 0); g.lineTo(bw / 2 - 98 + ch, 26); g.stroke();
    g.restore();
    ring(g, 540, by, t, T.button, { R: 800, w: 16, sy: .35 }); sparks(g, 540, by, t, T.button, { n: 36, seed: 170, speed: 1100 }); flash(g, t, T.button, .3, .06);
  }
  // reminder
  const ul = t - T.line;
  if (ul > -.02) {
    wipeLine(g, L.fl1, 540, 1110, t, T.line, { per: .04, rise: 20 });
    const x0 = 540 - (L.fl2a.width + L.fl2b.width + L.fl2c.width + 18) / 2;
    wipeLine(g, L.fl2a, x0 + L.fl2a.width / 2, 1205, t, T.line + .25, { per: .035, rise: 20 });
    slamLine(g, L.fl2b, x0 + L.fl2a.width + 9 + L.fl2b.width / 2, 1205, t, T.line + .5, { s0: 2, stagger: .06, rot: .15, dy: -40 });
    wipeLine(g, L.fl2c, x0 + L.fl2a.width + L.fl2b.width + 18 + L.fl2c.width / 2, 1205, t, T.line + .65, { per: .035, rise: 20 });
    const bp = prog(t, T.line + .5, .5); drawBrush(g, BG.brush.gold, x0 + L.fl2a.width, 1250, bp, { sx: L.fl2b.width / 1100 * 1.05, sy: .22, a: .8 });
  }
  // lockup (gong)
  const uk = t - T.lockup;
  if (uk > -.02) {
    const lp = prog(t, T.lockup, .4);
    ring(g, 540, 1560, t, T.lockup, { R: 1100, w: 34 }); ring(g, 540, 1560, t, T.lockup + .06, { R: 760, w: 14, color: 'rgba(255,255,255,1)' });
    sparks(g, 540, 1500, t, T.lockup, { n: 90, seed: 180, speed: 1500, size: 8, life: 1.1 }); speedLines(g, 540, 1500, t, T.lockup, .6, { n: 60, seed: 12 });
    g.save(); g.globalAlpha = lp; plate(g, 540, 1560, 940, 300, lp, { c0: 'rgba(36,14,10,.84)', c1: 'rgba(10,6,8,.9)' }); g.restore();
    slamLine(g, L.brand, 540, 1478, t, T.lockup, { s0: 2.2, stagger: .045, rot: .15, dy: -60 });
    wipeLine(g, L.brand2, 540, 1556, t, T.lockup + .2, { per: .035, rise: 14 });
    g.save(); g.strokeStyle = 'rgba(246,213,126,.7)'; g.lineWidth = 2; const lw = 400 * prog(t, T.lockup + .3, .5); g.beginPath(); g.moveTo(540 - lw, 1596); g.lineTo(540 + lw, 1596); g.stroke(); g.restore();
    drawSprite(g, L.info1, 540, 1638, 1, 1, 0, prog(t, T.lockup + .5, .4)); drawSprite(g, L.info2, 540, 1690, 1, 1, 0, prog(t, T.lockup + .6, .4));
    if (uk > .6) glint(g, textSprite('馬先右', 78, 'gold', 'serif'), 540, 1478, 0, 1);
    const ss = t - (T.lockup + .3); if (ss >= 0) { const k = 1 + 1.6 * Math.max(0, spring(ss, 10, 20)); drawSprite(g, L.sealBrand, 940, 1420, k * .62, k * .62, .1, clamp(ss * 20)); }
    flash(g, t, T.lockup, .75, .13);
  }
  flash(g, t, T.final, .7, .1);
}
const SCENES = [S0, S1, S2, S3, S4, S5, S6];

/* ================= camera / compositing ================= */
function camera(g, t, i) {
  const a = accent(t, .1), kp = kickPulse(t);
  const amp = a * 15 + kp * 2.2;
  const nx = (vn(t * 52 + 1) - .5) * 2 * amp, ny = (vn(t * 49 + 9) - .5) * 2 * amp, rot = (vn(t * 38 + 5) - .5) * amp * .00075;
  const z = 1.035 + accent(t, .13) * .028 + kp * .004 + .02 * clamp((t - SC[i]) / (SC[i + 1] - SC[i]));
  g.translate(W / 2 + nx, H / 2 + ny); g.rotate(rot); g.scale(z, z); g.translate(-W / 2, -H / 2);
}
function renderScene(g, i, t) {
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  camera(g, t, i);
  drawBG(g, t, BGP[i]); drawPetals(g, t, .85);
  g.globalAlpha = 1; SCENES[i](g, t);
  g.restore();
}
function sceneIdx(t) { let i = 0; for (let k = 0; k < SCENES.length; k++) if (t >= SC[k]) i = k; return i; }
let cA, cB, gA, gB;
function frame(g, t) {
  const i = sceneIdx(t), k = i > 0 ? t - SC[i] : 99;
  if (i > 0 && k < TD) {
    renderScene(gB, i, t); g.drawImage(cB, 0, 0);
    renderScene(gA, i - 1, t);
    const ang = TRANS_ANG[i] * Math.PI / 180, dist = 1500 * E.outExpo(clamp(k / .34)), fade = 1 - E.inCubic(clamp((k - .2) / (TD - .2)));
    for (const side of [-1, 1]) {
      g.save(); const nx = -Math.sin(ang) * side, ny = Math.cos(ang) * side;
      halfPoly(g, W / 2, H / 2, ang, side); g.clip();
      g.translate(W / 2 + nx * dist, H / 2 + ny * dist); g.rotate(side * .06 * E.outExpo(clamp(k / .34))); g.translate(-W / 2, -H / 2);
      g.globalAlpha = fade; g.drawImage(cA, 0, 0); g.restore();
    }
    const dx = Math.cos(ang) * 1500, dy = Math.sin(ang) * 1500;
    slashLine(g, W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy, t, SC[i], { w: 70, dur: .38 });
    flash(g, t, SC[i], .55, .07);
  } else renderScene(g, i, t);
  // global overlays: vignette, frame, grain, intro/outro fades
  g.drawImage(BG.vig, 0, 0);
  const fp = prog(t, .2, 1.0), kp = kickPulse(t);
  g.save(); g.strokeStyle = `rgba(246,213,126,${(.28 + .22 * Math.min(1, kp)) * fp})`; g.lineWidth = 2; g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 5; g.strokeStyle = `rgba(246,213,126,${.8 * fp})`; const cl = 70 * fp;
  [[34, 34, 1, 1], [W - 34, 34, -1, 1], [34, H - 34, 1, -1], [W - 34, H - 34, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * cl); g.lineTo(x, y); g.lineTo(x + sx * cl, y); g.stroke(); });
  g.restore();
  // beat progress rule along the bottom edge
  g.save(); g.fillStyle = 'rgba(246,213,126,.85)'; g.shadowColor = 'rgba(255,190,80,.9)'; g.shadowBlur = 12; g.fillRect(34, H - 40, (W - 68) * (t / 30), 3); g.restore();
  drawGrain(g, t, .12);
  const fin = 1 - E.outCubic(clamp(t / .5)); if (fin > 0) { g.fillStyle = `rgba(0,0,0,${fin})`; g.fillRect(0, 0, W, H); }
  const fout = clamp((t - 29.45) / .55); if (fout > 0) { g.fillStyle = `rgba(0,0,0,${E.inOutSine(fout)})`; g.fillRect(0, 0, W, H); }
}

/* ================= bootstrap ================= */
let portrait;
async function boot() {
  await Promise.all(['NSerif9', 'NSerif6', 'NSans', 'Boku'].map(f => document.fonts.load(`40px ${f}`, '態度方法自己逆風成交馬先右10/8:–')));
  await document.fonts.ready;
  initData(await (await fetch('cues.json')).json());
  portrait = await new Promise(r => { const im = new Image(); im.onload = () => r(im); im.src = 'assets/portrait.png'; });
  BG.init(); build();
  const cv = document.getElementById('c'); const g = cv.getContext('2d');
  cA = document.createElement('canvas'); cA.width = W; cA.height = H; gA = cA.getContext('2d');
  cB = document.createElement('canvas'); cB.width = W; cB.height = H; gB = cB.getContext('2d');
  window.renderFrame = n => { frame(g, n / FPS); return true; };
  window.ready = true;
}
boot();
