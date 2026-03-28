import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { TERRAIN_SIZE } from './types'
import { TEXTURE_SIZE } from './config'
import { getBlockTextures } from './textures'

const BLEND_TILE_COUNT = 4
const BLEND_SIZE = TEXTURE_SIZE * BLEND_TILE_COUNT
const TOP_REPEAT_DIVISOR = 4
const SIDE_REPEAT_VERTICAL = 1
const SLAB_HEIGHT = 1
const DIRT_LAYER_Y = -1

export const Terrain: FC = () => {
  const materials = useMemo(() => {
    const darkGrassTex = getBlockTextures('darkgrass')
    const dirtTex = getBlockTextures('dirt')

    const canvas = document.createElement('canvas')
    canvas.width = BLEND_SIZE
    canvas.height = BLEND_SIZE
    const ctx = canvas.getContext('2d')
    if (!ctx) return { grassMats: [], dirtMats: [] }

    const darkCanvas = darkGrassTex.top.image as HTMLCanvasElement
    for (let tx = 0; tx < BLEND_TILE_COUNT; tx++)
      for (let tz = 0; tz < BLEND_TILE_COUNT; tz++)
        ctx.drawImage(darkCanvas, tx * TEXTURE_SIZE, tz * TEXTURE_SIZE)

    const blendedTop = new THREE.CanvasTexture(canvas)
    blendedTop.magFilter = THREE.NearestFilter
    blendedTop.minFilter = THREE.NearestFilter
    blendedTop.wrapS = THREE.RepeatWrapping
    blendedTop.wrapT = THREE.RepeatWrapping
    blendedTop.repeat.set(TERRAIN_SIZE / TOP_REPEAT_DIVISOR, TERRAIN_SIZE / TOP_REPEAT_DIVISOR)

    const tileSide = darkGrassTex.side.clone()
    tileSide.wrapS = THREE.RepeatWrapping
    tileSide.wrapT = THREE.RepeatWrapping
    tileSide.repeat.set(TERRAIN_SIZE, SIDE_REPEAT_VERTICAL)

    const tileBottom = dirtTex.top.clone()
    tileBottom.wrapS = THREE.RepeatWrapping
    tileBottom.wrapT = THREE.RepeatWrapping
    tileBottom.repeat.set(TERRAIN_SIZE, TERRAIN_SIZE)

    const tileDirtSide = dirtTex.side.clone()
    tileDirtSide.wrapS = THREE.RepeatWrapping
    tileDirtSide.wrapT = THREE.RepeatWrapping
    tileDirtSide.repeat.set(TERRAIN_SIZE, SIDE_REPEAT_VERTICAL)

    const grassMats = [
      new THREE.MeshStandardMaterial({ map: tileSide }),
      new THREE.MeshStandardMaterial({ map: tileSide }),
      new THREE.MeshStandardMaterial({ map: blendedTop }),
      new THREE.MeshStandardMaterial({ map: tileBottom }),
      new THREE.MeshStandardMaterial({ map: tileSide }),
      new THREE.MeshStandardMaterial({ map: tileSide }),
    ]

    const dirtMats = [
      new THREE.MeshStandardMaterial({ map: tileDirtSide }),
      new THREE.MeshStandardMaterial({ map: tileDirtSide }),
      new THREE.MeshStandardMaterial({ map: tileBottom }),
      new THREE.MeshStandardMaterial({ map: tileBottom }),
      new THREE.MeshStandardMaterial({ map: tileDirtSide }),
      new THREE.MeshStandardMaterial({ map: tileDirtSide }),
    ]

    return { grassMats, dirtMats }
  }, [])

  return (
    <group>
      <mesh position={[0, 0, 0]} material={materials.grassMats}>
        <boxGeometry args={[TERRAIN_SIZE, SLAB_HEIGHT, TERRAIN_SIZE]} />
      </mesh>
      <mesh position={[0, DIRT_LAYER_Y, 0]} material={materials.dirtMats}>
        <boxGeometry args={[TERRAIN_SIZE, SLAB_HEIGHT, TERRAIN_SIZE]} />
      </mesh>
    </group>
  )
}
