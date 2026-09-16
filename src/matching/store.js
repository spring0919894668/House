const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 案件媒合社群的簡易 JSON 檔案資料庫，獨立於新聞系統的 data/db.json，
// 沿用同樣的「檔案資料庫」設計（見 src/store/db.js），未來要換成
// SQLite/PostgreSQL 時只需替換這個檔案的實作。

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'matching-db.json');

const DEFAULT_DATA = {
  // 使用者（同事／經紀人）
  users: [], // { id, name, email, role:'admin'|'broker', agentType:'buyer'|'seller'|'both',
             //   token, active, createdAt }

  // 案件（工業廠房物件）
  cases: [], // { id, title, address, region, propertyType, area, unit:'坪',
             //   askingPrice, ownerName, ownerContact,
             //   ownershipStatus:'confirmed'|'pending'|'disputed', ownershipNote,
             //   currentStatus:'inUse'|'vacant'|'seized'|'other', currentStatusNote,
             //   viewings: [{ id, date, agentId, attendee, note, createdAt }],
             //   comparables: [{ id, date, price, area, note }],
             //   visibility: 'private'|'team',
             //   members: [{ userId, permission:'view'|'edit' }],
             //   createdBy, createdAt, updatedAt }

  comments: [], // { id, caseId, authorId, content, createdAt }

  buyerNeeds: [], // { id, title, requirement:{ propertyType, region, minArea, maxBudget, note },
                  //   createdBy, status:'open'|'matched'|'closed', createdAt }

  referrals: [], // { id, buyerNeedId, caseId, recommendedBy, note,
                 //   status:'pending'|'accepted'|'rejected', createdAt }

  feedback: [] // { id, authorId, page, rating, content, status:'new'|'reviewed', createdAt }
                // 讓實際試用的同事在畫面上直接回報問題／建議，供管理者集中檢視。
};

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = JSON.parse(JSON.stringify(DEFAULT_DATA));
    seedAdmin(initial);
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
}

// 第一次啟動時自動建立一組管理者帳號，方便建置後立即登入設定其他同事權限。
function seedAdmin(data) {
  const token = process.env.MATCHING_ADMIN_TOKEN || crypto.randomBytes(24).toString('hex');
  const admin = {
    id: crypto.randomUUID(),
    name: process.env.MATCHING_ADMIN_NAME || '系統管理者',
    email: process.env.MATCHING_ADMIN_EMAIL || '',
    role: 'admin',
    agentType: 'both',
    token,
    active: true,
    createdAt: new Date().toISOString()
  };
  data.users.push(admin);
  if (!process.env.MATCHING_ADMIN_TOKEN) {
    console.log('====================================================');
    console.log('[案件媒合] 已自動建立管理者帳號，請妥善保存以下登入權杖：');
    console.log(`  帳號名稱：${admin.name}`);
    console.log(`  存取權杖：${token}`);
    console.log('  （之後可在 .env 設定 MATCHING_ADMIN_TOKEN 固定此權杖）');
    console.log('====================================================');
  }
  return admin;
}

// 讓既有的 matching-db.json（可能是舊版、缺少新欄位）在讀取時自動補上
// DEFAULT_DATA 裡新增的頂層欄位，避免升級後因為某個集合是 undefined 而壞掉。
function backfillDefaults(data) {
  for (const key of Object.keys(DEFAULT_DATA)) {
    if (!(key in data)) data[key] = JSON.parse(JSON.stringify(DEFAULT_DATA[key]));
  }
  return data;
}

function read() {
  ensureFile();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    return backfillDefaults(JSON.parse(raw));
  } catch (err) {
    console.error('[matching-db] JSON 解析失敗，回復為預設資料', err);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function write(data) {
  ensureFile();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { read, write };
