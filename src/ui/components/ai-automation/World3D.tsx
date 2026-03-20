import type { FC } from 'react'
import { Canvas } from '@react-three/fiber'
import { Scene } from './world3d/Scene'
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

export const World3D: FC<World3DProps> = ({ zones = DEFAULT_ZONES, tasks, onTaskClick }) => (
  <div className="h-full w-full" style={{ background: SKY_COLOR }}>
    <Canvas
      camera={{
        position: [30, 25, 35],
        fov: 50,
        near: 0.1,
        far: 300,
      }}
    >
      <Scene zones={zones} tasks={tasks} onTaskClick={onTaskClick} />
    </Canvas>
  </div>
)
