import { useState, useRef, useEffect, useCallback, type FC } from 'react'
import { Send, Loader2, Wand2, Bug, ChevronRight, ChevronDown, ChevronsUpDown, Paperclip, X } from 'lucide-react'
import Markdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ProjectCreationModal } from '@/ui/components/ai-automation/ProjectCreationModal'
import { TaskCreationStepper } from '@/ui/components/ai-automation/TaskCreationStepper'
import { MentionEditor, type MentionEditorHandle } from '@/ui/components/ai-automation/MentionEditor'

const SUMMARY_TRUNCATE_LENGTH = 80
const DEBUG_JSON_MAX_HEIGHT = 300
const PLANNER_GREETING = "Hey! What would you like to plan today? Tell me about the goal or project you have in mind."

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AssistantContentBlock {
  type: string
  text?: string
  name?: string
}

interface AssistantMessage {
  content?: AssistantContentBlock[]
}

type PlannerDebugEvent =
  | { type: 'system'; subtype?: string }
  | { type: 'assistant'; message?: AssistantMessage }
  | { type: 'user' }
  | { type: 'result' }
  | { type: 'rate_limit_event' }
  | { type: string }

interface PlannerChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DebugEventRow({ event, defaultExpanded }: { event: PlannerDebugEvent; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    setExpanded(defaultExpanded)
  }, [defaultExpanded])

  const getLabel = (): { label: string; color: string; summary: string } => {
    switch (event.type) {
      case 'system':
        return { label: 'system', color: 'var(--ai-text-tertiary)', summary: 'subtype' in event ? String(event.subtype || '') : '' }
      case 'assistant': {
        const msg = 'message' in event ? event.message : undefined
        const content = msg?.content
        const textBlock = content?.find(b => b.type === 'text')
        const toolBlock = content?.find(b => b.type === 'tool_use')
        if (toolBlock) return { label: 'tool_call', color: 'var(--ai-warning)', summary: String(toolBlock.name || '') }
        return { label: 'response', color: 'var(--ai-accent)', summary: textBlock?.text?.slice(0, SUMMARY_TRUNCATE_LENGTH) || '' }
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
          style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)', maxHeight: DEBUG_JSON_MAX_HEIGHT, overflowY: 'auto' }}
        >
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  )
}

