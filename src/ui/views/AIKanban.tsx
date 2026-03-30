import { useState, useEffect, useMemo, useCallback, lazy, Suspense, type FC } from 'react'
import { useAIAutomation } from '@/ui/contexts/ai-automation'
import { TaskCard } from '@/ui/components/ai-automation/TaskCard'
import { ClusterFlowOverlay } from '@/ui/components/ai-automation/ClusterOverlay'
import { AITaskDetail } from './AITaskDetail'
import { FIXED_PHASES, PhaseType, DEFAULT_PHASE_COLOR, DEFAULT_BOARD_COLOR } from '@/shared/constants'

const KANBAN_COLUMN_WIDTH = 280
const EXPANDED_CARD_Z_INDEX = 101
const SHOW_PARENT_INDEX = -1

const World3DLazy = lazy(() => import('@/ui/components/ai-automation/World3D').then(m => ({ default: m.World3D })))

interface AIKanbanProps {
  selectedTaskId: string | null
  onSelectTask: (taskId: string | null) => void
  show3D?: boolean
}

export const AIKanban: FC<AIKanbanProps> = ({ selectedTaskId, onSelectTask, show3D }) => {
  const { tasks, moveTaskPhase, deleteTask, settings } = useAIAutomation()
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [expandedCluster, setExpandedCluster] = useState<{ taskId: string; rect: DOMRect } | null>(null)
  const [selectedSubtaskIndex, setSelectedSubtaskIndex] = useState<number | undefined>(undefined)

  const handleClusterSubtaskClick = useCallback((taskId: string, subtaskIndex: number) => {
    setExpandedCluster(null)
    setSelectedSubtaskIndex(subtaskIndex)
    onSelectTask(taskId)
  }, [onSelectTask])

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
  const pipeline = useMemo(() => activeBoard?.pipeline || [], [activeBoard?.pipeline])
  const columns: { id: string; label: string; type?: string }[] = [
    { id: FIXED_PHASES.BACKLOG, label: 'Backlog', type: 'fixed' },
    ...pipeline.map(p => ({ id: p.id, label: p.name, type: p.type })),
    { id: FIXED_PHASES.DONE, label: 'Done', type: 'fixed' },
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

  const zones = useMemo(() => {
    const backlog = { id: FIXED_PHASES.BACKLOG, label: 'Backlog', color: DEFAULT_PHASE_COLOR }
    const pipelineZones = pipeline.map(p => ({ id: p.id, label: p.name, color: p.color }))
    const done = { id: FIXED_PHASES.DONE, label: 'Done', color: DEFAULT_BOARD_COLOR }
    return [backlog, ...pipelineZones, done]
  }, [pipeline])

  const tasks3D = useMemo(() =>
    boardTasks.map(t => ({
      id: t.id,
      title: t.title,
      phase: t.phase,
      isRunning: !!t.activeProcessPid,
      needsAttention: !!t.needsUserInput,
    })),
  [boardTasks])

  if (selectedTaskId) {
    return (
      <div className="h-full" style={{ background: 'var(--ai-surface-0)' }}>
        <AITaskDetail taskId={selectedTaskId} onBack={() => { onSelectTask(null); setSelectedSubtaskIndex(undefined) }} onSelectTask={onSelectTask} subtaskIndex={selectedSubtaskIndex} />
      </div>
    )
  }

  if (show3D) {
    return (
      <div className="h-full" style={{ background: 'var(--ai-surface-0)' }}>
        <Suspense fallback={<div className="h-full flex items-center justify-center" style={{ color: 'var(--ai-text-tertiary)' }}>Loading 3D world...</div>}>
          <World3DLazy zones={zones} tasks={tasks3D} onTaskClick={(id) => onSelectTask(id)} />
        </Suspense>
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
            const isAgent = type === PhaseType.Agent
            const isManual = type === PhaseType.Manual
            return (
              <div
                key={id}
                className="flex flex-col ai-column"
                style={{ width: KANBAN_COLUMN_WIDTH }}
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
                      style={expandedCluster?.taskId === task.id ? { position: 'relative', zIndex: EXPANDED_CARD_Z_INDEX } : undefined}
                    >
                      <TaskCard
                        task={task}
                        onClick={(t, e) => t.isCluster ? setExpandedCluster({ taskId: t.id, rect: e.currentTarget.getBoundingClientRect() }) : onSelectTask(t.id)}
                        onDelete={deleteTask}
                        onRetryPhase={(taskId) => moveTaskPhase(taskId, task.phase)}
                        onMoveToBacklog={(taskId) => moveTaskPhase(taskId, FIXED_PHASES.BACKLOG)}
                        onOpenDetail={(taskId) => { setSelectedSubtaskIndex(SHOW_PARENT_INDEX); onSelectTask(taskId) }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {expandedCluster && (() => {
        const clusterTask = tasks.find(t => t.id === expandedCluster.taskId)
        if (!clusterTask) return null
        return (
          <ClusterFlowOverlay
            task={clusterTask}
            anchorRect={expandedCluster.rect}
            onSelectSubtask={handleClusterSubtaskClick}
            onDelete={deleteTask}
            onClose={() => setExpandedCluster(null)}
          />
        )
      })()}
    </div>
  )
}
