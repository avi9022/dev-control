import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getBlockTextures } from '../textures'
import type { BlockType } from '../blocks'
import { WORLD_COLORS } from '../colors'
import { BARS_ALPHA_TEST, BLOCK_SIZE, DEFAULT_ALPHA_TEST, DEFAULT_OPACITY, LEAF_OPACITY, WATER_SIDE_OPACITY } from '../config'

interface PlacedBlock {
  type: BlockType
  x: number
  y: number
  z: number
  color?: string
}

export function buildMergedMeshes(blocks: PlacedBlock[]): THREE.Mesh[] {
  const groups = new Map<string, { type: BlockType; positions: [number, number, number][]; color?: string }>()

  for (const block of blocks) {
    const key = block.type === 'wool' ? `wool-${block.color || WORLD_COLORS.DEFAULT_WOOL}` : block.type
    let group = groups.get(key)
    if (!group) {
      group = { type: block.type, positions: [], color: block.color }
      groups.set(key, group)
    }
    group.positions.push([block.x, block.y, block.z])
  }

  const meshes: THREE.Mesh[] = []
  const box = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)

  for (const [, group] of groups) {
    if (group.positions.length === 0) continue

    const geometries: THREE.BufferGeometry[] = []
    for (const [x, y, z] of group.positions) {
      const geo = box.clone()
      geo.translate(x, y, z)
      geometries.push(geo)
    }

    const merged = mergeGeometries(geometries, false)
    if (!merged) continue

    const textures = getBlockTextures(group.type, group.color)
    const isTransparent = group.type === 'bars' || group.type === 'leaf' || group.type === 'water'

    const material = new THREE.MeshStandardMaterial({
      map: textures.top,
      transparent: isTransparent,
      alphaTest: group.type === 'bars' ? BARS_ALPHA_TEST : DEFAULT_ALPHA_TEST,
      opacity: group.type === 'leaf' ? LEAF_OPACITY : group.type === 'water' ? WATER_SIDE_OPACITY : DEFAULT_OPACITY,
    })

    meshes.push(new THREE.Mesh(merged, material))
  }

  return meshes
}
