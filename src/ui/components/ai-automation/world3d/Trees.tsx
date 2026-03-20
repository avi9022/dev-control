import { useMemo, type FC } from 'react'
import { Tree } from './Tree'
import { hash } from './utils'

interface TreesProps {
  /** Zone building positions to avoid */
  buildingPositions: [number, number][]
}

const TREE_COUNT = 15
const MIN_DIST_FROM_BUILDING = 10
const SCATTER_RADIUS = 60

interface TreeData {
  pos: [number, number, number]
  height: number
}

export const Trees: FC<TreesProps> = ({ buildingPositions }) => {
  const trees = useMemo(() => {
    const result: TreeData[] = []
    const placed: [number, number][] = []

    for (let i = 0; i < TREE_COUNT * 3 && result.length < TREE_COUNT; i++) {
      const angle = hash(i * 13, i * 7) * Math.PI * 2
      const radius = 8 + hash(i * 3, i * 11) * SCATTER_RADIUS
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)

      // Avoid buildings
      let tooClose = false
      for (const [bx, bz] of buildingPositions) {
        if (Math.sqrt((x - bx) ** 2 + (z - bz) ** 2) < MIN_DIST_FROM_BUILDING) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      // Avoid other trees
      for (const [tx, tz] of placed) {
        if (Math.sqrt((x - tx) ** 2 + (z - tz) ** 2) < 4) {
          tooClose = true
          break
        }
      }
      if (tooClose) continue

      placed.push([x, z])

      // Vary height: 3, 4, 5 or 6
      const height = 3 + Math.floor(hash(x, z) * 4)

      result.push({ pos: [x, 0.5, z], height })
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
