import { observer } from 'mobx-react-lite'
import { appStore } from '@/stores/AppStore'

export const Toolbar = observer(() => {
  const { selectedTool, performanceStore } = appStore
  
  const tools = [
    { id: 'color-picker' as const, icon: '🎨', label: 'Color Picker' },
    { id: 'gradient' as const, icon: '🌈', label: 'Gradient' },
    { id: 'text' as const, icon: '📝', label: 'Text' },
    { id: 'shape' as const, icon: '⬛', label: 'Shape' },
  ]
  
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 backdrop-blur-lg z-50">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="text-2xl animate-sparkle">✨</div>
        <span className="text-lg font-semibold text-gray-900 tracking-tight">
          Pictorial
        </span>
      </div>
      
      {/* Tools */}
      <div className="flex items-center gap-2 px-5">
        {tools.map(tool => (
          <button
            key={tool.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 min-w-32 justify-start ${
              selectedTool === tool.id
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:-translate-y-0.5'
            }`}
            onClick={() => appStore.setSelectedTool(tool.id)}
            title={tool.label}
          >
            <span className="text-base opacity-90">{tool.icon}</span>
            <span className="font-medium text-sm whitespace-nowrap">{tool.label}</span>
          </button>
        ))}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          className="flex items-center justify-center w-10 h-10 text-base border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 hover:-translate-y-0.5"
          onClick={() => performanceStore.toggleStats()}
          title="Performance Stats"
        >
          📊
        </button>
        
        <button
          className="flex items-center justify-center w-10 h-10 text-base border border-gray-300 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 hover:-translate-y-0.5"
          onClick={() => appStore.togglePanel()}
          title="Toggle Panel"
        >
          🎛️
        </button>
      </div>
    </div>
  )
}) 