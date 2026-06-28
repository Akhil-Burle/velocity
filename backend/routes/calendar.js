const express = require('express');
const router = express.Router();
const { getCalendarEvents } = require('../controllers/calendarController');

router.get('/', getCalendarEvents);

module.exports = router;
