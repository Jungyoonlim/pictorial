// High-performance virtualization for large datasets
export interface VirtualItem {
  id: string
  index: number
  size: number
  offset: number
  data: any
}

export interface VirtualizedRenderProps {
  items: VirtualItem[]
  visibleRange: { start: number; end: number }
  totalSize: number
  scrollOffset: number
}

export class VirtualizationEngine {
  private itemSizes: Map<string, number> = new Map()
  private itemOffsets: Map<string, number> = new Map()
  private cachedItems: Map<string, any> = new Map()
  private estimatedItemSize: number
  private viewportSize: number
  private scrollOffset: number = 0
  
  constructor(estimatedItemSize: number = 50, viewportSize: number = 600) {
    this.estimatedItemSize = estimatedItemSize
    this.viewportSize = viewportSize
  }
  
  calculateVirtualItems<T>(
    items: T[], 
    getItemId: (item: T, index: number) => string,
    getItemData: (item: T, index: number) => any
  ): VirtualizedRenderProps {
    // Update offsets and calculate visible range
    let totalOffset = 0
    const virtualItems: VirtualItem[] = []
    
    items.forEach((item, index) => {
      const id = getItemId(item, index)
      const size = this.itemSizes.get(id) || this.estimatedItemSize
      
      this.itemOffsets.set(id, totalOffset)
      
      virtualItems.push({
        id,
        index,
        size,
        offset: totalOffset,
        data: getItemData(item, index)
      })
      
      totalOffset += size
    })
    
    const visibleRange = this.calculateVisibleRange(virtualItems)
    
    return {
      items: virtualItems.slice(visibleRange.start, visibleRange.end + 1),
      visibleRange,
      totalSize: totalOffset,
      scrollOffset: this.scrollOffset
    }
  }
  
  private calculateVisibleRange(items: VirtualItem[]): { start: number; end: number } {
    const viewportStart = this.scrollOffset
    const viewportEnd = viewportStart + this.viewportSize
    
    let start = 0
    let end = items.length - 1
    
    // Binary search for start
    let left = 0
    let right = items.length - 1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const item = items[mid]
      
      if (item.offset + item.size < viewportStart) {
        left = mid + 1
      } else {
        start = mid
        right = mid - 1
      }
    }
    
    // Binary search for end
    left = start
    right = items.length - 1
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const item = items[mid]
      
      if (item.offset > viewportEnd) {
        right = mid - 1
      } else {
        end = mid
        left = mid + 1
      }
    }
    
    // Add buffer for smooth scrolling
    const buffer = 3
    start = Math.max(0, start - buffer)
    end = Math.min(items.length - 1, end + buffer)
    
    return { start, end }
  }
  
  updateItemSize(itemId: string, size: number): void {
    this.itemSizes.set(itemId, size)
  }
  
  setScrollOffset(offset: number): void {
    this.scrollOffset = offset
  }
  
  setViewportSize(size: number): void {
    this.viewportSize = size
  }
  
  getEstimatedTotalSize(itemCount: number): number {
    return itemCount * this.estimatedItemSize
  }
  
  // Cache management for expensive renders
  cacheItem(itemId: string, renderedContent: any): void {
    this.cachedItems.set(itemId, renderedContent)
    
    // Limit cache size
    if (this.cachedItems.size > 1000) {
      const oldestKey = this.cachedItems.keys().next().value
      this.cachedItems.delete(oldestKey)
    }
  }
  
  getCachedItem(itemId: string): any {
    return this.cachedItems.get(itemId)
  }
  
  clearCache(): void {
    this.cachedItems.clear()
  }
}

// React hook for virtualization
import { useEffect, useMemo, useRef, useState } from 'react'

export function useVirtualization<T>(
  items: T[],
  options: {
    estimatedItemSize?: number
    viewportSize?: number
    getItemId: (item: T, index: number) => string
    getItemData: (item: T, index: number) => any
  }
) {
  const [scrollOffset, setScrollOffset] = useState(0)
  const virtualizationEngine = useRef(
    new VirtualizationEngine(
      options.estimatedItemSize || 50,
      options.viewportSize || 600
    )
  )
  
  useEffect(() => {
    virtualizationEngine.current.setScrollOffset(scrollOffset)
  }, [scrollOffset])
  
  const virtualizedProps = useMemo(() => {
    return virtualizationEngine.current.calculateVirtualItems(
      items,
      options.getItemId,
      options.getItemData
    )
  }, [items, scrollOffset, options.getItemId, options.getItemData])
  
  const handleScroll = (event: React.UIEvent<HTMLElement>) => {
    setScrollOffset(event.currentTarget.scrollTop)
  }
  
  const updateItemSize = (itemId: string, size: number) => {
    virtualizationEngine.current.updateItemSize(itemId, size)
  }
  
  return {
    ...virtualizedProps,
    handleScroll,
    updateItemSize,
    engine: virtualizationEngine.current
  }
}

// Advanced color palette virtualization
export interface VirtualColorPaletteProps {
  colors: Array<{ id: string; hex: string; name?: string }>
  containerHeight: number
  itemsPerRow: number
  itemSize: number
  onColorSelect: (color: any) => void
}

export function useVirtualColorPalette(props: VirtualColorPaletteProps) {
  const { colors, containerHeight, itemsPerRow, itemSize, onColorSelect } = props
  
  // Calculate row-based virtualization
  const rows = useMemo(() => {
    const rowArray: Array<{ colors: any[]; index: number }> = []
    
    for (let i = 0; i < colors.length; i += itemsPerRow) {
      rowArray.push({
        colors: colors.slice(i, i + itemsPerRow),
        index: Math.floor(i / itemsPerRow)
      })
    }
    
    return rowArray
  }, [colors, itemsPerRow])
  
  const virtualization = useVirtualization(rows, {
    estimatedItemSize: itemSize,
    viewportSize: containerHeight,
    getItemId: (row, index) => `row-${row.index}`,
    getItemData: (row, index) => row
  })
  
  return {
    ...virtualization,
    itemSize,
    onColorSelect
  }
} 