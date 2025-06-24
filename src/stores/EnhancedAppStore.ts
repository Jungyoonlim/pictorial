import { makeAutoObservable, runInAction, when } from 'mobx'
import { ColorStore } from './ColorStore'
import { CanvasStore } from './CanvasStore'
import { PerformanceStore } from './PerformanceStore'
import { CommandManager } from '@/core/commands'

// Plugin system for extensibility
export interface Plugin {
  id: string
  name: string
  version: string
  enabled: boolean
  initialize(store: EnhancedAppStore): Promise<void>
  destroy(): Promise<void>
  getMenuItems?(): Array<{ label: string; action: () => void }>
  getToolbarItems?(): Array<{ icon: string; action: () => void }>
}

// Workspace system for project management
export interface Workspace {
  id: string
  name: string
  createdAt: Date
  modifiedAt: Date
  settings: WorkspaceSettings
  data: any // Serialized workspace data
}

export interface WorkspaceSettings {
  theme: 'light' | 'dark' | 'auto'
  gridSize: number
  snapToGrid: boolean
  showRulers: boolean
  units: 'px' | 'mm' | 'in'
  colorSpace: 'sRGB' | 'P3' | 'Rec2020'
}

// Performance optimizations
export interface ViewportState {
  zoom: number
  panX: number
  panY: number
  width: number
  height: number
  dpr: number
}

export class EnhancedAppStore {
  // Core stores
  colorStore: ColorStore
  canvasStore: CanvasStore
  performanceStore: PerformanceStore
  commandManager: CommandManager
  
  // Advanced features
  plugins: Map<string, Plugin> = new Map()
  currentWorkspace: Workspace | null = null
  workspaces: Workspace[] = []
  
  // UI State with enhanced features
  selectedTool: 'color-picker' | 'gradient' | 'text' | 'shape' | 'brush' | 'vector' = 'color-picker'
  isPanelOpen: boolean = true
  isLoading: boolean = false
  viewport: ViewportState
  
  // Performance optimizations
  private rafId: number | null = null
  private updateQueue: Set<() => void> = new Set()
  
  constructor() {
    makeAutoObservable(this, {
      commandManager: false,
      plugins: false,
    })
    
    this.colorStore = new ColorStore()
    this.canvasStore = new CanvasStore()
    this.performanceStore = new PerformanceStore()
    this.commandManager = new CommandManager()
    
    this.viewport = {
      zoom: 1,
      panX: 0,
      panY: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1
    }
    
    this.initializeAdvancedFeatures()
  }
  
  private async initializeAdvancedFeatures() {
    // Load saved workspaces
    await this.loadWorkspaces()
    
    // Initialize default workspace if none exists
    if (this.workspaces.length === 0) {
      await this.createWorkspace('Default Workspace')
    }
    
    // Set up performance monitoring
    this.setupPerformanceMonitoring()
    
    // Initialize update batching
    this.setupUpdateBatching()
  }
  
  // Plugin Management
  async installPlugin(plugin: Plugin): Promise<void> {
    try {
      await plugin.initialize(this)
      this.plugins.set(plugin.id, plugin)
      console.log(`Plugin ${plugin.name} installed successfully`)
    } catch (error) {
      console.error(`Failed to install plugin ${plugin.name}:`, error)
      throw error
    }
  }
  
