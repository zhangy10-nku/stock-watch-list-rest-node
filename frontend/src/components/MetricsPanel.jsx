import { useState, useEffect } from 'react';
import StatCard from './StatCard';

export default function MetricsPanel({ symbol, visible, onClose }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible || !symbol) {
      return;
    }

    const fetchMetrics = async () => {
      setLoading(true);
      
      try {
        // Calculate 5 years ago from today
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        const startDate = fiveYearsAgo.toISOString().split('T')[0];

        // Fetch multiple metrics in parallel
        const response = await fetch(`/api/stocks/query/${symbol}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            queries: {
              // Simplified Bollinger %B (based on 5-year high/low range)
              simplifiedBollingerB: '(data[0].close - $min(data.low)) / ($max(data.high) - $min(data.low)) * 100',
              
              // Traditional Bollinger %B (20-day SMA with 2 standard deviations)
              bollingerB: `
                (
                  $currentPrice := data[0].close;
                  $last20 := $filter(data, function($v, $i) { $i < 20 });
                  $sma20 := $average($last20.close);
                  $stdDev := $sqrt($average($map($last20.close, function($v) { $power($v - $sma20, 2) })));
                  $upperBand := $sma20 + (2 * $stdDev);
                  $lowerBand := $sma20 - (2 * $stdDev);
                  ($currentPrice - $lowerBand) / ($upperBand - $lowerBand) * 100
                )
              `,
              
              // 5-year high
              fiveYearHigh: '$max(data.high)',
              
              // 5-year low
              fiveYearLow: '$min(data.low)',
              
              // Current price
              currentPrice: 'data[0].close',
              
              // 20-day volatility (standard deviation of daily returns)
              volatility20Day: `
                (
                  $last20 := $filter(data, function($v, $i) { $i < 20 });
                  $returns := $map($last20, function($v, $i) {
                    $i < 19 ? ($last20[$i].close - $last20[$i+1].close) / $last20[$i+1].close * 100 : null
                  });
                  $validReturns := $filter($returns, function($r) { $r != null });
                  $sqrt($average($map($validReturns, function($r) { $power($r, 2) })))
                )
              `,
              
              // Distance from 5-year high (percentage)
              distanceFromHigh: '(data[0].close / $max(data.high) - 1) * 100',
              
              // Distance from 5-year low (percentage)
              distanceFromLow: '(data[0].close / $min(data.low) - 1) * 100'
            },
            startDate: startDate,
            limit: 1260 // ~5 years of trading days
          })
        });

        const data = await response.json();
        
        if (data.success && data.results) {
          setMetrics(data.results);
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [symbol, visible]);

  if (!visible) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300">
              Metrics for {symbol}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 text-sm"
            >
              ✕
            </button>
          </div>
          <div className="text-sm text-gray-400">Loading metrics...</div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300">
            Key Metrics for {symbol}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-sm px-2"
          >
            ✕
          </button>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatCard 
            label="Current Price" 
            value={metrics.currentPrice} 
            format="currency"
            compact={true}
            description="Most recent closing price from historical data"
          />
          
          <StatCard 
            label="From High" 
            value={metrics.distanceFromHigh} 
            format="percentage"
            compact={true}
            description="(Current / 5Y High - 1) × 100. Negative value shows how far below the 5-year high."
          />
          
          <StatCard 
            label="From Low" 
            value={metrics.distanceFromLow} 
            format="percentage"
            compact={true}
            description="(Current / 5Y Low - 1) × 100. Positive value shows how far above the 5-year low."
          />
          
          <StatCard 
            label="5Y High" 
            value={metrics.fiveYearHigh} 
            format="currency"
            compact={true}
            description="Highest price reached in the last 5 years"
          />
          
          <StatCard 
            label="5Y Low" 
            value={metrics.fiveYearLow} 
            format="currency"
            compact={true}
            description="Lowest price reached in the last 5 years"
          />
          
          <StatCard 
            label="Simplified %B" 
            value={metrics.simplifiedBollingerB} 
            format="percentage"
            compact={true}
            description="(Current - 5Y Low) / (5Y High - 5Y Low) × 100. Shows position in 5-year range. 0% = at low, 100% = at high."
          />
          
          <StatCard 
            label="Bollinger %B" 
            value={metrics.bollingerB} 
            format="percentage"
            compact={true}
            description="(Price - Lower Band) / (Upper Band - Lower Band) × 100. Bands = 20-day SMA ± 2σ. >100% = overbought, <0% = oversold."
          />
          
          <StatCard 
            label="20D Volatility" 
            value={metrics.volatility20Day} 
            format="percentage"
            compact={true}
            description="Standard deviation of daily percentage returns over last 20 days. Higher = more price fluctuation."
          />
        </div>
      </div>
    </div>
  );
}
