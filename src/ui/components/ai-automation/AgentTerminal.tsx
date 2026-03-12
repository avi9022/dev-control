import { useEffect, useRef, useState, type FC } from 'react'
import { AlertCircle } from 'lucide-react'

interface AgentTerminalProps {
  taskId: string
  needsUserInput: boolean
}

export const AgentTerminal: FC<AgentTerminalProps> = ({ taskId, needsUserInput }) => {
  const [lines, setLines] = useState<string[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load persisted output history on mount
  useEffect(() => {
    window.electron.aiGetTaskOutputHistory(taskId).then(history => {
      if (history.length > 0) {
        const allLines = history.flatMap(chunk => chunk.split('\n'))
        setLines(allLines)
      }
    })
  }, [taskId])

  useEffect(() => {
    const unsubscribe = window.electron.subscribeAITaskOutput((data) => {
      if (data.taskId === taskId) {
        setLines(prev => [...prev, ...data.output.split('\n')])
      }
    })
    return unsubscribe
  }, [taskId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  const handleSend = () => {
    if (!input.trim()) return
    window.electron.aiSendTaskInput(taskId, input + '\n')
    setLines(prev => [...prev, `> ${input}`])
    setInput('')
  }

  return (
    <div className="h-full flex flex-col rounded" style={{ border: '1px solid var(--ai-border-subtle)' }}>
      {needsUserInput && (
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'var(--ai-warning-subtle)', borderBottom: '1px solid var(--ai-warning)' }}>
          <AlertCircle className="h-4 w-4" style={{ color: 'var(--ai-warning)' }} />
          <span className="text-sm" style={{ color: 'var(--ai-warning)' }}>Agent is waiting for your input</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 text-xs"
        style={{ fontFamily: 'var(--ai-mono)', background: 'var(--ai-surface-0)' }}
      >
        {lines.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap" style={{ color: line.startsWith('>') ? 'var(--ai-success)' : 'var(--ai-text-secondary)' }}>
            {line}
          </div>
        ))}
        {lines.length === 0 && (
          <div style={{ color: 'var(--ai-text-tertiary)' }}>Waiting for agent output...</div>
        )}
      </div>
      <div className="p-2 flex gap-2" style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder="Type a message to the agent..."
          className="flex-1 text-sm px-3 py-1.5 rounded focus:outline-none"
          style={{ background: 'var(--ai-surface-2)', color: 'var(--ai-text-primary)', border: '1px solid var(--ai-border-subtle)' }}
        />
        <button
          onClick={handleSend}
          className="px-3 py-1.5 text-sm rounded transition-colors"
          style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-primary)' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
