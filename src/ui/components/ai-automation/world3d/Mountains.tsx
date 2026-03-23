import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash } from './utils'
import { getBlockTextures } from './textures'

const EDGE_START = 75
const MAX_HEIGHT = 25
const STEP = 2
const WORLD_EXTENT = 99
const EDGE_OUTER = 100
const NOISE_SCALE_SMALL = 8
const NOISE_SCALE_LARGE = 14
const NOISE_SMALL_WEIGHT = 0.6
const NOISE_LARGE_WEIGHT = 0.4
const NOISE_SEED_SMALL = 50
const NOISE_SEED_LARGE = 100
const PEAK_NOISE_SCALE = 5
const PEAK_NOISE_SEED = 300
const PEAK_NOISE_ANGULAR_SCALE = 1
const VALLEY_MASK_BASE = 0.3
const VALLEY_MASK_RANGE = 0.7
const SURFACE_NOISE_BASE = 0.4
const SURFACE_NOISE_RANGE = 0.6
const BLEND_START_HEIGHT = 4
const BLEND_END_HEIGHT = 12
const HASH_OFFSET = 999

function smoothNoise(wx: number, wz: number, scale: number, seed: number): number {
  const sx = wx / scale
  const sz = wz / scale
  const x0 = Math.floor(sx)
  const z0 = Math.floor(sz)
  const fx = sx - x0
  const fz = sz - z0
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)

  const n00 = hash(x0 + seed, z0 + seed)
  const n10 = hash(x0 + 1 + seed, z0 + seed)
  const n01 = hash(x0 + seed, z0 + 1 + seed)
  const n11 = hash(x0 + 1 + seed, z0 + 1 + seed)

  const nx0 = n00 * (1 - ux) + n10 * ux
  const nx1 = n01 * (1 - ux) + n11 * ux
  return nx0 * (1 - uz) + nx1 * uz
}

function getHeight(wx: number, wz: number): number {
  const distFromCenter = Math.sqrt(wx * wx + wz * wz)
  if (distFromCenter < EDGE_START) return 0

  const edgeFactor = Math.max(0, (distFromCenter - EDGE_START) / (EDGE_OUTER - EDGE_START))
  const surfaceNoise = smoothNoise(wx, wz, NOISE_SCALE_SMALL, NOISE_SEED_SMALL) * NOISE_SMALL_WEIGHT + smoothNoise(wx, wz, NOISE_SCALE_LARGE, NOISE_SEED_LARGE) * NOISE_LARGE_WEIGHT
  const angle = Math.atan2(wz, wx)
  const peakNoise = smoothNoise(angle * PEAK_NOISE_SCALE, 0, PEAK_NOISE_ANGULAR_SCALE, PEAK_NOISE_SEED)
  const valleyMask = VALLEY_MASK_BASE + peakNoise * VALLEY_MASK_RANGE
  const curve = edgeFactor * edgeFactor * edgeFactor

  return Math.round(MAX_HEIGHT * curve * (SURFACE_NOISE_BASE + surfaceNoise * SURFACE_NOISE_RANGE) * valleyMask)
}

type LayerType = 'stone' | 'dirt' | 'darkgrass' | 'grass'

interface BlockPos { x: number; y: number; z: number }

function generateMountainBlocks(): Record<LayerType, BlockPos[]> {
  const layers: Record<LayerType, BlockPos[]> = { stone: [], dirt: [], darkgrass: [], grass: [] }

  for (let wx = -WORLD_EXTENT; wx <= WORLD_EXTENT; wx += STEP) {
    for (let wz = -WORLD_EXTENT; wz <= WORLD_EXTENT; wz += STEP) {
      const distFromCenter = Math.sqrt(wx * wx + wz * wz)
      if (distFromCenter < EDGE_START) continue

      const height = getHeight(wx, wz)
      if (height <= 0) continue

      for (let y = 0; y < height; y += STEP) {
        const isTop = y + STEP >= height
        const isNearTop = y + STEP * 2 >= height
        const block = { x: wx, y: y + STEP / 2, z: wz }

        if (isTop) {
          const blend = Math.max(0, Math.min(1, (height - BLEND_START_HEIGHT) / (BLEND_END_HEIGHT - BLEND_START_HEIGHT)))
          const roll = hash(wx + HASH_OFFSET, wz + HASH_OFFSET)
          if (roll < blend) layers.grass.push(block)
          else layers.darkgrass.push(block)
        } else if (isNearTop) {
          layers.dirt.push(block)
        } else {
          layers.stone.push(block)
        }
      }
    }
  }

  return layers
}

function buildMergedMesh(blocks: BlockPos[], type: LayerType): THREE.Mesh | null {
  if (blocks.length === 0) return null

  const box = new THREE.BoxGeometry(STEP, STEP, STEP)
  const geometries: THREE.BufferGeometry[] = []

  for (const { x, y, z } of blocks) {
    const geo = box.clone()
    geo.translate(x, y, z)
    geometries.push(geo)
  }

  const merged = mergeGeometries(geometries, false)
  if (!merged) return null

  const textures = getBlockTextures(type)
  const material = new THREE.MeshStandardMaterial({ map: textures.top })
  return new THREE.Mesh(merged, material)
}

export const Mountains: FC = () => {
  const meshes = useMemo(() => {
    const layers = generateMountainBlocks()
    return {
      stone: buildMergedMesh(layers.stone, 'stone'),
      dirt: buildMergedMesh(layers.dirt, 'dirt'),
      darkgrass: buildMergedMesh(layers.darkgrass, 'darkgrass'),
      grass: buildMergedMesh(layers.grass, 'grass'),
    }
  }, [])

  return (
    <group>
      {meshes.stone && <primitive object={meshes.stone} />}
      {meshes.dirt && <primitive object={meshes.dirt} />}
      {meshes.darkgrass && <primitive object={meshes.darkgrass} />}
      {meshes.grass && <primitive object={meshes.grass} />}
    </group>
  )
}
