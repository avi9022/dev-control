import { useState, useEffect, useCallback, useRef, type FC } from 'react'
import { Eye, EyeOff, Inbox, CheckCircle2, User, FileText } from 'lucide-react'
import { PhaseType, FIXED_PHASES } from '@/shared/constants'
import { type ClaudeStreamEvent } from '@/shared/stream-types'
import { ContextHistoryModal } from '@/ui/components/ai-automation/ContextHistoryModal'
import { PhaseStepper } from './PhaseStepper'
import { ChatMessageList } from './ChatMessageList'
import { parseEventsToMessages, parseEventToMessages } from './chat-parser'

interface PhasePlaceholderProps {
  icon: React.ReactNode
  title: string
  description: string
}

const PhasePlaceholder: FC<PhasePlaceholderProps> = ({ icon, title, description }) => (
  <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
    {icon}
    <span className="text-sm font-medium" style={{ color: 'var(--ai-text-primary)' }}>{title}</span>
    <span className="text-xs text-center" style={{ color: 'var(--ai-text-tertiary)', maxWidth: 320 }}>{description}</span>
  </div>
)

interface AgentChatProps {
  task: AITask
  pipeline: AIPipelinePhase[]
}

async function loadEventsForEntries(entries: AIPhaseHistoryEntry[]): Promise<ClaudeStreamEvent[]> {
  const allEvents: ClaudeStreamEvent[] = []
  for (const entry of entries) {
    if (!entry.contextHistoryPath) continue
    try {
      const history = await window.electron.aiReadContextHistory(entry.contextHistoryPath)
      let eventsJson = history.events
      if (!eventsJson.trimEnd().endsWith(']')) {
        eventsJson = eventsJson.trimEnd() + '\n]'
      }
      const events: ClaudeStreamEvent[] = JSON.parse(eventsJson)
      allEvents.push(...events)
    } catch { }
  }
  return allEvents
}

function getSessionEntries(phaseHistory: AIPhaseHistoryEntry[], upToIndex: number): AIPhaseHistoryEntry[] {
  const entry = phaseHistory[upToIndex]
  if (!entry) return []

  if (entry.sessionId) {
    const entries: AIPhaseHistoryEntry[] = []
    for (let i = 0; i <= upToIndex; i++) {
      if (phaseHistory[i].sessionId === entry.sessionId) {
        entries.push(phaseHistory[i])
      }
    }
    return entries
  }

  return [entry]
}

