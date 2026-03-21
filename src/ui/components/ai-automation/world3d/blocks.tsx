import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { getBlockTextures } from './textures'

export type BlockType = 'grass' | 'darkgrass' | 'dirt' | 'stone' | 'brick' | 'wood' | 'darkwood' | 'cobble' | 'sand' | 'wool' | 'leaf' | 'water' | 'bars' | 'lantern' | 'crate'

// Shared geometry for all blocks
const boxGeometry = new THREE.BoxGeometry(1, 1, 1)

// Material cache
const materialCache = new Map<string, THREE.MeshStandardMaterial[]>()

function getMaterials(type: BlockType, color?: string): THREE.MeshStandardMaterial[] {
  const key = type === 'wool' ? `wool-${color || '#B0AAA4'}` : type
  if (!materialCache.has(key)) {
    const textures = getBlockTextures(type, color)
    const isTransparent = type === 'water' || type === 'bars' || type === 'leaf'

    const getOpacity = (face: 'side' | 'top' | 'bottom') => {
      if (type === 'water') return face === 'top' ? 0.5 : face === 'bottom' ? 0.7 : 0.6
      if (type === 'leaf') return 0.85
      return 1
    }

    const sideMat = new THREE.MeshStandardMaterial({ map: textures.side, transparent: isTransparent, alphaTest: type === 'bars' ? 0.1 : 0, opacity: getOpacity('side') })
    const topMat = new THREE.MeshStandardMaterial({ map: textures.top, transparent: isTransparent, alphaTest: type === 'bars' ? 0.1 : 0, opacity: getOpacity('top') })
    const bottomMat = new THREE.MeshStandardMaterial({ map: textures.bottom, transparent: isTransparent, alphaTest: type === 'bars' ? 0.1 : 0, opacity: getOpacity('bottom') })

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
