import { useState, useEffect, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { TaskCard } from '@/ui/components/ai-automation/TaskCard'
import { AITaskDetail } from './AITaskDetail'

interface AIKanbanProps {
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
}

export const AIKanban: FC<AIKanbanProps> = ({ selectedTaskId, onSelectTask }) => {
  const { tasks, moveTaskPhase, deleteTask, settings } = useAIAutomation()
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const theme = settings?.theme || 'dark'
  const isLight = theme === 'light'

  // Sync theme to <html> so all components pick up light/dark overrides
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    // No cleanup — App.tsx manages the global theme class
  }, [isLight])

  const activeBoard = settings?.boards?.find(b => b.id === settings.activeBoardId)
  const pipeline = activeBoard?.pipeline || []
  const columns: { id: string; label: string; type?: string }[] = [
    { id: 'BACKLOG', label: 'Backlog', type: 'fixed' },
    ...pipeline.map(p => ({ id: p.id, label: p.name, type: p.type })),
    { id: 'DONE', label: 'Done', type: 'fixed' },
  ]

  const boardTasks = tasks.filter(t => t.boardId === settings?.activeBoardId)
  const tasksByPhase = (phaseId: string) => boardTasks.filter(t => t.phase === phaseId)

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleDrop = async (targetPhase: string) => {
    if (!draggedTaskId) return
    const task = boardTasks.find(t => t.id === draggedTaskId)
    if (!task || task.phase === targetPhase) {
      setDraggedTaskId(null)
      return
    }

    try {
      await moveTaskPhase(draggedTaskId, targetPhase)
    } catch (err) {
      console.error('Failed to move task:', err)
    }
    setDraggedTaskId(null)
  }

  if (selectedTaskId) {
    return (
      <div className="h-full" style={{ background: 'var(--ai-surface-0)' }}>
        <AITaskDetail taskId={selectedTaskId} onBack={() => onSelectTask(null)} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--ai-surface-0)' }}>
      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {columns.map(({ id, label, type }) => {
            const phaseTasks = tasksByPhase(id)
            const isAgent = type === 'agent'
            const isManual = type === 'manual'
            return (
              <div
                key={id}
                className="w-[280px] flex flex-col ai-column"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(id)}
              >
                {/* Column header */}
                <div className="px-3.5 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
                  <div className="flex items-center gap-2">
                    {isAgent && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ai-accent)' }} />
                    )}
                    {isManual && (
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ai-warning)' }} />
                    )}
                    <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ai-text-primary)' }}>{label}</h3>
                  </div>
                  <span className="ai-badge" style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}>
                    {phaseTasks.length}
                  </span>
                </div>
                {/* Column body */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {phaseTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                    >
                      <TaskCard
                        task={task}
                        onClick={(t) => onSelectTask(t.id)}
                        onDelete={deleteTask}
                        onRetryPhase={(taskId) => moveTaskPhase(taskId, task.phase)}
                        onMoveToBacklog={(taskId) => moveTaskPhase(taskId, 'BACKLOG')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
