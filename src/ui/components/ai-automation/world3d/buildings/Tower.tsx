import { useMemo, type FC } from 'react'
import { Lantern } from '../Lantern'
import type { BuildingMetadata } from './types'
import type { BlockType } from '../blocks'
import { buildMergedMeshes } from './buildMerged'

export const TOWER_META: BuildingMetadata = {
  radius: 24,
  gatherPoint: { x: 0, z: 12 },
  gatherSpread: 1.5,
  workSpots: [
    { x: -4, z: 2, type: 'craft' },    // workstation
    { x: 4, z: -1, type: 'hammer' },   // near campfire
    { x: 0, z: 7, type: 'read' },      // outside gate
  ],
}

interface TowerProps {
  position: [number, number]
  color: string
}

export const Tower: FC<TowerProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: { type: BlockType; x: number; y: number; z: number; color?: string }[] = []

  const b = (type: BlockType, bx: number, by: number, bz: number, c?: string) => {
    blocks.push({ type, x: x + bx, y: 1 + by, z: z + bz, color: c })
  }

  // ── Base platform ──
  for (let fx = -5; fx <= 5; fx++)
    for (let fz = -4; fz <= 6; fz++) {
      if (Math.abs(fx) === 5 && (fz < -3 || fz > 5)) continue
      if (Math.abs(fx) === 5 && Math.abs(fz) > 3 && fz < 0) continue
      b('cobble', fx, 0, fz)
    }

  // ── Perimeter fence ──
  for (let fx = -5; fx <= 5; fx++) {
    if (Math.abs(fx) < 5) b('wood', fx, 1, -4)
    if (Math.abs(fx) > 1 && Math.abs(fx) < 5) b('wood', fx, 1, 6)
  }
  for (let fz = -3; fz <= 5; fz++) { b('wood', -5, 1, fz); b('wood', 5, 1, fz) }

  // ── Gate ──
  b('stone', -1, 1, 6); b('stone', -1, 2, 6); b('stone', -1, 3, 6)
  b('stone', 1, 1, 6); b('stone', 1, 2, 6); b('stone', 1, 3, 6)
  b('darkwood', -1, 4, 6); b('darkwood', 0, 4, 6); b('darkwood', 1, 4, 6)

  // ── Torch posts ──
  b('wood', -2, 1, 6); b('wood', -2, 2, 6)
  b('wood', 2, 1, 6); b('wood', 2, 2, 6)

  // ── Tower body ──
  for (let h = 1; h <= 7; h++) {
    const isAccent = h === 3 || h === 6
    for (let wx = -2; wx <= 2; wx++) {
      for (let wz = -2; wz <= 2; wz++) {
        if (Math.abs(wx) === 2 && Math.abs(wz) === 2) continue
        const isEdge = Math.abs(wx) === 2 || Math.abs(wz) === 2
        const isInner = Math.abs(wx) <= 1 && Math.abs(wz) <= 1
        if (!isEdge && isInner) continue
        if (wz === 2 && wx === 0 && h <= 3) continue
        if ((h === 4 || h === 5) && ((wz === -2 && wx === 0) || (wx === -2 && wz === 0) || (wx === 2 && wz === 0))) {
          b('bars', wx, h, wz); continue
        }
        if (isEdge || !isInner) b(isAccent ? 'wool' : 'brick', wx, h, wz, color)
      }
    }
  }

  // ── Staircase ──
  b('stone', 3, 1, 3); b('stone', 3, 1, 2); b('stone', 3, 2, 1); b('stone', 3, 2, 0)
  b('stone', 3, 3, -1); b('stone', 3, 3, -2); b('stone', 2, 4, -3); b('stone', 1, 4, -3)
  b('stone', 0, 5, -3); b('stone', -1, 5, -3); b('stone', -2, 6, -3)
  b('stone', -3, 6, -2); b('stone', -3, 7, -1); b('stone', -3, 7, 0)
  b('wood', 3, 2, 3); b('wood', 3, 3, 1); b('wood', 3, 4, -1)
  b('wood', 2, 5, -3); b('wood', 0, 6, -3); b('wood', -2, 7, -3); b('wood', -3, 8, -1)

  // ── Balcony ──
  for (let bx = -3; bx <= 3; bx++)
    for (let bz = -3; bz <= 3; bz++) {
      if (Math.abs(bx) === 3 && Math.abs(bz) === 3) continue
      if (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) continue
      b('wood', bx, 8, bz)
    }
  for (let bx = -3; bx <= 3; bx++)
    for (let bz = -3; bz <= 3; bz++) {
      if (Math.abs(bx) === 3 && Math.abs(bz) === 3) continue
      if (Math.abs(bx) === 3 || Math.abs(bz) === 3) b('wood', bx, 9, bz)
    }

  // ── Upper turret ──
  for (let h = 9; h <= 11; h++)
    for (let wx = -1; wx <= 1; wx++)
      for (let wz = -1; wz <= 1; wz++) {
        const isEdge = Math.abs(wx) === 1 || Math.abs(wz) === 1
        if (!isEdge) continue
        if (h === 10 && (wx === 0 || wz === 0) && !(wx === 0 && wz === 0)) { b('bars', wx, h, wz); continue }
        b(h === 10 ? 'wool' : 'brick', wx, h, wz, color)
      }

  // ── Spire ──
  for (let rx = -2; rx <= 2; rx++)
    for (let rz = -2; rz <= 2; rz++) {
      if (Math.abs(rx) === 2 && Math.abs(rz) === 2) continue
      b('darkwood', rx, 12, rz)
    }
  for (let rx = -1; rx <= 1; rx++)
    for (let rz = -1; rz <= 1; rz++)
      b('darkwood', rx, 13, rz)
  b('darkwood', 0, 14, 0); b('darkwood', 0, 15, 0)

  // ── Flag ──
  b('wood', 0, 16, 0); b('wool', 0, 17, 1, color); b('wool', 0, 16, 1, color)

  // ── Workstation ──
  b('wood', -4, 1, 0); b('wood', -3, 1, 0); b('wood', -4, 1, 1); b('wood', -3, 1, 1)
  b('darkwood', -4, 2, 0); b('darkwood', -3, 2, 0); b('darkwood', -4, 2, 1); b('darkwood', -3, 2, 1)
  b('wood', -4, 1, 2); b('wood', -3, 1, 2)

  // ── Campfire ──
  b('stone', 3, 1, 0); b('stone', 4, 1, 0); b('stone', 3, 1, 2); b('stone', 4, 1, 2)
  b('stone', 2, 1, 1); b('stone', 5, 1, 1)
  b('wood', 2, 1, 1); b('wood', 5, 1, 1); b('wood', 3, 1, -1); b('wood', 4, 1, -1)

  // ── Crates ──
  b('crate', 3, 1, 5); b('crate', 4, 1, 5); b('crate', 3, 2, 5)
  b('crate', -3, 1, 5); b('crate', -4, 1, 5); b('crate', -4, 1, 4)

  // ── Corner lantern posts ──
  b('wood', -4, 1, -3); b('wood', -4, 2, -3)
  b('wood', 4, 1, -3); b('wood', 4, 2, -3)

  const meshes = useMemo(() => buildMergedMeshes(blocks), [x, z, color])

  return (
    <group>
      {meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
      <Lantern position={[x - 2, 3.85, z + 6]} />
      <Lantern position={[x + 2, 3.85, z + 6]} />
      <Lantern position={[x + 3.5, 2.35, z + 1]} />
      <Lantern position={[x - 4, 3.85, z - 3]} />
      <Lantern position={[x + 4, 3.85, z - 3]} />
    </group>
  )
}
