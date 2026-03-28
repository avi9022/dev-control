import { useMemo, type FC } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { Zone, Task3D } from './types'
import { getZonePositions, hash } from './utils'
import { COTTAGE_META, TOWER_META, WORKSHOP_META } from './buildings/buildingMeta'
import { Terrain } from './Terrain'
import { Zones } from './Zones'
import { Mountains } from './Mountains'
import { Trees } from './Trees'
import { Decorations } from './Decorations'

import { SUN_X, SUN_Y, SUN_Z, DIRECTIONAL_INTENSITY, DAMPING_FACTOR, ROTATE_SPEED, PAN_SPEED } from './config'

const AMBIENT_INTENSITY = 0.5
const DIRECTIONAL_X = 30
const DIRECTIONAL_Y = 40
const DIRECTIONAL_Z = 20
const MAX_POLAR_ANGLE_DIVISOR = 2.2
const MIN_POLAR_ANGLE_DIVISOR = 8
const MIN_CAMERA_DISTANCE = 8
const MAX_CAMERA_DISTANCE = 80
const PAN_CLAMP = 50
const ZONE_HASH_SEED_A = 37
const ZONE_HASH_SEED_B = 13

interface SceneProps {
  zones: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

const ALL_METAS = [COTTAGE_META, TOWER_META, WORKSHOP_META]

export const Scene: FC<SceneProps> = ({ zones, tasks, onTaskClick }) => {
  const radii = useMemo(() =>
    zones.map((_, i) => ALL_METAS[Math.floor(hash(i * ZONE_HASH_SEED_A, i * ZONE_HASH_SEED_B) * ALL_METAS.length)].radius),
  [zones])
  const buildingPositions = useMemo(() => getZonePositions(zones.length, radii), [zones.length, radii])

  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight position={[DIRECTIONAL_X, DIRECTIONAL_Y, DIRECTIONAL_Z]} intensity={DIRECTIONAL_INTENSITY} castShadow />
      <Sky sunPosition={[SUN_X, SUN_Y, SUN_Z]} />
      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / MAX_POLAR_ANGLE_DIVISOR}
        minPolarAngle={Math.PI / MIN_POLAR_ANGLE_DIVISOR}
        minDistance={MIN_CAMERA_DISTANCE}
        maxDistance={MAX_CAMERA_DISTANCE}
        enableDamping
        dampingFactor={DAMPING_FACTOR}
        rotateSpeed={ROTATE_SPEED}
        panSpeed={PAN_SPEED}
        onChange={(e) => {
          if (!e) return
          const target = e.target as { target: THREE.Vector3 }
          const t = target.target
          t.x = THREE.MathUtils.clamp(t.x, -PAN_CLAMP, PAN_CLAMP)
          t.z = THREE.MathUtils.clamp(t.z, -PAN_CLAMP, PAN_CLAMP)
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
