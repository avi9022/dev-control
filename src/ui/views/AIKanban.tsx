import { useState, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { TaskCard } from '@/ui/components/ai-automation/TaskCard'
import { NewTaskDialog } from '@/ui/components/ai-automation/NewTaskDialog'
import { AITaskDetail } from './AITaskDetail'
import { AISettings } from './AISettings'
import { Button } from '@/components/ui/button'
import { Plus, Settings } from 'lucide-react'

export const AIKanban: FC = () => {
  const { tasks, moveTaskPhase, deleteTask, settings } = useAIAutomation()
  const [newTaskOpen, setNewTaskOpen] = useState(false)
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const pipeline = settings?.pipeline || []
  const columns: { id: string; label: string }[] = [
    { id: 'BACKLOG', label: 'Backlog' },
    ...pipeline.map(p => ({ id: p.id, label: p.name })),
    { id: 'DONE', label: 'Done' },
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

    const firstPhase = pipeline.length > 0 ? pipeline[0].id : null
    const isAllowed =
      (task.phase === 'BACKLOG' && targetPhase === firstPhase) ||
      (task.phase === firstPhase && targetPhase === 'BACKLOG')
    if (!isAllowed) {
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

  const agentPhaseIds = pipeline.filter(p => p.type === 'agent').map(p => p.id)
  const runningAgents = tasks.filter(t =>
    agentPhaseIds.includes(t.phase) && t.activeProcessPid
  ).length

  if (showSettings) {
    return (
      <div className="h-full">
        <AISettings onBack={() => setShowSettings(false)} />
      </div>
    )
  }

  if (selectedTaskId) {
    return (
      <div className="h-full">
        <AITaskDetail taskId={selectedTaskId} onBack={() => setSelectedTaskId(null)} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">AI Kanban</h2>
          {runningAgents > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">
              {runningAgents} agent{runningAgents > 1 ? 's' : ''} running
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-1" />
            Settings
          </Button>
          <Button size="sm" onClick={() => setNewTaskOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {columns.map(({ id, label }) => {
            const phaseTasks = tasksByPhase(id)
            return (
              <div
                key={id}
                className="w-[250px] flex flex-col bg-neutral-900/50 rounded-lg border border-neutral-800"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(id)}
              >
                <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-neutral-300">{label}</h3>
                  <span className="text-xs text-neutral-500">{phaseTasks.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {phaseTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task.id)}
                    >
                      <TaskCard task={task} onClick={(t) => setSelectedTaskId(t.id)} onDelete={deleteTask} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
    </div>
  )
}
