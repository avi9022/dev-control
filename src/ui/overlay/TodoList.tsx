import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { PrioritySelector } from './PrioritySelector'

interface TodoListProps {
  todos: Todo[]
  onToggle?: (id: string) => void
  onDelete?: (id: string) => void
  onPriorityChange?: (id: string, priority: TodoPriority) => void
  onTextChange?: (id: string, text: string) => void
}

const priorityOrder: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3
}

const priorityColors: Record<TodoPriority, string> = {
  high: 'bg-status-red',
  medium: 'bg-status-yellow',
  low: 'bg-blue-500',
  none: 'bg-muted'
}

export const TodoList = ({ todos, onToggle, onDelete, onPriorityChange, onTextChange }: TodoListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  // Sort: incomplete first, then by priority (high to none), then by creation time
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1
    }
    // Sort by priority for incomplete todos
    if (!a.completed && !b.completed) {
      const priorityA = priorityOrder[a.priority || 'none']
      const priorityB = priorityOrder[b.priority || 'none']
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })

  return (
    <ul className="space-y-1">
      {sortedTodos.map(todo => (
        <li
          key={todo.id}
          className="group flex items-center gap-2 py-2 px-2 rounded-md hover:bg-white/5 transition-colors"
        >
          {/* Priority selector */}
          {onPriorityChange ? (
            <PrioritySelector
              currentPriority={todo.priority || 'none'}
              onSelect={(priority) => onPriorityChange(todo.id, priority)}
              disabled={false}
            />
          ) : (
            <div
              className={`
                flex-shrink-0 w-2.5 h-2.5 rounded-full
                ${priorityColors[todo.priority || 'none']}
              `}
              title={`Priority: ${todo.priority || 'none'}`}
            />
          )}
          <button
            onClick={() => onToggle?.(todo.id)}
            className={`
              flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
              ${todo.completed
                ? 'bg-status-green border-status-green text-white'
                : 'border-neutral-500 hover:border-neutral-400'
              }
              ${!onToggle ? 'cursor-default' : 'cursor-pointer'}
            `}
            disabled={!onToggle}
          >
            {todo.completed && <Check size={12} strokeWidth={3} />}
          </button>
          {editingId === todo.id ? (
            <input
              type="text"
              defaultValue={todo.text}
              className="flex-1 text-sm bg-transparent border-b border-neutral-500 outline-none text-neutral-200"
              autoFocus
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== todo.text) {
                  onTextChange?.(todo.id, e.target.value.trim())
                }
                setEditingId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setEditingId(null)
                }
              }}
            />
          ) : (
            <span
              className={`flex-1 text-sm transition-all ${
                todo.completed
                  ? 'text-muted-foreground line-through'
                  : 'text-neutral-200'
              } ${onTextChange ? 'cursor-text' : ''}`}
              onDoubleClick={() => onTextChange && setEditingId(todo.id)}
            >
              {todo.text}
            </span>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(todo.id)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-status-red-bg text-muted-foreground hover:text-status-red transition-all"
            >
              <Trash2 size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
