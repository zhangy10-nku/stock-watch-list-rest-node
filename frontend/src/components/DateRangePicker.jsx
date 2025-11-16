export default function DateRangePicker({ startDate, endDate, onStartDateChange, onEndDateChange }) {
  return (
    <div className="bg-gray-800 shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Date Range</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            onStartDateChange(oneYearAgo);
            onEndDateChange(today);
          }}
          className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
        >
          Last Year
        </button>
        <button
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            const fiveYearsAgo = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            onStartDateChange(fiveYearsAgo);
            onEndDateChange(today);
          }}
          className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
        >
          Last 5 Years
        </button>
      </div>
    </div>
  );
}
