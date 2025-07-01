import { parse as parseSVGPath } from 'svg-path-parser'
import { VectorElement, VectorPath, VectorShape, VectorText, VectorGroup, Style, Point, Transform } from './VectorTypes'
import { VectorEngine } from './VectorEngine'
import { v4 as uuid } from 'uuid'

export class SVGEngine {
  private vectorEngine: VectorEngine

  constructor() {
    this.vectorEngine = new VectorEngine()
  }

  // SVG IMPORT

  async importSVG(svgContent: string): Promise<VectorGroup> {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml')
    const svgElement = svgDoc.querySelector('svg')
    
    if (!svgElement) {
      throw new Error('Invalid SVG content')
    }

    const rootGroup: VectorGroup = {
      id: uuid(),
      type: 'group',
      transform: this.createDefaultTransform(),
      style: {},
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      visible: true,
      locked: false,
      zIndex: 0,
      data: {},
      children: []
    }

    // Parse SVG dimensions
    const width = parseFloat(svgElement.getAttribute('width') || '0')
    const height = parseFloat(svgElement.getAttribute('height') || '0')
    rootGroup.boundingBox = { x: 0, y: 0, width, height }

    // Parse child elements
    await this.parseChildren(svgElement, rootGroup)

    return rootGroup
  }

  private async parseChildren(parent: Element, group: VectorGroup): Promise<void> {
    for (const child of Array.from(parent.children)) {
      const element = await this.parseElement(child)
      if (element) {
        group.children.push(element)
      }
    }
  }

  private async parseElement(element: Element): Promise<VectorElement | null> {
    const tagName = element.tagName.toLowerCase()
    
    switch (tagName) {
      case 'path':
        return this.parsePath(element)
      case 'rect':
        return this.parseRect(element)
      case 'circle':
        return this.parseCircle(element)
      case 'ellipse':
        return this.parseEllipse(element)
      case 'polygon':
        return this.parsePolygon(element)
      case 'polyline':
        return this.parsePolyline(element)
      case 'text':
        return this.parseText(element)
      case 'g':
        return this.parseGroup(element)
      case 'defs':
      case 'style':
        return null // Skip these for now
      default:
        console.warn(`Unsupported SVG element: ${tagName}`)
        return null
    }
  }

  private parsePath(element: Element): VectorElement {
    const d = element.getAttribute('d') || ''
    const path = this.svgPathToVectorPath(d)
    
    return {
      id: element.id || uuid(),
      type: 'path',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: this.vectorEngine.getPathBounds(path),
      visible: true,
      locked: false,
      zIndex: 0,
      data: { path }
    }
  }

  private parseRect(element: Element): VectorShape {
    const x = parseFloat(element.getAttribute('x') || '0')
    const y = parseFloat(element.getAttribute('y') || '0')
    const width = parseFloat(element.getAttribute('width') || '0')
    const height = parseFloat(element.getAttribute('height') || '0')
    const rx = parseFloat(element.getAttribute('rx') || '0')
    const ry = parseFloat(element.getAttribute('ry') || '0')

    return {
      id: element.id || uuid(),
      type: 'shape',
      shapeType: 'rectangle',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: { x, y, width, height },
      visible: true,
      locked: false,
      zIndex: 0,
      data: { width, height, rx, ry }
    }
  }

  private parseCircle(element: Element): VectorShape {
    const cx = parseFloat(element.getAttribute('cx') || '0')
    const cy = parseFloat(element.getAttribute('cy') || '0')
    const r = parseFloat(element.getAttribute('r') || '0')

    return {
      id: element.id || uuid(),
      type: 'shape',
      shapeType: 'circle',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
      visible: true,
      locked: false,
      zIndex: 0,
      data: { radius: r }
    }
  }

