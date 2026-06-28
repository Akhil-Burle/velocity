/**
 * models/Settings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-user settings document. Mirrors the in-memory settings singleton
 * but scoped to userId so demo and guest never share settings.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SettingsSchema = new Schema({
  userId:               { type: String, required: true, unique: true, index: true },
  preferredWorkStart:   { type: String, default: '09:00' },
  preferredWorkEnd:     { type: String, default: '21:00' },
  accountabilityEmail:  { type: String, default: '' },
  dailyBriefingEnabled: { type: Boolean, default: true },
  dailyBriefingTime:    { type: String, default: '08:00' },
  theme:                { type: String, default: 'dark' },
  accentColor:          { type: String, default: '#22c55e' },
  calendarSyncEnabled:  { type: Boolean, default: false },
  notificationsEnabled: { type: Boolean, default: true },
  autoTriageEnabled:    { type: Boolean, default: false },
}, { versionKey: false });

SettingsSchema.set('toJSON', {
  transform(_doc, ret) { delete ret._id; return ret; },
});

module.exports = mongoose.model('Settings', SettingsSchema);
