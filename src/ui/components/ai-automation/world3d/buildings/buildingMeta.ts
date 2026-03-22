import type { BuildingMetadata } from './types'

export const COTTAGE_META: BuildingMetadata = {
  radius: 22,
  gatherPoint: { x: 0, z: 10 },
  gatherSpread: 1.5,
  workSpots: [
    { x: -2, z: 4, type: 'read' },    // bench on porch
    { x: 2, z: 6, type: 'craft' },    // front yard near gate
    { x: -4, z: -1, type: 'read' },   // side of house
  ],
  entryPoint: { x: 0, z: 7 },         // front gate
  internalPaths: new Map([
    // spot 0 (porch -2,4) -> spot 1 (yard 2,6): walk out front of porch then right
    ['0-1', [[-2, 6], [2, 6]]],
    ['1-0', [[2, 6], [-2, 6], [-2, 4]]],
    // spot 0 (porch -2,4) -> spot 2 (side -4,-1): out front, around left
    ['0-2', [[-2, 6], [-5, 6], [-5, -1]]],
    ['2-0', [[-5, -1], [-5, 6], [-2, 6], [-2, 4]]],
    // spot 1 (yard 2,6) -> spot 2 (side -4,-1): around right side, then back
    ['1-2', [[5, 6], [5, -1], [5, -4], [-5, -4], [-5, -1]]],
    ['2-1', [[-5, -1], [-5, -4], [5, -4], [5, -1], [5, 6], [2, 6]]],
  ]),
}

export const TOWER_META: BuildingMetadata = {
  radius: 24,
  gatherPoint: { x: 0, z: 12 },
  gatherSpread: 1.5,
  workSpots: [
    { x: -4, z: 2, type: 'craft' },    // workstation
    { x: 4, z: -1, type: 'hammer' },   // near campfire
    { x: 0, z: 7, type: 'read' },      // outside gate
  ],
  entryPoint: { x: 0, z: 8 },          // front gate
  internalPaths: new Map([
    // spot 0 (workstation -4,2) -> spot 1 (campfire 4,-1): walk around back
    ['0-1', [[-6, 2], [-6, -4], [6, -4], [6, -1], [4, -1]]],
    ['1-0', [[6, -1], [6, -4], [-6, -4], [-6, 2], [-4, 2]]],
    // spot 0 (workstation) -> spot 2 (gate 0,7): walk around left to front
    ['0-2', [[-6, 2], [-6, 6], [0, 7]]],
    ['2-0', [[-6, 6], [-6, 2], [-4, 2]]],
    // spot 1 (campfire) -> spot 2 (gate): walk around right to front
    ['1-2', [[6, -1], [6, 6], [0, 7]]],
    ['2-1', [[6, 6], [6, -1], [4, -1]]],
  ]),
}

export const WORKSHOP_META: BuildingMetadata = {
  radius: 22,
  gatherPoint: { x: 0, z: 12 },
  gatherSpread: 1.5,
  workSpots: [
    { x: 0, z: 6, type: 'craft' },     // work table under awning
    { x: 6, z: 0, type: 'hammer' },    // next to anvil
    { x: -6, z: 1, type: 'hammer' },   // next to furnace
  ],
  entryPoint: { x: 0, z: 8 },          // front of awning
  internalPaths: new Map([
    // spot 0 (table 0,6) -> spot 1 (anvil 6,0): walk around right side
    ['0-1', [[5, 6], [7, 4], [7, 0], [6, 0]]],
    ['1-0', [[7, 0], [7, 4], [5, 6], [0, 6]]],
    // spot 0 (table) -> spot 2 (furnace -6,1): walk around left side
    ['0-2', [[-5, 6], [-7, 4], [-7, 1], [-6, 1]]],
    ['2-0', [[-7, 1], [-7, 4], [-5, 6], [0, 6]]],
    // spot 1 (anvil) -> spot 2 (furnace): walk around back
    ['1-2', [[7, 0], [7, -4], [-7, -4], [-7, 1], [-6, 1]]],
    ['2-1', [[-7, 1], [-7, -4], [7, -4], [7, 0], [6, 0]]],
  ]),
}
