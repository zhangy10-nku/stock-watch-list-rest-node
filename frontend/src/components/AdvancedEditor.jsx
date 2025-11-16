export default function AdvancedEditor({ expression, onChange }) {
  return (
    <div className="bg-gray-800 shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Custom JSONata Expression</h2>
      
      <textarea
        value={expression}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your JSONata expression here..."
        rows={10}
        className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-green-400 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500"
      />
      
      <div className="mt-3 text-xs text-gray-400">
        <p className="font-semibold mb-1 text-gray-300">Available fields:</p>
        <code className="bg-gray-900 text-green-400 px-2 py-1 rounded">
          date, open, high, low, close, volume, adjusted_close, split_adjusted, adjustment_factor
        </code>
      </div>
    </div>
  );
}
