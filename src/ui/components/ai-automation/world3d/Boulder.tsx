import type { FC, JSX } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

interface BoulderProps {
  position: [number, number, number]
  size?: 'small' | 'medium' | 'large'
}

export const Boulder: FC<BoulderProps> = ({ position, size = 'medium' }) => {
  const [x, y, z] = position
  const seed = Math.abs(Math.round(x * 11 + z * 17))
  const blocks: JSX.Element[] = []
  let key = 0

  const b = (bx: number, by: number, bz: number) => {
    blocks.push(<Block key={key++} type="stone" position={[x + bx, y + by, z + bz]} />)
  }

  if (size === 'small') {
    // 3x3 base, 2 layers
    for (let bx = 0; bx < 3; bx++)
      for (let bz = 0; bz < 3; bz++)
        b(bx, 0, bz)
    for (let bx = 0; bx < 3; bx++)
      for (let bz = 0; bz < 3; bz++) {
        if (Math.abs(bx - 1) === 1 && Math.abs(bz - 1) === 1 && hash(seed + bx, bz) < 0.4) continue
        b(bx, 1, bz)
      }
    b(1, 2, 1)
    if (hash(seed, 10) > 0.5) b(0, 2, 1)

  } else if (size === 'medium') {
    // 5x5 base, 4 layers
    for (let bx = 0; bx < 5; bx++)
      for (let bz = 0; bz < 5; bz++) {
        if ((bx === 0 || bx === 4) && (bz === 0 || bz === 4)) continue // round corners
        b(bx, 0, bz)
      }
    for (let bx = 0; bx < 5; bx++)
      for (let bz = 0; bz < 5; bz++) {
        if ((bx === 0 || bx === 4) && (bz === 0 || bz === 4)) continue
        if ((bx === 0 || bx === 4 || bz === 0 || bz === 4) && hash(seed + bx, bz + 20) < 0.3) continue
        b(bx, 1, bz)
      }
    for (let bx = 1; bx < 4; bx++)
      for (let bz = 1; bz < 4; bz++)
        b(bx, 2, bz)
    b(2, 3, 2)
    if (hash(seed, 5) > 0.3) b(1, 3, 2)
    if (hash(seed, 6) > 0.3) b(2, 3, 1)

  } else {
    // 7x7 base, 5 layers
    for (let bx = 0; bx < 7; bx++)
      for (let bz = 0; bz < 7; bz++) {
        const corner = (bx === 0 || bx === 6) && (bz === 0 || bz === 6)
        const nearCorner = (bx <= 1 || bx >= 5) && (bz <= 1 || bz >= 5) && (bx === 0 || bx === 6 || bz === 0 || bz === 6)
        if (corner) continue
        if (nearCorner && hash(seed + bx, bz + 30) < 0.3) continue
        b(bx, 0, bz)
      }
    // Layer 2 — 6x6ish
    for (let bx = 0; bx < 7; bx++)
      for (let bz = 0; bz < 7; bz++) {
        if ((bx === 0 || bx === 6) || (bz === 0 || bz === 6)) {
          if (hash(seed + bx + 10, bz + 10) < 0.5) continue
        }
        if ((bx === 0 || bx === 6) && (bz === 0 || bz === 6)) continue
        b(bx, 1, bz)
      }
    // Layer 3 — 5x5
    for (let bx = 1; bx < 6; bx++)
      for (let bz = 1; bz < 6; bz++) {
        if ((bx === 1 || bx === 5) && (bz === 1 || bz === 5) && hash(seed + bx, bz + 40) < 0.4) continue
        b(bx, 2, bz)
      }
    // Layer 4 — 3x3
    for (let bx = 2; bx < 5; bx++)
      for (let bz = 2; bz < 5; bz++)
        b(bx, 3, bz)
    // Top
    b(3, 4, 3)
    if (hash(seed, 7) > 0.3) b(2, 4, 3)
    if (hash(seed, 8) > 0.3) b(3, 4, 2)
    if (hash(seed, 9) > 0.4) b(3, 4, 4)
  }

  return <group>{blocks}</group>
}
