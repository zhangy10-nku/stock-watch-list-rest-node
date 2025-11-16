export default function TemplateGallery({ templates, selectedTemplate, onSelect }) {
  return (
    <div className="bg-gray-800 shadow rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Query Templates</h2>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {templates.map((template) => (
          <button
            key={template.name}
            onClick={() => onSelect(template)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedTemplate?.name === template.name
                ? 'border-blue-500 bg-blue-900'
                : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
            }`}
          >
            <div className="font-medium text-gray-100">{template.name}</div>
            <div className="text-sm text-gray-400 mt-1">{template.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
