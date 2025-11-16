const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const stockRoutes = require('./routes/stocks');
const startupRefreshService = require('./services/startupRefreshService');
const priceService = require('./services/priceService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory (React app)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use('/api/stocks', stockRoutes);

// Catch-all route - serve React app for any non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Startup initialization
async function startup() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 STARTING STOCK WATCHLIST APPLICATION');
  console.log('='.repeat(60) + '\n');

  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check price service availability
  console.log('📈 Checking price service availability...');
  const priceServiceAvailable = await priceService.isAvailable();
  
  if (!priceServiceAvailable) {
    console.warn('⚠️  Price service not available yet, will retry later');
  }

  // Perform startup refresh
  await startupRefreshService.performStartupRefresh();

  // Start the Express server
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📊 Stock Watchlist API is ready!`);
    console.log(`🐛 Debug port: 9229`);
    console.log(`📈 Price service: ${priceServiceAvailable ? 'Available' : 'Unavailable'}`);
    console.log('='.repeat(60) + '\n');
  });
}

// Start the application
startup().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});