export const PlannerChat: FC<PlannerChatProps> = ({ open, onOpenChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [debugEvents, setDebugEvents] = useState<PlannerDebugEvent[]>([])
  const [allExpanded, setAllExpanded] = useState(false)
  const [preserveEvents, setPreserveEvents] = useState(false)
  const [projectCreationRequest, setProjectCreationRequest] = useState<ProjectCreationRequest | null>(null)
  const [taskStepperRequest, setTaskStepperRequest] = useState<TaskStepperRequest | null>(null)
  const [pendingFiles, setPendingFiles] = useState<{ name: string; path: string }[]>([])
  const [taggedProjects, setTaggedProjects] = useState<Map<string, string>>(new Map())
  const sessionIdRef = useRef<string>(Date.now().toString())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const debugEndRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<MentionEditorHandle>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    debugEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [debugEvents])

  // Save conversation on every change
  useEffect(() => {
    if (messages.length > 1) {
      window.electron.aiSavePlannerConversation(sessionIdRef.current, messages, debugEvents)
    }
  }, [messages, debugEvents])

  const handleProjectTagged = useCallback((dir: DirectorySettings) => {
    setTaggedProjects(prev => new Map(prev).set(dir.customLabel || dir.name, dir.path))
  }, [])

  const handleProjectRemoved = useCallback((label: string) => {
    setTaggedProjects(prev => {
      const next = new Map(prev)
      next.delete(label)
      return next
    })
  }, [])

  const handleSubmitMessage = useCallback(async () => {
    const text = editorRef.current?.getPlainText().trim() || ''
    if (!text && pendingFiles.length === 0) return

    let content = text

    if (taggedProjects.size > 0) {
      const projectLines = Array.from(taggedProjects.entries())
        .map(([name, projectPath]) => `- ${name}: ${projectPath}`)
        .join('\n')
      content += `\n\n[Referenced projects:\n${projectLines}]`
    }

    if (pendingFiles.length > 0) {
      const fileLines = pendingFiles.map(f => `- ${f.name}: ${f.path}`).join('\n')
      content += `\n\n[Attached files:\n${fileLines}]`
    }

    const userMessage: ChatMessage = { role: 'user', content }
    const newConversation = [...messages, userMessage]
    setMessages(newConversation)
    editorRef.current?.clear()
    setPendingFiles([])
    setTaggedProjects(new Map())
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
  }, [messages, pendingFiles, taggedProjects, preserveEvents])

  const handleAddFiles = useCallback(async () => {
    const selected = await window.electron.aiSelectFiles()
    if (selected) {
      const newFiles = selected
        .filter(p => !pendingFiles.some(f => f.path === p))
        .map(p => ({ name: p.split('/').pop() || p, path: p }))
      setPendingFiles(prev => [...prev, ...newFiles])
    }
  }, [pendingFiles])

  const submitRef = useRef(handleSubmitMessage)
  submitRef.current = handleSubmitMessage

  useEffect(() => {
    if (open) {
      if (messagesRef.current.length === 0) {
        sessionIdRef.current = Date.now().toString()
        setMessages([{ role: 'assistant', content: PLANNER_GREETING }])
      }
    }
  }, [open])

  useEffect(() => {
    const unsubDebug = window.electron.subscribeAIPlannerDebug((event) => {
      if (typeof event === 'object' && event !== null && 'type' in event) {
        setDebugEvents(prev => [...prev, event as PlannerDebugEvent])
      }
    })
    const unsubShowModal = window.electron.subscribeAIProjectCreationModal((request: ProjectCreationRequest) => {
      setProjectCreationRequest(request)
    })
    const unsubCloseModal = window.electron.subscribeAICloseProjectCreationModal(() => {
      setProjectCreationRequest(null)
    })
    const unsubShowStepper = window.electron.subscribeAITaskCreationStepper((request: TaskStepperRequest) => {
      setTaskStepperRequest(request)
    })
    const unsubCloseStepper = window.electron.subscribeAICloseTaskCreationStepper(() => {
      setTaskStepperRequest(null)
    })
    return () => { unsubDebug(); unsubShowModal(); unsubCloseModal(); unsubShowStepper(); unsubCloseStepper() }
  }, [])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (isLoading) return
    handleSubmitMessage()
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
            <span className="text-[10px] font-mono" style={{ color: 'var(--ai-text-tertiary)' }}>#{sessionIdRef.current}</span>
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
                    className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user' ? 'rounded-br-sm whitespace-pre-wrap' : 'rounded-bl-sm'
                    }`}
                    style={{
                      background: msg.role === 'user' ? 'var(--ai-accent-subtle)' : 'var(--ai-surface-2)',
                      color: 'var(--ai-text-primary)',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <Markdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0">{children}</ol>,
                          li: ({ children }) => <li className="mb-0.5">{children}</li>,
                          h1: ({ children }) => <h1 className="text-base font-bold mb-2">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-sm font-bold mb-1.5">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          code: ({ children, className }) => {
                            const isBlock = className?.includes('language-')
                            if (isBlock) {
                              return (
                                <code
                                  className="block rounded p-2 my-2 text-xs overflow-x-auto"
                                  style={{ background: 'var(--ai-surface-3)' }}
                                >
                                  {children}
                                </code>
                              )
                            }
                            return (
                              <code
                                className="rounded px-1 py-0.5 text-xs"
                                style={{ background: 'var(--ai-surface-3)' }}
                              >
                                {children}
                              </code>
                            )
                          },
                          pre: ({ children }) => <>{children}</>,
                          hr: () => <hr className="my-3 border-0 h-px" style={{ background: 'var(--ai-border-subtle)' }} />,
                          a: ({ href, children }) => (
                            <a href={href} className="underline" style={{ color: 'var(--ai-accent)' }} target="_blank" rel="noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    ) : (
                      msg.content
                    )}
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

            <div
              className="flex-shrink-0 px-5 py-3"
              style={{ borderTop: '1px solid var(--ai-border-subtle)' }}
            >
              {pendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {pendingFiles.map((f, i) => (
                    <span
                      key={f.path}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs"
                      style={{ background: 'var(--ai-surface-2)', borderColor: 'var(--ai-border-subtle)', color: 'var(--ai-text-secondary)' }}
                    >
                      <Paperclip className="h-3 w-3" style={{ color: 'var(--ai-text-tertiary)' }} />
                      {f.name}
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} style={{ color: 'var(--ai-text-tertiary)' }}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <div className="flex-1">
                  <MentionEditor
                    ref={editorRef}
                    placeholder="Describe what you want to plan... Use @ to tag projects, # to reference tasks"
                    minHeight="72px"
                    className="!min-h-[72px] max-h-[144px]"
                    onEnterSubmit={handleSubmitMessage}
                    onProjectTagged={handleProjectTagged}
                    onProjectRemoved={handleProjectRemoved}
                  />
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2"
                    onClick={handleAddFiles}
                    disabled={isLoading}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    size="sm"
                    className="h-9 px-3"
                    style={{ background: 'var(--ai-accent)', color: 'var(--ai-surface-0)' }}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </form>
            </div>
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
      {projectCreationRequest && (
        <ProjectCreationModal
          request={projectCreationRequest}
          onComplete={() => setProjectCreationRequest(null)}
        />
      )}
      {taskStepperRequest && (
        <TaskCreationStepper
          request={taskStepperRequest}
          onComplete={() => setTaskStepperRequest(null)}
        />
      )}
    </Dialog>
  )
}
