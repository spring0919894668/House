import numpy as np, wave
SR=44100; DUR=30.0; N=int(SR*DUR); B=0.5
rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
def add(buf,t,sig,g=1.0):
    i=int(t*SR)
    if i>=N: return
    s=sig[:N-i]; buf[i:i+len(s)]+=s*g
def tt(d): return np.arange(int(d*SR))/SR
def kick(g=1):
    t=tt(0.45); f=48+110*np.exp(-t*28); ph=2*np.pi*np.cumsum(f)/SR
    return (np.sin(ph)*np.exp(-t*7)+0.4*np.sin(ph*2)*np.exp(-t*30))*g
def click(): t=tt(0.01); return rng.standard_normal(len(t))*np.exp(-t*600)*0.3
def clap(g=1):
    t=tt(0.3); n=rng.standard_normal(len(t))
    e=np.exp(-t*22)+0.8*np.exp(-((t-0.012)%0.02)*0)*0
    env=np.exp(-t*18)*(1+0.8*(np.sin(2*np.pi*90*t)>0))
    # bandpass-ish via diff mix
    y=n-0.6*np.roll(n,1); return y*env*0.55*g
def hat(o=False,g=1):
    d=0.25 if o else 0.06; t=tt(d); n=rng.standard_normal(len(t)); n=n-np.roll(n,1)
    return n*np.exp(-t*(14 if o else 70))*0.25*g
def snare(g=1):
    t=tt(0.2); n=rng.standard_normal(len(t)); return (n*np.exp(-t*25)*0.5+np.sin(2*np.pi*190*t)*np.exp(-t*30)*0.5)*g
def saw(f,d,det=0.004,n=3):
    t=tt(d); y=0
    for k in range(n):
        ff=f*(1+det*(k-(n-1)/2)); y=y+(2*((t*ff)%1)-1)
    return y/n
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); s=0
    # vectorised via lfilter-less simple loop in chunks
    from numpy import empty
    out=np.empty_like(x); 
    for i in range(len(x)): s=(1-a)*x[i]+a*s; out[i]=s
    return out
def adsr(n,a,d,s,r):
    e=np.ones(n); na=int(a*SR); nd=int(d*SR); nr=int(r*SR)
    e[:na]=np.linspace(0,1,na); e[na:na+nd]=np.linspace(1,s,nd); e[na+nd:]=s
    if nr<n: e[-nr:]*=np.linspace(1,0,nr)
    return e
def midi(m): return 440*2**((m-69)/12)
dry_L=L; 
# buses
drums=np.zeros(N); bass=np.zeros(N); lead=np.zeros(N); pad=np.zeros(N); fx=np.zeros(N)
kicks=[0,0.5,1.5,2.5]+[4+0.5*i for i in range(30)]+[20+0.5*i for i in range(19)]
kicks=[k for k in kicks if not (19<=k<20) and k<29.6]
kicks=sorted(set(kicks))
for k in kicks:
    g=0.7 if k<4 else 1.0
    add(drums,k,kick(g)); 
# claps on 2&4 beats (every 1.0 offset by 0.5) in drop sections
def sec(t): return (4<=t<19) or (20<=t<29.5)
for i in range(60):
    t=4+i*1.0+0.5
    if sec(t): add(drums,t,clap(),0.9)
# hats offbeat + 16ths
for i in range(int(30/0.25)):
    t=i*0.25
    if t>=4 and sec(t):
        if i%2==1: add(drums,t,hat(False,0.6 if i%4 else 0.0)) if False else add(drums,t,hat(False,0.5))
        if i%4==2: add(drums,t,hat(True,0.7))
    elif t<4 and i%2==0: add(drums,t,hat(False,0.4))
# intro hits (text slams)
for t in [0.0,0.5,1.5,2.5]: add(fx,t,click(),1.5); add(drums,t,clap(),0.8)
add(fx,3.0,snare(1),0.9)
# snare roll 3.0-4.0 accelerating
t=3.0; step=0.125
while t<3.95:
    add(drums,t,snare(0.4+0.6*(t-3)),1.0); step=max(0.03125,step*0.86); t+=step
# riser noise 2.0-4.0 and 18-20
def riser(d):
    t=tt(d); n=rng.standard_normal(len(t)); n=n-np.roll(n,1)*(0.2+0.78*(t/d)); 
    return n*(t/d)**2*0.35*np.sin(2*np.pi*(300+3000*(t/d)**2)*t*0+0)+n*(t/d)**3*0.25
add(fx,2.0,riser(2.0)); add(fx,18.0,riser(2.0))
# tonal sweep riser
def sweep(d,f0,f1):
    t=tt(d); f=f0*(f1/f0)**(t/d); ph=2*np.pi*np.cumsum(f)/SR; return np.sin(ph)*(t/d)**2*0.2
add(fx,2.0,sweep(2.0,200,1600)); add(fx,18.0,sweep(2.0,200,1800))
# impacts: boom + crash
def boom(): t=tt(1.8); f=38+60*np.exp(-t*8); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*2.2)*1.3
def crash(d=2.2):
    t=tt(d); n=rng.standard_normal(len(t)); n=n-np.roll(n,1); return n*np.exp(-t*2.0)*0.45
