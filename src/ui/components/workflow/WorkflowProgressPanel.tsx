import { type FC, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useWorkflows } from '@/ui/contexts/workflows'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  SkipForward,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react'

interface WorkflowProgressPanelProps {
  workflowId: string
}

const statusIcons: Record<WorkflowStepStatus, typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  skipped: SkipForward,
}

const statusColors: Record<WorkflowStepStatus, string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  skipped: 'text-zinc-500',
}

export const WorkflowProgressPanel: FC<WorkflowProgressPanelProps> = ({ workflowId }) => {
  const { activeProgress, cancelWorkflow, clearProgress, getWorkflowById } = useWorkflows()
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const progress = activeProgress[workflowId]

  if (!progress) return null

  const workflow = getWorkflowById(workflowId)
  const steps = progress.phase === 'starting' ? workflow?.startSteps : workflow?.stopSteps
  const enabledSteps = steps?.filter((s) => s.enabled) || []

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  const formatElapsed = (startedAt?: number, completedAt?: number) => {
    if (!startedAt) return ''
    const end = completedAt || Date.now()
    const elapsed = Math.round((end - startedAt) / 100) / 10
    return `${elapsed}s`
  }

  const isExecuting = progress.status === 'starting' || progress.status === 'stopping'
  const isDone = !isExecuting
  const isSuccess = progress.status === 'running' || progress.status === 'idle'
  const isError = progress.status === 'error'

  const totalElapsed = formatElapsed(progress.startedAt, isDone ? (progress.steps.at(-1)?.completedAt || Date.now()) : undefined)

  const getHeaderLabel = () => {
    if (isExecuting) return `${progress.phase === 'starting' ? 'Starting' : 'Stopping'}...`
    if (isSuccess && progress.phase === 'starting') return 'Started successfully'
    if (isSuccess && progress.phase === 'stopping') return 'Stopped successfully'
    if (isError) return 'Failed'
    return 'Done'
  }

  const headerColor = isExecuting ? 'text-foreground' : isSuccess ? 'text-green-400' : 'text-red-400'
  const HeaderIcon = isExecuting ? Loader2 : isSuccess ? CheckCircle2 : XCircle

  return (
    <div className={`mt-2 border rounded p-2 ${isSuccess ? 'bg-green-500/5 border-green-500/20' : isError ? 'bg-red-500/5 border-red-500/20' : 'bg-muted/20'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <HeaderIcon className={`h-3.5 w-3.5 ${headerColor} ${isExecuting ? 'animate-spin' : ''}`} />
          <span className={`text-xs font-medium ${headerColor}`}>
            {getHeaderLabel()}
          </span>
          {totalElapsed && isDone && (
            <span className="text-[10px] text-muted-foreground">({totalElapsed})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isExecuting && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-xs px-2 text-destructive"
              onClick={() => cancelWorkflow(workflowId)}
            >
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          )}
          {isDone && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => clearProgress(workflowId)}
              title="Dismiss"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="max-h-[250px] overflow-y-auto">
        <div className="space-y-1">
          {progress.steps.map((stepProgress, index) => {
            const stepDef = enabledSteps[index]
            const Icon = statusIcons[stepProgress.status]
            const hasOutput = !!stepProgress.output || !!stepProgress.message
            const isExpanded = expandedSteps.has(stepProgress.stepId)

            return (
              <div key={stepProgress.stepId}>
                <div
                  className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/50 rounded px-1"
                  onClick={() => hasOutput && toggleExpand(stepProgress.stepId)}
                >
                  {hasOutput ? (
                    isExpanded ? (
                      <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}

                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${statusColors[stepProgress.status]} ${
                      stepProgress.status === 'running' ? 'animate-spin' : ''
                    }`}
                  />
                  <span className="text-xs w-0 flex-1 truncate">
                    {stepDef?.label || `Step ${index + 1}`}
                  </span>

                  {stepProgress.attempt > 1 && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      attempt {stepProgress.attempt}
                    </span>
                  )}

                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatElapsed(stepProgress.startedAt, stepProgress.completedAt)}
                  </span>
                </div>

                {isExpanded && hasOutput && (
                  <div className="ml-7 mt-0.5 mb-1">
                    {stepProgress.message && (
                      <p className="text-[11px] text-red-400 mb-1">{stepProgress.message}</p>
                    )}
                    {stepProgress.output && (
                      <pre className="text-[10px] font-mono bg-black/40 rounded p-1.5 max-h-[100px] overflow-auto whitespace-pre-wrap text-muted-foreground">
                        {stepProgress.output.slice(-2000)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {progress.error && (
        <p className="text-[11px] text-red-400 mt-1 px-1">{progress.error}</p>
      )}
    </div>
  )
}
