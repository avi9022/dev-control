import type { FC, JSX } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

const SEED_HASH_X = 11
const SEED_HASH_Z = 17
const CORNER_SKIP_THRESHOLD = 0.4
const EDGE_SKIP_THRESHOLD = 0.3
const TOP_EXTRA_THRESHOLD = 0.5
const TOP_EXTRA_MEDIUM_THRESHOLD = 0.3
const TOP_EXTRA_LARGE_THRESHOLD = 0.4
const NEAR_CORNER_LARGE_THRESHOLD = 0.3
const OUTER_LARGE_SKIP_THRESHOLD = 0.5

const SMALL_GRID = 3
const MEDIUM_GRID = 5
const LARGE_GRID = 7

const HASH_SLOT_SMALL_EXTRA = 10
const HASH_SLOT_MEDIUM_EXTRA_A = 5
const HASH_SLOT_MEDIUM_EXTRA_B = 6
const HASH_SLOT_LARGE_EXTRA_A = 7
const HASH_SLOT_LARGE_EXTRA_B = 8
const HASH_SLOT_LARGE_EXTRA_C = 9
const HASH_OFFSET_MEDIUM = 20
const HASH_OFFSET_LARGE_NEAR = 30
const HASH_OFFSET_LARGE_OUTER = 10
const HASH_OFFSET_LARGE_L2 = 40

const SMALL_CENTER = 1
const MEDIUM_CENTER = 2
const MEDIUM_INNER_START = 1
const MEDIUM_INNER_END = 4
const LARGE_CENTER = 3
const LARGE_INNER_START = 1
const LARGE_INNER_END = 6
const LARGE_CORE_START = 2
const LARGE_CORE_END = 5

const LAYER_Y2 = 2
const LAYER_Y3 = 3
const LAYER_Y4 = 4

interface BoulderProps {
  position: [number, number, number]
  size?: 'small' | 'medium' | 'large'
}

