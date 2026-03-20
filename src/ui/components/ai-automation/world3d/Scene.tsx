import { useMemo, type FC } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Zone, Task3D } from './types'
import { getZonePositions } from './utils'
import { Terrain } from './Terrain'
import { Zones } from './Zones'
import { Mountains } from './Mountains'
import { Trees } from './Trees'
import { Decorations } from './Decorations'

interface SceneProps {
  zones: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

export const Scene: FC<SceneProps> = ({ zones, tasks, onTaskClick }) => {
  const buildingPositions = useMemo(() => getZonePositions(zones.length), [zones.length])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[30, 40, 20]} intensity={0.7} castShadow />
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
      <Mountains />
      <Trees buildingPositions={buildingPositions} />
      <Decorations buildingPositions={buildingPositions} />
      <Zones zones={zones} tasks={tasks} onTaskClick={onTaskClick} />
    </>
  )
}
