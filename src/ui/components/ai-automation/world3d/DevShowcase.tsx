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
import { WORLD_COLORS } from './colors'
import { LABEL_FONT_SIZE, LABEL_OUTLINE_WIDTH } from './config'

const TREE_HEIGHTS = [3, 4, 5, 6]
const WALKER_LABEL_X = 5
const MOCK_ZONE_PLANNING_COLOR = WORLD_COLORS.ZONE_BLUE
const MOCK_ZONE_WORKING_COLOR = WORLD_COLORS.ZONE_GOLD
const MOCK_ZONE_REVIEW_COLOR = WORLD_COLORS.ZONE_GREEN

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
  { type: 'wool', label: 'Wool (red)', color: WORLD_COLORS.STATUS_ATTENTION },
  { type: 'wool', label: 'Wool (green)', color: WORLD_COLORS.STATUS_RUNNING },
  { type: 'wool', label: 'Wool (blue)', color: WORLD_COLORS.ZONE_BLUE },
  { type: 'leaf', label: 'Leaf' },
  { type: 'water', label: 'Water' },
  { type: 'bars', label: 'Bars' },
  { type: 'crate', label: 'Crate' },
]

const SECTION_FONT_SIZE = 0.5
const SECTION_OUTLINE_WIDTH = 0.03
const SECTION_LABEL_Y = 3.5
const BLOCK_Y = 1.5
const LABEL_Y = 0.3
const BLOCK_SPACING = 3
const ROW_1_Z = 0
const ROW_2_Z = 12
const ROW_3_Z = 24
const SECTION_LABEL_X = -2
const GROUND_X = 40
const GROUND_Z = 60
const GROUND_SIZE = 200
const CHARACTER_Y = 1.1
const CHARACTER_SPACING = 2.5
const WALKER_LEFT_X = -5
const WALKER_RIGHT_X = 15
const WALKER_INTERVAL_MS = 5000
const WALKER_Z_OFFSET = 6
const TREE_SPACING = 8
const FLOWER_START_X = 34
const FLOWER_SPACING = 2
const GRASS_START_X = 46
const GRASS_SPACING = 1.5
const BOULDER_START_X = 54
const BOULDER_SPACING = 5
const SIGN_POST_X_OFFSET = 12
const SIGN_POST_Z_OFFSET = -4
const LANTERN_X = 18
const LANTERN_Y = 2
const MOUNTAIN_X = 30
const BUILDINGS_Z_OFFSET = 14
const BUILDINGS_GROUP_Z_OFFSET = 60
const LANTERN_POSITION_Y = 0.5

function Label({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={LABEL_FONT_SIZE}
      color={WORLD_COLORS.LABEL_BG}
      anchorX="center"
      anchorY="middle"
      outlineWidth={LABEL_OUTLINE_WIDTH}
      outlineColor={WORLD_COLORS.LABEL_OUTLINE}
    >
      {text}
    </Text>
  )
}

function SectionLabel({ position, text }: { position: [number, number, number]; text: string }) {
  return (
    <Text
      position={position}
      fontSize={SECTION_FONT_SIZE}
      color={WORLD_COLORS.GOLD_ACCENT}
      anchorX="center"
      anchorY="middle"
      outlineWidth={SECTION_OUTLINE_WIDTH}
      outlineColor={WORLD_COLORS.LABEL_OUTLINE}
    >
      {text}
    </Text>
  )
}

