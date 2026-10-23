const mongoose = require('mongoose');

function requireDb(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Database unavailable, please retry shortly', code: 'DB_DOWN' });
  next();
}

function notFound(req, res) { res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` }); }

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500, body = { error: err.message, code: err.code };

  if (err.name === 'ValidationError') {
    status = 400; body = { error: 'Validation failed', code: 'VALIDATION', details: Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])) };
  } else if (err.name === 'CastError') {
    status = 400; body = { error: `Invalid ${err.path}: ${err.value}`, code: 'BAD_ID' };
  } else if (err.code === 11000) {
    status = 409; body = { error: 'Duplicate entry', code: 'DUPLICATE', details: err.keyValue };
  } else if (err.type === 'entity.parse.failed') {
    status = 400; body = { error: 'Malformed JSON body', code: 'BAD_JSON' };
  } else if (/Mongo(Network|ServerSelection)|topology/i.test(err.name || '')) {
    status = 503; body = { error: 'Database connection lost; operation not completed', code: 'DB_DOWN' };
  }
  if (status >= 500) console.error('[error]', err);
  res.status(status).json(body);
}

module.exports = { requireDb, notFound, errorHandler };
