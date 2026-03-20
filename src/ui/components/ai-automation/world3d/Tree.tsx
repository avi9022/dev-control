import type { FC } from 'react'
import { Block } from './blocks'

interface TreeProps {
  position: [number, number, number]
  height?: number
}

export const Tree: FC<TreeProps> = ({ position, height = 4 }) => {
  const [x, y, z] = position
  const blocks: JSX.Element[] = []
  let key = 0

  // Trunk
  for (let h = 0; h < height; h++) {
    blocks.push(<Block key={key++} type="wood" position={[x, y + h, z]} />)
  }

  // Leaf canopy — sphere-ish cluster on top
  const canopyBase = y + height - 1
  const radius = height > 3 ? 2 : 1

  for (let lx = -radius; lx <= radius; lx++) {
    for (let lz = -radius; lz <= radius; lz++) {
      for (let ly = 0; ly <= radius; ly++) {
        // Rough sphere shape
        const dist = Math.sqrt(lx * lx + lz * lz + (ly - radius * 0.5) ** 2)
        if (dist > radius + 0.5) continue
        // Skip trunk position in canopy
        if (lx === 0 && lz === 0 && ly < radius) continue

        blocks.push(<Block key={key++} type="leaf" position={[x + lx, canopyBase + ly, z + lz]} />)
      }
    }
  }

  return <group>{blocks}</group>
}
