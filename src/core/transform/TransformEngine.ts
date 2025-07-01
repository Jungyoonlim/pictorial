import { VectorElement, Point, BoundingBox, Transform, GridSettings, Selection, Viewport } from '../vector/VectorTypes'
import { v4 } from 'uuid'

// Defines the interactive handle users see when selecting an object 
export interface SelectionHandle {
  id: string
  type: 'corner' | 'edge' | 'rotation' | 'center'
  position: Point
  cursor: string
  bounds: BoundingBox
}

// Modifies how transformations behave
export interface Constraint {
  type: 'snap-to-grid' | 'snap-to-object' | 'maintain-aspect' | 'lock-rotation' | 'lock-scale'
  enabled: boolean
  params?: Record<string, any>
}

// Visual lines that appear when objects snap into alignment 
export interface AlignmentGuide {
  id: string
  type: 'horizontal' | 'vertical'
  position: number
  elements: string[]
  temporary: boolean
}


export interface SnapResult {
  snapped: boolean
  position: Point
  offset: Point
  guides: AlignmentGuide[]
}

export interface TransformAction {
  type: 'translate' | 'scale' | 'rotate' | 'skew'
  elementIds: string[]
  delta: Transform
  origin: Point
  constraintsMet: string[]
}

export class TransformEngine {
  private grid: GridSettings
  private constraints: Constraint[]
  private alignmentGuides: AlignmentGuide[]
  private snapThreshold: number = 5
  private viewport: Viewport
  private currentAction: TransformAction | null = null

  constructor() {
    this.grid = {
      enabled: false,
      size: 20,
      color: '#E0E0E0',
      opacity: 0.5,
      snap: false
    }
    
    this.constraints = [
      { type: 'snap-to-grid', enabled: false },
      { type: 'snap-to-object', enabled: true },
      { type: 'maintain-aspect', enabled: false },
      { type: 'lock-rotation', enabled: false },
      { type: 'lock-scale', enabled: false }
    ]
    
    this.alignmentGuides = []
    
    this.viewport = {
      x: 0,
      y: 0,
      zoom: 1,
      width: 800,
      height: 600
    }
  }

  // SELECTION HANDLES
  // handle size is divided by zoom so handles appear consistent regardless of zoom level 
  generateSelectionHandles(selection: Selection): SelectionHandle[] {
    const handles: SelectionHandle[] = []
    const bounds = selection.bounds
    const handleSize = 8 / this.viewport.zoom

    // Corner handles
    handles.push(
      {
        id: 'nw',
        type: 'corner',
        position: { x: bounds.x, y: bounds.y },
        cursor: 'nw-resize',
        bounds: { x: bounds.x - handleSize/2, y: bounds.y - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 'ne',
        type: 'corner',
        position: { x: bounds.x + bounds.width, y: bounds.y },
        cursor: 'ne-resize',
        bounds: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 'sw',
        type: 'corner',
        position: { x: bounds.x, y: bounds.y + bounds.height },
        cursor: 'sw-resize',
        bounds: { x: bounds.x - handleSize/2, y: bounds.y + bounds.height - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 'se',
        type: 'corner',
        position: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
        cursor: 'se-resize',
        bounds: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y + bounds.height - handleSize/2, width: handleSize, height: handleSize }
      }
    )

    // Edge handles
    handles.push(
      {
        id: 'n',
        type: 'edge',
        position: { x: bounds.x + bounds.width/2, y: bounds.y },
        cursor: 'n-resize',
        bounds: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 's',
        type: 'edge',
        position: { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height },
        cursor: 's-resize',
        bounds: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y + bounds.height - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 'w',
        type: 'edge',
        position: { x: bounds.x, y: bounds.y + bounds.height/2 },
        cursor: 'w-resize',
        bounds: { x: bounds.x - handleSize/2, y: bounds.y + bounds.height/2 - handleSize/2, width: handleSize, height: handleSize }
      },
      {
        id: 'e',
        type: 'edge',
        position: { x: bounds.x + bounds.width, y: bounds.y + bounds.height/2 },
        cursor: 'e-resize',
        bounds: { x: bounds.x + bounds.width - handleSize/2, y: bounds.y + bounds.height/2 - handleSize/2, width: handleSize, height: handleSize }
      }
    )

    // Rotation handle
    const rotationOffset = 20 / this.viewport.zoom
    handles.push({
      id: 'rotation',
      type: 'rotation',
      position: { x: bounds.x + bounds.width/2, y: bounds.y - rotationOffset },
      cursor: 'grab',
      bounds: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y - rotationOffset - handleSize/2, width: handleSize, height: handleSize }
    })

    // Center handle
    handles.push({
      id: 'center',
      type: 'center',
      position: { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2 },
      cursor: 'move',
      bounds: { x: bounds.x + bounds.width/2 - handleSize/2, y: bounds.y + bounds.height/2 - handleSize/2, width: handleSize, height: handleSize }
    })

    return handles
  }

