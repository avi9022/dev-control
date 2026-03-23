import type { FC } from 'react'
import { Text } from '@react-three/drei'
import { WORLD_COLORS } from './colors'

const SIGN_X_OFFSET = 4
const SIGN_BASE_Y = 1
const POST_HEIGHT = 3
const POST_WIDTH = 0.3
const POST_Y = 1.5
const BOARD_WIDTH = 4
const BOARD_HEIGHT = 1.2
const BOARD_DEPTH = 0.15
const BOARD_Y = 2.8
const BOARD_Z = 0.2
const LABEL_Y = 2.8
const LABEL_Z = 0.35
const LABEL_FONT_SIZE = 0.5
const LABEL_OUTLINE_WIDTH = 0.03
const LABEL_MAX_WIDTH = 3.5

interface SignPostProps {
  position: [number, number]
  label: string
  color: string
}

export const SignPost: FC<SignPostProps> = ({ position, label, color }) => {
  const [x, z] = position
  const signX = x + SIGN_X_OFFSET

  return (
    <group position={[signX, SIGN_BASE_Y, z]}>
      <mesh position={[0, POST_Y, 0]}>
        <boxGeometry args={[POST_WIDTH, POST_HEIGHT, POST_WIDTH]} />
        <meshStandardMaterial color={WORLD_COLORS.WOOD_POST} />
      </mesh>
      <mesh position={[0, BOARD_Y, BOARD_Z]}>
        <boxGeometry args={[BOARD_WIDTH, BOARD_HEIGHT, BOARD_DEPTH]} />
        <meshStandardMaterial color={WORLD_COLORS.SIGN_BOARD} />
      </mesh>
      <Text
        position={[0, LABEL_Y, LABEL_Z]}
        fontSize={LABEL_FONT_SIZE}
        color={color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={LABEL_OUTLINE_WIDTH}
        outlineColor={WORLD_COLORS.EYES}
        maxWidth={LABEL_MAX_WIDTH}
      >
        {label}
      </Text>
    </group>
  )
}
