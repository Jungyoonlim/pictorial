import React, { useRef, useEffect, useState, useCallback } from 'react'
import { observer } from 'mobx-react-lite'
import { VectorStore } from '../../stores/VectorStore'
import { Point, VectorElement } from '../../core/vector/VectorTypes'
import { SelectionHandle } from '../../core/transform/TransformEngine'
import { LiveCursor } from '../../core/collaboration/CollaborationEngine'

interface VectorCanvasProps {
  store: VectorStore
  width: number
  height: number
  className?: string
}

export const VectorCanvas = observer(({ store, width, height, className }: VectorCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [currentPath, setCurrentPath] = useState<Point[]>([])

  // Canvas context for rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = width * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Render grid if enabled
    if (store.grid.enabled) {
      renderGrid(ctx, store.grid, store.viewport, width, height)
    }

    // Render all elements
    for (const element of store.elements) {
      if (element.visible) {
        renderElement(ctx, element, store.viewport)
      }
    }

    // Render selection bounds
    if (store.hasSelection) {
      renderSelectionBounds(ctx, store.selection.bounds, store.viewport)
    }

    // Render alignment guides
    for (const guide of store.alignmentGuides) {
      renderAlignmentGuide(ctx, guide, store.viewport, width, height)
    }

    // Render live cursors
    for (const cursor of store.liveCursors) {
      if (cursor.isVisible) {
        renderLiveCursor(ctx, cursor, store.viewport)
      }
    }

    // Render current drawing path
    if (currentPath.length > 0) {
      renderCurrentPath(ctx, currentPath, store.viewport)
    }

  }, [store.elements, store.selection, store.grid, store.viewport, store.alignmentGuides, store.liveCursors, currentPath, width, height])

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const point = screenToCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top }, store.viewport)
    setDragStart(point)
    setIsDrawing(true)

    // Update collaboration cursor
    if (store.isCollaborating) {
      store.updateCollaborationCursor(point, store.activeTool)
    }

    switch (store.activeTool) {
      case 'select':
        handleSelectStart(point)
        break
      case 'rectangle':
      case 'circle':
      case 'ellipse':
        // Shape creation starts on mouse down
        break
      case 'pen':
        setCurrentPath([point])
        break
      case 'text':
        handleTextClick(point)
        break
    }
  }, [store])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const point = screenToCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top }, store.viewport)

    // Update collaboration cursor
    if (store.isCollaborating) {
      store.updateCollaborationCursor(point, store.activeTool)
    }

    if (!isDrawing || !dragStart) return

    switch (store.activeTool) {
      case 'pen':
        setCurrentPath(prev => [...prev, point])
        break
      case 'rectangle':
      case 'circle':
      case 'ellipse':
        // Update preview shape
        break
    }
  }, [isDrawing, dragStart, store])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !dragStart) return

    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    const point = screenToCanvas({ x: e.clientX - rect.left, y: e.clientY - rect.top }, store.viewport)

    switch (store.activeTool) {
      case 'rectangle':
        handleRectangleCreate(dragStart, point)
        break
      case 'circle':
        handleCircleCreate(dragStart, point)
        break
      case 'pen':
        handlePathComplete()
        break
    }

    setIsDrawing(false)
    setDragStart(null)
    setCurrentPath([])
  }, [isDrawing, dragStart, currentPath, store])

  const handleSelectStart = (point: Point) => {
    // Check if clicking on a selection handle
    const handle = getHandleAtPoint(store.selectionHandles, point)
    if (handle) {
      store.startTransform(handle.type === 'rotation' ? 'rotate' : 'scale', point)
      return
    }

    // Check if clicking on an element
    const element = getElementAtPoint(store.elements, point)
    if (element) {
      store.selectElement(element.id, false)
    } else {
      store.clearSelection()
    }
  }

  const handleRectangleCreate = (start: Point, end: Point) => {
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)

    if (width > 5 && height > 5) {
      store.createRectangle(x, y, width, height)
    }
  }

  const handleCircleCreate = (start: Point, end: Point) => {
    const centerX = start.x
    const centerY = start.y
    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))

    if (radius > 5) {
      store.createCircle(centerX, centerY, radius)
    }
  }

  const handlePathComplete = () => {
    if (currentPath.length > 2) {
      // Create a path element from the current path
      // This would involve converting points to vector path segments
      console.log('Path completed with', currentPath.length, 'points')
    }
  }

  const handleTextClick = (point: Point) => {
    // Create a text element at the clicked position
    const text = prompt('Enter text:')
    if (text) {
      store.createText(text, point.x, point.y)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'v':
        case 'V':
          store.setActiveTool('select')
          break
        case 'r':
        case 'R':
          store.setActiveTool('rectangle')
          break
        case 'c':
        case 'C':
          store.setActiveTool('circle')
          break
        case 't':
        case 'T':
          store.setActiveTool('text')
          break
        case 'p':
        case 'P':
          store.setActiveTool('pen')
          break
        case 'Delete':
        case 'Backspace':
          if (store.hasSelection) {
            for (const elementId of store.selection.elements) {
              store.deleteElement?.(elementId)
            }
          }
          break
        case 'a':
        case 'A':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            store.selectAll?.()
          }
          break
        case 'Escape':
          store.clearSelection()
          break
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            store.zoomIn()
          }
          break
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            store.zoomOut()
          }
          break
        case '0':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            store.resetZoom?.()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [store])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDrawing(false)
          setDragStart(null)
          setCurrentPath([])
        }}
      />
      
      {/* Selection handles overlay */}
      <div ref={overlayRef} className="absolute inset-0 pointer-events-none">
        {store.selectionHandles.map(handle => (
          <SelectionHandleComponent
            key={handle.id}
            handle={handle}
            viewport={store.viewport}
          />
        ))}
        
        {/* Live cursors */}
        {store.liveCursors.map(cursor => (
          <LiveCursorComponent
            key={cursor.userId}
            cursor={cursor}
            viewport={store.viewport}
          />
        ))}
      </div>

      {/* Tool indicator */}
      <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
        Tool: {store.activeTool}
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
        {Math.round(store.viewport.zoom * 100)}%
      </div>
    </div>
  )
})