export const DevShowcase: FC = () => {
  let cursor = 0

  const mockZones: Zone[] = [
    { id: 'planning', label: 'Planning', color: MOCK_ZONE_PLANNING_COLOR },
    { id: 'working', label: 'Working', color: MOCK_ZONE_WORKING_COLOR },
    { id: 'review', label: 'Review', color: MOCK_ZONE_REVIEW_COLOR },
  ]

  const mockTasks: Task3D[] = [
    { id: 'task-1', title: 'Reader', phase: 'planning', isRunning: true, needsAttention: false },
    { id: 'task-2', title: 'Smith', phase: 'working', isRunning: true, needsAttention: false },
    { id: 'task-3', title: 'Crafter', phase: 'review', isRunning: true, needsAttention: false },
    { id: 'task-4', title: 'Stuck Task', phase: 'planning', isRunning: false, needsAttention: true },
  ]

  const [walkTick, setWalkTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setWalkTick(t => t + 1), WALKER_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])
  const walkerX = walkTick % 2 === 0 ? WALKER_LEFT_X : WALKER_RIGHT_X
  const walkerZ = ROW_3_Z + WALKER_Z_OFFSET

  return (
    <group>
      <mesh position={[GROUND_X, 0, GROUND_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
        <meshStandardMaterial color={WORLD_COLORS.GROUND_GREEN} />
      </mesh>

      <SectionLabel position={[SECTION_LABEL_X, SECTION_LABEL_Y, ROW_1_Z]} text="Blocks" />
      {BLOCK_TYPES.map((block, i) => {
        const bx = i * BLOCK_SPACING
        return (
          <group key={`${block.type}-${block.label}`}>
            <Block type={block.type} position={[bx, BLOCK_Y, ROW_1_Z]} color={block.color} />
            <Label position={[bx, LABEL_Y, ROW_1_Z]} text={block.label} />
          </group>
        )
      })}

      <SectionLabel position={[SECTION_LABEL_X, SECTION_LABEL_Y, ROW_2_Z]} text="Nature" />

      {(() => {
        cursor = 0
        return TREE_HEIGHTS.map((height, i) => {
          const tx = cursor + i * TREE_SPACING
          return (
            <group key={`tree-${height}`}>
              <Tree position={[tx, LANTERN_POSITION_Y, ROW_2_Z]} height={height} />
              <Label position={[tx, -LABEL_Y, ROW_2_Z]} text={`Tree H:${height}`} />
            </group>
          )
        })
      })()}

      {(() => {
        cursor = FLOWER_START_X
        const colors = [WORLD_COLORS.FLOWER_RED, WORLD_COLORS.FLOWER_YELLOW, WORLD_COLORS.FLOWER_WHITE, WORLD_COLORS.FLOWER_PURPLE, WORLD_COLORS.FLOWER_BLUE]
        return colors.map((color, i) => (
          <group key={`flower-${i}`}>
            <Flower position={[cursor + i * FLOWER_SPACING, LANTERN_POSITION_Y, ROW_2_Z]} color={color} />
            <Label position={[cursor + i * FLOWER_SPACING, -LABEL_Y, ROW_2_Z]} text="Flower" />
          </group>
        ))
      })()}

      {(() => {
        cursor = GRASS_START_X
        return [0, 1, 2, 3].map(i => (
          <group key={`grass-${i}`}>
            <TallGrass position={[cursor + i * GRASS_SPACING, LANTERN_POSITION_Y, ROW_2_Z]} />
            {i === 0 && <Label position={[cursor + FLOWER_SPACING, -LABEL_Y, ROW_2_Z]} text="Tall Grass" />}
          </group>
        ))
      })()}

      {(() => {
        cursor = BOULDER_START_X
        return (['small', 'medium', 'large'] as const).map((size, i) => (
          <group key={`boulder-${size}`}>
            <Boulder position={[cursor + i * BOULDER_SPACING, LANTERN_POSITION_Y, ROW_2_Z]} size={size} />
            <Label position={[cursor + i * BOULDER_SPACING, -LABEL_Y, ROW_2_Z]} text={`Boulder ${size}`} />
          </group>
        ))
      })()}

      <SectionLabel position={[SECTION_LABEL_X, SECTION_LABEL_Y, ROW_3_Z]} text="Entities" />

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
            <TaskCube position={[cursor + i * CHARACTER_SPACING, CHARACTER_Y, ROW_3_Z]} title={c.title} isRunning={c.running} needsAttention={c.attention} workType={c.workType} />
          </group>
        ))
      })()}

      <TaskCube position={[walkerX, CHARACTER_Y, walkerZ]} title="Walker" isRunning={false} needsAttention={false} />
      <Label position={[WALKER_LABEL_X, -LABEL_Y, walkerZ]} text="Walking Demo" />

      <SignPost position={[SIGN_POST_X_OFFSET, ROW_3_Z + SIGN_POST_Z_OFFSET]} label="Sign Post" color={WORLD_COLORS.STATUS_RUNNING} />
      <Lantern position={[LANTERN_X, LANTERN_Y, ROW_3_Z]} />
      <Label position={[LANTERN_X, -LABEL_Y, ROW_3_Z]} text="Lantern" />

      <MountainSample position={[MOUNTAIN_X, LANTERN_POSITION_Y, ROW_3_Z]} />
      <Label position={[MOUNTAIN_X, -LABEL_Y, ROW_3_Z]} text="Mountain" />

      <SectionLabel position={[SECTION_LABEL_X, SECTION_LABEL_Y, ROW_3_Z + BUILDINGS_Z_OFFSET]} text="Buildings (live)" />
      <group position={[0, 0, ROW_3_Z + BUILDINGS_GROUP_Z_OFFSET]}>
        <Zones zones={mockZones} tasks={mockTasks} />
      </group>
    </group>
  )
}
