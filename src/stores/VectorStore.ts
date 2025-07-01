import { makeAutoObservable, runInAction } from 'mobx'
import { VectorEngine } from '../core/vector/VectorEngine'
import { SVGEngine } from '../core/vector/SVGEngine'
import { TextEngine, RichText, TextOnPath } from '../core/text/TextEngine'
import { LayerEngine, Layer, LayerEffect, BlendMode } from '../core/layer/LayerEngine'
import { TransformEngine, SelectionHandle, Constraint, AlignmentGuide } from '../core/transform/TransformEngine'
import { CollaborationEngine, User, LiveCursor, Operation } from '../core/collaboration/CollaborationEngine'
import { VectorElement, VectorPath, VectorShape, VectorText, VectorGroup, Point, BoundingBox, Transform, Selection, GridSettings, Viewport } from '../core/vector/VectorTypes'

export type Tool = 'select' | 'pen' | 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'star' | 'text' | 'line' | 'bezier'

export interface VectorStoreState {
  // Tools and UI
  activeTool: Tool
  isDrawing: boolean
  
  // Document
  elements: VectorElement[]
  selection: Selection
  viewport: Viewport
  grid: GridSettings
  
  // Layers
  layers: Layer[]
  activeLayerId: string | null
  
  // Transform
  selectionHandles: SelectionHandle[]
  alignmentGuides: AlignmentGuide[]
  constraints: Constraint[]
  
  // Collaboration
  isCollaborating: boolean
  collaborationUsers: User[]
  liveCursors: LiveCursor[]
  
  // History
  canUndo: boolean
  canRedo: boolean
  
  // Performance
  isLoading: boolean
  lastSaveTime: number
}

export class VectorStore {
  private vectorEngine: VectorEngine
  private svgEngine: SVGEngine
  private textEngine: TextEngine
  private layerEngine: LayerEngine
  private transformEngine: TransformEngine
  private collaborationEngine: CollaborationEngine

  // State
  activeTool: Tool = 'select'
  isDrawing = false
  
