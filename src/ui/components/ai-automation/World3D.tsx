import { useState, type FC } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './world3d/Scene'
import { DevScene } from './world3d/DevScene'
import { SKY_COLOR } from './world3d/types'
import type { Zone, Task3D } from './world3d/types'

export type { Zone, Task3D }

interface World3DProps {
  zones?: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

const DEFAULT_ZONES: Zone[] = [
  { id: 'BACKLOG', label: 'Backlog' },
  { id: 'DONE', label: 'Done' },
]

export const World3D: FC<World3DProps> = ({ zones = DEFAULT_ZONES, tasks, onTaskClick }) => {
  const [devMode, setDevMode] = useState(false)

  return (
    <div className="h-full w-full relative" style={{ background: SKY_COLOR }}>
      <Canvas
        camera={{
          position: devMode ? [15, 12, 30] : [30, 25, 35],
          fov: 50,
          near: 0.1,
          far: 300,
        }}
      >
        {devMode ? <DevScene /> : <Scene zones={zones} tasks={tasks} onTaskClick={onTaskClick} />}
      </Canvas>

      <button
        onClick={() => setDevMode(!devMode)}
        className="absolute bottom-3 left-3 px-2 py-1 rounded text-[10px] font-mono transition-colors"
        style={{
          background: devMode ? 'var(--ai-accent)' : 'var(--ai-surface-2)',
          color: devMode ? 'var(--ai-surface-0)' : 'var(--ai-text-tertiary)',
          border: '1px solid var(--ai-border-subtle)',
        }}
      >
        DEV
      </button>
    </div>
  )
}
