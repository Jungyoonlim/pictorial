import chroma from 'chroma-js'
import { lch, rgb, formatHex } from 'culori'

/**
 * Convert hex color to LCH color space
 * LCH is more perceptually uniform than HSL
 */
export function convertToLch(hex: string): [number, number, number] {
  try {
    const lchColor = lch(hex)
    if (!lchColor) return [50, 0, 0]
    
    return [
      lchColor.l || 0,
      lchColor.c || 0,
      lchColor.h || 0,
    ]
  } catch {
    return [50, 0, 0]
  }
}

/**
 * Convert LCH values back to hex
 */
export function convertFromLch([l, c, h]: [number, number, number]): string {
  try {
    const rgbColor = rgb({ mode: 'lch', l, c, h })
    if (!rgbColor) return '#808080'
    
    return formatHex(rgbColor) || '#808080'
  } catch {
    return '#808080'
  }
}

/**
 * Clamp LCH values to valid ranges
 */
export function clampLch([l, c, h]: [number, number, number]): [number, number, number] {
  return [
    Math.max(0, Math.min(100, l)), // Lightness: 0-100
    Math.max(0, Math.min(132, c)), // Chroma: 0-132 (approximate max)
    ((h % 360) + 360) % 360,       // Hue: 0-360
  ]
}

/**
 * Generate a perceptually uniform color scale
 */
export function generateColorScale(
  startColor: string,
  endColor: string,
  steps: number = 5
): string[] {
  return chroma.scale([startColor, endColor])
    .mode('lch')
    .colors(steps)
}

/**
 * Calculate color contrast ratio (WCAG)
 */
export function getContrastRatio(color1: string, color2: string): number {
  return chroma.contrast(color1, color2)
}

/**
 * Get the best text color (black or white) for a background
 */
export function getTextColorForBackground(backgroundColor: string): string {
  const whiteContrast = getContrastRatio(backgroundColor, '#ffffff')
  const blackContrast = getContrastRatio(backgroundColor, '#000000')
  
  return whiteContrast > blackContrast ? '#ffffff' : '#000000'
}

/**
 * Check if a color is considered "light"
 */
export function isLightColor(color: string): boolean {
  return chroma(color).luminance() > 0.5
}

/**
 * Generate a random color with good saturation and lightness
 */
export function generateRandomColor(): string {
  const hue = Math.random() * 360
  const saturation = 0.6 + Math.random() * 0.3 // 60-90%
  const lightness = 0.4 + Math.random() * 0.4  // 40-80%
  
  return chroma.hsl(hue, saturation, lightness).hex()
}

/**
 * Extract dominant colors from an image (placeholder)
 */
export async function extractColorsFromImage(imageData: ImageData): Promise<string[]> {
  // This is a simplified implementation
  // In a real app, you'd use a more sophisticated algorithm
  const colors: string[] = []
  const step = 10
  
  for (let i = 0; i < imageData.data.length; i += step * 4) {
    const r = imageData.data[i]
    const g = imageData.data[i + 1]
    const b = imageData.data[i + 2]
    const a = imageData.data[i + 3]
    
    if (a > 128) { // Only consider non-transparent pixels
      const hex = chroma.rgb(r, g, b).hex()
      if (!colors.includes(hex)) {
        colors.push(hex)
      }
    }
    
    if (colors.length >= 10) break
  }
  
  return colors
} 