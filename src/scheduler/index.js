const cron = require('node-cron');
const db = require('../store/db');
const { pushNewsToGroups } = require('../line/client');

const jobs = {}; // botKey -> cron task

function timeToCron(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${m} ${h} * * *`; // 每天固定時間
}

// enabled 只用來控制「是否加入每日排程」（見 reload()）；
// 手動觸發（/run-now）刻意不檢查 enabled，方便管理者先測試發送效果
// 再決定要不要開啟自動排程。
async function runBotPost(botKey) {
  const data = db.read();
  const schedule = data.schedules[botKey];
  if (!schedule) return;
  if (!schedule.groupIds || schedule.groupIds.length === 0) {
    console.warn(`[scheduler] 頻道 ${botKey} 尚未設定任何群組，略過本次發文`);
    return;
  }

  const toPost = data.news.filter(
    (n) => n.selectedForBot?.[botKey] && n.status === 'selected'
  );

  if (toPost.length === 0) {
    console.log(`[scheduler] 頻道 ${botKey} 本次沒有已勾選待發布的新聞`);
    return;
  }

  for (const newsItem of toPost) {
    const results = await pushNewsToGroups(botKey, newsItem, schedule.groupIds);
    const now = new Date().toISOString();

    for (const r of results) {
      data.postLogs.unshift({
        id: `${newsItem.id}-${botKey}-${r.groupId}-${Date.now()}`,
        botKey,
        newsId: newsItem.id,
        groupId: r.groupId,
        status: r.status,
        error: r.error || null,
        timestamp: now
      });
    }

    const anyOk = results.some((r) => r.status === 'ok');
    const newsRef = data.news.find((n) => n.id === newsItem.id);
    if (newsRef) newsRef.status = anyOk ? 'posted' : 'failed';
  }

  data.postLogs = data.postLogs.slice(0, 2000);
  db.write(data);
  console.log(`[scheduler] 頻道 ${botKey} 已發送 ${toPost.length} 則新聞`);
}

function reload() {
  for (const key of Object.keys(jobs)) {
    jobs[key].stop();
    delete jobs[key];
  }

  const data = db.read();
  for (const [botKey, schedule] of Object.entries(data.schedules)) {
    if (!schedule.enabled) continue;
    const cronExpr = timeToCron(schedule.time);
    jobs[botKey] = cron.schedule(cronExpr, () => runBotPost(botKey), {
      timezone: schedule.timezone || 'Asia/Taipei'
    });
    console.log(`[scheduler] 頻道 ${botKey} 已排程：每天 ${schedule.time} (${schedule.timezone})`);
  }
}

module.exports = { reload, runBotPost };
