#!/usr/bin/env python3
"""
Original, fully synthesized wuxia score (no samples, no copyrighted material).
120 BPM, A-minor pentatonic (A C D E G). 30.0 s stereo @ 44.1 kHz.
Writes:  audio/score.wav  and  cues.json (single source of truth for the
animation: every visual hit in the video is placed on a time listed here).
"""
import json, math, os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 120
BEAT = 60.0 / BPM  # 0.5 s
rng = np.random.default_rng(20261008)
HERE = os.path.dirname(os.path.abspath(__file__))

# ------------------------------------------------------------------ cues
CUES = {
    "hook1": 0.0, "hook2": 1.0, "hook3": 2.0, "roll": 3.0,
    "title": 4.0, "char0": 4.5, "sub": 6.0, "tag": 7.0,
    "speaker": 8.0, "name": 9.0, "role": 9.5, "quote1": 10.0, "quote2": 11.0,
    "shi1": 12.0, "shi2": 12.5, "shi3": 13.0, "tagline": 14.0,
    "card1": 15.0, "card2": 16.0, "card3": 17.0, "card4": 18.0,
    "offer": 20.0, "date": 21.5, "place": 23.0, "build": 24.0,
    "final": 25.0, "button": 26.0, "line": 27.0, "lockup": 28.0, "end": 30.0,
}
BIG = ["hook1", "title", "speaker", "card1", "offer", "final", "lockup"]
MED = ["hook3", "quote2", "tagline", "sub", "name", "quote1", "shi1", "shi2", "shi3", "card2", "card3",
       "card4", "date", "place", "button"]

# ------------------------------------------------------------------ helpers
def tarr(n): return np.arange(n) / SR

def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos"); return sosfilt(sos, x)
def lp(x, f, order=2):
    sos = butter(order, f, btype="low", fs=SR, output="sos"); return sosfilt(sos, x)
def hp(x, f, order=2):
    sos = butter(order, f, btype="high", fs=SR, output="sos"); return sosfilt(sos, x)

def noise(n): return rng.standard_normal(n)

class Bus:
    def __init__(self): self.b = np.zeros((N, 2))
    def add(self, sig, t0, gain=1.0, pan=0.0):
        i0 = int(round(t0 * SR))
        if i0 >= N or i0 + len(sig) <= 0: return
        s = sig;
        if i0 < 0: s = s[-i0:]; i0 = 0
        s = s[: N - i0]
        a = (pan + 1) * math.pi / 4
        self.b[i0:i0 + len(s), 0] += s * gain * math.cos(a)
        self.b[i0:i0 + len(s), 1] += s * gain * math.sin(a)

def make_ir(sec=2.4, damp=5500, seed=7):
    r = np.random.default_rng(seed); n = int(SR * sec); t = tarr(n)
    out = np.zeros((n, 2))
    for c in range(2):
        x = r.standard_normal(n) * np.exp(-t / (sec / 5.2))
        x = lp(x, damp, 1)
        x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        out[:, c] = x
    return out / np.sqrt(np.sum(out[:, 0] ** 2))

def reverb(bus, ir, wet):
    out = np.zeros_like(bus)
    for c in range(2):
        out[:, c] = fftconvolve(bus[:, c], ir[:, c])[: N]
    return out * wet

# ------------------------------------------------------------------ instruments
def taiko(vel=1.0, f0=58, tail=0.34, bright=1.0):
    n = int(SR * 1.4); t = tarr(n)
    f = f0 * (1 + 2.4 * np.exp(-t / 0.032))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / tail)
    body += 0.45 * np.sin(2 * np.pi * np.cumsum(f * 1.59) / SR) * np.exp(-t / (tail * 0.4))
    body += 0.25 * np.sin(2 * np.pi * np.cumsum(f * 2.3) / SR) * np.exp(-t / (tail * 0.22))
    slap = bp(noise(n), 700, 4200) * np.exp(-t / 0.018) * 1.4 * bright
    thump = lp(noise(n), 300) * np.exp(-t / 0.05) * 1.2
    s = (body + slap + thump)
    s *= (1 - np.exp(-t / 0.0015))
    return np.tanh(s * 1.5 * vel) * 0.8