  getHandleAtPoint(handles: SelectionHandle[], point: Point): SelectionHandle | null {
    for (const handle of handles) {
      if (this.pointInBounds(point, handle.bounds)) {
        return handle
      }
    }
    return null
  }

  // TRANSFORMATION

  startTransform(elementIds: string[], type: TransformAction['type'], origin: Point): void {
    this.currentAction = {
      type,
      elementIds,
      delta: this.createIdentityTransform(),
      origin,
      constraintsMet: []
    }
  }

  updateTransform(delta: Transform, elements: VectorElement[]): { elements: VectorElement[], guides: AlignmentGuide[] } {
    if (!this.currentAction) {
      return { elements, guides: [] }
    }

    // Apply constraints
    const constrainedDelta = this.applyConstraints(delta, elements)
    
    // Apply snapping
    const snapResult = this.applySnapping(constrainedDelta, elements)
    
    // Update current action
    this.currentAction.delta = snapResult.snapped ? this.addTransforms(constrainedDelta, { 
      translateX: snapResult.offset.x, 
      translateY: snapResult.offset.y,
      scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 
    }) : constrainedDelta

    // Transform elements
    const transformedElements = elements.map(element => 
      this.transformElement(element, this.currentAction!.delta, this.currentAction!.origin)
    )

    return {
      elements: transformedElements,
      guides: snapResult.guides
    }
  }

  endTransform(): TransformAction | null {
    const action = this.currentAction
    this.currentAction = null
    this.clearTemporaryGuides()
    return action
  }

  cancelTransform(): void {
    this.currentAction = null
    this.clearTemporaryGuides()
  }

  // ELEMENT TRANSFORMATION

  transformElement(element: VectorElement, delta: Transform, origin: Point): VectorElement {
    const newElement = { ...element }
    
    // Apply transformation relative to origin
    newElement.transform = this.combineTransforms(element.transform, delta, origin)
    
    // Update bounding box
    newElement.boundingBox = this.transformBounds(element.boundingBox, newElement.transform)
    
    return newElement
  }

  translateElement(element: VectorElement, offset: Point): VectorElement {
    const delta: Transform = {
      translateX: offset.x,
      translateY: offset.y,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0
    }
    
    return this.transformElement(element, delta, { x: 0, y: 0 })
  }

  scaleElement(element: VectorElement, scale: Point, origin: Point): VectorElement {
    const delta: Transform = {
      translateX: 0,
      translateY: 0,
      scaleX: scale.x,
      scaleY: scale.y,
      rotation: 0,
      skewX: 0,
      skewY: 0
    }
    
    return this.transformElement(element, delta, origin)
  }

  rotateElement(element: VectorElement, angle: number, origin: Point): VectorElement {
    const delta: Transform = {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: angle,
      skewX: 0,
      skewY: 0
    }
    
    return this.transformElement(element, delta, origin)
  }

  // ALIGNMENT

