import {
  type ClaudeStreamEvent,
  type StreamContentBlock,
  type StreamToolInput,
  isAssistantEvent,
  isResultEvent,
  isSystemEvent,
  isErrorEvent,
  isUserEvent,
  isToolUseBlock,
  isTextBlock,
} from '@/shared/stream-types'

export enum ChatMessageType {
  AgentText = 'agent-text',
  ToolCall = 'tool-call',
  UserMessage = 'user-message',
  System = 'system',
  Error = 'error',
}

export interface ChatMessage {
  id: string
  type: ChatMessageType
  content: string
  toolName?: string
  toolDetail?: string
  costUsd?: number
  durationMs?: number
  timestamp: string
}

const enum ToolName {
  Read = 'Read',
  Edit = 'Edit',
  Write = 'Write',
  Bash = 'Bash',
  BashLower = 'bash',
  Grep = 'Grep',
  Glob = 'Glob',
}

const TOOL_DETAIL_SEPARATOR = ' → '
const COMMAND_TRUNCATE_LENGTH = 100
const RESUMED_HEADER = '--- RESUMED (user message) ---'
const COST_DECIMAL_PLACES = 4
const MS_PER_SECOND = 1000
const SYSTEM_SUBTYPE_INIT = 'init'

let messageCounter = 0

function nextId(): string {
  messageCounter++
  return `msg-${messageCounter}`
}

function extractToolDetail(block: StreamContentBlock): string {
  if (!isToolUseBlock(block)) return ''
  const input: StreamToolInput | undefined = block.input
  if (!input) return ''
  if (block.name === ToolName.Read && input.file_path) return `${TOOL_DETAIL_SEPARATOR}${input.file_path}`
  if (block.name === ToolName.Edit && input.file_path) return `${TOOL_DETAIL_SEPARATOR}${input.file_path}`
  if (block.name === ToolName.Write && input.file_path) return `${TOOL_DETAIL_SEPARATOR}${input.file_path}`
  if ((block.name === ToolName.Bash || block.name === ToolName.BashLower) && input.command) {
    const cmd: string = String(input.command).slice(0, COMMAND_TRUNCATE_LENGTH)
    const suffix: string = String(input.command).length > COMMAND_TRUNCATE_LENGTH ? '...' : ''
    return `${TOOL_DETAIL_SEPARATOR}${cmd}${suffix}`
  }
  if (block.name === ToolName.Grep && input.pattern) return `${TOOL_DETAIL_SEPARATOR}"${input.pattern}"`
  if (block.name === ToolName.Glob && input.pattern) return `${TOOL_DETAIL_SEPARATOR}"${input.pattern}"`
  return ''
}

function now(): string {
  return new Date().toISOString()
}

export function parseEventToMessages(event: ClaudeStreamEvent): ChatMessage[] {
  const messages: ChatMessage[] = []

  if (isAssistantEvent(event)) {
    const content = event.message.content
    if (!content) return messages

    let textParts: string[] = []

    for (const block of content) {
      if (isTextBlock(block)) {
        textParts.push(block.text)
      } else if (isToolUseBlock(block)) {
        if (textParts.length > 0) {
          const combined = textParts.join('\n')
          messages.push(...splitResumedText(combined))
          textParts = []
        }
        messages.push({
          id: nextId(),
          type: ChatMessageType.ToolCall,
          content: `${block.name}${extractToolDetail(block)}`,
          toolName: block.name,
          toolDetail: extractToolDetail(block).replace(TOOL_DETAIL_SEPARATOR, ''),
          timestamp: now(),
        })
      }
    }

    if (textParts.length > 0) {
      const combined = textParts.join('\n')
      messages.push(...splitResumedText(combined))
    }

    return messages
  }

  if (isResultEvent(event)) {
    if (event.cost_usd === undefined) return messages
    const cost: string = event.cost_usd.toFixed(COST_DECIMAL_PLACES)
    const duration: string = event.duration_ms ? ` | ${(event.duration_ms / MS_PER_SECOND).toFixed(1)}s` : ''
    messages.push({
      id: nextId(),
      type: ChatMessageType.System,
      content: `Cost: $${cost}${duration}`,
      costUsd: event.cost_usd,
      durationMs: event.duration_ms,
      timestamp: now(),
    })
    return messages
  }

  if (isSystemEvent(event)) {
    if (event.subtype === SYSTEM_SUBTYPE_INIT) {
      return messages
    } else if (event.message) {
      messages.push({
        id: nextId(),
        type: ChatMessageType.System,
        content: event.message,
        timestamp: now(),
      })
    }
    return messages
  }

  if (isErrorEvent(event)) {
    messages.push({
      id: nextId(),
      type: ChatMessageType.Error,
      content: event.error?.message || 'Unknown error',
      timestamp: now(),
    })
    return messages
  }

  if (isUserEvent(event)) {
    if (!event.isHumanMessage) return messages

    const content = event.message?.content
    if (content) {
      const textParts: string[] = []
      for (const block of content) {
        if (isTextBlock(block)) textParts.push(block.text)
      }
      const text = textParts.join('\n').trim()
      if (text) {
        messages.push({
          id: nextId(),
          type: ChatMessageType.UserMessage,
          content: text,
          timestamp: now(),
        })
      }
    }
    return messages
  }

  return messages
}

function splitResumedText(text: string): ChatMessage[] {
  const messages: ChatMessage[] = []
  const resumeIndex = text.indexOf(RESUMED_HEADER)

  if (resumeIndex === -1) {
    const trimmed = text.trim()
    if (trimmed) {
      messages.push({
        id: nextId(),
        type: ChatMessageType.AgentText,
        content: trimmed,
        timestamp: now(),
      })
    }
    return messages
  }

  const before = text.slice(0, resumeIndex).trim()
  const after = text.slice(resumeIndex + RESUMED_HEADER.length).trim()

  if (before) {
    messages.push({
      id: nextId(),
      type: ChatMessageType.AgentText,
      content: before,
      timestamp: now(),
    })
  }

  messages.push({
    id: nextId(),
    type: ChatMessageType.System,
    content: 'Session resumed',
    timestamp: now(),
  })

  if (after) {
    messages.push({
      id: nextId(),
      type: ChatMessageType.AgentText,
      content: after,
      timestamp: now(),
    })
  }

  return messages
}

export function parseEventsToMessages(events: ClaudeStreamEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const event of events) {
    messages.push(...parseEventToMessages(event))
  }
  return messages
}
