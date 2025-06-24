import { useEffect, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { WebGLRenderer } from '@/core/rendering/WebGLRenderer'
import { CanvasRenderer } from '@/core/rendering/CanvasRenderer'
import { appStore } from '@/stores/AppStore'

export const Canvas = observer(() => {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvas2dRef = useRef<HTMLCanvasElement>(null)
  const webglRendererRef = useRef<WebGLRenderer>()
  const canvasRendererRef = useRef<CanvasRenderer>()
  
  useEffect(() => {
    if (!webglCanvasRef.current || !canvas2dRef.current) return
    
    try {
      // Initialize renderers
      webglRendererRef.current = new WebGLRenderer(webglCanvasRef.current)
      canvasRendererRef.current = new CanvasRenderer(canvas2dRef.current)
      
      appStore.canvasStore.setReady(true)
      
      // Handle resize
      const handleResize = () => {
        webglRendererRef.current?.resize()
        canvasRendererRef.current?.resize()
      }
      
      window.addEventListener('resize', handleResize)
      handleResize()
      
      return () => {
        window.removeEventListener('resize', handleResize)
        webglRendererRef.current?.destroy()
        canvasRendererRef.current?.destroy()
      }
    } catch (error) {
      console.error('Failed to initialize canvas:', error)
    }
  }, [])
  
  // Update performance stats
  useEffect(() => {
    const interval = setInterval(() => {
      if (webglRendererRef.current) {
        const stats = webglRendererRef.current.getStats()
        appStore.performanceStore.updateStats(stats)
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="relative flex-1 w-full h-full overflow-hidden bg-gray-100">
      <canvas 
        ref={webglCanvasRef}
        className="absolute top-0 left-0 w-full h-full block cursor-crosshair z-10"
      />
      <canvas 
        ref={canvas2dRef}
        className="absolute top-0 left-0 w-full h-full block pointer-events-none z-20"
      />
      
      {appStore.performanceStore.showStats && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-80 text-white p-3 rounded-lg font-mono text-xs leading-relaxed z-30 backdrop-blur-sm">
          <div className="mb-1">FPS: {appStore.performanceStore.stats.fps}</div>
          <div className="mb-1">Frame: {appStore.performanceStore.stats.frameTime.toFixed(2)}ms</div>
          <div>Draws: {appStore.performanceStore.stats.drawCalls}</div>
        </div>
      )}
    </div>
  )
}) 