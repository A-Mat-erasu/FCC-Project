const mongoose = require('mongoose');
const { ORGAN_TYPES } = require('./Organ');
const requestSchema = new mongoose.Schema({
  patient:     { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
  organType:   { type: String, enum: ORGAN_TYPES, required: true },
  urgency:     { type: Number, min: 1, max: 5, required: true },   // 5 = critical
  listingDate: { type: Date, default: Date.now },                  // earlier wins on tie
  status:      { type: String, enum: ['WAITING', 'MATCHED', 'FULFILLED', 'CANCELLED'], default: 'WAITING', index: true }
}, { timestamps: true, collection: 'transplant_requests' });
requestSchema.index({ status: 1, organType: 1, urgency: -1, listingDate: 1 });
module.exports = mongoose.model('TransplantRequest', requestSchema);
