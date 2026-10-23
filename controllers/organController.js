const Organ = require('../models/Organ');
const Donor = require('../models/Donor');
const Allocation = require('../models/Allocation');
const TransplantRequest = require('../models/TransplantRequest');
const engine = require('../services/engineService');
const lifecycle = require('../services/lifecycle');
const audit = require('../services/audit');
const bus = require('../services/eventBus');
const { httpError } = require('../utils/http');

const DEFAULT_VIABILITY = { HEART: 4, LUNG: 6, INTESTINE: 8, LIVER: 12, PANCREAS: 12, KIDNEY: 24 };
const withTiming = (o) => ({ ...o, secondsRemaining: Math.max(0, Math.floor((new Date(o.expiresAt) - Date.now()) / 1000)) });
const quietWatch = (organs) => engine.watch(organs).catch((e) => console.warn('[engine] watch skipped:', e.message));

exports.create = async (req, res) => {
  const { donor: donorId, organType, harvestDatetime, viabilityHours } = req.body;
  const donor = await Donor.findById(donorId);
  if (!donor) throw httpError(404, 'Donor not found');
  if (!donor.consentVerified) throw httpError(422, 'Donor consent must be verified before registering organs');

  const harvest = harvestDatetime ? new Date(harvestDatetime) : new Date();
  if (isNaN(harvest)) throw httpError(400, 'Invalid harvestDatetime');
  if (harvest.getTime() > Date.now() + 5 * 60000) throw httpError(400, 'harvestDatetime cannot be in the future');

  const organ = new Organ({
    donor: donor._id, organType, bloodType: donor.bloodType, harvestDatetime: harvest,
    viabilityHours: viabilityHours ?? DEFAULT_VIABILITY[organType]
  });
  await organ.validate();
  if (organ.expiresAt <= new Date()) throw httpError(422, 'Organ is already past its viability window', 'ORGAN_EXPIRED');
  await organ.save();

  await quietWatch([organ]);
  await audit.log('ORGAN_REGISTERED', 'Organ', organ._id, req.user.username, { organType, bloodType: organ.bloodType });
  bus.emit('organ:registered', { organId: String(organ._id), organType, expiresAt: organ.expiresAt });
  res.status(201).json(withTiming(organ.toObject()));
};

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.organType) filter.organType = req.query.organType;
  const organs = await Organ.find(filter).populate('donor', 'firstName lastName bloodType').sort({ expiresAt: 1 }).limit(200).lean();
  res.json({ items: organs.map(withTiming), total: organs.length });
};

exports.get = async (req, res) => {
  const organ = await Organ.findById(req.params.id).populate('donor', 'firstName lastName bloodType').lean();
  if (!organ) throw httpError(404, 'Organ not found');
  res.json(withTiming(organ));
};

const waitingRequestsFor = (organType) =>
  TransplantRequest.find({ status: 'WAITING', organType }).populate('patient', 'firstName lastName bloodType');

// Ranked candidates (Java PriorityQueue) without allocating.
exports.candidates = async (req, res) => {
  const organ = await Organ.findById(req.params.id);
  if (!organ) throw httpError(404, 'Organ not found');
  const requests = (await waitingRequestsFor(organ.organType)).filter((r) => r.patient);
  const ranked = await engine.rank(organ, requests);
  const byId = new Map(requests.map((r) => [String(r._id), r]));
  res.json(ranked.map((x) => ({ ...x, patient: byId.get(x.requestId).patient })));
};

exports.allocate = async (req, res) => {
  const organ = await Organ.findById(req.params.id);
  if (!organ) throw httpError(404, 'Organ not found');
  const user = req.user.username;

  const requests = (await waitingRequestsFor(organ.organType)).filter((r) => r.patient);

  let result;
  try {
    result = await engine.allocate(organ, requests);       // Java: validate state, rank via PriorityQueue, re-check expiry
  } catch (e) {
    if (e.code === 'ORGAN_EXPIRED') { await lifecycle.expireOrgan(organ._id, user); }
    if (e.code === 'NO_MATCH') await audit.log('ALLOCATION_NO_MATCH', 'Organ', organ._id, user, { organType: organ.organType });
    throw e;
  }

  // Commit to MongoDB with conditional updates: safe against concurrent allocations (edge cases 3, 5, 7).
  const claimedOrgan = await Organ.findOneAndUpdate({ _id: organ._id, status: 'AVAILABLE' }, { status: 'ALLOCATED' }, { new: true });
  if (!claimedOrgan) throw httpError(409, 'Organ was changed by another request; refresh and retry', 'CONFLICT');

  const claimedReq = await TransplantRequest.findOneAndUpdate({ _id: result.requestId, status: 'WAITING' }, { status: 'MATCHED' });
  if (!claimedReq) {
    await Organ.updateOne({ _id: organ._id }, { status: 'AVAILABLE' });
    throw httpError(409, 'Candidate was matched by another request; retry', 'CONFLICT');
  }

  let allocation;
  try {
    allocation = await Allocation.create({ organ: organ._id, request: claimedReq._id, patient: claimedReq.patient });
  } catch (e) {                                              // compensate so no half-finished state remains
    await Organ.updateOne({ _id: organ._id }, { status: 'AVAILABLE' });
    await TransplantRequest.updateOne({ _id: claimedReq._id }, { status: 'WAITING' });
    throw e;
  }

  await quietWatch([claimedOrgan]);
  await audit.log('ALLOCATION_CREATED', 'Allocation', allocation._id, user, { organ: String(organ._id), patient: String(claimedReq.patient), request: String(claimedReq._id) });
  bus.emit('allocation:created', { allocationId: String(allocation._id), organId: String(organ._id), patientId: String(claimedReq.patient), organType: organ.organType });
  res.status(201).json(await allocation.populate([{ path: 'patient', select: 'firstName lastName bloodType' }, { path: 'organ', select: 'organType bloodType expiresAt status' }]));
};

exports.confirmTransplant = async (req, res) => {
  const organ = await Organ.findById(req.params.id);
  if (!organ) throw httpError(404, 'Organ not found');
  if (['AVAILABLE', 'ALLOCATED'].includes(organ.status) && organ.expiresAt <= new Date()) {
    await lifecycle.expireOrgan(organ._id, req.user.username);
    throw httpError(410, 'Organ expired before transplant could be confirmed', 'ORGAN_EXPIRED');
  }
  const updated = await Organ.findOneAndUpdate({ _id: organ._id, status: 'ALLOCATED' }, { status: 'TRANSPLANTED' }, { new: true });
  if (!updated) throw httpError(409, `Organ must be ALLOCATED to confirm transplant (current: ${organ.status})`, 'INVALID_ALLOCATION');

  const alloc = await Allocation.findOneAndUpdate({ organ: organ._id, status: 'PENDING' }, { status: 'COMPLETED' }, { new: true });
  if (alloc) await TransplantRequest.updateOne({ _id: alloc.request }, { status: 'FULFILLED' });
  await quietWatch([updated]);
  await audit.log('TRANSPLANT_CONFIRMED', 'Organ', organ._id, req.user.username);
  bus.emit('transplant:confirmed', { organId: String(organ._id) });
  res.json(withTiming(updated.toObject()));
};
