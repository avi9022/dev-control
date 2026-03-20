import type { FC } from 'react'
import { Text } from '@react-three/drei'

interface SignPostProps {
  position: [number, number]
  label: string
  color: string
}

export const SignPost: FC<SignPostProps> = ({ position, label, color }) => {
  const [x, z] = position
  // Place sign to the right side of the building
  const signX = x + 4
  const signZ = z

  return (
    <group position={[signX, 0.5, signZ]}>
      {/* Post */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[0.3, 3, 0.3]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      {/* Sign board */}
      <mesh position={[0, 2.8, 0.2]}>
        <boxGeometry args={[4, 1.2, 0.15]} />
        <meshStandardMaterial color="#C4A97D" />
      </mesh>
      {/* Label */}
      <Text
        position={[0, 2.8, 0.35]}
        fontSize={0.5}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#2C2825"
        maxWidth={3.5}
      >
        {label}
      </Text>
    </group>
  )
}
