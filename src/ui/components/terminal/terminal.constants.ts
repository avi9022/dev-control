import type { HighlightToken } from './terminal.types'

export const LEVEL_PREFIXES: Record<string, string> = {
  ERROR: "text-status-red font-semibold",
  WARN: "text-status-yellow font-semibold",
  INFO: "text-status-green font-semibold",
  DEBUG: "text-blue-400 font-semibold",
  TRACE: "text-gray-400 italic",
}

export const IN_LINE_TOKENS: HighlightToken[] = [
  { regex: /\berror\b/i, className: "text-status-red" },
  { regex: /\bfail(?:ed)?\b/i, className: "text-status-red" },
  { regex: /\bexception\b/i, className: "text-status-red italic" },
  { regex: /\bwarn(?:ing)?\b/i, className: "text-yellow-400" },
  { regex: /\bdeprecated\b/i, className: "text-yellow-400 italic" },
  { regex: /\binfo\b/i, className: "text-status-green" },
  { regex: /\bdebug\b/i, className: "text-yellow-400" },
  { regex: /\bstarted?\b/i, className: "text-status-green" },
]

// Window-based infinite scroll constants
export const WINDOW_SIZE = 2000
export const CHUNK_SIZE = 500
export const PRELOAD_THRESHOLD = 0.2
export const RENDER_BUFFER = 50
export const ESTIMATED_LINE_HEIGHT = 20
