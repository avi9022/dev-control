import type { FC, JSX } from 'react'
import { useMemo } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

const SEED_HASH_X = 7
const SEED_HASH_Z = 13
const DEFAULT_HEIGHT = 4
const CANOPY_START_OFFSET = 2
const WIDE_CANOPY_LAYERS = 2
const WIDE_CANOPY_RADIUS = 2
const NARROW_CANOPY_LAYERS_START = 2
const NARROW_CANOPY_LAYERS_END = 4
const NARROW_CANOPY_RADIUS = 1
const CORNER_SKIP_THRESHOLD = 0.6
const TOP_CORNER_SKIP_THRESHOLD = 0.5
const BUMP_SKIP_THRESHOLD = 0.3
const BUMP_OFFSET = 3
const DIRECTION_COUNT = 4
const BUMP_LAYERS = 2
const TOP_CANOPY_LAYER = 3
const HASH_SCALE_X = 3
const HASH_SCALE_Z = 5

interface TreeProps {
  position: [number, number, number]
  height?: number
}

export const Tree: FC<TreeProps> = ({ position, height = DEFAULT_HEIGHT }) => {
  const [x, y, z] = position

  const blocks = useMemo(() => {
    const result: JSX.Element[] = []
    let key = 0
    const seed = Math.abs(Math.round(x * SEED_HASH_X + z * SEED_HASH_Z))

    for (let h = 0; h < height; h++) {
      result.push(<Block key={key++} type="wood" position={[x, y + h, z]} />)
    }

    const trunkTop = y + height
    const canopyStart = trunkTop - CANOPY_START_OFFSET

    for (let ly = 0; ly < WIDE_CANOPY_LAYERS; ly++) {
      for (let lx = -WIDE_CANOPY_RADIUS; lx <= WIDE_CANOPY_RADIUS; lx++) {
        for (let lz = -WIDE_CANOPY_RADIUS; lz <= WIDE_CANOPY_RADIUS; lz++) {
          if (Math.abs(lx) === WIDE_CANOPY_RADIUS && Math.abs(lz) === WIDE_CANOPY_RADIUS) {
            if (hash(seed + lx, ly + lz) < CORNER_SKIP_THRESHOLD) continue
          }
          if (lx === 0 && lz === 0) continue
          result.push(<Block key={key++} type="leaf" position={[x + lx, canopyStart + ly, z + lz]} />)
        }
      }
    }

    for (let ly = NARROW_CANOPY_LAYERS_START; ly < NARROW_CANOPY_LAYERS_END; ly++) {
      for (let lx = -NARROW_CANOPY_RADIUS; lx <= NARROW_CANOPY_RADIUS; lx++) {
        for (let lz = -NARROW_CANOPY_RADIUS; lz <= NARROW_CANOPY_RADIUS; lz++) {
          if (ly === TOP_CANOPY_LAYER && Math.abs(lx) === 1 && Math.abs(lz) === 1) {
            if (hash(seed + lx * HASH_SCALE_X, lz * HASH_SCALE_Z) < TOP_CORNER_SKIP_THRESHOLD) continue
          }
          result.push(<Block key={key++} type="leaf" position={[x + lx, canopyStart + ly, z + lz]} />)
        }
      }
    }

    for (let ly = 0; ly < BUMP_LAYERS; ly++) {
      for (let dir = 0; dir < DIRECTION_COUNT; dir++) {
        if (hash(seed + dir * SEED_HASH_X, ly * SEED_HASH_X) > BUMP_SKIP_THRESHOLD) continue
        const dx = dir === 0 ? BUMP_OFFSET : dir === 1 ? -BUMP_OFFSET : (hash(seed, dir) > TOP_CORNER_SKIP_THRESHOLD ? 1 : -1)
        const dz = dir === 2 ? BUMP_OFFSET : dir === 3 ? -BUMP_OFFSET : (hash(dir, seed) > TOP_CORNER_SKIP_THRESHOLD ? 1 : -1)
        result.push(<Block key={key++} type="leaf" position={[x + dx, canopyStart + ly, z + dz]} />)
      }
    }

    return result
  }, [x, y, z, height])

  return <group>{blocks}</group>
}
