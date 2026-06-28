/**
 * models/Gamification.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-user Velocity Credits profile. Mirrors createGamificationProfile() shape
 * from utils/dataModel.js, scoped to userId. The derived level / achievements
 * are NOT stored — they are computed on read via decorateProfile().
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const LedgerEntrySchema = new Schema({
  id:        { type: String, required: true },
  action:    { type: String, default: 'misc' },
  amount:    { type: Number, default: 0 },
  label:     { type: String, default: '' },
  timestamp: { type: String, default: '' },
}, { _id: false });

const GamificationSchema = new Schema({
  userId:          { type: String, required: true, unique: true, index: true },
  credits:         { type: Number, default: 0 },
  lifetimeCredits: { type: Number, default: 0 },
  streak:          { type: Number, default: 0 },
  longestStreak:   { type: Number, default: 0 },
  lastActiveDate:  { type: String, default: '' },
  tasksCompleted:  { type: Number, default: 0 },
  checkins:        { type: Number, default: 0 },
  panicResolved:   { type: Number, default: 0 },
  greenHolds:      { type: Number, default: 0 },
  onTimeCount:     { type: Number, default: 0 },
  ledger:          { type: [LedgerEntrySchema], default: [] },
  achievementState:{ type: Schema.Types.Mixed, default: {} },
  createdAt:       { type: String },
  updatedAt:       { type: String },
}, { versionKey: false });

GamificationSchema.set('toJSON', {
  transform(_doc, ret) { delete ret._id; return ret; },
});

module.exports = mongoose.model('Gamification', GamificationSchema);
