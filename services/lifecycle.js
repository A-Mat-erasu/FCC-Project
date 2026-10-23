const Organ = require('../models/Organ');
const Allocation = require('../models/Allocation');
const TransplantRequest = require('../models/TransplantRequest');
const audit = require('./audit');
const bus = require('./eventBus');

/**
 * Idempotently expire an organ. The conditional update means that if the Java monitor,
 * the Node sweeper and an API call race, exactly one of them performs the transition.
 * If the organ was already ALLOCATED, the allocation FAILS and the patient's request
 * returns to WAITING so they keep their place in the queue.
 */
async function expireOrgan(organId, source = 'SYSTEM') {
  const before = await Organ.findOneAndUpdate(
    { _id: organId, status: { $in: ['AVAILABLE', 'ALLOCATED'] } }, { status: 'EXPIRED' }, { new: false });
  if (!before) return null;

  let revertedRequest = null;
  if (before.status === 'ALLOCATED') {
    const alloc = await Allocation.findOneAndUpdate(
      { organ: organId, status: 'PENDING' }, { status: 'FAILED', notes: 'Organ expired before transplant' });
    if (alloc) {
      await TransplantRequest.updateOne({ _id: alloc.request, status: 'MATCHED' }, { status: 'WAITING' });
      revertedRequest = String(alloc.request);
    }
  }
  await audit.log('ORGAN_EXPIRED', 'Organ', organId, source, { previousStatus: before.status, revertedRequest });
  bus.emit('organ:expired', { organId: String(organId), organType: before.organType, previousStatus: before.status, revertedRequest });
  return before;
}

/** Fallback sweeper in Node: guarantees expiry even if the Java engine is down (edge case 6). */
async function sweepExpired() {
  const due = await Organ.find({ status: { $in: ['AVAILABLE', 'ALLOCATED'] }, expiresAt: { $lte: new Date() } }).select('_id');
  for (const o of due) await expireOrgan(o._id, 'NODE_SWEEPER');
  return due.length;
}

function init(engine) {
  engine.bridge.on('event', (ev) => {
    if (ev.event === 'ORGAN_EXPIRED') expireOrgan(ev.organId, 'JAVA_VIABILITY_MONITOR').catch((e) => console.error('[lifecycle]', e.message));
  });
  engine.bridge.on('restarted', () => engine.syncFromDb().then((n) => console.log(`[lifecycle] re-synced ${n} organs to Java engine`)).catch(() => {}));
  const t = setInterval(() => sweepExpired().catch((e) => console.error('[sweeper]', e.message)), 30000);
  t.unref();
  return sweepExpired();
}

module.exports = { expireOrgan, sweepExpired, init };
