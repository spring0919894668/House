const govOpenData = require('./govOpenData');

// 「實價合理性分析」轉接層（Adapter）。
//
// 目的：買方經紀需要判斷賣方開價是否合理、賣方經紀需要有數據支持議價，
// 兩者都需要一份「實價分析」。依優先順序嘗試三種資料來源：
//   1. PRICE_AI_ENDPOINT：自訂／第三方實價 AI 服務（未設定則略過）
//   2. GOV_PRICE_REGISTRY_ENABLED=true：內政部「實價登錄」官方開放資料
//      （見 src/matching/priceEngine/govOpenData.js，抓取官方批次資料，
//      篩出同縣市、廠房／工業用的比較案例）
//   3. 都沒有資料或查詢失敗時，退回「同地區、同類型」的系統內部案件與
//      手動輸入比較案例試算，讓功能在尚未接上正式服務前也能先跑起來。
//
// 要換成其他正式服務，只需在 .env 設定 PRICE_AI_ENDPOINT（與可選的
// PRICE_AI_API_KEY），並確保該服務回傳下列格式即可，其餘程式碼不需更動：
//   { suggestedLow, suggestedHigh, avgUnitPrice, comparables: [...], source, note }

async function estimate(caseItem, allCases) {
  const endpoint = process.env.PRICE_AI_ENDPOINT;
  if (endpoint) {
    return callExternalPriceAI(caseItem, endpoint);
  }

  if (process.env.GOV_PRICE_REGISTRY_ENABLED === 'true') {
    try {
      return await govOpenData.estimateFromGovData(caseItem);
    } catch (err) {
      console.warn(`[priceEngine] 實價登錄開放資料查詢失敗，改用內部比較案例試算：${err.message}`);
    }
  }

  return localEstimate(caseItem, allCases);
}

async function callExternalPriceAI(caseItem, endpoint) {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.PRICE_AI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.PRICE_AI_API_KEY}`;
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      address: caseItem.address,
      region: caseItem.region,
      propertyType: caseItem.propertyType,
      area: caseItem.area,
      askingPrice: caseItem.askingPrice
    })
  });
  if (!res.ok) {
    throw new Error(`實價 AI 服務回應異常（HTTP ${res.status}）`);
  }
  const result = await res.json();
  return { source: 'external-ai', ...result };
}

function localEstimate(caseItem, allCases) {
  const manualComparables = (caseItem.comparables || []).map((c) => ({
    label: c.note || c.date || '手動輸入比較案例',
    unitPrice: c.area ? c.price / c.area : null,
    area: c.area,
    price: c.price
  })).filter((c) => c.unitPrice);

  const systemComparables = allCases
    .filter(
      (c) =>
        c.id !== caseItem.id &&
        c.region &&
        c.region === caseItem.region &&
        c.propertyType === caseItem.propertyType &&
        c.askingPrice &&
        c.area
    )
    .map((c) => ({
      label: c.title,
      unitPrice: c.askingPrice / c.area,
      area: c.area,
      price: c.askingPrice
    }));

  const comparables = [...manualComparables, ...systemComparables];

  if (comparables.length === 0 || !caseItem.area) {
    return {
      suggestedLow: null,
      suggestedHigh: null,
      avgUnitPrice: null,
      comparables: [],
      source: 'local-fallback',
      note: '目前系統內尚無同地區、同類型案件或比較案例可供試算，建議手動新增比較案例，或於 .env 設定 PRICE_AI_ENDPOINT 串接正式實價服務。'
    };
  }

  const unitPrices = comparables.map((c) => c.unitPrice).sort((a, b) => a - b);
  const avgUnitPrice = unitPrices.reduce((sum, v) => sum + v, 0) / unitPrices.length;
  const lowUnitPrice = unitPrices[0];
  const highUnitPrice = unitPrices[unitPrices.length - 1];

  return {
    suggestedLow: Math.round(lowUnitPrice * caseItem.area),
    suggestedHigh: Math.round(highUnitPrice * caseItem.area),
    avgUnitPrice: Math.round(avgUnitPrice),
    comparables,
    source: 'local-estimate',
    note: '此為系統依內部比較案例試算之區間，僅供參考，正式議價報告建議搭配實價登入查詢結果交叉確認。'
  };
}

module.exports = { estimate };
