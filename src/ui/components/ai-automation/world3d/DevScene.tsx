import type { FC } from 'react'
import { Sky, OrbitControls } from '@react-three/drei'
import { DevShowcase } from './DevShowcase'

export const DevScene: FC = () => (
  <>
    <ambientLight intensity={0.6} />
    <directionalLight position={[10, 15, 10]} intensity={0.7} />
    <Sky sunPosition={[100, 60, 80]} />
    <OrbitControls
      target={[15, 2, 15]}
      minDistance={3}
      maxDistance={120}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.3}
      panSpeed={0.5}
    />
    <DevShowcase />
  </>
)
