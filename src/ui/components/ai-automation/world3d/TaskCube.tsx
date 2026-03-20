import { useRef, useEffect, type FC } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

interface TaskCubeProps {
  position: [number, number, number]
  title: string
  isRunning: boolean
  needsAttention: boolean
  onClick?: () => void
}

const WALK_DURATION = 2 // seconds
const STEP_BOUNCE = 0.25
const STEP_FREQ = 10

export const TaskCube: FC<TaskCubeProps> = ({ position, title, isRunning, needsAttention, onClick }) => {
  const groupRef = useRef<THREE.Group>(null)
  const startPos = useRef(new THREE.Vector3(...position))
  const endPos = useRef(new THREE.Vector3(...position))
  const progress = useRef(1) // 1 = arrived, <1 = walking
  const initialized = useRef(false)

  useEffect(() => {
    const newEnd = new THREE.Vector3(...position)

    if (!initialized.current) {
      // First render — snap to position
      startPos.current.copy(newEnd)
      endPos.current.copy(newEnd)
      initialized.current = true
      return
    }

    if (newEnd.distanceTo(endPos.current) > 0.5) {
      // New destination — start walking from current rendered position
      if (groupRef.current) {
        startPos.current.set(groupRef.current.position.x, position[1], groupRef.current.position.z)
      }
      endPos.current.copy(newEnd)
      progress.current = 0
    }
  }, [position])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    if (progress.current < 1) {
      // Walking
      progress.current = Math.min(progress.current + delta / WALK_DURATION, 1)
      const t = progress.current * progress.current * (3 - 2 * progress.current) // smoothstep

      const x = startPos.current.x + (endPos.current.x - startPos.current.x) * t
      const z = startPos.current.z + (endPos.current.z - startPos.current.z) * t
      const bounce = Math.abs(Math.sin(progress.current * STEP_FREQ * Math.PI)) * STEP_BOUNCE * (1 - progress.current)

      groupRef.current.position.set(x, position[1] + bounce, z)
    } else {
      // Idle
      const bob = isRunning ? Math.sin(Date.now() * 0.003) * 0.1 : 0
      groupRef.current.position.set(endPos.current.x, position[1] + bob, endPos.current.z)
    }
  })

  const color = needsAttention ? '#D46B6B' : isRunning ? '#9BB89E' : '#B0AAA4'

  return (
    <group
      ref={groupRef}
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
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Name label */}
      <Text
        position={[0, 1.6, 0]}
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
