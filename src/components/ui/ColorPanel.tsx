import { useState } from 'react'
import { observer } from 'mobx-react-lite'
import { appStore } from '@/stores/AppStore'
import { motion, AnimatePresence } from 'framer-motion'
import './ColorPanel.css'

export const ColorPanel = observer(() => {
  const { colorStore, isPanelOpen } = appStore
  const [activeTab, setActiveTab] = useState<'picker' | 'harmony' | 'palette' | 'ai'>('picker')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiStyle, setAiStyle] = useState<'vibrant' | 'muted' | 'pastel' | 'monochrome' | 'neon'>('vibrant')
  
  if (!isPanelOpen) return null
  
  const currentColor = colorStore.currentColor
  
  return (
    <motion.div 
      className="color-panel"
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
          
          {activeTab === 'harmony' && (
            <motion.div
              key="harmony"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="color-harmony"
            >
              {['analogous', 'complement', 'triadic', 'split-complement'].map(type => (
                <div key={type} className="color-harmony__group">
                  <div className="color-harmony__label">
                    {type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')}
                  </div>
                  <div className="color-harmony__swatches">
                    {colorStore.generateHarmony(type as any).map((color, index) => (
                      <div
                        key={`${type}-${index}`}
                        className="color-harmony__swatch"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => colorStore.setCurrentColor(color.hex)}
                        title={color.hex}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
          
          {activeTab === 'palette' && (
            <motion.div
              key="palette"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="color-palette"
            >
              <div className="color-palette__grid">
                {colorStore.colorPalette.map(color => (
                  <div
                    key={color.id}
                    className={`color-palette__swatch ${color.aiGenerated ? 'color-palette__swatch--ai' : ''}`}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => colorStore.setCurrentColor(color.hex)}
                    title={color.aiGenerated ? `${color.hex} (AI: ${color.confidence?.toFixed(2)})` : color.hex}
                  >
                    {color.aiGenerated && (
                      <div className="color-palette__ai-badge">✨</div>
                    )}
                  </div>
                ))}
              </div>
              
              {colorStore.colorPalette.length === 0 && (
                <div className="color-palette__empty">
                  No colors in palette yet. Add some from the picker!
                </div>
              )}
            </motion.div>
          )}
          
          {activeTab === 'ai' && (
            <motion.div
              key="ai"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="ai-generator"
            >
              <div className="ai-generator__status">
                <div className={`ai-status ai-status--${colorStore.getAIStatus()}`}>
                  {colorStore.getAIStatus() === 'initializing' && '🔄 Initializing AI...'}
                  {colorStore.getAIStatus() === 'ready' && '🎨 Ready to generate'}
                  {colorStore.getAIStatus() === 'generating' && '✨ Generating colors...'}
                  {colorStore.getAIStatus() === 'error' && '❌ Error'}
                </div>
              </div>
              
              <div className="ai-generator__form">
                <div className="ai-generator__field">
                  <label>Describe your vision</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="sunset over the ocean, vibrant and warm..."
                    className="ai-generator__prompt"
                    rows={3}
                  />
                </div>
                
                <div className="ai-generator__field">
                  <label>Style</label>
                  <select
                    value={aiStyle}
                    onChange={(e) => setAiStyle(e.target.value as any)}
                    className="ai-generator__style"
                  >
                    <option value="vibrant">Vibrant</option>
                    <option value="muted">Muted</option>
                    <option value="pastel">Pastel</option>
                    <option value="monochrome">Monochrome</option>
                    <option value="neon">Neon</option>
                  </select>
                </div>
                
                <button
                  className="ai-generator__generate"
                  onClick={() => aiPrompt.trim() && colorStore.generateFromText(aiPrompt, aiStyle)}
                  disabled={!aiPrompt.trim() || colorStore.isGenerating || colorStore.getAIStatus() !== 'ready'}
                >
                  {colorStore.isGenerating ? '✨ Generating...' : '🎨 Generate Colors'}
                </button>
              </div>
              
              {colorStore.lastGeneratedColors.length > 0 && (
                <div className="ai-generator__results">
                  <div className="ai-generator__label">Generated Colors</div>
                  <div className="ai-generator__swatches">
                    {colorStore.lastGeneratedColors.map(color => (
                      <div
                        key={color.id}
                        className="ai-generator__swatch"
                        style={{ backgroundColor: color.hex }}
                        onClick={() => colorStore.setCurrentColor(color.hex)}
                        title={`${color.hex}\nConfidence: ${color.confidence?.toFixed(2)}\n${color.reasoning}`}
                      >
                        <div className="ai-generator__confidence">
                          {Math.round((color.confidence || 0) * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="ai-generator__actions">
                    <button
                      className="ai-generator__action"
                      onClick={() => colorStore.addGeneratedToPalette()}
                    >
                      Add All to Palette
                    </button>
                    <button
                      className="ai-generator__action ai-generator__action--secondary"
                      onClick={() => colorStore.clearGenerated()}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}) 