// Helper Components

const SelectionHandleComponent: React.FC<{
  handle: SelectionHandle
  viewport: any
}> = ({ handle, viewport }) => {
  const screenPos = canvasToScreen(handle.position, viewport)
  
  return (
    <div
      className="absolute w-2 h-2 bg-blue-500 border border-white rounded-sm pointer-events-auto cursor-pointer"
      style={{
        left: screenPos.x - 4,
        top: screenPos.y - 4,
        cursor: handle.cursor
      }}
    />
  )
}

const LiveCursorComponent: React.FC<{
  cursor: LiveCursor
  viewport: any
}> = ({ cursor, viewport }) => {
  const screenPos = canvasToScreen(cursor.position, viewport)
  
  return (
    <div
      className="absolute pointer-events-none z-50"
      style={{
        left: screenPos.x,
        top: screenPos.y,
        transform: 'translate(-2px, -2px)'
      }}
    >
      <div
        className="w-4 h-4 rounded-full border-2 border-white"
        style={{ backgroundColor: cursor.color }}
      />
      <div
        className="mt-1 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.userName}
      </div>
    </div>
  )
}

// Rendering Functions

function renderGrid(ctx: CanvasRenderingContext2D, grid: any, viewport: any, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = grid.color
  ctx.globalAlpha = grid.opacity
  ctx.lineWidth = 1 / viewport.zoom

  const startX = Math.floor(viewport.x / grid.size) * grid.size
  const startY = Math.floor(viewport.y / grid.size) * grid.size
  const endX = viewport.x + width / viewport.zoom
  const endY = viewport.y + height / viewport.zoom

  ctx.beginPath()
  for (let x = startX; x <= endX; x += grid.size) {
    const screenX = (x - viewport.x) * viewport.zoom
    ctx.moveTo(screenX, 0)
    ctx.lineTo(screenX, height)
  }
  for (let y = startY; y <= endY; y += grid.size) {
    const screenY = (y - viewport.y) * viewport.zoom
    ctx.moveTo(0, screenY)
    ctx.lineTo(width, screenY)
  }
  ctx.stroke()
  ctx.restore()
}

function renderElement(ctx: CanvasRenderingContext2D, element: VectorElement, viewport: any) {
  ctx.save()
  
  // Apply viewport transform
  ctx.scale(viewport.zoom, viewport.zoom)
  ctx.translate(-viewport.x, -viewport.y)
  
  // Apply element transform
  const transform = element.transform
  ctx.translate(transform.translateX, transform.translateY)
  ctx.scale(transform.scaleX, transform.scaleY)
  ctx.rotate(transform.rotation)
  
  // Apply styles
  if (element.style.fill) {
    ctx.fillStyle = element.style.fill.color || '#000'
  }
  if (element.style.stroke) {
    ctx.strokeStyle = element.style.stroke.color
    ctx.lineWidth = element.style.stroke.width
  }
  
  // Render based on element type
  switch (element.type) {
    case 'shape':
      renderShape(ctx, element as any)
      break
    case 'text':
      renderText(ctx, element as any)
      break
    case 'path':
      renderPath(ctx, element.data.path)
      break
  }
  
  ctx.restore()
}

