export type WorkType = 'hammer' | 'read' | 'craft'

export interface WorkSpot {
  /** Offset from building center */
  x: number
  z: number
  /** What animation to play at this spot */
type: WorkType
}

export interface BuildingMetadata {
  /** Total space this building occupies (radius from center) — used for spacing between buildings */
  radius: number
  /** Where task characters gather — offset from building center */
  gatherPoint: { x: number; z: number }
  /** How far apart characters spread from the gather point */
  gatherSpread: number
  /** Spots where characters work inside/around the building */
  workSpots: WorkSpot[]
}
