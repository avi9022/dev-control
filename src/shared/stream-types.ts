interface StreamContentTextBlock {
  type: 'text'
  text: string
}

interface StreamContentToolUseBlock {
  type: 'tool_use'
  name: string
  input?: StreamToolInput
}

interface StreamToolInput extends Record<string, string | number | boolean | undefined> {
  file_path?: string
  command?: string
  pattern?: string
  path?: string
  content?: string
  regex?: string
  new_string?: string
  old_string?: string
}

type StreamContentBlock = StreamContentTextBlock | StreamContentToolUseBlock

interface StreamMessage {
  model?: string
  content?: StreamContentBlock[]
  usage?: StreamUsage
}

interface StreamUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface StreamAssistantEvent {
  type: 'assistant'
  message: StreamMessage
}

interface StreamToolEvent {
  type: 'tool'
  tool_use_id?: string
  name?: string
  input?: StreamToolInput
  content?: StreamContentBlock[]
  status?: string
}

interface StreamContentBlockStartEvent {
  type: 'content_block_start'
  content_block?: StreamContentBlock
}

interface StreamContentBlockDeltaEvent {
  type: 'content_block_delta'
  delta?: StreamDelta
}

interface StreamDelta {
  type: string
  text?: string
}

interface StreamContentBlockStopEvent {
  type: 'content_block_stop'
}

interface StreamMessageStopEvent {
  type: 'message_stop'
}

interface StreamMessageStartEvent {
  type: 'message_start'
}

interface StreamMessageDeltaEvent {
  type: 'message_delta'
}

interface StreamResultEvent {
  type: 'result'
  result?: string
  cost_usd?: number
  duration_ms?: number
}

interface StreamSystemEvent {
  type: 'system'
  subtype?: string
  message?: string
}

interface StreamErrorEvent {
  type: 'error'
  error?: { message?: string }
}

interface StreamUserEvent {
  type: 'user'
  message?: StreamMessage
  isHumanMessage?: boolean
  session_id?: string
  uuid?: string
  timestamp?: string
}

export type ClaudeStreamEvent =
  | StreamAssistantEvent
  | StreamToolEvent
  | StreamContentBlockStartEvent
  | StreamContentBlockDeltaEvent
  | StreamContentBlockStopEvent
  | StreamMessageStopEvent
  | StreamMessageStartEvent
  | StreamMessageDeltaEvent
  | StreamResultEvent
  | StreamSystemEvent
  | StreamErrorEvent
  | StreamUserEvent

export function isAssistantEvent(event: ClaudeStreamEvent): event is StreamAssistantEvent {
  return event.type === 'assistant'
}

export function isResultEvent(event: ClaudeStreamEvent): event is StreamResultEvent {
  return event.type === 'result'
}

export function isSystemEvent(event: ClaudeStreamEvent): event is StreamSystemEvent {
  return event.type === 'system'
}

export function isErrorEvent(event: ClaudeStreamEvent): event is StreamErrorEvent {
  return event.type === 'error'
}

export function isUserEvent(event: ClaudeStreamEvent): event is StreamUserEvent {
  return event.type === 'user'
}

export function isContentBlockStartEvent(event: ClaudeStreamEvent): event is StreamContentBlockStartEvent {
  return event.type === 'content_block_start'
}

export function isContentBlockDeltaEvent(event: ClaudeStreamEvent): event is StreamContentBlockDeltaEvent {
  return event.type === 'content_block_delta'
}

export function isToolUseBlock(block: StreamContentBlock): block is StreamContentToolUseBlock {
  return block.type === 'tool_use'
}

export function isTextBlock(block: StreamContentBlock): block is StreamContentTextBlock {
  return block.type === 'text'
}

const SAVEABLE_EVENT_TYPES = new Set(['assistant', 'user', 'result', 'error'])

export function isSaveableEvent(event: ClaudeStreamEvent): boolean {
  return SAVEABLE_EVENT_TYPES.has(event.type)
}

export type {
  StreamAssistantEvent,
  StreamResultEvent,
  StreamSystemEvent,
  StreamErrorEvent,
  StreamContentBlock,
  StreamContentToolUseBlock,
  StreamContentTextBlock,
  StreamToolInput,
  StreamMessage,
  StreamUsage,
  StreamDelta,
  StreamUserEvent,
  StreamToolEvent,
}
