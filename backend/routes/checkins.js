/**
 * routes/checkins.js
 * POST /api/checkins
 */
const express = require('express');
const router = express.Router();
const { handleCheckIn } = require('../controllers/checkinsController');

router.post('/', handleCheckIn);

module.exports = router;
