import { useMemo, type FC } from 'react'
import type { Zone, Task3D } from './types'
import { getZonePositions } from './utils'
import { ZoneBuilding } from './ZoneBuilding'
import { SignPost } from './SignPost'
import { Path } from './Path'
import { TaskCube } from './TaskCube'

interface ZonesProps {
  zones: Zone[]
  tasks?: Task3D[]
  onTaskClick?: (taskId: string) => void
}

/** Get a position for a task near its zone building */
function getTaskPosition(taskIndex: number, totalInZone: number, zonePos: [number, number]): [number, number, number] {
  const [zx, zz] = zonePos
  const cols = Math.ceil(Math.sqrt(totalInZone))
  const col = taskIndex % cols
  const row = Math.floor(taskIndex / cols)
  const x = zx - (cols - 1) * 1.2 / 2 + col * 1.2
  const z = zz + 5 + row * 1.5
  return [x, 1.1, z]
}

export const Zones: FC<ZonesProps> = ({ zones, tasks = [], onTaskClick }) => {
  const positions = useMemo(() => getZonePositions(zones.length), [zones.length])

  // Build a map from zone id to its world position
  const zonePositionMap = useMemo(() => {
    const map = new Map<string, [number, number]>()
    zones.forEach((zone, i) => map.set(zone.id, positions[i]))
    return map
  }, [zones, positions])

  // Calculate each task's target position based on its phase
  const taskPositions = useMemo(() => {
    // Count tasks per zone to calculate grid positions
    const zoneCounts = new Map<string, number>()
    const zoneIndices = new Map<string, number>()
    for (const task of tasks) {
      const count = zoneCounts.get(task.phase) || 0
      zoneIndices.set(task.id, count)
      zoneCounts.set(task.phase, count + 1)
    }

    const result = new Map<string, [number, number, number]>()
    for (const task of tasks) {
      const zonePos = zonePositionMap.get(task.phase)
      if (!zonePos) continue
      const idx = zoneIndices.get(task.id) || 0
      const total = zoneCounts.get(task.phase) || 1
      result.set(task.id, getTaskPosition(idx, total, zonePos))
    }
    return result
  }, [tasks, zonePositionMap])

  return (
    <group>
      {/* Buildings and signs */}
      {zones.map((zone, i) => (
        <group key={zone.id}>
          <ZoneBuilding position={positions[i]} color={zone.color || '#7C8894'} />
          <SignPost position={positions[i]} label={zone.label} color={zone.color || '#FAF9F7'} />
        </group>
      ))}

      {/* Paths */}
      {zones.map((_, i) => {
        if (i === 0) return null
        return <Path key={`path-${i}`} from={positions[i - 1]} to={positions[i]} />
      })}

      {/* All task cubes — rendered flat so React preserves them across phase changes */}
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
