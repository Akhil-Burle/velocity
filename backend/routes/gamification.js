/**
 * routes/gamification.js
 * Velocity Credits endpoints — mounted at /api/gamification (requireAuth).
 */
const express = require('express');
const router = express.Router();
const { getProfile, awardCredits, getLeaderboard } = require('../controllers/gamificationController');

router.get('/profile', getProfile);
router.post('/award', awardCredits);
router.get('/leaderboard', getLeaderboard);

module.exports = router;
