/**
 * routes/hotstart.js
 * POST /api/hotstart
 */
const express = require('express');
const router = express.Router();
const { handleHotStart } = require('../controllers/hotstartController');

router.post('/', handleHotStart);

module.exports = router;