def ka(vel=1.0, f0=190):  # small high drum / rim
    n = int(SR * 0.5); t = tarr(n)
    f = f0 * (1 + 1.1 * np.exp(-t / 0.02))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    s += bp(noise(n), 1500, 6000) * np.exp(-t / 0.012) * 0.9
    return np.tanh(s * 1.3 * vel) * 0.6

def wood(vel=1.0, f=1750):  # wood-block / bamboo clapper
    n = int(SR * 0.25); t = tarr(n)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018) + 0.6 * np.sin(2 * np.pi * f * 1.51 * t) * np.exp(-t / 0.01)
    s += bp(noise(n), 2500, 7000) * np.exp(-t / 0.006) * 0.6
    return s * vel * 0.55

def clap(vel=1.0):
    n = int(SR * 0.3); t = tarr(n)
    s = np.zeros(n)
    for d in (0, 0.011, 0.022):
        i = int(d * SR); m = n - i
        s[i:] += bp(noise(m), 900, 3800) * np.exp(-tarr(m) / 0.045)
    return s * vel * 0.55

def gong(vel=1.0, base=96, dur=4.5):
    n = int(SR * dur); t = tarr(n)
    ratios = [1, 1.47, 2.09, 2.56, 3.11, 3.9, 4.6, 5.8, 7.1]
    amps = [1, .8, .7, .55, .5, .35, .28, .2, .14]
    s = np.zeros(n)
    for r, a in zip(ratios, amps):
        for det in (0, 0.0035):
            f = base * r * (1 + det)
            env = np.exp(-t / (2.6 / (1 + 0.25 * r)))
            wob = 1 + 0.25 * np.sin(2 * np.pi * (0.7 + 0.31 * r) * t + r)
            s += a * 0.5 * np.sin(2 * np.pi * f * t + r) * env * wob
    sh = hp(noise(n), 1800) * np.exp(-t / 1.1) * 0.22
    sh *= (1 - np.exp(-t / 0.25))
    s = s + sh
    s *= (1 - np.exp(-t / 0.006))
    return np.tanh(s * 0.9 * vel) * 0.7

def shing(vel=1.0):
    n = int(SR * 1.0); t = tarr(n); s = np.zeros(n)
    for f, a, tau in [(5400, 1, .45), (6900, .8, .5), (8300, .6, .6), (10100, .4, .4), (3300, .5, .3)]:
        fm = f * (1 + 0.02 * np.exp(-t / 0.05))
        s += a * np.sin(2 * np.pi * np.cumsum(fm) / SR) * np.exp(-t / tau)
    s += hp(noise(n), 5000) * np.exp(-t / 0.2) * 0.9
    s *= (1 - np.exp(-t / 0.002)); return s * 0.28 * vel

def whoosh(dur=0.6, f_from=500, f_to=7000, vel=1.0, peak=0.5):
    n = int(SR * dur); t = tarr(n) / dur; x = noise(n); s = np.zeros(n)
    centers = np.geomspace(f_from, f_to, 14)
    for i, c in enumerate(centers):
        pos = 0.15 + 0.7 * i / (len(centers) - 1)
        w = np.exp(-((t - pos) ** 2) / (2 * 0.12 ** 2))
        s += bp(x, c * 0.8, min(c * 1.25, SR / 2 - 100)) * w * (0.6 + 0.4 * i / len(centers))
    env = np.minimum(1, t / peak) if peak > 0 else 1
    return s * 0.7 * vel * np.minimum(1, (1 - t) * 8) * 0.9

def riser(dur=1.0, vel=1.0):
    n = int(SR * dur); t = tarr(n); u = t / dur
    x = hp(noise(n), 1800) * (u ** 2.4)
    f = 220 * (2 ** (u * 3))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * u ** 3 * 0.25
    return (x * 0.55 + tone) * vel * (1 - np.exp(-t / 0.05))

def revcrash(dur=1.2, vel=1.0):
    n = int(SR * dur); t = tarr(n); u = t / dur
    x = hp(noise(n), 3000) * (u ** 3)
    return x * vel * 0.5

