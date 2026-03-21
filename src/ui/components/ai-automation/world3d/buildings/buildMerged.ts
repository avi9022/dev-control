import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getBlockTextures } from '../textures'
import type { BlockType } from '../blocks'

interface PlacedBlock {
  type: BlockType
  x: number
  y: number
  z: number
  color?: string
}

/**
 * Merge all blocks of the same type into single meshes.
 * Returns an array of Three.js meshes ready to render via <primitive>.
 * Transparent blocks (bars, leaf, water) are kept separate.
 */
export function buildMergedMeshes(blocks: PlacedBlock[]): THREE.Mesh[] {
  // Group by type+color key
  const groups = new Map<string, { type: BlockType; positions: [number, number, number][]; color?: string }>()

  for (const block of blocks) {
    const key = block.type === 'wool' ? `wool-${block.color || '#B0AAA4'}` : block.type
    if (!groups.has(key)) {
      groups.set(key, { type: block.type, positions: [], color: block.color })
    }
    groups.get(key)!.positions.push([block.x, block.y, block.z])
  }

  const meshes: THREE.Mesh[] = []
  const box = new THREE.BoxGeometry(1, 1, 1)

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
      alphaTest: group.type === 'bars' ? 0.1 : 0,
      opacity: group.type === 'leaf' ? 0.85 : group.type === 'water' ? 0.6 : 1,
    })

    meshes.push(new THREE.Mesh(merged, material))
  }

  return meshes
}
