import type { HighlightToken } from './terminal.types'

export const LEVEL_PREFIXES: Record<string, string> = {
  ERROR: "text-red-500 font-semibold",
  WARN: "text-yellow-500 font-semibold",
  INFO: "text-green-500 font-semibold",
  DEBUG: "text-blue-400 font-semibold",
  TRACE: "text-gray-400 italic",
}

export const IN_LINE_TOKENS: HighlightToken[] = [
  { regex: /\berror\b/i, className: "text-red-400" },
  { regex: /\bfail(?:ed)?\b/i, className: "text-red-400" },
  { regex: /\bexception\b/i, className: "text-red-400 italic" },
  { regex: /\bwarn(?:ing)?\b/i, className: "text-yellow-400" },
  { regex: /\bdeprecated\b/i, className: "text-yellow-400 italic" },
  { regex: /\binfo\b/i, className: "text-green-400" },
  { regex: /\bdebug\b/i, className: "text-yellow-400" },
  { regex: /\bstarted?\b/i, className: "text-green-400" },
]

// Window-based infinite scroll constants
export const WINDOW_SIZE = 2000
export const CHUNK_SIZE = 500
export const PRELOAD_THRESHOLD = 0.2
export const RENDER_BUFFER = 50
export const ESTIMATED_LINE_HEIGHT = 20
