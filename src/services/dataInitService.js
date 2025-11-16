const dataRefreshService = require('./dataRefreshService');

class DataInitService {
  constructor() {
    this.magnificent7Stocks = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
      { symbol: 'AMZN', name: 'Amazon.com Inc.' },
      { symbol: 'TSLA', name: 'Tesla Inc.' },
      { symbol: 'META', name: 'Meta Platforms Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' }
    ];
    
    console.log('🚀 Data Initialization Service ready');
  }

  /**
   * Initialize the Magnificent 7 stocks with historical data
   * @param {boolean} forceRefresh - Whether to force refresh even if data exists
   * @returns {Promise<Object>} Initialization results
   */
  async initializeMagnificent7(forceRefresh = false) {
    console.log('🎯 Initializing Magnificent 7 tech stocks...');
    
    try {
      // Get current data summary to see what we have
      const summary = await dataRefreshService.getDataSummary();
      const existingSymbols = summary.bySymbol.map(item => item.symbol);
      
      console.log(`📊 Current database status:`);
      console.log(`   - Total symbols: ${summary.overview.total_symbols || 0}`);
      console.log(`   - Total records: ${summary.overview.total_records || 0}`);
      console.log(`   - Existing symbols: ${existingSymbols.join(', ') || 'None'}`);

      const symbolsToRefresh = forceRefresh 
        ? this.magnificent7Stocks.map(stock => stock.symbol)
        : this.magnificent7Stocks
            .filter(stock => !existingSymbols.includes(stock.symbol))
            .map(stock => stock.symbol);

      if (symbolsToRefresh.length === 0) {
        console.log('✅ All Magnificent 7 stocks already have data. Use forceRefresh=true to update.');
        return {
          status: 'already_initialized',
          existingSymbols,
          message: 'All Magnificent 7 stocks already have historical data'
        };
      }

      console.log(`🔄 Fetching full historical data for: ${symbolsToRefresh.join(', ')}`);
      console.log(`⏳ This will take approximately ${symbolsToRefresh.length * 2.5} seconds due to API rate limits...`);

      // Fetch full historical data for missing symbols
      const results = await dataRefreshService.refreshMultipleSymbols(symbolsToRefresh, true);

      // Calculate totals
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      const totalRecords = successful.reduce((sum, r) => sum + (r.dataFetched || 0), 0);

      console.log('📋 Initialization Results:');
      console.log(`   ✅ Successful: ${successful.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);
      console.log(`   📊 Total records added: ${totalRecords}`);

      if (failed.length > 0) {
        console.log('❌ Failed symbols:');
        failed.forEach(result => {
          console.log(`   - ${result.symbol}: ${result.error}`);
        });
      }

      return {
        status: 'initialized',
        successful: successful.length,
        failed: failed.length,
        totalRecords,
        results,
        failedSymbols: failed.map(r => ({ symbol: r.symbol, error: r.error }))
      };

    } catch (error) {
      console.error('❌ Error during initialization:', error.message);
      throw error;
    }
  }

  /**
   * Check initialization status
   * @returns {Promise<Object>} Status information
   */
  async getInitializationStatus() {
    try {
      const summary = await dataRefreshService.getDataSummary();
      const trackedStocks = await dataRefreshService.getTrackedStocks();
      
      const magnificent7Symbols = this.magnificent7Stocks.map(s => s.symbol);
      const existingMagnificent7 = summary.bySymbol.filter(item => 
        magnificent7Symbols.includes(item.symbol)
      );

      const isFullyInitialized = magnificent7Symbols.every(symbol =>
        existingMagnificent7.some(item => item.symbol === symbol)
      );

      return {
        isInitialized: isFullyInitialized,
        magnificent7Status: {
          total: magnificent7Symbols.length,
          initialized: existingMagnificent7.length,
          missing: magnificent7Symbols.filter(symbol => 
            !existingMagnificent7.some(item => item.symbol === symbol)
          )
        },
        databaseSummary: summary,
        trackedStocks: trackedStocks.length
      };

    } catch (error) {
      console.error('❌ Error checking initialization status:', error.message);
      throw error;
    }
  }

  /**
   * Add a custom stock to be tracked
   * @param {string} symbol - Stock symbol
   * @param {string} name - Optional company name
   * @returns {Promise<Object>} Add result
   */
  async addCustomStock(symbol, name = null) {
    try {
      console.log(`➕ Adding custom stock: ${symbol}`);
      
      // Use the refresh service to add and fetch data
      const result = await dataRefreshService.refreshSymbolData(symbol, true);
      
      console.log(`✅ Successfully added ${symbol} with ${result.dataFetched} records`);
      return result;

    } catch (error) {
      console.error(`❌ Error adding custom stock ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get the list of Magnificent 7 stocks
   * @returns {Array} Array of Magnificent 7 stock info
   */
  getMagnificent7List() {
    return this.magnificent7Stocks;
  }
}

module.exports = new DataInitService();