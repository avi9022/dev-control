import { useRef, useEffect, useCallback, type FC } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { WORLD_COLORS } from './colors'
import { LABEL_FONT_SIZE, LABEL_OUTLINE_WIDTH } from './config'

import type { WorkType } from './buildings/types'

const WALK_SPEED = 4
const STEP_FREQ = 8
const MIN_WALK_DURATION = 0.3
const WALK_DIRECTION_THRESHOLD = 0.1
const ROTATION_LERP_SPEED = 5

const ARM_SWING_AMPLITUDE = 0.5
const LEG_SWING_RATIO = 0.7

const ATTENTION_CYCLE_MS = 5000
const ATTENTION_CYCLE_S = 1000
const WAVE_DURATION_S = 2.5
const WAVE_EASE_IN_DURATION = 0.2
const WAVE_EASE_OUT_START = 0.8
const WAVE_RAISE_END = 0.2
const WAVE_MIDDLE_END = 0.75
const WAVE_LOWER_START = 0.75
const WAVE_ARM_RAISE_ANGLE = 2.2
const WAVE_ARM_FORWARD = -0.5
const WAVE_OSCILLATION_AMPLITUDE = 0.4
const WAVE_OSCILLATION_CYCLES = 3
const BODY_LEAN = 0.25
const LEFT_ARM_BALANCE = -0.35
const LEG_LIFT_Z = 0.3
const LEG_LIFT_X = -0.2
const HEAD_YAW = -0.25
const MOUTH_OPEN_SCALE_Y = 2.5
const MOUTH_OPEN_SCALE_X = 0.7

const IDLE_BOB_SPEED = 0.003
const IDLE_BOB_AMPLITUDE = 0.1
const WORK_ANIM_SPEED = 0.003

const HAMMER_SWING_SPEED = 4
const HAMMER_ARM_BASE = -1.2
const HAMMER_ARM_SWING = 1.0
const HAMMER_SWING_AMPLITUDE = 0.8
const HAMMER_LEFT_ARM = -0.3
const HAMMER_BODY_DIP = 0.1

const READ_ARM_PITCH = -0.8
const READ_ARM_SPLAY = 0.3
const READ_HEAD_PITCH = 0.15
const READ_HEAD_BOB_SPEED = 0.5
const READ_HEAD_BOB_AMPLITUDE = 0.05

const CRAFT_SPEED = 3
const CRAFT_ARM_BASE = -0.6
const CRAFT_ARM_SWING = 0.3

const HEAD_WORK_PITCH = 0.1
const STATUS_EMISSIVE_INTENSITY = 0.5

const LABEL_MAX_WIDTH = 4
const LABEL_Y_DEFAULT = 1.3
const LABEL_Y_HAT = 1.9
const STATUS_OFFSET_Y = -0.2
const STATUS_SIZE = 0.15

const BODY_WIDTH = 0.6
const BODY_HEIGHT = 0.8
const BODY_DEPTH = 0.35
const COLLAR_WIDTH = 0.4
const COLLAR_HEIGHT = 0.1
const COLLAR_DEPTH = 0.3
const COLLAR_Y = 0.35
const COLLAR_Z = 0.05

const HEAD_SIZE_X = 0.45
const HEAD_SIZE_Y = 0.45
const HEAD_SIZE_Z = 0.4
const HEAD_Y = 0.65

const EYE_SIZE = 0.08
const EYE_DEPTH = 0.02
const EYE_Y = 0.05
const EYE_Z = 0.21
const EYE_X_OFFSET = 0.1

const MOUTH_WIDTH = 0.15
const MOUTH_HEIGHT = 0.04
const MOUTH_DEPTH = 0.02
const MOUTH_Y = -0.09
const MOUTH_Z = 0.21

const ARM_WIDTH = 0.2
const ARM_HEIGHT = 0.7
const ARM_DEPTH = 0.25
const ARM_X = 0.42
const ARM_PIVOT_Y = 0.25
const ARM_MESH_Y = -0.3

