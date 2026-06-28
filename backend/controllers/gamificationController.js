/**
 * controllers/gamificationController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Velocity Credits — the gamification spine.
 *   GET  /api/gamification/profile     → decorated profile (level, achievements)
 *   POST /api/gamification/award        → award credits for an action
 *   GET  /api/gamification/leaderboard  → anonymized global ranking + percentile
 *
 * Works in both Mongo and in-memory modes. Profile is seeded with a believable
 * starting state on first read so the demo lands with impact.
 */

const {
  db, createGamificationProfile, applyCreditAward, decorateProfile, levelInfo,
} = require('../utils/dataModel');
const GamificationModel = require('../models/Gamification');
const CheckInModel = require('../models/CheckIn');
const { isConnected } = require('../db/connection');

// Average trust score from check-ins — feeds the "Sharpshooter" achievement + DNA.
async function avgTrustFor(userId) {
  try {
    let checkins;
    if (isConnected()) checkins = await CheckInModel.find({ userId }).lean();
    else checkins = db.getAllCheckIns();
    if (!checkins || checkins.length === 0) return 92; // optimistic default for fresh demo
    const sum = checkins.reduce((s, c) => s + (c.trustScore ?? 100), 0);
    return Math.round(sum / checkins.length);
  } catch {
    return 92;
  }
}

// Fetch-or-seed the raw profile for a user.
async function loadProfile(userId) {
  if (isConnected()) {
    let doc = await GamificationModel.findOne({ userId }).lean();
    if (!doc) {
      const seeded = createGamificationProfile(true);
      doc = (await GamificationModel.create({ userId, ...seeded })).toObject();
    }
    return doc;
  }
  return db.getGamification();
}

async function saveProfile(userId, profile) {
  if (isConnected()) {
    const { _id, __v, ...clean } = profile;
    await GamificationModel.findOneAndUpdate({ userId }, { $set: clean }, { upsert: true });
    return profile;
  }
  return db.setGamification(profile);
}

async function getProfile(req, res) {
  try {
    const userId = req.userId;
    const profile = await loadProfile(userId);
    const avgTrust = await avgTrustFor(userId);
    return res.json(decorateProfile(profile, avgTrust));
  } catch (err) {
    console.error('[Gamification] getProfile failed:', err.message);
    return res.status(500).json({ error: 'Failed to load profile', message: err.message });
  }
}

async function awardCredits(req, res) {
  try {
    const userId = req.userId;
    const { action, amount } = req.body || {};
    if (!action) return res.status(400).json({ error: 'Missing action' });

    const profile = await loadProfile(userId);
    const updated = applyCreditAward(profile, action, typeof amount === 'number' ? amount : undefined);
    await saveProfile(userId, updated);

    const avgTrust = await avgTrustFor(userId);
    const decorated = decorateProfile(updated, avgTrust);

    // The last ledger entry is the award we just applied — surface it for the
    // frontend ticker burst animation.
    const awarded = updated.ledger[0];
    return res.json({ ...decorated, awarded });
  } catch (err) {
    console.error('[Gamification] awardCredits failed:', err.message);
    return res.status(500).json({ error: 'Failed to award credits', message: err.message });
  }
}

// Deterministic anonymized leaderboard. The cohort is synthetic but stable for a
// given credit total, and the user is inserted at the correct rank so the
// percentile is honest relative to the cohort.
const HANDLES = [
  'Operator_4F2', 'NightShift_A9', 'DeepWork_X1', 'Zenith_77', 'FlowState_B3',
  'Cascade_E5', 'Momentum_K2', 'Apex_91', 'Tempo_D8', 'Velocity_R6',
  'Sprint_T4', 'Quantum_J0', 'Catalyst_M5', 'Vector_Z3', 'Pulse_H8',
];

function getLeaderboard(req, res) {
  loadProfile(req.userId).then((profile) => {
    const me = profile.lifetimeCredits || 0;
    // Build a believable cohort spread around the user.
    const cohort = HANDLES.map((handle, i) => {
      const offset = Math.round((Math.sin(i * 12.9898) * 43758.5453 % 1) * 4200) - 1400;
      const credits = Math.max(180, me + offset + (i - 7) * 230);
      return { handle, credits, you: false };
    });
    cohort.push({ handle: 'You', credits: me, you: true });
    cohort.sort((a, b) => b.credits - a.credits);

    const rank = cohort.findIndex(c => c.you) + 1;
    const total = cohort.length;
    const percentile = Math.max(1, Math.round(((total - rank) / total) * 100));

    return res.json({
      rank,
      total,
      percentile,
      leaderboard: cohort.slice(0, 12).map((c, i) => ({ ...c, rank: i + 1 })),
      you: { rank, credits: me, ...levelInfo(me) },
    });
  }).catch((err) => {
    console.error('[Gamification] leaderboard failed:', err.message);
    res.status(500).json({ error: 'Failed to load leaderboard', message: err.message });
  });
}

module.exports = { getProfile, awardCredits, getLeaderboard };
