import { useMemo, type FC } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hash } from './utils'
import { getBlockTextures } from './textures'

interface PathProps {
  from: [number, number]
  to: [number, number]
}

export const Path: FC<PathProps> = ({ from, to }) => {
  const mesh = useMemo(() => {
    const [x1, z1] = from
    const [x2, z2] = to
    const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2)
    const steps = Math.ceil(dist * 2)
    const seen = new Set<string>()
    const box = new THREE.BoxGeometry(1, 1, 1)
    const geometries: THREE.BufferGeometry[] = []

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const mid = 0.5
      const curve = Math.sin(t * Math.PI) * 2 * (hash(Math.round(x1), Math.round(z1)) - 0.5)
      const x = x1 + (x2 - x1) * t + curve * (1 - Math.abs(t - mid) * 2)
      const z = z1 + (z2 - z1) * t
      const bx = Math.round(x)
      const bz = Math.round(z)

      for (let w = 0; w < 2; w++) {
        const k = `${bx + w},${bz}`
        if (!seen.has(k)) {
          seen.add(k)
          const geo = box.clone()
          geo.translate(bx + w + 0.5, 0.02, bz + 0.5)
          geometries.push(geo)
        }
      }
    }

    if (geometries.length === 0) return null
    const merged = mergeGeometries(geometries, false)
    if (!merged) return null

    const tex = getBlockTextures('cobble')
    const mat = new THREE.MeshStandardMaterial({ map: tex.top })
    return new THREE.Mesh(merged, mat)
  }, [from, to])

  if (!mesh) return null
  return <primitive object={mesh} />
}
