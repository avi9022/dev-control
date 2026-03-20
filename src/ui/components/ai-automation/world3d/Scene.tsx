import type { FC } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Zone, Task3D } from './types'
import { FOG_COLOR } from './types'
import { Terrain } from './Terrain'
import { Zones } from './Zones'

interface SceneProps {
  zones: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

export const Scene: FC<SceneProps> = ({ zones, tasks, onTaskClick }) => (
  <>
    <ambientLight intensity={0.5} />
    <directionalLight position={[30, 40, 20]} intensity={0.7} castShadow />
    <fog attach="fog" args={[FOG_COLOR, 60, 120]} />
    <Sky sunPosition={[100, 60, 80]} />
    <OrbitControls
      target={[0, 0, 0]}
      maxPolarAngle={Math.PI / 2.2}
      minPolarAngle={Math.PI / 8}
      minDistance={8}
      maxDistance={50}
      enableDamping
      dampingFactor={0.1}
      onChange={(e) => {
        if (!e) return
        const target = e.target as any
        const t = target.target as THREE.Vector3
        t.x = THREE.MathUtils.clamp(t.x, -30, 30)
        t.z = THREE.MathUtils.clamp(t.z, -25, 25)
      }}
    />
    <Terrain />
    <Zones zones={zones} tasks={tasks} onTaskClick={onTaskClick} />
  </>
)
