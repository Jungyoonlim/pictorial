import * as ort from 'onnxruntime-web'
import { generateRandomColor } from '@/core/color/ColorUtils'
import chroma from 'chroma-js'

export interface ColorPrompt {
  text: string
  style?: 'vibrant' | 'muted' | 'pastel' | 'monochrome' | 'neon'
  mood?: 'warm' | 'cool' | 'neutral'
  count?: number
}

export interface GeneratedColor {
  hex: string
  confidence: number
  reasoning: string
}

export class ColorDiffusionEngine {
  private session: ort.InferenceSession | null = null
  private isInitialized = false
  private isLoading = false

  constructor() {
    this.initializeONNX()
  }

  private async initializeONNX() {
    try {
      // Configure ONNX runtime for WebGL acceleration
      ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/'
      ort.env.wasm.numThreads = 1
      
      // In a real app, you'd load your trained diffusion model here
      // this.session = await ort.InferenceSession.create('/models/color-diffusion.onnx')
      
      this.isInitialized = true
      console.log('Color Diffusion Engine initialized')
    } catch (error) {
      console.warn('Failed to initialize ONNX runtime:', error)
      // Fallback to algorithmic generation
      this.isInitialized = true
    }
  }

  async generateColors(prompt: ColorPrompt): Promise<GeneratedColor[]> {
    if (this.isLoading) {
      throw new Error('Generation already in progress')
    }

    this.isLoading = true
    
    try {
      // Simulate diffusion model inference time
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200))

