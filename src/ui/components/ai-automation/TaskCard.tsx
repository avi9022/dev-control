import type { FC } from 'react'
import { AlertCircle, Trash2, Loader2 } from 'lucide-react'
import { renderMentions } from './mention-utils'

interface TaskCardProps {
  task: AITask
  onClick: (task: AITask) => void
  onDelete: (taskId: string) => void
}

export const TaskCard: FC<TaskCardProps> = ({ task, onClick, onDelete }) => {
  const isRunning = !!task.activeProcessPid
  const hasAmendments = (task.amendments?.length || 0) > 0

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
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--ai-warning)' }} />
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
