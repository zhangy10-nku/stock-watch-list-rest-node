import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ChartDisplay({ data }) {
  // Determine chart type based on data structure
  const renderChart = () => {
    // Case 1: Array of data points (time series)
    if (Array.isArray(data.data) && data.data.length > 0) {
      const firstItem = data.data[0];
      
      // Check if it has date and numeric fields
      if (firstItem.date) {
        return renderTimeSeriesChart(data.data);
      }
    }

    // Case 2: Query result with specific structure
    if (data.result) {
      // Single value results (like high/low)
      if (typeof data.result === 'object' && !Array.isArray(data.result)) {
        return renderKeyValueDisplay(data.result);
      }
      
      // Array results
      if (Array.isArray(data.result)) {
        return renderArrayResult(data.result);
      }
    }

    // Default: show raw data
    return (
      <div className="p-8 text-center text-gray-600">
        <p>Visual representation not available for this data type.</p>
        <p className="text-sm mt-2">Try the JSON or Table view.</p>
      </div>
    );
  };

  const renderTimeSeriesChart = (chartData) => {
    // Limit data points for performance
    const displayData = chartData.length > 365 
      ? chartData.filter((_, idx) => idx % Math.ceil(chartData.length / 365) === 0)
      : chartData;

    // Determine which fields to plot
    const hasClose = displayData[0].close !== undefined;
    const hasVolume = displayData[0].volume !== undefined;

    return (
      <div className="p-4 space-y-6">
        {hasClose && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Price History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                />
                <Legend />
                <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} dot={false} name="Close Price" />
                {displayData[0].high !== undefined && (
                  <Line type="monotone" dataKey="high" stroke="#10b981" strokeWidth={1} dot={false} name="High" />
                )}
                {displayData[0].low !== undefined && (
                  <Line type="monotone" dataKey="low" stroke="#ef4444" strokeWidth={1} dot={false} name="Low" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {hasVolume && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Volume</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={displayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value) => value.toLocaleString()}
                />
                <Bar dataKey="volume" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };

  const renderKeyValueDisplay = (result) => {
    return (
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(result).map(([key, value]) => (
            <div key={key} className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">{key}</div>
              <div className="text-2xl font-bold text-gray-900">
                {typeof value === 'number' 
                  ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArrayResult = (result) => {
    // If array items have numeric values, try to chart them
    if (result.length > 0 && typeof result[0] === 'object') {
      const firstItem = result[0];
      const numericFields = Object.entries(firstItem)
        .filter(([_, value]) => typeof value === 'number')
        .map(([key, _]) => key);

      if (numericFields.length > 0) {
        return (
          <div className="p-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={result}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={Object.keys(firstItem)[0]} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {numericFields.map((field, idx) => (
                  <Bar 
                    key={field} 
                    dataKey={field} 
                    fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
    }

    return (
      <div className="p-8 text-center text-gray-600">
        <p>Visual representation not available for this result type.</p>
        <p className="text-sm mt-2">Try the JSON or Table view.</p>
      </div>
    );
  };

  return (
    <div className="min-h-[400px]">
      {renderChart()}
    </div>
  );
}
