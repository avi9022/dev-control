import { useMemo, type FC } from 'react'
import { Flower } from './Flower'
import { TallGrass } from './TallGrass'
import { Boulder } from './Boulder'
import { hash } from './utils'
import { GROUND_Y, PLACEMENT_MULTIPLIER } from './config'

const FLOWER_COUNT = 15
const GRASS_COUNT = 25
const BOULDER_COUNT = 6
const MIN_DIST_FROM_BUILDING = 8
const GRASS_MIN_DIST_FROM_BUILDING = 6
const BOULDER_MIN_DIST_FROM_BUILDING = 12

const FLOWER_MIN_RADIUS = 10
const FLOWER_RADIUS_RANGE = 35
const GRASS_MIN_RADIUS = 5
const GRASS_RADIUS_RANGE = 50
const BOULDER_MIN_RADIUS = 65
const BOULDER_RADIUS_RANGE = 15
const FLOWER_OFFSET = 0.5
const GRASS_OFFSET = 0.3

const SMALL_BOULDER_THRESHOLD = 0.5
const MEDIUM_BOULDER_THRESHOLD = 0.8

const FLOWER_ANGLE_SEED_A = 17
const FLOWER_ANGLE_SEED_B = 3
const FLOWER_RADIUS_SEED_A = 7
const FLOWER_RADIUS_SEED_B = 11

const GRASS_ANGLE_SEED_A = 23
const GRASS_ANGLE_SEED_B = 5
const GRASS_RADIUS_SEED_A = 9
const GRASS_RADIUS_SEED_B = 13
const GRASS_SEED_OFFSET = 100

const BOULDER_ANGLE_SEED_A = 31
const BOULDER_ANGLE_SEED_B = 7
const BOULDER_RADIUS_SEED_A = 11
const BOULDER_RADIUS_SEED_B = 19
const BOULDER_SEED_OFFSET = 200

interface DecorationsProps {
  buildingPositions: [number, number][]
}

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

    for (let i = 0; i < FLOWER_COUNT * PLACEMENT_MULTIPLIER && flowers.length < FLOWER_COUNT; i++) {
      const angle = hash(i * FLOWER_ANGLE_SEED_A, i * FLOWER_ANGLE_SEED_B) * Math.PI * 2
      const radius = FLOWER_MIN_RADIUS + hash(i * FLOWER_RADIUS_SEED_A, i * FLOWER_RADIUS_SEED_B) * FLOWER_RADIUS_RANGE
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, MIN_DIST_FROM_BUILDING)) continue
      flowers.push([x + FLOWER_OFFSET, GROUND_Y, z + FLOWER_OFFSET])
    }

    for (let i = 0; i < GRASS_COUNT * PLACEMENT_MULTIPLIER && grasses.length < GRASS_COUNT; i++) {
      const angle = hash(i * GRASS_ANGLE_SEED_A + GRASS_SEED_OFFSET, i * GRASS_ANGLE_SEED_B + GRASS_SEED_OFFSET) * Math.PI * 2
      const radius = GRASS_MIN_RADIUS + hash(i * GRASS_RADIUS_SEED_A + GRASS_SEED_OFFSET, i * GRASS_RADIUS_SEED_B + GRASS_SEED_OFFSET) * GRASS_RADIUS_RANGE
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, GRASS_MIN_DIST_FROM_BUILDING)) continue
      grasses.push([x + GRASS_OFFSET, GROUND_Y, z + GRASS_OFFSET])
    }

    for (let i = 0; i < BOULDER_COUNT * PLACEMENT_MULTIPLIER && boulders.length < BOULDER_COUNT; i++) {
      const angle = hash(i * BOULDER_ANGLE_SEED_A + BOULDER_SEED_OFFSET, i * BOULDER_ANGLE_SEED_B + BOULDER_SEED_OFFSET) * Math.PI * 2
      const radius = BOULDER_MIN_RADIUS + hash(i * BOULDER_RADIUS_SEED_A + BOULDER_SEED_OFFSET, i * BOULDER_RADIUS_SEED_B + BOULDER_SEED_OFFSET) * BOULDER_RADIUS_RANGE
      const x = Math.round(Math.cos(angle) * radius)
      const z = Math.round(Math.sin(angle) * radius)
      if (isTooCloseToBuilding(x, z, buildingPositions, BOULDER_MIN_DIST_FROM_BUILDING)) continue

      const sizeRoll = hash(x, z)
      const size = sizeRoll < SMALL_BOULDER_THRESHOLD ? 'small' as const : sizeRoll < MEDIUM_BOULDER_THRESHOLD ? 'medium' as const : 'large' as const
      boulders.push({ pos: [x, GROUND_Y, z], size })
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
