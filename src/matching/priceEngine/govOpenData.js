const AdmZip = require('adm-zip');

// 串接內政部「不動產成交案件實際資訊資料供應系統」的官方開放資料。
//
// 這個資料集沒有提供「輸入地址查一筆」的即時 API，官方只提供整包批次下載
// （全國、每 10 天更新一次的 ZIP，內含每個縣市各自的買賣/租賃/預售屋 CSV）。
// 因此這裡的做法跟坊間查價網站一樣：定期下載整包 ZIP、解壓出目標縣市的
// 「不動產買賣」CSV、篩選出廠房／工業用類型與同鄉鎮市區的實際案例，再算出
// 可比較的單價區間。下載結果會依縣市快取一段時間（見 GOV_PRICE_REGISTRY_CACHE_HOURS），
// 避免每次查價都重新下載整包資料。
//
// 注意：本模組在建置這個功能的沙盒環境中，因網路出口政策封鎖
// plvr.land.moi.gov.tw／data.gov.tw，無法實際連線驗證下載與欄位格式，
// 邏輯是依內政部長期公開、穩定的 CSV 欄位規格與縣市代碼撰寫。正式部署（能
// 連上內政部網站的環境）啟用 GOV_PRICE_REGISTRY_ENABLED 後，請先實際跑一次
// 確認能正確下載與解析；解析失敗時會拋出錯誤並由呼叫端自動退回內部比較
// 案例試算，不會讓服務掛掉，但仍建議實際驗證一次。

const DEFAULT_URL = 'https://plvr.land.moi.gov.tw/Download?fileName=lvr_landcsv.zip&type=zip';

// 內政部實價登錄批次資料的縣市代碼（檔名前綴），長期沿用、格式穩定。
// 依「地址/地區」字串比對時，先比對較長、較具體的縣市名稱，避免
// 「新竹市」被「新竹縣」的比對邏輯誤判（下方陣列已依此順序排列）。
const CITY_PREFIX_MAP = [
  ['台北市', 'a'], ['臺北市', 'a'],
  ['台中市', 'b'], ['臺中市', 'b'],
  ['基隆市', 'c'],
  ['台南市', 'd'], ['臺南市', 'd'],
  ['高雄市', 'e'],
  ['新北市', 'f'],
  ['宜蘭縣', 'g'],
  ['桃園市', 'h'], ['桃園縣', 'h'],
  ['嘉義市', 'i'],
  ['新竹縣', 'j'],
  ['苗栗縣', 'k'],
  ['南投縣', 'm'],
  ['彰化縣', 'n'],
  ['新竹市', 'o'],
  ['雲林縣', 'p'],
  ['嘉義縣', 'q'],
  ['屏東縣', 't'],
  ['花蓮縣', 'u'],
  ['台東縣', 'v'], ['臺東縣', 'v'],
  ['金門縣', 'w'],
  ['澎湖縣', 'x'],
  ['連江縣', 'z']
];

// 使用者輸入的地區常常是口語省略「市/縣」的寫法（例如「桃園觀音」「台中大雅」），
// 因此比對時先試完整縣市名稱，找不到再退回去掉「市/縣」的簡稱比對一次。
// 「新竹」「嘉義」同時有市與縣，簡稱比對時無法分辨，這裡明確預設對應到市（較常見
// 的口語指稱對象）；若要查詢新竹縣/嘉義縣的案件，請在地區欄位完整輸入「新竹縣」
// 「嘉義縣」。
const BARE_NAME_FALLBACK = [
  ['台北', 'a'], ['臺北', 'a'],
  ['台中', 'b'], ['臺中', 'b'],
  ['基隆', 'c'],
  ['台南', 'd'], ['臺南', 'd'],
  ['高雄', 'e'],
  ['新北', 'f'],
  ['宜蘭', 'g'],
  ['桃園', 'h'],
  ['新竹', 'o'], // 新竹市／新竹縣皆有，預設市
  ['苗栗', 'k'],
  ['南投', 'm'],
  ['彰化', 'n'],
  ['雲林', 'p'],
  ['嘉義', 'i'], // 嘉義市／嘉義縣皆有，預設市
  ['屏東', 't'],
  ['花蓮', 'u'],
  ['台東', 'v'], ['臺東', 'v'],
  ['金門', 'w'],
  ['澎湖', 'x'],
  ['連江', 'z']
];

function guessCityCode(regionText) {
  if (!regionText) return null;
  for (const [name, code] of CITY_PREFIX_MAP) {
    if (regionText.includes(name)) return code;
  }
  for (const [name, code] of BARE_NAME_FALLBACK) {
    if (regionText.includes(name)) return code;
  }
  return null;
}

// 解析一行 CSV（處理雙引號包住、內含逗號的欄位），官方資料本身沒有換行在
// 欄位內的情況，因此不需要處理跨行欄位。
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

// 官方 CSV 第一行是中文欄名、第二行是對應的英文代碼，資料從第三行開始。
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 3) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(2).map((line) => parseCsvLine(line));
  return { headers, rows };
}

