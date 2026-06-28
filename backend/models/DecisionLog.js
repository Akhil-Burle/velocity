/**
 * models/DecisionLog.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Records explicit Ultimatum choices — when a user consciously chooses which
 * task fails. Not rescheduled, not auto-triaged: deliberately failed.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const DecisionLogSchema = new Schema({
  userId:          { type: String, required: true, index: true },
  type:            { type: String, default: 'ultimatum' },
  winningTaskId:   { type: String, required: true },
  winningTaskName: { type: String, default: '' },
  losingTaskId:    { type: String, required: true },
  losingTaskName:  { type: String, default: '' },
  reasoning:       { type: String, default: '' },
  createdAt:       { type: String },
}, { versionKey: false });

DecisionLogSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('DecisionLog', DecisionLogSchema);
