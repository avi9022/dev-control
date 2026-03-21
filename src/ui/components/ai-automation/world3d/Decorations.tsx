import { useMemo, type FC } from 'react'
import { Flower } from './Flower'
import { TallGrass } from './TallGrass'
import { Boulder } from './Boulder'
import { hash } from './utils'

interface DecorationsProps {
  buildingPositions: [number, number][]
}

const FLOWER_COUNT = 15
const GRASS_COUNT = 25
const BOULDER_COUNT = 6
const MIN_DIST_FROM_BUILDING = 8

function isTooCloseToBuilding(x: number, z: number, buildings: [number, number][], minDist: number): boolean {
  for (const [bx, bz] of buildings) {
    if (Math.sqrt((x - bx) ** 2 + (z - bz) ** 2) < minDist) return true
  }
  return false
}

export const Decorations: FC<DecorationsProps> = ({ buildingPositions }) => {
  const { flowers, grasses, boulders } = useMemo(() => {
    const flowers: [number, number, number][] = []
    const grasses: [number, number, number][] = []
    const boulders: { pos: [number, number, number]; size: 'small' | 'medium' | 'large' }[] = []

    // Flowers — near and just outside village (radius 10-45)
    for (let i = 0; i < FLOWER_COUNT * 3 && flowers.length < FLOWER_COUNT; i++) {
      const angle = hash(i * 17, i * 3) * Math.PI * 2
      const radius = 10 + hash(i * 7, i * 11) * 35
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, MIN_DIST_FROM_BUILDING)) continue
      flowers.push([x + 0.5, 0.5, z + 0.5])
    }

    // Tall grass — similar range to flowers but more spread (radius 5-55)
    for (let i = 0; i < GRASS_COUNT * 3 && grasses.length < GRASS_COUNT; i++) {
      const angle = hash(i * 23 + 100, i * 5 + 100) * Math.PI * 2
      const radius = 5 + hash(i * 9 + 100, i * 13 + 100) * 50
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, 6)) continue
      grasses.push([x + 0.3, 0.5, z + 0.3])
    }

    // Boulders — further out (radius 40-70)
    for (let i = 0; i < BOULDER_COUNT * 3 && boulders.length < BOULDER_COUNT; i++) {
      const angle = hash(i * 31 + 200, i * 7 + 200) * Math.PI * 2
      const radius = 65 + hash(i * 11 + 200, i * 19 + 200) * 15
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, 12)) continue

      const sizeRoll = hash(x, z)
      const size = sizeRoll < 0.5 ? 'small' as const : sizeRoll < 0.8 ? 'medium' as const : 'large' as const
      boulders.push({ pos: [x, 0.5, z], size })
    }

    return { flowers, grasses, boulders }
  }, [buildingPositions])

  return (
    <group>
      {flowers.map((pos, i) => <Flower key={`f-${i}`} position={pos} />)}
      {grasses.map((pos, i) => <TallGrass key={`g-${i}`} position={pos} />)}
      {boulders.map((b, i) => <Boulder key={`b-${i}`} position={b.pos} size={b.size} />)}
    </group>
  )
}
