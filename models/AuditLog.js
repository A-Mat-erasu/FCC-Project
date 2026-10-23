const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({
  action:     { type: String, required: true, index: true },  // e.g. ALLOCATION_CREATED, ORGAN_EXPIRED
  entityType: { type: String, required: true },
  entityId:   { type: mongoose.Schema.Types.ObjectId },
  performedBy:{ type: String, default: 'SYSTEM' },
  details:    { type: mongoose.Schema.Types.Mixed },
  timestamp:  { type: Date, default: Date.now, index: true }
}, { collection: 'audit_logs' });
// Audit logs are append-only
auditSchema.pre(['updateOne', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function () {
  throw new Error('AuditLog is append-only');
});
module.exports = mongoose.model('AuditLog', auditSchema);
