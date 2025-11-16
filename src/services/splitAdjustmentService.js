const db = require('../database');

/**
 * Stock Split Adjustment Service
 * Handles split adjustments for historical stock data to ensure accurate price comparisons
 */
class SplitAdjustmentService {
  constructor() {
    console.log('📊 Split Adjustment Service initialized');
  }

  /**
   * Get all stock splits for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Array>} Array of split data
   */
  async getStockSplits(symbol) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT symbol, split_date, split_ratio, description
        FROM stock_splits 
        WHERE symbol = ?
        ORDER BY split_date ASC
      `, [symbol.toUpperCase()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Calculate cumulative split adjustment factor for a given date
   * @param {string} symbol - Stock symbol
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<number>} Cumulative split adjustment factor
   */
  async getSplitAdjustmentFactor(symbol, date) {
    try {
      const splits = await this.getStockSplits(symbol);
      
      // Find all splits that occurred after the given date
      const appliedSplits = splits.filter(split => split.split_date > date);
      
      // Calculate cumulative adjustment factor
      let adjustmentFactor = 1.0;
      for (const split of appliedSplits) {
        adjustmentFactor *= split.split_ratio;
      }
      
      return adjustmentFactor;
    } catch (error) {
      console.error(`Error calculating split adjustment for ${symbol}:`, error.message);
      return 1.0; // No adjustment if error
    }
  }

  /**
   * Apply split adjustments to a single stock record
   * @param {Object} stockRecord - Single day stock data
   * @returns {Promise<Object>} Split-adjusted stock record
   */
  async adjustStockRecord(stockRecord) {
    try {
      const adjustmentFactor = await this.getSplitAdjustmentFactor(
        stockRecord.symbol, 
        stockRecord.date
      );

      if (adjustmentFactor === 1.0) {
        // No splits to adjust for
        return {
          ...stockRecord,
          adjusted_close: stockRecord.close,
          split_adjusted: false,
          adjustment_factor: 1.0
        };
      }

      // Apply adjustment to all price fields
      const adjustedRecord = {
        ...stockRecord,
        open: Number((stockRecord.open / adjustmentFactor).toFixed(4)),
        high: Number((stockRecord.high / adjustmentFactor).toFixed(4)),
        low: Number((stockRecord.low / adjustmentFactor).toFixed(4)),
        close: Number((stockRecord.close / adjustmentFactor).toFixed(4)),
        adjusted_close: Number((stockRecord.close / adjustmentFactor).toFixed(4)),
        // Volume should be multiplied by the adjustment factor
        volume: Math.round(stockRecord.volume * adjustmentFactor),
        split_adjusted: true,
        adjustment_factor: adjustmentFactor
      };

      return adjustedRecord;
    } catch (error) {
      console.error(`Error adjusting stock record for ${stockRecord.symbol}:`, error.message);
      return {
        ...stockRecord,
        adjusted_close: stockRecord.close,
        split_adjusted: false,
        adjustment_factor: 1.0
      };
    }
  }

  /**
   * Apply split adjustments to an array of stock records
   * @param {Array} stockRecords - Array of stock data records
   * @returns {Promise<Array>} Array of split-adjusted records
   */
  async adjustStockRecords(stockRecords) {
    if (!stockRecords || stockRecords.length === 0) {
      return stockRecords;
    }

    try {
      // Get splits for this symbol once
      const symbol = stockRecords[0].symbol;
      const splits = await this.getStockSplits(symbol);
      
      if (splits.length === 0) {
        // No splits for this symbol, just add adjusted_close field
        return stockRecords.map(record => ({
          ...record,
          adjusted_close: record.close,
          split_adjusted: false,
          adjustment_factor: 1.0
        }));
      }

      // Process each record
      const adjustedRecords = stockRecords.map(record => {
        // Find all splits that occurred after this record's date
        const appliedSplits = splits.filter(split => split.split_date > record.date);
        
        // Calculate cumulative adjustment factor
        let adjustmentFactor = 1.0;
        for (const split of appliedSplits) {
          adjustmentFactor *= split.split_ratio;
        }

        if (adjustmentFactor === 1.0) {
          return {
            ...record,
            adjusted_close: record.close,
            split_adjusted: false,
            adjustment_factor: 1.0
          };
        }

        // Apply adjustment
        return {
          ...record,
          open: Number((record.open / adjustmentFactor).toFixed(4)),
          high: Number((record.high / adjustmentFactor).toFixed(4)),
          low: Number((record.low / adjustmentFactor).toFixed(4)),
          close: Number((record.close / adjustmentFactor).toFixed(4)),
          adjusted_close: Number((record.close / adjustmentFactor).toFixed(4)),
          volume: Math.round(record.volume * adjustmentFactor),
          split_adjusted: true,
          adjustment_factor: adjustmentFactor
        };
      });

      return adjustedRecords;
    } catch (error) {
      console.error('Error adjusting stock records:', error.message);
      return stockRecords.map(record => ({
        ...record,
        adjusted_close: record.close,
        split_adjusted: false,
        adjustment_factor: 1.0
      }));
    }
  }

  /**
   * Get split information for display
   * @param {string} symbol - Stock symbol  
   * @returns {Promise<Object>} Split summary information
   */
  async getSplitSummary(symbol) {
    try {
      const splits = await this.getStockSplits(symbol);
      
      if (splits.length === 0) {
        return {
          symbol: symbol.toUpperCase(),
          hasSplits: false,
          totalSplits: 0,
          cumulativeRatio: 1.0,
          splits: []
        };
      }

      // Calculate cumulative ratio
      const cumulativeRatio = splits.reduce((ratio, split) => ratio * split.split_ratio, 1.0);

      return {
        symbol: symbol.toUpperCase(),
        hasSplits: true,
        totalSplits: splits.length,
        cumulativeRatio: Number(cumulativeRatio.toFixed(2)),
        splits: splits.map(split => ({
          date: split.split_date,
          ratio: split.split_ratio,
          description: split.description
        }))
      };
    } catch (error) {
      console.error(`Error getting split summary for ${symbol}:`, error.message);
      return {
        symbol: symbol.toUpperCase(),
        hasSplits: false,
        totalSplits: 0,
        cumulativeRatio: 1.0,
        splits: [],
        error: error.message
      };
    }
  }

  /**
   * Add a new stock split (for maintenance)
   * @param {string} symbol - Stock symbol
   * @param {string} splitDate - Split date (YYYY-MM-DD)
   * @param {number} splitRatio - Split ratio (e.g., 4.0 for 4-for-1)
   * @param {string} description - Description of the split
   * @returns {Promise<boolean>} Success status
   */
  async addStockSplit(symbol, splitDate, splitRatio, description) {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT OR REPLACE INTO stock_splits (symbol, split_date, split_ratio, description)
        VALUES (?, ?, ?, ?)
      `, [symbol.toUpperCase(), splitDate, splitRatio, description], function(err) {
        if (err) {
          console.error(`Error adding stock split for ${symbol}:`, err.message);
          reject(err);
        } else {
          console.log(`✅ Added stock split for ${symbol}: ${splitRatio}-for-1 on ${splitDate}`);
          resolve(true);
        }
      });
    });
  }
}

module.exports = new SplitAdjustmentService();