import { useRef, useEffect, type FC } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'

import type { WorkType } from './buildings/types'

interface TaskCubeProps {
  position: [number, number, number]
  title: string
  isRunning: boolean
  needsAttention: boolean
  workType?: WorkType
  /** Direction the character faces when working (radians on Y axis) */
  faceAngle?: number
  onClick?: () => void
}

const WALK_SPEED = 4 // units per second
const STEP_FREQ = 8 // leg swings per second (not per walk)

const OUTFITS = [
  { shirt: '#4A6FA5', pants: '#3B3B5C', accent: '#3A5A8A', accessory: 'apron' as const },
  { shirt: '#8B5E3C', pants: '#4A3728', accent: '#6B4A2C', accessory: 'belt' as const },
  { shirt: '#6B8E5A', pants: '#3D4A2E', accent: '#5A7A48', accessory: 'hood' as const },
  { shirt: '#9B4D4D', pants: '#4A2828', accent: '#7A3A3A', accessory: 'shoulders' as const },
  { shirt: '#7B6DAA', pants: '#3D3550', accent: '#5A4A8A', accessory: 'hat' as const },
]

function getOutfit(title: string) {
  let h = 0
  for (let i = 0; i < title.length; i++) h = ((h << 5) - h + title.charCodeAt(i)) | 0
  return OUTFITS[Math.abs(h) % OUTFITS.length]
}

