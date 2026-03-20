/** Deterministic hash from coordinates — stable across re-renders */
export function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Place zones with guaranteed minimum spacing but irregular, village-like scatter.
 * Uses deterministic pseudo-random placement with collision avoidance.
 */
export function getZonePositions(count: number): [number, number][] {
  if (count <= 1) return [[0, 0]]

  const minDist = 15
  const positions: [number, number][] = []

  for (let i = 0; i < count; i++) {
    let placed = false
    // Try angles radiating outward from center, using deterministic offsets
    for (let attempt = 0; attempt < 200; attempt++) {
      // Spiral outward with irregular angles
      const angle = hash(i * 31, attempt * 17) * Math.PI * 2
      const baseRadius = 8 + attempt * 0.6 + hash(i, attempt) * 5
      const x = Math.round(Math.cos(angle) * baseRadius)
      const z = Math.round(Math.sin(angle) * baseRadius)

      // Check distance from all existing positions
      let tooClose = false
      for (const [px, pz] of positions) {
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

    // Fallback — shouldn't happen but just in case
    if (!placed) {
      positions.push([i * minDist, 0])
    }
  }

  return positions
}