  elements: VectorElement[] = []
  selection: Selection = {
    elements: [],
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 }
  }
  
  viewport: Viewport = { x: 0, y: 0, zoom: 1, width: 800, height: 600 }
  grid: GridSettings = { enabled: false, size: 20, color: '#E0E0E0', opacity: 0.5, snap: false }
  
  layers: Layer[] = []
  activeLayerId: string | null = null
  
  selectionHandles: SelectionHandle[] = []
  alignmentGuides: AlignmentGuide[] = []
  constraints: Constraint[] = []
  
  isCollaborating = false
  collaborationUsers: User[] = []
  liveCursors: LiveCursor[] = []
  
  canUndo = false
  canRedo = false
  isLoading = false
  lastSaveTime = 0

  constructor() {
    makeAutoObservable(this)
    
    this.vectorEngine = new VectorEngine()
    this.svgEngine = new SVGEngine()
    this.textEngine = new TextEngine()
    this.layerEngine = new LayerEngine()
    this.transformEngine = new TransformEngine()
    this.collaborationEngine = new CollaborationEngine()
    
    this.setupCollaborationListeners()
  }

  // TOOL MANAGEMENT

  setActiveTool(tool: Tool): void {
    this.activeTool = tool
    this.clearSelection()
  }

  // ELEMENT CREATION

  createRectangle(x: number, y: number, width: number, height: number): VectorShape {
    const path = this.vectorEngine.createRectangle(x, y, width, height)
    const element: VectorShape = {
      id: path.id,
      type: 'shape',
      shapeType: 'rectangle',
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 },
      style: { fill: { type: 'solid', color: '#3B82F6' } },
      boundingBox: { x, y, width, height },
      visible: true,
      locked: false,
      zIndex: this.elements.length,
      data: { width, height, path }
    }
    
    this.addElement(element)
    return element
  }

  createCircle(centerX: number, centerY: number, radius: number): VectorShape {
    const path = this.vectorEngine.createCircle(centerX, centerY, radius)
    const element: VectorShape = {
      id: path.id,
      type: 'shape',
      shapeType: 'circle',
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 },
      style: { fill: { type: 'solid', color: '#EF4444' } },
      boundingBox: { x: centerX - radius, y: centerY - radius, width: radius * 2, height: radius * 2 },
      visible: true,
      locked: false,
      zIndex: this.elements.length,
      data: { radius, path }
    }
    
    this.addElement(element)
    return element
  }

  createPolygon(centerX: number, centerY: number, radius: number, sides: number): VectorShape {
    const path = this.vectorEngine.createPolygon(centerX, centerY, radius, sides)
    const bounds = this.vectorEngine.getPathBounds(path)
    const element: VectorShape = {
      id: path.id,
      type: 'shape',
      shapeType: 'polygon',
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, skewY: 0 },
      style: { fill: { type: 'solid', color: '#10B981' } },
      boundingBox: bounds,
      visible: true,
      locked: false,
      zIndex: this.elements.length,
      data: { radius, sides, path }
    }
    
    this.addElement(element)
    return element
  }

  createText(text: string, x: number, y: number, fontFamily = 'Arial', fontSize = 16): VectorText {
    const richText = this.textEngine.createRichText(text, fontFamily, fontSize)
    const element = this.textEngine.createTextElement(richText, x, y)
    
    this.addElement(element)
    return element
  }

  createTextOnPath(text: string, path: VectorPath, startOffset = 0): VectorElement {
    const richText = this.textEngine.createRichText(text)
    const textOnPath: TextOnPath = {
      text: richText,
      path,
      startOffset,
      side: 'top',
      alignment: 'start'
    }
    
    const element = this.textEngine.createTextOnPath(textOnPath)
    this.addElement(element)
    return element
  }

  // ELEMENT MANAGEMENT

  private addElement(element: VectorElement): void {
    runInAction(() => {
      this.elements.push(element)
      
      // Add to layer system
      const layer = this.layerEngine.createLayer(
        element.type === 'text' ? `Text: ${element.data.content?.slice(0, 20) || ''}...` : 
        element.type === 'shape' ? `${(element as VectorShape).shapeType}` : 
        'Element',
        element
      )
      
      this.layers = this.layerEngine.getLayerTree()
      
      // Broadcast if collaborating
      if (this.isCollaborating) {
        const operation = this.collaborationEngine.createOperation('create', element.id, element)
        this.collaborationEngine.applyOperation(operation)
      }
    })
  }

  updateElement(elementId: string, updates: Partial<VectorElement>): void {
    runInAction(() => {
      const index = this.elements.findIndex(el => el.id === elementId)
      if (index >= 0) {
        Object.assign(this.elements[index], updates)
        
        if (this.isCollaborating) {
          const operation = this.collaborationEngine.createOperation('update', elementId, updates)
          this.collaborationEngine.applyOperation(operation)
        }
      }
    })
  }

  deleteElement(elementId: string): void {
    runInAction(() => {
      this.elements = this.elements.filter(el => el.id !== elementId)
      this.selection.elements = this.selection.elements.filter(id => id !== elementId)
      this.updateSelectionBounds()
      
      // Remove from layer system
      this.layerEngine.deleteLayer(elementId)
      this.layers = this.layerEngine.getLayerTree()
      
      if (this.isCollaborating) {
        const operation = this.collaborationEngine.createOperation('delete', elementId, null)
        this.collaborationEngine.applyOperation(operation)
      }
    })
  }

  duplicateElements(elementIds: string[]): VectorElement[] {
    const duplicated: VectorElement[] = []
    
    runInAction(() => {
      for (const elementId of elementIds) {
        const element = this.elements.find(el => el.id === elementId)
        if (element) {
          const duplicate = {
            ...element,
            id: crypto.randomUUID(),
            transform: {
              ...element.transform,
              translateX: element.transform.translateX + 20,
              translateY: element.transform.translateY + 20
            }
          }
          
          this.addElement(duplicate)
          duplicated.push(duplicate)
        }
      }
    })
    
    return duplicated
  }

  // SELECTION

  selectElement(elementId: string, addToSelection = false): void {
    runInAction(() => {
      if (!addToSelection) {
        this.selection.elements = []
      }
      
      if (!this.selection.elements.includes(elementId)) {
        this.selection.elements.push(elementId)
      }
      
      this.updateSelectionBounds()
      this.updateSelectionHandles()
    })
  }

  selectElements(elementIds: string[]): void {
    runInAction(() => {
      this.selection.elements = [...elementIds]
      this.updateSelectionBounds()
      this.updateSelectionHandles()
    })
  }

  clearSelection(): void {
    runInAction(() => {
      this.selection.elements = []
      this.selectionHandles = []
      this.alignmentGuides = []
    })
  }

  selectAll(): void {
    runInAction(() => {
      this.selection.elements = this.elements.map(el => el.id)
      this.updateSelectionBounds()
      this.updateSelectionHandles()
    })
  }

  private updateSelectionBounds(): void {
    if (this.selection.elements.length === 0) {
      this.selection.bounds = { x: 0, y: 0, width: 0, height: 0 }
      return
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const elementId of this.selection.elements) {
      const element = this.elements.find(el => el.id === elementId)
      if (element) {
        const bounds = element.boundingBox
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      }
    }

    this.selection.bounds = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  private updateSelectionHandles(): void {
    if (this.selection.elements.length > 0) {
      this.selectionHandles = this.transformEngine.generateSelectionHandles(this.selection)
    } else {
      this.selectionHandles = []
    }
  }

  // TRANSFORMATION

  startTransform(type: 'translate' | 'scale' | 'rotate', origin: Point): void {
    if (this.selection.elements.length > 0) {
      this.transformEngine.startTransform(this.selection.elements, type, origin)
    }
  }

  updateTransform(delta: Transform): void {
    if (this.selection.elements.length === 0) return

    const selectedElements = this.elements.filter(el => this.selection.elements.includes(el.id))
    const result = this.transformEngine.updateTransform(delta, selectedElements)
    
    runInAction(() => {
      for (let i = 0; i < result.elements.length; i++) {
        const transformedElement = result.elements[i]
        const originalIndex = this.elements.findIndex(el => el.id === transformedElement.id)
        if (originalIndex >= 0) {
          this.elements[originalIndex] = transformedElement
        }
      }
      
      this.alignmentGuides = result.guides
      this.updateSelectionBounds()
      this.updateSelectionHandles()
    })
  }

  endTransform(): void {
    const action = this.transformEngine.endTransform()
    
    if (action && this.isCollaborating) {
      for (const elementId of action.elementIds) {
        const element = this.elements.find(el => el.id === elementId)
        if (element) {
          const operation = this.collaborationEngine.createOperation('transform', elementId, {
            transform: element.transform,
            boundingBox: element.boundingBox
          })
          this.collaborationEngine.applyOperation(operation)
        }
      }
    }
  }

  // ALIGNMENT

  alignElements(alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'): void {
    if (this.selection.elements.length < 2) return

    const selectedElements = this.elements.filter(el => this.selection.elements.includes(el.id))
    const alignedElements = this.transformEngine.alignElements(selectedElements, alignment)
    
    runInAction(() => {
      for (const alignedElement of alignedElements) {
        const index = this.elements.findIndex(el => el.id === alignedElement.id)
        if (index >= 0) {
          this.elements[index] = alignedElement
        }
      }
      
      this.updateSelectionBounds()
      this.updateSelectionHandles()
    })
  }

  // LAYER OPERATIONS

  groupSelection(name = 'Group'): void {
    if (this.selection.elements.length < 2) return

    runInAction(() => {
      const group = this.layerEngine.groupLayers(this.selection.elements, name)
      this.layers = this.layerEngine.getLayerTree()
      this.selectElement(group.id)
    })
  }

  ungroupSelection(): void {
    if (this.selection.elements.length !== 1) return

    const groupId = this.selection.elements[0]
    const childIds = this.layerEngine.ungroupLayer(groupId)
    
    runInAction(() => {
      this.layers = this.layerEngine.getLayerTree()
      this.selectElements(childIds)
    })
  }

  moveLayerUp(layerId: string): void {
    this.layerEngine.moveLayerUp(layerId)
    this.layers = this.layerEngine.getLayerTree()
  }

  moveLayerDown(layerId: string): void {
    this.layerEngine.moveLayerDown(layerId)
    this.layers = this.layerEngine.getLayerTree()
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.layerEngine.setLayerVisibility(layerId, visible)
    this.layers = this.layerEngine.getLayerTree()
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.layerEngine.setLayerOpacity(layerId, opacity)
    this.layers = this.layerEngine.getLayerTree()
  }

  addLayerEffect(layerId: string, effect: LayerEffect): void {
    this.layerEngine.addEffect(layerId, effect)
    this.layers = this.layerEngine.getLayerTree()
  }

  // SVG IMPORT/EXPORT

  async importSVG(svgContent: string): Promise<void> {
    this.isLoading = true
    
    try {
      const rootGroup = await this.svgEngine.importSVG(svgContent)
      
      runInAction(() => {
        this.flattenGroup(rootGroup)
        this.isLoading = false
      })
    } catch (error) {
      runInAction(() => {
        this.isLoading = false
      })
      throw error
    }
  }

  exportSVG(): string {
    return this.svgEngine.exportSVG(this.elements, this.viewport.width, this.viewport.height)
  }

  private flattenGroup(group: VectorGroup): void {
    for (const child of group.children) {
      if (child.type === 'group') {
        this.flattenGroup(child as VectorGroup)
      } else {
        this.addElement(child)
      }
    }
  }

  // GRID AND CONSTRAINTS

  setGrid(grid: Partial<GridSettings>): void {
    runInAction(() => {
      Object.assign(this.grid, grid)
      this.transformEngine.setGrid(this.grid)
    })
  }

  setConstraint(type: Constraint['type'], enabled: boolean): void {
    this.transformEngine.setConstraint(type, enabled)
  }

  // COLLABORATION

  async startCollaboration(roomId: string, user: User): Promise<void> {
    try {
      await this.collaborationEngine.connect(roomId, user)
      
      runInAction(() => {
        this.isCollaborating = true
        this.collaborationUsers = this.collaborationEngine.getUsers()
        this.liveCursors = this.collaborationEngine.getLiveCursors()
      })
    } catch (error) {
      console.error('Failed to start collaboration:', error)
      throw error
    }
  }

  async stopCollaboration(): Promise<void> {
    await this.collaborationEngine.disconnect()
    
    runInAction(() => {
      this.isCollaborating = false
      this.collaborationUsers = []
      this.liveCursors = []
    })
  }

  updateCollaborationCursor(position: Point, tool: string): void {
    if (this.isCollaborating) {
      this.collaborationEngine.updateCursor(position, tool)
    }
  }

  private setupCollaborationListeners(): void {
    this.collaborationEngine.on('user-joined', (user: User) => {
      runInAction(() => {
        this.collaborationUsers = this.collaborationEngine.getUsers()
      })
    })

    this.collaborationEngine.on('user-left', (userId: string) => {
      runInAction(() => {
        this.collaborationUsers = this.collaborationEngine.getUsers()
        this.liveCursors = this.liveCursors.filter(cursor => cursor.userId !== userId)
      })
    })

    this.collaborationEngine.on('cursor-updated', (cursor: LiveCursor) => {
      runInAction(() => {
        this.liveCursors = this.collaborationEngine.getLiveCursors()
      })
    })

    this.collaborationEngine.on('operation-applied', (operation: Operation) => {
      // Handle remote operations
      runInAction(() => {
        switch (operation.type) {
          case 'create':
            this.elements.push(operation.data)
            break
          case 'update':
            const updateIndex = this.elements.findIndex(el => el.id === operation.elementId)
            if (updateIndex >= 0) {
              Object.assign(this.elements[updateIndex], operation.data)
            }
            break
          case 'delete':
            this.elements = this.elements.filter(el => el.id !== operation.elementId)
            break
          case 'transform':
            const transformIndex = this.elements.findIndex(el => el.id === operation.elementId)
            if (transformIndex >= 0) {
              this.elements[transformIndex].transform = operation.data.transform
              this.elements[transformIndex].boundingBox = operation.data.boundingBox
            }
            break
        }
      })
    })
  }

  // VIEWPORT

  setViewport(viewport: Partial<Viewport>): void {
    runInAction(() => {
      Object.assign(this.viewport, viewport)
      this.transformEngine.setViewport(this.viewport)
    })
  }

  zoomIn(): void {
    this.setViewport({ zoom: Math.min(this.viewport.zoom * 1.25, 10) })
  }

  zoomOut(): void {
    this.setViewport({ zoom: Math.max(this.viewport.zoom / 1.25, 0.1) })
  }

  resetZoom(): void {
    this.setViewport({ zoom: 1 })
  }

  fitToScreen(): void {
    if (this.elements.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const element of this.elements) {
      const bounds = element.boundingBox
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    const contentWidth = maxX - minX
    const contentHeight = maxY - minY
    const padding = 50

    const scaleX = (this.viewport.width - padding * 2) / contentWidth
    const scaleY = (this.viewport.height - padding * 2) / contentHeight
    const zoom = Math.min(scaleX, scaleY, 1)

    this.setViewport({
      x: minX - (this.viewport.width / zoom - contentWidth) / 2,
      y: minY - (this.viewport.height / zoom - contentHeight) / 2,
      zoom
    })
  }

  // UTILITY GETTERS

  get selectedElements(): VectorElement[] {
    return this.elements.filter(el => this.selection.elements.includes(el.id))
  }

  get hasSelection(): boolean {
    return this.selection.elements.length > 0
  }

  get state(): VectorStoreState {
    return {
      activeTool: this.activeTool,
      isDrawing: this.isDrawing,
      elements: this.elements,
      selection: this.selection,
      viewport: this.viewport,
      grid: this.grid,
      layers: this.layers,
      activeLayerId: this.activeLayerId,
      selectionHandles: this.selectionHandles,
      alignmentGuides: this.alignmentGuides,
      constraints: this.constraints,
      isCollaborating: this.isCollaborating,
      collaborationUsers: this.collaborationUsers,
      liveCursors: this.liveCursors,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      isLoading: this.isLoading,
      lastSaveTime: this.lastSaveTime
    }
  }
} 