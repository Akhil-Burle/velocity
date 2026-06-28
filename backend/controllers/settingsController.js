/**
 * controllers/settingsController.js
 * GET /api/settings, PATCH /api/settings
 * Settings are per-user — backed by MongoDB when connected.
 */

const { db } = require('../utils/dataModel');
const SettingsModel = require('../models/Settings');
const { isConnected } = require('../db/connection');

const ALLOWED_KEYS = [
  'preferredWorkStart', 'preferredWorkEnd', 'accountabilityEmail',
  'dailyBriefingEnabled', 'dailyBriefingTime', 'theme', 'accentColor',
  'calendarSyncEnabled', 'notificationsEnabled', 'autoTriageEnabled',
];

async function getSettings(req, res) {
  const userId = req.userId;
  if (isConnected()) {
    // Upsert: create default settings document for new users
    let settings = await SettingsModel.findOne({ userId }).lean();
    if (!settings) {
      settings = (await SettingsModel.create({ userId })).toObject();
    }
    const { _id, __v, ...cleaned } = settings;
    return res.json(cleaned);
  }
  return res.json(db.getSettings());
}

async function updateSettings(req, res) {
  const userId = req.userId;
  const updates = {};
  for (const key of ALLOWED_KEYS) {
    if (key in req.body) updates[key] = req.body[key];
  }

  if (isConnected()) {
    const updated = await SettingsModel.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true, upsert: true, lean: true }
    );
    const { _id, __v, ...cleaned } = updated;
    console.log('[Settings] Updated:', Object.keys(updates).join(', '));
    return res.json(cleaned);
  }

  return res.json(db.updateSettings(updates));
}

module.exports = { getSettings, updateSettings };
