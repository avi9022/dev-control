import { hash } from './utils'
import type { BuildingMetadata } from './buildings/types'

export interface RoadNode {
  x: number
  z: number
  /** Which building this node belongs to (-1 for road waypoints) */
  buildingIndex: number
}

export interface RoadNetwork {
  nodes: RoadNode[]
  /** Adjacency list — edges[i] = list of node indices connected to node i */
  edges: number[][]
  /** Precomputed routes: key = "fromBuilding-toBuilding", value = array of [x,z] waypoints */
  routes: Map<string, [number, number][]>
}

/** Sample waypoints along the curved path between two points (same curve as Path.tsx) */
function samplePathWaypoints(from: [number, number], to: [number, number], count: number): [number, number][] {
  const [x1, z1] = from
  const [x2, z2] = to
  const points: [number, number][] = []
  const curve = (hash(Math.round(x1), Math.round(z1)) - 0.5) * 2

  for (let i = 1; i < count; i++) {
    const t = i / count
    const mid = 0.5
    const cx = Math.sin(t * Math.PI) * curve * (1 - Math.abs(t - mid) * 2)
    const x = x1 + (x2 - x1) * t + cx
    const z = z1 + (z2 - z1) * t
    points.push([x, z])
  }

  return points
}

/** Find shortest path between two nodes using BFS */
function bfs(edges: number[][], from: number, to: number): number[] {
  if (from === to) return [from]
  const visited = new Set<number>([from])
  const queue: { node: number; path: number[] }[] = [{ node: from, path: [from] }]

  while (queue.length > 0) {
    const { node, path } = queue.shift()!
    for (const neighbor of edges[node]) {
      if (visited.has(neighbor)) continue
      const newPath = [...path, neighbor]
      if (neighbor === to) return newPath
      visited.add(neighbor)
      queue.push({ node: neighbor, path: newPath })
    }
  }

  // No path found — return direct
  return [from, to]
}

/**
 * Build the road network from building positions and metadata.
 * The path connections follow the same order as the zones (zone 0→1, 1→2, etc.)
 */
export function buildRoadNetwork(
  buildingPositions: [number, number][],
  buildingMetas: BuildingMetadata[],
): RoadNetwork {
  const nodes: RoadNode[] = []
  const edges: number[][] = []

  // Add entry point nodes for each building
  const entryNodeIndices: number[] = []
  for (let i = 0; i < buildingPositions.length; i++) {
    const [bx, bz] = buildingPositions[i]
    const entry = buildingMetas[i].entryPoint
    const nodeIndex = nodes.length
    nodes.push({ x: bx + entry.x, z: bz + entry.z, buildingIndex: i })
    edges.push([])
    entryNodeIndices.push(nodeIndex)
  }

  // Add road waypoints between consecutive buildings
  for (let i = 0; i < buildingPositions.length - 1; i++) {
    const fromEntry = entryNodeIndices[i]
    const toEntry = entryNodeIndices[i + 1]
    const from: [number, number] = [nodes[fromEntry].x, nodes[fromEntry].z]
    const to: [number, number] = [nodes[toEntry].x, nodes[toEntry].z]

    // Sample waypoints along the path
    const dist = Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2)
    const waypointCount = Math.max(2, Math.floor(dist / 5))
    const waypoints = samplePathWaypoints(from, to, waypointCount)

    // Chain: fromEntry → wp0 → wp1 → ... → toEntry
    let prevNode = fromEntry
    for (const [wx, wz] of waypoints) {
      const wpIndex = nodes.length
      nodes.push({ x: wx, z: wz, buildingIndex: -1 })
      edges.push([])
      // Connect both directions
      edges[prevNode].push(wpIndex)
      edges[wpIndex].push(prevNode)
      prevNode = wpIndex
    }
    edges[prevNode].push(toEntry)
    edges[toEntry].push(prevNode)
  }

  // Precompute routes between all pairs of buildings
  const routes = new Map<string, [number, number][]>()
  for (let i = 0; i < buildingPositions.length; i++) {
    for (let j = 0; j < buildingPositions.length; j++) {
      if (i === j) continue
      const path = bfs(edges, entryNodeIndices[i], entryNodeIndices[j])
      const waypoints: [number, number][] = path.map(ni => [nodes[ni].x, nodes[ni].z])
      routes.set(`${i}-${j}`, waypoints)
    }
  }

  return { nodes, edges, routes }
}

/**
 * Get the full route for a character moving between buildings.
 * Returns array of [x, z] waypoints including entry/exit from work spots.
 */
export function getRoute(
  network: RoadNetwork,
  fromBuildingIndex: number,
  toBuildingIndex: number,
  fromSpot: [number, number],
  toSpot: [number, number],
): [number, number][] {
  if (fromBuildingIndex === toBuildingIndex) {
    // Same building — walk directly
    return [fromSpot, toSpot]
  }

  const roadRoute = network.routes.get(`${fromBuildingIndex}-${toBuildingIndex}`)
  if (!roadRoute || roadRoute.length === 0) {
    return [fromSpot, toSpot]
  }

  // fromSpot → entry → road waypoints → entry → toSpot
  return [fromSpot, ...roadRoute, toSpot]
}
