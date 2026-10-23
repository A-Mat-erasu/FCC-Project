const mongoose = require('mongoose');
const { BLOOD_TYPES } = require('./_person');
const ORGAN_TYPES = ['HEART', 'LIVER', 'KIDNEY', 'LUNG', 'PANCREAS', 'INTESTINE'];

const organSchema = new mongoose.Schema({
  donor:           { type: mongoose.Schema.Types.ObjectId, ref: 'Donor', required: true, index: true },
  organType:       { type: String, enum: ORGAN_TYPES, required: true },
  bloodType:       { type: String, enum: BLOOD_TYPES, required: true },
  harvestDatetime: { type: Date, required: true },
  viabilityHours:  { type: Number, required: true, min: 0.5, max: 72 },
  expiresAt:       { type: Date, index: true },   // harvest + viability (used by expiry sweeps)
  status:          { type: String, enum: ['AVAILABLE', 'ALLOCATED', 'TRANSPLANTED', 'EXPIRED'], default: 'AVAILABLE', index: true }
}, { timestamps: true, collection: 'organs' });

// expiresAt = harvestDatetime + viabilityHours
organSchema.pre('validate', function (next) {
  if (this.harvestDatetime && this.viabilityHours != null) {
    this.expiresAt = new Date(this.harvestDatetime.getTime() + this.viabilityHours * 3600 * 1000);
  }
  next();
});
organSchema.virtual('isExpired').get(function () { return this.expiresAt <= new Date(); });

module.exports = mongoose.model('Organ', organSchema);
module.exports.ORGAN_TYPES = ORGAN_TYPES;
