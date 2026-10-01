const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1500,height:960},deviceScaleFactor:2});
await p.goto('http://localhost:3111');await p.waitForTimeout(800);
await p.screenshot({path:'/tmp/claude-0/-home-user-House/9fb84cd2-a76d-53ee-8f53-0d778b8b0f33/scratchpad/shots/full.png'});
for(const [sel,name] of [['header','header'],['#categoryTabs','tabs'],['.news-card >> nth=0','news1'],['.news-card >> nth=1','news2'],['.bot-card >> nth=0','bot1'],['#scheduleBoard','board']]){
 await p.locator(sel).first().screenshot({path:'/tmp/claude-0/-home-user-House/9fb84cd2-a76d-53ee-8f53-0d778b8b0f33/scratchpad/shots/'+name+'.png'});}
await b.close();})();
