import { Bezier } from 'bezier-js'
import * as ClipperLib from 'clipper-lib'
import { v4 as uuid } from 'uuid'
import { Point, BezierCurve, PathSegment, VectorPath, VectorElement, BoundingBox, Transform } from './VectorTypes'

export class VectorEngine {
  private clipper: ClipperLib.Clipper

  constructor() {
    this.clipper = new ClipperLib.Clipper()
  }

  // BEZIER CURVE OPERATIONS
  
  createBezierCurve(start: Point, control1: Point, control2: Point, end: Point): BezierCurve {
    return { start, control1, control2, end }
  }

  getBezierPoint(curve: BezierCurve, t: number): Point {
    const bezier = new Bezier(
      curve.start.x, curve.start.y,
      curve.control1.x, curve.control1.y,
      curve.control2.x, curve.control2.y,
      curve.end.x, curve.end.y
    )
    const point = bezier.get(t)
    return { x: point.x, y: point.y }
  }

  getBezierTangent(curve: BezierCurve, t: number): Point {
    const bezier = new Bezier(
      curve.start.x, curve.start.y,
      curve.control1.x, curve.control1.y,
      curve.control2.x, curve.control2.y,
      curve.end.x, curve.end.y
    )
    const tangent = bezier.derivative(t)
    return { x: tangent.x, y: tangent.y }
  }

  splitBezier(curve: BezierCurve, t: number): [BezierCurve, BezierCurve] {
    const bezier = new Bezier(
      curve.start.x, curve.start.y,
      curve.control1.x, curve.control1.y,
      curve.control2.x, curve.control2.y,
      curve.end.x, curve.end.y
    )
    const split = bezier.split(t)
    
    return [
      {
        start: { x: split.left.points[0].x, y: split.left.points[0].y },
        control1: { x: split.left.points[1].x, y: split.left.points[1].y },
        control2: { x: split.left.points[2].x, y: split.left.points[2].y },
        end: { x: split.left.points[3].x, y: split.left.points[3].y }
      },
      {
        start: { x: split.right.points[0].x, y: split.right.points[0].y },
        control1: { x: split.right.points[1].x, y: split.right.points[1].y },
        control2: { x: split.right.points[2].x, y: split.right.points[2].y },
        end: { x: split.right.points[3].x, y: split.right.points[3].y }
      }
    ]
  }

  getBezierLength(curve: BezierCurve): number {
    const bezier = new Bezier(
      curve.start.x, curve.start.y,
      curve.control1.x, curve.control1.y,
      curve.control2.x, curve.control2.y,
      curve.end.x, curve.end.y
    )
    return bezier.length()
  }

  // PATH OPERATIONS

  createPath(id?: string): VectorPath {
    return {
      id: id || uuid(),
      segments: [],
      closed: false
    }
  }

  moveTo(path: VectorPath, point: Point): void {
    path.segments.push({
      type: 'move',
      points: [point]
    })
  }

  lineTo(path: VectorPath, point: Point): void {
    path.segments.push({
      type: 'line',
      points: [point]
    })
  }

  curveTo(path: VectorPath, control1: Point, control2: Point, end: Point): void {
    path.segments.push({
      type: 'curve',
      points: [control1, control2, end]
    })
  }

  arcTo(path: VectorPath, center: Point, radius: number, startAngle: number, endAngle: number): void {
    path.segments.push({
      type: 'arc',
      points: [center],
      data: { radius, startAngle, endAngle }
    })
  }

  closePath(path: VectorPath): void {
    path.closed = true
    path.segments.push({
      type: 'close',
      points: []
    })
  }

  // PATH BOOLEAN OPERATIONS

  private pathToClipperPath(path: VectorPath): ClipperLib.Path {
    const clipperPath: ClipperLib.Path = []
    let currentPoint: Point = { x: 0, y: 0 }
    
    for (const segment of path.segments) {
      switch (segment.type) {
        case 'move':
          currentPoint = segment.points[0]
          break
        case 'line':
          clipperPath.push(new ClipperLib.IntPoint(segment.points[0].x * 1000, segment.points[0].y * 1000))
          currentPoint = segment.points[0]
          break
        case 'curve':
          // Approximate curve with line segments
          const steps = 20
          for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const point = this.getBezierPoint({
              start: currentPoint,
              control1: segment.points[0],
              control2: segment.points[1],
              end: segment.points[2]
            }, t)
            clipperPath.push(new ClipperLib.IntPoint(point.x * 1000, point.y * 1000))
          }
          currentPoint = segment.points[2]
          break
      }
    }
    
