const express = require('express');
const store = require('../store');

// 確保伺服器啟動時就建立好資料庫檔案（並在需要時印出管理者權杖），
// 而不是等到第一支需要驗證的 API 被呼叫、卻又因為未帶權杖而被擋下。
store.read();

const router = express.Router();

router.use('/users', require('./users'));
router.use('/cases', require('./cases'));
router.use('/', require('./discussion')); // /cases/:caseId/comments, /comments/:id
router.use('/', require('./priceAnalysis')); // /cases/:id/price-analysis
router.use('/', require('./reports')); // /cases/:id/presentation, /cases/:id/negotiation-report
router.use('/buyer-needs', require('./buyerNeeds'));
router.use('/feedback', require('./feedback'));

module.exports = router;