const LEG_WIDTH = 0.25
const LEG_HEIGHT = 0.7
const LEG_DEPTH = 0.3
const LEG_X = 0.15
const LEG_PIVOT_Y = -0.4
const LEG_MESH_Y = -0.35

const APRON_WIDTH = 0.5
const APRON_HEIGHT = 0.6
const APRON_DEPTH = 0.02
const APRON_Y = -0.1
const APRON_Z = 0.19
const APRON_STRAP_WIDTH = 0.55
const APRON_STRAP_HEIGHT = 0.06
const APRON_STRAP_Y = 0.3

const BELT_WIDTH = 0.65
const BELT_HEIGHT = 0.1
const BELT_DEPTH = 0.4
const BELT_Y = -0.25
const BUCKLE_SIZE = 0.12
const BUCKLE_DEPTH = 0.02
const BUCKLE_Z = 0.2

const HOOD_WIDTH = 0.5
const HOOD_HEIGHT = 0.4
const HOOD_DEPTH = 0.12
const HOOD_Y = 0.75
const HOOD_Z = -0.22
const CAPE_WIDTH = 0.5
const CAPE_HEIGHT = 0.7
const CAPE_DEPTH = 0.06
const CAPE_Y = -0.05
const CAPE_Z = -0.2

const SHOULDER_PAD_WIDTH = 0.3
const SHOULDER_PAD_HEIGHT = 0.15
const SHOULDER_PAD_DEPTH = 0.4
const SHOULDER_PAD_X = 0.38
const SHOULDER_PAD_Y = 0.35
const CHEST_PLATE_WIDTH = 0.3
const CHEST_PLATE_HEIGHT = 0.2
const CHEST_PLATE_DEPTH = 0.02
const CHEST_PLATE_Y = 0.15
const CHEST_PLATE_Z = 0.19

const HAT_BRIM_WIDTH = 0.55
const HAT_BRIM_HEIGHT = 0.06
const HAT_BRIM_DEPTH = 0.55
const HAT_BRIM_Y = 0.9
const HAT_BASE_SIZE = 0.4
const HAT_BASE_HEIGHT = 0.2
const HAT_BASE_Y = 1.05
const HAT_MID_SIZE = 0.3
const HAT_MID_HEIGHT = 0.2
const HAT_MID_Y = 1.22
const HAT_TIP_SIZE = 0.15
const HAT_TIP_HEIGHT = 0.15
const HAT_TIP_Y = 1.38

interface TaskCubeProps {
  position: [number, number, number]
  title: string
  isRunning: boolean
  needsAttention: boolean
  workType?: WorkType
  faceAngle?: number
  route?: [number, number][]
  onClick?: () => void
}

