import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { getBlockTextures } from './textures'
import { WORLD_COLORS } from './colors'
import { BLOCK_SIZE, BARS_ALPHA_TEST, LEAF_OPACITY, WATER_TOP_OPACITY, WATER_SIDE_OPACITY, WATER_BOTTOM_OPACITY } from './config'

export type BlockType = 'grass' | 'darkgrass' | 'dirt' | 'stone' | 'brick' | 'wood' | 'darkwood' | 'cobble' | 'sand' | 'wool' | 'leaf' | 'water' | 'bars' | 'lantern' | 'crate'

const boxGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)

const materialCache = new Map<string, THREE.MeshStandardMaterial[]>()

function getMaterials(type: BlockType, color?: string): THREE.MeshStandardMaterial[] {
  const key = type === 'wool' ? `wool-${color || WORLD_COLORS.DEFAULT_WOOL}` : type
  if (!materialCache.has(key)) {
    const textures = getBlockTextures(type, color)
    const isTransparent = type === 'water' || type === 'bars' || type === 'leaf'

    const getOpacity = (face: 'side' | 'top' | 'bottom') => {
      if (type === 'water') return face === 'top' ? WATER_TOP_OPACITY : face === 'bottom' ? WATER_BOTTOM_OPACITY : WATER_SIDE_OPACITY
      if (type === 'leaf') return LEAF_OPACITY
      return 1
    }

    const alphaTest = type === 'bars' ? BARS_ALPHA_TEST : 0
    const sideMat = new THREE.MeshStandardMaterial({ map: textures.side, transparent: isTransparent, alphaTest, opacity: getOpacity('side') })
    const topMat = new THREE.MeshStandardMaterial({ map: textures.top, transparent: isTransparent, alphaTest, opacity: getOpacity('top') })
    const bottomMat = new THREE.MeshStandardMaterial({ map: textures.bottom, transparent: isTransparent, alphaTest, opacity: getOpacity('bottom') })

    materialCache.set(key, [sideMat, sideMat, topMat, bottomMat, sideMat, sideMat])
  }
  const materials = materialCache.get(key)
  if (!materials) return []
  return materials
}

interface BlockProps {
  type: BlockType
  position: [number, number, number]
  color?: string
}

export const Block: FC<BlockProps> = ({ type, position, color }) => {
  const materials = useMemo(() => getMaterials(type, color), [type, color])
  return <mesh position={position} geometry={boxGeometry} material={materials} />
}
