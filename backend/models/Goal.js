/**
 * models/Goal.js
 * Mirrors createGoal() shape + userId scoping.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const GoalSchema = new Schema({
  userId:          { type: String, required: true, index: true },
  id:              { type: String, required: true },
  title:           { type: String, default: 'Untitled Goal' },
  description:     { type: String, default: '' },
  linkedTaskIds:   { type: [String], default: [] },
  targetDate:      { type: String, default: null },
  progressPercent: { type: Number, default: 0 },
  createdAt:       { type: String },
}, { versionKey: false });

GoalSchema.set('toJSON', {
  transform(_doc, ret) { delete ret._id; return ret; },
});

module.exports = mongoose.model('Goal', GoalSchema);