export const Boulder: FC<BoulderProps> = ({ position, size = 'medium' }) => {
  const [x, y, z] = position
  const seed = Math.abs(Math.round(x * SEED_HASH_X + z * SEED_HASH_Z))
  const blocks: JSX.Element[] = []
  let key = 0

  const b = (bx: number, by: number, bz: number) => {
    blocks.push(<Block key={key++} type="stone" position={[x + bx, y + by, z + bz]} />)
  }

  if (size === 'small') {
    for (let bx = 0; bx < SMALL_GRID; bx++)
      for (let bz = 0; bz < SMALL_GRID; bz++)
        b(bx, 0, bz)
    for (let bx = 0; bx < SMALL_GRID; bx++)
      for (let bz = 0; bz < SMALL_GRID; bz++) {
        if (Math.abs(bx - SMALL_CENTER) === 1 && Math.abs(bz - SMALL_CENTER) === 1 && hash(seed + bx, bz) < CORNER_SKIP_THRESHOLD) continue
        b(bx, 1, bz)
      }
    b(SMALL_CENTER, LAYER_Y2, SMALL_CENTER)
    if (hash(seed, HASH_SLOT_SMALL_EXTRA) > TOP_EXTRA_THRESHOLD) b(0, LAYER_Y2, SMALL_CENTER)

  } else if (size === 'medium') {
    const last = MEDIUM_GRID - 1
    for (let bx = 0; bx < MEDIUM_GRID; bx++)
      for (let bz = 0; bz < MEDIUM_GRID; bz++) {
        if ((bx === 0 || bx === last) && (bz === 0 || bz === last)) continue
        b(bx, 0, bz)
      }
    for (let bx = 0; bx < MEDIUM_GRID; bx++)
      for (let bz = 0; bz < MEDIUM_GRID; bz++) {
        if ((bx === 0 || bx === last) && (bz === 0 || bz === last)) continue
        if ((bx === 0 || bx === last || bz === 0 || bz === last) && hash(seed + bx, bz + HASH_OFFSET_MEDIUM) < EDGE_SKIP_THRESHOLD) continue
        b(bx, 1, bz)
      }
    for (let bx = MEDIUM_INNER_START; bx < MEDIUM_INNER_END; bx++)
      for (let bz = MEDIUM_INNER_START; bz < MEDIUM_INNER_END; bz++)
        b(bx, LAYER_Y2, bz)
    b(MEDIUM_CENTER, LAYER_Y3, MEDIUM_CENTER)
    if (hash(seed, HASH_SLOT_MEDIUM_EXTRA_A) > TOP_EXTRA_MEDIUM_THRESHOLD) b(MEDIUM_INNER_START, LAYER_Y3, MEDIUM_CENTER)
    if (hash(seed, HASH_SLOT_MEDIUM_EXTRA_B) > TOP_EXTRA_MEDIUM_THRESHOLD) b(MEDIUM_CENTER, LAYER_Y3, MEDIUM_INNER_START)

  } else {
    const last = LARGE_GRID - 1
    for (let bx = 0; bx < LARGE_GRID; bx++)
      for (let bz = 0; bz < LARGE_GRID; bz++) {
        const corner = (bx === 0 || bx === last) && (bz === 0 || bz === last)
        const nearCorner = (bx <= LARGE_INNER_START || bx >= LARGE_INNER_END) && (bz <= LARGE_INNER_START || bz >= LARGE_INNER_END) && (bx === 0 || bx === last || bz === 0 || bz === last)
        if (corner) continue
        if (nearCorner && hash(seed + bx, bz + HASH_OFFSET_LARGE_NEAR) < NEAR_CORNER_LARGE_THRESHOLD) continue
        b(bx, 0, bz)
      }
    for (let bx = 0; bx < LARGE_GRID; bx++)
      for (let bz = 0; bz < LARGE_GRID; bz++) {
        if ((bx === 0 || bx === last) || (bz === 0 || bz === last)) {
          if (hash(seed + bx + HASH_OFFSET_LARGE_OUTER, bz + HASH_OFFSET_LARGE_OUTER) < OUTER_LARGE_SKIP_THRESHOLD) continue
        }
        if ((bx === 0 || bx === last) && (bz === 0 || bz === last)) continue
        b(bx, 1, bz)
      }
    for (let bx = LARGE_INNER_START; bx < LARGE_INNER_END; bx++)
      for (let bz = LARGE_INNER_START; bz < LARGE_INNER_END; bz++) {
        if ((bx === LARGE_INNER_START || bx === LARGE_INNER_END - 1) && (bz === LARGE_INNER_START || bz === LARGE_INNER_END - 1) && hash(seed + bx, bz + HASH_OFFSET_LARGE_L2) < CORNER_SKIP_THRESHOLD) continue
        b(bx, LAYER_Y2, bz)
      }
    for (let bx = LARGE_CORE_START; bx < LARGE_CORE_END; bx++)
      for (let bz = LARGE_CORE_START; bz < LARGE_CORE_END; bz++)
        b(bx, LAYER_Y3, bz)
    b(LARGE_CENTER, LAYER_Y4, LARGE_CENTER)
    if (hash(seed, HASH_SLOT_LARGE_EXTRA_A) > TOP_EXTRA_MEDIUM_THRESHOLD) b(LARGE_CORE_START, LAYER_Y4, LARGE_CENTER)
    if (hash(seed, HASH_SLOT_LARGE_EXTRA_B) > TOP_EXTRA_MEDIUM_THRESHOLD) b(LARGE_CENTER, LAYER_Y4, LARGE_CORE_START)
    if (hash(seed, HASH_SLOT_LARGE_EXTRA_C) > TOP_EXTRA_LARGE_THRESHOLD) b(LARGE_CENTER, LAYER_Y4, LARGE_CORE_END - 1)
  }

  return <group>{blocks}</group>
}
