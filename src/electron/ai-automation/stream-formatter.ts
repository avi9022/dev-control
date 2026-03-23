import {
  type ClaudeStreamEvent,
  type StreamContentToolUseBlock,
  isAssistantEvent,
  isResultEvent,
  isSystemEvent,
  isErrorEvent,
  isContentBlockStartEvent,
  isContentBlockDeltaEvent,
  isToolUseBlock,
  isTextBlock,
} from './stream-types.js'

const COMMAND_TRUNCATE_LENGTH = 100
const DEBUG_LOG_TRUNCATE_LENGTH = 300

function formatToolUse(block: StreamContentToolUseBlock): string {
  const name = block.name
  const input = block.input
  let detail = ''
  if (input) {
    if (name === 'Read' && input.file_path) detail = ` → ${input.file_path}`
    else if (name === 'Edit' && input.file_path) detail = ` → ${input.file_path}`
    else if (name === 'Write' && input.file_path) detail = ` → ${input.file_path}`
    else if ((name === 'Bash' || name === 'bash') && input.command) {
      const cmd = input.command.slice(0, COMMAND_TRUNCATE_LENGTH)
      detail = ` → ${cmd}${input.command.length > COMMAND_TRUNCATE_LENGTH ? '...' : ''}`
    }
    else if (name === 'Grep' && input.pattern) detail = ` → "${input.pattern}"`
    else if (name === 'Glob' && input.pattern) detail = ` → "${input.pattern}"`
  }
  return `\n🔧 ${name}${detail}\n`
}

export function formatStreamEvent(event: ClaudeStreamEvent): string | null {
  // --- Claude Code CLI events (assistant turns with full content) ---
  if (isAssistantEvent(event)) {
    const content = event.message.content
    if (!content) return null

    const parts: string[] = []
    for (const block of content) {
      if (isTextBlock(block)) {
        parts.push(block.text)
      } else if (isToolUseBlock(block)) {
        parts.push(formatToolUse(block))
      }
    }
    return parts.length > 0 ? parts.join('') : null
  }

  // Tool result events
  if (event.type === 'tool') {
    return null
  }

  // --- Anthropic API streaming events ---
  if (isContentBlockStartEvent(event)) {
    const block = event.content_block
    if (block && isToolUseBlock(block)) return `\n🔧 ${block.name}\n`
    return null
  }

  if (isContentBlockDeltaEvent(event)) {
    const delta = event.delta
    if (delta?.type === 'text_delta' && delta.text) return delta.text
    return null
  }

  if (event.type === 'content_block_stop' || event.type === 'message_stop') {
    return null
  }

  // Extract usage data from message events (don't display, but return for stats tracking)
  if (event.type === 'message_start' || event.type === 'message_delta') {
    return null
  }

  // --- Result & system events ---
  if (isResultEvent(event)) {
    const parts: string[] = []
    if (event.result) parts.push(`\n${event.result}\n`)
    if (event.cost_usd !== undefined) {
      const cost = event.cost_usd.toFixed(4)
      const duration = event.duration_ms ? ` | ${(event.duration_ms / 1000).toFixed(1)}s` : ''
      parts.push(`💰 Cost: $${cost}${duration}\n`)
    }
    return parts.length > 0 ? parts.join('') : null
  }

  if (isSystemEvent(event)) {
    if (event.subtype === 'init') return '⚡ Agent initialized\n'
    if (event.message) return `[system] ${event.message}\n`
    return null
  }

  if (isErrorEvent(event)) {
    return `\n❌ Error: ${event.error?.message || JSON.stringify(event)}\n`
  }

  console.log(`[ai-agent] Unhandled event type: ${event.type}`, JSON.stringify(event).slice(0, DEBUG_LOG_TRUNCATE_LENGTH))
  return null
}
