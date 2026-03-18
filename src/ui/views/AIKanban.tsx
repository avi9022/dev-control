import { useState, useEffect, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { TaskCard } from '@/ui/components/ai-automation/TaskCard'
import { NewTaskDialog } from '@/ui/components/ai-automation/NewTaskDialog'
import { AITaskDetail } from './AITaskDetail'
import { AISettings } from './AISettings'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Settings, Zap, Sun, Moon } from 'lucide-react'

export const AIKanban: FC = () => {
  const { tasks, moveTaskPhase, deleteTask, updateTask, settings, updateSettings } = useAIAutomation()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const theme = settings?.theme || 'dark'
  const isLight = theme === 'light'
  const themeClass = isLight ? 'ai-kanban ai-light' : 'ai-kanban'

  // Sync theme to <html> so Radix portals (dialogs, selects, popovers) pick up light overrides
  useEffect(() => {
    if (isLight) {
      document.documentElement.setAttribute('data-ai-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-ai-theme')
    }
    return () => document.documentElement.removeAttribute('data-ai-theme')
  }, [isLight])

  const pipeline = settings?.pipeline || []
  const columns: { id: string; label: string; type?: string }[] = [
    { id: 'BACKLOG', label: 'Backlog', type: 'fixed' },
    ...pipeline.map(p => ({ id: p.id, label: p.name, type: p.type })),
    { id: 'DONE', label: 'Done', type: 'fixed' },
  ]

  const tasksByPhase = (phaseId: string) => tasks.filter(t => t.phase === phaseId)

  const handleDragStart = (taskId: string) => {
    setDraggedTaskId(taskId)
  }

  const handleDrop = async (targetPhase: string) => {
    if (!draggedTaskId) return
    const task = tasks.find(t => t.id === draggedTaskId)
    if (!task || task.phase === targetPhase) {
      setDraggedTaskId(null)
      return
    }

    // Let the user drag tasks freely — backend validates the transition

    try {
      await moveTaskPhase(draggedTaskId, targetPhase)
    } catch (err) {
      console.error('Failed to move task:', err)
    }
    setDraggedTaskId(null)
  }

  const agentPhaseIds = pipeline.filter(p => p.type === 'agent').map(p => p.id)
  const runningAgents = tasks.filter(t =>
    agentPhaseIds.includes(t.phase) && t.activeProcessPid
  ).length

  const toggleTheme = () => {
    updateSettings({ theme: isLight ? 'dark' : 'light' })
  }

  if (selectedTaskId) {
    return (
      <div className={`h-full ${themeClass}`} style={{ background: 'var(--ai-surface-0)' }}>
        <AITaskDetail taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
      </div>
    )
  }

  return (
    <div className={`${themeClass} h-full flex flex-col`} style={{ background: 'var(--ai-surface-0)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--ai-border-subtle)' }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--ai-accent-subtle)' }}>
              <Zap className="h-3.5 w-3.5" style={{ color: 'var(--ai-accent)' }} />
            </div>
            <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--ai-text-primary)' }}>
              AI Kanban
            </h2>
          </div>
          {runningAgents > 0 && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg" style={{ background: 'var(--ai-success-subtle)' }}>
              <div className="ai-dot" style={{ background: 'var(--ai-success)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--ai-success)', fontFamily: 'var(--ai-mono)' }}>
                {runningAgents} agent{runningAgents > 1 ? 's' : ''} running
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--ai-text-secondary)', background: 'var(--ai-surface-2)' }}
            title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="border-[var(--ai-border)] bg-transparent hover:bg-[var(--ai-surface-2)] text-[var(--ai-text-secondary)] hover:text-[var(--ai-text-primary)]"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
          <Button
            size="sm"
            onClick={() => setNewTaskOpen(true)}
            className="font-semibold"
            style={{ background: 'var(--ai-accent)', color: isLight ? '#FFFFFF' : 'var(--ai-surface-0)' }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Task
          </Button>
        </div>
      </div>

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
                        onClick={(t) => setSelectedTaskId(t.id)}
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

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className={`${themeClass} !max-w-[95vw] h-[85vh] flex flex-col`} style={{ background: 'var(--ai-surface-0)', borderColor: 'var(--ai-border-subtle)' }}>
          <DialogHeader>
            <DialogTitle>AI Automation Settings</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex flex-col">
            <AISettings />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
