const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'stocks.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database at:', dbPath);
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  // Legacy stocks table (keep for compatibility)
  db.run(`
    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      purchase_price REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating stocks table:', err.message);
    } else {
      console.log('✅ Stocks table initialized');
    }
  });

  // Tracked stocks for automatic data fetching
  db.run(`
    CREATE TABLE IF NOT EXISTS tracked_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      last_updated DATETIME,
      last_data_refresh DATE,
      last_split_check DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating tracked_stocks table:', err.message);
    } else {
      console.log('✅ Tracked stocks table initialized');
      // Add columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE tracked_stocks ADD COLUMN last_data_refresh DATE`, () => {});
      db.run(`ALTER TABLE tracked_stocks ADD COLUMN last_split_check DATE`, () => {});
    }
  });

  // Historical stock data
  db.run(`
    CREATE TABLE IF NOT EXISTS historical_stock_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      date DATE NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      adjusted_close REAL,
      volume INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, date)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating historical_stock_data table:', err.message);
    } else {
      console.log('✅ Historical stock data table initialized');
    }
  });

  // Stock splits table for Magnificent 7
  db.run(`
    CREATE TABLE IF NOT EXISTS stock_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      split_date DATE NOT NULL,
      split_ratio REAL NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(symbol, split_date)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating stock_splits table:', err.message);
    } else {
      console.log('✅ Stock splits table initialized');
      initializeSplitData();
    }
  });

  // Create index for faster queries
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_historical_stock_data_symbol_date 
    ON historical_stock_data(symbol, date DESC)
  `, (err) => {
    if (err) {
      console.error('❌ Error creating index:', err.message);
    } else {
      console.log('✅ Database indexes created');
    }
  });
}

// Initialize known stock split data for major tech stocks
function initializeSplitData() {
  const splitData = [
    // === MAGNIFICENT 7 ===
    
    // NVIDIA
    { symbol: 'NVDA', split_date: '2021-07-20', split_ratio: 4.0, description: '4-for-1 stock split' },
    { symbol: 'NVDA', split_date: '2024-06-07', split_ratio: 10.0, description: '10-for-1 stock split' },
    
    // Apple
    { symbol: 'AAPL', split_date: '2020-08-31', split_ratio: 4.0, description: '4-for-1 stock split' },
    { symbol: 'AAPL', split_date: '2014-06-09', split_ratio: 7.0, description: '7-for-1 stock split' },
    { symbol: 'AAPL', split_date: '2005-02-28', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Tesla  
    { symbol: 'TSLA', split_date: '2020-08-31', split_ratio: 5.0, description: '5-for-1 stock split' },
    { symbol: 'TSLA', split_date: '2022-08-25', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // Google (Alphabet) - Both GOOGL and GOOG
    { symbol: 'GOOGL', split_date: '2022-07-18', split_ratio: 20.0, description: '20-for-1 stock split' },
    { symbol: 'GOOG', split_date: '2022-07-18', split_ratio: 20.0, description: '20-for-1 stock split' },
    { symbol: 'GOOGL', split_date: '2014-04-03', split_ratio: 2.0, description: '2-for-1 stock split (created GOOG class)' },
    { symbol: 'GOOG', split_date: '2014-04-03', split_ratio: 2.0, description: '2-for-1 stock split (created from GOOGL)' },
    
    // Amazon
    { symbol: 'AMZN', split_date: '2022-06-06', split_ratio: 20.0, description: '20-for-1 stock split' },
    { symbol: 'AMZN', split_date: '1999-09-02', split_ratio: 2.0, description: '2-for-1 stock split' },
    { symbol: 'AMZN', split_date: '1999-01-05', split_ratio: 3.0, description: '3-for-1 stock split' },
    { symbol: 'AMZN', split_date: '1998-06-02', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Microsoft (Recent splits)
    { symbol: 'MSFT', split_date: '2003-02-18', split_ratio: 2.0, description: '2-for-1 stock split' },
    { symbol: 'MSFT', split_date: '1999-03-29', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // === OTHER MAJOR TECH STOCKS ===
    
    // Netflix
    { symbol: 'NFLX', split_date: '2015-07-15', split_ratio: 7.0, description: '7-for-1 stock split' },
    { symbol: 'NFLX', split_date: '2004-02-12', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Shopify
    { symbol: 'SHOP', split_date: '2022-06-29', split_ratio: 10.0, description: '10-for-1 stock split' },
    
    // GameStop (meme stock)
    { symbol: 'GME', split_date: '2022-07-22', split_ratio: 4.0, description: '4-for-1 stock split via dividend' },
    
    // Advanced Micro Devices
    { symbol: 'AMD', split_date: '2000-08-17', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Intel
    { symbol: 'INTC', split_date: '2000-07-31', split_ratio: 2.0, description: '2-for-1 stock split' },
    { symbol: 'INTC', split_date: '1999-04-26', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Salesforce
    { symbol: 'CRM', split_date: '2021-03-08', split_ratio: 4.0, description: '4-for-1 stock split' },
    
    // Zoom
    { symbol: 'ZM', split_date: '2022-08-22', split_ratio: 5.0, description: '5-for-1 stock split' },
    
    // DocuSign  
    { symbol: 'DOCU', split_date: '2021-04-16', split_ratio: 4.0, description: '4-for-1 stock split' },
    
    // Palantir
    { symbol: 'PLTR', split_date: '2021-04-14', split_ratio: 6.0, description: '6-for-1 stock split' },
    
    // Square (Block)
    { symbol: 'SQ', split_date: '2022-02-01', split_ratio: 10.0, description: '10-for-1 stock split' },
    
    // PayPal
    { symbol: 'PYPL', split_date: '2015-07-17', split_ratio: 2.0, description: 'Spun off from eBay (effective split)' },
    
    // Snowflake
    { symbol: 'SNOW', split_date: '2021-03-05', split_ratio: 10.0, description: '10-for-1 stock split' },
    
    // Unity Software
    { symbol: 'U', split_date: '2021-06-09', split_ratio: 4.0, description: '4-for-1 stock split' },
    
    // Okta
    { symbol: 'OKTA', split_date: '2021-08-27', split_ratio: 4.0, description: '4-for-1 stock split' },
    
    // Twilio
    { symbol: 'TWLO', split_date: '2021-09-13', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // MongoDB
    { symbol: 'MDB', split_date: '2021-12-21', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // CrowdStrike
    { symbol: 'CRWD', split_date: '2022-08-29', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // Datadog
    { symbol: 'DDOG', split_date: '2021-08-19', split_ratio: 5.0, description: '5-for-1 stock split' },
    
    // ServiceNow
    { symbol: 'NOW', split_date: '2022-07-26', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // Workday
    { symbol: 'WDAY', split_date: '2021-06-04', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // Splunk
    { symbol: 'SPLK', split_date: '2020-08-28', split_ratio: 2.0, description: '2-for-1 stock split' },
    
    // Atlassian
    { symbol: 'TEAM', split_date: '2021-09-07', split_ratio: 3.0, description: '3-for-1 stock split' },
    
    // ZoomInfo
    { symbol: 'ZI', split_date: '2021-08-30', split_ratio: 4.0, description: '4-for-1 stock split' }
  ];

  splitData.forEach(split => {
    db.run(`
      INSERT OR IGNORE INTO stock_splits (symbol, split_date, split_ratio, description)
      VALUES (?, ?, ?, ?)
    `, [split.symbol, split.split_date, split.split_ratio, split.description], (err) => {
      if (err && !err.message.includes('UNIQUE constraint failed')) {
        console.error(`❌ Error inserting split data for ${split.symbol}:`, err.message);
      }
    });
  });
  
  console.log('✅ Stock split data initialized for Magnificent 7');
}

module.exports = db;
