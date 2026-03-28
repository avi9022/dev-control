import type { FC, JSX } from 'react'
import { hash } from './utils'

const SEED_HASH_X = 11
const SEED_HASH_Z = 7
const MIN_BLADES = 5
const MAX_EXTRA_BLADES = 6
const MIN_BLADE_HEIGHT = 0.5
const BLADE_HEIGHT_RANGE = 0.6
const BLADE_SPREAD = 0.8
const MAX_TILT = 0.5
const BASE_SHADE = 0.25
const SHADE_RANGE = 0.2
const SHADE_R_SCALE = 180
const SHADE_G_BASE = 120
const SHADE_G_SCALE = 160
const SHADE_B_SCALE = 80
const BLADE_WIDTH = 0.04
const BLADE_Y_RATIO = 0.4
const BLADE_HEIGHT_RATIO = 0.8
const TIP_WIDTH = 0.03
const TIP_Y_RATIO = 0.75
const TIP_HEIGHT_RATIO = 0.3
const TIP_TILT_MULTIPLIER = 1.5
const TIP_OFFSET_MULTIPLIER = 0.3
const TIP_MIN_HEIGHT = 0.7

interface TallGrassProps {
  position: [number, number, number]
}

export const TallGrass: FC<TallGrassProps> = ({ position }) => {
  const [x, y, z] = position
  const seed = Math.abs(Math.round(x * SEED_HASH_X + z * SEED_HASH_Z))
  const bladeCount = MIN_BLADES + Math.floor(hash(seed, 0) * MAX_EXTRA_BLADES)

  const blades: JSX.Element[] = []
  for (let i = 0; i < bladeCount; i++) {
    const h = hash(seed, i)
    const height = MIN_BLADE_HEIGHT + h * BLADE_HEIGHT_RANGE
    const ox = (hash(seed + i, 1) - 0.5) * BLADE_SPREAD
    const oz = (hash(seed + i, 2) - 0.5) * BLADE_SPREAD
    const tiltX = (hash(seed + i, 3) - 0.5) * MAX_TILT
    const tiltZ = (hash(seed + i, 4) - 0.5) * MAX_TILT
    const shade = BASE_SHADE + h * SHADE_RANGE
    const color = `rgb(${Math.round(shade * SHADE_R_SCALE)}, ${Math.round(SHADE_G_BASE + shade * SHADE_G_SCALE)}, ${Math.round(shade * SHADE_B_SCALE)})`

    blades.push(
      <mesh key={`b-${i}`} position={[x + ox, y + height * BLADE_Y_RATIO, z + oz]} rotation={[tiltX, 0, tiltZ]}>
        <boxGeometry args={[BLADE_WIDTH, height * BLADE_HEIGHT_RATIO, BLADE_WIDTH]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )

    if (height > TIP_MIN_HEIGHT) {
      blades.push(
        <mesh key={`t-${i}`} position={[x + ox + tiltZ * TIP_OFFSET_MULTIPLIER, y + height * TIP_Y_RATIO, z + oz + tiltX * TIP_OFFSET_MULTIPLIER]} rotation={[tiltX * TIP_TILT_MULTIPLIER, 0, tiltZ * TIP_TILT_MULTIPLIER]}>
          <boxGeometry args={[TIP_WIDTH, height * TIP_HEIGHT_RATIO, TIP_WIDTH]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )
    }
  }

  return <group>{blades}</group>
}
