import { useMemo, type FC } from 'react'
import { Lantern } from '../Lantern'
import { Flower } from '../Flower'
import type { BuildingMetadata } from './types'
import type { BlockType } from '../blocks'
import { buildMergedMeshes } from './buildMerged'

export const COTTAGE_META: BuildingMetadata = {
  radius: 22,
  gatherPoint: { x: 0, z: 10 },
  gatherSpread: 1.5,
  workSpots: [
    { x: -2, z: 4, type: 'read' },    // bench on porch
    { x: 2, z: 6, type: 'craft' },    // front yard near gate
    { x: -4, z: -1, type: 'read' },   // side of house
  ],
  entryPoint: { x: 0, z: 7 },         // front gate
  internalPaths: new Map([
    // spot 0 (porch -2,4) → spot 1 (yard 2,6): walk out front of porch then right
    ['0-1', [[-2, 6], [2, 6]]],
    ['1-0', [[2, 6], [-2, 6], [-2, 4]]],
    // spot 0 (porch -2,4) → spot 2 (side -4,-1): out front, around left
    ['0-2', [[-2, 6], [-5, 6], [-5, -1]]],
    ['2-0', [[-5, -1], [-5, 6], [-2, 6], [-2, 4]]],
    // spot 1 (yard 2,6) → spot 2 (side -4,-1): around right side, then back
    ['1-2', [[5, 6], [5, -1], [5, -4], [-5, -4], [-5, -1]]],
    ['2-1', [[-5, -1], [-5, -4], [5, -4], [5, -1], [5, 6], [2, 6]]],
  ]),
}

interface CottageProps {
  position: [number, number]
  color: string
}

export const Cottage: FC<CottageProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: { type: BlockType; x: number; y: number; z: number; color?: string }[] = []

  const b = (type: BlockType, bx: number, by: number, bz: number, c?: string) => {
    blocks.push({ type, x: x + bx, y: by, z: z + bz, color: c })
  }

  // ── House floor — inside the walls, one block above ground ──
  for (let fx = -3; fx <= 3; fx++)
    for (let fz = -3; fz <= 1; fz++)
      b('wood', fx, 1, fz)

  // ── Walls ──
  for (let h = 1; h <= 4; h++) {
    const isAccent = h === 2 || h === 3
    for (let wx = -3; wx <= 3; wx++) {
      if (isAccent && (wx === -1 || wx === 1)) { b('bars', wx, h, -3); continue }
      b(isAccent ? 'wool' : 'brick', wx, h, -3, color)
    }
    for (let wz = -2; wz <= 1; wz++) {
      if (isAccent && wz === 0) { b('bars', -3, h, wz); continue }
      b(isAccent ? 'wool' : 'brick', -3, h, wz, color)
    }
    for (let wz = -2; wz <= 1; wz++) {
      if (isAccent && wz === 0) { b('bars', 3, h, wz); continue }
      b(isAccent ? 'wool' : 'brick', 3, h, wz, color)
    }
    b(isAccent ? 'wool' : 'brick', -3, h, 1, color)
    b(isAccent ? 'wool' : 'brick', -2, h, 1, color)
    if (h >= 3) b('brick', -1, h, 1)
    if (h >= 3) b('brick', 0, h, 1)
    b(isAccent ? 'wool' : 'brick', 1, h, 1, color)
    b(isAccent ? 'wool' : 'brick', 2, h, 1, color)
    b(isAccent ? 'wool' : 'brick', 3, h, 1, color)
  }

  // ── Roof ──
  for (let rx = -4; rx <= 4; rx++)
    for (let rz = -4; rz <= 2; rz++)
      b('darkwood', rx, 5, rz)
  for (let rx = -3; rx <= 3; rx++)
    for (let rz = -4; rz <= 0; rz++)
      b('darkwood', rx, 6, rz)
  for (let rx = -2; rx <= 2; rx++)
    for (let rz = -4; rz <= -2; rz++)
      b('darkwood', rx, 7, rz)

  // ── Chimney ──
  b('brick', 2, 5, -2); b('brick', 2, 6, -2); b('brick', 2, 7, -2); b('brick', 2, 8, -2)
  b('brick', 3, 5, -2); b('brick', 3, 6, -2); b('brick', 3, 7, -2); b('brick', 3, 8, -2)

  // ── Porch ──
  b('wood', -3, 1, 3); b('wood', -3, 2, 3); b('wood', -3, 3, 3)
  b('wood', 3, 1, 3); b('wood', 3, 2, 3); b('wood', 3, 3, 3)
  for (let fx = -3; fx <= 3; fx++) { b('wood', fx, 1, 2); b('wood', fx, 1, 3) }
  for (let rx = -4; rx <= 4; rx++) { b('darkwood', rx, 4, 2); b('darkwood', rx, 4, 3) }

  // ── Steps ──
  b('stone', -1, 1, 4); b('stone', 0, 1, 4); b('stone', 1, 1, 4)

  // ── Bench ──
  b('wood', -2, 1, 3); b('wood', -1, 1, 3)

  // ── Lantern posts ──
  b('wood', -2, 1, 2); b('wood', 1, 1, 2)

  // ── Fence ──
  for (let fx = -4; fx <= 4; fx++) {
    if (Math.abs(fx) <= 1) continue
    b('wood', fx, 1, 5)
  }
  for (let fz = 4; fz <= 5; fz++) { b('wood', -4, 1, fz); b('wood', 4, 1, fz) }
  b('wood', -1, 1, 5); b('wood', -1, 2, 5); b('wood', 1, 1, 5); b('wood', 1, 2, 5)

  // Merge all blocks into a few meshes
  const meshes = useMemo(() => buildMergedMeshes(blocks), [x, z, color])

  return (
    <group>
      {meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
      {/* Non-block elements */}
      <Lantern position={[x - 2, 1.85, z + 2]} />
      <Lantern position={[x + 1, 1.85, z + 2]} />
      <Flower position={[x - 1, 1, z - 4]} color="#e84040" />
      <Flower position={[x + 0, 1, z - 4]} color="#e8d840" />
      <Flower position={[x + 1, 1, z - 4]} color="#e84040" />
      <Flower position={[x - 4, 1, z + 0]} color="#d040d0" />
      <Flower position={[x - 4, 1, z + 0.5]} color="#e8e8e8" />
      <Flower position={[x + 4, 1, z + 0]} color="#e8d840" />
      <Flower position={[x + 4, 1, z + 0.5]} color="#d040d0" />
      <Flower position={[x - 3, 0.5, z + 4.5]} color="#e84040" />
      <Flower position={[x - 2, 0.5, z + 5]} color="#e8d840" />
      <Flower position={[x + 2, 0.5, z + 4.5]} color="#e8e8e8" />
      <Flower position={[x + 3, 0.5, z + 5]} color="#d040d0" />
    </group>
  )
}
