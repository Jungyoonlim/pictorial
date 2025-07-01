export interface Point {
  x: number
  y: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Transform {
  translateX: number
  translateY: number
  scaleX: number
  scaleY: number
  rotation: number
  skewX: number
  skewY: number
}

export interface BezierCurve {
  start: Point
  control1: Point
  control2: Point
  end: Point
}

export interface PathSegment {
  type: 'move' | 'line' | 'curve' | 'arc' | 'close'
  points: Point[]
  data?: any
}

export interface VectorPath {
  id: string
  segments: PathSegment[]
  closed: boolean
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
}

export interface Style {
  fill?: {
    type: 'solid' | 'gradient' | 'pattern'
    color?: string
    gradient?: {
      type: 'linear' | 'radial'
      stops: Array<{ offset: number; color: string }>
      angle?: number
    }
    pattern?: {
      url: string
      repeat: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y'
    }
  }
  stroke?: {
    color: string
    width: number
    dashArray?: number[]
    lineCap: 'butt' | 'round' | 'square'
    lineJoin: 'miter' | 'round' | 'bevel'
  }
  shadow?: {
    offsetX: number
    offsetY: number
    blur: number
    color: string
  }
  opacity?: number
}

export interface VectorElement {
  id: string
  type: 'path' | 'shape' | 'text' | 'group'
  transform: Transform
  style: Style
  boundingBox: BoundingBox
  visible: boolean
  locked: boolean
  zIndex: number
  data: any
  children?: VectorElement[]
  parent?: string
}

export interface VectorShape extends VectorElement {
  type: 'shape'
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'polygon' | 'star'
  data: {
    width?: number
    height?: number
    radius?: number
    radiusX?: number
    radiusY?: number
    points?: Point[]
    sides?: number
    innerRadius?: number
  }
}

export interface VectorText extends VectorElement {
  type: 'text'
  data: {
    content: string
    fontFamily: string
    fontSize: number
    fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
    fontStyle: 'normal' | 'italic'
    textAlign: 'left' | 'center' | 'right' | 'justify'
    letterSpacing: number
    lineHeight: number
    path?: VectorPath // For text on path
  }
}

export interface VectorGroup extends VectorElement {
  type: 'group'
  children: VectorElement[]
}

export interface Selection {
  elements: string[]
  bounds: BoundingBox
  transform: Transform
}

export interface GridSettings {
  enabled: boolean
  size: number
  color: string
  opacity: number
  snap: boolean
}

export interface Viewport {
  x: number
  y: number
  zoom: number
  width: number
  height: number
}

export interface HistoryItem {
  id: string
  timestamp: number
  action: string
  data: any
  userId?: string
}

export interface CollaborationCursor {
  userId: string
  userName: string
  color: string
  position: Point
  tool: string
} 