  alignElements(elements: VectorElement[], alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): VectorElement[] {
    if (elements.length < 2) return elements

    const bounds = elements.map(el => el.boundingBox)
    let alignTo: number

    switch (alignment) {
      case 'left':
        alignTo = Math.min(...bounds.map(b => b.x))
        return elements.map(el => this.translateElement(el, { x: alignTo - el.boundingBox.x, y: 0 }))
      
      case 'center':
        const centerX = (Math.min(...bounds.map(b => b.x)) + Math.max(...bounds.map(b => b.x + b.width))) / 2
        return elements.map(el => this.translateElement(el, { 
          x: centerX - (el.boundingBox.x + el.boundingBox.width / 2), 
          y: 0 
        }))
      
      case 'right':
        alignTo = Math.max(...bounds.map(b => b.x + b.width))
        return elements.map(el => this.translateElement(el, { x: alignTo - (el.boundingBox.x + el.boundingBox.width), y: 0 }))
      
      case 'top':
        alignTo = Math.min(...bounds.map(b => b.y))
        return elements.map(el => this.translateElement(el, { x: 0, y: alignTo - el.boundingBox.y }))
      
      case 'middle':
        const centerY = (Math.min(...bounds.map(b => b.y)) + Math.max(...bounds.map(b => b.y + b.height))) / 2
        return elements.map(el => this.translateElement(el, { 
          x: 0, 
          y: centerY - (el.boundingBox.y + el.boundingBox.height / 2) 
        }))
      
      case 'bottom':
        alignTo = Math.max(...bounds.map(b => b.y + b.height))
        return elements.map(el => this.translateElement(el, { x: 0, y: alignTo - (el.boundingBox.y + el.boundingBox.height) }))
      
      default:
        return elements
    }
  }

  distributeElements(elements: VectorElement[], distribution: 'horizontal' | 'vertical'): VectorElement[] {
    if (elements.length < 3) return elements

    const sorted = [...elements].sort((a, b) => {
      if (distribution === 'horizontal') {
        return a.boundingBox.x - b.boundingBox.x
      } else {
        return a.boundingBox.y - b.boundingBox.y
      }
    })

    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    
    if (distribution === 'horizontal') {
      const totalSpace = (last.boundingBox.x + last.boundingBox.width) - first.boundingBox.x
      const totalElementWidth = sorted.reduce((sum, el) => sum + el.boundingBox.width, 0)
      const spacing = (totalSpace - totalElementWidth) / (sorted.length - 1)
      
      let currentX = first.boundingBox.x + first.boundingBox.width
      
      return sorted.map((el, index) => {
        if (index === 0 || index === sorted.length - 1) return el
        
        const targetX = currentX
        currentX += el.boundingBox.width + spacing
        
        return this.translateElement(el, { x: targetX - el.boundingBox.x, y: 0 })
      })
    } else {
      const totalSpace = (last.boundingBox.y + last.boundingBox.height) - first.boundingBox.y
      const totalElementHeight = sorted.reduce((sum, el) => sum + el.boundingBox.height, 0)
      const spacing = (totalSpace - totalElementHeight) / (sorted.length - 1)
      
      let currentY = first.boundingBox.y + first.boundingBox.height
      
      return sorted.map((el, index) => {
        if (index === 0 || index === sorted.length - 1) return el
        
        const targetY = currentY
        currentY += el.boundingBox.height + spacing
        
        return this.translateElement(el, { x: 0, y: targetY - el.boundingBox.y })
      })
    }
  }

  // GRID AND SNAPPING

  setGrid(grid: Partial<GridSettings>): void {
    Object.assign(this.grid, grid)
  }

  getGrid(): GridSettings {
    return { ...this.grid }
  }

  snapToGrid(point: Point): Point {
    if (!this.grid.enabled || !this.grid.snap) return point
    
    return {
      x: Math.round(point.x / this.grid.size) * this.grid.size,
      y: Math.round(point.y / this.grid.size) * this.grid.size
    }
  }

