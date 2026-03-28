import { type FC } from 'react'
import { Badge } from '@/components/ui/badge'

interface WorkflowStatusBadgeProps {
  status: WorkflowStatus | undefined
}

const statusConfig: Record<WorkflowStatus, { label: string; className: string }> = {
  idle: { label: 'Idle', className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  starting: { label: 'Starting', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse' },
  running: { label: 'Running', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  stopping: { label: 'Stopping', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse' },
  partial: { label: 'Partial', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  error: { label: 'Error', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

export const WorkflowStatusBadge: FC<WorkflowStatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status || 'idle']

  return (
    <Badge variant="outline" className={`text-xs px-1.5 py-0 ${config.className}`}>
      {config.label}
    </Badge>
  )
}
