const mongoose = require('mongoose');
const { personFields } = require('./_person');
const patientSchema = new mongoose.Schema({
  ...personFields,
  medicalCondition: { type: String, required: true },
  hospital: { type: String, default: '' }
}, { timestamps: true, collection: 'patients' });
patientSchema.virtual('fullName').get(function () { return `${this.firstName} ${this.lastName}`; });
module.exports = mongoose.model('Patient', patientSchema);
