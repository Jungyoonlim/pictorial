import { makeAutoObservable } from 'mobx'

export interface CanvasSettings {
  width: number
  height: number
  zoom: number
  panX: number
  panY: number
  showGrid: boolean
  gridSize: number
}

export class CanvasStore {
  settings: CanvasSettings = {
    width: 1920,
    height: 1080,
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    gridSize: 20,
  }
  
  isReady: boolean = false
  
  constructor() {
    makeAutoObservable(this)
  }
  
  setReady(ready: boolean) {
    this.isReady = ready
  }
  
  setZoom(zoom: number) {
    this.settings.zoom = Math.max(0.1, Math.min(5, zoom))
  }
  
  setPan(x: number, y: number) {
    this.settings.panX = x
    this.settings.panY = y
  }
  
  setCanvasSize(width: number, height: number) {
    this.settings.width = width
    this.settings.height = height
  }
  
  toggleGrid() {
    this.settings.showGrid = !this.settings.showGrid
  }
} 