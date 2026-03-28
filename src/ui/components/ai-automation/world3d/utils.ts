import { HASH_FACTOR_A, HASH_FACTOR_B, HASH_SCALE } from './config'

const DEFAULT_ZONE_RADIUS = 15
const MAX_PLACEMENT_ATTEMPTS = 200
const BASE_PLACEMENT_RADIUS = 8
const PLACEMENT_RADIUS_STEP = 0.6
const PLACEMENT_RADIUS_JITTER = 5
const MIN_SPACING_PADDING = 2
const ANGLE_HASH_SEED_A = 31
const ANGLE_HASH_SEED_B = 17

export function hash(x: number, z: number) {
  const n = Math.sin(x * HASH_FACTOR_A + z * HASH_FACTOR_B) * HASH_SCALE
  return n - Math.floor(n)
}

export function getZonePositions(count: number, radii?: number[]): [number, number][] {
  if (count <= 1) return [[0, 0]]

  const positions: [number, number][] = []

  for (let i = 0; i < count; i++) {
    const myRadius = radii?.[i] ?? DEFAULT_ZONE_RADIUS
    let placed = false

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const angle = hash(i * ANGLE_HASH_SEED_A, attempt * ANGLE_HASH_SEED_B) * Math.PI * 2
      const baseRadius = BASE_PLACEMENT_RADIUS + attempt * PLACEMENT_RADIUS_STEP + hash(i, attempt) * PLACEMENT_RADIUS_JITTER
      const x = Math.round(Math.cos(angle) * baseRadius)
      const z = Math.round(Math.sin(angle) * baseRadius)

      let tooClose = false
      for (let j = 0; j < positions.length; j++) {
        const otherRadius = radii?.[j] ?? DEFAULT_ZONE_RADIUS
        const minDist = (myRadius + otherRadius) / 2 + MIN_SPACING_PADDING
        const [px, pz] = positions[j]
        const dist = Math.sqrt((x - px) ** 2 + (z - pz) ** 2)
        if (dist < minDist) {
          tooClose = true
          break
        }
      }

      if (!tooClose) {
        positions.push([x, z])
        placed = true
        break
      }
    }

    if (!placed) {
      positions.push([i * DEFAULT_ZONE_RADIUS, 0])
    }
  }

  return positions
}