  private parseEllipse(element: Element): VectorShape {
    const cx = parseFloat(element.getAttribute('cx') || '0')
    const cy = parseFloat(element.getAttribute('cy') || '0')
    const rx = parseFloat(element.getAttribute('rx') || '0')
    const ry = parseFloat(element.getAttribute('ry') || '0')

    return {
      id: element.id || uuid(),
      type: 'shape',
      shapeType: 'ellipse',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
      visible: true,
      locked: false,
      zIndex: 0,
      data: { radiusX: rx, radiusY: ry }
    }
  }

  private parsePolygon(element: Element): VectorElement {
    const pointsStr = element.getAttribute('points') || ''
    const points = this.parsePoints(pointsStr)
    const path = this.pointsToPath(points, true)

    return {
      id: element.id || uuid(),
      type: 'path',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: this.vectorEngine.getPathBounds(path),
      visible: true,
      locked: false,
      zIndex: 0,
      data: { path }
    }
  }

  private parsePolyline(element: Element): VectorElement {
    const pointsStr = element.getAttribute('points') || ''
    const points = this.parsePoints(pointsStr)
    const path = this.pointsToPath(points, false)

    return {
      id: element.id || uuid(),
      type: 'path',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: this.vectorEngine.getPathBounds(path),
      visible: true,
      locked: false,
      zIndex: 0,
      data: { path }
    }
  }

  private parseText(element: Element): VectorText {
    const x = parseFloat(element.getAttribute('x') || '0')
    const y = parseFloat(element.getAttribute('y') || '0')
    const content = element.textContent || ''

    return {
      id: element.id || uuid(),
      type: 'text',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: { x, y, width: 0, height: 0 }, // Will be calculated later
      visible: true,
      locked: false,
      zIndex: 0,
      data: {
        content,
        fontFamily: this.getStyleProperty(element, 'font-family') || 'Arial',
        fontSize: parseFloat(this.getStyleProperty(element, 'font-size') || '16'),
        fontWeight: this.getStyleProperty(element, 'font-weight') || 'normal',
        fontStyle: this.getStyleProperty(element, 'font-style') || 'normal',
        textAlign: this.getStyleProperty(element, 'text-align') || 'left',
        letterSpacing: parseFloat(this.getStyleProperty(element, 'letter-spacing') || '0'),
        lineHeight: parseFloat(this.getStyleProperty(element, 'line-height') || '1.2')
      }
    }
  }

  private async parseGroup(element: Element): Promise<VectorGroup> {
    const group: VectorGroup = {
      id: element.id || uuid(),
      type: 'group',
      transform: this.parseTransform(element.getAttribute('transform')),
      style: this.parseStyle(element),
      boundingBox: { x: 0, y: 0, width: 0, height: 0 },
      visible: true,
      locked: false,
      zIndex: 0,
      data: {},
      children: []
    }

    await this.parseChildren(element, group)
    
    // Calculate bounding box from children
    if (group.children.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      
      for (const child of group.children) {
        const bounds = child.boundingBox
        minX = Math.min(minX, bounds.x)
        minY = Math.min(minY, bounds.y)
        maxX = Math.max(maxX, bounds.x + bounds.width)
        maxY = Math.max(maxY, bounds.y + bounds.height)
      }
      
      group.boundingBox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      }
    }

