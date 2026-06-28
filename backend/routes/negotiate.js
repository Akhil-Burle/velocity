/**
 * routes/negotiate.js
 * POST /api/negotiate
 */
const express = require('express');
const router = express.Router();
const { handleNegotiate } = require('../controllers/negotiateController');

router.post('/', handleNegotiate);

module.exports = router;
