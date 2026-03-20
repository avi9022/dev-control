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

/** Spread tasks around the front of their zone building */
function getTaskPositions(count: number, zonePos: [number, number]): [number, number, number][] {
  const [zx, zz] = zonePos
  const positions: [number, number, number][] = []
  const cols = Math.ceil(Math.sqrt(count))

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = zx - (cols - 1) * 1.2 / 2 + col * 1.2
    const z = zz + 5 + row * 1.5
    positions.push([x, 1.1, z])
  }
  return positions
}

export const Zones: FC<ZonesProps> = ({ zones, tasks = [], onTaskClick }) => {
  const positions = useMemo(() => getZonePositions(zones.length), [zones.length])

  // Group tasks by phase
  const tasksByZone = useMemo(() => {
    const map = new Map<string, Task3D[]>()
    for (const zone of zones) {
      map.set(zone.id, [])
    }
    for (const task of tasks) {
      const list = map.get(task.phase)
      if (list) list.push(task)
    }
    return map
  }, [zones, tasks])

  return (
    <group>
      {zones.map((zone, i) => {
        const zoneTasks = tasksByZone.get(zone.id) || []
        const taskPositions = getTaskPositions(zoneTasks.length, positions[i])

        return (
          <group key={zone.id}>
            <ZoneBuilding position={positions[i]} color={zone.color || '#7C8894'} />
            <SignPost position={positions[i]} label={zone.label} color={zone.color || '#FAF9F7'} />
            {zoneTasks.map((task, ti) => (
              <TaskCube
                key={task.id}
                position={taskPositions[ti]}
                title={task.title}
                isRunning={task.isRunning}
                needsAttention={task.needsAttention}
                onClick={() => onTaskClick?.(task.id)}
              />
            ))}
          </group>
        )
      })}
      {zones.map((_, i) => {
        if (i === 0) return null
        return <Path key={`path-${i}`} from={positions[i - 1]} to={positions[i]} />
      })}
    </group>
  )
}
