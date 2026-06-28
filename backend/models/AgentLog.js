/**
 * models/AgentLog.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent record of every autonomous action the AI takes on behalf of the
 * user. This is the primary evidence artifact for Agentic Depth scoring.
 *
 * Each entry has:
 *  - featureKey   — machine identifier for the originating feature
 *  - title        — short human-readable headline (max ~80 chars)
 *  - reasoning    — plain-English explanation of WHY the AI acted
 *  - outcome      — what actually happened (sent, rebalanced, triaged, etc.)
 *  - undoable     — whether an undo action is available
 *  - undone       — true if user already undid this
 *  - relatedTaskId — optional link to a task for deep-linking
 *  - metadata     — arbitrary JSON for feature-specific context
 *  - autonomy     — 'autonomous' | 'assisted' | 'countdown'
 *    autonomous  = AI acted without any user trigger
 *    assisted    = AI acted in response to a user click but still took real action
 *    countdown   = AI queued an action with a cancel window
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Sub-schema: a single step inside a chain entry ───────────────────────────
const ChainStepSchema = new Schema({
  stepNumber:  { type: Number, required: true },
  featureKey:  { type: String, required: true },
  title:       { type: String, required: true },
  reasoning:   { type: String, default: '' },
  outcome:     { type: String, default: '' },
  undoable:    { type: Boolean, default: false },
  undone:      { type: Boolean, default: false },
  relatedTaskId:   { type: String, default: null },
  relatedTaskName: { type: String, default: null },
  timestamp:   { type: String, default: () => new Date().toISOString() },
  // Phase 3: reasoning trace per step
  rejectedAlternatives: [{
    action:  { type: String },
    reason:  { type: String },
  }],
}, { _id: false });

// ── Sub-schema: a rejected alternative ───────────────────────────────────────
const RejectedAlternativeSchema = new Schema({
  action:  { type: String, required: true },
  reason:  { type: String, required: true },
}, { _id: false });

const AgentLogSchema = new Schema({
  userId:        { type: String, required: true, index: true },
  featureKey:    { type: String, required: true },  // 'rebalance' | 'negotiate' | 'triage' | 'panic' | 'reschedule' | 'drift_alert' | 'chain' | 'policy_adapted' | ...
  title:         { type: String, required: true },
  reasoning:     { type: String, default: '' },
  outcome:       { type: String, default: '' },
  autonomy:      { type: String, enum: ['autonomous', 'assisted', 'countdown'], default: 'assisted' },
  undoable:      { type: Boolean, default: false },
  undone:        { type: Boolean, default: false },
  relatedTaskId: { type: String, default: null },
  relatedTaskName: { type: String, default: null },
  metadata:      { type: Schema.Types.Mixed, default: {} },
  createdAt:     { type: String, default: () => new Date().toISOString() },

  // ── Phase 1: Compositional Action Chain ────────────────────────────────────
  // When featureKey === 'chain', this array holds the ordered steps.
  // For non-chain entries, this remains empty.
  chain:         { type: [ChainStepSchema], default: [] },
  isChain:       { type: Boolean, default: false },

  // ── Phase 2: Policy Adaptation ─────────────────────────────────────────────
  // When featureKey === 'policy_adapted', this records what changed.
  policyCategory:  { type: String, default: null },   // e.g. 'negotiate_recruiting'
  policyAction:    { type: String, default: null },    // 'downgrade_to_suggestion'
  policyContext:   { type: String, default: null },    // human-readable e.g. 'Negotiate emails to recruiting teams'
  cancelCount:     { type: Number, default: null },    // how many times user cancelled

  // ── Phase 3: Reasoning Trace ("Why this, not something else?") ─────────────
  rejectedAlternatives: { type: [RejectedAlternativeSchema], default: [] },
}, { versionKey: false });

AgentLogSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('AgentLog', AgentLogSchema);
