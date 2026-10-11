#!/bin/bash
out=$1; shift; rm -rf test; mkdir test; fr=""
for t in "$@"; do fr="$fr,$(python3 -c "print(round($t*30))")"; done
FRAMES=${fr:1} node render.js 0 900 test 2>&1 | grep -E "ERR|rror"
python3 - "$out" <<'P'
import sys,glob
from PIL import Image
fs=sorted(glob.glob('test/*.png')); w=380; ims=[Image.open(f).convert('RGB') for f in fs]
ims=[i.resize((w,int(i.height*w/i.width))) for i in ims]
n=len(ims); cols=min(n,int(sys.argv[2]) if len(sys.argv)>2 else 6); rows=(n+cols-1)//cols
sh=Image.new('RGB',(cols*w,rows*ims[0].height))
for k,i in enumerate(ims): sh.paste(i,((k%cols)*w,(k//cols)*ims[0].height))
sh.save(sys.argv[1])
P
