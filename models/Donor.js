const mongoose = require('mongoose');
const { personFields } = require('./_person');
const donorSchema = new mongoose.Schema({
  ...personFields,
  donorType: { type: String, enum: ['LIVING', 'DECEASED'], default: 'DECEASED' },
  consentVerified: { type: Boolean, default: false }
}, { timestamps: true, collection: 'donors' });
module.exports = mongoose.model('Donor', donorSchema);
