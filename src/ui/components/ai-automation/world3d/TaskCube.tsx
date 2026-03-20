import { useRef, type FC } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import type { Mesh } from 'three'

interface TaskCubeProps {
  position: [number, number, number]
  title: string
  isRunning: boolean
  needsAttention: boolean
  onClick?: () => void
}

export const TaskCube: FC<TaskCubeProps> = ({ position, title, isRunning, needsAttention, onClick }) => {
  const meshRef = useRef<Mesh>(null)

  // Gentle bob for running tasks
  useFrame(({ clock }) => {
    if (!meshRef.current || !isRunning) return
    meshRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2) * 0.15
  })

  const color = needsAttention ? '#D46B6B' : isRunning ? '#9BB89E' : '#B0AAA4'

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        onClick={(e) => {
          e.stopPropagation()
          onClick?.()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color={color} />
        {/* Head */}
      </mesh>
      {/* Head on top */}
      <mesh position={[position[0], position[1] + 0.85, position[2]]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Name label */}
      <Text
        position={[position[0], position[1] + 1.6, position[2]]}
        fontSize={0.3}
        color="#FAF9F7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#1C1917"
        maxWidth={4}
      >
        {title}
      </Text>
    </group>
  )
}
