import { useMemo, type FC } from 'react'
import { Lantern } from '../Lantern'
import type { BuildingMetadata } from './types'
import type { BlockType } from '../blocks'
import { buildMergedMeshes } from './buildMerged'

export const WORKSHOP_META: BuildingMetadata = {
  radius: 26,
  gatherPoint: { x: 0, z: 12 },
  gatherSpread: 1.5,
  workSpots: [
    { x: 0, z: 6, type: 'craft' },     // work table under awning
    { x: 6, z: 0, type: 'hammer' },    // next to anvil
    { x: -6, z: 1, type: 'hammer' },   // next to furnace
  ],
}

interface WorkshopProps {
  position: [number, number]
  color: string
}

export const Workshop: FC<WorkshopProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: { type: BlockType; x: number; y: number; z: number; color?: string }[] = []

  const b = (type: BlockType, bx: number, by: number, bz: number, c?: string) => {
    blocks.push({ type, x: x + bx, y: 1 + by, z: z + bz, color: c })
  }

  // ── Base platform ──
  for (let fx = -10; fx <= 10; fx++)
    for (let fz = -4; fz <= 7; fz++)
      b('cobble', fx, 0, fz)

  // ── Walls ──
  for (let h = 1; h <= 4; h++) {
    const isAccent = h === 2 || h === 4
    for (let wx = -4; wx <= 4; wx++) b(isAccent ? 'wool' : 'brick', wx, h, -3, color)
    for (let wz = -2; wz <= 2; wz++) {
      if (h === 3 && wz === 0) { b('bars', -4, h, wz); continue }
      b(isAccent ? 'wool' : 'brick', -4, h, wz, color)
    }
    for (let wz = -2; wz <= 2; wz++) {
      if (h === 3 && wz === 0) { b('bars', 4, h, wz); continue }
      b(isAccent ? 'wool' : 'brick', 4, h, wz, color)
    }
    if (h <= 4) {
      b(isAccent ? 'wool' : 'brick', -4, h, 3, color); b(isAccent ? 'wool' : 'brick', -3, h, 3, color)
      b(isAccent ? 'wool' : 'brick', 3, h, 3, color); b(isAccent ? 'wool' : 'brick', 4, h, 3, color)
      if (h === 4) for (let wx = -2; wx <= 2; wx++) b('darkwood', wx, h, 3)
    }
  }

  // ── Interior floor ──
  for (let fx = -3; fx <= 3; fx++)
    for (let fz = -2; fz <= 2; fz++)
      b('wood', fx, 0, fz)

  // ── Sloped roof ──
  for (let rx = -5; rx <= 5; rx++)
    for (let rz = -4; rz <= 4; rz++) b('darkwood', rx, 5, rz)
  for (let rx = -5; rx <= 5; rx++)
    for (let rz = -4; rz <= 0; rz++) b('darkwood', rx, 6, rz)
  for (let rx = -4; rx <= 4; rx++)
    for (let rz = -4; rz <= -2; rz++) b('darkwood', rx, 7, rz)

  // ── Porch ──
  b('wood', -3, 1, 5); b('wood', -3, 2, 5); b('wood', -3, 3, 5)
  b('wood', 3, 1, 5); b('wood', 3, 2, 5); b('wood', 3, 3, 5)
  for (let rx = -4; rx <= 4; rx++) { b('darkwood', rx, 4, 4); b('darkwood', rx, 4, 5) }

  // ── Anvil ──
  b('stone', 5, 1, 1); b('stone', 5, 1, 0); b('stone', 5, 2, 0)

  // ── Furnace ──
  b('brick', -5, 1, 0); b('brick', -5, 1, 1); b('brick', -5, 2, 0); b('brick', -5, 2, 1)
  b('brick', -5, 3, 0); b('brick', -5, 3, 1); b('brick', -5, 4, 1)

  // ── Work table ──
  b('wood', -1, 1, 5); b('wood', 0, 1, 5); b('wood', 1, 1, 5)
  b('darkwood', -1, 2, 5); b('darkwood', 0, 2, 5); b('darkwood', 1, 2, 5)

  // ── Crates inside ──
  b('crate', 3, 1, -2); b('crate', 3, 1, -1); b('crate', 3, 2, -2)

  // ── Lantern posts ──
  b('wood', -4, 1, 5); b('wood', -4, 2, 5)
  b('wood', 4, 1, 5); b('wood', 4, 2, 5)

  // ── Barrels ──
  b('wood', 2, 1, 4); b('wood', -2, 1, 4)

  // ── Well ──
  const wx = 8, wz = 0
  b('cobble', wx-1, 0, wz-1); b('cobble', wx, 0, wz-1); b('cobble', wx+1, 0, wz-1)
  b('cobble', wx-1, 0, wz); b('cobble', wx+1, 0, wz)
  b('cobble', wx-1, 0, wz+1); b('cobble', wx, 0, wz+1); b('cobble', wx+1, 0, wz+1)
  for (let h = 1; h <= 2; h++) {
    b('cobble', wx-1, h, wz-1); b('cobble', wx+1, h, wz-1)
    b('cobble', wx-1, h, wz+1); b('cobble', wx+1, h, wz+1)
    b('cobble', wx, h, wz-1); b('cobble', wx, h, wz+1)
    b('cobble', wx-1, h, wz); b('cobble', wx+1, h, wz)
  }
  b('water', wx, 1, wz)
  b('wood', wx-1, 3, wz-1); b('wood', wx-1, 4, wz-1)
  b('wood', wx+1, 3, wz-1); b('wood', wx+1, 4, wz-1)
  b('darkwood', wx-1, 5, wz-1); b('darkwood', wx, 5, wz-1); b('darkwood', wx+1, 5, wz-1)
  b('darkwood', wx-1, 5, wz); b('darkwood', wx, 5, wz); b('darkwood', wx+1, 5, wz)
  b('darkwood', wx, 6, wz-1); b('darkwood', wx, 6, wz)

  // ── Lumber rack ──
  const lx = -8, lz = 0
  for (let fz = -1; fz <= 2; fz++) b('cobble', lx, 0, lz + fz)
  b('wood', lx, 1, lz-1); b('wood', lx, 2, lz-1); b('wood', lx, 3, lz-1)
  b('wood', lx, 1, lz+2); b('wood', lx, 2, lz+2); b('wood', lx, 3, lz+2)
  b('darkwood', lx, 3, lz); b('darkwood', lx, 3, lz+1)
  b('wood', lx+1, 1, lz-1); b('wood', lx+1, 2, lz-1); b('wood', lx+1, 3, lz-1)
  b('wood', lx+1, 1, lz+2); b('wood', lx+1, 2, lz+2); b('wood', lx+1, 3, lz+2)
  b('darkwood', lx+1, 3, lz); b('darkwood', lx+1, 3, lz+1)
  for (let ly = 1; ly <= 2; ly++)
    for (let fz = 0; fz <= 1; fz++) { b('wood', lx, ly, lz+fz); b('wood', lx+1, ly, lz+fz) }
  b('wood', lx-1, 1, lz); b('wood', lx+2, 1, lz+1)

  const meshes = useMemo(() => buildMergedMeshes(blocks), [x, z, color])

  return (
    <group>
      {meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
      <Lantern position={[x - 4, 3.85, z + 5]} />
      <Lantern position={[x + 4, 3.85, z + 5]} />
    </group>
  )
}
