import type { FC } from 'react'
import { AlertCircle } from 'lucide-react'

interface TaskCardProps {
  task: AITask
  onClick: (task: AITask) => void
}

export const TaskCard: FC<TaskCardProps> = ({ task, onClick }) => {
  return (
    <div
      onClick={() => onClick(task)}
      className="p-3 bg-neutral-800 rounded-md border border-neutral-700 cursor-pointer hover:border-neutral-500 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-white truncate">{task.title}</p>
        {task.needsUserInput && (
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
        )}
      </div>
      {task.description && (
        <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {task.currentAgentRole && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300">
            {task.currentAgentRole}
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
