const db = require('../database');
const alphaVantageService = require('./alphaVantageService');
const splitAdjustmentService = require('./splitAdjustmentService');

class DataRefreshService {
  constructor() {
    console.log('📊 Data Refresh Service initialized');
  }

  /**
   * Store historical stock data in the database
   * @param {Array} historicalData - Array of historical stock data
   * @returns {Promise<Object>} Result with inserted/updated counts
   */
  async storeHistoricalData(historicalData) {
    return new Promise(async (resolve, reject) => {
      if (!historicalData || historicalData.length === 0) {
        return resolve({ inserted: 0, updated: 0, skipped: 0 });
      }

      const symbol = historicalData[0].symbol;
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let completed = 0;

      console.log(`💾 Storing ${historicalData.length} records for ${symbol}...`);

      // Apply split adjustments to the data BEFORE storing
      console.log(`🔧 Applying split adjustments for ${symbol}...`);
      const adjustedData = await splitAdjustmentService.adjustStockRecords(historicalData);

      adjustedData.forEach((record) => {
        const sql = `
          INSERT OR REPLACE INTO historical_stock_data 
          (symbol, date, open, high, low, close, adjusted_close, volume)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [
          record.symbol,
          record.date,
          record.open,
          record.high,
          record.low,
          record.close,
          record.adjusted_close,
          record.volume
        ], function(err) {
          completed++;

          if (err) {
            console.error('❌ Error storing record:', err.message);
            if (completed === historicalData.length) {
              reject(err);
            }
            return;
          }

          if (this.changes > 0) {
            if (this.lastID) {
              inserted++;
            } else {
              updated++;
            }
          } else {
            skipped++;
          }

          // Check if all records processed
          if (completed === historicalData.length) {
            console.log(`✅ Completed storing data for ${symbol}: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);
            resolve({ inserted, updated, skipped });
          }
        });
      });
    });
  }

  /**
   * Add or update a tracked stock
   * @param {string} symbol - Stock symbol
   * @param {string} name - Company name
   * @returns {Promise<void>}
   */
  async addTrackedStock(symbol, name) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO tracked_stocks (symbol, name, last_updated)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `;

      db.run(sql, [symbol.toUpperCase(), name], function(err) {
        if (err) {
          console.error('❌ Error adding tracked stock:', err.message);
          reject(err);
        } else {
          console.log(`✅ Added/updated tracked stock: ${symbol}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get all tracked stocks
   * @returns {Promise<Array>} Array of tracked stocks
   */
  async getTrackedStocks() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM tracked_stocks ORDER BY symbol';
      
      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching tracked stocks:', err.message);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get historical data for a symbol within date range
   * @param {string} symbol - Stock symbol
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {number} limit - Maximum number of records
   * @returns {Promise<Array>} Array of historical data
   */
  async getHistoricalData(symbol, startDate = null, endDate = null, limit = 1000) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT symbol, date, open, high, low, close, adjusted_close, volume, created_at
        FROM historical_stock_data 
        WHERE symbol = ?
      `;
      const params = [symbol.toUpperCase()];

      if (startDate) {
        sql += ' AND date >= ?';
        params.push(startDate);
      }

      if (endDate) {
        sql += ' AND date <= ?';
        params.push(endDate);
      }

      sql += ' ORDER BY date DESC LIMIT ?';
      params.push(limit);

      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('❌ Error fetching historical data:', err.message);
          reject(err);
        } else {
          // Data is already split-adjusted in the database
          resolve(rows);
        }
      });
    });
  }

  /**
   * Get the latest date for a symbol's historical data
   * @param {string} symbol - Stock symbol
   * @returns {Promise<string|null>} Latest date or null
   */
  async getLatestDate(symbol) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT MAX(date) as latest_date 
        FROM historical_stock_data 
        WHERE symbol = ?
      `;

      db.get(sql, [symbol.toUpperCase()], (err, row) => {
        if (err) {
          console.error('❌ Error fetching latest date:', err.message);
          reject(err);
        } else {
          resolve(row?.latest_date || null);
        }
      });
    });
  }

  /**
   * Refresh data for a specific symbol
   * @param {string} symbol - Stock symbol
   * @param {boolean} fullRefresh - Whether to fetch full historical data or just recent
   * @returns {Promise<Object>} Refresh result
   */
  async refreshSymbolData(symbol, fullRefresh = false) {
    try {
      console.log(`🔄 Refreshing data for ${symbol}${fullRefresh ? ' (full refresh)' : ''}...`);

      // Get company overview to add to tracked stocks
      let companyName = symbol;
      try {
        const overview = await alphaVantageService.fetchCompanyOverview(symbol);
        companyName = overview.name || symbol;
      } catch (overviewError) {
        console.warn(`⚠️  Could not fetch company overview for ${symbol}: ${overviewError.message}`);
      }

      // Add to tracked stocks
      await this.addTrackedStock(symbol, companyName);

      // Fetch historical data
      const historicalData = fullRefresh 
        ? await alphaVantageService.fetchFullHistoricalData(symbol)
        : await alphaVantageService.fetchRecentData(symbol);

      // Store in database
      const storeResult = await this.storeHistoricalData(historicalData);

      // Update last_updated timestamp
      await this.updateLastRefreshed(symbol);

      return {
        symbol,
        companyName,
        dataFetched: historicalData.length,
        ...storeResult,
        lastRefreshed: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to refresh data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Refresh data for multiple symbols
   * @param {Array} symbols - Array of stock symbols
   * @param {boolean} fullRefresh - Whether to fetch full historical data
   * @returns {Promise<Array>} Array of refresh results
   */
  async refreshMultipleSymbols(symbols, fullRefresh = false) {
    const results = [];
    
    for (const symbol of symbols) {
      try {
        const result = await this.refreshSymbolData(symbol, fullRefresh);
        results.push({ success: true, ...result });
        
        // Rate limiting - Alpha Vantage allows 25 requests per day on free tier
        // Wait 2.5 seconds between requests to be safe
        if (symbols.indexOf(symbol) < symbols.length - 1) {
          console.log('⏳ Waiting 2.5 seconds for API rate limit...');
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      } catch (error) {
        console.error(`❌ Failed to refresh ${symbol}: ${error.message}`);
        results.push({ 
          success: false, 
          symbol, 
          error: error.message 
        });
      }
    }

    return results;
  }

  /**
   * Update the last_updated timestamp for a tracked stock
   * @param {string} symbol - Stock symbol
   * @returns {Promise<void>}
   */
  async updateLastRefreshed(symbol) {
    return new Promise((resolve, reject) => {
      const sql = 'UPDATE tracked_stocks SET last_updated = CURRENT_TIMESTAMP WHERE symbol = ?';
      
      db.run(sql, [symbol.toUpperCase()], function(err) {
        if (err) {
          console.error('❌ Error updating last refreshed:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get data summary statistics
   * @returns {Promise<Object>} Summary statistics
   */
  async getDataSummary() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(DISTINCT symbol) as tracked_symbols,
          COUNT(*) as total_records,
          MIN(date) as earliest_date,
          MAX(date) as latest_date,
          symbol,
          COUNT(*) as record_count,
          MAX(date) as symbol_latest_date
        FROM historical_stock_data 
        GROUP BY symbol
        ORDER BY symbol
      `;

      db.all(sql, [], (err, rows) => {
        if (err) {
          console.error('❌ Error fetching data summary:', err.message);
          reject(err);
        } else {
          // Get overall stats
          const overallSql = `
            SELECT 
              COUNT(DISTINCT symbol) as total_symbols,
              COUNT(*) as total_records,
              MIN(date) as earliest_date,
              MAX(date) as latest_date
            FROM historical_stock_data
          `;

          db.get(overallSql, [], (err2, overall) => {
            if (err2) {
              reject(err2);
            } else {
              resolve({
                overview: overall || {},
                bySymbol: rows || []
              });
            }
          });
        }
      });
    });
  }
}

module.exports = new DataRefreshService();