import { useMemo, type FC } from 'react'
import type { Zone, Task3D } from './types'
import { getZonePositions, hash } from './utils'
import { Cottage, COTTAGE_META } from './buildings/Cottage'
import { Tower, TOWER_META } from './buildings/Tower'
import { Workshop, WORKSHOP_META } from './buildings/Workshop'
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
  return [x, 1.1, z]
}

export const Zones: FC<ZonesProps> = ({ zones, tasks = [], onTaskClick }) => {
  // Determine building type per zone
  const buildingTypes = useMemo(() =>
    zones.map((_, i) => getBuildingForZone(i)),
  [zones.length])

  // Get radii for spacing
  const radii = useMemo(() =>
    buildingTypes.map(b => b.meta.radius),
  [buildingTypes])

  const positions = useMemo(() => getZonePositions(zones.length, radii), [zones.length, radii])

  // Map zone id → position + metadata
  const zoneData = useMemo(() => {
    const map = new Map<string, { pos: [number, number]; meta: BuildingMetadata }>()
    zones.forEach((zone, i) => map.set(zone.id, { pos: positions[i], meta: buildingTypes[i].meta }))
    return map
  }, [zones, positions, buildingTypes])

  // Calculate each task's target position
  const taskPositions = useMemo(() => {
    const zoneCounts = new Map<string, number>()
    const zoneIndices = new Map<string, number>()
    for (const task of tasks) {
      const count = zoneCounts.get(task.phase) || 0
      zoneIndices.set(task.id, count)
      zoneCounts.set(task.phase, count + 1)
    }

    const result = new Map<string, [number, number, number]>()
    for (const task of tasks) {
      const data = zoneData.get(task.phase)
      if (!data) continue
      const idx = zoneIndices.get(task.id) || 0
      const total = zoneCounts.get(task.phase) || 1
      result.set(task.id, getTaskPosition(idx, total, data.pos, data.meta))
    }
    return result
  }, [tasks, zoneData])

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
        const pos = taskPositions.get(task.id)
        if (!pos) return null
        return (
          <TaskCube
            key={task.id}
            position={pos}
            title={task.title}
            isRunning={task.isRunning}
            needsAttention={task.needsAttention}
            onClick={() => onTaskClick?.(task.id)}
          />
        )
      })}
    </group>
  )
}
