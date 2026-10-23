const jwt = require('jsonwebtoken');
const { httpError } = require('../utils/http');

const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';
if (!process.env.JWT_SECRET) console.warn('[auth] JWT_SECRET not set - using insecure dev secret');

const sign = (user) => jwt.sign({ id: String(user._id), username: user.username, role: user.role }, SECRET, { expiresIn: '8h' });
const verify = (token) => jwt.verify(token, SECRET);
const bearer = (req) => (req.headers.authorization || '').startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;

function authenticate(req, res, next) {
  const token = bearer(req);
  if (!token) return next(httpError(401, 'Authentication required'));
  try { req.user = verify(token); next(); } catch { next(httpError(401, 'Invalid or expired token')); }
}
function optionalAuth(req, res, next) {
  const token = bearer(req);
  if (token) { try { req.user = verify(token); } catch { /* treated as anonymous */ } }
  next();
}
const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user && req.user.role) ? next() : next(httpError(403, `Requires role: ${roles.join(' or ')}`));

module.exports = { sign, verify, authenticate, optionalAuth, authorize };
