const express = require('express');
const { asyncHandler: ah } = require('../utils/http');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const { requireDb } = require('../middleware/errorHandler');
const crud = require('../controllers/crudFactory');
const auth = require('../controllers/authController');
const organs = require('../controllers/organController');
const requests = require('../controllers/requestController');
const info = require('../controllers/infoController');
const { Patient, Donor, TransplantRequest, Organ } = require('../models');
const { httpError } = require('../utils/http');

const router = express.Router();
const write = authorize('ADMIN', 'COORDINATOR');

router.use(requireDb);

// --- public ---
router.post('/auth/login', ah(auth.login));
router.post('/auth/register', optionalAuth, ah(auth.register));

// --- everything below needs a valid JWT ---
router.use(authenticate);
router.get('/auth/me', auth.me);

router.use('/patients', crud(Patient, {
  entity: 'Patient', searchFields: ['firstName', 'lastName'],
  beforeDelete: async (p) => {
    if (await TransplantRequest.exists({ patient: p._id, status: { $in: ['WAITING', 'MATCHED'] } }))
      throw httpError(409, 'Cannot delete a patient with active transplant requests');
  }
}));
router.use('/donors', crud(Donor, {
  entity: 'Donor', searchFields: ['firstName', 'lastName'],
  beforeDelete: async (d) => {
    if (await Organ.exists({ donor: d._id, status: { $in: ['AVAILABLE', 'ALLOCATED'] } }))
      throw httpError(409, 'Cannot delete a donor with live organs');
  }
}));

router.post('/organs', write, ah(organs.create));
router.get('/organs', ah(organs.list));
router.get('/organs/:id', ah(organs.get));
router.get('/organs/:id/candidates', ah(organs.candidates));
router.post('/organs/:id/allocate', write, ah(organs.allocate));
router.post('/organs/:id/confirm-transplant', write, ah(organs.confirmTransplant));

router.post('/requests', write, ah(requests.create));
router.get('/requests', ah(requests.list));
router.patch('/requests/:id/cancel', write, ah(requests.cancel));

router.get('/allocations', ah(info.allocations));
router.get('/audit', authorize('ADMIN', 'COORDINATOR'), ah(info.audit));
router.get('/stats', ah(info.stats));

module.exports = router;
