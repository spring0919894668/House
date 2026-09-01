# Cloudflare Pages 部署（買方客需看板 Demo）

`buyer-board-demo/` 是「相信共好大聯盟買方客需媒合看板」的**純前端示範版**：單一
`index.html`，沒有任何後端 API，資料靠瀏覽器 `localStorage` 模擬（每個訪客看到的
都是自己瀏覽器裡的資料，彼此不互通）。適合快速部署給大家點開測試操作流程與介面，
但不能拿來當作正式多人共用的媒合看板——那個版本是專案根目錄的 `src/` + `public/`
（Node.js/Express + API），需要能跑 Node 常駐服務的地方（例如一般 VM、Render、
Railway 等），Cloudflare Pages/Workers 目前不直接支援。

## 部署步驟（由你自己執行，需要你的 Cloudflare 帳號登入）

需要 Node.js 18+ 與網路連線。在專案根目錄執行：

```bash
# 1. 登入你的 Cloudflare 帳號（會開瀏覽器做 OAuth 授權）
npx wrangler login

# 2. 部署 buyer-board-demo 這個資料夾到 Cloudflare Pages
#    第一次執行會詢問要建立新的 Pages 專案，之後同一個 --project-name 都會更新到同一個網址
npx wrangler pages deploy cf-pages/buyer-board-demo --project-name=cohou-buyer-board-demo
```

部署完成後，終端機會印出網址，格式類似：

```
https://cohou-buyer-board-demo.pages.dev
```

之後每次要更新內容（例如改了 `cf-pages/buyer-board-demo/index.html`），重新執行
第 2 步的 `wrangler pages deploy` 指令即可覆蓋更新，網址不會變。

## 之後想接自訂網域

Cloudflare Dashboard → Workers & Pages → 選到 `cohou-buyer-board-demo` 專案 →
「Custom domains」加你自己在 Cloudflare 管理的網域即可，不需要改程式碼。

## 之後想做成真正多人共用的版本

如果之後想讓所有房仲看到同一份總表（而不是各自瀏覽器各自一份 demo 資料），有兩個
方向：

1. **維持現有 Node.js/Express 後端**，另外找一個可以跑常駐 Node 服務的平台部署
   （例如 Render、Railway、Fly.io，或自己的 VM），Cloudflare Pages 只放前端頁面，
   API 呼叫指到那個後端網址即可，不需要重寫任何後端邏輯。
2. **改寫成 Cloudflare Workers**：把 `src/routes/*.js` 的邏輯搬進 Workers（可用
   [Hono](https://hono.dev/) 這類 Workers 友善的框架取代 Express），JSON 檔案資料庫
   換成 [Cloudflare D1](https://developers.cloudflare.com/d1/)（SQL 資料庫），
   `node-cron` 排程換成 [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)。
   這是一次不小的重構，但可以讓整個服務（含 LINE 新聞助理）都跑在 Cloudflare 上、
   不需要另外租主機。

兩者都可以做，看你要不要換掉現有主機，還是想全部收斂到 Cloudflare 一個平台上。
