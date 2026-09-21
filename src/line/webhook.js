const line = require('@line/bot-sdk');
const { BOTS } = require('../config/lineBots');
const db = require('../store/db');

// 每個頻道各自的 webhook，用途：
//  1. 機器人被加入群組時 (join event) 自動記錄 groupId，
//     管理者不必再手動用其他工具查詢群組 ID。
//  2. 群組成員 @機器人 打「群組ID」或「群組編號」時回覆目前的 groupId，
//     方便現場核對。
function registerWebhook(app, botKey) {
  const bot = BOTS[botKey];
  if (!bot.channelSecret) {
    console.warn(`[webhook] 頻道 ${botKey} 未設定 channelSecret，略過掛載 /webhook/${botKey}`);
    return;
  }

  const middleware = line.middleware({ channelSecret: bot.channelSecret });

  app.post(`/webhook/${botKey}`, middleware, async (req, res) => {
    const events = req.body.events || [];

    for (const event of events) {
      const groupId = event.source && (event.source.groupId || event.source.roomId);
      if (!groupId) continue;

      if (event.type === 'join') {
        recordKnownGroup(botKey, groupId);
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        const text = event.message.text.trim();
        if (text.includes('群組ID') || text.includes('群組編號')) {
          recordKnownGroup(botKey, groupId);
          const client = require('./client').getClient(botKey);
          if (client) {
            await client.replyMessage({
              replyToken: event.replyToken,
              messages: [{ type: 'text', text: `本群組 ID：\n${groupId}` }]
            });
          }
        }
      }
    }

    res.sendStatus(200);
  });

  console.log(`[webhook] 已掛載 /webhook/${botKey}（${bot.name}）`);
}

function recordKnownGroup(botKey, groupId) {
  const data = db.read();
  data.knownGroups = data.knownGroups || {};
  data.knownGroups[botKey] = data.knownGroups[botKey] || [];
  if (!data.knownGroups[botKey].includes(groupId)) {
    data.knownGroups[botKey].push(groupId);
    db.write(data);
    console.log(`[webhook] 頻道 ${botKey} 記錄到新群組 ${groupId}`);
  }
}

module.exports = { registerWebhook };
