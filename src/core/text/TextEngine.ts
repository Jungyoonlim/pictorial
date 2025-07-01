import { load as loadFont } from 'opentype.js'
import { VectorText, VectorPath, Point, BoundingBox, Style, VectorElement } from '../vector/VectorTypes'
import { VectorEngine } from '../vector/VectorEngine'
import { v4 as uuid } from 'uuid'

export interface Font {
  id: string
  name: string
  family: string
  style: 'normal' | 'italic'
  weight: number
  data: any
  loaded: boolean
}

export interface TextSpan {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  fontStyle: string
  color: string
  letterSpacing: number
  textDecoration?: 'none' | 'underline' | 'overline' | 'line-through'
}

export interface RichText {
  spans: TextSpan[]
  align: 'left' | 'center' | 'right' | 'justify'
  lineHeight: number
  maxWidth?: number
}

export interface TextOnPath {
  text: RichText
  path: VectorPath
  startOffset: number
  side: 'top' | 'bottom'
  alignment: 'start' | 'middle' | 'end'
}

export interface TextMetrics {
  width: number
  height: number
  ascent: number
  descent: number
  baseline: number
}

export class TextEngine {
  private fonts: Map<string, Font> = new Map()
  private vectorEngine: VectorEngine
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.vectorEngine = new VectorEngine()
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')!
    this.loadSystemFonts()
  }

  private async loadSystemFonts(): Promise<void> {
    const systemFonts = [
      { name: 'Arial', family: 'Arial' },
      { name: 'Times New Roman', family: 'Times New Roman' },
      { name: 'Helvetica', family: 'Helvetica' },
      { name: 'Georgia', family: 'Georgia' },
      { name: 'Verdana', family: 'Verdana' }
    ]

    for (const fontInfo of systemFonts) {
      const font: Font = {
        id: fontInfo.name.toLowerCase().replace(/\s+/g, '-'),
        name: fontInfo.name,
        family: fontInfo.family,
        style: 'normal',
        weight: 400,
        data: null,
        loaded: true
      }
      this.fonts.set(font.id, font)
    }
  }

  async loadFont(fontFile: File | string, fontName?: string): Promise<Font> {
    try {
      let fontData: any
      
      if (typeof fontFile === 'string') {
        const response = await fetch(fontFile)
        const arrayBuffer = await response.arrayBuffer()
        fontData = loadFont(arrayBuffer)
      } else {
        const arrayBuffer = await fontFile.arrayBuffer()
        fontData = loadFont(arrayBuffer)
      }

      const font: Font = {
        id: uuid(),
        name: fontName || fontData.names.fullName.en || 'Unknown Font',
        family: fontData.names.fontFamily.en || 'Unknown',
        style: fontData.names.fontSubfamily.en?.toLowerCase().includes('italic') ? 'italic' : 'normal',
        weight: this.parseWeight(fontData.names.fontSubfamily.en || 'Regular'),
        data: fontData,
        loaded: true
      }

      this.fonts.set(font.id, font)
      return font
    } catch (error) {
      throw new Error(`Failed to load font: ${error}`)
    }
  }

  private parseWeight(subfamily: string): number {
    const weightMap: { [key: string]: number } = {
      'thin': 100,
      'extralight': 200,
      'light': 300,
      'regular': 400,
      'medium': 500,
      'semibold': 600,
      'bold': 700,
      'extrabold': 800,
      'black': 900
    }

    const normalized = subfamily.toLowerCase()
    for (const [key, weight] of Object.entries(weightMap)) {
      if (normalized.includes(key)) {
        return weight
      }
    }
    return 400
  }

  getFonts(): Font[] {
    return Array.from(this.fonts.values())
  }

  getFont(fontId: string): Font | null {
    return this.fonts.get(fontId) || null
  }

  measureText(text: string, fontFamily: string, fontSize: number, fontWeight: string | number = 'normal', fontStyle: string = 'normal'): TextMetrics {
    this.ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
    const metrics = this.ctx.measureText(text)
    
    return {
      width: metrics.width,
      height: fontSize,
      ascent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
      descent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
      baseline: metrics.actualBoundingBoxAscent || fontSize * 0.8
    }
  }

  createRichText(text: string, fontFamily: string = 'Arial', fontSize: number = 16): RichText {
    return {
      spans: [{
        text,
        fontFamily,
        fontSize,
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: '#000000',
        letterSpacing: 0
      }],
      align: 'left',
      lineHeight: 1.2
    }
  }

  createTextElement(richText: RichText, x: number, y: number): VectorText {
    const metrics = this.measureText(
      richText.spans.map(s => s.text).join(''),
      richText.spans[0]?.fontFamily || 'Arial',
      richText.spans[0]?.fontSize || 16
    )
    
    return {
      id: uuid(),
      type: 'text',
      transform: {
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0
      },
      style: {},
      boundingBox: { x, y, width: metrics.width, height: metrics.height },
      visible: true,
      locked: false,
      zIndex: 0,
      data: {
        content: richText.spans.map(span => span.text).join(''),
        fontFamily: richText.spans[0]?.fontFamily || 'Arial',
        fontSize: richText.spans[0]?.fontSize || 16,
        fontWeight: richText.spans[0]?.fontWeight || 'normal',
        fontStyle: richText.spans[0]?.fontStyle || 'normal',
        textAlign: richText.align,
        letterSpacing: richText.spans[0]?.letterSpacing || 0,
        lineHeight: richText.lineHeight,
        richText
      }
    }
  }

  createTextOnPath(textOnPath: TextOnPath): VectorElement {
    const pathLength = this.calculatePathLength(textOnPath.path)
    
    return {
      id: uuid(),
      type: 'text',
      transform: {
        translateX: 0,
        translateY: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0
      },
      style: {},
      boundingBox: this.vectorEngine.getPathBounds(textOnPath.path),
      visible: true,
      locked: false,
      zIndex: 0,
      data: {
        content: textOnPath.text.spans.map(span => span.text).join(''),
        fontFamily: textOnPath.text.spans[0]?.fontFamily || 'Arial',
        fontSize: textOnPath.text.spans[0]?.fontSize || 16,
        fontWeight: textOnPath.text.spans[0]?.fontWeight || 'normal',
        fontStyle: textOnPath.text.spans[0]?.fontStyle || 'normal',
        textAlign: textOnPath.text.align,
        letterSpacing: textOnPath.text.spans[0]?.letterSpacing || 0,
        lineHeight: textOnPath.text.lineHeight,
        path: textOnPath.path,
        textOnPath
      }
    }
  }

  private calculatePathLength(path: VectorPath): number {
    let length = 0
    let currentPoint: Point = { x: 0, y: 0 }
    
    for (const segment of path.segments) {
      switch (segment.type) {
        case 'move':
          currentPoint = segment.points[0]
          break
        case 'line':
          const lineEnd = segment.points[0]
          length += Math.sqrt(
            Math.pow(lineEnd.x - currentPoint.x, 2) +
            Math.pow(lineEnd.y - currentPoint.y, 2)
          )
          currentPoint = lineEnd
          break
        case 'curve':
          const curve = this.vectorEngine.createBezierCurve(
            currentPoint,
            segment.points[0],
            segment.points[1],
            segment.points[2]
          )
          length += this.vectorEngine.getBezierLength(curve)
          currentPoint = segment.points[2]
          break
      }
    }
    
    return length
  }
} 