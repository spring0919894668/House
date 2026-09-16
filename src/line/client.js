const line = require('@line/bot-sdk');
const { BOTS, isConfigured } = require('../config/lineBots');

const clients = {};

function getClient(botKey) {
  if (!isConfigured(botKey)) return null;
  if (!clients[botKey]) {
    const bot = BOTS[botKey];
    clients[botKey] = new line.messagingApi.MessagingApiClient({
      channelAccessToken: bot.channelAccessToken
    });
  }
  return clients[botKey];
}

function buildFlexMessage(newsItem) {
  return {
    type: 'flex',
    altText: newsItem.title,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: newsItem.title, weight: 'bold', wrap: true, size: 'md' },
          {
            type: 'text',
            text: newsItem.summary || '',
            wrap: true,
            size: 'sm',
            color: '#666666'
          },
          {
            type: 'text',
            text: `來源：${newsItem.source}`,
            size: 'xs',
            color: '#999999',
            margin: 'md'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: { type: 'uri', label: '閱讀全文', uri: newsItem.link || 'https://line.me' }
          }
        ]
      }
    }
  };
}

// 推播單則新聞到指定 botKey 的多個群組。
// 回傳每個群組的成功/失敗結果，供後台記錄 postLogs 使用。
async function pushNewsToGroups(botKey, newsItem, groupIds) {
  const client = getClient(botKey);
  if (!client) {
    return groupIds.map((groupId) => ({
      groupId,
      status: 'error',
      error: `頻道 ${botKey} 尚未設定 channelAccessToken`
    }));
  }

  const message = buildFlexMessage(newsItem);
  const results = [];

  for (const groupId of groupIds) {
    try {
      await client.pushMessage({ to: groupId, messages: [message] });
      results.push({ groupId, status: 'ok' });
    } catch (err) {
      results.push({
        groupId,
        status: 'error',
        error: err?.originalError?.response?.data?.message || err.message
      });
    }
  }

  return results;
}

module.exports = { getClient, buildFlexMessage, pushNewsToGroups };
