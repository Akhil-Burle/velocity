/**
 * server.js — Velocity Backend v2.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Express server with MongoDB Atlas storage, JWT auth, and per-user data scoping.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db/connection');
const { requireAuth } = require('./middleware/auth');
const { testDb } = require('./controllers/authController');

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRouter      = require('./routes/auth');
const braindumpRouter = require('./routes/braindump');
const tasksRouter     = require('./routes/tasks');
const subtasksRouter  = require('./routes/subtasks');
const checkinsRouter  = require('./routes/checkins');
const hotstartRouter  = require('./routes/hotstart');
const triageRouter    = require('./routes/triage');
const negotiateRouter = require('./routes/negotiate');
const goalsRouter     = require('./routes/goals');
const habitsRouter    = require('./routes/habits');
const calendarRouter  = require('./routes/calendar');
const rescheduleRouter= require('./routes/reschedule');
const insightsRouter  = require('./routes/insights');
const settingsRouter  = require('./routes/settings');
const briefingRouter  = require('./routes/briefing');
const remindersRouter  = require('./routes/reminders');
const ultimatumRouter  = require('./routes/ultimatum');
const agentRouter      = require('./routes/agent');
const gamificationRouter = require('./routes/gamification');
const dayplanRouter      = require('./routes/dayplan');
const agentLogRouter     = require('./routes/agentLog');

// ─── App setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS: comma-separated list of allowed origins from env.
// In production, set this to your Firebase Hosting URL (and any other origins).
// In local development, the localhost entries below are always included.
const PROD_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
];

// Always allow localhost in development; in production only ALLOWED_ORIGINS applies.
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? PROD_ORIGINS
  : [...DEV_ORIGINS, ...PROD_ORIGINS];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server, curl, health checks)
    if (!origin) return callback(null, true);
    // Allow any localhost in non-production
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── Public routes (no auth required) ────────────────────────────────────────
app.use('/api/auth', authRouter);

// TTS status — public capability check, no user data involved
app.get('/api/agent/tts/status', (_req, res) => {
  const { isTTSConfigured } = require('./services/ttsService');
  res.json({ configured: isTTSConfigured() });
});

// Health check (public, useful for frontend to detect backend)
app.get('/api/health', (_req, res) => {
  const { isConnected } = require('./db/connection');
  const { getAIBackendInfo } = require('./services/geminiService');
  const aiInfo = getAIBackendInfo();
  res.json({
    status: 'ok',
    service: 'velocity-backend',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    mongoConnected: isConnected(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
    aiBackend: aiInfo.backend,         // 'vertex_ai' | 'gemini_developer'
    aiBackendLabel: aiInfo.label,      // human-readable
    aiModel: aiInfo.model,
    vertexProject: aiInfo.project,
    vertexLocation: aiInfo.location,
  });
});

// DB test route (public for debugging, requires no user data)
app.post('/api/test-db', testDb);

// ─── Protected routes (JWT required) ─────────────────────────────────────────
// All routes below require a valid JWT — requireAuth extracts req.userId

app.use('/api/braindump',           requireAuth, braindumpRouter);
app.use('/api/tasks',               requireAuth, tasksRouter);
app.use('/api/tasks/:id/subtasks',  requireAuth, subtasksRouter);
app.use('/api/checkins',            requireAuth, checkinsRouter);
app.use('/api/hotstart',            requireAuth, hotstartRouter);
app.use('/api/triage',              requireAuth, triageRouter);
app.use('/api/negotiate',           requireAuth, negotiateRouter);
app.use('/api/goals',               requireAuth, goalsRouter);
app.use('/api/habits',              requireAuth, habitsRouter);
app.use('/api/calendar',            requireAuth, calendarRouter);
app.use('/api/reschedule',          requireAuth, rescheduleRouter);
app.use('/api/insights',            requireAuth, insightsRouter);
app.use('/api/settings',            requireAuth, settingsRouter);
app.use('/api/briefing',            requireAuth, briefingRouter);
app.use('/api/reminders',           requireAuth, remindersRouter);
app.use('/api/ultimatum',           requireAuth, ultimatumRouter);
app.use('/api/agent',               requireAuth, agentRouter);
app.use('/api/gamification',        requireAuth, gamificationRouter);
app.use('/api/dayplan',             requireAuth, dayplanRouter);
app.use('/api/agent-log',           requireAuth, agentLogRouter);

// ─── 404 + error handlers ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({ error: err.name || 'Internal Server Error', message: err.message });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  console.log('');
  console.log('  ⚡ Velocity Backend v2.1');
  console.log(`  → Listening on http://localhost:${PORT}`);

  // 1. Start HTTP server immediately (so health check works even before DB)
  app.listen(PORT, () => {
    console.log(`  ✅ HTTP server running`);
  });

  // 2. Connect to MongoDB
  await connectDB();

  // 3. Auto-seed demo account if DB is connected
  const { isConnected } = require('./db/connection');
  if (isConnected()) {
    try {
      // Use rich judge seed on first boot (it checks task count before wiping)
      const { seedRichDemoAccount } = require('./scripts/seed-rich');
      // Only auto-seed if no data exists — manual reset via: node scripts/seed-rich.js
      const Task = require('./models/Task');
      const taskCount = await Task.countDocuments({ userId: 'demo_user_stable_id_v2' });
      if (taskCount === 0) {
        await seedRichDemoAccount();
      } else {
        console.log(`  ℹ️  Demo account has ${taskCount} tasks — skipping auto-seed (run node scripts/seed-rich.js to reset)`);
      }
    } catch (err) {
      console.warn('  ⚠️  Seed failed (non-fatal):', err.message);
    }
  }

  console.log('');
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn('  ⚠️  GEMINI_API_KEY not set — AI features will use fallback templates');
  } else {
    console.log('  ✅ Gemini API key configured');
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri === 'your_mongodb_uri_here') {
    console.warn('  ⚠️  MONGODB_URI not set — using in-memory store (data lost on restart)');
    console.warn('     Set MONGODB_URI in backend/.env to enable persistence');
  }
  console.log('');
  console.log('  Auth endpoints (public):');
  console.log('    POST   /api/auth/guest');
  console.log('    POST   /api/auth/login  (demo / velocity2026)');
  console.log('    POST   /api/test-db');
  console.log('');
  console.log('  Protected routes (JWT required):');
  console.log('    POST   /api/braindump');
  console.log('    GET    /api/tasks       PATCH /api/tasks/:id');
  console.log('    GET    /api/goals       POST  /api/goals');
  console.log('    GET    /api/habits      POST  /api/habits');
  console.log('    GET    /api/calendar    POST  /api/reschedule');
  console.log('    POST   /api/insights/generate');
  console.log('    GET/PATCH /api/settings');
  console.log('');
}

start();

module.exports = app;
