import { observer } from 'mobx-react-lite'
import { VectorCanvas } from '@/components/canvas/VectorCanvas'
import { Toolbar } from '@/components/ui/Toolbar'
import { ColorPanel } from '@/components/ui/ColorPanel'
import { VectorStore } from '@/stores/VectorStore'
import { useState, useEffect } from 'react'

// Create vector store instance
const vectorStore = new VectorStore()

export const App = observer(() => {
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const updateCanvasSize = () => {
      const container = document.querySelector('.canvas-container')
      if (container) {
        const rect = container.getBoundingClientRect()
        setCanvasSize({
          width: rect.width - 80, // Account for padding
          height: rect.height - 80
        })
        vectorStore.setViewport({ width: rect.width - 80, height: rect.height - 80 })
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)
    return () => window.removeEventListener('resize', updateCanvasSize)
  }, [])

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 text-gray-900 font-sans animate-fade-in">
      <Toolbar vectorStore={vectorStore} />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="canvas-container flex-1 bg-white border-r border-gray-200 flex items-center justify-center relative">
          {/* Beautiful canvas frame */}
          <div className="absolute inset-10 border-2 border-dashed border-gray-200 rounded-xl pointer-events-none bg-gradient-to-br from-gray-50 to-white"></div>
          {/* Bold canvas title */}
          <div className="absolute top-14 left-14 text-gray-800 text-xl font-bold pointer-events-none">
            Vector Graphics Studio
          </div>
          {/* Tool indicator */}
          <div className="absolute top-14 right-14 text-gray-600 text-sm font-medium pointer-events-none capitalize">
            {vectorStore.activeTool} Tool
          </div>
          {/* Frame label */}
          <div className="absolute bottom-14 left-14 text-gray-400 text-sm font-bold pointer-events-none">
            Canvas Frame - {canvasSize.width} × {canvasSize.height}
          </div>
          {/* Zoom level */}
          <div className="absolute bottom-14 right-14 text-gray-400 text-sm font-bold pointer-events-none">
            {Math.round(vectorStore.viewport.zoom * 100)}%
          </div>
          
          <VectorCanvas 
            store={vectorStore}
            width={canvasSize.width}
            height={canvasSize.height}
            className="relative z-10"
          />
        </div>
        <ColorPanel />
      </div>
    </div>
  )
}) 