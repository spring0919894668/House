const express = require('express');
const store = require('../store');
const { authenticate, canView } = require('../auth');
const priceEngine = require('../priceEngine');

const router = express.Router();
router.use(authenticate);

const OWNERSHIP_LABEL = { confirmed: '產權已確認', pending: '產權確認中', disputed: '產權有糾紛，需留意' };
const STATUS_LABEL = { inUse: '使用中', vacant: '閒置', seized: '查封／法拍', other: '其他' };

function getCaseOr403(req, res, data) {
  const caseItem = data.cases.find((c) => c.id === req.params.id);
  if (!caseItem) {
    res.status(404).json({ ok: false, error: '找不到該案件' });
    return null;
  }
  if (!canView(req.matchingUser, caseItem)) {
    res.status(403).json({ ok: false, error: '沒有權限檢視此案件' });
    return null;
  }
  return caseItem;
}

// GET /api/matching/cases/:id/presentation -> 買方經紀專用「銷售簡報」資料
router.get('/cases/:id/presentation', (req, res) => {
  const data = store.read();
  const caseItem = getCaseOr403(req, res, data);
  if (!caseItem) return;

  const unitPrice = caseItem.area ? Math.round(caseItem.askingPrice / caseItem.area) : null;
  const highlights = [];
  if (caseItem.ownershipStatus === 'confirmed') highlights.push('產權已完成確認，交易安全性高');
  if (caseItem.currentStatus === 'inUse') highlights.push('廠房現況使用中，可縮短進駐銜接期');
  if (caseItem.currentStatus === 'vacant') highlights.push('現況閒置，可立即規劃裝修進駐');
  if (caseItem.viewings.length > 0) highlights.push(`已累積 ${caseItem.viewings.length} 次帶看紀錄，市場關注度可供參考`);
  if (unitPrice) highlights.push(`單價約每${caseItem.unit} ${unitPrice.toLocaleString('zh-Hant-TW')} 元`);

  res.json({
    ok: true,
    presentation: {
      caseId: caseItem.id,
      title: caseItem.title,
      address: caseItem.address,
      region: caseItem.region,
      propertyType: caseItem.propertyType,
      area: caseItem.area,
      unit: caseItem.unit,
      askingPrice: caseItem.askingPrice,
      unitPrice,
      ownershipStatusLabel: OWNERSHIP_LABEL[caseItem.ownershipStatus] || caseItem.ownershipStatus,
      currentStatusLabel: STATUS_LABEL[caseItem.currentStatus] || caseItem.currentStatus,
      currentStatusNote: caseItem.currentStatusNote,
      highlights,
      viewingCount: caseItem.viewings.length,
      recentViewingNotes: caseItem.viewings
        .slice(-3)
        .reverse()
        .map((v) => ({ date: v.date, note: v.note })),
      generatedAt: new Date().toISOString()
    }
  });
});

// GET /api/matching/cases/:id/negotiation-report -> 賣方經紀專用「議價專業報告書」
router.get('/cases/:id/negotiation-report', async (req, res) => {
  const data = store.read();
  const caseItem = getCaseOr403(req, res, data);
  if (!caseItem) return;

  let priceAnalysis;
  try {
    priceAnalysis = await priceEngine.estimate(caseItem, data.cases);
  } catch (err) {
    return res.status(502).json({ ok: false, error: `實價分析失敗：${err.message}` });
  }

  const risks = [];
  const strengths = [];
  if (caseItem.ownershipStatus === 'disputed') risks.push('產權有糾紛，議價前務必先釐清並取得書面說明，降低交易風險');
  if (caseItem.ownershipStatus === 'pending') risks.push('產權尚在確認中，建議加註待確認條件於議價策略中');
  if (caseItem.ownershipStatus === 'confirmed') strengths.push('產權已確認，可作為議價時的安心保證');
  if (caseItem.currentStatus === 'seized') risks.push('現況為查封／法拍，交易流程與時程需另行評估法律風險');
  if (caseItem.currentStatus === 'inUse') strengths.push('現況使用中，顯示廠房機能與供電/消防等條件仍符合使用需求');

  let negotiationRange = null;
  if (priceAnalysis.suggestedLow != null && priceAnalysis.suggestedHigh != null) {
    negotiationRange = {
      floor: priceAnalysis.suggestedLow,
      ceiling: Math.max(priceAnalysis.suggestedHigh, caseItem.askingPrice),
      recommendedOpening: caseItem.askingPrice
    };
  }

  res.json({
    ok: true,
    report: {
      caseId: caseItem.id,
      title: caseItem.title,
      address: caseItem.address,
      askingPrice: caseItem.askingPrice,
      area: caseItem.area,
      unit: caseItem.unit,
      ownershipStatusLabel: OWNERSHIP_LABEL[caseItem.ownershipStatus] || caseItem.ownershipStatus,
      currentStatusLabel: STATUS_LABEL[caseItem.currentStatus] || caseItem.currentStatus,
      priceAnalysis,
      negotiationRange,
      strengths,
      risks,
      viewingFeedback: caseItem.viewings.map((v) => ({ date: v.date, attendee: v.attendee, note: v.note })),
      generatedAt: new Date().toISOString()
    }
  });
});

module.exports = router;
