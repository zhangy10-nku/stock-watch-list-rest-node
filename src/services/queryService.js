const jsonata = require('jsonata');
const { getHistoricalData } = require('./dataRefreshService');

/**
 * JSONata Query Service
 * Provides declarative querying capabilities over historical stock data
 */

class QueryService {
  constructor() {
    // Pre-compiled common expressions for performance
    this.commonExpressions = {
      globalHigh: jsonata('$max(data.high)'),
      globalLow: jsonata('$min(data.low)'),
      highestClose: jsonata('$max(data.close)'),
      lowestClose: jsonata('$min(data.close)'),
      maxVolume: jsonata('$max(data.volume)'),
      avgVolume: jsonata('$average(data.volume)'),
      avgClose: jsonata('$average(data.close)'),
      totalVolume: jsonata('$sum(data.volume)'),
      recordCount: jsonata('$count(data)')
    };
  }

  /**
   * Execute a JSONata expression against historical stock data
   */
  async executeQuery(symbol, query, options = {}) {
    try {
      // Get historical data (returns raw array)
      const dataArray = await getHistoricalData(
        symbol,
        options.startDate,
        options.endDate,
        options.limit
      );

      if (!dataArray || dataArray.length === 0) {
        throw new Error(`No historical data found for symbol ${symbol}`);
      }

      // Format data in the expected structure for JSONata
      const historicalData = {
        symbol: symbol.toUpperCase(),
        count: dataArray.length,
        startDate: options.startDate || 'earliest',
        endDate: options.endDate || 'latest',
        data: dataArray
      };

      // Compile JSONata expression
      const expression = typeof query === 'string' ? jsonata(query) : query;
      
      // Execute query against the data
      const result = await expression.evaluate(historicalData);
      
      return {
        success: true,
        symbol: symbol,
        query: typeof query === 'string' ? query : 'pre-compiled',
        dataCount: historicalData.count,
        dateRange: {
          start: historicalData.startDate,
          end: historicalData.endDate
        },
        result: result
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        symbol: symbol,
        query: typeof query === 'string' ? query : 'pre-compiled'
      };
    }
  }

  /**
   * Execute multiple queries against the same dataset
   */
  async executeMultipleQueries(symbol, queries, options = {}) {
    try {
      // Get historical data once (returns raw array)
      const dataArray = await getHistoricalData(
        symbol,
        options.startDate,
        options.endDate,
        options.limit
      );

      if (!dataArray || dataArray.length === 0) {
        throw new Error(`No historical data found for symbol ${symbol}`);
      }

      // Format data in the expected structure for JSONata
      const historicalData = {
        symbol: symbol.toUpperCase(),
        count: dataArray.length,
        startDate: options.startDate || 'earliest',
        endDate: options.endDate || 'latest',
        data: dataArray
      };

      const results = {};

      // Execute each query
      for (const [key, query] of Object.entries(queries)) {
        try {
          const expression = typeof query === 'string' ? jsonata(query) : query;
          results[key] = await expression.evaluate(historicalData);
        } catch (error) {
          results[key] = { error: error.message };
        }
      }

      return {
        success: true,
        symbol: symbol,
        dataCount: historicalData.count,
        dateRange: {
          start: historicalData.startDate,
          end: historicalData.endDate
        },
        results: results
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        symbol: symbol
      };
    }
  }

  /**
   * Get global high and low for a symbol
   */
  async getGlobalHighLow(symbol, options = {}) {
    const queries = {
      globalHigh: this.commonExpressions.globalHigh,
      globalLow: this.commonExpressions.globalLow,
      highestClosePrice: this.commonExpressions.highestClose,
      lowestClosePrice: this.commonExpressions.lowestClose,
      // Add the dates when these occurred
      highestCloseDate: jsonata('data[close = $max(data.close)].date'),
      lowestCloseDate: jsonata('data[close = $min(data.close)].date'),
      globalHighDate: jsonata('data[high = $max(data.high)].date'),
      globalLowDate: jsonata('data[low = $min(data.low)].date')
    };

    return await this.executeMultipleQueries(symbol, queries, options);
  }

