import type { FC } from 'react'
import { Text } from '@react-three/drei'
import { Block } from './blocks'

interface SignPostProps {
  position: [number, number]
  label: string
  color: string
}

export const SignPost: FC<SignPostProps> = ({ position, label, color }) => {
  const [x, z] = position
  const postX = x
  const postZ = z + 4

  return (
    <group>
      {/* Post — 3 wood blocks tall */}
      <Block type="wood" position={[postX, 1.5, postZ]} />
      <Block type="wood" position={[postX, 2.5, postZ]} />
      <Block type="wood" position={[postX, 3.5, postZ]} />
      {/* Sign board — sand block */}
      <Block type="sand" position={[postX, 4.5, postZ]} />
      {/* Label */}
      <Text
        position={[postX, 4.5, postZ + 0.55]}
        fontSize={0.45}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#2C2825"
        maxWidth={3}
      >
        {label}
      </Text>
    </group>
  )
}
