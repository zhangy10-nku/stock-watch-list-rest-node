const dotenv = require('dotenv');
dotenv.config();

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const BASE_URL = 'https://www.alphavantage.co/query';

class AlphaVantageService {
  constructor() {
    if (!ALPHA_VANTAGE_API_KEY || ALPHA_VANTAGE_API_KEY === 'your_alpha_vantage_api_key_here') {
      console.warn('⚠️  Alpha Vantage API key not configured. Please set ALPHA_VANTAGE_API_KEY in .env file');
      this.apiKeyMissing = true;
    } else {
      this.apiKeyMissing = false;
      console.log('✅ Alpha Vantage API service initialized');
    }
  }

  /**
   * Fetch daily historical stock data from Alpha Vantage
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {boolean} outputSize - 'compact' (100 days) or 'full' (20+ years)
   * @returns {Promise<Array>} Array of daily stock data
   */
  async fetchDailyData(symbol, outputSize = 'full') {
    if (this.apiKeyMissing) {
      throw new Error('Alpha Vantage API key not configured');
    }

    // Use free TIME_SERIES_DAILY endpoint instead of premium TIME_SERIES_DAILY_ADJUSTED
    const url = `${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=${outputSize}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    try {
      console.log(`📡 Fetching data for ${symbol}...`);
      
      const response = await fetch(url);
      const data = await response.json();

      // Check for API errors
      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
      }

      if (data['Note']) {
        throw new Error(`Alpha Vantage API Rate Limit: ${data['Note']}`);
      }

      if (data['Information']) {
        throw new Error(`Alpha Vantage API Info: ${data['Information']}`);
      }

      const timeSeries = data['Time Series (Daily)'];
      if (!timeSeries) {
        throw new Error(`No time series data found for symbol ${symbol}`);
      }

      // Convert to array format with proper data types
      const historicalData = Object.entries(timeSeries).map(([date, values]) => ({
        symbol: symbol.toUpperCase(),
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        adjusted_close: parseFloat(values['4. close']), // Use close price as adjusted_close for free tier
        volume: parseInt(values['5. volume'])
      }));

      console.log(`✅ Fetched ${historicalData.length} days of data for ${symbol}`);
      return historicalData;

    } catch (error) {
      console.error(`❌ Error fetching data for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch recent data (last 100 days) for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Array>} Array of recent stock data
   */
  async fetchRecentData(symbol) {
    return this.fetchDailyData(symbol, 'compact');
  }

  /**
   * Fetch full historical data for a symbol
   * @param {string} symbol - Stock symbol  
   * @returns {Promise<Array>} Array of full historical stock data
   */
  async fetchFullHistoricalData(symbol) {
    return this.fetchDailyData(symbol, 'full');
  }

  /**
   * Get company overview/profile information
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Company information
   */
  async fetchCompanyOverview(symbol) {
    if (this.apiKeyMissing) {
      throw new Error('Alpha Vantage API key not configured');
    }

    const url = `${BASE_URL}?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
      }

      if (!data.Symbol) {
        throw new Error(`No company data found for symbol ${symbol}`);
      }

      return {
        symbol: data.Symbol,
        name: data.Name,
        description: data.Description,
        exchange: data.Exchange,
        currency: data.Currency,
        country: data.Country,
        sector: data.Sector,
        industry: data.Industry,
        marketCap: data.MarketCapitalization,
        peRatio: data.PERatio,
        pegRatio: data.PEGRatio,
        bookValue: data.BookValue,
        dividendPerShare: data.DividendPerShare,
        dividendYield: data.DividendYield,
        eps: data.EPS,
        revenuePerShareTTM: data.RevenuePerShareTTM,
        profitMargin: data.ProfitMargin,
        beta: data.Beta
      };

    } catch (error) {
      console.error(`❌ Error fetching company overview for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Get current quote for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Current quote data
   */
  async fetchQuote(symbol) {
    if (this.apiKeyMissing) {
      throw new Error('Alpha Vantage API key not configured');
    }

    const url = `${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data['Error Message']) {
        throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
      }

      const quote = data['Global Quote'];
      if (!quote || !quote['01. symbol']) {
        throw new Error(`No quote data found for symbol ${symbol}`);
      }

      return {
        symbol: quote['01. symbol'],
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        price: parseFloat(quote['05. price']),
        volume: parseInt(quote['06. volume']),
        latestTradingDay: quote['07. latest trading day'],
        previousClose: parseFloat(quote['08. previous close']),
        change: parseFloat(quote['09. change']),
        changePercent: quote['10. change percent']
      };

    } catch (error) {
      console.error(`❌ Error fetching quote for ${symbol}:`, error.message);
      throw error;
    }
  }

  /**
   * Check if API key is configured
   * @returns {boolean} True if API key is configured
   */
  isConfigured() {
    return !this.apiKeyMissing;
  }
}

module.exports = new AlphaVantageService();