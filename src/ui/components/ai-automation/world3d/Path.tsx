import { useMemo, type FC } from 'react'
import { hash } from './utils'

interface PathProps {
  from: [number, number]
  to: [number, number]
}

export const Path: FC<PathProps> = ({ from, to }) => {
  const blocks = useMemo(() => {
    const result: [number, number, number][] = []
    const [x1, z1] = from
    const [x2, z2] = to
    const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2)
    const steps = Math.ceil(dist * 2)

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const mid = 0.5
      const curve = Math.sin(t * Math.PI) * 2 * (hash(Math.round(x1), Math.round(z1)) - 0.5)
      const x = x1 + (x2 - x1) * t + curve * (1 - Math.abs(t - mid) * 2)
      const z = z1 + (z2 - z1) * t
      const bx = Math.round(x)
      const bz = Math.round(z)
      result.push([bx + 0.5, 0.55, bz + 0.5])
      result.push([bx + 1.5, 0.55, bz + 0.5])
    }
    return result
  }, [from, to])

  return (
    <group>
      {blocks.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[1, 0.12, 1]} />
          <meshStandardMaterial color={hash(pos[0], pos[2]) > 0.3 ? '#9E9075' : '#8B7D68'} />
        </mesh>
      ))}
    </group>
  )
}
