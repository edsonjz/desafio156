const express = require('express');
const cors = require('cors');
const path = require('path');
const seedDatabase = require('./db/seed');

// Initialize Express App
const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize DB & Seed Data
try {
  seedDatabase();
  console.log('Database initialized & seeded successfully.');
} catch (err) {
  console.error('Database initialization error:', err);
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaign', require('./routes/campaign'));
app.use('/api/operators', require('./routes/operators'));
app.use('/api/rules', require('./routes/rules'));
app.use('/api/points', require('./routes/points'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/ranking', require('./routes/ranking'));
app.use('/api/highlights', require('./routes/highlights'));
app.use('/api/roulette', require('./routes/roulette'));
app.use('/api/prizes', require('./routes/prizes'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/iptu', require('./routes/iptu'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend dist build if present
const frontendBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendBuildPath));
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint API não encontrado.' });
  }
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('API DESAFIO 156 ativa. Frontend não construído ainda.');
    }
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`================================================`);
    console.log(`🎯 DESAFIO 156 - Servidor rodando na porta ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`================================================`);
  });
}

module.exports = app;
