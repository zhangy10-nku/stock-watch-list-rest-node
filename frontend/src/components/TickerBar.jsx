import { useState, useEffect } from 'react';

const MAGNIFICENT_7 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA'];

export default function TickerBar({ onSymbolClick }) {
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Try to get real-time prices first
        const realtimeResponse = await fetch('/api/stocks/current-prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: MAGNIFICENT_7 })
        });
        
        const realtimeData = await realtimeResponse.json();
        
        // If real-time data is available, use it
        if (realtimeData.data && Object.keys(realtimeData.data).length > 0) {
          setPrices(realtimeData.data);
          setLoading(false);
          return;
        }
        
        // Fallback: fetch last closing prices from historical data
        const fallbackPrices = {};
        await Promise.all(
          MAGNIFICENT_7.map(async (symbol) => {
            try {
              const response = await fetch(`/api/stocks/historical/${symbol}?limit=1`);
              const data = await response.json();
              
              if (data.data && data.data.length > 0) {
                const lastDay = data.data[0];
                fallbackPrices[symbol] = {
                  price: lastDay.close,
                  open: lastDay.open,
                  high: lastDay.high,
                  low: lastDay.low,
                  close: lastDay.close,
                  volume: lastDay.volume,
                  change: lastDay.close - lastDay.open,
                  changePercent: ((lastDay.close - lastDay.open) / lastDay.open) * 100,
                  timestamp: lastDay.date,
                  source: 'historical'
                };
              }
            } catch (err) {
              console.error(`Failed to fetch fallback price for ${symbol}:`, err);
            }
          })
        );
        
        setPrices(fallbackPrices);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch ticker prices:', error);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchPrices();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-center space-x-4">
            <span className="text-xs text-gray-400">Loading prices...</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-around gap-2">
          {MAGNIFICENT_7.map((symbol) => {
            const priceData = prices[symbol];
            const price = priceData?.price;
            const change = priceData?.change;
            const changePercent = priceData?.changePercent;
            const isPositive = change > 0;
            const isNegative = change < 0;

            return (
              <button
                key={symbol}
                onClick={() => onSymbolClick && onSymbolClick(symbol)}
                className="flex-1 px-2 py-1.5 hover:bg-gray-700 rounded transition-colors cursor-pointer group min-w-0"
              >
                <div className="flex flex-col items-center">
                  <span className="text-sm font-semibold text-gray-200 group-hover:text-white">
                    {symbol}
                  </span>
                  {price !== undefined ? (
                    <>
                      <span className="text-xs text-gray-300">
                        ${price.toFixed(2)}
                      </span>
                      {change !== undefined && (
                        <span
                          className={`text-xs font-medium ${
                            isPositive
                              ? 'text-green-400'
                              : isNegative
                              ? 'text-red-400'
                              : 'text-gray-400'
                          }`}
                        >
                          {isPositive ? '↑' : isNegative ? '↓' : ''}
                          {Math.abs(changePercent || 0).toFixed(2)}%
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
