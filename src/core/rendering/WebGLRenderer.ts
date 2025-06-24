/**
 * Core WebGL2 rendering engine for Pictorial
 * Handles the main graphics pipeline with performance monitoring
 */

export interface RenderStats {
  frameTime: number
  drawCalls: number
  triangles: number
  fps: number
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private frameStats: RenderStats
  private frameCount: number = 0
  private fpsUpdateTime: number = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }

    this.gl = gl
    this.frameStats = {
      frameTime: 0,
      drawCalls: 0,
      triangles: 0,
      fps: 0,
    }

    this.initializeGL()
    this.startRenderLoop()
  }

  private initializeGL(): void {
    const { gl } = this
    
    // Enable necessary features
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.enable(gl.DEPTH_TEST)
    gl.depthFunc(gl.LEQUAL)
    
    // Set viewport
    this.resize()
    
    // Clear color - soft Korean stationery aesthetic
    gl.clearColor(0.99, 0.99, 0.99, 1.0)
  }

  public resize(): void {
    const { canvas, gl } = this
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    
    gl.viewport(0, 0, canvas.width, canvas.height)
  }

  private startRenderLoop(): void {
    const render = (currentTime: number) => {
      const frameStart = performance.now()
      
      this.updateFrameStats(currentTime)
      this.clear()
      this.render()
      
      const frameEnd = performance.now()
      this.frameStats.frameTime = frameEnd - frameStart
      
      requestAnimationFrame(render)
    }
    
    requestAnimationFrame(render)
  }

  private updateFrameStats(currentTime: number): void {
    this.frameCount++
    
    if (currentTime - this.fpsUpdateTime >= 1000) {
      this.frameStats.fps = this.frameCount
      this.frameCount = 0
      this.fpsUpdateTime = currentTime
    }
  }

  private clear(): void {
    const { gl } = this
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    
    // Reset stats for this frame
    this.frameStats.drawCalls = 0
    this.frameStats.triangles = 0
  }

  private render(): void {
    // This is where the magic happens
    // For now, we'll render a simple gradient background
    this.renderBackground()
  }

  private renderBackground(): void {
    // TODO: Implement beautiful gradient background
    // This will be replaced with actual scene rendering
  }

  public getStats(): RenderStats {
    return { ...this.frameStats }
  }

  public getGL(): WebGL2RenderingContext {
    return this.gl
  }

  public destroy(): void {
    // Cleanup WebGL resources
    const { gl } = this
    const loseContext = gl.getExtension('WEBGL_lose_context')
    if (loseContext) {
      loseContext.loseContext()
    }
  }
} 