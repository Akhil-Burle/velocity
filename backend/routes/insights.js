const express = require('express');
const router = express.Router();
const { generateInsights, getDNA, getPrebrief, getWeeklyReport, getResults } = require('../controllers/insightsController');

router.post('/generate', generateInsights);
router.get('/dna', getDNA);
router.get('/prebrief', getPrebrief);
router.get('/weekly', getWeeklyReport);
router.get('/results', getResults);

module.exports = router;
