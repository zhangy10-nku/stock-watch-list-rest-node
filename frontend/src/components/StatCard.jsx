export default function StatCard({ label, value, format, compact = false, description }) {
  const formatValue = (val, fmt) => {
    if (val === null || val === undefined) return 'N/A';
    
    switch (fmt) {
      case 'currency':
        return `$${Number(val).toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
      case 'percent':
      case 'percentage':
        return `${Number(val).toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}%`;
      case 'number':
        return Number(val).toLocaleString(undefined, { 
          maximumFractionDigits: 0 
        });
      default:
        if (typeof val === 'number') {
          return Number(val).toLocaleString(undefined, { 
            maximumFractionDigits: 4 
          });
        }
        return String(val);
    }
  };

  const getColorClass = () => {
    if ((format === 'percent' || format === 'percentage') && typeof value === 'number') {
      if (value > 0) return 'text-green-400';
      if (value < 0) return 'text-red-400';
    }
    return 'text-blue-400';
  };

  if (compact) {
    return (
      <div className="bg-gray-700 rounded px-3 py-2 border border-gray-600" title={description}>
        <div className="text-xs text-gray-400 mb-1">
          {label}
        </div>
        <div className={`text-lg font-semibold ${getColorClass()}`}>
          {formatValue(value, format)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 shadow rounded-lg p-6 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">
        {label}
      </h3>
      <p className={`text-4xl font-bold ${getColorClass()}`}>
        {formatValue(value, format)}
      </p>
    </div>
  );
}
