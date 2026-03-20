import * as THREE from 'three'

/**
 * Generate a 16x16 procedural pixel-art texture.
 * Each pixel gets slight random variation from the base color,
 * creating a Minecraft-like noisy texture.
 */
function generateTexture(
  baseR: number, baseG: number, baseB: number,
  variation: number = 15,
  seed: number = 0,
): THREE.CanvasTexture {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      // Deterministic pseudo-random per pixel
      const n = Math.sin((x + seed * 17) * 127.1 + (y + seed * 31) * 311.7) * 43758.5453
      const rand = (n - Math.floor(n)) * 2 - 1 // -1 to 1

      const r = Math.max(0, Math.min(255, baseR + Math.round(rand * variation)))
      const g = Math.max(0, Math.min(255, baseG + Math.round(rand * variation)))
      const b = Math.max(0, Math.min(255, baseB + Math.round(rand * variation)))

      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Grass top — green with darker spots */
function grassTop() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
      const rand = n - Math.floor(n)
      const dark = rand > 0.7
      const r = dark ? 60 : 75 + Math.round(rand * 20)
      const g = dark ? 120 : 150 + Math.round(rand * 25)
      const b = dark ? 35 : 45 + Math.round(rand * 10)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Grass side — dirt with green fringe on top rows */
function grassSide() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + 50) * 43758.5453
      const rand = n - Math.floor(n)

      if (y < 3 + Math.round(rand * 2)) {
        // Green fringe at top
        const r = 60 + Math.round(rand * 15)
        const g = 120 + Math.round(rand * 20)
        const b = 30 + Math.round(rand * 10)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      } else {
        // Dirt below
        const r = 110 + Math.round(rand * 20)
        const g = 85 + Math.round(rand * 15)
        const b = 55 + Math.round(rand * 12)
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

/** Dark grass top — deeper green */
function darkGrassTop() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + 33) * 43758.5453
      const rand = n - Math.floor(n)
      const dark = rand > 0.7
      const r = dark ? 28 : 35 + Math.round(rand * 12)
      const g = dark ? 65 : 80 + Math.round(rand * 18)
      const b = dark ? 18 : 22 + Math.round(rand * 8)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Dark grass side — dirt with darker green fringe */
function darkGrassSide() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + 66) * 43758.5453
      const rand = n - Math.floor(n)

      if (y < 3 + Math.round(rand * 2)) {
        const r = 30 + Math.round(rand * 10)
        const g = 65 + Math.round(rand * 15)
        const b = 16 + Math.round(rand * 6)
        ctx.fillStyle = `rgb(${r},${g},${b})`
      } else {
        const r = 85 + Math.round(rand * 16)
        const g = 68 + Math.round(rand * 12)
        const b = 40 + Math.round(rand * 8)
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

/** Stone — grey with dark cracks/spots */
function stoneTexture() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + 99) * 43758.5453
      const rand = n - Math.floor(n)
      const crack = rand > 0.85
      const base = crack ? 90 : 125 + Math.round(rand * 20)
      ctx.fillStyle = `rgb(${base},${base},${base + 5})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Wood plank — brown with grain lines */
function woodTexture(dark: boolean = false) {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  const baseR = dark ? 82 : 130
  const baseG = dark ? 52 : 105
  const baseB = dark ? 32 : 72

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + (dark ? 200 : 150)) * 43758.5453
      const rand = n - Math.floor(n)
      // Horizontal grain lines
      const grain = (y % 4 === 0) ? -15 : 0
      const r = baseR + Math.round(rand * 18) + grain
      const g = baseG + Math.round(rand * 12) + grain
      const b = baseB + Math.round(rand * 8) + grain
      ctx.fillStyle = `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Leaf — varied greens with gaps */
function leafTexture() {
  const size = 16
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const n = Math.sin(x * 127.1 + y * 311.7 + 77) * 43758.5453
      const rand = n - Math.floor(n)
      const gap = rand > 0.8
      const r = gap ? 20 : 35 + Math.round(rand * 20)
      const g = gap ? 60 : 80 + Math.round(rand * 30)
      const b = gap ? 12 : 20 + Math.round(rand * 10)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
}

/** Wool — base color with subtle pixel variation */
function woolTexture(hexColor: string) {
  const c = new THREE.Color(hexColor)
  const r = Math.round(c.r * 255)
  const g = Math.round(c.g * 255)
  const b = Math.round(c.b * 255)
  return generateTexture(r, g, b, 12, Math.round(c.r * 100))
}

// ─── Texture Cache ───

const textureCache = new Map<string, THREE.CanvasTexture>()

function cached(key: string, factory: () => THREE.CanvasTexture): THREE.CanvasTexture {
  if (!textureCache.has(key)) {
    textureCache.set(key, factory())
  }
  return textureCache.get(key)!
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
        bottom: cached('dirt-tex', () => generateTexture(110, 85, 55, 18, 1)),
      }
    case 'darkgrass':
      return {
        top: cached('darkgrass-top', darkGrassTop),
        side: cached('darkgrass-side', darkGrassSide),
        bottom: cached('dirt-tex', () => generateTexture(110, 85, 55, 18, 1)),
      }
    case 'dirt':
      return {
        top: cached('dirt-tex', () => generateTexture(110, 85, 55, 18, 1)),
        side: cached('dirt-tex-side', () => generateTexture(105, 80, 50, 15, 2)),
        bottom: cached('dirt-tex-bottom', () => generateTexture(95, 72, 45, 12, 3)),
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
      const tex = cached('cobble-tex', () => generateTexture(150, 138, 112, 20, 5))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'sand': {
      const tex = cached('sand-tex', () => generateTexture(196, 169, 125, 14, 6))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'leaf': {
      const tex = cached('leaf-tex', leafTexture)
      return { top: tex, side: tex, bottom: tex }
    }
    case 'water': {
      const tex = cached('water-tex', () => generateTexture(59, 125, 176, 12, 7))
      return { top: tex, side: tex, bottom: tex }
    }
    case 'wool': {
      const c = color || '#B0AAA4'
      const tex = cached(`wool-${c}`, () => woolTexture(c))
      return { top: tex, side: tex, bottom: tex }
    }
    default: {
      const tex = cached('default-tex', () => generateTexture(128, 128, 128, 10, 99))
      return { top: tex, side: tex, bottom: tex }
    }
  }
}