const OUTFITS = [
  { shirt: WORLD_COLORS.OUTFIT_BLUE_SHIRT, pants: WORLD_COLORS.OUTFIT_BLUE_PANTS, accent: WORLD_COLORS.OUTFIT_BLUE_ACCENT, accessory: 'apron' as const },
  { shirt: WORLD_COLORS.OUTFIT_BROWN_SHIRT, pants: WORLD_COLORS.OUTFIT_BROWN_PANTS, accent: WORLD_COLORS.OUTFIT_BROWN_ACCENT, accessory: 'belt' as const },
  { shirt: WORLD_COLORS.OUTFIT_GREEN_SHIRT, pants: WORLD_COLORS.OUTFIT_GREEN_PANTS, accent: WORLD_COLORS.OUTFIT_GREEN_ACCENT, accessory: 'hood' as const },
  { shirt: WORLD_COLORS.OUTFIT_RED_SHIRT, pants: WORLD_COLORS.OUTFIT_RED_PANTS, accent: WORLD_COLORS.OUTFIT_RED_ACCENT, accessory: 'shoulders' as const },
  { shirt: WORLD_COLORS.OUTFIT_PURPLE_SHIRT, pants: WORLD_COLORS.OUTFIT_PURPLE_PANTS, accent: WORLD_COLORS.OUTFIT_PURPLE_ACCENT, accessory: 'hat' as const },
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
          <mesh position={[0, APRON_Y, APRON_Z]}>
            <boxGeometry args={[APRON_WIDTH, APRON_HEIGHT, APRON_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.APRON_FRONT} />
          </mesh>
          <mesh position={[0, APRON_STRAP_Y, APRON_Z]}>
            <boxGeometry args={[APRON_STRAP_WIDTH, APRON_STRAP_HEIGHT, APRON_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.APRON_STRAP} />
          </mesh>
        </group>
      )
    case 'belt':
      return (
        <group>
          <mesh position={[0, BELT_Y, 0]}>
            <boxGeometry args={[BELT_WIDTH, BELT_HEIGHT, BELT_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.BELT_LEATHER} />
          </mesh>
          <mesh position={[0, BELT_Y, BUCKLE_Z]}>
            <boxGeometry args={[BUCKLE_SIZE, BUCKLE_SIZE, BUCKLE_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.BUCKLE_GOLD} />
          </mesh>
        </group>
      )
    case 'hood':
      return (
        <group>
          <mesh position={[0, HOOD_Y, HOOD_Z]}>
            <boxGeometry args={[HOOD_WIDTH, HOOD_HEIGHT, HOOD_DEPTH]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, CAPE_Y, CAPE_Z]}>
            <boxGeometry args={[CAPE_WIDTH, CAPE_HEIGHT, CAPE_DEPTH]} />
            <meshStandardMaterial color={shirtColor} />
          </mesh>
        </group>
      )
    case 'shoulders':
      return (
        <group>
          <mesh position={[-SHOULDER_PAD_X, SHOULDER_PAD_Y, 0]}>
            <boxGeometry args={[SHOULDER_PAD_WIDTH, SHOULDER_PAD_HEIGHT, SHOULDER_PAD_DEPTH]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[SHOULDER_PAD_X, SHOULDER_PAD_Y, 0]}>
            <boxGeometry args={[SHOULDER_PAD_WIDTH, SHOULDER_PAD_HEIGHT, SHOULDER_PAD_DEPTH]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, CHEST_PLATE_Y, CHEST_PLATE_Z]}>
            <boxGeometry args={[CHEST_PLATE_WIDTH, CHEST_PLATE_HEIGHT, CHEST_PLATE_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.BUCKLE_GOLD} />
          </mesh>
        </group>
      )
    case 'hat':
      return (
        <group>
          <mesh position={[0, HAT_BRIM_Y, 0]}>
            <boxGeometry args={[HAT_BRIM_WIDTH, HAT_BRIM_HEIGHT, HAT_BRIM_DEPTH]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, HAT_BASE_Y, 0]}>
            <boxGeometry args={[HAT_BASE_SIZE, HAT_BASE_HEIGHT, HAT_BASE_SIZE]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, HAT_MID_Y, 0]}>
            <boxGeometry args={[HAT_MID_SIZE, HAT_MID_HEIGHT, HAT_MID_SIZE]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, HAT_TIP_Y, 0]}>
            <boxGeometry args={[HAT_TIP_SIZE, HAT_TIP_HEIGHT, HAT_TIP_SIZE]} />
            <meshStandardMaterial color={accentColor} />
          </mesh>
        </group>
      )
    default:
      return null
  }
}

