import type { FC } from 'react'
import { WORLD_COLORS } from './colors'

const STEM_WIDTH = 0.15
const STEM_HEIGHT = 0.4
const STEM_Y = 0.2
const PETAL_WIDTH = 0.35
const PETAL_HEIGHT = 0.25
const PETAL_DEPTH = 0.35
const PETAL_Y = 0.45
const COLOR_HASH_X = 7
const COLOR_HASH_Z = 13

const FLOWER_COLORS = [
  WORLD_COLORS.FLOWER_RED,
  WORLD_COLORS.FLOWER_YELLOW,
  WORLD_COLORS.FLOWER_WHITE,
  WORLD_COLORS.FLOWER_PURPLE,
  WORLD_COLORS.FLOWER_BLUE,
]

interface FlowerProps {
  position: [number, number, number]
  color?: string
}

export const Flower: FC<FlowerProps> = ({ position, color }) => {
  const [x, y, z] = position
  const flowerColor = color || FLOWER_COLORS[Math.abs(Math.round(x * COLOR_HASH_X + z * COLOR_HASH_Z)) % FLOWER_COLORS.length]

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, STEM_Y, 0]}>
        <boxGeometry args={[STEM_WIDTH, STEM_HEIGHT, STEM_WIDTH]} />
        <meshStandardMaterial color={WORLD_COLORS.STEM_GREEN} />
      </mesh>
      <mesh position={[0, PETAL_Y, 0]}>
        <boxGeometry args={[PETAL_WIDTH, PETAL_HEIGHT, PETAL_DEPTH]} />
        <meshStandardMaterial color={flowerColor} />
      </mesh>
    </group>
  )
}
