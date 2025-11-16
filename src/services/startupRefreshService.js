const db = require('../database');
const alphaVantageService = require('./alphaVantageService');
const dataRefreshService = require('./dataRefreshService');

class StartupRefreshService {
  constructor() {
    console.log('🚀 Startup Refresh Service initialized');
  }

  /**
   * Check if a stock needs data refresh today
   * @param {string} symbol - Stock symbol
   * @returns {Promise<boolean>}
   */
  async needsDataRefresh(symbol) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT last_data_refresh 
        FROM tracked_stocks 
        WHERE symbol = ?
      `;
      
      db.get(sql, [symbol.toUpperCase()], (err, row) => {
        if (err) {
          console.error('❌ Error checking data refresh status:', err.message);
          reject(err);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const needsRefresh = !row?.last_data_refresh || row.last_data_refresh < today;
          resolve(needsRefresh);
        }
      });
    });
  }

  /**
   * Check if a stock needs split check today
   * @param {string} symbol - Stock symbol
   * @returns {Promise<boolean>}
   */
  async needsSplitCheck(symbol) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT last_split_check 
        FROM tracked_stocks 
        WHERE symbol = ?
      `;
      
      db.get(sql, [symbol.toUpperCase()], (err, row) => {
        if (err) {
          console.error('❌ Error checking split check status:', err.message);
          reject(err);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const needsCheck = !row?.last_split_check || row.last_split_check < today;
          resolve(needsCheck);
        }
      });
    });
  }

  /**
   * Update last data refresh timestamp for a stock
   * @param {string} symbol - Stock symbol
   * @returns {Promise<void>}
   */
  async markDataRefreshed(symbol) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const sql = `
        UPDATE tracked_stocks 
        SET last_data_refresh = ?, last_updated = CURRENT_TIMESTAMP
        WHERE symbol = ?
      `;
      
      db.run(sql, [today, symbol.toUpperCase()], function(err) {
        if (err) {
          console.error('❌ Error marking data refreshed:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update last split check timestamp for a stock
   * @param {string} symbol - Stock symbol
   * @returns {Promise<void>}
   */
  async markSplitChecked(symbol) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const sql = `
        UPDATE tracked_stocks 
        SET last_split_check = ?, last_updated = CURRENT_TIMESTAMP
        WHERE symbol = ?
      `;
      
      db.run(sql, [today, symbol.toUpperCase()], function(err) {
        if (err) {
          console.error('❌ Error marking split checked:', err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Fetch and store split data from Alpha Vantage
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>}
   */
  async fetchAndStoreSplits(symbol) {
    try {
      console.log(`🔍 Fetching split data for ${symbol}...`);
      
      const url = `https://www.alphavantage.co/query?function=SPLITS&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error(`Alpha Vantage API Rate Limit: ${data['Note']}`);
      }

      const splits = data.data || [];
      let inserted = 0;
      let skipped = 0;

      for (const split of splits) {
        const splitRatio = parseFloat(split.split_factor);
        const description = `${split.split_factor} stock split`;

        await new Promise((resolve, reject) => {
          const sql = `
            INSERT OR IGNORE INTO stock_splits (symbol, split_date, split_ratio, description)
            VALUES (?, ?, ?, ?)
          `;
          
          db.run(sql, [symbol.toUpperCase(), split.effective_date, splitRatio, description], function(err) {
            if (err) {
              console.error(`❌ Error storing split data:`, err.message);
              reject(err);
            } else {
              if (this.changes > 0) {
                inserted++;
              } else {
                skipped++;
              }
              resolve();
            }
          });
        });
      }

      console.log(`✅ Split data for ${symbol}: ${inserted} new, ${skipped} existing`);
      return { symbol, inserted, skipped, total: splits.length };

    } catch (error) {
      console.error(`❌ Error fetching splits for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Perform startup refresh for a single symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>}
   */
  async refreshSymbol(symbol) {
    const result = {
      symbol,
      dataRefreshed: false,
      splitsChecked: false,
      errors: []
    };

    try {
      // Check if data refresh is needed
      const needsData = await this.needsDataRefresh(symbol);
      
      if (needsData) {
        console.log(`📊 Refreshing historical data for ${symbol}...`);
        try {
          // Fetch recent 100 days of data (compact mode)
          const historicalData = await alphaVantageService.fetchRecentData(symbol);
          await dataRefreshService.storeHistoricalData(historicalData);
          await this.markDataRefreshed(symbol);
          result.dataRefreshed = true;
          result.recordsProcessed = historicalData.length;
          console.log(`✅ Data refresh completed for ${symbol}`);
        } catch (error) {
          console.error(`❌ Data refresh failed for ${symbol}:`, error.message);
          result.errors.push(`Data refresh: ${error.message}`);
        }

        // Rate limiting between API calls
        await new Promise(resolve => setTimeout(resolve, 2500));
      } else {
        console.log(`✓ ${symbol} data already refreshed today, skipping`);
      }

      // Check if split check is needed
      const needsSplits = await this.needsSplitCheck(symbol);
      
      if (needsSplits) {
        console.log(`🔍 Checking splits for ${symbol}...`);
        try {
          const splitResult = await this.fetchAndStoreSplits(symbol);
          await this.markSplitChecked(symbol);
          result.splitsChecked = true;
          result.splitsFound = splitResult.total;
          result.newSplits = splitResult.inserted;
          console.log(`✅ Split check completed for ${symbol}`);
        } catch (error) {
          console.error(`❌ Split check failed for ${symbol}:`, error.message);
          result.errors.push(`Split check: ${error.message}`);
        }

        // Rate limiting between API calls
        if (needsData) {
          await new Promise(resolve => setTimeout(resolve, 2500));
        }
      } else {
        console.log(`✓ ${symbol} splits already checked today, skipping`);
      }

    } catch (error) {
      console.error(`❌ Error refreshing ${symbol}:`, error.message);
      result.errors.push(`General error: ${error.message}`);
    }

    return result;
  }

  /**
   * Perform startup refresh for all tracked stocks
   * @returns {Promise<Object>}
   */
  async performStartupRefresh() {
    console.log('\n🚀 Starting startup refresh process...\n');

    try {
      // Get all tracked stocks
      const trackedStocks = await dataRefreshService.getTrackedStocks();
      
      if (trackedStocks.length === 0) {
        console.log('ℹ️  No tracked stocks found, skipping startup refresh');
        return { success: true, stocksProcessed: 0, results: [] };
      }

      console.log(`📋 Found ${trackedStocks.length} tracked stocks: ${trackedStocks.map(s => s.symbol).join(', ')}\n`);

      const results = [];
      let apiCallsUsed = 0;

      // Process each stock sequentially to respect API rate limits
      for (const stock of trackedStocks) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Processing ${stock.symbol} (${stock.name})`);
        console.log('='.repeat(60));

        const result = await this.refreshSymbol(stock.symbol);
        results.push(result);

        // Count API calls made
        if (result.dataRefreshed) apiCallsUsed++;
        if (result.splitsChecked) apiCallsUsed++;
      }

      // Summary
      console.log(`\n${'='.repeat(60)}`);
      console.log('STARTUP REFRESH SUMMARY');
      console.log('='.repeat(60));
      
      const dataRefreshed = results.filter(r => r.dataRefreshed).length;
      const splitsChecked = results.filter(r => r.splitsChecked).length;
      const errors = results.filter(r => r.errors.length > 0);

      console.log(`✅ Stocks processed: ${results.length}`);
      console.log(`📊 Data refreshed: ${dataRefreshed}`);
      console.log(`🔍 Splits checked: ${splitsChecked}`);
      console.log(`📡 API calls used: ${apiCallsUsed}`);
      
      if (errors.length > 0) {
        console.log(`⚠️  Errors encountered: ${errors.length}`);
        errors.forEach(e => {
          console.log(`   ${e.symbol}: ${e.errors.join(', ')}`);
        });
      }

      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        stocksProcessed: results.length,
        dataRefreshed,
        splitsChecked,
        apiCallsUsed,
        results,
        errors: errors.length
      };

    } catch (error) {
      console.error('❌ Startup refresh failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new StartupRefreshService();
