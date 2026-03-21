export interface Zone {
  id: string
  label: string
  color?: string
}

export interface Task3D {
  id: string
  title: string
  phase: string
  isRunning: boolean
  needsAttention: boolean
}

export type { WorkType, WorkSpot } from './buildings/types'

export const TERRAIN_SIZE = 200
export const SKY_COLOR = '#87CEEB'
