import { useMemo, type FC } from 'react'
import { Lantern } from '../Lantern'
import { Flower } from '../Flower'
import type { BlockType } from '../blocks'
import { buildMergedMeshes } from './buildMerged'
import { WORLD_COLORS } from '../colors'

const LANTERN_Y = 1.85
const LANTERN_Z_OFFSET = 2
const FLOWER_WALL_Y = 1
const FLOWER_FENCE_Y = 0.5
const FLOWER_WALL_Z_OFFSET = -4
const FLOWER_SIDE_Z = 0
const FLOWER_SIDE_Z2 = 0.5
const FLOWER_FENCE_Z1 = 4.5
const FLOWER_FENCE_Z2 = 5

interface CottageProps {
  position: [number, number]
  color: string
}

export const Cottage: FC<CottageProps> = ({ position, color }) => {
  const [x, z] = position

  const meshes = useMemo(() => {
    const blocks: { type: BlockType; x: number; y: number; z: number; color?: string }[] = []
    const b = (type: BlockType, bx: number, by: number, bz: number, c?: string) => {
      blocks.push({ type, x: x + bx, y: by, z: z + bz, color: c })
    }

    for (let fx = -3; fx <= 3; fx++)
      for (let fz = -3; fz <= 1; fz++)
        b('wood', fx, 1, fz)

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

    for (let rx = -4; rx <= 4; rx++)
      for (let rz = -4; rz <= 2; rz++)
        b('darkwood', rx, 5, rz)
    for (let rx = -3; rx <= 3; rx++)
      for (let rz = -4; rz <= 0; rz++)
        b('darkwood', rx, 6, rz)
    for (let rx = -2; rx <= 2; rx++)
      for (let rz = -4; rz <= -2; rz++)
        b('darkwood', rx, 7, rz)

    b('brick', 2, 5, -2); b('brick', 2, 6, -2); b('brick', 2, 7, -2); b('brick', 2, 8, -2)
    b('brick', 3, 5, -2); b('brick', 3, 6, -2); b('brick', 3, 7, -2); b('brick', 3, 8, -2)

    b('wood', -3, 1, 3); b('wood', -3, 2, 3); b('wood', -3, 3, 3)
    b('wood', 3, 1, 3); b('wood', 3, 2, 3); b('wood', 3, 3, 3)
    for (let fx = -3; fx <= 3; fx++) { b('wood', fx, 1, 2); b('wood', fx, 1, 3) }
    for (let rx = -4; rx <= 4; rx++) { b('darkwood', rx, 4, 2); b('darkwood', rx, 4, 3) }

    b('stone', -1, 1, 4); b('stone', 0, 1, 4); b('stone', 1, 1, 4)

    b('wood', -2, 1, 3); b('wood', -1, 1, 3)

    b('wood', -2, 1, 2); b('wood', 1, 1, 2)

    for (let fx = -4; fx <= 4; fx++) {
      if (Math.abs(fx) <= 1) continue
      b('wood', fx, 1, 5)
    }
    for (let fz = 4; fz <= 5; fz++) { b('wood', -4, 1, fz); b('wood', 4, 1, fz) }
    b('wood', -1, 1, 5); b('wood', -1, 2, 5); b('wood', 1, 1, 5); b('wood', 1, 2, 5)

    return buildMergedMeshes(blocks)
  }, [x, z, color])

  return (
    <group>
      {meshes.map((mesh, i) => <primitive key={i} object={mesh} />)}
      <Lantern position={[x - 2, LANTERN_Y, z + LANTERN_Z_OFFSET]} />
      <Lantern position={[x + 1, LANTERN_Y, z + LANTERN_Z_OFFSET]} />
      <Flower position={[x - 1, FLOWER_WALL_Y, z + FLOWER_WALL_Z_OFFSET]} color={WORLD_COLORS.FLOWER_RED} />
      <Flower position={[x + 0, FLOWER_WALL_Y, z + FLOWER_WALL_Z_OFFSET]} color={WORLD_COLORS.FLOWER_YELLOW} />
      <Flower position={[x + 1, FLOWER_WALL_Y, z + FLOWER_WALL_Z_OFFSET]} color={WORLD_COLORS.FLOWER_RED} />
      <Flower position={[x - 4, FLOWER_WALL_Y, z + FLOWER_SIDE_Z]} color={WORLD_COLORS.FLOWER_PURPLE} />
      <Flower position={[x - 4, FLOWER_WALL_Y, z + FLOWER_SIDE_Z2]} color={WORLD_COLORS.FLOWER_WHITE} />
      <Flower position={[x + 4, FLOWER_WALL_Y, z + FLOWER_SIDE_Z]} color={WORLD_COLORS.FLOWER_YELLOW} />
      <Flower position={[x + 4, FLOWER_WALL_Y, z + FLOWER_SIDE_Z2]} color={WORLD_COLORS.FLOWER_PURPLE} />
      <Flower position={[x - 3, FLOWER_FENCE_Y, z + FLOWER_FENCE_Z1]} color={WORLD_COLORS.FLOWER_RED} />
      <Flower position={[x - 2, FLOWER_FENCE_Y, z + FLOWER_FENCE_Z2]} color={WORLD_COLORS.FLOWER_YELLOW} />
      <Flower position={[x + 2, FLOWER_FENCE_Y, z + FLOWER_FENCE_Z1]} color={WORLD_COLORS.FLOWER_WHITE} />
      <Flower position={[x + 3, FLOWER_FENCE_Y, z + FLOWER_FENCE_Z2]} color={WORLD_COLORS.FLOWER_PURPLE} />
    </group>
  )
}
