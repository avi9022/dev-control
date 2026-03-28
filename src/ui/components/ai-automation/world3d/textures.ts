import * as THREE from 'three'
import { TEXTURE_SIZE, HASH_FACTOR_A, HASH_FACTOR_B, HASH_SCALE } from './config'
import { WORLD_COLORS } from './colors'

const DEFAULT_VARIATION = 6
const RGB_MAX = 255
const VARIATION_THRESHOLD = 0.6
const WOOL_VARIATION = 5
const WOOL_SEED_SCALE = 100

const HASH_PRIME_A = 17
const HASH_PRIME_B = 31

const BARS_STRIPE_END = 1
const CRATE_CROSS_THICKNESS = 1

const GRASS_DARK_THRESHOLD = 0.85
const GRASS_LIGHT_R = 75
const GRASS_LIGHT_G = 150
const GRASS_LIGHT_B = 45
const GRASS_DARK_R = 65
const GRASS_DARK_G = 130
const GRASS_DARK_B = 38
const GRASS_VARIATION_R = 8
const GRASS_VARIATION_G = 10
const GRASS_VARIATION_B = 5

const GRASS_SIDE_SEED_OFFSET = 50
const GRASS_FRINGE_BASE = 3
const GRASS_FRINGE_VARIATION = 2
const GRASS_FRINGE_R = 62
const GRASS_FRINGE_G = 125
const GRASS_FRINGE_B = 32
const GRASS_DIRT_R = 115
const GRASS_DIRT_G = 88
const GRASS_DIRT_B = 58
const GRASS_DIRT_VARIATION_R = 8
const GRASS_DIRT_VARIATION_G = 6
const GRASS_DIRT_VARIATION_B = 5

const DARK_GRASS_SEED_OFFSET = 33
const DARK_GRASS_THRESHOLD = 0.7
const DARK_GRASS_DARK_R = 28
const DARK_GRASS_DARK_G = 65
const DARK_GRASS_DARK_B = 18
const DARK_GRASS_LIGHT_R = 35
const DARK_GRASS_LIGHT_G = 80
const DARK_GRASS_LIGHT_B = 22
const DARK_GRASS_VARIATION_R = 12
const DARK_GRASS_VARIATION_G = 18
const DARK_GRASS_VARIATION_B = 8

const DARK_GRASS_SIDE_SEED = 66
const DARK_GRASS_FRINGE_R = 30
const DARK_GRASS_FRINGE_G = 65
const DARK_GRASS_FRINGE_B = 16
const DARK_GRASS_FRINGE_VARIATION_R = 10
const DARK_GRASS_FRINGE_VARIATION_G = 15
const DARK_GRASS_FRINGE_VARIATION_B = 6
const DARK_GRASS_DIRT_R = 85
const DARK_GRASS_DIRT_G = 68
const DARK_GRASS_DIRT_B = 40
const DARK_GRASS_DIRT_VARIATION_R = 16
const DARK_GRASS_DIRT_VARIATION_G = 12
const DARK_GRASS_DIRT_VARIATION_B = 8

const STONE_SEED_OFFSET = 99
const STONE_CRACK_THRESHOLD = 0.92
const STONE_CRACK_BASE = 105
const STONE_BASE = 125
const STONE_VARIATION = 8
const STONE_BLUE_TINT = 3

const BRICK_ROW_HEIGHT = 4
const BRICK_WIDTH = 8
const BRICK_OFFSET_SIZE = 4
const BRICK_MORTAR_BASE = 155
const BRICK_MORTAR_VARIATION = 10
const BRICK_MORTAR_TINT = 2
const BRICK_TONE_SCALE = 15
const BRICK_BASE = 115
const BRICK_VARIATION = 8

const WOOD_LIGHT_R = 130
const WOOD_LIGHT_G = 105
const WOOD_LIGHT_B = 72
const WOOD_DARK_R = 82
const WOOD_DARK_G = 52
const WOOD_DARK_B = 32
const WOOD_LIGHT_SEED = 150
const WOOD_DARK_SEED = 200
const WOOD_GRAIN_SPACING = 4
const WOOD_GRAIN_DARKEN = -8
const WOOD_VARIATION_R = 6
const WOOD_VARIATION_G = 5
const WOOD_VARIATION_B = 4

