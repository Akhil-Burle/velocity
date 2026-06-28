/**
 * routes/triage.js
 * POST /api/triage
 */
const express = require('express');
const router = express.Router();
const { handleTriage } = require('../controllers/triageController');

router.post('/', handleTriage);

module.exports = router;