    return group
  }

  // SVG EXPORT

  exportSVG(elements: VectorElement[], width: number, height: number): string {
    let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`
    
    for (const element of elements) {
      svgContent += this.elementToSVG(element, 2)
    }
    
    svgContent += '</svg>'
    return svgContent
  }

  private elementToSVG(element: VectorElement, indent = 0): string {
    const spaces = ' '.repeat(indent)
    
    switch (element.type) {
      case 'path':
        return this.pathElementToSVG(element, spaces)
      case 'shape':
        return this.shapeElementToSVG(element as VectorShape, spaces)
      case 'text':
        return this.textElementToSVG(element as VectorText, spaces)
      case 'group':
        return this.groupElementToSVG(element as VectorGroup, spaces, indent)
      default:
        return ''
    }
  }

  private pathElementToSVG(element: VectorElement, spaces: string): string {
    const path = element.data.path as VectorPath
    const d = this.vectorEngine.pathToSVGString(path)
    const style = this.styleToSVGString(element.style)
    const transform = this.transformToSVGString(element.transform)
    
    return `${spaces}<path d="${d}" ${style} ${transform}/>\n`
  }

  private shapeElementToSVG(element: VectorShape, spaces: string): string {
    const style = this.styleToSVGString(element.style)
    const transform = this.transformToSVGString(element.transform)
    
    switch (element.shapeType) {
      case 'rectangle':
        const { width, height, rx, ry } = element.data
        const rxAttr = rx ? ` rx="${rx}"` : ''
        const ryAttr = ry ? ` ry="${ry}"` : ''
        return `${spaces}<rect x="${element.boundingBox.x}" y="${element.boundingBox.y}" width="${width}" height="${height}"${rxAttr}${ryAttr} ${style} ${transform}/>\n`
      
      case 'circle':
        const { radius } = element.data
        const cx = element.boundingBox.x + radius
        const cy = element.boundingBox.y + radius
        return `${spaces}<circle cx="${cx}" cy="${cy}" r="${radius}" ${style} ${transform}/>\n`
      
      case 'ellipse':
        const { radiusX, radiusY } = element.data
        const ecx = element.boundingBox.x + radiusX
        const ecy = element.boundingBox.y + radiusY
        return `${spaces}<ellipse cx="${ecx}" cy="${ecy}" rx="${radiusX}" ry="${radiusY}" ${style} ${transform}/>\n`
      
      default:
        return ''
    }
  }

  private textElementToSVG(element: VectorText, spaces: string): string {
    const { content, fontFamily, fontSize, fontWeight, fontStyle } = element.data
    const style = this.styleToSVGString(element.style)
    const transform = this.transformToSVGString(element.transform)
    
    const fontAttrs = `font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" font-style="${fontStyle}"`
    
    return `${spaces}<text x="${element.boundingBox.x}" y="${element.boundingBox.y}" ${fontAttrs} ${style} ${transform}>${content}</text>\n`
  }

  private groupElementToSVG(element: VectorGroup, spaces: string, indent: number): string {
    const transform = this.transformToSVGString(element.transform)
    let result = `${spaces}<g ${transform}>\n`
    
    for (const child of element.children) {
      result += this.elementToSVG(child, indent + 2)
    }
    
    result += `${spaces}</g>\n`
    return result
  }

  // UTILITY METHODS

  private svgPathToVectorPath(d: string): VectorPath {
    const path = this.vectorEngine.createPath()
    const commands = parseSVGPath(d)
    let currentPoint: Point = { x: 0, y: 0 }
    
    for (const command of commands) {
      switch (command.command) {
        case 'moveto':
          currentPoint = { x: command.x || 0, y: command.y || 0 }
          this.vectorEngine.moveTo(path, currentPoint)
          break
        case 'lineto':
          currentPoint = { x: command.x || 0, y: command.y || 0 }
          this.vectorEngine.lineTo(path, currentPoint)
          break
        case 'curveto':
          const control1 = { x: command.x1 || 0, y: command.y1 || 0 }
          const control2 = { x: command.x2 || 0, y: command.y2 || 0 }
          currentPoint = { x: command.x || 0, y: command.y || 0 }
          this.vectorEngine.curveTo(path, control1, control2, currentPoint)
          break
        case 'closepath':
          this.vectorEngine.closePath(path)
          break
      }
    }
    
    return path
  }

  private pointsToPath(points: Point[], closed: boolean): VectorPath {
    const path = this.vectorEngine.createPath()
    
    if (points.length > 0) {
      this.vectorEngine.moveTo(path, points[0])
      
      for (let i = 1; i < points.length; i++) {
        this.vectorEngine.lineTo(path, points[i])
      }
      
      if (closed) {
        this.vectorEngine.closePath(path)
      }
    }
    
    return path
  }

  private parsePoints(pointsStr: string): Point[] {
    const points: Point[] = []
    const coords = pointsStr.trim().split(/[\s,]+/)
    
    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        points.push({
          x: parseFloat(coords[i]),
          y: parseFloat(coords[i + 1])
        })
      }
    }
    
    return points
  }

  private parseTransform(transformStr: string | null): Transform {
    const defaultTransform = this.createDefaultTransform()
    
    if (!transformStr) return defaultTransform
    
    // Parse transform functions like translate(x,y), scale(x,y), rotate(angle)
    const transforms = transformStr.match(/(\w+)\s*\([^)]*\)/g) || []
    
    for (const transform of transforms) {
      const match = transform.match(/(\w+)\s*\(([^)]*)\)/)
      if (!match) continue
      
      const [, func, args] = match
      const values = args.split(/[\s,]+/).map(parseFloat)
      
      switch (func) {
        case 'translate':
          defaultTransform.translateX = values[0] || 0
          defaultTransform.translateY = values[1] || 0
          break
        case 'scale':
          defaultTransform.scaleX = values[0] || 1
          defaultTransform.scaleY = values[1] || values[0] || 1
          break
        case 'rotate':
          defaultTransform.rotation = (values[0] || 0) * Math.PI / 180
          break
      }
    }
    
    return defaultTransform
  }

  private parseStyle(element: Element): Style {
    const style: Style = {}
    
    // Parse fill
    const fill = this.getStyleProperty(element, 'fill')
    if (fill && fill !== 'none') {
      style.fill = { type: 'solid', color: fill }
    }
    
    // Parse stroke
    const stroke = this.getStyleProperty(element, 'stroke')
    if (stroke && stroke !== 'none') {
      style.stroke = {
        color: stroke,
        width: parseFloat(this.getStyleProperty(element, 'stroke-width') || '1'),
        lineCap: this.getStyleProperty(element, 'stroke-linecap') as any || 'butt',
        lineJoin: this.getStyleProperty(element, 'stroke-linejoin') as any || 'miter'
      }
    }
    
    // Parse opacity
    const opacity = this.getStyleProperty(element, 'opacity')
    if (opacity) {
      style.opacity = parseFloat(opacity)
    }
    
    return style
  }

  private getStyleProperty(element: Element, property: string): string | null {
    // Check inline style attribute
    const style = element.getAttribute('style')
    if (style) {
      const match = style.match(new RegExp(`${property}\\s*:\\s*([^;]+)`))
      if (match) return match[1].trim()
    }
    
    // Check direct attribute
    return element.getAttribute(property)
  }

  private createDefaultTransform(): Transform {
    return {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      skewX: 0,
      skewY: 0
    }
  }

  private styleToSVGString(style: Style): string {
    const parts: string[] = []
    
    if (style.fill) {
      if (style.fill.type === 'solid' && style.fill.color) {
        parts.push(`fill="${style.fill.color}"`)
      }
    } else {
      parts.push('fill="none"')
    }
    
    if (style.stroke) {
      parts.push(`stroke="${style.stroke.color}"`)
      parts.push(`stroke-width="${style.stroke.width}"`)
      if (style.stroke.lineCap) parts.push(`stroke-linecap="${style.stroke.lineCap}"`)
      if (style.stroke.lineJoin) parts.push(`stroke-linejoin="${style.stroke.lineJoin}"`)
    }
    
    if (style.opacity !== undefined) {
      parts.push(`opacity="${style.opacity}"`)
    }
    
    return parts.join(' ')
  }

  private transformToSVGString(transform: Transform): string {
    const parts: string[] = []
    
    if (transform.translateX !== 0 || transform.translateY !== 0) {
      parts.push(`translate(${transform.translateX},${transform.translateY})`)
    }
    
    if (transform.scaleX !== 1 || transform.scaleY !== 1) {
      parts.push(`scale(${transform.scaleX},${transform.scaleY})`)
    }
    
    if (transform.rotation !== 0) {
      const degrees = transform.rotation * 180 / Math.PI
      parts.push(`rotate(${degrees})`)
    }
    
    return parts.length > 0 ? `transform="${parts.join(' ')}"` : ''
  }
} 