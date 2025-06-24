/**
 * Canvas 2D renderer for color work and precise operations
 * Used alongside WebGL for better color blending and text rendering
 */

export interface CanvasRenderOptions {
  alpha: boolean
  colorSpace?: 'srgb' | 'display-p3'
  willReadFrequently?: boolean
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private offscreenCanvas?: OffscreenCanvas
  private offscreenCtx?: OffscreenCanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement, options: CanvasRenderOptions = { alpha: true }) {
    this.canvas = canvas
    
    const ctx = canvas.getContext('2d', {
      alpha: options.alpha,
      colorSpace: options.colorSpace || 'srgb',
      willReadFrequently: options.willReadFrequently || false,
    })

    if (!ctx) {
      throw new Error('Canvas 2D context not supported')
    }

    this.ctx = ctx
    this.initializeOffscreenCanvas()
    this.setupCanvasProperties()
  }

  private initializeOffscreenCanvas(): void {
    if (typeof OffscreenCanvas !== 'undefined') {
      this.offscreenCanvas = new OffscreenCanvas(this.canvas.width, this.canvas.height)
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', {
        alpha: true,
        colorSpace: 'srgb',
      }) as OffscreenCanvasRenderingContext2D
    }
  }

  private setupCanvasProperties(): void {
    // Enable smooth rendering
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
    
    // Set text rendering properties
    this.ctx.textBaseline = 'alphabetic'
    this.ctx.textAlign = 'left'
  }

  public resize(): void {
    const { canvas } = this
    const dpr = window.devicePixelRatio || 1
    
    canvas.width = canvas.clientWidth * dpr
    canvas.height = canvas.clientHeight * dpr
    
    // Scale the context to match device pixel ratio
    this.ctx.scale(dpr, dpr)
    
    // Update offscreen canvas size
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = canvas.width
      this.offscreenCanvas.height = canvas.height
    }
    
    this.setupCanvasProperties()
  }

  public clear(): void {
    const { canvas, ctx } = this
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  }

  public renderColorSwatch(
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    radius: number = 8
  ): void {
    const { ctx } = this
    
    ctx.save()
    
    // Create rounded rectangle path
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, radius)
    
    // Fill with color
    ctx.fillStyle = color
    ctx.fill()
    
    // Add subtle shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2
    
    ctx.restore()
  }

  public renderGradient(
    x: number,
    y: number,
    width: number,
    height: number,
    colors: string[],
    direction: 'horizontal' | 'vertical' = 'horizontal'
  ): void {
    const { ctx } = this
    
    const gradient = direction === 'horizontal'
      ? ctx.createLinearGradient(x, y, x + width, y)
      : ctx.createLinearGradient(x, y, x, y + height)
    
    colors.forEach((color, index) => {
      gradient.addColorStop(index / (colors.length - 1), color)
    })
    
    ctx.fillStyle = gradient
    ctx.fillRect(x, y, width, height)
  }

  public renderText(
    text: string,
    x: number,
    y: number,
    font: string = '14px SF Pro Display',
    color: string = '#2d2d2d'
  ): void {
    const { ctx } = this
    
    ctx.save()
    ctx.font = font
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  public getImageData(x: number, y: number, width: number, height: number): ImageData {
    return this.ctx.getImageData(x, y, width, height)
  }

  public putImageData(imageData: ImageData, x: number, y: number): void {
    this.ctx.putImageData(imageData, x, y)
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  public getOffscreenContext(): OffscreenCanvasRenderingContext2D | undefined {
    return this.offscreenCtx
  }

  public exportAsBlob(type: string = 'image/png', quality?: number): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, type, quality)
    })
  }

  public destroy(): void {
    // Cleanup canvas resources
    this.clear()
  }
} 