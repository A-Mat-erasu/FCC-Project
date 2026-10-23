const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { sign } = require('../middleware/auth');
const { httpError } = require('../utils/http');
const audit = require('../services/audit');

// First user ever becomes ADMIN (bootstrap); afterwards only an ADMIN can create users.
exports.register = async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || password.length < 6) throw httpError(400, 'username and password (min 6 chars) are required');
  const count = await User.countDocuments();
  if (count > 0 && !(req.user && req.user.role === 'ADMIN')) throw httpError(403, 'Only an ADMIN can create users');
  const user = await User.create({
    username, passwordHash: await bcrypt.hash(password, 10),
    role: count === 0 ? 'ADMIN' : (['ADMIN', 'COORDINATOR', 'VIEWER'].includes(role) ? role : 'COORDINATOR')
  });
  await audit.log('USER_CREATED', 'User', user._id, req.user ? req.user.username : 'BOOTSTRAP', { role: user.role });
  res.status(201).json({ id: user._id, username: user.username, role: user.role });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  const user = username && await User.findOne({ username });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) throw httpError(401, 'Invalid username or password');
  res.json({ token: sign(user), user: { id: user._id, username: user.username, role: user.role } });
};

exports.me = (req, res) => res.json(req.user);