// 依常見欄名找出索引，容忍官方偶爾出現的欄名差異（例如有無「總」/「总」簡繁差異）。
function findColumnIndex(headers, candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

const SQM_PER_PING = 3.305785; // 1 坪 = 3.305785 平方公尺

async function downloadCountyCsv(countyCode) {
  const url = process.env.GOV_PRICE_REGISTRY_URL || DEFAULT_URL;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下載實價登錄開放資料失敗（HTTP ${res.status}）`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entry = zip
    .getEntries()
    .find((e) => new RegExp(`^${countyCode}_lvr_land_a\\.csv$`, 'i').test(e.entryName));
  if (!entry) {
    throw new Error(`開放資料 ZIP 內找不到縣市代碼 "${countyCode}" 的不動產買賣 CSV`);
  }
  return entry.getData().toString('utf8');
}

const cache = new Map(); // countyCode -> { fetchedAt, headers, rows }

async function getCountyRows(countyCode) {
  const cacheHours = Number(process.env.GOV_PRICE_REGISTRY_CACHE_HOURS) || 12;
  const cached = cache.get(countyCode);
  if (cached && Date.now() - cached.fetchedAt < cacheHours * 60 * 60 * 1000) {
    return cached;
  }
  const csvText = await downloadCountyCsv(countyCode);
  const { headers, rows } = parseCsv(csvText);
  const entry = { fetchedAt: Date.now(), headers, rows };
  cache.set(countyCode, entry);
  return entry;
}

// 從一個縣市的原始交易列中，篩出「廠房／工業用」且鄉鎮市區與案件地區相符的案例，
// 換算成與內部比較案例相同的格式：{ label, unitPrice, area, price }
function extractIndustrialComparables(headers, rows, regionText, unit) {
  const idx = {
    district: findColumnIndex(headers, ['鄉鎮市區']),
    buildingType: findColumnIndex(headers, ['建物型態']),
    mainUse: findColumnIndex(headers, ['主要用途']),
    totalPrice: findColumnIndex(headers, ['總價元', '总价元']),
    area: findColumnIndex(headers, ['建物移轉總面積平方公尺', '建物移转总面积平方公尺']),
    date: findColumnIndex(headers, ['交易年月日'])
  };
  if (idx.totalPrice === -1 || idx.area === -1) {
    throw new Error('CSV 欄位格式與預期不符（找不到總價或面積欄位），可能是官方格式已變更');
  }

  const isPing = (unit || '').includes('坪');
  const comparables = [];

  for (const row of rows) {
    const buildingType = idx.buildingType !== -1 ? row[idx.buildingType] || '' : '';
    const mainUse = idx.mainUse !== -1 ? row[idx.mainUse] || '' : '';
    const isIndustrial = buildingType.includes('廠') || mainUse.includes('工業') || mainUse.includes('廠');
    if (!isIndustrial) continue;

    if (regionText) {
      const district = idx.district !== -1 ? row[idx.district] || '' : '';
      if (district && !regionText.includes(district) && !district.includes(regionText)) continue;
    }

    const totalPrice = Number(row[idx.totalPrice]);
    const areaSqm = Number(row[idx.area]);
    if (!totalPrice || !areaSqm) continue;

    const areaInCaseUnit = isPing ? areaSqm / SQM_PER_PING : areaSqm;
    comparables.push({
      label: `實價登入・${idx.district !== -1 ? row[idx.district] : ''}${idx.date !== -1 ? '・' + row[idx.date] : ''}`,
      unitPrice: totalPrice / areaInCaseUnit,
      area: areaInCaseUnit,
      price: totalPrice
    });
  }

  return comparables;
}

// 主要對外函式：回傳與 priceEngine 其他資料源相同格式的估價結果，
// 找不到可比較案例、縣市代碼判斷失敗、下載或解析出錯都會丟出例外，
// 由呼叫端（src/matching/priceEngine/index.js）接住並退回本地試算。
async function estimateFromGovData(caseItem) {
  const countyCode = guessCityCode(caseItem.region) || guessCityCode(caseItem.address);
  if (!countyCode) {
    throw new Error(`無法從地區「${caseItem.region || caseItem.address}」判斷縣市，略過實價登入查詢`);
  }

  const { headers, rows } = await getCountyRows(countyCode);
  const comparables = extractIndustrialComparables(headers, rows, caseItem.region, caseItem.unit);

  if (comparables.length === 0) {
    throw new Error('實價登入資料中找不到同縣市、廠房／工業用的比較案例');
  }

  const unitPrices = comparables.map((c) => c.unitPrice).sort((a, b) => a - b);
  const avgUnitPrice = unitPrices.reduce((sum, v) => sum + v, 0) / unitPrices.length;

  return {
    suggestedLow: caseItem.area ? Math.round(unitPrices[0] * caseItem.area) : null,
    suggestedHigh: caseItem.area ? Math.round(unitPrices[unitPrices.length - 1] * caseItem.area) : null,
    avgUnitPrice: Math.round(avgUnitPrice),
    comparables: comparables.slice(0, 20),
    source: 'gov-open-data',
    note: `依內政部實價登錄開放資料（不動產買賣批次資料）中 ${comparables.length} 筆同縣市廠房／工業用比較案例試算。`
  };
}

module.exports = { estimateFromGovData, guessCityCode, parseCsv, parseCsvLine, extractIndustrialComparables };
