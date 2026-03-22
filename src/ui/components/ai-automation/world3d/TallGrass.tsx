import type { FC, JSX } from 'react'
import { hash } from './utils'

interface TallGrassProps {
  position: [number, number, number]
}

/** A cluster of grass blades — thin, varied, some bent at the tip */
export const TallGrass: FC<TallGrassProps> = ({ position }) => {
  const [x, y, z] = position
  const seed = Math.abs(Math.round(x * 11 + z * 7))
  const bladeCount = 5 + Math.floor(hash(seed, 0) * 6) // 5-10 blades

  const blades: JSX.Element[] = []
  for (let i = 0; i < bladeCount; i++) {
    const h = hash(seed, i)
    const height = 0.5 + h * 0.6
    const ox = (hash(seed + i, 1) - 0.5) * 0.8
    const oz = (hash(seed + i, 2) - 0.5) * 0.8
    const tiltX = (hash(seed + i, 3) - 0.5) * 0.5
    const tiltZ = (hash(seed + i, 4) - 0.5) * 0.5
    const shade = 0.25 + h * 0.2
    const color = `rgb(${Math.round(shade * 180)}, ${Math.round(120 + shade * 160)}, ${Math.round(shade * 80)})`

    // Main blade
    blades.push(
      <mesh key={`b-${i}`} position={[x + ox, y + height * 0.4, z + oz]} rotation={[tiltX, 0, tiltZ]}>
        <boxGeometry args={[0.04, height * 0.8, 0.04]} />
        <meshStandardMaterial color={color} />
      </mesh>
    )

    // Tip — bent slightly more for realism
    if (height > 0.7) {
      blades.push(
        <mesh key={`t-${i}`} position={[x + ox + tiltZ * 0.3, y + height * 0.75, z + oz + tiltX * 0.3]} rotation={[tiltX * 1.5, 0, tiltZ * 1.5]}>
          <boxGeometry args={[0.03, height * 0.3, 0.03]} />
          <meshStandardMaterial color={color} />
        </mesh>
      )
    }
  }

  return <group>{blades}</group>
}
