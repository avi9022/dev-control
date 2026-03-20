import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { getBlockTextures } from './textures'

export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'darkwood' | 'cobble' | 'sand' | 'wool' | 'leaf' | 'water'

// Shared geometry for all blocks
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)

// Material cache
const materialCache = new Map<string, THREE.MeshStandardMaterial[]>()

function getMaterials(type: BlockType, color?: string): THREE.MeshStandardMaterial[] {
  const key = type === 'wool' ? `wool-${color || '#B0AAA4'}` : type
  if (!materialCache.has(key)) {
    const textures = getBlockTextures(type, color)
    const isWater = type === 'water'

    const sideMat = new THREE.MeshStandardMaterial({ map: textures.side, transparent: isWater, opacity: isWater ? 0.6 : 1 })
    const topMat = new THREE.MeshStandardMaterial({ map: textures.top, transparent: isWater, opacity: isWater ? 0.5 : 1 })
    const bottomMat = new THREE.MeshStandardMaterial({ map: textures.bottom, transparent: isWater, opacity: isWater ? 0.7 : 1 })

    // Order: +x, -x, +y (top), -y (bottom), +z, -z
    materialCache.set(key, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat])
  }
  return materialCache.get(key)!
}

interface BlockProps {
  type: BlockType
  position: [number, number, number]
  /** Only used for 'wool' type */
  color?: string
}

export const Block: FC<BlockProps> = ({ type, position, color }) => {
  const materials = useMemo(() => getMaterials(type, color), [type, color])
  return <mesh position={position} geometry={boxGeometry} material={materials} />
}
