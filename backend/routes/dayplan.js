/**
 * routes/dayplan.js
 * Command Day endpoints — mounted at /api/dayplan (requireAuth).
 */
const express = require('express');
const router = express.Router();
const { getDayPlan, rebalanceDayPlan } = require('../controllers/dayplanController');

router.get('/', getDayPlan);
router.post('/rebalance', rebalanceDayPlan);

module.exports = router;
