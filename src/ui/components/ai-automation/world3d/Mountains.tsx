import { useMemo, useRef, useEffect, type FC } from 'react'
import * as THREE from 'three'
import { hash } from './utils'

const RING_RADIUS = 90
const MAX_HEIGHT = 14

const COLORS = {
  stone: new THREE.Color('#808080'),
  dirt: new THREE.Color('#6B5A40'),
  grass: new THREE.Color('#4a8c38'),
}

interface BlockData {
  x: number
  y: number
  z: number
  type: 'stone' | 'dirt' | 'grass'
}

/**
 * Generate a height value for a world position using layered noise.
 * Creates natural mountain terrain with peaks, valleys, and gaps.
 */
function getHeight(wx: number, wz: number): number {
  const distFromCenter = Math.sqrt(wx * wx + wz * wz)
  const angle = Math.atan2(wz, wx)

  // Vary the ring radius itself — makes it not a perfect circle
  const radiusNoise = hash(Math.round(angle * 5) + 500, 0) * 15
  const localRadius = RING_RADIUS + radiusNoise - 7

  // Smooth falloff from the local ring center
  const ringDist = Math.abs(distFromCenter - localRadius)
  const ringFalloff = Math.max(0, 1 - ringDist / 25)

  // Angular variation — creates distinct peaks and valleys/gaps
  const peakNoise = hash(Math.round(angle * 3) + 300, 42)
  const valleyMask = Math.pow(peakNoise, 0.6) // some directions are valleys (low), others are peaks (high)

  // Layered noise for surface detail
  const n1 = hash(wx * 0.15 + 50, wz * 0.15 + 50) // broad rolling hills
  const n2 = hash(wx * 0.4 + 100, wz * 0.4 + 100) * 0.5 // medium bumps
  const n3 = hash(wx * 1.2 + 200, wz * 1.2 + 200) * 0.2 // small detail
  const surfaceNoise = (n1 + n2 + n3) / 1.7

  return Math.round(MAX_HEIGHT * ringFalloff * valleyMask * surfaceNoise)
}

function generateMountainBlocks(): BlockData[] {
  const result: BlockData[] = []
  const seen = new Set<string>()

  // Sample a wide band around the ring
  for (let wx = -RING_RADIUS - 15; wx <= RING_RADIUS + 15; wx += 1) {
    for (let wz = -RING_RADIUS - 15; wz <= RING_RADIUS + 15; wz += 1) {
      const distFromCenter = Math.sqrt(wx * wx + wz * wz)
      // Only generate in the mountain band
      if (distFromCenter < RING_RADIUS - 30 || distFromCenter > RING_RADIUS + 20) continue

      const height = getHeight(wx, wz)
      if (height <= 0) continue

      const key = `${wx},${wz}`
      if (seen.has(key)) continue
      seen.add(key)

      for (let y = 0; y < height; y++) {
        const isTop = y === height - 1
        const isNearTop = y >= height - 2
        result.push({
          x: wx,
          y: y + 0.5,
          z: wz,
          type: isTop ? 'grass' : isNearTop ? 'dirt' : 'stone',
        })
      }
    }
  }

  return result
}

function MountainLayer({ blocks, color }: { blocks: BlockData[]; color: THREE.Color }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, blocks.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

export const Mountains: FC = () => {
  const { stone, dirt, grass } = useMemo(() => {
    const allBlocks = generateMountainBlocks()
    return {
      stone: allBlocks.filter(b => b.type === 'stone'),
      dirt: allBlocks.filter(b => b.type === 'dirt'),
      grass: allBlocks.filter(b => b.type === 'grass'),
    }
  }, [])

  return (
    <group>
      <MountainLayer blocks={stone} color={COLORS.stone} />
      <MountainLayer blocks={dirt} color={COLORS.dirt} />
      <MountainLayer blocks={grass} color={COLORS.grass} />
    </group>
  )
}
