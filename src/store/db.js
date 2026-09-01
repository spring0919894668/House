const fs = require('fs');
const path = require('path');

// 簡易 JSON 檔案資料庫（避免額外原生模組相依，方便直接部署）。
// 若未來新聞量與群組數變大，可平行替換成 SQLite / PostgreSQL，
// 只要保留這裡輸出的函式介面即可。

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  news: [], // { id, category, title, link, source, summary, publishedAt, fetchedAt, status: 'pending'|'selected'|'posted'|'rejected', selectedForBot: {A:false,...} }
  schedules: {
    // botKey -> { enabled, time: 'HH:mm', groupIds: [], timezone }
    A: { enabled: false, time: '09:00', groupIds: [], timezone: 'Asia/Taipei' },
    B: { enabled: false, time: '09:30', groupIds: [], timezone: 'Asia/Taipei' },
    C: { enabled: false, time: '10:00', groupIds: [], timezone: 'Asia/Taipei' },
    D: { enabled: false, time: '10:30', groupIds: [], timezone: 'Asia/Taipei' }
  },
  postLogs: [], // { id, botKey, newsId, groupId, status, timestamp, error }

  // 買方客需媒合看板（見 docs/buyer-demand-board.md）
  buyerRequests: [], // { id, agentBrand, agentPhone, agentLine, clientCode, district, propertyType, budgetMin, budgetMax, conditions, remark, status: 'published'|'hidden', createdAt, updatedAt }
  ads: [], // { id, title, imageUrl, linkUrl, sponsor, position, startDate, endDate, paidStatus: 'paid'|'unpaid', status: 'active'|'inactive', impressions, clicks, createdAt }
  phoneVerifications: [] // { phone, codeHash, expiresAt, attempts, lastSentAt, verified, verifiedUntil }
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function read() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('[db] JSON 解析失敗，回復為預設資料', err);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function write(data) {
  ensureFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { read, write };
