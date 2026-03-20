/** Deterministic hash from coordinates — stable across re-renders */
export function hash(x: number, z: number) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return n - Math.floor(n)
}

/** Scatter zones in a village-like cluster around the origin */
export function getZonePositions(count: number): [number, number][] {
  if (count <= 1) return [[0, 0]]

  const positions: [number, number][] = []
  const angleStep = (Math.PI * 2) / Math.max(count - 1, 1)
  const baseRadius = 14

  // First zone (BACKLOG) near center-left
  positions.push([-12, 8])

  for (let i = 1; i < count - 1; i++) {
    const angle = angleStep * (i - 1) - Math.PI / 4
    const radius = baseRadius + (i % 2 === 0 ? 3 : -2)
    const x = Math.cos(angle) * radius + (hash(i, 0) - 0.5) * 4
    const z = Math.sin(angle) * radius + (hash(0, i) - 0.5) * 4
    positions.push([Math.round(x), Math.round(z)])
  }

  // Last zone (DONE) offset from cluster
  positions.push([18, -10])

  return positions
}
