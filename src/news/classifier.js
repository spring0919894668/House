const { CATEGORIES, CATEGORY_ORDER } = require('../config/categories');

// 以關鍵字計分做初步自動分類：
// - 逐一分類計算標題/摘要命中關鍵字的次數
// - 分數最高者勝出；若全部掛零，退回該來源的 defaultCategory，
//   仍然掛零則歸類到 D（其他）等待人工複核
function classify(text, defaultCategory) {
  const scores = {};
  for (const catId of CATEGORY_ORDER) {
    const { keywords } = CATEGORIES[catId];
    scores[catId] = keywords.reduce((count, kw) => {
      return count + (text.includes(kw) ? 1 : 0);
    }, 0);
  }

  const best = CATEGORY_ORDER.reduce((a, b) => (scores[b] > scores[a] ? b : a));

  if (scores[best] > 0) {
    return { category: best, confidence: scores[best], scores, autoClassified: true };
  }

  const fallback = defaultCategory && CATEGORIES[defaultCategory] ? defaultCategory : 'D';
  return { category: fallback, confidence: 0, scores, autoClassified: false };
}

module.exports = { classify };
