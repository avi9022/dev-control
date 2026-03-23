import type { FC } from 'react'
import { WORLD_COLORS } from './colors'

const CAP_WIDTH = 0.4
const CAP_HEIGHT = 0.1
const CAP_DEPTH = 0.4
const TOP_CAP_Y = 0.35
const HOOK_SIZE = 0.15
const HOOK_HEIGHT = 0.1
const HOOK_Y = 0.45
const BOTTOM_CAP_Y = -0.35
const POST_OFFSET = 0.18
const POST_WIDTH = 0.06
const POST_HEIGHT = 0.6
const GLOW_SIZE = 0.25
const GLOW_HEIGHT = 0.4
const EMISSIVE_INTENSITY = 0.8

interface LanternProps {
  position: [number, number, number]
}

export const Lantern: FC<LanternProps> = ({ position }) => {
  const [x, y, z] = position

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, TOP_CAP_Y, 0]}>
        <boxGeometry args={[CAP_WIDTH, CAP_HEIGHT, CAP_DEPTH]} />
        <meshStandardMaterial color={WORLD_COLORS.IRON_DARK} />
      </mesh>
      <mesh position={[0, HOOK_Y, 0]}>
        <boxGeometry args={[HOOK_SIZE, HOOK_HEIGHT, HOOK_SIZE]} />
        <meshStandardMaterial color={WORLD_COLORS.IRON_LIGHT} />
      </mesh>
      <mesh position={[0, BOTTOM_CAP_Y, 0]}>
        <boxGeometry args={[CAP_WIDTH, CAP_HEIGHT, CAP_DEPTH]} />
        <meshStandardMaterial color={WORLD_COLORS.IRON_DARK} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx * POST_OFFSET, 0, cz * POST_OFFSET]}>
          <boxGeometry args={[POST_WIDTH, POST_HEIGHT, POST_WIDTH]} />
          <meshStandardMaterial color={WORLD_COLORS.IRON_LIGHT} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[GLOW_SIZE, GLOW_HEIGHT, GLOW_SIZE]} />
        <meshStandardMaterial color={WORLD_COLORS.LANTERN_GLOW} emissive={WORLD_COLORS.LANTERN_EMISSIVE} emissiveIntensity={EMISSIVE_INTENSITY} />
      </mesh>
    </group>
  )
}
