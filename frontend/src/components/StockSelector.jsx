import { useState } from 'react';

// Pre-loaded stock symbols with split data
const AVAILABLE_STOCKS = [
  'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'TSLA', 'META',
  'NFLX', 'AMD', 'INTC', 'CRM', 'SHOP', 'SQ', 'PYPL', 'ZM', 'DOCU',
  'PLTR', 'SNOW', 'U', 'OKTA', 'TWLO', 'MDB', 'CRWD', 'DDOG',
  'NOW', 'WDAY', 'SPLK', 'TEAM', 'ZI', 'GME'
];

export default function StockSelector({ symbol, onChange }) {
  const [customSymbol, setCustomSymbol] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (customSymbol.trim()) {
      onChange(customSymbol.toUpperCase());
      setUseCustom(false);
      setCustomSymbol('');
    }
  };

  return (
    <div className="bg-gray-800 shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Stock Symbol</h2>
      
      {!useCustom ? (
        <>
          <select
            value={symbol}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {AVAILABLE_STOCKS.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>
          <button
            onClick={() => setUseCustom(true)}
            className="mt-2 text-sm text-blue-400 hover:text-blue-300"
          >
            Enter custom symbol
          </button>
        </>
      ) : (
        <form onSubmit={handleCustomSubmit}>
          <input
            type="text"
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            placeholder="Enter symbol (e.g., TSLA)"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="submit"
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Use
            </button>
            <button
              type="button"
              onClick={() => setUseCustom(false)}
              className="px-3 py-1 text-sm bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      
      <div className="mt-3 text-xs text-gray-400">
        Current: <span className="font-semibold text-gray-200">{symbol}</span>
      </div>
    </div>
  );
}
