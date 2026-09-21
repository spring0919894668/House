// 新聞來源設定（RSS）。
// 可依實際狀況增刪，defaultCategory 為來源本身偏向的分類（僅作為輔助權重，
// 實際分類仍以 classifier.js 的關鍵字比對結果為主）。
// 若某來源沒有提供 RSS，可改用 news/customFetcher.js 自行擴充擷取邏輯。

module.exports = [
  {
    id: 'moi-news',
    name: '內政部新聞',
    url: 'https://www.moi.gov.tw/News.aspx?n=4&RSS=1',
    defaultCategory: 'A'
  },
  {
    id: 'cpami',
    name: '內政部國土管理署（原營建署）',
    url: 'https://www.cpami.gov.tw/rss.php',
    defaultCategory: 'A'
  },
  {
    id: 'housenews',
    name: '好房網 News',
    url: 'https://news.housefun.com.tw/rss',
    defaultCategory: 'B'
  },
  {
    id: 'ettoday-house',
    name: 'ETtoday 房產雲',
    url: 'https://feeds.ettoday.net/rss/house.xml',
    defaultCategory: 'B'
  },
  {
    id: 'moneyudn-house',
    name: '經濟日報 房市頭條',
    url: 'https://money.udn.com/rssfeed/news/1001/5591/6996?ch=money',
    defaultCategory: 'B'
  },
  {
    id: 'mof-tax',
    name: '財政部稅務入口網公告',
    url: 'https://www.etax.nat.gov.tw/etwmain/rss',
    defaultCategory: 'D'
  }
];
