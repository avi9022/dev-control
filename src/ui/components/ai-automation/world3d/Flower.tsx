import type { FC } from 'react'

interface FlowerProps {
  position: [number, number, number]
  color?: string
}

const FLOWER_COLORS = ['#e84040', '#e8d840', '#e8e8e8', '#d040d0', '#40a0e8']

export const Flower: FC<FlowerProps> = ({ position, color }) => {
  const [x, y, z] = position
  const flowerColor = color || FLOWER_COLORS[Math.abs(Math.round(x * 7 + z * 13)) % FLOWER_COLORS.length]

  return (
    <group position={[x, y, z]}>
      {/* Stem */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.15, 0.4, 0.15]} />
        <meshStandardMaterial color="#3a7a20" />
      </mesh>
      {/* Petals */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.35, 0.25, 0.35]} />
        <meshStandardMaterial color={flowerColor} />
      </mesh>
    </group>
  )
}
