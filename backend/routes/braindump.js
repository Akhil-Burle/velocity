/**
 * routes/braindump.js
 * POST /api/braindump
 */
const express = require('express');
const router = express.Router();
const { handleBrainDump } = require('../controllers/braindumpController');

router.post('/', handleBrainDump);

module.exports = router;
