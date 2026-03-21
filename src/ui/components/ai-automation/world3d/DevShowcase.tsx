import { useState, useEffect, type FC } from 'react'
import { Text } from '@react-three/drei'
import { Block, type BlockType } from './blocks'
import { Tree } from './Tree'
import { TaskCube } from './TaskCube'
import { SignPost } from './SignPost'
import { Lantern } from './Lantern'
import { Flower } from './Flower'
import { Zones } from './Zones'
import type { Zone, Task3D } from './types'
import { TallGrass } from './TallGrass'
import { Boulder } from './Boulder'
import { MountainSample } from './MountainSample'

const BLOCK_TYPES: { type: BlockType; label: string; color?: string }[] = [
  { type: 'grass', label: 'Grass' },
  { type: 'darkgrass', label: 'Dark Grass' },
  { type: 'dirt', label: 'Dirt' },
  { type: 'stone', label: 'Stone' },
  { type: 'brick', label: 'Brick' },
  { type: 'wood', label: 'Wood' },
  { type: 'darkwood', label: 'Dark Wood' },
  { type: 'cobble', label: 'Cobble' },
  { type: 'sand', label: 'Sand' },
  { type: 'wool', label: 'Wool (red)', color: '#D46B6B' },
  { type: 'wool', label: 'Wool (green)', color: '#9BB89E' },
  { type: 'wool', label: 'Wool (blue)', color: '#6B7FD7' },
  { type: 'leaf', label: 'Leaf' },
  { type: 'water', label: 'Water' },
  { type: 'bars', label: 'Bars' },
  { type: 'crate', label: 'Crate' },
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

function SectionLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={0.5}
      color="#E5C287"
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.03}
      outlineColor="#1C1917"
    >
      {text}
    </Text>
  )
}

export const DevShowcase: FC = () => {
  const spacing = 3
  const rowZ = 0
  const row2Z = 12
  const row3Z = 24
  let cursor = 0

  // Mock zones and tasks for the buildings demo
  const mockZones: Zone[] = [
    { id: 'planning', label: 'Planning', color: '#6B7FD7' },
    { id: 'working', label: 'Working', color: '#D4A843' },
    { id: 'review', label: 'Review', color: '#4DA870' },
  ]

  const mockTasks: Task3D[] = [
    { id: 'task-1', title: 'Reader', phase: 'planning', isRunning: true, needsAttention: false },
    { id: 'task-2', title: 'Smith', phase: 'working', isRunning: true, needsAttention: false },
    { id: 'task-3', title: 'Crafter', phase: 'review', isRunning: true, needsAttention: false },
    { id: 'task-4', title: 'Stuck Task', phase: 'planning', isRunning: false, needsAttention: true },
  ]

  // Walking character — alternates between two positions
  const [walkTick, setWalkTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setWalkTick(t => t + 1), 5000)
    return () => clearInterval(interval)
  }, [])
  const walkerX = walkTick % 2 === 0 ? -5 : 15
  const walkerZ = row3Z + 6

  return (
    <group>
      {/* Ground */}
      <mesh position={[40, 0, 60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#3a7530" />
      </mesh>

      {/* ── Row 1: Blocks ── */}
      <SectionLabel position={[-2, 3.5, rowZ]} text="Blocks" />
      {BLOCK_TYPES.map((block, i) => {
        const bx = i * spacing
        return (
          <group key={`${block.type}-${block.label}`}>
            <Block type={block.type} position={[bx, 1.5, rowZ]} color={block.color} />
            <Label position={[bx, 0.3, rowZ]} text={block.label} />
          </group>
        )
      })}

      {/* ── Row 2: Trees, Flowers, Grass, Boulders ── */}
      <SectionLabel position={[-2, 3.5, row2Z]} text="Nature" />

      {/* Trees */}
      {(() => {
        cursor = 0
        return [3, 4, 5, 6].map((height, i) => {
          const tx = cursor + i * 8
          return (
            <group key={`tree-${height}`}>
              <Tree position={[tx, 0.5, row2Z]} height={height} />
              <Label position={[tx, -0.3, row2Z]} text={`Tree H:${height}`} />
            </group>
          )
        })
      })()}

      {/* Flowers */}
      {(() => {
        cursor = 34
        const colors = ['#e84040', '#e8d840', '#e8e8e8', '#d040d0', '#40a0e8']
        return colors.map((color, i) => (
          <group key={`flower-${i}`}>
            <Flower position={[cursor + i * 2, 0.5, row2Z]} color={color} />
            <Label position={[cursor + i * 2, -0.3, row2Z]} text="Flower" />
          </group>
        ))
      })()}

      {/* Tall Grass */}
      {(() => {
        cursor = 46
        return [0, 1, 2, 3].map(i => (
          <group key={`grass-${i}`}>
            <TallGrass position={[cursor + i * 1.5, 0.5, row2Z]} />
            {i === 0 && <Label position={[cursor + 2, -0.3, row2Z]} text="Tall Grass" />}
          </group>
        ))
      })()}

      {/* Boulders */}
      {(() => {
        cursor = 54
        return (['small', 'medium', 'large'] as const).map((size, i) => (
          <group key={`boulder-${size}`}>
            <Boulder position={[cursor + i * 5, 0.5, row2Z]} size={size} />
            <Label position={[cursor + i * 5, -0.3, row2Z]} text={`Boulder ${size}`} />
          </group>
        ))
      })()}

      {/* ── Row 3: Characters, Sign, Mountain ── */}
      <SectionLabel position={[-2, 3.5, row3Z]} text="Entities" />

      {/* Characters — outfits, states, work types */}
      {(() => {
        cursor = 0
        const chars: { title: string; running: boolean; attention: boolean; workType?: 'hammer' | 'read' | 'craft' }[] = [
          { title: 'Alice', running: false, attention: false },
          { title: 'Bob', running: false, attention: false },
          { title: 'Charlie', running: false, attention: false },
          { title: 'Diana', running: false, attention: false },
          { title: 'Eve', running: false, attention: false },
          { title: 'Hammering', running: true, attention: false, workType: 'hammer' },
          { title: 'Reading', running: true, attention: false, workType: 'read' },
          { title: 'Crafting', running: true, attention: false, workType: 'craft' },
          { title: 'Needs Help', running: false, attention: true },
          { title: 'Active Alert', running: true, attention: true },
        ]
        return chars.map((c, i) => (
          <group key={c.title}>
            <TaskCube position={[cursor + i * 2.5, 1.1, row3Z]} title={c.title} isRunning={c.running} needsAttention={c.attention} workType={c.workType} />
          </group>
        ))
      })()}

      {/* Walking character */}
      <TaskCube position={[walkerX, 1.1, walkerZ]} title="Walker" isRunning={false} needsAttention={false} />
      <Label position={[5, -0.3, walkerZ]} text="Walking Demo" />

      {/* Sign Post */}
      <SignPost position={[12, row3Z - 4]} label="Sign Post" color="#9BB89E" />
      <Lantern position={[18, 2, row3Z]} />
      <Label position={[18, -0.3, row3Z]} text="Lantern" />

      {/* Mountain Sample */}
      <MountainSample position={[30, 0.5, row3Z]} />
      <Label position={[30, -0.3, row3Z]} text="Mountain" />

      {/* ── Row 4: Buildings with real Zones logic ── */}
      <SectionLabel position={[-2, 3.5, row3Z + 14]} text="Buildings (live)" />
      <group position={[0, 0, row3Z + 60]}>
        <Zones zones={mockZones} tasks={mockTasks} />
      </group>
    </group>
  )
}
