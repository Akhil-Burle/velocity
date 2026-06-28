const express = require('express');
const router = express.Router();
const { handleReschedule } = require('../controllers/rescheduleController');

router.post('/', handleReschedule);

module.exports = router;
