const express = require('express');
const router = express.Router();
const { generateBriefing } = require('../controllers/briefingController');

router.post('/generate', generateBriefing);

module.exports = router;