  /**
   * Get volume statistics
   */
  async getVolumeStats(symbol, options = {}) {
    const queries = {
      maxVolume: this.commonExpressions.maxVolume,
      avgVolume: this.commonExpressions.avgVolume,
      totalVolume: this.commonExpressions.totalVolume,
      maxVolumeDate: jsonata('data[volume = $max(data.volume)].date'),
      // Top 5 volume days
      topVolumeDays: jsonata('data^(>volume)[0..4].{date: date, volume: volume, close: close}')
    };

    return await this.executeMultipleQueries(symbol, queries, options);
  }

  /**
   * Calculate price performance metrics
   */
  async getPricePerformance(symbol, options = {}) {
    const queries = {
      startPrice: jsonata('data[$count(data)-1].close'), // Oldest record (last in array after date sort)
      endPrice: jsonata('data[0].close'),    // Newest record (first in array)
      totalReturn: jsonata('(data[0].close - data[$count(data)-1].close) / data[$count(data)-1].close * 100'),
      priceRange: jsonata('$max(data.close) - $min(data.close)'),
      // Commenting out complex queries that may have parser issues
      // maxDrawdown: jsonata(`
      //   $map(data, function($v, $i) {
      //     $peak := $max(data[0..$i].close);
      //     ($v.close - $peak) / $peak * 100
      //   }) ~> $min()
      // `),
      // volatility: jsonata(`
      //   $changes := $map(data[0..$count(data)-2], function($v, $i) {
      //     (data[$i].close - data[$i+1].close) / data[$i+1].close
      //   });
      //   $sqrt($average($map($changes, function($c) { $c * $c }))) * 100
      // `)
    };

    return await this.executeMultipleQueries(symbol, queries, options);
  }

  /**
   * Get moving averages (requires sufficient data points)
   */
  async getMovingAverages(symbol, periods = [20, 50, 200], options = {}) {
    const queries = {};
    
    for (const period of periods) {
      // Use array mapping with index check to get first N elements
      queries[`ma${period}`] = jsonata(`
        $average($map(data, function($v, $i) { 
          $i < ${period} ? $v.close : null 
        })[$ != null])
      `);
    }

    queries.currentPrice = jsonata('data[0].close');
    queries.dataPoints = jsonata('$count(data)');
    
    return await this.executeMultipleQueries(symbol, queries, options);
  }

  /**
   * Find specific price patterns or conditions
   */
  async findPriceConditions(symbol, options = {}) {
    const queries = {
      // Days where close > open (green days)
      greenDays: jsonata('$count(data[close > open])'),
      // Days where close < open (red days)  
      redDays: jsonata('$count(data[close < open])'),
      // Percentage of green days
      greenDaysPct: jsonata('$count(data[close > open]) / $count(data) * 100'),
      // Largest single day gain
      largestGain: jsonata('$max(data.(close - open) / open * 100)'),
      // Largest single day loss
      largestLoss: jsonata('$min(data.(close - open) / open * 100)'),
      // Days with >5% moves
      bigMoves: jsonata('data[$abs((close - open) / open * 100) > 5].{date: date, change: (close - open) / open * 100, close: close}'),
      // Gap ups/downs (open different from previous close)
      gaps: jsonata(`
        $map($range(0, $count(data)-1), function($i) {
          $current := data[$i];
          $previous := data[$i+1];
          $gap := ($current.open - $previous.close) / $previous.close * 100;
          $gap != 0 ? {
            "date": $current.date,
            "gap": $gap,
            "open": $current.open,
            "prevClose": $previous.close
          } : null
        })[$ != null][0..9]
      `)
    };

    return await this.executeMultipleQueries(symbol, queries, options);
  }

