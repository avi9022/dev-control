import type { FC } from 'react'
import { AlertCircle, Trash2 } from 'lucide-react'

interface TaskCardProps {
  task: AITask
  onClick: (task: AITask) => void
  onDelete: (taskId: string) => void
}

export const TaskCard: FC<TaskCardProps> = ({ task, onClick, onDelete }) => {
  return (
    <div
      onClick={() => onClick(task)}
      className="group p-3 bg-neutral-800 rounded-md border border-neutral-700 cursor-pointer hover:border-neutral-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white truncate">{task.title}</p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.needsUserInput && (
            <AlertCircle className="h-4 w-4 text-amber-400" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
            className="h-4 w-4 text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {task.description && (
        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {task.projectPaths && task.projectPaths.length > 0 && task.projectPaths.map(p => (
          <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 truncate max-w-[120px]">
            {p.split('/').pop()}
          </span>
        ))}
        {task.currentPhaseName && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">
            {task.currentPhaseName}
          </span>
        )}
        {task.reviewCycleCount > 0 && (
          <span className="text-[10px] text-neutral-500">
            Review #{task.reviewCycleCount}/{task.maxReviewCycles}
          </span>
        )}
      </div>
    </div>
  )
}