export const AgentChat: FC<AgentChatProps> = ({ task, pipeline }) => {
  const [selectedPhaseIndex, setSelectedPhaseIndex] = useState<number>(task.phaseHistory.length - 1)
  const [showToolCalls, setShowToolCalls] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [contextHistoryOpen, setContextHistoryOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const lastEntry = task.phaseHistory[task.phaseHistory.length - 1]
  const isViewingCurrentPhase = selectedPhaseIndex === task.phaseHistory.length - 1
    && task.phaseHistory.length > 0
    && !lastEntry?.exitedAt
  const isAgentRunning = task.activeProcessPid !== undefined
  const isLatestPhase = selectedPhaseIndex === task.phaseHistory.length - 1 && task.phaseHistory.length > 0
  const canSendMessage = isLatestPhase && !!task.sessionId

  useEffect(() => {
    setSelectedPhaseIndex(task.phaseHistory.length - 1)
  }, [task.phaseHistory.length])

  const phaseHistoryRef = useRef(task.phaseHistory)
  phaseHistoryRef.current = task.phaseHistory

  const selectedEntryPath = task.phaseHistory[selectedPhaseIndex]?.contextHistoryPath
  const loadTrigger = `${selectedPhaseIndex}-${task.phaseHistory.length}-${selectedEntryPath || 'none'}`

  useEffect(() => {
    const entries = getSessionEntries(phaseHistoryRef.current, selectedPhaseIndex)

    setLoading(true)
    loadEventsForEntries(entries).then(events => {
      setMessages(parseEventsToMessages(events))
      setLoading(false)
    })
  }, [loadTrigger, selectedPhaseIndex])

  useEffect(() => {
    if (!isViewingCurrentPhase) return

    const unsub = window.electron.subscribeAITaskStreamEvent((data: AITaskStreamOutput) => {
      if (data.taskId !== task.id) return
      const newMessages = parseEventToMessages(data.event)
      if (newMessages.length > 0) {
        setMessages(prev => [...prev, ...newMessages])
      }
    })

    return unsub
  }, [task.id, isViewingCurrentPhase])

  const handleSelectPhase = useCallback((index: number) => {
    setSelectedPhaseIndex(index)
  }, [])

  const handleSend = useCallback((): void => {
    if (!input.trim()) return
    window.electron.aiInterruptAgent(task.id, input)
    setInput('')
    inputRef.current?.focus()
  }, [input, task.id])

  const selectedEntry = task.phaseHistory[selectedPhaseIndex]
  const selectedPhaseId = selectedEntry?.phase
  const selectedConfig = pipeline.find(p => p.id === selectedPhaseId)
  const isFixedPhase = selectedPhaseId === FIXED_PHASES.BACKLOG || selectedPhaseId === FIXED_PHASES.DONE
  const isAgentPhase = !isFixedPhase && selectedConfig?.type === PhaseType.Agent

  function renderPhasePlaceholder(): React.ReactNode {
    if (selectedPhaseId === FIXED_PHASES.BACKLOG) {
      return (
        <PhasePlaceholder
          icon={<Inbox className="h-10 w-10" style={{ color: 'var(--ai-text-tertiary)' }} />}
          title="Backlog"
          description="This task is in the backlog. Start it to begin the pipeline."
        />
      )
    }
    if (selectedPhaseId === FIXED_PHASES.DONE) {
      return (
        <PhasePlaceholder
          icon={<CheckCircle2 className="h-10 w-10" style={{ color: 'var(--ai-success)' }} />}
          title="Done"
          description="This task has completed all pipeline phases."
        />
      )
    }
    const phaseName = selectedConfig?.name || selectedPhaseId || 'Unknown'
    return (
      <PhasePlaceholder
        icon={<User className="h-10 w-10" style={{ color: 'var(--ai-text-tertiary)' }} />}
        title={phaseName}
        description="This is a manual phase. Review the task and move it to the next phase when ready."
      />
    )
  }

  const isActivePhase = isViewingCurrentPhase && isAgentRunning
  const statusLabel = isActivePhase ? 'Live' : isViewingCurrentPhase ? 'Current' : 'History'

  return (
    <div className="h-full flex flex-col rounded" style={{ border: '1px solid var(--ai-border-subtle)' }}>
      {task.phaseHistory.length > 0 && (
        <PhaseStepper
          phaseHistory={task.phaseHistory}
          pipeline={pipeline}
          activePhaseIndex={selectedPhaseIndex}
          isAgentRunning={isAgentRunning}
          onSelectPhase={handleSelectPhase}
        />
      )}

      {isAgentPhase ? (
        <>
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}
          >
            <span className="text-xs" style={{ color: 'var(--ai-text-tertiary)' }}>
              {statusLabel}
              {loading && ' — Loading...'}
            </span>
            <div className="flex items-center gap-1">
              {selectedEntry?.contextHistoryPath && (
                <button
                  onClick={() => setContextHistoryOpen(true)}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--ai-accent)', background: 'var(--ai-accent-subtle)' }}
                >
                  <FileText className="h-3 w-3" />
                  Context
                </button>
              )}
              <button
                onClick={() => setShowToolCalls(prev => !prev)}
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-colors"
                style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-1)' }}
              >
                {showToolCalls ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showToolCalls ? 'Hide tools' : 'Show tools'}
              </button>
            </div>
          </div>

          <ChatMessageList
            messages={messages}
            showToolCalls={showToolCalls}
            autoScroll={isViewingCurrentPhase}
          />

          {canSendMessage && (
            <div className="p-2 flex gap-2" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                placeholder="Type a message to the agent..."
                className="flex-1 text-sm px-3 py-1.5 rounded focus:outline-none"
                style={{
                  background: 'var(--ai-surface-2)',
                  color: 'var(--ai-text-primary)',
                  border: '1px solid var(--ai-border-subtle)',
                }}
              />
              <button
                onClick={handleSend}
                className="px-3 py-1.5 text-sm rounded transition-colors"
                style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-primary)' }}
              >
                Send
              </button>
            </div>
          )}
        </>
      ) : (
        renderPhasePlaceholder()
      )}

      {selectedEntry?.contextHistoryPath && (
        <ContextHistoryModal
          contextHistoryPath={selectedEntry.contextHistoryPath}
          phaseName={selectedConfig?.name || selectedPhaseId || 'Unknown'}
          open={contextHistoryOpen}
          onOpenChange={setContextHistoryOpen}
        />
      )}
    </div>
  )
}
