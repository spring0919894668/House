# 房地產新聞 LINE 自動發文助理

給管理 100+ 個房地產相關 LINE 群組使用的新聞蒐集 + 自動發文系統。
系統會定期從新聞來源蒐集房地產相關新聞、依關鍵字自動分成 4 大類，
管理者在後台勾選要發布的新聞後，由 **4 個獨立的 LINE 官方帳號**
在設定的時間自動發到指定群組。

---

## 一、新聞蒐集的 4 大方向

| 代碼 | 分類 | 範圍 | 對應頻道 |
|---|---|---|---|
| A | 土地利用相關 | 都市計畫變更、產業園區、工廠立體化等政府法規 | 土地法規小助理 |
| B | 建築營造相關 | 建設、代銷、房仲、包租代管、法拍等市場觀察 | 建築市場小助理 |
| C | 房地產應用相關 | AI 應用、ESG、綠建築、綠建材等 | 房地產科技小助理 |
| D | 其他房地產相關 | 法規、稅務、政策、補助等市場新聞 | 稅務政策小助理 |

分類定義與關鍵字集中在 `src/config/categories.js`，可依實際新聞用語隨時增減。
新聞來源清單在 `src/config/sources.js`（RSS 為主），分類邏輯在
`src/news/classifier.js`：

1. 對每篇新聞的標題＋摘要，逐分類計算關鍵字命中次數。
2. 命中最多次的分類勝出，並附上信心分數（命中次數）。
3. 若所有分類都是 0 分，退回該新聞來源預設的分類；仍無法判斷則歸類到 D，
   等待人工在後台複核、手動改分類。

> **重要提醒**：`sources.js` 內目前列的是幾個常見的內政部／房地產新聞網 RSS
> 網址，僅作為起點。實際部署時請逐一確認網址是否仍然有效（新聞網站常改版），
> 也建議加入貴公司/聯盟現有的新聞來源。系統對抓取失敗的來源會直接跳過並記
> 錄錯誤，不會讓整個排程掛掉。

### 新聞如何被抓進系統

- 排程（或手動按下後台「立即抓新聞」）呼叫 `src/news/fetcher.js`
- 逐一讀取 `sources.js` 內的 RSS，解析後做分類，用「連結網址」算出唯一
  ID 避免重複
- 寫入 `data/db.json` 的 `news` 陣列，狀態預設為 `pending`（尚未勾選）

---

## 二、4 個 LINE 助理的設計

### 為什麼是 4 個帳號，而不是 1 個帳號管全部群組？

1. **推播用量分開算**：LINE Messaging API 的每月推播則數是以「頻道」計算，
   100+ 群組如果全部塞進同一頻道，很容易撞到用量上限，也難以只針對某類
   新聞控管發送量。
2. **群組可以自由訂閱主題**：例如某些房仲群組只想收「法拍/市場」新聞
   （頻道 B），不想收「土地法規」（頻道 A），拆開後由群組管理員自行決定
   要邀請哪幾個機器人加入，不需要在同一帳號裡做訊息篩選。
3. **故障隔離**：任一頻道 Token 過期或被停權，只影響該分類的發文，其他
   3 個分類仍正常運作。

### 4 個助理

| 頻道代碼 | 預設名稱 | 對應分類 |
|---|---|---|
| A | 土地法規小助理 | A. 土地利用相關 |
| B | 建築市場小助理 | B. 建築營造相關 |
| C | 房地產科技小助理 | C. 房地產應用相關 |
| D | 稅務政策小助理 | D. 其他（法規/稅務/政策/補助） |

每個頻道各自對應一組 LINE Developers 的 Channel access token / Channel
secret（見 `.env.example`），互不相干。

### 後台可以做什麼

打開 `public/index.html`（伺服器啟動後即 `http://localhost:3000`）：

1. **上方分類頁籤**：切換看 A/B/C/D 或全部新聞。
2. **新聞卡片**：每則新聞下方有 4 個核取方塊（推 A / 推 B / 推 C / 推 D），
   同一則新聞也可以同時勾給多個頻道（例如同時符合建築與稅務時事）。
   勾選後新聞狀態自動變成「已勾選待發」。
3. **右側 4 張頻道卡片**：
   - 開關「啟用每日自動發文」
   - 設定每天固定發文時間（例如 A 頻道 09:00、B 頻道 09:30…錯開避免洗版）
   - 貼上該頻道要發送的目標群組 ID（一行一個）
   - 「立即依目前勾選發送」：不等排程，馬上把目前勾選好、狀態為
     「已勾選待發」的新聞發到目標群組，方便測試

