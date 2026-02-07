import { useState, useRef, useEffect, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorksheetTabsProps {
  worksheets: SQLWorksheet[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onClose: (id: string) => void
  onRename: (id: string, name: string) => void
  isDirty?: (id: string) => boolean
  isExecuting?: (id: string) => boolean
}

export const WorksheetTabs: FC<WorksheetTabsProps> = ({
  worksheets,
  activeId,
  onSelect,
  onAdd,
  onClose,
  onRename,
  isDirty,
  isExecuting,
}) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingTabId])

  const handleDoubleClick = (ws: SQLWorksheet) => {
    setEditingTabId(ws.id)
    setEditName(ws.name)
  }

  const commitRename = (id: string, originalName: string) => {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== originalName) {
      onRename(id, trimmed)
    }
    setEditingTabId(null)
  }

  const cancelRename = () => {
    setEditingTabId(null)
  }

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-[#1e1f23] overflow-x-auto">
      {worksheets.map((ws) => {
        const isActive = ws.id === activeId
        const dirty = isDirty?.(ws.id) ?? false
        const wsExecuting = isExecuting?.(ws.id) ?? false
        const isEditing = editingTabId === ws.id

        return (
          <div
            key={ws.id}
            className={cn(
              'group flex items-center gap-1.5 px-3 py-1 text-xs cursor-pointer transition-all duration-150',
              isActive
                ? 'bg-[#1a1b1e] text-foreground border-t-2 border-t-[#c74634] rounded-t-md'
                : 'text-muted-foreground hover:bg-[#252629] rounded-t-md'
            )}
            onClick={() => onSelect(ws.id)}
            onDoubleClick={() => handleDoubleClick(ws)}
            onMouseDown={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onClose(ws.id)
              }
            }}
          >
            {/* Executing or dirty indicator */}
            {wsExecuting ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c74634] animate-pulse flex-shrink-0" />
            ) : dirty ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 animate-in fade-in duration-300" />
            ) : null}

            {/* Tab name or inline edit */}
            {isEditing ? (
              <input
                ref={inputRef}
                className="bg-transparent text-foreground text-xs font-mono w-[100px] outline-none ring-1 ring-[#c74634]/50 rounded px-1 py-0"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitRename(ws.id, ws.name)
                  } else if (e.key === 'Escape') {
                    cancelRename()
                  }
                  e.stopPropagation()
                }}
                onBlur={() => commitRename(ws.id, ws.name)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[120px]">{ws.name}</span>
            )}

            {/* Close button */}
            {worksheets.length > 1 && !isEditing && (
              <button
                className={cn(
                  'h-4 w-4 flex items-center justify-center rounded hover:bg-muted flex-shrink-0',
                  isActive ? 'opacity-50 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(ws.id)
                }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )
      })}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 ml-1"
        onClick={onAdd}
      >
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  )
}
