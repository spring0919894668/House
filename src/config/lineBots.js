require('dotenv').config();

// 4 個 LINE 官方帳號（頻道），一個分類一個頻道。
// 這樣設計的原因：
//  1. LINE Messaging API 的免費 / 各方案每月推播則數是「以頻道」計算，
//     100+ 群組全部塞進同一個頻道容易撞到用量上限。
//  2. 不同房仲/建設公司群組通常只想訂閱特定主題（例如只要法規、
//     不要包租代管廣告），拆成 4 個帳號可以讓群組管理者自由選擇要加哪幾個。
//  3. 分開後，每個頻道的 Webhook 也各自獨立，方便除錯與停用單一分類。

const BOTS = {
  A: {
    key: 'A',
    name: process.env.LINE_BOT_A_NAME || '土地法規小助理',
    channelAccessToken: process.env.LINE_BOT_A_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_BOT_A_CHANNEL_SECRET || ''
  },
  B: {
    key: 'B',
    name: process.env.LINE_BOT_B_NAME || '建築市場小助理',
    channelAccessToken: process.env.LINE_BOT_B_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_BOT_B_CHANNEL_SECRET || ''
  },
  C: {
    key: 'C',
    name: process.env.LINE_BOT_C_NAME || '房地產科技小助理',
    channelAccessToken: process.env.LINE_BOT_C_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_BOT_C_CHANNEL_SECRET || ''
  },
  D: {
    key: 'D',
    name: process.env.LINE_BOT_D_NAME || '稅務政策小助理',
    channelAccessToken: process.env.LINE_BOT_D_CHANNEL_ACCESS_TOKEN || '',
    channelSecret: process.env.LINE_BOT_D_CHANNEL_SECRET || ''
  }
};

function isConfigured(botKey) {
  const bot = BOTS[botKey];
  return Boolean(bot && bot.channelAccessToken && bot.channelSecret);
}

module.exports = { BOTS, isConfigured };
