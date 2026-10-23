class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}
const httpError = (status, message, code) => new HttpError(status, message, code);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
module.exports = { HttpError, httpError, asyncHandler, escapeRegex };
