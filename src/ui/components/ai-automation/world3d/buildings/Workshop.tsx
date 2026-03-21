import { useMemo, type FC } from 'react'
import { Lantern } from '../Lantern'
import type { BuildingMetadata } from './types'
import type { BlockType } from '../blocks'
import { buildMergedMeshes } from './buildMerged'

export const WORKSHOP_META: BuildingMetadata = {
  radius: 22,
  gatherPoint: { x: 0, z: 12 },
  gatherSpread: 1.5,
  workSpots: [
    { x: 0, z: 6, type: 'craft' },     // work table under awning
    { x: 6, z: 0, type: 'hammer' },    // next to anvil
    { x: -6, z: 1, type: 'hammer' },   // next to furnace
  ],
  entryPoint: { x: 0, z: 8 },          // front of awning
  internalPaths: new Map([
    // spot 0 (table 0,6) → spot 1 (anvil 6,0): walk around right side
    ['0-1', [[5, 6], [7, 4], [7, 0], [6, 0]]],
    ['1-0', [[7, 0], [7, 4], [5, 6], [0, 6]]],
    // spot 0 (table) → spot 2 (furnace -6,1): walk around left side
    ['0-2', [[-5, 6], [-7, 4], [-7, 1], [-6, 1]]],
    ['2-0', [[-7, 1], [-7, 4], [-5, 6], [0, 6]]],
    // spot 1 (anvil) → spot 2 (furnace): walk around back
    ['1-2', [[7, 0], [7, -4], [-7, -4], [-7, 1], [-6, 1]]],
    ['2-1', [[-7, 1], [-7, -4], [7, -4], [7, 0], [6, 0]]],
  ]),
}

interface WorkshopProps {
  position: [number, number]
  color: string
}

export const Workshop: FC<WorkshopProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: { type: BlockType; x: number; y: number; z: number; color?: string }[] = []

  const b = (type: BlockType, bx: number, by: number, bz: number, c?: string) => {
    blocks.push({ type, x: x + bx, y: by, z: z + bz, color: c })
  }

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

  // ── Interior floor — one block above ground ──
  for (let fx = -3; fx <= 3; fx++)
    for (let fz = -2; fz <= 2; fz++)
      b('wood', fx, 1, fz)

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


  const meshes = useMemo(() => buildMergedMeshes(blocks), [x, z, color])

  return (
    <group>
      {meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
      <Lantern position={[x - 4, 2.35, z + 5]} />
      <Lantern position={[x + 4, 2.35, z + 5]} />
    </group>
  )
}