const LEAF_SEED_OFFSET = 77
const LEAF_GAP_THRESHOLD = 0.9
const LEAF_GAP_R = 28
const LEAF_GAP_G = 68
const LEAF_GAP_B = 15
const LEAF_LIGHT_R = 38
const LEAF_LIGHT_G = 85
const LEAF_LIGHT_B = 22
const LEAF_VARIATION_R = 8
const LEAF_VARIATION_G = 12
const LEAF_VARIATION_B = 5

const BARS_SEED_OFFSET = 888
const BARS_STRIPE_WIDTH = 4
const BARS_BASE = 50
const BARS_VARIATION = 20
const BARS_BLUE_TINT = 5

const LANTERN_SEED_OFFSET = 444
const LANTERN_BRIGHT_THRESHOLD = 0.7
const LANTERN_BRIGHT_R = 245
const LANTERN_BRIGHT_G = 210
const LANTERN_BRIGHT_B = 100
const LANTERN_BASE_R = 220
const LANTERN_BASE_G = 185
const LANTERN_BASE_B = 70
const LANTERN_VARIATION = 20

const CRATE_SEED_OFFSET = 555
const CRATE_LAST_PIXEL = 15
const CRATE_PLANK_SPACING = 4
const CRATE_BORDER_R = 85
const CRATE_BORDER_G = 60
const CRATE_BORDER_B = 35
const CRATE_BORDER_VAR_R = 10
const CRATE_BORDER_VAR_G = 8
const CRATE_BORDER_VAR_B = 6
const CRATE_CROSS_R = 110
const CRATE_CROSS_G = 80
const CRATE_CROSS_B = 45
const CRATE_CROSS_VAR_R = 12
const CRATE_CROSS_VAR_G = 10
const CRATE_CROSS_VAR_B = 8
const CRATE_PLANK_R = 130
const CRATE_PLANK_G = 95
const CRATE_PLANK_B = 55
const CRATE_PLANK_VAR_R = 10
const CRATE_PLANK_VAR_G = 8
const CRATE_PLANK_VAR_B = 6
const CRATE_FILL_R = 145
const CRATE_FILL_G = 110
const CRATE_FILL_B = 65
const CRATE_FILL_VAR_R = 15
const CRATE_FILL_VAR_G = 12
const CRATE_FILL_VAR_B = 10

const DIRT_R = 110
const DIRT_G = 85
const DIRT_B = 55
const DIRT_VARIATION = 18
const DIRT_SEED = 1
const DIRT_SIDE_R = 105
const DIRT_SIDE_G = 80
const DIRT_SIDE_B = 50
const DIRT_SIDE_VARIATION = 15
const DIRT_SIDE_SEED = 2
const DIRT_BOTTOM_R = 95
const DIRT_BOTTOM_G = 72
const DIRT_BOTTOM_B = 45
const DIRT_BOTTOM_VARIATION = 12
const DIRT_BOTTOM_SEED = 3

const COBBLE_R = 150
const COBBLE_G = 138
const COBBLE_B = 112
const COBBLE_VARIATION = 20
const COBBLE_SEED = 5

const SAND_R = 196
const SAND_G = 169
const SAND_B = 125
const SAND_VARIATION = 14
const SAND_SEED = 6

const WATER_R = 59
const WATER_G = 125
const WATER_B = 176
const WATER_VARIATION = 12
const WATER_SEED = 7

const DEFAULT_R = 128
const DEFAULT_G = 128
const DEFAULT_B = 128
const DEFAULT_VARIATION_AMT = 10
const DEFAULT_SEED = 99

