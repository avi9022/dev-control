import { useMemo, useRef, useEffect, type FC } from 'react'
import * as THREE from 'three'
import { hash } from './utils'
import { getBlockTextures } from './textures'

const EDGE_START = 75
const MAX_HEIGHT = 25

/** Bilinear interpolated noise — produces smooth continuous values */
function smoothNoise(wx: number, wz: number, scale: number, seed: number): number {
  const sx = wx / scale
  const sz = wz / scale
  const x0 = Math.floor(sx)
  const z0 = Math.floor(sz)
  const fx = sx - x0
  const fz = sz - z0

  // Smoothstep interpolation
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)

  // Four corner samples
  const n00 = hash(x0 + seed, z0 + seed)
  const n10 = hash(x0 + 1 + seed, z0 + seed)
  const n01 = hash(x0 + seed, z0 + 1 + seed)
  const n11 = hash(x0 + 1 + seed, z0 + 1 + seed)

  // Bilinear interpolation
  const nx0 = n00 * (1 - ux) + n10 * ux
  const nx1 = n01 * (1 - ux) + n11 * ux
  return nx0 * (1 - uz) + nx1 * uz
}

interface BlockData {
  x: number
  y: number
  z: number
}

function getHeight(wx: number, wz: number): number {
  // Use distance from center (circular) to avoid square corners
  const distFromCenter = Math.sqrt(wx * wx + wz * wz)

  // Mountains start at EDGE_START distance from center
  if (distFromCenter < EDGE_START) return 0

  // Height increases with distance from the start ring
  const edgeFactor = Math.max(0, (distFromCenter - EDGE_START) / (100 - EDGE_START))

  // Bilinear interpolated noise — smooth hills without stair-stepping
  const surfaceNoise = smoothNoise(wx, wz, 8, 50) * 0.6 + smoothNoise(wx, wz, 14, 100) * 0.4

  // Angular variation — broad peaks and valleys
  const angle = Math.atan2(wz, wx)
  const peakNoise = smoothNoise(angle * 5, 0, 1, 300)
  const valleyMask = 0.3 + peakNoise * 0.7

  // Smooth cubic curve from edge
  const curve = edgeFactor * edgeFactor * edgeFactor

  return Math.round(MAX_HEIGHT * curve * (0.4 + surfaceNoise * 0.6) * valleyMask)
}

function generateMountainBlocks(): { stone: BlockData[]; dirt: BlockData[]; darkgrass: BlockData[]; grass: BlockData[] } {
  const stone: BlockData[] = []
  const dirt: BlockData[] = []
  const darkgrass: BlockData[] = []
  const grass: BlockData[] = []
  const seen = new Set<string>()

  for (let wx = -99; wx <= 99; wx += 1) {
    for (let wz = -99; wz <= 99; wz += 1) {
      // Only process blocks beyond the mountain start radius
      const distFromCenter = Math.sqrt(wx * wx + wz * wz)
      if (distFromCenter < EDGE_START) continue

      const height = getHeight(wx, wz)
      if (height <= 0) continue

      const key = `${wx},${wz}`
      if (seen.has(key)) continue
      seen.add(key)

      for (let y = 0; y < height; y++) {
        const isTop = y === height - 1
        const isNearTop = y >= height - 2
        const block = { x: wx, y: y + 0.5, z: wz }

        if (isTop) {
          // Blend zone: between height 4 and 12, probability of light grass increases
          const blendStart = 4
          const blendEnd = 12
          const blend = Math.max(0, Math.min(1, (height - blendStart) / (blendEnd - blendStart)))
          // Use hash for per-column randomness in the blend zone
          const roll = hash(wx + 999, wz + 999)
          if (roll < blend) grass.push(block)
          else darkgrass.push(block)
        }
        else if (isNearTop) dirt.push(block)
        else stone.push(block)
      }
    }
  }

  return { stone, dirt, darkgrass, grass }
}

function MountainLayer({ blocks, type }: { blocks: BlockData[]; type: 'stone' | 'dirt' | 'grass' }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const materials = useMemo(() => {
    const textures = getBlockTextures(type)
    const side = new THREE.MeshStandardMaterial({ map: textures.side })
    const top = new THREE.MeshStandardMaterial({ map: textures.top })
    const bottom = new THREE.MeshStandardMaterial({ map: textures.bottom })
    // +x, -x, +y, -y, +z, -z
    return [side, side, top, bottom, side, side]
  }, [type])

  useEffect(() => {
    if (!meshRef.current) return
    blocks.forEach((block, i) => {
      dummy.position.set(block.x, block.y, block.z)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [blocks, dummy])

  if (blocks.length === 0) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, blocks.length]} material={materials}>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  )
}

export const Mountains: FC = () => {
  const { stone, dirt, darkgrass, grass } = useMemo(() => generateMountainBlocks(), [])

  return (
    <group>
      <MountainLayer blocks={stone} type="stone" />
      <MountainLayer blocks={dirt} type="dirt" />
      <MountainLayer blocks={darkgrass} type="darkgrass" />
      <MountainLayer blocks={grass} type="grass" />
    </group>
  )
}
