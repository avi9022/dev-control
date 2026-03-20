import type { FC } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

interface MountainSampleProps {
  position: [number, number, number]
}

/** A small isolated mountain for dev showcase inspection */
export const MountainSample: FC<MountainSampleProps> = ({ position }) => {
  const [ox, oy, oz] = position
  const blocks: JSX.Element[] = []
  let key = 0
  const size = 8
  const maxHeight = 10

  for (let x = -size; x <= size; x++) {
    for (let z = -size; z <= size; z++) {
      const dist = Math.sqrt(x * x + z * z) / size
      if (dist > 1) continue

      const noise = hash(x + 50, z + 50) * 0.4 + 0.6
      const height = Math.round(maxHeight * (1 - dist) * noise)
      if (height <= 0) continue

      for (let y = 0; y < height; y++) {
        const isTop = y === height - 1
        const isNearTop = y >= height - 2
        const type = isTop ? 'grass' : isNearTop ? 'dirt' : 'stone'
        blocks.push(<Block key={key++} type={type} position={[ox + x, oy + y, oz + z]} />)
      }
    }
  }

  return <group>{blocks}</group>
}
