const AuditLog = require('../models/AuditLog');
/** Append an audit entry. Never throws: auditing must not break the business operation. */
async function log(action, entityType, entityId, performedBy = 'SYSTEM', details = {}) {
  try { await AuditLog.create({ action, entityType, entityId, performedBy, details }); }
  catch (e) { console.error('[audit] failed to write', action, e.message); }
}
module.exports = { log };
