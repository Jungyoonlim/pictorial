import { makeAutoObservable } from 'mobx'
import chroma from 'chroma-js'
import { convertToLch, convertFromLch, clampLch } from '@/core/color/ColorUtils'
import { ColorDiffusionEngine, type ColorPrompt, type GeneratedColor } from '@/core/ai/ColorDiffusionEngine'

export interface Color {
  id: string
  hex: string
  hsl: [number, number, number]
  lch: [number, number, number]
  name?: string
  tags?: string[]
  createdAt: Date
  aiGenerated?: boolean
  confidence?: number
  reasoning?: string
}

export class ColorStore {
  currentColor: Color
  colorPalette: Color[] = []
  colorHistory: Color[] = []
  
  // AI generation
  aiEngine: ColorDiffusionEngine
  isGenerating: boolean = false
  generationSeed: string = ''
  lastGeneratedColors: Color[] = []
  
  constructor() {
    makeAutoObservable(this)
    
    // Initialize AI engine
    this.aiEngine = new ColorDiffusionEngine()
    
    // Initialize with a beautiful default color
    this.currentColor = this.createColor('#ff6b6b')
  }
  
  private createColor(hex: string, name?: string, aiData?: Partial<GeneratedColor>): Color {
    const chromaColor = chroma(hex)
    const hsl = chromaColor.hsl()
    const lch = convertToLch(hex)
    
    return {
      id: crypto.randomUUID(),
      hex,
      hsl: [hsl[0] || 0, hsl[1] || 0, hsl[2] || 0],
      lch,
      name,
      createdAt: new Date(),
      aiGenerated: !!aiData,
      confidence: aiData?.confidence,
      reasoning: aiData?.reasoning,
    }
  }
  
  setCurrentColor(hex: string) {
    const newColor = this.createColor(hex)
    
    // Add previous color to history
    if (this.currentColor) {
      this.addToHistory(this.currentColor)
    }
    
    this.currentColor = newColor
  }
  
  setCurrentColorFromLch(l: number, c: number, h: number) {
    const clampedLch = clampLch([l, c, h])
    const hex = convertFromLch(clampedLch)
    this.setCurrentColor(hex)
  }
  
  addToPalette(color?: Color) {
    const colorToAdd = color || this.currentColor
    
    // Don't add duplicates
    if (!this.colorPalette.find(c => c.hex === colorToAdd.hex)) {
      this.colorPalette.push(colorToAdd)
    }
  }
  
  removeFromPalette(colorId: string) {
    this.colorPalette = this.colorPalette.filter(c => c.id !== colorId)
  }
  
  private addToHistory(color: Color) {
    this.colorHistory.unshift(color)
    
    // Keep history size manageable
    if (this.colorHistory.length > 50) {
      this.colorHistory = this.colorHistory.slice(0, 50)
    }
  }
  
  // Generate harmonious colors
  generateHarmony(type: 'complement' | 'triadic' | 'analogous' | 'split-complement' = 'analogous'): Color[] {
    const baseColor = chroma(this.currentColor.hex)
    const baseHue = baseColor.hsl()[0] || 0
    
    let hues: number[] = []
    
    switch (type) {
      case 'complement':
        hues = [baseHue, (baseHue + 180) % 360]
        break
      case 'triadic':
        hues = [baseHue, (baseHue + 120) % 360, (baseHue + 240) % 360]
        break
      case 'analogous':
        hues = [
          (baseHue - 30 + 360) % 360,
          baseHue,
          (baseHue + 30) % 360,
        ]
        break
      case 'split-complement':
        hues = [
          baseHue,
          (baseHue + 150) % 360,
          (baseHue + 210) % 360,
        ]
        break
    }
    
    return hues.map(hue => {
      const [, s, l] = baseColor.hsl()
      const harmonicColor = chroma.hsl(hue, s || 0.7, l || 0.6)
      return this.createColor(harmonicColor.hex())
    })
  }
  
  // AI color generation with diffusion models
  async generateWithAI(prompt: ColorPrompt): Promise<Color[]> {
    if (this.isGenerating) {
      throw new Error('Generation already in progress')
    }

    this.isGenerating = true
    this.generationSeed = prompt.text
    
    try {
      const generatedColors = await this.aiEngine.generateColors(prompt)
      
      const colors = generatedColors.map(genColor => 
        this.createColor(genColor.hex, undefined, genColor)
      )
      
      this.lastGeneratedColors = colors
      
      // Automatically set the first generated color as current
      if (colors.length > 0) {
        this.setCurrentColor(colors[0].hex)
      }
      
      return colors
    } finally {
      this.isGenerating = false
    }
  }
  
  // Quick AI generation with text prompt
  async generateFromText(text: string, style?: ColorPrompt['style']): Promise<Color[]> {
    return this.generateWithAI({
      text,
      style: style || 'vibrant',
      mood: 'neutral',
      count: 5
    })
  }
  
  // Add all generated colors to palette
  addGeneratedToPalette() {
    this.lastGeneratedColors.forEach(color => {
      this.addToPalette(color)
    })
  }
  
  getAIStatus() {
    return this.aiEngine.getStatus()
  }
  
  clearHistory() {
    this.colorHistory = []
  }
  
  clearPalette() {
    this.colorPalette = []
  }
  
  clearGenerated() {
    this.lastGeneratedColors = []
  }
} 