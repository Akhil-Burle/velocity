/**
 * models/Task.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mongoose schema mirroring the existing in-memory Task/Subtask shapes
 * from utils/dataModel.js, field-for-field. Only new field: userId (required).
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Subtask (embedded) ────────────────────────────────────────────────────────
const SubtaskSchema = new Schema({
  id:                { type: String, required: true },
  title:             { type: String, default: 'Untitled subtask' },
  estimatedMinutes:  { type: Number, default: 30 },
  scheduledSlot:     { type: String, default: null },
  completed:         { type: Boolean, default: false },
}, { _id: false });

// ── SparklinePoint (embedded) ─────────────────────────────────────────────────
const SparklinePointSchema = new Schema({
  value:     { type: Number, default: 0 },
  timestamp: { type: String, default: '' },   // ISO string — when this check-in happened
}, { _id: false });

// ── Task ──────────────────────────────────────────────────────────────────────
const TaskSchema = new Schema({
  // User scoping — the only new field relative to the in-memory shape
  userId:                  { type: String, required: true, index: true },

  // Core identity (mirrors createTask() output exactly)
  id:                      { type: String, required: true },
  taskName:                { type: String, default: 'Untitled Task' },
  deadline:                { type: String },          // ISO string
  taskType:                { type: String, enum: ['CODE','WRITING','DIAGRAM','OTHER'], default: 'OTHER' },
  cognitiveWeight:         { type: String, enum: ['LOW','MEDIUM','HIGH'], default: 'MEDIUM' },
  selfOwned:               { type: Boolean, default: true },
  recipientName:           { type: String, default: null },
  currentPaceHoursPerDay:  { type: Number, default: 0 },
  status:                  { type: String, enum: ['GREEN','AMBER','RED','COMPLETE','failed'], default: 'GREEN' },
  driftExplanation:        { type: String, default: '' },
  hotStartContent:         { type: String, default: '' },
  negotiatedDraft:         { type: String, default: '' },
  completionPercent:       { type: Number, default: 0 },
  sparkline:               { type: [SparklinePointSchema], default: [] },
  isRescheduled:           { type: Boolean, default: false },
  rawInput:                { type: String, default: '' },
  subtasks:                { type: [SubtaskSchema], default: [] },
  mode:                    { type: String, default: 'normal' },
  createdAt:               { type: String },
  updatedAt:               { type: String },

  // ── Zero-Hour agent fields ────────────────────────────────────────────────
  // Panic-mode scaffold (replaces legacy hotStartContent flat string)
  panicScaffold: {
    checklist:    { type: [String], default: [] },   // markdown step strings
    boilerplate:  { type: String, default: '' },      // code or slide outline
    repoUrl:      { type: String, default: '' },      // GitHub repo URL if created
    generatedAt:  { type: String, default: '' },
  },
  // Cognitive-load routing
  energyLevel:       { type: String, enum: ['Deep Focus', 'Quick Wins', 'Brain-Dead', ''], default: '' },
  estimatedDuration: { type: Number, default: 0 },   // minutes

  // ── Credit economy ─────────────────────────────────────────────────────────
  creditValue:       { type: Number, default: 0 },     // credits earnable on completion
  creditsAwarded:    { type: Boolean, default: false }, // guards double-award
}, {
  // Use the string 'id' field as our identifier (not MongoDB's _id)
  // so the API response shape matches the existing frontend types exactly.
  versionKey: false,
});

// Make JSON serialization hide _id and __v
TaskSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Task', TaskSchema);
