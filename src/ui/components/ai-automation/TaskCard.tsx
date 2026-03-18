import { useState, useEffect, useRef, type FC } from 'react'
import { AlertCircle, Trash2, Loader2 } from 'lucide-react'
import { renderMentions } from './mention-utils'

interface TaskCardProps {
  task: AITask
  onClick: (task: AITask) => void
  onDelete: (taskId: string) => void
  onRetryPhase?: (taskId: string) => void
  onMoveToBacklog?: (taskId: string) => void
}

const warningReasonLabel = (reason?: string): string => {
  switch (reason) {
    case 'crashed': return 'Agent interrupted'
    case 'max_retries': return 'Stall retries exhausted'
    case 'error': return 'Agent error'
    default: return 'Needs attention'
  }
}

export const TaskCard: FC<TaskCardProps> = ({ task, onClick, onDelete, onRetryPhase, onMoveToBacklog }) => {
  const isRunning = !!task.activeProcessPid
  const hasAmendments = (task.amendments?.length || 0) > 0
  const [showWarningMenu, setShowWarningMenu] = useState(false)
  const warningRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showWarningMenu) return
    const handler = (e: MouseEvent) => {
      if (warningRef.current && !warningRef.current.contains(e.target as Node)) {
        setShowWarningMenu(false)
      }
    }
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [showWarningMenu])

  return (
    <div
      onClick={() => onClick(task)}
      className="group ai-card cursor-pointer p-3"
    >
      {/* Title row */}
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
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          className="h-3.5 w-3.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: 'var(--ai-text-tertiary)' }}
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5 transition-colors" />
        </button>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs mt-1.5 line-clamp-2 leading-relaxed" style={{ color: 'var(--ai-text-secondary)' }}>
          {renderMentions(task.description, new Set((task.projects || []).map(p => p.label)))}
        </p>
      )}

      {/* Footer badges */}
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
            {task.amendments!.length} amendment{task.amendments!.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
