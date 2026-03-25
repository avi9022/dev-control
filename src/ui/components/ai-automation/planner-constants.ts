export const SUMMARY_TRUNCATE_LENGTH = 80
export const DEBUG_JSON_MAX_HEIGHT = 300
export const PLANNER_GREETING = "Hey! What would you like to plan today? Tell me about the goal or project you have in mind."
export const CONVERSATION_LIST_TRUNCATE_LENGTH = 60
export const SIDEBAR_WIDTH = 280
export const DIALOG_MAX_WIDTH = '1200px'
export const DIALOG_HEIGHT = '85vh'
export const LOADING_DOT_SIZE = 'h-1.5 w-1.5'
export const INPUT_MIN_HEIGHT = '72px'
export const INPUT_MAX_HEIGHT = '144px'

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const SECONDS_PER_DAY = 86400

export function formatRelativeTime(isoDate: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000)
  if (seconds < SECONDS_PER_MINUTE) return 'just now'
  if (seconds < SECONDS_PER_HOUR) {
    const mins = Math.floor(seconds / SECONDS_PER_MINUTE)
    return `${mins}m ago`
  }
  if (seconds < SECONDS_PER_DAY) {
    const hours = Math.floor(seconds / SECONDS_PER_HOUR)
    return `${hours}h ago`
  }
  const days = Math.floor(seconds / SECONDS_PER_DAY)
  return `${days}d ago`
}

export const DEBUG_EVENT_COLORS: Record<string, string> = {
  system: 'var(--ai-text-tertiary)',
  system_prompt: 'var(--ai-accent)',
  tool_call: 'var(--ai-warning)',
  response: 'var(--ai-accent)',
  user: 'var(--ai-purple)',
  result: 'var(--ai-success)',
  rate_limit: 'var(--ai-pink)',
}
