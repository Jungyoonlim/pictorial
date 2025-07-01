import { VectorElement, VectorGroup, BoundingBox, Transform, Style } from '../vector/VectorTypes'
import { v4 as uuid } from 'uuid'

export interface Layer {
  id: string
  name: string
  type: 'layer' | 'group'
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  effects: LayerEffect[]
  zIndex: number
  parent: string | null
  children: string[]
  element?: VectorElement
  bounds: BoundingBox
  metadata: Record<string, any>
}

export type BlendMode = 
  | 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light'
  | 'color-dodge' | 'color-burn' | 'darken' | 'lighten' | 'difference' 
  | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity'

export interface LayerEffect {
  id: string
  type: 'shadow' | 'blur' | 'glow' | 'stroke' | 'gradient-overlay' | 'color-overlay'
  enabled: boolean
  params: Record<string, any>
}

export interface DropShadowEffect extends LayerEffect {
  type: 'shadow'
  params: {
    offsetX: number
    offsetY: number
    blur: number
    spread: number
    color: string
    inset: boolean
  }
}

export interface BlurEffect extends LayerEffect {
  type: 'blur'
  params: {
    radius: number
    type: 'gaussian' | 'motion' | 'zoom'
    angle?: number
  }
}

export interface GlowEffect extends LayerEffect {
  type: 'glow'
  params: {
    size: number
    color: string
    opacity: number
    inset: boolean
  }
}

export interface StrokeEffect extends LayerEffect {
  type: 'stroke'
  params: {
    width: number
    color: string
    position: 'inside' | 'outside' | 'center'
  }
}

export interface SceneGraph {
  root: string
  layers: Map<string, Layer>
  selectedLayers: Set<string>
  version: number
}

export class LayerEngine {
  private sceneGraph: SceneGraph
  private history: SceneGraph[] = []
  private historyIndex: number = -1

  constructor() {
    this.sceneGraph = this.createEmptyScene()
  }

  private createEmptyScene(): SceneGraph {
    const rootLayer: Layer = {
      id: 'root',
      name: 'Root',
      type: 'group',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      effects: [],
      zIndex: 0,
      parent: null,
      children: [],
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      metadata: {}
    }

    return {
      root: 'root',
      layers: new Map([['root', rootLayer]]),
      selectedLayers: new Set(),
      version: 0
    }
  }

  // LAYER CREATION AND MANAGEMENT

  createLayer(name: string, element?: VectorElement, parent?: string): Layer {
    const parentId = parent || this.sceneGraph.root
    const parentLayer = this.sceneGraph.layers.get(parentId)
    
    if (!parentLayer) {
      throw new Error(`Parent layer ${parentId} not found`)
    }

    const layer: Layer = {
      id: uuid(),
      name,
      type: 'layer',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      effects: [],
      zIndex: this.getNextZIndex(parentId),
      parent: parentId,
      children: [],
      element,
      bounds: element?.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      metadata: {}
    }

    this.sceneGraph.layers.set(layer.id, layer)
    parentLayer.children.push(layer.id)
    this.updateVersion()
    
    return layer
  }

  createGroup(name: string, layerIds: string[], parent?: string): Layer {
    const parentId = parent || this.sceneGraph.root
    const parentLayer = this.sceneGraph.layers.get(parentId)
    
    if (!parentLayer) {
      throw new Error(`Parent layer ${parentId} not found`)
    }

    // Calculate group bounds
    const bounds = this.calculateGroupBounds(layerIds)

    const group: Layer = {
      id: uuid(),
      name,
      type: 'group',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      effects: [],
      zIndex: this.getNextZIndex(parentId),
      parent: parentId,
      children: [...layerIds],
      bounds,
      metadata: {}
    }

    // Update parent relationships
    for (const layerId of layerIds) {
      const layer = this.sceneGraph.layers.get(layerId)
      if (layer) {
        // Remove from current parent
        if (layer.parent) {
          const currentParent = this.sceneGraph.layers.get(layer.parent)
          if (currentParent) {
            currentParent.children = currentParent.children.filter(id => id !== layerId)
          }
        }
        // Set new parent
        layer.parent = group.id
      }
    }

    this.sceneGraph.layers.set(group.id, group)
    parentLayer.children.push(group.id)
    this.updateVersion()
    
    return group
  }

