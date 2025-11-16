const PRICE_SERVICE_URL = process.env.PRICE_SERVICE_URL || 'http://price-service:5000';

class PriceService {
  constructor() {
    console.log(`📈 Price Service client initialized (${PRICE_SERVICE_URL})`);
  }

  /**
   * Get current price for a single stock
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Price data
   */
  async getCurrentPrice(symbol) {
    try {
      const response = await fetch(`${PRICE_SERVICE_URL}/price/${symbol}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Error fetching price for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current prices for multiple stocks
   * @param {Array<string>} symbols - Array of stock symbols
   * @returns {Promise<Object>} Price data for all symbols
   */
  async getCurrentPrices(symbols) {
    try {
      const response = await fetch(`${PRICE_SERVICE_URL}/prices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbols })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Error fetching prices for ${symbols.length} symbols:`, error.message);
      throw error;
    }
  }

  /**
   * Get detailed quote information for a stock
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Detailed quote data
   */
  async getQuoteInfo(symbol) {
    try {
      const response = await fetch(`${PRICE_SERVICE_URL}/quote/${symbol}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`❌ Error fetching quote info for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if price service is available
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const response = await fetch(`${PRICE_SERVICE_URL}/health`, {
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Price service is available:', data.status);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('⚠️  Price service is not available:', error.message);
      return false;
    }
  }

  /**
   * Get the most recent price for a symbol from the database or price service
   * Falls back to database if price service is unavailable
   * @param {string} symbol - Stock symbol
   * @param {Function} fallbackFn - Function to get price from database
   * @returns {Promise<Object>}
   */
  async getPriceWithFallback(symbol, fallbackFn) {
    try {
      // Try to get real-time price from price service
      const priceData = await this.getCurrentPrice(symbol);
      return {
        source: 'realtime',
        ...priceData
      };
    } catch (error) {
      console.warn(`⚠️  Price service unavailable for ${symbol}, using database fallback`);
      
      if (fallbackFn) {
        const dbData = await fallbackFn(symbol);
        return {
          source: 'database',
          ...dbData
        };
      }
      
      throw new Error('Price service unavailable and no fallback provided');
    }
  }
}

module.exports = new PriceService();