def crash(vel=1.0, dur=2.0):
    n = int(SR * dur); t = tarr(n)
    x = hp(noise(n), 3500) * np.exp(-t / 0.55)
    x += bp(noise(n), 6000, 12000) * np.exp(-t / 0.9) * 0.6
    return x * vel * 0.35

def boom(vel=1.0, dur=1.6):
    n = int(SR * dur); t = tarr(n)
    f = 38 * (1 + 1.6 * np.exp(-t / 0.18))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    return np.tanh(s * 1.6) * 0.8 * vel

def pluck(midi, dur=1.6, vel=1.0, bend=0.0):
    f = 440 * 2 ** ((midi - 69) / 12)
    n = int(SR * dur); t = tarr(n); s = np.zeros(n)
    fb = f * (2 ** (-bend / 12 * np.exp(-t / 0.08))) if bend else f * np.ones(n)
    phase = 2 * np.pi * np.cumsum(fb) / SR
    for k in range(1, 15):
        if f * k > 11000: break
        a = 1 / (k ** 1.05)
        if k % 7 == 0: a *= 0.3
        tau = 1.1 / (1 + 0.7 * (k - 1)) * (dur / 1.6) + 0.04
        s += a * np.sin(k * phase + 0.3 * k) * np.exp(-t / tau)
    click = bp(noise(n), 2000, 7000) * np.exp(-t / 0.006) * 0.5
    s = (s + click) * (1 - np.exp(-t / 0.0008))
    return s * 0.32 * vel

def erhu(notes, total_beats, vib=0.35):
    """notes: (start_beat, dur_beats, midi, slide_from_midi or None). Returns mono array of NEEDED length."""
    out = np.zeros(N)
    for (sb, db, m, sl) in notes:
        t0 = sb * BEAT; d = db * BEAT * 1.02 + 0.12
        n = int(SR * d); t = tarr(n)
        slide = np.zeros(n)
        if sl is not None:
            slide = (sl - m) * np.exp(-t / 0.09)
        vibd = np.clip((t - 0.18) / 0.3, 0, 1) * vib
        semis = m + slide + vibd * np.sin(2 * np.pi * 5.6 * t)
        f = 440 * 2 ** ((semis - 69) / 12)
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.zeros(n)
        for k in range(1, 12):
            if np.max(f) * k > 9000: break
            s += np.sin(k * ph + 0.2 * k) / (k ** 0.9)
        bow = bp(noise(n), 1200, 3800) * 0.07
        s = (s + bow)
        s = bp(s, 200, 5200, 1) * 1.4
        att = 1 - np.exp(-t / 0.045)
        rel = np.minimum(1, np.maximum(0, (d - t) / 0.14))
        s *= att * rel * 0.30
        i0 = int(t0 * SR)
        if i0 < N: out[i0:i0 + n] += s[: N - i0]
    return out

def xiao(notes):
    out = np.zeros(N)
    for (sb, db, m, sl) in notes:
        t0 = sb * BEAT; d = db * BEAT + 0.2
        n = int(SR * d); t = tarr(n)
        semis = m + (0 if sl is None else (sl - m) * np.exp(-t / 0.25)) + 0.2 * np.sin(2 * np.pi * 4.8 * t) * np.clip(t / 0.5, 0, 1)
        f = 440 * 2 ** ((semis - 69) / 12)
        ph = 2 * np.pi * np.cumsum(f) / SR
        s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
        s += bp(noise(n), 2500, 6500) * 0.1 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.8 * t))
        env = (1 - np.exp(-t / 0.12)) * np.minimum(1, np.maximum(0, (d - t) / 0.22))
        i0 = int(t0 * SR)
        if i0 < N: out[i0:i0 + n] += (s * env * 0.25)[: N - i0]
    return out

def bass_note(midi, dur):
    f = 440 * 2 ** ((midi - 69) / 12); n = int(SR * dur); t = tarr(n)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    s = np.tanh(s * 1.2)
    env = np.minimum(1, t / 0.02) * np.minimum(1, np.maximum(0, (dur - t) / 0.05))
    return s * env * 0.5

# ------------------------------------------------------------------ arrangement
drums, perc, harm, lead, fx, bass = Bus(), Bus(), Bus(), Bus(), Bus(), Bus()
kicks = []  # (t, strength) for visual pulse

