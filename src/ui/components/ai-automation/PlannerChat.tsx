import { useState, useRef, useEffect, type FC } from 'react'
import { Send, Loader2, Wand2, Bug, ChevronRight, ChevronDown, ChevronsUpDown } from 'lucide-react'
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

function DebugEventRow({ event, defaultExpanded }: { event: DebugEvent; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    setExpanded(defaultExpanded)
  }, [defaultExpanded])

  const getLabel = (): { label: string; color: string; summary: string } => {
    const e = event as Record<string, unknown>
    switch (event.type) {
      case 'system':
        return { label: 'system', color: 'var(--ai-text-tertiary)', summary: String(e.subtype || '') }
      case 'assistant': {
        const content = (e.message as Record<string, unknown>)?.content as { type: string; text?: string; name?: string }[] | undefined
        const textBlock = content?.find(b => b.type === 'text')
        const toolBlock = content?.find(b => b.type === 'tool_use')
        if (toolBlock) return { label: 'tool_call', color: 'var(--ai-warning)', summary: String(toolBlock.name || '') }
        return { label: 'response', color: 'var(--ai-accent)', summary: textBlock?.text?.slice(0, 80) || '' }
      }
      case 'user':
        return { label: 'user', color: 'var(--ai-purple)', summary: '' }
      case 'result':
        return { label: 'result', color: 'var(--ai-success)', summary: '' }
      case 'rate_limit_event':
        return { label: 'rate_limit', color: 'var(--ai-pink)', summary: '' }
      default:
        return { label: event.type, color: 'var(--ai-text-tertiary)', summary: '' }
    }
  }

  const { label, color, summary } = getLabel()

  return (
    <div className="text-[10px] font-mono" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
      <div
        className="flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-[var(--ai-surface-2)]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
          : <ChevronRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
        }
        <span style={{ color }}>[{label}]</span>
        {summary && (
          <span className="truncate" style={{ color: 'var(--ai-text-secondary)' }}>{summary}</span>
        )}
      </div>
      {expanded && (
        <pre
          className="px-3 py-2 text-[9px] overflow-x-auto whitespace-pre-wrap break-all"
          style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)', maxHeight: 300, overflowY: 'auto' }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  )
}

export const PlannerChat: FC<PlannerChatProps> = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>([])
  const [allExpanded, setAllExpanded] = useState(false)
  const [preserveEvents, setPreserveEvents] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const debugEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [debugEvents])

  // Save conversation when closing
  useEffect(() => {
    if (!open && messages.length > 1) {
      window.electron.aiSavePlannerConversation(messages, debugEvents)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (messages.length === 0) {
        sendMessage('Hi, I want to plan some tasks.')
      }
    }
  }, [open])

  useEffect(() => {
    const unsubDebug = window.electron.subscribeAIPlannerDebug((event: unknown) => {
      setDebugEvents(prev => [...prev, event as DebugEvent])
    })
    return () => { unsubDebug() }
  }, [])

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content }
    const newConversation = [...messages, userMessage]
    setMessages(newConversation)
    setInput('')
    setIsLoading(true)
    if (!preserveEvents) setDebugEvents([])

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
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage(input.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[1000px] h-[80vh] flex flex-col p-0"
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
                style={{ borderColor: 'var(--ai-border)', color: 'var(--ai-text-primary)' }}
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
            <div className="w-[400px] flex-shrink-0 flex flex-col min-h-0">
              <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
                <span className="text-[11px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>
                  Events ({debugEvents.length})
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preserveEvents}
                      onChange={e => setPreserveEvents(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <span className="text-[10px]" style={{ color: 'var(--ai-text-tertiary)' }}>Preserve</span>
                  </label>
                  <button
                    onClick={() => setAllExpanded(!allExpanded)}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] transition-colors hover:bg-[var(--ai-surface-2)]"
                    style={{ color: 'var(--ai-text-tertiary)' }}
                  >
                    <ChevronsUpDown className="h-2.5 w-2.5" />
                    {allExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {debugEvents.map((event, i) => (
                  <DebugEventRow key={i} event={event} defaultExpanded={allExpanded} />
                ))}
                <div ref={debugEndRef} />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