function renderShape(ctx: CanvasRenderingContext2D, element: any) {
  const bounds = element.boundingBox
  
  switch (element.shapeType) {
    case 'rectangle':
      ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
      if (element.style.stroke) {
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
      }
      break
    case 'circle':
      ctx.beginPath()
      ctx.arc(bounds.x + bounds.width/2, bounds.y + bounds.height/2, bounds.width/2, 0, Math.PI * 2)
      ctx.fill()
      if (element.style.stroke) {
        ctx.stroke()
      }
      break
  }
}

function renderText(ctx: CanvasRenderingContext2D, element: any) {
  const data = element.data
  ctx.font = `${data.fontSize}px ${data.fontFamily}`
  ctx.textAlign = data.textAlign || 'left'
  ctx.fillText(data.content, element.boundingBox.x, element.boundingBox.y + data.fontSize)
}

function renderPath(ctx: CanvasRenderingContext2D, path: any) {
  ctx.beginPath()
  
  for (const segment of path.segments) {
    switch (segment.type) {
      case 'move':
        ctx.moveTo(segment.points[0].x, segment.points[0].y)
        break
      case 'line':
        ctx.lineTo(segment.points[0].x, segment.points[0].y)
        break
      case 'curve':
        ctx.bezierCurveTo(
          segment.points[0].x, segment.points[0].y,
          segment.points[1].x, segment.points[1].y,
          segment.points[2].x, segment.points[2].y
        )
        break
      case 'close':
        ctx.closePath()
        break
    }
  }
  
  ctx.fill()
  ctx.stroke()
}

function renderSelectionBounds(ctx: CanvasRenderingContext2D, bounds: any, viewport: any) {
  ctx.save()
  ctx.scale(viewport.zoom, viewport.zoom)
  ctx.translate(-viewport.x, -viewport.y)
  
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2 / viewport.zoom
  ctx.setLineDash([5 / viewport.zoom, 5 / viewport.zoom])
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
  
  ctx.restore()
}

function renderAlignmentGuide(ctx: CanvasRenderingContext2D, guide: any, viewport: any, width: number, height: number) {
  ctx.save()
  ctx.strokeStyle = '#EF4444'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  
  ctx.beginPath()
  if (guide.type === 'vertical') {
    const x = (guide.position - viewport.x) * viewport.zoom
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
  } else {
    const y = (guide.position - viewport.y) * viewport.zoom
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
  }
  ctx.stroke()
  
  ctx.restore()
}

function renderCurrentPath(ctx: CanvasRenderingContext2D, path: Point[], viewport: any) {
  if (path.length < 2) return
  
  ctx.save()
  ctx.scale(viewport.zoom, viewport.zoom)
  ctx.translate(-viewport.x, -viewport.y)
  
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 2 / viewport.zoom
  
  ctx.beginPath()
  ctx.moveTo(path[0].x, path[0].y)
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y)
  }
  ctx.stroke()
  
  ctx.restore()
}

function renderLiveCursor(ctx: CanvasRenderingContext2D, cursor: LiveCursor, viewport: any) {
  const screenPos = canvasToScreen(cursor.position, viewport)
  
  ctx.save()
  ctx.fillStyle = cursor.color
  ctx.beginPath()
  ctx.arc(screenPos.x, screenPos.y, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// Utility Functions

function screenToCanvas(point: Point, viewport: any): Point {
  return {
    x: point.x / viewport.zoom + viewport.x,
    y: point.y / viewport.zoom + viewport.y
  }
}

function canvasToScreen(point: Point, viewport: any): Point {
  return {
    x: (point.x - viewport.x) * viewport.zoom,
    y: (point.y - viewport.y) * viewport.zoom
  }
}

function getHandleAtPoint(handles: SelectionHandle[], point: Point): SelectionHandle | null {
  for (const handle of handles) {
    const distance = Math.sqrt(
      Math.pow(point.x - handle.position.x, 2) + 
      Math.pow(point.y - handle.position.y, 2)
    )
    if (distance <= 8) {
      return handle
    }
  }
  return null
}

function getElementAtPoint(elements: VectorElement[], point: Point): VectorElement | null {
  // Check elements in reverse order (front to back)
  for (let i = elements.length - 1; i >= 0; i--) {
    const element = elements[i]
    const bounds = element.boundingBox
    
    if (point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y && point.y <= bounds.y + bounds.height) {
      return element
    }
  }
  return null
} 