import type { FC } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'
import { DevShowcase } from './DevShowcase'
import { SUN_X, SUN_Y, SUN_Z, DIRECTIONAL_INTENSITY, DAMPING_FACTOR, ROTATE_SPEED, PAN_SPEED } from './config'

const AMBIENT_INTENSITY = 0.6
const DIRECTIONAL_X = 10
const DIRECTIONAL_Y = 15
const DIRECTIONAL_Z = 10
const ORBIT_TARGET_X = 15
const ORBIT_TARGET_Y = 2
const ORBIT_TARGET_Z = 15
const MIN_DISTANCE = 3
const MAX_DISTANCE = 120

export const DevScene: FC = () => (
  <>
    <ambientLight intensity={AMBIENT_INTENSITY} />
    <directionalLight position={[DIRECTIONAL_X, DIRECTIONAL_Y, DIRECTIONAL_Z]} intensity={DIRECTIONAL_INTENSITY} />
    <Sky sunPosition={[SUN_X, SUN_Y, SUN_Z]} />
    <OrbitControls
      target={[ORBIT_TARGET_X, ORBIT_TARGET_Y, ORBIT_TARGET_Z]}
      minDistance={MIN_DISTANCE}
      maxDistance={MAX_DISTANCE}
      enableDamping
      dampingFactor={DAMPING_FACTOR}
      rotateSpeed={ROTATE_SPEED}
      panSpeed={PAN_SPEED}
    />
    <DevShowcase />
  </>
)
