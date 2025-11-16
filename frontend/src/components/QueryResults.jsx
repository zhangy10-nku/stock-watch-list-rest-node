import { useState } from 'react';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import ChartDisplay from './ChartDisplay';
import StatCard from './StatCard';

export default function QueryResults({ results, loading, chartMetadata }) {
  const [viewMode, setViewMode] = useState('json'); // 'json', 'chart', 'table'

  if (loading) {
    return (
      <div className="bg-gray-800 shadow rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-300">Executing query...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-gray-800 shadow rounded-lg p-8 text-center text-gray-400">
        <p>No results yet. Select a template and execute a query to see results.</p>
      </div>
    );
  }

  const renderContent = () => {
    switch (viewMode) {
      case 'json':
        return (
          <div className="p-4">
            <JsonView 
              src={results}
              collapsed={2}
            />
          </div>
        );
      case 'chart':
        return renderChart();
      case 'table':
        return renderTable();
      default:
        return null;
    }
  };

  const renderChart = () => {
    // Extract the actual result value
    const resultValue = results.results?.result ?? results.result;
    
    // If we have chart metadata from a template, use it
    if (chartMetadata) {
      const { chartType, label, format } = chartMetadata;
      
      if (chartType === 'stat' && typeof resultValue === 'number') {
        return (
          <div className="p-6">
            <StatCard label={label} value={resultValue} format={format} />
          </div>
        );
      }
      
      if (chartType === 'object' && typeof resultValue === 'object' && !Array.isArray(resultValue)) {
        return (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-300 mb-4">{label}</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(resultValue).map(([key, value]) => (
                <StatCard 
                  key={key} 
                  label={key} 
                  value={value} 
                  format={typeof value === 'number' && key.includes('price') ? 'currency' : null}
                />
              ))}
            </div>
          </div>
        );
      }
      
      if (chartType === 'table' && Array.isArray(resultValue)) {
        return renderTable();
      }
    }
    
    // Fallback: infer chart type for custom queries
    if (typeof resultValue === 'number') {
      return (
        <div className="p-6">
          <StatCard label="Result" value={resultValue} format={null} />
        </div>
      );
    }
    
    if (typeof resultValue === 'object' && !Array.isArray(resultValue) && resultValue !== null) {
      return (
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-4">Result</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(resultValue).map(([key, value]) => (
              <StatCard 
                key={key} 
                label={key} 
                value={value} 
                format={typeof value === 'number' && key.includes('price') ? 'currency' : null}
              />
            ))}
          </div>
        </div>
      );
    }
    
    if (Array.isArray(resultValue)) {
      return renderTable();
    }
    
    // Default fallback to old chart display
    return <ChartDisplay data={results} />;
  };

  const renderTable = () => {
    // Handle different result structures
    let tableData = [];
    
    if (Array.isArray(results.result)) {
      tableData = results.result;
    } else if (results.result && typeof results.result === 'object') {
      tableData = [results.result];
    } else if (Array.isArray(results.data)) {
      tableData = results.data.slice(0, 100); // Limit to 100 rows
    } else {
      return (
        <div className="p-4 text-gray-400">
          Table view not available for this result type
        </div>
      );
    }

    if (tableData.length === 0) {
      return <div className="p-4 text-gray-400">No data to display</div>;
    }

    const columns = Object.keys(tableData[0]);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {tableData.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-700">
                {columns.map((col) => (
                  <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                    {typeof row[col] === 'number' 
                      ? row[col].toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 shadow rounded-lg">
      {/* View Mode Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex -mb-px">
          <button
            onClick={() => setViewMode('json')}
            className={`px-6 py-3 text-sm font-medium ${
              viewMode === 'json'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-6 py-3 text-sm font-medium ${
              viewMode === 'chart'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-6 py-3 text-sm font-medium ${
              viewMode === 'table'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Table
          </button>
        </nav>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {renderContent()}
      </div>
    </div>
  );
}
