const mongoose = require('mongoose');
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true, minlength: 3 },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'COORDINATOR', 'VIEWER'], default: 'COORDINATOR' }
}, { timestamps: true, collection: 'users' });
module.exports = mongoose.model('User', userSchema);