### 怎麼取得 100+ 個群組的群組 ID？

LINE 官方帳號沒有主動列出「我在哪些群組」的 API，因此系統用 Webhook
自動記錄：

1. 把對應分類的機器人加入群組後，系統會在後台「已知群組」清單自動記下
   `groupId`（`join` 事件）。
2. 也可以在群組內 @機器人 輸入「群組ID」，機器人會回覆目前群組的 ID，
   方便核對。
3. 管理者從「已知群組」清單複製需要的 ID，貼進右側對應頻道的「目標群組」
   欄位再儲存。

### 發文格式

系統用 LINE Flex Message 排版每則新聞（標題、摘要、來源、「閱讀全文」按
鈕），比純文字更適合被群組快速略過或點入閱讀，且不會像一般連結分享一樣
每次樣式不一致，見 `src/line/client.js` 的 `buildFlexMessage`。

---

## 三、系統架構

```
排程 / 手動觸發
      │
      ▼
news/fetcher.js  ──▶  news/classifier.js  ──▶  data/db.json (news[])
                                                       │
                                     後台勾選 selectedForBot.{A,B,C,D}
                                                       │
                                                       ▼
scheduler/index.js（node-cron，4 條各自的排程）
                                                       │
                                                       ▼
line/client.js（4 個 LINE Messaging API Client，各自 push 到設定的群組）
                                                       │
                                                       ▼
data/db.json (postLogs[])  ← 每次發送成功/失敗都會記錄，供後台除錯
```

---

## 四、安裝與啟動

```bash
npm install
cp .env.example .env
# 編輯 .env，填入 4 個 LINE 頻道各自的 Channel access token / Channel secret
npm start
```

啟動後：

- 後台網頁：`http://localhost:3000`
- 健康檢查：`GET /healthz`
- 4 個頻道各自的 Webhook：`POST /webhook/A`、`/webhook/B`、`/webhook/C`、`/webhook/D`
  （需在 LINE Developers Console 的 Messaging API 設定頁填入對外可存取的網址，
  例如 `https://your-domain.com/webhook/A`）

### 保護後台 API

`.env` 中的 `ADMIN_TOKEN` 用來保護 `/api/*`，前端會把它存在瀏覽器
localStorage，之後每次呼叫 API 都會帶 `Authorization: Bearer <token>`。
正式上線務必設定一組夠長的隨機字串，並透過 HTTPS 提供服務。

### 定期抓新聞

`fetcher.js` 可獨立執行：

```bash
npm run fetch:news
```

建議用系統排程（cron、GitHub Actions、雲端排程器等）每 30–60 分鐘打一次
`POST /api/news/fetch`，或直接排程執行 `npm run fetch:news`。

---

## 五、目錄結構

```
src/
  config/
    categories.js   # 4 大分類與關鍵字
    sources.js       # 新聞 RSS 來源清單
    lineBots.js       # 4 個 LINE 頻道設定（讀 .env）
  news/
    fetcher.js        # 抓 RSS + 分類 + 寫入資料庫
    classifier.js      # 關鍵字比對分類邏輯
  line/
    client.js          # LINE 推播（Flex Message）
    webhook.js          # 4 個頻道各自的 Webhook（記錄群組 ID）
  scheduler/
    index.js            # node-cron 排程，依 4 個頻道各自的時間發文
  routes/
    news.js              # 新聞查詢／勾選／改分類 API
    schedule.js            # 排程與群組設定 API
  store/
    db.js                  # 簡易 JSON 檔案資料庫
  server.js                # Express 進入點
public/                     # 後台管理網頁（純 HTML/CSS/JS，無框架）
data/db.json                 # 執行期資料（新聞、排程設定、發文紀錄）
```

## 六、可以延伸的方向

- 目前的資料庫是單一 JSON 檔，適合單機/小規模使用；群組與新聞量再擴大，
  建議換成 PostgreSQL/SQLite，只需替換 `store/db.js` 的實作。
- 目前的自動分類只用關鍵字比對，可以之後接上 LLM 做語意分類與自動摘要，
  取代目前 300 字截斷摘要。
- 目前群組設定是「一個頻道對多個群組」統一發同樣的新聞；若要做到「某些
  群組只要某類新聞裡的一部分」，可以在 `schedules` 內把 `groupIds`
  換成「群組 → 訂閱分類/關鍵字」的對照表。
