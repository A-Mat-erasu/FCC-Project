const TransplantRequest = require('../models/TransplantRequest');
const Patient = require('../models/Patient');
const audit = require('../services/audit');
const bus = require('../services/eventBus');
const { httpError } = require('../utils/http');

exports.create = async (req, res) => {
  const { patient: patientId, organType, urgency, listingDate } = req.body;
  const patient = await Patient.findById(patientId);
  if (!patient) throw httpError(404, 'Patient not found');
  const dup = await TransplantRequest.findOne({ patient: patient._id, organType, status: { $in: ['WAITING', 'MATCHED'] } });
  if (dup) throw httpError(409, `Patient already has an active ${organType} request`, 'DUPLICATE_REQUEST');

  const doc = await TransplantRequest.create({ patient: patient._id, organType, urgency, ...(listingDate && { listingDate }) });
  await audit.log('REQUEST_CREATED', 'TransplantRequest', doc._id, req.user.username, { organType, urgency });
  bus.emit('request:created', { requestId: String(doc._id), organType, urgency });
  res.status(201).json(doc);
};

exports.list = async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.organType) filter.organType = req.query.organType;
  const items = await TransplantRequest.find(filter).populate('patient', 'firstName lastName bloodType')
    .sort({ urgency: -1, listingDate: 1 }).limit(200).lean();   // same order the Java queue uses
  res.json({ items, total: items.length });
};

exports.cancel = async (req, res) => {
  const doc = await TransplantRequest.findOneAndUpdate({ _id: req.params.id, status: 'WAITING' }, { status: 'CANCELLED' }, { new: true });
  if (!doc) {
    const exists = await TransplantRequest.findById(req.params.id);
    throw exists ? httpError(409, `Only WAITING requests can be cancelled (current: ${exists.status})`) : httpError(404, 'Request not found');
  }
  await audit.log('REQUEST_CANCELLED', 'TransplantRequest', doc._id, req.user.username);
  res.json(doc);
};
