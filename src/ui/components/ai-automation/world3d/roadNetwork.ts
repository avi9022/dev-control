import { hash } from './utils'
import type { BuildingMetadata } from './buildings/types'
import { ROAD_PATH_MID, WAYPOINT_SPACING, MIN_WAYPOINTS, CURVE_AMPLITUDE, CURVE_FALLOFF } from './config'

export interface RoadNode {
  x: number
  z: number
  buildingIndex: number
}

export interface RoadNetwork {
  nodes: RoadNode[]
  edges: number[][]
  routes: Map<string, [number, number][]>
}

function samplePathWaypoints(from: [number, number], to: [number, number], count: number): [number, number][] {
  const [x1, z1] = from
  const [x2, z2] = to
  const points: [number, number][] = []
  const curve = (hash(Math.round(x1), Math.round(z1)) - ROAD_PATH_MID) * CURVE_AMPLITUDE

  for (let i = 1; i < count; i++) {
    const t = i / count
    const cx = Math.sin(t * Math.PI) * curve * (1 - Math.abs(t - ROAD_PATH_MID) * CURVE_FALLOFF)
    const x = x1 + (x2 - x1) * t + cx
    const z = z1 + (z2 - z1) * t
    points.push([x, z])
  }

  return points
}

function bfs(edges: number[][], from: number, to: number): number[] {
  if (from === to) return [from]
  const visited = new Set<number>([from])
  const queue: { node: number; path: number[] }[] = [{ node: from, path: [from] }]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break
    const { node, path } = current
    for (const neighbor of edges[node]) {
      if (visited.has(neighbor)) continue
      const newPath = [...path, neighbor]
      if (neighbor === to) return newPath
      visited.add(neighbor)
      queue.push({ node: neighbor, path: newPath })
    }
  }

  return [from, to]
}

export function buildRoadNetwork(
  buildingPositions: [number, number][],
  buildingMetas: BuildingMetadata[],
): RoadNetwork {
  const nodes: RoadNode[] = []
  const edges: number[][] = []

  const entryNodeIndices: number[] = []
  for (let i = 0; i < buildingPositions.length; i++) {
    const [bx, bz] = buildingPositions[i]
    const entry = buildingMetas[i].entryPoint
    const nodeIndex = nodes.length
    nodes.push({ x: bx + entry.x, z: bz + entry.z, buildingIndex: i })
    edges.push([])
    entryNodeIndices.push(nodeIndex)
  }

  for (let i = 0; i < buildingPositions.length - 1; i++) {
    const fromEntry = entryNodeIndices[i]
    const toEntry = entryNodeIndices[i + 1]
    const from: [number, number] = [nodes[fromEntry].x, nodes[fromEntry].z]
    const to: [number, number] = [nodes[toEntry].x, nodes[toEntry].z]

    const dist = Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2)
    const waypointCount = Math.max(MIN_WAYPOINTS, Math.floor(dist / WAYPOINT_SPACING))
    const waypoints = samplePathWaypoints(from, to, waypointCount)

    let prevNode = fromEntry
    for (const [wx, wz] of waypoints) {
      const wpIndex = nodes.length
      nodes.push({ x: wx, z: wz, buildingIndex: -1 })
      edges.push([])
      edges[prevNode].push(wpIndex)
      edges[wpIndex].push(prevNode)
      prevNode = wpIndex
    }
    edges[prevNode].push(toEntry)
    edges[toEntry].push(prevNode)
  }

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

export function getRoute(
  network: RoadNetwork,
  fromBuildingIndex: number,
  toBuildingIndex: number,
  fromSpot: [number, number],
  toSpot: [number, number],
): [number, number][] {
  if (fromBuildingIndex === toBuildingIndex) {
    return [fromSpot, toSpot]
  }

  const roadRoute = network.routes.get(`${fromBuildingIndex}-${toBuildingIndex}`)
  if (!roadRoute || roadRoute.length === 0) {
    return [fromSpot, toSpot]
  }

  return [fromSpot, ...roadRoute, toSpot]
}
