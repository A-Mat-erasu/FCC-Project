const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Connect to MongoDB (local or Atlas) with retry + event logging.
 * Edge case 7: mid-operation disconnects are surfaced via events,
 * Mongoose auto-reconnects; multi-step writes use withTransaction().
 */
async function connectDB(uri = process.env.MONGO_URI) {
  if (!uri) throw new Error('MONGO_URI is not defined in .env');

  mongoose.connection.on('connected', () => console.log('[MongoDB] connected'));
  mongoose.connection.on('disconnected', () => console.warn('[MongoDB] disconnected - driver will retry'));
  mongoose.connection.on('reconnected', () => console.log('[MongoDB] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[MongoDB] error:', e.message));

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      return mongoose.connection;
    } catch (err) {
      console.error(`[MongoDB] attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`);
      if (attempt === MAX_RETRIES) throw err;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

/**
 * Run fn(session) inside a transaction (needs replica set / Atlas).
 * Falls back to a non-transactional run on a standalone local mongod.
 */
async function withTransaction(fn) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database unavailable (readyState=' + mongoose.connection.readyState + ')');
  }
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } catch (err) {
    if (/Transaction numbers are only allowed|replica set/i.test(err.message)) {
      console.warn('[MongoDB] transactions unsupported (standalone); running without one');
      return fn(null);
    }
    throw err; // aborted automatically -> no partial writes
  } finally {
    session.endSession();
  }
}

module.exports = { connectDB, withTransaction };