def don(t, v=1.0, f0=58): drums.add(taiko(v, f0), t, 0.95 * v ** 0.3); kicks.append((round(t, 4), round(v, 2), "don"))
def kaa(t, v=1.0, f0=190, pan=0.0): drums.add(ka(v, f0), t, 0.8, pan); kicks.append((round(t, 4), round(0.4 * v, 2), "ka"))
def BT(b): return b * BEAT
def S(b16): return b16 * BEAT / 4  # 16th note

# ---- section A (0-4s): hook ------------------------------------------------
drone_n = int(SR * 4.2); td = tarr(drone_n)
drone = (np.sin(2 * np.pi * 55 * td) + 0.5 * np.sin(2 * np.pi * 110.4 * td) + 0.25 * lp(noise(drone_n), 400) * 0.6)
drone *= np.minimum(1, td / 1.2) * 0.22 * np.minimum(1, (4.2 - td) / 0.3)
bass.add(drone, 0, 1.0)
wind = bp(noise(int(SR * 4.0)), 300, 2200) * (np.sin(np.pi * tarr(int(SR * 4.0)) / 4.0) ** 2) * 0.12
fx.add(wind, 0, 1.0, -0.2)

gong_hits = [(0.0, 1.0, 96), (2.0, 0.85, 110), (4.0, 1.1, 96), (8.0, 0.95, 110), (15.0, 0.9, 96),
             (20.0, 1.0, 96), (25.0, 1.0, 110), (28.0, 1.35, 82)]
for (t, v, base) in gong_hits: fx.add(gong(v, base), t, 0.85)

don(0.0, 1.15); fx.add(boom(1.0), 0.0, 0.9)
fx.add(shing(1.0), 0.02, 1.0, 0.3)
xiao_notes = [(1, 3, 69, None), (4.5, 1.5, 76, 69), (6, 2, 72, None)]
xi = xiao([(0.5, 3.5, 64, None), (4.0, 2.0, 67, 64)])
# A-section pickup: xiao breath on A
lead.b[:, 0] += xi * 0.9; lead.b[:, 1] += xi * 0.9
# plucks
for (b, m, v, pan) in [(1.0, 69, .8, -.3), (1.5, 76, .6, .3), (2.5, 72, .7, -.2), (3.0, 67, .6, .3), (3.5, 69, .6, 0)]:
    harm.add(pluck(m, 1.8, v), BT(b), 1.0, pan)
don(1.0, 0.8); kaa(1.5, .6); wood_t = [1.75]
for t in wood_t: perc.add(wood(0.8), t, 1.0, 0.25)
don(2.0, 1.0); fx.add(shing(.8), 2.0, 1.0, -0.3)
kaa(2.75, .5); kaa(3.0, .6); kaa(3.25, .7, 220);
# taiko roll 3.0 -> 4.0 : accelerating 16ths->32nds, crescendo
roll_times = []
t = 3.0
gap = 0.25
while t < 3.97:
    roll_times.append(t); t += gap; gap = max(0.0625, gap * 0.86)
for i, tt in enumerate(roll_times):
    u = i / max(1, len(roll_times) - 1)
    don(tt, 0.35 + 0.65 * u, 62 + 14 * u) if i % 2 == 0 else kaa(tt, 0.4 + 0.6 * u, 170 + 60 * u, pan=(-1) ** i * 0.3)
fx.add(riser(1.0), 3.0, 1.0); fx.add(revcrash(1.1), 2.95, 1.0)

# ---- big impact at 4.0 ----
don(4.0, 1.3, 55); fx.add(boom(1.4), 4.0, 1.0); fx.add(crash(1.0), 4.0, 1.0)
fx.add(shing(1.2), 4.0, 1.0, 0.0); fx.add(whoosh(0.5, 300, 9000, 1.0), 3.7, 0.7)

