import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { appStore } from '@/stores/AppStore'
import { motion, AnimatePresence } from 'framer-motion'

export const ColorPanel = observer(() => {
  const { colorStore, isPanelOpen } = appStore
  const [activeTab, setActiveTab] = useState<'picker' | 'harmony' | 'palette' | 'ai'>('palette')
  
  if (!isPanelOpen) return null
  
  const currentColor = colorStore.currentColor
  
  // Sample flower colors to match the screenshot
  const flowerColors = [
    { hex: '#F4D4A7', name: 'Peach Blossom' },
    { hex: '#E8B962', name: 'Golden Honey' },
    { hex: '#FF6B4A', name: 'Coral Red' },
    { hex: '#CC8B5C', name: 'Burnt Orange' },
    { hex: '#8B4A42', name: 'Russet Brown' },
    { hex: '#FFB5A3', name: 'Soft Peach' },
  ]
  
  return (
    <motion.div 
      className="w-80 h-full bg-gray-100 border-l border-gray-200 flex flex-col shadow-xl animate-slide-in-right"
      initial={{ x: 300 }}
      animate={{ x: 0 }}
      exit={{ x: 300 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Header with title */}
      <div className="bg-white px-6 py-5 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-primary-600 flex items-center gap-2">
          🖌️ Side Panel for Color
        </h2>
      </div>
      
      {/* Tabs */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex bg-gray-200 rounded-lg p-1">
          {[
            { id: 'picker' as const, label: 'Picker', icon: '🎨' },
            { id: 'harmony' as const, label: 'Harmony', icon: '🌈' },
            { id: 'palette' as const, label: 'Palette', icon: '🎭' },
            { id: 'ai' as const, label: 'AI', icon: '✨' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'palette' && (
            <motion.div
              key="palette"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Flowers section like in screenshot */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3 bg-gray-200 px-3 py-1 rounded">
                  Flowers
                </h3>
                
                {/* Large gradient swatch */}
                <div className="h-16 mb-4 rounded-lg overflow-hidden shadow-sm">
                  <div 
                    className="w-full h-full"
                    style={{ 
                      background: `linear-gradient(90deg, ${flowerColors[0].hex} 0%, ${flowerColors[1].hex} 100%)`
                    }}
                  />
                </div>
                
                {/* Color swatches grid */}
                <div className="grid grid-cols-2 gap-3">
                  {flowerColors.map((color, index) => (
                    <div
                      key={index}
                      className="h-12 rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105"
                      style={{ backgroundColor: color.hex }}
                      onClick={() => colorStore.setCurrentColor(color.hex)}
                      title={`${color.name} - ${color.hex}`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Color palette from store */}
              {colorStore.colorPalette.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Custom Palette
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {colorStore.colorPalette.map(color => (
                      <div
                        key={color.id}
                        className={`aspect-square rounded-lg cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 ${
                          color.aiGenerated ? 'ring-2 ring-primary-300' : ''
                        }`}
                        style={{ backgroundColor: color.hex }}
                        onClick={() => colorStore.setCurrentColor(color.hex)}
                        title={color.aiGenerated ? `${color.hex} (AI: ${color.confidence?.toFixed(2)})` : color.hex}
                      >
                        {color.aiGenerated && (
                          <div className="absolute top-1 right-1 text-xs">✨</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'picker' && (
            <motion.div
              key="picker"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Current color display */}
              <div className="flex items-center gap-4 p-4 bg-gray-200 rounded-xl">
                <div 
                  className="w-16 h-16 rounded-lg shadow-sm border-2 border-white"
                  style={{ backgroundColor: currentColor.hex }}
                />
                <div className="flex-1">
                  <div className="font-mono text-lg font-medium text-gray-900">
                    {currentColor.hex}
                  </div>
                  <div className="font-mono text-sm text-gray-600">
                    L: {currentColor.lch[0].toFixed(0)} 
                    C: {currentColor.lch[1].toFixed(0)} 
                    H: {currentColor.lch[2].toFixed(0)}°
                  </div>
                </div>
              </div>
              
              {/* Color controls */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Lightness
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentColor.lch[0]}
                    onChange={(e) => {
                      const [, c, h] = currentColor.lch
                      colorStore.setCurrentColorFromLch(+e.target.value, c, h)
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Chroma
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="132"
                    value={currentColor.lch[1]}
                    onChange={(e) => {
                      const [l, , h] = currentColor.lch
                      colorStore.setCurrentColorFromLch(l, +e.target.value, h)
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Hue
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={currentColor.lch[2]}
                    onChange={(e) => {
                      const [l, c] = currentColor.lch
                      colorStore.setCurrentColorFromLch(l, c, +e.target.value)
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer hue-slider"
                    style={{
                      background: 'linear-gradient(to right, hsl(0, 70%, 60%), hsl(60, 70%, 60%), hsl(120, 70%, 60%), hsl(180, 70%, 60%), hsl(240, 70%, 60%), hsl(300, 70%, 60%), hsl(360, 70%, 60%))'
                    }}
                  />
                </div>
              </div>
              
              <button
                className="btn-primary w-full"
                onClick={() => colorStore.addToPalette()}
              >
                Add to Palette
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Bottom toolbar icons */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex justify-center gap-4 text-gray-400">
          <button className="w-8 h-8 flex items-center justify-center hover:text-gray-600 transition-colors">
            🖼️
          </button>
          <button className="w-8 h-8 flex items-center justify-center hover:text-gray-600 transition-colors">
            ⚙️
          </button>
          <button className="w-8 h-8 flex items-center justify-center hover:text-gray-600 transition-colors">
            🎨
          </button>
          <button className="w-8 h-8 flex items-center justify-center hover:text-gray-600 transition-colors">
            📐
          </button>
        </div>
      </div>
    </motion.div>
  )
}) 