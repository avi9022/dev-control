import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { PrioritySelector } from './PrioritySelector'

interface TodoInputProps {
  onAdd: (text: string, priority: TodoPriority) => void
  autoFocus?: boolean
}

export const TodoInput = ({ onAdd, autoFocus }: TodoInputProps) => {
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<TodoPriority>('none')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Re-focus when window becomes visible
  useEffect(() => {
    const handleFocus = () => {
      if (inputRef.current) {
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (trimmed) {
      onAdd(trimmed, priority)
      setText('')
      setPriority('none')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <PrioritySelector
        currentPriority={priority}
        onSelect={setPriority}
        disabled={false}
      />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Add a todo..."
        className="flex-1 bg-neutral-800/50 border border-neutral-700/50 rounded-md px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="p-2 rounded-md bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white transition-colors"
      >
        <Plus size={16} />
      </button>
    </form>
  )
}