  deleteLayer(layerId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || layer.id === this.sceneGraph.root) {
      return
    }

    // Recursively delete children
    for (const childId of [...layer.children]) {
      this.deleteLayer(childId)
    }

    // Remove from parent
    if (layer.parent) {
      const parent = this.sceneGraph.layers.get(layer.parent)
      if (parent) {
        parent.children = parent.children.filter(id => id !== layerId)
      }
    }

    // Remove from selection
    this.sceneGraph.selectedLayers.delete(layerId)
    
    // Remove from scene graph
    this.sceneGraph.layers.delete(layerId)
    this.updateVersion()
  }

  // GROUP OPERATIONS

  groupLayers(layerIds: string[], groupName: string = 'Group'): Layer {
    if (layerIds.length < 2) {
      throw new Error('At least 2 layers required for grouping')
    }

    // Find common parent
    const commonParent = this.findCommonParent(layerIds)
    return this.createGroup(groupName, layerIds, commonParent)
  }

  ungroupLayer(groupId: string): string[] {
    const group = this.sceneGraph.layers.get(groupId)
    if (!group || group.type !== 'group' || group.id === this.sceneGraph.root) {
      throw new Error('Invalid group for ungrouping')
    }

    const childIds = [...group.children]
    const parentId = group.parent

    // Move children to group's parent
    for (const childId of childIds) {
      const child = this.sceneGraph.layers.get(childId)
      if (child) {
        child.parent = parentId
        if (parentId) {
          const parent = this.sceneGraph.layers.get(parentId)
          if (parent) {
            parent.children.push(childId)
          }
        }
      }
    }

    // Delete the group
    this.deleteLayer(groupId)
    
    return childIds
  }

  // Z-INDEX MANAGEMENT

  moveLayerToFront(layerId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || !layer.parent) return

    const parent = this.sceneGraph.layers.get(layer.parent)
    if (!parent) return

    const maxZIndex = Math.max(...parent.children.map(id => {
      const child = this.sceneGraph.layers.get(id)
      return child ? child.zIndex : 0
    }))

    layer.zIndex = maxZIndex + 1
    this.updateVersion()
  }

  moveLayerToBack(layerId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || !layer.parent) return

    const parent = this.sceneGraph.layers.get(layer.parent)
    if (!parent) return

    const minZIndex = Math.min(...parent.children.map(id => {
      const child = this.sceneGraph.layers.get(id)
      return child ? child.zIndex : 0
    }))

    layer.zIndex = minZIndex - 1
    this.updateVersion()
  }

  moveLayerUp(layerId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || !layer.parent) return

    const parent = this.sceneGraph.layers.get(layer.parent)
    if (!parent) return

    const siblings = parent.children
      .map(id => this.sceneGraph.layers.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.zIndex - b!.zIndex)

    const currentIndex = siblings.findIndex(sibling => sibling!.id === layerId)
    if (currentIndex < siblings.length - 1) {
      const nextLayer = siblings[currentIndex + 1]!
      const tempZIndex = layer.zIndex
      layer.zIndex = nextLayer.zIndex
      nextLayer.zIndex = tempZIndex
      this.updateVersion()
    }
  }

  moveLayerDown(layerId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || !layer.parent) return

    const parent = this.sceneGraph.layers.get(layer.parent)
    if (!parent) return

    const siblings = parent.children
      .map(id => this.sceneGraph.layers.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.zIndex - b!.zIndex)

    const currentIndex = siblings.findIndex(sibling => sibling!.id === layerId)
    if (currentIndex > 0) {
      const prevLayer = siblings[currentIndex - 1]!
      const tempZIndex = layer.zIndex
      layer.zIndex = prevLayer.zIndex
      prevLayer.zIndex = tempZIndex
      this.updateVersion()
    }
  }

  // LAYER EFFECTS

  addEffect(layerId: string, effect: LayerEffect): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer) return

    layer.effects.push(effect)
    this.updateVersion()
  }

  removeEffect(layerId: string, effectId: string): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer) return

    layer.effects = layer.effects.filter(effect => effect.id !== effectId)
    this.updateVersion()
  }

  updateEffect(layerId: string, effectId: string, updates: Partial<LayerEffect>): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer) return

    const effect = layer.effects.find(e => e.id === effectId)
    if (effect) {
      Object.assign(effect, updates)
      this.updateVersion()
    }
  }

  createDropShadow(offsetX: number = 4, offsetY: number = 4, blur: number = 8, color: string = '#000000'): DropShadowEffect {
    return {
      id: uuid(),
      type: 'shadow',
      enabled: true,
      params: {
        offsetX,
        offsetY,
        blur,
        spread: 0,
        color,
        inset: false
      }
    }
  }

  createBlurEffect(radius: number = 4, type: 'gaussian' | 'motion' | 'zoom' = 'gaussian'): BlurEffect {
    return {
      id: uuid(),
      type: 'blur',
      enabled: true,
      params: {
        radius,
        type,
        angle: type === 'motion' ? 0 : undefined
      }
    }
  }

  // LAYER PROPERTIES

  updateLayer(layerId: string, updates: Partial<Layer>): void {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer) return

    Object.assign(layer, updates)
    this.updateVersion()
  }

  setLayerVisibility(layerId: string, visible: boolean): void {
    this.updateLayer(layerId, { visible })
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    this.updateLayer(layerId, { locked })
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.updateLayer(layerId, { opacity: Math.max(0, Math.min(1, opacity)) })
  }

  setLayerBlendMode(layerId: string, blendMode: BlendMode): void {
    this.updateLayer(layerId, { blendMode })
  }

  // SELECTION MANAGEMENT

  selectLayer(layerId: string, addToSelection: boolean = false): void {
    if (!addToSelection) {
      this.sceneGraph.selectedLayers.clear()
    }
    this.sceneGraph.selectedLayers.add(layerId)
  }

  deselectLayer(layerId: string): void {
    this.sceneGraph.selectedLayers.delete(layerId)
  }

  selectAll(): void {
    this.sceneGraph.selectedLayers.clear()
    for (const layer of this.sceneGraph.layers.values()) {
      if (layer.id !== this.sceneGraph.root) {
        this.sceneGraph.selectedLayers.add(layer.id)
      }
    }
  }

  deselectAll(): void {
    this.sceneGraph.selectedLayers.clear()
  }

  getSelectedLayers(): Layer[] {
    return Array.from(this.sceneGraph.selectedLayers)
      .map(id => this.sceneGraph.layers.get(id))
      .filter(Boolean) as Layer[]
  }

  // HIERARCHY NAVIGATION

  getLayer(layerId: string): Layer | null {
    return this.sceneGraph.layers.get(layerId) || null
  }

  getChildren(layerId: string): Layer[] {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer) return []

    return layer.children
      .map(id => this.sceneGraph.layers.get(id))
      .filter(Boolean) as Layer[]
  }

  getParent(layerId: string): Layer | null {
    const layer = this.sceneGraph.layers.get(layerId)
    if (!layer || !layer.parent) return null

    return this.sceneGraph.layers.get(layer.parent) || null
  }

  getPath(layerId: string): Layer[] {
    const path: Layer[] = []
    let currentId: string | null = layerId

    while (currentId) {
      const layer = this.sceneGraph.layers.get(currentId)
      if (!layer) break
      
      path.unshift(layer)
      currentId = layer.parent
    }

    return path
  }

  getLayerTree(): Layer[] {
    const root = this.sceneGraph.layers.get(this.sceneGraph.root)
    if (!root) return []

    return this.buildTree(root)
  }

  private buildTree(layer: Layer): Layer[] {
    const result = [layer]
    
    const children = layer.children
      .map(id => this.sceneGraph.layers.get(id))
      .filter(Boolean) as Layer[]

    // Sort children by z-index
    children.sort((a, b) => a.zIndex - b.zIndex)

    for (const child of children) {
      result.push(...this.buildTree(child))
    }

    return result
  }

  // UTILITY METHODS

  private getNextZIndex(parentId: string): number {
    const parent = this.sceneGraph.layers.get(parentId)
    if (!parent) return 0

    if (parent.children.length === 0) return 0

    const maxZIndex = Math.max(...parent.children.map(id => {
      const child = this.sceneGraph.layers.get(id)
      return child ? child.zIndex : 0
    }))

    return maxZIndex + 1
  }

  private findCommonParent(layerIds: string[]): string {
    if (layerIds.length === 0) return this.sceneGraph.root

    let commonAncestors: Set<string> = new Set()
    
    // Get path for first layer
    const firstPath = this.getPath(layerIds[0]).map(layer => layer.id)
    commonAncestors = new Set(firstPath)

    // Intersect with paths of other layers
    for (let i = 1; i < layerIds.length; i++) {
      const path = this.getPath(layerIds[i]).map(layer => layer.id)
      commonAncestors = new Set(Array.from(commonAncestors).filter(id => path.includes(id)))
    }

    // Return the deepest common ancestor
    const commonAncestorArray = Array.from(commonAncestors)
    return commonAncestorArray[commonAncestorArray.length - 1] || this.sceneGraph.root
  }

  private calculateGroupBounds(layerIds: string[]): BoundingBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    for (const layerId of layerIds) {
      const layer = this.sceneGraph.layers.get(layerId)
      if (!layer) continue

      const bounds = layer.bounds
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }

    return {
      x: minX === Infinity ? 0 : minX,
      y: minY === Infinity ? 0 : minY,
      width: maxX === -Infinity ? 0 : maxX - minX,
      height: maxY === -Infinity ? 0 : maxY - minY
    }
  }

  private updateVersion(): void {
    this.sceneGraph.version++
  }

  // HISTORY MANAGEMENT

  saveState(): void {
    // Remove future history if we're not at the end
    this.history = this.history.slice(0, this.historyIndex + 1)
    
    // Deep clone scene graph
    this.history.push(this.cloneSceneGraph())
    this.historyIndex++

    // Limit history size
    if (this.history.length > 50) {
      this.history.shift()
      this.historyIndex--
    }
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--
      this.sceneGraph = this.cloneSceneGraph(this.history[this.historyIndex])
      return true
    }
    return false
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      this.sceneGraph = this.cloneSceneGraph(this.history[this.historyIndex])
      return true
    }
    return false
  }

  private cloneSceneGraph(source?: SceneGraph): SceneGraph {
    const src = source || this.sceneGraph
    return {
      root: src.root,
      layers: new Map(Array.from(src.layers.entries()).map(([k, v]) => [k, { ...v }])),
      selectedLayers: new Set(src.selectedLayers),
      version: src.version
    }
  }

  // EXPORT/IMPORT

  exportScene(): any {
    const layers: any[] = []
    
    for (const [id, layer] of this.sceneGraph.layers) {
      layers.push({
        id,
        name: layer.name,
        type: layer.type,
        visible: layer.visible,
        locked: layer.locked,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        effects: layer.effects,
        zIndex: layer.zIndex,
        parent: layer.parent,
        children: layer.children,
        bounds: layer.bounds,
        element: layer.element,
        metadata: layer.metadata
      })
    }

    return {
      root: this.sceneGraph.root,
      layers,
      selectedLayers: Array.from(this.sceneGraph.selectedLayers),
      version: this.sceneGraph.version
    }
  }

  importScene(sceneData: any): void {
    this.sceneGraph = {
      root: sceneData.root,
      layers: new Map(sceneData.layers.map((layer: any) => [layer.id, layer])),
      selectedLayers: new Set(sceneData.selectedLayers),
      version: sceneData.version
    }
  }
} 