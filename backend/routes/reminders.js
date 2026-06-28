const express = require('express');
const router = express.Router();
const { getActiveReminders } = require('../controllers/remindersController');

router.get('/active', getActiveReminders);

module.exports = router;
