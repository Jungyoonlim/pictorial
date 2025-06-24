import { observer } from 'mobx-react-lite'
import { Canvas } from '@/components/canvas/Canvas'
import { Toolbar } from '@/components/ui/Toolbar'
import { ColorPanel } from '@/components/ui/ColorPanel'

export const App = observer(() => {
  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 text-gray-900 font-sans animate-fade-in">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 bg-white border-r border-gray-200 flex items-center justify-center relative">
          {/* Beautiful canvas frame */}
          <div className="absolute inset-10 border-2 border-dashed border-gray-200 rounded-xl pointer-events-none bg-gradient-to-br from-gray-50 to-white"></div>
          {/* Frame label */}
          <div className="absolute bottom-14 left-14 text-gray-400 text-sm font-light pointer-events-none">
            Fram...
          </div>
          <Canvas />
        </div>
        <ColorPanel />
      </div>
    </div>
  )
}) 