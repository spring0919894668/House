const fs = require('fs');
const path = require('path');

// 簡易 JSON 檔案資料庫（避免額外原生模組相依，方便直接部署）。
// 若未來新聞量與群組數變大，可平行替換成 SQLite / PostgreSQL，
// 只要保留這裡輸出的函式介面即可。

// DATA_DIR 可用環境變數覆寫，方便掛載雲端平台（如 Render）的持久化磁碟，
// 避免每次重新部署或容器重啟就把新聞/排程/發文紀錄清空。
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
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
  postLogs: [] // { id, botKey, newsId, groupId, status, timestamp, error }
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
