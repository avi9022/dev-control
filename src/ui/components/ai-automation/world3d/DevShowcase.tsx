import type { FC } from 'react'
import { Text } from '@react-three/drei'
import { Block, type BlockType } from './blocks'
import { Tree } from './Tree'
import { TaskCube } from './TaskCube'
import { SignPost } from './SignPost'

const BLOCK_TYPES: { type: BlockType; label: string; color?: string }[] = [
  { type: 'grass', label: 'Grass' },
  { type: 'dirt', label: 'Dirt' },
  { type: 'stone', label: 'Stone' },
  { type: 'wood', label: 'Wood' },
  { type: 'darkwood', label: 'Dark Wood' },
  { type: 'cobble', label: 'Cobble' },
  { type: 'sand', label: 'Sand' },
  { type: 'wool', label: 'Wool (red)', color: '#D46B6B' },
  { type: 'wool', label: 'Wool (green)', color: '#9BB89E' },
  { type: 'wool', label: 'Wool (blue)', color: '#6B7FD7' },
  { type: 'leaf', label: 'Leaf' },
  { type: 'water', label: 'Water' },
]

function Label({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={0.3}
      color="#FAF9F7"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.02}
      outlineColor="#1C1917"
    >
      {text}
    </Text>
  )
}

export const DevShowcase: FC = () => {
  const spacing = 3
  let x = 0

  return (
    <group>
      {/* Ground */}
      <mesh position={[40, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 20]} />
        <meshStandardMaterial color="#3a7530" />
      </mesh>

      {/* Blocks */}
      {BLOCK_TYPES.map((block, i) => {
        const bx = i * spacing
        return (
          <group key={`${block.type}-${block.label}`}>
            <Block type={block.type} position={[bx, 1.5, 0]} color={block.color} />
            <Label position={[bx, 0.3, 0]} text={block.label} />
          </group>
        )
      })}

      {/* Trees — after blocks */}
      {(() => {
        x = BLOCK_TYPES.length * spacing + 2
        return [3, 4, 5, 6].map((height, i) => {
          const tx = x + i * 8
          return (
            <group key={`tree-${height}`}>
              <Tree position={[tx, 0.5, 0]} height={height} />
              <Label position={[tx, -0.3, 0]} text={`Tree H:${height}`} />
            </group>
          )
        })
      })()}

      {/* Characters — after trees */}
      {(() => {
        x = BLOCK_TYPES.length * spacing + 2 + 4 * 8 + 3
        const chars = [
          { label: 'Idle', running: false, attention: false },
          { label: 'Running', running: true, attention: false },
          { label: 'Attention', running: false, attention: true },
        ]
        return chars.map((c, i) => (
          <group key={c.label}>
            <TaskCube position={[x + i * spacing, 1.1, 0]} title={c.label} isRunning={c.running} needsAttention={c.attention} />
          </group>
        ))
      })()}

      {/* Sign post — at the end */}
      {(() => {
        x = BLOCK_TYPES.length * spacing + 2 + 4 * 8 + 3 + 3 * spacing + 3
        return <SignPost position={[x, -4]} label="Sign Post" color="#9BB89E" />
      })()}
    </group>
  )
}