# ---- per-bar groove from 4.0 s ----
roots = {0: 45, 1: 45, 2: 45, 3: 45, 4: 43, 5: 43, 6: 45, 7: 45, 8: 48, 9: 48, 10: 43, 11: 43, 12: 45, 13: 45, 14: 45}
scale_pent = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79]
pattern_gz = [0, 3, 5, 3, 2, 4, 6, 4, 0, 3, 5, 7, 6, 4, 3, 2]
SECTION = lambda tt: ("B" if tt < 8 else "C" if tt < 12 else "D" if tt < 15 else "E" if tt < 20 else "F" if tt < 25 else "G")

def groove_bar(t0, kind):
    """16 slots of 0.125 s starting at t0"""
    if kind == "main":
        spec = {0: ("don", 1.0), 3: ("ka", .5), 4: ("don", .7), 6: ("ka", .55), 8: ("don", .95),
                10: ("don", .5), 11: ("ka", .55), 12: ("don", .8), 14: ("ka", .6), 15: ("ka", .8)}
    elif kind == "half":
        spec = {0: ("don", 1.0), 8: ("don", .75), 12: ("ka", .6), 14: ("ka", .6)}
    elif kind == "drive":
        spec = {0: ("don", 1.0), 2: ("ka", .45), 4: ("don", .75), 6: ("ka", .5), 8: ("don", .95), 10: ("ka", .5),
                11: ("don", .55), 12: ("don", .85), 14: ("ka", .6), 15: ("ka", .75)}
    elif kind == "sparse":
        spec = {0: ("don", 1.0), 6: ("ka", .5), 8: ("don", .7), 14: ("ka", .6)}
    else: spec = {}
    for slot, (ty, v) in spec.items():
        tt = t0 + S(slot)
        if ty == "don": don(tt, v)
        else: kaa(tt, v, 190 + (slot % 3) * 25, pan=-0.25 if slot % 2 else 0.25)
    # backbeat clap/wood
    for slot in (4, 12):
        perc.add(clap(0.7), t0 + S(slot), 0.9)
    for slot in range(0, 16, 2):
        perc.add(wood(0.28 + 0.1 * (slot % 4 == 0)), t0 + S(slot), 0.7, 0.3 if slot % 4 else -0.3)

bar_kind = {8: "main", 9: "main", 10: "half", 11: "main"}  # bar index relative: set below
for bar in range(2, 15):
    t0 = bar * 2.0
    sec = SECTION(t0)
    if sec == "B": kind = "main"
    elif sec == "C": kind = "half" if bar in (4, 5) else "main"
    elif sec == "D": kind = "sparse" if bar == 6 else "half"
    elif sec == "E": kind = "drive"
    elif sec == "F": kind = "half" if bar == 10 else "main"
    else: kind = "drive"
    if bar == 7: kind = "none"        # 14.0-16.0 handled below
    if bar == 12 and False: kind = "none"
    if kind != "none" and bar != 2 and bar != 3:
        pass
    if bar in (2, 3): continue         # hook bars handled above
    if t0 == 14.0: continue
    groove_bar(t0, kind)

# 4.0-8.0 : section B groove at bars 2,3 (t0 = 4.0, 6.0) – bar index here = 2,3
for bar in (2, 3):
    groove_bar(bar * 2.0, "main" if bar == 3 else "half")
# 14.0-15.0 : tagline bar + build, 15.0 on = drive
groove_bar(14.0, "sparse")

# cue accents (big / med) – layered on top of groove
for k in BIG:
    t = CUES[k]
    if k != "hook1": don(t, 1.25); fx.add(boom(1.0), t, 0.8)
    if k not in ("hook1",): fx.add(crash(0.8), t, 0.8)
    fx.add(shing(0.9), t + 0.01, 1.0, 0.0)
for k in MED:
    t = CUES[k]; don(t, 1.0); fx.add(shing(0.7), t, 0.8, -0.2 if sum(map(ord, k)) % 2 else 0.2)
    if k in ("sub", "card2", "card3", "card4", "button", "quote1", "date", "place"): fx.add(whoosh(0.45, 400, 8000, 0.8), t - 0.28, 0.8)

# title chars 4.5 .. 5.75 (6 chars, eighth + 16th hits)
for i in range(6):
    t = CUES["char0"] + 0.25 * i
    don(t, 0.75 + 0.05 * i, 60 + 4 * i); perc.add(wood(0.8), t, 0.8, -0.3 + 0.12 * i)
