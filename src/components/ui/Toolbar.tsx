import { observer } from 'mobx-react-lite'
import { appStore } from '@/stores/AppStore'
import { VectorStore, Tool } from '@/stores/VectorStore'

interface ToolbarProps {
  vectorStore: VectorStore
}

export const Toolbar = observer(({ vectorStore }: ToolbarProps) => {
  const { performanceStore } = appStore
  
  const toolGroups = [
    {
      name: 'Selection',
      tools: [
        { id: 'select' as Tool, icon: '↖️', label: 'Select', key: 'V' },
      ]
    },
    {
      name: 'Drawing',
      tools: [
        { id: 'pen' as Tool, icon: '✏️', label: 'Pen', key: 'P' },
        { id: 'bezier' as Tool, icon: '〰️', label: 'Bezier', key: 'B' },
        { id: 'line' as Tool, icon: '📏', label: 'Line', key: 'L' },
      ]
    },
    {
      name: 'Shapes',
      tools: [
        { id: 'rectangle' as Tool, icon: '⬛', label: 'Rectangle', key: 'R' },
        { id: 'circle' as Tool, icon: '⭕', label: 'Circle', key: 'C' },
        { id: 'ellipse' as Tool, icon: '🥚', label: 'Ellipse', key: 'E' },
        { id: 'polygon' as Tool, icon: '⬢', label: 'Polygon', key: 'G' },
        { id: 'star' as Tool, icon: '⭐', label: 'Star', key: 'S' },
      ]
    },
    {
      name: 'Content',
      tools: [
        { id: 'text' as Tool, icon: '📝', label: 'Text', key: 'T' },
      ]
    }
  ]

  const handleSVGImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.svg'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const content = await file.text()
        await vectorStore.importSVG(content)
      }
    }
    input.click()
  }

  const handleSVGExport = () => {
    const svg = vectorStore.exportSVG()
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vector-graphics.svg'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  return (
    <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 backdrop-blur-lg z-50">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="text-2xl animate-sparkle">🎨</div>
        <span className="text-lg font-semibold text-gray-900 tracking-tight">
          Vector Studio
        </span>
      </div>
      
      {/* Tool Groups */}
      <div className="flex items-center gap-4">
        {toolGroups.map((group, groupIndex) => (
          <div key={group.name} className="flex items-center gap-1">
            {groupIndex > 0 && <div className="w-px h-6 bg-gray-300 mx-2" />}
            {group.tools.map(tool => (
              <button
                key={tool.id}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 relative group ${
                  vectorStore.activeTool === tool.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                onClick={() => vectorStore.setActiveTool(tool.id)}
                title={`${tool.label} (${tool.key})`}
              >
                <span className="text-lg">{tool.icon}</span>
                {/* Keyboard shortcut tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
                  {tool.label} ({tool.key})
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* File Operations */}
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-all duration-200"
          onClick={handleSVGImport}
          title="Import SVG"
        >
          📁 Import
        </button>
        
        <button
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-all duration-200"
          onClick={handleSVGExport}
          title="Export SVG"
          disabled={vectorStore.elements.length === 0}
        >
          💾 Export
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Collaboration */}
        <button
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-all duration-200 ${
            vectorStore.isCollaborating 
              ? 'border-green-300 bg-green-50 text-green-700' 
              : 'border-gray-300 hover:bg-gray-100'
          }`}
          onClick={() => {
            if (vectorStore.isCollaborating) {
              vectorStore.stopCollaboration()
            } else {
              const roomId = prompt('Enter room ID:')
              if (roomId) {
                vectorStore.startCollaboration(roomId, { 
                  id: 'user-' + Date.now(), 
                  name: 'User', 
                  color: '#3B82F6' 
                })
              }
            }
          }}
          title={vectorStore.isCollaborating ? 'Stop Collaboration' : 'Start Collaboration'}
        >
          {vectorStore.isCollaborating ? '🟢' : '👥'} 
          {vectorStore.isCollaborating ? 'Live' : 'Collaborate'}
        </button>

        <div className="w-px h-6 bg-gray-300 mx-2" />

        {/* Grid Toggle */}
        <button
          className={`flex items-center justify-center w-10 h-10 border rounded-lg transition-all duration-200 ${
            vectorStore.grid.enabled
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-300 hover:bg-gray-100'
          }`}
          onClick={() => vectorStore.setGrid({ enabled: !vectorStore.grid.enabled })}
          title="Toggle Grid"
        >
          📐
        </button>

        {/* Performance Stats */}
        <button
          className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all duration-200"
          onClick={() => performanceStore.toggleStats()}
          title="Performance Stats"
        >
          📊
        </button>
        
        {/* Color Panel Toggle */}
        <button
          className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-100 transition-all duration-200"
          onClick={() => appStore.togglePanel()}
          title="Toggle Color Panel"
        >
          🎨
        </button>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 transition-all duration-200"
            onClick={() => vectorStore.zoomOut()}
            title="Zoom Out"
          >
            ➖
          </button>
          <span className="text-sm text-gray-600 min-w-12 text-center">
            {Math.round(vectorStore.viewport.zoom * 100)}%
          </span>
          <button
            className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 transition-all duration-200"
            onClick={() => vectorStore.zoomIn()}
            title="Zoom In"
          >
            ➕
          </button>
          <button
            className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 transition-all duration-200 ml-1"
            onClick={() => vectorStore.resetZoom()}
            title="Reset Zoom"
          >
            🎯
          </button>
        </div>
      </div>
    </div>
  )
}) 