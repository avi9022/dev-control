import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { TERRAIN_SIZE } from './types'
import { getBlockTextures } from './textures'

/** Large flat terrain — grass with dark grass patches */
export const Terrain: FC = () => {
  const materials = useMemo(() => {
    const grassTex = getBlockTextures('grass')
    const darkGrassTex = getBlockTextures('darkgrass')
    const dirtTex = getBlockTextures('dirt')

    // Create a blended top texture — patches of dark grass on regular grass
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!

    // Use dark grass for the entire terrain
    const darkCanvas = darkGrassTex.top.image as HTMLCanvasElement
    for (let tx = 0; tx < 4; tx++)
      for (let tz = 0; tz < 4; tz++)
        ctx.drawImage(darkCanvas, tx * 16, tz * 16)

    const blendedTop = new THREE.CanvasTexture(canvas)
    blendedTop.magFilter = THREE.NearestFilter
    blendedTop.minFilter = THREE.NearestFilter
    blendedTop.wrapS = THREE.RepeatWrapping
    blendedTop.wrapT = THREE.RepeatWrapping
    blendedTop.repeat.set(TERRAIN_SIZE / 4, TERRAIN_SIZE / 4)

    // Side texture — tile dark grass side
    const tileSide = darkGrassTex.side.clone()
    tileSide.wrapS = THREE.RepeatWrapping
    tileSide.wrapT = THREE.RepeatWrapping
    tileSide.repeat.set(TERRAIN_SIZE, 1)

    const tileBottom = dirtTex.top.clone()
    tileBottom.wrapS = THREE.RepeatWrapping
    tileBottom.wrapT = THREE.RepeatWrapping
    tileBottom.repeat.set(TERRAIN_SIZE, TERRAIN_SIZE)

    const tileDirtSide = dirtTex.side.clone()
    tileDirtSide.wrapS = THREE.RepeatWrapping
    tileDirtSide.wrapT = THREE.RepeatWrapping
    tileDirtSide.repeat.set(TERRAIN_SIZE, 1)

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
        <boxGeometry args={[TERRAIN_SIZE, 1, TERRAIN_SIZE]} />
      </mesh>
      <mesh position={[0, -1, 0]} material={materials.dirtMats}>
        <boxGeometry args={[TERRAIN_SIZE, 1, TERRAIN_SIZE]} />
      </mesh>
    </group>
  )
}
