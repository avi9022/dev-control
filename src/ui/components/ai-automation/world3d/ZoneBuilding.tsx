import type { FC } from 'react'
import { Block } from './blocks'

interface ZoneBuildingProps {
  position: [number, number]
  color: string
}

/** Simple cottage: wood frame, wool accent walls, windows, darkwood roof, stone floor */
export const ZoneBuilding: FC<ZoneBuildingProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: JSX.Element[] = []
  let key = 0

  const b = (type: Parameters<typeof Block>[0]['type'], bx: number, by: number, bz: number, c?: string) => {
    blocks.push(<Block key={key++} type={type} position={[x + bx, 0.5 + by, z + bz]} color={c} />)
  }

  // Floor (stone) — 5x5
  for (let fx = -2; fx <= 2; fx++)
    for (let fz = -2; fz <= 2; fz++)
      b('stone', fx, 0, fz)

  // Walls — 3 blocks high
  for (let h = 1; h <= 3; h++) {
    // Back wall — window in center at h=2
    for (let wx = -2; wx <= 2; wx++) {
      if (h === 2 && wx === 0) { b('bars', wx, h, -2); continue }
      b(h === 2 ? 'wool' : 'wood', wx, h, -2, color)
    }
    // Left wall — window in center at h=2
    for (let wz = -1; wz <= 2; wz++) {
      if (h === 2 && wz === 0) { b('bars', -2, h, wz); continue }
      b(h === 2 ? 'wool' : 'wood', -2, h, wz, color)
    }
    // Right wall — window in center at h=2
    for (let wz = -1; wz <= 2; wz++) {
      if (h === 2 && wz === 0) { b('bars', 2, h, wz); continue }
      b(h === 2 ? 'wool' : 'wood', 2, h, wz, color)
    }
    // Front wall — with door gap
    b(h === 2 ? 'wool' : 'wood', -2, h, 2, color)
    b(h === 2 ? 'wool' : 'wood', -1, h, 2, color)
    if (h >= 3) b('wood', 0, h, 2)
    b(h === 2 ? 'wool' : 'wood', 1, h, 2, color)
    b(h === 2 ? 'wool' : 'wood', 2, h, 2, color)
  }

  // Roof (darkwood) — stepped pyramid
  for (let rx = -3; rx <= 3; rx++)
    for (let rz = -3; rz <= 3; rz++)
      b('darkwood', rx, 4, rz)
  for (let rx = -2; rx <= 2; rx++)
    for (let rz = -2; rz <= 2; rz++)
      b('darkwood', rx, 5, rz)

  return <group>{blocks}</group>
}
