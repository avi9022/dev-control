import { useMemo, type FC } from 'react'
import { Block } from './blocks'
import { hash } from './utils'

interface PathProps {
  from: [number, number]
  to: [number, number]
}

export const Path: FC<PathProps> = ({ from, to }) => {
  const blocks = useMemo(() => {
    const result: { pos: [number, number, number]; key: number }[] = []
    const [x1, z1] = from
    const [x2, z2] = to
    const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2)
    const steps = Math.ceil(dist * 2)
    const seen = new Set<string>()
    let key = 0

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const mid = 0.5
      const curve = Math.sin(t * Math.PI) * 2 * (hash(Math.round(x1), Math.round(z1)) - 0.5)
      const x = x1 + (x2 - x1) * t + curve * (1 - Math.abs(t - mid) * 2)
      const z = z1 + (z2 - z1) * t
      const bx = Math.round(x)
      const bz = Math.round(z)

      // Avoid duplicate positions
      for (let w = 0; w < 2; w++) {
        const k = `${bx + w},${bz}`
        if (!seen.has(k)) {
          seen.add(k)
          result.push({ pos: [bx + w + 0.5, 0.02, bz + 0.5], key: key++ })
        }
      }
    }
    return result
  }, [from, to])

  return (
    <group>
      {blocks.map(({ pos, key }) => (
        <Block key={key} type="cobble" position={pos} />
      ))}
    </group>
  )
}
