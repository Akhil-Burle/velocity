const express = require('express');
const router  = express.Router();
const { getCalendarEvents, pushSyncToGoogleCalendar } = require('../controllers/calendarController');

// requireAuth is already applied at the app level in server.js
router.get('/',      getCalendarEvents);
router.post('/sync', pushSyncToGoogleCalendar);

module.exports = router;
