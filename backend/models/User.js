/**
 * models/User.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal user document. Only used for the single demo account.
 * Guest sessions don't have a User document — their userId is ephemeral.
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  username:     { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  userId:       { type: String, required: true, unique: true },
}, { versionKey: false });

UserSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret._id;
    delete ret.passwordHash; // never leak hash
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
