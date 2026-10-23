// End-to-end API test: starts the real server (Express + MongoDB + Java engine) on port 3999,
// exercises the REST API, then cleans up its own data. Requires: Node 18+, MongoDB URI in .env,
// and the built jar (java-engine\build.bat nodemo).
require('dotenv').config();
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Patient, Donor, Organ, TransplantRequest, Allocation, AuditLog } = require('./models');

const PORT = 3999, BASE = `http://localhost:${PORT}/api`;
const TAG = 'APITEST', TEST_USER = 'apitest_admin', TEST_PASS = 'apitest-pass-1';
let token = null, passed = 0, failed = 0, server = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secondsAgo = (s) => new Date(Date.now() - s * 1000).toISOString();

async function api(method, path, body, { auth = true } = {}) {
  const res = await fetch(BASE + path, {
    method, headers: { 'Content-Type': 'application/json', ...(auth && token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null; try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const expectStatus = (r, status) => expect(r.status === status, `expected HTTP ${status}, got ${r.status}: ${JSON.stringify(r.data)}`);
async function test(name, fn) {
  try { await fn(); console.log('  [PASS] ' + name); passed++; } catch (e) { console.log('  [FAIL] ' + name + ' -> ' + e.message); failed++; }
}
const person = (extra) => ({ firstName: TAG, lastName: 'Person', dob: '1985-05-05', gender: 'MALE', bloodType: 'A+', phone: '9876543210', ...extra });

async function waitFor(fn, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(300); }
  throw new Error('timed out waiting');
}

async function cleanup() {
  try {
    const donors = await Donor.find({ firstName: TAG }).select('_id');
    const patients = await Patient.find({ firstName: TAG }).select('_id');
    const organs = await Organ.find({ donor: { $in: donors.map((d) => d._id) } }).select('_id');
    await Allocation.deleteMany({ organ: { $in: organs.map((o) => o._id) } });
    await TransplantRequest.deleteMany({ patient: { $in: patients.map((p) => p._id) } });
    await Organ.deleteMany({ _id: { $in: organs.map((o) => o._id) } });
    await Donor.deleteMany({ firstName: TAG });
    await Patient.deleteMany({ firstName: TAG });
    await AuditLog.collection.deleteMany({ performedBy: { $in: [TEST_USER, 'JAVA_VIABILITY_MONITOR', 'NODE_SWEEPER'] }, timestamp: { $gte: new Date(Date.now() - 3600e3) } });
    await User.deleteMany({ username: TEST_USER });
    console.log('\n  Test data cleaned up.');
  } catch (e) { console.log('\n  Cleanup warning: ' + e.message); }
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 }).catch((e) => { console.log('[FAIL] MongoDB: ' + e.message); process.exit(1); });
  await User.deleteMany({ username: TEST_USER });
  await User.create({ username: TEST_USER, passwordHash: await bcrypt.hash(TEST_PASS, 10), role: 'ADMIN' });

  console.log(`\nStarting server on port ${PORT} ...`);
  server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), JWT_SECRET: 'test-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; server.stdout.on('data', (d) => (log += d)); server.stderr.on('data', (d) => (log += d));
  try { await waitFor(async () => { try { return (await fetch(BASE + '/health')).ok; } catch { return false; } }, 25000); }
  catch { console.log('[FAIL] Server did not start. Output:\n' + log); await cleanup(); process.exit(1); }

  const ctx = {};
  console.log('\nAPI tests:');

  await test('health: db connected and Java engine running', async () => {
    const r = await api('GET', '/health', null, { auth: false }); expectStatus(r, 200);
    expect(r.data.db === 'connected', 'db not connected');
    expect(r.data.engine.running, 'Java engine not running - build the jar first (java-engine\\build.bat nodemo)');
  });
  await test('protected route without token -> 401', async () => expectStatus(await api('GET', '/patients', null, { auth: false }), 401));
  await test('login with wrong password -> 401', async () => expectStatus(await api('POST', '/auth/login', { username: TEST_USER, password: 'nope' }, { auth: false }), 401));
  await test('login OK -> JWT', async () => {
    const r = await api('POST', '/auth/login', { username: TEST_USER, password: TEST_PASS }, { auth: false }); expectStatus(r, 200);
    token = r.data.token; expect(token, 'no token');
  });

  await test('create donor (A+, consent verified)', async () => {
    const r = await api('POST', '/donors', person({ bloodType: 'A+', consentVerified: true })); expectStatus(r, 201); ctx.donor = r.data;
  });
  await test('create donor without consent', async () => {
    const r = await api('POST', '/donors', person({ bloodType: 'A+', consentVerified: false })); expectStatus(r, 201); ctx.noConsent = r.data;
  });
  await test('invalid blood type -> 400', async () => expectStatus(await api('POST', '/patients', person({ bloodType: 'Z+', medicalCondition: 'x' })), 400));

  // Patients: A & B tie on urgency 5 (A listed earlier). C lower urgency. D (O-) is blood-incompatible with an A+ organ.
  for (const [k, blood] of [['A', 'AB+'], ['B', 'AB+'], ['C', 'A+'], ['D', 'O-']]) {
    await test(`create patient ${k} (${blood})`, async () => {
      const r = await api('POST', '/patients', person({ lastName: k, bloodType: blood, medicalCondition: 'Kidney failure' })); expectStatus(r, 201); ctx['p' + k] = r.data;
    });
  }
  const reqSpec = { A: [5, 864000], B: [5, 432000], C: [3, 2592000], D: [5, 3456000] };
  for (const k of Object.keys(reqSpec)) {
    await test(`create KIDNEY request for ${k}`, async () => {
      const r = await api('POST', '/requests', { patient: ctx['p' + k]._id, organType: 'KIDNEY', urgency: reqSpec[k][0], listingDate: secondsAgo(reqSpec[k][1]) });
      expectStatus(r, 201); ctx['r' + k] = r.data;
    });
  }
  await test('urgency 9 -> 400', async () => expectStatus(await api('POST', '/requests', { patient: ctx.pC._id, organType: 'LIVER', urgency: 9 }), 400));
  await test('duplicate active request -> 409', async () => expectStatus(await api('POST', '/requests', { patient: ctx.pA._id, organType: 'KIDNEY', urgency: 4 }), 409));

  await test('organ from donor without consent -> 422', async () => expectStatus(await api('POST', '/organs', { donor: ctx.noConsent._id, organType: 'KIDNEY' }), 422));
  await test('already-expired organ rejected -> 422', async () =>
    expectStatus(await api('POST', '/organs', { donor: ctx.donor._id, organType: 'KIDNEY', harvestDatetime: secondsAgo(30 * 3600) }), 422));
  await test('register kidney organ (default 24h viability)', async () => {
    const r = await api('POST', '/organs', { donor: ctx.donor._id, organType: 'KIDNEY' }); expectStatus(r, 201); ctx.organ = r.data;
    expect(r.data.secondsRemaining > 86000, 'bad countdown');
  });

  await test('candidates ranked A, B, C (urgency, then earlier listing; D excluded by blood type)', async () => {
    const r = await api('GET', `/organs/${ctx.organ._id}/candidates`); expectStatus(r, 200);
    const order = r.data.map((x) => x.patient.lastName).join(',');
    expect(order === 'A,B,C', 'order was ' + order);
  });
  await test('allocate -> patient A, organ ALLOCATED', async () => {
    const r = await api('POST', `/organs/${ctx.organ._id}/allocate`); expectStatus(r, 201);
    expect(r.data.patient.lastName === 'A', 'wrong patient ' + r.data.patient.lastName);
    expect((await api('GET', `/organs/${ctx.organ._id}`)).data.status === 'ALLOCATED', 'status not ALLOCATED');
  });
  await test('allocate same organ again -> 409', async () => expectStatus(await api('POST', `/organs/${ctx.organ._id}/allocate`), 409));
  await test('confirm transplant -> TRANSPLANTED, request FULFILLED', async () => {
    const r = await api('POST', `/organs/${ctx.organ._id}/confirm-transplant`); expectStatus(r, 200);
    expect(r.data.status === 'TRANSPLANTED', 'status ' + r.data.status);
    const reqs = (await api('GET', '/requests?status=FULFILLED')).data.items;
    expect(reqs.some((x) => x._id === ctx.rA._id), 'request A not FULFILLED');
  });
  await test('allocating a TRANSPLANTED organ -> 409', async () => expectStatus(await api('POST', `/organs/${ctx.organ._id}/allocate`), 409));
  await test('no compatible waiting patient (LIVER) -> 404', async () => {
    const o = await api('POST', '/organs', { donor: ctx.donor._id, organType: 'LIVER' }); expectStatus(o, 201);
    expectStatus(await api('POST', `/organs/${o.data._id}/allocate`), 404);
  });

  // --- Real-time viability: organ with ~6 seconds left (30 min viability, harvested 29m54s ago)
  await test('Java ViabilityMonitorThread expires an AVAILABLE organ (+ audit entry)', async () => {
    const r = await api('POST', '/organs', { donor: ctx.donor._id, organType: 'KIDNEY', viabilityHours: 0.5, harvestDatetime: secondsAgo(1794) });
    expectStatus(r, 201);
    await waitFor(async () => (await api('GET', `/organs/${r.data._id}`)).data.status === 'EXPIRED');
    const audit = (await api('GET', '/audit?action=ORGAN_EXPIRED')).data.items;
    expect(audit.some((a) => String(a.entityId) === r.data._id), 'no ORGAN_EXPIRED audit entry');
  });
  await test('allocated organ expires -> allocation FAILED, patient returns to WAITING', async () => {
    const o = await api('POST', '/organs', { donor: ctx.donor._id, organType: 'KIDNEY', viabilityHours: 0.5, harvestDatetime: secondsAgo(1794) });
    expectStatus(o, 201);
    const a = await api('POST', `/organs/${o.data._id}/allocate`); expectStatus(a, 201);
    const requestId = a.data.request;
    await waitFor(async () => (await api('GET', `/organs/${o.data._id}`)).data.status === 'EXPIRED');
    const failedAlloc = (await api('GET', '/allocations?status=FAILED')).data.items;
    expect(failedAlloc.some((x) => x.organ._id === o.data._id), 'allocation not FAILED');
    const waiting = (await api('GET', '/requests?status=WAITING')).data.items;
    expect(waiting.some((x) => x._id === String(requestId)), 'request not back to WAITING');
    expectStatus(await api('POST', `/organs/${o.data._id}/allocate`), 409);   // EXPIRED organ can never be allocated again
  });

  await test('cannot delete patient with active request -> 409', async () => expectStatus(await api('DELETE', `/patients/${ctx.pB._id}`), 409));
  await test('cancel WAITING request', async () => expectStatus(await api('PATCH', `/requests/${ctx.rD._id}/cancel`), 200));
  await test('stats endpoint', async () => { const r = await api('GET', '/stats'); expectStatus(r, 200); expect(r.data.organs.TRANSPLANTED >= 1, 'stats wrong'); });
  await test('audit log contains ALLOCATION_CREATED', async () => {
    const r = await api('GET', '/audit?action=ALLOCATION_CREATED'); expectStatus(r, 200); expect(r.data.items.length > 0, 'empty');
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed) console.log('\n--- server log (tail) ---\n' + log.split('\n').slice(-25).join('\n'));
  server.kill();
  await sleep(500);
  await cleanup();
  await mongoose.disconnect();
  process.exit(failed ? 1 : 0);
})();
