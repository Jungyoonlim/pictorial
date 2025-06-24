import { makeAutoObservable } from 'mobx'
import { ColorStore } from './ColorStore'
import { CanvasStore } from './CanvasStore'
import { PerformanceStore } from './PerformanceStore'

export class AppStore {
  colorStore: ColorStore
  canvasStore: CanvasStore
  performanceStore: PerformanceStore
  
  // UI State
  selectedTool: 'color-picker' | 'gradient' | 'text' | 'shape' = 'color-picker'
  isPanelOpen: boolean = true
  
  constructor() {
    makeAutoObservable(this)
    
    this.colorStore = new ColorStore()
    this.canvasStore = new CanvasStore()
    this.performanceStore = new PerformanceStore()
  }
  
  setSelectedTool(tool: AppStore['selectedTool']) {
    this.selectedTool = tool
  }
  
  togglePanel() {
    this.isPanelOpen = !this.isPanelOpen
  }
  
  // Global actions
  undo() {
    // TODO: Implement command pattern undo
  }
  
  redo() {
    // TODO: Implement command pattern redo
  }
}

export const appStore = new AppStore() 