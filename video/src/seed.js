const now=Date.now();
const n=(i,c,t,s,src,sum,st,sel)=>({id:'n'+i,category:c,title:t,link:'https://example.com/'+i,source:src,summary:sum,publishedAt:new Date(now-i*3600e3).toISOString(),fetchedAt:new Date(now).toISOString(),status:st,selectedForBot:sel});
const db={news:[
n(1,'A','都市計畫變更放寬 產業園區工廠立體化容積再加碼','內政部公告新制，工業區可透過立體化提高容積，預計帶動廠房更新。','內政部營建署','政府公告通盤檢討新規，鼓勵工廠立體化。','selected',{A:true}),
n(2,'B','預售屋成交量回溫 建商加速推案','代銷業者指出本季預售屋銷售率明顯提升，新成屋交屋量同步增加。','房市觀察','建商與代銷觀察市場回溫。','selected',{B:true,D:true}),
n(3,'C','AI 與智慧建築 ESG 綠建材成房產新趨勢','業界導入 BIM 與 AI 應用，淨零碳排帶動綠建築標章申請增加。','房產科技週報','AI、綠建築與 ESG 持續受關注。','pending',{}),
n(4,'D','房地合一稅與青安貸款新制 央行理監事會聚焦','政策調整影響購屋族群，社會住宅與包租代管2.0 同步擴大補助。','財經政策','稅務與貸款政策更新。','posted',{D:true}),
n(5,'A','市地重劃與區段徵收新案 國土計畫分區公告','多個縣市公告市地重劃範圍。','地政新聞','土地利用最新動態。','pending',{}),
],schedules:{A:{enabled:true,time:'09:00',groupIds:['C1a2…','C3b4…'],timezone:'Asia/Taipei'},B:{enabled:true,time:'09:30',groupIds:['C5c6…'],timezone:'Asia/Taipei'},C:{enabled:true,time:'10:00',groupIds:['C7d8…'],timezone:'Asia/Taipei'},D:{enabled:true,time:'10:30',groupIds:['C9e0…'],timezone:'Asia/Taipei'}},postLogs:[]};
require('fs').writeFileSync(process.argv[2]+'/db.json',JSON.stringify(db,null,2));
