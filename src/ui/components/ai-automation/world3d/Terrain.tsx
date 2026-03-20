import type { FC } from 'react'
import { TERRAIN_SIZE } from './types'

/** Large flat terrain — uses a single box for performance (not individual blocks) */
export const Terrain: FC = () => (
  <group>
    {/* Grass surface */}
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[TERRAIN_SIZE, 1, TERRAIN_SIZE]} />
      <meshStandardMaterial color="#4a8c38" />
    </mesh>
    {/* Dirt layer below */}
    <mesh position={[0, -1, 0]}>
      <boxGeometry args={[TERRAIN_SIZE, 1, TERRAIN_SIZE]} />
      <meshStandardMaterial color="#6B5A40" />
    </mesh>
  </group>
)
