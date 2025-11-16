import { useState, useEffect } from 'react';
import TickerBar from './components/TickerBar';
import MetricsPanel from './components/MetricsPanel';
import TemplateGallery from './components/TemplateGallery';
import StockSelector from './components/StockSelector';
import DateRangePicker from './components/DateRangePicker';
import QueryResults from './components/QueryResults';
import AdvancedEditor from './components/AdvancedEditor';

function App() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [symbol, setSymbol] = useState('NVDA');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2025-11-15');
  const [queryExpression, setQueryExpression] = useState('');
  const [chartMetadata, setChartMetadata] = useState(null); // Store chart type, label, format
  const [queryResults, setQueryResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsSymbol, setMetricsSymbol] = useState(null);

  // Fetch templates on mount
  useEffect(() => {
    fetch('/api/stocks/query/templates')
      .then(res => res.json())
      .then(data => {
        // Convert templates object to array format
        const templatesObj = data.templates || {};
        const templatesArray = [];
        
        // Flatten the categorized templates into a single array
        Object.entries(templatesObj).forEach(([category, queries]) => {
          Object.entries(queries).forEach(([name, queryConfig]) => {
            // Handle both old string format and new object format
            const expression = typeof queryConfig === 'string' ? queryConfig : queryConfig.expression;
            const chartType = typeof queryConfig === 'object' ? queryConfig.chartType : null;
            const label = typeof queryConfig === 'object' ? queryConfig.label : name;
            const format = typeof queryConfig === 'object' ? queryConfig.format : null;
            
            templatesArray.push({
              name: `${category}: ${name}`,
              category: category,
              expression: expression,
              chartType: chartType,
              label: label,
              format: format,
              description: getTemplateDescription(category, name),
              endpoint: getTemplateEndpoint(name)
            });
          });
        });
        
        setTemplates(templatesArray);
      })
      .catch(err => {
        console.error('Failed to load templates:', err);
        setTemplates([]);
      });
  }, []);
  
  // Helper function to get template descriptions
  const getTemplateDescription = (category, name) => {
    const descriptions = {
      'basic-simplifiedBollingerB': 'Price position within high/low range (0-100%)',
      'basic-bollingerB': 'Traditional Bollinger %B with 20-day SMA and 2σ bands',
      'basic-globalHigh': 'Find the highest price in the date range',
      'basic-globalLow': 'Find the lowest price in the date range',
      'basic-avgClose': 'Calculate average closing price',
      'basic-totalVolume': 'Sum of all trading volume',
      'basic-recordCount': 'Count of data points',
      'performance-totalReturn': 'Calculate total return percentage',
      'performance-startPrice': 'Starting price',
      'performance-endPrice': 'Ending price',
      'performance-priceRange': 'Price range (high - low)',
      'advanced-volatility': 'Calculate price volatility',
      'advanced-movingAverage20': '20-day moving average',
      'advanced-highestVolumeDay': 'Day with highest volume',
      'advanced-priceAboveMa': 'Days above moving average',
      'patterns-consecutiveGreenDays': 'Longest streak of up days',
      'patterns-gapUps': 'Find gap up days',
      'patterns-largeMoves': 'Find days with >5% moves'
    };
    return descriptions[`${category}-${name}`] || 'Query data';
  };
  
  // Helper function to get template endpoints
  const getTemplateEndpoint = (name) => {
    const endpoints = {
      'globalHigh': '/api/stocks/query/:symbol/high-low',
      'globalLow': '/api/stocks/query/:symbol/high-low',
      'totalReturn': '/api/stocks/query/:symbol/performance',
      'movingAverage20': '/api/stocks/query/:symbol/moving-averages'
    };
    return endpoints[name] || '/api/stocks/query/:symbol';
  };

  // Execute query
  const executeQuery = async () => {
    setLoading(true);
    setError(null);
    
    try {
      let url, options;
      
      if (advancedMode) {
        // Advanced mode: POST with custom expression
        url = `/api/stocks/query/${symbol}`;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            queries: { result: queryExpression },
            startDate,
            endDate
          })
        };
      } else if (selectedTemplate) {
        // Template mode: check if it has a specific endpoint or needs POST
        const endpoint = selectedTemplate.endpoint;
        const needsPost = endpoint === '/api/stocks/query/:symbol';
        
        url = endpoint.replace(':symbol', symbol) + `?startDate=${startDate}&endDate=${endDate}`;
        
        if (needsPost) {
          // Most templates need POST with expression wrapped in queries object
          options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              queries: { result: queryExpression },
              startDate,
              endDate
            })
          };
        } else {
          // Special endpoints like /high-low, /performance use GET
          options = { method: 'GET' };
        }
      } else {
        throw new Error('No template selected');
      }

      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Query failed');
      }
      
      setQueryResults(data);
    } catch (err) {
      setError(err.message);
      setQueryResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setQueryExpression(template.expression);
    setChartMetadata({
      chartType: template.chartType,
      label: template.label,
      format: template.format
    });
    setAdvancedMode(false);
  };

  // Handle ticker click - toggle metrics panel
  const handleTickerClick = (clickedSymbol) => {
    if (metricsVisible && metricsSymbol === clickedSymbol) {
      // Clicking same symbol - close metrics
      setMetricsVisible(false);
      setMetricsSymbol(null);
    } else {
      // Clicking different symbol or opening for first time
      setSymbol(clickedSymbol);
      setMetricsSymbol(clickedSymbol);
      setMetricsVisible(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Ticker Bar */}
      <TickerBar onSymbolClick={handleTickerClick} />

      {/* Metrics Panel */}
      <MetricsPanel 
        symbol={metricsSymbol} 
        visible={metricsVisible}
        onClose={() => {
          setMetricsVisible(false);
          setMetricsSymbol(null);
        }}
      />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Query Builder */}
          <div className="lg:col-span-1 space-y-6">
            {/* Mode Toggle */}
            <div className="bg-gray-800 shadow rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">
                  {advancedMode ? 'Advanced Mode' : 'Template Mode'}
                </span>
                <button
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {advancedMode ? 'Use Templates' : 'Advanced'}
                </button>
              </div>
            </div>

            {/* Template Gallery or Advanced Editor */}
            {advancedMode ? (
              <AdvancedEditor 
                expression={queryExpression}
                onChange={setQueryExpression}
              />
            ) : (
              <TemplateGallery 
                templates={templates}
                selectedTemplate={selectedTemplate}
                onSelect={handleTemplateSelect}
              />
            )}

            {/* Stock Selector */}
            <StockSelector 
              symbol={symbol}
              onChange={setSymbol}
            />

            {/* Date Range Picker */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />

          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2 space-y-4">
            {/* Thin Execute Button */}
            {queryExpression && (
              <button
                onClick={executeQuery}
                disabled={loading || (!advancedMode && !selectedTemplate) || (advancedMode && !queryExpression)}
                className="w-full py-1 px-4 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                {loading ? 'Executing...' : 'Run Query'}
              </button>
            )}

            {/* Expression Display */}
            {queryExpression && (
              <div className="bg-gray-800 shadow rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  JSONata Expression
                </h3>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded whitespace-pre-wrap break-words">
                  {queryExpression}
                </pre>
              </div>
            )}

            {/* Execute Button - Show when no expression */}
            {!queryExpression && (
              <button
                onClick={executeQuery}
                disabled={loading || (!advancedMode && !selectedTemplate) || (advancedMode && !queryExpression)}
                className="w-full py-3 px-4 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed shadow-lg"
              >
                {loading ? 'Executing...' : 'Execute Query'}
              </button>
            )}

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            <QueryResults 
              results={queryResults}
              loading={loading}
              chartMetadata={chartMetadata}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
