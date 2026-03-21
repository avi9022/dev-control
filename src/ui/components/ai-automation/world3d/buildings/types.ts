export interface BuildingMetadata {
  /** Total space this building occupies (radius from center) — used for spacing between buildings */
  radius: number
  /** Where task characters gather — offset from building center */
  gatherPoint: { x: number; z: number }
  /** How far apart characters spread from the gather point */
  gatherSpread: number
}
