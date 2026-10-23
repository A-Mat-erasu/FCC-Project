const express = require('express');
const { asyncHandler, httpError, escapeRegex } = require('../utils/http');
const { authorize } = require('../middleware/auth');
const audit = require('../services/audit');

/** Builds a validated CRUD router (list/search/paginate, get, create, update, delete with guard). */
module.exports = function crud(Model, { entity, searchFields = [], beforeDelete }) {
  const r = express.Router();
  const write = authorize('ADMIN', 'COORDINATOR');

  r.get('/', asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const filter = {};
    if (req.query.bloodType) filter.bloodType = req.query.bloodType;
    if (req.query.q && searchFields.length) {
      const rx = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = searchFields.map((f) => ({ [f]: rx }));
    }
    const [items, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Model.countDocuments(filter)
    ]);
    res.json({ items, total, page, limit });
  }));

  r.get('/:id', asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) throw httpError(404, `${entity} not found`);
    res.json(doc);
  }));

  r.post('/', write, asyncHandler(async (req, res) => {
    const doc = await Model.create(req.body);
    await audit.log(`${entity.toUpperCase()}_CREATED`, entity, doc._id, req.user.username);
    res.status(201).json(doc);
  }));

  r.put('/:id', write, asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw httpError(404, `${entity} not found`);
    const { _id, createdAt, updatedAt, ...changes } = req.body;
    doc.set(changes);
    await doc.save();                       // save() runs validators
    await audit.log(`${entity.toUpperCase()}_UPDATED`, entity, doc._id, req.user.username, { fields: Object.keys(changes) });
    res.json(doc);
  }));

  r.delete('/:id', authorize('ADMIN'), asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw httpError(404, `${entity} not found`);
    if (beforeDelete) await beforeDelete(doc);
    await doc.deleteOne();
    await audit.log(`${entity.toUpperCase()}_DELETED`, entity, doc._id, req.user.username);
    res.json({ deleted: true });
  }));

  return r;
};
