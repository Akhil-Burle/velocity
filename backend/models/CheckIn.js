/**
 * models/CheckIn.js
 * Mirrors createCheckIn() shape + userId scoping.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CheckInSchema = new Schema({
  userId:             { type: String, required: true, index: true },
  id:                 { type: String, required: true },
  taskId:             { type: String, required: true },
  timestamp:          { type: String },
  selfReportText:     { type: String, default: '' },
  selfReportPercent:  { type: Number, default: 0 },
  trustScore:         { type: Number, default: 100 },
}, { versionKey: false });

CheckInSchema.set('toJSON', {
  transform(_doc, ret) { delete ret._id; return ret; },
});

module.exports = mongoose.model('CheckIn', CheckInSchema);
