import type { FC } from 'react'
import { Block } from '../blocks'
import { Lantern } from '../Lantern'

interface TowerProps {
  position: [number, number]
  color: string
}

/** Watchtower compound — tower, fence, workstation, campfire, gate, supplies */
export const Tower: FC<TowerProps> = ({ position, color }) => {
  const [x, z] = position
  const blocks: JSX.Element[] = []
  let key = 0

  const b = (type: Parameters<typeof Block>[0]['type'], bx: number, by: number, bz: number, c?: string) => {
    blocks.push(<Block key={key++} type={type} position={[x + bx, 0.5 + by, z + bz]} color={c} />)
  }

  // ── Base platform — cobblestone, 11x9 ──
  for (let fx = -5; fx <= 5; fx++)
    for (let fz = -4; fz <= 6; fz++) {
      // Rounded corners
      if (Math.abs(fx) === 5 && (fz < -3 || fz > 5)) continue
      if (Math.abs(fx) === 5 && Math.abs(fz) > 3 && fz < 0) continue
      b('cobble', fx, 0, fz)
    }

  // ── Perimeter fence — wood posts with gaps for gate ──
  for (let fx = -5; fx <= 5; fx++) {
    // Back fence
    if (Math.abs(fx) < 5) b('wood', fx, 1, -4)
    // Front fence — gap for gate at center
    if (Math.abs(fx) > 1 && Math.abs(fx) < 5) b('wood', fx, 1, 6)
  }
  for (let fz = -3; fz <= 5; fz++) {
    // Left fence
    b('wood', -5, 1, fz)
    // Right fence
    b('wood', 5, 1, fz)
  }

  // ── Gate entrance — two stone pillars with beam ──
  b('stone', -1, 1, 6)
  b('stone', -1, 2, 6)
  b('stone', -1, 3, 6)
  b('stone', 1, 1, 6)
  b('stone', 1, 2, 6)
  b('stone', 1, 3, 6)
  b('darkwood', -1, 4, 6)
  b('darkwood', 0, 4, 6)
  b('darkwood', 1, 4, 6)

  // ── Torch posts at gate ──
  b('wood', -2, 1, 6)
  b('wood', -2, 2, 6)
  blocks.push(<Lantern key={key++} position={[x - 2, 3.35, z + 6]} />)
  b('wood', 2, 1, 6)
  b('wood', 2, 2, 6)
  blocks.push(<Lantern key={key++} position={[x + 2, 3.35, z + 6]} />)

  // ── Main tower body — circular, 7 high ──
  for (let h = 1; h <= 7; h++) {
    const isAccent = h === 3 || h === 6

    for (let wx = -2; wx <= 2; wx++) {
      for (let wz = -2; wz <= 2; wz++) {
        if (Math.abs(wx) === 2 && Math.abs(wz) === 2) continue
        const isEdge = Math.abs(wx) === 2 || Math.abs(wz) === 2
        const isInner = Math.abs(wx) <= 1 && Math.abs(wz) <= 1

        if (!isEdge && isInner) continue

        // Door opening
        if (wz === 2 && wx === 0 && h <= 3) continue

        // Windows at levels 4-5
        if ((h === 4 || h === 5) && (
          (wz === -2 && wx === 0) ||
          (wx === -2 && wz === 0) ||
          (wx === 2 && wz === 0)
        )) {
          b('bars', wx, h, wz)
          continue
        }

        if (isEdge || !isInner) {
          b(isAccent ? 'wool' : 'brick', wx, h, wz, color)
        }
      }
    }
  }

  // ── External staircase — wraps right side ──
  b('stone', 3, 1, 3)
  b('stone', 3, 1, 2)
  b('stone', 3, 2, 1)
  b('stone', 3, 2, 0)
  b('stone', 3, 3, -1)
  b('stone', 3, 3, -2)
  b('stone', 2, 4, -3)
  b('stone', 1, 4, -3)
  b('stone', 0, 5, -3)
  b('stone', -1, 5, -3)
  b('stone', -2, 6, -3)
  b('stone', -3, 6, -2)
  b('stone', -3, 7, -1)
  b('stone', -3, 7, 0)
  // Stair railing posts
  b('wood', 3, 2, 3)
  b('wood', 3, 3, 1)
  b('wood', 3, 4, -1)
  b('wood', 2, 5, -3)
  b('wood', 0, 6, -3)
  b('wood', -2, 7, -3)
  b('wood', -3, 8, -1)

  // ── Balcony at level 8 ──
  for (let bx = -3; bx <= 3; bx++)
    for (let bz = -3; bz <= 3; bz++) {
      if (Math.abs(bx) === 3 && Math.abs(bz) === 3) continue
      if (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) continue
      b('wood', bx, 8, bz)
    }
  // Railing
  for (let bx = -3; bx <= 3; bx++)
    for (let bz = -3; bz <= 3; bz++) {
      if (Math.abs(bx) === 3 && Math.abs(bz) === 3) continue
      if (Math.abs(bx) === 3 || Math.abs(bz) === 3)
        b('wood', bx, 9, bz)
    }

  // ── Upper turret with windows ──
  for (let h = 9; h <= 11; h++)
    for (let wx = -1; wx <= 1; wx++)
      for (let wz = -1; wz <= 1; wz++) {
        const isEdge = Math.abs(wx) === 1 || Math.abs(wz) === 1
        if (!isEdge) continue
        if (h === 10 && (wx === 0 || wz === 0) && !(wx === 0 && wz === 0)) {
          b('bars', wx, h, wz)
        } else {
          b(h === 10 ? 'wool' : 'brick', wx, h, wz, color)
        }
      }

  // ── Spire roof ──
  for (let rx = -2; rx <= 2; rx++)
    for (let rz = -2; rz <= 2; rz++) {
      if (Math.abs(rx) === 2 && Math.abs(rz) === 2) continue
      b('darkwood', rx, 12, rz)
    }
  for (let rx = -1; rx <= 1; rx++)
    for (let rz = -1; rz <= 1; rz++)
      b('darkwood', rx, 13, rz)
  b('darkwood', 0, 14, 0)
  b('darkwood', 0, 15, 0)

  // ── Flag ──
  b('wood', 0, 16, 0)
  b('wool', 0, 17, 1, color)
  b('wool', 0, 16, 1, color)

  // ── Workstation — left side of compound ──
  // Table: wood slab on 4 posts
  b('wood', -4, 1, 0)
  b('wood', -3, 1, 0)
  b('wood', -4, 1, 1)
  b('wood', -3, 1, 1)
  b('darkwood', -4, 2, 0)
  b('darkwood', -3, 2, 0)
  b('darkwood', -4, 2, 1)
  b('darkwood', -3, 2, 1)
  // Bench next to table
  b('wood', -4, 1, 2)
  b('wood', -3, 1, 2)

  // ── Campfire — right side of compound ──
  // Stone ring
  b('stone', 3, 1, 0)
  b('stone', 4, 1, 0)
  b('stone', 3, 1, 2)
  b('stone', 4, 1, 2)
  b('stone', 2, 1, 1)
  b('stone', 5, 1, 1)
  // Fire — lantern in the center
  blocks.push(<Lantern key={key++} position={[x + 3.5, 1.85, z + 1]} />)
  // Log seats around campfire
  b('wood', 2, 1, 1)
  b('wood', 5, 1, 1)
  b('wood', 3, 1, -1)
  b('wood', 4, 1, -1)

  // ── Supply crates — near gate ──
  b('crate', 3, 1, 5)
  b('crate', 4, 1, 5)
  b('crate', 3, 2, 5)
  b('crate', -3, 1, 5)
  b('crate', -4, 1, 5)
  b('crate', -4, 1, 4)

  // ── Corner lanterns inside compound ──
  b('wood', -4, 1, -3)
  b('wood', -4, 2, -3)
  blocks.push(<Lantern key={key++} position={[x - 4, 3.35, z - 3]} />)
  b('wood', 4, 1, -3)
  b('wood', 4, 2, -3)
  blocks.push(<Lantern key={key++} position={[x + 4, 3.35, z - 3]} />)

  return <group>{blocks}</group>
}
