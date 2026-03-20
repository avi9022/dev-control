import type { FC } from 'react'

export type BlockType = 'grass' | 'dirt' | 'stone' | 'wood' | 'darkwood' | 'cobble' | 'sand' | 'wool' | 'leaf' | 'water'

const BLOCK_COLORS: Record<Exclude<BlockType, 'wool' | 'water'>, string> = {
  grass: '#4a8c38',
  dirt: '#6B5A40',
  stone: '#808080',
  wood: '#8B7355',
  darkwood: '#5C3D28',
  cobble: '#9E9075',
  sand: '#C4A97D',
  leaf: '#2D5A1E',
}

interface BlockProps {
  type: BlockType
  position: [number, number, number]
  /** Only used for 'wool' type — accepts any color */
  color?: string
}

export const Block: FC<BlockProps> = ({ type, position, color }) => {
  const isWater = type === 'water'

  const resolvedColor = type === 'wool'
    ? (color || '#B0AAA4')
    : isWater
      ? '#3B7DB0'
      : BLOCK_COLORS[type]

  return (
    <mesh position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={resolvedColor}
        transparent={isWater}
        opacity={isWater ? 0.6 : 1}
      />
    </mesh>
  )
}