  private applySnapping(delta: Transform, elements: VectorElement[]): SnapResult {
    const guides: AlignmentGuide[] = []
    let snappedX = false
    let snappedY = false
    let offsetX = 0
    let offsetY = 0

    if (!this.isConstraintEnabled('snap-to-object')) {
      return { snapped: false, position: { x: delta.translateX, y: delta.translateY }, offset: { x: 0, y: 0 }, guides }
    }

    // For each element being transformed
    for (const element of elements) {
      const transformedBounds = this.transformBounds(element.boundingBox, delta)
      
      // Check for snap opportunities
      const snapPoints = this.getElementSnapPoints(transformedBounds)
      
      for (const snapPoint of snapPoints) {
        const nearbyElements = this.findNearbyElements(snapPoint, elements)
        
        for (const nearby of nearbyElements) {
          const nearbyPoints = this.getElementSnapPoints(nearby.boundingBox)
          
          for (const nearbyPoint of nearbyPoints) {
            const distance = this.getDistance(snapPoint, nearbyPoint)
            
            if (distance <= this.snapThreshold / this.viewport.zoom) {
              if (Math.abs(snapPoint.x - nearbyPoint.x) <= this.snapThreshold / this.viewport.zoom && !snappedX) {
                offsetX = nearbyPoint.x - snapPoint.x
                snappedX = true
                
                guides.push({
                  id: v4(),
                  type: 'vertical',
                  position: nearbyPoint.x,
                  elements: [element.id, nearby.id],
                  temporary: true
                })
              }
              
              if (Math.abs(snapPoint.y - nearbyPoint.y) <= this.snapThreshold / this.viewport.zoom && !snappedY) {
                offsetY = nearbyPoint.y - snapPoint.y
                snappedY = true
                
                guides.push({
                  id: v4(),
                  type: 'horizontal',
                  position: nearbyPoint.y,
                  elements: [element.id, nearby.id],
                  temporary: true
                })
              }
            }
          }
        }
      }
    }

    return {
      snapped: snappedX || snappedY,
      position: { x: delta.translateX + offsetX, y: delta.translateY + offsetY },
      offset: { x: offsetX, y: offsetY },
      guides
    }
  }

  private getElementSnapPoints(bounds: BoundingBox): Point[] {
    return [
      { x: bounds.x, y: bounds.y }, // Top-left
      { x: bounds.x + bounds.width/2, y: bounds.y }, // Top-center
      { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
      { x: bounds.x, y: bounds.y + bounds.height/2 }, // Middle-left
      { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height/2 }, // Center
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height/2 }, // Middle-right
      { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
      { x: bounds.x + bounds.width/2, y: bounds.y + bounds.height }, // Bottom-center
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height } // Bottom-right
    ]
  }

  private findNearbyElements(point: Point, excludeElements: VectorElement[]): VectorElement[] {
    // This would typically search through all elements in the scene
    // For now, return empty array as we don't have access to the full scene
    return []
  }

  // CONSTRAINTS

  setConstraint(type: Constraint['type'], enabled: boolean, params?: Record<string, any>): void {
    const constraint = this.constraints.find(c => c.type === type)
    if (constraint) {
      constraint.enabled = enabled
      if (params) constraint.params = params
    } else {
      this.constraints.push({ type, enabled, params })
    }
  }

  isConstraintEnabled(type: Constraint['type']): boolean {
    const constraint = this.constraints.find(c => c.type === type)
    return constraint ? constraint.enabled : false
  }

