import { useMemo, type FC } from 'react'
import { Tree } from './Tree'
import { hash } from './utils'
import { GROUND_Y, PLACEMENT_MULTIPLIER } from './config'

const TREE_COUNT = 10
const MIN_DIST_FROM_BUILDING = 10
const SCATTER_RADIUS = 60
const MIN_TREE_SPACING = 4
const BASE_SCATTER_OFFSET = 8
const MIN_TREE_HEIGHT = 3
const TREE_HEIGHT_RANGE = 4
const ANGLE_HASH_SEED_A = 13
const ANGLE_HASH_SEED_B = 7
const RADIUS_HASH_SEED_A = 3
const RADIUS_HASH_SEED_B = 11

interface TreesProps {
  buildingPositions: [number, number][]
}

interface TreeData {
  pos: [number, number, number]
  height: number
}

export const Trees: FC<TreesProps> = ({ buildingPositions }) => {
  const trees = useMemo(() => {
    const result: TreeData[] = []
    const placed: [number, number][] = []

    for (let i = 0; i < TREE_COUNT * PLACEMENT_MULTIPLIER && result.length < TREE_COUNT; i++) {
      const angle = hash(i * ANGLE_HASH_SEED_A, i * ANGLE_HASH_SEED_B) * Math.PI * 2
      const radius = BASE_SCATTER_OFFSET + hash(i * RADIUS_HASH_SEED_A, i * RADIUS_HASH_SEED_B) * SCATTER_RADIUS
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)

      let tooClose = false
      for (const [bx, bz] of buildingPositions) {
        if (Math.sqrt((x - bx) ** 2 + (z - bz) ** 2) < MIN_DIST_FROM_BUILDING) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      for (const [tx, tz] of placed) {
        if (Math.sqrt((x - tx) ** 2 + (z - tz) ** 2) < MIN_TREE_SPACING) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      placed.push([x, z])

      const height = MIN_TREE_HEIGHT + Math.floor(hash(x, z) * TREE_HEIGHT_RANGE)

      result.push({ pos: [x, GROUND_Y, z], height })
    }

    return result
  }, [buildingPositions])

  return (
    <group>
      {trees.map((tree, i) => (
        <Tree key={i} position={tree.pos} height={tree.height} />
      ))}
    </group>
  )
}