for t in [4.0,20.0,26.0]: add(fx,t,boom()); add(fx,t,crash(2.5),1.0)
add(fx,10.0,crash(1.2),0.5); add(fx,14.0,crash(1.5),0.6); add(fx,8.0,crash(1.2),0.5); add(fx,17.0,crash(1.0),0.4)
# bass: sixteenth pattern, root per bar (Am F C G)
roots=[45,41,48,43]  # A2 F2 C3 G2
pat=[1,0,1,1, 0,1,0,1, 1,0,1,0, 1,1,0,1]
for bar in range(15):
    t0=bar*2.0
    for i in range(8): # 8th notes
        t=t0+i*0.25
        if not sec(t) or t<4: continue
        if not pat[(i*2)%16] and i%2: continue
        r=roots[bar%4]+(12 if i in (3,7) and bar%2 else 0)
        n=saw(midi(r),0.22,0.002,2); n=lp(n,500+ 900*(i%2)) if False else n
        n=n*adsr(len(n),0.003,0.08,0.6,0.05)
        add(bass,t,n+np.sin(2*np.pi*midi(r)*tt(0.22))*0.8,0.5)
# pad chords
chords=[[57,60,64],[53,57,60],[60,64,67],[55,59,62]]
for bar in range(15):
    t0=bar*2.0
    for m in chords[bar%4]:
        n=saw(midi(m),2.2,0.006,4)*adsr(int(2.2*SR),0.2,0.3,0.7,0.5)
        add(pad,t0,n,0.10 if t0>=4 else 0.06)
# arp lead: 16th arpeggio in drop
scale_notes={0:[69,72,76,81],1:[65,69,72,77],2:[72,76,79,84],3:[67,71,74,79]}
for bar in range(2,15):
    t0=bar*2.0
    if not (4<=t0<18 or 20<=t0<28): continue
    arp=scale_notes[bar%4]
    for i in range(16):
        t=t0+i*0.125
        m=arp[[0,1,2,3,2,1,2,3][i%8]] + (12 if (t0>=20 and i%8==7) else 0)
        n=np.sign(np.sin(2*np.pi*midi(m)*tt(0.18)))*0.5+saw(midi(m),0.18,0.003,2)*0.5
        n=n*adsr(len(n),0.002,0.05,0.25,0.06)
        add(lead,t,n,0.16 if t0>=8 else 0.1)
# melody (bell-ish) from 8s
mel={8:[(0,76),(1.0,79),(1.5,81),(3.0,79)]}
phr=[[(0,81),(0.75,79),(1.0,76),(1.5,79),(2.0,81),(2.5,84),(3.0,81)],[(0,84),(0.5,83),(1.0,81),(1.5,79),(2.0,76),(3.0,79)]]
def bell(f,d=0.9):
    t=tt(d); return (np.sin(2*np.pi*f*t)+0.5*np.sin(2*np.pi*f*2.01*t)*np.exp(-t*6)+0.3*np.sin(2*np.pi*f*3.99*t)*np.exp(-t*12))*np.exp(-t*3.5)
for k,t0 in enumerate(range(8,28,4)):
    if 18<=t0<20: continue
    for (o,m) in phr[k%2]:
        add(lead,t0+o*1.0,bell(midi(m)),0.18)
# final chord 28..30
for m in [45,57,60,64,69,72,76]:
    n=saw(midi(m),2.4,0.004,3)*adsr(int(2.4*SR),0.01,0.4,0.5,1.2); add(pad,28.5,n,0.10)
add(fx,28.5,boom(),0.6)
# sidechain
sc=np.ones(N)
for k in kicks:
    i=int(k*SR); n=int(0.28*SR); env=1-0.75*np.exp(-np.arange(min(n,N-i))/SR*14)
    sc[i:i+len(env)]=np.minimum(sc[i:i+len(env)],env)
# reverb for lead/fx/pad
def reverb(x,d=1.6,mix=0.35):
    t=tt(d); ir=rng.standard_normal(len(t))*np.exp(-t*3.0)
    n=1<<int(np.ceil(np.log2(N+len(ir)))); y=np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(ir,n),n)[:N]
    return y*mix*0.08
mixL=drums+bass*sc*1.0+pad*sc+lead*(0.6+0.4*sc)+fx
verb=reverb(lead*1.5+pad*0.8+fx*0.4+drums*0.1)
# stereo: slight haas on lead/pad
sh=int(0.012*SR)
Lc=mixL+verb; Rc=mixL+np.roll(verb,sh)*0.9+np.roll(lead*0.3,sh)-np.roll(lead*0.3,0)*0.0
Rc[:sh]=mixL[:sh]
# fade out, normalize
fade=np.ones(N); fade[-int(0.6*SR):]=np.linspace(1,0,int(0.6*SR)); fade[:int(0.005*SR)]=np.linspace(0,1,int(0.005*SR))
Lc*=fade; Rc*=fade
m=max(abs(Lc).max(),abs(Rc).max()); 
g=0.89/m
Lc=np.tanh(Lc*g*1.1)/np.tanh(1.1); Rc=np.tanh(Rc*g*1.1)/np.tanh(1.1)
st=(np.stack([Lc,Rc],1)*32767*0.95).astype(np.int16)
w=wave.open('music.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes()); w.close()
print('ok',kicks[:8])
