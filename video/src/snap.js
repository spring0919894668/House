const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1500,height:960}});await p.goto('http://localhost:3111');await p.waitForTimeout(800);
const h=await p.evaluate(()=>{document.querySelectorAll('script').forEach(s=>s.remove());return document.body.innerHTML});
require('fs').writeFileSync('ui_snippet.html',h);
console.log(await p.evaluate(()=>[...document.querySelectorAll('header,nav,main,aside,.news-card,.bot-card')].map(e=>e.tagName+e.className+' '+JSON.stringify(e.getBoundingClientRect())).join('\n')));
await b.close()})()
