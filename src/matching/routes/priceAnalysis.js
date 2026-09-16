const express = require('express');
const store = require('../store');
const { authenticate, canView } = require('../auth');
const priceEngine = require('../priceEngine');

const router = express.Router();
router.use(authenticate);

// GET /api/matching/cases/:id/price-analysis -> 價格合理性分析（可接正式實價 AI）
router.get('/cases/:id/price-analysis', async (req, res) => {
  const data = store.read();
  const caseItem = data.cases.find((c) => c.id === req.params.id);
  if (!caseItem) return res.status(404).json({ ok: false, error: '找不到該案件' });
  if (!canView(req.matchingUser, caseItem)) {
    return res.status(403).json({ ok: false, error: '沒有權限檢視此案件' });
  }

  try {
    const analysis = await priceEngine.estimate(caseItem, data.cases);
    let assessment = null;
    if (analysis.suggestedLow != null && analysis.suggestedHigh != null && caseItem.askingPrice) {
      if (caseItem.askingPrice > analysis.suggestedHigh) assessment = 'aboveMarket';
      else if (caseItem.askingPrice < analysis.suggestedLow) assessment = 'belowMarket';
      else assessment = 'withinRange';
    }
    res.json({ ok: true, analysis: { ...analysis, assessment, askingPrice: caseItem.askingPrice } });
  } catch (err) {
    res.status(502).json({ ok: false, error: `實價分析失敗：${err.message}` });
  }
});

module.exports = router;
