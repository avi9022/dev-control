import { useState, useRef, useEffect, type FC } from 'react'
import { Send, Loader2, Wand2, Bug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DebugEvent {
  type: string
  [key: string]: unknown
}

interface PlannerChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PlannerChat: FC<PlannerChatProps> = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const debugEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [debugEvents])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        sendMessage('Hi, I want to plan some tasks.')
      }
    }
  }, [open])

  useEffect(() => {
    const unsubChunk = window.electron.subscribeAIPlannerChunk(() => {
      // Chunks are handled via debug events now for text extraction
    })
    const unsubDebug = window.electron.subscribeAIPlannerDebug((event: unknown) => {
      setDebugEvents(prev => [...prev, event as DebugEvent])
    })
    return () => { unsubChunk(); unsubDebug() }
  }, [])

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content }
    const newConversation = [...messages, userMessage]
    setMessages(newConversation)
    setInput('')
    setIsLoading(true)
    setStreamingContent('')
    setDebugEvents([])

    try {
      const response = await window.electron.aiSendPlannerMessage(
        newConversation,
        '/'
      )
      setMessages([...newConversation, { role: 'assistant', content: response }])
    } catch (err) {
      setMessages([...newConversation, { role: 'assistant', content: `Error: ${err}` }])
    } finally {
      setIsLoading(false)
      setStreamingContent('')
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
  }

  const getEventLabel = (event: DebugEvent): { label: string; color: string; detail?: string } => {
    switch (event.type) {
      case 'assistant':
        return { label: 'Response', color: 'var(--ai-accent)', detail: 'Assistant message received' }
      case 'content_block_start':
        return { label: 'Block', color: 'var(--ai-text-tertiary)', detail: (event.content_block as { type?: string })?.type || '' }
      case 'content_block_delta':
        return { label: 'Delta', color: 'var(--ai-text-tertiary)' }
      case 'tool_use': {
        const name = (event as { name?: string }).name || 'unknown'
        return { label: 'Tool Call', color: 'var(--ai-warning)', detail: name }
      }
      case 'tool_result':
        return { label: 'Tool Result', color: 'var(--ai-success)' }
      default:
        return { label: event.type, color: 'var(--ai-text-tertiary)' }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[900px] h-[80vh] flex flex-col p-0"
        style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border)' }}
      >
        <DialogHeader className="px-5 pt-4 pb-3 flex-shrink-0 flex flex-row items-center justify-between" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--ai-text-primary)' }}>
            <Wand2 className="h-4 w-4" style={{ color: 'var(--ai-accent)' }} />
            Task Planner
          </DialogTitle>
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono transition-colors"
            style={{
              background: showDebug ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
              color: showDebug ? 'var(--ai-accent)' : 'var(--ai-text-tertiary)',
            }}
          >
            <Bug className="h-3 w-3" />
            Debug
          </button>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex">
          {/* Chat panel */}
          <div className={`flex-1 flex flex-col min-w-0 ${showDebug ? 'border-r' : ''}`} style={{ borderColor: 'var(--ai-border-subtle)' }}>
            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              {messages.filter(m => !(m.role === 'user' && m.content === 'Hi, I want to plan some tasks.')).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' ? 'rounded-br-sm' : 'rounded-bl-sm'
                    }`}
                    style={{
                      background: msg.role === 'user' ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
                      color: 'var(--ai-text-primary)',
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div
                    className="rounded-lg rounded-bl-sm px-4 py-2.5 flex items-center gap-2"
                    style={{ background: 'var(--ai-surface-2)', color: 'var(--ai-text-tertiary)' }}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="flex-shrink-0 px-5 py-3 flex gap-2"
              style={{ borderTop: '1px solid var(--ai-border-subtle)' }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe what you want to plan..."
                disabled={isLoading}
                className="flex-1 bg-transparent border rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: 'var(--ai-border)',
                  color: 'var(--ai-text-primary)',
                }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="sm"
                className="h-9 px-3"
                style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>

          {/* Debug panel */}
          {showDebug && (
            <div className="w-[350px] flex-shrink-0 flex flex-col min-h-0">
              <div className="px-3 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
                <span className="text-[11px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                  Agent Events ({debugEvents.length})
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
                {debugEvents.map((event, i) => {
                  const { label, color, detail } = getEventLabel(event)
                  return (
                    <div
                      key={i}
                      className="text-[10px] font-mono px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--ai-surface-2)]"
                      onClick={() => {
                        console.log('Debug event:', event)
                      }}
                    >
                      <span style={{ color }}>[{label}]</span>
                      {detail && <span style={{ color: 'var(--ai-text-secondary)' }}> {detail}</span>}
                      {event.type === 'tool_use' && (event as Record<string, unknown>).input && (
                        <div className="mt-1 pl-2 text-[9px] truncate" style={{ color: 'var(--ai-text-tertiary)' }}>
                          {JSON.stringify((event as Record<string, unknown>).input).slice(0, 100)}
                        </div>
                      )}
                      {event.type === 'tool_result' && (
                        <div className="mt-1 pl-2 text-[9px] truncate" style={{ color: 'var(--ai-text-tertiary)' }}>
                          {JSON.stringify((event as Record<string, unknown>).content || (event as Record<string, unknown>).output).slice(0, 100)}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={debugEndRef} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
