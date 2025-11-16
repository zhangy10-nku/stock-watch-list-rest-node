const express = require('express');
const router = express.Router();
const db = require('../database');
const dataRefreshService = require('../services/dataRefreshService');
const dataInitService = require('../services/dataInitService');
const alphaVantageService = require('../services/alphaVantageService');
const queryService = require('../services/queryService');
const splitAdjustmentService = require('../services/splitAdjustmentService');

// === UTILITY ENDPOINTS (must come before parameterized routes) ===

// Get tracked stocks
router.get('/tracked', async (req, res) => {
  try {
    const trackedStocks = await dataRefreshService.getTrackedStocks();
    
    res.json({ 
      count: trackedStocks.length,
      data: trackedStocks 
    });

  } catch (error) {
    console.error('Error fetching tracked stocks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get data summary/statistics
router.get('/summary', async (req, res) => {
  try {
    const summary = await dataRefreshService.getDataSummary();
    
    res.json({ 
      data: summary,
      apiConfigured: alphaVantageService.isConfigured()
    });

  } catch (error) {
    console.error('Error fetching data summary:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get Magnificent 7 list
router.get('/magnificent-7', (req, res) => {
  const magnificent7 = dataInitService.getMagnificent7List();
  
  res.json({ 
    count: magnificent7.length,
    data: magnificent7 
  });
});

// Get initialization status
router.get('/init/status', async (req, res) => {
  try {
    const status = await dataInitService.getInitializationStatus();
    
    res.json({ 
      data: status,
      apiConfigured: alphaVantageService.isConfigured()
    });

  } catch (error) {
    console.error('Error getting initialization status:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get stock split information
router.get('/splits/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const splitSummary = await splitAdjustmentService.getSplitSummary(symbol);
    
    res.json(splitSummary);

  } catch (error) {
    console.error('Error getting split information:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get all available split data
router.get('/splits', async (req, res) => {
  try {
    // Query all unique symbols in the splits table
    const db = require('../database');
    
    const symbols = await new Promise((resolve, reject) => {
      db.all('SELECT DISTINCT symbol FROM stock_splits ORDER BY symbol', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.symbol));
      });
    });

    const allSplits = {};
    for (const symbol of symbols) {
      allSplits[symbol] = await splitAdjustmentService.getSplitSummary(symbol);
    }
    
    res.json({
      message: `Stock split information for ${symbols.length} symbols`,
      availableSymbols: symbols,
      data: allSplits
    });

  } catch (error) {
    console.error('Error getting all split information:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get Magnificent 7 splits specifically
router.get('/splits/magnificent-7', async (req, res) => {
  try {
    const magnificent7 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];
    const allSplits = {};
    
    for (const symbol of magnificent7) {
      allSplits[symbol] = await splitAdjustmentService.getSplitSummary(symbol);
    }
    
    res.json({
      message: 'Stock split information for Magnificent 7',
      data: allSplits
    });

  } catch (error) {
    console.error('Error getting Magnificent 7 split information:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add new stock split data (for maintenance)
router.post('/splits/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { split_date, split_ratio, description } = req.body;

    if (!split_date || !split_ratio) {
      return res.status(400).json({ 
        error: 'split_date and split_ratio are required',
        example: {
          split_date: '2024-06-07',
          split_ratio: 10.0,
          description: '10-for-1 stock split'
        }
      });
    }

    const success = await splitAdjustmentService.addStockSplit(
      symbol, 
      split_date, 
      parseFloat(split_ratio), 
      description || `${split_ratio}-for-1 stock split`
    );

    if (success) {
      const updatedSummary = await splitAdjustmentService.getSplitSummary(symbol);
      res.json({
        message: `Stock split added successfully for ${symbol.toUpperCase()}`,
        data: updatedSummary
      });
    } else {
      res.status(500).json({ error: 'Failed to add stock split' });
    }

  } catch (error) {
    console.error('Error adding stock split:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === JSONATA QUERY ENDPOINTS ===

// Get query templates
router.get('/query/templates', (req, res) => {
  try {
    const templates = queryService.getQueryTemplates();
    
    res.json({
      message: 'Available JSONata query templates',
      templates: templates,
      examples: {
        customQuery: '/api/stocks/query/NVDA?expression=$max(data.close)&startDate=2020-01-01',
        globalHighLow: '/api/stocks/query/NVDA/high-low?startDate=2020-01-01',
        performance: '/api/stocks/query/AAPL/performance?startDate=2020-01-01'
      }
    });

  } catch (error) {
    console.error('Error getting query templates:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Execute custom JSONata query
router.get('/query/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { expression, startDate, endDate, limit } = req.query;

    if (!expression) {
      return res.status(400).json({ 
        error: 'JSONata expression is required',
        examples: {
          globalHigh: '$max(data.high)',
          globalLow: '$min(data.low)',
          avgClose: '$average(data.close)',
          volatility: '$sqrt($average($map(data[0..$count(data)-2], function($v, $i) { $power((data[$i].close - data[$i+1].close) / data[$i+1].close, 2) }))) * 100'
        }
      });
    }

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.executeQuery(symbol.toUpperCase(), expression, options);
    
    res.json(result);

  } catch (error) {
    console.error('Error executing query:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Execute multiple queries at once
router.post('/query/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { queries, startDate, endDate, limit } = req.body;

    if (!queries || typeof queries !== 'object') {
      return res.status(400).json({ 
        error: 'Queries object is required',
        example: {
          queries: {
            globalHigh: '$max(data.high)',
            globalLow: '$min(data.low)',
            avgClose: '$average(data.close)'
          }
        }
      });
    }

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.executeMultipleQueries(symbol.toUpperCase(), queries, options);
    
    res.json(result);

  } catch (error) {
    console.error('Error executing multiple queries:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Global high/low analysis
router.get('/query/:symbol/high-low', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.getGlobalHighLow(symbol.toUpperCase(), options);
    
    res.json(result);

  } catch (error) {
    console.error('Error getting global high/low:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Volume statistics
router.get('/query/:symbol/volume', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.getVolumeStats(symbol.toUpperCase(), options);
    
    res.json(result);

  } catch (error) {
    console.error('Error getting volume stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Price performance analysis
router.get('/query/:symbol/performance', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.getPricePerformance(symbol.toUpperCase(), options);
    
    res.json(result);

  } catch (error) {
    console.error('Error getting price performance:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Moving averages
router.get('/query/:symbol/moving-averages', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { periods, startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    // Parse periods if provided
    let periodsArray = [20, 50, 200]; // default
    if (periods) {
      periodsArray = periods.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));
    }

    const result = await queryService.getMovingAverages(symbol.toUpperCase(), periodsArray, options);
    
    res.json(result);

  } catch (error) {
    console.error('Error getting moving averages:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Price patterns and conditions
router.get('/query/:symbol/patterns', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;
    if (limit) options.limit = parseInt(limit);

    const result = await queryService.findPriceConditions(symbol.toUpperCase(), options);
    
    res.json(result);

  } catch (error) {
    console.error('Error finding price patterns:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === LEGACY WATCHLIST ENDPOINTS ===

// Get all stocks
router.get('/', (req, res) => {
  db.all('SELECT * FROM stocks ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ data: rows, count: rows.length });
  });
});

// Get a single stock by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM stocks WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json({ data: row });
  });
});

// Create a new stock
router.post('/', (req, res) => {
  const { symbol, name, quantity, purchase_price, notes } = req.body;

  if (!symbol || !name) {
    return res.status(400).json({ error: 'Symbol and name are required' });
  }

  const sql = `
    INSERT INTO stocks (symbol, name, quantity, purchase_price, notes)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [symbol.toUpperCase(), name, quantity || 0, purchase_price, notes], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Stock symbol already exists' });
      }
      return res.status(500).json({ error: err.message });
    }
    
    // Return the created stock
    db.get('SELECT * FROM stocks WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ data: row, message: 'Stock added successfully' });
    });
  });
});

// Update a stock
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { symbol, name, quantity, purchase_price, notes } = req.body;

  const sql = `
    UPDATE stocks 
    SET symbol = COALESCE(?, symbol),
        name = COALESCE(?, name),
        quantity = COALESCE(?, quantity),
        purchase_price = COALESCE(?, purchase_price),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.run(sql, [symbol?.toUpperCase(), name, quantity, purchase_price, notes, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    
    db.get('SELECT * FROM stocks WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: row, message: 'Stock updated successfully' });
    });
  });
});

// Delete a stock
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM stocks WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    res.json({ message: 'Stock deleted successfully' });
  });
});

// === HISTORICAL DATA ENDPOINTS ===

// Get historical data for a symbol
router.get('/historical/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, limit = 1000 } = req.query;

    const data = await dataRefreshService.getHistoricalData(
      symbol, 
      startDate, 
      endDate, 
      parseInt(limit)
    );

    if (data.length === 0) {
      return res.status(404).json({ 
        error: 'No historical data found for this symbol',
        suggestion: `Use POST /api/stocks/refresh/${symbol} to fetch data first`
      });
    }

    res.json({ 
      symbol: symbol.toUpperCase(),
      count: data.length,
      startDate: startDate || 'earliest',
      endDate: endDate || 'latest',
      data 
    });

  } catch (error) {
    console.error('Error fetching historical data:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get current quote for a symbol
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.' 
      });
    }

    const quote = await alphaVantageService.fetchQuote(symbol);
    res.json({ data: quote });

  } catch (error) {
    console.error('Error fetching quote:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get company overview
router.get('/overview/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.' 
      });
    }

    const overview = await alphaVantageService.fetchCompanyOverview(symbol);
    res.json({ data: overview });

  } catch (error) {
    console.error('Error fetching company overview:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === MANUAL REFRESH ENDPOINTS ===

// Refresh data for a specific symbol
router.post('/refresh/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { fullRefresh = false } = req.body;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.' 
      });
    }

    console.log(`📡 Manual refresh requested for ${symbol}${fullRefresh ? ' (full)' : ''}`);
    
    const result = await dataRefreshService.refreshSymbolData(symbol, fullRefresh);
    
    res.json({ 
      message: 'Data refreshed successfully',
      data: result 
    });

  } catch (error) {
    console.error('Error refreshing symbol data:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Refresh all tracked stocks
router.post('/refresh-all', async (req, res) => {
  try {
    const { fullRefresh = false } = req.body;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.' 
      });
    }

    const trackedStocks = await dataRefreshService.getTrackedStocks();
    
    if (trackedStocks.length === 0) {
      return res.status(404).json({ 
        error: 'No tracked stocks found. Initialize Magnificent 7 first using POST /api/stocks/init' 
      });
    }

    console.log(`📡 Refreshing all ${trackedStocks.length} tracked stocks${fullRefresh ? ' (full)' : ''}...`);
    
    const symbols = trackedStocks.map(stock => stock.symbol);
    const results = await dataRefreshService.refreshMultipleSymbols(symbols, fullRefresh);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({ 
      message: `Refresh completed: ${successful} successful, ${failed} failed`,
      summary: { successful, failed, total: results.length },
      results 
    });

  } catch (error) {
    console.error('Error refreshing all stocks:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// === INITIALIZATION ENDPOINTS ===

// Initialize Magnificent 7 stocks
router.post('/init', async (req, res) => {
  try {
    const { forceRefresh = false } = req.body;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.',
        instructions: 'Get a free API key at https://www.alphavantage.co/support/#api-key and add it to your .env file'
      });
    }

    console.log(`🚀 Initializing Magnificent 7${forceRefresh ? ' (force refresh)' : ''}...`);
    
    const result = await dataInitService.initializeMagnificent7(forceRefresh);
    
    res.json({ 
      message: 'Magnificent 7 initialization completed',
      data: result 
    });

  } catch (error) {
    console.error('Error initializing Magnificent 7:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Add custom stock
router.post('/add-stock/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { name } = req.body;

    if (!alphaVantageService.isConfigured()) {
      return res.status(503).json({ 
        error: 'Alpha Vantage API not configured. Please set ALPHA_VANTAGE_API_KEY in environment variables.' 
      });
    }

    console.log(`➕ Adding custom stock: ${symbol}`);
    
    const result = await dataInitService.addCustomStock(symbol, name);
    
    res.json({ 
      message: 'Stock added successfully',
      data: result 
    });

  } catch (error) {
    console.error('Error adding custom stock:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
