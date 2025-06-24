// Web Worker for heavy color computations
import * as Comlink from 'comlink'
import chroma from 'chroma-js'

export interface ColorProcessingAPI {
  generatePalette(baseColor: string, count: number, method: string): Promise<string[]>
  analyzeImage(imageData: ImageData): Promise<ColorAnalysisResult>
  optimizeColorSpace(colors: string[], targetSpace: string): Promise<string[]>
  calculateHarmony(baseColor: string, harmonyType: string): Promise<string[]>
  generateGradient(startColor: string, endColor: string, steps: number): Promise<string[]>
  batchColorConversions(colors: string[], targetFormat: string): Promise<any[]>
}

export interface ColorAnalysisResult {
  dominantColors: Array<{ color: string; percentage: number }>
  averageColor: string
  colorfulness: number
  brightness: number
  contrast: number
  colorProfile: {
    warm: number
    cool: number
    saturation: number
    lightness: number
  }
}

class ColorProcessingWorker implements ColorProcessingAPI {
  async generatePalette(
    baseColor: string, 
    count: number, 
    method: 'analogous' | 'triadic' | 'complementary' | 'monochromatic' = 'analogous'
  ): Promise<string[]> {
    const base = chroma(baseColor)
    const palette: string[] = []
    
    switch (method) {
      case 'analogous':
        for (let i = 0; i < count; i++) {
          const hue = (base.hsl()[0] + (i * 30)) % 360
          palette.push(chroma.hsl(hue, base.hsl()[1], base.hsl()[2]).hex())
        }
        break
        
      case 'triadic':
        for (let i = 0; i < count; i++) {
          const hue = (base.hsl()[0] + (i * 120)) % 360
          palette.push(chroma.hsl(hue, base.hsl()[1], base.hsl()[2]).hex())
        }
        break
        
      case 'complementary':
        palette.push(base.hex())
        palette.push(chroma.hsl((base.hsl()[0] + 180) % 360, base.hsl()[1], base.hsl()[2]).hex())
        
        // Fill remaining with variations
        for (let i = 2; i < count; i++) {
          const variation = i % 2 === 0 ? base : chroma.hsl((base.hsl()[0] + 180) % 360, base.hsl()[1], base.hsl()[2])
          const lightness = 0.3 + (i / count) * 0.4
          palette.push(variation.luminance(lightness).hex())
        }
        break
        
      case 'monochromatic':
        for (let i = 0; i < count; i++) {
          const lightness = 0.2 + (i / (count - 1)) * 0.6
          palette.push(base.luminance(lightness).hex())
        }
        break
    }
    
    return palette
  }

  async analyzeImage(imageData: ImageData): Promise<ColorAnalysisResult> {
    const { data, width, height } = imageData
    const colorCounts = new Map<string, number>()
    const pixels = data.length / 4
    
    let totalR = 0, totalG = 0, totalB = 0
    let totalSaturation = 0, totalLightness = 0
    let warmColors = 0, coolColors = 0
    
    // Analyze every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      
      if (a > 128) { // Skip transparent pixels
        const color = chroma.rgb(r, g, b)
        const hex = color.hex()
        
        // Count colors (quantized to reduce noise)
        const quantized = chroma(hex).set('hsl.s', Math.round(color.hsl()[1] * 10) / 10).hex()
        colorCounts.set(quantized, (colorCounts.get(quantized) || 0) + 1)
        
        // Accumulate statistics
        totalR += r
        totalG += g
        totalB += b
        
        const hsl = color.hsl()
        totalSaturation += hsl[1] || 0
        totalLightness += hsl[2] || 0
        
        // Warm vs cool classification
        const hue = hsl[0] || 0
        if ((hue >= 0 && hue <= 60) || (hue >= 300 && hue <= 360)) {
          warmColors++
        } else if (hue >= 180 && hue <= 300) {
          coolColors++
        }
      }
    }
    
    const pixelCount = pixels / 4
    
    // Calculate dominant colors
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([color, count]) => ({
        color,
        percentage: count / pixelCount
      }))
    
    // Calculate average color
    const avgR = totalR / pixelCount
    const avgG = totalG / pixelCount
    const avgB = totalB / pixelCount
    const averageColor = chroma.rgb(avgR, avgG, avgB).hex()
    
    // Calculate metrics
    const averageSaturation = totalSaturation / pixelCount
    const averageLightness = totalLightness / pixelCount
    const colorfulness = averageSaturation * sortedColors.length / 10
    const brightness = averageLightness
    
    // Simple contrast calculation based on color distribution
    const contrast = Math.min(1, sortedColors.length / 5)
    
    return {
      dominantColors: sortedColors,
      averageColor,
      colorfulness,
      brightness,
      contrast,
      colorProfile: {
        warm: warmColors / pixelCount,
        cool: coolColors / pixelCount,
        saturation: averageSaturation,
        lightness: averageLightness
      }
    }
  }

  async optimizeColorSpace(colors: string[], targetSpace: 'sRGB' | 'P3' | 'Rec2020'): Promise<string[]> {
    // Color space optimization logic
    return colors.map(color => {
      const chromaColor = chroma(color)
      
      switch (targetSpace) {
        case 'sRGB':
          // Clamp to sRGB gamut
          return chromaColor.clamp('rgb').hex()
        case 'P3':
          // Expand to P3 if possible, otherwise clamp
          return chromaColor.hex()
        case 'Rec2020':
          // Expand to Rec2020 if possible
          return chromaColor.hex()
        default:
          return color
      }
    })
  }

  async calculateHarmony(baseColor: string, harmonyType: string): Promise<string[]> {
    return this.generatePalette(baseColor, 5, harmonyType as any)
  }

  async generateGradient(startColor: string, endColor: string, steps: number): Promise<string[]> {
    const scale = chroma.scale([startColor, endColor]).mode('lch')
    const gradient: string[] = []
    
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1)
      gradient.push(scale(t).hex())
    }
    
    return gradient
  }

  async batchColorConversions(colors: string[], targetFormat: 'hex' | 'hsl' | 'rgb' | 'lch'): Promise<any[]> {
    return colors.map(color => {
      const chromaColor = chroma(color)
      
      switch (targetFormat) {
        case 'hex':
          return chromaColor.hex()
        case 'hsl':
          return chromaColor.hsl()
        case 'rgb':
          return chromaColor.rgb()
        case 'lch':
          return chromaColor.lch()
        default:
          return color
      }
    })
  }
}

// Export for Comlink
const worker = new ColorProcessingWorker()
Comlink.expose(worker)

export default worker 