  async uninstallPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      await plugin.destroy()
      this.plugins.delete(pluginId)
      console.log(`Plugin ${plugin.name} uninstalled`)
    }
  }
  
  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter(p => p.enabled)
  }
  
  // Workspace Management
  async createWorkspace(name: string): Promise<Workspace> {
    const workspace: Workspace = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
      modifiedAt: new Date(),
      settings: {
        theme: 'light',
        gridSize: 10,
        snapToGrid: false,
        showRulers: true,
        units: 'px',
        colorSpace: 'sRGB'
      },
      data: this.serializeWorkspaceData()
    }
    
    runInAction(() => {
      this.workspaces.push(workspace)
      this.currentWorkspace = workspace
    })
    
    await this.saveWorkspaces()
    return workspace
  }
  
  async loadWorkspace(workspaceId: string): Promise<void> {
    const workspace = this.workspaces.find(w => w.id === workspaceId)
    if (!workspace) throw new Error('Workspace not found')
    
    this.isLoading = true
    
    try {
      // Load workspace data
      await this.deserializeWorkspaceData(workspace.data)
      
      runInAction(() => {
        this.currentWorkspace = workspace
        this.isLoading = false
      })
      
      console.log(`Loaded workspace: ${workspace.name}`)
    } catch (error) {
      this.isLoading = false
      throw error
    }
  }
  
  private serializeWorkspaceData(): any {
    return {
      colors: this.colorStore.colorPalette,
      currentColor: this.colorStore.currentColor,
      canvasState: this.canvasStore.serialize?.(),
      viewport: this.viewport
    }
  }
  
  private async deserializeWorkspaceData(data: any): Promise<void> {
    // Load colors
    if (data.colors) {
      this.colorStore.colorPalette = data.colors
    }
    
    if (data.currentColor) {
      this.colorStore.setCurrentColor(data.currentColor.hex)
    }
    
    // Load canvas state
    if (data.canvasState) {
      await this.canvasStore.deserialize?.(data.canvasState)
    }
    
    // Load viewport
    if (data.viewport) {
      this.viewport = { ...this.viewport, ...data.viewport }
    }
  }
  
  // Performance Optimizations
  private setupUpdateBatching(): void {
    const batchUpdates = () => {
      if (this.updateQueue.size > 0) {
        const updates = Array.from(this.updateQueue)
        this.updateQueue.clear()
        
        runInAction(() => {
          updates.forEach(update => update())
        })
      }
      
      this.rafId = requestAnimationFrame(batchUpdates)
    }
    
    this.rafId = requestAnimationFrame(batchUpdates)
  }
  
  queueUpdate(update: () => void): void {
    this.updateQueue.add(update)
  }
  
  private setupPerformanceMonitoring(): void {
    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        if (memory.usedJSHeapSize > memory.totalJSHeapSize * 0.9) {
          console.warn('Memory usage is high, consider optimization')
        }
      }, 5000)
    }
    
    // Monitor frame drops
    let lastTime = performance.now()
    const checkFrameRate = (currentTime: number) => {
      const delta = currentTime - lastTime
      if (delta > 33) { // More than 2 frames (33ms) indicates dropped frames
        this.performanceStore.recordFrameDrop(delta)
      }
      lastTime = currentTime
      requestAnimationFrame(checkFrameRate)
    }
    requestAnimationFrame(checkFrameRate)
  }
  
  // Enhanced Actions with Command Pattern
  async setSelectedTool(tool: EnhancedAppStore['selectedTool']): Promise<void> {
    const previousTool = this.selectedTool
    
    const command = {
      id: crypto.randomUUID(),
      type: 'SET_TOOL',
      execute: async () => {
        runInAction(() => {
          this.selectedTool = tool
        })
      },
      undo: async () => {
        runInAction(() => {
          this.selectedTool = previousTool
        })
      },
      serialize: () => ({ tool, previousTool })
    }
    
    await this.commandManager.execute(command)
  }
  
  async undo(): Promise<boolean> {
    return await this.commandManager.undo()
  }
  
  async redo(): Promise<boolean> {
    return await this.commandManager.redo()
  }
  
  // Viewport Management
  setViewport(updates: Partial<ViewportState>): void {
    this.queueUpdate(() => {
      Object.assign(this.viewport, updates)
    })
  }
  
  // Persistence
  private async loadWorkspaces(): Promise<void> {
    try {
      const stored = localStorage.getItem('pictorial:workspaces')
      if (stored) {
        this.workspaces = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
    }
  }
  
  private async saveWorkspaces(): Promise<void> {
    try {
      localStorage.setItem('pictorial:workspaces', JSON.stringify(this.workspaces))
    } catch (error) {
      console.error('Failed to save workspaces:', error)
    }
  }
  
  // Cleanup
  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
    }
    
    this.plugins.forEach(plugin => plugin.destroy())
    this.plugins.clear()
  }
}

// Singleton instance
export const enhancedAppStore = new EnhancedAppStore() 