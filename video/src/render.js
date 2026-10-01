const fs=require('fs');const NR=process.argv[2];const {chromium}=require(NR+'/playwright');
const [,, , from,to,step,fps]=process.argv;
(async()=>{
const SP=__dirname;
let h=fs.readFileSync(SP+'/template.html','utf8').replace('<!--UI-->',fs.readFileSync(SP+'/ui_snippet.html','utf8'));
fs.writeFileSync(SP+'/video.html',h);
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--allow-file-access-from-files','--force-device-scale-factor=1']});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>console.log('LOG',m.text()));
await p.goto('file://'+SP+'/video.html');await p.waitForTimeout(600);
fs.mkdirSync(SP+'/frames',{recursive:true});
for(let i=+from;i<+to;i+=+step){await p.evaluate(t=>window.render(t),i/ +fps);
 await p.screenshot({path:`${SP}/frames/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:93});}
await b.close();})();
