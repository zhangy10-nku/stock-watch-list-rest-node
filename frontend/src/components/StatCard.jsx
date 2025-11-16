export default function StatCard({ label, value, format }) {
  const formatValue = (val, fmt) => {
    if (val === null || val === undefined) return 'N/A';
    
    switch (fmt) {
      case 'currency':
        return `$${Number(val).toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        })}`;
      case 'percent':
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
    if (format === 'percent' && typeof value === 'number') {
      if (value > 0) return 'text-green-400';
      if (value < 0) return 'text-red-400';
    }
    return 'text-blue-400';
  };

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
