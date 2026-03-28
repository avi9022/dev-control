import type { BuildingMetadata } from './types'

const COTTAGE_RADIUS = 22
const COTTAGE_GATHER_X = 0
const COTTAGE_GATHER_Z = 10
const COTTAGE_GATHER_SPREAD = 1.5
const COTTAGE_ENTRY_Z = 7
const COTTAGE_WORK_READ1_X = -2
const COTTAGE_WORK_READ1_Z = 4
const COTTAGE_WORK_CRAFT_X = 2
const COTTAGE_WORK_CRAFT_Z = 6
const COTTAGE_WORK_READ2_X = -4
const COTTAGE_WORK_READ2_Z = -1

export const COTTAGE_META: BuildingMetadata = {
  radius: COTTAGE_RADIUS,
  gatherPoint: { x: COTTAGE_GATHER_X, z: COTTAGE_GATHER_Z },
  gatherSpread: COTTAGE_GATHER_SPREAD,
  workSpots: [
    { x: COTTAGE_WORK_READ1_X, z: COTTAGE_WORK_READ1_Z, type: 'read' },
    { x: COTTAGE_WORK_CRAFT_X, z: COTTAGE_WORK_CRAFT_Z, type: 'craft' },
    { x: COTTAGE_WORK_READ2_X, z: COTTAGE_WORK_READ2_Z, type: 'read' },
  ],
  entryPoint: { x: COTTAGE_GATHER_X, z: COTTAGE_ENTRY_Z },
  internalPaths: new Map([
    ['0-1', [[-2, 6], [2, 6]]],
    ['1-0', [[2, 6], [-2, 6], [-2, 4]]],
    ['0-2', [[-2, 6], [-5, 6], [-5, -1]]],
    ['2-0', [[-5, -1], [-5, 6], [-2, 6], [-2, 4]]],
    ['1-2', [[5, 6], [5, -1], [5, -4], [-5, -4], [-5, -1]]],
    ['2-1', [[-5, -1], [-5, -4], [5, -4], [5, -1], [5, 6], [2, 6]]],
  ]),
}

const TOWER_RADIUS = 24
const TOWER_GATHER_X = 0
const TOWER_GATHER_Z = 12
const TOWER_GATHER_SPREAD = 1.5
const TOWER_ENTRY_Z = 8
const TOWER_WORK_CRAFT_X = -4
const TOWER_WORK_CRAFT_Z = 2
const TOWER_WORK_HAMMER_X = 4
const TOWER_WORK_HAMMER_Z = -1
const TOWER_WORK_READ_X = 0
const TOWER_WORK_READ_Z = 7

export const TOWER_META: BuildingMetadata = {
  radius: TOWER_RADIUS,
  gatherPoint: { x: TOWER_GATHER_X, z: TOWER_GATHER_Z },
  gatherSpread: TOWER_GATHER_SPREAD,
  workSpots: [
    { x: TOWER_WORK_CRAFT_X, z: TOWER_WORK_CRAFT_Z, type: 'craft' },
    { x: TOWER_WORK_HAMMER_X, z: TOWER_WORK_HAMMER_Z, type: 'hammer' },
    { x: TOWER_WORK_READ_X, z: TOWER_WORK_READ_Z, type: 'read' },
  ],
  entryPoint: { x: TOWER_GATHER_X, z: TOWER_ENTRY_Z },
  internalPaths: new Map([
    ['0-1', [[-6, 2], [-6, -4], [6, -4], [6, -1], [4, -1]]],
    ['1-0', [[6, -1], [6, -4], [-6, -4], [-6, 2], [-4, 2]]],
    ['0-2', [[-6, 2], [-6, 6], [0, 7]]],
    ['2-0', [[-6, 6], [-6, 2], [-4, 2]]],
    ['1-2', [[6, -1], [6, 6], [0, 7]]],
    ['2-1', [[6, 6], [6, -1], [4, -1]]],
  ]),
}

const WORKSHOP_RADIUS = 22
const WORKSHOP_GATHER_X = 0
const WORKSHOP_GATHER_Z = 12
const WORKSHOP_GATHER_SPREAD = 1.5
const WORKSHOP_ENTRY_Z = 8
const WORKSHOP_WORK_CRAFT_X = 0
const WORKSHOP_WORK_CRAFT_Z = 6
const WORKSHOP_WORK_HAMMER1_X = 6
const WORKSHOP_WORK_HAMMER1_Z = 0
const WORKSHOP_WORK_HAMMER2_X = -6
const WORKSHOP_WORK_HAMMER2_Z = 1

export const WORKSHOP_META: BuildingMetadata = {
  radius: WORKSHOP_RADIUS,
  gatherPoint: { x: WORKSHOP_GATHER_X, z: WORKSHOP_GATHER_Z },
  gatherSpread: WORKSHOP_GATHER_SPREAD,
  workSpots: [
    { x: WORKSHOP_WORK_CRAFT_X, z: WORKSHOP_WORK_CRAFT_Z, type: 'craft' },
    { x: WORKSHOP_WORK_HAMMER1_X, z: WORKSHOP_WORK_HAMMER1_Z, type: 'hammer' },
    { x: WORKSHOP_WORK_HAMMER2_X, z: WORKSHOP_WORK_HAMMER2_Z, type: 'hammer' },
  ],
  entryPoint: { x: WORKSHOP_GATHER_X, z: WORKSHOP_ENTRY_Z },
  internalPaths: new Map([
    ['0-1', [[5, 6], [7, 4], [7, 0], [6, 0]]],
    ['1-0', [[7, 0], [7, 4], [5, 6], [0, 6]]],
    ['0-2', [[-5, 6], [-7, 4], [-7, 1], [-6, 1]]],
    ['2-0', [[-7, 1], [-7, 4], [-5, 6], [0, 6]]],
    ['1-2', [[7, 0], [7, -4], [-7, -4], [-7, 1], [-6, 1]]],
    ['2-1', [[-7, 1], [-7, -4], [7, -4], [7, 0], [6, 0]]],
  ]),
}