  private applyConstraints(delta: Transform, elements: VectorElement[]): Transform {
    let constrainedDelta = { ...delta }

    // Maintain aspect ratio
    if (this.isConstraintEnabled('maintain-aspect') && (delta.scaleX !== 1 || delta.scaleY !== 1)) {
      const aspectRatio = Math.abs(delta.scaleX / delta.scaleY)
      if (Math.abs(delta.scaleX) > Math.abs(delta.scaleY)) {
        constrainedDelta.scaleY = delta.scaleX
      } else {
        constrainedDelta.scaleX = delta.scaleY
      }
    }

    // Lock rotation
    if (this.isConstraintEnabled('lock-rotation')) {
      constrainedDelta.rotation = 0
    }

    // Lock scale
    if (this.isConstraintEnabled('lock-scale')) {
      constrainedDelta.scaleX = 1
      constrainedDelta.scaleY = 1
    }

    // Snap to grid
    if (this.isConstraintEnabled('snap-to-grid')) {
      const snappedTranslation = this.snapToGrid({ x: delta.translateX, y: delta.translateY })
      constrainedDelta.translateX = snappedTranslation.x
      constrainedDelta.translateY = snappedTranslation.y
    }

    return constrainedDelta
  }

  // UTILITY METHODS

  private createIdentityTransform(): Transform {
    return {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0
    }
  }

  private addTransforms(a: Transform, b: Transform): Transform {
    return {
      translateX: a.translateX + b.translateX,
      translateY: a.translateY + b.translateY,
      scaleX: a.scaleX * b.scaleX,
      scaleY: a.scaleY * b.scaleY,
      rotation: a.rotation + b.rotation,
      skewX: a.skewX + b.skewX,
      skewY: a.skewY + b.skewY
    }
  }

  private combineTransforms(base: Transform, delta: Transform, origin: Point): Transform {
    // Apply transformation relative to origin
    const cos = Math.cos(delta.rotation)
    const sin = Math.sin(delta.rotation)
    
    const dx = origin.x
    const dy = origin.y
    
    return {
      translateX: base.translateX + delta.translateX + dx * (delta.scaleX * cos - 1) + dy * (delta.scaleX * sin),
      translateY: base.translateY + delta.translateY + dx * (-delta.scaleY * sin) + dy * (delta.scaleY * cos - 1),
      scaleX: base.scaleX * delta.scaleX,
      scaleY: base.scaleY * delta.scaleY,
      rotation: base.rotation + delta.rotation,
      skewX: base.skewX + delta.skewX,
      skewY: base.skewY + delta.skewY
    }
  }

  private transformBounds(bounds: BoundingBox, transform: Transform): BoundingBox {
    // Transform the four corners of the bounding box
    const corners = [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height }
    ]

    const transformedCorners = corners.map(corner => this.transformPoint(corner, transform))
    
    const minX = Math.min(...transformedCorners.map(p => p.x))
    const minY = Math.min(...transformedCorners.map(p => p.y))
    const maxX = Math.max(...transformedCorners.map(p => p.x))
    const maxY = Math.max(...transformedCorners.map(p => p.y))

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  private transformPoint(point: Point, transform: Transform): Point {
    const cos = Math.cos(transform.rotation)
    const sin = Math.sin(transform.rotation)
    
    // Apply scale
    let x = point.x * transform.scaleX
    let y = point.y * transform.scaleY
    
    // Apply rotation
    const rotatedX = x * cos - y * sin
    const rotatedY = x * sin + y * cos
    
    // Apply translation
    return {
      x: rotatedX + transform.translateX,
      y: rotatedY + transform.translateY
    }
  }

  private pointInBounds(point: Point, bounds: BoundingBox): boolean {
    return point.x >= bounds.x && 
           point.x <= bounds.x + bounds.width &&
           point.y >= bounds.y && 
           point.y <= bounds.y + bounds.height
  }

  private getDistance(a: Point, b: Point): number {
    return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
  }

  private clearTemporaryGuides(): void {
    this.alignmentGuides = this.alignmentGuides.filter(guide => !guide.temporary)
  }

  // VIEWPORT

  setViewport(viewport: Partial<Viewport>): void {
    Object.assign(this.viewport, viewport)
  }

  getViewport(): Viewport {
    return { ...this.viewport }
  }
} 