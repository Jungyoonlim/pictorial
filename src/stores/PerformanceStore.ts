import { makeAutoObservable } from 'mobx'
import type { RenderStats } from '@/core/rendering/WebGLRenderer'

export class PerformanceStore {
  stats: RenderStats = {
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    fps: 0,
  }
  
  showStats: boolean = false
  
  constructor() {
    makeAutoObservable(this)
  }
  
  updateStats(stats: RenderStats) {
    this.stats = { ...stats }
  }
  
  toggleStats() {
    this.showStats = !this.showStats
  }
} 