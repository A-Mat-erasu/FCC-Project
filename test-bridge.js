// Tests the Node <-> Java bridge (no MongoDB needed). Requires the jar: java-engine\build.bat nodemo
process.env.ENGINE_DEBUG = '1';
process.env.ENGINE_MONITOR_INTERVAL_MS = '200';
const { JavaBridge } = require('./services/javaBridge');

let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); console.log('  [PASS] ' + name); passed++; } catch (e) { console.log('  [FAIL] ' + name + ' -> ' + e.message); failed++; } };
const rejects = async (p) => { try { await p; } catch (e) { return e; } throw new Error('expected rejection'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();
const organ = (o = {}) => ({ id: 'O1', organType: 'KIDNEY', donorId: 'D1', bloodType: 'A+', harvestTime: hoursAgo(1), viabilityHours: 24, status: 'AVAILABLE', ...o });
const req = (id, blood, urg, daysAgo, type = 'KIDNEY') => ({ id, patientId: 'P-' + id, bloodType: blood, organType: type, urgency: urg, listingDate: hoursAgo(daysAgo * 24), status: 'WAITING' });

(async () => {
  const b = new JavaBridge({ timeoutMs: 800, restartBaseMs: 300 });
  if (!b.start()) process.exit(1);
  console.log('\nBridge tests:');

  await test('ping', async () => { const r = await b.call('ping'); if (!r.pong) throw new Error('no pong'); });
  await test('blood compatibility O- -> AB+ true, AB+ -> O- false', async () => {
    if (!(await b.call('compatible', { donorType: 'O-', recipientType: 'AB+' }))) throw new Error('1');
    if (await b.call('compatible', { donorType: 'AB+', recipientType: 'O-' })) throw new Error('2');
  });
  await test('rank: urgency desc, then earlier listing; incompatible excluded', async () => {
    const r = await b.call('rank', { organ: organ(), requests: [req('C', 'A+', 3, 30), req('B', 'AB+', 5, 5), req('A', 'AB+', 5, 10), req('D', 'O-', 5, 40)] });
    const order = r.map((x) => x.requestId).join(',');
    if (order !== 'A,B,C') throw new Error('order was ' + order);
  });
  await test('allocate picks top candidate', async () => {
    const r = await b.call('allocate', { organ: organ(), requests: [req('B', 'AB+', 5, 5), req('A', 'AB+', 5, 10)] });
    if (r.requestId !== 'A') throw new Error('got ' + r.requestId);
  });
  await test('NO_MATCH (404)', async () => {
    const e = await rejects(b.call('allocate', { organ: organ(), requests: [req('X', 'A+', 5, 1, 'LIVER')] }));
    if (e.code !== 'NO_MATCH' || e.status !== 404) throw new Error(e.code);
  });
  await test('ORGAN_EXPIRED (410) for already-expired organ', async () => {
    const e = await rejects(b.call('allocate', { organ: organ({ harvestTime: hoursAgo(30) }), requests: [req('A', 'A+', 5, 1)] }));
    if (e.code !== 'ORGAN_EXPIRED' || e.status !== 410) throw new Error(e.code);
  });
  await test('INVALID_ALLOCATION (409) for TRANSPLANTED organ', async () => {
    const e = await rejects(b.call('allocate', { organ: organ({ status: 'TRANSPLANTED' }), requests: [req('A', 'A+', 5, 1)] }));
    if (e.code !== 'INVALID_ALLOCATION' || e.status !== 409) throw new Error(e.code);
  });
  await test('BAD_REQUEST for malformed payload', async () => {
    const e = await rejects(b.call('allocate', { organ: { id: 'x' }, requests: [] }));
    if (e.code !== 'BAD_REQUEST') throw new Error(e.code);
  });
  await test('ViabilityMonitorThread pushes ORGAN_EXPIRED event', async () => {
    const got = new Promise((res) => b.once('event', res));
    await b.call('watch', { organs: [organ({ id: 'SOON', harvestTime: new Date(Date.now() - 24 * 3600e3 + 1500).toISOString() })] });
    const ev = await Promise.race([got, sleep(5000).then(() => { throw new Error('no event in 5s'); })]);
    if (ev.event !== 'ORGAN_EXPIRED' || ev.organId !== 'SOON') throw new Error(JSON.stringify(ev));
  });
  await test('timeout -> ENGINE_TIMEOUT (504), engine auto-restarts', async () => {
    const e = await rejects(b.call('sleep', { ms: 5000 }));
    if (e.code !== 'ENGINE_TIMEOUT' || e.status !== 504) throw new Error(e.code);
    await sleep(1200);
    await b.call('ping');
  });
  await test('crash -> ENGINE_CRASHED (503), engine auto-restarts', async () => {
    const e = await rejects(b.call('crash'));
    if (e.code !== 'ENGINE_CRASHED') throw new Error(e.code);
    const down = await rejects(b.call('ping'));
    if (down.code !== 'ENGINE_DOWN') throw new Error('expected ENGINE_DOWN, got ' + down.code);
    await sleep(1200);
    await b.call('ping');
  });

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  b.stop();
  setTimeout(() => process.exit(failed ? 1 : 0), 300);
})();