function generateTexture(
  baseR: number, baseG: number, baseB: number,
  variation: number = DEFAULT_VARIATION,
  seed: number = 0,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin((x + seed * HASH_PRIME_A) * HASH_FACTOR_A + (y + seed * HASH_PRIME_B) * HASH_FACTOR_B) * HASH_SCALE
      const rand = (n - Math.floor(n)) * 2 - 1
      const apply = Math.abs(rand) > VARIATION_THRESHOLD ? rand : 0

      const r = Math.max(0, Math.min(RGB_MAX, baseR + Math.round(apply * variation)))
      const g = Math.max(0, Math.min(RGB_MAX, baseG + Math.round(apply * variation)))
      const b = Math.max(0, Math.min(RGB_MAX, baseB + Math.round(apply * variation)))

      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function grassTop() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B) * HASH_SCALE
      const rand = n - Math.floor(n)
      const dark = rand > GRASS_DARK_THRESHOLD
      const r = dark ? GRASS_DARK_R : GRASS_LIGHT_R + Math.round(rand * GRASS_VARIATION_R)
      const g = dark ? GRASS_DARK_G : GRASS_LIGHT_G + Math.round(rand * GRASS_VARIATION_G)
      const b = dark ? GRASS_DARK_B : GRASS_LIGHT_B + Math.round(rand * GRASS_VARIATION_B)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function grassSide() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + GRASS_SIDE_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)

      if (y < GRASS_FRINGE_BASE + Math.round(rand * GRASS_FRINGE_VARIATION)) {
        const r = GRASS_FRINGE_R + Math.round(rand * GRASS_VARIATION_R)
        const g = GRASS_FRINGE_G + Math.round(rand * GRASS_VARIATION_G)
        const b = GRASS_FRINGE_B + Math.round(rand * GRASS_VARIATION_B)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      } else {
        const r = GRASS_DIRT_R + Math.round(rand * GRASS_DIRT_VARIATION_R)
        const g = GRASS_DIRT_G + Math.round(rand * GRASS_DIRT_VARIATION_G)
        const b = GRASS_DIRT_B + Math.round(rand * GRASS_DIRT_VARIATION_B)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function darkGrassTop() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + DARK_GRASS_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)
      const dark = rand > DARK_GRASS_THRESHOLD
      const r = dark ? DARK_GRASS_DARK_R : DARK_GRASS_LIGHT_R + Math.round(rand * DARK_GRASS_VARIATION_R)
      const g = dark ? DARK_GRASS_DARK_G : DARK_GRASS_LIGHT_G + Math.round(rand * DARK_GRASS_VARIATION_G)
      const b = dark ? DARK_GRASS_DARK_B : DARK_GRASS_LIGHT_B + Math.round(rand * DARK_GRASS_VARIATION_B)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function darkGrassSide() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + DARK_GRASS_SIDE_SEED) * HASH_SCALE
      const rand = n - Math.floor(n)

      if (y < GRASS_FRINGE_BASE + Math.round(rand * GRASS_FRINGE_VARIATION)) {
        const r = DARK_GRASS_FRINGE_R + Math.round(rand * DARK_GRASS_FRINGE_VARIATION_R)
        const g = DARK_GRASS_FRINGE_G + Math.round(rand * DARK_GRASS_FRINGE_VARIATION_G)
        const b = DARK_GRASS_FRINGE_B + Math.round(rand * DARK_GRASS_FRINGE_VARIATION_B)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      } else {
        const r = DARK_GRASS_DIRT_R + Math.round(rand * DARK_GRASS_DIRT_VARIATION_R)
        const g = DARK_GRASS_DIRT_G + Math.round(rand * DARK_GRASS_DIRT_VARIATION_G)
        const b = DARK_GRASS_DIRT_B + Math.round(rand * DARK_GRASS_DIRT_VARIATION_B)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function stoneTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + STONE_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)
      const crack = rand > STONE_CRACK_THRESHOLD
      const base = crack ? STONE_CRACK_BASE : STONE_BASE + Math.round(rand * STONE_VARIATION)
      ctx.fillStyle = `rgb(${base},${base},${base + STONE_BLUE_TINT})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function brickTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + STONE_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)

      const row = Math.floor(y / BRICK_ROW_HEIGHT)
      const offset = (row % 2) * BRICK_OFFSET_SIZE
      const isMortarH = y % BRICK_ROW_HEIGHT === 0
      const isMortarV = (x + offset) % BRICK_WIDTH === 0

      if (isMortarH || isMortarV) {
        const v = BRICK_MORTAR_BASE + Math.round(rand * BRICK_MORTAR_VARIATION)
        ctx.fillStyle = `rgb(${v},${v},${v - BRICK_MORTAR_TINT})`
      } else {
        const brickSeed = Math.sin((Math.floor((x + offset) / BRICK_WIDTH)) * HASH_PRIME_B + row * HASH_PRIME_A) * HASH_SCALE
        const brickTone = (brickSeed - Math.floor(brickSeed)) * BRICK_TONE_SCALE
        const base = BRICK_BASE + Math.round(brickTone) + Math.round(rand * BRICK_VARIATION)
        ctx.fillStyle = `rgb(${base},${base},${base + STONE_BLUE_TINT})`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function woodTexture(dark: boolean = false) {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  const baseR = dark ? WOOD_DARK_R : WOOD_LIGHT_R
  const baseG = dark ? WOOD_DARK_G : WOOD_LIGHT_G
  const baseB = dark ? WOOD_DARK_B : WOOD_LIGHT_B

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + (dark ? WOOD_DARK_SEED : WOOD_LIGHT_SEED)) * HASH_SCALE
      const rand = n - Math.floor(n)
      const grain = (y % WOOD_GRAIN_SPACING === 0) ? WOOD_GRAIN_DARKEN : 0
      const r = baseR + Math.round(rand * WOOD_VARIATION_R) + grain
      const g = baseG + Math.round(rand * WOOD_VARIATION_G) + grain
      const b = baseB + Math.round(rand * WOOD_VARIATION_B) + grain
      ctx.fillStyle = `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function leafTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + LEAF_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)
      const gap = rand > LEAF_GAP_THRESHOLD
      const r = gap ? LEAF_GAP_R : LEAF_LIGHT_R + Math.round(rand * LEAF_VARIATION_R)
      const g = gap ? LEAF_GAP_G : LEAF_LIGHT_G + Math.round(rand * LEAF_VARIATION_G)
      const b = gap ? LEAF_GAP_B : LEAF_LIGHT_B + Math.round(rand * LEAF_VARIATION_B)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function woolTexture(hexColor: string) {
  const c = new THREE.Color(hexColor)
  const r = Math.round(c.r * RGB_MAX)
  const g = Math.round(c.g * RGB_MAX)
  const b = Math.round(c.b * RGB_MAX)
  return generateTexture(r, g, b, WOOL_VARIATION, Math.round(c.r * WOOL_SEED_SCALE))
}

function barsTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const isBar = x % BARS_STRIPE_WIDTH === 0 || x % BARS_STRIPE_WIDTH === BARS_STRIPE_END
      const isFrame = y === 0 || y === TEXTURE_SIZE - 1
      if (isBar || isFrame) {
        const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + BARS_SEED_OFFSET) * HASH_SCALE
        const rand = n - Math.floor(n)
        const v = BARS_BASE + Math.round(rand * BARS_VARIATION)
        ctx.fillStyle = `rgb(${v}, ${v}, ${v + BARS_BLUE_TINT})`
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function lanternTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + LANTERN_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)
      const bright = rand > LANTERN_BRIGHT_THRESHOLD
      const r = bright ? LANTERN_BRIGHT_R : LANTERN_BASE_R + Math.round(rand * LANTERN_VARIATION)
      const g = bright ? LANTERN_BRIGHT_G : LANTERN_BASE_G + Math.round(rand * LANTERN_VARIATION)
      const b = bright ? LANTERN_BRIGHT_B : LANTERN_BASE_B + Math.round(rand * LANTERN_VARIATION)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

function crateTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = TEXTURE_SIZE
  canvas.height = TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.CanvasTexture(canvas)

  for (let x = 0; x < TEXTURE_SIZE; x++) {
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      const n = Math.sin(x * HASH_FACTOR_A + y * HASH_FACTOR_B + CRATE_SEED_OFFSET) * HASH_SCALE
      const rand = n - Math.floor(n)

      const isBorder = x === 0 || x === CRATE_LAST_PIXEL || y === 0 || y === CRATE_LAST_PIXEL
      const isCross = Math.abs(x - y) <= CRATE_CROSS_THICKNESS || Math.abs(x - (CRATE_LAST_PIXEL - y)) <= CRATE_CROSS_THICKNESS
      const isPlank = y % CRATE_PLANK_SPACING === 0

      if (isBorder) {
        ctx.fillStyle = `rgb(${CRATE_BORDER_R + Math.round(rand * CRATE_BORDER_VAR_R)}, ${CRATE_BORDER_G + Math.round(rand * CRATE_BORDER_VAR_G)}, ${CRATE_BORDER_B + Math.round(rand * CRATE_BORDER_VAR_B)})`
      } else if (isCross) {
        ctx.fillStyle = `rgb(${CRATE_CROSS_R + Math.round(rand * CRATE_CROSS_VAR_R)}, ${CRATE_CROSS_G + Math.round(rand * CRATE_CROSS_VAR_G)}, ${CRATE_CROSS_B + Math.round(rand * CRATE_CROSS_VAR_B)})`
      } else if (isPlank) {
        ctx.fillStyle = `rgb(${CRATE_PLANK_R + Math.round(rand * CRATE_PLANK_VAR_R)}, ${CRATE_PLANK_G + Math.round(rand * CRATE_PLANK_VAR_G)}, ${CRATE_PLANK_B + Math.round(rand * CRATE_PLANK_VAR_B)})`
      } else {
        ctx.fillStyle = `rgb(${CRATE_FILL_R + Math.round(rand * CRATE_FILL_VAR_R)}, ${CRATE_FILL_G + Math.round(rand * CRATE_FILL_VAR_G)}, ${CRATE_FILL_B + Math.round(rand * CRATE_FILL_VAR_B)})`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

// Texture Cache

const textureCache = new Map<string, THREE.CanvasTexture>()

function cached(key: string, factory: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const existing = textureCache.get(key)
  if (existing) return existing
  const texture = factory()
  textureCache.set(key, texture)
  return texture
}

export function getBlockTextures(type: string, color?: string): {
  top: THREE.CanvasTexture
  side: THREE.CanvasTexture
  bottom: THREE.CanvasTexture
} {
  switch (type) {
    case 'grass':
      return {
        top: cached('grass-top', grassTop),
        side: cached('grass-side', grassSide),
        bottom: cached('dirt-tex', () => generateTexture(DIRT_R, DIRT_G, DIRT_B, DIRT_VARIATION, DIRT_SEED)),
      }
    case 'darkgrass':
      return {
        top: cached('darkgrass-top', darkGrassTop),
        side: cached('darkgrass-side', darkGrassSide),
        bottom: cached('dirt-tex', () => generateTexture(DIRT_R, DIRT_G, DIRT_B, DIRT_VARIATION, DIRT_SEED)),
      }
    case 'dirt':
      return {
        top: cached('dirt-tex', () => generateTexture(DIRT_R, DIRT_G, DIRT_B, DIRT_VARIATION, DIRT_SEED)),
        side: cached('dirt-tex-side', () => generateTexture(DIRT_SIDE_R, DIRT_SIDE_G, DIRT_SIDE_B, DIRT_SIDE_VARIATION, DIRT_SIDE_SEED)),
        bottom: cached('dirt-tex-bottom', () => generateTexture(DIRT_BOTTOM_R, DIRT_BOTTOM_G, DIRT_BOTTOM_B, DIRT_BOTTOM_VARIATION, DIRT_BOTTOM_SEED)),
      }
    case 'stone': {
      const tex = cached('stone-tex', stoneTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'wood': {
      const tex = cached('wood-tex', () => woodTexture(false))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'darkwood': {
      const tex = cached('darkwood-tex', () => woodTexture(true))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'cobble': {
      const tex = cached('cobble-tex', () => generateTexture(COBBLE_R, COBBLE_G, COBBLE_B, COBBLE_VARIATION, COBBLE_SEED))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'sand': {
      const tex = cached('sand-tex', () => generateTexture(SAND_R, SAND_G, SAND_B, SAND_VARIATION, SAND_SEED))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'leaf': {
      const tex = cached('leaf-tex', leafTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'brick': {
      const tex = cached('brick-tex', brickTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'lantern': {
      const tex = cached('lantern-tex', lanternTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'crate': {
      const tex = cached('crate-tex', crateTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'bars': {
      const tex = cached('bars-tex', barsTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'water': {
      const tex = cached('water-tex', () => generateTexture(WATER_R, WATER_G, WATER_B, WATER_VARIATION, WATER_SEED))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'wool': {
      const c = color || WORLD_COLORS.DEFAULT_WOOL
      const tex = cached(`wool-${c}`, () => woolTexture(c))
      return { top: tex, side: tex, bottom: tex }
    }
    default: {
      const tex = cached('default-tex', () => generateTexture(DEFAULT_R, DEFAULT_G, DEFAULT_B, DEFAULT_VARIATION_AMT, DEFAULT_SEED))
      return { top: tex, side: tex, bottom: tex }
    }
  }
}
