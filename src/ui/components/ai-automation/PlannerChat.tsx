import { useState, useRef, useEffect, type FC } from 'react'
import { Send, Loader2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      // Send initial greeting on first open
      if (messages.length === 0) {
        sendMessage('Hi, I want to plan some tasks.')
      }
    }
  }, [open])

  // Subscribe to streaming chunks
  useEffect(() => {
    const unsubscribe = window.electron.subscribeAIPlannerChunk((chunk: string) => {
      setStreamingContent(prev => prev + chunk)
    })
    return () => unsubscribe()
  }, [])

  const sendMessage = async (content: string) => {
    const userMessage: ChatMessage = { role: 'user', content }
    const newConversation = [...messages, userMessage]
    setMessages(newConversation)
    setInput('')
    setIsLoading(true)
    setStreamingContent('')

    try {
      const response = await window.electron.aiSendPlannerMessage(
        newConversation,
        process.cwd?.() || '/'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[700px] h-[80vh] flex flex-col p-0"
        style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border)' }}
      >
        <DialogHeader className="px-5 pt-4 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
          <DialogTitle className="flex items-center gap-2" style={{ color: 'var(--ai-text-primary)' }}>
            <Wand2 className="h-4 w-4" style={{ color: 'var(--ai-accent)' }} />
            Task Planner
          </DialogTitle>
        </DialogHeader>

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

          {/* Streaming response */}
          {isLoading && streamingContent && (
            <div className="flex justify-start">
              <div
                className="max-w-[85%] rounded-lg rounded-bl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)' }}
              >
                {streamingContent}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && !streamingContent && (
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
      </DialogContent>
    </Dialog>
  )
}