    return clipperPath
  }

  private clipperPathToPath(clipperPath: ClipperLib.Path, id: string): VectorPath {
    const path = this.createPath(id)
    
    if (clipperPath.length > 0) {
      this.moveTo(path, { x: clipperPath[0].X / 1000, y: clipperPath[0].Y / 1000 })
      
      for (let i = 1; i < clipperPath.length; i++) {
        this.lineTo(path, { x: clipperPath[i].X / 1000, y: clipperPath[i].Y / 1000 })
      }
      
      this.closePath(path)
    }
    
    return path
  }

  union(path1: VectorPath, path2: VectorPath): VectorPath[] {
    const clipper = new ClipperLib.Clipper()
    const solution = new ClipperLib.Paths()
    
    clipper.AddPath(this.pathToClipperPath(path1), ClipperLib.PolyType.ptSubject, true)
    clipper.AddPath(this.pathToClipperPath(path2), ClipperLib.PolyType.ptClip, true)
    
    if (clipper.Execute(ClipperLib.ClipType.ctUnion, solution)) {
      return solution.map((path, index) => this.clipperPathToPath(path, `union_${index}`))
    }
    
    return []
  }

  subtract(path1: VectorPath, path2: VectorPath): VectorPath[] {
    const clipper = new ClipperLib.Clipper()
    const solution = new ClipperLib.Paths()
    
    clipper.AddPath(this.pathToClipperPath(path1), ClipperLib.PolyType.ptSubject, true)
    clipper.AddPath(this.pathToClipperPath(path2), ClipperLib.PolyType.ptClip, true)
    
    if (clipper.Execute(ClipperLib.ClipType.ctDifference, solution)) {
      return solution.map((path, index) => this.clipperPathToPath(path, `subtract_${index}`))
    }
    
    return []
  }

  intersect(path1: VectorPath, path2: VectorPath): VectorPath[] {
    const clipper = new ClipperLib.Clipper()
    const solution = new ClipperLib.Paths()
    
    clipper.AddPath(this.pathToClipperPath(path1), ClipperLib.PolyType.ptSubject, true)
    clipper.AddPath(this.pathToClipperPath(path2), ClipperLib.PolyType.ptClip, true)
    
    if (clipper.Execute(ClipperLib.ClipType.ctIntersection, solution)) {
      return solution.map((path, index) => this.clipperPathToPath(path, `intersect_${index}`))
    }
    
    return []
  }

  // SHAPE PRIMITIVES

  createRectangle(x: number, y: number, width: number, height: number, rx = 0, ry = 0): VectorPath {
    const path = this.createPath()
    
    if (rx === 0 && ry === 0) {
      // Simple rectangle
      this.moveTo(path, { x, y })
      this.lineTo(path, { x: x + width, y })
      this.lineTo(path, { x: x + width, y: y + height })
      this.lineTo(path, { x, y: y + height })
      this.closePath(path)
    } else {
      // Rounded rectangle
      this.moveTo(path, { x: x + rx, y })
      this.lineTo(path, { x: x + width - rx, y })
      this.arcTo(path, { x: x + width - rx, y: y + ry }, rx, -Math.PI / 2, 0)
      this.lineTo(path, { x: x + width, y: y + height - ry })
      this.arcTo(path, { x: x + width - rx, y: y + height - ry }, rx, 0, Math.PI / 2)
      this.lineTo(path, { x: x + rx, y: y + height })
      this.arcTo(path, { x: x + rx, y: y + height - ry }, rx, Math.PI / 2, Math.PI)
      this.lineTo(path, { x, y: y + ry })
      this.arcTo(path, { x: x + rx, y: y + ry }, rx, Math.PI, 3 * Math.PI / 2)
      this.closePath(path)
    }
    
    return path
  }

  createCircle(centerX: number, centerY: number, radius: number): VectorPath {
    const path = this.createPath()
    
    // Create circle using 4 bezier curves
    const k = 0.5522848 // Control point offset for circle approximation
    const cp = radius * k
    
    this.moveTo(path, { x: centerX + radius, y: centerY })
    this.curveTo(path, 
      { x: centerX + radius, y: centerY + cp },
      { x: centerX + cp, y: centerY + radius },
      { x: centerX, y: centerY + radius }
    )
    this.curveTo(path,
      { x: centerX - cp, y: centerY + radius },
      { x: centerX - radius, y: centerY + cp },
      { x: centerX - radius, y: centerY }
    )
    this.curveTo(path,
      { x: centerX - radius, y: centerY - cp },
      { x: centerX - cp, y: centerY - radius },
      { x: centerX, y: centerY - radius }
    )
    this.curveTo(path,
      { x: centerX + cp, y: centerY - radius },
      { x: centerX + radius, y: centerY - cp },
      { x: centerX + radius, y: centerY }
    )
    this.closePath(path)
    
    return path
  }

  createEllipse(centerX: number, centerY: number, radiusX: number, radiusY: number): VectorPath {
    const path = this.createPath()
    
    const kx = radiusX * 0.5522848
    const ky = radiusY * 0.5522848
    
    this.moveTo(path, { x: centerX + radiusX, y: centerY })
    this.curveTo(path,
      { x: centerX + radiusX, y: centerY + ky },
      { x: centerX + kx, y: centerY + radiusY },
      { x: centerX, y: centerY + radiusY }
    )
    this.curveTo(path,
      { x: centerX - kx, y: centerY + radiusY },
      { x: centerX - radiusX, y: centerY + ky },
      { x: centerX - radiusX, y: centerY }
    )
    this.curveTo(path,
      { x: centerX - radiusX, y: centerY - ky },
      { x: centerX - kx, y: centerY - radiusY },
      { x: centerX, y: centerY - radiusY }
    )
    this.curveTo(path,
      { x: centerX + kx, y: centerY - radiusY },
      { x: centerX + radiusX, y: centerY - ky },
      { x: centerX + radiusX, y: centerY }
    )
    this.closePath(path)
    
    return path
  }

  createPolygon(centerX: number, centerY: number, radius: number, sides: number): VectorPath {
    const path = this.createPath()
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      
      if (i === 0) {
        this.moveTo(path, { x, y })
      } else {
        this.lineTo(path, { x, y })
      }
    }
    
    this.closePath(path)
    return path
  }

  createStar(centerX: number, centerY: number, outerRadius: number, innerRadius: number, points: number): VectorPath {
    const path = this.createPath()
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2
      const radius = i % 2 === 0 ? outerRadius : innerRadius
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      
      if (i === 0) {
        this.moveTo(path, { x, y })
      } else {
        this.lineTo(path, { x, y })
      }
    }
    
    this.closePath(path)
    return path
  }

  // UTILITY FUNCTIONS

  getPathBounds(path: VectorPath): BoundingBox {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    for (const segment of path.segments) {
      for (const point of segment.points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
    }
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }

  transformPath(path: VectorPath, transform: Transform): VectorPath {
    const newPath = { ...path, segments: [] }
    
    for (const segment of path.segments) {
      const transformedPoints = segment.points.map(point => 
        this.transformPoint(point, transform)
      )
      
      newPath.segments.push({
        ...segment,
        points: transformedPoints
      })
    }
    
    return newPath
  }

  private transformPoint(point: Point, transform: Transform): Point {
    const { translateX, translateY, scaleX, scaleY, rotation } = transform
    
    // Apply scale
    let x = point.x * scaleX
    let y = point.y * scaleY
    
    // Apply rotation
    if (rotation !== 0) {
      const cos = Math.cos(rotation)
      const sin = Math.sin(rotation)
      const newX = x * cos - y * sin
      const newY = x * sin + y * cos
      x = newX
      y = newY
    }
    
    // Apply translation
    x += translateX
    y += translateY
    
    return { x, y }
  }

  pathToSVGString(path: VectorPath): string {
    let d = ''
    
    for (const segment of path.segments) {
      switch (segment.type) {
        case 'move':
          d += `M ${segment.points[0].x} ${segment.points[0].y} `
          break
        case 'line':
          d += `L ${segment.points[0].x} ${segment.points[0].y} `
          break
        case 'curve':
          d += `C ${segment.points[0].x} ${segment.points[0].y} ${segment.points[1].x} ${segment.points[1].y} ${segment.points[2].x} ${segment.points[2].y} `
          break
        case 'arc':
          const { radius, startAngle, endAngle } = segment.data
          const startX = segment.points[0].x + radius * Math.cos(startAngle)
          const startY = segment.points[0].y + radius * Math.sin(startAngle)
          const endX = segment.points[0].x + radius * Math.cos(endAngle)
          const endY = segment.points[0].y + radius * Math.sin(endAngle)
          const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0
          d += `A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} `
          break
        case 'close':
          d += 'Z '
          break
      }
    }
    
    return d.trim()
  }
} 