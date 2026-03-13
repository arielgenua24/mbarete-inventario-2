const express = require('express');
const cors = require('cors');
const authHandler = require('./auth');
const openrouterHandler = require('./openrouter');

const app = express();
const PORT = 3001;

// Enable CORS for local development
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'ImageKit Auth API is running',
    endpoints: {
      auth: '/api/auth',
      openrouter: '/api/openrouter'
    }
  });
});

// ImageKit auth endpoint
app.get('/api/auth', (req, res) => {
  authHandler(req, res);
});

// OpenRouter proxy endpoint
app.post('/api/openrouter', (req, res) => {
  openrouterHandler(req, res);
});

app.listen(PORT, () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Backend API Server Started!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔑 Auth:   http://localhost:${PORT}/api/auth`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Ready for image uploads! 🚀');
});
