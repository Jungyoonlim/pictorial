import { useState, useCallback, useMemo, useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { motion, AnimatePresence } from 'framer-motion'
import { enhancedAppStore } from '@/stores/EnhancedAppStore'
import { FixedSizeGrid as Grid } from 'react-window'
import './ColorPanel.css'

// High-performance color swatch component
const VirtualColorSwatch = ({ columnIndex, rowIndex, style, data }: any) => {
  const { colors, onColorSelect, itemsPerRow } = data
  const index = rowIndex * itemsPerRow + columnIndex
  const color = colors[index]
  
  if (!color) return null
  
  return (
    <div style={style} className="virtual-color-swatch-container">
      <motion.div
        className={`virtual-color-swatch ${color.aiGenerated ? 'virtual-color-swatch--ai' : ''}`}
        style={{ backgroundColor: color.hex }}
        onClick={() => onColorSelect(color)}
        whileHover={{ scale: 1.1, zIndex: 10 }}
        whileTap={{ scale: 0.95 }}
        title={color.aiGenerated ? `${color.hex} (AI: ${color.confidence?.toFixed(2)})` : color.hex}
        layoutId={`color-${color.id}`}
      >
        {color.aiGenerated && (
          <div className="virtual-color-swatch__ai-badge">✨</div>
        )}
        <div className="virtual-color-swatch__info">
          <span className="virtual-color-swatch__hex">{color.hex}</span>
        </div>
      </motion.div>
    </div>
  )
}

export const VirtualizedColorPanel = observer(() => {
  const { colorStore, isPanelOpen } = enhancedAppStore
  const [activeTab, setActiveTab] = useState<'picker' | 'harmony' | 'palette' | 'ai' | 'library'>('picker')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiStyle, setAiStyle] = useState<'vibrant' | 'muted' | 'pastel' | 'monochrome' | 'neon'>('vibrant')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  
  const gridRef = useRef<any>()
  
  if (!isPanelOpen) return null
  
  const currentColor = colorStore.currentColor
  
  // Virtualization settings
  const ITEM_SIZE = 64
  const ITEMS_PER_ROW = 8
  const CONTAINER_HEIGHT = 400
  
  // Filter and search colors
  const filteredColors = useMemo(() => {
    let colors = colorStore.colorPalette
    
    if (searchQuery) {
      colors = colors.filter(color => 
        color.hex.toLowerCase().includes(searchQuery.toLowerCase()) ||
        color.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    if (filterTags.length > 0) {
      colors = colors.filter(color => 
        color.tags?.some(tag => filterTags.includes(tag))
      )
    }
    
    return colors
  }, [colorStore.colorPalette, searchQuery, filterTags])
  
  // Calculate grid dimensions
  const { columnCount, rowCount } = useMemo(() => {
    const columnCount = ITEMS_PER_ROW
    const rowCount = Math.ceil(filteredColors.length / ITEMS_PER_ROW)
    return { columnCount, rowCount }
  }, [filteredColors.length])
  
  const handleColorSelect = useCallback((color: any) => {
    colorStore.setCurrentColor(color.hex)
  }, [colorStore])
  
  const gridItemData = useMemo(() => ({
    colors: filteredColors,
    itemSize: ITEM_SIZE,
    onColorSelect: handleColorSelect,
    itemsPerRow: ITEMS_PER_ROW
  }), [filteredColors, handleColorSelect])
  
  // Advanced search and filter functions
  const handleTagFilter = useCallback((tag: string) => {
    setFilterTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }, [])
  
  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setFilterTags([])
  }, [])
  
  // Get available tags from colors
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    colorStore.colorPalette.forEach(color => {
      color.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags)
  }, [colorStore.colorPalette])
  
  return (
    <motion.div 
      className="color-panel color-panel--virtualized"
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      exit={{ x: 300 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      <div className="color-panel__header">
        <div className="color-panel__tabs">
          {[
            { id: 'picker' as const, label: 'Picker', icon: '🎨' },
            { id: 'harmony' as const, label: 'Harmony', icon: '🌈' },
            { id: 'palette' as const, label: 'Palette', icon: '🎭' },
            { id: 'ai' as const, label: 'AI', icon: '✨' },
            { id: 'library' as const, label: 'Library', icon: '📚' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`color-panel__tab ${activeTab === tab.id ? 'color-panel__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="color-panel__tab-icon">{tab.icon}</span>
              <span className="color-panel__tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div className="color-panel__content">
        <AnimatePresence mode="wait">
          {activeTab === 'picker' && (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="color-picker"
            >
              <div className="color-picker__current">
                <div 
                  className="color-picker__swatch"
                  style={{ backgroundColor: currentColor.hex }}
                />
                <div className="color-picker__info">
                  <div className="color-picker__hex">{currentColor.hex}</div>
                  <div className="color-picker__lch">
                    L: {currentColor.lch[0].toFixed(0)} 
                    C: {currentColor.lch[1].toFixed(0)} 
                    H: {currentColor.lch[2].toFixed(0)}°
                  </div>
                </div>
              </div>
              
              <div className="color-picker__controls">
                <div className="color-picker__control">
                  <label>Lightness</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentColor.lch[0]}
                    onChange={(e) => {
                      const [, c, h] = currentColor.lch
                      colorStore.setCurrentColorFromLch(+e.target.value, c, h)
                    }}
                    className="color-picker__slider"
                  />
                </div>
                
                <div className="color-picker__control">
                  <label>Chroma</label>
                  <input
                    type="range"
                    min="0"
                    max="132"
                    value={currentColor.lch[1]}
                    onChange={(e) => {
                      const [l, , h] = currentColor.lch
                      colorStore.setCurrentColorFromLch(l, +e.target.value, h)
                    }}
                    className="color-picker__slider"
                  />
                </div>
                
                <div className="color-picker__control">
                  <label>Hue</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={currentColor.lch[2]}
                    onChange={(e) => {
                      const [l, c] = currentColor.lch
                      colorStore.setCurrentColorFromLch(l, c, +e.target.value)
                    }}
                    className="color-picker__slider color-picker__slider--hue"
                  />
                </div>
              </div>
              
              <button
                className="color-picker__add"
                onClick={() => colorStore.addToPalette()}
              >
                Add to Palette
              </button>
            </motion.div>
          )}
          
          {activeTab === 'palette' && (
            <motion.div
              key="palette"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="color-palette color-palette--virtualized"
            >
              <div className="color-palette__controls">
                <div className="color-palette__search">
                  <input
                    type="text"
                    placeholder="Search colors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="color-palette__search-input"
                  />
                  <button 
                    onClick={clearFilters}
                    className="color-palette__clear"
                  >
                    Clear
                  </button>
                </div>
                
                {availableTags.length > 0 && (
                  <div className="color-palette__tags">
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        className={`color-palette__tag ${filterTags.includes(tag) ? 'color-palette__tag--active' : ''}`}
                        onClick={() => handleTagFilter(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="color-palette__stats">
                  Showing {filteredColors.length} of {colorStore.colorPalette.length} colors
                </div>
              </div>
              
              <div className="color-palette__grid-container" style={{ height: CONTAINER_HEIGHT }}>
                {filteredColors.length > 0 ? (
                  <div style={{ height: '100%', width: '100%' }}>
                    <Grid
                      ref={gridRef}
                      columnCount={columnCount}
                      rowCount={rowCount}
                      columnWidth={ITEM_SIZE}
                      rowHeight={ITEM_SIZE}
                      width={480}
                      height={CONTAINER_HEIGHT}
                      itemData={gridItemData}
                      overscanRowCount={2}
                      overscanColumnCount={2}
                    >
                      {VirtualColorSwatch}
                    </Grid>
                  </div>
                ) : (
                  <div className="color-palette__empty">
                    {searchQuery || filterTags.length > 0 
                      ? 'No colors match your filters' 
                      : 'No colors in palette yet. Add some from the picker!'
                    }
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}) 