function Accessory({ type, shirtColor, accentColor }: { type: string; shirtColor: string; accentColor: string }) {
  switch (type) {
    case 'apron':
      return (
        <group>
          {/* Apron front */}
          <mesh position={[0, -0.1, 0.19]}>
            <boxGeometry args={[0.5, 0.6, 0.02]} />
            <meshStandardMaterial color="#E8E0D0" />
          </mesh>
          {/* Apron strap */}
          <mesh position={[0, 0.3, 0.19]}>
            <boxGeometry args={[0.55, 0.06, 0.02]} />
            <meshStandardMaterial color="#D0C8B8" />
          </mesh>
        </group>
      )
    case 'belt':
      return (
        <group>
          {/* Belt */}
          <mesh position={[0, -0.25, 0]}>
            <boxGeometry args={[0.65, 0.1, 0.4]} />
            <meshStandardMaterial color="#5A4020" />
          </mesh>
          {/* Buckle */}
          <mesh position={[0, -0.25, 0.2]}>
            <boxGeometry args={[0.12, 0.12, 0.02]} />
            <meshStandardMaterial color="#C8A840" />
          </mesh>
        </group>
      )
    case 'hood':
      return (
        <group>
          {/* Hood behind head */}
          <mesh position={[0, 0.75, -0.22]}>
            <boxGeometry args={[0.5, 0.4, 0.12]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {/* Cape on back */}
          <mesh position={[0, -0.05, -0.2]}>
            <boxGeometry args={[0.5, 0.7, 0.06]} />
            <meshStandardMaterial color={shirtColor} />
          </mesh>
        </group>
      )
    case 'shoulders':
      return (
        <group>
          {/* Left shoulder pad */}
          <mesh position={[-0.38, 0.35, 0]}>
            <boxGeometry args={[0.3, 0.15, 0.4]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {/* Right shoulder pad */}
          <mesh position={[0.38, 0.35, 0]}>
            <boxGeometry args={[0.3, 0.15, 0.4]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {/* Chest plate accent */}
          <mesh position={[0, 0.15, 0.19]}>
            <boxGeometry args={[0.3, 0.2, 0.02]} />
            <meshStandardMaterial color="#C8A840" />
          </mesh>
        </group>
      )
    case 'hat':
      return (
        <group>
          {/* Hat brim */}
          <mesh position={[0, 0.9, 0]}>
            <boxGeometry args={[0.55, 0.06, 0.55]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          {/* Hat cone — 3 layers */}
          <mesh position={[0, 1.05, 0]}>
            <boxGeometry args={[0.4, 0.2, 0.4]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, 1.22, 0]}>
            <boxGeometry args={[0.3, 0.2, 0.3]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, 1.38, 0]}>
            <boxGeometry args={[0.15, 0.15, 0.15]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

export const TaskCube: FC<TaskCubeProps> = ({ position, title, isRunning, needsAttention, workType, faceAngle, onClick }) => {
  const groupRef = useRef<THREE.Group>(null)
  const upperBodyRef = useRef<THREE.Group>(null)
  const headRef = useRef<THREE.Group>(null)
  const leftArmGroupRef = useRef<THREE.Group>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const rightArmGroupRef = useRef<THREE.Group>(null)
  const leftLegRef = useRef<THREE.Mesh>(null)
  const rightLegGroupRef = useRef<THREE.Group>(null)
  const rightLegRef = useRef<THREE.Mesh>(null)
  const mouthRef = useRef<THREE.Mesh>(null)

  const startPos = useRef(new THREE.Vector3(...position))
  const endPos = useRef(new THREE.Vector3(...position))
  const progress = useRef(1)
  const walkDuration = useRef(1)
  const walkTime = useRef(0)
  const initialized = useRef(false)
  const currentRotY = useRef(0)
  const targetRotY = useRef(0)

  useEffect(() => {
    const newEnd = new THREE.Vector3(...position)
    if (!initialized.current) {
      startPos.current.copy(newEnd)
      endPos.current.copy(newEnd)
      initialized.current = true
      return
    }
    if (newEnd.distanceTo(endPos.current) > 0.5) {
      if (groupRef.current) {
        startPos.current.set(groupRef.current.position.x, position[1], groupRef.current.position.z)
      }
      const dist = startPos.current.distanceTo(newEnd)
      walkDuration.current = Math.max(dist / WALK_SPEED, 0.5)
      walkTime.current = 0
      endPos.current.copy(newEnd)
      progress.current = 0
    }
  }, [position])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const isWalking = progress.current < 1

    if (isWalking) {
      progress.current = Math.min(progress.current + delta / walkDuration.current, 1)
      walkTime.current += delta
      const t = progress.current * progress.current * (3 - 2 * progress.current)

      const x = startPos.current.x + (endPos.current.x - startPos.current.x) * t
      const z = startPos.current.z + (endPos.current.z - startPos.current.z) * t
      groupRef.current.position.set(x, position[1], z)

      // Face walking direction
      const dx = endPos.current.x - startPos.current.x
      const dz = endPos.current.z - startPos.current.z
      if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
        targetRotY.current = Math.atan2(dx, dz)
      }

      // Arm swing from shoulder — constant pace regardless of distance
      const swing = Math.sin(walkTime.current * STEP_FREQ) * 0.5
      if (leftArmGroupRef.current) {
        leftArmGroupRef.current.rotation.x = swing
        leftArmGroupRef.current.rotation.z = 0
      }
      if (rightArmGroupRef.current) {
        rightArmGroupRef.current.rotation.x = -swing
        rightArmGroupRef.current.rotation.z = 0
      }
      // Leg swing from hip
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -swing * 0.7
        leftLegRef.current.rotation.z = 0
      }
      if (rightLegGroupRef.current) {
        rightLegGroupRef.current.rotation.x = swing * 0.7
        rightLegGroupRef.current.rotation.z = 0
      }
      if (headRef.current) { headRef.current.rotation.y = 0; headRef.current.rotation.x = 0 }
      if (upperBodyRef.current) { upperBodyRef.current.rotation.x = 0; upperBodyRef.current.rotation.z = 0 }
    } else if (needsAttention) {
      // Attention animation — every ~5 seconds, do a 2.5s wave gesture
      const cycle = (Date.now() % 5000) / 1000 // 0-5 seconds
      const isWaving = cycle < 2.5
      groupRef.current.position.set(endPos.current.x, position[1], endPos.current.z)

      if (isWaving) {
        const t = cycle / 2.5 // 0-1 within the wave
        const easeIn = Math.min(t / 0.2, 1) // smooth transition in
        const easeOut = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1 // smooth transition out
        const ease = easeIn * easeOut

        // Lean upper body only
        if (upperBodyRef.current) upperBodyRef.current.rotation.z = 0.25 * ease

        // Right arm reaches up and waves at the top
        if (rightArmGroupRef.current) {
          if (t < 0.2) {
            // Raise
            const raise = t / 0.2
            rightArmGroupRef.current.rotation.z = 2.2 * raise
            rightArmGroupRef.current.rotation.x = -0.5 * raise
          } else if (t < 0.75) {
            // Wave side to side at the top
            const waveT = (t - 0.2) / 0.55
            rightArmGroupRef.current.rotation.z = 2.2 + Math.sin(waveT * Math.PI * 3) * 0.4
            rightArmGroupRef.current.rotation.x = -0.5
          } else {
            // Lower
            const lower = (t - 0.75) / 0.25
            rightArmGroupRef.current.rotation.z = 2.2 * (1 - lower)
            rightArmGroupRef.current.rotation.x = -0.5 * (1 - lower)
          }
        }

        // Left arm moves slightly away from body for balance
        if (leftArmGroupRef.current) {
          leftArmGroupRef.current.rotation.z = -0.35 * ease
        }

        if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
        // Right leg lifts slightly to the right — pivot from hip
        if (rightLegGroupRef.current) {
          rightLegGroupRef.current.rotation.z = 0.3 * ease
          rightLegGroupRef.current.rotation.x = -0.2 * ease
        }

        // Head leans with the body
        if (headRef.current) {
          headRef.current.rotation.z = 0
          headRef.current.rotation.y = -0.25 * ease
          headRef.current.rotation.x = 0
        }

        // Mouth opens to O shape during wave
        if (mouthRef.current) {
          mouthRef.current.scale.set(0.7, 2.5 * ease + (1 - ease), 1)
        }
      } else {
        if (upperBodyRef.current) upperBodyRef.current.rotation.z = 0
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = 0
          rightArmGroupRef.current.rotation.z = 0
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = 0
        if (leftArmRef.current) leftArmRef.current.rotation.x = 0
        if (rightLegGroupRef.current) { rightLegGroupRef.current.rotation.x = 0; rightLegGroupRef.current.rotation.z = 0 }
        if (mouthRef.current) mouthRef.current.scale.set(1, 1, 1)
        if (headRef.current) {
          headRef.current.rotation.y = 0
          headRef.current.rotation.z = 0
          headRef.current.rotation.x = 0
        }
      }

      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
    } else if (isRunning && workType) {
      // Work animation based on type
      const t = Date.now() * 0.003
      groupRef.current.position.set(endPos.current.x, position[1], endPos.current.z)
      // Face toward building center
      if (faceAngle !== undefined) targetRotY.current = faceAngle

      if (workType === 'hammer') {
        // Hammering — right arm swings down repeatedly
        const swing = Math.sin(t * 4) * 0.8
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = -1.2 + Math.max(0, swing) * 1.0
          rightArmGroupRef.current.rotation.z = 0
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = 0
        if (leftArmRef.current) leftArmRef.current.rotation.x = -0.3
        // Slight body dip on impact
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = Math.max(0, swing) * 0.1
      } else if (workType === 'read') {
        // Reading — both arms forward, slight head bob
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = -0.8
          rightArmGroupRef.current.rotation.z = 0.3
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = -0.3
        if (leftArmRef.current) leftArmRef.current.rotation.x = -0.8
        if (headRef.current) headRef.current.rotation.x = 0.15 + Math.sin(t * 0.5) * 0.05
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = 0
      } else if (workType === 'craft') {
        // Crafting — alternating arm movements
        const alt = Math.sin(t * 3)
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = -0.6 + alt * 0.3
          rightArmGroupRef.current.rotation.z = 0
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = 0
        if (leftArmRef.current) leftArmRef.current.rotation.x = -0.6 - alt * 0.3
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = 0
      }

      if (headRef.current && workType !== 'read') {
        headRef.current.rotation.x = 0.1
        headRef.current.rotation.y = 0
        headRef.current.rotation.z = 0
      }
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
      if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
      if (rightLegGroupRef.current) { rightLegGroupRef.current.rotation.x = 0; rightLegGroupRef.current.rotation.z = 0 }
      if (mouthRef.current) mouthRef.current.scale.set(1, 1, 1)
    } else {
      const bob = isRunning ? Math.sin(Date.now() * 0.003) * 0.1 : 0
      groupRef.current.position.set(endPos.current.x, position[1] + bob, endPos.current.z)
      targetRotY.current = 0

      if (upperBodyRef.current) upperBodyRef.current.rotation.x = 0
      if (rightArmGroupRef.current) rightArmGroupRef.current.rotation.z = 0
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
      if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0
      if (headRef.current) headRef.current.rotation.y = 0
    }

    // Smooth rotation lerp — always runs
    if (groupRef.current) {
      // Shortest path rotation
      let diff = targetRotY.current - currentRotY.current
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      currentRotY.current += diff * Math.min(delta * 5, 1)
      groupRef.current.rotation.y = currentRotY.current
    }
  })

  const outfit = getOutfit(title)
  const skinColor = '#D4A97D'
  const statusColor = needsAttention ? '#D46B6B' : isRunning ? '#9BB89E' : null

  // Label height — higher for hat outfit
  const labelY = outfit.accessory === 'hat' ? 1.9 : 1.3

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      {/* Upper body — leans for attention animation */}
      <group ref={upperBodyRef}>
        {/* Body */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 0.8, 0.35]} />
          <meshStandardMaterial color={outfit.shirt} />
        </mesh>
        {/* Collar */}
        <mesh position={[0, 0.35, 0.05]}>
          <boxGeometry args={[0.4, 0.1, 0.3]} />
          <meshStandardMaterial color={outfit.accent} />
        </mesh>

        {/* Status indicator */}
        {statusColor && (
          <mesh position={[0, labelY - 0.2, 0]}>
            <boxGeometry args={[0.15, 0.15, 0.15]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.5} />
          </mesh>
        )}

        {/* Head group */}
        <group ref={headRef} position={[0, 0.65, 0]}>
          <mesh>
            <boxGeometry args={[0.45, 0.45, 0.4]} />
            <meshStandardMaterial color={skinColor} />
          </mesh>
          <mesh position={[-0.1, 0.05, 0.21]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshStandardMaterial color="#2C2825" />
          </mesh>
          <mesh position={[0.1, 0.05, 0.21]}>
            <boxGeometry args={[0.08, 0.08, 0.02]} />
            <meshStandardMaterial color="#2C2825" />
          </mesh>
          <mesh ref={mouthRef} position={[0, -0.09, 0.21]}>
            <boxGeometry args={[0.15, 0.04, 0.02]} />
            <meshStandardMaterial color="#8B6050" />
          </mesh>
        </group>

        {/* Accessory */}
        <Accessory type={outfit.accessory} shirtColor={outfit.shirt} accentColor={outfit.accent} />

        {/* Left arm */}
        <group ref={leftArmGroupRef} position={[-0.42, 0.25, 0]}>
          <mesh ref={leftArmRef} position={[0, -0.3, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.25]} />
            <meshStandardMaterial color={outfit.shirt} />
          </mesh>
        </group>

        {/* Right arm */}
        <group ref={rightArmGroupRef} position={[0.42, 0.25, 0]}>
          <mesh ref={rightArmRef} position={[0, -0.3, 0]}>
            <boxGeometry args={[0.2, 0.7, 0.25]} />
            <meshStandardMaterial color={outfit.shirt} />
          </mesh>
        </group>
      </group>

      {/* Left leg */}
      <group position={[-0.15, -0.4, 0]}>
        <mesh ref={leftLegRef} position={[0, -0.35, 0]}>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color={outfit.pants} />
        </mesh>
      </group>

      {/* Right leg */}
      <group ref={rightLegGroupRef} position={[0.15, -0.4, 0]}>
        <mesh ref={rightLegRef} position={[0, -0.35, 0]}>
          <boxGeometry args={[0.25, 0.7, 0.3]} />
          <meshStandardMaterial color={outfit.pants} />
        </mesh>
      </group>

      {/* Name label */}
      <Text
        position={[0, labelY, 0]}
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
