/**
 * models/Habit.js
 * Mirrors createHabit() shape + userId scoping.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const HabitHistorySchema = new Schema({
  date:      { type: String, required: true },
  completed: { type: Boolean, default: false },
}, { _id: false });

const HabitSchema = new Schema({
  userId:    { type: String, required: true, index: true },
  id:        { type: String, required: true },
  title:     { type: String, default: 'Untitled Habit' },
  frequency: { type: String, enum: ['daily', 'weekly'], default: 'daily' },
  streak:    { type: Number, default: 0 },
  history:   { type: [HabitHistorySchema], default: [] },
  createdAt: { type: String },
}, { versionKey: false });

HabitSchema.set('toJSON', {
  transform(_doc, ret) { delete ret._id; return ret; },
});

module.exports = mongoose.model('Habit', HabitSchema);
