require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
require('./models'); // register all schemas
const engine = require('./services/engineService');
const lifecycle = require('./services/lifecycle');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  engine: engine.status()
}));
app.use('/api', require('./routes'));
app.use('/api', notFound);
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
(async () => {
  try {
    await connectDB();
    engine.start();                                   // spawn Java engine (non-fatal if jar missing)
    await lifecycle.init(engine);                     // expiry events + Node fallback sweeper
    await engine.syncFromDb().then((n) => console.log(`[engine] watching ${n} live organs`)).catch((e) => console.warn('[engine] initial sync skipped:', e.message));

    const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    const shutdown = async () => { server.close(); engine.stop(); await mongoose.disconnect(); process.exit(0); };
    process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  } catch (e) {
    console.error('Startup failed:', e.message); process.exit(1);
  }
})();

module.exports = app;
