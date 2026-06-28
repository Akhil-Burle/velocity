/**
 * models/PolicyMemory.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 2: Adaptive Policy Memory
 *
 * Tracks how many times a user has cancelled/undone specific categories of
 * autonomous agent actions. When the cancel count crosses a threshold the
 * agent switches from auto-acting to flagging a suggestion instead.
 *
 * One document per (userId, category) pair.
 *
 * policyCategory examples:
 *   'negotiate_recruiting'  — Negotiate emails to recruiting-type recipients
 *   'negotiate_professor'   — Negotiate emails to professor/instructor recipients
 *   'rebalance_deep_focus'  — Auto-rebalance that moves Deep Focus tasks
 *   'triage_code'           — Auto-triage that defers CODE tasks
 *
 * status:
 *   'active'   — still auto-acting (below threshold)
 *   'learned'  — threshold crossed, now downgrading to suggestion
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CancelEventSchema = new Schema({
  logEntryId: { type: String, required: true },
  cancelledAt: { type: String, default: () => new Date().toISOString() },
  context: { type: String, default: '' }, // short description of what was cancelled
}, { _id: false });

const PolicyMemorySchema = new Schema({
  userId:           { type: String, required: true, index: true },
  policyCategory:   { type: String, required: true },  // machine key
  policyLabel:      { type: String, required: true },  // human-readable
  featureKey:       { type: String, required: true },  // 'negotiate' | 'rebalance' | 'triage' | etc.
  status:           { type: String, enum: ['active', 'learned'], default: 'active' },
  cancelCount:      { type: Number, default: 0 },
  threshold:        { type: Number, default: 3 },  // configurable, default 3
  cancelEvents:     { type: [CancelEventSchema], default: [] },
  learnedAt:        { type: String, default: null },  // ISO — when status flipped to 'learned'
  learnedMessage:   { type: String, default: null },  // human-readable "I learned X" message
  createdAt:        { type: String, default: () => new Date().toISOString() },
  updatedAt:        { type: String, default: () => new Date().toISOString() },
}, { versionKey: false });

// Compound index for efficient per-user lookups
PolicyMemorySchema.index({ userId: 1, policyCategory: 1 }, { unique: true });

PolicyMemorySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('PolicyMemory', PolicyMemorySchema);
