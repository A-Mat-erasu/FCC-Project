const Allocation = require('../models/Allocation');
const AuditLog = require('../models/AuditLog');
const { Patient, Donor, Organ, TransplantRequest } = require('../models');
const engine = require('../services/engineService');

const countBy = async (Model, field) => Object.fromEntries((await Model.aggregate([{ $group: { _id: '$' + field, n: { $sum: 1 } } }])).map((x) => [x._id, x.n]));

exports.allocations = async (req, res) => {
  const filter = req.query.status ? { status: req.query.status } : {};
  const items = await Allocation.find(filter)
    .populate('patient', 'firstName lastName bloodType').populate('organ', 'organType bloodType status expiresAt')
    .sort({ allocatedAt: -1 }).limit(200).lean();
  res.json({ items, total: items.length });
};

exports.audit = async (req, res) => {
  const filter = req.query.action ? { action: req.query.action } : {};
  const limit = Math.min(500, parseInt(req.query.limit) || 100);
  res.json({ items: await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).lean() });
};

exports.stats = async (req, res) => {
  const [patients, donors, organsByStatus, requestsByStatus] = await Promise.all([
    Patient.countDocuments(), Donor.countDocuments(), countBy(Organ, 'status'), countBy(TransplantRequest, 'status')]);
  res.json({ patients, donors, organs: organsByStatus, requests: requestsByStatus, engine: engine.status() });
};
