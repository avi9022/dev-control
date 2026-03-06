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
    <div className="h-full flex flex-col rounded border border-neutral-800">
      {needsUserInput && (
        <div className="px-3 py-2 bg-amber-900/30 border-b border-amber-700/50 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <span className="text-sm text-amber-300">Agent is waiting for your input</span>
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-black"
      >
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap ${line.startsWith('>') ? 'text-green-400' : 'text-neutral-300'}`}>
            {line}
          </div>
        ))}
        {lines.length === 0 && (
          <div className="text-neutral-600">Waiting for agent output...</div>
        )}
      </div>
      <div className="border-t border-neutral-700 p-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          placeholder="Type a message to the agent..."
          className="flex-1 bg-neutral-800 text-white text-sm px-3 py-1.5 rounded border border-neutral-700 focus:outline-none focus:border-neutral-500"
        />
        <button
          onClick={handleSend}
          className="px-3 py-1.5 bg-neutral-700 text-white text-sm rounded hover:bg-neutral-600 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}