export const TaskCube: FC<TaskCubeProps> = ({ position, title, isRunning, needsAttention, workType, faceAngle, route, onClick }) => {
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
  const waypointQueue = useRef<[number, number][]>([])

  const startNextLeg = useCallback(() => {
    if (waypointQueue.current.length === 0) return
    const next = waypointQueue.current.shift()
    if (!next) return
    const [nx, nz] = next
    if (groupRef.current) {
      startPos.current.set(groupRef.current.position.x, position[1], groupRef.current.position.z)
    }
    endPos.current.set(nx, position[1], nz)
    const dist = startPos.current.distanceTo(endPos.current)
    walkDuration.current = Math.max(dist / WALK_SPEED, MIN_WALK_DURATION)
    walkTime.current = 0
    progress.current = 0
  }, [position])

  useEffect(() => {
    const newEnd = new THREE.Vector3(...position)
    if (!initialized.current) {
      startPos.current.copy(newEnd)
      endPos.current.copy(newEnd)
      initialized.current = true
      return
    }
    if (newEnd.distanceTo(endPos.current) > WALK_DIRECTION_THRESHOLD) {
      if (route && route.length > 1) {
        waypointQueue.current = route.slice(1)
        startNextLeg()
      } else {
        waypointQueue.current = []
        if (groupRef.current) {
          startPos.current.set(groupRef.current.position.x, position[1], groupRef.current.position.z)
        }
        const dist = startPos.current.distanceTo(newEnd)
        walkDuration.current = Math.max(dist / WALK_SPEED, MIN_WALK_DURATION)
        walkTime.current = 0
        endPos.current.copy(newEnd)
        progress.current = 0
      }
    }
  }, [position, route, startNextLeg])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    let isWalking = progress.current < 1

    if (!isWalking && waypointQueue.current.length > 0) {
      startNextLeg()
      isWalking = true
    }

    if (isWalking) {
      progress.current = Math.min(progress.current + delta / walkDuration.current, 1)
      walkTime.current += delta
      const t = progress.current * progress.current * (3 - 2 * progress.current)

      const x = startPos.current.x + (endPos.current.x - startPos.current.x) * t
      const z = startPos.current.z + (endPos.current.z - startPos.current.z) * t
      groupRef.current.position.set(x, position[1], z)

      const dx = endPos.current.x - startPos.current.x
      const dz = endPos.current.z - startPos.current.z
      if (Math.abs(dx) > WALK_DIRECTION_THRESHOLD || Math.abs(dz) > WALK_DIRECTION_THRESHOLD) {
        targetRotY.current = Math.atan2(dx, dz)
      }

      const swing = Math.sin(walkTime.current * STEP_FREQ) * ARM_SWING_AMPLITUDE
      if (leftArmGroupRef.current) {
        leftArmGroupRef.current.rotation.x = swing
        leftArmGroupRef.current.rotation.z = 0
      }
      if (rightArmGroupRef.current) {
        rightArmGroupRef.current.rotation.x = -swing
        rightArmGroupRef.current.rotation.z = 0
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.x = -swing * LEG_SWING_RATIO
        leftLegRef.current.rotation.z = 0
      }
      if (rightLegGroupRef.current) {
        rightLegGroupRef.current.rotation.x = swing * LEG_SWING_RATIO
        rightLegGroupRef.current.rotation.z = 0
      }
      if (headRef.current) { headRef.current.rotation.y = 0; headRef.current.rotation.x = 0 }
      if (upperBodyRef.current) { upperBodyRef.current.rotation.x = 0; upperBodyRef.current.rotation.z = 0 }
    } else if (needsAttention) {
      const cycle = (Date.now() % ATTENTION_CYCLE_MS) / ATTENTION_CYCLE_S
      const isWaving = cycle < WAVE_DURATION_S
      groupRef.current.position.set(endPos.current.x, position[1], endPos.current.z)

      if (isWaving) {
        const t = cycle / WAVE_DURATION_S
        const easeIn = Math.min(t / WAVE_EASE_IN_DURATION, 1)
        const easeOut = t > WAVE_EASE_OUT_START ? 1 - (t - WAVE_EASE_OUT_START) / (1 - WAVE_EASE_OUT_START) : 1
        const ease = easeIn * easeOut

        if (upperBodyRef.current) upperBodyRef.current.rotation.z = BODY_LEAN * ease

        if (rightArmGroupRef.current) {
          if (t < WAVE_RAISE_END) {
            const raise = t / WAVE_RAISE_END
            rightArmGroupRef.current.rotation.z = WAVE_ARM_RAISE_ANGLE * raise
            rightArmGroupRef.current.rotation.x = WAVE_ARM_FORWARD * raise
          } else if (t < WAVE_MIDDLE_END) {
            const waveT = (t - WAVE_RAISE_END) / (WAVE_MIDDLE_END - WAVE_RAISE_END)
            rightArmGroupRef.current.rotation.z = WAVE_ARM_RAISE_ANGLE + Math.sin(waveT * Math.PI * WAVE_OSCILLATION_CYCLES) * WAVE_OSCILLATION_AMPLITUDE
            rightArmGroupRef.current.rotation.x = WAVE_ARM_FORWARD
          } else {
            const lower = (t - WAVE_LOWER_START) / (1 - WAVE_LOWER_START)
            rightArmGroupRef.current.rotation.z = WAVE_ARM_RAISE_ANGLE * (1 - lower)
            rightArmGroupRef.current.rotation.x = WAVE_ARM_FORWARD * (1 - lower)
          }
        }

        if (leftArmGroupRef.current) {
          leftArmGroupRef.current.rotation.z = LEFT_ARM_BALANCE * ease
        }

        if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
        if (rightLegGroupRef.current) {
          rightLegGroupRef.current.rotation.z = LEG_LIFT_Z * ease
          rightLegGroupRef.current.rotation.x = LEG_LIFT_X * ease
        }

        if (headRef.current) {
          headRef.current.rotation.z = 0
          headRef.current.rotation.y = HEAD_YAW * ease
          headRef.current.rotation.x = 0
        }

        if (mouthRef.current) {
          mouthRef.current.scale.set(MOUTH_OPEN_SCALE_X, MOUTH_OPEN_SCALE_Y * ease + (1 - ease), 1)
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
      const t = Date.now() * WORK_ANIM_SPEED
      groupRef.current.position.set(endPos.current.x, position[1], endPos.current.z)
      if (faceAngle !== undefined) targetRotY.current = faceAngle

      if (workType === 'hammer') {
        const swing = Math.sin(t * HAMMER_SWING_SPEED) * HAMMER_SWING_AMPLITUDE
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = HAMMER_ARM_BASE + Math.max(0, swing) * HAMMER_ARM_SWING
          rightArmGroupRef.current.rotation.z = 0
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = 0
        if (leftArmRef.current) leftArmRef.current.rotation.x = HAMMER_LEFT_ARM
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = Math.max(0, swing) * HAMMER_BODY_DIP
      } else if (workType === 'read') {
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = READ_ARM_PITCH
          rightArmGroupRef.current.rotation.z = READ_ARM_SPLAY
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = -READ_ARM_SPLAY
        if (leftArmRef.current) leftArmRef.current.rotation.x = READ_ARM_PITCH
        if (headRef.current) headRef.current.rotation.x = READ_HEAD_PITCH + Math.sin(t * READ_HEAD_BOB_SPEED) * READ_HEAD_BOB_AMPLITUDE
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = 0
      } else if (workType === 'craft') {
        const alt = Math.sin(t * CRAFT_SPEED)
        if (rightArmGroupRef.current) {
          rightArmGroupRef.current.rotation.x = CRAFT_ARM_BASE + alt * CRAFT_ARM_SWING
          rightArmGroupRef.current.rotation.z = 0
        }
        if (leftArmGroupRef.current) leftArmGroupRef.current.rotation.z = 0
        if (leftArmRef.current) leftArmRef.current.rotation.x = CRAFT_ARM_BASE - alt * CRAFT_ARM_SWING
        if (upperBodyRef.current) upperBodyRef.current.rotation.x = 0
      }

      if (headRef.current && workType !== 'read') {
        headRef.current.rotation.x = HEAD_WORK_PITCH
        headRef.current.rotation.y = 0
        headRef.current.rotation.z = 0
      }
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0
      if (leftLegRef.current) { leftLegRef.current.rotation.x = 0; leftLegRef.current.rotation.z = 0 }
      if (rightLegGroupRef.current) { rightLegGroupRef.current.rotation.x = 0; rightLegGroupRef.current.rotation.z = 0 }
      if (mouthRef.current) mouthRef.current.scale.set(1, 1, 1)
    } else {
      const bob = isRunning ? Math.sin(Date.now() * IDLE_BOB_SPEED) * IDLE_BOB_AMPLITUDE : 0
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

    if (groupRef.current) {
      let diff = targetRotY.current - currentRotY.current
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      currentRotY.current += diff * Math.min(delta * ROTATION_LERP_SPEED, 1)
      groupRef.current.rotation.y = currentRotY.current
    }
  })

  const outfit = getOutfit(title)
  const statusColor = needsAttention ? WORLD_COLORS.STATUS_ATTENTION : isRunning ? WORLD_COLORS.STATUS_RUNNING : null

  const labelY = outfit.accessory === 'hat' ? LABEL_Y_HAT : LABEL_Y_DEFAULT

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'auto' }}
    >
      <group ref={upperBodyRef}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH]} />
          <meshStandardMaterial color={outfit.shirt} />
        </mesh>
        <mesh position={[0, COLLAR_Y, COLLAR_Z]}>
          <boxGeometry args={[COLLAR_WIDTH, COLLAR_HEIGHT, COLLAR_DEPTH]} />
          <meshStandardMaterial color={outfit.accent} />
        </mesh>

        {statusColor && (
          <mesh position={[0, labelY + STATUS_OFFSET_Y, 0]}>
            <boxGeometry args={[STATUS_SIZE, STATUS_SIZE, STATUS_SIZE]} />
            <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={STATUS_EMISSIVE_INTENSITY} />
          </mesh>
        )}

        <group ref={headRef} position={[0, HEAD_Y, 0]}>
          <mesh>
            <boxGeometry args={[HEAD_SIZE_X, HEAD_SIZE_Y, HEAD_SIZE_Z]} />
            <meshStandardMaterial color={WORLD_COLORS.SKIN} />
          </mesh>
          <mesh position={[-EYE_X_OFFSET, EYE_Y, EYE_Z]}>
            <boxGeometry args={[EYE_SIZE, EYE_SIZE, EYE_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.EYES} />
          </mesh>
          <mesh position={[EYE_X_OFFSET, EYE_Y, EYE_Z]}>
            <boxGeometry args={[EYE_SIZE, EYE_SIZE, EYE_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.EYES} />
          </mesh>
          <mesh ref={mouthRef} position={[0, MOUTH_Y, MOUTH_Z]}>
            <boxGeometry args={[MOUTH_WIDTH, MOUTH_HEIGHT, MOUTH_DEPTH]} />
            <meshStandardMaterial color={WORLD_COLORS.MOUTH} />
          </mesh>
        </group>

        <Accessory type={outfit.accessory} shirtColor={outfit.shirt} accentColor={outfit.accent} />

        <group ref={leftArmGroupRef} position={[-ARM_X, ARM_PIVOT_Y, 0]}>
          <mesh ref={leftArmRef} position={[0, ARM_MESH_Y, 0]}>
            <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
            <meshStandardMaterial color={outfit.shirt} />
          </mesh>
        </group>

        <group ref={rightArmGroupRef} position={[ARM_X, ARM_PIVOT_Y, 0]}>
          <mesh ref={rightArmRef} position={[0, ARM_MESH_Y, 0]}>
            <boxGeometry args={[ARM_WIDTH, ARM_HEIGHT, ARM_DEPTH]} />
            <meshStandardMaterial color={outfit.shirt} />
          </mesh>
        </group>
      </group>

      <group position={[-LEG_X, LEG_PIVOT_Y, 0]}>
        <mesh ref={leftLegRef} position={[0, LEG_MESH_Y, 0]}>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
          <meshStandardMaterial color={outfit.pants} />
        </mesh>
      </group>

      <group ref={rightLegGroupRef} position={[LEG_X, LEG_PIVOT_Y, 0]}>
        <mesh ref={rightLegRef} position={[0, LEG_MESH_Y, 0]}>
          <boxGeometry args={[LEG_WIDTH, LEG_HEIGHT, LEG_DEPTH]} />
          <meshStandardMaterial color={outfit.pants} />
        </mesh>
      </group>

      <Text
        position={[0, labelY, 0]}
        fontSize={LABEL_FONT_SIZE}
        color={WORLD_COLORS.LABEL_BG}
        anchorX="center"
        anchorY="middle"
        outlineWidth={LABEL_OUTLINE_WIDTH}
        outlineColor={WORLD_COLORS.LABEL_OUTLINE}
        maxWidth={LABEL_MAX_WIDTH}
      >
        {title}
      </Text>
    </group>
  )
}