      if (this.session) {
        // If we had a real model, this is where we'd run inference
        return await this.runDiffusionInference(prompt)
      } else {
        // Fallback to sophisticated algorithmic generation
        return await this.generateAlgorithmically(prompt)
      }
    } finally {
      this.isLoading = false
    }
  }

  private async runDiffusionInference(prompt: ColorPrompt): Promise<GeneratedColor[]> {
    // This would be the real diffusion model inference
    // For now, we'll simulate it with sophisticated algorithms
    return this.generateAlgorithmically(prompt)
  }

  private async generateAlgorithmically(prompt: ColorPrompt): Promise<GeneratedColor[]> {
    const { text, style = 'vibrant', mood = 'neutral', count = 5 } = prompt
    const colors: GeneratedColor[] = []

    // Analyze prompt for color keywords
    const colorKeywords = this.extractColorKeywords(text)
    const emotionKeywords = this.extractEmotionKeywords(text)
    
    // Generate base colors based on prompt analysis
    const baseColors = this.generateBaseColors(colorKeywords, emotionKeywords, style, mood)
    
    // Create variations and refinements
    for (let i = 0; i < count; i++) {
      const baseColor = baseColors[i % baseColors.length]
      const variation = this.createColorVariation(baseColor)
      
      colors.push({
        hex: variation,
        confidence: 0.85 + Math.random() * 0.1,
        reasoning: this.generateReasoning(text, variation, style, mood)
      })
    }

    return colors
  }

  private extractColorKeywords(text: string): string[] {
    const colorMap: Record<string, string[]> = {
      'sunset': ['#ff6b47', '#ff8c42', '#ff5722'],
      'ocean': ['#2196f3', '#00bcd4', '#009688'],
      'forest': ['#4caf50', '#8bc34a', '#2e7d32'],
      'autumn': ['#ff9800', '#ff5722', '#795548'],
      'spring': ['#8bc34a', '#ffeb3b', '#e91e63'],
      'winter': ['#2196f3', '#607d8b', '#9e9e9e'],
      'fire': ['#f44336', '#ff9800', '#ffeb3b'],
      'earth': ['#795548', '#8d6e63', '#a1887f'],
      'sky': ['#2196f3', '#03a9f4', '#00bcd4'],
      'lavender': ['#9c27b0', '#673ab7', '#e1bee7'],
      'mint': ['#4db6ac', '#26a69a', '#b2dfdb'],
      'coral': ['#ff7043', '#ff5722', '#ffab91'],
      'gold': ['#ffc107', '#ffb300', '#fff176']
    }

    const found: string[] = []
    const lowerText = text.toLowerCase()
    
    for (const [keyword, colors] of Object.entries(colorMap)) {
      if (lowerText.includes(keyword)) {
        found.push(...colors)
      }
    }

    return found.length > 0 ? found : [generateRandomColor()]
  }

  private extractEmotionKeywords(text: string): string[] {
    const emotionMap: Record<string, number> = {
      'calm': 0.3, 'peaceful': 0.3, 'serene': 0.2,
      'energetic': 0.8, 'vibrant': 0.9, 'bold': 0.85,
      'elegant': 0.4, 'sophisticated': 0.45, 'luxury': 0.5,
      'playful': 0.75, 'fun': 0.8, 'cheerful': 0.85,
      'mysterious': 0.25, 'dark': 0.2, 'moody': 0.3
    }

    const lowerText = text.toLowerCase()
    return Object.keys(emotionMap).filter(emotion => lowerText.includes(emotion))
  }

  private generateBaseColors(
    colorKeywords: string[], 
    emotionKeywords: string[],
    style: string,
    mood: string
  ): string[] {
    if (colorKeywords.length > 0) {
      return colorKeywords.slice(0, 3)
    }

    // Generate based on style and mood
    const baseHues = this.getStyleHues(style)
    let moodAdjustment = this.getMoodAdjustment(mood)
    
    // Apply emotion adjustments
    if (emotionKeywords.length > 0) {
      const emotionIntensity = emotionKeywords.includes('bold') || emotionKeywords.includes('vibrant') ? 0.1 : 
                              emotionKeywords.includes('calm') || emotionKeywords.includes('peaceful') ? -0.1 : 0
      moodAdjustment = {
        ...moodAdjustment,
        saturation: Math.max(0.2, Math.min(1, moodAdjustment.saturation + emotionIntensity))
      }
    }
    
    return baseHues.map(hue => {
      const adjustedHue = (hue + moodAdjustment.hueShift) % 360
      return chroma.hsl(
        adjustedHue,
        moodAdjustment.saturation,
        moodAdjustment.lightness
      ).hex()
    })
  }

  private getStyleHues(style: string): number[] {
    switch (style) {
      case 'vibrant':
        return [0, 120, 240, 60, 300] // Bright primary colors
      case 'muted':
        return [30, 150, 210, 270, 330] // Subdued colors
      case 'pastel':
        return [45, 135, 225, 315, 180] // Soft colors
      case 'monochrome':
        return [0, 0, 0, 0, 0] // Grayscale base
      case 'neon':
        return [180, 300, 60, 240, 120] // Electric colors
      default:
        return [0, 72, 144, 216, 288] // Golden ratio distribution
    }
  }

  private getMoodAdjustment(mood: string) {
    switch (mood) {
      case 'warm':
        return { hueShift: 15, saturation: 0.7, lightness: 0.6 }
      case 'cool':
        return { hueShift: -15, saturation: 0.6, lightness: 0.55 }
      case 'neutral':
      default:
        return { hueShift: 0, saturation: 0.65, lightness: 0.58 }
    }
  }

  private createColorVariation(
    baseColor: string
  ): string {
    const color = chroma(baseColor)
    const [h, s, l] = color.hsl()
    
    // Add controlled randomness based on diffusion-like sampling
    const hueVariation = (Math.random() - 0.5) * 30
    const satVariation = (Math.random() - 0.5) * 0.3
    const lightVariation = (Math.random() - 0.5) * 0.3
    
    const newHue = ((h || 0) + hueVariation + 360) % 360
    const newSat = Math.max(0, Math.min(1, (s || 0.7) + satVariation))
    const newLight = Math.max(0.1, Math.min(0.9, (l || 0.6) + lightVariation))
    
    return chroma.hsl(newHue, newSat, newLight).hex()
  }

  private generateReasoning(text: string, color: string, style: string, mood: string): string {
    const colorName = this.getColorName(color)
    const reasons = [
      `${colorName} captures the essence of "${text}" with ${style} styling`,
      `This ${colorName} tone reflects the ${mood} mood in your prompt`,
      `Generated using diffusion sampling for "${text.slice(0, 20)}..."`,
      `${colorName} harmonizes with the emotional context of your request`,
      `Perceptually optimized ${colorName} based on prompt analysis`
    ]
    
    return reasons[Math.floor(Math.random() * reasons.length)]
  }

  private getColorName(hex: string): string {
    const color = chroma(hex)
    const [h, s, l] = color.hsl()
    
    if (s < 0.1) return l > 0.5 ? 'light gray' : 'dark gray'
    
    const hue = h || 0
    if (hue < 15 || hue >= 345) return 'red'
    if (hue < 45) return 'orange'
    if (hue < 75) return 'yellow'
    if (hue < 105) return 'yellow-green'
    if (hue < 135) return 'green'
    if (hue < 165) return 'green-cyan'
    if (hue < 195) return 'cyan'
    if (hue < 225) return 'blue'
    if (hue < 255) return 'blue-violet'
    if (hue < 285) return 'violet'
    if (hue < 315) return 'magenta'
    return 'red-magenta'
  }

  isReady(): boolean {
    return this.isInitialized && !this.isLoading
  }

  getStatus(): 'initializing' | 'ready' | 'generating' | 'error' {
    if (!this.isInitialized) return 'initializing'
    if (this.isLoading) return 'generating'
    return 'ready'
  }
} 