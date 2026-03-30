import { useState, useEffect, useRef, type FC } from 'react'
import { AlertCircle, Trash2, Loader2, Layers, ExternalLink } from 'lucide-react'
import { renderMentions } from './mention-utils'
import { AttentionReason, FIXED_PHASES } from '@/shared/constants'

interface TaskCardProps {
  task: AITask
  onClick: (task: AITask, event: React.MouseEvent) => void
  onDelete: (taskId: string) => void
  onRetryPhase?: (taskId: string) => void
  onMoveToBacklog?: (taskId: string) => void
  onOpenDetail?: (taskId: string) => void
}

const warningReasonLabel = (reason?: string): string => {
  switch (reason) {
    case AttentionReason.Crashed: return 'Agent interrupted'
    case AttentionReason.MaxRetries: return 'Stall retries exhausted'
    case AttentionReason.Error: return 'Agent error'
    default: return 'Needs attention'
  }
}

export const TaskCard: FC<TaskCardProps> = ({ task, onClick, onDelete, onRetryPhase, onMoveToBacklog, onOpenDetail }) => {
  const isRunning = !!task.activeProcessPid
  const hasAmendments = (task.amendments?.length || 0) > 0
  const isCluster = !!task.isCluster
  const activeSubtask = isCluster && task.subtasks && task.activeSubtaskIndex !== undefined
    ? task.subtasks[task.activeSubtaskIndex]
    : undefined
  const completedSubtaskCount = isCluster && task.subtasks
    ? task.subtasks.filter(s => s.phase === FIXED_PHASES.DONE).length
    : 0
  const totalSubtaskCount = task.subtasks?.length || 0
  const [showWarningMenu, setShowWarningMenu] = useState(false)
  const warningRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showWarningMenu) return
    const handler = (e: MouseEvent) => {
      if (warningRef.current && e.target instanceof Node && !warningRef.current.contains(e.target)) {
        setShowWarningMenu(false)
      }
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showWarningMenu])

  return (
    <div
      onClick={(e) => onClick(task, e)}
      className="group ai-card cursor-pointer p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isRunning && (
            <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" style={{ color: 'var(--ai-accent)' }} />
          )}
          {task.needsUserInput && !isRunning && (
            <div ref={warningRef} className="relative flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setShowWarningMenu(prev => !prev) }}
                className="flex items-center justify-center"
                title={warningReasonLabel(task.needsUserInputReason)}
              >
                <AlertCircle className="h-3.5 w-3.5" style={{ color: 'var(--ai-warning)' }} />
              </button>
              {showWarningMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--ai-surface-1)',
                    border: '1px solid var(--ai-border-subtle)',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    padding: 8,
                    zIndex: 50,
                    minWidth: 160,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p
                    className="text-[11px] mb-2"
                    style={{ color: 'var(--ai-text-tertiary)' }}
                  >
                    {warningReasonLabel(task.needsUserInputReason)}
                  </p>
                  <button
                    onClick={() => { setShowWarningMenu(false); onRetryPhase?.(task.id) }}
                    className="w-full text-left text-[12px] font-medium px-2 py-1.5 rounded-md transition-colors"
                    style={{ color: 'var(--ai-accent)', background: 'var(--ai-accent-subtle)' }}
                  >
                    Retry Phase
                  </button>
                  <button
                    onClick={() => { setShowWarningMenu(false); onMoveToBacklog?.(task.id) }}
                    className="w-full text-left text-[12px] font-medium px-2 py-1.5 rounded-md mt-1 transition-colors"
                    style={{ color: 'var(--ai-text-secondary)', background: 'transparent', border: '1px solid var(--ai-border-subtle)' }}
                  >
                    Move to Backlog
                  </button>
                </div>
              )}
            </div>
          )}
          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ai-text-primary)' }}>
            {task.title}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isCluster && onOpenDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail(task.id) }}
              className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--ai-text-tertiary)' }}
              title="Open cluster details"
            >
              <ExternalLink className="h-3.5 w-3.5 transition-colors" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--ai-text-tertiary)' }}
            title="Delete task"
          >
            <Trash2 className="h-3.5 w-3.5 transition-colors" />
          </button>
        </div>
      </div>

      {isCluster && activeSubtask && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Layers className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--ai-text-tertiary)' }} />
          <span className="text-xs truncate" style={{ color: 'var(--ai-text-secondary)' }}>
            {activeSubtask.title}
          </span>
          <span
            className="ai-badge ml-auto flex-shrink-0"
            style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}
          >
            {completedSubtaskCount}/{totalSubtaskCount}
          </span>
        </div>
      )}

      {!isCluster && task.description && (
        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--ai-text-secondary)' }}>
          {renderMentions(task.description, new Set((task.projects || []).map(p => p.label)))}
        </p>
      )}

      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {task.projects && task.projects.length > 0 && task.projects.map((p, i) => (
          <span
            key={i}
            className="ai-badge truncate max-w-[120px]"
            style={{ background: 'var(--ai-purple-subtle)', color: 'var(--ai-purple)' }}
          >
            {p.label}
          </span>
        ))}
        {task.currentPhaseName && (
          <span
            className="ai-badge"
            style={{ background: 'var(--ai-surface-3)', color: 'var(--ai-text-tertiary)' }}
          >
            {task.currentPhaseName}
          </span>
        )}
        {hasAmendments && (
          <span
            className="ai-badge"
            style={{ background: 'var(--ai-pink-subtle)', color: 'var(--ai-pink)' }}
          >
            {task.amendments?.length ?? 0} amendment{(task.amendments?.length ?? 0) > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
