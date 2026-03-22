import { useState, useEffect, type FC } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FileText, MessageSquare, Code, ChevronDown, ChevronRight, Wrench, Bot, User } from 'lucide-react'
import { MarkdownViewer } from './MarkdownViewer'
import { useSearchOverlay } from './useSearchOverlay'
import { SearchBar, SearchOverlayLayer } from './SearchOverlay'

interface ContextHistoryModalProps {
  contextHistoryPath: string
  phaseName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  themeClass: string
}

interface ConversationEvent {
  type: string
  message?: {
    role?: string
    content?: Array<{
      type: string
      text?: string
      name?: string
      input?: Record<string, unknown>
      content?: string
    }>
    usage?: Record<string, number>
    model?: string
  }
  result?: string
  cost_usd?: number
  duration_ms?: number
  error?: { message?: string }
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n... (${text.length - max} more characters)`
}

const ToolCallBlock: FC<{ name: string; input?: Record<string, unknown> }> = ({ name, input }) => {
  const [expanded, setExpanded] = useState(false)
  const inputStr = input ? JSON.stringify(input, null, 2) : ''

  return (
    <div
      className="rounded border my-1"
      style={{ borderColor: 'var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 30%, transparent)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs"
        style={{ color: 'var(--ai-text-secondary)' }}
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Wrench className="h-3 w-3 shrink-0" style={{ color: 'var(--ai-accent)' }} />
        <span className="font-mono font-medium">{name}</span>
      </button>
      {expanded && inputStr && (
        <pre
          className="px-3 py-2 text-[11px] font-mono overflow-x-auto border-t"
          style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
        >
          {truncateText(inputStr, 2000)}
        </pre>
      )}
    </div>
  )
}

const ToolResultBlock: FC<{ content: string }> = ({ content }) => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded border my-1"
      style={{ borderColor: 'var(--ai-border-subtle)', backgroundColor: 'color-mix(in srgb, var(--ai-surface-2) 30%, transparent)' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-xs"
        style={{ color: 'var(--ai-text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className="font-mono">Tool result</span>
        <span className="text-[10px]">({content.length} chars)</span>
      </button>
      {expanded && (
        <pre
          className="px-3 py-2 text-[11px] font-mono overflow-x-auto border-t max-h-[300px] overflow-y-auto"
          style={{ color: 'var(--ai-text-tertiary)', borderColor: 'var(--ai-border-subtle)' }}
        >
          {truncateText(content, 5000)}
        </pre>
      )}
    </div>
  )
}


const ChatView: FC<{ events: ConversationEvent[]; searchQuery?: string }> = ({ events, searchQuery = '' }) => {
  // Filter events by search query
  const filteredEvents = searchQuery
    ? events.filter(event => {
        const str = JSON.stringify(event).toLowerCase()
        return str.includes(searchQuery.toLowerCase())
      })
    : events

  if (filteredEvents.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
        {searchQuery ? 'No matching events' : 'No conversation events recorded'}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {filteredEvents.map((event, i) => {
        if (event.type === 'assistant' && event.message?.content) {
          return (
            <div key={i} className="flex gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--ai-accent-subtle)' }}
              >
                <Bot className="h-3.5 w-3.5" style={{ color: 'var(--ai-accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                {event.message.content.map((block, bi) => {
                  if (block.type === 'text' && block.text) {
                    return (
                      <p key={bi} className="text-sm whitespace-pre-wrap" style={{ color: 'var(--ai-text-primary)' }}>
                        {block.text}
                      </p>
                    )
                  }
                  if (block.type === 'tool_use' && block.name) {
                    return <ToolCallBlock key={bi} name={block.name} input={block.input} />
                  }
                  return null
                })}
              </div>
            </div>
          )
        }

        if (event.type === 'user' && event.message?.content) {
          return (
            <div key={i} className="flex gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: 'var(--ai-surface-3)' }}
              >
                <User className="h-3.5 w-3.5" style={{ color: 'var(--ai-text-tertiary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                {event.message.content.map((block, bi) => {
                  if (block.type === 'tool_result' && block.content) {
                    return <ToolResultBlock key={bi} content={typeof block.content === 'string' ? block.content : JSON.stringify(block.content)} />
                  }
                  return null
                })}
              </div>
            </div>
          )
        }

        if (event.type === 'result') {
          return (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs"
              style={{ backgroundColor: 'var(--ai-surface-2)', color: 'var(--ai-text-tertiary)' }}
            >
              <span>Agent finished</span>
              {event.cost_usd !== undefined && <span>Cost: ${event.cost_usd.toFixed(4)}</span>}
              {event.duration_ms !== undefined && <span>Duration: {(event.duration_ms / 1000).toFixed(1)}s</span>}
            </div>
          )
        }

        if (event.type === 'error') {
          return (
            <div
              key={i}
              className="px-3 py-2 rounded text-xs"
              style={{ backgroundColor: 'color-mix(in srgb, var(--ai-pink) 10%, transparent)', color: 'var(--ai-pink)' }}
            >
              Error: {event.error?.message || JSON.stringify(event)}
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

export const ContextHistoryModal: FC<ContextHistoryModalProps> = ({
  contextHistoryPath, phaseName, open, onOpenChange, themeClass
}) => {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<ConversationEvent[]>([])
  const [rawJson, setRawJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  const [activeTab, setActiveTab] = useState('prompt')

  const search = useSearchOverlay([activeTab, showRaw, prompt, events])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    window.electron.aiReadContextHistory(contextHistoryPath).then(({ prompt: p, events: e }) => {
      setPrompt(p)
      setRawJson(e)
      try {
        setEvents(JSON.parse(e))
      } catch {
        setEvents([])
      }
      setLoading(false)
    })
  }, [open, contextHistoryPath])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${themeClass} !max-w-[95vw] h-[85vh] flex flex-col !p-0`}
        style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}
      >
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: 'var(--ai-accent)' }} />
            Context History — {phaseName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
            Loading...
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 px-6 pb-5">
            {/* Toolbar row: tabs + search + toggle */}
            <div className="shrink-0 flex items-center gap-2 mb-3">
              <TabsList>
                <TabsTrigger value="prompt" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Prompt
                </TabsTrigger>
                <TabsTrigger value="conversation" className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversation ({events.length})
                </TabsTrigger>
              </TabsList>

              <div className="flex-1" />

              <SearchBar {...search} />

              {/* Chat/Raw toggle — only on conversation tab */}
              {activeTab === 'conversation' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowRaw(!showRaw)}
                >
                  <Code className="h-3 w-3 mr-1" />
                  {showRaw ? 'Chat View' : 'Raw JSON'}
                </Button>
              )}
            </div>

            <TabsContent value="prompt" className="flex-1 min-h-0 overflow-y-auto relative" ref={activeTab === 'prompt' ? search.setContentRef : undefined}>
              <SearchOverlayLayer overlayRef={search.overlayRef} active={activeTab === 'prompt' && !!search.searchQuery} />
              {prompt ? (
                <MarkdownViewer content={prompt} />
              ) : (
                <div className="py-8 text-center text-sm" style={{ color: 'var(--ai-text-tertiary)' }}>
                  No prompt data available
                </div>
              )}
            </TabsContent>

            <TabsContent value="conversation" className="flex-1 min-h-0 overflow-y-auto relative" ref={activeTab === 'conversation' ? search.setContentRef : undefined}>
              <SearchOverlayLayer overlayRef={search.overlayRef} active={activeTab === 'conversation' && !!search.searchQuery} />
              {showRaw ? (
                <pre
                  className="text-[11px] font-mono whitespace-pre-wrap p-4 rounded-lg overflow-x-auto"
                  style={{ backgroundColor: 'var(--ai-surface-2)', color: 'var(--ai-text-secondary)' }}
                >
                  {rawJson}
                </pre>
              ) : (
                <ChatView events={events} searchQuery={search.searchQuery} />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}
