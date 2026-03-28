import type { FC, JSX } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

const SAMPLE_RADIUS = 8
const SAMPLE_MAX_HEIGHT = 10
const NOISE_OFFSET = 50
const NOISE_BASE = 0.6
const NOISE_RANGE = 0.4
const DIRT_DEPTH = 2

interface MountainSampleProps {
  position: [number, number, number]
}

export const MountainSample: FC<MountainSampleProps> = ({ position }) => {
  const [ox, oy, oz] = position
  const blocks: JSX.Element[] = []
  let key = 0

  for (let x = -SAMPLE_RADIUS; x <= SAMPLE_RADIUS; x++) {
    for (let z = -SAMPLE_RADIUS; z <= SAMPLE_RADIUS; z++) {
      const dist = Math.sqrt(x * x + z * z) / SAMPLE_RADIUS
      if (dist > 1) continue

      const noise = hash(x + NOISE_OFFSET, z + NOISE_OFFSET) * NOISE_RANGE + NOISE_BASE
      const height = Math.round(SAMPLE_MAX_HEIGHT * (1 - dist) * noise)
      if (height <= 0) continue

      for (let y = 0; y < height; y++) {
        const isTop = y === height - 1
        const isNearTop = y >= height - DIRT_DEPTH
        const type = isTop ? 'grass' : isNearTop ? 'dirt' : 'stone'
        blocks.push(<Block key={key++} type={type} position={[ox + x, oy + y, oz + z]} />)
      }
    }
  }

  return <group>{blocks}</group>
}
