const express = require('express');
const db = require('../store/db');
const scheduler = require('../scheduler');
const { runBotPost } = require('../scheduler');
const { BOTS, isConfigured } = require('../config/lineBots');

const router = express.Router();

// GET /api/schedules -> 4 個頻道目前的排程與群組設定 + 已知群組清單
router.get('/', (req, res) => {
  const data = db.read();
  const bots = Object.fromEntries(
    Object.entries(BOTS).map(([key, bot]) => [
      key,
      { name: bot.name, configured: isConfigured(key) }
    ])
  );
  res.json({
    bots,
    schedules: data.schedules,
    knownGroups: data.knownGroups || {}
  });
});

// PUT /api/schedules/:botKey  { enabled, time, groupIds, timezone }
router.put('/:botKey', (req, res) => {
  const botKey = req.params.botKey;
  const data = db.read();
  if (!data.schedules[botKey]) {
    return res.status(400).json({ ok: false, error: '不存在的頻道代碼，請用 A/B/C/D' });
  }

  const { enabled, time, groupIds, timezone } = req.body;
  if (typeof enabled === 'boolean') data.schedules[botKey].enabled = enabled;
  if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) data.schedules[botKey].time = time;
  if (Array.isArray(groupIds)) data.schedules[botKey].groupIds = groupIds;
  if (typeof timezone === 'string') data.schedules[botKey].timezone = timezone;

  db.write(data);
  scheduler.reload();
  res.json({ ok: true, schedule: data.schedules[botKey] });
});

// POST /api/schedules/:botKey/run-now -> 手動立即發送該頻道目前已勾選的新聞
router.post('/:botKey/run-now', async (req, res) => {
  try {
    await runBotPost(req.params.botKey);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
