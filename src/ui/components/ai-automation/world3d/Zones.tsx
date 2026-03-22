import { useMemo, useState, useEffect, useRef, type FC } from 'react'
import type { Zone, Task3D } from './types'
import type { WorkType } from './buildings/types'
import { getZonePositions, hash } from './utils'
import { buildRoadNetwork, getRoute } from './roadNetwork'
import { Cottage } from './buildings/Cottage'
import { Tower } from './buildings/Tower'
import { Workshop } from './buildings/Workshop'
import { COTTAGE_META, TOWER_META, WORKSHOP_META } from './buildings/buildingMeta'
import type { BuildingMetadata } from './buildings/types'
import { SignPost } from './SignPost'
import { Path } from './Path'
import { TaskCube } from './TaskCube'

interface ZonesProps {
  zones: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

const BUILDINGS = [
  { Component: Cottage, meta: COTTAGE_META },
  { Component: Tower, meta: TOWER_META },
  { Component: Workshop, meta: WORKSHOP_META },
]

function getBuildingForZone(index: number) {
  const roll = Math.floor(hash(index * 37, index * 13) * BUILDINGS.length)
  return BUILDINGS[roll]
}

/** Position tasks at the building's gather point */
function getTaskPosition(
  taskIndex: number,
  totalInZone: number,
  zonePos: [number, number],
  meta: BuildingMetadata,
): [number, number, number] {
  const [zx, zz] = zonePos
  const cols = Math.ceil(Math.sqrt(totalInZone))
  const col = taskIndex % cols
  const row = Math.floor(taskIndex / cols)
  const x = zx + meta.gatherPoint.x - (cols - 1) * meta.gatherSpread / 2 + col * meta.gatherSpread
  const z = zz + meta.gatherPoint.z + row * meta.gatherSpread * 1.3
  return [x, 1.5, z]
}

const WORK_CYCLE_MS = 10000 // switch work spots every 10 seconds

export const Zones: FC<ZonesProps> = ({ zones, tasks = [], onTaskClick }) => {
  // Tick counter — increments every WORK_CYCLE_MS to cycle work spots
  const [workTick, setWorkTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setWorkTick(t => t + 1), WORK_CYCLE_MS)
    return () => clearInterval(interval)
  }, [])
  // Determine building type per zone
  const buildingTypes = useMemo(() =>
    zones.map((_, i) => getBuildingForZone(i)),
  [zones])

  // Get radii for spacing
  const radii = useMemo(() =>
    buildingTypes.map(b => b.meta.radius),
  [buildingTypes])

  const positions = useMemo(() => getZonePositions(zones.length, radii), [zones.length, radii])

  // Build road network
  const roadNetwork = useMemo(() => {
    const metas = buildingTypes.map(b => b.meta)
    return buildRoadNetwork(positions, metas)
  }, [positions, buildingTypes])

  // Map zone id → position + metadata
  const zoneData = useMemo(() => {
    const map = new Map<string, { pos: [number, number]; meta: BuildingMetadata }>()
    zones.forEach((zone, i) => map.set(zone.id, { pos: positions[i], meta: buildingTypes[i].meta }))
    return map
  }, [zones, positions, buildingTypes])

  // Track previous building index per task for routing
  const prevBuildingMap = useRef(new Map<string, { buildingIndex: number; spot: [number, number]; spotIndex?: number }>())

  // Calculate each task's target position + work type + route
  const taskData = useMemo(() => {
    const zoneCounts = new Map<string, number>()
    const zoneIndices = new Map<string, number>()
    for (const task of tasks) {
      const count = zoneCounts.get(task.phase) || 0
      zoneIndices.set(task.id, count)
      zoneCounts.set(task.phase, count + 1)
    }

    const result = new Map<string, { position: [number, number, number]; workType?: WorkType; faceAngle?: number; route?: [number, number][] }>()

    // Find building index for a zone id
    const zoneBuildingIndex = new Map<string, number>()
    zones.forEach((zone, i) => zoneBuildingIndex.set(zone.id, i))

    for (const task of tasks) {
      const data = zoneData.get(task.phase)
      if (!data) continue
      const buildingIndex = zoneBuildingIndex.get(task.phase) ?? -1

      if (task.isRunning && data.meta.workSpots.length > 0) {
        const taskSeed = Math.abs(task.id.charCodeAt(0) + task.id.charCodeAt(task.id.length - 1))
        const spotIndex = (workTick + taskSeed) % data.meta.workSpots.length
        const spot = data.meta.workSpots[spotIndex]
        const faceAngle = Math.atan2(-spot.x, -spot.z)
        const worldSpot: [number, number] = [data.pos[0] + spot.x, data.pos[1] + spot.z]

        // Compute route from previous position
        let route: [number, number][] | undefined
        const prev = prevBuildingMap.current.get(task.id)
        if (prev && prev.buildingIndex !== buildingIndex && prev.buildingIndex >= 0) {
          route = getRoute(roadNetwork, prev.buildingIndex, buildingIndex, prev.spot, worldSpot)
        } else if (prev && prev.buildingIndex === buildingIndex && prev.spotIndex !== undefined) {
          // Same building — use internal paths
          const pathKey = `${prev.spotIndex}-${spotIndex}`
          const internalWaypoints = data.meta.internalPaths.get(pathKey)
          if (internalWaypoints) {
            const worldWaypoints: [number, number][] = internalWaypoints.map(
              ([wx, wz]) => [data.pos[0] + wx, data.pos[1] + wz]
            )
            route = [prev.spot, ...worldWaypoints, worldSpot]
          } else {
            route = [prev.spot, worldSpot]
          }
        }

        // Update tracking
        prevBuildingMap.current.set(task.id, { buildingIndex, spot: worldSpot, spotIndex })

        result.set(task.id, {
          position: [worldSpot[0], 1.5, worldSpot[1]],
          workType: spot.type,
          faceAngle,
          route,
        })
      } else {
        const idx = zoneIndices.get(task.id) || 0
        const total = zoneCounts.get(task.phase) || 1
        const pos = getTaskPosition(idx, total, data.pos, data.meta)
        const worldSpot: [number, number] = [pos[0], pos[2]]

        // Compute route if moving between buildings
        let route: [number, number][] | undefined
        const prev = prevBuildingMap.current.get(task.id)
        if (prev && prev.buildingIndex !== buildingIndex && prev.buildingIndex >= 0) {
          route = getRoute(roadNetwork, prev.buildingIndex, buildingIndex, prev.spot, worldSpot)
        }

        prevBuildingMap.current.set(task.id, { buildingIndex, spot: worldSpot })
        result.set(task.id, { position: pos, route })
      }
    }
    return result
  }, [tasks, zoneData, workTick, zones, roadNetwork])

  return (
    <group>
      {/* Buildings and signs */}
      {zones.map((zone, i) => {
        const color = zone.color || '#7C8894'
        const pos = positions[i]
        const { Component } = buildingTypes[i]
        return (
          <group key={zone.id}>
            <Component position={pos} color={color} />
            <SignPost position={pos} label={zone.label} color={color} />
          </group>
        )
      })}

      {/* Paths */}
      {zones.map((_, i) => {
        if (i === 0) return null
        return <Path key={`path-${i}`} from={positions[i - 1]} to={positions[i]} />
      })}

      {/* Task cubes */}
      {tasks.map(task => {
        const data = taskData.get(task.id)
        if (!data) return null
        return (
          <TaskCube
            key={task.id}
            position={data.position}
            title={task.title}
            isRunning={task.isRunning}
            needsAttention={task.needsAttention}
            workType={data.workType}
            faceAngle={data.faceAngle}
            route={data.route}
            onClick={() => onTaskClick?.(task.id)}
          />
        )
      })}
    </group>
  )
}
