const mongoose = require('mongoose');
const allocationSchema = new mongoose.Schema({
  organ:     { type: mongoose.Schema.Types.ObjectId, ref: 'Organ', required: true, unique: true }, // one allocation per organ
  request:   { type: mongoose.Schema.Types.ObjectId, ref: 'TransplantRequest', required: true },
  patient:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  allocatedAt: { type: Date, default: Date.now },
  status:    { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
  notes:     String
}, { timestamps: true, collection: 'allocations' });
module.exports = mongoose.model('Allocation', allocationSchema);