# tag at 7.0
kaa(7.0, 0.9); kaa(7.25, .7); kaa(7.5, .9); kaa(7.75, 1.0, 230)
fx.add(riser(0.9), 7.1, 0.9)
# name seal stamp 9.0 – low thud + wood
perc.add(wood(1.2, 1100), 9.0, 1.0); perc.add(wood(1.0, 1500), 9.5, 0.8)
# quote lines – pluck flourishes
for (t, notes) in [(10.0, [76, 72, 69]), (11.0, [79, 76, 74, 72])]:
    for i, m in enumerate(notes): harm.add(pluck(m, 1.6, .8), t + 0.125 * i, 1.0, -0.2 + 0.2 * i)
# shi rolls
for k in ("shi1", "shi2", "shi3"):
    t = CUES[k]; kaa(t + 0.25, .9, 240); fx.add(whoosh(0.4, 600, 9000, .8), t - 0.2, 0.7)
# tagline sweep 14.0
fx.add(whoosh(0.8, 300, 8000, 1.0), 13.8, 0.8)
fx.add(riser(1.0), 14.0, 1.0); fx.add(revcrash(1.0), 14.0, 0.8)
# 24.0-25.0 build
bt = 24.0; gap = 0.25
while bt < 24.97:
    don(bt, 0.4 + 0.6 * (bt - 24) / 1.0, 60 + 12 * (bt - 24)); bt += gap; gap = max(0.0625, gap * 0.82)
fx.add(riser(1.0), 24.0, 1.0)
# final bar before lockup 27.0-28.0 – break build
fx.add(riser(1.0), 27.0, 0.9); fx.add(revcrash(1.0), 27.0, 0.8)
bt = 27.5; gap = .125
while bt < 27.98:
    don(bt, 0.5 + (bt - 27.5), 62); bt += gap; gap = max(0.0625, gap * 0.8)
# lockup: final big hit + celebratory plucks, then ring out
for i, m in enumerate([69, 72, 76, 79, 81, 84]):
    harm.add(pluck(m, 2.6, 0.9), 28.0 + i * 0.09, 1.0, -0.5 + 0.2 * i)
for i, m in enumerate([81, 79, 76, 72, 69]):
    harm.add(pluck(m, 2.0, 0.6), 28.9 + i * 0.12, 1.0, 0.5 - 0.2 * i)

# ---- bass line (pumping) ----
for bar in range(2, 15):
    t0 = bar * 2.0; r = roots[bar]
    if t0 in (24.0,): pass
    for beat in range(4):
        tt = t0 + beat * BEAT
        bass.add(bass_note(r if beat % 2 == 0 else r + (7 if beat == 3 else 0), BEAT * 0.9), tt, 0.9)
bass.add(bass_note(45, 2.0) * 1.0, 28.0, 1.0)

# ---- guzheng ostinato (sections B, E-G) ----
def gz_bar(t0, scale_off=0, density=8, vel=0.6):
    step = 16 // density
    for i in range(density):
        idx = pattern_gz[(i * step) % 16] + scale_off
        idx = max(0, min(len(scale_pent) - 1, idx))
        harm.add(pluck(scale_pent[idx], 1.0, vel * (1 if i % 2 == 0 else 0.75)), t0 + i * step * BEAT / 4, 1.0, -0.4 + 0.8 * (i / density))
for bar in range(2, 15):
    t0 = bar * 2.0
    sec = SECTION(t0)
    if sec in ("B",): gz_bar(t0, 0, 8, 0.55)
    elif sec == "C": gz_bar(t0, 0, 4, 0.45)
    elif sec == "D": gz_bar(t0, 1, 8, 0.55) if t0 != 14.0 else gz_bar(t0, 1, 4, 0.5)
    elif sec == "E": gz_bar(t0, 0, 16, 0.5)
    elif sec == "F": gz_bar(t0, 0, 8 if bar != 11 else 16, 0.55)
    else: gz_bar(t0, 0, 16 if bar in (13,) else 8, 0.55)

