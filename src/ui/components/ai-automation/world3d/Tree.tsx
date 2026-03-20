import type { FC } from 'react'
import { useMemo } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

interface TreeProps {
  position: [number, number, number]
  height?: number
}

export const Tree: FC<TreeProps> = ({ position, height = 4 }) => {
  const [x, y, z] = position

  const blocks = useMemo(() => {
    const result: JSX.Element[] = []
    let key = 0
    const seed = Math.abs(Math.round(x * 7 + z * 13))

    // Trunk
    for (let h = 0; h < height; h++) {
      result.push(<Block key={key++} type="wood" position={[x, y + h, z]} />)
    }

    // Canopy starts 2 blocks below trunk top and wraps around it
    // Layer 1 (bottom): 5x5 minus corners — starts at trunkTop - 2
    // Layer 2: 5x5 minus corners
    // Layer 3: 3x3
    // Layer 4 (top): 3x3 minus corners or 1x1

    const trunkTop = y + height
    const canopyStart = trunkTop - 2

    // Bottom two layers — wide (5x5 minus corners)
    for (let ly = 0; ly < 2; ly++) {
      for (let lx = -2; lx <= 2; lx++) {
        for (let lz = -2; lz <= 2; lz++) {
          // Skip corners for rounder shape
          if (Math.abs(lx) === 2 && Math.abs(lz) === 2) {
            // Keep some corners randomly
            if (hash(seed + lx, ly + lz) < 0.6) continue
          }
          // Skip trunk position
          if (lx === 0 && lz === 0) continue
          result.push(<Block key={key++} type="leaf" position={[x + lx, canopyStart + ly, z + lz]} />)
        }
      }
    }

    // Upper two layers — narrower (3x3)
    for (let ly = 2; ly < 4; ly++) {
      for (let lx = -1; lx <= 1; lx++) {
        for (let lz = -1; lz <= 1; lz++) {
          // Top layer: skip some corners
          if (ly === 3 && Math.abs(lx) === 1 && Math.abs(lz) === 1) {
            if (hash(seed + lx * 3, lz * 5) < 0.5) continue
          }
          result.push(<Block key={key++} type="leaf" position={[x + lx, canopyStart + ly, z + lz]} />)
        }
      }
    }

    // Random extra bumps on the sides of bottom layers
    for (let ly = 0; ly < 2; ly++) {
      for (let dir = 0; dir < 4; dir++) {
        if (hash(seed + dir * 7, ly * 11) > 0.3) continue
        const dx = dir === 0 ? 3 : dir === 1 ? -3 : (hash(seed, dir) > 0.5 ? 1 : -1)
        const dz = dir === 2 ? 3 : dir === 3 ? -3 : (hash(dir, seed) > 0.5 ? 1 : -1)
        result.push(<Block key={key++} type="leaf" position={[x + dx, canopyStart + ly, z + dz]} />)
      }
    }

    return result
  }, [x, y, z, height])

  return <group>{blocks}</group>
}
