import { useState, useRef, useEffect, type FC } from 'react'
import { ChevronDown, Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { DEFAULT_PIPELINE } from '@/electron/storage/store'

interface BoardSwitcherProps {
  settings: AIAutomationSettings
  updateSettings: (updates: Partial<AIAutomationSettings>) => void
}

const BOARD_COLORS = ['#9BB89E', '#6B7FD7', '#D4A843', '#D46B6B', '#9B6DC6', '#6BBDD4', '#D4916B', '#7C8894']

export const BoardSwitcher: FC<BoardSwitcherProps> = ({ settings, updateSettings }) => {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const boards = settings.boards || []
  const activeBoard = boards.find(b => b.id === settings.activeBoardId) || boards[0]

  // Click-outside handler
  useEffect(() => {
    if (!open) return
    const handle = (e: PointerEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditingId(null)
      }
    }
    const timer = setTimeout(() => window.addEventListener('pointerdown', handle, true), 10)
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', handle, true) }
  }, [open])

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const switchBoard = (boardId: string) => {
    updateSettings({ activeBoardId: boardId })
    setOpen(false)
  }

  const startEditing = (board: AIBoard) => {
    setEditingId(board.id)
    setEditName(board.name)
  }

  const confirmEdit = () => {
    if (!editingId || !editName.trim()) return
    const updatedBoards = boards.map(b =>
      b.id === editingId ? { ...b, name: editName.trim() } : b
    )
    updateSettings({ boards: updatedBoards })
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
  }

  const deleteBoard = (boardId: string) => {
    if (boards.length <= 1) return
    const confirmed = window.confirm('Delete this board? Its tasks will be moved to the first remaining board.')
    if (!confirmed) return

    const remaining = boards.filter(b => b.id !== boardId)
    const targetBoardId = remaining[0].id

    // Move tasks from deleted board to first remaining board
    // This is done by updating each task's boardId via the backend
    // For now, we update settings — task migration is handled by the backend on next load
    // Actually, we need to move tasks now. We'll do it via updateSettings and rely on
    // the task manager to handle it. But since we only have updateSettings for settings,
    // we'll broadcast the board deletion and let the UI filter handle it.
    // The simplest approach: update all tasks with this boardId to targetBoardId
    window.electron.aiGetTasks().then(tasks => {
      const toMigrate = tasks.filter(t => t.boardId === boardId)
      for (const task of toMigrate) {
        window.electron.aiUpdateTask(task.id, { boardId: targetBoardId })
      }
    })

    const newActiveBoardId = settings.activeBoardId === boardId ? targetBoardId : settings.activeBoardId
    updateSettings({ boards: remaining, activeBoardId: newActiveBoardId })
  }

  const createBoard = () => {
    const newBoard: AIBoard = {
      id: crypto.randomUUID(),
      name: `Board ${boards.length + 1}`,
      color: BOARD_COLORS[boards.length % BOARD_COLORS.length],
      pipeline: DEFAULT_PIPELINE.map(p => ({ ...p })),
      createdAt: new Date().toISOString(),
    }
    updateSettings({
      boards: [...boards, newBoard],
      activeBoardId: newBoard.id,
    })
    setOpen(false)
  }

  if (!activeBoard) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          background: 'var(--ai-surface-2)',
          color: 'var(--ai-text-primary)',
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: activeBoard.color }}
        />
        <span className="text-sm font-medium max-w-[140px] truncate">{activeBoard.name}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-lg border shadow-lg overflow-hidden"
          style={{
            background: 'var(--ai-surface-2)',
            borderColor: 'var(--ai-border-subtle)',
          }}
        >
          {boards.map(board => (
            <div
              key={board.id}
              className="flex items-center gap-2 px-3 py-2 transition-colors"
              style={{
                background: board.id === settings.activeBoardId ? 'var(--ai-surface-3)' : undefined,
              }}
            >
              {editingId === board.id ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: board.color }}
                  />
                  <input
                    ref={editInputRef}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 min-w-0 text-sm bg-transparent border-b outline-none"
                    style={{
                      color: 'var(--ai-text-primary)',
                      borderColor: 'var(--ai-accent)',
                    }}
                  />
                  <button
                    onClick={confirmEdit}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--ai-surface-3)]"
                    style={{ color: 'var(--ai-success)' }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-shrink-0 p-0.5 rounded hover:bg-[var(--ai-surface-3)]"
                    style={{ color: 'var(--ai-text-tertiary)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => switchBoard(board.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: board.color }}
                    />
                    <span
                      className="text-sm truncate"
                      style={{ color: board.id === settings.activeBoardId ? 'var(--ai-text-primary)' : 'var(--ai-text-secondary)' }}
                    >
                      {board.name}
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditing(board) }}
                      className="p-1 rounded transition-colors hover:bg-[var(--ai-surface-3)]"
                      style={{ color: 'var(--ai-text-tertiary)' }}
                      title="Rename board"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {boards.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteBoard(board.id) }}
                        className="p-1 rounded transition-colors hover:bg-[var(--ai-surface-3)]"
                        style={{ color: 'var(--ai-text-tertiary)' }}
                        title="Delete board"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--ai-border-subtle)' }}>
            <button
              onClick={createBoard}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors hover:bg-[var(--ai-surface-3)]"
              style={{ color: 'var(--ai-accent)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              New Board
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