  /**
   * Get predefined query templates that users can reference
   */
  getQueryTemplates() {
    return {
      basic: {
        simplifiedBollingerB: {
          expression: '(data[0].close - $min(data.low)) / ($max(data.high) - $min(data.low)) * 100',
          chartType: 'stat',
          label: 'Simplified Bollinger %B',
          format: 'percent'
        },
        bollingerB: {
          expression: '($currentPrice := data[0].close; $sma := $average($map(data, function($v, $i) { $i < 20 ? $v.close : null })[$ != null]); $stdDev := $sqrt($average($map($map(data, function($v, $i) { $i < 20 ? $v.close : null })[$ != null], function($price) { $power($price - $sma, 2) }))); $upperBand := $sma + (2 * $stdDev); $lowerBand := $sma - (2 * $stdDev); ($currentPrice - $lowerBand) / ($upperBand - $lowerBand) * 100)',
          chartType: 'stat',
          label: 'Bollinger %B (Traditional)',
          format: 'percent'
        },
        globalHigh: { 
          expression: '$max(data.high)', 
          chartType: 'stat', 
          label: 'Global High Price',
          format: 'currency'
        },
        globalLow: { 
          expression: '$min(data.low)', 
          chartType: 'stat', 
          label: 'Global Low Price',
          format: 'currency'
        },
        avgClose: { 
          expression: '$average(data.close)', 
          chartType: 'stat', 
          label: 'Average Close Price',
          format: 'currency'
        },
        totalVolume: { 
          expression: '$sum(data.volume)', 
          chartType: 'stat', 
          label: 'Total Volume',
          format: 'number'
        },
        recordCount: { 
          expression: '$count(data)', 
          chartType: 'stat', 
          label: 'Data Points',
          format: 'number'
        }
      },
      performance: {
        totalReturn: { 
          expression: '(data[0].close - data[$count(data)-1].close) / data[$count(data)-1].close * 100', 
          chartType: 'stat', 
          label: 'Total Return',
          format: 'percent'
        },
        startPrice: { 
          expression: 'data[$count(data)-1].close', 
          chartType: 'stat', 
          label: 'Starting Price',
          format: 'currency'
        },
        endPrice: { 
          expression: 'data[0].close', 
          chartType: 'stat', 
          label: 'Ending Price',
          format: 'currency'
        },
        priceRange: { 
          expression: '$max(data.close) - $min(data.close)', 
          chartType: 'stat', 
          label: 'Price Range',
          format: 'currency'
        }
      },
      advanced: {
        volatility: { 
          expression: '$sqrt($average($map($filter(data, function($v, $i) { $i < $count(data)-1 }), function($v, $i) { $power((data[$i].close - data[$i+1].close) / data[$i+1].close, 2) }))) * 100', 
          chartType: 'stat', 
          label: 'Volatility',
          format: 'percent'
        },
        movingAverage20: { 
          expression: '$average($map(data, function($v, $i) { $i < 20 ? $v.close : null })[$ != null])', 
          chartType: 'stat', 
          label: '20-Day Moving Average',
          format: 'currency'
        },
        highestVolumeDay: { 
          expression: '($maxVol := $max(data.volume); data[volume = $maxVol])', 
          chartType: 'object', 
          label: 'Highest Volume Day'
        },
        priceAboveMa: { 
          expression: '$count($filter(data, function($v, $i) { $i < 20 and $v.close > $average($map(data, function($x, $j) { $j < 20 ? $x.close : null })[$ != null]) }))', 
          chartType: 'stat', 
          label: 'Days Above MA20',
          format: 'number'
        }
      },
      patterns: {
        consecutiveGreenDays: { 
          expression: '$count(data[close > open])', 
          chartType: 'stat', 
          label: 'Total Green Days',
          format: 'number'
        },
        gapUps: { 
          expression: '$count($map(data, function($v, $i) { $i > 0 and $v.open > data[$i-1].close ? 1 : null })[$ != null])', 
          chartType: 'stat', 
          label: 'Gap Up Days',
          format: 'number'
        },
        largeMoves: { 
          expression: 'data[$abs((close - open) / open * 100) > 5].{date: date, change: (close - open) / open * 100}', 
          chartType: 'table', 
          label: 'Large Price Moves (>5%)'
        }
      }
    };
  }
}

module.exports = new QueryService();