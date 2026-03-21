/** Deterministic hash from coordinates — stable across re-renders */
export function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/**
 * Place zones with guaranteed minimum spacing but irregular, village-like scatter.
 * Uses deterministic pseudo-random placement with collision avoidance.
 * @param radii - per-zone radius for spacing (uses max of both radii for each pair)
 */
export function getZonePositions(count: number, radii?: number[]): [number, number][] {
  if (count <= 1) return [[0, 0]]

  const defaultRadius = 15
  const positions: [number, number][] = []

  for (let i = 0; i < count; i++) {
    const myRadius = radii?.[i] ?? defaultRadius
    let placed = false

    for (let attempt = 0; attempt < 200; attempt++) {
      const angle = hash(i * 31, attempt * 17) * Math.PI * 2
      const baseRadius = 8 + attempt * 0.6 + hash(i, attempt) * 5
      const x = Math.round(Math.cos(angle) * baseRadius)
      const z = Math.round(Math.sin(angle) * baseRadius)

      let tooClose = false
      for (let j = 0; j < positions.length; j++) {
        const otherRadius = radii?.[j] ?? defaultRadius
        const minDist = (myRadius + otherRadius) / 2 + 2
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
      positions.push([i * defaultRadius, 0])
    }
  }

  return positions
}
