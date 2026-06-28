/**
 * controllers/authController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * POST /api/auth/guest         — issue a JWT for a new ephemeral guest userId
 * POST /api/auth/login         — validate demo credentials, issue a JWT
 * GET  /api/auth/google        — initiate Google Sign-In OAuth flow
 * GET  /api/auth/google/callback — handle OAuth callback, issue JWT
 * POST /api/test-db            — write + read a dummy document (smoke test)
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Task = require('../models/Task');
const { signToken } = require('../middleware/auth');
const { isConnected } = require('../db/connection');
const { google } = require('googleapis');

// ─── Google OAuth2 client (for Sign-In) ──────────────────────────────────────

function getOAuth2Client(redirectUri) {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || clientId === 'your_google_client_id_here' || !clientSecret) return null;
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/google/callback`
  );
}

// ─── POST /api/auth/guest ─────────────────────────────────────────────────────

async function guestLogin(req, res) {
  const userId = `guest_${uuidv4()}`;
  const token = signToken(userId, '24h');
  console.log(`[Auth] Guest session created: ${userId}`);
  return res.json({
    token,
    userId,
    mode: 'guest',
    note: 'Guest session expires in 24h. Data is not persisted across page refreshes if JWT is lost.',
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

async function login(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  if (!isConnected()) {
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'MongoDB is not connected. Set MONGODB_URI in .env to enable login.',
    });
  }

  try {
    const user = await User.findOne({ username: username.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Username or password incorrect' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials', message: 'Username or password incorrect' });
    }

    const token = signToken(user.userId, '7d');
    console.log(`[Auth] Demo login success: ${user.userId}`);
    return res.json({ token, userId: user.userId, mode: 'demo' });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ error: 'Login failed', message: err.message });
  }
}

// ─── POST /api/test-db ────────────────────────────────────────────────────────

async function testDb(req, res) {
  if (!isConnected()) {
    return res.status(503).json({
      success: false,
      message: 'MongoDB not connected. Set MONGODB_URI in .env.',
    });
  }

  try {
    // Write one dummy task document with a test userId
    const testUserId = 'test_user_db_probe';
    const dummy = new Task({
      userId: testUserId,
      id: uuidv4(),
      taskName: '🔬 DB Connection Test',
      deadline: new Date(Date.now() + 86400000).toISOString(),
      taskType: 'OTHER',
      cognitiveWeight: 'LOW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await dummy.save();

    // Read it back
    const found = await Task.findOne({ id: dummy.id, userId: testUserId }).lean();

    // Clean up
    await Task.deleteOne({ id: dummy.id, userId: testUserId });

    return res.json({
      success: true,
      message: '✅ MongoDB write + read + delete all succeeded.',
      document: { id: found.id, taskName: found.taskName },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─── GET /api/auth/google ─────────────────────────────────────────────────────
// Redirect user to Google's OAuth consent screen

function isGoogleSignInConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id_here' &&
    process.env.GOOGLE_CLIENT_SECRET
  );
}

async function googleAuthInit(req, res) {
  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(501).json({
      error: 'Google Sign-In not configured',
      message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env',
    });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    prompt: 'select_account',
  });

  return res.json({ authUrl });
}

// ─── GET /api/auth/google/callback ────────────────────────────────────────────
// Exchange auth code for tokens, find/create user, issue Velocity JWT

async function googleAuthCallback(req, res) {
  const { code } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code) {
    return res.redirect(`${frontendUrl}?auth_error=no_code`);
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.redirect(`${frontendUrl}?auth_error=not_configured`);
  }

  try {
    const { tokens } = await oauth2Client.getToken(String(code));
    oauth2Client.setCredentials(tokens);

    // Fetch user profile from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    const googleId = profile.id;
    const email    = profile.email || '';
    const name     = profile.name  || email;

    let user;
    let userId;

    if (isConnected()) {
      // Find or create user keyed on Google ID
      user = await User.findOne({ username: `google:${googleId}` });
      if (!user) {
        const passwordHash = await bcrypt.hash(uuidv4(), 8); // placeholder — not used
        user = await User.create({
          username: `google:${googleId}`,
          passwordHash,
          userId:  `google_${googleId}`,
        });
        console.log(`[Auth] Google Sign-In: new user created — ${email}`);
      } else {
        console.log(`[Auth] Google Sign-In: returning user — ${email}`);
      }
      userId = user.userId;
    } else {
      // In-memory fallback
      userId = `google_${googleId}`;
    }

    const token = signToken(userId, '7d');

    // Store the Google access token so Calendar can use it in this session
    // (We pass it back as a fragment parameter — never in a query string)
    const redirectUrl = `${frontendUrl}?google_token=${encodeURIComponent(token)}&google_user=${encodeURIComponent(name)}&mode=google`;
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('[Auth] Google OAuth callback error:', err.message);
    return res.redirect(`${frontendUrl}?auth_error=${encodeURIComponent(err.message)}`);
  }
}

module.exports = { guestLogin, login, testDb, googleAuthInit, googleAuthCallback, isGoogleSignInConfigured };
