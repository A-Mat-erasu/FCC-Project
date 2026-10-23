// Verifies: .env, MongoDB connection, all 7 schemas, validation rules, indexes, append-only audit log.
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, withTransaction } = require('./config/db');
const { Donor, Patient, Organ, TransplantRequest, Allocation, AuditLog, User } = require('./models');

let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  [PASS] ' + name); passed++; }
  catch (e) { console.log('  [FAIL] ' + name + ' -> ' + e.message); failed++; }
}
const expectReject = async (p, label) => {
  try { await p; } catch (e) { return e; }
  throw new Error('expected rejection: ' + label);
};

const person = (extra = {}) => ({
  firstName: 'Test', lastName: 'User', dob: new Date('1990-01-01'),
  gender: 'FEMALE', bloodType: 'O-', phone: '9876543210', ...extra
});

(async () => {
  const created = {};
  console.log('\nConnecting to: ' + (process.env.MONGO_URI || '(MONGO_URI missing)').replace(/\/\/.*@/, '//***:***@'));
  try { await connectDB(); }
  catch (e) {
    console.log('\n[FAIL] Cannot connect to MongoDB: ' + e.message);
    console.log('  - Atlas: check password, Network Access (allow your IP / 0.0.0.0/0), URI format');
    console.log('  - Local: make sure the MongoDB service is running');
    process.exit(1);
  }
  console.log('\nRunning tests:');
  await Promise.all([Donor, Patient, Organ, TransplantRequest, Allocation, AuditLog, User].map(m => m.init())); // build indexes

  await test('Create donor', async () => { created.donor = await Donor.create(person({ donorType: 'DECEASED', consentVerified: true })); });
  await test('Create patient', async () => { created.patient = await Patient.create(person({ bloodType: 'A+', medicalCondition: 'Kidney failure' })); });

  await test('Create organ and auto-compute expiresAt', async () => {
    const harvest = new Date();
    created.organ = await Organ.create({ donor: created.donor._id, organType: 'KIDNEY', bloodType: 'O-', harvestDatetime: harvest, viabilityHours: 24 });
    const diffH = (created.organ.expiresAt - harvest) / 3600000;
    if (Math.abs(diffH - 24) > 0.001) throw new Error('expiresAt wrong: ' + diffH);
  });

  await test('Create transplant request', async () => {
    created.request = await TransplantRequest.create({ patient: created.patient._id, organType: 'KIDNEY', urgency: 5 });
  });

  await test('Create allocation', async () => {
    created.alloc = await Allocation.create({ organ: created.organ._id, request: created.request._id, patient: created.patient._id });
  });

  await test('Duplicate allocation for same organ is rejected (unique index)', async () => {
    const e = await expectReject(Allocation.create({ organ: created.organ._id, request: created.request._id, patient: created.patient._id }), 'dup');
    if (e.code !== 11000) throw new Error('wrong error: ' + e.message);
  });

  await test('Invalid blood type rejected', async () => { await expectReject(Donor.create(person({ bloodType: 'Z+' })), 'bad blood'); });
  await test('Urgency 6 rejected', async () => { await expectReject(TransplantRequest.create({ patient: created.patient._id, organType: 'KIDNEY', urgency: 6 }), 'urgency'); });
  await test('Invalid organ type rejected', async () => { await expectReject(Organ.create({ donor: created.donor._id, organType: 'BRAIN', bloodType: 'O-', harvestDatetime: new Date(), viabilityHours: 5 }), 'organ type'); });
  await test('Viability > 72h rejected', async () => { await expectReject(Organ.create({ donor: created.donor._id, organType: 'KIDNEY', bloodType: 'O-', harvestDatetime: new Date(), viabilityHours: 100 }), 'viability'); });

  await test('Audit log insert + append-only protection', async () => {
    created.audit = await AuditLog.create({ action: 'TEST_RUN', entityType: 'Organ', entityId: created.organ._id, performedBy: 'TEST' });
    await expectReject(AuditLog.updateOne({ _id: created.audit._id }, { action: 'HACKED' }), 'update audit');
    await expectReject(AuditLog.deleteOne({ _id: created.audit._id }), 'delete audit');
  });

  await test('Query: waiting requests sorted by urgency desc, listingDate asc', async () => {
    const list = await TransplantRequest.find({ status: 'WAITING', organType: 'KIDNEY' }).sort({ urgency: -1, listingDate: 1 });
    if (!list.length) throw new Error('no results');
  });

  await test('withTransaction helper runs', async () => {
    const r = await withTransaction(async () => 'ok');
    if (r !== 'ok') throw new Error('bad result');
  });

  // Cleanup (collection-level delete bypasses the append-only hook on purpose)
  try {
    await Allocation.deleteMany({ _id: created.alloc?._id });
    await TransplantRequest.deleteMany({ patient: created.patient?._id });
    await Organ.deleteMany({ donor: created.donor?._id });
    await Donor.deleteMany({ _id: created.donor?._id });
    await Patient.deleteMany({ _id: created.patient?._id });
    await AuditLog.collection.deleteMany({ performedBy: 'TEST' });
    console.log('\n  Test data cleaned up.');
  } catch (e) { console.log('\n  Cleanup warning: ' + e.message); }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
