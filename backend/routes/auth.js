/**
 * routes/auth.js
 */
const express = require('express');
const router = express.Router();
const { guestLogin, login, googleAuthInit, googleAuthCallback, isGoogleSignInConfigured } = require('../controllers/authController');

router.post('/guest',             guestLogin);
router.post('/login',             login);

// Google Sign-In — real OAuth flow
// GET /api/auth/google         → returns { authUrl } for frontend to redirect to
// GET /api/auth/google/callback → handles code exchange, redirects to frontend with token
router.get('/google',             googleAuthInit);
router.get('/google/callback',    googleAuthCallback);

// Feature flag — frontend checks this to show/hide Google Sign-In button
router.get('/google/status',      (_req, res) => res.json({ configured: isGoogleSignInConfigured() }));

module.exports = router;
