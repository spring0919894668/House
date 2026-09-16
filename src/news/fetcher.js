const crypto = require('crypto');
const Parser = require('rss-parser');
const SOURCES = require('../config/sources');
const { classify } = require('./classifier');
const db = require('../store/db');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; HouseNewsBot/1.0; +https://example.com/bot)'
  }
});

function makeId(link, title) {
  return crypto.createHash('sha1').update(link || title).digest('hex').slice(0, 16);
}

async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).map((item) => {
      const text = `${item.title || ''} ${item.contentSnippet || item.content || ''}`;
      const { category, confidence, autoClassified } = classify(text, source.defaultCategory);
      return {
        id: makeId(item.link, item.title),
        category,
        confidence,
        autoClassified,
        title: item.title || '(無標題)',
        link: item.link || '',
        source: source.name,
        summary: (item.contentSnippet || item.content || '').slice(0, 300),
        publishedAt: item.isoDate || item.pubDate || null,
        fetchedAt: new Date().toISOString(),
        status: 'pending',
        selectedForBot: { A: false, B: false, C: false, D: false }
      };
    });
  } catch (err) {
    console.error(`[fetcher] 來源擷取失敗：${source.name} (${source.url})`, err.message);
    return [];
  }
}

async function fetchAll() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const fetched = results.flat();

  const data = db.read();
  const existingIds = new Set(data.news.map((n) => n.id));
  let addedCount = 0;

  for (const item of fetched) {
    if (!existingIds.has(item.id)) {
      data.news.unshift(item);
      existingIds.add(item.id);
      addedCount += 1;
    }
  }

  // 只保留最近 90 天內取得的新聞，避免檔案無限成長
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  data.news = data.news.filter((n) => new Date(n.fetchedAt).getTime() >= cutoff);

  db.write(data);
  console.log(`[fetcher] 完成擷取，共 ${fetched.length} 則，新增 ${addedCount} 則`);
  return { total: fetched.length, added: addedCount };
}

if (require.main === module) {
  fetchAll().then(() => process.exit(0)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { fetchAll };