# ---- erhu melody ----
T1 = [(0, 1.5, 76, 72), (1.5, .5, 74, None), (2, 1, 72, None), (3, 1, 69, None),
      (4, 2, 67, 72), (6, 1, 69, None), (7, 1, 72, None)]
T2 = [(0, 1, 74, 76), (1, 1, 72, None), (2, 1.5, 69, None), (3.5, .5, 67, None),
      (4, 3, 69, 64), (7, 1, 67, None)]
T3 = [(0, .5, 76, None), (.5, .5, 79, None), (1, 1.5, 81, 76), (2.5, .5, 79, None), (3, 1, 76, None),
      (4, .5, 74, None), (4.5, .5, 76, None), (5, 1, 79, None), (6, 2, 76, 81)]
mel = []
def put(theme, at): mel.extend([(at + s, d, m, sl) for (s, d, m, sl) in theme])
put(T1, 16 * 1)          # 8.0s  speaker
put(T2, 16 + 8)          # 10.0s
# 12.0–15.0 : sustained heroic
mel += [(24, 1, 76, None), (25, 1, 79, None), (26, 1, 81, None), (27, 3, 84, 79)]
mel += [(30, .5, 81, None), (30.5, .5, 79, None), (31, 1, 76, None), (32, 1.5, 79, None), (33.5, .5, 81, None), (34, 2, 84, 79),
        (36, 1, 81, None), (37, 1, 79, None), (38, 2, 76, None)]
put(T3, 40); put(T1, 48)   # 20–25s (offer)
mel += [(50, 1, 79, None), (51, 1, 81, None), (52, 1.5, 84, 79), (53.5, .5, 81, None), (54, 2, 79, None)]
mel += [(56, 4, 76, None), (60, 0.1, 76, None)][:1]
er = erhu(mel, 60)
# duck lead for 3.5-4.0? no – ok
lead.b[:, 0] += er * 1.0; lead.b[:, 1] += er * 1.0

# ---- sidechain: duck bass & guzheng under taiko hits ----
duck = np.ones(N)
for (t, v, ty) in kicks:
    if ty != "don": continue
    i0 = int(t * SR); n = int(0.22 * SR)
    if i0 >= N: continue
    seg = 1 - 0.55 * min(1.2, v) * np.exp(-tarr(min(n, N - i0)) / 0.07)
    duck[i0:i0 + len(seg)] = np.minimum(duck[i0:i0 + len(seg)], seg)
bass.b *= duck[:, None]
harm.b *= (0.5 + 0.5 * duck)[:, None]

# ------------------------------------------------------------------ mix
ir = make_ir()
wet = (reverb(harm.b, ir, 0.55) + reverb(lead.b, ir, 0.7) + reverb(fx.b, ir, 0.28) + reverb(drums.b, ir, 0.16) + reverb(perc.b, ir, 0.2))
mix = drums.b * 1.05 + perc.b * 0.8 + harm.b * 0.9 + lead.b * 0.8 + fx.b * 0.8 + bass.b * 1.0 + wet
# master: high-pass, glue
mix = np.stack([hp(mix[:, c], 28, 1) for c in range(2)], 1)
rm = np.sqrt(np.mean(mix ** 2)); mix = mix / rm * 0.17          # target ~ -15 dB RMS
mix = np.tanh(mix * 1.0)                                           # gentle glue/limit
pk = np.max(np.abs(mix)); mix = mix / pk * 0.89
fade = np.ones(N); fn = int(0.5 * SR); fade[-fn:] = np.linspace(1, 0, fn) ** 1.5
fade[: int(0.005 * SR)] = np.linspace(0, 1, int(0.005 * SR))
mix *= fade[:, None]

import wave
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(os.path.join(HERE, "score.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# loudness envelope for visuals (smoothed RMS @ 30 fps)
mono = np.mean(np.abs(mix), axis=1)
hop = SR // 30
rms = [float(np.sqrt(np.mean(mono[i:i + hop] ** 2))) for i in range(0, N - hop + 1, hop)]
m = max(rms)
json.dump({"bpm": BPM, "cues": CUES, "hits": kicks, "rms": [round(r / m, 3) for r in rms]},
          open(os.path.join(HERE, "..", "cues.json"), "w"))
print("ok", len(kicks), "hits; peak", pk)
