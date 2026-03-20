import type { FC } from 'react'
import { TERRAIN_SIZE } from './types'

export const Terrain: FC = () => (
  <mesh position={[0, 0, 0]}>
    <boxGeometry args={[TERRAIN_SIZE, 1, TERRAIN_SIZE]} />
    <meshStandardMaterial color="#4a8c38" />
  </mesh>
)
